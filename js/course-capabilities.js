var ChunkCourseCapabilitiesBundle = (() => {
  // src/course-authoring/capabilities.mjs
  var modes = Object.freeze([
    Object.freeze({ id: "typing", label: "\u8F93\u5165", description: "\u770B\u4E2D\u6587\u63D0\u793A\uFF0C\u8F93\u5165\u82F1\u6587\u3002", requiredData: ["text"], simpleDraftSupported: true }),
    Object.freeze({ id: "chunkSelection", label: "\u610F\u7FA4\u9009\u62E9", description: "\u6309\u987A\u5E8F\u8FD8\u539F\u82F1\u6587\u8868\u8FBE\u5757\u3002", requiredData: ["text", "chunks"], simpleDraftSupported: true }),
    Object.freeze({ id: "shadowing", label: "\u8DDF\u8BFB", description: "\u64AD\u653E\u771F\u5B9E\u82F1\u8BED\u97F3\u9891\u5E76\u8DDF\u8BFB\u3002", requiredData: ["text", "audio"], simpleDraftSupported: false, unavailableReason: "\u9700\u8981\u4E3A\u8BFE\u7A0B\u63D0\u4F9B\u771F\u5B9E\u97F3\u9891\u3002" }),
    Object.freeze({ id: "roleplay", label: "\u89D2\u8272\u7EC3\u4E60", description: "\u6309\u5BF9\u8BDD\u89D2\u8272\u9010\u53E5\u7EC3\u4E60\u5E76\u81EA\u6211\u786E\u8BA4\u3002", requiredData: ["dialogue", "roles"], simpleDraftSupported: true }),
    Object.freeze({ id: "dictation", label: "\u542C\u5199", description: "\u542C\u771F\u5B9E\u97F3\u9891\u540E\u8F93\u5165\u82F1\u6587\u3002", requiredData: ["text", "audio"], simpleDraftSupported: false, unavailableReason: "\u9700\u8981\u4E3A\u8BFE\u7A0B\u63D0\u4F9B\u771F\u5B9E\u97F3\u9891\u3002" })
  ]);
  var CourseCapabilityCatalog = class {
    static describeCreationOptions() {
      return modes.map((mode) => ({ ...mode, requiredData: mode.requiredData.slice() }));
    }
    static resolveRuntimeModes(course) {
      const caps = course && course.capabilities || {};
      const roles = course && course.roles || [];
      const lines = course && course.utterances || [];
      const hasRoleplay = roles.length >= 2 && lines.every((line) => line.roleId && roles.some((role) => role.id === line.roleId));
      return modes.map((mode) => {
        let enabled = mode.id === "roleplay" ? !!caps.roleplay && hasRoleplay : mode.id === "dictation" ? !!caps.audio && !!caps.text : mode.id === "shadowing" ? !!caps.audio : mode.id === "chunkSelection" ? !!caps.chunkSelection && lines.length > 0 && lines.every((line) => line.chunks) : !!caps.text;
        return {
          ...mode,
          requiredData: mode.requiredData.slice(),
          enabled,
          reason: enabled ? "" : (
            /** @type {{unavailableReason?:string}} */
            mode.unavailableReason || (mode.id === "roleplay" ? "\u9700\u8981\u5305\u542B\u81F3\u5C11\u4E24\u4E2A\u6709\u6548\u89D2\u8272\u7684\u5BF9\u8BDD\u3002" : mode.id === "chunkSelection" ? "\u8BFE\u7A0B\u9700\u8981\u4E3A\u6BCF\u53E5\u8BDD\u63D0\u4F9B\u5B8C\u6574\u610F\u7FA4\u3002" : "\u8BFE\u7A0B\u5C1A\u672A\u63D0\u4F9B\u8FD9\u79CD\u7EC3\u4E60\u6240\u9700\u7684\u5185\u5BB9\u3002")
          )
        };
      });
    }
    static fromDraft(draft) {
      const lines = Array.isArray(draft.items) ? draft.items : [];
      const hasChunks = lines.length > 0 && lines.every((item) => Array.isArray(item.chunks) && item.chunks.length > 0);
      const hasRoles = draft.contentForm === "dialogue" && Array.isArray(draft.roles) && draft.roles.length >= 2 && lines.every((item) => item.role);
      return {
        text: lines.length > 0 && lines.every((item) => !!item.en),
        audio: false,
        translation: lines.length > 0 && lines.every((item) => !!item.zh),
        chunkSelection: hasChunks,
        roleplay: hasRoles
      };
    }
  };
  var COURSE_MODES = modes;

  // scripts/course-capabilities-entry.mjs
  globalThis.ChunkCourseCapabilities = {
    CourseCapabilityCatalog,
    COURSE_MODES,
    describeCreationOptions: () => CourseCapabilityCatalog.describeCreationOptions(),
    resolveRuntimeModes: (course) => CourseCapabilityCatalog.resolveRuntimeModes(course)
  };
})();
