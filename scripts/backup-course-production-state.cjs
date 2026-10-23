'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const Database=require('../server/node_modules/better-sqlite3');
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
async function backup({dataRoot,output}){
 const root=fs.realpathSync(dataRoot),target=path.resolve(output),relative=path.relative(root,target);
 if(!relative||!relative.startsWith('..')&&!path.isAbsolute(relative)||fs.existsSync(target))throw Error('备份必须使用数据目录外的新目录');
 fs.mkdirSync(target,{recursive:true});const files=[],databases=[];
 function copy(file,rel){if(fs.lstatSync(file).isSymbolicLink())throw Error('备份源含符号链接');const out=path.join(target,rel);fs.mkdirSync(path.dirname(out),{recursive:true});fs.copyFileSync(file,out,fs.constants.COPYFILE_EXCL);const sha256=hash(out);if(hash(file)!==sha256)throw Error('备份期间源文件变化');files.push({path:rel.replace(/\\/g,'/'),sha256,bytes:fs.statSync(out).size});}
 function walk(dir,rel){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const next=path.join(dir,entry.name),name=path.join(rel,entry.name);if(entry.isDirectory())walk(next,name);else copy(next,name);}}
 for(const entry of fs.readdirSync(root,{withFileTypes:true}).filter(e=>e.isFile()&&/\.(db|sqlite)$/.test(e.name))){
  const file=path.join(root,entry.name),out=path.join(target,entry.name),db=new Database(file,{readonly:true,fileMustExist:true});
  try{await db.backup(out);}finally{db.close();}
  const check=new Database(out,{readonly:true,fileMustExist:true});
  try{if(check.pragma('quick_check',{simple:true})!=='ok')throw Error('数据库备份完整性检查失败');const counts=Object.fromEntries(check.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(row=>[row.name,check.prepare('SELECT COUNT(*) AS n FROM "'+row.name.replaceAll('"','""')+'"').get().n]));databases.push({path:entry.name,counts});}finally{check.close();}
  files.push({path:entry.name,sha256:hash(out),bytes:fs.statSync(out).size});
 }
 for(const folder of ['system-wordbook-imports','wordbook-publications'])if(fs.existsSync(path.join(root,folder)))walk(path.join(root,folder),folder);
 for(const file of files)if(hash(path.join(target,file.path))!==file.sha256)throw Error('备份复核失败');
 const manifest={format:'course-production-backup',schemaVersion:1,source:root,createdAt:new Date().toISOString(),databaseMethod:'SQLite backup API',databases,files};
 fs.writeFileSync(path.join(target,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
 return {path:target,files:files.length,databases:databases.map(x=>x.path),verified:true};
}
if(require.main===module){const args=process.argv.slice(2),get=name=>{const i=args.indexOf(name);if(i<0||!args[i+1])throw Error('需要 '+name);return args[i+1];};backup({dataRoot:get('--data'),output:get('--out')}).then(result=>console.log(JSON.stringify(result,null,2))).catch(e=>{console.error(e);process.exitCode=1;});}
module.exports={backup};
