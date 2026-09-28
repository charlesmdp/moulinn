// « Pas touche à mes trésors » — réserves de trésor (coffres).
//
//   PTMT.models.chest(tier)  tier : 1..3
//   → { object, height, setStock(n, max), setOpenProgress(p), alarm(bool), update(dt, time), setSelected(bool), dispose() }
//
//  I   Coffre de bois          : planches, cerclages de fer, serrure.
//  II  Coffre à trois serrures : plus grand, armatures de fer rivetées, trois cadenas qui se balancent.
//  III Coffre hurleur          : bois enchanté et or, visage ; l'alarme ouvre une grande bouche rouge,
//                                fait clignoter la gemme-sirène, trembler le coffre et partir des ondes.
// Le stock (0..max) est montré par 0 à 3 sacs d'or autour du coffre et un tas de pièces dedans.
(function () {
  "use strict";
  const PTMT = globalThis.PTMT;
  if (!PTMT || !PTMT.models || !PTMT.models.kit) return;
  const K = PTMT.models.kit,
    G = K.g;
  const { clamp, damp } = K.math;
  const Spring = K.Spring;

  const T = [
    null,
    { W: 0.9, H: 0.5, D: 0.6, wood: "#a06d3d", band: "#4a4540", trim: "metal" },
    { W: 1.04, H: 0.58, D: 0.68, wood: "#80522d", band: "#3d3935", trim: "metal" },
    { W: 1.14, H: 0.64, D: 0.74, wood: "#5b3f6e", band: "#f2b52e", trim: "gold" },
  ];

  function sack(p, x, z, ry, s) {
    const prof = [
      [0.001, 0],
      [0.16, 0.01],
      [0.22, 0.08],
      [0.235, 0.18],
      [0.2, 0.28],
      [0.1, 0.36],
      [0.075, 0.385],
      [0.11, 0.43],
      [0.07, 0.47],
      [0.001, 0.47],
    ];
    p.add(G.lathe("chest:sack", prof, 10), "burlap", { p: [x, 0, z], r: [0, ry, 0], s, c: "#d8b98a", uv: [1.5, 1] });
    p.add(G.torus(0.08, 0.02, 3, 10), "matte", { p: [x, 0.38 * s, z], r: [Math.PI / 2, 0, 0], s, c: "#7a5530" });
    p.add(G.cyl(0.07, 0.07, 0.015, 10), "gold", { p: [x + Math.sin(ry) * 0.215 * s, 0.17 * s, z + Math.cos(ry) * 0.215 * s], r: [Math.PI / 2 - 0.25, ry, 0], ro: "YXZ", s, c: "#f2b52e" });
    for (let i = 0; i < 3; i++) {
      const a = ry + 0.6 + i * 0.7;
      p.add(G.cyl(0.045, 0.045, 0.012, 8), "gold", { p: [x + Math.sin(a) * 0.3 * s, 0.008 + i * 0.004, z + Math.cos(a) * 0.3 * s], r: [0.1 * i, 0, 0.15], c: "#f2b52e" });
    }
  }

  PTMT.models.chest = function (tier) {
    tier = clamp(tier | 0 || 1, 1, 3);
    const D0 = T[tier];
    const { W, H, D } = D0;
    const root = new THREE.Group();
    root.name = "ptmt-chest-" + tier;
    const owned = [];
    const inst = (name) => {
      const m = K.mat(name).clone();
      owned.push(m);
      return m;
    };
    const body = K.node(root, 0, 0, 0);
    const p = K.part("chest:body" + tier);
    p.add(G.rbox(W, H, D, 0.03), "wood", { p: [0, H / 2, 0], c: D0.wood, uv: [W * 2.2, H * 2.2], ao: 0.55, aoH: 0.25 });
    // Cerclages / armatures.
    const straps = tier === 1 ? [-0.3, 0.3] : tier === 2 ? [-0.42, -0.14, 0.14, 0.42] : [-0.45, 0.45];
    for (const x of straps) p.add(G.box(0.06, H + 0.01, D + 0.015), D0.trim, { p: [x * W, H / 2, 0], c: D0.band, uv: [0.2, 1] });
    if (tier >= 2) {
      for (const y of [0.03, H - 0.03]) {
        p.add(G.box(W + 0.02, 0.05, 0.05), D0.trim, { p: [0, y, D / 2], c: D0.band });
        p.add(G.box(W + 0.02, 0.05, 0.05), D0.trim, { p: [0, y, -D / 2], c: D0.band });
      }
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.add(G.box(0.05, H, 0.05), D0.trim, { p: [sx * W / 2, H / 2, sz * D / 2], c: D0.band });
      if (tier === 2)
        for (let i = 0; i < 6; i++) for (const y of [0.03, H - 0.03]) p.add(G.sphere(0.018, 5, 4), "metal", { p: [-W / 2 + 0.1 + i * ((W - 0.2) / 5), y, D / 2 + 0.03], c: "#8a847c" });
    }
    if (tier === 1) {
      p.add(G.rbox(0.14, 0.18, 0.04, 0.015), "metal", { p: [0, H * 0.7, D / 2 + 0.01], c: "#6e6860" });
      p.add(G.box(0.03, 0.06, 0.01), "matte", { p: [0, H * 0.68, D / 2 + 0.035], c: "#141210" });
    }
    if (tier === 2) p.add(G.box(W * 0.7, 0.06, 0.04), "metal", { p: [0, H * 0.78, D / 2 + 0.03], c: "#5a544c" });
    if (tier === 3) {
      // Pieds griffus dorés, gueule (fond rouge + dents), plaque de mâchoire articulée plus bas.
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.add(G.sphere(0.07, 8, 6), "gold", { p: [sx * (W / 2 - 0.05), 0.02, sz * (D / 2 - 0.05)], s: [1, 0.6, 1], c: "#f2b52e" });
      p.add(G.rbox(W * 0.62, H * 0.26, 0.05, 0.02), "matte", { p: [0, H * 0.32, D / 2 - 0.02], c: "#2a0508" });
      for (let i = 0; i < 6; i++) p.add(G.cone(0.028, 0.07, 4), "glossy", { p: [-W * 0.25 + i * (W * 0.1), H * 0.43, D / 2 + 0.01], r: [Math.PI, 0, 0], c: "#fff6e0" });
    }
    body.add(p.build());
    // Tas de pièces à l'intérieur.
    const heap = K.node(body, 0, H - 0.03, 0);
    const hp = K.part("chest:heap" + tier);
    hp.add(G.sphere(Math.min(W, D) * 0.46, 14, 6, 0, Math.PI / 2), "coins", { s: [W / D, 0.55, 1], uv: [2, 2] });
    hp.add(G.oct(0.05), "glossy", { p: [W * 0.18, 0.12, 0.05], c: "#ff2d55" });
    hp.add(G.oct(0.045), "glossy", { p: [-W * 0.2, 0.1, -0.04], c: "#2d8bff" });
    heap.add(hp.build());
    // Couvercle.
    const hinge = K.node(body, 0, H, -D / 2);
    const lp = K.part("chest:lid" + tier);
    // Couvercle bombé : demi-cylindre (dessus) + planche de dessous.
    lp.add(() => new THREE.CylinderGeometry(D / 2, D / 2, W, 12, 1, false, 0, Math.PI), "wood", { p: [0, 0, D / 2], r: [0, 0, Math.PI / 2], s: [0.5, 1, 1], c: D0.wood, uv: [1.5, 1] });
    lp.add(G.box(W - 0.02, 0.03, D - 0.02), "wood", { p: [0, 0.015, D / 2], c: "#5a3a20", uv: [W, D] });
    for (const x of straps)
      lp.add(() => new THREE.CylinderGeometry(D / 2 + 0.012, D / 2 + 0.012, 0.06, 12, 1, false, 0, Math.PI), D0.trim, { p: [x * W, 0, D / 2], r: [0, 0, Math.PI / 2], s: [0.52, 1, 1], c: D0.band });
    if (tier === 1) lp.add(G.box(0.1, 0.12, 0.03), "metal", { p: [0, -0.02, D + 0.005], c: "#6e6860" });
    if (tier === 3) {
      lp.add(G.cyl(0.07, 0.09, 0.06, 8), "gold", { p: [0, D * 0.25 + 0.02, D / 2], c: "#f2b52e" });
    }
    hinge.add(lp.build());
    let siren = null,
      sirenMat = null;
    if (tier === 3) {
      sirenMat = inst("glow");
      const sp = K.part("chest:siren");
      sp.add(G.oct(0.09), "glow", { p: [0, D * 0.25 + 0.12, D / 2], s: [1, 1.4, 1], c: "#ff2a3a" });
      siren = sp.build({ mats: { glow: sirenMat } });
      hinge.add(siren);
    }
    // Cadenas (palier II) : groupe qui se balance.
    let locks = null;
    if (tier === 2) {
      locks = K.node(body, 0, H * 0.78, D / 2 + 0.05);
      const kp = K.part("chest:locks");
      for (const x of [-0.3, 0, 0.3]) {
        kp.add(G.rbox(0.13, 0.12, 0.05, 0.02), "metal", { p: [x, -0.11, 0.01], c: x === 0 ? "#d7a24a" : "#7a746a" });
        kp.add(G.torus(0.045, 0.012, 3, 10, Math.PI), "metal", { p: [x, -0.05, 0.01], c: "#b8b0a4" });
        kp.add(G.box(0.02, 0.035, 0.01), "matte", { p: [x, -0.12, 0.04], c: "#141210" });
      }
      locks.add(kp.build());
    }
    // Visage et mâchoire (palier III).
    let face = null,
      jaw = null,
      waves = null,
      waveMat = null;
    if (tier === 3) {
      face = K.face(body, { key: "chest3", p: [0, H * 0.7, D / 2 - 0.03], gap: 0.2, eye: 0.11, skin: D0.wood, brow: "#241830", slant: 0.4, rest: 0.1 });
      jaw = K.node(body, 0, H * 0.18, D / 2 + 0.005);
      const jp = K.part("chest:jaw");
      jp.add(G.rbox(W * 0.66, H * 0.28, 0.05, 0.02), "wood", { p: [0, H * 0.14, 0.01], c: "#6d4c84", uv: [1, 0.4] });
      jp.add(G.box(W * 0.66, 0.03, 0.06), "gold", { p: [0, H * 0.28, 0.01], c: "#f2b52e" });
      for (let i = 0; i < 5; i++) jp.add(G.cone(0.026, 0.06, 4), "glossy", { p: [-W * 0.2 + i * (W * 0.1), H * 0.3, 0.0], c: "#fff6e0" });
      jaw.add(jp.build());
      waveMat = inst("sel");
      waveMat.color.copy(K.col("#ff3040"));
      waves = [];
      for (let i = 0; i < 2; i++) {
        const wp = K.part("chest:wave");
        wp.add(G.ring(0.5, 0.62, 28, 6), "sel", { r: [Math.PI / 2, 0, 0] });
        const w = wp.build({ mats: { sel: waveMat } });
        w.position.set(0, H * 0.3, D / 2 + 0.1);
        w.visible = false;
        w.userData.noBounds = true;
        body.add(w);
        waves.push(w);
      }
    }
    const alarmSpr = K.fx.sprite("#ff2a2a", 1.6, 0.55);
    alarmSpr.position.set(0, H + 0.45, 0);
    alarmSpr.visible = false;
    root.add(alarmSpr);
    // Point d'exclamation rouge qui sautille au-dessus du coffre pendant l'alarme.
    const bang = K.node(root, 0, H + 0.75, 0);
    const bp = K.part("chest:bang");
    bp.add(G.capsule(0.07, 0.26, 8, 2), "glow", { p: [0, 0.22, 0], s: [1, 1, 0.6], c: "#ff2a2a" });
    bp.add(G.sphere(0.075, 8, 6), "glow", { p: [0, -0.06, 0], s: [1, 1, 0.6], c: "#ff2a2a" });
    const bangM = bp.build();
    bangM.userData.noBounds = true;
    bang.add(bangM);
    bang.visible = false;
    // Sacs d'or (stock).
    const SPOTS = [
      [-W / 2 - 0.32, 0.1, 0.5],
      [W / 2 + 0.3, 0.02, -0.5],
      [-W / 2 + 0.05, D / 2 + 0.34, 0.2],
    ];
    const sacks = SPOTS.map(([x, z, ry], i) => {
      const n = K.node(root, x, 0, z);
      const sp = K.part("chest:sack" + i);
      sack(sp, 0, 0, ry, i === 2 ? 0.85 : 1);
      n.add(sp.build());
      n.scale.setScalar(0.001);
      n.visible = false;
      return { n, s: new Spring(180, 10, 0) };
    });
    const sel = K.fx.selRing(Math.max(W, D) * 0.95 + 0.35);
    root.add(sel);
    const lid = new Spring(120, 13, 0);
    const st = { stock: 0, max: 3, open: 0, alarm: false, a: 0, sel: 0, selOn: false, t: Math.random() * 10 };
    const api = {
      object: root,
      tier,
      height: Math.round(K.solidTop(root) * 100) / 100,
      setStock(n, max) {
        st.stock = Math.max(0, n);
        st.max = Math.max(1, max || 3);
        const shown = st.stock <= 0 ? 0 : Math.min(3, Math.ceil((3 * st.stock) / st.max));
        for (let i = 0; i < 3; i++) {
          const on = i < shown;
          if (on && sacks[i].s.target === 0) sacks[i].s.set(0.2, 6);
          sacks[i].s.target = on ? 1 : 0;
        }
      },
      setOpenProgress(p) {
        st.open = clamp(p, 0, 1);
      },
      alarm(b) {
        st.alarm = !!b;
      },
      setSelected(b) {
        st.selOn = !!b;
      },
      update(dt, time) {
        if (dt > 0.1) dt = 0.1;
        K.tick(time);
        st.t += dt;
        st.a = damp(st.a, st.alarm ? 1 : 0, 8, dt);
        const al = st.a;
        // Le couvercle claque pendant l'alarme.
        const rattle = al * (tier === 3 ? 0.12 : 0.08) * Math.max(0, Math.sin(time * 26));
        lid.target = -st.open * 1.85 - rattle;
        lid.step(dt);
        hinge.rotation.x = lid.x;
        heap.visible = st.stock > 0;
        const fill = st.stock / st.max;
        heap.scale.set(0.7 + fill * 0.3, 0.35 + fill * 0.65, 0.7 + fill * 0.3);
        for (const S of sacks) {
          S.s.step(dt);
          const v = Math.max(0, S.s.x);
          S.n.visible = v > 0.01;
          S.n.scale.set(v, v * (1 + (1 - v) * 0.3), v);
        }
        const shake = al * (tier === 3 ? 0.035 : 0.02);
        body.position.set(Math.sin(time * 47) * shake, al * Math.abs(Math.sin(time * 13)) * (tier === 3 ? 0.06 : 0.02), Math.sin(time * 39) * shake * 0.6);
        body.rotation.z = Math.sin(time * 31) * shake * 0.8;
        alarmSpr.visible = al > 0.02;
        bang.visible = al > 0.05;
        if (bang.visible) {
          bang.position.y = H + 0.75 + Math.abs(Math.sin(time * 7)) * 0.18;
          bang.scale.setScalar(al * (1 + Math.max(0, Math.sin(time * 14)) * 0.15));
          bang.rotation.z = Math.sin(time * 9) * 0.15;
        }
        if (alarmSpr.visible) alarmSpr.scale.setScalar((0.8 + Math.max(0, Math.sin(time * 9)) * 1.2) * al * (tier === 3 ? 1.4 : 1));
        if (locks) locks.rotation.x = Math.sin(st.t * 2.2) * 0.08 + al * Math.sin(time * 30) * 0.3;
        if (face) {
          face.setOpen(al > 0.3 ? 1 : st.open > 0.2 ? 0.6 : 0);
          face.look(al > 0.3 ? 0 : null, 0.2);
          face.update(dt);
          jaw.rotation.x = al * (0.9 + Math.sin(time * 18) * 0.15) + st.open * 0.2;
          sirenMat.color.copy(K.col("#ff2a3a")).multiplyScalar(0.6 + al * (1.5 + Math.sin(time * 14) * 1.2));
          siren.rotation.y = time * (0.5 + al * 8);
          for (let i = 0; i < waves.length; i++) {
            const ph = (time * 1.6 + i * 0.5) % 1;
            waves[i].visible = al > 0.05;
            waves[i].scale.setScalar(0.3 + ph * 1.4);
          }
          if (waveMat) waveMat.opacity = al * 0.9;
        }
        st.sel = damp(st.sel, st.selOn ? 1 : 0, 10, dt);
        sel.visible = st.sel > 0.02;
        if (sel.visible) sel.rotation.y = time * 0.35;
      },
      dispose() {
        if (root.parent) root.parent.remove(root);
        for (const m of owned) m.dispose();
        owned.length = 0;
      },
    };
    api.setStock(0, 3);
    return api;
  };

})();
