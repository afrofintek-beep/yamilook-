import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MediaCarousel } from './MediaCarousel';

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} });
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
});
afterEach(() => {
  cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs();
});

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

  it('offers proportional responsive variants for eligible public images', () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://project.supabase.co');
    const src = 'https://project.supabase.co/storage/v1/object/public/media/photo.jpg';
    const { container } = render(<MediaCarousel urls={[src]} />);
    const img = container.querySelector('img')!;
    expect(img.getAttribute('src')).toContain('width=960&height=1920&resize=contain');
    expect(img.getAttribute('srcset')).toContain('480w');
    expect(img.getAttribute('srcset')).toContain('1280w');
    expect(img).toHaveAttribute('sizes', '(max-width: 680px) 100vw, 680px');
  });

  it('falls back to the original when the transform fails', () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://project.supabase.co');
    const src = 'https://project.supabase.co/storage/v1/object/public/media/photo.jpg';
    const { container } = render(<MediaCarousel urls={[src]} />);
    const img = container.querySelector('img')!;
    fireEvent.error(img);
    expect(img.getAttribute('src')).toBe(src);
    expect(img).not.toHaveAttribute('srcset');
  });

  it('falls back when Safari reports an invalid transformed geometry', () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://project.supabase.co');
    const src = 'https://project.supabase.co/storage/v1/object/public/media/photo.jpg';
    const { container } = render(<MediaCarousel urls={[src]} />);
    const img = container.querySelector('img')!;
    Object.defineProperty(img, 'naturalWidth', { configurable: true, value: 960 });
    Object.defineProperty(img, 'naturalHeight', { configurable: true, value: 3088 });
    fireEvent.load(img);
    expect(img.getAttribute('src')).toBe(src);
  });

  it('leaves signed, private and external sources unchanged', () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://project.supabase.co');
    const src = 'https://project.supabase.co/storage/v1/object/sign/media/private.jpg?token=abc';
    const { container } = render(<MediaCarousel urls={[src]} />);
    const img = container.querySelector('img')!;
    expect(img.getAttribute('src')).toBe(src);
    expect(img).not.toHaveAttribute('srcset');
  });

  it('does not download offscreen videos or request a video URL as an image poster', () => {
    const { container } = render(<MediaCarousel urls={['video.mp4?token=test']} />);
    expect(container.querySelector('video')).toHaveAttribute('preload', 'none');
    expect(container.querySelector('video')).not.toHaveAttribute('poster');
    expect(container.querySelector('video')).not.toHaveAttribute('src');
  });
});
