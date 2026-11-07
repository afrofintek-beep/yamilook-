import { tokenizePostText } from '../../../shared/post-text.mjs';

/** Render user text as text nodes; only validated web addresses become links. */
export function PostText({ text }: { text: string }) {
  return <>{tokenizePostText(text).map((part, index) => part.href ? (
    <a key={index} href={part.href} target="_blank" rel="noopener noreferrer ugc"
      className="text-primary underline underline-offset-2 break-words [overflow-wrap:anywhere] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      onClick={(event) => event.stopPropagation()}>{part.text}</a>
  ) : part.text)}</>;
}
