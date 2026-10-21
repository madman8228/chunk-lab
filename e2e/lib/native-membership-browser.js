'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs');
const { deckIdentity } = require('../../server/services/membership/assessment-content');
module.exports = async function verifyNativeMembership({ browser, base, api, admin, db, user, root }) {
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 900 } });
  await context.addInitScript(token => localStorage.setItem('chunklab_token', token), user.token);
  const errors = [];
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.stack || error.message));
  const answerTraffic=[],receiptReads=[];
  page.on('response',response=>{
    const request=response.request();
    if(!request.url().endsWith('/api/operations') || request.method()!=='POST' || response.status()!==200)return;
    const body=request.postDataJSON(),accept=request.headers().accept||'';
    if(body.type!=='learning.answer' || !accept.includes('application/vnd.chunklab.'))return;
    receiptReads.push((async()=>{
      const bytes=await response.body(),receipt=JSON.parse(bytes.toString());
      assert.ok(!Object.hasOwn(receipt.operation||{},'stat'),'current browser does not receive a duplicate stat copy');
      for(const field of ['mem','decks','courses','items'])assert.equal(Object.hasOwn(body.payload,field),false,'answer never uploads a whole course/archive');
      answerTraffic.push({uploadBytes:Buffer.byteLength(request.postData()),decodedReceiptBytes:bytes.length,
        contentEncoding:response.headers()['content-encoding']||'identity',accept:accept.split(';')[0]});
    })());
  });
  page.setDefaultTimeout(15000);
  page.on('console', message => { if(message.text().includes('round completion was not durably queued'))errors.push(message.text()); });
  const panel = page.locator('.course-access-panel');
  const open = async (course, extra = '') => {
    await page.goto(base + '/main.html?protectedCourse=' + course + '&unit=unit' + extra);
    await panel.getByRole('button', { name: /^(开始学习|继续学习)$/ }).waitFor({ timeout: 30000 });
  };
  const begin = async () => {
    await panel.getByRole('button', { name: /^(开始学习|继续学习)$/ }).click();
    await page.locator('#stage:not(.hidden) .chunk-input').first().waitFor({ timeout: 15000 }).catch(async error => { throw new Error(error.message + '\n' + await panel.innerText() + '\n' + await page.evaluate(()=>window.__nativeCourseSession?.lastError?.stack)+'\n'+ errors.join('\n')); });
    assert.equal(await page.evaluate(() => !!window.__protectedCourseView), false);
    assert.equal(await page.evaluate(() => !!S.deck._platformSession), true);
  };
  const answer = async () => {
    const chunks = await page.evaluate(() => cur().chunks.slice());
    for (let index = 0; index < chunks.length; index++) {
      const input = page.locator('#track .chunk-input').nth(index); await input.fill(chunks[index]); await input.press('Enter');
      await page.waitForFunction(index => S.status[index] === 'ok', index, { timeout: 5000 });
    }
    await page.locator('#btnNext:not(.hidden)').waitFor();
  };
  const id = deckIdentity('fixture-sentence', 'unit');
  try {
    await open('fixture-sentence');
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM user_trial_state WHERE user_id=?').get(user.user.id).count, 0);
    let firstStarts = 0;
    page.on('request', request => { if (request.url().endsWith('/api/learning-sessions/start')) firstStarts++; });
    await begin(); assert.equal(firstStarts, 1, 'inline initial batch starts with one content request');
    assert.equal(await page.evaluate(() => S.deck.id), id);
    assert.equal(await page.evaluate(() => S.sessionId), id, 'preserve existing published session identity');
    assert.equal(await page.evaluate(() => cur().cid), 'item-0');
    await answer(); await page.locator('#btnNext').click();
    await page.waitForFunction(() => cur()?.cid === 'item-1');
    await page.waitForFunction(async key => { const cache = await ServerCache.read(); return cache?.snapshot.mem.stats.bySentence[key]?.times === 1; }, id + '#item-0');
    // Keep an unfinished current answer while permission expires, then finish saving that answer.
    const secondChunks = await page.evaluate(() => cur().chunks.slice());
    await page.locator('#track .chunk-input').nth(0).fill(secondChunks[0]);
    await page.locator('#track .chunk-input').nth(0).press('Enter');
    await page.waitForTimeout(4500);
    for (let i = 1; i < secondChunks.length; i++) { const input = page.locator('#track .chunk-input').nth(i); await input.fill(secondChunks[i]); await input.press('Enter'); }
    await page.locator('#btnNext:not(.hidden)').click();
    await panel.getByRole('button', { name: '继续学习', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => cur().cid), 'item-1', 'no new question after expiry');
    await page.waitForFunction(async key => { const cache = await ServerCache.read(); return cache?.snapshot.mem.stats.bySentence[key]?.times === 1; }, id + '#item-1');
    const issue = await fetch(base + '/api/admin/membership/code-batches/issue-export', { method: 'POST', headers: { Authorization: 'Bearer ' + admin, 'Content-Type': 'application/json' }, body: JSON.stringify({ planKey: 'monthly', quantity: 1, requestId: crypto.randomUUID() }) });
    const batchId = issue.headers.get('x-membership-batch-id'), code = (await issue.text()).match(/"(CL1(?:-[A-Z2-7]{4}){8})"/)[1];
    await api('/api/admin/membership/code-batches/' + batchId + '/action', admin, { action: 'activate', baseRevision: 1, requestId: crypto.randomUUID() });
    const account = await context.newPage(); await account.goto(base + '/main.html?membership=1');
    await account.locator('#membershipCode').fill(code); await account.locator('#btnRedeemMembership').click();
    await account.locator('#membershipMessage').filter({ hasText: '兑换成功' }).waitFor(); await account.close(); await page.bringToFront();
    await panel.getByRole('button', { name: '继续学习', exact: true }).click();
    await panel.getByText(/会员有效至/).waitFor();
    assert.equal(await page.evaluate(() => cur().cid), 'item-1', 'renewal does not discard completed current answer');
    await page.locator('#btnNext').click(); await page.waitForFunction(() => cur()?.cid === 'item-2');
    await page.reload(); await begin();
    assert.equal(await page.evaluate(() => cur().cid), 'item-2', 'reload uses original canonical resume index');
    const image = await context.newPage(); image.on('pageerror', error => errors.push(error.message));
    await image.goto(base + '/courses.html?protectedCourse=fixture-story&unit=unit');
    await image.waitForURL('**/main.html?protectedCourse=fixture-story&unit=unit');
    await image.locator('.course-access-panel').getByRole('button', { name: '开始学习', exact: true }).click();
    await image.locator('#courseLearningImage:not([hidden])').waitFor();
    await image.waitForFunction(() => document.querySelector('#courseLearningImage')?.naturalWidth > 0);
    assert.match(await image.locator('#courseLearningImage').getAttribute('src'), /^blob:/);
    assert.equal(await image.evaluate(() => !!S.deck._platformSession && !window.__protectedCourseView), true);
    await image.setViewportSize({ width: 375, height: 812 });
    assert.equal(await image.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    const output = path.join(root, 'output/playwright/membership'); fs.mkdirSync(output, { recursive: true });
    await image.screenshot({ path: path.join(output, 'native-image-mobile.png'), fullPage: true });
    await image.close(); await page.bringToFront();
    await open('fixture-free'); await begin();
    assert.match(await panel.innerText(), /免费课程/);
    await page.evaluate(() => chooseCourseMode('chunkSelection'));
    await page.waitForFunction(() => effectivePracticeMode() === 'choose');
    const chunks = await page.evaluate(() => cur().chunks.slice());
    for (const chunk of chunks) {
      await page.locator('#stageChoices .choice').evaluateAll((nodes, value) => { const button = nodes.find(node => node.dataset.v === value); if (!button) throw Error('missing native choice'); button.click(); }, chunk);
    }
    await page.locator('#btnNext:not(.hidden)').waitFor();
    const freeId = deckIdentity('fixture-free', 'unit');
    await page.waitForFunction(async key => { const cache = await ServerCache.read(); return cache?.snapshot.mem.stats.bySentence[key]?.times >= 1; }, freeId + '#free-item-0');
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM user_trial_sessions WHERE user_id=? AND course_id='fixture-free'").get(user.user.id).count, 0);
    const resumeBefore = db.prepare('SELECT idx,generation FROM user_learning_resumes WHERE user_id=? AND session_id=?').get(user.user.id, freeId);
    await open('fixture-free', '&reviewItem=free-item-2'); await begin();
    assert.equal(await page.evaluate(() => cur().cid), 'free-item-2');
    assert.equal(await page.evaluate(() => S.items.length), 1);
    assert.equal(await page.evaluate(() => S.deck.statsDeckId), freeId);
    await answer(); await page.locator('#btnNext').click(); await page.locator('#result:not(.hidden)').waitFor({timeout:10000}).catch(async error=>{throw Error(error.message+'\n'+JSON.stringify(await page.evaluate(()=>({idx:S.idx,length:S.items.length,session:S.sessionId,round:S._roundQueued,submitting:S._roundSubmitting,phase:window.__nativeCourseSession.controller.phase,panel:document.querySelector('.course-access-panel').innerText,result:document.querySelector('#result').innerText,pending:S._pendingRoundOperation})))+'\n'+errors.join('\n'));});
    assert.deepEqual(db.prepare('SELECT idx,generation FROM user_learning_resumes WHERE user_id=? AND session_id=?').get(user.user.id, freeId), resumeBefore, 'single-item review retains main-course checkpoint');
    const persistent = await page.evaluate(async () => JSON.stringify({ cache: await ServerCache.read(), pending: await ServerStore.pending(), mem: CL.loadMem() }));
    assert.doesNotMatch(persistent, /X-Course-Grant|"grant"\s*:/, 'content grants never enter snapshots or operation queue');
    const history = await context.newPage(); let historyContentRequests = 0;
    history.on('pageerror', error=>errors.push(error.stack||error.message));
    history.on('request', request => { if (/\/api\/(course-fragments|course-assets|learning-sessions\/start)/.test(request.url())) historyContentRequests++; });
    await history.goto(base + '/stats.html?tab=sent');
    await history.locator('#statsTabs [data-tab="sent"]').click();
    await history.locator('a[href*="protectedCourse=fixture-sentence"][href*="reviewItem=item-0"]').first().waitFor({ timeout: 10000 }).catch(async error=>{throw Error(error.message+'\n'+(await history.locator('body').innerText()).slice(-3000)+'\n'+errors.join('\n'));});
    assert.equal(historyContentRequests, 0, 'browsing account history fetches metadata only'); await history.close(); await page.bringToFront();
    await verifyAssessment({ page, panel, base, db, user, id });
    // Existing legacy identity/generation survives delivery through the same native entry.
    await page.evaluate(()=>CourseEnrollment.leave('fixture-story'));
    db.prepare('INSERT INTO user_learning_generations(user_id,scope_key,generation) VALUES(?,?,?)').run(user.user.id,'course:original-deck',3);
    await api('/api/operations',user.token,{protocol:3,requestId:crypto.randomUUID(),type:'learning.resume',payload:{deckId:'original-deck',courseId:'original-deck',sessionId:'original-session-123456',generation:3,idx:1}});
    await open('fixture-original');await begin();
    assert.equal(await page.evaluate(()=>S.deck.id),'original-deck');
    assert.equal(await page.evaluate(()=>S.sessionId),'original-session-123456');
    assert.equal(await page.evaluate(()=>S.generation),3);assert.equal(await page.evaluate(()=>cur().cid),'original-item-1');
    await answer();
    await page.waitForFunction(async()=>{const cache=await ServerCache.read();return cache?.snapshot.mem.stats.bySentence['original-deck#original-item-1']?.times===1;});
    assert.equal(db.prepare('SELECT generation FROM user_learning_generations WHERE user_id=? AND scope_key=?').get(user.user.id,'course:original-deck').generation,3);
    await open('fixture-free');
    await panel.getByRole('button', { name: /^(开始学习|继续学习)$/ }).click();
    await page.waitForFunction(() => window.__nativeCourseSession?.controller.current?.mode === 'free');
    assert.equal(await page.evaluate(() => window.__nativeCourseSession.controller.current.mode), 'free', 'free lessons remain available after membership expiry');
    const answerTemplate=await verifyOfflineAnswer({page,open,begin,answer,db,user,freeId});
    const beforeHistory=JSON.parse(db.prepare('SELECT data_json FROM user_sentence_stats WHERE user_id=? AND sentence_key=?').get(user.user.id,answerTemplate.payload.key).data_json).times;
    await page.evaluate(async template=>{
      for(let index=0;index<34;index++){
        const eventId=crypto.randomUUID(),payload={...template.payload,eventId,occurredAt:Date.now(),answerOrder:index,sessionId:'synthetic-history-transport-session'};
        await ServerStore.submitCommitted('learning.answer',payload,{requestId:eventId});
      }
    },answerTemplate);
    const confirmedHistory=await page.evaluate(async key=>(await ServerCache.read()).snapshot.mem.stats.bySentence[key],answerTemplate.payload.key);
    assert.equal(confirmedHistory.times,beforeHistory+34,'evidence-delta transport retains every synthetic long-history answer');
    assert.equal(confirmedHistory.learningV1.evidence.length,beforeHistory+34,'wire delta reconstructs complete confirmed evidence');
    await Promise.all(receiptReads);assert.ok(answerTraffic.length>0);
    assert.ok(answerTraffic.some(row=>row.accept==='application/vnd.chunklab.evidence-delta+json'),'long history uses the current bounded evidence-delta path');
    const trafficOutput=path.join(root,'output/playwright/membership');fs.mkdirSync(trafficOutput,{recursive:true});
    fs.writeFileSync(path.join(trafficOutput,'answer-traffic.json'),JSON.stringify(answerTraffic,null,2));
    console.log('current-browser answer traffic (decoded JSON, successful replies): '+JSON.stringify({samples:answerTraffic.length,
      uploadBytes:[Math.min(...answerTraffic.map(row=>row.uploadBytes)),Math.max(...answerTraffic.map(row=>row.uploadBytes))],
      decodedReceiptBytes:[Math.min(...answerTraffic.map(row=>row.decodedReceiptBytes)),Math.max(...answerTraffic.map(row=>row.decodedReceiptBytes))],
      mediaTypes:Array.from(new Set(answerTraffic.map(row=>row.accept)))}));
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
};

async function verifyOfflineAnswer({page,open,begin,answer,db,user,freeId}) {
  const key=freeId+'#free-item-1';
  const count=()=>Number(JSON.parse(db.prepare('SELECT data_json FROM user_sentence_stats WHERE user_id=? AND sentence_key=?').get(user.user.id,key)?.data_json||'{}').times)||0;
  const before=count();
  await open('fixture-free','&reviewItem=free-item-1');await begin();
  await page.route('**/api/operations',route=>route.abort('failed'));
  await answer();
  await page.waitForFunction(async()=> (await ServerStore.pending()).some(row=>row.operation.type==='learning.answer'));
  const queued=await page.evaluate(async()=> (await ServerStore.pending()).find(row=>row.operation.type==='learning.answer'));
  assert.equal(count(),before,'network-blocked answer has not been counted on the server');
  await page.reload();
  await page.waitForFunction(()=>window.CL&&CL.serverPersistenceReady());
  const retained=await page.evaluate(async id=>(await ServerStore.pending()).find(row=>row.requestId===id),queued.requestId);
  assert.deepEqual(retained.operation,queued.operation,'reload preserves the exact durable answer operation');
  await page.unroute('**/api/operations');await page.evaluate(()=>ServerStore.retryPending());
  await page.waitForFunction(async id=>!(await ServerStore.pending()).some(row=>row.requestId===id),queued.requestId);
  assert.equal(count(),before+1,'reconnection applies the queued answer once');
  await page.evaluate(operation=>ChunkAPI.request('/api/operations',{method:'POST',body:JSON.stringify(operation)}),queued.operation);
  assert.equal(count(),before+1,'replaying the identical answer request never double counts');
  assert.equal(db.prepare('SELECT count(*) AS n FROM user_operation_receipts WHERE user_id=? AND request_id=?').get(user.user.id,queued.requestId).n,1);
  await page.reload();await page.waitForFunction(()=>window.CL&&CL.serverPersistenceReady());
  assert.equal(count(),before+1);
  assert.equal(await page.evaluate(async id=>(await ServerStore.pending()).some(row=>row.requestId===id),queued.requestId),false);
  console.log('native answer offline/reload/reconnect/repeated-request: one confirmed answer, one receipt, no pending duplicate');
  return queued.operation;
}

async function verifyAssessment({ page, panel, base, db, user, id }) {
  // Original eligibility, rendering, durable answer/finalize and historical reopening.
  db.prepare('UPDATE user_sentence_stats SET data_json=? WHERE user_id=? AND sentence_key=?').run(JSON.stringify({ deckId: id, times: 1, lastAt: Date.now() - 2 * 86400000 }), user.user.id, id + '#item-0');
  await page.goto(base + '/main.html?protectedCourse=fixture-sentence&unit=unit&assessmentItem=item-0');
  await panel.getByRole('button', { name: '开始测评这一项', exact: true }).click();
  await page.locator('[data-assessment-answer]').first().waitFor({ timeout: 15000 });
  assert.equal(await page.locator('.membership-assessment').count(), 0);
  assert.doesNotMatch(await page.locator('#result').innerText(), /Hello there/);
  await page.locator('[data-assessment-answer="0"]').fill('Hello');
  await page.waitForFunction(async () => { const drafts = await IDBStore.listAssessmentDrafts(); return drafts.some(row => row.data.inputDrafts?.[0]?.[0] === 'Hello'); });
  await page.reload();
  await page.locator('[data-assessment-answer="0"]').waitFor();
  assert.equal(await page.locator('[data-assessment-answer="0"]').inputValue(), 'Hello', 'native assessment retains unsubmitted input after refresh');
  await page.locator('[data-assessment-answer="1"]').fill('there.');
  await page.locator('#btnAssessmentSubmit').click();
  await page.locator('#btnAssessmentFinalize').click(); await page.getByText('测评通过', { exact: true }).waitFor();
  const savedUrl = page.url();
  db.prepare('UPDATE user_entitlement_grants SET redeemed_at=? WHERE user_id=?').run(Date.now() - 400 * 86400000, user.user.id);
  await page.goto(savedUrl); await page.getByText('测评通过', { exact: true }).waitFor();
  assert.ok(await page.locator('.assessment-results').innerText());
}
