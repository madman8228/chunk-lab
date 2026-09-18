/* 图文课程填空题的候选词块规则。
 *
 * 注意：gaps[].choices 是“某个空位的局部备选答案”，不能直接当成底部词块池。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CourseCloze = factory();
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  function allGapChoices(gaps) {
    var choices = [];
    gaps.forEach(function (gap) {
      (gap && gap.choices || []).forEach(function (choice) { choices.push(choice); });
    });
    return choices;
  }

  function resolveDeclaredChoice(entry, allChoices) {
    if (typeof entry === 'string') {
      return allChoices.find(function (choice) { return choice && choice.id === entry; }) || null;
    }
    if (!entry || typeof entry !== 'object') return null;
    if (entry.choiceId) {
      return allChoices.find(function (choice) { return choice && choice.id === entry.choiceId; }) || null;
    }
    return entry.id && entry.text ? entry : null;
  }

  function buildWordBank(node) {
    var gaps = node && Array.isArray(node.gaps) ? node.gaps : [];
    var allChoices = allGapChoices(gaps);
    var declared = node && node.wordBank;
    var declaredItems = Array.isArray(declared) ? declared : declared && Array.isArray(declared.choices) ? declared.choices : null;

    /* 显式词块池是未来课程包的扩展点；引用可复用 gaps 中的 choice，也可直接携带新 choice。 */
    if (declaredItems) return declaredItems.map(function (entry) { return resolveDeclaredChoice(entry, allChoices); }).filter(Boolean);

    /* 默认词块池只放每个空位的正确答案；相同答案在不同空位出现时保留对应次数。 */
    return gaps.map(function (gap) {
      return (gap && gap.choices || []).find(function (choice) { return choice && choice.id === gap.correctChoiceId; }) || null;
    }).filter(Boolean);
  }

  return { buildWordBank: buildWordBank };
});
