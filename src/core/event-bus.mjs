/* Small isolated event bus. Each caller creates its own listener registry. */
export function createEventBus() {
  const listeners = {};
  function on(type, listener) {
    (listeners[type] || (listeners[type] = [])).push(listener);
    return function off() {
      listeners[type] = (listeners[type] || []).filter((item) => item !== listener);
    };
  }
  function emit(type, payload) {
    (listeners[type] || []).slice().forEach((listener) => {
      try { listener(payload); } catch (_) { /* one bad listener must not stop the bus */ }
    });
  }
  return Object.freeze({ on, emit });
}

export const CoreEventBus = Object.freeze({ createEventBus });
