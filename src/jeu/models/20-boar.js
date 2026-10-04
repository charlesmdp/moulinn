// « Pas touche à mes trésors » — tours SANGLIER (cases d'herbe) : tirent des bogues de châtaigne à la suite
// (attaque « shot », CONCEPTION.md §1.1).
//
//   1 Marcassin            : gros marcassin rayé beige et brun qui sort d'une petite bauge de branchages.
//   2 Jeune sanglier       : pelage roux, petites défenses, bauge plus grande au toit de feuilles.
//   3 Sanglier des talus   : grand sanglier brun-noir, crête de poils, défenses blanches, bauge au toit de
//                            mousse, palissade complète.
//   A4-6 Sanglier chasseur : bandeau rouge, cicatrice, longues défenses, pose ramassée ; le camp s'enrichit
//                            (rubans rouges, cible de paille, trophée de cerf) ; coups critiques.
//   A7 Grand Solitaire     : énorme vieux mâle gris argent, défenses baguées d'or, bauge fortifiée et torches ;
//                            lance DEUX bogues à la fois (une au bout de chaque défense : deux cibles).
//   B4-6 Laie baliste      : laie qui porte une petite catapulte de bois sur le dos (grosse bogue en cloche).
//   B7 Catapulte à châtaignes : vraie catapulte de bois, la laie au levier et deux marcassins qui chargent.
//
// Socle (couleur de famille brun et vert mousse) : anneau de mousse bosselée, terre brune, litière de paille
// où se tient la bête ; à l'arrière la bauge, dôme de branchages au toit de feuilles (puis de mousse) percé
// d'une entrée sombre d'où sort le sanglier ; palissade de pieux taillés ; fanion à étoiles (niveau).
// Attaque : élan (la bête recule, groin au ras du sol, une bogue apparaît au bout du groin) puis petit coup
// de groin vers l'avant qui lance la bogue ; la laie et la catapulte arment puis détendent leur bras.
// Voir models/10-kit.js pour la coque commune (visée, attaque, éblouissement, frénésie, sélection, célébration).
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
    earth: "#9a6a3a",
    earthD: "#5e3e20",
    rim: "#3a2614",
    moss: "#5c9e30",
    mossL: "#8cc444",
    straw: "#e8c862",
    strawD: "#b8923e",
    mud: "#4a3322",
    grass: "#6fa03a",
    grassL: "#9cc24a",
    stake: "#b0844e",
    stakeD: "#6b4a2c",
    stakeTip: "#d8b07a",
    rope: "#d8b878",
    twig: "#6e4a2a",
    twigL: "#9a6c3c",
    leaf: "#4f8f2c",
    leafL: "#7cb83e",
    dark: "#160e08",
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
    iron: "#4a4a50",
    leather: "#8a4a2a",
    blanket: "#3a7ad8",
    gold: "#ffd23a",
    torch: "#ffb347",
  };

  /* ---------------------------------------------------------------- sol de la bauge */
  /**
   * Socle de couleur de famille (brun et vert mousse) : liseré sombre, anneau de mousse bosselée, terre brune
   * légèrement bombée, litière de paille sous la bête. o = { R (rayon extérieur), seed, bed (couleur de la
   * litière), bedR, bedZ, mossC } ; renvoie la hauteur du dessus de la terre.
   */
  function ground(R, o) {
    const r = o.R;
    const top = 0.14;
    R.add(G.discUp(r + 0.02, 28), "root", { p: [0, 0.012, 0], c: C.rim, ol: false });
    // Terre bombée (dessus à « top »).
    R.add(
      G.lathe(
        "bauge4:" + r,
        [
          [r - 0.12, 0.06],
          [r - 0.3, top * 0.85],
          [r * 0.55, top],
          [0.001, top + 0.02],
        ],
        20,
      ),
      "root",
      { gp: [C.earthD, C.earth, 0.06, top], pat: PAT.stone, ol: false },
    );
    // Anneau de mousse : boudin bosselé (touffes) tout autour, deux verts alternés.
    const rnd = PTMT.rng(o.seed || 7);
    R.add(mossRing(r - 0.17, 0.2, 14), "root", { p: [0, 0.07, 0], g: [o.mossC || C.moss, C.mossL, -0.05, 0.16], pat: PAT.leaf, ol: false });
    // Litière de paille (où se tient la bête).
    const bz = o.bedZ === undefined ? 0.2 : o.bedZ;
    R.add(G.discUp(o.bedR || 0.82, 18), "root", { p: [0, top + 0.022, bz], s: [1, 1, 0.9], c: o.bed || C.straw, pat: PAT.straw, uv: [8, 0.5], ol: false });
    for (let i = 0; i < 5; i++) {
      const a = rnd() * TAU,
        d = (o.bedR || 0.82) * (0.75 + rnd() * 0.3);
      R.add(G.cyl(0.018, 0.018, 0.34 + rnd() * 0.2, 3), "root", { p: [Math.sin(a) * d, top + 0.04, bz + Math.cos(a) * d * 0.9], r: [Math.PI / 2, rnd() * 3, 0], ro: "YXZ", c: i % 2 ? C.straw : C.strawD, ol: false });
    }
    return top;
  }

  /* ---------------------------------------------------------------- bauge : hutte de branchages */
  /**
   * Hutte en ruche (profil de révolution étiré en profondeur), toit de brindilles, de feuilles ou de mousse,
   * pointe de branches en faisceau, grande entrée sombre tournée vers l'avant (vers la caméra), d'où sort
   * la bête. o = { z (centre), rx, ry (hauteur), rz (profondeur), roof: "twigs" | "leaves" | "moss", sticks,
   *   leaves (touffes), lintel (rondin et montants), door (largeur relative de l'entrée), cloth (tenture), y0, seed }
   */
  function den(R, o) {
    const z = o.z,
      y0 = o.y0 || 0.1,
      rx = o.rx,
      ry = o.ry,
      rz = o.rz;
    const roof = o.roof || "twigs";
    const prof = [
      [1.0, 0.0],
      [0.99, 0.28],
      [0.9, 0.58],
      [0.7, 0.82],
      [0.42, 0.96],
      [0.12, 1.0],
      [0.001, 1.0],
    ];
    R.add(G.lathe("bauge5", prof, 13), "root", { p: [0, y0, z], s: [rx, ry, rz], g: [C.twig, roof === "moss" ? C.moss : roof === "leaves" ? C.leaf : C.twigL, 0.25, 1.0], pat: roof === "twigs" ? PAT.wood : PAT.leaf, uv: [9, 4], ol: true });
    // Ceinture de branches couchées au pied de la hutte (bord net, couleur bois).
    R.add(G.torus(1, 0.09, 3, 16), "root", { p: [0, y0 + 0.05, z], r: [Math.PI / 2, 0, 0], s: [rx * 0.99, rz * 0.99, 1], c: C.stakeD, pat: PAT.wood, ol: false });
    // Entrée sombre (arche) collée à la pente avant de la hutte, tournée vers la caméra.
    const dw = rx * (o.door || 0.7),
      dh = ry * 0.62;
    const arch = [];
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI - (i / 10) * Math.PI;
      arch.push([Math.cos(a) * dw * 0.5, Math.sin(a) * dh]);
    }
    R.add(G.extrude("bauge5:door:" + dw.toFixed(2) + ":" + dh.toFixed(2), arch, 0.12, 0), "root", { p: [0, y0 - 0.02, z + rz * 0.93], r: [-0.42, 0, 0], c: C.dark, ol: false });
    // Linteau : rondin au-dessus de l'entrée, montants.
    if (o.lintel) {
      R.add(G.cyl(0.075, 0.075, dw * 1.3, 6), "root", { p: [0, y0 + dh * 0.95, z + rz * 0.62], r: [0, 0, Math.PI / 2], c: C.stakeD, pat: PAT.wood, ol: true });
      for (const sx of [-1, 1]) R.add(G.cyl(0.065, 0.075, dh * 1.02, 6), "root", { p: [sx * dw * 0.56, y0 + dh * 0.5, z + rz * 0.84], r: [-0.42, 0, 0], c: C.stakeD, pat: PAT.wood, ol: true });
    }
    // Faisceau de branches au sommet (pointe de la hutte) et branches couchées sur la pente.
    const rnd = PTMT.rng(o.seed || 11);
    const top = y0 + ry;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + 0.4;
      R.add(G.cyl(0.035, 0.05, ry * 0.75, 4), "root", { p: [Math.sin(a) * 0.1, top + ry * 0.12, z + Math.cos(a) * 0.08], r: [Math.cos(a) * 0.42, 0, -Math.sin(a) * 0.42], c: i % 2 ? C.twig : C.stakeD, pat: PAT.wood, ol: true });
    }
    const ns = o.sticks || 6;
    for (let i = 0; i < ns; i++) {
      const a = (i / ns) * TAU + (rnd() - 0.5) * 0.4;
      const L = ry * (0.8 + rnd() * 0.3);
      R.add(G.cyl(0.03, 0.04, L, 4), "root", {
        p: [Math.sin(a) * rx * 0.62, y0 + ry * 0.62, z + Math.cos(a) * rz * 0.62],
        r: [Math.cos(a) * 0.75, 0, -Math.sin(a) * 0.75 * (rx / Math.max(rx, rz))],
        c: i % 2 ? C.twig : C.stakeD,
        pat: PAT.wood,
        ol: false,
      });
    }
    // Touffes de feuilles ou de mousse sur le toit.
    const nl = o.leaves || 0;
    for (let i = 0; i < nl; i++) {
      const a = (i / nl) * TAU + rnd() * 0.5 + 0.6;
      const u = 0.45 + rnd() * 0.25;
      const x = Math.sin(a) * rx * u,
        zz = z + Math.cos(a) * rz * u;
      const yy = y0 + ry * (1 - u * u * 0.7);
      R.add(G.blob(0.26 + rnd() * 0.08, 0, 0.18, 3 + i), "root", { p: [x, yy, zz], s: [1.2, 0.65, 1], c: i % 2 ? C.leafL : C.leaf, pat: PAT.leaf, ol: false });
    }
    // Tenture colorée au-dessus de l'entrée (chasseur, laie).
    if (o.cloth) {
      R.add(
        G.extrude(
          "bauge4:cloth",
          [
            [-0.42, 0],
            [0.42, 0],
            [0.38, -0.34],
            [0.18, -0.24],
            [0, -0.4],
            [-0.18, -0.24],
            [-0.38, -0.34],
          ],
          0.03,
          0,
        ),
        "root",
        { p: [0, y0 + dh * 1.22, z + rz * 0.6], r: [-0.55, 0, 0], c: o.cloth, cls: CLS.satin, ol: true },
      );
    }
  }

  /* ---------------------------------------------------------------- palissade de pieux */
  /** o = { r, n, a0, a1 (angles, 0 = +Z), H, y, ribbons (couleur), seed, rope } */
  function palisade(R, o) {
    const rnd = PTMT.rng(o.seed || 5);
    const pts = [];
    for (let i = 0; i < o.n; i++) {
      const a = o.a0 + (i / Math.max(1, o.n - 1)) * (o.a1 - o.a0);
      const x = Math.sin(a) * o.r,
        z = Math.cos(a) * o.r;
      const hh = o.H * (0.85 + rnd() * 0.3);
      const tilt = (rnd() - 0.5) * 0.14;
      R.add(G.cyl(0.08, 0.09, hh, 5, true), "root", { p: [x, o.y + hh / 2, z], r: [tilt, 0, (rnd() - 0.5) * 0.14], c: i % 2 ? C.stake : C.stakeD, pat: PAT.wood, uv: [0.5, 1.5], ol: true });
      R.add(G.cone(0.08, 0.22, 5, true), "root", { p: [x, o.y + hh + 0.11, z], r: [tilt, 0, 0], c: C.stakeTip, pat: PAT.wood, ol: false });
      if (o.ribbons && i % 2 === 0) R.add(G.box(0.2, 0.07, 0.05), "root", { p: [x, o.y + hh * 0.72, z], r: [0, a, 0.3], c: o.ribbons, cls: CLS.satin, ol: false });
      pts.push([x, o.y + hh * 0.55, z]);
    }
    if (o.rope !== false && pts.length > 2) R.add(G.tube("bauge4:rope:" + o.r + ":" + o.n + ":" + o.a0.toFixed(2) + ":" + o.a1.toFixed(2), pts, [0.028, 0.028], pts.length + 2, 3), "root", { c: C.rope, ol: false });
  }

  /** Boudin de mousse bosselé (tore dont l'épaisseur ondule : touffes), géométrie partagée. */
  function mossRing(R0, r, lumps) {
    return PTMT.geo("boar:moss:" + R0 + ":" + r + ":" + lumps, () => {
      const g = new THREE.TorusGeometry(R0, r, 5, lumps * 3);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i),
          y = p.getY(i),
          z = p.getZ(i);
        const a = Math.atan2(y, x);
        const cx = Math.cos(a) * R0,
          cy = Math.sin(a) * R0;
        const k = 1 + 0.3 * Math.cos(a * lumps) + 0.08 * Math.sin(a * lumps * 2.3);
        p.setXYZ(i, cx + (x - cx) * k, cy + (y - cy) * k, z * k * 0.7);
      }
      g.rotateX(-Math.PI / 2);
      g.computeVertexNormals();
      return g;
    });
  }

  /** Réserve de bogues et de châtaignes au pied de la palissade. */
  function pile(R, x, z, y, n) {
    for (let i = 0; i < n; i++) {
      const a = i * 2.4,
        d = 0.05 + Math.sqrt(i / Math.max(1, n)) * 0.24;
      R.add(G.nut(0.09), "root", { p: [x + Math.sin(a) * d, y + 0.06 + (0.3 - d) * 0.3, z + Math.cos(a) * d], r: [0.5 + (i % 3) * 0.4, a, 0.3 * (i % 2)], c: i % 3 ? C.nut : "#8e4e26", cls: CLS.glossy, ol: false });
    }
    for (let i = 0; i < Math.ceil(n / 3); i++) {
      const a = 0.7 + i * 2.2;
      R.add(G.husk(0.075), "root", { p: [x + Math.sin(a) * 0.28, y + 0.1, z + Math.cos(a) * 0.28], r: [i, i * 2, 0], c: i % 2 ? C.husk : C.huskD, flat: true, ol: false });
    }
  }

  /* ---------------------------------------------------------------- sanglier paramétrique */
  /**
   * P = { k (échelle du corps), hr (rayon de la tête), fur, back (dos, pattes, oreilles), belly, pat,
   *       body: [rx, rz (demi-longueur), ry], eyeR, iris, lid, slant, brow, browT, browW, lash, ear,
   *       tusk (longueur), tuskCurl, tuskW, tuskRing, crest (mèches), crestH, crestC, mane, maneC, snout,
   *       snoutFur, bandana, scar, crouch, backDark (dos plus sombre), twin (deux bogues aux défenses),
   *       lite (modèle secondaire allégé) }
   * o = { pre (préfixe des os), parent, at: [x, y, z] }
   * Os : <pre>yaw → <pre>body → <pre>head (<pre>earL/R, <pre>held | heldL/heldR, <pre>knot), <pre>tail ;
   * jambes sous <pre>yaw.
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
    R.add(G.sphere(1, lite ? 9 : 12, lite ? 6 : 8), B("body"), {
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
    R.add(G.sphere(hr, lite ? 9 : 11, lite ? 6 : 7), B("head"), { p: hc, s: [1.02, 0.94, 1], c: P.fur, pat: PAT.fur, gp: [P.belly, P.fur, hc[1] - hr * 0.8, hc[1] + hr * 0.1], ol: true });
    // Groin.
    const sl = P.snoutL || 1;
    const sz = hc[2] + hr * 0.84;
    R.add(G.cyl(hr * 0.42, hr * 0.5, hr * 0.62 * sl, 8, true), B("head"), { p: [0, hc[1] - hr * 0.24, sz], r: [Math.PI / 2 - 0.1, 0, 0], c: P.snoutFur || P.fur, pat: PAT.fur, ol: true });
    const nz = sz + hr * 0.31 * sl;
    R.add(G.cyl(hr * 0.46, hr * 0.46, hr * 0.13, 10), B("head"), { p: [0, hc[1] - hr * 0.2, nz], r: [Math.PI / 2 - 0.1, 0, 0], c: P.snout || C.snout, cls: CLS.satin, ol: true });
    for (const sx of [-1, 1]) R.add(G.sphere(hr * 0.1, 5, 3), B("head"), { p: [sx * hr * 0.17, hc[1] - hr * 0.2, nz + hr * 0.07], s: [1, 1.35, 0.5], c: C.nostril, ol: false });
    // Bouche (petit sourire sous le groin).
    R.add(G.torus(hr * 0.22, hr * 0.04, 3, 8, Math.PI), B("head"), { p: [0, hc[1] - hr * 0.62, sz - hr * 0.02], r: [-0.3, 0, Math.PI], c: "#3a1a18", ol: false });
    // Défenses.
    const tusks = [];
    if (P.tusk) {
      const tl = P.tusk * k;
      const curl = P.tuskCurl || 1;
      const tp = [
        [0, 0, 0],
        [0.03, 0.25, 0.25],
        [0.1 + 0.08 * (curl - 1), 0.62, 0.42],
        [0.2 * curl, 0.95, 0.3],
      ].map(([x, y, z]) => [x * tl * 2.2, y * tl * 1.1, z * tl]);
      for (const sx of [-1, 1]) {
        const base = [sx * hr * 0.36, hc[1] - hr * 0.42, sz + hr * 0.05];
        R.add(
          G.tube(
            "tusk:" + P.tusk + ":" + curl + ":" + k + ":" + (P.tuskW || 1),
            tp,
            // effilée jusqu'à une pointe
            (t) => (0.012 + (1 - t) * 0.058) * (P.tuskW || 1) * k + 0.003,
            5,
            5,
          ),
          B("head"),
          { p: base, s: [sx, 1, 1], c: C.tusk, cls: CLS.glossy, ol: true },
        );
        tusks.push([base[0] + sx * tp[3][0], base[1] + tp[3][1], base[2] + tp[3][2]]);
      }
      // Bagues d'or sur les défenses (vieux mâle légendaire).
      if (P.tuskRing) {
        const tr = (0.012 + 0.74 * 0.058) * (P.tuskW || 1) * k + 0.003;
        for (const sx of [-1, 1])
          R.add(G.torus(tr * 1.08, tr * 0.26, 4, 10), B("head"), {
            p: [sx * (hr * 0.36 + 0.066 * tl), hc[1] - hr * 0.42 + 0.27 * tl, sz + hr * 0.05 + 0.24 * tl],
            r: [-0.84, 0, 0],
            c: P.tuskRing,
            cls: CLS.gold,
            ol: true,
          });
      }
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
    } else
      K.ctEyes(R, B("head"), {
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
        glowIris: P.glowIris,
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
    // Bogue tenue au bout du groin pendant l'élan (ou une à chaque défense : Grand Solitaire).
    if (!lite) {
      const huskR = Math.max(0.15, hr * 0.32);
      const hold = (nm, at) => {
        R.bone(B(nm), B("head"), at);
        R.add(G.husk(huskR), B(nm), { c: C.husk, flat: true, ol: false });
        R.add(G.nut(huskR * 0.75), B(nm), { p: [0, huskR * 0.7, huskR * 0.25], c: C.nut, cls: CLS.glossy, ol: false });
      };
      hold("held", [0, hc[1] - hr * 0.12, nz + hr * 0.3]);
      if (P.twin && tusks.length) {
        hold("heldL", [tusks[0][0], tusks[0][1] + 0.05, tusks[0][2] + 0.05]);
        hold("heldR", [tusks[1][0], tusks[1][1] + 0.05, tusks[1][2] + 0.05]);
      }
    }
    // Bandeau de chasseur : cercle qui épouse le crâne (plan incliné vers l'arrière, passe au-dessus
    // des yeux), nœud derrière la tête et deux pans qui flottent.
    if (P.bandana) {
      R.add(G.torus(hr * 0.87, hr * 0.1, 3, 14), B("head"), { p: [0, hc[1] + hr * 0.46, hc[2] - hr * 0.25], r: [Math.PI / 2 - 0.5, 0, 0], c: P.bandana, cls: CLS.satin, ol: true });
      R.bone(B("knot"), B("head"), [0, hc[1] + hr * 0.2, hc[2] - hr * 0.98]);
      R.add(G.sphere(hr * 0.17, 6, 4), B("knot"), { c: P.bandana, cls: CLS.satin, ol: false });
      for (const sx of [-1, 1])
        R.add(G.cone(hr * 0.16, hr * 0.85, 4, true), B("knot"), { p: [sx * hr * 0.14, -hr * 0.1, -hr * 0.36], r: [-1.9, sx * 0.45, 0], s: [1, 1, 0.35], c: P.bandana, cls: CLS.satin, ol: true });
      R.sway(B("knot"), "x", 0, 0.2, 7, 0);
      R.sway(B("knot"), "y", 0, 0.25, 4.3, 1);
    }
    // Cicatrice en travers de l'œil droit.
    if (P.scar) R.add(G.capsule(hr * 0.06, hr * 0.75, 4, 2), B("head"), { p: [-hr * 0.47, hc[1] + hr * 0.55, hc[2] + hr * 0.68], r: [-0.6, 0.35, 0.75], c: C.scar, cls: CLS.satin, ol: false });
    // Étoiles d'éblouissement.
    if (!lite) K.ctDizzy(R, B("head"), { p: [0, hc[1] + hr * 1.45, hc[2]], r: hr * 0.95, size: Math.max(0.13, hr * 0.3) });
    R.sway(B("earL"), "z", 0, 0.08, 1.7, 0);
    R.sway(B("earR"), "z", 0, 0.08, 1.9, 2);
    return { hc, nz };
  }

  /** Animation commune des sangliers : élan (recule, groin au sol) puis petit coup de groin qui lance la bogue. */
  function boarPose(st, B, P) {
    const k = P.k;
    const t = st.t + st.phase;
    const w = easeInOut(st.w),
      s = st.s;
    const br = Math.sin(t * (2.1 + st.fr * 2));
    const fid = bump(1 - st.fid);
    const r0 = B.body.userData.rest;
    const crouch = P.crouch || 0;
    const dz = st.dz;
    const wob = Math.sin(st.time * 7) * dz;
    B.body.position.set(0, r0.y + br * 0.012 * k - w * 0.07 * k + s * 0.03 * k - crouch * 0.05 * k, r0.z - w * 0.1 * k + s * 0.2 * k);
    B.body.rotation.set(crouch * 0.1 + w * 0.16 - s * 0.1 + (st.fidK === 1 ? fid * 0.08 : 0), 0, -clamp(st.turn, -3, 3) * 0.04 + wob * 0.08);
    B.body.scale.set(1 + br * 0.016, 1 + br * 0.022, 1);
    // Tête : groin au ras du sol (élan), coup de groin vers l'avant (détente) ; renifle ou s'ébroue au repos.
    const sniff = st.fidK === 2 ? fid * Math.sin(t * 22) * 0.08 : 0;
    const shake = st.fidK === 0 ? fid * Math.sin(t * 26) * 0.35 : 0;
    B.head.rotation.set(-0.2 + crouch * 0.12 + Math.sin(t * 0.8) * 0.04 + w * 0.6 - s * 0.55 + sniff, Math.sin(t * 0.55) * 0.18 * (1 - w) + shake + wob * 0.45, shake * 0.3 + wob * 0.4);
    const holding = st.ae >= 0 && s === 0 ? Math.max(0.001, Math.min(1, st.w * 1.8)) : 0.001;
    B.held.scale.setScalar(P.twin ? 0.001 : holding);
    if (B.heldL) {
      B.heldL.scale.setScalar(holding);
      B.heldR.scale.setScalar(holding);
    }
    // Patte avant qui gratte le sol (manie) ou qui prend appui à la détente.
    const paw = st.fidK === 1 ? fid * Math.max(0, Math.sin(t * 9)) : 0;
    B.legFL.rotation.x = -paw * 0.7 - s * 0.3 + w * 0.15;
    B.legFR.rotation.x = -s * 0.3 + w * 0.15;
    B.legBL.rotation.x = w * 0.2 - s * 0.1;
    B.legBR.rotation.x = w * 0.2 - s * 0.1;
    const back = w * 0.5 + st.fr * 0.4;
    B.earL.rotation.x = -back;
    B.earR.rotation.x = -back;
    st.eyeOpen = s > 0.2 ? 0.9 : w > 0.1 ? -0.8 * w : st.fr > 0.3 ? -0.6 : 0;
    if (st.ae >= 0) st.look = 0;
  }

  /* ---------------------------------------------------------------- réglages par niveau */
  const PIGLET = { k: 1.22, hr: 0.46, fur: "#c8823e", back: "#6e4628", belly: "#f4d8a8", pat: PAT.stripes, eyeR: 0.15, iris: "#3b2414", ear: 1.15, tusk: 0, snoutFur: "#d8985a", lid: -0.8, slant: 0.02, brow: "#5a3a20", browT: 0.022 };
  const YOUNG = { k: 1.38, hr: 0.46, fur: "#c8582a", back: "#7a3418", belly: "#f0b27a", pat: PAT.fur, eyeR: 0.13, iris: "#2e1a10", ear: 1.1, crest: 6, crestH: 0.9, tusk: 0.15, snoutFur: "#d07a48", brow: "#5a2a14", browT: 0.026, slant: 0.14, lid: -0.62, backDark: true };
  const ADULT = { k: 1.55, hr: 0.47, fur: "#5e4a3c", back: "#251c18", belly: "#8e7866", pat: PAT.fur, eyeR: 0.115, iris: "#2a1810", ear: 1.05, crest: 11, crestH: 1.3, tusk: 0.23, snoutFur: "#735e50", snout: "#e89a8a", brow: "#1a1410", browT: 0.028, slant: 0.26, lid: -0.5, backDark: true };
  const HUNTER = { k: 1.62, hr: 0.48, fur: "#6e4e3a", back: "#34261e", belly: "#a07e62", pat: PAT.fur, eyeR: 0.105, iris: "#2a1810", crest: 12, crestH: 1.35, tusk: 0.3, tuskCurl: 1.3, snoutFur: "#7e604e", snout: "#e89a8a", brow: "#1a1410", browT: 0.028, slant: 0.42, lid: -0.34, bandana: C.red, scar: true, crouch: 1, backDark: true };
  // Grand Solitaire : vieux mâle charbonneux à crinière et crête d'argent, yeux d'ambre ardents,
  // défenses baguées d'or (de face comme d'en haut : un sanglier, pas un rhinocéros blanc).
  const SOLITAIRE = {
    k: 2.05,
    hr: 0.58,
    fur: "#57514b",
    back: "#2c2826",
    belly: "#8e867c",
    pat: PAT.fur,
    eyeR: 0.11,
    iris: "#ffb42a",
    glowIris: true,
    crest: 15,
    crestH: 1.55,
    crestC: "#eeebe4",
    tusk: 0.27,
    tuskCurl: 1.8,
    tuskW: 1.2,
    tuskRing: C.gold,
    snoutFur: "#6c645d",
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
    twin: true,
  };
  const SOW = { k: 1.6, hr: 0.46, fur: "#96694a", back: "#5e4230", belly: "#e0bc94", pat: PAT.fur, eyeR: 0.12, iris: "#3b2414", crest: 4, crestH: 0.6, tusk: 0, snoutFur: "#a67552", lash: "#120c0a", slant: -0.05, lid: -0.66, body: [0.4, 0.49, 0.34] };

  // Hauteur réelle du sommet (m, mesurée sur les gabarits) et rayon d'emprise au sol (m) : ctTowerInfo sans construire.
  const INFO = {
    1: { height: 2.0, footprint: 1.55 },
    2: { height: 2.2, footprint: 1.55 },
    3: { height: 2.4, footprint: 1.55 },
    A4: { height: 2.75, footprint: 1.55 },
    A5: { height: 2.9, footprint: 1.55 },
    A6: { height: 3.05, footprint: 1.55 },
    A7: { height: 3.9, footprint: 1.6 },
    B4: { height: 2.75, footprint: 1.55 },
    B5: { height: 2.9, footprint: 1.55 },
    B6: { height: 3.05, footprint: 1.55 },
    B7: { height: 3.9, footprint: 1.6 },
  };
  const FLAG = { color: "#4f8f2c", trim: "#6e4628" };

  /* ---------------------------------------------------------------- niveaux 1 à 3, chasseur, Grand Solitaire */
  function classic(level, spec) {
    const lv = spec ? spec + level : String(level);
    const P = level === 1 ? PIGLET : level === 2 ? YOUNG : level === 3 ? ADULT : level === 7 ? SOLITAIRE : HUNTER;
    const big = level === 7;
    const deco = level >= 4 ? level - 3 : 0; // 1..3 pour le chasseur
    const Rr = big ? 1.6 : 1.55;
    const L = Math.min(level, 4);
    return {
      key: "boar4:" + lv,
      release: 0.12, // = élan de la simulation (sanglier)
      dur: 0.6,
      ring: Rr + 0.08,
      footprint: INFO[lv].footprint,
      turn: level >= 4 ? 8.5 : 6.5,
      jumpH: big ? 0.35 : 0.5,
      attackKind: "shot",
      author(R) {
        const top = ground(R, { R: Rr, seed: 3 + level, bedR: big ? 1.0 : 0.72 + L * 0.04, bedZ: big ? 0.3 : 0.25, bed: level === 1 ? C.mud : C.straw });
        den(R, {
          z: big ? -0.9 : -0.78 - L * 0.02,
          y0: top - 0.02,
          rx: big ? 1.2 : 0.88 + L * 0.06,
          ry: big ? 1.55 : 0.98 + L * 0.1,
          rz: big ? 0.72 : 0.58 + L * 0.03,
          roof: level === 1 ? "twigs" : level === 2 ? "leaves" : "moss",
          sticks: big ? 9 : 4 + L,
          leaves: level === 1 ? 2 : level === 2 ? 5 : 4,
          lintel: level >= 3,
          door: big ? 0.6 : 0.66,
          cloth: deco >= 1 || big ? C.red : null,
          seed: 11 + level,
        });
        palisade(R, {
          r: Rr - 0.2,
          n: big ? 15 : level === 1 ? 5 : level === 2 ? 8 : level === 3 ? 11 : 11,
          a0: big ? 0.75 : level === 1 ? 2.3 : level === 2 ? 1.9 : 1.55,
          a1: big ? TAU - 0.75 : level === 1 ? TAU - 2.3 : level === 2 ? TAU - 1.9 : TAU - 1.55,
          H: big ? 1.35 : 0.7 + L * 0.08,
          y: top - 0.05,
          ribbons: deco >= 2 || big ? C.red : null,
          seed: 5 + level,
          rope: level >= 2,
        });
        pile(R, Rr * 0.52, Rr * 0.36, top, big ? 4 : Math.min(3, 1 + L));
        K.ctPennant(R, {
          p: [-Rr * 0.6, top - 0.05, -Rr * 0.48],
          h: big ? 3.2 : level >= 4 ? 2.2 + deco * 0.14 : 1.5 + level * 0.15,
          color: level >= 4 ? C.red : FLAG.color,
          trim: level >= 4 ? C.gold : FLAG.trim,
          stars: level >= 4 ? (big ? 3 : deco) : level,
          len: big ? 0.95 : 0.8,
          tall: big ? 0.6 : 0.52,
          starR: big ? 0.15 : 0.13,
          thick: 0.04,
          tail: level >= 4 ? "swallow" : "point",
          dir: Math.PI - 0.15,
          tilt: 0.5,
        });
        boar(R, P, { at: [0, top - 0.02, big ? 0.32 : 0.26] });
        // Camp du chasseur : cible de paille (5+), trophée de cerf (6+).
        if (deco >= 2 || big) {
          const x = Rr * 0.66,
            z = -Rr * 0.42,
            y = top;
          R.add(G.cyl(0.05, 0.05, 1.0, 4, true), "root", { p: [x, y + 0.5, z], c: C.stakeD, pat: PAT.wood, ol: true });
          R.add(G.cyl(0.34, 0.34, 0.1, 10), "root", { p: [x, y + 0.98, z + 0.05], r: [Math.PI / 2 - 0.45, 0, 0], c: C.straw, pat: PAT.straw, ol: true });
          for (const [rr, cc] of [
            [0.26, C.red],
            [0.16, "#ffffff"],
            [0.07, C.red],
          ])
            R.add(G.disc(rr, 9), "root", { p: [x, y + 0.98 + Math.sin(0.45) * (0.056 + 0.03 * (0.3 - rr)), z + 0.05 + Math.cos(0.45) * (0.056 + 0.03 * (0.3 - rr))], r: [-0.45, 0, 0], c: cc, cls: CLS.satin, ol: false });
        }
        if (deco >= 3 || big) {
          const x = -Rr * 0.78,
            z = Rr * 0.1,
            y = top;
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
                4,
                4,
              ),
              "root",
              { p: [x, y + 1.2, z], s: [sx, 1, 1], c: "#efe2c2", ol: true },
            );
          }
          R.add(G.sphere(0.13, 6, 4), "root", { p: [x, y + 1.2, z + 0.04], s: [0.9, 0.8, 1.1], c: "#f2ead8", ol: true });
          for (const sx of [-1, 1]) R.add(G.sphere(0.035, 4, 3), "root", { p: [x + sx * 0.05, y + 1.23, z + 0.15], c: "#1a1410", ol: false });
        }
        // Bauge fortifiée du Grand Solitaire : torches à l'entrée.
        if (big) {
          for (const sx of [-1, 1]) {
            const a = sx * 0.75;
            const rho = Rr - 0.22;
            const x = Math.sin(a) * rho,
              z = Math.cos(a) * rho,
              y = top;
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
      muzzle: P.twin ? ["heldL", [0, 0, 0]] : ["held", [0, 0, 0]],
      muzzles: P.twin ? [["heldR", [0, 0, 0]]] : undefined,
    };
  }

  /* ---------------------------------------------------------------- laie baliste (B4-6) */
  function sow(level) {
    const deco = level - 3;
    const Rr = 1.55;
    const P = SOW;
    return {
      key: "boar4:B" + level,
      release: 0.192, // = élan de la simulation (grosse châtaigne : 0,12 × 1,6)
      dur: 0.95,
      ring: Rr + 0.08,
      footprint: INFO["B" + level].footprint,
      turn: 5,
      attackKind: "shot",
      author(R) {
        const top = ground(R, { R: Rr, seed: 20 + level, bedR: 0.86, bedZ: 0.2 });
        den(R, { z: -0.92, y0: top - 0.02, rx: 1.05, ry: 1.25, rz: 0.6, roof: "moss", sticks: 6, leaves: 4, lintel: true, door: 0.66, cloth: "#e0a020", seed: 30 + level });
        palisade(R, { r: Rr - 0.2, n: 9, a0: 1.75, a1: TAU - 1.75, H: 0.8, y: top - 0.05, seed: 20 + level });
        pile(R, Rr * 0.55, Rr * 0.3, top, 3);
        K.ctPennant(R, { p: [-Rr * 0.6, top - 0.05, -Rr * 0.48], h: 2.2 + deco * 0.14, color: "#e0a020", trim: C.redD, stars: deco, len: 0.8, tall: 0.52, starR: 0.13, thick: 0.04, tail: "swallow", dir: Math.PI - 0.15, tilt: 0.5 });
        boar(R, P, { at: [0, top - 0.02, 0.22] });
        const k = P.k;
        const tp = P.body[2] * k * 0.98;
        // Couverture bleue, selle et bâti de la catapulte sur le dos.
        R.add(G.sphere(1, 14, 5, 0, Math.PI * 0.38), "body", { p: [0, 0.02 * k, -0.02 * k], s: [P.body[0] * k * 1.04, P.body[2] * k * 1.05, P.body[1] * k * 0.8], c: C.blanket, cls: CLS.satin, ol: true });
        R.add(G.box(0.62 * k, 0.05 * k, 0.5 * k), "body", { p: [0, tp + 0.02 * k, -0.02 * k], c: C.leather, pat: PAT.wood, ol: true });
        for (const sx of [-1, 1]) {
          R.add(G.box(0.06 * k, 0.42 * k, 0.07 * k), "body", { p: [sx * 0.2 * k, tp + 0.22 * k, 0.06 * k], r: [0.28, 0, 0], c: C.stake, pat: PAT.wood, ol: true });
          R.add(G.box(0.06 * k, 0.42 * k, 0.07 * k), "body", { p: [sx * 0.2 * k, tp + 0.22 * k, -0.14 * k], r: [-0.28, 0, 0], c: C.stake, pat: PAT.wood, ol: true });
        }
        // Butée (barre transversale à l'avant) et écheveau de corde (torsion) sur l'axe.
        R.add(G.cyl(0.035 * k, 0.035 * k, 0.5 * k, 5), "body", { p: [0, tp + 0.44 * k, 0.16 * k], r: [0, 0, Math.PI / 2], c: C.stakeD, pat: PAT.wood, ol: true });
        R.add(G.cyl(0.07 * k, 0.07 * k, 0.34 * k, 8), "body", { p: [0, tp + 0.12 * k, -0.04 * k], r: [0, 0, Math.PI / 2], c: C.rope, pat: PAT.straw, ol: true });
        if (deco >= 3) for (const sx of [-1, 1]) R.add(G.torus(0.075 * k, 0.012 * k, 3, 10), "body", { p: [sx * 0.12 * k, tp + 0.12 * k, -0.04 * k], r: [0, Math.PI / 2, 0], c: C.iron, cls: CLS.metal, ol: false });
        // Bras (pivote autour de l'axe X), cuillère et grosse bogue.
        R.bone("arm", "body", [0, tp + 0.12 * k, -0.04 * k]);
        const al = 0.5 * k;
        R.add(G.box(0.05 * k, 0.05 * k, al), "arm", { p: [0, 0, -al / 2], c: C.stake, pat: PAT.wood, ol: true });
        R.add(G.sphere(0.12 * k, 8, 4, 0, Math.PI / 2), "arm", { p: [0, 0.02 * k, -al], r: [Math.PI, 0, 0], s: [1, 0.7, 1], c: C.stakeD, pat: PAT.wood, ol: true });
        R.bone("ammo", "arm", [0, 0.1 * k, -al]);
        R.add(G.husk(0.1 * k), "ammo", { c: C.husk, flat: true, ol: true });
        R.add(G.nut(0.08 * k), "ammo", { p: [0, 0.08 * k, 0], c: C.nut, cls: CLS.glossy, ol: false });
        // Panier de munitions (5+) et petit fanion sur le bâti (6).
        if (deco >= 2) {
          R.add(G.cyl(0.14 * k, 0.1 * k, 0.2 * k, 8, true), "body", { p: [0.44 * k, 0.08 * k, -0.1 * k], c: C.straw, pat: PAT.straw, ol: true });
          for (let i = 0; i < 3; i++) R.add(G.nut(0.055 * k), "body", { p: [0.44 * k + (i - 1) * 0.07 * k, 0.17 * k, -0.1 * k + (i % 2) * 0.05 * k], r: [0.4, i, 0], c: C.nut, cls: CLS.glossy, ol: false });
        }
        if (deco >= 3) {
          R.add(G.cyl(0.012 * k, 0.012 * k, 0.5 * k, 4), "body", { p: [-0.2 * k, tp + 0.62 * k, -0.2 * k], c: C.stakeD, ol: false });
          R.bone("mini", "body", [-0.2 * k, tp + 0.8 * k, -0.2 * k]);
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
        const wob = Math.sin(st.time * 7) * st.dz;
        B.body.position.set(0, r0.y + br * 0.012 * k - w * 0.05 * k, r0.z + w * 0.04 * k - s * 0.05 * k);
        B.body.rotation.set(-w * 0.08 + s * 0.1, 0, -clamp(st.turn, -3, 3) * 0.04 + wob * 0.08);
        B.body.scale.set(1 + br * 0.014, 1 + br * 0.02, 1);
        B.head.rotation.set(-0.2 + Math.sin(t * 0.8) * 0.04 - w * 0.2 + s * 0.3, Math.sin(t * 0.5) * 0.16 * (1 - w) + wob * 0.45, wob * 0.4);
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
    const Rr = 1.6;
    const SOWC = Object.assign({}, SOW, { k: 1.2, hr: 0.4, lite: true, crest: 0 });
    const PIG = Object.assign({}, PIGLET, { k: 0.7, hr: 0.3, eyeR: 0.1, lite: true });
    return {
      key: "boar4:B7",
      release: 0.192, // = élan de la simulation (grosse châtaigne : 0,12 × 1,6)
      dur: 1.05,
      ring: Rr + 0.08,
      footprint: INFO.B7.footprint,
      turn: 3.5,
      jumpH: 0.3,
      attackKind: "shot",
      author(R) {
        const top = ground(R, { R: Rr, seed: 31, bedR: 1.12, bedZ: 0 });
        palisade(R, { r: Rr - 0.2, n: 14, a0: 0.9, a1: TAU - 0.9, H: 0.95, y: top - 0.05, ribbons: "#e0a020", seed: 31 });
        K.ctPennant(R, { p: [-Rr * 0.72, top - 0.05, -Rr * 0.5], h: 3.4, color: "#e0a020", trim: C.redD, stars: 3, len: 0.95, tall: 0.6, starR: 0.15, thick: 0.045, tail: "swallow", dir: Math.PI - 0.15, tilt: 0.5 });
        R.bone("yaw", "root", [0, top - 0.02, 0]);
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
        R.add(G.husk(0.19), "ammo", { c: C.husk, flat: true, ol: true });
        R.add(G.nut(0.15), "ammo", { p: [0, 0.19, 0.03], c: C.nut, cls: CLS.glossy, ol: false });
        // La laie au levier, sur le plateau à droite.
        boar(R, SOWC, { pre: "s", parent: "yaw", at: [0.98, 0.24, -0.2] });
        R.add(G.cyl(0.03, 0.03, 0.9, 5), "shead", { p: [-0.12, 0.05, 0.7], r: [0.3, 0, 1.25], c: C.stakeD, pat: PAT.wood, ol: false });
        // Deux marcassins qui apportent des bogues (portées sur le dos).
        boar(R, PIG, { pre: "p1", parent: "yaw", at: [-0.98, 0.24, 0.55] });
        boar(R, PIG, { pre: "p2", parent: "yaw", at: [-0.5, 0.24, 1.25] });
        for (const p of ["p1", "p2"]) R.add(G.husk(0.1), p + "body", { p: [0, 0.26, -0.02], c: C.husk, flat: true, ol: true });
        // Étoiles d'éblouissement au-dessus de la laie.
        K.ctDizzy(R, "shead", { p: [0, 0.75, 0.2], r: 0.4, size: 0.14 });
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
        const wob = Math.sin(st.time * 7) * st.dz;
        const r0 = B.sbody.userData.rest;
        B.sbody.position.set(0, r0.y + Math.sin(t * 2) * 0.01, r0.z - w * 0.1);
        B.sbody.rotation.x = -w * 0.15 + st.s * 0.1;
        B.shead.rotation.set(-0.1 - w * 0.3 + st.s * 0.25, Math.sin(t * 0.6) * 0.12 + wob * 0.4, wob * 0.35);
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
