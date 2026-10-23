import { useState } from 'react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as Dialog from '@radix-ui/react-dialog';
import { VideoEditor } from './VideoEditor';
import { AudioContextMock } from '@/test/editor-audio-mock';

const file = new File(['video'], 'clip.mov', { type: 'video/quicktime' });
let onSave = vi.fn<(file: File) => void>();
let recordedOptions: MediaRecorderOptions | undefined;
let drawText: ReturnType<typeof vi.fn>;
let time = 0;
let paused = true;

function Harness() {
  const [editing, setEditing] = useState(false);
  return (<Dialog.Root open><Dialog.Portal><Dialog.Content aria-describedby={undefined}>
    <Dialog.Title>Criar publicação</Dialog.Title><input aria-label="Publicação" /><button onClick={() => setEditing(true)}>Editar</button>
    </Dialog.Content></Dialog.Portal>
    {editing && <VideoEditor file={file} onSave={onSave} onCancel={vi.fn()} />}
  </Dialog.Root>);
}
function mount() {
  const view = render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
  return view;
}

beforeEach(() => {
  onSave = vi.fn(); time = 0; paused = true;
  AudioContextMock.instances = []; vi.stubGlobal('AudioContext', AudioContextMock);
  vi.stubGlobal('URL', { createObjectURL: () => 'blob:test', revokeObjectURL: vi.fn() });
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => { paused = true; });
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(async function () { paused = false; this.dispatchEvent(new Event('playing')); });
  vi.spyOn(HTMLMediaElement.prototype, 'paused', 'get').mockImplementation(() => paused);
  vi.spyOn(HTMLMediaElement.prototype, 'currentTime', 'get').mockImplementation(() => time);
  vi.spyOn(HTMLMediaElement.prototype, 'currentTime', 'set').mockImplementation(v => { time = v; });
  vi.spyOn(HTMLMediaElement.prototype, 'duration', 'get').mockReturnValue(1);
  drawText = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn(), fillText: drawText } as unknown as CanvasRenderingContext2D);
  Object.defineProperty(HTMLCanvasElement.prototype, 'captureStream', { configurable: true, value: () => ({ getTracks: () => [], addTrack: vi.fn() }) });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => setTimeout(() => { callback(0); time += 0.5; }, 0));
  vi.stubGlobal('cancelAnimationFrame', clearTimeout);
  vi.stubGlobal('MediaRecorder', class {
    static isTypeSupported = (type: string) => type === 'video/mp4';
    mimeType = 'video/mp4'; state = 'inactive';
    onstop?: () => void; ondataavailable?: (event: { data: Blob }) => void;
    constructor(_stream: MediaStream, options?: MediaRecorderOptions) { recordedOptions = options; }
    start() { this.state = 'recording'; }
    stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob(['encoded'], { type: this.mimeType }) }); this.onstop?.(); }
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function addText() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Texto' }));
  const input = screen.getByRole('textbox', { name: 'Texto para o vídeo' });
  await user.click(input);
  expect(input).toHaveFocus();
  await user.type(input, 'Olá banda');
  await user.click(screen.getByRole('button', { name: 'Adicionar texto' }));
  expect(screen.getByText('Olá banda', { exact: true })).toBeVisible();
  return user;
}

