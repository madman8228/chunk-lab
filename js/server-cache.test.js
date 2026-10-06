'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const window = {};
window.LearningEngine = require('./learning-engine.cjs');
window.CL = { srs:{recordResult:(stat,ok,now)=>({...stat,interval:ok?2:1,repetition:ok?1:0,dueAt:now+60000})} };
vm.runInNewContext(fs.readFileSync(require.resolve('./server-cache.js'), 'utf8'), { window, Date, JSON, Object, Array, Number, Set, Error, Promise, URL, Intl });
const cache = window.ServerCache;
const same = (actual, expected) => assert.equal(JSON.stringify(actual), JSON.stringify(expected));

const full = {
  seq: 4, delta: false,
  mem: {
    decks: [{ id: 'd1', name: 'One' }, { id: 'd2', name: 'Two' }],
    best: { d1: { perfect: 1 } }, settings: { sound: true },
    stats: { totalRounds: 2, totalAnswered: 8, bySentence: { 'd1#a': { times: 3 }, 'd2#b': { times: 2 } }, events: [{ id: 'e1' }, { id: 'e2' }] },
    mastered: { 'd1#a': true }, deletedItems: {}, reinforceBook: [{ _key: 'wrong-1' }],
    logicalCourses: { 'logical-course:old': { id: 'logical-course:old', title: 'Old directory' } },
  },
  courses: [{ courseId: 'c1', name: 'Course 1' }],
  courseProgress: { c1: { idx: 2 } }, learningResumes: { s1: { sessionId: 's1', idx: 2 } }, learningGenerations: { 'course:c1': 0 },
  revs: { decks: { d1: 1, d2: 1 }, kv: { stats: 2 }, courses: { c1: 1 }, courseProgress: { c1: 1 }, logicalCourses: { 'logical-course:old': 4 } },
  entityGone: { mastered: [], reinforce: [], deletedItem: [], logicalCourse: [] }, deleted: {},
};
const base = cache.mergeSnapshot(null, full);
base.owner = 'owner-1'; base.scope = 'scope-1';
assert.equal(base.appliedSeq, 4);

const courseCache = { owner:'owner-1', scope:'scope-1', appliedSeq:4,
  snapshot:{ courseProgress:{ c1:{generation:2,seen:['a'],passed:['a'],completed:false,currentNodeId:'a'} } } };
function coursePending(ordinal, payload, extra) {
  return Object.assign({owner:'owner-1',scope:'scope-1',ordinal,status:'pending',
    operation:{type:'course.progress',payload:Object.assign({courseId:'c1',generation:2,passed:true,completed:false},payload)}},extra);
}
const projected = cache.projectCourseProgress(courseCache, [
  coursePending(2,{nodeId:'c',currentNodeId:'c',completed:true}),
  coursePending(1,{nodeId:'b',currentNodeId:'b'}),
  coursePending(3,{nodeId:'old',generation:1}),
  coursePending(4,{nodeId:'other'},{scope:'other-service'}),
  coursePending(5,{nodeId:'blocked'},{status:'blocked'}),
  coursePending(6,{nodeId:'covered',currentNodeId:'covered'},{status:'acked-awaiting-apply',receipt:{seq:4}})
]);
same(projected.c1.seen,['a','b','c']);
assert.equal(projected.c1.currentNodeId,'c');
assert.equal(projected.c1.completed,true);
same(courseCache.snapshot.courseProgress.c1.seen,['a']);
const catalogCache={owner:'owner-1',scope:'scope-1',appliedSeq:4,snapshot:{courses:[{courseId:'story',version:'1'}],mem:{decks:[{id:'d1',name:'server'}],deletedItems:{'builtin#old':true},logicalCourses:{'logical-course:old':{id:'logical-course:old',title:'Old directory'}}},courseProgress:{}}};
const catalogView=cache.projectCatalog(catalogCache,[
  {owner:'owner-1',scope:'scope-1',ordinal:1,status:'pending',operation:{type:'course.put',payload:{course:{courseId:'story-2',version:'1'}}}},
  {owner:'owner-1',scope:'scope-1',ordinal:2,status:'pending',createdAt:7,operation:{type:'course.enrollment',payload:{courseId:'story-2',joined:true}}},
  {owner:'owner-1',scope:'scope-1',ordinal:3,status:'pending',operation:{type:'deck.put',payload:{deck:{id:'d2',name:'new'}}}},
  {owner:'owner-1',scope:'scope-1',ordinal:4,status:'pending',operation:{type:'deck.delete',payload:{deckId:'d1'}}},
  {owner:'owner-1',scope:'scope-1',ordinal:5,status:'pending',operation:{type:'deck.publish',payload:{deckId:'d2',publish:true}}},
  {owner:'owner-1',scope:'scope-1',ordinal:6,status:'pending',operation:{type:'deck.itemsVisibility',payload:{deckId:'builtin',keys:['builtin#new'],hidden:true}}},
  {owner:'owner-1',scope:'scope-1',ordinal:7,status:'pending',operation:{type:'logicalCourse.put',payload:{course:{id:'logical-course:new',title:'New directory'}}}},
  {owner:'owner-1',scope:'scope-1',ordinal:8,status:'pending',operation:{type:'logicalCourse.delete',payload:{courseId:'logical-course:old'}}}
]);
same(catalogView.courses.map(item=>item.courseId),['story','story-2']);
same(catalogView.decks,[{id:'d2',name:'new',isPublic:true}]);
assert.equal(catalogView.courseProgress['enrollment:v1:story-2'].joined,true);
same(catalogView.deletedItems,{'builtin#old':true,'builtin#new':true});
same(catalogView.logicalCourses,[{id:'logical-course:new',title:'New directory'}]);
same(catalogCache.snapshot.mem.decks,[{id:'d1',name:'server'}]);
same(catalogCache.snapshot.mem.deletedItems,{'builtin#old':true},'pending visibility changes do not mutate the confirmed cache');
const afterDelete=cache.projectCourseProgress({owner:'owner-1',scope:'scope-1',appliedSeq:4,
  snapshot:{courseProgress:{story:{generation:0,seen:['old'],passed:[],completed:true},'enrollment:v1:story':{joined:true}}}},[
  {owner:'owner-1',scope:'scope-1',ordinal:1,status:'pending',operation:{type:'course.delete',payload:{courseId:'story'}}},
  {owner:'owner-1',scope:'scope-1',ordinal:2,status:'pending',operation:{type:'course.progress',payload:{courseId:'story',generation:0,nodeId:'late',passed:true,completed:true}}}
]);
assert.equal(Object.hasOwn(afterDelete,'story'),false,'pending deletion hides prior course progress');
assert.equal(Object.hasOwn(afterDelete,'enrollment:v1:story'),false,'pending deletion hides enrollment reference');

