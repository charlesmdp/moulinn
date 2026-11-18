// La Fête du Moulin — Ring Toss (le lancer d'anneaux sur des goulots de bouteilles).
//
// Douze anneaux, vingt bouteilles. La main tremble : le repère d'atterrissage tourne autour du
// viseur, on clique quand il passe sur un goulot. Bouteille verte : 10, rouge : 20, dorée (tout au
// fond) : 50. Une bouteille déjà coiffée ne rapporte plus rien.
(function () {
  "use strict";
  const MF = globalThis.MoulinFete;
  const RINGS = 12, TOP = 1.38, TABLE = 0.92, NECK = 0.052;
  const KINDS = { g: { color: "#3fae5a", pts: 10 }, r: { color: "#e2483d", pts: 20 }, o: { color: "#f5c531", pts: 50 } };
  // quatre rangées de cinq, du fond (z = −1,15) vers le comptoir
  const LAYOUT = ["ogogo", "rgrgr", "grgrg", "ggggg"];

  MF.booth({
    id: "rings",
    title: "Ring Toss",
    icon: "⭕",
    color: MF.PAL.orange,
    blurb: "12 rings · land them on the bottle necks",
    help: "Your hand wobbles: the landing marker circles around your aim. Click when it sits right over a bottle neck. Green 10, red 20, golden (back row) 50. A bottle only pays once.",
    hint: "Click when the marker is over a bottle neck",
    touchHint: "Hold a finger to aim, lift it when the marker is over a neck",
    at: { x: 10.5, z: -56, face: -Math.PI / 2 },
    stall: { colors: [MF.PAL.orange, MF.PAL.white] },
    maxTime: 120,
    cam: { y: 2.4, z: 2.7, look: [0, 1.1, -0.5], fov: 46 },
    button: "TOSS",
    stats: [{ key: "rings", label: "Rings" }],
    setup(b) {
      const THREE = b.THREE, d = b.decor;
      MF.box(2.7, TABLE, 1.9, MF.PAL.blue, { y: TABLE / 2, z: -0.45, parent: d, cast: true });
      MF.box(2.8, 0.05, 2.0, "#f3e3c2", { y: TABLE, z: -0.45, parent: d });
      const bottles = [];
      LAYOUT.forEach((row, j) =>
        [...row].forEach((k, i) => {
          const x = (i - 2) * 0.46, z = -1.15 + j * 0.42, K = KINDS[k];
          MF.cyl(0.075, 0.085, 0.27, K.color, { x, y: TABLE + 0.16, z, parent: d, seg: 10, cast: true });
          MF.cone(0.078, 0.13, K.color, { x, y: TABLE + 0.36, z, parent: d, seg: 10 });
          MF.cyl(0.03, 0.035, 0.14, K.color, { x, y: TABLE + 0.4, z, parent: d, seg: 8 });
          bottles.push({ x, z, pts: K.pts, taken: false });
        }),
      );
      // les anneaux (réutilisés), le repère d'atterrissage
      const pool = [];
      for (let i = 0; i < RINGS; i++) {
        const m = MF.torus(0.095, 0.014, i % 2 ? "#ffffff" : MF.PAL.red, { rx: Math.PI / 2, parent: b.live, seg: 18, tubeSeg: 5 });
        m.visible = false;
        pool.push(m);
      }
      const marker = MF.torus(0.095, 0.012, MF.mat("#1b1b22", { opacity: 0.55 }), { rx: Math.PI / 2, parent: b.live, seg: 18, tubeSeg: 4 });
      const spot = new THREE.Vector3(), hand = new THREE.Vector3(), land = new THREE.Vector3(), rest = new THREE.Vector3();
      let left = RINGS, flying = 0;

      function toss() {
        const ring = pool[RINGS - left];
        left--;
        flying++;
        MF.sfx.play("swing");
        hand.set(0.25, 1.35, 1.9);
        land.copy(marker.position);
        b.fly(ring, hand, land, 0.55, 0.5, () => {
          let best = null, bd = Infinity;
          for (const bt of bottles) {
            const dd = Math.hypot(land.x - bt.x, land.z - bt.z);
            if (dd < bd) {
              bd = dd;
              best = bt;
            }
          }
          flying--;
          if (bd < NECK && !best.taken) {
            // coiffée : l'anneau glisse autour du goulot
            best.taken = true;
            ring.position.set(best.x, TABLE + 0.33, best.z);
            rest.set(best.x, TOP + 0.1, best.z);
            b.add(best.pts, best.pts === 50 ? "GOLDEN BOTTLE! +50" : "Ringer! +" + best.pts, rest);
            MF.sfx.play(best.pts >= 50 ? "bravo" : "ting");
            if (best.pts === 50) b.confetti(best.x, TOP + 0.2, best.z, 16);
          } else {
            // manqué : il rebondit sur le goulot (ou sur la table) et retombe à plat
            const a = Math.atan2(land.z - best.z, land.x - best.x) || 0;
            rest.set(MF.clamp(land.x + Math.cos(a) * 0.17, -1.3, 1.3), TABLE + 0.04, MF.clamp(land.z + Math.sin(a) * 0.17, -1.35, 0.4));
            if (bd < 0.14) MF.sfx.play("toc");
            b.fly(ring, land, rest, 0.12, 0.22);
          }
          if (!left && !flying) b.finish();
        });
      }
      return {
        bottles,
        marker,
        reset() {
          left = RINGS;
          flying = 0;
          for (const bt of bottles) bt.taken = false;
          for (const m of pool) m.visible = false;
        },
        update() {
          const p = b.hit(TOP, "y", spot), t = b.time;
          marker.visible = b.playing && left > 0 && !!p;
          if (p) {
            // la main tremble : le repère décrit une petite boucle autour du viseur
            marker.position.set(MF.clamp(p.x, -1.25, 1.25) + Math.sin(t * 2.3) * 0.15, TOP, MF.clamp(p.z, -1.4, 0.35) + Math.sin(t * 3.1 + 1) * 0.11);
          }
          // souris : on lance au clic ; doigt : on vise en le posant, on lance en le levant
          if (b.playing && left > 0 && p && (b.input.touch ? b.release : b.press)) toss();
        },
        hud() {
          b.hud.set("rings", left + " / " + RINGS);
        },
      };
    },
  });
})();
