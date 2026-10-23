'use strict';

const path=require('node:path');
const {createReuseReviewServer}=require('./lib/vocabulary-reuse-review.cjs');

const args=process.argv.slice(2),value=name=>{const index=args.indexOf(name);return index<0?undefined:args[index+1];};
const root=path.resolve(value('--root')||path.resolve(__dirname,'..'));
const catalogPath=path.resolve(value('--catalog')||path.join(root,'output/vocabulary-illustrations/catalog-20261022-grade9-v20-v2.json'));
const statePath=path.resolve(value('--state')||path.join(root,'output/vocabulary-illustrations/reuse-reviews/decisions.json'));
const port=Number(value('--port')||process.env.VOCABULARY_REUSE_REVIEW_PORT||4202);
const server=createReuseReviewServer({root,catalogPath,statePath});
server.listen(port,'127.0.0.1',()=>console.log(JSON.stringify({url:`http://127.0.0.1:${port}/`,...server.reviewInfo})));
