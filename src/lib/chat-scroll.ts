/** Scroll only the message list: scrollIntoView can also move the page on iOS. */
export function scrollChatToEnd(viewport: HTMLElement | null, behavior: ScrollBehavior) {
  viewport?.scrollTo({ top: viewport.scrollHeight, behavior });
}

export function scrollChatToMessage(viewport: HTMLElement | null, message: HTMLElement | null) {
  if (!viewport || !message) return;
  const top = viewport.scrollTop + message.getBoundingClientRect().top
    - viewport.getBoundingClientRect().top - (viewport.clientHeight - message.offsetHeight) / 2;
  viewport.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
}
