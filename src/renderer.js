import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { jobDir } from './utils.js';

function run(bin,args) {
  const r=spawnSync(bin,args,{encoding:'utf8',maxBuffer:20*1024*1024});
  if(r.status!==0) throw new Error((r.stderr||r.stdout||bin+' failed').slice(-5000));
  return r.stdout;
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
  return lines.slice(0,7);
}
function probeDuration(file) {
  try {
    const out=run('/usr/bin/ffprobe',['-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',file]);
    return Number(out.trim())||8;
  } catch { return 8; }
}
function probeMedia(file) {
  try {
    const out=run('/usr/bin/ffprobe',[
      '-v','error','-show_entries','stream=index,codec_type,start_time,duration,r_frame_rate',
      '-show_entries','format=duration','-of','json',file
    ]);
    const data=JSON.parse(out);
    const video=(data.streams||[]).find(x=>x.codec_type==='video');
    const audio=(data.streams||[]).find(x=>x.codec_type==='audio');
    const videoDuration=Number(video?.duration||data.format?.duration||0);
    const audioDuration=Number(audio?.duration||0);
    const duration=(audioDuration>0?Math.min(videoDuration||audioDuration,audioDuration):videoDuration)||probeDuration(file);
    return {videoDuration,audioDuration,duration};
  } catch {
    const duration=probeDuration(file);
    return {videoDuration:duration,audioDuration:0,duration};
  }
}
function avatarDataUri() {
  const avatar=path.resolve('assets/channel-avatar.jpg');
  if(!fs.existsSync(avatar)) return '';
  return 'data:image/jpeg;base64,'+fs.readFileSync(avatar).toString('base64');
}
function makeOverlay(file,hook) {
  const lines=wrap(hook,45);
  const fontSize=lines.length>=7?34:lines.length>=6?37:40;
  const lineHeight=Math.round(fontSize*1.28);
  const startY=355;
  const tspans=lines.map((line,i)=>'<tspan x="540" dy="'+(i===0?0:lineHeight)+'">'+xml(line)+'</tspan>').join('');
  const avatar=avatarDataUri();

  const svg='<?xml version="1.0" encoding="UTF-8"?>'+
  '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1080" height="1920" viewBox="0 0 1080 1920">'+
    '<defs><clipPath id="avatarClip"><circle cx="251" cy="242" r="67"/></clipPath></defs>'+
    '<rect x="11" y="131" width="1058" height="1374" rx="24" fill="#152022" stroke="#f0f0f0" stroke-width="4"/>'+
    (avatar?'<image x="184" y="175" width="134" height="134" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatarClip)" xlink:href="'+avatar+'"/>':
      '<circle cx="251" cy="242" r="67" fill="#232d31"/><text x="251" y="254" text-anchor="middle" font-family="DejaVu Sans" font-size="34" font-weight="700" fill="#ffffff">SN</text>')+
    '<text x="334" y="235" font-family="DejaVu Sans" font-size="39" font-weight="700" fill="#ffffff">SILENT NARRATIVES</text>'+
    '<circle cx="764" cy="220" r="14" fill="#3ea6ff"/>'+
    '<path d="M756 220 l5 5 l10 -11" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>'+
    '<text x="329" y="280" font-family="DejaVu Sans" font-size="34" fill="#f0f0f0">@silentnarrativesYT</text>'+
    '<text x="540" y="'+startY+'" text-anchor="middle" font-family="DejaVu Sans" font-size="'+fontSize+'" font-weight="700" fill="#f4f4f4">'+tspans+'</text>'+
  '</svg>';
  fs.writeFileSync(file,svg);
}
function makeClipMask(file) {
  const svg='<?xml version="1.0" encoding="UTF-8"?>'+
  '<svg xmlns="http://www.w3.org/2000/svg" width="1044" height="859" viewBox="0 0 1044 859">'+
    '<rect width="1044" height="626" fill="#000000"/>'+
    '<rect x="0" y="0" width="1044" height="859" rx="52" fill="#ffffff"/>'+
  '</svg>';
  fs.writeFileSync(file,svg);
}
function assEscape(s='') {
  return String(s).replace(/\\/g,'\\\\').replace(/{/g,'\\{').replace(/}/g,'\\}').replace(/\n/g,' ');
}
function makeAss(file,subs,duration) {
  const arr=(Array.isArray(subs)?subs:[subs]).map(x=>String(x||'').trim()).filter(Boolean).slice(0,2);
  const fmt=t=>{
    const h=Math.floor(t/3600),m=Math.floor((t%3600)/60),sec=(t%60).toFixed(2).padStart(5,'0');
    return h+':'+String(m).padStart(2,'0')+':'+sec;
  };
  const windows=arr.length===1
    ? [[Math.min(0.35,duration*0.08),Math.max(0.7,duration-0.18)]]
    : [[Math.min(0.35,duration*0.08),Math.min(duration*0.48,duration-0.35)],
       [Math.min(duration*0.50,duration-0.30),Math.max(duration*0.52,duration-0.12)]];
  const events=arr.map((text,i)=>{
    const [start,end]=windows[i];
    const safe=assEscape(text);
    // 96→100% micro-pop + short fade feels edited, not template-bouncy.
    const styled='{\\an2\\pos(540,1405)\\fad(85,110)\\fscx96\\fscy96\\t(0,140,\\fscx100\\fscy100)}'+safe;
    return 'Dialogue: 0,'+fmt(start)+','+fmt(Math.max(start+0.35,end))+',Dialogue,,0,0,0,,'+styled;
  }).join('\n');
  const ass='[Script Info]\nScriptType: v4.00+\nPlayResX: 1080\nPlayResY: 1920\nWrapStyle: 2\nScaledBorderAndShadow: yes\n\n'+
    '[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n'+
    'Style: Dialogue,DejaVu Sans,42,&H00FFFFFF,&H000000FF,&H00101010,&H78000000,-1,0,0,0,100,100,0,0,1,4.2,1.1,2,82,82,0,1\n\n'+
    '[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n'+events+'\n';
  fs.writeFileSync(file,ass);
}

