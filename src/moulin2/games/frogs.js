// La Fête du Moulin — Crossing the Chasm (la mare aux grenouilles, sur le bassin de la véranda).
//
// Huit grenouilles à catapulter sur des nénuphars qui dérivent : le rang proche (les « early
// adopters ») vaut 10, le rang du milieu 20, les grands nénuphars dorés du fond (« the
// mainstream ») 50. On vise à la souris, on maintient le clic pour doser la portée. Un nénuphar
// occupé ne compte plus : il faut traverser le gouffre.
(function () {
  "use strict";
  const MF = globalThis.MoulinFete;
  const FROGS = 8, NEAR = 2.4, REACH = 8.2;
  // nénuphars : distance, écart latéral, rayon, points, vitesse de dérive
  const PADS = [[3.6, -1.5, 0.55, 10, 0.5], [3.9, 1.4, 0.55, 10, -0.6], [6.0, -0.4, 0.5, 20, 0.8], [6.4, 2.0, 0.5, 20, -0.7], [6.2, -2.6, 0.5, 20, 0.6], [8.8, 0.9, 0.42, 50, 1.0], [9.2, -1.6, 0.42, 50, -0.9]];

  MF.booth({
    id: "frogs",
    title: "Crossing the Chasm",
    icon: "🐸",
    color: "#27ae60",
    blurb: "8 frogs · land them on the lily pads, early adopters to mainstream",
    help: "Aim left or right with the mouse, hold the click to set the range and release to launch a frog. Near pads 10, middle pads 20, golden pads at the back 50. The pads drift, and a pad only counts once.",
    hint: "Aim, hold to set the range, release to launch",
    at: { x: 34.4, z: -5.5, face: Math.PI / 2 },
    stall: false,
    size: { w: 3, d: 1.2 },
    hall: [3.0, 2.6],
    maxTime: 110,
    cam: { y: 2.3, z: 2.4, look: [0, 0.2, -5.2], fov: 50 },
    cross: false,
    button: "LAUNCH",
    stats: [{ key: "frogs", label: "Frogs" }],
    setup(b) {
      const THREE = b.THREE, d = b.decor, world = b.world;
      const at = b.toWorld(0, -5), pond = world.waterAt(at.x, at.z);
      const WY = (pond ? pond.level : -0.28) - b.root.position.y + 0.04;
      // la catapulte (une planche à bascule), l'enseigne derrière le joueur
      MF.box(0.5, 0.14, 0.5, MF.PAL.woodDark, { y: 0.12, z: 0.2, parent: d });
      const arm = MF.group({ y: 0.26, z: 0.2, parent: b.live });
      MF.box(0.16, 0.05, 1.3, MF.PAL.wood, { parent: arm });
      MF.cyl(0.14, 0.11, 0.06, MF.PAL.red, { y: 0.05, z: -0.55, parent: arm, seg: 10 });
      const sign = MF.sign("CROSSING THE CHASM", { w: 2.8, h: 0.46, bg: "#27ae60", color: "#ffffff", border: "#ffffff", double: true });
      sign.position.set(0, 2.5, 3.5);
      d.add(sign);
      for (const sx of [-1, 1]) MF.cyl(0.04, 0.04, 2.5, MF.PAL.woodDark, { x: sx * 1.4, y: 1.25, z: 3.5, parent: d, seg: 6 });
      const pads = PADS.map(([dist, x, r, pts, drift], i) => {
        const g = MF.group({ parent: b.live });
        MF.cyl(r, r, 0.03, pts === 50 ? "#f5c531" : pts === 20 ? "#7bd07a" : "#3fae5a", { parent: g, seg: 16 });
        MF.box(r * 0.5, 0.035, 0.05, "#1f6b33", { x: r * 0.7, parent: g });
        if (pts === 50) MF.sphere(0.09, "#ff8fc0", { y: 0.07, x: -r * 0.5, parent: g, seg: 7 });
        return { g, dist, x0: x, r, pts, drift, phase: i * 1.7, taken: false, x: x, z: -dist };
      });
      const pool = [];
      for (let i = 0; i < FROGS; i++) {
        const g = MF.group({ parent: b.live });
        MF.sphere(0.13, "#5fc24a", { y: 0.09, parent: g, seg: 9 }).scale.set(1, 0.7, 1.25);
        for (const sx of [-1, 1]) {
          MF.sphere(0.045, "#ffffff", { x: sx * 0.07, y: 0.18, z: -0.1, parent: g, seg: 6 });
          MF.sphere(0.022, MF.PAL.black, { x: sx * 0.07, y: 0.19, z: -0.135, parent: g, seg: 5 });
          MF.box(0.07, 0.04, 0.16, "#3f9a3a", { x: sx * 0.15, y: 0.04, z: 0.05, parent: g });
        }
        g.visible = false;
        pool.push(g);
      }
      const ring = MF.torus(0.3, 0.03, MF.mat("#ffffff", { basic: true, opacity: 0.8 }), { rx: Math.PI / 2, parent: b.live, seg: 16, tubeSeg: 4 });
      ring.visible = false;
      const marker = MF.cone(0.1, 0.4, MF.PAL.yellow, { y: 0.05, z: -1.2, rx: -Math.PI / 2, parent: b.live, seg: 3 });
      marker.scale.set(1, 1, 0.2);
      const from = new THREE.Vector3(), land = new THREE.Vector3();
      let left = FROGS, busy = false, aim = 0, flick = 0, splash = 9;

      function launch(power) {
        busy = true;
        const frog = pool[FROGS - left];
        left--;
        flick = 0.2;
        MF.sfx.play("boing");
        const dist = NEAR + power * REACH, dir = aim * 0.45;
        from.set(0, 0.45, -0.35);
        land.set(Math.sin(dir) * dist, WY + 0.02, -Math.cos(dir) * dist - 0.35);
        b.live.attach(frog);
        frog.rotation.set(0, -dir, 0);
        b.fly(frog, from, land, 1.2 + power * 1.6, 0.55 + power * 0.45, () => {
          const pad = pads.find((p) => !p.taken && Math.hypot(land.x - p.x, land.z - p.z) < p.r);
          if (pad) {
            pad.taken = true;
            frog.position.set(pad.x - pad.g.position.x, 0.03, pad.z - pad.g.position.z);
            pad.g.add(frog); // la grenouille dérive avec son nénuphar
            b.add(pad.pts, pad.pts === 50 ? "MAINSTREAM! +50" : pad.pts === 20 ? "Early majority +20" : "Early adopter +10", land);
            MF.sfx.play(pad.pts === 50 ? "bravo" : "ting");
            if (pad.pts === 50) b.confetti(land.x, WY + 0.4, land.z, 16);
          } else {
            frog.visible = false;
            ring.position.set(land.x, WY, land.z);
            splash = 0;
            b.hud.pop(pads.some((p) => p.taken && Math.hypot(land.x - p.x, land.z - p.z) < p.r) ? "Pad already taken" : "Into the chasm…", ...b.screen(land));
            MF.sfx.play("plouf");
          }
          busy = false;
          if (!left) b.finish();
        });
      }
      return {
        pads,
        reset() {
          left = FROGS;
          busy = false;
          for (const p of pads) p.taken = false;
          for (const g of pool) {
            b.live.attach(g);
            g.visible = false;
          }
        },
        update() {
          const t = Math.max(0, b.t);
          for (const p of pads) {
            // dérive lente, en travers et un peu en profondeur
            p.x = p.x0 + Math.sin(t * 0.55 * p.drift + p.phase) * 0.9;
            p.z = -p.dist - 0.35 + Math.cos(t * 0.4 * p.drift + p.phase) * 0.35;
            p.g.position.set(p.x, WY, p.z);
            p.g.rotation.y = t * 0.2 * p.drift;
          }
          flick = Math.max(0, flick - b.dt);
          arm.rotation.x = flick > 0 ? 0.5 : -0.22;
          if (splash < 1) {
            splash += b.dt * 1.5;
            ring.visible = splash < 1;
            ring.scale.set(1 + splash * 3, 1 + splash * 3, 1);
          }
          if (!busy) aim = MF.clamp(b.aim.x * 1.5, -1, 1);
          marker.position.set(Math.sin(aim * 0.45) * 1.2, 0.05, -Math.cos(aim * 0.45) * 1.2 - 0.35);
          marker.rotation.y = -aim * 0.45;
          marker.visible = b.playing && !busy && left > 0;
          if (busy || !left) return;
          const power = b.charge(0.9, "Range");
          if (power !== null) launch(power);
        },
        hud() {
          b.hud.set("frogs", left + " / " + FROGS);
        },
      };
    },
  });
})();
