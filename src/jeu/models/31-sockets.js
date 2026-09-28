// « Pas touche à mes trésors » — socles de construction (emplacements vides, lisibles vue d'avion).
//
//   PTMT.models.socket(kind)  kind : "fire" | "ice" | "water"
//   → { object, height, setState("idle"|"hover"|"valid"|"invalid"|"hidden"), update(dt, time), dispose() }
//
//  feu   : dalle de pierre et briques, marques de braises incandescentes ;
//  glace : cercle de runes sur dalles bleues rayonnantes ;
//  eau   : berge / bouche de conduite (vasque de pierre, tuyau de bronze qui coule).
// Plat, environ 1,8 m de large. L'anneau d'état change de couleur (famille, survol, valide, interdit).
(function () {
  "use strict";
  const PTMT = globalThis.PTMT;
  if (!PTMT || !PTMT.models || !PTMT.models.kit) return;
  const K = PTMT.models.kit,
    G = K.g;
  const { TAU, damp } = K.math;

  const STATE_COL = { idle: null, hover: "#fff4c2", valid: "#3dff5a", invalid: "#ff2414" };
  const FAM = { fire: "#ff7a1f", ice: "#7fe8ff", water: "#43f2df" };

  function buildFire(root, glow) {
    const p = K.part("sock:fire");
    // Couronne de briques (octogone) et dalle centrale noircie.
    p.add(G.cyl(0.9, 0.94, 0.1, 8), "blocks", { p: [0, 0.05, 0], r: [0, Math.PI / 8, 0], c: "#b65a3d", uv: [5, 0.25], ao: 0.6, aoH: 0.1 });
    p.add(G.cyl(0.7, 0.72, 0.03, 8), "stone", { p: [0, 0.115, 0], r: [0, Math.PI / 8, 0], c: "#5a4a44", uv: "box", tile: 1.4 });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + Math.PI / 8;
      p.add(G.cyl(0.045, 0.05, 0.05, 6), "metal", { p: [Math.sin(a) * 0.8, 0.12, Math.cos(a) * 0.8], c: "#3a302c" });
    }
    const rnd = PTMT.rng(4);
    for (let i = 0; i < 5; i++) {
      const a = rnd() * TAU,
        r = 0.2 + rnd() * 0.35;
      p.add(G.rock(0.05 + rnd() * 0.03, 0, 0.3, i), i % 2 ? "glow" : "matte", { p: [Math.sin(a) * r, 0.13, Math.cos(a) * r], s: [1, 0.5, 1], c: i % 2 ? "#ff7a1f" : "#241c1a" });
    }
    root.add(p.build({ mats: { glow } }));
    const e = K.part("sock:fireEmber");
    e.add(G.discUp(0.68, 16), "ember", { p: [0, 0.135, 0], c: "#ffffff" });
    const em = e.build({ mats: { ember: glow.userData.ember } });
    root.add(em);
  }
  function buildIce(root, glow) {
    const p = K.part("sock:ice");
    // Dalles bleues rayonnantes (8 secteurs séparés par des joints).
    for (let i = 0; i < 8; i++) {
      const a0 = (i / 8) * TAU + 0.02;
      p.add(() => new THREE.CylinderGeometry(0.88, 0.9, 0.1, 5, 1, false, a0, TAU / 8 - 0.04), "blocks", {
        p: [0, 0.05, 0],
        c: i % 2 ? "#6c8cc0" : "#7d9bcb",
        uv: "box",
        tile: 1.6,
        j: 0.08,
        ao: 0.7,
        aoH: 0.1,
      });
    }
    p.add(G.cyl(0.34, 0.36, 0.12, 12), "blocks", { p: [0, 0.06, 0], c: "#9ab3d8", uv: "box", tile: 1 });
    const rnd = PTMT.rng(8);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + 0.4 + rnd() * 0.3;
      p.add(G.blob(0.13, 1, 0.15, i + 2), "snow", { p: [Math.sin(a) * 0.84, 0.08, Math.cos(a) * 0.84], s: [1.4, 0.35, 1], c: "#f4f9ff" });
      p.add(G.crystal(0.05, 0.1, 5, 0.08, 0.02), "ice", { p: [Math.sin(a + 0.5) * 0.9, 0.05, Math.cos(a + 0.5) * 0.9], r: [Math.cos(a) * 0.4, 0, -Math.sin(a) * 0.4], c: "#bfefff" });
    }
    root.add(p.build());
    const s = K.part("sock:iceSeal");
    s.add(G.planeUp(1.5, 1.5), "sealIce", { p: [0, 0.105, 0], c: "#ffffff" });
    root.add(s.build({ mats: { sealIce: glow.userData.seal } }));
  }
  function buildWater(root) {
    const p = K.part("sock:water");
    p.add(
      G.lathe(
        "sock:waterBasin",
        [
          [0.84, 0],
          [0.9, 0.04],
          [0.9, 0.18],
          [0.86, 0.22],
          [0.76, 0.22],
          [0.72, 0.18],
          [0.72, 0.06],
        ],
        20,
      ),
      "stone",
      { c: "#a2a690", uv: [4, 0.4], ao: 0.6, aoH: 0.2 },
    );
    p.add(G.discUp(0.74, 20), "stone", { p: [0, 0.02, 0], c: "#6d735f", uv: "box", tile: 1.4 });
    // Bloc de sortie de conduite à l'arrière, bouche de bronze.
    p.add(G.rbox(0.5, 0.42, 0.3, 0.04), "stone", { p: [0, 0.21, -0.86], c: "#b7b9a4", uv: "box", tile: 0.8, ao: 0.6, aoH: 0.3 });
    p.add(G.cyl(0.1, 0.12, 0.26, 10), "metal", { p: [0, 0.3, -0.66], r: [Math.PI / 2, 0, 0], c: "#b8803e" });
    p.add(G.torus(0.11, 0.03, 4, 12), "metal", { p: [0, 0.3, -0.53], c: "#4fae98" });
    const rnd = PTMT.rng(3);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + 0.8 + rnd() * 0.5;
      p.add(G.blob(0.12, 0, 0.2, 60 + i), "matte", { p: [Math.sin(a) * 0.82, 0.2, Math.cos(a) * 0.82], s: [1.3, 0.35, 1], c: i % 2 ? "#5f8a34" : "#86a846" });
    }
    root.add(p.build());
    const w = K.part("sock:waterSurf");
    w.add(G.discUp(0.73, 20), "water", { p: [0, 0.12, 0], uv: [2.2, 2.2] });
    root.add(w.build());
    const f = K.part("sock:waterFall");
    f.add(
      G.tube(
        "sock:fall",
        [
          [0, 0.3, -0.52],
          [0, 0.28, -0.42],
          [0, 0.2, -0.36],
          [0, 0.12, -0.33],
        ],
        [0.06, 0.08],
        6,
        6,
      ),
      "waterFx",
      {},
    );
    const fm = f.build();
    fm.userData.noBounds = true;
    root.add(fm);
  }

  PTMT.models.socket = function (kind) {
    const build = { fire: buildFire, ice: buildIce, water: buildWater }[kind];
    if (!build) throw new Error("PTMT : socle inconnu " + kind);
    const root = new THREE.Group();
    root.name = "ptmt-socket-" + kind;
    const body = K.node(root, 0, 0, 0);
    const owned = [];
    const glow = K.mat("glow").clone();
    owned.push(glow);
    if (kind === "fire") {
      glow.userData.ember = K.mat("ember").clone();
      owned.push(glow.userData.ember);
    }
    if (kind === "ice") {
      glow.userData.seal = K.mat("sealIce").clone();
      owned.push(glow.userData.seal);
    }
    build(body, glow);
    const ringMat = K.mat("selN").clone();
    owned.push(ringMat);
    const rp = K.part("sock:ring");
    rp.add(G.ring(0.86, 1.16, 40, 10), "selN", {});
    const ring = rp.build({ mats: { selN: ringMat } });
    ring.position.y = 0.03;
    root.add(ring);
    const famCol = K.col(FAM[kind]).clone();
    const tgtCol = new THREE.Color();
    const curCol = famCol.clone();
    let state = "idle",
      k = 0.4,
      kT = 0.4,
      t = Math.random() * 10,
      shake = 0;
    const api = {
      object: root,
      kind,
      height: 0.25,
      setState(s) {
        state = s in STATE_COL || s === "hidden" ? s : "idle";
        root.visible = state !== "hidden";
        if (state === "invalid") shake = 1;
      },
      update(dt, time) {
        if (dt > 0.1) dt = 0.1;
        K.tick(time);
        t += dt;
        const hover = state === "hover";
        kT = state === "idle" ? 0.45 : state === "invalid" ? 1.3 : 1.6;
        k = damp(k, kT, 8, dt);
        const sc = STATE_COL[state];
        if (sc) tgtCol.copy(K.col(sc));
        else tgtCol.copy(famCol);
        curCol.lerp(tgtCol, 1 - Math.exp(-10 * dt));
        const pulse = hover ? 0.12 * Math.sin(time * 6) : 0.08 * Math.sin(time * 2);
        ringMat.color.copy(curCol);
        ringMat.opacity = Math.min(1, (state === "idle" ? 0.5 : 0.95) + pulse);
        const rs = hover ? 1.02 + Math.sin(time * 6) * 0.03 : 1;
        ring.scale.set(rs, 1, rs);
        ring.rotation.y = time * (hover ? 0.9 : 0.25);
        const g = state === "invalid" ? 0.5 : hover || state === "valid" ? 1.7 : 1.0;
        glow.color.setScalar(g * (1 + Math.sin(time * 2.3) * 0.15));
        if (glow.userData.ember) glow.userData.ember.color.setScalar(g * (0.8 + Math.sin(time * 1.7) * 0.2));
        if (glow.userData.seal) glow.userData.seal.color.copy(K.col("#8feeff")).multiplyScalar(g * (0.75 + Math.sin(time * 1.9) * 0.15));
        shake = Math.max(0, shake - dt * 2.5);
        body.position.x = Math.sin(time * 50) * 0.03 * shake;
        body.position.y = hover ? 0.02 + Math.sin(time * 6) * 0.015 : 0;
      },
      dispose() {
        if (root.parent) root.parent.remove(root);
        for (const m of owned) m.dispose();
        owned.length = 0;
      },
    };
    return api;
  };
})();
