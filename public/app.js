const BASE=location.pathname.startsWith('/silent-narratives')?'/silent-narratives':'';
let STATE=null;
let SHOW_ALL_CANDIDATES=false;
const $=s=>document.querySelector(s);

function esc(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function compact(n){n=Number(n||0);if(n>=1e9)return(n/1e9).toFixed(1)+'B';if(n>=1e6)return(n/1e6).toFixed(1)+'M';if(n>=1e3)return(n/1e3).toFixed(0)+'K';return String(n);}
function toast(msg,error=false){const t=$('#toast');t.textContent=msg;t.className='toast show'+(error?' error':'');clearTimeout(window._toast);window._toast=setTimeout(()=>t.className='toast',3500);}
async function api(url,opts={}){const target=url.startsWith('/')?BASE+url:url;const r=await fetch(target,opts);let d={};try{d=await r.json();}catch{}if(!r.ok||d.ok===false)throw new Error(d.error||('Request failed '+r.status));return d;}
function scrollToId(id){document.getElementById(id)?.scrollIntoView({behavior:'smooth',block:'start'});}
function videoIdFromUrl(url=''){try{const u=new URL(url);if(u.pathname.startsWith('/shorts/'))return u.pathname.split('/')[2]||'';if(u.hostname.includes('youtu.be'))return u.pathname.split('/').filter(Boolean)[0]||'';return u.searchParams.get('v')||'';}catch{return'';}}
function statusClass(s=''){return ['rendered','uploaded','scene_ready','analyzed'].includes(s)?'ok':s.includes('error')||s.includes('failed')?'bad':['analyzing','rendering','uploading'].includes(s)?'warn':'';}
function statusLabel(s='draft'){return String(s).replaceAll('_',' ');}

function setDate(){
  const d=new Date();
  $('#todayDate').textContent=d.toLocaleDateString(undefined,{weekday:'short',day:'2-digit',month:'short',year:'numeric'}).toUpperCase();
}

async function refresh(){
  try{
    STATE=await api('/api/state');
    $('#health').textContent='VPS online';
    $('#healthDot').className='health-dot ok';
    render();
  }catch(e){
    $('#health').textContent='Unavailable';
    $('#healthDot').className='health-dot bad';
    toast(e.message,true);
  }
}
window.refresh=refresh;

function render(){
  renderIntegrations();
  renderHistory();
  renderCompetitors();
  renderCandidates();
  renderSlate();
  renderJobs();

  const bg=$('#backgroundStatus');
  bg.textContent=STATE.assets.background?'Ready':'Missing';
  bg.className='inline-status '+(STATE.assets.background?'ok':'warn');

  const sf=$('#settingsForm');
  sf.minViews.value=STATE.settings.minViews;
  sf.privacy.value=STATE.settings.privacy;
  sf.publicBaseUrl.value=STATE.settings.publicBaseUrl||'';

  const available=STATE.candidates.filter(c=>!['selected','used'].includes(c.status)).length;
  $('#sourceCountTop').textContent=available;
}

function renderIntegrations(){
  const i=STATE.integrations;
  const items=[
    ['Gemini',i.gemini],
    ['YouTube data',i.youtubeData],
    ['Google OAuth',i.googleOAuth],
    ['Channel upload',i.youtubeConnected],
    ['Gameplay',STATE.assets.background]
  ];
  $('#integrations').innerHTML=items.map(([name,ready])=>
    '<span class="system-item '+(ready?'ready':'blocked')+'"><i></i>'+esc(name)+' · '+(ready?'ready':'setup needed')+'</span>'
  ).join('');
}

function renderHistory(){
  const h=STATE.history||{count:0,recent:[]};
  $('#historyCount').textContent=h.count||0;
  $('#historyCountTop').textContent=h.count||0;
  const latest=h.recent?.[0];
  $('#historyRecent').textContent=latest
    ? 'Latest: '+(latest.title||'Untitled')+' · '+compact(latest.views)+' views'
    : 'No history synced yet.';
}

function renderCompetitors(){
  const el=$('#competitors');
  if(!STATE.competitors.length){
    el.innerHTML='<span class="memory-recent">No competitor sources added.</span>';
    return;
  }
  el.innerHTML=STATE.competitors.map(c=>
    '<span class="competitor-item"><strong>'+esc(c.name||c.handle)+'</strong><button title="Remove source" aria-label="Remove '+esc(c.name||c.handle)+'" onclick="removeCompetitor('+c.id+')">×</button></span>'
  ).join('');
}

function renderCandidates(){
  const all=STATE.candidates.filter(c=>!['selected','used'].includes(c.status)).slice(0,30);
  $('#candidateCount').textContent=all.length+' available';
  const el=$('#candidates'),more=$('#candidateMore');
  if(!all.length){
    el.className='source-list empty-state';
    el.innerHTML='No unused 5M+ sources yet.';
    more.innerHTML='';
    return;
  }
  const list=SHOW_ALL_CANDIDATES?all:all.slice(0,6);
  el.className='source-list';
  el.innerHTML=list.map(c=>{
    const vid=c.video_id||videoIdFromUrl(c.url);
    const thumb=vid?'https://i.ytimg.com/vi/'+encodeURIComponent(vid)+'/hqdefault.jpg':'';
    return '<article class="source-row">'+
      '<div class="source-thumb">'+(thumb?'<img loading="lazy" src="'+thumb+'" alt="">':'')+'</div>'+
      '<div class="source-copy"><a target="_blank" rel="noreferrer" href="'+esc(c.url)+'">'+esc(c.title||'Untitled source')+'</a><span>'+esc(c.competitor_name||c.competitor_handle||'Competitor source')+'</span></div>'+
      '<div class="source-proof"><strong>'+compact(c.views)+'</strong><span>views</span></div>'+
      '<button class="use-source" onclick="selectCandidate('+c.id+')">Use source</button>'+
      '</article>';
  }).join('');
  more.innerHTML=all.length>6
    ? '<button onclick="toggleCandidates()">'+(SHOW_ALL_CANDIDATES?'Show top 6':'Show all '+all.length)+'</button>'
    : '';
}

window.toggleCandidates=()=>{SHOW_ALL_CANDIDATES=!SHOW_ALL_CANDIDATES;renderCandidates();};

function nextJobAction(j){
  if(!j.hook)return {label:'Generate package',fn:'analyzeJob('+j.id+')',note:'Gemini analysis is next'};
  if(!j.scene_file)return {label:'Add scene',fn:'scrollToId(\'job-'+j.id+'\')',note:'Exact movie/TV clip needed'};
  if(j.status!=='rendered'&&j.status!=='uploaded')return {label:'Render Short',fn:'renderJob('+j.id+')',note:'Scene is ready'};
  if(j.status==='rendered')return {label:'Review render',fn:'scrollToId(\'job-'+j.id+'\')',note:'Approval required before upload'};
  return {label:'View upload',fn:'scrollToId(\'job-'+j.id+'\')',note:'YouTube confirmed'};
}

function renderSlate(){
  const el=$('#slate');
  const jobs=STATE.jobs.filter(j=>j.status!=='uploaded').slice(0,3);
  const available=STATE.candidates.filter(c=>!['selected','used'].includes(c.status)).length;
  const rows=[];
  for(let i=0;i<3;i++){
    const j=jobs[i];
    const n=String(i+1).padStart(2,'0');
    if(j){
      const action=nextJobAction(j);
      const title=j.yt_title||j.hook||('Job #'+j.id+' · source selected');
      rows.push('<div class="slate-row '+(i===0?'current':'')+'">'+
        '<div class="slate-no">'+n+'</div>'+
        '<div class="slate-main"><small>PRODUCTION SLOT</small><strong>'+esc(title)+'</strong><span>'+esc(action.note)+'</span></div>'+
        '<div class="slate-state"><small>STATE</small><strong>'+esc(statusLabel(j.status))+'</strong></div>'+
        '<button class="slate-action" onclick="'+action.fn+'">'+esc(action.label)+'</button>'+
      '</div>');
    }else{
      rows.push('<div class="slate-row '+(i===jobs.length?'current':'')+'">'+
        '<div class="slate-no">'+n+'</div>'+
        '<div class="slate-main"><small>OPEN SLOT</small><strong>'+(available?'Choose a proven story':'No source selected')+'</strong><span>'+(available?available+' high-view sources are ready below.':'Run source discovery to fill this slot.')+'</span></div>'+
        '<div class="slate-state"><small>STATE</small><strong>open</strong></div>'+
        '<button class="slate-action" onclick="'+(available?"scrollToId('sourceTitle')":"discover()")+'">'+(available?'Choose source':'Scan sources')+'</button>'+
      '</div>');
    }
  }
  el.innerHTML=rows.join('');
}
window.scrollToId=scrollToId;

function packageFields(j){
  if(!j.hook)return '';
  return '<details class="package-details"><summary>View Gemini package</summary><div class="package-grid">'+
    '<div class="package-field"><small>HOOK + COMMENTARY</small><p>'+esc(j.hook)+'</p></div>'+
    '<div class="package-field"><small>TITLE</small><p>'+esc(j.yt_title||'')+'</p></div>'+
    '<div class="package-field"><small>DESCRIPTION</small><p>'+esc(j.description||'')+'</p></div>'+
    '<div class="package-field"><small>TAGS</small><p>'+esc(j.tags||'')+'</p></div>'+
  '</div></details>';
}

function renderJobs(){
  const el=$('#jobs');
  if(!STATE.jobs.length){
    el.className='cuts empty-state';
    el.innerHTML='No production jobs yet.';
    return;
  }
  el.className='cuts';
  el.innerHTML=STATE.jobs.map((j,index)=>{
    const hasRender=j.status==='rendered'&&j.render_file;
    const uploaded=j.status==='uploaded';
    const sceneNote=j.scene_meta?(j.scene_meta.scene_description||j.scene_meta.visible_action||j.scene_meta.edit_note||'Scene analyzed'):'';
    let actions='';
    if(!j.hook)actions+='<button onclick="analyzeJob('+j.id+')">Generate Gemini package</button>';
    if(j.hook&&!j.scene_file&&!uploaded)actions+='<label class="file-action">Add movie scene<input type="file" accept="video/*" onchange="uploadScene('+j.id+',this)"></label>';
    if(j.scene_file&&!hasRender&&!uploaded)actions+='<button onclick="renderJob('+j.id+')">Render Short</button>';
    if(hasRender)actions+='<button onclick="uploadJob('+j.id+')">Approve + upload private</button>';

    let preview='<div class="preview-frame">Preview appears after render</div>';
    if(hasRender)preview='<div class="preview-frame"><video controls playsinline src="'+BASE+'/api/jobs/'+j.id+'/video?ts='+Date.now()+'"></video></div>';
    if(uploaded)preview='<div class="preview-frame"><div><strong>Upload confirmed</strong><br><a class="text-link" target="_blank" rel="noreferrer" href="'+esc(j.youtube_url||'#')+'">Open on YouTube</a><br><span>Local job video cleared</span></div></div>';

    return '<article class="cut" id="job-'+j.id+'">'+
      '<div class="cut-index">CUT<strong>'+String(index+1).padStart(2,'0')+'</strong></div>'+
      '<div class="cut-main">'+
        '<h3>'+esc(j.yt_title||j.hook||('Job #'+j.id))+'</h3>'+
        '<span class="source-url">'+esc(j.source_url||'')+'</span>'+
        (j.hook?'<p class="cut-hook">'+esc(j.hook)+'</p>':'<p class="cut-hook">Source selected. Generate the Gemini package to continue.</p>')+
        '<div class="cut-meta">'+
          '<span>JOB '+j.id+'</span><span>'+esc(statusLabel(j.status).toUpperCase())+'</span>'+
          (sceneNote?'<span>SCENE: '+esc(sceneNote)+'</span>':'')+
          ((j.subtitles||[]).length?'<span>SUBTITLES: '+esc((j.subtitles||[]).join(' / '))+'</span>':'')+
        '</div>'+
        (j.error?'<p class="cut-error">'+esc(j.error)+'</p>':'')+
        '<div class="cut-actions">'+actions+'</div>'+
        packageFields(j)+
      '</div>'+
      '<div class="cut-preview">'+preview+'<span class="cut-status '+statusClass(j.status)+'">'+esc(statusLabel(j.status))+'</span></div>'+
    '</article>';
  }).join('');
}

window.removeCompetitor=async id=>{try{await api('/api/competitors/'+id,{method:'DELETE'});await refresh();}catch(e){toast(e.message,true);}};
window.selectCandidate=async id=>{try{const d=await api('/api/jobs/from-candidate/'+id,{method:'POST'});toast('Production job #'+d.jobId+' created');await refresh();scrollToId('slateTitle');}catch(e){toast(e.message,true);}};
window.analyzeJob=async id=>{try{toast('Gemini analysis started');await api('/api/jobs/'+id+'/analyze',{method:'POST'});toast('Package generated');await refresh();}catch(e){toast(e.message,true);await refresh();}};
window.uploadScene=async(id,input)=>{try{if(!input.files[0])return;const f=new FormData();f.append('scene',input.files[0]);toast('Uploading movie scene');await api('/api/jobs/'+id+'/scene',{method:'POST',body:f});toast('Scene ready');await refresh();}catch(e){toast(e.message,true);}};
window.renderJob=async id=>{try{toast('Rendering on VPS');await api('/api/jobs/'+id+'/render',{method:'POST'});toast('Render ready for review');await refresh();scrollToId('job-'+id);}catch(e){toast(e.message,true);await refresh();}};
window.uploadJob=async id=>{
  if(!confirm('Upload this rendered Short to YouTube as '+STATE.settings.privacy+'? Temporary source, intermediate and final files will be deleted after YouTube confirms the upload.'))return;
  try{toast('Uploading to YouTube');await api('/api/jobs/'+id+'/upload',{method:'POST'});toast('Upload confirmed · temporary videos deleted');await refresh();}catch(e){toast(e.message,true);await refresh();}
};
window.discover=async()=>{
  const b=$('#discoverBtn');
  try{b.disabled=true;b.textContent='Scanning sources…';const d=await api('/api/discover',{method:'POST'});toast(d.found+' new sources found');await refresh();}
  catch(e){toast(e.message,true);}
  finally{b.disabled=false;b.textContent='Scan 5M+ sources';}
};
window.syncHistory=async()=>{
  const b=$('#syncHistoryBtn');
  try{b.disabled=true;b.textContent='Syncing…';const d=await api('/api/history/sync',{method:'POST'});toast(d.synced+' channel videos indexed');await refresh();}
  catch(e){toast(e.message,true);}
  finally{b.disabled=false;b.textContent='Sync channel';}
};

$('#competitorForm').addEventListener('submit',async e=>{
  e.preventDefault();
  try{const body=Object.fromEntries(new FormData(e.target));await api('/api/competitors',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});e.target.reset();toast('Source added');await refresh();}
  catch(err){toast(err.message,true);}
});
$('#urlForm').addEventListener('submit',async e=>{
  e.preventDefault();
  try{const body=Object.fromEntries(new FormData(e.target));const d=await api('/api/jobs/from-url',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});e.target.reset();toast('Production job #'+d.jobId+' created');await refresh();scrollToId('slateTitle');}
  catch(err){toast(err.message,true);}
});
$('#secretsForm').addEventListener('submit',async e=>{
  e.preventDefault();
  try{const raw=Object.fromEntries(new FormData(e.target));const body=Object.fromEntries(Object.entries(raw).filter(([,v])=>String(v).trim()));await api('/api/settings/secrets',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});e.target.reset();toast('Connections saved');await refresh();}
  catch(err){toast(err.message,true);}
});
$('#settingsForm').addEventListener('submit',async e=>{
  e.preventDefault();
  try{const body=Object.fromEntries(new FormData(e.target));await api('/api/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});toast('Publishing defaults saved');await refresh();}
  catch(err){toast(err.message,true);}
});

setDate();
const qs=new URLSearchParams(location.search);
if(qs.get('background')==='ready')setTimeout(()=>toast('Gameplay background ready'),250);
if(qs.get('background_error'))setTimeout(()=>toast(qs.get('background_error'),true),250);
refresh();
