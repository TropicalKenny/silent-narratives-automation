import express from 'express';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import { all, get, run, setting, setSetting } from './db.js';
import { setSecrets, secretStatus, getSecret, setSecret } from './secrets.js';
import { jobDir, cleanupJobVideos } from './utils.js';
import { analyzeYouTube, buildEditorialCaptionPlan } from './gemini.js';
import { resolveChannel, popularVideos, ownChannelVideos, youtubeAuthUrl, exchangeYoutubeCode, uploadVideo, videoStatus, videoMetrics, publicVideoDetails } from './youtube.js';
import { renderShort, TEMPLATE_PROFILE } from './renderer.js';
import { screenCandidatesAgainstHistory } from './duplicates.js';
import { installSecurity } from './security.js';
import {editorialSummary,validateCompactHook,verifyFactsEvidence,verifyEditorialReview} from './editorial.js';
import {videoAnalytics,videoRetention,ANALYTICS_ENABLE_URL} from './analytics.js';
import { validDate, validSlots, canonicalSource, sceneMeta, renderFingerprint, approvalFingerprint, fileSha256, safeError, validatePackage, verifyUploadStatus } from './workflow.js';

export const app=express();
const PORT=Number(process.env.PORT||8400),ROOT=path.resolve('.');
const tempDir=path.join(ROOT,'work','_uploads');
fs.mkdirSync(tempDir,{recursive:true,mode:0o700});
app.disable('x-powered-by');
app.set('trust proxy','loopback');
app.use(express.json({limit:'2mb'}));
function baseUrl(req){return (setting('public_base_url','')||req.protocol+'://'+req.get('host')).replace(/\/$/,'');}
app.use((req,res,next)=>{
  const configured=setting('public_base_url','');
  const directLocal=['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress)&&['127.0.0.1','localhost','[::1]'].includes(String(req.get('host')||'').replace(/:[0-9]+$/,''))&&!['x-forwarded-for','x-forwarded-host','x-forwarded-proto'].some(name=>req.headers[name]);
  if(configured&&!directLocal&&req.get('host')!==new URL(configured).host)return res.redirect(307,configured.replace(/\/$/,'')+req.originalUrl);
  next();
});
const security=installSecurity(app,{getSecret,setSecret,baseUrl,port:PORT});
app.use('/api',(req,res,next)=>{res.setHeader('Cache-Control','no-store');next();});
app.use(express.static(path.join(ROOT,'public'),{maxAge:0}));
const upload=multer({dest:tempDir,limits:{fileSize:600*1024*1024}});
function oauthBaseUrl(req){return (setting('oauth_callback_base_url','')||baseUrl(req)).replace(/\/$/,'');}
function ok(res,data={}){res.json({ok:true,...data});}
function fail(res,error,status=400){const message=safeError(error);console.error(JSON.stringify({event:'request_error',message}));res.status(status).json({ok:false,error:message});}
function event(id,name,detail=''){run('INSERT INTO job_events(job_id,event,detail) VALUES(?,?,?)',[id,name,safeError(detail)]);}
const tasks=new Map();
function background(handler){return (req,res)=>{
  if(req.get('prefer')!=='respond-async')return handler(req,res);
  if([...tasks.values()].filter(x=>x.state==='running').length>=8)return fail(res,new Error('Several operations are already running. Try again shortly.'),429);
  const taskId=crypto.randomUUID(),task={id:taskId,jobId:Number(req.params.id)||null,state:'running',startedAt:Date.now(),result:null};tasks.set(taskId,task);
  const response={code:200,status(code){this.code=code;return this;},json(data){task.state=this.code>=400||data.ok===false?'failed':'done';task.result=data;return this;}};
  Promise.resolve(handler(req,response)).then(()=>{if(task.state==='running'){task.state='failed';task.result={ok:false,error:'Operation ended without a result. Review the job before retrying.'};}}).catch(error=>{task.state='failed';task.result={ok:false,error:safeError(error)};});
  res.status(202).json({ok:true,accepted:true,taskId,jobId:task.jobId});
};}
function postTask(route,handler){app.post(route,background(handler));}
app.get('/api/tasks/:id',(req,res)=>{const task=tasks.get(req.params.id);if(!task)return fail(res,new Error('The service restarted or this operation expired. Refresh the queue and check the existing job before retrying.'),404);ok(res,{state:task.state,jobId:task.jobId,result:task.result});});
setInterval(()=>{for(const [id,task] of tasks)if(task.state!=='running'&&Date.now()-task.startedAt>3600000)tasks.delete(id);},300000).unref();
function findJob(id){const job=get('SELECT * FROM jobs WHERE id=?',[id]);if(!job)throw new Error('Job not found.');return job;}
function parseSubs(job){try{const x=JSON.parse(job.subtitle_text||'[]');return Array.isArray(x)?x:[];}catch{return [];}}
const locked=new Set();let renderBusy=false,collecting=false,screening=false;
function claim(id){if(locked.has(id))throw new Error('This job is already running. Wait for the current operation.');locked.add(id);}
function release(id){locked.delete(id);run('UPDATE jobs SET operation_started_at=NULL WHERE id=?',[id]);}
function mutable(job){if(locked.has(job.id))throw new Error('This job is already running.');if(job.status==='rejected')throw new Error('This story was rejected and cannot continue.');if(job.youtube_video_id||job.upload_session_url||job.upload_confirmed_at)throw new Error('This job has an existing YouTube upload. Reconcile it before making changes.');}
const TIMEZONE='Africa/Lagos',DEFAULT_SLOTS=['22:00'];
function publishingSlots(){try{const x=JSON.parse(setting('publishing_slots','[]'));if(validSlots(x))return [...x].sort();}catch{}return DEFAULT_SLOTS;}
function activeBatchDate(){return setting('batch_active_date','');}
function lagosDate(){return new Intl.DateTimeFormat('en-CA',{timeZone:TIMEZONE,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
function requireActiveBatch(job=null){const date=activeBatchDate();if(!date||setting('production_mode','manual_batch')!=='manual_batch')throw new Error('Production is paused. Start a daily batch first.');if(job&&job.slot_date!==date)throw new Error('Assign this job to the active batch before continuing.');return date;}
function slotIso(date,time){if(!validDate(date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw new Error('Invalid publishing date or time.');return new Date(date+'T'+time+':00+01:00').toISOString();}
function slotOccupied(date,time,ignore=0){return Boolean(get("SELECT id FROM jobs WHERE slot_date=? AND slot_time=? AND id!=? AND status!='rejected'",[date,time,ignore]));}
function nextSlot(){const date=requireActiveBatch();for(const time of publishingSlots()){const publishAt=slotIso(date,time);if(Date.parse(publishAt)>Date.now()+300000&&!slotOccupied(date,time))return {date,time,publishAt,timezone:TIMEZONE};}throw new Error('All future slots in this batch are reserved. Failed jobs keep their slots for retry.');}
function productionJob(id){const job=findJob(id);mutable(job);requireActiveBatch(job);return job;}
function pauseCompletedBatch(){const date=activeBatchDate(),limit=publishingSlots().length;if(date&&Number(get("SELECT COUNT(*) n FROM jobs WHERE slot_date=? AND upload_confirmed_at IS NOT NULL AND status!='rejected'",[date]).n)>=limit)setSetting('batch_active_date','');}
function cleanupConfirmedUploads(){
  for(const job of all('SELECT * FROM jobs WHERE upload_confirmed_at IS NOT NULL AND deleted_at IS NULL')){
    if(cleanupJobVideos(job.id)){
      const status=job.status.startsWith('published')?'published':job.youtube_publish_at?'scheduled':'uploaded';
      run('UPDATE jobs SET scene_file=NULL,render_file=NULL,preview_file=NULL,upload_session_url=NULL,deleted_at=CURRENT_TIMESTAMP,status=?,error=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?',[status,job.id]);event(job.id,'media_deleted');
    }
  }
  for(const name of fs.readdirSync(tempDir)){const file=path.join(tempDir,name);try{if(fs.statSync(file).mtimeMs<Date.now()-86400000)fs.rmSync(file,{force:true});}catch{}}
}
function duplicateHistory(){
  const history=all('SELECT video_id,title,description FROM channel_history');
  for(const job of all("SELECT * FROM jobs WHERE status!='rejected'")){
    const source=get('SELECT title FROM candidates WHERE id=?',[job.candidate_id]);
    const id=job.youtube_video_id||'pending-job-'+job.id;
    if(!history.some(x=>x.video_id===id))history.push({video_id:id,title:job.yt_title||source?.title||job.hook||job.source_url,description:job.hook||job.description||''});
  }
  return history;
}
async function screenAndPersistCandidates(rows=null){
  if(screening)throw new Error('Duplicate screening is already running.');screening=true;
  try{
    const candidates=rows||all("SELECT * FROM candidates WHERE status='new' AND screened_at IS NULL ORDER BY views DESC LIMIT 80");
    if(!candidates.length)return {checked:0,duplicates:0,review:0};
    const result=await screenCandidatesAgainstHistory(candidates,duplicateHistory());
    for(const [list,status] of [[result.duplicates,'duplicate'],[result.review,'review_needed'],[result.safe,'new']])for(const item of list){const candidate=item.candidate||item;run('UPDATE candidates SET status=?,duplicate_of_video_id=?,duplicate_reason=?,screened_at=CURRENT_TIMESTAMP WHERE id=?',[status,item.published?.video_id||null,item.reason||null,candidate.id]);}
    return {checked:candidates.length,duplicates:result.duplicates.length,review:result.review.length};
  }finally{screening=false;}
}
function createFromCandidate(candidate){
  if(candidate.status!=='new'||!candidate.screened_at)throw new Error('This source needs a successful duplicate check before use.');
  if(get('SELECT id FROM jobs WHERE candidate_id=?',[candidate.id]))throw new Error('This source already has a production job.');
  const slot=nextSlot(),r=run('INSERT INTO jobs(candidate_id,source_url,status,slot_date,slot_time,scheduled_publish_at) VALUES(?,?,?,?,?,?)',[candidate.id,candidate.url,'draft',slot.date,slot.time,slot.publishAt]);
  const id=Number(r.lastInsertRowid);run("UPDATE candidates SET status='selected',used_at=CURRENT_TIMESTAMP WHERE id=?",[candidate.id]);
  run("UPDATE candidates SET screened_at=NULL WHERE status='new'");event(id,'created',candidate.title||'Direct source');return {jobId:id,slot};
}
const CHECKPOINTS=[['1h',1],['6h',6],['24h',24],['48h',48],['7d',168]];
function seedCheckpoints(job){if(!job.youtube_publish_at)return;for(const [checkpoint,hours] of CHECKPOINTS)run('INSERT INTO performance_snapshots(job_id,video_id,checkpoint,target_at) VALUES(?,?,?,?) ON CONFLICT(job_id,checkpoint) DO NOTHING',[job.id,job.youtube_video_id,checkpoint,new Date(Date.parse(job.youtube_publish_at)+hours*3600000).toISOString()]);}
async function collectDuePerformanceSnapshots(){
  if(collecting)return {busy:true,due:0,captured:0};collecting=true;
  try{
    const due=all("SELECT * FROM performance_snapshots WHERE captured_at IS NULL AND datetime(target_at)<=datetime('now') AND (next_retry_at IS NULL OR datetime(next_retry_at)<=datetime('now')) ORDER BY target_at LIMIT 12");let captured=0;
    for(const row of due)try{
      const metrics=await videoMetrics(row.video_id);
      run('UPDATE performance_snapshots SET captured_at=CURRENT_TIMESTAMP,views=?,likes=?,comments=?,privacy=?,published_at=?,error=NULL,next_retry_at=NULL WHERE id=?',[metrics.views,metrics.likes,metrics.comments,metrics.privacy,metrics.publishedAt,row.id]);captured++;
      if(metrics.privacy==='public')run("UPDATE jobs SET status=CASE WHEN deleted_at IS NULL THEN 'published_cleanup_pending' ELSE 'published' END,updated_at=CURRENT_TIMESTAMP WHERE id=? AND upload_confirmed_at IS NOT NULL",[row.job_id]);
    }catch(error){const attempts=row.attempts+1;run('UPDATE performance_snapshots SET error=?,attempts=?,next_retry_at=? WHERE id=?',[safeError(error),attempts,new Date(Date.now()+Math.min(360,15*2**Math.min(attempts-1,5))*60000).toISOString(),row.id]);}
    return {due:due.length,captured};
  }finally{collecting=false;}
}
function performanceSummary(){
  const checkpoints=all('SELECT p.*,j.slot_date,j.slot_time,j.youtube_url,j.yt_title FROM performance_snapshots p JOIN jobs j ON j.id=p.job_id ORDER BY p.target_at DESC LIMIT 200').map(row=>({...row,lateMinutes:row.captured_at?Math.max(0,(Date.parse(row.captured_at+'Z')-Date.parse(row.target_at))/60000):null}));
  const eligible=all("SELECT p.*,j.slot_time,j.hook_profile,j.template_profile FROM performance_snapshots p JOIN jobs j ON j.id=p.job_id WHERE p.privacy='public' AND p.views IS NOT NULL AND j.slot_time IS NOT NULL AND p.captured_at IS NOT NULL AND (julianday(p.captured_at)-julianday(p.target_at))*1440 BETWEEN 0 AND 30");
  const profiles=[];for(const [checkpoint] of CHECKPOINTS)for(const profile of ['compact_v1','legacy']){const rows=eligible.filter(x=>x.checkpoint===checkpoint&&((x.hook_profile||'legacy')===profile)),values=rows.map(x=>x.views).sort((a,b)=>a-b);profiles.push({profile,checkpoint,samples:values.length,medianViews:values.length?(values[Math.floor((values.length-1)/2)]+values[Math.ceil((values.length-1)/2)])/2:null});}
  const templates=[];for(const [checkpoint] of CHECKPOINTS)for(const profile of ['scene_first_v2','legacy_card_v1']){const rows=eligible.filter(x=>x.checkpoint===checkpoint&&((x.template_profile||'legacy_card_v1')===profile)),values=rows.map(x=>x.views).sort((a,b)=>a-b);templates.push({profile,checkpoint,samples:values.length,medianViews:values.length?(values[Math.floor((values.length-1)/2)]+values[Math.ceil((values.length-1)/2)])/2:null});}
  const slots=[];for(const time of publishingSlots())for(const [checkpoint] of CHECKPOINTS){const rows=eligible.filter(x=>x.slot_time===time&&x.checkpoint===checkpoint),values=rows.map(x=>x.views).sort((a,b)=>a-b);slots.push({slot_time:time,checkpoint,samples:values.length,median_views:values.length?(values[Math.floor((values.length-1)/2)]+values[Math.ceil((values.length-1)/2)])/2:null});}
  return {checkpoints,slots,profiles,templates,toleranceMinutes:30};
}
let analyticsBusy=false;
function analyticsSummary(){return {status:setting('analytics_status','not_connected'),message:setting('analytics_message','Enable the Analytics API and connect read-only reporting access.'),enableUrl:ANALYTICS_ENABLE_URL,lastSync:setting('analytics_last_sync',''),rangeStart:setting('analytics_range_start',''),rangeEnd:setting('analytics_range_end',''),busy:analyticsBusy,rows:all("SELECT a.*,h.title,h.published_at FROM video_analytics a JOIN channel_history h ON h.video_id=a.video_id WHERE h.privacy='public' ORDER BY h.published_at DESC").map(row=>({...row,retention_curve:row.retention_curve?JSON.parse(row.retention_curve):null}))};}
function recoverySummary(){let status={};try{status=JSON.parse(fs.readFileSync(path.join(ROOT,'data/backup-status.json'),'utf8'));}catch{}return {lastBackup:status.lastBackup||null,encrypted:Boolean(status.encrypted),offVps:status.offVps||'not_configured',lastOffVps:status.lastOffVps||null,message:status.message||'Daily backups are configured. Connect Drive for automatic external delivery.'};}
async function collectAnalytics(){if(analyticsBusy)return {busy:true};analyticsBusy=true;try{const ids=all("SELECT video_id FROM channel_history WHERE privacy='public' ORDER BY published_at DESC LIMIT 200").map(x=>x.video_id);const result=await videoAnalytics(ids);for(const row of result.rows)run('INSERT INTO video_analytics(video_id,range_start,range_end,collected_at,views,engaged_views,average_view_duration,average_view_percentage) VALUES(?,?,?,CURRENT_TIMESTAMP,?,?,?,?) ON CONFLICT(video_id) DO UPDATE SET range_start=excluded.range_start,range_end=excluded.range_end,collected_at=excluded.collected_at,views=excluded.views,engaged_views=excluded.engaged_views,average_view_duration=excluded.average_view_duration,average_view_percentage=excluded.average_view_percentage,retention_curve=CASE WHEN video_analytics.range_start=excluded.range_start AND video_analytics.range_end=excluded.range_end THEN video_analytics.retention_curve ELSE NULL END',[row.videoId,result.window.startDate,result.window.endDate,row.views,row.engagedViews,row.averageViewDuration,row.averageViewPercentage]);if(result.rows.length){const placeholders=result.rows.map(()=>'?').join(',');run('DELETE FROM video_analytics WHERE video_id NOT IN ('+placeholders+')',result.rows.map(x=>x.videoId));}else run('DELETE FROM video_analytics');for(const [key,value] of Object.entries({analytics_status:'ready',analytics_message:result.rows.length?'YouTube Analytics reporting is connected.':'No processed Analytics rows in this reporting window.',analytics_last_sync:new Date().toISOString(),analytics_range_start:result.window.startDate,analytics_range_end:result.window.endDate}))setSetting(key,value);return {captured:result.rows.length};}catch(error){setSetting('analytics_status',error.reason||'temporary_error');setSetting('analytics_message',safeError(error));throw error;}finally{analyticsBusy=false;}}
let backupBusy=false;
postTask('/api/backups/run',async(req,res)=>{if(backupBusy)return fail(res,new Error('A backup is already running.'),429);backupBusy=true;try{await new Promise((resolve,reject)=>{const child=spawn('/usr/bin/python3',['ops/backup.py'],{cwd:ROOT,stdio:['ignore','ignore','pipe']});let errors='';const timer=setTimeout(()=>{child.kill('SIGTERM');reject(new Error('Backup exceeded the time limit. Check its status before retrying.'));},900000);child.stderr.on('data',chunk=>{errors=(errors+chunk).slice(-3000);});child.once('error',error=>{clearTimeout(timer);reject(error);});child.once('close',code=>{clearTimeout(timer);if(code===0)resolve();else reject(new Error('Backup could not complete. Check the saved recovery status and VPS service log.'));});});ok(res,{recovery:recoverySummary()});}catch(error){fail(res,error);}finally{backupBusy=false;}});
postTask('/api/analytics/sync',async(req,res)=>{try{ok(res,await collectAnalytics());}catch(error){fail(res,error);}});
postTask('/api/analytics/:id/retention',async(req,res)=>{try{const id=String(req.params.id);if(!get("SELECT video_id FROM channel_history WHERE video_id=? AND privacy='public'",[id]))throw new Error('Choose a public video from this channel.');const result=await videoRetention(id),row=get('SELECT * FROM video_analytics WHERE video_id=?',[id]);if(row&&row.range_start===result.window.startDate&&row.range_end===result.window.endDate)run('UPDATE video_analytics SET retention_curve=?,retention_collected_at=CURRENT_TIMESTAMP WHERE video_id=?',[JSON.stringify(result.points),id]);ok(res,{points:result.points,window:result.window});}catch(error){fail(res,error);}});
app.get('/health',(req,res)=>{try{get('SELECT 1');ok(res,{service:'silent-narratives-v1',version:'0.7.0',database:'ok',renderBusy,collecting});}catch(error){fail(res,error,503);}});
app.get('/api/state',(req,res)=>{
  try{
    const s=secretStatus();const jobs=all('SELECT * FROM jobs ORDER BY id DESC LIMIT 60').map(job=>{const {upload_session_url,raw_gemini,...safe}=job;return {...safe,uploadInProgress:Boolean(upload_session_url),scene_meta:sceneMeta(job),render_meta:job.render_meta?JSON.parse(job.render_meta):null,subtitles:parseSubs(job),editorial:editorialSummary(job),busy:locked.has(job.id)};});
    ok(res,{competitors:all('SELECT * FROM competitors ORDER BY created_at DESC'),candidates:all("SELECT c.*,p.name competitor_name,p.handle competitor_handle FROM candidates c LEFT JOIN competitors p ON p.id=c.competitor_id WHERE c.status='new' AND c.screened_at IS NOT NULL ORDER BY c.views DESC LIMIT 80"),jobs,
      history:{count:Number(get('SELECT COUNT(*) n FROM channel_history').n),lastSync:setting('history_last_sync',''),recent:all('SELECT video_id,title,published_at,views,privacy FROM channel_history ORDER BY published_at DESC LIMIT 8'),duplicateBlocked:Number(get("SELECT COUNT(*) n FROM candidates WHERE status='duplicate'").n),reviewBlocked:Number(get("SELECT COUNT(*) n FROM candidates WHERE status='review_needed'").n),unscreened:Number(get("SELECT COUNT(*) n FROM candidates WHERE status='new' AND screened_at IS NULL").n),channel:{title:setting('own_channel_title','Silent Narratives'),thumbnail:setting('own_channel_thumbnail',''),subscribers:Number(setting('own_channel_subscribers','0')),totalViews:Number(setting('own_channel_views','0'))}},
      integrations:{gemini:Boolean(s.gemini_api_key),youtubeData:Boolean(s.youtube_api_key),googleOAuth:Boolean(s.google_client_id&&s.google_client_secret),youtubeConnected:Boolean(s.youtube_refresh_token)},assets:{background:fs.existsSync(path.join(ROOT,'assets','background.mp4'))},performance:performanceSummary(),analytics:analyticsSummary(),recovery:recoverySummary(),
      settings:{minViews:Number(setting('min_views','5000000')),privacy:setting('youtube_privacy','private'),deleteAfterUpload:true,publicBaseUrl:setting('public_base_url',''),publishingTimezone:TIMEZONE,publishingSlots:publishingSlots(),productionMode:'manual_batch',batchLimit:publishingSlots().length,batchActiveDate:activeBatchDate(),today:lagosDate()},workers:{renderBusy,collecting,screening}});
  }catch(error){fail(res,error,500);}
});
postTask('/api/performance/collect',async(req,res)=>{try{ok(res,{...await collectDuePerformanceSnapshots(),performance:performanceSummary()});}catch(error){fail(res,error);}});
postTask('/api/history/sync',async(req,res)=>{
  try{
    const data=await ownChannelVideos(),expected=setting('own_channel_id','');if(expected&&data.channel.id!==expected)throw new Error('Connected Google account does not match the configured channel.');
    for(const video of data.videos){run('INSERT INTO channel_history(video_id,title,description,published_at,views,duration,privacy,synced_at) VALUES(?,?,?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(video_id) DO UPDATE SET title=excluded.title,description=excluded.description,published_at=excluded.published_at,views=excluded.views,duration=excluded.duration,privacy=excluded.privacy,synced_at=CURRENT_TIMESTAMP',[video.videoId,video.title,video.description,video.publishedAt,video.views,video.duration,video.privacy]);if(video.privacy==='public')run("UPDATE jobs SET status='published',updated_at=CURRENT_TIMESTAMP WHERE youtube_video_id=? AND upload_confirmed_at IS NOT NULL AND deleted_at IS NOT NULL",[video.videoId]);}
    for(const [key,value] of Object.entries({own_channel_id:data.channel.id,own_channel_title:data.channel.title,own_channel_thumbnail:data.channel.thumbnail||'',own_channel_subscribers:data.channel.subscriberCount,own_channel_views:data.channel.viewCount,own_channel_video_count:data.channel.videoCount,history_last_sync:new Date().toISOString()}))setSetting(key,value);
    run("UPDATE candidates SET screened_at=NULL WHERE status='new'");ok(res,{synced:data.videos.length,screening:await screenAndPersistCandidates()});
  }catch(error){fail(res,error);}
});
app.post('/api/batch/start',(req,res)=>{
  try{const date=String(req.body.date||'');if(!validDate(date))throw new Error('Choose a valid batch date.');if(activeBatchDate()&&activeBatchDate()!==date)throw new Error('Pause the current batch before choosing another day.');const slots=publishingSlots(),limit=slots.length;if(slots.some(time=>Date.parse(slotIso(date,time))<=Date.now()+300000))throw new Error('Choose a day with the publishing slot still in the future.');if(Number(get("SELECT COUNT(*) n FROM jobs WHERE slot_date=? AND upload_confirmed_at IS NOT NULL",[date]).n)>=limit)throw new Error('This batch is already complete.');setSetting('production_mode','manual_batch');setSetting('batch_limit',String(limit));setSetting('batch_active_date',date);ok(res,{batch:{date,limit}});}catch(error){fail(res,error);}
});
app.post('/api/batch/stop',(req,res)=>{setSetting('batch_active_date','');ok(res,{paused:true});});
app.post('/api/settings',(req,res)=>{
  try{
    const updates={};if(Object.hasOwn(req.body,'minViews')){const n=Number(req.body.minViews);if(!Number.isFinite(n)||n<100000)throw new Error('Minimum source views must be at least 100,000.');updates.min_views=n;}
    if(Object.hasOwn(req.body,'privacy')){if(!['private','unlisted','public'].includes(req.body.privacy))throw new Error('Invalid YouTube privacy.');updates.youtube_privacy=req.body.privacy;}
    if(Object.hasOwn(req.body,'publishingSlots')){if(!validSlots(req.body.publishingSlots))throw new Error('Choose exactly one publishing time between 00:00 and 23:59.');if(activeBatchDate())throw new Error('Pause production before changing publishing times.');updates.publishing_slots=JSON.stringify([...req.body.publishingSlots].sort());}
    // The deployment controls the public URL so an open settings form cannot redirect OAuth to another host.
    for(const [key,value] of Object.entries(updates))setSetting(key,value);ok(res);
  }catch(error){fail(res,error);}
});
app.post('/api/settings/secrets',(req,res)=>{try{const map={geminiApiKey:'gemini_api_key',youtubeApiKey:'youtube_api_key',googleClientId:'google_client_id',googleClientSecret:'google_client_secret'},changes={};for(const [input,key] of Object.entries(map))if(String(req.body[input]||'').trim())changes[key]=String(req.body[input]).trim();setSecrets(changes);ok(res);}catch(error){fail(res,error);}});
// Chunks keep large media below Cloudflare's per-request body limits.
const transfers=new Map(),CHUNK_SIZE=8*1024*1024;
function mediaExtension(name){const ext=path.extname(String(name)).toLowerCase();if(!['.mp4','.mov','.mkv','.webm'].includes(ext))throw new Error('Use MP4, MOV, MKV or WebM video.');return ext;}
function transferFor(id){const transfer=transfers.get(id);if(!transfer||Date.now()-transfer.updatedAt>1800000)throw new Error('This media transfer expired. Select the file again.');return transfer;}
function transferJob(body){if(body.kind==='scene'){const job=productionJob(Number(body.jobId));if(!job.facts_verified_at)throw new Error('Verify the factual claim before acquiring a scene.');return job.id;}if(body.kind==='background'){if(renderBusy)throw new Error('Wait for the current render before replacing gameplay.');return null;}throw new Error('Invalid media destination.');}
function commitMedia(transfer){
  const jobId=transferJob(transfer),ext=mediaExtension(transfer.name);
  if(transfer.kind==='scene'){const dest=path.join(jobDir(jobId),'scene'+ext);fs.renameSync(transfer.file,dest);run("UPDATE jobs SET scene_file=?,scene_verified_at=NULL,scene_evidence=NULL,scene_payoff=NULL,editorial_profile=NULL,render_fingerprint=NULL,approved_at=NULL,approved_fingerprint=NULL,status='scene_ready',error=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?",[dest,jobId]);event(jobId,'scene_added');}
  else{const dest=path.join(ROOT,'assets','background.mp4');fs.mkdirSync(path.dirname(dest),{recursive:true});fs.renameSync(transfer.file,dest);run("UPDATE jobs SET render_fingerprint=NULL,approved_at=NULL,approved_fingerprint=NULL WHERE youtube_video_id IS NULL AND upload_session_url IS NULL AND status!='rejected'");}
}
app.post('/api/uploads/start',(req,res)=>{try{const {kind,name}=req.body,size=Number(req.body.size),jobId=transferJob(req.body);mediaExtension(name);if(!Number.isSafeInteger(size)||size<1||size>600*1024*1024)throw new Error('Choose a video between 1 byte and 600 MB.');if(transfers.size>=3)throw new Error('Finish the current media transfers before starting another.');const id=crypto.randomUUID(),file=path.join(tempDir,id+'.upload');fs.writeFileSync(file,'',{mode:0o600,flag:'wx'});transfers.set(id,{kind,name,size,jobId,file,offset:0,locked:false,updatedAt:Date.now()});ok(res,{transferId:id,chunkSize:CHUNK_SIZE});}catch(error){fail(res,error);}});
app.get('/api/uploads/:id',(req,res)=>{try{const transfer=transferFor(req.params.id);ok(res,{offset:transfer.offset,size:transfer.size});}catch(error){fail(res,error);}});
app.put('/api/uploads/:id',express.raw({type:'application/octet-stream',limit:CHUNK_SIZE}),async(req,res)=>{
  let transfer,claimed=false;
  try{transfer=transferFor(req.params.id);if(transfer.locked)throw new Error('A chunk is already being written.');if(Number(req.get('x-upload-offset'))!==transfer.offset)throw new Error('Chunk offset differs. Check transfer status before retrying.');if(!Buffer.isBuffer(req.body)||!req.body.length||transfer.offset+req.body.length>transfer.size)throw new Error('Invalid media chunk.');transfer.locked=true;claimed=true;const handle=await fs.promises.open(transfer.file,'r+');try{let written=0;while(written<req.body.length){const result=await handle.write(req.body,written,req.body.length-written,transfer.offset+written);if(!result.bytesWritten)throw new Error('Media chunk could not be saved.');written+=result.bytesWritten;}await handle.sync();}finally{await handle.close();}transfer.offset+=req.body.length;transfer.updatedAt=Date.now();ok(res,{offset:transfer.offset});}catch(error){fail(res,error);}finally{if(claimed)transfer.locked=false;}
});
app.post('/api/uploads/:id/finish',(req,res)=>{try{const transfer=transferFor(req.params.id);if(transfer.locked||transfer.offset!==transfer.size||fs.statSync(transfer.file).size!==transfer.size)throw new Error('The media transfer is incomplete.');commitMedia(transfer);transfers.delete(req.params.id);ok(res,{sceneReady:transfer.kind==='scene',background:transfer.kind==='background'});}catch(error){fail(res,error);}});
app.delete('/api/uploads/:id',(req,res)=>{try{const transfer=transferFor(req.params.id);if(transfer.locked)throw new Error('Wait for the current chunk.');fs.rmSync(transfer.file,{force:true});transfers.delete(req.params.id);ok(res);}catch(error){fail(res,error);}});
setInterval(()=>{for(const [id,transfer] of transfers)if(!transfer.locked&&Date.now()-transfer.updatedAt>1800000){fs.rmSync(transfer.file,{force:true});transfers.delete(id);}},300000).unref();

app.post('/api/assets/background',upload.single('background'),(req,res)=>{try{if(renderBusy)throw new Error('Wait for the current render before replacing gameplay.');if(!req.file)throw new Error('Choose a gameplay video.');const dest=path.join(ROOT,'assets','background.mp4');fs.mkdirSync(path.dirname(dest),{recursive:true});fs.renameSync(req.file.path,dest);run("UPDATE jobs SET render_fingerprint=NULL,approved_at=NULL,approved_fingerprint=NULL WHERE youtube_video_id IS NULL AND upload_session_url IS NULL AND status!='rejected'");ok(res,{background:true});}catch(error){if(req.file)fs.rmSync(req.file.path,{force:true});fail(res,error);}});
app.post('/api/competitors',async(req,res)=>{try{const handle=String(req.body.handle||'').trim();if(!handle)throw new Error('Enter a YouTube channel handle.');const channel=await resolveChannel(handle);run('INSERT INTO competitors(handle,channel_id,name) VALUES(?,?,?) ON CONFLICT(handle) DO UPDATE SET channel_id=excluded.channel_id,name=excluded.name',[handle,channel.channelId,channel.name]);ok(res);}catch(error){fail(res,error);}});
app.delete('/api/competitors/:id',(req,res)=>{run('DELETE FROM competitors WHERE id=?',[Number(req.params.id)]);ok(res);});
postTask('/api/discover',async(req,res)=>{
  try{if(screening)throw new Error('A source check is already running.');let found=0;const competitors=all('SELECT * FROM competitors WHERE enabled=1');if(!competitors.length)throw new Error('Add at least one competitor channel.');for(const competitor of competitors){const channel=competitor.channel_id?{channelId:competitor.channel_id,name:competitor.name}:await resolveChannel(competitor.handle);run('UPDATE competitors SET channel_id=?,name=? WHERE id=?',[channel.channelId,channel.name,competitor.id]);for(const video of await popularVideos(channel.channelId,Number(setting('min_views','5000000')))){const existing=get('SELECT id FROM candidates WHERE video_id=?',[video.videoId]);if(!existing){run('INSERT INTO candidates(video_id,competitor_id,title,url,views,published_at) VALUES(?,?,?,?,?,?)',[video.videoId,competitor.id,video.title,video.url,video.views,video.publishedAt]);found++;}else run('UPDATE candidates SET views=?,title=? WHERE id=?',[video.views,video.title,existing.id]);}}ok(res,{found,screening:await screenAndPersistCandidates()});}catch(error){fail(res,error);}
});
postTask('/api/jobs/from-candidate/:id',async(req,res)=>{try{requireActiveBatch();const candidate=get('SELECT * FROM candidates WHERE id=?',[Number(req.params.id)]);if(!candidate)throw new Error('Source not found.');if(candidate.status!=='new')throw new Error('This source is already used or blocked.');await screenAndPersistCandidates([candidate]);ok(res,createFromCandidate(get('SELECT * FROM candidates WHERE id=?',[candidate.id])));}catch(error){fail(res,error);}});
postTask('/api/jobs/from-url',async(req,res)=>{
  try{requireActiveBatch();const source=canonicalSource(req.body.url);if(get('SELECT id FROM jobs WHERE source_url=?',[source.url]))throw new Error('That source already has a production job.');const video=await publicVideoDetails(source.id);run('INSERT INTO candidates(video_id,title,url,views,published_at) VALUES(?,?,?,?,?) ON CONFLICT(video_id) DO NOTHING',[source.id,video.title,source.url,video.views,video.publishedAt]);const candidate=get('SELECT * FROM candidates WHERE video_id=?',[source.id]);if(candidate.status!=='new')throw new Error('That source is already used or blocked.');await screenAndPersistCandidates([candidate]);ok(res,createFromCandidate(get('SELECT * FROM candidates WHERE id=?',[candidate.id])));}catch(error){fail(res,error);}
});
postTask('/api/jobs/:id/analyze',async(req,res)=>{
  const id=Number(req.params.id);let claimed=false;
  try{const job=productionJob(id);claim(id);claimed=true;run("UPDATE jobs SET status='analyzing',operation_started_at=CURRENT_TIMESTAMP,error=NULL WHERE id=?",[id]);const result=await analyzeYouTube(job.source_url);validatePackage({title:result.title,description:result.description,tags:result.tags});validateCompactHook(result.hook);run("UPDATE jobs SET status='analyzed',hook=?,yt_title=?,description=?,tags=?,raw_gemini=?,scene_meta=?,subtitle_text=?,hook_profile='compact_v1',editorial_profile=NULL,facts_source_type=NULL,scene_payoff=NULL,facts_verified_at=NULL,facts_evidence=NULL,scene_verified_at=NULL,render_fingerprint=NULL,approved_at=NULL,approved_fingerprint=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?",[result.hook,result.title,result.description,result.tags,result.raw,JSON.stringify(result.sceneMeta),JSON.stringify(result.sceneMeta?.subtitle_text||[]),id]);event(id,'analyzed');ok(res,{package:result});}
  catch(error){if(claimed)run("UPDATE jobs SET status='analysis_failed',error=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",[safeError(error),id]);fail(res,error);}finally{if(claimed)release(id);}
});
app.patch('/api/jobs/:id',(req,res)=>{
  try{
    const id=Number(req.params.id),job=productionJob(id),body=req.body;
    const hook=Object.hasOwn(body,'hook')?String(body.hook).trim():job.hook,title=Object.hasOwn(body,'title')?String(body.title).trim():job.yt_title,description=Object.hasOwn(body,'description')?String(body.description):job.description,tags=Object.hasOwn(body,'tags')?String(body.tags):job.tags;
    if(!hook)throw new Error('Add an on-screen hook first.');validatePackage({title,description,tags});
    const subs=Object.hasOwn(body,'subtitles')?JSON.stringify(body.subtitles):job.subtitle_text;if(Object.hasOwn(body,'subtitles')&&(!Array.isArray(body.subtitles)||body.subtitles.length>2||body.subtitles.some(x=>typeof x!=='string')))throw new Error('Use at most two scene captions.');
    const contentChanged=hook!==job.hook||subs!==job.subtitle_text,claimChanged=hook!==job.hook||title!==job.yt_title||description!==job.description;
    let facts=claimChanged?null:job.facts_evidence,factsAt=claimChanged?null:job.facts_verified_at,factsType=claimChanged?null:job.facts_source_type,scene=job.scene_evidence,sceneAt=job.scene_verified_at,payoff=job.scene_payoff;
    if(Object.hasOwn(body,'factsEvidence')){factsType=String(body.factsSourceType||factsType||'');facts=verifyFactsEvidence(body.factsEvidence,factsType,job.source_url);if(body.factsVerified!==true)throw new Error('Confirm the factual claim against the independent source.');factsAt=new Date().toISOString();}
    if(Object.hasOwn(body,'sceneEvidence')){if(!job.scene_file)throw new Error('Add the scene before verifying it.');scene=String(body.sceneEvidence).trim();payoff=String(body.scenePayoff||payoff||'').trim();if(scene.length<12||payoff.length<8||body.sceneVerified!==true)throw new Error('Record the scene timestamp, visible payoff and confirmation that the clip matches the claim.');sceneAt=new Date().toISOString();}
    run('UPDATE jobs SET hook=?,yt_title=?,description=?,tags=?,subtitle_text=?,facts_evidence=?,facts_verified_at=?,facts_source_type=?,scene_evidence=?,scene_verified_at=?,scene_payoff=?,hook_profile=?,render_fingerprint=?,approved_at=NULL,approved_fingerprint=NULL,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?',[hook,title,description,tags,subs,facts,factsAt,factsType,scene,sceneAt,payoff,editorialSummary({hook}).tooLong?'legacy':'compact_v1',contentChanged?null:job.render_fingerprint,contentChanged?(job.scene_file?'scene_ready':'analyzed'):job.status,id]);event(id,'package_edited');ok(res);
  }catch(error){fail(res,error);}
});
app.post('/api/jobs/:id/scene',(req,res,next)=>{try{const job=productionJob(Number(req.params.id));if(!job.facts_verified_at)throw new Error('Verify the factual claim before acquiring a scene.');next();}catch(error){fail(res,error);}},upload.single('scene'),(req,res)=>{
  try{const id=Number(req.params.id),job=productionJob(id);if(!req.file)throw new Error('Choose the matching scene video.');const ext=path.extname(req.file.originalname||'').toLowerCase();if(!['.mp4','.mov','.mkv','.webm'].includes(ext))throw new Error('Use MP4, MOV, MKV or WebM video.');const dest=path.join(jobDir(id),'scene'+ext);fs.renameSync(req.file.path,dest);run("UPDATE jobs SET scene_file=?,scene_verified_at=NULL,scene_evidence=NULL,scene_payoff=NULL,editorial_profile=NULL,render_fingerprint=NULL,approved_at=NULL,approved_fingerprint=NULL,status='scene_ready',error=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?",[dest,id]);event(id,'scene_added');ok(res,{sceneReady:true});}catch(error){if(req.file)fs.rmSync(req.file.path,{force:true});fail(res,error);}
});
postTask('/api/jobs/:id/render',async(req,res)=>{
  const id=Number(req.params.id);let claimed=false;
  try{
    let job=productionJob(id);
    if(!job.facts_verified_at||!job.scene_verified_at)throw new Error('Verify the factual claim and exact scene before rendering.');
    if(renderBusy)throw new Error('Another render is running. Try again when it finishes.');
    claim(id);claimed=true;renderBusy=true;
    run("UPDATE jobs SET status='rendering',operation_started_at=CURRENT_TIMESTAMP,approved_at=NULL,approved_fingerprint=NULL,error=NULL WHERE id=?",[id]);
    let meta=sceneMeta(job),subs=parseSubs(job);
    const usable=job.editorial_profile==='dynamic_editorial_v1'&&Array.isArray(meta.subtitle_timings)&&meta.subtitle_timings.length===subs.length&&subs.length>=2;
    if(!usable){
      const plan=await buildEditorialCaptionPlan(job.scene_file,{hook:job.hook,payoff:job.scene_payoff});
      subs=plan.beats.map(x=>x.text);
      meta={...meta,caption_profile:plan.caption_profile,editorial_purpose:plan.editorial_purpose,subtitle_timings:plan.beats.map(x=>({start:x.start,end:x.end,kind:x.kind,emphasis:x.emphasis}))};
      run("UPDATE jobs SET subtitle_text=?,scene_meta=?,editorial_profile='dynamic_editorial_v1',render_fingerprint=NULL,approved_at=NULL,approved_fingerprint=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?",[JSON.stringify(subs),JSON.stringify(meta),id]);
      job=findJob(id);
    }
    if(job.template_profile!==TEMPLATE_PROFILE){
      run("UPDATE jobs SET template_profile=?,render_fingerprint=NULL,approved_at=NULL,approved_fingerprint=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?",[TEMPLATE_PROFILE,id]);
      job=findJob(id);
    }
    verifyEditorialReview(job);
    const rendered=await renderShort({jobId:id,sceneFile:job.scene_file,hook:job.hook,subtitles:parseSubs(job),subtitleTimings:sceneMeta(job).subtitle_timings||[],sourceHasBurnedCaptions:Boolean(sceneMeta(job).source_has_burned_captions),maxDuration:sceneMeta(job).max_duration||null});
    const hash=await fileSha256(rendered.output);
    run("UPDATE jobs SET render_file=?,preview_file=?,render_sha256=?,render_fingerprint=?,render_meta=?,status='rendered',updated_at=CURRENT_TIMESTAMP WHERE id=?",[rendered.output,rendered.preview,hash,renderFingerprint(job),JSON.stringify(rendered.meta),id]);
    event(id,'rendered');ok(res,{rendered:true,duration:rendered.duration});
  }
  catch(error){if(claimed)run("UPDATE jobs SET status='render_failed',render_fingerprint=NULL,error=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",[safeError(error),id]);fail(res,error);}finally{if(claimed){renderBusy=false;release(id);}}
});
app.get('/api/jobs/:id/video',(req,res)=>{const job=get('SELECT render_file,preview_file FROM jobs WHERE id=?',[Number(req.params.id)]),file=req.query.master==='1'?job?.render_file:job?.preview_file||job?.render_file;if(!file||!fs.existsSync(file))return res.status(404).send('Render not available.');res.setHeader('Cache-Control','private,max-age=300');res.sendFile(path.resolve(file));});
app.post('/api/jobs/:id/slot',(req,res)=>{try{const id=Number(req.params.id),job=findJob(id);mutable(job);const date=requireActiveBatch(),time=String(req.body.time||nextSlot().time);if(req.body.date&&req.body.date!==date)throw new Error('Choose a slot in the active batch.');if(!publishingSlots().includes(time)||slotOccupied(date,time,id))throw new Error('Choose an unoccupied configured publishing slot.');const publishAt=slotIso(date,time);if(Date.parse(publishAt)<=Date.now()+300000)throw new Error('The publishing slot must be at least five minutes in the future.');run('UPDATE jobs SET slot_date=?,slot_time=?,scheduled_publish_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=?',[date,time,publishAt,id]);event(id,'slot_assigned',date+' '+time);ok(res,{slot:{date,time,publishAt}});}catch(error){fail(res,error);}});
app.post('/api/jobs/:id/reject',(req,res)=>{try{const id=Number(req.params.id),job=findJob(id);mutable(job);const reason=String(req.body.reason||'Rejected during factual or scene review.').trim();run("UPDATE jobs SET status='rejected',slot_date=NULL,slot_time=NULL,scheduled_publish_at=NULL,approved_at=NULL,approved_fingerprint=NULL,error=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",[reason,id]);event(id,'rejected',reason);ok(res);}catch(error){fail(res,error);}});
async function validRender(job){
  if(!job.render_file||!fs.existsSync(job.render_file)||!job.render_sha256||job.render_fingerprint!==renderFingerprint(job)||await fileSha256(job.render_file)!==job.render_sha256)throw new Error('The render is missing or stale. Render the current package again.');
  let meta={};try{meta=JSON.parse(job.render_meta||'{}');}catch{}
  const duration=Number(meta.duration);
  if(!Number.isFinite(duration)||duration<6||duration>10)throw new Error('Final Shorts must be 6–10 seconds. Target 6–9 seconds and choose a different scene if the clip falls outside that range.');
}
app.post('/api/jobs/:id/approve',async(req,res)=>{const id=Number(req.params.id);let claimed=false;try{const job=productionJob(id);if(req.body.reviewed!==true||!job.facts_verified_at||!job.scene_verified_at)throw new Error('Watch the render and confirm the factual claim, exact scene and publishing package.');verifyEditorialReview(job);claim(id);claimed=true;await validRender(job);run('UPDATE jobs SET approved_at=CURRENT_TIMESTAMP,approved_fingerprint=?,updated_at=CURRENT_TIMESTAMP WHERE id=?',[approvalFingerprint(job),id]);event(id,'approved');ok(res);}catch(error){fail(res,error);}finally{if(claimed)release(id);}});
async function reconcile(job){
  const verified=await videoStatus(job.youtube_video_id);verifyUploadStatus(verified,{publishAt:job.upload_requested_publish_at||job.youtube_publish_at,privacy:job.upload_requested_privacy||'private'});
  const publishAt=job.upload_requested_publish_at||job.youtube_publish_at||null,status=verified.privacy==='public'?'published':publishAt?'scheduled':'uploaded';
  run('UPDATE jobs SET youtube_publish_at=?,upload_confirmed_at=COALESCE(upload_confirmed_at,CURRENT_TIMESTAMP),status=?,error=NULL,upload_session_url=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?',[publishAt,status,job.id]);
  run('INSERT INTO channel_history(video_id,title,description,published_at,views,privacy) VALUES(?,?,?,?,?,?) ON CONFLICT(video_id) DO UPDATE SET title=excluded.title,description=excluded.description,privacy=excluded.privacy',[job.youtube_video_id,job.yt_title||'',job.description||'',publishAt||new Date().toISOString(),0,verified.privacy]);
  seedCheckpoints(findJob(job.id));event(job.id,'youtube_verified',status);cleanupConfirmedUploads();pauseCompletedBatch();return {videoId:job.youtube_video_id,url:job.youtube_url,publishAt,privacy:verified.privacy,localVideosDeleted:Boolean(findJob(job.id).deleted_at)};
}
async function publish(req,res,scheduled){
  const id=Number(req.params.id);let claimed=false;
  try{
    let job=findJob(id);if(job.status==='rejected')throw new Error('This story was rejected.');claim(id);claimed=true;
    if(job.upload_confirmed_at)return ok(res,{reused:true,videoId:job.youtube_video_id,url:job.youtube_url,publishAt:job.youtube_publish_at});
    if(job.youtube_video_id)return ok(res,{reconciled:true,...await reconcile(job)});
    requireActiveBatch(job);verifyEditorialReview(job);if(!job.approved_at||job.approved_fingerprint!==approvalFingerprint(job))throw new Error('Approve the current render and package before uploading.');await validRender(job);validatePackage({title:job.yt_title,description:job.description,tags:job.tags});
    const publishAt=scheduled?job.scheduled_publish_at:null,privacy=scheduled?'private':setting('youtube_privacy','private');if(scheduled&&(!publishAt||Date.parse(publishAt)<=Date.now()+300000))throw new Error('Assign a publishing slot at least five minutes in the future.');
    if(job.upload_session_url&&(job.upload_requested_publish_at!==publishAt||job.upload_requested_privacy!==privacy))throw new Error('Resume the existing upload with its original publishing settings.');
    run("UPDATE jobs SET status=?,upload_requested_publish_at=?,upload_requested_privacy=?,operation_started_at=CURRENT_TIMESTAMP,error=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?",[scheduled?'scheduling':'uploading',publishAt,privacy,id]);
    await uploadVideo({file:job.render_file,title:job.yt_title,description:job.description,tags:job.tags,privacy,publishAt,expectedChannelId:setting('own_channel_id',''),resumeSession:job.upload_session_url,onSession:url=>{run('UPDATE jobs SET upload_session_url=? WHERE id=?',[url,id]);event(id,'upload_session_created');},onVideoConfirmed:result=>{run("UPDATE jobs SET youtube_video_id=?,youtube_url=?,status='verification_pending',updated_at=CURRENT_TIMESTAMP WHERE id=?",[result.videoId,result.url,id]);event(id,'youtube_id_received',result.videoId);}});
    ok(res,{[scheduled?'scheduled':'uploaded']:true,...await reconcile(findJob(id))});
  }catch(error){if(claimed){const job=findJob(id);if(!job.upload_confirmed_at)run('UPDATE jobs SET status=?,error=?,updated_at=CURRENT_TIMESTAMP WHERE id=?',[job.youtube_video_id?'verification_pending':job.upload_session_url?'upload_interrupted':['uploading','scheduling'].includes(job.status)?(scheduled?'schedule_failed':'upload_failed'):job.status,safeError(error),id]);event(id,'publish_error',safeError(error));}fail(res,error);}finally{if(claimed)release(id);}
}
postTask('/api/jobs/:id/schedule',(req,res)=>publish(req,res,true));
postTask('/api/jobs/:id/upload',(req,res)=>publish(req,res,false));
postTask('/api/jobs/:id/reconcile',async(req,res)=>{const id=Number(req.params.id);let claimed=false;try{const job=findJob(id);if(!job.youtube_video_id)throw new Error('The upload has no confirmed video ID. Resume the saved upload session through its original action.');claim(id);claimed=true;ok(res,await reconcile(job));}catch(error){fail(res,error);}finally{if(claimed)release(id);}});
app.get('/oauth/youtube/start',(req,res)=>{try{res.redirect(youtubeAuthUrl(oauthBaseUrl(req),security.issueOAuthState(req,res),{analytics:req.query.analytics==='1',backup:req.query.backup==='1'}));}catch(error){res.status(400).send(safeError(error));}});
app.get('/oauth/youtube/callback',async(req,res)=>{try{security.verifyOAuthState(req,res,req.query.state);if(!req.query.code)throw new Error('Google did not return an authorization code.');await exchangeYoutubeCode(String(req.query.code),oauthBaseUrl(req),setting('own_channel_id',''));res.redirect(baseUrl(req)+'/?youtube=connected');}catch(error){res.status(400).send(safeError(error));}});
app.use((error,req,res,next)=>{if(req.file)fs.rmSync(req.file.path,{force:true});fail(res,error?.code==='LIMIT_FILE_SIZE'?new Error('The upload exceeds 600 MB.'):error);});
app.get('/{*splat}',(req,res)=>res.sendFile(path.join(ROOT,'public','index.html')));
if(process.env.SN_TEST_MODE!=='1'){
  run("UPDATE jobs SET status=CASE WHEN youtube_video_id IS NOT NULL THEN 'verification_pending' WHEN upload_session_url IS NOT NULL THEN 'upload_interrupted' WHEN status='rendering' THEN 'render_failed' ELSE 'analysis_failed' END,error='Operation interrupted by a service restart. Review before retrying.',operation_started_at=NULL WHERE operation_started_at IS NOT NULL AND upload_confirmed_at IS NULL");
  cleanupConfirmedUploads();
  if(process.env.SN_DISABLE_BACKGROUND!=='1'){setTimeout(()=>collectDuePerformanceSnapshots().catch(error=>console.error(safeError(error))),5000).unref();setInterval(()=>collectDuePerformanceSnapshots().catch(error=>console.error(safeError(error))),900000).unref();setInterval(cleanupConfirmedUploads,300000).unref();setInterval(()=>{if(setting('analytics_status','')==='ready'&&Date.now()-Date.parse(setting('analytics_last_sync','1970-01-01'))>86400000)collectAnalytics().catch(error=>console.error(safeError(error)));},3600000).unref();}
  app.listen(PORT,'127.0.0.1',()=>console.log('Silent Narratives Studio listening on 127.0.0.1:'+PORT));
}
