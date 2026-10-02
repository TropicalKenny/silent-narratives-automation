const BASE=location.pathname.startsWith('/silent-narratives')?'/silent-narratives':'';
let STATE=null;
let SHOW_ALL=false;
const $=s=>document.querySelector(s);

function esc(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function compact(n){n=Number(n||0);if(n>=1e9)return(n/1e9).toFixed(1)+'B';if(n>=1e6)return(n/1e6).toFixed(1)+'M';if(n>=1e3)return(n/1e3).toFixed(0)+'K';return String(n);}
function videoId(url=''){try{const u=new URL(url);if(u.pathname.startsWith('/shorts/'))return u.pathname.split('/')[2]||'';if(u.hostname.includes('youtu.be'))return u.pathname.split('/').filter(Boolean)[0]||'';return u.searchParams.get('v')||'';}catch{return'';}}
function thumb(url=''){const id=videoId(url);return id?'https://i.ytimg.com/vi/'+encodeURIComponent(id)+'/hqdefault.jpg':'';}
function statusLabel(s='draft'){return String(s).replaceAll('_',' ');}
function formatSlot(j){
  if(!j?.slot_date||!j?.slot_time)return '';
  const [h,m]=String(j.slot_time).split(':').map(Number);
  const hour=((h+11)%12)+1;
  const ap=h>=12?'PM':'AM';
  return j.slot_date+' · '+hour+':'+String(m||0).padStart(2,'0')+' '+ap+' WAT';
}
function statusTone(s=''){return ['rendered','uploaded','scheduled','scene_ready','analyzed'].includes(s)?'ok':s.includes('error')||s.includes('failed')?'bad':['analyzing','rendering','uploading','scheduling'].includes(s)?'warn':'';}
function toast(msg,error=false){const t=$('#toast');t.textContent=msg;t.className='toast show'+(error?' error':'');clearTimeout(window._toast);window._toast=setTimeout(()=>t.className='toast',3500);}
async function api(url,opts={}){const r=await fetch(url.startsWith('/')?BASE+url:url,opts);let d={};try{d=await r.json();}catch{}if(!r.ok||d.ok===false)throw new Error(d.error||('Request failed '+r.status));return d;}
function openSettings(){$('#settingsDialog').showModal();}
function openSources(){$('#sourcesDialog').showModal();}
window.openSettings=openSettings;window.openSources=openSources;

async function refresh(){
  try{
    STATE=await api('/api/state');
    $('#health').textContent='Online';$('#healthDot').className='ok';
    render();
  }catch(e){
    $('#health').textContent='Offline';$('#healthDot').className='bad';toast(e.message,true);
  }
}
window.refresh=refresh;

function availableSources(){return(STATE?.candidates||[]).filter(c=>c.status==='new');}
function activeJobs(){return(STATE?.jobs||[]).filter(j=>!['uploaded','scheduled','scheduled_cleanup_pending'].includes(j.status));}
function lagosToday(){return new Intl.DateTimeFormat('en-CA',{timeZone:STATE?.settings?.publishingTimezone||'Africa/Lagos',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
function slotLabel(time=''){const [h,m]=String(time).split(':').map(Number);if(!Number.isFinite(h))return time||'';const ap=h>=12?'PM':'AM';const hh=h%12||12;return hh+':'+String(m||0).padStart(2,'0')+' '+ap;}
function jobSlotLabel(j){return j?.slot_time?slotLabel(j.slot_time)+' WAT':'';}

function render(){
  renderChannel();
  renderToday();
  renderSources();
  renderJobs();
  renderMemory();
  renderSlotLearning();
  renderIntegrations();
  renderCompetitors();
  renderSettings();
}

function setAvatar(url){
  for(const [wrap,imgSel,initialSel] of [
    ['.channel-avatar','#channelAvatar','#channelInitials'],
    ['.avatar-btn','#headerAvatar','#headerInitials']
  ]){
    const w=$(wrap),img=$(imgSel);
    if(url){img.src=url;w.classList.add('has-image');}
    else w.classList.remove('has-image');
  }
}

function renderChannel(){
  const ch=STATE.history?.channel||{};
  $('#channelName').textContent=(ch.title||'Silent Narratives').trim();
  $('#subscriberCount').textContent=compact(ch.subscribers||0);
  $('#historyCount').textContent=STATE.history?.count||0;
  $('#readySourceCount').textContent=availableSources().length;
  setAvatar(ch.thumbnail||'');
}

function nextAction(j){
  if(!j.hook)return {label:'Generate package',fn:'analyzeJob('+j.id+')'};
  if(!j.scene_file)return {label:'Add scene',file:true,id:j.id};
  if(j.status!=='rendered'&&j.status!=='uploaded')return {label:'Render Short',fn:'renderJob('+j.id+')'};
  if(j.status==='rendered')return {label:'Review · '+(jobSlotLabel(j)||'ready'),fn:"document.getElementById('job-"+j.id+"').scrollIntoView({behavior:'smooth'})"};
  return {label:'Uploaded',fn:''};
}

function renderToday(){
  const today=lagosToday();
  const slots=STATE?.settings?.publishingSlots||['13:00','15:00','22:00'];
  const todaysJobs=(STATE?.jobs||[]).filter(j=>j.slot_date===today && !['uploaded','scheduled','scheduled_cleanup_pending'].includes(j.status));
  const batchDate=STATE?.settings?.batchActiveDate||'';
  $('#todayProgress').textContent=batchDate ? (todaysJobs.length+' of 3 in production') : 'Paused · waiting for start';
  const sources=availableSources();
  const cards=[];
  for(let i=0;i<slots.length;i++){
    const slot=slots[i];
    const j=todaysJobs.find(x=>x.slot_time===slot);
    const slotName=slotLabel(slot)+' WAT';
    if(j){
      const a=nextAction(j);
      let action='';
      if(a.file){
        action='<label class="file-action-btn">Add scene<input type="file" accept="video/*" onchange="uploadScene('+j.id+',this)"></label>';
      }else{
        action='<button onclick="'+a.fn+'">'+esc(a.label)+'</button>';
      }
      cards.push('<article class="production-card">'+
        '<span class="production-number">VIDEO '+(i+1)+' · '+esc(slotName)+'</span>'+
        '<h3>'+esc(j.yt_title||j.hook||('Production job #'+j.id))+'</h3>'+
        '<p>'+esc(j.hook?'Assigned to today’s '+slotName+' publishing slot.':'Source selected for '+slotName+'. Generate the Gemini package.')+'</p>'+
        '<div class="production-state '+statusTone(j.status)+'"><i></i>'+esc(statusLabel(j.status))+'</div>'+
        action+'</article>');
    }else{
      cards.push('<article class="production-card">'+
        '<span class="production-number">VIDEO '+(i+1)+' · '+esc(slotName)+'</span>'+
        '<h3>Open production slot</h3>'+
        '<p>'+(sources.length?sources.length+' screened recommendations are available.':'Run a source scan to find the next story.')+'</p>'+
        '<div class="production-state"><i></i>open</div>'+
        '<button class="secondary" onclick="'+(sources.length?"document.querySelector('.source-card')?.scrollIntoView({behavior:'smooth',block:'center'})":"discover()")+'">'+(sources.length?'Choose source':'Scan sources')+'</button>'+
        '</article>');
    }
  }
  $('#todayProduction').innerHTML=cards.join('');
}

function renderSources(){
  const all=availableSources();
  const list=SHOW_ALL?all:all.slice(0,6);
  const el=$('#sources');
  if(!all.length){
    el.className='content-list empty-state';
    el.innerHTML='No usable sources yet. Scan your competitor channels to find 5M+ Shorts.';
    $('#sourceMore').innerHTML='';
    return;
  }
  el.className='content-list';
  el.innerHTML=list.map(c=>{
    const image=thumb(c.url);
    return '<article class="source-card">'+
      '<div class="source-thumb">'+(image?'<img loading="lazy" src="'+image+'" alt="">':'')+'</div>'+
      '<div class="source-main"><h3>'+esc(c.title||'Untitled source')+'</h3>'+
      '<p>'+esc(c.competitor_name||c.competitor_handle||'Competitor')+'</p>'+
      '<div class="source-stats"><span><strong>'+compact(c.views)+'</strong> views</span><span>Passed duplicate check</span></div></div>'+
      '<div class="source-actions"><button class="use-btn" onclick="startCut('+c.id+')">Use source</button><button class="open-btn" onclick="window.open(\''+esc(c.url)+'\',\'_blank\')">View</button></div>'+
      '</article>';
  }).join('');
  $('#sourceMore').innerHTML=all.length>6?'<button onclick="toggleSources()">'+(SHOW_ALL?'Show less':'Show all '+all.length)+'</button>':'';
}
window.toggleSources=()=>{SHOW_ALL=!SHOW_ALL;renderSources();};

function renderJobs(){
  const jobs=activeJobs();
  const el=$('#jobs');
  if(!jobs.length){
    el.className='content-list empty-state';
    el.innerHTML='No active jobs yet. Choose a recommended source to begin.';
    return;
  }
  el.className='content-list';
  el.innerHTML=jobs.map(j=>{
    const image=thumb(j.source_url);
    const rendered=j.status==='rendered'&&j.render_file;
    let preview=image?'<img src="'+image+'" alt="">':'Preview';
    if(rendered)preview='<video controls playsinline src="'+BASE+'/api/jobs/'+j.id+'/video?v='+encodeURIComponent(j.updated_at||j.id)+'"></video>';
    let action='';
    if(!j.hook)action='<button onclick="analyzeJob('+j.id+')">Generate package</button>';
    else if(!j.scene_file)action='<label class="file-action-btn">Add scene<input type="file" accept="video/*" onchange="uploadScene('+j.id+',this)"></label>';
    else if(!rendered)action='<button onclick="renderJob('+j.id+')">Render Short</button>';
    else if(j.scheduled_publish_at)action='<button onclick="scheduleJob('+j.id+')">Approve + schedule '+esc(jobSlotLabel(j))+'</button>';
    else action='<button onclick="uploadJob('+j.id+')">Approve + upload private</button>';

    const packageBlock=j.hook?'<details class="job-detail"><summary>Gemini package</summary><div class="package-grid">'+
      '<div class="package-field"><small>HOOK + COMMENTARY</small><p>'+esc(j.hook)+'</p></div>'+
      '<div class="package-field"><small>TITLE</small><p>'+esc(j.yt_title||'')+'</p></div>'+
      '<div class="package-field"><small>DESCRIPTION</small><p>'+esc(j.description||'')+'</p></div>'+
      '<div class="package-field"><small>TAGS</small><p>'+esc(j.tags||'')+'</p></div>'+
      '</div></details>':'';

    return '<article class="job-card" id="job-'+j.id+'"><div class="job-top">'+
      '<div class="job-preview">'+preview+'</div>'+
      '<div class="job-copy"><h3>'+esc(j.yt_title||j.hook||('Production job #'+j.id))+'</h3>'+
      '<p>'+esc(j.hook||j.source_url||'Source selected')+'</p>'+
      '<div class="job-status '+statusTone(j.status)+'"><i></i>'+esc(statusLabel(j.status))+(j.slot_time?' · '+esc(formatSlot(j)):'')+'</div></div>'+
      '<div class="job-action">'+action+'</div></div>'+packageBlock+'</article>';
  }).join('');
}


function renderSlotLearning(){
  const el=$('#slotLearning');
  if(!el)return;
  const perf=STATE.performance||{};
  const checkpoints=Array.isArray(perf.checkpoints)?perf.checkpoints:[];
  const slots=STATE.settings?.publishingSlots||['13:00','15:00','22:00'];
  const order={'1h':1,'6h':2,'24h':3,'48h':4,'7d':5};

  el.innerHTML=slots.map(slot=>{
    const rows=checkpoints.filter(r=>r.slot_time===slot);
    const captured=rows.filter(r=>r.captured_at)
      .sort((a,b)=>(order[b.checkpoint]||0)-(order[a.checkpoint]||0))[0];
    const pending=rows.filter(r=>!r.captured_at)
      .sort((a,b)=>(order[a.checkpoint]||99)-(order[b.checkpoint]||99))[0];

    let value='Collecting data';
    if(captured){
      value=captured.checkpoint+' · '+compact(captured.views||0)+' views';
    }else if(pending){
      value=pending.checkpoint+' checkpoint pending';
    }
    return '<div class="history-row"><strong>'+esc(slotLabel(slot)+' WAT')+'</strong><span>'+esc(value)+'</span></div>';
  }).join('');
}

function renderMemory(){
  const h=STATE.history||{};
  $('#memoryCount').textContent=h.count||0;
  const recent=(h.recent||[]).slice(0,4);
  $('#recentHistory').innerHTML=recent.map(v=>'<div class="history-row"><strong>'+esc(v.title||'Untitled')+'</strong><span>'+compact(v.views)+' views</span></div>').join('');
  const blocked=h.channel?.duplicateBlocked||0;
  if(blocked){
    $('#recentHistory').insertAdjacentHTML('beforeend','<div class="history-row"><strong>Duplicate sources blocked</strong><span>'+blocked+'</span></div>');
  }
}

function renderIntegrations(){
  const i=STATE.integrations;
  const items=[['Gemini',i.gemini],['YouTube data',i.youtubeData],['Google OAuth',i.googleOAuth],['Channel upload',i.youtubeConnected],['Gameplay',STATE.assets.background]];
  $('#integrations').innerHTML=items.map(([name,ready])=>'<span class="integration-chip '+(ready?'ok':'bad')+'"><i></i>'+esc(name)+'</span>').join('');
  $('#backgroundStatus').textContent=STATE.assets.background?'· Ready':'· Missing';
}

function renderCompetitors(){
  const el=$('#competitors');
  if(!STATE.competitors.length){el.innerHTML='<div class="empty-state">No competitor channels added.</div>';return;}
  el.innerHTML=STATE.competitors.map(c=>'<div class="competitor-item"><div><strong>'+esc(c.name||c.handle)+'</strong><span>'+esc(c.handle||'')+'</span></div><button type="button" onclick="removeCompetitor('+c.id+')">Remove</button></div>').join('');
}
function renderSettings(){
  const f=$('#settingsForm');
  f.minViews.value=STATE.settings.minViews;
  f.privacy.value=STATE.settings.privacy;
  f.publicBaseUrl.value=STATE.settings.publicBaseUrl||'';
}

window.startCut=async id=>{try{const d=await api('/api/jobs/from-candidate/'+id,{method:'POST'});toast('Production job #'+d.jobId+' created');await refresh();document.getElementById('activeProductionSection').scrollIntoView({behavior:'smooth'});}catch(e){toast(e.message,true);}};
window.removeCompetitor=async id=>{try{await api('/api/competitors/'+id,{method:'DELETE'});await refresh();}catch(e){toast(e.message,true);}};
window.analyzeJob=async id=>{try{toast('Gemini analysis started');await api('/api/jobs/'+id+'/analyze',{method:'POST'});toast('Package generated');await refresh();}catch(e){toast(e.message,true);await refresh();}};
window.uploadScene=async(id,input)=>{try{if(!input.files[0])return;const f=new FormData();f.append('scene',input.files[0]);toast('Uploading scene');await api('/api/jobs/'+id+'/scene',{method:'POST',body:f});toast('Scene ready');await refresh();}catch(e){toast(e.message,true);}};
window.renderJob=async id=>{try{toast('Rendering on VPS');await api('/api/jobs/'+id+'/render',{method:'POST'});toast('Render ready');await refresh();}catch(e){toast(e.message,true);await refresh();}};
window.scheduleJob=async id=>{
  const j=(STATE.jobs||[]).find(x=>x.id===id);
  const slot=formatSlot(j);
  if(!confirm('Schedule this approved Short for '+slot+'? It will upload to YouTube as private and YouTube will publish it at the assigned time. Temporary video files will be deleted after YouTube confirms the scheduled upload.'))return;
  try{
    toast('Scheduling on YouTube');
    const d=await api('/api/jobs/'+id+'/schedule',{method:'POST'});
    toast('Scheduled for '+slot+' · temporary videos deleted');
    await refresh();
  }catch(e){toast(e.message,true);await refresh();}
};
window.uploadJob=async id=>{if(!confirm('Upload this Short to YouTube as '+STATE.settings.privacy+'? Temporary video files will be deleted after YouTube confirms the upload.'))return;try{toast('Uploading to YouTube');await api('/api/jobs/'+id+'/upload',{method:'POST'});toast('Upload confirmed · temporary videos deleted');await refresh();}catch(e){toast(e.message,true);await refresh();}};
window.discover=async()=>{const b=$('#discoverBtn');try{b.disabled=true;b.textContent='Scanning…';const d=await api('/api/discover',{method:'POST'});toast(d.found+' new sources found · duplicate check complete');await refresh();}catch(e){toast(e.message,true);}finally{b.disabled=false;b.textContent='Scan sources';}};
window.syncHistory=async()=>{const b=$('#syncHistoryBtn');try{b.disabled=true;b.textContent='Syncing…';const d=await api('/api/history/sync',{method:'POST'});toast(d.synced+' uploads indexed · '+(d.screening?.duplicates||0)+' repeats blocked');await refresh();}catch(e){toast(e.message,true);}finally{b.disabled=false;b.textContent='Sync channel';}};

$('#competitorForm').addEventListener('submit',async e=>{e.preventDefault();try{const body=Object.fromEntries(new FormData(e.target));await api('/api/competitors',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});e.target.reset();toast('Competitor added');await refresh();}catch(err){toast(err.message,true);}});
$('#urlForm').addEventListener('submit',async e=>{e.preventDefault();try{const body=Object.fromEntries(new FormData(e.target));const d=await api('/api/jobs/from-url',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});e.target.reset();$('#sourcesDialog').close();toast('Production job #'+d.jobId+' created');await refresh();}catch(err){toast(err.message,true);}});
$('#secretsForm').addEventListener('submit',async e=>{e.preventDefault();try{const raw=Object.fromEntries(new FormData(e.target));const body=Object.fromEntries(Object.entries(raw).filter(([,v])=>String(v).trim()));await api('/api/settings/secrets',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});e.target.reset();toast('Connections saved');await refresh();}catch(err){toast(err.message,true);}});
$('#settingsForm').addEventListener('submit',async e=>{e.preventDefault();try{const body=Object.fromEntries(new FormData(e.target));await api('/api/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});toast('Publishing defaults saved');await refresh();}catch(err){toast(err.message,true);}});


$('#collectPerformanceBtn')?.addEventListener('click',async()=>{
  const b=$('#collectPerformanceBtn');
  try{
    b.disabled=true;
    b.textContent='Refreshing…';
    await api('/api/performance/collect',{method:'POST'});
    await refresh();
    toast('Performance checkpoints refreshed');
  }catch(e){
    toast(e.message,true);
  }finally{
    b.disabled=false;
    b.textContent='Refresh metrics';
  }
});

const qs=new URLSearchParams(location.search);
if(qs.get('background')==='ready')setTimeout(()=>toast('Gameplay background ready'),250);
if(qs.get('background_error'))setTimeout(()=>toast(qs.get('background_error'),true),250);
refresh();
