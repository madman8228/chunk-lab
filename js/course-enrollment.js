/* course-enrollment.js · explicit course membership stored in versioned course progress rows */
(function (global) {
  'use strict';

  var PREFIX = 'enrollment:v1:';
  var MAX_JOINED_COURSES = 3;
  var queue = Promise.resolve();

  function serverAuthoritative(){
    var config = global.CL && global.CL.getCloudConfig ? global.CL.getCloudConfig() : null;
    return !!(config && config.persistenceMode === 'server-authoritative' && Number(config.writeProtocol) === 3);
  }

  function operationId(){
    if(global.crypto && typeof global.crypto.randomUUID === 'function') return global.crypto.randomUUID();
    return 'enroll-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2) + '-' + Math.random().toString(36).slice(2);
  }

  function keyFor(courseId) {
    var id = String(courseId == null ? '' : courseId).trim();
    if (!id) throw new Error('课程 ID 不能为空');
    return PREFIX + encodeURIComponent(id);
  }

  function create(options) {
    options = options || {};
    var read = options.readProgress;
    var write = options.writeProgress;
    var now = options.now || Date.now;
    var tail = Promise.resolve();

    function readMemberships(snapshot, aliases) {
      var progress = snapshot || (read ? read() : {});
      var result = Object.create(null);
      var priorityByCourseId = Object.create(null);
      Object.keys(progress || {}).forEach(function (key) {
        if (key.indexOf(PREFIX) !== 0) return;
        var value = progress[key];
        if (!value || value.kind !== 'course-enrollment' || value.schemaVersion !== 1 ||
            typeof value.courseId !== 'string' || !value.courseId.trim() || typeof value.joined !== 'boolean') return;
        try { if (key !== keyFor(value.courseId)) return; } catch (error) { return; }
        var courseId = aliases && aliases[value.courseId] || value.courseId;
        var isCanonical = courseId === value.courseId;
        var priority = isCanonical ? 2 : 1;
        var previousPriority = priorityByCourseId[courseId] || 0;
        if (priority < previousPriority) return;
        if (priority === previousPriority && result[courseId] && (Number(result[courseId].changedAt) || 0) > (Number(value.changedAt) || 0)) return;
        result[courseId] = courseId === value.courseId ? value : Object.assign({}, value, { courseId: courseId });
        priorityByCourseId[courseId] = priority;
      });
      return result;
    }

    function joinedCount(snapshot, aliases) {
      var memberships = readMemberships(snapshot, aliases);
      return Object.keys(memberships).filter(function (courseId) { return memberships[courseId].joined; }).length;
    }

    function adoptConfirmedProgress(key, fallbackValue) {
      if (!global.ServerCache || typeof global.ServerCache.read !== 'function' ||
          typeof global.ServerCache.projectCourseProgress !== 'function' ||
          !global.ServerStore || typeof global.ServerStore.pending !== 'function' ||
          !global.CL || typeof global.CL.adoptServerProgressProjection !== 'function') {
        return Promise.reject(new Error('课程确认视图暂不可用；请刷新查看加入状态。'));
      }
      return Promise.all([global.ServerCache.read(), global.ServerStore.pending()]).then(function (values) {
        var row = values[0];
        if (!row || !global.AccountStorage || row.owner !== global.AccountStorage.owner) {
          throw new Error('课程确认状态不可用；请刷新后核对加入结果。');
        }
        var projection = global.ServerCache.projectCourseProgress(row, values[1]);
        return global.CL.adoptServerProgressProjection(projection).then(function () {
          var confirmed = projection[key];
          return confirmed && confirmed.kind === 'course-enrollment' ? confirmed : fallbackValue;
        });
      });
    }

    function change(courseId, joined, aliases) {
      var id = String(courseId == null ? '' : courseId).trim();
      var key = keyFor(id);
      var operation = tail.then(function () {
        if (typeof read !== 'function' || typeof write !== 'function') throw new Error('课程保存模块未就绪');
        var progress = read() || {};
        var existing = progress[key];
        if (existing && (existing.kind !== 'course-enrollment' || existing.schemaVersion !== 1 ||
            existing.courseId !== id || typeof existing.joined !== 'boolean')) {
          throw new Error('课程加入状态键冲突，原有数据未修改');
        }
        var protocol3 = serverAuthoritative();
        if (!protocol3 && existing && existing.kind === 'course-enrollment' && existing.schemaVersion === 1 &&
            existing.courseId === id && existing.joined === joined) return existing;
        if (!protocol3 && joined && joinedCount(progress, aliases) >= MAX_JOINED_COURSES) {
          throw new Error('最多加入 3 门课程；请先移出一门，再加入新课程。');
        }
        var timestamp = Number(now()) || Date.now();
        progress[key] = {
          kind: 'course-enrollment', schemaVersion: 1, courseId: id, joined: joined,
          joinedAt: joined ? timestamp : (existing && existing.joinedAt || timestamp),
          changedAt: timestamp
        };
        var commit = Promise.resolve();
        if(protocol3){
          if(!global.CL.serverPersistenceReady || !global.CL.serverPersistenceReady()) {
            throw new Error('课程服务暂不可用；加入状态未更改，请稍后重试。');
          }
          if(!global.ServerStore || typeof global.ServerStore.submitCommitted !== 'function') {
            throw new Error('课程保存模块未就绪；加入状态未更改。');
          }
          commit = global.ServerStore.submitCommitted('course.enrollment', { courseId:id, joined:joined },
            { requestId:operationId() });
        }
        return commit.then(function(){
          return protocol3 ? adoptConfirmedProgress(key, progress[key]) : write(progress);
        }).then(function (result) {
          if (result === false) throw new Error('课程加入状态未能保存');
          return protocol3 ? result : progress[key];
        });
      });
      tail = operation.catch(function () {});
      return operation;
    }

    return {
      readMemberships: readMemberships,
      joinedCount: joinedCount,
      isJoined: function (courseId) { var row = readMemberships()[courseId]; return !!(row && row.joined); },
      join: function (courseId, aliases) { return change(courseId, true, aliases); },
      leave: function (courseId) { return change(courseId, false); },
      keyFor: keyFor
    };
  }

  var api = create({
    readProgress: function () { return global.CL && global.CL.readProgress ? global.CL.readProgress() : {}; },
    writeProgress: function (progress) {
      if (!global.CL || !global.CL.writeProgress) return Promise.reject(new Error('课程保存模块未就绪'));
      return global.CL.writeProgress(progress);
    }
  });
  api.PREFIX = PREFIX;
  api.MAX_JOINED_COURSES = MAX_JOINED_COURSES;
  api.create = create;
  api.keyFor = keyFor;
  global.CourseEnrollment = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
