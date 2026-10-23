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
    if (example) root.append(el('p', { class: 'activity-example', lang: 'en' }, example));
    if (zh) root.append(el('p', { class: 'activity-meaning' }, zh));
  } else if (activity.type === 'sentence_build') {
    root.append(el('p', { class: 'activity-meaning' }, payload.targetMeaning || '按正确顺序排列词块'));
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
    if (!['meaning_intro', 'micro_explanation'].includes(activity.type)) controls.append(hint, reveal);
    if (activity.type === 'independent_output') {
      const skip = el('button', { type: 'button', class: 'text-button' }, '暂时跳过');
      skip.addEventListener('click', () => onAction({ type: 'skip_output' }));
      controls.append(skip);
    }
    root.append(controls);
  }
  return { response: () => response, informational: ['meaning_intro', 'micro_explanation'].includes(activity.type),
    autoSubmit: activity.type === 'sentence_build' && payload.expectedTokenCount > 0 };
}
