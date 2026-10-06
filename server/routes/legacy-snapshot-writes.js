'use strict';

/* Isolated pre-upgrade fixtures only. Never registered by protocol 3. */
function registerLegacySnapshotWrites({app,auth,rejectUnconditional,validate,saveData}) {
  function write(label,backup) {
    return function(req,res) {
      try {
        const body=req.body||{};
        if(rejectUnconditional(body,res,label)) return;
        const error=validate.validatePutPayload(body);
        if(error) return res.status(400).json({error:(backup?'备份数据校验失败：':'数据校验失败：')+error});
        const seq=saveData(req.userId,body);
        res.json(backup||body.baseSeq===undefined?{ok:true}:{ok:true,seq});
      } catch(error) {
        if(error.code==='SYNC_CONFLICT'||error.code==='COURSE_LIMIT_REACHED') {
          return res.status(error.status||409).json({error:error.message,code:error.code,conflicts:error.conflicts});
        }
        res.status(500).json({error:error.message});
      }
    };
  }
  app.put('/api/data',auth.authenticate,write('数据写入',false));
  app.post('/api/import',auth.authenticate,write('备份导入',true));
}

module.exports={registerLegacySnapshotWrites};