const homeCache={owner:'owner-1',scope:'scope-1',appliedSeq:9,snapshot:{courses:[{courseId:'server-course',version:'v1',title:'Server course'}],mem:{
  decks:[{id:'server-deck',name:'Server deck'}],best:{'server-deck':{acc:90}},
  mastered:{'server-deck#one':{markedAt:12}},stats:{totalAnswered:4,totalRounds:2,bySentence:{'server-deck#one':{times:4}},events:[]},
  settings:{mode:'type'},deletedItems:{},reinforceBook:[{_key:'server-deck::wrong'}],
},courseProgress:{'enrollment:v1:server-course':{kind:'course-enrollment',courseId:'server-course',joined:true,joinedAt:11}},
learningResumes:{session1:{sessionId:'session1',deckId:'server-deck',idx:3,updatedAt:20,generation:2,practiceMode:'type'}},
learningGenerations:{'course:server-deck':2}}};
const deleteCache={owner:'owner-1',scope:'scope-1',appliedSeq:4,snapshot:{
  courses:[{courseId:'remove-course',title:'Remove course'},{courseId:'keep-course',title:'Keep course'}],
  mem:{decks:[{id:'remove-deck',name:'Remove deck'},{id:'keep-deck',name:'Keep deck'}],
    best:{'remove-deck':{acc:99},'keep-deck':{acc:80}},
    mastered:{'remove-course#one':{sentence:'old'},'remove-deck#two':{sentence:'old'},'keep-deck#three':{sentence:'keep'}},
    stats:{totalAnswered:7,totalRounds:2,bySentence:{'remove-course#one':{times:3},'remove-deck#two':{times:2},'keep-deck#three':{times:2}},events:[{id:'historic-event'}]},
    reinforceBook:[{_key:'remove-course::wrong'},{_key:'remove-deck::wrong'},{_key:'keep-deck::wrong'}],
    settings:{sound:true},deletedItems:{},logicalCourses:{}},
  courseProgress:{'remove-course':{generation:0,completed:true},'enrollment:v1:remove-course':{joined:true},
    'enrollment:v1:remove-deck':{joined:true},'enrollment:v1:keep-deck':{joined:true}},
  learningResumes:{courseResume:{sessionId:'courseResume',courseId:'remove-course',deckId:'remove-course',idx:1,updatedAt:10},
    deckResume:{sessionId:'deckResume',deckId:'remove-deck',idx:2,updatedAt:11},
    keepResume:{sessionId:'keepResume',deckId:'keep-deck',idx:3,updatedAt:12}},
  learningGenerations:{'course:remove-course':4,'course:remove-deck':2},
  revs:{courses:{'remove-course':3,'keep-course':1},decks:{'remove-deck':2,'keep-deck':1},
    courseProgress:{},logicalCourses:{},kv:{}}}};
const deleteProjection=cache.projectMainMem(deleteCache,[
  {owner:'owner-1',scope:'scope-1',ordinal:1,status:'pending',operation:{type:'course.delete',expectedRev:3,payload:{courseId:'remove-course'}}},
  {owner:'owner-1',scope:'scope-1',ordinal:2,status:'pending',operation:{type:'deck.delete',expectedRev:2,payload:{deckId:'remove-deck'}}},
]);
assert.equal(deleteProjection.ready,true,'revision-matched isolated content deletion can be projected after refresh');
same(deleteProjection.courses.map(course=>course.courseId),['keep-course']);
same(deleteProjection.mem.decks.map(deck=>deck.id),['keep-deck']);
same(Object.keys(deleteProjection.mem.stats.bySentence),['keep-deck#three']);
assert.equal(deleteProjection.mem.stats.totalAnswered,7,'content deletion preserves account-level answer totals');
same(Object.keys(deleteProjection.mem.mastered),['keep-deck#three']);
same(deleteProjection.mem.reinforceBook.map(row=>row._key),['keep-deck::wrong']);
same(Object.keys(deleteProjection.mem.best),['keep-deck']);
assert.equal(Object.hasOwn(deleteProjection.courseProgress,'remove-course'),false);
assert.equal(Object.hasOwn(deleteProjection.courseProgress,'enrollment:v1:remove-course'),false);
assert.equal(Object.hasOwn(deleteProjection.courseProgress,'enrollment:v1:remove-deck'),false);
same(deleteProjection.progress,{ 'keep-deck':{idx:3,time:12,sessionId:'keepResume',generation:0} });
assert.equal(deleteProjection.learningGenerations['course:remove-course'],5);
assert.equal(deleteProjection.learningGenerations['course:remove-deck'],3);
assert.equal(deleteCache.snapshot.mem.stats.bySentence['remove-deck#two'].times,2,'delete projection leaves confirmed cache immutable');
assert.equal(cache.projectMainMem(deleteCache,[
  {owner:'owner-1',scope:'scope-1',ordinal:1,status:'pending',operation:{type:'deck.delete',expectedRev:1,payload:{deckId:'remove-deck'}}},
]).ready,false,'a stale content revision fails closed');
assert.equal(cache.projectMainMem(deleteCache,[
  {owner:'owner-1',scope:'scope-1',ordinal:1,status:'pending',operation:{type:'deck.delete',expectedRev:2,payload:{deckId:'remove-deck'}}},
  {owner:'owner-1',scope:'scope-1',ordinal:2,status:'pending',operation:{type:'learning.answer',payload:{deckId:'remove-deck',courseId:'remove-deck'}}},
]).ready,false,'content deletion and learning writes for the same target are not speculatively reordered');
const homeProjection=cache.projectMainMem(homeCache,[]);
assert.equal(homeProjection.ready,true,'a clean browser can use the confirmed server snapshot as its home source');
same(homeProjection.mem.decks,[{id:'server-deck',name:'Server deck'}]);
same(homeProjection.mem.best,homeCache.snapshot.mem.best);
same(homeProjection.courses,homeCache.snapshot.courses);
same(homeProjection.courseProgress,homeCache.snapshot.courseProgress);
same(homeProjection.progress,{'server-deck':{idx:3,time:20,sessionId:'session1',generation:2,practiceMode:'type'}});
assert.equal(homeProjection.learningGenerations['course:server-deck'],2);
homeProjection.mem.decks[0].name='local mutation';
assert.equal(homeCache.snapshot.mem.decks[0].name,'Server deck','home projection cannot mutate the confirmed cache');
const resumedHomeProjection=cache.projectMainMem(homeCache,[
  {owner:'owner-1',scope:'scope-1',ordinal:1,status:'pending',createdAt:30,
    operation:{type:'learning.resume',payload:{deckId:'server-deck',sessionId:'local_resume_0001',generation:2,idx:8,contentCursor:'page-3',practiceMode:'chunkSelection'}}},
  {owner:'owner-1',scope:'scope-1',ordinal:2,status:'pending',createdAt:31,
    operation:{type:'settings.patch',payload:{patch:{sound:false,darkMode:true}}}},
]);
assert.equal(resumedHomeProjection.ready,true,'resume and preference operations can be projected without waiting for network');
same(resumedHomeProjection.progress['server-deck'],{idx:8,time:30,sessionId:'local_resume_0001',generation:2,practiceMode:'chunkSelection',contentCursor:'page-3'});
same(resumedHomeProjection.mem.settings,{mode:'type',sound:false,darkMode:true});
assert.equal(homeCache.snapshot.mem.settings.sound,undefined,'pending projection cannot mutate confirmed settings');
const resetCache=JSON.parse(JSON.stringify(homeCache));
resetCache.snapshot.learningGenerations['course:reset-course']=2;
resetCache.snapshot.mem.stats.totalAnswered=12;
resetCache.snapshot.mem.stats.bySentence['reset-course#one']={deckId:'reset-course',times:4,okTimes:3,wrongTimes:1,
  streak:1,maxStreak:2,lastAt:200,interval:8,ease:2.4,dueAt:300,learningV1:{version:1,evidence:[{eventId:'old-answer'}],baselineAt:100,lastExposureAt:150,interval:8,ease:2.4,repetition:2}};
