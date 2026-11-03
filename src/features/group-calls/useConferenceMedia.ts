import { useCallback, useEffect, useRef, useState } from "react";
import type { Participant, Room } from "livekit-client";
import { conferenceMedia, groupCallError } from "./api";
import { hasActiveCall, holdCallUpdates } from "@/lib/call-update-guard";
import { unlockCallAudio } from "@/lib/audio-context";

/** Mounted above routes so navigating to the group's messages preserves media. */
export function useConferenceMedia(userId: string | undefined) {
  const ref = useRef<Room | null>(null);
  const session = useRef<{ id: string; device: string } | null>(null);
  const generation = useRef(0);
  const pendingClose = useRef<{ id: string; device: string } | null>(null);
  const hold = useRef<(() => void) | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(false);
  const [connection, setConnection] = useState("disconnected");
  const [error, setError] = useState("");
  const [audioBlocked, setAudioBlocked] = useState(false);
  const stop = useCallback(() => {
    generation.current++;
    const r = ref.current;
    ref.current = null;
    r?.removeAllListeners();
    r?.localParticipant.trackPublications.forEach((p) => p.track?.stop());
    void r?.disconnect();
    hold.current?.();
    hold.current = null;
    setRoom(null);
    setParticipants([]);
    setLoading(false);
    setConnection("disconnected");
  }, []);
  const leave = useCallback(
    async (endForAll = false) => {
      const s = session.current || pendingClose.current;
      session.current = null;
      pendingClose.current = s;
      stop();
      if (s) {
        try {
          await conferenceMedia(endForAll ? "end" : "leave", s.id, s.device);
          pendingClose.current = null;
          return true;
        } catch (e) {
          setError(groupCallError(e));
          return false;
        }
      }
      return true;
    },
    [stop],
  );
  useEffect(
    () => () => {
      const s = session.current || pendingClose.current;
      session.current = null;
      pendingClose.current = s;
      stop();
      if (s) void conferenceMedia("leave", s.id, s.device).catch(() => {});
    },
    [userId, stop],
  );

  const join = useCallback(
    async (id: string, type: "voice" | "video") => {
      if (session.current || hasActiveCall()) throw new Error("caller_busy");
      unlockCallAudio();
      const epoch = ++generation.current;
      const s = { id, device: crypto.randomUUID() };
      session.current = s;
      hold.current = holdCallUpdates();
      setLoading(true);
      setError("");
      const current = () => epoch === generation.current;
      let next: Room | null = null;
      try {
        const [credentials, sdk] = await Promise.all([
          conferenceMedia("join", id, s.device),
          import("livekit-client"),
        ]);
        if (!current()) {
          await conferenceMedia("leave", id, s.device).catch(() => {});
          return false;
        }
        next = new sdk.Room({
          adaptiveStream: true,
          dynacast: true,
          audioCaptureDefaults: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          videoCaptureDefaults: {
            resolution: { width: 640, height: 360, frameRate: 24 },
          },
          publishDefaults: { simulcast: true, dtx: true, red: true },
        });
        const r = next;
        ref.current = r;
        const sync = () => {
          if (current())
            setParticipants([
              r.localParticipant,
              ...r.remoteParticipants.values(),
            ]);
        };
        for (const event of [
          sdk.RoomEvent.ParticipantConnected,
          sdk.RoomEvent.ParticipantDisconnected,
          sdk.RoomEvent.TrackSubscribed,
          sdk.RoomEvent.TrackUnsubscribed,
          sdk.RoomEvent.TrackMuted,
          sdk.RoomEvent.TrackUnmuted,
          sdk.RoomEvent.LocalTrackPublished,
          sdk.RoomEvent.LocalTrackUnpublished,
          sdk.RoomEvent.ActiveSpeakersChanged,
        ])
          r.on(event, sync);
        r.on(sdk.RoomEvent.ConnectionStateChanged, (state) => {
          if (current()) setConnection(state);
        });
        r.on(sdk.RoomEvent.AudioPlaybackStatusChanged, () => {
          if (current()) setAudioBlocked(!r.canPlaybackAudio);
        });
        r.on(sdk.RoomEvent.Disconnected, () => {
          if (current()) {
            setError(groupCallError(new Error("disconnected")));
            void leave();
          }
        });
        await r.connect(credentials.url, credentials.token);
        if (!current()) {
          await r.disconnect();
          return false;
        }
        setRoom(r);
        sync();
        // Audio is independent of camera permission, and refusal permits listening.
        try {
          await r.localParticipant.setMicrophoneEnabled(true);
        } catch {
          if (current()) setError(groupCallError(new Error("microphone")));
        }
        if (!current()) {
          r.localParticipant.trackPublications.forEach((p) => p.track?.stop());
          await r.disconnect();
          return false;
        }
        if (type === "video") {
          void r.localParticipant
            .setCameraEnabled(true)
            .then(() => {
              if (!current()) {
                r.localParticipant.trackPublications.forEach((p) =>
                  p.track?.stop(),
                );
                void r.disconnect();
              } else sync();
            })
            .catch(() => {
              if (current()) setError(groupCallError(new Error("camera")));
            });
        }
        await r.startAudio().catch(() => {});
        if (current()) {
          setAudioBlocked(!r.canPlaybackAudio);
          sync();
          return true;
        }
        return false;
      } catch (e) {
        if (current()) {
          await leave();
          setError(groupCallError(e));
        } else {
          next?.localParticipant.trackPublications.forEach((p) =>
            p.track?.stop(),
          );
          void next?.disconnect();
        }
        return false;
      } finally {
        if (current()) setLoading(false);
      }
    },
    [leave],
  );
  useEffect(() => {
    if (!room) return;
    let running = false;
    let lastVerified = Date.now();
    const beat = async () => {
      const s = session.current;
      if (!s || running) return;
      running = true;
      try {
        await conferenceMedia("heartbeat", s.id, s.device);
        lastVerified = Date.now();
      } catch (e) {
        // Fail closed when membership, room or device authorization is lost.
        const revoked =
          e instanceof Error &&
          [
            "not_allowed",
            "conference_closed",
            "session_lost",
            "not_invited",
            "caller_busy",
            "participant_unavailable",
          ].includes(e.message);
        if (
          session.current === s &&
          (revoked || Date.now() - lastVerified > 75_000)
        ) {
          setError(groupCallError(e));
          void leave();
        }
      } finally {
        running = false;
      }
    };
    const timer = setInterval(() => void beat(), 20_000);
    const visible = () => {
      if (document.visibilityState === "visible") void beat();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [room, leave]);
  const toggle = async (kind: "camera" | "microphone") => {
    const r = ref.current;
    if (!r) return;
    try {
      if (kind === "camera")
        await r.localParticipant.setCameraEnabled(
          !r.localParticipant.isCameraEnabled,
        );
      else
        await r.localParticipant.setMicrophoneEnabled(
          !r.localParticipant.isMicrophoneEnabled,
        );
      if (ref.current !== r) {
        r.localParticipant.trackPublications.forEach((p) => p.track?.stop());
        return;
      }
      setParticipants([r.localParticipant, ...r.remoteParticipants.values()]);
      setError("");
    } catch (e) {
      setError(groupCallError(new Error(kind)));
    }
  };
  return {
    room,
    participants,
    loading,
    connection,
    error,
    audioBlocked,
    join,
    leave,
    toggle,
  };
}
