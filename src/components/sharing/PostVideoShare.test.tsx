import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import PostVideoShare from './PostVideoShare';
import { preparePostVideo, canShareVideo, sharePreparedVideo } from '../../../shared/post-video-sharing.mjs';
vi.mock('../../../shared/post-video-sharing.mjs', async importOriginal => ({...await importOriginal(), preparePostVideo: vi.fn(), canShareVideo: vi.fn(), sharePreparedVideo: vi.fn()}));
const urls = ['https://example.com/photo.jpg','https://example.com/one.mp4','https://example.com/two.mov'];
beforeEach(()=>{vi.resetAllMocks();vi.mocked(preparePostVideo).mockResolvedValue(new File(['video'],'video.mp4',{type:'video/mp4'}));vi.mocked(canShareVideo).mockReturnValue(true);vi.mocked(sharePreparedVideo).mockResolvedValue('shared');});
afterEach(cleanup);
it('does not download on opening and requires a second user action to share the File', async()=>{
  render(<PostVideoShare id="post" mediaUrls={urls}/>);expect(preparePostVideo).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Partilhar vídeo'}));
  const share=await screen.findByRole('button',{name:'Escolher aplicação'});expect(sharePreparedVideo).not.toHaveBeenCalled();
  fireEvent.click(share);expect(await screen.findByRole('status')).toHaveTextContent('Vídeo entregue');expect(sharePreparedVideo).toHaveBeenCalledOnce();
});
it('offers a download when native file sharing is unsupported',async()=>{
  vi.mocked(canShareVideo).mockReturnValue(false);render(<PostVideoShare id="post" mediaUrls={urls}/>);
  fireEvent.click(screen.getByRole('button',{name:'Partilhar vídeo'}));await screen.findByText(/Este navegador/);
  expect(screen.queryByRole('button',{name:'Escolher aplicação'})).not.toBeInTheDocument();expect(screen.getByRole('link',{name:'Descarregar vídeo'})).toHaveAttribute('href','/api/public-post?id=post&media=video&index=1&download=1');
});
it('switching video changes its media index and resets the prepared file',async()=>{
  render(<PostVideoShare id="post" mediaUrls={urls}/>);fireEvent.click(screen.getByRole('button',{name:'Partilhar vídeo'}));await screen.findByRole('button',{name:'Escolher aplicação'});
  fireEvent.change(screen.getByRole('combobox'),{target:{value:'2'}});expect(screen.getByRole('button',{name:'Partilhar vídeo'})).toBeInTheDocument();expect(screen.getByRole('link',{name:'Descarregar vídeo'})).toHaveAttribute('href','/api/public-post?id=post&media=video&index=2&download=1');
});
it('closing the component aborts an in-flight preparation',()=>{
  vi.mocked(preparePostVideo).mockReturnValue(new Promise(()=>{}));const {unmount}=render(<PostVideoShare id="post" mediaUrls={urls}/>);
  fireEvent.click(screen.getByRole('button',{name:'Partilhar vídeo'}));const signal=vi.mocked(preparePostVideo).mock.calls[0][2].signal;unmount();expect(signal.aborted).toBe(true);
});
it('preparation errors are visible and can be retried',async()=>{
  vi.mocked(preparePostVideo).mockRejectedValueOnce(new Error('Rede indisponível'));
  render(<PostVideoShare id="post" mediaUrls={urls}/>);fireEvent.click(screen.getByRole('button',{name:'Partilhar vídeo'}));await screen.findByText('Rede indisponível');
  fireEvent.click(screen.getByRole('button',{name:'Partilhar vídeo'}));await screen.findByRole('button',{name:'Escolher aplicação'});expect(preparePostVideo).toHaveBeenCalledTimes(2);
});
