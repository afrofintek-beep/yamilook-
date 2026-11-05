export function mentionedHandles(text: string) {
  return [...text.matchAll(/(?:^|[\s(])@([\p{L}\p{N}_][\p{L}\p{N}_.-]*)/gu)]
    .map(match => match[1].replace(/[.-]+$/, '').toLowerCase());
}

export function activeMention(value: string, cursor: number) {
  const match = /(?:^|[\s(])@([\p{L}\p{N}_.-]*)$/u.exec(value.slice(0, cursor));
  return match ? { query: match[1], start: cursor - match[1].length - 1 } : null;
}
export function insertMention(value: string, cursor: number, username: string) {
  const mention = activeMention(value, cursor);
  if (!mention) return { value, cursor };
  const suffix = value.slice(cursor).replace(/^[\p{L}\p{N}_.-]*/u, '');
  const prefix = value.slice(0, mention.start) + '@' + username + ' ';
  return { value: prefix + suffix, cursor: prefix.length };
}
