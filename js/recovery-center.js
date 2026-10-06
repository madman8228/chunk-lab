(function (global) {
  'use strict';
  var center = global.document.getElementById('recoveryCenter');
  if (!center) return;

  var list = global.document.getElementById('recoverySources');
  var status = global.document.getElementById('recoveryCenterStatus');
  var refreshButton = global.document.getElementById('recoverySourcesRefresh');
  var localRestore = global.document.getElementById('legacyLocalRestoreControls');
  var state = { cursor: null, sources: [], loading: false };
  var GROUPS = [
    ['decks', '题库'], ['courses', '课程'], ['courseProgress', '课程进度'], ['logicalCourses', '课程目录']
  ];
  var REASONS = {
    'server-not-empty': '当前账号已有数据，只能选择云端不存在且无冲突的内容。',
    'legacy-receipt-unknown': '有旧操作尚未确认是否提交；旧操作不会重放，你仍可选择无冲突的新内容恢复。',
    'legacy-receipt-present': '有旧操作已提交过，不会重放或重复统计；你仍可选择云端缺少的内容恢复。',
    'legacy-conflict-journal': '来源包含未裁决的旧冲突；不会替你选择本机或云端版本，但可单独恢复无冲突的新内容。',
    'invalid-baseline': '来源内容不完整或格式不受支持；原件仍保留。',
    'empty-source': '来源中没有可恢复的课程内容。',
    'already-applied': '这份来源此前已经恢复。'
  };

  function protocol3() {
    var config = global.CL && global.CL.getCloudConfig ? global.CL.getCloudConfig() : null;
    return !!(config && config.persistenceMode === 'server-authoritative' && Number(config.writeProtocol) === 3);
  }

  function configKnown() {
    return !!(global.CL && global.CL.getCloudConfig && global.CL.getCloudConfig());
  }

  function ready() {
    return protocol3() && global.CL && typeof global.CL.serverPersistenceReady === 'function' &&
      global.CL.serverPersistenceReady() === true;
  }

  function request(path, method, body) {
    return global.ChunkAPI.request(path, {
      method: method || 'GET',
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
  }

  function setStatus(message, isError) {
    status.textContent = message || '';
    status.setAttribute('data-state', isError ? 'error' : 'info');
  }

  function formatBytes(value) {
    var bytes = Number(value) || 0;
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function labelState(source) {
    if (!source.verified) return '完整性待确认';
    if (source.migrationStatus === 'applied') return '已恢复';
    if (source.migrationStatus === 'partially-applied') return '部分恢复';
    if (source.migrationStatus === 'retained-with-reason') return '原件保留';
    return '已保全，未恢复';
  }

  function syncGate() {
    var active = protocol3();
    center.hidden = !active;
    if (localRestore) localRestore.hidden = !configKnown() || active;
    if (active && !ready()) setStatus('恢复服务正在安全初始化，稍后可查看。');
  }

  function renderSources() {
    list.replaceChildren();
    state.sources.forEach(function (source) {
      var item = global.document.createElement('li');
      item.className = 'recovery-source';
      item.dataset.recoverySourceId = source.sourceId;
      var head = global.document.createElement('div');
      head.className = 'recovery-source-head';
      var meta = global.document.createElement('div');
      meta.className = 'recovery-source-meta';
      var date = source.createdAt ? new Date(source.createdAt.replace(' ', 'T') + 'Z') : null;
      var dateText = date && Number.isFinite(date.getTime()) ? date.toLocaleString() : '时间未知';
      var receiptCounts = source.receiptCounts || {};
      var notCommitted = Number(receiptCounts['not-committed']) || 0;
      meta.textContent = dateText + ' · ' + labelState(source) + ' · ' + formatBytes(source.compressedBytes) +
        ' · 待核实旧操作 ' + (Number(receiptCounts.unknown) || 0) + ' 条' +
        (notCommitted ? ' · 已确认未提交 ' + notCommitted + ' 条' : '');
      var previewButton = global.document.createElement('button');
      previewButton.type = 'button';
      previewButton.className = 'btn sm';
      previewButton.textContent = source.verified ? '预览可恢复内容' : '暂不可恢复';
      previewButton.disabled = !source.verified || !ready();
      previewButton.setAttribute('aria-label', '预览 ' + source.sourceId + ' 中可恢复的内容');
      head.append(meta, previewButton);
      item.appendChild(head);
      var previewArea = global.document.createElement('div');
      previewArea.className = 'recovery-source-preview';
      item.appendChild(previewArea);
      previewButton.addEventListener('click', function () {
        previewButton.disabled = true;
        previewButton.textContent = '正在预览…';
        previewArea.replaceChildren();
        previewSource(source, previewArea, previewButton).catch(function (error) {
          previewArea.replaceChildren();
          setStatus('预览失败：' + (error && error.message || '请稍后重试。'), true);
          previewButton.disabled = false;
          previewButton.textContent = '重新预览';
        });
      });
      list.appendChild(item);
    });
  }

  async function loadSources(append) {
    if (state.loading) return;
    if (!ready()) {
      setStatus('账号数据仍在初始化，请稍后重试。', true);
      return;
    }
    state.loading = true;
    refreshButton.disabled = true;
    refreshButton.textContent = '正在读取…';
    if (!append) {
      state.cursor = null;
      state.sources = [];
      list.replaceChildren();
    }
    setStatus('正在读取已保全来源…');
    try {
      var path = '/api/recovery/sources?limit=50' + (append && state.cursor ? '&cursor=' + encodeURIComponent(state.cursor) : '');
      var result = await request(path, 'GET');
      state.sources = state.sources.concat(result.items || []);
      state.cursor = result.nextCursor || null;
      renderSources();
      setStatus(state.sources.length ? '共找到 ' + state.sources.length + ' 份已保全来源。原件不会因预览或恢复而删除。' : '当前账号还没有已保全的历史来源。');
      var more = global.document.getElementById('recoverySourcesMore');
      if (more) more.remove();
      if (state.cursor) {
        more = global.document.createElement('button');
        more.id = 'recoverySourcesMore';
        more.type = 'button';
        more.className = 'btn sm';
        more.textContent = '载入更多来源';
        more.addEventListener('click', function () { loadSources(true).catch(function () {}); });
        list.after(more);
      }
    } catch (error) {
      setStatus('来源读取失败：' + (error && error.message || '请检查连接后重试。'), true);
    } finally {
      state.loading = false;
      refreshButton.disabled = false;
      refreshButton.textContent = '重新读取';
    }
  }

  function createLine(text, className) {
    var line = global.document.createElement('p');
    line.className = className || 'recovery-preview-note';
    line.textContent = text;
    return line;
  }

  function selectionFrom(previewArea) {
    var selection = { decks: [], courses: [], courseProgress: [], logicalCourses: [] };
    previewArea.querySelectorAll('input[data-recovery-group]:checked').forEach(function (input) {
      selection[input.dataset.recoveryGroup].push(input.dataset.recoveryId);
    });
    return selection;
  }

  function renderMerge(preview, previewArea) {
    var merge = preview.merge || {};
    var items = merge.items || {};
    var pageSize = 200;
    var selectableCount = 0;
    GROUPS.forEach(function (group) {
      var rows = Array.isArray(items[group[0]]) ? items[group[0]] : [];
      selectableCount += rows.filter(function (row) { return row.status === 'add'; }).length;
    });
    if (!selectableCount) {
      previewArea.appendChild(createLine('没有可安全新增的题库或课程。已存在、内容冲突、删除记录及历史统计均保留在原件中。'));
      return;
    }
    previewArea.appendChild(createLine('只会新增所选项目；云端已有内容、冲突项和学习统计不会被覆盖。'));
    var groupsRoot = global.document.createElement('div');
    groupsRoot.className = 'recovery-preview-items';
    var selectionNote = createLine('', 'recovery-preview-note');
    selectionNote.hidden = true;
    GROUPS.forEach(function (group) {
      var rows = Array.isArray(items[group[0]]) ? items[group[0]] : [];
      var additions = rows.filter(function (row) { return row.status === 'add'; });
      var retained = rows.filter(function (row) { return row.status === 'retained'; });
      var existing = rows.filter(function (row) { return row.status === 'already-present'; });
      if (!rows.length) return;
      var section = global.document.createElement('section');
      section.className = 'recovery-preview-group';
      var heading = global.document.createElement('h5');
      heading.textContent = group[1] + ' · 可新增 ' + additions.length + ' · 已存在 ' + existing.length + ' · 保留 ' + retained.length;
      section.appendChild(heading);
      var rowList = global.document.createElement('div');
      rowList.className = 'recovery-preview-list';
      section.appendChild(rowList);
      var nextIndex = 0;
      var more = null;
      function appendPage() {
        var end = Math.min(nextIndex + pageSize, additions.length);
        additions.slice(nextIndex, end).forEach(function (row) {
          var label = global.document.createElement('label');
          label.className = 'recovery-preview-item';
          var checkbox = global.document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.dataset.recoveryGroup = group[0];
          checkbox.dataset.recoveryId = row.id;
          var text = global.document.createElement('span');
          text.textContent = row.label || row.id;
          label.append(checkbox, text);
          rowList.appendChild(label);
        });
        nextIndex = end;
        if (more) {
          var remaining = additions.length - nextIndex;
          more.hidden = remaining <= 0;
          more.textContent = remaining > 0 ? '显示更多' + group[1] + '（剩余 ' + remaining + ' 项）' : '';
        }
      }
      appendPage();
      if (additions.length > pageSize) {
        more = global.document.createElement('button');
        more.type = 'button';
        more.className = 'btn sm recovery-preview-more';
        more.setAttribute('aria-label', '显示更多' + group[1]);
        more.addEventListener('click', appendPage);
        section.appendChild(more);
        var remaining = additions.length - nextIndex;
        more.textContent = '显示更多' + group[1] + '（剩余 ' + remaining + ' 项）';
      }
      if (retained.length) {
        var details = global.document.createElement('details');
        var summary = global.document.createElement('summary');
        summary.textContent = '查看保留原因（' + retained.length + '）';
        details.appendChild(summary);
        retained.slice(0, 20).forEach(function (row) {
          details.appendChild(createLine((row.label || row.id) + '：' + (row.reason || '当前不支持安全恢复')));
        });
        if (retained.length > 20) details.appendChild(createLine('另有 ' + (retained.length - 20) + ' 项保留，未逐项展开。'));
        section.appendChild(details);
      }
      groupsRoot.appendChild(section);
    });
    if (merge.deferred && (merge.deferred.learningStatistics || merge.deferred.learningMarks)) {
      previewArea.appendChild(createLine('学习统计、已掌握标记或错题记录无法安全合并，因此只保存在原件中。'));
    }
    if (selectableCount > 1000) {
      previewArea.appendChild(createLine('每次最多恢复 1,000 项、每类最多 500 项；完成一批后重新预览即可继续。'));
    }
    previewArea.appendChild(selectionNote);
    previewArea.appendChild(groupsRoot);
    var apply = global.document.createElement('button');
    apply.type = 'button';
    apply.className = 'btn sm primary';
    apply.textContent = '恢复所选内容';
    apply.disabled = true;
    groupsRoot.addEventListener('change', function (event) {
      var selection = selectionFrom(previewArea);
      var count = Object.keys(selection).reduce(function (sum, key) { return sum + selection[key].length; }, 0);
      var invalidGroup = Object.keys(selection).some(function (key) { return selection[key].length > 500; });
      var overLimit = count > 1000 || invalidGroup;
      if (overLimit && event.target && event.target.matches('input[type="checkbox"]')) {
        event.target.checked = false;
        selection = selectionFrom(previewArea);
        count = Object.keys(selection).reduce(function (sum, key) { return sum + selection[key].length; }, 0);
        selectionNote.textContent = invalidGroup ? '每类单次最多选择 500 项；刚才的选择未加入。' : '单次最多选择 1,000 项；刚才的选择未加入。';
        selectionNote.hidden = false;
      } else if (!overLimit) {
        selectionNote.hidden = true;
      }
      apply.disabled = !count;
      apply.textContent = count ? '恢复所选内容（' + count + '）' : '恢复所选内容';
    });
    apply.addEventListener('click', function () {
      var selection = selectionFrom(previewArea);
      var count = Object.keys(selection).reduce(function (sum, key) { return sum + selection[key].length; }, 0);
      if (!count) return;
      if (!global.confirm('将只新增所选的 ' + count + ' 项。云端现有内容、冲突项和学习统计不会覆盖；原恢复来源仍保留。继续吗？')) return;
      submitApply(preview, selection, apply, previewArea);
    });
    previewArea.appendChild(apply);
  }

  function submitApply(preview, selection, button, previewArea) {
    button.disabled = true;
    button.textContent = '正在安全恢复…';
    request('/api/recovery/' + encodeURIComponent(preview.sourceId) + '/apply', 'POST', {
      sourceHash: preview.sourceHash, expectedSeq: preview.expectedSeq, previewToken: preview.previewToken,
      selection: selection
    }).then(function (result) {
      if (!result || !['applied', 'partially-applied', 'already-present'].includes(result.state)) {
        throw new Error(result && result.reason ? (REASONS[result.reason] || result.reason) : '服务器未确认恢复结果');
      }
      previewArea.replaceChildren(createLine(result.state === 'applied' || result.state === 'already-present'
        ? '已确认恢复所选内容。原件仍保留，可随时再次查看。'
        : '所选项目已处理；存在不能安全恢复的内容，原件仍完整保留。'));
      setStatus('恢复结果已由服务器确认。刷新来源状态可查看最新清单。');
      loadSources(false).catch(function () {});
    }).catch(function (error) {
      previewArea.appendChild(createLine('未完成：' + (error && error.message || '请重新预览后重试。'), 'recovery-preview-note'));
      button.disabled = false;
      button.textContent = '重试所选内容';
    });
  }

  async function previewSource(source, previewArea, button) {
    var preview = await request('/api/recovery/' + encodeURIComponent(source.sourceId) + '/preview', 'POST', {
      sourceHash: source.sourceHash
    });
    button.disabled = false;
    button.textContent = '重新预览';
    if (preview.eligible) {
      var counts = preview.counts || {};
      previewArea.appendChild(createLine('账号目前没有已确认数据。整份来源最多包含：题库 ' + (counts.decks || 0) +
        '、课程 ' + (counts.courses || 0) + '、进度 ' + (counts.progress || 0) + '。此操作只允许写入空账号，原件仍保留。'));
      var applyAll = global.document.createElement('button');
      applyAll.type = 'button';
      applyAll.className = 'btn sm primary';
      applyAll.textContent = '恢复到空账号';
      applyAll.addEventListener('click', function () {
        if (!global.confirm('确认把这份完整备份恢复到当前空账号？已有数据不会被覆盖，原件仍保留。')) return;
        applyAll.disabled = true;
        applyAll.textContent = '正在安全恢复…';
        request('/api/recovery/' + encodeURIComponent(preview.sourceId) + '/apply', 'POST', {
          sourceHash: preview.sourceHash, expectedSeq: preview.expectedSeq, previewToken: preview.previewToken
        }).then(function (result) {
          if (!result || !['applied', 'already-present'].includes(result.state)) throw new Error('服务器未确认恢复结果');
          previewArea.replaceChildren(createLine('完整备份已由服务器确认恢复。原件仍保留；刷新页面后查看课程。'));
          setStatus('恢复结果已确认。');
          loadSources(false).catch(function () {});
        }).catch(function (error) {
          previewArea.appendChild(createLine('恢复未完成：' + (error && error.message || '请重新预览后重试。')));
          applyAll.disabled = false;
          applyAll.textContent = '重试恢复到空账号';
        });
      });
      previewArea.appendChild(applyAll);
      return;
    }
    if (!['server-not-empty', 'legacy-receipt-unknown', 'legacy-receipt-present', 'legacy-conflict-journal'].includes(preview.reason) ||
        !preview.merge) {
      previewArea.appendChild(createLine(REASONS[preview.reason] || '当前不能安全应用这份来源；原件仍完整保留。'));
      return;
    }
    if (preview.reason !== 'server-not-empty') {
      previewArea.appendChild(createLine(REASONS[preview.reason]));
    }
    renderMerge(preview, previewArea);
  }

  refreshButton.addEventListener('click', function () { loadSources(false).catch(function () {}); });
  global.addEventListener('cloud-config-changed', syncGate);
  syncGate();
})(window);