resetCache.snapshot.mem.mastered['reset-course#one']={deckId:'reset-course',sentence:'Keep familiarity'};
resetCache.snapshot.mem.reinforceBook.push({_key:'reset-course::old-mistake'});
const resetPayload={eventId:'learning_reset_pending_01',courseId:'reset-course',expectedGeneration:2};
const resetProjection=cache.projectMainMem(resetCache,[
  {owner:'owner-1',scope:'scope-1',ordinal:1,status:'pending',createdAt:400,operation:{type:'learning.reset',payload:resetPayload}},
  {owner:'owner-1',scope:'scope-1',ordinal:2,status:'pending',createdAt:401,operation:{type:'learning.reset',payload:resetPayload}},
]);
assert.equal(resetProjection.ready,true,'a durable reset with a confirmed generation can be projected after refresh');
assert.equal(resetProjection.mem.stats.bySentence['reset-course#one'].times,0);
same(resetProjection.mem.stats.bySentence['reset-course#one'].learningV1.evidence,[]);
assert.equal(resetProjection.mem.stats.totalAnswered,12,'reset preserves lifetime account answer totals, matching the server operation');
assert.equal(resetProjection.mem.mastered['reset-course#one'].sentence,'Keep familiarity','course reset preserves familiarity marks');
assert.equal(resetProjection.mem.reinforceBook.some(row=>row._key==='reset-course::old-mistake'),true,'course reset preserves mistake review rows');
assert.equal(resetProjection.mem.stats.events.filter(event=>event.id===resetPayload.eventId).length,1,'repeated reset event is projected once');
assert.equal(resetProjection.learningGenerations['course:reset-course'],3,'the projected generation advances once');
assert.equal(resetCache.snapshot.mem.stats.bySentence['reset-course#one'].times,4,'reset projection does not mutate confirmed cache');
const staleResetCache=JSON.parse(JSON.stringify(resetCache));
staleResetCache.snapshot.learningGenerations['course:reset-course']=3;
assert.equal(cache.projectMainMem(staleResetCache,[
  {owner:'owner-1',scope:'scope-1',ordinal:1,status:'pending',operation:{type:'learning.reset',payload:resetPayload}},
]).ready,false,'a reset from a stale generation fails closed');
assert.equal(cache.projectMainMem(resetCache,[
  {owner:'owner-1',scope:'scope-1',ordinal:1,status:'pending',operation:{type:'learning.reset',payload:resetPayload}},
  {owner:'owner-1',scope:'scope-1',ordinal:2,status:'pending',operation:{type:'learning.answer',payload:{courseId:'reset-course',deckId:'reset-course'}}},
]).ready,false,'reset and learning events for the same course are not reordered speculatively');
const pendingAssessmentProjection=cache.projectMainMem(homeCache,[
  {owner:'owner-1',scope:'scope-1',ordinal:1,status:'pending',createdAt:50,
    operation:{type:'assessment.start',payload:{sessionId:'assessment-session-1',eventId:'assessment_start_0001'}}},
  {owner:'owner-1',scope:'scope-1',ordinal:2,status:'pending',createdAt:51,
    operation:{type:'assessment.answer',payload:{sessionId:'assessment-session-1',eventId:'assessment_answer_0001',itemIndex:0,answers:['correct']}}},
  {owner:'owner-1',scope:'scope-1',ordinal:3,status:'pending',createdAt:52,
    operation:{type:'assessment.finalize',payload:{sessionId:'assessment-session-1',eventId:'assessment_final_0001',score:100}}},
]);
assert.equal(pendingAssessmentProjection.ready,true,'assessment queue entries do not prevent rebuilding the independent home learning projection');
same(pendingAssessmentProjection.mem,homeCache.snapshot.mem,'unconfirmed assessment answers and scores never enter the home learning projection');
assert.equal(Object.hasOwn(pendingAssessmentProjection.mem,'assessmentResults'),false);
assert.equal(cache.projectMainMem(homeCache,[
  {owner:'owner-1',scope:'scope-1',ordinal:1,status:'blocked',
    operation:{type:'assessment.finalize',payload:{sessionId:'assessment-session-1',score:100}}},
]).ready,false,'a blocked assessment operation still fails closed instead of being silently ignored');
const pendingAnswerAt=Date.now()-1000;
const answeredHomeProjection=cache.projectMainMem(homeCache,[
  {owner:'owner-1',scope:'scope-1',ordinal:1,status:'pending',createdAt:pendingAnswerAt,
    operation:{type:'learning.answer',payload:{eventId:'pending_answer_0001',key:'server-deck#two',deckId:'server-deck',
      generation:2,sessionId:'resume-session-0001',occurredAt:pendingAnswerAt,timeZone:'UTC',mode:'typing',
      contentFingerprint:'fingerprint',policyVersion:1,ok:true,assisted:false,firstAttempt:true,earlyPractice:false}}},
]);
assert.equal(answeredHomeProjection.ready,true,'a monotonic unconfirmed answer can be rebuilt from the confirmed sentence baseline');
assert.equal(answeredHomeProjection.mem.stats.totalAnswered,5);
assert.equal(answeredHomeProjection.mem.stats.bySentence['server-deck#two'].times,1);
assert.equal(answeredHomeProjection.mem.stats.events.filter(event=>event.id==='pending_answer_0001').length,1);
assert.equal(homeCache.snapshot.mem.stats.bySentence['server-deck#two'],undefined,'pending answer projection leaves the confirmed baseline immutable');
const pendingStateProjection=cache.projectMainMem(homeCache,[
  {owner:'owner-1',scope:'scope-1',ordinal:1,status:'pending',createdAt:40,
    operation:{type:'course.progress',payload:{courseId:'story-course',nodeId:'lesson-1',passed:true,completed:false,currentNodeId:'lesson-2',generation:0}}},
  {owner:'owner-1',scope:'scope-1',ordinal:2,status:'pending',createdAt:41,
    operation:{type:'course.enrollment',payload:{courseId:'another-course',joined:true}}},
  {owner:'owner-1',scope:'scope-1',ordinal:3,status:'pending',createdAt:42,
    operation:{type:'deck.itemsVisibility',payload:{eventId:'visibility_hide_01',deckId:'server-deck',keys:['server-deck#two'],hidden:true,expectedHidden:false}}},
  {owner:'owner-1',scope:'scope-1',ordinal:4,status:'pending',createdAt:43,
    operation:{type:'deck.itemsVisibility',payload:{eventId:'visibility_show_01',deckId:'server-deck',keys:['server-deck#two'],hidden:false,expectedHidden:true}}},
]);
assert.equal(pendingStateProjection.ready,true,'course progress, enrollment and visibility changes can be projected together');
same(pendingStateProjection.courseProgress['story-course'],{seen:['lesson-1'],passed:['lesson-1'],completed:false,currentNodeId:'lesson-2'});
same(pendingStateProjection.courseProgress['enrollment:v1:another-course'],{kind:'course-enrollment',schemaVersion:1,courseId:'another-course',joined:true,joinedAt:41,changedAt:41});
assert.equal(Object.hasOwn(pendingStateProjection.mem.deletedItems,'server-deck#two'),false,'visibility operations project in order');
same(pendingStateProjection.mem.stats.events.filter(event=>event.kind==='deckItemsVisibility').map(event=>event.id),['visibility_hide_01','visibility_show_01']);
assert.equal(Object.hasOwn(homeCache.snapshot.courseProgress,'story-course'),false,'pending progress does not mutate the confirmed cache');
const restartCache=Object.assign({},homeCache,{snapshot:Object.assign({},homeCache.snapshot,{
  courseProgress:{'story-course':{generation:4,seen:['lesson-1'],passed:['lesson-1'],completed:true,completedAt:100}},
  learningGenerations:{'course:story-course':4},
})});
const restartEventId='restart_story_course_0001';
const restartedHomeProjection=cache.projectMainMem(restartCache,[
  {owner:'owner-1',scope:'scope-1',ordinal:1,status:'pending',createdAt:200,
    operation:{type:'course.restart',payload:{eventId:restartEventId,courseId:'story-course',currentNodeId:'lesson-1'}}},
]);
assert.equal(restartedHomeProjection.ready,true,'an isolated durable course restart can be projected without a server round trip');
same(restartedHomeProjection.courseProgress['story-course'],{
  generation:5,seen:[],passed:[],completed:false,history:[{generation:4,seen:['lesson-1'],passed:['lesson-1'],
    completed:true,completedAt:100,restartedAt:200}],currentNodeId:'lesson-1'});
