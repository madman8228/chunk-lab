import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import draftModel from '../js/wordbook-draft.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(root, 'docs/source-materials/people-grade9-full-2013.json');
const reviewPath = path.join(root, 'output/textbook-extractions/people-grade9-full-2013-20261015/review.md');
const outDir = path.join(root, 'output/textbook-extractions/people-grade9-full-2013-20261015/unit1-pilot');
try {
  await access(path.join(outDir, 'wordbook-draft.json'));
  throw new Error('Refusing to overwrite existing pilot draft: ' + outDir);
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

const authored = [
  ['textbook', 'I keep my [textbook] in my schoolbag.', '我把课本放在书包里。', '上学前整理书包，准备带上课本。'],
  ['conversation', 'We had a short [conversation] after class.', '我们课后聊了一会儿。', '下课后和同学简单交谈。'],
  ['aloud', 'Please read the sentence [aloud].', '请把这个句子大声读出来。', '老师请你朗读句子，让大家都听见。'],
  ['pronunciation', 'I want to improve my [pronunciation].', '我想改进我的发音。', '练习英语时，希望把发音说得更清楚。'],
  ['sentence', 'Please write one [sentence] about your hobby.', '请写一个关于你爱好的句子。', '英语练习要求你用一句话介绍爱好。'],
  ['patient', 'Be [patient] and try the question again.', '耐心一点，再试一次这道题。', '题目有点难，提醒自己别着急。'],
  ['secret', 'This is a [secret], so please don’t tell anyone.', '这是个秘密，所以请不要告诉任何人。', '朋友告诉你一件暂时不能公开的事。'],
  ['expression', '“By the way” is a useful English [expression].', '“顺便说一下”是一个有用的英语表达。', '学习一段常用的英语说法。'],
  ['discover', 'You can [discover] new words while reading.', '阅读时你可以发现新单词。', '读故事时遇到以前没见过的词。'],
  ['look up', 'I [look up] new words in a dictionary.', '我在词典里查生词。', '阅读时不认识一个词，于是查词典。'],
  ['grammar', 'We are learning English [grammar] today.', '我们今天在学英语语法。', '英语课上练习句子结构和规则。'],
  ['repeat', 'Could you [repeat] the question, please?', '你能把问题再说一遍吗？', '没听清问题，请对方重复一次。'],
  ['note', 'She wrote a [note] to remember the new word.', '她写了个笔记来记住这个新单词。', '把重要内容简短记下来，方便复习。'],
  ['pal', 'My pen [pal] lives in another city.', '我的笔友住在另一个城市。', '你和住在外地的朋友通过信件联系。'],
  ['physics', '[Physics] helps us understand light and sound.', '物理帮助我们理解光和声音。', '课堂上学习光、声音等自然现象。'],
  ['chemistry', 'We did a safe [chemistry] experiment at school.', '我们在学校做了一个安全的化学实验。', '在老师指导下观察物质变化。'],
  ['memorize', 'I use short sentences to [memorize] new words.', '我用短句来记单词。', '用自己喜欢的方法把新词记牢。'],
  ['pattern', 'I noticed a [pattern] in these sentences.', '我注意到这些句子有一个规律。', '比较几个句子，发现重复出现的结构。'],
  ['novel', 'She borrowed a [novel] from the library.', '她从图书馆借了一本长篇小说。', '选择一本长篇故事书带回家读。'],
  ['pronounce', 'How do you [pronounce] this word?', '这个单词怎么发音？', '遇到一个新词，向老师询问读法。'],
  ['increase', 'Reading every day can [increase] your vocabulary.', '每天阅读可以增加你的词汇量。', '坚持阅读后，认识的单词变多了。'],
  ['speed', 'I read at a comfortable [speed].', '我以合适的速度阅读。', '做阅读练习时注意快慢，不要太赶。'],
  ['review', 'Let’s [review] the words before the quiz.', '我们在小测前复习一下这些单词吧。', '测验前重新学习已经学过的内容。'],
  ['partner', 'My [partner] and I practice English together.', '我和搭档一起练习英语。', '两人一组互相练习对话。'],
  ['born', 'My sister was [born] in spring.', '我妹妹出生在春天。', '介绍一个人出生的时间。'],
  ['be born with', 'Some people are [born with] a strong sense of rhythm.', '有些人天生节奏感很强。', '描述一个人与生俱来的能力或特点。'],
  ['ability', 'Practice can improve your [ability] to listen.', '练习可以提高你的听力能力。', '通过练习让自己更会听懂英语。'],
  ['create', 'Let’s [create] a story with these words.', '我们用这些单词创作一个故事吧。', '和同学一起想出一个新故事。'],
  ['brain', 'A good night’s sleep helps your [brain] work well.', '睡个好觉有助于大脑正常工作。', '讨论睡眠和大脑状态的关系。'],
  ['active', 'She is an [active] learner who asks questions.', '她是个积极提问的学习者。', '课堂上主动参与、积极思考。'],
  ['attention', 'Please give your [attention] to the speaker.', '请注意听讲话的人。', '大家安静下来，把注意力放在发言者身上。'],
  ['pay attention to', 'Please [pay attention to] the spelling.', '请注意拼写。', '检查单词时特别留意字母顺序。'],
  ['connect', 'This road [connects] the school and the library.', '这条路连接学校和图书馆。', '说明两个地方由一条路连在一起。'],
  ['connect ... with', 'I [connect] new words [with] pictures to remember them.', '我把新单词和图片联系起来记忆。', '用图片帮助自己建立词语联想。'],
  ['overnight', 'The garden did not change [overnight].', '花园不是一夜之间就改变的。', '说明进步或变化需要时间，不会突然发生。'],
  ['knowledge', 'Books can give us useful [knowledge].', '书籍能给我们有用的知识。', '通过阅读学习新的事实和信息。'],
  ['lifelong', 'Learning can be a [lifelong] journey.', '学习可以是一段终身的旅程。', '表达学习会伴随人的一生。'],
  ['wisely', 'Use your study time [wisely].', '明智地利用你的学习时间。', '安排时间时做出合适的选择。'],
  ['Annie', '[Annie] is reading with her study partner.', '安妮正在和学习搭档一起阅读。', '课文人物安妮正在学习。'],
  ['Alexander Graham Bell', '[Alexander Graham Bell] is listed in the textbook as a famous inventor.', '课本把亚历山大·格雷厄姆·贝尔列为一位著名发明家。', '课本专名条目；原图中姓名分行排版。']
];

const source = JSON.parse(await readFile(sourcePath, 'utf8'));
const review = await readFile(reviewPath, 'utf8');
if (!review.includes('| Unit 1 | Alexander Graham Bell |')) throw new Error('审核稿中的姓名更正未确认，停止生成。');
const sourceRows = source.vocabularyText.split('\n').map(line => {
  const [unit, word, meaning, page] = line.split('|');
  return { unit, word, meaning, page: Number(page) };
}).filter(row => row.unit === 'Unit 1');
if (sourceRows.length !== authored.length) throw new Error(`Unit 1 条目数不一致：来源 ${sourceRows.length}，编写 ${authored.length}`);
const byWord = new Map(sourceRows.map(row => [row.word, row]));

const items = authored.map(([sourceWord, markedSentence, translation, scene], index) => {
  const sourceKey = sourceWord === 'Alexander Graham Bell' ? 'Alexander Bell' : sourceWord;
  const sourceRow = byWord.get(sourceKey);
  if (!sourceRow) throw new Error('来源词条不存在：' + sourceWord);
  const word = sourceWord;
  const sentence = markedSentence.replace(/\[([^\]]+)\]/g, (_match, answer) => '[' + answer + ']');
  const parts = [];
  let cursor = 0;
  const blank = /\[([^\]]+)\]/g;
  let match;
  let blankIndex = 0;
  while ((match = blank.exec(sentence))) {
    if (match.index > cursor) parts.push({ text: sentence.slice(cursor, match.index) });
    const answer = match[1];
    parts.push({ id: 'blank' + (++blankIndex), label: answer, answers: [answer] });
    cursor = blank.lastIndex;
  }
  if (cursor < sentence.length) parts.push({ text: sentence.slice(cursor) });
  const item = {
    itemId: 'pep-g9-2013-u1:' + String(index + 1).padStart(2, '0'),
    unitId: 'pep-g9-2013-unit-1',
    word,
    meaning: sourceRow.meaning,
    scene,
    translation,
    exercise: { version: 1, parts },
    images: { wide: [], mobile: [] }
  };
  return item;
});

