/* Pure boot state: keep first-paint and entry-claim decisions out of main.html. */
export function createBootCoordinator(options = {}) {
  const entryRequested = options.entryRequested === true;
  let booted = false;
  let localPainted = false;
  let entryClaimed = false;

  return Object.freeze({
    shouldPaintLocal() {
      return !booted && !localPainted && !entryRequested;
    },
    markLocalPainted() {
      if (booted || localPainted || entryRequested) return false;
      localPainted = true;
      return true;
    },
    markBooted() {
      booted = true;
      return true;
    },
    claimEntry() {
      entryClaimed = true;
      return true;
    },
    isBooted() {
      return booted;
    },
    isEntryClaimed() {
      return entryClaimed;
    },
    snapshot() {
      return { entryRequested, booted, localPainted, entryClaimed };
    },
  });
}
