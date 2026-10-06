import fs from 'node:fs';
import { getSecret, setSecret, setSecrets } from './secrets.js';
import { parseTags } from './utils.js';

const apiBase='https://www.googleapis.com/youtube/v3';

async function jsonFetch(url, options={}) {
  const r=await fetch(url,{...options,signal:options.signal||AbortSignal.timeout(20000)});
  const body=await r.text();
  let data={};
  try { data=body?JSON.parse(body):{}; } catch { data={raw:body}; }
  if(!r.ok){const error=new Error(data?.error?.message||data?.error_description||('YouTube HTTP '+r.status));error.status=r.status;throw error;}
  return {data,headers:r.headers,status:r.status};
}

export async function resolveChannel(handle) {
  const key=getSecret('youtube_api_key');
  if(!key) throw new Error('YouTube Data API key is not configured.');
  const h=String(handle).trim().replace(/^@/,'');
  const u=new URL(apiBase+'/channels');
  u.searchParams.set('part','id,snippet');
  u.searchParams.set('forHandle',h);
  u.searchParams.set('key',key);
  const {data}=await jsonFetch(u);
  const c=data.items?.[0];
  if(!c) throw new Error('Channel handle could not be resolved.');
  return {channelId:c.id,name:c.snippet?.title || '@'+h};
}

export async function popularVideos(channelId,minViews=5000000) {
  const key=getSecret('youtube_api_key');
  if(!key) throw new Error('YouTube Data API key is not configured.');
  const s=new URL(apiBase+'/search');
  s.searchParams.set('part','snippet');
  s.searchParams.set('channelId',channelId);
  s.searchParams.set('type','video');
  s.searchParams.set('order','viewCount');
  s.searchParams.set('videoDuration','short');
  s.searchParams.set('maxResults','25');
  s.searchParams.set('key',key);
  const sr=(await jsonFetch(s)).data;
  const ids=(sr.items||[]).map(i=>i.id?.videoId).filter(Boolean);
  if(!ids.length) return [];
  const v=new URL(apiBase+'/videos');
  v.searchParams.set('part','snippet,statistics,contentDetails');
  v.searchParams.set('id',ids.join(','));
  v.searchParams.set('key',key);
  const vr=(await jsonFetch(v)).data;
  return (vr.items||[]).map(x=>({
    videoId:x.id,
    title:x.snippet?.title||'',
    views:Number(x.statistics?.viewCount||0),
    publishedAt:x.snippet?.publishedAt||null,
    url:'https://www.youtube.com/shorts/'+x.id
  })).filter(x=>x.views>=minViews).sort((a,b)=>b.views-a.views);
}

export function youtubeAuthUrl(baseUrl,state,{analytics=false,backup=false}={}) {
  const clientId=getSecret('google_client_id');
  if(!clientId) throw new Error('Google OAuth client ID is not configured.');
  const redirect=baseUrl.replace(/\/$/,'')+'/oauth/youtube/callback';
  const u=new URL('https://accounts.google.com/o/oauth2/v2/auth');
  u.searchParams.set('client_id',clientId);
  u.searchParams.set('redirect_uri',redirect);
  u.searchParams.set('response_type','code');
  u.searchParams.set('access_type','offline');
  u.searchParams.set('prompt','consent');
  if(state)u.searchParams.set('state',state);
  const scopes=['https://www.googleapis.com/auth/youtube.upload','https://www.googleapis.com/auth/youtube.readonly','https://www.googleapis.com/auth/youtube.force-ssl'];
  if(analytics)scopes.push('https://www.googleapis.com/auth/yt-analytics.readonly');
  if(backup)scopes.push('https://www.googleapis.com/auth/drive.file');
  u.searchParams.set('scope',scopes.join(' '));
  u.searchParams.set('include_granted_scopes','true');
  return u.toString();
}

export async function exchangeYoutubeCode(code,baseUrl,expectedChannelId) {
  const clientId=getSecret('google_client_id');
  const clientSecret=getSecret('google_client_secret');
  if(!clientId||!clientSecret) throw new Error('Google OAuth client credentials are incomplete.');
  const redirect=baseUrl.replace(/\/$/,'')+'/oauth/youtube/callback';
  const body=new URLSearchParams({code,client_id:clientId,client_secret:clientSecret,redirect_uri:redirect,grant_type:'authorization_code'});
  const {data}=await jsonFetch('https://oauth2.googleapis.com/token',{
    method:'POST',
    headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body
  });
  const channel=await channelIdentity(data.access_token);
  if(expectedChannelId&&channel.id!==expectedChannelId)throw new Error('This Google account does not own the configured Silent Narratives channel.');
  setSecrets({...(data.refresh_token?{youtube_refresh_token:data.refresh_token}:{}),...(data.scope?{youtube_oauth_scopes:data.scope}:{}),youtube_access_token:data.access_token,youtube_access_expiry:String(Date.now()+((data.expires_in||3600)-60)*1000)});
  return true;
}

