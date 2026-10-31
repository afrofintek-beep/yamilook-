// Service-side wrapper. Recheck actual bytes before changing any message reference.
export async function transitionReferences(admin: any, id: string, action: 'cutover'|'rollback') {
  const {data:a,error}=await admin.from('chat_attachments').select('*').eq('id',id).single();
  if(error||!a?.legacy_manifest||!a.legacy_bucket)throw new Error('Recovery manifest unavailable');
  const m=a.legacy_manifest;
  for(const [bucket,path] of [[a.legacy_bucket,a.legacy_path],['chat-attachments',a.object_path],['chat-attachments',m.recovery_path]]){
    const {data,error:readError}=await admin.storage.from(bucket).download(path);
    if(readError||!data)throw new Error('Recovery object unavailable');
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await data.arrayBuffer()))).map(b=>b.toString(16).padStart(2,'0')).join('');
    if(data.size!==m.bytes||hash!==m.sha256)throw new Error('Recovery verification failed');
  }
  // Diagnostics only: originals are retained even when this reports zero matches.
  const tokens=[a.legacy_path,encodeURI(a.legacy_path),encodeURIComponent(a.legacy_path)];
  const {data:inventory,error:inventoryError}=await admin.rpc('chat_attachment_public_reference_counts',{p_tokens:[...new Set(tokens)]});
  if(inventoryError)throw new Error('Public inventory failed');
  const {data:result,error:transitionError}=await admin.rpc('chat_attachment_reference_transition',{p_id:id,p_action:action,p_sha256:m.sha256});
  if(transitionError)throw new Error('Reference transition failed; transaction rolled back');
  return {...result,public_matches:inventory.matches,quarantine_authorized:false};
}
