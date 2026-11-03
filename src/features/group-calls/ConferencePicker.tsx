import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchPublicProfilesBatched } from "@/lib/public-profile-batch";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  MAX_CONFERENCE_PARTICIPANTS,
  groupCallError,
  type Conference,
} from "./api";
export interface PickerRequest {
  conversationId: string;
  name: string;
  type: "voice" | "video";
  conferenceId?: string;
}
export function ConferencePicker({
  request,
  userId,
  onClose,
  onConfirm,
  onJoin,
}: {
  request: PickerRequest;
  userId: string;
  onClose: () => void;
  onConfirm: (ids: string[]) => Promise<void>;
  onJoin: (c: Conference) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { data, isLoading, isError } = useQuery({
    queryKey: [
      "conference-picker",
      request.conversationId,
      request.conferenceId,
      userId,
    ],
    queryFn: async () => {
      const { conferenceAction } = await import("./api");
      const existing = !request.conferenceId
        ? await conferenceAction<Conference | null>(
            "current",
            request.conversationId,
          )
        : null;
      if (existing) return { profiles: [], slots: 0, existing };
      const { data: members, error } = await supabase
        .from("conversation_participants")
        .select("user_id")
        .eq("conversation_id", request.conversationId);
      if (error) throw error;
      const { data: profiles, error: profileError } =
        await fetchPublicProfilesBatched((members || []).map((m) => m.user_id));
      if (profileError) throw profileError;
      const conference = request.conferenceId
        ? await conferenceAction("detail", request.conferenceId)
        : null;
      const occupied = (conference?.members || [])
        .filter((m) => ["invited", "joined"].includes(m.status))
        .map((m) => m.user_id);
      return {
        existing: null as Conference | null,
        profiles: (profiles || []).filter(
          (p) => p.id !== userId && !occupied.includes(p.id),
        ),
        slots: Math.max(
          0,
          MAX_CONFERENCE_PARTICIPANTS - (conference ? occupied.length : 1),
        ),
      };
    },
  });
  useEffect(() => {
    if (data && data.profiles.length <= data.slots)
      setSelected(data.profiles.map((p) => p.id));
  }, [data]);
  const visible = useMemo(
    () =>
      data?.profiles.filter(
        (p) =>
          p.display_name
            ?.toLocaleLowerCase()
            .includes(search.toLocaleLowerCase()) ||
          p.username?.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
      ) || [],
    [data, search],
  );
  const toggle = (id: string) =>
    setSelected((ids) =>
      ids.includes(id)
        ? ids.filter((x) => x !== id)
        : ids.length < (data?.slots || 0)
          ? [...ids, id]
          : ids,
    );
  if (data?.existing)
    return (
      <ResponsiveModal
        open
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        overlayClassName="z-[170]"
        srTitle={t("groupCalls.title")}
        className="z-[180] space-y-4"
      >
        <h2 className="font-semibold">{request.name}</h2>
        <p>{t("groupCalls.alreadyActive")}</p>
        {data.existing.invitation_status ? (
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onJoin(data.existing!);
                onClose();
              } catch (e) {
                setError(groupCallError(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            {t("groupCalls.retry")}
          </Button>
        ) : (
          <p>{t("groupCalls.errors.not_invited")}</p>
        )}
        {error && <p role="alert">{error}</p>}
      </ResponsiveModal>
    );
  return (
    <ResponsiveModal
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
      overlayClassName="z-[170]"
      srTitle={t("groupCalls.selectTitle")}
      className="z-[180] max-h-[85dvh] flex flex-col gap-4"
    >
      <div>
        <h2 className="text-lg font-semibold">{request.name}</h2>
        <p className="text-sm text-muted-foreground">
          {t("groupCalls.selectHint", { count: MAX_CONFERENCE_PARTICIPANTS })}
        </p>
      </div>
      <Input
        aria-label={t("common.search")}
        placeholder={t("common.search")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="min-h-0 overflow-y-auto space-y-1">
        {isLoading && <p role="status">{t("groupCalls.loading")}</p>}
        {isError && <p role="alert">{t("groupCalls.errors.unavailable")}</p>}
        {!isLoading && !isError && visible.length === 0 && (
          <p>{t("groupCalls.noMembers")}</p>
        )}
        {visible.map((p) => (
          <label
            key={p.id}
            className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted cursor-pointer"
          >
            <Avatar>
              <AvatarImage src={p.avatar_url || undefined} />
              <AvatarFallback>{p.display_name?.slice(0, 2)}</AvatarFallback>
            </Avatar>
            <span className="flex-1 min-w-0 truncate">{p.display_name}</span>
            <input
              type="checkbox"
              checked={selected.includes(p.id)}
              disabled={
                busy ||
                (!selected.includes(p.id) &&
                  selected.length >= (data?.slots || 0))
              }
              onChange={() => toggle(p.id)}
            />
          </label>
        ))}
      </div>
      <p className="text-sm">
        {t("groupCalls.selected", {
          count: selected.length,
          max: data?.slots || 0,
        })}
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button
        disabled={busy || !selected.length}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            await onConfirm(selected);
            onClose();
          } catch (e) {
            setError(groupCallError(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy
          ? t("groupCalls.connecting")
          : request.conferenceId
            ? t("groupCalls.invite")
            : t("groupCalls.start")}
      </Button>
    </ResponsiveModal>
  );
}
