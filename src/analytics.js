import {accessToken} from './youtube.js';
export const ANALYTICS_ENABLE_URL='https://console.developers.google.com/apis/api/youtubeanalytics.googleapis.com/overview?project=399805383895';
export function reportingWindow(now=new Date()){
  // Completed reporting days; allow two days for YouTube's processing lag.
  const end=new Date(now);end.setUTCDate(end.getUTCDate()-2);
  const start=new Date(end);start.setUTCDate(start.getUTCDate()-27);
  return {startDate:start.toISOString().slice(0,10),endDate:end.toISOString().slice(0,10)};
}
function number(value){return value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value))&&Number(value)>=0?Number(value):null;}
export function parseAnalyticsRows(data,allowedIds){
  if(!Array.isArray(data.columnHeaders)||(data.rows!==undefined&&!Array.isArray(data.rows)))throw new Error('YouTube Analytics returned an unexpected report.');
  const names=data.columnHeaders.map(x=>x.name),allowed=new Set(allowedIds);
  if(!names.includes('video'))throw new Error('The Analytics report is missing video identifiers.');
  return (data.rows||[]).map(row=>{
    const values=Object.fromEntries(names.map((name,index)=>[name,row[index]]));
    if(!allowed.has(values.video))throw new Error('Analytics returned a video outside the authorized public history.');
    return {videoId:values.video,views:number(values.views),engagedViews:number(values.engagedViews),averageViewDuration:number(values.averageViewDuration),averageViewPercentage:number(values.averageViewPercentage)};
  });
}
export function parseRetentionRows(data){
  if(!Array.isArray(data.columnHeaders)||(data.rows!==undefined&&!Array.isArray(data.rows)))throw new Error('YouTube returned an unexpected retention report.');
  const names=data.columnHeaders.map(x=>x.name);
  if(!names.includes('elapsedVideoTimeRatio')||!names.includes('audienceWatchRatio'))throw new Error('The retention report is missing its expected columns.');
  return (data.rows||[]).map(row=>{const value=Object.fromEntries(names.map((name,index)=>[name,row[index]]));return {position:number(value.elapsedVideoTimeRatio),watchRatio:number(value.audienceWatchRatio)};})
    .filter(x=>x.position!==null&&x.position<=1&&x.watchRatio!==null).sort((a,b)=>a.position-b.position);
}
async function report(parameters){
  const token=await accessToken(),url=new URL('https://youtubeanalytics.googleapis.com/v2/reports');
  for(const [name,value] of Object.entries({ids:'channel==MINE',...parameters}))url.searchParams.set(name,value);
  const response=await fetch(url,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(20000)});
  const data=await response.json();
  if(!response.ok){
    const reason=data.error?.errors?.[0]?.reason||'',message=data.error?.message||'';
    const disabled=reason==='accessNotConfigured'||/has not been used|is disabled|SERVICE_DISABLED/i.test(message);
    const denied=response.status===401||response.status===403;
    const error=new Error(disabled?'Enable YouTube Analytics in your Google project, then reconnect with Analytics access.':denied?'Reconnect YouTube with Analytics access. Your existing upload connection remains saved.':response.status===429?'YouTube Analytics quota is temporarily exhausted. Try again later.':'YouTube Analytics could not complete the report. Try again later.');
    error.reason=disabled?'api_disabled':denied?'needs_authorization':'temporary_error';throw error;
  }
  return data;
}
export async function videoAnalytics(ids,window=reportingWindow()){
  if(!ids.length)return {window,rows:[]};
  if(ids.length>200||ids.some(x=>!/^[-\w]{11}$/.test(x)))throw new Error('Choose valid videos from the channel history.');
  const data=await report({...window,metrics:'views,engagedViews,averageViewDuration,averageViewPercentage',dimensions:'video',filters:'video=='+ids.join(','),maxResults:'200'});
  return {window,rows:parseAnalyticsRows(data,ids)};
}
export async function videoRetention(videoId,window=reportingWindow()){
  if(!/^[-\w]{11}$/.test(videoId))throw new Error('Choose a valid channel video.');
  const data=await report({...window,metrics:'audienceWatchRatio',dimensions:'elapsedVideoTimeRatio',filters:'video=='+videoId});
  return {window,points:parseRetentionRows(data)};
}
