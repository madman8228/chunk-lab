/**
 * api.js · 前端云端 API 封装（前后端分离）
 *
 * - 自动携带 JWT（localStorage 'chunklab_token'）
 * - 401 自动清 token 并抛 NOT_AUTH
 * - API 基地址可配置（localStorage 'chunklab_api_base'，开发期默认同源 ''，部署时填服务器地址）
 * 全局暴露 window.ChunkAPI
 */
(function (global) {
  'use strict';

  var TOKEN_KEY = 'chunklab_token';
  var BASE_KEY = 'chunklab_api_base';

  function getBase() { try { return localStorage.getItem(BASE_KEY) || ''; } catch (e) { return ''; } }
  function setBase(u) { try { localStorage.setItem(BASE_KEY, u || ''); } catch (e) {} }
  function getToken() { try { return localStorage.getItem(TOKEN_KEY); } catch (e) { return null; } }
  function setToken(t) { try { localStorage.setItem(TOKEN_KEY, t); } catch (e) {} }
  function clearToken() { try { localStorage.removeItem(TOKEN_KEY); } catch (e) {} }
  function isLoggedIn() { return !!getToken(); }

  function request(path, opts) {
    opts = opts || {};
    var headers = Object.assign({}, opts.headers || {});
    var token = getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;
    if (opts.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
    return fetch(getBase() + path, {
      method: opts.method || 'GET',
      headers: headers,
      body: opts.body
    }).then(function (res) {
      if (res.status === 401) { clearToken(); var e = new Error('NOT_AUTH'); e.code = 'NOT_AUTH'; throw e; }
      return res.text().then(function (text) {
        var data = null;
        try { data = text ? JSON.parse(text) : null; } catch (e2) { data = null; }
        if (!res.ok) throw new Error((data && data.error) || ('HTTP ' + res.status));
        return data;
      });
    });
  }

  var api = {
    TOKEN_KEY: TOKEN_KEY, BASE_KEY: BASE_KEY,
    getBase: getBase, setBase: setBase,
    getToken: getToken, setToken: setToken, clearToken: clearToken, isLoggedIn: isLoggedIn,
    request: request,
    register: function (u, p) { return request('/api/auth/register', { method: 'POST', body: JSON.stringify({ username: u, password: p }) }); },
    login: function (u, p) { return request('/api/auth/login', { method: 'POST', body: JSON.stringify({ username: u, password: p }) }); },
    me: function () { return request('/api/auth/me'); },
    getConfig: function () { return request('/api/config'); },
    getData: function () { return request('/api/data'); },
    putData: function (payload) { return request('/api/data', { method: 'PUT', body: JSON.stringify(payload) }); },
    exportData: function () { return request('/api/export'); },
    importData: function (payload) { return request('/api/import', { method: 'POST', body: JSON.stringify(payload) }); },
    postCourse: function (course) { return request('/api/courses', { method: 'POST', body: JSON.stringify({ course: course }) }); },
    deleteCourse: function (id) { return request('/api/courses/' + encodeURIComponent(id), { method: 'DELETE' }); }
  };

  global.ChunkAPI = api;
})(window);
