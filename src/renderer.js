import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { jobDir } from './utils.js';
import { validateCompactHook } from './editorial.js';

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
    '<text x="334" y="235" font-family="DejaVu Sans" font-size="37" font-weight="700" fill="#ffffff">SILENT NARRATIVES</text>'+
    '<polygon points="777,206 780,208.9 784,207.9 785.1,211.9 789.1,213 788.1,217 791,220 788.1,223 789.1,227 785.1,228.1 784,232.1 780,231.1 777,234 774,231.1 770,232.1 768.9,228.1 764.9,227 765.9,223 763,220 765.9,217 764.9,213 768.9,211.9 770,207.9 774,208.9" fill="#3ea6ff"/>'+
    '<path d="M769.5 220 l5 5 l10 -11" fill="none" stroke="#ffffff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>'+
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
function makeAss(file,subs,duration,timings=[]) {
  const arr=(Array.isArray(subs)?subs:[subs]).map(x=>String(x||'').trim()).filter(Boolean).slice(0,2);
  const fmt=t=>{
    const h=Math.floor(t/3600),m=Math.floor((t%3600)/60),sec=(t%60).toFixed(2).padStart(5,'0');
    return h+':'+String(m).padStart(2,'0')+':'+sec;
  };

  const defaultTimes=arr.length===1
    ? [{start:Math.min(0.48,duration*0.12),end:Math.min(duration-0.08,1.60)}]
    : [
        {start:0.45,end:0.95},
        {start:0.93,end:Math.min(duration-0.08,1.68)}
      ];
  const times=arr.map((_,i)=>({
    start:Number(timings?.[i]?.start ?? defaultTimes[i]?.start ?? 0.45),
    end:Number(timings?.[i]?.end ?? defaultTimes[i]?.end ?? Math.min(duration-0.08,1.60))
  }));

  const events=[];
  arr.forEach((text,i)=>{
    const t=times[i];
    const safe=assEscape(text.toUpperCase());
    if(i===0){
      // Quiet setup: short lift and gentle scale-in.
      const styled='{\\an2\\move(540,1424,540,1404,0,150)\\fad(55,70)\\fscx95\\fscy95\\t(0,145,\\fscx101\\fscy101)}'+safe;
      events.push('Dialogue: 0,'+fmt(t.start)+','+fmt(Math.max(t.start+0.28,t.end))+',Setup,,0,0,0,,'+styled);
    }else{
      // Payoff: larger, warm accent, quick overshoot then settle.
      const styled='{\\an2\\pos(540,1400)\\fad(45,90)\\fscx90\\fscy90\\t(0,90,\\fscx110\\fscy110)\\t(90,190,\\fscx100\\fscy100)}'+safe;
      events.push('Dialogue: 1,'+fmt(t.start)+','+fmt(Math.max(t.start+0.35,t.end))+',Impact,,0,0,0,,'+styled);
    }
  });

  const ass='[Script Info]\nScriptType: v4.00+\nPlayResX: 1080\nPlayResY: 1920\nWrapStyle: 2\nScaledBorderAndShadow: yes\n\n'+
    '[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n'+
    'Style: Setup,DejaVu Sans,43,&H00FFFFFF,&H000000FF,&H00101010,&H76000000,-1,0,0,0,100,100,0,0,1,4.2,1.0,2,82,82,0,1\n'+
    'Style: Impact,DejaVu Sans,57,&H006B6BFF,&H000000FF,&H00101010,&H78000000,-1,0,0,0,100,100,0,0,1,5.0,1.4,2,72,72,0,1\n\n'+
    '[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n'+events.join('\n')+'\n';
  fs.writeFileSync(file,ass);
}

export async function renderShort({jobId,sceneFile,hook,subtitles=[],subtitleTimings=[]}) {
  validateCompactHook(hook);
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
  const media=await probeMedia(sceneFile);
  const duration=media.duration;
  const d=Number(duration.toFixed(3));

  makeOverlay(overlaySvg,hook);
  makeClipMask(maskSvg);
  makeAss(assFile,subtitles,duration,subtitleTimings);
  await run('/usr/bin/ffmpeg',['-y','-i',overlaySvg,'-frames:v','1',overlayPng]);
  await run('/usr/bin/ffmpeg',['-y','-i',maskSvg,'-frames:v','1',maskPng]);

  const bg=path.resolve('assets/background.mp4');
  const args=['-y'];
  if(fs.existsSync(bg)) args.push('-stream_loop','-1','-i',bg);
  else args.push('-f','lavfi','-i','color=c=#171717:s=1080x1920:r=30');
  args.push('-i',sceneFile,'-loop','1','-framerate','30','-i',overlayPng,'-loop','1','-framerate','30','-i',maskPng);

  const assEsc=assFile.replace(/\\/g,'/').replace(/:/g,'\\:').replace(/'/g,"\\'");
  const payoffStart=Number(subtitleTimings?.[1]?.start ?? Math.max(0.75,d*0.45));
  const payoffFrame=Math.max(1,Math.round(payoffStart*30));
  const zoomExpr="zoompan=z='if(lt(on,"+payoffFrame+"),1+on*0.00014,min(1.060,1.004+(on-"+payoffFrame+")*0.00085))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)-if(gte(on,"+payoffFrame+"),6,0)':d=1:s=1044x859:fps=30,";
  const filter=
    '[0:v]trim=duration='+d+',setpts=PTS-STARTPTS,fps=30,scale=1080:1920:force_original_aspect_ratio=increase:flags=lanczos,crop=1080:1920,unsharp=5:5:0.25:5:5:0.0,setsar=1[bg];'+
    '[1:v]setpts=PTS-STARTPTS,fps=30,tpad=stop_mode=clone:stop_duration=0.20,trim=duration='+d+','+
      'scale=1530:860:force_original_aspect_ratio=increase:flags=lanczos,crop=1044:859,'+
      zoomExpr+
      'format=rgba[cliprgb];'+
    '[3:v]setpts=PTS-STARTPTS,scale=1044:859,format=gray[mask];[cliprgb][mask]alphamerge[clip];'+
    '[2:v]setpts=PTS-STARTPTS,format=rgba[cardfx];'+
    '[bg][cardfx]overlay=0:0[card];[card][clip]overlay=18:644[comp];'+
    "[comp]ass='"+assEsc+"'[outv]";

  // Final audio comes ONLY from the main scene (input 1). Background audio is never mapped.
  args.push('-filter_complex',filter,'-map','[outv]','-map','1:a?','-t',String(d),'-r','30',
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

  return {output,preview,duration,meta:{duration,hookWords:String(hook).trim().split(/\s+/).length,width:1080,height:1920,fps:30,sceneAudio:true}};
}
