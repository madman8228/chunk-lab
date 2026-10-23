'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {imageDimensions}=require('./membership/image-dimensions');
const {validateDictationAssets}=require('./vocabulary-dictation-assets');
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const fail=(message,status=422)=>Object.assign(new Error(message),{status});
function assetReferences(candidate){
 const refs=new Map(),add=(url,kind,expected)=>{
  if(typeof url!=='string'||!/^assets\/[A-Za-z0-9._-]+\.(?:webp|png|jpe?g|mp3|ogg|wav)$/i.test(url))throw fail('课程素材路径无效：'+String(url));
  const old=refs.get(url);if(old&&old.kind!==kind)throw fail('同一文件被用作不同素材类型：'+url);
  refs.set(url,{url,kind,expected:expected||old?.expected||null});
 };
 const book=candidate?.index?.books?.[0];if(book?.catalog?.coverUrl)add(book.catalog.coverUrl,'cover');
 for(const item of candidate?.items||[]){
  for(const url of item.images?.wide||[])add(url,'illustration');for(const url of item.images?.mobile||[])add(url,'illustration');
  for(const activity of [item.learning?.wordDictation,item.learning?.sentenceAudio,item.learning?.readAloud].filter(Boolean))add(activity.audio?.url,'audio',activity.audio);
 }
 return [...refs.values()].sort((a,b)=>a.url.localeCompare(b.url));
}
function inspectBytes(ref,bytes){
 if(!Buffer.isBuffer(bytes)||!bytes.length)throw fail('素材文件为空：'+ref.url);
 const sha256=digest(bytes),ext=path.extname(ref.url).toLowerCase();
 if(ref.expected&&(ref.expected.bytes!==bytes.length||ref.expected.sha256!==sha256))throw fail('音频与课程声明的摘要不一致：'+ref.url);
 if(ref.kind==='illustration'){
  const size=imageDimensions(bytes,'image/webp');
  if(ext!=='.webp'||bytes.length>=20000||bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WEBP'||!size||size[0]*9!==size[1]*16)throw fail('词汇插画须为真实 16:9 WebP 且小于 20000 bytes：'+ref.url);
  return {url:ref.url,kind:ref.kind,bytes:bytes.length,sha256,width:size[0],height:size[1],assetId:'sha256:'+sha256,objectKey:'vocabulary/'+sha256+'.webp'};
 }
 if(ref.kind==='audio'){
  if(bytes.length>10000000)throw fail('单个课程音频不能超过 10000000 bytes：'+ref.url);
  const mime=ref.expected?.mimeType,valid=mime==='audio/wav'?ext==='.wav'&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WAVE':mime==='audio/ogg'?ext==='.ogg'&&bytes.toString('ascii',0,4)==='OggS':mime==='audio/mpeg'&&ext==='.mp3'&&(bytes.toString('ascii',0,3)==='ID3'||bytes[0]===255&&(bytes[1]&224)===224);
  if(!valid)throw fail('课程音频格式或扩展名不匹配：'+ref.url);
  return {url:ref.url,kind:ref.kind,bytes:bytes.length,sha256,mimeType:mime};
 }
 if(ext==='.svg'||bytes.length>2000000)throw fail('课程封面只接受不超过 2000000 bytes 的 PNG、JPEG 或 WebP：'+ref.url);
 const signature=ext==='.png'?bytes.toString('hex',0,8)==='89504e470d0a1a0a':ext==='.jpg'||ext==='.jpeg'?bytes[0]===255&&bytes[1]===216&&bytes.at(-2)===255&&bytes.at(-1)===217:ext==='.webp'?bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP':false;
 if(!signature)throw fail('课程封面图片格式无效：'+ref.url);
 return {url:ref.url,kind:ref.kind,bytes:bytes.length,sha256};
}
function readInstalled(appRoot,relative){
 const assets=path.resolve(appRoot,'assets'),target=path.resolve(appRoot,relative),rel=path.relative(assets,target);
 if(!rel||rel.startsWith('..')||path.isAbsolute(rel))throw fail('课程素材不能越出 assets 目录');
 let current=assets;for(const part of rel.split(path.sep)){current=path.join(current,part);const stat=fs.lstatSync(current);if(stat.isSymbolicLink())throw fail('课程素材不能是符号链接：'+relative);}
 return fs.readFileSync(target);
}
function validatePackage(candidate,{appRoot,readPrivate,allowMissing=false,checkAlias}={}){
 const assets=[],buffers=new Map();let totalBytes=0;
 const readAsset=url=>{if(buffers.has(url))return buffers.get(url);let bytes=null;try{bytes=readPrivate?.(url)||null;}catch(error){if(error.code!=='ENOENT')throw error;}if(!bytes){try{bytes=readInstalled(appRoot,url);}catch(error){if(error.code!=='ENOENT')throw error;}}buffers.set(url,bytes);return bytes;};
 for(const ref of assetReferences(candidate)){
  const bytes=readAsset(ref.url);
  if(!bytes){if(!allowMissing)throw fail('缺少课程素材：'+ref.url,409);assets.push({url:ref.url,kind:ref.kind,missing:true});continue;}
  const record=inspectBytes(ref,bytes);assets.push(record);totalBytes+=record.bytes;
 }
 if(totalBytes>250000000)throw fail('课程交付素材不能超过 250000000 bytes');
 const itemById=new Map((candidate.items||[]).map(item=>[item.itemId,item]));
 const missing=new Set(assets.filter(a=>a.missing).map(a=>a.url));
 for(const item of itemById.values()){
  const audioUrls=[item.learning?.wordDictation,item.learning?.sentenceAudio,item.learning?.readAloud].filter(Boolean).map(a=>a.audio?.url);
  if(!audioUrls.some(url=>missing.has(url)))validateDictationAssets(item,appRoot,readAsset);
 }
 const pictures=assets.filter(a=>a.kind==='illustration');if(checkAlias)checkAlias(pictures);
 return {assets,missing:assets.filter(a=>a.missing).map(a=>a.url),fingerprint:digest(Buffer.from(JSON.stringify(assets)))};
}
module.exports={assetReferences,inspectBytes,validatePackage,readInstalled,digest};
