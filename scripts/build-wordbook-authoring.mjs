import esbuild from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
export async function buildWordbookAuthoring(outDir = path.join(root, 'js')) {
  await esbuild.build({ entryPoints: [path.join(root, 'src/wordbook-authoring/entry.mjs')], outfile: path.join(outDir, 'wordbook-authoring.js'), bundle: true, format: 'iife', platform: 'browser', minify: false, legalComments: 'none' });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await buildWordbookAuthoring();
