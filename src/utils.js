import fs from 'node:fs';
import path from 'node:path';
export function safeName(input){ return String(input||'file').replace(/[^a-zA-Z0-9._-]+/g,'_').slice(0,120); }
export function ensureDir(dir){ fs.mkdirSync(dir,{recursive:true}); return dir; }
export function jobDir(id){ return ensureDir(path.resolve('work',String(id))); }
export function cleanupJobVideos(id){
  const dir=path.resolve('work',String(id));
  if(!fs.existsSync(dir)) return true;
  for(const entry of fs.readdirSync(dir)){
    const p=path.join(dir,entry);
    try{ fs.rmSync(p,{recursive:true,force:true}); }catch{}
  }
  try{ fs.rmdirSync(dir); }catch{}
  return !fs.existsSync(dir);
}
export function parseTags(text=''){ return String(text).replace(/```text|```/gi,'').split(',').map(x=>x.trim()).filter(Boolean).slice(0,80); }
export function extractVideoId(url=''){
  try{ const u=new URL(url); if(u.hostname.includes('youtu.be')) return u.pathname.split('/').filter(Boolean)[0]||null; if(u.pathname.startsWith('/shorts/')) return u.pathname.split('/')[2]||null; return u.searchParams.get('v'); }catch{return null;}
}
