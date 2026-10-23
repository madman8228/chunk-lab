import { CourseContentGateway, PersonalCourseSource } from './course-content-gateway.mjs';
import { PlatformCourseSource } from './platform-course-source.mjs';
import { MembershipClient } from '../membership/client.mjs';
import { LearningSessionController } from '../membership/learning-session-controller.mjs';
import { CourseImageCache, imageCacheScope } from './course-image-cache.mjs';
import {createOfflineCourseCache} from './offline-course-cache.mjs';

const messages = {
  AUTH_REQUIRED: '请先登录，再查看个人学习内容。', NOT_AUTH: '登录已过期，请重新登录后继续。',
  SERVER_SEQ_ROLLBACK: '学习数据版本需要核查，原记录已保留。请联系管理员协助检查。',
  SERVER_IDENTITY_REQUIRED: '服务端未确认账号，已暂停同步；本地记录保留。请更新服务后重试。',
  SERVER_IDENTITY_MISMATCH: '服务端响应账号不一致，已暂停同步；本地记录保留。',
  SERVER_UPDATE_REQUIRED: '服务端版本或登录配置需要更新，原有记录已保留。',
  CONTENT_PREPARATION_REQUIRED: '课程暂时无法开始，请稍后重试。原课程和记录仍然保留。',
  SESSION_REQUIRED: '学习记录尚未确认，试学暂未启动；请确认记录后重试，不会消耗试学额度。',
  TRIAL_DAILY_LIMIT: '本周期体验时长已用完。可等待额度恢复，或兑换会员继续。',
  TRIAL_EXPIRED: '免费体验已结束，可兑换会员继续学习。', MEMBERSHIP_REQUIRED: '当前没有有效会员，可兑换会员继续学习。',
  TRIAL_DISABLED: '本课程暂未开放体验，可兑换会员学习。', SESSION_IN_USE: '另一个页面正在试学，请先暂停该页面。',
  AUTHORIZATION_EXPIRED: '学习已暂停，请点“继续学习”。当前位置和已完成答案保留。',
  SESSION_CHANGED: '登录账号已变化，请刷新后继续。', CONTENT_VERSION_CHANGED: '课程版本已变化，请返回课程库重新进入。',
  INVALID_OFFLINE_LICENSE: '离线许可已过期或无法确认，请联网后继续。原内容和答题记录保留。',
  UNIT_NOT_CACHED: '本课节尚未离线保存，请先联网打开并开始学习。',
  OFFLINE_ENROLLMENT_REQUIRED: '请先联网将本课程加入学习，再离线继续。',
  ASSESSMENT_NOT_ELIGIBLE: '这项内容尚未到复测时间，请按原复测周期稍后再试。'
};
const errorText = error => messages[error?.code] || (error?.message?.includes('最多加入') ? error.message : '课程暂时无法读取，请检查网络后重试。学习记录仍然保留。');
function element(doc, tag, text, className) { const node = doc.createElement(tag); if (text) node.textContent = text; if (className) node.className = className; return node; }
function placeAccessPanel(host, panel) {
  const toolbar = host.querySelector('.practice-toolbar');
  if (toolbar) toolbar.after(panel); else host.prepend(panel);
}

export function projectNativeBatch(batch, title, unitCount) {
  const identity = batch.recordIdentity;
  if (!identity?.deckId || !identity.generationScope?.startsWith('course:')) throw Object.assign(new Error('CONTENT_IDENTITY_INVALID'), { code: 'CONTENT_IDENTITY_INVALID' });
  const items = batch.items.map(source => {
    if (batch.contentType === 'sentence') return { ...structuredClone(source), chunks: source.chunks?.length ? source.chunks : [source.sentence] };
    const text = typeof source.text === 'string' ? { en: source.text } : source.text || {};
    const chunkSet = source.chunks;
    const chunks = Array.isArray(chunkSet) ? chunkSet : chunkSet?.correctOrder?.map(id => chunkSet.items.find(chunk => chunk.id === id)?.text.trim());
    return { ...structuredClone(source), cid: source.id, sentence: text.en, translation: text['zh-CN'] || '',
      chunks: chunks?.length ? chunks : [text.en], hints: source.hints || [],
      ...(chunkSet?.distractors?.length ? { distractors: chunks.map(() => chunkSet.distractors.map(chunk => chunk.text)) } : {}) };
  });
  if (items.some(item => !Array.isArray(item.chunks) || !item.chunks.length || item.chunks.some(chunk => typeof chunk !== 'string' || !chunk.trim()))) throw Object.assign(new Error('CONTENT_CHUNKS_INVALID'), { code: 'CONTENT_CHUNKS_INVALID' });
  const authoring = batch.context?.authoring || (batch.learning ? { template: 'sentence-practice', templateVersion: 1,
    learning: batch.learning, contentForm: batch.contentType === 'image-text' ? 'article' : 'sentences', roles: batch.context?.roles || [] } : undefined);
  return { id: identity.deckId, name: title, short: title, builtin: true, items, itemCount: unitCount, statsDeckId: identity.deckId, _reviewOnly: false,
    ...(authoring ? { authoring } : {}), _recordIdentity: identity,
    _sourceIndices: items.map((_, index) => batch.cursor + index),
    _contentBatch: { startCursor: batch.cursor, nextCursor: batch.nextCursor, done: batch.nextCursor === null,
      remainingCount: Math.max(0, unitCount - batch.cursor - items.length) } };
}

