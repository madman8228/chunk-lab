/**
 * sw-policy.test.js · SW 预缓存策略护栏
 *
 * 为什么单独立一个测试（check-sw.js 管的是「哈希是否一致」，这里管「策略是否还成立」）：
 *   2026-09-10 扩容到 8000 句暴露出一个真 P0 —— sw.js install 用 caches.addAll(PRECACHE)，
 *   而 PRECACHE 里含三个题库文件（8000 句时 oral8000.js 8.25MB）。addAll 是「全有全无」的：
 *   移动网络下极易整体失败 → SW 一个都装不上、离线能力全丢（PWA 的核心卖点）。
 *   修法 = 拆成硬清单（小、原子）+ 软清单（随内容增长、尽力而为、失败不拖垮安装）。
 *
 * 本测试锁的就是这套划分不被后续改动悄悄破坏，尤其是两类高发回归：
 *   A. gen-sw.js 的依赖闭包把题库文件又「自动补全」回原子清单（HTML 里有 <script src>）
 *   B. 有人把软清单从版本哈希里摘掉 → 题库更新后客户端 cache-first 永远命中旧内容
 *      （「改了像没改」，正是 sw.js 版本号机制存在的根本原因）
 *
 * 用法：node sw-policy.test.js    （npm test 串联自动跑）
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname);
const SW = path.join(ROOT, 'sw.js');

let passed = 0, failed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; console.log('  \u2713 ' + name); }
  else { failed++; console.log('  \u2717 ' + name + (detail ? '  \u2192 ' + detail : '')); }
}

const sw = fs.readFileSync(SW, 'utf8');
/* 断言必须只针对代码，不能扫到注释里的散文 ——
   本文件的反面案例：sw.js 的注释里引用了「旧实现是 caches.match('/main.html')」，
   若不剥注释，这条"不得再回退 HTML"的断言会被自己的说明文字判为违规。 */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}
function listOf(name) {
  const m = sw.match(new RegExp('const ' + name + ' = \\[([\\s\\S]*?)\\n\\];'));
  if (!m) return null;
  return (m[1].match(/'([^']+)'/g) || []).map(function (s) { return s.slice(1, -1); });
}
function normalizeCache(src) {
  return src.replace(/^const CACHE = '[^']*';.*$/m, "const CACHE = '<AUTO>';");
}
function sha8(parts) {
  const h = crypto.createHash('sha1');
  parts.forEach(function (p) { h.update(p); });
  return h.digest('hex').slice(0, 8);
}

console.log('【1. 清单存在性与划分】');
const hard = listOf('PRECACHE');
const soft = listOf('PRECACHE_SOFT');
check('sw.js 同时定义 PRECACHE 与 PRECACHE_SOFT', Array.isArray(hard) && Array.isArray(soft),
  'hard=' + (hard && hard.length) + ' soft=' + (soft && soft.length));
check('软清单非空（题库属随内容增长的资产）', soft && soft.length > 0);
check('两清单无交集（同一文件不能既原子又尽力）',
  hard && soft && hard.filter(function (u) { return soft.indexOf(u) >= 0; }).length === 0,
  hard && soft ? hard.filter(function (u) { return soft.indexOf(u) >= 0; }).join(',') : '');
check('软清单含全部题库数据文件',
  soft && ['/builtins.js', '/oral8000.js', '/freq-idioms.js'].every(function (u) { return soft.indexOf(u) >= 0; }),
  soft ? soft.join(',') : '');

