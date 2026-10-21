'use strict';
const {createVocabularyCourseProgress}=require('./vocabulary-course-progress');

// Authenticated callers supply the owner. No migrations or writes belong here.
function createVocabularyArchive({ db, content, now = Date.now }) {
  const courseProgress=createVocabularyCourseProgress({db,content});
  function courseReference(userId,resourceId,cache){
    if(!content||typeof resourceId!=='string'||!resourceId.startsWith('wordbook:'))return null;
    const bookId=resourceId.slice('wordbook:'.length);if(!bookId)return null;
    if(!cache.has(bookId)){
      try{const book=content.book(bookId,userId);cache.set(bookId,{bookId,title:book.title||null,available:true});}
      catch(_){cache.set(bookId,{bookId,title:null,available:false});}
    }
    return cache.get(bookId);
  }
  function summary(userId) {
    const books = db.prepare(`SELECT COUNT(*) AS items,
      COALESCE(SUM(CASE WHEN json_extract(data_json,'$.dueAt') > 0
      AND json_extract(data_json,'$.dueAt') <= ? THEN 1 ELSE 0 END),0) AS due
      FROM vocabulary_item_progress WHERE user_id=?`).get(now(), userId);
    const pilot = db.prepare('SELECT COUNT(DISTINCT word) AS items,COUNT(*) AS events FROM vocabulary_attempts WHERE user_id=?').get(userId);
    const bookEvents = db.prepare('SELECT COUNT(*) AS events FROM vocabulary_study_events WHERE user_id=?').get(userId);
    const attempts=db.prepare("SELECT COUNT(*) AS answers,COALESCE(SUM(CASE WHEN json_extract(data_json,'$.correct')=0 THEN 1 ELSE 0 END),0) AS incorrect FROM vocabulary_attempt_events WHERE user_id=?").get(userId);
    const frequentErrors=db.prepare(`SELECT mistakes.item_id,mistakes.resource_id,mistakes.wrong_answers,
      (SELECT recent.content_revision FROM vocabulary_attempt_events AS recent WHERE recent.user_id=?
        AND recent.item_id=mistakes.item_id AND recent.resource_id=mistakes.resource_id
        AND json_extract(recent.data_json,'$.correct')=0 ORDER BY recent.occurred_at DESC,recent.attempt_id DESC LIMIT 1) AS content_revision
      FROM (SELECT item_id,resource_id,COUNT(*) AS wrong_answers,MAX(occurred_at) AS last_at
        FROM vocabulary_attempt_events WHERE user_id=? AND json_extract(data_json,'$.correct')=0
        GROUP BY item_id,resource_id) AS mistakes
      ORDER BY mistakes.wrong_answers DESC,mistakes.last_at DESC,mistakes.item_id LIMIT 5`).all(userId,userId)
      .map(row=>{let title=row.item_id,meaning='';try{const item=content?.item(row.item_id,row.content_revision,userId);if(item){title=item.word;meaning=item.meaning||'';}}catch(_){}return {itemId:row.item_id,resourceId:row.resource_id,title,meaning,wrongAnswers:row.wrong_answers};});
    return { confirmed: true, domains: [
      { source: 'vocabulary-book', unit: '知识项', learnedItems: books.items, events: bookEvents.events, dueItems: books.due,
        verifiedApplicationMastery: 0, applicationAssessmentAvailable: false, errorsRecorded: true,attemptedAnswers:attempts.answers,incorrectAnswers:attempts.incorrect,errorHistory:'recorded-attempts-only',frequentErrors },
      { source: 'vocabulary-pilot', unit: '历史词条', learnedItems: pilot.items, events: pilot.events,
        dueItems: null, verifiedApplicationMastery: 0, applicationAssessmentAvailable: false, errorsRecorded: false },
    ], combinedUniqueItems: null, identityNote: '旧词条与单词本分开统计，不合并。' };
  }
  function events(userId, { offset = 0, limit = 20 } = {}) {
    offset = Number(offset); limit = Number(limit);
    if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
      throw Object.assign(new Error('分页参数无效'), { status: 400 });
    }
    const rows = db.prepare(`SELECT source,event_id,item_id,resource_id,content_revision,occurred_at,independent,practice_type,input_mode FROM (
      SELECT 'vocabulary-book' AS source,event_id,item_id,resource_id,content_revision,occurred_at,NULL AS independent,
        json_extract(data_json,'$.practiceType') AS practice_type,json_extract(data_json,'$.inputMode') AS input_mode
      FROM vocabulary_study_events WHERE user_id=?
      UNION ALL
      SELECT 'vocabulary-pilot' AS source,event_id,word AS item_id,NULL AS resource_id,NULL AS content_revision,occurred_at,independent,NULL AS practice_type,NULL AS input_mode
      FROM vocabulary_attempts WHERE user_id=?
    ) ORDER BY occurred_at DESC,source,event_id LIMIT ? OFFSET ?`).all(userId, userId, limit + 1, offset);
    const hasMore = rows.length > limit;
    const courseCache=new Map();
    return { confirmed: true, items: rows.slice(0, limit).map(row => {
      let title=row.item_id, meaning='', contentAvailable=row.source==='vocabulary-pilot';
      if(content && row.source==='vocabulary-book') {
        try {const item=content.item(row.item_id,row.content_revision,userId);title=item.word;meaning=item.meaning;contentAvailable=true;}
        catch(error) {contentAvailable=false;}
      }
      return ({
      id: row.source + ':' + row.event_id, source: row.source, itemId: row.item_id,
      title, meaning, contentAvailable,
      resourceId: row.resource_id, course:courseReference(userId,row.resource_id,courseCache), contentRevision: row.content_revision, at: row.occurred_at,
      practiceType: row.practice_type, inputMode: row.input_mode,
      outcome: row.source === 'vocabulary-book' ? 'assisted-completion' : row.independent ? 'independent-recall' : 'assisted-completion',
      evidenceScope: row.source === 'vocabulary-pilot' && row.independent ? 'word-recall' : 'assisted-practice',
    });}), nextOffset: hasMore ? offset + limit : null };
  }
  function attempts(userId,{offset=0,limit=20,incorrect}={}){
    offset=Number(offset);limit=Number(limit);if(!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(limit)||limit<1||limit>100||incorrect!==undefined&&!['true','false'].includes(String(incorrect)))throw Object.assign(new Error('分页或筛选参数无效'),{status:400});
    const filter=incorrect===undefined?'':" AND json_extract(data_json,'$.correct')="+(String(incorrect)==='true'?'0':'1');
    const rows=db.prepare('SELECT * FROM vocabulary_attempt_events WHERE user_id=?'+filter+' ORDER BY occurred_at DESC,attempt_id LIMIT ? OFFSET ?').all(userId,limit+1,offset);
    const courseCache=new Map();
    return {confirmed:true,history:'recorded-attempts-only',items:rows.slice(0,limit).map(row=>{const data=JSON.parse(row.data_json);let title=row.item_id,meaning='',contentAvailable=false,submittedText='';try{const item=content?.item(row.item_id,row.content_revision,userId);if(item){title=item.word;meaning=item.meaning;contentAvailable=true;if(data.practiceType==='word-choice')submittedText=item.learning?.wordChoice?.options.find(option=>option.id===data.answers.optionId)?.text||'';if(data.practiceType==='chunk-order')submittedText=data.answers.chunkIds.map(id=>item.learning?.chunkOrder?.chunks.find(chunk=>chunk.id===id)?.text||id).join(' ');}}catch(_){}
      if(!submittedText&&data.practiceType!=='word-choice'&&data.practiceType!=='chunk-order')submittedText=Object.values(data.answers||{}).map(String).join(' / ');
      return {id:'vocabulary-attempt:'+row.attempt_id,source:'vocabulary-attempt',itemId:row.item_id,title,meaning,contentAvailable,submittedText,resourceId:row.resource_id,course:courseReference(userId,row.resource_id,courseCache),contentRevision:row.content_revision,at:row.occurred_at,practiceType:data.practiceType,inputMode:data.inputMode,answers:data.answers,stepIndex:data.stepIndex,correct:data.correct,outcome:data.correct?'answer-correct':'answer-incorrect',evidenceScope:'submitted-answer',completion:false,assessment:false};
    }),nextOffset:rows.length>limit?offset+limit:null};
  }
  return { summary, events,attempts,courses:(userId,options)=>courseProgress.courses(userId,options),course:(userId,bookId)=>courseProgress.course(userId,bookId) };
}
module.exports = { createVocabularyArchive };
