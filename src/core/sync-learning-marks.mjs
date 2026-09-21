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
  const seen = {};
  const reinforceBook = [];
  (Array.isArray(remote.reinforceBook) ? remote.reinforceBook : [])
    .concat(Array.isArray(local.reinforceBook) ? local.reinforceBook : [])
    .forEach((item) => {
      if (!item || !item._key || seen[item._key] || goneReinforceSet[item._key]) return;
      seen[item._key] = 1;
      reinforceBook.push(item);
    });

  return { mastered, deletedItems, reinforceBook };
}

export const CoreSyncMarks = Object.freeze({ mergeLearningMarks });
