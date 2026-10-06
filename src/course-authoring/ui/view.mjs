import { CourseCreationPreferences } from '../preferences.mjs';

function esc(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]); }
const step = Object.freeze({ setup: 1, 'waiting-result': 2, 'needs-fix': 2, preview: 3, saving: 3, saved: 3, joining: 3, complete: 3 });

function stepper(active) { return `<ol class="stepper" aria-label="课程制作步骤">${['准备制作指令', '与 AI 制作课程', '检查并开始学习'].map((title, index) => `<li class="step${index + 1 === active ? ' current' : index + 1 < active ? ' done' : ''}" aria-current="${index + 1 === active ? 'step' : 'false'}"><span>${index + 1}</span><b>${title}</b></li>`).join('')}</ol>`; }

export class AuthoringView {
  constructor({ root, document = globalThis.document }) { this.root = root; this.document = document; }
  render(snapshot, options = {}) {
    const active = step[snapshot.stage] || 1;
    const persistence = options.persistence || '';
    const title = snapshot.validatedDraft && snapshot.validatedDraft.title || '用自己的 AI 制作课程';
    let content = '';
    if (snapshot.stage === 'setup') content = this.#setup(snapshot, options);
    else if (snapshot.stage === 'waiting-result' || snapshot.stage === 'needs-fix') content = this.#receive(snapshot, options);
    else content = this.#preview(snapshot, options);
    this.root.innerHTML = `<main class="create-shell${active === 1 ? ' create-setup-shell' : ''}">${stepper(active)}<header class="create-heading${active === 1 ? ' create-setup-heading' : ''}"><div><span class="eyebrow">CHUNK LAB · AI 课程工作台</span><h1>${esc(title)}</h1>${active === 3 ? '<p>检查课程内容，确认后保存到课程库。</p>' : ''}</div><a class="text-link" href="decks.html">返回课程库</a></header>${options.error ? `<div class="global-error" role="alert">${esc(options.error)}</div>` : ''}<div class="persistence-note" role="status"${persistence ? '' : ' hidden'}>${esc(persistence)}</div>${content}<div class="recent-drafts"><button type="button" class="link-button" data-action="recent">查看本机未完成的制作草稿</button><div data-recent-list></div></div></main>`;
    this.root.dataset.sessionId = snapshot.sessionId;
  }

