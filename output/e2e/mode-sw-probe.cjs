'use strict';
const fs = require('fs');
const Module = require('module');
const path = require('path');
const file = path.resolve(__dirname, '../../e2e/ai-course-authoring.test.js');
let source = fs.readFileSync(file, 'utf8');
const reload = "await page.reload({ waitUntil: 'domcontentloaded' });\n    await page.waitForSelector('#stage:not(.hidden)', { timeout: 15000 });";
if (!source.includes(reload)) throw new Error('Reload seam missing');
source = source.replace(reload, `
await page.evaluate(async () => {
  await Promise.race([navigator.serviceWorker.ready, new Promise((_, reject) => setTimeout(() => reject(new Error('SW readiness timeout')), 15000))]);
});
${reload}
console.log('[mode-sw-probe]', JSON.stringify(await page.evaluate(() => ({
  controlled: !!navigator.serviceWorker.controller,
  config: CL.getCloudConfig(), label: document.getElementById('courseModeLabel').textContent,
  mode: S.courseLearning && S.courseLearning.mode
}))));
`);
source = source.replace("await page.locator('#courseModeTrigger').click();", "console.log('[mode-sw-probe] original restoration assertion passed'); return;");
const probe = new Module(file, module);
probe.filename = file;
probe.paths = Module._nodeModulePaths(path.dirname(file));
probe._compile(source, file);
