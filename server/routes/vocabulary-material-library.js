'use strict';
function registerVocabularyMaterialLibraryRoutes({app,adminOnly,service,releases}){
 const handle=fn=>async(req,res)=>{
  res.set('Cache-Control','private, no-store');
  try{res.json(await fn(req));}catch(error){res.status(error.status||503).json({error:error.status?error.message:'材料库暂不可用；原有内容保留'});}
 };
 const root='/api/admin/vocabulary-material-libraries/:libraryId';
 app.post(root,adminOnly,handle(req=>service.save(req.params.libraryId,req.body?.library,req.body?.baseRevision)));
 app.get(root,adminOnly,handle(req=>service.read(req.params.libraryId,req.query.revision)));
 app.get(root+'/history',adminOnly,handle(req=>({versions:service.history(req.params.libraryId)})));
 app.post(root+'/preview',adminOnly,handle(req=>service.preview(req.params.libraryId,req.body?.revision,req.body?.courseId)));
 if(releases){
  app.post(root+'/release/validate',adminOnly,handle(req=>releases.validate(req.params.libraryId,req.body)));
  app.post(root+'/release/publish',adminOnly,handle(req=>releases.publish(req.params.libraryId,req.body?.preparation,req.body?.fingerprint,req.body?.confirmed)));
 }
}
module.exports={registerVocabularyMaterialLibraryRoutes};
