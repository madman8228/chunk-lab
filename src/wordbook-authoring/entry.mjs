import { BrowserIO } from '../course-authoring/adapters/browser-io.mjs';
import { BrowserAuthoringSessionRepository } from '../course-authoring/adapters/session-repository.mjs';
import { ResilientSessionRepository } from '../course-authoring/adapters/resilient-session-repository.mjs';
import { fingerprint, composePrompt, parseBatch, appendBatch, identifyImport, importDifference } from './model.mjs';
import { isSavedSession, recentUnfinishedSession } from './session-state.mjs';
import '../vocabulary-material-library/browser.mjs';

const $ = id => document.getElementById(id);
const node = (tag, text) => { const element = document.createElement(tag); if (text !== undefined) element.textContent = text; return element; };
const io = new BrowserIO(), guard = io.guard(), scope = guard.capture();
const repository = new ResilientSessionRepository({ primary: new BrowserAuthoringSessionRepository({ scopeGuard: guard, databaseSuffix: '-wordbook-authoring-v1' }) });
const dependencies = { draftModel: window.WordbookDraft, engine: window.JQKAClozeEngine };
let session, review = null, queue = Promise.resolve(), ready = false, busy = false, applying = false, pending = 0, timer = null, nextFocus = '';
let courseOptions = null;
let savedComplete = false;
const status = text => { $('bookAIStatus').textContent = text; };
const readSettings = () => ({ level: '', batchCount: 20, dialogue: true });
const readSource = () => session?.source || '';

// A tab can retain older HTML while an updated worker begins serving scripts.
// Copying a prompt must not depend on an optional presentation-only wrapper.
function setReceive(open, text) {
  const wrapper = $('bookAIReceive'), summary = $('bookAIReceiveSummary');
  if (wrapper?.tagName === 'DETAILS') wrapper.open = open;
  if (summary && text) summary.textContent = text;
}

function setupPageUpdates() {
  // Honor native hidden state even when a retained stylesheet overrides it.
  const style = node('style'); style.textContent = '.book-create [hidden]{display:none!important}'; document.head.append(style);
  if (!navigator.serviceWorker) return;
  navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then(registration => registration.update()).catch(() => {});
}

function enqueue(action) {
  pending++;
  const result = queue.then(() => { guard.assert(scope); return action(); });
  queue = result.catch(() => {}).finally(() => { pending--; });
  return result;
}

async function persist(patch = {}) {
  const next = { ...session, draft: WordbookWorkbench.snapshot(), ...patch, revision: session.revision + 1, updatedAt: Date.now() };
  await repository.save(next, scope, session.revision);
  session = next;
  savedComplete = await isSavedSession(session);
  showPersistence();
}

function showPersistence() {
  const warning = repository.persistenceWarning;
  $('bookAIPersistence').textContent = warning ? '本机保存暂不可用，请保持本页打开，并先保留 AI 对话中的原结果。' : savedComplete ? '已保存，可以开始学习；也可以继续追加新内容。' : '';
  $('bookAIPersistence').hidden = !warning && !savedComplete;
}

