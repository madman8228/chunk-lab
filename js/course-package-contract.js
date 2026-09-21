/* CoursePackage 1.1/2.0 contract helpers. Browser global + CommonJS for focused tests. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CoursePackageContract = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var MAX_ZIP_BYTES = 100 * 1024 * 1024;
  var MAX_UNCOMPRESSED_BYTES = 300 * 1024 * 1024;
  var MAX_ENTRY_BYTES = 50 * 1024 * 1024;
  var MAX_ENTRIES = 2000;
  var MAX_SCHEMA_BYTES = 1024 * 1024;
  var EXECUTABLE_EXTENSIONS = /\.(?:exe|dll|com|bat|cmd|ps1|sh|msi|js|mjs|cjs|wasm|jar|scr|vbs|hta)$/i;

  function normalizeTypingV11(value) {
    return String(value == null ? '' : value).normalize('NFKC')
      .replace(/[\t\n\f\r ]+/g, ' ')
      .replace(/^[\t\n\f\r ]+|[\t\n\f\r ]+$/g, '')
      .replace(/[A-Z]/g, function (letter) { return letter.toLowerCase(); });
  }
  function normalizeAnswer(value, policy) {
    if (!policy || policy.normalization !== 'english-typing-v1') return '';
    return normalizeTypingV11(value);
  }
  function answerMatches(actual, expected, policy) {
    var left = normalizeAnswer(actual, policy), right = normalizeAnswer(expected, policy);
    return !!left && left === right;
  }
  function isCourseV11(course) { return !!course && course.schemaVersion === '1.1'; }
  function isCourseV20(course) { return !!course && course.schemaVersion === '2.0'; }
  function detectProfile(course) {
    if (isCourseV20(course)) {
      return {
        id: 'mode-neutral-sequence-v2.0',
        protocolVersion: '2.0',
        typing: !!(course.capabilities && course.capabilities.text),
        audio: !!(course.capabilities && course.capabilities.audio),
        translation: !!(course.capabilities && course.capabilities.translation),
        chunkSelection: !!(course.capabilities && course.capabilities.chunkSelection),
        roleplay: !!(course.capabilities && course.capabilities.roleplay)
      };
    }
    var semantics = course && course.courseSemantics || {}, fields = semantics.fields || {};
    var nodes = course && course.story && course.story.nodes || [];
    var interactions = nodes.filter(function (node) { return node && node.type === 'interaction'; });
    var hasSourceText = interactions.some(function (node) { return node.sourceText && typeof node.sourceText === 'object'; });
    var speaker = semantics.roles && semantics.roles.speakerReference || fields.speaker || '';
    if (isCourseV11(course) && hasSourceText && course.deliveryMode === 'typing_only' && fields.learnerTarget === 'story.nodes[].sourceText') return { id: 'typing-source-text-v1.1', protocolVersion: '1.1', typing: true, sourceText: true, speaker: speaker };
    return null;
  }
  function isSafePath(value) {
    var path = String(value || '');
    if (!path || path.indexOf('\\') >= 0 || path.charAt(0) === '/' || /^[A-Za-z]:/.test(path)) return false;
    if (/^[a-z][a-z0-9+.-]*:/i.test(path) || path.split('/').some(function (part) { return part === '..' || part === ''; })) return false;
    return !EXECUTABLE_EXTENSIONS.test(path);
  }
  function manifestContentText(entries) {
    return entries.map(function (entry) { return entry.path + '\0' + entry.sha256 + '\0' + String(entry.byteSize) + '\n'; }).join('');
  }
  function compareUtf8Path(left, right) {
    var a = new TextEncoder().encode(String(left)), b = new TextEncoder().encode(String(right));
    var length = Math.min(a.length, b.length);
    for (var i = 0; i < length; i++) if (a[i] !== b[i]) return a[i] - b[i];
    return a.length - b.length;
  }
  function isSortedUtf8(entries) {
    for (var i = 1; i < entries.length; i++) if (compareUtf8Path(entries[i - 1].path, entries[i].path) > 0) return false;
    return true;
  }
  function packageProfile(manifest) {
    if (!manifest || typeof manifest !== 'object') return null;
    if (manifest.packageFormatVersion === '1.1.0' && manifest.schemaVersion === '1.1') return { id: 'course-package-1.1', version: '1.1', courseSchemaVersion: '1.1', semanticsVersion: '0.2', guideVersion: '0.2' };
    if (manifest.packageFormatVersion === '2.0.0' && manifest.schemaVersion === '2.0') return { id: 'course-package-2.0', version: '2.0', courseSchemaVersion: '2.0' };
    return null;
  }
  function validateManifestShape(manifest) {
    var errors = [];
    if (!manifest || typeof manifest !== 'object') return ['缺少 package-manifest.json'];
    var profile = packageProfile(manifest);
    if (!profile) errors.push('不支持的 packageFormatVersion 或 manifest schemaVersion');
    if (!Array.isArray(manifest.entries) || !manifest.entries.length) errors.push('manifest.entries 为空');
    if (manifest.entries && manifest.entries.length > MAX_ENTRIES) errors.push('ZIP 文件数量超过限制');
    if (profile && profile.version === '1.1') {
      if (manifest.courseSemanticsVersion !== '0.2') errors.push('1.1 manifest courseSemanticsVersion 必须为 0.2');
      if (!manifest.courseId || !manifest.courseVersion) errors.push('manifest 缺少 courseId 或 courseVersion');
      if (!/^[a-f0-9]{64}$/i.test(String(manifest.contentHash || ''))) errors.push('manifest contentHash 无效');
    }
    if (profile && profile.version === '2.0') {
      if (!manifest.courseId || !manifest.courseVersion) errors.push('2.0 manifest 缺少 courseId 或 courseVersion');
      if (!/^[a-f0-9]{64}$/i.test(String(manifest.contentHash || ''))) errors.push('manifest contentHash 无效');
    }
    var seen = {};
    (manifest.entries || []).forEach(function (entry) {
      if (!entry || typeof entry !== 'object') { errors.push('manifest.entries 存在无效项目'); return; }
      if (!isSafePath(entry.path)) errors.push('manifest 存在不安全路径：' + entry.path);
      if (entry.path === 'package-manifest.json') errors.push('manifest 不得声明自身');
      if (seen[entry.path]) errors.push('manifest 路径重复：' + entry.path);
      seen[entry.path] = true;
      if (!/^[a-f0-9]{64}$/i.test(String(entry.sha256 || ''))) errors.push('manifest SHA-256 无效：' + entry.path);
      if (!Number.isSafeInteger(entry.byteSize) || entry.byteSize < 0 || entry.byteSize > MAX_ENTRY_BYTES) errors.push('manifest 文件大小无效：' + entry.path);
    });
    if (profile && (profile.version === '1.1' || profile.version === '2.0') && manifest.entries && !isSortedUtf8(manifest.entries)) errors.push(profile.version + ' manifest.entries 必须按 path 的 UTF-8 字节升序排列');
    return errors;
  }

  function validateCourseV2(course) {
    var errors = [];
    if (!isCourseV20(course)) return ['仅支持 schemaVersion 2.0'];
    if (!course.courseId || !course.version) errors.push('缺少 courseId 或 version');
    if (!course.metadata || typeof course.metadata !== 'object' || !course.metadata.title) errors.push('2.0 metadata.title 不完整');
    if (!Array.isArray(course.assets)) errors.push('2.0 assets 必须是数组');
    if (!Array.isArray(course.roles)) errors.push('2.0 roles 必须是数组');
    if (!Array.isArray(course.utterances)) errors.push('2.0 utterances 必须是数组');
    if (!Array.isArray(course.sequence) || !course.sequence.length) errors.push('2.0 sequence 必须是非空数组');
    if (!course.capabilities || typeof course.capabilities !== 'object') errors.push('2.0 capabilities 必须存在');
    var assets = {}, roles = {}, utterances = {};
    (course.assets || []).forEach(function (asset) {
      if (!asset || !asset.id) { errors.push('2.0 存在无效资源'); return; }
      if (assets[asset.id]) errors.push('资源 ID 重复：' + asset.id);
      assets[asset.id] = asset;
      if (!isSafePath(asset.path)) errors.push('资源路径不安全：' + asset.path);
    });
    (course.roles || []).forEach(function (role) {
      if (!role || !role.id) { errors.push('2.0 存在无效角色'); return; }
      if (roles[role.id]) errors.push('角色 ID 重复：' + role.id);
      roles[role.id] = role;
    });
    (course.utterances || []).forEach(function (item) {
      if (!item || !item.id) { errors.push('2.0 存在无效台词'); return; }
      if (utterances[item.id]) errors.push('台词 ID 重复：' + item.id);
      utterances[item.id] = item;
      if (!item.text || typeof item.text !== 'object' || !item.text.en) errors.push('台词缺少 text.en：' + item.id);
      if (item.roleId && !roles[item.roleId]) errors.push('台词 roleId 引用不存在：' + item.id);
      if (!item.acceptedAnswers || !Array.isArray(item.acceptedAnswers.en) || !item.acceptedAnswers.en.length) errors.push('台词缺少 acceptedAnswers.en：' + item.id);
      ['imageAssetId', 'audioAssetId'].forEach(function (key) {
        if (item[key] && !assets[item[key]]) errors.push(key + ' 引用不存在：' + item.id);
      });
      if (item.chunks) {
        var chunkIds = {}, chunks = item.chunks.items;
        if (!Array.isArray(chunks) || !chunks.length || !Array.isArray(item.chunks.correctOrder)) errors.push('chunks 结构不完整：' + item.id);
        (chunks || []).forEach(function (chunk) {
          if (!chunk || !chunk.id || chunkIds[chunk.id]) errors.push('chunk ID 无效或重复：' + item.id);
          if (chunk && chunk.id) chunkIds[chunk.id] = true;
        });
        if (Array.isArray(item.chunks.correctOrder)) {
          if (item.chunks.correctOrder.length !== (chunks || []).length || item.chunks.correctOrder.some(function (id) { return !chunkIds[id]; })) errors.push('chunks.correctOrder 必须完整引用 items：' + item.id);
        }
        (item.chunks.distractors || []).forEach(function (chunk) { if (!chunk || !chunk.id || chunkIds[chunk.id]) errors.push('distractor ID 无效或与 chunk 重复：' + item.id); });
      }
    });
    var sequenceSeen = {};
    (course.sequence || []).forEach(function (id) {
      if (!utterances[id]) errors.push('sequence 引用不存在：' + id);
      if (sequenceSeen[id]) errors.push('sequence 存在重复台词：' + id);
      sequenceSeen[id] = true;
    });
    Object.keys(utterances).forEach(function (id) { if (!sequenceSeen[id]) errors.push('台词未纳入 sequence：' + id); });
    var caps = course.capabilities || {};
    if (caps.audio && (course.utterances || []).some(function (item) { return !item.audioAssetId || !assets[item.audioAssetId]; })) errors.push('capabilities.audio=true 但存在缺少音频的台词');
    if (caps.chunkSelection && (course.utterances || []).some(function (item) { return !item.chunks; })) errors.push('capabilities.chunkSelection=true 但存在缺少 chunks 的台词');
    if (caps.roleplay && (course.roles || []).length < 2) errors.push('capabilities.roleplay=true 至少需要两个角色');
    if (caps.roleplay && (course.utterances || []).some(function (item) { return !item.roleId || !roles[item.roleId]; })) errors.push('capabilities.roleplay=true 但存在缺少有效 roleId 的台词');
    if (caps.translation && !(course.utterances || []).every(function (item) { return item.text && item.text['zh-CN']; })) errors.push('capabilities.translation=true 但存在缺少中文翻译的台词');
    ['text', 'audio', 'translation', 'chunkSelection', 'roleplay'].forEach(function (key) {
      if (caps[key] !== true && caps[key] !== false) errors.push('capabilities.' + key + ' 必须为布尔值');
    });
    return errors;
  }
  function validateCourseGraph(course) {
    var errors = [], nodes = course && course.story && course.story.nodes || [], nodeIds = {}, assets = {};
    var v11 = isCourseV11(course), scenes = {}, npcs = {}, endings = {};
    (course.assets || []).forEach(function (asset) {
      if (!asset || !asset.id) return;
      if (assets[asset.id]) errors.push('资源 ID 重复：' + asset.id);
      assets[asset.id] = asset;
      if (!isSafePath(asset.path)) errors.push('资源路径不安全：' + asset.path);
    });
    if (v11) {
      (course.scenes || []).forEach(function (scene) { if (scene && scene.id) { if (scenes[scene.id]) errors.push('场景 ID 重复：' + scene.id); scenes[scene.id] = scene; } });
      (course.npcs || []).forEach(function (npc) { if (npc && npc.id) { if (npcs[npc.id]) errors.push('NPC ID 重复：' + npc.id); npcs[npc.id] = npc; } });
      ((course.completion && course.completion.endings) || []).forEach(function (ending) { if (ending && ending.id) { if (endings[ending.id]) errors.push('ending ID 重复：' + ending.id); endings[ending.id] = ending; } });
      (course.scenes || []).forEach(function (scene) {
        if (scene.imageAssetId && !assets[scene.imageAssetId]) errors.push('scene imageAssetId 引用不存在：' + scene.imageAssetId);
        if (scene.imageAssetId && assets[scene.imageAssetId] && assets[scene.imageAssetId].type !== 'story_image') errors.push('scene imageAssetId 资源类型不正确：' + scene.imageAssetId);
      });
      (course.npcs || []).forEach(function (npc) {
        if (npc.sceneId && !scenes[npc.sceneId]) errors.push('NPC sceneId 引用不存在：' + npc.sceneId);
      });
    }
    nodes.forEach(function (node) { if (node && node.id) { if (nodeIds[node.id]) errors.push('节点 ID 重复：' + node.id); nodeIds[node.id] = node; } });
    if (!nodeIds[course.story && course.story.startNodeId]) errors.push('startNodeId 不存在');
    nodes.forEach(function (node) {
      ['imageAssetId', 'audioAssetId'].forEach(function (key) { if (node[key] && !assets[node[key]]) errors.push(key + ' 引用不存在：' + node[key]); });
      if (v11) {
        if (!scenes[node.sceneId]) errors.push('sceneId 引用不存在：' + node.sceneId);
        if (!npcs[node.npcId]) errors.push('npcId 引用不存在：' + node.npcId);
        if (node.imageAssetId && assets[node.imageAssetId] && assets[node.imageAssetId].type !== 'story_image') errors.push('imageAssetId 资源类型不正确：' + node.imageAssetId);
        if (node.audioAssetId && assets[node.audioAssetId] && assets[node.audioAssetId].type !== 'line_audio') errors.push('audioAssetId 资源类型不正确：' + node.audioAssetId);
        if (node.type === 'end' && !endings[node.endingId]) errors.push('endingId 引用不存在：' + node.endingId);
      }
      var transitions = node.transitions || [];
      if (node.type === 'interaction' && !transitions.length) errors.push('交互节点缺少 transitions：' + node.id);
      if (node.type === 'interaction' && transitions.filter(function (item) { return item.fallback === true; }).length !== 1) errors.push('交互节点必须有且仅有一个 fallback：' + node.id);
      transitions.forEach(function (transition) { if (!nodeIds[transition.toNodeId]) errors.push('节点跳转不存在：' + transition.toNodeId); });
    });
    var reachable = {}, queue = course.story && course.story.startNodeId ? [course.story.startNodeId] : [];
    while (queue.length) { var id = queue.shift(); if (reachable[id] || !nodeIds[id]) continue; reachable[id] = true; (nodeIds[id].transitions || []).forEach(function (transition) { if (nodeIds[transition.toNodeId]) queue.push(transition.toNodeId); }); }
    nodes.forEach(function (node) { if (node && !reachable[node.id]) errors.push('节点不可从起点到达：' + node.id); });
    if (!nodes.some(function (node) { return node && node.type === 'end' && reachable[node.id]; })) errors.push('起点无法到达 end 节点');
    return errors;
  }
  return { limits: { maxZipBytes: MAX_ZIP_BYTES, maxUncompressedBytes: MAX_UNCOMPRESSED_BYTES, maxEntryBytes: MAX_ENTRY_BYTES, maxEntries: MAX_ENTRIES, maxSchemaBytes: MAX_SCHEMA_BYTES }, normalizeAnswer: normalizeAnswer, answerMatches: answerMatches, detectProfile: detectProfile, isCourseV11: isCourseV11, isCourseV20: isCourseV20, isSafePath: isSafePath, manifestContentText: manifestContentText, compareUtf8Path: compareUtf8Path, isSortedUtf8: isSortedUtf8, packageProfile: packageProfile, validateManifestShape: validateManifestShape, validateCourseV2: validateCourseV2, validateCourseGraph: validateCourseGraph };
}));
