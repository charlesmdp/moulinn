// La Fête du Moulin — Rubber Duck Debugging Derby (la course de canards en plastique, sur la rivière).
//
// Soixante mètres de rivière à descendre, du pré de l'est jusqu'à l'étang intermédiaire. Le courant
// porte le canard ; on change de couloir (← →, ou clic à gauche ou à droite) pour éviter les « bugs »
// (des scarabées rouges : une seconde de débogage à chaque choc) et attraper les anneaux verts
// (« tests au vert » : un coup d'accélérateur). Maintenir Espace (ou le clic) fait pagayer, tant
// qu'il reste du souffle. Le temps à l'arrivée est le score.
(function () {
  "use strict";
  const MF = globalThis.MoulinFete;
  const RIVER = [[153, -15.4], [146.34, -15.24], [135.03, -15.6], [127.65, -17.72], [121.24, -21.21], [113.48, -25.32], [108.42, -27.84], [103.09, -28.37], [95, -27.85]];
  const A = { x: 153.5, z: -13.2 };
  const LANE = 0.55, DRIFT = 1.9, PADDLE = 1.5, BOOST = 2.4;

  MF.booth({
    id: "derby",
    title: "Rubber Duck Derby",
    icon: "🦆",
    color: "#f1c40f",
    blurb: "Rubber duck debugging: 60 m down the river, dodge the bugs",
    help: "The current carries your duck. Tap ← or → (or click the left or right side) to change lanes: dodge the red bugs (one second of debugging each) and grab the green rings (tests passing: a burst of speed). Hold Space (or the click) to paddle while you have breath. Your time at the finish is your score.",
    hint: "← / → change lanes · hold Space to paddle · dodge the bugs",
    touchHint: "Tap left or right to change lanes · hold to paddle",
    at: { x: A.x, z: A.z, face: 0 },
    stall: false,
    size: { w: 3, d: 1.0 },
    hall: [3.2, 1.6],
    duration: 75,
    cam: { y: 2.2, z: 1.6, look: [0, 0.2, -3], fov: 58 },
    cross: false,
    button: "PADDLE",
    scoreLabel: "River",
    scoreText: (b) => b.score + " %",
    liveText: (v) => (v >= 100 ? "FINISHED" : v + " %"),
    rank: (list) => list.slice().sort((a, b) => (a.time ? 0 : 1) - (b.time ? 0 : 1) || (a.time || 0) - (b.time || 0) || (b.done || 0) - (a.done || 0)),
    describe: (r) => (r.time ? MF.time(r.time) : "debugging still (" + (r.done || 0) + " % of the river)"),
    board: { label: "Fastest duck", better: "low", value: (r) => r.time, format: (v) => MF.time(v) },
    setup(b) {
      const d = b.decor, world = b.world, Y0 = b.root.position.y;
      const path = MF.path(RIVER, { closed: false, step: 0.5 }), L = path.length;
      // dans le repère du jeu (cap 0 : le repère est celui du monde, décalé) ; l'eau : le lit plus 30 cm
      const X = (x) => x - A.x, Z = (z) => z - A.z;
      // la surface de la rivière affleure le relief en son milieu (relevé sur la page du moulin : à 3 cm près)
      const water = (x, z) => world.heightAt(x, z) + 0.04 - Y0;
      const spot = (s, lane, out) => {
        const p = path.at(MF.clamp(s, 0, L));
        const x = p.x - p.tz * lane * LANE, z = p.z + p.tx * lane * LANE;
        out.set(X(x), water(p.x, p.z), Z(z));
        return p;
      };
      const v3 = new b.THREE.Vector3(), v4 = new b.THREE.Vector3();
      // départ et arrivée : une banderole en travers de la rivière
      const gate = (s, text, color) => {
        const p = spot(s, 0, v3), g = MF.group({ x: v3.x, y: v3.y, z: v3.z, ry: Math.atan2(p.tx, p.tz), parent: d });
        for (const sx of [-1, 1]) MF.cyl(0.05, 0.05, 2.4, MF.PAL.white, { x: sx * 1.9, y: 1.2, parent: g, seg: 6 });
        const sign = MF.sign(text, { w: 3.6, h: 0.5, bg: color, color: "#ffffff", border: "#ffffff", double: true });
        sign.position.y = 2.3;
        g.add(sign);
      };
      gate(0.6, "RUBBER DUCK DEBUGGING DERBY", "#f1c40f");
      gate(L - 0.6, "SHIPPED!", "#27ae60");
      // bugs et anneaux : tirés une fois pour toutes (le décor est le même pour tous), un rang tous les 4 m
      const rnd = MF.rng(4242), items = [];
      for (let s = 7; s < L - 4; s += 4) {
        const r = rnd(), lane = Math.floor(rnd() * 3) - 1;
        if (r < 0.62) {
          items.push({ s, lane, bug: true });
          if (rnd() < 0.3) items.push({ s, lane: lane === 0 ? (rnd() < 0.5 ? -1 : 1) : 0, bug: true });
        } else if (r < 0.9) items.push({ s, lane, bug: false });
      }
      for (const it of items) {
        spot(it.s, it.lane, v3);
        const g = MF.group({ x: v3.x, y: v3.y, z: v3.z, parent: b.live });
        if (it.bug) {
          MF.sphere(0.2, "#d63031", { parent: g, seg: 9 }).scale.set(1, 0.6, 1.2);
          MF.sphere(0.09, MF.PAL.black, { y: 0.03, z: -0.2, parent: g, seg: 6 });
          for (const [x, z] of [[-0.08, 0.02], [0.08, 0.02], [-0.07, 0.14], [0.07, 0.14]]) MF.sphere(0.035, MF.PAL.black, { x, y: 0.11, z, parent: g, seg: 5 });
          MF.freeze(g);
        } else MF.torus(0.3, 0.035, MF.mat("#2ecc71", { emissive: "#2ecc71", emissiveIntensity: 0.6 }), { y: 0.3, ry: Math.atan2(path.at(it.s).tx, path.at(it.s).tz), parent: g, seg: 16, tubeSeg: 5 });
        it.g = g;
      }
      const duck = (color) => {
        const g = MF.group({ parent: b.live });
        const m = MF.mat(color, { unique: true });
        MF.sphere(0.2, m, { y: 0.1, parent: g, seg: 10 }).scale.set(1, 0.8, 1.25);
        MF.sphere(0.13, m, { y: 0.3, z: 0.13, parent: g, seg: 9 });
        MF.cone(0.05, 0.12, MF.PAL.orange, { y: 0.28, z: 0.28, rx: Math.PI / 2, parent: g, seg: 6 });
        for (const sx of [-1, 1]) MF.sphere(0.022, MF.PAL.black, { x: sx * 0.06, y: 0.34, z: 0.22, parent: g, seg: 5 });
        return { g, m };
      };
      const me = duck("#ffd23e"), others = [];
      for (let i = 0; i < 6; i++) {
        const o = duck("#ffffff");
        o.g.visible = false;
        others.push(o);
      }
      let s = 0, lane = 0, pos = 0, stun = 0, boost = 0, breath = 1, done = 0;
      return {
        reset() {
          s = 1.2;
          lane = pos = stun = boost = done = 0;
          breath = 1;
          for (const it of items) {
            it.hit = false;
            it.g.visible = true;
          }
        },
        view(_, from, to) {
          // caméra derrière le canard, tournée vers l'aval
          const p = spot(s, pos, v3);
          from.set(v3.x - p.tx * 3.0, v3.y + 1.9, v3.z - p.tz * 3.0);
          to.set(v3.x + p.tx * 3.5, v3.y + 0.2, v3.z + p.tz * 3.5);
        },
        update() {
          const dt = b.dt;
          stun = Math.max(0, stun - dt);
          boost = Math.max(0, boost - dt);
          if (b.playing && !done) {
            if (b.tap) {
              lane = MF.clamp(lane + (b.tap === "L" ? -1 : 1), -1, 1);
              MF.sfx.play("clic");
            }
            const paddling = (b.input.state.a || (b.hold && !b.tap && b.input.touch)) && breath > 0.02 && stun <= 0;
            breath = MF.clamp(breath + (paddling ? -0.42 : 0.28) * dt, 0, 1);
            const speed = stun > 0 ? 0.25 : DRIFT + (paddling ? PADDLE : 0) + (boost > 0 ? BOOST : 0);
            s += speed * dt;
            for (const it of items) {
              if (it.hit || Math.abs(it.s - s) > 0.45 || Math.abs(it.lane - pos) > 0.55) continue;
              it.hit = true;
              it.g.visible = false;
              if (it.bug) {
                stun = 1;
                b.hud.flash("Bug! Debugging…", { color: MF.PAL.red, hold: 0.7 });
                MF.sfx.play("choc");
              } else {
                boost = 1.4;
                b.hud.flash("Tests passing ✓", { color: "#2ecc71", hold: 0.6 });
                MF.sfx.play("ting");
              }
            }
            b.score = Math.min(99, Math.floor((s / L) * 100));
            if (s >= L - 0.6) {
              done = Math.round(b.t * 100) / 100;
              b.score = 100;
              b.hud.flash("Shipped! " + MF.time(done), { color: MF.PAL.yellow, hold: 1.6 });
              MF.sfx.play("bravo");
              spot(L - 0.6, 0, v4);
              b.confetti(v4.x, v4.y + 1, v4.z, 24);
              b.finish();
            }
          }
          pos = MF.damp(pos, lane, 9, dt);
          const p = spot(s, pos, v3);
          me.g.position.copy(v3);
          me.g.position.y += Math.sin(b.time * 5) * 0.02;
          me.g.rotation.set(stun > 0 ? Math.sin(b.time * 30) * 0.2 : 0, Math.atan2(p.tx, p.tz) + (lane - pos) * 0.5, 0);
          me.m.color.copy(MF.color(stun > 0 ? "#ff9d2e" : "#ffd23e"));
          if (b.t >= 0 && !done) b.hud.gauge(breath, "Breath");
          else b.hud.gauge(null);
          // les canards des autres : à leur avancée, un couloir chacun
          const list = b.others().filter((o) => !o.self);
          others.forEach((o, i) => {
            const r = list[i];
            o.g.visible = !!r;
            if (!r) return;
            const q = spot((Math.min(100, r.score) / 100) * L, (i % 3) - 1, v4);
            o.g.position.copy(v4);
            o.g.rotation.y = Math.atan2(q.tx, q.tz);
            o.m.color.copy(MF.color(r.color));
          });
        },
        result: () => (done ? { time: done } : { dnf: true, done: b.score }),
        leave() {
          b.hud.gauge(null);
        },
      };
    },
  });
})();