function sync() {
  const active = ready && !busy;
  $('bookAIWorkbench').setAttribute('aria-busy', String(!active));
  for (const id of ['copyBookPrompt', 'copyBookContinue', 'checkBookAIResult', 'copyBookRepair']) $(id).disabled = !active;
  $('bookAIResult').disabled = !active;
  if($('chooseAIFile')) $('chooseAIFile').disabled = !active;
  if($('exportBookFile')) $('exportBookFile').disabled = !active || !WordbookWorkbench.snapshot().items.length;
  $('acceptBookAIBatch').disabled = !active || !review?.ok;
  document.querySelectorAll('[data-book-adjust]').forEach(button => { button.disabled = !active || !review?.ok; });
  const draft = WordbookWorkbench.snapshot();
  if ($('bookCourseAssociationSummary')) {
    const ids = draft.book.relatedCourseIds || [], locked = !!session?.savedPersonal && session.savedSourceBookId === draft.book.bookId;
    $('bookCourseAssociationSummary').textContent = ids.length ? '关联课程 · 已选 ' + ids.length + ' 门' : '关联课程（可选）';
    $('bookCourseOptions').querySelectorAll('input').forEach(input => { if (!busy) input.checked = ids.includes(input.value); input.disabled = !active || locked; });
    $('reloadBookCourses').disabled = !active;
  }
  const saveButton = $('savePersonalWordbook'), studyLink = $('studyPersonalWordbook');
  if (saveButton) { saveButton.hidden = !draft.items.length || savedComplete || !!review?.ok; saveButton.disabled = !active; }
  if (studyLink) { studyLink.hidden = !session?.savedPersonal || session.savedSourceBookId !== draft.book.bookId; if (session?.savedPersonal) studyLink.href = 'wordbook.html?book=' + encodeURIComponent(session.savedPersonal.bookId); }
  $('copyBookPrompt').hidden = draft.items.length > 0;
  $('copyBookContinue').hidden = !draft.items.length;
  $('copyBookContinue').textContent = '复制追加指令，去 AI 继续';
  if($('bookCurrentEmpty')) $('bookCurrentEmpty').hidden=!!draft.items.length;
  if($('bookMyContent')) $('bookMyContent').hidden=!session?.savedPersonal;
  if($('bookLogin')) $('bookLogin').hidden=!draft.items.length||!!window.ChunkAPI?.getToken();
  if($('acceptBookAIBatch')) $('acceptBookAIBatch').textContent = draft.items.length ? '确认追加并保存' : '确认并保存为课程';
  $('bookAIAccepted').hidden = !draft.items.length;
  if (draft.items.length) {
    const summary = node('details'), title = node('summary', draft.book.title + (savedComplete ? ' · 已保存 ' : ' · 已确认 ') + draft.book.units.length + ' 个单元、' + draft.items.length + ' 个词');
    summary.append(title);
    const list = node('ul');
    const grouped = new Map();
    draft.items.forEach(item => { if (!grouped.has(item.unitId)) grouped.set(item.unitId, []); grouped.get(item.unitId).push(item); });
    for (const unit of draft.book.units.slice(-30)) {
      const items = grouped.get(unit.unitId) || [];
      list.append(node('li', unit.title + '：' + items.slice(0, 30).map(item => item.word).join('、') + (items.length > 30 ? '等' : '')));
    }
    if (draft.book.units.length > 30) list.prepend(node('li', '展示最近 30 个单元，其他内容仍完整保留。'));
    summary.append(list); $('bookAIAccepted').replaceChildren(summary);
  }
}

async function copyPrompt(text, message) {
  $('bookAIPromptText').value = text;
  try { await io.clipboard.write(text); $('bookAIPromptFallback').hidden = true; status(message); }
  catch (_) { guard.assert(scope); $('bookAIPromptFallback').hidden = false; $('bookAIPromptText').focus(); $('bookAIPromptText').select(); status('浏览器未能自动复制。请复制已选中的指令，粘贴给你常用的 AI。'); }
}

function clearReview() { review = null; $('bookAIReview').hidden = true; }

async function issuePrompt(options = {}) {
  const draft = WordbookWorkbench.snapshot();
  const context = { requestId: io.newId(), baseFingerprint: await fingerprint(draft), settings: readSettings(), source: readSource() };
  const text = composePrompt(context, draft, options);
  await persist({ context, settings: context.settings, source: context.source, rawResult: $('bookAIResult').value });
  clearReview(); $('copyBookRepair').hidden = true;
  setReceive(true, '粘贴 AI 返回的结果');
  await copyPrompt(text, draft.items.length ? '下一批指令已复制。到 AI 中确认新单元，再把新结果粘贴回来。' : '制作指令已复制。到 AI 中按选项确认，再把最终结果粘贴回来。');
}

