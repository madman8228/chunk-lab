'use strict';

/* Historical fixture writer; protocol 3 registers only a rejection route. */
function registerLegacyDeckPublication(options) {
  const {app,auth,db,validate,saveData,updateDeckPublication,allocSeq,rejectUnconditional,strictConditionalWrites}=options;
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

module.exports={registerLegacyDeckPublication};