/** Authorization shell and source adapter only. Native main activities own all rendering/scoring/recording. */
export class NativeCourseSession {
  /** @param {{host:HTMLElement,courseId:string,unitId?:string,getMem:()=>any,onBatch:(deck:any,fromIdx:number,generation:number)=>void,win?:any}} options */
  constructor({ host, courseId, unitId, origin = 'platform', getMem, onBatch, win = window }) {
    this.win = win; this.host = host; this.courseId = courseId; this.unitId = unitId; this.origin = origin; this.getMem = getMem; this.onBatch = onBatch;
    this.disposed = false; this.urls = new Set(); this.busy = false; this.cursor = 0;
    const doc = host.ownerDocument;
    this.panel = element(doc, 'section', '', 'course-access-panel'); this.panel.setAttribute('aria-live', 'polite');
    this.status = element(doc, 'p', '正在读取课程和学习记录…'); this.button = element(doc, 'button', '开始学习', 'btn primary'); this.button.hidden = true;
    this.button.onclick = () => this.start(this.started).catch(error => this.showError(error));
    const account = element(doc, 'a', '账号与兑换会员', 'btn'); account.href = 'main.html?membership=1&returnTo=' + encodeURIComponent(win.location.pathname + win.location.search);
    this.panel.append(this.status, this.button, account); placeAccessPanel(host, this.panel);
    host.classList.add('course-awaiting-content');
    this.captureScope = () => JSON.stringify([win.AccountStorage.owner, win.AccountStorage.sessionEpoch, win.ChunkAPI.getBase(), win.ChunkAPI.getToken()]);
    this.scope = this.captureScope();
    if (origin === 'personal') {
      const readBatch = async (reference, cursor, releaseId) => {
        this.guard();
        const query = new URLSearchParams({ cursor: String(cursor) });
        if (releaseId) query.set('releaseId', releaseId);
        try {
          const result = await win.ChunkAPI.request('/api/course-library/' + encodeURIComponent(reference.courseId) + '/batch?' + query,
            { timeoutMs: 15000 });
          this.guard(); return result;
        } catch (error) { this.guard(); throw Object.assign(error, { code: error.code || 'CONTENT_UNAVAILABLE' }); }
      };
      this.personalRepository = {
        open: (reference, options = {}) => readBatch(reference, options.cursor || 0),
        loadBatch: (reference, cursor) => readBatch(reference, cursor, this.contentVersion),
        loadAssets: async (reference, assetId) => {
          this.guard();
          const owner = JSON.parse(win.AccountStorage.owner), expectedAccount = String(owner[1]);
          const query = new URLSearchParams({ releaseId: this.contentVersion });
          const url = win.ChunkAPI.getBase() + '/api/course-library/' + encodeURIComponent(reference.courseId) +
            '/assets/' + encodeURIComponent(assetId) + '?' + query;
          const download = async () => {
            const response = await win.fetch(url, { method: 'GET', cache: 'no-store', headers: { Authorization: 'Bearer ' + win.ChunkAPI.getToken() } });
            this.guard();
            if (response.headers.get('X-ChunkLab-Account-Id') !== expectedAccount) throw Object.assign(new Error('服务端素材响应账号不一致；本地学习记录未改变。'), { code: 'SERVER_IDENTITY_MISMATCH' });
            if (!response.ok) { const detail = await response.json().catch(() => ({})); throw Object.assign(new Error(detail.error || '课程素材暂时无法读取。'), { code: detail.code || 'CONTENT_UNAVAILABLE', status: response.status }); }
            const blob = await response.blob(); this.guard();
            if (!blob.size || !/^(image\/(png|jpeg|webp)|audio\/(mpeg|ogg|wav))$/.test(blob.type)) throw Object.assign(new Error('课程素材格式无法确认。'), { code: 'INVALID_COURSE_ASSET' });
            return blob;
          };
          return new CourseImageCache(win).load({ scope: imageCacheScope(win), courseId: reference.courseId,
            contentVersion: this.contentVersion, assetId, download, guard: () => this.guard() });
        }
      };
      this.personalSource = new PersonalCourseSource({ repository: this.personalRepository, captureScope: this.captureScope });
      this.gateway = new CourseContentGateway({ sources: { personal: this.personalSource }, captureScope: this.captureScope });
      this.unbind = null;
      this.controller = null;
      this.client = null;
    } else {
      this.client = new MembershipClient({ request: (url, options) => win.ChunkAPI.request(url, options),
        readCatalog: () => win.ChunkAPI.getCourseCatalog() });
      this.controller = new LearningSessionController({ client: this.client, newRequestId: () => win.crypto.randomUUID(), captureScope: this.captureScope,
        onState: state => { if (!this.disposed && ['blocked', 'paused'].includes(state.phase) && this.started) this.showError({ code: 'AUTHORIZATION_EXPIRED' }); } });
      const source = new PlatformCourseSource({ client: this.client, controller: this.controller, newRequestId: () => win.crypto.randomUUID(),
        imageCache: new CourseImageCache(win), captureImageScope: () => imageCacheScope(win),
        fetchResource: async (url, headers, type) => {
          this.guard();
          const response = await win.fetch(win.ChunkAPI.getBase() + url, { headers: { ...headers, Authorization: 'Bearer ' + win.ChunkAPI.getToken() }, cache: 'no-store' });
          this.guard();
          if (!response.ok) { const result = await response.json().catch(() => ({})); throw Object.assign(new Error(result.reasonCode || 'CONTENT_UNAVAILABLE'), { code: result.reasonCode, status: response.status }); }
          return type === 'blob' ? response.blob() : response.json();
        } });
      this.offlineCache=createOfflineCourseCache(win);
      this.gateway = new CourseContentGateway({ sources: { platform: source, offline:this.offlineCache.source }, captureScope: this.captureScope });
      this.unbind = this.controller.bindVisibility(doc, win);
    }
  }
  get phase() {
    if (this.disposed) return 'disposed';
    if (this.lastError) return 'blocked';
    return this.started ? (this.controller?.phase || 'active') : 'idle';
  }
  guard() { if (this.disposed || this.scope !== this.captureScope()) throw Object.assign(new Error('SESSION_CHANGED'), { code: 'SESSION_CHANGED' }); }
  async open() {
    if (this.origin === 'personal') {
      if (!this.win.ChunkAPI.isLoggedIn()) throw Object.assign(new Error('AUTH_REQUIRED'), { code: 'AUTH_REQUIRED' });
      const first = await this.personalRepository.open({ courseId: this.courseId, unitId: 'default' }, { cursor: 0 }); this.guard();
      this.unitId = first.unitId;
      this.course = { courseId: this.courseId, title: first.title, accessLevel: 'free', units: [{
        unitId: first.unitId, itemCount: first.itemCount, recordIdentity: first.recordIdentity
      }] };
      this.unit = this.course.units[0];
      const requested = new URL(this.win.location.href).searchParams.get('reviewItem');
      this.reviewOnly = !!requested;
      this.cursor = 0;
      this.status.textContent = this.course.title + ' · 个人课程';
      this.button.textContent = '开始学习'; this.button.hidden = false;
      return this;
    }
    let catalog;
    try{
      if(this.win.navigator?.onLine===false)throw new TypeError('offline');
      catalog=await this.client.catalog();
    }
    catch(error){
      if(error.status||!(error instanceof TypeError||error.name==='AbortError'||error.code==='REQUEST_TIMEOUT'))throw error;
      catalog=await this.offlineCache.catalog(this.courseId,this.unitId);this.offline=true;
    }
    this.guard();
    this.course = catalog.courses.find(course => course.courseId === this.courseId);
    if(this.course?.contentType==='expression'){
      const target=new URL('expression-learn.html',this.win.location.href);
      target.searchParams.set('course',this.courseId);
      const source=new URL(this.win.location.href).searchParams.get('returnTo');
      if(source)target.searchParams.set('returnTo',source);
      this.win.location.replace(target.href);return this;
    }
    this.unit = this.course?.units.find(unit => unit.unitId === this.unitId) || (!this.unitId && this.course?.units[0]);
    if (!this.unit?.recordIdentity) throw Object.assign(new Error('CONTENT_PREPARATION_REQUIRED'), { code: 'CONTENT_PREPARATION_REQUIRED' });
    this.unitId = this.unit.unitId;
    if (this.course.units.length > 1 && !this.unitSelect) {
      this.unitSelect = element(this.host.ownerDocument, 'select'); this.unitSelect.setAttribute('aria-label', '课节');
      this.course.units.forEach((unit, index) => { const option = element(this.host.ownerDocument, 'option', '第 ' + (index + 1) + ' 节'); option.value = unit.unitId; this.unitSelect.append(option); });
      this.unitSelect.value = this.unitId;
      this.unitSelect.onchange = () => { const url = new URL(this.win.location.href); url.searchParams.set('unit', this.unitSelect.value); this.win.location.assign(url.href); };
      this.panel.prepend(this.unitSelect);
    }
    const saved = this.getMem().progress?.[this.unit.recordIdentity.deckId];
    const requested = new URL(this.win.location.href).searchParams.get('reviewItem');
    this.reviewOnly = !!requested;
    const itemCursor = requested ? this.unit.itemIds.indexOf(requested) : -1;
    this.cursor = itemCursor >= 0 ? itemCursor : Math.min(this.unit.itemCount - 1, Math.max(0, Number(saved?.idx) || 0));
    this.status.textContent = this.course.title + (this.course.accessLevel === 'member' ? ' · 会员课程' : ' · 免费课程');
    this.button.textContent = saved ? '继续学习' : '开始学习'; this.button.hidden = false;
    return this;
  }
  showError(error) {
    this.lastError = error;
    if (this.disposed) return;
    this.host.classList.add('course-awaiting-content');
    const paused = ['AUTH_REQUIRED','NOT_AUTH','SERVER_SEQ_ROLLBACK','SERVER_IDENTITY_REQUIRED','SERVER_IDENTITY_MISMATCH','SERVER_UPDATE_REQUIRED'].includes(error?.code);
    this.panel.hidden = false; this.status.textContent = errorText(error); this.button.hidden = paused; this.button.textContent = this.started ? '继续学习' : '重试';
    this.button.disabled = false;
  }
  updateClock() {
    if (this.disposed || !this.started || !this.button.hidden) return;
    if (this.origin === 'personal') { this.status.textContent = '个人课程 · 学习记录由当前账号保存'; return; }
    if(this.offline){
      const claims=this.offlineCache.source.claims;
      this.status.textContent=claims?.expiresAt?'离线学习 · 许可有效至 '+new Date(claims.expiresAt).toLocaleString():'离线学习 · 已保存的免费课节';
      return;
    }
    if (!this.controller?.current) return;
    const current=this.controller.current;
    if(current.mode==='free')this.status.textContent='免费课程 · 不限时';
    else if(current.mode==='member')this.status.textContent='会员有效至 '+new Date(current.endsAt).toLocaleString();
    else {
      const seconds=Math.max(0,Math.ceil(((current.remainingDeadline||current.deadline)-this.controller.now())/1000));
      this.status.textContent='本周期体验剩余 '+String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
    }
  }
  async start(preserve = false) {
    this.guard(); if (this.busy) return; this.busy = true; this.button.disabled = true;
    try {
      if (!this.course) await this.open();
      let result = null, learningError = null, snapshot = null;
      if (this.origin === 'personal') result = await this.gateway.open(
        { origin: this.origin, courseId: this.courseId, unitId: this.unitId }, { cursor: 0 });
      try {
        await this.win.LearningSessionBootstrap.ready({allowConfirmedOffline:!!this.offline}); this.guard();
        snapshot = await this.win.ServerCache.read(); this.guard();
        if (!snapshot || snapshot.owner !== this.win.AccountStorage.owner) learningError = Object.assign(
          new Error('学习记录尚未确认'), { code: 'LEARNING_STATE_UNCONFIRMED' });
      } catch (error) { learningError = error; }
      if (learningError) {
        if(this.offline)throw learningError;
        this.cursor = 0;
        if (this.origin !== 'personal') result = await this.gateway.open(
          { origin: this.origin, courseId: this.courseId, unitId: this.unitId }, { cursor: this.cursor, purpose: 'preview' });
        this.guard(); await this.showReadOnlyPreview(result.batch, learningError); return;
      }
      if (this.origin !== 'personal' && !this.win.CourseEnrollment.isJoined(this.courseId)) {
        if(this.offline)throw Object.assign(new Error('请先联网将本课程加入学习，再离线继续。'),{code:'OFFLINE_ENROLLMENT_REQUIRED'});
        await this.win.CourseEnrollment.join(this.courseId);
      }
      this.guard();
      this.generation = Number(snapshot.snapshot.learningGenerations?.[this.unit.recordIdentity.generationScope]) || 0;
      if (this.origin === 'personal') {
        const saved = this.getMem().progress?.[this.unit.recordIdentity.deckId];
        this.cursor = Math.min(this.unit.itemCount - 1, Math.max(0, Number(saved?.idx) || 0));
        result = this.cursor === 0 ? result : await this.gateway.open(
          { origin: this.origin, courseId: this.courseId, unitId: this.unitId }, { cursor: this.cursor });
      } else result = await this.gateway.open(
        { origin: this.offline?'offline':this.origin, courseId: this.courseId, unitId: this.unitId }, { cursor: this.cursor });
      this.guard();
      if (preserve && this.contentVersion !== result.contentVersion) throw Object.assign(new Error('CONTENT_VERSION_CHANGED'), { code: 'CONTENT_VERSION_CHANGED' });
      this.contentVersion = result.contentVersion;
      this.lastError = null; this.readOnlyPreview = false; this.started = true; this.button.hidden = true;
      this.updateClock();
      if(!this.clockTimer)this.clockTimer=this.win.setInterval(()=>this.updateClock(),1000);
      if (!preserve) await this.deliver(result.batch);
      if(this.origin!=='personal'&&!this.offline&&['free','member'].includes(this.controller?.current?.mode))this.offlineCache.prepare(this.course,this.unit).then(()=>{
        if(!this.disposed)this.status.textContent='本课节文字已保存，可离线继续学习。';
      }).catch(error=>{
        if(!this.disposed)this.status.textContent='当前可学习；本课节离线保存未完成。';
      });
    } catch (error) { this.showError(error); throw error; }
    finally { this.busy = false; this.button.disabled = false; }
  }
  async showReadOnlyPreview(batch, error) {
    this.guard();
    this.contentVersion = this.gateway.contentVersion;
    this.readOnlyPreview = true; this.lastError = error;
    this.status.textContent = '课程内容已加载；学习记录尚未确认，当前为只读预览。';
    this.button.textContent = '重试确认学习记录'; this.button.hidden = false;
    await this.deliver(batch, true);
    this.guard();
    if (this.origin !== 'personal') await this.controller.pause().catch(() => {});
  }
  async deliver(batch, readOnly = false) {
    this.guard(); const deck = projectNativeBatch(batch, this.course.title, this.unit.itemCount);
    if (readOnly) deck._learningReadOnly = true;
    if (this.reviewOnly) {
      deck.id = 'rev-native-' + this.win.crypto.randomUUID(); deck.statsDeckId = batch.recordIdentity.deckId;
      deck.items = deck.items.slice(0, 1); deck._sourceIndices = [batch.cursor]; deck._contentBatch = null;
      deck._reviewOnly = true;
    }
    for(let index=deck.items.length-1;index>=0;index--){
      if(this.win.CL.isItemDeleted(this.getMem(),batch.recordIdentity.deckId,deck.items[index])){
        deck.items.splice(index,1);deck._sourceIndices.splice(index,1);
      }
    }
    const urls = new Set(), assetUrls = new Map();
    try {
    for (const item of deck.items) {
      for (const [field, target] of [['imageAssetId', '_courseImageUrl'], ['audioAssetId', '_courseAudioUrl']]) {
        if (!item[field]) continue;
        if(this.offline)continue; // Text remains usable when optional media was not saved.
        if (assetUrls.has(item[field])) { item[target] = assetUrls.get(item[field]); continue; }
        const blob = await this.gateway.loadAssets(item[field]); this.guard(); const url = this.win.URL.createObjectURL(blob); urls.add(url); item[target] = url;
        assetUrls.set(item[field], url);
      }
    }
    this.releaseUrls(); this.urls = urls;
    Object.defineProperty(deck, '_platformSession', { value: this, enumerable: false });
    this.host.classList.remove('course-awaiting-content');
    this.cursor = batch.cursor; this.onBatch(deck, 0, this.generation);
    this.prefetchNext();
    } catch(error) { for(const url of urls)this.win.URL.revokeObjectURL(url); throw error; }
  }
  prefetchNext() {
    if(this.reviewOnly)return;
    const batch = this.gateway.cache.get(this.cursor);
    if (batch?.nextCursor != null) this.gateway.loadBatch(batch.nextCursor, { prefetch: true }).catch(() => {});
  }
  async advance(callback) {
    this.guard(); if (this.busy) return; this.busy = true;
    try { await this.gateway.loadBatch(this.cursor); this.guard(); callback(); }
    catch (error) { this.showError(error); }
    finally { this.busy = false; }
  }
  async nextBatch() {
    this.guard(); if (this.busy) return; this.busy = true;
    try { const current = this.gateway.cache.get(this.cursor); if (current?.nextCursor == null) return;
      const batch = await this.gateway.loadBatch(current.nextCursor); await this.deliver(batch); }
    catch (error) { this.showError(error); }
    finally { this.busy = false; }
  }
  releaseUrls() { for (const url of this.urls) this.win.URL.revokeObjectURL(url); this.urls.clear(); }
  dispose() { if (this.disposed) return; this.disposed = true; this.win.clearInterval(this.clockTimer); this.unbind?.(); this.gateway.dispose(); this.releaseUrls(); this.panel.remove(); }
}

