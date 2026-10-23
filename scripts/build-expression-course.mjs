import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
export async function buildExpressionCourse(browserDir = path.join(root, 'js'), serverDir = path.join(root, 'server/services/expression-course')) {
  const fs = await import('node:fs');
  fs.mkdirSync(browserDir, { recursive: true });
  fs.mkdirSync(serverDir, { recursive: true });
  await esbuild.build({ entryPoints: [path.join(root, 'scripts/expression-course-runtime-entry.mjs')],
    outfile: path.join(browserDir, 'expression-course-runtime.js'), bundle: true, format: 'iife', platform: 'browser', globalName: 'ExpressionCourseRuntime', legalComments: 'none' });
  await esbuild.build({ entryPoints: [path.join(root, 'src/expression-course/ui/entry.mjs')],
    outfile: path.join(browserDir, 'expression-course-player.js'), bundle: true, format: 'esm', platform: 'browser', legalComments: 'none' });
  await esbuild.build({ entryPoints: [path.join(root, 'src/expression-course/authoring/view.mjs')],
    outfile: path.join(browserDir, 'expression-course-authoring.js'), bundle: true, format: 'esm', platform: 'browser', legalComments: 'none' });
  await esbuild.build({ entryPoints: [path.join(root, 'scripts/expression-course-runtime-entry.mjs')],
    outfile: path.join(serverDir, 'runtime.cjs'), bundle: true, format: 'cjs', platform: 'node', legalComments: 'none' });
  await esbuild.build({ entryPoints: [path.join(root, 'scripts/expression-course-validator-entry.mjs')],
    outfile: path.join(serverDir, 'validate.cjs'), bundle: true, format: 'cjs', platform: 'node', legalComments: 'none' });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await buildExpressionCourse();
  console.log('[expression-course] browser runtime, server runtime and validator generated');
}
