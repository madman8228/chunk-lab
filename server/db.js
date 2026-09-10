/**
 * db.js · SQLite 连接与表结构
 *
 * 多用户隔离模型：
 *   users                 — 账号
 *   user_decks            — 用户自定义题库（内置 deck 仍由前端 builtins.js 提供，不入库）
 *   user_kv               — 键值型用户数据（best / mastered / stats / settings / reinforceBook / deletedItems）
 *   user_courses          — 用户图文课程（chunklab.courses.v1 的逐条拆分，便于增量）
 *   user_course_progress  — 课程进度（chunklab.course-progress.v1 的逐条拆分）
 *   user_sentence_stats   — 句子级学习档案（stats.bySentence 的逐行拆分，8000 句扩容）
 *   user_events           — 答题/轮次事件日志（stats.events 的逐行拆分，append-only）
 *   user_entity_rows      — 通用行级实体（mastered / reinforce / deletedItem 的逐行拆分）
 *   ai_cache              — AI 详解缓存（全局共享，key = 模型+归一化句子）
 *
 * ADR-005（实体级 rev upsert + 软删除）：
 *   每个可同步实体带 `rev`（整数版本号，本地每次变更 +1）与 `deleted_at`（软删除标记）。
 *   服务端 upsert 用 `ON CONFLICT ... DO UPDATE ... WHERE excluded.rev IS NULL OR excluded.rev > <table>.rev`
 *   —— 旧版本写入被拒、新版本胜出，互不覆盖无关改动；崩溃不会清空用户数据（不再整块 DELETE）。
 *   旧数据/旧客户端无 rev（rev 默认 0 且写入时传 null）→ 退化为「总是覆盖」，向后兼容。
 */
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = process.env.CHUNKLAB_DATA_DIR || path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'chunklab.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_decks (
  id         TEXT NOT NULL,
  user_id    INTEGER NOT NULL,
  name       TEXT NOT NULL,
  items_json TEXT NOT NULL,
  builtin    INTEGER,
  rev        INTEGER,
  is_public  INTEGER DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_kv (
  user_id INTEGER NOT NULL,
  k       TEXT NOT NULL,
  v_json  TEXT NOT NULL,
  rev        INTEGER,
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, k),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_courses (
  user_id    INTEGER NOT NULL,
  course_id  TEXT NOT NULL,
  data_json  TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, course_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_course_progress (
  user_id    INTEGER NOT NULL,
  course_id  TEXT NOT NULL,
  data_json  TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, course_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ai_cache (
  key       TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

/* ----- 8000 句扩容（2026-09-10）：把 stats 的两个「随练习量无限增长」的大对象从 kv blob 拆成行表。
   根因：「stats」作为**单个** kv 实体承载了 86.8% 的同步体积（8000 句实测 7191KB/次），
   而 PUT /api/data 是热路径（每答一题，400ms debounce）→ 每答一题都重传整份学习档案。
   拆表后客户端只上行变更行（实测 ~0.5KB，15121×）。

   ⚠️ 这两张表**故意不带 rev** —— bySentence / events 的跨设备合并不走 last-write-wins，
   而是靠 core.js 的 mergeStats 按「事件 id 并集」重建计数（O(events+keys) 幂等），
   冲突由重建语义解决，rev 反而会误拒合并结果。软删除仍然保留（sbsGone → deleted_at）。
   ⚠️ 本注释在 db.exec 的模板字符串**内部**，绝不能出现反引号 —— 会提前闭合模板。 */
CREATE TABLE IF NOT EXISTS user_sentence_stats (
  user_id      INTEGER NOT NULL,
  sentence_key TEXT NOT NULL,
  deck_id      TEXT,
  data_json    TEXT NOT NULL,
  deleted_at   TEXT,
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, sentence_key),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_events (
  user_id    INTEGER NOT NULL,
  id         TEXT NOT NULL,
  at         INTEGER,
  data_json  TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

/* ----- 热路径补齐（2026-09-10 第二轮）：mastered / reinforceBook / deletedItems 也是
   「随练习量无限增长」的对象，却仍塞在 user_kv 的单行 blob 里。它们在**每答一题**的路径上
   被搬运四次（本地 JSON.stringify 落盘 + maintainRevs 签名 + 上行 payload + 服务端整块回写），
   mastered 8000 条约 227KB、错题本上限 200 条约 176KB → 单次答题约 400KB 的无谓搬运，
   与「stats 拆表」前是同一类根因。

   用**一张通用行表**承载三者，而不是三张专用表：
     - 三者形态完全一致（键 → 值 + 软删），读写/迁移/协议派生逻辑可只写一份；
     - 以后再出现同类「随练习量增长」的对象，只加一个 kind 白名单值，不动 schema。

   kind 取值（写入口做白名单校验，防止非法 kind 无界增长）：
     mastered     → item_key = deckId#cid，data_json = { deckId, sentence, markedAt }
     reinforce    → item_key = 错题本 _key（deckId + '::' + sentence），data_json = 整题快照
     deletedItem  → item_key = deckId#cid（内置句删除登记），data_json 恒为 '1'（它本质是集合）

   ⚠️ 错题本要按「插入序」还原成数组（客户端用 slice(-200) 保留最新 200 条），
      故读取一律 ORDER BY rowid —— 隐式 rowid 在 UPDATE 时不变，天然是稳定的插入序。
   ⚠️ 本注释在 db.exec 的模板字符串内部，绝不能出现反引号。 */
CREATE TABLE IF NOT EXISTS user_entity_rows (
  user_id    INTEGER NOT NULL,
  kind       TEXT NOT NULL,
  item_key   TEXT NOT NULL,
  data_json  TEXT NOT NULL,
  deleted_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, kind, item_key),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_decks_user ON user_decks(user_id);
CREATE INDEX IF NOT EXISTS idx_entity_rows_user ON user_entity_rows(user_id, kind);
CREATE INDEX IF NOT EXISTS idx_kv_user ON user_kv(user_id);
CREATE INDEX IF NOT EXISTS idx_courses_user ON user_courses(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_user ON user_course_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_sbs_user ON user_sentence_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_events_user ON user_events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_user_at ON user_events(user_id, at);
`);

/* ----- ADR-005 迁移：给已存在的表补 rev / deleted_at 列 -----
   CREATE TABLE IF NOT EXISTS 不会改已有表，故对升级前的库做 ALTER ADD COLUMN。 */
function addColumnIfMissing(table, col, type) {
  const cols = db.prepare('PRAGMA table_info(' + table + ')').all().map(function (r) { return r.name; });
  if (cols.indexOf(col) < 0) {
    db.prepare('ALTER TABLE ' + table + ' ADD COLUMN ' + col + ' ' + type).run();
  }
}
['user_decks', 'user_kv', 'user_courses', 'user_course_progress'].forEach(function (t) {
  addColumnIfMissing(t, 'rev', 'INTEGER');
  addColumnIfMissing(t, 'deleted_at', 'TEXT');
});
// user_kv 升级前无 updated_at（user_decks 有），补列；旧行 NULL，由 upsert 显式赋值
addColumnIfMissing('user_kv', 'updated_at', 'TEXT');
// 公共题库市场（Phase D）：user_decks 补 is_public 列（0=私有，1=已发布到市场）
addColumnIfMissing('user_decks', 'is_public', 'INTEGER DEFAULT 0');

module.exports = db;
