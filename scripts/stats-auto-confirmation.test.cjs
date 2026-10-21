const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('stats.html','utf8');
const start=html.indexOf("window.addEventListener('server-cache-applied'");
const end=html.indexOf('var _statsLastFocusRefreshAt',start);
let ready=false,migrations=0,renders=0,visible=true;
const listeners={};
const context=vm.createContext({
 window:{AccountStorage:{owner:'test'},addEventListener(type,fn){listeners[type]=fn;}},
 CL:{serverPersistenceReady:()=>ready},
 refreshConfirmedStatsProjection:async()=>ready,
 migrateLegacyStatKeys:async()=>{migrations++;},renderStats(){renders++;},statsSurfaceVisible:()=>visible,_statsProjectionDirty:false,Promise
});
vm.runInContext(html.slice(start,end),context);
ready=true;
if(listeners['cloud-config-changed'])listeners['cloud-config-changed']({});
setImmediate(()=>{
 assert.equal(migrations,1,'startup retry becoming ready must automatically run preserved stat migration without a manual action');
 assert.equal(renders,1);
 visible=false;listeners['cloud-config-changed']({});
 assert.equal(migrations,1,'hidden statistics must defer migration and refresh');
 assert.equal(context._statsProjectionDirty,true);
 console.log('stats confirmation: automatic startup retry runs migration and refreshes view');
});
