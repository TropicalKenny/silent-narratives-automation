import fs from 'node:fs';
import { getSecret } from './secrets.js';
import { GoogleGenAI } from '@google/genai';
import { validateCompactHook } from './editorial.js';

const PRIMARY_MODEL='gemini-3.5-flash';
const FALLBACK_MODEL='gemini-3.5-flash-lite';

function cleanMarkdown(s=''){
  return String(s).replace(/\*\*/g,'').trim();
}

export function parsePackage(raw=''){
  const text=String(raw);
  const take=(n,next)=>{
    const end=next?'(?=\\n---\\s*\\n\\s*###\\s*'+next+'\\.)':'$';
    const re=new RegExp('###\\s*'+n+'\\.[^\\n]*\\n([\\s\\S]*?)'+end,'i');
    const m=text.match(re);
    return m?m[1].trim():'';
  };
  const hook=cleanMarkdown(take(1,2));
  const title=cleanMarkdown(take(2,3));
  const description=take(3,4).trim();
  const tags=take(4,null).replace(/```text|```/gi,'').trim();
  return {hook,title,description,tags};
}

function youtubeWatchUrl(url=''){
  try{
    const u=new URL(String(url).trim());
    if(u.pathname.startsWith('/shorts/')){
      const id=u.pathname.split('/')[2]||'';
      return id?'https://www.youtube.com/watch?v='+id:String(url);
    }
    if(u.hostname.includes('youtu.be')){
      const id=u.pathname.split('/').filter(Boolean)[0]||'';
      return id?'https://www.youtube.com/watch?v='+id:String(url);
    }
    return String(url);
  }catch{return String(url);}
}

async function generate(model,parts,{json=false,maxOutputTokens=3200}={}){
  const apiKey=getSecret('gemini_api_key');
  if(!apiKey) throw new Error('Gemini API key is not configured.');
  const endpoint='https://generativelanguage.googleapis.com/v1beta/models/'+model+':generateContent?key='+encodeURIComponent(apiKey);
  const body={
    contents:[{parts}],
    generationConfig:{
      maxOutputTokens,
      ...(json?{temperature:0,responseMimeType:'application/json'}:{temperature:0.35})
    }
  };
  let r;
  try{
    r=await fetch(endpoint,{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify(body),
      signal:AbortSignal.timeout(model===PRIMARY_MODEL?45000:60000)
    });
  }catch(e){
    if(e?.name==='TimeoutError'||e?.name==='AbortError'){
      const timeout=new Error(model+' timed out while processing the request.');
      timeout.status=504;
      throw timeout;
    }
    throw e;
  }
  const data=await r.json();
  if(!r.ok){
    const e=new Error(data?.error?.message||('Gemini HTTP '+r.status));
    e.status=r.status;
    throw e;
  }
  return (data.candidates?.[0]?.content?.parts||[]).map(p=>p.text||'').join('').trim();
}

async function generateWithFallback(parts,opts={}){
  let last=null;
  for(const model of [PRIMARY_MODEL,FALLBACK_MODEL]){
    try{
      return {model,text:await generate(model,parts,opts)};
    }catch(e){
      last=e;
      if(![429,500,502,503,504].includes(Number(e.status))) throw e;
      await new Promise(resolve=>setTimeout(resolve,model===PRIMARY_MODEL?700:350));
    }
  }
  throw last||new Error('Gemini generation failed.');
}

export async function analyzeYouTube(url){
  const prompt=fs.readFileSync('config/master_prompt.md','utf8');
  const videoUrl=youtubeWatchUrl(url);

  const packageResult=await generateWithFallback([
    {text:prompt},
    {file_data:{file_uri:videoUrl}}
  ],{maxOutputTokens:3600});

  const raw=packageResult.text;
  const pkg=parsePackage(raw);
  if(!pkg.hook||!pkg.title) throw new Error('Gemini returned an unexpected package format.');
  validateCompactHook(pkg.hook);

  const scenePrompt=[
    'Analyze this same YouTube Short for production automation.',
    'Return ONLY valid JSON with these keys:',
    'movie_or_show, year, scene_description, visible_action, visible_payoff, factual_uncertainty, subtitle_mode, subtitle_text, edit_note.',
    'subtitle_text must be an array of at most 2 concise on-screen lines, preferably actual meaningful dialogue/context from the scene.',
    'Distinguish visible action from claims in a competitor caption. Describe the earliest clear visual payoff. Metadata is an unverified lead for human review, not evidence.',
    'Do not invent facts or claim independent verification. If uncertain, use null and explain the uncertainty briefly in factual_uncertainty and edit_note.'
  ].join(' ');

  let sceneMeta={};
  try{
    const sceneResult=await generateWithFallback([
      {text:scenePrompt},
      {file_data:{file_uri:videoUrl}}
    ],{json:true,maxOutputTokens:1400});
    sceneMeta=JSON.parse(sceneResult.text);
    if(Array.isArray(sceneMeta)) sceneMeta=sceneMeta[0]||{};
    if(!sceneMeta || typeof sceneMeta!=='object') sceneMeta={};
    if(!Array.isArray(sceneMeta.subtitle_text)) sceneMeta.subtitle_text=[];
    sceneMeta._model=sceneResult.model;
  }catch(e){
    sceneMeta={edit_note:'Scene metadata generation failed: '+e.message,subtitle_text:[]};
  }

  return {...pkg,raw,sceneMeta,model:packageResult.model};
}
function clipText(value='',max=80){return String(value||'').replace(/\s+/g,' ').trim().slice(0,max);}

