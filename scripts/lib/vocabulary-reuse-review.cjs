'use strict';

const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const crypto=require('node:crypto');
const illustrations=require('./vocabulary-illustrations.cjs');

const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const emptyState=()=>({format:'vocabulary-reuse-review-decisions',schemaVersion:1,revision:0,events:[]});
function readState(file){
 if(!fs.existsSync(file))return emptyState();
 const state=JSON.parse(fs.readFileSync(file,'utf8'));
 if(state.format!=='vocabulary-reuse-review-decisions'||state.schemaVersion!==1||!Number.isSafeInteger(state.revision)||!Array.isArray(state.events))throw Error('Unsupported or damaged reuse-review state');
 return state;
}
function writeState(file,state){
 fs.mkdirSync(path.dirname(file),{recursive:true});
 const temporary=file+'.'+process.pid+'.'+crypto.randomBytes(6).toString('hex')+'.tmp';
 try{fs.writeFileSync(temporary,JSON.stringify(state,null,2)+'\n',{flag:'wx'});fs.renameSync(temporary,file);}
 catch(error){try{fs.unlinkSync(temporary);}catch{}throw error;}
}
function makeGroups(catalog){
 illustrations.validateCatalog(catalog);
 const buckets=new Map();
 for(const binding of catalog.bindings){
  if(binding.review!=='pass')continue;
  const key=[illustrations.normalize(binding.word),illustrations.normalize(binding.meaning)].join('|');
  const rows=buckets.get(key)||[];rows.push(binding);buckets.set(key,rows);
 }
 const groups=[];
 for(const [key,bindings] of buckets){
  const assets=new Map();
  for(const binding of bindings){const rows=assets.get(binding.assetId)||[];rows.push(binding);assets.set(binding.assetId,rows);}
  if(assets.size<2)continue;
  const groupId=hash(Buffer.from(key));
  const entries=bindings.map(binding=>({sourceKey:binding.sourceKey,course:binding.course,unit:binding.unit,itemId:binding.itemId,word:binding.word,meaning:binding.meaning,assetId:binding.assetId,path:binding.path,review:binding.review})).sort((a,b)=>a.sourceKey.localeCompare(b.sourceKey));
  const candidates=[...assets.entries()].map(([assetId,rows])=>({assetId,path:rows[0].path,bindings:rows.map(row=>({sourceKey:row.sourceKey,course:row.course,unit:row.unit,itemId:row.itemId,word:row.word,meaning:row.meaning}))})).sort((a,b)=>a.assetId.localeCompare(b.assetId));
  const stages=[...new Set(bindings.map(binding=>binding.stage))].sort();
  const styleReferences=[...new Set(bindings.map(binding=>binding.styleReference))].sort();
  const fingerprint=hash(Buffer.from(JSON.stringify({groupId,stages,styleReferences,entries:entries.map(({sourceKey,assetId,path})=>({sourceKey,assetId,path}))})));
  groups.push({groupId,fingerprint,word:bindings[0].word,meaning:bindings[0].meaning,stages,styleReferences,crossStage:stages.length>1,crossStyle:styleReferences.length>1,entries,candidates});
 }
 return groups.sort((a,b)=>a.word.localeCompare(b.word,'en')||a.meaning.localeCompare(b.meaning,'zh-CN')||a.groupId.localeCompare(b.groupId));
}
function decisionFor(state,group,catalogSha256){
 const events=state.events.filter(event=>event.groupId===group.groupId);
 const current=[...events].reverse().find(event=>event.catalogSha256===catalogSha256&&event.groupFingerprint===group.fingerprint);
 return {status:current?.decision==='reuse'?'reuse':current?.decision==='keep-distinct'?'keep-distinct':'pending',assetId:current?.assetId||'',note:current?.note||'',revision:current?.revision||0,stale:events.length>0&&!current};
}
async function readBody(request,maxBytes=16000){
 let body='';for await(const chunk of request){body+=chunk;if(Buffer.byteLength(body,'utf8')>maxBytes)throw Object.assign(new Error('Request body too large'),{statusCode:413});}
 try{return JSON.parse(body);}catch{throw Object.assign(new Error('Invalid JSON'),{statusCode:400});}
}
function sendJson(response,status,value){response.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});response.end(JSON.stringify(value));}
function createReuseReviewServer({root,catalogPath,statePath,pagePath}={}){
 const realRoot=fs.realpathSync(root||path.resolve(__dirname,'../..'));
 const catalogFile=path.resolve(catalogPath||path.join(realRoot,'output/vocabulary-illustrations/catalog-20261022-grade9-v20-v2.json'));
 const catalogBytes=fs.readFileSync(catalogFile),catalog=illustrations.validateCatalog(JSON.parse(catalogBytes));
 const catalogSha256=hash(catalogBytes),groups=makeGroups(catalog),groupsById=new Map(groups.map(group=>[group.groupId,group]));
 const imagePaths=new Set(catalog.assets.map(asset=>asset.path));
 const decisionsFile=path.resolve(statePath||path.join(realRoot,'output/vocabulary-illustrations/reuse-reviews/decisions.json'));
 const htmlFile=pagePath||path.join(__dirname,'../vocabulary-reuse-review.html');
 async function saveDecision(request,response){
  try{
   const body=await readBody(request),group=groupsById.get(body?.groupId);
   if(!group)return sendJson(response,404,{error:'review-group-not-found'});
   if(!['reuse','keep-distinct','reset'].includes(body.decision))return sendJson(response,400,{error:'invalid-decision'});
   if(!Number.isSafeInteger(body.baseRevision)||body.baseRevision<0)return sendJson(response,400,{error:'invalid-review-revision'});
   if(body.note!==undefined&&typeof body.note!=='string')return sendJson(response,400,{error:'invalid-review-note'});
   const note=(body.note||'').trim();if(note.length>2000)return sendJson(response,400,{error:'review-note-too-long'});
   if(body.decision==='reuse'&&!group.candidates.some(candidate=>candidate.assetId===body.assetId))return sendJson(response,400,{error:'asset-not-in-review-group'});
   if(body.decision==='reuse'&&body.sceneReviewed!==true)return sendJson(response,400,{error:'target-scenes-not-reviewed'});
   const state=readState(decisionsFile),current=decisionFor(state,group,catalogSha256);
   if(body.baseRevision!==current.revision)return sendJson(response,409,{error:'review-group-changed',currentRevision:current.revision,status:current.status});
   const revision=state.revision+1,event={revision,createdAt:new Date().toISOString(),catalogSha256,groupId:group.groupId,groupFingerprint:group.fingerprint,word:group.word,meaning:group.meaning,stages:group.stages,styleReferences:group.styleReferences,entries:group.entries.map(({sourceKey,assetId,path})=>({sourceKey,assetId,path})),decision:body.decision,assetId:body.decision==='reuse'?body.assetId:'',sceneReviewed:body.decision==='reuse',note};
   const next={...state,revision,events:[...state.events,event]};writeState(decisionsFile,next);
   return sendJson(response,200,{...decisionFor(next,group,catalogSha256),revision});
  }catch(error){return sendJson(response,error.statusCode||500,{error:error.statusCode?error.message:'review-save-failed'});}
 }
 const server=http.createServer((request,response)=>{
  const url=new URL(request.url,'http://127.0.0.1');
  if(request.method==='POST'&&url.pathname==='/api/review'){saveDecision(request,response);return;}
  if(request.method!=='GET'&&request.method!=='HEAD'){response.writeHead(405,{Allow:'GET, HEAD, POST'});return response.end();}
  let relative;try{relative=decodeURIComponent(url.pathname);}catch{response.writeHead(400);return response.end();}
  if(relative==='/api/groups'){
   try{const state=readState(decisionsFile),summary=groups.map(group=>({groupId:group.groupId,word:group.word,meaning:group.meaning,stages:group.stages,styleReferences:group.styleReferences,crossStage:group.crossStage,crossStyle:group.crossStyle,entryCount:group.entries.length,assetCount:group.candidates.length,...decisionFor(state,group,catalogSha256)}));return sendJson(response,200,{catalogSha256,groups:summary});}
   catch{return sendJson(response,500,{error:'review-state-read-failed'});}
  }
  if(relative==='/api/group'){
   const group=groupsById.get(url.searchParams.get('id'));if(!group)return sendJson(response,404,{error:'review-group-not-found'});
   try{const state=readState(decisionsFile);return sendJson(response,200,{...group,...decisionFor(state,group,catalogSha256)});}catch{return sendJson(response,500,{error:'review-state-read-failed'});}
  }
  if(relative==='/vocabulary-reuse-review.html'||relative==='/'){
   try{const body=fs.readFileSync(htmlFile);response.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; img-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"});return response.end(request.method==='HEAD'?undefined:body);}catch{response.writeHead(500);return response.end('Review page could not be loaded.');}
  }
  if(relative.startsWith('/assets/')&&imagePaths.has(relative.slice(1))){
   try{const full=fs.realpathSync(path.join(realRoot,relative.slice(1)));if(!full.startsWith(path.join(realRoot,'assets')+path.sep))throw Error('invalid asset path');const body=fs.readFileSync(full);response.writeHead(200,{'Content-Type':'image/webp','Cache-Control':'private, max-age=3600','X-Content-Type-Options':'nosniff'});return response.end(request.method==='HEAD'?undefined:body);}catch{response.writeHead(404);return response.end();}
  }
  response.writeHead(404);response.end();
 });
 server.reviewInfo={catalogSha256,groups:groups.length,statePath:decisionsFile};
 return server;
}

module.exports={makeGroups,createReuseReviewServer,readState,decisionFor};
