// « Pas touche à mes trésors » — pièges posés sur les cases du chemin (plats, emprise ≤ 1,2 m).
//
//   PTMT.models.trap(kind, tier)  kind : "net" | "spring" | "lure", tier : 1..3
//   → { object, height, update(dt, time), trigger("fire"), setReady(bool), setSelected(bool),
//       setDirection(yaw) (ressort : orientation du lancer ; sans effet ailleurs), dispose() }
//
//  « Filet entre les arbres » : piquets puis petits arbres, filet de plus en plus large (et doré).
//  « Ressort farceur »        : plaque à ressort → gant de boxe → cuillère-catapulte sur ressort géant.
//  « Faux coffre »            : coffre peint en or → pierreries → bling total, ampoules ; « ta-da ! » quand il attire.
// Prêt : témoin lumineux vert-doré, mécanisme armé. En recharge : témoin rouge éteint, mécanisme détendu.
(function () {
  "use strict";
  const PTMT = globalThis.PTMT;
  if (!PTMT || !PTMT.models || !PTMT.models.kit) return;
  const K = PTMT.models.kit,
    G = K.g;
  const { TAU, clamp, damp, bump, easeOut } = K.math;
  const Spring = K.Spring;

  const C = {
    wood: "#8a5a33",
    woodD: "#5a3a20",
    woodL: "#b98552",
    rope: "#d9bf86",
    leaf: "#4f8f36",
    leafL: "#7fb847",
    iron: "#4a4642",
    red: "#d6322b",
    redD: "#8f1f1a",
    yellow: "#ffcf3a",
    gold: "#f0ae24",
    goldD: "#b07a16",
    paint: "#e2b33c",
    ruby: "#ff2d55",
    sapph: "#2d8bff",
    emer: "#20d36a",
    white: "#fff6e0",
    ready: "#9dff5a",
    off: "#ff4a2a",
    velvet: "#a0182c",
  };

  // Panneau « TRÉSOR ! » (texture de texte).
  const signTex = () => {
    if (signTex.t) return signTex.t;
    const cv = document.createElement("canvas");
    cv.width = 256;
    cv.height = 128;
    const g = cv.getContext("2d");
    g.fillStyle = "#c89a62";
    g.fillRect(0, 0, 256, 128);
    for (let i = 0; i < 6; i++) {
      g.fillStyle = i % 2 ? "rgba(90,50,20,0.12)" : "rgba(255,230,180,0.1)";
      g.fillRect(0, i * 22, 256, 11);
    }
    g.save();
    g.translate(128, 66);
    g.rotate(-0.06);
    g.font = "bold 58px 'Comic Sans MS', 'Chalkboard SE', 'Trebuchet MS', sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.lineWidth = 8;
    g.strokeStyle = "#5a2a0a";
    g.strokeText("TRÉSOR !", 0, 0);
    g.fillStyle = "#ffd23a";
    g.fillText("TRÉSOR !", 0, 0);
    g.restore();
    const t = new THREE.CanvasTexture(cv);
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = 4;
    signTex.t = t;
    return t;
  };
  K.defMat("sign", () => new THREE.MeshStandardMaterial({ map: signTex(), roughness: 0.8, vertexColors: true }));
  K.defMat("confetti", () => new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }), true);

  /** Hélice (ressort) de hauteur h, rayon r, n tours, fil de rayon w. */
  G.helix = (r, n, w, rad, h) => {
    const pts = [];
    const steps = Math.round(n * 10);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps,
        a = t * n * TAU;
      pts.push([Math.cos(a) * r, t * (h || 1), Math.sin(a) * r]);
    }
    return G.tube(`helix:${r},${n},${w},${h}`, pts, [w, w], steps, rad || 5);
  };

  /* ---------------------------------------------------------------- coque commune */
  let trapSeed = 1;
  function trapShell(kind, tier, def) {
    const root = new THREE.Group();
    root.name = "ptmt-trap-" + kind + tier;
    const dir = K.node(root, 0, 0, 0, "dir");
    const rng = PTMT.rng(trapSeed++ * 131 + 7);
    const owned = [];
    const st = { t: rng() * 10, ready: 1, readyOn: true, fireT: 9, fired: 0, sel: 0, selOn: false, rng };
    const lamp = K.mat("glow").clone();
    owned.push(lamp);
    const ctx = {
      root,
      dir,
      st,
      tier,
      lamp,
      inst(name) {
        const m = K.mat(name).clone();
        owned.push(m);
        return m;
      },
    };
    const rig = def.build(ctx);
    const sel = K.fx.selRing(def.ringR || 0.8);
    root.add(sel);
    const height = Math.round(K.solidTop(root) * 100) / 100;
    const cReady = K.col(C.ready),
      cOff = K.col(C.off);
    return {
      object: root,
      height,
      kind,
      tier,
      update(dt, time) {
        if (dt > 0.1) dt = 0.1;
        K.tick(time);
        st.t += dt;
        st.fireT += dt;
        st.ready = damp(st.ready, st.readyOn ? 1 : 0, 4, dt);
        const blinkOff = !st.readyOn && Math.sin(time * 5) > 0.6;
        lamp.color.copy(cOff).lerp(cReady, st.ready).multiplyScalar(st.readyOn ? 1.6 + Math.sin(time * 3) * 0.25 : blinkOff ? 0.25 : 0.7);
        rig.pose(st, dt, time);
        st.sel = damp(st.sel, st.selOn ? 1 : 0, 10, dt);
        sel.visible = st.sel > 0.02;
        if (sel.visible) {
          const s = (def.ringR || 0.8) * (0.94 + 0.06 * st.sel + Math.sin(time * 4) * 0.015);
          sel.scale.set(s, 1, s);
          sel.rotation.y = time * 0.35;
        }
      },
      trigger(kind2) {
        if (kind2 !== "fire") return;
        st.fireT = 0;
        st.fired++;
        if (rig.trigger) rig.trigger(st);
      },
      setReady(b) {
        st.readyOn = !!b;
      },
      setSelected(b) {
        st.selOn = !!b;
      },
      setDirection(yaw) {
        if (def.directional) dir.rotation.y = yaw;
      },
      dispose() {
        if (root.parent) root.parent.remove(root);
        for (const m of owned) m.dispose();
        owned.length = 0;
      },
    };
  }

  /* ---------------------------------------------------------------- Filet entre les arbres */
  /** Filet bombé : plan subdivisé, creux au centre (géométrie propre à chaque largeur). */
  function netGeo(w, h, bulge) {
    return PTMT.geo(`trap:net${w},${h},${bulge}`, () => {
      const g = new THREE.PlaneGeometry(w, h, 10, 5);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const u = p.getX(i) / w + 0.5,
          v = p.getY(i) / h + 0.5;
        p.setZ(i, Math.sin(Math.PI * u) * Math.sin(Math.PI * v) * bulge);
        p.setY(i, p.getY(i) - Math.sin(Math.PI * u) * 0.04 * (1 - v));
      }
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (w / 0.3), uv.getY(i) * (h / 0.3));
      g.computeVertexNormals();
      return g;
    });
  }
  const NET = [
    null,
    { w: 0.9, h: 0.46, post: 0.62, tree: false, gold: false },
    { w: 1.08, h: 0.56, post: 0.8, tree: true, gold: false },
    { w: 1.2, h: 0.64, post: 0.95, tree: true, gold: true },
  ];
  function buildNet(c) {
    const T = NET[c.tier];
    const x = T.w / 2 + 0.02;
    const p = K.part("net:frame" + c.tier);
    for (const sx of [-1, 1]) {
      if (!T.tree) {
        p.add(G.cyl(0.045, 0.055, T.post, 7), "wood", { p: [sx * x, T.post / 2, 0], c: C.woodL, uv: [0.3, 1], ao: 0.5, aoH: 0.3 });
        p.add(G.cone(0.055, 0.08, 7), "wood", { p: [sx * x, T.post + 0.04, 0], c: C.woodL });
      } else {
        p.add(G.cyl(0.055, 0.085, T.post, 8), "bark", { p: [sx * x, T.post / 2, 0], c: "#8a6a4a", uv: [0.5, 1.2], ao: 0.5, aoH: 0.4 });
        p.add(G.blob(0.26 + c.tier * 0.02, 1, 0.16, 3 + (sx > 0 ? 1 : 0)), "matte", { p: [sx * x, T.post + 0.16, 0], s: [1, 0.85, 1], g: ["#3b7a2c", C.leafL, T.post, T.post + 0.4] });
        p.add(G.blob(0.16, 1, 0.16, 7), "matte", { p: [sx * (x - 0.12), T.post + 0.02, 0.1], g: ["#3b7a2c", C.leafL, T.post - 0.1, T.post + 0.2] });
        for (const k of [0, 1]) p.add(G.rock(0.07, 0, 0.3, 11 + k), "matte", { p: [sx * (x + 0.08) - k * 0.04 * sx, 0.03, 0.08 - k * 0.14], s: [1, 0.6, 1], c: "#6d6a62" });
        if (T.gold)
          for (const k of [0, 1, 2]) {
            const a = k * 2.1 + (sx > 0 ? 0.5 : 0);
            p.add(G.sphere(0.045, 6, 5), "gold", { p: [sx * x + Math.cos(a) * 0.2, T.post + 0.1 + (k % 2) * 0.12, Math.sin(a) * 0.2], c: C.gold });
          }
      }
      // Corde du haut et témoin lumineux.
      p.add(G.torus(0.06, 0.018, 3, 8), "matte", { p: [sx * x, T.h + 0.1, 0], r: [Math.PI / 2, 0, 0], c: C.rope });
    }
    p.add(G.cyl(0.012, 0.012, T.w, 4), "matte", { p: [0, T.h + 0.1, 0], r: [0, 0, Math.PI / 2], c: C.rope });
    if (T.gold) p.add(G.ring(0.42, 0.64, 32, 4), "runes", { p: [0, 0.02, 0], s: [1, 1, 0.45], c: "#ffd66a" });
    c.root.add(p.build());
    const lampP = K.part("net:lamp");
    for (const sx of [-1, 1]) lampP.add(G.ico(0.04, 1), "glow", { p: [sx * x, T.tree ? T.post * 0.55 : T.post + 0.11, T.tree ? 0.075 : 0] });
    c.root.add(lampP.build({ mats: { glow: c.lamp } }));
    // Filet (pivote autour de la corde du haut).
    const hinge = K.node(c.root, 0, T.h + 0.1, 0);
    const np = K.part("net:net" + c.tier);
    np.add(netGeo(T.w, T.h, 0.07), "net", { p: [0, -T.h / 2, 0], c: T.gold ? "#ffd24a" : "#ffffff" });
    for (const sx of [-1, 1]) np.add(G.rock(0.05, 0, 0.3, sx + 5), "matte", { p: [sx * T.w * 0.42, -T.h + 0.01, 0.02], c: "#77736a" });
    const net = np.build({ cast: true });
    hinge.add(net);
    let sparkMat = null;
    if (T.gold) {
      sparkMat = c.inst("glow");
      const sp = K.part("net:spark");
      for (let i = 0; i < 5; i++) sp.add(G.star(4, 0.05, 0.015, 0.005), "glow", { p: [(i - 2) * 0.24, -0.2 - (i % 2) * 0.18, 0.1], c: "#fff3b0" });
      const sm = sp.build({ mats: { glow: sparkMat } });
      sm.userData.noBounds = true;
      hinge.add(sm);
    }
    const flip = new Spring(55, 4.5, 0);
    return {
      trigger() {
        flip.kick(-11);
      },
      pose(st, dt) {
        flip.target = st.readyOn ? 0 : -1.25;
        flip.step(dt);
        const snap = st.fireT < 1.2 ? bump(st.fireT / 1.2) : 0;
        hinge.rotation.x = flip.x - snap * 0.6 + Math.sin(st.t * 1.7) * 0.03 * st.ready;
        net.scale.set(1 - snap * 0.25, 1 - (1 - st.ready) * 0.25 - snap * 0.2, 1 + snap * 2);
        if (sparkMat) sparkMat.color.setScalar(0.5 + Math.max(0, Math.sin(st.t * 3)) * 1.2 * st.ready);
      },
    };
  }

  /* ---------------------------------------------------------------- Ressort farceur */
  function buildSpring(c) {
    const tier = c.tier;
    const d = c.dir;
    if (tier === 1) {
      const p = K.part("spring:1base");
      p.add(G.rbox(0.82, 0.07, 0.82, 0.025), "iron", { p: [0, 0.035, 0], c: C.iron, uv: [1, 1] });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.add(G.cyl(0.035, 0.035, 0.03, 6), "metal", { p: [sx * 0.34, 0.08, sz * 0.34], c: "#a09a90" });
      d.add(p.build());
      const coil = K.node(d, 0, 0.07, 0);
      const cp = K.part("spring:1coil");
      cp.add(G.helix(0.2, 4, 0.022, 5, 0.12), "metal", { c: "#c9c2b5" });
      coil.add(cp.build());
      const plate = K.node(d, 0, 0.19, 0);
      const pp = K.part("spring:1plate");
      pp.add(G.rbox(0.72, 0.06, 0.72, 0.02), "wood", { c: C.woodL, uv: [0.8, 0.8] });
      const arrow = [
        [-0.08, -0.22],
        [0.08, -0.22],
        [0.08, 0.02],
        [0.18, 0.02],
        [0, 0.24],
        [-0.18, 0.02],
        [-0.08, 0.02],
      ];
      pp.add(G.extrude("spring:arrow", arrow, 0.01, 0), "glow", { p: [0, 0.035, 0], r: [Math.PI / 2, 0, 0], c: C.yellow });
      plate.add(pp.build({ mats: { glow: c.lamp } }));
      const pop = new Spring(120, 6, 0);
      return {
        trigger() {
          pop.kick(9);
        },
        pose(st, dt) {
          pop.target = st.readyOn ? 0 : 0.18 * (1 - st.ready);
          pop.step(dt);
          const h = Math.max(0, pop.x);
          plate.position.y = 0.19 + h;
          plate.rotation.x = Math.min(0.6, h * 1.2);
          coil.scale.y = 1 + h * 7;
          plate.rotation.z = Math.sin(st.t * 30) * 0.01 * bump(Math.min(1, st.fireT / 0.6));
        },
      };
    }
    if (tier === 2) {
      const p = K.part("spring:2box");
      p.add(G.rbox(0.62, 0.36, 0.52, 0.04), "wood", { p: [0, 0.18, -0.26], c: C.red, uv: [1, 0.6], ao: 0.6, aoH: 0.3 });
      for (const k of [0, 1, 2]) p.add(G.box(0.635, 0.05, 0.535), "wood", { p: [0, 0.06 + k * 0.12, -0.26], c: C.yellow, uv: [1, 0.1] });
      p.add(G.box(0.4, 0.26, 0.04), "matte", { p: [0, 0.2, 0.005], c: "#2a1a10" });
      p.add(G.rbox(0.66, 0.04, 0.56, 0.015), "wood", { p: [0, 0.37, -0.26], c: C.yellow });
      d.add(p.build());
      const lamp = K.part("spring:2lamp");
      lamp.add(G.ico(0.045, 1), "glow", { p: [0.22, 0.42, -0.35] });
      d.add(lamp.build({ mats: { glow: c.lamp } }));
      const coil = K.node(d, 0, 0.2, -0.3);
      coil.rotation.x = Math.PI / 2;
      const cp = K.part("spring:2coil");
      cp.add(G.helix(0.09, 6, 0.018, 5, 0.34), "metal", { c: "#c9c2b5" });
      coil.add(cp.build());
      const glove = K.node(d, 0, 0.2, 0.05);
      const gp = K.part("spring:2glove");
      gp.add(G.blob(0.17, 2, 0.06, 4), "satin", { p: [0, 0.01, 0.1], s: [1.05, 0.95, 1.15], c: C.red });
      gp.add(G.sphere(0.07, 8, 6), "satin", { p: [0.14, 0.02, 0.02], s: [1, 1.2, 1.4], c: C.red });
      gp.add(G.cyl(0.11, 0.12, 0.12, 10), "satin", { p: [0, 0, -0.08], r: [Math.PI / 2, 0, 0], c: C.white });
      gp.add(G.torus(0.105, 0.02, 3, 10), "satin", { p: [0, 0, -0.03], c: C.redD });
      gp.add(G.box(0.2, 0.02, 0.01), "matte", { p: [0, 0.07, 0.24], r: [0.3, 0, 0], c: "#ffffff" });
      glove.add(gp.build());
      const punch = new Spring(150, 7, 0);
      return {
        trigger() {
          punch.kick(14);
        },
        pose(st, dt) {
          punch.target = st.readyOn ? 0 : 0.25 * (1 - st.ready);
          punch.step(dt);
          const z = Math.max(-0.02, punch.x);
          glove.position.set(0, 0.2 + Math.sin(st.t * 2) * 0.01 * st.ready, 0.05 + z);
          glove.rotation.set(Math.sin(st.fireT * 25) * 0.1 * Math.max(0, 1 - st.fireT), 0, Math.sin(st.t * 1.4) * 0.05);
          coil.scale.set(1, 1 + z / 0.34, 1);
        },
      };
    }
    // Palier 3 : cuillère-catapulte sur ressort géant.
    const p = K.part("spring:3frame");
    p.add(G.rbox(0.9, 0.1, 1.0, 0.03), "wood", { p: [0, 0.05, 0], c: C.woodD, uv: [1, 1], ao: 0.6, aoH: 0.2 });
    for (const sx of [-1, 1]) {
      p.add(G.box(0.08, 0.42, 0.14), "wood", { p: [sx * 0.36, 0.3, 0.12], c: C.wood, uv: "box", tile: 0.5 });
      p.add(G.cyl(0.06, 0.06, 0.04, 8), "metal", { p: [sx * 0.41, 0.42, 0.12], r: [0, 0, Math.PI / 2], c: C.gold });
    }
    p.add(G.rbox(0.3, 0.14, 0.14, 0.04), "satin", { p: [0, 0.17, -0.3], c: C.velvet });
    p.add(G.cyl(0.16, 0.16, 0.04, 10), "metal", { p: [0.43, 0.42, 0.12], r: [0, 0, Math.PI / 2], c: C.goldD });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      p.add(G.box(0.04, 0.05, 0.05), "metal", { p: [0.43, 0.42 + Math.sin(a) * 0.17, 0.12 + Math.cos(a) * 0.17], r: [a, 0, 0], c: C.goldD });
    }
    d.add(p.build());
    const lamp = K.part("spring:3lamp");
    lamp.add(G.ico(0.05, 1), "glow", { p: [-0.3, 0.14, 0.4] });
    d.add(lamp.build({ mats: { glow: c.lamp } }));
    const coil = K.node(d, -0.3, 0.42, 0.12);
    coil.rotation.z = -Math.PI / 2;
    const cp = K.part("spring:3coil");
    cp.add(G.helix(0.13, 5, 0.03, 6, 0.6), "metal", { c: "#d8d0c0" });
    const cm = cp.build();
    coil.add(cm);
    const arm = K.node(d, 0, 0.42, 0.12);
    const ap = K.part("spring:3arm");
    ap.add(G.cyl(0.04, 0.05, 0.42, 8), "wood", { p: [0, 0, -0.24], r: [Math.PI / 2, 0, 0], c: C.woodL, uv: [0.3, 1] });
    ap.add(G.sphere(0.2, 12, 8, Math.PI / 2, Math.PI / 2), "wood", { p: [0, 0.07, -0.5], s: [1, 0.55, 1.15], c: C.woodL, uv: [1, 1] });
    ap.add(G.sphere(0.18, 10, 6, Math.PI / 2, Math.PI / 2), "satin", { p: [0, 0.075, -0.5], s: [1, 0.5, 1.15], r: [Math.PI, 0, 0], c: C.velvet });
    ap.add(G.cyl(0.07, 0.07, 0.86, 10), "metal", { r: [0, 0, Math.PI / 2], c: C.gold });
    arm.add(ap.build());
    const flip = new Spring(80, 9, 0);
    return {
      trigger() {
        flip.kick(24);
      },
      pose(st, dt) {
        flip.target = st.readyOn ? 0 : 0.35 * (1 - st.ready);
        flip.step(dt);
        const a = clamp(flip.x, -0.15, 1.75);
        arm.rotation.x = a + Math.sin(st.t * 2.1) * 0.01;
        cm.scale.y = 1 + a * 0.08;
        coil.rotation.x = a * 0.8;
      },
    };
  }

  /* ---------------------------------------------------------------- Faux coffre */
  function buildLure(c) {
    const tier = c.tier;
    const W = [0, 0.66, 0.78, 0.9][tier],
      H = [0, 0.36, 0.42, 0.46][tier],
      D = [0, 0.46, 0.52, 0.58][tier];
    const bodyMat = tier === 3 ? "gold" : tier === 2 ? "satin" : "wood";
    const bodyC = tier === 1 ? C.paint : tier === 2 ? "#f2c02e" : C.gold;
    const p = K.part("lure:body" + tier);
    if (tier === 3) {
      p.add(G.rbox(W + 0.3, 0.1, D + 0.3, 0.04), "satin", { p: [0, 0.05, 0], c: C.velvet, ao: 0.6, aoH: 0.12 });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.add(G.sphere(0.05, 6, 4), "gold", { p: [sx * (W / 2 + 0.12), 0.1, sz * (D / 2 + 0.12)], c: C.gold });
    }
    const y0 = tier === 3 ? 0.1 : 0;
    p.add(G.rbox(W, H, D, 0.03), bodyMat, { p: [0, y0 + H / 2, 0], c: bodyC, uv: [W * 2, H * 2], ao: tier === 3 ? false : 0.6, aoH: 0.2 });
    // Cerclages et coins.
    for (const sx of [-1, 1]) {
      p.add(G.box(0.05, H + 0.01, D + 0.02), tier === 1 ? "wood" : "gold", { p: [sx * (W / 2 - 0.08), y0 + H / 2, 0], c: tier === 1 ? C.goldD : C.gold });
    }
    // Fausse serrure.
    p.add(G.rbox(0.12, 0.14, 0.04, 0.015), "gold", { p: [0, y0 + H * 0.62, D / 2 + 0.01], c: tier === 1 ? C.goldD : C.gold });
    p.add(G.box(0.025, 0.05, 0.01), "matte", { p: [0, y0 + H * 0.6, D / 2 + 0.035], c: "#1a1208" });
    if (tier === 1) {
      // Peinture dorée qui coule : quelques traînées claires.
      for (let i = 0; i < 4; i++) p.add(G.capsule(0.012, 0.08 + (i % 2) * 0.06, 4, 1), "satin", { p: [-0.2 + i * 0.13, y0 + H - 0.08 - (i % 2) * 0.03, D / 2 + 0.005], c: "#ffe07a" });
      // Panneau « TRÉSOR ! ».
      p.add(G.cyl(0.018, 0.022, 0.62, 5), "wood", { p: [W / 2 + 0.12, 0.31, -0.08], c: C.woodD });
      p.add(G.box(0.34, 0.17, 0.02), "sign", { p: [W / 2 + 0.12, 0.56, -0.06], r: [0, -0.35, 0.06] });
    }
    if (tier >= 2) {
      const gems = [
        [-W * 0.3, y0 + H * 0.45, C.ruby],
        [W * 0.3, y0 + H * 0.45, C.sapph],
      ];
      for (const [x, y, col] of gems) p.add(G.oct(0.05), "glossy", { p: [x, y, D / 2 + 0.02], s: [1, 1.3, 0.6], c: col });
    }
    c.root.add(p.build());
    const lampP = K.part("lure:lamp" + tier);
    lampP.add(G.ico(0.035, 1), "glow", { p: [W / 2 - 0.08, y0 + 0.06, D / 2 + 0.02] });
    c.root.add(lampP.build({ mats: { glow: c.lamp } }));
    // Couvercle (charnière à l'arrière).
    const hinge = K.node(c.root, 0, y0 + H, -D / 2);
    const lp = K.part("lure:lid" + tier);
    lp.add(G.cyl(D / 2, D / 2, W, 14, false, 1), bodyMat, { p: [0, 0, D / 2], r: [0, 0, Math.PI / 2], s: [0.55, 1, 1], c: bodyC, uv: [1, 1] });
    for (const sx of [-1, 1]) lp.add(G.cyl(D / 2 + 0.012, D / 2 + 0.012, 0.05, 14), tier === 1 ? "wood" : "gold", { p: [sx * (W / 2 - 0.08), 0, D / 2], r: [0, 0, Math.PI / 2], s: [0.57, 1, 1], c: tier === 1 ? C.goldD : C.gold });
    if (tier >= 2) {
      lp.add(G.oct(0.07), "glossy", { p: [0, D * 0.3, D / 2 + 0.05], s: [1, 1.3, 0.7], c: C.emer });
      lp.add(G.oct(0.045), "glossy", { p: [-0.18, D * 0.27, D / 2 + 0.06], s: [1, 1.2, 0.7], c: C.ruby });
      lp.add(G.oct(0.045), "glossy", { p: [0.18, D * 0.27, D / 2 + 0.06], s: [1, 1.2, 0.7], c: C.sapph });
    }
    if (tier === 3) {
      // Couronne sur le couvercle.
      lp.add(G.cyl(0.13, 0.12, 0.08, 10, true), "gold", { p: [0, D * 0.28 + 0.04, D / 2 - 0.02], c: C.gold });
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU;
        lp.add(G.cone(0.03, 0.09, 4), "gold", { p: [Math.sin(a) * 0.12, D * 0.28 + 0.12, D / 2 - 0.02 + Math.cos(a) * 0.12], c: C.gold });
        lp.add(G.sphere(0.018, 5, 4), "glossy", { p: [Math.sin(a) * 0.12, D * 0.28 + 0.17, D / 2 - 0.02 + Math.cos(a) * 0.12], c: i % 2 ? C.ruby : C.white });
      }
    }
    const lid = lp.build();
    hinge.add(lid);
    // Ampoules clignotantes (palier 3) en deux groupes alternés.
    const bulbs = [];
    if (tier === 3) {
      for (let k = 0; k < 2; k++) {
        const m = c.inst("glow");
        const bp = K.part("lure:bulbs" + k);
        const n = 7;
        for (let i = k; i < n * 2; i += 2) {
          const t = i / (n * 2);
          const per = 2 * (W + D);
          let s = t * per,
            x,
            z;
          if (s < W) {
            x = -W / 2 + s;
            z = D / 2 + 0.03;
          } else if ((s -= W) < D) {
            x = W / 2 + 0.03;
            z = D / 2 - s;
          } else if ((s -= D) < W) {
            x = W / 2 - s;
            z = -D / 2 - 0.03;
          } else {
            s -= W;
            x = -W / 2 - 0.03;
            z = -D / 2 + s;
          }
          bp.add(G.ico(0.03, 1), "glow", { p: [x, y0 + H - 0.03, z], c: k ? "#ffe27a" : "#ff8ad8" });
        }
        const b = bp.build({ mats: { glow: m } });
        c.root.add(b);
        bulbs.push(m);
      }
    }
    // Contenu « ta-da » : faux tas d'or qui monte, éclat, confettis.
    const heap = K.node(c.root, 0, y0 + H - 0.04, 0);
    const hp = K.part("lure:heap" + tier);
    hp.add(G.sphere(Math.min(W, D) * 0.42, 12, 6, 0, Math.PI / 2), "coins", { s: [W / D, 0.8, 1], uv: [1.5, 1.5] });
    heap.add(hp.build());
    heap.scale.setScalar(0.001);
    const flash = K.fx.sprite(C.gold, 1.4, 0.9);
    flash.position.set(0, y0 + H + 0.25, 0);
    flash.scale.setScalar(0.001);
    c.root.add(flash);
    const conf = K.node(c.root, 0, y0 + H + 0.1, 0);
    const cf = K.part("lure:confetti");
    const cols = ["#ff4a6a", "#ffd23a", "#3ad0ff", "#7dff5a", "#c77dff", "#ffffff"];
    for (let i = 0; i < 16; i++) {
      const a = i * 2.39996,
        r = 0.15 + (i % 4) * 0.08;
      cf.add(G.plane(0.05, 0.08), "confetti", { p: [Math.cos(a) * r, 0.1 + (i % 5) * 0.08, Math.sin(a) * r], r: [a, a * 1.7, 0], c: cols[i % cols.length] });
    }
    const cm = cf.build();
    cm.userData.noBounds = true;
    conf.add(cm);
    conf.visible = false;
    const pop = new Spring(140, 7, 0);
    return {
      trigger() {
        pop.kick(-14);
      },
      pose(st, dt, time) {
        const tada = st.fireT < 1.6 ? 1 : 0;
        pop.target = tada ? -1.7 : st.readyOn ? 0 : -0.25 * (1 - st.ready);
        pop.step(dt);
        hinge.rotation.x = clamp(pop.x, -2.1, 0.05);
        const k = clamp(st.fireT / 1.6, 0, 1);
        const h = tada ? easeOut(Math.min(1, st.fireT / 0.3)) * (1 - Math.pow(k, 6)) : 0;
        heap.scale.set(Math.max(0.001, h), Math.max(0.001, h * (1 + bump(Math.min(1, st.fireT / 0.5)) * 0.4)), Math.max(0.001, h));
        heap.position.y = y0 + H - 0.04 + h * 0.06;
        flash.scale.setScalar(Math.max(0.001, bump(Math.min(1, st.fireT / 0.7)) * (1.2 + tier * 0.4)));
        conf.visible = st.fireT < 1.4;
        if (conf.visible) {
          const q = st.fireT / 1.4;
          conf.position.y = y0 + H + 0.1 + Math.sin(q * Math.PI) * 0.7 - q * 0.2;
          conf.scale.setScalar(0.4 + q * 2.2);
          conf.rotation.y = q * 3;
        }
        for (let i = 0; i < bulbs.length; i++) {
          const on = ((Math.floor(time * 4) + i) & 1) === 0;
          bulbs[i].color.setScalar(st.ready * (on ? 2.2 : 0.35) + (tada ? 1.5 : 0));
        }
      },
    };
  }

  const DEFS = {
    net: { build: buildNet, ringR: 0.85 },
    spring: { build: buildSpring, ringR: 0.8, directional: true },
    lure: { build: buildLure, ringR: 0.8 },
  };
  PTMT.models.trap = function (kind, tier) {
    const def = DEFS[kind];
    if (!def) throw new Error("PTMT : piège inconnu " + kind);
    return trapShell(kind, clamp(tier | 0 || 1, 1, 3), def);
  };

})();