export async function mountNativeCourse(options) {
  const session = new NativeCourseSession(options);
  try { await session.open(); } catch (error) { session.showError(error); }
  return session;
}

/** Single-item authorization/start shell, reusing the existing formal assessment renderer and record queue. */
/** @param {{host:HTMLElement,courseId:string,unitId?:string,itemId:string,onSession:(session:any,result:any,metadata:any)=>any,win?:any}} options */
export async function mountNativeAssessment({ host, courseId, unitId, itemId, onSession, win = globalThis.window }) {
  const scope = () => JSON.stringify([win.AccountStorage.owner, win.AccountStorage.sessionEpoch, win.ChunkAPI.getBase(), win.ChunkAPI.getToken()]);
  const captured = scope(), doc = host.ownerDocument;
  let disposed = false;
  const guard = () => { if (disposed || scope() !== captured) throw Object.assign(new Error('SESSION_CHANGED'), { code: 'SESSION_CHANGED' }); };
  const panel = element(doc, 'section', '', 'course-access-panel'), status = element(doc, 'p', '独立测评 · 资格和权限将在开始时检查。');
  const button = element(doc, 'button', '开始测评这一项', 'btn primary'); panel.append(status, button); placeAccessPanel(host, panel);
  const url = new URL(win.location.href);
  const id = url.searchParams.get('assessmentId') || win.crypto.randomUUID(); url.searchParams.set('assessmentId', id); win.history.replaceState({}, '', url);
  const client = new MembershipClient({ request: (path, options) => win.ChunkAPI.request(path, options) });
  const controller = new LearningSessionController({ client: { start: input => client.startAssessment({ ...input, itemId, assessmentId: id }), action: (...args) => client.action(...args) },
    newRequestId: () => win.crypto.randomUUID(), captureScope: scope });
  const unbind = controller.bindVisibility(doc, win);
  const accept = async remote => {
    guard(); const drafts = await win.IDBStore.listAssessmentDrafts(); guard();
    const draft = drafts.find(row => row.sessionId === id);
    // Completed/queued local answers remain durable even when the remote result has not arrived yet.
    const session = remote.session.status === 'active' && draft?.data?.revision >= remote.session.revision ? draft.data : remote.session;
    button.hidden = true; status.textContent = session.status==='completed'?'测评结果已保存。':'测评已开始；已完成答案仍会保存。'; await onSession(session, remote.result, draft?.metadata || {});
  };
  button.onclick = async () => {
    button.disabled = true;
    try { guard(); const result = await controller.start({ courseId, unitId }); await accept(result); }
    catch (error) { status.textContent = errorText(error); }
    finally { button.disabled = false; }
  };
  await win.LearningSessionBootstrap.ready(); guard();
  try { await accept(await win.ChunkAPI.getAssessmentSession(id)); }
  catch (error) { if (error.status !== 404) status.textContent = errorText(error); }
  return { dispose() { disposed = true; unbind(); controller.pause().catch(() => {}).finally(() => controller.reset()); panel.remove(); } };
}
