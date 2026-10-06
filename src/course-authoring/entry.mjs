import { AuthoringController } from './ui/controller.mjs';
import { AuthoringView } from './ui/view.mjs';
import { createCourseAuthoringService } from './create-service.mjs';

async function boot() {
  const root = document.querySelector('#course-create-root');
  if (!root) return;
  try {
    if (!window.CL || !window.CL.preload || !window.CourseSchemaValidator || !window.ChunkCourse) throw new Error('课程模块尚未加载完成，请刷新后重试。');
    await Promise.all([window.CL.ensureCloud(), window.CL.preload(), window.ContentRepo && window.ContentRepo.ready || Promise.resolve()]);
    window.AccountStorage.assertCurrent();
    const { service, sessionRepository, scopeGuard, io } = createCourseAuthoringService(window);
    const controller = new AuthoringController({ root, view: new AuthoringView({ root }), service, sessionRepository, scopeGuard, io });
    await controller.start();
  } catch (error) {
    root.innerHTML = `<main class="create-shell"><div class="global-error" role="alert">${String(error && error.message || error).replace(/[&<>"']/g, '')}</div><a href="decks.html">返回课程库</a></main>`;
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => boot(), { once: true });
else boot();
