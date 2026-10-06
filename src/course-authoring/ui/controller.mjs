import { CourseCreationPreferences } from '../preferences.mjs';

export class AuthoringController {
  constructor({ root, view, service, sessionRepository, scopeGuard, io }) {
    this.root = root;
    this.view = view;
    this.service = service;
    this.sessionRepository = sessionRepository;
    this.scopeGuard = scopeGuard;
    this.io = io;
    this.snapshot = null; this.manualPrompt = ''; this.busy = false; this.preferenceWrite = Promise.resolve();
    this.previewUrls = []; this.renderRevision = 0;
    this.uploadedImages = []; this.imageBindings = {};
  }
  async start() {
    this.root.addEventListener('click', (event) => this.#click(event));
    this.root.addEventListener('change', (event) => this.#change(event));
    this.root.addEventListener('input', (event) => this.#input(event));
    this.root.addEventListener('dragover', (event) => {
      const zone = event.target instanceof Element ? event.target.closest('[data-file-dropzone]') : null;
      if (!zone) return;
      event.preventDefault();
      zone.classList.add('is-dragover');
    });
    this.root.addEventListener('dragleave', (event) => {
      const zone = event.target instanceof Element ? event.target.closest('[data-file-dropzone]') : null;
      if (!zone || (event.relatedTarget instanceof Node && zone.contains(event.relatedTarget))) return;
      zone.classList.remove('is-dragover');
    });
    this.root.addEventListener('drop', (event) => {
      const zone = event.target instanceof Element ? event.target.closest('[data-file-dropzone]') : null;
      if (!zone) return;
      event.preventDefault();
      zone.classList.remove('is-dragover');
      const files = event.dataTransfer && event.dataTransfer.files;
      if (!files || !files.length) return;
      if (files.length > 1) { this.#render({ error: '一次拖入一个课程文件。' }); return; }
      this.#loadCourseFile(files[0], zone.querySelector('#courseFile'));
    });
    const params = new URLSearchParams(globalThis.location.search);
    this.snapshot = await this.service.open({ sessionId: params.get('session') || undefined, sourceCourseId: params.get('source') || '', brief: '' });
    if (params.get('convert') && this.snapshot.stage === 'setup') this.snapshot = await this.service.prepareLegacyConversion(this.snapshot.sessionId, params.get('convert'));
    if (!params.has('session')) { params.set('session', this.snapshot.sessionId); globalThis.history.replaceState({}, '', `${location.pathname}?${params.toString()}`); }
    await this.#render();
  }
  async #click(event) {
    const button = event.target.closest('[data-action]'); if (!button || this.busy) return;
    const action = button.dataset.action;
    try {
      if (action === 'copy-prompt') {
        await this.#flushBrief();
        await this.#flushPreferences();
        const result = await this.service.copyPrompt(this.snapshot.sessionId);
        if (result.session) this.snapshot = result.session;
        if (result.copied === false) this.manualPrompt = result.prompt;
      } else if (action === 'manual-copied') { this.snapshot = await this.service.markPromptCopied(this.snapshot.sessionId); this.manualPrompt = ''; }
      else if (action === 'download-prompt') { await this.#flushBrief(); await this.#flushPreferences(); await this.io.download.save('chunklab-ai-制作指令.txt', await this.service.createPrompt(this.snapshot.sessionId), 'text/plain;charset=utf-8'); }
      else if (action === 'validate-result') { const area = this.root.querySelector('#rawResult'); await this.#accept(area.value, this.#pairedImageFiles(area.value)); return; }
      else if (action === 'repair') { const prompt = await this.service.getRepairPrompt(this.snapshot.sessionId); await this.#copyOrShow(prompt); return; }
      else if (action === 'accept-mode-mismatch') { this.snapshot = await this.service.acceptModeMismatch(this.snapshot.sessionId); }
      else if (action === 'back-setup') { this.snapshot = await this.service.backToSetup(this.snapshot.sessionId); }
      else if (action === 'save' || action === 'save-and-join') {
        this.busy = true; this.#render(); this.snapshot = await this.service.save(this.snapshot.sessionId); this.busy = false;
        if (action === 'save-and-join') await this.#join();
      } else if (action === 'join') await this.#join();
      else if (action === 'export') await this.service.exportCourse(this.snapshot.sessionId);
      else if (action === 'recent') await this.#showRecent();
      this.#render();
    } catch (error) { this.busy = false; this.snapshot = await this.#reloadSafe(); this.#render({ error: error.message }); }
  }
  async #change(event) {
    if (event.target.matches('[data-image-binding]')) {
      this.imageBindings[event.target.dataset.imageBinding] = event.target.value;
      const area = this.root.querySelector('#rawResult');
      if (area && area.value.trim()) await this.#accept(area.value, this.#pairedImageFiles(area.value));
      return;
    }
    if (event.target.matches('[data-pref]')) {
      if (event.target.matches('[data-pref="exerciseModes"]') && !event.target.checked && !this.root.querySelector('[data-pref="exerciseModes"]:checked')) {
        event.target.checked = true;
        this.#status('至少保留一种练习方式。');
        return;
      }
      const contentForm = this.root.querySelector('[name="contentForm"]:checked')?.value || this.snapshot.preferences.contentForm;
      const roleplay = this.root.querySelector('[data-pref="exerciseModes"][value="roleplay"]');
      if (roleplay) {
        roleplay.disabled = contentForm !== 'dialogue';
        if (contentForm !== 'dialogue') roleplay.checked = false;
      }
      this.#queuePreferences();
      return;
    }
    if (event.target.id === 'imageFiles' && event.target.files) {
      this.uploadedImages = Array.from(event.target.files);
      this.imageBindings = {};
      const area = this.root.querySelector('#rawResult');
      if (area && area.value.trim()) await this.#accept(area.value, this.#pairedImageFiles(area.value));
      return;
    }
    if (event.target.id === 'courseFile' && event.target.files && event.target.files[0]) await this.#loadCourseFile(event.target.files[0], event.target);
  }
  async #loadCourseFile(file, input) {
    try {
      const limit = /\.chunklab-image-course\.json$/i.test(file.name) ? 12 * 1024 * 1024 : 256 * 1024;
      if (file.size > limit) throw new Error(`文件超过 ${Math.round(limit / 1024 / 1024)} MiB 限制。`);
      if (!/\.(?:json|txt)$/i.test(file.name)) throw new Error('请选择 AI 生成的 JSON 或 TXT 课程文件。');
      const text = await file.text(); this.scopeGuard.assert(this.snapshot.identity); await this.#accept(text);
    } catch (error) { this.#render({ error: error.message }); }
    if (input) input.value = '';
  }
  #readPreferences() {
    const selected = (name) => this.root.querySelector(`[name="${name}"]:checked`)?.value;
    return CourseCreationPreferences.normalize({
      courseType: selected('courseType'),
      targetCefrs: [...this.root.querySelectorAll('[data-pref="targetCefrs"]:checked')].map((input) => input.value),
      exerciseModes: [...this.root.querySelectorAll('[data-pref="exerciseModes"]:checked')].map((input) => input.value)
    });
  }
  #queuePreferences() {
    this.preferenceWrite = this.preferenceWrite.catch(() => {}).then(async () => {
      const preferences = this.#readPreferences();
      if (JSON.stringify(preferences) === JSON.stringify(this.snapshot.preferences)) return;
      this.snapshot = await this.service.updatePreferences(this.snapshot.sessionId, preferences, this.snapshot.revision);
    }).catch((error) => this.#status(error.message));
    return this.preferenceWrite;
  }
  async #flushPreferences() {
    await this.preferenceWrite;
    if (JSON.stringify(this.#readPreferences()) !== JSON.stringify(this.snapshot.preferences)) {
      this.#queuePreferences();
      await this.preferenceWrite;
    }
  }
  async #input(event) {
    if (event.target.id !== 'brief' || !this.snapshot) return;
    const brief = event.target.value;
    this.pendingBrief = brief;
    clearTimeout(this.briefTimer);
    this.briefTimer = setTimeout(() => this.#queueBriefWrite(), 250);
  }
  #queueBriefWrite() {
    this.briefTimer = null;
    const brief = this.pendingBrief;
    this.briefWrite = (this.briefWrite || Promise.resolve()).catch(() => {}).then(async () => {
      if (brief === undefined || brief === this.snapshot.brief) return;
      this.snapshot = await this.service.updateBrief(this.snapshot.sessionId, brief, this.snapshot.revision);
      if (this.pendingBrief === brief) this.pendingBrief = undefined;
      if (this.sessionRepository.persistenceWarning) this.#status('');
    }).catch((error) => this.#status(error.message));
    return this.briefWrite;
  }
  async #flushBrief() {
    if (this.briefTimer) { clearTimeout(this.briefTimer); this.briefTimer = null; }
    if (this.pendingBrief !== undefined) await this.#queueBriefWrite();
    if (this.briefWrite) await this.briefWrite;
    const area = this.root.querySelector('#brief');
    if (area && area.value !== this.snapshot.brief) {
      this.pendingBrief = area.value;
      await this.#queueBriefWrite();
    }
  }
  async #accept(text, imageFiles = []) {
    this.busy = true; this.manualPrompt = ''; this.#status('正在检查课程内容…');
    try { this.snapshot = await this.service.acceptText(this.snapshot.sessionId, text, imageFiles); this.busy = false; this.#render(); }
    catch (error) { this.busy = false; this.#render({ error: error.message }); }
  }
  #pairedImageFiles(text) {
    const parsed = this.service.codec.parseText(text);
    const draft = parsed.ok && parsed.value && parsed.value.format === 'chunklab-ai-image-text' ? parsed.value : null;
    if (!draft || !this.uploadedImages.length) return [];
    return draft.images.map((image) => {
      const fileName = this.imageBindings[image.key] || image.fileName;
      const file = this.uploadedImages.find((candidate) => candidate.name.toLowerCase() === String(fileName).toLowerCase());
      if (!file) return null;
      return file.name.toLowerCase() === image.fileName.toLowerCase() ? file : new File([file], image.fileName, { type: file.type });
    }).filter(Boolean);
  }
  async #copyOrShow(text) {
    try { await this.io.clipboard.write(text); this.#status('修复指令已复制。把它发给刚才的 AI，然后将完整新结果带回来。'); }
    catch (error) { this.manualPrompt = text; this.#render(); }
  }
  async #join() {
    this.busy = true; this.#render();
    try {
      const result = await this.service.join(this.snapshot.sessionId);
      this.snapshot = result.session; this.busy = false; this.#render();
      if (this.snapshot.stage === 'complete') location.href = await this.service.getLaunchUrl(this.snapshot.sessionId);
    } catch (error) { this.busy = false; this.snapshot = await this.#reloadSafe(); this.#render({ error: error.message }); }
  }
  async #showRecent() {
    const rows = await this.sessionRepository.listRecent(this.scopeGuard.capture());
    const list = this.root.querySelector('[data-recent-list]');
    list.innerHTML = rows.length ? `<ol>${rows.map((row) => `<li><a href="course-create.html?session=${encodeURIComponent(row.sessionId)}">${String(row.validatedDraft && row.validatedDraft.title || row.brief || '未命名草稿').replace(/[&<>"']/g, '') || '未命名草稿'}</a> · ${row.stage}</li>`).join('')}</ol>` : '<p>本机没有未完成的制作草稿。</p>';
  }
  async #reloadSafe() { try { return await this.service.getSession(this.snapshot.sessionId); } catch (error) { return this.snapshot; } }
  async #render(extra = {}) {
    if (!this.snapshot) return;
    const renderRevision = ++this.renderRevision;
    this.previewUrls.forEach((url) => URL.revokeObjectURL(url)); this.previewUrls = [];
    let previewImageUrls = {};
    let launchUrl = '';
    if (this.snapshot.validatedDraft?.format === 'chunklab-ai-image-text' && this.snapshot.compiledCourse) {
      try { previewImageUrls = await this.service.getPreviewImageUrls(this.snapshot.sessionId); }
      catch (error) { extra = { ...extra, error: extra.error || error.message }; }
    }
    if (this.snapshot.stage === 'complete') {
      try { launchUrl = await this.service.getLaunchUrl(this.snapshot.sessionId); }
      catch (error) { extra = { ...extra, error: extra.error || error.message }; }
    }
    const urls = Object.values(previewImageUrls);
    if (renderRevision !== this.renderRevision) { urls.forEach((url) => URL.revokeObjectURL(url)); return; }
    this.previewUrls = urls;
    const persistence = this.sessionRepository.persistenceWarning || '';
    const parsed = this.service.codec.parseText(this.snapshot.rawResult || '');
    const pairingDraft = parsed.ok && parsed.value && parsed.value.format === 'chunklab-ai-image-text' ? parsed.value : null;
    const imagePairing = pairingDraft ? { images: pairingDraft.images, files: this.uploadedImages.map((file) => file.name), bindings: this.imageBindings } : null;
    this.view.render(this.snapshot, { modes: this.service.capabilityCatalog.describeCreationOptions(), preferenceOptions: CourseCreationPreferences.describeOptions(), manualPrompt: this.manualPrompt, persistence, previewImageUrls, launchUrl, imagePairing, ...extra });
  }
  #status(message) { const node = this.root.querySelector('[role="status"]'); if (node) { node.textContent = [message, this.sessionRepository.persistenceWarning].filter(Boolean).join(' '); node.hidden = !node.textContent; } }
}