console.log('');
console.log('【2. 硬清单必须保持"小"——原子安装不允许有脆弱项】');
const FAT = 512 * 1024;
const sizes = (hard || []).map(function (u) {
  let s = 0;
  try { s = fs.statSync(path.join(ROOT, u.replace(/^\//, ''))).size; } catch (e) { s = -1; }
  return { u: u, s: s };
});
const missingHard = sizes.filter(function (x) { return x.s < 0; });
check('硬清单文件全部存在', missingHard.length === 0, missingHard.map(function (x) { return x.u; }).join(','));
const fat = sizes.filter(function (x) { return x.s > FAT; });
check('硬清单无单文件超 ' + Math.round(FAT / 1024) + 'KB（超了就该移到软清单）', fat.length === 0,
  fat.map(function (x) { return x.u + '(' + Math.round(x.s / 1024) + 'KB)'; }).join(','));
const hardTotal = sizes.reduce(function (a, x) { return a + Math.max(0, x.s); }, 0);
check('硬清单总体积 < 1.5MB（install 的首屏代价）', hardTotal < 1.5 * 1024 * 1024,
  Math.round(hardTotal / 1024) + 'KB');

console.log('');
console.log('【3. install 语义：硬清单原子 + 软清单尽力 且 顺序正确】');
const installBody = (sw.match(/addEventListener\('install'[\s\S]*?\n\}\);/) || [''])[0];
check('install 对硬清单用 addAll（原子语义）', /c\.addAll\(PRECACHE\)/.test(installBody));
check('install 先结转旧缓存再补软清单',
  installBody.indexOf('carryOver(') >= 0 && installBody.indexOf('fillSoft(') >= 0 &&
  installBody.indexOf('carryOver(') < installBody.indexOf('fillSoft('));
check('install 不再把软清单交给 addAll（回归 A 的直接检测）',
  !/addAll\([^)]*PRECACHE_SOFT/.test(installBody));
const fillBody = (sw.match(/function fillSoft[\s\S]*?\n\}/) || [''])[0];
check('fillSoft 逐条容错（单条失败不抛，不影响安装）', /\.catch\(/.test(fillBody));
check('carryOver 只读旧缓存、不发网络请求',
  /function carryOver/.test(sw) &&
  !/fetch\(|\.add\(/.test((sw.match(/function carryOver[\s\S]*?\n\}/) || [''])[0]));
/* 静态资源分支 = navigate 分支之后的部分。先剥注释再定位（见 stripComments 说明）。 */
const fetchBody = (stripComments(sw).match(/addEventListener\('fetch'[\s\S]*?\n\}\);/) || [''])[0];
const _cut = fetchBody.indexOf("if (req.mode === 'navigate')");
const _navEnd = _cut >= 0 ? fetchBody.indexOf('return;', _cut) : -1;
const staticBranch = _navEnd >= 0 ? fetchBody.slice(_navEnd) : '';
check('静态资源分支可定位（sw.js 结构未变）', staticBranch.length > 0 && /c\.match\(req\)/.test(staticBranch));
check('静态资源分支仍限定当前 CACHE（不得退回跨 cache 匹配，防 2026-09-09 旧 core.js 事故）',
  /c\.match\(req\)/.test(staticBranch) && !/caches\.match\(/.test(staticBranch));
check('静态资源分支含"同 CACHE 同 URL"的宽松匹配（修复 .mjs 因请求形状差异全 miss）',
  /c\.match\(url\.href\)/.test(staticBranch));
check('非导航请求网络失败不再回退 HTML（否则报误导性 MIME 错误，把离线缺资源带偏）',
  /return Response\.error\(\);/.test(staticBranch) && !/caches\.match\('\/main\.html'\)/.test(staticBranch));
check('导航请求的 HTML 兜底保留（语义正确）',
  /caches\.match\('\/main\.html'\)/.test(fetchBody));

console.log('');
console.log('【4. 软清单必须计入版本哈希（回归 B 的直接检测）】');
const cacheMatch = sw.match(/^const CACHE = '([^']*)';/m);
const cur = cacheMatch ? cacheMatch[1] : '';
const swNorm = normalizeCache(sw);
function hashFor(urls) {
  const parts = urls.map(function (u) { return fs.readFileSync(path.join(ROOT, u.replace(/^\//, ''))); });
  parts.push(swNorm);
  return sha8(parts);
}
const withSoft = 'chunklab-' + hashFor(hard.concat(soft));
const withoutSoft = 'chunklab-' + hashFor(hard);
check('sw.js 内 CACHE == 「硬+软」哈希（软清单确实参与版本号）', cur === withSoft,
  'CACHE=' + cur + ' 期望=' + withSoft);
check('若摘掉软清单则哈希不同（证明它真的在哈希源里，而非巧合相等）', cur !== withoutSoft,
  'withoutSoft=' + withoutSoft);

console.log('');
console.log('【5. gen-sw.js 不会把软清单补回原子清单（回归 A 的行为验证）】');
try {
  const before = fs.readFileSync(SW, 'utf8');
  execSync('node scripts/gen-sw.js', { cwd: ROOT, stdio: 'pipe' });
  const after = fs.readFileSync(SW, 'utf8');
  const hard2 = ((after.match(/const PRECACHE = \[([\s\S]*?)\n\];/) || [])[1] || '').match(/'([^']+)'/g) || [];
  const names = hard2.map(function (s) { return s.slice(1, -1); });
  const leaked = names.filter(function (u) { return soft.indexOf(u) >= 0; });
  check('跑完 gen-sw 后软清单文件未出现在 PRECACHE', leaked.length === 0, leaked.join(','));
  check('gen-sw 幂等（重跑不改 CACHE）', (after.match(/^const CACHE = '([^']*)';/m) || [])[1] === cur);
  if (before !== after) console.log('    （注：gen-sw 本次改写了 sw.js 格式，已就地更新）');
} catch (e) {
  check('gen-sw 可执行', false, e && e.message);
}

console.log('');
console.log(failed === 0 ? '通过 ' + passed + ' / 0 失败' : '通过 ' + passed + ' / ' + failed + ' 失败');
process.exit(failed === 0 ? 0 : 1);
