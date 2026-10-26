'use strict';

const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const output = path.resolve(root, process.env.WORDBOOK_CAMBRIDGE_PREVIEW_OUTPUT || 'output/wordbook-us-ipa-cambridge-20261026-v3');
const report = JSON.parse(fs.readFileSync(path.join(output, 'report.json'), 'utf8'));
const bookId = process.env.WORDBOOK_CAMBRIDGE_PREVIEW_BOOK || 'textbook-wordbook:primary-pep-grade3-upper-20261014';
const bookRow = report.books.find(row => row.bookId === bookId);
if (!bookRow) throw Error('Preview book is not in the Cambridge candidate set');
const packagePath = path.join(output, bookRow.path);
const candidate = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
if (candidate.published !== false || candidate.index?.books?.[0]?.bookId !== bookId) throw Error('Preview candidate identity or publication state is invalid');

const extraScripts = [
  'js/learning-sky.js', 'js/notice-banner.js', 'js/learning-navigation.js',
  'js/course-return.js', 'js/course-learning-header.js', 'landing/listen-word-view.js',
  'js/vocabulary-sentence-audio.js', 'js/vocabulary-word-dictation.js', 'landing/vocabulary-course-audio.js',
  'js/vocabulary-course-contract.js', 'landing/sentence-cloze-engine.js',
  'landing/guided-sentence-content.js'
];
const types = { '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp', '.ogg': 'audio/ogg' };
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function allowMedia(items) {
  const roots = [
    path.join(root, 'assets'),
    path.join(root, 'output/wordbook-phonetics-en-gb-audio-20261026-v1/assets')
  ];
  const allowed = new Map();
  function register(ref, expectedHash, expectedBytes, kind) {
    if (!ref || !/^assets\/[A-Za-z0-9._-]+\.(?:ogg|webp|png)$/.test(ref)) return;
    const filename = path.basename(ref);
    const file = roots.map(base => path.join(base, filename)).find(value => fs.existsSync(value));
    if (!file) return;
    const bytes = fs.readFileSync(file), actual = hash(bytes);
    const filenameHash = filename.match(/^([a-f0-9]{64})\./)?.[1];
    if (expectedBytes && bytes.byteLength !== expectedBytes) throw Error(`Media byte count mismatch: ${filename}`);
    if (expectedHash && actual !== expectedHash) throw Error(`Media hash mismatch: ${filename}`);
    if (filenameHash && actual !== filenameHash) throw Error(`Media filename hash mismatch: ${filename}`);
    if (kind === 'image' && bytes.byteLength >= 20000) throw Error(`Illustration exceeds 20 KB: ${filename}`);
    allowed.set('/' + ref, { file, type: types[path.extname(filename)] || 'application/octet-stream' });
  }
  for (const item of items) {
    for (const ref of [...(item.images?.wide || []), ...(item.images?.mobile || [])]) register(ref, null, null, 'image');
    const activity = item.learning?.sentenceAudio;
    if (!activity) continue;
    for (const clip of [activity.audio, ...Object.values(activity.audioByAccent || {})]) register(clip.url, clip.sha256, clip.bytes, 'audio');
  }
  return allowed;
}

function safeJson(value) { return JSON.stringify(value).replace(/</g, '\\u003c'); }

