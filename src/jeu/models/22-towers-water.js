// « Pas touche à mes trésors » — tours d'EAU (repousser, regrouper, seconde chance).
//
//  I     Gargouille cracheuse : petite gargouille qui gonfle les joues avant de cracher.
//  II-A  Bélier hydraulique   : deux grosses pompes et un canon qui tremble sous la pression.
//  III-A Canon tsunami        : énorme gueule de carpe qui libère une vague.
//  II-B  Fontaine siphon      : une fontaine qui aspire bruyamment l'eau (et les voleurs).
//  III-B Maelström glouton    : grand bassin vivant qui forme une spirale et recrache les trempés.
// Code couleur : turquoise / bleu sur bronze vert-de-gris et pierre moussue.
(function () {
  "use strict";
  const PTMT = globalThis.PTMT;
  if (!PTMT || !PTMT.models || !PTMT.models.kit) return;
  const K = PTMT.models.kit,
    G = K.g;
  const { TAU, clamp, lerp, damp, bump, easeInOut, wob } = K.math;
  const Spring = K.Spring;

  const C = {
    stone: "#9aa08a",
    stoneD: "#646c58",
    stoneL: "#b9bca6",
    moss: "#5f8a34",
    mossL: "#86a846",
    bronze: "#b8803e",
    bronzeD: "#6e4a22",
    verd: "#4fae98",
    verdL: "#8fd8c4",
    garg: "#a7b09b",
    gargD: "#6e7865",
    teal: "#43f2df",
    deep: "#06222b",
    fin: "#3fb8c8",
    finL: "#a8f4ff",
    lip: "#c98a5a",
    gauge: "#f3ecd8",
    red: "#d8322a",
    flesh: "#3e9f8f",
    fleshL: "#7fd6c2",
    bone: "#f4ecd6",
    wood: "#8a5a33",
  };

  /* ---------------------------------------------------------------- pièces communes */
  /** Vasque de pierre (paroi extérieure, lèvre, paroi intérieure jusqu'à l'eau). */
  function basin(p, key, R, H, wall, water, seg) {
    const prof = [
      [R * 0.95, 0],
      [R, 0.05],
      [R, H - 0.06],
      [R - 0.03, H],
      [R - wall + 0.03, H],
      [R - wall, H - 0.04],
      [R - wall, water - 0.06],
    ];
    p.add(G.lathe(key + ":basin", prof, seg || 18), "stone", { c: C.stone, uv: [R * 5, 0.8], ao: 0.55, aoH: H * 0.8 });
  }
  function mossPatches(p, pts) {
    pts.forEach((q, i) => p.add(G.blob(q[3], 0, 0.2, 90 + i), "matte", { p: [q[0], q[1], q[2]], s: [1.3, 0.35, 1], c: i % 2 ? C.moss : C.mossL, j: 0.15 }));
  }
  /** Gouttes / jet d'eau lumineux (sprite). */
  function splash(parent, x, y, z, size) {
    const s = K.fx.sprite(C.teal, size, 0.8);
    s.position.set(x, y, z);
    parent.add(s);
    return s;
  }

  /* ---------------------------------------------------------------- I · Gargouille cracheuse */
  K.defTower("water1", {
    windup: 0.34,
    fireDur: 0.55,
    ringR: 1.15,
    haloR: 1.2,
    recoil: 2.6,
    build(c) {
      const b = K.part("w1:base");
      basin(b, "w1", 0.92, 0.33, 0.14, 0.22, 18);
      b.add(G.ring(0.4, 0.8, 24, 3), "water", { p: [0, 0.21, 0] });
      b.add(G.cyl(0.36, 0.42, 0.78, 10), "stone", { p: [0, 0.39, 0], c: C.stoneL, uv: [2.5, 0.8] });
      b.add(G.torus(0.37, 0.035, 3, 14), "metal", { p: [0, 0.72, 0], r: [Math.PI / 2, 0, 0], c: C.bronze });
      mossPatches(b, [
        [0.7, 0.33, 0.45, 0.13],
        [-0.55, 0.33, -0.65, 0.15],
        [0.2, 0.78, -0.3, 0.12],
      ]);
      c.root.add(b.build());
      const garg = K.node(c.yaw, 0, 0.78, 0);
      const gp = K.part("w1:body");
      gp.add(G.sphere(0.3, 10, 8), "stone", { p: [0, 0.27, -0.06], s: [1.05, 0.9, 1], g: [C.gargD, C.garg, 0, 0.5], uv: [1.2, 1] });
      for (const sx of [-1, 1]) {
        gp.add(G.sphere(0.16, 8, 6), "stone", { p: [sx * 0.21, 0.13, -0.12], s: [0.9, 0.8, 1.2], c: C.garg, uv: [0.8, 0.8] });
        gp.add(G.sphere(0.085, 6, 5), "stone", { p: [sx * 0.15, 0.05, 0.22], s: [1, 0.8, 1.2], c: C.garg });
        for (const k of [-1, 0, 1]) gp.add(G.cone(0.02, 0.06, 4), "glossy", { p: [sx * 0.15 + k * 0.035, 0.03, 0.31], r: [Math.PI / 2 + 0.3, 0, 0], c: C.bone });
      }
      gp.add(
        G.tube(
          "w1:tail",
          [
            [0, 0.12, -0.3],
            [0.1, 0.06, -0.5],
            [0.28, 0.12, -0.58],
            [0.36, 0.3, -0.5],
          ],
          [0.06, 0.02],
          8,
          5,
        ),
        "stone",
        { c: C.gargD },
      );
      gp.add(G.cone(0.06, 0.12, 4), "stone", { p: [0.37, 0.36, -0.47], r: [0.3, 0, -0.3], c: C.gargD });
      garg.add(gp.build());
      // Ailes repliées.
      const wings = [];
      for (const sx of [-1, 1]) {
        const wn = K.node(garg, sx * 0.16, 0.42, -0.2);
        const wp = K.part("w1:wing");
        wp.add(
          G.extrude(
            "w1:wing",
            [
              [0, 0],
              [0.18, 0.2],
              [0.42, 0.28],
              [0.36, 0.14],
              [0.3, 0.02],
              [0.18, 0.06],
              [0.12, -0.08],
            ],
            0.03,
            0,
          ),
          "stone",
          { r: [0, -Math.PI / 2 + 0.5, 0], g: [C.gargD, C.garg, 0, 0.25] },
        );
        const wm = wp.build();
        wm.scale.set(sx, 1, 1);
        wn.add(wm);
        wings.push(wn);
      }
      // Tête, joues, bec-fontaine.
      const head = K.node(garg, 0, 0.6, 0.08);
      const hp = K.part("w1:head");
      hp.add(G.sphere(0.24, 10, 8), "stone", { s: [1.1, 0.95, 1], g: [C.gargD, C.garg, -0.2, 0.2], uv: [1, 1] });
      hp.add(G.rbox(0.2, 0.12, 0.16, 0.05), "stone", { p: [0, -0.07, 0.2], c: C.garg });
      for (const sx of [-1, 1]) {
        hp.add(G.cone(0.07, 0.2, 4), "stone", { p: [sx * 0.2, 0.18, -0.02], r: [0, 0, -sx * 0.7], c: C.gargD });
        hp.add(
          G.tube(
            "w1:horn",
            [
              [0, 0, 0],
              [0.03, 0.08, -0.05],
              [0.02, 0.14, -0.14],
            ],
            [0.03, 0.004],
            5,
            4,
          ),
          "glossy",
          { p: [sx * 0.09, 0.19, 0.02], s: [sx, 1, 1], c: C.bone },
        );
      }
      hp.add(G.cyl(0.05, 0.06, 0.22, 8, true), "metal", { p: [0, -0.08, 0.34], r: [Math.PI / 2 - 0.15, 0, 0], c: C.bronze });
      hp.add(G.torus(0.055, 0.018, 3, 10), "metal", { p: [0, -0.1, 0.45], r: [-0.15, 0, 0], c: C.bronze });
      hp.add(G.disc(0.045, 8), "water", { p: [0, -0.1, 0.44], r: [-0.15, 0, 0] });
      head.add(hp.build());
      const cheeks = K.node(head, 0, -0.07, 0.12);
      const cp = K.part("w1:cheeks");
      for (const sx of [-1, 1]) cp.add(G.sphere(0.1, 8, 6), "stone", { p: [sx * 0.14, 0, 0], c: "#a3ad9c" });
      cheeks.add(cp.build());
      const face = c.face(head, { key: "w1", p: [0, 0.08, 0.19], r: [-0.2, 0, 0], gap: 0.1, eye: 0.075, skin: C.garg, lidMat: "stone", brow: C.gargD, slant: 0.3, rest: 0.05 });
      // Filet d'eau qui bave du bec.
      const drib = K.part("w1:drib");
      drib.add(
        G.tube(
          "w1:drib",
          [
            [0, 0, 0],
            [0, -0.15, 0.12],
            [0, -0.5, 0.2],
            [0, -1.15, 0.24],
          ],
          [0.02, 0.012],
          8,
          4,
        ),
        "waterFx",
        {},
      );
      const dribble = drib.build();
      dribble.position.set(0, 0.5, 0.56);
      dribble.userData.noBounds = true;
      garg.add(dribble);
      const spr = splash(head, 0, -0.1, 0.5, 0.6);
      c.muzzle(head, 0, -0.1, 0.48);
      let puff = 0;
      return {
        pose(st, dt) {
          const t = st.t + st.phase;
          const w = easeInOut(st.w);
          const rec = st.recoil.x;
          const br = Math.sin(t * 2);
          garg.scale.set(1.15 * (1 + br * 0.015), 1.15 * (1 + br * 0.02 + w * 0.04), 1.15 * (1 + br * 0.015));
          head.position.set(0, 0.6 + Math.sin(t * 1.4) * 0.015 + w * 0.03, 0.08 - w * 0.06 + rec * 0.6);
          head.rotation.set(-w * 0.2 + st.fire * 0.25, Math.sin(t * 0.8) * 0.12 * (1 - w), Math.sin(t * 1.1) * 0.04);
          puff = damp(puff, st.fire > 0.05 ? -0.2 : w, st.fire > 0.05 ? 30 : 9, dt);
          const cs = 1 + Math.max(0, puff) * 0.95 + st.pulse * 0.3;
          cheeks.scale.set(cs, cs * 0.92, cs);
          const flap = bump(1 - st.fidget) * 0.7 + st.fire * 0.4 + Math.sin(t * 1.3) * 0.05;
          wings[0].rotation.set(0, -flap, flap * 0.3);
          wings[1].rotation.set(0, flap, -flap * 0.3);
          dribble.scale.set(1, 1 - st.fire * 0.8, 1);
          spr.scale.setScalar(0.3 + st.flash * 1.4 + w * 0.3);
          face.setOpen(st.fire > 0.2 ? -0.6 : w * 1.1);
          face.look(st.w > 0.05 ? 0 : null, 0);
        },
      };
    },
  });

  /* ---------------------------------------------------------------- II-A · Bélier hydraulique */
  K.defTower("water2A", {
    windup: 0.4,
    fireDur: 0.7,
    ringR: 1.45,
    haloR: 1.45,
    recoil: 3.4,
    build(c) {
      const b = K.part("w2a:base");
      b.add(G.cyl(1.2, 1.28, 0.28, 16), "stone", { p: [0, 0.14, 0], c: C.stone, uv: [7, 0.4], ao: 0.5, aoH: 0.3 });
      b.add(G.ring(1.0, 1.16, 32, 5), "water", { p: [0, 0.285, 0] });
      b.add(G.torus(1.24, 0.04, 3, 24), "metal", { p: [0, 0.27, 0], r: [Math.PI / 2, 0, 0], c: C.bronze });
      mossPatches(b, [
        [1.1, 0.26, 0.3, 0.14],
        [-0.8, 0.26, -0.8, 0.15],
      ]);
      c.root.add(b.build());
      const mach = K.node(c.yaw, 0, 0.28, 0);
      const mp = K.part("w2a:table");
      mp.add(G.cyl(0.9, 0.95, 0.1, 16), "metal", { p: [0, 0.05, 0], g: [C.bronzeD, C.bronze, 0, 0.1] });
      // Berceau du canon.
      for (const sx of [-1, 1]) mp.add(G.box(0.08, 0.7, 0.6), "wood", { p: [sx * 0.3, 0.45, 0.05], c: C.wood, uv: "box", tile: 0.8 });
      // Corps des pompes.
      for (const sx of [-1, 1]) {
        mp.add(G.cyl(0.25, 0.28, 1.25, 10), "metal", { p: [sx * 0.6, 0.72, -0.28], g: [C.verd, C.bronze, 0.1, 1.3], vj: 0.18, vs: 5 });
        mp.add(G.torus(0.265, 0.035, 3, 12), "metal", { p: [sx * 0.6, 0.4, -0.28], r: [Math.PI / 2, 0, 0], c: C.bronzeD });
        mp.add(G.sphere(0.25, 8, 3, 0, Math.PI / 2), "metal", { p: [sx * 0.6, 1.34, -0.28], c: C.bronze });
        // Manomètre.
        mp.add(G.disc(0.11, 12), "matte", { p: [sx * 0.6, 0.9, -0.02], c: C.gauge });
        mp.add(G.torus(0.115, 0.02, 3, 10), "metal", { p: [sx * 0.6, 0.9, -0.02], c: C.bronze });
        mp.add(G.disc(0.035, 6), "matte", { p: [sx * 0.6 + 0.05, 0.94, -0.015], c: C.red });
        // Tuyau vers la culasse.
        mp.add(
          G.tube(
            "w2a:pipe",
            [
              [0, 0, 0],
              [-0.05, -0.1, 0.2],
              [-0.3, -0.12, 0.3],
              [-0.45, -0.02, 0.28],
            ],
            [0.06, 0.06],
            8,
            5,
          ),
          "metal",
          { p: [sx * 0.6, 0.62, -0.1], s: [sx, 1, 1], c: C.bronzeD },
        );
      }
      mach.add(mp.build());
      // Aiguilles des manomètres.
      const needles = [];
      for (const sx of [-1, 1]) {
        const n = K.node(mach, sx * 0.6, 0.9, 0.0);
        const np = K.part("w2a:needle");
        np.add(G.box(0.014, 0.09, 0.01), "matte", { p: [0, 0.04, 0], c: C.red });
        n.add(np.build({ cast: false }));
        needles.push(n);
      }
      // Pistons.
      const rods = [];
      for (const sx of [-1, 1]) {
        const r = K.node(mach, sx * 0.6, 1.4, -0.28);
        const rp = K.part("w2a:rod");
        rp.add(G.cyl(0.045, 0.045, 0.5, 6), "metal", { p: [0, 0.05, 0], c: C.bronzeD });
        rp.add(G.cyl(0.13, 0.13, 0.07, 10), "metal", { p: [0, 0.3, 0], c: C.bronze });
        rp.add(G.sphere(0.05, 6, 4), "metal", { p: [0, 0.36, 0], c: C.bronze });
        r.add(rp.build());
        rods.push(r);
      }
      // Canon.
      const cannon = K.node(mach, 0, 0.8, 0.05);
      const bp = K.part("w2a:barrel");
      const prof = [
        [0.001, -0.46],
        [0.17, -0.46],
        [0.25, -0.38],
        [0.25, -0.12],
        [0.2, 0.3],
        [0.19, 0.55],
        [0.25, 0.62],
        [0.27, 0.7],
        [0.21, 0.73],
        [0.15, 0.66],
        [0.14, 0.45],
        [0.001, 0.45],
      ];
      bp.add(G.lathe("w2a:barrel", prof, 14), "metal", { r: [Math.PI / 2, 0, 0], g: [C.bronze, C.verd, -0.4, 0.7], vj: 0.15, vs: 5 });
      for (const z of [-0.3, 0.12]) bp.add(G.torus(z < 0 ? 0.255 : 0.21, 0.03, 3, 14), "metal", { p: [0, 0, z], c: C.bronzeD });
      bp.add(G.sphere(0.12, 8, 6), "metal", { p: [0, 0, -0.52], c: C.bronze });
      bp.add(G.disc(0.14, 12), "water", { p: [0, 0, 0.55] });
      bp.add(G.cyl(0.05, 0.05, 0.3, 8), "metal", { p: [0, 0, 0], r: [0, 0, Math.PI / 2], c: C.bronzeD });
      bp.add(G.cyl(0.04, 0.05, 0.14, 6), "metal", { p: [0, 0.26, -0.3], c: C.bronze });
      cannon.add(bp.build());
      const face = c.face(cannon, { key: "w2a", p: [0, 0.2, -0.12], r: [-0.2, 0, 0], gap: 0.1, eye: 0.08, skin: C.bronze, lidMat: "metal", brow: C.bronzeD, slant: -0.3, rest: -0.15, browTilt: -0.4 });
      const spr = splash(cannon, 0, 0, 0.8, 0.9);
      const steam = K.part("w2a:steam");
      steam.add(G.blob(0.07, 0, 0.1, 3), "matte", { c: "#eef4f6" });
      const puffM = steam.build({ cast: false });
      puffM.userData.noBounds = true;
      cannon.add(puffM);
      c.muzzle(cannon, 0, 0, 0.78);
      const kick = new Spring(260, 14, 0);
      return {
        trigger(kind) {
          if (kind === "fire") kick.kick(-5);
          if (kind === "pulse") kick.kick(-1.8);
        },
        pose(st, dt, time) {
          const t = st.t + st.phase;
          const w = easeInOut(st.w);
          kick.step(dt);
          const tremble = 0.004 + w * 0.03 + (1 - Math.min(1, st.sinceFire / 3)) * 0.004;
          cannon.rotation.set(Math.sin(time * 53) * tremble - 0.04 + w * 0.05, Math.sin(time * 47 + 1) * tremble, Math.sin(time * 61) * tremble * 0.5);
          cannon.position.z = 0.05 + kick.x * 0.35;
          const pump = t * (2.2 + w * 6);
          rods[0].position.y = 1.4 + Math.sin(pump) * 0.1 - w * 0.12 + Math.max(0, -kick.x) * 0.3;
          rods[1].position.y = 1.4 + Math.sin(pump + Math.PI) * 0.1 - w * 0.12 + Math.max(0, -kick.x) * 0.3;
          for (let i = 0; i < 2; i++) needles[i].rotation.z = 1.2 - w * 2.2 - Math.sin(t * 3 + i) * 0.15 + st.fire * 1.5;
          const sp = (t * 0.8) % 1;
          puffM.position.set(0, 0.35 + sp * 0.4, -0.3 - sp * 0.1);
          puffM.scale.setScalar(Math.max(0.001, Math.sin(sp * Math.PI) * (0.6 + w * 1.2 + st.flash * 1.5)));
          spr.scale.setScalar(0.3 + st.flash * 1.8 + w * 0.2);
          face.setOpen(st.fire > 0.3 ? 1 : -w * 1.4);
          face.look(st.w > 0.05 ? 0 : null, 0.2);
        },
      };
    },
  });

  /* ---------------------------------------------------------------- III-A · Canon tsunami */
  K.defTower("water3A", {
    windup: 0.45,
    fireDur: 0.9,
    ringR: 1.9,
    haloR: 1.9,
    recoil: 2.6,
    build(c) {
      const water = c.inst("waterFx");
      const b = K.part("w3a:base");
      b.add(G.cyl(1.55, 1.65, 0.3, 18), "stone", { p: [0, 0.15, 0], c: C.stone, uv: [9, 0.45], ao: 0.5, aoH: 0.3 });
      b.add(G.ring(1.28, 1.48, 36, 6), "water", { p: [0, 0.305, 0] });
      b.add(G.torus(1.6, 0.045, 3, 26), "metal", { p: [0, 0.29, 0], r: [Math.PI / 2, 0, 0], c: C.bronze });
      mossPatches(b, [
        [1.4, 0.28, 0.5, 0.16],
        [-1.2, 0.28, -0.9, 0.18],
        [0.2, 0.28, -1.45, 0.14],
      ]);
      c.root.add(b.build());
      const mach = K.node(c.yaw, 0, 0.3, 0);
      const mp = K.part("w3a:mach");
      mp.add(G.cyl(0.34, 0.44, 0.9, 12), "metal", { p: [0, 0.45, -0.1], g: [C.bronzeD, C.bronze, 0, 0.9] });
      mp.add(G.torus(0.38, 0.05, 3, 14), "metal", { p: [0, 0.86, -0.1], r: [Math.PI / 2, 0, 0], c: C.verd });
      // Réservoirs (tonneaux cerclés) à l'arrière.
      for (const sx of [-1, 1]) {
        mp.add(G.cyl(0.3, 0.3, 0.75, 12), "wood", { p: [sx * 0.62, 0.34, -0.85], r: [Math.PI / 2, 0, 0], c: C.wood, uv: [2, 1] });
        for (const z of [-0.28, 0.28]) mp.add(G.torus(0.305, 0.025, 3, 14), "metal", { p: [sx * 0.62, 0.34, -0.85 + z], c: C.bronzeD });
        mp.add(
          G.tube(
            "w3a:pipe",
            [
              [0, 0, 0],
              [0, 0.35, 0.05],
              [-0.1, 0.9, 0.2],
              [-0.3, 1.25, 0.28],
            ],
            [0.07, 0.07],
            8,
            5,
          ),
          "metal",
          { p: [sx * 0.62, 0.62, -0.85], s: [sx, 1, 1], c: C.bronze },
        );
      }
      mach.add(mp.build());
      // Tête de carpe.
      const head = K.node(mach, 0, 1.65, 0.12);
      const hp = K.part("w3a:head");
      hp.add(G.sphere(0.9, 18, 13), "scaly", { s: [0.95, 0.82, 1.1], g: ["#e2cf93", "#2f7a70", -0.55, 0.55], uv: [5, 3] });
      hp.add(G.torus(0.44, 0.13, 7, 12, Math.PI), "satin", { p: [0, -0.08, 0.93], s: [1.15, 0.9, 1], c: C.lip });
      hp.add(G.disc(0.44, 16), "matte", { p: [0, -0.08, 0.86], s: [1.15, 0.9, 1], c: C.deep });
      hp.add(G.torus(0.62, 0.07, 4, 18), "metal", { p: [0, 0, -0.78], s: [1, 0.85, 1], c: C.bronze });
      // Nageoire dorsale.
      hp.add(
        G.extrude(
          "w3a:dorsal",
          [
            [-0.55, 0],
            [-0.45, 0.35],
            [-0.3, 0.2],
            [-0.12, 0.58],
            [0.02, 0.32],
            [0.2, 0.62],
            [0.3, 0.3],
            [0.52, 0.42],
            [0.6, 0],
          ],
          0.05,
          0,
        ),
        "satin",
        { p: [0, 0.62, -0.18], r: [0, Math.PI / 2, 0], g: [C.fin, C.finL, 0, 0.6] },
      );
      // Ouïes lumineuses.
      for (const sx of [-1, 1])
        for (const k of [0, 1]) hp.add(G.torus(0.3 - k * 0.07, 0.03, 3, 10, Math.PI * 0.8), "glow", { p: [sx * (0.84 - k * 0.04), -0.05, 0.02 - k * 0.14], r: [0, sx * 1.35, Math.PI * 0.6], c: C.teal });
      // Barbillons.
      for (const sx of [-1, 1])
        hp.add(
          G.tube(
            "w3a:barbel",
            [
              [0, 0, 0],
              [0.12, -0.15, 0.1],
              [0.18, -0.45, 0.05],
              [0.1, -0.62, 0.14],
            ],
            [0.035, 0.008],
            8,
            4,
          ),
          "satin",
          { p: [sx * 0.46, -0.25, 0.9], s: [sx, 1, 1], c: C.lip },
        );
      const glowMat = c.inst("glow");
      head.add(hp.build({ mats: { glow: glowMat } }));
      // Nageoires pectorales (battent).
      const fins = [];
      for (const sx of [-1, 1]) {
        const fn = K.node(head, sx * 0.78, -0.35, 0.1);
        const fp = K.part("w3a:pect");
        fp.add(
          G.extrude(
            "w3a:pect",
            [
              [0, 0],
              [0.2, 0.12],
              [0.45, 0.1],
              [0.55, -0.05],
              [0.35, -0.12],
              [0.12, -0.1],
            ],
            0.04,
            0,
          ),
          "satin",
          { r: [Math.PI / 2, 0, 0], g: [C.fin, C.finL, 0, 0.5, "x"] },
        );
        const fm = fp.build();
        fm.scale.set(sx, 1, 1);
        fn.add(fm);
        fins.push(fn);
      }
      // Mâchoire inférieure (lèvre) et vague.
      const jaw = K.node(head, 0, -0.3, 0.72);
      const jp = K.part("w3a:jaw");
      jp.add(G.torus(0.4, 0.12, 6, 12, Math.PI), "satin", { p: [0, 0.2, 0.22], r: [0, 0, Math.PI], s: [1.1, 0.8, 1], c: C.lip });
      jaw.add(jp.build());
      const wave = K.node(head, 0, -0.1, 0.8);
      const wp = K.part("w3a:wave");
      const curl = [];
      for (let i = 0; i <= 10; i++) {
        const a = (i / 10) * Math.PI * 1.35;
        curl.push([Math.cos(a) * 0.3 - 0.02, Math.sin(a) * 0.3]);
      }
      for (let i = 10; i >= 0; i--) {
        const a = (i / 10) * Math.PI * 1.35;
        curl.push([Math.cos(a) * 0.18 + 0.02, Math.sin(a) * 0.16 - 0.04]);
      }
      wp.add(G.extrude("w3a:curl", curl, 0.7, 0), "waterFx", { r: [0, -Math.PI / 2, 0] });
      wp.add(G.sphere(0.07, 6, 4), "snow", { p: [0.0, 0.3, -0.05], c: "#ffffff", s: [5, 1, 1] });
      const wm = wp.build({ mats: { waterFx: water } });
      wm.userData.noBounds = true;
      wave.add(wm);
      const face = c.face(head, { key: "w3a", p: [0, 0.4, 0.72], r: [-0.45, 0, 0], gap: 0.36, eye: 0.19, skin: "#2f7a70", lidMat: "satin", brow: "#1d3f3a", browT: 0.05, slant: 0.4, rest: 0.05 });
      const spr = splash(head, 0, -0.08, 1.1, 1.6);
      c.muzzle(head, 0, -0.08, 1.05);
      let mouth = 0;
      return {
        pose(st, dt) {
          const t = st.t + st.phase;
          const w = easeInOut(st.w);
          const rec = st.recoil.x;
          const inflate = 1 + w * 0.1 - rec * 0.3;
          head.scale.set(inflate, inflate, 1 + w * 0.04);
          head.position.set(0, 1.65 + Math.sin(t * 1.2) * 0.04, 0.12 + rec * 0.6);
          head.rotation.set(Math.sin(t * 0.9) * 0.04 - w * 0.1 + st.fire * 0.12, 0, Math.sin(t * 0.7) * 0.03);
          const open = 0.15 + Math.sin(t * 1.8) * 0.08 - w * 0.2 + Math.sqrt(st.fire) * 0.7 + st.pulse * 0.3;
          mouth = damp(mouth, open, 20, dt);
          jaw.rotation.x = mouth * 0.6;
          const f = Math.sqrt(st.fire);
          wave.position.set(0, -0.1, 0.8 + f * 0.9);
          wave.scale.set(1 + f * 0.8, 0.6 + f * 1.1 - w * 0.3, 0.6 + f * 0.8);
          water.opacity = 0.5 + f * 0.4;
          const flap = Math.sin(t * 3) * 0.25 + w * 0.3;
          fins[0].rotation.set(0, 0.3 + flap, -0.3);
          fins[1].rotation.set(0, -0.3 - flap, 0.3);
          glowMat.color.setScalar(1 + Math.sin(t * 2.4) * 0.3 + w * 0.8 + st.flash);
          spr.scale.setScalar(0.4 + st.flash * 2.4 + w * 0.3);
          face.setOpen(st.fire > 0.3 ? 1 : -w * 1.2);
          face.look(st.w > 0.05 ? 0 : null, 0);
        },
      };
    },
  });

  /* ---------------------------------------------------------------- II-B · Fontaine siphon */
  K.defTower("water2B", {
    windup: 0.4,
    fireDur: 0.6,
    pulseDur: 0.35,
    ringR: 1.45,
    haloR: 1.45,
    recoil: 1.8,
    build(c) {
      const b = K.part("w2b:base");
      basin(b, "w2b", 1.25, 0.5, 0.16, 0.34, 20);
      b.add(G.cyl(0.26, 0.34, 1.15, 10), "stone", { p: [0, 0.58, 0], c: C.stoneL, uv: [2, 1.2] });
      for (const y of [0.5, 1.05]) b.add(G.torus(y < 0.6 ? 0.3 : 0.27, 0.035, 3, 12), "metal", { p: [0, y, 0], r: [Math.PI / 2, 0, 0], c: C.bronze });
      b.add(G.cyl(0.36, 0.28, 0.12, 10), "stone", { p: [0, 1.2, 0], c: C.stone });
      mossPatches(b, [
        [1.1, 0.5, 0.4, 0.15],
        [-0.9, 0.5, -0.8, 0.16],
        [0.2, 0.5, 1.15, 0.12],
      ]);
      c.root.add(b.build());
      // Surface d'eau tourbillonnante (tourne sur elle-même).
      const pool = K.node(c.root, 0, 0.33, 0);
      const pp = K.part("w2b:pool");
      pp.add(G.discUp(1.1, 28), "swirl", {});
      pp.add(G.cyl(0.14, 0.14, 0.02, 7), "matte", { p: [0.7, 0.02, 0.2], c: C.moss });
      pp.add(G.cyl(0.11, 0.11, 0.02, 7), "matte", { p: [-0.5, 0.02, -0.55], c: C.mossL });
      pool.add(pp.build());
      const head = K.node(c.yaw, 0, 1.42, 0);
      const hp = K.part("w2b:head");
      hp.add(G.sphere(0.32, 12, 9), "metal", { p: [0, 0.14, -0.05], s: [1, 0.95, 0.9], g: [C.verd, C.bronze, -0.2, 0.4], vj: 0.15, vs: 6 });
      for (const sx of [-1, 1])
        hp.add(
          G.extrude(
            "w2b:fin",
            [
              [0, 0],
              [0.18, 0.12],
              [0.3, 0.02],
              [0.26, -0.1],
              [0.1, -0.08],
            ],
            0.03,
            0,
          ),
          "metal",
          { p: [sx * 0.28, 0.22, -0.08], r: [0, sx > 0 ? 0.3 : Math.PI - 0.3, 0.3], c: C.verd },
        );
      hp.add(
        G.tube(
          "w2b:curl",
          [
            [0, 0.42, -0.08],
            [0.02, 0.62, -0.1],
            [0.14, 0.7, 0.0],
            [0.18, 0.6, 0.1],
            [0.08, 0.56, 0.08],
          ],
          [0.045, 0.02],
          10,
          5,
        ),
        "metal",
        { c: C.bronze },
      );
      head.add(hp.build());
      // Pavillon (trompe aspirante) orienté vers l'avant et un peu vers le bas.
      const bell = K.node(head, 0, 0.0, 0.14);
      bell.rotation.x = 0.35;
      const bp = K.part("w2b:bell");
      const prof = [
        [0.001, 0.02],
        [0.11, 0.0],
        [0.12, 0.15],
        [0.17, 0.3],
        [0.3, 0.42],
        [0.43, 0.47],
        [0.45, 0.5],
        [0.4, 0.5],
        [0.28, 0.44],
        [0.15, 0.33],
        [0.09, 0.2],
        [0.001, 0.16],
      ];
      bp.add(G.lathe("w2b:bell", prof, 14), "metal", { r: [Math.PI / 2, 0, 0], g: [C.bronzeD, C.bronze, 0.1, 0.5], vj: 0.12, vs: 6 });
      bell.add(bp.build());
      const vortex = K.node(bell, 0, 0, 0.2);
      const vp = K.part("w2b:vortex");
      vp.add(G.disc(0.3, 16), "swirl", {});
      vortex.add(vp.build({ cast: false }));
      const face = c.face(head, { key: "w2b", p: [0, 0.28, 0.2], r: [-0.25, 0, 0], gap: 0.14, eye: 0.1, skin: C.bronze, lidMat: "metal", brow: C.bronzeD, slant: -0.15, rest: -0.35, browTilt: -0.2 });
      // Filets d'eau aspirés depuis le bassin vers le pavillon.
      const streams = K.node(c.yaw, 0, 0, 0);
      const sp = K.part("w2b:streams");
      const ends = [
        [0.0, 0.34, 1.05],
        [0.55, 0.34, 0.85],
        [-0.6, 0.34, 0.8],
      ];
      ends.forEach(([x, y, z], i) =>
        sp.add(
          G.tube(
            "w2b:s" + i,
            [
              [0, 1.34, 0.55],
              [x * 0.3, 1.28, 0.78],
              [x * 0.7, 0.8, z * 0.95],
              [x, y, z],
            ],
            (t) => 0.035 + t * 0.04,
            10,
            5,
          ),
          "waterFx",
          {},
        ),
      );
      const sm = sp.build({ mats: { waterFx: c.inst("waterFx") } });
      sm.userData.noBounds = true;
      streams.add(sm);
      const sMat = sm.children[0].material;
      const spr = splash(bell, 0, 0, 0.4, 0.8);
      c.muzzle(bell, 0, 0, 0.5);
      let gulp = 0;
      return {
        pose(st, dt) {
          const t = st.t + st.phase;
          const w = easeInOut(st.w);
          const f = Math.max(st.pulse, st.fire);
          pool.rotation.y = -t * (0.8 + w * 1.5 + f * 2.5);
          vortex.rotation.z = -t * (3 + w * 4 + f * 6);
          gulp = damp(gulp, f, 25, dt);
          const bs = 1 + w * 0.22 - gulp * 0.25 + Math.sin(t * 3.1) * 0.03;
          bell.scale.set(bs, bs, 1 + w * 0.1 - gulp * 0.15);
          head.position.y = 1.42 + Math.sin(t * 1.5) * 0.02 - gulp * 0.06 + bump(1 - st.fidget) * 0.05;
          head.rotation.x = -w * 0.15 + gulp * 0.15 + st.recoil.x * 0.2;
          sMat.opacity = 0.45 + w * 0.3 + gulp * 0.25;
          streams.visible = true;
          spr.scale.setScalar(0.4 + st.flash * 1.4 + w * 0.5);
          face.setOpen(w > 0.3 ? 1 : gulp > 0.3 ? -0.8 : 0.2);
          face.look(st.w > 0.05 ? 0 : null, -0.3);
        },
      };
    },
  });

  /* ---------------------------------------------------------------- III-B · Maelström glouton */
  K.defTower("water3B", {
    windup: 0.45,
    fireDur: 0.9,
    pulseDur: 0.35,
    ringR: 2.1,
    haloR: 2.2,
    recoil: 1.8,
    build(c) {
      const spireMat = c.inst("waterFx");
      const b = K.part("w3b:base");
      basin(b, "w3b", 2.0, 0.72, 0.2, 0.58, 24);
      b.add(G.torus(2.01, 0.05, 3, 28), "metal", { p: [0, 0.4, 0], r: [Math.PI / 2, 0, 0], c: C.bronze });
      mossPatches(b, [
        [1.8, 0.72, 0.5, 0.18],
        [-1.6, 0.72, -1.0, 0.2],
        [0.4, 0.72, -1.85, 0.16],
        [-1.2, 0.72, 1.4, 0.15],
      ]);
      c.root.add(b.build());
      // Entonnoir d'eau tournoyant (spirale projetée d'en haut).
      const vortex = K.node(c.root, 0, 0, 0);
      const vp = K.part("w3b:vortex");
      vp.add(
        G.lathe(
          "w3b:vortex",
          [
            [1.84, 0.58],
            [1.62, 0.57],
            [1.2, 0.52],
            [0.8, 0.42],
            [0.5, 0.26],
            [0.34, 0.14],
          ],
          24,
        ),
        "swirl",
        { uv: "box", tile: 3.7, uo: 0.5, vo: 0.5 },
      );
      vp.add(G.discUp(0.36, 12), "matte", { p: [0, 0.12, 0], c: C.deep });
      vortex.add(vp.build({ cast: false }));
      // Gueule dentée au fond du tourbillon.
      const maw = K.node(c.root, 0, 0.16, 0);
      const mw = K.part("w3b:maw");
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * TAU;
        mw.add(G.cone(0.07, 0.24, 5), "glossy", { p: [Math.sin(a) * 0.36, 0.06, Math.cos(a) * 0.36], r: [Math.cos(a) * -0.9, 0, Math.sin(a) * 0.9], c: C.bone });
      }
      maw.add(mw.build());
      // Trombe centrale.
      const spire = K.node(c.yaw, 0, 0.12, 0);
      const sp = K.part("w3b:spire");
      sp.add(
        G.lathe(
          "w3b:spire",
          [
            [0.001, 0],
            [0.38, 0.02],
            [0.27, 0.48],
            [0.16, 1.32],
            [0.17, 2.04],
            [0.28, 2.7],
            [0.44, 3.06],
            [0.32, 3.24],
            [0.001, 3.26],
          ],
          12,
        ),
        "waterFx",
        { uv: [3, 4] },
      );
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        sp.add(G.ico(0.08, 0), "waterFx", { p: [Math.sin(a) * 0.55, 3.14 + (i % 2) * 0.1, Math.cos(a) * 0.55] });
      }
      const spM = sp.build({ mats: { waterFx: spireMat } });
      spire.add(spM);
      // Pédoncules oculaires.
      const stalks = [];
      for (const sx of [-1, 1]) {
        const st0 = K.node(c.yaw, sx * 0.72, 0.5, 0.72);
        const tp = K.part("w3b:stalk");
        tp.add(
          G.tube(
            "w3b:stalk",
            [
              [0, 0, 0],
              [0.08, 0.45, 0.05],
              [0.0, 0.9, 0.1],
              [-0.05, 1.2, 0.12],
            ],
            [0.1, 0.07],
            10,
            6,
          ),
          "satin",
          { g: [C.flesh, C.fleshL, 0, 1.2] },
        );
        const tm = tp.build();
        tm.scale.set(sx, 1, 1);
        st0.add(tm);
        const eyeNode = K.node(st0, -sx * 0.05, 1.32, 0.14);
        const f = c.face(eyeNode, { key: "w3b", single: true, gap: 0, eye: 0.21, skin: C.flesh, lidMat: "satin", brow: "#1d4a44", browT: 0.05, slant: 0.35 * sx, rest: 0.0 });
        stalks.push({ node: st0, eyeNode, face: f, sx });
      }
      // Tentacules d'eau.
      const tents = [];
      for (const sx of [-1, 1]) {
        const tn = K.node(c.yaw, sx * 1.1, 0.5, -0.4);
        const tp = K.part("w3b:tent");
        tp.add(
          G.tube(
            "w3b:tent",
            [
              [0, 0, 0],
              [0.1, 0.4, 0.0],
              [0.0, 0.8, 0.1],
              [-0.25, 1.0, 0.15],
            ],
            [0.12, 0.02],
            10,
            6,
          ),
          "waterFx",
          {},
        );
        const tm = tp.build({ mats: { waterFx: spireMat } });
        tm.scale.set(sx, 1, 1);
        tn.add(tm);
        tm.userData.noBounds = true;
        tents.push(tn);
      }
      // Boule d'eau recrachée.
      const blob = K.node(c.yaw, 0, 3.2, 0);
      const bl = K.part("w3b:blob");
      bl.add(G.blob(0.3, 1, 0.12, 5), "waterFx", {});
      const blm = bl.build({ mats: { waterFx: spireMat } });
      blm.userData.noBounds = true;
      blob.add(blm);
      const spr = splash(c.yaw, 0, 3.2, 0, 2.2);
      c.muzzle(c.yaw, 0, 3.25, 0.25);
      let spitT = 9;
      return {
        trigger(kind) {
          if (kind === "fire") spitT = 0;
        },
        pose(st, dt) {
          const t = st.t + st.phase;
          const w = easeInOut(st.w);
          const f = Math.max(st.fire, st.pulse * 0.5);
          vortex.rotation.y = -t * (0.9 + w * 1.5 + f * 2);
          spire.rotation.y = -t * (1.6 + w * 2 + f * 3);
          const sy = 1 - w * 0.2 + Math.sqrt(st.fire) * 0.35 + Math.sin(t * 1.7) * 0.03;
          const sxz = 1 + w * 0.2 - st.fire * 0.1;
          spire.scale.set(sxz, sy, sxz);
          spire.rotation.z = Math.sin(t * 1.1) * 0.04;
          const chomp = Math.abs(Math.sin(t * 2.2)) * 0.15 + w * 0.3 - st.fire * 0.3;
          maw.scale.set(1 - chomp, 1, 1 - chomp);
          for (let i = 0; i < 2; i++) {
            const S = stalks[i];
            S.node.rotation.set(Math.sin(t * 1.3 + i) * 0.1 - w * 0.15 + st.fire * 0.2, 0, S.sx * (0.1 + Math.sin(t * 0.9 + i * 2) * 0.12));
            S.face.setOpen(st.fire > 0.3 ? 1 : -w * 1.2);
            S.face.look(st.w > 0.05 ? 0 : null, 0);
          }
          tents[0].rotation.set(Math.sin(t * 1.6) * 0.15, 0, Math.sin(t * 1.2) * 0.2 - f * 0.3);
          tents[1].rotation.set(Math.sin(t * 1.4 + 1) * 0.15, 0, -Math.sin(t * 1.1 + 2) * 0.2 + f * 0.3);
          spitT += dt;
          const k = spitT < 1.1 ? spitT / 1.1 : 1;
          blob.visible = k < 1;
          if (blob.visible) {
            blob.position.set(0, 3.2 + Math.sin(k * Math.PI) * 1.4, k * 2.4);
            blob.scale.setScalar(0.6 + bump(k) * 0.7);
          }
          spireMat.opacity = 0.72 + w * 0.15 + st.flash * 0.1;
          spr.scale.setScalar(0.9 + w * 0.6 + st.flash * 2.2);
        },
      };
    },
  });

  void clamp;
  void lerp;
  void wob;
})();
