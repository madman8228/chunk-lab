import assert from 'node:assert/strict';
import { chooseCourseNavigation } from '../src/main/course-navigation.mjs';

const state = (id, complete, deck = true) => ({
  lesson: { contentRef: { id } },
  deck: deck ? { id } : null,
  complete,
});

const states = [state('a', true), state('b', false), state('c', false)];
const decision = chooseCourseNavigation(states, 'a');
assert.equal(decision.currentIndex, 0);
assert.equal(decision.current, states[0]);
assert.equal(decision.next, states[1]);
assert.equal(decision.allComplete, false);

const wrapped = chooseCourseNavigation(states, 'c');
assert.equal(wrapped.next, states[1]);
assert.equal(chooseCourseNavigation([state('a', true), state('b', true)], 'a').allComplete, true);
assert.equal(chooseCourseNavigation(states, 'missing'), null);
assert.equal(chooseCourseNavigation([], 'a'), null);
console.log('main-course-navigation.test.mjs passed');
