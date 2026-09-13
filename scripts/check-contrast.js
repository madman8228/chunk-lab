#!/usr/bin/env node
/* WCAG 对比度护栏：断言各页面主题里的文字 token 对其所有可能背景 >= 4.5:1。
 *
 * 为什么需要这道闸：
 *   `--faint:#9a958c` 曾长期作为「辅助小字」色，对 --surface(#fffdfa) 只有 2.93:1，
 *   而 var(--faint) 在实际产品里有 77 处（main 46 / decks 25 / stats 6），
 *   绝大多数是 11-13px 正文级小字 -> 属于实质性可读性缺陷，不是审美偏好。
 *   任何色板改动都必须过这道闸，否则同样的回归会再发生一次。
 *
 * 判定口径：
 *   1) 每个文件里 `:root{...}` = light 主题，`.dark{...}` = dark 主题；
 *   2) 该主题块内声明的背景 token（--bg、--surface、--surface-2、--paper、--card 等）互为候选背景；
 *   3) light 主题额外把同文件 `body`/`html` 规则里渐变函数的硬编码色标视为候选背景
 *      （main.html 的 body 顶部渐变才是真实最暗背景，忽略它会漏判）。
 *      只认 body/html 规则：按钮/进度条的装饰渐变不是文字背景，算进去会假红。
 *      dark 主题不加渐变：深色模式下那层浅色渐变会与深底合成，拿原色标比较是假红。
 *   4) 文字 token 取该主题内「对所有候选背景」的最小对比度，要求 >= 4.5:1。
 *
 * 用法：
 *   node scripts/check-contrast.js              -> 全部通过 exit 0，否则 exit 1
 *   node scripts/check-contrast.js --selftest   -> 把 --faint 换回旧值 #9a958c，
 *                                                  要求护栏「必须变红」；没变红则 exit 1
 *                                                  （负向自证：证明这道闸真的能拦）
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const THRESHOLD = 4.5;
const TEXT_TOKENS = ['--text', '--ink', '--muted', '--faint', '--accent', '--ok', '--green', '--bad', '--warn'];
const BG_PREFIXES = ['--bg', '--surface', '--paper', '--card'];
const SCAN_FILES = ['main.html', 'decks.html', 'stats.html', 'courses.html', 'diagnose.html'];
const KNOWN_BAD_FAINT = '#9a958c';

/* ---------- WCAG 2.1 相对亮度 ---------- */
function srgb(c) {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}
function luminance(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error('不是 6 位 hex：' + hex);
  const n = parseInt(m[1], 16);
  return 0.2126 * srgb((n >> 16) & 255) + 0.7152 * srgb((n >> 8) & 255) + 0.0722 * srgb(n & 255);
}
function contrast(a, b) {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/* ---------- 解析 ---------- */
function tokenMap(block) {
  const out = {};
  const re = /(--[a-z0-9-]+)\s*:\s*(#[0-9a-f]{6})\b/gi;
  let m;
  while ((m = re.exec(block))) out[m[1].toLowerCase()] = m[2].toLowerCase();
  return out;
}

/* 按顺序取出 :root{...} / .dark{...} 区块（块内无嵌套花括号） */
function themeBlocks(css) {
  const out = [];
  const re = /(^|[\s{};,])(:root|\.dark)\s*\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(css))) {
    out.push({ selector: m[2], kind: m[2] === '.dark' ? 'dark' : 'light', body: m[3] });
  }
  return out;
}

/* 页面级背景渐变里硬编码的色标（仅 body/html 规则，避免把按钮/进度条的
   装饰渐变误当成页面背景 -> 假红）。只用于 light 主题的额外背景候选。 */
