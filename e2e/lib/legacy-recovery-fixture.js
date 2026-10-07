'use strict';
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const controls = "          <div id=\"legacyRecovery\" hidden style=\"font-size:12px;line-height:1.6\">\n            <p>旧版数据没有账号归属记录。确认属于你后，可下载副本，或把原件保全到账户恢复区；保全不会删除设备上的旧数据，也不会自动覆盖当前课程。</p>\n            <label><input id=\"legacyMine\" type=\"checkbox\">我确认这台设备上的旧数据属于我</label>\n            <button class=\"btn sm\" id=\"legacyDownload\">下载旧数据备份</button>\n            <button class=\"btn sm\" id=\"legacyArchiveToAccount\">保全原件到当前账号</button>\n            <div id=\"legacyLocalRestoreControls\">\n              <button class=\"btn sm\" id=\"legacyPreview\">预览恢复</button>\n              <button class=\"btn sm\" id=\"legacyApply\" disabled>确认恢复到本机</button>\n            </div>\n            <p id=\"legacyRecoveryStatus\" role=\"status\"></p>\n          </div>\n          <section id=\"recoveryCenter\" class=\"recovery-center\" hidden aria-labelledby=\"recoveryCenterTitle\">\n            <div class=\"recovery-center-head\">\n              <h4 id=\"recoveryCenterTitle\">已保全的恢复来源</h4>\n              <button class=\"btn sm\" id=\"recoverySourcesRefresh\" type=\"button\">查看来源</button>\n            </div>\n            <p class=\"recovery-center-help\">只恢复预览中明确勾选、且云端尚不存在的题库或课程。冲突、历史统计和未确认操作会保留在原件中，不会覆盖或重放。</p>\n            <p id=\"recoveryCenterStatus\" role=\"status\" aria-live=\"polite\"></p>\n            <ol id=\"recoverySources\" class=\"recovery-sources\"></ol>\n          </section>";
exports.loadRecoveryModule = async function(page){
  await page.addScriptTag({ path: path.join(root, 'js/legacy-recovery.js') });
};
exports.mountRecoveryControls = async function(page){
  await page.evaluate(html => {
    const body = document.getElementById('backupBody');
    const button = document.createElement('button');
    button.id = 'btnRecoverLegacy';
    button.textContent = '取回旧版数据';
    body.appendChild(button);
    body.insertAdjacentHTML('beforeend', html);
  }, controls);
  await exports.loadRecoveryModule(page);
  for(const file of ['js/legacy-backup.js','js/legacy-restore.js','js/recovery-center.js']){
    await page.addScriptTag({path:path.join(root,file)});
  }
};
exports.seedArchivedAccount = async function(page,base){
  // Explicit fixture setup on a non-application document. Product startup never does this.
  await page.goto(base + '/api/health');
  for(const file of ['js/account-storage.js','js/idb.js','api.js','js/legacy-recovery.js']){
    await page.addScriptTag({path:path.join(root,file)});
  }
  return page.evaluate(async () => {
    const archive = await LegacyRecovery.archiveCurrent();
    if(!archive || !archive.receipt) throw new Error('legacy fixture archive not created');
    const prefix = '/api/recovery/' + encodeURIComponent(archive.receipt.sourceId);
    const preview = await ChunkAPI.request(prefix + '/preview', {method:'POST',
      body:JSON.stringify({sourceHash:archive.receipt.sourceHash})});
    const result = await ChunkAPI.request(prefix + '/apply', {method:'POST',body:JSON.stringify(preview)});
    if(!['applied','already-present'].includes(result.state))
      throw new Error('legacy fixture seed failed: '+JSON.stringify({state:result.state,reason:result.reason,eligible:preview.eligible}));
    const snapshot = await ChunkAPI.getData();
    for(const deck of snapshot.mem.decks || []){
      if(!Number.isSafeInteger(snapshot.revs.decks[deck.id])){
        await ChunkAPI.submitOperation({protocol:3,requestId:crypto.randomUUID(),type:'deck.put',
          expectedRev:null,payload:{deck}});
      }
    }
    return result;
  });
};
