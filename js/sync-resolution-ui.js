/* Conflict UI is deliberately separate from the practice engine. */
(function(global){
  'use strict';
  var badge = document.getElementById('syncBadge');
  if(!badge) return;
  var style = document.createElement('style');
  style.textContent = '#syncBadge{cursor:pointer}' +
    '#syncResolveMask .modal{max-width:640px;width:100%;height:auto;border-radius:12px}' +
    '#syncResolveMask .modal-head{padding:10px 14px}#syncResolveClose{margin-left:auto}' +
    '#syncResolveMask .sync-versions{display:grid;grid-template-columns:1fr 1fr;gap:12px}' +
    '#syncResolveMask section{min-width:0;border:1px solid var(--border);border-radius:10px;padding:12px}' +
    '#syncResolveMask h4{margin:0 0 8px}#syncResolveMask p{margin:8px 0;line-height:1.6;overflow-wrap:anywhere}' +
    '#syncResolveMask pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:180px;overflow:auto;font-size:12px}' +
    '#syncResolveMask .sync-message{min-height:24px}#syncResolveMask [hidden]{display:none!important}' +
    '@media(max-width:560px){#syncResolveMask{padding:12px}#syncResolveMask .modal{max-height:calc(100dvh - 24px)}' +
    '#syncResolveMask .sync-versions{grid-template-columns:1fr}#syncResolveMask .modal-body{padding:12px}#syncResolveMask .modal-foot{padding:10px}}';
  document.head.appendChild(style);
  var mask = document.createElement('div');
  mask.id = 'syncResolveMask'; mask.className = 'mask'; mask.hidden = true;
  mask.innerHTML = '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="syncResolveTitle">' +
    '<div class="modal-head"><h3 id="syncResolveTitle">处理同步冲突</h3><button type="button" class="btn ghost" id="syncResolveClose" aria-label="关闭">×</button></div>' +
    '<div class="modal-body"><p id="syncResolveIntro">本机和云端有不同版本。请选择保留哪一版；另一版会先备份，不会直接丢弃。</p>' +
    '<div class="sync-versions" id="syncVersions"><section><h4>本机版本</h4><p id="syncLocalSummary"></p><details><summary>查看内容</summary><pre id="syncLocalContent"></pre></details></section>' +
    '<section><h4>云端版本</h4><p id="syncRemoteSummary"></p><details><summary>查看内容</summary><pre id="syncRemoteContent"></pre></details></section></div>' +
    '<p id="syncResolveMessage" class="sync-message" role="status" aria-live="polite"></p></div>' +
    '<div class="modal-foot"><button type="button" class="btn primary" id="syncKeepLocal">使用本机</button><button type="button" class="btn" id="syncUseRemote">使用云端</button>' +
    '<button type="button" class="btn primary" id="syncRetry" hidden>继续上次处理</button><button type="button" class="btn" id="syncRecheck">重新查看</button>' +
    '<button type="button" class="btn" id="syncDownload" hidden>下载双方备份</button><button type="button" class="btn ghost" id="syncLater">关闭</button></div></div>';
  document.body.appendChild(mask);
  var $ = function(id){ return document.getElementById(id); };
  var view = null, receipt = null, busy = false, previousFocus;
  function message(text){ $('syncResolveMessage').textContent = text; }
  function buttons(){
    $('syncKeepLocal').hidden = $('syncUseRemote').hidden = !view || !!view.pending;
    $('syncRetry').hidden = !view || !view.pending || view.pendingState === 'blocked-local-change';
    $('syncRecheck').hidden = !view || (view.pending && view.pendingState === 'blocked-local-change');
    $('syncDownload').hidden = !view && !receipt;
    mask.querySelectorAll('button').forEach(function(b){ b.disabled = busy; });
  }
  function redacted(value){
    return JSON.stringify(value, function(k,v){
      if(/key|token|password|secret|credential/i.test(k)) return '[已隐藏敏感信息]';
      if(typeof v === 'string' && v.length > 2000) return v.slice(0,2000) + '…（较长内容已省略）';
      return v;
    }, 2).slice(0,16000);
  }
  function renderState(prefix, state){
    var value = state.value || {};
    if(view.batch){
      var snap = value || {}, mem = snap.mem || {}, courses = snap.courses || [], progress = snap.courseProgress || {};
      $(prefix + 'Summary').textContent = '整份学习数据 · '+(mem.decks || []).length+' 个题库 · '+courses.length+' 个课程 · '+Object.keys(progress).length+' 条进度';
      $(prefix + 'Content').textContent = redacted(snap);
      return;
    }
    var label = value.name || value.title || ({settings:'设置',stats:'学习汇总',best:'最佳成绩'}[view.id]) || view.id;
    $(prefix + 'Summary').textContent = state.deleted ? '已删除（选择此版本将删除该项目）' : label + (Array.isArray(value.items) ? ' · ' + value.items.length + ' 句' : '') + ' · 版本 ' + state.rev;
    $(prefix + 'Content').textContent = state.deleted ? '无内容' : redacted(value);
  }
  async function refresh(){
    busy = true; buttons(); message('正在读取双方版本…');
    try {
      view = await global.SyncResolution.preview();
      $('syncVersions').hidden = !view;
      if(view){ renderState('syncLocal',view.local); renderState('syncRemote',view.remote); }
      if(view && view.batch) $('syncResolveIntro').textContent='这是整份学习数据冲突，选择后会替换当前账号的学习数据；双方版本都会先备份。';
      else $('syncResolveIntro').textContent='本机和云端有不同版本。请选择保留哪一版；另一版会先备份，不会直接丢弃。';
      var pendingMessage = view && view.pending ? (
        view.pendingState === 'blocked-capacity' ? '服务器冲突归档空间已满。请先下载双方备份；下载不会释放容量，确认容量可用后再显式重试。' :
        view.pendingState === 'blocked-local-change' ? '处理期间本机产生了新学习记录。原请求不会自动重发，请下载原始版本、服务端回执和当前版本后再决定。' :
        view.pendingState === 'applying' ? '服务器已确认处理，当前页面尚未完成本机恢复。点击“继续上次处理”完成恢复。' :
        '上次处理尚未确认完成，点击“继续上次处理”可安全重试。'
      ) : '';
      message(view ? (view.pending ? pendingMessage : view.batch ? '请选择使用本机或使用云端。整份数据会一起处理。' : '只处理当前项目，其他题库和学习记录不受影响。') : (global.CL.isDirty() ? '没有待选择的冲突。本机改动仍在等待同步，请检查网络后重试。' : '同步已完成，没有待处理的冲突。'));
    }catch(e){ view = null; $('syncVersions').hidden = true; message(e.message); }
    finally { busy = false; buttons(); }
  }
  async function choose(choice){
    busy = true; buttons(); message('正在备份并确认，请勿切换账号…');
    try {
      receipt = choice === 'retry' ? await global.SyncResolution.retry() : await global.SyncResolution.resolve(view,choice);
      view = null;
      await global.CL.cloudSyncNow(global.CL.loadMem());
      await refresh();
      if(!view) message('当前冲突已处理，双方版本已备份。' + (global.CL.isDirty() ? '其他改动仍待同步。' : '同步已完成。'));
    }catch(e){
      var reason = e.message;
      await refresh();
      message(reason + (view && view.pending ? '；处理记录已保留，可继续重试。' : '；请查看最新版本后再选择。'));
    }finally { busy = false; buttons(); }
  }
  async function download(){
    busy = true; buttons();
    try {
      var data = view && view.pending ? { kind:'sync-recovery-backup', entity:view.entity, id:view.id,
        original:view.pendingOriginal, receipt:view.pendingReceipt,
        current:view.batch ? global.CL.readSyncSnapshot() : global.CL.readSyncLocal(view.entity,view.id),
        local:view.local, remote:view.remote } : view ? { local:view.local, remote:view.remote, entity:view.entity, id:view.id } :
        await (receipt && receipt.kind === 'batch' ? global.ChunkAPI.getSyncBatchResolution(receipt.requestId) : global.ChunkAPI.getSyncResolution(receipt.requestId));
      var url = URL.createObjectURL(new Blob([JSON.stringify(data,null,2)], {type:'application/json'}));
      var link = document.createElement('a'); link.href = url; link.download = 'sync-backup-' + Date.now() + '.json'; link.click();
      setTimeout(function(){ URL.revokeObjectURL(url); },1000);
      message('备份已下载。文件可能含个人内容或设置，请妥善保存。');
    }catch(e){ message('备份下载失败：' + e.message); }
    finally { busy = false; buttons(); }
  }
  function open(){ if(busy) return; previousFocus = document.activeElement; mask.hidden = false; $('syncResolveClose').focus(); refresh(); }
  function close(){ if(busy) return; mask.hidden = true; if(previousFocus) previousFocus.focus(); }
  badge.onclick = open;
  $('syncResolveClose').onclick = $('syncLater').onclick = close;
  $('syncKeepLocal').onclick = function(){ choose('local'); };
  $('syncUseRemote').onclick = function(){ choose('remote'); };
  $('syncRetry').onclick = function(){ choose('retry'); };
  $('syncRecheck').onclick = refresh;
  $('syncDownload').onclick = download;
  mask.addEventListener('keydown',function(e){
    if(e.key === 'Escape'){ e.preventDefault(); close(); }
    if(e.key === 'Tab'){
      var nodes = Array.from(mask.querySelectorAll('button,summary')).filter(function(n){ return !n.disabled && n.getClientRects().length; });
      var first = nodes[0], last = nodes[nodes.length-1];
      if(!first){ e.preventDefault(); return; }
      if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
      else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
    }
  });
  global.SyncResolutionUI = { open: open, refresh: refresh };
})(window);
