import crypto from 'node:crypto';
const equal=(a,b)=>{const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length&&crypto.timingSafeEqual(x,y);};
function cookies(req){const out={};for(const part of String(req.headers.cookie||'').split(';')){const i=part.indexOf('=');if(i<0)continue;try{out[part.slice(0,i).trim()]=decodeURIComponent(part.slice(i+1).trim());}catch{}}return out;}
export function installSecurity(app,{getSecret,setSecret,baseUrl,port}){
  let key=getSecret('dashboard_csrf_key');if(!key){key=crypto.randomBytes(32).toString('hex');setSecret('dashboard_csrf_key',key);}
  const sign=value=>crypto.createHmac('sha256',key).update(value).digest('hex');
  const prefix=req=>{try{return new URL(baseUrl(req)).pathname.replace(/\/$/,'');}catch{return '';}};
  const options=req=>({httpOnly:true,secure:req.secure,sameSite:'strict',path:prefix(req)||'/',maxAge:24*60*60*1000});
  const local=req=>['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress)&&['127.0.0.1:'+port,'localhost:'+port,'[::1]:'+port].includes(req.headers.host)&&!['x-forwarded-for','x-forwarded-host','x-forwarded-proto'].some(name=>req.headers[name]);
  function context(req){const value=cookies(req).sn_csrf||'',parts=value.split('.');return parts.length===3&&Number(parts[1])>Date.now()&&equal(parts[2],sign(parts[0]+'.'+parts[1]))?value:null;}
  app.use((req,res,next)=>{
    res.setHeader('X-Robots-Tag','noindex, nofollow, noarchive');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://i.ytimg.com https://yt3.ggpht.com https://yt3.googleusercontent.com; media-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'");
    if(req.secure)res.setHeader('Strict-Transport-Security','max-age=15552000');next();
  });
  app.get('/api/session',(req,res)=>{
    res.setHeader('Cache-Control','no-store');let value=context(req);
    if(!value){const payload=crypto.randomBytes(20).toString('hex')+'.'+(Date.now()+24*60*60*1000);value=payload+'.'+sign(payload);res.cookie('sn_csrf',value,options(req));}
    res.json({ok:true,authenticated:true,passwordRequired:false,csrfToken:local(req)?'local':sign('csrf:'+value)});
  });
  app.use((req,res,next)=>{
    if(['GET','HEAD','OPTIONS'].includes(req.method)||local(req))return next();
    const origin=req.get('origin'),value=context(req);
    if(!origin||origin!==new URL(baseUrl(req)).origin||!value||!equal(req.get('x-csrf-token')||'',sign('csrf:'+value)))return res.status(403).json({ok:false,error:'Refresh the dashboard before making changes.'});
    next();
  });
  function issueOAuthState(req,res){
    const payload=crypto.randomBytes(20).toString('hex')+'.'+(Date.now()+10*60*1000),value=payload+'.'+sign('oauth:'+payload);
    res.cookie('sn_oauth_state',value,{...options(req),sameSite:'lax',maxAge:10*60*1000});return value;
  }
  function verifyOAuthState(req,res,value){
    const token=cookies(req).sn_oauth_state||'',parts=String(value||'').split('.');res.clearCookie('sn_oauth_state',{path:prefix(req)||'/'});
    if(parts.length!==3||!Number.isFinite(Number(parts[1]))||Number(parts[1])<=Date.now()||!equal(token,String(value))||!equal(parts[2],sign('oauth:'+parts[0]+'.'+parts[1])))throw new Error('YouTube connection verification expired. Start reconnecting from the dashboard again.');
  }
  return {issueOAuthState,verifyOAuthState};
}
