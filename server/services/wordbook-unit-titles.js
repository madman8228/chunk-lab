'use strict';

function directoryIdentity(book) {
  return JSON.stringify({ units: (book.units || []).map(({ unitId, itemIds }) => ({ unitId, itemIds })), items: book.items.map(ref => ref.itemId) });
}

// A title correction cannot silently authorize content, catalog or arrangement changes.
function sameContentExceptUnitTitles(before, after) {
  const normalized = book => {
    const { structureRevision, units, ...rest } = book;
    return { ...rest, units: (units || []).map(({ title, ...unit }) => unit) };
  };
  return JSON.stringify(normalized(before)) === JSON.stringify(normalized(after));
}

function sameContentExceptCatalog(before, after) {
  const { catalog: beforeCatalog, ...oldContent } = before;
  const { catalog: afterCatalog, ...newContent } = after;
  return JSON.stringify(oldContent) === JSON.stringify(newContent);
}

function sameLearningStructure(before, after) {
  const { catalog: beforeCatalog, ...oldContent } = before;
  const { catalog: afterCatalog, ...newContent } = after;
  return sameContentExceptUnitTitles(oldContent, newContent);
}

module.exports = { directoryIdentity, sameContentExceptUnitTitles, sameContentExceptCatalog, sameLearningStructure };
