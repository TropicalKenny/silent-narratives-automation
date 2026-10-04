import crypto from 'node:crypto';
import fs from 'node:fs';
export function validDate(value){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value)))return false;
  const date=new Date(value+'T00:00:00Z');return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;
}
export function validSlots(value){
  return Array.isArray(value)&&value.length===1&&new Set(value).size===1&&value.every(time=>/^([01]\d|2[0-3]):[0-5]\d$/.test(time));
}
export function canonicalSource(value){
  let url;try{url=new URL(String(value));}catch{throw new Error('Enter a YouTube video or Shorts URL.');}
  if(!['https:','http:'].includes(url.protocol)||!['youtube.com','www.youtube.com','m.youtube.com','youtu.be','www.youtu.be'].includes(url.hostname.toLowerCase()))throw new Error('Use a youtube.com or youtu.be URL.');
  const id=url.hostname.endsWith('youtu.be')?url.pathname.split('/').filter(Boolean)[0]:url.pathname.startsWith('/shorts/')?url.pathname.split('/')[2]:url.searchParams.get('v');
  if(!/^[A-Za-z0-9_-]{11}$/.test(id||''))throw new Error('The YouTube video ID is invalid.');
  return {id,url:'https://www.youtube.com/shorts/'+id};
}
export function sceneMeta(job){try{return JSON.parse(job.scene_meta||'{}');}catch{return {};}}
export function renderFingerprint(job){
  let stat=null;try{const value=fs.statSync(job.scene_file);stat={size:value.size,modified:value.mtimeMs};}catch{}
  return crypto.createHash('sha256').update(JSON.stringify({hook:job.hook,subtitles:job.subtitle_text,editorialProfile:job.editorial_profile,templateProfile:job.template_profile,editorialPurpose:sceneMeta(job).editorial_purpose||'',scene:job.scene_file,stat,timings:sceneMeta(job).subtitle_timings||[],background:(()=>{try{const s=fs.statSync('assets/background.mp4');return {size:s.size,modified:s.mtimeMs};}catch{return null;}})()})).digest('hex');
}
export function approvalFingerprint(job){return crypto.createHash('sha256').update(JSON.stringify({render:job.render_sha256,content:job.render_fingerprint,title:job.yt_title,description:job.description,tags:job.tags,facts:job.facts_evidence,sourceType:job.facts_source_type,scene:job.scene_evidence,payoff:job.scene_payoff,editorialProfile:job.editorial_profile,templateProfile:job.template_profile,editorialPurpose:sceneMeta(job).editorial_purpose||''})).digest('hex');}
export function fileSha256(file){return new Promise((resolve,reject)=>{const hash=crypto.createHash('sha256');const stream=fs.createReadStream(file);stream.on('data',data=>hash.update(data));stream.on('error',reject);stream.on('end',()=>resolve(hash.digest('hex')));});}
export function safeError(error){return String(error?.message||error).replace(/AIza[A-Za-z0-9_-]{25,}/g,'[redacted]').replace(/(Bearer\s+)[A-Za-z0-9_.-]+/gi,'$1[redacted]').replace(/([?&](?:key|token|code|secret|access_token|refresh_token)=)[^&\s]+/gi,'$1[redacted]').slice(0,700);}
export function validatePackage({title,description,tags}){
  if(!String(title||'').trim()||Array.from(String(title)).length>100)throw new Error('YouTube titles must contain 1–100 characters.');
  if(Buffer.byteLength(String(description||''),'utf8')>5000)throw new Error('The YouTube description is too long.');
  const list=Array.isArray(tags)?tags:String(tags||'').split(',').map(x=>x.trim()).filter(Boolean);
  if(list.join(',').length>500)throw new Error('YouTube tags must total at most 500 characters.');
}
export function verifyUploadStatus(status,{publishAt=null,privacy='private'}){
  if(!status?.videoId||['failed','rejected','deleted'].includes(status.uploadStatus)||status.failureReason)throw new Error('YouTube has not accepted this video. Local media is retained.');
  if(!['uploaded','processed'].includes(status.uploadStatus))throw new Error('YouTube upload processing has not been confirmed. Check the existing video again.');
  if(publishAt){
    if(Date.parse(publishAt)>Date.now()){
      if(status.privacy!=='private'||!status.publishAt||Date.parse(status.publishAt)!==Date.parse(publishAt))throw new Error('YouTube did not confirm the exact private publishing schedule. Check the existing video; a second upload is blocked.');
    }else if(status.privacy!=='public')throw new Error('The publishing time passed, but YouTube has not confirmed public release.');
  }else if(status.privacy!==privacy)throw new Error('YouTube privacy does not match the approved upload. Local media is retained.');
  return true;
}
