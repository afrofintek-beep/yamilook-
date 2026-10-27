import { supabase } from '@/integrations/supabase/client';

/** Encrypted account snapshots. No account data or key material is persisted in plaintext. */
export const BACKUP_BUCKET = 'account-backups';
const KEY_DB = 'yamilook-private-backup-v1';
const KEY_STORE = 'device-keys';
const MAX_BYTES = 6 * 1024 * 1024;
const DAY = 24 * 60 * 60 * 1000;

export type BackupArchive = {
  version: 1;
  owner: string;
  createdAt: string;
  iv: string;
  encrypted: string;
  includesMediaFiles: false;
};
export type BackupUsage = {
  bytes: number; photos: number; videos: number; other: number; files: number;
  attribution: string;
};
export type BackupFile = { name: string; created_at?: string | null };

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}
function fromHex(value: string): Uint8Array {
  if (!/^[0-9a-f]{64}$/i.test(value)) throw new Error('A chave de recuperação deve ter 64 caracteres hexadecimais.');
  return Uint8Array.from(value.match(/../g)!, v => parseInt(v, 16));
}
function toBase64(bytes: Uint8Array): string {
  let result = '';
  for (let i=0;i<bytes.length;i+=16384)
    result += String.fromCharCode(...bytes.subarray(i,i+16384));
  return btoa(result);
}
function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve,reject) => {
    const request = indexedDB.open(KEY_DB,1);
    request.onupgradeneeded = () => request.result.createObjectStore(KEY_STORE);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}
