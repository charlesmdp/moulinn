// « Pas touche à mes trésors » — tours SANGLIER (cases d'herbe) : lanceurs de bogues de châtaigne.
//
//   1 Marcassin            : petit, tout rond, rayé beige et brun, gros yeux.
//   2 Jeune sanglier       : pelage roux, petites défenses.
//   3 Sanglier des talus   : grand sanglier brun-noir, crête de poils, défenses bien blanches.
//   A4-6 Sanglier chasseur : bandeau rouge, cicatrice, longues défenses, pose d'attaque ramassée ;
//                            le camp s'enrichit (rubans rouges, cible de paille, trophée de cerf).
//   A7 Grand Solitaire     : énorme vieux mâle gris argent, défenses gigantesques, bauge fortifiée.
//   B4-6 Laie baliste      : laie qui porte une petite catapulte de bois sur le dos (grosse bogue en cloche).
//   B7 Catapulte à châtaignes : vraie catapulte de bois, la laie au levier et deux marcassins qui chargent.
//
// Socle : bauge (butte de terre, flaque de boue, branchages, palissade de pieux, fanion à étoiles,
// réserve de bogues). Attaque : la bête fouille le sol du groin (une bogue apparaît au bout du groin)
// puis la lance d'un coup de tête ; la laie et la catapulte arment puis détendent leur bras.
// Vus du ciel, la tête (relevée vers la caméra), les oreilles et les défenses font la silhouette.
// Voir models/10-kit.js pour la coque commune (visée, attaque, frénésie, sélection, célébration).
(function () {
  "use strict";
  const PTMT = globalThis.PTMT;
  if (!PTMT || !PTMT.models || !PTMT.models.kit || !PTMT.models.kit.defCt) return;
  const K = PTMT.models.kit,
    G = K.g,
    PAT = K.PAT,
    CLS = K.CLS;
  const { TAU, clamp, lerp, bump, easeInOut, smooth } = K.math;

  const C = {
    earth: "#a87848",
    earthD: "#6e4a2c",
    mud: "#4a3322",
    grass: "#6fa03a",
    grassL: "#9cc24a",
    stake: "#a57a4c",
    stakeD: "#6b4a2c",
    rope: "#d8b878",
    twig: "#7a5634",
    husk: "#8cc23e",
    huskD: "#5e9228",
    nut: "#7a4020",
    snout: "#f0a494",
    nostril: "#4a2226",
    tusk: "#fffaea",
    hoof: "#2e241e",
    red: "#e0342a",
    redD: "#9a1e18",
    scar: "#f59a9a",
    straw: "#e8c65a",
    iron: "#4a4a50",
    leather: "#8a4a2a",
    blanket: "#3a7ad8",
    gold: "#ffd23a",
    torch: "#ffb347",
  };

  /* ---------------------------------------------------------------- bauge */
  /** Profil de la butte (rayon relatif → hauteur relative). */
  const MOUND = [
    [1.0, 0.0],
    [0.97, 0.3],
    [0.88, 0.58],
    [0.72, 0.82],
    [0.45, 0.97],
    [0.0, 1.0],
  ];
  function moundY(rho, R0, H) {
    const u = rho / R0;
    for (let i = 0; i < MOUND.length - 1; i++) {
      const a = MOUND[i],
        b = MOUND[i + 1];
      if (u <= a[0] && u >= b[0]) return H * lerp(a[1], b[1], (a[0] - u) / (a[0] - b[0]));
    }
    return u > 1 ? 0 : H;
  }
  /**
   * Bauge : o = { r, h, seed, stakes, arc: [a0, a1] (angles, 0 = +Z, sens trigo), stakeH, ring (palissade
   *   fermée), flag: {...} (fanion), pile (bogues de réserve), twigs, tufts, ribbons (couleur des rubans) }
   */
  function bauge(R, o) {
    const r = o.r,
      h = o.h;
    R.add(
      G.lathe(
        "bauge:" + r + ":" + h,
        MOUND.map(([u, v]) => [Math.max(0.001, u * r), v * h]),
        18,
      ),
      "root",
      { pat: PAT.stone, gp: [C.earthD, C.earth, 0, h], ol: true },
    );
    // Flaque de boue au creux de la bauge.
    R.add(G.sphere(1, 14, 3, 0, Math.PI / 2), "root", { p: [0, h - 0.035, 0.05], s: [r * 0.52, 0.05, r * 0.48], c: C.mud, cls: CLS.wet, ol: false });
    // Touffes d'herbe au pied de la butte.
    const rnd = PTMT.rng(o.seed || 7);
    const tufts = o.tufts === undefined ? 8 : o.tufts;
    for (let i = 0; i < tufts; i++) {
      const a = (i / tufts) * TAU + rnd() * 0.5;
      const rho = r * (0.92 + rnd() * 0.1);
      const y = moundY(rho, r, h);
      for (let k = 0; k < 2; k++)
        R.add(G.cone(0.06, 0.28 + rnd() * 0.14, 4, true), "root", {
          p: [Math.sin(a) * rho + (k - 0.5) * 0.07, y + 0.1, Math.cos(a) * rho],
          r: [(rnd() - 0.5) * 0.5, 0, (k - 0.5) * 0.6],
          c: k ? C.grassL : C.grass,
          ol: false,
        });
    }
    // Branchages posés sur la butte.
    const twigs = o.twigs === undefined ? 2 : o.twigs;
    for (let i = 0; i < twigs; i++) {
      const a = 0.9 + i * 2.3 + rnd() * 0.4;
      const rho = r * (0.58 + rnd() * 0.16);
      const y = moundY(rho, r, h);
      const L = 0.6 + rnd() * 0.3;
      R.add(
        G.tube(
          "twig" + i + ":" + L.toFixed(2),
          [
            [-L / 2, 0, 0],
            [-L / 6, 0.03, 0.02],
            [L / 6, 0.02, -0.02],
            [L / 2, 0.06, 0],
          ],
          [0.04, 0.02],
          5,
          4,
        ),
        "root",
        { p: [Math.sin(a) * rho, y + 0.02, Math.cos(a) * rho], r: [0, a + 1.2, -0.08], c: C.twig, pat: PAT.wood, uv: [4, 0.3], ol: false },
      );
    }
    // Palissade de pieux taillés (arc à l'arrière, ou presque fermée).
    const n = o.stakes || 0;
    if (n) {
      const a0 = o.arc ? o.arc[0] : 1.9,
        a1 = o.arc ? o.arc[1] : TAU - 1.9;
      const rho = r * (o.stakeR || 0.86);
      const H = o.stakeH || 0.7;
      const pts = [];
      for (let i = 0; i < n; i++) {
        const a = a0 + (i / (n - 1)) * (a1 - a0);
        const x = Math.sin(a) * rho,
          z = Math.cos(a) * rho;
        const y = moundY(rho, r, h) - 0.08;
        const hh = H * (0.82 + rnd() * 0.3);
        const tilt = (rnd() - 0.5) * 0.12;
        R.add(G.cyl(0.065, 0.075, hh, 6), "root", { p: [x, y + hh / 2, z], r: [tilt, 0, (rnd() - 0.5) * 0.12], c: i % 2 ? C.stake : C.stakeD, pat: PAT.wood, uv: [0.5, 1.5], ol: false });
        R.add(G.cone(0.065, 0.17, 6), "root", { p: [x, y + hh + 0.085, z], r: [tilt, 0, 0], c: "#c9a070", pat: PAT.wood, ol: false });
        if (o.ribbons && i % 2 === 0) R.add(G.box(0.18, 0.06, 0.04), "root", { p: [x, y + hh * 0.72, z], r: [0, a, 0.3], c: o.ribbons, cls: CLS.satin, ol: false });
        pts.push([x, y + hh * 0.5, z]);
      }
      // Corde qui lie les pieux.
      if (pts.length > 2) R.add(G.tube("bauge:rope:" + r + ":" + n + ":" + a0.toFixed(2), pts, [0.024, 0.024], pts.length * 2, 4), "root", { c: C.rope, ol: false });
    }
    // Réserve à l'avant droit : tas de châtaignes luisantes et quelques bogues ouvertes.
    const pile = o.pile || 0;
    const pa = o.pileA === undefined ? 1.15 : o.pileA;
    const pr = r * 0.66;
    const px = Math.sin(pa) * pr,
      pz = Math.cos(pa) * pr,
      py = moundY(pr, r, h);
    for (let i = 0; i < pile; i++) {
      const a = i * 2.4,
        d = 0.06 + Math.sqrt(i / Math.max(1, pile)) * 0.26;
      const x = px + Math.sin(a) * d,
        z = pz + Math.cos(a) * d;
      const y = py + 0.05 + (0.32 - d) * 0.35;
      R.add(G.nut(0.085), "root", { p: [x, y, z], r: [0.5 + (i % 3) * 0.4, a, 0.3 * (i % 2)], c: i % 3 ? C.nut : "#8e4e26", cls: CLS.glossy, ol: false });
    }
    for (let i = 0; i < Math.ceil(pile / 4); i++) {
      const a = 0.7 + i * 2.2;
      R.add(G.husk(0.06), "root", { p: [px + Math.sin(a) * 0.3, py + 0.08, pz + Math.cos(a) * 0.3], r: [i, i * 2, 0], c: i % 2 ? C.husk : C.huskD, flat: true, ol: false });
    }
    if (o.flag) K.ctPennant(R, Object.assign({ p: [-r * 0.62, moundY(r * 0.72, r, h) - 0.06, -r * 0.42], dir: 2.6 }, o.flag));
  }

  /* ---------------------------------------------------------------- sanglier paramétrique */
  /**
   * P = { k (échelle du corps), hr (rayon de la tête), fur, back (dos, pattes, oreilles), belly, pat,
   *       body: [rx, rz (demi-longueur), ry], eyeR, iris, lid, slant, brow, browT, browW, lash, ear,
   *       tusk (longueur), tuskCurl, tuskW, crest (mèches), crestH, crestC, mane, maneC, snout,
   *       snoutFur, bandana, scar, crouch, backDark (dos plus sombre), lite (modèle secondaire allégé) }
   * o = { pre (préfixe des os), parent, at: [x, y, z] }
   * Os : <pre>yaw → <pre>body → <pre>head (<pre>earL/R, <pre>held, <pre>knot), <pre>tail ; jambes sous <pre>yaw.
   */
  function boar(R, P, o) {
    const pre = o.pre || "";
    const k = P.k,
      hr = P.hr,
      lite = !!P.lite;
    const B = (n) => pre + n;
    const bs = P.body || [0.35, 0.46, 0.31];
    const rx = bs[0] * k,
      rz = bs[1] * k,
      ry = bs[2] * k;
    const legLen = 0.19 * k * (P.legs || 1);
    const bodyY = legLen + ry * 0.72;
    R.bone(B("yaw"), o.parent || "root", o.at);
    R.bone(B("body"), B("yaw"), [0, bodyY, 0]);
    R.bone(B("head"), B("body"), [0, ry * 0.4, rz * 0.6]);
    // Jambes (sous l'os de visée : elles restent plantées quand le corps respire).
    const legTop = bodyY - ry * 0.35;
    const lr = 0.075 * k * (P.legW || 1);
    for (const [nm, sx, sz] of [
      ["legFL", 1, 1],
      ["legFR", -1, 1],
      ["legBL", 1, -1],
      ["legBR", -1, -1],
    ]) {
      R.bone(B(nm), B("yaw"), [sx * rx * 0.5, legTop, sz * rz * 0.52]);
      R.add(G.capsule(lr, Math.max(0.01, legTop - lr * 2 - 0.02), 5, 1), B(nm), { p: [0, -legTop / 2 + 0.03, 0], c: P.back, pat: PAT.fur, ol: !lite });
      R.add(G.cyl(lr * 0.95, lr * 1.12, 0.07 * k, 5), B(nm), { p: [0, -legTop + 0.035 * k, 0.015 * k], c: C.hoof, cls: CLS.glossy, ol: false });
    }
    // Corps : ellipsoïde dont les pôles sont à l'avant et à l'arrière (rayures le long du corps).
    R.add(G.sphere(1, lite ? 10 : 12, lite ? 7 : 8), B("body"), {
      r: [Math.PI / 2, 0, 0],
      s: [rx, rz, ry],
      gp: [P.belly, P.fur, -ry * 0.7, ry * 0.4],
      pat: P.pat,
      uv: [P.pat === PAT.stripes ? 8 : 1, 1],
      ol: true,
    });
    // Dos plus sombre (bande dorsale).
    if (P.backDark) R.add(G.sphere(1, 12, 4, 0, Math.PI * 0.36), B("body"), { p: [0, ry * 0.05, -rz * 0.04], s: [rx * 0.97, ry * 1.0, rz * 0.97], r: [0.12, 0, 0], c: P.back, pat: PAT.fur, ol: false });
    // Crête de poils le long de l'échine.
    const nc = P.crest || 0;
    for (let i = 0; i < nc; i++) {
      const u = i / Math.max(1, nc - 1);
      const z = lerp(0.62, -0.5, u) * rz;
      const hh = (P.crestH || 1) * 0.17 * k * (1 - Math.abs(u - 0.3) * 0.9);
      const y = Math.sqrt(Math.max(0, 1 - Math.pow(z / rz, 2))) * ry;
      R.add(G.cone(0.055 * k, hh, 4), B("body"), { p: [(i % 2 ? 0.025 : -0.025) * k, y + hh * 0.3, z], r: [-0.6, 0, i % 2 ? 0.22 : -0.22], c: P.crestC || P.back, ol: false });
    }
    // Collerette de poils hirsutes (vieux mâle).
    if (P.mane) {
      for (let i = 0; i < 9; i++) {
        const a = -1.25 + (i / 8) * 2.5;
        R.add(G.cone(0.085 * k, 0.28 * k * P.mane, 4), B("body"), {
          p: [Math.sin(a) * rx * 0.85, ry * 0.25 + Math.cos(a) * ry * 0.45, rz * 0.5],
          r: [-1.0, 0, -a * 0.9],
          c: P.maneC || P.back,
          ol: false,
        });
      }
    }
    // Tête (relevée vers la caméra au repos).
    const hc = [0, hr * 0.32, hr * 0.5];
    R.add(G.sphere(hr, lite ? 10 : 12, lite ? 7 : 8), B("head"), { p: hc, s: [1.02, 0.94, 1], c: P.fur, pat: PAT.fur, gp: [P.belly, P.fur, hc[1] - hr * 0.8, hc[1] + hr * 0.1], ol: true });
    // Groin.
    const sl = P.snoutL || 1;
    const sz = hc[2] + hr * 0.84;
    R.add(G.cyl(hr * 0.42, hr * 0.5, hr * 0.62 * sl, lite ? 8 : 10), B("head"), { p: [0, hc[1] - hr * 0.24, sz], r: [Math.PI / 2 - 0.1, 0, 0], c: P.snoutFur || P.fur, pat: PAT.fur, ol: true });
    const nz = sz + hr * 0.31 * sl;
    R.add(G.cyl(hr * 0.46, hr * 0.46, hr * 0.13, lite ? 9 : 12), B("head"), { p: [0, hc[1] - hr * 0.2, nz], r: [Math.PI / 2 - 0.1, 0, 0], c: P.snout || C.snout, cls: CLS.satin, ol: true });
    for (const sx of [-1, 1]) R.add(G.sphere(hr * 0.1, 6, 4), B("head"), { p: [sx * hr * 0.17, hc[1] - hr * 0.2, nz + hr * 0.07], s: [1, 1.35, 0.5], c: C.nostril, ol: false });
    // Bouche (petit sourire sous le groin).
    R.add(G.torus(hr * 0.22, hr * 0.04, 3, 8, Math.PI), B("head"), { p: [0, hc[1] - hr * 0.62, sz - hr * 0.02], r: [-0.3, 0, Math.PI], c: "#3a1a18", ol: false });
    // Défenses.
    if (P.tusk) {
      const tl = P.tusk * k;
      for (const sx of [-1, 1])
        R.add(
          G.tube(
            "tusk:" + P.tusk + ":" + (P.tuskCurl || 1),
            [
              [0, 0, 0],
              [0.03, 0.25, 0.25],
              [0.1, 0.62, 0.42],
              [0.2 * (P.tuskCurl || 1), 0.95, 0.3],
            ].map(([x, y, z]) => [x * tl * 2.2, y * tl * 1.1, z * tl]),
            (t) => (0.036 + (1 - t) * 0.032) * (P.tuskW || 1) * k + 0.004,
            6,
            4,
          ),
          B("head"),
          { p: [sx * hr * 0.36, hc[1] - hr * 0.42, sz + hr * 0.05], s: [sx, 1, 1], c: C.tusk, cls: CLS.glossy, ol: true },
        );
    }
    // Oreilles (os propres : petits mouvements).
    const ek = P.ear || 1;
    for (const sx of [-1, 1]) {
      const nm = sx > 0 ? "earL" : "earR";
      R.bone(B(nm), B("head"), [sx * hr * 0.6, hc[1] + hr * 0.7, hc[2] - hr * 0.15]);
      R.add(G.cone(hr * 0.36 * ek, hr * 0.8 * ek, 5), B(nm), { p: [0, hr * 0.26 * ek, 0], r: [0.1, 0, -sx * 0.62], s: [1, 1, 0.5], c: P.back, pat: PAT.fur, ol: true });
      if (!lite) R.add(G.cone(hr * 0.2 * ek, hr * 0.48 * ek, 4), B(nm), { p: [sx * hr * 0.02, hr * 0.2 * ek, hr * 0.1], r: [0.1, 0, -sx * 0.62], s: [1, 1, 0.4], c: "#f0a8a8", ol: false });
    }
    // Yeux (en haut et à l'avant de la tête : visibles du ciel). Figurants allégés : yeux fixes.
    if (lite) {
      const ec = [0, hc[1] + hr * 0.46, hc[2] + hr * 0.74];
      for (const sx of [-1, 1]) {
        R.add(G.sphere(P.eyeR, 7, 5), B("head"), { p: [ec[0] + sx * hr * 0.47, ec[1], ec[2]], c: "#fbfaf2", pat: PAT.eyeW, cls: CLS.glossy, ol: true });
        R.add(G.sphere(P.eyeR * 0.62, 6, 4), B("head"), { p: [ec[0] + sx * hr * 0.47, ec[1] + P.eyeR * 0.3, ec[2] + P.eyeR * 0.62], s: [1, 1.1, 0.5], c: "#1a120c", cls: CLS.glossy, ol: false });
      }
    } else K.ctEyes(R, B("head"), {
      name: pre + "eyes",
      p: [0, hc[1] + hr * 0.46, hc[2] + hr * 0.74],
      gap: hr * 0.47,
      r: P.eyeR,
      skin: P.fur,
      iris: P.iris || "#3b2414",
      pupil: P.pupil || 0.7,
      dot: P.dot === undefined ? 0.52 : P.dot,
      slant: P.slant === undefined ? 0.1 : P.slant,
      rest: P.lid === undefined ? -0.7 : P.lid,
      up: 0.5,
      brow: P.brow || null,
      browW: P.browW,
      browT: P.browT,
      lash: P.lash,
    });
    // Queue et petite touffe.
    if (!lite) {
      R.bone(B("tail"), B("body"), [0, ry * 0.2, -rz * 0.95]);
      R.add(
        G.tube(
          "tail",
          [
            [0, 0, 0],
            [0.03, -0.04, -0.07],
            [-0.02, -0.12, -0.09],
            [0, -0.2, -0.08],
          ],
          [0.03, 0.02],
          6,
          4,
        ),
        B("tail"),
        { s: k, c: P.back, ol: false },
      );
      R.add(G.cone(0.05 * k, 0.13 * k, 5), B("tail"), { p: [0, -0.24 * k, -0.08 * k], r: [Math.PI, 0, 0], c: P.back, ol: false });
      R.sway(B("tail"), "y", 0, 0.35, 5.5, 0);
    }
    // Bogue tenue au bout du groin pendant l'élan.
    if (!lite) {
      R.bone(B("held"), B("head"), [0, hc[1] - hr * 0.12, nz + hr * 0.3]);
      R.add(G.husk(hr * 0.22), B("held"), { c: C.husk, flat: true, ol: false });
      R.add(G.nut(hr * 0.17), B("held"), { p: [0, hr * 0.16, hr * 0.06], c: C.nut, cls: CLS.glossy, ol: false });
    }
    // Bandeau de chasseur : cercle qui épouse le crâne (plan incliné vers l'arrière, passe au-dessus
    // des yeux), nœud derrière la tête et deux pans qui flottent.
    if (P.bandana) {
      R.add(G.torus(hr * 0.87, hr * 0.1, 4, 14), B("head"), { p: [0, hc[1] + hr * 0.46, hc[2] - hr * 0.25], r: [Math.PI / 2 - 0.5, 0, 0], c: P.bandana, cls: CLS.satin, ol: true });
      R.bone(B("knot"), B("head"), [0, hc[1] + hr * 0.2, hc[2] - hr * 0.98]);
      R.add(G.sphere(hr * 0.17, 7, 5), B("knot"), { c: P.bandana, cls: CLS.satin, ol: true });
      for (const sx of [-1, 1])
        R.add(G.cone(hr * 0.16, hr * 0.85, 4), B("knot"), { p: [sx * hr * 0.14, -hr * 0.1, -hr * 0.36], r: [-1.9, sx * 0.45, 0], s: [1, 1, 0.35], c: P.bandana, cls: CLS.satin, ol: true });
      R.sway(B("knot"), "x", 0, 0.2, 7, 0);
      R.sway(B("knot"), "y", 0, 0.25, 4.3, 1);
    }
    // Cicatrice en travers de l'œil droit.
    if (P.scar) R.add(G.capsule(hr * 0.06, hr * 0.75, 4, 2), B("head"), { p: [-hr * 0.47, hc[1] + hr * 0.55, hc[2] + hr * 0.68], r: [-0.6, 0.35, 0.75], c: C.scar, cls: CLS.satin, ol: false });
    R.sway(B("earL"), "z", 0, 0.08, 1.7, 0);
    R.sway(B("earR"), "z", 0, 0.08, 1.9, 2);
    return { hc, nz };
  }

  /** Animation commune des sangliers (fouille du groin puis coup de tête). */
  function boarPose(st, B, P) {
    const k = P.k;
    const t = st.t + st.phase;
    const w = easeInOut(st.w),
      s = st.s;
    const br = Math.sin(t * (2.1 + st.fr * 2));
    const fid = bump(1 - st.fid);
    const r0 = B.body.userData.rest;
    const crouch = P.crouch || 0;
    B.body.position.set(0, r0.y + br * 0.012 * k - w * 0.06 * k + s * 0.03 * k - crouch * 0.05 * k, r0.z - w * 0.06 * k + s * 0.1 * k);
    B.body.rotation.set(crouch * 0.1 + w * 0.14 - s * 0.12 + (st.fidK === 1 ? fid * 0.08 : 0), 0, -clamp(st.turn, -3, 3) * 0.04);
    B.body.scale.set(1 + br * 0.016, 1 + br * 0.022, 1);
    // Tête : fouille le sol (élan), lance d'un coup de groin (détente) ; renifle ou s'ébroue au repos.
    const sniff = st.fidK === 2 ? fid * Math.sin(t * 22) * 0.08 : 0;
    const shake = st.fidK === 0 ? fid * Math.sin(t * 26) * 0.35 : 0;
    B.head.rotation.set(-0.2 + crouch * 0.12 + Math.sin(t * 0.8) * 0.04 + w * 0.75 - s * 0.7 + sniff, Math.sin(t * 0.55) * 0.18 * (1 - w) + shake, shake * 0.3);
    B.held.scale.setScalar(st.ae >= 0 && s === 0 ? Math.max(0.001, Math.min(1, st.w * 1.8)) : 0.001);
    // Patte avant qui gratte le sol (manie) ou qui prend appui à la détente.
    const paw = st.fidK === 1 ? fid * Math.max(0, Math.sin(t * 9)) : 0;
    B.legFL.rotation.x = -paw * 0.7 - s * 0.25;
    B.legFR.rotation.x = -s * 0.25;
    B.legBL.rotation.x = w * 0.15;
    B.legBR.rotation.x = w * 0.15;
    const back = w * 0.5 + st.fr * 0.4;
    B.earL.rotation.x = -back;
    B.earR.rotation.x = -back;
    st.eyeOpen = s > 0.2 ? 0.9 : w > 0.1 ? -0.8 * w : st.fr > 0.3 ? -0.6 : 0;
    if (st.ae >= 0) st.look = 0;
  }

  /* ---------------------------------------------------------------- réglages par niveau */
  const PIGLET = { k: 1.0, hr: 0.36, fur: "#c8945a", back: "#7a5232", belly: "#f0d4a4", pat: PAT.stripes, eyeR: 0.125, iris: "#3b2414", ear: 1.1, tusk: 0, snoutFur: "#d8a06a", lid: -0.8, slant: 0.02, brow: "#5a3a20", browT: 0.018 };
  const YOUNG = { k: 1.2, hr: 0.38, fur: "#c8682c", back: "#8a4220", belly: "#f0b27a", pat: PAT.fur, eyeR: 0.11, iris: "#2e1a10", crest: 6, crestH: 0.8, tusk: 0.13, snoutFur: "#d07a48", brow: "#5a2a14", browT: 0.022, slant: 0.14, lid: -0.62, backDark: true };
  const ADULT = { k: 1.42, hr: 0.41, fur: "#5e4a3c", back: "#2e2420", belly: "#8e7866", pat: PAT.fur, eyeR: 0.1, iris: "#2a1810", crest: 11, crestH: 1.25, tusk: 0.21, snoutFur: "#735e50", snout: "#e89a8a", brow: "#1a1410", browT: 0.024, slant: 0.26, lid: -0.5, backDark: true };
  const HUNTER = { k: 1.55, hr: 0.44, fur: "#6e4e3a", back: "#34261e", belly: "#a07e62", pat: PAT.fur, eyeR: 0.095, iris: "#2a1810", crest: 12, crestH: 1.35, tusk: 0.3, tuskCurl: 1.3, snoutFur: "#7e604e", snout: "#e89a8a", brow: "#1a1410", browT: 0.026, slant: 0.42, lid: -0.34, bandana: C.red, scar: true, crouch: 1, backDark: true };
  const SOLITAIRE = {
    k: 2.1,
    hr: 0.56,
    fur: "#c2c3bd",
    back: "#74767a",
    belly: "#ecebe4",
    pat: PAT.fur,
    eyeR: 0.11,
    iris: "#2a1810",
    crest: 15,
    crestH: 1.55,
    crestC: "#f2f0ea",
    tusk: 0.46,
    tuskCurl: 1.7,
    tuskW: 1.4,
    snoutFur: "#a4a4a0",
    snout: "#d8968a",
    brow: "#ffffff",
    browT: 0.04,
    browW: 0.22,
    slant: 0.36,
    lid: -0.3,
    mane: 1.2,
    maneC: "#e6e4dc",
    scar: true,
    crouch: 0.4,
    backDark: true,
  };
  const SOW = { k: 1.45, hr: 0.42, fur: "#96694a", back: "#5e4230", belly: "#e0bc94", pat: PAT.fur, eyeR: 0.11, iris: "#3b2414", crest: 4, crestH: 0.6, tusk: 0, snoutFur: "#a67552", lash: "#120c0a", slant: -0.05, lid: -0.66, body: [0.4, 0.49, 0.34] };

  // Hauteur réelle du sommet (m, mesurée sur les gabarits) et rayon d'emprise au sol (m) : ctTowerInfo sans construire.
  const INFO = {
    1: { height: 1.81, footprint: 1.42 },
    2: { height: 2.02, footprint: 1.46 },
    3: { height: 2.23, footprint: 1.5 },
    A4: { height: 2.9, footprint: 1.54 },
    A5: { height: 3.07, footprint: 1.54 },
    A6: { height: 3.24, footprint: 1.54 },
    A7: { height: 4.2, footprint: 1.68 },
    B4: { height: 2.86, footprint: 1.56 },
    B5: { height: 3.02, footprint: 1.56 },
    B6: { height: 3.18, footprint: 1.56 },
    B7: { height: 4.11, footprint: 1.7 },
  };

  /* ---------------------------------------------------------------- niveaux 1 à 3, chasseur, Grand Solitaire */
  function classic(level, spec) {
    const lv = spec ? spec + level : String(level);
    const P = level === 1 ? PIGLET : level === 2 ? YOUNG : level === 3 ? ADULT : level === 7 ? SOLITAIRE : HUNTER;
    const big = level === 7;
    const r = big ? 1.58 : 1.28 + Math.min(level, 4) * 0.04;
    const h = big ? 0.42 : 0.3 + level * 0.012;
    const deco = level >= 4 ? level - 3 : 0; // 1..3 pour le chasseur
    return {
      key: "boar:" + lv,
      release: level >= 4 ? 0.13 : 0.17,
      dur: 0.62,
      ring: r + 0.12,
      footprint: INFO[lv].footprint,
      turn: level >= 4 ? 8.5 : 6.5,
      jumpH: big ? 0.35 : 0.5,
      author(R) {
        bauge(R, {
          r,
          h,
          seed: 3 + level,
          stakes: big ? 15 : Math.min(9, 3 + level * 2 - (level >= 4 ? 3 : 0)),
          stakeH: big ? 1.25 : 0.6 + level * 0.05,
          arc: big ? [0.62, TAU - 0.62] : [1.95 - level * 0.08, TAU - 1.95 + level * 0.08],
          pile: big ? 6 : Math.min(5, 1 + level),
          twigs: 2,
          tufts: big ? 10 : 8,
          ribbons: deco >= 2 || big ? C.red : null,
          flag: {
            h: big ? 3.8 : level >= 4 ? 2.4 + deco * 0.16 : 1.3 + level * 0.2,
            color: level >= 4 ? C.red : "#2f7ad0",
            trim: level >= 4 ? C.gold : "#ffffff",
            stars: level >= 4 ? (big ? 3 : deco) : level,
            len: big ? 0.95 : 0.66,
            tall: big ? 0.6 : 0.42,
            tail: level >= 4 ? "swallow" : "point",
          },
        });
        boar(R, P, { at: [0, h - 0.04, 0] });
        // Camp du chasseur : cible de paille (5+), trophée de cerf (6+).
        if (deco >= 2 || big) {
          const x = r * 0.62,
            z = -r * 0.5,
            y = moundY(Math.hypot(x, z), r, h);
          R.add(G.cyl(0.05, 0.05, 1.0, 5), "root", { p: [x, y + 0.5, z], c: C.stakeD, pat: PAT.wood, ol: true });
          R.add(G.cyl(0.32, 0.32, 0.1, 10), "root", { p: [x, y + 0.95, z + 0.05], r: [Math.PI / 2 - 0.25, 0, 0], c: C.straw, pat: PAT.straw, ol: true });
          for (const [rr, cc] of [
            [0.24, C.red],
            [0.15, "#ffffff"],
            [0.07, C.red],
          ])
            R.add(G.cyl(rr, rr, 0.02, 9), "root", { p: [x, y + 0.95 + 0.012, z + 0.1 + (0.24 - rr) * 0.1], r: [Math.PI / 2 - 0.25, 0, 0], c: cc, cls: CLS.satin, ol: false });
          R.add(G.husk(0.05), "root", { p: [x, y + 0.97, z + 0.14], c: C.huskD, flat: true, ol: false });
        }
        if (deco >= 3 || big) {
          const x = -r * 0.75,
            z = r * 0.12,
            y = moundY(Math.hypot(x, z), r, h);
          R.add(G.cyl(0.055, 0.06, 1.25, 5), "root", { p: [x, y + 0.62, z], c: C.stake, pat: PAT.wood, ol: true });
          for (const sx of [-1, 1]) {
            R.add(
              G.tube(
                "antler",
                [
                  [0, 0, 0],
                  [0.12, 0.12, 0],
                  [0.22, 0.3, 0.02],
                  [0.26, 0.5, 0],
                ],
                [0.035, 0.015],
                6,
                4,
              ),
              "root",
              { p: [x, y + 1.2, z], s: [sx, 1, 1], c: "#efe2c2", ol: true },
            );
            R.add(G.cone(0.018, 0.16, 4), "root", { p: [x + sx * 0.14, y + 1.38, z], r: [0, 0, -sx * 0.9], c: "#efe2c2", ol: false });
          }
          R.add(G.sphere(0.13, 7, 5), "root", { p: [x, y + 1.2, z + 0.04], s: [0.9, 0.8, 1.1], c: "#f2ead8", ol: true });
          for (const sx of [-1, 1]) R.add(G.sphere(0.035, 5, 4), "root", { p: [x + sx * 0.05, y + 1.23, z + 0.15], c: "#1a1410", ol: false });
        }
        // Bauge fortifiée du Grand Solitaire : torches à l'entrée.
        if (big) {
          for (const sx of [-1, 1]) {
            const a = sx * 0.62;
            const rho = r * 0.9;
            const x = Math.sin(a) * rho,
              z = Math.cos(a) * rho,
              y = moundY(rho, r, h);
            R.add(G.cyl(0.07, 0.08, 1.35, 6), "root", { p: [x, y + 0.6, z], c: C.stakeD, pat: PAT.wood, ol: true });
            R.add(G.cyl(0.13, 0.09, 0.16, 7), "root", { p: [x, y + 1.32, z], c: C.iron, cls: CLS.metal, ol: true });
            R.bone("torch" + sx, "root", [x, y + 1.4, z]);
            R.glow(G.flame(0.13, 0.42, 8), "torch" + sx, { c: C.torch });
            R.glow(G.flame(0.07, 0.26, 6), "torch" + sx, { p: [0, 0.02, 0], c: "#fff0a0" });
            R.sway("torch" + sx, "z", 0, 0.12, 9 + sx, 0);
          }
        }
      },
      pose(st, B) {
        boarPose(st, B, P);
        if (big) {
          const f = 1 + Math.sin(st.time * 17) * 0.08 + Math.sin(st.time * 29) * 0.05;
          B["torch1"].scale.set(f, 1 + (f - 1) * 2.4, f);
          B["torch-1"].scale.set(2 - f, 1 + (1 - f) * 2.4, 2 - f);
        }
      },
      muzzle: ["held", [0, 0, 0]],
    };
  }

  /* ---------------------------------------------------------------- laie baliste (B4-6) */
  function sow(level) {
    const deco = level - 3;
    const r = 1.46,
      h = 0.36;
    const P = SOW;
    return {
      key: "boar:B" + level,
      release: 0.3,
      dur: 0.95,
      ring: r + 0.12,
      footprint: INFO["B" + level].footprint,
      turn: 5,
      author(R) {
        bauge(R, {
          r,
          h,
          seed: 20 + level,
          stakes: 5,
          stakeH: 0.72,
          pile: 4 + deco,
          flag: { h: 2.35 + deco * 0.16, color: "#e0a020", trim: C.redD, stars: deco, len: 0.66, tall: 0.42, tail: "swallow" },
        });
        boar(R, P, { at: [0, h - 0.04, 0] });
        const k = P.k;
        const top = P.body[2] * k * 0.98;
        // Couverture bleue, selle et bâti de la catapulte sur le dos.
        R.add(G.sphere(1, 14, 5, 0, Math.PI * 0.38), "body", { p: [0, 0.02 * k, -0.02 * k], s: [P.body[0] * k * 1.04, P.body[2] * k * 1.05, P.body[1] * k * 0.8], c: C.blanket, cls: CLS.satin, ol: true });
        R.add(G.box(0.62 * k, 0.05 * k, 0.5 * k), "body", { p: [0, top + 0.02 * k, -0.02 * k], c: C.leather, pat: PAT.wood, ol: true });
        for (const sx of [-1, 1]) {
          R.add(G.box(0.06 * k, 0.42 * k, 0.07 * k), "body", { p: [sx * 0.2 * k, top + 0.22 * k, 0.06 * k], r: [0.28, 0, 0], c: C.stake, pat: PAT.wood, ol: true });
          R.add(G.box(0.06 * k, 0.42 * k, 0.07 * k), "body", { p: [sx * 0.2 * k, top + 0.22 * k, -0.14 * k], r: [-0.28, 0, 0], c: C.stake, pat: PAT.wood, ol: true });
        }
        // Butée (barre transversale à l'avant) et écheveau de corde (torsion) sur l'axe.
        R.add(G.cyl(0.035 * k, 0.035 * k, 0.5 * k, 5), "body", { p: [0, top + 0.44 * k, 0.16 * k], r: [0, 0, Math.PI / 2], c: C.stakeD, pat: PAT.wood, ol: true });
        R.add(G.cyl(0.07 * k, 0.07 * k, 0.34 * k, 8), "body", { p: [0, top + 0.12 * k, -0.04 * k], r: [0, 0, Math.PI / 2], c: C.rope, pat: PAT.straw, ol: true });
        if (deco >= 3) for (const sx of [-1, 1]) R.add(G.torus(0.075 * k, 0.012 * k, 3, 10), "body", { p: [sx * 0.12 * k, top + 0.12 * k, -0.04 * k], r: [0, Math.PI / 2, 0], c: C.iron, cls: CLS.metal, ol: false });
        // Bras (pivote autour de l'axe X), cuillère et grosse bogue.
        R.bone("arm", "body", [0, top + 0.12 * k, -0.04 * k]);
        const al = 0.5 * k;
        R.add(G.box(0.05 * k, 0.05 * k, al), "arm", { p: [0, 0, -al / 2], c: C.stake, pat: PAT.wood, ol: true });
        R.add(G.sphere(0.12 * k, 8, 4, 0, Math.PI / 2), "arm", { p: [0, 0.02 * k, -al], r: [Math.PI, 0, 0], s: [1, 0.7, 1], c: C.stakeD, pat: PAT.wood, ol: true });
        R.bone("ammo", "arm", [0, 0.1 * k, -al]);
        R.add(G.husk(0.09 * k), "ammo", { c: C.husk, flat: true, ol: true });
        R.add(G.nut(0.075 * k), "ammo", { p: [0, 0.08 * k, 0], c: C.nut, cls: CLS.glossy, ol: false });
        // Panier de munitions (5+) et petit fanion sur le bâti (6).
        if (deco >= 2) {
          R.add(G.cyl(0.14 * k, 0.1 * k, 0.2 * k, 8, true), "body", { p: [0.44 * k, 0.08 * k, -0.1 * k], c: C.straw, pat: PAT.straw, ol: true });
          for (let i = 0; i < 3; i++) R.add(G.nut(0.055 * k), "body", { p: [0.44 * k + (i - 1) * 0.07 * k, 0.17 * k, -0.1 * k + (i % 2) * 0.05 * k], r: [0.4, i, 0], c: C.nut, cls: CLS.glossy, ol: false });
        }
        if (deco >= 3) {
          R.add(G.cyl(0.012 * k, 0.012 * k, 0.5 * k, 4), "body", { p: [-0.2 * k, top + 0.62 * k, -0.2 * k], c: C.stakeD, ol: false });
          R.bone("mini", "body", [-0.2 * k, top + 0.8 * k, -0.2 * k]);
          R.add(
            G.extrude(
              "miniFlag",
              [
                [0, -0.07],
                [0.22, 0],
                [0, 0.07],
              ],
              0.015,
              0,
            ),
            "mini",
            { s: k, c: C.red, cls: CLS.satin, ol: false },
          );
          R.sway("mini", "y", 2.4, 0.3, 3, 0);
        }
      },
      pose(st, B) {
        // La laie se campe sur ses pattes ; le bras recule (élan) puis bascule par-dessus (détente).
        const k = P.k;
        const t = st.t + st.phase;
        const w = easeInOut(st.w),
          s = st.s;
        const br = Math.sin(t * 2);
        const r0 = B.body.userData.rest;
        B.body.position.set(0, r0.y + br * 0.012 * k - w * 0.05 * k, r0.z + w * 0.04 * k - s * 0.05 * k);
        B.body.rotation.set(-w * 0.08 + s * 0.1, 0, -clamp(st.turn, -3, 3) * 0.04);
        B.body.scale.set(1 + br * 0.014, 1 + br * 0.02, 1);
        B.head.rotation.set(-0.2 + Math.sin(t * 0.8) * 0.04 - w * 0.2 + s * 0.3, Math.sin(t * 0.5) * 0.16 * (1 - w), 0);
        // Bras : repos incliné vers l'arrière, armé plus bas, lancé jusqu'à la butée puis retour.
        const fling = st.ae >= 0 && st.ae >= st.release ? 1 - Math.pow(1 - Math.min(1, (st.ae - st.release) / 0.12), 3) : 0;
        const back = st.ae >= 0 ? (st.ae < st.release ? w : Math.max(0, 1 - fling * 3)) : 0;
        const settle = st.ae >= 0 ? smooth(st.release + 0.18, st.dur, st.ae) : 1;
        let ang = -0.55 - back * 0.45 + fling * 2.0 * (1 - settle);
        if (st.ae < 0) ang = -0.55 + Math.sin(t * 1.3) * 0.03;
        B.arm.rotation.x = -ang;
        // La munition quitte la cuillère au départ, puis réapparaît (rechargement) en fin de mouvement.
        const reload = st.ae < 0 || st.ae < st.release ? 1 : smooth(st.dur * 0.85, st.dur, st.ae);
        B.ammo.scale.setScalar(Math.max(0.001, reload));
        B.legFL.rotation.x = w * 0.2;
        B.legFR.rotation.x = w * 0.2;
        B.legBL.rotation.x = -w * 0.1;
        B.legBR.rotation.x = -w * 0.1;
        B.held.scale.setScalar(0.001);
        st.eyeOpen = s > 0.2 ? 1 : w > 0.1 ? -0.6 * w : 0;
        if (st.ae >= 0) st.look = 0;
      },
      muzzle: ["ammo", [0, 0, 0]],
    };
  }

  /* ---------------------------------------------------------------- catapulte à châtaignes (B7) */
  function catapult() {
    const r = 1.6,
      h = 0.34;
    const SOWC = Object.assign({}, SOW, { k: 1.15, hr: 0.36, lite: true, crest: 0 });
    const PIG = Object.assign({}, PIGLET, { k: 0.62, hr: 0.25, eyeR: 0.085, lite: true });
    return {
      key: "boar:B7",
      release: 0.34,
      dur: 1.05,
      ring: r + 0.12,
      footprint: INFO.B7.footprint,
      turn: 3.5,
      jumpH: 0.3,
      author(R) {
        bauge(R, {
          r,
          h,
          seed: 31,
          stakes: 0,
          pile: 7,
          tufts: 10,
          flag: { h: 3.9, color: "#e0a020", trim: C.redD, stars: 3, len: 0.95, tall: 0.6, tail: "swallow", p: [-r * 0.72, 0.1, -r * 0.55] },
        });
        R.bone("yaw", "root", [0, h - 0.02, 0]);
        // Plateau de bois et roues.
        R.add(G.box(1.3, 0.1, 2.1), "yaw", { p: [0, 0.18, -0.05], c: C.stake, pat: PAT.wood, uv: "box", tile: 0.5, ol: true });
        for (const sx of [-1, 1]) {
          R.add(G.box(0.14, 0.16, 2.3), "yaw", { p: [sx * 0.62, 0.1, -0.05], c: C.stakeD, pat: PAT.wood, ol: true });
          for (const z of [-0.85, 0.7]) {
            R.add(G.cyl(0.26, 0.26, 0.1, 10), "yaw", { p: [sx * 0.74, 0.12, z], r: [0, 0, Math.PI / 2], c: C.stakeD, pat: PAT.wood, ol: true });
            R.add(G.cyl(0.08, 0.08, 0.14, 6), "yaw", { p: [sx * 0.76, 0.12, z], r: [0, 0, Math.PI / 2], c: C.iron, cls: CLS.metal, ol: false });
          }
          // Montants et jambes de force.
          R.add(G.box(0.14, 1.25, 0.16), "yaw", { p: [sx * 0.42, 0.85, -0.15], c: C.stake, pat: PAT.wood, ol: true });
          R.add(G.box(0.1, 1.0, 0.12), "yaw", { p: [sx * 0.42, 0.62, 0.22], r: [-0.55, 0, 0], c: C.stakeD, pat: PAT.wood, ol: true });
          R.add(G.box(0.1, 1.0, 0.12), "yaw", { p: [sx * 0.42, 0.62, -0.55], r: [0.55, 0, 0], c: C.stakeD, pat: PAT.wood, ol: true });
        }
        // Butée haute rembourrée et écheveau de torsion.
        R.add(G.box(0.98, 0.14, 0.16), "yaw", { p: [0, 1.46, -0.15], c: C.stake, pat: PAT.wood, ol: true });
        R.add(G.cyl(0.13, 0.13, 0.5, 8), "yaw", { p: [0, 1.52, -0.07], r: [0, 0, Math.PI / 2], c: C.straw, pat: PAT.straw, ol: true });
        R.add(G.cyl(0.16, 0.16, 0.7, 10), "yaw", { p: [0, 0.34, -0.55], r: [0, 0, Math.PI / 2], c: C.rope, pat: PAT.straw, ol: true });
        for (const sx of [-1, 1]) R.add(G.torus(0.165, 0.025, 3, 10), "yaw", { p: [sx * 0.3, 0.34, -0.55], r: [0, Math.PI / 2, 0], c: C.iron, cls: CLS.metal, ol: false });
        // Treuil à l'arrière.
        R.add(G.cyl(0.09, 0.09, 1.0, 6), "yaw", { p: [0, 0.4, -0.98], r: [0, 0, Math.PI / 2], c: C.stakeD, pat: PAT.wood, ol: true });
        // Bras de lancer (pivot sur l'écheveau) et grande cuillère.
        R.bone("arm", "yaw", [0, 0.34, -0.55]);
        R.add(G.box(0.14, 0.14, 1.7), "arm", { p: [0, 0, 0.85], c: C.stake, pat: PAT.wood, ol: true });
        for (const z of [0.4, 1.1]) R.add(G.box(0.17, 0.17, 0.05), "arm", { p: [0, 0, z], c: C.iron, cls: CLS.metal, ol: false });
        R.add(G.sphere(0.3, 10, 4, 0, Math.PI / 2), "arm", { p: [0, -0.02, 1.72], r: [Math.PI, 0, 0], s: [1, 0.55, 1], c: C.stakeD, pat: PAT.wood, ol: true });
        R.bone("ammo", "arm", [0, 0.16, 1.72]);
        R.add(G.husk(0.17), "ammo", { c: C.husk, flat: true, ol: true });
        R.add(G.nut(0.14), "ammo", { p: [0, 0.18, 0.03], c: C.nut, cls: CLS.glossy, ol: false });
        // La laie au levier, sur le plateau à droite.
        boar(R, SOWC, { pre: "s", parent: "yaw", at: [0.95, 0.24, -0.2] });
        R.add(G.cyl(0.03, 0.03, 0.9, 5), "shead", { p: [-0.12, 0.05, 0.7], r: [0.3, 0, 1.25], c: C.stakeD, pat: PAT.wood, ol: false });
        // Deux marcassins qui apportent des bogues (portées sur le dos).
        boar(R, PIG, { pre: "p1", parent: "yaw", at: [-0.98, 0.24, 0.55] });
        boar(R, PIG, { pre: "p2", parent: "yaw", at: [-0.5, 0.24, 1.25] });
        for (const p of ["p1", "p2"]) R.add(G.husk(0.09), p + "body", { p: [0, PIG.body ? 0 : 0.26, -0.02], c: C.husk, flat: true, ol: true });
      },
      pose(st, B) {
        const t = st.t + st.phase;
        const w = easeInOut(st.w);
        // Bras : repos couché vers l'avant, armé = tiré en arrière, lancé jusqu'à la butée puis retour.
        const fling = st.ae >= 0 && st.ae >= st.release ? 1 - Math.pow(1 - Math.min(1, (st.ae - st.release) / 0.14), 3) : 0;
        const settle = st.ae >= 0 ? smooth(st.release + 0.25, st.dur, st.ae) : 1;
        let ang;
        if (st.ae < 0) ang = 0.12 + Math.sin(t * 1.1) * 0.01;
        else if (st.ae < st.release) ang = 0.12 - w * 0.22;
        else ang = lerp(-0.1 + fling * 1.95, 0.12, settle);
        B.arm.rotation.x = -ang;
        const reload = st.ae < 0 || st.ae < st.release ? 1 : smooth(st.dur * 0.8, st.dur, st.ae);
        B.ammo.scale.setScalar(Math.max(0.001, reload));
        // La laie tire sur le levier (élan) ; les marcassins trottinent sur place.
        const r0 = B.sbody.userData.rest;
        B.sbody.position.set(0, r0.y + Math.sin(t * 2) * 0.01, r0.z - w * 0.1);
        B.sbody.rotation.x = -w * 0.15 + st.s * 0.1;
        B.shead.rotation.set(-0.1 - w * 0.3 + st.s * 0.25, Math.sin(t * 0.6) * 0.12, 0);
        for (const [p, ph] of [
          ["p1", 0],
          ["p2", 1.7],
        ]) {
          const b = B[p + "yaw"],
            q = b.userData.rest;
          const hop = Math.abs(Math.sin(t * 5 + ph));
          b.position.set(q.x, q.y + hop * 0.07, q.z);
          b.rotation.set(0, p === "p1" ? 0.6 : -0.3, Math.sin(t * 5 + ph) * 0.06);
          B[p + "head"].rotation.set(-0.25 + Math.sin(t * 3 + ph) * 0.08, 0, 0);
        }
        st.eyeOpen = st.s > 0.2 ? 1 : w > 0.1 ? -0.6 : 0;
      },
      muzzle: ["ammo", [0, 0, 0]],
    };
  }

  K.defCt("boar", {
    variant(level, spec) {
      if (spec === "B") return level === 7 ? catapult() : sow(level);
      return classic(level, spec);
    },
    info(level, spec) {
      return INFO[spec ? spec + level : String(level)] || null;
    },
  });
})();
