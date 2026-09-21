(() => {
  // src/core/runtime.mjs
  function createSingleFlight() {
    let current = null;
    return Object.freeze({
      run(factory) {
        if (current) return current;
        if (typeof factory !== "function") throw new TypeError("factory must be a function");
        const task = Promise.resolve().then(factory);
        let shared;
        shared = task.finally(() => {
          if (current === shared) current = null;
        });
        current = shared;
        return shared;
      },
      clear() {
        current = null;
      }
    });
  }
  function createTaskQueue() {
    let tail = Promise.resolve();
    return Object.freeze({
      enqueue(factory) {
        if (typeof factory !== "function") throw new TypeError("factory must be a function");
        const task = tail.then(factory);
        tail = task.then(() => void 0, () => void 0);
        return task;
      },
      wait() {
        return tail;
      }
    });
  }
  function createWriteCoordinator(options = {}) {
    const queue = options.queue || null;
    let tail = Promise.resolve();
    return Object.freeze({
      enqueue(factory) {
        const task = queue ? queue.enqueue(factory) : tail.then(factory);
        const settled = task.catch((error) => {
          if (typeof options.onError === "function") options.onError(error);
        });
        tail = queue ? queue.wait() : settled;
        return task;
      },
      wait() {
        return tail;
      }
    });
  }
  function createLatestWriteLane(options = {}) {
    const sameLane = typeof options.sameLane === "function" ? options.sameLane : () => false;
    const mergePending = typeof options.mergePending === "function" ? options.mergePending : () => {
    };
    let active = null;
    let pending = null;
    let tail = Promise.resolve();
    function track(promise) {
      tail = Promise.all([tail, promise]).then(() => true, () => false);
      if (typeof options.onTail === "function") options.onTail(tail);
    }
    function finish(entry, value, error) {
      if (error) entry.reject(error);
      else entry.resolve(value);
      if (active === entry) active = null;
      if (!active && pending) {
        const next = pending;
        pending = null;
        start(next);
      }
    }
    function start(entry) {
      active = entry;
      Promise.resolve().then(() => options.start(entry)).then((value) => finish(entry, value), (error) => finish(entry, null, error));
    }
    return Object.freeze({
      enqueue(entry) {
        if (!entry || typeof entry !== "object") throw new TypeError("entry must be an object");
        entry.promise = new Promise((resolve, reject) => {
          entry.resolve = resolve;
          entry.reject = reject;
        });
        track(entry.promise);
        if (!active) {
          start(entry);
          return entry.promise;
        }
        if (pending && sameLane(pending, entry)) {
          mergePending(pending, entry);
          return pending.promise;
        }
        if (!pending) {
          pending = entry;
          return entry.promise;
        }
        const error = typeof options.onOverflow === "function" ? options.onOverflow(entry) : new Error("write queue is full");
        entry.reject(error);
        return entry.promise;
      },
      wait() {
        return tail;
      }
    });
  }
  function createTabNotifier(options = {}) {
    const tabId = String(options.tabId || "");
    const syncKey = String(options.syncKey || "");
    const storeKey = String(options.storeKey || "");
    const storage = options.storage;
    const now = typeof options.now === "function" ? options.now : Date.now;
    let sequence = 0;
    let externalSequence = 0;
    function publish(area) {
      sequence += 1;
      const message = { v: 1, type: "chunklab-write", tabId, area: area || "mem", seq: sequence, at: now() };
      try {
        if (storage && typeof storage.setItem === "function") storage.setItem(syncKey, JSON.stringify(message));
      } catch (_) {
      }
      return message;
    }
    function receive(message) {
      if (!message || message.type !== "chunklab-write" || message.tabId === tabId) return null;
      externalSequence += 1;
      return { seq: externalSequence, area: message.area || "mem", fromTab: message.tabId };
    }
    function receiveStorageEvent(event, decodeKey) {
      if (!event || !event.key) return null;
      const key = typeof decodeKey === "function" ? decodeKey(event.key) : event.key;
      if (key === syncKey) {
        if (!event.newValue) return null;
        try {
          return receive(JSON.parse(event.newValue));
        } catch (_) {
          return null;
        }
      }
      if (key === storeKey) {
        externalSequence += 1;
        return { seq: externalSequence, area: "mem", fromTab: "" };
      }
      return null;
    }
    return Object.freeze({
      publish,
      receive,
      receiveStorageEvent,
      state: () => ({ sequence, external: externalSequence })
    });
  }
  var CoreRuntime = Object.freeze({ createSingleFlight, createTaskQueue, createWriteCoordinator, createLatestWriteLane, createTabNotifier });

  // scripts/core-runtime-entry.mjs
  if (typeof globalThis !== "undefined") globalThis.CoreRuntime = CoreRuntime;
})();
