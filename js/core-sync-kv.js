(() => {
  // src/core/sync-kv-merge.mjs
  function mergeSyncKv(localMem, remoteMem, localRevs, remoteRevs, keys, pendingLearning, remoteStatsWasNormalized, dependencies) {
    const input = dependencies || {};
    const cloneJSON = input.cloneJSON;
    const mergeStats = input.mergeStats;
    const mergeBest = input.mergeBest;
    const eqJson = input.eqJson;
    if ([cloneJSON, mergeStats, mergeBest, eqJson].some((fn) => typeof fn !== "function")) {
      throw new TypeError("sync kv merge requires clone and merge helpers");
    }
    const mem = cloneJSON(localMem && typeof localMem === "object" ? localMem : {});
    const remote = remoteMem && typeof remoteMem === "object" ? remoteMem : {};
    const revisions = cloneJSON(localRevs && typeof localRevs === "object" ? localRevs : {});
    if (!revisions.kv) revisions.kv = {};
    const remoteVersions = remoteRevs && typeof remoteRevs === "object" ? remoteRevs : {};
    const pending = Array.isArray(pendingLearning) ? pendingLearning : [];
    let dirty = false;
    (Array.isArray(keys) ? keys : []).forEach((key) => {
      const remoteKvRevs = remoteVersions.kv || {};
      const remoteRev = remoteKvRevs[key] || 0;
      const localRev = revisions.kv[key] || 0;
      if (key === "stats" && remote[key] !== void 0) {
        const localStats = mem.stats && typeof mem.stats === "object" ? mem.stats : {};
        const remoteStats = remote[key] && typeof remote[key] === "object" ? remote[key] : {};
        const localHasStats = Number(localStats.totalRounds || 0) > 0 || Number(localStats.totalAnswered || 0) > 0 || Object.keys(localStats.bySentence || {}).length > 0 || Array.isArray(localStats.events) && localStats.events.length > 0;
        const remoteHasStats = Number(remoteStats.totalRounds || 0) > 0 || Number(remoteStats.totalAnswered || 0) > 0 || Object.keys(remoteStats.bySentence || {}).length > 0 || Array.isArray(remoteStats.events) && remoteStats.events.length > 0;
        const remoteStatsKnown = Object.prototype.hasOwnProperty.call(remoteKvRevs, "stats");
        const hasPendingLearning = pending.length > 0;
        const keepLocalForEmptyRemote = !hasPendingLearning && localHasStats && !remoteStatsKnown && !remoteHasStats;
        const mergedStats = hasPendingLearning ? mergeStats(mem.stats, remote[key]) : keepLocalForEmptyRemote ? cloneJSON(mem.stats) : cloneJSON(remote[key]);
        if (keepLocalForEmptyRemote) dirty = true;
        if (JSON.stringify(mergedStats) !== JSON.stringify(mem.stats || {})) {
          mem.stats = mergedStats;
          revisions.kv[key] = Math.max(localRev, remoteRev) + 1;
        } else if (remoteRev > localRev) {
          revisions.kv[key] = remoteRev;
        }
        if (remoteStatsWasNormalized) dirty = true;
      } else if (key === "best" && remote[key] !== void 0) {
        const mergedBest = mergeBest(mem[key], remote[key]);
        if (!eqJson(mergedBest, mem[key])) {
          mem[key] = mergedBest;
          revisions.kv[key] = Math.max(localRev, remoteRev) + 1;
          dirty = true;
        } else if (remoteRev > localRev) {
          revisions.kv[key] = remoteRev;
        }
      } else if (remoteRev > localRev && remote[key] !== void 0) {
        mem[key] = remote[key];
        revisions.kv[key] = remoteRev;
      }
    });
    return { mem, localRevs: revisions, dirty };
  }
  var CoreSyncKv = Object.freeze({ mergeSyncKv });

  // scripts/core-sync-kv-entry.mjs
  if (typeof globalThis !== "undefined") globalThis.CoreSyncKv = CoreSyncKv;
})();
