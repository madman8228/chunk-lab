'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),Database=require('better-sqlite3');
const contentModel=require('../../js/vocabulary-study.cjs');
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function within(root,file){const relative=path.relative(root,file);return relative&&!relative.startsWith('..')&&!path.isAbsolute(relative);}
async function backupVocabularyMaterials({dataDir,appRoot,backupDir}){
 const source=fs.realpathSync(dataDir),database=path.join(source,'vocabulary-material-library.sqlite'),published=path.join(source,'wordbook-publications');
 const folders=fs.existsSync(published)?fs.readdirSync(published).filter(name=>/^[a-f0-9]{64}$/.test(name)).sort():[];
 if(!fs.existsSync(database)&&!folders.length)return null;
 const output=path.resolve(backupDir);if(output===source||within(source,output))throw Error('材料备份目标不能位于源数据目录中');
 fs.mkdirSync(output,{recursive:true});const root=fs.realpathSync(output);if(root===source||within(source,root))throw Error('材料备份目标不能链接到源数据目录');
 const staging=fs.mkdtempSync(path.join(root,'.pending-vocabulary-')),files=[];
 function record(relative){const target=path.join(staging,relative),bytes=fs.readFileSync(target);files.push({path:relative.replace(/\\/g,'/'),bytes:bytes.length,sha256:digest(bytes)});}
 function copy(file,relative,allowedRoot){
  const real=fs.realpathSync(file);if(!within(allowedRoot,real)||!fs.statSync(real).isFile())throw Error('材料备份源文件越界或不是普通文件');
  const target=path.join(staging,relative);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(real,target,fs.constants.COPYFILE_EXCL);record(relative);
  if(digest(fs.readFileSync(real))!==files.at(-1).sha256)throw Error('备份期间源文件发生变化，未完成备份');
 }
 try{
  if(fs.existsSync(database)){
   if(fs.realpathSync(database)!==database)throw Error('材料数据库不能为符号链接');
   const db=new Database(database,{readonly:true,fileMustExist:true});
   try{await db.backup(path.join(staging,'vocabulary-material-library.sqlite'));}finally{db.close();}
   const check=new Database(path.join(staging,'vocabulary-material-library.sqlite'),{readonly:true,fileMustExist:true});
   try{if(check.pragma('quick_check',{simple:true})!=='ok')throw Error('材料数据库备份完整性检查失败');check.prepare('SELECT COUNT(*) AS count FROM vocabulary_material_snapshots').get();}finally{check.close();}
   record('vocabulary-material-library.sqlite');
  }
  const assets=new Set(),expectedAssets=new Map();
 const versionStore=require('./public-wordbook-versions').createPublicWordbookVersions({publishedRoot:published});
  for(const folder of folders){
   const courseDir=path.join(published,folder);if(fs.realpathSync(courseDir)!==courseDir)throw Error('发布课程目录不能为符号链接');
   const manifestFile=path.join(courseDir,'manifest.json'),manifest=contentModel.validateIndex(JSON.parse(fs.readFileSync(manifestFile,'utf8')));
   if(manifest.books.length!==1)throw Error('发布课程目录不唯一');versionStore.history(manifest.books[0].bookId);
   copy(manifestFile,path.join('wordbook-publications',folder,'manifest.json'),source);
   const publicationFile=path.join(courseDir,'publication.json');if(fs.existsSync(publicationFile)){
    const publication=JSON.parse(fs.readFileSync(publicationFile,'utf8'));
    if(typeof publication.importId!=='string'||!/^[a-f0-9-]{36}$/i.test(publication.importId)||typeof publication.packageFingerprint!=='string'||!/^[a-f0-9]{64}$/.test(publication.packageFingerprint)||!Array.isArray(publication.assets)||!publication.review||typeof publication.review.reviewer!=='string')throw Error('发布审核回执格式无效');
    copy(publicationFile,path.join('wordbook-publications',folder,'publication.json'),source);
   }
   const teachingFile=path.join(courseDir,'teaching.json');if(fs.existsSync(teachingFile)){
    if(manifest.books.length!==1)throw Error('预学习课程不唯一');
    const book=manifest.books[0],items=book.items.map(ref=>JSON.parse(fs.readFileSync(path.join(courseDir,'items',ref.itemId.replace(/:/g,'_')+'.json'),'utf8'))),release=JSON.parse(fs.readFileSync(teachingFile,'utf8'));
    require('./vocabulary-teaching-content').validateRelease(release,book,items,appRoot);
    for(const plan of release.plans)for(const step of plan.steps){const audio=step.presentation.audio,prior=expectedAssets.get(audio.url);if(prior&&(prior.sha256!==audio.sha256||prior.bytes!==audio.bytes))throw Error('预学习音频摘要冲突');assets.add(audio.url);expectedAssets.set(audio.url,audio);}
    copy(teachingFile,path.join('wordbook-publications',folder,'teaching.json'),source);
   }
   const practicesFile=path.join(courseDir,'practices.json');if(fs.existsSync(practicesFile)){if(manifest.books.length!==1)throw Error('学习方式摘要课程不唯一');require('./vocabulary-practice-summary').validate(JSON.parse(fs.readFileSync(practicesFile,'utf8')),manifest.books[0]);copy(practicesFile,path.join('wordbook-publications',folder,'practices.json'),source);}
   const materialFile=path.join(courseDir,'materials.json');if(fs.existsSync(materialFile)){
    const stored=JSON.parse(fs.readFileSync(materialFile,'utf8'));
    if(stored.releaseRevision!==digest(Buffer.from(JSON.stringify(stored.release)))||manifest.books.length!==1||stored.bookRevision!==manifest.books[0].revision)throw Error('发布材料归档版本不一致');
    for(const asset of stored.release.deliveries){const prior=expectedAssets.get(asset.url);if(prior&&(prior.sha256!==asset.sha256||prior.bytes!==asset.bytes))throw Error('发布素材摘要冲突');expectedAssets.set(asset.url,asset);}
    copy(materialFile,path.join('wordbook-publications',folder,'materials.json'),source);
   }
   for(const book of manifest.books){
    if(book.catalog?.coverUrl)assets.add(book.catalog.coverUrl);
    for(const ref of book.items){
     const relative=path.join('wordbook-publications',folder,'items',ref.itemId.replace(/:/g,'_')+'.json'),file=path.join(source,relative),item=JSON.parse(fs.readFileSync(file,'utf8')),{contentRevision,...body}=item;
     if(item.itemId!==ref.itemId||contentRevision!==ref.contentRevision||digest(Buffer.from(JSON.stringify(body)))!==contentRevision)throw Error('发布任务版本不一致');
     for(const url of [...item.images.wide,...item.images.mobile])assets.add(url);
     for(const activity of [item.learning?.wordDictation,item.learning?.sentenceAudio,item.learning?.readAloud].filter(Boolean))for(const audio of [activity.audio,...Object.values(activity.audioByAccent||{})]){assets.add(audio.url);const prior=expectedAssets.get(audio.url);if(prior&&(prior.sha256!==audio.sha256||prior.bytes!==audio.bytes))throw Error('课程音频摘要冲突');expectedAssets.set(audio.url,audio);}
     copy(file,relative,source);
    }
   }
   const releasesDir=path.join(courseDir,'releases'),activationDir=path.join(courseDir,'activations');
   const activationSignature=()=>fs.existsSync(activationDir)?fs.readdirSync(activationDir).filter(name=>/^\d{12}-[a-f0-9]{64}\.json$/.test(name)).sort().map(name=>name+':'+digest(fs.readFileSync(path.join(activationDir,name)))).join('|'):'';
   const beforeActivation=activationSignature();
   if(fs.existsSync(releasesDir))for(const entry of fs.readdirSync(releasesDir,{withFileTypes:true}).filter(row=>row.isDirectory()&&/^[a-f0-9]{64}$/.test(row.name))){
    const releaseDir=path.join(releasesDir,entry.name);if(fs.realpathSync(releaseDir)!==releaseDir)throw Error('教材历史版本目录不能为符号链接');
    const packageFile=path.join(releaseDir,'package.json'),candidate=JSON.parse(fs.readFileSync(packageFile,'utf8'));
    if(digest(Buffer.from(JSON.stringify(candidate)))!==entry.name||candidate.index?.books?.length!==1)throw Error('教材历史版本摘要校验失败');
    const releaseIndex=contentModel.validateIndex(candidate.index,{allowItemVersions:true}),releaseBook=releaseIndex.books[0];
    if(crypto.createHash('sha256').update(JSON.stringify(releaseBook.bookId)).digest('hex')!==folder)throw Error('历史版本课程身份与发布目录不一致');
    const prefix=path.join('wordbook-publications',folder,'releases',entry.name);
    copy(packageFile,path.join(prefix,'package.json'),source);copy(path.join(releaseDir,'manifest.json'),path.join(prefix,'manifest.json'),source);
    const publication=path.join(releaseDir,'publication.json');if(fs.existsSync(publication))copy(publication,path.join(prefix,'publication.json'),source);
    if(releaseBook.catalog?.coverUrl)assets.add(releaseBook.catalog.coverUrl);
    for(const ref of releaseBook.items){
     const sourceItem=path.join(releaseDir,'items',ref.itemId.replace(/:/g,'_')+'.json'),item=JSON.parse(fs.readFileSync(sourceItem,'utf8')),{contentRevision,...body}=item;
     if(item.itemId!==ref.itemId||contentRevision!==ref.contentRevision||digest(Buffer.from(JSON.stringify(body)))!==contentRevision)throw Error('历史教材词条版本校验失败');
     for(const url of [...(item.images?.wide||[]),...(item.images?.mobile||[])])assets.add(url);
     for(const activity of [item.learning?.wordDictation,item.learning?.sentenceAudio,item.learning?.readAloud].filter(Boolean))for(const audio of [activity.audio,...Object.values(activity.audioByAccent||{})]){assets.add(audio.url);const prior=expectedAssets.get(audio.url);if(prior&&(prior.sha256!==audio.sha256||prior.bytes!==audio.bytes))throw Error('历史课程音频摘要冲突');expectedAssets.set(audio.url,audio);}
     copy(sourceItem,path.join(prefix,'items',ref.itemId.replace(/:/g,'_')+'.json'),source);
    }
   }
   if(fs.existsSync(activationDir))for(const name of fs.readdirSync(activationDir).filter(file=>/^\d{12}-[a-f0-9]{64}\.json$/.test(file)).sort()){const sourceRecord=path.join(activationDir,name),record=JSON.parse(fs.readFileSync(sourceRecord,'utf8')),{recordHash,...body}=record;if(recordHash!==digest(Buffer.from(JSON.stringify(body)))||name!==String(record.sequence).padStart(12,'0')+'-'+recordHash+'.json')throw Error('教材激活记录校验失败');copy(sourceRecord,path.join('wordbook-publications',folder,'activations',name),source);}
   if(activationSignature()!==beforeActivation)throw Error('备份期间教材版本激活发生变化，请重新备份');
  }
  if(assets.size){const assetRoot=fs.realpathSync(path.join(appRoot,'assets'));for(const url of [...assets].sort()){
   if(typeof url!=='string'||!/^assets\/[A-Za-z0-9._-]+\.(webp|avif|png|jpg|svg|mp3|ogg|wav)$/.test(url))throw Error('备份素材路径无效');
   copy(path.join(appRoot,url),url,assetRoot);const expected=expectedAssets.get(url),actual=files.at(-1);
   if(expected&&(actual.sha256!==expected.sha256||actual.bytes!==expected.bytes))throw Error('交付图与发布审核摘要不一致');
  }}
  // Re-read every destination before declaring success, without deleting old backups.
  for(const file of files){const bytes=fs.readFileSync(path.join(staging,file.path));if(bytes.length!==file.bytes||digest(bytes)!==file.sha256)throw Error('材料备份文件核验失败');}
  const manifest={format:'vocabulary-material-backup',schemaVersion:1,createdAt:new Date().toISOString(),scope:'admin material snapshots, immutable published wordbooks and referenced delivery assets; not account records or artwork masters',files};
  fs.writeFileSync(path.join(staging,'manifest.json'),JSON.stringify(manifest,null,2),{flag:'wx'});
  for(const relative of [...files.map(file=>file.path),'manifest.json']){const fd=fs.openSync(path.join(staging,relative),'r+');try{fs.fsyncSync(fd);}finally{fs.closeSync(fd);}}
  const destination=path.join(root,'vocabulary_materials_'+crypto.randomUUID());fs.renameSync(staging,destination);return {path:destination,fileCount:files.length};
 }catch(error){
  // Only this invocation's freshly allocated staging area may be removed.
  if(path.dirname(staging)!==root||!path.basename(staging).startsWith('.pending-vocabulary-'))throw Error('备份暂存清理目标无效');
  fs.rmSync(staging,{recursive:true,force:true});throw error;
 }
}
module.exports={backupVocabularyMaterials};
