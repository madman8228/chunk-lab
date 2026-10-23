'use strict';
function registerTextbookProductionRoutes({app,adminOnly,service,appRoot}){
 const run=action=>(req,res)=>Promise.resolve().then(()=>action(req)).then(result=>res.set('Cache-Control','private, no-store').json(result)).catch(error=>res.status(error.status||422).json({error:error.message}));
 app.get('/textbook-production.html',(req,res)=>res.set('Cache-Control','no-store').sendFile(require('node:path').join(appRoot,'scripts/textbook-production.html')));
 app.get('/api/admin/textbook-production/status',adminOnly,run(req=>service.status(req.query.refresh==='1')));
 app.get('/api/admin/textbook-production/items',adminOnly,run(req=>service.itemPage(req.query.bookId)));
 app.get('/api/admin/textbook-production/audio/:sha',adminOnly,(req,res)=>service.audio(req.params.sha).then(bytes=>res.set('Cache-Control','private, no-store').type('audio/ogg').send(bytes)).catch(error=>res.status(error.status||422).json({error:error.message})));
 app.get('/api/admin/textbook-production/jobs/:id',adminOnly,run(req=>service.job(req.params.id)));
 app.post('/api/admin/textbook-production/jobs',adminOnly,run(req=>service.start(req.body,req.admin)));
}
module.exports={registerTextbookProductionRoutes};
