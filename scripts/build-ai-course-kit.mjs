import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DRAFT_SPEC } from '../src/course-authoring/draft-spec.mjs';
import { CourseCapabilityCatalog } from '../src/course-authoring/capabilities.mjs';
import { IMAGE_TEXT_DRAFT_SPEC } from '../src/course-authoring/image-text-draft-spec.mjs';
import { COURSE_TYPES } from '../src/course-authoring/course-types.mjs';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const kit = { kitVersion: '1.1', courseTypes: COURSE_TYPES,
  draftSchema: DRAFT_SPEC.schema, examples: DRAFT_SPEC.examples,
  imageTextDraftSchema: IMAGE_TEXT_DRAFT_SPEC.schema, imageTextExample: IMAGE_TEXT_DRAFT_SPEC.example,
  imageMediaLimits: IMAGE_TEXT_DRAFT_SPEC.mediaLimits,
  interactionRules: DRAFT_SPEC.interactionRules, capabilities: CourseCapabilityCatalog.describeCreationOptions() };
fs.writeFileSync(path.join(root, 'ai-course-kit.json'), JSON.stringify(kit, null, 2) + '\n', 'utf8');
console.log('[course-kit] generated ai-course-kit.json');
