export class AiDraftCodec {
  parseText(input) {
    const source = String(input == null ? '' : input).trim();
    if (!source) return { ok: false, error: { code: 'EMPTY_INPUT', message: '请粘贴 AI 返回的课程内容，或选择课程文件。' } };
    const wrapped = source.match(/^```(?:json)?\s*\r?\n?([\s\S]*?)\r?\n?```$/i);
    const candidate = wrapped ? wrapped[1].trim() : source;
    const byteLength = typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(source).byteLength : source.length * 4;
    if (byteLength > 256 * 1024) return { ok: false, error: { code: 'INPUT_TOO_LARGE', message: '课程内容超过 256 KiB。请让 AI 分成更短的单节课程。' } };
    let value;
    try { value = JSON.parse(candidate); }
    catch (error) { return { ok: false, error: { code: 'INVALID_JSON', message: '暂时无法读懂这份课程。请让 AI 只返回一个完整的 JSON 课程对象，不要附加说明。' } }; }
    return { ok: true, value };
  }

  serialize(draft) { return JSON.stringify(draft, null, 2) + '\n'; }
}
