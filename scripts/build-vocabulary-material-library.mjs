import esbuild from 'esbuild';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
export async function buildVocabularyMaterialLibrary(outDir=path.join(root,'js')){
 await esbuild.build({entryPoints:[path.join(root,'src/vocabulary-material-library/browser.mjs')],outfile:path.join(outDir,'vocabulary-material-library.js'),bundle:true,platform:'browser',format:'iife',legalComments:'none'});
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await buildVocabularyMaterialLibrary();
