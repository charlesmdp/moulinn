// La Fête du Moulin — Default Alive (l'équilibre sur un rondin qui tourne, sur l'étang intermédiaire).
//
// Le rondin roule de plus en plus fort, d'un côté puis de l'autre : on court à contresens (← →, ou
// maintenir le clic à gauche ou à droite) pour rester dessus. Tomber à l'eau, c'est fini. Le score
// est le temps tenu, en secondes. Les à-coups sont tirés de la graine de la partie : en multijoueur,
// le dernier debout a gagné.
(function () {
  "use strict";
  const MF = globalThis.MoulinFete;
  const ZL = -6.5, LOG_R = 0.42, LIMIT = 1, MAX = 120;

  MF.booth({
    id: "logroll",
    title: "Default Alive",
    icon: "🪵",
    color: "#16a085",
    blurb: "Stay on the rolling log · your runway is your score",
    help: "The log spins harder and harder, one way then the other. Hold ← or → (or hold the click on the left or right side) to run against it and stay centred. Fall in and it's over. Seconds survived are your score.",
    hint: "Hold ← or → to run against the roll",
    touchHint: "Hold the left or right side to run against the roll",
    at: { x: 84, z: -17.4, face: 0 },
    stall: false,
    size: { w: 3, d: 1.2 },
    hall: [3.0, 2.4],
    duration: MAX,
    cam: { y: 2.2, z: 2.2, look: [0, 0.9, ZL], fov: 44 },
    cross: false,
    button: "RUN",
    scoreLabel: "Runway",
    scoreText: (b) => (b.score / 10).toFixed(1) + " s",
    liveText: (v) => (v / 10).toFixed(1) + " s",
    describe: (r) => "stayed dry " + ((r.score || 0) / 10).toFixed(1) + " s",
    board: { label: "Longest runway", better: "high", value: (r) => r.score, format: (v) => (v / 10).toFixed(1) + " s" },
    setup(b) {
      const d = b.decor, world = b.world;
      const at = b.toWorld(0, ZL), pond = world.waterAt(at.x, at.z);
      const WY = (pond ? pond.level : -0.42) - b.root.position.y;
      const sign = MF.sign("DEFAULT ALIVE", { w: 2.4, h: 0.46, bg: "#16a085", color: "#ffffff", border: "#ffffff", double: true });
      sign.position.set(0, 2.5, 3.3);
      d.add(sign);
      for (const sx of [-1, 1]) MF.cyl(0.04, 0.04, 2.5, MF.PAL.woodDark, { x: sx * 1.2, y: 1.25, z: 3.3, parent: d, seg: 6 });
      // deux bouées qui tiennent le rondin en place, le rondin (il tourne), le bûcheron dessus
      for (const sx of [-1, 1]) {
        MF.cyl(0.3, 0.34, 0.3, MF.PAL.red, { x: sx * 2.4, y: WY + 0.06, z: ZL, parent: d, seg: 12 });
        MF.cone(0.1, 0.4, "#ffffff", { x: sx * 2.4, y: WY + 0.4, z: ZL, parent: d, seg: 6 });
      }
      const log = MF.group({ y: WY + LOG_R * 0.55, z: ZL, parent: b.live });
      MF.cyl(LOG_R, LOG_R, 4.2, "#8a5a33", { rz: Math.PI / 2, parent: log, seg: 14 });
      for (const sx of [-1, 1]) MF.cyl(LOG_R * 0.8, LOG_R * 0.8, 0.02, "#e6c998", { x: sx * 2.11, rz: Math.PI / 2, parent: log, seg: 14 });
      for (let i = 0; i < 5; i++) MF.box(0.5, 0.05, 0.12, "#6b4a2e", { x: -1.6 + i * 0.8, y: LOG_R, rx: i, parent: log });
      const jack = MF.Presence.buildAvatar(b.ctx.self.color, null, null);
      jack.tag.visible = false;
      jack.body.rotation.y = Math.PI;
      b.live.add(jack.group);
      const ring = MF.torus(0.4, 0.04, MF.mat("#ffffff", { basic: true, opacity: 0.8 }), { rx: Math.PI / 2, y: WY + 0.02, z: ZL, parent: b.live, seg: 16, tubeSeg: 4 });
      ring.visible = false;
      let x = 0, v = 0, push = 0, nextPush = 0, fell = 0, splash = 9, step = 0;
      return {
        reset() {
          x = v = push = fell = step = 0;
          nextPush = 1.2;
          ring.visible = false;
        },
        update() {
          const t = b.t;
          if (b.playing && !fell) {
            // à-coups du rondin : un nouveau sens et une nouvelle force à intervalles de plus en plus courts
            if (t >= nextPush) {
              const k = 1 + t / 14;
              push = (b.rand() < 0.5 ? -1 : 1) * (0.5 + b.rand() * 0.5) * k;
              nextPush = t + Math.max(0.55, 1.9 - t / 30) * (0.7 + b.rand() * 0.6);
            }
            const K = b.input.state, key = K.x < -0.5 ? -1 : K.x > 0.5 ? 1 : 0;
            const run = key || (b.hold && !K.a ? (b.aim.x < 0 ? -1 : 1) : 0);
            v += (push * 1.25 + run * 2.6 - v * 1.6) * b.dt;
            x += v * b.dt;
            step += Math.abs(run) * b.dt * 12;
            b.score = Math.round(t * 10);
            if (Math.abs(x) > LIMIT) {
              fell = t;
              splash = 0;
              ring.position.x = x * 1.6;
              b.hud.flash("Splash! Out of runway after " + t.toFixed(1) + " s", { color: "#7fd8ff", hold: 1.6 });
              MF.sfx.play("plouf");
              b.finish();
            }
          }
          log.rotation.x += (push * 1.6 + v * 0.5) * b.dt * (fell ? 0.2 : 1);
          if (splash < 1) {
            splash += b.dt * 1.3;
            ring.visible = splash < 1;
            ring.scale.set(1 + splash * 4, 1 + splash * 4, 1);
          }
          // le bûcheron : penché du côté où il part, jambes qui moulinent ; tombé, il a disparu sous l'eau
          jack.group.visible = !fell || b.t - fell < 0.35;
          jack.group.position.set(x * 1.6, WY + LOG_R * 1.5 - (fell ? (b.t - fell) * 4 : 0), ZL);
          jack.body.rotation.z = -x * 0.45;
          jack.legs[0].rotation.x = Math.sin(step) * 0.6;
          jack.legs[1].rotation.x = -Math.sin(step) * 0.6;
          jack.arms[0].rotation.z = -1.1 - x * 0.5;
          jack.arms[1].rotation.z = 1.1 - x * 0.5;
        },
      };
    },
  });
})();
