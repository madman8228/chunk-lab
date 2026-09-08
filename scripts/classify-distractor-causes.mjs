/**
 * scripts/classify-distractor-causes.mjs · 干扰项错因机器预分类（C2-I 数据面）
 *
 * 读三库 distractors，调用 js/distractor-cause.mjs 的 classifySentence 逐句
 * 产出 causes 初稿（机器预分类 → 人工审校，author-review 模式，非运行时兜底）。
 * 分类引擎（纯逻辑 + 单测）在 js/distractor-cause.mjs。
 *
 * 用法：node scripts/classify-distractor-causes.mjs
 * 产出：output/d-causes-raw.json + 控制台分布统计
 */
'use strict';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
import { classifySentence } from '../js/distractor-cause.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function loadItems(file, varName) {
  const code = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  new vm.Script(code).runInContext(sandbox);
  return varName === 'BUILTIN' ? sandbox.window.BUILTIN[0].items : sandbox.window[varName];
}

const FILES = [
  ['freq-idioms.js', 'DATA_FREQ_IDIOMS', 'freq'],
  ['oral8000.js', 'DATA_ORAL8000', 'oral'],
  ['builtins.js', 'BUILTIN', 'daily']
];
const out = { schemaVersion: 1, generatedAt: new Date().toISOString().slice(0, 10), sentences: [] };
const dist = { verb: 0, function: 0, form: 0, semantic: 0 };
let total = 0;

for (const [file, varName, lib] of FILES) {
  const items = loadItems(file, varName);
  items.forEach((it) => {
    if (!it.distractors) return;
    const causes = classifySentence(it);
    causes.forEach((slot) => {
      slot.forEach((e) => { dist[e.c]++; total++; });
    });
    out.sentences.push({ lib, sentence: it.sentence, distractors: it.distractors, causes });
  });
}

fs.mkdirSync(path.join(ROOT, 'output'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'output', 'd-causes-raw.json'), JSON.stringify(out, null, 1));
console.log('总量:', total, '| verb:', dist.verb, '| function:', dist.function, '| form:', dist.form, '| semantic:', dist.semantic);
console.log('分布: verb', (dist.verb / total * 100).toFixed(0) + '%',
  '| function', (dist.function / total * 100).toFixed(0) + '%',
  '| form', (dist.form / total * 100).toFixed(0) + '%',
  '| semantic', (dist.semantic / total * 100).toFixed(0) + '%');
console.log('初稿 → output/d-causes-raw.json');
