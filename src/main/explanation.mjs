/* Pure explanation assembly: content data becomes renderable sections; the page owns DOM insertion. */
function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>\"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
  }[char]));
}

function miniMd(value) {
  return escapeHtml(value)
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/\*([^*\s][^*]*)\*/g, '<i>$1</i>');
}

function buildFallbackExplanation(item) {
  const raw = item && (item.explanation || item.explain);
  const custom = typeof raw === 'string'
    ? { meaning: raw }
    : ((raw && typeof raw === 'object') ? raw : {});
  if (!raw && item && typeof item.note === 'string' && item.note.trim()) custom.note = item.note;

  const sections = [];
  const meaning = String(custom.meaning || custom.core || '').trim();
  if (meaning) {
    sections.push({ tag: '核心含义', html: '<div class="explain-overview"><strong>' + miniMd(meaning) + '</strong></div>', variant: 'info' });
  }

  const equivalents = Array.isArray(custom.equivalents) ? custom.equivalents : [];
  if (equivalents.length) {
    let html = '<div class="explain-overview"><ul class="explain-bullets">';
    equivalents.forEach((entry) => {
      const text = entry && typeof entry === 'object' ? (entry.text || entry.value || '') : entry;
      const note = entry && typeof entry === 'object' ? (entry.note || '') : '';
      if (!String(text).trim()) return;
      html += '<li>' + miniMd(String(text)) + (note ? '<span class="explain-example-zh">（' + miniMd(String(note)) + '）</span>' : '') + '</li>';
    });
    html += '</ul></div>';
    sections.push({ tag: '中文对应表达', html, variant: 'info' });
  }

  const usage = String(custom.usage || custom.scene || custom.context || '').trim();
  if (usage) sections.push({ tag: '常见使用场景', html: '<div class="explain-overview">' + miniMd(usage) + '</div>', variant: 'info' });
  const note = String(custom.note || custom.tip || '').trim();
  if (note) sections.push({ tag: '使用提醒', html: '<div class="explain-overview">' + miniMd(note) + '</div>', variant: 'warn' });

  const examples = custom.examples || custom.exampleSentences || item.examples || item.exampleSentences || item.usageExamples;
  const list = Array.isArray(examples) ? examples : (examples ? [examples] : []);
  const exampleHtml = list.map((example) => {
    if (example && typeof example === 'object') {
      const en = example.en || example.sentence || example.text || '';
      const zh = example.zh || example.translation || example.cn || '';
      return '<div class="explain-example"><div class="explain-example-en">' + escapeHtml(en) + '</div>' + (zh ? '<div class="explain-example-zh">' + escapeHtml(zh) + '</div>' : '') + '</div>';
    }
    return '<div class="explain-example-en">' + miniMd(String(example)) + '</div>';
  });
  if (exampleHtml.length) sections.push({ tag: list.length ? '经典例句' : '本句例句', html: exampleHtml.join(''), variant: 'info' });
  if (!sections.length) sections.push({ tag: '说明', html: '<div class="explain-overview">本句暂无补充讲解。</div>', variant: 'info' });
  return sections;
}

function buildAnalysisSections(item) {
  const sections = [];
  const explanations = item && item.explanations || [];
  let hasAny = false;
  explanations.forEach((raw, index) => {
    if (!raw || !String(typeof raw === 'object' ? JSON.stringify(raw) : raw).trim()) return;
    hasAny = true;
    const tag = '讲解 ' + (index + 1);
    if (raw && typeof raw === 'object') {
      const dimensions = [
        ['语法', 'grammar', '#e74c7a'],
        ['句法', 'syntax', '#3358e0'],
        ['固定搭配', 'collocation', '#c87033'],
        ['固定句型', 'pattern', '#7c5cbf'],
        ['口语/俚语', 'oral', '#2d9d78'],
      ];
      let body = '';
      dimensions.forEach(([label, key, color]) => {
        const value = raw[key];
        if (value && String(value).trim()) {
          body += '<div style="padding:2px 0"><span style="font-size:11px;font-weight:700;color:' + color + '">' + label + '：</span>' + miniMd(String(value)) + '</div>';
        }
      });
      if (Array.isArray(raw.words) && raw.words.length) {
        body += '<div style="padding:2px 0">' + raw.words.map((word) => (
          '<span style="display:inline-block;margin:1px 4px 1px 0;padding:1px 7px;border:1px solid var(--border-strong);border-radius:5px;font-size:11.5px;color:var(--accent)"><b>' + escapeHtml(word.w || word.word || '') + '</b>' +
          (word.p ? ' <span style="color:var(--faint)">(' + escapeHtml(word.p) + ')</span>' : '') +
          (word.m ? ' ' + escapeHtml(word.m) : '') + '</span>'
        )).join('') + '</div>';
      }
      if (body) sections.push({ tag, html: body, variant: 'info' });
    } else {
      sections.push({ tag, html: miniMd(String(raw)), variant: 'info' });
    }
  });
  return hasAny ? sections : sections.concat(buildFallbackExplanation(item));
}

export { buildAnalysisSections, buildFallbackExplanation, escapeHtml, miniMd };
