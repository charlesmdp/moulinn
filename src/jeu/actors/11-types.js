// « Pas touche à mes trésors » — les ennemis à pied : proportions chibi, tenues, accessoires, démarches.
//
// Huit personnages calqués sur les ennemis de Cursed Treasure, à la sauce du bocage breton :
// l'agriculteur en colère (paysan), le cow-boy au lasso (guerrier), le druide (mage), la bigoudène aux
// crêpes (prêtre), le chasseur camouflé (ninja), le rugbyman (assassin), le sonneur de biniou (barde) et
// le pompier (paladin). Les trois cavaliers (quad, vache, canard) sont dans 13-mounts.js.
//
// Tout est modelé dans l'espace de liaison du personnage (debout, face à +Z, gauche du personnage = +X,
// pieds à y = 0) : grosse tête (≈ 0,9 m de large), corps trapu, bras et jambes « tuyau d'arrosage »
// pondérés entre deux os, moufles et gros souliers. Vu de haut (≈ 20 à 40 px à l'écran), c'est le
// couvre-chef, la couleur dominante et l'accessoire qu'on reconnaît : casquette rouge et fourche, grand
// chapeau et lasso qui tournoie, robe blanche et couronne de gui, haute coiffe de dentelle, casquette
// orange fluo sur fond de feuillage, cerceaux jaunes et ballon, chapeau rond à rubans et biniou rouge,
// casque doré et veste rouge. Budget : ≤ 4 000 triangles par variante, contour compris.
//
// Rang 0 : ordinaire ; rang 1 : champion (couleurs plus riches, dorures, liseré doré sur le couvre-chef) ;
// rang 2 : boss (champion + grande couronne et cape d'apparat).
(function () {
  "use strict";
  const PTMT = (globalThis.PTMT = globalThis.PTMT || {});
  const A = (PTMT.actors = PTMT.actors || {});
  const TAU = Math.PI * 2;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

  // ---------------------------------------------------------------------------------------------
  // Palette (2e couleur des motifs, indices) et identifiants de motifs / de classes de matière
  // ---------------------------------------------------------------------------------------------
  A.PALETTE = [
    0xf2ead8, 0xffffff, 0xffcf1f, 0xe0302a, 0x1f2a5c, 0x18181c, 0xff7a1a, 0x2c5220,
    0xf2b632, 0x6b4a2a, 0x6aa83a, 0x4e4a44, 0x8a7a48, 0x2a4fc8, 0xb4c0d2, 0x9aa0a8,
    0x15131a, 0xff4f9a, 0x7a4818, 0x8a2be2, 0x1aa9b8, 0xd8262a, 0xffe14a, 0x3a2a1c,
  ];
  const PAL = {
    cream: 0, white: 1, yellow: 2, red: 3, navy: 4, black: 5, orange: 6, dkgreen: 7, gold: 8, brown: 9, leaf: 10, dusk: 11, khaki: 12, royal: 13, lace: 14, grey: 15,
    ink: 16, pink: 17, wicker: 18, violet: 19, teal: 20, scarlet: 21, lemon: 22, umber: 23,
  };
  const PART = { plain: 0, stripes: 2, vstripes: 3, eye: 4, pupil: 5, lace: 6, pie: 7, camo: 8, check: 9, hoops: 10, tartan: 11, feather: 12, jersey: 13, flowers: 14, wicker: 15, glass: 16, straw: 17, dots: 19 };
  const MAT = { matte: 0, satin: 1, gloss: 2, metal: 3, glow: 4, fluo: 5, gold: 6, glass: 7, flash: 8, magic: 9 };
  A.PAL = PAL;
  A.PART = PART;
  A.MAT = MAT;
  const GOLD = 0xffc21a;

  // ---------------------------------------------------------------------------------------------
  // Petites formes (créées à la demande, mises en cache : la fusion les recopie)
  // ---------------------------------------------------------------------------------------------
  const GC = new Map();
  const gc = (key, f) => {
    let g = GC.get(key);
    if (!g) GC.set(key, (g = f()));
    return g;
  };
  const G = {
    sphere: (r, w, h) => gc(`s${r},${w},${h}`, () => new THREE.SphereGeometry(r, w || 10, h || 7)),
    /** Calotte (du pôle nord jusqu'à l'angle polaire theta). */
    dome: (r, w, h, theta) => gc(`d${r},${w},${h},${theta}`, () => new THREE.SphereGeometry(r, w || 14, h || 5, 0, TAU, 0, theta || Math.PI / 2)),
    /** Bande sphérique : secteur phi (autour de Y, 0 = côté -X, PI/2 = avant +Z) et bande polaire theta. */
    band: (r, w, h, p0, pl, t0, tl) => gc(`b${r},${w},${h},${p0},${pl},${t0},${tl}`, () => new THREE.SphereGeometry(r, w, h, p0, pl, t0, tl)),
    cyl: (rt, rb, h, s, open, t0, tl) => gc(`c${rt},${rb},${h},${s},${open},${t0},${tl}`, () => new THREE.CylinderGeometry(rt, rb, h, s || 10, 1, !!open, t0 || 0, tl || TAU)),
    cone: (r, h, s) => gc(`k${r},${h},${s}`, () => new THREE.ConeGeometry(r, h, s || 6)),
    box: (w, h, d) => gc(`x${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d)),
    rbox: (w, h, d, r, s) => gc(`r${w},${h},${d},${r},${s}`, () => PTMT.gfx.roundBox(w, h, d, r, s || 2)),
    torus: (R, r, rs, ts, arc) => gc(`t${R},${r},${rs},${ts},${arc}`, () => new THREE.TorusGeometry(R, r, rs || 5, ts || 14, arc || TAU)),
    lathe: (key, p, s, p0, pl) => gc("l" + key + "," + s + "," + p0 + "," + pl, () => PTMT.gfx.lathe(p, s || 12, p0, pl)),
    tube: (key, pts, r, t, rs) => gc("u" + key, () => PTMT.gfx.tube(pts, r, t || 6, rs || 4)),
    shape: (key, pts, depth) =>
      gc("e" + key, () => {
        const s = new THREE.Shape();
        pts.forEach((q, i) => (i ? s.lineTo(q[0], q[1]) : s.moveTo(q[0], q[1])));
        s.closePath();
        const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 3 });
        g.translate(0, 0, -depth / 2);
        return g;
      }),
  };
  A.G = G;
  A.gc = gc;

  /**
   * Membre « tuyau » le long de points de liaison (courbe lisse), bouts arrondis, couleurs par tronçons
   * nets : stops = [[0, hex], [t, hex], ...]. Couleurs linéaires dans l'attribut color (option colors).
   */
  function limbGeo(key, pts, r0, r1, stops, radial, segs) {
    return gc("m" + key + JSON.stringify(pts) + r0 + "," + r1 + JSON.stringify(stops) + radial + "," + segs, () => {
      radial = radial || 5;
      segs = segs || 3;
      const curve = new THREE.CatmullRomCurve3(pts.map((q) => new THREE.Vector3(q[0], q[1], q[2])));
      const colorAt = (t) => {
        let c = stops[0][1];
        for (const s of stops) if (t >= s[0] - 1e-6) c = s[1];
        return c;
      };
      let tl = [];
      for (let i = 0; i <= segs; i++) tl.push(i / segs);
      for (let j = 1; j < stops.length; j++) if (stops[j][0] > 0.02 && stops[j][0] < 0.98) tl.push(stops[j][0]);
      tl.sort((a, b) => a - b);
      tl = tl.filter((t, i) => i === 0 || t - tl[i - 1] > 0.02 || stops.some((s) => Math.abs(s[0] - t) < 1e-6));
      // anneaux : [t, échelle du rayon, décalage axial (en rayons), couleur]
      const rings = [];
      rings.push([0, Math.cos(Math.PI / 2.6), -Math.sin(Math.PI / 2.6), stops[0][1]]);
      for (const t of tl) {
        const cut = stops.find((s, j) => j > 0 && Math.abs(s[0] - t) < 1e-6);
        if (cut) { rings.push([t, 1, 0, colorAt(t - 0.01)]); rings.push([t, 1, 0, cut[1]]); }
        else rings.push([t, 1, 0, colorAt(t)]);
      }
      const last = colorAt(1);
      rings.push([1, Math.cos(Math.PI / 2.6), Math.sin(Math.PI / 2.6), last]);
      const P = new THREE.Vector3(), Tn = new THREE.Vector3(), Bn = new THREE.Vector3(), Nn = new THREE.Vector3();
      const ref = new THREE.Vector3(0, 0, 1), refX = new THREE.Vector3(1, 0, 0);
      const pos = [], nor = [], col = [], idx = [];
      for (const [t, sc, ax, hex] of rings) {
        curve.getPointAt(t, P);
        curve.getTangentAt(t, Tn);
        Bn.crossVectors(Tn, Math.abs(Tn.z) > 0.9 ? refX : ref).normalize();
        Nn.crossVectors(Bn, Tn).normalize();
        const r = r0 + (r1 - r0) * t;
        const c = PTMT.color(hex);
        const ca = Math.sqrt(Math.max(0, 1 - ax * ax));
        for (let i = 0; i < radial; i++) {
          const a = (i / radial) * TAU;
          const dx = Math.cos(a) * Bn.x + Math.sin(a) * Nn.x, dy = Math.cos(a) * Bn.y + Math.sin(a) * Nn.y, dz = Math.cos(a) * Bn.z + Math.sin(a) * Nn.z;
          pos.push(P.x + (dx * sc + Tn.x * ax) * r, P.y + (dy * sc + Tn.y * ax) * r, P.z + (dz * sc + Tn.z * ax) * r);
          nor.push(dx * ca + Tn.x * ax, dy * ca + Tn.y * ax, dz * ca + Tn.z * ax);
          col.push(c.r, c.g, c.b);
        }
      }
      for (let j = 0; j < rings.length - 1; j++) {
        for (let i = 0; i < radial; i++) {
          const a = j * radial + i, b = j * radial + ((i + 1) % radial), c = (j + 1) * radial + i, d = (j + 1) * radial + ((i + 1) % radial);
          idx.push(a, c, b, b, c, d);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
      g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
      g.setIndex(idx);
      return g;
    });
  }
  /** Poids d'un membre : os du haut avant l'articulation, os du bas après (fondu sur ±blend). */
  function limbWeights(a, e, b, boneA, boneB, blend) {
    const d1 = [e[0] - a[0], e[1] - a[1], e[2] - a[2]], d2 = [b[0] - e[0], b[1] - e[1], b[2] - e[2]];
    const l1 = Math.hypot(d1[0], d1[1], d1[2]) || 1, l2 = Math.hypot(d2[0], d2[1], d2[2]) || 1;
    const dir = [d1[0] / l1 + d2[0] / l2, d1[1] / l1 + d2[1] / l2, d1[2] / l1 + d2[2] / l2];
    const ld = Math.hypot(dir[0], dir[1], dir[2]) || 1;
    return (x, y, z) => {
      const d = ((x - e[0]) * dir[0] + (y - e[1]) * dir[1] + (z - e[2]) * dir[2]) / ld;
      let k = Math.max(0, Math.min(1, (d + blend) / (2 * blend)));
      k = k * k * (3 - 2 * k);
      return [[boneA, 1 - k], [boneB, k]];
    };
  }
  A.limbGeo = limbGeo;
  A.limbWeights = limbWeights;

  /** Nappe souple (cape) : grille de cols × rows, haut à y = 0 (largeur w0), bas à y = -len (largeur w1),
   *  bombée vers l'arrière (-Z) et évasée vers le bas. Faces tournées vers l'arrière. */
  function sheetGeo(key, w0, w1, len, curve, flare, cols, rows) {
    return gc("sheet" + key, () => {
      const pos = [], idx = [];
      for (let j = 0; j <= rows; j++) {
        const v = j / rows, w = w0 + (w1 - w0) * v;
        for (let i = 0; i <= cols; i++) {
          const u = i / cols - 0.5;
          // bombée vers l'arrière, évasée vers le bas, avec des plis qui s'ouvrent en descendant
          pos.push(u * w, -v * len, -curve * (1 - 4 * u * u) - flare * v * v - 0.05 * v * Math.cos(u * Math.PI * 6));
        }
      }
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const a = j * (cols + 1) + i, b = a + 1, c = a + cols + 1, d = c + 1;
        idx.push(a, b, c, b, d, c);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      return g;
    });
  }
  A.sheetGeo = sheetGeo;

  // ---------------------------------------------------------------------------------------------
  // Proportions de base (mètres) et squelette
  // ---------------------------------------------------------------------------------------------
  const STD = {
    headR: 0.46, headY: 1.68, headZ: 0.02, neck: 1.2,
    hip: 0.56, hipX: 0.15, knee: 0.34, ankle: 0.14,
    waist: 0.62, chest: 1.24, torsoR: 0.34, torsoD: 0.86, belly: 0,
    shX: 0.29, shY: 1.08, elX: 0.39, elY: 0.85, wrX: 0.45, wrY: 0.64,
    armR: 0.075, legR: 0.092, handR: 0.125,
    foot: [0.25, 0.16, 0.38],
    eyeR: 0.12, eyeX: 0.165, eyeY: 1.72, eyeZ: 0.385,
    browY: 1.875, browZ: 0.425, mouthY: 1.5, mouthZ: 0.43,
    noseY: 1.6, noseZ: 0.47, noseR: 0.078,
  };
  A.STD = STD;
  function skeleton(p) {
    const L = [
      ["root", null, [0, 0, 0]],
      ["hips", "root", [0, p.hip + 0.02, 0]],
      ["body", "hips", [0, p.waist, 0]],
      ["head", "body", [0, p.neck, 0.01]],
      ["eye_l", "head", [p.eyeX, p.eyeY, p.eyeZ]],
      ["eye_r", "head", [-p.eyeX, p.eyeY, p.eyeZ]],
      ["brow_l", "head", [p.eyeX, p.browY, p.browZ]],
      ["brow_r", "head", [-p.eyeX, p.browY, p.browZ]],
      ["mouth", "head", [0, p.mouthY, p.mouthZ]],
      ["arm_l", "body", [p.shX, p.shY, 0]],
      ["fore_l", "arm_l", [p.elX, p.elY, 0.02]],
      ["hand_l", "fore_l", [p.wrX, p.wrY, 0.04]],
      ["arm_r", "body", [-p.shX, p.shY, 0]],
      ["fore_r", "arm_r", [-p.elX, p.elY, 0.02]],
      ["hand_r", "fore_r", [-p.wrX, p.wrY, 0.04]],
      ["thigh_l", "hips", [p.hipX, p.hip, 0]],
      ["shin_l", "thigh_l", [p.hipX, p.knee, 0.015]],
      ["foot_l", "shin_l", [p.hipX, p.ankle, 0]],
      ["thigh_r", "hips", [-p.hipX, p.hip, 0]],
      ["shin_r", "thigh_r", [-p.hipX, p.knee, 0.015]],
      ["foot_r", "shin_r", [-p.hipX, p.ankle, 0]],
    ];
    return L.map(([name, parent, pos]) => ({ name, parent, pos }));
  }
  const HC = (p) => [0, p.headY, p.headZ];
  /** Centre de la moufle (s = 1 gauche, -1 droite) : là où l'on accroche un accessoire tenu. */
  const handC = (p, s) => [s * (p.wrX + 0.015), p.wrY - p.handR * 0.72, 0.06];
  A.handC = handC;
  /** Teinte éclaircie / assombrie (sRGB). */
  function shade(hex, f, g) {
    const r = Math.min(255, ((hex >> 16) & 255) * f * (g || 1)), gg = Math.min(255, ((hex >> 8) & 255) * f), b = Math.min(255, (hex & 255) * f);
    return (Math.round(r) << 16) | (Math.round(gg) << 8) | Math.round(b);
  }
  A.shade = shade;

  // ---------------------------------------------------------------------------------------------
  // Corps chibi : tête, visage, torse (ou robe), bras, jambes, souliers
  // ---------------------------------------------------------------------------------------------
  // c = { skin, nose, cheek (null = sans joues), brow, browW, iris, headColor (cagoule), noEars,
  //       shirt, shirtPart, shirtPal, shirtMat, sleeve (0 débardeur … 1 manches longues), cuff,
  //       pants, pantsPart, pantsPal, pantsLen (0.3 short … 1 long), socks, legStops (tronçons de jambe),
  //       shoe, sole, glove (null = mains nues), robe { color, part, pal, mat, hem, flare } }
  //       noLegs (caché dans la nacelle), glowEyes (yeux lumineux à pupille fendue : korrigan),
  //       ears (oreilles rondes) ou pointyEars (longues oreilles pointues de lutin)
  function body(k, p, c) {
    head(k, p, c);
    if (c.robe) robe(k, p, c);
    else torso(k, p, c);
    arms(k, p, c);
    if (!c.noLegs) legs(k, p, c);
  }
  function head(k, p, c) {
    // cavaliers et conducteurs (c.lite) : tête un peu moins fine (budget de triangles de la monture)
    k.add(c.lite ? G.sphere(p.headR, 10, 7) : G.sphere(p.headR, 12, 8), { bone: "head", pos: HC(p), scale: [1, 0.96, 0.97], color: c.headColor || c.skin, mat: 1, outline: true });
    if (c.ears) for (const s of [1, -1]) k.add(G.sphere(0.085, 6, 4), { bone: "head", pos: [s * (p.headR - 0.02), p.headY - 0.05, p.headZ - 0.02], scale: [0.55, 1, 0.8], color: c.skin, mat: 1, outline: true });
    if (c.pointyEars) {
      // longues oreilles pointues tendues de côté (on les voit dépasser du chapeau, vues de haut)
      const L = c.pointyEars;
      for (const s of [1, -1]) {
        k.add(G.cone(0.15, L, 6), { bone: "head", pos: [s * (p.headR + L * 0.4), p.headY + 0.08, p.headZ - 0.04], rot: [0, 0, -s * (Math.PI / 2 - 0.42)], scale: [1, 1, 0.5], color: c.skin, mat: 1, outline: true });
        k.add(G.cone(0.085, L * 0.7, 5), { bone: "head", pos: [s * (p.headR + L * 0.34), p.headY + 0.08, p.headZ + 0.0], rot: [0, 0, -s * (Math.PI / 2 - 0.42)], scale: [1, 1, 0.3], color: c.earIn || 0xe07a6a, mat: 1, outline: false });
      }
    }
    face(k, p, c);
  }
  function face(k, p, c) {
    for (const s of [1, -1]) {
      const eb = s > 0 ? "eye_l" : "eye_r", bb = s > 0 ? "brow_l" : "brow_r";
      const ex = s * p.eyeX;
      // (petites sphères peu découpées : à l'échelle du jeu, un œil fait quelques pixels)
      if (c.glowEyes) {
        // yeux de lutin : globe lumineux qui palpite, pupille fendue
        k.add(G.sphere(p.eyeR, 7, 5), { bone: eb, pos: [ex, p.eyeY, p.eyeZ], scale: [0.95, 1.08, 0.8], color: c.glowEyes, mat: MAT.magic, outline: false });
        k.add(G.sphere(p.eyeR * 0.5, 4, 3), { bone: eb, pos: [ex, p.eyeY, p.eyeZ + p.eyeR * 0.62], scale: [0.4, 1.35, 0.55], color: 0x120a04, part: PART.pupil, mat: 2, outline: false });
      } else {
        // blanc bombé (liseré d'encre dans le shader), pupille, reflet
        k.add(G.sphere(p.eyeR, 6, 5), { bone: eb, pos: [ex, p.eyeY, p.eyeZ], scale: [0.9, 1.1, 0.8], color: 0xffffff, part: PART.eye, mat: 2, outline: false });
        k.add(G.sphere(p.eyeR * 0.56, 5, 3), { bone: eb, pos: [ex, p.eyeY - 0.006, p.eyeZ + p.eyeR * 0.55], scale: [1, 1.12, 0.62], color: c.iris || 0x17110d, part: PART.pupil, mat: 2, outline: false });
        k.add(G.sphere(p.eyeR * 0.2, 3, 2), { bone: eb, pos: [ex + 0.026, p.eyeY + 0.03, p.eyeZ + p.eyeR * 0.93], color: 0xffffff, mat: MAT.glow, outline: false });
      }
      k.add(G.box(0.16, 0.06, 0.06), { bone: bb, pos: [ex, p.browY, p.browZ], rot: [0.2, 0, 0], scale: [c.browW || 1, c.browH || 1, 1], color: c.brow || 0x2a1a10, mat: 1, outline: false });
      if (c.cheek !== null) k.add(G.sphere(c.cheekR || 0.07, 5, 2), { bone: "head", pos: [s * 0.27, p.headY - 0.12, p.headZ + 0.35], scale: [1, 0.7, 0.35], color: c.cheek || 0xff8f8f, outline: false });
    }
    if (!c.noNose) k.add(G.sphere(p.noseR, 5, 4), { bone: "head", pos: [0, p.noseY, p.noseZ], scale: [1.05, 0.9, 1], color: c.nose || shade(c.skin, 0.93, 1.04), mat: 1, outline: false });
    k.add(G.sphere(1, 6, 3), { bone: "mouth", pos: [0, p.mouthY, p.mouthZ], scale: [0.1, 0.032, 0.04], color: 0x4a0f12, mat: 1, outline: false });
  }
  function torso(k, p, c) {
    const r = p.torsoR, b = p.belly || 0, w = p.waist, ch = p.chest;
    // chemise / pull (os du corps) : l'ourlet recouvre le haut du pantalon
    const prof = [
      [r * 1.02, w - 0.04],
      [r * 1.08 + b, w + 0.18],
      [r * 1.02 + b * 0.6, w + 0.36],
      [r * 0.86, ch - 0.1],
      [r * 0.5, ch - 0.01],
      [0.001, ch + 0.02],
    ];
    k.add(G.lathe("torso" + r + "," + b + "," + w + "," + ch, prof, 10), { bone: "body", scale: [1, 1, p.torsoD + b * 0.6], color: c.shirt, part: c.shirtPart || 0, pal: c.shirtPal || 0, mat: c.shirtMat || 0, outline: true });
    // bassin (pantalon, os des hanches)
    const pp = [
      [0.001, p.hip - 0.13],
      [r * 0.8, p.hip - 0.08],
      [r * 1.0, p.hip + 0.06],
      [r * 0.8, w + 0.1],
    ];
    k.add(G.lathe("pelvis" + r + "," + p.hip + "," + w, pp, 8), { bone: "hips", scale: [1, 1, p.torsoD + b * 0.4], color: c.pants, part: c.pantsPart || 0, pal: c.pantsPal || 0, mat: c.pantsMat || 0, outline: true });
    shoulders(k, p, c);
  }
  function shoulders(k, p, c) {
    if (!c.shoulders) return;
    const sleeve = c.sleeve > 0.05;
    const sc = sleeve ? c.shirt : c.skin;
    for (const s of [1, -1]) k.add(G.sphere(p.armR * 1.45, 6, 4), { bone: "body", pos: [s * p.shX, p.shY + 0.01, 0], color: sc, outline: false });
  }
  /** Robe longue (druide, bigoudène) : du cou aux chevilles, l'ourlet suit les cuisses. */
  function robe(k, p, c) {
    const r = c.robe, R0 = p.torsoR, w = p.waist, ch = p.chest;
    const hem = r.hem === undefined ? 0.2 : r.hem, fl = r.flare || 1.5;
    const prof = [
      [0.001, hem + 0.05],
      [R0 * fl, hem],
      [R0 * (1 + (fl - 1) * 0.55), p.knee + 0.06],
      [R0 * 1.08, p.hip + 0.04],
      [R0 * 1.04, w + 0.3],
      [R0 * 0.86, ch - 0.1],
      [R0 * 0.5, ch - 0.01],
      [0.001, ch + 0.02],
    ];
    k.add(G.lathe("robe" + R0 + "," + fl + "," + hem + "," + w + "," + ch, prof, 12), { weights: robeWeights(p), scale: [1, 1, p.torsoD * (r.depth || 1.06)], color: r.color, part: r.part || 0, pal: r.pal || 0, mat: r.mat === undefined ? 1 : r.mat, outline: true });
    shoulders(k, p, c);
  }
  function robeWeights(p) {
    return (x, y) => {
      if (y >= p.waist + 0.08) return [["body", 1]];
      if (y >= p.waist - 0.08) { const k = (y - (p.waist - 0.08)) / 0.16; return [["body", k], ["hips", 1 - k]]; }
      const d = clamp((p.hip - y) / Math.max(0.1, p.hip - 0.1), 0, 1) * 0.6;
      const sx = Math.min(1, Math.abs(x) / 0.2);
      return [["hips", 1 - d * sx], [x >= 0 ? "thigh_l" : "thigh_r", d * sx]];
    };
  }
  A.robeWeights = robeWeights;
  function arms(k, p, c) {
    for (const s of [1, -1]) {
      const side = s > 0 ? "_l" : "_r";
      const a = [s * p.shX, p.shY, 0], e = [s * p.elX, p.elY, 0.02], w = [s * p.wrX, p.wrY, 0.04];
      const stops = c.sleeve >= 0.99 ? [[0, c.shirt]] : c.sleeve > 0.05 ? [[0, c.shirt], [c.sleeve, c.skin]] : [[0, c.skin]];
      if (c.cuff) stops.push([0.84, c.cuff]);
      const part = c.sleeve >= 0.99 && !c.cuff ? c.shirtPart || 0 : c.sleevePart || 0;
      k.add(limbGeo("arm" + side + p.armR + "," + p.shX + "," + p.elX, [a, e, w], p.armR * 1.06, p.armR * 0.92, stops, 5, 3), {
        colors: true, part, pal: c.shirtPal || 0, weights: limbWeights(a, e, w, "arm" + side, "fore" + side, 0.07), outline: true,
      });
      // moufle + pouce
      const hc = c.glove || c.skin;
      const hr = p.handR;
      k.add(G.sphere(hr, 6, 4), { bone: "hand" + side, pos: [w[0] + s * 0.015, w[1] - hr * 0.72, w[2] + 0.02], scale: [0.92, 1.05, 0.86], color: hc, mat: 1, outline: !!c.handOutline });
      k.add(G.sphere(hr * 0.42, 4, 3), { bone: "hand" + side, pos: [w[0] - s * 0.05, w[1] - hr * 0.5, w[2] + hr * 0.72], color: hc, mat: 1, outline: false });
    }
  }
  function legs(k, p, c) {
    for (const s of [1, -1]) {
      const side = s > 0 ? "_l" : "_r";
      if (!c.robe) {
        const a = [s * p.hipX, p.hip + 0.04, 0], e = [s * p.hipX, p.knee, 0.015], w = [s * p.hipX, p.ankle + 0.02, 0];
        const stops = c.legStops || (c.pantsLen >= 0.99 ? [[0, c.pants]] : [[0, c.pants], [c.pantsLen, c.socks || c.skin]]);
        k.add(limbGeo("leg" + side + p.hip + "," + p.legR + "," + p.hipX, [a, e, w], p.legR * 1.08, p.legR * 0.92, stops, c.lite ? 4 : 5, 3), {
          colors: true, weights: limbWeights(a, e, w, "thigh" + side, "shin" + side, 0.08), outline: c.legOutline !== false,
        });
      }
      const ft = "foot" + side, f = p.foot;
      k.add(G.rbox(f[0], f[1], f[2], 0.07, c.lite ? 1 : 2), { bone: ft, pos: [s * p.hipX, f[1] * 0.5 + 0.02, f[2] * 0.18], color: c.shoe, mat: c.shoeMat === undefined ? 1 : c.shoeMat, outline: false });
      if (c.sole) k.add(G.box(f[0] + 0.02, 0.05, f[2] + 0.02), { bone: ft, pos: [s * p.hipX, 0.025, f[2] * 0.18], color: c.sole, mat: 0, outline: false });
    }
  }
  A.body = body;

  // ---------------------------------------------------------------------------------------------
  // Couvre-chefs, vêtements, accessoires, dorures (partagés avec 13-mounts.js)
  // ---------------------------------------------------------------------------------------------
  function mustache(k, p, col, w, bone, outline) {
    w = w || 1;
    for (const s of [1, -1]) k.add(G.sphere(0.07, 6, 4), { bone: bone || "head", pos: [s * 0.075 * w, p.mouthY + 0.045, p.mouthZ + 0.03], scale: [1.35 * w, 0.55, 0.6], rot: [0, 0, s * 0.3], color: col, mat: 1, outline: outline !== false });
  }
  /** Casquette à visière. o : { color, visor, band (liseré), theta, bone } */
  function cap(k, p, o) {
    const bone = o.bone, th = o.theta || 1.05;
    const R = p.headR * 1.06;
    k.add(G.dome(R, 12, 4, th), { bone, pos: [0, p.headY + 0.03, p.headZ - 0.01], scale: [1, 0.94, 1.02], color: o.color, mat: o.mat || 0, outline: true });
    const ey = p.headY + 0.03 + R * 0.94 * Math.cos(th), er = R * Math.sin(th);
    k.add(G.cyl(0.34, 0.34, 0.035, 8, false, -Math.PI / 2, Math.PI), { bone, pos: [0, ey + 0.01, p.headZ + er * 0.62], rot: [0.14, 0, 0], scale: [1, 1, 0.95], color: o.visor || shade(o.color, 0.8), mat: o.mat || 0, outline: true });
    if (o.front) k.add(G.band(R * 1.035, 6, 2, Math.PI / 2 - 0.55, 1.1, th * 0.25, th * 0.7), { bone, pos: [0, p.headY + 0.03, p.headZ - 0.01], scale: [1, 0.94, 1.02], color: o.front, mat: o.mat || 0, outline: false });
    if (o.band) k.add(G.torus(er + 0.01, 0.028, 3, 14), { bone, pos: [0, ey + 0.015, p.headZ - 0.01], rot: [Math.PI / 2, 0, 0], color: o.band, mat: MAT.gold, outline: false });
    k.add(G.sphere(0.045, 4, 3), { bone, pos: [0, p.headY + 0.03 + R * 0.94, p.headZ - 0.01], color: o.button || o.visor || o.color, mat: o.band ? MAT.gold : 0, outline: false });
    return p.headY + 0.03 + R * 0.94;
  }
  /** Couronne d'or (open : anneau + fleurons + joyaux). */
  function crown(k, o) {
    const bone = o.bone, x = o.pos[0], y = o.pos[1], z = o.pos[2], r = o.r, h = o.h;
    const col = o.color || GOLD;
    k.add(G.cyl(r, r * 0.92, h, 10, true), { bone, pos: [x, y + h / 2, z], color: col, mat: MAT.gold, outline: true });
    k.add(G.cyl(r * 0.97, r * 0.89, h, 10, true), { bone, pos: [x, y + h / 2, z], color: shade(col, 0.75), mat: MAT.gold, outline: false, invert: true });
    const n = o.spikes || 5;
    const jewels = o.jewels || [0xe8243a, 0x2b8cff];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + (o.rot || 0);
      const sx = Math.sin(a), sz = Math.cos(a);
      k.add(G.cone(r * 0.3, h * 1.15, 4), { bone, pos: [x + sx * r * 0.96, y + h + h * 0.55, z + sz * r * 0.96], rot: [0, a + Math.PI / 4, 0], scale: [1, 1, 0.55], color: col, mat: MAT.gold, outline: o.big === true });
      k.add(G.sphere(r * 0.1, 3, 2), { bone, pos: [x + sx * r * 0.96, y + h * 2.15, z + sz * r * 0.96], color: 0xfff0a0, mat: MAT.gold, outline: false });
      k.add(G.sphere(r * 0.11, 4, 2), { bone, pos: [x + sx * r * 1.0, y + h * 0.5, z + sz * r * 1.0], scale: [1, 1, 0.6], quat: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), a), color: jewels[i % jewels.length], mat: MAT.glow, outline: false });
    }
    return y + h * 2.2;
  }
  /** Liseré doré (anneau). */
  function goldRing(k, bone, pos, R, r, rot, scale) {
    k.add(G.torus(R, r || 0.03, 3, 14), { bone, pos, rot: rot || [Math.PI / 2, 0, 0], scale, color: GOLD, mat: MAT.gold, outline: false });
  }
  /** Tige (cylindre) tendue d'un point a à un point b ; opt : options de Builder.add (+ seg). */
  let _ra = null, _rb = null, _rUp = null;
  function rod(k, a, b, r, color, opt) {
    if (!_ra) { _ra = new THREE.Vector3(); _rb = new THREE.Vector3(); _rUp = new THREE.Vector3(0, 1, 0); }
    _ra.fromArray(a);
    _rb.fromArray(b);
    const len = Math.max(1e-4, _ra.distanceTo(_rb));
    _rb.sub(_ra).divideScalar(len);
    const q = new THREE.Quaternion().setFromUnitVectors(_rUp, _rb);
    const o = Object.assign({ pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], quat: q, scale: [1, len, 1], color, mat: 1 }, opt || {});
    k.add(G.cyl(r, r, 1, (opt && opt.seg) || 5), o);
  }
  /** Cocarde de concours (rubans et disque doré). */
  function rosette(k, bone, pos, s, cols) {
    s = s || 1;
    cols = cols || [0xe0262a, 0x2446b8];
    k.add(G.cyl(0.13 * s, 0.13 * s, 0.03, 10), { bone, pos, rot: [Math.PI / 2 - 0.1, 0, 0], color: cols[0], mat: 1, outline: true });
    k.add(G.cyl(0.075 * s, 0.075 * s, 0.035, 8), { bone, pos: [pos[0], pos[1], pos[2] + 0.02], rot: [Math.PI / 2 - 0.1, 0, 0], color: GOLD, mat: MAT.gold, outline: false });
    for (const d of [-1, 1]) k.add(G.box(0.07 * s, 0.24 * s, 0.02), { bone, pos: [pos[0] + d * 0.05 * s, pos[1] - 0.17 * s, pos[2] - 0.01], rot: [0, 0, d * 0.25], color: cols[1], mat: 1, outline: false });
  }
  /** Cape d'apparat (boss) : velours + doublure dorée, col d'hermine ; os p_cape (dos, sous la nuque). */
  function capeProp(o) {
    return {
      name: "cape", parent: "body", pos: [0, o.top, o.z],
      build(k, s) {
        const p = s.p, top = o.top, z = o.z;
        const g = sheetGeo("cape" + o.w0 + "," + o.w1 + "," + o.len, o.w0, o.w1, o.len, 0.18, 0.28, 6, 4);
        const weights = (x, y) => {
          const v = clamp((top - y) / 0.35, 0, 1);
          return [["body", 1 - v], ["p_cape", v]];
        };
        k.add(g, { pos: [0, top, z], color: o.color || 0xc01a2a, mat: 1, weights, outline: true });
        k.add(g, { pos: [0, top, z + 0.012], color: o.lining || 0xf2b632, mat: o.lining ? 1 : MAT.gold, weights, outline: false, invert: true });
        // col d'hermine
        k.add(G.torus(p.torsoR * 0.95, 0.075, 4, 10), { bone: "body", pos: [0, p.chest - 0.02, -0.03], rot: [Math.PI / 2 + 0.12, 0, 0], scale: [1, 0.9, 1], color: 0xfbf8f0, mat: 1, outline: true });
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI + Math.PI * 0.17;
          k.add(G.box(0.03, 0.05, 0.03), { bone: "body", pos: [Math.cos(a) * p.torsoR * 0.95, p.chest + 0.02, -0.03 - Math.sin(a) * p.torsoR * 0.95 * 0.9], color: 0x111111, outline: false });
        }
      },
    };
  }
  A.parts = { mustache, cap, crown, goldRing, rosette, capeProp, HC, rod };

  /** Salopette : bavette, bretelles, boucles. */
  function overalls(k, p, col, buckle) {
    const z = p.torsoR * p.torsoD + (p.belly || 0) * 0.5;
    k.add(G.rbox(0.46, 0.36, 0.08, 0.035, 1), { bone: "body", pos: [0, p.waist + 0.3, z + 0.02], rot: [-0.08, 0, 0], color: col, mat: 0, outline: true });
    k.add(G.rbox(0.18, 0.09, 0.03, 0.012, 1), { bone: "body", pos: [0, p.waist + 0.32, z + 0.07], rot: [-0.08, 0, 0], color: shade(col, 0.72), outline: false });
    for (const s of [1, -1]) {
      k.add(G.tube("strap" + s + p.torsoR + "," + p.chest, [[s * 0.17, p.waist + 0.44, z + 0.02], [s * 0.2, p.chest - 0.02, 0.2], [s * 0.2, p.chest, -0.1], [s * 0.17, p.waist + 0.4, -z - 0.02]], 0.032, 6, 4), { bone: "body", color: col, outline: false });
      k.add(G.cyl(0.04, 0.04, 0.025, 8), { bone: "body", pos: [s * 0.17, p.waist + 0.44, z + 0.07], rot: [Math.PI / 2, 0, 0], color: buckle || 0xe8c45a, mat: buckle === GOLD ? MAT.gold : MAT.metal, outline: false });
    }
  }
  /** Foulard noué autour du cou (pointe devant). */
  function bandana(k, p, col) {
    k.add(G.torus(p.torsoR * 0.85, 0.06, 4, 10), { bone: "body", pos: [0, p.chest - 0.03, 0.0], rot: [Math.PI / 2 + 0.15, 0, 0], scale: [1, 0.9, 1], color: col, mat: 1, outline: true });
    k.add(G.cone(0.16, 0.3, 4), { bone: "body", pos: [0, p.chest - 0.18, p.torsoR * p.torsoD + 0.03], rot: [Math.PI + 0.25, Math.PI / 4, 0], scale: [1.2, 1, 0.4], color: col, mat: 1, outline: true });
  }
  /** Gilet ouvert devant (coquille de révolution échancrée). */
  function vest(k, p, col, opt) {
    opt = opt || {};
    const r = p.torsoR * 1.07, b = p.belly || 0, w = p.waist, ch = p.chest;
    const prof = [[r * 1.02 + b * 0.5, w + 0.04], [r * 1.07 + b, w + 0.22], [r * 0.93, ch - 0.12], [r * 0.52, ch + 0.01]];
    const open = opt.open || 0.55;
    k.add(G.lathe("vest" + r + "," + b + "," + open, prof, 10, open, TAU - open * 2), { bone: "body", scale: [1, 1, p.torsoD + b * 0.6], color: col, mat: opt.mat === undefined ? 1 : opt.mat, outline: true });
    k.add(G.lathe("vest" + r + "," + b + "," + open, prof, 10, open, TAU - open * 2), { bone: "body", scale: [0.985, 1, (p.torsoD + b * 0.6) * 0.985], color: shade(col, 0.6), mat: 1, outline: false, invert: true });
    if (opt.trim) {
      // bordure brodée le long de l'ouverture
      for (const s of [1, -1]) k.add(G.tube("vtrim" + s + r, [[s * Math.sin(open) * r * 1.05, w + 0.05, Math.cos(open) * r * (p.torsoD + b * 0.6) * 1.02], [s * Math.sin(open) * r * 0.98, w + 0.3, Math.cos(open) * r * (p.torsoD + b * 0.6) * 1.04], [s * 0.2, ch - 0.06, 0.2]], 0.025, 6, 4), { bone: "body", color: opt.trim, mat: opt.trimMat || 1, outline: false });
    }
  }
  function belt(k, p, col, buckle, buckleMat) {
    const b = p.belly || 0;
    k.add(G.torus(p.torsoR * 1.03 + b * 0.35, 0.045, 3, 12), { bone: "hips", pos: [0, p.waist + 0.02, 0], rot: [Math.PI / 2, 0, 0], scale: [1, p.torsoD + b * 0.45, 1], color: col, mat: 1, outline: false });
    if (buckle) k.add(G.rbox(0.16, 0.12, 0.04, 0.02, 1), { bone: "hips", pos: [0, p.waist + 0.02, (p.torsoR * 1.03 + b * 0.35) * (p.torsoD + b * 0.45) + 0.02], color: buckle, mat: buckleMat || MAT.metal, outline: false });
  }
  A.parts.overalls = overalls;
  A.parts.bandana = bandana;
  A.parts.vest = vest;
  A.parts.belt = belt;

  // ---------------------------------------------------------------------------------------------
  // Définitions des types
  // ---------------------------------------------------------------------------------------------
  // label, championLabel ; p : proportions (écarts à STD) ; look : couleurs (sRGB) ; champion / boss :
  // surcharges ; mood : humeur du visage ; motion : { gait, arms: [gauche, droite] } ; carry : gemme
  // portée { pos (os p_gem, repère du buste), arms } ; dims (m) pour les effets (glaçon, bulle, ombre) ;
  // height : sommet (barre de vie) ; props(s) : os d'accessoires ; build(k, s) ; animate(a, dt, s, moving).
  const T = {};

  // --- Agriculteur en colère : casquette rouge, chemise vichy, salopette bleue, bottes vertes, fourche --
  T.fermier = {
    label: "Agriculteur en colère",
    championLabel: "Fermier primé",
    p: { headR: 0.47, torsoR: 0.36, belly: 0.04 },
    look: {
      skin: 0xf2a47e, cheek: 0xff5e4e, brow: 0x3a2412, browW: 1.25, browH: 1.3, nose: 0xe88a66,
      shirt: 0xd8302a, shirtPart: PART.check, shirtPal: PAL.white, sleeve: 0.5,
      pants: 0x2f63c0, legStops: [[0, 0x2f63c0], [0.5, 0x2f8a3a]], shoe: 0x2f8a3a, sole: 0x1a4a1f,
      cap: 0xd8302a, capFront: 0xf4efe2, fork: 0xb8c0c8, mustache: 0x5a3418,
    },
    champion: { look: { shirt: 0xb81a2a, pants: 0x2446b8, legStops: [[0, 0x2446b8], [0.5, 0x24702e]], shoe: 0x24702e, cap: 0xc81e2a, fork: GOLD } },
    mood: "angry",
    motion: { gait: "stomp", arms: ["fist", "fork"] },
    carry: { pos: [0.5, 2.5, 0.08], arms: ["carryUp", "fork"] },
    dims: { w: 1.2, h: 2.5, d: 1.0 },
    height: 2.5,
    props(s) {
      const p = s.p, hc = handC(p, -1);
      const out = [
        { name: "hat", parent: "head", pos: [0, p.headY + 0.3, p.headZ], build: (k, s) => {
          const top = cap(k, s.p, { color: s.look.cap, front: s.look.capFront, band: s.champion ? GOLD : 0, theta: 1.02 });
          if (s.boss) crown(k, { pos: [0, top - 0.06, s.p.headZ - 0.03], r: 0.3, h: 0.16, big: true });
        } },
        { name: "fork", parent: "hand_r", pos: hc, build: (k, s) => pitchfork(k, hc, s.look.fork, s.champion) },
      ];
      if (s.boss) out.push(capeProp({ top: p.shY + 0.14, z: -0.22, w0: 0.72, w1: 1.15, len: 1.18 }));
      return out;
    },
    build(k, s) {
      const p = s.p;
      body(k, p, s.look);
      overalls(k, p, s.look.pants, s.champion ? GOLD : 0xe8c45a);
      mustache(k, p, s.look.mustache, 1.25);
      if (s.champion) rosette(k, "body", [0.2, p.waist + 0.42, p.torsoR * p.torsoD + 0.1], 1.1);
    },
    animate(a, dt, s, moving) {
      // fourche gardée debout, pointée vers l'avant, qui s'agite au rythme du bras
      const k = Math.sin(a.time * 9 + a.id);
      a.hold("fork", 1, 0.3 + 0.18 * k, 0, -0.1);
    },
  };
  function pitchfork(k, hc, tine, gold) {
    const [x, y, z] = hc;
    k.add(G.cyl(0.032, 0.032, 1.5, 5), { pos: [x, y + 0.3, z], color: 0xa0703a, mat: 1, outline: true });
    k.add(G.rbox(0.36, 0.06, 0.06, 0.02, 1), { pos: [x, y + 1.06, z], color: tine, mat: gold ? MAT.gold : MAT.metal, outline: true });
    for (const d of [-0.15, 0, 0.15]) k.add(G.cone(0.028, 0.42, 4), { pos: [x + d, y + 1.3, z], color: tine, mat: gold ? MAT.gold : MAT.metal, outline: true });
  }

  // --- Cow-boy au lasso : grand chapeau, foulard rouge, gilet de cuir, lasso qui tournoie --------
  const BIG = { torsoR: 0.4, belly: 0.06, torsoD: 0.9, shX: 0.34, elX: 0.5, wrX: 0.56, armR: 0.088, legR: 0.1, handR: 0.14, hipX: 0.17, foot: [0.28, 0.18, 0.42] };
  T.cowboy = {
    label: "Cow-boy au lasso",
    championLabel: "Cow-boy de rodéo",
    p: BIG,
    look: {
      skin: 0xe0a070, brow: 0x3a2414, browW: 1.2, shirt: 0x6fa8dc, sleeve: 1, pants: 0x2f5aa8,
      legStops: [[0, 0x2f5aa8], [0.6, 0x7a4a22]], shoe: 0x7a4a22, sole: 0x3a2412,
      hat: 0x8a5a2b, hatBand: 0x3a2414, vest: 0xb87a3a, bandana: 0xd8262a, buckle: 0xd8dde3, rope: 0xd8b070, mustache: 0x3a2414,
    },
    champion: { look: { hat: 0xf4efe2, hatBand: GOLD, shirt: 0xc0282a, vest: 0x2a2420, bandana: 0x1f2a5c, buckle: GOLD, pants: 0x24407a, legStops: [[0, 0x24407a], [0.6, 0x5a3418]], shoe: 0x5a3418 } },
    mood: "stern",
    motion: { gait: "heavy", arms: ["hip", "lasso"] },
    carry: { pos: [0.56, 2.6, 0.1], arms: ["carryUp", null] },
    dims: { w: 1.4, h: 2.6, d: 1.2 },
    height: 2.62,
    props(s) {
      const p = s.p, hc = handC(p, -1);
      const out = [
        { name: "hat", parent: "head", pos: [0, p.headY + 0.3, p.headZ], build: (k, s) => {
          const top = cowboyHat(k, s.p, { color: s.look.hat, band: s.look.hatBand, gold: s.champion });
          if (s.boss) crown(k, { pos: [0, top - 0.12, s.p.headZ - 0.02], r: 0.26, h: 0.15, big: true });
        } },
        { name: "lasso", parent: "body", pos: hc, build: (k, s) => lassoLoop(k, hc, s.look.rope) },
        { name: "rope", parent: "body", pos: hc, build: (k, s) => k.add(G.cyl(0.02, 0.02, 1, 4), { pos: [hc[0], hc[1] + 0.5, hc[2]], color: s.look.rope, mat: 1, outline: true }) },
      ];
      if (s.boss) out.push(capeProp({ top: p.shY + 0.14, z: -0.26, w0: 0.8, w1: 1.25, len: 1.2, color: 0x7a1a1a }));
      return out;
    },
    build(k, s) {
      const p = s.p, L = s.look;
      body(k, p, L);
      vest(k, p, L.vest, { trim: s.champion ? GOLD : null, trimMat: MAT.gold });
      bandana(k, p, L.bandana);
      belt(k, p, 0x4a2a14, L.buckle, s.champion ? MAT.gold : MAT.metal);
      mustache(k, p, L.mustache, 1.4);
      // éperons
      for (const sd of [1, -1]) k.add(G.torus(0.06, 0.018, 4, 8), { bone: sd > 0 ? "foot_l" : "foot_r", pos: [sd * p.hipX, 0.12, -0.12], rot: [0, Math.PI / 2, 0], color: s.champion ? GOLD : 0xd8dde3, mat: s.champion ? MAT.gold : MAT.metal, outline: false });
      if (s.boss) {
        // grande étoile de shérif
        k.add(G.shape("star5", starPts(0.17, 0.075, 5), 0.04), { bone: "body", pos: [0.19, p.waist + 0.4, p.torsoR * p.torsoD + 0.06], rot: [-0.1, 0, 0], color: GOLD, mat: MAT.gold, outline: true });
      } else if (s.champion) {
        k.add(G.shape("star5s", starPts(0.1, 0.045, 5), 0.03), { bone: "body", pos: [0.19, p.waist + 0.4, p.torsoR * p.torsoD + 0.06], rot: [-0.1, 0, 0], color: GOLD, mat: MAT.gold, outline: false });
      }
    },
    animate(a, dt, s) {
      // le lasso tournoie au-dessus de la main ; au geste « lasso », la boucle file vers la cible (gemme
      // tombée), se referme, puis revient. Boucle et corde sont des os du buste placés d'après la main.
      const B = a.B, g = a.gesture === "lasso" ? a.gestureT : -1;
      a.lassoA += dt * (g >= 0 && g < 0.32 ? 17 : 9);
      const show = s.carrying || a.dead ? 0 : 1;
      if (!show) { B.p_lasso.scale.setScalar(0); B.p_rope.scale.setScalar(0); return; }
      const hand = a.handInBody(1, a.v1);
      let cx = hand.x, cy = hand.y + 0.5, cz = hand.z, sc = 1;
      if (g >= 0.3) {
        const tb = a.targetInBody(a.v2, 5.4, 3.2);
        const k = g < 0.58 ? (g - 0.3) / 0.28 : g < 0.8 ? 1 : 1 - (g - 0.8) / 0.2;
        const e = k * k * (3 - 2 * k);
        cx += (tb.x - cx) * e; cz += (tb.z - cz) * e;
        cy += (tb.y + 0.12 - cy) * e + (g < 0.58 ? Math.sin(e * Math.PI) * 0.7 : 0);
        sc = g < 0.58 ? 1 + 0.25 * e : g < 0.8 ? 0.62 : 0.62 + 0.38 * (1 - k);
      }
      B.p_lasso.position.set(cx, cy - 0.5 * sc, cz);
      B.p_lasso.rotation.set(0, a.lassoA, 0);
      B.p_lasso.scale.setScalar(sc);
      // corde : de la main au nœud de la boucle (qui tourne avec elle)
      const r = 0.5 * sc;
      a.rope("rope", hand, cx + Math.sin(a.lassoA) * r, cy, cz + Math.cos(a.lassoA) * r, 1);
    },
  };
  function starPts(R, r, n) {
    const pts = [];
    for (let i = 0; i < n * 2; i++) {
      const a = (i / (n * 2)) * TAU + Math.PI / 2;
      const rr = i % 2 ? r : R;
      pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
    }
    return pts;
  }
  A.parts.starPts = starPts;
  function cowboyHat(k, p, o) {
    const bone = o.bone || "p_hat";
    const y0 = p.headY + 0.25, z = p.headZ - 0.02;
    k.add(G.lathe("cowcrown", [[0.001, 0.31], [0.26, 0.29], [0.345, 0.18], [0.37, -0.05]], 10), { bone, pos: [0, y0, z], scale: [1, 1, 0.9], color: o.color, mat: 1, outline: true });
    k.add(G.box(0.06, 0.04, 0.44), { bone, pos: [0, y0 + 0.305, z], color: shade(o.color, 0.7), outline: false });
    const brim = gc("cowbrim", () => {
      const g = PTMT.gfx.lathe([[0.3, 0.035], [0.56, 0.02], [0.7, 0.085], [0.68, 0.1], [0.55, 0.0], [0.3, 0.005]], 14);
      const pos = g.getAttribute("position");
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        // bords relevés à gauche et à droite
        pos.setY(i, pos.getY(i) + 0.17 * Math.pow(Math.abs(x) / 0.7, 2.4));
        pos.setZ(i, pos.getZ(i) * 0.94);
      }
      g.computeVertexNormals();
      return g;
    });
    k.add(brim, { bone, pos: [0, y0 - 0.04, z], color: o.color, mat: 1, outline: true });
    k.add(G.cyl(0.366, 0.372, 0.075, 10, true), { bone, pos: [0, y0 + 0.02, z], scale: [1, 1, 0.9], color: o.band, mat: o.gold ? MAT.gold : 1, outline: false });
    return y0 + 0.31;
  }
  function lassoLoop(k, hc, col) {
    const [x, y, z] = hc;
    k.add(G.torus(0.5, 0.032, 3, 16), { pos: [x, y + 0.5, z], rot: [Math.PI / 2, 0, 0], color: col, mat: 1, outline: true });
    k.add(G.sphere(0.055, 4, 3), { pos: [x, y + 0.5, z + 0.5], color: shade(col, 0.8), outline: false });
  }

  // --- Druide : robe blanche, longue barbe, couronne de gui, faucille d'or ------------------------
  T.druide = {
    label: "Druide",
    championLabel: "Archidruide",
    p: { headR: 0.45, torsoR: 0.35, torsoD: 0.92 },
    look: {
      skin: 0xf2c2a0, cheek: 0xff9a8a, brow: 0xeeeeea, browW: 1.35, browH: 1.4, nose: 0xe8a088,
      shirt: 0xf6f4ec, sleeve: 1, pants: 0xf6f4ec, shoe: 0x8a5a30, sole: 0x5a3818,
      robe: { color: 0xf6f4ec, hem: 0.14, flare: 1.55, mat: 1 },
      leaf: 0x5aa832, sickle: GOLD, beard: 0xfbfbf7, rope: 0xd8b060,
    },
    champion: { look: { robe: { color: 0xfbfaf4, hem: 0.14, flare: 1.6, mat: 1 }, cuff: GOLD, leaf: 0x4fb02a, rope: GOLD } },
    mood: "calm",
    motion: { gait: "glide", arms: [null, "sickle"] },
    carry: { pos: [0.5, 2.55, 0.1], arms: ["carryUp", "sickle"] },
    dims: { w: 1.3, h: 2.5, d: 1.2 },
    height: 2.42,
    props(s) {
      const p = s.p, hc = handC(p, -1);
      const out = [{ name: "sickle", parent: "hand_r", pos: hc, build: (k, s) => sickle(k, hc, s.look.sickle) }];
      if (s.boss) out.push(capeProp({ top: p.shY + 0.14, z: -0.24, w0: 0.74, w1: 1.2, len: 1.12, color: 0x2f7a2a, lining: 0xf6f4ec }));
      return out;
    },
    build(k, s) {
      const p = s.p, L = s.look;
      body(k, p, L);
      // cheveux blancs derrière, barbe fleuve, moustache
      k.add(G.dome(p.headR * 1.04, 12, 5, 1.9), { bone: "head", pos: [0, p.headY + 0.02, p.headZ - 0.06], rot: [-1.35, 0, 0], color: L.beard, mat: 1, outline: true });
      k.add(G.cone(0.3, 0.95, 8), { bone: "head", pos: [0, p.headY - 0.62, p.headZ + 0.28], rot: [Math.PI - 0.12, 0, 0], scale: [1.05, 1, 0.55], color: L.beard, mat: 1, outline: true });
      mustache(k, p, L.beard, 1.35);
      // couronne de gui
      const y = p.headY + 0.3, R = p.headR * 0.9;
      k.add(G.torus(R, 0.05, 3, 14), { bone: "head", pos: [0, y, p.headZ - 0.02], rot: [Math.PI / 2 - 0.08, 0, 0], color: shade(L.leaf, 0.75), mat: 1, outline: true });
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU + 0.2;
        const x = Math.cos(a) * R, z = p.headZ - 0.02 + Math.sin(a) * R;
        for (const d of [-0.45, 0.45]) k.add(G.sphere(0.11, 5, 2), { bone: "head", pos: [x, y + 0.05, z], rot: [0.9, -a + Math.PI / 2 + d, 0], scale: [0.45, 1, 0.22], color: L.leaf, mat: 2, outline: false });
        if (i % 2 === 0) k.add(G.sphere(0.045, 4, 2), { bone: "head", pos: [x * 1.05, y + 0.1, p.headZ - 0.02 + (z - p.headZ + 0.02) * 1.05], color: 0xfbfbf2, mat: 2, outline: false });
      }
      // ceinture de corde et ses pans
      belt(k, p, L.rope, 0, 0);
      k.add(G.tube("druidrope", [[0.2, p.waist, p.torsoR * p.torsoD * 1.05], [0.24, p.waist - 0.25, p.torsoR * p.torsoD * 1.15], [0.22, p.waist - 0.45, p.torsoR * p.torsoD * 1.2]], 0.03, 5, 4), { bone: "hips", color: L.rope, mat: s.champion ? MAT.gold : 1, outline: false });
      if (s.champion) {
        goldRing(k, "head", [0, y - 0.02, p.headZ - 0.02], R * 1.02, 0.03, [Math.PI / 2 - 0.08, 0, 0]);
        // ourlet et col dorés, torque
        goldRing(k, "hips", [0, 0.2, 0], p.torsoR * 1.5, 0.04, [Math.PI / 2, 0, 0], [1, p.torsoD * 1.06, 1]);
        k.add(G.torus(p.torsoR * 0.78, 0.04, 3, 10, Math.PI * 1.6), { bone: "body", pos: [0, p.chest - 0.02, 0.02], rot: [Math.PI / 2 + 0.1, 0, Math.PI * 0.2], color: GOLD, mat: MAT.gold, outline: false });
      }
      if (s.boss) crown(k, { bone: "head", pos: [0, y - 0.02, p.headZ - 0.02], r: 0.36, h: 0.17, spikes: 6, big: true, jewels: [0x3fd06a, 0xf2f2e8] });
    },
    animate(a) {
      a.hold("sickle", 1, 0.2, 0, 0);
    },
  };
  function sickle(k, hc, col) {
    const [x, y, z] = hc;
    k.add(G.cyl(0.035, 0.035, 0.34, 5), { pos: [x, y + 0.08, z], color: 0x7a4a24, mat: 1, outline: true });
    k.add(G.torus(0.2, 0.035, 4, 10, Math.PI * 1.25), { pos: [x, y + 0.42, z + 0.05], rot: [0, 0, -0.3], scale: [1, 1, 0.5], color: col, mat: MAT.gold, outline: true });
  }

  // --- Bigoudène aux crêpes : haute coiffe de dentelle, robe noire brodée, tablier, pile de crêpes --
  T.bigoudene = {
    label: "Bigoudène aux crêpes",
    championLabel: "Bigoudène du Pardon",
    p: { headR: 0.45, torsoR: 0.33, torsoD: 0.95, belly: 0.02 },
    look: {
      skin: 0xf6c8a6, cheek: 0xff8a8a, brow: 0x7a6a60, nose: 0xf0a888,
      shirt: 0x1a1822, sleeve: 1, cuff: 0xff8a1a, pants: 0x1a1822, shoe: 0x1a1a1e, sole: 0x0a0a0c,
      robe: { color: 0x1a1822, hem: 0.13, flare: 1.5, mat: 1 },
      apron: 0x2f6be0, embroA: 0xff8a1a, embroB: 0xffcf1f, plate: 0xf4f4f0, crepe: 0xe0a048,
    },
    champion: { look: { apron: 0xf2c040, embroA: 0xff6a1a, embroB: GOLD, plate: GOLD } },
    mood: "jolly",
    motion: { gait: "shuffle", arms: ["plate", null] },
    carry: { pos: [-0.5, 2.45, 0.2], arms: ["plate", "carryUp"] },
    dims: { w: 1.2, h: 2.95, d: 1.1 },
    height: 2.98,
    props(s) {
      const p = s.p, hc = handC(p, 1);
      const out = [{ name: "plate", parent: "hand_l", pos: hc, build: (k, s) => crepes(k, hc, s.look) }];
      if (s.boss) out.push(capeProp({ top: p.shY + 0.14, z: -0.22, w0: 0.7, w1: 1.15, len: 1.12 }));
      return out;
    },
    build(k, s) {
      const p = s.p, L = s.look;
      body(k, p, L);
      // broderies (bandes orange et jaunes) sur l'ourlet et le corsage
      const hemR = p.torsoR * 1.5;
      for (const [yy, rr, col] of [[0.24, hemR * 0.985, L.embroA], [0.34, hemR * 0.95, L.embroB]]) k.add(G.torus(rr, 0.035, 3, 14), { bone: "hips", pos: [0, yy, 0], rot: [Math.PI / 2, 0, 0], scale: [1, p.torsoD * 1.06, 1], color: col, mat: 1, outline: false });
      k.add(G.cyl(0.19, 0.19, 0.05, 8), { bone: "body", pos: [0, p.waist + 0.38, p.torsoR * p.torsoD + 0.0], rot: [Math.PI / 2 - 0.12, 0, 0], scale: [1.1, 1, 0.8], color: L.embroA, mat: 1, outline: true });
      k.add(G.cyl(0.11, 0.11, 0.05, 8), { bone: "body", pos: [0, p.waist + 0.39, p.torsoR * p.torsoD + 0.025], rot: [Math.PI / 2 - 0.12, 0, 0], scale: [1.1, 1, 0.8], color: L.embroB, mat: 1, outline: false });
      // tablier de satin (coquille avant) et son ourlet de dentelle
      const ap = [[p.torsoR * 1.46, 0.3], [p.torsoR * 1.3, p.knee + 0.05], [p.torsoR * 1.14, p.hip], [p.torsoR * 1.08, p.waist + 0.02]];
      k.add(G.lathe("apron" + p.torsoR, ap, 6, -0.62, 1.24), { weights: robeWeights(p), scale: [1, 1, p.torsoD * 1.1], color: L.apron, mat: 2, outline: true });
      k.add(G.torus(p.torsoR * 1.47 * p.torsoD * 1.1, 0.03, 4, 8, 1.24), { bone: "hips", pos: [0, 0.3, 0], rot: [Math.PI / 2, 0, Math.PI / 2 - 0.62], color: 0xfbfbf7, mat: 1, outline: false });
      // col de dentelle
      k.add(G.torus(p.torsoR * 0.82, 0.06, 3, 12), { bone: "body", pos: [0, p.chest - 0.02, 0.01], rot: [Math.PI / 2 + 0.12, 0, 0], scale: [1, 0.95, 0.5], color: 0xfbfbf7, part: PART.lace, pal: PAL.lace, mat: 1, outline: true });
      coiffe(k, p, L, s);
      if (s.champion) {
        // croix d'or et liseré
        k.add(G.box(0.05, 0.16, 0.03), { bone: "body", pos: [0, p.chest - 0.2, p.torsoR * p.torsoD * 0.9 + 0.09], color: GOLD, mat: MAT.gold, outline: false });
        k.add(G.box(0.11, 0.045, 0.03), { bone: "body", pos: [0, p.chest - 0.17, p.torsoR * p.torsoD * 0.9 + 0.09], color: GOLD, mat: MAT.gold, outline: false });
        goldRing(k, "hips", [0, 0.16, 0], hemR * 1.0, 0.035, [Math.PI / 2, 0, 0], [1, p.torsoD * 1.06, 1]);
      }
    },
    animate(a) {
      a.hold("plate", 0, 0, 0, 0);
    },
  };
  function coiffe(k, p, L, s) {
    // petit bonnet de velours brodé à l'arrière de la tête
    k.add(G.dome(p.headR * 1.04, 12, 5, 1.2), { bone: "head", pos: [0, p.headY + 0.01, p.headZ - 0.05], rot: [-0.62, 0, 0], color: 0x1a1822, mat: 1, outline: true });
    k.add(G.torus(p.headR * 0.95, 0.035, 4, 14, Math.PI), { bone: "head", pos: [0, p.headY + 0.08, p.headZ - 0.05], rot: [-0.62 - Math.PI / 2, 0, 0], color: L.embroA, mat: 1, outline: false });
    // la haute coiffe de dentelle, un peu penchée en arrière
    const H = 0.78, y0 = p.headY + 0.28, z0 = p.headZ - 0.12;
    const prof = [[0.001, 0], [0.12, 0], [0.14, H * 0.45], [0.16, H * 0.94], [0.1, H], [0.001, H + 0.004]];
    k.add(G.lathe("coiffe", prof, 10), { bone: "head", pos: [0, y0, z0], rot: [-0.1, 0, 0], scale: [1.35, 1, 0.62], color: 0xfbfbf7, part: PART.lace, pal: PAL.lace, mat: 1, outline: true });
    // lacets de dentelle noués sous le menton
    for (const sd of [1, -1]) k.add(G.tube("lacet" + sd + p.headR, [[sd * 0.16, y0 + 0.02, z0], [sd * (p.headR + 0.02), p.headY - 0.05, p.headZ + 0.05], [sd * 0.2, p.headY - 0.38, p.headZ + 0.26], [0, p.headY - 0.45, p.headZ + 0.3]], 0.025, 5, 3), { bone: "head", color: 0xfbfbf7, mat: 1, outline: false });
    k.add(G.sphere(0.06, 4, 3), { bone: "head", pos: [0, p.headY - 0.45, p.headZ + 0.31], color: 0xfbfbf7, outline: false });
    if (s.champion) goldRing(k, "head", [0, y0 + 0.04, z0], 0.14, 0.022, [Math.PI / 2 - 0.1, 0, 0], [1.35, 0.62, 1]);
    if (s.boss) crown(k, { bone: "head", pos: [0, y0 - 0.02, z0], r: 0.24, h: 0.14, spikes: 6, big: true });
  }
  function crepes(k, hc, L) {
    const [x, y, z] = hc;
    const py = y + 0.1, pz = z + 0.12;
    k.add(G.cyl(0.3, 0.26, 0.04, 10), { pos: [x, py, pz], color: L.plate, mat: L.plate === GOLD ? MAT.gold : 2, outline: true });
    for (let i = 0; i < 4; i++) k.add(G.cyl(0.25 - i * 0.004, 0.25, 0.035, 8), { pos: [x + (i % 2 ? 0.012 : -0.01), py + 0.04 + i * 0.037, pz + (i % 2 ? -0.01 : 0.01)], color: shade(L.crepe, 1 - i * 0.04), mat: 1, outline: i === 3 });
    // crêpe pliée en triangle sur le dessus
    k.add(G.cone(0.2, 0.03, 3), { pos: [x, py + 0.2, pz], rot: [0, 0.4, 0], scale: [1, 1, 1], color: shade(L.crepe, 1.08), mat: 1, outline: false });
  }

  // --- Chasseur camouflé : tenue feuillage (ghillie), casquette orange fluo, jumelles -----------------
  T.chasseur = {
    label: "Chasseur camouflé",
    championLabel: "Chasseur d'élite",
    p: { headR: 0.45, torsoR: 0.36, torsoD: 0.95 },
    look: {
      skin: 0xe8b890, brow: 0x3a2a1a, cheek: null,
      shirt: 0x5c9a34, shirtPart: PART.camo, shirtPal: PAL.dkgreen, sleeve: 1,
      pants: 0x4f8a30, pantsPart: PART.camo, pantsPal: PAL.dkgreen, legStops: [[0, 0x4f7a30], [0.62, 0x6a4a28]], shoe: 0x6a4a28, sole: 0x2a1a0a,
      glove: 0x3a5a22, cap: 0xff6a00, leaves: [0x4a8a24, 0x6aaa34, 0x8a7a30, 0x356a1c],
    },
    champion: { look: { shirt: 0x3f8a2a, shirtPal: PAL.khaki, pants: 0x3a7a26, pantsPal: PAL.khaki, legStops: [[0, 0x3a6a26], [0.62, 0x4a3018]], shoe: 0x4a3018, cap: 0xff5a00, leaves: [0x2f6a1c, 0x5a9a2a, 0x8a7a2a, 0x244a14] } },
    mood: "sneaky",
    motion: { gait: "sneak", arms: ["sneak", "sneak"] },
    carry: { pos: [0, 2.55, 0.05], arms: ["overhead", "overhead"] },
    dims: { w: 1.3, h: 2.4, d: 1.1 },
    height: 2.34,
    props(s) {
      const p = s.p;
      const out = [{ name: "hat", parent: "head", pos: [0, p.headY + 0.3, p.headZ], build: (k, s) => {
        const top = cap(k, s.p, { color: s.look.cap, mat: MAT.fluo, band: s.champion ? GOLD : 0, theta: 1.08 });
        if (s.boss) crown(k, { pos: [0, top - 0.06, s.p.headZ - 0.03], r: 0.3, h: 0.16, big: true });
      } }];
      if (s.boss) out.push(capeProp({ top: p.shY + 0.14, z: -0.24, w0: 0.8, w1: 1.3, len: 1.1, color: 0x3a6a24, lining: 0x5a4a24 }));
      return out;
    },
    build(k, s) {
      const p = s.p, L = s.look;
      body(k, p, L);
      // lanières de feuillage : silhouette hirsute (épaules, dos, bras, hanches)
      const rnd = PTMT.rng(s.champion ? 21 : 11);
      const spots = [];
      for (let i = 0; i < 14; i++) {
        const a = rnd() * TAU, yy = p.waist + 0.05 + rnd() * (p.chest - p.waist);
        spots.push(["body", Math.cos(a) * p.torsoR * 1.05, yy, Math.sin(a) * p.torsoR * p.torsoD * 1.05, a]);
      }
      for (const sd of [1, -1]) {
        spots.push([sd > 0 ? "arm_l" : "arm_r", sd * (p.shX + 0.06), p.shY - 0.05, 0.0, sd > 0 ? 0 : Math.PI]);
        spots.push([sd > 0 ? "fore_l" : "fore_r", sd * p.elX, p.elY - 0.06, 0.05, sd > 0 ? 0 : Math.PI]);
        spots.push(["hips", sd * p.torsoR * 0.95, p.hip, 0.05, sd > 0 ? 0 : Math.PI]);
      }
      spots.forEach((sp, i) => {
        const [bone, x, y, z, a] = sp;
        k.add(G.cone(0.1, 0.34, 4), { bone, pos: [x, y - 0.08, z], rot: [Math.PI + (rnd() - 0.5) * 0.6, a, (rnd() - 0.5) * 0.8], scale: [1, 1, 0.45], color: L.leaves[i % L.leaves.length], mat: 0, outline: i % 3 === 0 });
      });
      // peinture de camouflage sur les joues
      for (const sd of [1, -1]) k.add(G.box(0.14, 0.035, 0.03), { bone: "head", pos: [sd * 0.25, p.headY - 0.1, p.headZ + 0.37], rot: [0, sd * 0.6, sd * 0.35], color: 0x2c4a1c, outline: false });
      // jumelles sur la poitrine et sacoche
      for (const sd of [1, -1]) k.add(G.cyl(0.06, 0.07, 0.18, 6), { bone: "body", pos: [sd * 0.07, p.waist + 0.28, p.torsoR * p.torsoD + 0.07], rot: [Math.PI / 2 - 0.3, 0, 0], color: s.champion ? GOLD : 0x22222a, mat: s.champion ? MAT.gold : 2, outline: true });
      k.add(G.rbox(0.28, 0.24, 0.12, 0.05, 1), { bone: "hips", pos: [-0.36, p.hip - 0.02, 0.1], rot: [0, 0.3, 0.1], color: 0x7a5a30, mat: 1, outline: true });
      if (s.champion) for (let i = 0; i < 3; i++) k.add(G.cyl(0.035, 0.035, 0.02, 6), { bone: "body", pos: [-0.18 + i * 0.07, p.waist + 0.46, p.torsoR * p.torsoD + 0.05], rot: [Math.PI / 2, 0, 0], color: GOLD, mat: MAT.gold, outline: false });
    },
  };

  // --- Rugbyman : maillot à cerceaux, short blanc, casque de mêlée, ballon ovale sous le bras ------
  T.rugbyman = {
    label: "Rugbyman",
    championLabel: "Rugbyman international",
    p: { headR: 0.45, torsoR: 0.41, torsoD: 0.86, shX: 0.36, elX: 0.5, wrX: 0.55, armR: 0.094, legR: 0.105, handR: 0.135, hipX: 0.16, hip: 0.6, knee: 0.36 },
    look: {
      skin: 0xd8946a, brow: 0x2a1a10, browW: 1.15,
      shirt: 0x1f2a5c, shirtPart: PART.hoops, shirtPal: PAL.yellow, sleeve: 0.34,
      pants: 0xf4f4f0, legStops: [[0, 0xf4f4f0], [0.3, 0xd8946a], [0.58, 0xffcf1f], [0.64, 0x1f2a5c]], shoe: 0x18181c, sole: 0xf4f4f0,
      capA: 0x1f2a5c, capB: 0xffcf1f, ball: 0x8a4a22, lace: 0xf4f4f0,
    },
    champion: { look: { shirt: 0x2446b8, shirtPal: PAL.gold, legStops: [[0, 0xf4f4f0], [0.3, 0xd8946a], [0.58, 0xf4f4f0], [0.64, 0xc81e2a]], capA: 0x2446b8, capB: GOLD, lace: GOLD } },
    mood: "fierce",
    motion: { gait: "run", arms: ["tuck", null] },
    carry: { pos: [-0.54, 2.52, 0.08], arms: ["tuck", "carryUp"] },
    dims: { w: 1.35, h: 2.4, d: 1.1 },
    height: 2.28,
    props(s) {
      const p = s.p, hc = handC(p, 1);
      const out = [
        { name: "hat", parent: "head", pos: [0, p.headY + 0.3, p.headZ], build: (k, s) => {
          const top = scrumCap(k, s.p, s.look, s.champion);
          if (s.boss) crown(k, { pos: [0, top - 0.08, s.p.headZ - 0.02], r: 0.3, h: 0.16, big: true });
        } },
        { name: "ball", parent: "hand_l", pos: hc, build: (k, s) => rugbyBall(k, [hc[0] - 0.06, hc[1] + 0.13, hc[2] + 0.02], s.look, s.boss) },
      ];
      if (s.boss) out.push(capeProp({ top: p.shY + 0.14, z: -0.26, w0: 0.84, w1: 1.25, len: 1.1, color: 0x1f2a8c }));
      return out;
    },
    build(k, s) {
      const p = s.p, L = s.look;
      body(k, p, L);
      // col blanc, numéro dans le dos
      k.add(G.torus(p.torsoR * 0.62, 0.045, 4, 14), { bone: "body", pos: [0, p.chest - 0.03, 0], rot: [Math.PI / 2 + 0.1, 0, 0], color: 0xf4f4f0, mat: 1, outline: false });
      k.add(G.rbox(0.22, 0.26, 0.03, 0.02, 1), { bone: "body", pos: [0, p.waist + 0.36, -p.torsoR * p.torsoD - 0.02], color: 0xf4f4f0, outline: false });
      if (s.boss) k.add(G.cyl(p.armR * 1.35, p.armR * 1.35, 0.1, 8, true), { bone: "arm_r", pos: [-p.shX - 0.04, p.shY - 0.1, 0], rot: [0, 0, 0.3], color: GOLD, mat: MAT.gold, outline: false });
    },
    animate(a) {
      a.hold("ball", 0, 0.3, 0, 0.2);
    },
  };
  function scrumCap(k, p, L, gold) {
    const bone = "p_hat", R = p.headR * 1.07;
    k.add(G.dome(R, 12, 4, 1.45), { bone, pos: [0, p.headY + 0.01, p.headZ - 0.02], scale: [1, 0.98, 1.02], color: L.capA, mat: 1, outline: true });
    for (const a of [0, Math.PI / 2]) k.add(G.torus(R * 1.005, 0.03, 3, 10, Math.PI), { bone, pos: [0, p.headY + 0.01, p.headZ - 0.02], rot: [0, a, 0], scale: [1, 0.98, 1.02], color: L.capB, mat: gold ? MAT.gold : 1, outline: false });
    for (const sd of [1, -1]) k.add(G.sphere(0.13, 5, 4), { bone, pos: [sd * (p.headR - 0.02), p.headY - 0.05, p.headZ - 0.02], scale: [0.45, 1, 0.9], color: L.capB, mat: gold ? MAT.gold : 1, outline: true });
    k.add(G.torus(0.3, 0.018, 3, 10, Math.PI), { bone, pos: [0, p.headY - 0.12, p.headZ + 0.04], rot: [0.35, 0, Math.PI], scale: [1.5, 1, 1], color: L.capA, outline: false });
    return p.headY + 0.01 + R * 0.98;
  }
  function rugbyBall(k, c, L, gold) {
    k.add(G.sphere(0.2, 7, 5), { pos: c, scale: [0.72, 0.72, 1.12], rot: [0.2, 0, 0], color: gold ? GOLD : L.ball, mat: gold ? MAT.gold : 1, outline: true });
    k.add(G.box(0.03, 0.02, 0.16), { pos: [c[0], c[1] + 0.14, c[2]], rot: [0.2, 0, 0], color: L.lace, outline: false });
  }

  // --- Sonneur de biniou : chapeau rond à rubans, gilet brodé, biniou rouge ------------------------
  T.sonneur = {
    label: "Sonneur de biniou",
    championLabel: "Sonneur de bagad",
    p: { headR: 0.46, torsoR: 0.35, torsoD: 0.9 },
    look: {
      skin: 0xf0b894, cheek: 0xff6a6a, cheekR: 0.11, brow: 0x3a2414, nose: 0xf09a78,
      shirt: 0xf8f6ee, sleeve: 1, pants: 0x1a1a22, pantsLen: 1, shoe: 0x1a1a1e, sole: 0x0a0a0c,
      hat: 0x18181c, ribbon: 0x2a2440, buckle: 0xd8dde3, vest: 0x1c1c28, trim: 0xff8a1a, button: GOLD,
      bag: 0xc41e2a, bagPal: PAL.dkgreen, wood: 0x4a2a12, ivory: 0xf0e6d0,
    },
    champion: { look: { vest: 0x1c2458, trim: GOLD, ribbon: 0x2446b8, buckle: GOLD, bag: 0x2446b8, bagPal: PAL.gold } },
    mood: "puff",
    motion: { gait: "march", arms: ["bagL", "pipe"] },
    carry: { pos: [-0.54, 2.6, 0.08], arms: ["bagL", "carryUp"] },
    dims: { w: 1.45, h: 2.5, d: 1.2 },
    height: 2.48,
    props(s) {
      const p = s.p;
      const out = [
        { name: "hat", parent: "head", pos: [0, p.headY + 0.3, p.headZ], build: (k, s) => {
          const top = bretonHat(k, s.p, s.look, s.champion);
          if (s.boss) crown(k, { pos: [0, top - 0.04, s.p.headZ - 0.02], r: 0.3, h: 0.16, big: true });
        } },
        { name: "bag", parent: "body", pos: [0.3, 1.02, 0.22], build: (k, s) => biniou(k, s) },
      ];
      if (s.boss) out.push(capeProp({ top: p.shY + 0.14, z: -0.24, w0: 0.74, w1: 1.2, len: 1.14, color: 0x1a1a22 }));
      return out;
    },
    build(k, s) {
      const p = s.p, L = s.look;
      body(k, p, L);
      vest(k, p, L.vest, { open: 0.42, trim: L.trim, trimMat: s.champion ? MAT.gold : 1 });
      for (const sd of [1, -1]) for (let i = 0; i < 3; i++) k.add(G.sphere(0.032, 4, 3), { bone: "body", pos: [sd * 0.2, p.waist + 0.16 + i * 0.12, p.torsoR * p.torsoD + 0.05], color: L.button, mat: MAT.gold, outline: false });
      belt(k, p, 0x18181c, L.buckle, s.champion ? MAT.gold : MAT.metal);
    },
    animate(a, dt, s) {
      // la poche du biniou se gonfle et se vide
      const k = a.gesture === "tune" ? 1.6 : 1;
      const b = a.B.p_bag, br = Math.sin(a.time * 3.2 * k + a.id);
      b.scale.set(1 + 0.07 * br, 1 + 0.04 * br, 1 + 0.07 * br);
    },
  };
  function bretonHat(k, p, L, gold) {
    const bone = "p_hat", y0 = p.headY + 0.29, z = p.headZ - 0.02;
    k.add(G.cyl(0.74, 0.74, 0.035, 16), { bone, pos: [0, y0, z], color: L.hat, mat: 1, outline: true });
    k.add(G.cyl(0.35, 0.4, 0.2, 12), { bone, pos: [0, y0 + 0.11, z], color: L.hat, mat: 1, outline: true });
    k.add(G.cyl(0.405, 0.405, 0.09, 12, true), { bone, pos: [0, y0 + 0.06, z], color: L.ribbon, mat: 1, outline: false });
    k.add(G.rbox(0.16, 0.1, 0.03, 0.012, 1), { bone, pos: [0, y0 + 0.06, z + 0.41], color: L.buckle, mat: gold ? MAT.gold : MAT.metal, outline: false });
    for (const sd of [1, -1]) k.add(G.rbox(0.1, 0.66, 0.025, 0.012, 1), { bone, pos: [sd * 0.1, y0 - 0.3, z - 0.72], rot: [0.08, 0, sd * 0.08], color: L.ribbon, mat: 1, outline: true });
    if (gold) k.add(G.torus(0.735, 0.02, 3, 22), { bone, pos: [0, y0 + 0.02, z], rot: [Math.PI / 2, 0, 0], color: GOLD, mat: MAT.gold, outline: false });
    return y0 + 0.21;
  }
  function biniou(k, s) {
    const p = s.p, L = s.look;
    const c = [0.3, 1.02, 0.22];
    k.add(G.sphere(0.25, 8, 5), { pos: c, scale: [0.85, 0.7, 1.12], rot: [0.3, 0.3, 0], color: L.bag, part: PART.tartan, pal: L.bagPal, mat: 1, outline: true });
    // bourdon par-dessus l'épaule gauche, porte-vent vers la bouche, hautbois (levriad) devant
    const wood = L.wood, iv = L.ivory;
    k.add(G.tube("drone", [[0.36, 1.12, 0.1], [0.42, 1.45, -0.12], [0.46, 1.8, -0.38]], 0.035, 5, 4), { color: wood, mat: 2, outline: true });
    k.add(G.cyl(0.06, 0.05, 0.1, 6), { pos: [0.46, 1.84, -0.4], rot: [-0.6, 0, 0], color: iv, mat: 2, outline: false });
    k.add(G.tube("blow", [[0.24, 1.2, 0.3], [0.14, 1.38, 0.44], [0.04, p.mouthY, p.mouthZ + 0.02]], 0.026, 5, 4), { color: wood, mat: 2, outline: false });
    k.add(G.tube("chanter", [[0.2, 0.92, 0.36], [0.08, 0.78, 0.5], [0.0, 0.62, 0.58]], 0.035, 5, 4), { color: wood, mat: 2, outline: true });
    k.add(G.cyl(0.045, 0.075, 0.1, 6), { pos: [0.0, 0.58, 0.6], rot: [0.5, 0, 0], color: iv, mat: 2, outline: false });
    void c;
  }

  // --- Pompier : casque doré à crête, veste rouge à bandes, lance à incendie enroulée ---------------
  T.pompier = {
    label: "Pompier",
    championLabel: "Pompier chevronné",
    p: Object.assign({}, BIG, { belly: 0.05, torsoR: 0.4, torsoD: 0.92 }),
    look: {
      skin: 0xf0b088, brow: 0x2a1a10, browW: 1.2, shirt: 0xd0282a, shirtMat: 1, sleeve: 1, cuff: 0x2a2a30, glove: 0x2a2a30,
      pants: 0x1e2438, legStops: [[0, 0x1e2438], [0.6, 0x18181c]], shoe: 0x18181c, sole: 0x0a0a0c,
      helmet: GOLD, crest: 0xffd84a, band: 0xd8f040, hose: 0xe8dcc0, nozzle: 0xd8a030, mustache: 0x3a2414,
    },
    champion: { look: { shirt: 0xb81a24, crest: 0xe8243a, nozzle: GOLD } },
    mood: "proud",
    motion: { gait: "heavy", arms: ["hoseL", "nozzle"] },
    carry: { pos: [0.56, 2.62, 0.1], arms: ["carryUp", "nozzle"] },
    dims: { w: 1.4, h: 2.6, d: 1.2 },
    height: 2.52,
    props(s) {
      const p = s.p, hc = handC(p, -1);
      const out = [
        { name: "hat", parent: "head", pos: [0, p.headY + 0.3, p.headZ], build: (k, s) => {
          const top = fireHelmet(k, s.p, s.look);
          if (s.boss) crown(k, { pos: [0, top - 0.1, s.p.headZ - 0.04], r: 0.3, h: 0.16, big: true });
        } },
        { name: "nozzle", parent: "hand_r", pos: hc, build: (k, s) => {
          k.add(G.cyl(0.05, 0.075, 0.34, 6), { pos: [hc[0], hc[1] + 0.12, hc[2] + 0.02], color: s.look.nozzle, mat: s.champion ? MAT.gold : MAT.metal, outline: true });
          k.add(G.cyl(0.07, 0.07, 0.06, 6), { pos: [hc[0], hc[1] - 0.06, hc[2] + 0.02], color: 0x2a2a30, mat: 1, outline: false });
        } },
      ];
      if (s.boss) out.push(capeProp({ top: p.shY + 0.14, z: -0.27, w0: 0.84, w1: 1.3, len: 1.16, color: 0xa81a22 }));
      return out;
    },
    build(k, s) {
      const p = s.p, L = s.look;
      body(k, p, L);
      // basques de la veste (couvrent le haut des cuisses)
      k.add(G.lathe("jacketskirt" + p.torsoR, [[p.torsoR * 1.12, p.hip - 0.12], [p.torsoR * 1.1, p.hip + 0.02], [p.torsoR * 1.06, p.waist + 0.06]], 10), { bone: "hips", scale: [1, 1, p.torsoD + p.belly * 0.5], color: L.shirt, mat: 1, outline: true });
      // bandes réfléchissantes : buste, bas de veste, bras, jambes
      const b = p.belly;
      for (const [bone, y, rr, sz] of [["body", p.waist + 0.3, p.torsoR * 1.07 + b * 0.7, p.torsoD + b * 0.6], ["hips", p.hip - 0.05, p.torsoR * 1.12, p.torsoD + b * 0.5]]) {
        k.add(G.cyl(rr + 0.012, rr + 0.012, 0.09, 12, true), { bone, pos: [0, y, 0], scale: [1, 1, sz], color: L.band, mat: 2, outline: false });
      }
      for (const sd of [1, -1]) {
        k.add(G.cyl(p.armR * 1.18, p.armR * 1.18, 0.07, 6, true), { bone: sd > 0 ? "fore_l" : "fore_r", pos: [sd * (p.elX + (p.wrX - p.elX) * 0.45), p.elY - (p.elY - p.wrY) * 0.45, 0.03], rot: [0, 0, sd * 0.25], color: L.band, mat: 2, outline: false });
        k.add(G.cyl(p.legR * 1.15, p.legR * 1.15, 0.07, 6, true), { bone: sd > 0 ? "shin_l" : "shin_r", pos: [sd * p.hipX, p.knee - 0.06, 0.01], color: L.band, mat: 2, outline: false });
      }
      // tuyau enroulé en bandoulière (épaule gauche → hanche droite) et tuyau vers la lance
      for (let i = 0; i < 2; i++) k.add(G.torus(p.torsoR * 1.16 + i * 0.07, 0.055, 3, 14), { bone: "body", pos: [0.0, p.waist + 0.34, 0.0], rot: [Math.PI / 2, 0, 0.75], order: "ZXY", scale: [1, p.torsoD + p.belly + 0.1, 1], color: L.hose, mat: 1, outline: i === 1 });
      k.add(G.tube("hoseLine" + p.wrX, [[-0.3, p.waist + 0.12, 0.36], [-0.44, p.waist, 0.46], [-(p.wrX + 0.015), p.wrY - 0.2, 0.2]], 0.045, 5, 4), { bone: "body", color: L.hose, mat: 1, outline: false });
      mustache(k, p, L.mustache, 1.3);
      if (s.champion) {
        // galons dorés (chevrons) sur les manches et étoile
        for (const sd of [1, -1]) for (let i = 0; i < 2; i++) k.add(G.torus(0.09, 0.018, 3, 6, Math.PI * 0.6), { bone: sd > 0 ? "arm_l" : "arm_r", pos: [sd * (p.shX + 0.08), p.shY - 0.1 - i * 0.06, 0.08], rot: [0, sd * 0.5, Math.PI * 1.2], color: GOLD, mat: MAT.gold, outline: false });
        k.add(G.shape("star5s", starPts(0.1, 0.045, 5), 0.03), { bone: "body", pos: [0.2, p.waist + 0.44, p.torsoR * p.torsoD + 0.08], rot: [-0.1, 0, 0], color: GOLD, mat: MAT.gold, outline: false });
      }
    },
    animate(a) {
      a.hold("nozzle", 1, 1.2, 0, 0);
    },
  };
  function fireHelmet(k, p, L) {
    const bone = "p_hat", R = p.headR * 1.13;
    const cy = p.headY + 0.02, z = p.headZ - 0.03;
    k.add(G.dome(R, 12, 5, 1.3), { bone, pos: [0, cy, z], scale: [1, 1.02, 1.1], color: L.helmet, mat: MAT.gold, outline: true });
    // couvre-nuque et rebord
    k.add(G.cyl(R * Math.sin(1.3) + 0.02, R * Math.sin(1.3) + 0.1, 0.1, 12, true, 0.6, TAU - 1.2), { bone, pos: [0, cy + R * Math.cos(1.3) - 0.03, z], scale: [1, 1, 1.1], color: L.helmet, mat: MAT.gold, outline: true });
    // crête (cimier)
    k.add(G.shape("crest", [[-0.42, 0], [0.36, 0], [0.3, 0.1], [0.1, 0.17], [-0.2, 0.16], [-0.4, 0.07]], 0.07), { bone, pos: [0, cy + R * 0.96, z], rot: [0, -Math.PI / 2, 0], color: L.crest, mat: MAT.gold, outline: true });
    // visière relevée (verre sombre) et écusson
    k.add(G.band(R * 1.04, 10, 2, Math.PI / 2 - 0.75, 1.5, 0.55, 0.3), { bone, pos: [0, cy, z], scale: [1, 1.02, 1.1], color: 0x2a3a4a, mat: MAT.glass, outline: false });
    k.add(G.cyl(0.08, 0.08, 0.03, 8), { bone, pos: [0, cy + R * 0.62, z + R * 0.84], rot: [Math.PI / 2 - 0.7, 0, 0], color: 0xd0282a, mat: 2, outline: false });
    return cy + R * 1.02 + 0.17;
  }

  // --- Korrigan : lutin breton, grosse tête, chapeau rond à boucle, oreilles pointues, yeux qui brillent --
  // Petit (× 0,82) mais la tête est énorme : vu de haut, le chapeau noir à boucle d'or, les deux longues
  // oreilles tendues de chaque côté et le gilet vert vif le désignent. Il sautille ; à l'arrêt, poings sur
  // les hanches, il nargue. « blink » : il jaillit d'un pouf de fumée violette (12-overlay.js).
  const KORR = {
    headR: 0.56, headY: 1.79, eyeR: 0.155, eyeX: 0.21, eyeY: 1.84, eyeZ: 0.475, browY: 2.03, browZ: 0.515,
    mouthY: 1.57, mouthZ: 0.525, noseY: 1.69, noseZ: 0.585, noseR: 0.115,
    torsoR: 0.31, torsoD: 0.95, shX: 0.27, elX: 0.37, wrX: 0.42, armR: 0.07, legR: 0.085, handR: 0.12, foot: [0.24, 0.15, 0.4],
  };
  T.korrigan = {
    label: "Korrigan",
    championLabel: "Korrigan des menhirs",
    scale: 0.82,
    p: KORR,
    look: {
      skin: 0xc8875a, earIn: 0xa8503e, cheek: 0xd8645a, brow: 0x1e140c, browW: 1.4, browH: 1.6, nose: 0xb46a44,
      glowEyes: 0xffe14a, pointyEars: 0.66,
      shirt: 0xf4efe1, sleeve: 1, pants: 0x1f2a5c, pantsLen: 0.62, socks: 0xf4efe1, shoe: 0xd29a52, sole: 0x7a5228,
      hat: 0x15131a, band: 0x8a2be2, buckle: GOLD, vest: 0x22b23c, trim: 0xffb21a, beard: 0x3a2414,
    },
    champion: { look: { vest: 0x149a30, trim: GOLD, band: GOLD, pants: 0x15131a } },
    hatScale: 1.18,
    mood: "mischief",
    motion: { gait: "skip", arms: ["skip", "skip"], idleArms: ["akimbo", "akimbo"] },
    carry: { pos: [0, 2.85, 0.05], arms: ["overhead", "overhead"] },
    dims: { w: 1.35, h: 2.6, d: 1.1 },
    height: 2.62,
    props(s) {
      const p = s.p;
      const out = [{ name: "hat", parent: "head", pos: [0, p.headY + 0.36, p.headZ], build: (k, s) => {
        const top = korriganHat(k, s.p, s.look, s.champion);
        if (s.boss) crown(k, { pos: [0, top - 0.06, s.p.headZ - 0.03], r: 0.3, h: 0.17, big: true, jewels: [0x8a2be2, 0x3fd06a] });
      } }];
      if (s.boss) out.push(capeProp({ top: p.shY + 0.12, z: -0.22, w0: 0.66, w1: 1.1, len: 1.0, color: 0x5a1a8a }));
      return out;
    },
    build(k, s) {
      const p = s.p, L = s.look;
      body(k, p, L);
      vest(k, p, L.vest, { open: 0.5, trim: L.trim, trimMat: s.champion ? MAT.gold : 1 });
      // boutons dorés et ceinture à boucle
      for (const sd of [1, -1]) for (let i = 0; i < 3; i++) k.add(G.sphere(0.035, 4, 3), { bone: "body", pos: [sd * 0.19, p.waist + 0.15 + i * 0.12, p.torsoR * p.torsoD + 0.05], color: GOLD, mat: MAT.gold, outline: false });
      belt(k, p, 0x2a1a10, GOLD, MAT.gold);
      // barbiche pointue, favoris
      k.add(G.cone(0.13, 0.32, 6), { bone: "head", pos: [0, p.mouthY - 0.2, p.mouthZ - 0.06], rot: [Math.PI + 0.35, 0, 0], scale: [1, 1, 0.7], color: L.beard, mat: 1, outline: true });
      for (const sd of [1, -1]) k.add(G.sphere(0.12, 5, 4), { bone: "head", pos: [sd * (p.headR - 0.06), p.headY - 0.16, p.headZ + 0.12], scale: [0.55, 1.2, 0.8], color: L.beard, mat: 1, outline: false });
      // sabots à bout relevé
      for (const sd of [1, -1]) k.add(G.cone(0.08, 0.2, 5), { bone: sd > 0 ? "foot_l" : "foot_r", pos: [sd * p.hipX, 0.12, p.foot[2] * 0.62], rot: [Math.PI / 2 - 0.5, 0, 0], color: L.shoe, mat: 1, outline: true });
      if (s.champion) {
        // torque d'or et petit trèfle
        k.add(G.torus(p.torsoR * 0.72, 0.04, 3, 10, Math.PI * 1.6), { bone: "body", pos: [0, p.chest - 0.03, 0.02], rot: [Math.PI / 2 + 0.1, 0, Math.PI * 0.2], color: GOLD, mat: MAT.gold, outline: false });
      }
    },
    posing(a, R) {
      // à l'arrêt : il se dandine en narguant ; tête penchée, toujours un peu de travers
      const t = a.time, idle = 1 - a.w.move;
      R(A.BI.body, 0, Math.sin(t * 2.6 + a.id) * 0.18 * idle, Math.sin(t * 5.2 + a.id) * 0.06 * idle);
      R(A.BI.head, 0, 0, 0.14 + Math.sin(t * 1.7 + a.id) * 0.06);
    },
  };
  function korriganHat(k, p, L, gold) {
    const bone = "p_hat", y0 = p.headY + 0.36, z = p.headZ - 0.02;
    k.add(G.cyl(0.6, 0.62, 0.05, 16), { bone, pos: [0, y0, z], color: L.hat, mat: 1, outline: true });
    k.add(G.cyl(0.32, 0.36, 0.3, 12), { bone, pos: [0, y0 + 0.16, z], color: L.hat, mat: 1, outline: true });
    k.add(G.cyl(0.366, 0.366, 0.11, 12, true), { bone, pos: [0, y0 + 0.08, z], color: L.band, mat: gold ? MAT.gold : 2, outline: false });
    // grosse boucle dorée devant (lisible de haut, elle dépasse du bord)
    k.add(G.rbox(0.32, 0.24, 0.05, 0.03, 1), { bone, pos: [0, y0 + 0.11, z + 0.37], rot: [-0.15, 0, 0], color: L.buckle, mat: MAT.gold, outline: true });
    k.add(G.rbox(0.16, 0.11, 0.03, 0.015, 1), { bone, pos: [0, y0 + 0.11, z + 0.39], rot: [-0.15, 0, 0], color: L.hat, mat: 1, outline: false });
    if (gold) k.add(G.torus(0.61, 0.022, 3, 22), { bone, pos: [0, y0 + 0.03, z], rot: [Math.PI / 2, 0, 0], color: GOLD, mat: MAT.gold, outline: false });
    return y0 + 0.31;
  }

  // --- Touriste au flash : bob, chemise hawaïenne, short, chaussettes dans les sandales, appareil photo ---
  // Coup de soleil, ventre rond, nez en l'air : il regarde partout. « flash » : il lève l'appareil vers
  // la tour (cible), un gros éclair blanc part du flash (12-overlay.js) et la tour est éblouie.
  T.touriste = {
    label: "Touriste au flash",
    championLabel: "Chasseur d'images",
    p: { torsoR: 0.38, belly: 0.1, torsoD: 0.92, armR: 0.08, handR: 0.13 },
    look: {
      skin: 0xffad8e, cheek: 0xff5a5a, cheekR: 0.095, nose: 0xff7d6e, brow: 0x6a4a2a, browW: 1.1,
      shirt: 0x14b4c4, shirtPart: PART.flowers, shirtPal: PAL.pink, sleeve: 0.36,
      pants: 0xd8b47a, legStops: [[0, 0xd8b47a], [0.42, 0xffad8e], [0.68, 0xfbfbf7]], shoe: 0x8a5a2a, sole: 0x3a2412,
      bob: 0xff6fae, bobBand: 0xfbfbf7, camera: 0x26262c, lens: 0x121216, strap: 0x7a3a1a, pack: 0xe0302a,
    },
    champion: { look: { shirt: 0x0e98a8, shirtPal: PAL.lemon, bobBand: GOLD, camera: 0x1a1a1e, strap: GOLD, pack: 0x7a2bd8 } },
    mood: "tourist",
    motion: { gait: "stroll", arms: [null, "camera"] },
    carry: { pos: [0.5, 2.5, 0.08], arms: ["carryUp", "camera"] },
    dims: { w: 1.4, h: 2.5, d: 1.2 },
    height: 2.42,
    props(s) {
      const p = s.p, hc = handC(p, -1);
      const out = [
        { name: "hat", parent: "head", pos: [0, p.headY + 0.3, p.headZ], build: (k, s) => {
          const top = bobHat(k, s.p, s.look, s.champion);
          if (s.boss) crown(k, { pos: [0, top - 0.05, s.p.headZ - 0.03], r: 0.28, h: 0.16, big: true });
        } },
        { name: "camera", parent: "hand_r", pos: hc, build: (k, s) => photoCamera(k, hc, s.look, s.champion) },
      ];
      if (s.boss) out.push(capeProp({ top: p.shY + 0.14, z: -0.26, w0: 0.8, w1: 1.25, len: 1.1, color: 0x0e7a88, lining: 0xff4f9a }));
      return out;
    },
    build(k, s) {
      const p = s.p, L = s.look;
      body(k, p, L);
      // courroie de l'appareil autour du cou, banane sur le ventre
      k.add(G.torus(p.torsoR * 0.82, 0.03, 3, 12), { bone: "body", pos: [0, p.chest - 0.12, 0.06], rot: [Math.PI / 2 + 0.55, 0, 0], color: L.strap, mat: 1, outline: false });
      const bz = (p.torsoR * 1.08 + p.belly) * (p.torsoD + p.belly * 0.6);
      k.add(G.rbox(0.42, 0.16, 0.14, 0.06, 2), { bone: "hips", pos: [0, p.waist + 0.04, bz - 0.02], color: L.pack, mat: 2, outline: true });
      k.add(G.box(0.3, 0.025, 0.02), { bone: "hips", pos: [0, p.waist + 0.06, bz + 0.06], color: 0xf2f2f2, mat: MAT.metal, outline: false });
      if (s.champion) {
        // badge de presse doré et petite sacoche
        k.add(G.rbox(0.14, 0.18, 0.03, 0.02, 1), { bone: "body", pos: [0.2, p.waist + 0.42, p.torsoR * p.torsoD + 0.1], rot: [-0.15, 0, 0], color: GOLD, mat: MAT.gold, outline: false });
      }
    },
    posing(a, R) {
      // nez en l'air : il regarde partout (sauf pendant la photo)
      if (a.gesture || a.dead) return;
      const t = a.time;
      R(A.BI.head, -0.18 + Math.sin(t * 0.9 + a.id) * 0.08, Math.sin(t * 0.55 + a.id * 2) * 0.55, 0);
    },
    animate(a) {
      a.hold("camera", 1, 0, 0, 0);
    },
  };
  function bobHat(k, p, L, gold) {
    const bone = "p_hat", y0 = p.headY + 0.28, z = p.headZ - 0.02;
    // calotte arrondie et bord tombant (bob)
    // (profils de tour parcourus de bas en haut, de l'extérieur vers l'intérieur : faces vers le dehors)
    k.add(G.lathe("bobcrown2", [[0.42, 0.0], [0.36, 0.25], [0.2, 0.35], [0.001, 0.36]], 12), { bone, pos: [0, y0, z], color: L.bob, mat: 1, outline: true });
    k.add(G.lathe("bobbrim2", [[0.42, -0.04], [0.68, -0.15], [0.66, -0.12], [0.4, 0.02]], 14), { bone, pos: [0, y0, z], color: L.bob, mat: 1, outline: true });
    k.add(G.cyl(0.425, 0.43, 0.09, 12, true), { bone, pos: [0, y0 + 0.04, z], color: L.bobBand, mat: gold ? MAT.gold : 1, outline: false });
    return y0 + 0.36;
  }
  function photoCamera(k, hc, L, gold) {
    const [x, y, z] = hc;
    const cy = y + 0.12, cz = z + 0.16;
    k.add(G.rbox(0.4, 0.26, 0.18, 0.05, 2), { pos: [x, cy, cz], color: L.camera, mat: 2, outline: true });
    k.add(G.cyl(0.11, 0.12, 0.18, 10), { pos: [x, cy - 0.01, cz + 0.16], rot: [Math.PI / 2, 0, 0], color: gold ? GOLD : 0x3a3a44, mat: gold ? MAT.gold : MAT.metal, outline: true });
    k.add(G.cyl(0.075, 0.075, 0.02, 10), { pos: [x, cy - 0.01, cz + 0.255], rot: [Math.PI / 2, 0, 0], color: 0x2a4a7a, mat: MAT.glass, outline: false });
    // flash : fenêtre blanche qui s'allume (classe « éclair »)
    k.add(G.rbox(0.18, 0.12, 0.12, 0.02, 1), { pos: [x - 0.08, cy + 0.19, cz], color: 0x2a2a30, mat: 2, outline: true });
    k.add(G.box(0.15, 0.08, 0.02), { pos: [x - 0.08, cy + 0.2, cz + 0.065], color: 0xfff8e0, mat: MAT.flash, outline: false });
  }

  // ---------------------------------------------------------------------------------------------
  // Assemblage d'une variante (type + rang)
  // ---------------------------------------------------------------------------------------------
  const STRIP = { look: 1, p: 1, motion: 1, carry: 1, champion: 1, boss: 1, props: 1, build: 1 };
  function over(spec, o) {
    if (!o) return;
    for (const key of Object.keys(o)) if (!STRIP[key]) spec[key] = o[key];
  }
  function bossName(type) {
    const D = PTMT.sim && PTMT.sim.DATA;
    return (D && D.BOSS_NAMES && D.BOSS_NAMES[type]) || (A.BOSS_NAMES && A.BOSS_NAMES[type]) || "Boss";
  }
  A.BOSS_NAMES = {
    fermier: "Le Grand Fermier", quad: "Le Roi du quad", cowboy: "Le Shérif d'Elven", vache: "Le Maire sur sa vache",
    druide: "Le Grand Druide", bigoudene: "La Reine des crêpes", chasseur: "Le Chasseur fantôme", rugbyman: "Le Capitaine",
    sonneur: "Le Penn-Soner", pompier: "Le Capitaine des pompiers", canard: "Le Canard doré",
    cycliste: "Le Maillot jaune", korrigan: "Le Roi des korrigans", touriste: "Le Paparazzi", tracteur: "Le Roi du labour",
    montgolfiere: "Le Baron des nuages",
  };
  // Vitesses (cases/s) de démonstration quand les données du jeu ne connaissent pas encore le type.
  const SPEED = { fermier: 1, quad: 1.6, cowboy: 0.75, vache: 0.7, druide: 1, bigoudene: 1, chasseur: 1.5, rugbyman: 1.5, sonneur: 1, pompier: 0.85, canard: 1.2, cycliste: 1.9, korrigan: 1.2, touriste: 1, tracteur: 0.55, montgolfiere: 0.55 };
  /** Spécification complète d'une variante (rang 0 ordinaire, 1 champion, 2 boss). */
  A.variantSpec = function (type, rank) {
    const base = T[type];
    if (!base) throw new Error("PTMT.actors : type inconnu « " + type + " »");
    const ch = rank >= 1 ? base.champion || {} : null;
    const bo = rank >= 2 ? base.boss || {} : null;
    const spec = {};
    over(spec, base);
    over(spec, ch);
    over(spec, bo);
    spec.type = type;
    spec.rank = rank;
    spec.champion = rank >= 1;
    spec.boss = rank >= 2;
    spec.isElite = spec.champion;
    spec.label = rank >= 2 ? bossName(type) : rank >= 1 ? base.championLabel : base.label;
    const pOver = Object.assign({}, base.p || {}, (ch && ch.p) || {}, (bo && bo.p) || {});
    spec.p = Object.assign({}, STD, pOver);
    const lift = spec.p.hip - STD.hip;
    if (lift) for (const key of ["waist", "chest", "neck", "headY", "shY", "elY", "wrY", "eyeY", "browY", "mouthY", "noseY"]) if (pOver[key] === undefined) spec.p[key] += lift;
    spec.look = Object.assign({}, base.look, (ch && ch.look) || {}, (bo && bo.look) || {});
    spec.motion = Object.assign({}, base.motion, (ch && ch.motion) || {}, (bo && bo.motion) || {});
    spec.carry = Object.assign({}, base.carry, (ch && ch.carry) || {}, (bo && bo.carry) || {});
    spec.carry.pos = spec.carry.pos.slice();
    if (lift) spec.carry.pos[1] += lift;
    spec.skeleton = skeleton(spec.p);
    spec.headC = [0, spec.p.headY, spec.p.headZ];
    spec.headR = spec.p.headR;
    // échelle du gabarit : celle du type × agrandissement d'office (lisibilité vue du dessus)
    spec.scale = (base.scale || 1) * (A.NATIVE || 1);
    if (spec.hatScale === undefined) spec.hatScale = 1.12;
    const D = PTMT.sim && PTMT.sim.DATA;
    const tile = (D && D.TILE) || 3.6;
    spec.natural = D && D.ENEMIES && D.ENEMIES[type] ? D.ENEMIES[type].speed * tile : (SPEED[type] || 1) * tile;
    // os d'accessoires : ceux du type + ancre de la gemme portée (sur le buste, ou sur la monture)
    const props = (typeof base.props === "function" ? base.props(spec) : base.props || []).slice();
    props.push({ name: "gem", parent: spec.carry.parent || "body", pos: spec.carry.pos.slice() });
    spec.propDefs = props;
    spec.builds = [base.build];
    // sommet : + couronne pour le boss ; dimensions des effets à l'échelle du gabarit
    const sc = spec.scale;
    const d = base.dims;
    spec.dims = { w: d.w * sc, h: (d.h + (spec.boss ? 0.3 : 0)) * sc, d: d.d * sc };
    spec.height = ((base.height || d.h) + (spec.boss ? 0.28 : 0)) * sc;
    spec.center = base.center || 1.1;
    if (spec.mood === undefined) spec.mood = "neutral";
    if (base.mount) spec.mount = base.mount;
    return spec;
  };
  A.TYPES = ["fermier", "quad", "cowboy", "vache", "druide", "bigoudene", "chasseur", "rugbyman", "sonneur", "pompier", "canard", "cycliste", "korrigan", "touriste", "tracteur", "montgolfiere"];
  A.typeDefs = T;
})();
