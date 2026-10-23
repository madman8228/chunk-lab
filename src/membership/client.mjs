export class MembershipClient {
  constructor({ request, readCatalog }) { this.request = request; this.readCatalog = readCatalog; }
  catalog() { return this.readCatalog ? this.readCatalog() : this.request('/api/course-content/catalog', { timeoutMs: 8000 }); }
  start(input) { return this.request('/api/learning-sessions/start', { method: 'POST', body: JSON.stringify(input), timeoutMs: 8000 }); }
  startAssessment(input) { return this.request('/api/protected-assessments/start', { method: 'POST', body: JSON.stringify(input), timeoutMs: 8000 }); }
  contentGrant(input) { return this.request('/api/learning-sessions/content-grant', { method: 'POST', body: JSON.stringify(input), timeoutMs: 8000 }); }
  previewGrant(input) { return this.request('/api/course-content/preview-grant', { method: 'POST', body: JSON.stringify(input), timeoutMs: 8000 }); }
  action(sessionId, sequence, action) {
    return this.request('/api/learning-sessions/' + encodeURIComponent(sessionId) + '/' + action,
      { method: 'POST', body: JSON.stringify({ sequence }), timeoutMs: 8000 });
  }
  read(courseId, unitId, cursor, sessionId) {
    return this.request('/api/course-content/' + encodeURIComponent(courseId) + '/units/' + encodeURIComponent(unitId) + '?cursor=' + cursor,
      { headers: sessionId ? { 'X-Learning-Session': sessionId } : {}, timeoutMs: 8000 });
  }
}
