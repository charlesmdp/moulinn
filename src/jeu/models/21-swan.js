// « Pas touche à mes trésors » — tours CYGNE (cases d'eau) : gardent des boules d'eau en réserve et les
// lâchent en rafale, puis chaque boule se recharge (attaque « charges », CONCEPTION.md §1.1).
//
//   1 Cygneau               : petit cygne gris perle tout ébouriffé, cou en S, bec orange à bouton noir,
//                             assis dans un grand nid ; 2 boules.
//   2 Cygne                 : grand cygne blanc, long cou en S, bec orange, masque et bouton noirs ; 2 boules.
//   3 Cygne majestueux      : plus grand, ailes relevées en voûte, nénuphars en fleur ; 3 boules.
//   A4-6 Cygne des glaces   : plumes bleu glacier, nid givré planté de cristaux, boules de glace facettées.
//   A7 Cygne royal          : couronne de glace, grandes ailes de cristal déployées, nid pris dans la glace.
//   B4-6 Cygne noir         : plumage noir irisé de violet, bec rouge, boules d'eau sombre et étincelles de mana,
//                             cristaux de mana (5+) et runes (6) sur le nid.
//   B7 Cygne noir enchanteur : ailes déployées, anneau de runes violettes qui tourne.
//
// Socle (couleur de famille bleu et blanc) : disque d'eau claire cerclé d'écume blanche et d'un liseré bleu
// nuit, rides animées (dans l'appel de dessin des lueurs), grand nid de roseaux bruns qui flotte (l'origine
// de la tour est la surface de l'eau ; le nid danse doucement), massettes, nénuphars. Hors de l'eau (butte :
// opts.terrain !== "water"), le même nid flotte dans une mare cerclée de pierres.
// Réserve : K.ctOrbs (boules qui tournent au-dessus du nid, setCharges) ; attaque : le cou se replie (élan,
// la boule file vers le bec) puis se détend, bec grand ouvert (la boule part : projectile waterOrb, iceOrb, darkOrb).
// Voir models/10-kit.js pour la coque commune (visée, attaque, charges, éblouissement, frénésie, sélection).
(function () {
  "use strict";
  const PTMT = globalThis.PTMT;
  if (!PTMT || !PTMT.models || !PTMT.models.kit || !PTMT.models.kit.defCt) return;
  const K = PTMT.models.kit,
    G = K.g,
    PAT = K.PAT,
    CLS = K.CLS;
  const { TAU, clamp, bump, easeInOut } = K.math;

  const C = {
    reed: "#b8924a",
    reedD: "#4e3416",
    twig: "#6a4426",
    straw: "#e2c06a",
    bowl: "#4a3418",
    cattail: "#6a3e22",
    leaf: "#4e9030",
    leafL: "#86c048",
    pad: "#3f9a34",
    padL: "#6cbf44",
    lotus: "#ff9cc6",
    lotusC: "#ffe27a",
    stone: "#a8a294",
    pool: "#59c8ec",
    poolD: "#1f5f9e",
    foam: "#f4fcff",
    white: "#fbfbf6",
    shade: "#d0d8e4",
    beak: "#ff8216",
    beakD: "#d9620c",
    black: "#17151c",
    ice: "#bfe8ff",
    iceD: "#6fb8ee",
    frost: "#f2fbff",
    red: "#e2302a",
    mana: "#6fb4ff",
    rune: "#c77dff",
  };

  /* ---------------------------------------------------------------- socle : eau claire, écume, rides */
  /**
   * Disque de couleur de famille (bleu et blanc) posé sur l'eau, ou mare cerclée de pierres sur une butte.
   * o = { R (rayon extérieur), pond (mare), pool (teinte de l'eau claire), foam (écume), rim (liseré) }
   * Renvoie la hauteur de l'eau.
   */
  function pad(R, o) {
    const r = o.R;
    const wy = o.pond ? 0.16 : 0;
    R.meta.frenzyY = wy + 0.1; // chevrons de frénésie sur l'anneau d'écume
    if (o.pond) {
      // Mare sur la butte : berge de terre, eau, couronne de pierres.
      R.add(G.cyl(r + 0.02, r + 0.1, 0.14, 24), "root", { p: [0, 0.07, 0], c: "#5a6a4a", ol: false });
      const rnd = PTMT.rng(5);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU;
        R.add(G.rock(0.2 + rnd() * 0.07, 0, 0.25, i + 3), "root", { p: [Math.sin(a) * (r - 0.05), 0.15, Math.cos(a) * (r - 0.05)], s: [1.25, 0.75, 1], c: i % 2 ? C.stone : "#8e897c", pat: PAT.stone, flat: true, ol: i % 3 === 0 });
      }
    }
    // Liseré bleu nuit (contour du socle), eau claire, anneau d'écume blanche.
    R.add(G.discUp(r, 28), "root", { p: [0, wy + 0.012, 0], c: o.rim || C.poolD, cls: CLS.wet, ol: false });
    R.add(G.discUp(r - 0.08, 28), "root", { p: [0, wy + 0.024, 0], c: o.pool || C.pool, cls: CLS.wet, ol: false });
    R.add(G.torus(r - 0.2, 0.085, 3, 28), "root", { p: [0, wy + 0.03, 0], r: [Math.PI / 2, 0, 0], s: [1, 1, 0.5], c: o.foam || C.foam, cls: CLS.satin, ol: false });
    K.ctRipples(R, "root", r - 0.1, r + 0.3, wy + 0.02, 0.9);
    return wy;
  }

  /* ---------------------------------------------------------------- nid de roseaux */
  /**
   * o = { r (rayon extérieur), h (hauteur au-dessus de l'eau), wy (hauteur de l'eau), seed, cattails, pads,
   *   tufts (bottes de roseaux), flag, reed, reedD, twig, bowl, flower, crystals: { n, c, cls, k }, runes (couleur),
   *   frozen (bord gelé) }
   * Os : float (danse sur l'eau) ; tout le nid lui est lié.
   */
  function nest(R, o) {
    const r = o.r,
      h = o.h,
      wy = o.wy || 0;
    R.bone("float", "root", [0, wy, 0]);
    // Couronne de roseaux tressés (anneau épais et bombé), creux de brindilles.
    const prof = [
      [r * 0.5, -0.1],
      [r * 0.9, -0.12],
      [r, 0.0],
      [r * 1.02, h * 0.45],
      [r * 0.95, h * 0.88],
      [r * 0.82, h],
      [r * 0.66, h * 0.9],
      [r * 0.56, h * 0.6],
      [r * 0.5, h * 0.3],
    ];
    R.add(G.lathe("nest4:" + r + ":" + h, prof, 16), "float", { gp: [o.reedD || C.reedD, o.reed || C.reed, -0.05, h], pat: PAT.straw, uv: [0.06, 14], ol: true });
    R.add(G.discUp(r * 0.54, 14), "float", { p: [0, h * 0.33, 0], c: o.bowl || C.bowl, pat: PAT.straw, uv: [0.2, 6], ol: false });
    const rnd = PTMT.rng(o.seed || 3);
    // Couronne tressée : bottes de roseaux couchées le long du bord (teintes alternées), quelques brindilles
    // en travers et des tiges qui dépassent (silhouette de nid ébouriffée vue du ciel).
    const nt = o.tufts || 9;
    for (let i = 0; i < nt; i++) {
      const a = (i / nt) * TAU + (rnd() - 0.5) * 0.2;
      const rr = r * 0.8;
      const L = ((TAU * rr) / nt) * 1.25;
      R.add(G.capsule(0.13 + rnd() * 0.03, L, 5, 1), "float", {
        p: [Math.sin(a) * rr, h * 0.86, Math.cos(a) * rr],
        r: [Math.PI / 2 + (rnd() - 0.5) * 0.2, a + Math.PI / 2 + (rnd() - 0.5) * 0.25, 0],
        ro: "YXZ",
        s: [1, 1, 0.72],
        c: i % 3 === 0 ? o.straw || C.straw : i % 3 === 1 ? o.reed || C.reed : o.twig || C.twig,
        pat: PAT.straw,
        uv: [6, 0.4],
        ol: false,
      });
    }
    for (let i = 0; i < Math.round(nt * 0.8); i++) {
      const a = (i / Math.round(nt * 0.8)) * TAU + rnd() * 0.5;
      const L = 0.5 + rnd() * 0.3;
      const rr = r * (0.82 + rnd() * 0.16);
      R.add(G.cyl(0.022, 0.028, L, 4), "float", {
        p: [Math.sin(a) * rr, h * 0.98, Math.cos(a) * rr],
        r: [Math.PI / 2 - 0.15, a + 0.9 + rnd() * 1.2, 0],
        ro: "YXZ",
        c: i % 2 ? o.twig || C.twig : o.straw || C.straw,
        ol: false,
      });
    }
    // Massettes à l'arrière (tiges, épis bruns, longues feuilles).
    const nc = o.cattails === undefined ? 3 : o.cattails;
    for (let i = 0; i < nc; i++) {
      const a = Math.PI + 0.55 + (i - (nc - 1) / 2) * 0.36 + (rnd() - 0.5) * 0.12;
      const rr = r * (0.86 + rnd() * 0.08);
      const x = Math.sin(a) * rr,
        z = Math.cos(a) * rr;
      const hh = 1.0 + rnd() * 0.45;
      R.add(G.cyl(0.022, 0.03, hh, 3, true), "float", { p: [x, h * 0.4 + hh / 2, z], r: [(rnd() - 0.5) * 0.12, 0, (rnd() - 0.5) * 0.12], c: C.leaf, ol: false });
      R.add(G.capsule(0.07, 0.24, 5, 1), "float", { p: [x, h * 0.4 + hh - 0.1, z], c: C.cattail, pat: PAT.fur, ol: true });
      R.add(G.cone(0.06, hh * 0.85, 3, true), "float", { p: [x + 0.07, h * 0.4 + hh * 0.4, z], r: [0, a, 0.25], s: [1, 1, 0.3], c: C.leafL, ol: false });
    }
    // Nénuphars (et une fleur) sur l'eau claire.
    const np = o.pads === undefined ? 3 : o.pads;
    for (let i = 0; i < np; i++) {
      const a = 0.7 + i * 2.25 + rnd() * 0.3;
      const rr = r + 0.14 + rnd() * 0.06;
      const pr = 0.17 + rnd() * 0.06;
      R.add(G.discUp(pr, 9), "root", { p: [Math.sin(a) * rr, wy + 0.05, Math.cos(a) * rr], r: [0, a, 0], c: i % 2 ? C.pad : C.padL, cls: CLS.satin, ol: false });
      if (i === 0 || (o.flowers && i < o.flowers)) {
        for (let k = 0; k < 5; k++) R.add(G.cone(0.065, 0.15, 4), "root", { p: [Math.sin(a) * rr + Math.sin(k * 1.26) * 0.05, wy + 0.1, Math.cos(a) * rr + Math.cos(k * 1.26) * 0.05], r: [Math.sin(k * 1.26) * 0.5, 0, -Math.cos(k * 1.26) * 0.5], ro: "YXZ", c: o.flower || C.lotus, cls: CLS.satin, ol: false });
        R.add(G.sphere(0.04, 6, 4), "root", { p: [Math.sin(a) * rr, wy + 0.12, Math.cos(a) * rr], c: C.lotusC, cls: CLS.glow, ol: false });
      }
    }
    // Cristaux (glace ou mana) plantés dans le nid.
    if (o.crystals) {
      const cr = o.crystals;
      for (let i = 0; i < cr.n; i++) {
        const a = 0.4 + (i / cr.n) * TAU + rnd() * 0.3;
        const rr = r * (0.78 + rnd() * 0.12);
        const hh = (0.34 + rnd() * 0.3) * (cr.k || 1);
        R.add(G.crystal(0.09 * (cr.k || 1), hh, 5, hh * 0.35, 0.02, 0.85), "float", {
          p: [Math.sin(a) * rr, h * 0.75, Math.cos(a) * rr],
          r: [Math.cos(a) * 0.5, 0, -Math.sin(a) * 0.5],
          c: cr.c,
          cls: cr.cls,
          flat: true,
          ol: true,
        });
      }
    }
    if (o.frozen) {
      R.add(G.torus(r * 0.84, 0.1, 4, 24), "float", { p: [0, h * 0.96, 0], r: [Math.PI / 2, 0, 0], c: C.frost, cls: CLS.ice, ol: false });
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * TAU + 0.2;
        R.add(G.cone(0.04, 0.26, 4), "float", { p: [Math.sin(a) * r * 1.0, h * 0.3, Math.cos(a) * r * 1.0], r: [Math.PI, 0, 0], c: C.ice, cls: CLS.ice, flat: true, ol: false });
      }
    }
    if (o.runes) {
      // Runes lumineuses gravées sur le bord du nid (traits en lueur additive).
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + 0.5;
        const x = Math.sin(a) * r * 1.0,
          z = Math.cos(a) * r * 1.0;
        R.glow(G.box(0.035, 0.22, 0.02), "float", { p: [x, h * 0.5, z], r: [0, a, 0.2], c: o.runes });
        R.glow(G.box(0.035, 0.13, 0.02), "float", { p: [x, h * 0.55, z], r: [0, a, -0.9], c: o.runes });
      }
    }
    if (o.flag) K.ctPennant(R, Object.assign({ bone: "float", p: [-r * 0.66, h * 0.7, -r * 0.6], dir: 2.5, tilt: 0.5 }, o.flag));
    R.sway("float", "x", 0, 0.022, 1.1, 0);
    R.sway("float", "z", 0, 0.026, 0.9, 1.3);
  }

  /* ---------------------------------------------------------------- cygne paramétrique */
  /**
   * P = { k, body, belly, wing, wingTip, tail, cls (plumage), neckL, neckR, hr (tête), beak, beakD,
   *       knob, mask, beakTip, beakL, band, eyeR, iris, lid, slant, brow, fluff, wings: "fold" | "arch" | "spread",
   *       wingK, crystalWings, crown, crest, frost, glowIris }
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
    R.add(G.sphere(ry * 0.95, 9, 6), "body", { p: [0, ry * 0.1, rz * 0.55], c: P.body, pat: PAT.feather, uv: [6, 5], cls: plum, ol: false });
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
        R.add(G.cone(0.07 * k, 0.17 * k, 4), "body", { p: [Math.sin(a) * rx * 0.85, ry * 0.55 + Math.cos(a * 2) * 0.03, Math.cos(a) * rz * 0.7], r: [Math.cos(a) * 0.9, 0, -Math.sin(a) * 0.9], c: P.body, cls: plum, ol: false });
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
          [0, -0.12, -0.06],
          [0, 0.1, 0.09],
          [0, 0.3, 0.05],
          [0, 0.46, -0.07],
        ],
        [0.12, 0.09],
        7,
        7,
      ),
      "neck1",
      { s: [nr, nl, nl], c: P.neck || P.body, cls: plum, ol: true },
    );
    R.add(G.sphere(0.1 * nr, 7, 5), "neck1", { p: [0, 0.46 * nl, -0.07 * nl], c: P.neck || P.body, cls: plum, ol: false });
    R.bone("neck2", "neck1", [0, 0.46 * nl, -0.07 * nl]);
    R.add(
      G.tube(
        "swan:neckB",
        [
          [0, 0, 0],
          [0, 0.15, -0.02],
          [0, 0.29, 0.05],
          [0, 0.35, 0.22],
        ],
        [0.09, 0.08],
        7,
        7,
      ),
      "neck2",
      { s: [nr, nl, nl], c: P.neck || P.body, cls: plum, ol: true },
    );
    R.bone("head", "neck2", [0, 0.35 * nl, 0.22 * nl]);
    const hr = P.hr * k;
    R.add(G.sphere(hr, 11, 7), "head", { p: [0, hr * 0.15, hr * 0.3], s: [0.9, 0.95, 1.12], c: P.head || P.body, cls: plum, pat: PAT.feather, uv: [4, 3], ol: true });
    // Bec : masque noir, bouton, mandibule supérieure (orange), mandibule inférieure articulée.
    const bl = (P.beakL || 1) * k;
    if (P.mask) R.add(G.sphere(hr * 0.5, 6, 4), "head", { p: [0, hr * 0.02, hr * 1.02], s: [1.1, 0.85, 0.7], c: P.mask, cls: CLS.satin, ol: false });
    R.add(G.cone(0.08 * bl, 0.34 * bl, 9), "head", { p: [0, -hr * 0.05, hr * 1.02 + 0.14 * bl], r: [Math.PI / 2, 0, 0], s: [1, 1, 0.62], g: [P.beak, P.beakTip || P.beak, -0.17, 0.17], cls: CLS.glossy, ol: true });
    if (P.band) R.add(G.cyl(0.052 * bl, 0.06 * bl, 0.04 * bl, 8), "head", { p: [0, -hr * 0.05, hr * 1.02 + 0.2 * bl], r: [Math.PI / 2, 0, 0], s: [1, 1, 0.62], c: P.band, cls: CLS.glossy, ol: false });
    if (P.knob) R.add(G.sphere(0.055 * P.knob * bl, 6, 4), "head", { p: [0, hr * 0.3, hr * 0.98], s: [0.9, 1, 1.25], c: C.black, cls: CLS.glossy, ol: true });
    R.bone("jaw", "head", [0, -hr * 0.22, hr * 0.98]);
    R.add(G.cone(0.06 * bl, 0.28 * bl, 7), "jaw", { p: [0, -0.005, 0.13 * bl], r: [Math.PI / 2, 0, 0], s: [0.95, 1, 0.4], c: P.beakD, cls: CLS.glossy, ol: false });
    // Lueur au bec (visible à la détente : la boule part).
    R.bone("spit", "head", [0, -hr * 0.12, hr * 1.02 + 0.34 * bl]);
    R.glow(G.sphere(0.12 * bl, 8, 6), "spit", { c: P.spit || "#bff6ff" });
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
    // Étoiles d'éblouissement au-dessus de la tête.
    K.ctDizzy(R, "head", { p: [0, hr * 1.6, hr * 0.3], r: 0.36 * Math.sqrt(k), size: 0.17 * Math.sqrt(k) });
    R.sway("tail", "y", 0, 0.12, 2.7, 0);
    return { hr };
  }

  /** Animation commune des cygnes : cou qui ondule, se replie (élan) puis se détend d'un coup, bec ouvert (la boule part). */
  function swanPose(st, B, P) {
    const t = st.t + st.phase;
    const w = easeInOut(st.w),
      s = st.s;
    const fid = bump(1 - st.fid);
    const br = Math.sin(t * 2);
    const ruffle = st.fidK === 1 ? fid * Math.sin(t * 38) * 0.05 : 0;
    const dz = st.dz;
    const wob = Math.sin(st.time * 7.5) * dz;
    B.body.scale.set(1 + br * 0.012 + ruffle + w * 0.03, 1 + br * 0.018 - w * 0.02, 1 + ruffle);
    B.body.rotation.set(-s * 0.1 + w * 0.06, 0, Math.sin(t * 1.3) * 0.02 - clamp(st.turn, -3, 3) * 0.03 + wob * 0.06);
    const preen = st.fidK === 0 ? fid : 0;
    const look = st.fidK === 2 ? fid * Math.sin(t * 2.2) * 0.7 : 0;
    B.neck1.rotation.set(-0.06 + Math.sin(t * 1.1) * 0.05 - w * 0.55 + s * 0.65 + preen * 0.2, Math.sin(t * 0.6) * 0.16 * (1 - w) + preen * 1.3 + look + wob * 0.35, Math.sin(t * 0.9) * 0.04 + wob * 0.2);
    B.neck2.rotation.set(0.06 + Math.sin(t * 1.1 + 0.8) * 0.06 + w * 0.6 - s * 0.38 + preen * 0.6, Math.sin(t * 0.6 + 0.6) * 0.1 * (1 - w) + preen * 0.5, -wob * 0.25);
    B.head.rotation.set(-0.2 - w * 0.45 + s * 0.35 + Math.sin(t * 1.5) * 0.04 + preen * 0.5, Math.sin(t * 0.8 + 1) * 0.12 * (1 - w) + ruffle * 3 + wob * 0.5, wob * 0.45);
    const hiss = Math.max(0, Math.sin(t * 0.9) - 0.94) * 6;
    B.jaw.rotation.x = 0.04 + Math.min(0.85, s * 1.15 + w * 0.3 + hiss * 0.3);
    B.spit.scale.setScalar(s > 0.02 || w > 0.3 ? 0.5 + Math.max(s, w * 0.6) * 0.9 : 0.001);
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
  const CYGNET = { k: 1.3, body: "#dfe2ea", belly: "#f4f5f8", head: "#e8eaf0", neck: "#e2e4ec", wing: "#c9ccd8", wingTip: "#9ea4b4", tail: "#c9ccd8", hr: 0.24, neckL: 1.02, neckR: 1.12, beak: "#ff8a2a", beakD: "#d9620c", beakTip: "#ffb05a", knob: 0.8, mask: "#3a3a44", eyeR: 0.105, iris: "#2a1a10", lid: -0.72, slant: 0.04, fluff: 9, wingK: 0.82, beakL: 0.85 };
  const WHITE = { k: 1.5, body: C.white, belly: "#e2e8f0", wing: C.white, wingTip: C.shade, hr: 0.21, neckL: 1.3, beak: C.beak, beakD: C.beakD, beakTip: "#ffb05a", beakL: 1.15, knob: 1.1, mask: C.black, eyeR: 0.085, iris: "#2a1a10", lid: -0.45, slant: 0.3, brow: C.black, browT: 0.018 };
  const MAJESTIC = Object.assign({}, WHITE, { k: 1.62, hr: 0.21, knob: 1.35, wings: "arch", wingK: 1.2, eyeR: 0.08, slant: 0.36, lid: -0.35 });
  const ICE = { k: 1.68, body: "#cfe7fa", belly: "#9ccdf2", head: "#e4f3ff", neck: "#d6ecfc", wing: "#b2d8f6", wingTip: "#3a7fd4", tail: "#6fb2ea", hr: 0.21, neckL: 1.15, beak: "#bfe3f4", beakD: "#7fb6d8", beakTip: "#e8f8ff", beakL: 1.1, knob: 1, mask: "#2a4a78", eyeR: 0.078, iris: "#2f7fd8", lid: -0.4, slant: 0.34, brow: "#2a4a78", browT: 0.018, wings: "arch", wingK: 1.18, frost: true, cls: CLS.satin, spit: "#dff8ff" };
  const ROYAL = Object.assign({}, ICE, { k: 1.9, hr: 0.2, wings: "spread", wingK: 1.05, crystalWings: true, crown: true, eyeR: 0.074 });
  const BLACK = { k: 1.68, body: "#1d1a26", belly: "#2a2536", head: "#23202e", neck: "#221e2c", wing: "#2a2438", wingTip: "#4a3a6e", tail: "#2a2438", hr: 0.21, neckL: 1.15, beak: C.red, beakD: "#a81e1a", beakTip: "#ff5a4a", beakL: 1.1, band: "#f4f0ea", knob: 0, eyeR: 0.08, iris: "#e0302a", lid: -0.38, slant: 0.38, brow: "#0e0c12", browT: 0.02, wings: "arch", wingK: 1.15, cls: CLS.irid, crest: "#2a2438", spit: "#b98cff" };
  const ENCHANTER = Object.assign({}, BLACK, { k: 1.9, wings: "spread", wingK: 1.08, eyeR: 0.072, glowIris: true, iris: "#ff5a8a" });

  // Réserve par défaut (avant le premier setCharges) : CONCEPTION.md §1.1.
  const CHARGES = { 1: 2, 2: 2, 3: 3, A4: 3, A5: 3, A6: 4, A7: 5, B4: 3, B5: 3, B6: 4, B7: 5 };

  // Hauteur réelle du sommet (m, mesurée sur les gabarits, nid sur l'eau) et rayon d'emprise (m).
  const INFO = {
    1: { height: 2.09, footprint: 1.55 },
    2: { height: 2.69, footprint: 1.55 },
    3: { height: 2.9, footprint: 1.55 },
    A4: { height: 2.8, footprint: 1.55 },
    A5: { height: 2.9, footprint: 1.55 },
    A6: { height: 3.04, footprint: 1.55 },
    A7: { height: 3.82, footprint: 1.6 },
    B4: { height: 2.85, footprint: 1.55 },
    B5: { height: 2.9, footprint: 1.55 },
    B6: { height: 3.04, footprint: 1.55 },
    B7: { height: 3.74, footprint: 1.6 },
  };

  function variant(level, spec, opts) {
    const lv = spec ? spec + level : String(level);
    const pond = opts && opts.terrain && opts.terrain !== "water";
    const P = level === 1 ? CYGNET : level === 2 ? WHITE : level === 3 ? MAJESTIC : spec === "A" ? (level === 7 ? ROYAL : ICE) : level === 7 ? ENCHANTER : BLACK;
    const big = level === 7;
    const deco = level >= 4 ? level - 3 : 0;
    const Rr = big ? 1.6 : 1.55;
    const r = big ? 1.32 : 1.14 + Math.min(level, 4) * 0.035;
    const h = big ? 0.44 : 0.36 + Math.min(level, 4) * 0.012;
    const flagColor = spec === "A" ? "#58b8f0" : spec === "B" ? "#6a2ac0" : "#2f7ad0";
    const orbKind = spec === "A" ? "ice" : spec === "B" ? "dark" : "water";
    return {
      key: "swan4:" + lv + (pond ? ":mare" : ""),
      release: 0.18, // = élan de la simulation (cygne)
      dur: 0.62,
      ring: Rr + 0.08,
      footprint: INFO[lv].footprint,
      turn: 5.5,
      jumpH: 0.4,
      charges: CHARGES[lv],
      attackKind: "charges",
      author(R) {
        const wy = pad(R, {
          R: Rr,
          pond,
          pool: spec === "B" ? "#6a7fd8" : spec === "A" ? "#9fe2f8" : C.pool,
          foam: spec === "B" ? "#e6dcff" : C.foam,
          rim: spec === "B" ? "#2a1a5a" : C.poolD,
        });
        nest(R, {
          r,
          h,
          wy,
          seed: 7 + level,
          cattails: big ? 4 : 3,
          pads: big ? 4 : 3,
          flowers: level >= 3 ? 2 : 1,
          tufts: big ? 13 : 8 + Math.min(level, 3),
          reed: spec === "B" ? "#6a5a80" : spec === "A" ? "#6e94b8" : C.reed,
          reedD: spec === "B" ? "#2e2a3a" : spec === "A" ? "#2e4a6a" : C.reedD,
          twig: spec === "B" ? "#3a3048" : spec === "A" ? "#4a6a8e" : C.twig,
          straw: spec === "B" ? "#8a7aa8" : spec === "A" ? "#86aed0" : C.straw,
          bowl: spec === "B" ? "#241e30" : C.bowl,
          flower: spec === "B" ? "#b58cff" : spec === "A" ? "#e0f6ff" : C.lotus,
          crystals: spec === "A" ? { n: big ? 8 : 1 + deco * 2, c: C.ice, cls: CLS.ice, k: big ? 1.5 : 1.1 } : spec === "B" && (deco >= 2 || big) ? { n: big ? 6 : deco * 2 - 1, c: C.mana, cls: CLS.glow, k: big ? 1.2 : 0.95 } : null,
          frozen: spec === "A" && (deco >= 3 || big),
          runes: spec === "B" && (deco >= 3 || big) ? C.rune : null,
          flag: {
            h: big ? 3.3 : level >= 4 ? 2.2 + deco * 0.14 : 1.45 + level * 0.15,
            color: flagColor,
            trim: level >= 4 ? "#ffffff" : "#ffd23a",
            stars: level >= 4 ? (big ? 3 : deco) : level,
            len: big ? 0.95 : 0.8,
            tall: big ? 0.6 : 0.52,
            starR: big ? 0.15 : 0.13,
            thick: 0.04,
            tail: level >= 4 ? "swallow" : "point",
          },
        });
        swan(R, P, h * 0.28);
        // Réserve de boules au-dessus du nid.
        K.ctOrbs(R, { parent: "float", y: (big ? 1.75 : 1.2 + level * 0.06) + P.k * 0.15, r: big ? 1.3 : r * 0.98, size: big ? 0.25 : 0.2 + Math.min(level, 4) * 0.008, kind: orbKind });
        // Étincelles de mana qui tournent autour du cygne noir (os « orbit »).
        if (spec === "B") {
          R.bone("orbit", "yaw", [0, 0.9 * P.k, 0]);
          const n = big ? 6 : 3 + deco;
          for (let i = 0; i < n; i++) {
            const a = (i / n) * TAU;
            const rr = (big ? 1.05 : 0.82) * (1 + (i % 2) * 0.12);
            R.glow(G.oct(0.07), "orbit", { p: [Math.sin(a) * rr, (i % 3) * 0.18 - 0.1, Math.cos(a) * rr], c: i % 2 ? C.mana : "#a8d8ff" });
          }
        }
        // Anneau de runes violettes (enchanteur).
        if (big && spec === "B") {
          R.bone("runes", "float", [0, 2.35, 0]);
          const n = 8;
          for (let i = 0; i < n; i++) {
            const a = (i / n) * TAU;
            const x = Math.sin(a) * 1.5,
              z = Math.cos(a) * 1.5;
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
          R.glow(G.torus(1.5, 0.018, 3, 48), "runes", { r: [Math.PI / 2, 0, 0], c: "#7a3ac8" });
        }
        // Souffle froid (cygne des glaces) : buée additive au bec.
        if (spec === "A") {
          R.bone("breath", "head", [0, -0.05 * P.k, 0.5 * P.k]);
          R.glow(G.sphere(0.1 * P.k, 8, 6), "breath", { c: "#6fb8e0", lite: false });
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
    };
  }

  K.defCt("swan", {
    variant,
    info(level, spec, opts) {
      const i = INFO[spec ? spec + level : String(level)];
      if (!i) return null;
      // Hors de l'eau, le nid flotte dans une mare surélevée de 0,16 m.
      return opts && opts.terrain && opts.terrain !== "water" ? { height: Math.round((i.height + 0.16) * 100) / 100, footprint: i.footprint } : i;
    },
  });
})();
