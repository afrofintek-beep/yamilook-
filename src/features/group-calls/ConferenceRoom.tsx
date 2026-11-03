import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Track, type Participant, type Room } from "livekit-client";
import {
  ArrowDownLeft,
  Camera,
  CameraOff,
  Mic,
  MicOff,
  PhoneOff,
  UserPlus,
  Volume2,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { VideoTrack } from "@/components/live/VideoTrack";
import type { Conference } from "./api";
import type { useConferenceMedia } from "./useConferenceMedia";
function Tile({
  participant,
  room,
  pinned,
  onPin,
}: {
  participant: Participant;
  room: Room;
  pinned: boolean;
  onPin: () => void;
}) {
  const { t } = useTranslation();
  const camera = participant.getTrackPublication(Track.Source.Camera);
  return (
    <button
      onClick={onPin}
      aria-pressed={pinned}
      className={`relative aspect-video rounded-xl bg-black overflow-hidden border-2 ${participant.isSpeaking ? "border-primary" : "border-transparent"}`}
    >
      {camera?.track && !camera.isMuted ? (
        <VideoTrack
          track={camera.track}
          muted
          className="h-full w-full object-contain"
        />
      ) : (
        <span className="grid h-full place-items-center text-white text-lg">
          {participant.name?.slice(0, 2) || "•"}
        </span>
      )}
      <span className="absolute bottom-0 inset-x-0 bg-black/65 text-white text-xs p-2 flex gap-2 items-center">
        <span className="flex-1 truncate text-left">
          {participant.name || t("groupCalls.participant")}
          {participant === room.localParticipant
            ? ` (${t("groupCalls.you")})`
            : ""}
        </span>
        {!participant.isMicrophoneEnabled && <MicOff className="w-4 h-4" />}
      </span>
    </button>
  );
}
export default function ConferenceRoom({
  conference,
  media,
  onLeave,
  onEnd,
  onInvite,
  onMinimize,
  onMessages,
  onRetry,
}: {
  conference: Conference;
  media: ReturnType<typeof useConferenceMedia>;
  onLeave: () => void;
  onEnd?: () => void;
  onInvite: () => void;
  onMinimize: () => void;
  onMessages: () => void;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  const [pinned, setPinned] = useState<string | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const selected =
    media.participants.find((p) => p.identity === pinned) ||
    media.participants.find((p) => p.isSpeaking);
  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-label={t("groupCalls.title")}
      className="fixed inset-0 z-[160] bg-background h-screen-safe flex flex-col safe-top"
    >
      <header className="flex items-center gap-2 p-3 border-b">
        <Button
          size="icon"
          variant="ghost"
          aria-label={t("groupCalls.minimize")}
          onClick={onMinimize}
        >
          <ArrowDownLeft />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-semibold">{conference.name}</h1>
          <p role="status" className="text-xs text-muted-foreground">
            {media.loading
              ? t("groupCalls.connecting")
              : t(`groupCalls.connection.${media.connection}`, {
                  defaultValue: t("groupCalls.connecting"),
                })}{" "}
            · {media.participants.length}/8
          </p>
        </div>
      </header>
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
        {media.error && (
          <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm">
            {media.error}
          </p>
        )}
        {media.audioBlocked && (
          <Button
            className="w-full"
            onClick={() => void media.room?.startAudio()}
          >
            <Volume2 className="mr-2 h-4 w-4" />
            {t("groupCalls.enableAudio")}
          </Button>
        )}
        {media.room && (
          <>
            {selected && media.participants.length > 2 && (
              <Tile
                participant={selected}
                room={media.room}
                pinned={pinned === selected.identity}
                onPin={() =>
                  setPinned(
                    pinned === selected.identity ? null : selected.identity,
                  )
                }
              />
            )}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              {media.participants.map((p) => (
                <Tile
                  key={p.identity}
                  participant={p}
                  room={media.room!}
                  pinned={pinned === p.identity}
                  onPin={() =>
                    setPinned(pinned === p.identity ? null : p.identity)
                  }
                />
              ))}
            </div>
            {media.participants.length === 1 && (
              <p className="text-center text-muted-foreground py-5">
                {t("groupCalls.waiting")}
              </p>
            )}
          </>
        )}
        {!media.room && !media.loading && (
          <Button onClick={onRetry}>{t("groupCalls.retry")}</Button>
        )}
        {confirmEnd && (
          <div className="rounded-xl border p-3 space-y-3">
            <p>{t("groupCalls.confirmEnd")}</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setConfirmEnd(false)}>
                {t("common.cancel")}
              </Button>
              <Button variant="destructive" onClick={onEnd}>
                {t("groupCalls.endAll")}
              </Button>
            </div>
          </div>
        )}
      </div>
      <footer className="shrink-0 border-t p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] flex flex-wrap gap-2 justify-center">
        <Button
          size="icon"
          variant="outline"
          disabled={!media.room}
          aria-label={t("groupCalls.microphone")}
          aria-pressed={
            media.room?.localParticipant.isMicrophoneEnabled || false
          }
          onClick={() => void media.toggle("microphone")}
        >
          {media.room?.localParticipant.isMicrophoneEnabled ? (
            <Mic />
          ) : (
            <MicOff />
          )}
        </Button>
        {conference.call_type === "video" && (
          <Button
            size="icon"
            variant="outline"
            disabled={!media.room}
            aria-label={t("groupCalls.camera")}
            aria-pressed={media.room?.localParticipant.isCameraEnabled || false}
            onClick={() => void media.toggle("camera")}
          >
            {media.room?.localParticipant.isCameraEnabled ? (
              <Camera />
            ) : (
              <CameraOff />
            )}
          </Button>
        )}
        <Button
          size="icon"
          variant="outline"
          disabled={!media.room}
          aria-label={t("groupCalls.invite")}
          onClick={onInvite}
        >
          <UserPlus />
        </Button>
        <Button
          size="icon"
          variant="outline"
          aria-label={t("groupCalls.messages")}
          onClick={onMessages}
        >
          <MessageSquare />
        </Button>
        <Button variant="destructive" onClick={onLeave}>
          <PhoneOff className="h-4 w-4 mr-2" />
          {t("groupCalls.leave")}
        </Button>
        {onEnd && (
          <Button variant="outline" onClick={() => setConfirmEnd(true)}>
            {t("groupCalls.endAll")}
          </Button>
        )}
      </footer>
    </section>
  );
}
