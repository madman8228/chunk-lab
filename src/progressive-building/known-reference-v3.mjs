import { nounPhrase } from './noun-phrase-v3.mjs';
const span = (start, end, label) => ({ start, end, label, level: 0 });
const phrase = [span(0, 2, '名词短语')];
const clause = [span(0, 1, '主语'), span(1, 2, '谓语'), span(2, 4, '宾语')];
export const knownReference = {
 id: 'known-reference-preview', label: 'PB05 · the 与已知对象（已打磨）', knowledgeNode: 'PB05', prerequisites: ['PB04'],
 objectives: ['根据双方能否确定对象选择a或the', '理解再次提到同一对象的指称', '在新对象和共同语境中迁移'], sentenceStepIndexes: [1, 4, 7],
 words: { i: nounPhrase.words.i, you: nounPhrase.words.you, need: nounPhrase.words.need, a: nounPhrase.words.a, bag: nounPhrase.words.bag,
  the: { en: 'the', zh: '双方明确的那个', part: '冠词' }, book: { en: 'book', zh: '书', part: '名词', visualSceneId: 'book' } },
 sentence: { wordIds: ['you', 'need', 'the', 'bag'], zh: '你需要刚才那个包。' },
 sequence: [
  { meaning: '一个包', prompt: '你出门需要一个包，只说明有这个需要，没有指定具体哪一个。', wordIds: ['a', 'bag'], bankWordIds: ['a', 'bag'], dependsOn: [], annotations: phrase, visual: { sceneId: 'bag', show: 'after-correct' }, learningNote: { term: '不定冠词 a：泛指一个', question: '这里是在说一个包，还是双方已明确的那个包？', answer: '只是一个包，不特指哪一个', explanation: 'a 是不定冠词，这里表示泛指：说的是一个包，不特指双方已经明确的某个包。a bag 是“一个包”；在 I need a bag 中，只说需要一个包，并没有要求对方认出是哪一个。a 本身不表示“有”或“存在”，是否存在、是否需要由整句表达。' } },
  { meaning: '我需要一个包', prompt: '只是说需要一个包，没有指定具体哪一个；这里是泛指，不是特指某个包。', wordIds: ['i', 'need', 'a', 'bag'], bankWordIds: ['i', 'need', 'a', 'bag'], dependsOn: [0], annotations: clause, visual: { sceneId: 'i-need-bag', show: 'after-correct' }, learningNote: { term: '泛指：没有指定哪一个', question: '我需要的是某个指定的包吗？', answer: '没有指定，只说需要一个包', explanation: '泛指，就是只说需要这一类东西中的一个，没有指定具体哪一个。I need a bag 只表达我需要一个包，不是在说双方已经认出的那个包；这里的 a 就表示这种不特指的意思。整个 a bag 作宾语。' } },
  { type: 'classify', meaning: '刚才说的那个包', prompt: '你接着说同一个包，对方已知道你指哪个。选 a 还是 the？', wordIds: ['bag'], focusWordId: 'bag', dependsOn: [1], annotations: [], answer: 'the', options: [
   { id: 'a', key: 'a', label: 'a bag', feedback: 'a bag 仍是在引入一个未明确的包。这次指刚才同一个包，对方已能确定，所以用 the bag。关键是对象能被确定，不只是出现次数。' },
   { id: 'the', key: 't', label: 'the bag', feedback: 'the bag 指双方已经能确定的包。这里就是刚才说过的同一个包。' } ] },
  { meaning: '刚才那个包', prompt: '继续指刚才说过的同一个包，对方已明确是哪一个。', wordIds: ['the', 'bag'], bankWordIds: ['the', 'bag'], dependsOn: [2], annotations: phrase, clearSentenceResultOnComplete: true, visual: { sceneId: 'bag', show: 'after-correct' }, learningNote: { term: '定冠词 the', question: 'the 告诉听话人什么？', answer: '你能确定我指的对象', explanation: 'the 是定冠词，表示听话人能根据当前语境确定是哪一个。这里的 the bag 指先前引入的同一个包；它不表示包本身换了样子。' } },
  { meaning: '我需要刚才那个包', prompt: '仍是刚才同一个包，现在明确说我需要它。', wordIds: ['i', 'need', 'the', 'bag'], bankWordIds: ['i', 'need', 'the', 'bag'], dependsOn: [1, 3], annotations: clause, visual: { sceneId: 'i-need-bag', show: 'after-correct' }, successFeedback: 'a 在这里泛指一个包，the 特指双方能确定的那个包。改变的是指称方式，不是数量或物品种类；整个 the bag 仍作宾语。' },
  { type: 'classify', meaning: '双方都看见的那本书', prompt: '你们都看着桌上唯一的一本书，第一次开口就指它。选哪个？', wordIds: ['book'], focusWordId: 'book', dependsOn: [4], annotations: [], answer: 'the', options: [
   { id: 'a', key: 'a', label: 'a book', feedback: '这里双方已经知道指的是桌上唯一那本书，即使第一次开口，也可以用 the book。the 不要求必须先说过一次。' },
   { id: 'the', key: 't', label: 'the book', feedback: '双方都能确定是桌上唯一那本书，所以第一次提到也能用 the book。' } ] },
  { type: 'classify', meaning: '另一个尚未说明的包', prompt: '换到新话题：你还需要另一个包，但尚未说明是哪一个。如何引入？', wordIds: ['bag'], focusWordId: 'bag', dependsOn: [5], annotations: [], answer: 'a', options: [
   { id: 'the', key: 't', label: 'the bag', feedback: '听话人还无法确定这个新包。先用 a bag 引入；不是只要前面出现过 bag，以后所有包都用 the。' },
   { id: 'a', key: 'a', label: 'a bag', feedback: '这是另一个尚未明确的包，用 a bag 引入。判断的是当前指哪个对象。' } ] },
  { meaning: '你需要刚才那个包', prompt: '回到起初双方已明确的同一个包：现在是你需要它。', wordIds: ['you', 'need', 'the', 'bag'], bankWordIds: ['you', 'need', 'the', 'bag'], dependsOn: [6], annotations: clause, visual: { sceneId: 'you-need-bag', show: 'after-correct' }, successFeedback: '主语换成 You，the bag 仍指起初双方明确的那个包。' },
  { type: 'transfer', meaning: '你需要那本书', prompt: '语境：双方都清楚指的是哪本书。请表达上面的意思。', wordIds: ['you', 'need', 'the', 'book'], dependsOn: [7], annotations: clause, answers: ['You need the book.'], visual: { sceneId: 'you-need-book', show: 'after-correct' }, successFeedback: '双方能根据共同场景确定是哪本书，所以用 the book。整个 the book 是 need 的宾语。' },
 ],
};
