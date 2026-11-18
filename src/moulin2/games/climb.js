// La Fête du Moulin — Hockey Stick (la course au mât : « up and to the right »).
//
// Soixante-quinze mètres de mât à grimper pour sonner la cloche : il domine tous les arbres du
// domaine. Une frappe à gauche, une frappe à droite, en alternance (← →, ou clic à gauche puis à
// droite) : chaque prise fait monter, et un rythme régulier allonge les prises (jusqu'à × 3,4).
// Plus on monte, plus c'est dur :
//   – deux fois le même côté et l'on glisse, de plus en plus bas ;
//   – des rafales de vent, annoncées, pendant lesquelles il faut s'immobiliser (toute prise lâche) ;
//   – trois bandes graissées où les prises sont courtes et où l'on redescend dès qu'on s'arrête.
// Le temps mis pour sonner la cloche est le score ; chaque joueur voit le fanion des autres monter.
(function () {
  "use strict";
  const MF = globalThis.MoulinFete;
  const H = 75, STEP = 0.26, ZP = -0.7;
  const MARKS = [[6, "$1K MRR"], [14, "RAMEN PROFITABLE"], [25, "$10K MRR"], [37, "QUIT YOUR JOB"], [49, "$100K MRR"], [60, "$1M ARR"], [70, "UNICORN TERRITORY"]];
  const GREASE = [[18, 22], [41, 46], [63, 67]];

  MF.booth({
    id: "climb",
    title: "Hockey Stick",
    icon: "📈",
    color: "#2e9e5b",
    blurb: "Climb 75 m to ring the bell · rhythm, wind gusts, greasy bands",
    help: "Alternate ← and → (or click the left, then the right side of the screen) to climb: a steady rhythm makes every grip longer. The same side twice and you slip. Freeze when a wind gust is announced (any grip then lets go), and keep moving on the three greasy bands or you slide back down. Ring the bell at the top: your time is your score.",
    hint: "Alternate ← and → in rhythm · freeze during gusts · never stop on grease",
    touchHint: "Tap left, then right, in rhythm · freeze during gusts",
    at: { x: 30.2, z: 35.2, face: -Math.PI / 2 },
    stall: false,
    size: { w: 3, d: 2.0 },
    hall: [3.2, 3.0],
    range: 220,
    duration: 150,
    cam: { y: 1.8, z: 4.6, look: [0, 1.8, ZP], fov: 56 },
    cross: false,
    button: "CLIMB",
    scoreLabel: "Height",
    stats: [{ key: "rhythm", label: "Grip" }],
    scoreText: (b) => ((b.score / 100) * H).toFixed(1) + " m",
    liveText: (v) => (v >= 100 ? "DING!" : ((v / 100) * H).toFixed(0) + " m"),
    rank: (list) => list.slice().sort((a, b) => (a.time ? 0 : 1) - (b.time ? 0 : 1) || (a.time || 0) - (b.time || 0) || (b.height || 0) - (a.height || 0)),
    describe: (r) => (r.time ? "bell rung in " + MF.time(r.time) : "reached " + (r.height || 0).toFixed(1) + " m"),
    board: { label: "Fastest to the bell (75 m)", better: "low", value: (r) => r.time, format: (v) => MF.time(v) },
    setup(b) {
      const d = b.decor;
      // le mât (il s'affine vers le haut), ses repères, ses bandes graissées, la cloche et la flèche
      MF.cyl(0.14, 0.34, H + 1.2, "#8a5a33", { y: (H + 1.2) / 2, z: ZP, parent: d, seg: 12, cast: true });
      MF.cyl(0.9, 1.05, 0.3, "#6b4a2e", { y: 0.15, z: ZP, parent: d, seg: 14 });
      for (const [y, text] of MARKS) {
        const s = MF.sign(text, { w: Math.max(1.0, text.length * 0.11), h: 0.26, px: 128, bg: "#2e9e5b", color: "#ffffff", border: "#ffffff" });
        s.position.set(0.95, y, ZP + 0.05);
        d.add(s);
        MF.box(0.6, 0.04, 0.04, "#ffffff", { x: 0.35, y, z: ZP + 0.02, parent: d });
      }
      for (const [y0, y1] of GREASE) {
        MF.cyl(0.3, 0.32, y1 - y0, "#2d2a26", { y: (y0 + y1) / 2, z: ZP, parent: d, seg: 12 });
        const s = MF.sign("GREASE", { w: 0.8, h: 0.22, px: 96, bg: "#2d2a26", color: "#ffd54a", border: "#ffd54a" });
        s.position.set(-0.75, y0 + 0.3, ZP + 0.05);
        d.add(s);
      }
      MF.sphere(0.34, "#f2c230", { y: H + 0.8, z: ZP + 0.3, parent: d, seg: 14 }).scale.set(1, 0.85, 1);
      MF.box(0.06, 0.06, 0.55, "#6b4a2e", { y: H + 1.1, z: ZP + 0.1, parent: d });
      const arrow = MF.group({ x: 0.3, y: H + 2.4, z: ZP, rz: 0.6, parent: d });
      MF.box(2.6, 0.2, 0.08, "#2e9e5b", { parent: arrow });
      MF.cone(0.34, 0.7, "#2e9e5b", { x: 1.6, rz: -Math.PI / 2, parent: arrow, seg: 4 });
      // manche à air : elle se tend pendant les rafales
      const sock = MF.cone(0.16, 0.9, MF.PAL.orange, { x: -0.6, z: ZP, rz: Math.PI / 2, parent: b.live, seg: 8 });
      // le grimpeur et les fanions des autres joueurs
      const jack = MF.Presence.buildAvatar(b.ctx.self.color, null, null);
      jack.tag.visible = false;
      if (jack.shadow) jack.shadow.visible = false; // pas d'ombre ronde en plein ciel
      jack.body.rotation.y = Math.PI;
      b.live.add(jack.group);
      const flags = [];
      for (let i = 0; i < 6; i++) {
        const m = MF.box(0.34, 0.2, 0.02, MF.mat("#ffffff", { unique: true }), { x: -0.36, z: ZP, parent: b.live });
        m.visible = false;
        flags.push(m);
      }
      let h = 0, last = "", slip = 0, done = 0, reach = 0, combo = 0, lastTap = -9, gustAt = 0, gust = 0, warned = false;
      const greasy = () => GREASE.some(([y0, y1]) => h >= y0 && h < y1);
      const grip = () => 1 + Math.min(2.4, combo * 0.07);
      /** Prochaine rafale : de plus en plus rapprochées à mesure qu'on monte. */
      const nextGust = (t) => t + (9 - (h / H) * 4.5) * (0.75 + b.rand() * 0.5);
      function fall(by, text) {
        h = Math.max(0, h - by);
        slip = 0.45;
        combo = 0;
        b.hud.flash(text, { color: MF.PAL.red, hold: 0.7 });
        MF.sfx.play("perdu");
      }
      return {
        reset() {
          h = slip = done = combo = gust = 0;
          last = "";
          lastTap = -9;
          gustAt = 7;
          warned = false;
        },
        view(_, from, to) {
          from.y += h * 0.92;
          to.y += h;
        },
        update() {
          const t = b.t;
          slip = Math.max(0, slip - b.dt);
          if (b.playing && !done) {
            // le vent : annoncé 0,8 s avant, il souffle 0,9 s ; toute prise pendant la rafale lâche
            if (!warned && t >= gustAt - 0.8) {
              warned = true;
              b.hud.flash("GUST COMING: FREEZE!", { color: "#7fd8ff", hold: 0.8 });
              MF.sfx.play("swing");
            }
            if (warned && gust <= 0 && t >= gustAt) gust = 0.9;
            if (gust > 0) {
              gust -= b.dt;
              if (gust <= 0) {
                gustAt = nextGust(t);
                warned = false;
              }
            }
            const grease = greasy();
            if (b.tap && slip <= 0) {
              if (gust > 0) fall(2 + h / 18, "Blown off your grip!");
              else if (b.tap !== last) {
                // un rythme régulier (moins de 0,4 s entre deux prises) allonge les prises
                combo = t - lastTap < 0.4 && !grease ? combo + 1 : grease ? Math.max(0, combo - 1) : 0;
                h = Math.min(H, h + STEP * grip() * (grease ? 0.5 : 1));
                MF.sfx.play("clic");
                if (h >= H) {
                  done = Math.round(t * 100) / 100;
                  b.score = 100;
                  b.hud.flash("DING! " + MF.time(done), { color: MF.PAL.yellow, hold: 1.6 });
                  MF.sfx.play("ting");
                  MF.sfx.play("bravo");
                  b.confetti(0, H + 0.8, ZP + 0.5, 24);
                  b.finish();
                }
              } else fall(1.2 + h / 20, "Slipped! Alternate hands"); // deux fois la même main
              last = b.tap;
              lastTap = t;
            } else if (grease && t - lastTap > 0.5 && slip <= 0) {
              // sur la graisse, on redescend dès qu'on s'arrête
              h = Math.max(0, h - 2.6 * b.dt);
              combo = 0;
            } else if (t - lastTap > 0.9) combo = 0;
          }
          if (!done) b.score = Math.min(99, Math.floor((h / H) * 100));
          reach = MF.damp(reach, h, 14, b.dt);
          jack.group.position.set(0, reach + 0.05, ZP + 0.42);
          jack.body.rotation.z = gust > 0 ? Math.sin(b.time * 16) * 0.2 : 0;
          sock.position.y = reach + 4.5;
          sock.rotation.y = gust > 0 ? Math.sin(b.time * 20) * 0.3 : 0;
          sock.scale.set(1, gust > 0 ? 1 : 0.35, 1);
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
        hud() {
          b.hud.set("rhythm", "× " + grip().toFixed(1) + (greasy() ? " · grease" : ""));
        },
        result: () => (done ? { time: done } : { dnf: true, height: Math.round(h * 10) / 10 }),
      };
    },
  });
})();
