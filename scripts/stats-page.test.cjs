const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
test('integrated archive is isolated, uses existing storage and no iframe',()=>{
 const module=fs.readFileSync(path.join(root,'js/stats-page.js'),'utf8');
 assert.doesNotThrow(()=>new vm.Script(module));
 assert.ok(module.includes('attachShadow'));
 assert.match(module,/return document\.getElementById\(([A-Za-z_$][\w$]*)\)/);
 assert.ok(module.includes("if(key==='getElementById')return function(id){return shadow.getElementById(id);}"));
 assert.ok(!module.includes('<iframe'));
 assert.ok(module.includes('global.AccountStorage.storage'));
});
test('main route and legacy redirect share one archive entry',()=>{
 const main=fs.readFileSync(path.join(root,'main.html'),'utf8');
 const legacy=fs.readFileSync(path.join(root,'stats.html'),'utf8');
 assert.ok(main.includes('id="pageStats"'));
 assert.ok(main.includes("StatsPage.mount($('statsPageHost'))"));
 assert.ok(legacy.includes("location.replace('main.html?view=stats')"));
});

test('overview unifies domains while other tabs retain their selected category',()=>{
 const buttons=['all','sentence','vocabulary'].map(domain=>({dataset:{domain},setAttribute(key,value){this[key]=value;}}));
 const domains={children:buttons,hidden:false,addEventListener(type,handler){this.click=handler;}};
 const document={visibilityState:'hidden',getElementById(id){return id==='statsDomains'?domains:null;},addEventListener(){}};
 const window={document,addEventListener(){}};
 vm.runInNewContext(fs.readFileSync(path.join(root,'js/stats-vocabulary.js'),'utf8'),{window,document});
 window.StatsVocabulary.render('overview');assert.equal(domains.hidden,true);assert.equal(buttons[0]['aria-selected'],'true');
 window.StatsVocabulary.render('sent');assert.equal(domains.hidden,false);
 domains.click({target:{closest(){return buttons[2];}}});
 window.StatsVocabulary.render('sent');assert.equal(buttons[2]['aria-selected'],'true');
 window.StatsVocabulary.render('overview');assert.equal(domains.hidden,true);assert.equal(buttons[0]['aria-selected'],'true');
 window.StatsVocabulary.render('review');assert.equal(domains.hidden,false);assert.equal(buttons[2]['aria-selected'],'true');
});