const draft = {
  schemaVersion: 1,
  book: {
    bookId: 'textbook-wordbook:pep-junior-grade9-full-2013-unit1-pilot',
    title: '人教版英语 九年级全一册（2013）·Unit 1 试点词书',
    catalog: {
      description: 'Unit 1 文字试点稿，共 40 条；例句为原创，语境与译文已由用户审核通过。插图未配。',
      facets: {
        schoolStages: ['初中'], publisherId: '人民教育出版社', seriesId: '人教版英语',
        edition: '2013', grades: ['九年级'], volume: '全一册'
      }
    },
    units: [{ unitId: 'pep-g9-2013-unit-1', title: 'Unit 1 How can we become good learners?' }]
  },
  items
};

const errors = draftModel.validate(draft, { requireImages: false });
if (errors.length) throw new Error(errors.join('\n'));
await mkdir(outDir, { recursive: true });
await writeFile(path.join(outDir, 'wordbook-draft.json'), JSON.stringify(draft, null, 2) + '\n', 'utf8');
await writeFile(path.join(outDir, 'source-references.json'), JSON.stringify(items.map((item, index) => ({
  itemId: item.itemId, textbookPage: sourceRows[index].page,
  originalGloss: sourceRows[index].meaning, exampleOrigin: '原创例句'
})), null, 2) + '\n', 'utf8');
const reviewLines = [
  '# Unit 1 文字试点审阅表', '',
  '教材词义和来源页码沿用已校对转录稿；例句、语境和译文均为新编，不是教材原句。请重点审阅这些新编内容是否自然、是否准确体现目标词义。', '',
  '| # | 词条 | 教材释义 | 原书页码 | 原创例句 | 译文 |',
  '|---:|---|---|---:|---|---|'
];
for (let i = 0; i < items.length; i++) {
  const item = items[i];
  const sentence = item.exercise.parts.map(part => part.text ?? `**${part.answers[0]}**`).join('');
  reviewLines.push(`| ${i + 1} | ${item.word} | ${item.meaning} | ${sourceRows[i].page} | ${sentence} | ${item.translation} |`);
}
reviewLines.push('', '状态：语境与译文已由用户审核通过；插图尚未制作；未导入、未发布。', '');
await writeFile(path.join(outDir, 'review.md'), reviewLines.join('\n'), 'utf8');
await writeFile(path.join(outDir, 'README.md'), [
  '# Unit 1 试点词书（文字内容已审，待配图）', '',
  '来源：人民教育出版社《英语 九年级全一册》（2013），教材附录 Words and Expressions in Each Unit，Unit 1。', '',
  `共 ${items.length} 条，教材页码 1–6。所有学习例句均为原创，不是教材原句；词义沿用已校对转录稿。`,
  'Alexander Graham Bell 已按用户核对结果补全姓名。', '',
  '## 当前状态', '',
  '- 仅生成独立草稿文件；未导入个人账号、未写入学习记录、未发布公共词书。',
  '- wide/mobile 插图引用为空，因此这是文字预览稿，不满足正式入库/上架校验。每张浏览器插图须小于 20,000 bytes。',
  '- 例句、语境和译文已由用户审核通过；专名 Annie 与 Alexander Graham Bell 暂作为辅助条目保留。',
  '- 可通过“制作单词本 → 恢复草稿”导入到编辑器仅作预览；若已有未保存草稿，先下载留存。不要点保存或发布。', '',
  '## 校验', '',
  `- 词条数：${items.length}；对应来源 Unit 1 条目数一致。`,
  '- 草稿结构校验：通过（不要求插图的文字草稿模式）。',
  '- 正式素材校验：未通过/未运行，因插图尚未制作。', ''
].join('\n'), 'utf8');
console.log(JSON.stringify({ output: outDir, items: items.length, errors, images: 'pending' }, null, 2));
