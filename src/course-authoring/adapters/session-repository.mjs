const connections = new Map();
const DB_SUFFIX = '-authoring-v1';
function scopeKey(scope) { return String(scope && scope.databaseName || ''); }

export class BrowserAuthoringSessionRepository {
  constructor({ indexedDB = globalThis.indexedDB, scopeGuard }) {
    if (!scopeGuard) throw new Error('会话草稿需要账号作用域保护');
    this.indexedDB = indexedDB; this.scopeGuard = scopeGuard;
  }

  #open(scope) {
    this.scopeGuard.assert(scope);
    if (!this.indexedDB) return Promise.reject(new Error('浏览器未提供本机草稿存储。'));
    const name = scopeKey(scope) + DB_SUFFIX;
    if (!name) return Promise.reject(new Error('账号草稿库名称为空。'));
    if (connections.has(name)) return connections.get(name);
    const pending = new Promise((resolve, reject) => {
      const request = this.indexedDB.open(name, 2);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('sessions')) request.result.createObjectStore('sessions', { keyPath: 'sessionId' });
        if (!request.result.objectStoreNames.contains('assets')) {
          const assets = request.result.createObjectStore('assets', { keyPath: ['sessionId', 'assetId'] });
          assets.createIndex('by-session', 'sessionId', { unique: false });
        }
      };
      request.onsuccess = () => { const db = request.result; db.onversionchange = () => { db.close(); connections.delete(name); }; resolve(db); };
      request.onerror = () => reject(request.error || new Error('无法打开本机制作草稿。'));
      request.onblocked = () => reject(new Error('请关闭其他制作页面后再打开草稿。'));
    });
    connections.set(name, pending); pending.catch(() => connections.delete(name));
    return pending;
  }

  async load(sessionId, scope) {
    const db = await this.#open(scope); this.scopeGuard.assert(scope);
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sessions', 'readonly'), req = tx.objectStore('sessions').get(sessionId);
      req.onsuccess = () => { try { this.scopeGuard.assert(scope); resolve(req.result || null); } catch (error) { reject(error); } };
      req.onerror = () => reject(req.error || new Error('无法读取本机制作草稿。'));
      tx.onabort = () => reject(tx.error || new Error('无法读取本机制作草稿。'));
    });
  }

  async save(snapshot, scope, expectedRevision, assetDelta = null) {
    this.scopeGuard.assert(scope);
    if (!snapshot || snapshot.identity.owner !== scope.owner || snapshot.identity.databaseName !== scope.databaseName) throw new Error('账号已切换，未保存其他账号的草稿。');
    const db = await this.#open(scope); this.scopeGuard.assert(scope);
    return new Promise((resolve, reject) => {
      const tx = db.transaction(assetDelta ? ['sessions', 'assets'] : ['sessions'], 'readwrite'), store = tx.objectStore('sessions');
      let conflict = false;
      const request = store.get(snapshot.sessionId);
      request.onsuccess = () => {
        const current = request.result || null;
        if ((current ? current.revision : 0) !== expectedRevision) {
          conflict = true; tx.abort(); return;
        }
        store.put(snapshot);
        if (assetDelta) {
          const assets = tx.objectStore('assets');
          const clear = assets.index('by-session').openCursor(globalThis.IDBKeyRange.only(snapshot.sessionId));
          clear.onsuccess = () => {
            const cursor = clear.result;
            if (cursor) { cursor.delete(); cursor.continue(); return; }
            (assetDelta.assets || []).forEach((asset) => assets.put({ sessionId: snapshot.sessionId, assetId: asset.id, metadata: asset.metadata, blob: asset.blob }));
          };
          clear.onerror = () => tx.abort();
        }
      };
      request.onerror = () => { tx.abort(); };
      tx.oncomplete = () => { try { this.scopeGuard.assert(scope); resolve(snapshot); } catch (error) { reject(error); } };
      tx.onerror = tx.onabort = () => reject(conflict ? Object.assign(new Error('这个草稿已在另一个标签页更新。请重新加载，或另存为新的制作草稿。'), { code: 'STALE_SESSION' }) : tx.error || new Error('本机草稿保存失败。'));
    });
  }

  async loadAssets(sessionId, scope) {
    const db = await this.#open(scope); this.scopeGuard.assert(scope);
    return new Promise((resolve, reject) => {
      const tx = db.transaction('assets', 'readonly'), req = tx.objectStore('assets').index('by-session').getAll(globalThis.IDBKeyRange.only(sessionId));
      req.onsuccess = () => { try { this.scopeGuard.assert(scope); resolve(req.result || []); } catch (error) { reject(error); } };
      req.onerror = () => reject(req.error || new Error('无法读取本机图片素材。'));
      tx.onabort = () => reject(tx.error || new Error('无法读取本机图片素材。'));
    });
  }

  async listRecent(scope) {
    const db = await this.#open(scope); this.scopeGuard.assert(scope);
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sessions', 'readonly'), req = tx.objectStore('sessions').getAll();
      req.onsuccess = () => { try { this.scopeGuard.assert(scope); resolve((req.result || []).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5)); } catch (error) { reject(error); } };
      req.onerror = () => reject(req.error || new Error('无法读取本机制作草稿。'));
      tx.onabort = () => reject(tx.error || new Error('无法读取本机制作草稿。'));
    });
  }
}

export function resetSessionDatabaseConnectionsForTests() { connections.forEach((promise) => promise.then((db) => db.close()).catch(() => {})); connections.clear(); }
