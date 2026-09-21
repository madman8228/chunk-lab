/* Pure course continuation decision. Catalog lookup and progress calculation stay in main.html. */
export function chooseCourseNavigation(states, deckId) {
  const list = Array.isArray(states) ? states : [];
  const currentIndex = list.findIndex((state) => state
    && state.lesson
    && state.lesson.contentRef
    && state.lesson.contentRef.id === deckId);
  if (currentIndex < 0) return null;

  const current = list[currentIndex];
  const order = list.slice(currentIndex + 1).concat(list.slice(0, currentIndex));
  const next = order.find((state) => state && state.deck && !state.complete) || null;
  return {
    currentIndex,
    current,
    next,
    allComplete: list.length > 0 && list.every((state) => state && state.complete),
  };
}
