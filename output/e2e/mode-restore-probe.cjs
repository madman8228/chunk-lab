'use strict';
const fs = require('fs');
const Module = require('module');
const path = require('path');
const file = path.resolve(__dirname, '../../e2e/ai-course-authoring.test.js');
let source = fs.readFileSync(file, 'utf8');
if (process.env.MODE_PROBE_CPU) {
  source = source.replace('const page = await context.newPage();',
    'const page = await context.newPage(); const diagnosticCdp = await context.newCDPSession(page); await diagnosticCdp.send("Emulation.setCPUThrottlingRate", {rate:4});');
}
if (process.env.MODE_PROBE_DELAY) {
  source = source.replace('const page = await context.newPage();',
    `const page = await context.newPage();
    await page.route('**/js/chunk-engine.mjs', async route => {
      await new Promise(resolve => setTimeout(resolve, 2000));
      await route.continue();
    });`);
}
const needle = "if (await page.locator('#courseModeLabel').innerText() !== '意群选择') throw new Error('刷新后没有恢复该课程上次选择的练习方式');";
if (!source.includes(needle)) throw new Error('Diagnostic seam missing');
source = source.replace(needle, `
console.log('[mode-probe immediate]', JSON.stringify(await page.evaluate(() => ({
  label: document.getElementById('courseModeLabel').textContent,
  deck: S.deck && S.deck.id,
  courseLearning: S.courseLearning,
  progress: mem.progress
}))));
await page.waitForFunction(() => document.getElementById('courseModeLabel').textContent === '意群选择', undefined, { timeout: 10000 });
console.log('[mode-probe settled] restored');
return;
`);
const probe = new Module(file, module);
probe.filename = file;
probe.paths = Module._nodeModulePaths(path.dirname(file));
probe._compile(source, file);
