'use strict';
// Management-only draft snapshots. No course registration or learning writes.
const fs=require('node:fs'),path=require('node:path'),Database=require('better-sqlite3');
const model=require('../../scripts/lib/vocabulary-materials.cjs');
const fail=(message,status=422)=>Object.assign(new Error(message),{status});
const validId=value=>typeof value==='string'&&/^[A-Za-z0-9:._-]{1,160}$/.test(value)&&!['__proto__','constructor','prototype'].includes(value);
function createVocabularyMaterialLibrary({storePath}){
 let db,writable=false;
 function store(write=false){
  if(db&&(!write||writable))return db;
  if(db){db.close();db=undefined;}
  if(!write&&!fs.existsSync(storePath))return null;
  if(write)fs.mkdirSync(path.dirname(storePath),{recursive:true});
  db=new Database(storePath,{fileMustExist:!write,readonly:!write});writable=write;
  if(write)db.exec(`CREATE TABLE IF NOT EXISTS vocabulary_material_snapshots(
   library_id TEXT NOT NULL,version INTEGER NOT NULL,revision TEXT NOT NULL,
   library_json TEXT NOT NULL,created_at TEXT NOT NULL,
   PRIMARY KEY(library_id,version),UNIQUE(library_id,revision));`);
  return db;
 }
 function identify(id){if(!validId(id))throw fail('材料库编号无效');}
 function latest(database,id){return database?.prepare('SELECT * FROM vocabulary_material_snapshots WHERE library_id=? ORDER BY version DESC LIMIT 1').get(id);}
 function summary(row){return {libraryId:row.library_id,version:row.version,revision:row.revision,createdAt:row.created_at,stage:'draft',publishable:false};}
 function save(id,library,baseRevision){
  identify(id);
  if(Buffer.byteLength(JSON.stringify(library||{}))>10000000)throw fail('材料库超过大小限制',413);
  if(baseRevision!==null&&(typeof baseRevision!=='string'||!/^[a-f0-9]{64}$/.test(baseRevision)))throw fail('首次保存须明确提供 baseRevision:null；更新须提供原版本');
  try{model.validate(library);}catch(error){throw fail(error.message);}
  const snapshot=JSON.stringify(library),revision=model.revisionOf(library),database=store(true);
  return database.transaction(()=>{
   const prior=latest(database,id);
   if((prior?.revision||null)!==baseRevision)throw fail('材料库版本已改变，请重新读取；原版本保留',409);
   if(prior?.revision===revision)return summary(prior);
   // A previous snapshot can be inspected, but cannot silently become current again.
   if(database.prepare('SELECT 1 FROM vocabulary_material_snapshots WHERE library_id=? AND revision=?').get(id,revision))throw fail('该历史版本已存在；未改变当前草稿',409);
   const row={library_id:id,version:(prior?.version||0)+1,revision,library_json:snapshot,created_at:new Date().toISOString()};
   database.prepare('INSERT INTO vocabulary_material_snapshots(library_id,version,revision,library_json,created_at) VALUES(@library_id,@version,@revision,@library_json,@created_at)').run(row);
   return summary(row);
  }).immediate();
 }
 function read(id,revision){
  identify(id);if(revision!==undefined&&(typeof revision!=='string'||!/^[a-f0-9]{64}$/.test(revision)))throw fail('材料库版本无效');
  const database=store(),row=revision?database?.prepare('SELECT * FROM vocabulary_material_snapshots WHERE library_id=? AND revision=?').get(id,revision):latest(database,id);
  if(!row)throw fail('材料库草稿或指定版本不存在',404);
  const library=JSON.parse(row.library_json);
  if(model.revisionOf(library)!==row.revision)throw fail('材料库快照完整性检查失败，原数据保留',503);
  return {...summary(row),library};
 }
 function history(id){identify(id);const database=store();if(!latest(database,id))throw fail('材料库草稿不存在',404);return database.prepare('SELECT library_id,version,revision,created_at FROM vocabulary_material_snapshots WHERE library_id=? ORDER BY version DESC').all(id).map(summary);}
 async function preview(id,revision,courseId){
  if(!revision)throw fail('预览必须固定材料库版本');
  const snapshot=read(id,revision);
  try{return {...await model.previewCourse(snapshot.library,courseId),libraryRef:{libraryId:id,revision:snapshot.revision}};}catch(error){throw fail(error.message);}
 }
 return {save,read,history,preview,close(){if(db){db.close();db=undefined;}}};
}
module.exports={createVocabularyMaterialLibrary};
