import { createBrowserLegacyCourseLauncher } from '../src/course-authoring/learning-launch.mjs';

window.CourseLearningLaunch = {
  create: () => createBrowserLegacyCourseLauncher(window),
  markDeleted: (courseId, mem) => createBrowserLegacyCourseLauncher(window).markDeleted(courseId, mem),
  allowRecreate: (courseId, mem) => createBrowserLegacyCourseLauncher(window).allowRecreate(courseId, mem),
  isRetired: (courseId, mem) => createBrowserLegacyCourseLauncher(window).isRetired(courseId, mem)
};
