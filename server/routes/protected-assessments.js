'use strict';
function registerProtectedAssessmentRoutes({app,auth,assessments,writeProtocol}) {
  app.post('/api/protected-assessments/start',auth.authenticate,(req,res)=>{
    res.set('Cache-Control','private, no-store');
    if(writeProtocol!==3){res.status(428).json({code:'CLIENT_UPDATE_REQUIRED'});return;}
    try{
      const result=assessments.start(req.body,req.userId);
      res.status(result.allowed===false ? result.status||403 : 200).json(result);
    }catch(error){res.status(error.status||503).json({reasonCode:error.code||'SERVICE_UNAVAILABLE',code:error.code||'SERVICE_UNAVAILABLE',
      ...(error.conflicts ? {conflicts:error.conflicts} : {})});}
  });
}
module.exports={registerProtectedAssessmentRoutes};
