import { getSecret } from './secrets.js';

const MODEL='gemini-3.5-flash-lite';

function youtubeWatchUrl(videoIdOrUrl=''){
  const raw=String(videoIdOrUrl||'').trim();
  if(!raw) return '';
  if(/^[A-Za-z0-9_-]{8,}$/.test(raw) && !raw.includes('/')) return 'https://www.youtube.com/watch?v='+raw;
  try{
    const u=new URL(raw);
    if(u.pathname.startsWith('/shorts/')) return 'https://www.youtube.com/watch?v='+(u.pathname.split('/')[2]||'');
    if(u.hostname.includes('youtu.be')) return 'https://www.youtube.com/watch?v='+(u.pathname.split('/').filter(Boolean)[0]||'');
    const id=u.searchParams.get('v');
    return id?'https://www.youtube.com/watch?v='+id:raw;
  }catch{return raw;}
}

async function geminiJson(parts,maxOutputTokens=3500){
  const key=getSecret('gemini_api_key');
  if(!key) throw new Error('Gemini API key is not configured for duplicate screening.');
  const url='https://generativelanguage.googleapis.com/v1beta/models/'+MODEL+':generateContent?key='+encodeURIComponent(key);
  let lastError=null;
  for(let attempt=0;attempt<3;attempt++){
    try{
      const r=await fetch(url,{
        method:'POST',
        headers:{'content-type':'application/json'},
        signal:AbortSignal.timeout(45000),
        body:JSON.stringify({
          contents:[{parts}],
          generationConfig:{temperature:0,responseMimeType:'application/json',maxOutputTokens}
        })
      });
      const data=await r.json();
      if(!r.ok){
        const err=new Error(data?.error?.message||('Gemini HTTP '+r.status));
        err.status=r.status;
        throw err;
      }
      const raw=(data.candidates?.[0]?.content?.parts||[]).map(p=>p.text||'').join('').trim();
      return JSON.parse(raw);
    }catch(e){
      lastError=e;
      if(![429,500,502,503,504].includes(Number(e.status)) || attempt===2) break;
      await new Promise(resolve=>setTimeout(resolve,600*(attempt+1)));
    }
  }
  throw lastError||new Error('Duplicate screening failed.');
}

async function titleScreen(candidates,history){
  if(!candidates.length||!history.length) return {duplicates:[],needs_video_check:[]};
  const prompt=[
    'You are screening candidate YouTube Shorts against a channel\'s already-published Shorts.',
    'A duplicate means the candidate covers the SAME underlying story, scene, behind-the-scenes fact, stunt, anecdote, mistake, production event, theory, or movie/show moment.',
    'Same franchise, film, show, actor, or character alone is NOT a duplicate.',
    'Return ONLY JSON: {"duplicates":[{"candidate_id":1,"published_video_id":"...","confidence":0.0,"reason":"..."}],"needs_video_check":[{"candidate_id":1,"published_video_id":"...","confidence":0.0,"reason":"..."}]}',
    'Use duplicates only when title/context is sufficient for confidence >=0.85.',
    'Use needs_video_check whenever there is a plausible same-story overlap but the titles are too vague to be certain. Be conservative: uncertain sources should be checked, not waved through.',
    '',
    'PUBLISHED:',
    ...history.map(x=>'- '+x.video_id+' | '+(x.title||'')+(x.description?' | '+String(x.description).slice(0,260):'')),
    '',
    'CANDIDATES:',
    ...candidates.map(x=>'- ID '+x.id+' | '+x.video_id+' | '+(x.title||''))
  ].join('\n');
  return geminiJson([{text:prompt}],4000);
}