function gradientStops(css) {
  const out = new Set();
  const rule = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = rule.exec(css))) {
    const sel = m[1].trim();
    if (sel !== 'body' && sel !== 'html') continue;
    const g = /(?:radial|linear|conic)-gradient\(([^;{}]*)\)/gi;
    let g2;
    while ((g2 = g.exec(m[2]))) {
      const hexes = g2[1].match(/#[0-9a-f]{6}\b/gi) || [];
      hexes.forEach((h) => out.add(h.toLowerCase()));
    }
  }
  return Array.from(out);
}

/* ---------- 主流程 ---------- */
function collect(selftest) {
  const rows = [];
  const violations = [];
  SCAN_FILES.forEach((file) => {
    const abs = path.join(ROOT, file);
    if (!fs.existsSync(abs)) return;
    const css = fs.readFileSync(abs, 'utf8');
    const stops = gradientStops(css);
    themeBlocks(css).forEach((theme, idx) => {
      const tokens = tokenMap(theme.body);
      if (selftest && tokens['--faint']) tokens['--faint'] = KNOWN_BAD_FAINT;
      let backgrounds = Object.keys(tokens)
        .filter((k) => BG_PREFIXES.some((p) => k === p || k.indexOf(p + '-') === 0))
        .map((k) => ({ name: k, hex: tokens[k] }));
      if (theme.kind === 'light') {
        backgrounds = backgrounds.concat(stops.map((h) => ({ name: 'gradient', hex: h })));
      }
      if (!backgrounds.length) return;
      TEXT_TOKENS.forEach((tk) => {
        const hex = tokens[tk];
        if (!hex) return;
        let worst = null;
        backgrounds.forEach((bg) => {
          const r = contrast(hex, bg.hex);
          if (!worst || r < worst.ratio) worst = { ratio: r, bg: bg.name, bgHex: bg.hex };
        });
        const row = {
          file,
          theme: theme.selector + (idx > 0 ? '#' + (idx + 1) : ''),
          token: tk,
          hex,
          worstBg: worst.bg + ' ' + worst.bgHex,
          ratio: worst.ratio,
        };
        rows.push(row);
        if (worst.ratio < THRESHOLD) violations.push(row);
      });
    });
  });
  return { rows, violations };
}

function fmt(n) { return n.toFixed(2); }

function main() {
  const selftest = process.argv.indexOf('--selftest') >= 0;
  const { rows, violations } = collect(selftest);

  if (selftest) {
    if (violations.length) {
      const v = violations[0];
      console.log('--selftest OK：注入旧值 ' + KNOWN_BAD_FAINT + ' 后护栏变红（' +
        v.file + ' ' + v.token + ' 对 ' + v.worstBg + ' = ' + fmt(v.ratio) + ':1），说明这道闸有效。');
      return 0;
    }
    console.error('--selftest FAILED：注入已知坏值 ' + KNOWN_BAD_FAINT + ' 后护栏竟然全绿 —— 这道闸拦不住回归。');
    return 1;
  }

  rows.forEach((r) => {
    const flag = r.ratio < THRESHOLD ? ' ✗' : '';
    console.log((r.ratio < THRESHOLD ? '[FAIL] ' : '[ ok ] ') + r.file + ' ' + r.theme + ' ' +
      r.token + ' ' + r.hex + ' vs ' + r.worstBg + ' = ' + fmt(r.ratio) + ':1' + flag);
  });

  if (violations.length) {
    console.error('\n对比度护栏未通过：' + violations.length + ' 项低于 WCAG AA ' + THRESHOLD + ':1');
    violations.forEach((v) => {
      console.error('  - ' + v.file + ' ' + v.theme + ' ' + v.token + ' ' + v.hex +
        ' 对 ' + v.worstBg + ' 仅 ' + fmt(v.ratio) + ':1（缺 ' + fmt(THRESHOLD - v.ratio) + '）');
    });
    return 1;
  }
  console.log('\n对比度护栏通过：' + rows.length + ' 项文字 token × 背景组合全部 >= ' + THRESHOLD + ':1');
  return 0;
}

process.exit(main());
