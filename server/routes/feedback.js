'use strict';

function registerFeedbackRoutes(options) {
  options.app.post('/api/feedback', options.feedback.submit);
}

module.exports = { registerFeedbackRoutes };
