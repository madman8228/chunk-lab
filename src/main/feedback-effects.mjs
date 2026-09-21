/* Browser feedback adapters: keep Web Audio, speech and canvas effects out of main.html. */

function getDefaultWindow() {
  return typeof window !== 'undefined' ? window : globalThis;
}

function getDefaultDocument() {
  return typeof document !== 'undefined' ? document : null;
}

export function createAudioFeedback(options = {}) {
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
    if (audio.state === 'suspended' && typeof audio.resume === 'function') audio.resume();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = type || 'sine';
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
      beep(880, 0.08, 'sine', 0.08);
      setTimeoutFn(() => beep(1100, 0.12, 'sine', 0.06), 80);
    },
    bad() {
      if (!enabled()) return;
      beep(220, 0.15, 'sawtooth', 0.08);
    },
    perfect() {
      if (!enabled()) return;
      beep(660, 0.08, 'sine', 0.07);
      setTimeoutFn(() => beep(880, 0.08, 'sine', 0.07), 80);
      setTimeoutFn(() => beep(1320, 0.15, 'sine', 0.06), 160);
    },
  });
}

export function createSpeechFeedback(options = {}) {
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
      utterance.lang = 'en-US';
      utterance.rate = 0.92;
      speech.cancel();
      speech.speak(utterance);
    } catch (_) {
      /* Speech is an optional enhancement; a browser without it must still work. */
    }
  };
}

export function createVisualFeedback(options = {}) {
  const hostWindow = options.window || getDefaultWindow();
  const hostDocument = options.document || getDefaultDocument();
  const random = options.random || Math.random;
  const setTimeoutFn = options.setTimeout || ((fn, delay) => hostWindow.setTimeout(fn, delay));
  const requestFrame = options.requestAnimationFrame
    || ((fn) => hostWindow.requestAnimationFrame(fn));
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
    canvas = hostDocument.createElement('canvas');
    canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999;';
    hostDocument.body.appendChild(canvas);
    context = canvas.getContext('2d');
    resize();
    if (hostWindow.addEventListener) hostWindow.addEventListener('resize', resize);
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
    const colors = ['#ff4757', '#2ed573', '#1e90ff', '#ffa502', '#ff6b81', '#7bed9f', '#70a1ff', '#eccc68'];
    return colors[(random() * colors.length) | 0];
  }

  return Object.freeze({
    confetti(count) {
      const amount = count || 30;
      if (!ensureCanvas()) return;
      for (let index = 0; index < amount; index += 1) {
        spawn(canvas.width * 0.3 + random() * canvas.width * 0.4, -10,
          (random() - 0.5) * 6, 2 + random() * 4,
          randomColor(), 80 + random() * 60, 4 + random() * 4, random() > 0.5 ? 1 : 0);
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
            spawn(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed - 2,
              randomColor(), 50 + random() * 40, 2 + random() * 3, 1);
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
        spawn(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed - 1.5,
          randomColor(), 40 + random() * 30, 2 + random() * 2, 1);
      }
      if (particles.length > 0) tick();
    },
  });
}

export function createFeedbackEffects(options = {}) {
  return Object.freeze({
    sfx: createAudioFeedback(options),
    speakSentence: createSpeechFeedback(options),
    fx: createVisualFeedback(options),
  });
}
