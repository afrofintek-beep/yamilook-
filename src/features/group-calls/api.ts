import { supabase } from "@/integrations/supabase/client";
import i18n from "@/i18n";
import type { Json } from "@/integrations/supabase/types";
export const MAX_CONFERENCE_PARTICIPANTS = 8;
export interface Conference {
  id: string;
  conversation_id: string;
  created_by: string;
  call_type: "voice" | "video";
  status: "active" | "ended";
  name: string;
  created_at: string;
  expires_at?: string;
  invitation_status?: "invited" | "joined" | "declined" | "left";
  members?: { user_id: string; display_name: string; status: string }[];
}
export function groupCallError(error: unknown) {
  const code = error instanceof Error ? error.message : String(error);
  return i18n.t(`groupCalls.errors.${code}`, {
    defaultValue: i18n.t("groupCalls.errors.unavailable"),
  });
}
export async function conferenceAction<T = Conference>(
  action: string,
  id?: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  const { data, error } = await supabase.rpc("group_conference_action", {
    p_action: action,
    p_id: id,
    p_payload: payload as Json,
  });
  if (error) throw new Error(error.message);
  return data as unknown as T;
}
export async function conferenceMedia(
  action: "join" | "leave" | "end" | "heartbeat",
  conferenceId: string,
  deviceId: string,
) {
  const { data, error } = await supabase.functions.invoke("group-conference", {
    body: { action, conferenceId, deviceId },
    timeout: 20_000,
  });
  if (error) {
    let reason = "unavailable";
    try {
      reason = (await error.context?.json())?.error || reason;
    } catch {
      /* unavailable response */
    }
    throw new Error(reason);
  }
  if (!data || data.error) throw new Error(data?.error || "unavailable");
  return data as {
    token: string;
    url: string;
    callType: "voice" | "video";
    isHost: boolean;
  };
}
