(() => {
  // src/core/sync-replay.mjs
  async function drainCourseIntents(options) {
    const input = options || {};
    const store = input.store;
    const api = input.api;
    const getScope = input.getScope;
    const waitForWrites = input.waitForWrites || (() => Promise.resolve());
    const sameValue = input.sameValue || ((left, right) => left === right);
    const isPaused = input.isPaused || (() => false);
    const onFailure = typeof input.onFailure === "function" ? input.onFailure : (error) => {
      throw error;
    };
    if (!store || !api || typeof getScope !== "function") {
      throw new TypeError("sync replay requires store, api and getScope");
    }
    const scope = getScope();
    const checkScope = () => {
      if (getScope() !== scope) throw new Error("\u8D26\u53F7\u5DF2\u5207\u6362\uFF0C\u505C\u6B62\u6062\u590D\u540C\u6B65");
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
        if (typeof input.markProtected === "function") input.markProtected(group, record.id);
        let frozen = record.frozen;
        if (!frozen) {
          const remote = await api.getSyncEntity(group, record.id);
          checkScope();
          if (!remote || typeof remote.exists !== "boolean" || !Number.isSafeInteger(remote.rev) || remote.rev < 0 || typeof remote.deleted !== "boolean") {
            throw new Error("\u670D\u52A1\u7AEF\u9700\u5347\u7EA7\u540E\u624D\u80FD\u5B89\u5168\u6062\u590D\u8BFE\u7A0B\u540C\u6B65");
          }
          const remoteValue = remote.deleted ? null : remote.value;
          if (record.deleted === remote.deleted && sameValue(record.value, remoteValue)) {
            await store.acknowledgeSyncIntents(scope, [{ key: record.key, operationId: record.operationId }]);
            if (typeof input.rememberRevision === "function") input.rememberRevision(group, record.id, remote.rev);
            continue;
          }
          if (!sameValue(record.original, remoteValue)) {
            const conflict = new Error("\u4E91\u7AEF\u8BFE\u7A0B\u5DF2\u6709\u4FEE\u6539\uFF0C\u8BF7\u5148\u6BD4\u8F83\u53CC\u65B9\u7248\u672C");
            conflict.code = "SYNC_CONFLICT";
            conflict.conflicts = [{ entity: group, id: record.id, currentRev: remote.rev, reason: "BASE_CONTENT_CHANGED" }];
            throw conflict;
          }
          const revisions = typeof input.loadRevs === "function" ? input.loadRevs() : {};
          const rev = Math.max(remote.rev, (revisions[group] || {})[record.id] || 0) + 1;
          if (!Number.isSafeInteger(rev)) throw new Error("\u8BFE\u7A0B\u7248\u672C\u53F7\u8D85\u51FA\u8303\u56F4");
          const payload = { mem: {}, revs: {}, baseRevs: {}, deleted: {} };
          payload.revs[group] = { [record.id]: rev };
          payload.baseRevs[group] = { [record.id]: remote.exists ? remote.rev : null };
          if (record.deleted) payload.deleted[group] = [{ id: record.id, rev }];
          else if (group === "courses") payload.courses = [record.value];
          else payload.courseProgress = { [record.id]: record.value };
          frozen = await store.freezeSyncIntent(scope, record.key, record.operationId, payload);
          checkScope();
          if (!frozen) continue;
        }
        checkScope();
        const receipt = await api.putData(frozen.payload);
        checkScope();
        if (!receipt || receipt.ok !== true) throw new Error("\u670D\u52A1\u5668\u672A\u786E\u8BA4\u8BFE\u7A0B\u4FDD\u5B58\u6210\u529F");
        await store.confirmSyncIntent(scope, record.key, frozen.operationId);
        if (typeof input.rememberRevision === "function") {
          input.rememberRevision(group, record.id, frozen.payload.revs[group][record.id]);
        }
      }
      if (typeof input.markDirty === "function") input.markDirty();
      if (typeof input.notify === "function") input.notify();
      if (typeof input.schedule === "function") {
        input.schedule(() => {
          if (getScope() === scope && !isPaused() && typeof input.syncFromCloud === "function") input.syncFromCloud();
        }, 400);
      }
      return false;
    } catch (error) {
      return onFailure(error);
    }
  }
  var CoreSyncReplay = Object.freeze({ drainCourseIntents });

  // scripts/core-sync-replay-entry.mjs
  if (typeof globalThis !== "undefined") globalThis.CoreSyncReplay = CoreSyncReplay;
})();
