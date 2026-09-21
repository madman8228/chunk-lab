'use strict';

/* Per-user change watermarks used by delta sync. Keep SQL and sequencing
 * semantics out of the HTTP entry point so snapshot/write code shares one
 * small, testable boundary. */
function createChangeSequence(options) {
  const stmt = options && options.stmt;
  if (typeof stmt !== 'function') throw new TypeError('change sequence requires stmt');

  const select = stmt('SELECT seq FROM user_change_seq WHERE user_id=?');
  const allocate = stmt(
    'INSERT INTO user_change_seq (user_id, seq) VALUES (?, 1) ' +
    'ON CONFLICT(user_id) DO UPDATE SET seq = seq + 1 RETURNING seq'
  );

  function currentSeq(userId) {
    const row = select.get(userId);
    return row ? row.seq : 0;
  }

  function allocSeq(userId) {
    const row = allocate.get(userId);
    return row ? row.seq : 1;
  }

  return Object.freeze({ currentSeq, allocSeq });
}

module.exports = { createChangeSequence };
