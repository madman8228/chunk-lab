'use strict';

const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), crypto = require('node:crypto');
const { loadProduction, publicStatus, prepareAudioPlan } = require('./lib/textbook-production.cjs');
const appRoot = path.resolve(__dirname, '..');
function configuration(overrides = {}) {
  return { appRoot, sourceRoot: 'E:/chunk-practice-asset-sources/textbooks', packageRoot: 'E:/chunk-practice-assets/textbooks',
    dataRoot: path.join(appRoot,'server/data'), catalogFile: path.join(appRoot,'output/vocabulary-illustrations/catalog-20261022-reviewed-v1.json'),
    reviewFile: path.join(appRoot,'output/textbook-sentence-review/review-decisions.json'), ...overrides };
}
function createProductionServer(options) {
  let snapshot;
  return http.createServer((request,response) => {
    const url = new URL(request.url,'http://127.0.0.1');
    if (!['GET','HEAD'].includes(request.method)) { response.writeHead(405,{Allow:'GET, HEAD'});return response.end(); }
    try {
      let body, type = 'application/json; charset=utf-8';
      if (url.pathname === '/') {
        body = fs.readFileSync(path.join(__dirname,'textbook-production.html')); type = 'text/html; charset=utf-8';
      } else {
        if (!snapshot || url.pathname === '/api/status' && url.searchParams.get('refresh') === '1') snapshot = loadProduction(options);
        if (url.pathname === '/api/status') body = Buffer.from(JSON.stringify(publicStatus(snapshot)));
        else if (url.pathname === '/api/items') {
          const book = snapshot.books.find(b => b.id === url.searchParams.get('bookId'));
          if (!book) throw Object.assign(Error('教材不存在'),{status:404});
          body = Buffer.from(JSON.stringify({ title:book.label, items:book.items }));
        } else {
          const match = url.pathname.match(/^\/audio\/([a-f0-9]{64})\.ogg$/), asset = match && snapshot.audioFiles.get(match[1]);
          if (!asset) throw Object.assign(Error('资源不存在'),{status:404});
          body = fs.readFileSync(asset.file);
          if (body.length !== asset.bytes || crypto.createHash('sha256').update(body).digest('hex') !== match[1]) throw Error('音频核验失败');
          type = 'audio/ogg';
        }
      }
      response.writeHead(200,{'Content-Type':type,'Content-Length':body.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
        'Content-Security-Policy':"default-src 'self'; media-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"});
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch (error) { response.writeHead(error.status||500,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});response.end(JSON.stringify({error:error.message})); }
  });
}
if (require.main === module) {
  const args=process.argv.slice(2), option=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1];};
  const config=configuration({sourceRoot:option('--sources','E:/chunk-practice-asset-sources/textbooks'),packageRoot:option('--packages','E:/chunk-practice-assets/textbooks'),dataRoot:option('--data',path.join(appRoot,'server/data'))});
  if (args.includes('--snapshot') || args.includes('--prepare-audio')) {
    const snapshot=loadProduction(config),out=path.resolve(option('--out','output/textbook-production-status/'+Date.now()));
    if(args.includes('--prepare-audio')) console.log(JSON.stringify(prepareAudioPlan(snapshot,out),null,2));
    else {if(fs.existsSync(out))throw Error('请选择新的快照目录');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'status.json'),JSON.stringify(publicStatus(snapshot),null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({out,totals:snapshot.totals,errors:snapshot.errors.length},null,2));}
  } else {
    const port=Number(option('--port',4211));
    createProductionServer(config).listen(port,'127.0.0.1',()=>console.log('教材生产工作台：http://127.0.0.1:'+port+'/'));
  }
}
module.exports={configuration,createProductionServer};
