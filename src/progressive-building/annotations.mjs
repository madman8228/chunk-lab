export function resolveSyntaxRanges(step) {
  return (step.syntax ?? []).map(node => ({
    ...node,
    segments: node.segments.map(ids => {
      const start = step.targetTokenIds.indexOf(ids[0]);
      return { tokenIds: [...ids], start, end: start + ids.length };
    }),
  }));
}

export function visibleSyntax(step, selectedTokenIds) {
  const selected = new Set(selectedTokenIds);
  return resolveSyntaxRanges(step).filter(node => node.segments.every(segment => segment.tokenIds.every(id => selected.has(id))));
}

export function hasSyntaxCycle(nodes) {
  const byId = new Map(nodes.map(node => [node.id, node]));
  for (const node of nodes) {
    const visited = new Set([node.id]);
    let parentId = node.parentId;
    while (parentId != null) {
      if (visited.has(parentId)) return true;
      visited.add(parentId);
      parentId = byId.get(parentId)?.parentId;
    }
  }
  return false;
}
