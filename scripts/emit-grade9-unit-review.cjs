'use strict';
// Emit new review artifacts to stdout. Never import, publish or overwrite source files.
const fs=require('node:fs'),path=require('node:path'),model=require('../js/wordbook-draft');
const root=path.resolve(__dirname,'..'),unit=Number(process.argv[2]);
if(!Number.isInteger(unit)||unit<4||unit>14)throw Error('需要 Unit 4–14 的编号');
const base='output/textbook-extractions/people-grade9-full-2013-20261015/',folder=base+'unit'+unit+'-review-v1/';
const source=JSON.parse(fs.readFileSync(path.join(root,'docs/source-materials/people-grade9-full-2013.json'),'utf8'));
const entries=source.vocabularyText.split('\n').filter(line=>line.startsWith('Unit '+unit+'|')).map(line=>line.split('|'));
// Unit 9 corrections verified against retained scans pp.164–165 (2026-10-20).
if(unit===9){
 entries.find(row=>row[1]==='superhero')[2]='超级英雄';
 entries.find(row=>row[1]==='suppose')[2]='推断；料想';
 entries.find(row=>row[1]==='Titanic')[2]='《泰坦尼克号》';
 const dan=entries.find(row=>row[1]==='Dan');dan[1]='Dan Dervish';dan[2]='丹·德维什';
 entries.splice(entries.findIndex(row=>row[1]==='Dervish'),1);
 entries.splice(entries.findIndex(row=>row[1]==='total')+1,0,['Unit 9','in total','总共；合计','70']);
}
if(unit===10){
 const teresa=entries.find(row=>row[1]==='Teresa');teresa[1]='Teresa Lopez';teresa[2]='特蕾莎·洛佩兹';
 entries.splice(entries.findIndex(row=>row[1]==='Lopez'),1);
 const marc=entries.find(row=>row[1]==='Marc');marc[1]='Marc LeBlanc';marc[2]='马克·勒布朗';
}
if(unit===11){
 entries.find(row=>row[1]==='rather')[2]='宁愿；相当';
 entries.find(row=>row[1]==='drive')[2]='迫使';
 entries.splice(entries.findIndex(row=>row[1]==='prime minister'),0,['Unit 11','prime','首要的；基本的','83']);
}
const authored=fs.readFileSync(path.join(root,folder,'authored.tsv'),'utf8').trim().split(/\r?\n/).map(line=>line.split('|'));
if(entries.length!==authored.length)throw Error('来源词条数与审阅稿不符');
const template=JSON.parse(fs.readFileSync(path.join(root,base,'unit1-pilot/wordbook-draft-shared-webp-v1.json'),'utf8'));
const draft={schemaVersion:1,book:{bookId:'textbook-wordbook:pep-junior-grade9-full-2013-unit'+unit+'-review',title:'人教版英语 九年级全一册（2013）·Unit '+unit+' 文字审阅稿',catalog:structuredClone(template.book.catalog),units:[{unitId:'pep-g9-2013-unit-'+unit,title:source.edition.contents[unit-1][0]}]},items:[]};
draft.book.catalog.description='Unit '+unit+' 文字待审阅；例句为原创，插图关联另行核对。';
const refs=[];
for(const [i,entry] of entries.entries()){
 const [word,sentence,translation,scene]=authored[i];if(word!==entry[1]||!sentence||!translation||!scene)throw Error('来源顺序或文字不符：'+entry[1]);
 const originalWords=source.vocabularyText.split('\n').filter(line=>line.startsWith('Unit '+unit+'|')).map(line=>line.split('|')[1]);
 const sourceWord=word==='Dan Dervish'?'Dan':word==='Teresa Lopez'?'Teresa':word==='Marc LeBlanc'?'Marc':word;
 const sourcePosition=unit===9&&word==='in total'?50:unit===11&&word==='prime'?47:originalWords.indexOf(sourceWord)+1;
 const itemId='pep-g9-2013-u'+unit+':'+String(sourcePosition).padStart(2,'0');
 draft.items.push({itemId,unitId:'pep-g9-2013-unit-'+unit,word,meaning:entry[2],scene,translation,exercise:model.exercise(sentence),images:{wide:[],mobile:[]}});
 refs.push({itemId,textbookPage:Number(entry[3]),originalGloss:entry[2],exampleOrigin:'原创例句',review:'pending'});
}
(async()=>{
 const errors=model.validate(draft,{requireImages:false});if(errors.length)throw Error(errors.join(';'));await model.compile(draft,{requireImages:false});
 const review='# Unit '+unit+' 文字审阅稿\n\n'+entries.length+' 个词，教材释义和顺序沿用原始词表，例句、译文和情境为原创。请审看英文自然度、译文准确性与目标词义。文字待确认，图片引用为空，尚未导入或发布。\n\n| 词条 | 教材释义 | 原创例句 | 译文 |\n|---|---|---|---|\n'+draft.items.map((item,i)=>'| '+item.word+' | '+item.meaning+' | '+authored[i][1].replace(/\[([^\]]+)\]/g,'**$1**')+' | '+item.translation+' |').join('\n')+'\n';
 console.log(JSON.stringify({[folder+'wordbook-draft.json']:JSON.stringify(draft,null,2)+'\n',[folder+'source-references.json']:JSON.stringify(refs,null,2)+'\n',[folder+'review.md']:review}));
})().catch(error=>{console.error(error.message);process.exitCode=1;});