assert.equal(restartedHomeProjection.learningGenerations['course:story-course'],5,'restart projection advances only the local generation view');
same(restartedHomeProjection.mem.stats.events.filter(event=>event.id===restartEventId),[
  {id:restartEventId,kind:'courseRestart',courseId:'story-course',generation:5,at:200},
]);
assert.equal(restartCache.snapshot.learningGenerations['course:story-course'],4,'restart projection cannot mutate the confirmed generation');
const duplicateRestartProjection=cache.projectMainMem(restartCache,[
  {owner:'owner-1',scope:'scope-1',ordinal:1,status:'pending',createdAt:200,
    operation:{type:'course.restart',payload:{eventId:restartEventId,courseId:'story-course',currentNodeId:'lesson-1'}}},
  {owner:'owner-1',scope:'scope-1',ordinal:2,status:'pending',createdAt:201,
    operation:{type:'course.restart',payload:{eventId:restartEventId,courseId:'story-course',currentNodeId:'lesson-1'}}},
]);
assert.equal(duplicateRestartProjection.courseProgress['story-course'].generation,5,'duplicate restart event IDs advance the projected generation once');
const interleavedRestartProjection=cache.projectMainMem(restartCache,[
  {owner:'owner-1',scope:'scope-1',ordinal:1,status:'pending',createdAt:190,
    operation:{type:'learning.resume',payload:{courseId:'story-course',deckId:'server-deck',sessionId:'resume_before_restart',generation:4,idx:2}}},
  {owner:'owner-1',scope:'scope-1',ordinal:2,status:'pending',createdAt:200,
    operation:{type:'course.restart',payload:{eventId:restartEventId,courseId:'story-course'}}},
]);
assert.equal(interleavedRestartProjection.ready,false,'restart interleaved with same-course pending work is refused rather than guessed');
const logicalCourseCache=Object.assign({},homeCache,{snapshot:Object.assign({},homeCache.snapshot,{
  mem:Object.assign({},homeCache.snapshot.mem,{logicalCourses:{'logical-course:old':{id:'logical-course:old',title:'Old'}}}),
  revs:{logicalCourses:{'logical-course:old':11},decks:{'server-deck':5}},
})});
const logicalCourseProjection=cache.projectMainMem(logicalCourseCache,[
  {owner:'owner-1',scope:'scope-1',ordinal:1,status:'pending',operation:{type:'logicalCourse.put',payload:{expectedSeq:null,
    course:{id:'logical-course:new',title:'New',coverImage:'',catalogKey:'logical:logical-course:new',origin:'user',
      contentType:'story',createdAt:'2026-10-05T00:00:00.000Z',updatedAt:'2026-10-05T00:00:00.000Z'}}}},
  {owner:'owner-1',scope:'scope-1',ordinal:2,status:'pending',operation:{type:'logicalCourse.delete',payload:{courseId:'logical-course:old',expectedSeq:11}}},
]);
assert.equal(logicalCourseProjection.ready,true,'independent revision-checked logical course directory changes can be projected');
same(logicalCourseProjection.mem.logicalCourses,{'logical-course:new':{id:'logical-course:new',title:'New',coverImage:'',
  catalogKey:'logical:logical-course:new',origin:'user',contentType:'story',createdAt:'2026-10-05T00:00:00.000Z',updatedAt:'2026-10-05T00:00:00.000Z'}});
