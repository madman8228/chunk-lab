'use strict';

function registerAiRoutes(options) {
  const app = options.app;
  const auth = options.auth;
  const ai = options.ai;
  const db = options.db;
  const metrics = options.metrics;
  const enabled = options.enabled;
  const cacheMax = options.cacheMax;
  const cacheTtl = options.cacheTtl;
  const promptVersion = options.promptVersion;

  app.post('/api/ai/explain', auth.authenticate, function (req, res) {
    try {
      /* 2026-09-06：联网 AI 生成已停用（enabled 默认 false）。
         关闭 = 一律 503，不产生任何上游调用/缓存写入；开放 = 置 env true 即可。 */
      if (!enabled) return res.status(503).json({ ok: false, error: 'AI 解读已停用' });
      const body = req.body || {};
      const sentence = typeof body.sentence === 'string' ? body.sentence.trim() : '';
      if (!sentence) return res.status(400).json({ error: 'sentence 缺失' });
      if (sentence.length > 2000) return res.status(400).json({ error: 'sentence 过长' });
      const model = (typeof body.model === 'string' && body.model.trim()) ? body.model.trim() : 'deepseek-v4-flash';
      /* P2（2026-09-11 安全审查）：限制可选字段长度，防超长串膨胀缓存键/提示词/上游请求体。
         model 进缓存键与 DeepSeek 请求体；zh 进缓存键与提示词；apiKey 进上游 Authorization。 */
      if (model.length > 64) return res.status(400).json({ error: 'model 过长' });
      if (typeof body.zh === 'string' && body.zh.length > 2000) return res.status(400).json({ error: '中文释义过长' });
      if (typeof body.apiKey === 'string' && body.apiKey.trim().length > 256) return res.status(400).json({ error: 'apiKey 过长' });
      /* P2-4（2026-09-11）：缓存键纳入 zh 语境。英语多义句（如 bank）配不同中文释义，
         解读结果完全不同，仅按 norm(sentence) 会串味。zh 为空时保持旧 key 格式（向后兼容）。 */
      const cacheKey = model + '::' + ai.norm(sentence)
        + (typeof body.zh === 'string' && body.zh.trim() ? '::' + ai.norm(body.zh) : '');
  
      /* 1) 服务端缓存命中（不占限流额度；cacheTtl 内有效，过期视为 miss）
         命中判定含 promptVersion：ver 不匹配（旧版缓存/提示词升级）→ miss 重新生成 */
      const hit = cacheTtl > 0
        ? db.prepare("SELECT value_json FROM ai_cache WHERE key=? AND updated_at >= datetime('now', ?)").get(cacheKey, '-' + cacheTtl + ' days')
        : db.prepare('SELECT value_json FROM ai_cache WHERE key=?').get(cacheKey);
      if (hit) {
        let c = null;
        try { c = JSON.parse(hit.value_json); } catch (e) { /* 损坏视为 miss */ }
        if (c && c.ver === promptVersion) {
          metrics.aiCacheHits++;
          res.json({ ok: true, cached: true, data: c.data });
          return;
        }
        /* ver 不匹配：旧缓存作废，落到下方 miss 重新生成（重新生成后覆盖） */
      }
      metrics.aiCacheMisses++;
  
      /* 2) 每用户滑动窗口限流 */
      if (!ai.rateLimit(req.userId)) return res.status(429).json({ error: 'AI 请求过于频繁，请稍后再试' });
  
      /* 3) Key 解析：服务端 env 优先；自托管允许前端传（仅服务端未配置时被接受） */
      const apiKey = ai.DEEPSEEK_API_KEY || (typeof body.apiKey === 'string' ? body.apiKey.trim() : '');
      if (!apiKey) return res.status(400).json({ error: '服务端未配置 DEEPSEEK_API_KEY（且未提供 apiKey）' });
  
      /* 4) 构建提示词（与前端原版一致）并调用 DeepSeek（5xx/网络错误自动重试一次） */
      const prompt = '请用中文讲解以下英语句子，面向英语学习者。输出纯 JSON，不要代码块标记，字段：orig(原句英文)、zh(中文意思)、chunks(意群数组，每项含 text 和 role 语法角色)、grammar(核心语法要点数组)、collocations(固定搭配/短语数组)、scenario(使用场景说明)。\n句子：' + sentence + '\n中文：' + (typeof body.zh === 'string' ? body.zh : '');
      ai.callDeepSeekRetry({
        model: model,
        messages: [
          { role: 'system', content: '你是专业的英语老师，只返回 JSON。' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3
      }, apiKey).then(function (r) {
        if (r.status !== 200) { res.status(502).json({ error: '上游模型返回 ' + r.status + '：' + String(r.raw).slice(0, 300) }); return; }
        const data = JSON.parse(r.raw);
        const content = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
        const clean = String(content).replace(/```json/gi, '').replace(/```/g, '').trim();
        const obj = JSON.parse(clean);
        db.prepare("INSERT OR REPLACE INTO ai_cache (key,value_json,updated_at) VALUES (?,?,datetime('now'))")
          .run(cacheKey, JSON.stringify({ data: obj, ver: promptVersion }));
        ai.trimAiCache(db, cacheMax, cacheTtl);
        res.json({ ok: true, cached: false, data: obj });
      }).catch(function (e) {
        res.status(502).json({ error: 'AI 调用失败：' + (e && e.message) });
      });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
  
}

module.exports = { registerAiRoutes };

