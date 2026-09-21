var MainLifecycle = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // scripts/main-lifecycle-entry.mjs
  var main_lifecycle_entry_exports = {};
  __export(main_lifecycle_entry_exports, {
    consumeStartHandoff: () => consumeStartHandoff,
    createAudioFeedback: () => createAudioFeedback,
    createBootCoordinator: () => createBootCoordinator,
    createFeedbackEffects: () => createFeedbackEffects,
    createLifecycle: () => createLifecycle,
    createSpeechFeedback: () => createSpeechFeedback,
    createVisualFeedback: () => createVisualFeedback,
    evaluateChunkAnswer: () => evaluateChunkAnswer,
    isFreshNavigation: () => isFreshNavigation,
    navigationType: () => navigationType,
    resolveEntry: () => resolveEntry,
    selectResumeDeck: () => selectResumeDeck
  });

  // src/main/entry.mjs
  function asParams(search) {
    if (search && typeof search.get === "function") return search;
    return new URLSearchParams(String(search || ""));
  }
  function navigationType(performanceLike) {
    try {
      var nav = performanceLike && performanceLike.getEntriesByType ? performanceLike.getEntriesByType("navigation")[0] : null;
      if (nav && nav.type) return nav.type;
      if (performanceLike && performanceLike.navigation && performanceLike.navigation.type === 1) return "reload";
    } catch (error) {
    }
    return "navigate";
  }
  function isFreshNavigation(type) {
    return type === "navigate";
  }
  function readObject(storage, key) {
    if (!storage || typeof storage.getItem !== "function") return null;
    try {
      var raw = storage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }
  function consumeStartHandoff(options) {
    var opts = options || {};
    var sessionStorage = opts.sessionStorage;
    var businessStorage = opts.businessStorage;
    var now = typeof opts.now === "number" ? opts.now : Date.now();
    var intent = readObject(sessionStorage, "_startIntent");
    if (intent) {
      try {
        sessionStorage.removeItem("_startIntent");
      } catch (error) {
      }
      if (intent.version === 1 && intent.kind === "unit" && intent.unitId) {
        return { kind: "unit", unitId: intent.unitId };
      }
    }
    var deck = readObject(sessionStorage, "_startDeck");
    if (deck) {
      try {
        sessionStorage.removeItem("_startDeck");
      } catch (error) {
      }
      return { kind: "deck", deck };
    }
    var review = readObject(businessStorage, "chunklab_pending_review_deck");
    if (review) {
      try {
        businessStorage.removeItem("chunklab_pending_review_deck");
      } catch (error) {
      }
      if (now - Number(review.ts || 0) < 3e4 && review.deck) {
        return { kind: "review", deck: review.deck };
      }
    }
    return { kind: "none" };
  }
  function resolveEntry(options) {
    var opts = options || {};
    var params = asParams(opts.search);
    var now = typeof opts.now === "number" ? opts.now : Date.now();
    var type = opts.navigationType || "navigate";
    var explicitCatalog = !!(params.get("course") && params.get("lesson"));
    if (explicitCatalog) {
      return { kind: "catalog", course: params.get("course"), lesson: params.get("lesson"), explicit: true };
    }
    if (params.get("direct") === "1") return { kind: "direct", explicit: true };
    if (params.get("autostart") === "1") {
      var review = opts.review;
      if (review && review.deck && now - Number(review.ts || 0) < 3e4) {
        return { kind: "review", deck: review.deck, explicit: true };
      }
      return { kind: "invalid", reason: "review-expired", explicit: true };
    }
    if (isFreshNavigation(type)) {
      if (opts.intent && opts.intent.kind === "unit" && opts.intent.unitId) {
        return { kind: "unit", unitId: opts.intent.unitId };
      }
      if (opts.deck) return { kind: "deck", deck: opts.deck };
    }
    return { kind: "home" };
  }

  // src/main/lifecycle.mjs
  function createLifecycle(options) {
    var opts = options || {};
    var generation = 0;
    var state = "idle";
    function publish(nextState, extra) {
      state = nextState;
      if (typeof opts.onState === "function") opts.onState(Object.assign({ state, generation }, extra || {}));
    }
    function begin(target) {
      generation += 1;
      publish("loading", { target: target || "unknown" });
      return generation;
    }
    function cancel(reason) {
      generation += 1;
      publish("idle", { reason: reason || "cancelled" });
      return generation;
    }
    function isCurrent(token) {
      return token === generation;
    }
    function complete(token, value) {
      if (!isCurrent(token)) return false;
      publish("ready", { value });
      return true;
    }
    function fail(token, error) {
      if (!isCurrent(token)) return false;
      publish("error", { error });
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
      return promise.then(function(value) {
        complete(token, value);
        return { current: isCurrent(token), token, value };
      }, function(error) {
        fail(token, error);
        throw error;
      });
    }
    return {
      begin,
      cancel,
      complete,
      fail,
      isCurrent,
      run,
      getGeneration: function() {
        return generation;
      },
      getState: function() {
        return state;
      }
    };
  }

  // src/main/resume.mjs
  function deckItems(deck) {
    return deck && Array.isArray(deck.items) ? deck.items : [];
  }
  function selectResumeDeck(options) {
    var opts = options || {};
    var mem = opts.mem || {};
    var findDeck = typeof opts.findDeck === "function" ? opts.findDeck : function() {
      return null;
    };
    var allDecks = typeof opts.allDecks === "function" ? opts.allDecks : function() {
      return [];
    };
    var active = null;
    var activeId = typeof mem.activeDeckId === "string" ? mem.activeDeckId : "";
    if (activeId) {
      var activeDeck = findDeck(activeId);
      if (activeDeck) {
        var progress = mem.progress && mem.progress[activeId];
        var index = progress && Number(progress.idx);
        if (Number.isInteger(index) && index > 0 && index < deckItems(activeDeck).length) {
          return { deck: activeDeck, index, resumed: true };
        }
        active = activeDeck;
      }
    }
    if (!active) {
      var best = null;
      var bestTime = 0;
      allDecks().forEach(function(deck) {
        var played = mem.best && mem.best[deck && deck.id] && mem.best[deck.id].lastPlayed || 0;
        if (played > bestTime) {
          bestTime = played;
          best = deck;
        }
      });
      active = best;
    }
    return { deck: active || allDecks()[0] || null, index: 0, resumed: false };
  }

  // src/main/boot.mjs
  function createBootCoordinator(options = {}) {
    const entryRequested = options.entryRequested === true;
    let booted = false;
    let localPainted = false;
    let entryClaimed = false;
    return Object.freeze({
      shouldPaintLocal() {
        return !booted && !localPainted && !entryRequested;
      },
      markLocalPainted() {
        if (booted || localPainted || entryRequested) return false;
        localPainted = true;
        return true;
      },
      markBooted() {
        booted = true;
        return true;
      },
      claimEntry() {
        entryClaimed = true;
        return true;
      },
      isBooted() {
        return booted;
      },
      isEntryClaimed() {
        return entryClaimed;
      },
      snapshot() {
        return { entryRequested, booted, localPainted, entryClaimed };
      }
    });
  }

  // src/main/feedback-effects.mjs
  function getDefaultWindow() {
    return typeof window !== "undefined" ? window : globalThis;
  }
  function getDefaultDocument() {
    return typeof document !== "undefined" ? document : null;
  }
  function createAudioFeedback(options = {}) {
    const hostWindow = options.window || getDefaultWindow();
    const getSettings = options.getSettings || (() => ({}));
    const setTimeoutFn = options.setTimeout || ((fn, delay) => hostWindow.setTimeout(fn, delay));
    let context = null;
    function audioContext() {
      if (!context) {
        try {
          const AudioContextCtor = hostWindow.AudioContext || hostWindow.webkitAudioContext;
          if (AudioContextCtor) context = new AudioContextCtor();
        } catch (_) {
          context = null;
        }
      }
      return context;
    }
    function beep(freq, duration, type, volume) {
      const audio = audioContext();
      if (!audio) return;
      if (audio.state === "suspended" && typeof audio.resume === "function") audio.resume();
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = type || "sine";
      oscillator.frequency.value = freq || 440;
      gain.gain.value = volume || 0.1;
      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.start();
      oscillator.stop(audio.currentTime + (duration || 0.1));
    }
    function enabled() {
      const settings = getSettings() || {};
      return settings.sound !== false;
    }
    return Object.freeze({
      ok() {
        if (!enabled()) return;
        beep(880, 0.08, "sine", 0.08);
        setTimeoutFn(() => beep(1100, 0.12, "sine", 0.06), 80);
      },
      bad() {
        if (!enabled()) return;
        beep(220, 0.15, "sawtooth", 0.08);
      },
      perfect() {
        if (!enabled()) return;
        beep(660, 0.08, "sine", 0.07);
        setTimeoutFn(() => beep(880, 0.08, "sine", 0.07), 80);
        setTimeoutFn(() => beep(1320, 0.15, "sine", 0.06), 160);
      }
    });
  }
  function createSpeechFeedback(options = {}) {
    const hostWindow = options.window || getDefaultWindow();
    const getCurrentItem = options.getCurrentItem || (() => null);
    return function speakSentence() {
      try {
        const item = getCurrentItem();
        if (!item || !item.sentence) return;
        const Utterance = hostWindow.SpeechSynthesisUtterance;
        const speech = hostWindow.speechSynthesis;
        if (!Utterance || !speech) return;
        const utterance = new Utterance(item.sentence);
        utterance.lang = "en-US";
        utterance.rate = 0.92;
        speech.cancel();
        speech.speak(utterance);
      } catch (_) {
      }
    };
  }
  function createVisualFeedback(options = {}) {
    const hostWindow = options.window || getDefaultWindow();
    const hostDocument = options.document || getDefaultDocument();
    const random = options.random || Math.random;
    const setTimeoutFn = options.setTimeout || ((fn, delay) => hostWindow.setTimeout(fn, delay));
    const requestFrame = options.requestAnimationFrame || ((fn) => hostWindow.requestAnimationFrame(fn));
    let canvas = null;
    let context = null;
    const particles = [];
    function resize() {
      if (canvas) {
        canvas.width = hostWindow.innerWidth;
        canvas.height = hostWindow.innerHeight;
      }
    }
    function ensureCanvas() {
      if (canvas) return true;
      if (!hostDocument || !hostDocument.createElement || !hostDocument.body) return false;
      canvas = hostDocument.createElement("canvas");
      canvas.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999;";
      hostDocument.body.appendChild(canvas);
      context = canvas.getContext("2d");
      resize();
      if (hostWindow.addEventListener) hostWindow.addEventListener("resize", resize);
      return !!context;
    }
    function spawn(x, y, vx, vy, color, life, size, type) {
      particles.push({ x, y, vx, vy, c: color, l: life, ml: life, s: size, t: type, r: random() * 6.28 });
    }
    function tick() {
      if (!context || !canvas) return;
      context.clearRect(0, 0, canvas.width, canvas.height);
      for (let index = particles.length - 1; index >= 0; index -= 1) {
        const particle = particles[index];
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vy += 0.12;
        particle.l -= 1;
        particle.r += 0.15;
        const alpha = particle.l / particle.ml;
        context.globalAlpha = Math.max(0, alpha);
        context.fillStyle = particle.c;
        const size = Math.max(0, particle.s * alpha);
        if (particle.t === 0) {
          context.fillRect(particle.x - size / 2, particle.y - size / 2, size, size);
        } else {
          context.beginPath();
          context.arc(particle.x, particle.y, size, 0, 6.28);
          context.fill();
        }
        if (particle.l <= 0) particles.splice(index, 1);
      }
      context.globalAlpha = 1;
      if (particles.length > 0) {
        requestFrame(tick);
      } else {
        if (canvas.remove) canvas.remove();
        else if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
        canvas = null;
        context = null;
      }
    }
    function randomColor() {
      const colors = ["#ff4757", "#2ed573", "#1e90ff", "#ffa502", "#ff6b81", "#7bed9f", "#70a1ff", "#eccc68"];
      return colors[random() * colors.length | 0];
    }
    return Object.freeze({
      confetti(count) {
        const amount = count || 30;
        if (!ensureCanvas()) return;
        for (let index = 0; index < amount; index += 1) {
          spawn(
            canvas.width * 0.3 + random() * canvas.width * 0.4,
            -10,
            (random() - 0.5) * 6,
            2 + random() * 4,
            randomColor(),
            80 + random() * 60,
            4 + random() * 4,
            random() > 0.5 ? 1 : 0
          );
        }
        if (particles.length > 0) tick();
      },
      show(count) {
        const amount = count || 5;
        if (!ensureCanvas()) return;
        for (let index = 0; index < amount; index += 1) {
          setTimeoutFn(() => {
            if (!canvas) return;
            const x = canvas.width * 0.2 + random() * canvas.width * 0.6;
            const y = canvas.height * 0.3 + random() * canvas.height * 0.3;
            for (let particle = 0; particle < 40; particle += 1) {
              const angle = random() * 6.28;
              const speed = 1 + random() * 4;
              spawn(
                x,
                y,
                Math.cos(angle) * speed,
                Math.sin(angle) * speed - 2,
                randomColor(),
                50 + random() * 40,
                2 + random() * 3,
                1
              );
            }
            if (particles.length > 0 && !particles.running) {
              particles.running = true;
              tick();
            }
          }, index * 250);
        }
      },
      mini(x, y) {
        if (!ensureCanvas()) return;
        for (let index = 0; index < 20; index += 1) {
          const angle = random() * 6.28;
          const speed = 1 + random() * 3;
          spawn(
            x,
            y,
            Math.cos(angle) * speed,
            Math.sin(angle) * speed - 1.5,
            randomColor(),
            40 + random() * 30,
            2 + random() * 2,
            1
          );
        }
        if (particles.length > 0) tick();
      }
    });
  }
  function createFeedbackEffects(options = {}) {
    return Object.freeze({
      sfx: createAudioFeedback(options),
      speakSentence: createSpeechFeedback(options),
      fx: createVisualFeedback(options)
    });
  }

  // src/main/answer-evaluation.mjs
  function evaluateChunkAnswer(options = {}) {
    const value = options.value;
    const right = options.right;
    const alternatives = Array.isArray(options.alternatives) ? options.alternatives : [];
    const normalize = typeof options.normalize === "function" ? options.normalize : (text) => String(text == null ? "" : text);
    if (typeof options.judge === "function") {
      try {
        return !!options.judge(value, right, alternatives);
      } catch (_) {
      }
    }
    return [right].concat(alternatives).some((candidate) => normalize(value) === normalize(candidate));
  }
  return __toCommonJS(main_lifecycle_entry_exports);
})();
