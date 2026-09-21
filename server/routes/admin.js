'use strict';

function registerAdminRoutes(options) {
  const app = options.app;
  const admin = options.admin;
  const auth = options.auth;
  const db = options.db;
  const adminOnly = options.adminOnly;
  const adminOverview = options.adminOverview;
  const parseRangeDays = options.parseRangeDays;
  const rateBlocked = options.rateBlocked;
  const rateClear = options.rateClear;
  const rateHit = options.rateHit;
  const send429 = options.send429;
  const authRate = options.authRate;

  /* ===================== 管理后台 ===================== */
  /* 管理员是独立身份：固定用户名 admin，不复用普通用户 JWT，也不把管理员入口
     暴露给普通用户页面。ADMIN_PASSWORD 只负责首次初始化，密码哈希落在 SQLite。 */
  app.post('/api/admin/login', function (req, res) {
    const ip = req.ip;
    /* 管理员登录独立限速：后台入口不依赖固定 IP，也不能被同一来源持续撞密码。 */
    if (rateBlocked(ip, 'adminLoginFail', authRate.adminLoginFail)) return send429(res);
    try {
      const result = admin.login(req.body && req.body.password);
      rateClear(ip, 'adminLoginFail');
      res.json(result);
    } catch (e) {
      rateHit(ip, 'adminLoginFail', authRate.adminLoginFail);
      res.status(401).json({ error: e.message });
    }
  });
  
  app.get('/api/admin/me', adminOnly, function (req, res) {
    res.json({ admin: req.admin });
  });
  
  app.get('/api/admin/overview', adminOnly, function (req, res) {
    try {
      res.json(adminOverview(parseRangeDays(req.query && req.query.days)));
    } catch (e) {
      console.error('[admin] overview failed:', e.message);
      res.status(500).json({ error: '统计读取失败' });
    }
  });
  
  app.get('/api/admin/users', adminOnly, function (req, res) {
    try {
      const search = String((req.query && req.query.search) || '').trim();
      const limit = Math.min(Math.max(Number(req.query && req.query.limit) || 50, 1), 200);
      const like = '%' + search.replace(/[\\%_]/g, '\\$&') + '%';
      const users = db.prepare(
        "SELECT u.id, u.username, u.created_at, " +
        "(SELECT MAX(last_seen_at) FROM user_activity a WHERE a.user_id=u.id) AS last_seen_at, " +
        "(SELECT COUNT(*) FROM user_events e WHERE e.user_id=u.id AND e.deleted_at IS NULL AND json_extract(e.data_json, '$.kind')='answer') AS answer_count, " +
        "(SELECT COUNT(DISTINCT date(e.at/1000, 'unixepoch', '+8 hours')) FROM user_events e WHERE e.user_id=u.id AND e.deleted_at IS NULL AND json_extract(e.data_json, '$.kind')='answer') AS learning_days, " +
        "(SELECT COUNT(*) FROM user_entity_rows e WHERE e.user_id=u.id AND e.kind='mastered' AND e.deleted_at IS NULL) AS mastered_count " +
        "FROM users u WHERE (?='' OR u.username LIKE ? ESCAPE '\\') " +
        "ORDER BY CASE WHEN last_seen_at IS NULL THEN 1 ELSE 0 END, last_seen_at DESC, u.id DESC LIMIT ?"
      ).all(search, like, limit).map(function (row) {
        return {
          id: row.id,
          username: row.username,
          type: row.username === '__default__' ? 'default' : (/^guest_/.test(row.username) ? 'guest' : 'registered'),
          createdAt: row.created_at,
          lastSeenAt: row.last_seen_at,
          answers: row.answer_count,
          learningDays: row.learning_days,
          mastered: row.mastered_count
        };
      });
      res.json({ users: users });
    } catch (e) {
      console.error('[admin] users failed:', e.message);
      res.status(500).json({ error: '用户列表读取失败' });
    }
  });
  
  app.get('/api/admin/users/:id', adminOnly, function (req, res) {
    try {
      const id = Number(req.params.id);
      if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ error: '用户编号无效' });
      const user = db.prepare('SELECT id, username, created_at FROM users WHERE id=?').get(id);
      if (!user) return res.status(404).json({ error: '用户不存在' });
      const answers = db.prepare(
        "SELECT COUNT(*) AS count FROM user_events WHERE user_id=? AND deleted_at IS NULL AND json_extract(data_json, '$.kind')='answer'"
      ).get(id).count;
      const mastered = db.prepare("SELECT COUNT(*) AS count FROM user_entity_rows WHERE user_id=? AND kind='mastered' AND deleted_at IS NULL").get(id).count;
      const progress = db.prepare("SELECT COUNT(*) AS count FROM user_course_progress WHERE user_id=? AND deleted_at IS NULL").get(id).count;
      const recent = db.prepare(
        "SELECT at, data_json FROM user_events WHERE user_id=? AND deleted_at IS NULL ORDER BY at DESC LIMIT 20"
      ).all(id).map(function (row) {
        let event = {};
        try { event = JSON.parse(row.data_json); } catch (e) {}
        return { at: row.at, kind: event.kind || 'unknown', key: event.key || null, ok: event.ok == null ? null : !!event.ok };
      });
      res.json({ user: user, summary: { answers: answers, mastered: mastered, courses: progress }, recent: recent });
    } catch (e) {
      console.error('[admin] user detail failed:', e.message);
      res.status(500).json({ error: '用户详情读取失败' });
    }
  });
  
  app.get('/api/admin/feedback', adminOnly, function (req, res) {
    const rows = db.prepare(
      "SELECT id, text, image_path, image_paths, meta, created_at, COALESCE(status, 'open') AS status " +
      "FROM feedback ORDER BY created_at DESC LIMIT 100"
    ).all();
    res.json({ feedback: rows.map(function (row) {
      let meta = null;
      try { meta = row.meta ? JSON.parse(row.meta) : null; } catch (e) {}
      return {
        id: row.id, text: row.text, meta: meta, createdAt: row.created_at,
        status: row.status, hasImage: !!(row.image_path || row.image_paths)
      };
    }) });
  });
  
  app.patch('/api/admin/feedback/:id', adminOnly, function (req, res) {
    const id = Number(req.params.id);
    const status = String(req.body && req.body.status || '');
    if (!Number.isSafeInteger(id) || id <= 0 || !['open', 'done'].includes(status)) {
      return res.status(400).json({ error: '反馈状态无效' });
    }
    const info = db.prepare('UPDATE feedback SET status=? WHERE id=?').run(status, id);
    if (!info.changes) return res.status(404).json({ error: '反馈不存在' });
    res.json({ ok: true, status: status });
  });
  
  app.post('/api/admin/password', adminOnly, function (req, res) {
    try {
      admin.changePassword(req.body && req.body.password);
      res.json({ ok: true });
    } catch (e) { res.status(400).json({ error: e.message }); }
  });
  
}

module.exports = { registerAdminRoutes };
