'use strict';
// Compression experiment only: never replace originals or browser-facing assets.
const sharp=require(process.argv[2]||'sharp');
const fs=require('node:fs/promises'),path=require('node:path');
const root=path.resolve(__dirname,'..');
(async()=>{
  const output=await fs.mkdtemp(path.join(require('node:os').tmpdir(),'jqka-image-quality-'));
  const source=path.join(root,'assets/vocabulary-scenes-v1.png');
  const crop={left:0,top:0,width:512,height:512};
  const results=[];
  for(const format of ['avif','webp']){
    let chosen;
    for(const side of format==='avif'?[512,448,384]:[384,320]){
      for(let quality=70;quality>=30;quality-=5){
        const buffer=await sharp(source).extract(crop).resize(side,side).toFormat(format,{quality,effort:6}).toBuffer();
        if(buffer.length<20000){chosen={buffer,side,quality};break;}
      }
      if(chosen)break;
    }
    if(!chosen)throw new Error('No candidate under 20,000 bytes');
    const file=path.join(output,'decide-20k.'+format);
    await fs.writeFile(file,chosen.buffer);
    results.push({format,bytes:chosen.buffer.length,side:chosen.side,quality:chosen.quality,file});
  }
  const oldFile=path.join(root,'assets/vocabulary-decide-10k-v1.avif');
  const oldMeta=await sharp(oldFile).metadata();
  const oldBytes=(await fs.stat(oldFile)).size;
  const old=await sharp(oldFile).resize(560,560).png().toBuffer();
  const improved=await sharp(results[0].file).resize(560,560).png().toBuffer();
  const labels=Buffer.from('<svg width="1144" height="56"><rect width="1144" height="56" fill="#fff9e9"/><g font-family="Arial" font-size="22" fill="#523019"><text x="18" y="35">10 KB: '+oldBytes+' bytes / '+oldMeta.width+' px</text><text x="602" y="35">20 KB: '+results[0].bytes+' bytes / '+results[0].side+' px</text></g></svg>');
  const comparison=path.join(output,'10k-vs-20k.png');
  await sharp({create:{width:1144,height:616,channels:3,background:'#fff9e9'}}).composite([{input:labels,left:0,top:0},{input:old,left:0,top:56},{input:improved,left:584,top:56}]).png().toFile(comparison);
  console.log(JSON.stringify({old:{bytes:oldBytes,side:oldMeta.width},candidates:results,comparison},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
