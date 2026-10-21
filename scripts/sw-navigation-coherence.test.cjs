'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const handlers = {};
const oldHTML = '<script src="js/course-enrollment.js"></script><script>CourseEnrollment.readMemberships()</script>';
const newHTML = '<script src="js/course-enrollment.js"></script><script>CourseEnrollment.deckMemberships()</script>';
const oldScript = 'window.CourseEnrollment={readMemberships:function(){}}';
const cache = {async match(key) { const url = typeof key === 'string' ? key : key.url; return url.includes('/main.html') ? new Response(oldHTML) : url==='https://test.invalid/js/course-enrollment.js' ? new Response(oldScript) : undefined; },async put(){}};
vm.runInNewContext(fs.readFileSync('sw.js','utf8'), {
  self:{location:{origin:'https://test.invalid'},addEventListener(name,fn){handlers[name]=fn;}},
  URL,Response,console,
  caches:{async open(){return cache;},async match(key){return cache.match(key);}},
  async fetch(){return new Response(newHTML);}
});
(async()=>{
  let response;
  handlers.fetch({request:{url:'https://test.invalid/main.html?return=course',method:'GET',mode:'navigate'},respondWith(value){response=value;},waitUntil(){}});
  const html = await (await response).text();
  assert.equal(html,oldHTML,'Navigation must use the HTML from the same installed bundle as cached scripts; new HTML + old script causes CourseEnrollment.deckMemberships is not a function');
  handlers.fetch({request:{url:'https://test.invalid/js/course-enrollment.js?v=membership-view-20261011',method:'GET',mode:'no-cors'},respondWith(value){response=value;},waitUntil(){}});
  assert.equal(await (await response).text(),oldScript,'Versioned script URLs must resolve within the installed atomic bundle, not mix in live server code');
  console.log('PASS: navigation and scripts stay on one installed bundle, including return query');
})().catch(e=>{console.error(e);process.exitCode=1;});
