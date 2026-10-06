/* logical-course-store.js · 用户创建的逻辑课程定义（只存课程身份与展示信息） */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'chunklab.logical-courses.v1';
  var confirmed = null;

  function storage() {
    return global.AccountStorage && global.AccountStorage.storage
      ? global.AccountStorage.storage
      : global.localStorage;
  }
  function text(value) { return String(value == null ? '' : value).trim(); }
  function slug(value) {
    return text(value).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '') || 'course';
  }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function serverAuthoritative() {
    var config = global.CL && global.CL.getCloudConfig ? global.CL.getCloudConfig() : null;
    return !!(config && config.persistenceMode === 'server-authoritative' && Number(config.writeProtocol) === 3);
  }
  function read() {
    if (confirmed !== null) return clone(confirmed);
    try {
      var value = JSON.parse(storage().getItem(STORAGE_KEY) || '[]');
      return Array.isArray(value) ? value.filter(function (item) { return item && item.id && item.title; }) : [];
    } catch (error) { return []; }
  }
  function write(list) {
    if (serverAuthoritative()) {
      var error = new Error('协议 3 下逻辑课程目录必须通过服务器操作保存');
      error.code = 'PROTOCOL3_NARROW_WRITE_REQUIRED';
      throw error;
    }
    confirmed = null;
    storage().setItem(STORAGE_KEY, JSON.stringify(Array.isArray(list) ? list : []));
  }
  function setConfirmed(list) {
    confirmed = Array.isArray(list) ? clone(list) : [];
    return clone(confirmed);
  }
  function get(id) {
    return read().find(function (item) { return item.id === id; }) || null;
  }
  function build(input) {
    input = input || {};
    var title = text(input.title);
    if (!title) throw new Error('逻辑课程名称不能为空');
    var stamp = Date.now().toString(36);
    var id = 'logical-course:' + slug(title) + '-' + stamp;
    var now = new Date().toISOString();
    var course = {
      id: id,
      title: title,
      coverImage: text(input.coverImage),
      catalogKey: 'logical:' + id,
      origin: 'user',
      contentType: 'story',
      createdAt: now,
      updatedAt: now
    };
    return clone(course);
  }
  function create(input) {
    var course = build(input);
    var list = read();
    list.push(course);
    write(list);
    return clone(course);
  }
  function remove(id) {
    write(read().filter(function (item) { return item.id !== id; }));
  }

  global.LogicalCourseStore = { STORAGE_KEY: STORAGE_KEY, read: read, get: get, build: build, create: create, remove: remove, write: write, setConfirmed: setConfirmed };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.LogicalCourseStore;
})(typeof window !== 'undefined' ? window : globalThis);
