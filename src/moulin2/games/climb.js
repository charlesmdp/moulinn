// La Fête du Moulin — Hockey Stick (la course au mât : « up and to the right »).
//
// Douze mètres de mât à grimper pour sonner la cloche. Une frappe à gauche, une frappe à droite, en
// alternance (← →, ou clic à gauche puis à droite) : chaque prise fait monter. Deux fois le même
// côté et l'on glisse. Le temps mis pour sonner la cloche est le score ; chaque joueur voit le
// fanion des autres monter le long du mât.
(function () {
  "use strict";
  const MF = globalThis.MoulinFete;
  const H = 12, STEP = 0.26, ZP = -0.7;
  const MARKS = [[2.4, "$1K MRR"], [5, "RAMEN PROFITABLE"], [7.6, "$10K MRR"], [10.2, "$100K MRR"]];

  MF.booth({
    id: "climb",
    title: "Hockey Stick",
    icon: "📈",
    color: "#2e9e5b",
    blurb: "Climb 12 m to ring the bell · up and to the right",
    help: "Alternate ← and → (or click the left, then the right side of the screen) to climb. The same side twice and you slip. Ring the bell at the top: your time is your score.",
    hint: "Alternate ← and → to climb · same side twice: you slip",
    touchHint: "Tap left, then right, to climb · same side twice: you slip",
    at: { x: 30.2, z: 35.2, face: -Math.PI / 2 },
    stall: false,
    size: { w: 3, d: 2.0 },
    hall: [3.2, 3.0],
    duration: 60,
    cam: { y: 1.8, z: 4.6, look: [0, 1.8, ZP], fov: 56 },
    cross: false,
    button: "CLIMB",
    scoreLabel: "Height",
    scoreText: (b) => ((b.score / 100) * H).toFixed(1) + " m",
    liveText: (v) => (v >= 100 ? "DING!" : ((v / 100) * H).toFixed(1) + " m"),
    rank: (list) => list.slice().sort((a, b) => (a.time ? 0 : 1) - (b.time ? 0 : 1) || (a.time || 0) - (b.time || 0) || (b.height || 0) - (a.height || 0)),
    describe: (r) => (r.time ? "bell rung in " + MF.time(r.time) : "reached " + (r.height || 0).toFixed(1) + " m"),
    board: { label: "Fastest to the bell", better: "low", value: (r) => r.time, format: (v) => MF.time(v) },
    setup(b) {
      const d = b.decor;
      // le mât, ses repères, la cloche et la flèche « up and to the right »
      MF.cyl(0.16, 0.2, H + 1.2, "#8a5a33", { y: (H + 1.2) / 2, z: ZP, parent: d, seg: 12, cast: true });
      MF.cyl(0.7, 0.8, 0.25, "#6b4a2e", { y: 0.12, z: ZP, parent: d, seg: 14 });
      for (const [y, text] of MARKS) {
        const s = MF.sign(text, { w: Math.max(1.0, text.length * 0.11), h: 0.26, bg: "#2e9e5b", color: "#ffffff", border: "#ffffff" });
        s.position.set(0.85, y, ZP + 0.05);
        d.add(s);
        MF.box(0.5, 0.04, 0.04, "#ffffff", { x: 0.3, y, z: ZP + 0.02, parent: d });
      }
      MF.sphere(0.3, "#f2c230", { y: H + 0.75, z: ZP + 0.25, parent: d, seg: 14 }).scale.set(1, 0.85, 1);
      MF.box(0.06, 0.06, 0.5, "#6b4a2e", { y: H + 1.05, z: ZP + 0.1, parent: d });
      const arrow = MF.group({ x: 0.2, y: H + 1.9, z: ZP, rz: 0.6, parent: d });
      MF.box(1.5, 0.12, 0.06, "#2e9e5b", { parent: arrow });
      MF.cone(0.2, 0.42, "#2e9e5b", { x: 0.9, rz: -Math.PI / 2, parent: arrow, seg: 4 });
      // le grimpeur et les fanions des autres joueurs
      const jack = MF.Presence.buildAvatar(b.ctx.self.color, null, null);
      jack.tag.visible = false;
      jack.body.rotation.y = Math.PI;
      b.live.add(jack.group);
      const flags = [];
      for (let i = 0; i < 6; i++) {
        const m = MF.box(0.34, 0.2, 0.02, MF.mat("#ffffff", { unique: true }), { x: -0.36, z: ZP, parent: b.live });
        m.visible = false;
        flags.push(m);
      }
      let h = 0, last = "", slip = 0, done = 0, reach = 0;
      return {
        reset() {
          h = slip = done = 0;
          last = "";
        },
        view(_, from, to) {
          from.y += h * 0.92;
          to.y += h;
        },
        update() {
          slip = Math.max(0, slip - b.dt);
          if (b.playing && b.tap && !done && slip <= 0) {
            if (b.tap !== last) {
              h = Math.min(H, h + STEP);
              MF.sfx.play("clic");
              if (h >= H) {
                done = Math.round(b.t * 100) / 100;
                b.score = 100;
                b.hud.flash("DING! " + MF.time(done), { color: MF.PAL.yellow, hold: 1.6 });
                MF.sfx.play("ting");
                MF.sfx.play("bravo");
                b.confetti(0, H + 0.8, ZP + 0.5, 24);
                b.finish();
              }
            } else {
              // deux fois la même main : on glisse d'un bon mètre
              h = Math.max(0, h - 1.2);
              slip = 0.45;
              b.hud.flash("Slipped! Alternate hands", { color: MF.PAL.red, hold: 0.6 });
              MF.sfx.play("perdu");
            }
            last = b.tap;
          }
          if (!done) b.score = Math.min(99, Math.floor((h / H) * 100));
          reach = MF.damp(reach, h, 14, b.dt);
          jack.group.position.set(0, reach + 0.05, ZP + 0.36);
          const a = last === "L" ? 1 : -1;
          jack.arms[0].rotation.x = -2.6 + a * 0.5;
          jack.arms[1].rotation.x = -2.6 - a * 0.5;
          jack.legs[0].rotation.x = -0.5 - a * 0.35;
          jack.legs[1].rotation.x = -0.5 + a * 0.35;
          const others = b.others().filter((o) => !o.self);
          flags.forEach((m, i) => {
            const o = others[i];
            m.visible = !!o;
            if (!o) return;
            m.material.color.copy(MF.color(o.color));
            m.position.y = 0.4 + (Math.min(100, o.score) / 100) * H;
          });
        },
        result: () => (done ? { time: done } : { dnf: true, height: Math.round(h * 10) / 10 }),
      };
    },
  });
})();
