'use strict';
// Adds illustrations for source-missing vocabulary entries without touching old manifests or reviews.
const fs=require('node:fs'),path=require('node:path');
const manifestPath=process.argv[2];if(!manifestPath)throw Error('Manifest path required');
const root=path.resolve(__dirname,'..');
const m=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
const report=JSON.parse(fs.readFileSync(manifestPath.replace(/\.json$/,'.report.json'),'utf8'));
const courseRoot=path.join(root,'output/textbook-extractions',m.courseId);
const missingPath=path.join(courseRoot,'source-missing-entries-v1.json');
const missing=JSON.parse(fs.readFileSync(missingPath,'utf8'));
const grouped=new Map();
for(const c of m.cells){
 const source=(missing.entries||[]).find(x=>x.itemId===c.itemId);
 if(!source)throw Error('Not in source-missing scope: '+c.itemId);
 const asset=report.cells.find(x=>x.itemId===c.itemId&&x.word===c.word&&x.position===c.position);
 if(!asset)throw Error('Unverified panel identity: '+c.itemId);
 const delivery=asset.files.find(x=>x.path.endsWith('.webp'));
 if(!delivery||fs.statSync(path.join(root,delivery.path)).size>=20000)throw Error('Delivery budget failed: '+c.itemId);
 const unitMatch=source.sourceUnit.match(/Unit (\d+)/),dir=unitMatch?'unit'+unitMatch[1]+'-illustrations':'welcome-illustrations';
 const target=path.join(courseRoot,dir,'batch-zz-'+m.batchId+'-atlas.json');
 if(fs.existsSync(target))throw Error('Refusing to overwrite existing manifest: '+target);
 const list=grouped.get(dir)||[];
 list.push({position:c.position,courseId:source.courseId,unit:source.sourceUnit,unitKey:unitMatch?'unit'+unitMatch[1]:'welcome',title:'',headword:source.headword,word:source.headword,slug:c.slug,sourcePages:source.printedPage?[source.printedPage]:[],itemId:source.itemId,scene:c.scene,properName:false,master:asset.master,delivery:delivery.path,images:{wide:delivery.path,mobile:delivery.path},imagesWideAndMobileSame:true,deliveryBytes:fs.statSync(path.join(root,delivery.path)).size,deliveryVersion:m.version,generated:true,cropped:true,sourceImage:source.sourceImage,sourceRegion:source.sourceRegion,sourceOrder:source.sourceLine,sourceKind:source.sourceKind,status:'illustration-pending',styleReference:m.styleReference});
 grouped.set(dir,list);
}
for(const [dir,items] of grouped){
 const target=path.join(courseRoot,dir,'batch-zz-'+m.batchId+'-atlas.json');
 fs.writeFileSync(target,JSON.stringify({courseId:m.courseId,unit:items[0].unit,status:'review-pending',styleReference:m.styleReference,atlasMaster:report.atlas,items},null,2),{flag:'wx'});
 console.log(target);
}
