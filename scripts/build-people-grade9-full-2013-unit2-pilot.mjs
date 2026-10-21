import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import model from '../js/wordbook-draft.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'output/textbook-extractions/people-grade9-full-2013-20261015/unit2-pilot');
if(fs.existsSync(out))throw Error('目标目录已存在，保留已有草稿。');
// Original learning sentences. Brackets mark answers, not textbook quotations.
const authored=`
mooncake|We shared a [mooncake] after dinner.|晚饭后，我们分着吃了一块月饼。|家人围坐桌边分享月饼。
lantern|She hung a red [lantern] by the door.|她在门边挂了一盏红灯笼。|用红灯笼装饰家门。
stranger|Do not give your home address to a [stranger].|不要把你的家庭住址告诉陌生人。|提醒同学保护个人信息。
relative|A [relative] is coming to stay with us.|一位亲戚要来我们家住。|准备迎接来访的亲戚。
put on|I do not want to [put on] weight.|我不想长胖。|讨论体重变化。
pound|This bag of apples weighs one [pound].|这袋苹果重一磅。|用秤称一小袋苹果。
folk|My grandfather knows many [folk] stories.|我爷爷知道许多民间故事。|听爷爷讲民间流传的故事。
goddess|The painting shows a [goddess] beside the moon.|这幅画画了一位在月亮旁边的女神。|观看神话主题的画作。
whoever|[Whoever] finishes first can choose the next game.|不管谁先完成，都可以选择下一个游戏。|说明大家都适用的游戏规则。
steal|It is wrong to [steal] someone else's things.|偷别人的东西是不对的。|讨论尊重他人物品的规则。
lay|Please [lay] the cards on the table.|请把卡片放在桌上。|把手中的卡片平放到桌面。
lay out|Let's [lay out] the plates before dinner.|我们在晚饭前把盘子摆好吧。|为家庭晚餐布置餐桌。
dessert|We had fruit for [dessert].|我们饭后吃了水果作为甜点。|晚餐后端上水果。
garden|We planted flowers in the [garden].|我们在花园里种了花。|和家人一起种花。
tradition|Making dumplings together is a family [tradition].|一起包饺子是我们家的传统。|家人延续每年一起包饺子的习惯。
admire|I [admire] my sister for her patience.|我很佩服姐姐的耐心。|姐姐耐心帮助别人，令人敬佩。
treat|Let's [treat] our guests to some tea.|我们请客人喝些茶吧。|为来访的客人倒茶。
tie|He chose a blue [tie] for his father.|他给爸爸选了一条蓝色领带。|在礼物店挑选领带。
dinosaur|We saw a huge [dinosaur] model at the museum.|我们在博物馆看到了一个巨大的恐龙模型。|参观博物馆的恐龙展区。
mushroom|There is a [mushroom] under the tree.|树下有一朵蘑菇。|散步时观察树下的蘑菇。
togetherness|Cooking together gives us a feeling of [togetherness].|一起做饭让我们感受到亲密无间。|家人一起准备饭菜。
happiness|Her face was full of [happiness] when she opened the gift.|打开礼物时，她满脸幸福。|收到礼物后露出开心的笑容。
lunar|We watched a video about the [lunar] surface.|我们看了一段关于月球表面的视频。|课堂上观看月球表面的影像。
riddle|Can you solve this [riddle]?|你能猜出这个谜语吗？|朋友递来一张谜语卡片。
celebration|The school held a [celebration] for its birthday.|学校为校庆举办了一场庆祝活动。|师生一起参加校庆活动。
firework|A bright [firework] lit up the sky.|一朵明亮的烟花照亮了天空。|抬头观看夜空中的烟花。
take place|The concert will [take place] in the park.|音乐会将在公园举行。|查看公园音乐会的活动安排。
gather|Our family will [gather] for dinner tonight.|今晚我们一家人将聚在一起吃饭。|家人陆续来到餐桌旁。
count down|Let's [count down] from ten to one.|我们从十倒数到一吧。|大家一起等待新年钟声。
suggest|I [suggest] taking a picnic to the park.|我建议带上野餐食物去公园。|朋友一起商量周末活动。
custom|Giving small gifts is a local [custom].|赠送小礼物是当地的一种习俗。|了解当地人交换礼物的习惯。
involve|The game will [involve] everyone in the class.|这个游戏将让全班每个人都参与。|老师说明全班一起参与的游戏。
crowd|A large [crowd] waited outside the theater.|一大群人在剧院外等候。|剧院门口聚集了等待入场的人。
bottom|My keys are at the [bottom] of my bag.|我的钥匙在包的最底部。|翻找包底的钥匙。
dust|Please wipe the [dust] off the shelf.|请擦掉架子上的灰尘。|用布清理积灰的架子。
couplet|We put a red [couplet] on each side of the door.|我们在门的两边各贴了一条红色对联。|家人一起贴春联。
set off|We watched the professionals [set off] fireworks.|我们观看专业人员燃放烟花。|在安全观看区域欣赏专业烟花表演。
eve|We cooked a big meal on the [eve] of the festival.|我们在节日前夜做了一顿丰盛的饭菜。|家人在节日前夜准备大餐。
express|A card can help you [express] your thanks.|一张卡片可以帮你表达感谢。|写卡片感谢帮助过自己的人。
reunion|We took a photo at our family [reunion].|我们在家庭团聚时拍了一张照片。|久别重逢的一家人合影。
mark|Please [mark] the date on your calendar.|请在日历上标出这个日期。|在日历上圈出重要的一天。
smell|I can [smell] fresh bread from the kitchen.|我能闻到厨房里新鲜面包的香味。|刚出炉的面包散发香味。
breeze|A cool [breeze] came through the open window.|一阵凉爽的微风从敞开的窗户吹进来。|窗帘在轻风中微微飘动。
picnic|We had a [picnic] beside the lake.|我们在湖边野餐。|在湖边铺开野餐垫和食物。
coming|We are making plans for the [coming] holiday.|我们正在为即将到来的假期做计划。|查看日历，商量假期安排。
Egypt|My aunt sent me a postcard from [Egypt].|我阿姨从埃及给我寄了一张明信片。|读一张来自埃及的旅行明信片。
Scottish|He played a [Scottish] tune on the violin.|他用小提琴演奏了一首苏格兰曲调。|聆听一段苏格兰风格的音乐。
Water Festival|We watched a video about the [Water Festival].|我们看了一段关于泼水节的视频。|观看节日里人们互相泼水祝福的画面。
Mid-Autumn Festival|We shared mooncakes during the [Mid-Autumn Festival].|中秋节期间，我们一起分享了月饼。|家人赏月并分享月饼。
Mother's Day|I made a card for my mother on [Mother's Day].|母亲节那天，我为妈妈做了一张卡片。|亲手制作母亲节贺卡。
Father's Day|We cooked breakfast for Dad on [Father's Day].|父亲节那天，我们为爸爸做了早餐。|为爸爸准备节日早餐。
Spring Festival|We decorated our home for the [Spring Festival].|我们为春节装饰了家里。|一家人用红色饰物装点房间。
Big Ben|She drew a picture of [Big Ben].|她画了一幅大本钟的画。|根据建筑照片画大本钟。
Auld Lang Syne|They sang [Auld Lang Syne] at the end of the party.|聚会结束时，他们唱了《友谊地久天长》。|朋友在聚会结束时一起唱歌。
Times Square|The photo shows a busy street near [Times Square].|这张照片展示了时代广场附近一条繁忙的街道。|观看纽约时代广场附近的街景照片。
Sham El-Nessim|Our class made a poster about [Sham El-Nessim].|我们班制作了一张关于埃及闻风节的海报。|课堂上制作介绍节日的海报。
Macau|My cousin lives in [Macau].|我的表亲住在澳门。|在地图上指出表亲居住的澳门。
Chiang Mai|We found [Chiang Mai] on the map.|我们在地图上找到了清迈。|查看泰国地图，寻找清迈。
Clara|[Clara] helped us hang the lanterns.|克拉拉帮我们挂灯笼。|同学们一起布置节日灯笼。
`.trim().split('\n').map(line=>line.split('|'));
const source=JSON.parse(fs.readFileSync(path.join(root,'docs/source-materials/people-grade9-full-2013.json'),'utf8'));
const rows=source.vocabularyText.split('\n').map(line=>line.split('|')).filter(row=>row[0]==='Unit 2');
if(rows.length!==authored.length||new Set(authored.map(row=>row[0])).size!==rows.length)throw Error('来源与编写条目数不一致');
const authoredByWord=new Map(authored.map(row=>[row[0],row]));
const items=rows.map(([,word,meaning,page],i)=>{
 const row=authoredByWord.get(word);if(!row)throw Error('缺少词条：'+word);
 return {itemId:'pep-g9-2013-u2:'+String(i+1).padStart(2,'0'),unitId:'pep-g9-2013-unit-2',word,meaning,scene:row[3],translation:row[2],exercise:model.exercise(row[1]),images:{wide:[],mobile:[]}};
});
const draft={schemaVersion:1,book:{bookId:'textbook-wordbook:pep-junior-grade9-full-2013-unit2-pilot',title:'人教版英语 九年级全一册（2013）·Unit 2 试点词书',catalog:{description:'Unit 2 文字草稿，共 59 条；原创例句、语境与译文待审，插图待制作。',facets:{schoolStages:['初中'],publisherId:'人民教育出版社',seriesId:'人教版英语',edition:'2013',grades:['九年级'],volume:'全一册'}},units:[{unitId:'pep-g9-2013-unit-2',title:'Unit 2 I think that mooncakes are delicious!'}]},items};
const errors=model.validate(draft,{requireImages:false});if(errors.length)throw Error(errors.join('\n'));
const references=rows.map((row,i)=>({itemId:items[i].itemId,textbookPage:Number(row[3]),originalGloss:row[2],exampleOrigin:'原创例句',reviewStatus:'待审核'}));
const review=['# 九年级全一册（2013）Unit 2 文字审阅表','','共 59 条，词条与教材词义沿用已校对来源；以下例句、译文和情境为新编，待用户审核。空格答案以粗体标出。配图尚未制作。','','| # | 词条 | 教材释义 | 教材页码 | 原创例句 | 中文译文 | 情境 |','|---:|---|---|---:|---|---|---|',...items.map((item,i)=>`| ${i+1} | ${item.word} | ${item.meaning} | ${references[i].textbookPage} | ${authoredByWord.get(item.word)[1].replace(/\[([^\]]+)\]/g,'**$1**')} | ${item.translation} | ${item.scene} |`),'','状态：文字待审；图片待制作；未导入、未发布。',''];
fs.mkdirSync(out,{recursive:true});
for(const [name,body] of [['wordbook-draft.json',JSON.stringify(draft,null,2)+'\n'],['source-references.json',JSON.stringify(references,null,2)+'\n'],['review.md',review.join('\n')],['README.md','# Unit 2 试点词书\n\n来源：人教版《英语 九年级全一册》（2013）Unit 2，附录词表 pp.157–158；词条标注教材页码 9–14。\n\n共 59 条，包括节日、地名和人名。原创例句、译文与情境待审核。\n\n审阅文件：review.md；编辑器草稿：wordbook-draft.json；来源对应：source-references.json。\n\n文字结构校验通过；插图为空，尚未完成图文课程。插图后续沿用宽屏/手机版规格，每个交付文件严格小于 20,000 bytes。\n\n生成独立草稿；未改动 Unit 1，未导入账号或发布。\n']])fs.writeFileSync(path.join(out,name),body,{flag:'wx'});
console.log(JSON.stringify({directory:out,items:items.length,validationErrors:errors,reviewStatus:'待审',images:'待制作'},null,2));
