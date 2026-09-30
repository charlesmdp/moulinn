// « Pas touche à mes trésors » — repères de la carte : menhirs (puits de mana) et entrées.
//
//   PTMT.models.menhir()   menhir de granit gravé de spirales bleues qui pulsent, lichens jaunes,
//                          étincelles de mana qui montent, triskèle lumineux au sol.
//     → { object, setActive(bool) (plus lumineux quand une tour est posée sur la case), update(dt, time), dispose() }
//     Origine = pied du menhir (à poser dans un coin de la case, à côté de la tour).
//
//   PTMT.models.gate(index)  entrée au bord de la carte : poteau indicateur breton (panneaux bilingues
//                            « Elven / An Elven », « Vannes / Gwened »… selon l'index), lanterne, et
//                            chevrons lumineux au sol qui filent vers l'intérieur de la carte.
//     → { object, pulse(on) (la flèche clignote : la prochaine vague entre ici), update(dt, time), dispose() }
//     Origine = centre de la case E au niveau du chemin ; +Z = vers l'intérieur de la carte ; le poteau
//     se tient au bord droit du chemin (+X local).
(function () {
  "use strict";
  const PTMT = globalThis.PTMT;
  if (!PTMT || typeof THREE === "undefined" || !PTMT.models || !PTMT.models.props) return;
  const K = PTMT.models.kit;
  const P = PTMT.models.props;
  const { TAU, clamp, damp } = K.math;
  const { noise3, fbm, hash2, voronoi } = K.noise;
  const T = P.T;
  const col = K.col;

  /* ================================================================== menhir */
  // Texture du menhir (256 × 512) : granit gris, lichens, gravures ; masque lumineux des spirales.
  let menhirTex = null;
  function menhirTextures() {
    if (menhirTex) return menhirTex;
    const w = 512,
      h = 512;
    const cvA = document.createElement("canvas"),
      cvB = document.createElement("canvas");
    cvA.width = cvB.width = w;
    cvA.height = cvB.height = h;
    const a = cvA.getContext("2d"),
      b = cvB.getContext("2d");
    // Granit : grain, veines, lichens jaunes et gris-vert.
    const img = a.createImageData(w, h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const u = x / w,
          v = y / h;
        const n = fbm(u, v * 2, 6, 7, 4);
        const grain = hash2(x, y, 3);
        let l = 0.62 + n * 0.32 + (grain - 0.5) * 0.14;
        if (grain > 0.93) l += 0.12;
        if (grain < 0.05) l -= 0.18;
        const lichen = fbm(u + 0.3, v * 2 + 0.7, 5, 21, 3);
        const ly = Math.max(0, Math.min(1, (lichen - 0.68) * 6)) * (v > 0.35 ? 0.7 : 0.3);
        const lg = Math.max(0, Math.min(1, (fbm(u, v * 2, 7, 33, 3) - 0.64) * 8));
        let r = 150 * l,
          g = 148 * l,
          bb = 142 * l;
        r = r * (1 - ly) + 222 * ly;
        g = g * (1 - ly) + 190 * ly;
        bb = bb * (1 - ly) + 70 * ly;
        r = r * (1 - lg * 0.7) + 128 * lg * 0.7;
        g = g * (1 - lg * 0.7) + 150 * lg * 0.7;
        bb = bb * (1 - lg * 0.7) + 110 * lg * 0.7;
        const i = (y * w + x) * 4;
        img.data[i] = r;
        img.data[i + 1] = g;
        img.data[i + 2] = bb;
        img.data[i + 3] = 255;
      }
    a.putImageData(img, 0, 0);
    b.fillStyle = "#000";
    b.fillRect(0, 0, w, h);
    // Gravures : triple spirale sur la face avant (u = 0,5), spirales sur les flancs, cupules.
    const spiral = (g, cx, cy, R, turns, dir, a0) => {
      g.beginPath();
      for (let t = 0; t <= 1.0001; t += 0.01) {
        const ang = a0 + dir * t * TAU * turns;
        const r = R * (0.08 + 0.92 * t);
        const x = cx + Math.cos(ang) * r,
          y = cy + Math.sin(ang) * r * 1.0;
        if (t === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
    };
    const carve = (g, groove) => {
      g.lineCap = "round";
      g.lineJoin = "round";
      g.strokeStyle = groove ? "rgba(40,38,40,0.85)" : "#fff";
      g.lineWidth = groove ? 7 : 5;
      if (!groove) {
        g.shadowColor = "#fff";
        g.shadowBlur = 10;
      }
      // Triskèle central.
      const cx = w * 0.5,
        cy = h * 0.4,
        R = 36;
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * TAU - Math.PI / 2;
        spiral(g, cx + Math.cos(a) * R * 0.95, cy + Math.sin(a) * R * 0.95, R, 1.6, 1, a + Math.PI);
      }
      g.beginPath();
      g.arc(cx, cy, R * 2.25, 0, TAU);
      g.stroke();
      // Spirales doubles sur les flancs.
      for (const u of [0.18, 0.82]) {
        spiral(g, w * u - 16, h * 0.56, 22, 1.5, 1, 0);
        spiral(g, w * u + 16, h * 0.56, 22, 1.5, -1, Math.PI);
      }
      // Chevrons et cupules sous le triskèle.
      g.beginPath();
      for (let i = 0; i < 3; i++) {
        const y = h * 0.62 + i * 26;
        g.moveTo(cx - 34, y);
        g.lineTo(cx, y + 18);
        g.lineTo(cx + 34, y);
      }
      g.stroke();
      for (let i = 0; i < 4; i++) {
        g.beginPath();
        g.arc(cx + (i - 1.5) * 22, h * 0.84, 5, 0, TAU);
        g.stroke();
      }
      g.shadowBlur = 0;
    };
    carve(a, true);
    carve(b, false);
    const ta = new THREE.CanvasTexture(cvA),
      tb = new THREE.CanvasTexture(cvB);
    ta.encoding = tb.encoding = THREE.sRGBEncoding;
    ta.anisotropy = tb.anisotropy = 4;
    menhirTex = { map: ta, glow: tb };
    return menhirTex;
  }
  /** Pierre dressée : cylindre déformé (section ovale, bosses, pointe arrondie), UV conservées. */
  function menhirTpl() {
    return P.tc("menhir", () => {
      const H = 2.75;
      const g = new THREE.CylinderGeometry(0.34, 0.5, H, 12, 8, false, Math.PI);
      g.translate(0, H / 2, 0);
      const t = P.fromGeo(g);
      return P.deform(t, (x, y, z) => {
        const v = y / H;
        const a = Math.atan2(x, z);
        const n = noise3(Math.sin(a) * 1.3, v * 3.1, Math.cos(a) * 1.3, 17) - 0.5;
        let k = 1 + n * 0.32;
        // Pointe arrondie, penchée vers l'arrière.
        const top = Math.max(0, (v - 0.78) / 0.22);
        k *= Math.sqrt(Math.max(0.04, 1 - top * top));
        const yy = y + top * 0.12 + (v > 0.999 ? 0.08 : 0);
        return [x * k * 1.12, yy, z * k * 0.8 - top * 0.12];
      });
    });
  }

  PTMT.models.menhir = function () {
    const root = new THREE.Group();
    root.name = "ptmt-menhir";
    const tex = menhirTextures();
    const rnd = P.rng(77 + (P._menhirs = (P._menhirs || 0) + 1));
    const mat = P.paint({ map: tex.map, rim: [0.05, 0.4, 0.45], lift: 0.1, name: "menhir" });
    mat.emissiveMap = tex.glow;
    mat.emissive = col("#4fd8ff").clone();
    mat.emissiveIntensity = 1;
    const A = new P.Acc({ uv: true, seed: 5 });
    A.put(menhirTpl(), [0, -0.12, 0], [0, 0, 0.05], 1, { c: "#e8e4dc", rim: 0.7 });
    // Pierres de calage et touffes au pied (coordonnées d'UV sur une zone sans gravure).
    const bits = [
      [0.55, 0.2, 0.26],
      [-0.5, -0.15, 0.22],
      [0.2, 0.5, 0.18],
      [-0.3, 0.42, 0.15],
    ];
    bits.forEach(([x, z, s], i) => A.put(T.rock(60 + i, 1, 0.3), [x, 0.02, z], [0, rnd() * TAU, 0], [s * 1.3, s * 0.8, s], { c: "#b8b2a6", uvs: [0.05, 0.05], uo: 0.02, vo: 0.02, rim: 0.6, moss: ["#6f9a3a", 0.45, 0.8] }));
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU + rnd() * 0.4,
        r = 0.55 + rnd() * 0.2;
      A.put(T.blade(0.1 * (i % 2 ? 1 : -1), 0.06), [Math.cos(a) * r, 0, Math.sin(a) * r * 0.8], [0, rnd() * TAU, (rnd() - 0.5) * 0.4], [1, 0.35 + rnd() * 0.25, 1], { c: i % 3 ? "#5f9a34" : "#8fbf4a", uvs: [0, 0], uo: 0.02, vo: 0.02 });
    }
    const body = P.mesh(A, mat, { cast: true, name: "menhir", pad: 0.5 });
    root.add(body);
    // Lueurs : 0 = triskèle au sol et halo, 1 = étincelles de mana, 2 = éclat du sommet.
    const specs = [
      { mode: "decal", p: [0, 0.04, 0.1], size: 1.2, cell: "triskel", color: "#3fc8ff", a: 0.9, add: 0.55, flick: 1, rot: 0.3, group: 0 },
      { mode: "decal", p: [0, 0.03, 0.1], size: 1.6, cell: "glow", color: "#1a8cff", a: 0.55, add: 0.7, flick: 1, group: 0 },
      { mode: "glow", p: [0, 1.5, 0.28], size: 1.1, cell: "glow", color: "#4fc8ff", a: 0.35, add: 1, flick: 0.3, group: 2 },
    ];
    for (let i = 0; i < 14; i++)
      specs.push({ mode: "spark", p: [0, 0.1, 0], size: 0.09 + rnd() * 0.07, cell: i % 3 ? "spark" : "star", color: i % 2 ? "#9ff0ff" : "#ffffff", a: 1, add: 1, speed: 0.22 + rnd() * 0.18, phase: rnd(), r: 0.55 + rnd() * 0.35, turns: 1.5 + rnd() * 2, h: 2.6 + rnd() * 1.2, group: 1 });
    const fx = P.fx(specs, { name: "mana" });
    root.add(fx.mesh);
    const st = { on: false, k: 0, t: rnd() * 10 };
    return {
      object: root,
      setActive(on) {
        st.on = !!on;
      },
      update(dt, time) {
        if (dt > 0.1) dt = 0.1;
        if (dt < 0) dt = 0;
        P.tick(time);
        st.t += dt;
        st.k = damp(st.k, st.on ? 1 : 0, 4, dt);
        const beat = 0.5 + 0.5 * Math.sin(st.t * (1.8 + st.k * 1.4));
        mat.emissiveIntensity = 0.55 + beat * 0.55 + st.k * (0.9 + beat * 0.6);
        fx.gain.set(0.45 + st.k * 0.55 + beat * 0.15, 0.45 + st.k * 0.85, 0.3 + st.k * 0.7 + beat * 0.2, 1);
      },
      dispose() {
        if (root.parent) root.parent.remove(root);
        body.geometry.dispose();
        mat.dispose();
        fx.material.dispose();
      },
    };
  };

  /* ================================================================== entrées */
  // Panneaux bilingues (nom français, nom breton) : communes autour d'Elven et du moulin.
  const PLACES = [
    ["Elven", "An Elven"],
    ["Vannes", "Gwened"],
    ["Questembert", "Kistreberzh"],
    ["Ploërmel", "Ploermael"],
    ["Josselin", "Josilin"],
    ["Trédion", "Tredion"],
    ["Sulniac", "Sulniag"],
    ["Theix", "Teiz"],
  ];
  // Planche des panneaux (512 × 512) : 9 cartouches de 256 × 96 (8 communes + « Moulin »), zone blanche.
  let signTex = null;
  const SLOT_W = 256,
    SLOT_H = 96,
    ATLAS = 512;
  function slotUV(k) {
    const cx = k % 2,
      cy = Math.floor(k / 2);
    return { u: (cx * SLOT_W) / ATLAS, v: 1 - ((cy + 1) * SLOT_H) / ATLAS, su: SLOT_W / ATLAS, sv: SLOT_H / ATLAS };
  }
  const WHITE_UV = [0.96, 0.02];
  function signTexture() {
    if (signTex) return signTex;
    const cv = document.createElement("canvas");
    cv.width = cv.height = ATLAS;
    const g = cv.getContext("2d");
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, ATLAS, ATLAS);
    const names = PLACES.concat([["Moulin", "Milin"]]);
    names.forEach(([fr, br], k) => {
      const x = (k % 2) * SLOT_W,
        y = Math.floor(k / 2) * SLOT_H;
      g.save();
      g.translate(x, y);
      const moulin = k === 8;
      g.fillStyle = moulin ? "#fff4d6" : "#fbfaf4";
      g.fillRect(0, 0, SLOT_W, SLOT_H);
      g.strokeStyle = moulin ? "#8a2a1a" : "#b0281c";
      g.lineWidth = 7;
      g.strokeRect(6, 6, SLOT_W - 12, SLOT_H - 12);
      g.fillStyle = "#1c1a18";
      g.textAlign = "center";
      g.textBaseline = "middle";
      let size = 44;
      g.font = `700 ${size}px system-ui, "Segoe UI", sans-serif`;
      while (g.measureText(fr).width > SLOT_W - 36 && size > 20) {
        size -= 2;
        g.font = `700 ${size}px system-ui, "Segoe UI", sans-serif`;
      }
      g.fillText(fr, SLOT_W / 2, SLOT_H * 0.4);
      g.fillStyle = "#3a5a8a";
      g.font = `italic 600 22px system-ui, "Segoe UI", sans-serif`;
      g.fillText(br, SLOT_W / 2, SLOT_H * 0.76);
      g.restore();
    });
    signTex = new THREE.CanvasTexture(cv);
    signTex.encoding = THREE.sRGBEncoding;
    signTex.anisotropy = 4;
    signTex.name = "ptmt:props-signs";
    return signTex;
  }
  function signMaterial() {
    return P.shared("signs", () => P.paint({ map: signTexture(), rim: [0.05, 0.4, 0.5], lift: 0.14, name: "poteau" }));
  }
  /** Panneau en flèche (planche pointue) : pièce de bois + deux faces imprimées. */
  function plate(A, M, y, yaw, len, slot) {
    const W0 = { c: "#f4f2ea", uvs: [0, 0], uo: WHITE_UV[0], vo: WHITE_UV[1] };
    const pm = new THREE.Matrix4().makeRotationY(yaw).setPosition(0, y, 0).premultiply(M);
    // Planche (le long de +X), pointe au bout.
    A.put(T.box(len, 0.36, 0.06), [0.12 + len / 2, 0, 0], 0, 1, Object.assign({ c: "#e8e2d2" }, W0), pm);
    A.put(
      T.extrude("signTip", [
        [0, -0.18],
        [0.24, 0],
        [0, 0.18],
      ], 0.06),
      [0.12 + len, 0, 0],
      0,
      1,
      Object.assign({}, W0, { c: "#e8e2d2" }),
      pm,
    );
    const s = slotUV(slot);
    for (const side of [1, -1]) {
      A.put(T.plane, [0.12 + len / 2, 0, side * 0.032], [0, side < 0 ? Math.PI : 0, 0], [len * 0.96, 0.34, 1], { c: "#ffffff", uvs: [s.su, s.sv], uo: s.u, vo: s.v }, pm);
    }
  }
  T.plane = P.fromGeo(new THREE.PlaneGeometry(1, 1));

  PTMT.models.gate = function (index) {
    const k = Math.abs(index | 0);
    const root = new THREE.Group();
    root.name = "ptmt-gate-" + k;
    const rnd = P.rng(900 + k * 13);
    const A = new P.Acc({ uv: true, seed: 21 + k });
    const WO = (c, o) => Object.assign({ c, uvs: [0, 0], uo: WHITE_UV[0], vo: WHITE_UV[1] }, o || {});
    const px = 1.45,
      pz = 0.5;
    const M = new THREE.Matrix4().makeTranslation(px, 0, pz);
    // Poteau de châtaignier grisé, chapeau, jambes de force, pierres au pied.
    A.put(T.boxB(0.2, 2.8, 0.2), [0, 0, 0], 0, 1, WO("#8a7a66", { vj: 0.08, ao: [0.6, 0, 0.8] }), M);
    A.put(T.cone(0.2, 0.22, 4), [0, 2.8, 0], [0, Math.PI / 4, 0], 1, WO("#5e4a38"), M);
    for (const s of [-1, 1]) A.put(T.box(0.08, 0.7, 0.08), [s * 0.22, 0.28, 0], [0, 0, s * 0.5], 1, WO("#6e5e4c"), M);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU + rnd();
      A.put(T.rock(80 + i, 1, 0.3), [Math.cos(a) * 0.3, 0.02, Math.sin(a) * 0.3], [0, rnd() * TAU, 0], [0.2, 0.13, 0.17], WO("#a8a296", { rim: 0.6, moss: ["#6f9a3a", 0.5, 0.85] }), M);
    }
    for (let i = 0; i < 8; i++) {
      const a = rnd() * TAU,
        r = 0.3 + rnd() * 0.3;
      A.put(T.blade(0.1 * (i % 2 ? 1 : -1), 0.06), [Math.cos(a) * r, 0, Math.sin(a) * r], [0, rnd() * TAU, (rnd() - 0.5) * 0.4], [1, 0.4 + rnd() * 0.3, 1], WO(i % 3 ? "#5f9a34" : "#8fbf4a"), M);
    }
    // Trois panneaux : deux communes vers l'extérieur, « Moulin » vers l'intérieur de la carte.
    const a0 = (k * 2) % 8,
      a1 = (k * 2 + 1) % 8;
    // Deux communes de face (lisibles depuis la caméra), « Moulin » vers l'intérieur de la carte.
    plate(A, M, 2.36, 0.28, 1.15, a0);
    plate(A, M, 1.96, Math.PI - 0.3, 1.1, a1);
    plate(A, M, 1.56, -Math.PI * 0.5, 1.0, 8);
    // Potence et lanterne suspendue au-dessus du chemin.
    A.put(T.box(0.07, 0.07, 0.8), [-0.35, 2.55, 0], [0, Math.PI / 2, 0], 1, WO("#3a3430"), M);
    A.put(T.box(0.05, 0.4, 0.05), [-0.12, 2.38, 0], [0, 0, -0.75], 1, WO("#3a3430"), M);
    const lan = [-0.68, 2.2, 0];
    A.put(T.cylB(0.012, 0.012, 0.3, 4), [lan[0], lan[1] + 0.05, lan[2]], 0, 1, WO("#3a3430"), M);
    A.put(T.boxB(0.26, 0.03, 0.26), [lan[0], lan[1] - 0.36, lan[2]], 0, 1, WO("#34302e"), M);
    A.put(T.cone(0.21, 0.16, 4), [lan[0], lan[1] - 0.02, lan[2]], [0, Math.PI / 4, 0], 1, WO("#34302e"), M);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) A.put(T.boxB(0.025, 0.33, 0.025), [lan[0] + sx * 0.11, lan[1] - 0.35, lan[2] + sz * 0.11], 0, 1, WO("#34302e"), M);
    A.put(T.boxB(0.17, 0.28, 0.17), [lan[0], lan[1] - 0.33, lan[2]], 0, 1, WO("#ffd27a", { emit: 1.1 }), M);
    const body = P.mesh(A, signMaterial(), { cast: true, name: "poteau", pad: 0.5 });
    root.add(body);
    // Lueurs : 0 = lanterne et chevrons au repos, 1 = alerte (vague qui arrive), 2 = lanterne rouge.
    const lw = new THREE.Vector3(...lan).applyMatrix4(M);
    const specs = [
      { mode: "glow", p: [lw.x, lw.y - 0.2, lw.z], size: 0.62, cell: "glow", color: "#ffc25a", a: 0.9, add: 1, flick: 0.2, group: 0 },
      { mode: "glow", p: [lw.x, lw.y - 0.2, lw.z], size: 1.2, cell: "glow", color: "#ff9a3a", a: 0.3, add: 1, flick: 0.15, group: 0 },
      { mode: "glow", p: [lw.x, lw.y - 0.2, lw.z], size: 1.0, cell: "glow", color: "#ff3a1a", a: 1, add: 1, flick: 0.35, group: 2 },
    ];
    for (let i = 0; i < 3; i++) {
      specs.push({ mode: "slide", p: [0, 0.05, 0], size: 0.72, len: 3.2, dir: [0, 1], cell: "chevronO", color: "#ffd66a", a: 0.95, add: 0, speed: 0.4, phase: i / 3, group: 0 });
      specs.push({ mode: "slide", p: [0, 0.06, 0], size: 0.95, len: 3.4, dir: [0, 1], cell: "chevronO", color: "#ff6a2a", a: 1, add: 0, speed: 0.85, phase: i / 3, group: 1 });
      specs.push({ mode: "slide", p: [0, 0.07, 0], size: 1.05, len: 3.4, dir: [0, 1], cell: "chevron", color: "#ffb03a", a: 0.8, add: 1, speed: 0.85, phase: i / 3, group: 1 });
    }
    specs.push({ mode: "decal", p: [0, 0.04, 0.2], size: 1.9, cell: "glow", color: "#ff5a1a", a: 0.6, add: 0.6, flick: 1, group: 1 });
    const fx = P.fx(specs, { name: "flèche d'entrée" });
    root.add(fx.mesh);
    const st = { on: false, k: 0, t: 0 };
    return {
      object: root,
      index: k,
      names: [PLACES[a0][0], PLACES[a1][0]],
      pulse(on) {
        st.on = !!on;
      },
      update(dt, time) {
        if (dt > 0.1) dt = 0.1;
        if (dt < 0) dt = 0;
        P.tick(time);
        st.t += dt;
        st.k = damp(st.k, st.on ? 1 : 0, 6, dt);
        const blink = 0.5 + 0.5 * Math.sin(st.t * 7);
        fx.gain.set(0.55 * (1 - st.k) + 0.2, st.k * (0.55 + 0.45 * blink), st.k * (0.5 + 0.5 * blink), 1);
      },
      dispose() {
        if (root.parent) root.parent.remove(root);
        body.geometry.dispose();
        fx.material.dispose();
        fx.mesh.geometry.dispose();
      },
    };
  };
})();
