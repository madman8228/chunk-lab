'use strict';
const path=require('node:path');
const {qualifyPackage,stagePackage}=require('./lib/system-wordbook-package.cjs');
async function main(){
 const args=process.argv.slice(2),value=name=>{const i=args.indexOf(name);if(i<0||!args[i+1])throw Error('缺少 '+name);return args[i+1];};
 if(args.includes('--qualify')){console.log(JSON.stringify(qualifyPackage(value('--source'),value('--out')),null,2));return;}
 require('../server/loadenv');
 const appRoot=process.env.CHUNKLAB_APP_ROOT||path.resolve(__dirname,'..'),dataRoot=process.env.CHUNKLAB_DATA_DIR||path.join(appRoot,'server/data');
 const publishedRoot=path.join(dataRoot,'wordbook-publications'),importsRoot=path.join(dataRoot,'system-wordbook-imports');
 const versions=require('../server/services/public-wordbook-versions').createPublicWordbookVersions({publishedRoot});
 const content=require('../server/services/vocabulary-content').createVocabularyContent({appRoot,publishedRoot,versions});
 const images=require('../server/middleware/vocabulary-image-delivery').configuredVocabularyImageDelivery(appRoot,process.env,{publishedRoot});
 const publisher=require('../server/services/wordbook-publisher').createWordbookPublisher({appRoot,content,versions,checkImageAliases:images.checkAliases});
 const service=require('../server/services/admin-wordbook-imports').createAdminWordbookImports({appRoot,dataDirectory:importsRoot,publisher,checkAliases:images.checkAliases});
 let productionBook,audioConfirmation;
 if(args.includes('--production-reviews')){
  const {loadProduction}=require('./lib/textbook-production.cjs'),{configuration}=require('./serve-textbook-production.cjs');
  productionBook=loadProduction(configuration({appRoot,dataRoot})).books.find(book=>book.id===value('--book'));
  if(!productionBook)throw Error('当前生产目录没有此教材');
  if(args.includes('--audio-confirmation'))audioConfirmation=value('--audio-confirmation');
 }
 console.log(JSON.stringify(await stagePackage({directory:value('--source'),bookId:value('--book'),service,importsRoot,productionBook,audioConfirmation}),null,2));
}
if(require.main===module)main().catch(e=>{console.error(e.stack||e.message);process.exitCode=1;});
