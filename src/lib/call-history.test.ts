import { describe, expect, it } from 'vitest';
import { attachCallParticipants } from './call-history';

describe('batched call history assembly', () => {
  const calls = [
    { id: 'one', caller_id: 'me', callee_id: 'other' },
    { id: 'two', caller_id: 'remote', callee_id: 'me' },
    { id: 'old', caller_id: 'me', callee_id: 'missing' },
  ];
  it('preserves order, multiple participants and names after one batched fetch', () => {
    const result = attachCallParticipants(calls, [
      { call_id: 'one', user_id: 'other' },
      { call_id: 'one', user_id: 'guest' },
    ], [
      { id: 'other', display_name: 'Other', avatar_url: 'a.jpg' },
      { id: 'guest', display_name: 'Guest', avatar_url: null },
      { id: 'remote', display_name: 'Remote', avatar_url: null },
    ], 'me');
    expect(result.map(r => r.id)).toEqual(['one', 'two', 'old']);
    expect(result[0].participants.map(p => p.display_name)).toEqual(['Other', 'Guest']);
    expect(result[1].participants[0].display_name).toBe('Remote');
    expect(result[2].participants).toEqual([]);
  });
  it('never adds an unknown caller from another call as a participant', () => {
    const result = attachCallParticipants(
      [{ id: 'a', caller_id: 'me', callee_id: null }],
      [{ call_id: 'b', user_id: 'unrelated' }],
      [{ id: 'unrelated', display_name: 'Unrelated', avatar_url: null }],
      'me',
    );
    expect(result[0].participants).toEqual([]);
  });
});
