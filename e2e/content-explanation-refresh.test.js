'use strict';

const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..');
const PORT = require('./lib/free-port').freePort(10380, 100);
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-content-explanation-'));
const BASE = 'http://127.0.0.1:' + PORT;
let server;

function startServer() {
  return new Promise(function (resolve, reject) {
    server = spawn(process.execPath, ['index.js'], {
      cwd: path.join(ROOT, 'server'),
      env: Object.assign({}, process.env, {
        CHUNKLAB_DATA_DIR: TMP_DB,
        PORT: String(PORT),
        NODE_ENV: 'test'
      }),
      stdio: 'ignore'
    });
    let tries = 0;
    const timer = setInterval(function () {
      if (server.exitCode !== null) {
        clearInterval(timer);
        reject(new Error('server exit ' + server.exitCode));
        return;
      }
      const req = http.get(BASE + '/api/health', function (res) {
        res.resume();
        if (res.statusCode === 200) {
          clearInterval(timer);
          resolve();
        }
      });
      req.on('error', function () {});
      req.setTimeout(700, function () { req.destroy(); });
      if (++tries > 120) {
        clearInterval(timer);
        reject(new Error('server start timeout'));
      }
    }, 100);
  });
}

function stopServer() {
  if (server) {
    try { server.kill('SIGKILL'); } catch (e) {}
  }
  try { fs.rmSync(TMP_DB, { recursive: true, force: true }); } catch (e) {}
}

function oldLocalMem() {
  return {
    version: 2,
    decks: [{
      id: 'oral-8-39',
      name: '口语3000句 · 谚语、惯用语',
      builtin: true,
      items: [{
        sentence: "All's fair in love and war.",
        translation: '恋爱和战争都是不择手段的。',
        chunks: ["All's fair", 'in love and war.'],
        hints: ['都是公平的', '在爱情和战争中'],
        explanation: { meaning: '旧版本解释' },
        cid: '441327b0'
      }]
    }],
    activeDeckId: 'oral-8-39',
    best: { 'oral-8-39': { lastPlayed: Date.now() } },
    mastered: {},
    deletedItems: {},
    stats: { totalRounds: 0, totalAnswered: 0, bySentence: {}, events: [] },
    settings: { mode: 'choose', sound: false, skipMastered: false },
    progress: {}
  };
}

async function assertCurrentExplanation(page, label) {
  await page.waitForFunction(function () {
    return window.ContentRepo && window.CL && window.mem && window._mainBooted;
  });
  const result = await page.evaluate(async function () {
    await window.ContentRepo.ready;
    const full = await window.ContentRepo.ensureDeck('oral-8-39', window.mem);
    const item = (full.items || []).find(function (x) { return x.cid === '441327b0'; });
    if (!item) throw new Error('目标句子未从当前内容分片加载');
    window.openExplain(full, item);
    return {
      meaning: item.explanation && item.explanation.meaning,
      text: document.querySelector('#explainList').textContent,
      tags: Array.prototype.map.call(document.querySelectorAll('#explainList .exp-tag'), function (el) {
        return (el.textContent || '').trim();
      }),
      savedLearning: window.mem.activeDeckId === 'oral-8-39' &&
        !!(window.mem.best && window.mem.best['oral-8-39'])
    };
  });
  if (!result.meaning || result.meaning.indexOf('目的证明手段合理') === -1) {
    throw new Error(label + ' 未读取当前解释：' + JSON.stringify(result));
  }
  if (result.text.indexOf('目的证明手段合理') === -1 || result.text.indexOf('兵不厌诈') === -1) {
    throw new Error(label + ' 未渲染核心含义或中文对应表达：' + result.text);
  }
  if (result.tags.indexOf('语法速览') !== -1) {
    throw new Error(label + ' 仍渲染已移除的语法速览：' + JSON.stringify(result.tags));
  }
  if (!result.savedLearning) throw new Error(label + ' 学习档案未保留：' + JSON.stringify(result));
}

async function assertFallbackExplanationContract(page) {
  const result = await page.evaluate(function () {
    function collect(item) {
      var sections = window.buildAnalysisSections(item);
      var holder = document.createElement('div');
      holder.innerHTML = window.explanationSectionsHtml(sections);
      return {
        text: holder.textContent || '',
        html: holder.innerHTML,
        tags: Array.prototype.map.call(holder.querySelectorAll('.exp-tag'), function (el) {
          return (el.textContent || '').trim();
        })
      };
    }
    return {
      translationOnly: collect({ sentence: 'Two and three is five.', translation: '二加三等于五。' }),
      structured: collect({
        sentence: 'All is fair.',
        translation: '一切都是公平的。',
        explanation: {
          meaning: '说明在特定语境中的核心意思。',
          equivalents: [{ text: '兵不厌诈', note: '中文对应说法' }],
          usage: '用于说明竞争中的策略。',
          examples: [{ en: 'A fair example.', zh: '一个例句。' }]
        }
      }),
      escaped: collect({ sentence: 'Safe.', explanation: { meaning: '<script>alert(1)</script>' } })
    };
  });
  if (result.translationOnly.tags.indexOf('核心含义') !== -1) {
    throw new Error('只有译文时不应伪装成核心含义：' + JSON.stringify(result.translationOnly));
  }
  if (result.translationOnly.text.indexOf('本句暂无补充讲解') === -1 || result.translationOnly.text.indexOf('惯用表达') !== -1) {
    throw new Error('只有译文时兜底内容不符合约定：' + JSON.stringify(result.translationOnly));
  }
  ['核心含义', '中文对应表达', '常见使用场景', '经典例句'].forEach(function (tag) {
    if (result.structured.tags.indexOf(tag) === -1) throw new Error('结构化讲解缺少 ' + tag + '：' + JSON.stringify(result.structured));
  });
  if (result.structured.text.indexOf('二加三') !== -1 || result.structured.text.indexOf('A fair example.') === -1) {
    throw new Error('结构化讲解错误继承了无关译文或例句：' + JSON.stringify(result.structured));
  }
  if (result.escaped.html.indexOf('&lt;script&gt;') === -1 || result.escaped.html.indexOf('<script>') !== -1) {
    throw new Error('讲解字段未正确转义：' + JSON.stringify(result.escaped));
  }
}

(async function () {
  let browser;
  try {
    await startServer();
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    const saved = oldLocalMem();
    await page.addInitScript(function (value) {
      localStorage.setItem('chunklab.storage-owner.v1', JSON.stringify([location.origin, 'local']));
      localStorage.setItem('chunklab.v1', JSON.stringify(value));
    }, saved);
    await page.goto(BASE + '/main.html?direct=1&content-explanation-refresh=1', { waitUntil: 'domcontentloaded' });
    await assertCurrentExplanation(page, '首次启动');
    await assertFallbackExplanationContract(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await assertCurrentExplanation(page, '刷新后');
    console.log('content-explanation-refresh.test.js passed');
  } finally {
    if (browser) await browser.close();
    stopServer();
  }
})().catch(function (error) {
  console.error(error.stack || error);
  process.exitCode = 1;
});
