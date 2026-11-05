export function recordingFile(blob: Blob, id: string, path: string, createdAt?: string): File {
  const extension = path.endsWith('.mp4') ? 'mp4' : 'webm';
  const type = /^(audio|video)\/(mp4|webm)/.test(blob.type) ? blob.type : `video/${extension}`;
  const date = new Date(createdAt ?? '');
  const stamp = Number.isNaN(date.getTime()) ? id : `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}_${String(date.getHours()).padStart(2,'0')}-${String(date.getMinutes()).padStart(2,'0')}-${String(date.getSeconds()).padStart(2,'0')}`;
  return new File([blob], `Kosolola_${stamp}.${extension}`, { type });
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
