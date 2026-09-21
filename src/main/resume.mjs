function deckItems(deck) {
  return deck && Array.isArray(deck.items) ? deck.items : [];
}

/*
 * Select the deck/index for the explicit direct-entry flow.  Rendering and
 * starting the practice session stay in main.html; this module only decides
 * which existing deck should be used.
 */
function selectResumeDeck(options) {
  var opts = options || {};
  var mem = opts.mem || {};
  var findDeck = typeof opts.findDeck === 'function' ? opts.findDeck : function () { return null; };
  var allDecks = typeof opts.allDecks === 'function' ? opts.allDecks : function () { return []; };
  var active = null;
  var activeId = typeof mem.activeDeckId === 'string' ? mem.activeDeckId : '';

  if (activeId) {
    var activeDeck = findDeck(activeId);
    if (activeDeck) {
      var progress = mem.progress && mem.progress[activeId];
      var index = progress && Number(progress.idx);
      if (Number.isInteger(index) && index > 0 && index < deckItems(activeDeck).length) {
        return { deck: activeDeck, index: index, resumed: true };
      }
      active = activeDeck;
    }
  }

  if (!active) {
    var best = null;
    var bestTime = 0;
    allDecks().forEach(function (deck) {
      var played = mem.best && mem.best[deck && deck.id] && mem.best[deck.id].lastPlayed || 0;
      if (played > bestTime) {
        bestTime = played;
        best = deck;
      }
    });
    active = best;
  }

  return { deck: active || allDecks()[0] || null, index: 0, resumed: false };
}

export { selectResumeDeck };
