import React from 'react';
import {AbsoluteFill,Composition,OffthreadVideo,Sequence,interpolate,spring,staticFile,useCurrentFrame,useVideoConfig} from 'remotion';

const ACCENT='#FFD84D';
const WHITE='#FFFFFF';
const defaults={
  src:'',duration:6.5,hook:'A BEHIND-THE-SCENES MOMENT CHANGED THE TAKE.',hookEmphasis:'',headerEnd:1.6,
  beats:[{start:.8,end:1.7,text:'WATCH THE SETUP',emphasis:'SETUP',kind:'editorial'},{start:1.7,end:5.8,text:'WATCH THE PAYOFF',emphasis:'PAYOFF',kind:'editorial',payoff:true}],
  cropPlan:[{start:0,x:50}],captionTop:1325,payoffCaptionTop:210,hookTop:76,eyebrow:'SILENT NARRATIVES'
};
const cleanWord=(w)=>String(w||'').replace(/[’'.,!?]/g,'').toUpperCase();
const wordNodes=(text,emphasis)=>String(text||'').split(/\s+/).map((w,i)=>{const hot=cleanWord(w)===cleanWord(emphasis);return <span key={i} style={{display:'inline-block',margin:'0 9px',color:hot?ACCENT:WHITE,transform:hot?'scale(1.075)':'scale(1)',textShadow:'0 6px 22px rgba(0,0,0,.98)',WebkitTextStroke:'1.6px rgba(0,0,0,.38)'}}>{w}</span>});
const hookNodes=(text,emphasis)=>String(text||'').split(/\s+/).map((w,i)=>{const hot=cleanWord(w)===cleanWord(emphasis);return <span key={i} style={{color:hot?ACCENT:WHITE,marginRight:7,textShadow:'0 6px 24px rgba(0,0,0,.95)'}}>{w} </span>});

function stepCropX(t,plan){
  const p=(Array.isArray(plan)&&plan.length?plan:defaults.cropPlan).map(v=>({start:Number(v.start)||0,x:Number(v.x)||50})).sort((a,b)=>a.start-b.start);
  let x=p[0].x;
  for(const point of p){if(t>=point.start)x=point.x;else break;}
  return Math.max(0,Math.min(100,x));
}

function MainVideo({src,duration,cropPlan,beats}){
  const frame=useCurrentFrame();const {fps}=useVideoConfig();const t=frame/fps;
  const x=stepCropX(t,cropPlan);
  const base=interpolate(t,[0,Math.max(.1,duration)],[1.015,1.04],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});
  let pulse=1;
  for(const b of beats||[]){const s=Number(b.start)||0;if(t>=s&&t<=s+.24)pulse*=interpolate(t,[s,s+.08,s+.24],[1,1.018,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});}
  return <><OffthreadVideo src={staticFile(src)} volume={1} style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',objectPosition:`${x}% 48%`,transform:`scale(${base*pulse})`,filter:'contrast(1.055) saturate(1.05) brightness(.985)'}}/><AbsoluteFill style={{background:'linear-gradient(180deg,rgba(2,4,6,.34) 0%,rgba(2,4,6,.05) 24%,rgba(2,4,6,0) 48%,rgba(2,4,6,.06) 62%,rgba(2,4,6,.52) 100%)'}}/></>;
}

function Header({hook,hookEmphasis,hookTop,headerEnd,eyebrow}){
  const frame=useCurrentFrame();const {fps}=useVideoConfig();
  const enter=spring({fps,frame,config:{damping:18,stiffness:220,mass:.58}});
  const exitStart=Math.max(0,Math.round((headerEnd-.35)*fps));const exitEnd=Math.max(exitStart+1,Math.round(headerEnd*fps));
  const exit=interpolate(frame,[exitStart,exitEnd],[1,0],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});
  return <div style={{position:'absolute',top:hookTop,left:58,right:84,opacity:enter*exit,transform:`translateY(${interpolate(enter,[0,1],[-22,0])}px)`,pointerEvents:'none'}}>
    <div style={{display:'inline-flex',alignItems:'center',gap:10,padding:'7px 13px',borderRadius:999,background:'rgba(5,7,8,.66)',backdropFilter:'blur(7px)',fontFamily:'Arial,sans-serif',fontSize:19,fontWeight:900,letterSpacing:1.8,color:'rgba(255,255,255,.88)',marginBottom:10}}><span style={{width:8,height:8,borderRadius:99,background:ACCENT}}/>{eyebrow}</div>
    <div style={{fontFamily:'Arial Black,Arial,sans-serif',fontSize:58,fontWeight:900,lineHeight:.96,letterSpacing:-2.2,color:WHITE,textShadow:'0 6px 24px rgba(0,0,0,.95)',maxWidth:880}}>{hookNodes(String(hook||'').toUpperCase(),hookEmphasis)}</div>
  </div>;
}

