/* Chunk Lab · CoursePackage 1.1 local reader and linear runtime. */
(function (global) {
  'use strict';
  var businessStorage=global.AccountStorage ? global.AccountStorage.storage : global.localStorage;

  var COURSE_STORE_KEY = 'chunklab.courses.v1';
  var PROGRESS_STORE_KEY = 'chunklab.course-progress.v1';
  var DECK_STORE_KEY = 'chunklab.v1';
  var state = { courses: [], active: null, nodeId: '', gapAnswers: [], feedback: '', moduleStage: 'core', assessmentIndex: 0, moduleAnswer: '', moduleFeedback: '', audio: null, practiceMode: null, v2ModeConfirmed: false, v2Index: 0, v2SelectedChunks: [], v2ChunkOrderItemId: '', v2ChunkOrder: [], v2ChunkWrong: false, v2Answered: false, v2TypedAnswer: '', v2TypingValue: '', v2TypingAttempts: 0, v2AdvanceTimer: 0 };
  var _pendingFile = null;  // 导入时挂起的文件
  var dom = {};
  var serverProgressView = null;
  var serverCoursesView = null;
  var serverProgressIdentity = null;
  function progressIdentity() {
    global.AccountStorage.assertCurrent();
    return JSON.stringify([global.AccountStorage.owner, global.AccountStorage.sessionEpoch || '', global.ChunkAPI.getBase()]);
  }

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
  function setPlayerTitle(course) {
    var title = course && course.metadata && course.metadata.title;
    var englishTitle = englishText(title);
    var chineseTitle = title && typeof title === 'object' ? title['zh-CN'] || '' : '';
    if (dom.playerTitle) dom.playerTitle.textContent = englishTitle || chineseTitle || '未命名课程';
    if (dom.playerTitleTranslation) {
      dom.playerTitleTranslation.textContent = englishTitle && chineseTitle && englishTitle !== chineseTitle ? chineseTitle : '';
      dom.playerTitleTranslation.hidden = !dom.playerTitleTranslation.textContent;
    }
  }
  function courseDescription(course) { return localized(course && course.metadata && course.metadata.description); }
  /* 大对象已迁 IndexedDB（CL 内存桥）：读写统一走 CL；未加载时回退 localStorage 旧值 */
  function storedCourses() {
    if (serverCoursesView) {
      if (progressIdentity() !== serverProgressIdentity) throw new Error('账号或服务已切换，请重新打开课程。');
      return JSON.parse(JSON.stringify(serverCoursesView));
    }
    /* Never present the device's old aggregate as the P3 account catalog while
       the server-confirmed projection is still being recovered. */
    if (protocol3Active()) return [];
    var cl = window.CL;
    if (cl && cl.readCourses) {
      var c = cl.readCourses();
      return Array.isArray(c) ? c : [];
    }
    try {
      var raw = JSON.parse(businessStorage.getItem(COURSE_STORE_KEY) || '[]');
      return Array.isArray(raw) ? raw : [];
    } catch (e) { return []; }
  }
  function readStoredCourses() {
    state.courses = storedCourses().filter(function (course) { return validateCourse(course).length === 0; });
  }
  async function persistCourses(courses) {
    var cl = window.CL;
    if (cl && cl.writeCourses) return cl.writeCourses(courses);
    if (protocol3Active()) {
      var error = new Error('课程保存服务尚未就绪；本次更改未保存，请稍后重试。');
      error.code = 'PROTOCOL3_NARROW_WRITE_REQUIRED';
      throw error;
    }
    businessStorage.setItem(COURSE_STORE_KEY, JSON.stringify(courses));
  }
  function storedProgress() {
    if (serverProgressView) {
      if (progressIdentity() !== serverProgressIdentity) throw new Error('账号或服务已切换，请重新打开课程。');
      return JSON.parse(JSON.stringify(serverProgressView));
    }
    if (protocol3Active()) return {};
    var cl = window.CL;
    if (cl && cl.readProgress) {
      var p = cl.readProgress();
      return (p && typeof p === 'object') ? p : {};
    }
    try {
      var all = JSON.parse(businessStorage.getItem(PROGRESS_STORE_KEY) || '{}');
      return (all && typeof all === 'object') ? all : {};
    } catch (error) { return {}; }
  }
  async function persistProgress(all) {
    var cl = window.CL;
    if (cl && cl.writeProgress) await cl.writeProgress(all);
    else if (protocol3Active()) {
      var error = new Error('课程进度保存服务尚未就绪；本次进度未更改，请稍后重试。');
      error.code = 'PROTOCOL3_NARROW_WRITE_REQUIRED';
      throw error;
    } else businessStorage.setItem(PROGRESS_STORE_KEY, JSON.stringify(all));
    if (serverProgressView) serverProgressView = JSON.parse(JSON.stringify(all));
  }
  async function persistCourseOperation(course) {
    assertServerReady();
    var cache=await global.ServerCache.read();
    if(!cache || cache.owner!==global.AccountStorage.owner) throw new Error('课程数据尚未从服务器确认；导入未提交。');
    var current=(cache.snapshot.courses||[]).find(function(item){return item.courseId===course.courseId;});
    if(current && JSON.stringify(current)===JSON.stringify(course)) return current;
    var expectedRev=current ? cache.snapshot.revs.courses[course.courseId] : null;
    var requestId=operationId('course-put');
    var operation={protocol:3,requestId:requestId,type:'course.put',expectedRev:expectedRev,
      payload:{course:course}};
    var operationBytes=new TextEncoder().encode(JSON.stringify(operation)).byteLength;
    if(operationBytes>79*1024*1024) throw new Error('课程内容超过单次导入上限，请压缩图片或拆分课程后重试。');
    // Even very large imports enter IndexedDB before any network request. The
    // durable queue retries with this same requestId after disconnects/reloads.
    await global.ServerStore.submitCommitted('course.put',{course:course},{requestId:requestId,expectedRev:expectedRev});
    var confirmed=await global.ServerCache.read();
    if(!confirmed || confirmed.owner!==global.AccountStorage.owner) throw new Error('课程已发送，确认状态暂不可用；请刷新查看结果。');
    serverCoursesView=confirmed.snapshot.courses||[];
    serverProgressView=global.ServerCache.projectCourseProgress(confirmed,await global.ServerStore.pending());
    serverProgressIdentity=progressIdentity();
    return (serverCoursesView||[]).find(function(item){return item.courseId===course.courseId;})||course;
  }
  async function deleteCourseOperation(courseId) {
    assertServerReady();
    var cache=await global.ServerCache.read();
    if(!cache || cache.owner!==global.AccountStorage.owner) throw new Error('课程数据尚未从服务器确认；删除未提交。');
    var current=(cache.snapshot.courses||[]).find(function(item){return item.courseId===courseId;});
    if(!current) throw new Error('找不到这门课程，可能已被删除');
    var expectedRev=cache.snapshot.revs.courses[courseId];
    await global.ServerStore.submitCommitted('course.delete',{courseId:courseId},
      {requestId:operationId('course-delete'),expectedRev:expectedRev});
    await global.ServerCache.refresh();
    var confirmed=await global.ServerCache.read();
    if(!confirmed || confirmed.owner!==global.AccountStorage.owner) throw new Error('删除已发送，确认状态暂不可用；请刷新查看结果。');
    serverCoursesView=confirmed.snapshot.courses||[];
    serverProgressView=global.ServerCache.projectCourseProgress(confirmed,await global.ServerStore.pending());
    serverProgressIdentity=progressIdentity();
    return true;
  }
  async function loadServerProgress() {
    if (!protocol3Active()) return;
    assertServerReady();
    var identity = progressIdentity();
    var owner = global.AccountStorage.owner;
    var cache = await global.ServerCache.read();
    var pending = await global.ServerStore.pending();
    global.AccountStorage.assertCurrent();
    if (!cache || cache.owner !== owner || progressIdentity() !== identity) {
      throw new Error('课程进度尚未读取，请稍后重试。');
    }
    serverProgressView = global.ServerCache.projectCourseProgress(cache, pending);
    serverProgressIdentity = identity;
    serverCoursesView = cache.snapshot.courses || [];
    if(typeof global.CL.adoptServerProgressProjection!=='function') throw new Error('本地课程进度确认视图暂不可用。');
    await global.CL.adoptServerProgressProjection(serverProgressView);
  }
  function progressFor(courseId) {
    var all = storedProgress();
    return all[courseId] || { seen: [], passed: [], completed: false, currentNodeId: '' };
  }
  async function adoptCurrentServerProgressProjection() {
    assertProgressQueueAvailable();
    if (!global.ServerCache || typeof global.ServerCache.projectCourseProgress !== 'function' ||
        typeof global.CL.adoptServerProgressProjection !== 'function') {
      throw new Error('课程确认视图暂不可用；进度保留待重试。');
    }
    var identity=progressIdentity(), owner=global.AccountStorage.owner;
    var values=await Promise.all([global.ServerCache.read(),global.ServerStore.pending()]);
    global.AccountStorage.assertCurrent();
    if(!values[0]||values[0].owner!==owner||progressIdentity()!==identity) {
      throw new Error('账号或课程服务已切换；请重新打开课程核对进度。');
    }
    var projection=global.ServerCache.projectCourseProgress(values[0],values[1]);
    await global.CL.adoptServerProgressProjection(projection);
    global.AccountStorage.assertCurrent();
    serverProgressView=JSON.parse(JSON.stringify(projection));
    serverProgressIdentity=identity;
    return serverProgressView;
  }
  var progressSaveTail = Promise.resolve();
  function protocol3Active() {
    var config = global.CL && global.CL.getCloudConfig ? global.CL.getCloudConfig() : null;
    return !!(config && config.persistenceMode === 'server-authoritative' && Number(config.writeProtocol) === 3);
  }
  function operationId(prefix) {
    if (global.crypto && typeof global.crypto.randomUUID === 'function') return global.crypto.randomUUID();
    return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2) + '-' + Math.random().toString(36).slice(2);
  }
  function assertServerReady() {
    if (!global.CL || !global.CL.serverPersistenceReady || !global.CL.serverPersistenceReady() ||
        !global.ServerStore || typeof global.ServerStore.submit !== 'function') {
      throw new Error('课程服务暂不可用；本次进度未更改，请稍后重试。');
    }
  }
  function assertProgressQueueAvailable() {
    if(!protocol3Active() || !global.AccountStorage || !global.ServerStore ||
        typeof global.ServerStore.submit !== 'function'){
      throw new Error('学习记录暂时无法保存，请稍后重试。');
    }
    global.AccountStorage.assertCurrent();
  }
  function saveProgress(courseId, nodeId, completed, passed, currentNodeId, course) {
    // 同一标签页串行合并；协议 3 先耐久入队，确认后再推进本机进度投影。
    var task = progressSaveTail.then(async function(){
      var all = storedProgress();
      var progress = all[courseId] || { seen: [], passed: [], completed: false, currentNodeId: '' };
      if (!Array.isArray(progress.seen)) progress.seen = [];
      if (!Array.isArray(progress.passed)) progress.passed = [];
      var changed = false;
      if (nodeId && progress.seen.indexOf(nodeId) < 0) { progress.seen.push(nodeId); changed = true; }
      if (passed && nodeId && progress.passed.indexOf(nodeId) < 0) { progress.passed.push(nodeId); changed = true; }
      if (completed && !progress.completed) { progress.completed = true; changed = true; }
      if (currentNodeId && progress.currentNodeId !== currentNodeId) { progress.currentNodeId = currentNodeId; changed = true; }
      if (course) {
        var courseVersion = course.version || '';
        if (progress.courseVersion !== courseVersion) { progress.courseVersion = courseVersion; changed = true; }
        var profile = global.CoursePackageContract && global.CoursePackageContract.detectProfile(course);
        if (profile && progress.runtimeProfile !== profile.id) { progress.runtimeProfile = profile.id; changed = true; }
      }
      if (!changed) return true;
      all[courseId] = progress;
      if (protocol3Active()) {
        assertProgressQueueAvailable();
        var confirmed = global.ServerCache && await global.ServerCache.read();
        if(!confirmed || confirmed.owner !== global.AccountStorage.owner)
          throw new Error('尚未加载账号学习记录，请连接网络后重试。');
        var payload = { courseId:courseId, nodeId:nodeId || null, passed:!!passed, completed:!!completed,
          currentNodeId:currentNodeId || null, generation:Number(progress.generation)||0 };
        if (course) {
          payload.courseVersion = course.version || '';
          var runtime = global.CoursePackageContract && global.CoursePackageContract.detectProfile(course);
          if (runtime) payload.runtimeProfile = runtime.id;
        }
        await global.ServerStore.submit('course.progress', payload, { requestId:operationId('course-progress') });
        await adoptCurrentServerProgressProjection();
        return true;
      }
      await persistProgress(all);
      return true;
    });
    progressSaveTail = task.catch(function(){ return false; });
    return task.catch(function(){
      showMessage('学习进度暂未保存，本课停留在当前步骤；请重试。', 'error');
      return false;
    }).catch(function(){
      return false;
    });
  }

  function restartCourse(recordOrCourse) {
    var record = recordOrCourse.course ? recordOrCourse : { course: recordOrCourse, assets: rebuildAssets(recordOrCourse) };
    var courseId = record.course.courseId;
    var task = progressSaveTail.then(async function () {
      if (protocol3Active()) {
        assertServerReady();
        if (typeof global.ServerStore.submitCommitted !== 'function') throw new Error('课程重学暂不可用；本次进度未更改。');
        var requestId = operationId('course-restart');
        var receipt = await global.ServerStore.submitCommitted('course.restart',
          { eventId:requestId, courseId:courseId }, { requestId:requestId });
        var operationResult = receipt && (receipt.operation ||
          (Array.isArray(receipt.changes) ? receipt.changes[0] : null));
        if (!receipt || receipt.outcome === 'retained' || !operationResult) {
          throw new Error('服务端未确认课程重学；原进度已保留。');
        }
        var confirmedProgress=await adoptCurrentServerProgressProjection();
        var remoteProgress=confirmedProgress[courseId];
        if(!remoteProgress || Number(remoteProgress.generation)!==Number(operationResult.generation) ||
           remoteProgress.completed || remoteProgress.seen.length || remoteProgress.passed.length) {
          throw new Error('课程已重学，但确认进度视图尚未更新；请刷新核对。');
        }
        openCourse(record);
        return true;
      }
      var all = storedProgress();
      delete all[courseId];
      await persistProgress(all);
      openCourse(record);
    });
    progressSaveTail = task.catch(function(){ return false; });
    return task.catch(function () {
      showMessage('课程重学暂未完成，原进度已保留；请重试。', 'error');
      return false;
    });
  }

  function validateCourse(course) {
    var errors = [];
    if (!course || typeof course !== 'object' || Array.isArray(course)) return ['顶层必须是 CoursePackage 对象'];
    if (typeof course.courseId === 'string' && course.courseId.indexOf('enrollment:v1:') === 0) errors.push('courseId 使用了系统保留标识 enrollment:v1:，请修改课程 ID 后重新导入');
    if (course.schemaVersion === '2.0') return errors.concat(global.CoursePackageContract && global.CoursePackageContract.validateCourseV2 ? global.CoursePackageContract.validateCourseV2(course) : ['2.0 课程校验器未加载']);
    if (course.schemaVersion !== '1.1') errors.push('仅支持 schemaVersion 1.1');
    if (!course.courseId || !course.version) errors.push('缺少 courseId 或 version');
    ['metadata', 'learningObjectives', 'assets', 'scenes', 'npcs', 'story', 'completion'].forEach(function (key) {
      if (!course[key]) errors.push('缺少必需区域：' + key);
    });
    validateCourseSemantics(course, errors);
    if (course.deliveryMode !== 'typing_only' || course.contentShape !== 'article') errors.push('1.1 课程必须是 article + typing_only');
    var policy = course.answerPolicy || {};
    if (policy.normalization !== 'english-typing-v1' || policy.unicode !== 'NFKC' || policy.trim !== true || policy.collapseWhitespace !== true || policy.ignoreAsciiCase !== true || policy.punctuation !== 'exact') errors.push('1.1 answerPolicy 不符合 english-typing-v1');
    if (global.CoursePackageContract) {
      var profile = global.CoursePackageContract.detectProfile(course);
      if (!profile) errors.push('无法识别 1.1 课程练习能力：需要 sourceText typing');
      errors.push.apply(errors, global.CoursePackageContract.validateCourseGraph(course));
    }
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
    if (semantics.schemaVersion !== '0.2') errors.push('不支持的 courseSemantics.schemaVersion');
    if (semantics.courseType !== 'image_article') errors.push('不支持的课程类型：' + (semantics.courseType || '未声明'));
    if (semantics.learningFlow !== 'story_graph') errors.push('不支持的课程学习流程：' + (semantics.learningFlow || '未声明'));
    if (!Array.isArray(semantics.learnerRoleIds) || !Array.isArray(semantics.roleSources)) errors.push('courseSemantics 角色说明不完整');
    if (!Array.isArray(semantics.exerciseModels) || JSON.stringify(semantics.exerciseModels) !== JSON.stringify(['typing'])) errors.push('courseSemantics.exerciseModels 必须为 typing');
    if (!semantics.modules || semantics.modules.core !== true || typeof semantics.modules.preStudy !== 'boolean' || typeof semantics.modules.postAssessment !== 'boolean') errors.push('courseSemantics.modules 必须声明 core、preStudy 和 postAssessment');
    var fields = semantics.fields || {};
    var expectedFields = {
      sceneDialogue: 'story.nodes[].npcMessage', learnerTarget: 'story.nodes[].sourceText', acceptedAnswers: 'story.nodes[].acceptedAnswers.en',
      translation: 'localizedText[locale]', exerciseInstruction: 'story.nodes[].input.prompt', speaker: 'story.nodes[].npcId'
    };
    Object.keys(expectedFields).forEach(function (key) { if (fields[key] !== expectedFields[key]) errors.push('courseSemantics.fields.' + key + ' 含义不受支持'); });
    var roles = semantics.roles || {};
    if (!Array.isArray(roles.learnerRoles) || roles.speakers !== 'npcs[]' || roles.speakerReference !== 'story.nodes[].npcId') errors.push('1.1 courseSemantics.roles 含义不受支持');
    var flow = semantics.flow || {};
    if (flow.entryPoint !== 'story.startNodeId' || flow.nextNode !== 'story.nodes[].transitions[].toNodeId' || flow.completion !== 'completion.endings') errors.push('courseSemantics.flow 含义不受支持');
    var assets = semantics.assets || {};
    if (assets.catalog !== 'assets[]' || assets.reference !== '*AssetId' || assets.filePath !== 'assets[].path') errors.push('courseSemantics.assets 含义不受支持');
    if (course.metadata && semantics.primaryLocale !== course.metadata.learningLocale) errors.push('courseSemantics.primaryLocale 与 metadata.learningLocale 不一致');
    if (course.metadata && JSON.stringify(semantics.supportLocales || []) !== JSON.stringify(course.metadata.supportLocales || [])) errors.push('courseSemantics.supportLocales 与 metadata.supportLocales 不一致');
    if ((semantics.learnerRoleIds || []).length) errors.push('1.1 不支持 learnerRoleIds');
  }

  function validateCourseGuide(course, errors) {
    var guide = course && course.courseGuide;
    if (!guide || typeof guide !== 'object') {
      errors.push('缺少课程使用说明：courseGuide；请检查课程包是否完整');
      return;
    }
    if (guide.schemaVersion !== '0.2') errors.push('不支持的 courseGuide.schemaVersion');
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
    if (course && course.schemaVersion === '2.0') return ['模式自选'];
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
  function stopAudio() {
    if (state.audio) {
      try { state.audio.pause(); state.audio.currentTime = 0; } catch (e) {}
      state.audio = null;
    }
  }
  function playAudio(url, button) {
    if (!url) return;
    stopAudio();
    var audio = new Audio(url);
    state.audio = audio;
    if (button) {
      button.dataset.audioState = 'loading';
      audio.addEventListener('canplay', function () { button.dataset.audioState = 'ready'; });
      audio.addEventListener('error', function () { button.dataset.audioState = 'error'; });
    }
    audio.play().catch(function () { showMessage('浏览器阻止了自动播放，请再次点击音频按钮。', 'error'); });
  }
  function assetUrl(record, assetId) {
    if (!record || !assetId) return '';
    var asset = getAsset(record.course, assetId);
    if (!asset) return '';
    return record.assets[asset.path] || (asset._dataUri || '');
  }

  function renderCourseList() {
    if (!dom.courseList) return;
    if (!state.courses.length) {
      dom.courseList.innerHTML = '<div class="empty-course"><div class="empty-mark">' + (global.Icons ? global.Icons.svg('sparkle') : '') + '</div><strong>还没有本地图文课程</strong><span>导入完整的课程 ZIP，开始建立你的课程库。</span></div>';
      return;
    }
    dom.courseList.innerHTML = state.courses.map(function (course, index) {
      var progress = progressFor(course.courseId);
      var nodeCount = course.schemaVersion === '2.0' ? ((course.sequence || []).length + ' 条台词') : (course.story && course.story.nodes ? course.story.nodes.length : 0) + ' 个节点';
      var modules = courseModuleLabels(course).join(' · ');
      return '<button class="course-row" data-course-index="' + index + '">' +
        '<span class="course-row-mark">' + (progress.completed
          ? (global.Icons ? global.Icons.svg('check') : '')
          : (global.Icons ? global.Icons.svg('sparkle') : '')) + '</span>' +
        '<span class="course-row-main"><strong>' + esc(courseTitle(course)) + '</strong><small>' + esc(courseDescription(course)) + '</small></span>' +
        '<span class="course-row-meta"><b>' + esc(course.metadata.targetCefr || '—') + '</b><small>' + esc(nodeCount) + '</small><small>' + esc(modules) + '</small></span>' +
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
    if (view !== 'player' && state.v2AdvanceTimer) {
      global.clearTimeout(state.v2AdvanceTimer);
      state.v2AdvanceTimer = 0;
    }
    if (dom.library) dom.library.classList.toggle('hidden', view !== 'library');
    if (dom.player) dom.player.classList.toggle('hidden', view !== 'player');
  }

  function openCourse(recordOrCourse) {
    if (state.v2AdvanceTimer) global.clearTimeout(state.v2AdvanceTimer);
    state.v2AdvanceTimer = 0;
    var record = recordOrCourse.course ? recordOrCourse : { course: recordOrCourse, assets: rebuildAssets(recordOrCourse) };
    var course = record.course;
    var oldAiMarkers = course.authorNotes && course.authorNotes.chunklabAuthoring || [];
    if (course.schemaVersion === '2.0' && oldAiMarkers.indexOf('format=chunklab-ai-course') >= 0 && oldAiMarkers.indexOf('formatVersion=1.0') >= 0 && global.CL && global.CL.findDeck) {
        var nativeMem = global.CL.loadMem();
        var retired = global.CourseLearningLaunch && global.CourseLearningLaunch.isRetired
          ? global.CourseLearningLaunch.isRetired(course.courseId, nativeMem) : false;
        var nativeCopy = retired ? null : global.CL.findDeck(nativeMem, course.courseId);
      if (nativeCopy && nativeCopy.authoring && nativeCopy.authoring.legacySource && nativeCopy.authoring.legacySource.courseId === course.courseId) {
        global.location.href = 'main.html?course=' + encodeURIComponent(nativeCopy.authoring.catalogCourseId || 'package:' + course.courseId) + '&lesson=' + encodeURIComponent('lesson:story-package:' + course.courseId);
        return;
      }
      if (dom.playerContent) {
        state.active = record;
        setPlayerTitle(course);
        if (dom.playerCourseTag) dom.playerCourseTag.textContent = course.metadata && course.metadata.targetCefr || '';
        if (dom.playerImage) dom.playerImage.innerHTML = '';
        var stage = dom.playerContent.closest('.course-stage');
        if (stage) stage.classList.add('no-image');
        setView('player');
        renderLegacyLaunch(course.courseId, courseTitle(course));
        return;
      }
    }
    state.active = record;
    state.nodeId = course.schemaVersion === '2.0' ? '' : course.story.startNodeId;
    state.gapAnswers = [];
    state.feedback = '';
    state.v2ModeConfirmed = false;
    state.assessmentIndex = 0;
    state.moduleAnswer = '';
    state.moduleFeedback = '';
    var authoredImageLearning = course.authorNotes && course.authorNotes.chunklabImageText;
    state.practiceMode = authoredImageLearning && authoredImageLearning.format === 'chunklab-ai-image-text'
      && authoredImageLearning.formatVersion === '1.0' && authoredImageLearning.learning
      && Array.isArray(authoredImageLearning.learning.modes) && authoredImageLearning.learning.modes.indexOf(authoredImageLearning.learning.defaultMode) >= 0
      ? authoredImageLearning.learning.defaultMode : null;
    state.v2SelectedChunks = [];
    state.v2ChunkOrderItemId = '';
    state.v2ChunkOrder = [];
    state.v2ChunkWrong = false;
    state.v2Answered = false;
    state.v2TypedAnswer = '';
    state.v2TypingValue = '';
    state.v2TypingAttempts = 0;

    if (course.schemaVersion === '2.0') {
      var initialModes = v2ModeList(course);
      if (!initialModes.some(function (mode) { return mode.id === state.practiceMode && mode.enabled; })) {
        var defaultMode = initialModes.find(function (mode) { return mode.id === 'chunkSelection' && mode.enabled; }) ||
          initialModes.find(function (mode) { return mode.id === 'typing' && mode.enabled; });
        state.practiceMode = defaultMode ? defaultMode.id : null;
      }
      var v2Sequence = course.sequence || [];
      var v2Progress = progressFor(course.courseId);
      state.moduleStage = v2Progress.completed ? 'done' : 'core';
      state.v2Index = v2Progress.currentNodeId && v2Sequence.indexOf(v2Progress.currentNodeId) >= 0
        ? v2Sequence.indexOf(v2Progress.currentNodeId)
        : Math.min(v2Progress.passed.filter(function (id) { return v2Sequence.indexOf(id) >= 0; }).length, Math.max(0, v2Sequence.length - 1));
      setView('player');
      renderNode();
      return;
    }

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
        if (progress.currentNodeId && getNode(course, progress.currentNodeId)) state.nodeId = progress.currentNodeId;
        else if (lastSeenNode) state.nodeId = lastSeenId;
      }
    } else {
      state.moduleStage = hasPreStudy ? 'preStudy' : 'core';
    }

    setView('player');
    renderNode();
  }

  function renderLegacyLaunch(courseId, title) {
    var root = dom.playerContent;
    if (!root) return;
    root.innerHTML = '<div class="node-label">句子课程</div><h2>正在检查课程内容…</h2><p class="source-line" role="status">准备接入现有的句子练习。</p>';
    if (!global.CourseLearningLaunch || typeof global.CourseLearningLaunch.create !== 'function') {
      root.innerHTML = '<div class="node-label">暂时无法开始</div><h2>学习功能没有加载完成</h2><p class="source-line">请刷新页面后重试。课程内容和学习记录没有改变。</p><div class="node-actions"><button class="action-button primary" data-legacy-retry>重试</button></div>';
      root.querySelector('[data-legacy-retry]').onclick = function () { renderLegacyLaunch(courseId, title); };
      return;
    }
    var launcher;
    try { launcher = global.CourseLearningLaunch.create(); }
    catch (error) { renderLegacyLaunchError(courseId, title, error); return; }

    function showError(error, retry) { renderLegacyLaunchError(courseId, title, error, retry); }
    function start(confirmed) {
      root.innerHTML = '<div class="node-label">句子课程</div><h2>正在准备练习…</h2><p class="source-line" role="status">课程内容和旧学习记录会保留。</p>';
      launcher.launch(courseId, { confirmed: confirmed }).then(function (result) {
        if (result.kind === 'launched') {
          global.location.replace('main.html?course=' + encodeURIComponent(result.receipt.catalogCourseId) + '&lesson=' + encodeURIComponent(result.receipt.lessonId));
          return;
        }
        if (result.kind === 'confirmation-required') { renderConfirmation(result); return; }
        if (result.kind === 'blocked') { renderBlocked(result); return; }
        showError(new Error('无法识别这门课程的内容格式。'));
      }).catch(function (error) { showError(error, function () { start(confirmed); }); });
    }
    function renderConfirmation(result) {
      var notices = (result.warnings || []).map(function (item) { return '<li>' + esc(item.message) + '</li>'; }).join('');
      var history = result.history || {};
      var prior = (history.seen && history.seen.length) || (history.passed && history.passed.length);
      root.innerHTML = '<div class="node-label">使用现有练习</div><h2>' + esc(title) + '</h2><p class="source-line">这门旧课程可以转换为句子练习。原课程和旧记录会保留，新练习记录从实际答题开始。</p>' +
        (result.retired ? '<p class="node-feedback bad">你之前删除过转换出的课程。确认后会重新建立句子课程；旧课程和旧学习记录仍保留。</p>' : '') +
        (notices ? '<div class="node-feedback bad"><strong>转换前请留意</strong><ul>' + notices + '</ul></div>' : '') +
        (prior ? '<p class="source-line">旧课程已有学习记录，仍可在原课程中查看。</p>' : '') +
        '<div class="node-actions"><button class="action-button primary" data-legacy-confirm>转换并开始练习</button><button class="action-button" data-legacy-cancel>返回课程库</button></div>';
      root.querySelector('[data-legacy-confirm]').onclick = function () { start(true); };
      root.querySelector('[data-legacy-cancel]').onclick = function () { global.location.href = catalogReturnHref(); };
    }
    function renderBlocked(result) {
      var issues = (result.blockers || []).map(function (item) { return '<li>' + esc(item.message) + '</li>'; }).join('');
      root.innerHTML = '<div class="node-label">需要调整课程</div><h2>' + esc(title) + '</h2><p class="source-line">以下内容无法完整接入现有句子练习。原课程仍然保留。</p><div class="node-feedback bad"><ul>' + issues + '</ul></div><div class="node-actions"><a class="action-button primary" href="course-create.html?convert=' + encodeURIComponent(courseId) + '">查看修复建议</a><button class="action-button" data-legacy-cancel>返回课程库</button></div>';
      root.querySelector('[data-legacy-cancel]').onclick = function () { global.location.href = catalogReturnHref(); };
    }
    launcher.inspect(courseId).then(function (result) {
      if (result.kind === 'native-ready') start(false);
      else if (result.kind === 'confirmation-required') renderConfirmation(result);
      else if (result.kind === 'blocked') renderBlocked(result);
      else showError(new Error('无法识别这门课程的内容格式。'));
    }).catch(showError);
  }

  function renderLegacyLaunchError(courseId, title, error, retry) {
    var root = dom.playerContent;
    if (!root) return;
    root.innerHTML = '<div class="node-label">课程没有改变</div><h2>' + esc(title) + '</h2><p class="source-line" role="alert">' + esc(error && error.message || '准备练习失败，请重试。') + '</p><div class="node-actions"><button class="action-button primary" data-legacy-retry>重试</button><button class="action-button" data-legacy-cancel>返回课程库</button></div>';
    root.querySelector('[data-legacy-retry]').onclick = retry || function () { renderLegacyLaunch(courseId, title); };
    root.querySelector('[data-legacy-cancel]').onclick = function () { global.location.href = catalogReturnHref(); };
  }

  function renderImage(record, node) {
    var assetId = nodeAssetId(record.course, node);
    if (!assetId) return { html: '', hasImage: false, assetMissing: false };
    var asset = getAsset(record.course, assetId);
    var url = assetUrl(record, assetId);
    if (url) return { html: '<img draggable="false" src="' + esc(url) + '" alt="' + esc(localized(asset && asset.alt)) + '">', hasImage: true, assetMissing: false };
    return {
      html: '<div class="image-placeholder"><span class="ph-ico">' + (global.Icons ? global.Icons.svg('image') : '') + '</span><small>课程包缺少图片：' + esc(asset ? (asset.fileName || asset.id) : assetId) + '<br>图片不影响学习，可继续练习</small></div>',
      hasImage: false,
      assetMissing: true
    };
  }

  function renderNode() {
    var record = state.active;
    if (!record) return;
    stopAudio();
    var course = record.course;
    var progress = progressFor(course.courseId);
    if (course.schemaVersion === '2.0') return renderV2Node(record, progress);
    var total = (course.story.nodes || []).filter(function (node) { return node.type === 'interaction'; }).length;
    var profile = global.CoursePackageContract && global.CoursePackageContract.detectProfile(course);
    var seen = profile && profile.sourceText && Array.isArray(progress.passed) ? progress.passed.filter(function (id) { var item = getNode(course, id); return item && item.type === 'interaction'; }).length : progress.seen.filter(function (id) { var item = getNode(course, id); return item && item.type === 'interaction'; }).length;
    setPlayerTitle(course);
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
    saveProgress(course.courseId, node.id, node.type === 'end', false, node.id, course);
    var imageResult = renderImage(record, node);
    dom.playerImage.innerHTML = imageResult.html;
    var stageEl = dom.playerImage.closest('.course-stage');
    if (stageEl) {
      stageEl.classList.toggle('no-image', !imageResult.hasImage && !imageResult.assetMissing);
      stageEl.classList.toggle('missing-image', imageResult.assetMissing);
    }
    /* 图片保持静止，避免节点重绘时产生边缘闪动。 */
    dom.playerImage.classList.remove('image-enter');
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
      if (!item) return '<div class="module-screen"><div class="end-mark">' + (global.Icons ? global.Icons.svg('check') : '') + '</div><div class="node-label">课后测试</div><h2>测试完成</h2><p class="node-copy">' + esc(localized(post.description)) + '</p><div class="node-actions"><button class="action-button primary" data-action="finish-course">完成课程</button></div></div>';
      var html = '<div class="module-screen"><div class="node-label">课后测试 · ' + (state.assessmentIndex + 1) + '/' + post.items.length + '</div><h2>' + esc(localized(post.title)) + '</h2><p class="node-copy">' + esc(localized(item.prompt)) + '</p>';
      if (item.type === 'choice') html += '<div class="choice-list">' + item.choices.map(function (choice) { return '<button class="choice-option ' + (state.moduleAnswer === choice.id ? 'selected' : '') + '" data-assess-choice="' + esc(choice.id) + '"><span>' + esc(english(choice.text) || localized(choice.text)) + '</span><small>' + esc(localized(choice.text)) + '</small></button>'; }).join('') + '</div>';
      else html += '<div class="typing-box"><input id="moduleTyping" type="text" autocomplete="off" placeholder="输入你的英语答案…" value="' + esc(state.moduleAnswer) + '"></div>';
      if (state.moduleFeedback) html += '<div class="node-feedback ' + (state.moduleFeedback.kind || '') + '">' + esc(state.moduleFeedback.text) + '</div>';
      return html + '<div class="node-actions"><button class="action-button primary" data-action="submit-assessment">检查答案</button></div></div>';
    }
    return '<div class="module-screen"><div class="end-mark">' + (global.Icons ? global.Icons.svg('check') : '') + '</div><div class="node-label">课程完成</div><h2>学习完成</h2><p class="node-copy">你已完成主课程和课后测试。</p><div class="node-actions"><button class="action-button primary" data-action="back-library">返回课程库</button><button class="action-button" data-action="restart">再学一次</button></div></div>';
  }

  function bindModuleActions(course) {
    dom.playerContent.querySelectorAll('[data-action="start-core"]').forEach(function (button) { button.onclick = function () { state.moduleStage = 'core'; state.moduleFeedback = ''; renderNode(); }; });
    dom.playerContent.querySelectorAll('[data-action="finish-course"]').forEach(function (button) { button.onclick = function () { state.moduleStage = 'done'; state.moduleFeedback = ''; renderNode(); }; });
    dom.playerContent.querySelectorAll('[data-action="back-library"]').forEach(function (button) { button.onclick = function () { setView('library'); renderCourseList(); }; });
    dom.playerContent.querySelectorAll('[data-action="restart"]').forEach(function (button) { button.onclick = function () { restartCourse(course); }; });
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
    return '<div class="end-mark">' + (global.Icons ? global.Icons.svg('check') : '') + '</div><div class="node-label">课程节点完成</div><h2>' + esc(localized(ending && ending.label) || '完成') + '</h2>' +
      '<p class="node-copy">' + esc(localized(ending && ending.description) || localized(endMessage)) + '</p>' +
      '<div class="node-actions">' + nextAction + '<button class="action-button" data-action="restart">再学一次</button></div>';
  }

  function renderAudioIconButton(audioUrl) {
    if (!audioUrl) return '';
    var icon = global.Icons ? global.Icons.svg('sound') : '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 9v6h4l5 4V5L8 9H4zm12.5 3a4.5 4.5 0 0 0-2.5-4.03v8.05a4.5 4.5 0 0 0 2.5-4.02zm-2.5-9v2.06a7 7 0 0 1 0 13.88V21a9 9 0 0 0 0-18z" fill="currentColor"/></svg>';
    return '<button class="v2-audio-icon" type="button" data-action="play-audio" data-audio-url="' + esc(audioUrl) + '" aria-label="播放音频" title="播放音频">' + icon + '</button>';
  }

  function renderInteraction(node, course) {
    var speaker = node.npcId || '';
    var role = (course.practiceRoles || []).find(function (item) { return item.id === speaker; });
    var npc = (course.npcs || []).find(function (item) { return item.id === speaker; });
    var label = localized((role || npc || {}).label || (role || npc || {}).name) || '';
    if (isUnspecifiedSpeakerLabel(label)) label = defaultSpeakerLabel(course, speaker);
    var html = '<div class="v2-interaction legacy-interaction">';

    /* 1.1 在答题前只提供音频入口，不提前泄露 npcMessage。 */
    var audioUrl = node.audioAssetId ? assetUrl({ course: course, assets: state.active.assets || {} }, node.audioAssetId) : '';
    html += '<div class="v2-chat-turn left"><div class="v2-speaker-row"><div class="v2-speaker-label">' + esc(label || '说话人') + '</div>' + renderAudioIconButton(audioUrl) + '</div><div class="v2-chat-message-row"><span class="v2-chat-avatar" aria-hidden="true">' + getAvatar(label) + '</span><div class="v2-chat-bubble"><div class="v2-chat-line">听音频，在你的气泡中输入听到的句子。</div>';
    html += '</div></div></div>';
    html += '<div class="v2-chat-turn right legacy-answer-turn"><div class="v2-speaker-label">你</div><div class="v2-chat-message-row"><span class="v2-chat-avatar" aria-hidden="true">' + getAvatar('你') + '</span><div class="v2-chat-bubble"><div class="v2-answer-form"><input id="courseTyping" type="text" autocomplete="off" placeholder="输入听到的英文句子…"><button class="action-button primary" data-action="submit-typing" data-answers="' + esc(JSON.stringify(node.acceptedAnswers && node.acceptedAnswers.en || [])) + '">检查答案</button></div></div></div></div>';
    if (state.feedback) html += '<div class="node-feedback ' + (state.feedback.kind || '') + '">' + esc(state.feedback.text) + '</div>';
    return html;
  }

  function v2Utterance(course, index) {
    var id = (course.sequence || [])[index];
    return (course.utterances || []).find(function (item) { return item.id === id; }) || null;
  }
  function v2Role(course, roleId) {
    return (course.roles || []).find(function (role) { return role.id === roleId; }) || null;
  }
  function v2Reason(course, mode) {
    var reasons = course.capabilityReasons && course.capabilityReasons[mode];
    if (Array.isArray(reasons) && reasons.length) return reasons.map(function (item) { return item && item.message || item; }).join('；');
    return mode === 'dictation' ? '课程需要同时提供音频和可校验文本。' : '课程包没有声明该练习方式所需的内容。';
  }
  function v2ModeList(course) {
    var modes = global.ChunkCourseCapabilities && global.ChunkCourseCapabilities.resolveRuntimeModes
      ? global.ChunkCourseCapabilities.resolveRuntimeModes(course) : [];
    var authored = course.authorNotes && course.authorNotes.chunklabImageText;
    var selected = authored && authored.format === 'chunklab-ai-image-text' && authored.formatVersion === '1.0'
      && authored.learning && Array.isArray(authored.learning.modes) ? new Set(authored.learning.modes) : null;
    return modes.map(function (mode) {
      var implemented = mode.id === 'typing' || mode.id === 'chunkSelection';
      var enabled = !!mode.enabled && (!selected || selected.has(mode.id)) && implemented;
      return { id: mode.id, label: mode.id === 'roleplay' ? '角色扮演' : mode.label, enabled: enabled,
        reason: !implemented ? '暂未开放，敬请期待。' : !enabled && selected && mode.enabled ? '课程作者没有选择这种练习方式。' : mode.reason };
    }).sort(function (left, right) {
      var priority = { chunkSelection: 0, typing: 1 };
      return (priority[left.id] == null ? 2 : priority[left.id]) - (priority[right.id] == null ? 2 : priority[right.id]);
    });
  }
  function renderV2ModeGuide(course) {
    var modes = v2ModeList(course);
    var selectedMode = modes.some(function (mode) { return mode.id === state.practiceMode && mode.enabled; }) ? state.practiceMode : '';
    if (!selectedMode) state.practiceMode = null;
    var root = dom.playerContent;
    var stage = root && root.closest('.course-stage');
    if (stage) stage.classList.add('mode-selection', 'no-image');
    if ($('btnRestart')) $('btnRestart').hidden = true;
    if (dom.playerImage) dom.playerImage.innerHTML = '';
    if (dom.playerScene) dom.playerScene.textContent = '学习方式';
    if (dom.playerGuide) dom.playerGuide.textContent = '先选练习方式，再预习本课内容。';
    var vocabulary = course.learningObjectives && Array.isArray(course.learningObjectives.vocabulary)
      ? course.learningObjectives.vocabulary.filter(function (item) {
        return item && item.preStudy === true && typeof item.term === 'string' && item.term.trim();
      }) : [];
    var previewRows = vocabulary.map(function (item, index) {
      var meaning = item.definition && typeof item.definition === 'object' ? item.definition['zh-CN'] || item.definition.zh || '' : '';
      var partOfSpeech = typeof item.partOfSpeech === 'string' ? item.partOfSpeech.trim() : '';
      return '<li class="lesson-preview-row"><span class="lesson-preview-index" aria-hidden="true">' + (index + 1) + '</span>' +
        '<div class="lesson-preview-copy"><div class="lesson-preview-term"><div class="lesson-preview-en">' + esc(item.term.trim()) + '</div>' +
        (partOfSpeech ? '<span class="lesson-preview-role">词性 ' + esc(partOfSpeech) + '</span>' : '') + '</div>' +
        (meaning ? '<div class="lesson-preview-zh">' + esc(meaning) + '</div>' : '') + '</div></li>';
    }).join('');
    var authorNotes = course.authorNotes || {};
    var focusItems = [
      { label: '学习目标', values: authorNotes.communicationGoals },
      { label: '重点表达', values: authorNotes.expressions },
      { label: '核心句型', values: authorNotes.sentencePatterns },
      { label: '语法要点', values: authorNotes.grammar }
    ].map(function (item) {
      var values = Array.isArray(item.values) ? item.values.map(function (value) { return localized(value).trim(); }).filter(Boolean) : [];
      return { label: item.label, text: values.join('；') };
    }).filter(function (item) { return item.text; });
    var focusRows = focusItems.map(function (item) {
      return '<div class="lesson-focus-item"><dt>' + esc(item.label) + '</dt><dd>' + esc(item.text) + '</dd></div>';
    }).join('');
    root.innerHTML = '<section class="mode-guide" aria-labelledby="modeGuideTitle">' +
      '<div class="mode-guide-top"><div><h2 id="modeGuideTitle">学习方式</h2></div>' +
      '<div class="mode-guide-list" role="group" aria-label="答题方式">' + modes.map(function (mode) {
        var selected = selectedMode === mode.id;
        return '<button type="button" class="mode-option' + (selected ? ' selected' : '') + '" data-action="select-v2-mode" data-mode="' + esc(mode.id) + '" aria-pressed="' + (selected ? 'true' : 'false') + '"' + (mode.enabled ? '' : ' disabled title="' + esc(mode.reason || '暂不可用') + '" aria-label="' + esc(mode.label + '，' + (mode.reason || '暂不可用')) + '"') + '>' +
          '<span class="mode-option-indicator" aria-hidden="true"></span><span class="mode-option-copy"><span class="mode-option-title">' + esc(mode.label) + '</span></span></button>';
      }).join('') + '</div></div>' +
      '<section class="lesson-preview" aria-labelledby="lessonPreviewTitle"><button type="button" class="lesson-preview-toggle" id="lessonPreviewToggle" aria-expanded="false" aria-controls="lessonPreviewContent"><span class="lesson-preview-title" id="lessonPreviewTitle">本课词汇预习</span><span class="lesson-preview-count">' + vocabulary.length + ' 个</span><span class="lesson-preview-chevron" aria-hidden="true"></span></button>' +
      '<div class="lesson-preview-content" id="lessonPreviewContent" hidden><div class="lesson-preview-scroll">' + (vocabulary.length ? '<ol class="lesson-preview-list">' + previewRows + '</ol>' : '<p class="lesson-preview-empty" role="status">课程包未提供默认词汇，请补充课程词汇后再预习。</p>') +
      (focusRows ? '<section class="lesson-learning-focus" aria-labelledby="lessonFocusTitle"><h4 id="lessonFocusTitle">本课学习要点</h4><dl class="lesson-focus-list">' + focusRows + '</dl></section>' : '') + '</div>' +
      '</div></section>' +
      '<div class="mode-guide-actions"><button type="button" class="action-button primary" data-action="start-v2-learning"' + (selectedMode ? '' : ' disabled') + '>开始学习</button></div>' +
      '</section>';
    var previewToggle = root.querySelector('#lessonPreviewToggle');
    var previewSection = root.querySelector('.lesson-preview');
    var previewContent = root.querySelector('#lessonPreviewContent');
    if (previewToggle && previewSection && previewContent) previewToggle.onclick = function () {
      var expanded = previewToggle.getAttribute('aria-expanded') !== 'true';
      previewToggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      previewContent.hidden = !expanded;
      previewSection.classList.toggle('expanded', expanded);
    };
    bindV2Actions(null, course);
  }
  function renderV2Image(record, item) {
    var asset = getAsset(record.course, item && item.imageAssetId);
    var url = item && item.imageAssetId ? assetUrl(record, item.imageAssetId) : '';
    if (url) return { html: '<img draggable="false" src="' + esc(url) + '" alt="' + esc(localized(asset && asset.alt)) + '">', hasImage: true, assetMissing: false };
    if (item && item.imageAssetId) return { html: '<div class="image-placeholder"><span class="ph-ico">' + (global.Icons ? global.Icons.svg('image') : '') + '</span><small>课程包缺少图片：' + esc(asset ? (asset.fileName || asset.id) : item.imageAssetId) + '<br>图片不影响学习，可继续练习</small></div>', hasImage: false, assetMissing: true };
    return { html: '', hasImage: false, assetMissing: false };
  }
  function renderV2Node(record, progress) {
    var course = record.course, sequence = course.sequence || [], total = sequence.length;
    var passed = progress.passed.filter(function (id) { return sequence.indexOf(id) >= 0; }).length;
    setPlayerTitle(course);
    if (dom.playerCourseTag) dom.playerCourseTag.textContent = course.metadata.targetCefr || '';
    if (dom.playerCount) dom.playerCount.textContent = passed;
    if (dom.playerTotal) dom.playerTotal.textContent = total;
    var selectedMode = v2ModeList(course).find(function (mode) { return mode.id === state.practiceMode; });
    dom.playerGuide.textContent = '课程包 2.0 · 练习方式：' + (selectedMode ? selectedMode.label : '未选择');
    dom.playerProgress.style.width = Math.min(100, Math.round((passed / Math.max(1, total)) * 100)) + '%';
    var done = state.moduleStage === 'done' || progress.completed || state.v2Index >= total;
    if ($('btnRestart')) $('btnRestart').hidden = false;
    if (done) {
      state.v2ModeConfirmed = true;
      dom.playerImage.innerHTML = '';
      dom.playerImage.classList.remove('image-enter');
      var doneStage = dom.playerImage.closest('.course-stage');
      if (doneStage) { doneStage.classList.add('no-image'); doneStage.classList.remove('missing-image', 'mode-selection'); }
      dom.playerScene.textContent = '课程完成';
      dom.playerContent.innerHTML = '<div class="v2-interaction v2-completion"><section class="v2-completion-card" aria-labelledby="v2CompletionTitle"><div class="v2-completion-heading"><h2 id="v2CompletionTitle">学习完成</h2><div class="end-mark" aria-hidden="true">' + (global.Icons ? global.Icons.svg('check') : '') + '</div></div><div class="node-actions"><button class="action-button primary" data-action="restart">再学一次</button><button class="action-button" data-action="back-library">返回课程库</button></div></section><section class="v2-completion-conversation" aria-labelledby="v2CompletionConversationTitle"><h2 class="v2-completion-conversation-title" id="v2CompletionConversationTitle">本课对话</h2>' + renderV2History(course, progress.passed) + '</section></div>';
      scrollV2HistoryToEnd();
      bindV2Actions(null, course);
      return;
    }
    if (!state.v2ModeConfirmed) {
      renderV2ModeGuide(course);
      return;
    }
    var item = v2Utterance(course, state.v2Index);
    if (!item) { showMessage('2.0 sequence 当前台词不存在。', 'error'); return; }
    saveProgress(course.courseId, item.id, false, false, item.id, course);
    var image = renderV2Image(record, item);
    dom.playerImage.innerHTML = image.html;
    var stage = dom.playerImage.closest('.course-stage');
    if (stage) { stage.classList.remove('mode-selection'); stage.classList.toggle('no-image', !image.hasImage && !image.assetMissing); stage.classList.toggle('missing-image', image.assetMissing); }
    dom.playerImage.classList.remove('image-enter');
    var role = v2Role(course, item.roleId);
    dom.playerScene.textContent = role ? role.name : '';
    dom.playerContent.innerHTML = renderV2Interaction(item, course, progress);
    scrollV2HistoryToEnd();
    bindV2Actions(item, course);
  }
  function renderV2History(course, passedIds) {
    var sequence = course.sequence || [], passed = Array.isArray(passedIds) ? passedIds : [];
    var turns = sequence.map(function (id, index) {
      if (passed.indexOf(id) < 0) return '';
      var item = (course.utterances || []).find(function (utterance) { return utterance.id === id; });
      if (!item) return '';
      var role = v2Role(course, item.roleId), roleLabel = role ? localized(role.name || role.label) : '说话人';
      var roleIndex = (course.roles || []).findIndex(function (itemRole) { return itemRole.id === item.roleId; });
      var side = (roleIndex < 0 ? index : roleIndex) % 2 ? 'right' : 'left';
      var translation = localized(item.text && item.text['zh-CN']);
      var audioUrl = item.audioAssetId ? assetUrl({ course: course, assets: state.active && state.active.assets || {} }, item.audioAssetId) : '';
      var sentenceAudio = renderAudioIconButton(audioUrl);
      return '<div class="v2-chat-turn v2-history-turn ' + side + '"><div class="v2-chat-message-row"><span class="v2-chat-avatar" aria-hidden="true">' + getAvatar(roleLabel) + '</span><div class="v2-chat-bubble"><div class="v2-chat-line">' + esc(english(item.text)) + sentenceAudio + '</div>' +
        (translation ? '<div class="v2-chat-translation">' + esc(translation) + '</div>' : '') + '</div></div></div>';
    }).filter(Boolean);
    return turns.length ? '<div class="v2-chat-history" role="region" aria-label="已完成的对话" tabindex="0">' + turns.join('') + '</div>' : '';
  }
  function scrollV2HistoryToEnd() {
    var history = dom.playerContent.querySelector('.v2-chat-history');
    var interaction = dom.playerContent.querySelector('.v2-interaction:not(.v2-completion)');
    if (interaction && global.matchMedia && global.matchMedia('(max-width: 800px)').matches) {
      var content = dom.playerContent;
      global.requestAnimationFrame(function () {
        content.scrollTop = content.scrollHeight;
        var current = interaction.querySelector('.v2-current-turn');
        var bank = interaction.querySelector('.v2-chunk-exercise');
        if (!current || !bank) return;
        var viewport = content.getBoundingClientRect();
        var currentRect = current.getBoundingClientRect();
        var bankRect = bank.getBoundingClientRect();
        if (currentRect.top < viewport.top) content.scrollTop -= viewport.top - currentRect.top;
        else if (bankRect.bottom > viewport.bottom) content.scrollTop += bankRect.bottom - viewport.bottom;
      });
      return;
    }
    if (history) history.scrollTop = history.scrollHeight;
  }
  function v2ChunkChoices(item) {
    var chunks = (item.chunks && item.chunks.items || []).concat(item.chunks && item.chunks.distractors || []);
    if (state.v2ChunkOrderItemId === item.id && state.v2ChunkOrder.length === chunks.length && state.v2ChunkOrder.every(function (id) { return chunks.some(function (chunk) { return chunk.id === id; }); })) {
      return state.v2ChunkOrder.map(function (id) { return chunks.find(function (chunk) { return chunk.id === id; }); });
    }
    var shuffled = chunks.slice();
    for (var i = shuffled.length - 1; i > 0; i--) {
      var swapIndex = Math.floor(Math.random() * (i + 1));
      var current = shuffled[i]; shuffled[i] = shuffled[swapIndex]; shuffled[swapIndex] = current;
    }
    var correctOrder = item.chunks && item.chunks.correctOrder || [];
    var shownCorrectOrder = shuffled.filter(function (chunk) { return correctOrder.indexOf(chunk.id) >= 0; }).map(function (chunk) { return chunk.id; });
    if (shownCorrectOrder.length > 1 && shownCorrectOrder.every(function (id, index) { return id === correctOrder[index]; })) {
      var firstIndex = shuffled.findIndex(function (chunk) { return chunk.id === shownCorrectOrder[0]; });
      var secondIndex = shuffled.findIndex(function (chunk) { return chunk.id === shownCorrectOrder[1]; });
      var firstChunk = shuffled[firstIndex]; shuffled[firstIndex] = shuffled[secondIndex]; shuffled[secondIndex] = firstChunk;
    }
    state.v2ChunkOrderItemId = item.id;
    state.v2ChunkOrder = shuffled.map(function (chunk) { return chunk.id; });
    return shuffled;
  }
  function renderV2Interaction(item, course, progress) {
    var role = v2Role(course, item.roleId), audioUrl = item.audioAssetId ? assetUrl({ course: course, assets: state.active.assets || {} }, item.audioAssetId) : '';
    var roleLabel = role ? localized(role.name || role.label) : '说话人';
    var roleIndex = (course.roles || []).findIndex(function (itemRole) { return itemRole.id === item.roleId; });
    var side = (roleIndex < 0 ? state.v2Index : roleIndex) % 2 ? 'right' : 'left';
    var typing = state.practiceMode === 'typing';
    var dictation = state.practiceMode === 'dictation';
    var typingComplete = typing && state.v2Answered && !!state.v2TypedAnswer;
    var chunkSentenceComplete = state.practiceMode === 'chunkSelection' &&
      state.v2SelectedChunks.length === ((item.chunks && item.chunks.correctOrder) || []).length &&
      state.v2SelectedChunks.length > 0;
    var prompt = !state.practiceMode ? '请选择练习方式' : typing ? (typingComplete ? state.v2TypedAnswer : localized(item.text && item.text['zh-CN'])) : dictation ? '听音频后输入你听到的英文' : state.practiceMode === 'chunkSelection' ? renderV2ChunkSlots(item) : english(item.text);
    var translation = !typing && !dictation ? localized(item.text && item.text['zh-CN']) : '';
    var speakerAudio = state.practiceMode === 'chunkSelection' ? '' : renderAudioIconButton(audioUrl);
    var speakerRow = speakerAudio ? '<div class="v2-speaker-row icon-only">' + speakerAudio + '</div>' : '';
    var sentenceAudio = chunkSentenceComplete ? renderAudioIconButton(audioUrl) : '';
    var html = '<div class="v2-interaction">' + renderV2History(course, progress && progress.passed) + '<div class="v2-chat-turn v2-current-turn ' + side + '">' + speakerRow +
      '<div class="v2-chat-message-row"><span class="v2-chat-avatar" aria-hidden="true">' + getAvatar(roleLabel) + '</span><div class="v2-chat-bubble' + (state.v2ChunkWrong ? ' v2-chat-error v2-chat-shake' : '') + '"><div class="v2-chat-line">' + (state.practiceMode === 'chunkSelection' ? prompt : esc(prompt)) + sentenceAudio + '</div>' +
      (typing && !typingComplete ? renderV2TypingSlots(item) : '') +
      (translation ? '<div class="v2-chat-translation">' + esc(translation) + '</div>' : '') +
      '</div></div></div>';
    if (typing) {
      if (!typingComplete) html += '<div class="v2-typing-exercise">' + (state.v2TypingAttempts >= 3 ? '' : renderV2Feedback()) + (state.v2TypingAttempts >= 3 ? renderV2TypingHint(item) : '') + '<div class="typing-box"><input id="v2Answer" type="text" autocomplete="off" placeholder="输入英文答案…" value="' + esc(state.v2TypingValue) + '"><button class="action-button primary" data-action="submit-v2">检查答案</button></div></div>';
    } else if (dictation) {
      html += '<div class="v2-typing-exercise">' + renderV2Feedback() + '<div class="exercise-label">听写</div><div class="typing-box"><input id="v2Answer" type="text" autocomplete="off" placeholder="输入英文答案…" value=""><button class="action-button primary" data-action="submit-v2">检查答案</button></div></div>';
    } else if (state.practiceMode === 'chunkSelection') {
      var chunks = v2ChunkChoices(item);
      html += '<div class="v2-chunk-exercise"><div class="gap-choices v2-word-bank">' + chunks.filter(function (c) { return state.v2SelectedChunks.indexOf(c.id) < 0; }).map(function (c) { return '<button class="choice-chip word-chip" type="button" data-action="choose-v2-chunk" data-chunk-id="' + esc(c.id) + '">' + esc(c.text) + '</button>'; }).join('') + '</div></div>';
    } else {
        var needsAudio = state.practiceMode === 'shadowing' || state.practiceMode === 'dictation';
        html += '<div class="exercise-label">' + (state.practiceMode === 'roleplay' ? '角色扮演' : '跟读') + '</div><p class="source-line">' + (needsAudio ? '播放课程提供的音频并完成练习后，点击确认进入下一句。' : '按当前角色练习这句对话，完成后点击确认进入下一句。') + '</p><div class="node-actions"><button class="action-button primary" data-action="confirm-v2">完成本句</button></div>';
    }
    if (!typing && !dictation && state.feedback) html += renderV2Feedback();
    if (state.v2Answered && !typing && state.practiceMode !== 'chunkSelection') html += '<div class="node-actions"><button class="action-button primary" data-action="advance-v2">下一句</button></div>';
    return html + '</div>';
  }
  function renderV2Feedback() {
    if (!state.feedback) return '';
    var kind = state.feedback.kind || '';
    return '<div class="node-feedback ' + kind + '" role="' + (kind === 'bad' ? 'alert' : 'status') + '">' + esc(state.feedback.text) + '</div>';
  }
  function renderV2TypingHint(item) {
    var answer = String((item.acceptedAnswers && item.acceptedAnswers.en || [english(item.text)])[0] || '').trim();
    if (!answer) return '';
    return '<div class="v2-typing-hint node-feedback hint" role="status">' + esc(answer) + '</div>';
  }
  function renderV2ChunkSlots(item) {
    var chunks = item.chunks && item.chunks.items || [];
    var order = item.chunks && item.chunks.correctOrder || [];
    return order.map(function (_, index) {
      var selectedId = state.v2SelectedChunks[index];
      var selected = selectedId && chunks.find(function (chunk) { return chunk.id === selectedId; });
      var reference = chunks.find(function (chunk) { return chunk.id === order[index]; });
      var width = Math.max(3, Math.min(16, Math.ceil(((reference && reference.text) || '').trim().length * 0.62)));
      return selected
        ? '<button type="button" class="v2-gap-slot filled" style="--slot-width:' + width + 'ch" data-action="remove-v2-chunk" data-slot-index="' + index + '" aria-label="撤回第' + (index + 1) + '个意群">' + esc(selected.text.trim()) + '</button>'
        : '<span class="v2-gap-slot" style="--slot-width:' + width + 'ch" role="img" aria-label="第' + (index + 1) + '个意群空白"><span aria-hidden="true">&nbsp;</span></span>';
    }).join('<span class="v2-gap-separator" aria-hidden="true"> </span>');
  }
  function renderV2TypingSlots(item) {
    var acceptedAnswers = item.acceptedAnswers && item.acceptedAnswers.en || [];
    var answer = String(acceptedAnswers[0] || english(item.text) || '').trim();
    var words = answer ? answer.split(/\s+/).filter(Boolean) : [];
    if (!words.length) return '';
    return '<div class="v2-typing-slots" role="group" aria-label="英文答案共' + words.length + '个单词">' + words.map(function (word, index) {
      var width = Math.max(3, Math.min(16, Math.ceil(word.length * 0.62)));
      return '<span class="v2-gap-slot v2-typing-gap" style="--slot-width:' + width + 'ch" role="img" aria-label="第' + (index + 1) + '个单词空位"><span aria-hidden="true">&nbsp;</span></span>';
    }).join('<span class="v2-gap-separator" aria-hidden="true"> </span>') + '</div>';
  }
  function v2AnswerMatches(item, value) {
    var actual = norm(value);
    return !!actual && (item.acceptedAnswers && item.acceptedAnswers.en || []).some(function (answer) { return norm(answer) === actual; });
  }
  function checkV2Answer(item, course) {
    var isChunkSelection = state.practiceMode === 'chunkSelection';
    var typedAnswer = String((($('v2Answer') || {}).value || '')).trim();
    var ok = isChunkSelection
      ? JSON.stringify(state.v2SelectedChunks) === JSON.stringify((item.chunks && item.chunks.correctOrder) || [])
      : v2AnswerMatches(item, typedAnswer);
    if (ok) {
      state.v2ChunkWrong = false;
      state.v2Answered = true;
      var autoAdvanceMode = state.practiceMode === 'typing' || isChunkSelection;
      if (state.practiceMode === 'typing') state.v2TypedAnswer = typedAnswer;
      if (autoAdvanceMode) {
        state.feedback = '';
        renderNode();
        if (state.v2AdvanceTimer) global.clearTimeout(state.v2AdvanceTimer);
        var answeredIndex = state.v2Index;
        var answeredMode = state.practiceMode;
        state.v2AdvanceTimer = global.setTimeout(function () {
          state.v2AdvanceTimer = 0;
          if (state.active && state.v2Index === answeredIndex && state.v2Answered && state.practiceMode === answeredMode) advanceV2(item, course);
        }, 1000);
      } else {
        state.feedback = { kind: 'ok', text: '答案正确。' };
        renderNode();
      }
    } else if (isChunkSelection) {
      state.v2ChunkWrong = true;
      state.v2SelectedChunks = [];
      state.feedback = '';
      renderNode();
    } else {
      if (state.practiceMode === 'typing') {
        state.v2TypingAttempts += 1;
        state.v2TypingValue = typedAnswer;
      }
      state.feedback = { kind: 'bad', text: '答案不正确，请再试一次。' };
      renderNode();
    }
  }
  function advanceV2(item, course) {
    if (state.v2AdvanceTimer) global.clearTimeout(state.v2AdvanceTimer);
    state.v2AdvanceTimer = 0;
    var sequence = course.sequence || [], nextIndex = state.v2Index + 1, completed = nextIndex >= sequence.length;
    return saveProgress(course.courseId, item.id, completed, true, completed ? '' : sequence[nextIndex], course).then(function(saved){
      if(saved === false) return false;
      state.v2Index = nextIndex;
      state.v2SelectedChunks = [];
      state.v2ChunkOrderItemId = '';
      state.v2ChunkOrder = [];
      state.v2Answered = false;
      state.v2ChunkWrong = false;
      state.v2TypedAnswer = '';
      state.v2TypingValue = '';
      state.v2TypingAttempts = 0;
      state.feedback = '';
      if (completed) state.moduleStage = 'done';
      renderNode();
      return true;
    });
  }
  function bindV2Actions(item, course) {
    dom.playerContent.querySelectorAll('[data-action="back-library"]').forEach(function (button) { button.onclick = function () { setView('library'); renderCourseList(); }; });
    dom.playerContent.querySelectorAll('[data-action="restart"]').forEach(function (button) { button.onclick = function () { restartCourse(course); }; });
    dom.playerContent.querySelectorAll('[data-action="select-v2-mode"]').forEach(function (button) { button.onclick = function () { if (button.disabled) return; state.practiceMode = button.dataset.mode; state.v2SelectedChunks = []; state.v2ChunkOrderItemId = ''; state.v2ChunkOrder = []; state.v2ChunkWrong = false; state.v2Answered = false; state.v2TypedAnswer = ''; state.v2TypingValue = ''; state.v2TypingAttempts = 0; state.feedback = ''; renderNode(); }; });
    var startLearning = dom.playerContent.querySelector('[data-action="start-v2-learning"]');
    if (startLearning) startLearning.onclick = function () {
      var selectedMode = v2ModeList(course).some(function (mode) { return mode.id === state.practiceMode && mode.enabled; });
      if (!selectedMode) return;
      state.v2ModeConfirmed = true;
      renderNode();
    };
    dom.playerContent.querySelectorAll('[data-action="play-audio"]').forEach(function (button) { button.onclick = function () { playAudio(button.dataset.audioUrl, button); }; });
    dom.playerContent.querySelectorAll('[data-action="choose-v2-chunk"]').forEach(function (button) { button.onclick = function () { state.v2ChunkWrong = false; state.v2SelectedChunks.push(button.dataset.chunkId); state.feedback = ''; var expected = (item.chunks && item.chunks.correctOrder) || []; if (state.v2SelectedChunks.length === expected.length) checkV2Answer(item, course); else renderNode(); }; });
    dom.playerContent.querySelectorAll('[data-action="remove-v2-chunk"]').forEach(function (button) { button.onclick = function () { state.v2ChunkWrong = false; state.v2SelectedChunks = state.v2SelectedChunks.slice(0, Number(button.dataset.slotIndex)); state.feedback = ''; renderNode(); }; });
    dom.playerContent.querySelectorAll('[data-action="confirm-v2"]').forEach(function (button) { button.onclick = function () { state.v2Answered = true; state.feedback = { kind: 'ok', text: '本句已完成。' }; renderNode(); }; });
    dom.playerContent.querySelectorAll('[data-action="advance-v2"]').forEach(function (button) { button.onclick = function () { advanceV2(item, course); }; });
    var submit = dom.playerContent.querySelector('[data-action="submit-v2"]');
    if (submit) submit.onclick = function () { checkV2Answer(item, course); };
  }

  function isUnspecifiedSpeakerLabel(label) {
    return !label || /未指定|未命名|unknown|^npc$/i.test(String(label).trim());
  }

  function defaultSpeakerLabel(course, speaker) {
    var ids = [];
    (course.story && course.story.nodes || []).forEach(function (item) {
      var id = item.npcId || '';
      if (id && ids.indexOf(id) < 0) ids.push(id);
    });
    var key = speaker || '__unspecified__';
    var index = ids.indexOf(key);
    if (index < 0) index = 0;
    return String.fromCharCode(65 + Math.min(index, 25));
  }

  function semanticNodeValue(course, node, meaning) {
    var field = course.courseSemantics.fields[meaning];
    if (field === 'story.nodes[].npcMessage') return node.npcMessage;
    if (field === 'story.nodes[].sourceText') return node.sourceText;
    if (field === 'story.nodes[].input.prompt') return node.input && node.input.prompt;
    return null;
  }

  function getAvatar(label) {
    /* 角色头像：无 label 的 NPC → user 图标；「你」（学习者）→ grad 图标（宪法：UI 禁用字符 icon）。
       有名字的角色仍用首字/首字母（那是文本缩写，不是字符 icon） */
    if (!label) return global.Icons ? global.Icons.svg('user') : '';
    if (label === '你') return global.Icons ? global.Icons.svg('grad') : '';
    if (/^[A-Z]$/.test(label)) return global.Icons ? global.Icons.svg('user') : '';
    var first = label.charAt(0);
    return /[\u4e00-\u9fa5]/.test(first) ? first : first.toUpperCase();
  }

  function renderTyping(node, course) {
    var accepted = node.acceptedAnswers && Array.isArray(node.acceptedAnswers.en) ? node.acceptedAnswers.en : [];
    if (!accepted.length) return '<div class="node-feedback bad">当前课程节点缺少 acceptedAnswers.en。</div>';
    return '<div class="typing-box"><input id="courseTyping" type="text" autocomplete="off" placeholder="输入你听到的句子…"><button class="action-button primary" data-action="submit-typing" data-answers="' + esc(JSON.stringify(accepted)) + '">检查答案</button></div>';
  }

  function bindNodeActions(node, course) {
    dom.playerContent.querySelectorAll('[data-action="back-library"]').forEach(function (button) { button.onclick = function () { setView('library'); renderCourseList(); }; });
    dom.playerContent.querySelectorAll('[data-action="restart"]').forEach(function (button) { button.onclick = function () { restartCourse(course); }; });
    dom.playerContent.querySelectorAll('[data-action="start-post-assessment"]').forEach(function (button) { button.onclick = function () { state.moduleStage = 'postAssessment'; state.assessmentIndex = 0; state.moduleAnswer = ''; state.moduleFeedback = ''; renderNode(); }; });
    dom.playerContent.querySelectorAll('[data-action="advance"]').forEach(function (button) { button.onclick = function () { advance(node, { overallScore: 100, inputMode: 'typing' }); }; });
    dom.playerContent.querySelectorAll('[data-action="play-audio"]').forEach(function (button) { button.onclick = function () { playAudio(button.dataset.audioUrl, button); }; });

    var typingButton = dom.playerContent.querySelector('[data-action="submit-typing"]');
    if (typingButton) typingButton.onclick = function () {
      var input = $('courseTyping');
      var answers = JSON.parse(typingButton.dataset.answers || '[]');
      var ok = answers.some(function (answer) { return global.CoursePackageContract ? global.CoursePackageContract.answerMatches(input.value, answer, course.answerPolicy) : norm(answer) === norm(input.value); });
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
    var chosen = transitions.find(function (transition) { return transitionMatches(transition, facts) && !transition.fallback; }) || transitions.find(function (transition) { return transition.fallback === true; });
    if (!chosen || !chosen.toNodeId) { state.feedback = { kind: 'bad', text: '此节点没有可用的下一步。' }; renderNode(); return; }
    var progressSaved = saveProgress(state.active.course.courseId, node.id, false, true, chosen.toNodeId, state.active.course);
    progressSaved.then(function(saved){
      if(saved === false) return;
      state.nodeId = chosen.toNodeId;
      state.gapAnswers = [];
      state.feedback = '';
      renderNode();
    });
  }

  var courseImportTail = Promise.resolve();
  function importCourse(course, assets, autoOpen, importLib) {
    /* 归属元数据必须绑定到本次导入任务；不再从全局临时变量读取。 */
    var lib = importLib;
    var task = courseImportTail.then(function(){ return commitCourseImport(course, assets, autoOpen, lib); });
    courseImportTail = task.catch(function(){}); // 后一次导入仍可重试；本次错误由返回的 task 传回界面。
    return task;
  }
  async function commitCourseImport(course, assets, autoOpen, lib) {
    var errors = validateCourse(course);
    if (errors.length) {
      /* ★ 根因修复：验证失败必须抛错（而不是静默 return）。
         之前静默 return 导致 async importZip 正常 resolve → decks.html 误报"导入完成"，
         但课程从未持久化 → 树/分级都不显示 */
      throw new Error(errors.slice(0, 4).join('；'));
    }
    if (lib && (lib.seriesId || lib.seriesName || lib.volumeIndex != null || lib.volumeName || lib.level2Name)) {
      course.lib = {
        seriesId: lib.seriesId,
        seriesName: lib.seriesName,
        volumeIndex: lib.volumeIndex,
        volumeName: lib.volumeName,
        level2Name: lib.level2Name || null,
        sortOrder: 0
      };
    }
    /* 逻辑课程是用户明确选择的归属，不根据课包标题或教材元数据自动推断。
       只有本次导入明确给出归属选择时才改写该字段；避免异步元数据丢失时
       把已有归属误删，也避免把课包自身的未知字段当成目录关系。 */
    var hasLogicalSelection = !!(lib && Object.prototype.hasOwnProperty.call(lib, 'logicalCourseId'));
    if (hasLogicalSelection) {
      if (lib.logicalCourseId) course.logicalCourseId = String(lib.logicalCourseId);
      else delete course.logicalCourseId;
    }
    var record = { course: course, assets: assets || {} };
    var nextCourses = storedCourses().slice();
    var existingIndex = nextCourses.findIndex(function (item) { return item.courseId === course.courseId; });
    var existingCourse = existingIndex >= 0 ? nextCourses[existingIndex] : null;
    if (existingCourse) {
      if (!course.lib && existingCourse.lib) course.lib = existingCourse.lib;
      if (!hasLogicalSelection && !course.logicalCourseId && existingCourse.logicalCourseId) course.logicalCourseId = existingCourse.logicalCourseId;
      if (!protocol3Active() && existingCourse.version !== course.version) {
        var allProgress = storedProgress(), oldProgress = allProgress[course.courseId];
        allProgress[course.courseId] = { seen: [], passed: [], completed: false, currentNodeId: '', previous: oldProgress ? { courseVersion: oldProgress.courseVersion || existingCourse.version, seen: oldProgress.seen || [], passed: oldProgress.passed || [], completed: !!oldProgress.completed } : null };
        await persistProgress(allProgress);
      }
      nextCourses[existingIndex] = course;
    } else nextCourses.push(course);
    if(protocol3Active()){
      var savedCourse=await persistCourseOperation(course);
      var confirmedCourses=storedCourses().slice();
      var confirmedIndex=confirmedCourses.findIndex(function(item){return item.courseId===course.courseId;});
      if(confirmedIndex>=0) confirmedCourses[confirmedIndex]=savedCourse; else confirmedCourses.push(savedCourse);
      serverCoursesView=confirmedCourses;
      nextCourses=confirmedCourses;
    }else await persistCourses(nextCourses);
    state.courses = nextCourses;
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
    var limits = global.CoursePackageContract && global.CoursePackageContract.limits;
    if (limits && buffer.byteLength > limits.maxZipBytes) throw new Error('课程 ZIP 超过 100 MiB 限制。');
    var view = new DataView(buffer);
    var eocd = -1;
    for (var i = buffer.byteLength - 22; i >= Math.max(0, buffer.byteLength - 65557); i--) { if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; } }
    if (eocd < 0) throw new Error('不是可识别的 ZIP 文件。');
    var count = readUint(view, eocd + 10, 2), centralOffset = readUint(view, eocd + 16, 4), cursor = centralOffset, entries = {}, meta = {}, totalBytes = 0;
    if (limits && count > limits.maxEntries) throw new Error('课程 ZIP 文件数量超过限制。');
    for (var entryIndex = 0; entryIndex < count; entryIndex++) {
      if (view.getUint32(cursor, true) !== 0x02014b50) throw new Error('ZIP 中央目录损坏。');
      var method = readUint(view, cursor + 10, 2), compressedSize = readUint(view, cursor + 20, 4), uncompressedSize = readUint(view, cursor + 24, 4), nameLength = readUint(view, cursor + 28, 2), extraLength = readUint(view, cursor + 30, 2), commentLength = readUint(view, cursor + 32, 2), localOffset = readUint(view, cursor + 42, 4);
      var name = new TextDecoder().decode(new Uint8Array(buffer, cursor + 46, nameLength));
      cursor += 46 + nameLength + extraLength + commentLength;
      if (name.endsWith('/')) continue;
      if (global.CoursePackageContract && !global.CoursePackageContract.isSafePath(name)) throw new Error('ZIP 包含不安全路径：' + name);
      if (meta[name]) throw new Error('ZIP 包含重复文件：' + name);
      if (method !== 0 && method !== 8) throw new Error('ZIP 使用了不支持的压缩方式：' + name);
      if (limits && (compressedSize > limits.maxEntryBytes || uncompressedSize > limits.maxEntryBytes)) throw new Error('ZIP 文件过大：' + name);
      totalBytes += uncompressedSize;
      if (limits && totalBytes > limits.maxUncompressedBytes) throw new Error('ZIP 解压后总大小超过限制。');
      if (view.getUint32(localOffset, true) !== 0x04034b50) continue;
      var localNameLength = readUint(view, localOffset + 26, 2), localExtraLength = readUint(view, localOffset + 28, 2), dataStart = localOffset + 30 + localNameLength + localExtraLength;
      var compressed = new Uint8Array(buffer, dataStart, compressedSize), data = method === 0 ? new Uint8Array(compressed) : await inflate(compressed);
      if (data.byteLength !== uncompressedSize) throw new Error('ZIP 文件大小校验失败：' + name);
      entries[name] = data;
      meta[name] = { method: method, compressedSize: compressedSize, uncompressedSize: uncompressedSize };
    }
    Object.defineProperty(entries, '__zipMeta', { value: meta, enumerable: false });
    return entries;
  }
  async function sha256Hex(bytes) {
    if (!global.crypto || !global.crypto.subtle) throw new Error('当前浏览器不支持课程包 SHA-256 校验。');
    var input = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    var digest = new Uint8Array(await global.crypto.subtle.digest('SHA-256', input));
    return Array.prototype.map.call(digest, function (value) { return value.toString(16).padStart(2, '0'); }).join('');
  }
  async function validateZipPackage(entries, course) {
    var contract = global.CoursePackageContract;
    if (!contract || !global.CourseSchemaValidator) throw new Error('课程包校验器未加载，请刷新页面后重试。');
    var manifestBytes = entries['package-manifest.json'];
    var schemaBytes = entries['course-package.schema.json'];
    if (!manifestBytes || !schemaBytes) throw new Error('课程 ZIP 缺少 manifest 或 Schema。');
    if (schemaBytes.byteLength > contract.limits.maxSchemaBytes) throw new Error('课程 Schema 文件过大。');
    var manifest;
    try { manifest = JSON.parse(new TextDecoder().decode(manifestBytes)); } catch (error) { throw new Error('package-manifest.json 无法解析。'); }
    var manifestErrors = contract.validateManifestShape(manifest);
    var packageProfile = contract.packageProfile(manifest);
    if (!packageProfile || (packageProfile.id !== 'course-package-1.1' && packageProfile.id !== 'course-package-2.0')) throw new Error('仅支持课程包协议 1.1 或 2.0。');
    if (manifest.courseId !== course.courseId || manifest.courseVersion !== course.version) manifestErrors.push('manifest 与 course.json 的课程身份或版本不一致');
    if (course.schemaVersion !== packageProfile.courseSchemaVersion) manifestErrors.push('课程 schemaVersion 与课程包版本不一致');
    if (manifestErrors.length) throw new Error(manifestErrors.slice(0, 4).join('；'));
    if (!entries['COURSE_PROTOCOL.md']) throw new Error('课程 ZIP 缺少 COURSE_PROTOCOL.md。');
    if (packageProfile.id === 'course-package-1.1') {
      if (!entries['COURSE_PROTOCOL_TEST_VECTORS.json']) throw new Error('1.1 课程 ZIP 缺少测试向量。');
      var vectors;
      try { vectors = JSON.parse(new TextDecoder().decode(entries['COURSE_PROTOCOL_TEST_VECTORS.json'])); } catch (error) { throw new Error('COURSE_PROTOCOL_TEST_VECTORS.json 无法解析。'); }
      if (!vectors || vectors.format !== 'course-shot-1.1' || vectors.answerPolicy !== 'english-typing-v1' || !Array.isArray(vectors.answers) || !vectors.manifest || !Array.isArray(vectors.manifest.entries) || !contract.isSortedUtf8(vectors.manifest.entries)) throw new Error('1.1 COURSE_PROTOCOL_TEST_VECTORS.json 格式无效。');
    }
    var listed = {};
    for (var i = 0; i < manifest.entries.length; i++) {
      var entry = manifest.entries[i], bytes = entries[entry.path];
      if (!bytes) throw new Error('manifest 声明的文件不存在：' + entry.path);
      listed[entry.path] = true;
      if (bytes.byteLength !== entry.byteSize) throw new Error('课程文件大小校验失败：' + entry.path);
      if ((await sha256Hex(bytes)).toLowerCase() !== String(entry.sha256).toLowerCase()) throw new Error('课程文件 SHA-256 校验失败：' + entry.path);
    }
    Object.keys(entries).forEach(function (name) { if (name !== 'package-manifest.json' && !listed[name]) throw new Error('ZIP 中存在未声明文件：' + name); });
    var contentBytes = new TextEncoder().encode(contract.manifestContentText(manifest.entries));
    if ((await sha256Hex(contentBytes)).toLowerCase() !== String(manifest.contentHash || '').toLowerCase()) throw new Error('课程包 contentHash 校验失败。');
    var schema;
    try { schema = JSON.parse(new TextDecoder().decode(schemaBytes)); } catch (error) { throw new Error('course-package.schema.json 无法解析。'); }
    var result = global.CourseSchemaValidator.validate(schema, course);
    if (!result.valid) throw new Error('课程 Schema 校验失败：' + result.errors.slice(0, 3).join('；'));
    if (packageProfile.id === 'course-package-1.1') {
      var graphErrors = contract.validateCourseGraph(course);
      if (graphErrors.length) throw new Error('课程图校验失败：' + graphErrors.slice(0, 3).join('；'));
    } else {
      var v2Errors = contract.validateCourseV2(course);
      if (v2Errors.length) throw new Error('课程 2.0 校验失败：' + v2Errors.slice(0, 3).join('；'));
    }
    return manifest;
  }
  async function importZip(file, autoOpen, importLib) {
    /* 在进入第一个 await 前锁定本次导入的元数据，避免调用方清理全局状态后丢失归属。 */
    var lib = importLib;
    var buffer = await file.arrayBuffer();
    var entries = await readZip(buffer);
    var courseEntry = entries['course.json'];
    if (!courseEntry) throw new Error('ZIP 中没有 course.json。');
    var course;
    try { course = JSON.parse(new TextDecoder().decode(courseEntry)); } catch (error) { throw new Error('course.json 无法解析。'); }
    await validateZipPackage(entries, course);
    var assets = {};
    var missingAssets = (course.assets || []).filter(function (asset) {
      return !entries[asset.path];
    });
    if (missingAssets.length) throw new Error('课程 ZIP 缺少文件：' + missingAssets.slice(0, 3).map(function (asset) { return asset.path; }).join('、') + '。请确保课程包完整后重新导入。');
    (course.assets || []).forEach(function (asset) {
      var bytes = entries[asset.path];
      /* 转为 base64 data URI 持久化到 course 对象，避免 blob URL 刷新丢失 */
      var b64 = arrayBufferToBase64(bytes.buffer || bytes);
      var mime = mimeFor(asset.fileName);
      var dataUri = 'data:' + mime + ';base64,' + b64;
      assets[asset.path] = dataUri;
      /* 回写 dataUri 到 course.assets 以便 localStorage 持久化 */
      asset._dataUri = dataUri;
    });
    return importCourse(course, assets, autoOpen, lib);
  }
  function mimeFor(name) {
    var ext = String(name || '').split('.').pop().toLowerCase();
    return ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : ext === 'mp3' ? 'audio/mpeg' : ext === 'm4a' ? 'audio/mp4' : ext === 'wav' ? 'audio/wav' : ext === 'ogg' ? 'audio/ogg' : 'application/octet-stream';
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
      if (asset._dataUri) assets[asset.path] = asset._dataUri;
    });
    return assets;
  }

  function catalogReturnHref() {
    var courseId = new URLSearchParams(global.location.search).get('catalogCourse');
    return courseId ? 'decks.html?course=' + encodeURIComponent(courseId) : 'decks.html';
  }

  function boot() {
    /* Bind the visible error surface before awaiting cloud bootstrap. A failed
       startup used to reject before `dom` was initialized, leaving a blank
       course page with no usable back button. */
    dom.importMessage = $('importMessage');
    dom.player = $('coursePlayer');
    var _cloud = (global.CL && global.CL.ensureCloud) ? global.CL.ensureCloud() : Promise.resolve();
    _cloud.then(loadServerProgress).then(function(){
    dom.library = $('courseLibrary'); dom.player = $('coursePlayer'); dom.courseList = $('courseList'); dom.importMessage = $('importMessage'); dom.playerTitle = $('playerTitle'); dom.playerTitleTranslation = $('playerTitleTranslation'); dom.playerGuide = $('playerGuide'); dom.playerProgress = $('playerProgress'); dom.playerImage = $('playerImage'); dom.playerScene = $('playerScene'); dom.playerContent = $('playerContent');
    dom.playerCourseTag = $('playerCourseTag'); dom.playerCount = $('playerCount'); dom.playerTotal = $('playerTotal'); dom.btnRestart = $('btnRestart');
    readStoredCourses();
    /* courses.html 播放器专属绑定；decks.html 中这些 DOM 不存在，需守卫 */
    if (dom.player) {
      var backBtn = $('backToLibrary'); if (backBtn) backBtn.onclick = function () { global.location.href = catalogReturnHref(); };
      var pBack = $('playerBack'); if (pBack) pBack.onclick = function () { global.location.href = catalogReturnHref(); };
      if (dom.btnRestart) dom.btnRestart.onclick = function () { if (state.active) restartCourse(state.active); };
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
    }).catch(function(error){
      console.warn('[course] startup projection unavailable:', error && (error.code || error.message) || error);
      if (protocol3Active()) {
        /* Keep the exit path available, but do not show stale local courses or
           progress as if they were confirmed account data. */
        var backBtn = $('backToLibrary'), playerBack = $('playerBack');
        var goBack = function(){ global.location.href = catalogReturnHref(); };
        if (backBtn) backBtn.onclick = goBack;
        if (playerBack) playerBack.onclick = goBack;
        setView('player');
        showMessage('课程数据暂不可用，尚未显示本机旧数据。请稍后刷新，或返回课程库。', 'error');
        return;
      }
      showMessage(error.message || '课程暂未就绪，请稍后重试。', 'error');
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
    var importLib = { seriesId: sid, seriesName: sname, volumeIndex: vidx ? parseInt(vidx, 10) : null, volumeName: vidx ? ('第' + vidx + '册') : null };
    closeClassify();
    (function () {
      var p = importZip(file, undefined, importLib);
      if (p && p.catch) p.catch(function (error) { showMessage('导入失败：' + error.message, 'error'); });
      else if (p && p.then) p.then(null, function (error) { showMessage('导入失败：' + error.message, 'error'); });
    })();
  }

  global.ChunkCourse = {
    boot: boot,
    importCourse: function (c, a, autoOpen) { return importCourse(c, a, autoOpen); },
    readCourses: function () { return storedCourses(); },
    /** 从 decks.html 弹窗调用：选文件后触发归类→导入 */
    importFile: function (file) {
      if (!/\.zip$/i.test(file.name)) return { ok: false, error: '请导入 ZIP 课程包' };
      _pendingFile = file;
      openClassify(file);
      return { ok: true };
    },
    /** 直接导入（调用方显式传入本次导入的层级元数据） */
    importZipDirect: function (file, importMeta) {
      if (!/\.zip$/i.test(file.name)) return Promise.reject('请导入 ZIP 课程包');
      /* 所有调用方都必须显式传入本次导入元数据。 */
      var extLib = importMeta || null;
      var lib;
      if (extLib) {
        lib = {
          seriesId: extLib.seriesId,
          seriesName: extLib.seriesName,
          volumeIndex: extLib.volumeIndex,
          volumeName: extLib.volumeName,
          level2Name: extLib.level2Name || null,
          sortOrder: 0
        };
        if (Object.prototype.hasOwnProperty.call(extLib, 'logicalCourseId')) {
          lib.logicalCourseId = extLib.logicalCourseId || null;
        }
      }
      var p = importZip(file, false, lib);
      if(p && p.catch) p.catch(function(e){ showMessage('导入失败：'+e.message, 'error'); });
      return p;
    },
    /** 刷新课程列表（供外部调用） */
    refreshList: function () { readStoredCourses(); renderCourseList(); },
    saveCourse: persistCourseOperation,
    deleteCourse: deleteCourseOperation
  };
  /* 启动：先完成 IndexedDB 预载（courses/progress 内存桥），再渲染列表。
     Icons.install()：把静态 data-icon 元素替换为内联 SVG（宪法：UI 禁用字符 icon）。
     courses.html 已引 js/icons.js；decks.html 复用本文件时也已引，重复 install 无害 */
  document.addEventListener('DOMContentLoaded', function () {
    var cl = window.CL;
    var start = function () {
      if (global.Icons && global.Icons.install) global.Icons.install();
      boot();
    };
    if (cl && cl.preload) { cl.preload().then(start); } else { start(); }
  });
})(window);
