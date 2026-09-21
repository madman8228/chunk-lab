'use strict';

function registerDeckRoutes(options) {
  const app = options.app;
  const auth = options.auth;
  const db = options.db;
  const validate = options.validate;
  const saveData = options.saveData;
  const updateDeckPublication = options.updateDeckPublication;
  const allocSeq = options.allocSeq;
  const rejectUnconditional = options.rejectUnconditional;
  const strictConditionalWrites = options.strictConditionalWrites;

  app.get('/api/deck/public', function (req, res) {
    try {
      const rows = db.prepare(
        "SELECT d.id,d.name,d.items_json,d.created_at,u.username AS author FROM user_decks d JOIN users u ON u.id=d.user_id WHERE d.is_public=1 AND d.deleted_at IS NULL ORDER BY d.updated_at DESC"
      ).all();
      const decks = rows.map(function (r) {
        let items = [];
        try { items = JSON.parse(r.items_json); } catch (e) { /* invalid items count as zero */ }
        return { id: r.id, name: r.name, itemCount: items.length, author: r.author, publishedAt: r.created_at };
      });
      res.json({ ok: true, decks: decks });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/deck/public/:id', function (req, res) {
    try {
      const r = db.prepare(
        "SELECT d.id,d.name,d.items_json,d.created_at,u.username AS author FROM user_decks d JOIN users u ON u.id=d.user_id WHERE d.id=? AND d.is_public=1 AND d.deleted_at IS NULL"
      ).get(req.params.id);
      if (!r) return res.status(404).json({ error: '公开题库不存在或已下架' });
      res.json({ ok: true, deck: { id: r.id, name: r.name, author: r.username, publishedAt: r.created_at, items: JSON.parse(r.items_json) } });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/deck/publish', auth.authenticate, function (req, res) {
    try {
      const deckId = (typeof (req.body && req.body.deckId) === 'string') ? req.body.deckId.trim() : '';
      const publish = req.body && req.body.publish ? 1 : 0;
      if (!deckId || deckId.length > 64) return res.status(400).json({ error: 'deckId 非法' });
      if (strictConditionalWrites) {
        if (rejectUnconditional(req.body, res, '题库发布')) return;
        const verr = validate.validatePutPayload({ mem: {}, baseSeq: req.body.baseSeq, requestId: req.body.requestId,
          publications: [{ deckId: deckId, publish: !!publish }] });
        if (verr) return res.status(400).json({ error: '数据校验失败：' + verr });
        const seq = saveData(req.userId, { mem: {}, baseSeq: req.body.baseSeq, requestId: req.body.requestId,
          publications: [{ deckId: deckId, publish: !!publish }] });
        return res.json({ ok: true, isPublic: !!publish, seq: seq });
      }
      const own = db.prepare('SELECT id FROM user_decks WHERE user_id=? AND id=? AND deleted_at IS NULL').get(req.userId, deckId);
      if (!own) return res.status(404).json({ error: '题库不存在' });
      const isPublic = updateDeckPublication(req.userId, deckId, !!publish, allocSeq(req.userId));
      res.json({ ok: true, isPublic: isPublic });
    } catch (e) {
      if (e.status === 404) return res.status(404).json({ error: e.message });
      res.status(500).json({ error: e.message });
    }
  });
}

module.exports = { registerDeckRoutes };
