/** Assemble call history after batched, RLS-protected database reads. */
export function attachCallParticipants<T extends { id: string; caller_id: string | null; callee_id: string | null }>(
  calls: T[],
  participants: { call_id: string; user_id: string }[],
  profiles: { id: string; display_name: string | null; avatar_url: string | null }[],
  currentUserId: string,
): Array<T & { participants: { user_id: string; display_name: string; avatar_url: string | null }[] }> {
  const members = new Map<string, string[]>();
  for (const participant of participants) {
    const existing = members.get(participant.call_id) ?? [];
    existing.push(participant.user_id);
    members.set(participant.call_id, existing);
  }
  const profileById = new Map(profiles.map(profile => [profile.id, profile]));
  return calls.map(call => {
    const knownParticipants = members.get(call.id) ?? [];
    const fallback = call.caller_id === currentUserId ? call.callee_id : call.caller_id;
    // Previously, missing participant rows fell back to caller/callee only when
    // that profile existed. Preserve that behavior for older call records.
    const ids = knownParticipants.length
      ? knownParticipants
      : (fallback && profileById.has(fallback) ? [fallback] : []);
    return {
      ...call,
      participants: ids.map(id => ({
        user_id: id,
        display_name: profileById.get(id)?.display_name || 'Unknown',
        avatar_url: profileById.get(id)?.avatar_url ?? null,
      })),
    };
  });
}
