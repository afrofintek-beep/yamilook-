import { Link } from 'react-router-dom';
export function MentionText({ text, onNavigate }: { text: string; onNavigate?: () => void }) {
  const parts = text.split(/((?:^|[\s(])@(?:negocio\/[a-z0-9_]{3,30}\b|[\p{L}\p{N}_][\p{L}\p{N}_.-]*))/u);
  return <>{parts.map((part, i) => {
    const business = /^([\s(]?)@negocio\/([a-z0-9_]{3,30})$/.exec(part);
    if (business) return <span key={i}>{business[1]}<Link className="text-primary font-medium hover:underline" to={`/negocio/${business[2]}`} onClick={onNavigate}>@negocio/{business[2]}</Link></span>;
    const match = /^([\s(]?)@([\p{L}\p{N}_][\p{L}\p{N}_.-]*)$/u.exec(part);
    if (!match) return part;
    const username = match[2].replace(/[.-]+$/, '');
    return <span key={i}>{match[1]}<Link className="text-primary font-medium hover:underline" to={`/u/${encodeURIComponent(username)}`} onClick={onNavigate}>@{username}</Link>{match[2].slice(username.length)}</span>;
  })}</>;
}
