import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';
import fs from 'node:fs';
import { DRAFT_SPEC } from '../src/course-authoring/draft-spec.mjs';
import { CourseCapabilityCatalog } from '../src/course-authoring/capabilities.mjs';
import { IMAGE_TEXT_DRAFT_SPEC } from '../src/course-authoring/image-text-draft-spec.mjs';
import { COURSE_TYPES } from '../src/course-authoring/course-types.mjs';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

await esbuild.build({
  entryPoints: [path.join(root, 'scripts', 'mistake-evidence-entry.mjs')],
  outfile: path.join(root, 'js', 'mistake-evidence.js'),
  bundle: true, format: 'iife', platform: 'browser', minify: false, legalComments: 'none',
});
await esbuild.build({
  entryPoints: [path.join(root, 'scripts', 'mistake-evidence-entry.mjs')],
  outfile: path.join(root, 'js', 'mistake-evidence.cjs'),
  bundle: true, format: 'cjs', platform: 'node', minify: false, legalComments: 'none',
});
console.log('[build] mistake evidence module generated for browser and server');

const result = spawnSync(process.execPath, ['scripts/build-course-schema-validator.js'], { stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status || 1);
console.log('[build] deterministic browser validator generated');

await esbuild.build({
  entryPoints: [path.join(root, 'scripts', 'core-identity-entry.mjs')],
  outfile: path.join(root, 'js', 'core-identity.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  minify: false,
  legalComments: 'none',
});
console.log('[build] core identity module generated');

await esbuild.build({
  entryPoints: [path.join(root, 'scripts', 'core-merge-entry.mjs')],
  outfile: path.join(root, 'js', 'core-merge.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  minify: false,
  legalComments: 'none',
});
console.log('[build] core merge module generated');

await esbuild.build({
  entryPoints: [path.join(root, 'scripts', 'core-activity-entry.mjs')],
  outfile: path.join(root, 'js', 'core-activity.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  minify: false,
  legalComments: 'none',
});
console.log('[build] core activity module generated');

await esbuild.build({
  entryPoints: [path.join(root, 'scripts', 'core-event-bus-entry.mjs')],
  outfile: path.join(root, 'js', 'core-event-bus.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  minify: false,
  legalComments: 'none',
});
console.log('[build] core event bus module generated');

await esbuild.build({
  entryPoints: [path.join(root, 'scripts', 'core-migrations-entry.mjs')],
  outfile: path.join(root, 'js', 'core-migrations.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  minify: false,
  legalComments: 'none',
});
console.log('[build] core migrations module generated');

await esbuild.build({
  entryPoints: [path.join(root, 'scripts', 'core-stats-signature-entry.mjs')],
  outfile: path.join(root, 'js', 'core-stats-signature.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  minify: false,
  legalComments: 'none',
});
console.log('[build] core stats signature module generated');

await esbuild.build({
  entryPoints: [path.join(root, 'scripts', 'core-storage-state-entry.mjs')],
  outfile: path.join(root, 'js', 'core-storage-state.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  minify: false,
  legalComments: 'none',
});
console.log('[build] core storage state module generated');

await esbuild.build({
  entryPoints: [path.join(root, 'scripts', 'core-entity-delta-entry.mjs')],
  outfile: path.join(root, 'js', 'core-entity-delta.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  minify: false,
  legalComments: 'none',
});
console.log('[build] core entity delta module generated');

await esbuild.build({
  entryPoints: [path.join(root, 'scripts', 'core-sync-delta-entry.mjs')],
  outfile: path.join(root, 'js', 'core-sync-delta.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  minify: false,
  legalComments: 'none',
});
console.log('[build] core sync delta module generated');

await esbuild.build({
  entryPoints: [path.join(root, 'scripts', 'core-sync-intents-entry.mjs')],
  outfile: path.join(root, 'js', 'core-sync-intents.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  minify: false,
  legalComments: 'none',
});
console.log('[build] core sync intents module generated');

await esbuild.build({
  entryPoints: [path.join(root, 'scripts', 'core-sync-payload-entry.mjs')],
  outfile: path.join(root, 'js', 'core-sync-payload.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  minify: false,
  legalComments: 'none',
});
console.log('[build] core sync payload module generated');

await esbuild.build({
  entryPoints: [path.join(root, 'scripts', 'core-sync-transport-entry.mjs')],
  outfile: path.join(root, 'js', 'core-sync-transport.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  minify: false,
  legalComments: 'none',
});
console.log('[build] core sync transport module generated');

await esbuild.build({
  entryPoints: [path.join(root, 'scripts', 'core-sync-replay-entry.mjs')],
  outfile: path.join(root, 'js', 'core-sync-replay.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  minify: false,
  legalComments: 'none',
});
console.log('[build] core sync replay module generated');

await esbuild.build({
  entryPoints: [path.join(root, 'scripts', 'core-sync-batch-merge-entry.mjs')],
  outfile: path.join(root, 'js', 'core-sync-batch-merge.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  minify: false,
  legalComments: 'none',
});
console.log('[build] core sync batch merge module generated');

await esbuild.build({
  entryPoints: [path.join(root, 'scripts', 'core-sync-stats-normalize-entry.mjs')],
  outfile: path.join(root, 'js', 'core-sync-stats-normalize.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  minify: false,
  legalComments: 'none',
});
console.log('[build] core sync stats normalize module generated');

await esbuild.build({
  entryPoints: [path.join(root, 'scripts', 'core-sync-learning-marks-entry.mjs')],
  outfile: path.join(root, 'js', 'core-sync-learning-marks.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  minify: false,
  legalComments: 'none',
});
console.log('[build] core sync learning marks module generated');

await esbuild.build({
  entryPoints: [path.join(root, 'scripts', 'core-sync-entity-merge-entry.mjs')],
  outfile: path.join(root, 'js', 'core-sync-entity-merge.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  minify: false,
  legalComments: 'none',
});
console.log('[build] core sync entity merge module generated');

await esbuild.build({
  entryPoints: [path.join(root, 'scripts', 'core-sync-kv-entry.mjs')],
  outfile: path.join(root, 'js', 'core-sync-kv.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  minify: false,
  legalComments: 'none',
});
console.log('[build] core sync kv module generated');

await esbuild.build({
  entryPoints: [path.join(root, 'scripts', 'core-revision-delta-entry.mjs')],
  outfile: path.join(root, 'js', 'core-revision-delta.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  globalName: 'CoreRevisionDelta',
  minify: false,
  legalComments: 'none',
});
console.log('[build] core revision delta module generated');

await esbuild.build({
  entryPoints: [path.join(root, 'scripts', 'core-runtime-entry.mjs')],
  outfile: path.join(root, 'js', 'core-runtime.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  minify: false,
  legalComments: 'none',
});
console.log('[build] core runtime module generated');

await esbuild.build({
  entryPoints: [path.join(root, 'scripts', 'main-lifecycle-entry.mjs')],
  outfile: path.join(root, 'js', 'main-lifecycle.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  globalName: 'MainLifecycle',
  minify: false,
  legalComments: 'none',
});
console.log('[build] main lifecycle module generated');

await esbuild.build({
  entryPoints: [path.join(root, 'scripts', 'main-lifecycle-entry.mjs')],
  outfile: path.join(root, 'js', 'main.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  globalName: 'MainLifecycle',
  minify: false,
  legalComments: 'none',
});
console.log('[build] main entry module generated');

await esbuild.build({
  entryPoints: [path.join(root, 'scripts', 'main-explanation-entry.mjs')],
  outfile: path.join(root, 'js', 'main-explanation.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  globalName: 'MainExplanation',
  minify: false,
  legalComments: 'none',
});
console.log('[build] main explanation module generated');

await esbuild.build({
  entryPoints: [path.join(root, 'scripts', 'main-practice-policy-entry.mjs')],
  outfile: path.join(root, 'js', 'main-practice-policy.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  globalName: 'MainPracticePolicy',
  minify: false,
  legalComments: 'none',
});
console.log('[build] main practice policy module generated');

await esbuild.build({
  entryPoints: [path.join(root, 'scripts', 'main-practice-classification-entry.mjs')],
  outfile: path.join(root, 'js', 'main-practice-classification.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  globalName: 'MainPracticeClassification',
  minify: false,
  legalComments: 'none',
});
console.log('[build] main practice classification module generated');

await esbuild.build({
  entryPoints: [path.join(root, 'scripts', 'main-course-navigation-entry.mjs')],
  outfile: path.join(root, 'js', 'main-course-navigation.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  globalName: 'MainCourseNavigation',
  minify: false,
  legalComments: 'none',
});
console.log('[build] main course navigation module generated');

await esbuild.build({
  entryPoints: [path.join(root, 'scripts', 'main-deck-progress-entry.mjs')],
  outfile: path.join(root, 'js', 'main-deck-progress.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  globalName: 'MainDeckProgress',
  minify: false,
  legalComments: 'none',
});
console.log('[build] main deck progress module generated');

await esbuild.build({
  entryPoints: [path.join(root, 'scripts', 'main-home-summary-entry.mjs')],
  outfile: path.join(root, 'js', 'main-home-summary.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  globalName: 'MainHomeSummary',
  minify: false,
  legalComments: 'none',
});
console.log('[build] main home summary module generated');

await esbuild.build({
  entryPoints: [path.join(root, 'scripts', 'main-practice-state-entry.mjs')],
  outfile: path.join(root, 'js', 'main-practice-state.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  globalName: 'MainPracticeState',
  minify: false,
  legalComments: 'none',
});
console.log('[build] main practice state module generated');

await esbuild.build({
  entryPoints: [path.join(root, 'scripts', 'main-practice-markup-entry.mjs')],
  outfile: path.join(root, 'js', 'main-practice-markup.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  globalName: 'MainPracticeMarkup',
  minify: false,
  legalComments: 'none',
});
console.log('[build] main practice markup module generated');

await esbuild.build({ entryPoints: [path.join(root, 'scripts', 'main-course-learning-policy-entry.mjs')], outfile: path.join(root, 'js', 'main-course-learning-policy.js'), bundle: true, format: 'iife', platform: 'browser', minify: false, legalComments: 'none' });
console.log('[build] main course learning policy generated');

await esbuild.build({ entryPoints: [path.join(root, 'scripts', 'learning-engine-entry.mjs')], outfile: path.join(root, 'js', 'learning-engine.js'), bundle: true, format: 'iife', platform: 'browser', globalName: 'LearningEngine', minify: false, legalComments: 'none' });
await esbuild.build({ entryPoints: [path.join(root, 'scripts', 'learning-engine-entry.mjs')], outfile: path.join(root, 'js', 'learning-engine.cjs'), bundle: true, format: 'cjs', platform: 'node', minify: false, legalComments: 'none', banner: { js: '// @ts-nocheck Generated CommonJS bundle; source modules are checked directly.' } });
console.log('[build] learning state and assessment engine generated');

await esbuild.build({
  entryPoints: [path.join(root, 'scripts', 'main-legacy-stats-entry.mjs')],
  outfile: path.join(root, 'js', 'main-legacy-stats.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  globalName: 'MainLegacyStats',
  minify: false,
  legalComments: 'none',
});
console.log('[build] main legacy stats module generated');

await Promise.all([
  esbuild.build({ entryPoints: [path.join(root, 'scripts', 'course-authoring-entry.mjs')], outfile: path.join(root, 'js', 'course-authoring.js'), bundle: true, format: 'iife', platform: 'browser', globalName: 'ChunkCourseAuthoring', minify: false, legalComments: 'none' }),
  esbuild.build({ entryPoints: [path.join(root, 'scripts', 'course-capabilities-entry.mjs')], outfile: path.join(root, 'js', 'course-capabilities.js'), bundle: true, format: 'iife', platform: 'browser', globalName: 'ChunkCourseCapabilitiesBundle', minify: false, legalComments: 'none' }),
  esbuild.build({ entryPoints: [path.join(root, 'scripts', 'course-learning-launch-entry.mjs')], outfile: path.join(root, 'js', 'course-learning-launch.js'), bundle: true, format: 'iife', platform: 'browser', globalName: 'ChunkCourseLearningLaunchBundle', minify: false, legalComments: 'none' }),
  esbuild.build({ entryPoints: [path.join(root, 'scripts', 'mistake-review-entry.mjs')], outfile: path.join(root, 'js', 'mistake-review.js'), bundle: true, format: 'iife', platform: 'browser', minify: false, legalComments: 'none' }),
]);
const kit = { kitVersion: '1.1', courseTypes: COURSE_TYPES,
  draftSchema: DRAFT_SPEC.schema, examples: DRAFT_SPEC.examples,
  imageTextDraftSchema: IMAGE_TEXT_DRAFT_SPEC.schema, imageTextExample: IMAGE_TEXT_DRAFT_SPEC.example,
  imageMediaLimits: IMAGE_TEXT_DRAFT_SPEC.mediaLimits,
  interactionRules: DRAFT_SPEC.interactionRules, capabilities: CourseCapabilityCatalog.describeCreationOptions() };
fs.writeFileSync(path.join(root, 'ai-course-kit.json'), JSON.stringify(kit, null, 2) + '\n', 'utf8');
console.log('[build] AI course authoring bundles and public kit generated');
