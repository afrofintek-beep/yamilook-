import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useConferenceMedia } from "./useConferenceMedia";
import { hasActiveCall, holdCallUpdates } from "@/lib/call-update-guard";
const m = vi.hoisted(() => ({
  media: vi.fn(),
  action: vi.fn(),
  connect: vi.fn(),
  microphone: vi.fn(),
  camera: vi.fn(),
  stop: vi.fn(),
  rooms: [] as any[],
}));
vi.mock("./api", () => ({
  conferenceMedia: m.media,
  conferenceAction: m.action,
  groupCallError: (e: Error) => e.message,
}));
vi.mock("@/lib/audio-context", () => ({ unlockCallAudio: vi.fn() }));
vi.mock("livekit-client", () => ({
  RoomEvent: Object.fromEntries(
    [
      "ParticipantConnected",
      "ParticipantDisconnected",
      "TrackSubscribed",
      "TrackUnsubscribed",
      "TrackMuted",
      "TrackUnmuted",
      "LocalTrackPublished",
      "LocalTrackUnpublished",
      "ActiveSpeakersChanged",
      "ConnectionStateChanged",
      "AudioPlaybackStatusChanged",
      "Disconnected",
    ].map((x) => [x, x]),
  ),
  Room: class {
    remoteParticipants = new Map();
    canPlaybackAudio = true;
    listeners = new Map();
    localParticipant = {
      identity: "me",
      trackPublications: new Map([["mic", { track: { stop: m.stop } }]]),
      isMicrophoneEnabled: true,
      isCameraEnabled: false,
      setMicrophoneEnabled: m.microphone,
      setCameraEnabled: m.camera,
    };
    constructor() {
      m.rooms.push(this);
    }
    on(e: string, fn: any) {
      this.listeners.set(e, fn);
      return this;
    }
    removeAllListeners() {
      this.listeners.clear();
    }
    connect = m.connect;
    disconnect = vi.fn().mockResolvedValue(undefined);
    startAudio = vi.fn().mockResolvedValue(undefined);
  },
}));
beforeEach(() => {
  vi.clearAllMocks();
  m.rooms.length = 0;
  m.media.mockResolvedValue({
    token: "synthetic",
    url: "wss://synthetic.invalid",
  });
  m.action.mockResolvedValue({ allowed: true });
  m.connect.mockResolvedValue(undefined);
  m.microphone.mockResolvedValue(undefined);
  m.camera.mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
it("verifies admission before capturing microphone and exposes all participants", async () => {
  const { result } = renderHook(() => useConferenceMedia("user"));
  await act(async () => {
    expect(await result.current.join("conference", "voice")).toBe(true);
  });
  expect(m.media.mock.invocationCallOrder[0]).toBeLessThan(
    m.microphone.mock.invocationCallOrder[0],
  );
  const r = m.rooms[0];
  r.remoteParticipants.set("b", { identity: "b" });
  r.remoteParticipants.set("c", { identity: "c" });
  act(() => r.listeners.get("ParticipantConnected")());
  expect(result.current.participants).toHaveLength(3);
  expect(hasActiveCall()).toBe(true);
  await act(async () => {
    await result.current.leave();
  });
  expect(m.stop).toHaveBeenCalled();
  expect(hasActiveCall()).toBe(false);
});
it("does not capture media after admission fails", async () => {
  m.media.mockRejectedValueOnce(new Error("not_invited"));
  const { result } = renderHook(() => useConferenceMedia("user"));
  await act(async () => {
    expect(await result.current.join("conference", "voice")).toBe(false);
  });
  expect(m.microphone).not.toHaveBeenCalled();
  expect(result.current.error).toBe("not_invited");
  expect(hasActiveCall()).toBe(false);
});
it("rejects a conference while another call owns media", async () => {
  const release = holdCallUpdates();
  const { result } = renderHook(() => useConferenceMedia("user"));
  try {
    await expect(result.current.join("conference", "voice")).rejects.toThrow(
      "caller_busy",
    );
    expect(m.media).not.toHaveBeenCalled();
  } finally {
    release();
  }
});
it("cancels during admission and releases a late reservation without opening media", async () => {
  let resolve!: (v: unknown) => void;
  m.media.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const { result } = renderHook(() => useConferenceMedia("user"));
  let pending!: Promise<boolean>;
  act(() => {
    pending = result.current.join("conference", "voice");
  });
  await act(async () => {
    await result.current.leave();
    resolve({ token: "test", url: "test" });
    await pending;
  });
  expect(m.rooms).toHaveLength(0);
  expect(m.media.mock.calls.filter((c) => c[0] === "leave")).toHaveLength(2);
  expect(hasActiveCall()).toBe(false);
});
it("microphone refusal keeps the participant in listening mode", async () => {
  m.microphone.mockRejectedValueOnce(new Error("NotAllowedError"));
  const { result } = renderHook(() => useConferenceMedia("user"));
  await act(async () => {
    await result.current.join("conference", "voice");
  });
  expect(result.current.room).not.toBeNull();
  expect(result.current.error).toBe("microphone");
});
it("stops hardware immediately and retries the same remote closure after failure", async () => {
  const { result } = renderHook(() => useConferenceMedia("user"));
  await act(async () => {
    await result.current.join("conference", "video");
  });
  m.media.mockRejectedValueOnce(new Error("room_close_failed"));
  await act(async () => {
    expect(await result.current.leave(true)).toBe(false);
  });
  expect(m.stop).toHaveBeenCalled();
  expect(result.current.room).toBeNull();
  await act(async () => {
    expect(await result.current.leave(true)).toBe(true);
  });
  const end = m.media.mock.calls.filter((c) => c[0] === "end");
  expect(end).toHaveLength(2);
  expect(end[0]).toEqual(end[1]);
});
it("membership revocation on heartbeat disconnects media", async () => {
  vi.useFakeTimers();
  const { result } = renderHook(() => useConferenceMedia("user"));
  await act(async () => {
    await result.current.join("conference", "voice");
  });
  m.media.mockRejectedValueOnce(new Error("not_allowed"));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(20_000);
  });
  expect(m.stop).toHaveBeenCalled();
  expect(result.current.room).toBeNull();
});
it("a temporary heartbeat network failure permits reconnection before lease expiry", async () => {
  vi.useFakeTimers();
  const { result } = renderHook(() => useConferenceMedia("user"));
  await act(async () => {
    await result.current.join("conference", "voice");
  });
  m.media.mockRejectedValueOnce(new Error("network"));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(20_000);
  });
  expect(result.current.room).not.toBeNull();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(20_000);
  });
  expect(result.current.room).not.toBeNull();
});