describe('VideoEditor inside the publication modal', () => {
  it('keeps keyboard focus in the editor and adds text above the playback control', async () => {
    mount(); await addText();
    expect(screen.getByRole('textbox', { name: 'Texto para o vídeo' })).toHaveValue('');
    expect(screen.getByText('Olá banda', { exact: true })).toHaveClass('z-10');
    fireEvent.click(screen.getByText('Remover'));
    expect(screen.queryByText('Olá banda', { exact: true })).not.toBeInTheDocument();
  });

  it('exports text using MP4 on a browser without WebM, including a video already at time zero', async () => {
    mount(); await addText();
    const video = document.querySelector('video')!;
    fireEvent.loadedMetadata(video);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(recordedOptions).toEqual({ mimeType: 'video/mp4' });
    expect(drawText).toHaveBeenCalledWith('Olá banda', expect.any(Number), expect.any(Number));
    expect(onSave.mock.calls[0][0]).toMatchObject({ name: 'clip.mp4', type: 'video/mp4' });
  });

  it('keeps edits and reports export errors instead of returning the original video', async () => {
    mount(); await addText();
    fireEvent.loadedMetadata(document.querySelector('video')!);
    Object.defineProperty(HTMLCanvasElement.prototype, 'captureStream', { configurable: true, value: () => { throw new Error('Unsupported'); } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('O texto foi mantido');
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('Olá banda', { exact: true })).toBeVisible();
  });
  it('replaces empty catalogue entries with playable instrumentals and records the selected music', async () => {
    mount(); fireEvent.loadedMetadata(document.querySelector('video')!);
    fireEvent.click(screen.getByRole('button', { name: 'Música' }));
    expect(screen.queryByText('Lagos Nights')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Batida da Banda/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Reproduzir vídeo' }));
    await waitFor(() => expect(AudioContextMock.instances[0].sources.at(-1)?.start).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    const context = AudioContextMock.instances[0];
    expect(context.createMediaElementSource).toHaveBeenCalledOnce();
    expect(context.createMediaStreamDestination).toHaveBeenCalledOnce();
    const destination = context.createMediaStreamDestination.mock.results[0].value;
    expect(context.gains[0].connect).toHaveBeenCalledWith(destination);
    expect(context.gains[1].connect).toHaveBeenCalledWith(destination);
  });

  it('reports rejected playback and keeps the play control available', async () => {
    mount(); vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(new Error('NotAllowed'));
    fireEvent.click(screen.getByRole('button', { name: 'Reproduzir vídeo' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível reproduzir');
    expect(screen.getByRole('button', { name: 'Reproduzir vídeo' })).toBeEnabled();
  });

  it('rejects unreadable audio without silently selecting it', async () => {
    mount(); fireEvent.click(screen.getByRole('button', { name: 'Música' }));
    const audioFile = new File(['broken'], 'broken.mp3', { type: 'audio/mpeg' });
    Object.defineProperty(audioFile, 'arrayBuffer', { value: async () => { throw new Error('decode'); } });
    fireEvent.change(screen.getByLabelText('Carregar música do telefone'), { target: { files: [audioFile] } });
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível abrir este áudio');
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled();
  });

  it('loads an audio file and allows removing it before saving', async () => {
    mount(); fireEvent.click(screen.getByRole('button', { name: 'Música' }));
    const audioFile = new File(['music'], 'Minha música.wav', { type: 'audio/wav' });
    Object.defineProperty(audioFile, 'arrayBuffer', { value: async () => new ArrayBuffer(4) });
    fireEvent.change(screen.getByLabelText('Carregar música do telefone'), { target: { files: [audioFile] } });
    expect(await screen.findByText('Minha música.wav')).toBeVisible();
    expect(AudioContextMock.instances[0].decodeAudioData).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Sem música' }));
    expect(screen.queryByText('Minha música.wav')).not.toBeInTheDocument();
  });

  it('ignores a pending upload after the user chooses no music', async () => {
    mount(); fireEvent.click(screen.getByRole('button', { name: 'Música' }));
    let resolveBytes!: (bytes: ArrayBuffer) => void;
    const audioFile = new File(['music'], 'Late.wav', { type: 'audio/wav' });
    Object.defineProperty(audioFile, 'arrayBuffer', { value: () => new Promise<ArrayBuffer>(resolve => { resolveBytes = resolve; }) });
    fireEvent.change(screen.getByLabelText('Carregar música do telefone'), { target: { files: [audioFile] } });
    await waitFor(() => expect(resolveBytes).toBeDefined());
    fireEvent.click(screen.getByRole('button', { name: 'Sem música' }));
    resolveBytes(new ArrayBuffer(4));
    await waitFor(() => expect(AudioContextMock.instances[0].decodeAudioData).toHaveBeenCalled());
    expect(screen.queryByText('Late.wav')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled();
  });

});
