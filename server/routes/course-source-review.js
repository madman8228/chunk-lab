'use strict';
function registerCourseSourceReviewRoutes({app,adminOnly,inventory}) {
  app.post('/api/admin/membership/course-source-review',adminOnly,(req,res)=>{
    res.set('Cache-Control','private, no-store');
    try{res.json(inventory.inspect(req.body?.courseIds));}
    catch(error){res.status(error.status||503).json({code:error.code||'SERVICE_UNAVAILABLE',
      error:'来源检查尚未完成，请核对课程清单、分片及文件完整性。当前课程访问级别保持原样。'});}
  });
}
module.exports={registerCourseSourceReviewRoutes};
