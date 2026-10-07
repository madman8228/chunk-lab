'use strict';
// Historical recovery is tested explicitly, outside normal learning startup.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const {gunzipSync,gzipSync} = require('node:zlib');
const Database = require('../../server/node_modules/better-sqlite3');
module.exports = async function(page,dataDir){
  await require('./legacy-recovery-fixture').mountRecoveryControls(page);
    const archiveDb = new Database(path.join(dataDir, 'chunklab.db'));
    try {
      const archives = archiveDb.prepare('SELECT source_id,source_hash,codec,payload_blob,manifest_json FROM user_recovery_sources WHERE user_id=1').all();
      assert.equal(archives.length, 1, 'explicit fixture setup archives the source once');
      assert.equal(archives[0].codec, 'gzip');
      const manifest = JSON.parse(archives[0].manifest_json);
      assert.equal(manifest.verified, true);
      assert.equal(manifest.state, 'merged', 'a verified baseline is imported for a demonstrably empty server account');
      assert.equal(manifest.migration.status, 'applied');
      assert.match(manifest.migration.requestId, /^recovery_[a-f0-9]{40}$/);
      assert.ok(archives[0].payload_blob.length > 0);

      // A second verified legacy archive must not overwrite a server account
      // after the first baseline and learning events have been committed.
      const secondSource = JSON.parse(gunzipSync(archives[0].payload_blob).toString('utf8'));
      secondSource.capturedAt = '2026-10-03T12:00:00.000Z';
      const secondRaw = Buffer.from(JSON.stringify(secondSource));
      const secondHash = createHash('sha256').update(secondRaw).digest('hex');
      const secondSourceId = 'test-second-legacy-source';
      archiveDb.prepare(`INSERT INTO user_recovery_sources
        (user_id,source_id,source_hash,codec,payload_blob,manifest_json) VALUES(?,?,?,?,?,?)`).run(
        1, secondSourceId, secondHash, 'gzip', gzipSync(secondRaw), JSON.stringify({
          version: 1, state: 'archived-not-merged', verified: true, sourceId: secondSourceId,
          sourceHash: secondHash, legacyReceipts: [],
        }));

      const selectionSource = JSON.parse(gunzipSync(archives[0].payload_blob).toString('utf8'));
      delete selectionSource.syncResolution;
      selectionSource.capturedAt = '2026-10-03T12:30:00.000Z';
      selectionSource.stores = Object.assign({}, selectionSource.stores, {
        pendingOperations: [], syncMeta: [], syncIntents: [],
      });
      const recoveryMem = JSON.parse(selectionSource.localStorage['chunklab.v1']);
      const recoveryDeck = {
        id: 'recovery-only-deck', name: '仅在恢复来源中的课程', builtin: false,
        items: [{ cid: 'recovery-only-sentence', sentence: 'This sentence exists only in recovery.',
          translation: '这句话仅存在于恢复来源。', chunks: ['This sentence exists only in recovery.'], alts: [[]], hints: [] }],
      };
      recoveryMem.decks = (recoveryMem.decks || []).concat(recoveryDeck,
        Array.from({ length: 205 }, function (_, index) {
          return Object.assign({}, recoveryDeck, {
            id: 'recovery-page-' + (index + 1), name: '恢复分页题库 ' + (index + 1),
            items: recoveryDeck.items.map(function (item) { return Object.assign({}, item); })
          });
        }));
      selectionSource.localStorage['chunklab.v1'] = JSON.stringify(recoveryMem);
      const selectionRaw = Buffer.from(JSON.stringify(selectionSource));
      const selectionHash = createHash('sha256').update(selectionRaw).digest('hex');
      const selectionSourceId = 'test-selected-recovery-source';
      archiveDb.prepare(`INSERT INTO user_recovery_sources
        (user_id,source_id,source_hash,codec,payload_blob,manifest_json) VALUES(?,?,?,?,?,?)`).run(
        1, selectionSourceId, selectionHash, 'gzip', gzipSync(selectionRaw), JSON.stringify({
          version: 1, state: 'archived-not-merged', verified: true, sourceId: selectionSourceId,
          sourceHash: selectionHash, legacyReceipts: [],
        }));

      const unknownSource = JSON.parse(JSON.stringify(selectionSource));
      unknownSource.capturedAt = '2026-10-03T12:45:00.000Z';
      unknownSource.stores.pendingOperations = [{ requestId: 'unknown-live-operation-restore-01' }];
      const unknownMem = JSON.parse(unknownSource.localStorage['chunklab.v1']);
      unknownMem.decks = unknownMem.decks.filter(deck => deck.id !== 'recovery-only-deck' &&
        !deck.id.startsWith('recovery-page-'));
      unknownMem.decks.push({ id: 'recovery-safe-despite-unknown-op', name: '未知旧操作之外的题库', items: [] });
      unknownSource.localStorage['chunklab.v1'] = JSON.stringify(unknownMem);
      const unknownRaw = Buffer.from(JSON.stringify(unknownSource));
      const unknownHash = createHash('sha256').update(unknownRaw).digest('hex');
      const unknownSourceId = 'test-unknown-operation-selective-recovery';
      archiveDb.prepare(`INSERT INTO user_recovery_sources
        (user_id,source_id,source_hash,codec,payload_blob,manifest_json) VALUES(?,?,?,?,?,?)`).run(
        1, unknownSourceId, unknownHash, 'gzip', gzipSync(unknownRaw), JSON.stringify({
          version: 1, state: 'archived-not-merged', verified: true, sourceId: unknownSourceId,
          sourceHash: unknownHash,
          legacyReceipts: [{ requestId: 'unknown-live-operation-restore-01', receipt: 'unknown', kind: 'operation', seq: null }],
        }));
    } finally { archiveDb.close(); }
    const refusedOverwrite = await page.evaluate(async sourceId => {
      const path = '/api/recovery/' + encodeURIComponent(sourceId);
      const preview = await ChunkAPI.request(path + '/preview', { method: 'POST' });
      if (preview.eligible !== false) throw new Error('server preview should detect existing confirmed account data');
      return ChunkAPI.request(path + '/apply', { method: 'POST', body: JSON.stringify(preview) });
    }, 'test-second-legacy-source');
    assert.equal(refusedOverwrite.state, 'retained');
    assert.equal(refusedOverwrite.reason, 'server-not-empty',
      'actual persisted learning rows block any later baseline replacement regardless of the sequence sentinel');
    const manualImportPreview = await page.evaluate(async () => {
      const backup = await ChunkAPI.exportData();
      const prepared = await LegacyRecovery.prepareImportedBackup(backup);
      return { eligible: prepared.preview.eligible, reason: prepared.preview.reason,
        sourceHash: prepared.preview.sourceHash, seq: prepared.preview.expectedSeq };
    });
    assert.equal(manualImportPreview.eligible, false,
      'manual backup import into an account with current data is previewed and refused, not swapped into a local namespace');
    assert.equal(manualImportPreview.reason, 'server-not-empty');
    assert.match(manualImportPreview.sourceHash, /^[a-f0-9]{64}$/);

    page.once('dialog', dialog => dialog.accept());
    await page.locator('#btnSettingsTop').click();
    assert.equal(await page.locator('#legacyLocalRestoreControls').isHidden(), true,
      'protocol 3 does not expose the legacy local-version switch that can lead to account conflict handling');
    await page.locator('#backupHead').click();
    assert.equal(await page.locator('#recoveryCenter').isVisible(), true,
      'server-authoritative accounts receive the server recovery center instead');
    await page.locator('#recoverySourcesRefresh').click();
    const selectableSource = page.locator('[data-recovery-source-id="test-selected-recovery-source"]');
    await selectableSource.waitFor({ state: 'visible', timeout: 10000 });
    await selectableSource.getByRole('button', { name: /预览/ }).click();
    const recoverDeckChoice = selectableSource.locator('input[data-recovery-group="decks"][data-recovery-id="recovery-only-deck"]');
    await recoverDeckChoice.waitFor({ state: 'visible', timeout: 10000 });
    assert.equal(await selectableSource.getByRole('button', { name: /恢复所选内容/ }).isDisabled(), true,
      'recovery cannot be submitted until the user explicitly selects a safe item');
    if (process.env.CHUNKLAB_RECOVERY_SCREENSHOT_DIR) {
      const screenshotDir = path.resolve(process.env.CHUNKLAB_RECOVERY_SCREENSHOT_DIR);
      fs.mkdirSync(screenshotDir, { recursive: true });
      await page.locator('#settingsMask .modal').screenshot({ path: path.join(screenshotDir, 'recovery-center-desktop.png') });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.locator('#settingsMask .modal').screenshot({ path: path.join(screenshotDir, 'recovery-center-mobile.png') });
      await page.setViewportSize({ width: 1280, height: 900 });
    }
    await recoverDeckChoice.check();
    await selectableSource.getByRole('button', { name: /恢复所选内容（1）/ }).click();
    await page.waitForFunction(async () => {
      const snapshot = await ChunkAPI.getData();
      return snapshot.mem.decks.some(deck => deck.id === 'recovery-only-deck');
    }, null, { timeout: 15000 });
    const recoveredDeckDb = new Database(path.join(dataDir, 'chunklab.db'), { readonly: true });
    try {
      assert.ok(recoveredDeckDb.prepare('SELECT id FROM user_decks WHERE user_id=1 AND id=? AND deleted_at IS NULL')
        .get('recovery-only-deck'), 'the selected disjoint recovery item reaches the authoritative SQLite database');
      assert.equal(recoveredDeckDb.prepare('SELECT name FROM user_decks WHERE user_id=1 AND id=? AND deleted_at IS NULL')
        .get('server-answer').name, '服务端答题验收', 'recovery leaves the existing cloud deck unchanged');
      const recoveryManifest = JSON.parse(recoveredDeckDb.prepare('SELECT manifest_json FROM user_recovery_sources WHERE user_id=1 AND source_id=?')
        .get('test-selected-recovery-source').manifest_json);
      assert.equal(recoveryManifest.migration.items['decks/recovery-only-deck'].status, 'applied');
    } finally { recoveredDeckDb.close(); }
    await selectableSource.getByRole('button', { name: /预览/ }).click();
    await page.waitForFunction(function () {
      var source = document.querySelector('[data-recovery-source-id="test-selected-recovery-source"]');
      var button = source && source.querySelector('.recovery-source-head button');
      return button && button.textContent === '重新预览' && source.querySelectorAll('.recovery-preview-item').length > 0;
    }, null, { timeout: 15000 });
    const firstRecoveryPageCount = await page.evaluate(function () {
      var source = document.querySelector('[data-recovery-source-id="test-selected-recovery-source"]');
      return source ? source.querySelectorAll('.recovery-preview-item').length : -1;
    });
    assert.equal(firstRecoveryPageCount, 200,
      'the recovery center bounds its first render to 200 items instead of inserting every archived course into the DOM; preview: ' +
      (await selectableSource.innerText()));
    const showMoreRecoveryDecks = selectableSource.getByRole('button', { name: /显示更多题库/ });
    assert.equal(await showMoreRecoveryDecks.isVisible(), true,
      'the recovery center exposes an explicit next page for safe additions beyond the first 200');
    await showMoreRecoveryDecks.click();
    const lastPagedRecoveryChoice = selectableSource.locator(
      'input[data-recovery-group="decks"][data-recovery-id="recovery-page-205"]');
    await lastPagedRecoveryChoice.waitFor({ state: 'visible', timeout: 10000 });
    await lastPagedRecoveryChoice.check();
    page.once('dialog', dialog => dialog.accept());
    await selectableSource.getByRole('button', { name: /恢复所选内容（1）/ }).click();
    await page.waitForFunction(async () => {
      const snapshot = await ChunkAPI.getData();
      return snapshot.mem.decks.some(deck => deck.id === 'recovery-page-205');
    }, null, { timeout: 15000 });
    const pagedRecoveryDb = new Database(path.join(dataDir, 'chunklab.db'), { readonly: true });
    try {
      assert.ok(pagedRecoveryDb.prepare('SELECT id FROM user_decks WHERE user_id=1 AND id=? AND deleted_at IS NULL')
        .get('recovery-page-205'), 'an item beyond the first page is selectable and applied to authoritative SQLite');
      const manifest = JSON.parse(pagedRecoveryDb.prepare('SELECT manifest_json FROM user_recovery_sources WHERE user_id=1 AND source_id=?')
        .get('test-selected-recovery-source').manifest_json);
      assert.equal(manifest.migration.items['decks/recovery-page-205'].status, 'applied');
    } finally { pagedRecoveryDb.close(); }
    await page.locator('#recoverySourcesRefresh').click();
    await page.waitForFunction(function () {
      var status = document.getElementById('recoveryCenterStatus');
      return status && status.textContent.indexOf('共找到') === 0;
    }, null, { timeout: 15000 });
    const unknownSelectableSource = page.locator('[data-recovery-source-id="test-unknown-operation-selective-recovery"]');
    await unknownSelectableSource.waitFor({ state: 'visible', timeout: 10000 });
    await unknownSelectableSource.getByRole('button', { name: /预览/ }).click();
    await page.waitForFunction(function () {
      var source = document.querySelector('[data-recovery-source-id="test-unknown-operation-selective-recovery"]');
      var button = source && source.querySelector('.recovery-source-head button');
      return button && button.textContent === '重新预览' && source.querySelectorAll('.recovery-preview-item').length > 0;
    }, null, { timeout: 15000 });
    const disjointUnknownChoice = unknownSelectableSource.locator(
      'input[data-recovery-group="decks"][data-recovery-id="recovery-safe-despite-unknown-op"]');
    await disjointUnknownChoice.waitFor({ state: 'visible', timeout: 10000 });
    assert.match(await unknownSelectableSource.innerText(), /旧操作尚未确认是否提交/,
      'the recovery UI explains the unresolved request while still offering only safe scoped additions');
    await disjointUnknownChoice.check();
    page.once('dialog', dialog => dialog.accept());
    await unknownSelectableSource.getByRole('button', { name: /恢复所选内容（1）/ }).click();
    await page.waitForFunction(() => {
      const text = document.querySelector('[data-recovery-source-id="test-unknown-operation-selective-recovery"]')?.innerText || '';
      return text.includes('部分恢复') || text.includes('未完成：');
    }, null, { timeout: 15000 }).catch(async error => {
      throw new Error(error.message + ' recovery UI: ' + await unknownSelectableSource.innerText());
    });
    assert.match(await unknownSelectableSource.innerText(), /部分恢复/,
      'the recovery center refreshes its source card after confirming a scoped selective restore');
    await page.waitForFunction(async () => (await ChunkAPI.getData()).mem.decks.some(
      deck => deck.id === 'recovery-safe-despite-unknown-op'), null, { timeout: 15000 });
    const unknownRecoveryDb = new Database(path.join(dataDir, 'chunklab.db'), { readonly: true });
    try {
      assert.equal(unknownRecoveryDb.prepare('SELECT COUNT(*) AS count FROM user_operation_receipts WHERE user_id=1 AND request_id=?')
        .get('unknown-live-operation-restore-01').count, 0, 'selective restore does not replay an unresolved operation');
      const unknownManifest = JSON.parse(unknownRecoveryDb.prepare('SELECT manifest_json FROM user_recovery_sources WHERE user_id=1 AND source_id=?')
        .get('test-unknown-operation-selective-recovery').manifest_json);
      assert.equal(unknownManifest.legacyReceipts[0].receipt, 'unknown', 'the uncertain receipt remains unresolved after scoped restore');
      assert.equal(unknownManifest.migration?.items?.['decks/recovery-safe-despite-unknown-op']?.status, 'applied',
        'the applied deck remains recorded alongside the original unresolved receipt: ' + JSON.stringify(unknownManifest));
    } finally { unknownRecoveryDb.close(); }
    const pendingBackup = await page.evaluate(async () => {
      const backup = await ChunkAPI.exportData();
      backup.saveState = {version:1,source:'server-confirmed',unconfirmedOperations:[{
        requestId:'explicit-restore-pending-01',operation:{protocol:3,requestId:'explicit-restore-pending-01',
          type:'settings.patch',payload:{patch:{shuffle:true}}},status:'pending',attempts:0
      }]};
      return backup;
    });
    const archivedPendingPreview = await page.evaluate(async backup => {
      const preview = await LegacyRestore.previewImported(backup);
      return {count:preview.legacy.saveState.unconfirmedOperations.length,
        requestId:preview.legacy.saveState.unconfirmedOperations[0].requestId};
    },pendingBackup);
    assert.equal(archivedPendingPreview.count,1,'explicit restore preserves the separately exported pending section');
    assert.equal(archivedPendingPreview.requestId,'explicit-restore-pending-01','explicit restore retains operation identity');
    await page.locator('#settingsMask [data-close]').first().click();
};
