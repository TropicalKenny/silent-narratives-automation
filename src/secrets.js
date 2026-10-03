import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const file = path.resolve('data','secrets.json');
function readAll(){
  try { return JSON.parse(fs.readFileSync(file,'utf8')); }
  catch(e){ if(e.code==='ENOENT') return {}; throw new Error('Credential storage could not be read safely.'); }
}
function writeAll(value){
  fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});
  const temporary=file+'.'+crypto.randomBytes(8).toString('hex')+'.tmp';
  try {
    fs.writeFileSync(temporary,JSON.stringify(value,null,2),{mode:0o600,flag:'wx'});
    fs.renameSync(temporary,file);
    fs.chmodSync(file,0o600);
  } finally { try { fs.rmSync(temporary,{force:true}); } catch {} }
}
export function setSecrets(changes){const next=readAll();for(const [name,value] of Object.entries(changes)){if(value===null||value===undefined||value==='')delete next[name];else next[name]=String(value);}writeAll(next);}
export function setSecret(name,value){setSecrets({[name]:value});}
export function getSecret(name){return readAll()[name]||null;}
export function secretStatus(){return Object.fromEntries(Object.entries(readAll()).map(([name,value])=>[name,Boolean(value)]));}
