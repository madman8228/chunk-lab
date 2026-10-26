export function appendSceneVisual(parent, visual, registry) {
  const scene = registry.scenes[visual?.sceneId];
  if (!scene) return null;

  const frame = document.createElement('div');
  frame.className = `blackboard-visuals${scene.kind === 'object-pair' ? ' is-object-pair' : ''}${scene.assetIds.length === 3 ? ' is-triple' : ''}`;
  frame.setAttribute('role', 'group');
  frame.setAttribute('aria-label', scene.alt);

  for (const assetId of scene.assetIds) {
    const asset = registry.assets[assetId];
    if (!asset) continue;
    const image = document.createElement('img');
    image.className = 'blackboard-visual';
    image.src = asset.src;
    image.alt = asset.alt;
    image.width = asset.width;
    image.height = asset.height;
    image.decoding = 'async';
    image.onerror = () => { image.hidden = true; };
    frame.append(image);
    if (scene.linkWord && assetId === scene.assetIds[0]) {
      const link = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      link.setAttribute('class', 'blackboard-link');
      link.setAttribute('viewBox', '0 0 40 48');
      link.setAttribute('aria-hidden', 'true');
      link.innerHTML = '<path d="M2 33h34m-7-7 7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', '20'); label.setAttribute('y', '17'); label.setAttribute('text-anchor', 'middle'); label.setAttribute('fill', 'currentColor');
      label.textContent = scene.linkWord;
      link.append(label);
      frame.append(link);
      if (scene.assetIds.length === 1) {
        const state = document.createElement('span');
        state.className = 'blackboard-state-placeholder'; state.textContent = '状态';
        frame.append(state);
      }
    }
  }

  parent.append(frame);
  return frame;
}
