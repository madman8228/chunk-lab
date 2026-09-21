var MainCourseNavigation = (() => {
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

  // scripts/main-course-navigation-entry.mjs
  var main_course_navigation_entry_exports = {};
  __export(main_course_navigation_entry_exports, {
    chooseCourseNavigation: () => chooseCourseNavigation
  });

  // src/main/course-navigation.mjs
  function chooseCourseNavigation(states, deckId) {
    const list = Array.isArray(states) ? states : [];
    const currentIndex = list.findIndex((state) => state && state.lesson && state.lesson.contentRef && state.lesson.contentRef.id === deckId);
    if (currentIndex < 0) return null;
    const current = list[currentIndex];
    const order = list.slice(currentIndex + 1).concat(list.slice(0, currentIndex));
    const next = order.find((state) => state && state.deck && !state.complete) || null;
    return {
      currentIndex,
      current,
      next,
      allComplete: list.length > 0 && list.every((state) => state && state.complete)
    };
  }
  return __toCommonJS(main_course_navigation_entry_exports);
})();
