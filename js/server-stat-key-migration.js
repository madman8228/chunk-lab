(function (global) {
  'use strict';

  function run(migrations, getMem) {
    if (!Array.isArray(migrations) || !migrations.length || !global.ServerStore || !global.ServerCache || !global.CL) {
      return Promise.resolve(0);
    }
    var account = global.AccountStorage;
    var owner = account && account.owner;
    if (!owner || !global.CL.serverPersistenceReady || !global.CL.serverPersistenceReady()) return Promise.resolve(0);
    var queue = migrations.map(function (migration) {
      var eventId = 'legacy_stat_key_' + global.CL.fnv8(migration.oldKey + '|' + migration.newKey);
      return { eventId: eventId, oldKey: migration.oldKey, newKey: migration.newKey, deckId: migration.deckId };
    });
    return queue.reduce(function (chain, payload) {
      return chain.then(function () {
        if (!global.AccountStorage || global.AccountStorage.owner !== owner || !global.CL.serverPersistenceReady()) return;
        return global.ServerStore.submitCommitted('learning.statKeyMigrate', payload, { requestId: payload.eventId });
      });
    }, Promise.resolve()).then(function () {
      if (!global.AccountStorage || global.AccountStorage.owner !== owner || !global.ServerCache) return 0;
      return global.ServerCache.read().then(function (row) {
        if (!row || row.owner !== owner || !row.snapshot || !row.snapshot.mem ||
            !global.AccountStorage || global.AccountStorage.owner !== owner) return 0;
        var current = typeof getMem === 'function' ? getMem() : null;
        if (!current || !current.stats || !current.stats.bySentence) return 0;
        var confirmed = row.snapshot.mem.stats && row.snapshot.mem.stats.bySentence || {};
        queue.forEach(function (migration) {
          [migration.oldKey, migration.newKey].forEach(function (key) {
            if (Object.prototype.hasOwnProperty.call(confirmed, key)) current.stats.bySentence[key] = confirmed[key];
            else delete current.stats.bySentence[key];
          });
        });
        return queue.length;
      });
    }).catch(function (error) {
      console.warn('[stats] legacy stat migration remains preserved for retry:', error && (error.code || error.message) || error);
      return 0;
    });
  }

  global.ServerStatKeyMigration = Object.freeze({ run: run });
})(window);
