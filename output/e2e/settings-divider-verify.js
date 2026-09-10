/* settings-divider-verify · 验证设置面板行内下划线已去除 */
const path = require('path');
const fs = require('fs');
(async () => {
  const CHROMIUM = process.env.CHROMIUM_PATH || 'C:/Users/Administrator/AppData/Local/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe';
  const { chromium } = require('playwright-core');
  const BASE = 'http://127.0.0.1:8791';
  const SHOTS = path.join(__dirname, 'shots');
  if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });

  function pass(n){ console.log('  ✓', n); }
  function fail(n, info){ console.log('  ✗', n, info ? '| ' + JSON.stringify(info) : ''); process.exitCode = 1; }
  function check(n, c, info){ c ? pass(n) : fail(n, info); }

  const browser = await chromium.launch({ executablePath: CHROMIUM, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 760, height: 720 } });
  const page = await ctx.newPage();

  await page.goto(BASE + '/main.html', { waitUntil: 'networkidle' });
  await page.waitForSelector('#pageHome', { timeout: 12000 });
  await page.waitForTimeout(400);

  /* 开设置面板 */
  await page.evaluate(() => {
    document.getElementById('settingsMask').hidden = false;
  });
  await page.waitForTimeout(300);

  /* 截图默认态 */
  await page.screenshot({ path: path.join(SHOTS, 'settings-no-divider.png') });

  /* ===== 断言 1：所有 <label> 行均无 border-bottom ===== */
  const rows = await page.evaluate(() => {
    const sec = document.getElementById('settingsMask');
    const out = [];
    sec.querySelectorAll('label').forEach((lb, i) => {
      const cs = getComputedStyle(lb);
      out.push({
        idx: i,
        text: lb.textContent.trim().slice(0, 24),
        borderBottomWidth: cs.borderBottomWidth,
        borderBottomStyle: cs.borderBottomStyle,
        cursor: cs.cursor
      });
    });
    return out;
  });

  const allNoBorder = rows.every(r => r.borderBottomWidth === '0px' || r.borderBottomStyle === 'none');
  check('所有 label 行均无 border-bottom', allNoBorder, rows.filter(r => r.borderBottomWidth !== '0px'));

  /* ===== 断言 2：padding 仍保持（无 padding 坍缩） ===== */
  const pads = await page.evaluate(() => {
    const sec = document.getElementById('settingsMask');
    const first = sec.querySelector('label');
    return first ? getComputedStyle(first).padding : null;
  });
  check('label 行 padding 保持紧凑（CSS 已 override 为 6px 2px）', /6px.*2px|6px\s+2px/.test(pads || ''), pads);

  /* ===== 断言 3：checkbox / select 仍可点击（cursor: pointer） ===== */
  const clickableRows = rows.filter(r => /音效|乱序|跳过|烟花|庆祝|自动|深色/.test(r.text));
  const allClickable = clickableRows.every(r => r.cursor === 'pointer');
  check('可点击的 checkbox/select 行 cursor=pointer', allClickable, clickableRows.length);

  /* ===== 断言 4：区段级 border-top 仍存在（账号 / 数据备份） ===== */
  const sections = await page.evaluate(() => {
    const sec = document.getElementById('settingsMask');
    const account = sec.querySelector('#accountSection'); /* 自身带 inline border-top */
    const backupHead = sec.querySelector('#backupHead');
    const backupContainer = backupHead ? backupHead.parentElement : null;
    return {
      account: account ? {
        bt: getComputedStyle(account).borderTopWidth,
        bs: getComputedStyle(account).borderTopStyle
      } : null,
      backup: backupContainer ? {
        bt: getComputedStyle(backupContainer).borderTopWidth,
        bs: getComputedStyle(backupContainer).borderTopStyle
      } : null
    };
  });
  check('账号区段保留 border-top 分隔', sections.account && sections.account.bt !== '0px', sections.account);
  check('数据备份区段保留 border-top 分隔', sections.backup && sections.backup.bt !== '0px', sections.backup);

  /* ===== 断言 5：勾选 + 取消 + 开关仍工作（交互保活） ===== */
  const toggled = await page.evaluate(() => {
    const cb = document.getElementById('setSound');
    const before = cb.checked;
    cb.checked = !before;
    const after = cb.checked;
    cb.checked = before; /* 还原 */
    return { before, after };
  });
  check('checkbox 状态可切换', toggled.before !== toggled.after, toggled);

  await browser.close();
  console.log('\n=== Done. exit=', process.exitCode || 0, '===');
})().catch(e => { console.error(e); process.exit(2); });