export async function accessToken() {
  const current=getSecret('youtube_access_token');
  const expiry=Number(getSecret('youtube_access_expiry')||0);
  if(current && Date.now()<expiry) return current;

  const refresh=getSecret('youtube_refresh_token');
  const clientId=getSecret('google_client_id');
  const clientSecret=getSecret('google_client_secret');
  if(!refresh||!clientId||!clientSecret) throw new Error('YouTube is not connected.');

  const body=new URLSearchParams({
    client_id:clientId,
    client_secret:clientSecret,
    refresh_token:refresh,
    grant_type:'refresh_token'
  });
  const {data}=await jsonFetch('https://oauth2.googleapis.com/token',{
    method:'POST',
    headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body
  });
  setSecrets({youtube_access_token:data.access_token,youtube_access_expiry:String(Date.now()+((data.expires_in||3600)-60)*1000),...(data.scope?{youtube_oauth_scopes:data.scope}:{})});
  return data.access_token;
}


async function channelIdentity(token) {
  const u=new URL(apiBase+'/channels');u.searchParams.set('part','id,snippet');u.searchParams.set('mine','true');
  const {data}=await jsonFetch(u,{headers:{Authorization:'Bearer '+token}});
  const channel=data.items?.[0];if(!channel)throw new Error('The connected YouTube channel could not be verified.');
  return {id:channel.id,title:channel.snippet?.title||''};
}
export async function publicVideoDetails(videoId) {
  const key=getSecret('youtube_api_key');if(!key)throw new Error('Configure the YouTube Data API before using a direct source.');
  const u=new URL(apiBase+'/videos');u.searchParams.set('part','snippet,statistics,contentDetails');u.searchParams.set('id',videoId);u.searchParams.set('key',key);
  const {data}=await jsonFetch(u);const v=data.items?.[0];if(!v)throw new Error('That public YouTube source could not be read.');
  const duration=v.contentDetails?.duration||'',match=duration.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/);
  if(!match||Number(match[1]||0)*3600+Number(match[2]||0)*60+Number(match[3]||0)>180)throw new Error('Use a source no longer than three minutes.');
  return {videoId:v.id,title:v.snippet?.title||'',views:Number(v.statistics?.viewCount||0),publishedAt:v.snippet?.publishedAt||null,duration};
}

export async function ownChannelVideos() {
  const token=await accessToken();
  const auth={Authorization:'Bearer '+token};

  const channelsUrl=new URL(apiBase+'/channels');
  channelsUrl.searchParams.set('part','id,snippet,contentDetails,statistics');
  channelsUrl.searchParams.set('mine','true');
  const channelData=(await jsonFetch(channelsUrl,{headers:auth})).data;
  const channel=channelData.items?.[0];
  if(!channel) throw new Error('Connected YouTube channel could not be read.');
  const uploads=channel.contentDetails?.relatedPlaylists?.uploads;
  if(!uploads) throw new Error('YouTube uploads playlist was not returned.');

  const ids=[];
  let pageToken='';
  do {
    const u=new URL(apiBase+'/playlistItems');
    u.searchParams.set('part','contentDetails');
    u.searchParams.set('playlistId',uploads);
    u.searchParams.set('maxResults','50');
    if(pageToken) u.searchParams.set('pageToken',pageToken);
    const data=(await jsonFetch(u,{headers:auth})).data;
    for(const item of data.items||[]) if(item.contentDetails?.videoId) ids.push(item.contentDetails.videoId);
    pageToken=data.nextPageToken||'';
  } while(pageToken && ids.length<1000);

  const videos=[];
  for(let i=0;i<ids.length;i+=50){
    const batch=ids.slice(i,i+50);
    const u=new URL(apiBase+'/videos');
    u.searchParams.set('part','snippet,statistics,contentDetails,status');
    u.searchParams.set('id',batch.join(','));
    const data=(await jsonFetch(u,{headers:auth})).data;
    for(const x of data.items||[]) videos.push({
      videoId:x.id,
      title:x.snippet?.title||'',
      description:x.snippet?.description||'',
      publishedAt:x.snippet?.publishedAt||null,
      views:Number(x.statistics?.viewCount||0),
      duration:x.contentDetails?.duration||null,
      privacy:x.status?.privacyStatus||null
    });
  }
  videos.sort((a,b)=>String(b.publishedAt||'').localeCompare(String(a.publishedAt||'')));
  return {channel:{
    id:channel.id,
    title:channel.snippet?.title||'Silent Narratives',
    thumbnail:channel.snippet?.thumbnails?.high?.url||channel.snippet?.thumbnails?.medium?.url||channel.snippet?.thumbnails?.default?.url||'',
    subscriberCount:Number(channel.statistics?.subscriberCount||0),
    viewCount:Number(channel.statistics?.viewCount||0),
    videoCount:Number(channel.statistics?.videoCount||videos.length)
  },videos};
}

