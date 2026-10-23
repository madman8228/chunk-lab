import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Exercise the production controller without contacting a service or writing learning data.
function setup() {
  const node = () => ({ children: [], textContent: '', append(...items) { this.children.push(...items); },
    replaceChildren(...items) { this.children = items; } });
  const nodes = new Map();
  const context = vm.createContext({ URLSearchParams, setInterval, clearInterval,
    location: { search: '?course=unit01&return=%2Fmain.html%3Fview%3Dhome' },
    document: { getElementById(id) { if (!nodes.has(id)) nodes.set(id, node()); return nodes.get(id); }, createElement: node },
    window: { ChunkAPI: { isLoggedIn: () => false }, addEventListener() {} },
    renderActivity: () => ({ informational: true }) });
  const source = fs.readFileSync(new URL('./entry.mjs', import.meta.url), 'utf8').replace("import { renderActivity } from './renderers.mjs';", '');
  vm.runInContext(source, context);
  vm.runInContext(`courseLessons = [{lessonId:'L101',title:'听懂指令'},{lessonId:'L103',title:'请求重复'}];`, context);
  return { context, nodes };
}

test('completion links to the next lesson and preserves the return destination, but not in review or at course end', () => {
  const { context, nodes } = setup();
  for (const [lessonId, mode, hasNext] of [['L101', 'learn', true], ['L103', 'learn', false], ['L101', 'review', false]]) {
    vm.runInContext(`current={lessonId:'${lessonId}',mode:'${mode}',state:{completed:true}};render();`, context);
    const links = nodes.get('activityBody').children.filter(item => item.href);
    assert.equal(links.length, hasNext ? 2 : 1);
    if (hasNext) {
      const query = new URLSearchParams(links[0].href.slice(1));
      assert.equal(query.get('lesson'), 'L103');
      assert.equal(query.get('return'), '/main.html?view=home');
      assert.equal(query.has('mode'), false);
    }
  }
});

test('informational audio has a replay control only when the activity declares an audio asset', () => {
  const { context, nodes } = setup();
  vm.runInContext(`current={state:{index:0,activity:{payload:{audioAssetId:'voice-1'}}}};render();`, context);
  assert.deepEqual(nodes.get('activityActions').children.map(item => item.textContent), ['播放示范', '继续']);
  vm.runInContext(`current.state.activity.payload={};render();`, context);
  assert.deepEqual(nodes.get('activityActions').children.map(item => item.textContent), ['继续']);
});
