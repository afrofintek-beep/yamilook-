// All bytes remain inside the maintenance runtime; never log or return private content.
async function checksum(blob: Blob): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer())))
    .map(b=>b.toString(16).padStart(2,'0')).join('');
}
async function read(admin: any,bucket: string,path: string): Promise<Blob> {
  const {data,error}=await admin.storage.from(bucket).download(path);
  if(error || !data) throw new Error('Object unavailable');
  return data;
}
export async function prepareObject(admin: any,job: any) {
  const {data:found,error}=await admin.from('chat_attachments').select('*')
    .eq('legacy_bucket',job.bucket).eq('legacy_path',job.path).maybeSingle();
  if(error) throw new Error('Registry unavailable');
  let attachment=found;
  if(!attachment) {
    const id=crypto.randomUUID();
    const filename=(job.path.split('/').pop() || 'file').replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,160);
    // Reserve before copying, so interruption does not lose the destination identity.
    const {data,error:saveError}=await admin.from('chat_attachments').insert({id,
      conversation_id:job.conversation,uploader_id:job.uploader,
      object_path:`${job.conversation}/${job.uploader}/${id}/${filename}`,
      legacy_bucket:job.bucket,legacy_path:job.path}).select().single();
    if(saveError) throw new Error('Registry conflict; retry inventory');
    attachment=data;
  }
  if(attachment.legacy_manifest?.state==='references_private') throw new Error('Rollback references before preparing again');
  if(attachment.legacy_quarantined) throw new Error('Requires manual recovery review');
  const original=await read(admin,job.bucket,job.path);
  const hash=await checksum(original);
  const recovery=`legacy-recovery/${attachment.id}/original`;
  for(const destination of [attachment.object_path,recovery]) {
    // A previous copy may exist after interruption. Never overwrite it.
    const {error:copyError}=await admin.storage.from(job.bucket).copy(job.path,destination,{destinationBucket:'chat-attachments'});
    const copied=await read(admin,'chat-attachments',destination);
    if(copied.size!==original.size || await checksum(copied)!==hash) throw new Error('Copy verification failed');
    // Copy errors are only harmless if an existing destination was verified byte-for-byte.
    void copyError;
  }
  if(await checksum(await read(admin,job.bucket,job.path))!==hash) throw new Error('Source changed during preparation');
  let save=admin.from('chat_attachments').update({legacy_manifest:{
    state:'prepared',sha256:hash,bytes:original.size,recovery_path:recovery,
    references:job.refs,verified_at:new Date().toISOString(),original_retained:true,
  }}).eq('id',attachment.id);
  save=attachment.legacy_manifest?.state ? save.eq('legacy_manifest->>state',attachment.legacy_manifest.state) : save.is('legacy_manifest',null);
  const {data:saved,error:manifestError}=await save.select('id').maybeSingle();
  if(manifestError||!saved) throw new Error('Manifest write failed; safe to retry');
  return {prepared:1,original_retained:true,references_changed:0};
}