export async function uploadVideo({file,title,description,tags,privacy='private',publishAt=null,expectedChannelId,resumeSession=null,onSession=()=>{},onVideoConfirmed=()=>{}}) {
  const token=await accessToken(),size=fs.statSync(file).size;
  if(!expectedChannelId)throw new Error('Sync the intended YouTube channel before uploading.');
  const channel=await channelIdentity(token);
  if(channel.id!==expectedChannelId)throw new Error('The connected Google account does not match Silent Narratives.');
  const auth={Authorization:'Bearer '+token};
  let location=resumeSession,offset=0;
  function confirmed(data,status){
    if(!data?.id)throw new Error('YouTube did not confirm a video ID. Keep this upload session for reconciliation.');
    const result={videoId:data.id,url:'https://youtu.be/'+data.id,status,youtubeStatus:data.status||null};onVideoConfirmed(result);return result;
  }
  if(location){
    const u=new URL(location);if(u.protocol!=='https:'||u.hostname!=='www.googleapis.com')throw new Error('The saved upload session is invalid.');
    const response=await fetch(location,{method:'PUT',headers:{...auth,'Content-Length':'0','Content-Range':'bytes */'+size},signal:AbortSignal.timeout(20000)});
    if(response.status===200||response.status===201)return confirmed(await response.json(),response.status);
    if(response.status!==308)throw new Error('The previous upload needs reconciliation (YouTube HTTP '+response.status+'). A new video was not created.');
    const range=response.headers.get('range'),match=range?.match(/bytes=0-(\d+)/);offset=match?Number(match[1])+1:0;
    if(offset>=size)throw new Error('YouTube has all bytes but has not returned the video ID. Verify the existing upload before retrying.');
  }else{
    const metadata={snippet:{title,description,tags:parseTags(tags),categoryId:'1'},status:{privacyStatus:publishAt?'private':privacy,selfDeclaredMadeForKids:false,...(publishAt?{publishAt}:{})}};
    const response=await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',{method:'POST',headers:{...auth,'Content-Type':'application/json; charset=UTF-8','X-Upload-Content-Type':'video/mp4','X-Upload-Content-Length':String(size)},body:JSON.stringify(metadata),signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw new Error('YouTube could not start the upload (HTTP '+response.status+').');
    location=response.headers.get('location');if(!location)throw new Error('YouTube did not return an upload session.');
    onSession(location);
  }
  const response=await fetch(location,{method:'PUT',headers:{...auth,'Content-Type':'video/mp4','Content-Length':String(size-offset),'Content-Range':'bytes '+offset+'-'+(size-1)+'/'+size},body:fs.createReadStream(file,{start:offset}),duplex:'half',signal:AbortSignal.timeout(240000)});
  const raw=await response.text();let data;try{data=JSON.parse(raw);}catch{}
  if(!response.ok)throw new Error(data?.error?.message||('YouTube upload was interrupted (HTTP '+response.status+'). The existing session is retained.'));
  return confirmed(data,response.status);
}



export async function deleteVideo(videoId) {
  const token=await accessToken();
  const u=new URL(apiBase+'/videos');u.searchParams.set('id',String(videoId));
  await jsonFetch(u,{method:'DELETE',headers:{Authorization:'Bearer '+token}});
  return true;
}

export async function videoStatus(videoId) {
  const token=await accessToken();
  const u=new URL(apiBase+'/videos');
  u.searchParams.set('part','snippet,status');
  u.searchParams.set('id',String(videoId));
  const {data}=await jsonFetch(u,{headers:{Authorization:'Bearer '+token}});
  const v=data.items?.[0];
  if(!v) throw new Error('Uploaded YouTube video could not be read back.');
  return {
    videoId:v.id,
    title:v.snippet?.title||'',
    privacy:v.status?.privacyStatus||null,
    publishAt:v.status?.publishAt||null,
    uploadStatus:v.status?.uploadStatus||null,
    failureReason:v.status?.failureReason||v.status?.rejectionReason||null
  };
}


export async function videoMetrics(videoId) {
  const token=await accessToken();
  const u=new URL(apiBase+'/videos');
  u.searchParams.set('part','snippet,status,statistics');
  u.searchParams.set('id',String(videoId));
  const {data}=await jsonFetch(u,{headers:{Authorization:'Bearer '+token}});
  const v=data.items?.[0];
  if(!v) throw new Error('YouTube video could not be read for performance tracking.');
  return {
    videoId:v.id,
    title:v.snippet?.title||'',
    publishedAt:v.snippet?.publishedAt||null,
    privacy:v.status?.privacyStatus||null,
    views:v.statistics?.viewCount==null?null:Number(v.statistics.viewCount),
    likes:v.statistics?.likeCount==null?null:Number(v.statistics.likeCount),
    comments:v.statistics?.commentCount==null?null:Number(v.statistics.commentCount)
  };
}
