import { DRAFT_SPEC } from './draft-spec.mjs';
import { CourseCapabilityCatalog } from './capabilities.mjs';
import { AiCoursePromptComposer } from './prompt-composer.mjs';
import { AiDraftValidator } from './draft-validator.mjs';
import { CourseDraftCompiler } from './draft-compiler.mjs';
import { CourseAuthoringService } from './service.mjs';
import { BrowserAuthoringSessionRepository } from './adapters/session-repository.mjs';
import { ResilientSessionRepository } from './adapters/resilient-session-repository.mjs';
import { BrowserIO } from './adapters/browser-io.mjs';
import { ExistingCourseGateway } from './adapters/course-gateway.mjs';
import { ImageTextDraftValidator } from './image-text-draft-validator.mjs';
import { ImageTextCourseCompiler } from './image-text-compiler.mjs';
import { BrowserImageFileReader } from './adapters/image-file-reader.mjs';
import { ImageTextBundleCodec } from './image-bundle-codec.mjs';
import { ImageTextPackageAdapter } from './adapters/image-text-package-adapter.mjs';

export function createCourseAuthoringService(win = globalThis) {
  if (!win.CL || !win.CourseSchemaValidator || !win.ChunkCourse) throw new Error('课程模块尚未加载完成，请刷新后重试。');
  const io = new BrowserIO();
  const scopeGuard = io.guard();
  const schemaValidator = win.CourseSchemaValidator;
  const sessionRepository = new ResilientSessionRepository({ primary: new BrowserAuthoringSessionRepository({ scopeGuard }) });
  const courseGateway = new ExistingCourseGateway({ scopeGuard });
  const draftValidator = new AiDraftValidator({ schemaValidator, chunkShape: win.ChunkShape || null });
  const compiler = new CourseDraftCompiler({ validator: draftValidator });
  const service = new CourseAuthoringService({
    sessionRepository, courseGateway, schemaValidator,
    promptComposer: new AiCoursePromptComposer({ spec: DRAFT_SPEC, capabilities: CourseCapabilityCatalog }),
    draftValidator, compiler,
    imageDraftValidator: new ImageTextDraftValidator({ schemaValidator }),
    imageCompiler: new ImageTextCourseCompiler({ schemaValidator, packageContract: win.CoursePackageContract }),
    imageFileReader: new BrowserImageFileReader(), imageBundleCodec: new ImageTextBundleCodec(),
    imagePackageAdapter: new ImageTextPackageAdapter(), io, scopeGuard,
  });
  return { service, sessionRepository, courseGateway, scopeGuard, io };
}
