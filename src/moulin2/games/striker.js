// La Fête du Moulin — High Striker (le jeu de force : « faites sonner la cloche »).
//
// Trois coups de maillet. L'aiguille de la jauge court de plus en plus vite : on frappe (clic,
// doigt ou Espace) quand elle est au plus haut. Le palet monte le long de la tour selon la force ;
// tout en haut, la cloche sonne (+50). Le score est la somme des trois coups.
(function () {
  "use strict";
  const MF = globalThis.MoulinFete;
  const H = 5.2, BASE = 0.5, SWINGS = 3, RATES = [1.5, 2.1, 2.8];
  const RANKS = ["Feather", "Rookie", "Lumberjack", "Strongman", "HERCULES!"];

  MF.booth({
    id: "striker",
    title: "High Striker",
    icon: "🔔",
    color: MF.PAL.red,
    blurb: "3 swings · ring the bell",
    help: "Three swings of the mallet. Click (or tap, or Space) when the power needle is at the top: the puck shoots up the tower. Ring the bell for +50.",
    hint: "Click when the power needle is at the top",
    touchHint: "Tap when the power needle is at the top",
    at: { x: 10.6, z: -73.4, face: -Math.PI / 2 },
    stall: false,
    size: { w: 3, d: 4.8 },
    maxTime: 75,
    cam: { y: 1.7, z: 4.1, look: [0, 2.95, -0.9], fov: 62 },
    cross: false,
    button: "STRIKE",
    stats: [{ key: "swing", label: "Swing" }],
    setup(b) {
      const d = b.decor, Z = -0.9;
      // estrade, tour graduée, cloche
      MF.box(2.6, 0.24, 3.0, MF.PAL.wood, { y: 0.12, z: -0.1, parent: d, cast: true });
      MF.box(0.9, H + 0.9, 0.16, MF.PAL.white, { y: BASE + (H + 0.9) / 2 - 0.3, z: Z - 0.1, parent: d, cast: true });
      const bands = [MF.PAL.blue, MF.PAL.teal, MF.PAL.green, MF.PAL.yellow, MF.PAL.orange, MF.PAL.red];
      bands.forEach((c, i) => MF.box(0.62, H / bands.length - 0.04, 0.03, c, { y: BASE + (i + 0.5) * (H / bands.length), z: Z - 0.01, parent: d }));
      for (const sx of [-1, 1]) MF.box(0.05, H + 0.2, 0.08, MF.PAL.steel, { x: sx * 0.12, y: BASE + H / 2, z: Z + 0.04, parent: d }); // rails du palet
      for (let i = 0; i <= 10; i++) MF.box(0.2, 0.03, 0.04, MF.PAL.ink, { x: 0.36, y: BASE + (i / 10) * H, z: Z + 0.02, parent: d });
      MF.sphere(0.34, "#f2c230", { y: BASE + H + 0.42, z: Z + 0.02, parent: d, seg: 16, cast: true }).scale.set(1, 0.8, 1);
      MF.cyl(0.38, 0.38, 0.05, "#d9a514", { y: BASE + H + 0.2, z: Z + 0.02, parent: d, seg: 16 });
      const top = MF.sign("RING THE BELL", { w: 2.2, h: 0.5, bg: MF.PAL.red, color: "#ffffff", border: MF.PAL.yellow, double: true });
      top.position.set(0, BASE + H + 1.15, Z);
      d.add(top);
      for (const sx of [-1, 1]) {
        const f = MF.props.flag(sx < 0 ? MF.PAL.yellow : MF.PAL.blue, 3.2);
        f.position.set(sx * 1.15, 0.24, Z - 0.2);
        d.add(f);
        MF.sphere(0.09, "#ffd54a", { x: sx * 0.52, y: BASE + H + 0.75, z: Z, parent: d, seg: 8 });
      }
      // la bascule et son tampon
      MF.box(0.5, 0.1, 1.5, MF.PAL.woodDark, { y: 0.34, z: 0.05, parent: d });
      MF.cyl(0.3, 0.34, 0.16, MF.PAL.red, { y: 0.44, z: 0.6, parent: d, seg: 14 });
      // le palet et le maillet
      const puck = MF.box(0.34, 0.16, 0.12, MF.PAL.red, { y: BASE, z: Z + 0.08, parent: b.live });
      const mallet = MF.group({ x: 0.75, y: 0.5, z: 0.75, parent: b.live });
      MF.cyl(0.035, 0.035, 1.5, MF.PAL.wood, { y: 0.75, parent: mallet, seg: 6 });
      MF.cyl(0.2, 0.2, 0.5, "#3b3b46", { y: 1.5, rx: Math.PI / 2, parent: mallet, seg: 12 });
      mallet.rotation.set(0, 0, 0.5);
      let swing = 0, state = "aim", at = 0, power = 0, bell = false, level = 0;
      return {
        reset() {
          swing = 0;
          state = "aim";
          level = 0;
          puck.position.y = BASE;
        },
        update() {
          const t = b.time;
          if (!b.playing && state === "aim") {
            b.hud.gauge(null);
            mallet.rotation.z = 0.5;
            return;
          }
          if (state === "aim") {
            const u = (t * RATES[swing]) % 2;
            power = u < 1 ? u : 2 - u;
            b.hud.gauge(power, "Power");
            mallet.rotation.z = 0.5 + power * 0.25;
            if (b.press) {
              state = "swing";
              at = t;
              b.hud.gauge(null);
              MF.sfx.play("swing");
            }
          } else if (state === "swing") {
            const u = (t - at) / 0.22;
            mallet.rotation.z = MF.lerp(0.75, -1.25, Math.min(1, u * u)); // le maillet s'abat vers le tampon
            if (u >= 1) {
              state = "rise";
              at = t;
              bell = power >= 0.955;
              MF.sfx.play("choc");
            }
          } else if (state === "rise") {
            const u = Math.min(1, (t - at) / (0.35 + power * 0.5)), e = 1 - (1 - u) * (1 - u);
            level = e * (bell ? 1 : power);
            puck.position.y = BASE + level * H;
            if (u >= 1) {
              state = "fall";
              at = t;
              const pts = Math.round(Math.pow(power, 1.3) * 100) + (bell ? 50 : 0);
              const rank = RANKS[Math.min(RANKS.length - 1, Math.floor(power * RANKS.length))];
              b.add(pts, false);
              b.hud.flash((bell ? "DING! " : "") + rank + " +" + pts, { color: bell ? MF.PAL.yellow : "#ffffff", hold: 1.1 });
              MF.sfx.play(bell ? "bravo" : power > 0.5 ? "ting" : "toc");
              if (bell) b.confetti(0, BASE + H + 0.4, Z + 0.3, 22);
            }
          } else if (state === "fall") {
            const u = (t - at) / 0.9;
            puck.position.y = BASE + level * H * Math.max(0, 1 - Math.max(0, u - 0.35) * 2.2);
            mallet.rotation.z = MF.lerp(-1.25, 0.5, Math.min(1, u * 1.6));
            if (u >= 1) {
              swing++;
              state = "aim";
              if (swing >= SWINGS) {
                swing = SWINGS - 1;
                state = "done";
                b.finish();
              }
            }
          }
        },
        hud() {
          b.hud.set("swing", Math.min(SWINGS, swing + 1) + " / " + SWINGS);
        },
        leave() {
          b.hud.gauge(null);
        },
      };
    },
  });
})();
