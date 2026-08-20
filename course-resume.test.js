/* 图文课程进入时恢复阶段决策逻辑测试（与 course-package.js openCourse 中的决策保持一致） */
function decideStage(progress, course) {
  var modules = course.learningModules || {};
  var hasPreStudy = modules.preStudy && modules.preStudy.items && modules.preStudy.items.length;
  var hasPostAssessment = modules.postAssessment && modules.postAssessment.items && modules.postAssessment.items.length;
  var totalNodes = (course.story && course.story.nodes || []).length;
  var moduleStage, nodeId = course.story.startNodeId;

  if (progress.completed) {
    moduleStage = 'done';
  } else if (progress.seen.length > 0) {
    var lastSeenId = progress.seen[progress.seen.length - 1];
    var lastSeenNode = (course.story.nodes || []).find(function (n) { return n.id === lastSeenId; });
    if (progress.seen.length >= totalNodes && hasPostAssessment) {
      moduleStage = 'postAssessment';
    } else {
      moduleStage = 'core';
      if (lastSeenNode) nodeId = lastSeenId;
    }
  } else {
    moduleStage = hasPreStudy ? 'preStudy' : 'core';
  }
  return { moduleStage: moduleStage, nodeId: nodeId };
}

function makeCourse(opts) {
  opts = opts || {};
  var nodes = [];
  for (var i = 1; i <= (opts.nodeCount || 6); i++) {
    nodes.push({ id: 'node' + i, type: i === (opts.nodeCount || 6) ? 'end' : 'interaction' });
  }
  return {
    story: { startNodeId: 'node1', nodes: nodes },
    learningModules: {
      preStudy: opts.noPreStudy ? null : { items: [{ title: { zh: '预习' } }] },
      postAssessment: opts.noPostAssessment ? null : { items: [{ title: { zh: '测试' } }] }
    }
  };
}

var tests = [
  { name: '首次进入（有预习）-> 课前预习', course: makeCourse(), progress: { seen: [], completed: false }, expect: { moduleStage: 'preStudy', nodeId: 'node1' } },
  { name: '首次进入（无预习）-> 主课程', course: makeCourse({ noPreStudy: true }), progress: { seen: [], completed: false }, expect: { moduleStage: 'core', nodeId: 'node1' } },
  { name: '已看部分节点 -> 回到最后节点', course: makeCourse(), progress: { seen: ['node1', 'node2', 'node3'], completed: false }, expect: { moduleStage: 'core', nodeId: 'node3' } },
  { name: '全部故事节点已看（有课后测试）-> 课后测试', course: makeCourse(), progress: { seen: ['node1','node2','node3','node4','node5','node6'], completed: false }, expect: { moduleStage: 'postAssessment', nodeId: 'node1' } },
  { name: '全部故事节点已看（无课后测试）-> 主课程末节点', course: makeCourse({ noPostAssessment: true }), progress: { seen: ['node1','node2','node3','node4','node5','node6'], completed: false }, expect: { moduleStage: 'core', nodeId: 'node6' } },
  { name: '课程已完成 -> 完成页', course: makeCourse(), progress: { seen: ['node1','node2','node3','node4','node5','node6'], completed: true }, expect: { moduleStage: 'done', nodeId: 'node1' } }
];

var passed = 0, failed = 0;
tests.forEach(function (t) {
  var got = decideStage(t.progress, t.course);
  var ok = got.moduleStage === t.expect.moduleStage && got.nodeId === t.expect.nodeId;
  if (ok) { passed++; console.log('✓ ' + t.name); }
  else {
    failed++;
    console.log('✗ ' + t.name + ' -> got ' + JSON.stringify(got) + ', expected ' + JSON.stringify(t.expect));
  }
});
console.log('\n结果：' + passed + ' 通过 / ' + failed + ' 失败');
process.exit(failed ? 1 : 0);
