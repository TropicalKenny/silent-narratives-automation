const BASE = location.pathname.startsWith('/silent-narratives') ? '/silent-narratives' : '';
let STATE=null;
const $=s=>document.querySelector(s);
function esc(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function compact(n){n=Number(n||0);if(n>=1e9)return(n/1e9).toFixed(1)+'B';if(n>=1e6)return(n/1e6).toFixed(1)+'M';if(n>=1e3)return(n/1e3).toFixed(0)+'K';return String(n);}
function toast(msg,error=false){const t=$('#toast');t.textContent=msg;t.className='toast show'+(error?' error':'');clearTimeout(window._toast);window._toast=setTimeout(()=>t.className='toast',3300);}
async function api(url,opts={}){const target=url.startsWith('/')?BASE+url:url;const r=await fetch(target,opts);let d={};try{d=await r.json();}catch{}if(!r.ok||d.ok===false)throw new Error(d.error||('Request failed '+r.status));return d;}
async function refresh(){try{STATE=await api('/api/state');$('#health').textContent='VPS online';$('#health').className='status ok';render();}catch(e){$('#health').textContent='Unavailable';$('#health').className='status bad';toast(e.message,true);}}
window.refresh=refresh;

function render(){
  renderIntegrations();renderCompetitors();renderCandidates();renderJobs();
  $('#backgroundStatus').textContent=STATE.assets.background?'Ready':'Missing';
  $('#backgroundStatus').className='status '+(STATE.assets.background?'ok':'warn');
  const sf=$('#settingsForm');sf.minViews.value=STATE.settings.minViews;sf.privacy.value=STATE.settings.privacy;sf.publicBaseUrl.value=STATE.settings.publicBaseUrl||'';
}
function statusCard(name,ready,note){return '<div class="status-card"><strong>'+esc(name)+'</strong><span>'+(ready?'Ready':'Needs setup')+' · '+esc(note)+'</span></div>';}
function renderIntegrations(){const i=STATE.integrations;$('#integrations').innerHTML=statusCard('Gemini 3.8 Flash',i.gemini,'analysis')+statusCard('YouTube Data API',i.youtubeData,'discovery')+statusCard('Google OAuth',i.googleOAuth,'upload credentials')+statusCard('YouTube channel',i.youtubeConnected,'authenticated upload');}
function renderCompetitors(){const el=$('#competitors');if(!STATE.competitors.length){el.innerHTML='<p class="muted">No competitor channels added.</p>';return;}el.innerHTML=STATE.competitors.map(c=>'<div class="list-item"><div><strong>'+esc(c.name||c.handle)+'</strong><br><small>'+esc(c.handle)+'</small></div><button class="danger" onclick="removeCompetitor('+c.id+')">Remove</button></div>').join('');}
window.removeCompetitor=async id=>{try{await api('/api/competitors/'+id,{method:'DELETE'});await refresh();}catch(e){toast(e.message,true);}};

function renderCandidates(){const list=STATE.candidates.filter(c=>!['selected','used'].includes(c.status)).slice(0,30);$('#candidateCount').textContent=list.length?list.length+' available':'';const el=$('#candidates');if(!list.length){el.className='candidate-grid empty';el.innerHTML='No unused 5M+ sources yet.';return;}el.className='candidate-grid';el.innerHTML=list.map(c=>'<article class="candidate"><div class="meta"><span>'+esc(c.competitor_name||c.competitor_handle||'Source')+'</span><span>'+compact(c.views)+' views</span></div><h4>'+esc(c.title)+'</h4><button onclick="selectCandidate('+c.id+')">Create production job</button></article>').join('');}
window.selectCandidate=async id=>{try{const d=await api('/api/jobs/from-candidate/'+id,{method:'POST'});toast('Job #'+d.jobId+' created');await refresh();}catch(e){toast(e.message,true);}};

function jobStatusClass(s){return ['rendered','uploaded','scene_ready','analyzed'].includes(s)?'ok':s.includes('error')||s.includes('failed')?'bad':['analyzing','rendering','uploading'].includes(s)?'warn':'';}
function packageFields(j){if(!j.hook)return '<p class="muted">Gemini package not generated yet.</p>';return '<div class="package"><div class="field"><small>HOOK + COMMENTARY</small><p>'+esc(j.hook)+'</p></div><div class="field"><small>TITLE</small><p>'+esc(j.yt_title||'')+'</p></div><div class="field"><small>DESCRIPTION</small><p>'+esc(j.description||'')+'</p></div><div class="field"><small>TAGS</small><p>'+esc(j.tags||'')+'</p></div></div>';}
function renderJobs(){
  const el=$('#jobs');
  if(!STATE.jobs.length){el.className='jobs empty';el.innerHTML='No production jobs yet.';return;}
  el.className='jobs';
  el.innerHTML=STATE.jobs.map(j=>{
    const hasRender=j.status==='rendered'&&j.render_file;
    const uploaded=j.status==='uploaded';
    const subs=(j.subtitles||[]).join(' / ');
    const sceneNote=j.scene_meta?(j.scene_meta.scene_description||j.scene_meta.visible_action||j.scene_meta.edit_note||'Analyzed'):'';
    let actions='';
    if(!j.hook) actions+='<button onclick="analyzeJob('+j.id+')">Generate package</button>';
    if(j.hook&&!j.scene_file&&!uploaded) actions+='<label class="button-link secondary">Upload scene<input hidden type="file" accept="video/*" onchange="uploadScene('+j.id+',this)"></label>';
    if(j.scene_file&&!hasRender&&!uploaded) actions+='<button onclick="renderJob('+j.id+')">Render enhanced Short</button>';
    if(hasRender) actions+='<button onclick="uploadJob('+j.id+')">Approve and upload</button>';
    let preview='<div class="video-wrap" style="display:grid;place-items:center"><span class="muted">Preview appears after render</span></div>';
    if(hasRender) preview='<div class="video-wrap"><video controls playsinline src="'+BASE+'/api/jobs/'+j.id+'/video?ts='+Date.now()+'"></video></div>';
    if(uploaded) preview='<div class="package"><div class="field"><small>UPLOAD CONFIRMED</small><p><a target="_blank" rel="noreferrer" href="'+esc(j.youtube_url||'#')+'" style="color:#fff">'+esc(j.youtube_url||j.youtube_video_id)+'</a></p></div><div class="field"><small>LOCAL STORAGE</small><p>Transient job videos cleared after confirmation.</p></div></div>';
    return '<article class="job"><div class="job-head"><div><h4>Job #'+j.id+'</h4><div class="muted">'+esc(j.source_url||'')+'</div></div><span class="status '+jobStatusClass(j.status)+'">'+esc(j.status.replaceAll('_',' '))+'</span></div><div class="job-body"><div>'+packageFields(j)+(sceneNote?'<p class="muted"><strong>Scene:</strong> '+esc(sceneNote)+'</p>':'')+(subs?'<p class="muted"><strong>Subtitles:</strong> '+esc(subs)+'</p>':'')+(j.error?'<p style="color:#ef7f7f">'+esc(j.error)+'</p>':'')+'<div class="job-actions">'+actions+'</div></div><div>'+preview+'</div></div></article>';
  }).join('');
}

window.analyzeJob=async id=>{
  try{toast('Gemini analysis started');await api('/api/jobs/'+id+'/analyze',{method:'POST'});toast('Package generated');await refresh();}
  catch(e){toast(e.message,true);await refresh();}
};
window.uploadScene=async(id,input)=>{
  try{
    if(!input.files[0])return;
    const f=new FormData();f.append('scene',input.files[0]);
    toast('Uploading scene');
    await api('/api/jobs/'+id+'/scene',{method:'POST',body:f});
    toast('Scene ready');await refresh();
  }catch(e){toast(e.message,true);}
};
window.renderJob=async id=>{
  try{toast('Rendering on VPS');await api('/api/jobs/'+id+'/render',{method:'POST'});toast('Render ready for review');await refresh();}
  catch(e){toast(e.message,true);await refresh();}
};
window.uploadJob=async id=>{
  const proceed=confirm('Upload this rendered Short to YouTube using the generated package? The temporary job video will be cleared after YouTube confirms the upload.');
  if(!proceed)return;
  try{
    toast('Uploading to YouTube');
    await api('/api/jobs/'+id+'/upload',{method:'POST'});
    toast('Upload confirmed and temporary files cleared');
    await refresh();
  }catch(e){toast(e.message,true);await refresh();}
};
window.discover=async()=>{
  const b=$('#discoverBtn');
  try{
    b.disabled=true;b.textContent='Discovering';
    const d=await api('/api/discover',{method:'POST'});
    toast(d.found+' new sources found');
    await refresh();
  }catch(e){toast(e.message,true);}
  finally{b.disabled=false;b.textContent='Discover 5M+ videos';}
};
$('#competitorForm').addEventListener('submit',async e=>{
  e.preventDefault();
  try{
    const body=Object.fromEntries(new FormData(e.target));
    await api('/api/competitors',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    e.target.reset();await refresh();
  }catch(err){toast(err.message,true);}
});
$('#urlForm').addEventListener('submit',async e=>{
  e.preventDefault();
  try{
    const body=Object.fromEntries(new FormData(e.target));
    const d=await api('/api/jobs/from-url',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    e.target.reset();toast('Job #'+d.jobId+' created');await refresh();
  }catch(err){toast(err.message,true);}
});
$('#secretsForm').addEventListener('submit',async e=>{
  e.preventDefault();
  try{
    const raw=Object.fromEntries(new FormData(e.target));
    const body=Object.fromEntries(Object.entries(raw).filter(([,v])=>String(v).trim()));
    await api('/api/settings/secrets',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    e.target.reset();toast('Configuration saved on VPS');await refresh();
  }catch(err){toast(err.message,true);}
});
$('#settingsForm').addEventListener('submit',async e=>{
  e.preventDefault();
  try{
    const body=Object.fromEntries(new FormData(e.target));
    await api('/api/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    toast('Defaults saved');await refresh();
  }catch(err){toast(err.message,true);}
});

refresh();
