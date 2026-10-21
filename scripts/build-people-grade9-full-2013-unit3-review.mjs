import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import model from '../js/wordbook-draft.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'output/textbook-extractions/people-grade9-full-2013-20261015/unit3-pilot');
if(fs.existsSync(out))throw Error('Unit 3 目录已存在；保留已有材料。');
const authored=`
restroom|Where is the [restroom], please?|请问洗手间在哪里？|游客在公共场所寻找洗手间。
stamp|I put a [stamp] on the postcard.|我在明信片上贴了一张邮票。|把邮票贴在明信片右上角。
bookstore|We bought a map at the [bookstore].|我们在书店买了一张地图。|学生在书店挑选地图。
beside|The bookstore is [beside] the bank.|书店在银行旁边。|街道地图上书店紧挨着银行。
postcard|She sent me a [postcard] from China.|她从中国给我寄来一张明信片。|朋友展示刚收到的明信片。
pardon|[Pardon] me, could you say that again?|请再说一遍好吗？|在交谈中礼貌地请对方重复。
washroom|The [washroom] is on the second floor.|洗手间在二楼。|查看楼层指示牌寻找洗手间。
bathroom|There is a clean [bathroom] in the hotel room.|酒店房间里有一间干净的浴室。|旅行者打开酒店浴室的门。
normally|I [normally] walk to school.|我通常步行上学。|学生平常沿着熟悉的路线去学校。
rush|Please do not [rush] across the street.|请不要匆忙穿过马路。|行人停下来等绿灯，不急着过街。
pass by|We [pass by] the library on our way home.|我们回家路上会经过图书馆。|学生走过街角的图书馆。
staff|The hotel [staff] helped us find the elevator.|酒店工作人员帮我们找到了电梯。|工作人员指引客人前往电梯。
grape|A green [grape] fell from the bunch.|一颗青葡萄从葡萄串上掉下来。|桌上放着一串新鲜葡萄。
policeman|A [policeman] showed us the way to the station.|一位男警察给我们指了去车站的路。|警察在街边为行人指路。
central|The museum is in the [central] part of town.|博物馆位于镇中心。|地图突出显示镇中心的博物馆。
nearby|Is there a bus stop [nearby]?|附近有公交车站吗？|游客在街区地图上寻找附近的公交站。
pardon me|[Pardon me], could you tell me where the bank is?|不好意思，请问银行在哪里？|行人礼貌地向路人询问银行位置。
mail|I will [mail] the postcard today.|我今天会把明信片寄出去。|把写好的明信片投入邮筒。
east|The sun rises in the [east].|太阳从东方升起。|太阳从远处的东方地平线升起。
fascinating|The science museum has a [fascinating] space show.|科学博物馆有一场迷人的太空展。|孩子们被博物馆的太空展吸引。
inexpensive|This small gift is [inexpensive].|这件小礼物价格不贵。|顾客在价格牌旁挑选实惠的小礼物。
uncrowded|The park is quiet and [uncrowded] in the morning.|早上的公园安静而且人不多。|清晨的公园里只有少数散步的人。
convenient|The bus stop is [convenient] for our family.|这个公交站对我们一家来说很方便。|一家人从家门口方便地走到公交站。
mall|My sister and I went to the [mall].|我和姐姐去了购物中心。|姐妹俩在购物中心入口会合。
clerk|The [clerk] showed me the new books.|店员给我看了新书。|书店店员向顾客介绍新书。
corner|Turn left at the [corner].|在拐角处左转。|行人沿街走到路口拐角后左转。
politely|She [politely] asked for directions.|她礼貌地问了路。|学生面带微笑地向路人问路。
request|The visitor made a [request] for a city map.|这位游客请求给一张城市地图。|游客向服务台提出要一张地图。
direction|Can you point me in the right [direction]?|你能给我指一下正确的方向吗？|路人指向地图上的正确路线。
correct|This is the [correct] way to the station.|这是去车站的正确路线。|地图上清楚标出通往车站的路线。
polite|It is [polite] to say “please” when asking for help.|求助时说“请”是有礼貌的。|学生微笑着说“please”向老师求助。
direct|His answer was clear and [direct].|他的回答清楚而直接。|同学简洁清楚地回答问题。
speaker|The [speaker] answered questions after the talk.|演讲结束后，发言者回答了问题。|讲台上的发言者回应听众提问。
whom|To [whom] should I give this letter?|我应该把这封信交给谁？|学生拿着信询问应该交给哪位老师。
impolite|It is [impolite] to interrupt someone.|打断别人是不礼貌的。|交谈时一个人先举手等待对方说完。
address|Please write your home [address] on the form.|请在表格上写下你的家庭住址。|在表格的住址栏认真填写地址。
underground|We took the [underground] to the museum.|我们乘地铁去了博物馆。|乘客走进地铁站准备乘车。
parking lot|Dad left the car in the [parking lot].|爸爸把车停在停车场里。|汽车停在商场旁的停车场车位中。
course|She chose an art [course] after school.|她选了一门课后美术课程。|学生查看课程表并选择美术课。
Asian|The festival celebrates [Asian] art and music.|这个节日庆祝亚洲艺术和音乐。|展览展示亚洲传统乐器与艺术品。
deal|He knows how to [deal] with a difficult question.|他知道如何应对一个难题。|学生冷静思考并回答一道难题。
deal with|She learned to [deal with] her worries.|她学会了处理自己的烦恼。|学生把烦恼写下来并和老师交谈。
shyness|With practice, his [shyness] began to fade.|经过练习，他渐渐不再害羞。|学生练习后勇敢地在小组中开口。
dare|I did not [dare] to speak in front of the class.|我不敢在全班面前讲话。|学生站在讲台前深呼吸，准备发言。
ton|The truck can carry one [ton] of sand.|这辆卡车能运一吨沙子。|卡车装载一大堆沙袋，旁边标明重量。
private|Please keep this conversation [private].|请对这次谈话保密。|两位朋友在安静角落低声交谈。
guard|A [guard] stood at the museum entrance.|一名警卫站在博物馆入口处。|警卫在博物馆入口值守。
require|This job will [require] careful planning.|这项工作需要周密计划。|团队围着计划表安排各项任务。
European|We saw many [European] paintings at the museum.|我们在博物馆看到了许多欧洲绘画。|展厅中陈列着欧洲绘画作品。
African|The book tells stories from [African] countries.|这本书讲述非洲国家的故事。|学生阅读介绍非洲国家的图书和地图。
British|She enjoys reading [British] stories.|她喜欢读英国故事。|学生在图书馆挑选英国文学读物。
insect|A tiny [insect] landed on the leaf.|一只小昆虫落在叶子上。|近景展示叶片上的小昆虫。
ant|An [ant] carried a crumb across the ground.|一只蚂蚁把面包屑搬过地面。|蚂蚁拖着小面包屑前行。
speech|He gave a short [speech] at the school meeting.|他在学校集会上作了简短发言。|学生在讲台上对同学发表讲话。
public|The library is open to the [public].|这座图书馆向公众开放。|社区居民走进向公众开放的图书馆。
in public|She feels nervous speaking [in public].|她在公开场合讲话时会紧张。|学生在同学面前拿着讲稿练习发言。
spider|A small [spider] made a web near the window.|一只小蜘蛛在窗边结了网。|窗角有一张细致的蜘蛛网。
seldom|We [seldom] eat dinner outside.|我们很少在外面吃晚饭。|大多数晚上，一家人在家中餐桌旁吃饭。
influence|Good friends can [influence] each other.|好朋友会彼此影响。|朋友之间互相鼓励认真学习。
absent|Tom was [absent] from class yesterday.|汤姆昨天没来上课。|老师查看点名册，发现一个座位空着。
fail|Do not give up if you [fail] the first time.|第一次没成功也不要放弃。|学生第一次尝试失败后继续练习。
examination|We have an English [examination] next week.|我们下周有英语考试。|学生在课桌前认真参加考试。
boarding school|She lives at a [boarding school] during the term.|学期里她住在寄宿学校。|学生在寄宿学校的宿舍收拾书本。
Tim|[Tim] asked the teacher for help after class.|蒂姆课后向老师求助。|蒂姆在教室里课后向老师提问。
`.trim().split('\n').map(line=>line.split('|'));
const source=JSON.parse(fs.readFileSync(path.join(root,'docs/source-materials/people-grade9-full-2013.json'),'utf8'));
const rows=source.vocabularyText.split('\n').map(line=>line.split('|')).filter(row=>row[0]==='Unit 3');
if(rows.length!==authored.length||new Set(authored.map(row=>row[0])).size!==rows.length)throw Error(`Source/authored count mismatch: ${rows.length}/${authored.length}`);
const byWord=new Map(authored.map(row=>[row[0],row]));
const items=rows.map(([,word,meaning,page],i)=>{const row=byWord.get(word);if(!row)throw Error('Missing '+word);return {itemId:'pep-g9-2013-u3:'+String(i+1).padStart(2,'0'),unitId:'pep-g9-2013-unit-3',word,meaning,scene:row[3],translation:row[2],exercise:model.exercise(row[1]),images:{wide:[],mobile:[]}};});
const draft={schemaVersion:1,book:{bookId:'textbook-wordbook:pep-junior-grade9-full-2013-unit3-pilot',title:'人教版英语 九年级全一册（2013）·Unit 3 试点词书',catalog:{description:'Unit 3 文字审阅稿，共 64 条；原创例句、译文与画面说明待审核，插图待制作。',facets:{schoolStages:['初中'],publisherId:'人民教育出版社',seriesId:'人教版英语',edition:'2013',grades:['九年级'],volume:'全一册'}},units:[{unitId:'pep-g9-2013-unit-3',title:'Unit 3 Could you please tell me where the restrooms are?'}]},items};
const errors=model.validate(draft,{requireImages:false});if(errors.length)throw Error(errors.join('\n'));
const refs=rows.map((row,i)=>({itemId:items[i].itemId,textbookPage:Number(row[3]),originalGloss:row[2],exampleOrigin:'原创例句，待审核',reviewStatus:'待审核'}));
const review=['# 九年级全一册（2013）Unit 3 文字审阅稿','','共 64 条。词条及释义来自教材附录词表；页码是教材印刷页码。例句、译文和画面说明均为新编，尚未审核。插图尚未制作。','','| # | 词条 | 教材释义 | 教材页码 | 原创例句 | 中文译文 | 拟用画面 |','|---:|---|---|---:|---|---|---|',...items.map((item,i)=>`| ${i+1} | ${item.word} | ${item.meaning} | ${refs[i].textbookPage} | ${byWord.get(item.word)[1].replace(/\[([^\]]+)\]/g,'**$1**')} | ${item.translation} | ${item.scene} |`),'','状态：文字待审核；图片待制作；未导入、未发布。',''];
fs.mkdirSync(out,{recursive:true});
for(const [name,body] of [['wordbook-draft.json',JSON.stringify(draft,null,2)+'\n'],['source-references.json',JSON.stringify(refs,null,2)+'\n'],['review.md',review.join('\n')],['README.md','# Unit 3 试点词书\n\n来源：人教版《英语 九年级全一册》（2013）Unit 3，词表页码 17–30。共 64 条。教材词条与释义按已提供的词表转录；原创例句、译文与画面说明尚待用户审核。\n\n状态：文字待审核；通过后再按四格批量流程制作宽屏/手机版插图。每个浏览器交付文件必须严格小于 20,000 bytes。草稿编号独立于个人账号。\n\n未保存个人账号、未发布到公共课程库。\n']])fs.writeFileSync(path.join(out,name),body,{flag:'wx'});
console.log(JSON.stringify({directory:out,items:items.length,validationErrors:errors,reviewStatus:'待用户审核',images:'尚未生成'},null,2));
