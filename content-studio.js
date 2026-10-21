(function () {
  'use strict';
  var TOKEN_KEY = 'chunklab_admin_token';
  var base = '';
  try { base = localStorage.getItem('chunklab_api_base') || ''; } catch (_) {}
  if (!base && location.protocol === 'file:') base = 'http://localhost:8787';
  base = base.replace(/\/+$/, '');
  var token = '';
  try { token = localStorage.getItem(TOKEN_KEY) || ''; } catch (_) {}
  var $ = function (id) { return document.getElementById(id); };
  function showView(view) {
    $('studioLayout').hidden = view !== 'editor';
    $('libraryMetadataPanel').hidden = view !== 'catalog';
    $('protectedPublicationPanel').hidden = view !== 'publication';
    $('illustrationReviewPanel').hidden = view !== 'illustrations';
    $('textbookDraftsPanel').hidden = view !== 'textbooks';
    $('systemWordbooksPanel').hidden = view !== 'system-wordbooks';
    $('textbookDraftsOpen').setAttribute('aria-pressed',String(view === 'textbooks'));
    $('illustrationReviewOpen').setAttribute('aria-pressed',String(view === 'illustrations'));
    $('systemWordbooksOpen').setAttribute('aria-pressed',String(view === 'system-wordbooks'));
    [['editorOpen','editor'],['libraryMetadataOpen','catalog'],['protectedPublicationOpen','publication']].forEach(function (entry) {
      $(entry[0]).setAttribute('aria-pressed', String(entry[1] === view));
    });
  }
  window.ContentStudio = { showView: showView, request: request, requestAsset: requestAsset };
  $('editorOpen').onclick = function () { showView('editor'); };
  $('hideCourses').onclick = function () { $('app').classList.add('courses-collapsed'); $('app').classList.remove('courses-expanded'); $('showCourses').focus(); };
  $('showCourses').onclick = function () { $('app').classList.remove('courses-collapsed'); $('app').classList.add('courses-expanded'); $('courseSearch').focus(); };
  if ($('protectedPublicationPanel') && window.ChunkMembership) {
    var publicationView = new ChunkMembership.CoursePublicationView({ root: $('protectedPublicationPanel'), request: request, newRequestId: function(){return crypto.randomUUID();} });
    $('protectedPublicationOpen').onclick = function(){showView('publication');
      var panel=$('protectedPublicationPanel');
      if(!panel.hidden)publicationView.run(function(){return publicationView.load();});};
  }
  var courses = [], activeCourse = null, activeItemIndex = 0, revision = 0, validationPassed = false;
  var courseLoadGeneration = 0;
  var dirty = false, busy = false, loadingCourse = false;
  function withOperation(action) {
    if (busy || loadingCourse || !activeCourse) return Promise.resolve();
    busy = true; $('editor').inert = true;
    ['save','publish','validate','previous','next'].forEach(function(id){$(id).disabled=true;});
    return Promise.resolve().then(action).finally(function(){
      busy=false; $('editor').inert=false;
      ['save','publish','validate','previous','next'].forEach(function(id){$(id).disabled=false;});
    });
  }
  var selectedCourseId = ''; try { selectedCourseId = localStorage.getItem('chunklab_content_studio_course') || ''; } catch (_) {}
  function esc(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function setState(message, type) { $('state').textContent = message; $('state').className = 'state' + (type ? ' ' + type : ''); if (!activeCourse) $('editorEmpty').textContent = message; }
  function toast(message) { $('toast').textContent = message; $('toast').classList.remove('hidden'); setTimeout(function () { $('toast').classList.add('hidden'); }, 2400); }
  function request(path, options) {
    options = options || {};
    var headers = Object.assign({}, options.headers || {});
    if (token) headers.Authorization = 'Bearer ' + token;
    if (options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
    return fetch(base + path, Object.assign({}, options, { headers: headers })).then(function (response) {
      return response.text().then(function (text) {
        var data = {}; try { data = text ? JSON.parse(text) : {}; } catch (_) { data = { error: '服务器响应格式无效' }; }
        if (response.status === 401) { token = ''; try { localStorage.removeItem(TOKEN_KEY); } catch (_) {} showLogin(); }
        if (!response.ok) { var requestError=new Error(data.error || ('请求失败 ' + response.status));requestError.code=data.code;requestError.issues=data.issues;throw requestError; }
        return data;
      });
    });
  }
  function requestAsset(path) {
    var headers={};if(token)headers.Authorization='Bearer '+token;
    return fetch(base+path,{headers:headers,cache:'no-store'}).then(function(response){if(response.status===401){token='';try{localStorage.removeItem(TOKEN_KEY);}catch(_){}showLogin();}if(!response.ok)return response.text().then(function(text){var data={};try{data=JSON.parse(text);}catch(_){}throw Error(data.error||'素材读取失败');});return response.blob();});
  }
  function showLogin() { $('login').classList.remove('hidden'); $('app').classList.add('hidden'); }
  function showApp() { $('login').classList.add('hidden'); $('app').classList.remove('hidden'); }
  function renderCourses() {
    var q = $('courseSearch').value.trim().toLowerCase();
    var rows = courses.filter(function (course) { return !q || (course.name + ' ' + course.id).toLowerCase().includes(q); });
    $('courseCount').textContent = String(rows.length);
    $('courses').innerHTML = rows.map(function (course) { return '<button class="course-option' + (activeCourse && activeCourse.id === course.id ? ' active' : '') + '" aria-current="' + !!(activeCourse && activeCourse.id === course.id) + '" title="' + esc(course.id) + '" data-course="' + esc(course.id) + '"><div class="course-name">' + esc(course.name) + '</div><div class="sub">' + course.itemCount + ' 句</div></button>'; }).join('') || '<div class="empty">没有匹配的课程</div>';
  }
  function renderItems() {
    if (!activeCourse) return;
    var q = $('itemSearch').value.trim().toLowerCase();
    var rows = activeCourse.items.map(function (item, index) { return { item: item, index: index }; }).filter(function (row) {
      return !q || (row.item.sentence + ' ' + row.item.translation).toLowerCase().includes(q);
    });
    $('itemCount').textContent = rows.length + ' / ' + activeCourse.items.length;
    $('items').innerHTML = rows.map(function (row) { return '<button class="item-option' + (activeItemIndex === row.index ? ' active' : '') + '" aria-current="' + (activeItemIndex === row.index) + '" data-index="' + row.index + '"><span class="item-number">' + (row.index + 1) + '</span><div class="item-en">' + esc(row.item.sentence) + '</div><div class="sub">' + esc(row.item.translation) + '</div></button>'; }).join('') || '<div class="empty">没有匹配的句子</div>';
  }
  function invalidate() { validationPassed = false; $('validation').textContent = ''; $('validationBadge').textContent = '待校验'; $('validationBadge').className = 'badge warn'; setState('未保存'); }
  function refreshCurrentSummary() {
    if ($('itemSearch').value.trim()) { renderItems(); return; }
    var button = $('items').querySelector('[data-index="' + activeItemIndex + '"]');
    var item = currentItem();
    if (button && item) { button.querySelector('.item-en').textContent = item.sentence; button.querySelector('.sub').textContent = item.translation; }
  }
  function drawEditor() {
    if (!activeCourse) return;
    var item = activeCourse.items[activeItemIndex]; if (!item) return;
    $('sentence').value = item.sentence || '';
    $('translation').value = item.translation || '';
    $('chunks').innerHTML = (item.chunks || []).map(function (chunk, index) {
      var number = index + 1;
      return '<div class="chunk"><span class="chunk-number">' + number + '</span>' +
        '<label class="chunk-cell"><span class="label">意群</span><input aria-label="意群 ' + number + '" class="field chunk-text" data-index="' + index + '" value="' + esc(chunk) + '"></label>' +
        '<label class="chunk-cell"><span class="label">中文提示</span><input aria-label="提示 ' + number + '" class="field hint-text" data-index="' + index + '" value="' + esc((item.hints || [])[index] || '') + '"></label>' +
        '<label class="chunk-cell"><span class="label">讲解</span><textarea aria-label="讲解 ' + number + '" class="field explanation-text" data-index="' + index + '" rows="1">' + esc((item.explanations || [])[index] || '') + '</textarea></label></div>';
    }).join('') || '<div class="sub">无意群</div>';
    $('activeCourse').textContent = activeCourse.name;
    $('activeCourse').title = activeCourse.id;
    $('courseMeta').textContent = activeCourse.items.length + ' 句';
    $('itemPosition').textContent = (activeItemIndex + 1) + ' / ' + activeCourse.items.length;
    $('revision').textContent = '草稿 v' + revision;
    $('editorEmpty').classList.add('hidden'); $('editor').classList.remove('hidden');
    drawPreview(); renderItems();
  }
  function drawPreview() {
    var item = activeCourse && activeCourse.items[activeItemIndex]; if (!item) return;
    $('previewSentence').textContent = item.sentence;
    $('previewTranslation').textContent = item.translation;
    $('previewChunks').innerHTML = (item.chunks || []).map(function (chunk) { return '<span>' + esc(chunk) + '</span>'; }).join('');
  }
  function chooseCourse(id) {
    if (busy) { toast('请等待当前操作完成'); return; }
    if (dirty && !confirm('当前课程有未保存修改，确定放弃修改并切换课程？')) return;
    loadingCourse = true;
    $('editor').inert = true;
    var loadGeneration = ++courseLoadGeneration;
    selectedCourseId = id;
    try { localStorage.setItem('chunklab_content_studio_course', id); } catch (_) {}
    setState('正在读取课程…');
    request('/api/admin/content/courses/' + encodeURIComponent(id)).then(function (data) {
      if (loadGeneration !== courseLoadGeneration) return;
      activeCourse = JSON.parse(JSON.stringify(data.draft ? data.draft.course : data.course));
      loadingCourse=false; dirty=false; $('editor').inert=false;
      revision = data.revision || 0;
      if (data.draft) revision = data.draft.revision;
      activeItemIndex = 0; validationPassed = false; $('itemSearch').value = '';
      $('validation').textContent = ''; $('validationBadge').textContent = '待校验'; $('validationBadge').className = 'badge';
      $('app').classList.remove('courses-expanded');
      renderCourses(); drawEditor(); setState(data.draft ? '已恢复草稿' : '已加载');
    }).catch(function (error) { if (loadGeneration === courseLoadGeneration) { loadingCourse=false; $('editor').inert=false; setState(error.message, 'error'); } });
  }
  function loadCatalog() {
    request('/api/admin/content/courses').then(function (data) { courses = data.courses || []; renderCourses(); if (courses.length) chooseCourse(courses.some(function (course) { return course.id === selectedCourseId; }) ? selectedCourseId : courses[0].id); })
      .catch(function (error) { setState(error.message, 'error'); });
  }
  function currentItem() { return activeCourse && activeCourse.items[activeItemIndex]; }
  function takeFields() {
    var item = currentItem(); if (!item) return;
    item.sentence = $('sentence').value; item.translation = $('translation').value;
    item.chunks = Array.prototype.map.call(document.querySelectorAll('.chunk-text'), function (field) { return field.value; });
    item.hints = Array.prototype.map.call(document.querySelectorAll('.hint-text'), function (field) { return field.value; });
    item.explanations = Array.prototype.map.call(document.querySelectorAll('.explanation-text'), function (field) { return field.value; });
  }
  function validate() {
    if (!activeCourse) return Promise.reject(new Error('先选择课程'));
    takeFields(); setState('正在校验…');
    return request('/api/admin/content/courses/' + encodeURIComponent(activeCourse.id) + '/validate', { method: 'POST', body: JSON.stringify({ course: activeCourse }) }).then(function (result) {
      validationPassed = result.valid && !result.warnings.length;
      var messages = result.errors.concat(result.warnings);
      $('validationBadge').textContent = result.valid ? (result.warnings.length ? '有提示' : '校验通过') : '校验未通过';
      $('validationBadge').className = 'badge ' + (validationPassed ? 'good' : (result.valid ? 'warn' : ''));
      $('validation').innerHTML = messages.length ? '<div class="' + (result.valid ? 'pass' : 'fail') + '">' + (result.valid ? '请处理以下提示：' : '请修正以下问题：') + '</div><ul>' + messages.map(function (message) { return '<li>' + esc(message) + '</li>'; }).join('') + '</ul>' : '';
      setState(validationPassed ? '校验通过' : '仍有待处理项', validationPassed ? 'ok' : 'error'); return result;
    });
  }
  function saveDraft() {
    if (!activeCourse) return;
    return withOperation(function(){
    takeFields(); setState('正在保存…');
    return request('/api/admin/content/courses/' + encodeURIComponent(activeCourse.id) + '/draft', { method: 'PUT', body: JSON.stringify({ baseRevision: revision, course: activeCourse }) }).then(function (result) {
      dirty=false;
      revision = result.revision; $('revision').textContent = '草稿 v' + revision; setState('草稿已保存', 'ok'); renderCourses(); toast('草稿已保存');
    }).catch(function (error) { setState(error.message, 'error'); toast(error.message); });
    });
  }
  function publish() {
    if (!activeCourse) return;
    return withOperation(function(){return validate().then(function (result) {
      if (!result.valid || result.warnings.length) { toast('请先修复校验问题'); return; }
      var savedRevision = revision;
      setState('正在保存发布草稿…');
      return request('/api/admin/content/courses/' + encodeURIComponent(activeCourse.id) + '/draft', { method: 'PUT', body: JSON.stringify({ baseRevision: revision, course: activeCourse }) })
        .then(function (saved) { revision = saved.revision; dirty=false; setState('正在发布…'); return request('/api/admin/content/courses/' + encodeURIComponent(activeCourse.id) + '/publish', { method: 'POST', body: JSON.stringify({ revision: revision }) }); })
        .then(function (result) { revision = result.revision; $('revision').textContent = '发布 v' + revision; setState('发布成功', 'ok'); toast('发布成功'); validationPassed = false; })
        .catch(function (error) { setState(error.message, 'error'); toast(error.message); if (revision === savedRevision) validationPassed = false; });
    }).catch(function (error) { setState(error.message, 'error'); });});
  }
  $('loginForm').addEventListener('submit', function (event) { event.preventDefault(); $('loginError').textContent = ''; request('/api/admin/login', { method: 'POST', body: JSON.stringify({ password: $('password').value }) }).then(function (data) { token = data.token; try { localStorage.setItem(TOKEN_KEY, token); } catch (_) {} showApp(); loadCatalog(); }).catch(function (error) { $('loginError').textContent = error.message; }); });
  $('courses').addEventListener('click', function (event) { var button = event.target.closest('[data-course]'); if (button) chooseCourse(button.dataset.course); });
  $('items').addEventListener('click', function (event) { if(busy || loadingCourse) return; var button = event.target.closest('[data-index]'); if (!button) return; takeFields(); activeItemIndex = Number(button.dataset.index); drawEditor(); });
  $('courseSearch').addEventListener('input', renderCourses); $('itemSearch').addEventListener('input', renderItems);
  $('editor').addEventListener('input', function () { if(busy || loadingCourse) return; dirty=true; takeFields(); invalidate(); drawPreview(); refreshCurrentSummary(); });
  $('validate').addEventListener('click', function () { withOperation(validate).catch(function (error) { setState(error.message, 'error'); }); });
  $('save').addEventListener('click', saveDraft); $('publish').addEventListener('click', publish);
  $('previous').addEventListener('click', function () { if(!activeCourse || busy || loadingCourse) return; takeFields(); activeItemIndex = (activeItemIndex + activeCourse.items.length - 1) % activeCourse.items.length; drawEditor(); });
  $('next').addEventListener('click', function () { if(!activeCourse || busy || loadingCourse) return; takeFields(); activeItemIndex = (activeItemIndex + 1) % activeCourse.items.length; drawEditor(); });
  window.addEventListener('beforeunload',function(event){if(dirty || busy){event.preventDefault();event.returnValue='';}});
  if (token) { showApp(); request('/api/admin/me').then(loadCatalog).catch(showLogin); } else showLogin();
})();
