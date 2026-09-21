/* Stable sentence identity helpers. Keep this module free of browser/storage state. */
export function fnv8(value) {
  let hash = 0x811c9dc5;
  const text = String(value == null ? '' : value);
  for (let index = 0; index < text.length; index += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(index), 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function cidOf(item) {
  if (!item) return '';
  if (item.cid) return String(item.cid);
  return fnv8(item.sentence || item.en || '');
}

export function cidKey(deckId, item) {
  return String(deckId) + '#' + cidOf(item);
}

export function moveKeyToCid(key) {
  const match = /^([^#]+)#(.+)$/.exec(String(key == null ? '' : key));
  if (!match || /^[0-9a-f]{8}$/.test(match[2])) return key;
  return match[1] + '#' + fnv8(match[2]);
}

export const CoreIdentity = Object.freeze({ fnv8, cidOf, cidKey, moveKeyToCid });
