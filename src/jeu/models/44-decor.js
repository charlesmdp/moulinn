// « Pas touche à mes trésors » — décor des cases infranchissables (X), en un lot pour toute la carte.
//
//   const decor = PTMT.models.decorBatch(entries)
//     entries : [{ kind, x, y, z (monde : centre de la case, y = sol de la case), rot (radians autour
//                 de Y ; la façade des maisons regarde +Z local), seed, link }]
//     link (facultatif) : voisins de même nature, en directions de la grille (1 = est +X, 2 = sud +Z,
//       4 = ouest −X, 8 = nord −Z) : talus, haies et falaises se prolongent vers eux et se raccordent
//       bout à bout. Sans link, talus et haies filent selon rot (axe X local).
//     kinds : "talus" (levée de terre herbue plantée de chênes et de noisetiers), "boulders" (chaos de
//       granit), "house" (penty de granit, toit d'ardoise, cheminée qui fume), "hedge" (haie),
//       "calvaire", "haystack" (meules de foin), "well" (puits), "chapel" (chapelle et son clocheton),
//       "cliff" (falaise de granit), "pond_rocks" (rochers de berge, roseaux, parfois un héron).
//     → { object, update(dt, time), dispose() }
//
// Quatre appels de dessin pour tout le décor : granit (moellons), ardoises, le reste en couleurs de
// sommets (terre, herbe, bois, feuillages qui ondulent au vent), et les fumées des cheminées.
(function () {
  "use strict";
  const PTMT = globalThis.PTMT;
  if (!PTMT || typeof THREE === "undefined" || !PTMT.models || !PTMT.models.props) return;
  const K = PTMT.models.kit;
  const P = PTMT.models.props;
  const { TAU, clamp } = K.math;
  const T = P.T;
  const HALF = P.TILE / 2;

  const C = {
    granite: "#b8af9c",
    graniteD: "#928977",
    dressed: "#d6ccb6",
    slate: "#5a677c",
    slateD: "#3a4250",
    earth: "#7a5634",
    earthD: "#6a4628",
    grass: "#6fae3e",
    grassD: "#3f7a26",
    wood: "#8a6a48",
    woodD: "#5a4230",
    door: "#2f7a8e",
    doorG: "#3f8a4a",
    shutter: "#3f86a8",
    hay: "#f0c048",
    hayD: "#a8741e",
    rope: "#6a4a2a",
    water: "#1f4a66",
  };
  const DIRS = [
    [1, 1, 0],
    [2, 0, 1],
    [4, -1, 0],
    [8, 0, -1],
  ];

  /* ------------------------------------------------------------------ outils */
  function frame(e) {
    const m = new THREE.Matrix4().makeRotationY(e.rot || 0);
    m.setPosition(e.x, e.y, e.z);
    return m;
  }
  const W0 = new THREE.Matrix4();
  function worldAt(e) {
    return new THREE.Matrix4().makeTranslation(e.x, e.y, e.z);
  }
  /** Directions reliées (vecteurs monde) : link, sinon l'axe X local tourné de rot. */
  function arms(e) {
    if (e.link === undefined || e.link === null) {
      const c = Math.cos(e.rot || 0),
        s = Math.sin(e.rot || 0);
      return [
        [c, -s],
        [-c, s],
      ];
    }
    const out = [];
    for (const [bit, dx, dz] of DIRS) if (e.link & bit) out.push([dx, dz]);
    return out;
  }
  const tree = (A, name, v, x, y, z, s, rnd, M) => A.main.put(P.plant(name, v), [x, y, z], [0, rnd() * TAU, 0], s, { tint: tintOf(rnd, 0.08), pivot: pv(M, x, y, z) }, M);
  function pv(M, x, y, z) {
    const v = new THREE.Vector3(x, y, z).applyMatrix4(M);
    return [v.x, v.y, v.z];
  }
  function tintOf(rnd, a) {
    const l = 1 + (rnd() - 0.5) * a * 2;
    return new THREE.Color(l, l * (1 + (rnd() - 0.5) * a * 0.3), l);
  }
  const hasPlant = () => typeof P.plant === "function";

  /* ------------------------------------------------------------------ talus planté */
  function talus(A, e, rnd) {
    const M = worldAt(e);
    const ar = arms(e);
    // Dégradés en hauteur absolue (espace du lot) : on part du sol de la case.
    const earth = { g: [C.earthD, "#58962e", e.y + 0.35, e.y + 0.95], vj: 0.16, vs: 1.4, dark: 0.3, rim: 0.55, sway: 0 };
    // Butte centrale et bras jusqu'aux voisins (ils débordent un peu : raccord sans couture).
    A.main.put(T.blob(600 + (e.seed % 5), 1, 0.1, 1.3, -0.3), [0, 0.12, 0], [0, rnd() * TAU, 0], [1.25, 1.12, 1.25], earth, M);
    for (const [dx, dz] of ar) {
      const yaw = Math.atan2(dx, dz);
      A.main.put(T.blob(610 + (e.seed % 3), 1, 0.08, 1.2, -0.3), [dx * 1.05, 0.1, dz * 1.05], [0, yaw, 0], [1.12, 1.08, 1.05], earth, M);
      // Pierres qui affleurent sur le flanc.
      for (let k = 0; k < 2; k++) {
        const side = k ? 1 : -1;
        const t = 0.4 + rnd() * 0.9;
        A.rock.put(T.rock(620 + k + (e.seed % 7), 0, 0.3), [dx * t + dz * side * 0.95, 0.25, dz * t - dx * side * 0.95], [0, rnd() * TAU, 0], [0.28, 0.22, 0.24], { c: "#a39c90", box: 1.2, rim: 0.7, dark: 0.3, moss: ["#3f7424", 0.55, 0.95] }, M);
      }
    }
    if (!hasPlant()) return;
    // Chênes émondés et noisetiers sur la crête, fougères et digitales sur les flancs.
    const topY = 1.05;
    const nTree = rnd() < 0.55 ? 1 : 0;
    for (let i = 0; i < nTree; i++) {
      const [dx, dz] = ar.length ? ar[i % ar.length] : [0, 0];
      const t = i === 0 ? 0.15 : 0.95;
      tree(A, rnd() < 0.8 ? "oak" : "chestnut", Math.floor(rnd() * 4) % 3, dx * t + (rnd() - 0.5) * 0.3, topY - 0.1, dz * t + (rnd() - 0.5) * 0.3, 0.66 + rnd() * 0.14, rnd, M);
    }
    // Noisetiers et aubépines alignés sur la crête.
    const crest = ar.length ? ar : [[1, 0], [-1, 0]];
    for (const [dx, dz] of crest)
      for (const t of [0.45, 1.15]) {
        if (rnd() < 0.25) continue;
        tree(A, "bush", Math.floor(rnd() * 4), dx * t + (rnd() - 0.5) * 0.3, topY - 0.15, dz * t + (rnd() - 0.5) * 0.3, 0.8 + rnd() * 0.25, rnd, M);
      }
    for (let i = 0; i < 3; i++) {
      const a = rnd() * TAU;
      tree(A, "fern", Math.floor(rnd() * 3), Math.cos(a) * 1.05, 0.55, Math.sin(a) * 1.05, 0.7 + rnd() * 0.3, rnd, M);
    }
  }

  /* ------------------------------------------------------------------ haie */
  function hedge(A, e, rnd) {
    const M = worldAt(e);
    const ar = arms(e);
    if (!hasPlant()) return;
    const spots = [[0, 0]];
    for (const [dx, dz] of ar) for (const t of [0.62, 1.25]) spots.push([dx * t, dz * t]);
    if (!ar.length) spots.push([0.6, 0.3], [-0.5, -0.3]);
    for (const [x, z] of spots) {
      tree(A, "bush", Math.floor(rnd() * 4), x + (rnd() - 0.5) * 0.2, 0, z + (rnd() - 0.5) * 0.2, 1.25 + rnd() * 0.3, rnd, M);
    }
    // Pied de haie : bande d'herbe haute et quelques fleurs.
    for (const [x, z] of spots) {
      if (rnd() < 0.5) tree(A, "fern", Math.floor(rnd() * 3), x + 0.45, 0, z + 0.45, 0.6, rnd, M);
    }
    if (rnd() < 0.5) tree(A, rnd() < 0.5 ? "oak" : "birch", Math.floor(rnd() * 3), 0, 0, 0, 0.75, rnd, M);
  }

  /* ------------------------------------------------------------------ chaos de granit */
  function boulders(A, e, rnd) {
    const M = frame(e);
    const rock = (seed, x, y, z, s, sy) =>
      A.rock.put(T.rock(seed, 1, 0.26), [x, y, z], [rnd() * 0.3, rnd() * TAU, rnd() * 0.3], [s * 1.15, s * (sy || 0.82), s], { c: "#a8a194", box: 1.4, vj: 0.1, rim: 0.9, dark: 0.4, moss: ["#3f7424", 0.55, 0.95] }, M);
    rock(700 + (e.seed % 9), -0.35, 0.55, -0.45, 1.25);
    rock(710 + (e.seed % 7), 0.75, 0.4, 0.3, 0.9);
    rock(720 + (e.seed % 5), -0.55, 0.3, 0.75, 0.7);
    rock(730 + (e.seed % 5), 0.1, 1.25, -0.1, 0.62, 0.75);
    for (let i = 0; i < 4; i++) {
      const a = rnd() * TAU;
      A.rock.put(T.rock(740 + i, 0, 0.3), [Math.cos(a) * 1.35, 0.08, Math.sin(a) * 1.35], [0, rnd() * TAU, 0], 0.3 + rnd() * 0.15, { c: "#9c958a", box: 1.3, vj: 0.1, rim: 0.85, dark: 0.3, moss: ["#3f7424", 0.55, 0.95] }, M);
    }
    if (hasPlant()) {
      tree(A, "fern", Math.floor(rnd() * 3), 0.9, 0.05, -0.9, 0.9, rnd, M);
      tree(A, "fern", Math.floor(rnd() * 3), -1.1, 0.05, 0.2, 0.8, rnd, M);
      if (rnd() < 0.6) tree(A, "gorse", Math.floor(rnd() * 3), 1.1, 0.05, 1.0, 0.8, rnd, M);
    }
  }

  /* ------------------------------------------------------------------ maison (penty) */
  function wallBox(A, M, x, y, z, w, h, d, c) {
    A.stone.put(T.boxB(w, h, d), [x, y, z], 0, 1, { c: c || C.granite, box: 1.4, ao: [0.72, 0, 1.2], vj: 0.05 }, M);
  }
  function gableRoofX(A, M, L, Wd, rise, over, y0, cz, col) {
    const slope = Math.atan2(rise, Wd / 2);
    const run = Wd / 2 + over;
    const drop = over * Math.tan(slope);
    const len = Math.hypot(run, rise + drop);
    for (const s of [-1, 1]) A.slate.put(T.boxSeg(L + over * 2, 0.12, len, 4, 1, 3), [0, y0 + (rise - drop) / 2 + 0.06, cz + (s * run) / 2], [s * slope, 0, 0], 1, { c: col || C.slate, box: 0.9, vj: 0.18, vs: 0.9 }, M);
    A.slate.put(T.box(L + over * 2 + 0.05, 0.18, 0.18), [0, y0 + rise + 0.08, cz], [Math.PI / 4, 0, 0], 1, { c: C.slateD, box: 0.9 }, M);
  }
  function gableTri(A, M, x, Wd, rise, y0, cz, th, c) {
    A.stone.put(
      T.extrude("dgable" + Wd + "," + rise + "," + th, [
        [-Wd / 2, 0],
        [Wd / 2, 0],
        [0, rise],
      ], th),
      [x, y0, cz],
      [0, Math.PI / 2, 0],
      1,
      { c: c || C.granite, box: 1.4 },
      M,
    );
  }
  function hydrangea(A, M, x, z, s, c, rnd) {
    A.main.put(T.blob(640 + Math.floor(rnd() * 5), 1, 0.14, 1.7, -0.3), [x, 0.3 * s, z], 0, [0.55 * s, 0.4 * s, 0.45 * s], { c: "#3a7430", rim: 0.7, vj: 0.1 }, M);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU + rnd();
      A.main.put(T.blob(650 + i, 0, 0.2), [x + Math.cos(a) * 0.3 * s, (0.42 + (i % 2) * 0.1) * s, z + Math.sin(a) * 0.24 * s], 0, 0.21 * s, { c: P.vary(c, rnd, 0.22), rim: 0.6, vj: 0.14, emit: 0.08 }, M);
    }
  }
  function house(A, e, rnd, smoke) {
    const M = frame(e);
    const L = 3.1,
      Wd = 2.2,
      Hh = 1.75,
      rise = 1.35;
    const z0 = -0.25;
    wallBox(A, M, 0, 0, z0, L, Hh, Wd);
    // Chaînages d'angle clairs.
    for (const sx of [-1, 1])
      for (const sz of [-1, 1])
        for (let i = 0; i < 5; i++) {
          const long = i % 2 === 0;
          A.stone.put(T.box(long ? 0.5 : 0.3, 0.3, long ? 0.3 : 0.5), [sx * (L / 2 - (long ? 0.2 : 0.1)), 0.17 + i * 0.34, z0 + sz * (Wd / 2 - (long ? 0.1 : 0.2))], 0, 1.03, { c: C.dressed, box: 1, j: 0.05 }, M);
        }
    gableTri(A, M, -L / 2 + 0.2, Wd, rise, Hh, z0, 0.4);
    gableTri(A, M, L / 2 - 0.2, Wd, rise, Hh, z0, 0.4);
    gableRoofX(A, M, L, Wd, rise, 0.22, Hh, z0);
    // Cheminée sur un pignon, fumée.
    const cx = (rnd() < 0.5 ? -1 : 1) * (L / 2 - 0.25);
    A.stone.put(T.boxB(0.5, 1.35, 0.6), [cx, Hh + rise - 0.55, z0], 0, 1, { c: C.granite, box: 1 }, M);
    A.stone.put(T.boxB(0.62, 0.1, 0.72), [cx, Hh + rise + 0.8, z0], 0, 1, { c: C.dressed, box: 1 }, M);
    const sp = new THREE.Vector3(cx, Hh + rise + 0.95, z0).applyMatrix4(M);
    smoke.push([sp.x, sp.y, sp.z]);
    // Porte, fenêtre à volets, jardinière.
    const fz = z0 + Wd / 2;
    const doorC = rnd() < 0.5 ? C.door : C.doorG;
    A.main.put(T.boxB(0.72, 1.3, 0.08), [-0.55, 0, fz + 0.02], 0, 1, { c: doorC }, M);
    A.main.put(T.box(0.62, 0.05, 0.03), [-0.55, 0.35, fz + 0.07], 0, 1, { c: "#2a2420" }, M);
    A.main.put(T.box(0.62, 0.05, 0.03), [-0.55, 1.0, fz + 0.07], 0, 1, { c: "#2a2420" }, M);
    A.stone.put(T.boxB(1.05, 0.22, 0.22), [-0.55, 1.3, fz + 0.05], 0, 1, { c: C.dressed, box: 1 }, M);
    A.stone.put(T.boxB(1.0, 0.1, 0.45), [-0.55, 0, fz + 0.2], 0, 1, { c: C.dressed, box: 1 }, M);
    A.main.put(T.box(0.55, 0.55, 0.06), [0.65, 1.0, fz + 0.03], 0, 1, { c: "#27303e", emit: 0.05 }, M);
    A.main.put(T.box(0.04, 0.55, 0.04), [0.65, 1.0, fz + 0.07], 0, 1, { c: "#f2efe6" }, M);
    A.main.put(T.box(0.55, 0.04, 0.04), [0.65, 1.0, fz + 0.07], 0, 1, { c: "#f2efe6" }, M);
    for (const s of [-1, 1]) A.main.put(T.box(0.3, 0.6, 0.05), [0.65 + s * 0.44, 1.0, fz + 0.05], 0, 1, { c: C.shutter }, M);
    A.main.put(T.boxB(0.66, 0.12, 0.18), [0.65, 0.62, fz + 0.1], 0, 1, { c: C.woodD }, M);
    for (let i = 0; i < 4; i++) A.main.put(T.blob(660 + i, 0, 0.3), [0.4 + i * 0.17, 0.78, fz + 0.14], 0, 0.09, { c: i % 2 ? "#ff4a5a" : "#ffffff", rim: 0.5, emit: 0.1 }, M);
    // Hortensias au pied du mur, banc de pierre.
    hydrangea(A, M, -1.25, fz + 0.3, 0.9, rnd() < 0.5 ? "#5a7aff" : "#ff7ab8", rnd);
    hydrangea(A, M, 1.3, fz + 0.3, 0.75, rnd() < 0.5 ? "#8a6aff" : "#5a8aff", rnd);
    A.stone.put(T.boxB(0.9, 0.35, 0.3), [0.55, 0, fz + 0.45], 0, 1, { c: C.graniteD, box: 1 }, M);
  }

  /* ------------------------------------------------------------------ chapelle */
  function chapel(A, e, rnd, smoke, glows) {
    const M = frame(e);
    const L = 2.3,
      Ln = 3.0,
      Hh = 2.0,
      rise = 1.55;
    // Nef le long de Z (façade à +Z).
    wallBox(A, M, 0, 0, 0, L, Hh, Ln);
    const R = new THREE.Matrix4().makeRotationY(Math.PI / 2).premultiply(M);
    // Toit : faîtage selon Z (repère tourné d'un quart de tour).
    gableRoofX(A, R, Ln, L, rise, 0.2, Hh, 0);
    // Pignons (avant et arrière), l'avant porte le clocheton.
    for (const s of [-1, 1])
      A.stone.put(
        T.extrude("chgable", [
          [-L / 2, 0],
          [L / 2, 0],
          [0, rise],
        ], 0.3),
        [0, Hh, s * (Ln / 2 - 0.15)],
        0,
        1,
        { c: C.granite, box: 1.4 },
        M,
      );
    const fz = Ln / 2;
    // Clocheton : deux piliers, arc, petite toiture en bâtière, croix.
    const by = Hh + rise - 0.1;
    for (const s of [-1, 1]) A.stone.put(T.boxB(0.18, 0.75, 0.25), [s * 0.28, by, fz - 0.15], 0, 1, { c: C.dressed, box: 1 }, M);
    A.stone.put(T.boxB(0.8, 0.14, 0.3), [0, by + 0.75, fz - 0.15], 0, 1, { c: C.dressed, box: 1 }, M);
    A.stone.put(
      T.extrude("chcap", [
        [-0.42, 0],
        [0.42, 0],
        [0, 0.35],
      ], 0.3),
      [0, by + 0.89, fz - 0.15],
      0,
      1,
      { c: C.granite, box: 1 },
      M,
    );
    A.main.put(
      T.lathe("chbell", [
        [0.001, 0.02],
        [0.07, 0.0],
        [0.1, -0.1],
        [0.14, -0.22],
        [0.001, -0.2],
      ], 10),
      [0, by + 0.62, fz - 0.15],
      0,
      1,
      { c: "#c08a3a", emit: 0.1 },
      M,
    );
    A.stone.put(T.box(0.07, 0.42, 0.07), [0, by + 1.42, fz - 0.15], 0, 1, { c: C.dressed, box: 1 }, M);
    A.stone.put(T.box(0.28, 0.07, 0.07), [0, by + 1.5, fz - 0.15], 0, 1, { c: C.dressed, box: 1 }, M);
    // Porte cintrée, rosace, contreforts, marches.
    A.main.put(T.boxB(0.7, 1.05, 0.06), [0, 0.1, fz + 0.01], 0, 1, { c: "#5a3a26" }, M);
    A.main.put(T.cyl(0.35, 0.35, 0.06, 12), [0, 1.15, fz + 0.01], [Math.PI / 2, 0, 0], [1, 1, 1], { c: "#5a3a26" }, M);
    A.stone.put(T.torus(0.42, 0.08, 4, 12, Math.PI), [0, 1.15, fz + 0.03], 0, 1, { c: C.dressed, box: 1 }, M);
    for (const s of [-1, 1]) A.stone.put(T.boxB(0.16, 1.15, 0.12), [s * 0.43, 0, fz + 0.03], 0, 1, { c: C.dressed, box: 1 }, M);
    A.main.put(T.cyl(0.2, 0.2, 0.05, 10), [0, Hh + 0.55, fz + 0.03], [Math.PI / 2, 0, 0], 1, { c: "#e8b84a", emit: 0.35 }, M);
    A.stone.put(T.torus(0.22, 0.05, 4, 12), [0, Hh + 0.55, fz + 0.05], 0, 1, { c: C.dressed, box: 1 }, M);
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) A.stone.put(T.boxB(0.3, 1.3, 0.35), [sx * (L / 2 + 0.05), 0, sz * (Ln / 2 - 0.1)], [0, 0, 0], 1, { c: C.graniteD, box: 1.2 }, M);
    for (let i = 0; i < 2; i++) A.stone.put(T.boxB(1.1 - i * 0.2, 0.1 * (i + 1), 0.35), [0, 0, fz + 0.35 - i * 0.18], 0, 1, { c: C.dressed, box: 1 }, M);
    const g = new THREE.Vector3(0, by + 0.5, fz - 0.15).applyMatrix4(M);
    glows.push({ mode: "glint", p: [g.x, g.y, g.z], size: 0.3, cell: "star", color: "#fff2c0", a: 1, add: 1, speed: 0.12, phase: rnd(), group: 0 });
  }

  /* ------------------------------------------------------------------ calvaire */
  function calvaire(A, e, rnd) {
    // Toujours de face (+Z) : la croix se lit mieux vue d'en haut que de profil.
    const M = worldAt(e);
    const c = { c: C.granite, box: 1.1, vj: 0.12, vs: 3 };
    for (let i = 0; i < 3; i++) A.stone.put(T.boxB(2.0 - i * 0.5, 0.3, 2.0 - i * 0.5), [0, i * 0.3, 0], [0, 0.02 * i, 0], 1, Object.assign({}, c, { c: i === 2 ? C.dressed : C.graniteD }), M);
    A.stone.put(T.cylB(0.2, 0.26, 2.3, 8), [0, 0.9, 0], 0, 1, c, M);
    A.stone.put(T.boxB(0.5, 0.2, 0.5), [0, 3.15, 0], 0, 1, c, M);
    A.stone.put(T.boxB(0.2, 1.25, 0.18), [0, 3.3, 0], 0, 1, c, M);
    A.stone.put(T.box(1.1, 0.18, 0.18), [0, 4.05, 0], 0, 1, c, M);
    for (const [x, y] of [
      [0.6, 4.05],
      [-0.6, 4.05],
      [0, 4.6],
    ])
      A.stone.put(T.sphere(0.13, 8, 6), [x, y, 0], 0, 1, c, M);
    // Christ stylisé (pierre plus claire) et deux personnages au pied du fût.
    A.stone.put(T.cylB(0.08, 0.1, 0.62, 6), [0, 3.55, 0.13], 0, 1, { c: C.dressed, box: 1 }, M);
    A.stone.put(T.sphere(0.09, 8, 6), [0, 4.25, 0.13], 0, 1, { c: C.dressed, box: 1 }, M);
    A.stone.put(T.box(0.8, 0.07, 0.07), [0, 4.02, 0.14], 0, 1, { c: C.dressed, box: 1 }, M);
    for (const s of [-1, 1]) {
      A.stone.put(T.cylB(0.1, 0.14, 0.55, 7), [s * 0.45, 0.9, 0.3], 0, 1, { c: C.dressed, box: 1 }, M);
      A.stone.put(T.sphere(0.1, 8, 6), [s * 0.45, 1.53, 0.3], 0, 1, { c: C.dressed, box: 1 }, M);
    }
    if (hasPlant()) {
      tree(A, "fern", 0, 0.95, 0, 0.95, 0.6, rnd, M);
      tree(A, "fern", 1, -0.95, 0, -0.9, 0.55, rnd, M);
    }
  }

  /* ------------------------------------------------------------------ meules de foin */
  const stackTpl = () =>
    P.tc("haystack", () =>
      P.fromGeo(
        new THREE.LatheGeometry(
          [
            [0.001, 0],
            [0.82, 0.02],
            [0.95, 0.35],
            [0.98, 0.8],
            [0.9, 1.25],
            [0.65, 1.65],
            [0.3, 1.95],
            [0.001, 2.08],
          ].map((p) => new THREE.Vector2(p[0], p[1])),
          12,
        ),
        "smooth",
      ),
    );
  function haystack(A, e, rnd) {
    const M = frame(e);
    const spots = [
      [-0.7, -0.5, 1],
      [0.75, -0.2, 0.85],
      [-0.1, 0.85, 0.7],
    ];
    const n = 2 + (rnd() < 0.6 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const [x, z, s] = spots[i];
      A.main.put(stackTpl(), [x, 0, z], [0, rnd() * TAU, 0], [s, s * (1.0 + rnd() * 0.15), s], { g: [C.hayD, C.hay, e.y, e.y + 1.6 * s], vj: 0.28, vs: 7, dark: 0.35, rim: 0.8 }, M);
      A.main.put(T.torus(0.93 * s, 0.035, 4, 16), [x, 0.7 * s, z], [Math.PI / 2, 0, 0], 1, { c: C.rope }, M);
      A.main.put(T.cylB(0.025, 0.03, 0.55 * s, 4), [x, 1.95 * s, z], 0, 1, { c: C.woodD }, M);
    }
    // Fourche plantée et un peu de foin au sol.
    A.main.put(T.cylB(0.025, 0.025, 1.5, 4), [0.95, 0, 0.8], [0.35, 0, -0.2], 1, { c: C.wood }, M);
    for (let i = 0; i < 6; i++) A.main.put(T.blade(0.2 * (rnd() - 0.5), 0.05, 2), [(rnd() - 0.5) * 2, 0, (rnd() - 0.5) * 2], [Math.PI / 2 - 0.2, rnd() * TAU, 0], [1, 0.5, 1], { c: C.hay }, M);
  }

  /* ------------------------------------------------------------------ puits */
  const ringTpl = () =>
    P.tc("wellRing", () =>
      P.fromGeo(
        new THREE.LatheGeometry(
          [
            [0.5, 0],
            [0.72, 0],
            [0.72, 0.8],
            [0.78, 0.8],
            [0.78, 0.92],
            [0.46, 0.92],
            [0.46, 0.3],
          ].map((p) => new THREE.Vector2(p[0], p[1])),
          14,
        ),
        "flat",
      ),
    );
  function well(A, e, rnd) {
    const M = frame(e);
    A.stone.put(ringTpl(), [0, 0, 0], 0, 1, { c: C.granite, box: 0.9, moss: ["#6f9a3a", 0.7, 0.95] }, M);
    A.main.put(T.disc(0.48, 14), [0, 0.35, 0], 0, 1, { c: C.water, emit: 0.1 }, M);
    for (const s of [-1, 1]) A.stone.put(T.boxB(0.2, 1.75, 0.22), [s * 0.7, 0.8, 0], 0, 1, { c: C.dressed, box: 1 }, M);
    A.main.put(T.cyl(0.08, 0.08, 1.3, 8), [0, 2.1, 0], [0, 0, Math.PI / 2], 1, { c: C.woodD }, M);
    A.main.put(T.box(0.05, 0.35, 0.05), [0.72, 2.0, 0.2], [0.5, 0, 0], 1, { c: C.woodD }, M);
    A.main.put(T.cylB(0.012, 0.012, 1.2, 4), [0.1, 0.9, 0], 0, 1, { c: "#d8c79a" }, M);
    A.main.put(T.cylB(0.13, 0.11, 0.24, 8), [0.1, 0.72, 0], 0, 1, { c: C.wood }, M);
    // Petit toit d'ardoise.
    for (const s of [-1, 1]) A.slate.put(T.box(1.9, 0.08, 0.75), [0, 2.6, s * 0.3], [s * 0.6, 0, 0], 1, { c: C.slate, box: 0.8 }, M);
    A.slate.put(T.box(1.95, 0.12, 0.12), [0, 2.82, 0], [Math.PI / 4, 0, 0], 1, { c: C.slateD, box: 0.8 }, M);
    if (hasPlant()) tree(A, "fern", 2, 0.8, 0, 0.7, 0.55, rnd, M);
    A.stone.put(T.boxB(0.9, 0.08, 0.6), [0, 0, 0.95], 0, 1, { c: C.dressed, box: 1 }, M);
  }

  /* ------------------------------------------------------------------ falaise */
  /** Bloc de granit aux arêtes arrondies et à la surface bosselée (base à y = 0, dessous retiré). */
  const slabTpl = (seed) =>
    P.tc("slab" + seed, () => {
      const t = P.fromGeo(new THREE.BoxGeometry(1, 1, 1, 4, 3, 4).translate(0, 0.5, 0), "smooth");
      const dirY = new Float32Array(t.n);
      P.deform(t, (x, y, z, i) => {
        dirY[i] = y < 0.01 ? -1 : 1;
        const n = K.noise.noise3(x * 3.1 + seed, y * 3.1, z * 3.1 - seed, seed | 0) - 0.5;
        const k = 1 + n * 0.22;
        // Arrondi des arêtes : on rapproche les coins du centre.
        const r = Math.max(Math.abs(x) * 2, Math.abs(z) * 2);
        const round = 1 - 0.12 * Math.pow(r, 4) * (0.4 + y);
        return [x * k * round, y * (1 + n * 0.12), z * k * round];
      });
      return P.cullBelow(t, dirY, 0);
    });
  function cliff(A, e, rnd) {
    const M = worldAt(e);
    const ar = arms(e);
    const ro = { c: "#9e978b", vj: 0.1, rim: 0.7, dark: 0.45, moss: ["#3f7424", 0.72, 0.98] };
    const H = 1.9 + rnd() * 0.3;
    // Table rocheuse qui remplit la case, prolongée vers les voisins reliés.
    A.rock.put(slabTpl(e.seed % 5), [0, -0.1, 0], [0, (rnd() - 0.5) * 0.5, 0], [2.7, H, 2.6], ro, M);
    for (const [dx, dz] of ar) A.rock.put(slabTpl((e.seed + 2) % 5), [dx * 1.35, -0.1, dz * 1.35], [0, Math.atan2(dx, dz), 0], [2.4, H * 0.96, 1.4], ro, M);
    // Gros rochers en bordure : le contour n'est plus carré.
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + 0.6 + (rnd() - 0.5) * 0.8;
      A.rock.put(T.rock(850 + i + (e.seed % 6), 1, 0.25), [Math.cos(a) * 1.35, H * 0.3, Math.sin(a) * 1.3], [0, rnd() * TAU, 0], [0.95, H * 0.42, 0.85], ro, M);
    }
    // Éboulis au pied, côté visible.
    for (let i = 0; i < 3; i++) A.rock.put(T.rock(830 + i + (e.seed % 4), 0, 0.3), [(rnd() - 0.5) * 2.4, 0.15, 1.45 + rnd() * 0.25], [0, rnd() * TAU, 0], [0.42, 0.34, 0.38], { c: "#a39c90", rim: 0.8, dark: 0.3 }, M);
    // Dessus herbu (lande) : chapeau d'herbe, ajoncs, bruyère, parfois un pin tordu.
    A.main.put(T.blob(840 + (e.seed % 3), 1, 0.08, 1.5, -0.2), [0, H - 0.12, 0], [0, rnd() * TAU, 0], [1.35, 0.22, 1.3], { g: [C.grassD, C.grass, e.y + H - 0.1, e.y + H + 0.2], vj: 0.12, rim: 0.4 }, M);
    if (hasPlant()) {
      if (rnd() < 0.8) tree(A, rnd() < 0.5 ? "gorse" : "heather", Math.floor(rnd() * 2), 0.5, H, -0.4, 0.9, rnd, M);
      if (rnd() < 0.6) tree(A, rnd() < 0.5 ? "pine" : "fir", Math.floor(rnd() * 3), -0.4, H, 0.2, 0.7, rnd, M);
      tree(A, "fern", Math.floor(rnd() * 2), 1.25, 0.05, 1.5, 0.7, rnd, M);
    }
  }

  /* ------------------------------------------------------------------ rochers de berge */
  function pondRocks(A, e, rnd) {
    const M = frame(e);
    const rock = (seed, x, y, z, s) =>
      A.rock.put(T.rock(seed, 1, 0.24), [x, y, z], [0, rnd() * TAU, 0], [s * 1.2, s * 0.7, s], { c: "#a39c90", box: 1.2, vj: 0.1, rim: 0.9, dark: 0.5, moss: ["#3f7424", 0.6, 0.95] }, M);
    rock(900 + (e.seed % 5), -0.5, -0.1, -0.3, 0.95);
    rock(910 + (e.seed % 5), 0.6, -0.3, 0.2, 0.75);
    rock(920 + (e.seed % 5), -0.1, -0.35, 0.95, 0.55);
    rock(930, 1.0, -0.4, -0.9, 0.45);
    if (hasPlant()) {
      tree(A, "reeds", Math.floor(rnd() * 4), 1.1, -0.5, 0.9, 0.9, rnd, M);
      tree(A, "cattail", Math.floor(rnd() * 3), -1.2, -0.5, 0.8, 0.9, rnd, M);
      tree(A, "lily", Math.floor(rnd() * 4), 0.2, -0.68, 1.35, 0.9, rnd, M);
    }
  }

  const BUILD = { talus, hedge, boulders, house, chapel, calvaire, haystack, well, cliff, pond_rocks: pondRocks };

  /** Un seul élément de décor à l'origine (compatibilité : préférer decorBatch pour toute la carte). */
  PTMT.models.decor = function (kind, seed, o) {
    return PTMT.models.decorBatch([Object.assign({ kind, x: 0, y: 0, z: 0, rot: 0, seed: seed | 0 }, o)]);
  };

  PTMT.models.decorBatch = function (entries) {
    entries = entries || [];
    const root = new THREE.Group();
    root.name = "ptmt-decor";
    const A = { stone: new P.Acc({ uv: true, seed: 31 }), slate: new P.Acc({ uv: true, seed: 32 }), rock: new P.Acc({ seed: 34 }), main: new P.Acc({ seed: 33 }) };
    const smoke = [];
    const glows = [];
    for (const e of entries) {
      const f = BUILD[e.kind];
      if (!f) continue;
      f(A, e, P.rng((e.seed | 0) + 101), smoke, glows);
    }
    const meshes = [];
    if (!A.stone.empty) meshes.push(P.mesh(A.stone, P.stoneMat(), { cast: true, name: "granit" }));
    if (!A.slate.empty) meshes.push(P.mesh(A.slate, P.slateMat(), { cast: true, name: "ardoises" }));
    if (!A.rock.empty) meshes.push(P.mesh(A.rock, P.rockMat(), { cast: true, name: "rochers" }));
    if (!A.main.empty) meshes.push(P.mesh(A.main, P.shared("decor", () => P.paint({ sway: true, lift: 0.15, rim: [0.04, 0.45, 0.6], name: "décor" })), { cast: true, name: "décor" }));
    for (const m of meshes) root.add(m);
    let fx = null;
    const specs = glows.slice();
    const rnd = P.rng(5);
    for (const s of smoke)
      for (let i = 0; i < 5; i++)
        specs.push({ mode: "smoke", p: s, size: 0.28, end: 0.95, rise: 2.5, drift: [0.7, -0.25], cell: "puff", color: "#f2f0ec", a: 0.75, add: 0, speed: 0.15 + rnd() * 0.03, phase: i / 5 + rnd() * 0.05, group: 1 });
    if (specs.length) {
      fx = P.fx(specs, { name: "fumées" });
      root.add(fx.mesh);
    }
    return {
      object: root,
      update(dt, time) {
        P.tick(time);
      },
      dispose() {
        if (root.parent) root.parent.remove(root);
        for (const m of meshes) m.geometry.dispose();
        if (fx) {
          fx.material.dispose();
          fx.mesh.geometry.dispose();
        }
      },
    };
  };
})();
