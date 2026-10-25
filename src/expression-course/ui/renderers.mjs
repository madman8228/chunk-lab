import { createChunkSelection } from '../../shared/chunk-selection.mjs';

const el = (tag, attrs = {}, text = '') => {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) if (value !== undefined && value !== null) node.setAttribute(key, value);
  if (text) node.textContent = text;
  return node;
};

export function renderActivity(root, activity, { onAction, playAudio, preview = false } = {}) {
  root.replaceChildren();
  root.append(el('p', { class: 'activity-prompt' }, activity.prompt || '完成这一小步'));
  const payload = activity.payload || {};
  let response = {};
  let submitting = false;
  if (activity.type === 'meaning_intro' || activity.type === 'micro_explanation') {
    const example = payload.exampleEnglish || payload.example || payload.explanation || '';
    const zh = payload.exampleZh || payload.meaning || payload.explanationZh || '';
    if (payload.ruleText) root.append(el('p', { class: 'activity-meaning' }, payload.ruleText));
    if (example) root.append(el('p', { class: 'activity-example', lang: 'en' }, example));
    if (zh) root.append(el('p', { class: 'activity-meaning' }, zh));
    for (const contrast of payload.contrasts || []) {
      const item = el('p', { class: 'activity-meaning' }, `${contrast.label || '对比'}：${contrast.en || contrast.left || ''} · ${contrast.zh || contrast.right || ''}`);
      root.append(item);
    }
  } else if (activity.type === 'sound_demo') {
    if (payload.instructionZh) root.append(el('p', { class: 'activity-meaning' }, payload.instructionZh));
    for (const segment of payload.segments || []) {
      const row = el('div', { class: 'sound-demo-segment' });
      if (segment.symbol) row.append(el('span', { class: 'sound-symbol', lang: 'en' }, segment.symbol));
      if (segment.label) row.append(el('span', { class: 'activity-meaning' }, segment.label));
      const play = el('button', { type: 'button', class: 'button button-secondary' }, segment.buttonLabel || '播放示范');
      play.addEventListener('click', () => playAudio?.(segment.audioAssetId, play));
      row.append(play);
      root.append(row);
    }
  } else if (activity.type === 'sentence_build' || activity.type === 'grapheme_build') {
    const isGrapheme = activity.type === 'grapheme_build';
    root.append(el('p', { class: 'activity-meaning' }, payload.targetMeaning || (isGrapheme ? '按声音顺序拼合字母块' : '按正确顺序排列词块')));
    if (isGrapheme && payload.audioAssetId) {
      const play = el('button', { type: 'button', class: 'button button-secondary' }, '再听一次');
      play.addEventListener('click', () => playAudio?.(payload.audioAssetId, play)); root.append(play);
    }
    const targetCount = payload.expectedTokenCount || payload.availableTokens?.length || 0;
    const selection = createChunkSelection({ mode: 'sequence', className: 'expression-chunk-selection',
      selectedClass: 'token-row token-row-selected', poolClass: 'token-row', buttonClass: 'token-button',
      selectedButtonClass: 'token-chip', targetCount, submitOnTarget: !preview && Boolean(onAction && payload.expectedTokenCount > 0),
      tokens: (payload.availableTokens || []).map((text, index) => ({
        id: `${activity.id || 'activity'}:${index}`, text
      })), onSubmit: onAction && payload.expectedTokenCount > 0
        ? chosen => {
          submitting = true;
          return Promise.resolve(onAction({ type: 'submit', response: { tokens: chosen.map(token => token.text) } }))
            .finally(() => { submitting = false; });
        }
        : undefined });
    root.append(selection);
    response = { get tokens() { return selection.getSelection().map(token => token.text); } };
  } else if (activity.type === 'listening_choice') {
    const play = el('button', { type: 'button', class: 'button button-secondary' }, '播放音频');
    play.addEventListener('click', () => playAudio?.(payload.audioAssetId, play));
    root.append(play);
    if (!preview && onAction) {
      const skip = el('button', { type: 'button', class: 'text-button' }, '音频无法播放？跳过本题');
      skip.addEventListener('click', () => onAction({ type: 'skip_audio' })); root.append(skip);
    }
    const choices = el('div', { class: 'choice-list', role: 'group', 'aria-label': '选择听到的意思' });
    for (const option of payload.options || []) {
      const button = el('button', { type: 'button', class: 'choice-button' }, option.textZh || option.text || '选项');
      button.addEventListener('click', () => { response.optionId = option.id; choices.querySelectorAll('button').forEach(item => item.setAttribute('aria-pressed', String(item === button))); });
      choices.append(button);
    }
    root.append(choices);
  } else if (activity.type === 'speaking_practice') {
    if (payload.scenario) root.append(el('p', { class: 'activity-meaning' }, payload.scenario));
    root.append(el('p', { class: 'activity-meaning' }, payload.instruction || '先听示范，再自己开口说一遍。'));
    root.append(el('p', { class: 'activity-meaning' }, '这是自我练习，不评估或记录发音正确率。'));
    if (payload.referenceText && payload.audioAssetId) {
      const play = el('button', { type: 'button', class: 'button button-secondary' }, '播放示范');
      play.addEventListener('click', () => playAudio?.(payload.audioAssetId, play));
      root.append(play);
    } else if (!preview && onAction) {
      const reveal = el('button', { type: 'button', class: 'button button-secondary' }, '显示示范');
      reveal.addEventListener('click', () => onAction({ type: 'reveal' })); root.append(reveal);
    }
  } else {
    if (payload.scenario) root.append(el('p', { class: 'activity-meaning' }, payload.scenario));
    if (payload.targetMeaning) root.append(el('p', { class: 'activity-meaning' }, payload.targetMeaning));
    if (['substitution', 'independent_output', 'transfer_test'].includes(activity.type)
      && Number.isInteger(payload.expectedWordCount) && payload.expectedWordCount > 0) {
      const slots = el('div', { class: 'word-slots', role: 'group', 'aria-label': '逐词输入英文表达' });
      const inputs = Array.from({ length: payload.expectedWordCount }, (_, index) => {
        const input = el('input', { class: 'word-slot', type: 'text', maxlength: 32, autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false',
          'aria-label': `第 ${index + 1} 个单词`, 'aria-posinset': String(index + 1), 'aria-setsize': String(payload.expectedWordCount) });
        input.lang = 'en';
        input.addEventListener('keydown', event => {
          if (event.key === ' ' && index < inputs.length - 1) { event.preventDefault(); inputs[index + 1].focus(); }
        });
        slots.append(input);
        return input;
      });
      response = { get text() { return inputs.map(input => input.value.trim()).filter(Boolean).join(' '); } };
      root.append(slots);
    } else {
      const input = el('textarea', { class: 'answer-input', rows: 2, maxlength: 500, placeholder: '在这里输入你的表达', 'aria-label': '输入英文表达' });
      input.addEventListener('input', () => { response.text = input.value; });
      root.append(input);
    }
  }
  if (!preview && onAction) {
    const controls = el('div', { class: 'activity-tools' });
    const hint = el('button', { type: 'button', class: 'text-button' }, '给我提示');
    hint.addEventListener('click', () => { if (!submitting) onAction({ type: 'hint' }); });
    const reveal = el('button', { type: 'button', class: 'text-button' }, '显示答案');
    reveal.addEventListener('click', () => { if (!submitting) onAction({ type: 'reveal' }); });
    if (!['meaning_intro', 'micro_explanation', 'sound_demo', 'speaking_practice'].includes(activity.type)) controls.append(hint, reveal);
    if (activity.type === 'independent_output') {
      const skip = el('button', { type: 'button', class: 'text-button' }, '暂时跳过');
      skip.addEventListener('click', () => onAction({ type: 'skip_output' }));
      controls.append(skip);
    }
    root.append(controls);
  }
  return { response: () => response, informational: ['meaning_intro', 'micro_explanation', 'sound_demo'].includes(activity.type),
    speakingPractice: activity.type === 'speaking_practice',
    autoSubmit: ['sentence_build', 'grapheme_build'].includes(activity.type) && payload.expectedTokenCount > 0 };
}
