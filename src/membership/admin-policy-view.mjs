export class CoursePolicyView {
  constructor({ root, request, newRequestId }) {
    this.root = root;
    this.request = request;
    this.newRequestId = newRequestId;
    this.snapshot = null;
    this.pending = null;
    this.busy = false;
    root.querySelector('[data-policy-refresh]').addEventListener('click', () => this.load());
    root.querySelector('[data-policy-preview]').addEventListener('click', () => this.preview());
    root.querySelector('[data-policy-publish]').addEventListener('click', () => this.publish());
    root.querySelector('[data-policy-rows]').addEventListener('change', () => this.invalidate());
  }
  status(text) { this.root.querySelector('[data-policy-status]').textContent = text; }
  setBusy(busy) {
    this.busy = busy;
    for (const selector of ['[data-policy-refresh]', '[data-policy-preview]', '[data-policy-rows] select','[data-policy-source]']) {
      for (const control of this.root.querySelectorAll(selector)) control.disabled = busy;
    }
    this.root.querySelector('[data-policy-publish]').disabled = busy || !this.pending;
  }
  invalidate() {
    this.pending = null;
    this.root.querySelector('[data-policy-publish]').disabled = true;
    this.status('修改后请先检查影响，再发布。');
  }
  async load() {
    if (this.busy) return false;
    this.pending = null;
    this.setBusy(true);
    try {
      const snapshot = await this.request('/api/admin/membership/course-access');
      this.snapshot = snapshot;
      this.pending = null;
      this.root.querySelector('[data-policy-publish]').disabled = true;
      const rows = this.root.querySelector('[data-policy-rows]');
      rows.replaceChildren();
      for (const course of snapshot.courses) {
        const row = document.createElement('tr');
        row.dataset.courseId = course.courseId;
        const name = document.createElement('td');
        name.textContent = course.title;
        const protection = document.createElement('td');
        protection.textContent = course.protectionReady ? '已接入受保护读取' : '尚未完成内容保护';
        if(!course.protectionReady){
          const inspect=document.createElement('button');inspect.type='button';inspect.className='btn secondary';
          inspect.dataset.policySource=course.courseId;inspect.textContent='检查课程来源';
          inspect.setAttribute('aria-label','检查 '+course.title+' 的来源');
          inspect.onclick=()=>this.inspectSources(course);protection.append(' ',inspect);
        }
        const choice = document.createElement('td');
        const select = document.createElement('select');
        select.className = 'field';
        select.setAttribute('aria-label', course.title + '访问级别');
        for (const [value, label] of [['free', '免费课程'], ['member', '会员课程']]) {
          const option = document.createElement('option');
          option.value = value;
          option.textContent = label;
          option.disabled = value === 'member' && !course.protectionReady;
          select.appendChild(option);
        }
        select.value = course.accessLevel;
        choice.appendChild(select);
        row.append(name, protection, choice);
        rows.appendChild(row);
      }
      this.status(snapshot.courses.length ? '选择访问级别后，先检查是否影响共享课程。' : '暂无平台课程。');
      return true;
    } catch (error) {
      this.snapshot = null;
      this.status(error.message || '课程策略暂时无法读取。');
      return false;
    } finally { this.setBusy(false); }
  }
  changes() {
    return this.snapshot.courses.flatMap(course => {
      const row = [...this.root.querySelectorAll('[data-course-id]')].find(item => item.dataset.courseId === course.courseId);
      const accessLevel = row.querySelector('select').value;
      return accessLevel === course.accessLevel ? [] : [{ courseId: course.courseId, baseRevision: course.revision, accessLevel }];
    });
  }
  async inspectSources(course){
    if(this.busy)return;this.setBusy(true);this.status('正在只读检查课程来源…');
    const panel=this.root.querySelector('[data-policy-source-review]');
    try{
      const report=await this.request('/api/admin/membership/course-source-review',{method:'POST',body:JSON.stringify({courseIds:[course.courseId]})});
      if(panel){
        const text=(tag,value)=>{const element=document.createElement(tag);element.textContent=value;return element;};
        const files=document.createElement('details'),list=document.createElement('ul');
        files.append(text('summary','查看来源文件（'+report.sourcePaths.length+' 个）'));
        report.sourcePaths.forEach(file=>list.append(text('li',file)));files.append(list);
        const conflicts=document.createElement('ul');
        report.sharedCourses.forEach(row=>conflicts.append(text('li','共享课程：'+row.title+'（'+row.courseId+'）')));
        report.publicShareConflicts.forEach(row=>conflicts.append(text('li','公开分享题库：'+row.deckId)));
        panel.replaceChildren(text('h3',course.title+' · 来源检查报告'),
          text('p','本地检查完成：'+report.unitCount+' 个课节，'+report.itemCount+' 项内容。尚未启用内容保护，访问级别保持原样。'),
          text('p','共享课程 '+report.sharedCourses.length+' 门；公开分享冲突 '+report.publicShareConflicts.length+' 个。'),
          conflicts,text('p','未检查的公开压缩包/文档 '+report.uninspectedArtifacts.length+' 个。启用前还需核对编码副本、原学习记录与课程入口，以及正式服务器的文件出口。此前已公开的副本无法收回。'),files);
        panel.hidden=false;
      }
      this.status('来源报告已生成；完成启用检查前，会员课程选项仍不可用。');
    }catch(error){this.status(error.message||'来源检查暂不可用，原课程保持原样。');}
    finally{this.setBusy(false);}
  }
  async preview() {
    if (!this.snapshot || this.busy) return;
    const changes = this.changes();
    if (!changes.length) { this.status('尚未修改访问级别。'); return; }
    this.pending = null;
    this.setBusy(true);
    try {
      const result = await this.request('/api/admin/membership/course-access/preview', {
        method: 'POST', body: JSON.stringify({ changes, registryVersion: this.snapshot.version })
      });
      if (result.allowed) {
        this.pending = { changes, registryVersion: this.snapshot.version, requestId: this.newRequestId(), reason: '管理员课程访问设置' };
        this.root.querySelector('[data-policy-publish]').disabled = false;
        this.status('检查通过，将修改 ' + changes.length + ' 门课程。已公开或下载的副本无法追溯收回。');
      } else {
        this.status('无法发布：共享内容仍可由免费课程或公开题库读取。冲突：' +
          result.conflicts.map(row => row.conflictingCourseId || row.publicDeckId).join('、'));
      }
    } catch (error) { this.status(error.message || '检查失败，请刷新后重试。'); }
    finally { this.setBusy(false); }
  }
  async publish() {
    if (!this.pending || this.busy) return;
    const pending = this.pending;
    this.setBusy(true);
    try {
      await this.request('/api/admin/membership/course-access', { method: 'PUT', body: JSON.stringify(pending) });
      this.pending = null;
      this.setBusy(false);
      const loaded = await this.load();
      this.status(loaded ? '课程访问级别已更新。' : '发布已成功，但列表刷新失败，请重新刷新。');
    } catch (error) {
      this.status(error.message || '发布失败，请重试；相同请求不会重复应用。');
    } finally { this.setBusy(false); }
  }
}
