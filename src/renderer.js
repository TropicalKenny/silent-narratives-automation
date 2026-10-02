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
function wrap(text,max=45) {
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
function avatarDataUri() {
  const avatar=path.resolve('assets/channel-avatar.jpg');
  if(!fs.existsSync(avatar)) return '';
  return 'data:image/jpeg;base64,'+fs.readFileSync(avatar).toString('base64');
}
function makeOverlay(file,hook) {
  const lines=wrap(hook,45);
  const fontSize=lines.length>=7?34:lines.length>=6?37:40;
  const lineHeight=Math.round(fontSize*1.28);
  const startY=414;
  const tspans=lines.map((line,i)=>'<tspan x="540" dy="'+(i===0?0:lineHeight)+'">'+xml(line)+'</tspan>').join('');
  const avatar=avatarDataUri();

  const svg='<?xml version="1.0" encoding="UTF-8"?>'+
  '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1080" height="1920" viewBox="0 0 1080 1920">'+
    '<defs><clipPath id="avatarClip"><circle cx="127" cy="291" r="56"/></clipPath></defs>'+
    '<rect x="11" y="192" width="1058" height="1164" rx="24" fill="#152022" stroke="#f0f0f0" stroke-width="4"/>'+
    (avatar?'<image x="71" y="235" width="112" height="112" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatarClip)" xlink:href="'+avatar+'"/>':
      '<circle cx="127" cy="291" r="56" fill="#232d31"/><text x="127" y="304" text-anchor="middle" font-family="DejaVu Sans" font-size="34" font-weight="700" fill="#ffffff">SN</text>')+
    '<text x="220" y="281" font-family="DejaVu Sans" font-size="39" font-weight="700" fill="#ffffff">SILENT NARRATIVES</text>'+
    '<circle cx="688" cy="267" r="15" fill="#3ea6ff"/>'+
    '<path d="M680 267 l5 5 l10 -11" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>'+
    '<text x="220" y="330" font-family="DejaVu Sans" font-size="34" fill="#f0f0f0">@silentnarrativesYT</text>'+
    '<text x="540" y="'+startY+'" text-anchor="middle" font-family="DejaVu Sans" font-size="'+fontSize+'" font-weight="700" fill="#f4f4f4">'+tspans+'</text>'+
  '</svg>';
  fs.writeFileSync(file,svg);
}
function makeClipMask(file) {
  const svg='<?xml version="1.0" encoding="UTF-8"?>'+
  '<svg xmlns="http://www.w3.org/2000/svg" width="1044" height="626" viewBox="0 0 1044 626">'+
    '<rect width="1044" height="626" fill="#000000"/>'+
    '<rect x="0" y="0" width="1044" height="626" rx="43" fill="#ffffff"/>'+
  '</svg>';
  fs.writeFileSync(file,svg);
}
function assEscape(s='') {
  return String(s).replace(/\\/g,'\\\\').replace(/{/g,'\\{').replace(/}/g,'\\}').replace(/\n/g,' ');
}
function makeAss(file,subs,duration) {
  const arr=(Array.isArray(subs)?subs:[subs]).map(x=>String(x||'').trim()).filter(Boolean).slice(0,2);
  const half=Math.max(1,duration/Math.max(1,arr.length));
  const fmt=t=>{
    const h=Math.floor(t/3600),m=Math.floor((t%3600)/60),s=(t%60).toFixed(2).padStart(5,'0');
    return h+':'+String(m).padStart(2,'0')+':'+s;
  };
  const events=arr.map((s,i)=>{
    const start=i*half+0.18;
    const end=Math.min(duration,(i+1)*half+0.05);
    return 'Dialogue: 0,'+fmt(start)+','+fmt(end)+',Default,,0,0,0,,'+assEscape(s);
  }).join('\n');
  const ass='[Script Info]\nScriptType: v4.00+\nPlayResX: 1080\nPlayResY: 1920\nWrapStyle: 2\n\n'+
    '[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n'+
    'Style: Default,DejaVu Sans,36,&H00FFFFFF,&H000000FF,&H00111111,&H70000000,-1,0,0,0,100,100,0,0,1,4,1,2,70,70,620,1\n\n'+
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
  const output=path.join(dir,'final.mp4');
  const duration=probeDuration(sceneFile);
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
    '[0:v]trim=duration='+d+',setpts=PTS-STARTPTS,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1[bg];'+
    '[1:v]trim=duration='+d+',setpts=PTS-STARTPTS,scale=1110:680:force_original_aspect_ratio=increase,crop=1044:626,'+
      "zoompan=z='min(zoom+0.00045,1.055)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1044x626:fps=30,format=rgba[cliprgb];"+
    '[3:v]scale=1044:626,format=gray[mask];[cliprgb][mask]alphamerge[clip];'+
    '[bg][2:v]overlay=0:0[card];[card][clip]overlay=18:720[comp];'+
    "[comp]ass='"+assEsc+"'[outv]";

  // Final audio comes ONLY from the main scene (input 1). Background audio is never mapped.
  args.push('-filter_complex',filter,'-map','[outv]','-map','1:a?','-t',String(d),'-r','30',
    '-c:v','libx264','-preset','veryfast','-crf','20','-pix_fmt','yuv420p',
    '-c:a','aac','-b:a','160k','-movflags','+faststart',output);
  run('/usr/bin/ffmpeg',args);
  return {output,duration};
}
