'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const Database=require('node:module').createRequire(path.resolve(__dirname,'../server/package.json'))('better-sqlite3');
const {ContentRegistry}=require('../server/services/membership/content-registry');
const {prepareStaticCourseRegistry}=require('../server/services/membership/prepare-static-course-registry');
const {createStaticRegistryActivation}=require('../server/services/membership/static-registry-activation');
function parse(args){
  const mode=args[0],values={};
  if(!['inspect','prepare','activate'].includes(mode))throw Error('请选择 inspect、prepare 或 activate');
  const allowed=['app-root','database','private-root','output','candidate-root','expected-version','request-id','review-file','admin-id','backup-file'];
  for(let i=1;i<args.length;i+=2){const key=args[i]?.slice(2),value=args[i+1];if(!args[i]?.startsWith('--')||!allowed.includes(key)||!value||value.startsWith('--')||values[key])throw Error('参数无效或重复：'+args[i]);values[key]=value;}
  for(const key of ['app-root','database','private-root'])if(!values[key]||!path.isAbsolute(values[key]))throw Error('请显式提供绝对路径 --'+key);
  return {mode,values};
}
async function main(args){
  const {mode,values:v}=parse(args),dbPath=fs.realpathSync(v.database);
  // Never import server/db.js: inspection must not initialize or migrate an application's database.
  const db=new Database(dbPath,{readonly:mode!=='activate',fileMustExist:true});
  try{
    const registry=new ContentRegistry({appRoot:v['app-root'],protectedRoot:v['private-root'],
      activeManifest:()=>db.prepare('SELECT manifest_json AS body FROM membership_static_activations ORDER BY rowid DESC LIMIT 1').get()||null,
      publishedCourses:()=>db.prepare("SELECT registry_entry_json FROM membership_course_publications WHERE status='published'").all().map(row=>JSON.parse(row.registry_entry_json))});
    if(mode==='inspect'){const snapshot=registry.snapshot();return {database:dbPath,privateRoot:registry.protectedRoot,version:snapshot.version,courses:snapshot.courses.map(course=>({courseId:course.courseId,units:course.units.length,staticReady:course.units.every(unit=>!!unit.fragments)}))};}
    if(mode==='prepare'){
      if(!v.output||!path.isAbsolute(v.output))throw Error('请提供全新绝对路径 --output');
      return prepareStaticCourseRegistry({registry,output:v.output});
    }
    for(const key of ['candidate-root','review-file','backup-file'])if(!v[key]||!path.isAbsolute(v[key]))throw Error('请显式提供绝对路径 --'+key);
    if(!v['expected-version']||!v['request-id']||!Number.isSafeInteger(Number(v['admin-id']))||Number(v['admin-id'])<1)throw Error('请提供目录版本、请求编号和管理员编号');
    const review=JSON.parse(fs.readFileSync(v['review-file'],'utf8'));
    if(review.targetDatabase!==dbPath||path.resolve(review.targetPrivateRoot||'')!==registry.protectedRoot)throw Error('审阅文件的精确数据库/私有目录与目标不一致');
    const backup=path.resolve(v['backup-file']);if(fs.existsSync(backup)||backup===dbPath)throw Error('备份目标必须是全新文件');
    // SQLite's consistent backup API includes WAL writes; no raw main-file copying.
    await db.backup(backup);
    const verify=new Database(backup,{readonly:true,fileMustExist:true});
    try{if(verify.pragma('integrity_check',{simple:true})!=='ok')throw Error('备份完整性检查失败');}finally{verify.close();}
    const backupSha256=crypto.createHash('sha256').update(fs.readFileSync(backup)).digest('hex');
    const result=createStaticRegistryActivation({db,registry}).activate({candidateRoot:v['candidate-root'],expectedRegistryVersion:v['expected-version'],requestId:v['request-id'],review:{...review,backup:{file:backup,sha256:backupSha256}}},Number(v['admin-id']));
    return {...result,database:dbPath,backup,backupSha256};
  }finally{db.close();}
}
if(require.main===module)main(process.argv.slice(2)).then(result=>process.stdout.write(JSON.stringify(result,null,2)+'\n')).catch(error=>{process.stderr.write((error.code||error.message)+'\n');process.exitCode=1;});
module.exports={main,parse};
