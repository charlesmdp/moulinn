// « Pas touche à mes trésors » — tours de GLACE (ralentir, geler, retenir les porteurs).
//
//  I     Obélisque givré        : cristal flottant aux yeux ronchons, petits flocons en orbite.
//  II-A  Crypte du gel          : la porte de la crypte s'ouvre et lance un grand pic de glace.
//  III-A Trône du zéro absolu   : une grande main de glace qui se referme sur ses victimes (glaçon au poing).
//  II-B  Souffleur de blizzard  : bonhomme de neige furieux qui fait tourner un ventilateur magique.
//  III-B Tempête polaire        : gros nuage tourbillonnant, grêle, ventilateur couvert de givre.
// Code couleur : cyan pâle et blanc sur pierre bleue.
(function () {
  "use strict";
  const PTMT = globalThis.PTMT;
  if (!PTMT || !PTMT.models || !PTMT.models.kit) return;
  const K = PTMT.models.kit,
    G = K.g;
  const { TAU, clamp, lerp, damp, bump, easeInOut, easeOut, wob, Spring } = Object.assign({}, K.math, { Spring: K.Spring });

  const C = {
    stone: "#6585b8",
    stoneD: "#3e5684",
    stoneL: "#8ea9d2",
    frost: "#eef8ff",
    snow: "#f6faff",
    iceD: "#2e7fd6",
    iceL: "#c9f1ff",
    glow: "#8ff0ff",
    rune: "#7fe8ff",
    navy: "#1f355c",
    coal: "#1d1d24",
    carrot: "#ff8a2a",
    scarf: "#2f6fd0",
    stick: "#6b4a2e",
    bucket: "#3d5d8f",
    silver: "#c9d6e6",
    void: "#0b1322",
  };

  /* ---------------------------------------------------------------- pièces communes */
  /** Cercle de runes posé au sol. */
  function runeRing(p, r0, r1, y, n) {
    p.add(G.ring(r0, r1, n || 36, Math.max(3, Math.round(r1 * 5))), "runes", { p: [0, y, 0], c: C.rune });
  }
  /** Plaques de neige (galettes aplaties). */
  function snowCaps(p, pts, s) {
    pts.forEach((q, i) => p.add(G.blob(q[3] || s, 1, 0.15, 30 + i), "snow", { p: [q[0], q[1], q[2]], s: [1, 0.28, 1], c: C.snow }));
  }
  /** Petits cristaux plantés (décor). */
  function shards(p, n, r, y, seed, size) {
    const rnd = PTMT.rng(seed);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rnd() * 0.5,
        rr = r + rnd() * 0.12,
        s = (size || 1) * (0.7 + rnd() * 0.6);
      p.add(G.crystal(0.07 * s, 0.14 * s, 5, 0.1 * s, 0.03), "ice", {
        p: [Math.sin(a) * rr, y, Math.cos(a) * rr],
        r: [Math.cos(a) * 0.45, 0, -Math.sin(a) * 0.45],
        g: [C.iceD, C.iceL, 0, 0.25 * s],
      });
    }
  }
  /** Ventilateur magique : moyeu, pales de glace inclinées, cage ; tourne autour de +Z. */
  function fan(parent, key, R, n, frost) {
    const holder = K.node(parent, 0, 0, 0);
    const spin = K.node(holder, 0, 0, 0);
    const p = K.part(key + ":blades");
    const blade = [
      [0, -0.16],
      [0.22, -0.4],
      [0.46, -0.5],
      [0.68, -0.4],
      [0.82, -0.12],
      [0.78, 0.14],
      [0.6, 0.3],
      [0.3, 0.28],
    ];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      p.add(G.extrude("fan:blade", blade, 0.03, 0), "ice", {
        m: new THREE.Matrix4().makeRotationZ(a),
        s: [R * 0.95, R * 0.42, 1],
        r: [0.35, 0, 0],
        ro: "XYZ",
        g: ["#1f64c4", "#8fe4ff", 0, R * 0.75, "x"],
      });
      if (frost)
        for (let k = 0; k < 2; k++)
          p.add(G.blob(0.08 * R, 0, 0.3, 50 + i * 2 + k), "snow", {
            m: new THREE.Matrix4().makeRotationZ(a),
            p: [R * (0.45 + k * 0.28), 0.02, 0.04],
            s: [1.4, 0.8, 0.6],
            c: C.snow,
          });
    }
    p.add(G.sphere(R * 0.16, 8, 6), "metal", { c: C.bucket });
    p.add(G.cone(R * 0.1, R * 0.18, 8), "ice", { p: [0, 0, R * 0.2], r: [Math.PI / 2, 0, 0], c: C.iceL });
    spin.add(p.build());
    const q = K.part(key + ":cage");
    q.add(G.torus(R * 1.02, R * 0.045, 3, 18), "metal", { c: frost ? C.frost : C.bucket });
    q.add(G.torus(R * 0.94, R * 0.02, 3, 18), "glow", { c: C.glow });
    for (let i = 0; i < 2; i++) q.add(G.box(R * 2, R * 0.035, R * 0.035), "metal", { r: [0, 0, (i * Math.PI) / 2 + Math.PI / 4], p: [0, 0, -0.06], c: C.bucket });
    holder.add(q.build());
    return { holder, spin };
  }
  /** Rafales : petits cristaux de neige qui partent de la bouche. */
  function gusts(parent, key, n, size) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const p = K.part(key + ":gust");
      p.add(G.oct(size), "glow", { c: "#f2fdff" });
      const m = p.build();
      m.userData.noBounds = true;
      parent.add(m);
      out.push(m);
    }
    return out;
  }
  function animGusts(list, t, speed, len, spread, boost, seed) {
    for (let i = 0; i < list.length; i++) {
      const ph = (t * speed + i / list.length) % 1;
      const m = list[i];
      const a = i * 2.39996 + seed;
      m.position.set(Math.sin(a) * spread * (0.3 + ph), Math.cos(a) * spread * 0.6 * (0.3 + ph) + Math.sin(ph * 9 + i) * 0.04, ph * len);
      m.rotation.set(ph * 6 + i, ph * 4, 0);
      m.scale.setScalar(Math.max(0.001, Math.sin(ph * Math.PI) * (1 + boost)));
    }
  }

  /* ---------------------------------------------------------------- I · Obélisque givré */
  K.defTower("ice1", {
    windup: 0.3,
    fireDur: 0.55,
    ringR: 1.25,
    haloR: 1.25,
    recoil: 2.5,
    build(c) {
      const ice = c.inst("ice");
      const b = K.part("i1:base");
      b.add(G.cyl(0.7, 0.78, 0.28, 6), "blocks", { p: [0, 0.14, 0], r: [0, Math.PI / 6, 0], c: C.stone, uv: [3.4, 0.6], ao: 0.5, aoH: 0.35 });
      b.add(G.cyl(0.5, 0.56, 0.12, 6), "blocks", { p: [0, 0.34, 0], r: [0, Math.PI / 6, 0], c: C.stoneL, uv: [2.5, 0.25] });
      runeRing(b, 0.84, 1.08, 0.02, 40);
      snowCaps(b, [
        [0.48, 0.29, 0.22, 0.17],
        [-0.34, 0.29, -0.44, 0.15],
        [-0.52, 0.29, 0.16, 0.13],
      ]);
      shards(b, 5, 0.97, 0.02, 3, 1.1);
      c.root.add(b.build());
      const float = K.node(c.yaw, 0, 0.45, 0);
      const cp = K.part("i1:crystal");
      cp.add(G.crystal(0.29, 0.68, 6, 0.38, 0.22, 0.92), "ice", { p: [0, 0.3, 0], g: [C.iceD, C.iceL, 0.1, 1.3] });
      for (const sx of [-1, 1]) cp.add(G.crystal(0.11, 0.26, 5, 0.15, 0.06, 0.9), "ice", { p: [sx * 0.25, 0.42, -0.06], r: [0, 0, -sx * 0.55], g: [C.iceD, C.iceL, 0.4, 0.8] });
      cp.add(G.crystal(0.08, 0.16, 5, 0.1, 0.04, 0.9), "ice", { p: [0.05, 0.3, -0.2], r: [-0.6, 0, 0.2], g: [C.iceD, C.iceL, 0.3, 0.5] });
      // Moue boudeuse.
      cp.add(G.torus(0.055, 0.014, 4, 8, Math.PI), "matte", { p: [0, 0.5, 0.258], c: C.navy });
      float.add(cp.build({ mats: { ice } }));
      const face = c.face(float, { key: "i1", p: [0, 0.7, 0.232], gap: 0.115, eye: 0.085, skin: "#cdeaff", lidMat: "iceSoft", brow: C.navy, slant: 0.42, rest: 0.08, browY: 1.35 });
      // Flocons en orbite.
      const orbit = K.node(c.yaw, 0, 0.45, 0);
      const flakes = [];
      for (let i = 0; i < 3; i++) {
        const fp = K.part("i1:flake");
        fp.add(G.flake(0.08), "glow", { c: "#e9fbff" });
        const m = fp.build();
        m.userData.noBounds = true;
        orbit.add(m);
        flakes.push(m);
      }
      const spr = K.fx.sprite(C.glow, 0.9, 0.55);
      spr.position.set(0, 0.95, 0);
      float.add(spr);
      c.muzzle(float, 0, 1.1, 0.25);
      return {
        pose(st, dt) {
          const t = st.t + st.phase;
          const w = easeInOut(st.w);
          const rec = st.recoil.x;
          float.position.y = 0.45 + Math.sin(t * 1.7) * 0.04 + w * 0.14 + rec * 0.6 + bump(1 - st.fidget) * 0.05;
          const sy = 1 + w * 0.1 + rec * 0.6;
          float.scale.set(1 - w * 0.04 - rec * 0.3, sy, 1 - w * 0.04 - rec * 0.3);
          float.rotation.z = Math.sin(t * 1.1) * 0.03;
          ice.emissiveIntensity = 0.3 + Math.sin(t * 2.3) * 0.06 + w * 0.9 + st.flash * 1.4;
          spr.scale.setScalar(0.7 + w * 0.7 + st.flash * 1.2);
          orbit.rotation.y = t * 0.9 + st.fire * 3;
          const burst = Math.sqrt(st.fire) * 0.3;
          for (let i = 0; i < 3; i++) {
            const a = (i / 3) * TAU;
            const r = 0.46 + burst + w * 0.05;
            flakes[i].position.set(Math.sin(a) * r, 0.4 + i * 0.28 + Math.sin(t * 2 + i) * 0.05, Math.cos(a) * r);
            flakes[i].rotation.set(0.3, -orbit.rotation.y - a, t * 1.5 + i);
          }
          face.setOpen(st.fire > 0.25 ? 1 : -w * 1.2);
          face.look(st.w > 0.05 || st.fire > 0 ? 0 : null, 0);
        },
      };
    },
  });

  /* ---------------------------------------------------------------- II-A · Crypte du gel */
  K.defTower("ice2A", {
    windup: 0.35,
    fireDur: 0.7,
    ringR: 1.5,
    haloR: 1.45,
    recoil: 2.2,
    build(c) {
      const ice = c.inst("ice");
      const glow = c.inst("glow");
      const b = K.part("i2a:base");
      b.add(G.cyl(1.25, 1.32, 0.18, 16), "blocks", { p: [0, 0.09, 0], c: C.stone, uv: [7, 0.4], ao: 0.5, aoH: 0.25 });
      runeRing(b, 1.33, 1.52, 0.02, 44);
      snowCaps(b, [
        [1.0, 0.18, 0.45, 0.2],
        [-0.9, 0.18, -0.7, 0.22],
      ]);
      c.root.add(b.build());
      const crypt = K.node(c.yaw, 0, 0.18, 0);
      const p = K.part("i2a:crypt");
      p.add(G.box(1.62, 0.12, 1.52), "blocks", { p: [0, 0.06, -0.05], c: C.stoneD, uv: "box", tile: 1.4 });
      p.add(G.rbox(1.48, 1.2, 1.38, 0.04), "blocks", { p: [0, 0.72, -0.05], c: C.stone, uv: "box", tile: 1.3, ao: 0.6, aoH: 0.7 });
      for (const sx of [-1, 1])
        for (const sz of [-1, 1]) p.add(G.box(0.24, 1.36, 0.24), "blocks", { p: [sx * 0.74, 0.7, -0.05 + sz * 0.69], c: C.stoneL, uv: "box", tile: 1.2 });
      p.add(G.box(1.7, 0.1, 1.6), "blocks", { p: [0, 1.38, -0.05], c: C.stoneL, uv: "box", tile: 1.4 });
      // Toit en bâtière (faîtage avant-arrière), neige, pignon.
      for (const sx of [-1, 1]) {
        p.add(G.box(1.02, 0.08, 1.76), "slate", { p: [sx * 0.42, 1.72, -0.05], r: [0, 0, -sx * 0.62], c: "#8ea3c0", uv: "box", tile: 1.1 });
        p.add(G.box(0.86, 0.06, 1.66), "snow", { p: [sx * 0.37, 1.8, -0.05], r: [0, 0, -sx * 0.62], c: C.snow });
      }
      const tri = [
        [-0.8, 0],
        [0.8, 0],
        [0, 0.56],
      ];
      p.add(G.extrude("i2a:ped", tri, 0.12, 0), "blocks", { p: [0, 1.43, 0.62], c: C.stoneL, uv: "box", tile: 1 });
      p.add(G.extrude("i2a:pedb", tri, 0.12, 0), "blocks", { p: [0, 1.43, -0.72], c: C.stoneL, uv: "box", tile: 1 });
      // Arc de la porte.
      p.add(G.torus(0.42, 0.07, 5, 12, Math.PI), "blocks", { p: [0, 0.98, 0.66], c: C.stoneL, uv: [2, 0.3] });
      for (const sx of [-1, 1]) p.add(G.box(0.14, 0.86, 0.14), "blocks", { p: [sx * 0.42, 0.55, 0.66], c: C.stoneL, uv: "box" });
      p.add(G.box(0.72, 0.84, 0.08), "matte", { p: [0, 0.56, 0.6], c: C.void });
      p.add(G.sphere(0.36, 10, 5, 0, Math.PI / 2), "matte", { p: [0, 0.97, 0.6], s: [1, 1, 0.2], r: [Math.PI / 2, 0, 0], c: C.void });
      // Stalactites.
      for (let i = 0; i < 6; i++) p.add(G.cone(0.04, 0.16 + (i % 3) * 0.07, 5), "ice", { p: [-0.7 + i * 0.28, 1.28 - (i % 3) * 0.03, 0.72], r: [Math.PI, 0, 0], c: C.iceL });
      p.add(G.crystal(0.08, 0.2, 5, 0.18, 0.05), "ice", { p: [0, 2.0, 0.64], g: [C.iceD, C.iceL, 0, 0.4] });
      crypt.add(p.build({ mats: { ice } }));
      // Vantaux.
      const doors = [];
      for (const sx of [-1, 1]) {
        const hinge = K.node(crypt, sx * 0.35, 0.14, 0.66);
        const dp = K.part("i2a:door");
        dp.add(G.box(0.35, 0.84, 0.06), "iron", { p: [0.175, 0.42, 0], c: "#5d7fae", uv: [0.5, 1] });
        for (const [dx, dy, a] of [
          [-0.055, 0.055, -0.785],
          [0.055, 0.055, 0.785],
          [-0.055, -0.055, 0.785],
          [0.055, -0.055, -0.785],
        ])
          dp.add(G.box(0.03, 0.17, 0.02), "glow", { p: [0.19 + dx, 0.5 + dy, 0.035], r: [0, 0, a], c: C.glow });
        dp.add(G.box(0.05, 0.05, 0.02), "glow", { p: [0.19, 0.5, 0.035], r: [0, 0, 0.785], c: C.glow });
        dp.add(G.torus(0.04, 0.012, 3, 8), "metal", { p: [0.3, 0.42, 0.045], c: C.silver });
        const d = dp.build({ mats: { glow } });
        d.scale.set(-sx, 1, 1);
        hinge.add(d);
        doors.push(hinge);
      }
      // Pic de glace (caché derrière les portes).
      const spike = K.node(crypt, 0, 0.56, -0.5);
      const sp = K.part("i2a:spike");
      sp.add(G.crystal(0.14, 0.72, 6, 0.42, 0.05, 0.85), "ice", { r: [Math.PI / 2, 0, 0], g: [C.iceD, C.iceL, 0, 1.1] });
      spike.add(sp.build({ mats: { ice } }));
      const tip = c.muzzle(spike, 0, 0, 1.15);
      void tip;
      const face = c.face(crypt, { key: "i2a", p: [0, 1.62, 0.64], gap: 0.2, eye: 0.1, skin: C.stoneL, brow: C.navy, slant: 0.42, rest: 0.05, white: "#eefcff" });
      const spr = K.fx.sprite(C.glow, 1.0, 0.7);
      spr.position.set(0, 0.56, 0.7);
      crypt.add(spr);
      const door = new Spring(160, 13, 0);
      let thrust = 0;
      return {
        pose(st, dt) {
          const t = st.t + st.phase;
          const w = easeInOut(st.w);
          door.target = st.w > 0.02 || st.fire > 0.25 || st.pulse > 0.3 ? 1 : 0;
          door.step(dt);
          const rattle = bump(1 - st.fidget) * Math.sin(t * 40) * 0.05;
          doors[0].rotation.y = -door.x * 1.35 - Math.abs(rattle);
          doors[1].rotation.y = door.x * 1.35 + Math.abs(rattle);
          const tgt = Math.pow(st.fire, 0.35) * 0.95 + st.pulse * 0.4 - w * 0.12;
          thrust = damp(thrust, tgt, st.fire > 0.85 ? 40 : 10, dt);
          spike.position.z = -0.5 + thrust;
          ice.emissiveIntensity = 0.3 + w * 0.9 + st.flash * 1.3 + Math.sin(t * 2) * 0.05;
          glow.color.setScalar(1 + Math.sin(t * 2.2) * 0.2 + w * 0.8 + st.flash);
          spr.scale.setScalar(door.x * (0.7 + w * 0.6 + st.flash));
          crypt.position.z = st.recoil.x * 0.4;
          face.setOpen(st.fire > 0.3 ? 1 : -w * 1.2);
          face.look(st.w > 0.05 ? 0 : null, -0.2);
        },
      };
    },
  });

  /* ---------------------------------------------------------------- III-A · Trône du zéro absolu */
  K.defTower("ice3A", {
    windup: 0.45,
    fireDur: 1.6,
    ringR: 1.95,
    haloR: 1.95,
    recoil: 1.6,
    build(c) {
      const ice = c.inst("ice");
      const b = K.part("i3a:base");
      b.add(G.cyl(1.75, 1.85, 0.2, 22), "blocks", { p: [0, 0.1, 0], c: C.stone, uv: [10, 0.4], ao: 0.5, aoH: 0.3 });
      b.add(G.cyl(1.45, 1.55, 0.18, 22), "blocks", { p: [0, 0.29, 0], c: C.stoneL, uv: [8, 0.35] });
      runeRing(b, 1.52, 1.74, 0.201, 44);
      shards(b, 7, 1.6, 0.2, 7, 1.3);
      snowCaps(b, [
        [1.2, 0.38, 0.6, 0.2],
        [-1.1, 0.38, 0.5, 0.18],
        [0.3, 0.38, -1.2, 0.22],
      ]);
      c.root.add(b.build());
      const throne = K.node(c.yaw, 0, 0.38, 0);
      const p = K.part("i3a:throne");
      p.add(G.rbox(1.3, 0.46, 0.9, 0.06), "blocks", { p: [0, 0.23, -0.55], c: C.stone, uv: "box", tile: 1.2 });
      p.add(G.rbox(1.4, 2.12, 0.3, 0.07), "blocks", { p: [0, 1.24, -1.0], c: C.stone, uv: "box", tile: 1.1 });
      p.add(G.rbox(1.02, 1.2, 0.08, 0.04), "ice", { p: [0, 1.05, -0.84], g: [C.iceD, "#7fd0ff", 0.4, 1.6] });
      p.add(G.box(1.5, 0.14, 0.4), "blocks", { p: [0, 2.28, -1.0], c: C.stoneL, uv: "box" });
      p.add(G.rbox(1.5, 0.2, 0.42, 0.05), "blocks", { p: [0, 0.18, -0.98], c: C.stoneD, uv: "box" });
      // Couronne de cristaux sur le dossier.
      const crown = [
        [-0.55, 0.45],
        [-0.28, 0.72],
        [0, 1.0],
        [0.28, 0.72],
        [0.55, 0.45],
      ];
      for (const [x, h] of crown) p.add(G.crystal(0.12, h * 0.55, 6, h * 0.45, 0.05, 0.85), "ice", { p: [x, 2.32, -1.0], r: [0, 0, -x * 0.35], g: [C.iceD, C.iceL, 0, h] });
      for (const sx of [-1, 1]) {
        p.add(G.rbox(0.24, 0.36, 0.86, 0.05), "blocks", { p: [sx * 0.66, 0.62, -0.5], c: C.stoneL, uv: "box" });
        p.add(G.sphere(0.13, 10, 7), "iceSoft", { p: [sx * 0.66, 0.9, -0.1], c: C.iceL });
      }
      throne.add(p.build({ mats: { ice } }));
      const face = c.face(throne, { key: "i3a", p: [0, 1.9, -0.88], gap: 0.25, eye: 0.14, skin: C.stoneL, lidMat: "matte", brow: C.navy, browT: 0.05, slant: 0.5, rest: 0.12 });
      // Main de glace.
      const arm = K.node(throne, 0, 0.45, 0.15);
      const ap = K.part("i3a:arm");
      ap.add(G.crystal(0.17, 0.72, 6, 0.0, 0.1, 0.8), "ice", { g: [C.iceD, "#9fdcff", 0, 0.7] });
      ap.add(G.torus(0.17, 0.05, 4, 10), "metal", { p: [0, 0.64, 0], r: [Math.PI / 2, 0, 0], c: C.silver });
      arm.add(ap.build({ mats: { ice } }));
      const hand = K.node(arm, 0, 0.68, 0);
      hand.scale.setScalar(1.25);
      const hp = K.part("i3a:palm");
      hp.add(G.rbox(0.6, 0.6, 0.22, 0.09, 1), "ice", { p: [0, 0.32, 0], g: ["#3f95e6", "#9fdcff", 0, 0.62] });
      hand.add(hp.build({ mats: { ice } }));
      const fingers = [];
      const fx = [-0.21, -0.07, 0.07, 0.21];
      const fl = [1, 1.12, 1.06, 0.9];
      for (let i = 0; i < 5; i++) {
        const thumb = i === 4;
        const base = thumb ? K.node(hand, -0.3, 0.26, 0.02) : K.node(hand, fx[i], 0.6, 0);
        if (thumb) base.rotation.z = 0.9;
        const s1 = K.node(base, 0, 0, 0);
        const s2 = K.node(s1, 0, 0.24 * (thumb ? 0.8 : fl[i]), 0);
        const f1 = K.part("i3a:f1");
        f1.add(G.capsule(0.068, 0.2, 6, 2), "ice", { p: [0, 0.12, 0], g: ["#5aa8ee", "#9fdcff", 0, 0.24] });
        const f2 = K.part("i3a:f2");
        f2.add(G.capsule(0.06, 0.13, 6, 2), "ice", { p: [0, 0.09, 0], g: ["#8fd2ff", "#dff7ff", 0, 0.2] });
        f2.add(G.cone(0.045, 0.1, 5), "ice", { p: [0, 0.22, 0], c: "#ffffff" });
        const m1 = f1.build({ mats: { ice } });
        m1.scale.y = thumb ? 0.8 : fl[i];
        s1.add(m1);
        const m2 = f2.build({ mats: { ice } });
        m2.scale.y = thumb ? 0.85 : fl[i];
        s2.add(m2);
        fingers.push({ s1, s2, thumb, i });
      }
      // Glaçon qui apparaît dans le poing.
      const cube = K.node(hand, 0, 0.45, 0.28);
      const cb = K.part("i3a:cube");
      cb.add(G.rbox(0.36, 0.36, 0.36, 0.04), "ice", { g: ["#6fc2ff", C.iceL, -0.2, 0.2] });
      cube.add(cb.build({ mats: { ice } }));
      cube.scale.setScalar(0.001);
      c.muzzle(hand, 0, 0.35, 0.2);
      // Éclats en orbite.
      const orbit = K.node(c.yaw, 0, 2.6, -0.3);
      const bits = [];
      for (let i = 0; i < 4; i++) {
        const bp = K.part("i3a:bit");
        bp.add(G.crystal(0.07, 0.18, 5, 0.12, 0.1), "ice", { g: [C.iceD, C.iceL, -0.1, 0.3] });
        const m = bp.build({ mats: { ice } });
        m.userData.noBounds = true;
        orbit.add(m);
        bits.push(m);
      }
      const spr = K.fx.sprite(C.glow, 1.0, 0.35);
      spr.position.set(0, 0.35, 0.25);
      hand.add(spr);
      let grab = 0;
      return {
        pose(st, dt) {
          const t = st.t + st.phase;
          const w = easeInOut(st.w);
          // Saisie : fermeture rapide, maintien, réouverture.
          const g = st.fire > 0 ? (st.fire > 0.85 ? 1 - (st.fire - 0.85) / 0.15 : st.fire > 0.3 ? 1 : st.fire / 0.3) : 0;
          grab = damp(grab, g, 20, dt);
          arm.rotation.x = 0.12 + Math.sin(t * 1.2) * 0.04 - w * 0.35 + grab * 0.75 + st.recoil.x * 0.3;
          hand.rotation.x = -0.15 - w * 0.2 + grab * 0.35;
          hand.position.y = 0.68 + Math.sin(t * 1.5) * 0.03;
          for (let k = 0; k < 5; k++) {
            const f = fingers[k];
            const wave = Math.sin(t * 2 - k * 0.6) * 0.12;
            const spread = w * 0.25;
            if (f.thumb) {
              f.s1.rotation.set(grab * 0.9, -grab * 0.9, -spread);
              f.s2.rotation.x = grab * 0.9;
            } else {
              f.s1.rotation.set(0.1 + wave - w * 0.35 + grab * 1.35, 0, (f.i - 1.5) * (0.08 + spread));
              f.s2.rotation.x = 0.15 + wave * 0.6 - w * 0.2 + grab * 1.5;
            }
          }
          cube.scale.setScalar(Math.max(0.001, grab > 0.6 ? easeOut((grab - 0.6) / 0.4) : 0));
          ice.emissiveIntensity = 0.3 + w * 0.8 + st.flash * 1.2 + Math.sin(t * 1.9) * 0.05;
          spr.scale.setScalar(0.6 + w * 0.8 + st.flash * 1.2);
          orbit.rotation.y = t * 0.6;
          for (let i = 0; i < 4; i++) {
            const a = (i / 4) * TAU;
            bits[i].position.set(Math.sin(a) * 1.25, Math.sin(t * 1.4 + i * 1.7) * 0.15, Math.cos(a) * 1.25);
            bits[i].rotation.set(t + i, t * 0.7, 0.4);
          }
          face.setOpen(grab > 0.5 ? 0.8 : -w * 1.2);
          face.look(st.w > 0.05 || grab > 0.2 ? 0 : null, -0.3);
        },
      };
    },
  });

  /* ---------------------------------------------------------------- II-B · Souffleur de blizzard */
  K.defTower("ice2B", {
    windup: 0.35,
    fireDur: 0.6,
    pulseDur: 0.3,
    ringR: 1.4,
    haloR: 1.4,
    recoil: 2.2,
    build(c) {
      const b = K.part("i2b:base");
      b.add(G.cyl(0.95, 1.0, 0.22, 16), "blocks", { p: [0, 0.11, 0], c: C.stone, uv: [5, 0.4], ao: 0.5, aoH: 0.3 });
      b.add(G.blob(0.92, 1, 0.08, 4), "snow", { p: [0, 0.22, 0], s: [1, 0.16, 1], c: C.snow });
      runeRing(b, 1.02, 1.22, 0.02, 40);
      c.root.add(b.build());
      const man = K.node(c.yaw, 0, 0.22, 0);
      const p = K.part("i2b:man");
      p.add(G.sphere(0.55, 12, 9), "snow", { p: [0, 0.46, 0], s: [1, 0.86, 1], c: C.snow, g: ["#c9dcf2", C.snow, 0.0, 0.6] });
      p.add(G.sphere(0.42, 12, 9), "snow", { p: [0, 1.06, 0], s: [1, 0.92, 1], c: C.snow });
      for (let i = 0; i < 3; i++) p.add(G.ico(0.045, 0), "matte", { p: [0, 0.88 + i * 0.16, 0.405 - Math.abs(i - 1) * 0.02], c: C.coal });
      p.add(G.torus(0.3, 0.075, 5, 14), "satin", { p: [0, 1.36, 0], r: [Math.PI / 2, 0, 0], c: C.scarf });
      // Bras en bâtons qui tiennent le manche du ventilateur.
      for (const sx of [-1, 1]) {
        p.add(
          G.tube(
            "i2b:arm",
            [
              [0, 0, 0],
              [0.14, 0.03, 0.16],
              [0.04, -0.06, 0.4],
              [-0.24, -0.12, 0.5],
            ],
            [0.035, 0.022],
            6,
            4,
          ),
          "bark",
          { p: [sx * 0.36, 1.1, 0.05], s: [sx, 1, 1], c: C.stick },
        );
        p.add(G.cone(0.015, 0.12, 4), "bark", { p: [sx * 0.14, 1.0, 0.6], r: [1.2, 0, sx * 0.5], c: C.stick });
      }
      man.add(p.build());
      // Écharpe qui claque au vent.
      const tail = K.node(man, 0.14, 1.34, 0.25);
      const tp = K.part("i2b:tail");
      tp.add(G.rbox(0.13, 0.38, 0.04, 0.018), "satin", { p: [0, -0.17, 0], c: C.scarf });
      tp.add(G.box(0.13, 0.03, 0.045), "satin", { p: [0, -0.26, 0], c: "#ffffff" });
      tail.add(tp.build());
      // Tête (tourne un peu, penche en colère).
      const head = K.node(man, 0, 1.62, 0);
      const hp = K.part("i2b:head");
      hp.add(G.sphere(0.32, 12, 9), "snow", { c: C.snow });
      hp.add(G.cone(0.055, 0.32, 6), "satin", { p: [0, -0.02, 0.44], r: [Math.PI / 2, 0, 0], c: C.carrot });
      for (let i = 0; i < 5; i++) {
        const a = (i - 2) * 0.28;
        hp.add(G.ico(0.024, 0), "matte", { p: [Math.sin(a) * 0.2, -0.16 + Math.abs(i - 2) * -0.025, Math.cos(a) * 0.27], c: C.coal });
      }
      hp.add(G.cyl(0.21, 0.25, 0.24, 12), "metal", { p: [0.02, 0.33, -0.02], r: [-0.1, 0, -0.18], c: C.bucket });
      hp.add(G.torus(0.235, 0.022, 3, 12), "metal", { p: [0.0, 0.25, -0.01], r: [Math.PI / 2 - 0.1, 0, -0.18], c: C.silver });
      head.add(hp.build());
      const face = c.face(head, { key: "i2b", p: [0, 0.07, 0.26], r: [0, 0, 0], gap: 0.11, eye: 0.08, skin: C.snow, lidMat: "snow", brow: C.coal, browT: 0.028, slant: 0.55, rest: 0.1, browY: 1.2 });
      // Ventilateur magique.
      const F = fan(man, "i2b:fan", 0.52, 4, false);
      F.holder.position.set(0, 1.0, 0.72);
      const hdl = K.part("i2b:handle");
      hdl.add(G.cyl(0.025, 0.025, 0.36, 6), "metal", { p: [0, -0.05, -0.2], r: [Math.PI / 2 - 0.5, 0, 0], c: C.stick });
      F.holder.add(hdl.build());
      const gl = gusts(F.holder, "i2b", 6, 0.05);
      const spr = K.fx.sprite(C.glow, 1.1, 0.4);
      spr.position.set(0, 0, 0.15);
      F.holder.add(spr);
      c.muzzle(F.holder, 0, 0, 0.3);
      let spin = 0;
      return {
        pose(st, dt) {
          const t = st.t + st.phase;
          const w = easeInOut(st.w);
          const f = Math.max(st.fire, st.pulse);
          spin += dt * (4 + w * 16 + f * 26 + st.frenzy * 6);
          F.spin.rotation.z = -spin;
          man.rotation.x = -w * 0.14 + f * 0.1 + st.recoil.x * 0.25;
          man.rotation.z = Math.sin(t * 1.3) * 0.03;
          man.position.y = 0.22 + Math.abs(Math.sin(t * 2.2)) * 0.02 + bump(1 - st.fidget) * 0.06;
          head.rotation.set(-w * 0.15 + f * 0.1, Math.sin(t * 0.7) * 0.15 * (1 - w), Math.sin(t * 1.1) * 0.06);
          tail.rotation.set(-0.3 - f * 0.9 - Math.abs(Math.sin(t * 7)) * 0.2, 0, Math.sin(t * 5) * 0.2);
          F.holder.position.z = 0.72 + st.recoil.x * 0.3;
          animGusts(gl, t, 1.1 + f * 2.5 + w, 1.6 + f * 1.2, 0.35, f * 1.5, 0);
          spr.scale.setScalar(0.6 + w * 0.5 + f * 1.2);
          face.setOpen(f > 0.4 ? -0.4 : -w * 1.3 + 0.1);
          face.look(st.w > 0.05 || f > 0 ? 0 : null, 0);
        },
      };
    },
  });

  /* ---------------------------------------------------------------- III-B · Tempête polaire */
  K.defTower("ice3B", {
    windup: 0.45,
    fireDur: 0.8,
    pulseDur: 0.35,
    ringR: 1.9,
    haloR: 1.9,
    recoil: 2,
    build(c) {
      const cloudMat = c.inst("snow");
      const glow = c.inst("glow");
      const b = K.part("i3b:base");
      b.add(G.cyl(1.35, 1.45, 0.3, 18), "blocks", { p: [0, 0.15, 0], c: C.stone, uv: [8, 0.5], ao: 0.5, aoH: 0.4 });
      b.add(G.blob(1.3, 1, 0.08, 6), "snow", { p: [0, 0.3, 0], s: [1, 0.12, 1], c: C.snow });
      runeRing(b, 1.48, 1.72, 0.02, 44);
      shards(b, 6, 1.5, 0.02, 11, 1.2);
      c.root.add(b.build());
      const tower = K.node(c.yaw, 0, 0.3, 0);
      const p = K.part("i3b:col");
      p.add(G.cyl(0.46, 0.6, 1.8, 12), "blocks", { p: [0, 0.9, 0], c: C.stone, uv: [3, 1.8], ao: 0.6, aoH: 0.8 });
      p.add(G.cyl(0.62, 0.5, 0.18, 12), "blocks", { p: [0, 1.88, 0], c: C.stoneL, uv: [3, 0.2] });
      p.add(G.cyl(0.66, 0.66, 0.08, 12), "snow", { p: [0, 2.0, 0], c: C.snow });
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU + 0.4;
        p.add(G.crystal(0.1, 0.3, 5, 0.18, 0.05), "ice", { p: [Math.sin(a) * 0.5, 0.5 + (i % 3) * 0.4, Math.cos(a) * 0.5], r: [Math.cos(a) * 0.9, 0, -Math.sin(a) * 0.9], g: [C.iceD, C.iceL, 0, 0.45] });
      }
      tower.add(p.build());
      const F = fan(tower, "i3b:fan", 0.9, 5, true);
      F.holder.position.set(0, 1.25, 0.72);
      const mount = K.part("i3b:mount");
      mount.add(G.cyl(0.07, 0.07, 0.3, 8), "metal", { p: [0, 0, -0.18], r: [Math.PI / 2, 0, 0], c: C.silver });
      F.holder.add(mount.build());
      const gl = gusts(F.holder, "i3b", 8, 0.07);
      // Nuage tourbillonnant.
      const cloud = K.node(c.yaw, 0, 3.0, 0);
      const swirl = K.node(cloud, 0, 0, 0);
      const cp = K.part("i3b:cloud");
      // Cœur fixe (porte le visage) + bourrelets qui tournoient au-dessus et au-dessous.
      const core = K.part("i3b:core");
      core.add(G.blob(0.62, 2, 0.08, 79), "snow", { g: ["#8fa6c6", "#f7fbff", -0.5, 0.5] });
      core.add(G.blob(0.42, 1, 0.1, 78), "snow", { p: [0, 0.48, -0.05], g: ["#c6d4e8", "#ffffff", 0.2, 0.8] });
      cloud.add(core.build({ mats: { snow: cloudMat } }));
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * TAU;
        const up = i % 2 === 0;
        cp.add(G.blob(up ? 0.36 : 0.32, 1, 0.12, 80 + i), "snow", {
          p: [Math.sin(a) * 0.78, up ? 0.36 : -0.34, Math.cos(a) * 0.78],
          g: ["#8fa6c6", "#f7fbff", -0.4, 0.4],
        });
      }
      swirl.add(cp.build({ mats: { snow: cloudMat } }));
      const face = c.face(cloud, { key: "i3b", p: [0, 0.0, 0.56], gap: 0.22, eye: 0.15, skin: "#d7e4f4", lidMat: "snow", brow: C.navy, browT: 0.05, slant: 0.55, rest: 0.12 });
      // Éclair (visible pendant le tir).
      const bolt = K.node(cloud, 0.25, -0.35, 0.35);
      const bp = K.part("i3b:bolt");
      bp.add(
        G.extrude(
          "i3b:bolt",
          [
            [0, 0],
            [0.12, -0.3],
            [0.04, -0.3],
            [0.14, -0.72],
            [-0.06, -0.24],
            [0.03, -0.24],
            [-0.08, 0],
          ],
          0.04,
          0,
        ),
        "glow",
        { c: "#e9fdff", s: 1.3 },
      );
      bolt.add(bp.build({ mats: { glow } }));
      bolt.visible = false;
      bolt.userData.noBounds = true;
      // Grêle.
      const hail = [];
      for (let k = 0; k < 2; k++) {
        const hn = K.node(c.yaw, 0, 0, 0);
        const hp = K.part("i3b:hail" + k);
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * TAU + k * 1.05;
          hp.add(G.ico(0.06, 0), "iceSoft", { p: [Math.sin(a) * (0.95 + i * 0.12), 0, Math.cos(a) * (0.95 + i * 0.12)], c: C.iceL });
        }
        const m = hp.build();
        m.userData.noBounds = true;
        hn.add(m);
        hail.push(hn);
      }
      const spr = K.fx.sprite(C.glow, 2.2, 0.45);
      cloud.add(spr);
      c.muzzle(F.holder, 0, 0, 0.3);
      let spin = 0;
      return {
        pose(st, dt) {
          const t = st.t + st.phase;
          const w = easeInOut(st.w);
          const f = Math.max(st.fire, st.pulse);
          spin += dt * (3 + w * 14 + f * 22 + st.frenzy * 5);
          F.spin.rotation.z = -spin;
          F.holder.position.z = 0.72 + st.recoil.x * 0.25;
          swirl.rotation.y = t * (0.5 + w * 1.5 + f * 2);
          cloud.position.y = 3.0 + Math.sin(t * 1.2) * 0.08 + w * 0.1;
          const puff = 1 + w * 0.12 + st.flash * 0.1 + Math.sin(t * 2) * 0.02;
          cloud.scale.set(puff, puff * (1 - w * 0.05), puff);
          cloudMat.emissiveIntensity = 0.14 + w * 0.25 + st.flash * 0.9;
          glow.color.setScalar(1.2 + st.flash);
          bolt.visible = st.flash > 0.25 && Math.sin(t * 45) > -0.3;
          spr.scale.setScalar(1.2 + st.flash * 2.5 + w * 0.6);
          for (let k = 0; k < 2; k++) {
            const ph = (t * (0.7 + f * 0.8) + k * 0.5) % 1;
            hail[k].position.y = lerp(2.6, 0.35, ph * ph);
            hail[k].rotation.y = t * 0.3 + k;
            const s = ph < 0.9 ? 1 : 1 - (ph - 0.9) * 10;
            hail[k].scale.setScalar(Math.max(0.001, s));
          }
          animGusts(gl, t, 1.0 + f * 2.2 + w, 2.0 + f * 1.5, 0.6, f * 1.2, 1);
          face.setOpen(st.fire > 0.3 ? 1 : -w * 1.3);
          face.look(st.w > 0.05 ? 0 : null, -0.35);
        },
      };
    },
  });

  void clamp;
})();
