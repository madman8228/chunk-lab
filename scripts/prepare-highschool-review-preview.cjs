'use strict';
// Read-only review snapshot; writes only to a newly allocated output directory.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const Database=require('../server/node_modules/better-sqlite3');
const {createIllustrationReview}=require('../server/services/illustration-review');
const root=path.resolve(__dirname,'..');
const database=new Database(path.join(root,'server/data/illustration-review.sqlite'),{readonly:true,fileMustExist:true});
database.pragma('query_only=ON');
const output=fs.mkdtempSync(path.join(root,'output/highschool-internal-preview-'));
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'highschool-review-snapshot-'));
try{
 const rows=database.transaction(()=>database.prepare('SELECT * FROM reviews').all())();
 // Obtain current asset/version checks through a disposable copy of review records, never the live store.
 const isolated=new Database(path.join(scratch,'snapshot.sqlite'));
 isolated.exec('CREATE TABLE reviews(course TEXT,item TEXT,version TEXT,revision INTEGER,status TEXT,note TEXT,reason TEXT,meaning TEXT,updated TEXT,PRIMARY KEY(course,item,version));');
 const insert=isolated.prepare('INSERT INTO reviews VALUES(?,?,?,?,?,?,?,?,?)');
 isolated.transaction(()=>rows.forEach(r=>insert.run(r.course,r.item,r.version,r.revision,r.status,r.note,r.reason,r.meaning,r.updated)))();isolated.close();
 const snapshotService=createIllustrationReview({appRoot:root,storePath:path.join(scratch,'snapshot.sqlite')});
 const books=snapshotService.courses();
 const report={createdAt:new Date().toISOString(),mode:'internal-preview-only',published:false,realAccountsChanged:false,books:[]};
 try{for(const c of books){
  const book=snapshotService.book(c.id),counts={approved:0,changes:0,pending:0,shownImages:0,missingImages:0,blockedImages:0};
  const items=book.items.map(i=>{
   counts[i.review.status]++;if(!i.delivery)counts.missingImages++;
   const show=i.review.status==='approved'&&i.checks.length===0&&!!i.delivery;
   if(show)counts.shownImages++;else counts.blockedImages++;
   return {itemId:i.itemId,word:i.word,meaning:i.meaning,unit:i.unit,status:i.review.status,images:show?{wide:i.delivery,mobile:i.delivery}:null,checks:i.checks,note:i.review.note,reason:i.review.reason};
  });
  report.books.push({id:c.id,title:c.title,itemCount:items.length,counts});
  fs.writeFileSync(path.join(output,c.id+'.json'),JSON.stringify({title:c.title,status:'internal-preview',items},null,2),{flag:'wx'});
  fs.writeFileSync(path.join(output,c.id+'-issues.json'),JSON.stringify(items.filter(i=>i.status!=='approved'||i.checks.length),null,2),{flag:'wx'});
 }}finally{snapshotService.close();}
 fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2),{flag:'wx'});
 fs.copyFileSync(path.join(__dirname,'highschool-internal-preview.html'),path.join(output,'index.html'),fs.constants.COPYFILE_EXCL);
 fs.writeFileSync(path.join(output,'README.md'),'# 高中三册内部测试准备包\n\n仅用于内部预览，未发布、未导入真实账号。只引用已通过且无校验问题的图片，其余词条保留文字。\n\n尚需：核对原创例句与练习、适配正式学习结构、隔离环境导入与学习进度测试。当前包不是正式课程发布包。\n',{flag:'wx'});
 console.log(JSON.stringify({output,...report},null,2));
}finally{database.close();}
