import fs from 'node:fs';
import { getSecret, setSecret } from './secrets.js';
import { parseTags } from './utils.js';

const apiBase='https://www.googleapis.com/youtube/v3';

async function jsonFetch(url, options={}) {
  const r=await fetch(url,options);
  const body=await r.text();
  let data={};
  try { data=body?JSON.parse(body):{}; } catch { data={raw:body}; }
  if(!r.ok) throw new Error(data?.error?.message || data?.error_description || ('HTTP '+r.status));
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

export function youtubeAuthUrl(baseUrl) {
  const clientId=getSecret('google_client_id');
  if(!clientId) throw new Error('Google OAuth client ID is not configured.');
  const redirect=baseUrl.replace(/\/$/,'')+'/oauth/youtube/callback';
  const u=new URL('https://accounts.google.com/o/oauth2/v2/auth');
  u.searchParams.set('client_id',clientId);
  u.searchParams.set('redirect_uri',redirect);
  u.searchParams.set('response_type','code');
  u.searchParams.set('access_type','offline');
  u.searchParams.set('prompt','consent');
  u.searchParams.set('scope','https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly');
  return u.toString();
}

export async function exchangeYoutubeCode(code,baseUrl) {
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
  if(data.refresh_token) setSecret('youtube_refresh_token',data.refresh_token);
  setSecret('youtube_access_token',data.access_token);
  setSecret('youtube_access_expiry',String(Date.now()+((data.expires_in||3600)-60)*1000));
  return true;
}

async function accessToken() {
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
  setSecret('youtube_access_token',data.access_token);
  setSecret('youtube_access_expiry',String(Date.now()+((data.expires_in||3600)-60)*1000));
  return data.access_token;
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

export async function uploadVideo({file,title,description,tags,privacy='private'}) {
  const token=await accessToken();
  const size=fs.statSync(file).size;
  const meta={
    snippet:{title,description,tags:parseTags(tags),categoryId:'1'},
    status:{privacyStatus:privacy,selfDeclaredMadeForKids:false}
  };

  const init=await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',{
    method:'POST',
    headers:{
      Authorization:'Bearer '+token,
      'Content-Type':'application/json; charset=UTF-8',
      'X-Upload-Content-Type':'video/mp4',
      'X-Upload-Content-Length':String(size)
    },
    body:JSON.stringify(meta)
  });
  if(!init.ok) throw new Error('YouTube upload session failed: '+await init.text());
  const location=init.headers.get('location');
  if(!location) throw new Error('YouTube did not return an upload session URL.');

  const bytes=fs.readFileSync(file);
  const put=await fetch(location,{
    method:'PUT',
    headers:{
      Authorization:'Bearer '+token,
      'Content-Type':'video/mp4',
      'Content-Length':String(size)
    },
    body:bytes
  });
  const raw=await put.text();
  let data={};
  try { data=JSON.parse(raw); } catch {}
  if(!put.ok || !data.id) throw new Error(data?.error?.message || raw || 'YouTube upload failed.');
  return {videoId:data.id,url:'https://youtu.be/'+data.id,status:put.status};
}
