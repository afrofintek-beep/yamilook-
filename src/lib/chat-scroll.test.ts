import { describe, expect, it, vi } from 'vitest';
import { scrollChatToEnd, scrollChatToMessage } from './chat-scroll';
describe('chat scrolling stays inside the message list', () => {
  it('scrolls the list to the latest message without scrolling ancestors', () => {
    const viewport = document.createElement('div');
    Object.defineProperty(viewport, 'scrollHeight', { value: 2000 });
    viewport.scrollTo = vi.fn();
    scrollChatToEnd(viewport, 'auto');
    expect(viewport.scrollTo).toHaveBeenCalledWith({ top: 2000, behavior: 'auto' });
  });
  it('centres search results inside the message list', () => {
    const viewport = document.createElement('div');
    const message = document.createElement('div');
    viewport.scrollTop = 100;
    Object.defineProperty(viewport, 'clientHeight', { value: 500 });
    Object.defineProperty(message, 'offsetHeight', { value: 100 });
    viewport.getBoundingClientRect = () => ({ top: 80 }) as DOMRect;
    message.getBoundingClientRect = () => ({ top: 480 }) as DOMRect;
    viewport.scrollTo = vi.fn();
    scrollChatToMessage(viewport, message);
    expect(viewport.scrollTo).toHaveBeenCalledWith({ top: 300, behavior: 'smooth' });
  });
  it('handles an unmounted conversation', () => {
    expect(() => { scrollChatToEnd(null, 'smooth'); scrollChatToMessage(null, null); }).not.toThrow();
  });
});
