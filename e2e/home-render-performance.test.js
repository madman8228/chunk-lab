/* home-render-performance.test.js · 首页返回时每轮只复制/构建一次课程目录 */
'use strict';
const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..');
const PORT = require('./lib/free-port').freePort(9760, 100);
const BASE = 'http://127.0.0.1:' + PORT;
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-home-render-'));
let server;

function startServer(){
  return new Promise(function(resolve, reject){
    server = spawn(process.execPath, ['index.js'], {
      cwd: path.join(ROOT, 'server'),
      env: Object.assign({}, process.env, { CHUNKLAB_DATA_DIR: TMP_DB, PORT: String(PORT), NODE_ENV:'test' }),
      stdio:'ignore'
    });
    var tries = 0;
    var timer = setInterval(function(){
      if(server.exitCode !== null){ clearInterval(timer); reject(new Error('server exit ' + server.exitCode)); return; }
      var req = http.get({host:'127.0.0.1', port:PORT, path:'/api/health'}, function(res){
        res.resume();
        if(res.statusCode === 200){ clearInterval(timer); resolve(); }
      });
      req.on('error', function(){});
      req.setTimeout(600, function(){ req.destroy(); });
      if(++tries > 120){ clearInterval(timer); reject(new Error('server 启动超时')); }
    }, 100);
  });
}

function stopServer(){
  if(server){ try{ server.kill('SIGKILL'); }catch(e){} }
  try{ fs.rmSync(TMP_DB, {recursive:true, force:true}); }catch(e){}
}

function check(condition, message){
  if(!condition) throw new Error(message);
}

(async function(){
  let browser;
  try{
    await startServer();
    var executable = process.env.CHROMIUM_PATH || chromium.executablePath();
    browser = await chromium.launch({headless:true, executablePath:executable});
    var page = await browser.newPage();
    await page.goto(BASE + '/main.html?home-render-performance=1', {waitUntil:'domcontentloaded'});
    await page.waitForSelector('#homeBody > *', {timeout:12000});
    await page.waitForTimeout(900);

    var result = await page.evaluate(async function(){
      await CourseEnrollment.join('package:perf-course-0');
      var originalReadCourses = CL.readCourses;
      var originalBuildCatalog = CourseCatalog.buildCatalog;
      var largeSnapshot = null;
      var readCalls = 0, buildCalls = 0, renderedMs = 0, seenTitles = [];
      CL.readCourses = function(){
        readCalls++;
        var value = originalReadCourses.call(CL);
        if(!largeSnapshot){
          largeSnapshot = JSON.parse(JSON.stringify(value));
          for(var i=0;i<8;i++){
            largeSnapshot.push({
              courseId:'perf-course-' + i,
              title:'性能夹具课程 ' + i,
              scenes:[{id:'scene-' + i, title:'场景'}],
              nodes:[{id:'node-' + i, text:'large course fixture ' + 'x'.repeat(6000)}]
            });
          }
        }
        return JSON.parse(JSON.stringify(largeSnapshot));
      };
      var countingBuildCatalog = function(options){
        buildCalls++;
        var packages = options && options.storyPackages || [];
        seenTitles.push(packages.length ? packages[packages.length - 1].title : '');
        return originalBuildCatalog.call(CourseCatalog, options);
      };
      CourseCatalog.buildCatalog = countingBuildCatalog;
      var started = performance.now();
      showHomePage();
      renderedMs = performance.now() - started;
      var first = { readCalls:readCalls, buildCalls:buildCalls, renderedMs:renderedMs,
        homeText:(document.getElementById('homeBody').textContent || '').trim(),
        joinedVisible:!!document.querySelector('[data-home-course="package:perf-course-0"]') };

      largeSnapshot[largeSnapshot.length - 1].title = '更新后的性能夹具课程';
      readCalls = 0; buildCalls = 0; started = performance.now();
      showHomePage();
      var second = { readCalls:readCalls, buildCalls:buildCalls,
        renderedMs:performance.now() - started,
        homeText:(document.getElementById('homeBody').textContent || '').trim(),
        updateVisible:seenTitles.length >= 2 && seenTitles[1] === '更新后的性能夹具课程' };

      /* 下一轮必须重新读取，不能跨轮复用旧快照。 */
      readCalls = 0; buildCalls = 0;
      showHomePage();
      var refresh = { readCalls:readCalls, buildCalls:buildCalls };

      /* 目录失败只影响归属标注，首页仍需可见；恢复后下一轮允许重试。 */
      CourseCatalog.buildCatalog = function(){ buildCalls++; throw new Error('fixture catalog failure'); };
      readCalls = 0; buildCalls = 0; showHomePage();
      var failed = { readCalls:readCalls, buildCalls:buildCalls,
        homeVisible:!document.getElementById('pageHome').classList.contains('hidden'),
        homeText:(document.getElementById('homeBody').textContent || '').trim() };
      CourseCatalog.buildCatalog = countingBuildCatalog;
      readCalls = 0; buildCalls = 0; showHomePage();
      var recovered = { readCalls:readCalls, buildCalls:buildCalls };
      CL.readCourses = originalReadCourses;
      CourseCatalog.buildCatalog = originalBuildCatalog;
      return {first:first, second:second, refresh:refresh, failed:failed, recovered:recovered};
    });

    check(result.first.readCalls === 1 && result.first.buildCalls === 1,
      '首次首页渲染重复读取/构建：' + JSON.stringify(result.first));
    check(result.first.joinedVisible, '首页性能夹具没有覆盖已加入课程继续入口：' + JSON.stringify(result.first));
    check(result.second.readCalls === 1 && result.second.buildCalls === 1,
      '连续返回首页重复读取/构建：' + JSON.stringify(result.second));
    check(result.second.updateVisible,
      '下一轮首页没有读取更新后的课程内容：' + JSON.stringify(result));
    check(result.refresh.readCalls === 1 && result.refresh.buildCalls === 1,
      '新一轮首页没有重新建立上下文：' + JSON.stringify(result.refresh));
    check(result.failed.readCalls === 1 && result.failed.buildCalls === 1 && result.failed.homeVisible && result.failed.homeText,
      '目录失败后首页不可用或重复重试：' + JSON.stringify(result.failed));
    check(result.recovered.readCalls === 1 && result.recovered.buildCalls === 1,
      '目录恢复后没有允许下一轮重新读取：' + JSON.stringify(result.recovered));
    check(result.first.renderedMs < 200 && result.second.renderedMs < 200,
      '首页同步渲染超过 200ms：' + JSON.stringify(result));
    console.log('[home-render-performance] passed ' + JSON.stringify({
      firstMs:Math.round(result.first.renderedMs), secondMs:Math.round(result.second.renderedMs),
      firstReads:result.first.readCalls, firstBuilds:result.first.buildCalls
    }));
  }catch(error){
    console.error('[home-render-performance] failed:', error.message);
    process.exitCode = 1;
  }finally{
    if(browser) await browser.close();
    stopServer();
  }
})();
