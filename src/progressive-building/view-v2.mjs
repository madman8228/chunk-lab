const data = window.ProgressiveBuildingPreview;
const steps = [
  { id: 'base', cue: '我需要水。', chunks: ['I need', 'water'], bank: ['water', 'I need'] },
  { id: 'quantity', cue: '我需要一些水。', chunks: ['I need', 'some water'], bank: ['some water', 'I need'] },
  { id: 'request', cue: '我需要一些水，麻烦了。', chunks: ['I need', 'some water', 'please'], bank: ['please', 'I need', 'some water'] },
  { id: 'substitute', cue: '我需要一些食物，麻烦了。', chunks: ['I need', 'some food', 'please'], bank: ['some food', 'please', 'I need'] },
];
const $ = id => document.getElementById(id);
const state = { step: 0, built: [], completed: [] };
let audio;

function make(tag, text, cls) {
  const element = document.createElement(tag);
  if (text) element.textContent = text;
  if (cls) element.className = cls;
  return element;
}

function say(id) {
  const source = data.audio[id];
  if (!source) return;
  if (audio) audio.pause();
  audio = new Audio(source);
  audio.play().catch(() => {
    $('feedback').textContent = '音频未能播放，可以点“听整句”重试。';
  });
}

function renderGrowth() {
  const list = $('growth-list');
  $('growth').hidden = state.completed.length === 0;
  list.replaceChildren();
  state.completed.forEach((item, index) => {
    const row = make('li', null, index === state.completed.length - 1 ? 'growth-current' : '');
    row.append(make('span', `${index + 1}.`, 'growth-index'));
    row.append(make('span', item.en, 'growth-sentence'));
    row.append(make('span', item.zh, 'growth-meaning'));
    list.append(row);
  });
  $('growth-title').textContent = state.completed.length ? '每完成一步，整句就长一截' : '先从第一块开始';
}

function renderBuilt(step) {
  const line = $('assembled');
  line.replaceChildren();
  state.built.forEach((chunk, index) => {
    const part = make('button', chunk, 'chunk');
    part.type = 'button';
    part.setAttribute('aria-label', `撤回词块 ${chunk}`);
    part.title = '点一下撤回';
    part.onclick = () => {
      state.built.splice(index, 1);
      $('feedback').textContent = '';
      renderBuilt(step);
      renderBank(step);
    };
    line.append(part);
  });
}

function renderBank(step) {
  const bank = $('chunk-bank');
  bank.replaceChildren();
  step.bank.forEach(chunk => {
    const used = state.built.filter(item => item === chunk).length;
    const available = step.chunks.filter(item => item === chunk).length;
    if (used >= available) return;
    const tile = make('button', chunk, 'chunk');
    tile.type = 'button';
    tile.onclick = () => {
      state.built.push(chunk);
      renderBuilt(step);
      renderBank(step);
      check(step);
    };
    bank.append(tile);
  });
  bank.hidden = bank.childElementCount === 0;
}

function check(step) {
  if (state.built.length !== step.chunks.length) return;
  const correct = state.built.every((chunk, index) => chunk === step.chunks[index]);
  if (!correct) {
    $('feedback').textContent = '顺序不对。点上方词块撤回，再重新拼。';
    return;
  }
  state.completed.push({ en: data.design.chain.find(item => item.id === step.id).text, zh: step.cue });
  $('feedback').dataset.state = 'success';
  $('feedback').textContent = state.step === 3 ? '换成了食物，整句结构仍然成立。' : '拼对了，整句又长了一步。';
  $('builder-tip').textContent = '听一遍这句话，再继续。';
  $('chunk-bank').replaceChildren();
  $('listen').hidden = false;
  $('continue').hidden = false;
  renderGrowth();
  say(step.id);
}

function render() {
  const step = steps[state.step];
  $('progress').textContent = `${state.step + 1} / ${steps.length}`;
  $('step-label').textContent = state.step === 3 ? '换个东西，再说一遍' : '这一步要说';
  $('builder-title').textContent = step.cue;
  $('meaning').textContent = state.step === 0 ? '把“我需要”和“水”合起来。' : '从头拼出整句，再加上这一步的新意思。';
  $('feedback').textContent = '';
  delete $('feedback').dataset.state;
  $('builder-tip').textContent = '点词块组句 · 点已选词块撤回';
  $('listen').hidden = true;
  $('continue').hidden = true;
  $('finish').hidden = true;
  state.built = [];
  renderBuilt(step);
  renderBank(step);
  renderGrowth();
  $('listen').onclick = () => say(step.id);
  $('continue').onclick = () => {
    if (state.step === steps.length - 1) {
      $('builder').hidden = true;
      $('finish').hidden = false;
      $('progress').textContent = '完成';
      $('replay-final').onclick = () => say('substitute');
      $('restart').onclick = () => {
        if (audio) audio.pause();
        state.step = 0;
        state.completed = [];
        $('builder').hidden = false;
        render();
      };
      return;
    }
    if (audio) audio.pause();
    state.step += 1;
    render();
    document.querySelector('#chunk-bank button')?.focus();
  };
}

render();
