'use strict';

const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const Database=require('../server/node_modules/better-sqlite3');
const {ensureCourseLibrarySchema}=require('../server/services/course-library-schema');
const {buildManifest,applyManifest}=require('../server/services/course-library-migration');
const args=process.argv.slice(2),value=name=>{const i=args.indexOf(name);if(i<0||!args[i+1])throw Error('Missing '+name);return path.resolve(args[i+1]);};
async function run(){
 const source=value('--db'),backupDir=value('--backup-dir');
 if(fs.existsSync(backupDir))throw Error('Backup directory must be new');
 if(!fs.existsSync(source))throw Error('Source database not found');
 fs.mkdirSync(backupDir);
 const backup=path.join(backupDir,'chunklab-consistent-backup.db');
 const sourceDb=new Database(source,{readonly:true,fileMustExist:true});
 try{await sourceDb.backup(backup);}finally{sourceDb.close();}
 const restoreDir=fs.mkdtempSync(path.join(os.tmpdir(),'chunklab-course-library-rehearsal-'));
 const restored=path.join(restoreDir,'chunklab.db');fs.copyFileSync(backup,restored,fs.constants.COPYFILE_EXCL);
 const db=new Database(restored,{fileMustExist:true});
 const report={createdAt:new Date().toISOString(),source,backup,restored,liveChanged:false,appliedToCopyOnly:true};
 try{
  report.integrityBefore=db.pragma('quick_check',{simple:true});if(report.integrityBefore!=='ok')throw Error('Restored database integrity check failed');
  db.pragma('foreign_keys = ON');ensureCourseLibrarySchema(db);
  const manifest=buildManifest(db);report.entries=manifest.entries.length;report.sourceDigest=manifest.sourceDigest;
  report.result=applyManifest(db,manifest);
  report.integrityAfter=db.pragma('quick_check',{simple:true});if(report.integrityAfter!=='ok')throw Error('Migrated copy integrity check failed');
  report.repeatResult=applyManifest(db,manifest);if(report.repeatResult.added!==0)throw Error('Repeat migration was not idempotent');
  report.passed=true;
 }catch(error){report.passed=false;report.error={code:error.code||'REHEARSAL_FAILED',message:error.message,blockerCount:error.blockers?.length||0};process.exitCode=2;}
 finally{db.close();fs.writeFileSync(path.join(backupDir,'rehearsal-report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});}
 console.log(JSON.stringify(report));
}
run().catch(error=>{console.error(error.message);process.exitCode=1;});