function showReview(result) {
  review = result;
  if (!result.ok) {
    $('bookAIReview').hidden = true; $('copyBookRepair').hidden = false;
    setReceive(true);
    status('这批还需要 AI 修改：\n' + result.issues.slice(0, 10).join('\n') + '\n点击“复制修复指令”，交给 AI 处理后重新粘贴。');
    return;
  }
  $('copyBookRepair').hidden = true;
  $('bookAIPromptFallback').hidden = true; setReceive(false, '这批内容已检查 · 重新粘贴结果');
  $('bookAIReviewTitle').textContent = result.batch.unitTitle + ' · ' + result.batch.items.length + ' 个词';
  const list = node('ul');
  result.batch.items.forEach((item, index) => {
    const row = node('li'), copy = node('div'); copy.append(node('strong', item.word + ' · ' + item.meaning), node('p', dependencies.engine.sentence(result.exercises[index])), node('p', item.translation));
    const preview = node('button', '试学'); preview.type = 'button'; preview.onclick = () => WordbookWorkbench.previewItem({ word: item.word, meaning: item.meaning, translation: item.translation, exercise: result.exercises[index] });
    row.append(copy, preview); list.append(row);
  });
  $('bookAIReviewItems').replaceChildren(list); $('bookAIReview').hidden = false;
  nextFocus = 'bookAIReviewTitle';
  status('检查通过。请看一遍下方内容，确认后即可保存为课程。');
}

async function checkResult() {
  const draft = WordbookWorkbench.snapshot(), raw = $('bookAIResult').value;
  if(!raw.trim()){status('请先粘贴 AI 的完整结果，或选择 AI 导出的 JSON 文件。');return;}
  await persist({ rawResult: raw });
  if (session.context && await fingerprint(draft) !== session.context.baseFingerprint) {
    showReview({ ok: false, issues: ['草稿已变化，请复制新指令，让 AI 基于当前内容继续制作。'] }); return;
  }
  showReview(parseBatch(raw, session.context, draft, dependencies));
}

function scheduleSave(invalidate = false) {
  clearReview(); $('copyBookRepair').hidden = true; sync();
  clearTimeout(timer);
  // Keep invalidation effective across the following paste event in the same debounce window.
  scheduleSave.invalidate = scheduleSave.invalidate || invalidate;
  timer = setTimeout(() => {
    timer = null; const invalidateContext = scheduleSave.invalidate; scheduleSave.invalidate = false;
    enqueue(() => persist({ rawResult: $('bookAIResult').value, settings: readSettings(), source: readSource(), ...(invalidateContext ? { context: null } : {}) }))
      .catch(error => status(error.message));
  }, 200);
}

async function flushInput() {
  if (timer) {
    clearTimeout(timer); timer = null; const invalidateContext = scheduleSave.invalidate; scheduleSave.invalidate = false;
    await enqueue(() => persist({ rawResult: $('bookAIResult').value, settings: readSettings(), source: readSource(), ...(invalidateContext ? { context: null } : {}) }));
  }
  await queue;
}

async function run(action) {
  if (!ready || busy) return;
  busy = true; sync();
  try { await flushInput(); await enqueue(action); }
  catch (error) { status(error.message + '。当前内容保留。'); }
  finally { busy = false; sync(); if (nextFocus) { const target = $(nextFocus); nextFocus = ''; target.focus(); target.scrollIntoView({ block: 'nearest' }); } }
}

