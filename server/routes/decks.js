'use strict';

function registerDeckRoutes(options) {
  const app = options.app;
  const db = options.db;
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
}

module.exports = { registerDeckRoutes };
