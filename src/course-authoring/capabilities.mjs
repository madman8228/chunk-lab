const modes = Object.freeze([
  Object.freeze({ id: 'typing', label: '输入', description: '看中文提示，输入英文。', requiredData: ['text'], simpleDraftSupported: true }),
  Object.freeze({ id: 'chunkSelection', label: '意群选择', description: '按顺序还原英文表达块。', requiredData: ['text', 'chunks'], simpleDraftSupported: true }),
  Object.freeze({ id: 'shadowing', label: '跟读', description: '播放真实英语音频并跟读。', requiredData: ['text', 'audio'], simpleDraftSupported: false, unavailableReason: '需要为课程提供真实音频。' }),
  Object.freeze({ id: 'roleplay', label: '角色练习', description: '按对话角色逐句练习并自我确认。', requiredData: ['dialogue', 'roles'], simpleDraftSupported: true }),
  Object.freeze({ id: 'dictation', label: '听写', description: '听真实音频后输入英文。', requiredData: ['text', 'audio'], simpleDraftSupported: false, unavailableReason: '需要为课程提供真实音频。' })
]);

export class CourseCapabilityCatalog {
  static describeCreationOptions() { return modes.map((mode) => ({ ...mode, requiredData: mode.requiredData.slice() })); }

  static resolveRuntimeModes(course) {
    const caps = course && course.capabilities || {};
    const roles = course && course.roles || [];
    const lines = course && course.utterances || [];
    const hasRoleplay = roles.length >= 2 && lines.every((line) => line.roleId && roles.some((role) => role.id === line.roleId));
    return modes.map((mode) => {
      let enabled = mode.id === 'roleplay' ? !!caps.roleplay && hasRoleplay
        : mode.id === 'dictation' ? !!caps.audio && !!caps.text
          : mode.id === 'shadowing' ? !!caps.audio
            : mode.id === 'chunkSelection' ? !!caps.chunkSelection && lines.length > 0 && lines.every((line) => line.chunks)
              : !!caps.text;
      return { ...mode, requiredData: mode.requiredData.slice(), enabled,
        reason: enabled ? '' : ((/** @type {{unavailableReason?:string}} */ (mode)).unavailableReason || (mode.id === 'roleplay' ? '需要包含至少两个有效角色的对话。' : mode.id === 'chunkSelection' ? '课程需要为每句话提供完整意群。' : '课程尚未提供这种练习所需的内容。')) };
    });
  }

  static fromDraft(draft) {
    const lines = Array.isArray(draft.items) ? draft.items : [];
    const hasChunks = lines.length > 0 && lines.every((item) => Array.isArray(item.chunks) && item.chunks.length > 0);
    const hasRoles = draft.contentForm === 'dialogue' && Array.isArray(draft.roles) && draft.roles.length >= 2 && lines.every((item) => item.role);
    return { text: lines.length > 0 && lines.every((item) => !!item.en), audio: false,
      translation: lines.length > 0 && lines.every((item) => !!item.zh), chunkSelection: hasChunks, roleplay: hasRoles };
  }
}

export const COURSE_MODES = modes;
