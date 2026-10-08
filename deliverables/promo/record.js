/**
 * Chunk Lab 竖屏宣传片录制脚本
 * 流程：Chromium 打开 promo.html(1080x1920) -> Playwright 录制 webm -> ffmpeg 转 H.264 MP4
 * 说明：动画为 18s 实时时间轴；多录 0.6s 后用 ffmpeg 精准裁到 18s。
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const PLAYWRIGHT = 'D:/06-project/chunk-practice/node_modules/playwright';
const DIR = 'D:/06-project/chunk-practice/deliverables/promo';
const OUT = path.join(DIR, 'out');
const HTML = 'file:///' + path.join(DIR, 'promo.html').replace(/\\/g, '/');
const MP4 = 'D:/06-project/chunk-practice/deliverables/chunklab-promo-9x16.mp4';
const DURATION_MS = 18600; // 18s 动画 + 0.6s 缓冲

/** 在 ms-playwright 缓存里找 chromium 可执行文件 */
function findChromium() {
  const base = 'C:/Users/Administrator/AppData/Local/ms-playwright';
  if (!fs.existsSync(base)) return null;
  const dirs = fs.readdirSync(base).filter((d) => d.startsWith('chromium-'));
  for (const d of dirs) {
    const p = path.join(base, d, 'chrome-win', 'chrome.exe');
    if (fs.existsSync(p)) return p;
  }
  return null;
}

(async () => {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  for (const f of fs.readdirSync(OUT)) fs.unlinkSync(path.join(OUT, f)); // 清空上次产物

  const exe = findChromium();
  console.log('chromium: ' + (exe || '(使用 playwright 默认)'));

  const playwright = require(PLAYWRIGHT);
  const browser = await playwright.chromium.launch({
    executablePath: exe || undefined,
    headless: true,
    args: ['--force-device-scale-factor=1', '--hide-scrollbars', '--mute-audio'],
  });
  const context = await browser.newContext({
    viewport: { width: 1080, height: 1920 },
    deviceScaleFactor: 1,
    recordVideo: { dir: OUT, size: { width: 1080, height: 1920 } },
  });
  const page = await context.newPage();

  page.on('console', (m) => { if (m.type() === 'error') console.log('[page error] ' + m.text()); });
  page.on('pageerror', (e) => console.log('[pageerror] ' + e.message));

  console.log('打开页面: ' + HTML);
  await page.goto(HTML, { waitUntil: 'load' });
  // 门控触发：页面完全就绪后才开始动画，消除「加载耗时导致的时钟错位」
  await page.waitForTimeout(600);
  await page.evaluate(() => document.body.classList.add('go'));
  await page.waitForTimeout(DURATION_MS);

  const video = page.video();
  await context.close();          // 关闭后视频才落盘
  await browser.close();

  const webm = await video.path();
  console.log('webm: ' + webm + ' (' + (fs.statSync(webm).size / 1024 / 1024).toFixed(2) + ' MB)');

  // webm -> mp4 (H.264, 精确 18s, 无音轨 —— 画面内文字即字幕，静音观看也成立)
  const args = [
    '-y',
    '-ss', '0.6',        // 裁掉门控期 0.6s，输出即动画 0-18s
    '-i', webm,
    '-t', '18',
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '20',
    '-pix_fmt', 'yuv420p',
    '-r', '30',
    '-vf', 'scale=1080:1920',
    '-an',
    MP4,
  ];
  console.log('转码中: ffmpeg ' + args.join(' '));
  execFileSync('ffmpeg', args, { stdio: 'inherit' });

  const size = fs.statSync(MP4).size / 1024 / 1024;
  console.log('DONE -> ' + MP4 + ' (' + size.toFixed(2) + ' MB)');
})().catch((e) => {
  console.error('FAIL: ' + e.message);
  process.exit(1);
});
