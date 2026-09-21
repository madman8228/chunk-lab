function createLifecycle(options) {
  var opts = options || {};
  var generation = 0;
  var state = 'idle';

  function publish(nextState, extra) {
    state = nextState;
    if (typeof opts.onState === 'function') opts.onState(Object.assign({ state: state, generation: generation }, extra || {}));
  }

  function begin(target) {
    generation += 1;
    publish('loading', { target: target || 'unknown' });
    return generation;
  }

  function cancel(reason) {
    generation += 1;
    publish('idle', { reason: reason || 'cancelled' });
    return generation;
  }

  function isCurrent(token) {
    return token === generation;
  }

  function complete(token, value) {
    if (!isCurrent(token)) return false;
    publish('ready', { value: value });
    return true;
  }

  function fail(token, error) {
    if (!isCurrent(token)) return false;
    publish('error', { error: error });
    return true;
  }

  function run(target, task) {
    var token = begin(target);
    var promise;
    try {
      promise = Promise.resolve().then(task);
    } catch (error) {
      promise = Promise.reject(error);
    }
    return promise.then(function (value) {
      complete(token, value);
      return { current: isCurrent(token), token: token, value: value };
    }, function (error) {
      fail(token, error);
      throw error;
    });
  }

  return {
    begin: begin,
    cancel: cancel,
    complete: complete,
    fail: fail,
    isCurrent: isCurrent,
    run: run,
    getGeneration: function () { return generation; },
    getState: function () { return state; }
  };
}

export { createLifecycle };
