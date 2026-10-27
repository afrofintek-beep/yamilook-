import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  type BackupFile, type BackupPreferences, type BackupUsage,
  canBackupOnConnection, createCloudBackup, decryptArchive, downloadSnapshot,
  generateRecoveryKey, getBackupPreferences, hasDeviceKey, importRecoveryKey,
  listCloudBackups, readCloudBackup, restoreBackupPreferences,
  setBackupPreferences, usageForAccount,
} from '@/lib/account-backup';

const formatBytes = (bytes: number) =>
  new Intl.NumberFormat('pt-PT',{maximumFractionDigits:1}).format(bytes/(1024*1024))+' MB';

export function BackupManager() {
  const { user }=useAuth();
  const id=user?.id;
  const [usage,setUsage]=useState<BackupUsage|null>(null);
  const [keyReady,setKeyReady]=useState(false);
  const [recoveryKey,setRecoveryKey]=useState('');
  const [acknowledged,setAcknowledged]=useState(false);
  const [inputKey,setInputKey]=useState('');
  const [prefs,setPrefs]=useState<BackupPreferences>({automatic:false,wifiOnly:true});
  const [files,setFiles]=useState<BackupFile[]>([]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [info,setInfo]=useState('');
  const [snapshot,setSnapshot]=useState<Record<string,unknown>|null>(null);
  const [confirmRestore,setConfirmRestore]=useState(false);

  const refresh=async(userId:string) => {
    const [storedKey,cloud,measured]=await Promise.all([
      hasDeviceKey(userId).catch(()=>false),
      listCloudBackups(userId).catch(()=>[]),
      usageForAccount(userId).catch(()=>null),
    ]);
    if(userId!==id) return;
    setKeyReady(storedKey);setFiles(cloud);setUsage(measured);
  };
  useEffect(() => {
    setUsage(null);setKeyReady(false);setSnapshot(null);setRecoveryKey('');
    setFiles([]);setInfo('');setError('');
    if (!id) return;
    setPrefs(getBackupPreferences(id));
    void refresh(id);
  },[id]);

  if(!id) return null;
  const run=async(job:()=>Promise<void>)=>{
    if(busy)return;
    setBusy(true);setError('');setInfo('');
    try{await job();}catch(e){setError(e instanceof Error?e.message:'Não foi possível concluir a operação.');}
    finally{setBusy(false);}
  };
  const changePrefs=(next:BackupPreferences)=>{
    setPrefs(next);setBackupPreferences(id,next);
  };
  const selectArchive=(data:Record<string,unknown>)=>{
    if(data.userId!==id) throw new Error('Este backup pertence a uma conta diferente.');
    setSnapshot(data);setConfirmRestore(false);
    setInfo('Cópia validada e decifrada. Nenhuma informação foi alterada na sua conta.');
  };
  const summary=snapshot?.summary as Record<string,number>|undefined;

  return <section className="space-y-4 text-sm" aria-label="Backup seguro da conta">
    <div className="rounded-xl border p-4 space-y-2">
      <h3 className="font-semibold">Armazenamento atribuído à sua conta</h3>
      {usage
        ? <>
            <p className="text-xl font-semibold">{formatBytes(usage.bytes)}</p>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <span>Fotos: {formatBytes(usage.photos)}</span>
              <span>Vídeos: {formatBytes(usage.videos)}</span>
              <span>Outros: {formatBytes(usage.other)}</span>
            </div>
            <p className="text-xs text-muted-foreground">{usage.files} ficheiros com proprietário confirmado. Os ficheiros antigos sem proprietário atribuído não são contabilizados. Não há quota individual confirmada.</p>
          </>
        : <p className="text-muted-foreground">Medição ainda não disponível. Não apresentamos valores estimados como se fossem reais.</p>}
    </div>

    <div className="rounded-xl border p-4 space-y-3">
      <h3 className="font-semibold">Proteção da cópia</h3>
      <p className="text-muted-foreground">Os dados exportados são cifrados no dispositivo com AES-256-GCM antes de serem enviados para uma pasta privada da sua conta.</p>
      {!keyReady && <>
        <button className="rounded-lg bg-primary text-primary-foreground px-3 py-2 disabled:opacity-50" disabled={busy} onClick={()=>void run(async()=>{
          const key=await generateRecoveryKey(id);
          setRecoveryKey(key);setKeyReady(true);
          setInfo('Guarde esta chave fora da aplicação: será necessária num novo dispositivo.');
        })}>Criar chave de recuperação</button>
        <label className="block">Ou introduza a chave guardada para recuperar noutro dispositivo
          <input className="w-full mt-1 rounded-lg border bg-background p-2 font-mono" type="password" autoComplete="off" value={inputKey} onChange={e=>setInputKey(e.target.value)} placeholder="64 caracteres" />
        </label>
        <button disabled={busy||!inputKey} className="rounded-lg border px-3 py-2 disabled:opacity-50" onClick={()=>void run(async()=>{
          await importRecoveryKey(id,inputKey);setInputKey('');setKeyReady(true);setInfo('Chave recuperada neste dispositivo.');
        })}>Ativar com chave existente</button>
      </>}
      {keyReady && !recoveryKey && <p className="text-xs">Este dispositivo possui uma chave de cifragem. Guarde sempre a chave original num local seguro.</p>}
      {recoveryKey && <div className="rounded-xl border border-amber-500/50 p-3 space-y-2">
        <p className="font-semibold">Chave de recuperação — apresentada uma única vez</p>
        <code className="block break-all select-all">{recoveryKey}</code>
        <p>Se perder esta chave e o dispositivo, não será possível decifrar a cópia na nuvem.</p>
        <label className="flex items-start gap-2"><input type="checkbox" checked={acknowledged} onChange={e=>setAcknowledged(e.target.checked)} /> Guardei a chave num local privado e seguro.</label>
        {acknowledged && <button className="underline" onClick={()=>{setRecoveryKey('');setAcknowledged(false);}}>Ocultar chave</button>}
      </div>}
    </div>

    <div className="rounded-xl border p-4 space-y-3">
      <h3 className="font-semibold">Cópias cifradas na nuvem</h3>
      <label className="flex gap-2 items-center justify-between">
        <span>Backup automático (com aplicação aberta, aproximadamente diário)</span>
        <input type="checkbox" disabled={!keyReady} checked={prefs.automatic} onChange={e=>changePrefs({...prefs,automatic:e.target.checked})} />
      </label>
      <label className="flex gap-2 items-center justify-between">
        <span>Backup apenas com Wi-Fi confirmado</span>
        <input type="checkbox" checked={prefs.wifiOnly} onChange={e=>changePrefs({...prefs,wifiOnly:e.target.checked})} />
      </label>
      {prefs.wifiOnly && !canBackupOnConnection(true) &&
        <p className="text-xs text-amber-600">Este navegador não confirma a ligação Wi-Fi (frequente no iPhone). O backup fica bloqueado para não consumir dados móveis. Pode desativar a restrição manualmente.</p>}
      <button className="rounded-lg bg-primary text-primary-foreground px-3 py-2 disabled:opacity-50" disabled={!keyReady||busy||!!recoveryKey&&!acknowledged} onClick={()=>void run(async()=>{
        await createCloudBackup(id,prefs.wifiOnly);
        await refresh(id);
        setInfo('Cópia cifrada guardada na nuvem. Pode verificá-la abaixo.');
      })}>{busy?'A processar…':'Fazer backup agora'}</button>
      <p className="text-xs text-muted-foreground">A exportação atual inclui dados estruturados e referências multimédia, mas não inclui os ficheiros originais de fotografias/vídeos. Não equivale a uma cópia completa de todos os conteúdos.</p>
      <h4 className="font-medium">Cópias disponíveis</h4>
      {files.length===0 && <p className="text-muted-foreground">Nenhuma cópia cifrada disponível.</p>}
      {files.map(f=><div key={f.name} className="flex items-center justify-between gap-2 rounded-lg border p-2">
        <span className="text-xs">{new Date(Number(f.name.split('-')[1])).toLocaleString('pt-PT')}</span>
        <button className="underline disabled:opacity-50" disabled={!keyReady||busy} onClick={()=>void run(async()=>{
          selectArchive(await readCloudBackup(id,f.name));
        })}>Verificar / recuperar</button>
      </div>)}
      <label className="block text-xs">Também pode abrir uma cópia cifrada anteriormente descarregada
        <input className="block mt-2 text-xs w-full" type="file" accept=".json,application/json" disabled={!keyReady||busy} onChange={e=>{
          const file=e.target.files?.[0];e.currentTarget.value='';
          if(!file)return;
          void run(async()=>{
            if(file.size>12*1024*1024) throw new Error('Ficheiro demasiado grande.');
            const data=await decryptArchive(id,JSON.parse(await file.text()));
            selectArchive(data);
          });
        }}/>
      </label>
    </div>

    {snapshot && <div className="rounded-xl border p-4 space-y-3">
      <h3 className="font-semibold">Pré-visualização do restauro</h3>
      <p>Contactos: {summary?.totalContacts ?? '—'} · Conversas: {summary?.totalConversations ?? '—'} · Publicações: {summary?.totalPosts ?? '—'}</p>
      <p className="text-xs text-muted-foreground">A conta existente continua sincronizada com o servidor. Este restauro seguro aplica apenas preferências selecionadas, sem substituir conversas, mensagens, publicações ou ficheiros multimédia.</p>
      <label className="flex gap-2"><input type="checkbox" checked={confirmRestore} onChange={e=>setConfirmRestore(e.target.checked)} /> Confirmo a reposição das preferências antigas</label>
      <button className="rounded-lg border px-3 py-2 disabled:opacity-50" disabled={!confirmRestore||busy} onClick={()=>void run(async()=>{
        const n=await restoreBackupPreferences(id,snapshot);
        setInfo(n+' preferências recuperadas. Reabra as definições para refletir as alterações.');
      })}>Repor preferências</button>
      <button className="rounded-lg border px-3 py-2 ml-2" onClick={()=>void run(async()=>{
        downloadSnapshot(id,snapshot);
        setInfo('O JSON recuperado foi exportado localmente; mantenha-o privado.');
      })}>Exportar JSON recuperado</button>
    </div>}
    {error&&<p role="alert" className="text-destructive">{error}</p>}
    {info&&<p role="status" className="text-green-600">{info}</p>}
  </section>;
}
