import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AvatarImage } from './avatar';
vi.mock('@/hooks/useCachedAvatar',()=>({useCachedAvatar:(src:string)=>({src,retry:0,loaded:vi.fn(),failed:vi.fn()})}));
vi.mock('@radix-ui/react-avatar',()=>({
 Root:()=>null,Fallback:()=>null,
 Image:({src,onLoadingStatusChange}:{src:string;onLoadingStatusChange:(status:string)=>void})=><button data-src={src} onClick={()=>onLoadingStatusChange('error')}>Image preload failed</button>,
}));
afterEach(()=>{cleanup();vi.unstubAllEnvs();});
it('falls back to the original when Radix preload fails before rendering an img',()=>{
 vi.stubEnv('VITE_SUPABASE_URL','https://project.supabase.co');
 const src='https://project.supabase.co/storage/v1/object/public/avatars/a.jpg';
 const status=vi.fn();
 render(<AvatarImage src={src} imageVariantSize={160} onLoadingStatusChange={status}/>);
 expect(screen.getByRole('button').getAttribute('data-src')).toContain('/render/image/');
 fireEvent.click(screen.getByRole('button'));
 expect(screen.getByRole('button')).toHaveAttribute('data-src',src);
 expect(status).toHaveBeenCalledWith('error');
});
