/* course-catalog.js · 课程、目录与内容单元的只读适配层 */
(function (global) {
  'use strict';

  function text(value, fallback) {
    var s = String(value == null ? '' : value).trim();
    return s || (fallback || '');
  }
  function refKey(ref) {
    return JSON.stringify([ref && ref.type || '', ref && ref.id || '']);
  }
  function clone(value) {
    if (value == null) return value;
    return JSON.parse(JSON.stringify(value));
  }
  function catalogKey(value) {
    var s = text(value, '');
    return s ? s.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._:-]/g, '_') : '';
  }
  function storyCatalogKey(source) {
    var logicalCourseId = source && (source.logicalCourseId || source.catalogCourseId);
    if (logicalCourseId) return 'logical:' + text(logicalCourseId, '');
    var catalog = source && source.metadata && source.metadata.catalog;
    if (!catalog || typeof catalog !== 'object') return text(source && source.catalogKey, '');
    if (catalog.courseKey) return text(catalog.courseKey, '');
    if (catalog.primaryId || catalog.secondaryId) {
      return [catalog.primaryId, catalog.secondaryId].filter(Boolean).join('/');
    }
    return text(source && source.catalogKey, '');
  }
  function storySequence(source, fallback) {
    var catalog = source && source.metadata && source.metadata.catalog;
    var n = Number(catalog && (catalog.sequence || catalog.lessonIndex));
    return Number.isInteger(n) && n > 0 ? n : fallback || 0;
  }
  function expandLessonRanges(source) {
    var result = clone(source || {});
    (result.courses || []).forEach(function (course) {
      function expand(nodes) {
        return (nodes || []).map(function (node) {
          var item = clone(node);
          if (item.kind === 'group' && item.lessonRange) {
            var range = item.lessonRange;
            var count = Math.max(0, Number(range.count) || 0);
            var idPrefix = text(range.idPrefix, item.id + ':lesson:');
            var titlePrefix = text(range.titlePrefix, '第');
            var titleSuffix = text(range.titleSuffix, '课');
            var refPrefix = text(range.contentIdPrefix, '');
            item.children = [];
            for (var i = 1; i <= count; i++) {
              var serial = String(i).padStart(3, '0');
              item.children.push({
                id: idPrefix + serial,
                kind: 'lesson',
                sequence: i,
                title: titlePrefix + i + titleSuffix,
                contentRef: { type: text(range.contentRefType, 'story-package'), id: refPrefix + serial }
              });
            }
            delete item.lessonRange;
          } else if (item.kind === 'group') {
            item.children = expand(item.children);
          }
          return item;
        });
      }
      course.outline = expand(course.outline);
    });
    return result;
  }
  function lessonId(contentRef) {
    return 'lesson:' + String(contentRef.id);
  }
  function groupId(chapter, section) {
    return 'chapter:' + String(chapter == null ? '0' : chapter) +
      (section ? ':section:' + String(section) : '');
  }
  function deckMap(manifest) {
    var out = {};
    (manifest && manifest.decks || []).forEach(function (d) { if (d && d.id) out[d.id] = d; });
    return out;
  }
  function oralDeck(d) { return !!(d && /^oral-/.test(String(d.id))); }

  var oralLessonCovers = {
    'oral-basic': 'assets/catalog/oral-3000/1_1.webp',
    'oral-1-1-1': 'assets/catalog/oral-3000/1_2.webp',
    'oral-1-1-2': 'assets/catalog/oral-3000/1_3.webp',
    'oral-1-1-3': 'assets/catalog/oral-3000/1_4.webp',
    'oral-1-2-1': 'assets/catalog/oral-3000/2_1.webp',
    'oral-1-2-2': 'assets/catalog/oral-3000/2_2.webp',
    'oral-1-3-1': 'assets/catalog/oral-3000/2_3.webp',
    'oral-1-3-2': 'assets/catalog/oral-3000/2_4.webp',
    'oral-1-4-1': 'assets/catalog/oral-3000/3_1.webp',
    'oral-1-4-2': 'assets/catalog/oral-3000/3_2.webp',
    'oral-1-5-1': 'assets/catalog/oral-3000/3_3.webp',
    'oral-1-5-2': 'assets/catalog/oral-3000/3_4.webp',
    'oral-1-5-3': 'assets/catalog/oral-3000/13.webp',
    'oral-1-6-1': 'assets/catalog/oral-3000/14.webp',
    'oral-1-6-2': 'assets/catalog/oral-3000/15.webp',
    'oral-1-7': 'assets/catalog/oral-3000/16.webp',
    'oral-2-8-1': 'assets/catalog/oral-3000/17.webp',
    'oral-2-8-2': 'assets/catalog/oral-3000/18.webp',
    'oral-2-8-3': 'assets/catalog/oral-3000/19.webp',
    'oral-2-8-4': 'assets/catalog/oral-3000/20.webp',
    'oral-2-8-5': 'assets/catalog/oral-3000/21.webp',
    'oral-2-9-1': 'assets/catalog/oral-3000/22.webp',
    'oral-2-9-2': 'assets/catalog/oral-3000/23.webp',
    'oral-2-9-3': 'assets/catalog/oral-3000/24.webp',
    'oral-2-10-1': 'assets/catalog/oral-3000/25.webp',
    'oral-2-10-2': 'assets/catalog/oral-3000/26.webp',
    'oral-2-10-3': 'assets/catalog/oral-3000/27.webp',
    'oral-2-11-1': 'assets/catalog/oral-3000/28.webp',
    'oral-2-11-2': 'assets/catalog/oral-3000/29.webp',
    'oral-3-12-1': 'assets/catalog/oral-3000/30.webp',
    'oral-3-12-2': 'assets/catalog/oral-3000/31.webp',
    'oral-3-12-3': 'assets/catalog/oral-3000/32.webp',
    'oral-3-13-1': 'assets/catalog/oral-3000/33.webp',
    'oral-3-13-2': 'assets/catalog/oral-3000/34.webp',
    'oral-3-13-3': 'assets/catalog/oral-3000/35.webp',
    'oral-3-14': 'assets/catalog/oral-3000/36.webp',
    'oral-3-15': 'assets/catalog/oral-3000/37.webp',
    'oral-4-16': 'assets/catalog/oral-3000/38.webp',
    'oral-4-17-1': 'assets/catalog/oral-3000/39.webp',
    'oral-4-17-2': 'assets/catalog/oral-3000/40.webp',
    'oral-4-17-3': 'assets/catalog/oral-3000/41.webp',
    'oral-4-18': 'assets/catalog/oral-3000/42.webp',
    'oral-4-19': 'assets/catalog/oral-3000/43.webp',
    'oral-4-20': 'assets/catalog/oral-3000/44.webp',
    'oral-4-21': 'assets/catalog/oral-3000/45.webp',
    'oral-4-22': 'assets/catalog/oral-3000/46.webp',
    'oral-4-23': 'assets/catalog/oral-3000/47.webp',
    'oral-4-24': 'assets/catalog/oral-3000/48.webp',
    'oral-4-25': 'assets/catalog/oral-3000/49.webp',
    'oral-5-26': 'assets/catalog/oral-3000/50.webp',
    'oral-5-27': 'assets/catalog/oral-3000/51.webp',
    'oral-5-28': 'assets/catalog/oral-3000/52.webp',
    'oral-6-29-1': 'assets/catalog/oral-3000/53.webp',
    'oral-6-30-1': 'assets/catalog/oral-3000/54.webp',
    'oral-6-30-2': 'assets/catalog/oral-3000/55.webp',
    'oral-6-31': 'assets/catalog/oral-3000/56.webp',
    'oral-6-32-1': 'assets/catalog/oral-3000/57.webp',
    'oral-6-32-2': 'assets/catalog/oral-3000/58.webp',
    'oral-6-33': 'assets/catalog/oral-3000/59.webp',
    'oral-6-34': 'assets/catalog/oral-3000/60.webp',
    'oral-7-35': 'assets/catalog/oral-3000/61.webp',
    'oral-7-36-1': 'assets/catalog/oral-3000/62.webp',
    'oral-7-37': 'assets/catalog/oral-3000/63.webp',
    'oral-7-38': 'assets/catalog/oral-3000/64.webp'
  };
  function leafForDeck(deck, prefix) {
    var ref = { type: 'sentence-deck', id: deck.id };
    var lesson = {
      id: (prefix || 'lesson:') + deck.id,
      kind: 'lesson',
      title: text(deck.short, text(deck.name, deck.id)),
      contentRef: ref,
      itemCount: Number(deck.totalCount) || 0
    };
    if (oralLessonCovers[deck.id]) lesson.image = oralLessonCovers[deck.id];
    return lesson;
  }

  function localizedTitle(value, fallback) {
    if (typeof value === 'string') return text(value, fallback);
    if (value && typeof value === 'object') return text(value['zh-CN'], text(value.zh, text(value.en, fallback)));
    return text(value, fallback);
  }

  function storyCourse(source) {
    if (!source || !source.courseId) return null;
    var id = 'package:' + String(source.courseId);
    var title = localizedTitle(source.metadata && source.metadata.title, source.courseId);
    var lesson = {
      id: 'lesson:story-package:' + String(source.courseId),
      kind: 'lesson',
      title: title,
      contentRef: { type: 'story-package', id: String(source.courseId) },
      itemCount: 0
    };
    return {
      id: id,
      kind: 'course',
      title: title,
      origin: 'user',
      contentType: 'story',
      coverKey: 'story',
      outline: [lesson],
      lessons: [lesson],
      lessonCount: 1,
      itemCount: 0,
      sourceCourseId: String(source.courseId)
    };
  }

  function groupedStoryCourse(groupKey, sources) {
    var list = (sources || []).slice().sort(function (a, b) {
      return storySequence(a, 0) - storySequence(b, 0) || String(a.courseId).localeCompare(String(b.courseId));
    });
    var first = list[0] || {};
    var firstCatalog = first.metadata && first.metadata.catalog;
    var title = localizedTitle(firstCatalog && firstCatalog.courseTitle,
      localizedTitle(first.metadata && first.metadata.title, groupKey));
    var lessons = list.map(function (source, index) {
      var sequence = storySequence(source, index + 1);
      var itemTitle = localizedTitle(source.metadata && source.metadata.title, '第' + sequence + '课');
      return {
        id: 'lesson:story-package:' + String(source.courseId),
        kind: 'lesson',
        sequence: sequence,
        title: itemTitle,
        contentRef: { type: 'story-package', id: String(source.courseId) },
        itemCount: 0,
        available: true
      };
    });
    return {
      id: 'package-course:' + catalogKey(groupKey), kind: 'course', title: title,
      origin: 'user', contentType: 'story', coverKey: 'story', catalogKey: groupKey,
      outline: [{ id: 'group:story-package:' + catalogKey(groupKey), kind: 'group', title: title, order: 0, children: lessons }],
      lessons: lessons, lessonCount: lessons.length, itemCount: 0
    };
  }

  function legacyCatalog(manifest) {
    var decks = (manifest && manifest.decks || []).filter(Boolean);
    var oral = decks.filter(oralDeck);
    var idioms = decks.filter(function (d) { return d.id === 'builtin-freq-idioms'; });
    var courses = [];
    if (oral.length) {
      var groups = {};
      oral.forEach(function (d) {
        var key = String(d.section || d.chapter || '0');
        if (!groups[key]) groups[key] = {
          id: groupId(d.chapter, d.section),
          kind: 'group',
          title: text(d.sectionTitle, text(d.chapterTitle, '未分类')),
          order: Number(d.chapter) || 0,
          children: []
        };
        groups[key].children.push(leafForDeck(d));
      });
      courses.push({
        id: 'builtin:oral',
        kind: 'course',
        title: text(manifest.series, '口语3000句'),
        origin: 'builtin',
        contentType: 'sentence',
        coverKey: 'oral',
        coverImage: 'assets/covers/oral-3000.webp',
        outline: Object.keys(groups).map(function (k) { return groups[k]; })
      });
    }
    if (idioms.length) {
      courses.push({
        id: 'builtin:idioms',
        kind: 'course',
        title: '高频短语',
        origin: 'builtin',
        contentType: 'sentence',
        coverKey: 'idioms',
        coverImage: 'assets/covers/idioms.webp',
        outline: [leafForDeck(idioms[0])]
      });
    }
    return { schemaVersion: 1, version: '', courses: courses };
  }

  function normalizeNode(node, path, diagnostics, seen) {
    if (!node || typeof node !== 'object' || Array.isArray(node)) {
      diagnostics.push({ level: 'error', path: path, message: '目录节点格式错误' });
      return null;
    }
    if (!node.id || seen[node.id]) {
      diagnostics.push({ level: 'error', path: path, message: node.id ? '目录节点 ID 重复' : '目录节点缺少 ID' });
      return null;
    }
    seen[node.id] = true;
    if (node.kind === 'group') {
      if (!Array.isArray(node.children)) {
        diagnostics.push({ level: 'error', path: path, message: 'group 缺少 children' });
        return null;
      }
      return {
        id: String(node.id), kind: 'group', title: text(node.title, '未命名分组'),
        order: Number(node.order) || 0,
        image: text(node.image, text(node.imageUrl, '')),
        children: node.children.map(function (child, i) {
          return normalizeNode(child, path + '.children[' + i + ']', diagnostics, seen);
        }).filter(Boolean)
      };
    }
    if (node.kind !== 'lesson' || !node.contentRef || !node.contentRef.type || !node.contentRef.id) {
      diagnostics.push({ level: 'error', path: path, message: 'lesson 缺少合法 contentRef' });
      return null;
    }
      return {
        id: String(node.id), kind: 'lesson', title: text(node.title, String(node.contentRef.id)),
        order: Number(node.order) || 0,
        sequence: Number(node.sequence) || 0,
        contentRef: { type: String(node.contentRef.type), id: String(node.contentRef.id) },
      image: text(node.image, text(node.imageUrl, '')),
      imageAlt: text(node.imageAlt, text(node.title, '课节封面')),
      itemCount: Number(node.itemCount) || 0
    };
  }

  function flattenLessons(nodes, out) {
    (nodes || []).forEach(function (node) {
      if (!node) return;
      if (node.kind === 'lesson') out.push(node);
      else flattenLessons(node.children, out);
    });
    return out;
  }

  /* 逻辑课程可以声明完整的课程范围，但运行时目录只呈现已经落地的内容包。
     未导入的 story-package 仍由 buildCatalog 用于归位匹配，完成匹配后再从展示树中剔除。 */
  function materializedNodes(nodes) {
    return (nodes || []).map(function (node) {
      if (!node) return null;
      if (node.kind === 'lesson') return node.available === false ? null : node;
      var children = materializedNodes(node.children);
      if (!children.length) return null;
      var group = clone(node);
      group.children = children;
      return group;
    }).filter(Boolean);
  }

  function mergeCatalogs(base, additions) {
    var left = base || { schemaVersion: 1, version: '', courses: [] };
    var right = expandLessonRanges(additions || { schemaVersion: 1, courses: [] });
    return {
      schemaVersion: 1,
      version: '',
      courses: (left.courses || []).concat(right.courses || [])
    };
  }

  function logicalCourse(definition, sources) {
    var key = text(definition.catalogKey, 'logical:' + definition.id);
    var grouped = groupedStoryCourse(key, sources || []);
    var lessons = grouped.lessons;
    var title = text(definition.title, definition.id);
    var groupTitle = text(definition.groupTitle, '');
    /* 目录本身就是一级分类；没有明确的不同分组名时，直接展示实际课节，避免目录套同名分组。 */
    var outline = lessons.slice();
    if (groupTitle && groupTitle !== title && lessons.length) outline = [{
      id: 'group:' + String(definition.id), kind: 'group',
      title: groupTitle, order: 0, children: lessons
    }];
    return {
      id: String(definition.id), kind: 'course', title: title,
      origin: 'user', contentType: 'story', coverKey: 'user',
      coverImage: text(definition.coverImage, ''), catalogKey: key,
      outline: outline, lessons: lessons, plannedLessonCount: Number(definition.plannedLessonCount) || 0,
      lessonCount: lessons.length, itemCount: 0, available: true
    };
  }

  function buildCatalog(options) {
    options = options || {};
    var manifest = options.manifest || {};
    var dm = deckMap(manifest);
    var diagnostics = [];
    var raw;
    if (manifest.catalog && manifest.catalog.schemaVersion !== 1) {
      diagnostics.push({ level: 'error', path: 'catalog.schemaVersion', message: '目录版本暂不支持，已降级为兼容目录' });
      raw = legacyCatalog(manifest);
    } else {
      raw = manifest.catalog && Array.isArray(manifest.catalog.courses)
        ? expandLessonRanges(manifest.catalog)
        : legacyCatalog(manifest);
    }
    var storyPackages = options.storyPackages || [];
    var logicalCourses = options.logicalCourses || [];
    var storyById = {};
    var storyGroups = {};
    storyPackages.forEach(function (source) {
      if (!source || !source.courseId) return;
      storyById[String(source.courseId)] = source;
      var key = storyCatalogKey(source);
      if (key) (storyGroups[key] || (storyGroups[key] = [])).push(source);
    });
    Object.keys(storyGroups).forEach(function (key) {
      storyGroups[key].sort(function (a, b) {
        return storySequence(a, 0) - storySequence(b, 0) || String(a.courseId).localeCompare(String(b.courseId));
      });
    });
    var courses = [];
    var byCourseId = {};
    var ownerByContentRef = {};
    (raw.courses || []).forEach(function (source, index) {
      if (!source || !source.id || byCourseId[source.id]) {
        diagnostics.push({ level: 'error', path: 'catalog.courses[' + index + ']', message: '课程 ID 缺失或重复' });
        return;
      }
      var seen = {};
      var outline = (source.outline || []).map(function (node, i) {
        return normalizeNode(node, 'courses[' + index + '].outline[' + i + ']', diagnostics, seen);
      }).filter(Boolean);
      var course = {
        id: String(source.id),
        kind: 'course',
        title: text(source.title, source.id),
        origin: text(source.origin, 'builtin'),
        contentType: text(source.contentType, 'mixed'),
        coverKey: text(source.coverKey, ''),
        coverImage: text(source.coverImage, text(source.image, '')),
        outline: outline
      };
      course.catalogKey = text(source.catalogKey, '');
      var plannedLessonCount = flattenLessons(outline, []).length;
      var allLessons = flattenLessons(outline, []);
      allLessons.forEach(function (lesson) {
        var key = refKey(lesson.contentRef);
        var storySource = lesson.contentRef.type === 'story-package' ? storyById[lesson.contentRef.id] : null;
        if (!storySource && lesson.contentRef.type === 'story-package' && course.catalogKey) {
          var candidates = storyGroups[course.catalogKey] || [];
          var wanted = lesson.sequence;
          if (wanted > 0) {
            for (var si = 0; si < candidates.length; si++) {
              if (storySequence(candidates[si], 0) === wanted) { storySource = candidates[si]; break; }
            }
          }
          if (storySource) {
            lesson.contentRef.id = String(storySource.courseId);
            lesson.title = localizedTitle(storySource.metadata && storySource.metadata.title, lesson.title);
            key = refKey(lesson.contentRef);
          }
        }
        if (lesson.contentRef.type === 'story-package') lesson.available = !!storySource;
        var deck = dm[lesson.contentRef.id];
        if (lesson.contentRef.type === 'sentence-deck' && !deck) {
          diagnostics.push({ level: 'error', courseId: course.id, lessonId: lesson.id, message: '找不到句子内容：' + lesson.contentRef.id });
          return;
        }
        if (lesson.contentRef.type === 'sentence-deck' && !lesson.image && oralLessonCovers[lesson.contentRef.id]) {
          lesson.image = oralLessonCovers[lesson.contentRef.id];
        }
        if (ownerByContentRef[key] && ownerByContentRef[key] !== course.id) {
          diagnostics.push({ level: 'error', courseId: course.id, lessonId: lesson.id, message: '内容被多个课程引用：' + key });
          return;
        }
        ownerByContentRef[key] = course.id;
        if (!lesson.itemCount && deck) lesson.itemCount = Number(deck.totalCount) || 0;
        if (deck) lesson.sourceName = deck.name;
      });
      course.plannedLessonCount = plannedLessonCount;
      course.outline = materializedNodes(outline);
      var lessons = flattenLessons(course.outline, []);
      course.lessons = lessons;
      course.lessonCount = lessons.length;
      course.itemCount = lessons.reduce(function (sum, lesson) { return sum + (Number(lesson.itemCount) || 0); }, 0);
      course.available = !diagnostics.some(function (item) { return item.courseId === course.id; });
      courses.push(course);
      byCourseId[course.id] = course;
    });

    /* 用户先创建逻辑课程，再由导入包通过 logicalCourseId 进入该课程。 */
    logicalCourses.forEach(function (definition, index) {
      if (!definition || !definition.id || byCourseId[definition.id]) {
        diagnostics.push({ level: 'error', path: 'logicalCourses[' + index + ']', message: '逻辑课程 ID 缺失或重复' });
        return;
      }
      var key = text(definition.catalogKey, 'logical:' + definition.id);
      var course = logicalCourse(definition, storyGroups[key] || []);
      courses.push(course);
      byCourseId[course.id] = course;
    });

    (options.userDecks || []).forEach(function (deck) {
      if (!deck || !deck.id || deck.builtin) return;
      var id = 'user-deck:' + deck.id;
      var lesson = leafForDeck({
        id: deck.id, name: deck.name, short: deck.name,
        totalCount: Array.isArray(deck.items) ? deck.items.length : deck.itemCount
      }, 'lesson:user-deck:');
      courses.push({
        id: id, kind: 'course', title: text(deck.name, '我的课程'), origin: 'user',
        contentType: 'sentence', coverKey: 'user', outline: [lesson],
        lessons: [lesson], lessonCount: 1, itemCount: lesson.itemCount
      });
      ownerByContentRef[refKey(lesson.contentRef)] = id;
      byCourseId[id] = courses[courses.length - 1];
    });

    /* 没有用户逻辑课程归属的图文包保持独立课程；系统不根据包内标题或教材标识擅自合并。 */
    var declaredKeys = {};
    courses.forEach(function (course) { if (course.catalogKey) declaredKeys[course.catalogKey] = course.id; });
    storyPackages.forEach(function (source) {
      var groupKey = storyCatalogKey(source);
      if (groupKey && declaredKeys[groupKey]) return;
      addStoryCourse(source);
    });
    function addStoryCourse(source, group) {
      if (group) {
        if (!source || !source.length) return;
        var grouped = groupedStoryCourse(source, group);
        if (byCourseId[grouped.id]) return;
        grouped.lessons.forEach(function (lesson) {
          var groupedKey = refKey(lesson.contentRef);
          if (ownerByContentRef[groupedKey]) return;
          ownerByContentRef[groupedKey] = grouped.id;
        });
        courses.push(grouped);
        byCourseId[grouped.id] = grouped;
        return;
      }
      if (!source || !source.courseId) return;
      var course = storyCourse(source);
      if (!course || byCourseId[course.id]) return;
      var ref = course.lessons[0].contentRef;
      var key = refKey(ref);
      if (ownerByContentRef[key] && ownerByContentRef[key] !== course.id) {
        diagnostics.push({ level: 'error', courseId: course.id, message: '内容被多个课程引用：' + key });
        return;
      }
      ownerByContentRef[key] = course.id;
      courses.push(course);
      byCourseId[course.id] = course;
    }

    return { schemaVersion: 1, version: raw.version || '', courses: courses, byCourseId: byCourseId,
      ownerByContentRef: ownerByContentRef, diagnostics: diagnostics };
  }

  function getCourse(catalog, id) { return catalog && catalog.byCourseId && catalog.byCourseId[id] || null; }
  function listLessons(course) { return course && Array.isArray(course.lessons) ? course.lessons.slice() : flattenLessons(course && course.outline, []); }
  function resolveLesson(course, lessonIdValue) {
    return listLessons(course).find(function (lesson) { return lesson.id === lessonIdValue; }) || null;
  }

  var api = {
    refKey: refKey,
    legacyCatalog: legacyCatalog,
    expandLessonRanges: expandLessonRanges,
    mergeCatalogs: mergeCatalogs,
    logicalCourse: logicalCourse,
    buildCatalog: buildCatalog,
    getCourse: getCourse,
    listLessons: listLessons,
    resolveLesson: resolveLesson,
    flattenLessons: flattenLessons,
    clone: clone
  };
  global.CourseCatalog = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
