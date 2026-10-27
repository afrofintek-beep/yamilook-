/** Fail closed, including against a forged self-inserted participant row. */
export function canJoinCall(userId: string, call: {
  initiator_id: string; caller_id: string | null; callee_id: string | null; status: string;
} | null, member: { status: string } | null): boolean {
  return !!call && !!member &&
    [call.initiator_id, call.caller_id, call.callee_id].includes(userId) &&
    ['ringing', 'ongoing'].includes(call.status) &&
    ['ringing', 'connected'].includes(member.status);
}
