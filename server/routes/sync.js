'use strict';

/* Register sync conflict endpoints against already-created services. */
function registerSyncRoutes(options) {
  const app = options.app;
  const auth = options.auth;
  const resolutions = options.resolutions;
  const batchResolutions = options.batchResolutions;

  function resolutionResponse(res, action) {
    try { res.json(action()); }
    catch (e) { res.status(e.status || 500).json({ error: e.message, code: e.code }); }
  }

  /* Account-level conflict comparison must use one server snapshot and token
   * for the whole learning namespace, avoiding mixed-era entity comparisons. */
  app.get('/api/sync/batch', auth.authenticate, function (req, res) {
    resolutionResponse(res, function () { return batchResolutions.compare(req.userId); });
  });
  app.post('/api/sync/batch/resolve', auth.authenticate, function (req, res) {
    resolutionResponse(res, function () { return batchResolutions.resolve(req.userId, req.body); });
  });
  app.get('/api/sync/batch/resolutions/:id', auth.authenticate, function (req, res) {
    resolutionResponse(res, function () { return batchResolutions.backup(req.userId, req.params.id); });
  });
  app.get('/api/sync/entity', auth.authenticate, function (req, res) {
    resolutionResponse(res, function () { return resolutions.read(req.userId, req.query.entity, req.query.id); });
  });
  app.post('/api/sync/resolve', auth.authenticate, function (req, res) {
    resolutionResponse(res, function () { return resolutions.resolve(req.userId, req.body); });
  });
  app.get('/api/sync/resolutions/:id', auth.authenticate, function (req, res) {
    resolutionResponse(res, function () { return resolutions.backup(req.userId, req.params.id); });
  });
}

module.exports = { registerSyncRoutes };