export async function buildEditorialCaptionPlan(sceneFile,{hook='',payoff=''}={}){
  const apiKey=getSecret('gemini_api_key');
  if(!apiKey)throw new Error('Gemini API key is not configured.');
  const ai=new GoogleGenAI({apiKey});
  let file=null;
  try{
    file=await ai.files.upload({file:sceneFile,config:{mimeType:'video/mp4',displayName:'Silent Narratives verified scene'}});
    for(let i=0;i<60&&String(file.state||'').toUpperCase().includes('PROCESS');i++){
      await new Promise(resolve=>setTimeout(resolve,1200));
      file=await ai.files.get({name:file.name});
    }
    if(!file?.uri)throw new Error('Gemini could not prepare the scene for caption analysis.');
    const prompt=[
      'You are preparing captions for a short editorial movie/TV explainer.',
      'The independently researched on-screen hook is: '+JSON.stringify(clipText(hook,160))+'.',
      'The verified visual payoff is: '+JSON.stringify(clipText(payoff,220))+'.',
      'Return ONLY JSON with keys editorial_purpose, beats, and focus_points.',
      'beats must contain 2 to 6 items. Each item must have start, end, text, kind, emphasis.',
      'focus_points must contain 1 to 6 items. Each item must have start and subject_x_percent.',
      'focus_points describe the face/subject the vertical crop should follow. start is seconds from this clip; subject_x_percent is the subject center in the ORIGINAL landscape frame from 0=far left to 100=far right.',
      'Add a focus point only when the source camera cuts or the important speaker/reaction subject changes. Do not create smooth pans between people or empty set space.',
      'start/end are seconds from the beginning of THIS uploaded scene and must be within the clip.',
      'text should normally be 1 to 5 words so captions change quickly like modern short-form subtitles.',
      'kind must be dialogue or editorial.',
      'For dialogue, use only words actually audible in the clip. Do not paraphrase dialogue or invent quotes.',
      'For editorial, add concise explanatory context that helps the viewer understand why the verified moment matters; it must not be written as a quote.',
      'Use editorial beats only when they add meaning beyond raw dialogue.',
      'emphasis should be one important word from text, or an empty string.',
      'Avoid repeating the full top hook in captions.',
      'Do not add engagement bait, algorithm language, fake urgency, or unsupported claims.',
      'The purpose is genuine explanation/accessibility, never copyright-filter or detection evasion.'
    ].join(' ');
    const planned=await generateWithFallback([
      {text:prompt},
      {file_data:{file_uri:file.uri,mime_type:file.mimeType||'video/mp4'}}
    ],{json:true,maxOutputTokens:1800});
    let data=JSON.parse(planned.text||'{}');
    if(Array.isArray(data))data=data[0]||{};
    const beats=(Array.isArray(data.beats)?data.beats:[]).map(b=>({
      start:Number(b.start),end:Number(b.end),text:clipText(b.text,55),
      kind:b.kind==='dialogue'?'dialogue':'editorial',
      emphasis:clipText(b.emphasis,24)
    })).filter(b=>Number.isFinite(b.start)&&Number.isFinite(b.end)&&b.end>b.start&&b.start>=0&&b.text);
    if(beats.length<2||beats.length>6)throw new Error('Gemini did not return 2-6 usable caption beats.');
    for(let i=0;i<beats.length;i++){
      if(beats[i].end-beats[i].start<0.22)beats[i].end=beats[i].start+0.22;
      if(i&&beats[i].start<beats[i-1].start)throw new Error('Gemini returned caption beats out of order.');
    }
    const editorialPurpose=clipText(data.editorial_purpose,400);
    if(editorialPurpose.length<24)throw new Error('Gemini did not explain the original editorial contribution.');
    let focusPoints=(Array.isArray(data.focus_points)?data.focus_points:[]).map(x=>({start:Number(x.start),subject_x_percent:Number(x.subject_x_percent)})).filter(x=>Number.isFinite(x.start)&&x.start>=0&&Number.isFinite(x.subject_x_percent)).map(x=>({start:x.start,subject_x_percent:Math.max(0,Math.min(100,x.subject_x_percent))})).sort((a,b)=>a.start-b.start).slice(0,6);
    if(focusPoints.length&&focusPoints[0].start>0.08)focusPoints=[{start:0,subject_x_percent:focusPoints[0].subject_x_percent},...focusPoints].slice(0,6);
    return {caption_profile:'dynamic_editorial_v1',editorial_purpose:editorialPurpose,beats,focus_points:focusPoints};
  }finally{
    if(file?.name)try{await ai.files.delete({name:file.name});}catch{}
  }
}
