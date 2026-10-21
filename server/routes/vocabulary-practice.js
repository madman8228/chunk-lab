'use strict';
const {lessons}=require('../../landing/practice-content');
const allowed=new Set(lessons.map(x=>x.w));
function registerVocabularyPracticeRoutes({app,auth,db,now=Date.now}){
  db.exec(`CREATE TABLE IF NOT EXISTS vocabulary_attempts (
    user_id INTEGER NOT NULL REFERENCES users(id), event_id TEXT NOT NULL,
    word TEXT NOT NULL, independent INTEGER NOT NULL, occurred_at INTEGER NOT NULL,
    PRIMARY KEY(user_id,event_id));
    CREATE INDEX IF NOT EXISTS vocabulary_attempts_owner ON vocabulary_attempts(user_id,word,occurred_at);`);
  function read(uid){
    const progress={};
    for(const row of db.prepare('SELECT word,independent,occurred_at FROM vocabulary_attempts WHERE user_id=? ORDER BY occurred_at,rowid').all(uid)){
      const p=progress[row.word]||{successes:0,lastAt:0,dueAt:0,independentDays:0,mastered:false};
      const spaced=p.lastAt>0&&row.occurred_at-p.lastAt>=20*3600000;
      p.successes=row.independent?p.successes+1:0;
      p.independentDays=row.independent?(spaced?p.independentDays+1:p.independentDays):0;
      // Immediate success never counts as durable mastery. Delayed independent
      // retrieval on two later occasions is required.
      p.mastered=p.independentDays>=2;
      const delay=row.independent?(p.independentDays?Math.min(14,2**p.independentDays):1)*86400000:10*60000;
      p.lastAt=row.occurred_at;p.dueAt=row.occurred_at+delay;progress[row.word]=p;
    }
    return progress;
  }
  app.get('/api/vocabulary-practice',auth.authenticate,(req,res)=>res.json({progress:read(req.userId)}));
  app.post('/api/vocabulary-practice',auth.authenticate,(req,res)=>{
    const b=req.body||{};
    if(typeof b.eventId!=='string'||!/^[-a-zA-Z0-9]{8,80}$/.test(b.eventId)||!allowed.has(b.word)||typeof b.independent!=='boolean') return res.status(400).json({error:'练习记录格式不正确'});
    const old=db.prepare('SELECT word,independent FROM vocabulary_attempts WHERE user_id=? AND event_id=?').get(req.userId,b.eventId);
    if(old&&(old.word!==b.word||!!old.independent!==b.independent)) return res.status(409).json({error:'练习记录标识重复'});
    if(!old)db.prepare('INSERT INTO vocabulary_attempts VALUES(?,?,?,?,?)').run(req.userId,b.eventId,b.word,b.independent?1:0,now());
    res.json({ok:true,progress:read(req.userId)});
  });
}
module.exports={registerVocabularyPracticeRoutes};
