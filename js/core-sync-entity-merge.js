(() => {
  // src/core/sync-entity-merge.mjs
  function safeRev(revisions, group, id) {
    const value = revisions && revisions[group] && revisions[group][id];
    return Number.isSafeInteger(value) && value >= 0 ? value : 0;
  }
  function copyRevisions(revisions) {
    const source = revisions && typeof revisions === "object" ? revisions : {};
    const result = {};
    Object.keys(source).forEach((group) => {
      result[group] = source[group] && typeof source[group] === "object" ? { ...source[group] } : {};
    });
    return result;
  }
  function mergeEntityList(localList, remoteList, localRevisions, remoteRevisions, group, idOf) {
    if (typeof idOf !== "function") throw new TypeError("entity list merge requires an id function");
    const local = Array.isArray(localList) ? localList : [];
    const remote = Array.isArray(remoteList) ? remoteList : [];
    const left = {};
    const right = {};
    const keys = [];
    const seen = {};
    local.forEach((item) => {
      const id = item && idOf(item);
      if (!id || seen[id]) return;
      seen[id] = 1;
      keys.push(id);
      left[id] = item;
    });
    remote.forEach((item) => {
      const id = item && idOf(item);
      if (!id) return;
      if (!seen[id]) {
        seen[id] = 1;
        keys.push(id);
      }
      right[id] = item;
    });
    const revisions = copyRevisions(localRevisions);
    if (!revisions[group]) revisions[group] = {};
    keys.forEach((id) => {
      const localRev = safeRev(localRevisions, group, id);
      const remoteRev = safeRev(remoteRevisions, group, id);
      if (right[id] && remoteRev > localRev) revisions[group][id] = remoteRev;
    });
    Object.keys(remoteRevisions && remoteRevisions[group] || {}).forEach((id) => {
      const remoteRev = safeRev(remoteRevisions, group, id);
      if (!right[id] && remoteRev > safeRev(localRevisions, group, id)) revisions[group][id] = remoteRev;
    });
    const value = keys.reduce((out, id) => {
      const localRev = safeRev(localRevisions, group, id);
      const remoteRev = safeRev(remoteRevisions, group, id);
      if (left[id] && (!right[id] || localRev >= remoteRev)) out.push(left[id]);
      else if (right[id] && (!left[id] || remoteRev >= localRev)) out.push(right[id]);
      return out;
    }, []);
    Object.keys(remoteRevisions && remoteRevisions[group] || {}).forEach((id) => {
      if (!right[id] && safeRev(remoteRevisions, group, id) > safeRev(localRevisions, group, id)) {
        const index = value.findIndex((item) => idOf(item) === id);
        if (index >= 0) value.splice(index, 1);
      }
    });
    return { value, revisions };
  }
  function mergeEntityMap(localMap, remoteMap, localRevisions, remoteRevisions, group) {
    const local = localMap && typeof localMap === "object" ? localMap : {};
    const remote = remoteMap && typeof remoteMap === "object" ? remoteMap : {};
    const keys = [];
    const seen = {};
    Object.keys(local).concat(Object.keys(remote)).forEach((id) => {
      if (seen[id]) return;
      seen[id] = 1;
      keys.push(id);
    });
    const revisions = copyRevisions(localRevisions);
    if (!revisions[group]) revisions[group] = {};
    const value = {};
    keys.forEach((id) => {
      const localRev = safeRev(localRevisions, group, id);
      const remoteRev = safeRev(remoteRevisions, group, id);
      if (Object.prototype.hasOwnProperty.call(remote, id) && remoteRev > localRev) revisions[group][id] = remoteRev;
      if (Object.prototype.hasOwnProperty.call(local, id) && (!Object.prototype.hasOwnProperty.call(remote, id) || localRev >= remoteRev)) value[id] = local[id];
      else if (Object.prototype.hasOwnProperty.call(remote, id) && (!Object.prototype.hasOwnProperty.call(local, id) || remoteRev >= localRev)) value[id] = remote[id];
    });
    Object.keys(remoteRevisions && remoteRevisions[group] || {}).forEach((id) => {
      if (!Object.prototype.hasOwnProperty.call(remote, id) && safeRev(remoteRevisions, group, id) > safeRev(localRevisions, group, id)) {
        delete value[id];
        revisions[group][id] = safeRev(remoteRevisions, group, id);
      }
    });
    return { value, revisions };
  }
  var CoreSyncEntities = Object.freeze({ mergeEntityList, mergeEntityMap });

  // scripts/core-sync-entity-merge-entry.mjs
  if (typeof globalThis !== "undefined") globalThis.CoreSyncEntities = CoreSyncEntities;
})();
