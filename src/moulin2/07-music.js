// La Fête du Moulin — musique de foire, en boucle (et que l'on peut couper).
//
// Aucun fichier audio : un petit orgue de manège est synthétisé dans le navigateur (flûtes à vapeur,
// basse « oum-pah », accords à contretemps, grosse caisse, caisse claire, carillon) et joue un
// pot-pourri d'airs américains du domaine public — Camptown Races et Oh! Susanna (Stephen Foster,
// 1848-1850), Yankee Doodle, Pop Goes the Weasel — reliés par une marche et une valse de manège
// écrites pour la fête.
//
//   MF.music.start()      à appeler après un premier geste du visiteur (règle des navigateurs)
//   MF.music.setOn(bool)  coupe ou remet la musique (choix gardé dans le navigateur) ; MF.music.on
(function () {
  "use strict";
  const MF = (globalThis.MoulinFete = globalThis.MoulinFete || {});
  const STORE = "fete-musique";

  /* ------------------------------------------------------------------ partitions */
  // Notes : nom + octave (C4 = do du milieu), « r » = silence ; durée en temps (noire = 1).
  // Accords : un par mesure (ou deux, séparés par « / ») ; « 7 » = septième, « m » = mineur.
  const TUNES = {
    march: {
      beats: 2,
      melody: "G4:.5 C5:.5 E5:.5 G5:.5 | E5:1 C5:1 | F5:.5 E5:.5 D5:.5 C5:.5 | D5:1 G4:1 | G4:.5 C5:.5 E5:.5 G5:.5 | A5:1 F5:1 | E5:.5 G5:.5 F5:.5 D5:.5 | C5:1.5 r:.5",
      chords: "C C G7 G7 C F G7 C",
    },
    camptown: {
      beats: 2,
      melody:
        "G4:.5 G4:.5 E4:.5 G4:.5 | A4:.5 G4:.5 E4:1 | E4:.5 D4:1.5 | E4:.5 D4:1.5 | G4:.5 G4:.5 E4:.5 G4:.5 | A4:.5 G4:.5 E4:1 | D4:1 E4:.5 D4:.5 | C4:2 | " +
        "C4:.75 C4:.25 E4:.5 G4:.5 | C5:2 | A4:.75 A4:.25 C5:.5 A4:.5 | G4:2 | G4:.5 G4:.5 E4:.5 G4:.5 | A4:.5 G4:.5 E4:1 | D4:.5 D4:.5 E4:.5 D4:.5 | C4:2",
      chords: "C C G7 G7 C C G7 C C C F C C C G7 C",
    },
    susanna: {
      beats: 2,
      pickup: "C4:.25 D4:.25",
      melody:
        "E4:.5 G4:.5 G4:.75 A4:.25 | G4:.5 E4:.5 C4:.75 D4:.25 | E4:.5 E4:.5 D4:.5 C4:.5 | D4:1.5 C4:.25 D4:.25 | E4:.5 G4:.5 G4:.75 A4:.25 | G4:.5 E4:.5 C4:.75 D4:.25 | E4:.5 E4:.5 D4:.5 D4:.5 | C4:1.5 r:.5 | " +
        "F4:1 F4:1 | A4:.5 A4:1 A4:.5 | G4:.5 G4:.5 E4:.5 C4:.5 | D4:1.5 C4:.25 D4:.25 | E4:.5 G4:.5 G4:.75 A4:.25 | G4:.5 E4:.5 C4:.75 D4:.25 | E4:.5 E4:.5 D4:.5 D4:.5 | C4:2",
      chords: "C C C G7 C C G7 C F F C G7 C C G7 C",
    },
    yankee: {
      beats: 2,
      melody:
        "C4:.5 C4:.5 D4:.5 E4:.5 | C4:.5 E4:.5 D4:.5 G3:.5 | C4:.5 C4:.5 D4:.5 E4:.5 | C4:1 B3:1 | C4:.5 C4:.5 D4:.5 E4:.5 | F4:.5 E4:.5 D4:.5 C4:.5 | B3:.5 G3:.5 A3:.5 B3:.5 | C4:1 C4:1 | " +
        "A3:.75 B3:.25 A3:.5 G3:.5 | A3:.5 B3:.5 C4:1 | G3:.75 A3:.25 G3:.5 F3:.5 | E3:1 G3:1 | A3:.75 B3:.25 A3:.5 G3:.5 | A3:.5 B3:.5 C4:.5 A3:.5 | G3:.5 C4:.5 B3:.5 D4:.5 | C4:1 C4:1",
      chords: "C G7 C G7 C F G7 C F F C C F F G7 C",
    },
    weasel: {
      beats: 2,
      melody:
        "C4:.667 C4:.333 D4:.667 D4:.333 | E4:.333 G4:.333 E4:.333 C4:1 | C4:.667 C4:.333 D4:.667 D4:.333 | E4:1 C4:1 | C4:.667 C4:.333 D4:.667 D4:.333 | E4:.333 G4:.333 E4:.333 C4:1 | A4:1 D4:.667 F4:.333 | E4:1 C4:1",
      chords: "C C G7 C C C F/G7 C",
      swing: true,
    },
    waltz: {
      beats: 3,
      melody:
        "C5:2 A4:1 | F4:2 A4:1 | C5:1 D5:1 C5:1 | A4:3 | A#4:2 G4:1 | E4:2 G4:1 | A#4:1 C5:1 A#4:1 | G4:3 | " +
        "C5:2 A4:1 | F4:2 A4:1 | C5:1 D5:1 E5:1 | F5:3 | D5:2 A#4:1 | C5:2 A4:1 | G4:1 A4:1 G4:1 | F4:3",
      chords: "F F F F C7 C7 C7 C7 F F F F A# F C7 F",
    },
  };
  // Déroulé : air, transposition (demi-tons), octave de la mélodie, tempo (noires par minute), carillon.
  const PROGRAM = [
    { tune: "march", shift: 0, up: 12, bpm: 118, bell: false },
    { tune: "camptown", shift: 0, up: 12, bpm: 118, bell: false },
    { tune: "camptown", shift: 0, up: 12, bpm: 118, bell: true },
    { tune: "susanna", shift: 5, up: 12, bpm: 112, bell: false },
    { tune: "waltz", shift: 0, up: 12, bpm: 168, bell: true },
    { tune: "yankee", shift: 7, up: 24, bpm: 122, bell: false },
    { tune: "weasel", shift: 0, up: 12, bpm: 108, bell: false },
    { tune: "weasel", shift: 5, up: 12, bpm: 108, bell: true },
    { tune: "march", shift: 0, up: 12, bpm: 118, bell: true },
  ];
  const NAMES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function midi(name) {
    const m = /^([A-G])(#|b)?(\d)$/.exec(name);
    return m ? NAMES[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0) + (Number(m[3]) + 1) * 12 : null;
  }
  const parse = (text) =>
    text
      .replace(/\|/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .map((token) => {
        const [n, d] = token.split(":");
        return { note: n === "r" ? null : midi(n), beats: Number(d) };
      });

  /** Tous les événements de la boucle : { t (s), d (s), n (note MIDI), v (voix) }, et sa durée. */
  function score() {
    const events = [];
    let t = 0;
    for (const part of PROGRAM) {
      const tune = TUNES[part.tune];
      const beat = 60 / part.bpm;
      if (tune.pickup) {
        // levée : jouée sur la fin de la mesure précédente
        const notes = parse(tune.pickup);
        let back = notes.reduce((a, n) => a + n.beats, 0) * beat;
        for (const n of notes) {
          if (n.note !== null) events.push({ t: Math.max(0, t - back), d: n.beats * beat * 0.9, n: n.note + part.shift + part.up, v: "lead" });
          back -= n.beats * beat;
        }
      }
      let at = t;
      for (const n of parse(tune.melody)) {
        if (n.note !== null) {
          const pitch = n.note + part.shift + part.up;
          events.push({ t: at, d: n.beats * beat * (n.beats >= 1.5 ? 0.82 : 0.9), n: pitch, v: "lead" });
          if (part.bell) events.push({ t: at, d: 0.5, n: pitch + 12, v: "bell" });
        }
        at += n.beats * beat;
      }
      const chords = tune.chords.split(/\s+/);
      chords.forEach((bar, i) => {
        const start = t + i * tune.beats * beat;
        const names = bar.split("/");
        const chordAt = (k) => {
          const m = /^([A-G]#?)(m|7)?$/.exec(names[Math.min(names.length - 1, k)]);
          const root = midi(m[1] + "2") + part.shift;
          return { root, tones: [0, m[2] === "m" ? 3 : 4, 7].concat(m[2] === "7" ? [10] : []) };
        };
        if (tune.beats === 3) {
          const c = chordAt(0);
          events.push({ t: start, d: beat * 0.9, n: c.root + (i % 2 ? 7 : 0), v: "bass" }, { t: start, d: 0.1, n: 0, v: "kick" });
          for (const b of [1, 2]) {
            for (const tone of c.tones.slice(0, 3)) events.push({ t: start + b * beat, d: beat * 0.45, n: c.root + 24 + tone, v: "chord" });
            events.push({ t: start + b * beat, d: 0.05, n: 0, v: "hat" });
          }
        } else {
          for (let b = 0; b < 2; b++) {
            const c = chordAt(b);
            events.push({ t: start + b * beat, d: beat * 0.55, n: c.root + (b ? 7 : 0), v: "bass" }, { t: start + b * beat, d: 0.1, n: 0, v: "kick" });
            const off = start + (b + (tune.swing ? 0.667 : 0.5)) * beat;
            for (const tone of c.tones) events.push({ t: off, d: beat * 0.3, n: c.root + 24 + tone, v: "chord" });
            events.push({ t: off, d: 0.05, n: 0, v: "snare" });
          }
        }
      });
      events.push({ t, d: 0.4, n: 0, v: "cymbal" });
      t += chords.length * tune.beats * beat;
    }
    events.sort((a, b) => a.t - b.t);
    return { events, length: t };
  }

  /* ------------------------------------------------------------------ orgue de manège */
  const hz = (n) => 440 * Math.pow(2, (n - 69) / 12);
  const music = (MF.music = { on: true, playing: false, volume: 0.42 });
  try {
    music.on = typeof localStorage === "undefined" || localStorage.getItem(STORE) !== "0";
  } catch (e) {}
  let ac = null, out = null, noise = null, vibrato = null, song = null, timer = 0, cursor = 0, origin = 0;

  function voice(e, when) {
    const g = ac.createGain();
    g.connect(out);
    if (e.v === "lead") {
      // flûte à vapeur : carré adouci + octave, petit souffle à l'attaque, vibrato commun
      const lp = ac.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 3600;
      lp.connect(g);
      for (const [type, mult, level] of [["square", 1, 0.5], ["sine", 2, 0.34], ["triangle", 1.003, 0.4]]) {
        const o = ac.createOscillator(), og = ac.createGain();
        o.type = type;
        o.frequency.value = hz(e.n) * mult;
        vibrato.connect(o.detune);
        og.gain.value = level;
        o.connect(og).connect(lp);
        o.start(when);
        o.stop(when + e.d + 0.09);
      }
      const chiff = ac.createBufferSource(), cg = ac.createGain();
      chiff.buffer = noise;
      cg.gain.setValueAtTime(0.16, when);
      cg.gain.exponentialRampToValueAtTime(0.001, when + 0.06);
      chiff.connect(cg).connect(lp);
      chiff.start(when, Math.random() * 0.5, 0.07);
      g.gain.setValueAtTime(0.0001, when);
      g.gain.linearRampToValueAtTime(0.2, when + 0.014);
      g.gain.setValueAtTime(0.2, when + Math.max(0.02, e.d - 0.02));
      g.gain.linearRampToValueAtTime(0.0001, when + e.d + 0.06);
    } else if (e.v === "bass" || e.v === "chord" || e.v === "bell") {
      const o = ac.createOscillator();
      o.type = e.v === "bell" ? "sine" : "triangle";
      o.frequency.value = hz(e.n);
      o.connect(g);
      const level = e.v === "bass" ? 0.3 : e.v === "bell" ? 0.09 : 0.05;
      g.gain.setValueAtTime(0.0001, when);
      g.gain.linearRampToValueAtTime(level, when + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0008, when + e.d + (e.v === "bell" ? 0.3 : 0.05));
      o.start(when);
      o.stop(when + e.d + 0.4);
    } else if (e.v === "kick") {
      const o = ac.createOscillator();
      o.frequency.setValueAtTime(130, when);
      o.frequency.exponentialRampToValueAtTime(48, when + 0.11);
      o.connect(g);
      g.gain.setValueAtTime(0.3, when);
      g.gain.exponentialRampToValueAtTime(0.001, when + 0.14);
      o.start(when);
      o.stop(when + 0.16);
    } else {
      // caisse claire, charleston, cymbale : du bruit filtré
      const src = ac.createBufferSource(), f = ac.createBiquadFilter();
      src.buffer = noise;
      f.type = e.v === "snare" ? "bandpass" : "highpass";
      f.frequency.value = e.v === "snare" ? 1900 : e.v === "hat" ? 7000 : 5200;
      src.connect(f).connect(g);
      const len = e.v === "cymbal" ? 0.5 : e.v === "snare" ? 0.08 : 0.04;
      g.gain.setValueAtTime(e.v === "cymbal" ? 0.1 : e.v === "snare" ? 0.075 : 0.04, when);
      g.gain.exponentialRampToValueAtTime(0.001, when + len);
      src.start(when, Math.random() * 0.4, len + 0.02);
    }
  }
  function pump() {
    if (!music.playing || !ac) return;
    const horizon = ac.currentTime + 0.35;
    for (let guard = 0; guard < 400; guard++) {
      const e = song.events[cursor];
      const when = origin + e.t;
      if (when > horizon) break;
      if (when > ac.currentTime - 0.05) voice(e, Math.max(when, ac.currentTime + 0.005));
      if (++cursor >= song.events.length) {
        cursor = 0;
        origin += song.length;
      }
    }
  }
  function ensure() {
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return false;
    if (!ac) {
      try {
        ac = new AC();
      } catch (e) {
        return false;
      }
      const comp = ac.createDynamicsCompressor();
      out = ac.createGain();
      out.gain.value = 0;
      out.connect(comp).connect(ac.destination);
      const len = ac.sampleRate;
      noise = ac.createBuffer(1, len, ac.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      const lfo = ac.createOscillator();
      vibrato = ac.createGain();
      lfo.frequency.value = 5.6;
      vibrato.gain.value = 7; // centièmes de demi-ton
      lfo.connect(vibrato);
      lfo.start();
      song = score();
    }
    if (ac.state === "suspended") ac.resume().catch(() => {});
    return true;
  }
  /** Lance la musique si elle n'est pas coupée (à appeler après un geste du visiteur). */
  music.start = function () {
    if (!music.on || music.ducked || music.playing || (typeof document !== "undefined" && document.hidden)) return;
    if (!ensure()) return;
    music.playing = true;
    cursor = 0;
    origin = ac.currentTime + 0.12;
    out.gain.cancelScheduledValues(ac.currentTime);
    out.gain.setValueAtTime(0, ac.currentTime);
    out.gain.linearRampToValueAtTime(music.volume, ac.currentTime + 1.2);
    clearInterval(timer);
    timer = setInterval(pump, 90);
    pump();
  };
  music.stop = function () {
    if (!music.playing) return;
    music.playing = false;
    clearInterval(timer);
    if (ac && out) {
      out.gain.cancelScheduledValues(ac.currentTime);
      out.gain.setTargetAtTime(0, ac.currentTime, 0.08);
    }
  };
  music.setOn = function (on) {
    music.on = !!on;
    try {
      localStorage.setItem(STORE, music.on ? "1" : "0");
    } catch (e) {}
    if (music.on) music.start();
    else music.stop();
  };
  /** Une ambiance de travail joue à sa place (voir 09-ambience.js) : l'orgue se tait, puis reprend. */
  music.duck = function (on) {
    music.ducked = !!on;
    if (music.ducked) music.stop();
    else if (music.wanted) music.start();
  };
  /** Pour les essais : la partition jouée (événements et durée de la boucle). */
  music.score = score;
  if (typeof document !== "undefined") {
    // onglet caché : on se tait (les minuteries y sont ralenties) ; on reprend au retour
    document.addEventListener("visibilitychange", () => (document.hidden ? music.stop() : music.wanted && music.start()));
    const first = () => {
      music.wanted = true;
      music.start();
    };
    for (const type of ["pointerdown", "keydown", "touchend"]) addEventListener(type, first, { once: true, capture: true });
  }
})();
