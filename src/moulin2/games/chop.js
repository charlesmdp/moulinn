// La Fête du Moulin — Cut the Scope (le concours de bûcheron).
//
// 30 secondes pour débiter un tronc : une frappe à gauche (← ou clic à gauche), une frappe à
// droite (→ ou clic à droite). Le tronc descend d'un cran à chaque coup ; si une branche arrive du
// côté où l'on se tient, on la prend sur la tête (une seconde perdue). Le score est le nombre de
// rondins. Les branches sont tirées de la graine de la partie : le même tronc pour tout le monde.
(function () {
  "use strict";
  const MF = globalThis.MoulinFete;
  const SEG = 0.62, SHOWN = 9, R = 0.34, SIDE = 0.86;
  const CHEERS = { 15: "MVP shipped!", 30: "v1.0 is out!", 45: "Scope: slashed", 60: "Legendary lumberjack!" };

  MF.booth({
    id: "chop",
    title: "Cut the Scope",
    icon: "🪓",
    color: "#b5651d",
    blurb: "30 seconds · chop left or right, dodge the branches",
    help: "Tap ← or → (or click the left or right side of the screen) to chop from that side. Every chop drops the trunk one log. Never stand under a branch: it costs you a second. Scope creep grows on trees.",
    hint: "← / → (or click left / right) to chop · dodge the branches",
    touchHint: "Tap the left or right side to chop · dodge the branches",
    at: { x: 30.6, z: 23.6, face: -Math.PI / 2 },
    stall: false,
    size: { w: 3, d: 2.4 },
    hall: [3.3, 3.3],
    duration: 30,
    cam: { y: 2.2, z: 3.7, look: [0, 2.3, -0.9], fov: 62 },
    cross: false,
    button: "CHOP",
    scoreLabel: "Logs",
    scoreText: (b) => b.score,
    liveText: (v) => v + " logs",
    board: { label: "Most logs in 30 s", better: "high", value: (r) => r.score, format: (v) => v + " logs" },
    describe: (r) => (r.score || 0) + " logs",
    setup(b) {
      const d = b.decor, Z = -0.9;
      // la souche, l'enseigne, les copeaux
      MF.cyl(0.62, 0.72, 0.3, "#8a5a33", { y: 0.15, z: Z, parent: d, seg: 14, cast: true });
      MF.cyl(0.5, 0.5, 0.02, "#e6c998", { y: 0.31, z: Z, parent: d, seg: 14 });
      const sign = MF.sign("CUT THE SCOPE", { w: 2.4, h: 0.5, bg: "#b5651d", color: "#ffffff", border: MF.PAL.yellow, double: true });
      sign.position.set(0, 0.55, 1.15);
      sign.rotation.x = -0.5;
      d.add(sign);
      for (const sx of [-1, 1]) {
        const f = MF.props.flag(sx < 0 ? MF.PAL.red : MF.PAL.green, 3.4);
        f.position.set(sx * 1.9, b.ground(sx * 1.9, Z - 0.6), Z - 0.6);
        d.add(f);
        const logs = MF.group({ x: sx * 1.7, y: b.ground(sx * 1.7, 0.6), z: 0.6, parent: d });
        for (let i = 0; i < 3; i++) MF.cyl(0.2, 0.2, 0.8, "#9a6a3c", { x: (i - 1) * 0.42, y: 0.2, rz: Math.PI / 2, ry: Math.PI / 2, parent: logs, seg: 10 });
        MF.cyl(0.2, 0.2, 0.8, "#9a6a3c", { x: -0.2, y: 0.55, rz: Math.PI / 2, ry: Math.PI / 2, parent: logs, seg: 10 });
      }
      // le tronc : des rondins réutilisés, chacun avec ses deux branches (une seule visible, ou aucune)
      const logs = [];
      for (let i = 0; i < SHOWN + 1; i++) {
        const g = MF.group({ z: Z, parent: b.live });
        MF.cyl(R, R, SEG - 0.03, i % 2 ? "#9a6a3c" : "#8a5a33", { y: SEG / 2, parent: g, seg: 14 });
        const twigs = [-1, 1].map((sx) => {
          const t = MF.group({ x: sx * R, y: SEG / 2, parent: g });
          MF.box(0.9, 0.13, 0.13, "#7a4a22", { x: sx * 0.45, parent: t });
          MF.sphere(0.34, "#3f9a4a", { x: sx * 0.95, y: 0.1, parent: t, seg: 8 }).scale.set(1.2, 0.8, 1);
          t.visible = false;
          return MF.freeze(t);
        });
        logs.push({ g, twigs, side: 0 });
      }
      const jack = MF.Presence.buildAvatar(b.ctx.self.color, null, null);
      jack.tag.visible = false;
      b.live.add(jack.group);
      const axe = MF.group({ parent: jack.body, y: 1.25, z: 0.3 });
      MF.cyl(0.025, 0.025, 0.8, MF.PAL.wood, { rz: Math.PI / 2, parent: axe, seg: 6 });
      MF.box(0.06, 0.26, 0.2, "#aab2ab", { x: 0.4, parent: axe });
      const chips = [];
      for (let i = 0; i < 6; i++) {
        const m = MF.box(0.5, 0.5, 0.3, "#9a6a3c", { parent: b.live });
        m.visible = false;
        chips.push({ m, vx: 0, vy: 0, life: 0 });
      }
      let side = -1, queue = [], stun = 0, drop = 0, swing = 0, cut = 0;

      const next = () => {
        // jamais deux branches opposées de suite au ras : on doit toujours pouvoir passer
        const r = b.rand(), last = queue[queue.length - 1] || 0;
        const s = r < 0.36 ? -1 : r < 0.72 ? 1 : 0;
        queue.push(last && s && s !== last && queue.length > 1 && queue[queue.length - 2] === 0 ? s : last && s === -last ? 0 : s);
      };
      function show() {
        logs.forEach((l, i) => {
          const s = queue[i] ?? 0;
          l.g.position.y = 0.32 + i * SEG + drop;
          l.twigs[0].visible = s < 0;
          l.twigs[1].visible = s > 0;
        });
      }
      return {
        reset() {
          queue = [0, 0];
          while (queue.length < SHOWN + 1) next();
          side = -1;
          stun = drop = swing = cut = 0;
          for (const c of chips) c.m.visible = false;
          show();
        },
        update() {
          stun = Math.max(0, stun - b.dt);
          swing = Math.max(0, swing - b.dt);
          drop = Math.max(0, drop - b.dt * 9);
          if (b.playing && b.tap && stun <= 0) {
            side = b.tap === "L" ? -1 : 1;
            swing = 0.14;
            // le rondin du bas part, tout descend d'un cran ; la branche qui arrive est-elle de mon côté ?
            const c = chips[cut % chips.length];
            c.m.visible = true;
            c.m.position.set(0, 0.6, Z);
            Object.assign(c, { vx: -side * (3 + Math.random() * 2), vy: 2.5, life: 0.7 });
            queue.shift();
            next();
            drop = SEG;
            cut++;
            b.add(1, false);
            MF.sfx.play("toc");
            if (CHEERS[b.score]) b.hud.flash(CHEERS[b.score], { color: MF.PAL.yellow, hold: 0.9 });
            if (queue[0] === side) {
              stun = 1;
              b.hud.flash("Bonk! Scope creep", { color: MF.PAL.red, hold: 0.8 });
              MF.sfx.play("perdu");
            }
          }
          show();
          for (const c of chips) {
            if (c.life <= 0) continue;
            c.life -= b.dt;
            c.vy -= 9 * b.dt;
            c.m.position.x += c.vx * b.dt;
            c.m.position.y += c.vy * b.dt;
            c.m.rotation.z += 9 * b.dt;
            if (c.life <= 0) c.m.visible = false;
          }
          // le bûcheron : du côté de la dernière frappe, hache qui s'abat ; sonné, il vacille
          jack.group.position.set(side * SIDE, b.ground(side * SIDE, Z), Z + 0.1);
          jack.body.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
          jack.body.rotation.z = stun > 0 ? Math.sin(b.time * 18) * 0.12 : 0;
          axe.rotation.y = swing > 0 ? -1.2 + (swing / 0.14) * 1.2 : 0;
          jack.arms[0].rotation.x = jack.arms[1].rotation.x = -1.2;
        },
      };
    },
  });
})();
