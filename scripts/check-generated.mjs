import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';
import { DRAFT_SPEC } from '../src/course-authoring/draft-spec.mjs';
import { CourseCapabilityCatalog } from '../src/course-authoring/capabilities.mjs';
import { IMAGE_TEXT_DRAFT_SPEC } from '../src/course-authoring/image-text-draft-spec.mjs';
import { COURSE_TYPES } from '../src/course-authoring/course-types.mjs';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'chunklab-generated-'));
const expected = path.join(root, 'js', 'vendor', 'course-schema-validator.js');
const actual = path.join(temp, 'course-schema-validator.js');
const expectedIdentity = path.join(root, 'js', 'core-identity.js');
const actualIdentity = path.join(temp, 'core-identity.js');
const expectedMerge = path.join(root, 'js', 'core-merge.js');
const actualMerge = path.join(temp, 'core-merge.js');
const expectedActivity = path.join(root, 'js', 'core-activity.js');
const actualActivity = path.join(temp, 'core-activity.js');
const expectedEventBus = path.join(root, 'js', 'core-event-bus.js');
const actualEventBus = path.join(temp, 'core-event-bus.js');
const expectedMigrations = path.join(root, 'js', 'core-migrations.js');
const actualMigrations = path.join(temp, 'core-migrations.js');
const expectedStatsSignature = path.join(root, 'js', 'core-stats-signature.js');
const actualStatsSignature = path.join(temp, 'core-stats-signature.js');
const expectedStorageState = path.join(root, 'js', 'core-storage-state.js');
const actualStorageState = path.join(temp, 'core-storage-state.js');
const expectedEntityDelta = path.join(root, 'js', 'core-entity-delta.js');
const actualEntityDelta = path.join(temp, 'core-entity-delta.js');
const expectedSyncDelta = path.join(root, 'js', 'core-sync-delta.js');
const actualSyncDelta = path.join(temp, 'core-sync-delta.js');
const expectedSyncIntents = path.join(root, 'js', 'core-sync-intents.js');
const actualSyncIntents = path.join(temp, 'core-sync-intents.js');
const expectedSyncPayload = path.join(root, 'js', 'core-sync-payload.js');
const actualSyncPayload = path.join(temp, 'core-sync-payload.js');
const expectedSyncTransport = path.join(root, 'js', 'core-sync-transport.js');
const actualSyncTransport = path.join(temp, 'core-sync-transport.js');
const expectedSyncReplay = path.join(root, 'js', 'core-sync-replay.js');
const actualSyncReplay = path.join(temp, 'core-sync-replay.js');
const expectedSyncBatchMerge = path.join(root, 'js', 'core-sync-batch-merge.js');
const actualSyncBatchMerge = path.join(temp, 'core-sync-batch-merge.js');
const expectedSyncStatsNormalize = path.join(root, 'js', 'core-sync-stats-normalize.js');
const actualSyncStatsNormalize = path.join(temp, 'core-sync-stats-normalize.js');
const expectedSyncLearningMarks = path.join(root, 'js', 'core-sync-learning-marks.js');
const actualSyncLearningMarks = path.join(temp, 'core-sync-learning-marks.js');
const expectedSyncEntityMerge = path.join(root, 'js', 'core-sync-entity-merge.js');
const actualSyncEntityMerge = path.join(temp, 'core-sync-entity-merge.js');
const expectedSyncKv = path.join(root, 'js', 'core-sync-kv.js');
const actualSyncKv = path.join(temp, 'core-sync-kv.js');
const expectedRevisionDelta = path.join(root, 'js', 'core-revision-delta.js');
const actualRevisionDelta = path.join(temp, 'core-revision-delta.js');
const expectedRuntime = path.join(root, 'js', 'core-runtime.js');
const actualRuntime = path.join(temp, 'core-runtime.js');
const expectedMainLifecycle = path.join(root, 'js', 'main-lifecycle.js');
const actualMainLifecycle = path.join(temp, 'main-lifecycle.js');
const expectedMain = path.join(root, 'js', 'main.js');
const actualMain = path.join(temp, 'main.js');
const expectedMainExplanation = path.join(root, 'js', 'main-explanation.js');
const actualMainExplanation = path.join(temp, 'main-explanation.js');
const expectedMainPracticePolicy = path.join(root, 'js', 'main-practice-policy.js');
const actualMainPracticePolicy = path.join(temp, 'main-practice-policy.js');
const expectedMainPracticeClassification = path.join(root, 'js', 'main-practice-classification.js');
const actualMainPracticeClassification = path.join(temp, 'main-practice-classification.js');
const expectedMainCourseNavigation = path.join(root, 'js', 'main-course-navigation.js');
const actualMainCourseNavigation = path.join(temp, 'main-course-navigation.js');
const expectedMainDeckProgress = path.join(root, 'js', 'main-deck-progress.js');
const actualMainDeckProgress = path.join(temp, 'main-deck-progress.js');
const expectedMainHomeSummary = path.join(root, 'js', 'main-home-summary.js');
const actualMainHomeSummary = path.join(temp, 'main-home-summary.js');
const expectedMainPracticeState = path.join(root, 'js', 'main-practice-state.js');
const actualMainPracticeState = path.join(temp, 'main-practice-state.js');
const expectedMainPracticeMarkup = path.join(root, 'js', 'main-practice-markup.js');
const actualMainPracticeMarkup = path.join(temp, 'main-practice-markup.js');
const expectedMainCourseLearningPolicy = path.join(root, 'js', 'main-course-learning-policy.js');
const actualMainCourseLearningPolicy = path.join(temp, 'main-course-learning-policy.js');
const expectedLearningEngine = path.join(root, 'js', 'learning-engine.js');
const actualLearningEngine = path.join(temp, 'learning-engine.js');
const expectedLearningEngineServer = path.join(root, 'js', 'learning-engine.cjs');
const actualLearningEngineServer = path.join(temp, 'learning-engine.cjs');
const expectedMainLegacyStats = path.join(root, 'js', 'main-legacy-stats.js');
const actualMainLegacyStats = path.join(temp, 'main-legacy-stats.js');
const expectedAuthoring = path.join(root, 'js', 'course-authoring.js');
const actualAuthoring = path.join(temp, 'course-authoring.js');
const expectedCapabilities = path.join(root, 'js', 'course-capabilities.js');
const actualCapabilities = path.join(temp, 'course-capabilities.js');
const expectedLearningLaunch = path.join(root, 'js', 'course-learning-launch.js');
const actualLearningLaunch = path.join(temp, 'course-learning-launch.js');
const expectedMistakeReview = path.join(root, 'js', 'mistake-review.js');
const actualMistakeReview = path.join(temp, 'mistake-review.js');
const expectedMistakeEvidenceBrowser = path.join(root, 'js', 'mistake-evidence.js');
const actualMistakeEvidenceBrowser = path.join(temp, 'mistake-evidence.js');
const expectedMistakeEvidenceServer = path.join(root, 'js', 'mistake-evidence.cjs');
const actualMistakeEvidenceServer = path.join(temp, 'mistake-evidence.cjs');
try {
  await Promise.all([
    esbuild.build({
      entryPoints: [path.join(root, 'scripts', 'course-schema-validator-entry.js')],
      outfile: actual,
      bundle: true,
      format: 'iife',
      platform: 'browser',
      globalName: 'CourseSchemaValidatorBundle',
      minify: true,
      legalComments: 'none',
      define: { 'process.env.NODE_ENV': '"production"' },
    }),
    esbuild.build({
      entryPoints: [path.join(root, 'scripts', 'core-identity-entry.mjs')],
      outfile: actualIdentity,
      bundle: true,
      format: 'iife',
      platform: 'browser',
      minify: false,
      legalComments: 'none',
    }),
    esbuild.build({
      entryPoints: [path.join(root, 'scripts', 'core-merge-entry.mjs')],
      outfile: actualMerge,
      bundle: true,
      format: 'iife',
      platform: 'browser',
      minify: false,
      legalComments: 'none',
    }),
    esbuild.build({
      entryPoints: [path.join(root, 'scripts', 'core-activity-entry.mjs')],
      outfile: actualActivity,
      bundle: true,
      format: 'iife',
      platform: 'browser',
      minify: false,
      legalComments: 'none',
    }),
    esbuild.build({
      entryPoints: [path.join(root, 'scripts', 'core-event-bus-entry.mjs')],
      outfile: actualEventBus,
      bundle: true,
      format: 'iife',
      platform: 'browser',
      minify: false,
      legalComments: 'none',
    }),
    esbuild.build({
      entryPoints: [path.join(root, 'scripts', 'core-migrations-entry.mjs')],
      outfile: actualMigrations,
      bundle: true,
      format: 'iife',
      platform: 'browser',
      minify: false,
      legalComments: 'none',
    }),
    esbuild.build({
      entryPoints: [path.join(root, 'scripts', 'core-stats-signature-entry.mjs')],
      outfile: actualStatsSignature,
      bundle: true,
      format: 'iife',
      platform: 'browser',
      minify: false,
      legalComments: 'none',
    }),
    esbuild.build({
      entryPoints: [path.join(root, 'scripts', 'core-storage-state-entry.mjs')],
      outfile: actualStorageState,
      bundle: true,
      format: 'iife',
      platform: 'browser',
      minify: false,
      legalComments: 'none',
    }),
    esbuild.build({
      entryPoints: [path.join(root, 'scripts', 'core-entity-delta-entry.mjs')],
      outfile: actualEntityDelta,
      bundle: true,
      format: 'iife',
      platform: 'browser',
      minify: false,
      legalComments: 'none',
    }),
    esbuild.build({
      entryPoints: [path.join(root, 'scripts', 'core-sync-delta-entry.mjs')],
      outfile: actualSyncDelta,
      bundle: true,
      format: 'iife',
      platform: 'browser',
      minify: false,
      legalComments: 'none',
    }),
    esbuild.build({
      entryPoints: [path.join(root, 'scripts', 'core-sync-intents-entry.mjs')],
      outfile: actualSyncIntents,
      bundle: true,
      format: 'iife',
      platform: 'browser',
      minify: false,
      legalComments: 'none',
    }),
    esbuild.build({
      entryPoints: [path.join(root, 'scripts', 'core-sync-payload-entry.mjs')],
      outfile: actualSyncPayload,
      bundle: true,
      format: 'iife',
      platform: 'browser',
      minify: false,
      legalComments: 'none',
    }),
    esbuild.build({
      entryPoints: [path.join(root, 'scripts', 'core-sync-transport-entry.mjs')],
      outfile: actualSyncTransport,
      bundle: true,
      format: 'iife',
      platform: 'browser',
      minify: false,
      legalComments: 'none',
    }),
    esbuild.build({
      entryPoints: [path.join(root, 'scripts', 'core-sync-replay-entry.mjs')],
      outfile: actualSyncReplay,
      bundle: true,
      format: 'iife',
      platform: 'browser',
      minify: false,
      legalComments: 'none',
    }),
    esbuild.build({
      entryPoints: [path.join(root, 'scripts', 'core-sync-batch-merge-entry.mjs')],
      outfile: actualSyncBatchMerge,
      bundle: true,
      format: 'iife',
      platform: 'browser',
      minify: false,
      legalComments: 'none',
    }),
    esbuild.build({
      entryPoints: [path.join(root, 'scripts', 'core-sync-stats-normalize-entry.mjs')],
      outfile: actualSyncStatsNormalize,
      bundle: true,
      format: 'iife',
      platform: 'browser',
      minify: false,
      legalComments: 'none',
    }),
    esbuild.build({
      entryPoints: [path.join(root, 'scripts', 'core-sync-learning-marks-entry.mjs')],
      outfile: actualSyncLearningMarks,
      bundle: true,
      format: 'iife',
      platform: 'browser',
      minify: false,
      legalComments: 'none',
    }),
    esbuild.build({
      entryPoints: [path.join(root, 'scripts', 'core-sync-entity-merge-entry.mjs')],
      outfile: actualSyncEntityMerge,
      bundle: true,
      format: 'iife',
      platform: 'browser',
      minify: false,
      legalComments: 'none',
    }),
    esbuild.build({
      entryPoints: [path.join(root, 'scripts', 'core-sync-kv-entry.mjs')],
      outfile: actualSyncKv,
      bundle: true,
      format: 'iife',
      platform: 'browser',
      minify: false,
      legalComments: 'none',
    }),
    esbuild.build({
      entryPoints: [path.join(root, 'scripts', 'core-revision-delta-entry.mjs')],
      outfile: actualRevisionDelta,
      bundle: true,
      format: 'iife',
      platform: 'browser',
      globalName: 'CoreRevisionDelta',
      minify: false,
      legalComments: 'none',
    }),
    esbuild.build({
      entryPoints: [path.join(root, 'scripts', 'core-runtime-entry.mjs')],
      outfile: actualRuntime,
      bundle: true,
      format: 'iife',
      platform: 'browser',
      minify: false,
      legalComments: 'none',
    }),
    esbuild.build({
      entryPoints: [path.join(root, 'scripts', 'main-lifecycle-entry.mjs')],
      outfile: actualMainLifecycle,
      bundle: true,
      format: 'iife',
      platform: 'browser',
      globalName: 'MainLifecycle',
      minify: false,
      legalComments: 'none',
    }),
    esbuild.build({
      entryPoints: [path.join(root, 'scripts', 'main-lifecycle-entry.mjs')],
      outfile: actualMain,
      bundle: true,
      format: 'iife',
      platform: 'browser',
      globalName: 'MainLifecycle',
      minify: false,
      legalComments: 'none',
    }),
    esbuild.build({
      entryPoints: [path.join(root, 'scripts', 'main-explanation-entry.mjs')],
      outfile: actualMainExplanation,
      bundle: true,
      format: 'iife',
      platform: 'browser',
      globalName: 'MainExplanation',
      minify: false,
      legalComments: 'none',
    }),
    esbuild.build({
      entryPoints: [path.join(root, 'scripts', 'main-practice-policy-entry.mjs')],
      outfile: actualMainPracticePolicy,
      bundle: true,
      format: 'iife',
      platform: 'browser',
      globalName: 'MainPracticePolicy',
      minify: false,
      legalComments: 'none',
    }),
    esbuild.build({
      entryPoints: [path.join(root, 'scripts', 'main-practice-classification-entry.mjs')],
      outfile: actualMainPracticeClassification,
      bundle: true,
      format: 'iife',
      platform: 'browser',
      globalName: 'MainPracticeClassification',
      minify: false,
      legalComments: 'none',
    }),
    esbuild.build({
      entryPoints: [path.join(root, 'scripts', 'main-course-navigation-entry.mjs')],
      outfile: actualMainCourseNavigation,
      bundle: true,
      format: 'iife',
      platform: 'browser',
      globalName: 'MainCourseNavigation',
      minify: false,
      legalComments: 'none',
    }),
    esbuild.build({
      entryPoints: [path.join(root, 'scripts', 'main-deck-progress-entry.mjs')],
      outfile: actualMainDeckProgress,
      bundle: true,
      format: 'iife',
      platform: 'browser',
      globalName: 'MainDeckProgress',
      minify: false,
      legalComments: 'none',
    }),
    esbuild.build({
      entryPoints: [path.join(root, 'scripts', 'main-home-summary-entry.mjs')],
      outfile: actualMainHomeSummary,
      bundle: true,
      format: 'iife',
      platform: 'browser',
      globalName: 'MainHomeSummary',
      minify: false,
      legalComments: 'none',
    }),
    esbuild.build({
      entryPoints: [path.join(root, 'scripts', 'main-practice-state-entry.mjs')],
      outfile: actualMainPracticeState,
      bundle: true,
      format: 'iife',
      platform: 'browser',
      globalName: 'MainPracticeState',
      minify: false,
      legalComments: 'none',
    }),
    esbuild.build({
      entryPoints: [path.join(root, 'scripts', 'main-practice-markup-entry.mjs')],
      outfile: actualMainPracticeMarkup,
      bundle: true,
      format: 'iife',
      platform: 'browser',
      globalName: 'MainPracticeMarkup',
      minify: false,
      legalComments: 'none',
    }),
    esbuild.build({ entryPoints: [path.join(root, 'scripts', 'main-course-learning-policy-entry.mjs')], outfile: actualMainCourseLearningPolicy, bundle: true, format: 'iife', platform: 'browser', minify: false, legalComments: 'none' }),
    esbuild.build({ entryPoints: [path.join(root, 'scripts', 'learning-engine-entry.mjs')], outfile: actualLearningEngine, bundle: true, format: 'iife', platform: 'browser', globalName: 'LearningEngine', minify: false, legalComments: 'none' }),
    esbuild.build({ entryPoints: [path.join(root, 'scripts', 'learning-engine-entry.mjs')], outfile: actualLearningEngineServer, bundle: true, format: 'cjs', platform: 'node', minify: false, legalComments: 'none', banner: { js: '// @ts-nocheck Generated CommonJS bundle; source modules are checked directly.' } }),
    esbuild.build({
      entryPoints: [path.join(root, 'scripts', 'main-legacy-stats-entry.mjs')],
      outfile: actualMainLegacyStats,
      bundle: true,
      format: 'iife',
      platform: 'browser',
      globalName: 'MainLegacyStats',
      minify: false,
      legalComments: 'none',
    }),
    esbuild.build({ entryPoints: [path.join(root, 'scripts', 'course-authoring-entry.mjs')], outfile: actualAuthoring, bundle: true, format: 'iife', platform: 'browser', globalName: 'ChunkCourseAuthoring', minify: false, legalComments: 'none' }),
    esbuild.build({ entryPoints: [path.join(root, 'scripts', 'course-capabilities-entry.mjs')], outfile: actualCapabilities, bundle: true, format: 'iife', platform: 'browser', globalName: 'ChunkCourseCapabilitiesBundle', minify: false, legalComments: 'none' }),
    esbuild.build({ entryPoints: [path.join(root, 'scripts', 'course-learning-launch-entry.mjs')], outfile: actualLearningLaunch, bundle: true, format: 'iife', platform: 'browser', globalName: 'ChunkCourseLearningLaunchBundle', minify: false, legalComments: 'none' }),
    esbuild.build({ entryPoints: [path.join(root, 'scripts', 'mistake-review-entry.mjs')], outfile: actualMistakeReview, bundle: true, format: 'iife', platform: 'browser', minify: false, legalComments: 'none' }),
    esbuild.build({ entryPoints: [path.join(root, 'scripts', 'mistake-evidence-entry.mjs')], outfile: actualMistakeEvidenceBrowser, bundle: true, format: 'iife', platform: 'browser', minify: false, legalComments: 'none' }),
    esbuild.build({ entryPoints: [path.join(root, 'scripts', 'mistake-evidence-entry.mjs')], outfile: actualMistakeEvidenceServer, bundle: true, format: 'cjs', platform: 'node', minify: false, legalComments: 'none' }),
  ]);
  const hash = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  if (!fs.existsSync(expectedMainPracticeClassification)
    || hash(expectedMainPracticeClassification) !== hash(actualMainPracticeClassification)) {
    console.error('[build:check] main practice classification output differs; run npm run build');
    process.exitCode = 1;
  }
  if (!fs.existsSync(expectedRevisionDelta)
    || hash(expectedRevisionDelta) !== hash(actualRevisionDelta)) {
    console.error('[build:check] core revision delta output differs; run npm run build');
    process.exitCode = 1;
  }
  if (!fs.existsSync(expectedMainCourseNavigation)
    || hash(expectedMainCourseNavigation) !== hash(actualMainCourseNavigation)) {
    console.error('[build:check] main course navigation output differs; run npm run build');
    process.exitCode = 1;
  }
  if (!fs.existsSync(expectedMainDeckProgress)
    || hash(expectedMainDeckProgress) !== hash(actualMainDeckProgress)) {
    console.error('[build:check] main deck progress output differs; run npm run build');
    process.exitCode = 1;
  }
  if (!fs.existsSync(expectedMainHomeSummary)
    || hash(expectedMainHomeSummary) !== hash(actualMainHomeSummary)) {
    console.error('[build:check] main home summary output differs; run npm run build');
    process.exitCode = 1;
  }
  if (!fs.existsSync(expectedMainPracticeMarkup)
    || hash(expectedMainPracticeMarkup) !== hash(actualMainPracticeMarkup)) {
    console.error('[build:check] main practice markup output differs; run npm run build');
    process.exitCode = 1;
  }
  if (!fs.existsSync(expectedMainCourseLearningPolicy) || hash(expectedMainCourseLearningPolicy) !== hash(actualMainCourseLearningPolicy)) {
    console.error('[build:check] main course learning policy output differs; run npm run build');
    process.exitCode = 1;
  }
  if (!fs.existsSync(expectedLearningEngine) || hash(expectedLearningEngine) !== hash(actualLearningEngine)) {
    console.error('[build:check] learning engine output differs; run npm run build');
    process.exitCode = 1;
  }
  if (!fs.existsSync(expectedLearningEngineServer) || hash(expectedLearningEngineServer) !== hash(actualLearningEngineServer)) {
    console.error('[build:check] learning engine server bundle differs; run npm run build');
    process.exitCode = 1;
  }
  if (!fs.existsSync(expectedAuthoring) || hash(expectedAuthoring) !== hash(actualAuthoring)
    || !fs.existsSync(expectedCapabilities) || hash(expectedCapabilities) !== hash(actualCapabilities)
    || !fs.existsSync(expectedLearningLaunch) || hash(expectedLearningLaunch) !== hash(actualLearningLaunch)
    || !fs.existsSync(expectedMistakeReview) || hash(expectedMistakeReview) !== hash(actualMistakeReview)) {
    console.error('[build:check] AI course authoring bundles differ; run npm run build');
    process.exitCode = 1;
  }
  if (!fs.existsSync(expectedMistakeEvidenceBrowser) || hash(expectedMistakeEvidenceBrowser) !== hash(actualMistakeEvidenceBrowser)
    || !fs.existsSync(expectedMistakeEvidenceServer) || hash(expectedMistakeEvidenceServer) !== hash(actualMistakeEvidenceServer)) {
    console.error('[build:check] mistake evidence bundles differ; run npm run build');
    process.exitCode = 1;
  }
  const expectedKit = { kitVersion: '1.1', courseTypes: COURSE_TYPES, draftSchema: DRAFT_SPEC.schema, examples: DRAFT_SPEC.examples, imageTextDraftSchema: IMAGE_TEXT_DRAFT_SPEC.schema, imageTextExample: IMAGE_TEXT_DRAFT_SPEC.example, imageMediaLimits: IMAGE_TEXT_DRAFT_SPEC.mediaLimits, interactionRules: DRAFT_SPEC.interactionRules, capabilities: CourseCapabilityCatalog.describeCreationOptions() };
  if (!fs.existsSync(path.join(root, 'ai-course-kit.json')) || fs.readFileSync(path.join(root, 'ai-course-kit.json'), 'utf8') !== JSON.stringify(expectedKit, null, 2) + '\n') {
    console.error('[build:check] AI course kit differs; run npm run build');
    process.exitCode = 1;
  }
  if (!fs.existsSync(expected) || hash(expected) !== hash(actual) || !fs.existsSync(expectedIdentity) || hash(expectedIdentity) !== hash(actualIdentity) || !fs.existsSync(expectedMerge) || hash(expectedMerge) !== hash(actualMerge) || !fs.existsSync(expectedActivity) || hash(expectedActivity) !== hash(actualActivity) || !fs.existsSync(expectedEventBus) || hash(expectedEventBus) !== hash(actualEventBus) || !fs.existsSync(expectedMigrations) || hash(expectedMigrations) !== hash(actualMigrations) || !fs.existsSync(expectedStatsSignature) || hash(expectedStatsSignature) !== hash(actualStatsSignature) || !fs.existsSync(expectedStorageState) || hash(expectedStorageState) !== hash(actualStorageState) || !fs.existsSync(expectedEntityDelta) || hash(expectedEntityDelta) !== hash(actualEntityDelta) || !fs.existsSync(expectedSyncDelta) || hash(expectedSyncDelta) !== hash(actualSyncDelta) || !fs.existsSync(expectedSyncIntents) || hash(expectedSyncIntents) !== hash(actualSyncIntents) || !fs.existsSync(expectedSyncPayload) || hash(expectedSyncPayload) !== hash(actualSyncPayload) || !fs.existsSync(expectedSyncTransport) || hash(expectedSyncTransport) !== hash(actualSyncTransport) || !fs.existsSync(expectedSyncReplay) || hash(expectedSyncReplay) !== hash(actualSyncReplay) || !fs.existsSync(expectedSyncBatchMerge) || hash(expectedSyncBatchMerge) !== hash(actualSyncBatchMerge) || !fs.existsSync(expectedSyncStatsNormalize) || hash(expectedSyncStatsNormalize) !== hash(actualSyncStatsNormalize) || !fs.existsSync(expectedSyncLearningMarks) || hash(expectedSyncLearningMarks) !== hash(actualSyncLearningMarks) || !fs.existsSync(expectedSyncEntityMerge) || hash(expectedSyncEntityMerge) !== hash(actualSyncEntityMerge) || !fs.existsSync(expectedSyncKv) || hash(expectedSyncKv) !== hash(actualSyncKv) || !fs.existsSync(expectedRuntime) || hash(expectedRuntime) !== hash(actualRuntime) || !fs.existsSync(expectedMainLifecycle) || hash(expectedMainLifecycle) !== hash(actualMainLifecycle) || !fs.existsSync(expectedMain) || hash(expectedMain) !== hash(actualMain) || !fs.existsSync(expectedMainExplanation) || hash(expectedMainExplanation) !== hash(actualMainExplanation) || !fs.existsSync(expectedMainPracticePolicy) || hash(expectedMainPracticePolicy) !== hash(actualMainPracticePolicy) || !fs.existsSync(expectedMainPracticeState) || hash(expectedMainPracticeState) !== hash(actualMainPracticeState) || !fs.existsSync(expectedMainLegacyStats) || hash(expectedMainLegacyStats) !== hash(actualMainLegacyStats)) {
    console.error('[build:check] generated output differs; run npm run build');
    process.exitCode = 1;
  } else {
    console.log('[build:check] generated output matches source');
  }
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
