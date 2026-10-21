export function nextCursor(book, itemId) {
  const index = book.items.findIndex(item => item.itemId === itemId);
  if (index < 0) throw new Error('项目不属于当前单词本');
  const next = book.items[index + 1];
  return { itemId: next?.itemId || null, status: next ? 'active' : 'completed' };
}
export function initialCursor(book) { return { itemId: book.items[0]?.itemId || null, status: book.items.length ? 'active' : 'completed' }; }
