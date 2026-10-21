'use strict';
function registerWordbookPublishingRoutes({app,adminOnly,publisher}){
 const handle=fn=>(req,res)=>{try{res.json(fn(req.body||{}));}catch(e){res.status(e.status||422).json({error:e.code==='ENOENT'?'素材尚未部署到服务端；不能发布':e.message});}};
 app.post('/api/admin/wordbooks/validate',adminOnly,handle(body=>publisher.validate(body.package)));
 app.post('/api/admin/wordbooks/publish',adminOnly,handle(body=>publisher.publish(body.package,body.fingerprint,body.confirmed)));
}
module.exports={registerWordbookPublishingRoutes};
