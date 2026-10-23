'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),{chromium}=require('playwright-core');
(async()=>{
 let browser,requestJob=null,job=null,audioRequests=0;
 const book={id:'textbook-wordbook:fixture',label:'隔离小学教材',taskCount:1,reviewSummary:{approved:1,pending:0,changesRequested:0},images:1,wordAudio:1,sentenceAudio:1,missingAudio:{word:0,sentence:0},importPackages:[]};
 const report={generatedAt:new Date().toISOString(),books:[book],totals:{books:1,words:1,approvedSentences:1,pendingSentences:0,wordAudio:1,sentenceAudio:1,eligibleAudio:0},imports:[],publications:[],imageOnly:[],errors:[]};
 const server=http.createServer(async(req,res)=>{
  if(req.url.startsWith('/textbook-production.html')){res.setHeader('Content-Type','text/html');return res.end(fs.readFileSync(path.resolve(__dirname,'../scripts/textbook-production.html')));}
  res.setHeader('Content-Type','application/json');if(req.headers.authorization!=='Bearer isolated'){res.statusCode=401;return res.end(JSON.stringify({error:'请登录'}));}
  if(req.url.includes('/audio/'))audioRequests++;
  if(req.method==='POST'){let body='';for await(const part of req)body+=part;requestJob=JSON.parse(body);job={id:'isolated-job',status:'running',bookIds:requestJob.bookIds,results:[]};return res.end(JSON.stringify(job));}
  if(req.url.includes('/jobs/'))return res.end(JSON.stringify({...job,status:'completed',results:[{bookId:book.id,status:'staged',importId:'isolated-draft'}]}));
  return res.end(JSON.stringify({...report,jobs:[]}));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>localStorage.setItem('chunklab_admin_token','isolated'));
  await page.goto('http://127.0.0.1:'+server.address().port+'/textbook-production.html?admin=1');await page.getByText('隔离小学教材',{exact:true}).waitFor();
  await page.locator('#selectAll').check();await page.locator('#stageSelected').click();await page.getByText('隔离小学教材：已导入待审核',{exact:false}).waitFor();
  assert.deepEqual(requestJob,{action:'stage',bookIds:[book.id]});assert.equal(audioRequests,0);
  for(const width of [1100,390]){await page.setViewportSize({width,height:932});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  assert.deepEqual(errors,[]);console.log('Production UI: authenticated batch action, task progress, staging result, responsive layout and no audio preloading passed.');
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
