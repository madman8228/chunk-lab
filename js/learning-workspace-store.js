(function(global) {
  'use strict';
  function scope() { return JSON.stringify([global.AccountStorage && AccountStorage.owner, global.ChunkAPI && ChunkAPI.getBase(), global.ChunkAPI && ChunkAPI.getToken ? ChunkAPI.getToken() : null]); }
  function key(payload){return payload.itemType+':'+(payload.itemType==='vocabulary-item'?JSON.stringify([payload.bookId,payload.targetId]):payload.targetId);}
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
      projected[key(payload)] = { ...payload, pending: true };
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
  async function word(bookId,itemId,toggle=false){
    await LearningSessionBootstrap.ready({allowConfirmedOffline:true});const captured=scope(),payload={itemType:'vocabulary-item',targetId:itemId,bookId},id=key(payload),state=await read();
    const selected=state.projected[id]?.selected===true;
    if(!toggle)return selected;
    await ServerStore.submit('workspace.select',{...payload,selected:!selected},{requestId:crypto.randomUUID()});
    if(scope()!==captured)throw Error('账号已变化，原收藏记录保留');return !selected;
  }
  global.LearningWorkspaceStore = { read, select,word };
  if (typeof module !== 'undefined') module.exports = global.LearningWorkspaceStore;
})(typeof window !== 'undefined' ? window : globalThis);
