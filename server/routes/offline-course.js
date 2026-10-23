'use strict';
function registerOfflineCourseRoutes({app,auth,units,licenses}){
  app.get('/api/offline-courses/public-key',auth.authenticate,(_,res)=>{
    res.set('Cache-Control','private, no-store');
    if(!licenses)return res.status(503).json({code:'OFFLINE_LICENSE_UNAVAILABLE'});
    res.json({publicKey:licenses.publicJwk()});
  });
  app.get('/api/offline-courses/:courseId/units/:unitId',auth.authenticate,(req,res)=>{
    res.set('Cache-Control','private, no-store');
    if(!units)return res.status(503).json({code:'OFFLINE_LICENSE_UNAVAILABLE'});
    try{res.json(units.read({courseId:req.params.courseId,unitId:req.params.unitId},req.userId));}
    catch(error){res.status(error.status||503).json({code:error.code||'OFFLINE_UNIT_UNAVAILABLE'});}
  });
}
module.exports={registerOfflineCourseRoutes};
