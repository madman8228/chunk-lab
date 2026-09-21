async function putConditional(options) {
  const input = options || {};
  const api = input.api;
  const payload = input.payload;
  const batchSync = input.batchSync;
  if (!api || typeof api.putData !== 'function') throw new TypeError('sync transport requires api.putData');
  if (!batchSync) return api.putData(payload);

  const state = await batchSync.state();
  if (!Number.isSafeInteger(state.baseline) || state.baseline < 0) {
    const error = new Error('尚未确认云端基线，暂不上传本地数据');
    error.code = 'SYNC_BASELINE_REQUIRED';
    throw error;
  }
  await batchSync.stage(payload, state.baseline, input.expectedGeneration, input.operationReceipts);
  const outcome = await batchSync.retry();
  if (!outcome || !outcome.receipt) throw new Error('服务器未确认条件同步');
  return outcome.receipt;
}

export const CoreSyncTransport = Object.freeze({ putConditional });
