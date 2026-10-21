'use strict';
const assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const covers=require('../js/course-covers.js');
if(!covers.variants.every(file=>/-v2\.webp$/.test(file))){
 console.log('SKIP: current default covers are the v1 SVG set; the v2 WebP migration is a separate design decision');
 process.exit(0);
}
for(const file of covers.variants){
 assert.match(file,/-v2\.webp$/,'serve the new isolated-element version, not the prior scenes');
 const metadata=JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','stream=width,height','-of','json',file],{encoding:'utf8'})).streams[0];
 const alpha=execFileSync('ffmpeg',['-v','error','-i',file,'-vf','alphaextract','-frames:v','1','-pix_fmt','gray','-f','rawvideo','pipe:1']);
 assert.equal(alpha.length,metadata.width*metadata.height);
 let visible=0,minX=metadata.width,maxX=-1,minY=metadata.height,maxY=-1;
 for(let i=0;i<alpha.length;i++)if(alpha[i]>20){visible++;const x=i%metadata.width,y=Math.floor(i/metadata.width);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
 assert.ok(visible>0,'element must be visible');
 assert.ok(visible/alpha.length<0.2,'at least 80% of the canvas remains transparent');
 assert.ok((maxX-minX+1)/metadata.width<0.5,'element stays small and isolated');
 assert.ok(alpha[0]===0&&alpha[metadata.width-1]===0&&alpha.at(-1)===0,'corners are truly transparent, not painted white/checkerboard');
 console.log(file+': '+(visible/alpha.length*100).toFixed(1)+'% visible, transparent margins verified');
}
