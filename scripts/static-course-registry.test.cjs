'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
let Database;
try { Database=require('node:module').createRequire(path.resolve(__dirname,'../server/package.json'))('better-sqlite3'); }
catch(_) { console.log('SKIP: better-sqlite3 is not installed in this checkout'); process.exit(0); }
const {initializeMembershipSchema}=require('../server/services/membership/schema');
const {main,parse}=require('./static-course-registry.cjs');
async function test(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'chunklab-registry-cli-')),app=path.join(root,'app'),privateRoot=path.join(root,'private'),database=path.join(root,'isolated.db');
 fs.mkdirSync(app);fs.mkdirSync(privateRoot);const db=new Database(database);initializeMembershipSchema(db);db.close();
 fs.writeFileSync(path.join(privateRoot,'lesson.json'),JSON.stringify({items:[{cid:'a',sentence:'Preserve this.',chunks:['Preserve','this.']}]}));
 fs.writeFileSync(path.join(privateRoot,'registry.json'),JSON.stringify({schemaVersion:1,courses:[{courseId:'c',title:'Synthetic',contentType:'sentence',defaultAccess:'free',sourcePaths:[],legacyDeckIds:[],units:[{unitId:'u',file:'lesson.json',contentRef:{type:'sentence-deck',id:'c'},itemIds:['a'],assets:[]}]}]}));
 const base=['--app-root',app,'--database',database,'--private-root',privateRoot];
 const before=fs.readFileSync(database);const inspected=await main(['inspect',...base]);assert.deepEqual(fs.readFileSync(database),before);
 const output=path.join(root,'candidate');await main(['prepare',...base,'--output',output]);assert.deepEqual(fs.readFileSync(database),before);
 const reviewFile=path.join(root,'review.json');fs.writeFileSync(reviewFile,JSON.stringify({candidateHash:crypto.createHash('sha256').update(fs.readFileSync(path.join(output,'candidate.json'))).digest('hex'),targetDatabase:database,targetPrivateRoot:privateRoot,publicSourcesVerified:true,runtimeVerified:true,evidence:'Isolated fixture review only'}));
 const args=['activate',...base,'--candidate-root',output,'--expected-version',inspected.version,'--request-id',crypto.randomUUID(),'--review-file',reviewFile,'--admin-id','1','--backup-file',path.join(root,'backup.db')];
 const result=await main(args);assert.equal(result.activated,true);assert.ok(result.backupSha256);
 const backup=new Database(result.backup,{readonly:true});assert.equal(backup.prepare('SELECT COUNT(*) AS n FROM membership_static_activations').get().n,0);backup.close();
 const retry=args.slice();retry[retry.length-1]=path.join(root,'retry-backup.db');assert.equal((await main(retry)).replay,true);
 await assert.rejects(main(args),/全新文件/);assert.throws(()=>parse(['inspect',...base,'--database',database]),/重复/);
 console.log('static registry CLI: read-only inspection/preparation, exact targets, consistent verified backup, activation and idempotent retry passed');
}
test().catch(error=>{console.error(error);process.exitCode=1;});
