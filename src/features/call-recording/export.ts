export function recordingFile(blob: Blob, id: string, path: string): File {
  const extension = path.endsWith('.mp4') ? 'mp4' : 'webm';
  const type = /^(audio|video)\/(mp4|webm)/.test(blob.type) ? blob.type : `video/${extension}`;
  return new File([blob], `gravacao-${id}.${extension}`, { type });
}

export function downloadFile(file: File) {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
