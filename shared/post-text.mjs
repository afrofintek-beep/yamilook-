// One tokenizer for the feed, SPA and server-rendered public posts. No HTML input.
export function tokenizePostText(text) {
  const parts = [];
  const pattern = /(^|[\s([{"'“‘])((?:https?:\/\/[^\s<>"'\u0000-\u001f\u007f]+)|(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63})(?::\d{1,5})?(?:[/?#][^\s<>"'\u0000-\u001f\u007f]*)?)/gi;
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index + match[1].length;
    let label = match[2];
    const pairs = { ')': '(', ']': '[', '}': '{' };
    const counts = {};
    for (const character of label) counts[character] = (counts[character] || 0) + 1;
    while (label) {
      const last = label.at(-1);
      if (/[.,;:!?…“”‘’]/u.test(last) || (pairs[last] && (counts[last] || 0) > (counts[pairs[last]] || 0))) {
        counts[last]--;
        label = label.slice(0, -1);
      } else break;
    }
    // Do not link just a prefix of an email or a malformed domain.
    const following = text[start + label.length];
    if (!label || (following && /[\p{L}\p{N}_@-]/u.test(following))) continue;
    let url;
    try { url = new URL(/^https?:\/\//i.test(label) ? label : `https://${label}`); } catch { continue; }
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) continue;
    if (start > cursor) parts.push({ text: text.slice(cursor, start) });
    parts.push({ text: label, href: url.href });
    cursor = start + label.length;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor) });
  return parts;
}
