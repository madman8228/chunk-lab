'use strict';
const fs=require('node:fs'),path=require('node:path');
const model=require('../../scripts/lib/vocabulary-illustrations.cjs');
function createVocabularyImageDelivery({root,catalog,publishedRoot,baseUrl=''}){
 catalog=catalog||{format:'vocabulary-illustration-catalog',schemaVersion:1,assets:[],aliases:{},bindings:[]};model.validateCatalog(catalog);
 if(baseUrl){const url=new URL(baseUrl);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw Error('Vocabulary image base must be a stable HTTPS URL without credentials/query/fragment');baseUrl=url.href.replace(/\/$/,'');}
 const baseAssets=new Map(catalog.assets.map(a=>[a.sha256,a]));
 function merged(){
  const assets=new Map(baseAssets),aliases={...catalog.aliases};if(!publishedRoot||!fs.existsSync(publishedRoot))return {assets,aliases};
  const folders=fs.readdirSync(publishedRoot,{withFileTypes:true}).filter(entry=>entry.isDirectory()&&/^[a-f0-9]{64}$/.test(entry.name)).sort((a,b)=>a.name.localeCompare(b.name));
  function addReceipt(receipt){if(!fs.existsSync(receipt))return;const publication=JSON.parse(fs.readFileSync(receipt,'utf8'));
   for(const asset of publication.assets||[]){if(asset.kind!=='illustration'||!asset.sha256||!asset.url)continue;
    const prior=aliases[asset.url];if(prior&&prior!=='sha256:'+asset.sha256)throw Error('Published image alias conflicts with an existing catalog: '+asset.url);
    aliases[asset.url]='sha256:'+asset.sha256;if(!assets.has(asset.sha256))assets.set(asset.sha256,{assetId:'sha256:'+asset.sha256,path:asset.url,sha256:asset.sha256,bytes:asset.bytes,width:asset.width,height:asset.height,objectKey:'vocabulary/'+asset.sha256+'.webp',local:true});
   }
  }
  for(const folder of folders){const courseDir=path.join(publishedRoot,folder.name);addReceipt(path.join(courseDir,'publication.json'));
   const releases=path.join(courseDir,'releases');if(fs.existsSync(releases))for(const release of fs.readdirSync(releases,{withFileTypes:true}).filter(entry=>entry.isDirectory()&&/^[a-f0-9]{64}$/.test(entry.name)))addReceipt(path.join(releases,release.name,'publication.json'));
  }
  return {assets,aliases};
 }
 function checkAliases(rows){const current=merged();for(const row of rows){const prior=current.aliases[row.url];if(prior&&prior!=='sha256:'+row.sha256)throw Error('同名图片素材已存在且内容不同：'+row.url);}}
 const delivery=(req,res,next)=>{
  if(!['GET','HEAD'].includes(req.method))return next();
  const url=new URL(req.url,'http://localhost'),key=url.pathname.slice(1),match=/^\/_vocab-images\/([a-f0-9]{64})\.webp$/.exec(url.pathname);if(!match&&!key.startsWith('assets/'))return next();if(!match&&!Object.hasOwn(catalog.aliases,key)&&!publishedRoot)return next();
  let current;try{current=merged();}catch{res.writeHead(503,{'Cache-Control':'no-store'});return res.end('Verified illustration catalog unavailable');}
  const alias=Object.hasOwn(current.aliases,key)?current.aliases[key]:undefined;
  if(alias){res.writeHead(302,{'Location':'/_vocab-images/'+alias.slice(7)+'.webp','Cache-Control':'no-cache'});return res.end();}
  if(!match)return next();
  const a=current.assets.get(match[1]);if(!a){res.writeHead(404);return res.end();}
  if(baseUrl&&!a.local){res.writeHead(302,{'Location':baseUrl+'/'+a.objectKey,'Cache-Control':'public, max-age=3600'});return res.end();}
  try{
   const actual=model.inspect(root,a.path);if(actual.assetId!==a.assetId||actual.bytes!==a.bytes)throw Error('Hash mismatch');
   const etag='"'+a.sha256+'"',headers={'Content-Type':'image/webp','Cache-Control':'public, max-age=31536000, immutable','ETag':etag,'X-Content-Type-Options':'nosniff'};
   if(req.headers['if-none-match']===etag){res.writeHead(304,headers);return res.end();}
   res.writeHead(200,{...headers,'Content-Length':a.bytes});res.end(req.method==='HEAD'?undefined:fs.readFileSync(path.join(root,a.path)));
  }catch{res.writeHead(503,{'Cache-Control':'no-store'});res.end('Verified illustration unavailable');}
 };
 delivery.resolveImage=reference=>{const key=typeof reference==='string'?reference.replace(/^\//,''):'';const current=merged(),id=current.aliases[key];if(!id)return reference;const asset=current.assets.get(id.slice(7));return baseUrl&&!asset.local?baseUrl+'/'+asset.objectKey:'/_vocab-images/'+asset.sha256+'.webp';};
 delivery.checkAliases=checkAliases;
 return delivery;
}
function configuredVocabularyImageDelivery(root,env=process.env,options={}){
 const file=env.VOCAB_IMAGE_CATALOG;if(!file&&!options.publishedRoot){if(env.VOCAB_IMAGE_BASE_URL)throw Error('VOCAB_IMAGE_BASE_URL requires VOCAB_IMAGE_CATALOG');return (req,res,next)=>next();}
 const catalog=file?JSON.parse(fs.readFileSync(path.resolve(file),'utf8')):undefined;
 return createVocabularyImageDelivery({root,catalog,baseUrl:env.VOCAB_IMAGE_BASE_URL||'',...options});
}
module.exports={createVocabularyImageDelivery,configuredVocabularyImageDelivery};
