var MainPracticeClassification = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // scripts/main-practice-classification-entry.mjs
  var main_practice_classification_entry_exports = {};
  __export(main_practice_classification_entry_exports, {
    classifyStat: () => classifyStat,
    hasMasteredKey: () => hasMasteredKey,
    isDueStat: () => isDueStat,
    isFluencyStat: () => isFluencyStat,
    rankOfClassify: () => rankOfClassify
  });

  // src/main/practice-classification.mjs
  function classifyStat(stat) {
    if (!stat || !stat.times) return "unseen";
    const accuracy = stat.okTimes / stat.times;
    if (stat.times >= 3 && accuracy >= 0.8) return "master";
    if (accuracy < 0.6) return "weak";
    return "learn";
  }
  function rankOfClassify(classification) {
    return classification === "weak" ? 0 : classification === "unseen" ? 1 : classification === "learn" ? 2 : 3;
  }
  function isFluencyStat(stat) {
    return Boolean(stat && stat.okTimes >= 3 && stat.streak >= 3);
  }
  function hasMasteredKey(mastered, key) {
    return Boolean(mastered && key && mastered[key]);
  }
  function isDueStat(stat, isDue) {
    return typeof isDue === "function" && isDue(stat) === true;
  }
  return __toCommonJS(main_practice_classification_entry_exports);
})();
