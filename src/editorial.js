import {canonicalSource} from './workflow.js';
import {hookReadability} from '../public/editorial.js';
export {hookReadability};
export const SOURCE_TYPES=['primary','official','reporting','other'];
export function validateCompactHook(hook){
  const result=hookReadability(hook);
  if(!result.words)throw new Error('Add an on-screen hook.');
  if(result.tooLong)throw new Error('The on-screen hook is too long. Use at most 12 words and put context in the description.');
  return result;
}
export function verifyFactsEvidence(value,type,sourceUrl){
  if(!SOURCE_TYPES.includes(type))throw new Error('Choose the independent factual source type.');
  const text=String(value||'').trim(),match=text.match(/https?:\/\/[^\s<>]+/i);
  if(!match||text.replace(/https?:\/\/[^\s<>]+/gi,'').trim().length<12)throw new Error('Record an independent source link and notes explaining what it confirms.');
  let evidence;try{evidence=new URL(match[0]);}catch{throw new Error('Use a valid independent source URL.');}
  if(!['http:','https:'].includes(evidence.protocol)||evidence.username||evidence.password)throw new Error('Use a public independent source URL without embedded credentials.');
  let same=false;
  try{same=canonicalSource(evidence.href).id===canonicalSource(sourceUrl).id;}catch{
    try{const original=new URL(sourceUrl);same=original.hostname===evidence.hostname&&original.pathname===evidence.pathname;}catch{}
  }
  if(same)throw new Error('The competitor source is not independent evidence. Use a primary source or separate reporting.');
  return text;
}
export function verifyEditorialReview(job){
  validateCompactHook(job.hook);
  verifyFactsEvidence(job.facts_evidence,job.facts_source_type,job.source_url);
  if(!job.facts_verified_at||!job.scene_verified_at||String(job.scene_payoff||'').trim().length<8)throw new Error('Confirm the factual claim, matching scene and visible payoff before continuing.');
}
export function editorialSummary(job){
  let meta={};try{meta=JSON.parse(job.render_meta||'{}');}catch{}
  return {...hookReadability(job.hook,meta.duration),profile:job.hook_profile||'legacy',sourceType:job.facts_source_type||null};
}
