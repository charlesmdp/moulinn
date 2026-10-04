// « Pas touche à mes trésors » — tours BERGER AUSTRALIEN cracheur de feu (cases de roche) : il devient dragon.
// Attaque « beam » (CONCEPTION.md §1.1) : un jet de flammes continu sur une cible tant qu'elle reste à portée,
// de plus en plus chaud (setBeam(on, chaleur) ; le jet lui-même est dessiné par PTMT.fx.beam).
//
//   1 Chiot berger        : gros chiot merle bleu, oreilles tombantes, langue pendante, sur un petit autel
//                           de granit avec un brasero.
//   2 Berger australien   : adulte, oreilles repliées, crinière de flammes autour de la collerette, deux braseros.
//   3 Berger de feu       : petites cornes, ailerons naissants, crinière plus haute, braseros plus grands.
//   A4-6 Dragon merle rouge : devenu dragon (écailles rouge merle, ailes, cornes, crête), garde les taches
//                            cuivrées, la collerette blanche et les yeux vairons ; cornes et piques grandissent.
//   A7 Grand dragon rouge : DEUX TÊTES (deux jets sur deux cibles), ailes déployées, flammes dans les gueules.
//   B4-6 Dragon merle bleu : flammes bleues, un œil qui rayonne ; fissures bleues dans le granit.
//   B7 Grand dragon bleu  : grand, aura de flammes bleues, cornes de cristal (son jet rebondit : effet).
//
// Robe merle (gris-bleu ou roux marbré de sombre, calculée dans le shader), taches cuivrées, collerette
// et poitrail blancs, yeux vairons (un bleu, un marron), queue courte (le dragon a une vraie queue).
// Socle (couleur de famille rouge et orange) : autel de granit sombre fissuré de braises, liseré rouge,
// cercle de feu gravé sur la marche, braseros de fer où dansent des flammes ; fanion à étoiles.
// Jet : gueule grande ouverte, tête qui suit la cible et s'incline vers elle, corps campé, flammes de la
// gueule et des braseros qui grandissent avec la chaleur ; sans jet : il halète, se gratte, bâille.
// Voir models/10-kit.js pour la coque commune (visée, jet, éblouissement, frénésie, sélection, célébration).
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
    granite: "#4c4750",
    graniteD: "#3a363e",
    graniteL: "#77707a",
    rimRed: "#c8321a",
    rimOrange: "#ff8a2a",
    blue: "#8f9db2", // merle bleu (gris-bleu)
    red: "#c8603e", // merle rouge
    white: "#f6f3ec",
    copper: "#d27a36",
    nose: "#1c1a1e",
    tongue: "#ef6f86",
    mouth: "#6a1a22",
    horn: "#3a3036",
    hornL: "#e8dcc4",
    claw: "#2a2426",
    gold: "#ffd23a",
    iron: "#2e2a30",
    fire: "#ff7a1a",
    fireY: "#ffd84a",
    fireR: "#e0341a",
    bfire: "#3f8cff",
    bfireL: "#bfe6ff",
    wingR: "#e8502c",
    wingB: "#3f6fd0",
    crystal: "#bfe8ff",
  };

  /** Collerette de poils : tore de rayon 1 dont le boudin gonfle et dégonfle (touffes), plus épais vers le bas. */
  function ruffGeo() {
    return PTMT.geo("dog:ruff", () => {
      const g = new THREE.TorusGeometry(1, 0.48, 5, 14);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i),
          y = p.getY(i),
          z = p.getZ(i);
        const u = Math.atan2(y, x);
        const cx = Math.cos(u),
          cy = Math.sin(u);
        // cosinus : les anneaux de sommets tombent sur les crêtes et les creux (un sinus s'y annulerait)
        const k = 1 + 0.32 * Math.cos(u * 7) - 0.15 * cy;
        p.setXYZ(i, cx + (x - cx) * k, cy + (y - cy) * k, z * k);
      }
      g.computeVertexNormals();
      return g;
    });
  }

  /* ---------------------------------------------------------------- autel de granit */
  /**
   * o = { R (rayon de la dalle), seed, blue (braises bleues), braziers: [[x, z, taille], …], flag, big }
   * Renvoie la hauteur du dessus de la marche où se tient la bête.
   */
  function altar(R, o) {
    const r = o.R;
    const pat = o.blue ? PAT.emberBlue : PAT.ember;
    const rim = o.blue ? "#2f5fd0" : C.rimRed;
    const glowC = o.blue ? "#4f9cff" : C.rimOrange;
    const h1 = 0.3,
      h2 = 0.2;
    // Dalle octogonale, liseré rouge (couleur de famille), marche ronde.
    R.add(G.cyl(r, r + 0.04, h1, 8), "root", { p: [0, h1 / 2, 0], r: [0, Math.PI / 8, 0], c: C.graniteD, pat, flat: true, ol: true });
    R.add(G.cyl(r - 0.02, r - 0.02, 0.06, 8), "root", { p: [0, h1 + 0.005, 0], r: [0, Math.PI / 8, 0], c: rim, cls: CLS.heat, flat: true, ol: false });
    R.add(G.cyl(r - 0.16, r - 0.16, 0.08, 8), "root", { p: [0, h1 + 0.02, 0], r: [0, Math.PI / 8, 0], c: C.granite, pat, flat: true, ol: false });
    const r2 = o.big ? 1.05 : 0.92;
    R.add(G.cyl(r2, r2 + 0.06, h2, 16), "root", { p: [0, h1 + h2 / 2, 0], c: "#35313a", pat, ol: true });
    // Cercle de feu gravé sur le dessus de la marche (lueur) et braises sur le pourtour de la dalle.
    R.glow(G.torus(r2 - 0.12, 0.035, 3, 22), "root", { p: [0, h1 + h2 + 0.01, 0], r: [Math.PI / 2, 0, 0], c: glowC });
    const rnd = PTMT.rng(o.seed || 5);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU + rnd() * 0.4;
      const rr = r - 0.08 - rnd() * 0.12;
      R.add(G.rock(0.07 + rnd() * 0.05, 0, 0.3, 60 + i), "root", { p: [Math.sin(a) * rr, h1 + 0.07, Math.cos(a) * rr], c: i % 3 ? C.graniteD : "#ff6a1a", cls: i % 3 ? 0 : CLS.heat, pat: i % 3 ? PAT.stone : 0, flat: true, ol: false });
    }
    // Braseros : fût de pierre, coupe de fer, braises et flammes (os « brazier<i> », s'emballent avec la chaleur).
    (o.braziers || []).forEach(([x, z, s], i) => {
      const y0 = h1;
      R.add(G.cyl(0.13 * s, 0.17 * s, 0.42 * s, 6, true), "root", { p: [x, y0 + 0.21 * s, z], c: C.graniteL, pat: PAT.stone, ol: true });
      R.add(G.cyl(0.32 * s, 0.17 * s, 0.2 * s, 8), "root", { p: [x, y0 + 0.5 * s, z], c: C.iron, cls: CLS.metal, ol: true });
      R.add(G.sphere(0.27 * s, 8, 2, 0, Math.PI / 2), "root", { p: [x, y0 + 0.57 * s, z], s: [1, 0.35, 1], c: o.blue ? "#3f8cff" : "#ff5a12", cls: CLS.heat, ol: false });
      R.bone("brazier" + i, "root", [x, y0 + 0.6 * s, z]);
      const fire = o.blue ? [C.bfire, C.bfireL] : [C.fire, C.fireY];
      R.glow(G.flame(0.24 * s, 0.7 * s, 7, 5), "brazier" + i, { c: fire[0] });
      R.glow(G.flame(0.13 * s, 0.45 * s, 6, 4), "brazier" + i, { p: [0, 0.02, 0], c: fire[1] });
    });
    if (o.flag) K.ctPennant(R, Object.assign({ p: [-r * 0.62, h1, -r * 0.55], dir: 2.5, tilt: 0.5 }, o.flag));
    return h1 + h2;
  }

  /* ---------------------------------------------------------------- tête (une ou deux) */
  /**
   * Tête du berger ou du dragon sous l'os « parent » (cou ou corps), os préfixés par pre :
   * <pre>head → <pre>jaw (<pre>tongue → <pre>tflame), <pre>fire (bouche, feu), <pre>earL/R, <pre>ray.
   */
  function dogHead(R, P, pre, parent, at, coat, coatPat) {
    const k = P.k,
      hr = P.hr * k;
    const B = (n) => pre + n;
    R.bone(B("head"), parent, at);
    const hc = [0, hr * 0.42, hr * 0.3];
    R.add(G.sphere(hr, 11, 7), B("head"), { p: hc, s: [1, 0.95, 1], c: coat, pat: coatPat, uv: [6, 5], ol: true });
    // Museau (allongé chez le dragon), truffe, liste blanche, joues cuivrées.
    const mk = P.muzzle || 1;
    const mz = hc[2] + hr * (0.72 + (mk - 1) * 0.3);
    R.add(G.sphere(hr * 0.56, 8, 5), B("head"), { p: [0, hc[1] - hr * 0.26, mz], s: [0.95, 0.74, 1.05 * mk], gp: [C.white, P.muzzleTop || C.white, -hr * 0.1, hr * 0.2], pat: PAT.fur, ol: true });
    const tip = mz + hr * 0.56 * 1.05 * mk * 0.92;
    R.add(G.sphere(hr * 0.17, 6, 4), B("head"), { p: [0, hc[1] - hr * 0.12, tip], s: [1.2, 0.85, 0.9], c: C.nose, cls: CLS.glossy, ol: false });
    R.add(G.capsule(hr * 0.14, hr * 0.6, 4, 1), B("head"), { p: [0, hc[1] + hr * 0.62, hc[2] + hr * 0.68], r: [1.05, 0, 0], s: [1, 1, 0.5], c: C.white, pat: PAT.fur, ol: false });
    for (const sx of [-1, 1]) {
      R.add(G.sphere(hr * 0.3, 5, 3), B("head"), { p: [sx * hr * 0.4, hc[1] - hr * 0.32, hc[2] + hr * 0.62], s: [0.8, 0.7, 0.9], c: C.copper, pat: PAT.fur, ol: false });
      R.add(G.sphere(hr * 0.11, 4, 3), B("head"), { p: [sx * hr * 0.42, hc[1] + hr * 0.66, hc[2] + hr * 0.7], s: [1.2, 0.7, 0.6], c: C.copper, ol: false });
    }
    // Mâchoire (s'ouvre pour cracher), intérieur de la gueule.
    R.bone(B("jaw"), B("head"), [0, hc[1] - hr * 0.44, hc[2] + hr * 0.55]);
    R.add(G.sphere(hr * 0.44, 7, 5), B("jaw"), { p: [0, -hr * 0.02, hr * 0.28 * mk], s: [0.88, 0.34, 1.05 * mk], c: C.white, pat: PAT.fur, ol: true });
    R.add(G.sphere(hr * 0.36, 5, 3), B("jaw"), { p: [0, hr * 0.06, hr * 0.26 * mk], s: [0.8, 0.2, 0.95 * mk], c: C.mouth, ol: false });
    if (P.fangs) for (const sx of [-1, 1]) R.add(G.cone(hr * 0.05, hr * 0.16, 4), B("jaw"), { p: [sx * hr * 0.22, hr * 0.12, hr * 0.58 * mk], c: "#fffaf0", cls: CLS.glossy, ol: false });
    // Langue pendante (chiot, berger) avec petite flamme au bout.
    if (P.tongue) {
      R.bone(B("tongue"), B("jaw"), [hr * 0.08, hr * 0.02, hr * 0.5]);
      R.add(G.capsule(hr * 0.11, hr * 0.22, 6, 2), B("tongue"), { p: [0, -hr * 0.12, hr * 0.08], r: [0.5, 0, 0], s: [1.2, 1, 0.5], c: C.tongue, cls: CLS.satin, ol: false });
      R.bone(B("tflame"), B("tongue"), [0, -hr * 0.3, hr * 0.16]);
      R.glow(G.flame(hr * 0.12, hr * 0.42, 6, 5), B("tflame"), { c: C.fire });
      R.glow(G.flame(hr * 0.07, hr * 0.26, 5, 4), B("tflame"), { p: [0, 0.01, 0], c: C.fireY });
    }
    // Feu dans la gueule (couve au repos chez les dragons, jaillit pendant le jet) : l'os « fire » est la bouche.
    const fire = P.fire || [C.fire, C.fireY];
    R.bone(B("fire"), B("head"), [0, hc[1] - hr * 0.3, tip + hr * 0.05]);
    R.glow(G.sphere(hr * 0.34, 6, 4), B("fire"), { c: fire[0] });
    R.glow(G.flame(hr * 0.3, hr * 1.2, 7, 6), B("fire"), { p: [0, 0, hr * 0.05], r: [Math.PI / 2, 0, 0], c: fire[0] });
    R.glow(G.flame(hr * 0.17, hr * 0.8, 6, 5), B("fire"), { p: [0, 0, hr * 0.08], r: [Math.PI / 2, 0, 0], c: fire[1] });
    // Oreilles.
    for (const sx of [-1, 1]) {
      const nm = B(sx > 0 ? "earL" : "earR");
      R.bone(nm, B("head"), [sx * hr * 0.66, hc[1] + hr * 0.58, hc[2] - hr * 0.05]);
      if (P.ears === "floppy") R.add(G.sphere(hr * 0.42, 7, 5), nm, { p: [sx * hr * 0.1, -hr * 0.38, hr * 0.05], r: [0, 0, sx * 0.35], s: [0.42, 1, 0.78], c: coat, pat: coatPat, ol: true });
      else if (P.ears === "fin") R.add(G.cone(hr * 0.3, hr * 0.9, 4), nm, { p: [sx * hr * 0.1, hr * 0.1, -hr * 0.3], r: [-1.1, 0, -sx * 0.5], s: [1, 1, 0.35], c: P.finC || coat, pat: coatPat, ol: true });
      else {
        R.add(G.cone(hr * 0.3, hr * 0.62, 5), nm, { p: [0, hr * 0.18, 0], r: [0.25, 0, -sx * 0.3], s: [1, 1, 0.45], c: coat, pat: coatPat, ol: true });
        R.add(G.cone(hr * 0.2, hr * 0.28, 4), nm, { p: [0, hr * 0.44, hr * 0.1], r: [1.4, 0, -sx * 0.3], s: [1, 1, 0.45], c: coat, pat: coatPat, ol: false });
      }
      R.sway(nm, "z", 0, 0.07, sx > 0 ? 1.8 : 2.1, sx > 0 ? 0 : 1.6);
    }
    // Cornes (courbes vers l'arrière) ou cornes de cristal.
    if (P.horns) {
      const hk = P.horns * k;
      for (const sx of [-1, 1]) {
        if (P.crystalHorns) {
          R.add(G.crystal(0.08 * hk, 0.62 * hk, 5, 0.2 * hk, 0.02, 0.75), B("head"), { p: [sx * hr * 0.42, hc[1] + hr * 0.72, hc[2] - hr * 0.2], r: [-0.75, 0, -sx * 0.35], c: C.crystal, cls: CLS.ice, flat: true, ol: true });
          R.add(G.crystal(0.05 * hk, 0.36 * hk, 5, 0.12 * hk, 0.02, 0.75), B("head"), { p: [sx * hr * 0.66, hc[1] + hr * 0.48, hc[2] - hr * 0.3], r: [-0.9, 0, -sx * 0.9], c: "#8fd0ff", cls: CLS.ice, flat: true, ol: false });
        } else {
          R.add(
            G.tube(
              "dog:horn",
              [
                [0, 0, 0],
                [0.02, 0.16, -0.06],
                [0.07, 0.3, -0.2],
                [0.13, 0.36, -0.42],
              ],
              (t) => 0.075 * (1 - t) + 0.012,
              5,
              4,
            ),
            B("head"),
            { p: [sx * hr * 0.4, hc[1] + hr * 0.72, hc[2] - hr * 0.1], s: [sx * hk, hk, hk], g: [P.hornC || C.horn, P.hornTip || C.hornL, 0.0, 0.36], cls: CLS.glossy, ol: true },
          );
          if (P.rings) R.add(G.torus(0.07 * hk, 0.02 * hk, 3, 8), B("head"), { p: [sx * (hr * 0.4 + 0.03 * hk), hc[1] + hr * 0.72 + 0.14 * hk, hc[2] - hr * 0.1 - 0.05 * hk], r: [Math.PI / 2 + 0.4, 0, 0], c: C.gold, cls: CLS.gold, ol: false });
        }
      }
    }
    // Yeux vairons (droit bleu, gauche marron) ; l'œil qui rayonne du dragon bleu.
    K.ctEyes(R, B("head"), {
      name: pre + "eyes",
      p: [0, hc[1] + hr * 0.3, hc[2] + hr * 0.78],
      gap: hr * 0.42,
      r: P.eyeR * k,
      skin: coat,
      iris: P.iris || ["#4aa8ff", "#8a4a1e"],
      pupil: 0.7,
      dot: 0.5,
      slant: P.slant === undefined ? 0.12 : P.slant,
      rest: P.lid === undefined ? -0.6 : P.lid,
      up: 0.45,
      brow: P.brow || null,
      browT: P.browT,
      glowIris: P.glowIris,
    });
    if (P.radiant) {
      R.bone(B("ray"), B("head"), [-hr * 0.42, hc[1] + hr * 0.3, hc[2] + hr * 0.95]);
      R.glow(G.sphere(P.eyeR * k * 1.3, 8, 6), B("ray"), { c: "#6fb8ff" });
      R.glow(G.cone(P.eyeR * k * 1.6, 0.9 * k, 8, true), B("ray"), { p: [0, 0, 0.45 * k], r: [-Math.PI / 2, 0, 0], c: "#3f78d8", lite: false });
    }
    if (!pre) K.ctDizzy(R, B("head"), { p: [0, hc[1] + hr * 1.5, hc[2]], r: hr * 1.05, size: Math.max(0.2, hr * 0.44) });
    return { hr, hc };
  }

  /* ---------------------------------------------------------------- berger / dragon paramétrique */
  /**
   * P = { k, hr (tête), coat (couleur merle), pat (merle | écailles), body: [rx, rz, ry], legs, neck (longueur, dragon),
   *       muzzle (allongement), ears: "floppy" | "rose" | "fin", horns (taille), hornC, crystalHorns, wings: 0 | "nub"
   *       | "fold" | "spread", wingK, wingC, tail: "bob" | "dragon", spikes, mane (crinière de flammes 0..1),
   *       fire: [extérieur, intérieur] (couleurs du feu), tongue (langue et petite flamme), eyeR, iris: [droit, gauche],
   *       radiant (œil qui rayonne), lid, slant, brow, rings (anneaux d'or aux cornes), claws, twin (deux têtes) }
   * Os : yaw → body (neck | neckL/neckR) → head (+ bhead) → jaw, tongue, fire, ears ; mane, wings, tail(2), jambes.
   */
  function shepherd(R, P, o) {
    const k = P.k,
      hr = P.hr * k;
    const bs = P.body || [0.3, 0.42, 0.27];
    const rx = bs[0] * k,
      rz = bs[1] * k,
      ry = bs[2] * k;
    const legLen = (P.legs || 0.2) * k;
    const bodyY = legLen + ry * 0.72;
    const coat = P.coat,
      coatPat = P.pat || PAT.merle;
    R.bone("yaw", o.parent || "root", o.at);
    R.bone("body", "yaw", [0, bodyY, 0]);
    const neckL = (P.neck || 0) * k;
    const neckTube = () =>
      G.tube(
        "dog:neck",
        [
          [0, -0.1, -0.06],
          [0, 0.2, 0.06],
          [0, 0.52, 0.16],
          [0, 0.8, 0.32],
        ],
        [0.2, 0.14],
        6,
        8,
      );
    if (P.twin) {
      // Deux cous écartés : la tête « head » (gauche) suit la visée du corps, « bhead » (droite) la seconde visée.
      for (const [nm, sx] of [
        ["neck", 1],
        ["neckB", -1],
      ]) {
        R.bone(nm, "body", [sx * rx * 0.42, ry * 0.4, rz * 0.58]);
        R.add(neckTube(), nm, { s: [k, neckL, neckL], c: coat, pat: coatPat, uv: [2, 6], ol: true });
      }
      dogHead(R, P, "", "neck", [0, neckL * 0.82, neckL * 0.34], coat, coatPat);
      dogHead(R, P, "b", "neckB", [0, neckL * 0.82, neckL * 0.34], coat, coatPat);
    } else if (neckL) {
      R.bone("neck", "body", [0, ry * 0.4, rz * 0.62]);
      R.add(neckTube(), "neck", { s: [k, neckL, neckL], c: coat, pat: coatPat, uv: [2, 6], ol: true });
      dogHead(R, P, "", "neck", [0, neckL * 0.82, neckL * 0.34], coat, coatPat);
    } else dogHead(R, P, "", "body", [0, ry * 0.55, rz * 0.62], coat, coatPat);
    // Jambes (sous l'os de visée), bas cuivré, pattes blanches (ou griffues).
    const legTop = bodyY - ry * 0.35;
    const lr = (P.legW || 0.07) * k;
    for (const [nm, sx, sz] of [
      ["legFL", 1, 1],
      ["legFR", -1, 1],
      ["legBL", 1, -1],
      ["legBR", -1, -1],
    ]) {
      R.bone(nm, "yaw", [sx * rx * 0.55, legTop, sz * rz * 0.55]);
      const L = legTop - lr;
      R.add(G.capsule(lr, Math.max(0.01, L * 0.5), 5, 1), nm, { p: [0, -L * 0.3, 0], c: coat, pat: coatPat, ol: true });
      R.add(G.capsule(lr * 0.9, Math.max(0.01, L * 0.35), 5, 1), nm, { p: [0, -L * 0.72, 0.01 * k], c: C.copper, pat: PAT.fur, ol: false });
      R.add(G.sphere(lr * 1.25, 5, 3), nm, { p: [0, -legTop + lr * 0.9, lr * 0.4], s: [1, 0.75, 1.25], c: P.claws ? coat : C.white, pat: PAT.fur, ol: false });
      if (P.claws) for (const c of [-0.6, 0.6]) R.add(G.cone(lr * 0.3, lr * 0.85, 4), nm, { p: [c * lr * 0.45, -legTop + lr * 0.7, lr * 1.55], r: [Math.PI / 2 + 0.3, 0, 0], c: C.claw, cls: CLS.glossy, ol: false });
    }
    // Corps (pôles avant/arrière), poitrail blanc, collerette blanche.
    R.add(G.sphere(1, 12, 8), "body", { r: [Math.PI / 2, 0, 0], s: [rx, rz, ry], c: coat, pat: coatPat, uv: [8, 6], ol: true });
    R.add(G.sphere(ry * 0.72, 7, 5), "body", { p: [0, -ry * 0.12, rz * 0.62], s: [1, 1, 0.8], c: C.white, pat: PAT.fur, ol: false });
    const neckAt = neckL ? [0, ry * 0.42, rz * 0.6] : [0, ry * 0.5, rz * 0.6];
    // Collerette : anneau de poils festonné (tore bosselé) autour du cou.
    const cr = Math.max(hr * 0.64, rx * 0.8);
    R.add(ruffGeo(), "body", { p: neckAt, r: [Math.PI / 2 - 0.55, 0, 0], s: [P.twin ? cr * 1.3 : cr, cr, cr * 0.85], c: C.white, pat: PAT.fur, ol: true });
    // Taches cuivrées sur les flancs.
    for (const sx of [-1, 1]) R.add(G.sphere(ry * 0.35, 5, 3), "body", { p: [sx * rx * 0.86, -ry * 0.25, rz * 0.2], s: [0.4, 0.8, 1.2], c: C.copper, pat: PAT.fur, ol: false });
    // Piques dorsales (dragons).
    if (P.spikes) {
      for (let i = 0; i < P.spikes; i++) {
        const u = i / Math.max(1, P.spikes - 1);
        const z = (0.5 - u * 1.2) * rz;
        const y = Math.sqrt(Math.max(0, 1 - Math.pow(z / rz, 2))) * ry;
        const hh = (0.16 + (1 - Math.abs(u - 0.35)) * 0.1) * k * (P.spikeK || 1);
        R.add(G.cone(0.07 * k, hh, 4), "body", { p: [0, y + hh * 0.3, z], r: [-0.4, 0, 0], s: [0.6, 1, 1], c: P.spikeC || C.horn, cls: CLS.glossy, ol: false });
      }
    }
    // Crinière de flammes (autour de la collerette) : deux os pour le frémissement.
    const fire = P.fire || [C.fire, C.fireY];
    if (P.mane) {
      const mk2 = P.mane * k;
      for (const [bn, off] of [
        ["maneA", 0],
        ["maneB", 1],
      ]) {
        R.bone(bn, "body", neckAt);
        for (let i = off; i < 8; i += 2) {
          const a = -1.35 + (i / 7) * 2.7;
          const x = Math.sin(a) * hr * 0.9,
            z = -Math.cos(a) * hr * 0.25 - hr * 0.1;
          const hh = (0.36 + (1 - Math.abs(a) / 1.35) * 0.22) * mk2;
          R.glow(G.flame(0.11 * mk2, hh, 5, 4), bn, { p: [x, hr * 0.12, z], r: [-0.55, 0, -a * 0.55], c: fire[0] });
          R.glow(G.flame(0.06 * mk2, hh * 0.62, 4, 4), bn, { p: [x, hr * 0.14, z + 0.02], r: [-0.55, 0, -a * 0.55], c: fire[1] });
        }
      }
    }
    // Ailes : ailerons naissants, repliées ou déployées (membrane et bras d'aile).
    if (P.wings) {
      const wk = (P.wingK || 1) * k;
      const mem = [
        [0, 0.04],
        [0.34, 0.28],
        [0.74, 0.44],
        [1.06, 0.4],
        [0.92, 0.12],
        [0.8, -0.04],
        [0.64, 0.08],
        [0.5, -0.14],
        [0.34, -0.02],
        [0.2, -0.2],
        [0.06, -0.08],
      ];
      for (const sx of [-1, 1]) {
        const nm = sx > 0 ? "wingL" : "wingR";
        R.bone(nm, "body", [sx * rx * 0.55, ry * 0.7, rz * 0.12]);
        const spread = P.wings === "spread";
        // Repliées : envergure vers l'arrière le long du flanc ; déployées : vers le côté, membrane
        // inclinée vers le ciel (lisible de haut quelle que soit l'orientation).
        const ry0 = spread ? (sx > 0 ? 0.25 : Math.PI - 0.25) : sx > 0 ? Math.PI / 2 - 0.25 : Math.PI / 2 + 0.25;
        const roll = spread ? 0.4 : 0.28;
        const tilt = spread ? -0.8 * sx : 0.85 * sx;
        const sc = [wk * (spread ? 0.78 : 0.72), wk * (spread ? 0.74 : 0.72), 1];
        const wc = P.wingC || C.wingR;
        R.add(G.extrude("dog:wing", mem, 0.035, 0), nm, { r: [tilt, ry0, roll], ro: "YXZ", s: sc, g: [P.wingL || wc, P.wingD || wc, -0.12, 0.4], cls: CLS.satin, ol: true });
        R.add(
          G.tube(
            "dog:wingArm",
            [
              [0, 0.04, 0],
              [0.34, 0.28, 0],
              [0.74, 0.44, 0],
              [1.1, 0.42, 0],
            ],
            [0.06, 0.03],
            6,
            4,
          ),
          nm,
          { r: [tilt, ry0, roll], ro: "YXZ", s: sc, c: coat, pat: coatPat, ol: true },
        );
        // Doigts de l'aile (du poignet vers les festons), sur les deux faces de la membrane.
        [
          [0.8, -0.04],
          [0.5, -0.14],
          [0.2, -0.2],
        ].forEach(([fx, fy], i) =>
          R.add(
            G.tube(
              "dog:finger" + i,
              [
                [0.74, 0.44, 0],
                [(0.74 + fx) / 2, (0.44 + fy) / 2 + 0.03, 0],
                [fx, fy, 0],
              ],
              [0.028, 0.012],
              3,
              4,
            ),
            nm,
            { r: [tilt, ry0, roll], ro: "YXZ", s: [sc[0], sc[1], 1.6], c: P.fingerC || coat, ol: false },
          ),
        );
      }
    }
    // Queue : courte et touffue (berger) ou longue queue de dragon (deux tronçons).
    if (P.tail === "dragon") {
      const tk = (P.tailK || 0.85) * k;
      R.bone("tail", "body", [0, ry * 0.1, -rz * 0.9]);
      R.add(
        G.tube(
          "dog:tailA",
          [
            [0, 0, 0],
            [0, -0.1, -0.24],
            [0.04, -0.2, -0.46],
            [0.1, -0.26, -0.64],
          ],
          [0.16, 0.1],
          6,
          6,
        ),
        "tail",
        { s: tk, c: coat, pat: coatPat, uv: [1, 4], ol: true },
      );
      R.bone("tail2", "tail", [0.1 * tk, -0.26 * tk, -0.64 * tk]);
      R.add(
        G.tube(
          "dog:tailB",
          [
            [0, 0, 0],
            [0.12, -0.02, -0.2],
            [0.28, 0.0, -0.36],
            [0.44, 0.06, -0.44],
          ],
          [0.1, 0.035],
          6,
          5,
        ),
        "tail2",
        { s: tk, c: coat, pat: coatPat, uv: [1, 4], ol: true },
      );
      // Bout de queue : petite flamme.
      R.bone("tailTip", "tail2", [0.44 * tk, 0.06 * tk, -0.44 * tk]);
      R.glow(G.flame(0.09 * tk, 0.36 * tk, 6, 5), "tailTip", { r: [-0.3, 0, -0.5], c: fire[0] });
      R.glow(G.flame(0.05 * tk, 0.24 * tk, 5, 4), "tailTip", { r: [-0.3, 0, -0.5], c: fire[1] });
      R.sway("tail", "y", 0, 0.18, 1.6, 0);
      R.sway("tail2", "y", 0, 0.3, 1.6, -0.9);
    } else {
      R.bone("tail", "body", [0, ry * 0.3, -rz * 0.92]);
      R.add(G.sphere(0.12 * k, 7, 5), "tail", { s: [1, 1, 1.3], c: coat, pat: coatPat, ol: true });
      R.add(G.sphere(0.07 * k, 6, 4), "tail", { p: [0, 0.03 * k, -0.1 * k], c: C.white, ol: false });
      R.sway("tail", "y", 0, 0.45, 9, 0);
    }
    return { hr };
  }

  /** Une tête : repos (halète, bâille, regarde), jet (gueule ouverte, inclinée vers la cible, secousses). */
  function headPose(st, B, P, pre, beam, heat, restYaw, aimYaw) {
    const t = st.t + st.phase;
    const w = easeInOut(st.w),
      s = st.s;
    const fid = bump(1 - st.fid);
    const neck = B[pre ? "neckB" : "neck"];
    const head = B[pre + "head"];
    const yawn = st.fidK === 1 ? fid * (1 - beam) : 0;
    const look = st.fidK === 2 ? fid * Math.sin(t * 2.4) * 0.6 * (1 - beam) : 0;
    const scratch = st.fidK === 0 ? fid * (1 - beam) : 0;
    const pant = P.tongue ? (Math.sin(t * 11) * 0.5 + 0.5) * (1 - beam) : 0;
    const dz = st.dz;
    const wob = Math.sin(st.time * 7 + (pre ? 1.3 : 0)) * dz;
    const kick = Math.sin(st.time * 31 + (pre ? 2 : 0)) * 0.025 * beam * (0.5 + heat);
    if (neck) neck.rotation.set(-0.1 - w * 0.35 + s * 0.45 + beam * 0.32, restYaw + (aimYaw - restYaw) * beam + look * 0.5 + Math.sin(t * 0.5) * 0.1 * (1 - w) * (1 - beam) + wob * 0.3, 0);
    head.rotation.set(-0.22 + Math.sin(t * 0.9) * 0.04 * (1 - beam) - w * (neck ? 0.2 : 0.45) + s * (neck ? 0.3 : 0.5) + beam * (neck ? 0.08 : 0.22) - yawn * 0.35 + kick, (neck ? look * 0.5 : look) + Math.sin(t * 0.6) * 0.14 * (1 - w) * (1 - beam) + wob * 0.5, scratch * Math.sin(t * 18) * 0.12 + wob * 0.45);
    B[pre + "jaw"].rotation.x = 0.05 + pant * 0.12 + s * 0.75 + yawn * 0.7 + beam * (0.75 + 0.15 * heat) + Math.sin(st.time * 23) * 0.04 * beam;
    if (B[pre + "tongue"]) B[pre + "tongue"].rotation.x = 0.1 + pant * 0.2 - s * 0.5 - beam * 0.6;
    if (B[pre + "tflame"]) {
      const f = (1 + Math.sin(st.time * 19) * 0.12) * (1 - beam * 0.9);
      B[pre + "tflame"].scale.set(Math.max(0.001, f), Math.max(0.001, 1 + (f - 1) * 2), Math.max(0.001, f));
    }
    // Feu dans la gueule : couve à l'élan, jaillit à la détente, flambe pendant le jet (avec la chaleur).
    const idleFire = P.idleFire || 0;
    const fk = Math.max(w * 0.55, s * 1.25, idleFire * (0.5 + 0.2 * Math.sin(st.time * 7)), beam * (0.9 + 0.7 * heat));
    const fl = 1 + Math.sin(st.time * 27 + (pre ? 1 : 0)) * 0.08 * beam;
    B[pre + "fire"].scale.set((0.2 + fk * 0.9) * fl, (0.2 + fk * 0.9) * fl, (0.15 + fk * 1.4) * fl);
    if (B[pre + "ray"]) B[pre + "ray"].scale.setScalar(0.8 + 0.2 * Math.sin(st.time * 5) + s * 0.8 + w * 0.3 + beam * (0.5 + heat * 0.6));
    return { yawn, scratch };
  }

  /** Animation commune : respiration, regard, jet (corps campé, tête vers la cible), braseros, crinière, ailes. */
  function dogPose(st, B, P) {
    const k = P.k;
    const t = st.t + st.phase;
    const w = easeInOut(st.w),
      s = st.s;
    const beam = Math.max(st.beam, st.beam2);
    const heat = Math.max(st.heat, st.heat2);
    const br = Math.sin(t * (2.3 + st.fr * 2 + beam * 3));
    const r0 = B.body.userData.rest;
    const wob = Math.sin(st.time * 7) * st.dz;
    B.body.position.set(0, r0.y + br * 0.012 * k + w * 0.03 * k - beam * 0.03 * k, r0.z - w * 0.05 * k + s * 0.06 * k + beam * 0.05 * k);
    B.body.rotation.set(-w * 0.1 + s * 0.12 + beam * 0.1, 0, -clamp(st.turn, -3, 3) * 0.04 + wob * 0.07);
    const puff = 1 + w * 0.08 + beam * 0.05;
    B.body.scale.set(puff + br * 0.012, puff + br * 0.018, 1);
    const h1 = headPose(st, B, P, "", st.beam, st.heat, P.twin ? 0.3 : 0, 0);
    if (P.twin) headPose(st, B, P, "b", st.beam2, st.heat2, -0.3, st.yaw2);
    // Crinière de flammes : frémit, grandit avec la chaleur.
    if (B.maneA) {
      const fa = 1 + Math.sin(st.time * 13) * 0.1 + w * 0.3 + st.fr * 0.25 + beam * (0.25 + 0.45 * heat);
      const fb = 1 + Math.sin(st.time * 17 + 1) * 0.1 + w * 0.3 + st.fr * 0.25 + beam * (0.25 + 0.45 * heat);
      B.maneA.scale.set(fa, fa * (1 + s * 0.3), fa);
      B.maneB.scale.set(fb, fb * (1 + s * 0.3), fb);
    }
    if (B.tailTip) {
      const f = 1 + Math.sin(st.time * 15) * 0.15 + beam * heat * 0.6;
      B.tailTip.scale.set(f, f * 1.2, f);
    }
    // Ailes : frémissent, se lèvent à l'élan, s'ouvrent pendant le jet.
    if (B.wingL) {
      const spread = P.wings === "spread";
      for (let i = 0; i < 2; i++) {
        const sx = i ? -1 : 1;
        const b = i ? B.wingR : B.wingL;
        const beat = Math.sin(t * (spread ? 2.4 : 1.5) + i * 0.3) * (spread ? 0.12 : 0.04) * (1 - beam * 0.6) + w * 0.35 - s * 0.45 + st.fr * 0.15 + beam * (spread ? 0.2 : 0.35);
        b.rotation.set(0, 0, sx * beat);
      }
    }
    // Braseros : dansent, s'emballent avec la chaleur du jet.
    for (let i = 0; i < 4; i++) {
      const b = B["brazier" + i];
      if (!b) break;
      const f = (1 + Math.sin(st.time * (15 + i * 4)) * 0.12 + Math.sin(st.time * 31 + i) * 0.06 * beam) * (1 + beam * (0.3 + 1.1 * heat));
      b.scale.set(1 + (f - 1) * 0.5, f * 1.15, 1 + (f - 1) * 0.5);
    }
    // Pattes : la patte arrière gratte (manie), appui pendant le jet.
    B.legBL.rotation.x = h1.scratch * Math.sin(t * 20) * 0.5 - h1.scratch * 0.4 - beam * 0.12;
    B.legFL.rotation.x = -s * 0.2 - beam * 0.25;
    B.legFR.rotation.x = -s * 0.2 - beam * 0.25;
    B.legBR.rotation.x = w * 0.1 - beam * 0.12;
    st.eyeOpen = beam > 0.3 ? 0.6 + heat * 0.4 : s > 0.2 ? 0.9 : w > 0.1 ? -0.9 * w : h1.yawn ? -1 : st.fr > 0.3 ? -0.6 : 0;
    if (st.ae >= 0 || beam > 0.3) st.look = 0;
  }

  /* ---------------------------------------------------------------- réglages */
  const PUP = { k: 1.38, hr: 0.36, coat: C.blue, body: [0.28, 0.36, 0.25], legs: 0.17, ears: "floppy", tail: "bob", eyeR: 0.12, lid: -0.8, slant: 0.0, tongue: true, muzzle: 0.9 };
  const ADULT = { k: 1.5, hr: 0.32, coat: C.blue, body: [0.3, 0.44, 0.27], legs: 0.22, ears: "rose", tail: "bob", eyeR: 0.1, lid: -0.62, slant: 0.14, brow: "#2a2630", browT: 0.02, mane: 0.8, tongue: true, muzzle: 1.1 };
  const FIRE = { k: 1.6, hr: 0.31, coat: C.blue, body: [0.31, 0.46, 0.28], legs: 0.23, ears: "rose", tail: "bob", eyeR: 0.095, lid: -0.5, slant: 0.24, brow: "#2a2630", browT: 0.022, mane: 1.05, horns: 0.55, wings: "nub", wingK: 0.55, wingC: "#e0703a", muzzle: 1.15, fangs: true };
  const RED = { k: 1.55, hr: 0.3, coat: C.red, pat: PAT.scales, body: [0.33, 0.58, 0.3], legs: 0.22, legW: 0.08, neck: 0.55, ears: "fin", tail: "dragon", eyeR: 0.09, lid: -0.42, slant: 0.32, brow: "#3a1a14", browT: 0.024, horns: 0.72, wings: "fold", wingK: 1.0, wingC: C.wingR, wingD: "#a8321e", wingL: "#ff8a4a", fingerC: "#5a2418", muzzle: 1.4, fangs: true, spikes: 7, claws: true, idleFire: 0.35, muzzleTop: "#e8c8b0" };
  const BLUE = Object.assign({}, RED, { coat: C.blue, wingC: C.wingB, wingD: "#28469a", wingL: "#7fb0ff", fingerC: "#1e2a4a", fire: [C.bfire, C.bfireL], iris: ["#4aa8ff", "#8a4a1e"], radiant: true, glowIris: false, spikeC: "#2a3450", brow: "#1a2230", muzzleTop: "#d8dce8" });
  const RED7 = Object.assign({}, RED, { k: 1.85, hr: 0.29, neck: 0.62, wings: "spread", wingK: 1.1, horns: 1.0, spikes: 9, spikeK: 1.3, idleFire: 0.9, rings: true, tailK: 1.15, twin: true });
  const BLUE7 = Object.assign({}, BLUE, { k: 1.95, hr: 0.29, wings: "spread", wingK: 1.15, horns: 1.1, crystalHorns: true, spikes: 9, spikeK: 1.3, idleFire: 0.9, tailK: 1.15, spikeC: "#8fd0ff" });

  // Hauteur réelle du sommet (m, mesurée sur les gabarits) et rayon d'emprise au sol (m).
  const INFO = {
    1: { height: 1.94, footprint: 1.55 },
    2: { height: 2.09, footprint: 1.55 },
    3: { height: 2.3, footprint: 1.55 },
    A4: { height: 2.98, footprint: 1.55 },
    A5: { height: 3.05, footprint: 1.55 },
    A6: { height: 3.12, footprint: 1.55 },
    A7: { height: 3.74, footprint: 1.6 },
    B4: { height: 2.98, footprint: 1.55 },
    B5: { height: 3.05, footprint: 1.55 },
    B6: { height: 3.12, footprint: 1.55 },
    B7: { height: 4.29, footprint: 1.6 },
  };

  function variant(level, spec) {
    const lv = spec ? spec + level : String(level);
    const deco = level >= 4 ? level - 3 : 0;
    const big = level === 7;
    let P = level === 1 ? PUP : level === 2 ? ADULT : level === 3 ? FIRE : spec === "A" ? (big ? RED7 : RED) : big ? BLUE7 : BLUE;
    if (level >= 4 && !big) P = Object.assign({}, P, { horns: P.horns * (1 + (deco - 1) * 0.18), spikes: P.spikes + (deco - 1), spikeK: 1 + (deco - 1) * 0.15, rings: spec === "A" && deco >= 3 });
    const Rr = big ? 1.6 : 1.55;
    // Braseros : un (1), deux (2), deux grands (3), deux à quatre (dragons).
    const s = level === 1 ? 0.95 : level === 2 ? 1.05 : level === 3 ? 1.15 : big ? 1.3 : 1.15;
    const bz = [[Rr * 0.66, -Rr * 0.5, s]];
    if (level >= 2) bz.push([-Rr * 0.72, Rr * 0.28, s]);
    if (level >= 5 || big) bz.push([Rr * 0.72, Rr * 0.28, s * 0.9]);
    if (big) bz.push([-Rr * 0.05, -Rr * 0.82, s * 0.8]);
    return {
      key: "dog4:" + lv,
      release: 0.22, // = élan de la simulation (berger), si le jeu demande encore un crachat ponctuel
      dur: 0.85,
      ring: Rr + 0.08,
      footprint: INFO[lv].footprint,
      turn: level >= 4 ? 4.5 : 6,
      jumpH: big ? 0.3 : 0.5,
      attackKind: "beam",
      author(R) {
        const top = altar(R, {
          R: Rr,
          seed: 3 + level * 7 + (spec === "B" ? 50 : 0),
          blue: spec === "B",
          big,
          braziers: bz,
          flag: {
            h: big ? 3.0 : level >= 4 ? 2.0 + deco * 0.14 : 1.35 + level * 0.15,
            color: spec === "B" ? "#2f5fd0" : "#d8321e",
            trim: level >= 4 ? C.gold : "#ff9a2a",
            stars: level >= 4 ? (big ? 3 : deco) : level,
            len: big ? 0.95 : 0.8,
            tall: big ? 0.6 : 0.52,
            starR: big ? 0.15 : 0.13,
            thick: 0.04,
            tail: level >= 4 ? "swallow" : "point",
          },
        });
        shepherd(R, P, { at: [0, top - 0.03, big ? 0.06 : 0.04] });
        // Aura de flammes bleues au pied du grand dragon bleu.
        if (big && spec === "B") {
          R.bone("aura", "root", [0, top + 0.02, 0.06]);
          for (let i = 0; i < 10; i++) {
            const a = (i / 10) * TAU;
            R.glow(G.flame(0.16, 0.55 + (i % 2) * 0.2, 5, 5), "aura", { p: [Math.sin(a) * 1.0, 0, Math.cos(a) * 1.0], c: i % 2 ? C.bfire : "#2f5fd0" });
          }
        }
      },
      pose(st, B) {
        dogPose(st, B, P);
        if (B.aura) {
          B.aura.rotation.y = st.time * 0.8;
          const f = 1 + Math.sin(st.time * 6) * 0.08 + st.s * 0.25 + st.beam * (0.2 + 0.4 * st.heat);
          B.aura.scale.set(1, f, 1);
        }
      },
      muzzle: ["fire", [0, 0, 0.05]],
      muzzles: P.twin ? [["bfire", [0, 0, 0.05]]] : undefined,
    };
  }

  K.defCt("dog", {
    variant,
    info(level, spec) {
      return INFO[spec ? spec + level : String(level)] || null;
    },
  });
})();
