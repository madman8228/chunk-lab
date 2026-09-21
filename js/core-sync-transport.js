(() => {
  // src/core/sync-transport.mjs
  async function putConditional(options) {
    const input = options || {};
    const api = input.api;
    const payload = input.payload;
    const batchSync = input.batchSync;
    if (!api || typeof api.putData !== "function") throw new TypeError("sync transport requires api.putData");
    if (!batchSync) return api.putData(payload);
    const state = await batchSync.state();
    if (!Number.isSafeInteger(state.baseline) || state.baseline < 0) {
      const error = new Error("\u5C1A\u672A\u786E\u8BA4\u4E91\u7AEF\u57FA\u7EBF\uFF0C\u6682\u4E0D\u4E0A\u4F20\u672C\u5730\u6570\u636E");
      error.code = "SYNC_BASELINE_REQUIRED";
      throw error;
    }
    await batchSync.stage(payload, state.baseline, input.expectedGeneration, input.operationReceipts);
    const outcome = await batchSync.retry();
    if (!outcome || !outcome.receipt) throw new Error("\u670D\u52A1\u5668\u672A\u786E\u8BA4\u6761\u4EF6\u540C\u6B65");
    return outcome.receipt;
  }
  var CoreSyncTransport = Object.freeze({ putConditional });

  // scripts/core-sync-transport-entry.mjs
  if (typeof globalThis !== "undefined") globalThis.CoreSyncTransport = CoreSyncTransport;
})();
