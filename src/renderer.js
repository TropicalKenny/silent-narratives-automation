import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { jobDir } from './utils.js';
import { validateCompactHook } from './editorial.js';

export const TEMPLATE_PROFILE='scene_first_v4';

async function run(bin,args) {
  if(bin.endsWith('/ffmpeg'))args=['-threads','2','-filter_threads','1','-filter_complex_threads','1',...args];
  return new Promise((resolve,reject)=>{
    const child=spawn(bin,args,{stdio:['ignore','pipe','pipe']});
    let output='',errors='';
    const timer=setTimeout(()=>{child.kill('SIGKILL');reject(new Error('Media processing exceeded the ten-minute limit.'));},600000);
    child.stdout.on('data',chunk=>{output=(output+chunk).slice(-200000);});
    child.stderr.on('data',chunk=>{errors=(errors+chunk).slice(-10000);});
    child.on('error',error=>{clearTimeout(timer);reject(error);});
    child.on('close',code=>{clearTimeout(timer);if(code!==0)reject(new Error((errors||output||bin+' failed').slice(-5000)));else resolve(output);});
  });
}
function xml(s='') {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function wrap(text,max=56) {
  const words=String(text).replace(/\s+/g,' ').trim().split(' ');
  const lines=[]; let line='';
  for(const w of words) {
    const next=line?line+' '+w:w;
    if(next.length>max && line){ lines.push(line); line=w; }
    else line=next;
  }
  if(line) lines.push(line);
  if(lines.length>7)throw new Error('The on-screen hook is too long for the approved card. Shorten it before rendering.');
  return lines;
}
async function probeMedia(file) {
  const out=await run('/usr/bin/ffprobe',['-v','error','-show_entries','stream=index,codec_type,start_time,duration,r_frame_rate,width,height','-show_entries','format=duration','-of','json',file]);
  const data=JSON.parse(out),video=(data.streams||[]).find(x=>x.codec_type==='video'),audio=(data.streams||[]).find(x=>x.codec_type==='audio');
  if(!video)throw new Error('The scene does not contain a valid video stream.');
  if(!audio)throw new Error('The scene has no audio. Use a source containing the actual scene audio.');
  const videoDuration=Number(video.duration||data.format?.duration||0),audioDuration=Number(audio.duration||data.format?.duration||0);
  const duration=Math.min(videoDuration,audioDuration);
  if(!Number.isFinite(duration)||duration<0.3||duration>180)throw new Error('Use a valid scene between 0.3 and 180 seconds.');
  return {videoDuration,audioDuration,duration,width:video.width,height:video.height};
}
function avatarDataUri() {
  const avatar=path.resolve('assets/channel-avatar.jpg');
  if(!fs.existsSync(avatar)) return '';
  return 'data:image/jpeg;base64,'+fs.readFileSync(avatar).toString('base64');
}
function makeOverlay(file,hook) {
  const lines=wrap(hook,38).slice(0,2);
  const fontSize=lines.length>1?37:42;
  const lineHeight=Math.round(fontSize*1.12);
  const startY=145;
  const tspans=lines.map((line,i)=>'<tspan x="52" dy="'+(i===0?0:lineHeight)+'">'+xml(line)+'</tspan>').join('');
  const avatar=avatarDataUri();
  const svg='<?xml version="1.0" encoding="UTF-8"?>'+
  '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1080" height="1920" viewBox="0 0 1080 1920">'+
    '<defs><clipPath id="avatarClip"><circle cx="64" cy="88" r="24"/></clipPath></defs>'+
    '<rect x="24" y="54" width="1032" height="166" rx="24" fill="#080c0d" fill-opacity="0.62" stroke="#ffffff" stroke-opacity="0.14" stroke-width="2"/>'+
    (avatar?'<image x="40" y="64" width="48" height="48" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatarClip)" xlink:href="'+avatar+'"/>':'')+
    '<text x="100" y="82" font-family="DejaVu Sans" font-size="23" font-weight="700" fill="#ffffff" fill-opacity="0.92">SILENT NARRATIVES</text>'+
    '<text x="100" y="108" font-family="DejaVu Sans" font-size="17" fill="#ffffff" fill-opacity="0.68">@silentnarrativesYT</text>'+
    '<text x="52" y="'+startY+'" text-anchor="start" font-family="DejaVu Sans" font-size="'+fontSize+'" font-weight="700" fill="#ffffff">'+tspans+'</text>'+
  '</svg>';
  fs.writeFileSync(file,svg);
}
function makeClipMask(file) {
  const svg='<?xml version="1.0" encoding="UTF-8"?>'+
  '<svg xmlns="http://www.w3.org/2000/svg" width="1044" height="1320" viewBox="0 0 1044 1320">'+
    '<rect x="0" y="0" width="1044" height="1320" rx="34" fill="#ffffff"/>'+
  '</svg>';
  fs.writeFileSync(file,svg);
}
function assEscape(s='') {
  return String(s).replace(/\\/g,'\\\\').replace(/{/g,'\\{').replace(/}/g,'\\}').replace(/\n/g,' ');
}
function regexEscape(s=''){return String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
function assColorWord(text,emphasis) {
  const safe=assEscape(text.toUpperCase()),word=String(emphasis||'').trim();
  if(!word)return safe;
  const re=new RegExp('('+regexEscape(word)+')','i');
  return safe.replace(re,'{\\c&H00FFA63E&}$1{\\c&H00FFFFFF&}');
}
function makeAss(file,subs,duration,timings=[]) {
  const arr=(Array.isArray(subs)?subs:[subs]).map(x=>String(x||'').trim()).filter(Boolean).slice(0,6);
  const fmt=t=>{
    const h=Math.floor(t/3600),m=Math.floor((t%3600)/60),sec=(t%60).toFixed(2).padStart(5,'0');
    return h+':'+String(m).padStart(2,'0')+':'+sec;
  };
  const events=[];
  arr.forEach((text,i)=>{
    const meta=timings?.[i]||{},kind=meta.kind==='editorial'?'editorial':'dialogue';
    const fallbackStart=Math.min(Math.max(.32,i*(duration/Math.max(arr.length,1))),Math.max(.32,duration-.4));
    const start=Math.max(0,Number(meta.start ?? fallbackStart));
    const end=Math.min(duration-.04,Math.max(start+.26,Number(meta.end ?? Math.min(duration-.08,start+1.15))));
    const style=kind==='editorial'?'Editorial':'Dialogue';
    const colored=assColorWord(text,meta.emphasis);
    const y=kind==='editorial'?1185:1310;
    const styled='{\\an5\\pos(335,'+y+')\\fad(35,55)\\fscx88\\fscy88\\t(0,95,\\fscx108\\fscy108)\\t(95,175,\\fscx100\\fscy100)}'+colored;
    events.push('Dialogue: '+(kind==='editorial'?1:0)+','+fmt(start)+','+fmt(end)+','+style+',,0,0,0,,'+styled);
  });
  const ass='[Script Info]\nScriptType: v4.00+\nPlayResX: 1080\nPlayResY: 1920\nWrapStyle: 2\nScaledBorderAndShadow: yes\n\n'+
    '[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n'+
    'Style: Dialogue,DejaVu Sans,50,&H00FFFFFF,&H000000FF,&H00101010,&H68000000,-1,0,0,0,100,100,0.8,0,1,5.2,1.3,5,72,72,0,1\n'+
    'Style: Editorial,DejaVu Sans,46,&H00FFFFFF,&H000000FF,&H00101010,&H68000000,-1,0,0,0,100,100,0.5,0,1,5.0,1.2,5,72,72,0,1\n\n'+
    '[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n'+events.join('\n')+'\n';
  fs.writeFileSync(file,ass);
}

export async function renderShort({jobId,sceneFile,hook,subtitles=[],subtitleTimings=[],sourceHasBurnedCaptions=false,maxDuration=null}) {
  validateCompactHook(hook);
  if(!sceneFile || !fs.existsSync(sceneFile)) throw new Error('Scene video file is missing.');
  const dir=jobDir(jobId);
  const overlaySvg=path.join(dir,'overlay.svg');
  const overlayPng=path.join(dir,'overlay.png');
  const assFile=path.join(dir,'subtitles.ass');
  const composite=path.join(dir,'composite.mp4');
  const openingFrame=path.join(dir,'opening-frame.png');
  const output=path.join(dir,'final.mp4');
  const media=await probeMedia(sceneFile);
  const duration=maxDuration?Math.min(media.duration,Number(maxDuration)):media.duration;
  const d=Number(duration.toFixed(3));

  makeOverlay(overlaySvg,hook);
  makeAss(assFile,sourceHasBurnedCaptions?[]:subtitles,duration,sourceHasBurnedCaptions?[]:subtitleTimings);
  await run('/usr/bin/ffmpeg',['-y','-i',overlaySvg,'-frames:v','1',overlayPng]);

  // V4 is source-scene first. There is intentionally no gameplay/background input.
  const args=['-y','-i',sceneFile,'-loop','1','-framerate','30','-i',overlayPng];
  const assEsc=assFile.replace(/\\/g,'/').replace(/:/g,'\\:').replace(/'/g,"\\'");
  const filter=
    '[0:v]setpts=PTS-STARTPTS,fps=30,tpad=stop_mode=clone:stop_duration=0.20,trim=duration='+d+',scale=1080:1920:force_original_aspect_ratio=increase:flags=lanczos,crop=1080:1920,setsar=1[scene];'+
    '[1:v]setpts=PTS-STARTPTS,format=rgba[cardfx];'+
    (sourceHasBurnedCaptions?'[scene][cardfx]overlay=0:0[outv]':'[scene][cardfx]overlay=0:0[comp];[comp]ass=\''+assEsc+'\'[outv]');

  // Final audio comes ONLY from the source scene (input 0).
  args.push('-filter_complex',filter,'-map','[outv]','-map','0:a?','-t',String(d),'-r','30',
    '-c:v','libx264','-profile:v','high','-level','4.1','-preset','slow','-threads','2','-crf','12',
    '-pix_fmt','yuv420p','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709',
    '-c:a','aac','-b:a','320k','-ar','48000','-ac','2','-movflags','+faststart',composite);
  await run('/usr/bin/ffmpeg',args);

  // The first ~0.20s of the layered composite is not fully populated by FFmpeg framesync.
  // Replace that interval with the first complete composed frame AND the same-duration silence,
  // then continue both video and audio from the same 0.20s source timestamp. This preserves A/V sync.
  const hold=Math.min(0.20,Math.max(0.10,d*0.08));
  await run('/usr/bin/ffmpeg',[
    '-y','-ss',String(hold),'-i',composite,'-frames:v','1',openingFrame
  ]);
  const syncedHeadFilter=
    '[0:v]trim=duration='+hold+',setpts=PTS-STARTPTS,scale=1080:1920,setsar=1[holdv];'+
    '[1:v]trim=start='+hold+':duration='+Math.max(0.1,d-hold)+',setpts=PTS-STARTPTS[restv];'+
    '[holdv][restv]concat=n=2:v=1:a=0[outv];'+
    '[2:a]atrim=duration='+hold+',asetpts=PTS-STARTPTS[holda];'+
    '[1:a]atrim=start='+hold+':duration='+Math.max(0.1,d-hold)+',asetpts=PTS-STARTPTS[resta];'+
    '[holda][resta]concat=n=2:v=0:a=1[outa]';
  await run('/usr/bin/ffmpeg',[
    '-y','-loop','1','-framerate','30','-i',openingFrame,
    '-i',composite,
    '-f','lavfi','-i','anullsrc=r=48000:cl=stereo',
    '-filter_complex',syncedHeadFilter,
    '-map','[outv]','-map','[outa]','-t',String(d),'-r','30',
    '-c:v','libx264','-profile:v','high','-level','4.1','-preset','slow','-threads','2','-crf','15',
    '-pix_fmt','yuv420p','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709',
    '-c:a','aac','-b:a','320k','-ar','48000','-ac','2','-movflags','+faststart',output
  ]);

  // Keep the upload master untouched. Generate a much lighter review copy for phone/browser playback.
  const preview=path.join(dir,'preview.mp4');
  await run('/usr/bin/ffmpeg',[
    '-y','-i',output,
    '-vf','scale=720:1280:flags=lanczos',
    '-c:v','libx264','-profile:v','high','-level','3.1','-preset','veryfast','-threads','2','-crf','23',
    '-maxrate','2800k','-bufsize','5600k','-pix_fmt','yuv420p',
    '-c:a','aac','-b:a','128k','-ar','48000','-ac','2',
    '-movflags','+faststart',preview
  ]);

  return {output,preview,duration,meta:{duration,hookWords:String(hook).trim().split(/\s+/).length,width:1080,height:1920,fps:30,sceneAudio:true,captionBeats:subtitles.length,captionProfile:'dynamic_editorial_v1',templateProfile:TEMPLATE_PROFILE,sceneStagePercent:100,sharpScenePercent:100,shortsSafeCaptionX:335,gameplayBackground:false,sourceHasBurnedCaptions:Boolean(sourceHasBurnedCaptions)}};
}
