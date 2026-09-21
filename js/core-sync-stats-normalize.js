(() => {
  // src/core/sync-stats-normalize.mjs
  function normalizeSyncedStats(stats, dependencies) {
    const input = dependencies || {};
    const migrateCidKeys = input.migrateCidKeys;
    const migrateToBookDecks = input.migrateToBookDecks;
    const mergeStats = input.mergeStats;
    if ([migrateCidKeys, migrateToBookDecks, mergeStats].some((fn) => typeof fn !== "function")) {
      throw new TypeError("sync stats normalization requires migration and merge helpers");
    }
    if (!stats || typeof stats !== "object") {
      return { stats, changed: false, repairedEventIds: {} };
    }
    const beforeEvents = {};
    const eventsBefore = Array.isArray(stats.events) ? stats.events : [];
    eventsBefore.forEach((event) => {
      if (event && event.id) beforeEvents[event.id] = event.key || "";
    });
    const holder = { stats };
    const changed = migrateCidKeys(holder) || migrateToBookDecks(holder);
    const by = stats.bySentence && typeof stats.bySentence === "object" ? stats.bySentence : {};
    const events = Array.isArray(stats.events) ? stats.events : [];
    const counts = {};
    events.forEach((event) => {
      if (!event || event.kind !== "answer" || !event.key) return;
      counts[event.key] = (counts[event.key] || 0) + 1;
    });
    let rebuild = false;
    Object.keys(counts).forEach((key) => {
      const row = by[key];
      const times = row && Number(row.times);
      if (!row || !Number.isFinite(times) || times < counts[key]) rebuild = true;
    });
    let normalizedStats = stats;
    if (rebuild) {
      normalizedStats = mergeStats(stats, stats);
    }
    const repairedEventIds = {};
    (Array.isArray(normalizedStats.events) ? normalizedStats.events : []).forEach((event) => {
      if (event && event.id && beforeEvents[event.id] !== void 0 && beforeEvents[event.id] !== (event.key || "")) {
        repairedEventIds[event.id] = 1;
      }
    });
    return {
      stats: normalizedStats,
      changed: changed || rebuild,
      repairedEventIds
    };
  }
  var CoreSyncStats = Object.freeze({ normalizeSyncedStats });

  // scripts/core-sync-stats-normalize-entry.mjs
  if (typeof globalThis !== "undefined") globalThis.CoreSyncStats = CoreSyncStats;
})();
