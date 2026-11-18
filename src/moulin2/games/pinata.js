// La Fête du Moulin — Unicorn Piñata (la piñata licorne).
//
// 30 secondes : la licorne se balance au bout de sa corde, de plus en plus vite. On clique dessus
// (ou on la touche) pour la frapper : 10 points le coup, 25 en plein milieu. Quand elle cède, il
// pleut des bonbons (+100) et une autre, plus vive, prend sa place.
(function () {
  "use strict";
  const MF = globalThis.MoulinFete;
  const TOP = 4.4, ROPE = 2.3, ZP = -1.6;

  MF.booth({
    id: "pinata",
    title: "Unicorn Piñata",
    icon: "🦄",
    color: "#e84393",
    blurb: "30 seconds · whack the swinging unicorn until it rains candy",
    help: "The unicorn swings on its rope, faster and faster. Click (or tap) right on it to hit: 10 points, 25 for a hit dead centre. When it bursts it rains candy (+100) and a livelier one takes its place.",
    hint: "Click the unicorn as it swings",
    touchHint: "Tap the unicorn as it swings",
    at: { x: 108, z: -7.6, face: 0 },
    stall: false,
    size: { w: 3, d: 2.4 },
    hall: [3.6, 3.2],
    duration: 30,
    cam: { y: 1.7, z: 3.4, look: [0, 2.2, ZP], fov: 56 },
    button: "WHACK",
    stats: [{ key: "burst", label: "Burst" }],
    setup(b) {
      const THREE = b.THREE, d = b.decor;
      // le portique, l'enseigne
      for (const sx of [-1, 1]) MF.cyl(0.09, 0.11, TOP + 0.3, MF.PAL.white, { x: sx * 2.6, y: (TOP + 0.3) / 2, z: ZP, parent: d, seg: 8, cast: true });
      MF.cyl(0.07, 0.07, 5.4, MF.PAL.pink, { y: TOP, z: ZP, rz: Math.PI / 2, parent: d, seg: 8 });
      const sign = MF.sign("UNICORN PIÑATA", { w: 2.8, h: 0.5, bg: "#e84393", color: "#ffffff", border: MF.PAL.yellow, double: true });
      sign.position.set(0, TOP + 0.55, ZP);
      d.add(sign);
      [MF.PAL.yellow, MF.PAL.blue, MF.PAL.green, MF.PAL.red].forEach((c, i) => {
        const bal = MF.balloon(c, 0.24);
        bal.position.set((i < 2 ? -1 : 1) * 2.6 + (i % 2 ? 0.2 : -0.2), TOP + 0.5 + (i % 2) * 0.2, ZP);
        d.add(bal);
      });
      // la licorne au bout de sa corde (le pivot est en haut du portique)
      const pivot = MF.group({ y: TOP, z: ZP, parent: b.live });
      MF.cyl(0.012, 0.012, ROPE, "#ffffff", { y: -ROPE / 2, parent: pivot, seg: 5 });
      const uni = MF.group({ y: -ROPE - 0.25, parent: pivot });
      MF.box(0.9, 0.5, 0.42, "#ffffff", { parent: uni });
      MF.box(0.34, 0.52, 0.3, "#ffffff", { x: 0.52, y: 0.36, rz: -0.5, parent: uni });
      MF.box(0.36, 0.24, 0.26, "#ffffff", { x: 0.74, y: 0.5, parent: uni });
      MF.cone(0.05, 0.36, "#f5c531", { x: 0.74, y: 0.8, rz: -0.25, parent: uni, seg: 8 });
      ["#ef4b3f", "#ff9d2e", "#f5c531", "#59c36a", "#3fb4e8", "#c56ee0"].forEach((c, i) => {
        MF.box(0.09, 0.3, 0.44, c, { x: 0.36 - i * 0.07, y: 0.42 - i * 0.03, rz: -0.5, parent: uni });
        MF.box(0.06, 0.5, 0.06, c, { x: -0.5, y: -0.05 - i * 0.02, z: -0.15 + i * 0.06, rz: 0.5, parent: uni });
      });
      for (const [x, z] of [[-0.3, -0.13], [-0.3, 0.13], [0.3, -0.13], [0.3, 0.13]]) MF.box(0.11, 0.4, 0.11, "#f0f0f5", { x, y: -0.44, z, parent: uni });
      MF.sphere(0.03, MF.PAL.black, { x: 0.86, y: 0.54, z: 0.14, parent: uni, seg: 5 });
      MF.freeze(uni);
      const bat = MF.group({ parent: b.live });
      MF.cyl(0.035, 0.06, 0.9, MF.PAL.wood, { y: 0.45, parent: bat, seg: 8 });
      const centre = new THREE.Vector3(), spot = new THREE.Vector3();
      let hp = 6, n = 0, phase = 0, kick = 0, swing = 0, gone = 0;
      return {
        reset() {
          hp = 6;
          n = kick = swing = gone = 0;
          phase = b.rand() * 6;
          uni.visible = true;
        },
        update() {
          const t = Math.max(0, b.t), speed = 1.5 + n * 0.45 + t * 0.02;
          kick *= 1 - 3 * b.dt;
          swing = Math.max(0, swing - b.dt);
          gone = Math.max(0, gone - b.dt);
          if (gone <= 0 && !uni.visible) uni.visible = true;
          pivot.rotation.z = Math.sin(t * speed + phase) * (0.75 - Math.min(0.25, n * 0.05)) + kick;
          pivot.rotation.x = Math.sin(t * speed * 0.7) * 0.12;
          uni.rotation.y = kick * 3;
          pivot.updateMatrixWorld(true);
          centre.set(0, 0, 0);
          uni.localToWorld(centre);
          b.root.worldToLocal(centre);
          // la batte suit le viseur ; au clic, elle part
          const p = b.hit(ZP + 0.6, "z", spot);
          bat.visible = !!p && b.t >= 0;
          if (p) {
            bat.position.set(p.x + 0.35, p.y - 0.75, ZP + 0.9);
            bat.rotation.z = 0.5 - (swing > 0 ? Math.sin((1 - swing / 0.24) * Math.PI) * 1.3 : 0);
          }
          if (b.press && b.playing && swing <= 0) {
            swing = 0.24; // le temps de ramener la batte : pas plus de quatre coups par seconde
            centre.sub(b.ray.o);
            const along = centre.dot(b.ray.d), off = Math.sqrt(Math.max(0, centre.lengthSq() - along * along));
            centre.add(b.ray.o);
            if (uni.visible && off < 0.62) {
              const pts = off < 0.22 ? 25 : 10;
              hp -= off < 0.22 ? 2 : 1;
              kick += (Math.random() < 0.5 ? -1 : 1) * 0.5;
              b.add(pts, pts === 25 ? "Sweet spot! +25" : "+10", centre);
              MF.sfx.play("choc");
              if (hp <= 0) {
                // elle cède : pluie de bonbons, une autre arrive
                n++;
                hp = 6 + n * 2;
                uni.visible = false;
                gone = 0.9;
                phase = b.rand() * 6;
                b.add(100, "IT RAINS CANDY! +100");
                b.confetti(centre.x, centre.y, centre.z, 26);
                MF.sfx.play("bravo");
              }
            } else MF.sfx.play("swing");
          }
        },
        hud() {
          b.hud.set("burst", n);
        },
        leave() {
          bat.visible = false;
        },
      };
    },
  });
})();
