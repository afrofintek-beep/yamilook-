import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MediaCarousel } from './MediaCarousel';
beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} });
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe('feed media network priority', () => {
  it('defers images in posts below the first post', () => {
    const { container } = render(<MediaCarousel urls={['first.jpg', 'second.jpg']} />);
    for (const image of container.querySelectorAll('img')) expect(image).toHaveAttribute('loading', 'lazy');
  });
  it('gives only the first image high priority', () => {
    const { container } = render(<MediaCarousel priority urls={['first.jpg', 'second.jpg']} />);
    const images = container.querySelectorAll('img');
    expect(images[0]).toHaveAttribute('loading', 'eager');
    expect(images[0]).toHaveAttribute('fetchpriority', 'high');
    expect(images[1]).toHaveAttribute('loading', 'lazy');
  });
  it('does not download offscreen videos or request a video URL as an image poster', () => {
    const { container } = render(<MediaCarousel urls={['video.mp4?token=test']} />);
    expect(container.querySelector('video')).toHaveAttribute('preload', 'none');
    expect(container.querySelector('video')).not.toHaveAttribute('poster');
  });
});
