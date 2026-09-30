// « Pas touche à mes trésors » — tours CYGNE (cases d'eau) : crachent des jets d'eau qui ralentissent.
//
//   1 Cygneau               : gris, ébouriffé, tout rond, gros yeux, petit bec sombre.
//   2 Cygne                 : blanc, bec orange à bouton noir, cou en S.
//   3 Cygne majestueux      : plus grand, ailes relevées en voûte.
//   A4-6 Cygne des glaces   : plumes bleu glacier et givre, cristaux sur le nid (plus nombreux à 5 et 6),
//                             souffle froid au bec.
//   A7 Cygne royal des glaces : couronne de glace, grandes ailes de cristal déployées, nid pris dans la glace.
//   B4-6 Cygne noir         : plumage noir irisé de violet, bec rouge, étincelles de mana bleu qui tournent,
//                             cristaux de mana (5+) et runes (6) sur le nid.
//   B7 Cygne noir enchanteur : plus grand, ailes déployées, anneau de runes violettes qui tourne.
//
// Socle : nid de roseaux qui flotte (l'origine de la tour est la surface de l'eau ; le nid danse
// doucement), massettes, nénuphars et rides animées (disque à part, une matière partagée). Hors de
// l'eau (butte : opts.terrain !== "water"), le nid flotte dans une petite mare cerclée de pierres.
// Attaque : le cou se replie en arrière (élan) puis se détend d'un coup, bec grand ouvert (jet d'eau).
// Voir models/10-kit.js pour la coque commune (visée, attaque, frénésie, sélection, célébration).
(function () {
  "use strict";
  const PTMT = globalThis.PTMT;
  if (!PTMT || !PTMT.models || !PTMT.models.kit || !PTMT.models.kit.defCt) return;
  const K = PTMT.models.kit,
    G = K.g,
    PAT = K.PAT,
    CLS = K.CLS;
  const { TAU, clamp, lerp, bump, easeInOut } = K.math;

  const C = {
    reed: "#cdb46a",
    reedD: "#8a7440",
    twig: "#7a5a36",
    bowl: "#5e4428",
    cattail: "#6a3e22",
    leaf: "#5e9a36",
    leafL: "#8cc04a",
    pad: "#4f9a3a",
    padL: "#79bf4a",
    lotus: "#ffb6d2",
    lotusC: "#ffe27a",
    stone: "#a8a294",
    water: "#3aa6c8",
    white: "#fbfbf6",
    shade: "#d4dbe6",
    beak: "#ff8a1a",
    beakD: "#d9620c",
    black: "#17151c",
    ice: "#bfe8ff",
    iceD: "#6fb8ee",
    iceDeep: "#3f86d6",
    frost: "#f2fbff",
    night: "#1d1a26",
    nightL: "#3a3450",
    red: "#e2302a",
    mana: "#6fb4ff",
    manaV: "#b06cff",
    rune: "#c77dff",
  };

  /* ---------------------------------------------------------------- rides (disque partagé) */
  function rippleMat() {
    return PTMT.mat("swan:ripples", () => {
      const m = new THREE.ShaderMaterial({
        uniforms: { uTime: K.toon.time, uColor: { value: PTMT.color("#e8fbff") } },
        vertexShader: /* glsl */ `
          varying vec2 vP;
          varying float vPh;
          void main() {
            vP = position.xz;
            vPh = fract(sin(dot(modelMatrix[3].xz, vec2(12.9898, 78.233))) * 43758.5453) * 6.28;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          uniform float uTime;
          uniform vec3 uColor;
          varying vec2 vP;
          varying float vPh;
          void main() {
            float r = length(vP);
            float a = atan(vP.y, vP.x);
            float wob = 0.03 * sin(a * 5.0 + uTime * 1.3 + vPh) + 0.018 * sin(a * 9.0 - uTime * 2.1);
            float x = (r + wob) * 2.6 - uTime * 0.45 - vPh;
            float ring = smoothstep(0.8, 0.9, fract(x)) * (1.0 - smoothstep(0.9, 0.98, fract(x)));
            float fade = smoothstep(1.04, 1.2, r) * (1.0 - smoothstep(1.4, 1.72, r));
            float foam = (1.0 - smoothstep(1.02, 1.12, r)) * smoothstep(0.99, 1.03, r);
            float al = ring * fade * 0.45 + foam * 0.5;
            if (al < 0.01) discard;
            gl_FragColor = vec4(uColor, al);
            #include <tonemapping_fragment>
            #include <encodings_fragment>
          }`,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      m.name = "ptmt:swan:ripples";
      return m;
    });
  }
  function ripples(root, scale) {
    const geo = PTMT.geo("swan:ripples", () => G.ring(0.98, 1.75, 40, 1).clone());
    const m = new THREE.Mesh(geo, rippleMat());
    m.position.y = 0.012;
    m.scale.setScalar(scale);
    m.renderOrder = 2;
    m.name = "rides";
    root.add(m);
    return m;
  }

  /* ---------------------------------------------------------------- nid de roseaux */
  /**
   * o = { r (rayon extérieur), h (hauteur au-dessus de l'eau), seed, cattails, pads, flag, reed, twig,
   *   crystals: { n, c, cls } (cristaux sur le bord), runes (couleur), frozen (bord gelé), pond (mare de butte) }
   * Os : float (danse sur l'eau) ; tout le nid lui est lié.
   */
  function nest(R, o) {
    const r = o.r,
      h = o.h;
    const wy = o.pond ? 0.14 : 0; // hauteur de l'eau (mare de butte)
    if (o.pond) {
      // Petite mare cerclée de pierres sur la butte.
      R.add(G.cyl(r + 0.5, r + 0.62, 0.1, 20), "root", { p: [0, 0.05, 0], c: "#5a6a4a", ol: false });
      R.add(G.cyl(r + 0.42, r + 0.42, 0.02, 24), "root", { p: [0, wy - 0.01, 0], c: C.water, cls: CLS.wet, ol: false });
      const rnd = PTMT.rng(5);
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * TAU;
        R.add(G.rock(0.2 + rnd() * 0.08, 0, 0.25, i + 3), "root", { p: [Math.sin(a) * (r + 0.55), 0.12, Math.cos(a) * (r + 0.55)], s: [1.2, 0.8, 1], c: i % 2 ? C.stone : "#8e897c", pat: PAT.stone, flat: true, ol: true });
      }
    }
    R.bone("float", "root", [0, wy, 0]);
    // Couronne de roseaux tressés (anneau épais), creux de brindilles.
    const prof = [
      [r * 0.42, -0.1],
      [r * 0.86, -0.12],
      [r, -0.02],
      [r * 1.01, h * 0.45],
      [r * 0.93, h * 0.9],
      [r * 0.78, h],
      [r * 0.6, h * 0.86],
      [r * 0.48, h * 0.55],
      [r * 0.42, h * 0.3],
    ];
    R.add(G.lathe("nest:" + r + ":" + h, prof, 18), "float", { gp: [o.reedD || C.reedD, o.reed || C.reed, -0.05, h], pat: PAT.straw, uv: [0.06, 12], ol: true });
    R.add(G.cyl(r * 0.46, r * 0.4, 0.06, 16), "float", { p: [0, h * 0.28, 0], c: o.bowl || C.bowl, pat: PAT.straw, uv: [0.2, 6], ol: false });
    // Brindilles et tiges qui dépassent.
    const rnd = PTMT.rng(o.seed || 3);
    const n = o.twigs || 10;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rnd() * 0.4;
      const L = 0.35 + rnd() * 0.3;
      R.add(G.cyl(0.018, 0.022, L, 4), "float", {
        p: [Math.sin(a) * r * 0.95, h * 0.55 + rnd() * 0.1, Math.cos(a) * r * 0.95],
        r: [Math.PI / 2 - 0.25 + rnd() * 0.3, a, 0],
        ro: "YXZ",
        c: i % 3 ? o.twig || C.twig : o.reed || C.reed,
        ol: false,
      });
    }
    // Massettes à l'arrière (tiges, épis bruns, longues feuilles).
    const nc = o.cattails === undefined ? 3 : o.cattails;
    for (let i = 0; i < nc; i++) {
      const a = Math.PI + (i - (nc - 1) / 2) * 0.42 + (rnd() - 0.5) * 0.15;
      const rr = r * (0.82 + rnd() * 0.1);
      const x = Math.sin(a) * rr,
        z = Math.cos(a) * rr;
      const hh = 0.9 + rnd() * 0.45;
      R.add(G.cyl(0.02, 0.026, hh, 4), "float", { p: [x, h * 0.4 + hh / 2, z], r: [(rnd() - 0.5) * 0.12, 0, (rnd() - 0.5) * 0.12], c: C.leaf, ol: false });
      R.add(G.capsule(0.055, 0.2, 5, 1), "float", { p: [x, h * 0.4 + hh - 0.08, z], c: C.cattail, pat: PAT.fur, ol: false });
      R.add(G.cone(0.05, hh * 0.9, 3, true), "float", { p: [x + 0.06, h * 0.4 + hh * 0.42, z], r: [0, a, 0.22], s: [1, 1, 0.3], c: C.leafL, ol: false });
    }
    // Nénuphars (et une fleur).
    const np = o.pads === undefined ? 3 : o.pads;
    for (let i = 0; i < np; i++) {
      const a = 0.6 + i * 2.2 + rnd() * 0.3;
      const rr = r + 0.28 + rnd() * 0.18;
      const pr = 0.2 + rnd() * 0.1;
      R.add(G.cyl(pr, pr, 0.025, 12), "root", { p: [Math.sin(a) * rr, wy + 0.012, Math.cos(a) * rr], r: [0, a, 0], c: i % 2 ? C.pad : C.padL, cls: CLS.satin, ol: false });
      if (i === 0) {
        for (let k = 0; k < 5; k++) R.add(G.cone(0.07, 0.16, 4), "root", { p: [Math.sin(a) * rr + Math.sin(k * 1.26) * 0.05, wy + 0.08, Math.cos(a) * rr + Math.cos(k * 1.26) * 0.05], r: [Math.sin(k * 1.26) * 0.5, 0, -Math.cos(k * 1.26) * 0.5], ro: "YXZ", c: o.flower || C.lotus, cls: CLS.satin, ol: false });
        R.add(G.sphere(0.04, 6, 4), "root", { p: [Math.sin(a) * rr, wy + 0.1, Math.cos(a) * rr], c: C.lotusC, cls: CLS.glow, ol: false });
      }
    }
    // Cristaux (glace ou mana) plantés dans le nid.
    if (o.crystals) {
      const cr = o.crystals;
      for (let i = 0; i < cr.n; i++) {
        const a = 0.4 + (i / cr.n) * TAU + rnd() * 0.3;
        const rr = r * (0.72 + rnd() * 0.16);
        const hh = (0.3 + rnd() * 0.3) * (cr.k || 1);
        R.add(G.crystal(0.08 * (cr.k || 1), hh, 5, hh * 0.35, 0.02, 0.85), "float", {
          p: [Math.sin(a) * rr, h * 0.72, Math.cos(a) * rr],
          r: [Math.cos(a) * 0.45, 0, -Math.sin(a) * 0.45],
          c: cr.c,
          cls: cr.cls,
          flat: true,
          ol: true,
        });
      }
    }
    if (o.frozen) {
      R.add(G.torus(r * 0.8, 0.09, 5, 22), "float", { p: [0, h * 0.95, 0], r: [Math.PI / 2, 0, 0], c: C.frost, cls: CLS.ice, ol: false });
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU + 0.2;
        R.add(G.cone(0.035, 0.22, 4), "float", { p: [Math.sin(a) * r * 0.99, h * 0.3, Math.cos(a) * r * 0.99], r: [Math.PI, 0, 0], c: C.ice, cls: CLS.ice, flat: true, ol: false });
      }
    }
    if (o.runes) {
      // Runes lumineuses gravées sur le bord du nid (traits en lueur additive).
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + 0.5;
        const x = Math.sin(a) * r * 0.99,
          z = Math.cos(a) * r * 0.99;
        R.glow(G.box(0.03, 0.2, 0.02), "float", { p: [x, h * 0.5, z], r: [0, a, 0.2], c: o.runes });
        R.glow(G.box(0.03, 0.12, 0.02), "float", { p: [x, h * 0.55, z], r: [0, a, -0.9], c: o.runes });
      }
    }
    if (o.flag) K.ctPennant(R, Object.assign({ bone: "float", p: [-r * 0.62, h * 0.7, -r * 0.55], dir: 2.5 }, o.flag));
    R.sway("float", "x", 0, 0.025, 1.1, 0);
    R.sway("float", "z", 0, 0.03, 0.9, 1.3);
    return { wy };
  }

  /* ---------------------------------------------------------------- cygne paramétrique */
  /**
   * P = { k, body, belly, wing, wingTip, tail, pat, cls (plumage), neckL, neckR, hr (tête), beak, beakD,
   *       knob, mask, beakTip, eyeR, iris, lid, slant, brow, fluff, wings: "fold" | "arch" | "spread",
   *       wingK, crystalWings, crown, crest }
   * Os : yaw → body (wingL/R, tail, neck1 → neck2 → head → jaw, spit).
   */
  function swan(R, P, seatY) {
    const k = P.k;
    R.bone("yaw", "float", [0, seatY, 0]);
    const rx = 0.4 * k,
      rz = 0.56 * k,
      ry = 0.3 * k;
    R.bone("body", "yaw", [0, ry * 0.9, 0]);
    const plum = P.cls === undefined ? CLS.satin : P.cls;
    R.add(G.sphere(1, 14, 8), "body", { r: [Math.PI / 2, 0, 0], s: [rx, rz, ry], gp: [P.belly, P.body, -ry * 0.8, ry * 0.3], pat: PAT.feather, uv: [9, 7], cls: plum, ol: true });
    R.add(G.sphere(ry * 0.95, 10, 6), "body", { p: [0, ry * 0.1, rz * 0.55], c: P.body, pat: PAT.feather, uv: [6, 5], cls: plum, ol: false });
    // Queue relevée (trois plumes en éventail).
    R.bone("tail", "body", [0, ry * 0.3, -rz * 0.85]);
    for (let i = -1; i <= 1; i++)
      R.add(G.cone(0.1 * k, 0.32 * k, 5), "tail", { p: [i * 0.07 * k, 0.07 * k, -0.08 * k], r: [-1.1 + Math.abs(i) * 0.15, i * 0.35, 0], ro: "YXZ", s: [1, 1, 0.45], c: P.tail || P.body, cls: plum, ol: i === 0 });
    // Ailes.
    const wk = (P.wingK || 1) * k;
    const shape = [
      [0, 0],
      [0.12, 0.2],
      [0.32, 0.34],
      [0.54, 0.4],
      [0.74, 0.38],
      [0.9, 0.28],
      [1.0, 0.14],
      [0.88, 0.1],
      [0.84, 0.02],
      [0.72, 0.05],
      [0.68, -0.04],
      [0.56, 0.0],
      [0.5, -0.08],
      [0.4, -0.02],
      [0.32, -0.1],
      [0.2, -0.04],
      [0.1, -0.06],
    ];
    for (const sx of [-1, 1]) {
      const nm = sx > 0 ? "wingL" : "wingR";
      R.bone(nm, "body", [sx * rx * 0.72, ry * 0.42, rz * 0.35]);
      if (P.wings === "spread") {
        // Grande aile déployée vers le côté (envergure), festons de rémiges.
        const big = [
          [0, -0.05],
          [0.2, 0.18],
          [0.5, 0.34],
          [0.85, 0.42],
          [1.2, 0.4],
          [1.5, 0.3],
          [1.66, 0.12],
          [1.52, 0.04],
          [1.46, -0.08],
          [1.3, -0.02],
          [1.22, -0.16],
          [1.04, -0.08],
          [0.96, -0.22],
          [0.78, -0.12],
          [0.68, -0.24],
          [0.5, -0.14],
          [0.34, -0.2],
          [0.16, -0.12],
        ];
        // Repère de l'aile : envergure (x) inclinée vers l'arrière de 0,35 rad, pointe relevée de 0,3 rad,
        // plan de l'aile penché vers le ciel (lisible de haut quelle que soit l'orientation du cygne).
        const ry0 = sx > 0 ? 0.35 : Math.PI - 0.35;
        const tl = -0.7 * sx;
        const W = (x, y) => {
          const cx = x * Math.cos(0.3) - y * Math.sin(0.3),
            cy = x * Math.sin(0.3) + y * Math.cos(0.3);
          const ty = cy * Math.cos(tl),
            tz = cy * Math.sin(tl);
          return [cx * Math.cos(ry0) + tz * Math.sin(ry0), ty, -cx * Math.sin(ry0) + tz * Math.cos(ry0)];
        };
        R.add(G.extrude("swan:spread", big, 0.07, 0), nm, { r: [tl, ry0, 0.3], ro: "YXZ", s: [wk * 0.9, wk * 0.85, 1], g: [P.wing || P.body, P.wingTip || P.body, 0.3, -0.2], pat: PAT.feather, uv: [5, 5], cls: plum, ol: true });
        if (P.crystalWings)
          for (let i = 0; i < 5; i++) {
            const u = 0.35 + i * 0.27;
            const q = W(u * wk * 0.9, -0.16 * wk * 0.85);
            R.add(G.crystal(0.06 * wk, 0.42 * wk, 5, 0.12 * wk, 0.02, 0.8), nm, {
              p: q,
              r: [Math.PI - 0.4, 0, sx * (0.1 + i * 0.12)],
              c: i % 2 ? C.ice : C.frost,
              cls: CLS.ice,
              flat: true,
              ol: false,
            });
          }
      } else {
        R.add(G.extrude("swan:wing", shape, 0.07, 0), nm, { p: [sx * 0.02 * k, 0, 0], r: [0, Math.PI / 2, 0], s: [0.78 * wk, 0.62 * wk, 1], g: [P.wing || P.body, P.wingTip || P.shade || C.shade, 0.3, -0.1], pat: PAT.feather, uv: [5, 5], cls: plum, ol: true });
        R.add(G.extrude("swan:wing2", shape.map(([x, y]) => [x * 0.8, y * 0.7 + 0.02]), 0.08, 0), nm, { p: [sx * 0.03 * k, 0.02 * k, 0], r: [0, Math.PI / 2, 0], s: [0.78 * wk, 0.62 * wk, 1], c: P.wing || P.body, pat: PAT.feather, uv: [4, 4], cls: plum, ol: false });
        if (P.frost) for (let i = 0; i < 3; i++) R.add(G.crystal(0.03 * k, 0.16 * k, 4, 0.05 * k, 0.01, 0.8), nm, { p: [sx * 0.05 * k, -0.02 * k, -(0.45 + i * 0.12) * wk], r: [0.9, 0, sx * 0.4], c: C.frost, cls: CLS.ice, flat: true, ol: false });
      }
    }
    // Duvet ébouriffé (cygneau).
    if (P.fluff) {
      for (let i = 0; i < P.fluff; i++) {
        const a = (i / P.fluff) * TAU;
        R.add(G.cone(0.07 * k, 0.16 * k, 4), "body", { p: [Math.sin(a) * rx * 0.85, ry * 0.55 + Math.cos(a * 2) * 0.03, Math.cos(a) * rz * 0.7], r: [Math.cos(a) * 0.9, 0, -Math.sin(a) * 0.9], c: P.body, cls: plum, ol: false });
      }
    }
    // Cou en S (deux tronçons articulés) et tête.
    const nl = (P.neckL || 1) * k,
      nr = (P.neckR || 1) * k;
    R.bone("neck1", "body", [0, ry * 0.55, rz * 0.62]);
    R.add(
      G.tube(
        "swan:neckA",
        [
          [0, -0.14, -0.04],
          [0, 0.08, 0.06],
          [0, 0.26, 0.04],
          [0, 0.4, -0.02],
        ],
        [0.13, 0.1],
        8,
        7,
      ),
      "neck1",
      { s: [nr, nl, nl], c: P.neck || P.body, cls: plum, ol: true },
    );
    R.add(G.sphere(0.1 * nr, 8, 6), "neck1", { p: [0, 0.4 * nl, -0.02 * nl], c: P.neck || P.body, cls: plum, ol: false });
    R.bone("neck2", "neck1", [0, 0.4 * nl, -0.02 * nl]);
    R.add(
      G.tube(
        "swan:neckB",
        [
          [0, 0, 0],
          [0, 0.13, 0.01],
          [0, 0.24, 0.08],
          [0, 0.3, 0.24],
        ],
        [0.1, 0.085],
        8,
        7,
      ),
      "neck2",
      { s: [nr, nl, nl], c: P.neck || P.body, cls: plum, ol: true },
    );
    R.bone("head", "neck2", [0, 0.3 * nl, 0.24 * nl]);
    const hr = P.hr * k;
    R.add(G.sphere(hr, 12, 8), "head", { p: [0, hr * 0.15, hr * 0.3], s: [0.9, 0.95, 1.12], c: P.head || P.body, cls: plum, pat: PAT.feather, uv: [4, 3], ol: true });
    // Bec : masque noir, bouton, mandibule supérieure (orange), mandibule inférieure articulée.
    const bl = (P.beakL || 1) * k;
    if (P.mask) R.add(G.sphere(hr * 0.5, 6, 4), "head", { p: [0, hr * 0.02, hr * 1.02], s: [1.1, 0.85, 0.7], c: P.mask, cls: CLS.satin, ol: false });
    R.add(G.cone(0.075 * bl, 0.32 * bl, 9), "head", { p: [0, -hr * 0.05, hr * 1.02 + 0.13 * bl], r: [Math.PI / 2, 0, 0], s: [1, 1, 0.6], g: [P.beak, P.beakTip || P.beak, -0.16, 0.16], cls: CLS.glossy, ol: true });
    if (P.band) R.add(G.cyl(0.05 * bl, 0.058 * bl, 0.04 * bl, 8), "head", { p: [0, -hr * 0.05, hr * 1.02 + 0.2 * bl], r: [Math.PI / 2, 0, 0], s: [1, 1, 0.62], c: P.band, cls: CLS.glossy, ol: false });
    if (P.knob) R.add(G.sphere(0.05 * P.knob * bl, 6, 4), "head", { p: [0, hr * 0.28, hr * 0.98], s: [0.9, 1, 1.25], c: C.black, cls: CLS.glossy, ol: true });
    R.bone("jaw", "head", [0, -hr * 0.22, hr * 0.98]);
    R.add(G.cone(0.058 * bl, 0.26 * bl, 7), "jaw", { p: [0, -0.005, 0.12 * bl], r: [Math.PI / 2, 0, 0], s: [0.95, 1, 0.4], c: P.beakD, cls: CLS.glossy, ol: false });
    // Crachat d'eau (lueur additive au bec, visible à la détente).
    R.bone("spit", "head", [0, -hr * 0.12, hr * 1.02 + 0.32 * bl]);
    R.glow(G.cone(0.12 * bl, 0.5 * bl, 8, true), "spit", { p: [0, 0, 0.22 * bl], r: [-Math.PI / 2, 0, 0], c: P.spit || "#7fe8ff" });
    R.glow(G.sphere(0.1 * bl, 8, 6), "spit", { c: P.spit || "#bff6ff" });
    // Yeux.
    K.ctEyes(R, "head", {
      p: [0, hr * 0.38, hr * 0.62],
      gap: hr * 0.52,
      r: P.eyeR * k,
      skin: P.head || P.body,
      iris: P.iris || "#2a1a10",
      pupil: 0.7,
      dot: P.dot === undefined ? 0.5 : P.dot,
      slant: P.slant === undefined ? 0.22 : P.slant,
      rest: P.lid === undefined ? -0.55 : P.lid,
      up: 0.35,
      brow: P.brow || null,
      browT: P.browT,
      glowIris: P.glowIris,
    });
    // Couronne de glace.
    if (P.crown) {
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * TAU;
        const hh = (i === 0 ? 0.3 : 0.18 + (i % 2) * 0.06) * k;
        R.add(G.crystal(0.04 * k, hh, 5, hh * 0.4, 0.01, 0.8), "head", { p: [Math.sin(a) * hr * 0.55, hr * 0.85, hr * 0.25 + Math.cos(a) * hr * 0.55], r: [Math.cos(a) * 0.25, 0, -Math.sin(a) * 0.25], c: i % 2 ? C.ice : C.frost, cls: CLS.ice, flat: true, ol: false });
      }
      R.add(G.torus(hr * 0.58, 0.022 * k, 4, 14), "head", { p: [0, hr * 0.84, hr * 0.25], r: [Math.PI / 2, 0, 0], c: C.iceD, cls: CLS.ice, ol: false });
      R.glow(G.sphere(0.045 * k, 6, 5), "head", { p: [0, hr * 0.9 + 0.26 * k, hr * 0.25 + hr * 0.55], c: "#9fe6ff" });
    }
    // Petite huppe (cygne noir).
    if (P.crest) for (let i = 0; i < 3; i++) R.add(G.cone(0.035 * k, 0.16 * k, 4), "head", { p: [0, hr * 0.95, hr * (0.1 - i * 0.18)], r: [-0.7 - i * 0.2, 0, 0], c: P.crest, cls: plum, ol: false });
    R.sway("tail", "y", 0, 0.12, 2.7, 0);
    return { hr };
  }

  /** Animation commune des cygnes : cou qui ondule, se replie (élan) puis se détend (jet d'eau). */
  function swanPose(st, B, P) {
    const t = st.t + st.phase;
    const w = easeInOut(st.w),
      s = st.s;
    const fid = bump(1 - st.fid);
    const br = Math.sin(t * 2);
    const ruffle = st.fidK === 1 ? fid * Math.sin(t * 38) * 0.05 : 0;
    B.body.scale.set(1 + br * 0.012 + ruffle + w * 0.03, 1 + br * 0.018 - w * 0.02, 1 + ruffle);
    B.body.rotation.set(-s * 0.1 + w * 0.06, 0, Math.sin(t * 1.3) * 0.02 - clamp(st.turn, -3, 3) * 0.03);
    const preen = st.fidK === 0 ? fid : 0;
    const look = st.fidK === 2 ? fid * Math.sin(t * 2.2) * 0.7 : 0;
    B.neck1.rotation.set(-0.06 + Math.sin(t * 1.1) * 0.05 - w * 0.5 + s * 0.6 + preen * 0.2, Math.sin(t * 0.6) * 0.16 * (1 - w) + preen * 1.3 + look, Math.sin(t * 0.9) * 0.04);
    B.neck2.rotation.set(0.06 + Math.sin(t * 1.1 + 0.8) * 0.06 + w * 0.55 - s * 0.35 + preen * 0.6, Math.sin(t * 0.6 + 0.6) * 0.1 * (1 - w) + preen * 0.5, 0);
    B.head.rotation.set(-0.2 - w * 0.45 + s * 0.35 + Math.sin(t * 1.5) * 0.04 + preen * 0.5, Math.sin(t * 0.8 + 1) * 0.12 * (1 - w) + ruffle * 3, 0);
    const hiss = Math.max(0, Math.sin(t * 0.9) - 0.94) * 6;
    B.jaw.rotation.x = 0.04 + Math.min(0.8, s * 1.1 + w * 0.25 + hiss * 0.3);
    B.spit.scale.setScalar(s > 0.02 ? 0.4 + s * 0.8 : 0.001);
    // Ailes : repos, voûte, ou déployées ; se soulèvent à l'élan et battent à la détente.
    const mode = P.wings || "fold";
    for (let i = 0; i < 2; i++) {
      const sx = i ? -1 : 1;
      const b = i ? B.wingR : B.wingL;
      const flap = Math.sin(t * 1.4 + i) * 0.03 + ruffle * 2;
      if (mode === "spread") {
        const beat = Math.sin(t * 2.2 + i * 0.2) * 0.12 + w * 0.25 - s * 0.35;
        b.rotation.set(0, 0, sx * beat);
      } else {
        const lift = (mode === "arch" ? 0.95 : 0.12) + w * 0.4 + s * 0.3 + fid * (st.fidK === 1 ? 0.4 : 0) + flap + st.fr * 0.3;
        b.rotation.set(mode === "arch" ? 0.35 : 0.05, 0, -sx * lift * 0.7);
      }
    }
    st.eyeOpen = s > 0.2 ? 1 : w > 0.1 ? -0.7 * w : st.fr > 0.3 ? -0.5 : preen * -0.8;
    if (st.ae >= 0) st.look = 0;
  }

  /* ---------------------------------------------------------------- réglages */
  const CYGNET = { k: 0.9, body: "#a9a9b2", belly: "#d4d4da", head: "#bdbdc6", neck: "#b2b2ba", wing: "#9a9aa4", wingTip: "#7e7e88", tail: "#9a9aa4", hr: 0.26, neckL: 0.72, neckR: 1.1, beak: "#5a5a62", beakD: "#3e3e46", knob: 0, eyeR: 0.11, iris: "#2a1a10", lid: -0.7, slant: 0.05, fluff: 8, wingK: 0.75, beakL: 0.85 };
  const WHITE = { k: 1.0, body: C.white, belly: "#e2e8f0", wing: C.white, wingTip: C.shade, hr: 0.22, beak: C.beak, beakD: C.beakD, beakTip: "#ffb05a", beakL: 1.15, knob: 1, mask: C.black, eyeR: 0.085, iris: "#2a1a10", lid: -0.45, slant: 0.3, brow: C.black, browT: 0.018 };
  const MAJESTIC = Object.assign({}, WHITE, { k: 1.18, hr: 0.21, knob: 1.35, wings: "arch", wingK: 1.2, eyeR: 0.08, slant: 0.36, lid: -0.35 });
  const ICE = { k: 1.28, body: "#e6f6ff", belly: "#bfe4fb", head: "#f4fbff", neck: "#e8f7ff", wing: "#c8ecff", wingTip: "#6ab2ec", tail: "#9fd4f8", hr: 0.21, beak: "#bfe3f4", beakD: "#7fb6d8", beakTip: "#e8f8ff", beakL: 1.1, knob: 1, mask: "#2a4a78", eyeR: 0.078, iris: "#2f7fd8", lid: -0.4, slant: 0.34, brow: "#2a4a78", browT: 0.018, wings: "arch", wingK: 1.18, frost: true, cls: CLS.satin, spit: "#dff8ff" };
  const ROYAL = Object.assign({}, ICE, { k: 1.55, hr: 0.2, wings: "spread", wingK: 1.25, crystalWings: true, crown: true, eyeR: 0.074 });
  const BLACK = { k: 1.28, body: C.night, belly: "#2a2536", head: "#23202e", neck: "#221e2c", wing: "#2a2438", wingTip: "#4a3a6e", tail: "#2a2438", hr: 0.21, beak: C.red, beakD: "#a81e1a", beakTip: "#ff5a4a", beakL: 1.1, band: "#f4f0ea", knob: 0, eyeR: 0.08, iris: "#e0302a", lid: -0.38, slant: 0.38, brow: "#0e0c12", browT: 0.02, wings: "arch", wingK: 1.15, cls: CLS.irid, crest: "#2a2438", spit: "#b98cff" };
  const ENCHANTER = Object.assign({}, BLACK, { k: 1.55, wings: "spread", wingK: 1.3, eyeR: 0.072, glowIris: true, iris: "#ff5a8a" });

  const INFO = {
    1: { height: 1.7, footprint: 1.45 },
    2: { height: 2.2, footprint: 1.5 },
    3: { height: 2.6, footprint: 1.55 },
    A4: { height: 3.0, footprint: 1.6 },
    A5: { height: 3.1, footprint: 1.6 },
    A6: { height: 3.25, footprint: 1.6 },
    A7: { height: 4.2, footprint: 1.7 },
    B4: { height: 3.0, footprint: 1.6 },
    B5: { height: 3.1, footprint: 1.6 },
    B6: { height: 3.25, footprint: 1.6 },
    B7: { height: 4.3, footprint: 1.7 },
  };

  function variant(level, spec, opts) {
    const lv = spec ? spec + level : String(level);
    const pond = opts && opts.terrain && opts.terrain !== "water";
    const P = level === 1 ? CYGNET : level === 2 ? WHITE : level === 3 ? MAJESTIC : spec === "A" ? (level === 7 ? ROYAL : ICE) : level === 7 ? ENCHANTER : BLACK;
    const big = level === 7;
    const deco = level >= 4 ? level - 3 : 0;
    const r = big ? 1.28 : 0.95 + Math.min(level, 4) * 0.06;
    const h = big ? 0.34 : 0.26 + level * 0.012;
    const flagColor = spec === "A" ? "#58b8f0" : spec === "B" ? "#7a3ac8" : "#2f7ad0";
    return {
      key: "swan:" + lv + (pond ? ":mare" : ""),
      release: 0.22,
      dur: 0.7,
      ring: r + 0.3,
      height: INFO[lv].height + (pond ? 0.14 : 0),
      footprint: INFO[lv].footprint,
      turn: 5.5,
      jumpH: 0.4,
      author(R) {
        nest(R, {
          r,
          h,
          pond,
          seed: 7 + level,
          cattails: big ? 5 : 2 + Math.min(level, 3),
          pads: big ? 4 : 2 + (level >= 2 ? 1 : 0),
          twigs: big ? 14 : 8 + level,
          reed: spec === "B" ? "#5a5070" : spec === "A" ? "#a9c8dc" : C.reed,
          reedD: spec === "B" ? "#2e2a3a" : spec === "A" ? "#5a7c9c" : C.reedD,
          twig: spec === "B" ? "#3a3048" : C.twig,
          bowl: spec === "B" ? "#241e30" : C.bowl,
          flower: spec === "B" ? "#b58cff" : spec === "A" ? "#e0f6ff" : C.lotus,
          crystals: spec === "A" ? { n: big ? 9 : 1 + deco * 2, c: C.ice, cls: CLS.ice, k: big ? 1.5 : 1 } : spec === "B" && (deco >= 2 || big) ? { n: big ? 6 : deco * 2 - 1, c: C.mana, cls: CLS.glow, k: big ? 1.2 : 0.9 } : null,
          frozen: spec === "A" && (deco >= 3 || big),
          runes: spec === "B" && (deco >= 3 || big) ? C.rune : null,
          flag: { h: big ? 3.2 : level >= 4 ? 1.95 + deco * 0.12 : 1.3 + level * 0.12, color: flagColor, trim: level >= 4 ? "#ffffff" : "#ffd23a", stars: level >= 4 ? (big ? 3 : deco) : level, len: big ? 0.9 : 0.62, tall: big ? 0.56 : 0.4, tail: level >= 4 ? "swallow" : "point" },
        });
        swan(R, P, h * 0.32);
        // Étincelles de mana qui tournent autour du cygne noir (os « orbit »).
        if (spec === "B") {
          R.bone("orbit", "yaw", [0, 0.9 * P.k, 0]);
          const n = big ? 6 : 3 + deco;
          for (let i = 0; i < n; i++) {
            const a = (i / n) * TAU;
            const rr = (big ? 1.25 : 0.95) * (1 + (i % 2) * 0.12);
            R.glow(G.oct(0.07), "orbit", { p: [Math.sin(a) * rr, (i % 3) * 0.18 - 0.1, Math.cos(a) * rr], c: i % 2 ? C.mana : "#a8d8ff" });
            R.glow(G.sphere(0.13, 6, 5), "orbit", { p: [Math.sin(a) * rr, (i % 3) * 0.18 - 0.1, Math.cos(a) * rr], c: "#2a4a9a" });
          }
        }
        // Anneau de runes violettes (enchanteur).
        if (big && spec === "B") {
          R.bone("runes", "float", [0, 1.6, 0]);
          const n = 8;
          for (let i = 0; i < n; i++) {
            const a = (i / n) * TAU;
            const x = Math.sin(a) * 1.55,
              z = Math.cos(a) * 1.55;
            const strokes = [
              [0, 0, 0.3, 0],
              [0.08, 0.06, 0.16, 0.7],
              [-0.07, -0.05, 0.14, -0.8],
              [0, -0.12, 0.12, Math.PI / 2],
            ];
            for (let s = 0; s < (i % 2 ? 3 : 4); s++) {
              const [ox, oy, L, rz] = strokes[s];
              R.glow(G.box(0.035, L, 0.03), "runes", { p: [x + Math.cos(a) * ox, oy, z - Math.sin(a) * ox], r: [0, a, rz], ro: "YXZ", c: s === 0 ? "#e2b0ff" : C.rune });
            }
          }
          R.glow(G.torus(1.55, 0.018, 3, 48), "runes", { r: [Math.PI / 2, 0, 0], c: "#7a3ac8" });
        }
        // Souffle froid (cygne des glaces) : buée additive au bec.
        if (spec === "A") {
          R.bone("breath", "head", [0, -0.05 * P.k, 0.5 * P.k]);
          R.glow(G.sphere(0.1 * P.k, 8, 6), "breath", { c: "#6fb8e0" });
          R.glow(G.sphere(0.07 * P.k, 8, 6), "breath", { p: [0.03, 0.04, 0.12 * P.k], c: "#9fd8f0" });
        }
      },
      pose(st, B) {
        swanPose(st, B, P);
        const t = st.t + st.phase;
        if (B.orbit) {
          B.orbit.rotation.y = t * (0.9 + st.fr);
          B.orbit.position.y = B.orbit.userData.rest.y + Math.sin(t * 1.3) * 0.06;
        }
        if (B.runes) {
          B.runes.rotation.y = -t * 0.35;
          B.runes.position.y = B.runes.userData.rest.y + Math.sin(t * 0.9) * 0.08;
        }
        if (B.breath) {
          const k = (t * 0.8) % 1;
          B.breath.scale.setScalar(0.4 + k * 1.4 + st.s * 1.5);
          B.breath.position.set(0, -0.05 * P.k - k * 0.06, 0.5 * P.k + k * 0.25);
        }
      },
      muzzle: ["spit", [0, 0, 0.05]],
      extras(root) {
        const rip = ripples(root, big ? 1.28 : r * 1.02);
        if (pond) rip.position.y = 0.15;
        return null;
      },
    };
  }

  K.defCt("swan", {
    variant,
    info(level, spec) {
      return INFO[spec ? spec + level : String(level)] || null;
    },
  });
})();
