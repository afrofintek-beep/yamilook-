import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
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
  profile,
}: {
  profile?: { display_name: string | null; avatar_url: string | null };
  participant: Participant;
  room: Room;
  pinned: boolean;
  onPin: () => void;
}) {
  const { t } = useTranslation();
  const name = profile?.display_name?.trim() || participant.name || t("groupCalls.participant");
  const words = name.trim().split(/\s+/u);
  const initials = [words[0], ...(words.length > 1 ? [words[words.length - 1]] : [])].map(word => Array.from(word)[0]).join('').toLocaleUpperCase();
  const camera = participant.getTrackPublication(Track.Source.Camera);
  return (
    <button
      onClick={onPin}
      aria-pressed={pinned}
      aria-label={name}
      className={`relative shrink-0 aspect-square rounded-2xl bg-muted overflow-hidden border-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${pinned ? "w-full max-w-lg" : "w-[calc(50%-0.375rem)] sm:w-[calc(33.333%-0.5rem)]"} ${participant.isSpeaking ? "border-primary" : "border-transparent"}`}
    >
      {camera?.track && !camera.isMuted ? (
        <VideoTrack
          track={camera.track}
          muted
          className="h-full w-full object-contain"
        />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center pb-12">
          <Avatar className="h-20 w-20 sm:h-24 sm:w-24 border border-primary/20">
            <AvatarImage src={profile?.avatar_url || undefined} alt={name} className="object-cover" />
            <AvatarFallback className="bg-primary/15 text-primary text-2xl font-semibold">{initials}</AvatarFallback>
          </Avatar>
        </span>
      )}
      <span className="absolute bottom-0 inset-x-0 bg-black/65 text-white text-xs p-2 flex gap-2 items-center">
        <span title={name} className="flex-1 min-w-0 break-words line-clamp-2 text-left leading-snug">
          {name}
          {participant === room.localParticipant
            ? ` (${t("groupCalls.you")})`
            : ""}
        </span>
        {!participant.isMicrophoneEnabled && <MicOff className="w-4 h-4 shrink-0" />}
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
  const ids = [...new Set(media.participants.map(p => p.identity.split(':')[0]))].sort();
  const { data: profiles = [] } = useQuery({
    queryKey: ['conference-profiles', ids],
    enabled: ids.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('public_profiles').select('id, display_name, avatar_url').in('id', ids);
      if (error) throw error;
      return data || [];
    },
  });
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const elapsed = Math.max(0, Math.floor((now - Date.parse(conference.created_at)) / 1000)) || 0;
  const duration = `${Math.floor(elapsed / 60).toString().padStart(2, '0')}:${(elapsed % 60).toString().padStart(2, '0')}`;
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
            · {t('groupCalls.participantCount', { count: media.participants.length })}
          </p>
          <p className="text-xs text-muted-foreground tabular-nums">
            {t('groupCalls.conferenceLabel')} · {duration}
          </p>
        </div>
      </header>
      <div className="flex-1 min-h-0 overflow-y-auto p-3 flex flex-col gap-3">
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
            <div className="flex-1 w-full max-w-4xl mx-auto flex flex-wrap content-center items-center justify-center gap-3 py-3">
              {media.participants.map((p) => (
                <Tile
                  key={p.identity}
                  participant={p}
                  profile={profiles.find(profile => profile.id === p.identity.split(':')[0])}
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
      </div>
      <footer className="shrink-0 border-t p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] flex flex-wrap gap-2 justify-center">
        <Button
          className="h-auto min-h-14 min-w-16 flex-col gap-1 px-3 py-2"
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
          <span className="text-[11px]">{t('groupCalls.microphone')}</span>
        </Button>
        {conference.call_type === "video" && (
          <Button
            className="h-auto min-h-14 min-w-16 flex-col gap-1 px-3 py-2"
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
            <span className="text-[11px]">{t('groupCalls.camera')}</span>
          </Button>
        )}
        <Button
          className="h-auto min-h-14 min-w-16 flex-col gap-1 px-3 py-2"
          variant="outline"
          disabled={!media.room}
          aria-label={t("groupCalls.invite")}
          onClick={onInvite}
        >
          <UserPlus />
          <span className="text-[11px]">{t('groupCalls.addParticipant')}</span>
        </Button>
        <Button
          className="h-auto min-h-14 min-w-16 flex-col gap-1 px-3 py-2"
          variant="outline"
          aria-label={t("groupCalls.messages")}
          onClick={onMessages}
        >
          <MessageSquare />
          <span className="text-[11px]">{t('groupCalls.messages')}</span>
        </Button>
        <Button className="h-auto min-h-14 flex-col gap-1 px-4 py-2" variant="destructive" onClick={onLeave}>
          <PhoneOff className="h-5 w-5" />
          {t("groupCalls.leave")}
        </Button>
        {onEnd && (
          <div className="w-full border-t pt-2 mt-1 text-center">
            <Button variant="ghost" className="text-destructive" onClick={() => setConfirmEnd(true)}>
              {t("groupCalls.endAll")}
            </Button>
          </div>
        )}
      </footer>
      <AlertDialog.Root open={confirmEnd} onOpenChange={setConfirmEnd}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-[180] bg-black/70" />
          <AlertDialog.Content className="fixed z-[181] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-sm rounded-2xl border bg-background p-5 shadow-xl space-y-4">
            <AlertDialog.Title className="font-semibold">{t('groupCalls.endAll')}</AlertDialog.Title>
            <AlertDialog.Description className="text-sm text-muted-foreground">{t('groupCalls.confirmEnd')}</AlertDialog.Description>
            <div className="flex flex-wrap justify-end gap-2">
              <AlertDialog.Cancel asChild><Button variant="outline">{t('common.cancel')}</Button></AlertDialog.Cancel>
              <AlertDialog.Action asChild><Button variant="destructive" onClick={onEnd}>{t('groupCalls.endAll')}</Button></AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </section>
  );
}