async function loadCourseOptions() {
  const area = $('bookCourseOptions'), message = $('bookCourseStatus');
  if (!window.ChunkAPI?.getToken()) { message.textContent = '请先在主页登录，再读取课程；不关联也可继续制作。'; return; }
  message.textContent = '正在读取可选课程…';
  try {
    const result = await ChunkAPI.request('/api/personal-wordbooks/course-options', { timeoutMs: 12000 });
    guard.assert(scope);
    if (!Array.isArray(result?.courses) || result.courses.some(course => !/^course:[A-Za-z0-9:._-]{1,193}$/.test(course.resourceId) || typeof course.title !== 'string')) throw new Error('课程列表格式不完整');
    courseOptions = result.courses; area.replaceChildren();
    for (const course of courseOptions) {
      const label = node('label'), input = node('input'); input.type = 'checkbox'; input.value = course.resourceId;
      input.onchange = () => { const checked = input.checked; return run(async () => {
        const draft = WordbookWorkbench.snapshot(), ids = [...(draft.book.relatedCourseIds || [])];
        if (session.savedPersonal && session.savedSourceBookId === draft.book.bookId) throw new Error('已保存版本的关联保持不变');
        const next = checked ? [...new Set([...ids, course.resourceId])] : ids.filter(id => id !== course.resourceId);
        if (next.length > 20) throw new Error('最多关联 20 门课程');
        draft.book.relatedCourseIds = next;
        await persist({ draft, context: null, rawResult: $('bookAIResult').value });
        applying = true; try { WordbookWorkbench.applyDraft(draft); } finally { applying = false; }
        WordbookWorkbench.markSaved(); clearReview(); status('关联已更新，请复制新指令后继续制作。');
      }); };
      label.append(input, node('span', course.title)); area.append(label);
    }
    const unavailable = (WordbookWorkbench.snapshot().book.relatedCourseIds || []).filter(id => !courseOptions.some(course => course.resourceId === id));
    message.textContent = unavailable.length ? unavailable.length + ' 门原关联课程暂不可用，引用仍保留。' : courseOptions.length ? '' : '暂无可关联课程；可以直接制作独立单词本。';
    $('reloadBookCourses').textContent = '重新读取课程';
  } catch (error) {
    guard.assert(scope); message.textContent = error.status === 404 ? '当前服务尚未启用课程关联；可先继续制作，草稿保留。' : '课程读取失败，可重新读取；已有选择保留。';
  }
}
if ($('bookCourseAssociation')) {
  $('bookCourseAssociation').addEventListener('toggle', () => { if ($('bookCourseAssociation').open && ready && !courseOptions) run(loadCourseOptions); });
  $('reloadBookCourses').onclick = () => run(loadCourseOptions);
}

