'use strict';
// Mechanical delivery encoding only. Masters are created by the image tool.
// Usage: node script <sharp-module> <manifest-json>
const sharp=require(process.argv[2]||'sharp');
const fs=require('node:fs/promises'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const profiles=[{name:'wide',version:'v2',widths:[576,512,448,384,320],ratio:16/9,budget:20000},{name:'mobile',version:'v2',widths:[432,384,320,288,256,224,192],ratio:4/3,budget:20000}];
(async()=>{
  const sources=JSON.parse(await fs.readFile(process.argv[3],'utf8'));
  for(const [word,source] of Object.entries(sources)){
    for(const profile of profiles)for(const format of ['avif','webp']){
      const file='vocabulary-'+word+'-'+profile.name+'-'+profile.version+'.'+format;
      if(process.argv[4]==='--missing'){
        try{const bytes=(await fs.stat(path.join(root,'assets',file))).size;if(bytes<profile.budget){console.log(JSON.stringify({file,bytes,reused:true}));continue;}}catch(e){if(e.code!=='ENOENT')throw e;}
      }
      let chosen;
      for(const width of profile.widths){
        const height=Math.round(width/profile.ratio);
        for(let quality=70;quality>=35;quality-=5){
          const buffer=await sharp(path.resolve(root,source)).resize(width,height,{fit:'cover',position:'centre'}).toFormat(format,{quality,effort:6}).toBuffer();
          if(buffer.length<profile.budget){chosen={buffer,width,height,quality};break;}
        }
        if(chosen)break;
      }
      if(!chosen)throw new Error(word+' '+profile.name+' exceeds budget');
      // New delivery versions are additive; never overwrite existing artwork.
      await fs.writeFile(path.join(root,'assets',file),chosen.buffer,{flag:'wx'});
      console.log(JSON.stringify({file,bytes:chosen.buffer.length,width:chosen.width,height:chosen.height,quality:chosen.quality}));
    }
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