  #setup(snapshot, options) {
    const preferences = CourseCreationPreferences.normalize(snapshot.preferences);
    const preferenceOptions = options.preferenceOptions || CourseCreationPreferences.describeOptions();
    const example = snapshot.example ? `<aside class="example-note"><b>参考课程：${esc(snapshot.example.title)}</b><p>只取了开头少量内容作为形式参考，不会复制课程进度。</p></aside>` : '';
    const manualCopy = options.manualPrompt ? `<div class="issue-panel" role="status"><p>浏览器未能自动复制。请选中下方完整内容，手动复制后粘贴给你常用的 AI。</p><textarea readonly data-prompt-text>${esc(options.manualPrompt)}</textarea><button class="secondary-button" type="button" data-action="manual-copied">我已复制，继续</button></div>` : '';
    const imagePairing = this.#imagePairing(options.imagePairing);
    const radioGroup = (name, legend, items, selected) => `<fieldset class="choice-group"><legend>${legend}</legend><div class="choice-grid">${items.map((item) => `<label class="choice-card"><input type="radio" name="${name}" data-pref="${name}" value="${esc(item.id)}"${item.id === selected ? ' checked' : ''}><span>${esc(item.label)}${item.description ? `<small>${esc(item.description)}</small>` : ''}</span></label>`).join('')}</div></fieldset>`;
    const checkGroup = (name, legend, items, selected, gridClass = '') => `<fieldset class="choice-group"><legend>${legend}</legend><div class="choice-grid ${gridClass}">${items.map((item) => `<label class="choice-card"><input type="checkbox" name="${name}" data-pref="${name}" value="${esc(item.id)}"${selected.includes(item.id) ? ' checked' : ''}><span>${esc(item.label)}</span></label>`).join('')}</div></fieldset>`;
    const forms = snapshot.reviewContext ? '<div class="example-note"><b>错题针对性练习</b><p>已选 '+snapshot.reviewContext.publicPack.records.length+' 道错题。生成内容会通过现有课程校验；练习成绩与原句分开记录。</p></div>' : radioGroup('courseType', '1. 课程形式', preferenceOptions.forms, preferences.courseType);
    const levels = checkGroup('targetCefrs', '2. 可接受的难度 <small>可多选；留空让 AI 询问</small>', preferenceOptions.levels.map((level) => ({ id: level, label: level })), preferences.targetCefrs, 'cefr-choice-grid');
    const exercises = `<fieldset class="choice-group"><legend>3. 练习方式 <small>可多选</small></legend><div class="choice-grid">${preferenceOptions.exercises.map((mode) => {
      const disabled = !mode.selectable;
      const note = !mode.selectable ? '当前暂不可用' : mode.description;
      return `<label class="choice-card ${disabled ? 'is-disabled' : ''}"><input type="checkbox" name="exerciseModes" data-pref="exerciseModes" value="${esc(mode.id)}"${preferences.exerciseModes.includes(mode.id) ? ' checked' : ''}${disabled ? ' disabled' : ''}><span>${esc(mode.label)}<small>${esc(note)}</small></span></label>`;
    }).join('')}</div></fieldset>`;
    return `<section class="create-card create-setup-card"><div class="preference-form">${forms}${levels}${exercises}</div><label for="brief">告诉 AI 你想制作什么 <span>可写主题、场景或学习目标，也可留空让 AI 先问</span></label><textarea id="brief" maxlength="1200" placeholder="例如：想练习出差时和同事沟通。也可以留空，让 AI 先问我几个问题。">${esc(snapshot.brief)}</textarea>${example}<div class="create-actions"><button class="primary-button" type="button" data-action="copy-prompt">复制 AI 制作指令</button><button type="button" class="secondary-button" data-action="download-prompt">下载制作指令</button></div>${manualCopy}<details class="quick-import"><summary>已有课程文件？直接导入</summary><label for="courseFile">选择课程文件</label><input id="courseFile" type="file" accept=".json,.txt,application/json,text/plain"><label for="rawResult">或粘贴课程内容</label><textarea id="rawResult" maxlength="280000" placeholder="请粘贴完整课程 JSON，或只包含一个 JSON 代码块。"></textarea>${snapshot.reviewContext ? '' : `<label for="imageFiles">图文课程图片 <span>文件名不同时，可在下方手动配对</span></label><input id="imageFiles" type="file" accept="image/png,image/jpeg,image/webp" multiple>${imagePairing}`}<div class="create-actions"><button class="secondary-button" type="button" data-action="validate-result">检查课程</button></div></details><a href="ai-course-kit.json" download>查看完整 AI 制作规范</a></section>`;
  }

  #receive(snapshot, options) {
    const report = snapshot.validationReport;
    const problems = report && report.issues || [];
    const issues = problems.length ? `<div class="issue-panel ${problems.some((item) => item.severity === 'error') ? 'has-error' : ''}" role="alert"><h3>${problems.filter((item) => item.severity === 'error').length ? '还需要 AI 帮忙修改' : '检查提醒'}</h3><ul>${problems.map((item) => `<li><b>${esc(item.path || '课程格式')}：</b>${esc(item.message)}<span>${esc(item.suggestion)}</span></li>`).join('')}</ul>${problems.some((item) => item.severity === 'error') ? '<button class="secondary-button" type="button" data-action="repair">复制修复指令</button>' : ''}</div>` : '';
    const manualCopy = options.manualPrompt ? `<div class="issue-panel" role="status"><p>请点入下面的文本，按 Ctrl+C（Mac 使用 ⌘C）复制，再粘贴给你常用的 AI。</p><textarea readonly data-prompt-text>${esc(options.manualPrompt)}</textarea><button class="secondary-button" type="button" data-action="manual-copied">我已复制，继续</button></div>` : '';
    const imagePairing = this.#imagePairing(options.imagePairing);
    return `<section class="create-card"><h2>② 与 AI 制作课程</h2><ol class="how-to"><li>到你常用的 AI 聊天窗口。</li><li>粘贴制作指令，并按 AI 的问题选择课程形式、难度和话题。</li><li>得到完整课程后，复制 AI 的课程内容或下载 JSON 文件回到这里。</li></ol>${manualCopy}<div class="file-dropzone" data-file-dropzone><input class="file-drop-input" id="courseFile" type="file" accept=".json,.txt,application/json,text/plain" aria-label="选择 AI 生成的课程文件"><label class="file-drop-label" for="courseFile"><strong>将 AI 生成的课程文件拖到这里</strong><span>或点击此处选择 JSON / TXT 文件</span></label></div><label for="rawResult">课程 JSON 内容</label><textarea id="rawResult" maxlength="280000" placeholder="请粘贴完整课程 JSON，或只包含一个 JSON 代码块。聊天说明和多个对象不能直接导入。">${esc(snapshot.rawResult)}</textarea><label for="imageFiles">图文课程图片 <span>文件名不同时，可在下方手动配对</span></label><input id="imageFiles" type="file" accept="image/png,image/jpeg,image/webp" multiple>${imagePairing}${issues}<div class="create-actions"><button class="primary-button" type="button" data-action="validate-result">检查课程</button><button class="secondary-button" type="button" data-action="back-setup">返回制作指令</button></div></section>`;
  }

  #imagePairing(pairing) {
    if (!pairing || !pairing.images || !pairing.images.length || !pairing.files || !pairing.files.length) return '';
    return `<div class="image-pairing"><b>确认每张课程图片</b>${pairing.images.map((image) => {
      const exact = pairing.files.find((name) => name.toLowerCase() === image.fileName.toLowerCase());
      const selected = pairing.bindings[image.key] || (exact ? exact : '');
      return `<label class="image-pair-row"><span>${esc(image.alt)} <small>需要：${esc(image.fileName)}</small></span><select data-image-binding="${esc(image.key)}"><option value="">选择本机图片</option>${pairing.files.map((name) => `<option value="${esc(name)}"${selected === name ? ' selected' : ''}>${esc(name)}</option>`).join('')}</select></label>`;
    }).join('')}</div>`;
  }

  #preview(snapshot, options) {
    const draft = snapshot.validatedDraft || {}, report = snapshot.validationReport || {}, lines = draft.items || [];
    const modes = report.supportedModes || [];
    const issues = (report.issues || []).filter((item) => item.severity === 'warning');
    const imageCourse = draft.format === 'chunklab-ai-image-text';
    const imageByKey = new Map((draft.images || []).map((image) => [image.key, image]));
    const sample = lines.slice(0, 3).map((item, index) => {
      const image = imageCourse && imageByKey.get(item.imageKey);
      const imageUrl = image && options.previewImageUrls && options.previewImageUrls[image.key];
      return `<article class="preview-line"><small>第 ${index + 1} 句</small>${imageUrl ? `<img class="image-course-preview" src="${esc(imageUrl)}" alt="${esc(image.alt)}">` : ''}<p>${esc(item.en)}</p><span>${esc(item.zh)}</span>${item.chunks ? `<div class="preview-chunks">${item.chunks.map((chunk) => `<i>${esc(chunk)}</i>`).join('')}</div>` : ''}</article>`;
    }).join('');
    const mismatch = issues.some((item) => item.code === 'PREFERENCE_MISMATCH');
    const issuesBlock = issues.length ? `<div class="issue-panel"><h3>学习能力提醒</h3><ul>${issues.map((item) => `<li>${esc(item.message)}<span>${esc(item.suggestion)}</span></li>`).join('')}</ul>${mismatch && !report.mismatchAccepted ? '<button class="secondary-button" type="button" data-action="accept-mode-mismatch">接受 AI 返回的练习方式</button>' : ''}</div>` : '';
    const status = snapshot.stage === 'saving' ? '正在保存课程…' : snapshot.stage === 'joining' ? '正在加入学习…' : snapshot.stage === 'saved' ? '课程已保存到当前账号的课程库。' : snapshot.stage === 'complete' ? '已加入学习，可以开始练习。' : '';
    const needsModeAcceptance = (report.issues || []).some((item) => item.code === 'PREFERENCE_MISMATCH') && !report.mismatchAccepted;
    const buttons = snapshot.stage === 'preview' ? `<button class="primary-button" type="button" data-action="save"${needsModeAcceptance ? ' disabled' : ''}>保存到课程库</button><button class="secondary-button" type="button" data-action="save-and-join"${needsModeAcceptance ? ' disabled' : ''}>保存并加入学习</button>`
      : snapshot.stage === 'saving' || snapshot.stage === 'joining' ? '<button class="primary-button" type="button" disabled>正在处理…</button>'
        : snapshot.stage === 'saved' ? '<button class="primary-button" type="button" data-action="join">加入并开始学习</button>'
      : `<a class="primary-button as-link" href="${esc(options.launchUrl || `main.html?course=${encodeURIComponent(snapshot.saveReceipt?.catalogCourseId || `user-deck:${snapshot.courseId}`)}&lesson=${encodeURIComponent(snapshot.saveReceipt?.lessonId || `lesson:user-deck:${snapshot.courseId}`)}`)}">开始练习</a>`;
    const legacyNote = snapshot.conversionReport ? '<p class="hint">旧版课程和学习记录仍保留；新复习记录从实际答题开始，不会伪造历史成绩。</p>' : '';
    return `<section class="create-card"><h2>③ 检查并开始学习</h2><div class="course-summary"><div><span>课程形式</span><b>${imageCourse ? '图文课程' : '句子课程'}</b></div><div><span>难度</span><b>${esc(draft.targetCefr)}</b></div><div><span>内容</span><b>${lines.length} 句</b></div></div><p>${imageCourse ? '保存后使用现有课程包播放器和练习能力。' : '保存后使用 Chunk Lab 现有句子答题、错题和复习功能。'}</p>${legacyNote}<h3>可以使用的练习</h3><div class="mode-list">${modes.map((mode) => `<span class="mode-pill ${mode.enabled ? 'available' : 'unavailable'}">${esc(mode.id)} · ${esc(mode.enabled ? '可用' : mode.reason)}</span>`).join('')}</div>${issuesBlock}<details class="preview-details" open><summary>预览前 3 句，点击查看其他内容</summary>${sample}${lines.length > 3 ? `<div>${lines.slice(3).map((item, index) => `<details class="more-line"><summary>第 ${index + 4} 句</summary><p>${esc(item.en)}</p><span>${esc(item.zh)}</span></details>`).join('')}</div>` : ''}</details>${snapshot.lastError ? `<div class="issue-panel has-error" role="alert">${esc(snapshot.lastError)}</div>` : ''}<p class="persistence-note" role="status">${esc(status)} ${esc(options.persistence || '')}</p><div class="create-actions">${buttons}<button class="secondary-button" type="button" data-action="export">下载课程文件</button></div>${snapshot.stage === 'saved' ? '<p class="hint">需要修订？开始新的改编草稿，现有课程和进度会保留。</p>' : ''}</section>`;
  }
}
