// « Pas touche à mes trésors » — bâtiments de stockage (réserves des trésors).
//
//   PTMT.models.building(kind)  kind : "grange" | "cabane" | "pilotis" | "sanctuaire" | "crypte"
//   → { object, height, footprint: [[x, z], ...] (polygone au sol, mètres locaux, pour bloquer la vue),
//       door: { x, z, yaw } (point au sol juste devant la porte ; yaw = direction vers laquelle la porte
//       s'ouvre sur l'extérieur, 0 = +Z), chestSlot: { x, y, z } (où poser le coffre, près de la porte),
//       update(dt, time), dispose() }
//
// Dans l'esprit du moulin breton : moellons de granit, ardoises, bois gris, avec des touches de magie
// (runes lumineuses, lanternes à flamme bleue, cristaux, feux follets).
(function () {
  "use strict";
  const PTMT = globalThis.PTMT;
  if (!PTMT || !PTMT.models || !PTMT.models.kit) return;
  const K = PTMT.models.kit,
    G = K.g;
  const { TAU, lerp, wob } = K.math;

  const C = {
    granite: "#cdc5b3",
    graniteD: "#a39b8a",
    dressed: "#c9c2b2",
    slate: "#76808f",
    slateD: "#4a5260",
    wood: "#9c8672",
    woodD: "#6e5c4c",
    woodW: "#a6927c",
    iron: "#3f3b38",
    moss: "#5f8a34",
    mossL: "#86a846",
    grass: "#6f9a3c",
    hay: "#e6c35c",
    magic: "#7fe8ff",
    magicV: "#c77dff",
    flame: "#7fd8ff",
    window: "#ffcf7a",
    door: "#6a4c35",
    purple: "#5b3f8a",
    gold: "#f2b52e",
  };

  /* ---------------------------------------------------------------- aides d'architecture */
  function wall(p, x, y, z, w, h, d, tint, ry) {
    p.add(G.box(w, h, d), "stone", { p: [x, y + h / 2, z], r: [0, ry || 0, 0], c: tint || C.granite, uv: "box", tile: 1.7, ao: 0.6, aoH: 1.2 });
  }
  /** Chaînages d'angle (pierres de taille claires en alternance). */
  function quoins(p, x, z, h, sx, sz) {
    const n = Math.floor(h / 0.36);
    for (let i = 0; i < n; i++) {
      const long = i % 2 === 0;
      p.add(G.box(long ? 0.62 : 0.36, 0.33, long ? 0.36 : 0.62), "blocks", {
        p: [x + sx * (long ? -0.12 : 0.01), 0.18 + i * 0.36, z + sz * (long ? 0.01 : -0.12)],
        c: C.dressed,
        uv: "box",
        tile: 2.4,
        j: 0.06,
      });
    }
  }
  /** Toit à deux pans (faîtage selon X) : ardoises, faîtière, pignons de pierre. */
  function gableRoof(p, L, W, rise, over, y0, gableTint) {
    const slope = Math.atan2(rise, W / 2);
    const run = W / 2 + over;
    const drop = over * Math.tan(slope);
    const len = Math.hypot(run, rise + drop);
    for (const s of [-1, 1]) {
      p.add(G.box(L + over * 2, 0.12, len), "slate", {
        p: [0, y0 + (rise - drop) / 2 + 0.06, (s * run) / 2],
        r: [s * slope, 0, 0],
        c: C.slate,
        uv: "box",
        tile: 1.4,
      });
    }
    p.add(G.box(L + over * 2 + 0.05, 0.2, 0.2), "slate", { p: [0, y0 + rise + 0.1, 0], r: [Math.PI / 4, 0, 0], c: C.slateD });
    const tri = [
      [-W / 2, 0],
      [W / 2, 0],
      [0, rise],
    ];
    for (const sx of [-1, 1]) p.add(G.extrude("bld:gable" + W + "," + rise, tri, 0.5, 0), "stone", { p: [(sx * (L - 0.5)) / 2, y0, 0], r: [0, Math.PI / 2, 0], c: gableTint || C.granite, uv: "box", tile: 1.7 });
  }
  /** Porte en planches dans un encadrement de granite (face +Z à z). */
  function doorway(p, x, z, w, h, opt) {
    const o = opt || {};
    p.add(G.box(w + 0.1, h + 0.05, 0.12), "matte", { p: [x, h / 2, z - 0.03], c: "#1d1612" });
    for (const sx of [-1, 1]) p.add(G.box(0.32, h + 0.1, 0.26), "blocks", { p: [x + sx * (w / 2 + 0.16), (h + 0.1) / 2, z], c: C.dressed, uv: "box", tile: 2.2 });
    p.add(G.box(w + 0.9, 0.4, 0.3), "blocks", { p: [x, h + 0.25, z], c: C.dressed, uv: "box", tile: 2.2 });
    if (!o.noLeaf) {
      p.add(G.box(w, h, 0.08), "wood", { p: [x, h / 2, z + 0.02], c: o.color || C.door, uv: [w * 1.4, h * 1.1] });
      for (const y of [0.3, h - 0.35]) p.add(G.box(w * 0.8, 0.07, 0.03), "metal", { p: [x - w * 0.08, y, z + 0.08], c: C.iron });
      p.add(G.torus(0.06, 0.015, 3, 8), "metal", { p: [x + w * 0.32, h * 0.5, z + 0.09], c: C.iron });
    }
  }
  /** Fenêtre à petits carreaux (lumière chaude) dans un encadrement de pierre. */
  function windowAt(p, x, y, z, w, h, ry, lit) {
    const m = new THREE.Matrix4().makeRotationY(ry || 0);
    const at = (dx, dy, dz) => new THREE.Vector3(dx, dy, dz).applyMatrix4(m).add(new THREE.Vector3(x, y, z));
    const q = (v) => [v.x, v.y, v.z];
    p.add(G.box(w + 0.22, h + 0.22, 0.14), "blocks", { p: q(at(0, 0, 0)), r: [0, ry || 0, 0], c: C.dressed, uv: "box", tile: 2 });
    p.add(G.box(w, h, 0.05), lit ? "glow" : "matte", { p: q(at(0, 0, 0.05)), r: [0, ry || 0, 0], c: lit ? C.window : "#1c2230" });
    p.add(G.box(0.04, h, 0.04), "wood", { p: q(at(0, 0, 0.09)), r: [0, ry || 0, 0], c: C.woodD });
    p.add(G.box(w, 0.04, 0.04), "wood", { p: q(at(0, 0, 0.09)), r: [0, ry || 0, 0], c: C.woodD });
  }
  /** Lanterne à flamme magique (bleue) ; renvoie la flamme à animer. */
  function lantern(parent, key, x, y, z, flameMat, col) {
    const n = K.node(parent, x, y, z);
    const p = K.part("bld:lantern");
    p.add(G.box(0.26, 0.03, 0.26), "metal", { p: [0, 0, 0], c: C.iron });
    p.add(G.cone(0.2, 0.16, 4), "metal", { p: [0, 0.4, 0], r: [0, Math.PI / 4, 0], c: C.iron });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.add(G.box(0.025, 0.32, 0.025), "metal", { p: [sx * 0.11, 0.17, sz * 0.11], c: C.iron });
    p.add(G.torus(0.05, 0.012, 3, 8), "metal", { p: [0, 0.52, 0], c: C.iron });
    n.add(p.build());
    const f = K.part("bld:flame" + key);
    f.add(G.flame(0.07, 0.2, 7), "glow", { p: [0, 0.04, 0], g: ["#ffffff", col || C.flame, 0.02, 0.18] });
    const fm = f.build({ mats: { glow: flameMat } });
    n.add(fm);
    const s = K.fx.sprite(col || C.flame, 0.9, 0.6);
    s.position.y = 0.16;
    n.add(s);
    return { n, fm, s };
  }
  function puffs(parent, n, size, col) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const pp = K.part("bld:puff" + col);
      pp.add(G.blob(size, 0, 0.1, 3), "matte", { c: col });
      const m = pp.build({ cast: false });
      m.userData.noBounds = true;
      parent.add(m);
      out.push(m);
    }
    return out;
  }
  function animPuffs(list, t, x, y, z, rise, speed) {
    for (let i = 0; i < list.length; i++) {
      const ph = (t * speed + i / list.length) % 1;
      list[i].position.set(x + Math.sin(ph * 4 + i) * 0.1 + ph * 0.3, y + ph * rise, z);
      list[i].scale.setScalar(Math.max(0.001, Math.sin(ph * Math.PI) * (0.6 + ph)));
    }
  }
  function mossBits(p, pts) {
    pts.forEach((q, i) => p.add(G.blob(q[3], 0, 0.25, 200 + i), "matte", { p: [q[0], q[1], q[2]], s: [1.4, 0.4, 1], c: i % 2 ? C.moss : C.mossL }));
  }
  /** Une rune lumineuse (un glyphe de la bande) sur un plan. */
  function rune(p, x, y, z, size, ry, k, col) {
    p.add(
      () => {
        const g = new THREE.PlaneGeometry(size, size);
        const uv = g.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setX(i, (k + uv.getX(i)) / 8);
        return g;
      },
      "runes",
      { p: [x, y, z], r: [0, ry || 0, 0], c: col || C.magic },
    );
  }

  function shell(kind, build) {
    const root = new THREE.Group();
    root.name = "ptmt-building-" + kind;
    const owned = [];
    const ctx = {
      root,
      inst(name) {
        const m = K.mat(name).clone();
        owned.push(m);
        return m;
      },
    };
    const b = build(ctx);
    let t = 0;
    return {
      object: root,
      kind,
      height: Math.round(K.solidTop(root) * 100) / 100,
      footprint: b.footprint,
      door: b.door,
      chestSlot: b.chestSlot,
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
  const rect = (x0, z0, x1, z1) => [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ];
  const ngon = (r, n, cx, cz) => {
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      out.push([Math.round((cx + Math.sin(a) * r) * 100) / 100, Math.round((cz + Math.cos(a) * r) * 100) / 100]);
    }
    return out;
  };

  /* ---------------------------------------------------------------- Grange */
  function grange(c) {
    const L = 8,
      W = 5.4,
      H = 3.0;
    const p = K.part("bld:grange");
    wall(p, 0, 0, -W / 2 + 0.25, L, H, 0.5);
    wall(p, -2.6, 0, W / 2 - 0.25, 2.8, H, 0.5);
    wall(p, 2.6, 0, W / 2 - 0.25, 2.8, H, 0.5);
    wall(p, 0, 2.55, W / 2 - 0.25, 2.4, H - 2.55, 0.5);
    for (const sx of [-1, 1]) wall(p, sx * (L / 2 - 0.25), 0, 0, 0.5, H, W - 1);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) quoins(p, sx * (L / 2 - 0.3), sz * (W / 2 - 0.3), H, sx, sz);
    p.add(G.box(L + 0.1, 0.25, W + 0.1), "blocks", { p: [0, 0.12, 0], c: C.graniteD, uv: "box", tile: 2.4, ao: 0.5, aoH: 0.3 });
    gableRoof(p, L, W, 2.7, 0.35, H);
    // Grand portail : cadre, linteau, vantaux (l'un entrouvert).
    p.add(G.box(2.4, 2.4, 0.1), "matte", { p: [0, 1.2, W / 2 - 0.4], c: "#1a1410" });
    p.add(G.box(3.1, 0.42, 0.56), "blocks", { p: [0, 2.72, W / 2 - 0.25], c: C.dressed, uv: "box", tile: 2.4 });
    p.add(G.box(1.18, 2.36, 0.1), "wood", { p: [-0.6, 1.2, W / 2 - 0.2], c: C.wood, uv: [1.6, 2.4] });
    p.add(G.box(1.18, 2.36, 0.1), "wood", { p: [1.02, 1.2, W / 2 + 0.25], r: [0, -0.75, 0], c: C.wood, uv: [1.6, 2.4] });
    for (const y of [0.45, 1.95]) {
      p.add(G.box(1.0, 0.08, 0.04), "metal", { p: [-0.62, y, W / 2 - 0.14], c: C.iron });
      p.add(G.box(1.0, 0.08, 0.04), "metal", { p: [1.04, y, W / 2 + 0.3], r: [0, -0.75, 0], c: C.iron });
    }
    // Lucarne de fenil avec poutre de levage.
    p.add(G.box(1.5, 1.3, 1.2), "stone", { p: [0, H + 0.55, W / 2 - 0.55], c: C.granite, uv: "box", tile: 1.7 });
    for (const s of [-1, 1]) p.add(G.box(0.95, 0.1, 1.5), "slate", { p: [s * 0.42, H + 1.45, W / 2 - 0.5], r: [0, 0, -s * 0.72], c: C.slate, uv: "box", tile: 1.4 });
    p.add(G.box(0.9, 0.85, 0.08), "wood", { p: [0, H + 0.45, W / 2 + 0.07], c: C.woodD, uv: [1, 1] });
    p.add(G.box(0.14, 0.14, 1.3), "wood", { p: [0, H + 1.12, W / 2 + 0.3], c: C.woodD });
    p.add(G.cyl(0.012, 0.012, 1.1, 4), "matte", { p: [0, H + 0.55, W / 2 + 0.88], c: "#d9bf86" });
    p.add(G.torus(0.06, 0.015, 3, 8, Math.PI * 1.4), "metal", { p: [0, H - 0.03, W / 2 + 0.88], c: C.iron });
    // Fenêtres latérales.
    windowAt(p, -2.6, 1.7, W / 2 + 0.01, 0.6, 0.7, 0, false);
    windowAt(p, 2.6, 1.7, W / 2 + 0.01, 0.6, 0.7, 0, true);
    // Clé de voûte runique.
    rune(p, 0, 2.72, W / 2 + 0.035, 0.34, 0, 3, C.magic);
    // Bottes de foin.
    for (const [x, z, r] of [
      [-3.6, W / 2 + 0.6, 0.2],
      [-3.0, W / 2 + 0.9, -0.3],
      [-3.35, W / 2 + 0.75, 0.1],
    ])
      p.add(G.rbox(0.9, 0.5, 0.55, 0.08), "burlap", { p: [x, z === W / 2 + 0.75 ? 0.75 : 0.25, z], r: [0, r, 0], c: C.hay, uv: "box", tile: 0.5 });
    mossBits(p, [
      [3.6, 0.3, W / 2 + 0.05, 0.3],
      [-3.9, 0.4, -1.5, 0.35],
      [1.2, H + 0.4, -1.8, 0.4],
    ]);
    const flameMat = c.inst("glow");
    c.root.add(p.build({ mats: { glow: c.inst("glow") } }));
    const lan = lantern(c.root, "g", 1.45, 2.05, W / 2 + 0.3, flameMat);
    const bp = K.part("bld:bracket");
    bp.add(G.box(0.05, 0.05, 0.4), "metal", { p: [1.45, 2.62, W / 2 + 0.1], c: C.iron });
    c.root.add(bp.build());
    return {
      footprint: rect(-L / 2 - 0.05, -W / 2 - 0.05, L / 2 + 0.05, W / 2 + 0.05),
      door: { x: 0, z: W / 2 + 0.7, yaw: 0 },
      chestSlot: { x: 2.3, y: 0, z: W / 2 + 1.0 },
      update(dt, time, t) {
        const f = 1.4 + wob(t * 6, 1) * 0.35;
        flameMat.color.setScalar(f);
        lan.fm.scale.set(1, 0.9 + wob(t * 8, 2) * 0.2, 1);
        lan.s.scale.setScalar(0.8 + wob(t * 5, 3) * 0.1);
      },
    };
  }

  /* ---------------------------------------------------------------- Cabane du sorcier */
  function cabane(c) {
    const R = 2.3,
      H = 2.3;
    const p = K.part("bld:cabane");
    p.add(G.cyl(R, R + 0.1, H, 16), "stone", { p: [0, H / 2, 0], c: "#c3bba8", uv: [9, 1.4], ao: 0.55, aoH: 1 });
    p.add(G.cyl(R + 0.06, R + 0.06, 0.22, 16), "wood", { p: [0, H - 0.05, 0], c: C.woodD, uv: [8, 0.2] });
    // Toit en chapeau de sorcier, pointe tordue.
    p.add(
      () => {
        const g = new THREE.ConeGeometry(R + 0.55, 4.6, 16, 8, true);
        const pos = g.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const y = pos.getY(i) + 2.3,
            t = y / 4.6;
          const k = t * t * t;
          pos.setX(i, pos.getX(i) - k * 1.1);
          pos.setZ(i, pos.getZ(i) + k * 0.35);
          pos.setY(i, pos.getY(i) - k * 0.5);
          // Rebord légèrement relevé.
          if (t < 0.05) pos.setY(i, pos.getY(i) + 0.12);
        }
        g.computeVertexNormals();
        return g;
      },
      "slate",
      { p: [0, H + 2.18, 0], c: "#6f6a92", uv: [9, 5] },
    );
    p.add(G.star(5, 0.28, 0.12, 0.06), "glow", { p: [-1.1, H + 4.35, 0.35], r: [0, 0.4, 0.3], c: "#ffe27a" });
    // Porte en arc (bleu nuit, étoile dorée).
    p.add(G.box(1.0, 1.8, 0.2), "matte", { p: [0, 0.9, R - 0.02], c: "#140f1c" });
    p.add(G.rbox(0.95, 1.75, 0.08, 0.03), "wood", { p: [0, 0.9, R + 0.06], c: "#3b4f8a", uv: [1, 1.6] });
    p.add(G.torus(0.52, 0.09, 4, 12, Math.PI), "blocks", { p: [0, 1.78, R + 0.02], c: C.dressed, uv: [1, 0.2] });
    p.add(G.star(5, 0.12, 0.05, 0.02), "gold", { p: [0, 1.3, R + 0.11], c: C.gold });
    p.add(G.sphere(0.04, 6, 4), "gold", { p: [0.32, 0.9, R + 0.12], c: C.gold });
    // Hublots lumineux.
    for (const a of [0.9, -0.9, 2.4]) {
      const x = Math.sin(a) * (R + 0.03),
        z = Math.cos(a) * (R + 0.03);
      p.add(G.disc(0.28, 14), "glow", { p: [x, 1.45, z], r: [0, a, 0], c: a === 2.4 ? "#c7a0ff" : C.window });
      p.add(G.torus(0.3, 0.06, 4, 14), "wood", { p: [x, 1.45, z], r: [0, a, 0], c: C.woodD });
    }
    // Cheminée tordue.
    p.add(G.cyl(0.26, 0.32, 1.8, 8), "stone", { p: [1.25, H + 1.2, -0.9], r: [0.1, 0, -0.18], c: C.graniteD, uv: [1.5, 1] });
    p.add(G.cyl(0.34, 0.3, 0.2, 8), "stone", { p: [1.42, H + 2.1, -0.82], r: [0.1, 0, -0.18], c: C.dressed });
    // Boule de cristal sur son pied, cercle runique sur le seuil.
    p.add(G.cyl(0.08, 0.14, 0.9, 6), "wood", { p: [1.35, 0.45, R + 0.55], c: C.woodD });
    p.add(G.ring(0.55, 0.9, 32, 4), "runes", { p: [0, 0.03, R + 0.55], c: C.magicV });
    p.add(G.cyl(R + 0.35, R + 0.45, 0.12, 16), "blocks", { p: [0, 0.06, 0], c: C.graniteD, uv: "box", tile: 2 });
    // Champignons.
    for (const [x, z, s] of [
      [-1.9, 1.6, 1],
      [-2.2, 1.2, 0.7],
      [-1.6, 1.95, 0.8],
    ]) {
      p.add(G.cyl(0.04 * s, 0.05 * s, 0.18 * s, 6), "matte", { p: [x, 0.09 * s, z], c: "#f2ead8" });
      p.add(G.sphere(0.12 * s, 8, 4, 0, Math.PI / 2), "satin", { p: [x, 0.17 * s, z], s: [1, 0.7, 1], c: "#d8324a" });
    }
    mossBits(p, [
      [-1.8, H + 0.3, 1.2, 0.35],
      [2.0, 0.2, 1.1, 0.3],
    ]);
    const glowMat = c.inst("glow");
    c.root.add(p.build({ mats: { glow: glowMat } }));
    const ball = K.node(c.root, 1.35, 1.05, R + 0.55);
    const bb = K.part("bld:ball");
    bb.add(G.sphere(0.2, 12, 9), "iceSoft", { c: "#c7a0ff" });
    ball.add(bb.build());
    const ballSpr = K.fx.sprite(C.magicV, 1.0, 0.7);
    ball.add(ballSpr);
    const smoke = puffs(c.root, 3, 0.2, "#b58cff");
    return {
      footprint: ngon(R + 0.12, 12, 0, 0),
      door: { x: 0, z: R + 0.8, yaw: 0 },
      chestSlot: { x: -1.25, y: 0, z: R + 0.85 },
      update(dt, time, t) {
        glowMat.color.setScalar(1.2 + wob(t * 2, 1) * 0.2);
        ball.position.y = 1.05 + Math.sin(t * 1.6) * 0.05;
        ballSpr.scale.setScalar(0.9 + Math.sin(t * 2.3) * 0.15);
        animPuffs(smoke, t, 1.5, H + 2.25, -0.8, 1.8, 0.28);
      },
    };
  }

  /* ---------------------------------------------------------------- Entrepôt sur pilotis */
  function pilotis(c) {
    const DH = 1.5;
    const p = K.part("bld:pilotis");
    for (const x of [-3.2, 0, 3.2])
      for (const z of [-2.3, 0, 2.3]) {
        p.add(G.cyl(0.13, 0.15, DH + 0.1, 7), "bark", { p: [x, (DH + 0.1) / 2, z], c: "#6f5a46", uv: [0.5, 1], ao: 0.4, aoH: 0.6 });
      }
    for (const z of [-2.3, 2.3])
      for (const s of [-1, 1]) p.add(G.box(3.4, 0.1, 0.08), "wood", { p: [s * 1.6, DH * 0.5, z], r: [0, 0, s * 0.38], c: C.woodD, uv: [2, 0.2] });
    p.add(G.box(7.0, 0.18, 5.0), "wood", { p: [0, DH, 0], c: C.woodW, uv: [5, 3.5] });
    // Corps de l'entrepôt en planches.
    const bw = 6.0,
      bd = 3.6,
      bh = 2.5,
      bz = -0.55;
    for (const [x, z, w, d] of [
      [0, bz - bd / 2 + 0.06, bw, 0.12],
      [-bw / 2 + 0.06, bz, 0.12, bd],
      [bw / 2 - 0.06, bz, 0.12, bd],
      [-1.95, bz + bd / 2 - 0.06, 2.1, 0.12],
      [1.95, bz + bd / 2 - 0.06, 2.1, 0.12],
      [0, bz + bd / 2 - 0.06, 1.8, 0.12],
    ])
      p.add(G.box(w, x === 0 && z > bz ? 0.5 : bh, d), "wood", { p: [x, DH + 0.09 + (x === 0 && z > bz ? bh - 0.25 : bh / 2), z], c: C.woodW, uv: "box", tile: 1.2, ao: 0.7, aoH: DH + 0.6 });
    // Poteaux d'angle.
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.add(G.box(0.18, bh, 0.18), "wood", { p: [sx * (bw / 2 - 0.06), DH + 0.09 + bh / 2, bz + sz * (bd / 2 - 0.06)], c: C.woodD, uv: [0.3, 2] });
    // Toit d'ardoise (le pignon est en planches).
    const y0 = DH + 0.09 + bh;
    const slope = 0.62,
      run = bd / 2 + 0.5,
      rise = (bd / 2) * Math.tan(slope);
    for (const s of [-1, 1]) p.add(G.box(bw + 0.8, 0.12, Math.hypot(run, run * Math.tan(slope))), "slate", { p: [0, y0 + rise - (run * Math.tan(slope)) / 2 + 0.06, bz + (s * run) / 2], r: [s * slope, 0, 0], c: C.slate, uv: "box", tile: 1.4 });
    p.add(G.box(bw + 0.85, 0.18, 0.18), "slate", { p: [0, y0 + rise + 0.08, bz], r: [Math.PI / 4, 0, 0], c: C.slateD });
    const tri = [
      [-bd / 2, 0],
      [bd / 2, 0],
      [0, rise],
    ];
    for (const sx of [-1, 1]) p.add(G.extrude("bld:pgable", tri, 0.12, 0), "wood", { p: [sx * (bw / 2 - 0.06), y0, bz], r: [0, Math.PI / 2, 0], c: C.woodW, uv: "box", tile: 1.2 });
    // Porte coulissante entrouverte.
    p.add(G.box(1.8, bh - 0.5, 0.05), "matte", { p: [0, DH + 0.09 + (bh - 0.5) / 2, bz + bd / 2 - 0.1], c: "#1a1410" });
    p.add(G.box(1.2, bh - 0.55, 0.08), "wood", { p: [0.75, DH + 0.09 + (bh - 0.55) / 2, bz + bd / 2 + 0.04], c: C.wood, uv: [1.4, 2] });
    p.add(G.box(2.6, 0.08, 0.08), "metal", { p: [0.3, DH + bh - 0.3, bz + bd / 2 + 0.08], c: C.iron });
    // Rampe d'accès.
    const rampLen = Math.hypot(2.7, DH);
    const ra = Math.atan2(DH, 2.7);
    p.add(G.box(1.4, 0.1, rampLen), "wood", { p: [0, DH / 2 + 0.02, 2.5 + 1.35], r: [ra, 0, 0], c: C.woodW, uv: [1.5, rampLen] });
    for (let i = 0; i < 6; i++) p.add(G.box(1.45, 0.04, 0.06), "wood", { p: [0, DH - (i + 0.5) * (DH / 6) + 0.08, 2.5 + (i + 0.5) * (2.7 / 6)], c: C.woodD });
    // Caisses, tonneaux, grue.
    for (const [x, z, s, r] of [
      [-2.6, 1.9, 0.6, 0.2],
      [-2.0, 2.05, 0.5, -0.3],
      [2.7, 1.8, 0.55, 0.1],
    ])
      p.add(G.box(s, s, s), "wood", { p: [x, DH + 0.09 + s / 2, z], r: [0, r, 0], c: "#b0875a", uv: "box", tile: 0.7 });
    p.add(G.cyl(0.28, 0.28, 0.7, 10), "wood", { p: [2.2, DH + 0.44, 2.05], c: "#8a5a33", uv: [2, 1] });
    p.add(G.torus(0.285, 0.025, 3, 10), "metal", { p: [2.2, DH + 0.24, 2.05], r: [Math.PI / 2, 0, 0], c: C.iron });
    p.add(G.torus(0.285, 0.025, 3, 10), "metal", { p: [2.2, DH + 0.64, 2.05], r: [Math.PI / 2, 0, 0], c: C.iron });
    p.add(G.box(0.14, 0.14, 1.6), "wood", { p: [-bw / 2 - 0.6, y0 + 0.4, bz], r: [0, Math.PI / 2, 0], c: C.woodD });
    p.add(G.cyl(0.012, 0.012, 1.5, 4), "matte", { p: [-bw / 2 - 1.3, y0 - 0.35, bz], c: "#d9bf86" });
    p.add(G.box(0.4, 0.3, 0.4), "wood", { p: [-bw / 2 - 1.3, y0 - 1.2, bz], c: "#b0875a", uv: "box", tile: 0.7 });
    // Caisse runique (touche de magie).
    rune(p, -2.6, DH + 0.4, 2.21, 0.36, 0.2, 5, C.magic);
    const flameMat = c.inst("glow");
    c.root.add(p.build());
    const lans = [lantern(c.root, "p1", -0.95, DH + 0.1, 2.35, flameMat), lantern(c.root, "p2", 0.95, DH + 0.1, 2.35, flameMat)];
    return {
      footprint: rect(-3.1, bz - bd / 2, 3.1, bz + bd / 2),
      door: { x: 0, z: 5.55, yaw: 0 },
      chestSlot: { x: -1.2, y: DH + 0.09, z: 1.9 },
      update(dt, time, t) {
        flameMat.color.setScalar(1.4 + wob(t * 6, 1) * 0.3);
        for (let i = 0; i < 2; i++) lans[i].fm.scale.set(1, 0.9 + wob(t * 8, i + 2) * 0.2, 1);
      },
    };
  }

  /* ---------------------------------------------------------------- Sanctuaire de l'île */
  function sanctuaire(c) {
    const p = K.part("bld:sanctuaire");
    p.add(G.cyl(3.1, 3.2, 0.26, 20), "blocks", { p: [0, 0.13, 0], c: C.graniteD, uv: "box", tile: 2.4, ao: 0.6, aoH: 0.3 });
    p.add(G.cyl(2.7, 2.78, 0.26, 20), "blocks", { p: [0, 0.39, 0], c: C.dressed, uv: "box", tile: 2.4 });
    for (let i = 0; i < 4; i++) p.add(G.box(1.8, 0.13 * (i + 1), 0.4), "blocks", { p: [0, 0.065 * (i + 1), 3.55 - i * 0.2], c: C.dressed, uv: "box", tile: 2 });
    const colR = 2.25;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + TAU / 12;
      const x = Math.sin(a) * colR,
        z = Math.cos(a) * colR;
      p.add(G.cyl(0.3, 0.34, 0.22, 8), "blocks", { p: [x, 0.63, z], c: C.dressed, uv: "box", tile: 2 });
      p.add(G.cyl(0.2, 0.24, 2.4, 10), "blocks", { p: [x, 1.94, z], c: C.granite, uv: [1, 2.2], j: 0.05 });
      p.add(G.cyl(0.34, 0.24, 0.24, 8), "blocks", { p: [x, 3.24, z], c: C.dressed, uv: "box", tile: 2 });
      rune(p, Math.sin(a) * (colR + 0.215), 1.9, Math.cos(a) * (colR + 0.215), 0.3, a, i % 8, C.magic);
    }
    // Architrave annulaire et toit conique d'ardoise.
    p.add(G.cyl(2.6, 2.6, 0.32, 20, true), "blocks", { p: [0, 3.5, 0], c: C.dressed, uv: [10, 0.4] });
    p.add(G.cyl(2.2, 2.6, 0.06, 20), "blocks", { p: [0, 3.35, 0], c: C.graniteD, uv: "box", tile: 2 });
    p.add(G.cone(3.0, 1.9, 20, true), "slate", { p: [0, 4.6, 0], c: C.slate, uv: [11, 3] });
    p.add(G.cyl(0.08, 0.14, 0.5, 6), "metal", { p: [0, 5.7, 0], c: C.iron });
    p.add(G.sphere(0.14, 8, 6), "gold", { p: [0, 6.0, 0], c: C.gold });
    // Autel central.
    p.add(G.cyl(0.42, 0.55, 0.8, 8), "blocks", { p: [0, 0.92, 0], c: C.dressed, uv: "box", tile: 2 });
    p.add(G.cyl(0.55, 0.5, 0.12, 8), "blocks", { p: [0, 1.38, 0], c: C.granite, uv: "box", tile: 2 });
    p.add(G.planeUp(3.4, 3.4), "sealSpiral", { p: [0, 0.53, 0], c: "#ffd66a" });
    mossBits(p, [
      [2.8, 0.3, -1.2, 0.35],
      [-2.4, 0.55, -1.6, 0.3],
      [-3.0, 0.2, 0.8, 0.3],
      [1.6, 3.8, 1.6, 0.35],
    ]);
    c.root.add(p.build());
    const cry = K.node(c.root, 0, 2.05, 0);
    const cm = c.inst("ice");
    const cp = K.part("bld:shrineCrystal");
    cp.add(G.crystal(0.24, 0.5, 6, 0.36, 0.3, 0.9), "ice", { g: ["#7a5cff", "#bff6ff", -0.3, 0.8] });
    cry.add(cp.build({ mats: { ice: cm } }));
    const spr = K.fx.sprite("#a58cff", 2.4, 0.55);
    cry.add(spr);
    const motes = K.node(c.root, 0, 1.6, 0);
    const mp = K.part("bld:motes");
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      mp.add(G.ico(0.05, 0), "glow", { p: [Math.sin(a) * 0.9, (i % 3) * 0.35, Math.cos(a) * 0.9], c: i % 2 ? "#bff6ff" : "#e0c8ff" });
    }
    const mm = mp.build();
    mm.userData.noBounds = true;
    motes.add(mm);
    return {
      footprint: ngon(2.45, 12, 0, 0),
      door: { x: 0, z: 3.9, yaw: 0 },
      chestSlot: { x: 1.35, y: 0.52, z: 1.75 },
      update(dt, time, t) {
        cry.rotation.y = t * 0.6;
        cry.position.y = 2.05 + Math.sin(t * 1.3) * 0.1;
        cm.emissiveIntensity = 0.5 + Math.sin(t * 2) * 0.2;
        spr.scale.setScalar(2.2 + Math.sin(t * 2) * 0.25);
        motes.rotation.y = -t * 0.5;
        motes.position.y = 1.6 + Math.sin(t * 0.9) * 0.15;
      },
    };
  }

  /* ---------------------------------------------------------------- Crypte */
  function crypte(c) {
    const p = K.part("bld:crypte");
    // Tertre herbeux.
    p.add(G.blob(3.1, 2, 0.06, 9), "matte", { p: [0, -0.2, -0.6], s: [1, 0.5, 0.95], g: ["#3f6a26", "#5f8e35", 0, 1.4], vj: 0.12, vs: 2 });
    // Façade de granite.
    const fw = 4.4,
      fh = 2.9,
      fz = 1.9;
    wall(p, 0, 0, fz - 0.45, fw, fh, 0.9, C.granite);
    for (const sx of [-1, 1]) {
      p.add(G.box(0.55, fh + 0.2, 1.0), "blocks", { p: [sx * (fw / 2 - 0.1), (fh + 0.2) / 2, fz - 0.45], c: C.dressed, uv: "box", tile: 2.4 });
      p.add(G.cyl(0.18, 0.2, 2.2, 10), "blocks", { p: [sx * 0.95, 1.1, fz + 0.12], c: C.dressed, uv: [1, 2] });
      p.add(G.box(0.46, 0.2, 0.46), "blocks", { p: [sx * 0.95, 2.28, fz + 0.12], c: C.dressed, uv: "box", tile: 2 });
    }
    p.add(G.box(fw + 0.4, 0.3, 1.1), "blocks", { p: [0, fh + 0.15, fz - 0.4], c: C.dressed, uv: "box", tile: 2.4 });
    p.add(G.extrude("bld:cped", [
      [-(fw + 0.3) / 2, 0],
      [(fw + 0.3) / 2, 0],
      [0, 1.05],
    ], 0.6, 0), "blocks", { p: [0, fh + 0.3, fz - 0.2], c: C.granite, uv: "box", tile: 2.4 });
    p.add(G.box(fw + 0.6, 0.35, 0.5), "blocks", { p: [0, 0.17, fz + 0.3], c: C.graniteD, uv: "box", tile: 2.4 });
    // Porte de fer cloutée, sceau runique.
    p.add(G.box(1.35, 2.05, 0.12), "matte", { p: [0, 1.05, fz + 0.02], c: "#0f0c0a" });
    p.add(G.rbox(1.3, 2.0, 0.1, 0.03), "iron", { p: [0, 1.05, fz + 0.06], c: "#4a4d56", uv: [1.4, 2] });
    for (let i = 0; i < 4; i++) for (const sx of [-1, 1]) p.add(G.sphere(0.03, 5, 4), "metal", { p: [sx * 0.52, 0.35 + i * 0.47, fz + 0.12], c: "#8a8a90" });
    p.add(G.planeUp(0.9, 0.9), "sealSpiral", { p: [0, 1.35, fz + 0.115], r: [Math.PI / 2, 0, 0], c: C.magic });
    // Urnes à flammes bleues (feux follets fixés).
    for (const sx of [-1, 1]) {
      p.add(G.lathe("bld:urn", [
        [0.001, 0],
        [0.16, 0.02],
        [0.24, 0.18],
        [0.2, 0.34],
        [0.26, 0.42],
        [0.2, 0.44],
        [0.001, 0.38],
      ], 10), "blocks", { p: [sx * 1.65, 0.35, fz + 0.3], c: C.dressed, uv: [1, 0.5] });
    }
    // Lierre et mousse.
    mossBits(p, [
      [-1.6, 3.05, fz - 0.2, 0.4],
      [1.8, 3.05, fz - 0.1, 0.35],
      [-2.4, 0.35, fz + 0.35, 0.35],
      [2.2, 0.4, fz - 1.4, 0.4],
    ]);
    for (const [x, z] of [
      [-2.4, -2.2],
      [2.6, -1.6],
      [1.2, -3.2],
    ])
      p.add(G.rock(0.35, 1, 0.25, x * 10), "stone", { p: [x, 0.1, z], s: [1, 0.6, 1], c: "#9c9486", uv: "box", tile: 1 });
    c.root.add(p.build());
    const glowMat = c.inst("glow");
    const flames = [];
    for (const sx of [-1, 1]) {
      const f = K.node(c.root, sx * 1.65, 0.8, fz + 0.3);
      const fp = K.part("bld:cflame");
      fp.add(G.flame(0.13, 0.42, 8), "glow", { g: ["#ffffff", "#6fd8ff", 0.02, 0.35] });
      f.add(fp.build({ mats: { glow: glowMat } }));
      const s = K.fx.sprite("#6fd8ff", 1.2, 0.6);
      s.position.y = 0.2;
      f.add(s);
      flames.push(f);
    }
    // Feux follets en orbite.
    const wisps = [];
    for (let i = 0; i < 3; i++) {
      const w = K.node(c.root, 0, 0, 0);
      const wp = K.part("bld:wisp");
      wp.add(G.sphere(0.08, 8, 6), "glow", { c: "#bff6ff" });
      const wm = wp.build();
      wm.userData.noBounds = true;
      w.add(wm);
      const s = K.fx.sprite("#7fe8ff", 0.7, 0.7);
      w.add(s);
      wisps.push(w);
    }
    return {
      footprint: [
        [-2.4, fz + 0.1],
        [2.4, fz + 0.1],
        [2.9, 0.2],
        [2.6, -2.3],
        [0, -3.6],
        [-2.6, -2.3],
        [-2.9, 0.2],
      ],
      door: { x: 0, z: fz + 0.9, yaw: 0 },
      chestSlot: { x: 1.4, y: 0, z: fz + 1.25 },
      update(dt, time, t) {
        glowMat.color.setScalar(1.3 + wob(t * 5, 1) * 0.3);
        for (let i = 0; i < 2; i++) flames[i].scale.set(1, 0.9 + wob(t * 7, i) * 0.2, 1);
        for (let i = 0; i < 3; i++) {
          const a = t * (0.5 + i * 0.13) + (i * TAU) / 3;
          wisps[i].position.set(Math.sin(a) * (2.2 + i * 0.3), 1.6 + Math.sin(t * 1.3 + i * 2) * 0.5 + i * 0.3, -0.5 + Math.cos(a) * (2.0 + i * 0.2));
        }
      },
    };
  }

  const KINDS = { grange, cabane, pilotis, sanctuaire, crypte };
  PTMT.models.building = function (kind) {
    const b = KINDS[kind];
    if (!b) throw new Error("PTMT : bâtiment inconnu " + kind);
    return shell(kind, b);
  };

  void lerp;
})();
