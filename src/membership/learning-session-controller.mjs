const failure = code => Object.assign(new Error(code), { code });

/** Controls permission to advance; saving completed answers stays outside this class. */
export class LearningSessionController {
  /** @param {{client:any,newRequestId:()=>string,monotonicNow?:()=>number,captureScope?:()=>any,onState?:(state:any)=>void,setTimer?:(callback:()=>void,delay:number)=>any,clearTimer?:(id:any)=>void}} options */
  constructor({ client, newRequestId, monotonicNow = () => performance.now(),
    captureScope = () => '', onState = state => { void state; },
    setTimer = (callback, delay) => globalThis.setTimeout(callback, delay), clearTimer = id => globalThis.clearTimeout(id) }) {
    this.client = client;
    this.newRequestId = newRequestId;
    this.now = monotonicNow;
    this.captureScope = captureScope;
    this.onState = onState;
    this.setTimer = setTimer;
    this.clearTimer = clearTimer;
    this.scope = captureScope();
    this.epoch = 0;
    this.current = null;
    this.pendingStart = null;
    this.pendingAction = null;
    this.busy = false;
    this.visible = true;
    this.requestedPause = false;
    this.phase = 'idle';
    this.heartbeatTimer = null;
    this.deadlineTimer = null;
  }
  emit(reasonCode = null) {
    this.onState({ phase: this.phase, reasonCode, mode: this.current?.mode,
      remainingDeadline: this.current?.remainingDeadline,
      remainingSeconds: this.current?.remainingSeconds, nextResetAt: this.current?.nextResetAt,
      canAdvance: this.canAdvance() });
  }
  stopTimers() {
    this.clearTimer(this.heartbeatTimer);
    this.clearTimer(this.deadlineTimer);
    this.heartbeatTimer = this.deadlineTimer = null;
  }
  assertScope() {
    if (this.scope !== this.captureScope()) {
      this.reset();
      throw failure('SESSION_CHANGED');
    }
  }
  reset() {
    this.epoch++;
    this.stopTimers();
    this.current = this.pendingStart = this.pendingAction = null;
    this.phase = 'idle';
    this.requestedPause = false;
    this.scope = this.captureScope();
  }
  canAdvance() {
    return this.scope === this.captureScope() && this.visible && this.phase === 'active' &&
      !!this.current && this.now() < this.current.deadline;
  }
  apply(result, sentAt) {
    if (!result.allowed && result.allowed !== undefined) throw failure(result.reasonCode || 'SERVICE_UNAVAILABLE');
    const mode = result.mode || this.current?.mode;
    const end = mode === 'trial' ? result.leaseEndsAt : mode === 'member' ? result.endsAt : Infinity;
    if (mode !== 'free' && (!Number.isFinite(end) || !Number.isFinite(result.serverNow))) throw failure('SERVICE_UNAVAILABLE');
    const { unit, ...metadata } = result; void unit;
    this.current = { ...this.current, ...metadata, mode, sequence: result.sequence ?? this.current?.sequence ?? 0,
      remainingDeadline: result.remainingSeconds !== undefined ? sentAt + result.remainingSeconds * 1000 : this.current?.remainingDeadline,
      deadline: mode === 'free' ? Infinity : sentAt + Math.max(0, end - result.serverNow) };
    this.phase = this.visible && !this.requestedPause ? 'active' : 'paused';
    this.schedule();
    this.emit();
  }
  schedule() {
    this.stopTimers();
    if (this.phase !== 'active' || !this.current) return;
    const remaining = this.current.deadline - this.now();
    if (Number.isFinite(remaining)) this.deadlineTimer = this.setTimer(() => {
      if (this.now() < this.current?.deadline) { this.schedule(); return; }
      this.phase = 'blocked'; this.stopTimers(); this.emit('AUTHORIZATION_EXPIRED');
    }, Math.max(0, Math.min(remaining, 2147483647)));
    if (this.current.mode === 'trial') this.heartbeatTimer = this.setTimer(() => {
      this.heartbeat().catch(() => {});
    }, Math.min(15000, Math.max(0, remaining)));
  }
  async start(input) {
    this.assertScope();
    if (!this.visible) throw failure('PAGE_HIDDEN');
    if (this.busy) throw failure('REQUEST_IN_PROGRESS');
    if (this.pendingAction) await this.sendAction();
    if (this.current?.sessionId && this.phase === 'active') throw failure('SESSION_IN_USE');
    const payload = { ...input };
    delete payload.requestId;
    if (this.pendingStart && JSON.stringify(this.pendingStart.input) !== JSON.stringify(payload)) throw failure('START_RETRY_REQUIRED');
    if (!this.pendingStart) this.pendingStart = { input: payload, requestId: this.newRequestId() };
    const sentAt = this.now(), epoch = this.epoch;
    this.requestedPause = false;
    this.busy = true;
    this.phase = 'loading';
    this.emit();
    try {
      const result = await this.client.start({ ...payload, requestId: this.pendingStart.requestId });
      this.assertScope();
      if (epoch !== this.epoch) throw failure('SESSION_CHANGED');
      this.pendingStart = null;
      this.apply(result, sentAt);
      return result;
    } catch (error) {
      if (epoch === this.epoch) {
        if (error.status || error.code === 'SESSION_CHANGED') this.pendingStart = null;
        this.phase = 'blocked'; this.stopTimers(); this.emit(error.code || 'CONNECTION_FAILED');
      }
      throw error;
    } finally {
      this.busy = false;
      if ((!this.visible || this.requestedPause) && this.current?.mode === 'trial' && epoch === this.epoch) this.pause().catch(() => {});
    }
  }
  async sendAction() {
    this.assertScope();
    if (this.busy) throw failure('REQUEST_IN_PROGRESS');
    const pending = this.pendingAction;
    if (!pending) return;
    const epoch = this.epoch, sentAt = this.now();
    this.busy = true;
    try {
      const result = await this.client.action(pending.sessionId, pending.sequence, pending.action);
      this.assertScope();
      if (epoch !== this.epoch) throw failure('SESSION_CHANGED');
      this.pendingAction = null;
      if (pending.action === 'heartbeat') this.apply(result, sentAt);
      else { this.phase = 'paused'; this.current = null; this.stopTimers(); this.emit(); }
      return result;
    } catch (error) {
      if (epoch === this.epoch) {
        if (error.status) this.pendingAction = null;
        // A lost heartbeat may have committed. Retry its original sequence before pause.
        if (pending.action !== 'heartbeat' || !this.canAdvance()) this.phase = 'blocked';
        this.emit(error.code || 'CONNECTION_FAILED');
      }
      throw error;
    } finally {
      this.busy = false;
    }
  }
  async heartbeat() {
    this.assertScope();
    if (!this.current || this.current.mode !== 'trial' || !this.visible) return;
    if (!this.pendingAction) this.pendingAction = { sessionId: this.current.sessionId, sequence: this.current.sequence + 1, action: 'heartbeat' };
    try { return await this.sendAction(); }
    finally { if ((!this.visible || this.requestedPause) && !this.busy && !this.pendingAction) this.pause().catch(() => {}); }
  }
  async pause() {
    this.assertScope();
    this.requestedPause = true;
    this.phase = 'paused'; this.stopTimers(); this.emit();
    if (this.busy || !this.current || this.current.mode !== 'trial') return;
    if (this.pendingAction) await this.sendAction();
    if (!this.current) return;
    this.pendingAction = { sessionId: this.current.sessionId, sequence: this.current.sequence + 1, action: 'pause' };
    return this.sendAction();
  }
  async read(courseId, unitId, cursor) {
    this.assertScope();
    if (!this.canAdvance()) throw failure('AUTHORIZATION_REQUIRED');
    const epoch = this.epoch, sentAt = this.now();
    try {
      const result = await this.client.read(courseId, unitId, cursor, this.current.sessionId);
      this.assertScope();
      if (epoch !== this.epoch || !this.canAdvance()) throw failure('AUTHORIZATION_EXPIRED');
      this.apply(result, sentAt);
      return result;
    } catch (error) {
      if (epoch === this.epoch && error.status) { this.phase = 'blocked'; this.stopTimers(); this.emit(error.code || 'SERVICE_UNAVAILABLE'); }
      throw error;
    }
  }
  setVisible(visible) {
    this.visible = !!visible;
    if (!visible) this.pause().catch(() => {});
    // Becoming visible requires an explicit start at the retained course position.
  }
  bindVisibility(doc, win) {
    const changed = () => this.setVisible(doc.visibilityState === 'visible');
    const pagehide = () => this.setVisible(false);
    doc.addEventListener('visibilitychange', changed);
    win.addEventListener('pagehide', pagehide);
    changed();
    return () => { doc.removeEventListener('visibilitychange', changed); win.removeEventListener('pagehide', pagehide); this.setVisible(false); };
  }
}