function buildHtml(items) {
  const sourceHtml = fs.readFileSync(path.join(root, 'wordbook.html'), 'utf8').replace(/<script\b[\s\S]*?<\/script>/gi, '');
  const banner = '<p class="cambridge-preview-banner">未发布审核预览 · 只读，不保存学习记录</p><div id="noticeBannerRail"></div>';
  const marked = sourceHtml.replace('<div id="noticeBannerRail"></div>', banner);
  const css = '<style>.cambridge-preview-banner{position:sticky;top:0;z-index:20;margin:0;padding:10px 16px;background:#fff4cc;color:#60430a;text-align:center;font-size:14px;font-weight:700;border-bottom:1px solid #e5c870}.listen-word-view{margin-top:18px!important}</style>';
  const scripts = extraScripts.map(file => `<script src="/${file}"></script>`).join('');
  const adapter = `<script>
    window.__cambridgePreviewData=${safeJson(items)};
    window.__cambridgePreviewItems=new Map(window.__cambridgePreviewData.map(item=>[item.itemId,item]));
    window.__cambridgePreviewWrites=0;
    window.ChunkAPI={getToken:()=>"isolated-cambridge-preview",request:async url=>{
      if(url.includes("/items?")){const query=new URLSearchParams(url.split("?")[1]||"");const offset=Math.max(0,Number(query.get("offset")||0));const limit=Math.max(1,Number(query.get("limit")||20));return {title:${safeJson(bookRow.title + ' · 美式音标审核预览')},revision:"preview-only",itemCount:window.__cambridgePreviewData.length,items:window.__cambridgePreviewData.slice(offset,offset+limit).map(item=>({itemId:item.itemId,contentRevision:item.contentRevision}))};}
      const match=url.match(/^\\/api\\/vocabulary-items\\/([^?]+)/);if(match){const item=window.__cambridgePreviewItems.get(decodeURIComponent(match[1]));if(item)return structuredClone(item);}
      if(url.startsWith("/api/")){window.__cambridgePreviewWrites++;throw Error("预览服务不提供持久化接口");}
      throw Error("预览适配器拒绝未列出的请求");
    }};
    window.LearningSessionBootstrap={identity:()=>"isolated-cambridge-preview"};
    window.VocabularyUnitCache={create:async()=>null};
    window.VocabularyStudyStore={useUnit:()=>{}};
    window.LearningWorkspaceStore={word:async()=>false};
    window.VocabularyWordDictationView={};window.VocabularyWordChoiceView={};window.VocabularyChunkOrderView={};window.VocabularyReadAloudView={};
    document.getElementById("wordbookNavigation").replaceWith(LearningNavigation.create());
  </script>`;
  return marked.replace('</body>', css + scripts + adapter + '<script src="/landing/wordbook-study.js"></script></body>');
}

function createPreviewServer() {
  const itemById = new Map(candidate.items.map(item => [item.itemId, item]));
  const items = candidate.index.books[0].items.map(ref => {
    const item = itemById.get(ref.itemId);
    if (!item || item.contentRevision !== ref.contentRevision) throw Error(`Preview index reference mismatch: ${ref.itemId}`);
    return item;
  });
  const media = allowMedia(items);
  const staticFiles = new Set([
    'assets/ui-tokens.css', 'landing/theme.css', 'landing/practice-page.css',
    'assets/learning-workspace.css', 'assets/learning-sky.css', 'assets/wordbook-study.css',
    'assets/chunk-selection.css', 'assets/learning-navigation.css', 'assets/course-learning-header.css',
    'assets/listen-word.css', 'assets/membership-study.css', 'assets/brand/icon-32-v1.png', 'assets/jqka-learning-garden-body-v1.webp',
    ...extraScripts, 'landing/wordbook-study.js'
  ]);
  const html = buildHtml(items);
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (req.method !== 'GET') { res.writeHead(405).end(); return; }
    if (url.pathname === '/' || url.pathname === '/wordbook.html') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }).end(html); return;
    }
    const asset = media.get(url.pathname);
    if (asset) { res.writeHead(200, { 'content-type': asset.type, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }); fs.createReadStream(asset.file).pipe(res); return; }
    const relative = decodeURIComponent(url.pathname.slice(1));
    if (staticFiles.has(relative)) {
      const file = path.resolve(root, relative);
      if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) { res.writeHead(404).end(); return; }
      if (relative === 'landing/wordbook-study.js') {
        const isolated = fs.readFileSync(file, 'utf8')
          .replace('let listeningAutoplay=true,', 'let listeningAutoplay=false,')
          .replace('getFavorite:()=>LearningWorkspaceStore.word(bookId,item.itemId),onFavorite:()=>LearningWorkspaceStore.word(bookId,item.itemId,true)', 'getFavorite:undefined,onFavorite:undefined');
        res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }).end(isolated); return;
      }
      res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }); fs.createReadStream(file).pipe(res); return;
    }
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Not available in isolated review preview');
  });
  return { server, items, mediaCount: media.size };
}

if (require.main === module) {
  const { server, items, mediaCount } = createPreviewServer();
  server.listen(0, '127.0.0.1', () => {
    console.log(`只读候选预览：http://127.0.0.1:${server.address().port}/wordbook.html?book=${encodeURIComponent(bookId)}`);
    console.log(`词条 ${items.length}；已核验白名单媒体 ${mediaCount} 个；只监听本机，关闭此进程即可停止。`);
  });
}

module.exports = { createPreviewServer, bookId, candidate };
