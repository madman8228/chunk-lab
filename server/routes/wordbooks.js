'use strict';
function registerWordbookRoutes({app,auth,content,study,browse,teaching}){
  const handle=fn=>(req,res)=>{try{res.json(fn(req));}catch(error){res.status(error.status||400).json({error:error.message});}};
  const privateAuth=(req,res,next)=>{if((req.params.bookId||req.params.itemId||'').startsWith('personal-')){res.set('Cache-Control','private, no-store');return auth.authenticate(req,res,next);}next();};
  app.get('/api/personal-wordbooks',auth.authenticate,(req,res,next)=>{res.set('Cache-Control','private, no-store');next();},handle(req=>({resources:content.personal.resources(req.userId)})));
  app.get('/api/personal-wordbooks/course-options',auth.authenticate,(req,res,next)=>{res.set('Cache-Control','private, no-store');next();},handle(req=>({courses:content.personal.courseOptions(req.userId)})));
  app.post('/api/personal-wordbooks',auth.authenticate,async(req,res)=>{
    res.set('Cache-Control','private, no-store');
    try{if(!content.personal)return res.status(503).json({error:'个人单词本服务尚未更新，草稿保留'});
      if(!req.body||Object.keys(req.body).some(key=>!['draft','baseRevision'].includes(key)))return res.status(400).json({error:'保存格式无效'});
      res.json(await content.personal.save(req.userId,req.body.draft,req.body.baseRevision));
    }catch(error){res.status(error.status||400).json({error:error.message});}
  });
  for(const action of ['preview','apply'])app.post('/api/personal-wordbooks/restore/'+action,auth.authenticate,async(req,res)=>{
    res.set('Cache-Control','private, no-store');
    try{if(!req.body||Object.keys(req.body).some(key=>!['archive','fingerprint','confirmed'].includes(key)))throw Object.assign(new Error('恢复请求字段无效'),{status:400});
      const result=action==='preview'?await content.personal.previewRestore(req.userId,req.body.archive):await content.personal.restore(req.userId,req.body.archive,req.body.fingerprint,req.body.confirmed);res.json(result);
    }catch(error){res.status(error.status||400).json({error:error.message});}
  });
  app.get('/api/wordbooks/:bookId/items',privateAuth,handle(req=>content.page(req.params.bookId,req.query.offset??0,req.query.limit??20,req.userId)));
  app.get('/api/wordbooks/:bookId/details',privateAuth,handle(req=>{const details=content.details(req.params.bookId,req.userId),enabled=browse?.enabled===true;return {...details,features:{...details.features,...study.capabilities?.(),vocabularyBrowse:enabled},teachingOptions:enabled&&teaching?teaching.options(req.userId,req.params.bookId):[]};}));
  app.get('/api/wordbooks/:bookId/materials',privateAuth,handle(req=>content.materials(req.params.bookId,req.userId)));
  app.get('/api/wordbooks/:bookId/units/:unitId/items',privateAuth,handle(req=>content.unitPage(req.params.bookId,req.params.unitId,req.query.offset??0,req.query.limit??20,req.userId)));
  app.get('/api/vocabulary-items/:itemId',privateAuth,handle(req=>content.item(req.params.itemId,req.query.revision,req.userId)));
  app.get('/api/wordbooks/:bookId/state',auth.authenticate,(req,res,next)=>{res.set('Cache-Control','private, no-store');next();},handle(req=>study.state(req.userId,req.params.bookId,req.query.offset??0,req.query.limit??20,req.query.unitId,req.query.structureRevision,req.query.practiceType)));
  app.get('/api/wordbooks/:bookId/browse-state',auth.authenticate,(req,res)=>{res.set('Cache-Control','private, no-store');try{if(!browse)throw Object.assign(Error('预学习续学尚未开放'),{status:422});res.json(browse.state(req.userId,req.params.bookId,req.query.planRevision,req.query.unitId));}catch(error){res.status(error.status||400).json({error:error.message,code:error.code});}});
  const teachingRead=fn=>(req,res)=>{res.set('Cache-Control','private, no-store');try{if(!browse?.enabled||!teaching)throw Object.assign(Error('预学习续学尚未开放'),{status:422,code:'PRACTICE_UNAVAILABLE'});res.json(fn(req));}catch(error){res.status(error.status||400).json({error:error.message,code:error.code});}};
  app.get('/api/wordbooks/:bookId/teaching-catalog',auth.authenticate,teachingRead(req=>teaching.catalog(req.userId,req.params.bookId,req.query.planRevision,req.query.unitId,req.query.offset??0,req.query.limit??20)));
  app.get('/api/wordbooks/:bookId/teaching-step',auth.authenticate,teachingRead(req=>teaching.step(req.userId,req.params.bookId,req.query.planRevision,req.query.unitId,req.query.stepId)));
}
module.exports={registerWordbookRoutes};
