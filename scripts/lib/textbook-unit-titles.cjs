'use strict';

// Match source section labels against the textbook contents, never array position.
function unitTitles(source) {
  const titles = new Map();
  for (const [title] of source.edition.contents) {
    const match = /^(Unit\s+\d+|Starter\s+Unit\s+\d+)\s+(.+)$/.exec(title);
    if (!match) continue;
    if (titles.has(match[1])) throw Error('Duplicate textbook unit: ' + match[1]);
    titles.set(match[1], title);
  }
  return section => {
    const title = titles.get(section);
    if (!title) throw Error('Missing complete textbook unit title: ' + section);
    return title;
  };
}

module.exports = { unitTitles };
