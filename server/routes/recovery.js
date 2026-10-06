'use strict';

const { MAX_SOURCE_BYTES } = require('../services/recovery-ingest');

function registerRecoveryRoutes(options) {
  const rawLimit = options.rawLimit || MAX_SOURCE_BYTES;
  const parseGzip = options.express.raw({
    type: 'application/vnd.chunklab.recovery+gzip',
    limit: rawLimit
  });

  options.app.get('/api/recovery/sources', options.auth.authenticate, function (req, res) {
    try {
      const limit = req.query.limit === undefined ? undefined : Number(req.query.limit);
      res.json(options.recovery.listSources({ userId: req.userId, cursor: req.query.cursor, limit }));
    } catch (error) {
      res.status(error.status || 500).json({ error: error.message, code: error.code || 'RECOVERY_LIST_FAILED' });
    }
  });

  options.app.get('/api/recovery/:sourceId/pending-operations', options.auth.authenticate, function (req, res) {
    try {
      const limit = req.query.limit === undefined ? undefined : Number(req.query.limit);
      res.json(options.recovery.listHandoverOperations({ userId: req.userId, sourceId: req.params.sourceId,
        cursor: req.query.cursor || '', limit }));
    } catch (error) {
      res.status(error.status || 500).json({ error: error.message, code: error.code || 'RECOVERY_HANDOVER_FAILED' });
    }
  });

  options.app.get('/api/recovery/:sourceId/manifest', options.auth.authenticate, function (req, res) {
    try {
      res.json(options.recovery.refreshManifest({ userId: req.userId, sourceId: req.params.sourceId }));
    } catch (error) {
      res.status(error.status || 500).json({ error: error.message, code: error.code || 'RECOVERY_MANIFEST_FAILED' });
    }
  });

  options.app.post('/api/recovery/:sourceId/preview', options.auth.authenticate, function (req, res) {
    try {
      const result = options.recovery.previewMigration(Object.assign({}, req.body, {
        userId: req.userId, sourceId: req.params.sourceId
      }));
      res.json(result);
    } catch (error) {
      res.status(error.status || 500).json({ error: error.message, code: error.code || 'RECOVERY_PREVIEW_FAILED' });
    }
  });

  options.app.post('/api/recovery/:sourceId/apply', options.auth.authenticate, function (req, res) {
    try {
      const result = options.recovery.applyMigration(Object.assign({}, req.body, {
        userId: req.userId, sourceId: req.params.sourceId
      }));
      res.status(result.state === 'applied' ? 201 : 200).json(result);
    } catch (error) {
      res.status(error.status || 500).json({ error: error.message, code: error.code || 'RECOVERY_APPLY_FAILED' });
    }
  });

  options.app.post('/api/recovery/:sourceId/migrate-empty', options.auth.authenticate, function (req, res) {
    try {
      const result = options.recovery.migrateEmptyAccount({ userId: req.userId, sourceId: req.params.sourceId });
      res.json(result);
    } catch (error) {
      res.status(error.status || 500).json({ error: error.message, code: error.code || 'RECOVERY_PREVIEW_REQUIRED' });
    }
  });

  options.app.post('/api/recovery/ingest', options.auth.authenticate, parseGzip, function (req, res) {
    try {
      if (!req.is('application/vnd.chunklab.recovery+gzip')) {
        res.status(415).json({ error: '恢复来源必须使用 gzip 二进制格式', code: 'UNSUPPORTED_RECOVERY_CODEC' });
        return;
      }
      const result = options.recovery.ingest({
        userId: req.userId,
        sourceId: req.get('X-ChunkLab-Recovery-Source'),
        sourceHash: req.get('X-ChunkLab-Recovery-SHA256'),
        codec: 'gzip',
        payload: req.body
      });
      res.status(result.state === 'archived' ? 201 : 200).json(result);
    } catch (error) {
      res.status(error.status || 500).json({ error: error.message, code: error.code || 'RECOVERY_INGEST_FAILED' });
    }
  });

  options.app.post('/api/recovery/ingest/chunk', options.auth.authenticate, parseGzip, function (req, res) {
    try {
      if (!req.is('application/vnd.chunklab.recovery+gzip')) {
        res.status(415).json({ error: '恢复分块必须使用 gzip 二进制格式', code: 'UNSUPPORTED_RECOVERY_CODEC' });
        return;
      }
      const result = options.recovery.stageChunk({
        userId: req.userId,
        sourceId: req.get('X-ChunkLab-Recovery-Source'),
        sourceHash: req.get('X-ChunkLab-Recovery-SHA256'),
        chunkIndex: Number(req.get('X-ChunkLab-Recovery-Chunk-Index')),
        chunkCount: Number(req.get('X-ChunkLab-Recovery-Chunk-Count')),
        chunkHash: req.get('X-ChunkLab-Recovery-Chunk-SHA256'),
        uncompressedBytes: Number(req.get('X-ChunkLab-Recovery-Uncompressed-Bytes')),
        payload: req.body
      });
      res.status(result.state === 'staged' ? 201 : 200).json(result);
    } catch (error) {
      res.status(error.status || 500).json({ error: error.message, code: error.code || 'RECOVERY_INGEST_FAILED' });
    }
  });

  options.app.post('/api/recovery/ingest/complete', options.auth.authenticate, function (req, res) {
    try {
      const result = options.recovery.complete(Object.assign({}, req.body, { userId: req.userId }));
      res.status(result.state === 'archived' ? 201 : 200).json(result);
    } catch (error) {
      res.status(error.status || 500).json({ error: error.message, code: error.code || 'RECOVERY_INGEST_FAILED' });
    }
  });
}

module.exports = { registerRecoveryRoutes };
