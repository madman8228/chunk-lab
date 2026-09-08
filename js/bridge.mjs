/**
 * bridge.mjs · ESM → 全局桥接（ADR-007 Step 1）
 *
 * main.html 的内联脚本是普通 script（onclick 属性依赖全局函数，不能直接转 module），
 * 故通过本 module 把 ESM 纯逻辑模块挂到 window，供内联脚本的包装器调用。
 * module 脚本默认 defer，会在普通内联脚本之后执行；但业务调用都发生在
 * 用户交互 / CL.ensureCloud().then 的异步初始化里，届时 window.ChunkEngine 必已就绪。
 */
import * as ChunkEngine from './chunk-engine.mjs';
import * as FormatTools from './format.mjs';
import * as AIPrompts from './ai-prompts.mjs';
import * as BackupTools from './backup.mjs';
import * as CauseTools from './distractor-cause.mjs';

window.ChunkEngine = ChunkEngine;
window.FormatTools = FormatTools;
window.AIPrompts = AIPrompts;
window.BackupTools = BackupTools;
window.CauseTools = CauseTools;
