'use strict';
const model=require('../../js/vocabulary-study.cjs'),cloze=require('../../landing/sentence-cloze-engine');
const crypto=require('node:crypto'),contract=require('../../js/vocabulary-course-contract'),guidedContent=require('../../landing/guided-sentence-content');
const COVERAGE_PRACTICES=new Set(['sentence-cloze','guided-expression','word-choice','chunk-order','word-dictation']);
function createVocabularyStudyOperations({db,content,upsertEntityRow,operationError,now=Date.now,enableWordDictation=false,enableWordChoice=false,enableChunkOrder=false,enableReadAloud=false}) {
  const practices={
    'word-dictation':{enabled:enableWordDictation,model:require('../../js/vocabulary-word-dictation'),ability:'word-spelling-from-authored-audio',missing:'当前项目没有课程听写音频'},
    'word-choice':{enabled:enableWordChoice,model:require('../../js/vocabulary-word-choice'),ability:'word-recognition-in-authored-context',input:'choice',missing:'当前项目没有选词素材'},
    'chunk-order':{enabled:enableChunkOrder,model:require('../../js/vocabulary-chunk-order'),ability:'authored-sentence-ordering',input:'chunks',missing:'当前项目没有拼块素材'},
    'read-aloud':{enabled:enableReadAloud,model:require('../../js/vocabulary-read-aloud'),input:'speech',missing:'当前项目没有跟读示范素材'}
  },features={wordDictation:enableWordDictation,wordChoice:enableWordChoice,chunkOrder:enableChunkOrder,readAloud:enableReadAloud,attempts:true};
  function scope(book,unitId,structureRevision,practiceType){
    if(practiceType!==undefined&&(typeof practiceType!=='string'||!Object.hasOwn(contract.modes,practiceType)))throw operationError('练习类型无效','PRACTICE_UNAVAILABLE',422);
    if(practiceType&&!contract.modes[practiceType].implemented&&!practices[practiceType]?.enabled)throw operationError('练习类型尚未实现','PRACTICE_UNAVAILABLE',422);
    if(contract.separatePractice(practiceType)){
      if(!practices[practiceType]?.enabled)throw operationError('当前练习尚未开放','PRACTICE_UNAVAILABLE',422);
      const target=scope(book,unitId,structureRevision);
      return {...target,key:'practice:'+crypto.createHash('sha256').update(JSON.stringify([target.key,practiceType])).digest('hex')};
    }
    if(unitId===undefined){if(structureRevision!==undefined)throw operationError('未选择单元','INVALID_SCOPE',400);return {key:book.bookId,book};}
    const unit=book.units?.find(row=>row.unitId===unitId);
    if(!unit||structureRevision!==book.structureRevision)throw operationError('单元或结构版本无效','CONTENT_VERSION_CHANGED',409);
    const start=book.items.findIndex(ref=>ref.itemId===unit.itemIds[0]);
    return {key:'unit:'+crypto.createHash('sha256').update(JSON.stringify([book.bookId,unitId])).digest('hex'),book:{...book,items:book.items.slice(start,start+unit.itemIds.length),itemCount:unit.itemIds.length},unitId,structureRevision};
  }
  function canPersist(userId){return !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='user_phone_identities'").get()&&
    !!db.prepare('SELECT 1 FROM user_phone_identities WHERE user_id=?').get(userId);}
  function resume(userId,id){const row=db.prepare("SELECT data_json,seq FROM user_entity_rows WHERE user_id=? AND kind='vocabularyResume' AND item_key=? AND deleted_at IS NULL").get(userId,id);
    return {value:row?JSON.parse(row.data_json):null,rev:row?Number(row.seq)||0:0};}
  function project(userId,id,value,unitId){return id.startsWith('personal-book:')&&content.personal?content.personal.projectResume(id,userId,value,unitId):value;}
  function projectPublicResume(userId,id,value,book,targetBook){
    if(!value||id.startsWith('personal-book:')||value.bookRevision===book.revision)return value;
    const refs=new Map(book.items.map(ref=>[ref.itemId,ref])),history=content.versions?.(id,userId).map(row=>row.book)||[book],byRevision=new Map(history.map(row=>[row.revision,new Map(row.items.map(ref=>[ref.itemId,ref]))])),covered=new Set();
    const rows=db.prepare('SELECT item_id,content_revision,data_json FROM vocabulary_study_events WHERE user_id=? AND resource_id=?').all(userId,'wordbook:'+id);
    for(const row of rows){let event;try{event=JSON.parse(row.data_json);}catch{continue;}const source=byRevision.get(event.bookRevision)?.get(row.item_id),sourceBook=history.find(value=>value.revision===event.bookRevision&&(value.structureRevision||null)===event.structureRevision),current=refs.get(row.item_id);
      if(event.evidenceVersion===2&&source?.contentRevision===row.content_revision&&current?.contentRevision===row.content_revision&&event.sessionId!=null&&COVERAGE_PRACTICES.has(event.practiceType)&&event.practiceRevision!=null&&event.structureRevision===(sourceBook?.structureRevision||null)&&(event.unitId==null||sourceBook?.units?.some(unit=>unit.unitId===event.unitId&&unit.itemIds.includes(row.item_id))))covered.add(row.item_id);
    }
    const position=value.status==='completed'?targetBook.items.findIndex(ref=>!covered.has(ref.itemId)):targetBook.items.findIndex(ref=>ref.itemId===value.itemId);
    const next=position<0?targetBook.items.length:position;
    return {...value,bookRevision:book.revision,title:book.title,itemId:targetBook.items[next]?.itemId||null,status:next>=targetBook.items.length?'completed':'in-progress'};
  }
  function currentStructure(userId,id,unitId,revision){return unitId===undefined?revision:content.resolveStructure?content.resolveStructure(id,userId,unitId,revision):id.startsWith('personal-book:')&&content.personal?content.personal.resolveStructure(id,userId,unitId,revision):revision;}
  function state(userId,id,offset=0,limit=20,unitId,structureRevision,practiceType){const target=scope(content.book(id,userId),unitId,currentStructure(userId,id,unitId,structureRevision),practiceType),page=model.pageBook(target.book,offset,limit),saved=resume(userId,target.key),progress={};
    const stored=saved.value;saved.value=project(userId,id,saved.value,unitId);saved.value=projectPublicResume(userId,id,saved.value,content.book(id,userId),target.book);
    let rehearsal;
    if(canPersist(userId)&&practiceType==='read-aloud'){
      const totals=db.prepare('SELECT COUNT(*) reportedAttempts,COUNT(DISTINCT item_id) reportedItems FROM vocabulary_practice_reports WHERE user_id=? AND scope_key=?').get(userId,target.key),items={};
      for(const ref of page.items){const row=db.prepare('SELECT COUNT(*) reportedAttempts,MAX(occurred_at) lastAt FROM vocabulary_practice_reports WHERE user_id=? AND scope_key=? AND item_id=?').get(userId,target.key,ref.itemId);if(row.reportedAttempts)items[ref.itemId]=row;}
      rehearsal={verification:'unverified',...totals,items};
    }else if(canPersist(userId))for(const ref of page.items){const row=db.prepare('SELECT data_json FROM vocabulary_item_progress WHERE user_id=? AND item_id=?').get(userId,ref.itemId);if(row)progress[ref.itemId]=JSON.parse(row.data_json);}
    return {canPersist:canPersist(userId),bookId:id,bookRevision:page.revision,resume:saved.value,resumeRev:saved.rev,
      resumePosition:saved.value?.status==='completed'?target.book.itemCount:saved.value?target.book.items.findIndex(ref=>ref.itemId===saved.value.itemId):0,resumeProjected:stored?.bookRevision!==saved.value?.bookRevision,progress,...(rehearsal?{rehearsal}:{}),unitId:target.unitId,structureRevision:target.structureRevision,features:{unitSessions:true,practiceTypes:true,...features}};}
  function apply(userId,body,seq){
    if(!['vocabulary.session','vocabulary.complete','vocabulary.rehearse','vocabulary.attempt'].includes(body.type))return null;
    const attempting=body.type==='vocabulary.attempt',reporting=body.type==='vocabulary.rehearse',finishing=body.type!=='vocabulary.session';
    const p=body.payload||{},error=(message,status=400,code='INVALID_OPERATION')=>{throw operationError(message,code,status);};
    if(!content)error('单词本服务尚未就绪',503);
    if(!canPersist(userId))error('绑定手机号后可保存单词本学习；当前可使用体验模式',403,'PHONE_IDENTITY_REQUIRED');
    const fields=body.type==='vocabulary.session'?['bookId','bookRevision','action','sessionId','itemId','expectedResumeRev','unitId','structureRevision','practiceType']:['bookId','bookRevision','itemId','contentRevision','sessionId',reporting?'report':'answers','unitId','structureRevision','practiceType','inputMode',...(attempting?['stepIndex']:[])];
    if(Object.keys(p).some(key=>!fields.includes(key))||body.expected!==undefined||body.expectedRev!==undefined||Buffer.byteLength(JSON.stringify(body))>16384||
      !model.validId(p.bookId)||!model.validId(p.sessionId)||!model.validId(p.itemId))error('单词本保存格式无效');
    const latest=content.book(p.bookId,userId);
    const oldVersion=latest.revision!==p.bookRevision&&p.bookId.startsWith('personal-book:')&&!!content.personal;
    const submittedBook=oldVersion?content.personal.historicalBook(p.bookId,userId,p.bookRevision):latest;
    const practiceType=p.practiceType||'sentence-cloze',mode=contract.modes[practiceType],practice=practices[practiceType];
    if(!mode?.implemented&&!practice?.enabled)error('练习类型尚未实现',422,'PRACTICE_UNAVAILABLE');
    if(finishing&&reporting!==(practiceType==='read-aloud'))error('跟读须使用未验证练习自报，不能作为答题正确保存',422,'INVALID_OPERATION_TYPE');
    const submitted=scope(submittedBook,p.unitId,oldVersion?p.structureRevision:currentStructure(userId,p.bookId,p.unitId,p.structureRevision),practiceType);
    const target=scope(latest,p.unitId,currentStructure(userId,p.bookId,p.unitId,p.structureRevision),practiceType),book=target.book;
    if(finishing&&p.inputMode!==undefined&&!mode.inputs.includes(p.inputMode))error('输入方式不属于当前练习',422,'INVALID_INPUT_MODE');
    if(finishing&&practice?.input&&p.inputMode!==practice.input)error('当前练习须明确记录对应输入方式',422,'INVALID_INPUT_MODE');
    if(!oldVersion&&book.revision!==p.bookRevision)error('单词本版本已变化，请重新读取',409,'CONTENT_VERSION_CHANGED');
    if(!submitted.book.items.some(ref=>ref.itemId===p.itemId))error('项目不属于提交时的单词本');
    let practiceItem;
    if(practice&&(finishing||p.action==='start')){
      practiceItem=content.item(p.itemId,submitted.book.items.find(ref=>ref.itemId===p.itemId).contentRevision,userId);
      const activity=practiceItem.learning?.[mode.learningKey];
      if(!activity){if(finishing)error(practice.missing,422,'PRACTICE_UNAVAILABLE');}
      else practice.model.validate(practiceItem,activity,cloze);
    }
    const saved=resume(userId,target.key),time=now();let cursor=project(userId,p.bookId,saved.value,p.unitId),stale=false;
    if(cursor&&cursor.bookRevision!==book.revision&&!(body.type==='vocabulary.session'&&p.action==='start'))error('旧单词本位置属于不同版本，请保留旧记录并重新选择',409,'CONTENT_VERSION_CHANGED');
    if(target.unitId&&cursor&&currentStructure(userId,p.bookId,target.unitId,cursor.structureRevision)!==target.structureRevision)error('单元结构已变化，旧位置保留',409,'CONTENT_VERSION_CHANGED');
    if(attempting){
      const ref=submitted.book.items.find(ref=>ref.itemId===p.itemId);if(p.contentRevision!==ref.contentRevision)error('教学内容版本已变化',409,'CONTENT_VERSION_CHANGED');
      if(!cursor)error('请先开始当前单词本',409,'RESUME_CONFLICT');
      const startRow=db.prepare("SELECT result_json FROM user_operation_receipts WHERE user_id=? AND json_extract(result_json,'$.operation.action')='start' AND json_extract(result_json,'$.operation.bookId')=? AND json_extract(result_json,'$.operation.sessionId')=? ORDER BY rowid DESC LIMIT 1").get(userId,p.bookId,p.sessionId),start=startRow&&JSON.parse(startRow.result_json).operation;
      if(!start||(start.scopeKey||start.bookId)!==target.key||(start.practiceType||'sentence-cloze')!==practiceType||start.bookRevision!==p.bookRevision)error('作答轮次不存在或不属于当前账号/单元',409,'UNKNOWN_SESSION');
      let evaluated;try{evaluated=require('../../js/vocabulary-attempt').evaluate(practiceItem||content.item(p.itemId,p.contentRevision,userId),p,{engine:cloze,guidedContent});}catch(cause){error(cause.message,422,'INVALID_ATTEMPT');}
      const event={...evaluated,bookRevision:p.bookRevision,practiceType,inputMode:p.inputMode,answers:p.answers,...(p.stepIndex===undefined?{}:{stepIndex:p.stepIndex}),unitId:target.unitId||null,structureRevision:p.structureRevision||null};
      db.prepare('INSERT INTO vocabulary_attempt_events(user_id,attempt_id,scope_key,session_id,item_id,resource_id,content_revision,data_json,occurred_at,seq) VALUES(?,?,?,?,?,?,?,?,?,?)').run(userId,body.requestId,target.key,p.sessionId,p.itemId,'wordbook:'+p.bookId,p.contentRevision,JSON.stringify(event),time,seq);
      return {entity:'vocabularyAttempt',id:body.requestId,bookId:p.bookId,practiceType,action:'attempt',correct:evaluated.correct,assessment:false,completion:false,outcome:'recorded'};
    }
    if(body.type==='vocabulary.session'){
      if(!['start','pause','skip'].includes(p.action)||!Number.isSafeInteger(p.expectedResumeRev)||p.expectedResumeRev<0)error('学习位置操作格式无效');
      const expected=cursor||model.initialCursor(book);
      const conflicting=p.expectedResumeRev!==saved.rev||expected.itemId!==p.itemId||p.action!=='start'&&(!cursor||cursor.sessionId!==p.sessionId);
      if(conflicting&&!oldVersion&&!(p.action==='start'&&p.expectedResumeRev===saved.rev))error('单词本位置已被更新，请重新读取',409,'RESUME_CONFLICT');
      stale=oldVersion&&conflicting;
      if(!stale&&p.action!=='start'&&(cursor.practiceType||'sentence-cloze')!==practiceType)error('练习类型与学习轮次不一致',409,'RESUME_CONFLICT');
      if(stale&&p.action!=='start'){
        const row=db.prepare("SELECT result_json FROM user_operation_receipts WHERE user_id=? AND json_extract(result_json,'$.operation.action')='start' AND json_extract(result_json,'$.operation.bookId')=? AND json_extract(result_json,'$.operation.sessionId')=? ORDER BY rowid DESC LIMIT 1").get(userId,p.bookId,p.sessionId),start=row&&JSON.parse(row.result_json).operation;
        if(!start||(start.scopeKey||start.bookId)!==target.key||start.bookRevision!==p.bookRevision||(start.practiceType||'sentence-cloze')!==practiceType)error('旧学习轮次无法核对，待保存记录保留',409,'UNKNOWN_SESSION');
      }
      if(!stale)cursor={...expected,...(p.action==='start'?{itemId:p.itemId,status:'in-progress'}:p.action==='skip'?model.nextCursor(book,p.itemId):{}),sessionId:p.sessionId,practiceType};
    }else{
      if(typeof p.contentRevision!=='string'||p.contentRevision!==book.items.find(ref=>ref.itemId===p.itemId).contentRevision)error('教学内容版本已变化',409,'CONTENT_VERSION_CHANGED');
      const item=practiceItem||content.item(p.itemId,p.contentRevision,userId),blanks=cloze.blanks(item.exercise);
      if(practiceType==='guided-expression'&&!guidedContent.forItem(item))error('缺少中文引导素材',422,'PRACTICE_UNAVAILABLE');
      let report;
      if(reporting){try{report=practice.model.report(item,item.learning[mode.learningKey],p.report,cloze);}catch(cause){error(cause.message,422,'INVALID_REPORT');}}
      const correct=reporting?false:practice?practice.model.evaluate(item,item.learning[mode.learningKey],p.answers,cloze).correct:
        p.answers&&typeof p.answers==='object'&&!Array.isArray(p.answers)&&Object.keys(p.answers).length===blanks.length&&
        !Object.keys(p.answers).some(id=>!blanks.some(blank=>blank.id===id)||typeof p.answers[id]!=='string'||p.answers[id].length>200)&&cloze.evaluate(item.exercise,p.answers).correct;
      if(!reporting&&!correct)error('请完整填写当前练习的正确答案',422,'INVALID_ANSWERS');
      if(!cursor)error('请先开始当前单词本',409,'RESUME_CONFLICT');
      stale=cursor.sessionId!==p.sessionId;
      const receipt=stale&&db.prepare("SELECT result_json FROM user_operation_receipts WHERE user_id=? AND json_extract(result_json,'$.operation.action')='start' AND json_extract(result_json,'$.operation.bookId')=? AND json_extract(result_json,'$.operation.sessionId')=? ORDER BY rowid DESC LIMIT 1").get(userId,p.bookId,p.sessionId);
      const started=receipt&&JSON.parse(receipt.result_json).operation;
      if(stale&&(!started||(started.scopeKey||started.bookId)!==target.key||oldVersion&&started.bookRevision!==p.bookRevision))error('学习轮次不存在或不属于当前账号/单元',409,'UNKNOWN_SESSION');
      if((stale?(started.practiceType||'sentence-cloze'):(cursor.practiceType||'sentence-cloze'))!==practiceType)error('练习类型与学习轮次不一致',409,'RESUME_CONFLICT');
      if(reporting&&db.prepare('SELECT 1 FROM vocabulary_practice_reports WHERE user_id=? AND scope_key=? AND session_id=? AND item_id=?').get(userId,target.key,p.sessionId,p.itemId))error('本轮该词条已确认练习；原记录保留',409,'PRACTICE_ALREADY_REPORTED');
      if(!stale&&cursor.itemId!==p.itemId)error('当前位置已更新，请读取下一词',409,'RESUME_CONFLICT');
      if(reporting){
        const event={...report,bookRevision:p.bookRevision,inputMode:p.inputMode,unitId:target.unitId||null,structureRevision:p.structureRevision||null};
        db.prepare('INSERT INTO vocabulary_practice_reports(user_id,report_id,scope_key,session_id,item_id,resource_id,content_revision,data_json,occurred_at,seq) VALUES(?,?,?,?,?,?,?,?,?,?)').run(userId,body.requestId,target.key,p.sessionId,p.itemId,'wordbook:'+p.bookId,item.contentRevision,JSON.stringify(event),time,seq);
      }else{
      const event={assisted:true,evidenceVersion:2,bookRevision:p.bookRevision,sessionId:p.sessionId,answers:p.answers,practiceType,inputMode:p.inputMode||null,unitId:target.unitId||null,structureRevision:submittedBook.structureRevision||null,practiceRevision:practiceType==='guided-expression'?(item.learning?.guidedExpression?.revision||crypto.createHash('sha256').update(JSON.stringify(guidedContent.forItem(item))).digest('hex')):item.contentRevision};
      if(practice){event.practiceRevision=item.learning[mode.learningKey].revision;event.ability=practice.ability;}
      if(practiceType==='word-dictation')event.audioSha256=item.learning.wordDictation.audio.sha256;
      db.prepare('INSERT INTO vocabulary_study_events(user_id,event_id,item_id,resource_id,content_revision,data_json,occurred_at,seq) VALUES(?,?,?,?,?,?,?,?)')
        .run(userId,body.requestId,p.itemId,'wordbook:'+p.bookId,item.contentRevision,JSON.stringify(event),time,seq);
      const prior=db.prepare('SELECT data_json FROM vocabulary_item_progress WHERE user_id=? AND item_id=?').get(userId,p.itemId);
      const priorValue=prior?JSON.parse(prior.data_json):{},byPractice={...(priorValue.byPractice||{})};
      byPractice[practiceType]={assistedCompletions:(byPractice[practiceType]?.assistedCompletions||0)+1,lastAt:time};
      const value={...priorValue,itemId:p.itemId,assistedCompletions:(priorValue.assistedCompletions||0)+1,lastAt:time,dueAt:time+600000,independentDays:priorValue.independentDays||0,mastered:priorValue.mastered===true,byPractice};
      db.prepare('INSERT INTO vocabulary_item_progress(user_id,item_id,data_json,seq) VALUES(?,?,?,?) ON CONFLICT(user_id,item_id) DO UPDATE SET data_json=excluded.data_json,seq=excluded.seq').run(userId,p.itemId,JSON.stringify(value),seq);
      const completed=db.prepare('SELECT COUNT(DISTINCT item_id) AS n FROM vocabulary_study_events WHERE user_id=? AND resource_id=?').get(userId,'wordbook:'+p.bookId).n;
      upsertEntityRow(userId,'vocabularyStudySummary',p.bookId,{bookId:p.bookId,assistedCompleted:completed,lastAt:time},seq);
      }
      if(!stale)cursor={...cursor,...model.nextCursor(book,p.itemId)};
    }
    if(!stale){cursor={...cursor,bookId:p.bookId,bookRevision:book.revision,title:book.title,serverTime:time,...(target.unitId?{unitId:target.unitId,structureRevision:target.structureRevision}:{})};upsertEntityRow(userId,'vocabularyResume',target.key,cursor,seq);}
    return {entity:'vocabularyResume',id:target.key,scopeKey:target.key,bookId:p.bookId,bookRevision:p.bookRevision,practiceType,sessionId:p.sessionId,action:body.type==='vocabulary.session'?p.action:reporting?'rehearse':'complete',...(reporting?{reportId:body.requestId,verification:'unverified',assessment:false}:{}),rev:stale?saved.rev:seq,outcome:stale?'resume-stale':'applied'};
  }
  return {apply,state,canPersist,resume,capabilities:()=>({...features,attempts:true})};
}
module.exports={createVocabularyStudyOperations};
