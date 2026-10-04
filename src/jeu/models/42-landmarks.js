// « Pas touche à mes trésors » — repères de la carte : menhirs (puits de mana), entrées, moulin,
// buttes et barrières.
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
//
//   PTMT.models.mill()  le moulin breton (granit, ardoises, roue à aubes qui tourne sous la chute du
//                       coursier, lanterne, cloche d'alarme, cheminée qui fume) sur ses six cases (3 × 2).
//     → { object, alarm(bool) (la cloche sonne, la lanterne rougit), update(dt, time), dispose() }
//     Origine = centre de ses 3 × 2 cases (3 selon X, 2 selon Z) au niveau du chemin, façade (porte,
//     cloche) vers +Z, c'est-à-dire vers la cachette principale posée devant lui. Ses cases sont au
//     niveau des plateaux (+0,45) ; deux marches descendent vers la cachette.
//
//   PTMT.models.highGround({ seed })  butte : case de 3,6 m surélevée de 1,3 m au milieu d'une route.
//     → { object, height: 1,3 (dessus, où poser la tour), update(dt, time), dispose() }
//     Origine = centre de la case au niveau du chemin. Un appel de dessin.
//
//   PTMT.models.barrier(width | { width, seed })  entrée fermée (1 à 3 cases de large) : barrière de
//     bois, haie d'ajoncs côté extérieur, panneau « Route barrée ».
//     → { object, width, isOpen, open() → Promise (la barrière cède en ≈ 1,6 s : planches qui volent,
//         haie qui s'écarte, panneau qui bascule ; il reste des débris sur les bords), setOpen(bool)
//         (sans animation), update(dt, time), dispose() }
//     Origine = centre de l'entrée (milieu du groupe de cases) au niveau du chemin, largeur selon X
//     local, +Z = vers l'intérieur de la carte (comme gate). Un appel de dessin (deux pendant la chute).
(function () {
  "use strict";
  const PTMT = globalThis.PTMT;
  if (!PTMT || typeof THREE === "undefined" || !PTMT.models || !PTMT.models.props) return;
  const K = PTMT.models.kit;
  const P = PTMT.models.props;
  const { TAU, clamp, lerp, damp } = K.math;
  const { noise3, fbm, hash2 } = K.noise;
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

  /* ================================================================== moulin */
  const C = {
    granite: "#b3aa97",
    graniteW: "#c9c0ad",
    graniteD: "#8e8574",
    dressed: "#d2c8b2",
    slate: "#7486a0",
    slateD: "#4d586c",
    wood: "#9a7652",
    woodD: "#5e4430",
    woodW: "#a88d6c",
    wet: "#4f3a28",
    door: "#2f6e8e",
    doorD: "#1f4f68",
    shutter: "#3f86a8",
    iron: "#34302e",
    bronze: "#c08a3a",
    grass: "#6fae3e",
    grassD: "#4a8a2e",
    earth: "#8a6a48",
    flowerB: "#4a6cff",
    flowerP: "#ff5aa8",
    lantern: "#ffcf6a",
    window: "#2a3346",
  };
  P.MILL_COLORS = C;

  /** Toit à deux pans (faîtage selon X local) : pièces ajoutées à l'accumulateur d'ardoise. */
  function gableRoof(A, M, L, W, rise, over, y0, cz) {
    const slope = Math.atan2(rise, W / 2);
    const run = W / 2 + over;
    const drop = over * Math.tan(slope);
    const len = Math.hypot(run, rise + drop);
    for (const s of [-1, 1]) {
      A.slate.put(T.boxSeg(L + over * 2, 0.14, len, 10, 1, 5), [0, y0 + (rise - drop) / 2 + 0.07, cz + (s * run) / 2], [s * slope, 0, 0], 1, { c: C.slate, box: 1.1, vj: 0.2, vs: 0.55 }, M);
    }
    A.slate.put(T.box(L + over * 2 + 0.06, 0.22, 0.22), [0, y0 + rise + 0.11, cz], [Math.PI / 4, 0, 0], 1, { c: C.slateD, box: 1.1 }, M);
  }
  /** Pignon triangulaire de granit (plan YZ local, épaisseur selon X). */
  function gable(A, M, x, W, rise, y0, cz, th) {
    A.stone.put(
      T.extrude("gable" + W + "," + rise + "," + th, [
        [-W / 2, 0],
        [W / 2, 0],
        [0, rise],
      ], th),
      [x, y0, cz],
      [0, Math.PI / 2, 0],
      1,
      { c: C.granite, box: 1.6, ao: [0.8, y0, y0 + rise] },
      M,
    );
  }

  // Le moulin est dessiné dans un repère dont l'origine est au pied de sa façade, au milieu (le
  // repère du « repaire » de la v3), puis recentré : centre de ses 3 × 2 cases, façade vers +Z.
  const MILL_DZ = 5.4;
  PTMT.models.mill = function () {
    const root = new THREE.Group();
    root.name = "ptmt-mill";
    const body = new THREE.Group();
    body.position.z = MILL_DZ;
    root.add(body);
    const rnd = P.rng(4242);
    const M = new THREE.Matrix4();
    const A = { stone: new P.Acc({ uv: true, seed: 11 }), slate: new P.Acc({ uv: true, seed: 12 }), main: new P.Acc({ seed: 13 }) };
    const S = A.stone,
      W = A.main;

    const FL = 0.45; // sol des cases du moulin (herbe des plateaux)
    const bx0 = -4.6,
      bx1 = 2.4,
      bz0 = -7.0,
      bz1 = -2.4;
    const BL = bx1 - bx0,
      BW = bz1 - bz0,
      bcx = (bx0 + bx1) / 2,
      bcz = (bz0 + bz1) / 2;
    // Moulin trapu : vue du dessus inclinée à 60°, le toit ne mord pas sur la cachette devant lui.
    const EAVE = FL + 2.9,
      RISE = 2.0;
    const WH = { x: 3.9, y: FL + 0.5, z: -2.95, r: 1.38, w: 0.6 }; // roue

    /* --- socle : levée de terre herbue bordée de granit, marches vers la cachette (évidée pour la fosse) */
    const grassO = { c: C.grassD, g: [C.earth, C.grass, -0.2, FL], vj: 0.1 };
    W.put(T.boxB(7.85, FL + 0.31, 6.75), [-1.425, -0.35, -5.57], 0, 1, grassO);
    W.put(T.boxB(2.85, FL + 0.31, 5.3), [3.925, -0.35, -6.3], 0, 1, grassO);
    // Mur de soutènement au bord avant, ouvert devant la porte pour deux marches.
    S.put(T.boxB(4.08, FL + 0.37, 0.36), [-3.36, -0.35, -1.98], 0, 1, { c: C.graniteD, box: 1.4, vj: 0.08 });
    S.put(T.boxB(4.68, FL + 0.37, 0.36), [3.06, -0.35, -1.98], 0, 1, { c: C.graniteD, box: 1.4, vj: 0.08 });
    S.put(T.boxB(1.92, 0.3, 0.22), [-0.3, 0, -2.09], 0, 1, { c: C.dressed, box: 1.2 });
    S.put(T.boxB(1.92, 0.15, 0.2), [-0.3, 0, -1.89], 0, 1, { c: C.dressed, box: 1.2 });
    // Pavés devant la porte.
    for (let i = 0; i < 7; i++) S.put(T.boxB(0.5, 0.06, 0.32), [-1.1 + (i % 4) * 0.52 + (i > 3 ? 0.26 : 0), FL, -2.32 + (i > 3 ? 0.0 : 0.04)], [0, (rnd() - 0.5) * 0.2, 0], 1, { c: C.graniteW, box: 0.8, j: 0.08 });

    /* --- bâtiment : murs de moellons, chaînages clairs, pignons, toit d'ardoise */
    const wall = (x, z, w, h, d, tint) => S.put(T.boxB(w, h, d), [x, FL, z], 0, 1, { c: tint || C.granite, box: 1.6, ao: [0.7, FL, FL + 1.4], vj: 0.05 });
    wall(bcx, bz0 + 0.25, BL, EAVE - FL, 0.5);
    wall(bcx, bz1 - 0.25, BL, EAVE - FL, 0.5);
    wall(bx0 + 0.25, bcz, 0.5, EAVE - FL, BW - 1);
    wall(bx1 - 0.25, bcz, 0.5, EAVE - FL, BW - 1);
    for (const sx of [bx0, bx1])
      for (const sz of [bz0, bz1]) {
        const dx = sx === bx0 ? 1 : -1,
          dz = sz === bz0 ? 1 : -1;
        for (let i = 0; i < 9; i++) {
          const long = i % 2 === 0;
          S.put(T.box(long ? 0.66 : 0.4, 0.34, long ? 0.4 : 0.66), [sx + dx * (long ? 0.31 : 0.18), FL + 0.19 + i * 0.37, sz + dz * (long ? 0.18 : 0.31)], 0, 1.02, { c: C.dressed, box: 1.2, j: 0.05 });
        }
      }
    gable(A, M, bx0 + 0.25, BW, RISE, EAVE, bcz, 0.5);
    gable(A, M, bx1 - 0.25, BW, RISE, EAVE, bcz, 0.5);
    gableRoof(A, M, BL, BW, RISE, 0.38, EAVE, bcz);
    // Cheminée sur le pignon gauche.
    S.put(T.boxB(0.75, 1.9, 0.9), [bx0 + 0.45, EAVE + RISE - 0.9, bcz - 0.1], 0, 1, { c: C.granite, box: 1.2 });
    S.put(T.boxB(0.9, 0.14, 1.05), [bx0 + 0.45, EAVE + RISE + 1.0, bcz - 0.1], 0, 1, { c: C.dressed, box: 1.2 });
    // Lucarne (porte du grenier) au-dessus de la porte, avec sa poutre de levage.
    const lx = -1.25,
      lz = bz1 - 0.05;
    S.put(T.boxB(1.5, 1.35, 1.1), [lx, EAVE - 0.35, lz - 0.45], 0, 1, { c: C.granite, box: 1.4 });
    S.put(
      T.extrude("dormerGable", [
        [-0.75, 0],
        [0.75, 0],
        [0, 0.72],
      ], 1.1),
      [lx, EAVE + 1.0, lz - 0.45],
      0,
      1,
      { c: C.granite, box: 1.4 },
      M,
    );
    for (const s of [-1, 1]) A.slate.put(T.box(1.18, 0.1, 1.42), [lx + s * 0.4, EAVE + 1.41, lz - 0.52], [0, 0, -s * 0.765], 1, { c: C.slate, box: 1 }, M);
    W.put(T.boxB(0.95, 0.95, 0.08), [lx, EAVE - 0.2, lz + 0.12], 0, 1, { c: C.woodD });
    for (let i = 0; i < 4; i++) W.put(T.boxB(0.2, 0.9, 0.04), [lx - 0.33 + i * 0.22, EAVE - 0.18, lz + 0.17], 0, 1, { c: C.wood, j: 0.1 });
    W.put(T.box(0.16, 0.16, 1.2), [lx, EAVE + 0.95, lz + 0.35], 0, 1, { c: C.woodD });
    W.put(T.cylB(0.012, 0.012, 1.1, 4), [lx, EAVE - 0.15, lz + 0.9], 0, 1, { c: "#e0cfa0" });
    // Porte d'entrée : encadrement de granit, vantail bleu breton en planches, ferrures.
    const dx = -0.3,
      dw = 1.25,
      dh = 2.15,
      dz = bz1;
    W.put(T.boxB(dw + 0.08, dh, 0.1), [dx, FL, dz + 0.0], 0, 1, { c: "#16110d" });
    for (const s of [-1, 1]) S.put(T.boxB(0.34, dh + 0.05, 0.3), [dx + s * (dw / 2 + 0.17), FL, dz + 0.05], 0, 1, { c: C.dressed, box: 1.1 });
    S.put(T.boxB(dw + 1.0, 0.42, 0.34), [dx, FL + dh, dz + 0.06], 0, 1, { c: C.dressed, box: 1.1 });
    for (let i = 0; i < 5; i++) W.put(T.boxB(dw / 5 - 0.02, dh - 0.06, 0.07), [dx - dw / 2 + dw / 10 + (i * dw) / 5, FL, dz + 0.1], 0, 1, { c: i % 2 ? C.door : C.doorD, j: 0.05 });
    for (const y of [0.35, dh - 0.45]) W.put(T.box(dw * 0.85, 0.08, 0.04), [dx - 0.05, FL + y, dz + 0.16], 0, 1, { c: C.iron });
    W.put(T.torus(0.07, 0.018, 4, 10), [dx + dw * 0.3, FL + 1.05, dz + 0.18], 0, 1, { c: C.iron });
    // Fenêtres à volets bleus (gauche) et petite fenêtre (droite).
    const windowAt = (x, y, w, h, shutters) => {
      S.put(T.box(w + 0.28, h + 0.28, 0.2), [x, y, dz + 0.02], 0, 1, { c: C.dressed, box: 1.1 });
      W.put(T.box(w, h, 0.06), [x, y, dz + 0.1], 0, 1, { c: C.window, emit: 0.05 });
      W.put(T.box(0.05, h, 0.05), [x, y, dz + 0.14], 0, 1, { c: "#f2efe6" });
      W.put(T.box(w, 0.05, 0.05), [x, y, dz + 0.14], 0, 1, { c: "#f2efe6" });
      if (shutters)
        for (const s of [-1, 1]) {
          W.put(T.box(w * 0.55, h + 0.06, 0.06), [x + s * (w * 0.5 + 0.2 + w * 0.27), y, dz + 0.12], 0, 1, { c: C.shutter });
          for (const yy of [-0.25, 0.25]) W.put(T.box(w * 0.5, 0.05, 0.03), [x + s * (w * 0.5 + 0.2 + w * 0.27), y + yy * h, dz + 0.16], 0, 1, { c: C.doorD });
        }
      // Jardinière fleurie.
      W.put(T.boxB(w + 0.2, 0.18, 0.22), [x, y - h / 2 - 0.2, dz + 0.2], 0, 1, { c: C.woodD });
      for (let i = 0; i < 5; i++) W.put(T.blob(40 + i, 0, 0.3), [x - w / 2 + (i + 0.5) * (w / 5), y - h / 2 - 0.02, dz + 0.24], 0, [0.13, 0.11, 0.1], { c: i % 2 ? "#ff5a6a" : "#ffffff", rim: 0.5 });
    };
    windowAt(-2.6, FL + 1.55, 0.8, 0.95, true);
    windowAt(1.45, FL + 1.75, 0.55, 0.65, false);
    // Hortensias bleus et roses au pied de la façade (très bretons).
    const hydrangea = (x, z, s, c) => {
      W.put(T.blob(70 + Math.round(x * 10), 1, 0.14, 1.7, -0.3), [x, FL + 0.3 * s, z], 0, [0.6 * s, 0.42 * s, 0.48 * s], { c: "#2f6a28", rim: 0.8, vj: 0.1, dark: 0.3 });
      const heads = [[0, 0.62, 0.05, 0.27]];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + x;
        heads.push([Math.cos(a) * 0.36, 0.44 + (i % 2) * 0.1, Math.sin(a) * 0.27, 0.23]);
      }
      for (const [hx, hy, hz, r] of heads) W.put(T.blob(80 + Math.floor(rnd() * 5), 1, 0.2, 3), [x + hx * s, FL + hy * s, z + hz * s], 0, r * s, { c: P.vary(c, rnd, 0.25), rim: 0.8, vj: 0.18, vs: 6, emit: 0.1 });
    };
    hydrangea(-3.7, -2.12, 1, C.flowerB);
    hydrangea(-1.95, -2.15, 0.8, C.flowerP);
    hydrangea(2.25, -2.15, 0.75, C.flowerB);
    // Vieille meule dressée contre le pignon gauche, sacs de farine au coin.
    W.put(T.cyl(0.7, 0.7, 0.22, 20), [bx0 - 0.22, FL + 0.66, bcz + 1.1], [0, 0, Math.PI / 2 - 0.22], 1, { c: "#cbc2b0", vj: 0.1, vs: 4, rim: 0.3 });
    W.put(T.cyl(0.16, 0.16, 0.24, 10), [bx0 - 0.22, FL + 0.66, bcz + 1.1], [0, 0, Math.PI / 2 - 0.22], 1, { c: "#5a5248" });
    for (const [x, z, r] of [
      [bx0 - 0.35, bcz - 1.2, 0.3],
      [bx0 - 0.4, bcz - 0.55, -0.2],
    ]) {
      W.put(T.blob(90 + Math.round(z * 3), 1, 0.08), [x, FL + 0.32, z], [0, r, 0], [0.28, 0.34, 0.25], { c: "#d9c49a", rim: 0.5, vj: 0.05 });
      W.put(T.cylB(0.06, 0.1, 0.12, 6), [x, FL + 0.62, z], 0, 1, { c: "#b09a70" });
    }

    /* --- fosse de la roue (murs de granit), roue à aubes (rôle 3 : tourne dans le shader) */
    const pz0 = -3.62,
      pz1 = -2.16;
    S.put(T.boxB(2.85, 2.65, 0.3), [3.925, -0.45, pz0 + 0.15], 0, 1, { c: C.granite, box: 1.5, ao: [0.55, -0.45, 1.4] });
    S.put(T.boxB(0.3, FL + 0.5, pz1 - pz0), [bx1 - 0.05, -0.45, (pz0 + pz1) / 2], 0, 1, { c: C.graniteD, box: 1.4 });
    S.put(T.boxB(0.3, FL + 0.5, pz1 - pz0), [5.25, -0.45, (pz0 + pz1) / 2], 0, 1, { c: C.graniteD, box: 1.4 });
    W.put(T.boxB(0.12, 0.55, 0.8), [5.12, -0.4, WH.z + 0.25], 0, 1, { c: "#0f1418" });
    W.put(T.boxB(2.6, 0.1, pz1 - pz0), [3.925, -0.55, (pz0 + pz1) / 2], 0, 1, { c: "#20303a" });
    const wheelO = { c: C.wet, role: 3, j: 0.06 };
    for (const s of [-1, 1]) W.put(T.torus(WH.r, 0.075, 5, 28), [WH.x, WH.y, WH.z + s * (WH.w / 2)], 0, 1, Object.assign({}, wheelO, { c: C.woodD }));
    for (const s of [-1, 1]) W.put(T.torus(WH.r * 0.62, 0.05, 4, 20), [WH.x, WH.y, WH.z + s * (WH.w / 2)], 0, 1, Object.assign({}, wheelO, { c: C.woodD }));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      for (const s of [-1, 1]) W.put(T.box(0.11, WH.r * 2 - 0.1, 0.09), [WH.x, WH.y, WH.z + s * (WH.w / 2)], [0, 0, a], 1, Object.assign({}, wheelO, { c: C.wood }));
    }
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU;
      W.put(T.box(0.34, 0.07, WH.w + 0.1), [WH.x + Math.cos(a) * (WH.r - 0.12), WH.y + Math.sin(a) * (WH.r - 0.12), WH.z], [0, 0, a + 0.35], 1, Object.assign({}, wheelO, { c: i % 2 ? C.woodW : C.wood }));
    }
    W.put(T.cyl(0.2, 0.2, WH.w + 0.3, 10), [WH.x, WH.y, WH.z], [Math.PI / 2, 0, 0], 1, Object.assign({}, wheelO, { c: C.iron }));
    W.put(T.cyl(0.08, 0.08, 1.1, 6), [WH.x, WH.y, WH.z - 0.5], [Math.PI / 2, 0, 0], 1, { c: C.iron });

    /* --- coursier (auge en bois sur tréteaux) depuis la levée du bief, à l'arrière */
    const fx0 = WH.x + 0.82,
      fyE = WH.y + WH.r + 0.4,
      fzE = WH.z - 0.15,
      fz0 = -8.55,
      fy0 = fyE + 0.18;
    const fl = Math.abs(fz0 - fzE),
      fs = Math.atan2(fy0 - fyE, fl);
    const fcz = (fz0 + fzE) / 2,
      fcy = (fy0 + fyE) / 2;
    W.put(T.box(0.7, 0.08, fl), [fx0, fcy - 0.2, fcz], [fs, 0, 0], 1, { c: C.woodD });
    for (const s of [-1, 1]) W.put(T.box(0.07, 0.38, fl), [fx0 + s * 0.33, fcy, fcz], [fs, 0, 0], 1, { c: C.wood, j: 0.05 });
    for (let i = 0; i < 4; i++) {
      const z = fzE - 0.8 - i * 1.35;
      const yTop = lerp(fyE, fy0, (fzE - z) / fl) - 0.25;
      for (const s of [-1, 1]) W.put(T.boxB(0.12, yTop - FL, 0.12), [fx0 + s * 0.32, FL, z], [0, 0, s * 0.06], 1, { c: C.woodD });
      W.put(T.box(0.8, 0.1, 0.12), [fx0, yTop - 0.05, z], 0, 1, { c: C.woodD });
    }
    // Levée du bief : talus d'herbe, mur de soutènement, vanne.
    W.put(T.blob(301, 1, 0.1), [4.3, fy0 - 1.25, -8.3], 0, [1.6, 1.4, 1.15], { c: C.grass, g: [C.earth, C.grass, FL, fy0], rim: 0.35, vj: 0.12 });
    S.put(T.boxB(2.3, fy0 - FL - 0.1, 0.5), [4.35, FL, -7.4], 0, 1, { c: C.granite, box: 1.4, ao: [0.65, FL, fy0] });
    W.put(T.boxB(0.78, 0.9, 0.1), [fx0, fy0 - 0.45, -7.12], 0, 1, { c: C.woodD });
    W.put(T.box(0.08, 1.3, 0.08), [fx0 - 0.36, fy0 + 0.2, -7.08], 0, 1, { c: C.wood });
    W.put(T.box(0.08, 1.3, 0.08), [fx0 + 0.36, fy0 + 0.2, -7.08], 0, 1, { c: C.wood });
    W.put(T.box(0.9, 0.1, 0.1), [fx0, fy0 + 0.8, -7.08], 0, 1, { c: C.woodD });
    W.put(T.cyl(0.04, 0.04, 0.9, 5), [fx0, fy0 + 0.45, -7.02], 0, 1, { c: C.iron });
    // Touffes et roseaux sur la levée.
    for (let i = 0; i < 7; i++) {
      const a = i * 1.9,
        r = 0.6 + (i % 3) * 0.3;
      for (let k = 0; k < 5; k++)
        W.put(T.blade(0.12 * (k % 2 ? 1 : -1), 0.05), [4.3 + Math.cos(a) * r, fy0 - 0.05, -8.4 + Math.sin(a) * r * 0.6], [0, k * 1.3 + i, (k - 2) * 0.12], [1, 0.55 + (k % 3) * 0.15, 1], {
          c: k % 2 ? "#7fb850" : "#5f9a3a",
        });
    }

    /* --- lanterne (support de fer) et cloche d'alarme (rôle 4 : se balance) */
    const lan = { x: 0.75, y: FL + 1.95, z: bz1 + 0.42 };
    W.put(T.box(0.05, 0.05, 0.5), [lan.x, lan.y + 0.62, bz1 + 0.2], 0, 1, { c: C.iron });
    W.put(T.box(0.05, 0.4, 0.05), [lan.x, lan.y + 0.42, bz1 + 0.02], [0.6, 0, 0], 1, { c: C.iron });
    W.put(T.boxB(0.3, 0.04, 0.3), [lan.x, lan.y - 0.02, lan.z], 0, 1, { c: C.iron });
    W.put(T.cone(0.24, 0.2, 4), [lan.x, lan.y + 0.4, lan.z], [0, Math.PI / 4, 0], 1, { c: C.iron });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) W.put(T.boxB(0.03, 0.4, 0.03), [lan.x + sx * 0.12, lan.y, lan.z + sz * 0.12], 0, 1, { c: C.iron });
    W.put(T.boxB(0.2, 0.34, 0.2), [lan.x, lan.y + 0.02, lan.z], 0, 1, { c: C.lantern, emit: 1.1 });
    const bell = { x: -1.5, y: FL + 2.35, z: bz1 + 0.62 };
    // Potence de chêne, petit auvent de planches, et la cloche de bronze.
    W.put(T.box(0.13, 0.13, 0.85), [bell.x, bell.y + 0.2, bz1 + 0.38], 0, 1, { c: C.woodD });
    W.put(T.box(0.1, 0.62, 0.1), [bell.x, bell.y - 0.1, bz1 + 0.12], [-0.75, 0, 0], 1, { c: C.woodD });
    for (const s of [-1, 1]) W.put(T.box(0.5, 0.05, 0.62), [bell.x + s * 0.2, bell.y + 0.44, bell.z - 0.12], [0, 0, -s * 0.55], 1, { c: C.wood, j: 0.08 });
    W.put(
      T.lathe("bell", [
        [0.001, 0.02],
        [0.1, 0.0],
        [0.14, -0.12],
        [0.17, -0.3],
        [0.24, -0.4],
        [0.25, -0.44],
        [0.001, -0.42],
      ], 12),
      [bell.x, bell.y + 0.06, bell.z],
      0,
      1.35,
      { c: C.bronze, role: 4, emit: 0.15, rim: 0.4 },
    );
    W.put(T.sphere(0.08, 6, 4), [bell.x, bell.y - 0.52, bell.z], 0, 1, { c: C.iron, role: 4 });
    W.put(T.cylB(0.014, 0.014, 1.5, 4), [bell.x + 0.06, bell.y - 1.95, bell.z + 0.06], 0, 1, { c: "#d8c79a", role: 4 });

    /* --- maillages */
    const wheelU = new THREE.Vector4(WH.x, WH.y, WH.z, 0);
    const bellU = new THREE.Vector4(bell.x, bell.y + 0.06, bell.z, 0);
    const mainMat = P.paint({ rig: { wheel: wheelU, bell: bellU }, lift: 0.14, rim: [0.05, 0.42, 0.55], name: "moulin" });
    const meshes = [P.mesh(S, P.stoneMat(), { cast: true, name: "granit" }), P.mesh(A.slate, P.slateMat(), { cast: true, name: "ardoises" }), P.mesh(W, mainMat, { cast: true, name: "moulin" })];
    for (const m of meshes) body.add(m);

    /* --- eau : bief, coursier, chute sur la roue, fosse et canal de fuite */
    const water = P.waterMesh([
      P.waterStrip(
        [
          [fx0, fy0 - 0.02, fz0 + 0.2],
          [fx0, fyE + 0.12, fzE + 0.05],
        ],
        0.56,
        [1, 0, 0],
        "#3f9fc0",
        0.9,
        1.4,
      ),
      P.waterStrip(
        [
          [fx0, fyE + 0.12, fzE + 0.05],
          [fx0 - 0.02, fyE - 0.05, fzE + 0.28],
          [fx0 - 0.08, WH.y + 1.05, WH.z + 0.1],
          [fx0 - 0.02, WH.y + 0.1, WH.z + 0.12],
          [fx0 + 0.05, -0.2, WH.z + 0.1],
        ],
        0.5,
        [1, 0, 0],
        "#8fd8f0",
        (t) => 0.85 - t * 0.2,
        2.4,
      ),
      P.waterStrip(
        [
          [2.55, -0.28, (pz0 + pz1) / 2 + 0.1],
          [5.12, -0.28, (pz0 + pz1) / 2 + 0.1],
        ],
        1.25,
        [0, 0, 1],
        "#2f86a8",
        0.92,
        0.7,
      ),
      P.waterStrip(
        [
          [3.4, fy0 - 0.05, -8.8],
          [5.3, fy0 - 0.05, -8.8],
        ],
        1.2,
        [0, 0, 1],
        "#3f9fc0",
        0.85,
        0.25,
      ),
    ]);
    body.add(water);

    /* --- lueurs et particules (un seul lot) */
    const specs = [];
    // Groupe 0 : lanterne (chaude) ; 1 : lanterne rouge + ondes de la cloche (alarme) ; 2 : fumée ; 3 : éclaboussures.
    specs.push({ mode: "glow", p: [lan.x, lan.y + 0.2, lan.z + 0.05], size: 0.75, cell: "glow", color: "#ffb84a", a: 0.9, add: 1, flick: 0.18, group: 0 });
    specs.push({ mode: "glow", p: [lan.x, lan.y + 0.2, lan.z + 0.05], size: 1.35, cell: "glow", color: "#ff8a2a", a: 0.35, add: 1, flick: 0.1, group: 0 });
    specs.push({ mode: "glow", p: [lan.x, lan.y + 0.2, lan.z + 0.05], size: 1.3, cell: "glow", color: "#ff2a1a", a: 1, add: 1, flick: 0.5, group: 1 });
    specs.push({ mode: "glow", p: [lan.x, lan.y + 0.2, lan.z + 0.05], size: 2.6, cell: "glow", color: "#ff3a10", a: 0.5, add: 0.8, flick: 0.3, group: 1 });
    for (let i = 0; i < 3; i++) specs.push({ mode: "ring", p: [bell.x, bell.y - 0.25, bell.z + 0.15], size: 0.35, end: 1.6, cell: "ding", color: "#fff4b0", a: 1, add: 0.55, speed: 1.6, phase: i / 3, group: 1 });
    for (let i = 0; i < 6; i++)
      specs.push({ mode: "smoke", p: [bx0 + 0.45, EAVE + RISE + 1.15, bcz - 0.1], size: 0.35, end: 1.15, rise: 2.8, drift: [0.8, -0.3], cell: "puff", color: "#f2f0ec", a: 0.8, add: 0, speed: 0.16, phase: i / 6, group: 2 });
    for (let i = 0; i < 10; i++) {
      const a = rnd() * TAU;
      specs.push({ mode: "drop", p: [fx0 - 0.05, WH.y + 0.9, WH.z + 0.15], size: 0.07, cell: "drop", color: "#e8fbff", a: 0.95, add: 0.4, speed: 1.4 + rnd(), phase: rnd(), vel: [Math.cos(a) * 0.9 + 0.3, 1.2 + rnd() * 0.8, Math.sin(a) * 0.5], grav: 7, group: 3 });
    }
    for (let i = 0; i < 5; i++)
      specs.push({ mode: "smoke", p: [fx0 - 0.1 + (rnd() - 0.5) * 0.5, -0.25, WH.z + 0.2 + (rnd() - 0.5) * 0.4], size: 0.18, end: 0.5, rise: 0.25, drift: [0.4, 0], cell: "puff", color: "#ffffff", a: 0.8, add: 0.2, speed: 0.9, phase: i / 5, group: 3 });
    for (let i = 0; i < 6; i++)
      specs.push({ mode: "slide", p: [4.0 + (rnd() - 0.5) * 0.6, -0.22, WH.z + 0.15 + (rnd() - 0.5) * 0.6], size: 0.16, len: 1.8, dir: [1, 0], rot: -Math.PI / 2, cell: "leaf", color: "#ffffff", a: 0.55, add: 0.3, speed: 0.6, phase: i / 6, group: 3 });
    const fx = P.fx(specs, { name: "lueurs du moulin" });
    body.add(fx.mesh);

    const st = { t: 0, alarm: false, a: 0, bellA: 0, bellV: 0, wheel: 0 };
    return {
      object: root,
      alarm(on) {
        st.alarm = !!on;
      },
      update(dt, time) {
        if (dt > 0.1) dt = 0.1;
        if (dt < 0) dt = 0;
        P.tick(time);
        st.t += dt;
        st.a = damp(st.a, st.alarm ? 1 : 0, 6, dt);
        // Roue : tourne lentement (le bord droit descend sous la chute).
        st.wheel -= dt * 0.75;
        wheelU.w = st.wheel % TAU;
        // Cloche : balancement vif pendant l'alarme, ressort qui s'amortit ensuite.
        const target = st.alarm ? Math.sin(st.t * 9.5) * 0.75 : 0;
        st.bellV += ((target - st.bellA) * 60 - st.bellV * 6) * dt;
        st.bellA += st.bellV * dt;
        bellU.w = st.bellA;
        const blink = 0.5 + 0.5 * Math.sin(st.t * 10);
        fx.gain.set(1 - st.a * 0.85, st.a * (0.55 + 0.45 * blink), 1, 1);
      },
      dispose() {
        if (root.parent) root.parent.remove(root);
        for (const m of meshes) m.geometry.dispose();
        water.geometry.dispose();
        mainMat.dispose();
        fx.material.dispose();
        fx.mesh.geometry.dispose();
      },
    };
  };

  /* ================================================================== butte */
  // Case surélevée (+1,3 m) au milieu d'une route, qui doit se repérer d'un coup d'œil : socle de
  // granit sombre appareillé en gros blocs aux flancs nets, couronnement de pierre claire, dessus
  // d'herbe bordé de dalles ; sur la face avant, trois bannières aux couleurs des familles de tours
  // (brun-vert, bleu, rouge : « toutes les tours »), et un fanion tricolore au coin avant gauche
  // (une tour posée au milieu ne cache ni l'un ni l'autre).
  const HG = { top: 1.3, half: 1.68 };
  const HC = {
    core: "#24221f",
    blocks: ["#5a554f", "#655f58", "#4f4b46", "#615b54"],
    blockTop: "#7d776d",
    coping: "#c9c2b2",
    copingD: "#a9a293",
    slab: ["#bdb6a6", "#c8c1b1", "#b1aa9a"],
    grass: "#86cc48",
    grassD: "#5aa632",
    pole: "#4a3626",
    flag: ["#7a8a26", "#2f7cff", "#ff3a1e"],
    gold: "#ffcf4a",
  };
  /** Flamme triangulaire à trois bandes horizontales, deux faces ; le balancement croît vers la pointe. */
  function pennantTpl(len, fh, cols) {
    return P.tc(`pennant${len},${fh},${cols.join()}`, () => {
      const N = 6;
      const pos = [],
        idx = [],
        bandOf = [],
        uOf = [];
      for (let b = 0; b < 3; b++) {
        const base = pos.length / 3;
        for (let i = 0; i <= N; i++) {
          const u = i / N;
          const hh = (fh / 2) * (1 - 0.9 * u);
          pos.push(0.04 + u * len, hh * (1 - (2 * b) / 3), 0, 0.04 + u * len, hh * (1 - (2 * (b + 1)) / 3), 0);
          bandOf.push(b, b);
          uOf.push(u, u);
          if (i > 0) {
            const a = base + (i - 1) * 2;
            idx.push(a, a + 1, a + 3, a, a + 3, a + 2);
          }
        }
      }
      const n = pos.length / 3;
      const t = P.twoSided(new Float32Array(pos), idx);
      t.col = new Float32Array(t.n * 3);
      t.inf = new Float32Array(t.n * 4);
      for (let i = 0; i < t.n; i++) {
        const k = i % n;
        const c = col(cols[bandOf[k]]);
        t.col[i * 3] = c.r;
        t.col[i * 3 + 1] = c.g;
        t.col[i * 3 + 2] = c.b;
        t.inf[i * 4] = 0.1 + uOf[k];
        t.inf[i * 4 + 1] = 0.22;
        t.inf[i * 4 + 2] = 1;
        t.inf[i * 4 + 3] = 0.15;
      }
      return t;
    });
  }
  PTMT.models.highGround = function (opts) {
    opts = opts || {};
    const seed = opts.seed | 0;
    const root = new THREE.Group();
    root.name = "ptmt-butte";
    const rnd = P.rng(1300 + seed * 17);
    const A = new P.Acc({ seed: 61 + seed });
    const H = HG.top,
      h = HG.half;
    const COP = 0.16; // couronnement de pierre claire sous le dessus
    // Noyau sombre (visible dans les joints entre les blocs).
    A.put(T.boxB(h * 2 - 0.12, H - 0.08, h * 2 - 0.12), [0, 0, 0], 0, 1, { c: HC.core });
    // Parements : deux assises de gros blocs sur chaque face, joints sombres, arêtes un peu irrégulières.
    const courses = [
      [0, 0.58],
      [0.58, H - COP - 0.02],
    ];
    for (let f = 0; f < 4; f++) {
      const M = new THREE.Matrix4().makeRotationY((f * Math.PI) / 2);
      courses.forEach(([y0, y1], ci) => {
        let x = -h,
          k = 0;
        while (x < h - 0.05) {
          const w = Math.min(h - x, 0.9 + rnd() * 0.5 + (ci ? 0.2 : 0));
          const ww = h - x - w < 0.45 ? h - x : w;
          const c = HC.blocks[(k + ci * 2 + f) % 4];
          A.put(T.boxB(ww - 0.07, y1 - y0 - 0.06, 0.34), [x + ww / 2, y0 + 0.03, h - 0.15 + rnd() * 0.04], [0, (rnd() - 0.5) * 0.03, (rnd() - 0.5) * 0.02], 1, {
            g: [c, HC.blockTop, y0 - 0.2, y1 + 0.35],
            vj: 0.12,
            vs: 3,
            rim: 0.4,
            ao: [0.7, 0, 0.45],
          }, M);
          x += ww;
          k++;
        }
      });
      // Couronnement clair : une ligne nette qui dessine le bord de la case vue d'en haut.
      A.put(T.boxB(h * 2 + 0.08, COP, 0.3), [0, H - COP, h - 0.11], 0, 1, { g: [HC.copingD, HC.coping, H - COP, H], vj: 0.06, vs: 4, rim: 0.3 }, M);
    }
    // Dessus : dalles claires en bordure, herbe au milieu (la place de la tour).
    A.put(T.boxB(h * 2 - 0.1, 0.05, h * 2 - 0.1), [0, H - 0.04, 0], 0, 1, { c: HC.grassD });
    for (let f = 0; f < 4; f++) {
      const M = new THREE.Matrix4().makeRotationY((f * Math.PI) / 2);
      let x = -h + 0.06,
        k = 0;
      while (x < h - 0.2) {
        const w = Math.min(h - 0.06 - x, 0.5 + rnd() * 0.25);
        A.put(T.boxB(w - 0.05, 0.05, 0.36), [x + w / 2, H - 0.02, h - 0.3], [0, (rnd() - 0.5) * 0.05, 0], 1, { c: HC.slab[k % 3], vj: 0.08, vs: 4, rim: 0.2 }, M);
        x += w;
        k++;
      }
    }
    A.put(T.boxSeg(h * 2 - 1.0, 0.05, h * 2 - 1.0, 4, 1, 4), [0, H - 0.02, 0], 0, 1, { g: [HC.grassD, HC.grass, H - 0.02, H + 0.03], vj: 0.14, vs: 1.6 });
    // Touffes et fleurs dans les coins (le milieu reste libre pour la tour).
    for (let i = 0; i < 8; i++) {
      const sx = i % 2 ? 1 : -1,
        sz = i % 4 < 2 ? 1 : -1;
      const x = sx * (h - 0.62 - rnd() * 0.2),
        z = sz * (h - 0.62 - rnd() * 0.2);
      for (let k = 0; k < 4; k++)
        A.put(T.blade(0.1 * (rnd() - 0.5), 0.06, 2), [x + (rnd() - 0.5) * 0.18, H, z + (rnd() - 0.5) * 0.18], [0, rnd() * TAU, (rnd() - 0.5) * 0.7], [1, 0.28 + rnd() * 0.2, 1], {
          g: ["#3f7a26", "#a4d456", H, H + 0.45],
          sway: 1,
          pivot: [x, H, z],
        });
      if (i < 4) A.put(T.flower(5, 0.075, 0.02, ["#ffffff", "#ffd21a", "#ff5aa8", "#ffffff"][i], "#ffd21a"), [x, H + 0.2, z], [0, rnd() * TAU, 0], 1, { emit: 0.2, sway: 1, pivot: [x, H, z] });
    }
    // Trois bannières pendues au couronnement de la face avant (pointe en queue d'aronde).
    const BW = 0.62,
      BH = 0.92;
    for (let b = 0; b < 3; b++) {
      const bx = (b - 1) * 0.95;
      const zf = h + 0.06;
      A.put(T.box(BW + 0.16, 0.06, 0.06), [bx, H - 0.02, zf + 0.02], 0, 1, { c: HC.gold, emit: 0.25, rim: 0.3 });
      A.put(T.boxB(BW, BH - 0.18, 0.035), [bx, H - BH + 0.16, zf], 0, 1, { c: HC.flag[b], emit: 0.16, rim: 0.2, vj: 0.06 });
      for (const s of [-1, 1])
        A.put(
          T.extrude("bannerTail", [
            [0, 0],
            [BW / 2, 0],
            [BW / 2, -0.2],
          ], 0.035),
          [bx, H - BH + 0.16, zf],
          [0, s < 0 ? Math.PI : 0, 0],
          [1, 1, 1],
          { c: HC.flag[b], emit: 0.16, rim: 0.2 },
        );
      // Liseré clair et petit écusson (étoile) au milieu.
      A.put(T.box(BW - 0.12, 0.04, 0.04), [bx, H - 0.24, zf + 0.02], 0, 1, { c: "#f6efd8", emit: 0.2 });
      A.put(T.octa(0.1), [bx, H - 0.52, zf + 0.04], [0, 0, Math.PI / 4], [1, 1, 0.4], { c: "#f6efd8", emit: 0.25 });
    }
    // Fanion tricolore sur sa hampe au coin avant gauche, tourné vers la caméra (flotte vers l'extérieur).
    const fxp = -h + 0.3,
      fzp = h - 0.3,
      poleH = 2.5;
    A.put(T.cylB(0.11, 0.13, 0.1, 8), [fxp, H, fzp], 0, 1, { c: "#4a4642" });
    A.put(T.cylB(0.05, 0.065, poleH, 6), [fxp, H, fzp], 0, 1, { c: HC.pole, rim: 0.4 });
    A.put(T.sphere(0.11, 8, 6), [fxp, H + poleH + 0.05, fzp], 0, 1, { c: HC.gold, emit: 0.4 });
    // Flamme tricolore, inclinée vers le ciel (elle se présente à la caméra du jeu), qui flotte vers l'extérieur.
    const FLn = 1.5,
      FH = 0.95,
      TILT_F = 0.7;
    const FM = new THREE.Matrix4()
      .makeRotationY(Math.PI)
      .premultiply(new THREE.Matrix4().makeRotationX(-TILT_F))
      .setPosition(fxp, H + poleH - 0.05 - (FH / 2) * Math.cos(TILT_F), fzp + (FH / 2) * Math.sin(TILT_F));
    A.put(pennantTpl(FLn, FH, HC.flag), [0, 0, 0], 0, 1, { sway: 4, pivot: [fxp, H, fzp] }, FM);
    // Cailloux au pied (sur la route).
    for (let i = 0; i < 6; i++) {
      const a = rnd() * TAU;
      const r = h + 0.12 + rnd() * 0.18;
      const x = clamp(Math.cos(a) * r * 1.2, -h - 0.25, h + 0.25),
        z = clamp(Math.sin(a) * r * 1.2, -h - 0.25, h + 0.25);
      A.put(T.rock(700 + i, 0, 0.3), [x, 0.02, z], [0, rnd() * TAU, 0], [0.17 + rnd() * 0.1, 0.12, 0.15 + rnd() * 0.08], { c: "#8a847a", rim: 0.7, dark: 0.3 });
    }
    const mat = P.shared("butte", () => P.paint({ sway: true, lift: 0.12, rim: [0.05, 0.45, 0.55], name: "butte" }));
    const mesh = P.mesh(A, mat, { cast: true, name: "butte", pad: 1.5 });
    root.add(mesh);
    return {
      object: root,
      height: H,
      update(dt, time) {
        P.tick(time);
      },
      dispose() {
        if (root.parent) root.parent.remove(root);
        mesh.geometry.dispose();
      },
    };
  };

  /* ================================================================== barrière */
  // Entrée fermée : barrière de bois (poteaux, lisses, croix de Saint-André, lisse haute peinte en
  // rouge et blanc), haie d'ajoncs en fleur côté extérieur, panneau « Route barrée » devant.
  // open() : la barrière tremble, les planches volent et retombent en vrac sur les bords, la haie
  // s'écarte de part et d'autre, le panneau bascule ; il reste des débris sur les côtés du chemin.
  let barrierTex = null;
  const BAR_WHITE = [0.5, 0.08];
  function barrierTexture() {
    if (barrierTex) return barrierTex;
    const W = 512,
      Hh = 256;
    const cv = document.createElement("canvas");
    cv.width = W;
    cv.height = Hh;
    const g = cv.getContext("2d");
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, W, Hh);
    // Panneau (haut de la planche : 512 × 200) : fond blanc, large bord rouge, texte noir.
    g.fillStyle = "#d8231a";
    g.fillRect(0, 0, W, 200);
    g.fillStyle = "#fbfaf4";
    g.fillRect(20, 20, W - 40, 160);
    g.fillStyle = "#16130f";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = '800 66px system-ui, "Segoe UI", sans-serif';
    g.fillText("ROUTE", W / 2, 66);
    g.fillText("BARRÉE", W / 2, 136);
    barrierTex = new THREE.CanvasTexture(cv);
    barrierTex.encoding = THREE.sRGBEncoding;
    barrierTex.anisotropy = 4;
    barrierTex.name = "ptmt:props-barrier";
    return barrierTex;
  }
  const _q = new THREE.Quaternion(),
    _e = new THREE.Euler();
  PTMT.models.barrier = function (o) {
    const opts = typeof o === "object" && o ? o : { width: o };
    const nw = clamp(Math.round(opts.width || 1), 1, 3);
    const Wd = nw * P.TILE;
    const half = Wd / 2 - 0.1;
    const root = new THREE.Group();
    root.name = "ptmt-barrier-" + nw;
    const rnd = P.rng(5100 + nw * 31 + (opts.seed | 0) * 7);
    const A = new P.Acc({ uv: true, seed: 71 + nw });
    const R = P.pieces(A);
    const WO = (c, more) => Object.assign({ c, uvs: [0, 0], uo: BAR_WHITE[0], vo: BAR_WHITE[1] }, more || {});
    const pieces = []; // { k, kind, from: [x, y, z], to, rot0, rot1, delay, dur, arc, side }
    const zB = 0.35; // ligne de la barrière
    const zH = -0.85; // haie (côté extérieur)
    // Point de chute au bord du chemin (côté de la pièce), un peu en avant ou en arrière.
    const landing = (x0) => {
      const side = x0 < 0 || (x0 === 0 && rnd() < 0.5) ? -1 : 1;
      return [side * (Wd / 2 + 0.25 + rnd() * 0.85), 0, (rnd() - 0.45) * 1.8];
    };
    // Tours entiers ajoutés à la rotation finale : la pièce vrille en vol et retombe à plat.
    const turn = () => TAU * (rnd() < 0.5 ? -1 : 1) * (1 + Math.floor(rnd() * 2));

    /* --- poteaux et planches */
    const nPost = Math.max(2, Math.ceil(Wd / 1.8) + 1);
    const posts = [];
    for (let i = 0; i < nPost; i++) posts.push(-half + (i * (2 * half)) / (nPost - 1));
    posts.forEach((x, i) => {
      const edge = i === 0 || i === nPost - 1;
      R.begin([x, edge ? 0 : 0.6, zB]);
      A.put(T.boxB(0.16, 1.25, 0.16), [x, -0.05, zB], [0, (rnd() - 0.5) * 0.2, (rnd() - 0.5) * 0.06], 1, WO("#5e4632", { vj: 0.1, rim: 0.3 }));
      A.put(T.cone(0.12, 0.14, 4), [x, 1.2, zB], [0, Math.PI / 4, 0], 1, WO("#4a3626"));
      const k = R.end();
      // Les poteaux des bords restent debout, un peu penchés ; ceux du milieu volent vers les bords
      // et retombent couchés (pivot au milieu du poteau).
      if (edge) pieces.push({ k, kind: "lean", from: [x, 0, zB], side: x < 0 ? -1 : 1, delay: 0.18 + rnd() * 0.1, dur: 0.7 });
      else
        pieces.push({
          k,
          kind: "fly",
          from: [x, 0.6, zB],
          to: landing(x),
          y1: 0.09,
          side: x < 0 ? -1 : 1,
          delay: 0.2 + rnd() * 0.15,
          dur: 0.8 + rnd() * 0.3,
          arc: 1.2 + rnd() * 1.0,
          rot: [turn(), (rnd() - 0.5) * 1.6, Math.PI / 2 + (rnd() < 0.5 ? turn() : 0)],
        });
    });
    for (let i = 0; i < nPost - 1; i++) {
      const x0 = posts[i],
        x1 = posts[i + 1];
      const L = x1 - x0 + 0.2,
        cx = (x0 + x1) / 2;
      const plank = (y, ang, color, stripes) => {
        R.begin([cx, y, zB + 0.1]);
        if (stripes) {
          const n = 5;
          for (let s = 0; s < n; s++) A.put(T.box(L / n + 0.002, 0.2, 0.06), [cx - L / 2 + (s + 0.5) * (L / n), y, zB + 0.12], [0, 0, 0], 1, WO(s % 2 ? "#f6f2ea" : "#d8231a", { emit: 0.08 }));
        } else A.put(T.box(L, 0.17, 0.05), [cx, y, zB + 0.1], [0, 0, ang], 1, WO(color, { vj: 0.12, vs: 3, rim: 0.25 }));
        const k = R.end();
        // Rotation finale (repère « YXZ ») : on défait l'inclinaison, on couche la planche à plat, on
        // la tourne au hasard ; des tours entiers en plus pour la vrille en vol.
        pieces.push({
          k,
          kind: "fly",
          from: [cx, y, zB + 0.1],
          to: landing(cx),
          side: cx < 0 ? -1 : 1,
          delay: 0.25 + rnd() * 0.25,
          dur: 0.85 + rnd() * 0.35,
          arc: 1.8 + rnd() * 1.6,
          rot: [Math.PI / 2 + turn(), (rnd() - 0.5) * 1.6 + turn() * 0.5 * (rnd() < 0.5 ? 0 : 1), -ang + (rnd() < 0.5 ? turn() : 0)],
        });
      };
      plank(1.02, 0, null, true);
      plank(0.42, 0, "#a8835a");
      // Croix de Saint-André (deux planches en diagonale).
      const diag = Math.atan2(0.5, L - 0.2);
      plank(0.72, diag, "#9a7652");
      plank(0.72, -diag, "#8a6a48");
    }
    /* --- haie d'ajoncs (côté extérieur) */
    const nBush = Math.max(3, Math.round(Wd / 0.85));
    for (let i = 0; i < nBush; i++) {
      const x = -half + 0.2 + ((i + 0.5) / nBush) * (2 * half - 0.4) + (rnd() - 0.5) * 0.2;
      const z = zH + (rnd() - 0.5) * 0.3;
      const r = 0.48 + rnd() * 0.2;
      R.begin([x, 0, z]);
      A.put(T.blob(300 + (i % 5), 1, 0.3, 3.4, -0.5), [x, r * 0.7, z], [0, rnd() * TAU, 0], [r, r * 0.9, r], WO("#2f6a22", { g: ["#173e16", "#3f7a28", 0, 1.0], vj: 0.1, dark: 0.3, sway: 0.4, rim: 1, pivot: [x, 0, z] }));
      for (let k = 0; k < 9; k++) {
        const u = rnd() * TAU,
          e = rnd() * 1.2;
        A.put(T.tet(0.08), [x + Math.cos(u) * Math.cos(e) * r, r * 0.7 + Math.sin(e) * r * 0.85, z + Math.sin(u) * Math.cos(e) * r], [rnd() * 3, rnd() * 3, 0], 1, WO(k % 3 ? "#ffcc12" : "#ffe45a", { emit: 0.35, sway: 0.4, pivot: [x, 0, z] }));
      }
      const k = R.end();
      const side = x < 0 ? -1 : 1;
      const tx = side * (Wd / 2 + 0.35 + rnd() * 0.45) + (x - side * half) * 0.18;
      pieces.push({ k, kind: "slide", from: [x, 0, z], to: [tx, 0, z - 0.25 - rnd() * 0.4], side, delay: 0.3 + Math.abs(x) * 0.04 + rnd() * 0.1, dur: 0.75 + rnd() * 0.2 });
    }
    /* --- panneau « Route barrée » (deux faces imprimées) */
    {
      const sx = (rnd() < 0.5 ? -1 : 1) * Math.min(0.6, Wd * 0.12),
        sz = zB + 0.55;
      R.begin([sx, 0, sz]);
      A.put(T.boxB(0.09, 1.3, 0.09), [sx, -0.05, sz], 0, 1, WO("#6a6a6e", { rim: 0.3 }));
      A.put(T.box(1.42, 0.6, 0.05), [sx, 1.35, sz], 0, 1, WO("#d8231a"));
      for (const f of [1, -1]) A.put(T.plane, [sx, 1.35, sz + f * 0.03], [0, f < 0 ? Math.PI : 0, 0], [1.38, 0.56, 1], { c: "#ffffff", uvs: [1, 200 / 256], uo: 0, vo: 1 - 200 / 256, emit: 0.06 });
      const k = R.end();
      pieces.push({ k, kind: "sign", from: [sx, 0, sz], to: [sx < 0 ? -Wd / 2 - 0.6 : Wd / 2 + 0.6, 0, sz + 0.5], side: sx < 0 ? -1 : 1, delay: 0.12, dur: 0.95 });
    }
    // Pierres au pied des poteaux d'angle, touffes (fixes).
    for (const s of [-1, 1])
      for (let i = 0; i < 3; i++)
        A.put(T.rock(760 + i, 0, 0.3), [s * (half + 0.15) + (rnd() - 0.5) * 0.4, 0.02, zB + (rnd() - 0.5) * 0.5], [0, rnd() * TAU, 0], [0.2, 0.13, 0.17], WO("#9c958a", { rim: 0.6, dark: 0.3 }));

    const mat = P.shared("barrier", () => P.paint({ map: barrierTexture(), sway: true, lift: 0.14, rim: [0.05, 0.42, 0.5], name: "barrière" }));
    const mesh = P.mesh(A, mat, { cast: true, name: "barrière", pad: Wd / 2 + 2.5 });
    R.bind(mesh);
    root.add(mesh);
    // Poussière et pétales d'ajonc pendant l'ouverture (lot caché le reste du temps).
    const specs = [];
    for (let i = 0; i < 10; i++)
      specs.push({ mode: "smoke", p: [(rnd() - 0.5) * Wd * 0.9, 0.15, (rnd() - 0.5) * 1.6], size: 0.5, end: 1.6, rise: 0.9, drift: [(rnd() - 0.5) * 0.8, 0.3], cell: "puff", color: "#d8c8a8", a: 0.85, add: 0, speed: 0.9, phase: rnd(), group: 0 });
    for (let i = 0; i < 14; i++) {
      const a = rnd() * TAU;
      specs.push({ mode: "drop", p: [(rnd() - 0.5) * Wd * 0.9, 0.9, zH + (rnd() - 0.5) * 0.6], size: 0.07, cell: "leaf", color: i % 2 ? "#ffd21a" : "#6fae3e", a: 1, add: 0.2, speed: 0.8 + rnd() * 0.5, phase: rnd(), vel: [Math.cos(a) * 1.6, 2.4 + rnd() * 1.5, Math.sin(a) * 1.2], grav: 6, group: 0 });
    }
    const fx = P.fx(specs, { name: "poussière de la barrière" });
    fx.mesh.visible = false;
    root.add(fx.mesh);

    const st = { open: false, t: -1, resolve: null, dust: 0 };
    const ease = (t) => t * t * (3 - 2 * t);
    /** Pose de toutes les pièces à l'instant t de l'ouverture (t < 0 : fermée). */
    function pose(t) {
      for (const p of pieces) {
        const u = clamp((t - p.delay) / p.dur, 0, 1);
        const shake = t >= 0 && t < 0.35 ? Math.sin(t * 70 + p.k) * 0.03 * (1 - t / 0.35) : 0;
        const [x0, y0, z0] = p.from;
        if (t < 0) {
          R.home(p.k);
          continue;
        }
        if (p.kind === "fly") {
          const [x1, , z1] = p.to;
          const e = ease(u);
          const y = lerp(y0, p.y1 || 0.04, e) + p.arc * 4 * u * (1 - u);
          // Vrille en vol, planche couchée à plat à l'arrivée.
          _e.set(p.rot[0] * e, p.rot[1] * e, p.rot[2] * e, "YXZ");
          _q.setFromEuler(_e);
          R.set(p.k, [lerp(x0, x1, e) + shake, y, lerp(z0, z1, e)], _q, 1);
        } else if (p.kind === "slide") {
          const [x1, , z1] = p.to;
          const e = ease(u);
          const squash = 1 - 0.18 * e;
          _e.set(0, 0, -p.side * 0.25 * Math.sin(Math.PI * u), "XYZ");
          _q.setFromEuler(_e);
          R.set(p.k, [lerp(x0, x1, e) + shake, 0.35 * Math.sin(Math.PI * u), lerp(z0, z1, e)], _q, [1 + 0.08 * e, squash, 1 + 0.08 * e]);
        } else if (p.kind === "sign") {
          const [x1, , z1] = p.to;
          const e = ease(u);
          _e.set(-1.45 * e, 0.4 * p.side * e, p.side * 0.25 * e, "XYZ");
          _q.setFromEuler(_e);
          R.set(p.k, [lerp(x0, x1, e), 0.1 * Math.sin(Math.PI * u), lerp(z0, z1, e)], _q, 1);
        } else {
          const e = ease(u);
          _e.set(0.18 * e, 0, -p.side * 0.32 * e, "XYZ");
          _q.setFromEuler(_e);
          R.set(p.k, [x0 + shake, 0, z0], _q, 1);
        }
      }
      R.commit();
    }
    const END = Math.max(...pieces.map((p) => p.delay + p.dur)) + 0.05;
    return {
      object: root,
      width: nw,
      get isOpen() {
        return st.open;
      },
      /** La barrière cède (≈ 1,5 s) ; la promesse se résout quand tout est retombé. */
      open() {
        if (st.open) return Promise.resolve(false);
        st.open = true;
        st.t = 0;
        return new Promise((res) => (st.resolve = res));
      },
      /** État sans animation (chargement d'une partie, remise à zéro). */
      setOpen(on) {
        st.open = !!on;
        st.t = on ? END : -1;
        pose(st.t);
        if (st.resolve) st.resolve(true);
        st.resolve = null;
        fx.mesh.visible = false;
      },
      update(dt, time) {
        if (dt > 0.1) dt = 0.1;
        if (dt < 0) dt = 0;
        P.tick(time);
        if (st.open && st.t >= 0 && st.t < END) {
          st.t = Math.min(END, st.t + dt);
          pose(st.t);
          const d = clamp(st.t / 0.25, 0, 1) * clamp((END - st.t) / 0.5, 0, 1);
          fx.mesh.visible = d > 0.01;
          fx.gain.set(d, 1, 1, 1);
          if (st.t >= END) {
            fx.mesh.visible = false;
            if (st.resolve) st.resolve(true);
            st.resolve = null;
          }
        }
      },
      dispose() {
        if (root.parent) root.parent.remove(root);
        mesh.geometry.dispose();
        fx.material.dispose();
        fx.mesh.geometry.dispose();
      },
    };
  };
})();
