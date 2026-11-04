export type PostDraftPrivacy = 'everyone' | 'contacts' | 'close_friends' | 'only_me';

export interface PostDraft {
  content: string;
  privacy: PostDraftPrivacy;
  location: string;
  selectedTopics: string[];
  files: File[];
  hadMedia?: boolean;
  savedAt?: number;
}

const VERSION = 1;
const MAX_AGE = 30 * 24 * 60 * 60 * 1000;
const DB_NAME = 'yamilook-post-drafts-v1';
const STORE_NAME = 'media';

const keyFor = (userId: string) => `yamilook_post_draft_v${VERSION}:${userId}`;

const openDraftDb = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  if (!globalThis.indexedDB) {
    reject(new Error('IndexedDB unavailable'));
    return;
  }
  const request = indexedDB.open(DB_NAME, VERSION);
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains(STORE_NAME)) {
      request.result.createObjectStore(STORE_NAME);
    }
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error || new Error('Unable to open draft storage'));
});

const putFiles = async (userId: string, files: File[]) => {
  const db = await openDraftDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put(files, userId);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('Unable to save draft media'));
      transaction.onabort = () => reject(transaction.error || new Error('Unable to save draft media'));
    });
  } finally {
    db.close();
  }
};

const getFiles = async (userId: string): Promise<File[]> => {
  const db = await openDraftDb();
  try {
    return await new Promise<File[]>((resolve, reject) => {
      const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(userId);
      request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result : []);
      request.onerror = () => reject(request.error || new Error('Unable to load draft media'));
    });
  } finally {
    db.close();
  }
};

const deleteFiles = async (userId: string) => {
  const db = await openDraftDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).delete(userId);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('Unable to clear draft media'));
      transaction.onabort = () => reject(transaction.error || new Error('Unable to clear draft media'));
    });
  } finally {
    db.close();
  }
};

export async function savePostDraft(userId: string, draft: PostDraft): Promise<{ mediaSaved: boolean }> {
  const metadata = {
    version: VERSION,
    content: draft.content,
    privacy: draft.privacy,
    location: draft.location,
    selectedTopics: draft.selectedTopics,
    hadMedia: draft.files.length > 0,
    savedAt: Date.now(),
  };
  localStorage.setItem(keyFor(userId), JSON.stringify(metadata));

  if (!draft.files.length) {
    await deleteFiles(userId).catch(() => undefined);
    return { mediaSaved: true };
  }

  try {
    await putFiles(userId, draft.files);
    return { mediaSaved: true };
  } catch {
    await deleteFiles(userId).catch(() => undefined);
    return { mediaSaved: false };
  }
}

export async function loadPostDraft(userId: string): Promise<PostDraft | null> {
  let metadata: {
    version?: number;
    content?: unknown;
    privacy?: unknown;
    location?: unknown;
    selectedTopics?: unknown;
    hadMedia?: unknown;
    savedAt?: unknown;
  } | null = null;
  try {
    metadata = JSON.parse(localStorage.getItem(keyFor(userId)) || 'null');
  } catch {
    localStorage.removeItem(keyFor(userId));
    return null;
  }

  const privacyValues: PostDraftPrivacy[] = ['everyone', 'contacts', 'close_friends', 'only_me'];
  if (!metadata || metadata.version !== VERSION || typeof metadata.content !== 'string' ||
      typeof metadata.location !== 'string' || !privacyValues.includes(metadata.privacy as PostDraftPrivacy) ||
      !Array.isArray(metadata.selectedTopics) || !metadata.selectedTopics.every(topic => typeof topic === 'string') ||
      typeof metadata.savedAt !== 'number' || Date.now() - metadata.savedAt > MAX_AGE || metadata.savedAt > Date.now()) {
    await clearPostDraft(userId);
    return null;
  }

  const files = metadata.hadMedia ? await getFiles(userId).catch(() => []) : [];
  return {
    content: metadata.content,
    privacy: metadata.privacy as PostDraftPrivacy,
    location: metadata.location,
    selectedTopics: metadata.selectedTopics as string[],
    files,
    hadMedia: Boolean(metadata.hadMedia),
    savedAt: metadata.savedAt,
  };
}

export async function clearPostDraft(userId: string): Promise<void> {
  localStorage.removeItem(keyFor(userId));
  await deleteFiles(userId).catch(() => undefined);
}
