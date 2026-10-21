import { BrowserImageFileReader } from '../course-authoring/adapters/image-file-reader.mjs';
const make = (tag, text) => { const element = document.createElement(tag); if (text !== undefined) element.textContent = text; return element; };
export class CoursePublicationView {
  constructor({ root, request, newRequestId }) {
    this.root = root; this.request = request; this.newRequestId = newRequestId; this.busy = false; this.pending = null; this.prepareId = null;
    const title = make('h2', '发布新的平台课程');
    const note = make('p', '1. 选择 AI 课程 JSON 和配图；2. 校验并审阅；3. 选择免费或会员后发布。这里只创建新课程，现有课程和学习记录保持原样。');
    this.json = make('input'); this.json.type = 'file'; this.json.accept = '.json,application/json';
    this.images = make('input'); this.images.type = 'file'; this.images.accept = 'image/png,image/jpeg,image/webp'; this.images.multiple = true;
    const filesLabel = make('label', '课程 JSON'); filesLabel.append(this.json);
    const imagesLabel = make('label', '图文课的原始配图（单图 ≤ 2 MiB、总图 ≤ 8 MiB）'); imagesLabel.append(this.images);
    this.level = make('select'); this.level.className = 'field'; this.level.setAttribute('aria-label', '访问级别');
    for (const [value, text] of [['free','免费课程'], ['member','会员课程']]) { const option = make('option', text); option.value = value; this.level.append(option); }
    const levelLabel = make('label', '访问级别'); levelLabel.append(this.level);
    this.prepareButton = make('button', '校验并预览'); this.prepareButton.type = 'button'; this.prepareButton.className = 'btn';
    this.publishButton = make('button', '确认发布为新课程'); this.publishButton.type = 'button'; this.publishButton.className = 'btn primary';
    this.preview = make('div'); this.preview.setAttribute('role', 'status');
    this.warning = make('input'); this.warning.type = 'checkbox';
    this.warningLabel = make('label', '我已审阅校验提醒'); this.warningLabel.className = 'publication-warning'; this.warningLabel.prepend(this.warning); this.warningLabel.hidden = true;
    this.status = make('p'); this.status.setAttribute('role', 'status');
    this.saved = make('select'); this.saved.className = 'field'; this.saved.setAttribute('aria-label', '最近的发布草稿');
    const refresh = make('button', '刷新草稿列表'); refresh.type = 'button'; refresh.className = 'btn';
    const restore = make('button', '恢复选中草稿'); restore.type = 'button'; restore.className = 'btn';
    this.root.replaceChildren(title, note, filesLabel, imagesLabel, this.prepareButton, this.preview, levelLabel, this.warningLabel, this.publishButton,
      this.status, make('h3', '最近的发布草稿'), this.saved, refresh, restore);
    const invalidate = () => { this.pending = null; this.prepareId = null; this.preview.textContent = '文件已变更，请重新校验。'; this.sync(); };
    this.json.onchange = this.images.onchange = invalidate;
    this.level.onchange = () => { if (this.pending) this.pending.requestId = newRequestId(); };
    this.warning.onchange = () => this.sync();
    this.prepareButton.onclick = () => this.run(() => this.prepare());
    this.publishButton.onclick = () => this.run(() => this.publish());
    refresh.onclick = () => this.run(() => this.load());
    restore.onclick = () => this.run(async () => { if (!this.saved.value) return; this.showPreview(await request('/api/admin/membership/course-publications/' + encodeURIComponent(this.saved.value))); });
    this.sync();
  }
  sync() {
    for (const input of this.root.querySelectorAll('input,select,button')) input.disabled = this.busy;
    this.publishButton.disabled = this.busy || !this.pending || (!this.warningLabel.hidden && !this.warning.checked);
  }
  async run(action) {
    if (this.busy) return; this.busy = true; this.sync(); this.status.textContent = '正在处理…';
    try { await action(); }
    catch (error) {
      if (error.code === 'REGISTRY_CHANGED' && this.pending) {
        try { this.showPreview(await this.request('/api/admin/membership/course-publications/' + encodeURIComponent(this.pending.publicationId))); }
        catch (_) { this.pending = null; }
      }
      this.status.textContent = error.message || '连接失败，请重试相同操作。';
      if (error.issues) { const list = make('ul'); error.issues.forEach(issue => list.append(make('li', issue.message + ' ' + (issue.suggestion || '')))); this.preview.replaceChildren(list); }
    } finally { this.busy = false; this.sync(); }
  }
  showPreview(result) {
    this.pending = result.status === 'published' ? null : { ...result, requestId: this.newRequestId() };
    this.preview.replaceChildren(make('p', result.title + ' · ' + (result.contentType === 'sentence' ? '句子课程' : '图文课程') + ' · ' + result.itemCount + ' 项 · ' + result.imageCount + ' 张配图'));
    const issues = make('ul'); for (const issue of result.issues || []) issues.append(make('li', issue.message)); this.preview.append(issues);
    this.warningLabel.hidden = !(result.issues || []).some(issue => issue.severity === 'warning'); this.warning.checked = false;
    this.status.textContent = result.status === 'published' ? '该草稿已发布，无需重复发布。' : '校验通过，请审阅内容与提醒，再确认发布。此前已公开或下载的副本无法收回。';
    this.sync();
  }
  async prepare() {
    const file = this.json.files[0]; if (!file) throw new Error('请先选择课程 JSON。');
    if (file.size > 256 * 1024) throw new Error('课程 JSON 不能超过 256 KiB。');
    const selected = Array.from(this.images.files);
    if (selected.length > 12 || selected.some(image => image.size > 2 * 1024 * 1024) || selected.reduce((sum, image) => sum + image.size, 0) > 8 * 1024 * 1024) throw new Error('配图数量或大小超过限制。');
    let draft;
    try { draft = JSON.parse((await file.text()).replace(/^\uFEFF/, '')); } catch (_) { throw new Error('课程 JSON 无法读取，请选择网站支持的课程 JSON 文件。'); }
    const reader = new BrowserImageFileReader();
    const images = await Promise.all(selected.map(async image => { const file = await reader.read(image); return { name: file.name, mimeType: file.mimeType, base64: file.dataUri.split(',')[1] }; }));
    if (!this.prepareId) this.prepareId = this.newRequestId();
    this.showPreview(await this.request('/api/admin/membership/course-publications/prepare', { method: 'POST', body: JSON.stringify({ draft, images, requestId: this.prepareId }) }));
    await this.load();
  }
  async publish() {
    if (!this.pending) return;
    const result = await this.request('/api/admin/membership/course-publications/publish', { method: 'POST', body: JSON.stringify({
      publicationId: this.pending.publicationId, contentHash: this.pending.contentHash, registryVersion: this.pending.registryVersion,
      accessLevel: this.level.value, acceptWarnings: this.warning.checked, requestId: this.pending.requestId
    }) });
    this.pending = null; this.status.textContent = '新课程已发布。';
    const link = make('a', '打开已发布课程'); link.href = 'main.html?protectedCourse=' + encodeURIComponent(result.courseId); this.status.append(' ', link);
    await this.load();
  }
  async load() {
    const result = await this.request('/api/admin/membership/course-publications');
    this.saved.replaceChildren(...result.publications.map(row => { const option = make('option', row.title + (row.status === 'published' ? '（已发布）' : '（草稿）')); option.value = row.publicationId; return option; }));
    if (this.status.textContent === '正在处理…') this.status.textContent = '选择文件进行校验，或恢复已有草稿。';
  }
}
