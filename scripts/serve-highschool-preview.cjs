'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),directory=path.resolve(root,'output/highschool-internal-preview-QLWtEz');
const assets=path.join(root,'assets');
const server=http.createServer((req,res)=>{
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
 let url;try{url=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);return res.end();}
 const asset=url.startsWith('/assets/'),base=asset?assets:directory;
 const file=path.resolve(base,asset?url.slice(8):url==='/'?'index.html':url.slice(1));
 const relative=path.relative(base,file);
 if(relative.startsWith('..')||path.isAbsolute(relative)||!(/\.(html|json|webp|png)$/.test(file))){res.writeHead(403);return res.end();}
 try{const real=fs.realpathSync(file),rel=path.relative(fs.realpathSync(base),real);if(rel.startsWith('..')||path.isAbsolute(rel))throw Error();
 const data=fs.readFileSync(real);res.writeHead(200,{'Content-Type':file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.json')?'application/json; charset=utf-8':file.endsWith('.webp')?'image/webp':'image/png','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:data);
 }catch{res.writeHead(404);res.end('Not found');}
});
server.listen(Number(process.env.PREVIEW_PORT||8791),'127.0.0.1',()=>console.log('Read-only preview: http://127.0.0.1:'+server.address().port+'/'));
