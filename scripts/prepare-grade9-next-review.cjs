'use strict';
// Emits additive review artifacts; the caller saves them without replacing originals.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),model=require('../js/wordbook-draft');
const root=path.resolve(__dirname,'..'),base='output/textbook-extractions/people-grade9-full-2013-20261015';
const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8')),hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const authored=`
humorous|Our teacher is [humorous] and often makes us laugh.|我们的老师很幽默，经常逗得我们发笑。|老师讲了个笑话，学生们笑起来。
silent|Please keep [silent] while others are reading.|别人阅读时，请保持安静。|学生们在图书馆安静地看书。
helpful|Your advice was very [helpful].|你的建议很有帮助。|同学向朋友提出解决问题的建议。
from time to time|I visit my old school [from time to time].|我时不时会回母校看看。|毕业生偶尔回学校探望老师。
score|Our team needs one more point to make the [score] even.|我们队还需要一分才能把比分扳平。|篮球比赛中，两队比分相差一分。
background|Tell me a little about your family [background].|跟我简单说说你的家庭背景吧。|学生在交谈中介绍自己的家庭情况。
interview|I have a job [interview] tomorrow.|我明天有一场求职面试。|求职者准备参加面试。
in person|You need to sign the form [in person].|你需要亲自签这张表。|本人来到服务台签署表格。
exactly|This is [exactly] what I need.|这正是我需要的东西。|学生找到完全符合需要的工具。
pride|She takes great [pride] in her work.|她对自己的工作感到十分自豪。|学生展示自己用心完成的作品。
take pride in|We [take pride in] keeping our school clean.|我们为能保持校园整洁而自豪。|学生们自豪地看着一起打扫干净的校园。
proud|My parents are [proud] of me.|我的父母为我感到骄傲。|父母祝贺孩子取得进步。
be proud of|You should [be proud of] your progress.|你应该为自己的进步感到自豪。|老师鼓励看到自己进步的学生。
general|The guide gave us a [general] idea of the museum's history.|导游让我们大致了解了博物馆的历史。|导游向参观者简要介绍博物馆历史。
introduction|Please write a short [introduction] to your hometown.|请写一段简短的家乡介绍。|学生撰写家乡介绍。
Paula|[Paula] is helping a classmate with her homework.|葆拉正在帮助一位女同学做作业。|名叫葆拉的学生帮助同学。
Alfred|[Alfred] is carrying a box of books into the classroom.|艾尔弗雷德正把一箱书搬进教室。|名叫艾尔弗雷德的学生搬运书箱。
Billy|[Billy] is making his friends laugh.|比利正逗得朋友们发笑。|名叫比利的学生逗朋友们开心。
Candy|[Candy] is answering a reporter's questions.|坎迪正在回答记者的问题。|名叫坎迪的女孩接受记者采访。
Jerry|[Jerry] is waiting quietly outside the classroom.|杰里正在教室外安静地等候。|名叫杰里的学生安静等待。
Emily|[Emily] is introducing herself to her new classmates.|埃米莉正在向新同学介绍自己。|名叫埃米莉的学生进行自我介绍。
`.trim().split('\n').map(line=>line.split('|'));
async function build(){
 const artifacts={};
 for(const unit of [2,3]){
  const sourcePath=base+'/unit'+unit+'-pilot/wordbook-draft.json',source=read(sourcePath),draft=structuredClone(source),assets=[];
  for(const item of draft.items){
   const url=item.images.wide.find(url=>url.endsWith('.webp'));if(!url)throw Error('Missing wide WebP '+item.itemId);
   const bytes=fs.readFileSync(path.join(root,url));if(bytes.length>=20000||bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WEBP')throw Error('Invalid delivery '+url);
   item.images={wide:[url],mobile:[url]};assets.push({itemId:item.itemId,url,bytes:bytes.length,sha256:hash(bytes)});
  }
  const errors=model.validate(draft);if(errors.length)throw Error(errors.join(';'));
  await model.compile(draft);
  const target=base+'/unit'+unit+'-pilot/wordbook-draft-shared-webp-v1.json';
  artifacts[target]=JSON.stringify(draft,null,2)+'\n';
  artifacts[target.replace('.json','-report.json')]=JSON.stringify({source:sourcePath,sourceSha256:hash(fs.readFileSync(path.join(root,sourcePath))),itemCount:draft.items.length,deliveryFiles:new Set(assets.map(a=>a.url)).size,maxBytes:Math.max(...assets.map(a=>a.bytes)),status:'draft-reference-normalization-only',assets},null,2)+'\n';
 }
 const source=read('docs/source-materials/people-grade9-full-2013.json'),entries=source.vocabularyText.split('\n').filter(line=>line.startsWith('Unit 4|')).map(line=>line.split('|'));
 if(entries.length!==authored.length)throw Error('Unit 4 count mismatch');
 const template=read(base+'/unit1-pilot/wordbook-draft-shared-webp-v1.json');
 const draft={schemaVersion:1,book:{bookId:'textbook-wordbook:pep-junior-grade9-full-2013-unit4-review',title:'人教版英语 九年级全一册（2013）·Unit 4 文字审阅稿',catalog:structuredClone(template.book.catalog),units:[{unitId:'pep-g9-2013-unit-4',title:source.edition.contents[3][0]}]},items:[]};
 draft.book.catalog.description='Unit 4 文字审阅稿，例句为新编，待用户审看；已有插图待逐项匹配后关联。';
 const refs=[];
 for(const [index,entry] of entries.entries()){
  const [word,sentence,translation,scene]=authored[index];if(word!==entry[1])throw Error('Source order mismatch '+word);
  const itemId='pep-g9-2013-u4:'+String(index+1).padStart(2,'0');
  draft.items.push({itemId,unitId:'pep-g9-2013-unit-4',word,meaning:entry[2],scene,translation,exercise:model.exercise(sentence),images:{wide:[],mobile:[]}});
  refs.push({itemId,textbookPage:Number(entry[3]),originalGloss:entry[2],exampleOrigin:'原创例句',review:'pending'});
 }
 const errors=model.validate(draft,{requireImages:false});if(errors.length)throw Error(errors.join(';'));await model.compile(draft,{requireImages:false});
 const folder=base+'/unit4-review-v1/';artifacts[folder+'wordbook-draft.json']=JSON.stringify(draft,null,2)+'\n';artifacts[folder+'source-references.json']=JSON.stringify(refs,null,2)+'\n';
 artifacts[folder+'review.md']='# Unit 4 文字审阅稿\n\n21 个词，来源于人教版九年级全一册（2013）的既有单元词表。教材释义保持原样；下列表达和译文为新编，不是教材原句。重点看英文是否自然、译文是否准确，以及是否符合你希望教的词义。人名句用于认识名字，不代表史实。\n\n| 词条 | 教材释义 | 原创例句 | 译文 |\n|---|---|---|---|\n'+draft.items.map((item,index)=>'| '+item.word+' | '+item.meaning+' | '+authored[index][1].replace(/\[([^\]]+)\]/g,'**$1**')+' | '+item.translation+' |').join('\n')+'\n\n状态：待文字审看。现有配图保留，未重新生成，尚未关联到此文本稿；未导入或发布。\n';
 console.log(JSON.stringify(artifacts));
}
build().catch(error=>{console.error(error.message);process.exitCode=1;});
