export function localStorageObject(value: string, projectUrl: string): { bucket: string; path: string } | null {
  try {
    const url = new URL(value);
    if (url.origin !== new URL(projectUrl).origin) return null;
    const match = url.pathname.match(/^\/storage\/v1\/object\/(?:public|sign|authenticated)\/(media|voice-messages)\/(.+)$/);
    return match ? { bucket: match[1], path: decodeURIComponent(match[2]) } : null;
  } catch { return null; }
}
export const objectKey = (object: { bucket: string; path: string }) => `${object.bucket}/${object.path}`;
export function publicObjectKeys(values: string[], projectUrl: string): Set<string> {
  return new Set(values.flatMap(value => { const obj=localStorageObject(value,projectUrl); return obj ? [objectKey(obj)] : []; }));
}
