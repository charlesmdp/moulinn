// « Pas touche à mes trésors » — tours de FEU (dégâts, explosions, brûlure).
//
//  I     Brasier grognon         : petit poêle-dragon qui GONFLE avant de cracher une boule de feu.
//  II-A  Souffle infernal        : le dragon sort son cou et souffle par pulsations (cône 60°).
//  III-A Dragon de la fournaise  : deux gueules croisent leurs flammes (deux bouches : muzzle 0 et 1).
//  II-B  Crache-lave             : le poêle devient un petit volcan qui rote de la lave.
//  III-B Volcan furieux          : grand cratère, lave visible, éruption spectaculaire.
// Code couleur : orange / rouge incandescent sur fonte chauffée et briques.
(function () {
  "use strict";
  const PTMT = globalThis.PTMT;
  if (!PTMT || !PTMT.models || !PTMT.models.kit) return;
  const K = PTMT.models.kit,
    G = K.g;
  const { TAU, lerp, damp, bump, easeInOut, wob } = K.math;

  const C = {
    ironD: "#3a2f2b",
    iron: "#5e4d45",
    ironL: "#8a7464",
    hot: "#b4553a",
    brass: "#d4952f",
    brick: "#bf5d3e",
    soot: "#2a2220",
    bone: "#f3e6c8",
    boneD: "#9a8566",
    mouth: "#2a0a05",
    ember: "#ff7a1f",
    flameY: "#ffd766",
    flameR: "#ff4412",
    red: "#a8432c",
    redL: "#cf6a45",
    redD: "#5c2519",
    basalt: "#5f5048",
    basaltD: "#332925",
    smoke: "#b9b0a8",
  };

  K.defMat(
    "flameAdd",
    () => new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    true,
  );

  /* ---------------------------------------------------------------- pièces communes */
  /** Socle de briques cerclé de fer, charbons et braises autour. */
  function brickBase(key, r, h, n) {
    const b = K.part(key);
    b.add(G.cyl(r * 0.94, r, h, 12), "blocks", { p: [0, h / 2, 0], c: C.brick, uv: "box", tile: 1.0, ao: 0.5, aoH: h + 0.1 });
    b.add(G.cyl(r * 0.97, r * 0.97, 0.05, 16, true), "metal", { p: [0, h + 0.005, 0], c: C.ironD });
    const rnd = PTMT.rng(n * 31 + 7);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rnd() * 0.6,
        rr = r + 0.1 + rnd() * 0.16;
      const glow = i % 3 === 1;
      b.add(G.rock(0.09 + rnd() * 0.05, 0, 0.3, i + 1), glow ? "glow" : "matte", { p: [Math.cos(a) * rr, 0.04, Math.sin(a) * rr], s: [1, 0.65, 1], c: glow ? C.ember : C.soot, j: 0.25 });
    }
    return b;
  }

  /** Ventre de fonte chauffée (révolution), cerclages de laiton, grille incandescente. */
  function belly(p, key, R, H, seg, opt) {
    const prof = [
      [0.001, 0],
      [0.72, 0],
      [0.86, 0.06],
      [0.96, 0.2],
      [1.0, 0.38],
      [0.96, 0.58],
      [0.84, 0.76],
      [0.62, 0.9],
      [0.33, 0.98],
      [0.001, 1],
    ].map(([r, y]) => [r * R, y * H]);
    p.add(G.lathe(key + ":belly", prof, seg), "iron", { g: [C.ironD, C.hot, H * 0.05, H * 0.95], uv: [4, 1.3] });
    p.add(G.torus(R * 1.005, R * 0.05, 4, seg - 2), "metal", { p: [0, H * 0.36, 0], r: [Math.PI / 2, 0, 0], c: C.brass });
    if (!opt || opt.band2 !== false) p.add(G.torus(R * 0.87, R * 0.045, 4, seg - 2), "metal", { p: [0, H * 0.72, 0], r: [Math.PI / 2, 0, 0], c: C.brass });
    if (!opt || opt.grill !== false) for (let i = -1; i <= 1; i++) p.add(G.box(R * 0.5, 0.035, R * 0.07), "glow", { p: [0, H * 0.985, i * R * 0.17], c: C.ember });
  }

  /** Cheminée penchée. */
  function chimney(p, x, y, z, h, r) {
    p.add(G.cyl(r, r * 1.1, h, 8), "metal", { p: [x, y + h / 2, z], r: [-0.22, 0, 0], c: C.ironD });
    p.add(G.cyl(r * 1.45, r * 1.25, h * 0.16, 8), "metal", { p: [x, y + h * 0.98, z - h * 0.11], r: [-0.22, 0, 0], c: C.iron });
  }
  /** Bouffées de fumée (sprites doux qui montent, gonflent et disparaissent). */
  function puffs(parent, key, n, size) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const m = K.fx.smoke("#8a817a", 1, 0.55);
      m.userData.size = size * 3.2;
      parent.add(m);
      out.push(m);
    }
    return out;
  }
  function animPuffs(list, t, x, y, z, rise, speed, boost) {
    for (let i = 0; i < list.length; i++) {
      const ph = (t * speed + i / list.length) % 1;
      const m = list[i];
      m.position.set(x + Math.sin(ph * 5 + i) * 0.05, y + ph * rise, z - ph * rise * 0.3);
      const s = Math.sin(ph * Math.PI) * (0.5 + ph * 0.8) * (1 + boost) * m.userData.size;
      m.scale.setScalar(Math.max(0.001, s));
    }
  }

  /** Jet de flammes (cônes additifs, pointe à la bouche, vers +Z). */
  function flameJet(parent, key, len, rad) {
    const p = K.part(key);
    p.add(G.cone(rad, len, 12, true), "flameAdd", { p: [0, 0, len / 2], r: [-Math.PI / 2, 0, 0], g: ["#9a2208", "#ff7a1f", -len / 2, len / 2] });
    p.add(G.cone(rad * 0.5, len * 0.65, 10, true), "flameAdd", { p: [0, 0, len * 0.325], r: [-Math.PI / 2, 0, 0], g: ["#a83a0a", "#ffc451", -len * 0.325, len * 0.325] });
    const m = p.build();
    m.visible = false;
    m.userData.noBounds = true;
    parent.add(m);
    return m;
  }

  /** Tête de dragon rouge : crâne, museau, cornes, crocs, mâchoire articulée, yeux ronchons. */
  function dragonHead(c, parent, key, glowMat, big) {
    const head = K.node(parent, 0, 0, 0);
    const p = K.part(key + ":head");
    p.add(G.rbox(0.46, 0.32, 0.46, 0.13, 1), "iron", { p: [0, 0.1, 0.1], g: [C.redD, C.red, -0.06, 0.26], uv: [1.2, 1.2] });
    p.add(G.rbox(0.36, 0.17, 0.4, 0.07, 1), "iron", { p: [0, 0.07, 0.4], g: [C.red, C.redL, -0.02, 0.16], uv: [1, 1] });
    p.add(G.box(0.5, 0.07, 0.15), "metal", { p: [0, 0.25, 0.27], r: [0.25, 0, 0], c: C.redD });
    for (const sx of [-1, 1]) {
      p.add(G.ico(0.032, 0), "glow", { p: [sx * 0.08, 0.15, 0.6], c: C.ember });
      p.add(
        G.tube(
          "fdh:horn",
          [
            [0, 0, 0],
            [0.08, 0.1, -0.1],
            [0.14, 0.2, -0.3],
            [0.1, 0.26, -0.48],
          ],
          [0.065, 0.006],
          6,
          5,
        ),
        "glossy",
        { p: [sx * 0.15, 0.22, 0.02], s: [sx, 1, 1], g: [C.bone, C.boneD, 0.05, 0.28] },
      );
      p.add(G.cone(0.08, 0.2, 5), "metal", { p: [sx * 0.25, 0.12, 0.0], r: [0, 0, -sx * 1.25], c: C.redD });
      for (const k of [0, 1]) p.add(G.cone(0.028, 0.085, 5), "glossy", { p: [sx * (0.05 + k * 0.08), -0.03, 0.56 - k * 0.04], r: [Math.PI, 0, 0], c: C.bone });
    }
    if (big) for (const sx of [-1, 1]) p.add(G.cone(0.05, 0.22, 5), "glossy", { p: [sx * 0.08, 0.3, -0.05], r: [-0.7, 0, sx * 0.3], c: C.bone });
    head.add(p.build({ mats: { glow: glowMat } }));
    const gp = K.part(key + ":throat");
    gp.add(G.sphere(0.12, 8, 5), "glow", { p: [0, 0.0, 0.34], s: [1.2, 0.6, 1.5], g: [C.flameR, C.flameY, -0.1, 0.1, "z"] });
    head.add(gp.build({ mats: { glow: glowMat } }));
    const jaw = K.node(head, 0, -0.01, 0.12);
    const jp = K.part(key + ":jaw");
    jp.add(G.rbox(0.32, 0.08, 0.44, 0.035, 1), "iron", { p: [0, -0.04, 0.2], g: [C.redD, C.red, -0.08, 0.0], uv: [1, 1] });
    for (const sx of [-1, 1]) jp.add(G.cone(0.025, 0.07, 5), "glossy", { p: [sx * 0.1, 0.02, 0.38], c: C.bone });
    jp.add(G.box(0.24, 0.02, 0.3), "matte", { p: [0, 0.005, 0.2], c: C.mouth });
    jaw.add(jp.build());
    const face = c.face(head, {
      key: key + ":eyes",
      lod: big ? "lo" : undefined,
      p: [0, 0.22, 0.3],
      r: [-0.25, 0, 0],
      gap: 0.13,
      eye: 0.085,
      skin: C.red,
      brow: C.soot,
      slant: 0.42,
      rest: 0.12,
      browY: 1.25,
    });
    const muzzle = c.muzzle(head, 0, 0.02, 0.62);
    const jet = flameJet(head, "fjet", 1.0, 0.3);
    jet.position.set(0, 0.02, 0.6);
    const spr = K.fx.sprite(C.ember, 0.9, 0.9);
    spr.position.set(0, 0.03, 0.66);
    head.add(spr);
    return { head, jaw, face, muzzle, jet, spr, jawA: 0 };
  }

  /** Cou articulé en anneaux de fonte. */
  function neck(parent, key, n, len, r) {
    const nodes = [];
    let cur = parent;
    for (let i = 0; i < n; i++) {
      const nd = K.node(cur, 0, i === 0 ? 0 : len, 0);
      const p = K.part(key + ":seg");
      p.add(G.cyl(r * 0.92, r, len * 1.02, 8, true), "iron", { p: [0, len / 2, 0], g: [C.ironD, C.iron, 0, len], uv: [2, 0.6] });
      p.add(G.torus(r * 1.02, r * 0.15, 3, 10), "metal", { p: [0, len * 0.96, 0], r: [Math.PI / 2, 0, 0], c: C.brass });
      p.add(G.cone(r * 0.28, r * 0.75, 4), "metal", { p: [0, len * 0.55, -r * 0.95], r: [-0.6, 0, 0], c: C.redD });
      const s = 1 - i * 0.08;
      const m = p.build();
      m.scale.set(s, 1, s);
      nd.add(m);
      nodes.push(nd);
      cur = nd;
    }
    return nodes;
  }

  /** Profil de volcan (révolution) : pied évasé, pente, lèvre du cratère, cuvette. */
  function volcanoProfile(R, H, cr, cd) {
    return [
      [0.001, H - cd],
      [cr * 0.55, H - cd],
      [cr * 0.85, H - cd * 0.55],
      [cr, H - 0.02],
      [cr * 1.12, H + 0.04],
      [cr * 1.3, H - 0.02],
      [R * 0.52, H * 0.72],
      [R * 0.78, H * 0.38],
      [R * 0.95, H * 0.12],
      [R, 0.02],
      [R * 0.97, 0],
    ].reverse();
  }
  function lavaVeins(p, key, R, H, cr, n, w, seed) {
    const rnd = PTMT.rng(seed);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rnd() * 0.5 + 0.9;
      const pts = [];
      for (let k = 0; k <= 5; k++) {
        const t = k / 5;
        const y = lerp(H * 0.98, H * 0.05, t);
        const rr = lerp(cr * 1.25, R * 0.98, Math.pow(t, 0.8)) + 0.012;
        const aa = a + Math.sin(t * 5 + i) * 0.12;
        pts.push([Math.sin(aa) * rr, y, Math.cos(aa) * rr]);
      }
      p.add(G.tube(key + ":vein" + i, pts, (t) => w * (1 - t * 0.55), 9, 4), "lava", {});
    }
  }

  /* ---------------------------------------------------------------- I · Brasier grognon */
  K.defTower("fire1", {
    windup: 0.32,
    fireDur: 0.55,
    ringR: 1.15,
    haloR: 1.2,
    recoil: 2.8,
    build(c) {
      const glow = c.inst("glow");
      c.root.add(brickBase("f1:base", 0.78, 0.3, 6).build({ mats: { glow } }));
      const body = K.node(c.yaw, 0, 0.33, 0);
      const bp = K.part("f1:body");
      belly(bp, "f1", 0.66, 0.88, 16);
      chimney(bp, 0, 0.62, -0.36, 0.46, 0.08);
      for (const sx of [-1, 1])
        bp.add(
          G.tube(
            "f1:horn",
            [
              [0, 0, 0],
              [0.12, 0.14, -0.04],
              [0.2, 0.3, -0.14],
              [0.18, 0.42, -0.26],
            ],
            [0.075, 0.008],
            7,
            5,
          ),
          "glossy",
          { p: [sx * 0.34, 0.66, 0.08], s: [sx, 1, 1], g: [C.bone, C.boneD, 0.05, 0.4] },
        );
      // Museau (mâchoire supérieure), narines, crocs, gueule sombre.
      bp.add(G.rbox(0.62, 0.19, 0.36, 0.08, 1), "iron", { p: [0, 0.47, 0.56], g: [C.red, C.redL, 0.38, 0.56], uv: [1.2, 0.8] });
      bp.add(G.box(0.66, 0.06, 0.12), "metal", { p: [0, 0.59, 0.5], r: [0.3, 0, 0], c: C.redD });
      for (const sx of [-1, 1]) {
        bp.add(G.ico(0.036, 0), "glow", { p: [sx * 0.12, 0.54, 0.74], c: C.ember });
        bp.add(G.cone(0.045, 0.13, 5), "glossy", { p: [sx * 0.21, 0.33, 0.7], r: [Math.PI, 0, 0], c: C.bone });
        bp.add(G.cone(0.032, 0.09, 5), "glossy", { p: [sx * 0.08, 0.35, 0.72], r: [Math.PI, 0, 0], c: C.bone });
      }
      bp.add(G.sphere(0.24, 8, 6), "matte", { p: [0, 0.3, 0.46], s: [1.3, 0.8, 0.9], c: C.mouth });
      body.add(bp.build({ mats: { glow } }));
      // Boule de feu en charge dans la gueule.
      const ball = K.node(body, 0, 0.3, 0.62);
      const fb = K.part("f1:ball");
      fb.add(G.sphere(0.13, 10, 7), "glow", { g: [C.flameR, C.flameY, -0.13, 0.13] });
      ball.add(fb.build({ mats: { glow } }));
      const spr = K.fx.sprite(C.ember, 1.1, 0.8);
      spr.position.set(0, 0.32, 0.74);
      body.add(spr);
      // Mâchoire inférieure.
      const jaw = K.node(body, 0, 0.27, 0.36);
      const jp = K.part("f1:jaw");
      jp.add(G.rbox(0.58, 0.1, 0.42, 0.045, 1), "iron", { p: [0, -0.04, 0.2], g: [C.redD, C.red, -0.09, 0.0], uv: [1, 1] });
      for (const x of [-0.16, 0, 0.16]) jp.add(G.cone(0.03, 0.08, 5), "glossy", { p: [x, 0.03, 0.36], c: C.bone });
      jaw.add(jp.build());
      const face = c.face(body, { key: "f1", p: [0, 0.68, 0.49], r: [-0.5, 0, 0], gap: 0.19, eye: 0.12, skin: C.iron, brow: C.soot, slant: 0.4, rest: 0.1 });
      c.muzzle(body, 0, 0.3, 0.82);
      const smoke = puffs(c.yaw, "f1", 2, 0.1);
      let jawA = 0;
      return {
        pose(st, dt) {
          const t = st.t + st.phase;
          const inf = easeInOut(st.w);
          const br = Math.sin(t * 2.3);
          const rec = st.recoil.x;
          const hop = bump(1 - st.fidget) * 0.07;
          const sxz = 1 + br * 0.015 + inf * 0.3 - rec * 0.7;
          const sy = 1 + br * 0.022 + inf * 0.16 + rec * 1.1;
          body.scale.set(sxz, sy, sxz);
          body.position.set(0, 0.33 + hop, rec * 0.9);
          const open = 0.1 + 0.05 * Math.sin(t * 1.7) - inf * 0.1 + Math.sqrt(st.fire) * 0.75 + st.pulse * 0.35 + hop * 2;
          jawA = damp(jawA, open, 28, dt);
          jaw.rotation.x = jawA;
          glow.color.setScalar(1.35 + wob(t * 3, 1) * 0.25 + inf * 1.6 + st.flash * 2.2);
          ball.scale.setScalar(st.fire > 0.05 ? 0.25 : 0.55 + inf * 0.9 + wob(t * 6, 2) * 0.06);
          spr.scale.setScalar(0.8 + inf * 0.9 + st.flash * 2.6 + wob(t * 4, 3) * 0.08);
          face.setOpen(st.fire > 0.25 ? 1 : -inf * 1.2);
          face.look(st.w > 0.05 || st.fire > 0 ? 0 : null, 0);
          animPuffs(smoke, t, 0, 1.42, -0.42, 0.7, 0.45 + st.frenzy * 0.4, st.flash * 0.8 + hop * 4);
        },
      };
    },
  });

  /* ---------------------------------------------------------------- II-A · Souffle infernal */
  K.defTower("fire2A", {
    windup: 0.35,
    fireDur: 0.7,
    pulseDur: 0.32,
    ringR: 1.4,
    haloR: 1.45,
    recoil: 3,
    build(c) {
      const glow = c.inst("glow");
      c.root.add(brickBase("f2a:base", 0.98, 0.34, 6).build({ mats: { glow } }));
      const body = K.node(c.yaw, 0, 0.37, 0);
      const bp = K.part("f2a:body");
      belly(bp, "f2a", 0.84, 1.12, 14, { grill: false });
      chimney(bp, 0, 0.82, -0.5, 0.6, 0.1);
      bp.add(G.torus(0.25, 0.06, 3, 12), "metal", { p: [0, 0.97, 0.47], r: [Math.PI / 2 - 0.75, 0, 0], c: C.brass });
      // Porte du foyer (grille incandescente).
      for (let i = -2; i <= 2; i++) bp.add(G.box(0.05, 0.22, 0.04), "glow", { p: [i * 0.08, 0.3, 0.84], c: C.ember });
      bp.add(G.box(0.5, 0.05, 0.07), "metal", { p: [0, 0.43, 0.83], c: C.brass });
      bp.add(G.box(0.5, 0.05, 0.07), "metal", { p: [0, 0.17, 0.84], c: C.brass });
      body.add(bp.build({ mats: { glow } }));
      const col = K.node(body, 0, 0.95, 0.45);
      const nk = neck(col, "f2a:neck", 3, 0.3, 0.21);
      nk[0].rotation.x = 0.75;
      nk[1].rotation.x = -0.15;
      nk[2].rotation.x = -0.2;
      const hn = K.node(nk[2], 0, 0.3, 0);
      hn.rotation.x = -0.4;
      const H = dragonHead(c, hn, "fdh", glow, false);
      H.head.scale.setScalar(1.3);
      const smoke = puffs(c.yaw, "f2a", 2, 0.13);
      return {
        pose(st, dt) {
          const t = st.t + st.phase;
          const w = easeInOut(st.w);
          const rec = st.recoil.x;
          const sway = Math.sin(t * 1.3) * 0.05;
          const br = Math.sin(t * 2.1);
          body.scale.set(1 + br * 0.012 + w * 0.05, 1 + br * 0.016 + w * 0.04, 1 + br * 0.012 + w * 0.05);
          nk[0].rotation.x = 0.75 - w * 0.35 + st.fire * 0.25 + rec * 0.6 + sway * 0.4;
          nk[1].rotation.x = -0.15 - w * 0.1 + st.fire * 0.1 + sway;
          nk[2].rotation.x = -0.2 + w * 0.15 - sway;
          nk[1].rotation.z = Math.sin(t * 0.9) * 0.05;
          hn.rotation.x = -0.4 + w * 0.3 - st.fire * 0.35 - st.pulse * 0.12;
          hn.position.z = rec * 0.25;
          const open = 0.12 + Math.sin(t * 1.6) * 0.04 - w * 0.1 + Math.sqrt(st.fire) * 0.8 + st.pulse * 0.55;
          H.jawA = damp(H.jawA, open, 30, dt);
          H.jaw.rotation.x = H.jawA;
          const f = Math.max(st.pulse, st.fire);
          H.jet.visible = f > 0.03;
          if (H.jet.visible) H.jet.scale.set(0.6 + f * 0.7 + wob(t * 9, 1) * 0.1, 0.6 + f * 0.7 + wob(t * 8, 2) * 0.1, 0.4 + f * 0.9);
          glow.color.setScalar(1.35 + wob(t * 3, 1) * 0.3 + w * 1.4 + st.flash * 2);
          H.spr.scale.setScalar(0.7 + w * 0.6 + f * 1.3 + wob(t * 5, 4) * 0.1);
          H.face.setOpen(f > 0.3 ? 0.9 : -w * 1.2);
          H.face.look(st.w > 0.05 || f > 0 ? 0 : null, 0);
          animPuffs(smoke, t, 0, 1.82, -0.58, 0.9, 0.4 + st.frenzy * 0.4, st.flash * 0.6);
        },
      };
    },
  });

  /* ---------------------------------------------------------------- III-A · Dragon de la fournaise */
  K.defTower("fire3A", {
    windup: 0.4,
    fireDur: 0.8,
    pulseDur: 0.32,
    ringR: 1.85,
    haloR: 1.9,
    recoil: 3.2,
    build(c) {
      const glow = c.inst("glow");
      const fl = c.inst("flameAdd");
      c.root.add(brickBase("f3a:base", 1.38, 0.42, 9).build({ mats: { glow } }));
      const body = K.node(c.yaw, 0, 0.45, 0);
      const bp = K.part("f3a:body");
      belly(bp, "f3a", 1.08, 1.5, 14, { grill: false, band2: false });
      for (let i = -3; i <= 3; i++) bp.add(G.box(0.06, 0.34, 0.05), "glow", { p: [i * 0.1, 0.42, 1.09 - Math.abs(i) * 0.012], c: C.ember });
      bp.add(G.box(0.8, 0.07, 0.1), "metal", { p: [0, 0.6, 1.08], c: C.brass });
      bp.add(G.box(0.8, 0.07, 0.1), "metal", { p: [0, 0.24, 1.1], c: C.brass });
      // Couronne-cheminée crénelée.
      bp.add(
        G.lathe(
          "f3a:crown",
          [
            [0.34, 0],
            [0.3, 0.2],
            [0.3, 0.42],
            [0.44, 0.62],
            [0.47, 0.66],
            [0.36, 0.66],
            [0.3, 0.5],
            [0.2, 0.4],
          ],
          10,
        ),
        "metal",
        { p: [0, 1.4, 0], g: [C.ironD, C.iron, 0, 0.6] },
      );
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        bp.add(G.cone(0.055, 0.2, 4), "metal", { p: [Math.sin(a) * 0.43, 2.12, Math.cos(a) * 0.43], c: C.redD });
      }
      for (const sx of [-1, 1]) bp.add(G.torus(0.25, 0.06, 4, 10), "metal", { p: [sx * 0.52, 1.23, 0.5], r: [Math.PI / 2 - 0.7, 0, -sx * 0.5], c: C.brass });
      body.add(bp.build({ mats: { glow } }));
      const flames = [];
      for (let i = 0; i < 3; i++) {
        const fp = K.part("f3a:fl");
        fp.add(G.flame(0.2, 0.75, 7), "flameAdd", { g: [C.flameY, C.flameR, 0.05, 0.7] });
        const m = fp.build({ mats: { flameAdd: fl } });
        m.userData.noBounds = true;
        const a = (i / 3) * TAU;
        m.position.set(Math.sin(a) * 0.14, 1.95, Math.cos(a) * 0.14);
        body.add(m);
        flames.push(m);
      }
      const crownSpr = K.fx.sprite(C.ember, 1.8, 0.7);
      crownSpr.position.set(0, 2.3, 0);
      body.add(crownSpr);
      // Grandes ailes de fer rouge (silhouette vue d'avion).
      const wings = [];
      for (const sx of [-1, 1]) {
        const wn = K.node(body, sx * 0.62, 1.2, -0.6);
        const wp = K.part("f3a:wing");
        const shape = [
          [0, 0],
          [0.4, 0.62],
          [0.95, 0.95],
          [1.55, 0.9],
          [1.36, 0.55],
          [1.25, 0.2],
          [0.95, 0.34],
          [0.76, -0.04],
          [0.48, 0.14],
          [0.2, -0.22],
        ];
        wp.add(G.extrude("f3a:wingm", shape, 0.04, 0), "satin", { r: [0, -Math.PI / 2, 0], g: ["#5a1f16", "#e0643a", 0.0, 0.9] });
        for (const tip of [
          [1.55, 0.9],
          [1.25, 0.2],
          [0.76, -0.04],
        ])
          wp.add(
            G.tube(
              "f3a:rib" + tip[0],
              [
                [0, 0, 0],
                [0, tip[1] * 0.6 + 0.12, tip[0] * 0.5],
                [0, tip[1], tip[0]],
              ],
              [0.04, 0.01],
              5,
              4,
            ),
            "glossy",
            { c: C.bone },
          );
        const wm = wp.build();
        wm.scale.set(sx, 1, 1);
        wn.add(wm);
        wings.push(wn);
      }
      // Deux cous, deux têtes qui croisent leurs flammes.
      const heads = [];
      for (const sx of [-1, 1]) {
        const col = K.node(body, sx * 0.52, 1.23, 0.5);
        col.rotation.z = -sx * 0.5;
        const nk = neck(col, "f3a:neck", 3, 0.3, 0.22);
        const hn = K.node(nk[2], 0, 0.3, 0);
        const H = dragonHead(c, hn, "fdh3", glow, true);
        H.nk = nk;
        H.hn = hn;
        H.sx = sx;
        H.head.scale.setScalar(1.18);
        heads.push(H);
      }
      const smoke = puffs(c.yaw, "f3a", 2, 0.2);
      return {
        pose(st, dt) {
          const t = st.t + st.phase;
          const w = easeInOut(st.w);
          const rec = st.recoil.x;
          const br = Math.sin(t * 1.9);
          body.scale.set(1 + br * 0.01 + w * 0.04, 1 + br * 0.014 + w * 0.03, 1 + br * 0.01 + w * 0.04);
          for (let i = 0; i < 2; i++) {
            const H = heads[i];
            const sx = H.sx;
            const mine = (st.pulseCount & 1) === i ? st.pulse : st.pulse * 0.25;
            const f = Math.max(mine, st.fire);
            const sway = Math.sin(t * 1.2 + i * 2.1) * 0.06;
            H.nk[0].rotation.x = 0.55 - w * 0.3 + st.fire * 0.22 + rec * 0.5 + sway * 0.5;
            H.nk[1].rotation.x = -0.12 - w * 0.1 + sway;
            H.nk[2].rotation.x = -0.2 + w * 0.12 - sway * 0.6;
            H.nk[1].rotation.z = sx * 0.25;
            H.nk[2].rotation.z = sx * 0.18;
            H.hn.rotation.set(-0.25 + w * 0.3 - st.fire * 0.3 - mine * 0.15, -sx * 0.32, sx * 0.07);
            H.hn.position.z = rec * 0.2;
            const open = 0.12 + Math.sin(t * 1.5 + i) * 0.04 - w * 0.1 + Math.sqrt(st.fire) * 0.8 + mine * 0.6;
            H.jawA = damp(H.jawA, open, 30, dt);
            H.jaw.rotation.x = H.jawA;
            H.jet.visible = f > 0.03;
            if (H.jet.visible) H.jet.scale.set(0.7 + f * 0.8 + wob(t * 9, i) * 0.1, 0.7 + f * 0.8, 0.5 + f * 1.1);
            H.spr.scale.setScalar(0.8 + w * 0.6 + f * 1.5 + wob(t * 5, i + 3) * 0.1);
            H.face.setOpen(f > 0.3 ? 0.9 : -w * 1.2);
            H.face.look(st.w > 0.05 || f > 0 ? -sx * 0.3 : null, 0);
          }
          for (let i = 0; i < 2; i++) {
            const sx = i ? 1 : -1;
            const flap = Math.sin(t * 2.2 + i * 0.4) * 0.1 + w * 0.25 + st.fire * 0.3;
            wings[i].rotation.set(-0.3 - flap * 0.3, sx * (0.5 + flap), sx * 0.12);
          }
          for (let i = 0; i < 3; i++) {
            const k = 0.8 + wob(t * 6, i * 2) * 0.25 + w * 0.5 + st.flash * 0.8;
            flames[i].scale.set(k * 0.9, k, k * 0.9);
          }
          fl.color.setScalar(0.9 + st.flash * 0.6);
          glow.color.setScalar(1.3 + wob(t * 3, 1) * 0.3 + w * 1.3 + st.flash * 2);
          crownSpr.scale.setScalar(1.6 + w * 0.6 + st.flash * 1.2 + wob(t * 4, 2) * 0.15);
          animPuffs(smoke, t, 0, 2.85, 0, 1.3, 0.3 + st.frenzy * 0.3, st.flash * 0.5);
        },
      };
    },
  });

  /* ---------------------------------------------------------------- II-B · Crache-lave */
  K.defTower("fire2B", {
    windup: 0.38,
    fireDur: 0.8,
    ringR: 1.35,
    haloR: 1.5,
    recoil: 2.4,
    build(c) {
      const glow = c.inst("glow");
      const lava = c.inst("lava");
      const bp = K.part("f2b:base");
      const rnd = PTMT.rng(5);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU + rnd() * 0.4,
          r = 1.05 + rnd() * 0.15;
        bp.add(G.rock(0.17 + rnd() * 0.1, 0, 0.28, i + 3), "stone", { p: [Math.sin(a) * r, 0.06, Math.cos(a) * r], s: [1.2, 0.7, 1], r: [0, a, 0], c: C.basalt, uv: "box", tile: 0.8 });
      }
      bp.add(G.cyl(1.12, 1.18, 0.08, 18), "stone", { p: [0, 0.04, 0], c: C.basaltD, uv: "box", tile: 1.2 });
      c.root.add(bp.build());
      const body = K.node(c.yaw, 0, 0.05, 0);
      const R = 1.12,
        H = 2.0,
        cr = 0.36;
      const vp = K.part("f2b:cone");
      vp.add(G.lathe("f2b:cone", volcanoProfile(R, H, cr, 0.22), 18), "stone", { g: [C.basaltD, "#8a7060", 0, H], uv: [8, 3.4], vj: 0.12, vs: 3 });
      lavaVeins(vp, "f2b", R, H, cr, 4, 0.055, 11);
      // Bouche de l'ancien poêle (arche de briques) — elle rote la lave.
      vp.add(G.torus(0.3, 0.09, 5, 10, Math.PI), "blocks", { p: [0, 0.18, 0.98], r: [-0.15, 0, 0], c: C.brick, uv: [2, 0.5] });
      vp.add(G.sphere(0.28, 10, 5, 0, Math.PI / 2), "lava", { p: [0, 0.16, 0.94], r: [Math.PI / 2 - 0.15, 0, 0], s: [1, 0.6, 1] });
      for (const sx of [-1, 1]) vp.add(G.cone(0.04, 0.12, 5), "glossy", { p: [sx * 0.14, 0.4, 0.99], r: [Math.PI - 0.2, 0, 0], c: C.bone });
      // Bec verseur vers l'avant (indique la visée) et coulée de lave.
      // Coulée débordant par l'avant-gauche (indique la visée sans passer sur le visage).
      vp.add(
        G.tube(
          "f2b:drip",
          [
            [-0.12, H + 0.03, cr + 0.02],
            [-0.2, H - 0.2, cr + 0.22],
            [-0.36, H * 0.66, 0.6],
            [-0.5, H * 0.38, 0.78],
            [-0.56, H * 0.18, 0.86],
          ],
          [0.075, 0.04],
          10,
          5,
        ),
        "lava",
        {},
      );
      body.add(vp.build({ mats: { glow, lava } }));
      const pool = K.node(body, 0, H - 0.14, 0);
      const lp = K.part("f2b:pool");
      lp.add(G.discUp(cr * 0.95, 18), "lava", { uv: [1.2, 1.2] });
      pool.add(lp.build({ mats: { lava } }));
      const blob = K.node(body, 0, H - 0.1, 0);
      const bb = K.part("f2b:blob");
      bb.add(G.blob(0.15, 1, 0.15, 4), "lava", { uv: [0.6, 0.6] });
      blob.add(bb.build({ mats: { lava } }));
      const face = c.face(body, { key: "f2b", p: [0, 1.0, 0.7], r: [-0.42, 0, 0], gap: 0.23, eye: 0.13, skin: C.basalt, lidMat: "stone", brow: C.basaltD, browMat: "stone", slant: 0.45, rest: 0.1 });
      const spr = K.fx.sprite(C.ember, 1.6, 0.8);
      spr.position.set(0, H + 0.1, 0);
      body.add(spr);
      c.muzzle(body, 0, H + 0.15, 0.25);
      const smoke = puffs(c.yaw, "f2b", 2, 0.15);
      let jumpT = 9;
      return {
        trigger(kind) {
          if (kind === "fire" || kind === "pulse") jumpT = 0;
        },
        pose(st, dt) {
          const t = st.t + st.phase;
          const w = easeInOut(st.w);
          const rec = st.recoil.x;
          const br = Math.sin(t * 1.8);
          const rumble = w * Math.sin(t * 60) * 0.012;
          const sxz = 1 + br * 0.01 + w * 0.07 - rec * 0.35;
          const sy = 1 + br * 0.012 + w * 0.08 + rec * 0.7;
          body.scale.set(sxz, sy, sxz);
          body.position.set(rumble, 0.05, rumble * 0.7);
          pool.position.y = H - 0.14 + w * 0.08 + Math.sin(t * 2.6) * 0.012;
          jumpT += dt;
          const j = jumpT < 0.9 ? bump(jumpT / 0.9) : 0;
          blob.position.y = H - 0.12 + w * 0.08 + j * 1.3 + Math.max(0, Math.sin(t * 3.1)) * 0.05;
          blob.scale.setScalar(0.8 + w * 0.5 + j * 0.4 + Math.sin(t * 7) * 0.05);
          lava.color.setScalar(1.5 + wob(t * 2, 3) * 0.2 + w * 0.9 + st.flash * 1.6);
          glow.color.setScalar(1.3 + w * 1.2 + st.flash * 1.8);
          spr.scale.setScalar(1.3 + w * 0.8 + st.flash * 1.6 + wob(t * 3, 1) * 0.1);
          face.setOpen(st.fire > 0.3 ? 1 : -w * 1.3);
          face.look(st.w > 0.05 ? 0 : null, 0.3);
          animPuffs(smoke, t, 0, H + 0.25, 0, 0.9, 0.35 + st.frenzy * 0.3, st.flash);
        },
      };
    },
  });

  /* ---------------------------------------------------------------- III-B · Volcan furieux */
  K.defTower("fire3B", {
    windup: 0.45,
    fireDur: 1.0,
    ringR: 1.95,
    haloR: 2.1,
    recoil: 2.2,
    build(c) {
      const glow = c.inst("glow");
      const lava = c.inst("lava");
      const R = 1.75,
        H = 2.75,
        cr = 0.72;
      const bp = K.part("f3b:base");
      const rnd = PTMT.rng(9);
      for (let i = 0; i < 11; i++) {
        const a = (i / 11) * TAU + rnd() * 0.3,
          r = 1.62 + rnd() * 0.14;
        bp.add(G.rock(0.2 + rnd() * 0.12, 1, 0.3, i + 20), "stone", { p: [Math.sin(a) * r, 0.08, Math.cos(a) * r], s: [1.2, 0.7, 1], r: [0, a, 0], c: C.basalt, uv: "box", tile: 0.9 });
      }
      bp.add(G.cyl(1.85, 1.92, 0.1, 22), "stone", { p: [0, 0.05, 0], c: C.basaltD, uv: "box", tile: 1.5 });
      c.root.add(bp.build());
      const body = K.node(c.yaw, 0, 0.08, 0);
      const vp = K.part("f3b:cone");
      vp.add(G.lathe("f3b:cone", volcanoProfile(R, H, cr, 0.3), 22), "stone", { g: [C.basaltD, "#8c705e", 0, H], uv: [12, 5], vj: 0.14, vs: 2.5 });
      lavaVeins(vp, "f3b", R, H, cr, 6, 0.1, 21);
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * TAU + 0.2;
        vp.add(G.rock(0.17 + (i % 3) * 0.04, 1, 0.35, 40 + i), "stone", { p: [Math.sin(a) * (cr + 0.18), H + 0.06, Math.cos(a) * (cr + 0.18)], s: [0.9, 1.4, 0.9], r: [0.2, a, 0], c: C.basaltD, uv: "box", tile: 0.6 });
      }
      // Gueule rageuse (fissure en zigzag incandescente).
      const mouth = [];
      for (let i = 0; i <= 8; i++) mouth.push([-0.42 + i * 0.105, i % 2 ? -0.07 : 0.04]);
      for (let i = 8; i >= 0; i--) mouth.push([-0.42 + i * 0.105, (i % 2 ? -0.13 : -0.02) - (1 - Math.abs(i - 4) / 4) * 0.1]);
      vp.add(G.extrude("f3b:mouth", mouth, 0.3, 0), "lava", { p: [0, 1.05, 1.28], r: [-0.45, 0, 0], s: [1.25, 1.25, 1] });
      body.add(vp.build({ mats: { glow, lava } }));
      const pool = K.node(body, 0, H - 0.2, 0);
      const lp = K.part("f3b:pool");
      lp.add(G.discUp(cr * 0.92, 22), "lava", { uv: [2, 2] });
      pool.add(lp.build({ mats: { lava } }));
      const erupt = K.node(body, 0, H - 0.2, 0);
      const ep = K.part("f3b:erupt");
      ep.add(G.flame(0.42, 1.9, 10), "lava", { uv: [1, 2] });
      const em = ep.build({ mats: { lava } });
      em.userData.noBounds = true;
      erupt.add(em);
      const orbit = K.node(body, 0, H + 0.55, 0);
      const rocks = [];
      for (let i = 0; i < 3; i++) {
        const rp = K.part("f3b:orb" + i);
        rp.add(G.rock(0.17, 0, 0.3, 60 + i), "stone", { c: C.basaltD, uv: "box", tile: 0.5 });
        rp.add(G.rock(0.12, 0, 0.3, 70 + i), "lava", { s: [1.1, 0.5, 1.1] });
        const m = rp.build({ mats: { lava } });
        m.userData.noBounds = true;
        orbit.add(m);
        rocks.push(m);
      }
      const face = c.face(body, {
        key: "f3b",
        p: [0, 1.62, 0.99],
        r: [-0.5, 0, 0],
        gap: 0.34,
        eye: 0.2,
        skin: C.basalt,
        lidMat: "stone",
        brow: C.basaltD,
        browMat: "stone",
        browT: 0.07,
        browW: 0.28,
        slant: 0.55,
        rest: 0.16,
      });
      const spr = K.fx.sprite(C.ember, 3.2, 0.75);
      spr.position.set(0, H + 0.2, 0);
      body.add(spr);
      c.muzzle(body, 0, H + 0.3, 0.2);
      const smoke = puffs(c.yaw, "f3b", 3, 0.26);
      let eT = 9;
      return {
        trigger(kind) {
          if (kind === "fire") eT = 0;
          if (kind === "pulse") eT = Math.min(eT, 0.35);
        },
        pose(st, dt) {
          const t = st.t + st.phase;
          const w = easeInOut(st.w);
          const rec = st.recoil.x;
          const br = Math.sin(t * 1.5);
          const rumble = w * Math.sin(t * 55) * 0.02 + st.fire * Math.sin(t * 70) * 0.015;
          const sxz = 1 + br * 0.008 + w * 0.05 - rec * 0.3;
          const sy = 1 + br * 0.01 + w * 0.06 + rec * 0.6;
          body.scale.set(sxz, sy, sxz);
          body.position.set(rumble, 0.08, rumble * 0.6);
          pool.position.y = H - 0.2 + w * 0.1 + Math.sin(t * 2.2) * 0.02;
          eT += dt;
          const e = eT < 1.1 ? Math.pow(bump(eT / 1.1), 0.6) : 0;
          erupt.visible = e > 0.02;
          if (erupt.visible) erupt.scale.set(0.6 + e * 0.5 + wob(t * 8, 2) * 0.05, e * 1.2, 0.6 + e * 0.5);
          orbit.rotation.y = t * (0.7 + w * 1.5 + st.fire * 3);
          for (let i = 0; i < 3; i++) {
            const a = (i / 3) * TAU;
            const r = 1.15 + Math.sin(t * 1.3 + i * 2) * 0.1 + e * 0.5;
            rocks[i].position.set(Math.sin(a) * r, Math.sin(t * 2 + i * 2.1) * 0.18 + e * 0.6, Math.cos(a) * r);
            rocks[i].rotation.set(t * 0.9 + i, t * 0.7, 0);
          }
          lava.color.setScalar(1.55 + wob(t * 2, 3) * 0.2 + w * 0.9 + st.flash * 1.5);
          glow.color.setScalar(1.3 + w * 1.2 + st.flash * 1.8);
          spr.scale.setScalar(2.8 + w * 1.0 + st.flash * 2 + wob(t * 3, 1) * 0.15);
          face.setOpen(st.fire > 0.3 ? 1 : -w * 1.3);
          face.look(st.w > 0.05 ? 0 : null, 0.4);
          animPuffs(smoke, t, 0, H + 0.4, 0, 1.5, 0.28 + st.frenzy * 0.3, st.flash);
        },
      };
    },
  });
})();