function Caption({beat,captionTop,payoffCaptionTop}){
  const frame=useCurrentFrame();const {fps}=useVideoConfig();const durationFrames=Math.max(1,Math.round((beat.end-beat.start)*fps));
  const pop=spring({fps,frame:Math.max(0,frame),config:{damping:12,stiffness:300,mass:.42}});
  const fadeStart=Math.max(0,durationFrames-6);
  const opacity=interpolate(frame,[0,3,fadeStart,durationFrames],[0,1,1,0],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});
  const payoff=Boolean(beat.payoff||beat.kind==='editorial'&&beat.final);
  return <AbsoluteFill style={{pointerEvents:'none'}}><div style={{position:'absolute',top:payoff?payoffCaptionTop:captionTop,left:58,right:108,textAlign:'center',opacity,transform:`translateY(${interpolate(pop,[0,1],[34,0])}px) scale(${interpolate(pop,[0,1],[.86,1])})`,fontFamily:'Arial Black,Arial,sans-serif',fontSize:payoff?82:82,fontWeight:900,lineHeight:.98,letterSpacing:-2.4,textShadow:'0 6px 22px rgba(0,0,0,.98),0 2px 3px #000'}}>
    {payoff?<div style={{display:'inline-block',padding:'17px 26px 15px',borderRadius:22,background:'rgba(5,7,8,.74)',boxShadow:'0 18px 56px rgba(0,0,0,.5), inset 0 0 0 2px rgba(255,216,77,.36)'}}>{wordNodes(beat.text,beat.emphasis)}</div>:wordNodes(beat.text,beat.emphasis)}
  </div></AbsoluteFill>;
}

function Flash({start}){const frame=useCurrentFrame();const {fps}=useVideoConfig();const local=frame-Math.round(start*fps);const opacity=interpolate(local,[0,2,5],[0,.18,0],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});return <AbsoluteFill style={{background:'#fff',opacity,pointerEvents:'none'}}/>}

export function EditorialV5(props){
  const p={...defaults,...props};
  const beats=(p.beats||[]).map((b,i,a)=>({...b,payoff:Boolean(b.payoff||i===a.length-1&&b.kind==='editorial'),final:i===a.length-1}));
  const payoffStart=Number(beats.find(b=>b.payoff)?.start??Math.max(0,p.duration*.62));
  return <AbsoluteFill style={{background:'#050708',overflow:'hidden'}}>
    <MainVideo src={p.src} duration={p.duration} cropPlan={p.cropPlan} beats={beats}/>
    <Header hook={p.hook} hookEmphasis={p.hookEmphasis} hookTop={p.hookTop} headerEnd={p.headerEnd} eyebrow={p.eyebrow}/>
    {beats.map((b,i)=><Sequence key={i} from={Math.round(Number(b.start)*30)} durationInFrames={Math.max(1,Math.round((Number(b.end)-Number(b.start))*30))}><Caption beat={b} captionTop={p.captionTop} payoffCaptionTop={p.payoffCaptionTop}/></Sequence>)}
    <Flash start={payoffStart}/>
    <div style={{position:'absolute',right:42,bottom:52,fontFamily:'Arial,sans-serif',fontSize:19,fontWeight:900,letterSpacing:1.5,color:'rgba(255,255,255,.62)',textShadow:'0 3px 12px #000'}}>@SILENTNARRATIVESYT</div>
  </AbsoluteFill>;
}

export const Root=()=> <Composition id="EditorialV5" component={EditorialV5} durationInFrames={195} fps={30} width={1080} height={1920} defaultProps={defaults} calculateMetadata={({props})=>({durationInFrames:Math.max(1,Math.round((Number(props.duration)||6.5)*30))})}/>;
