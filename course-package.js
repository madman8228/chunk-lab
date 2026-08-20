/* Chunk Lab · CoursePackage V1.0 local reader and linear runtime. */
(function (global) {
  'use strict';

  var COURSE_STORE_KEY = 'chunklab.courses.v1';
  var PROGRESS_STORE_KEY = 'chunklab.course-progress.v1';
  var DECK_STORE_KEY = 'chunklab.v1';
  var state = { courses: [], active: null, nodeId: '', gapAnswers: [], feedback: '', moduleStage: 'core', assessmentIndex: 0, moduleAnswer: '', moduleFeedback: '' };
  var _pendingLib = null;   // 导入时挂起的层级元数据
  var _pendingFile = null;  // 导入时挂起的文件
  var dom = {};

  function $(id) { return document.getElementById(id); }
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function localized(value) {
    if (!value) return '';
    if (typeof value === 'string') return value;
    return value['zh-CN'] || value.en || '';
  }
  function english(value) {
    if (!value) return '';
    if (typeof value === 'string') return value;
    return value.en || value['zh-CN'] || '';
  }
  function englishText(value) {
    if (!value) return '';
    if (typeof value === 'string') return value;
    return value.en || '';
  }
  function norm(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }
  function courseTitle(course) { return localized(course && course.metadata && course.metadata.title) || '未命名课程'; }
  function courseDescription(course) { return localized(course && course.metadata && course.metadata.description); }

  /* 大对象已迁 IndexedDB（CL 内存桥）：读写统一走 CL；未加载时回退 localStorage 旧值 */
  function storedCourses() {
    var cl = window.CL;
    if (cl && cl.readCourses) {
      var c = cl.readCourses();
      return Array.isArray(c) ? c : [];
    }
    try {
      var raw = JSON.parse(localStorage.getItem(COURSE_STORE_KEY) || '[]');
      return Array.isArray(raw) ? raw : [];
    } catch (e) { return []; }
  }
  function readStoredCourses() {
    state.courses = storedCourses().filter(function (course) { return validateCourse(course).length === 0; });
  }
  function persistCourses() {
    var cl = window.CL;
    if (cl && cl.writeCourses) { cl.writeCourses(state.courses); return; }
    try { localStorage.setItem(COURSE_STORE_KEY, JSON.stringify(state.courses)); } catch (error) {}
  }
  function storedProgress() {
    var cl = window.CL;
    if (cl && cl.readProgress) {
      var p = cl.readProgress();
      return (p && typeof p === 'object') ? p : {};
    }
    try {
      var all = JSON.parse(localStorage.getItem(PROGRESS_STORE_KEY) || '{}');
      return (all && typeof all === 'object') ? all : {};
    } catch (error) { return {}; }
  }
  function persistProgress(all) {
    var cl = window.CL;
    if (cl && cl.writeProgress) { cl.writeProgress(all); return; }
    try { localStorage.setItem(PROGRESS_STORE_KEY, JSON.stringify(all)); } catch (error) {}
  }
  function progressFor(courseId) {
    var all = storedProgress();
    return all[courseId] || { seen: [], completed: false };
  }
  function saveProgress(courseId, nodeId, completed) {
    var all = storedProgress();
    var progress = all[courseId] || { seen: [], completed: false };
    if (nodeId && progress.seen.indexOf(nodeId) < 0) progress.seen.push(nodeId);
    if (completed) progress.completed = true;
    all[courseId] = progress;
    persistProgress(all);
  }

  function validateCourse(course) {
    var errors = [];
    if (!course || typeof course !== 'object' || Array.isArray(course)) return ['顶层必须是 CoursePackage 对象'];
    if (course.schemaVersion !== '1.0') errors.push('仅支持 schemaVersion 1.0');
    ['metadata', 'learningObjectives', 'assets', 'scenes', 'npcs', 'story', 'completion'].forEach(function (key) {
      if (!course[key]) errors.push('缺少必需区域：' + key);
    });
    validateCourseSemantics(course, errors);
    validateCourseGuide(course, errors);
    validateLearningModules(course, errors);
    if (!course.metadata || !course.metadata.title) errors.push('metadata.title 不完整');
    if (!course.story || !course.story.startNodeId || !Array.isArray(course.story.nodes)) {
      errors.push('story 必须包含 startNodeId 和 nodes');
      return errors;
    }
    var nodeIds = {};
    course.story.nodes.forEach(function (node) {
      if (!node || !node.id) return;
      if (nodeIds[node.id]) errors.push('节点 ID 重复：' + node.id);
      nodeIds[node.id] = true;
    });
    if (!nodeIds[course.story.startNodeId]) errors.push('startNodeId 不存在：' + course.story.startNodeId);
    course.story.nodes.forEach(function (node) {
      (node.transitions || []).forEach(function (transition) {
        if (transition.toNodeId && !nodeIds[transition.toNodeId]) errors.push('节点跳转不存在：' + transition.toNodeId);
      });
    });
    return errors;
  }

  function validateCourseSemantics(course, errors) {
    var semantics = course && course.courseSemantics;
    if (!semantics || typeof semantics !== 'object') {
      errors.push('缺少课程语义说明：courseSemantics；请检查课程包是否完整');
      return;
    }
    if (semantics.schemaVersion !== '0.1') errors.push('不支持的 courseSemantics.schemaVersion');
    if (['image_dialogue', 'image_article', 'video_dialogue', 'video_article'].indexOf(semantics.courseType) < 0) errors.push('不支持的课程类型：' + (semantics.courseType || '未声明'));
    if (semantics.learningFlow !== 'story_graph') errors.push('不支持的课程学习流程：' + (semantics.learningFlow || '未声明'));
    if (!Array.isArray(semantics.learnerRoleIds) || !Array.isArray(semantics.roleSources)) errors.push('courseSemantics 角色说明不完整');
    if (!Array.isArray(semantics.exerciseModels) || semantics.exerciseModels.length === 0) errors.push('courseSemantics.exerciseModels 不完整');
    if (!semantics.modules || semantics.modules.core !== true || typeof semantics.modules.preStudy !== 'boolean' || typeof semantics.modules.postAssessment !== 'boolean') errors.push('courseSemantics.modules 必须声明 core、preStudy 和 postAssessment');
    var fields = semantics.fields || {};
    var expectedFields = {
      sceneDialogue: 'story.nodes[].npcMessage',
      learnerTarget: 'story.nodes[].sourceText',
      translation: 'localizedText[locale]',
      exerciseInstruction: 'story.nodes[].input.prompt',
      exerciseTemplate: 'story.nodes[].clozeTemplate',
      answerGaps: 'story.nodes[].gaps',
      answerChoices: 'story.nodes[].gaps[].choices',
      correctAnswer: 'story.nodes[].gaps[].correctChoiceId',
      speaker: 'story.nodes[].speakerId'
    };
    Object.keys(expectedFields).forEach(function (key) {
      if (fields[key] !== expectedFields[key]) errors.push('courseSemantics.fields.' + key + ' 含义不受支持');
    });
    var roles = semantics.roles || {};
    if (roles.learnerRoles !== 'practiceRoles[].learnerPlayable' || roles.speakers !== 'npcs[] + practiceRoles[]' || roles.speakerReference !== 'story.nodes[].speakerId'){
      /* ★ 降级为警告：roles 字段格式变化不影响核心学习功能（chunks/练习/图片），
         仅影响 NPC 角色名解析。允许导入并在 Console 提示，方便排查 */
      console.warn('[validateCourse] courseSemantics.roles 与预期不完全匹配，NPC 角色名可能解析不准：', roles);
    }
    var flow = semantics.flow || {};
    if (flow.entryPoint !== 'story.startNodeId' || flow.nextNode !== 'story.nodes[].transitions[].toNodeId' || flow.completion !== 'completion.endings') errors.push('courseSemantics.flow 含义不受支持');
    var assets = semantics.assets || {};
    if (assets.catalog !== 'assets[]' || assets.reference !== '*AssetId' || assets.filePath !== 'assets[].path') errors.push('courseSemantics.assets 含义不受支持');
    if (course.metadata && semantics.primaryLocale !== course.metadata.learningLocale) errors.push('courseSemantics.primaryLocale 与 metadata.learningLocale 不一致');
    if (course.metadata && JSON.stringify(semantics.supportLocales || []) !== JSON.stringify(course.metadata.supportLocales || [])) errors.push('courseSemantics.supportLocales 与 metadata.supportLocales 不一致');
    var playableRoleIds = (course.practiceRoles || []).filter(function (role) { return role && role.learnerPlayable; }).map(function (role) { return role.id; });
    (semantics.learnerRoleIds || []).forEach(function (roleId) {
      if (playableRoleIds.indexOf(roleId) < 0) errors.push('学习者角色不存在或不可练习：' + roleId);
    });
    if ((semantics.roleSources || []).indexOf('practiceRoles') >= 0 && !(course.practiceRoles || []).length) errors.push('courseSemantics 声明了 practiceRoles，但课程没有角色数据');
  }

  function validateCourseGuide(course, errors) {
    var guide = course && course.courseGuide;
    if (!guide || typeof guide !== 'object') {
      errors.push('缺少课程使用说明：courseGuide；请检查课程包是否完整');
      return;
    }
    if (guide.schemaVersion !== '0.1') errors.push('不支持的 courseGuide.schemaVersion');
    if (!guide.summary || !Array.isArray(guide.steps) || !guide.steps.length || !Array.isArray(guide.contentLegend) || !guide.contentLegend.length) errors.push('courseGuide 使用说明不完整');
  }

  function validateLearningModules(course, errors) {
    var modules = course && course.learningModules;
    var declared = course && course.courseSemantics && course.courseSemantics.modules;
    if (!modules) {
      if (declared && (declared.preStudy || declared.postAssessment)) errors.push('courseSemantics.modules 声明了学习模块，但缺少 learningModules');
      return;
    }
    if (typeof modules !== 'object' || Array.isArray(modules)) { errors.push('learningModules 必须是对象'); return; }
    if (!modules.preStudy && !modules.postAssessment) errors.push('learningModules 至少包含 preStudy 或 postAssessment');
    if (declared && (!!modules.preStudy !== !!declared.preStudy || !!modules.postAssessment !== !!declared.postAssessment)) errors.push('learningModules 与 courseSemantics.modules 不一致');
    if (modules.preStudy) {
      if (modules.preStudy.schemaVersion !== '0.1' || !modules.preStudy.title || !Array.isArray(modules.preStudy.items) || !modules.preStudy.items.length) errors.push('learningModules.preStudy 不完整');
      else modules.preStudy.items.forEach(function (item) { if (!item.id || !item.kind || !item.targetId || !item.title || !item.explanation) errors.push('learningModules.preStudy.items 数据不完整'); });
    }
    if (modules.postAssessment) {
      if (modules.postAssessment.schemaVersion !== '0.1' || !modules.postAssessment.title || !Array.isArray(modules.postAssessment.items) || !modules.postAssessment.items.length) errors.push('learningModules.postAssessment 不完整');
      else modules.postAssessment.items.forEach(function (item) {
        if (!item.id || !item.type || !item.prompt || !Array.isArray(item.targetIds) || !item.targetIds.length) errors.push('learningModules.postAssessment.items 数据不完整');
        if (item.type === 'choice' && (!Array.isArray(item.choices) || item.choices.length < 2 || !item.correctChoiceId)) errors.push('课后选择题缺少 choices 或 correctChoiceId');
        if (item.type === 'typing' && (!Array.isArray(item.acceptedAnswers) || !item.acceptedAnswers.length)) errors.push('课后输入题缺少 acceptedAnswers');
      });
    }
  }

  function courseModuleLabels(course) {
    var labels = [];
    var modules = course && course.learningModules;
    if (modules && modules.preStudy) labels.push('课前预习');
    labels.push('主课程');
    if (modules && modules.postAssessment) labels.push('课后测试');
    return labels;
  }

  function courseGuideSummary(course) {
    return localized(course && course.courseGuide && course.courseGuide.summary) || '按照课程顺序完成内容与练习。';
  }

  function getNode(course, nodeId) {
    return (course.story.nodes || []).find(function (node) { return node.id === nodeId; }) || null;
  }
  function getAsset(course, assetId) {
    return (course.assets || []).find(function (asset) { return asset.id === assetId; }) || null;
  }
  function getScene(course, sceneId) {
    return (course.scenes || []).find(function (scene) { return scene.id === sceneId; }) || null;
  }
  function nodeAssetId(course, node) {
    var scene = getScene(course, node && node.sceneId);
    return (node && node.imageAssetId) || (scene && scene.imageAssetId) || (course.story && course.story.initialImageAssetId) || '';
  }
  function assetUrl(record, assetId) {
    if (!record || !assetId) return '';
    var asset = getAsset(record.course, assetId);
    if (!asset) return '';
    return record.assets[asset.path] || record.assets[asset.fileName] || (asset._dataUri || '');
  }

  function renderCourseList() {
    if (!dom.courseList) return;
    if (!state.courses.length) {
      dom.courseList.innerHTML = '<div class="empty-course"><div class="empty-mark">✦</div><strong>还没有本地图文课程</strong><span>导入完整的课程 ZIP，开始建立你的课程库。</span></div>';
      return;
    }
    dom.courseList.innerHTML = state.courses.map(function (course, index) {
      var progress = progressFor(course.courseId);
      var nodeCount = course.story && course.story.nodes ? course.story.nodes.length : 0;
      var modules = courseModuleLabels(course).join(' · ');
      return '<button class="course-row" data-course-index="' + index + '">' +
        '<span class="course-row-mark">' + (progress.completed ? '✓' : '✦') + '</span>' +
        '<span class="course-row-main"><strong>' + esc(courseTitle(course)) + '</strong><small>' + esc(courseDescription(course)) + '</small></span>' +
        '<span class="course-row-meta"><b>' + esc(course.metadata.targetCefr || '—') + '</b><small>' + nodeCount + ' 个节点</small><small>' + esc(modules) + '</small></span>' +
        '</button>';
    }).join('');
    dom.courseList.querySelectorAll('[data-course-index]').forEach(function (button) {
      button.addEventListener('click', function () { openCourse(state.courses[Number(button.dataset.courseIndex)]); });
    });
  }

  function showMessage(text, kind) {
    if (!dom.importMessage) return;
    dom.importMessage.className = 'import-message ' + (kind || '');
    dom.importMessage.textContent = text || '';
  }
  function setView(view) {
    if (dom.library) dom.library.classList.toggle('hidden', view !== 'library');
    if (dom.player) dom.player.classList.toggle('hidden', view !== 'player');
  }

  function openCourse(recordOrCourse) {
    var record = recordOrCourse.course ? recordOrCourse : { course: recordOrCourse, assets: rebuildAssets(recordOrCourse) };
    var course = record.course;
    state.active = record;
    state.nodeId = course.story.startNodeId;
    state.gapAnswers = [];
    state.feedback = '';
    state.assessmentIndex = 0;
    state.moduleAnswer = '';
    state.moduleFeedback = '';

    var progress = progressFor(course.courseId);
    var modules = course.learningModules || {};
    var hasPreStudy = modules.preStudy && modules.preStudy.items && modules.preStudy.items.length;
    var hasPostAssessment = modules.postAssessment && modules.postAssessment.items && modules.postAssessment.items.length;
    var totalNodes = (course.story.nodes || []).length;

    if (progress.completed) {
      state.moduleStage = 'done';
    } else if (progress.seen.length > 0) {
      var lastSeenId = progress.seen[progress.seen.length - 1];
      var lastSeenNode = getNode(course, lastSeenId);
      if (progress.seen.length >= totalNodes && hasPostAssessment) {
        state.moduleStage = 'postAssessment';
      } else {
        state.moduleStage = 'core';
        if (lastSeenNode) state.nodeId = lastSeenId;
      }
    } else {
      state.moduleStage = hasPreStudy ? 'preStudy' : 'core';
    }

    setView('player');
    renderNode();
  }

  function renderImage(record, node) {
    var assetId = nodeAssetId(record.course, node);
    if (!assetId) return { html: '', hasImage: false, assetMissing: false };
    var asset = getAsset(record.course, assetId);
    var url = assetUrl(record, assetId);
    if (url) return { html: '<img src="' + esc(url) + '" alt="' + esc(localized(asset && asset.alt)) + '">', hasImage: true, assetMissing: false };
    return {
      html: '<div class="image-placeholder"><span>🖼</span><small>课程包缺少图片：' + esc(asset ? (asset.fileName || asset.id) : assetId) + '<br>图片不影响学习，可继续练习</small></div>',
      hasImage: false,
      assetMissing: true
    };
  }

  function renderNode() {
    var record = state.active;
    if (!record) return;
    var course = record.course;
    var progress = progressFor(course.courseId);
    var total = course.story.nodes.length;
    var seen = progress.seen.length;
    dom.playerTitle.textContent = courseTitle(course);
    if (dom.playerCourseTag) dom.playerCourseTag.textContent = course.metadata.targetCefr || '';
    if (dom.playerCount) dom.playerCount.textContent = seen;
    if (dom.playerTotal) dom.playerTotal.textContent = total;
    dom.playerGuide.textContent = courseGuideSummary(course) + ' · ' + courseModuleLabels(course).join(' · ');
    dom.playerProgress.style.width = Math.min(100, Math.round((seen / Math.max(1, total)) * 100)) + '%';
    if (state.moduleStage !== 'core') {
      dom.playerImage.innerHTML = '';
      dom.playerImage.classList.remove('image-enter');
      var stageEl = dom.playerImage.closest('.course-stage');
      if (stageEl) { stageEl.classList.add('no-image'); stageEl.classList.remove('missing-image'); }
      dom.playerScene.textContent = state.moduleStage === 'preStudy' ? '课前预习' : state.moduleStage === 'postAssessment' ? '课后测试' : '课程完成';
      dom.playerContent.innerHTML = renderModuleScreen(course);
      bindModuleActions(course);
      return;
    }
    var node = getNode(course, state.nodeId);
    if (!node) { showMessage('当前节点不存在：' + state.nodeId, 'error'); return; }
    saveProgress(course.courseId, node.id, node.type === 'end');
    var imageResult = renderImage(record, node);
    dom.playerImage.innerHTML = imageResult.html;
    var stageEl = dom.playerImage.closest('.course-stage');
    if (stageEl) {
      stageEl.classList.toggle('no-image', !imageResult.hasImage && !imageResult.assetMissing);
      stageEl.classList.toggle('missing-image', imageResult.assetMissing);
    }
    dom.playerImage.classList.remove('image-enter');
    void dom.playerImage.offsetWidth;
    dom.playerImage.classList.add('image-enter');
    dom.playerScene.textContent = localized((getScene(course, node.sceneId) || {}).name) || '';
    dom.playerContent.innerHTML = node.type === 'end' ? renderEnd(node, course) : renderInteraction(node, course);
    bindNodeActions(node, course);
  }

  function renderModuleScreen(course) {
    var modules = course.learningModules || {};
    if (state.moduleStage === 'preStudy' && modules.preStudy) {
      var pre = modules.preStudy;
      return '<div class="module-screen"><div class="node-stage-tag">课前预习</div><div class="module-items">' + pre.items.slice().sort(function (a, b) { return a.order - b.order; }).map(function (item) {
          return '<article class="module-item"><b>' + esc(localized(item.title)) + '</b><p>' + esc(localized(item.explanation)) + '</p>' + (item.example ? '<small>' + esc(english(item.example)) + '</small>' : '') + '</article>';
        }).join('') + '</div><div class="node-actions"><button class="action-button primary" data-action="start-core">进入主课程</button></div></div>';
    }
    if (state.moduleStage === 'postAssessment' && modules.postAssessment) {
      var post = modules.postAssessment;
      var item = post.items.slice().sort(function (a, b) { return a.order - b.order; })[state.assessmentIndex];
      if (!item) return '<div class="module-screen"><div class="end-mark">✓</div><div class="node-label">课后测试</div><h2>测试完成</h2><p class="node-copy">' + esc(localized(post.description)) + '</p><div class="node-actions"><button class="action-button primary" data-action="finish-course">完成课程</button></div></div>';
      var html = '<div class="module-screen"><div class="node-label">课后测试 · ' + (state.assessmentIndex + 1) + '/' + post.items.length + '</div><h2>' + esc(localized(post.title)) + '</h2><p class="node-copy">' + esc(localized(item.prompt)) + '</p>';
      if (item.type === 'choice') html += '<div class="choice-list">' + item.choices.map(function (choice) { return '<button class="choice-option ' + (state.moduleAnswer === choice.id ? 'selected' : '') + '" data-assess-choice="' + esc(choice.id) + '"><span>' + esc(english(choice.text) || localized(choice.text)) + '</span><small>' + esc(localized(choice.text)) + '</small></button>'; }).join('') + '</div>';
      else html += '<div class="typing-box"><input id="moduleTyping" type="text" autocomplete="off" placeholder="输入你的英语答案…" value="' + esc(state.moduleAnswer) + '"></div>';
      if (state.moduleFeedback) html += '<div class="node-feedback ' + (state.moduleFeedback.kind || '') + '">' + esc(state.moduleFeedback.text) + '</div>';
      return html + '<div class="node-actions"><button class="action-button primary" data-action="submit-assessment">检查答案</button></div></div>';
    }
    return '<div class="module-screen"><div class="end-mark">✓</div><div class="node-label">课程完成</div><h2>学习完成</h2><p class="node-copy">你已完成主课程和课后测试。</p><div class="node-actions"><button class="action-button primary" data-action="back-library">返回课程库</button><button class="action-button" data-action="restart">再学一次</button></div></div>';
  }

  function bindModuleActions(course) {
    dom.playerContent.querySelectorAll('[data-action="start-core"]').forEach(function (button) { button.onclick = function () { state.moduleStage = 'core'; state.moduleFeedback = ''; renderNode(); }; });
    dom.playerContent.querySelectorAll('[data-action="finish-course"]').forEach(function (button) { button.onclick = function () { state.moduleStage = 'done'; state.moduleFeedback = ''; renderNode(); }; });
    dom.playerContent.querySelectorAll('[data-action="back-library"]').forEach(function (button) { button.onclick = function () { setView('library'); renderCourseList(); }; });
    dom.playerContent.querySelectorAll('[data-action="restart"]').forEach(function (button) { button.onclick = function () { openCourse(course); }; });
    dom.playerContent.querySelectorAll('[data-assess-choice]').forEach(function (button) { button.onclick = function () { state.moduleAnswer = button.dataset.assessChoice; state.moduleFeedback = ''; renderNode(); }; });
    var submit = dom.playerContent.querySelector('[data-action="submit-assessment"]');
    if (submit) submit.onclick = function () {
      var post = course.learningModules.postAssessment;
      var item = post.items.slice().sort(function (a, b) { return a.order - b.order; })[state.assessmentIndex];
      var answer = item.type === 'typing' ? (($('moduleTyping') || {}).value || '') : state.moduleAnswer;
      state.moduleAnswer = answer;
      var ok = item.type === 'choice' ? answer === item.correctChoiceId : item.acceptedAnswers.some(function (candidate) { return norm(candidate) === norm(answer); });
      if (!ok) { state.moduleFeedback = { kind: 'bad', text: '答案不正确，请根据课程内容再试一次。' }; renderNode(); return; }
      state.assessmentIndex += 1; state.moduleAnswer = ''; state.moduleFeedback = ''; renderNode();
    };
  }

  function renderEnd(node, course) {
    var ending = (course.completion && course.completion.endings || []).find(function (item) { return item.id === node.endingId; });
    var endMessage = semanticNodeValue(course, node, 'sceneDialogue');
    var nextAction = course.learningModules && course.learningModules.postAssessment
      ? '<button class="action-button primary" data-action="start-post-assessment">开始课后测试</button>'
      : '<button class="action-button primary" data-action="back-library">返回课程库</button>';
    return '<div class="end-mark">✓</div><div class="node-label">课程节点完成</div><h2>' + esc(localized(ending && ending.label) || '完成') + '</h2>' +
      '<p class="node-copy">' + esc(localized(ending && ending.description) || localized(endMessage)) + '</p>' +
      '<div class="node-actions">' + nextAction + '<button class="action-button" data-action="restart">再学一次</button></div>';
  }

  function renderInteraction(node, course) {
    var speaker = course.courseSemantics.roles.speakerReference === 'story.nodes[].speakerId'
      ? (node.speakerId || node.npcId || '')
      : (node.npcId || node.speakerId || '');
    var role = (course.practiceRoles || []).find(function (item) { return item.id === speaker; });
    var npc = (course.npcs || []).find(function (item) { return item.id === speaker; });
    var label = localized((role || npc || {}).label || (role || npc || {}).name) || '';
    var dialogue = semanticNodeValue(course, node, 'sceneDialogue');
    var source = semanticNodeValue(course, node, 'learnerTarget');
    var dialogueEn = englishText(dialogue);
    var dialogueZh = localized(dialogue);
    var sourceEn = englishText(source);
    var sourceZh = localized(source);

    var isCloze = semanticNodeArray(course, node, 'answerGaps').length && semanticNodeValue(course, node, 'exerciseTemplate');
    var isChoices = node.input && node.input.choices && node.input.choices.length;
    var isTyping = node.input && node.input.prompt;
    var hasInput = isCloze || isChoices || isTyping;

    var html = '<div class="chat-area">';

    /* NPC 气泡（左侧） */
    if (dialogueEn || dialogueZh) {
      html += '<div class="chat-bubble npc">';
      html += '<div class="bubble-meta"><span class="bubble-avatar">' + getAvatar(label) + '</span><span class="bubble-name">' + esc(label || 'NPC') + '</span></div>';
      if (dialogueEn) html += '<div class="bubble-en">' + esc(dialogueEn) + '</div>';
      if (dialogueZh && dialogueZh !== dialogueEn) {
        html += '<button class="bubble-translate-btn" data-translate="npc"></button>';
        html += '<div class="bubble-zh hidden" data-translation="npc">' + esc(dialogueZh) + '</div>';
      }
      html += '</div>';
    }

    /* 学习者气泡（右侧） */
    if (hasInput) {
      html += '<div class="chat-bubble learner">';
      html += '<div class="bubble-meta"><span class="bubble-name">你</span><span class="bubble-avatar">' + getAvatar('你') + '</span></div>';
      if (isCloze) {
        html += renderClozeInline(node, course);
      } else if (isChoices) {
        html += '<div class="bubble-en">' + esc(sourceEn || '请选择正确的回答') + '</div>';
        if (sourceZh && sourceZh !== sourceEn) {
          html += '<button class="bubble-translate-btn" data-translate="learner"></button>';
          html += '<div class="bubble-zh hidden" data-translation="learner">' + esc(sourceZh) + '</div>';
        }
      } else if (isTyping) {
        html += '<div class="bubble-en">' + esc(sourceEn || '请输入你的回答') + '</div>';
        if (sourceZh && sourceZh !== sourceEn) {
          html += '<button class="bubble-translate-btn" data-translate="learner"></button>';
          html += '<div class="bubble-zh hidden" data-translation="learner">' + esc(sourceZh) + '</div>';
        }
      }
      html += '</div>';
    } else if (sourceEn || sourceZh) {
      html += '<div class="chat-bubble learner">';
      html += '<div class="bubble-meta"><span class="bubble-name">你</span><span class="bubble-avatar">' + getAvatar('你') + '</span></div>';
      if (sourceEn) html += '<div class="bubble-en">' + esc(sourceEn) + '</div>';
      if (sourceZh && sourceZh !== sourceEn) {
        html += '<button class="bubble-translate-btn" data-translate="learner"></button>';
        html += '<div class="bubble-zh hidden" data-translation="learner">' + esc(sourceZh) + '</div>';
      }
      html += '</div>';
    }

    html += '</div>';

    if (node.autoAdvance) return html + '<div class="node-actions"><button class="action-button primary" data-action="advance">继续</button></div>';

    if (hasInput) {
      html += '<div class="exercise-divider"></div>';
      if (isCloze) html += renderWordBank(node, course);
      else if (isChoices) html += renderChoices(node.input.choices);
      else html += renderTyping(node, course);
    }
    if (state.feedback) html += '<div class="node-feedback ' + (state.feedback.kind || '') + '">' + esc(state.feedback.text) + '</div>';
    return html;
  }

  function semanticNodeValue(course, node, meaning) {
    var field = course.courseSemantics.fields[meaning];
    if (field === 'story.nodes[].npcMessage') return node.npcMessage;
    if (field === 'story.nodes[].sourceText') return node.sourceText;
    if (field === 'story.nodes[].input.prompt') return node.input && node.input.prompt;
    if (field === 'story.nodes[].clozeTemplate') return node.clozeTemplate;
    return null;
  }

  function semanticNodeArray(course, node, meaning) {
    var field = course.courseSemantics.fields[meaning];
    if (field === 'story.nodes[].gaps') return Array.isArray(node.gaps) ? node.gaps : [];
    return [];
  }

  function getAvatar(label) {
    if (!label) return '👤';
    if (label === '你') return '🎓';
    var first = label.charAt(0);
    return /[\u4e00-\u9fa5]/.test(first) ? first : first.toUpperCase();
  }

  function renderClozeInline(node, course) {
    var templateValue = semanticNodeValue(course, node, 'exerciseTemplate');
    var templateEn = englishText(templateValue);
    var templateZh = localized(templateValue);
    var sourceValue = semanticNodeValue(course, node, 'learnerTarget');
    var template = templateEn || templateZh || englishText(sourceValue) || '';
    var gaps = semanticNodeArray(course, node, 'answerGaps');
    var parts = String(template).split('{{gap}}');

    var html = '<div class="bubble-en">';
    parts.forEach(function (part, index) {
      html += '<span>' + esc(part) + '</span>';
      if (index < parts.length - 1) {
        var gap = gaps[index];
        var selected = state.gapAnswers[index];
        var selectedChoice = selected && (gap.choices || []).find(function (choice) { return choice.id === selected; });
        var displayText = selectedChoice ? (englishText(selectedChoice.text) || localized(selectedChoice.text)) : '___';
        html += '<span class="gap-slot ' + (selected ? 'filled' : '') + '" data-gap="' + index + '">' + esc(displayText) + '</span>';
      }
    });
    html += '</div>';

    if (templateZh && templateZh !== template) {
      html += '<button class="bubble-translate-btn" data-translate="learner"></button>';
      html += '<div class="bubble-zh hidden" data-translation="learner">' + esc(templateZh) + '</div>';
    }

    return html;
  }

  function renderWordBank(node, course) {
    var gaps = semanticNodeArray(course, node, 'answerGaps');
    var allChoices = [];
    var seen = {};
    gaps.forEach(function (gap) {
      (gap.choices || []).forEach(function (choice) {
        if (!seen[choice.id]) {
          seen[choice.id] = true;
          allChoices.push(choice);
        }
      });
    });
    allChoices.sort(function () { return Math.random() - 0.5; });

    var html = '<div class="word-bank">';
    html += '<div class="word-bank-head"><span>词块区</span><small>点击词块，再点击句子中的空位填入；点击已填入的空位可取回</small></div>';
    html += '<div class="word-bank-chips">';
    allChoices.forEach(function (choice) {
      var choiceEn = englishText(choice.text) || localized(choice.text);
      var used = state.gapAnswers.some(function (ans) { return ans === choice.id; });
      html += '<button class="word-chip ' + (used ? 'used' : '') + '" data-choice-id="' + esc(choice.id) + '">' + esc(choiceEn) + '</button>';
    });
    html += '</div>';
    html += '</div>';
    return html;
  }

  function renderChoices(choices) {
    return '<div class="choice-list">' + choices.map(function (choice) {
      var choiceEn = englishText(choice.text) || localized(choice.text);
      var choiceZh = localized(choice.text);
      return '<button class="choice-option" data-choice-id="' + esc(choice.id) + '"><span>' + esc(choiceEn) + '</span>' + (choiceZh && choiceZh !== choiceEn ? '<small>' + esc(choiceZh) + '</small>' : '') + (choice.hint ? '<small>' + esc(localized(choice.hint)) + '</small>' : '') + '</button>';
    }).join('') + '</div>';
  }

  function renderTyping(node, course) {
    var expressionIds = node.evaluation && node.evaluation.acceptedExpressionIds || [];
    var answers = node.difficultyLevels && node.difficultyLevels.typing && node.difficultyLevels.typing.acceptedAnswers || [];
    if (!answers.length) {
      answers = (course.learningObjectives.expressions || []).filter(function (expression) { return expressionIds.indexOf(expression.id) >= 0; }).reduce(function (all, expression) {
        return all.concat([expression.text]).concat(expression.acceptedAlternatives || []);
      }, []);
    }
    return '<div class="typing-box"><input id="courseTyping" type="text" autocomplete="off" placeholder="输入你的英语表达…"><button class="action-button primary" data-action="submit-typing" data-answers="' + esc(JSON.stringify(answers)) + '">检查答案</button></div>';
  }

  function bindNodeActions(node, course) {
    dom.playerContent.querySelectorAll('[data-action="back-library"]').forEach(function (button) { button.onclick = function () { setView('library'); renderCourseList(); }; });
    dom.playerContent.querySelectorAll('[data-action="restart"]').forEach(function (button) { button.onclick = function () { openCourse(course); }; });
    dom.playerContent.querySelectorAll('[data-action="start-post-assessment"]').forEach(function (button) { button.onclick = function () { state.moduleStage = 'postAssessment'; state.assessmentIndex = 0; state.moduleAnswer = ''; state.moduleFeedback = ''; renderNode(); }; });
    dom.playerContent.querySelectorAll('[data-action="advance"]').forEach(function (button) { button.onclick = function () { advance(node, { overallScore: 100, inputMode: 'typing' }); }; });

    /* 翻译按钮：显示/隐藏中文翻译 */
    dom.playerContent.querySelectorAll('[data-translate]').forEach(function (btn) {
      btn.onclick = function () {
        var target = btn.dataset.translate;
        var zh = dom.playerContent.querySelector('[data-translation="' + target + '"]');
        if (zh) {
          var isHidden = zh.classList.contains('hidden');
          if (isHidden) { zh.classList.remove('hidden'); btn.classList.add('active'); }
          else { zh.classList.add('hidden'); btn.classList.remove('active'); }
        }
      };
    });

    /* 词块点击：选中/取消选中 */
    dom.playerContent.querySelectorAll('.word-chip').forEach(function (chip) {
      chip.onclick = function () {
        if (chip.classList.contains('used')) return;
        var isSelected = chip.classList.contains('selected');
        dom.playerContent.querySelectorAll('.word-chip').forEach(function (c) { c.classList.remove('selected'); });
        if (!isSelected) chip.classList.add('selected');
      };
    });

    /* 空位点击：填入（如果选中了词块）或取回（如果已填） */
    dom.playerContent.querySelectorAll('[data-gap]').forEach(function (slot) {
      slot.onclick = function () {
        var gapIndex = Number(slot.dataset.gap);
        var current = state.gapAnswers[gapIndex];
        var selectedChip = dom.playerContent.querySelector('.word-chip.selected');

        if (current) {
          /* 已填，取回 */
          state.gapAnswers[gapIndex] = '';
          state.feedback = '';
          renderNode();
          return;
        }

        if (selectedChip) {
          var choiceId = selectedChip.dataset.choiceId;
          state.gapAnswers[gapIndex] = choiceId;
          state.feedback = '';

          /* 检查是否全部填满 */
          var gaps = semanticNodeArray(course, node, 'answerGaps');
          var complete = gaps.every(function (gap, index) { return Boolean(state.gapAnswers[index]); });
          if (complete) {
            var ok = gaps.every(function (gap, index) { return state.gapAnswers[index] === gap.correctChoiceId; });
            if (ok) { advance(node, { overallScore: 100, inputMode: 'choice' }); return; }
            else { state.feedback = { kind: 'bad', text: '答案不正确，请检查英文片段的含义和顺序。' }; state.gapAnswers = []; }
          }
          renderNode();
        }
      };
    });
    dom.playerContent.querySelectorAll('[data-choice-id]:not([data-gap-choice])').forEach(function (button) {
      button.onclick = function () {
        var choice = (node.input.choices || []).find(function (item) { return item.id === button.dataset.choiceId; });
        advance(node, { selectedChoiceId: button.dataset.choiceId, overallScore: choice && choice.score != null ? choice.score : (choice && choice.isCorrect === false ? 0 : 100), inputMode: 'choice' });
      };
    });
    var typingButton = dom.playerContent.querySelector('[data-action="submit-typing"]');
    if (typingButton) typingButton.onclick = function () {
      var input = $('courseTyping');
      var answers = JSON.parse(typingButton.dataset.answers || '[]');
      var ok = answers.some(function (answer) { return norm(answer) === norm(input.value); });
      if (ok) advance(node, { overallScore: 100, inputMode: 'typing' });
      else { state.feedback = { kind: 'bad', text: '答案不正确，请检查英文表达后再试一次。' }; renderNode(); setTimeout(function () { var nextInput = $('courseTyping'); if (nextInput) nextInput.focus(); }, 20); }
    };
  }

  function predicateMatches(predicate, facts) {
    var actual = facts[predicate.fact];
    if (predicate.fact === 'selectedChoiceId' || predicate.fact === 'matchedIntentId') return predicate.operator === 'equals' ? actual === predicate.value : actual !== predicate.value;
    if (predicate.fact === 'overallScore' || predicate.fact === 'retryCount') {
      if (predicate.operator === 'equals') return actual === predicate.value;
      if (predicate.operator === 'gte') return actual >= predicate.value;
      if (predicate.operator === 'lte') return actual <= predicate.value;
      if (predicate.operator === 'not_equals') return actual !== predicate.value;
    }
    if (predicate.fact === 'inputMode') return predicate.operator === 'equals' ? actual === predicate.value : actual !== predicate.value;
    return false;
  }
  function transitionMatches(transition, facts) {
    if (transition.fallback) return true;
    if (!transition.when) return false;
    if (transition.when.all) return transition.when.all.every(function (predicate) { return predicateMatches(predicate, facts); });
    if (transition.when.any) return transition.when.any.some(function (predicate) { return predicateMatches(predicate, facts); });
    return false;
  }
  function advance(node, facts) {
    var transitions = (node.transitions || []).slice().sort(function (a, b) { return (b.priority || 0) - (a.priority || 0); });
    var chosen = transitions.find(function (transition) { return transitionMatches(transition, facts); }) || transitions[transitions.length - 1];
    if (!chosen || !chosen.toNodeId) { state.feedback = { kind: 'bad', text: '此节点没有可用的下一步。' }; renderNode(); return; }
    state.nodeId = chosen.toNodeId;
    state.gapAnswers = [];
    state.feedback = '';
    renderNode();
  }

  function importCourse(course, assets, autoOpen) {
    var errors = validateCourse(course);
    if (errors.length) {
      /* ★ 根因修复：验证失败必须抛错（而不是静默 return）。
         之前静默 return 导致 async importZip 正常 resolve → decks.html 误报"导入完成"，
         但课程从未持久化 → 树/分级都不显示 */
      throw new Error(errors.slice(0, 4).join('；'));
    }
    if (_pendingLib) {
      course.lib = {
        seriesId: _pendingLib.seriesId,
        seriesName: _pendingLib.seriesName,
        volumeIndex: _pendingLib.volumeIndex,
        volumeName: _pendingLib.volumeName,
        level2Name: _pendingLib.level2Name || null,
        sortOrder: 0
      };
    }
    var record = { course: course, assets: assets || {} };
    var existingIndex = state.courses.findIndex(function (item) { return item.courseId === course.courseId; });
    if (existingIndex >= 0) state.courses[existingIndex] = course; else state.courses.push(course);
    persistCourses();
    state.active = record;
    if (autoOpen === false) return record;  // 仅持久化，不打开播放器（decks.html 场景）
    renderCourseList();
    showMessage('已导入「' + courseTitle(course) + '」', 'ok');
    openCourse(record);
  }

  function readUint(view, offset, length) { return length === 2 ? view.getUint16(offset, true) : view.getUint32(offset, true); }
  async function inflate(bytes) {
    if (!global.DecompressionStream) throw new Error('当前浏览器不支持 ZIP 解压，请使用最新版 Chrome 或 Edge。');
    var stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  async function readZip(buffer) {
    var view = new DataView(buffer);
    var eocd = -1;
    for (var i = buffer.byteLength - 22; i >= Math.max(0, buffer.byteLength - 65557); i--) { if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; } }
    if (eocd < 0) throw new Error('不是可识别的 ZIP 文件。');
    var count = readUint(view, eocd + 10, 2), centralOffset = readUint(view, eocd + 16, 4), cursor = centralOffset, entries = {};
    for (var entryIndex = 0; entryIndex < count; entryIndex++) {
      if (view.getUint32(cursor, true) !== 0x02014b50) throw new Error('ZIP 中央目录损坏。');
      var method = readUint(view, cursor + 10, 2), compressedSize = readUint(view, cursor + 20, 4), nameLength = readUint(view, cursor + 28, 2), extraLength = readUint(view, cursor + 30, 2), commentLength = readUint(view, cursor + 32, 2), localOffset = readUint(view, cursor + 42, 4);
      var name = new TextDecoder().decode(new Uint8Array(buffer, cursor + 46, nameLength));
      cursor += 46 + nameLength + extraLength + commentLength;
      if (name.endsWith('/')) continue;
      if (view.getUint32(localOffset, true) !== 0x04034b50) continue;
      var localNameLength = readUint(view, localOffset + 26, 2), localExtraLength = readUint(view, localOffset + 28, 2), dataStart = localOffset + 30 + localNameLength + localExtraLength;
      var compressed = new Uint8Array(buffer, dataStart, compressedSize), data = method === 0 ? new Uint8Array(compressed) : await inflate(compressed);
      entries[name] = data;
    }
    return entries;
  }
  async function importZip(file, autoOpen) {
    var entries = await readZip(await file.arrayBuffer());
    var courseEntry = entries['course.json'] || entries['./course.json'];
    if (!courseEntry) throw new Error('ZIP 中没有 course.json。');
    var course = JSON.parse(new TextDecoder().decode(courseEntry));
    var assets = {};
    var missingAssets = (course.assets || []).filter(function (asset) {
      return !(entries[asset.path] || entries['./' + asset.path]);
    });
    if (missingAssets.length) throw new Error('课程 ZIP 缺少文件：' + missingAssets.slice(0, 3).map(function (asset) { return asset.path; }).join('、') + '。请确保课程包完整后重新导入。');
    (course.assets || []).forEach(function (asset) {
      var bytes = entries[asset.path] || entries['./' + asset.path];
      /* 转为 base64 data URI 持久化到 course 对象，避免 blob URL 刷新丢失 */
      var b64 = arrayBufferToBase64(bytes.buffer || bytes);
      var mime = mimeFor(asset.fileName);
      var dataUri = 'data:' + mime + ';base64,' + b64;
      assets[asset.path] = dataUri;
      assets[asset.fileName] = dataUri;
      /* 回写 dataUri 到 course.assets 以便 localStorage 持久化 */
      asset._dataUri = dataUri;
    });
    importCourse(course, assets, autoOpen);
  }
  function mimeFor(name) {
    var ext = String(name || '').split('.').pop().toLowerCase();
    return ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/*';
  }
  function arrayBufferToBase64(buffer) {
    var bytes = new Uint8Array(buffer);
    var binary = '';
    for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }
  /** 从持久化的 course 对象重建 assets 映射（_dataUri 字段） */
  function rebuildAssets(course) {
    var assets = {};
    (course.assets || []).forEach(function (asset) {
      if (asset._dataUri) { assets[asset.path] = asset._dataUri; assets[asset.fileName || asset.path] = asset._dataUri; }
    });
    return assets;
  }

  function boot() {
    var _cloud = (global.CL && global.CL.ensureCloud) ? global.CL.ensureCloud() : Promise.resolve();
    _cloud.then(function(){
    dom.library = $('courseLibrary'); dom.player = $('coursePlayer'); dom.courseList = $('courseList'); dom.importMessage = $('importMessage'); dom.playerTitle = $('playerTitle'); dom.playerGuide = $('playerGuide'); dom.playerProgress = $('playerProgress'); dom.playerImage = $('playerImage'); dom.playerScene = $('playerScene'); dom.playerContent = $('playerContent');
    dom.playerCourseTag = $('playerCourseTag'); dom.playerCount = $('playerCount'); dom.playerTotal = $('playerTotal'); dom.btnRestart = $('btnRestart');
    readStoredCourses();
    /* courses.html 播放器专属绑定；decks.html 中这些 DOM 不存在，需守卫 */
    if (dom.player) {
      var backBtn = $('backToLibrary'); if (backBtn) backBtn.onclick = function () { global.location.href = 'decks.html'; };
      var pBack = $('playerBack'); if (pBack) pBack.onclick = function () { global.location.href = 'decks.html'; };
      if (dom.btnRestart) dom.btnRestart.onclick = function () { if (state.active) openCourse(state.active); };
    }
    /* courses.html 独立页（含课程库列表）才绑定导入相关 */
    if (dom.library) {
      $('courseImportButton').onclick = function () { $('courseFile').click(); };
      $('courseFile').onchange = function () {
        var file = $('courseFile').files[0]; if (!file) return;
        $('courseFile').value = '';
        if (!/\.zip$/i.test(file.name)) { showMessage('请导入 ZIP 课程包。', 'error'); return; }
        openClassify(file);
      };
      $('classifyCancel').onclick = closeClassify;
      $('classifyCancel2').onclick = closeClassify;
      $('classifyConfirm').onclick = onClassifyConfirm;
      renderCourseList();
    }
    /* 深链：?id=xxx 直接打开指定课程（播放器场景也支持）
       无 id 时（courses.html 已精简为纯播放器）跳回题库页 */
    var params = new URLSearchParams(global.location.search);
    var openId = params.get('id');
    if (openId) {
      var found = state.courses.find(function (c) { return c.courseId === openId; });
      if (found) { openCourse(found); }
      else { global.location.href = 'decks.html'; }
    } else if (!dom.library && dom.player) {
      global.location.href = 'decks.html';
    }
    });
  }

  function openClassify(file) {
    _pendingFile = file;
    var dl = $('seriesList');
    if (dl) { dl.innerHTML = ''; (window.Library ? Library.knownSeriesOptions() : []).forEach(function (o) { var op = document.createElement('option'); op.value = o.name; dl.appendChild(op); }); }
    $('classifySeries').value = '';
    $('classifyVolume').value = '';
    var msg = $('classifyMsg'); if (msg) { msg.textContent = ''; msg.className = 'msg'; }
    $('classifyMask').hidden = false;
  }
  function closeClassify() { $('classifyMask').hidden = true; _pendingFile = null; }
  function onClassifyConfirm() {
    if (!_pendingFile) return closeClassify();
    var sname = $('classifySeries').value.trim();
    var vidx = $('classifyVolume').value;
    var msg = $('classifyMsg');
    if (!sname) { if (msg) { msg.textContent = '请填写系列名称'; msg.className = 'msg err'; } return; }
    var sid = window.Library ? Library.seriesIdOf(sname) : ('s-' + sname);
    var file = _pendingFile;
    _pendingLib = { seriesId: sid, seriesName: sname, volumeIndex: vidx ? parseInt(vidx, 10) : null, volumeName: vidx ? ('第' + vidx + '册') : null };
    closeClassify();
    (function () {
      var p = importZip(file);
      if (p && p.catch) p.catch(function (error) { showMessage('导入失败：' + error.message, 'error'); });
      else if (p && p.then) p.then(null, function (error) { showMessage('导入失败：' + error.message, 'error'); });
      _pendingLib = null;
    })();
  }

  global.ChunkCourse = {
    boot: boot,
    importCourse: function (c, a, autoOpen) { return importCourse(c, a, autoOpen); },
    /** 从 decks.html 弹窗调用：选文件后触发归类→导入 */
    importFile: function (file) {
      if (!/\.zip$/i.test(file.name)) return { ok: false, error: '请导入 ZIP 课程包' };
      _pendingFile = file;
      openClassify(file);
      return { ok: true };
    },
    /** 直接导入（decks.html 统一弹窗场景：从 window._pendingLibForImport 读取层级元数据） */
    importZipDirect: function (file) {
      if (!/\.zip$/i.test(file.name)) return Promise.reject('请导入 ZIP 课程包');
      /* 读取 decks.html 弹窗设置的层级元数据 */
      var extLib = global._pendingLibForImport || null;
      if(extLib){
        _pendingLib = {
          seriesId: extLib.seriesId,
          seriesName: extLib.seriesName,
          volumeIndex: extLib.volumeIndex,
          volumeName: extLib.volumeName,
          level2Name: extLib.level2Name || null,
          sortOrder: 0
        };
        global._pendingLibForImport = null; // 消费一次
      }
      var p = importZip(file, false);
      if(p && p.catch) p.catch(function(e){ showMessage('导入失败：'+e.message, 'error'); });
      return p;
    },
    /** 刷新课程列表（供外部调用） */
    refreshList: function () { readStoredCourses(); renderCourseList(); }
  };
  /* 启动：先完成 IndexedDB 预载（courses/progress 内存桥），再渲染列表 */
  document.addEventListener('DOMContentLoaded', function () {
    var cl = window.CL;
    var start = function () { boot(); };
    if (cl && cl.preload) { cl.preload().then(start); } else { start(); }
  });
})(window);
