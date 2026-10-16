(function(global) {
  'use strict';
  function scope() { return JSON.stringify([global.AccountStorage && AccountStorage.owner, global.ChunkAPI && ChunkAPI.getBase(), global.ChunkAPI && ChunkAPI.getToken ? ChunkAPI.getToken() : null]); }
  async function read() {
    const captured = scope();
    const [row, pending] = await Promise.all([ServerCache.read(), ServerStore.pending()]);
    if (scope() !== captured || !row || row.owner !== AccountStorage.owner) throw new Error('个人学习数据尚未就绪');
    const confirmed = Object.assign({}, row.snapshot.mem.learningWorkspace || {});
    const projected = Object.assign({}, confirmed);
    const outstanding = pending.filter(item => item.owner === row.owner && item.scope === row.scope &&
      item.operation?.type === 'workspace.select' && !(item.receipt && item.receipt.seq <= row.appliedSeq));
    outstanding.sort((a,b) => a.ordinal-b.ordinal).forEach(item => {
      const payload = item.operation.payload;
      projected[payload.itemType + ':' + payload.targetId] = { ...payload, pending: true };
    });
    return { confirmed, projected, pending: outstanding.length > 0 };
  }
  async function select(itemType, targetId, selected, position) {
    const captured = scope();
    const payload = { itemType, targetId, selected };
    if (position !== undefined) payload.position = position;
    await ServerStore.submitCommitted('workspace.select', payload, { requestId: crypto.randomUUID() });
    if (scope() !== captured) throw new Error('账号已切换，请查看当前账号的内容');
    return read();
  }
  global.LearningWorkspaceStore = { read, select };
  if (typeof module !== 'undefined') module.exports = global.LearningWorkspaceStore;
})(typeof window !== 'undefined' ? window : globalThis);
