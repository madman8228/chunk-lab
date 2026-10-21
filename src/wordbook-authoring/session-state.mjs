import { fingerprint } from './model.mjs';

// A receipt alone is not completion: appended or pending work must remain resumable.
export async function isSavedSession(session) {
  if (!session?.savedPersonal?.confirmed || !session.savedFingerprint ||
      session.savedSourceBookId !== session.draft?.book?.bookId || session.context ||
      String(session.rawResult || '').trim()) return false;
  return await fingerprint(session.materialSource?{draft:session.draft,materialSource:session.materialSource}:session.draft) === session.savedFingerprint;
}

export async function recentUnfinishedSession(sessions) {
  for (const session of sessions) {
    if (session.kind === 'wordbook-authoring' && !await isSavedSession(session)) return session;
  }
  return undefined;
}
