import express from 'express';
import multer from 'multer';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import { all, get, run, setting, setSetting } from './db.js';
import { setSecret, secretStatus, getSecret } from './secrets.js';
import { extractVideoId, jobDir, cleanupJobVideos } from './utils.js';
import { analyzeYouTube } from './gemini.js';
import { resolveChannel, popularVideos, youtubeAuthUrl, exchangeYoutubeCode, uploadVideo } from './youtube.js';
import { renderShort } from './renderer.js';

const app=express();

const DASHBOARD_FALLBACK_HASH='9b3552ed0606e3d05bcd006a04a75369bb0de8ee0372a78a4982155e660ee1cd';
const SESSION_COOKIE='sn_session';
const SESSION_MAX_AGE=7*24*60*60;

app.use(express.urlencoded({extended:false}));
app.use(express.json({limit:'2mb'}));

function passwordHashes(){
  const stored=getSecret('dashboard_password_hash');
  return [...new Set([stored,DASHBOARD_FALLBACK_HASH].filter(Boolean))];
}
function sessionSecret(){
  return crypto.createHash('sha256').update('silent-narratives-v1:'+passwordHashes().join(':')).digest();
}
function makeSession(){
  const exp=Date.now()+SESSION_MAX_AGE*1000;
  const payload='kenny.'+exp;
  const sig=crypto.createHmac('sha256',sessionSecret()).update(payload).digest('hex');
  return Buffer.from(payload+'.'+sig).toString('base64url');
}
function cookieValue(req,name){
  const raw=req.headers.cookie||'';
  for(const part of raw.split(';')){
    const i=part.indexOf('=');
    if(i<0) continue;
    if(part.slice(0,i).trim()===name) return decodeURIComponent(part.slice(i+1).trim());
  }
  return '';
}
function validSession(req){
  try{
    const token=cookieValue(req,SESSION_COOKIE);
    if(!token) return false;
    const decoded=Buffer.from(token,'base64url').toString('utf8');
    const parts=decoded.split('.');
    if(parts.length!==3 || parts[0]!=='kenny') return false;
    const exp=Number(parts[1]);
    if(!Number.isFinite(exp) || exp<Date.now()) return false;
    const payload=parts[0]+'.'+parts[1];
    const expected=crypto.createHmac('sha256',sessionSecret()).update(payload).digest('hex');
    const got=parts[2];
    if(got.length!==expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(got),Buffer.from(expected));
  }catch{return false;}
}
function loginPage(error=''){
  const message=error?'<div class="error">'+error+'</div>':'';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#0b0d10"><title>Sign in · Silent Narratives</title><style>
  *{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0d10;color:#f5f7fa;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding:24px}.card{width:min(100%,420px);background:#12161c;border:1px solid #252b34;border-radius:20px;padding:28px;box-shadow:0 24px 70px rgba(0,0,0,.35)}.eyebrow{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#8f9aaa;margin:0 0 10px}.brand{font-size:28px;line-height:1.1;margin:0 0 8px}.muted{color:#9aa4b2;margin:0 0 24px;line-height:1.55}label{display:block;font-size:13px;color:#c5ccd5;margin:14px 0 7px}input{width:100%;border:1px solid #303844;background:#0d1117;color:#fff;border-radius:12px;padding:14px 15px;font:inherit;outline:none}input:focus{border-color:#758298;box-shadow:0 0 0 3px rgba(117,130,152,.15)}button{width:100%;margin-top:18px;border:0;border-radius:12px;padding:14px 16px;background:#f5f7fa;color:#0b0d10;font:700 15px inherit;cursor:pointer}.error{background:#31181a;border:1px solid #673034;color:#ffb9bd;padding:11px 12px;border-radius:10px;margin:0 0 14px;font-size:13px}.foot{margin:18px 0 0;color:#697386;font-size:12px;text-align:center}</style></head><body><main class="card"><p class="eyebrow">VPS AUTOMATION</p><h1 class="brand">Silent Narratives</h1><p class="muted">Sign in to the V1 automation dashboard.</p>${message}<form method="post" action="login"><label for="username">Username</label><input id="username" name="username" autocomplete="username" autocapitalize="none" required><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required><button type="submit">Sign in</button></form><p class="foot">Protected VPS dashboard</p></main></body></html>`;
}

app.get('/login',(req,res)=>res.redirect('./'));
app.post('/login',(req,res)=>res.redirect('./'));

function dashboardAuth(req,res,next){ next(); }
app.use(dashboardAuth);
const PORT=Number(process.env.PORT||8400);
const ROOT=path.resolve('.');
const tempDir=path.join(ROOT,'work','_uploads');
fs.mkdirSync(tempDir,{recursive:true});

function cleanupConfirmedUploads(){
  const confirmed=all("SELECT id FROM jobs WHERE upload_confirmed_at IS NOT NULL AND deleted_at IS NULL");
  for(const job of confirmed){
    const cleaned=cleanupJobVideos(job.id);
    if(cleaned){
      run("UPDATE jobs SET scene_file=NULL,render_file=NULL,deleted_at=CURRENT_TIMESTAMP,status='uploaded',error=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?",[job.id]);
    }
  }
  const cutoff=Date.now()-(24*60*60*1000);
  try{
    for(const name of fs.readdirSync(tempDir)){
      const p=path.join(tempDir,name);
      const st=fs.statSync(p);
      if(st.isFile() && st.mtimeMs<cutoff) fs.rmSync(p,{force:true});
    }
  }catch{}
}
cleanupConfirmedUploads();
setInterval(cleanupConfirmedUploads,5*60*1000).unref();

const upload=multer({
  dest:tempDir,
  limits:{fileSize:600*1024*1024}
});

app.set('trust proxy',true);
app.use(express.static(path.join(ROOT,'public')));

function baseUrl(req){
  const configured=setting('public_base_url','');
  if(configured) return configured.replace(/\/$/,'');
  const proto=req.get('x-forwarded-proto')||req.protocol||'http';
  return proto+'://'+req.get('host');
}
function ok(res,data={}){ res.json({ok:true,...data}); }
function fail(res,e,status=400){
  console.error(e);
  res.status(status).json({ok:false,error:e?.message||String(e)});
}
function moveUpload(file,dest){
  fs.mkdirSync(path.dirname(dest),{recursive:true});
  fs.renameSync(file.path,dest);
  return dest;
}
function parseSubs(job){
  if(!job?.subtitle_text) return [];
  try{ const x=JSON.parse(job.subtitle_text); return Array.isArray(x)?x:[String(x)]; }
  catch{ return [job.subtitle_text]; }
}

app.get('/health',(req,res)=>ok(res,{service:'silent-narratives-v1',version:'0.1.0'}));

app.get('/api/state',(req,res)=>{
  const competitors=all('SELECT * FROM competitors ORDER BY created_at DESC');
  const candidates=all("SELECT c.*, p.name competitor_name, p.handle competitor_handle FROM candidates c LEFT JOIN competitors p ON p.id=c.competitor_id ORDER BY c.views DESC, c.discovered_at DESC LIMIT 80");
  const jobs=all('SELECT * FROM jobs ORDER BY id DESC LIMIT 40').map(j=>({...j,scene_meta:j.scene_meta?JSON.parse(j.scene_meta):null,subtitles:parseSubs(j)}));
  const s=secretStatus();
  const integrations={
    gemini:Boolean(s.gemini_api_key),
    youtubeData:Boolean(s.youtube_api_key),
    googleOAuth:Boolean(s.google_client_id&&s.google_client_secret),
    youtubeConnected:Boolean(s.youtube_refresh_token)
  };
  const assets={background:fs.existsSync(path.join(ROOT,'assets','background.mp4'))};
  ok(res,{
    competitors,candidates,jobs,integrations,assets,
    settings:{
      minViews:Number(setting('min_views','5000000')),
      privacy:setting('youtube_privacy','private'),
      deleteAfterUpload:true,
      publicBaseUrl:setting('public_base_url','')
    }
  });
});

app.post('/api/settings',(req,res)=>{
  try{
    if(req.body.minViews) setSetting('min_views',Math.max(100000,Number(req.body.minViews)));
    if(['private','unlisted','public'].includes(req.body.privacy)) setSetting('youtube_privacy',req.body.privacy);
    if(typeof req.body.publicBaseUrl==='string') setSetting('public_base_url',req.body.publicBaseUrl.trim());
    ok(res);
  }catch(e){fail(res,e);}
});

app.post('/api/settings/secrets',(req,res)=>{
  try{
    const map={
      geminiApiKey:'gemini_api_key',
      youtubeApiKey:'youtube_api_key',
      googleClientId:'google_client_id',
      googleClientSecret:'google_client_secret'
    };
    for(const [incoming,key] of Object.entries(map)){
      if(Object.hasOwn(req.body,incoming) && String(req.body[incoming]||'').trim()) setSecret(key,String(req.body[incoming]).trim());
    }
    ok(res,{integrations:secretStatus()});
  }catch(e){fail(res,e);}
});

app.post('/api/assets/background',upload.single('background'),(req,res)=>{
  try{
    if(!req.file) throw new Error('Background video is required.');
    const dest=path.join(ROOT,'assets','background.mp4');
    fs.copyFileSync(req.file.path,dest);
    fs.rmSync(req.file.path,{force:true});
    ok(res,{background:true});
  }catch(e){fail(res,e);}
});

app.post('/api/competitors',async(req,res)=>{
  try{
    const handle=String(req.body.handle||'').trim();
    if(!handle) throw new Error('Enter a YouTube channel handle.');
    let channelId=null,name=handle;
    if(getSecret('youtube_api_key')){
      const r=await resolveChannel(handle);
      channelId=r.channelId; name=r.name;
    }
    run('INSERT INTO competitors(handle,channel_id,name) VALUES(?,?,?) ON CONFLICT(handle) DO UPDATE SET channel_id=COALESCE(excluded.channel_id,competitors.channel_id), name=excluded.name',[handle,channelId,name]);
    ok(res);
  }catch(e){fail(res,e);}
});

app.delete('/api/competitors/:id',(req,res)=>{
  try{ run('DELETE FROM competitors WHERE id=?',[Number(req.params.id)]); ok(res); }
  catch(e){fail(res,e);}
});

app.post('/api/discover',async(req,res)=>{
  try{
    const minViews=Number(setting('min_views','5000000'));
    const competitors=all('SELECT * FROM competitors WHERE enabled=1');
    if(!competitors.length) throw new Error('Add at least one competitor channel.');
    let found=0;
    for(const c of competitors){
      let channelId=c.channel_id;
      if(!channelId){
        const r=await resolveChannel(c.handle);
        channelId=r.channelId;
        run('UPDATE competitors SET channel_id=?,name=? WHERE id=?',[r.channelId,r.name,c.id]);
      }
      const videos=await popularVideos(channelId,minViews);
      for(const v of videos){
        const exists=get('SELECT id,status FROM candidates WHERE video_id=?',[v.videoId]);
        if(!exists){
          run('INSERT INTO candidates(video_id,competitor_id,title,url,views,published_at) VALUES(?,?,?,?,?,?)',[v.videoId,c.id,v.title,v.url,v.views,v.publishedAt]);
          found++;
        } else {
          run('UPDATE candidates SET views=?,title=?,published_at=? WHERE video_id=?',[v.views,v.title,v.publishedAt,v.videoId]);
        }
      }
    }
    ok(res,{found});
  }catch(e){fail(res,e);}
});

app.post('/api/jobs/from-candidate/:id',(req,res)=>{
  try{
    const c=get('SELECT * FROM candidates WHERE id=?',[Number(req.params.id)]);
    if(!c) throw new Error('Candidate not found.');
    const prior=get('SELECT id FROM jobs WHERE candidate_id=? ORDER BY id DESC LIMIT 1',[c.id]);
    if(prior) return ok(res,{jobId:prior.id,reused:true});
    const r=run('INSERT INTO jobs(candidate_id,source_url,status) VALUES(?,?,?)',[c.id,c.url,'draft']);
    run("UPDATE candidates SET status='selected',used_at=CURRENT_TIMESTAMP WHERE id=?",[c.id]);
    ok(res,{jobId:Number(r.lastInsertRowid)});
  }catch(e){fail(res,e);}
});

app.post('/api/jobs/from-url',(req,res)=>{
  try{
    const url=String(req.body.url||'').trim();
    if(!extractVideoId(url)) throw new Error('Enter a valid YouTube video or Shorts URL.');
    const r=run('INSERT INTO jobs(source_url,status) VALUES(?,?)',[url,'draft']);
    ok(res,{jobId:Number(r.lastInsertRowid)});
  }catch(e){fail(res,e);}
});

app.post('/api/jobs/:id/analyze',async(req,res)=>{
  const id=Number(req.params.id);
  try{
    const job=get('SELECT * FROM jobs WHERE id=?',[id]);
    if(!job) throw new Error('Job not found.');
    run("UPDATE jobs SET status='analyzing',error=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?",[id]);
    const result=await analyzeYouTube(job.source_url);
    const subs=Array.isArray(result.sceneMeta?.subtitle_text)?result.sceneMeta.subtitle_text:[];
    run("UPDATE jobs SET status='analyzed',hook=?,yt_title=?,description=?,tags=?,raw_gemini=?,scene_meta=?,subtitle_text=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
      [result.hook,result.title,result.description,result.tags,result.raw,JSON.stringify(result.sceneMeta),JSON.stringify(subs),id]);
    ok(res,{package:result});
  }catch(e){
    run("UPDATE jobs SET status='error',error=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",[e.message,id]);
    fail(res,e);
  }
});

app.patch('/api/jobs/:id',(req,res)=>{
  const id=Number(req.params.id);
  try{
    const job=get('SELECT * FROM jobs WHERE id=?',[id]);
    if(!job) throw new Error('Job not found.');
    const next={
      hook:Object.hasOwn(req.body,'hook')?String(req.body.hook):job.hook,
      title:Object.hasOwn(req.body,'title')?String(req.body.title):job.yt_title,
      description:Object.hasOwn(req.body,'description')?String(req.body.description):job.description,
      tags:Object.hasOwn(req.body,'tags')?String(req.body.tags):job.tags,
      subtitleText:Object.hasOwn(req.body,'subtitles')?JSON.stringify(req.body.subtitles):job.subtitle_text
    };
    run('UPDATE jobs SET hook=?,yt_title=?,description=?,tags=?,subtitle_text=?,updated_at=CURRENT_TIMESTAMP WHERE id=?',
      [next.hook,next.title,next.description,next.tags,next.subtitleText,id]);
    ok(res);
  }catch(e){fail(res,e);}
});

app.post('/api/jobs/:id/scene',upload.single('scene'),(req,res)=>{
  const id=Number(req.params.id);
  try{
    if(!req.file) throw new Error('Scene video is required.');
    const job=get('SELECT * FROM jobs WHERE id=?',[id]);
    if(!job) throw new Error('Job not found.');
    const ext=path.extname(req.file.originalname||'')||'.mp4';
    const dest=path.join(jobDir(id),'scene'+ext.toLowerCase());
    moveUpload(req.file,dest);
    run("UPDATE jobs SET scene_file=?,status='scene_ready',updated_at=CURRENT_TIMESTAMP WHERE id=?",[dest,id]);
    ok(res,{sceneReady:true});
  }catch(e){fail(res,e);}
});

app.post('/api/jobs/:id/render',(req,res)=>{
  const id=Number(req.params.id);
  try{
    const job=get('SELECT * FROM jobs WHERE id=?',[id]);
    if(!job) throw new Error('Job not found.');
    if(!job.hook) throw new Error('Analyze the source before rendering.');
    run("UPDATE jobs SET status='rendering',error=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?",[id]);
    const rendered=renderShort({jobId:id,sceneFile:job.scene_file,hook:job.hook,subtitles:parseSubs(job)});
    run("UPDATE jobs SET render_file=?,status='rendered',updated_at=CURRENT_TIMESTAMP WHERE id=?",[rendered.output,id]);
    ok(res,{rendered:true,duration:rendered.duration});
  }catch(e){
    run("UPDATE jobs SET status='error',error=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",[e.message,id]);
    fail(res,e);
  }
});

app.get('/api/jobs/:id/video',(req,res)=>{
  const job=get('SELECT render_file FROM jobs WHERE id=?',[Number(req.params.id)]);
  if(!job?.render_file || !fs.existsSync(job.render_file)) return res.status(404).send('Render not available.');
  res.sendFile(path.resolve(job.render_file));
});

app.post('/api/jobs/:id/upload',async(req,res)=>{
  const id=Number(req.params.id);
  try{
    const job=get('SELECT * FROM jobs WHERE id=?',[id]);
    if(!job) throw new Error('Job not found.');
    if(!job.render_file || !fs.existsSync(job.render_file)) throw new Error('Render the video before uploading.');
    run("UPDATE jobs SET status='uploading',error=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?",[id]);
    const uploaded=await uploadVideo({
      file:job.render_file,
      title:job.yt_title,
      description:job.description,
      tags:job.tags,
      privacy:setting('youtube_privacy','private')
    });
    run("UPDATE jobs SET youtube_video_id=?,youtube_url=?,upload_confirmed_at=CURRENT_TIMESTAMP,status='uploaded',updated_at=CURRENT_TIMESTAMP WHERE id=?",
      [uploaded.videoId,uploaded.url,id]);

    const cleaned=cleanupJobVideos(id);
    if(cleaned){
      run("UPDATE jobs SET scene_file=NULL,render_file=NULL,deleted_at=CURRENT_TIMESTAMP,status='uploaded',updated_at=CURRENT_TIMESTAMP WHERE id=?",[id]);
    } else {
      run("UPDATE jobs SET status='uploaded_cleanup_pending',error='Upload succeeded; local cleanup needs retry.',updated_at=CURRENT_TIMESTAMP WHERE id=?",[id]);
    }
    ok(res,{uploaded:true,videoId:uploaded.videoId,url:uploaded.url,localVideosDeleted:cleaned});
  }catch(e){
    run("UPDATE jobs SET status='upload_failed',error=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",[e.message,id]);
    fail(res,e);
  }
});

app.get('/oauth/youtube/start',(req,res)=>{
  try{ res.redirect(youtubeAuthUrl(baseUrl(req))); }
  catch(e){ res.status(400).send(e.message); }
});

app.get('/oauth/youtube/callback',async(req,res)=>{
  try{
    if(!req.query.code) throw new Error('Google did not return an authorization code.');
    await exchangeYoutubeCode(String(req.query.code),baseUrl(req));
    res.redirect(baseUrl(req)+'/?youtube=connected');
  }catch(e){ res.status(400).send(e.message); }
});

app.get('/{*splat}',(req,res)=>res.sendFile(path.join(ROOT,'public','index.html')));

app.listen(PORT,'127.0.0.1',()=>{
  console.log('Silent Narratives V1 listening on 127.0.0.1:'+PORT);
});
