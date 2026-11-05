import { Link } from 'react-router-dom';
export function MentionText({ text, onNavigate }: { text: string; onNavigate?: () => void }) {
  const parts = text.split(/((?:^|[\s(])@[\p{L}\p{N}_][\p{L}\p{N}_.-]*)/u);
  return <>{parts.map((part, i) => {
    const match = /^([\s(]?)@([\p{L}\p{N}_][\p{L}\p{N}_.-]*)$/u.exec(part);
    if (!match) return part;
    const username = match[2].replace(/[.-]+$/, '');
    return <span key={i}>{match[1]}<Link className="text-primary font-medium hover:underline" to={`/u/${encodeURIComponent(username)}`} onClick={onNavigate}>@{username}</Link>{match[2].slice(username.length)}</span>;
  })}</>;
}
