'use strict';
function registerIllustrationReviewRoutes({app,adminOnly,service}){
 const handle=fn=>(req,res)=>{res.set('Cache-Control','private, no-store');try{res.json(fn(req));}catch(e){res.status(e.status||500).json({error:e.status?e.message:'审核数据暂时无法读取或保存，请稍后重试'});}};
 app.get('/api/admin/illustration-review',adminOnly,handle(()=>({courses:service.courses()})));
 app.get('/api/admin/illustration-review/:course',adminOnly,handle(req=>service.book(req.params.course)));
 app.put('/api/admin/illustration-review/:course',adminOnly,handle(req=>service.save(req.params.course,req.body||{})));
}
module.exports={registerIllustrationReviewRoutes};
