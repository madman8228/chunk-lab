'use strict';

const SUPPORTED_FORMATS = new Set(['legacy-v1', 'references-v1']);

function createLearningDataFormat(db) {
  const read = db.prepare('SELECT format FROM user_learning_data_formats WHERE user_id=?');
  function forUser(userId) {
    const row = read.get(userId);
    const format = row ? row.format : 'legacy-v1';
    if (!SUPPORTED_FORMATS.has(format)) throw new Error('账号学习数据格式配置无效');
    return format;
  }
  return { forUser };
}

module.exports = { createLearningDataFormat };
