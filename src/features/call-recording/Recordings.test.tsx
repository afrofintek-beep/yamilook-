import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Recordings } from './Recordings';
const m=vi.hoisted(()=>({id:'owner',pending:vi.fn(),save:vi.fn(),download:vi.fn(),signed:vi.fn(),rows:vi.fn(),fetchFile:vi.fn(),export:vi.fn()}));
vi.mock('@/hooks/useAuth',()=>({useAuth:()=>({user:{id:m.id}})}));
vi.mock('./pending',()=>({pendingRecordings:m.pending,downloadRecording:m.download,RECORDINGS_CHANGED:'recordings-test'}));
vi.mock('./export',async()=>({...await vi.importActual('./export'),downloadFile:m.export}));
vi.mock('./mp4',()=>({prepareMp4:vi.fn(async file=>file)}));
vi.mock('./save',()=>({saveRecording:m.save}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{from:()=>({select:()=>({eq:()=>({eq:()=>({order:()=>({limit:m.rows})})})})}),storage:{from:()=>({createSignedUrl:m.signed,download:m.fetchFile})}}}));
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
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

const savedRow={id:'rec',storage_path:'call/rec.mp4',duration_seconds:28,created_at:'2026-11-05T22:38:00Z'};
it('fetches private media on request then downloads the actual file on a fresh tap',async()=>{
 m.rows.mockResolvedValue({data:[savedRow],error:null});
 m.fetchFile.mockResolvedValue({data:new Blob(['audio bytes'],{type:'audio/mp4'}),error:null});
 render(<Recordings/>);const button=await screen.findByRole('button',{name:'Descarregar gravação'});
 expect(m.fetchFile).not.toHaveBeenCalled();fireEvent.click(button);
 fireEvent.click(await screen.findByRole('button',{name:'Guardar ficheiro'}));
 expect(m.fetchFile).toHaveBeenCalledWith('call/rec.mp4');
 const file=m.export.mock.calls[0][0];expect(file.name).toMatch(/^Kosolola_.*\.mp4$/);expect(file.type).toBe('audio/mp4');expect(file.size).toBe(11);
});
it('shares the file rather than an expiring private URL and ignores user cancellation',async()=>{
 const share=vi.fn().mockRejectedValue(new DOMException('Cancelled','AbortError'));
 vi.stubGlobal('navigator',{canShare:()=>true,share});
 m.rows.mockResolvedValue({data:[savedRow],error:null});m.fetchFile.mockResolvedValue({data:new Blob(['audio'],{type:'audio/mp4'}),error:null});
 render(<Recordings/>);fireEvent.click(await screen.findByRole('button',{name:'Descarregar gravação'}));
 const button=await screen.findByRole('button',{name:'Partilhar / Guardar em Ficheiros'});
 expect(share).not.toHaveBeenCalled();fireEvent.click(button);
 await waitFor(()=>expect(share).toHaveBeenCalledOnce());expect(share.mock.calls[0][0].files[0]).toBeInstanceOf(File);
 expect(screen.queryByRole('alert')).toBeNull();
});
it('reports download failure without offering an empty file',async()=>{
 m.rows.mockResolvedValue({data:[savedRow],error:null});m.fetchFile.mockResolvedValue({data:null,error:new Error('denied')});
 render(<Recordings/>);fireEvent.click(await screen.findByRole('button',{name:'Descarregar gravação'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível preparar');expect(screen.queryByRole('button',{name:'Guardar ficheiro'})).toBeNull();
});
it('discards a downloaded file when the account changes during the request',async()=>{
 let finish; m.fetchFile.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));m.rows.mockResolvedValue({data:[savedRow],error:null});
 const view=render(<Recordings/>);fireEvent.click(await screen.findByRole('button',{name:'Descarregar gravação'}));
 m.id='different';m.rows.mockResolvedValue({data:[],error:null});view.rerender(<Recordings/>);
 finish({data:new Blob(['private']),error:null});await waitFor(()=>expect(screen.queryByRole('button',{name:'Descarregar gravação'})).toBeNull());
 expect(screen.queryByRole('button',{name:'Guardar ficheiro'})).toBeNull();
});
it('offers Photos sharing for a video MP4',async()=>{
 vi.stubGlobal('navigator',{canShare:()=>true,share:vi.fn()});
 m.rows.mockResolvedValue({data:[savedRow],error:null});m.fetchFile.mockResolvedValue({data:new Blob(['video'],{type:'video/mp4'}),error:null});
 render(<Recordings/>);fireEvent.click(await screen.findByRole('button',{name:'Descarregar gravação'}));
 expect(await screen.findByRole('button',{name:'Guardar na Fototeca / Partilhar'})).toBeVisible();
});
it('retains the original when conversion fails without mislabelling it as MP4',async()=>{
 const {prepareMp4}=await import('./mp4');vi.mocked(prepareMp4).mockRejectedValueOnce(new Error('unsupported'));
 m.rows.mockResolvedValue({data:[{...savedRow,storage_path:'call/rec.webm'}],error:null});m.fetchFile.mockResolvedValue({data:new Blob(['video'],{type:'video/webm'}),error:null});
 render(<Recordings/>);fireEvent.click(await screen.findByRole('button',{name:'Descarregar gravação'}));
 fireEvent.click(await screen.findByRole('button',{name:'Guardar original'}));expect(m.export.mock.calls[0][0].name).toMatch(/\.webm$/);expect(m.export.mock.calls[0][0].type).toBe('video/webm');
});
