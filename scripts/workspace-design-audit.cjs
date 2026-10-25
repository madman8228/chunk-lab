'use strict';
// Read-only UI harness: ephemeral browser context, synthetic content, no API writes.
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright-core');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
async function main(){
  const browser=await chromium.launch({headless:true});
  try{
    const page=await browser.newPage();
    const html=fs.readFileSync(path.join(root,'main.html'),'utf8');
    const styles=Array.from(html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g),match=>match[1]).join('\n');
    const css=fs.readFileSync(path.join(root,'assets/learning-workspace.css'),'utf8')+fs.readFileSync(path.join(root,'assets/content-card.css'),'utf8');
    const report=[];
    for(const width of [946,390]){
      await page.setViewportSize({width,height:932});
      for(const view of ['home','my-learning','discover']){
        await page.setContent('<!doctype html><html><head><style>'+css+'</style><style>'+styles+'</style></head><body><div id="'+(view==='home'?'pageHome':view==='my-learning'?'pageMyLearning':'pageDiscover')+'"><main id="root"></main></div></body></html>');
        await page.addScriptTag({path:path.join(root,'js/learning-workspace.js')});
        await page.addScriptTag({path:path.join(root,'js/content-card.js')});await page.addScriptTag({path:path.join(root,'js/course-return.js')});await page.addScriptTag({path:path.join(root,'js/learning-workspace-view.js')});
        await page.addScriptTag({path:path.join(root,'js/learning-navigation.js')});
        await page.evaluate(view=>{
          const resource=LearningWorkspace.normalizeResource({resourceId:'course:audit',courseId:'audit',title:'隔离设计检查课程',visibility:'private',sourceRefs:[{type:'sentence-deck',id:'audit-deck'}]});
          LearningWorkspaceView.render(document.getElementById('root'),{view,resources:[resource],publicResources:[resource],memberships:{audit:{joined:true}},preferences:{},activeResources:[resource],homeActivity:{streak:7},resume:{toolId:'chunks',title:'从回家到就寝',deck:{id:'audit-deck',name:'隔离测试课程'}},due:10,courseRows:[{course:{id:'audit',title:resource.title},resource,lessons:[],progress:'已学 2 / 10 句'}]}, {navigate(){},filter(){},select(){},open(){},review(){},resume(){},retry(){},leave:()=>Promise.resolve()});
        },view);
        if(view==='my-learning')assert.equal(await page.locator('.my-learning-resume-stat').count(),3,'resume card must show three real summary metrics');
        for(const dark of [false,true]){
          await page.evaluate(dark=>document.documentElement.classList.toggle('dark',dark),dark);
          const metrics=await page.evaluate(()=>{
            const visible=node=>node.getClientRects().length&&getComputedStyle(node).visibility!=='hidden';
            const controls=Array.from(document.querySelectorAll('button,a,summary,input')).filter(visible);
            const resumeTargets=Array.from(document.querySelectorAll('.my-learning-resume-button,.my-learning-review-link')).map(node=>{const rect=node.getBoundingClientRect();return {label:node.textContent.trim(),width:Math.round(rect.width),height:Math.round(rect.height)};});
            const resumeStats=Array.from(document.querySelectorAll('.my-learning-resume-stat')).map(node=>{const rect=node.getBoundingClientRect();return {width:Math.round(rect.width),height:Math.round(rect.height)};});
            return {overflow:document.documentElement.scrollWidth>innerWidth,smallTargets:controls.map(node=>{const rect=node.getBoundingClientRect();return {label:node.getAttribute('aria-label')||node.textContent.trim(),width:Math.round(rect.width),height:Math.round(rect.height)};}).filter(row=>row.width<44||row.height<44),resumeTargets,resumeStats,bodyBackground:getComputedStyle(document.body).backgroundImage,surface:Array.from(document.querySelectorAll('.workspace-card,.workspace-active')).map(node=>({background:getComputedStyle(node).backgroundColor,color:getComputedStyle(node).color})),underlined:controls.filter(node=>getComputedStyle(node).textDecorationLine.includes('underline')).map(node=>node.textContent.trim())};
          });
          report.push({view,width,dark,...metrics});
          assert.equal(metrics.overflow,false,view+' overflow at '+width);
          if(view==='my-learning'){
            assert.ok(metrics.resumeTargets.length===2&&metrics.resumeTargets.every(row=>row.width>=44&&row.height>=44),'resume actions must meet the 44px target size');
            assert.equal(new Set(metrics.resumeStats.map(row=>row.width+'x'+row.height)).size,1,'resume metrics must be equal-sized');
          }
          assert.deepEqual(metrics.underlined,[],view+' ordinary navigation must not be underlined');
          if(dark)assert.ok(metrics.surface.every(row=>row.background!=='rgb(255, 250, 240)'),view+' must switch paper surfaces with the theme');
        }
      }
    }
    console.log(JSON.stringify(report,null,2));
  }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
