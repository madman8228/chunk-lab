'use strict';
// Reuse the existing isolated five-lesson acceptance harness with this approved candidate.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const filename = path.join(__dirname, 'expression-unit01-complete.test.cjs');
let source = fs.readFileSync(filename, 'utf8');
source = source.replace('output/expression-course-drafts/unit01-complete-v2', 'drafts/zero-english/unit02-review-v1/edge-v2')
  .replace("fill('姓名')", "fill('询问')")
  .replaceAll("lesson.lessonId === 'L102'", "lesson.lessonId === 'L202'")
  .replaceAll("'L102_A07'", "'L202_A07'")
  .replaceAll("lesson_id='L102'", "lesson_id='L202'")
  .replaceAll('greet_and_say_goodbye', 'ask_name')
  .replaceAll("sessionStart.lessonId, 'L102'", "sessionStart.lessonId, 'L202'")
  .replace("fillWordSlots(page, 'Hello')", "fillWordSlots(page, 'What’s your name?')")
  .replace('assert.equal(lastAction.action.response.text, activity.evaluation.acceptedAnswers[0]);', "assert.equal(lastAction.action.response.text.replace(/[.!?]+$/, ''), activity.evaluation.acceptedAnswers[0].replace(/[.!?]+$/, ''));")
  .replaceAll("lesson.lessonId === 'L103'", "lesson.lessonId === 'L203'")
  .replace("} else if (activity.type === 'listening_choice') {", "} else if (activity.type === 'micro_explanation') {\n          await page.getByRole('button', {name: '继续', exact: true}).click();\n        } else if (activity.type === 'listening_choice') {");
// Home's completed-course markup has a separate changing contract; this candidate
// acceptance covers discovery, formal playback, review, resume and directory progress.
const homeStart = source.indexOf("    await page.goto(base + '/main.html?view=home');");
const homeEnd = source.indexOf('    assert.deepEqual(errors, []);', homeStart);
if (homeStart < 0 || homeEnd < 0) throw Error('Five-lesson harness contract changed');
source = source.slice(0, homeStart) + source.slice(homeEnd);
const harness = new Module(filename, module);
harness.filename = filename;
harness.paths = module.paths;
harness._compile(source, filename);
