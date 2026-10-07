'use strict';
/* Historical fixture routes only; never register in a normal service. */
function registerHistoricalProtocol({app, auth, db, getLegacyDataWriter, rejectUnconditional, validate, upsertDeck, upsertCourse, upsertCourseProgress, upsertKv, allocSeq, buildMemSnapshot, updateDeckPublication, STRICT_CONDITIONAL_WRITES, WRITE_PROTOCOL}) {
  if (process.env.NODE_ENV !== 'test' || WRITE_PROTOCOL !== 2) throw new Error('Historical protocol is test-only');
  const saveData = getLegacyDataWriter();
  // Only isolated historical test fixtures need these route constructors.
  require('../routes/legacy-snapshot-writes').registerLegacySnapshotWrites({app,auth,rejectUnconditional,validate,saveData});
  const { createBatchReplacement } = require('../services/batch-replacement');
  const { registerSyncRoutes } = require('../routes/sync');
  const resolutionModule = require('../sync-resolution');
  const resolutions = resolutionModule.createResolutionService(db, function(userId, entity, id, value, rev, deleted, seq){
    if (entity === 'decks') upsertDeck(userId, value || { id }, rev, deleted, seq);
    else if (entity === 'courses') upsertCourse(userId, value || { courseId: id }, rev, deleted, seq);
    else if (entity === 'courseProgress') upsertCourseProgress(userId, id, value, rev, deleted, seq);
    else upsertKv(userId, id, value, rev, deleted, seq);
  }, allocSeq);
  const makeBatchReplacement = createBatchReplacement({ buildMemSnapshot });
  const batchResolutions = resolutionModule.createBatchResolutionService(db,
    userId => buildMemSnapshot(userId),
    (userId, local, remote, requestId) => saveData(userId, makeBatchReplacement(userId, local, remote, requestId), true));
  registerSyncRoutes({ app, auth, resolutions, batchResolutions, writeProtocol: WRITE_PROTOCOL });
  require('../routes/courses').registerCourseRoutes({
    app, auth, validate, db, upsertCourse, allocSeq,
    strictConditionalWrites: STRICT_CONDITIONAL_WRITES,
    writeProtocol: WRITE_PROTOCOL
  });
  require('../routes/legacy-deck-publication').registerLegacyDeckPublication({
    app, auth, db, validate, saveData, updateDeckPublication, allocSeq, rejectUnconditional,
    strictConditionalWrites: STRICT_CONDITIONAL_WRITES
  });
}
module.exports = { registerHistoricalProtocol };