$('copyBookPrompt').onclick = () => run(() => issuePrompt());
async function savePersonalDraft(){
  if (!window.ChunkAPI?.getToken()) throw new Error('请先在主页登录，再返回这里保存；本机制作用草稿保留');
  const draft = WordbookWorkbench.snapshot(), materialSource=session.materialSource;
  if(materialSource){const prepared=await VocabularyMaterialLibrary.prepareDraft(materialSource);if(await fingerprint(prepared.draft)!==await fingerprint(draft))throw new Error('材料课程与来源不一致，请导入保留来源的完整新版本；原内容保留');}
  const requestFingerprint = await fingerprint(materialSource?{draft,materialSource}:draft);
  await persist();
  status('正在保存个人单词本…');
  const baseRevision = session.savedSourceBookId === draft.book.bookId ? session.savedPersonal?.revision || null : null;
  const result = await ChunkAPI.request('/api/personal-wordbooks', { method: 'POST', body: JSON.stringify({ draft:materialSource||draft, baseRevision }), timeoutMs: 20000 });
  guard.assert(scope);
  if (!result?.confirmed || !/^personal-book:[a-f0-9]{32}$/.test(result.bookId) || !/^[a-f0-9]{64}$/.test(result.revision)) throw new Error('保存结果尚未确认，请重试同一草稿，不要另做一本');
  await persist({ savedPersonal: result, savedFingerprint: requestFingerprint, savedSourceBookId: draft.book.bookId });
  if (savedComplete) setReceive(false);
  status('已保存到我的内容。点击“开始学习”即可练习这本单词本。');
  nextFocus='studyPersonalWordbook';
}
if ($('savePersonalWordbook')) $('savePersonalWordbook').onclick = () => run(savePersonalDraft);
$('copyBookContinue').onclick = () => run(() => issuePrompt());
$('checkBookAIResult').onclick = () => run(checkResult);
$('copyBookRepair').onclick = () => run(() => issuePrompt({ raw: $('bookAIResult').value, issues: review?.issues || ['请重新检查本批结构、词义和例句。'] }));
document.querySelectorAll('[data-book-adjust]').forEach(button => { button.onclick = () => run(() => issuePrompt({ raw: $('bookAIResult').value, adjustment: button.dataset.bookAdjust })); });
$('acceptBookAIBatch').onclick = () => run(async () => {
  if(session.materialSource)throw new Error('材料课程请导入包含新单元的完整材料制作文件，不能丢弃来源后追加普通词表');
  const draft = WordbookWorkbench.snapshot();
  if (!session.context || await fingerprint(draft) !== session.context.baseFingerprint) throw new Error('草稿已变化，请复制新指令后重新检查');
  const checked = parseBatch($('bookAIResult').value, session.context, draft, dependencies);
  if (!checked.ok) { showReview(checked); return; }
  const next = appendBatch(draft, checked, () => io.newId(), dependencies.draftModel);
  await persist({ draft: next, context: null, rawResult: '' });
  applying = true; try { WordbookWorkbench.applyDraft(next); } finally { applying = false; }
  WordbookWorkbench.markSaved(); $('bookAIResult').value = ''; clearReview();
  setReceive(false, '继续追加：放入下一批 AI 结果'); nextFocus = 'savePersonalWordbook';
  status('已追加 '+checked.batch.items.length+' 个词，正在保存…');
  await savePersonalDraft();
});
$('bookAIResult').addEventListener('input', () => { if (ready) scheduleSave(); });
$('bookAIResult').addEventListener('paste',()=>{setTimeout(()=>{if(ready&&!busy)run(checkResult);},0);});
if($('chooseAIFile')) $('chooseAIFile').onclick=()=>$('bookAIFile').click();
if($('chooseAIFile')){
 const exportButton=node('button','导出制作文件');exportButton.type='button';exportButton.id='exportBookFile';$('chooseAIFile').after(exportButton);
 exportButton.onclick=()=>run(async()=>{const draft=WordbookWorkbench.snapshot();if(!draft.items.length)throw new Error('当前没有可导出的课程');if(session.materialSource){const prepared=await VocabularyMaterialLibrary.prepareDraft(session.materialSource);if(await fingerprint(prepared.draft)!==await fingerprint(draft))throw new Error('当前内容与材料来源不一致，原材料文件仍保留，请先恢复一致版本');}io.download.save('wordbook-making.json',JSON.stringify(session.materialSource||draft,null,2)+'\n','application/json');});
}
async function importFile(file){
  if(!file)return;
  try{
    if(file.size>10000000)throw new Error('文件需小于 10 MB');
    const raw=await file.text();guard.assert(scope);
    const imported=identifyImport(raw);
    if(imported.kind==='book'||imported.kind==='material-course'){
      const materialSource=imported.kind==='material-course'?imported.value:null;
      const candidate=materialSource?(await VocabularyMaterialLibrary.prepareDraft(materialSource)).draft:imported.value;
      if(candidate.items.length>10000||candidate.book.units.length>1000)throw new Error('词条或单元数量过多');
      const issues=dependencies.draftModel.validate(candidate,{requireImages:false});
      if(issues.length)throw new Error('原制作文件需要修正：'+issues.slice(0,5).join('；'));
      const difference=importDifference(WordbookWorkbench.snapshot(),candidate);
      if(!confirm('这是完整单词本“'+candidate.book.title+'”（'+candidate.items.length+' 个词）。'+difference+'\n将打开制作稿，不会立即保存；当前内容和已保存课程都会保留。是否打开？'))return;
      await persist();const previous=session;
      const sameBook=previous.savedSourceBookId===candidate.book.bookId;
      session={...previous,sessionId:'wordbook-'+io.newId(),revision:0,draft:candidate,materialSource,context:null,rawResult:'',savedPersonal:sameBook?previous.savedPersonal:null,savedFingerprint:sameBook?previous.savedFingerprint:null,savedSourceBookId:sameBook?previous.savedSourceBookId:null};
      try{await persist({draft:candidate});}catch(error){session=previous;throw error;}
      applying=true;try{WordbookWorkbench.applyDraft(candidate);}finally{applying=false;}
      WordbookWorkbench.markSaved();$('bookAIResult').value='';clearReview();
      const params=new URLSearchParams(location.search);params.set('wordbookSession',session.sessionId);history.replaceState({},'',location.pathname+'?'+params);
      status('已打开单词本“'+candidate.book.title+'”。原制作会话保留；请审阅后保存或继续追加。');return;
    }
    if(raw.length>280000)throw new Error('结果内容过长，请分批导入');
    $('bookAIResult').value=raw;await checkResult();
  }finally{$('bookAIFile').value='';}
}
if($('bookAIFile')) $('bookAIFile').onchange=()=>run(()=>importFile($('bookAIFile').files[0]));
if($('bookAIReceive')){
  $('bookAIReceive').addEventListener('dragover',event=>{event.preventDefault();event.dataTransfer.dropEffect='copy';});
  $('bookAIReceive').addEventListener('drop',event=>{event.preventDefault();const files=event.dataTransfer.files;if(files.length!==1){status('请一次导入一个 JSON 文件。');return;}run(()=>importFile(files[0]));});
}
window.addEventListener('wordbook-draft-change', () => {
  if (!ready || applying) return;
  clearReview();
  enqueue(async () => { await persist({ context: null, rawResult: $('bookAIResult').value }); WordbookWorkbench.markSaved(); sync(); status('草稿已更新，可以复制下一批指令继续制作。'); }).catch(error => status(error.message));
});
window.addEventListener('beforeunload', event => { if (timer || pending || repository.persistenceWarning && (session?.draft.items.length || session?.rawResult)) { event.preventDefault(); event.returnValue = ''; } });

