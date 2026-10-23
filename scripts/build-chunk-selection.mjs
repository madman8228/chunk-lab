import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
export async function buildChunkSelection(outDir = path.join(root, 'js')) {
  await esbuild.build({ entryPoints: [path.join(root, 'src/shared/chunk-selection.mjs')],
    outfile: path.join(outDir, 'chunk-selection.js'), bundle: true, format: 'iife', platform: 'browser',
    globalName: 'ChunkSelection', legalComments: 'none' });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await buildChunkSelection();
  console.log('[chunk-selection] browser bundle generated');
}
