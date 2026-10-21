'use strict';
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const path=require('node:path');
const fs=require('node:fs');
const {deckIdentity}=require('../../server/services/membership/assessment-content');

module.exports=async function verifyProtectedAssessment({browser,base,api,admin,db,output,errors}){
  const account=await api('/api/auth/register',null,{username:'assessment-browser',password:'SyntheticLearner2026!'});
  const context=await browser.newContext({serviceWorkers:'block',viewport:{width:1280,height:900}});
  try{
    await context.addInitScript(token=>localStorage.setItem('chunklab_token',token),account.token);
    const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
    const study=page.locator('.membership-study');
    const url=base+'/main.html?protectedCourse=fixture-sentence&unit=unit&assessmentItem=item-0';
    await page.goto(url);
    await study.getByRole('button',{name:'开始测评这一项',exact:true}).click();
    await study.locator('.membership-status').filter({hasText:'尚未到复测时间'}).waitFor();
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM user_trial_state WHERE user_id=?').get(account.user.id).count,0);
    const deckId=deckIdentity('fixture-sentence','unit');
    const seed=(course,unit,item)=>{
      const id=deckIdentity(course,unit);
      db.prepare('INSERT INTO user_sentence_stats(user_id,sentence_key,deck_id,data_json) VALUES(?,?,?,?)').run(account.user.id,id+'#'+item,id,
        JSON.stringify({deckId:id,times:1,lastAt:Date.now()-2*86400000}));
    };
    seed('fixture-sentence','unit','item-0');
    db.prepare('INSERT INTO user_learning_generations(user_id,scope_key,generation) VALUES(?,?,2)').run(account.user.id,'course:fixture-sentence');
    let lostStart=true;
    await context.route('**/api/protected-assessments/start',async route=>{
      if(lostStart){lostStart=false;await route.fetch();await route.abort('failed');}else await route.continue();
    });
    await study.getByRole('button',{name:'开始测评这一项',exact:true}).click();
    await study.locator('.membership-status').filter({hasText:'连接暂未成功'}).waitFor();
    await study.getByRole('button',{name:'开始测评这一项',exact:true}).click();
    await study.getByLabel('意群 1 的英文答案',{exact:true}).waitFor();
    assert.equal(await study.getByText('Hello there.',{exact:true}).isVisible(),false,'assessment does not reveal correct English before submission');
    const assessmentId=new URL(page.url()).searchParams.get('assessmentId');
    assert.equal(db.prepare('SELECT generation FROM user_assessment_sessions WHERE user_id=? AND session_id=?').get(account.user.id,assessmentId).generation,2);
    await study.getByRole('button',{name:'暂停',exact:true}).click();
    assert.equal(await study.getByLabel('意群 1 的英文答案',{exact:true}).isVisible(),false);
    await page.reload();
    await study.getByRole('button',{name:'开始测评这一项',exact:true}).click();
    await study.getByLabel('意群 1 的英文答案',{exact:true}).waitFor();
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM user_assessment_sessions WHERE user_id=?').get(account.user.id).count,1,'refresh resumes the same assessment');
    fs.mkdirSync(output,{recursive:true});
    await page.screenshot({path:path.join(output,'assessment-desktop.png'),fullPage:true});
    await page.setViewportSize({width:375,height:812});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.screenshot({path:path.join(output,'assessment-mobile.png'),fullPage:true});
    await study.getByLabel('意群 1 的英文答案',{exact:true}).fill('Hello');
    await study.getByLabel('意群 2 的英文答案',{exact:true}).fill('there.');
    await context.setOffline(true);
    await study.getByRole('button',{name:'提交测评并查看结果',exact:true}).click();
    await page.waitForFunction(async()=>{
      const pending=await ServerStore.pending();return pending.some(row=>row.operation.type==='assessment.answer'&&!row.receipt)&&pending.some(row=>row.operation.type==='assessment.finalize'&&!row.receipt);
    });
    db.prepare('UPDATE user_trial_state SET ends_at=? WHERE user_id=?').run(Date.now()-1,account.user.id);
    db.prepare('UPDATE user_trial_sessions SET lease_ends_at=? WHERE user_id=?').run(Date.now()-1,account.user.id);
    await context.setOffline(false);
    await study.getByText('本次测评通过',{exact:true}).waitFor({timeout:30000});
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM user_learning_events WHERE user_id=?').get(account.user.id).count,1,'offline answer/finalize persisted once after trial expiry');
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM user_learning_resumes WHERE user_id=?').get(account.user.id).count,0,'assessment leaves course bookmark unchanged');
    await page.goto(url);
    await study.getByRole('button',{name:'开始测评这一项',exact:true}).click();
    await study.locator('.membership-status').filter({hasText:'免费体验已结束'}).waitFor();
    const issued=await fetch(base+'/api/admin/membership/code-batches/issue-export',{method:'POST',headers:{Authorization:'Bearer '+admin,'Content-Type':'application/json'},
      body:JSON.stringify({planKey:'monthly',quantity:1,requestId:crypto.randomUUID()})});
    const batch=issued.headers.get('x-membership-batch-id'),csv=await issued.text(),code=csv.match(/"(CL1(?:-[A-Z2-7]{4}){8})"/)[1];
    await api('/api/admin/membership/code-batches/'+batch+'/action',admin,{action:'activate',baseRevision:1,requestId:crypto.randomUUID()});
    await api('/api/membership/redeem',account.token,{code,requestId:crypto.randomUUID()});
    seed('fixture-story','unit','line-1');
    const imagePage=await context.newPage();imagePage.on('pageerror',error=>errors.push(error.message));
    await imagePage.goto(base+'/courses.html?protectedCourse=fixture-story&unit=unit&assessmentItem=line-1');
    const imageStudy=imagePage.locator('.membership-study');
    await imageStudy.getByRole('button',{name:'开始测评这一项',exact:true}).click();
    await imageStudy.getByLabel('意群 1 的英文答案',{exact:true}).fill('wrong answer');
    await imageStudy.getByLabel('意群 2 的英文答案',{exact:true}).fill('wrong answer');
    assert.equal(await imageStudy.getByText('A lovely picture.',{exact:true}).isVisible(),false);
    await imageStudy.getByRole('button',{name:'提交测评并查看结果',exact:true}).click();
    await imageStudy.getByText('本次测评未通过',{exact:true}).waitFor();
    await imagePage.close();await page.bringToFront();
    seed('fixture-sentence','unit','item-1');
    await page.goto(base+'/main.html?protectedCourse=fixture-sentence&unit=unit&assessmentItem=item-1');
    await study.getByRole('button',{name:'开始测评这一项',exact:true}).click();
    await study.getByLabel('意群 1 的英文答案',{exact:true}).fill('How');
    await study.getByLabel('意群 2 的英文答案',{exact:true}).fill('are');
    await study.getByLabel('意群 3 的英文答案',{exact:true}).fill('you?');
    db.prepare('UPDATE user_entitlement_grants SET redeemed_at=? WHERE user_id=?').run(Date.now()-400*86400000,account.user.id);
    let lostFinalize=true;
    await context.route('**/api/operations',async route=>{
      if(lostFinalize&&route.request().postDataJSON()?.type==='assessment.finalize'){
        lostFinalize=false;await route.fetch();await route.abort('failed');
      }else await route.continue();
    });
    await study.getByRole('button',{name:'提交测评并查看结果',exact:true}).click();
    await study.getByText('本次测评通过',{exact:true}).waitFor();
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM user_learning_events WHERE user_id=?').get(account.user.id).count,3);
    const finalRow=db.prepare('SELECT data_json FROM user_sentence_stats WHERE user_id=? AND sentence_key=?').get(account.user.id,deckId+'#item-1');
    assert.ok(JSON.parse(finalRow.data_json).learningV1.evidence.some(event=>event.type==='assessment'&&event.ok));
    await page.goto(base+'/main.html?protectedCourse=fixture-sentence&unit=unit&assessmentItem=item-2');
    await study.getByRole('button',{name:'开始测评这一项',exact:true}).click();
    await study.locator('.membership-status').filter({hasText:'当前没有有效会员'}).waitFor();
    await page.goto(base+'/stats.html');
    await page.locator('[data-tab="sent"]').click();
    const record=page.locator('.srow').filter({hasText:'最近初测通过（历史记录）'}).first();
    await record.waitFor({timeout:30000});await record.locator('.row-detail-toggle').click();
    await page.getByText('最近初测通过（历史记录）',{exact:false}).first().waitFor({timeout:30000});
  }finally{await context.close();}
  console.log('protected assessment browser: eligibility, trial rollback, refresh, pause, offline durable answers, expiry, renewal, generation and bookmark passed');
};
