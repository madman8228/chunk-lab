/**
 * loadenv.js · 零依赖 .env 加载器（仅开发/自托管时使用）
 *
 * 用法：node -r ./loadenv.js index.js
 * 读取 server/.env（若存在），把其中「尚未设置」的变量注入 process.env。
 * 生产环境由 systemd / 容器 / shell export 注入，无需此文件，也不会影响外部注入的值。
 *
 * 安全：.env 已被 .gitignore 忽略，切勿提交真实密钥；.env.example 才是可提交的模板。
 */
'use strict';
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
  // 没有 .env 也能跑（全部走默认值或外部注入）
  module.exports = {};
} else {
  const text = fs.readFileSync(envPath, 'utf8');
  text.split(/\r?\n/).forEach(function (line) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) return; // 跳过注释/空行
    const key = m[1];
    let val = m[2];
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  });
  module.exports = {};
}
