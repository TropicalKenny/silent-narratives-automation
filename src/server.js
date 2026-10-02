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

function dashboardAuth(req,res,next){
  if(req.path==='/health') return next();
  const passwordHash=getSecret('dashboard_password_hash');
  if(!passwordHash) return next();
  const header=req.headers.authorization||'';
  if(!header.startsWith('Basic ')){
    res.set('WWW-Authenticate','Basic realm="Silent Narratives V1"');
    return res.status(401).send('Authentication required.');
  }
  let decoded='';
  try{ decoded=Buffer.from(header.slice(6),'base64').toString('utf8'); }catch{}
  const split=decoded.indexOf(':');
  const user=split>=0?decoded.slice(0,split):'';
  const pass=split>=0?decoded.slice(split+1):'';
  const passHash=crypto.createHash('sha256').update(pass).digest('hex');
  if(user!=='kenny' || passHash!==passwordHash){
    res.set('WWW-Authenticate','Basic realm="Silent Narratives V1"');
    return res.status(401).send('Invalid credentials.');
  }
  next();
}
app.use(dashboardAuth);
const PORT=Number(process.env.PORT||8400);
const ROOT=path.resolve('.');
const tempDir=path.join(ROOT,'work','_uploads');
fs.mkdirSync(tempDir,{recursive:true});

const upload=multer({
  dest:tempDir,
  limits:{fileSize:600*1024*1024}
});

app.set('trust proxy',true);
app.use(express.json({limit:'2mb'}));
app.use(express.urlencoded({extended:true}));
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
    res.redirect('/?youtube=connected');
  }catch(e){ res.status(400).send(e.message); }
});

app.get('/{*splat}',(req,res)=>res.sendFile(path.join(ROOT,'public','index.html')));

app.listen(PORT,'127.0.0.1',()=>{
  console.log('Silent Narratives V1 listening on 127.0.0.1:'+PORT);
});