assert.equal(Object.hasOwn(logicalCourseCache.snapshot.mem.logicalCourses,'logical-course:new'),false,'directory projection leaves confirmed cache unchanged');
const staleLogicalCourseProjection=cache.projectMainMem(logicalCourseCache,[
  {owner:'owner-1',scope:'scope-1',ordinal:1,status:'pending',operation:{type:'logicalCourse.delete',payload:{courseId:'logical-course:old',expectedSeq:10}}},
]);
assert.equal(staleLogicalCourseProjection.ready,false,'a stale directory revision is never presented as an applied local projection');
const deckWriteProjection=cache.projectMainMem(logicalCourseCache,[
  {owner:'owner-1',scope:'scope-1',ordinal:1,status:'pending',operation:{type:'deck.put',expectedRev:null,
    payload:{deck:{id:'new-user-deck',name:'New deck',items:[]}}}},
  {owner:'owner-1',scope:'scope-1',ordinal:2,status:'pending',operation:{type:'deck.publish',expectedRev:5,
    payload:{deckId:'server-deck',publish:true}}},
]);
assert.equal(deckWriteProjection.ready,true,'an independent revision-checked deck create and publish can be projected locally');
assert.deepEqual(deckWriteProjection.mem.decks.find(deck=>deck.id==='new-user-deck'),{id:'new-user-deck',name:'New deck',items:[]});
assert.equal(deckWriteProjection.mem.decks.find(deck=>deck.id==='server-deck').isPublic,true);
assert.equal(logicalCourseCache.snapshot.mem.decks[0].isPublic,undefined,'pending deck writes do not mutate confirmed entities');
const staleDeckWriteProjection=cache.projectMainMem(logicalCourseCache,[
  {owner:'owner-1',scope:'scope-1',ordinal:1,status:'pending',operation:{type:'deck.publish',expectedRev:4,
    payload:{deckId:'server-deck',publish:true}}},
]);
assert.equal(staleDeckWriteProjection.ready,false,'a stale deck revision is never shown as an applied page projection');
const overEnrolledProjection=cache.projectMainMem(homeCache,[
  {owner:'owner-1',scope:'scope-1',ordinal:1,status:'pending',createdAt:50,operation:{type:'course.enrollment',payload:{courseId:'second-course',joined:true}}},
  {owner:'owner-1',scope:'scope-1',ordinal:2,status:'pending',createdAt:51,operation:{type:'course.enrollment',payload:{courseId:'third-course',joined:true}}},
  {owner:'owner-1',scope:'scope-1',ordinal:3,status:'pending',createdAt:52,operation:{type:'course.enrollment',payload:{courseId:'fourth-course',joined:true}}},
]);
assert.equal(overEnrolledProjection.ready,false,'unsafe enrollment over the three-course limit must not be projected');
const staleVisibilityProjection=cache.projectMainMem(homeCache,[
  {owner:'owner-1',scope:'scope-1',ordinal:1,status:'pending',createdAt:60,
    operation:{type:'deck.itemsVisibility',payload:{eventId:'visibility_conflict_01',deckId:'server-deck',keys:['server-deck#one'],hidden:true,expectedHidden:true}}},
]);
assert.equal(staleVisibilityProjection.ready,false,'visibility changes must respect their expected baseline');
const reusedVisibilityEvent=cache.projectMainMem(Object.assign({},homeCache,{snapshot:Object.assign({},homeCache.snapshot,{mem:Object.assign({},homeCache.snapshot.mem,{stats:{
  totalAnswered:4,totalRounds:2,bySentence:{'server-deck#one':{times:4}},events:[{id:'visibility_reused_event_01',kind:'deckItemsVisibility',
    deckId:'server-deck',keys:['server-deck#one'],hidden:false}],
}})})}),[
  {owner:'owner-1',scope:'scope-1',ordinal:1,status:'acked-awaiting-apply',createdAt:61,
    operation:{type:'deck.itemsVisibility',payload:{eventId:'visibility_reused_event_01',deckId:'server-deck',keys:['server-deck#one'],hidden:true,expectedHidden:false}}},
]);
assert.equal(reusedVisibilityEvent.ready,false,'a repeated visibility event id cannot project a different operation body');
const exposureAt=Date.now()-500;
const exposedHomeProjection=cache.projectMainMem(homeCache,[
  {owner:'owner-1',scope:'scope-1',ordinal:1,status:'pending',createdAt:exposureAt,
    operation:{type:'learning.exposure',payload:{eventId:'pending_exposure_0001',key:'server-deck#exposed',deckId:'server-deck',
      generation:2,sessionId:'exposure-session-0001',occurredAt:exposureAt,mode:'typing',contentFingerprint:'fingerprint',policyVersion:1}}},
]);
assert.equal(exposedHomeProjection.ready,true,'a pending hint exposure uses the shared learning evidence reducer');
assert.equal(exposedHomeProjection.mem.stats.totalAnswered,4,'an exposure is evidence, not an answer');
assert.equal(exposedHomeProjection.mem.stats.bySentence['server-deck#exposed'].times,0);
assert.equal(exposedHomeProjection.mem.stats.bySentence['server-deck#exposed'].learningV1.lastExposureAt,exposureAt);
assert.equal(exposedHomeProjection.mem.stats.events.find(event=>event.id==='pending_exposure_0001').type,'exposure');
const markAt=Date.now()-400;
const markedHomeProjection=cache.projectMainMem(homeCache,[
  {owner:'owner-1',scope:'scope-1',ordinal:1,status:'pending',createdAt:markAt,
    operation:{type:'learning.mark',payload:{eventId:'pending_mark_event_001',key:'server-deck#marked',deckId:'server-deck',
      courseId:'server-deck',generation:2,active:true,markedAt:markAt,sentence:'A marked sentence.'}}},
]);
assert.equal(markedHomeProjection.ready,true,'a pending familiarity mark is projected using the shared learning schedule');
same(markedHomeProjection.mem.mastered['server-deck#marked'],{deckId:'server-deck',sentence:'A marked sentence.',markedAt:markAt});
assert.equal(markedHomeProjection.mem.stats.bySentence['server-deck#marked'].learningV1.dueAt,markAt+window.LearningEngine.FAMILIAR_DELAY_MS);
assert.equal(markedHomeProjection.mem.stats.events.find(event=>event.id==='pending_mark_event_001').type,'familiaritySchedule');
const legacyMarkAt=Date.now()-1000;
const legacyMarkedProjection=cache.projectMainMem(homeCache,[
  {owner:'owner-1',scope:'scope-1',ordinal:1,status:'pending',createdAt:legacyMarkAt,
    operation:{type:'learning.mark',payload:{eventId:'pending_legacy_mark_event_01',key:'server-deck#legacy-marked',deckId:'server-deck',
      courseId:'server-deck',generation:2,active:true,sentence:'Legacy mark without timestamp',legacyMigration:true}}},
]);
assert.equal(legacyMarkedProjection.ready,true,'a legacy familiarity operation without a source timestamp uses its durable enqueue time');
assert.equal(legacyMarkedProjection.mem.mastered['server-deck#legacy-marked'].markedAt,legacyMarkAt);
const unmarkedHomeProjection=cache.projectMainMem(homeCache,[
  {owner:'owner-1',scope:'scope-1',ordinal:1,status:'pending',createdAt:markAt,
    operation:{type:'learning.mark',payload:{eventId:'pending_unmark_event_01',key:'server-deck#one',deckId:'server-deck',
      generation:2,active:false,markedAt:markAt}}},
]);
assert.equal(unmarkedHomeProjection.ready,true,'a pending removal of a familiarity mark is projected');
assert.equal(unmarkedHomeProjection.mem.mastered['server-deck#one'],undefined);
const removedMistakeProjection=cache.projectMainMem(homeCache,[
  {owner:'owner-1',scope:'scope-1',ordinal:1,status:'pending',createdAt:markAt,
    operation:{type:'mistake.remove',payload:{eventId:'pending_mistake_remove_01',key:'server-deck::wrong'}}},
]);
assert.equal(removedMistakeProjection.ready,true,'a pending mistake removal can be rebuilt without altering other learning evidence');
assert.deepEqual(removedMistakeProjection.mem.reinforceBook,[]);
assert.equal(removedMistakeProjection.mem.stats.events.find(event=>event.id==='pending_mistake_remove_01').kind,'mistakeRemoved');
const overlappingMarkProjection=cache.projectMainMem(homeCache,[
  {owner:'owner-1',scope:'scope-1',ordinal:1,status:'pending',createdAt:pendingAnswerAt,
    operation:{type:'learning.answer',payload:{eventId:'pending_answer_mark_01',key:'server-deck#marked-together',deckId:'server-deck',
      generation:2,sessionId:'mark-overlap-session',occurredAt:pendingAnswerAt,timeZone:'UTC',mode:'typing',ok:true}}},
  {owner:'owner-1',scope:'scope-1',ordinal:2,status:'pending',createdAt:markAt,
    operation:{type:'learning.mark',payload:{eventId:'pending_mark_overlap_01',key:'server-deck#marked-together',deckId:'server-deck',
      generation:2,active:true,markedAt:markAt}}},
]);
assert.equal(overlappingMarkProjection.ready,false,'mark and answer on one sentence are not reordered across the server baseline');
const completedHomeProjection=cache.projectMainMem(homeCache,[
  {owner:'owner-1',scope:'scope-1',ordinal:0,status:'pending',createdAt:pendingAnswerAt-1,
    operation:{type:'learning.exposure',payload:{eventId:'pending_exposure_round_01',key:'server-deck#two',deckId:'server-deck',
      generation:2,sessionId:'pending-round-session-1',occurredAt:pendingAnswerAt-1,mode:'typing'}}},
  {owner:'owner-1',scope:'scope-1',ordinal:1,status:'pending',createdAt:pendingAnswerAt,
    operation:{type:'learning.answer',payload:{eventId:'pending_answer_round_01',key:'server-deck#two',deckId:'server-deck',
      generation:2,sessionId:'pending-round-session-1',occurredAt:pendingAnswerAt,timeZone:'UTC',mode:'typing',
      contentFingerprint:'fingerprint',policyVersion:1,ok:true,assisted:false,firstAttempt:true,earlyPractice:false,
      chunkRight:1,chunkTotal:1,answerOrder:0}}},
  {owner:'owner-1',scope:'scope-1',ordinal:2,status:'pending',createdAt:pendingAnswerAt+1,
    operation:{type:'learning.roundComplete',payload:{eventId:'pending_round_complete_01',sessionId:'pending-round-session-1',
      answerCount:1,deckId:'server-deck',recordBest:true,timeZone:'UTC',occurredAt:pendingAnswerAt+1}}},
]);
assert.equal(completedHomeProjection.ready,true,'a complete answer+round chain can be reconstructed as one session projection');
assert.equal(completedHomeProjection.mem.stats.totalAnswered,5);
assert.equal(completedHomeProjection.mem.stats.totalRounds,3);
assert.equal(completedHomeProjection.mem.stats.events.filter(event=>event.id==='pending_round_complete_01').length,1);
assert.equal(completedHomeProjection.mem.stats.events.filter(event=>event.id==='pending_exposure_round_01').length,1);
assert.equal(completedHomeProjection.mem.stats.bySentence['server-deck#two'].learningV1.lastExposureAt,pendingAnswerAt,
  'an exposure and answer are ordered by their event times through the shared reducer');
