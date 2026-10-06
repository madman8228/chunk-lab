import { DRAFT_SCHEMA } from './draft-spec.mjs';
import { CourseCapabilityCatalog } from './capabilities.mjs';
import { SENTENCE_TEMPLATE } from './learning-contract.mjs';
import { CourseTypeCatalog } from './course-types.mjs';

const simpleExerciseIds = Object.freeze(SENTENCE_TEMPLATE.modes.slice());

export class CourseCreationPreferences {
  static describeOptions() {
    return {
      forms: CourseTypeCatalog.list(),
      levels: DRAFT_SCHEMA.properties.targetCefr.enum.slice(),
      exercises: CourseCapabilityCatalog.describeCreationOptions().filter((mode) => simpleExerciseIds.includes(mode.id)).map((mode) => ({ ...mode, selectable: true }))
    };
  }

  static defaults() {
    return Object.freeze({ courseType: 'sentence', contentForm: 'sentences', targetCefrs: Object.freeze([]), exerciseModes: Object.freeze(['typing', 'chunkSelection']) });
  }

  static normalize(value = {}) {
    const defaults = this.defaults();
    const options = this.describeOptions();
    const courseType = options.forms.some((item) => item.id === value.courseType) ? value.courseType : (value.contentForm === 'imageText' ? 'imageText' : 'sentence');
    const contentForm = courseType === 'sentence' ? 'sentences' : 'sentences';
    // Existing local drafts used a single targetCefr; preserve that choice as a one-item selection.
    const legacyLevels = options.levels.includes(value.targetCefr) ? [value.targetCefr] : defaults.targetCefrs;
    const targetCefrs = [...new Set((Array.isArray(value.targetCefrs) ? value.targetCefrs : legacyLevels).filter((level) => options.levels.includes(level)))];
    const exerciseModes = [...new Set(Array.isArray(value.exerciseModes) ? value.exerciseModes.filter((id) => simpleExerciseIds.includes(id)) : defaults.exerciseModes)];
    if (exerciseModes.length === 0) exerciseModes.push('typing');
    return Object.freeze({ courseType, contentForm, targetCefrs: Object.freeze(targetCefrs), exerciseModes: Object.freeze(exerciseModes) });
  }
}
