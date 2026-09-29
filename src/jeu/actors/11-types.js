// « Pas touche à mes trésors » — les douze voleurs : proportions chibi, tenues, accessoires, démarches.
//
// Tout est modelé dans l'espace de liaison du personnage (debout, face à +Z, gauche du personnage = +X,
// pieds à y = 0) : grosse tête (≈ 0,9 m de large), corps trapu, bras et jambes « tuyau d'arrosage »
// pondérés entre deux os, moufles et gros souliers. Chaque type a sa couleur dominante et un couvre-chef
// bien visible d'avion (c'est ce qu'on voit d'abord) : bonnet rouge, casserole, bandeau blond, casque
// rose, casquette rouge et matelas rayé, casque de chantier et canapé orange, cagoule violette, charlotte
// rose, bonnet de bain et bouée flamant, tricorne et pédalo, toque géante et tondeuse verte, couronne et
// limousine noire. Les accessoires qui s'animent seuls (sac, casserole, claquettes, matelas, canapé,
// bouée, pédalo, roues) ont leur propre « os d'accessoire » : les masquer revient à les réduire à zéro.
(function () {
  "use strict";
  const PTMT = (globalThis.PTMT = globalThis.PTMT || {});
  const A = (PTMT.actors = PTMT.actors || {});
  const TAU = Math.PI * 2;

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
    sphere: (r, w, h) => gc(`s${r},${w},${h}`, () => new THREE.SphereGeometry(r, w || 12, h || 9)),
    /** Calotte (du pôle nord jusqu'à l'angle polaire theta). */
    dome: (r, w, h, theta) => gc(`d${r},${w},${h},${theta}`, () => new THREE.SphereGeometry(r, w || 16, h || 6, 0, TAU, 0, theta || Math.PI / 2)),
    /** Bande sphérique : secteur phi (autour de Y, 0 = côté -X, PI/2 = avant +Z) et bande polaire theta. */
    band: (r, w, h, p0, pl, t0, tl) => gc(`b${r},${w},${h},${p0},${pl},${t0},${tl}`, () => new THREE.SphereGeometry(r, w, h, p0, pl, t0, tl)),
    cyl: (rt, rb, h, s, open, t0, tl) => gc(`c${rt},${rb},${h},${s},${open},${t0},${tl}`, () => new THREE.CylinderGeometry(rt, rb, h, s || 12, 1, !!open, t0 || 0, tl || TAU)),
    cone: (r, h, s) => gc(`k${r},${h},${s}`, () => new THREE.ConeGeometry(r, h, s || 8)),
    box: (w, h, d) => gc(`x${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d)),
    rbox: (w, h, d, r, s) => gc(`r${w},${h},${d},${r},${s}`, () => PTMT.gfx.roundBox(w, h, d, r, s || 2)),
    torus: (R, r, rs, ts, arc) => gc(`t${R},${r},${rs},${ts},${arc}`, () => new THREE.TorusGeometry(R, r, rs || 6, ts || 16, arc || TAU)),
    lathe: (key, p, s) => gc("l" + key, () => PTMT.gfx.lathe(p, s || 14)),
    tube: (key, pts, r, t, rs) => gc("u" + key, () => PTMT.gfx.tube(pts, r, t || 8, rs || 5)),
    /** Capsule (axe Y, centrée) : longueur droite len + deux bouts de rayon r. */
    capsule: (r, len, seg) =>
      gc(`p${r},${len},${seg}`, () => {
        const pts = [];
        for (let i = 0; i <= 4; i++) { const a = -Math.PI / 2 + (i / 4) * (Math.PI / 2); pts.push([Math.max(1e-4, Math.cos(a) * r), -len / 2 + Math.sin(a) * r]); }
        for (let i = 0; i <= 4; i++) { const a = (i / 4) * (Math.PI / 2); pts.push([Math.max(1e-4, Math.cos(a) * r), len / 2 + Math.sin(a) * r]); }
        return PTMT.gfx.lathe(pts, seg || 8);
      }),
    shape: (key, pts, depth) =>
      gc("e" + key, () => {
        const s = new THREE.Shape();
        pts.forEach((q, i) => (i ? s.lineTo(q[0], q[1]) : s.moveTo(q[0], q[1])));
        s.closePath();
        const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 4 });
        g.translate(0, 0, -depth / 2);
        return g;
      }),
  };
  A.G = G;

  /**
   * Membre « tuyau » le long de points de liaison (courbe lisse), bouts arrondis, couleurs par tronçons
   * nets : stops = [[0, hex], [t, hex], ...]. Couleurs linéaires dans l'attribut color (option colors).
   */
  function limbGeo(key, pts, r0, r1, stops, radial, segs) {
    return gc("m" + key + JSON.stringify(pts) + r0 + "," + r1 + JSON.stringify(stops), () => {
      radial = radial || 8;
      segs = segs || 6;
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
      for (const a of [Math.PI / 2, Math.PI / 4]) rings.push([0, Math.cos(a), -Math.sin(a), stops[0][1]]);
      for (const t of tl) {
        const cut = stops.find((s, j) => j > 0 && Math.abs(s[0] - t) < 1e-6);
        if (cut) { rings.push([t, 1, 0, colorAt(t - 0.01)]); rings.push([t, 1, 0, cut[1]]); }
        else rings.push([t, 1, 0, colorAt(t)]);
      }
      const last = colorAt(1);
      for (const a of [Math.PI / 4, Math.PI / 2]) rings.push([1, Math.cos(a), Math.sin(a), last]);
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

  // ---------------------------------------------------------------------------------------------
  // Corps chibi : tête, visage, torse, bassin, bras, moufles, jambes, souliers
  // ---------------------------------------------------------------------------------------------
  // c = { skin, nose, cheek, brow, iris, shirt, shirtPart (2 = rayé), sleeve (0 débardeur … 1 manches longues),
  //       pants, pantsLen (0.3 short … 1 long), socks, shoe, sole, glove (null = mains nues), barefoot, noEars }
  function body(k, p, c) {
    head(k, p, c);
    torso(k, p, c);
    arms(k, p, c);
    legs(k, p, c);
  }
  function head(k, p, c) {
    const H = [0, p.headY, p.headZ];
    if (!c.noHead) k.add(G.sphere(p.headR, 18, 13), { bone: "head", pos: H, scale: [1, 0.96, 0.97], color: c.headColor || c.skin, mat: 1 });
    if (!c.noEars) for (const s of [1, -1]) k.add(G.sphere(0.085, 8, 6), { bone: "head", pos: [s * (p.headR - 0.02), p.headY - 0.05, p.headZ - 0.02], scale: [0.55, 1, 0.8], color: c.skin, mat: 1, outline: true });
    face(k, p, c);
  }
  function face(k, p, c) {
    for (const s of [1, -1]) {
      const eb = s > 0 ? "eye_l" : "eye_r", bb = s > 0 ? "brow_l" : "brow_r";
      const ex = s * p.eyeX;
      if (!(c.patch && s < 0)) {
        // blanc bombé, pupille, reflet (liés à l'os de l'œil : le regard tourne le globe)
        k.add(G.sphere(p.eyeR, 12, 9), { bone: eb, pos: [ex, p.eyeY, p.eyeZ], scale: [0.9, 1.1, 0.8], color: 0xffffff, part: 4, mat: 2, outline: true });
        k.add(G.sphere(p.eyeR * 0.56, 10, 7), { bone: eb, pos: [ex, p.eyeY - 0.006, p.eyeZ + p.eyeR * 0.55], scale: [1, 1.12, 0.62], color: c.iris || 0x17110d, part: 5, mat: 2, outline: false });
        k.add(G.sphere(p.eyeR * 0.19, 6, 4), { bone: eb, pos: [ex + 0.026, p.eyeY + 0.03, p.eyeZ + p.eyeR * 0.93], color: 0xffffff, part: 4, outline: false });
      }
      k.add(G.capsule(0.032, 0.12, 6), { bone: bb, pos: [ex, p.browY, p.browZ], rot: [0, 0, Math.PI / 2], color: c.brow || 0x2a1a10, mat: 1, outline: false });
      // joues roses
      if (!c.noCheeks) k.add(G.sphere(0.07, 8, 5), { bone: "head", pos: [s * 0.27, p.headY - 0.12, p.headZ + 0.35], scale: [1, 0.7, 0.35], color: c.cheek || 0xff8f8f, outline: false });
    }
    // nez rond et bouche (l'os de la bouche l'ouvre en « O »)
    if (!c.noNose) k.add(G.sphere(p.noseR, 10, 7), { bone: "head", pos: [0, p.noseY, p.noseZ], scale: [1.05, 0.9, 1], color: c.nose || shade(c.skin, 0.93, 1.04), mat: 1, outline: true });
    k.add(G.sphere(1, 10, 6), { bone: "mouth", pos: [0, p.mouthY, p.mouthZ], scale: [0.1, 0.032, 0.04], color: 0x4a0f12, mat: 1, outline: false });
  }
  function torso(k, p, c) {
    const r = p.torsoR, b = p.belly || 0, w = p.waist, ch = p.chest;
    // chemise / pull (os du corps) : l'ourlet recouvre le haut du pantalon
    const prof = [
      [r * 1.02, w - 0.04],
      [r * 1.06 + b * 0.6, w + 0.06],
      [r * 1.08 + b, w + 0.2],
      [r * 1.04 + b * 0.7, w + 0.34],
      [r * 0.93, ch - 0.14],
      [r * 0.72, ch - 0.05],
      [r * 0.38, ch],
      [0.001, ch + 0.02],
    ];
    const key = "torso" + r + "," + b + "," + w + "," + ch;
    k.add(G.lathe(key, prof, 16), { bone: "body", scale: [1, 1, p.torsoD + b * 0.6], color: c.shirt, part: c.shirtPart || 0, mat: c.shirtMat || 0 });
    // bassin (pantalon, os des hanches)
    const pp = [
      [0.001, p.hip - 0.13],
      [r * 0.55, p.hip - 0.11],
      [r * 0.9, p.hip - 0.03],
      [r * 1.0, p.hip + 0.06],
      [r * 0.97, w + 0.05],
      [r * 0.6, w + 0.1],
    ];
    k.add(G.lathe("pelvis" + r + "," + p.hip + "," + w, pp, 16), { bone: "hips", scale: [1, 1, p.torsoD + b * 0.4], color: c.pants, mat: c.pantsMat || 0 });
    // épaules rondes (cachent le départ des bras)
    const sc = c.sleeve > 0.05 ? c.shirt : c.skin;
    for (const s of [1, -1]) k.add(G.sphere(p.armR * 1.5, 10, 7), { bone: "body", pos: [s * p.shX, p.shY + 0.01, 0], color: sc, part: c.sleeve > 0.05 ? c.shirtPart || 0 : 0, outline: false });
  }
  function arms(k, p, c) {
    for (const s of [1, -1]) {
      const side = s > 0 ? "_l" : "_r";
      const a = [s * p.shX, p.shY, 0], e = [s * p.elX, p.elY, 0.02], w = [s * p.wrX, p.wrY, 0.04];
      const stops = c.sleeve >= 0.99 ? [[0, c.shirt]] : c.sleeve > 0.05 ? [[0, c.shirt], [c.sleeve, c.skin]] : [[0, c.skin]];
      if (c.glove && c.gloveCuff) stops.push([0.85, c.glove]);
      k.add(limbGeo("arm" + side, [a, e, w], p.armR * 1.06, p.armR * 0.92, stops, 8, 6), {
        colors: true, part: c.sleeve > 0.05 ? c.shirtPart || 0 : 0, weights: limbWeights(a, e, w, "arm" + side, "fore" + side, 0.07),
      });
      // moufle + pouce
      const hc = c.glove || c.skin;
      const hr = p.handR;
      k.add(G.sphere(hr, 10, 8), { bone: "hand" + side, pos: [w[0] + s * 0.015, w[1] - hr * 0.72, w[2] + 0.02], scale: [0.92, 1.05, 0.86], color: hc, mat: 1 });
      k.add(G.sphere(hr * 0.42, 7, 5), { bone: "hand" + side, pos: [w[0] - s * 0.05, w[1] - hr * 0.5, w[2] + hr * 0.72], color: hc, mat: 1, outline: false });
    }
  }
  function legs(k, p, c) {
    for (const s of [1, -1]) {
      const side = s > 0 ? "_l" : "_r";
      const a = [s * p.hipX, p.hip + 0.04, 0], e = [s * p.hipX, p.knee, 0.015], w = [s * p.hipX, p.ankle + 0.02, 0];
      const lower = c.socks || c.skin;
      const stops = c.pantsLen >= 0.99 ? [[0, c.pants]] : [[0, c.pants], [c.pantsLen, lower]];
      if (c.socks && c.pantsLen < 0.99 && c.sockTop) stops.push([c.sockTop, c.socks2 || c.socks]);
      k.add(limbGeo("leg" + side + p.hip + p.legR, [a, e, w], p.legR * 1.08, p.legR * 0.92, stops, 8, 5), {
        colors: true, weights: limbWeights(a, e, w, "thigh" + side, "shin" + side, 0.08),
      });
      const ft = "foot" + side, f = p.foot;
      if (c.flippers) {
        // palmes jaunes (nageur)
        k.add(G.rbox(f[0] * 0.8, 0.12, f[2] * 0.5, 0.05, 2), { bone: ft, pos: [s * p.hipX, 0.07, 0.0], color: c.flippers, mat: 2 });
        k.add(G.shape("fin", [[-0.16, 0], [0.16, 0], [0.24, 0.42], [0.08, 0.36], [0, 0.44], [-0.08, 0.36], [-0.24, 0.42]], 0.035), {
          bone: ft, pos: [s * p.hipX, 0.02, 0.06], rot: [Math.PI / 2, 0, 0], color: c.flippers, mat: 2,
        });
      } else if (c.barefoot) {
        k.add(G.rbox(f[0] * 0.8, f[1] * 0.7, f[2] * 0.85, 0.05, 2), { bone: ft, pos: [s * p.hipX, f[1] * 0.35, f[2] * 0.15], color: c.skin, mat: 1 });
        for (let i = 0; i < 3; i++) k.add(G.sphere(0.035, 6, 4), { bone: ft, pos: [s * p.hipX + (i - 1) * 0.055, 0.04, f[2] * 0.52], color: c.skin, outline: false });
      } else {
        k.add(G.rbox(f[0], f[1], f[2], 0.07, 2), { bone: ft, pos: [s * p.hipX, f[1] * 0.5 + 0.02, f[2] * 0.18], color: c.shoe, mat: 1 });
        k.add(G.rbox(f[0] + 0.02, 0.05, f[2] + 0.02, 0.02, 1), { bone: ft, pos: [s * p.hipX, 0.025, f[2] * 0.18], color: c.sole || shade(c.shoe, 0.6), mat: 0, outline: false });
      }
    }
  }
  /** Teinte éclaircie / assombrie (sRGB). */
  function shade(hex, f, g) {
    const r = Math.min(255, ((hex >> 16) & 255) * f * (g || 1)), gg = Math.min(255, ((hex >> 8) & 255) * f), b = Math.min(255, (hex & 255) * f);
    return (Math.round(r) << 16) | (Math.round(gg) << 8) | Math.round(b);
  }

  // ---------------------------------------------------------------------------------------------
  // Couvre-chefs et petits accessoires
  // ---------------------------------------------------------------------------------------------
  const HC = (p) => [0, p.headY, p.headZ];
  function beanie(k, p, col, fold, pom) {
    const R = p.headR * 1.045;
    k.add(G.dome(R, 18, 7, 1.02), { bone: "head", pos: HC(p), scale: [1, 1.08, 1], color: col, mat: 0 });
    k.add(G.torus(R * Math.sin(1.02) + 0.015, 0.058, 6, 20), { bone: "head", pos: [0, p.headY + R * 1.08 * Math.cos(1.02) - 0.01, p.headZ], rot: [Math.PI / 2, 0, 0], color: fold, mat: 0 });
    if (pom) k.add(G.sphere(0.12, 10, 8), { bone: "head", pos: [0, p.headY + R * 1.08 + 0.07, p.headZ], color: pom, mat: 0 });
  }
  /** Loup noir de cambrioleur (bande autour des yeux, nœud derrière). */
  function mask(k, p, col) {
    k.add(G.band(p.headR * 1.025, 22, 3, Math.PI / 2 - 1.5, 3.0, 1.26, 0.5), { bone: "head", pos: HC(p), scale: [1, 0.96, 0.97], color: col, mat: 1 });
    for (const s of [1, -1]) k.add(G.rbox(0.07, 0.05, 0.24, 0.02, 1), { bone: "head", pos: [s * 0.06, p.eyeY - 0.02, p.headZ - p.headR - 0.08], rot: [0.5, s * 0.5, s * 0.3], color: col, outline: true });
  }
  function mustache(k, p, col, w) {
    w = w || 1;
    for (const s of [1, -1]) k.add(G.sphere(0.07, 10, 6), { bone: "head", pos: [s * 0.075 * w, p.mouthY + 0.045, p.mouthZ + 0.03], scale: [1.35 * w, 0.55, 0.6], rot: [0, 0, s * 0.3], color: col, mat: 1, outline: true });
  }
  function hairCap(k, p, col, theta) {
    k.add(G.dome(p.headR * 1.03, 18, 7, theta || 1.2), { bone: "head", pos: [0, p.headY + 0.01, p.headZ - 0.02], scale: [1, 1.02, 1], color: col, mat: 1 });
  }

  // ---------------------------------------------------------------------------------------------
  // Définitions des types
  // ---------------------------------------------------------------------------------------------
  // look : couleurs (sRGB) du corps ; p : proportions (écarts à STD) ; scale : taille (1 = 2,15 m sans
  // chapeau) ; motion.natural : vitesse du jeu (m/s) pour ce type ; sack : sac porté ; dims (m, avant
  // échelle) pour les effets (glaçon, filet, ombre) ; height : sommet (barre de vie, avant échelle) ;
  // center : pivot des saltos ; hatH : hauteur du couvre-chef au-dessus du crâne (icônes).
  const T = {};

  // --- Voleur du dimanche : bonnet rouge, loup, pull rayé bleu ----------------------------------
  T.voleur = {
    label: "Voleur du dimanche",
    p: {},
    look: { skin: 0xffc79c, brow: 0x1c1410, shirt: 0x2349b8, shirtPart: 2, sleeve: 1, pants: 0x2b2f40, pantsLen: 1, shoe: 0x70401f, sole: 0xf1e6cf, glove: 0x23232b },
    scale: 0.93,
    motion: { gait: "sneak", natural: 1.8, moveArms: "sneak" },
    sack: { parent: "body", pos: [0, 1.98, -0.06], scale: 1.45, hold: "overhead" },
    dims: { w: 1.3, h: 2.4, d: 1.0 },
    height: 2.38,
    hatH: 0.26,
    center: 1.1,
    build(k, s) {
      body(k, s.p, s.look);
      mask(k, s.p, 0x121216);
      beanie(k, s.p, 0xe8302a, 0xc41f1f, 0xfff3e2);
    },
    eliteLabel: "Voleur à casserole",
    elite: {
      look: { shirt: 0xd8262e, pants: 0x262a3a, glove: 0x23232b },
      scale: 0.99,
      dims: { w: 1.32, h: 2.45, d: 1.0 },
      height: 2.45,
      hatH: 0.3,
      noBuild: true,
      build(k, s) {
        body(k, s.p, s.look);
        mask(k, s.p, 0x121216);
        // crâne chauve : bosse et pansement, visibles quand la casserole s'envole
        k.add(G.sphere(0.11, 10, 7), { bone: "head", pos: [0.08, s.p.headY + 0.4, s.p.headZ + 0.1], color: 0xff9f8a, mat: 1, outline: true });
        k.add(G.box(0.2, 0.012, 0.06), { bone: "head", pos: [-0.12, s.p.headY + 0.42, s.p.headZ + 0.05], rot: [0.2, 0.3, 0.7], color: 0xf2d2a8, outline: false });
        k.add(G.box(0.2, 0.012, 0.06), { bone: "head", pos: [-0.12, s.p.headY + 0.42, s.p.headZ + 0.05], rot: [0.2, -0.4, -0.5], color: 0xf2d2a8, outline: false });
        // foulard jaune noué
        k.add(G.torus(0.3, 0.07, 6, 18), { bone: "body", pos: [0, s.p.chest - 0.03, 0.0], rot: [Math.PI / 2 + 0.15, 0, 0], scale: [1, 0.9, 1], color: 0xffcf1f, mat: 1 });
        k.add(G.cone(0.12, 0.26, 6), { bone: "body", pos: [0.08, s.p.chest - 0.14, 0.28], rot: [Math.PI + 0.3, 0, 0.35], scale: [1.2, 1, 0.5], color: 0xffcf1f, mat: 1 });
      },
      props: [
        {
          name: "helmet", parent: "head", pos: [0, 2.01, 0.02],
          build(k, s) {
            // casserole renversée, bosselée, et son long manche
            const p = s.p, y = p.headY + 0.33;
            k.add(G.cyl(0.5, 0.53, 0.3, 20, true), { pos: [0, y, p.headZ], rot: [-0.08, 0, 0.1], color: 0xc9d4de, mat: 3 });
            k.add(G.cyl(0.5, 0.5, 0.02, 20), { pos: [0, y + 0.15, p.headZ - 0.01], rot: [-0.08, 0, 0.1], color: 0xb5c1cc, mat: 3, outline: false });
            k.add(G.torus(0.53, 0.035, 5, 22), { pos: [0, y - 0.15, p.headZ + 0.012], rot: [Math.PI / 2 - 0.08, 0, 0.1], color: 0xe6edf3, mat: 3 });
            k.add(G.rbox(0.62, 0.07, 0.1, 0.03, 1), { pos: [-0.8, y - 0.02, p.headZ + 0.05], rot: [0, 0.18, -0.1], color: 0x24242a, mat: 2 });
            k.add(G.torus(0.05, 0.018, 4, 10), { pos: [-1.1, y - 0.02, p.headZ + 0.1], rot: [Math.PI / 2, 0, 0], color: 0x24242a, mat: 2, outline: true });
          },
        },
      ],
      sack: { parent: "body", pos: [0, 2.22, -0.06], scale: 1.45, hold: "overhead" },
    },
  };

  // --- Sprinteur en claquettes : débardeur jaune, short rouge, bandeau, claquettes ------------------
  T.sprinteur = {
    label: "Sprinteur en claquettes",
    p: { hip: 0.62, knee: 0.37, torsoR: 0.3, torsoD: 0.84 },
    look: { skin: 0xe9a877, brow: 0x7a5418, shirt: 0xffd21a, sleeve: 0, pants: 0xe8322a, pantsLen: 0.42, barefoot: true },
    scale: 0.92,
    motion: { gait: "run", natural: 2.9 },
    sack: { parent: "body", pos: [-0.5, 2.0, 0.02], scale: 1.3, hold: "carryR" },
    dims: { w: 1.25, h: 2.35, d: 1.0 },
    height: 2.32,
    hatH: 0.08,
    center: 1.15,
    build(k, s) {
      const p = s.p;
      body(k, p, s.look);
      // cheveux blonds, queue de cheval, bandeau éponge rouge
      hairCap(k, p, 0xf6c440, 1.25);
      k.add(G.sphere(0.13, 10, 8), { bone: "head", pos: [0, p.headY + 0.22, p.headZ - 0.48], color: 0xf6c440, mat: 1 });
      k.add(G.cone(0.13, 0.42, 8), { bone: "head", pos: [0, p.headY + 0.05, p.headZ - 0.62], rot: [-2.5, 0, 0], color: 0xf6c440, mat: 1 });
      k.add(G.torus(p.headR * 1.02, 0.06, 6, 22), { bone: "head", pos: [0, p.headY + 0.25, p.headZ], rot: [Math.PI / 2 - 0.25, 0, 0], scale: [1, 1.02, 1], color: 0xe8322a, mat: 0 });
      // dossard
      k.add(G.rbox(0.3, 0.24, 0.03, 0.01, 1), { bone: "body", pos: [0, p.waist + 0.3, p.torsoR * p.torsoD + 0.04], rot: [-0.12, 0, 0], color: 0xffffff, outline: false });
      k.add(G.box(0.05, 0.15, 0.012), { bone: "body", pos: [0.03, p.waist + 0.3, p.torsoR * p.torsoD + 0.058], rot: [-0.12, 0, 0], color: 0x1a1a1a, outline: false });
      k.add(G.box(0.1, 0.04, 0.012), { bone: "body", pos: [-0.01, p.waist + 0.36, p.torsoR * p.torsoD + 0.058], rot: [-0.12, 0, 0.5], color: 0x1a1a1a, outline: false });
      // poignets éponge
      for (const sd of [1, -1]) k.add(G.torus(0.08, 0.035, 5, 10), { bone: sd > 0 ? "fore_l" : "fore_r", pos: [sd * p.wrX, p.wrY + 0.06, 0.04], rot: [Math.PI / 2, 0, 0], color: 0xe8322a, outline: false });
    },
    props: [
      { name: "flip_l", parent: "foot_l", pos: [0.15, 0.02, 0.2], build: (k, s) => flipflop(k, s.p.hipX, 0x19c2d9, 0xff4f9a) },
      { name: "flip_r", parent: "foot_r", pos: [-0.15, 0.02, 0.2], build: (k, s) => flipflop(k, -s.p.hipX, 0x19c2d9, 0xff4f9a) },
    ],
    eliteLabel: "Patineur du dimanche",
    elite: {
      look: { shirt: 0x9b4dff, pants: 0x1fc9b4, pantsLen: 0.45 },
      motion: { gait: "skate", natural: 2.9, skate: 1 },
      scale: 0.97,
      height: 2.38,
      hatH: 0.14,
      noProps: ["flip_l", "flip_r"],
      noBuild: true,
      build(k, s) {
        const p = s.p;
        body(k, p, Object.assign({}, s.look, { barefoot: false, shoe: 0xf7f3ea, sole: 0xf7f3ea }));
        hairCap(k, p, 0x7a3b1c, 1.3);
        // casque de vélo rose à aérations
        k.add(G.dome(p.headR * 1.1, 16, 6, 1.15), { bone: "head", pos: [0, p.headY + 0.02, p.headZ - 0.02], scale: [1, 0.95, 1.08], color: 0xff5fa2, mat: 2 });
        for (const x of [-0.14, 0, 0.14]) k.add(G.box(0.05, 0.03, 0.5), { bone: "head", pos: [x, p.headY + 0.49, p.headZ - 0.02], color: 0xffffff, outline: false });
        k.add(G.torus(0.2, 0.012, 4, 12, Math.PI), { bone: "head", pos: [0, p.headY - 0.28, p.headZ + 0.05], rot: [0, 0, Math.PI], scale: [1.9, 1, 1.4], color: 0x2a2a30, outline: false });
        // genouillères et coudières
        for (const sd of [1, -1]) {
          k.add(G.sphere(0.12, 10, 7), { bone: sd > 0 ? "shin_l" : "shin_r", pos: [sd * p.hipX, p.knee + 0.02, 0.07], scale: [1, 1.1, 0.8], color: 0x2a2a30, mat: 2 });
          k.add(G.sphere(0.08, 8, 5), { bone: sd > 0 ? "shin_l" : "shin_r", pos: [sd * p.hipX, p.knee + 0.02, 0.15], scale: [1, 1, 0.5], color: 0xff5fa2, mat: 2, outline: false });
          k.add(G.cyl(0.095, 0.095, 0.12, 10), { bone: sd > 0 ? "fore_l" : "fore_r", pos: [sd * p.elX, p.elY - 0.02, 0.02], color: 0x2a2a30, mat: 2 });
          // patins à roulettes (bottines blanches, roues jaunes)
          const ft = sd > 0 ? "foot_l" : "foot_r";
          k.add(G.rbox(0.24, 0.3, 0.36, 0.08, 2), { bone: ft, pos: [sd * p.hipX, 0.22, 0.05], color: 0xf7f3ea, mat: 1 });
          k.add(G.rbox(0.26, 0.05, 0.42, 0.02, 1), { bone: ft, pos: [sd * p.hipX, 0.05, 0.05], color: 0xff5fa2, outline: false });
          for (const z of [-0.12, 0.2]) k.add(G.cyl(0.07, 0.07, 0.2, 10), { bone: ft, pos: [sd * p.hipX, 0.0, z], rot: [0, 0, Math.PI / 2], color: 0xffd21f, mat: 2 });
        }
      },
      sack: { parent: "body", pos: [-0.5, 2.0, 0.02], scale: 1.3, hold: "carryR" },
    },
  };
  function flipflop(k, x, sole, strap) {
    k.add(G.rbox(0.24, 0.05, 0.46, 0.02, 1), { pos: [x, 0.0, 0.07], color: sole, mat: 1 });
    k.add(G.tube("flip" + x, [[x - 0.09, 0.03, 0.02], [x - 0.04, 0.12, 0.12], [x, 0.05, 0.2]], 0.018, 6, 4), { color: strap, outline: false });
    k.add(G.tube("flop" + x, [[x + 0.09, 0.03, 0.02], [x + 0.04, 0.12, 0.12], [x, 0.05, 0.2]], 0.018, 6, 4), { color: strap, outline: false });
  }

  // --- Déménageur en matelas : costaud, salopette bleue, casquette rouge, matelas rayé sur le dos --
  const MOVER = { headR: 0.45, torsoR: 0.45, torsoD: 0.86, belly: 0.03, shX: 0.4, shY: 1.1, elX: 0.6, elY: 0.84, wrX: 0.66, wrY: 0.62, armR: 0.1, legR: 0.12, handR: 0.16, hipX: 0.19, foot: [0.3, 0.19, 0.44] };
  T.demenageur = {
    label: "Déménageur en matelas",
    p: MOVER,
    look: { skin: 0xd99a70, brow: 0x3a2418, shirt: 0xf6f3ea, sleeve: 0.42, pants: 0x2f63c0, pantsLen: 1, shoe: 0x6b4426, sole: 0x2a1c12, glove: 0xf0bf45 },
    mood: "sad",
    scale: 1.04,
    motion: { gait: "heavy", natural: 1.17, moveArms: "mattress", idleArms: "mattress" },
    sack: { parent: "p_mattress", pos: [0.05, 2.46, -0.1], scale: 1.35, hold: "mattress" },
    dims: { w: 1.45, h: 2.55, d: 1.36 },
    height: 2.53,
    hatH: 0.42,
    center: 1.15,
    build(k, s) {
      const p = s.p;
      body(k, p, s.look);
      overalls(k, p, s.look.pants);
      mustache(k, p, 0x3a2418, 1.2);
      // casquette rouge à visière
      k.add(G.dome(p.headR * 1.05, 16, 6, 1.1), { bone: "head", pos: [0, p.headY + 0.01, p.headZ - 0.01], scale: [1, 0.9, 1.02], color: 0xe0302a, mat: 0 });
      k.add(G.cyl(0.3, 0.3, 0.03, 14), { bone: "head", pos: [0, p.headY + 0.21, p.headZ + 0.4], rot: [0.12, 0, 0], scale: [1, 1, 0.8], color: 0xb8211e, mat: 0 });
      k.add(G.sphere(0.04, 6, 4), { bone: "head", pos: [0, p.headY + 0.47, p.headZ], color: 0xb8211e, outline: false });
    },
    props: [
      {
        // matelas rayé posé à plat sur la tête (bien visible d'avion), tenu à bout de bras
        name: "mattress", parent: "body", pos: [0, 2.34, -0.05],
        build(k) {
          k.add(G.rbox(1.5, 0.27, 2.1, 0.12, 2), { pos: [0, 2.35, -0.05], rot: [0.06, 0, -0.04], color: 0x2f5fc0, part: 3, mat: 1 });
          // capitons sur le dessus
          for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) {
            const x = -0.45 + i * 0.45, z = -0.72 + j * 0.45;
            k.add(G.sphere(0.045, 6, 4), { pos: [x, 2.48 + z * -0.06 + x * -0.04, z - 0.05], scale: [1, 0.45, 1], color: 0x1d3f8a, outline: false });
          }
        },
      },
    ],
    eliteLabel: "Forteresse canapé",
    elite: {
      look: { shirt: 0xffe0b0, pants: 0x7d3fb0, glove: 0x6fd13a },
      scale: 1.12,
      motion: { gait: "heavy", natural: 1.17, moveArms: "shield", idleArms: "shield" },
      sack: { parent: "body", pos: [0, 2.08, -0.1], scale: 1.4, hold: "shield" },
      noProps: ["mattress"],
      dims: { w: 2.15, h: 2.4, d: 1.7 },
      height: 2.43,
      hatH: 0.16,
      noBuild: true,
      build(k, s) {
        const p = s.p;
        body(k, p, s.look);
        overalls(k, p, s.look.pants);
        mustache(k, p, 0x3a2418, 1.2);
        // casque de chantier jaune
        k.add(G.dome(p.headR * 1.1, 16, 6, 1.2), { bone: "head", pos: [0, p.headY + 0.01, p.headZ - 0.01], scale: [1, 0.95, 1.05], color: 0xffc21a, mat: 2 });
        k.add(G.cyl(0.54, 0.56, 0.04, 18), { bone: "head", pos: [0, p.headY + 0.17, p.headZ + 0.06], rot: [0.08, 0, 0], scale: [0.98, 1, 1.12], color: 0xf2b20e, mat: 2 });
        k.add(G.rbox(0.07, 0.06, 0.8, 0.02, 1), { bone: "head", pos: [0, p.headY + 0.5, p.headZ - 0.02], color: 0xf2b20e, mat: 2, outline: false });
      },
      props: [
        {
          name: "sofa", parent: "body", pos: [0, 1.0, 0.72],
          build(k) {
            const c = 0xf08c24, d = 0xc8681a, cu = 0xffb347;
            // dossier tourné vers l'avant (bouclier), assise, accoudoirs, coussins, pieds
            const y = -0.04;
            k.add(G.rbox(2.1, 0.3, 0.86, 0.09, 2), { pos: [0, 0.78 + y, 0.66], color: c, mat: 1 });
            k.add(G.rbox(2.1, 0.8, 0.3, 0.12, 2), { pos: [0, 1.22 + y, 1.02], rot: [-0.08, 0, 0], color: c, mat: 1 });
            for (const sx of [-1, 1]) {
              k.add(G.rbox(0.28, 0.55, 0.9, 0.1, 2), { pos: [sx * 1.0, 1.0 + y, 0.68], color: d, mat: 1 });
              k.add(G.rbox(0.86, 0.16, 0.66, 0.07, 2), { pos: [sx * 0.44, 0.98 + y, 0.62], color: cu, mat: 1 });
              k.add(G.rbox(0.8, 0.42, 0.16, 0.07, 2), { pos: [sx * 0.44, 1.26 + y, 0.86], rot: [-0.1, 0, 0], color: cu, mat: 1 });
              for (const z of [0.3, 1.02]) k.add(G.cone(0.06, 0.16, 6), { pos: [sx * 0.9, 0.58 + y, z], rot: [Math.PI, 0, 0], color: 0x5a3a22, outline: false });
            }
          },
        },
      ],
    },
  };
  function overalls(k, p, col) {
    const z = p.torsoR * p.torsoD;
    k.add(G.rbox(0.44, 0.34, 0.08, 0.035, 1), { bone: "body", pos: [0, p.waist + 0.3, z + 0.02], rot: [-0.08, 0, 0], color: col, mat: 0 });
    k.add(G.rbox(0.16, 0.08, 0.03, 0.012, 1), { bone: "body", pos: [0, p.waist + 0.32, z + 0.07], rot: [-0.08, 0, 0], color: shade(col, 0.75), outline: false });
    for (const s of [1, -1]) {
      k.add(G.tube("strap" + s + p.torsoR, [[s * 0.17, p.waist + 0.44, z + 0.02], [s * 0.2, p.chest - 0.02, 0.2], [s * 0.2, p.chest, -0.1], [s * 0.17, p.waist + 0.4, -z - 0.02]], 0.03, 8, 4), { bone: "body", color: col, outline: false });
      k.add(G.cyl(0.035, 0.035, 0.02, 8), { bone: "body", pos: [s * 0.17, p.waist + 0.44, z + 0.07], rot: [Math.PI / 2, 0, 0], color: 0xe8c45a, mat: 3, outline: false });
    }
  }

  // --- Voleur au fumigène : ninja violet, bandeau rouge, ceinture de fumigènes -----------------
  T.fumigene = {
    label: "Voleur au fumigène",
    p: {},
    look: { skin: 0xf3cba8, brow: 0x1a1026, shirt: 0x6b3fd0, sleeve: 1, pants: 0x5a34b4, pantsLen: 1, shoe: 0x2a1d4a, sole: 0x3c2c66, glove: 0x2a1d4a, headColor: 0x6b3fd0, noEars: true, noCheeks: true, noNose: true },
    scale: 0.93,
    motion: { gait: "jog", natural: 1.98, moveArms: "naruto" },
    sack: { parent: "body", pos: [0, 1.98, -0.06], scale: 1.45, hold: "overhead" },
    dims: { w: 1.3, h: 2.35, d: 1.0 },
    height: 2.3,
    hatH: 0.08,
    center: 1.1,
    build(k, s) {
      const p = s.p;
      body(k, p, s.look);
      // fente de la cagoule : bande de peau autour des yeux
      k.add(G.band(p.headR * 1.012, 20, 3, Math.PI / 2 - 1.05, 2.1, 1.12, 0.6), { bone: "head", pos: HC(p), scale: [1, 0.96, 0.97], color: s.look.skin, mat: 1 });
      // bandeau rouge et ses pans flottants
      k.add(G.torus(p.headR * 1.0, 0.055, 6, 22), { bone: "head", pos: [0, p.headY + 0.2, p.headZ], rot: [Math.PI / 2, 0, 0], color: 0xe8243a, mat: 0 });
      k.add(G.tube("tailA", [[0.04, p.headY + 0.18, p.headZ - 0.44], [0.12, p.headY + 0.1, p.headZ - 0.7], [0.2, p.headY + 0.0, p.headZ - 0.95]], 0.04, 6, 4), { bone: "head", color: 0xe8243a, outline: true });
      k.add(G.tube("tailB", [[-0.04, p.headY + 0.18, p.headZ - 0.44], [-0.1, p.headY + 0.04, p.headZ - 0.66], [-0.14, p.headY - 0.12, p.headZ - 0.86]], 0.04, 6, 4), { bone: "head", color: 0xe8243a, outline: true });
      // ceinture de fumigènes
      k.add(G.torus(p.torsoR * 1.02, 0.045, 5, 18), { bone: "hips", pos: [0, p.waist + 0.02, 0], rot: [Math.PI / 2, 0, 0], scale: [1, p.torsoD + 0.04, 1], color: 0x6a4424, mat: 1 });
      const bombs = [[0.3, 0.14], [0.12, 0.3], [-0.12, 0.3], [-0.3, 0.14]];
      for (const b of bombs) {
        k.add(G.sphere(0.085, 9, 7), { bone: "hips", pos: [b[0], p.waist - 0.02, b[1]], color: 0x2c2c33, mat: 2, outline: true });
        k.add(G.sphere(0.028, 5, 4), { bone: "hips", pos: [b[0], p.waist + 0.09, b[1]], color: 0xff9a1f, mat: 4, outline: false });
      }
    },
    eliteLabel: "Ninja au rideau de douche",
    elite: {
      look: { shirt: 0x1f9aa8, pants: 0x177d8a, shoe: 0x0f4a52, sole: 0x1f6f78, glove: 0x0f4a52, headColor: 0x1f9aa8 },
      cape: { w: 1.0, len: 1.2, top: 1.25, z: -0.34 },
      scale: 0.98,
      height: 2.33,
      hatH: 0.14,
      build(k, s) {
        const p = s.p;
        // charlotte de douche rose à froufrous
        k.add(G.dome(p.headR * 1.1, 16, 6, 1.05), { bone: "head", pos: [0, p.headY + 0.02, p.headZ], scale: [1, 1.05, 1], color: 0xff94c8, mat: 2 });
        k.add(G.torus(p.headR * 1.1 * Math.sin(1.05) + 0.02, 0.06, 6, 24), { bone: "head", pos: [0, p.headY + 0.02 + p.headR * 1.15 * Math.cos(1.05), p.headZ], rot: [Math.PI / 2, 0, 0], color: 0xffe6f2, mat: 1 });
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * TAU;
          k.add(G.sphere(0.035, 5, 4), { bone: "head", pos: [Math.cos(a) * 0.22, p.headY + 0.47, p.headZ + Math.sin(a) * 0.22], color: 0xffffff, outline: false });
        }
        // canard en caoutchouc à la ceinture
        k.add(G.sphere(0.1, 9, 7), { bone: "hips", pos: [0.26, p.waist - 0.02, 0.26], scale: [1, 0.8, 1.2], color: 0xffd21f, mat: 2, outline: true });
        k.add(G.sphere(0.065, 8, 6), { bone: "hips", pos: [0.26, p.waist + 0.1, 0.33], color: 0xffd21f, mat: 2, outline: false });
        k.add(G.cone(0.03, 0.07, 6), { bone: "hips", pos: [0.26, p.waist + 0.09, 0.41], rot: [Math.PI / 2, 0, 0], color: 0xff7a1a, outline: false });
      },
    },
  };

  // --- Nageur en flamant rose : bonnet de bain à pois, ventre rond, bouée flamant, palmes -------
  T.nageur = {
    label: "Nageur en flamant rose",
    p: { torsoR: 0.37, belly: 0.09, torsoD: 0.92, shX: 0.33, elX: 0.52, wrX: 0.58 },
    look: { skin: 0xffbea4, brow: 0x5a3a24, shirt: 0xffbea4, sleeve: 0, pants: 0x12b6c6, pantsLen: 0.34, flippers: 0xffd21f, nose: 0xffffff, cheek: 0xff7070 },
    mood: "sad",
    scale: 0.96,
    motion: { gait: "waddle", natural: 1.62, moveArms: "waist", idleArms: "waist", swims: 1 },
    sack: { parent: "p_float", pos: [-0.6, 0.84, 0.12], scale: 1.2, hold: "waist" },
    swimY: -0.36,
    dims: { w: 1.5, h: 2.3, d: 1.5 },
    height: 2.28,
    hatH: 0.08,
    center: 1.05,
    build(k, s) {
      const p = s.p;
      body(k, p, s.look);
      // nombril
      k.add(G.sphere(0.025, 5, 4), { bone: "body", pos: [0, p.waist + 0.16, (p.torsoR + p.belly) * (p.torsoD + p.belly * 0.6) + 0.02], color: 0xb8664e, outline: false });
      // bonnet de bain blanc à pois roses + lunettes relevées
      k.add(G.dome(p.headR * 1.05, 18, 7, 1.12), { bone: "head", pos: [0, p.headY + 0.01, p.headZ - 0.01], scale: [1, 1.04, 1], color: 0xffffff, mat: 2 });
      const dots = [[0, 0.45, 0.1], [0.28, 0.35, 0.18], [-0.28, 0.35, 0.18], [0.2, 0.3, -0.3], [-0.2, 0.3, -0.3], [0.38, 0.18, -0.1], [-0.38, 0.18, -0.1], [0, 0.34, -0.33]];
      for (const d of dots) {
        const l = Math.hypot(d[0], d[1], d[2]);
        const r = p.headR * 1.055;
        k.add(G.sphere(0.06, 8, 5), { bone: "head", pos: [(d[0] / l) * r, p.headY + 0.01 + (d[1] / l) * r * 1.04, p.headZ - 0.01 + (d[2] / l) * r], scale: [1, 1, 0.35], quat: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(d[0], d[1], d[2]).normalize()), color: 0xff4f9a, outline: false });
      }
      k.add(G.torus(p.headR * 1.04, 0.02, 4, 22), { bone: "head", pos: [0, p.headY + 0.22, p.headZ], rot: [Math.PI / 2 - 0.35, 0, 0], color: 0x1a6bd8, outline: false });
      for (const sd of [1, -1]) k.add(G.cyl(0.08, 0.08, 0.05, 12), { bone: "head", pos: [sd * 0.14, p.headY + 0.34, p.headZ + 0.34], rot: [Math.PI / 2 - 0.75, 0, 0], color: 0x37b6ff, mat: 2, outline: true });
    },
    props: [
      {
        name: "float", parent: "root", pos: [0, 0.74, 0],
        build(k) {
          const pink = 0xff6fae;
          k.add(G.torus(0.64, 0.17, 8, 22), { pos: [0, 0.74, 0], rot: [Math.PI / 2, 0, 0], color: pink, mat: 2 });
          k.add(G.torus(0.64, 0.05, 4, 22), { pos: [0, 0.87, 0], rot: [Math.PI / 2, 0, 0], color: 0xffd1e6, mat: 2, outline: false });
          // cou, tête et bec du flamant
          k.add(G.tube("flamingo", [[0.22, 0.82, 0.66], [0.3, 1.08, 0.86], [0.34, 1.32, 0.8], [0.36, 1.46, 0.66], [0.38, 1.58, 0.72]], 0.07, 12, 6), { color: pink, mat: 2, outline: true });
          k.add(G.sphere(0.14, 10, 8), { pos: [0.38, 1.62, 0.76], scale: [0.9, 0.95, 1.1], color: pink, mat: 2 });
          k.add(G.cone(0.06, 0.2, 8), { pos: [0.38, 1.56, 0.93], rot: [Math.PI / 2 + 0.9, 0, 0], color: 0xfff6ea, mat: 2, outline: true });
          k.add(G.cone(0.04, 0.09, 8), { pos: [0.38, 1.49, 1.0], rot: [Math.PI / 2 + 1.1, 0, 0], color: 0x151515, mat: 2, outline: false });
          for (const sx of [-1, 1]) {
            k.add(G.sphere(0.035, 6, 5), { pos: [0.38 + sx * 0.1, 1.66, 0.82], color: 0xffffff, outline: false });
            k.add(G.sphere(0.018, 5, 4), { pos: [0.38 + sx * 0.12, 1.66, 0.85], color: 0x151515, outline: false });
          }
          // queue
          k.add(G.cone(0.14, 0.3, 6), { pos: [0, 0.9, -0.74], rot: [-1.2, 0, 0], scale: [1, 1, 0.5], color: pink, mat: 2 });
        },
      },
    ],
    eliteLabel: "Pirate en pédalo",
    elite: {
      p: { torsoR: 0.36, belly: 0.05, torsoD: 0.9, shX: 0.32, elX: 0.48, wrX: 0.54 },
      look: { skin: 0xe0a57e, brow: 0x1a120c, shirt: 0xd4262a, shirtPart: 2, sleeve: 0.55, pants: 0x2a2a36, pantsLen: 1, shoe: 0x2a1c14, sole: 0x140e0a, flippers: null, nose: 0xd98a68, patch: true, cheek: 0xff8a70 },
      mood: null,
      scale: 1.04,
      motion: { gait: "heavy", natural: 1.3, moveArms: "boatUp", idleArms: "boatUp", swims: 1, boat: 1 },
      sack: { parent: "p_boat", pos: [0, 0.6, -0.95], scale: 1.2, hold: "boatUp" },
      noProps: ["float"],
      boatY: -0.05,
      boat: { landY: 0.84, landZ: 0.12, waterY: 0.54 },
      boatSeat: { dy: 0.22, dz: -0.3 },
      dims: { w: 1.7, h: 2.5, d: 2.5 },
      height: 2.6,
      hatH: 0.4,
      noBuild: true,
      build(k, s) {
        const p = s.p;
        body(k, p, s.look);
        // tricorne noir galonné, tête de mort
        k.add(G.cyl(0.62, 0.62, 0.05, 3), { bone: "head", pos: [0, p.headY + 0.36, p.headZ - 0.02], rot: [0, Math.PI, 0], color: 0x1b1b20, mat: 1 });
        k.add(G.dome(p.headR * 0.95, 14, 6, Math.PI / 2), { bone: "head", pos: [0, p.headY + 0.3, p.headZ - 0.02], scale: [1, 0.72, 1], color: 0x1b1b20, mat: 1 });
        k.add(G.torus(0.6, 0.022, 4, 3), { bone: "head", pos: [0, p.headY + 0.39, p.headZ - 0.02], rot: [Math.PI / 2, 0, Math.PI / 6], color: 0xe0b44a, mat: 6, outline: false });
        k.add(G.sphere(0.07, 8, 6), { bone: "head", pos: [0, p.headY + 0.47, p.headZ + 0.32], scale: [1, 1, 0.5], color: 0xffffff, outline: false });
        for (const sd of [1, -1]) k.add(G.box(0.16, 0.025, 0.02), { bone: "head", pos: [0, p.headY + 0.43, p.headZ + 0.34], rot: [0, 0, sd * 0.6], color: 0xffffff, outline: false });
        // bandeau sur l'œil droit
        k.add(G.cyl(0.13, 0.13, 0.03, 12), { bone: "head", pos: [-p.eyeX, p.eyeY, p.eyeZ + 0.05], rot: [Math.PI / 2, 0, 0], color: 0x111111, mat: 1, outline: true });
        k.add(G.band(p.headR * 1.02, 20, 2, 0, TAU, 1.12, 0.06), { bone: "head", pos: HC(p), rot: [0, 0, 0.35], color: 0x111111, outline: false });
        // barbe noire touffue
        k.add(G.sphere(0.26, 12, 8), { bone: "head", pos: [0, p.headY - 0.32, p.headZ + 0.22], scale: [1.2, 0.8, 0.85], color: 0x1d130c, mat: 0 });
        mustache(k, p, 0x1d130c, 1.1);
      },
      props: [
        {
          name: "boat", parent: "root", pos: [0, 0.4, 0],
          build(k) {
            // pédalo : deux flotteurs, plateau, siège, roue à aubes, mât et drapeau pirate
            for (const sx of [-1, 1]) {
              k.add(G.rbox(0.44, 0.4, 2.3, 0.18, 2), { pos: [sx * 0.62, 0.2, 0], color: 0xf4f1ea, mat: 2 });
              k.add(G.rbox(0.45, 0.1, 2.24, 0.05, 1), { pos: [sx * 0.62, 0.36, 0], color: 0xe0302a, mat: 2, outline: false });
              k.add(G.cone(0.2, 0.36, 8), { pos: [sx * 0.62, 0.2, 1.32], rot: [Math.PI / 2, 0, 0], scale: [1, 1, 1.1], color: 0xf4f1ea, mat: 2 });
            }
            k.add(G.rbox(1.4, 0.1, 1.5, 0.04, 1), { pos: [0, 0.44, -0.08], color: 0x3aa0e0, mat: 1 });
            k.add(G.rbox(0.72, 0.12, 0.52, 0.05, 1), { pos: [0, 0.55, -0.34], color: 0xffd23a, mat: 2 });
            k.add(G.rbox(0.72, 0.56, 0.12, 0.05, 1), { pos: [0, 0.84, -0.62], rot: [-0.2, 0, 0], color: 0xffd23a, mat: 2 });
            const mx = -0.62, mz = 0.95;
            k.add(G.cyl(0.035, 0.035, 1.5, 6), { pos: [mx, 1.15, mz], color: 0x7a4a24, outline: true });
            k.add(G.box(0.02, 0.46, 0.64), { pos: [mx, 1.66, mz - 0.33], color: 0x16161a, outline: true });
            for (const sx of [-1, 1]) {
              k.add(G.sphere(0.09, 8, 6), { pos: [mx + sx * 0.014, 1.72, mz - 0.33], scale: [0.2, 1, 1], color: 0xffffff, outline: false });
              k.add(G.box(0.03, 0.04, 0.36), { pos: [mx + sx * 0.014, 1.57, mz - 0.33], rot: [sx * 0.7, 0, 0], color: 0xffffff, outline: false });
            }
            k.add(G.cyl(0.08, 0.06, 0.34, 8), { pos: [0, 0.58, 0.66], rot: [Math.PI / 2 - 0.4, 0, 0], color: 0x2a2a2e, mat: 3 });
          },
        },
        {
          name: "paddle", parent: "p_boat", pos: [0, 0.34, -1.12],
          build(k) {
            for (let i = 0; i < 4; i++) k.add(G.box(0.6, 0.07, 0.36), { pos: [0, 0.34, -1.12], rot: [(i * Math.PI) / 4, 0, 0], color: 0xe0302a, outline: i === 0 });
            k.add(G.cyl(0.05, 0.05, 0.8, 8), { pos: [0, 0.34, -1.12], rot: [0, 0, Math.PI / 2], color: 0x7a7a80, mat: 3, outline: false });
          },
        },
      ],
    },
  };

  // --- Chef en tondeuse blindée : toque géante, moustache, tondeuse verte blindée ---------------
  const BOSS_P = { torsoR: 0.4, belly: 0.07, torsoD: 0.9, headR: 0.47, shX: 0.36, elX: 0.55, wrX: 0.61, armR: 0.088, handR: 0.14, legR: 0.1 };
  T.boss = {
    label: "Chef en tondeuse blindée",
    p: BOSS_P,
    look: { skin: 0xf2c6a2, brow: 0x1a120c, shirt: 0xf7f5ef, sleeve: 1, pants: 0x2b2d35, pantsLen: 1, shoe: 0x2b1e16, sole: 0x111111, glove: 0x1c1c22 },
    scale: 1.2,
    motion: { gait: "drive", natural: 0.99, vehicle: 1 },
    seat: { dy: 0.58, dz: -0.5 },
    sack: { parent: "p_vehicle", pos: [0, 1.05, -1.32], scale: 1.45, hold: null },
    exhaust: [0.5, 1.85, -1.15],
    dims: { w: 1.9, h: 3.3, d: 2.95 },
    height: 3.35,
    hatH: 0.78,
    center: 1.4,
    build(k, s) {
      const p = s.p;
      body(k, p, s.look);
      chefJacket(k, p);
      mustache(k, p, 0x1a120c, 1.5);
      // toque géante (bien visible d'avion)
      k.add(G.cyl(0.4, 0.37, 0.34, 16), { bone: "head", pos: [0, p.headY + 0.5, p.headZ - 0.02], color: 0xffffff, mat: 1 });
      k.add(G.sphere(0.52, 14, 9), { bone: "head", pos: [0, p.headY + 0.86, p.headZ - 0.02], scale: [1, 0.62, 1], color: 0xffffff, mat: 1 });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + 0.3;
        k.add(G.sphere(0.2, 8, 6), { bone: "head", pos: [Math.cos(a) * 0.34, p.headY + 0.9, p.headZ - 0.02 + Math.sin(a) * 0.34], color: 0xf7f7f2, mat: 1, outline: false });
      }
      k.add(G.torus(0.39, 0.03, 4, 16), { bone: "head", pos: [0, p.headY + 0.36, p.headZ - 0.02], rot: [Math.PI / 2, 0, 0], color: 0xe8302a, outline: false });
    },
    props: [
      { name: "vehicle", parent: "root", pos: [0, 0, 0], build: (k) => { mowerBody(k, false); mowerArmor(k, false); } },
      { name: "wheelR", parent: "p_vehicle", pos: [0, 0.52, -1.08], build: (k) => wheels(k, 0.52, -1.08, 0.52, 0.9, 0.38) },
      { name: "wheelF", parent: "p_vehicle", pos: [0, 0.32, 0.98], build: (k) => wheels(k, 0.32, 0.98, 0.32, 0.76, 0.24) },
    ],
    eliteLabel: "Limousine-tondeuse",
    elite: {
      look: { shirt: 0x1d1f27, pants: 0x1d1f27, glove: 0xf2f2f2 },
      dims: { w: 1.9, h: 2.95, d: 4.75 },
      height: 2.95,
      hatH: 0.42,
      seat: { dy: 0.58, dz: -1.2 },
      sack: { parent: "p_vehicle", pos: [0, 1.15, -2.0], scale: 1.45, hold: null },
      exhaust: [0.5, 1.85, -1.85],
      noBuild: true,
      build(k, s) {
        const p = s.p;
        body(k, p, s.look);
        mustache(k, p, 0x1a120c, 1.5);
        // nœud papillon, lunettes noires et couronne
        for (const sd of [1, -1]) k.add(G.cone(0.08, 0.16, 6), { bone: "body", pos: [sd * 0.08, p.chest - 0.02, p.torsoR * p.torsoD + 0.04], rot: [0, 0, sd * Math.PI / 2], color: 0xe8243a, outline: true });
        k.add(G.rbox(0.62, 0.13, 0.06, 0.03, 1), { bone: "head", pos: [0, p.eyeY + 0.01, p.eyeZ + 0.1], color: 0x0d0d12, mat: 7 });
        k.add(G.cyl(0.4, 0.36, 0.26, 10, true), { bone: "head", pos: [0, p.headY + 0.5, p.headZ - 0.02], color: 0xffc21a, mat: 6 });
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * TAU;
          k.add(G.cone(0.09, 0.22, 4), { bone: "head", pos: [Math.cos(a) * 0.37, p.headY + 0.72, p.headZ - 0.02 + Math.sin(a) * 0.37], color: 0xffc21a, mat: 6, outline: false });
          k.add(G.sphere(0.045, 6, 4), { bone: "head", pos: [Math.cos(a) * 0.4, p.headY + 0.5, p.headZ - 0.02 + Math.sin(a) * 0.4], color: i % 2 ? 0xe8243a : 0x2b8cff, mat: 4, outline: false });
        }
      },
      props: [
        { name: "vehicle", parent: "root", pos: [0, 0, 0], build: (k) => { mowerBody(k, true); mowerArmor(k, true); } },
        { name: "wheelR", parent: "p_vehicle", pos: [0, 0.52, -1.75], build: (k) => wheels(k, 0.52, -1.75, 0.52, 0.9, 0.38, true) },
        { name: "wheelF", parent: "p_vehicle", pos: [0, 0.36, 1.68], build: (k) => wheels(k, 0.36, 1.68, 0.36, 0.8, 0.26, true) },
      ],
    },
  };
  function chefJacket(k, p) {
    const z = p.torsoR * p.torsoD + p.belly * 0.9;
    for (let i = 0; i < 3; i++) for (const sd of [1, -1]) k.add(G.sphere(0.035, 6, 4), { bone: "body", pos: [sd * 0.12, p.waist + 0.16 + i * 0.13, z + 0.02 - i * 0.02], color: 0x2a2a30, outline: false });
    k.add(G.torus(0.3, 0.05, 5, 16), { bone: "body", pos: [0, p.chest - 0.04, 0], rot: [Math.PI / 2 + 0.1, 0, 0], color: 0xe8302a, mat: 1 });
    k.add(G.cyl(0.08, 0.08, 0.025, 12), { bone: "body", pos: [0.0, p.waist + 0.5, z + 0.02], rot: [Math.PI / 2 - 0.2, 0, 0], color: 0xffc21a, mat: 6, outline: true });
  }
  function wheels(k, y, z, r, x, w, limo) {
    for (const s of [-1, 1]) {
      k.add(G.cyl(r, r, w, 16), { pos: [s * x, y, z], rot: [0, 0, Math.PI / 2], color: 0x1d1d20, mat: 0 });
      k.add(G.cyl(r * 0.55, r * 0.55, w + 0.02, 10), { pos: [s * x, y, z], rot: [0, 0, Math.PI / 2], color: limo ? 0xd8dde3 : 0xffd23a, mat: limo ? 3 : 2, outline: false });
      for (let i = 0; i < 4; i++) k.add(G.box(w + 0.03, r * 0.16, r * 1.02), { pos: [s * x, y, z], rot: [(i * Math.PI) / 4, 0, 0], color: limo ? 0x9aa2ab : 0xc98f12, outline: false });
    }
  }
  // Tondeuse : carrosserie et blindage (os « vehicle »).
  function mowerBody(k, limo) {
    const body = limo ? 0x16161b : 0x39a23a, trim = limo ? 0xd8dde3 : 0xffd23a, deck = 0x44484f;
    const L = limo ? 4.1 : 2.6, zc = limo ? 0.0 : 0.1, hz = limo ? 1.42 : 0.84, fz = limo ? 1.97 : 1.39;
    k.add(G.rbox(limo ? 1.2 : 1.6, 0.22, limo ? 1.3 : 1.6, 0.08, 1), { pos: [0, 0.3, 0.1], color: deck, mat: 3 });
    k.add(G.rbox(1.28, 0.52, L, 0.15, 2), { pos: [0, 0.74, zc], color: body, mat: 2 });
    // capot moteur avant + bande
    k.add(G.rbox(1.2, 0.52, 1.05, 0.2, 2), { pos: [0, 1.04, hz], color: body, mat: 2 });
    k.add(G.box(1.22, 0.07, 0.52), { pos: [0, 1.3, hz], color: trim, mat: 2, outline: false });
    // calandre (rougit en surchauffe) + phares
    k.add(G.box(0.84, 0.36, 0.06), { pos: [0, 1.0, fz], color: 0x2a2a2e, mat: 5, outline: false });
    for (let i = 0; i < 3; i++) k.add(G.box(0.76, 0.035, 0.02), { pos: [0, 0.9 + i * 0.1, fz + 0.04], color: 0x111114, outline: false });
    for (const s of [-1, 1]) {
      k.add(G.cyl(0.12, 0.12, 0.08, 12), { pos: [s * 0.46, 1.16, fz - 0.02], rot: [Math.PI / 2, 0, 0], color: trim, mat: 3, outline: false });
      k.add(G.cyl(0.09, 0.09, 0.02, 12), { pos: [s * 0.46, 1.16, fz + 0.03], rot: [Math.PI / 2, 0, 0], color: 0xfff6c2, mat: 4, outline: false });
    }
    // siège + dossier
    const sz = limo ? -1.2 : -0.5;
    k.add(G.rbox(0.72, 0.16, 0.6, 0.06, 1), { pos: [0, 1.06, sz], color: 0x1b1b1f, mat: 1 });
    k.add(G.rbox(0.76, 0.7, 0.16, 0.07, 1), { pos: [0, 1.44, sz - 0.36], rot: [-0.18, 0, 0], color: 0x1b1b1f, mat: 1 });
    // volant
    k.add(G.cyl(0.035, 0.035, 0.6, 6), { pos: [0, 1.3, sz + 0.62], rot: [-0.6, 0, 0], color: 0x2a2a2e, mat: 3, outline: false });
    k.add(G.torus(0.2, 0.03, 5, 14), { pos: [0, 1.53, sz + 0.48], rot: [Math.PI / 2 - 0.6, 0, 0], color: 0x16161a, mat: 2, outline: true });
    // pot d'échappement (la fumée sort d'ici)
    k.add(G.cyl(0.07, 0.07, 0.7, 8), { pos: [0.5, 1.35, sz - 0.6], color: 0xaab2bb, mat: 3, outline: true });
    k.add(G.cyl(0.09, 0.07, 0.1, 8), { pos: [0.5, 1.72, sz - 0.6], color: 0x55585e, mat: 3, outline: false });
    if (limo) {
      // habitacle à vitres teintées + fanions + tapis rouge enroulé
      k.add(G.rbox(1.22, 0.58, 1.6, 0.14, 2), { pos: [0, 1.26, 0.2], color: body, mat: 2 });
      for (const s of [-1, 1]) k.add(G.box(0.02, 0.32, 1.3), { pos: [s * 0.615, 1.3, 0.2], color: 0x2a4a6a, mat: 7, outline: false });
      k.add(G.box(1.04, 0.02, 1.3), { pos: [0, 1.555, 0.2], color: 0x2a4a6a, mat: 7, outline: false });
      k.add(G.box(1.3, 0.05, L + 0.04), { pos: [0, 1.0, 0.0], color: trim, mat: 3, outline: false });
      for (const s of [-1, 1]) {
        k.add(G.cyl(0.015, 0.015, 0.45, 5), { pos: [s * 0.52, 1.52, 1.85], color: 0xd8dde3, mat: 3, outline: false });
        k.add(G.box(0.012, 0.14, 0.24), { pos: [s * 0.52, 1.66, 1.73], color: s > 0 ? 0xe8243a : 0x2b8cff, outline: false });
      }
      k.add(G.cyl(0.12, 0.12, 1.05, 10), { pos: [0, 0.72, -2.1], rot: [0, 0, Math.PI / 2], color: 0xc81d2e, mat: 1 });
      k.add(G.rbox(1.1, 0.5, 0.6, 0.1, 2), { pos: [0, 0.95, -2.0 + 0.0], color: 0x2a2a31, mat: 1 });
    } else {
      // gros bac de ramassage à l'arrière (le sac y est jeté)
      k.add(G.rbox(1.1, 0.66, 0.62, 0.12, 2), { pos: [0, 0.86, -1.32], color: 0x2c7d2a, mat: 1 });
    }
  }
  function mowerArmor(k, limo) {
    const plate = limo ? 0x2a2a31 : 0x5d6671;
    for (const s of [-1, 1]) {
      const n = limo ? 5 : 3;
      for (let i = 0; i < n; i++) {
        const z = (limo ? -1.65 : -0.92) + i * (limo ? 0.74 : 0.78);
        k.add(G.box(0.05, 0.42, 0.68), { pos: [s * 0.66, 0.74, z], color: plate, mat: 3, outline: false });
        for (const dz of [-0.27, 0.27]) for (const dy of [-0.14, 0.14]) k.add(G.sphere(0.025, 4, 3), { pos: [s * 0.69, 0.74 + dy, z + dz], color: 0xc0c6cd, mat: 3, outline: false });
      }
    }
    // pare-chocs à pointes + plaque frontale
    const fz = limo ? 2.07 : 1.5;
    k.add(G.rbox(1.36, 0.16, 0.18, 0.05, 1), { pos: [0, 0.56, fz], color: plate, mat: 3 });
    for (let i = 0; i < 5; i++) k.add(G.cone(0.06, 0.24, 6), { pos: [-0.52 + i * 0.26, 0.56, fz + 0.18], rot: [Math.PI / 2, 0, 0], color: 0xd6dade, mat: 3, outline: false });
    k.add(G.box(0.94, 0.08, 0.05), { pos: [0, 1.22, fz - 0.07], color: plate, mat: 3, outline: false });
  }

  // ---------------------------------------------------------------------------------------------
  // Sac de trésor porté : même sac doré que le sac tombé, mais lisible d'avion (haut froncé doré,
  // ruban rouge, pièces qui dépassent ; pas de contour sur les petites pièces). Origine : fond du sac.
  // ---------------------------------------------------------------------------------------------
  A.buildSack = function (k, opt) {
    const s = opt.scale || 1, bone = opt.bone;
    const base = new THREE.Matrix4().compose(
      new THREE.Vector3().fromArray(opt.pos || [0, 0, 0]),
      new THREE.Quaternion().setFromEuler(new THREE.Euler((opt.rot || [0, 0, 0])[0], (opt.rot || [0, 0, 0])[1], (opt.rot || [0, 0, 0])[2])),
      new THREE.Vector3(s, s, s),
    );
    const put = (geo, color, mat, x, y, z, rx, ry, rz, sx, sy, sz, extra) => {
      const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0)), new THREE.Vector3(sx || 1, sy || sx || 1, sz || sx || 1));
      k.add(geo, Object.assign({ matrix: new THREE.Matrix4().multiplyMatrices(base, m), color, mat, bone }, extra || {}));
    };
    const MAT = PTMT.gfx.MAT;
    // corps ventru, col serré, haut froncé
    put(G.lathe("sack", [[0.0, 0.0], [0.2, 0.02], [0.32, 0.12], [0.36, 0.26], [0.34, 0.4], [0.25, 0.52], [0.13, 0.6], [0.1, 0.63]], 12), 0xeea01a, MAT.gold, 0, 0, 0, 0, 0.2, 0, 1, 1, 0.94, { jitter: 0.03, seed: 11, outline: true });
    put(G.lathe("sackTop", [[0.09, 0.62], [0.15, 0.68], [0.22, 0.76], [0.2, 0.79], [0.12, 0.77], [0.001, 0.72]], 10), 0xf7b52a, MAT.gold, 0, 0, 0, 0, 0, 0, 1, 1, 1, { jitter: 0.02, seed: 5, outline: true });
    // ruban rouge noué
    put(G.torus(0.11, 0.032, 5, 12), 0xe0262c, MAT.gloss || 2, 0, 0.625, 0, Math.PI / 2, 0, 0, 1, 1, 1, { outline: false });
    put(G.torus(0.06, 0.022, 4, 8), 0xe0262c, 2, 0.1, 0.64, 0.1, 0.4, 0.8, 0.3, 1, 1, 1, { outline: false });
    put(G.torus(0.06, 0.022, 4, 8), 0xe0262c, 2, -0.02, 0.64, 0.14, -0.3, -0.6, -0.2, 1, 1, 1, { outline: false });
    // pièces qui dépassent
    const coin = G.cyl(0.075, 0.075, 0.02, 10);
    put(coin, 0xffe066, MAT.gold, 0.04, 0.8, 0.02, 0.5, 0, 0.3, 1, 1, 1, { outline: false });
    put(coin, 0xffd23a, MAT.gold, -0.07, 0.79, -0.04, -0.4, 0, -0.5, 1, 1, 1, { outline: false });
    // écusson « $ »
    put(G.cyl(0.13, 0.13, 0.03, 12), 0xffe27a, MAT.gold, 0, 0.27, 0.315, Math.PI / 2, 0, 0, 1, 1, 1, { outline: false });
    put(G.torus(0.045, 0.014, 4, 8, Math.PI * 1.3), 0x9a5c06, MAT.gold, 0, 0.3, 0.335, 0, 0, 0.6, 1, 1, 1, { outline: false });
    put(G.torus(0.045, 0.014, 4, 8, Math.PI * 1.3), 0x9a5c06, MAT.gold, 0, 0.24, 0.335, 0, 0, 0.6 + Math.PI, 1, 1, 1, { outline: false });
    put(G.box(0.018, 0.19, 0.012), 0x9a5c06, MAT.gold, 0, 0.27, 0.338, 0, 0, 0, 1, 1, 1, { outline: false });
  };

  // ---------------------------------------------------------------------------------------------
  // Assemblage d'une variante (type + élite éventuel)
  // ---------------------------------------------------------------------------------------------
  function merge(base, over) {
    if (!over) return base;
    const out = Object.assign({}, base);
    for (const k of Object.keys(over)) {
      const v = over[k];
      if (v && typeof v === "object" && !Array.isArray(v) && typeof v !== "function" && base[k] && typeof base[k] === "object" && !Array.isArray(base[k])) out[k] = Object.assign({}, base[k], v);
      else out[k] = v;
    }
    return out;
  }
  /** Spécification complète d'une variante. */
  A.variantSpec = function (type, elite) {
    const base = T[type];
    if (!base) throw new Error("PTMT.actors : type inconnu « " + type + " »");
    const e = elite ? base.elite || {} : null;
    const spec = merge(base, e ? Object.assign({}, e, { build: undefined, props: undefined, noProps: undefined, noBuild: undefined, p: undefined, look: undefined, motion: undefined }) : null);
    spec.type = type;
    spec.isElite = !!elite;
    spec.label = elite ? base.eliteLabel : base.label;
    const over = Object.assign({}, base.p || {}, (e && e.p) || {});
    spec.p = Object.assign({}, STD, over);
    const lift = spec.p.hip - STD.hip;
    if (lift) for (const key of ["waist", "chest", "neck", "headY", "shY", "elY", "wrY", "eyeY", "browY", "mouthY", "noseY"]) if (over[key] === undefined) spec.p[key] += lift;
    spec.look = Object.assign({}, base.look, (e && e.look) || {});
    spec.motion = Object.assign({}, base.motion, (e && e.motion) || {});
    spec.skeleton = skeleton(spec.p);
    const sc = spec.scale || 1;
    spec.dims = { w: spec.dims.w * sc, h: spec.dims.h * sc, d: spec.dims.d * sc };
    spec.height = spec.height * sc;
    spec.headC = [0, spec.p.headY, spec.p.headZ];
    spec.headR = spec.p.headR;
    // accessoires : ceux du type (sauf si l'élite les remplace) + ceux de l'élite
    spec.builds = [];
    if (!(e && e.noBuild)) spec.builds.push(base.build);
    if (e && e.build) spec.builds.push(e.build);
    const drop = new Set((e && e.noProps) || []);
    spec.propDefs = (base.props || []).filter((p) => !drop.has(p.name)).concat((e && e.props) || []);
    spec.cape = e && e.cape ? e.cape : null;
    if (spec.mood === undefined) spec.mood = null;
    return spec;
  };
  A.TYPES = ["voleur", "sprinteur", "demenageur", "fumigene", "nageur", "boss"];
  A.typeDefs = T;
})();
