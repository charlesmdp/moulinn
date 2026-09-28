// « Pas touche à mes trésors » — pièces d'amélioration du moulin.
//
//   PTMT.models.millUpgrade(kind, level)  kind : "meule" | "roue" | "atelier", level : 0..3
//   → { object, height, update(dt, time), dispose() }
//
//  Meule (revenu)   : 0 meule simple ; I engrenages et sacs de farine ; II grand mécanisme (bâti, trémie,
//                     rouet) ; III meule enchantée (runes lumineuses, farine qui flotte, meule en lévitation).
//  Roue (mana)      : se fixe SUR la roue à aubes existante (rayon ≈ 1,5 m, largeur ≈ 1,1 m, axe X, centre à
//                     l'origine) — à accrocher au nœud qui tourne. 0 presque rien (clous runiques) ; I runes sur
//                     les jantes ; II conduits lumineux ; III cœur magique (orbe pulsant au moyeu).
//                     Option : millUpgrade("roue", n, { spin: vitesse }) fait tourner l'objet lui-même (si posé sur
//                     un nœud fixe).
//  Atelier          : 0 petite cabane et établi ; I plus grande cabane et outils ; II forge (cheminée qui fume,
//                     enclume) ; III vraie forge de défense (soufflet, fourneau incandescent, pièces de tours
//                     suspendues, marteau magique, étincelles).
(function () {
  "use strict";
  const PTMT = globalThis.PTMT;
  if (!PTMT || !PTMT.models || !PTMT.models.kit) return;
  const K = PTMT.models.kit,
    G = K.g;
  const { TAU, clamp, wob } = K.math;

  const C = {
    granite: "#cdc5b3",
    graniteD: "#a39b8a",
    dressed: "#ddd7c9",
    millstone: "#9a9384",
    wood: "#9c7a58",
    woodD: "#6e5236",
    woodW: "#a6927c",
    slate: "#8d97a8",
    slateD: "#4a5260",
    iron: "#45403c",
    flour: "#f7f2e6",
    sack: "#e4d2ad",
    magic: "#7fe8ff",
    magicV: "#c77dff",
    fire: "#ff7a1f",
    red: "#a8432c",
    gold: "#f2b52e",
  };

  function sackAt(p, x, z, ry, s) {
    const prof = [
      [0.001, 0],
      [0.16, 0.01],
      [0.22, 0.08],
      [0.23, 0.2],
      [0.2, 0.32],
      [0.12, 0.4],
      [0.09, 0.44],
      [0.12, 0.48],
      [0.001, 0.5],
    ];
    p.add(G.lathe("mill:sack", prof, 9), "burlap", { p: [x, 0, z], r: [0, ry, 0], s: s || 1, c: C.sack, uv: [1.5, 1] });
    p.add(G.torus(0.095, 0.02, 3, 9), "matte", { p: [x, 0.43 * (s || 1), z], r: [Math.PI / 2, 0, 0], s: s || 1, c: "#8a6a40" });
    p.add(G.sphere(0.12, 6, 3, 0, Math.PI / 2), "matte", { p: [x, 0.48 * (s || 1), z], s: [(s || 1) * 0.9, (s || 1) * 0.4, (s || 1) * 0.9], c: C.flour });
  }
  /** Engrenage de bois (dents), dans le plan XY, axe Z. */
  G.gear = (R, teeth, th) =>
    PTMT.geo(`mill:gear${R},${teeth},${th}`, () => {
      const pts = [];
      for (let i = 0; i < teeth; i++) {
        const a0 = (i / teeth) * TAU,
          da = TAU / teeth;
        pts.push([Math.cos(a0) * R, Math.sin(a0) * R]);
        pts.push([Math.cos(a0 + da * 0.18) * R * 1.14, Math.sin(a0 + da * 0.18) * R * 1.14]);
        pts.push([Math.cos(a0 + da * 0.46) * R * 1.14, Math.sin(a0 + da * 0.46) * R * 1.14]);
        pts.push([Math.cos(a0 + da * 0.64) * R, Math.sin(a0 + da * 0.64) * R]);
      }
      const shape = K.shape(pts);
      const hole = new THREE.Path();
      hole.absarc(0, 0, R * 0.22, 0, TAU, true);
      shape.holes.push(hole);
      const g = new THREE.ExtrudeGeometry(shape, { depth: th, bevelEnabled: false, curveSegments: 6 });
      g.translate(0, 0, -th / 2);
      g.clearGroups();
      return g;
    });

  function shell(name, build, opt) {
    const root = new THREE.Group();
    root.name = "ptmt-mill-" + name;
    const owned = [];
    const ctx = {
      root,
      opt: opt || {},
      inst(n) {
        const m = K.mat(n).clone();
        owned.push(m);
        return m;
      },
    };
    const b = build(ctx) || {};
    let t = 0;
    return {
      object: root,
      height: Math.round(K.solidTop(root) * 100) / 100,
      update(dt, time) {
        if (dt > 0.1) dt = 0.1;
        t += dt;
        K.tick(time);
        if (b.update) b.update(dt, time, t);
      },
      dispose() {
        if (root.parent) root.parent.remove(root);
        for (const m of owned) m.dispose();
        owned.length = 0;
      },
    };
  }

  /* ---------------------------------------------------------------- Meule */
  function meule(level) {
    return (c) => {
      const lv = level;
      const S = lv >= 2 ? 1.15 : 1;
      const base = K.part("mill:meuleBase" + lv);
      base.add(G.cyl(0.95 * S, 1.02 * S, 0.4, 8), "blocks", { p: [0, 0.2, 0], r: [0, Math.PI / 8, 0], c: C.granite, uv: "box", tile: 2.2, ao: 0.55, aoH: 0.4 });
      base.add(G.cyl(0.8 * S, 0.8 * S, 0.2, 18), "matte", { p: [0, 0.5, 0], c: C.millstone, vj: 0.12, vs: 9 });
      base.add(G.torus(0.82 * S, 0.03, 3, 20), "metal", { p: [0, 0.52, 0], r: [Math.PI / 2, 0, 0], c: C.iron });
      if (lv >= 1) {
        // Engrenage vertical et lanterne.
        base.add(G.box(0.14, 1.1, 0.14), "wood", { p: [1.25 * S, 0.55, -0.35], c: C.woodD, uv: [0.2, 1] });
        base.add(G.box(0.14, 1.1, 0.14), "wood", { p: [1.25 * S, 0.55, 0.35], c: C.woodD, uv: [0.2, 1] });
        base.add(G.box(0.12, 0.12, 0.9), "wood", { p: [1.25 * S, 1.05, 0], c: C.woodD });
        sackAt(base, -1.35 * S, 0.45, 0.4, 1);
        sackAt(base, -1.15 * S, -0.5, -0.6, 0.9);
      }
      if (lv >= 2) {
        // Bâti de bois, trémie, goulotte.
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) base.add(G.box(0.16, 2.1, 0.16), "wood", { p: [sx * 0.95 * S, 1.05, sz * 0.95 * S], c: C.woodD, uv: [0.2, 2] });
        for (const sz of [-1, 1]) base.add(G.box(2.1 * S, 0.14, 0.14), "wood", { p: [0, 2.05, sz * 0.95 * S], c: C.woodD, uv: [2, 0.2] });
        for (const sx of [-1, 1]) base.add(G.box(0.14, 0.14, 2.1 * S), "wood", { p: [sx * 0.95 * S, 2.05, 0], c: C.woodD, uv: [0.2, 2] });
        base.add(G.cyl(0.55, 0.12, 0.6, 4, true), "wood", { p: [0, 1.55, 0], r: [0, Math.PI / 4, 0], c: C.wood, uv: [2, 0.6] });
        base.add(G.cyl(0.52, 0.52, 0.04, 4), "matte", { p: [0, 1.82, 0], r: [0, Math.PI / 4, 0], c: "#d9b65a" });
        base.add(G.box(0.24, 0.14, 0.9), "wood", { p: [0, 0.45, 1.05 * S], r: [0.35, 0, 0], c: C.wood, uv: [0.3, 1] });
        sackAt(base, 0.35, 1.45 * S, 0.2, 1);
        base.add(G.cone(0.3, 0.2, 10), "matte", { p: [-0.15, 0.1, 1.45 * S], c: C.flour });
      }
      if (lv >= 3) {
        base.add(G.crystal(0.12, 0.28, 6, 0.2, 0.06), "ice", { p: [0, 2.2, 0], g: ["#7a5cff", "#bff6ff", 0, 0.5] });
        base.add(G.ring(1.05 * S, 1.3 * S, 40, 6), "runes", { p: [0, 0.03, 0], c: C.magic });
      }
      c.root.add(base.build());
      // Meule tournante (et roues d'engrenage).
      const spin = K.node(c.root, 0, 0.62, 0);
      const rp = K.part("mill:runner" + lv);
      rp.add(G.cyl(0.76 * S, 0.78 * S, 0.24, 20), "matte", { p: [0, 0.12, 0], c: lv >= 3 ? "#6f7a92" : "#a8a090", vj: 0.14, vs: 9 });
      rp.add(G.cyl(0.14, 0.14, 0.26, 10), "matte", { p: [0, 0.13, 0], c: "#3a342e" });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        rp.add(G.box(0.05, 0.02, 0.5 * S), "matte", { p: [Math.sin(a) * 0.42 * S, 0.245, Math.cos(a) * 0.42 * S], r: [0, a + 0.4, 0], c: "#8a8272" });
      }
      rp.add(G.box(0.4, 0.08, 0.08), "metal", { p: [0, 0.27, 0], c: C.iron });
      if (lv >= 3) {
        rp.add(G.planeUp(1.5 * S, 1.5 * S), "sealSpiral", { p: [0, 0.252, 0], c: C.magic });
        rp.add(G.ring(0.78 * S, 0.8 * S, 32, 1), "glowAdd", { p: [0, 0.12, 0], c: "#3fb8ff" });
      }
      spin.add(rp.build());
      const spindle = K.part("mill:spindle" + lv);
      spindle.add(G.cyl(0.05, 0.05, lv >= 2 ? 1.2 : 0.7, 8), "wood", { p: [0, lv >= 2 ? 0.8 : 0.55, 0], c: C.woodD });
      if (lv >= 1) {
        spindle.add(G.cyl(0.18, 0.18, 0.05, 10), "wood", { p: [0, 0.75, 0], c: C.wood });
        spindle.add(G.cyl(0.18, 0.18, 0.05, 10), "wood", { p: [0, 0.95, 0], c: C.wood });
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * TAU;
          spindle.add(G.cyl(0.018, 0.018, 0.2, 4), "wood", { p: [Math.sin(a) * 0.15, 0.85, Math.cos(a) * 0.15], c: C.woodD });
        }
      }
      spin.add(spindle.build());
      let gear = null;
      if (lv >= 1) {
        gear = K.node(c.root, 1.25 * S - 0.06, 1.05, 0);
        const gp = K.part("mill:gear" + (lv >= 2 ? 2 : 1));
        gp.add(G.gear(lv >= 2 ? 0.62 : 0.48, lv >= 2 ? 16 : 12, 0.1), "wood", { r: [0, Math.PI / 2, 0], c: C.wood, uv: [0.8, 0.8] });
        gp.add(G.cyl(0.06, 0.06, 0.4, 8), "metal", { r: [0, 0, Math.PI / 2], c: C.iron });
        gear.add(gp.build());
      }
      let motes = null,
        spr = null;
      if (lv >= 3) {
        motes = K.node(c.root, 0, 0.9, 0);
        const mp = K.part("mill:motes");
        for (let i = 0; i < 10; i++) {
          const a = i * 2.39996;
          mp.add(G.ico(0.045, 0), "glow", { p: [Math.cos(a) * (0.6 + (i % 3) * 0.25), (i % 4) * 0.28, Math.sin(a) * (0.6 + (i % 3) * 0.25)], c: i % 3 ? "#ffffff" : "#bff6ff" });
        }
        const mm = mp.build();
        mm.userData.noBounds = true;
        motes.add(mm);
        spr = K.fx.sprite(C.magicV, 2.8, 0.45);
        spr.position.y = 1.0;
        c.root.add(spr);
      }
      const rate = [0.35, 0.5, 0.7, 1.3][lv];
      return {
        update(dt, time, t) {
          spin.rotation.y = -t * rate;
          if (gear) gear.rotation.x = t * rate * 0.6;
          if (lv >= 3) {
            spin.position.y = 0.66 + Math.sin(t * 1.5) * 0.05;
            motes.rotation.y = t * 0.6;
            motes.position.y = 0.9 + Math.sin(t * 0.8) * 0.12;
            spr.scale.setScalar(2.4 + Math.sin(t * 2) * 0.3);
          }
        },
      };
    };
  }

  /* ---------------------------------------------------------------- Roue à mana */
  function roue(level) {
    return (c) => {
      const lv = level;
      const holder = K.node(c.root, 0, 0, 0);
      const glow = c.inst("glow");
      const p = K.part("mill:roue" + lv);
      const R = 1.5,
        X = 0.57;
      if (lv === 0) {
        for (const sx of [-1, 1])
          for (let i = 0; i < 4; i++) {
            const a = (i / 4) * TAU + 0.4;
            p.add(G.ico(0.035, 0), "glow", { p: [sx * X, Math.cos(a) * 1.42, Math.sin(a) * 1.42], c: C.magic });
          }
      }
      if (lv >= 1) {
        for (const sx of [-1, 1]) {
          p.add(G.ring(1.3, 1.5, 48, 10), "runes", { p: [sx * (X + 0.012), 0, 0], r: [0, 0, Math.PI / 2], c: C.magic });
          p.add(G.ring(1.33, 1.47, 48, 1), "glowAdd", { p: [sx * (X + 0.006), 0, 0], r: [0, 0, Math.PI / 2], c: "#1f6f8a" });
        }
        for (const sx of [-1, 1])
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * TAU;
            p.add(G.oct(0.05), "glow", { p: [sx * (X + 0.03), Math.cos(a) * (R + 0.02), Math.sin(a) * (R + 0.02)], c: "#bff6ff" });
          }
      }
      if (lv >= 2) {
        // Conduits lumineux le long des rayons et de l'axe.
        for (const sx of [-1, 1])
          for (let i = 0; i < 4; i++) {
            const a = (i / 4) * TAU + TAU / 8;
            p.add(G.cyl(0.035, 0.035, 1.12, 6, true), "glow", { p: [sx * (X - 0.03), Math.cos(a) * 0.76, Math.sin(a) * 0.76], r: [a, 0, 0], c: C.magic });
            p.add(G.cyl(0.055, 0.055, 1.12, 6, true), "metal", { p: [sx * (X - 0.08), Math.cos(a) * 0.76, Math.sin(a) * 0.76], r: [a, 0, 0], c: "#b8803e" });
          }
        for (const sx of [-1, 1]) p.add(G.torus(0.2, 0.05, 4, 14), "metal", { p: [sx * (X + 0.02), 0, 0], r: [0, Math.PI / 2, 0], c: "#b8803e" });
        p.add(G.cyl(0.05, 0.05, 1.6, 6, true), "glow", { p: [0.95, 0, 0], r: [0, 0, Math.PI / 2], c: C.magic });
        p.add(G.cyl(0.08, 0.08, 1.4, 8, true), "metal", { p: [1.05, 0, 0], r: [0, 0, Math.PI / 2], c: "#b8803e" });
      }
      if (lv >= 3) {
        for (const sx of [-1, 1]) p.add(G.torus(0.3, 0.04, 4, 16), "metal", { p: [sx * (X + 0.02), 0, 0], r: [0, Math.PI / 2, 0], c: C.gold });
      }
      holder.add(p.build({ mats: { glow } }));
      let heart = null,
        rings = null,
        spr = null;
      if (lv >= 3) {
        heart = K.node(c.root, 0, 0, 0);
        const hp = K.part("mill:heart");
        hp.add(G.sphere(0.3, 14, 10), "glow", { g: ["#e7fbff", "#5fd8ff", -0.3, 0.3] });
        heart.add(hp.build());
        rings = K.node(c.root, 0, 0, 0);
        const rq = K.part("mill:heartRings");
        rq.add(G.torus(0.42, 0.018, 3, 20), "glow", { c: "#c7a0ff" });
        rq.add(G.torus(0.46, 0.018, 3, 20), "glow", { r: [Math.PI / 2, 0.6, 0], c: C.magic });
        rings.add(rq.build());
        spr = K.fx.sprite(C.magic, 1.8, 0.8);
        c.root.add(spr);
      }
      const selfSpin = c.opt.spin || 0;
      return {
        update(dt, time, t) {
          if (selfSpin) c.root.rotation.x -= dt * selfSpin;
          glow.color.setScalar(1.1 + Math.sin(t * 2.5) * 0.35 * (lv >= 2 ? 1 : 0.5));
          if (heart) {
            const b = 1 + Math.max(0, Math.sin(t * 3.2)) * 0.18;
            heart.scale.setScalar(b);
            rings.rotation.set(t * 1.3, t * 0.9, 0);
            spr.scale.setScalar(1.5 + (b - 1) * 4);
          }
        },
      };
    };
  }

  /* ---------------------------------------------------------------- Atelier */
  function atelier(level) {
    return (c) => {
      const lv = level;
      const p = K.part("mill:atelier" + lv);
      const W = [2.4, 3.4, 4.2, 5.2][lv],
        D = [2.0, 2.6, 3.0, 3.6][lv],
        H = [2.0, 2.3, 2.5, 2.8][lv];
      // Corps de l'appentis : planches (0-I) ou pierre (II-III).
      const stone = lv >= 2;
      const wallMat = stone ? "stone" : "wood";
      const wallCol = stone ? C.granite : C.woodW;
      const back = -D / 2;
      p.add(G.box(W, H, 0.2), wallMat, { p: [0, H / 2, back + 0.1], c: wallCol, uv: "box", tile: stone ? 1.7 : 1.2, ao: 0.6, aoH: 1 });
      for (const sx of [-1, 1]) {
        // Mur de côté : partie droite + pignon en biais qui suit la pente de l'appentis.
        p.add(G.box(0.2, H, D), wallMat, { p: [sx * (W / 2 - 0.1), H / 2, 0], c: wallCol, uv: "box", tile: stone ? 1.7 : 1.2, ao: 0.6, aoH: 1 });
        p.add(
          G.extrude("mill:side" + lv, [
            [-D / 2, 0],
            [D / 2, 0],
            [-D / 2, 0.5],
          ], 0.2, 0),
          wallMat,
          { p: [sx * (W / 2 - 0.1), H, 0], r: [0, Math.PI / 2, 0], c: wallCol, uv: "box", tile: stone ? 1.7 : 1.2 },
        );
        p.add(G.box(0.14, H + 0.5, 0.14), "wood", { p: [sx * (W / 2 - 0.12), (H + 0.5) / 2, D / 2 - 0.07], c: C.woodD, uv: [0.2, 2] });
      }
      // Toit en appentis (ardoise), haut sur l'avant ouvert : vu d'avion, on voit l'intérieur de l'atelier.
      const ra = Math.atan2(0.5, D);
      p.add(G.box(W + 0.5, 0.12, Math.hypot(D + 0.6, 0.6)), "slate", { p: [0, H + 0.3, 0.05], r: [-ra, 0, 0], c: "#76808f", uv: "box", tile: 1.4 });
      p.add(G.box(W + 0.4, 0.14, 0.14), "wood", { p: [0, H + 0.48, D / 2 - 0.07], c: C.woodD });
      p.add(G.box(W - 0.3, 0.1, D - 0.3), "blocks", { p: [0, 0.05, 0], c: C.graniteD, uv: "box", tile: 2.6 });
      // Établi.
      const bx = lv === 0 ? 0 : -W * 0.22;
      p.add(G.box(1.5, 0.1, 0.6), "wood", { p: [bx, 0.85, back + 0.55], c: C.wood, uv: [1.5, 0.6] });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.add(G.box(0.08, 0.8, 0.08), "wood", { p: [bx + sx * 0.65, 0.4, back + 0.55 + sz * 0.22], c: C.woodD });
      p.add(G.box(0.18, 0.14, 0.2), "metal", { p: [bx + 0.55, 0.97, back + 0.4], c: C.iron });
      p.add(G.box(0.9, 0.04, 0.2), "wood", { p: [bx - 0.2, 0.92, back + 0.62], r: [0, 0.2, 0], c: "#c9a070" });
      if (lv >= 1) {
        // Râtelier d'outils au mur : scie, marteau, hache, tenailles.
        const wy = 1.55,
          wz = back + 0.22;
        p.add(G.box(1.6, 0.08, 0.06), "wood", { p: [bx, wy + 0.4, wz], c: C.woodD });
        p.add(G.box(0.55, 0.16, 0.02), "metal", { p: [bx - 0.5, wy, wz], r: [0, 0, 0.1], c: "#c8c8cc" });
        p.add(G.box(0.08, 0.3, 0.04), "wood", { p: [bx - 0.25, wy + 0.05, wz], c: C.woodD });
        p.add(G.box(0.05, 0.42, 0.04), "wood", { p: [bx, wy, wz], c: C.wood });
        p.add(G.box(0.16, 0.08, 0.08), "metal", { p: [bx, wy + 0.2, wz], c: C.iron });
        p.add(G.box(0.05, 0.5, 0.04), "wood", { p: [bx + 0.35, wy - 0.02, wz], c: C.wood });
        p.add(G.box(0.18, 0.16, 0.03), "metal", { p: [bx + 0.42, wy + 0.2, wz], c: "#b8b8bc" });
        p.add(G.box(0.03, 0.4, 0.03), "metal", { p: [bx + 0.66, wy, wz], r: [0, 0, 0.15], c: C.iron });
        p.add(G.box(0.03, 0.4, 0.03), "metal", { p: [bx + 0.7, wy, wz], r: [0, 0, -0.15], c: C.iron });
        // Tas de bûches et chevalet.
        for (let i = 0; i < 5; i++) p.add(G.cyl(0.1, 0.1, 0.9, 7), "bark", { p: [W / 2 + 0.45, 0.1 + (i >= 3 ? 0.18 : 0), -0.3 + (i % 3) * 0.21 + (i >= 3 ? 0.1 : 0)], r: [0, 0, Math.PI / 2], c: "#7a5a3a" });
        p.add(G.box(1.2, 0.06, 0.25), "wood", { p: [W * 0.1, 0.62, D / 2 + 0.5], r: [0, 0.3, 0], c: "#c9a070" });
        for (const sx of [-1, 1]) p.add(G.box(0.06, 0.6, 0.4), "wood", { p: [W * 0.1 + sx * 0.45, 0.3, D / 2 + 0.5], r: [0, 0.3, 0], c: C.woodD });
      }
      let smoke = null;
      if (lv >= 2) {
        // Forge : foyer de pierre, hotte et cheminée, enclume.
        const fx = W * 0.26,
          fz = back + 0.6;
        p.add(G.box(1.2, 0.8, 1.0), "blocks", { p: [fx, 0.4, fz], c: C.dressed, uv: "box", tile: 2 });
        p.add(G.box(0.8, 0.12, 0.6), "glow", { p: [fx, 0.82, fz + 0.05], c: C.fire });
        p.add(G.cyl(0.25, 0.6, 0.6, 4), "stone", { p: [fx, 1.6, fz - 0.05], r: [0, Math.PI / 4, 0], c: C.graniteD, uv: "box", tile: 1.5 });
        p.add(G.box(0.5, 1.9, 0.5), "stone", { p: [fx, H + 0.6, fz - 0.1], c: C.granite, uv: "box", tile: 1.5 });
        p.add(G.box(0.62, 0.12, 0.62), "blocks", { p: [fx, H + 1.58, fz - 0.1], c: C.dressed });
        const anvil = [
          [-0.34, 0.2],
          [-0.18, 0.12],
          [0.3, 0.12],
          [0.3, 0.2],
          [0.14, 0.2],
          [0.08, 0.02],
          [0.16, -0.12],
          [-0.16, -0.12],
          [-0.08, 0.02],
          [-0.14, 0.12],
        ];
        p.add(G.extrude("mill:anvil", anvil, 0.2, 0), "metal", { p: [W * 0.05, 0.62, D / 2 - 0.35], c: "#3a3a40" });
        p.add(G.cyl(0.16, 0.2, 0.5, 8), "wood", { p: [W * 0.05, 0.25, D / 2 - 0.35], c: C.woodD });
        p.add(G.cyl(0.3, 0.3, 0.5, 10), "wood", { p: [-W / 2 - 0.45, 0.25, D / 2 - 0.4], c: "#8a5a33", uv: [2, 0.5] });
        p.add(G.discUp(0.27, 10), "water", { p: [-W / 2 - 0.45, 0.46, D / 2 - 0.4] });
        smoke = [];
      }
      if (lv >= 3) {
        // Râtelier de pièces de tours suspendues.
        const rx = -W * 0.28;
        for (const sx of [-1, 1]) p.add(G.box(0.12, 2.3, 0.12), "wood", { p: [rx + sx * 1.0, 1.15, D / 2 + 0.9], c: C.woodD });
        p.add(G.box(2.2, 0.12, 0.12), "wood", { p: [rx, 2.3, D / 2 + 0.9], c: C.woodD });
        for (const dx of [-0.65, 0, 0.65]) p.add(G.cyl(0.01, 0.01, 0.5, 3), "metal", { p: [rx + dx, 2.05, D / 2 + 0.9], c: "#8a8a8a" });
        // Tête de dragon miniature.
        p.add(G.rbox(0.36, 0.26, 0.4, 0.08), "iron", { p: [rx - 0.65, 1.65, D / 2 + 0.9], c: C.red, uv: [1, 1] });
        p.add(G.rbox(0.26, 0.14, 0.24, 0.05), "iron", { p: [rx - 0.65, 1.6, D / 2 + 1.16], c: "#cf6a45" });
        for (const sx of [-1, 1]) p.add(G.cone(0.04, 0.2, 5), "glossy", { p: [rx - 0.65 + sx * 0.12, 1.84, D / 2 + 0.82], r: [-0.6, 0, sx * 0.3], c: "#f3e6c8" });
        // Cristal de glace.
        p.add(G.crystal(0.12, 0.3, 6, 0.2, 0.15), "ice", { p: [rx, 1.55, D / 2 + 0.9], g: ["#2e7fd6", "#c9f1ff", -0.1, 0.5] });
        // Tête de gargouille / pale de ventilateur.
        p.add(G.sphere(0.17, 8, 6), "stone", { p: [rx + 0.65, 1.66, D / 2 + 0.9], c: "#a7b09b" });
        p.add(G.cyl(0.04, 0.05, 0.16, 6), "metal", { p: [rx + 0.65, 1.62, D / 2 + 1.1], r: [Math.PI / 2, 0, 0], c: "#b8803e" });
        // Soufflet (bâti).
        p.add(G.box(0.3, 0.5, 0.3), "wood", { p: [W * 0.26 + 0.95, 0.25, back + 0.6], c: C.woodD });
      }
      const glow = c.inst("glow");
      c.root.add(p.build({ mats: { glow } }));
      // Animations.
      let bellows = null,
        hammer = null,
        sparks = null,
        fireSpr = null;
      if (lv >= 2) {
        smoke = [];
        for (let i = 0; i < 3; i++) {
          const m = K.fx.smoke("#8f8780", 1, 0.6);
          c.root.add(m);
          smoke.push(m);
        }
        fireSpr = K.fx.sprite(C.fire, lv >= 3 ? 2.2 : 1.4, 0.8);
        fireSpr.position.set(W * 0.26, 1.0, back + 0.7);
        c.root.add(fireSpr);
      }
      if (lv >= 3) {
        bellows = K.node(c.root, W * 0.26 + 0.95, 0.55, back + 0.6);
        const bp = K.part("mill:bellows");
        bp.add(
          G.extrude("mill:bellowsBoard", [
            [0, -0.25],
            [0.55, -0.12],
            [0.62, 0],
            [0.55, 0.12],
            [0, 0.25],
          ], 0.04, 0),
          "wood",
          { r: [Math.PI / 2, 0, 0], c: C.wood },
        );
        bellows.add(bp.build());
        const leather = K.node(c.root, W * 0.26 + 0.95, 0.5, back + 0.6);
        const lp = K.part("mill:leather");
        lp.add(G.cyl(0.24, 0.24, 0.1, 10), "satin", { p: [0.25, 0, 0], s: [1.2, 1, 0.9], c: "#5a3a26" });
        leather.add(lp.build());
        bellows.userData.leather = leather;
        hammer = K.node(c.root, W * 0.05 - 0.45, 1.05, D / 2 - 0.35);
        const hp = K.part("mill:hammer");
        hp.add(G.cyl(0.025, 0.03, 0.55, 6), "wood", { p: [0.27, 0, 0], r: [0, 0, Math.PI / 2], c: C.wood });
        hp.add(G.box(0.12, 0.2, 0.12), "metal", { p: [0.55, 0, 0], c: "#2f2f34" });
        hp.add(G.box(0.02, 0.2, 0.14), "glow", { p: [0.55, 0, 0], s: [4, 1.05, 1.05], c: C.magic });
        hammer.add(hp.build({ mats: { glow } }));
        sparks = K.node(c.root, W * 0.05, 0.84, D / 2 - 0.35);
        const sp = K.part("mill:sparks");
        for (let i = 0; i < 7; i++) {
          const a = i * 2.39996;
          sp.add(G.oct(0.03), "glow", { p: [Math.cos(a) * 0.25 * (0.5 + (i % 3) * 0.3), 0.1 + (i % 4) * 0.08, Math.sin(a) * 0.25 * (0.5 + (i % 3) * 0.3)], c: i % 2 ? "#ffd27a" : "#ff8a2a" });
        }
        const sm = sp.build();
        sm.userData.noBounds = true;
        sparks.add(sm);
      }
      return {
        update(dt, time, t) {
          glow.color.setScalar(1.3 + wob(t * 4, 1) * 0.3 + (bellows ? Math.max(0, Math.sin(t * 2.2)) * 0.6 : 0));
          if (fireSpr) fireSpr.scale.setScalar((lv >= 3 ? 2.0 : 1.3) + wob(t * 5, 2) * 0.2);
          if (smoke)
            for (let i = 0; i < smoke.length; i++) {
              const ph = (t * 0.3 + i / smoke.length) % 1;
              smoke[i].position.set(W * 0.26 + ph * 0.5, H + 1.7 + ph * 2.2, back + 0.5 - ph * 0.2);
              smoke[i].scale.setScalar(Math.max(0.001, Math.sin(ph * Math.PI) * (0.6 + ph * 1.2) * 0.75));
            }
          if (bellows) {
            const pump = Math.sin(t * 2.2);
            bellows.rotation.z = 0.12 + pump * 0.12;
            bellows.userData.leather.scale.set(1, 1 + pump * 0.8, 1);
            const cyc = (t * 1.1) % 1;
            const strike = cyc < 0.7 ? -0.9 * Math.sin((cyc / 0.7) * Math.PI * 0.5) : -0.9 + (cyc - 0.7) / 0.3 * 0.9;
            hammer.rotation.z = strike + 0.35;
            const hit = cyc < 0.25 ? 1 - cyc / 0.25 : 0;
            sparks.visible = hit > 0.02;
            if (sparks.visible) {
              sparks.scale.setScalar(0.5 + (1 - hit) * 1.8);
              sparks.position.y = 0.84 + (1 - hit) * 0.3;
              sparks.rotation.y = t * 3;
            }
          }
        },
      };
    };
  }

  PTMT.models.millUpgrade = function (kind, level, opt) {
    const lv = clamp(level | 0, 0, 3);
    const f = { meule, roue, atelier }[kind];
    if (!f) throw new Error("PTMT : amélioration du moulin inconnue " + kind);
    return shell(kind + lv, f(lv), opt);
  };

})();