assert.equal(completedHomeProjection.mem.best['server-deck'].acc,100);
const completedHomeProjectionRetry=cache.projectMainMem(homeCache,[
  {owner:'owner-1',scope:'scope-1',ordinal:1,status:'pending',createdAt:pendingAnswerAt,
    operation:{type:'learning.answer',payload:{eventId:'pending_answer_round_01',key:'server-deck#two',deckId:'server-deck',
      generation:2,sessionId:'pending-round-session-1',occurredAt:pendingAnswerAt,timeZone:'UTC',mode:'typing',
      contentFingerprint:'fingerprint',policyVersion:1,ok:true,assisted:false,firstAttempt:true,earlyPractice:false,
      chunkRight:1,chunkTotal:1,answerOrder:0}}},
  {owner:'owner-1',scope:'scope-1',ordinal:2,status:'pending',createdAt:pendingAnswerAt+1,
    operation:{type:'learning.roundComplete',payload:{eventId:'pending_round_complete_01',sessionId:'pending-round-session-1',
      answerCount:1,deckId:'server-deck',recordBest:true,timeZone:'UTC',occurredAt:pendingAnswerAt+1}}},
]);
assert.equal(completedHomeProjectionRetry.mem.stats.totalAnswered,completedHomeProjection.mem.stats.totalAnswered,
  'rebuilding a projection from the same durable queue does not double-count answers');
