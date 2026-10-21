import test from 'node:test';
import assert from 'node:assert/strict';
import { fingerprint } from './model.mjs';
import { isSavedSession, recentUnfinishedSession } from './session-state.mjs';
async function saved(){const draft={book:{bookId:'fixture'},items:[{word:'book'}]};return {kind:'wordbook-authoring',draft,savedPersonal:{confirmed:true},savedSourceBookId:'fixture',savedFingerprint:await fingerprint(draft),context:null,rawResult:''};}
test('saved unchanged sessions are skipped without deleting the original',async()=>{const s=await saved();const before=JSON.stringify(s);assert.equal(await isSavedSession(s),true);assert.equal(await recentUnfinishedSession([s]),undefined);assert.equal(JSON.stringify(s),before);});
test('appended content, pending batches and unconfirmed saves stay resumable',async()=>{for(const change of [s=>s.draft.items.push({word:'pen'}),s=>s.context={requestId:'next'},s=>s.rawResult='pending',s=>s.savedPersonal.confirmed=false]){const s=await saved();change(s);assert.equal(await isSavedSession(s),false);assert.equal(await recentUnfinishedSession([s]),s);}});
test('material source participates in the save fingerprint',async()=>{const session=await saved();session.materialSource={libraryRef:{revision:'first'}};session.savedFingerprint=await fingerprint({draft:session.draft,materialSource:session.materialSource});assert.equal(await isSavedSession(session),true);session.materialSource.libraryRef.revision='second';assert.equal(await isSavedSession(session),false);assert.equal(await recentUnfinishedSession([session]),session);});
