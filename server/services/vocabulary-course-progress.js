'use strict';

const COVERAGE_PRACTICES=new Set(['sentence-cloze','guided-expression','word-choice','chunk-order','word-dictation']);
const notFound=()=>Object.assign(new Error('单词课程不存在或不可用'),{status:404});

function createVocabularyCourseProgress({db,content}){
  function versions(bookId,userId,current){
    if(bookId.startsWith('personal-book:'))return content.personal.versions(bookId,userId);
    return content.versions?content.versions(bookId,userId).map(row=>row.book):[current];
  }
  function isCoveredPrefix(previous,next){
    if(previous.items.length>next.items.length||previous.items.some((ref,index)=>ref.itemId!==next.items[index]?.itemId||ref.contentRevision!==next.items[index]?.contentRevision))return false;
    const oldUnits=previous.units||[],newUnits=next.units||[];
    return oldUnits.length<=newUnits.length&&oldUnits.every((unit,index)=>JSON.stringify(unit)===JSON.stringify(newUnits[index]));
  }
  function course(userId,bookId){
    if(!Number.isSafeInteger(userId)||userId<=0||typeof bookId!=='string'||!bookId)throw notFound();
    const current=content.book(bookId,userId),history=versions(bookId,userId,current);
    if(!history.length||!history.some(row=>row.revision===current.revision))throw Object.assign(new Error('课程版本无法核实'),{status:409});
    const checked=bookId.startsWith('personal-book:')?history:[...new Map(history.map(row=>[row.revision,row])).values()];
    const evidenceByRevision=new Map(checked.map(book=>[book.revision,new Map()]));
    const refsByRevision=new Map(checked.map(book=>[book.revision,new Map(book.items.map(ref=>[ref.itemId,ref]))]));
    const eventRows=db.prepare('SELECT item_id,content_revision,data_json,occurred_at FROM vocabulary_study_events WHERE user_id=? AND resource_id=? ORDER BY occurred_at,event_id').all(userId,'wordbook:'+bookId);
    let legacyEventCount=0;
    for(const row of eventRows){
      let event;try{event=JSON.parse(row.data_json);}catch(_){legacyEventCount++;continue;}
      const revision=event.bookRevision,source=evidenceByRevision.get(revision),ref=refsByRevision.get(revision)?.get(row.item_id);
      if(event.evidenceVersion!==2||!source||!ref||ref.contentRevision!==row.content_revision||
        event.sessionId==null||!COVERAGE_PRACTICES.has(event.practiceType)||
        event.practiceRevision==null||event.structureRevision!==(checked.find(book=>book.revision===revision)?.structureRevision||null)||
        (event.unitId!=null&&!checked.find(book=>book.revision===revision)?.units?.some(unit=>unit.unitId===event.unitId&&unit.itemIds.includes(row.item_id)))){
        legacyEventCount++;continue;
      }
      const prior=source.get(row.item_id);
      if(!prior||row.occurred_at<prior.at)source.set(row.item_id,{at:row.occurred_at,practiceType:event.practiceType});
    }
    const lastRow=db.prepare(`SELECT MAX(at) AS at FROM (
      SELECT occurred_at AS at FROM vocabulary_study_events WHERE user_id=? AND resource_id=?
      UNION ALL SELECT occurred_at FROM vocabulary_attempt_events WHERE user_id=? AND resource_id=?
      UNION ALL SELECT occurred_at FROM vocabulary_practice_reports WHERE user_id=? AND resource_id=?
    )`).get(userId,'wordbook:'+bookId,userId,'wordbook:'+bookId,userId,'wordbook:'+bookId);
    function progress(book){
      const refs=book.items,coveredAt=new Map();
      for(const sourceBook of checked){
        if(bookId.startsWith('personal-book:')&&checked.indexOf(sourceBook)<checked.indexOf(book)&&!isCoveredPrefix(sourceBook,book))continue;
        for(const [itemId,evidence] of evidenceByRevision.get(sourceBook.revision)){
          const target=refsByRevision.get(book.revision).get(itemId);
          const sourceRef=refsByRevision.get(sourceBook.revision).get(itemId);
          if(target&&sourceRef?.contentRevision===target.contentRevision&&!coveredAt.has(itemId))coveredAt.set(itemId,evidence.at);
        }
      }
      const total=refs.length,completed=coveredAt.size,completedAt=total>0&&completed===total?Math.max(...coveredAt.values()):null;
      const units=(book.units||[]).map(unit=>{
        const count=unit.itemIds.filter(id=>coveredAt.has(id)).length;
        return {unitId:unit.unitId,title:unit.title,totalItems:unit.itemIds.length,completedItems:count,state:count===unit.itemIds.length?'completed':count?'in-progress':'not-started'};
      });
      return {totalItems:total,completedItems:completed,completedAt,units};
    }
    const completedVersions=[];
    checked.forEach(book=>{const p=progress(book);if(p.totalItems>0&&p.completedItems===p.totalItems&&!completedVersions.some(row=>row.bookRevision===book.revision))completedVersions.push({bookRevision:book.revision,structureRevision:book.structureRevision||null,totalItems:p.totalItems,completedAt:p.completedAt});});
    const currentProgress=progress(current),everCompleted=completedVersions.length>0;
    let state=currentProgress.completedItems===currentProgress.totalItems&&currentProgress.totalItems>0?'completed':
      everCompleted?'updated':currentProgress.completedItems?'in-progress':legacyEventCount?'unverified':'not-started';
    return {
      bookId,title:current.title,bookRevision:current.revision,structureRevision:current.structureRevision||null,state,
      ...currentProgress,lastActivityAt:lastRow?.at??null,
      evidence:legacyEventCount?'partial-history':'verified',legacyEventCount,
      completedVersions,
    };
  }
  function courses(userId,{offset=0,limit=20}={}){
    offset=Number(offset);limit=Number(limit);
    if(!Number.isSafeInteger(userId)||userId<=0)throw Object.assign(new Error('分页参数无效'),{status:400});
    if(!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(limit)||limit<1||limit>100)throw Object.assign(new Error('分页参数无效'),{status:400});
    const ids=new Set();
    function fromRows(sql,mapper){for(const row of db.prepare(sql).all(userId)){const id=mapper(row);if(typeof id==='string'&&id)ids.add(id);}}
    fromRows('SELECT DISTINCT resource_id FROM vocabulary_study_events WHERE user_id=?',row=>row.resource_id?.startsWith('wordbook:')?row.resource_id.slice(9):null);
    fromRows('SELECT DISTINCT resource_id FROM vocabulary_attempt_events WHERE user_id=?',row=>row.resource_id?.startsWith('wordbook:')?row.resource_id.slice(9):null);
    fromRows('SELECT DISTINCT resource_id FROM vocabulary_practice_reports WHERE user_id=?',row=>row.resource_id?.startsWith('wordbook:')?row.resource_id.slice(9):null);
    if(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='user_entity_rows'").get()){
      for(const row of db.prepare("SELECT data_json FROM user_entity_rows WHERE user_id=? AND kind='vocabularyResume' AND deleted_at IS NULL").all(userId))try{const id=JSON.parse(row.data_json).bookId;if(id)ids.add(id);}catch(_){}
    }
    if(content?.personal)for(const row of content.personal.resources(userId))if(row.sourceRefs?.[0]?.id)ids.add(row.sourceRefs[0].id);
    const all=[...ids].map(bookId=>{try{return course(userId,bookId);}catch(error){if([404,409,503].includes(error.status))return {bookId,title:'课程暂不可用',state:'unavailable',totalItems:null,completedItems:null,completedAt:null,lastActivityAt:null,evidence:'unavailable',legacyEventCount:0,units:[],completedVersions:[]};throw error;}})
      .sort((a,b)=>(b.lastActivityAt||0)-(a.lastActivityAt||0)||a.bookId.localeCompare(b.bookId));
    const countBy=state=>all.filter(row=>row.state===state).length;
    const totals={currentCompletedCourses:countBy('completed'),everCompletedCourses:all.filter(row=>row.completedVersions?.length>0).length,updatedCourses:countBy('updated'),unverifiedCourses:countBy('unverified'),unavailableCourses:countBy('unavailable')};
    const page=all.slice(offset,offset+limit);
    return {confirmed:true,policy:'practice-coverage-v1',totals,items:page,nextOffset:offset+limit<all.length?offset+limit:null};
  }
  return {course,courses};
}

module.exports={createVocabularyCourseProgress};
