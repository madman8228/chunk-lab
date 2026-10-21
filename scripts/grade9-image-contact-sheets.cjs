'use strict';
// New contact sheets only; source illustrations and reports are read-only.
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const base='output/textbook-extractions/people-grade9-full-2013-20261015';
for(let unit=10;unit<=14;unit++){
 const folder=base+'/unit'+unit+'-images',batches=new Map();
 for(const name of fs.readdirSync(folder).filter(n=>n.endsWith('.report.json'))){
  const report=JSON.parse(fs.readFileSync(path.join(folder,name))),key=name.match(/batch-(\d+)/)?.[1]||name,version=Number(report.batchId?.match(/-v(\d+)$/)?.[1]||1);
  if(!batches.has(key)||batches.get(key).version<version)batches.set(key,{report,version});
 }
 const cells=[...batches.values()].flatMap(b=>b.report.cells).sort((a,b)=>a.itemId.localeCompare(b.itemId));
 for(let start=0;start<cells.length;start+=20){
  const page=cells.slice(start,start+20),args=['-v','error','-n'];
  for(const cell of page)args.push('-i',cell.files.find(f=>f.path.endsWith('.webp')).path);
  const filters=page.map((cell,i)=>'['+i+':v]scale=256:144,pad=256:170:0:0:color=white,drawtext=fontfile=\'C\\:/Windows/Fonts/arial.ttf\':text='+cell.word.replace(/[^a-zA-Z0-9 .-]/g,'')+':fontsize=16:fontcolor=black:x=5:y=147[v'+i+']');
  filters.push(page.map((_,i)=>'[v'+i+']').join('')+'xstack=inputs='+page.length+':layout='+page.map((_,i)=>(i%4*256)+'_'+(Math.floor(i/4)*170)).join('|')+':fill=white[out]');
  const out=base+'/whole-book-launch-v1/unit'+unit+'-images-'+(start/20+1)+'.png';
  args.push('-filter_complex',filters.join(';'),'-map','[out]','-frames:v','1','-threads','1',out);
  execFileSync('ffmpeg',args,{windowsHide:true,stdio:'pipe'});console.log(out);
 }
}
