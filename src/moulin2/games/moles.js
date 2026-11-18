// La Fête du Moulin — Whack-a-Mole (le jeu des taupes).
//
// 45 secondes : neuf trous, des taupes qui sortent de plus en plus vite. Un clic (ou un doigt) sur
// une taupe : +10 ; une taupe dorée : +30 ; un putois (violet, à raie blanche) : −20, on le laisse
// tranquille. Les sorties sont tirées de la graine de la partie : tout le monde a les mêmes taupes.
(function () {
  "use strict";
  const MF = globalThis.MoulinFete;
  const TILT = 0.245, COLS = [-1.05, 0, 1.05], ROWS = [-0.6, 0, 0.6];
  const KIND = { mole: { color: "#8a5a33", pts: 10 }, gold: { color: "#f5c531", pts: 30 }, skunk: { color: "#4a3d63", pts: -20 } };

  MF.booth({
    id: "moles",
    title: "Whack-a-Mole",
    icon: "🔨",
    color: MF.PAL.green,
    blurb: "45 seconds · bonk the moles, spare the skunks",
    help: "Click (or tap) a mole as soon as it pops up: +10. Golden moles are worth 30. The purple skunks cost 20: leave them alone!",
    hint: "Click the moles · arrows and Space also work",
    touchHint: "Tap the moles!",
    at: { x: 10.5, z: -67.6, face: -Math.PI / 2 },
    stall: { colors: [MF.PAL.green, MF.PAL.white], counter: false },
    duration: 45,
    cam: { y: 2.15, z: 2.6, look: [0, 1.15, -0.3], fov: 52 },
    button: "BONK",
    stats: [{ key: "hits", label: "Bonks" }],
    setup(b) {
      const THREE = b.THREE;
      // la table inclinée, ses neuf trous, la jupe rayée
      MF.box(3.5, 0.12, 2.1, "#4fae5a", { y: 1.2, z: 0.1, rx: TILT, parent: b.decor, cast: true });
      MF.box(3.5, 1.0, 0.1, MF.PAL.green, { y: 0.5, z: 1.12, parent: b.decor });
      for (let i = 0; i < 7; i++) MF.box(0.25, 1.0, 0.11, MF.PAL.white, { x: -1.5 + i * 0.5, y: 0.5, z: 1.125, parent: b.decor });
      const holes = [];
      for (const v of ROWS)
        for (const u of COLS) {
          const y = 1.2 - v * Math.sin(TILT) + 0.065, z = 0.1 + v * Math.cos(TILT);
          MF.cyl(0.27, 0.27, 0.02, "#1f1a17", { x: u, y, z, rx: TILT, parent: b.decor, seg: 18 });
          MF.torus(0.27, 0.035, "#2f7f3c", { x: u, y: y + 0.01, z, rx: TILT - Math.PI / 2, parent: b.decor, seg: 18, tubeSeg: 5 });
          // la bête : un seul corps repeint selon l'espèce ; la raie blanche ne sert qu'au putois
          const g = MF.group({ x: u, y: y - 0.5, z, parent: b.live });
          const coat = MF.mat(KIND.mole.color, { unique: true });
          MF.cyl(0.2, 0.21, 0.4, coat, { y: 0.2, parent: g, seg: 12 });
          MF.sphere(0.2, coat, { y: 0.4, parent: g, seg: 12 });
          MF.sphere(0.055, "#ff8fa8", { y: 0.42, z: 0.19, parent: g, seg: 6 });
          for (const sx of [-1, 1]) MF.sphere(0.032, MF.PAL.black, { x: sx * 0.08, y: 0.5, z: 0.165, parent: g, seg: 6 });
          MF.box(0.07, 0.05, 0.02, "#ffffff", { y: 0.345, z: 0.2, parent: g });
          const stripe = MF.box(0.1, 0.36, 0.45, "#ffffff", { y: 0.45, parent: g });
          g.visible = false;
          holes.push({ g, coat, stripe, x: u, y, z, kind: null, t0: 0, t1: 0, hit: -1, up: 0 });
        }
      // le maillet, qui suit le viseur et s'abat au clic
      const mallet = MF.group({ parent: b.live });
      mallet.scale.setScalar(0.8);
      MF.cyl(0.03, 0.03, 0.7, MF.PAL.wood, { y: 0.35, parent: mallet, seg: 6 });
      MF.cyl(0.13, 0.13, 0.34, MF.PAL.red, { y: 0.72, rz: Math.PI / 2, parent: mallet, seg: 10 });
      mallet.visible = false;
      const spot = new THREE.Vector3(), head = new THREE.Vector3();
      let next = 0, hits = 0, swing = 0;

      function spawn(t) {
        const free = holes.filter((h) => t >= h.t1 + 0.25);
        const r1 = b.rand(), r2 = b.rand(), r3 = b.rand(); // toujours trois tirages : la suite reste la même pour tous
        if (!free.length) return;
        const h = free[Math.floor(r1 * free.length)], k = t / b.DUR;
        h.kind = r2 < 0.12 ? "gold" : r2 < 0.3 ? "skunk" : "mole";
        h.t0 = t;
        h.t1 = t + MF.lerp(1.3, 0.78, k) * (h.kind === "gold" ? 0.72 : 1) * (0.85 + r3 * 0.3);
        h.hit = -1;
        h.coat.color.copy(MF.color(KIND[h.kind].color));
        h.stripe.visible = h.kind === "skunk";
      }
      return {
        holes,
        reset() {
          for (const h of holes) Object.assign(h, { kind: null, t0: 0, t1: -9, hit: -1, up: 0 });
          next = 0.4;
          hits = 0;
        },
        update() {
          const t = b.t;
          if (b.playing) while (t >= next) {
            spawn(next);
            next += MF.lerp(0.62, 0.36, next / b.DUR);
          }
          // maillet au bout du viseur, sur la table
          const p = b.hit(1.5, "y", spot);
          mallet.visible = !!p && b.t >= 0;
          swing = Math.max(0, swing - b.dt);
          if (p) {
            mallet.position.set(MF.clamp(p.x, -1.9, 1.9) + 0.3, 1.5, MF.clamp(p.z, -1.2, 1.4) + 0.22);
            mallet.rotation.set(0, 0.5, 0.75 + (swing > 0 ? 0.75 * Math.sin((1 - swing / 0.16) * Math.PI) : 0));
          }
          if (b.press && b.playing) {
            swing = 0.16;
            // la bête sortie la plus proche de la ligne de visée
            let best = null, bd = 0.34;
            for (const h of holes) {
              if (!h.kind || h.hit >= 0 || h.up < 0.45) continue;
              head.set(h.x, h.y + 0.3 * h.up, h.z).sub(b.ray.o);
              const along = head.dot(b.ray.d), off = Math.sqrt(Math.max(0, head.lengthSq() - along * along));
              if (off < bd) {
                bd = off;
                best = h;
              }
            }
            if (best) {
              best.hit = t;
              const pts = KIND[best.kind].pts;
              head.set(best.x, best.y + 0.45, best.z);
              b.add(pts, best.kind === "skunk" ? "Stinky! −20" : best.kind === "gold" ? "Golden! +30" : "+10", head);
              if (pts > 0) hits++;
              MF.sfx.play(best.kind === "skunk" ? "perdu" : best.kind === "gold" ? "bravo" : "toc");
              if (best.kind === "gold") b.confetti(best.x, best.y + 0.5, best.z, 10);
            } else MF.sfx.play("swing");
          }
          for (const h of holes) {
            let up = 0, squash = 1;
            if (h.kind) {
              if (h.hit >= 0) {
                const a = t - h.hit;
                up = Math.max(0, h.up - b.dt * 6);
                squash = a < 0.12 ? 0.45 : 0.7;
                if (up <= 0) h.kind = null;
              } else if (t > h.t1 + 0.14 || !b.playing) {
                up = Math.max(0, h.up - b.dt * 7);
                if (up <= 0) h.kind = null;
              } else up = t > h.t1 ? Math.max(0, 1 - (t - h.t1) / 0.14) : Math.min(1, (t - h.t0) / 0.12);
            }
            h.up = up;
            h.g.visible = up > 0.02;
            h.g.position.y = h.y - 0.5 + up * 0.46;
            h.g.scale.set(1 + (1 - squash) * 0.5, squash, 1 + (1 - squash) * 0.5);
          }
        },
        hud() {
          b.hud.set("hits", hits);
        },
        leave() {
          mallet.visible = false;
        },
      };
    },
  });
})();
