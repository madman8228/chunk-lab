import contract from '../../js/vocabulary-course-contract.js';
export function validId(id) { return typeof id === 'string' && !['__proto__','constructor','prototype'].includes(id) && /^[A-Za-z0-9:._-]{1,160}$/.test(id); }
export function validateIndex(index, { allowItemVersions = false } = {}) {
  if (index?.schemaVersion !== 1 || !Array.isArray(index.books)) throw new Error('单词本索引格式无效');
  const books = new Set(), revisions = new Map(),files=new Map();
  for (const book of index.books) {
    if (!validId(book.bookId) || books.has(book.bookId) || !/^[a-f0-9]{64}$/.test(book.revision || '') ||
        typeof book.title !== 'string' || !book.title.trim() || !Array.isArray(book.items) || !book.items.length || book.itemCount !== book.items.length) throw new Error('单词本身份或版本无效');
    contract.validateBookStructure(book);
    books.add(book.bookId);
    const items = new Set();
    for (const ref of book.items) {
      if (!validId(ref.itemId) || items.has(ref.itemId) || !/^[a-f0-9]{64}$/.test(ref.contentRevision || '') ||
          !allowItemVersions && revisions.has(ref.itemId) && revisions.get(ref.itemId) !== ref.contentRevision) throw new Error('教学项目身份或版本冲突');
      items.add(ref.itemId); revisions.set(ref.itemId, ref.contentRevision);
      const fileId=ref.itemId.replace(/:/g,'_');if(files.has(fileId)&&files.get(fileId)!==ref.itemId)throw new Error('教学项目文件身份冲突');files.set(fileId,ref.itemId);
    }
  }
  return index;
}
export function pageBounds(offset = 0, limit = 20) {
  offset = Number(offset); limit = Number(limit);
  if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 50) throw new Error('分页参数无效');
  return { offset, limit };
}
export function pageBook(book, offset = 0, limit = 20) {
  const page = pageBounds(offset, limit);
  return { bookId: book.bookId, revision: book.revision, title: book.title, itemCount: book.itemCount,
    items: book.items.slice(page.offset, page.offset + page.limit), nextOffset: page.offset + page.limit < book.itemCount ? page.offset + page.limit : null };
}
