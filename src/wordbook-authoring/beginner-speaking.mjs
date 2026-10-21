import draftModel from '../../js/wordbook-draft.js';

// Local review artifact only. No account reads, writes, imports or publishing.
export const courseSources = [
  { resourceId: 'course:user-deck:ai-cc2f02e4-1f56-484c-b98b-db5ae284c4d2', file: 'output/course-drafts/beginner-speaking-pilot/lesson-1.json', title: '第一次见面' },
  { resourceId: 'course:user-deck:ai-5bcd5642-f91b-48df-824a-44429b551ede', file: 'output/course-drafts/beginner-speaking-pilot/lesson-2.json', title: '身边的人和物' }
];

// lesson, source line (one-based), word head, meaning, explicit blank, scene/use note.
const rows = [
  [1, 1, 'hi', '嗨；你好', '[Hi]!', '刚见到朋友，用 hi 打个招呼。Hello 也是自然的问候；本题练习 hi。'],
  [1, 9, 'good', '好的；本句表示状态不错', "I'm [good], thanks.", '朋友询问近况，你说自己很好。这里 good 表示状态好；本题练习 good。'],
  [1, 2, 'morning', '早晨；上午', 'Good [morning]!', '早上见到同学，问候“早上好”。morning 指早晨或上午。'],
  [1, 5, 'name', '名字', "What's your [name]?", '初次见面，询问对方的名字。name 指名字。'],
  [1, 6, 'meet', '认识；见面', 'Nice to [meet] you.', '初次认识对方，说“很高兴认识你”。再次见到熟人常用 Nice to see you；这里练习 meet。'],
  [1, 6, 'nice', '令人愉快的', '[Nice] to meet you.', '初次见面，用 Nice to meet you 表达认识对方很愉快；本题练习 nice。'],
  [1, 8, 'you', '你；你们', 'How are [you]?', '向面前的人询问近况。you 可以指你，也可以指你们；本句不表示“你的”。'],
  [1, 9, 'thanks', '谢谢', "I'm good, [thanks].", '别人关心你的近况，你回答自己很好并道谢。thanks 是简短的道谢；thank you 也自然。'],
  [1, 10, 'see', '见；看见', '[See] you later!', '与朋友告别，用 See you later 表达“回头见”。本题练习 see，不必逐词硬译。'],
  [1, 10, 'later', '之后；稍后', 'See you [later]!', '临时告别，说“回头见”。later 指之后，不指定具体钟点。'],
  [2, 1, 'this', '这个；这（通常指近处的单个事物）', '[This] is a book.', '手边有一本书，你介绍这本书。this 通常指近处的一个人或事物。'],
  [2, 2, 'that', '那个；那（通常指远处的单个事物）', '[That] is a bag.', '你指着远处的一个包，介绍那个包。that 通常指远处的一个人或事物。'],
  [2, 3, 'what', '什么', "[What]'s this?", "看着手边的物品，询问它是什么。What's 是 What is 的缩写；本题填写 what，后面的 's 已给出。"],
  [2, 10, 'who', '谁', '[Who] is that?', '你指着远处的一个人，询问那是谁。问人是谁用 who，问物品是什么用 what。'],
  [2, 1, 'book', '书', 'This is a [book].', '你拿着一本书，介绍“这是一本书”。book 是单数可数名词，这里保留 a。'],
  [2, 2, 'bag', '包；袋子', 'That is a [bag].', '你指着远处的一个包。bag 在本句为单数，前面用 a。'],
  [2, 4, 'pen', '笔', "It's a [pen].", "别人问手边物品是什么，你回答“这是一支笔”。It's 是 It is 的缩写。"],
  [2, 5, 'phone', '电话；本句指手机', 'Is this your [phone]?', '你拿起一部手机，问是不是对方的。your phone 表示“你的手机”，不加 a。'],
  [2, 8, 'key', '钥匙', 'These are my [keys].', '你指着手边的几把钥匙。词头是 key，本句需要复数 keys；填 keys，不填 key。'],
  [2, 9, 'shoe', '鞋', 'Those are your [shoes].', '你指着远处的一双鞋。词头是 shoe，本句需要复数 shoes；填 shoes，不填 shoe。'],
  [2, 8, 'my', '我的', 'These are [my] keys.', '介绍手边属于自己的几把钥匙。my 表示“我的”，放在名词前，不等于“我”。'],
  [2, 5, 'your', '你的；你们的', 'Is this [your] phone?', '询问这部手机是否属于对方。your 表示“你的”，放在 phone 前，不写成 you。']
];

export function createBeginnerSpeakingDraft() {
  return {
    schemaVersion: 1,
    book: {
      bookId: 'beginner-speaking-companion-v1',
      title: '零基础开口 · 配套单词本',
      catalog: { description: '配套前两课的 22 个词。待审文字稿；不含发音录音或插图，不代表已掌握。', facets: {} },
      relatedCourseIds: courseSources.map(source => source.resourceId),
      units: courseSources.map((source, index) => ({ unitId: 'beginner-unit-' + (index + 1), title: source.title }))
    },
    items: rows.map(([lesson, line, word, meaning, sentence, scene]) => {
      const exercise = draftModel.exercise(sentence);
      if (word === 'hi') exercise.parts.find(part => part.answers).answers.push('Hello');
      if (word === 'thanks') exercise.parts.find(part => part.answers).answers.push('thank you');
      if (word === 'key' || word === 'shoe') exercise.parts.find(part => part.answers).feedback = [{
        values: [word], message: '这里说多个事物，请填写复数 ' + (word === 'key' ? 'keys' : 'shoes') + '。'
      }];
      return {
        itemId: 'beginner-word:' + word,
        unitId: 'beginner-unit-' + lesson,
        word, meaning, scene,
        translation: sourceTranslations[lesson - 1][line - 1],
        exercise,
        images: { wide: [], mobile: [] }
      };
    })
  };
}

const sourceTranslations = [
  ['嗨！', '早上好！', '我叫亚历克斯。', '我叫小梅。', '你叫什么名字？', '很高兴认识你。', '我也很高兴认识你。', '你好吗？', '我很好，谢谢。', '回头见！'],
  ['这是一本书。', '那是一个包。', '这是什么？', '这是一支笔。', '这是你的手机吗？', '是的。', '不是。', '这些是我的钥匙。', '那些是你的鞋。', '那是谁？']
];

export function beginnerSourceMapping() {
  return rows.map(([lesson, line, word]) => ({
    itemId: 'beginner-word:' + word,
    courseResourceId: courseSources[lesson - 1].resourceId,
    sourceFile: courseSources[lesson - 1].file,
    sourceLine: line,
    sourceContentId: courseSources[lesson - 1].resourceId.slice('course:user-deck:'.length) + ':line:' + String(line).padStart(3, '0')
  }));
}
