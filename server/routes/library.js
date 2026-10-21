'use strict';
function registerLibraryRoutes({ app, adminOnly, library }) {
  app.get('/api/library', (req, res) => {
    try {
      const resources = library.resources(); const version = library.version(resources); const etag = '"' + version + '"';
      res.set('ETag', etag).set('Cache-Control', 'public, max-age=0, must-revalidate');
      if (req.headers['if-none-match'] === etag) return res.status(304).end();
      res.json({ version, resources });
    } catch (_) { res.status(503).json({ error: '内容目录暂时无法读取，请稍后重试' }); }
  });
  const prefix = '/api/admin/library/resources';
  app.get(prefix, adminOnly, (_req, res) => {
    try { res.json({ resources: library.resources() }); } catch (_) { res.status(503).json({ error: '目录读取失败' }); }
  });
  app.get(prefix + '/:id', adminOnly, (req, res) => res.json(library.read(req.params.id)));
  app.put(prefix + '/:id/draft', adminOnly, (req, res) => {
    try { const result = library.saveDraft(req.params.id, req.body?.baseRevision, req.body?.resource); res.status(result.status).json(result); }
    catch (_) { res.status(500).json({ error: '目录草稿保存失败，原有内容未替换' }); }
  });
  app.post(prefix + '/:id/publish', adminOnly, (req, res) => {
    try { const result = library.publish(req.params.id, req.body?.revision); res.status(result.status).json(result); }
    catch (_) { res.status(500).json({ error: '目录发布失败，请稍后重试' }); }
  });
}
module.exports = { registerLibraryRoutes };