async function start() {
  const params = new URLSearchParams(location.search), requested = params.get('wordbookSession');
  if (requested) {
    session = await repository.load(requested, scope);
    if (!session) throw new Error('未找到这个本机草稿，请恢复下载的草稿文件');
  } else if (!params.has('new')) session = await recentUnfinishedSession(await repository.listRecent(scope));
  if (!session) {
    session = { kind: 'wordbook-authoring', sessionId: 'wordbook-' + io.newId(), revision: 0, identity: scope, settings: readSettings(), source: '', rawResult: '', context: null, draft: WordbookWorkbench.snapshot() };
    await persist();
  } else {
    if (session.kind !== 'wordbook-authoring' || session.identity.owner !== scope.owner || session.identity.databaseName !== scope.databaseName) throw new Error('草稿不属于当前制作账户');
    guard.assert(scope); WordbookWorkbench.applyDraft(session.draft);
    $('bookAIResult').value = session.rawResult || '';
    // Rebind a recovered session to the current login epoch through the guarded repository.
    const epochChanged = session.identity.sessionEpoch !== scope.sessionEpoch;
    session = { ...session, identity: scope };
    if (epochChanged) await persist();
    else { savedComplete = await isSavedSession(session); showPersistence(); }
  }
  params.delete('new'); params.set('wordbookSession', session.sessionId); history.replaceState({}, '', location.pathname + '?' + params);
  WordbookWorkbench.markSaved(); ready = true;
  if (session.context && session.rawResult && await fingerprint(session.draft) === session.context.baseFingerprint) showReview(parseBatch(session.rawResult, session.context, session.draft, dependencies));
  sync();
}
setupPageUpdates();
start().catch(error => { $('bookAIPersistence').hidden = false; $('bookAIPersistence').textContent = error.message; status('可先下载或恢复草稿文件。'); });
