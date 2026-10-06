export class BrowserIO {
  constructor({ accountStorage = globalThis.AccountStorage, clipboard = globalThis.navigator && globalThis.navigator.clipboard, document = globalThis.document, crypto = globalThis.crypto } = {}) {
    this.accountStorage = accountStorage; this.clipboardPort = clipboard; this.document = document; this.crypto = crypto;
    this.clipboard = { write: (text) => {
      this.#assert();
      if (!this.clipboardPort || typeof this.clipboardPort.writeText !== 'function') return Promise.reject(new Error('浏览器不允许自动复制'));
      return this.clipboardPort.writeText(text).then(() => { this.#assert(); });
    } };
    this.download = { save: (fileName, text, type) => {
      this.#assert();
      if (!this.document || !this.document.createElement || !globalThis.URL || !globalThis.Blob) throw new Error('当前浏览器无法下载课程文件。');
      const url = URL.createObjectURL(new Blob([text], { type })), link = this.document.createElement('a');
      link.href = url; link.download = String(fileName || 'chunklab-course.json').replace(/[\\/:*?"<>|]/g, '-');
      link.click(); URL.revokeObjectURL(url); this.#assert(); return { downloaded: true };
    } };
  }
  #assert() { if (!this.accountStorage || !this.accountStorage.assertCurrent) throw new Error('账号存储尚未就绪。'); this.accountStorage.assertCurrent(); }
  captureScope() { this.#assert(); return Object.freeze({ owner: this.accountStorage.owner, databaseName: this.accountStorage.databaseName, sessionEpoch: this.accountStorage.sessionEpoch }); }
  newId() {
    this.#assert();
    if (this.crypto && typeof this.crypto.randomUUID === 'function') return this.crypto.randomUUID();
    if (this.crypto && typeof this.crypto.getRandomValues === 'function') return Array.from(this.crypto.getRandomValues(new Uint8Array(16))).map((part) => part.toString(16).padStart(2, '0')).join('');
    throw new Error('当前浏览器无法安全创建课程 ID，请使用 HTTPS 或最新版浏览器。');
  }
  guard() {
    let fallback = this.captureScope();
    return { capture: () => this.captureScope(), assert: (scope) => {
      this.#assert();
      if (scope.owner !== fallback.owner || scope.databaseName !== fallback.databaseName || scope.sessionEpoch !== fallback.sessionEpoch) throw Object.assign(new Error('账号或服务已切换。请刷新页面后继续。'), { code: 'SESSION_CHANGED' });
      fallback = scope;
    } };
  }
}
