async function drainCourseIntents(options) {
  const input = options || {};
  const store = input.store;
  const api = input.api;
  const getScope = input.getScope;
  const waitForWrites = input.waitForWrites || (() => Promise.resolve());
  const sameValue = input.sameValue || ((left, right) => left === right);
  const isPaused = input.isPaused || (() => false);
  const onFailure = typeof input.onFailure === 'function' ? input.onFailure : (error) => { throw error; };
  if (!store || !api || typeof getScope !== 'function') {
    throw new TypeError('sync replay requires store, api and getScope');
  }

  const scope = getScope();
  const checkScope = () => {
    if (getScope() !== scope) throw new Error('账号已切换，停止恢复同步');
  };

  try {
    await waitForWrites();
    for (let round = 0; round < 64; round += 1) {
      checkScope();
      if (isPaused()) return false;
      const records = await store.readSyncIntents(scope);
      checkScope();
      if (!records.length) return true;

      const record = records[0];
      const group = record.entity;
      if (typeof input.markProtected === 'function') input.markProtected(group, record.id);
      let frozen = record.frozen;
      if (!frozen) {
        const remote = await api.getSyncEntity(group, record.id);
        checkScope();
        if (!remote || typeof remote.exists !== 'boolean' || !Number.isSafeInteger(remote.rev)
          || remote.rev < 0 || typeof remote.deleted !== 'boolean') {
          throw new Error('服务端需升级后才能安全恢复课程同步');
        }
        const remoteValue = remote.deleted ? null : remote.value;
        if (record.deleted === remote.deleted && sameValue(record.value, remoteValue)) {
          await store.acknowledgeSyncIntents(scope, [{ key: record.key, operationId: record.operationId }]);
          if (typeof input.rememberRevision === 'function') input.rememberRevision(group, record.id, remote.rev);
          continue;
        }
        if (!sameValue(record.original, remoteValue)) {
          const conflict = new Error('云端课程已有修改，请先比较双方版本');
          conflict.code = 'SYNC_CONFLICT';
          conflict.conflicts = [{ entity: group, id: record.id, currentRev: remote.rev, reason: 'BASE_CONTENT_CHANGED' }];
          throw conflict;
        }
        const revisions = typeof input.loadRevs === 'function' ? input.loadRevs() : {};
        const rev = Math.max(remote.rev, (revisions[group] || {})[record.id] || 0) + 1;
        if (!Number.isSafeInteger(rev)) throw new Error('课程版本号超出范围');
        const payload = { mem: {}, revs: {}, baseRevs: {}, deleted: {} };
        payload.revs[group] = { [record.id]: rev };
        payload.baseRevs[group] = { [record.id]: remote.exists ? remote.rev : null };
        if (record.deleted) payload.deleted[group] = [{ id: record.id, rev }];
        else if (group === 'courses') payload.courses = [record.value];
        else payload.courseProgress = { [record.id]: record.value };
        frozen = await store.freezeSyncIntent(scope, record.key, record.operationId, payload);
        checkScope();
        if (!frozen) continue;
      }

      checkScope();
      const receipt = await api.putData(frozen.payload);
      checkScope();
      if (!receipt || receipt.ok !== true) throw new Error('服务器未确认课程保存成功');
      await store.confirmSyncIntent(scope, record.key, frozen.operationId);
      if (typeof input.rememberRevision === 'function') {
        input.rememberRevision(group, record.id, frozen.payload.revs[group][record.id]);
      }
    }

    if (typeof input.markDirty === 'function') input.markDirty();
    if (typeof input.notify === 'function') input.notify();
    if (typeof input.schedule === 'function') {
      input.schedule(() => {
        if (getScope() === scope && !isPaused() && typeof input.syncFromCloud === 'function') input.syncFromCloud();
      }, 400);
    }
    return false;
  } catch (error) {
    return onFailure(error);
  }
}

export const CoreSyncReplay = Object.freeze({ drainCourseIntents });
