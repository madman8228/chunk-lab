'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
// Allocate before loading db/auth; never use the application's data directory.
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jqka-archive-test-'));
process.env.CHUNKLAB_DATA_DIR = dataDir;
process.env.REQUIRE_AUTH = 'true';
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
const db = require('./db');
const auth = require('./auth');
const express = require('express');
const { registerVocabularyPracticeRoutes } = require('./routes/vocabulary-practice');
const { registerLearningArchiveRoutes } = require('./routes/learning-archive');
const app = express();
app.use(express.json());
registerVocabularyPracticeRoutes({ app, auth, db });
(async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const base = 'http://127.0.0.1:' + server.address().port;
    const one = auth.register('archive-one', 'isolated-pass');
    const two = auth.register('archive-two', 'isolated-pass');
    const courseContent={book:(bookId,userId)=>{if(bookId==='http-course'&&userId===one.id)return {bookId,revision:'v1',structureRevision:null,title:'隔离验收课程',items:[],units:[]};throw Object.assign(Error('not found'),{status:404});}};
    registerLearningArchiveRoutes({ app, auth, db, content:courseContent });
    const token = user => auth.signToken(user.id, user.username);
    const request = (url, user, options = {}) => fetch(base + url, { ...options,
      headers: { ...(user ? { Authorization: 'Bearer ' + token(user) } : {}), 'Content-Type': 'application/json' } });
    for (const route of ['/summary', '/events', '/courses']) {
      assert.equal((await request('/api/learning-archive/vocabulary' + route)).status, 401);
    }
    assert.equal((await request('/api/vocabulary-practice', one, { method: 'POST',
      body: JSON.stringify({ eventId: 'archive-event-001', word: 'borrow', independent: true }) })).status, 200);
    for(const user of [one,two])db.prepare(`INSERT INTO vocabulary_study_events(user_id,event_id,item_id,resource_id,content_revision,data_json,occurred_at,seq)
      VALUES(?,?,?,?,?,?,?,?)`).run(user.id,'archive-course-event','borrow-sense-1','wordbook:http-course','v1','{}',Date.now(),1);
    const before = db.prepare('SELECT total_changes() AS count').get().count;
    const summary = await (await request('/api/learning-archive/vocabulary/summary', one)).json();
    assert.equal(summary.domains[1].learnedItems, 1);
    const own = await (await request('/api/learning-archive/vocabulary/events', one)).json();
    assert.equal(own.items.find(row=>row.source==='vocabulary-pilot').outcome, 'independent-recall');
    assert.deepEqual(own.items.find(row=>row.resourceId==='wordbook:http-course').course,{bookId:'http-course',title:'隔离验收课程',available:true});
    const privateCourse=await(await request('/api/learning-archive/vocabulary/events',two)).json();
    assert.deepEqual(privateCourse.items[0].course,{bookId:'http-course',title:null,available:false},'course metadata never crosses account ownership');
    const courseResponse=await request('/api/learning-archive/vocabulary/courses',one),courses=await courseResponse.json();
    assert.equal(courseResponse.status,200,JSON.stringify(courses));assert.equal(courses.confirmed,true);assert.equal(courses.items.length,1);assert.equal(courses.items[0].bookId,'http-course');
    assert.equal((await request('/api/learning-archive/vocabulary/courses?limit=101',one)).status,400);
    assert.equal((await request('/api/learning-archive/vocabulary/courses?unexpected=1',one)).status,400);
    const otherEvents=(await (await request('/api/learning-archive/vocabulary/events', two)).json()).items;
    assert.equal(otherEvents.length,1);assert.equal(otherEvents[0].course.available,false);
    assert.equal((await request('/api/learning-archive/vocabulary/events?limit=101', one)).status, 400);
    assert.equal((await request('/api/learning-archive/vocabulary/events?offset=-1', one)).status, 400);
    assert.equal(db.prepare('SELECT total_changes() AS count').get().count, before);
    console.log('archive HTTP: real authentication, isolated database, bounded paging and owner isolation passed');
  } finally {
    await new Promise(resolve => server.close(resolve));
    db.close();
    // Leave isolated test artifacts recoverable; no real data is cleaned up.
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
