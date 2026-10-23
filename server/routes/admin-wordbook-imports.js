'use strict';
const express=require('express');
const filenamePattern=/^[A-Za-z0-9._-]{1,180}\.(webp|mp3|ogg|wav|png|jpe?g)$/i;
function registerAdminWordbookImportRoutes({app,adminOnly,service}){
 const base='/api/admin/system-wordbooks',raw=express.raw({type:'application/octet-stream',limit:'50mb'});
 app.use(base,(req,res,next)=>{res.set('Cache-Control','private, no-store');res.set('Pragma','no-cache');next();});
 const run=(action,status=200)=>(req,res)=>Promise.resolve().then(()=>action(req)).then(value=>res.status(status).json(value)).catch(error=>res.status(error.status||422).json({error:error.message||'系统单词课程操作失败'}));
 app.get(base,adminOnly,run(()=>({drafts:service.list()})));
 app.get(base+'/overview',adminOnly,run(()=>service.overview()));
 app.get(base+'/published',adminOnly,run(()=>({courses:service.published()})));
 app.get(base+'/published/:bookId/versions',adminOnly,run(req=>({versions:service.history(req.params.bookId)})));
 app.post(base+'/published/:bookId/rollback',adminOnly,run(req=>{if(req.body?.confirmed!==true)throw Object.assign(Error('请明确确认恢复此教材版本'),{status:428});return service.rollback({...req.body,bookId:req.params.bookId,adminId:req.admin?.id||null});}));
 app.post(base+'/revisions',adminOnly,run(req=>service.importRevision(req.body),201));
 app.post(base,adminOnly,run(req=>service.importSource(req.body),201));
 app.get(base+'/:id',adminOnly,run(req=>service.detail(req.params.id)));
 app.post(base+'/:id/archive',adminOnly,run(req=>service.setArchived(req.params.id,req.body,req.admin)));
 app.get(base+'/:id/items',adminOnly,run(req=>service.itemPage(req.params.id,req.query.offset,req.query.limit)));
 app.put(base+'/:id/assets/:filename',adminOnly,raw,run(req=>{
  const filename=decodeURIComponent(req.params.filename);if(!filenamePattern.test(filename)||filename!==require('node:path').basename(filename))throw Object.assign(Error('素材文件名无效'),{status:400});
  if(!Buffer.isBuffer(req.body))throw Object.assign(Error('请以二进制文件上传素材'),{status:400});
  return service.upload(req.params.id,filename,req.body);
 }));
 app.post(base+'/:id/assets/batch',adminOnly,run(req=>{
  if(!Array.isArray(req.body?.assets)||req.body.assets.length>100)throw Object.assign(Error('批量素材请求无效，单批最多 100 个文件'),{status:400});
  const assets=req.body.assets.map(asset=>{
   if(typeof asset?.data!=='string'||asset.data.length%4!==0||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(asset.data))throw Object.assign(Error('批量素材编码无效'),{status:400});
   return {filename:asset.filename,bytes:Buffer.from(asset.data,'base64')};
  });
  return service.uploadBatch(req.params.id,assets);
 }));
 app.get(base+'/:id/assets/:filename',adminOnly,(req,res)=>{
  try{const filename=decodeURIComponent(req.params.filename);if(!filenamePattern.test(filename))return res.status(400).json({error:'素材文件名无效'});const bytes=service.readAsset(req.params.id,filename),mime=/\.webp$/i.test(filename)?'image/webp':/\.png$/i.test(filename)?'image/png':/\.jpe?g$/i.test(filename)?'image/jpeg':/\.ogg$/i.test(filename)?'audio/ogg':/\.wav$/i.test(filename)?'audio/wav':'audio/mpeg';res.type(mime).set('X-Content-Type-Options','nosniff').send(bytes);}catch(error){res.status(error.status||404).json({error:error.message});}
 });
 app.get(base+'/:id/previous-assets/:filename',adminOnly,(req,res)=>{
  try{const filename=decodeURIComponent(req.params.filename);if(!filenamePattern.test(filename))return res.status(400).json({error:'素材文件名无效'});const bytes=service.readPreviousAsset(req.params.id,filename),mime=/\.webp$/i.test(filename)?'image/webp':/\.png$/i.test(filename)?'image/png':/\.jpe?g$/i.test(filename)?'image/jpeg':/\.ogg$/i.test(filename)?'audio/ogg':/\.wav$/i.test(filename)?'audio/wav':'audio/mpeg';res.type(mime).set('X-Content-Type-Options','nosniff').send(bytes);}catch(error){res.status(error.status||404).json({error:error.message});}
 });
 app.post(base+'/:id/validate',adminOnly,run(req=>service.validate(req.params.id,req.body?.revision)));
 app.post(base+'/:id/review',adminOnly,run(req=>service.review(req.params.id,req.body,req.admin)));
 app.post(base+'/:id/issues',adminOnly,run(req=>service.markIssue(req.params.id,req.body,req.admin)));
 app.post(base+'/:id/publish',adminOnly,run(req=>service.publish(req.params.id,req.body)));
}
module.exports={registerAdminWordbookImportRoutes};
