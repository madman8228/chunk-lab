'use strict';
// Adds a new manifest only. Original manifests, art, and review database are untouched.
const fs=require('node:fs'),path=require('node:path');
const manifestPath=process.argv[2];if(!manifestPath)throw Error('Manifest path required');
const m=JSON.parse(fs.readFileSync(manifestPath,'utf8')),report=JSON.parse(fs.readFileSync(manifestPath.replace(/\.json$/,'.report.json'),'utf8'));
const root=path.resolve(__dirname,'..'),snapshot=JSON.parse(fs.readFileSync(path.join(path.dirname(manifestPath),'issues-snapshot-v1.json'),'utf8'));
const grouped=new Map();
for(const c of m.cells){
 const prior=snapshot.items.find(i=>i.item===c.itemId&&i.course===m.courseId);if(!prior)throw Error('Not in approved repair scope: '+c.itemId);
 const asset=report.cells.find(i=>i.itemId===c.itemId&&i.word===c.word&&i.position===c.position);
 if(!asset)throw Error('Unverified panel identity');
 const delivery=asset.files.find(f=>f.path.endsWith('.webp'));
 if(!delivery||fs.statSync(path.join(root,delivery.path)).size>=20000)throw Error('Delivery budget failed');
 // Locate the existing item in the same established source-manifest structure.
 const courseRoot=path.join(root,'output/textbook-extractions',m.courseId);let found;
 for(const dir of fs.readdirSync(courseRoot).filter(d=>/^(welcome|unit\d+)-illustrations$/.test(d))){
  for(const file of fs.readdirSync(path.join(courseRoot,dir)).filter(f=>/^batch-.*-atlas\.json$/.test(f))){
   const old=JSON.parse(fs.readFileSync(path.join(courseRoot,dir,file),'utf8'));
   const item=(old.items||old.panels||[]).find(i=>i.itemId===c.itemId);if(item)found={dir,item,unit:old.unit};
  }
 }
 if(!found)throw Error('Existing item not located');
 const list=grouped.get(found.dir)||[];
 list.push({...found.item,itemId:c.itemId,headword:c.word,word:c.word,delivery:delivery.path,images:{wide:delivery.path,mobile:delivery.path},scene:c.scene,repairOfVersion:prior.version,repairStatus:'awaiting-user-review',originalReview:{note:prior.note,reason:prior.reason},styleReference:m.styleReference});grouped.set(found.dir,list);
}
for(const [dir,items] of grouped){
 const target=path.join(root,'output/textbook-extractions',m.courseId,dir,'batch-zz-'+m.batchId+'-atlas.json');
 fs.writeFileSync(target,JSON.stringify({courseId:m.courseId,unit:items[0].unit||dir.replace('-illustrations',''),status:'review-pending',styleReference:m.styleReference,atlasMaster:report.atlas,items},null,2),{flag:'wx'});console.log(target);
}
