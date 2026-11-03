import {
  createContext,
  lazy,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AudioTrack } from "@/components/live/AudioTrack";
import { useRingtone } from "@/hooks/useRingtone";
import { toast } from "@/hooks/use-toast";
import { conferenceAction, groupCallError, type Conference } from "./api";
import { useConferenceMedia } from "./useConferenceMedia";
import type { PickerRequest } from "./ConferencePicker";
const ConferencePicker = lazy(() =>
  import("./ConferencePicker").then((m) => ({ default: m.ConferencePicker })),
);
const ConferenceRoom = lazy(() => import("./ConferenceRoom"));
const Context = createContext<{
  open: (request: PickerRequest) => void;
} | null>(null);
export const useGroupConference = () => useContext(Context);
function ConferenceRingtone() {
  const { startRingtone, stopRingtone } = useRingtone();
  useEffect(() => {
    startRingtone();
    const timer = setTimeout(stopRingtone, 60_000);
    return () => {
      clearTimeout(timer);
      stopRingtone();
    };
  }, [startRingtone, stopRingtone]);
  return null;
}
export function GroupConferenceProvider({
  children,
  directBusy,
}: {
  children: ReactNode;
  directBusy: boolean;
}) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [picker, setPicker] = useState<PickerRequest | null>(null);
  const [active, setActive] = useState<Conference | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [replying, setReplying] = useState(false);
  const media = useConferenceMedia(user?.id);
  const key = ["group-conference-invites", user?.id];
  const refresh = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["group-conference-invites"] });
  }, [qc]);
  const { data: invitations = [] } = useQuery({
    queryKey: key,
    enabled: !!user,
    queryFn: () => conferenceAction<Conference[]>("list"),
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
    retry: false,
  });
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`group-conference-invites-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "group_conference_members",
          filter: `user_id=eq.${user.id}`,
        },
        refresh,
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [user?.id, refresh]);
  const incoming = invitations.find(
    (c) => c.id !== active?.id && c.invitation_status === "invited",
  );
  useEffect(() => {
    setActive(null);
    setPicker(null);
  }, [user?.id]);
  const enter = async (c: Conference) => {
    if (directBusy || active) throw new Error("caller_busy");
    setActive(c);
    setMinimized(false);
    await media.join(c.id, c.call_type);
    refresh();
  };
  const leave = async (end = false) => {
    if (await media.leave(end)) {
      setActive(null);
      setMinimized(false);
      refresh();
    }
  };
  return (
    <Context.Provider
      value={{
        open: (request) => {
          if (directBusy || active) {
            toast({ title: t("groupCalls.errors.caller_busy") });
            return;
          }
          setPicker(request);
        },
      }}
    >
      {children}
      {incoming && !active && !directBusy && (
        <ConferenceRingtone key={incoming.id} />
      )}
      {/* Audio stays mounted when the room is minimized or the route changes. */}
      {media.participants
        .filter((p) => p !== media.room?.localParticipant)
        .flatMap((p) =>
          [...p.trackPublications.values()]
            .filter((pub) => pub.kind === "audio" && pub.track && !pub.isMuted)
            .map((pub) => (
              <AudioTrack
                key={`${p.identity}:${pub.trackSid}`}
                track={pub.track!}
              />
            )),
        )}
      {incoming && !active && (
        <aside
          role="dialog"
          aria-label={t("groupCalls.incoming")}
          className="fixed z-[155] bottom-24 left-3 right-3 mx-auto max-w-md rounded-2xl border bg-background p-4 shadow-xl space-y-3"
        >
          <p className="font-semibold">{incoming.name}</p>
          <p>
            {t(
              incoming.call_type === "video"
                ? "groupCalls.incomingVideo"
                : "groupCalls.incomingVoice",
            )}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={replying}
              onClick={async () => {
                setReplying(true);
                try {
                  await conferenceAction("decline", incoming.id);
                  refresh();
                } catch (e) {
                  toast({ title: groupCallError(e) });
                } finally {
                  setReplying(false);
                }
              }}
            >
              {t("groupCalls.decline")}
            </Button>
            <Button
              disabled={directBusy || replying}
              onClick={async () => {
                setReplying(true);
                try {
                  await enter(incoming);
                } catch (e) {
                  toast({ title: groupCallError(e) });
                } finally {
                  setReplying(false);
                }
              }}
            >
              {t("groupCalls.accept")}
            </Button>
          </div>
        </aside>
      )}
      {active && minimized && (
        <Button
          className="fixed z-[150] top-[env(safe-area-inset-top,0px)] inset-x-3 mx-auto max-w-md"
          onClick={() => setMinimized(false)}
        >
          {t("groupCalls.return")} · {active.name}
        </Button>
      )}
      <Suspense
        fallback={
          <div
            role="status"
            className="fixed z-[170] bottom-24 inset-x-4 rounded-xl bg-background p-4 border"
          >
            {t("groupCalls.loading")}
          </div>
        }
      >
        {picker && user && (
          <ConferencePicker
            key={`${picker.conversationId}:${picker.conferenceId || "new"}`}
            request={picker}
            userId={user.id}
            onClose={() => setPicker(null)}
            onJoin={async (c) => {
              setPicker(null);
              await enter(c);
            }}
            onConfirm={async (ids) => {
              if (picker.conferenceId) {
                await conferenceAction("invite", picker.conferenceId, {
                  user_ids: ids,
                });
                refresh();
              } else {
                const c = await conferenceAction(
                  "create",
                  picker.conversationId,
                  { call_type: picker.type, user_ids: ids },
                );
                setPicker(null);
                await enter({ ...c, name: picker.name });
              }
            }}
          />
        )}
        {active && !minimized && (
          <ConferenceRoom
            conference={active}
            media={media}
            onLeave={() => void leave()}
            onEnd={
              active.created_by === user?.id
                ? () => void leave(true)
                : undefined
            }
            onInvite={() =>
              setPicker({
                conversationId: active.conversation_id,
                name: active.name,
                type: active.call_type,
                conferenceId: active.id,
              })
            }
            onMinimize={() => setMinimized(true)}
            onMessages={() => {
              setMinimized(true);
              navigate(`/chat/${active.conversation_id}`);
            }}
            onRetry={() =>
              void media
                .join(active.id, active.call_type)
                .catch((e) => toast({ title: groupCallError(e) }))
            }
          />
        )}
      </Suspense>
    </Context.Provider>
  );
}
