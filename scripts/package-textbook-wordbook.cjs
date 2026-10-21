#!/usr/bin/env node
'use strict';
// manifest: { book, units: [{ unitId, title, itemIds }], drafts: ["relative/path.json"] }
const fs=require('node:fs'),path=require('node:path');
const {assemble}=require('../server/services/textbook-wordbook-package');
function packageTextbook(manifestFile,outputFile){
 const manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'));
 if(!Array.isArray(manifest.drafts)||manifest.drafts.some(file=>typeof file!=='string'))throw Error('目录清单需列出各单元草稿文件');
 const source={format:'textbook-wordbook-package',schemaVersion:1,book:manifest.book,units:manifest.units,drafts:manifest.drafts.map(file=>JSON.parse(fs.readFileSync(path.resolve(path.dirname(manifestFile),file),'utf8')))};
 const assembled=assemble(source),bytes=JSON.stringify(source,null,2);
 if(Buffer.byteLength(bytes)>10000000)throw Error('教材包超过 10 MB');
 fs.writeFileSync(outputFile,bytes,{flag:'wx'});
 return {title:assembled.book.title,units:assembled.book.units.length,items:assembled.items.length,path:path.resolve(outputFile)};
}
if(require.main===module){
 try{if(process.argv.length!==4)throw Error('用法：node scripts/package-textbook-wordbook.cjs 完整目录清单.json 新教材包.json');console.log(JSON.stringify(packageTextbook(process.argv[2],process.argv[3])));}
 catch(error){console.error(error.message);process.exitCode=1;}
}
module.exports={packageTextbook};
