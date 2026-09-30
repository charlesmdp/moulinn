// « Pas touche à mes trésors » — forêts à couper et petits éléments de sol, en lots.
//
//   const forests = PTMT.models.forests(entries)
//     entries : [{ key, kind: "grass" | "rock" | "reeds" | "high", x, y, z (monde : centre de la case,
//                 y = dessus de la case), seed }]
//     → { object, cut(key) → Promise (la case tremble, ses arbres basculent et rapetissent en ~0,85 s,
//         copeaux et feuilles ; il reste des souches ou rien), clear(key) (efface les souches, p. ex. quand
//         une tour est construite sur la case), isCut(key), reset(), update(dt, time), dispose() }
//     grass : 2 à 4 arbres serrés (chênes, châtaigniers, sapins, pins, bouleaux), buissons, fougères ;
//     rock : rochers de granit moussus, pins, ajoncs en fleur, bruyère ; reeds : roseaux, massettes,
//     nénuphars sur l'eau ; high : comme grass, sur un tertre moussu. Chaque case est différente (seed).
//
//   const scatter = PTMT.models.scatter(entries)
//     entries : [{ kind: "flowers" | "tuft" | "pebbles" | "mushrooms" | "gorse" | "daisies" | "foxglove", x, y, z, seed }]
//     → { object, update(dt, time), dispose() }
//
// Toute la carte tient en un maillage par lot (un appel de dessin, plus son ombre) : chaque sommet
// connaît le pied de sa plante et sa case ; une petite texture d'états (une colonne par case) pilote le
// tremblement, la chute et l'effacement dans le shader, sans jamais reconstruire les lots.
(function () {
  "use strict";
  const PTMT = globalThis.PTMT;
  if (!PTMT || typeof THREE === "undefined" || !PTMT.models || !PTMT.models.props) return;
  const K = PTMT.models.kit;
  const P = PTMT.models.props;
  const { TAU, clamp, lerp, easeInOut } = K.math;
  const T = P.T;

  /* ------------------------------------------------------------------ pièces de plantes */
  /** Tronc effilé, légèrement courbé, évasé au pied (base à y = 0, sans fond). */
  function trunkTpl(h, r0, r1, bend, key) {
    return P.tc(`trunk${h},${r0},${r1},${bend},${key}`, () => {
      const t = P.fromGeo(new THREE.CylinderGeometry(r1, r0, h, 5, 2, true).translate(0, h / 2, 0), "smooth");
      return P.deform(t, (x, y, z) => {
        const v = y / h;
        const flare = 1 + 0.5 * Math.pow(Math.max(0, 1 - v * 3), 2);
        return [x * flare + bend * v * v, y, z * flare];
      });
    });
  }
  /** Souche : tronçon de tronc et sa coupe claire (rôle 1 : reste après la coupe). */
  function stump(A, r, h, bark) {
    A.put(T.cylB(r, r * 1.25, h, 6, true), [0, -0.05, 0], 0, 1, { c: bark, role: 1, rim: 0.4, ao: [0.6, 0, h] });
    A.put(T.disc(r * 0.98, 6), [0, h - 0.05, 0], 0, 1, { c: "#f0cf8a", role: 1, emit: 0.05 });
  }
  /** Houppier : amas de boules cabossées (dessous retiré), dégradé sombre en bas → clair en haut. */
  function crown(A, blobs, dark, light, y0, y1, rnd, o) {
    for (const b of blobs) {
      // Boule principale fine (icosaèdre subdivisé), satellites plus simples : ~120 triangles de moins par arbre.
      const detail = b[5] === undefined ? 1 : b[5];
      A.put(
        T.blob(b[4] === undefined ? Math.floor(rnd() * 30) : b[4], detail, detail ? 0.16 : 0.1, 1.8, -0.5),
        [b[0], b[1], b[2]],
        [rnd() * 0.4, rnd() * TAU, rnd() * 0.4],
        b[3],
        Object.assign({ g: [dark, light, y0, y1], vj: 0.12, vs: 1.5, dark: 0.3, sway: 1, rim: 1, role: 0 }, o),
      );
    }
  }
  /** Couronne de boules autour d'un centre (n satellites à distance d, rayons r). */
  function ring(rnd, n, cx, cy, cz, d, r, dy) {
    const out = [];
    const a0 = rnd() * TAU;
    for (let i = 0; i < n; i++) {
      const a = a0 + (i / n) * TAU + (rnd() - 0.5) * 0.5;
      out.push([cx + Math.cos(a) * d, cy + (rnd() - 0.5) * (dy || 0.4), cz + Math.sin(a) * d, r * (0.88 + rnd() * 0.24)]);
    }
    return out;
  }

  const SPECIES = {};
  const tplCache = new Map();
  /** Gabarit d'une plante (variante v), construit une fois. */
  function plant(name, v) {
    const key = name + ":" + v;
    let t = tplCache.get(key);
    if (!t) {
      const A = new P.Acc({ seed: v * 7 + name.length });
      SPECIES[name](A, P.rng(v * 977 + name.length * 31), v);
      t = A.toTpl();
      tplCache.set(key, t);
    }
    return t;
  }

  // Chêne : tronc gris-brun, houppier large et bosselé, vert profond.
  SPECIES.oak = (A, rnd, v) => {
    const h = 1.7 + rnd() * 0.4;
    const bend = 0.18 * (rnd() - 0.5);
    A.put(trunkTpl(h + 0.7, 0.26, 0.14, bend, v), 0, 0, 1, { g: ["#3e3022", "#6e5a42", 0, h], sway: 0.2, rim: 0.4, role: 0 });
    stump(A, 0.26, 0.34, "#4e3e2e");
    const cy = h + 1.05;
    const blobs = [[bend, cy, 0, 1.1]].concat(ring(rnd, 3, bend, cy - 0.15, 0, 0.88, 0.8), [[bend + 0.1, cy + 0.72, -0.1, 0.72]]);
    crown(A, blobs, "#123a10", "#4f8f24", cy - 0.95, cy + 1.25, rnd);
  };
  // Châtaignier : houppier rond et plus jaune, chatons clairs.
  SPECIES.chestnut = (A, rnd, v) => {
    const h = 1.5 + rnd() * 0.3;
    A.put(trunkTpl(h + 0.7, 0.28, 0.16, 0.12 * (rnd() - 0.5), v + 10), 0, 0, 1, { g: ["#34291f", "#5e4e3e", 0, h], sway: 0.2, rim: 0.4, role: 0 });
    stump(A, 0.28, 0.32, "#46382c");
    const cy = h + 1.12;
    const blobs = [[0, cy, 0, 1.18]].concat(ring(rnd, 3, 0, cy - 0.08, 0, 0.8, 0.8, 0.5));
    crown(A, blobs, "#1a4210", "#5e9428", cy - 1.0, cy + 1.15, rnd);
    for (let i = 0; i < 7; i++) {
      const a = rnd() * TAU,
        e = 0.2 + rnd() * 1.0;
      const r = 1.18;
      A.put(T.tet(0.09), [Math.cos(a) * Math.cos(e) * r, cy + Math.sin(e) * r * 0.85, Math.sin(a) * Math.cos(e) * r], [rnd() * 3, rnd() * 3, 0], [1, 1.6, 1], { c: "#f4e27a", emit: 0.2, sway: 1, role: 0 });
    }
  };
  // Sapin : étages de cônes vert sombre, silhouette pointue très lisible d'en haut.
  SPECIES.fir = (A, rnd, v) => {
    A.put(T.cylB(0.1, 0.17, 1.6, 5, true), 0, 0, 1, { c: "#4e3626", sway: 0.2, rim: 0.3, role: 0 });
    stump(A, 0.18, 0.3, "#4e3626");
    const tiers = 4 + (v % 2);
    const base = 0.75;
    for (let i = 0; i < tiers; i++) {
      const t = i / tiers;
      const r = 1.25 * (1 - t * 0.7);
      const y = base + i * 0.72;
      A.put(T.coneOpen(1, 1.45, 10), [0, y, 0], [0, rnd() * TAU, 0], [r, 1, r], { g: ["#0a3024", "#2f7a48", y + 0.1, y + 1.3], vj: 0.08, dark: 0.3, sway: 0.7, rim: 1, role: 0 });
    }
  };
  // Pin maritime : tronc orangé qui ondule, touffes aplaties en parasol.
  SPECIES.pine = (A, rnd, v) => {
    const h = 2.8 + rnd() * 0.5;
    const bend = (rnd() - 0.5) * 0.7;
    A.put(trunkTpl(h + 0.35, 0.17, 0.1, bend, v + 20), 0, 0, 1, { g: ["#5a3e2c", "#c8703a", 0.5, h], sway: 0.35, rim: 0.4, role: 0 });
    stump(A, 0.18, 0.3, "#6a4430");
    const blobs = [[bend, h + 0.35, 0, [0.95, 0.42, 0.95], undefined, 1]];
    for (const b of ring(rnd, 3, bend, h + 0.25, 0, 0.75, 0.72, 0.3)) blobs.push([b[0], b[1], b[2], [b[3], 0.38, b[3]], undefined, 1]);
    crown(A, blobs, "#0c2e1c", "#357a3a", h - 0.2, h + 0.9, rnd, { dark: 0.4 });
  };
  // Bouleau : tronc blanc tacheté, houppier léger vert tendre.
  SPECIES.birch = (A, rnd, v) => {
    const h = 2.3 + rnd() * 0.4;
    const bend = (rnd() - 0.5) * 0.4;
    A.put(trunkTpl(h + 0.9, 0.14, 0.07, bend, v + 30), 0, 0, 1, { c: "#f4f1ea", sway: 0.3, rim: 0.3, role: 0 });
    for (let i = 0; i < 3; i++) {
      const y = 0.45 + i * 0.62 + rnd() * 0.15;
      const t = y / (h + 0.9);
      A.put(T.box(0.2, 0.06, 0.05), [bend * t * t, y, 0.08], [0, rnd() * 0.6 - 0.3, 0], [1 - t * 0.5, 1, 1], { c: "#24201c", sway: 0.3, role: 0 });
    }
    stump(A, 0.15, 0.3, "#e8e4da");
    const blobs = [[bend, h + 0.9, 0, [0.64, 0.8, 0.64]]].concat(ring(rnd, 2, bend, h + 0.72, 0, 0.5, 0.58, 0.6));
    crown(A, blobs, "#2a6418", "#8cc03c", h + 0.1, h + 1.8, rnd);
  };
  // Buisson (noisetier, aubépine) : quelques boules basses, parfois des baies ou des fleurs.
  SPECIES.bush = (A, rnd, v) => {
    const n = 2;
    const blobs = [[0, 0.45, 0, [0.62, 0.52, 0.62]]];
    for (const b of ring(rnd, n, 0, 0.4, 0, 0.42, 0.5, 0.2)) blobs.push([b[0], b[1], b[2], [b[3], b[3] * 0.82, b[3]]]);
    crown(A, blobs, "#133a10", "#4a8a26", 0.0, 1.0, rnd, { sway: 0.8 });
    if (v % 2 === 0)
      for (let i = 0; i < 7; i++) {
        const a = rnd() * TAU;
        A.put(T.tet(0.07), [Math.cos(a) * 0.62, 0.6 + rnd() * 0.3, Math.sin(a) * 0.55], [rnd() * 3, rnd() * 3, 0], 1, { c: v % 4 ? "#ffffff" : "#e0203a", emit: 0.25, sway: 0.8, role: 0 });
      }
  };
  // Fougère : frondes arquées vert vif.
  SPECIES.fern = (A, rnd, v) => {
    const n = 5 + (v % 2);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rnd() * 0.5;
      A.put(T.frond(0.8 + rnd() * 0.25, 0.32 + rnd() * 0.12, 2), [0, 0.02, 0], [0, a, 0], 1, { g: ["#2a6e1e", "#96d443", 0, 0.45], sway: 1.3, rim: 0.3, role: 0, vj: 0.1 });
    }
  };
  // Rocher de granit moussu (rôle 2 : s'enfonce à la coupe) — lot « granit » (texture mouchetée).
  SPECIES.boulder = (A, rnd, v) => {
    const s = 0.75 + rnd() * 0.35;
    A.put(T.rock(200 + v, 1, 0.3), [0, s * 0.4, 0], [0, rnd() * TAU, 0], [s * 1.15, s * 0.8, s], { c: "#9c958a", vj: 0.12, vs: 2.2, moss: ["#3f7424", 0.5, 0.95], dark: 0.4, rim: 0.9, role: 2 });
    if (v % 2)
      A.put(T.rock(240 + v, 0, 0.3), [s * 0.9, s * 0.18, s * 0.35], [0, rnd() * TAU, 0], [s * 0.5, s * 0.4, s * 0.45], { c: "#948d82", vj: 0.12, moss: ["#3f7424", 0.55, 0.95], dark: 0.3, rim: 0.8, role: 2 });
  };
  // Pierres qui affleurent autour du tertre des buttes (lot « granit »).
  SPECIES.moundRocks = (A, rnd, v) => {
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + rnd();
      A.put(T.rock(420 + v * 4 + i, 0, 0.3), [Math.cos(a) * 1.35, 0.05, Math.sin(a) * 1.25], [0, rnd() * TAU, 0], [0.34, 0.26, 0.3], { c: "#9c958a", moss: ["#3f7424", 0.5, 0.95], rim: 0.8, dark: 0.3, role: 2 });
    }
  };
  // Ajonc en fleur : boule épineuse vert sombre piquée de jaune d'or.
  SPECIES.gorse = (A, rnd, v) => {
    const n = 1 + (v % 2);
    for (let i = 0; i < n; i++) {
      const a = rnd() * TAU,
        d = i ? 0.35 : 0;
      const r = 0.46 + rnd() * 0.12;
      const x = Math.cos(a) * d,
        z = Math.sin(a) * d;
      A.put(T.blob(300 + v * 3 + i, i ? 0 : 1, i ? 0.15 : 0.3, 3.4, -0.5), [x, r * 0.7, z], [0, rnd() * TAU, 0], [r, r * 0.85, r], { g: ["#173e16", "#3f7424", 0, 0.9], vj: 0.1, dark: 0.3, sway: 0.5, rim: 1, role: 0 });
      for (let k = 0; k < 8; k++) {
        const u = rnd() * TAU,
          e = rnd() * 1.2;
        A.put(T.tet(0.08), [x + Math.cos(u) * Math.cos(e) * r * 0.98, r * 0.7 + Math.sin(e) * r * 0.83, z + Math.sin(u) * Math.cos(e) * r * 0.98], [rnd() * 3, rnd() * 3, 0], 1, { c: k % 3 ? "#ffcc12" : "#ffe45a", emit: 0.35, sway: 0.5, role: 0 });
      }
    }
  };
  // Bruyère : coussins bas rose-mauve.
  SPECIES.heather = (A, rnd, v) => {
    for (let i = 0; i < 3; i++) {
      const a = rnd() * TAU,
        d = i ? 0.3 : 0;
      A.put(T.blob(330 + i + v, i ? 0 : 1, 0.2, 3, -0.3), [Math.cos(a) * d, 0.1, Math.sin(a) * d], 0, [0.34, 0.22, 0.32], { g: ["#5a2a4a", "#e070b8", 0, 0.3], vj: 0.15, sway: 0.4, rim: 0.8, role: 0, emit: 0.05 });
    }
  };
  // Roseaux : gerbe de lames jaune-vert.
  SPECIES.reeds = (A, rnd, v) => {
    const n = 13 + (v % 3);
    for (let i = 0; i < n; i++) {
      const a = rnd() * TAU,
        d = Math.sqrt(rnd()) * 0.42;
      A.put(T.blade(0.3 * (rnd() - 0.5), 0.075, 2), [Math.cos(a) * d, -0.1, Math.sin(a) * d], [(rnd() - 0.5) * 0.45, rnd() * TAU, (rnd() - 0.5) * 0.45], [1, 1.2 + rnd() * 0.7, 1], {
        g: ["#2f6a1c", "#c8c452", 0, 1.8],
        sway: 1.4,
        role: 0,
      });
    }
  };
  // Massettes : tiges et épis bruns.
  SPECIES.cattail = (A, rnd, v) => {
    const n = 3 + (v % 2);
    for (let i = 0; i < n; i++) {
      const a = rnd() * TAU,
        d = rnd() * 0.25;
      const h = 1.3 + rnd() * 0.5;
      const x = Math.cos(a) * d,
        z = Math.sin(a) * d,
        tilt = (rnd() - 0.5) * 0.15;
      A.put(T.cylB(0.02, 0.028, h, 3, true), [x, -0.1, z], [tilt, 0, tilt], 1, { c: "#5f8a32", sway: 1.2, role: 0 });
      A.put(T.cylB(0.075, 0.075, 0.32, 5), [x + tilt * h, h - 0.44, z - tilt * h], [tilt, 0, tilt], 1, { c: "#6a3818", sway: 1.2, rim: 0.6, role: 0, vj: 0.1 });
    }
    for (let i = 0; i < 4; i++) A.put(T.blade(0.25 * (rnd() - 0.5), 0.055, 2), [0, -0.1, 0], [0, rnd() * TAU, (rnd() - 0.5) * 0.3], [1, 1.1 + rnd() * 0.5, 1], { g: ["#34641e", "#9ab84a", 0, 1.4], sway: 1.3, role: 0 });
  };
  // Nénuphar : feuille ronde échancrée à fleur d'eau, parfois une fleur.
  const padTpl = (r) => P.tc(`pad${r}`, () => P.fromGeo(new THREE.CircleGeometry(r, 9, 0.35, TAU - 0.7).rotateX(-Math.PI / 2)));
  SPECIES.lily = (A, rnd, v) => {
    const n = 2 + (v % 2);
    for (let i = 0; i < n; i++) {
      const a = rnd() * TAU,
        d = i ? 0.45 + rnd() * 0.2 : 0;
      const r = 0.3 + rnd() * 0.14;
      const x = Math.cos(a) * d,
        z = Math.sin(a) * d;
      A.put(padTpl(r), [x, 0.02 + i * 0.004, z], [0, rnd() * TAU, 0], 1, { g: ["#2a7a2c", "#6fbc44", -0.2, 0.2], vj: 0.14, vs: 4, sway: 0.15, rim: 0, role: 0 });
      if (i === 0 && v % 2 === 0) A.put(T.flower(7, 0.2, 0.08, v % 4 ? "#ffc4e0" : "#ffffff", "#ffd21f"), [x, 0.05, z], [0, rnd(), 0], 1, { emit: 0.2, role: 0 });
    }
  };
  // Tertre moussu des buttes boisées (rôle 2).
  SPECIES.mound = (A, rnd, v) => {
    A.put(T.blob(400 + v, 1, 0.12, 1.4, -0.3), [0, -0.05, 0], [0, rnd() * TAU, 0], [1.65, 0.38, 1.55], { g: ["#4a7426", "#78a83a", -0.1, 0.35], vj: 0.14, rim: 0.6, role: 2 });
  };
  const VARIANTS = { oak: 4, chestnut: 3, fir: 3, pine: 3, birch: 3, bush: 4, fern: 2, boulder: 4, gorse: 3, heather: 2, reeds: 3, cattail: 2, lily: 4, mound: 2, moundRocks: 2 };
  const ROCKY = { boulder: 1, moundRocks: 1 };
  // Partagés avec le décor des cases X (talus plantés, haies, berges).
  P.plant = plant;
  P.PLANT_VARIANTS = VARIANTS;

  /* ------------------------------------------------------------------ composition d'une case */
  // Motifs de placement des arbres (positions relatives, en fraction de la demi-case).
  const PATTERNS = {
    2: [
      [
        [-0.42, -0.3],
        [0.4, 0.28],
      ],
      [
        [-0.35, 0.3],
        [0.42, -0.32],
      ],
    ],
    3: [
      [
        [-0.45, -0.38],
        [0.45, -0.3],
        [0.0, 0.42],
      ],
      [
        [-0.48, 0.1],
        [0.3, -0.45],
        [0.42, 0.42],
      ],
    ],
    4: [
      [
        [-0.45, -0.42],
        [0.45, -0.45],
        [-0.42, 0.42],
        [0.46, 0.4],
      ],
    ],
  };
  const pick = (rnd, table) => {
    let s = 0;
    for (const k in table) s += table[k];
    let r = rnd() * s;
    for (const k in table) {
      r -= table[k];
      if (r <= 0) return k;
    }
    return Object.keys(table)[0];
  };
  const _M = new THREE.Matrix4(),
    _Q = new THREE.Quaternion(),
    _S = new THREE.Vector3(),
    _Pp = new THREE.Vector3(),
    _up = new THREE.Vector3(0, 1, 0);
  function tint(rnd, amt) {
    const a = amt || 0.1;
    const l = 1 + (rnd() - 0.5) * a * 2;
    return new THREE.Color(l * (1 + (rnd() - 0.5) * a * 0.6), l * (1 + (rnd() - 0.5) * a * 0.3), l * (1 + (rnd() - 0.5) * a * 0.6));
  }
  function place(A, name, v, x, y, z, yaw, s, o) {
    _Q.setFromAxisAngle(_up, yaw);
    _S.set(s, s, s);
    _Pp.set(x, y, z);
    _M.compose(_Pp, _Q, _S);
    A.add(plant(name, v), _M, Object.assign({ pivot: [x, y, z] }, o));
  }
  const HALF = P.TILE / 2;
  /** Remplit une case : plantes dans A (couleurs de sommets), rochers dans R (granit texturé). */
  function fillTile(A0, R, e, idx) {
    const A = { add: (t, m, o) => (o && o._rock ? R : A0).add(t, m, o) };
    const rnd = P.rng((e.seed | 0) + 1);
    const o = { tile: idx };
    const put = (name, fx, fz, s, extraY) => {
      const v = Math.floor(rnd() * VARIANTS[name]);
      o.tint = tint(rnd, ROCKY[name] ? 0.06 : 0.09);
      o._rock = !!ROCKY[name];
      place(A, name, v, e.x + fx * HALF, e.y + (extraY || 0), e.z + fz * HALF, rnd() * TAU, s, o);
    };
    const jitter = (p, j) => [p[0] + (rnd() - 0.5) * j, p[1] + (rnd() - 0.5) * j];
    const rotPat = (pat) => {
      const q = Math.floor(rnd() * 4);
      return pat.map(([a, b]) => (q === 0 ? [a, b] : q === 1 ? [-b, a] : q === 2 ? [-a, -b] : [b, -a]));
    };
    const kind = e.kind;
    if (kind === "grass" || kind === "high") {
      // Butte boisée : les arbres sortent du tertre (pied au niveau de la case : les souches restent au sol).
      const lift = 0;
      if (kind === "high") {
        put("mound", 0, 0, 1, 0);
        put("moundRocks", 0, 0, 1, 0);
      }
      const n = kind === "high" ? (rnd() < 0.6 ? 3 : 2) : rnd() < 0.1 ? 2 : rnd() < 0.65 ? 3 : 4;
      const pats = PATTERNS[n];
      const pat = rotPat(pats[Math.floor(rnd() * pats.length)]);
      const table = kind === "high" ? { fir: 4, oak: 3, pine: 2, chestnut: 1 } : { oak: 4, chestnut: 3, fir: 2, birch: 2, pine: 1 };
      for (const p of pat) {
        const [fx, fz] = jitter(p, 0.18);
        const sp = pick(rnd, table);
        const sc = (n === 4 ? 0.86 : n === 3 ? 0.96 : 1.06) + rnd() * 0.18;
        put(sp, fx, fz, sc, lift);
      }
      // Sous-bois : buissons et fougères dans les trous, surtout sur le devant (visible).
      const under = 2 + Math.floor(rnd() * 2);
      for (let i = 0; i < under; i++) {
        const fx = (rnd() - 0.5) * 1.5,
          fz = 0.25 + rnd() * 0.6;
        put(rnd() < 0.55 ? "fern" : "bush", fx, fz, 0.8 + rnd() * 0.35, lift);
      }
    } else if (kind === "rock") {
      // Quatre coins : deux rochers, un pin, puis un troisième rocher ou un second conifère ;
      // ajoncs et bruyère dans les creux (jamais au pied d'un rocher).
      const pat = rotPat(PATTERNS[4][0]);
      const pts = pat.map((p) => jitter(p, 0.2));
      put("boulder", pts[0][0], pts[0][1], 0.95 + rnd() * 0.45);
      put("boulder", pts[1][0], pts[1][1], 0.85 + rnd() * 0.4);
      put(rnd() < 0.65 ? "pine" : "fir", pts[2][0], pts[2][1], 0.85 + rnd() * 0.2);
      if (rnd() < 0.5) put("boulder", pts[3][0], pts[3][1], 0.7 + rnd() * 0.3);
      else put(rnd() < 0.5 ? "fir" : "pine", pts[3][0], pts[3][1], 0.75 + rnd() * 0.2);
      for (let i = 0; i < 2; i++) {
        const q = pts[2 + i];
        put("gorse", q[0] * 0.2 + (rnd() - 0.5) * 0.4, q[1] * 0.2 + 0.45 + rnd() * 0.3, 0.9 + rnd() * 0.3);
      }
      if (rnd() < 0.7) put("heather", (rnd() - 0.5) * 0.8, (rnd() - 0.5) * 0.8, 1);
    } else if (kind === "reeds") {
      // Roselière dense : gerbes aux quatre coins, au centre et entre deux, massettes, nénuphars devant.
      const pat = rotPat(PATTERNS[4][0]);
      for (const p of pat) {
        const [fx, fz] = jitter(p, 0.25);
        put(rnd() < 0.72 ? "reeds" : "cattail", fx, fz, 1.0 + rnd() * 0.35);
      }
      put("reeds", (rnd() - 0.5) * 0.3, (rnd() - 0.5) * 0.3, 1.25);
      put(rnd() < 0.5 ? "reeds" : "cattail", (rnd() < 0.5 ? -1 : 1) * 0.5, (rnd() - 0.5) * 0.4, 1.0 + rnd() * 0.2);
      for (let i = 0; i < 3 + Math.floor(rnd() * 2); i++) put("lily", (rnd() - 0.5) * 1.5, 0.1 + (rnd() - 0.3) * 1.3, 0.95 + rnd() * 0.35);
    }
  }

  /* ------------------------------------------------------------------ copeaux (lot instancié) */
  const CHIPS = 48;
  function makeChips() {
    const geo = new THREE.BoxGeometry(0.16, 0.05, 0.1);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.8 });
    const mesh = new THREE.InstancedMesh(geo, mat, CHIPS);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const cWood = P.MILL_COLORS ? K.col("#e8c890") : K.col("#e8c890");
    for (let i = 0; i < CHIPS; i++) mesh.setColorAt(i, i % 3 === 0 ? K.col("#5aa83a") : i % 3 === 1 ? cWood : K.col("#8fc84a"));
    mesh.count = 0;
    mesh.visible = false;
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.name = "copeaux";
    const st = { p: new Float32Array(CHIPS * 3), v: new Float32Array(CHIPS * 3), r: new Float32Array(CHIPS * 3), age: new Float32Array(CHIPS).fill(9), next: 0 };
    return { mesh, st };
  }

  /* ------------------------------------------------------------------ forêts */
  PTMT.models.forests = function (entries) {
    entries = entries || [];
    const N = Math.max(1, entries.length);
    const root = new THREE.Group();
    root.name = "ptmt-forests";
    const index = new Map();
    const A = new P.Acc({ seed: 3 }),
      R = new P.Acc({ seed: 4 });
    entries.forEach((e, i) => {
      index.set(String(e.key), i);
      fillTile(A, R, e, i);
    });
    // Texture d'états : une colonne par case (r tremblement, g chute, b effacement des souches).
    const data = new Uint8Array(N * 4);
    const cutTex = new THREE.DataTexture(data, N, 1, THREE.RGBAFormat);
    cutTex.magFilter = cutTex.minFilter = THREE.NearestFilter;
    cutTex.generateMipmaps = false;
    cutTex.needsUpdate = true;
    const mat = P.paint({ sway: true, cut: { tex: cutTex, n: N }, lift: 0.1, rim: [0.18, 0.52, 0.8], name: "forêts" });
    const rmat = P.rockMat({ cut: { tex: cutTex, n: N }, name: "rochers des forêts" });
    const meshes = [];
    if (!A.empty) meshes.push(P.mesh(A, mat, { cast: true, name: "forêts" }));
    if (!R.empty) meshes.push(P.mesh(R, rmat, { cast: true, name: "rochers des forêts" }));
    for (const m of meshes) root.add(m);
    const chips = makeChips();
    root.add(chips.mesh);
    const anims = new Map(); // indice → { t, resolve, kind: "cut" | "clear" }
    const cut = new Uint8Array(N);
    const cleared = new Uint8Array(N);
    const centers = entries.map((e) => [e.x, e.y, e.z, e.kind]);
    const setTex = (i, r, g, b) => {
      data[i * 4] = clamp(Math.round(r * 255), 0, 255);
      data[i * 4 + 1] = clamp(Math.round(g * 255), 0, 255);
      data[i * 4 + 2] = clamp(Math.round(b * 255), 0, 255);
      data[i * 4 + 3] = 255;
      cutTex.needsUpdate = true;
    };
    function burst(i) {
      const [x, y, z, kind] = centers[i];
      const cs = chips.st;
      const n = kind === "reeds" ? 10 : 16;
      for (let k = 0; k < n; k++) {
        const j = cs.next;
        cs.next = (cs.next + 1) % CHIPS;
        const a = Math.random() * TAU,
          d = Math.random() * 1.2;
        cs.p[j * 3] = x + Math.cos(a) * d;
        cs.p[j * 3 + 1] = y + 0.4 + Math.random() * 1.5;
        cs.p[j * 3 + 2] = z + Math.sin(a) * d;
        cs.v[j * 3] = Math.cos(a) * (1.5 + Math.random() * 2);
        cs.v[j * 3 + 1] = 3 + Math.random() * 3;
        cs.v[j * 3 + 2] = Math.sin(a) * (1.5 + Math.random() * 2);
        cs.r[j * 3] = Math.random() * 6;
        cs.r[j * 3 + 1] = Math.random() * 6;
        cs.r[j * 3 + 2] = y;
        cs.age[j] = 0;
      }
    }
    const _o = new THREE.Object3D();
    return {
      object: root,
      keys: entries.map((e) => String(e.key)),
      cut(key) {
        const i = index.get(String(key));
        if (i === undefined || cut[i]) return Promise.resolve(false);
        cut[i] = 1;
        return new Promise((resolve) => anims.set(i, { t: 0, resolve, kind: "cut", burst: false }));
      },
      clear(key) {
        const i = index.get(String(key));
        if (i === undefined || cleared[i]) return;
        cleared[i] = 1;
        if (!cut[i]) {
          cut[i] = 1;
          setTex(i, 0, 1, 1);
          return;
        }
        if (!anims.has(i)) anims.set(i, { t: 0, kind: "clear" });
      },
      isCut(key) {
        const i = index.get(String(key));
        return i !== undefined && !!cut[i];
      },
      reset() {
        for (const a of anims.values()) if (a.resolve) a.resolve(false);
        anims.clear();
        cut.fill(0);
        cleared.fill(0);
        data.fill(0);
        cutTex.needsUpdate = true;
      },
      update(dt, time) {
        if (dt > 0.1) dt = 0.1;
        if (dt < 0) dt = 0;
        P.tick(time);
        for (const [i, a] of anims) {
          a.t += dt;
          if (a.kind === "cut") {
            // 0–0,25 s : la case tremble ; 0,25–0,85 s : bascule et rapetisse.
            const shake = a.t < 0.25 ? a.t / 0.25 : Math.max(0, 1 - (a.t - 0.25) / 0.3);
            const fall = easeInOut(clamp((a.t - 0.22) / 0.63, 0, 1));
            if (!a.burst && a.t > 0.3) {
              a.burst = true;
              burst(i);
            }
            setTex(i, shake, fall, 0);
            if (a.t >= 0.85) {
              setTex(i, 0, 1, 0);
              anims.delete(i);
              a.resolve(true);
            }
          } else {
            const k = clamp(a.t / 0.4, 0, 1);
            setTex(i, 0, 1, k * k);
            if (k >= 1) anims.delete(i);
          }
        }
        // Copeaux et feuilles : chute libre, rebond mou, disparition.
        const cs = chips.st;
        let alive = 0;
        for (let j = 0; j < CHIPS; j++) {
          if (cs.age[j] > 1.4) continue;
          cs.age[j] += dt;
          cs.v[j * 3 + 1] -= 14 * dt;
          cs.p[j * 3] += cs.v[j * 3] * dt;
          cs.p[j * 3 + 1] += cs.v[j * 3 + 1] * dt;
          cs.p[j * 3 + 2] += cs.v[j * 3 + 2] * dt;
          if (cs.p[j * 3 + 1] < cs.r[j * 3 + 2] + 0.03) {
            cs.p[j * 3 + 1] = cs.r[j * 3 + 2] + 0.03;
            cs.v[j * 3] *= 0.5;
            cs.v[j * 3 + 1] *= -0.25;
            cs.v[j * 3 + 2] *= 0.5;
          }
          const s = cs.age[j] < 1.1 ? 1 : Math.max(0.001, 1 - (cs.age[j] - 1.1) / 0.3);
          _o.position.set(cs.p[j * 3], cs.p[j * 3 + 1], cs.p[j * 3 + 2]);
          _o.rotation.set(cs.r[j * 3] + cs.age[j] * 9, cs.r[j * 3 + 1] + cs.age[j] * 7, 0);
          _o.scale.setScalar(s);
          _o.updateMatrix();
          chips.mesh.setMatrixAt(alive, _o.matrix);
          chips.mesh.setColorAt(alive, j % 3 === 0 ? K.col("#5aa83a") : j % 3 === 1 ? K.col("#e8c890") : K.col("#8fc84a"));
          alive++;
        }
        chips.mesh.count = alive;
        chips.mesh.visible = alive > 0;
        if (alive) {
          chips.mesh.instanceMatrix.needsUpdate = true;
          if (chips.mesh.instanceColor) chips.mesh.instanceColor.needsUpdate = true;
        }
      },
      dispose() {
        if (root.parent) root.parent.remove(root);
        for (const m of meshes) m.geometry.dispose();
        for (const m of [mat, rmat]) {
          m.dispose();
          if (m.userData.depth) m.userData.depth.dispose();
        }
        cutTex.dispose();
        chips.mesh.geometry.dispose();
        chips.mesh.material.dispose();
      },
    };
  };

  /** Une seule case boisée à l'origine (compatibilité : préférer forests pour toute la carte). */
  PTMT.models.forest = function (kind, seed) {
    const b = PTMT.models.forests([{ key: "0", kind, x: 0, y: 0, z: 0, seed: seed | 0 }]);
    return { object: b.object, cut: () => b.cut("0"), clear: () => b.clear("0"), update: b.update, dispose: b.dispose };
  };

  /* ------------------------------------------------------------------ petits éléments de sol */
  // Très peu de triangles (≈ 40 à 90 par élément) : fleurs à plat face au ciel, lames croisées.
  const SMALL = {};
  const leaves = (A, rnd, n, h, c0, c1) => {
    for (let i = 0; i < n; i++) A.put(T.blade(0.1 * (rnd() - 0.5), 0.05, 2), [(rnd() - 0.5) * 0.1, 0, (rnd() - 0.5) * 0.1], [0, rnd() * TAU, (rnd() - 0.5) * 0.8], [1, h * (0.7 + rnd() * 0.5), 1], { g: [c0, c1, 0, h], sway: 1.2 });
  };
  // Fleurs des champs : coquelicots, boutons d'or, bleuets, marguerites.
  SMALL.flowers = (A, rnd, v) => {
    const cols = [
      ["#ff2a1a", "#241410"],
      ["#ffd21a", "#f08a10"],
      ["#3a6aff", "#ffffff"],
      ["#ffffff", "#ffc81a"],
    ];
    leaves(A, rnd, 3, 0.26, "#3a7424", "#7fbc44");
    const n = 4 + (v % 2);
    for (let i = 0; i < n; i++) {
      const a = rnd() * TAU,
        d = 0.08 + rnd() * 0.22;
      const c = cols[(v + (i % 2) * 2) % 4];
      A.put(T.flower(5, 0.075, 0.02, c[0], c[1]), [Math.cos(a) * d, 0.2 + rnd() * 0.14, Math.sin(a) * d], [0, rnd() * TAU, 0], 1, { emit: 0.22, sway: 1.2 });
    }
  };
  // Touffe d'herbe haute.
  SMALL.tuft = (A, rnd, v) => leaves(A, rnd, 6, 0.42, v % 2 ? "#356c20" : "#3f7a26", v % 2 ? "#a4d456" : "#8cc44c");
  // Cailloux.
  SMALL.pebbles = (A, rnd, v) => {
    // Gris sombre : les cailloux ne doivent pas briller plus que le sol.
    const n = 3 + (v % 2);
    for (let i = 0; i < n; i++) {
      const s = 0.09 + rnd() * 0.12;
      A.put(T.rock(500 + v * 5 + i, 0, 0.25), [(rnd() - 0.5) * 0.5, s * 0.22, (rnd() - 0.5) * 0.5], [0, rnd() * TAU, 0], [s * 1.2, s * 0.65, s], { c: i % 2 ? "#8a847a" : "#6f6a62", vj: 0.1, rim: 0.7, dark: 0.3 });
    }
  };
  // Amanites (chapeau rouge à pois blancs) ou cèpes.
  SMALL.mushrooms = (A, rnd, v) => {
    const red = v % 3 !== 2;
    const n = 2 + (v % 2);
    for (let i = 0; i < n; i++) {
      const s = 0.85 + rnd() * 0.5;
      const x = (rnd() - 0.5) * 0.3,
        z = (rnd() - 0.5) * 0.3;
      A.put(T.cylB(0.04 * s, 0.05 * s, 0.14 * s, 4, true), [x, 0, z], 0, 1, { c: "#f6f0e2" });
      A.put(T.dome(0.12 * s, 7, 2), [x, 0.12 * s, z], [(rnd() - 0.5) * 0.3, 0, (rnd() - 0.5) * 0.3], [1, 0.72, 1], { c: red ? "#e8201e" : "#8a5226", emit: red ? 0.18 : 0.05, rim: 0.6 });
      if (red)
        for (let k = 0; k < 2; k++) {
          const a = rnd() * TAU;
          A.put(T.tet(0.025 * s), [x + Math.cos(a) * 0.06 * s, 0.19 * s, z + Math.sin(a) * 0.06 * s], [rnd(), rnd(), 0], 1, { c: "#ffffff", emit: 0.2 });
        }
    }
  };
  SMALL.gorse = (A, rnd, v) => {
    const r = 0.26 + rnd() * 0.1;
    A.put(T.blob(310 + v, 1, 0.3, 3.4, -0.4), [0, r * 0.7, 0], [0, rnd() * TAU, 0], [r, r * 0.85, r], { g: ["#173e16", "#3f7424", 0, 0.5], vj: 0.1, sway: 0.4, rim: 1, dark: 0.3 });
    for (let k = 0; k < 7; k++) {
      const u = rnd() * TAU,
        e = rnd() * 1.1;
      A.put(T.tet(0.055), [Math.cos(u) * Math.cos(e) * r, r * 0.7 + Math.sin(e) * r * 0.85, Math.sin(u) * Math.cos(e) * r], [rnd() * 3, rnd() * 3, 0], 1, { c: "#ffcc12", emit: 0.35, sway: 0.4 });
    }
  };
  // Pâquerettes à ras de l'herbe.
  SMALL.daisies = (A, rnd, v) => {
    const n = 5 + (v % 2);
    for (let i = 0; i < n; i++) A.put(T.flower(6, 0.06, 0.012, "#ffffff", "#ffd21a"), [(rnd() - 0.5) * 0.6, 0.05, (rnd() - 0.5) * 0.6], [0, rnd() * TAU, 0], 1, { emit: 0.15 });
    A.put(T.flower(4, 0.13, 0.02, "#4a9a2e", "#2f7a20"), [0, 0.02, 0], [0, rnd() * TAU, 0], 1, {});
  };
  // Digitales pourpres (très bretonnes au bord des chemins).
  SMALL.foxglove = (A, rnd, v) => {
    const n = 1 + (v % 2);
    for (let i = 0; i < n; i++) {
      const x = (rnd() - 0.5) * 0.35,
        z = (rnd() - 0.5) * 0.35;
      const h = 0.8 + rnd() * 0.35;
      A.put(T.cylB(0.015, 0.022, h, 3, true), [x, 0, z], 0, 1, { c: "#4f7a2a", sway: 1 });
      for (let k = 0; k < 6; k++) {
        const t = k / 6;
        const a = k * 2.4;
        A.put(T.tet(0.075 * (1 - t * 0.45)), [x + Math.cos(a) * 0.04, h * (0.45 + t * 0.52), z + Math.sin(a) * 0.04], [rnd() * 3, a, 0], [1, 1.3, 1], { c: t > 0.7 ? "#f0a8e0" : "#d23aa2", emit: 0.18, sway: 1 });
      }
    }
    A.put(T.flower(5, 0.22, 0.04, "#3f7a2a", "#2c5e1e"), [0, 0.02, 0], [0, rnd() * TAU, 0], 1, {});
  };
  const SMALL_VAR = { flowers: 4, tuft: 4, pebbles: 3, mushrooms: 3, gorse: 3, daisies: 3, foxglove: 3 };
  const smallCache = new Map();
  function small(kind, v) {
    const k = kind + ":" + v;
    let t = smallCache.get(k);
    if (!t) {
      const A = new P.Acc({ seed: v + 91 });
      SMALL[kind](A, P.rng(v * 131 + kind.length * 7), v);
      t = A.toTpl();
      smallCache.set(k, t);
    }
    return t;
  }

  PTMT.models.scatter = function (entries) {
    entries = entries || [];
    const root = new THREE.Group();
    root.name = "ptmt-scatter";
    const A = new P.Acc({ seed: 8 });
    for (const e of entries) {
      if (!SMALL[e.kind]) continue;
      const rnd = P.rng((e.seed | 0) + 7);
      const v = Math.floor(rnd() * SMALL_VAR[e.kind]);
      const s = 0.85 + rnd() * 0.35;
      _Q.setFromAxisAngle(_up, rnd() * TAU);
      _S.set(s, s, s);
      _Pp.set(e.x, e.y, e.z);
      _M.compose(_Pp, _Q, _S);
      A.add(small(e.kind, v), _M, { pivot: [e.x, e.y, e.z], tint: tint(rnd, 0.08) });
    }
    const mat = P.shared("scatter", () => P.paint({ sway: true, lift: 0.12, rim: [0.1, 0.45, 0.6], name: "sol" }));
    let mesh = null;
    if (!A.empty) {
      mesh = P.mesh(A, mat, { cast: false, name: "petits éléments" });
      root.add(mesh);
    }
    return {
      object: root,
      update(dt, time) {
        P.tick(time);
      },
      dispose() {
        if (root.parent) root.parent.remove(root);
        if (mesh) mesh.geometry.dispose();
      },
    };
  };
})();
