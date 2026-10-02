import fs from 'node:fs';
import path from 'node:path';
const file = path.resolve('data','secrets.json');
function readAll(){ try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return {};}}
function writeAll(v){ fs.mkdirSync(path.dirname(file),{recursive:true}); fs.writeFileSync(file,JSON.stringify(v,null,2),{mode:0o600}); try{fs.chmodSync(file,0o600);}catch{} }
export function setSecret(name,value){ const v=readAll(); if(value===null||value===undefined||value==='') delete v[name]; else v[name]=String(value); writeAll(v); }
export function getSecret(name){ return readAll()[name] || null; }
export function secretStatus(){ const v=readAll(); return Object.fromEntries(Object.keys(v).map(k=>[k,Boolean(v[k])])); }