async function withKeyStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDatabase();
  return new Promise((resolve,reject) => {
    const tx = db.transaction(KEY_STORE,mode);
    const req = run(tx.objectStore(KEY_STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => db.close();
    tx.onabort = () => db.close();
  });
}
async function storeKey(userId: string, raw: Uint8Array) {
  const key = await crypto.subtle.importKey('raw',raw as BufferSource,{name:'AES-GCM'},false,['encrypt','decrypt']);
  await withKeyStore('readwrite', store => store.put(key,userId));
}
export async function hasDeviceKey(userId: string): Promise<boolean> {
  return !!(await withKeyStore('readonly', store => store.get(userId)));
}
async function getDeviceKey(userId: string): Promise<CryptoKey> {
  const key = await withKeyStore('readonly',store => store.get(userId));
  if (!key) throw new Error('Configure a chave de recuperação deste dispositivo.');
  return key as CryptoKey;
}
export async function generateRecoveryKey(userId: string): Promise<string> {
  if (await hasDeviceKey(userId)) throw new Error('Já existe uma chave neste dispositivo. Guarde a chave original, não crie outra.');
  const raw=crypto.getRandomValues(new Uint8Array(32));
  await storeKey(userId,raw);
  return hex(raw);
}
export async function importRecoveryKey(userId: string, recoveryKey: string): Promise<void> {
  if (await hasDeviceKey(userId)) throw new Error('Já existe uma chave neste dispositivo. Não pode ser substituída sem recuperar primeiro a cópia original.');
  await storeKey(userId,fromHex(recoveryKey.replace(/\s/g,'')));
}
export function backupPreferenceKey(userId: string) { return 'account-backup-preferences:'+userId; }
export type BackupPreferences = { automatic: boolean; wifiOnly: boolean };
export function getBackupPreferences(userId: string): BackupPreferences {
  try {
    const raw = localStorage.getItem(backupPreferenceKey(userId));
    return raw ? { automatic: JSON.parse(raw).automatic===true, wifiOnly: JSON.parse(raw).wifiOnly!==false } : {automatic:false,wifiOnly:true};
  } catch { return {automatic:false,wifiOnly:true}; }
}
export function setBackupPreferences(userId: string,p: BackupPreferences) {
  localStorage.setItem(backupPreferenceKey(userId),JSON.stringify(p));
}
export function canBackupOnConnection(wifiOnly: boolean): boolean {
  if (!navigator.onLine) return false;
  if (!wifiOnly) return true;
  // Safari/iOS does not expose Wi-Fi detection: fail closed, never assume cellular is Wi-Fi.
  const connection = (navigator as Navigator & {connection?:{type?:string}}).connection;
  return connection?.type==='wifi';
}
async function verifiedUser(expectedUserId: string) {
  const {data,error}=await supabase.auth.getUser();
  if (error || !data.user || data.user.id!==expectedUserId) throw new Error('Sessão inválida ou conta diferente.');
}
export async function usageForAccount(userId: string): Promise<BackupUsage> {
  await verifiedUser(userId);
  const {data,error}=await supabase.rpc('my_attributed_storage_usage');
  if (error) throw error;
  return data as unknown as BackupUsage;
}
export async function listCloudBackups(userId: string): Promise<BackupFile[]> {
  await verifiedUser(userId);
  const {data,error}=await supabase.storage.from(BACKUP_BUCKET).list(userId,{limit:100,sortBy:{column:'name',order:'desc'}});
  if (error) throw error;
  return (data || []).filter(f=>/^snapshot-\d+-[a-f0-9-]+\.json$/.test(f.name));
}
async function encryptSnapshot(userId: string, content: unknown): Promise<BackupArchive> {
  const plain = new TextEncoder().encode(JSON.stringify(content));
  if (plain.length>MAX_BYTES) throw new Error('Exportação superior a 6 MB. Requer cópias segmentadas.');
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const encrypted=await crypto.subtle.encrypt(
    {name:'AES-GCM',iv,additionalData:new TextEncoder().encode(userId)},
    await getDeviceKey(userId), plain
  );
  return {version:1,owner:userId,createdAt:new Date().toISOString(),iv:toBase64(iv),encrypted:toBase64(new Uint8Array(encrypted)),includesMediaFiles:false};
}
export async function decryptArchive(userId:string,archive:BackupArchive):Promise<Record<string,unknown>> {
  if (!archive || archive.version!==1 || archive.owner!==userId || typeof archive.encrypted!=='string')
    throw new Error('Cópia incompatível ou pertencente a outra conta.');
  if (archive.encrypted.length>MAX_BYTES*2) throw new Error('Cópia demasiado grande.');
  const plaintext=await crypto.subtle.decrypt({
    name:'AES-GCM',
    iv:fromBase64(archive.iv) as BufferSource,
    additionalData:new TextEncoder().encode(userId)
  },await getDeviceKey(userId),fromBase64(archive.encrypted) as BufferSource);
  const data=JSON.parse(new TextDecoder().decode(plaintext));
  if (!data || data.userId!==userId) throw new Error('Identidade da cópia não corresponde à conta.');
  return data;
}
let backupInProgress=false;
export async function createCloudBackup(userId: string, wifiOnly: boolean):Promise<string> {
  if (backupInProgress) throw new Error('Já existe um backup em curso.');
  if (!canBackupOnConnection(wifiOnly)) throw new Error('Wi-Fi não confirmado neste dispositivo. Desative a restrição para permitir usar esta ligação.');
  backupInProgress=true;
  try {
    await verifiedUser(userId);
    const {data,error}=await supabase.functions.invoke('export-user-data');
    if (error || !data || data.userId!==userId) throw new Error('Não foi possível obter uma exportação autenticada.');
    // Ephemeral and deleted/view-once material must never be resurrected by a backup.
    const snapshot={...data,deviceSessions:undefined,messagesSent:Array.isArray(data.messagesSent)
      ? data.messagesSent.filter((m:{is_deleted?:boolean;is_view_once?:boolean;expires_at?:string}) =>
          !m.is_deleted && !m.is_view_once && (!m.expires_at || Date.parse(m.expires_at)>Date.now())) : []};
    const archive=await encryptSnapshot(userId,snapshot);
    const name='snapshot-'+Date.now()+'-'+crypto.randomUUID()+'.json';
    const {error:uploadError}=await supabase.storage.from(BACKUP_BUCKET)
      .upload(userId+'/'+name,JSON.stringify(archive),{contentType:'application/json',upsert:false});
    if (uploadError) throw uploadError;
    localStorage.setItem('account-backup-last:'+userId,String(Date.now()));
    // Retain the most recent seven; delete older snapshots only after a successful upload.
    const files=await listCloudBackups(userId).catch(()=>[]);
    if (files.length>7) await supabase.storage.from(BACKUP_BUCKET)
      .remove(files.slice(7).map(f=>userId+'/'+f.name)).catch(()=>{});
    return name;
  } finally { backupInProgress=false; }
}
export async function readCloudBackup(userId:string,name:string):Promise<Record<string,unknown>> {
  if (!/^snapshot-\d+-[a-f0-9-]+\.json$/.test(name)) throw new Error('Nome de ficheiro inválido.');
  await verifiedUser(userId);
  const {data,error}=await supabase.storage.from(BACKUP_BUCKET).download(userId+'/'+name);
  if(error||!data) throw error || new Error('Cópia indisponível');
  if(data.size>MAX_BYTES*2) throw new Error('Cópia demasiado grande.');
  return decryptArchive(userId,JSON.parse(await data.text()) as BackupArchive);
}
export async function restoreBackupPreferences(userId:string,snapshot:Record<string,unknown>) {
  await verifiedUser(userId);
  if(snapshot.userId!==userId) throw new Error('O backup pertence a outra conta.');
  const raw = snapshot.settings as Record<string,unknown>|null;
  if(!raw) throw new Error('O backup não contém preferências.');
  const allowed=['theme','language','language_variant','font_size','notification_sound','vibration_enabled','enter_to_send','data_saver_mode','auto_download_media'] as const;
  const patch:Record<string,string|number|boolean|null>={};
  for(const key of allowed) if(typeof raw[key]==='string' || typeof raw[key]==='boolean') patch[key]=raw[key] as string|boolean;
  if(!Object.keys(patch).length) throw new Error('Sem preferências recuperáveis.');
  const {error}=await supabase.from('user_settings').update(patch).eq('user_id',userId);
  if(error) throw error;
  return Object.keys(patch).length;
}
export function downloadSnapshot(userId:string,snapshot:Record<string,unknown>) {
  if(snapshot.userId!==userId) throw new Error('Identidade incorreta.');
  const blob=new Blob([JSON.stringify(snapshot,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='yamilook-recovered-'+new Date().toISOString().slice(0,10)+'.json';
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
export async function runDueAutomaticBackup(userId:string) {
  const p=getBackupPreferences(userId);
  if(!p.automatic || !canBackupOnConnection(p.wifiOnly) || !await hasDeviceKey(userId)) return;
  const last=Number(localStorage.getItem('account-backup-last:'+userId)||0);
  if(Date.now()-last<DAY) return;
  try { await createCloudBackup(userId,p.wifiOnly); } catch (error) {
    console.warn('Automatic account backup failed:',error instanceof Error ? error.message : 'unknown');
  }
}
