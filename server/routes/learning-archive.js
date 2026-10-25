'use strict';
const { createVocabularyArchive } = require('../services/vocabulary-archive');
function registerLearningArchiveRoutes({ app, auth, db, content, review, dailyReview }) {
  const archive = createVocabularyArchive({ db, content });
  const read = fn => (req, res) => {
    try { res.json(fn(req)); }
    catch (error) { res.status(error.status || 500).json({ error: error.status === 400 ? error.message : '学习记录暂时读取失败' }); }
  };
  app.get('/api/learning-archive/vocabulary/summary', auth.authenticate, read(req => archive.summary(req.userId)));
  app.get('/api/learning-archive/vocabulary/courses',auth.authenticate,read(req=>{
    if(req.query.bookId!==undefined){if(typeof req.query.bookId!=='string'||Object.keys(req.query).some(key=>key!=='bookId'))throw Object.assign(new Error('课程查询参数无效'),{status:400});return {confirmed:true,policy:'practice-coverage-v1',course:archive.course(req.userId,req.query.bookId)};}
    if(Object.keys(req.query).some(key=>!['offset','limit'].includes(key)))throw Object.assign(new Error('课程查询参数无效'),{status:400});
    return archive.courses(req.userId,req.query);
  }));
  app.get('/api/learning-archive/vocabulary/events', auth.authenticate, read(req => archive.events(req.userId, req.query)));
  app.get('/api/learning-archive/vocabulary/attempts',auth.authenticate,read(req=>archive.attempts(req.userId,req.query)));
  app.get('/api/learning-archive/vocabulary/review', auth.authenticate, (req,res,next)=>{res.set('Cache-Control','private, no-store');next();}, read(req=>{
    if(Object.keys(req.query).some(key=>!['bookId','practiceType','kind','offset','limit'].includes(key)))throw Object.assign(new Error('专项复习筛选条件无效'),{status:400});
    return review.list(req.userId,req.query);
  }));
  app.get('/api/learning-archive/vocabulary/review-sessions/:sessionId', auth.authenticate,
    (req,res,next)=>{res.set('Cache-Control','private, no-store');next();}, read(req=>review.session(req.userId,req.params.sessionId)));
  app.get('/api/learning-archive/daily-review-sessions/:sessionId', auth.authenticate,
    (req,res,next)=>{res.set('Cache-Control','private, no-store');next();}, read(req=>({confirmed:true,...dailyReview.session(req.userId,req.params.sessionId)})));
}
module.exports = { registerLearningArchiveRoutes };
