import { MistakeEvidence } from '../mistake-review/evidence.mjs';

function mergeLearningMarks(localMem, remoteMem, entityGone) {
  const local = localMem && typeof localMem === 'object' ? localMem : {};
  const remote = remoteMem && typeof remoteMem === 'object' ? remoteMem : {};
  const gone = entityGone && typeof entityGone === 'object' ? entityGone : {};
  const goneMastered = Array.isArray(gone.mastered) ? gone.mastered : [];
  const goneReinforce = Array.isArray(gone.reinforce) ? gone.reinforce : [];
  const goneDeleted = Array.isArray(gone.deletedItem) ? gone.deletedItem : [];

  const mastered = {};
  Object.keys(local.mastered || {}).forEach((key) => { mastered[key] = local.mastered[key]; });
  Object.keys(remote.mastered || {}).forEach((key) => { mastered[key] = remote.mastered[key]; });
  goneMastered.forEach((key) => { delete mastered[key]; });

  const deletedItems = {};
  Object.keys(local.deletedItems || {}).forEach((key) => {
    if (local.deletedItems[key]) deletedItems[key] = true;
  });
  Object.keys(remote.deletedItems || {}).forEach((key) => { deletedItems[key] = true; });
  goneDeleted.forEach((key) => { delete deletedItems[key]; });

  const goneReinforceSet = {};
  goneReinforce.forEach((key) => { goneReinforceSet[key] = 1; });
  const reinforceByKey = new Map();
  (Array.isArray(remote.reinforceBook) ? remote.reinforceBook : [])
    .concat(Array.isArray(local.reinforceBook) ? local.reinforceBook : [])
    .forEach((item) => {
      if (!item || !item._key || goneReinforceSet[item._key]) return;
      reinforceByKey.set(item._key, reinforceByKey.has(item._key)
        ? MistakeEvidence.mergeEvidenceRows(reinforceByKey.get(item._key), item)
        : MistakeEvidence.normalizeEvidenceRow(item));
    });
  const reinforceBook = [...reinforceByKey.values()];

  return { mastered, deletedItems, reinforceBook };
}

function findConflictingMasteredDeletes(localMem, syncedSignatures, entityGone, signatureOf) {
  const local = localMem && typeof localMem === 'object' ? localMem : {};
  const mastered = local.mastered && typeof local.mastered === 'object' ? local.mastered : {};
  const signatures = syncedSignatures && typeof syncedSignatures === 'object' ? syncedSignatures : null;
  const gone = entityGone && Array.isArray(entityGone.mastered) ? entityGone.mastered : [];
  const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  if (typeof signatureOf !== 'function') return gone.filter((key) => hasOwn(mastered, key));

  return [...new Set(gone)].filter((key) => {
    if (!hasOwn(mastered, key)) return false;
    /* Unknown baseline is treated conservatively: a local row may be a new,
       not-yet-uploaded re-mark. Only a row proven unchanged since cloud ack
       can be safely removed by the remote tombstone. */
    return !signatures || !hasOwn(signatures, key) || signatures[key] !== signatureOf(mastered[key]);
  });
}

export const CoreSyncMarks = Object.freeze({ mergeLearningMarks, findConflictingMasteredDeletes });
