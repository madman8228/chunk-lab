'use strict';
function createCourseContentGuard({ registry }) {
  return function courseContentGuard(req, res, next) {
    try {
      if (!registry.blockedPath(req.path)) return next();
      res.set('Cache-Control', 'private, no-store').status(403).end('Protected course content');
    } catch (_) {
      res.set('Cache-Control', 'private, no-store').status(503).end('Course content temporarily unavailable');
    }
  };
}
module.exports = { createCourseContentGuard };
