/**
 * bridge.mjs · ESM → 全局桥接（ADR-007 Step 1）
 *
 * main.html 的内联脚本是普通 script（onclick 属性依赖全局函数，不能直接转 module），
 * 故通过本 module 把 ESM 纯逻辑模块挂到 window，供内联脚本的包装器调用。
 * module 脚本默认 defer，会在普通内联脚本之后执行；但业务调用都发生在
 * 用户交互时再由 ensurePracticeReady() 载入练习模块，首页只等待基础格式工具。
 */
import * as FormatTools from './format.mjs';

window.FormatTools = FormatTools;
window.__chunklabFormatReady = true;
window.dispatchEvent(new Event('chunklab-format-ready'));

/* 练习模块只在用户真正进入课程时加载；Promise 复用避免重复下载。 */
var _practiceReadyTask = null;
window.ensurePracticeReady = function(){
  if(window.ChunkEngine && window.AIPrompts && window.BackupTools && window.CauseTools){
    return Promise.resolve(window.ChunkEngine);
  }
  if(_practiceReadyTask) return _practiceReadyTask;
  _practiceReadyTask = Promise.all([
    import('./chunk-engine.mjs'),
    import('./ai-prompts.mjs'),
    import('./backup.mjs'),
    import('./distractor-cause.mjs')
  ]).then(function(modules){
    window.ChunkEngine = modules[0];
    window.AIPrompts = modules[1];
    window.BackupTools = modules[2];
    window.CauseTools = modules[3];
    window.__chunklabBridgeReady = true;
    window.dispatchEvent(new Event('chunklab:bridge-ready'));
    return window.ChunkEngine;
  }).catch(function(error){
    _practiceReadyTask = null;
    throw error;
  });
  return _practiceReadyTask;
};
