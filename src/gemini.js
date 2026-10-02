import fs from 'node:fs';
import { getSecret } from './secrets.js';

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

  const scenePrompt=[
    'Analyze this same YouTube Short for production automation.',
    'Return ONLY valid JSON with these keys:',
    'movie_or_show, year, scene_description, visible_action, subtitle_mode, subtitle_text, edit_note.',
    'subtitle_text must be an array of at most 2 concise on-screen lines, preferably actual meaningful dialogue/context from the scene.',
    'Do not invent facts. If uncertain, use null and explain the uncertainty briefly in edit_note.'
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