assert.equal(completedHomeProjectionRetry.mem.stats.totalRounds,completedHomeProjection.mem.stats.totalRounds,
  'rebuilding a projection from the same durable queue does not double-count rounds');
const incompleteRoundProjection=cache.projectMainMem(homeCache,[
  {owner:'owner-1',scope:'scope-1',ordinal:1,status:'pending',createdAt:pendingAnswerAt,
    operation:{type:'learning.roundComplete',payload:{eventId:'pending_round_incomplete',sessionId:'missing-answer-session',
      answerCount:1,deckId:'server-deck',recordBest:true,timeZone:'UTC',occurredAt:pendingAnswerAt}}},
]);
assert.equal(incompleteRoundProjection.ready,false,'a round is not projected until all of its answer evidence is available');
const staleAnswerProjection=cache.projectMainMem({...homeCache,snapshot:{...homeCache.snapshot,mem:{...homeCache.snapshot.mem,
  stats:{...homeCache.snapshot.mem.stats,bySentence:{'server-deck#two':{lastAt:pendingAnswerAt+1,times:2}}}}}},[
  {owner:'owner-1',scope:'scope-1',ordinal:1,status:'pending',createdAt:pendingAnswerAt,
    operation:{type:'learning.answer',payload:{eventId:'pending_answer_0002',key:'server-deck#two',deckId:'server-deck',
      generation:2,sessionId:'resume-session-0001',occurredAt:pendingAnswerAt,timeZone:'UTC',mode:'typing',
      contentFingerprint:'fingerprint',policyVersion:1,ok:true}}},
]);
assert.equal(staleAnswerProjection.ready,false,'an older offline answer is not replayed onto a newer confirmed SRS baseline');
const blockedHomeProjection=cache.projectMainMem(homeCache,[
  {owner:'owner-1',scope:'scope-1',ordinal:1,status:'pending',operation:{type:'learning.answer',payload:{deckId:'server-deck'}}},
  {owner:'other-owner',scope:'scope-1',ordinal:2,status:'pending',operation:{type:'deck.delete',payload:{deckId:'server-deck'}}},
  {owner:'owner-1',scope:'scope-1',ordinal:3,status:'blocked',operation:{type:'deck.delete',payload:{deckId:'server-deck'}}},
]);
assert.equal(blockedHomeProjection.ready,false,'an unconfirmed in-scope operation must prevent replacing the local prediction');
const blockedOnlyHomeProjection=cache.projectMainMem(homeCache,[
  {owner:'owner-1',scope:'scope-1',ordinal:1,status:'blocked',operation:{type:'learning.answer',payload:{deckId:'server-deck'}}},
]);
assert.equal(blockedOnlyHomeProjection.ready,false,'a durably retained blocked operation still protects the local prediction from a stale confirmed snapshot');
const unsupportedPendingProjection=cache.projectMainMem(homeCache,[
  {owner:'owner-1',scope:'scope-1',ordinal:1,status:'pending',operation:{type:'learning.answer',payload:{deckId:'server-deck'}}},
]);
assert.equal(unsupportedPendingProjection.ready,false,'learning totals are not projected until their reducer can safely reconcile the confirmed baseline');
const appliedHomeProjection=cache.projectMainMem(homeCache,[
  {owner:'owner-1',scope:'scope-1',ordinal:4,status:'acked-awaiting-apply',receipt:{seq:9},operation:{type:'learning.answer',payload:{deckId:'server-deck'}}},
]);
assert.equal(appliedHomeProjection.ready,true,'an ACK already represented by the confirmed watermark is not pending');

