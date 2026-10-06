'use strict';

// Use the same reducer build consumed by the browser. Keeping only this tiny
// server adapter avoids two copies of replay semantics drifting over time.
const { reducePracticeEvents } = require('../../js/learning-engine.cjs');

module.exports = { reducePracticeEvents };
