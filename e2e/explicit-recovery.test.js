'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawn} = require('node:child_process');
const {chromium} = require('playwright-core');
const root=path.resolve(__dirname,'..');
const port=require('./lib/free-port').freePort(11300,100);
const base='http://127.0.0.1:'+port;
const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'chunklab-explicit-recovery-'));
let server,browser;
(async()=>{
  try{
    server=spawn(process.execPath,['index.js'],{cwd:path.join(root,'server'),
      env:{...process.env,PORT:String(port),CHUNKLAB_DATA_DIR:dataDir,NODE_ENV:'test',CHUNKLAB_WRITE_PROTOCOL:'3'},stdio:'ignore'});
    let ready=false;
    for(let i=0;i<100;i++){
      ready=await fetch(base+'/api/health').then(r=>r.ok).catch(()=>false);
      if(ready)break;
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    assert.ok(ready);
    browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||chromium.executablePath()});
    const context=await browser.newContext({serviceWorkers:'block'});
    const page=await context.newPage();
    await page.addInitScript(() => {
      if (sessionStorage.getItem('main-persistence-fixture-seeded') === '1') return;
      sessionStorage.setItem('main-persistence-fixture-seeded', '1');
      const items = [
        { cid: 'server-answer-1', sentence: 'Say hello.', en: 'Say hello.', translation: '说你好。',
          chunks: ['Say hello.'], alts: [[]], hints: ['Say hello.'] },
        { cid: 'server-answer-2', sentence: 'Say hello again.', en: 'Say hello again.', translation: '再说一次你好。',
          chunks: ['Say hello again.'], alts: [[]], hints: ['Say hello again.'] },
      ];
      localStorage.clear();
      localStorage.setItem('chunklab.storage-owner.v1', JSON.stringify([location.origin, 'local']));
      localStorage.setItem('chunklab.sync-conflict.v1', JSON.stringify({
        conflicts:[{entity:'batch',id:'legacy-conflict-fixture'}], deleted:{}
      }));
      localStorage.setItem('chunklab.v1', JSON.stringify({
        version: 2, decks: [{ id: 'server-answer', name: '服务端答题验收', items }],
        best: {}, mastered: {
          'server-answer#legacy-familiarity': {
            deckId: 'server-answer', sentence: 'Legacy familiar sentence.', markedAt: Date.now() - 86400000,
          },
          'server-answer#legacy-familiarity-without-time': {
            deckId: 'server-answer', sentence: 'Legacy sentence without a timestamp.',
          },
        }, deletedItems: {}, reinforceBook: [{
          _key: 'server-answer::legacy-wrong-entry', deckId: 'server-answer', sentence: 'Say hello.',
          translation: '说你好。', mistakes: [], history: [],
        }, {
          _key: 'server-answer::legacy-wrong-entry-2', deckId: 'server-answer', sentence: 'Say hello again.',
          translation: '再说一次你好。', mistakes: [], history: [],
        }],
        stats: { totalRounds: 0, totalAnswered: 0, bySentence: {}, daysLog: {}, events: [
          { id: 'legacy-round-for-days-log-backfill', kind: 'round', at: Date.now() - 86400000 },
        ] },
        settings: { mode: 'choose', sound: false, shuffle: false, batchSize: 10, apiKey: 'legacy-private-key-fixture' },
      }));
      localStorage.setItem('chunklab.logical-courses.v1', JSON.stringify([{
        id: 'logical-course:legacy-travel', title: '旧版旅行课程', coverImage: '',
        catalogKey: 'logical:logical-course:legacy-travel', origin: 'user', contentType: 'story',
        createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z',
      }]));
      const now = Date.now();
      localStorage.setItem('chunklab.course-progress.v1', JSON.stringify({
        'enrollment:v1:user-deck%3Aserver-answer': {
          kind: 'course-enrollment', schemaVersion: 1, courseId: 'user-deck:server-answer',
          joined: true, joinedAt: now, changedAt: now,
        },
      }));
    });
    await require('./lib/legacy-recovery-fixture').seedArchivedAccount(page,base);
    await page.goto(base+'/main.html');
    await page.waitForFunction(()=>window.CL&&CL.serverPersistenceReady(),null,{timeout:15000});
    await require('./lib/legacy-recovery-scenarios')(page,dataDir);
    await context.close();
    console.log('[explicit-recovery] archived source integrity, selective restore, pagination and unresolved-operation isolation passed');
  }finally{
    if(browser)await browser.close();
    if(server&&server.exitCode===null)await new Promise(resolve=>{server.once('close',resolve);server.kill('SIGTERM');});
    fs.rmSync(dataDir,{recursive:true,force:true});
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
