import esbuild from 'esbuild';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
export async function buildVocabularyStudy(outDir=path.join(root,'js')) {
  const options={entryPoints:[path.join(root,'scripts/vocabulary-study-entry.mjs')],bundle:true,minify:false,legalComments:/** @type {const} */ ('none')};
  await esbuild.build({...options,outfile:path.join(outDir,'vocabulary-study.js'),format:'iife',platform:'browser',globalName:'VocabularyStudy'});
  await esbuild.build({...options,outfile:path.join(outDir,'vocabulary-study.cjs'),format:'cjs',platform:'node'});
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await buildVocabularyStudy();
