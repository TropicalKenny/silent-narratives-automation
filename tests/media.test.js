import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {renderShort} from '../src/renderer.js';
const original=process.cwd(),fixture=fs.mkdtempSync(path.join(os.tmpdir(),'sn-media-test-'));
process.chdir(fixture);fs.mkdirSync('assets');
function ffmpeg(args){execFileSync('/usr/bin/ffmpeg',['-v','error','-y','-threads','2','-filter_threads','1',...args],{stdio:'pipe'});}
ffmpeg(['-f','lavfi','-i','testsrc2=size=640x360:rate=30','-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-t','2','-c:v','libx264','-threads','2','-preset','ultrafast','-c:a','aac','-ac','2','scene.mp4']);
ffmpeg(['-f','lavfi','-i','color=c=0x204030:s=360x640:r=30','-f','lavfi','-i','sine=frequency=880:sample_rate=48000','-t','2','-c:v','libx264','-threads','2','-preset','ultrafast','-c:a','aac','-ac','2','assets/background.mp4']);
ffmpeg(['-i','scene.mp4','-an','-c:v','copy','silent.mp4']);
after(()=>{process.chdir(original);fs.rmSync(fixture,{recursive:true,force:true});});
test('render preserves portrait format and scene-only audio while keeping the event loop responsive',async()=>{
 let ticks=0;const interval=setInterval(()=>ticks++,10);let result;try{result=await renderShort({jobId:1,sceneFile:path.resolve('scene.mp4'),hook:'A fixture scene confirms the action.',subtitles:['WATCH THE SETUP','THE MOMENT'],subtitleTimings:[{start:.3,end:.8,kind:'editorial',emphasis:'SETUP'},{start:1,end:1.6,kind:'dialogue',emphasis:'MOMENT'}]});}finally{clearInterval(interval);}
 assert.ok(ticks>20,'FFmpeg must not block the Node event loop');
 const data=JSON.parse(execFileSync('/usr/bin/ffprobe',['-v','error','-show_streams','-show_format','-of','json',result.output]));const video=data.streams.find(x=>x.codec_type==='video'),audio=data.streams.find(x=>x.codec_type==='audio');
 assert.equal(video.width,1080);assert.equal(video.height,1920);assert.equal(video.r_frame_rate,'30/1');assert.equal(audio.channels,2);assert.equal(audio.sample_rate,'48000');assert.ok(Math.abs(Number(data.format.duration)-2)<.15);assert.ok(fs.statSync(result.preview).size<fs.statSync(result.output).size);
 const pcm=execFileSync('/usr/bin/ffmpeg',['-v','error','-ss','0.4','-i',result.output,'-t','1','-vn','-ac','1','-ar','8000','-f','s16le','pipe:1']);
 function energy(frequency){let real=0,imaginary=0;for(let i=0;i<pcm.length/2;i++){const value=pcm.readInt16LE(i*2),phase=2*Math.PI*frequency*i/8000;real+=value*Math.cos(phase);imaginary+=value*Math.sin(phase);}return real*real+imaginary*imaginary;}
 assert.ok(energy(440)>energy(880)*20,'Gameplay audio must not enter the master');
});
test('a silent source and a card that would truncate text fail before publication',async()=>{await assert.rejects(renderShort({jobId:2,sceneFile:path.resolve('silent.mp4'),hook:'Fixture hook'}),/no audio/);await assert.rejects(renderShort({jobId:3,sceneFile:path.resolve('scene.mp4'),hook:'Long factual text '.repeat(100)}),/too long/);});
