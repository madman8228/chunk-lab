import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
await Promise.all([
  esbuild.build({ entryPoints: [path.join(root, 'scripts', 'course-authoring-entry.mjs')], outfile: path.join(root, 'js', 'course-authoring.js'), bundle: true, format: 'iife', platform: 'browser', globalName: 'ChunkCourseAuthoring', minify: false, legalComments: 'none' }),
  esbuild.build({ entryPoints: [path.join(root, 'scripts', 'course-capabilities-entry.mjs')], outfile: path.join(root, 'js', 'course-capabilities.js'), bundle: true, format: 'iife', platform: 'browser', globalName: 'ChunkCourseCapabilitiesBundle', minify: false, legalComments: 'none' }),
  esbuild.build({ entryPoints: [path.join(root, 'scripts', 'course-learning-launch-entry.mjs')], outfile: path.join(root, 'js', 'course-learning-launch.js'), bundle: true, format: 'iife', platform: 'browser', globalName: 'ChunkCourseLearningLaunchBundle', minify: false, legalComments: 'none' }),
  esbuild.build({ entryPoints: [path.join(root, 'scripts', 'mistake-review-entry.mjs')], outfile: path.join(root, 'js', 'mistake-review.js'), bundle: true, format: 'iife', platform: 'browser', minify: false, legalComments: 'none' })
]);
console.log('[course-authoring] generated browser bundles');
