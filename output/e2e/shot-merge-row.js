'use strict';
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const SHOTS = path.join(__dirname, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ||
      'C:/Users/Administrator/AppData/Local/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe'
  });

  const seed = `
localStorage.clear();
localStorage.setItem('chunklab.v1', JSON.stringify({
  version: 2, reinforceBook: [],
  decks: [
    { id: 'daily', name: '日常对话', items: [
      { sentence: 'I would like to check in please.', translation: '想', chunks: ['I would like to', 'check in', 'please.'], hints: ['', '', ''], cid: 'a' },
      { sentence: 'Have a nice weekend.', translation: '周末', chunks: ['Have a', 'nice weekend.'], hints: ['', ''], cid: 'd' }
    ] },
    { id: 'freq', name: '高频短语', items: [
      { sentence: 'How much does it cost?', translation: '多少', chunks: ['How much', 'does it cost?'], hints: ['', ''], cid: 'a' },
      { sentence: 'I am on my way.', translation: '路上', chunks: ['I am', 'on my way.'], hints: ['', ''], cid: 'b' }
    ] }
  ],
  best: { 'daily': { acc: 0, lastPlayed: Date.now() - 86400000 }, 'freq': { acc: 100, lastPlayed: Date.now() - 172800000 } },
  mastered: {}, deletedItems: {},
  stats: {
    totalRounds: 3, totalAnswered: 5,
    bySentence: { 'daily#a': { times: 1, okTimes: 0, wrongTimes: 1, streak: 0, maxStreak: 0, lastAt: Date.now() } },
    events: [],
    daysLog: (function(){ var log = {}, today = new Date(); [[0,1],[2,2],[5,3]].forEach(function(p){ var d = new Date(today); d.setDate(d.getDate()-p[0]); var y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), dd = String(d.getDate()).padStart(2,'0'); log[y+'-'+m+'-'+dd] = { rounds: p[1] }; }); return log; })()
  },
  settings: { mode: 'choose', shuffle: false, skipMastered: false, batchSize: 10, fxStack: true, celebrate: 'confetti', autoSpeak: false, sound: false }
}));`;

  /* 桌面截图（1280 宽）*/
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.addInitScript({ content: seed });
    const page = await ctx.newPage();
    await page.goto('http://localhost:8896/main.html', { waitUntil: 'networkidle' });
    await page.waitForSelector('.merge-row', { timeout: 10000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SHOTS, 'merge-row-desktop.png'), fullPage: false });
    await ctx.close();
  }
  /* 移动截图（375 宽）*/
  {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 800 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await ctx.addInitScript({ content: seed });
    const page = await ctx.newPage();
    await page.goto('http://localhost:8896/main.html', { waitUntil: 'networkidle' });
    await page.waitForSelector('.merge-row', { timeout: 10000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SHOTS, 'merge-row-mobile.png'), fullPage: false });
    await ctx.close();
  }
  await browser.close();
  console.log('done');
})();