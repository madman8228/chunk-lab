const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('stats.html', 'utf8');
const start = source.indexOf('function reloadFromOtherTab(){');
const end = source.indexOf('\nif(CL && CL.on)', start);
assert.ok(start >= 0 && end > start);
let rendered,visible=true,refreshes=0;
const ctx = vm.createContext({
  mem: {stats:{bySentence:{confirmed:{times:3}}}},
  CL: {refreshExternal:async()=>({stats:{bySentence:{}}})},
  window: {}, _statsDecks:null, discardMistakeExportSnapshot(){},
  statsSurfaceVisible:()=>visible,_statsProjectionDirty:false,
  refreshConfirmedStatsProjection:async()=>{refreshes++;ctx.mem={stats:{bySentence:{confirmed:{times:3}}}};return true;},
  renderStats(){rendered=ctx.mem;}, loadMem(){}, Promise
});
vm.runInContext(source.slice(start,end),ctx);
ctx.reloadFromOtherTab();
setImmediate(()=>{
  assert.equal(rendered.stats.bySentence.confirmed?.times,3,
    'cross-tab notification must not replace server-confirmed statistics with an older local projection');
  visible=false;ctx.reloadFromOtherTab();
  assert.equal(refreshes,1,'hidden cross-tab notification must not perform a refresh');
  assert.equal(ctx._statsProjectionDirty,true);
  console.log('stats cross-tab: confirmed projection survives legacy local reload');
});
