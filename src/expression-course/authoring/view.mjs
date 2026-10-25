import { makeExpressionCoursePrompt } from './prompt.mjs';
import { renderActivity } from '../ui/renderers.mjs';

const $ = id => document.getElementById(id);
const requestId = () => crypto.randomUUID();
let draft = null, packageValue = null, uploadedFiles = new Map(), validation = null;
let workflowMode = null;
function adminToken() { try { return localStorage.getItem('chunklab_admin_token') || ''; } catch (_) { return ''; } }
function adminBase() { try { return (localStorage.getItem('chunklab_api_base') || '').replace(/\/+$/, ''); } catch (_) { return ''; } }
async function adminRequest(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (adminToken()) headers.Authorization = 'Bearer ' + adminToken();
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(adminBase() + path, { method: options.method || 'GET', headers, body: options.body, cache: 'no-store' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(data.error || data.code || `请求失败 ${response.status}`); error.code = data.code; error.status = response.status; throw error; }
  return data;
}

function message(text, isError = false) { const el = $('authorMessage'); el.textContent = text; el.dataset.error = String(isError); }
function showPackage(value) { packageValue = value; $('packageInput').value = JSON.stringify(value, null, 2); }
function setStep(step, title, description) {
  const order = ['choose', 'content', 'audio', 'check', 'publish'];
  const current = order.indexOf(step);
  for (const item of $('workflowSteps').querySelectorAll('[data-step]')) {
    const index = order.indexOf(item.dataset.step);
    item.classList.toggle('is-complete', index < current);
    item.classList.toggle('is-current', index === current);
    if (index === current) item.setAttribute('aria-current', 'step'); else item.removeAttribute('aria-current');
  }
  $('workflowTitle').textContent = title;
  $('workflowDescription').textContent = description;
}
function openWorkspace(value, { existingDraft = false } = {}) {
  const assets = Array.isArray(value?.assets) ? value.assets : [];
  const lessons = Array.isArray(value?.lessons) ? value.lessons : [];
  const missingAudio = assets.filter(asset => !asset.sha256 || !asset.size).length;
  $('workflowChoice').hidden = true;
  $('aiPath').hidden = true;
  $('directImportPath').hidden = true;
  $('aiImportPath').hidden = true;
  $('changeWorkflow').hidden = true;
  $('packageWorkspace').hidden = false;
  $('packageEditor').open = false;
  $('packageHeading').textContent = value?.title || '课程已载入';
  $('packageSummary').textContent = `共 ${lessons.length} 个单元 · ${assets.length} 个音频资源${missingAudio ? ` · 还有 ${missingAudio} 个音频待上传` : ' · 音频资源已齐'}`;
  $('audioStage').hidden = assets.length === 0;
  $('audioInstruction').textContent = missingAudio
    ? `请选择与课程 JSON 中 localFile 文件名一致的音频文件；还需上传 ${missingAudio} 个。也可以先保存草稿，稍后补齐。`
    : '如需试听示范音频，请选择与课程 JSON 中 localFile 文件名一致的文件。';
  $('previewPackage').disabled = true;
  $('previewPackage').hidden = true;
  $('approvePackage').disabled = true;
  $('approvePackage').hidden = true;
  $('publishPackage').disabled = true;
  $('publishPackage').hidden = true;
  $('validationResult').textContent = '';
  $('preview').hidden = true;
  validation = null;
  if (assets.length && missingAudio) {
    setStep('audio', existingDraft ? '当前步骤：补齐课程音频' : '当前步骤：上传配套音频', '音频文件名需要与课程 JSON 中列出的文件名一致。上传后再检查课程。');
  } else {
    setStep('check', existingDraft ? '当前步骤：重新检查草稿' : '当前步骤：检查课程内容', '检查会自动保存草稿，并核对课程结构和音频资源。通过后可以试听并确认。');
  }
}
function invalidateCheck() {
  validation = null;
  $('validationResult').textContent = '';
  $('previewPackage').disabled = true;
  $('previewPackage').hidden = true;
  $('approvePackage').disabled = true;
  $('approvePackage').hidden = true;
  $('publishPackage').disabled = true;
  $('publishPackage').hidden = true;
  if (!$('packageWorkspace').hidden) setStep('check', '当前步骤：重新检查课程', '课程内容有变化；请重新检查。检查会自动保存草稿。');
}
function readPackage() {
  try { packageValue = JSON.parse($('packageInput').value); if (!packageValue || typeof packageValue !== 'object') throw new Error(); return packageValue; }
  catch { throw new Error('JSON 格式不正确，请检查后再继续。'); }
}
async function saveDraft() {
  const pkg = readPackage();
  if (draft) draft = await adminRequest('/api/admin/expression-drafts/' + encodeURIComponent(draft.draftId), { method: 'PUT', body: JSON.stringify({ expectedRevision: draft.revision, requestId: requestId(), package: pkg }) });
  else draft = await adminRequest('/api/admin/expression-drafts', { method: 'POST', body: JSON.stringify({ requestId: requestId(), package: pkg }) });
  validation = null;
  return draft;
}
async function refreshDrafts() {
  const result = await adminRequest('/api/admin/expression-drafts');
  const list = $('draftList'); list.replaceChildren();
  for (const item of result.drafts) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'draft-link'; button.textContent = `${item.title || '未命名课程'} · 修订 ${item.revision}`;
    button.onclick = async () => { draft = await adminRequest('/api/admin/expression-drafts/' + encodeURIComponent(item.draftId)); showPackage(draft.package); openWorkspace(draft.package, { existingDraft: true }); message('已打开草稿。按当前步骤继续；修改后需要重新检查和审核。'); };
    list.append(button);
  }
  if (!result.drafts.length) list.textContent = '还没有保存的草稿。';
  const published = await adminRequest('/api/admin/expression-courses');
  const publishedList = $('publishedList'); publishedList.replaceChildren();
  for (const course of published.courses) {
    const row = document.createElement('div'); row.className = 'published-row';
    const title = document.createElement('span'); title.textContent = `${course.title} · ${course.status === 'active' ? '已上架' : '已下架'} · ${course.releaseId || '无版本'}`;
    const copy = document.createElement('button'); copy.type = 'button'; copy.className = 'button button-secondary'; copy.textContent = '复制为新草稿';
    copy.onclick = async () => { try { const result = await adminRequest('/api/admin/expression-drafts', { method: 'POST', body: JSON.stringify({ requestId: requestId(), package: course.package }) }); draft = await adminRequest('/api/admin/expression-drafts/' + encodeURIComponent(result.draftId)); showPackage(draft.package); openWorkspace(draft.package, { existingDraft: true }); message('已复制为新草稿；原发布版本不会被改动。'); await refreshDrafts(); } catch (error) { message(error.message, true); } };
    row.append(title, copy);
    if (course.status === 'active') {
      const unlist = document.createElement('button'); unlist.type = 'button'; unlist.className = 'button button-danger'; unlist.textContent = '下架';
      unlist.onclick = async () => { try { await adminRequest('/api/admin/expression-courses/' + encodeURIComponent(course.courseId) + '/unlist', { method: 'POST', body: JSON.stringify({ requestId: requestId() }) }); await refreshDrafts(); message('课程已从发现目录下架；历史版本和学习记录保留。'); } catch (error) { message(error.message, true); } };
      row.append(unlist);
    }
    publishedList.append(row);
  }
  if (!published.courses.length) publishedList.textContent = '还没有发布的课程。';
}
async function chooseFiles(files) {
  const pkg = readPackage();
  const descriptors = new Map((pkg.assets || []).map(asset => [asset.localFile.split('/').pop(), asset]));
  for (const file of files) {
    const asset = descriptors.get(file.name);
    if (!asset) throw new Error(`找不到与文件 ${file.name} 对应的 localFile。文件名请与 JSON 一致。`);
    if (file.size > 5 * 1024 * 1024) throw new Error(`${file.name} 超过 5 MiB。`);
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte);
    const uploaded = await adminRequest('/api/admin/expression-assets', { method: 'POST', body: JSON.stringify({ assetId: asset.assetId, mimeType: file.type, base64: btoa(binary) }) });
    asset.sha256 = uploaded.sha256; asset.size = uploaded.size; uploadedFiles.set(asset.assetId, file);
  }
  showPackage(pkg);
  const missingAudio = (pkg.assets || []).filter(asset => !asset.sha256 || !asset.size).length;
  setStep('check', '当前步骤：检查课程内容', missingAudio ? `已上传 ${files.length} 个音频；还有 ${missingAudio} 个待上传。也可以先检查，系统会指出缺少项。` : '音频已上传。下一步检查会自动保存草稿，并核对课程结构和资源。');
  message(`已上传并校验 ${files.length} 个音频文件。下一步：检查课程。`);
}
async function validate() {
  await saveDraft();
  validation = await adminRequest(`/api/admin/expression-drafts/${encodeURIComponent(draft.draftId)}/validate`, { method: 'POST', body: '{}' });
  $('validationResult').textContent = validation.valid ? `校验通过 · 内容摘要 ${validation.contentHash}` : validation.errors.join('\n');
  if (validation.valid) {
    $('previewPackage').disabled = false;
    $('previewPackage').hidden = false;
    $('approvePackage').disabled = false;
    $('approvePackage').hidden = false;
    setStep('publish', '当前步骤：试听并确认课程', '检查已通过。可以先试听第一步，再确认内容；确认后才会开放发布。');
  } else {
    $('previewPackage').disabled = true;
    $('previewPackage').hidden = true;
    $('approvePackage').disabled = true;
    $('approvePackage').hidden = true;
    $('publishPackage').disabled = true;
    $('publishPackage').hidden = true;
    setStep('check', '当前步骤：修正检查问题', '请按下方检查结果修正课程或补齐资源，然后重新检查。');
  }
  message(validation.valid ? '检查通过并已保存草稿。试听为可选；确认内容后才能发布。' : '发现需要修正的问题，请按检查结果处理后重新检查。', !validation.valid);
  return validation;
}

