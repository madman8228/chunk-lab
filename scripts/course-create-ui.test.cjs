'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), os = require('node:os'), http = require('node:http');
const { chromium } = require('playwright-core');
const root = path.resolve(__dirname, '..');
const fixture = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/assets/course-create.css"><link rel="stylesheet" href="/assets/learning-sky.css"><body class="learning-page course-create-page"><script src="/js/learning-sky.js"></script><div id="root"></div><script type="module">
import {AuthoringView} from '/src/course-authoring/ui/view.mjs';
import {AuthoringController} from '/src/course-authoring/ui/controller.mjs';
import {AiCoursePromptComposer} from '/src/course-authoring/prompt-composer.mjs';
let snapshot={sessionId:'isolated-ui',revision:1,stage:'setup',brief:'',rawResult:'',preferences:{courseType:'sentence',targetCefrs:['A1'],exerciseModes:['typing']}};
window.fixtureInitial=structuredClone(snapshot);
const service={open:async()=>snapshot,codec:{parseText:()=>({ok:false})},capabilityCatalog:{describeCreationOptions:()=>[]},updatePreferences:async(id,preferences)=>snapshot={...snapshot,preferences,revision:snapshot.revision+1},copyPrompt:async()=>{window.fixturePrompt=new AiCoursePromptComposer({}).composeCreation({preferences:snapshot.preferences});return {copied:true,session:{...snapshot,stage:'waiting-result'}};}};
const root=document.querySelector('#root');
await new AuthoringController({root,view:new AuthoringView({root}),service,sessionRepository:{},scopeGuard:{capture:()=>({})},io:{}}).start();
</script></body></html>`;
(async()=>{
  const output=fs.mkdtempSync(path.join(os.tmpdir(),'course-create-ui-'));
  const server=http.createServer((req,res)=>{
    const pathname=new URL(req.url,'http://localhost').pathname;
    if(pathname==='/fixture'){res.setHeader('Content-Type','text/html');res.end(fixture);return;}
    const file=path.resolve(root,'.'+pathname);
    if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
    res.setHeader('Content-Type',/\.m?js$/.test(file)?'text/javascript':/\.css$/.test(file)?'text/css':/\.png$/.test(file)?'image/png':'text/html');res.end(fs.readFileSync(file));
  });
  let browser;
  try{
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));browser=await chromium.launch({headless:true});
    const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto('http://127.0.0.1:'+server.address().port+'/fixture');
    await page.locator('#brief').waitFor();
    assert.equal(await page.locator('[name="exerciseModes"]').count(),0);
    assert.equal(await page.getByRole('link',{name:'返回我的内容'}).getAttribute('href'),'main.html?view=my-learning');
    assert.equal(await page.locator('.recent-drafts').evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)');
    assert.equal(await page.locator('.sky-sun').isVisible(),true);
    assert.equal(await page.locator('.sky-cloud').count(),3);
    assert.match(await page.evaluate(()=>getComputedStyle(document.body).backgroundImage),/linear-gradient/);
    assert.doesNotMatch(await page.evaluate(()=>getComputedStyle(document.body,'::before').backgroundImage),/jqka-learning-garden/);
    for(const width of [847,390]){
      await page.setViewportSize({width,height:932});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await page.screenshot({path:path.join(output,'setup-'+width+'.png'),fullPage:true});
    }
    await page.locator('[data-action="copy-prompt"]').click();
    await page.locator('[data-action="back-setup"]').waitFor({timeout:3000}).catch(async error=>{throw Error(error.message+' '+await page.locator('.global-error').textContent());});
    const prompt=await page.evaluate(()=>fixturePrompt);
    assert.match(prompt,/"id": "typing"/);assert.match(prompt,/"id": "chunkSelection"/);
    assert.equal(await page.locator('.create-navigation a').count(),2,'return links persist on the next step');
    assert.deepEqual(errors,[]);
    console.log('Course creator: compact setup, homepage artwork, return navigation and both default learning modes passed.');
    console.log('Screenshots: '+output);
  }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
