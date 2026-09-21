(() => {
  // src/core/identity.mjs
  function fnv8(value) {
    let hash = 2166136261;
    const text = String(value == null ? "" : value);
    for (let index = 0; index < text.length; index += 1) {
      hash = Math.imul(hash ^ text.charCodeAt(index), 16777619) >>> 0;
    }
    return hash.toString(16).padStart(8, "0");
  }
  function cidOf(item) {
    if (!item) return "";
    if (item.cid) return String(item.cid);
    return fnv8(item.sentence || item.en || "");
  }
  function cidKey(deckId, item) {
    return String(deckId) + "#" + cidOf(item);
  }
  function moveKeyToCid(key) {
    const match = /^([^#]+)#(.+)$/.exec(String(key == null ? "" : key));
    if (!match || /^[0-9a-f]{8}$/.test(match[2])) return key;
    return match[1] + "#" + fnv8(match[2]);
  }
  var CoreIdentity = Object.freeze({ fnv8, cidOf, cidKey, moveKeyToCid });

  // scripts/core-identity-entry.mjs
  if (typeof globalThis !== "undefined") globalThis.CoreIdentity = CoreIdentity;
})();