async function compareVideos(candidate,published){
  const result=await geminiJson([
    {text:'Compare these two YouTube Shorts. Determine whether they cover the SAME underlying story, scene, anecdote, production fact, stunt, mistake, theory, or movie/show moment. Same franchise/show/movie/actor alone is NOT enough. Return ONLY JSON with keys same_story (boolean), confidence (0 to 1), first_story, second_story, reason.'},
    {text:'FIRST VIDEO: competitor candidate'},
    {file_data:{file_uri:youtubeWatchUrl(candidate.url||candidate.video_id)}},
    {text:'SECOND VIDEO: already published on Silent Narratives'},
    {file_data:{file_uri:youtubeWatchUrl(published.video_id)}}
  ],1200);
  return result;
}

export async function screenCandidatesAgainstHistory(candidates,history){
  const out={duplicates:[],safe:[],review:[]};
  if(!candidates.length){return out;}
  if(!history.length){out.safe.push(...candidates.map(c=>({candidate:c})));return out;}

  let titleResult;
  try{
    titleResult=await titleScreen(candidates,history);
    if(!titleResult||!Array.isArray(titleResult.duplicates)||!Array.isArray(titleResult.needs_video_check))throw new Error('Duplicate screening returned an incomplete result.');
    for(const item of [...titleResult.duplicates,...titleResult.needs_video_check])if(!item||!candidates.some(c=>c.id===Number(item.candidate_id))||!history.some(h=>h.video_id===String(item.published_video_id))||!Number.isFinite(Number(item.confidence))||Number(item.confidence)<0||Number(item.confidence)>1)throw new Error('Duplicate screening returned an invalid match.');
  }catch(e){
    out.review.push(...candidates.map(c=>({candidate:c,reason:'Duplicate screening unavailable: '+e.message})));
    return out;
  }

  const direct=new Map((titleResult.duplicates||[]).map(x=>[Number(x.candidate_id),x]));
  const checksByCandidate=new Map();
  for(const x of titleResult.needs_video_check||[]){
    const id=Number(x.candidate_id);
    if(!checksByCandidate.has(id)) checksByCandidate.set(id,[]);
    checksByCandidate.get(id).push(x);
  }

  const historyById=new Map(history.map(x=>[String(x.video_id),x]));
  for(const c of candidates){
    const d=direct.get(Number(c.id));
    if(d&&(!historyById.has(String(d.published_video_id))||!Number.isFinite(Number(d.confidence))||Number(d.confidence)<0.85)){out.review.push({candidate:c,reason:'Title duplicate comparison was inconclusive.'});continue;}
    if(d){
      out.duplicates.push({candidate:c,published:historyById.get(String(d.published_video_id))||null,confidence:Number(d.confidence||0),reason:d.reason||'Same story as published content.'});
      continue;
    }

    const checks=checksByCandidate.get(Number(c.id))||[];
    if(!checks.length){out.safe.push({candidate:c});continue;}

    let duplicate=null,unverified=checks.length>4?{candidate:c,reason:'More possible overlaps remain to be verified.'}:null;
    for(const match of checks.slice(0,4)){
      const published=historyById.get(String(match.published_video_id));
      if(!published){unverified={candidate:c,reason:'Duplicate screening referenced an unknown published story.'};continue;}
      try{
        if(!/^[A-Za-z0-9_-]{11}$/.test(published.video_id)){unverified={candidate:c,published,reason:'Possible overlap with a story still in production. Review before continuing.'};continue;}
        const verified=await compareVideos(c,published);
        if(typeof verified?.same_story!=='boolean'||!Number.isFinite(Number(verified.confidence))||(Number(verified.confidence)<0.8||Number(verified.confidence)>1)){unverified={candidate:c,published,reason:'Actual-video comparison was inconclusive.'};continue;}
        if(verified?.same_story && Number(verified.confidence||0)>=0.8){
          duplicate={candidate:c,published,confidence:Number(verified.confidence||0),reason:verified.reason||match.reason||'Same story as published content.'};
          break;
        }
      }catch(e){
        unverified={candidate:c,published,reason:'Actual-video duplicate check could not complete: '+e.message};
      }
    }
    if(duplicate) out.duplicates.push(duplicate);
    else if(unverified) out.review.push(unverified);
    else out.safe.push({candidate:c});
  }
  return out;
}
