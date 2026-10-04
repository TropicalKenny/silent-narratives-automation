export function hookReadability(value='',duration=null){
  const words=(String(value).match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)||[]).length;
  const seconds=Number(duration),readingSeconds=words/3;
  return {words,maxWords:12,target:'6–10',readingSeconds:Math.round(readingSeconds*10)/10,
    wordsPerMinute:Number.isFinite(seconds)&&seconds>0?Math.round(words*60/seconds):null,
    tooLong:words>12,needsMoreTime:Number.isFinite(seconds)&&seconds>0&&readingSeconds>seconds};
}
