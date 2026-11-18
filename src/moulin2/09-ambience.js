// La Fête du Moulin — ambiances pour travailler (quand on est assis) : jazz feutré, pluie, bruit
// blanc, bruit brun. Tout est synthétisé dans le navigateur (aucun fichier audio). Tant qu'une
// ambiance joue, l'orgue de foire se tait ; il reprend quand on se lève.
//
//   MF.ambience.MODES       [{ id, icon, name }]  ("fair" = la musique de la fête)
//   MF.ambience.set(id)     choisit l'ambiance (gardée dans le navigateur) ; MF.ambience.mode
//   MF.ambience.play(on)    la fait entendre (assis) ou la coupe (debout)
(function () {
  "use strict";
  const MF = (globalThis.MoulinFete = globalThis.MoulinFete || {});
  const STORE = "fete-ambiance";
  const MODES = [
    { id: "fair", icon: "🎪", name: "Fair organ" },
    { id: "jazz", icon: "🎷", name: "Jazz" },
    { id: "rain", icon: "🌧️", name: "Rain" },
    { id: "white", icon: "🌫️", name: "White noise" },
    { id: "brown", icon: "🟤", name: "Brown noise" },
    { id: "quiet", icon: "🔇", name: "Silence" },
  ];
  const amb = (MF.ambience = { MODES, mode: "fair", playing: false, volume: 0.5 });
  try {
    const saved = typeof localStorage !== "undefined" && localStorage.getItem(STORE);
    if (saved && MODES.some((m) => m.id === saved)) amb.mode = saved;
  } catch (error) {
    /* sans importance */
  }

  let ac = null, out = null, nodes = [], timer = null, nextBar = 0, bar = 0;
  function context() {
    if (ac) return ac;
    const A = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!A) return null;
    ac = (MF.sfx && MF.sfx.ctx) || new A();
    out = ac.createGain();
    out.gain.value = 0;
    out.connect(ac.destination);
    return ac;
  }
  /** Tampon de bruit de quatre secondes : blanc, ou brun (marche au hasard filtrée). */
  function noiseBuffer(kind) {
    const n = ac.sampleRate * 4, buffer = ac.createBuffer(1, n, ac.sampleRate), d = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === "brown") {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      } else d[i] = w;
    }
    return buffer;
  }
  function loopNoise(kind, gain, filter) {
    const src = ac.createBufferSource(), g = ac.createGain();
    src.buffer = noiseBuffer(kind);
    src.loop = true;
    g.gain.value = gain;
    let node = src;
    if (filter) {
      const f = ac.createBiquadFilter();
      f.type = filter.type;
      f.frequency.value = filter.f;
      f.Q.value = filter.q || 0.7;
      node.connect(f);
      node = f;
    }
    node.connect(g).connect(out);
    src.start();
    nodes.push(src);
    return g;
  }

  /* ---- jazz : contrebasse qui marche, balais, accords de piano électrique, quelques notes de piano */
  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
  // ii–V–I dans quatre tonalités, deux mesures par accord : [fondamentale, tierce/septième…]
  const CHANGES = [
    [50, [0, 3, 7, 10]], [43, [0, 4, 7, 10]], [48, [0, 4, 7, 11]], [48, [0, 4, 7, 11]], // Dm7 G7 Cmaj7
    [53, [0, 3, 7, 10]], [46, [0, 4, 7, 10]], [51, [0, 4, 7, 11]], [51, [0, 4, 7, 11]], // Fm7 Bb7 Ebmaj7
    [52, [0, 3, 7, 10]], [45, [0, 4, 7, 10]], [50, [0, 4, 7, 11]], [45, [0, 4, 7, 10]], // Em7 A7 Dmaj7 A7
    [50, [0, 3, 7, 10]], [43, [0, 4, 7, 10]], [48, [0, 4, 7, 11]], [45, [0, 3, 7, 10]], // Dm7 G7 Cmaj7 Am7
  ];
  const SCALE = [0, 2, 3, 5, 7, 9, 10];
  function note(freq, when, dur, type, level, attack = 0.01) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(level, when + attack);
    g.gain.exponentialRampToValueAtTime(0.0008, when + dur);
    o.connect(g).connect(out);
    o.start(when);
    o.stop(when + dur + 0.05);
  }
  let brush = null;
  function swish(when, level, dur) {
    const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = brush || (brush = noiseBuffer("white"));
    f.type = "highpass";
    f.frequency.value = 5200;
    g.gain.setValueAtTime(level, when);
    g.gain.exponentialRampToValueAtTime(0.0006, when + dur);
    src.connect(f).connect(g).connect(out);
    src.start(when, Math.random() * 3, dur + 0.02);
  }
  function scheduleBar(t) {
    const beat = 60 / 92, [root, tones] = CHANGES[bar % CHANGES.length], next = CHANGES[(bar + 1) % CHANGES.length][0];
    // contrebasse : fondamentale, quinte, approche chromatique de l'accord suivant
    const walk = [root, root + tones[1], root + 7, next + (Math.random() < 0.5 ? 1 : -1)];
    walk.forEach((n, i) => note(midi(n - 12), t + i * beat, beat * 0.92, "triangle", 0.2, 0.012));
    // balais : cymbale sur chaque temps, croche pointée « swing » sur 2 et 4
    for (let i = 0; i < 4; i++) {
      swish(t + i * beat, 0.035, 0.22);
      if (i % 2) swish(t + (i + 0.667) * beat, 0.022, 0.12);
    }
    // accord de piano électrique, placé sur le 1 ou en anticipation
    const at = t + (bar % 2 ? beat * 1.667 : 0);
    for (const k of tones) note(midi(root + 12 + k), at, beat * 2.6, "sine", 0.045, 0.02);
    // quelques notes de piano, une mesure sur deux
    if (bar % 2 === 0 || Math.random() < 0.35) {
      let step = Math.floor(Math.random() * SCALE.length);
      const count = 2 + Math.floor(Math.random() * 4);
      for (let i = 0; i < count; i++) {
        step = Math.max(0, Math.min(SCALE.length * 2 - 1, step + Math.floor(Math.random() * 5) - 2));
        const n = root + 24 + SCALE[step % SCALE.length] + (step >= SCALE.length ? 12 : 0);
        const when = t + (Math.floor(Math.random() * 4) + (Math.random() < 0.5 ? 0 : 0.667)) * beat;
        note(midi(n), when, beat * 1.4, "triangle", 0.05, 0.006);
      }
    }
    bar++;
    return 4 * beat;
  }
  function pump() {
    if (!ac || amb.mode !== "jazz" || !amb.playing) return;
    while (nextBar < ac.currentTime + 1.2) nextBar += scheduleBar(Math.max(nextBar, ac.currentTime + 0.05));
  }

  function silence() {
    for (const n of nodes)
      try {
        n.stop();
      } catch (error) {
        /* déjà arrêté */
      }
    nodes = [];
    if (timer) clearInterval(timer);
    timer = null;
  }
  function apply() {
    const own = amb.playing && amb.mode !== "fair";
    // l'orgue de foire se tait pendant une ambiance
    if (MF.music && MF.music.duck) MF.music.duck(own);
    if (!own || amb.mode === "quiet") {
      if (out && ac) out.gain.setTargetAtTime(0, ac.currentTime, 0.15);
      setTimeout(() => (!amb.playing || amb.mode === "fair" || amb.mode === "quiet") && silence(), 600);
      return;
    }
    if (!context()) return;
    if (ac.state === "suspended") ac.resume();
    silence();
    out.gain.cancelScheduledValues(ac.currentTime);
    out.gain.setTargetAtTime(amb.volume, ac.currentTime, 0.4);
    if (amb.mode === "white") loopNoise("white", 0.11, { type: "lowpass", f: 6000 });
    else if (amb.mode === "brown") loopNoise("brown", 0.55, { type: "lowpass", f: 900 });
    else if (amb.mode === "rain") {
      loopNoise("white", 0.09, { type: "bandpass", f: 2400, q: 0.5 });
      loopNoise("brown", 0.3, { type: "lowpass", f: 500 });
      timer = setInterval(() => {
        // gouttes : petits claquements au hasard
        if (!ac || !amb.playing) return;
        for (let i = 0; i < 3; i++) if (Math.random() < 0.6) note(1400 + Math.random() * 2600, ac.currentTime + Math.random() * 0.4, 0.05, "sine", 0.012, 0.002);
      }, 420);
    } else if (amb.mode === "jazz") {
      nextBar = ac.currentTime + 0.1;
      timer = setInterval(pump, 250);
      pump();
    }
  }
  amb.set = function (id) {
    if (!MODES.some((m) => m.id === id)) return;
    amb.mode = id;
    try {
      localStorage.setItem(STORE, id);
    } catch (error) {
      /* sans importance */
    }
    apply();
  };
  amb.play = function (on) {
    if (amb.playing === !!on) return;
    amb.playing = !!on;
    apply();
  };
})();
