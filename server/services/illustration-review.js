'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const Database=require('better-sqlite3');
const fail=(message,status=422)=>Object.assign(new Error(message),{status});
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
function createIllustrationReview({appRoot,storePath}){
 let db;
 function store(){
  if(db)return db;
  fs.mkdirSync(path.dirname(storePath),{recursive:true});db=new Database(storePath);db.pragma('journal_mode = WAL');
  db.exec(`CREATE TABLE IF NOT EXISTS reviews(course TEXT,item TEXT,version TEXT,revision INTEGER NOT NULL,status TEXT NOT NULL,note TEXT NOT NULL,reason TEXT NOT NULL,meaning TEXT NOT NULL,updated TEXT NOT NULL,PRIMARY KEY(course,item,version));
   CREATE TABLE IF NOT EXISTS history(id INTEGER PRIMARY KEY,course TEXT,item TEXT,version TEXT,payload TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS cursor(course TEXT PRIMARY KEY,item TEXT NOT NULL);`);return db;
 }
 function courses(){
  const root=path.join(appRoot,'output/textbook-extractions');if(!fs.existsSync(root))return [];
  return fs.readdirSync(root,{withFileTypes:true}).filter(d=>d.isDirectory()&&/^highschool-pep-required[123]-2019-20261016$/.test(d.name)).map(d=>({id:d.name,title:'人教版高中英语 · 必修第'+({'1':'一','2':'二','3':'三'}[d.name.match(/required(\d)/)[1]])+'册（2019）'}));
 }
 function contained(relative){
  if(typeof relative!=='string'||!relative.startsWith('assets/')||!relative.endsWith('.webp')||relative.includes('..'))return null;
  try{const root=fs.realpathSync(path.join(appRoot,'assets')),target=fs.realpathSync(path.join(appRoot,relative)),rel=path.relative(root,target);return rel&&!rel.startsWith('..')&&!path.isAbsolute(rel)?target:null;}catch{return null;}
 }
 function load(course){
  const info=courses().find(c=>c.id===course);if(!info)throw fail('找不到这本教材',404);
  const root=path.join(appRoot,'output/textbook-extractions',course),rows=new Map();
  const glossPath=path.join(root,'source-glosses-v3.json');
  const glosses=fs.existsSync(glossPath)?JSON.parse(fs.readFileSync(glossPath,'utf8')):null;
  const sourceEntries=new Map((glosses?.entries||[]).map(e=>[e.itemId,e]));
  if(sourceEntries.size!==(glosses?.entries||[]).length)throw fail('释义来源中有重复词条编号',503);
  for(const dir of fs.readdirSync(root,{withFileTypes:true}).filter(d=>d.isDirectory()&&/^(unit\d+|welcome)-illustrations$/.test(d.name)).sort((a,b)=>a.name.startsWith('welcome')?-1:b.name.startsWith('welcome')?1:a.name.localeCompare(b.name,undefined,{numeric:true}))){
   for(const name of fs.readdirSync(path.join(root,dir.name)).filter(n=>/^batch-.*-atlas\.json$/.test(n)).sort()){
    const m=JSON.parse(fs.readFileSync(path.join(root,dir.name,name),'utf8'));
    for(const raw of m.items||m.panels||[]){
     if(!raw.itemId||raw.properName)continue;
     const exact=(m.panels||[]).find(p=>p.itemId===raw.itemId);
     const matches=exact?[exact]:(m.panels||[]).filter(p=>p.slug&&raw.delivery&&path.basename(raw.delivery).endsWith(p.slug+'-wide-'+path.basename(raw.delivery).split('-wide-').at(-1)));
     const panel=matches.length===1?matches[0]:{},x={...panel,...raw};
     const file=contained(x.delivery),buffer=file?fs.readFileSync(file):null;
     const checks=[];if(!buffer)checks.push('图片文件缺失');if(buffer&&buffer.length>=20000)checks.push('图片超过20KB限制');
     if(!x.headword&&!x.word)checks.push('词头缺失，请检查来源清单');
     if(x.images&&x.images.wide!==x.images.mobile)checks.push('电脑与手机图片路径不同');
     if(buffer&&(buffer.toString('ascii',0,4)!=='RIFF'||buffer.toString('ascii',8,12)!=='WEBP'))checks.push('图片格式异常');
     const source=sourceEntries.get(x.itemId),meaning=source?.meaning||x.meaning||x.gloss||'';
     if(source?.reviewIssue)checks.push(source.reviewIssue);
     const versionInputs=[x.delivery,buffer?hash(buffer):null];
     if(source)versionInputs.push(source.headword,meaning);
     rows.set(x.itemId,{itemId:x.itemId,word:source?.headword||x.headword||x.word||x.itemId,originalWord:x.headword||x.word||null,unit:source?.sourceUnit||x.unit||m.unit||dir.name,title:m.title||'',meaning,meaningSource:source?'教材词汇页转录（待审核）':null,sourceImage:source?.sourceImage||null,sourceRegion:source?.sourceRegion||null,sourceOrder:source?.sourceLine||null,scene:x.scene||'',sourcePages:source?(source.printedPage?[source.printedPage]:[]):x.sourcePages||[],delivery:buffer?x.delivery:null,bytes:buffer?.length||0,version:hash(JSON.stringify(versionInputs)),checks});
    }
   }
  }
  const missingPath=path.join(root,'source-missing-entries-v1.json');
  if(fs.existsSync(missingPath)){
   const missing=JSON.parse(fs.readFileSync(missingPath,'utf8'));
   for(const source of missing.entries||[]){
    if(rows.has(source.itemId))continue;
    rows.set(source.itemId,{itemId:source.itemId,word:source.headword,originalWord:source.headword,unit:source.sourceUnit,title:'',meaning:source.meaning,meaningSource:'教材词汇页转录（待审核）',sourceImage:source.sourceImage,sourceRegion:source.sourceRegion,sourceOrder:source.sourceLine,sourcePages:source.printedPage?[source.printedPage]:[],scene:'',delivery:null,bytes:0,version:hash(JSON.stringify([null,null,source.headword,source.meaning])),illustrationPending:true,checks:['教材漏词已补录，配图待制作']});
   }
  }
  const reportPath=path.join(root,'source-gloss-reconciliation-v2.json');
  const sourceGaps=fs.existsSync(reportPath)?JSON.parse(fs.readFileSync(reportPath,'utf8')).unillustratedSourceEntries||[]:[];
  return {...info,items:[...rows.values()].sort((a,b)=>glosses?(a.sourceOrder??Infinity)-(b.sourceOrder??Infinity):0),sourceGaps};
 }
 function book(course){
  const result=load(course),database=store();
  result.items=result.items.map(item=>{const review=database.prepare('SELECT * FROM reviews WHERE course=? AND item=? AND version=?').get(course,item.itemId,item.version);const history=database.prepare('SELECT version,payload FROM history WHERE course=? AND item=? ORDER BY id DESC LIMIT 20').all(course,item.itemId).map(r=>JSON.parse(r.payload));return {...item,review:review||{revision:0,status:'pending',note:'',reason:'',meaning:''},history};});
  result.cursor=database.prepare('SELECT item FROM cursor WHERE course=?').get(course)?.item||null;return result;
 }
 function save(course,input){
  const loaded=load(course),changes=input.changes;
  if(!Array.isArray(changes)||!changes.length||changes.length>100)throw fail('每次请选择1至100个词条');
  if(new Set(changes.map(c=>c.itemId)).size!==changes.length)throw fail('词条重复');
  const database=store();
  database.transaction(()=>{
   for(const change of changes){
    const item=loaded.items.find(x=>x.itemId===change.itemId);if(!item||item.version!==change.version)throw fail('图片已更新，请刷新后重新审核',409);
    const prior=database.prepare('SELECT revision FROM reviews WHERE course=? AND item=? AND version=?').get(course,item.itemId,item.version);
    if(!Number.isInteger(change.baseRevision)||(prior?.revision||0)!==change.baseRevision)throw fail('其他窗口已修改审核记录，请刷新后重试',409);
    if(!['pending','approved','changes'].includes(change.status))throw fail('审核状态无效');
    const note=String(change.note||''),reason=String(change.reason||''),meaning=String(change.meaning||'').trim();if(note.length>2000||reason.length>100||meaning.length>1000)throw fail('审核意见过长');
    if(change.status==='approved'&&(item.checks.length||!(item.meaning||meaning)))throw fail('请先补充释义并处理文件问题，再通过审核');
    const record={revision:(prior?.revision||0)+1,status:change.status,note,reason,meaning,updated:new Date().toISOString()};
    database.prepare('INSERT INTO reviews VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(course,item,version) DO UPDATE SET revision=excluded.revision,status=excluded.status,note=excluded.note,reason=excluded.reason,meaning=excluded.meaning,updated=excluded.updated').run(course,item.itemId,item.version,record.revision,record.status,note,reason,meaning,record.updated);
    database.prepare('INSERT INTO history(course,item,version,payload) VALUES(?,?,?,?)').run(course,item.itemId,item.version,JSON.stringify({...record,version:item.version,delivery:item.delivery}));
   }
   database.prepare('INSERT INTO cursor VALUES(?,?) ON CONFLICT(course) DO UPDATE SET item=excluded.item').run(course,changes.at(-1).itemId);
  })();return book(course);
 }
 return {courses,book,save,close(){db?.close();db=null;}};
}
module.exports={createIllustrationReview};
