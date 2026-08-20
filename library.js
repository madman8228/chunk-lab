/* library.js · Chunk Lab 统一内容库（题库 + 图文课程）
 *
 * 设计要点：
 *  - 图文课程是题库的子集：两者都是"可练习内容"，统一在 Library 视图呈现。
 *  - 句子题库 = mem.decks[]（type:"deck"，扁平）
 *  - 图文课程 = chunklab.courses.v1[]（type:"course"，可有层级）
 *  - 课程层级字段挂在每条 course 的 .lib 上：
 *      lib = {
 *        seriesId:    "s-nce" | "s-huiben" | null,   // 系列（子类，如 绘本 / 新概念）
 *        seriesName:  "新概念英语" | "绘本" | null,
 *        volumeIndex: null | 1 | 2 | 3 | 4,          // 第几册
 *        volumeName:  null | "第1册",
 *        sortOrder:   0
 *      }
 *  - 旧课程无 lib 字段 → 归入 "未分类" 系列，保证向后兼容。
 */
(function (global) {
  'use strict';

  var DECK_STORE_KEY = 'chunklab.v1';
  var COURSE_STORE_KEY = 'chunklab.courses.v1';

  // 已知系列的展示信息（运行时也支持任意自定义系列）
  var KNOWN_SERIES = {
    's-nce': { name: '新概念英语', color: '#BA7517' },
    's-huiben': { name: '绘本', color: '#639922' },
    's-other': { name: '其他课程', color: '#378ADD' }
  };

  function $(id) { return document.getElementById(id); }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function slug(name) {
    var s = String(name || '').trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '');
    return s || 'other';
  }
  function seriesIdOf(name) { return 's-' + slug(name); }

  /* ===== 读取存储 ===== */
  function readDecks() {
    try {
      var mem = JSON.parse(localStorage.getItem(DECK_STORE_KEY) || '{}');
      return Array.isArray(mem.decks) ? mem.decks : [];
    } catch (e) { return []; }
  }
  /* 大对象已迁 IndexedDB（CL 内存桥）：优先走 CL，未加载时回退 localStorage 旧值 */
  function readCourses() {
    var cl = window.CL;
    if (cl && cl.readCourses) {
      var c = cl.readCourses();
      return Array.isArray(c) ? c : [];
    }
    try {
      var arr = JSON.parse(localStorage.getItem(COURSE_STORE_KEY) || '[]');
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }
  function writeCourses(courses) {
    var cl = window.CL;
    if (cl && cl.writeCourses) { cl.writeCourses(courses); return; }
    localStorage.setItem(COURSE_STORE_KEY, JSON.stringify(courses));
  }

  /* ===== 课程标题/信息 ===== */
  function courseTitle(c) {
    if (!c) return '未命名课程';
    if (c.metadata && (c.metadata.title)) {
      var t = c.metadata.title;
      return (typeof t === 'string') ? t : (t['zh-CN'] || t.en || '未命名课程');
    }
    return c.courseId || '未命名课程';
  }
  function courseNodeCount(c) {
    if (c && c.story && Array.isArray(c.story.nodes)) return c.story.nodes.length;
    return 0;
  }

  /* ===== 写入层级元数据 ===== */
  function setLibMeta(courseId, meta) {
    var courses = readCourses();
    for (var i = 0; i < courses.length; i++) {
      if (courses[i].courseId === courseId) {
        courses[i].lib = {
          seriesId: meta.seriesId || null,
          seriesName: meta.seriesName || null,
          volumeIndex: (meta.volumeIndex == null ? null : meta.volumeIndex),
          volumeName: meta.volumeName || null,
          sortOrder: meta.sortOrder || 0
        };
        writeCourses(courses);
        return courses[i];
      }
    }
    return null;
  }
  function getCourse(courseId) {
    var courses = readCourses();
    for (var i = 0; i < courses.length; i++) if (courses[i].courseId === courseId) return courses[i];
    return null;
  }

  /* ===== 构建统一树 ===== */
  // 返回：
  // {
  //   decks: [{id,name,itemsCount,builtin,...}],
  //   series: [
  //     { id, name, icon, color, totalCount, volumes: [
  //         { index, name, courses:[{courseId,title,nodeCount}] }
  //       ], direct: [{courseId,title,nodeCount}] }
  //   ]
  // }
  function buildTree() {
    var decks = readDecks().map(function (d) {
      return { id: d.id, name: d.name, itemsCount: Array.isArray(d.items) ? d.items.length : 0, builtin: !!d.builtin };
    });

    var courses = readCourses();
    var seriesMap = {}; // seriesId -> series object
    var seriesOrder = [];

    function ensureSeries(sid, sname) {
      if (!seriesMap[sid]) {
        var known = KNOWN_SERIES[sid];
        seriesMap[sid] = {
          id: sid,
          name: sname || (known ? known.name : '未分类'),
          color: known ? known.color : '#888780',
          totalCount: 0,
          volumes: [],
          direct: []
        };
        seriesOrder.push(sid);
      }
      return seriesMap[sid];
    }

    courses.forEach(function (c) {
      var lib = c.lib || {};
      var sid = lib.seriesId || 's-other';
      var sname = lib.seriesName || (KNOWN_SERIES[sid] ? KNOWN_SERIES[sid].name : '未分类');
      var s = ensureSeries(sid, sname);
      var entry = { courseId: c.courseId, title: courseTitle(c), nodeCount: courseNodeCount(c) };
      s.totalCount++;
      if (lib.volumeIndex != null) {
        var vol = null;
        for (var i = 0; i < s.volumes.length; i++) if (s.volumes[i].index === lib.volumeIndex) { vol = s.volumes[i]; break; }
        if (!vol) { vol = { index: lib.volumeIndex, name: lib.volumeName || ('第' + lib.volumeIndex + '册'), courses: [] }; s.volumes.push(vol); }
        vol.courses.push(entry);
      } else {
        s.direct.push(entry);
      }
    });

    // 排序：卷按 index，系列按 KNOWN_SERIES 优先 + 名称
    var series = seriesOrder.map(function (sid) { return seriesMap[sid]; });
    series.forEach(function (s) {
      s.volumes.sort(function (a, b) { return (a.index || 0) - (b.index || 0); });
    });
    series.sort(function (a, b) {
      var ka = a.id === 's-other' ? 1 : 0, kb = b.id === 's-other' ? 1 : 0;
      if (ka !== kb) return ka - kb;
      return a.name.localeCompare(b.name, 'zh');
    });

    return { decks: decks, series: series };
  }

  /* ===== 已知/可选系列列表（用于导入下拉） ===== */
  function knownSeriesOptions() {
    var courses = readCourses();
    var seen = {};
    var opts = [];
    courses.forEach(function (c) { if (c.lib && c.lib.seriesId && !seen[c.lib.seriesId]) { seen[c.lib.seriesId] = true; opts.push({ id: c.lib.seriesId, name: c.lib.seriesName || c.lib.seriesId }); } });
    // 预置常用
    if (!seen['s-nce']) opts.unshift({ id: 's-nce', name: '新概念英语' });
    if (!seen['s-huiben']) opts.unshift({ id: 's-huiben', name: '绘本' });
    return opts;
  }

  /* ===== 已用过的 1 级 / 2 级名称（用于导入时自动补全，纯动态，无预设） ===== */
  function knownLevelNames(levelKey) {
    var courses = readCourses();
    var seen = {};
    var names = [];
    courses.forEach(function (c) {
      if (!c.lib) return;
      var v = c.lib[levelKey];
      if (v && !seen[v]) { seen[v] = true; names.push(v); }
    });
    names.sort(function (a, b) { return a.localeCompare(b, 'zh'); });
    return names;
  }
  function knownLevel1Options() { return knownLevelNames('volumeName'); }
  function knownLevel2Options() { return knownLevelNames('level2Name'); }

  global.Library = {
    DECK_STORE_KEY: DECK_STORE_KEY,
    COURSE_STORE_KEY: COURSE_STORE_KEY,
    KNOWN_SERIES: KNOWN_SERIES,
    seriesIdOf: seriesIdOf,
    courseTitle: courseTitle,
    courseNodeCount: courseNodeCount,
    setLibMeta: setLibMeta,
    getCourse: getCourse,
    buildTree: buildTree,
    knownSeriesOptions: knownSeriesOptions,
    knownLevel1Options: knownLevel1Options,
    knownLevel2Options: knownLevel2Options,
    esc: esc
  };
})(window);
