import {beforeEach,describe,expect,it,vi} from 'vitest';

vi.mock('@/integrations/supabase/client',()=>({supabase:{auth:{getUser:vi.fn()}}}));

import {backupPreferenceKey,canBackupOnConnection,decryptArchive,getBackupPreferences,setBackupPreferences} from './account-backup';

describe('account backup security constraints',()=>{
  beforeEach(()=>{
    // The application's shared Vitest setup uses vi.fn() storage stubs without persistence.
    // Give this test an actual in-memory store to verify account separation.
    const storage = new Map<string,string>();
    vi.mocked(localStorage.getItem).mockImplementation(key => storage.get(key) ?? null);
    vi.mocked(localStorage.setItem).mockImplementation((key,value) => {storage.set(key,String(value));});
    vi.mocked(localStorage.clear).mockImplementation(() => {storage.clear();});
    localStorage.clear();
    Object.defineProperty(navigator,'onLine',{configurable:true,value:true});
    Object.defineProperty(navigator,'connection',{configurable:true,value:undefined});
  });
  it('does not guess that Safari/iOS uses Wi-Fi',()=>{
    expect(canBackupOnConnection(true)).toBe(false);
    expect(canBackupOnConnection(false)).toBe(true);
    Object.defineProperty(navigator,'connection',{configurable:true,value:{type:'wifi'}});
    expect(canBackupOnConnection(true)).toBe(true);
  });
  it('blocks offline copies even when cellular data are allowed',()=>{
    Object.defineProperty(navigator,'onLine',{configurable:true,value:false});
    expect(canBackupOnConnection(false)).toBe(false);
  });
  it('uses account-scoped, opt-in automatic backup preferences',()=>{
    expect(getBackupPreferences('alice')).toEqual({automatic:false,wifiOnly:true});
    setBackupPreferences('alice',{automatic:true,wifiOnly:false});
    expect(getBackupPreferences('alice')).toEqual({automatic:true,wifiOnly:false});
    expect(getBackupPreferences('bob')).toEqual({automatic:false,wifiOnly:true});
    expect(backupPreferenceKey('alice')).not.toBe(backupPreferenceKey('bob'));
  });
  it('rejects a cross-account restore before reading the encryption key',async()=>{
    await expect(decryptArchive('user-2',{
      version:1,owner:'user-1',createdAt:new Date().toISOString(),
      iv:'test',encrypted:'test',includesMediaFiles:false,
    })).rejects.toThrow(/outra conta/);
  });
  it('rejects incompatible archive versions',async()=>{
    await expect(decryptArchive('user-1',{
      version:2,owner:'user-1',createdAt:'',iv:'',encrypted:'',includesMediaFiles:false,
    } as never)).rejects.toThrow(/incompatível/);
  });
});