async function run() {
  if (!adminToken()) $('adminLogin').hidden = false;
  try { if (adminToken()) await refreshDrafts(); else message('请登录管理员账号后管理课程。'); } catch (error) { $('adminLogin').hidden = false; message(error.message || '当前账号没有制作权限。', true); }
  $('adminLogin').addEventListener('submit', async event => { event.preventDefault(); try { const result = await adminRequest('/api/admin/login', { method: 'POST', body: JSON.stringify({ password: $('adminPassword').value }) }); localStorage.setItem('chunklab_admin_token', result.token); $('adminLogin').hidden = true; await refreshDrafts(); message('管理员已登录。'); } catch (error) { message(error.message, true); } });
  $('packageInput').addEventListener('input', invalidateCheck);
  $('workflowChoice').querySelectorAll('[data-mode]').forEach(button => {
    button.onclick = () => {
      workflowMode = button.dataset.mode;
      $('workflowChoice').hidden = true;
      $('aiPath').hidden = workflowMode !== 'ai';
      $('directImportPath').hidden = workflowMode !== 'import';
      $('aiImportPath').hidden = true;
      $('changeWorkflow').hidden = false;
      setStep('content', workflowMode === 'ai' ? '当前步骤：到外部 AI 制作课程' : '当前步骤：导入课程 JSON', workflowMode === 'ai' ? '复制指令并在外部 AI 对话中完成课程；拿到 JSON 后回到这里导入。' : '选择已有的完整课程 JSON 文件，导入后按提示检查资源。');
    };
  });
  $('changeWorkflow').onclick = () => {
    workflowMode = null;
    $('workflowChoice').hidden = false;
    $('aiPath').hidden = true;
    $('directImportPath').hidden = true;
    $('aiImportPath').hidden = true;
    $('changeWorkflow').hidden = true;
    setStep('choose', '当前步骤：选择一种开始方式', '已有完整课程 JSON 就直接导入；还没有课程包，就先用外部 AI 制作。');
  };
  $('copyPrompt').onclick = async () => {
    try { await navigator.clipboard.writeText(makeExpressionCoursePrompt({ formatVersion: $('promptProtocol').value, track: $('promptTrack').value })); $('aiImportNext').hidden = false; setStep('content', '当前步骤：在外部 AI 完成课程', '制作指令已复制。将教材或资料发送给所选 AI，确认生成的 JSON 后再回到这里导入。'); message('制作指令已复制。完成外部 AI 对话后，点击“我已拿到 JSON，继续导入”。'); }
    catch (error) { message('无法自动复制。请检查浏览器剪贴板权限后重试。', true); }
  };
  const syncPromptRoute = () => { $('promptTrack').hidden = $('promptProtocol').value !== '1.1'; };
  $('promptProtocol').addEventListener('change', syncPromptRoute);
  syncPromptRoute();
  $('continueAIImport').onclick = () => { $('aiPath').hidden = true; $('aiImportPath').hidden = false; setStep('content', '当前步骤：导入 AI 生成的课程', '选择外部 AI 返回的完整课程 JSON 文件。导入后会显示音频和检查步骤。'); };
  const importPackage = async event => {
    const file = event.target.files?.[0]; if (!file) return;
    try { const value = JSON.parse(await file.text()); if (!value || typeof value !== 'object' || !Array.isArray(value.lessons)) throw new Error('文件不是完整的课程 JSON。'); draft = null; uploadedFiles = new Map(); showPackage(value); openWorkspace(value); message('课程 JSON 已导入。请按当前步骤继续。'); }
    catch (error) { message(error.message || '无法读取课程 JSON 文件。', true); }
    event.target.value = '';
  };
  $('importPackage').onchange = importPackage;
  $('importPackageAfterAI').onchange = importPackage;
  $('uploadAudio').onchange = async event => { try { await chooseFiles(event.target.files); } catch (error) { message(error.message, true); } event.target.value = ''; };
  $('saveDraft').onclick = async () => { try { await saveDraft(); await refreshDrafts(); message('草稿已保存。它仍是私有草稿，不会出现在课程目录。'); } catch (error) { message(error.message, true); } };
  $('checkPackage').onclick = async () => { try { await validate(); } catch (error) { message(error.message, true); } };
  $('previewPackage').onclick = () => {
    try { const pkg = readPackage(); const activity = pkg.lessons?.[0]?.activities?.[0]; if (!activity) throw new Error('没有可预览的课程活动。');
      $('preview').hidden = false; $('previewTitle').textContent = pkg.title || '课程预览';
      renderActivity($('previewBody'), activity, { preview: true, playAudio: id => { const file = uploadedFiles.get(id); if (!file) return message('请先选择本地音频文件才能试听。', true); const audio = new Audio(URL.createObjectURL(file)); audio.play(); } });
    } catch (error) { message(error.message, true); }
  };
  $('approvePackage').onclick = async () => { try { const checked = validation || await validate(); if (!checked.valid) return; await adminRequest(`/api/admin/expression-drafts/${encodeURIComponent(draft.draftId)}/review`, { method: 'POST', body: JSON.stringify({ contentHash: checked.contentHash }) }); message('内容确认完成，发布按钮已开放。'); $('publishPackage').disabled = false; $('publishPackage').hidden = false; setStep('publish', '当前步骤：发布到系统课程目录', '内容已确认。点击发布后，课程将对所有用户可见，不会自动加入任何账号。'); } catch (error) { message(error.message, true); } };
  $('publishPackage').onclick = async () => { try { const checked = validation || await validate(); const result = await adminRequest(`/api/admin/expression-drafts/${encodeURIComponent(draft.draftId)}/publish`, { method: 'POST', body: JSON.stringify({ expectedRevision: draft.revision, contentHash: checked.contentHash, requestId: requestId() }) }); message(`已发布到系统课程目录：${result.courseId} · ${result.releaseId}。没有替任何账号报名。`); await refreshDrafts(); } catch (error) { message(error.message, true); } };
  $('deleteDraft').onclick = async () => { if (!draft) return message('先从草稿列表选择一项。', true); if (!confirm('确定删除这份未发布草稿？')) return; try { await adminRequest(`/api/admin/expression-drafts/${encodeURIComponent(draft.draftId)}`, { method: 'DELETE', body: JSON.stringify({ expectedRevision: draft.revision, requestId: requestId() }) }); draft = null; showPackage({}); $('packageWorkspace').hidden = true; $('workflowChoice').hidden = false; $('changeWorkflow').hidden = true; await refreshDrafts(); message('草稿已删除。'); } catch (error) { message(error.message, true); } };
}
run();
