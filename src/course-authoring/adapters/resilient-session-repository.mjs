function scopedKey(sessionId, scope) {
  return JSON.stringify([scope && scope.owner || '', scope && scope.databaseName || '', sessionId]);
}

function conflict() { return Object.assign(new Error('这个草稿已在另一个标签页更新。请重新加载，或另存为新的制作草稿。'), { code: 'STALE_SESSION' }); }

/** Keep the current tab usable when browser storage is unavailable; never imply durability. */
export class ResilientSessionRepository {
  constructor({ primary }) {
    if (!primary) throw new Error('会话存储适配器需要主仓库');
    this.primary = primary;
    this.memory = new Map();
    this.memoryAssets = new Map();
    this.persistenceWarning = '';
  }

  async load(sessionId, scope) {
    const key = scopedKey(sessionId, scope);
    if (this.persistenceWarning) return this.memory.get(key) || null;
    try {
      const snapshot = await this.primary.load(sessionId, scope);
      if (snapshot) this.memory.set(key, snapshot);
      return snapshot || null;
    } catch (error) {
      if (error && (error.code === 'SESSION_CHANGED' || error.code === 'STALE_SESSION')) throw error;
      this.#useMemory();
      return this.memory.get(key) || null;
    }
  }

  async save(snapshot, scope, expectedRevision, assetDelta = null) {
    const key = scopedKey(snapshot.sessionId, scope);
    if (!this.persistenceWarning) {
      try {
        const result = await this.primary.save(snapshot, scope, expectedRevision, assetDelta);
        this.memory.set(key, snapshot);
        if (assetDelta) this.memoryAssets.set(key, assetDelta.assets || []);
        return result;
      } catch (error) {
        if (error && (error.code === 'SESSION_CHANGED' || error.code === 'STALE_SESSION')) throw error;
        this.#useMemory();
      }
    }
    const current = this.memory.get(key) || null;
    if ((current ? current.revision : 0) !== expectedRevision) throw conflict();
    this.memory.set(key, snapshot);
    if (assetDelta) this.memoryAssets.set(key, assetDelta.assets || []);
    return snapshot;
  }

  async loadAssets(sessionId, scope) {
    const key = scopedKey(sessionId, scope);
    if (this.persistenceWarning) return this.memoryAssets.get(key) || [];
    try {
      const rows = await this.primary.loadAssets(sessionId, scope);
      if (rows && rows.length) this.memoryAssets.set(key, rows);
      return rows || [];
    } catch (error) {
      if (error && (error.code === 'SESSION_CHANGED' || error.code === 'STALE_SESSION')) throw error;
      this.#useMemory();
      return this.memoryAssets.get(key) || [];
    }
  }

  async listRecent(scope) {
    if (this.persistenceWarning) return this.#memoryRows(scope);
    try {
      const rows = await this.primary.listRecent(scope);
      rows.forEach((snapshot) => this.memory.set(scopedKey(snapshot.sessionId, scope), snapshot));
      return rows;
    } catch (error) {
      if (error && (error.code === 'SESSION_CHANGED' || error.code === 'STALE_SESSION')) throw error;
      this.#useMemory();
      return this.#memoryRows(scope);
    }
  }

  #memoryRows(scope) {
    return Array.from(this.memory.values()).filter((row) => row.identity && row.identity.owner === scope.owner && row.identity.databaseName === scope.databaseName)
      .sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5);
  }

  #useMemory() { this.persistenceWarning = '本机草稿存储暂不可用；本次制作只保留在当前页面，关闭页面后会丢失。请下载指令或课程文件留存。'; }
}
