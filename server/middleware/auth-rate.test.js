'use strict';

const assert = require('node:assert/strict');
const { createAuthRateLimiter } = require('./auth-rate');

const limiter = createAuthRateLimiter({ windowMs: 60 * 1000 });
assert.equal(limiter.rateBlocked('127.0.0.1', 'loginFail', 2), false);
assert.equal(limiter.rateHit('127.0.0.1', 'loginFail', 2), true);
assert.equal(limiter.rateHit('127.0.0.1', 'loginFail', 2), true);
assert.equal(limiter.rateBlocked('127.0.0.1', 'loginFail', 2), true);
assert.equal(limiter.rateHit('127.0.0.1', 'loginFail', 2), false);
limiter.rateClear('127.0.0.1', 'loginFail');
assert.equal(limiter.rateBlocked('127.0.0.1', 'loginFail', 2), false);
limiter.close();
console.log('auth-rate.test.js passed');