export function renderShort({jobId,sceneFile,hook,subtitles=[]}) {
  if(!sceneFile || !fs.existsSync(sceneFile)) throw new Error('Scene video file is missing.');
  const dir=jobDir(jobId);
  const overlaySvg=path.join(dir,'overlay.svg');
  const overlayPng=path.join(dir,'overlay.png');
  const maskSvg=path.join(dir,'clip-mask.svg');
  const maskPng=path.join(dir,'clip-mask.png');
  const assFile=path.join(dir,'subtitles.ass');
  const composite=path.join(dir,'composite.mp4');
  const openingFrame=path.join(dir,'opening-frame.png');
  const output=path.join(dir,'final.mp4');
  const media=probeMedia(sceneFile);
  const duration=media.duration;
  const d=Number(duration.toFixed(3));

  makeOverlay(overlaySvg,hook);
  makeClipMask(maskSvg);
  makeAss(assFile,subtitles,duration);
  run('/usr/bin/ffmpeg',['-y','-i',overlaySvg,'-frames:v','1',overlayPng]);
  run('/usr/bin/ffmpeg',['-y','-i',maskSvg,'-frames:v','1',maskPng]);

  const bg=path.resolve('assets/background.mp4');
  const args=['-y'];
  if(fs.existsSync(bg)) args.push('-stream_loop','-1','-i',bg);
  else args.push('-f','lavfi','-i','color=c=#171717:s=1080x1920:r=30');
  args.push('-i',sceneFile,'-loop','1','-framerate','30','-i',overlayPng,'-loop','1','-framerate','30','-i',maskPng);

  const assEsc=assFile.replace(/\\/g,'/').replace(/:/g,'\\:').replace(/'/g,"\\'");
  const filter=
    '[0:v]trim=duration='+d+',setpts=PTS-STARTPTS,fps=30,scale=1080:1920:force_original_aspect_ratio=increase:flags=lanczos,crop=1080:1920,unsharp=5:5:0.25:5:5:0.0,setsar=1[bg];'+
    '[1:v]setpts=PTS-STARTPTS-0.05/TB,fps=30,tpad=stop_mode=clone:stop_duration=0.20,trim=duration='+d+','+
      'scale=1530:860:force_original_aspect_ratio=increase:flags=lanczos,crop=1044:859,'+
      "zoompan=z='min(1.032,1+on*0.00025)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1044x859:fps=30,"+
      'format=rgba[cliprgb];'+
    '[3:v]scale=1044:859,format=gray[mask];[cliprgb][mask]alphamerge[clip];'+
    '[2:v]fade=t=in:st=0:d=0.16,format=rgba[cardfx];'+
    '[bg][cardfx]overlay=0:0[card];[card][clip]overlay=18:644[comp];'+
    "[comp]ass='"+assEsc+"'[outv]";

  // Final audio comes ONLY from the main scene (input 1). Background audio is never mapped.
  args.push('-filter_complex',filter,'-map','[outv]','-map','1:a?','-t',String(d),'-r','30',
    '-c:v','libx264','-profile:v','high','-level','4.1','-preset','slow','-crf','12',
    '-pix_fmt','yuv420p','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709',
    '-c:a','aac','-b:a','320k','-ar','48000','-movflags','+faststart',composite);
  run('/usr/bin/ffmpeg',args);

  const hold=Math.min(0.20,Math.max(0.10,d*0.08));
  run('/usr/bin/ffmpeg',[
    '-y','-ss',String(hold),'-i',composite,'-frames:v','1',openingFrame
  ]);
  const holdFilter=
    '[0:v]trim=duration='+hold+',setpts=PTS-STARTPTS,scale=1080:1920,setsar=1[hold];'+
    '[1:v]trim=start='+hold+':duration='+Math.max(0.1,d-hold)+',setpts=PTS-STARTPTS[rest];'+
    '[hold][rest]concat=n=2:v=1:a=0[outv]';
  run('/usr/bin/ffmpeg',[
    '-y','-loop','1','-framerate','30','-i',openingFrame,'-i',composite,
    '-filter_complex',holdFilter,
    '-map','[outv]','-map','1:a?','-t',String(d),'-r','30',
    '-c:v','libx264','-profile:v','high','-level','4.1','-preset','slow','-crf','15',
    '-pix_fmt','yuv420p','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709',
    '-c:a','copy','-movflags','+faststart',output
  ]);

  // Keep the upload master untouched. Generate a much lighter review copy for phone/browser playback.
  const preview=path.join(dir,'preview.mp4');
  run('/usr/bin/ffmpeg',[
    '-y','-i',output,
    '-vf','scale=720:1280:flags=lanczos',
    '-c:v','libx264','-profile:v','high','-level','3.1','-preset','veryfast','-crf','23',
    '-maxrate','2800k','-bufsize','5600k','-pix_fmt','yuv420p',
    '-c:a','aac','-b:a','128k','-ar','48000',
    '-movflags','+faststart',preview
  ]);

  return {output,preview,duration};
}
