import { CourseCapabilityCatalog, COURSE_MODES } from '../src/course-authoring/capabilities.mjs';

globalThis.ChunkCourseCapabilities = { CourseCapabilityCatalog, COURSE_MODES,
  describeCreationOptions: () => CourseCapabilityCatalog.describeCreationOptions(),
  resolveRuntimeModes: (course) => CourseCapabilityCatalog.resolveRuntimeModes(course) };