const delta = {
  seq: 7, delta: true,
  mem: {
    decks: [{ id: 'd1', name: 'One revised' }], best: { d1: { perfect: 2 } }, settings: { sound: false },
    stats: { totalRounds: 3, totalAnswered: 9, daysLog: { '2026-10-02': 1 }, bySentence: { 'd1#a': { times: 4 } }, events: [{ id: 'e3' }] },
    mastered: {}, deletedItems: {}, reinforceBook: [{ _key: 'wrong-2' }], logicalCourses: { 'logical-course:new': { id: 'logical-course:new', title: 'New directory' } },
  },
  courses: [], courseProgress: { c1: { idx: 3 } }, learningResumes: { s1: { sessionId: 's1', idx: 3 } },
  learningGenerations: { 'course:c1': 2, 'course:c2': 1 },
  revs: { decks: { d1: 2 }, kv: { stats: 3 }, courses: {}, courseProgress: { c1: 2 }, logicalCourses: { 'logical-course:new': 7, 'logical-course:old': 8 } },
  entityGone: { mastered: [], reinforce: ['wrong-1'], deletedItem: [], logicalCourse: ['logical-course:old'] },
  deleted: { decks: ['d2'], sentences: ['d2#b'], events: ['e1'], courses: [], courseProgress: [], learningResumes: [] },
};
const merged = cache.mergeSnapshot(base, delta);
assert.deepEqual(merged.snapshot.mem.decks.map(row => row.id), ['d1'], 'explicit deck tombstones delete; missing delta keys do not');
assert.equal(merged.snapshot.mem.decks[0].name, 'One revised');
same(merged.snapshot.mem.stats.bySentence, { 'd1#a': { times: 4 } });
same(merged.snapshot.mem.stats.events.map(row => row.id), ['e2', 'e3']);
assert.equal(merged.snapshot.mem.stats.totalAnswered, 9, 'small stats base is refreshed by a delta');
same(merged.snapshot.mem.stats.daysLog, { '2026-10-02': 1 });
same(merged.snapshot.mem.reinforceBook.map(row => row._key), ['wrong-2']);
same(merged.snapshot.courses.map(row => row.courseId), ['c1']);
assert.equal(merged.snapshot.courseProgress.c1.idx, 3);
assert.equal(merged.snapshot.learningResumes.s1.idx, 3);
assert.deepEqual(merged.snapshot.learningGenerations, { 'course:c1': 2, 'course:c2': 1 },
  'a delta carries the complete current generation map so remote resets are adopted');
same(merged.snapshot.mem.logicalCourses, { 'logical-course:new': { id: 'logical-course:new', title: 'New directory' } });
assert.equal(merged.appliedSeq, 7);
assert.equal(merged.snapshot.delta, false);
same(merged.snapshot.deleted, {});

assert.equal(base.snapshot.mem.decks.length, 2, 'merging a delta does not mutate the existing confirmed cache');
assert.throws(() => cache.mergeSnapshot(null, delta), error => error.code === 'CACHE_BASE_REQUIRED');
assert.throws(() => cache.mergeSnapshot(merged, Object.assign({}, full, { seq: 6 })), error => error.code === 'SERVER_SEQ_ROLLBACK');
const removedMark = cache.mergeSnapshot(base, {
  seq: 5, delta: true, mem: { stats: {}, mastered: {}, deletedItems: {}, reinforceBook: [] },
  courses: [], courseProgress: {}, learningResumes: {}, revs: {},
  entityGone: { mastered: ['d1#a'], reinforce: [], deletedItem: [] }, deleted: {},
});
const restoredMark = cache.mergeSnapshot(removedMark, {
  seq: 6, delta: true, mem: { mastered: { 'd1#a': { value: true } }, deletedItems: {}, reinforceBook: [] },
  courses: [], courseProgress: {}, learningResumes: {}, revs: {},
  entityGone: { mastered: [], reinforce: [], deletedItem: [] }, deleted: {},
});
assert.equal(restoredMark.snapshot.mem.mastered['d1#a'].value, true, 'a live rematerialized mark is not hidden by its old tombstone');
same(restoredMark.snapshot.entityGone.mastered, []);
const roundResumeCache = cache.mergeSnapshot(null, {seq:1,mem:{decks:[{id:'resume-deck'}],settings:{},
  stats:{bySentence:{},events:[
    {id:'resume-answer-1',type:'practice',key:'resume-deck#one',sessionId:'round-1',generation:2,answerOrder:0,ok:true,chunkRight:2,chunkTotal:2},
    {id:'resume-answer-2',type:'practice',deckId:'resume-deck',sessionId:'round-1',generation:2,answerOrder:1,ok:false,chunkRight:1,chunkTotal:2},
    {id:'other-round',type:'practice',deckId:'resume-deck',sessionId:'round-2',generation:2,answerOrder:0,ok:true,chunkRight:9,chunkTotal:9},
    {id:'old-generation',type:'practice',deckId:'resume-deck',sessionId:'round-1',generation:1,answerOrder:0,ok:true,chunkRight:9,chunkTotal:9}
  ]}},courses:[],courseProgress:{},learningGenerations:{'course:resume-deck':2},
  learningResumes:{'round-1':{deckId:'resume-deck',sessionId:'round-1',generation:2,idx:3,updatedAt:10}},revs:{}});
const roundResume = cache.projectMainMem(roundResumeCache,[]).progress['resume-deck'];
assert.equal(roundResume.answerOrder,2,'confirmed answer events restore the current round count after reload');
assert.equal(roundResume.chunkRight,3);
assert.equal(roundResume.chunkTotal,4);
assert.equal(roundResume.combo,0);
assert.equal(roundResume.maxCombo,1);
assert.equal(roundResume.perfectCount,1);
assert.equal(roundResumeCache.snapshot.learningResumes['round-1'].answerOrder,undefined,'projection does not modify the server cache');
roundResumeCache.owner='owner-1'; roundResumeCache.scope='scope-1';
const pendingRoundAnswer={owner:'owner-1',scope:'scope-1',status:'pending',ordinal:1,
  operation:{type:'learning.answer',payload:{eventId:'pending_round_answer_03',key:'resume-deck#three',
    deckId:'resume-deck',sessionId:'round-1',generation:2,answerOrder:2,ok:true,
    occurredAt:Date.now()-1000,timeZone:'UTC',chunkRight:2,chunkTotal:2}}};
const pendingRoundResume=cache.projectMainMem(roundResumeCache,[pendingRoundAnswer]).progress['resume-deck'];
assert.equal(pendingRoundResume.answerOrder,3,'durable offline answers contribute to resumed round metrics');
assert.equal(pendingRoundResume.chunkRight,5);
assert.equal(pendingRoundResume.chunkTotal,6);
assert.equal(pendingRoundResume.perfectCount,2);
const incompleteRoundCache=JSON.parse(JSON.stringify(roundResumeCache));
incompleteRoundCache.snapshot.mem.stats.events=incompleteRoundCache.snapshot.mem.stats.events.filter(event=>event.answerOrder!==0);
assert.equal(cache.projectMainMem(incompleteRoundCache,[]).progress['resume-deck'].answerOrder,undefined,
  'an incomplete historical round does not manufacture a confirmed score');
console.log('server cache snapshot merge tests passed');
