var MainPracticePolicy = (() => {
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

  // scripts/main-practice-policy-entry.mjs
  var main_practice_policy_entry_exports = {};
  __export(main_practice_policy_entry_exports, {
    getAutoAdvanceDecision: () => getAutoAdvanceDecision,
    getNextLabel: () => getNextLabel
  });

  // src/main/practice-policy.mjs
  function getNextLabel(index, total) {
    return index + 1 >= total ? "\u67E5\u770B\u7ED3\u679C" : "\u4E0B\u4E00\u9898";
  }
  function getAutoAdvanceDecision(options = {}) {
    if (options.finished || !options.available) return { eligible: false, seconds: 0 };
    const wrongAttempts = Array.isArray(options.wrongAttempts) ? options.wrongAttempts : [];
    const status = Array.isArray(options.status) ? options.status : [];
    const flawed = wrongAttempts.some((count) => (count || 0) > 0) || Boolean(options.hinted) || status.some((value) => value === "bad" || value === "revealed");
    if (flawed) return { eligible: false, seconds: 0 };
    return { eligible: true, seconds: options.perfectThis ? 3 : 5 };
  }
  return __toCommonJS(main_practice_policy_entry_exports);
})();
