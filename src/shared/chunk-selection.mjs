const make = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

export function createChunkSelection({
  mode = 'sequence', tokens = [], targetCount = tokens.length, onSelect, onSubmit,
  className = '', selectedClass = 'chunk-selection-selected', poolClass = 'chunk-selection-pool',
  buttonClass = 'chunk-selection-button', selectedButtonClass = '',
  selectedLabel = '已选词块，点击可撤回', poolLabel = '可选词块', submitOnTarget = true
} = {}) {
  if (!['sequence', 'immediate'].includes(mode)) throw new TypeError('Unsupported chunk selection mode');
  const element = make('div', `chunk-selection ${className}`.trim());
  const buttons = new Map();
  const textCounts = new Map();
  const tokenIndexes = new Map(tokens.map((token, index) => [String(token.id), index]));
  for (const token of tokens) textCounts.set(token.text, (textCounts.get(token.text) || 0) + 1);
  const labelFor = (token, index) => token.ariaLabel || (textCounts.get(token.text) > 1
    ? `选择词块：${token.text}（第${index + 1}块）` : `选择词块：${token.text}`);
  let selected = [], state = 'ready', active = true, destroyed = false, retryButton = null;

  if (mode === 'immediate') {
    for (const token of tokens) {
      const button = make('button', `${buttonClass} ${token.className || ''}`.trim(), token.text);
      button.type = 'button';
      button.dataset.v = token.value ?? token.text;
      button.dataset.chunkId = String(token.id);
      if (textCounts.get(token.text) > 1 || token.ariaLabel) button.setAttribute('aria-label', labelFor(token, tokenIndexes.get(String(token.id))));
      button.addEventListener('click', () => {
        if (destroyed || !active || button.disabled) return;
        onSelect?.(token, button);
      });
      buttons.set(String(token.id), button);
      element.append(button);
    }
  } else {
    const selectedNode = make('div', `${selectedClass} chunk-selection-selected`.trim());
    const poolNode = make('div', poolClass);
    const feedback = make('span', 'chunk-selection-feedback');
    feedback.setAttribute('role', 'status');
    feedback.setAttribute('aria-live', 'polite');
    selectedNode.setAttribute('role', 'group');
    selectedNode.setAttribute('aria-label', selectedLabel);
    poolNode.setAttribute('role', 'group');
    poolNode.setAttribute('aria-label', poolLabel);
    for (const token of tokens) {
      const button = make('button', buttonClass, token.text);
      button.type = 'button';
      button.lang = token.lang || 'en';
      button.setAttribute('aria-label', labelFor(token, tokenIndexes.get(String(token.id))));
      button.dataset.chunkId = String(token.id);
      button.addEventListener('click', () => {
        if (destroyed || !active || state === 'pending' || state === 'success') return;
        const id = String(token.id), index = selected.indexOf(id);
        if (index >= 0) selected.splice(index, 1);
        else if (selected.length < targetCount) selected.push(id);
        feedback.textContent = '';
        render();
        button.focus();
        if (submitOnTarget && selected.length === targetCount) submit();
      });
      buttons.set(String(token.id), button);
      poolNode.append(button);
    }
    function render() {
      selectedNode.replaceChildren();
      poolNode.replaceChildren();
      selectedNode.removeAttribute('aria-invalid');
      selected.forEach((id, index) => {
        const button = buttons.get(id);
        button.className = `${buttonClass} ${selectedButtonClass}`.trim();
        button.setAttribute('aria-label', `第${index + 1}块：${button.textContent}，点此撤回`);
        selectedNode.append(button);
      });
      for (const token of tokens) {
        const id = String(token.id);
        if (selected.includes(id)) continue;
        const button = buttons.get(id);
        button.className = buttonClass;
        button.setAttribute('aria-label', labelFor(token, tokenIndexes.get(id)));
        poolNode.append(button);
      }
    }
    async function submit() {
      if (destroyed || !active || state !== 'ready' || selected.length !== targetCount) return;
      const snapshot = selected.map(id => id);
      state = 'pending'; render();
      buttons.forEach(button => { button.disabled = true; });
      try {
        const result = await onSubmit?.(snapshot.map(id => tokens.find(token => String(token.id) === id)));
        if (destroyed) return;
        if (result === 'success' || result?.status === 'success') {
          state = 'success'; feedback.textContent = result?.message || '';
          buttons.forEach(button => { button.disabled = true; });
        } else if (result === 'blocked' || result?.status === 'blocked') {
          state = 'blocked'; feedback.textContent = result?.message || '当前无法提交，请检查学习权限。';
          buttons.forEach(button => { button.disabled = true; });
        } else if (result === 'retryable-error' || result?.status === 'retryable-error') {
          state = 'retryable-error'; feedback.textContent = result?.message || '提交暂时失败，请重试。';
          retryButton = make('button', 'chunk-selection-retry', '重试提交');
          retryButton.type = 'button'; retryButton.onclick = () => { retryButton.remove(); retryButton = null; state = 'ready'; submit(); };
          selectedNode.append(retryButton);
        } else {
          state = 'ready'; feedback.textContent = result?.message || '词块顺序还不对，点已选词块撤回后重排。';
          selectedNode.setAttribute('aria-invalid', 'true');
          buttons.forEach(button => { button.disabled = false; });
          selectedNode.querySelector('button')?.focus();
        }
      } catch (error) {
        if (destroyed) return;
        state = 'retryable-error'; feedback.textContent = error?.message || '提交暂时失败，请重试。';
        buttons.forEach(button => { button.disabled = true; });
        retryButton = make('button', 'chunk-selection-retry', '重试提交');
        retryButton.type = 'button'; retryButton.onclick = () => { retryButton.remove(); retryButton = null; state = 'ready'; submit(); };
        selectedNode.append(retryButton);
      }
    }
    element.append(selectedNode, poolNode, feedback);
    render();
    element.getSelection = () => selected.map(id => tokens.find(token => String(token.id) === id));
    element.reset = () => { if (state === 'pending') return; state = 'ready'; selected = []; feedback.textContent = ''; selectedNode.removeAttribute('aria-invalid'); render(); };
    element.setState = next => { state = next; buttons.forEach(button => { button.disabled = next === 'pending' || next === 'success' || next === 'blocked'; }); };
  }
  element.getButton = id => buttons.get(String(id)) || null;
  element.setActive = value => { active = Boolean(value); };
  element.destroy = () => { if (destroyed) return; destroyed = true; active = false; buttons.forEach(button => { button.disabled = true; }); retryButton?.remove(); };
  return element;
}
