import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Recordings } from './Recordings';
const m=vi.hoisted(()=>({id:'owner',pending:vi.fn(),save:vi.fn(),download:vi.fn(),signed:vi.fn(),rows:vi.fn()}));
vi.mock('@/hooks/useAuth',()=>({useAuth:()=>({user:{id:m.id}})}));
vi.mock('./pending',()=>({pendingRecordings:m.pending,downloadRecording:m.download,RECORDINGS_CHANGED:'recordings-test'}));
vi.mock('./save',()=>({saveRecording:m.save}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{from:()=>({select:()=>({eq:()=>({eq:()=>({order:()=>({limit:m.rows})})})})}),storage:{from:()=>({createSignedUrl:m.signed})}}}));
afterEach(cleanup);
beforeEach(()=>{vi.clearAllMocks();m.id='owner';m.pending.mockResolvedValue([]);m.rows.mockResolvedValue({data:[],error:null});m.signed.mockResolvedValue({data:{signedUrl:'https://example.test/private?token=short'},error:null});});
it('lists saved recordings and obtains a short-lived private playback URL only on tap',async()=>{
 m.rows.mockResolvedValue({data:[{id:'rec',storage_path:'call/rec.webm',duration_seconds:15,created_at:'2026-11-05T19:40:00Z'}],error:null});render(<Recordings/>);
 await screen.findByRole('button',{name:'Reproduzir gravação'});expect(m.signed).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Reproduzir gravação'}));await waitFor(()=>expect(m.signed).toHaveBeenCalledWith('call/rec.webm',300));
 expect(document.querySelector('video')?.src).toContain('private?token=short');
});
it('shows retained media with retry and download after a failed save',async()=>{
 const file={id:'rec',callId:'call',ownerId:'owner',blob:new Blob(['sound']),createdAt:1,duration:2};m.pending.mockResolvedValue([file]);m.save.mockRejectedValue(new Error('Não foi possível enviar.'));
 render(<Recordings/>);fireEvent.click(await screen.findByRole('button',{name:'Tentar guardar novamente'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível enviar.');
 fireEvent.click(screen.getByRole('button',{name:'Descarregar gravação'}));expect(m.download).toHaveBeenCalledWith(file);
});
it('does not retain a previous account playback URL after account change',async()=>{
 m.rows.mockResolvedValue({data:[{id:'rec',storage_path:'call/rec.webm',duration_seconds:2,created_at:'2026-11-05T19:40:00Z'}],error:null});
 const view=render(<Recordings/>);fireEvent.click(await screen.findByRole('button',{name:'Reproduzir gravação'}));await waitFor(()=>expect(document.querySelector('video')).not.toBeNull());
 m.id='different';m.rows.mockResolvedValue({data:[],error:null});view.rerender(<Recordings/>);
 await waitFor(()=>expect(document.querySelector('video')).toBeNull());expect(m.pending).toHaveBeenCalledWith('different');
});
