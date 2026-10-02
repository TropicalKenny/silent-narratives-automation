import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { jobDir } from './utils.js';

const FONT='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';
const FONT_BOLD='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';

function run(bin,args) {
  const r=spawnSync(bin,args,{encoding:'utf8',maxBuffer:20*1024*1024});
  if(r.status!==0) throw new Error((r.stderr||r.stdout||bin+' failed').slice(-5000));
  return r.stdout;
}
function xml(s='') {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function wrap(text,max=44) {
  const words=String(text).replace(/\s+/g,' ').trim().split(' ');
  const lines=[]; let line='';
  for(const w of words) {
    const next=line?line+' '+w:w;
    if(next.length>max && line){ lines.push(line); line=w; }
    else line=next;
  }
  if(line) lines.push(line);
  return lines.slice(0,8);
}
function probeDuration(file) {
  try {
    const out=run('ffprobe',['-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',file]);
    return Number(out.trim())||8;
  } catch { return 8; }
}
function makeOverlay(file,hook) {
  const lines=wrap(hook,44);
  const fontSize=lines.length>=7?35:lines.length>=6?38:42;
  const lineHeight=Math.round(fontSize*1.28);
  const tspans=lines.map((line,i)=>'<tspan x="50" dy="'+(i===0?0:lineHeight)+'">'+xml(line)+'</tspan>').join('');
  const svg='<?xml version="1.0" encoding="UTF-8"?>'+
  '<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">'+
    '<rect x="17" y="135" width="1046" height="1380" rx="28" fill="#ffffff"/>'+
    '<circle cx="91" cy="235" r="54" fill="#111111"/>'+
    '<text x="91" y="249" text-anchor="middle" font-family="DejaVu Sans" font-size="36" font-weight="700" fill="#ffffff">SN</text>'+
    '<text x="540" y="226" text-anchor="middle" font-family="DejaVu Sans" font-size="42" font-weight="700" fill="#111111">SILENT NARRATIVES</text>'+
    '<text x="540" y="278" text-anchor="middle" font-family="DejaVu Sans" font-size="30" fill="#555555">@silentnarrativesYT</text>'+
    '<line x1="50" y1="302" x2="1030" y2="302" stroke="#eeeeee" stroke-width="2"/>'+
    '<text x="50" y="357" font-family="DejaVu Sans" font-size="'+fontSize+'" font-weight="600" fill="#111111">'+tspans+'</text>'+
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
    const h=Math.floor(t/3600); const m=Math.floor((t%3600)/60); const s=(t%60).toFixed(2).padStart(5,'0');
    return h+':'+String(m).padStart(2,'0')+':'+s;
  };
  const events=arr.map((s,i)=>{
    const start=i*half+0.35;
    const end=Math.min(duration,(i+1)*half+0.15);
    return 'Dialogue: 0,'+fmt(start)+','+fmt(end)+',Default,,0,0,0,,'+assEscape(s);
  }).join('\n');
  const ass='[Script Info]\nScriptType: v4.00+\nPlayResX: 1080\nPlayResY: 1920\nWrapStyle: 2\n\n'+
    '[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n'+
    'Style: Default,DejaVu Sans,40,&H00FFFFFF,&H000000FF,&H00111111,&H66000000,-1,0,0,0,100,100,0,0,1,4,1,2,60,60,475,1\n\n'+
    '[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n'+events+'\n';
  fs.writeFileSync(file,ass);
}

export function renderShort({jobId,sceneFile,hook,subtitles=[]}) {
  if(!sceneFile || !fs.existsSync(sceneFile)) throw new Error('Scene video file is missing.');
  const dir=jobDir(jobId);
  const overlaySvg=path.join(dir,'overlay.svg');
  const overlayPng=path.join(dir,'overlay.png');
  const assFile=path.join(dir,'subtitles.ass');
  const output=path.join(dir,'final.mp4');
  const srcDur=probeDuration(sceneFile);
  const duration=srcDur;
  makeOverlay(overlaySvg,hook);
  makeAss(assFile,subtitles,duration);
  run('ffmpeg',['-y','-i',overlaySvg,'-frames:v','1',overlayPng]);

  const bg=path.resolve('assets/background.mp4');
  const args=['-y'];
  if(fs.existsSync(bg)) args.push('-stream_loop','-1','-i',bg);
  else args.push('-f','lavfi','-i','color=c=#171717:s=1080x1920:r=30');
  args.push('-i',sceneFile,'-loop','1','-framerate','30','-i',overlayPng);

  const assEsc=assFile.replace(/\\/g,'/').replace(/:/g,'\\:').replace(/'/g,"\\'");
  const d=Number(duration.toFixed(3));
  const filter=
    `[0:v]trim=duration=${d},setpts=PTS-STARTPTS,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1[bg];`+
    `[1:v]trim=duration=${d},setpts=PTS-STARTPTS,scale=1120:920:force_original_aspect_ratio=increase,crop=1046:859,`+
    "zoompan=z='min(zoom+0.00055,1.06)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1046x859:fps=30[clip];"+
    '[bg][2:v]overlay=0:0[base];[base][clip]overlay=17:645[comp];'+
    "[comp]ass='"+assEsc+"'[outv]";

  // Audio is intentionally taken only from the main scene (input 1).
  // The gameplay background may contain an audio stream, but it is never mapped.
  args.push('-filter_complex',filter,'-map','[outv]','-map','1:a?','-t',String(d),'-r','30',
    '-c:v','libx264','-preset','veryfast','-crf','20','-pix_fmt','yuv420p',
    '-c:a','aac','-b:a','160k','-movflags','+faststart',output);
  run('ffmpeg',args);
  return {output,duration};
}
