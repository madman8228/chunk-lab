(() => {
  // src/core/event-bus.mjs
  function createEventBus() {
    const listeners = {};
    function on(type, listener) {
      (listeners[type] || (listeners[type] = [])).push(listener);
      return function off() {
        listeners[type] = (listeners[type] || []).filter((item) => item !== listener);
      };
    }
    function emit(type, payload) {
      (listeners[type] || []).slice().forEach((listener) => {
        try {
          listener(payload);
        } catch (_) {
        }
      });
    }
    return Object.freeze({ on, emit });
  }
  var CoreEventBus = Object.freeze({ createEventBus });

  // scripts/core-event-bus-entry.mjs
  if (typeof globalThis !== "undefined") globalThis.CoreEventBus = CoreEventBus;
})();
