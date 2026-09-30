// « Pas touche à mes trésors » — les trois cavaliers et leurs montures (PTMT.actors).
//
// Voleur en quad (voleur de CT : rapide), fermier sur sa vache bretonne pie noir (chevalier : lent, le
// bidon de lait sert de bouclier) et matelot sur son canard colvert géant (valkyrie : coupe par l'eau).
// La monture fait partie du même maillage que le cavalier (un seul appel de dessin) : ses pièces sont
// liées à des os d'accessoires (châssis, roues, guidon ; corps, tête, pattes, queue, cloche ; cou, tête,
// ailes, pattes du canard) que A.MOUNTS[kind].pose anime à chaque image. Le mouvement de la selle
// (rebond, tangage, roulis, enfoncement dans l'eau) est recopié sur le bassin du cavalier (a.mm).
// Pour le boss : quad doré, cornes et cloche dorées, canard tout en or.
(function () {
  "use strict";
  const PTMT = (globalThis.PTMT = globalThis.PTMT || {});
  const A = (PTMT.actors = PTMT.actors || {});
  if (!A.typeDefs) return;
  const T = A.typeDefs, G = A.G, P = A.parts, PAL = A.PAL, PART = A.PART, MAT = A.MAT, shade = A.shade;
  const TAU = Math.PI * 2;
  const GOLD = 0xffc21a;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const MOUNTS = (A.MOUNTS = A.MOUNTS || {});

  /** Fente de la cagoule (bande de peau autour des yeux). */
  function balaclava(k, p, skin) {
    k.add(G.band(p.headR * 1.012, 12, 2, Math.PI / 2 - 1.0, 2.0, 1.12, 0.58), { bone: "head", pos: P.HC(p), scale: [1, 0.96, 0.97], color: skin, mat: 1, outline: false });
  }
  /** Sac de toile noué, dans le dos. */
  function lootSack(k, p, col) {
    k.add(G.lathe("loot", [[0.001, 0], [0.26, 0.05], [0.3, 0.26], [0.18, 0.44], [0.07, 0.52], [0.13, 0.6], [0.001, 0.62]], 7), { bone: "body", pos: [0.02, p.waist + 0.12, -p.torsoR * p.torsoD - 0.2], rot: [-0.35, 0.3, 0.12], scale: [1.1, 1, 0.8], color: col, mat: 0, outline: true, jitter: 0.04, seed: 5 });
    k.add(G.torus(0.08, 0.02, 3, 8), { bone: "body", pos: [0.02, p.waist + 0.58, -p.torsoR * p.torsoD - 0.37], rot: [Math.PI / 2 - 0.35, 0, 0], color: 0x7a5a30, outline: false });
  }

  // ---------------------------------------------------------------------------------------------
  // Voleur en quad : cagoule, pull rayé, sac de toile, petit quad orange
  // ---------------------------------------------------------------------------------------------
  const QSEAT = 0.8;
  T.quad = {
    label: "Voleur en quad",
    championLabel: "As du quad",
    scale: 0.96,
    p: {},
    look: {
      legOutline: false, skin: 0xf2c4a0, headColor: 0x1b1b20, noEars: true, cheek: null, noNose: true, brow: 0x0e0e12, browW: 1.1,
      shirt: 0x1e1e24, shirtPart: PART.stripes, shirtPal: PAL.cream, sleeve: 1,
      pants: 0x26262e, pantsLen: 1, shoe: 0xf2f2f2, sole: 0xd83020, glove: 0x1b1b20,
      body: 0xf2600c, trim: 0x2a2a30, seat: 0x1a1a1e, rim: 0xb0b6be, sack: 0xc8a36a,
    },
    champion: { look: { body: 0xd41e2a, trim: GOLD, rim: 0xe8ecf0 } },
    boss: { look: { body: GOLD, trim: 0xe8243a } },
    mood: "sly",
    motion: { gait: "ride", arms: ["drive", "drive"] },
    mount: { kind: "quad", seat: { dy: QSEAT - 0.43, dz: -0.14, thigh: -1.3, shin: 1.4, spread: 0.34, foot: 0.25, lean: 0.28 } },
    carry: { pos: [-0.52, 2.5, 0.1], arms: ["drive", "carryUp"] },
    dims: { w: 1.4, h: 2.6, d: 2.05 },
    height: 2.55,
    center: 0.9,
    props(s) {
      return [
        { name: "mount", parent: "root", pos: [0, QSEAT, -0.1], build: (k, s) => quadBody(k, s.look, s.boss) },
        { name: "bars", parent: "p_mount", pos: [0, 0.98, 0.5], build: (k) => quadBars(k) },
        { name: "wheelF", parent: "root", pos: [0, 0.3, 0.64], build: (k, s) => quadWheels(k, 0.64, s.look, s.boss) },
        { name: "wheelR", parent: "root", pos: [0, 0.3, -0.64], build: (k, s) => quadWheels(k, -0.64, s.look, s.boss) },
      ];
    },
    build(k, s) {
      const p = s.p, L = s.look;
      A.body(k, p, L);
      balaclava(k, p, L.skin);
      lootSack(k, p, L.sack);
      if (s.champion) {
        // chaîne en or
        k.add(G.torus(p.torsoR * 0.8, 0.028, 4, 14), { bone: "body", pos: [0, p.chest - 0.08, 0.03], rot: [Math.PI / 2 + 0.35, 0, 0], color: GOLD, mat: MAT.gold, outline: false });
        k.add(G.cyl(0.07, 0.07, 0.03, 8), { bone: "body", pos: [0, p.chest - 0.34, p.torsoR * p.torsoD + 0.06], rot: [Math.PI / 2 - 0.2, 0, 0], color: GOLD, mat: MAT.gold, outline: false });
      }
      if (s.boss) P.crown(k, { bone: "head", pos: [0, p.headY + 0.34, p.headZ - 0.02], r: 0.3, h: 0.16, big: true });
    },
  };
  function quadBody(k, L, gold) {
    const b = L.body, mb = gold ? MAT.gold : MAT.gloss;
    // bloc moteur sombre, garde-boue avant et arrière, capot, selle
    k.add(G.rbox(0.62, 0.3, 1.18, 0.08, 1), { pos: [0, 0.47, -0.04], color: 0x2a2a30, mat: 1, outline: true });
    k.add(G.rbox(1.2, 0.15, 0.68, 0.07, 2), { pos: [0, 0.64, 0.62], color: b, mat: mb, outline: true });
    k.add(G.rbox(1.2, 0.15, 0.66, 0.07, 2), { pos: [0, 0.66, -0.64], color: b, mat: mb, outline: true });
    k.add(G.rbox(0.56, 0.24, 0.52, 0.1, 2), { pos: [0, 0.72, 0.26], color: b, mat: mb, outline: true });
    k.add(G.rbox(0.38, 0.12, 0.66, 0.06, 2), { pos: [0, QSEAT - 0.06, -0.2], color: L.seat, mat: 1, outline: true });
    k.add(G.box(0.12, 0.02, 0.52), { pos: [0, 0.845, 0.26], color: L.trim, mat: gold ? 2 : MAT.gold, outline: false });
    // phares
    for (const sd of [1, -1]) {
      k.add(G.cyl(0.09, 0.09, 0.06, 8), { pos: [sd * 0.27, 0.66, 0.97], rot: [Math.PI / 2, 0, 0], color: 0x3a3a40, mat: MAT.metal, outline: false });
      k.add(G.cyl(0.07, 0.07, 0.02, 8), { pos: [sd * 0.27, 0.66, 1.005], rot: [Math.PI / 2, 0, 0], color: 0xfff4b0, mat: MAT.glow, outline: false });
    }
    // porte-bagages tubulaires
    for (const z of [0.66, -0.68]) {
      for (const dz of [-0.2, 0.2]) k.add(G.box(0.86, 0.035, 0.035), { pos: [0, 0.79, z + dz], color: 0x4a5058, mat: MAT.metal, outline: false });
      for (const sd of [1, -1]) k.add(G.box(0.035, 0.035, 0.44), { pos: [sd * 0.42, 0.79, z], color: 0x4a5058, mat: MAT.metal, outline: false });
    }
    // repose-pieds, pot d'échappement
    for (const sd of [1, -1]) k.add(G.box(0.2, 0.04, 0.5), { pos: [sd * 0.42, 0.4, -0.04], color: 0x2a2a30, mat: MAT.metal, outline: false });
    k.add(G.cyl(0.06, 0.06, 0.42, 6), { pos: [-0.36, 0.5, -0.94], rot: [Math.PI / 2, 0, 0], color: 0xaab2bb, mat: MAT.metal, outline: true });
  }
  function quadBars(k) {
    k.add(G.cyl(0.03, 0.03, 0.34, 5), { pos: [0, 0.86, 0.45], rot: [-0.35, 0, 0], color: 0x2a2a30, mat: MAT.metal, outline: false });
    k.add(G.cyl(0.032, 0.032, 0.82, 6), { pos: [0, 1.0, 0.52], rot: [0, 0, Math.PI / 2], color: 0x8a9098, mat: MAT.metal, outline: true });
    for (const sd of [1, -1]) k.add(G.cyl(0.048, 0.048, 0.16, 6), { pos: [sd * 0.38, 1.0, 0.52], rot: [0, 0, Math.PI / 2], color: 0x1a1a1e, mat: 1, outline: true });
  }
  function quadWheels(k, z, L, gold) {
    for (const sd of [1, -1]) {
      k.add(G.cyl(0.3, 0.3, 0.26, 10), { pos: [sd * 0.56, 0.3, z], rot: [0, 0, Math.PI / 2], color: 0x1c1c20, mat: 0, outline: true });
      k.add(G.cyl(0.16, 0.16, 0.27, 6), { pos: [sd * 0.56, 0.3, z], rot: [0, 0, Math.PI / 2], color: L.rim, mat: gold ? MAT.gold : MAT.metal, outline: false });
      for (let i = 0; i < 2; i++) k.add(G.box(0.27, 0.06, 0.63), { pos: [sd * 0.56, 0.3, z], rot: [(i * Math.PI) / 2, 0, 0], color: 0x34343a, outline: false });
    }
  }
  MOUNTS.quad = {
    /** Quad : roues selon la vitesse, suspension qui cahote, guidon qui tremble. */
    pose(a, dt, s, moving, speed) {
      const B = a.B, t = a.time, mm = a.mm, r = a.rest.p_mount;
      a.wheelA += (speed * dt) / 0.3;
      B.p_wheelF.rotation.set(a.wheelA, 0, 0);
      B.p_wheelR.rotation.set(a.wheelA, 0, 0);
      const k = Math.min(1, speed / 3);
      const y = moving ? (Math.sin(t * 17 + a.id) * 0.016 + Math.max(0, Math.sin(t * 5.3 + a.id * 2)) * 0.035) * (0.4 + 0.6 * k) : Math.sin(t * 38 + a.id) * 0.006;
      const pitch = moving ? Math.sin(t * 6.1 + a.id) * 0.02 * k - 0.025 * k : 0;
      const roll = moving ? Math.sin(t * 4.3 + a.id) * 0.02 * k : 0;
      B.p_mount.position.set(r.x, r.y + y, r.z);
      B.p_mount.rotation.set(pitch, 0, roll);
      B.p_bars.rotation.set(0, Math.sin(t * 3.1 + a.id) * 0.07 * k, 0);
      mm.y = y; mm.z = 0; mm.pitch = pitch; mm.roll = roll; mm.yaw = 0;
    },
    /** Pot d'échappement (repère de l'os p_mount) pour la fumée. */
    exhaust: [-0.36, -0.3, -1.08],
  };

  // ---------------------------------------------------------------------------------------------
  // Cavalier sur vache : seau en guise de casque, bidon de lait en bouclier, vache bretonne pie noir
  // ---------------------------------------------------------------------------------------------
  const CSEAT = 1.17;
  T.vache = {
    label: "Cavalier sur vache",
    championLabel: "Cavalier sur vache primée",
    p: {},
    look: {
      legOutline: false, skin: 0xf0b088, brow: 0x3a2414, browW: 1.2, cheek: 0xff8f7a, shirt: 0x3a6ab0, sleeve: 1, pants: 0x6a4a2a, pantsLen: 1, shoe: 0x2a1c14, glove: null,
      bucket: 0xaab4be, can: 0xd0d8e0, canBand: 0x2a5ac8, cow: 0x1c1a1e, muzzle: 0xe0b0a8, horn: 0xf0e6d0, bell: 0xd8a830, collar: 0x8a4a22, blanket: 0, mustache: 0x5a3418,
    },
    champion: { look: { shirt: 0x2446b8, canBand: GOLD, blanket: 0xc81e2a, collar: 0xc81e2a, bell: GOLD } },
    boss: { look: { horn: GOLD, bell: GOLD, blanket: 0x7a1a3a } },
    mood: "stern",
    motion: { gait: "ride", arms: ["shield", "lance"] },
    mount: { kind: "cow", seat: { dy: CSEAT - 0.45, dz: -0.1, thigh: -0.85, shin: 1.05, spread: 0.95, foot: 0.3, lean: 0.06 } },
    carry: { pos: [-0.52, 2.5, 0.1], arms: ["shield", "carryUp"] },
    dims: { w: 1.5, h: 3.0, d: 2.55 },
    height: 3.05,
    center: 1.1,
    props(s) {
      const p = s.p, hl = A.handC(p, 1), hr = A.handC(p, -1);
      return [
        { name: "hat", parent: "head", pos: [0, p.headY + 0.3, p.headZ], build: (k, s) => bucket(k, s.p, s.look, s.champion) },
        { name: "can", parent: "hand_l", pos: hl, build: (k, s) => milkCan(k, hl, s.look) },
        { name: "lance", parent: "hand_r", pos: hr, build: (k) => {
          k.add(G.cyl(0.028, 0.028, 1.9, 5), { pos: [hr[0], hr[1] + 0.35, hr[2]], color: 0xa0703a, mat: 1, outline: true });
          k.add(G.cone(0.045, 0.14, 4), { pos: [hr[0], hr[1] + 1.36, hr[2]], color: 0xb8c0c8, mat: MAT.metal, outline: false });
        } },
        { name: "mount", parent: "root", pos: [0, CSEAT, -0.1], build: (k, s) => cowBody(k, s) },
        { name: "chead", parent: "p_mount", pos: [0, 1.0, 0.7], build: (k, s) => cowHead(k, s.look) },
        { name: "bell", parent: "p_chead", pos: [0, 0.86, 0.96], build: (k, s) => cowBell(k, s.look, s.boss) },
        { name: "tail", parent: "p_mount", pos: [0, 1.08, -0.84], build: (k, s) => {
          k.add(G.tube("cowtail", [[0, 1.08, -0.84], [0, 0.95, -0.95], [0, 0.72, -0.98], [0, 0.52, -0.96]], 0.028, 5, 3), { color: s.look.cow, mat: 1, outline: false });
          k.add(G.sphere(0.07, 4, 3), { pos: [0, 0.48, -0.96], scale: [0.8, 1.3, 0.8], color: 0xf4f0e8, mat: 1, outline: false });
        } },
      ].concat(cowLegs());
    },
    build(k, s) {
      const p = s.p, L = s.look;
      A.body(k, p, L);
      P.mustache(k, p, L.mustache, 1.1, null, false);
      if (!s.boss) P.belt(k, p, 0x3a2412, 0xd8dde3);
      if (s.boss) {
        // écharpe tricolore du maire (de l'épaule gauche à la hanche droite)
        [0x2446b8, 0xf4f4f0, 0xe0262a].forEach((c, i) => k.add(G.torus(p.torsoR * 1.12, 0.03, 3, 10), { bone: "body", pos: [0.0, p.waist + 0.3, 0], rot: [0, 0, 0.75 + (i - 1) * 0.07], scale: [1, 1.15, p.torsoD * 1.25], color: c, mat: 1, outline: false }));
      }
    },
    animate(a) {
      a.hold("can", 0, 0, -0.35, 0);
      a.hold("lance", 1, 1.25, 0, 0.12);
    },
  };
  function bucket(k, p, L, gold) {
    const y0 = p.headY + 0.1, z = p.headZ - 0.01;
    k.add(G.cyl(0.36, 0.48, 0.52, 10, true), { pos: [0, y0 + 0.26, z], color: L.bucket, mat: MAT.metal, outline: true });
    k.add(G.cyl(0.36, 0.36, 0.02, 10), { pos: [0, y0 + 0.52, z], color: shade(L.bucket, 0.85), mat: MAT.metal, outline: false });
    for (const [yy, rr] of [[0.02, 0.48], [0.3, 0.42]]) k.add(G.torus(rr + 0.01, 0.025, 3, 10), { pos: [0, y0 + yy, z], rot: [Math.PI / 2, 0, 0], color: gold ? GOLD : shade(L.bucket, 1.1), mat: gold ? MAT.gold : MAT.metal, outline: false });
    // l'anse sert de jugulaire
    k.add(G.torus(0.47, 0.018, 3, 12, Math.PI), { pos: [0, y0 + 0.05, z + 0.06], rot: [0.25, 0, Math.PI], color: 0x6a7078, mat: MAT.metal, outline: false });
    return y0 + 0.52;
  }
  function milkCan(k, hc, L) {
    const [x, y, z] = hc;
    k.add(G.lathe("milkcan", [[0.001, -0.34], [0.23, -0.32], [0.23, 0.1], [0.1, 0.24], [0.1, 0.3], [0.14, 0.34], [0.001, 0.37]], 8), { pos: [x + 0.06, y + 0.02, z + 0.06], color: L.can, mat: MAT.metal, outline: true });
    k.add(G.cyl(0.235, 0.235, 0.1, 8, true), { pos: [x + 0.06, y - 0.08, z + 0.06], color: L.canBand, mat: L.canBand === GOLD ? MAT.gold : 2, outline: false });
  }
  /** Os des pattes : haut (épaule / hanche) et bas (genou / jarret), plus le sabot. */
  function cowLegs() {
    const out = [];
    for (const [id, x, z] of [["fl", 0.25, 0.44], ["fr", -0.25, 0.44], ["bl", 0.25, -0.58], ["br", -0.25, -0.58]]) {
      out.push({ name: "leg_" + id, parent: "p_mount", pos: [x, 0.66, z], build: (k, s) => {
        const a = [x, 0.72, z], e = [x * 1.04, 0.36, z + 0.02], b = [x * 1.04, 0.08, z];
        k.add(A.limbGeo("cowleg" + id, [a, e, b], 0.12, 0.085, [[0, s.look.cow], [0.62, 0xf2eee6]], 4, 2), { colors: true, weights: A.limbWeights(a, e, b, "p_leg_" + id, "p_shin_" + id, 0.06), outline: true });
        k.add(G.cyl(0.09, 0.1, 0.1, 5), { bone: "p_shin_" + id, pos: [x * 1.04, 0.05, z + 0.01], color: 0x2a2020, mat: 1, outline: false });
      } });
      out.push({ name: "shin_" + id, parent: "p_leg_" + id, pos: [x * 1.04, 0.36, z + 0.02] });
    }
    return out;
  }
  function cowBody(k, s) {
    const L = s.look;
    // corps : robe pie noir calculée dans le shader (taches différentes pour chaque vache)
    k.add(G.sphere(0.5, 11, 7), { pos: [0, 0.83, -0.07], scale: [0.88, 0.74, 1.58], color: L.cow, part: PART.pie, pal: PAL.white, mat: 1, outline: true });
    k.add(G.sphere(0.13, 6, 4), { pos: [0, 0.52, -0.38], scale: [1.1, 0.7, 1.1], color: 0xf2a8b0, mat: 1, outline: false });
    if (L.blanket) {
      // couverture de selle (champion, boss) : drapé sur le dos, franges dorées sur les flancs
      k.add(G.cyl(0.47, 0.47, 0.72, 8, true, Math.PI - 1.15, 2.3), { pos: [0, 0.84, -0.12], rot: [Math.PI / 2, 0, 0], scale: [1, 1, 0.84], color: L.blanket, mat: 1, outline: true });
      for (const sd of [1, -1]) k.add(G.box(0.05, 0.05, 0.74), { pos: [sd * 0.43, 0.99, -0.12], color: GOLD, mat: MAT.gold, outline: false });
    }
    if (s.champion && !s.boss) P.rosette(k, "p_mount", [0.3, 0.95, 0.6], 1.3);
  }
  function cowHead(k, L) {
    // crâne noir, liste blanche, mufle rose, grands yeux, oreilles, cornes en lyre
    k.add(G.sphere(0.3, 8, 6), { pos: [0, 1.06, 0.98], scale: [0.95, 0.9, 1.12], color: L.cow, mat: 1, outline: true });
    k.add(G.sphere(0.18, 5, 3), { pos: [0, 1.16, 1.22], scale: [0.55, 0.85, 0.35], rot: [-0.3, 0, 0], color: 0xf4f0e8, mat: 1, outline: false });
    k.add(G.sphere(0.22, 6, 4), { pos: [0, 0.94, 1.25], scale: [1.08, 0.78, 0.82], color: L.muzzle, mat: 1, outline: true });
    for (const sd of [1, -1]) {
      k.add(G.sphere(0.035, 3, 2), { pos: [sd * 0.08, 0.95, 1.43], color: 0x5a2a2a, outline: false });
      k.add(G.sphere(0.085, 5, 4), { pos: [sd * 0.19, 1.15, 1.18], scale: [0.9, 1.1, 0.8], color: 0xffffff, part: PART.eye, mat: 2, outline: false });
      k.add(G.sphere(0.047, 4, 2), { pos: [sd * 0.2, 1.145, 1.24], color: 0x17110d, part: PART.pupil, mat: 2, outline: false });
      k.add(G.sphere(0.13, 5, 3), { pos: [sd * 0.36, 1.12, 0.92], rot: [0, 0, sd * -0.5], scale: [1, 0.4, 0.62], color: L.cow, mat: 1, outline: false });
      const h0 = [sd * 0.17, 1.27, 0.95], h1 = [sd * 0.42, 1.33, 0.96], h2 = [sd * 0.5, 1.56, 0.93], h3 = [sd * 0.42, 1.72, 0.97];
      k.add(A.limbGeo("horn" + sd, [h0, h1, h2, h3], 0.055, 0.022, [[0, L.horn], [0.82, 0x3a3030]], 4, 3), { colors: true, mat: L.horn === GOLD ? MAT.gold : 2, outline: true });
    }
    k.add(G.cone(0.08, 0.16, 4), { pos: [0, 1.33, 1.02], rot: [0.5, 0, 0], color: L.cow, outline: false });
  }
  function cowBell(k, L, gold) {
    k.add(G.torus(0.27, 0.035, 3, 10), { bone: "p_chead", pos: [0, 0.98, 0.84], rot: [Math.PI / 2 + 0.55, 0, 0], color: L.collar, mat: 1, outline: false });
    k.add(G.lathe("bell", [[0.001, -0.1], [0.12, -0.1], [0.07, 0.06], [0.001, 0.11]], 7), { pos: [0, 0.74, 0.98], color: L.bell, mat: gold || L.bell === GOLD ? MAT.gold : MAT.metal, outline: true });
  }
  MOUNTS.cow = {
    /** Vache : pas croisés (diagonales), dos qui roule, tête qui dodeline, queue, cloche. */
    pose(a, dt, s, moving, speed) {
      const B = a.B, t = a.time, mm = a.mm, w = a.w, m = a.mountT;
      m.ph = (m.ph || 0) + dt * (moving ? Math.max(0.5, speed / 1.35) : 0) * TAU;
      const ph = m.ph, amp = w.move;
      const legs = [["fl", 0], ["br", 0], ["fr", Math.PI], ["bl", Math.PI]];
      for (const [id, off] of legs) {
        const q = ph + off + (id[0] === "b" ? 0.35 : 0);
        B["p_leg_" + id].rotation.set(-Math.sin(q) * 0.42 * amp, 0, 0);
        B["p_shin_" + id].rotation.set(Math.max(0, Math.cos(q)) * 0.8 * amp, 0, 0);
      }
      const y = (Math.abs(Math.cos(ph)) - 0.5) * 0.06 * amp;
      const roll = Math.sin(ph) * 0.035 * amp;
      const pitch = Math.sin(ph * 2) * 0.018 * amp;
      const r = a.rest.p_mount;
      B.p_mount.position.set(r.x, r.y + y, r.z);
      B.p_mount.rotation.set(pitch, 0, roll);
      const idle = 1 - amp;
      const hp = Math.sin(ph * 2 + 0.6) * 0.07 * amp + (Math.sin(t * 0.8 + a.id) * 0.5 + 0.5) * 0.18 * idle;
      B.p_chead.rotation.set(hp, Math.sin(t * 0.6 + a.id) * 0.25 * idle, Math.sin(t * 1.3 + a.id) * 0.05 * idle);
      B.p_tail.rotation.set(0.2 + Math.sin(t * 2.2) * 0.06, 0, Math.sin(t * 3.1 + a.id) * 0.4);
      B.p_bell.rotation.set(-hp * 1.3 + Math.sin(ph * 2) * 0.25 * amp, 0, Math.sin(ph) * 0.2 * amp);
      mm.y = y; mm.z = 0; mm.pitch = pitch; mm.roll = roll; mm.yaw = 0;
    },
  };

  // ---------------------------------------------------------------------------------------------
  // Cavalier sur canard : matelot (bachi à pompon rouge, marinière) sur un colvert géant
  // ---------------------------------------------------------------------------------------------
  const DSEAT = 1.05;
  T.canard = {
    label: "Cavalier sur canard",
    championLabel: "Matelot sur canard royal",
    scale: 0.98,
    p: {},
    look: {
      legOutline: false, skin: 0xf0b894, brow: 0x5a3a24, cheek: 0xff8a8a,
      shirt: 0xf2ead8, shirtPart: PART.stripes, shirtPal: PAL.navy, sleeve: 1, pants: 0x1f2a5c, pantsLen: 1, shoe: 0x18181c, glove: null,
      bachi: 0xf8f8f4, bachiBand: 0x1f2a5c, pompon: 0xe0262a,
      duck: 0xb4aea2, back: 0x7a7064, breast: 0x8a4a2a, head: 0x1f7a3a, beak: 0xf2c020, feet: 0xff8a20, wing: 0x8a8274, spec: 0x3a5ad8, dmat: MAT.satin,
    },
    champion: { look: { shirtPal: PAL.royal, bachiBand: 0x2446b8, pompon: GOLD, spec: GOLD, saddle: 0x2446b8 } },
    boss: { look: { duck: GOLD, back: 0xe8a818, breast: 0xd89a10, head: 0xf2c020, wing: 0xe8b020, dmat: MAT.gold } },
    mood: "jolly",
    motion: { gait: "ride", arms: ["neck", "neck"] },
    mount: { kind: "duck", seat: { dy: DSEAT - 0.44, dz: -0.18, thigh: -0.95, shin: 1.2, spread: 0.75, foot: 0.25, lean: 0.1 } },
    carry: { pos: [0, 2.55, 0.05], arms: ["overhead", "overhead"] },
    dims: { w: 1.35, h: 2.85, d: 2.1 },
    height: 2.85,
    center: 1.0,
    props(s) {
      const p = s.p;
      return [
        { name: "hat", parent: "head", pos: [0, p.headY + 0.3, p.headZ], build: (k, s) => {
          const top = bachi(k, s.p, s.look);
          if (s.boss) P.crown(k, { pos: [0, top - 0.02, s.p.headZ - 0.02], r: 0.3, h: 0.16, big: true });
        } },
        { name: "mount", parent: "root", pos: [0, DSEAT, -0.1], build: (k, s) => duckBody(k, s) },
        { name: "neck", parent: "p_mount", pos: [0, 0.98, 0.5], build: (k, s) => duckNeck(k, s.look) },
        { name: "dhead", parent: "p_neck", pos: [0, 1.42, 0.66], build: (k, s) => duckHead(k, s.look) },
        { name: "wing_l", parent: "p_mount", pos: [0.4, 0.98, 0.12], build: (k, s) => duckWing(k, s.look, 1) },
        { name: "wing_r", parent: "p_mount", pos: [-0.4, 0.98, 0.12], build: (k, s) => duckWing(k, s.look, -1) },
        { name: "dleg_l", parent: "p_mount", pos: [0.2, 0.44, 0.02], build: (k, s) => duckLeg(k, s.look, 1) },
        { name: "dleg_r", parent: "p_mount", pos: [-0.2, 0.44, 0.02], build: (k, s) => duckLeg(k, s.look, -1) },
        { name: "dtail", parent: "p_mount", pos: [0, 0.9, -0.74], build: (k, s) => {
          k.add(G.cone(0.2, 0.42, 6), { pos: [0, 0.98, -0.86], rot: [-2.1, 0, 0], scale: [1, 1, 0.55], color: s.boss ? GOLD : 0xf0f0ec, mat: s.look.dmat, outline: true });
          k.add(G.torus(0.07, 0.022, 3, 8, Math.PI * 1.4), { pos: [0, 1.15, -0.92], rot: [0, Math.PI / 2, 0], color: 0x18181c, mat: 2, outline: false });
        } },
      ];
    },
    build(k, s) {
      const p = s.p, L = s.look;
      A.body(k, p, L);
      // foulard de marin
      k.add(G.cone(0.14, 0.24, 3), { bone: "body", pos: [0, p.chest - 0.14, p.torsoR * p.torsoD + 0.03], rot: [Math.PI + 0.25, 0, 0], scale: [1.4, 1, 0.35], color: L.bachiBand, mat: 1, outline: false });
      if (s.champion) for (let i = 0; i < 3; i++) k.add(G.sphere(0.03, 4, 3), { bone: "body", pos: [0, p.waist + 0.14 + i * 0.12, p.torsoR * p.torsoD + 0.03], color: GOLD, mat: MAT.gold, outline: false });
    },
  };
  function bachi(k, p, L) {
    const R = p.headR * 1.04, z = p.headZ - 0.01;
    k.add(G.dome(R, 12, 4, 1.1), { pos: [0, p.headY + 0.02, z], color: L.bachi, mat: 1, outline: true });
    const yb = p.headY + 0.02 + R * Math.cos(1.1);
    k.add(G.cyl(R * Math.sin(1.1) + 0.02, R * Math.sin(1.1) + 0.02, 0.1, 12, true), { pos: [0, yb + 0.03, z], color: L.bachiBand, mat: 1, outline: false });
    k.add(G.cyl(0.54, 0.5, 0.08, 12), { pos: [0, p.headY + R - 0.02, z - 0.02], rot: [-0.12, 0, 0.1], color: L.bachi, mat: 1, outline: true });
    k.add(G.sphere(0.11, 5, 4), { pos: [0, p.headY + R + 0.06, z - 0.03], color: L.pompon, mat: L.pompon === GOLD ? MAT.gold : 1, outline: true });
    for (const sd of [1, -1]) k.add(G.box(0.07, 0.34, 0.02), { pos: [sd * 0.08, yb - 0.12, z - R * 0.95], rot: [0.2, 0, sd * 0.15], color: L.bachiBand, mat: 1, outline: false });
    return p.headY + R + 0.1;
  }
  function duckBody(k, s) {
    const L = s.look;
    k.add(G.sphere(0.5, 11, 7), { pos: [0, 0.72, -0.1], scale: [0.95, 0.7, 1.42], color: L.duck, part: s.boss ? 0 : PART.feather, pal: PAL.dusk, mat: L.dmat, outline: true });
    k.add(G.sphere(0.45, 8, 4), { pos: [0, 0.84, -0.2], scale: [0.82, 0.55, 1.15], color: L.back, mat: L.dmat, outline: false });
    k.add(G.sphere(0.35, 8, 6), { pos: [0, 0.74, 0.42], scale: [0.98, 0.98, 0.9], color: L.breast, mat: L.dmat, outline: true });
    if (L.saddle) {
      k.add(G.cyl(0.36, 0.4, 0.06, 10), { pos: [0, DSEAT - 0.02, -0.1], scale: [1, 1, 1.25], color: L.saddle, mat: 1, outline: true });
      k.add(G.torus(0.39, 0.02, 3, 12), { pos: [0, DSEAT - 0.04, -0.1], rot: [Math.PI / 2, 0, 0], scale: [1, 1.25, 1], color: GOLD, mat: MAT.gold, outline: false });
    }
  }
  function duckNeck(k, L) {
    k.add(G.cyl(0.16, 0.21, 0.56, 8, true), { pos: [0, 1.2, 0.6], rot: [0.32, 0, 0], color: L.head, mat: 2, outline: true });
    k.add(G.torus(0.2, 0.035, 3, 12), { pos: [0, 1.02, 0.54], rot: [Math.PI / 2 + 0.3, 0, 0], color: 0xf8f8f4, mat: 1, outline: false });
  }
  function duckHead(k, L) {
    k.add(G.sphere(0.27, 9, 7), { pos: [0, 1.56, 0.72], scale: [0.88, 0.95, 1.05], color: L.head, mat: L.head === 0xf2c020 ? MAT.gold : 2, outline: true });
    k.add(G.sphere(0.16, 7, 4), { pos: [0, 1.48, 1.0], scale: [0.78, 0.36, 1.28], rot: [0.18, 0, 0], color: L.beak, mat: 2, outline: true });
    k.add(G.sphere(0.04, 3, 2), { pos: [0, 1.46, 1.19], color: 0x2a2020, outline: false });
    for (const sd of [1, -1]) {
      k.add(G.sphere(0.075, 6, 4), { pos: [sd * 0.17, 1.64, 0.86], scale: [0.8, 1.1, 0.9], color: 0xffffff, part: PART.eye, mat: 2, outline: false });
      k.add(G.sphere(0.042, 4, 3), { pos: [sd * 0.2, 1.635, 0.9], color: 0x17110d, part: PART.pupil, mat: 2, outline: false });
    }
  }
  function duckWing(k, L, sd) {
    k.add(G.sphere(0.42, 7, 4), { pos: [sd * 0.44, 0.84, -0.14], rot: [0.18, 0, sd * 0.1], scale: [0.26, 0.5, 1.0], color: L.wing, mat: L.dmat, outline: true });
    k.add(G.box(0.03, 0.1, 0.26), { pos: [sd * 0.55, 0.86, -0.08], rot: [0.18, 0, sd * 0.1], color: L.spec, mat: L.spec === GOLD ? MAT.gold : 2, outline: false });
    k.add(G.box(0.032, 0.02, 0.26), { pos: [sd * 0.55, 0.92, -0.07], rot: [0.18, 0, sd * 0.1], color: 0xf8f8f4, outline: false });
  }
  function duckLeg(k, L, sd) {
    k.add(G.cyl(0.05, 0.045, 0.42, 5), { pos: [sd * 0.2, 0.24, 0.02], color: L.feet, mat: 1, outline: true });
    k.add(G.shape("webfoot", [[-0.14, 0], [0.14, 0], [0.2, 0.26], [0.07, 0.2], [0, 0.28], [-0.07, 0.2], [-0.2, 0.26]], 0.035), { pos: [sd * 0.2, 0.03, 0.02], rot: [Math.PI / 2, 0, 0], color: L.feet, mat: 1, outline: true });
  }
  MOUNTS.duck = {
    /** Canard : dandinement sur terre ; dans l'eau, le corps s'enfonce, les pattes pagaient. */
    pose(a, dt, s, moving, speed) {
      const B = a.B, t = a.time, mm = a.mm, w = a.w, m = a.mountT;
      const water = w.water, land = 1 - water;
      m.ph = (m.ph || 0) + dt * (moving ? Math.max(0.6, speed / 1.0) : 0) * TAU * (land > 0.5 ? 1 : 0.55);
      const ph = m.ph, amp = w.move;
      const roll = Math.sin(ph) * 0.15 * amp * land + Math.sin(t * 1.9 + a.id) * 0.035 * water;
      const yaw = Math.sin(ph) * 0.08 * amp * land;
      const bob = Math.abs(Math.cos(ph)) * 0.06 * amp * land + Math.sin(t * 2.4 + a.id) * 0.03 * water;
      const sink = -0.55 * water;
      const pitch = Math.sin(ph * 2) * 0.03 * amp * land + (moving ? 0.05 : 0.02) * water;
      const r = a.rest.p_mount;
      B.p_mount.position.set(r.x, r.y + bob + sink, r.z);
      B.p_mount.rotation.set(pitch, yaw, roll);
      // pattes : pas alternés à terre, pagaie vers l'arrière dans l'eau
      for (let si = 0; si < 2; si++) {
        const q = ph + (si ? Math.PI : 0);
        const stepX = -Math.sin(q) * 0.6 * amp;
        const paddle = 0.9 + Math.sin(t * 9 + si * Math.PI) * 0.5;
        B[si ? "p_dleg_r" : "p_dleg_l"].rotation.set(stepX * land + paddle * water, 0, 0);
      }
      // cou : va-et-vient du colvert en marche ; tête qui reste à peu près droite
      const nk = Math.sin(ph * 2 + 0.5) * 0.14 * amp * land + Math.sin(t * 1.3 + a.id) * 0.05;
      B.p_neck.rotation.set(nk, 0, -roll * 0.5);
      B.p_dhead.rotation.set(-nk * 0.8 - pitch, Math.sin(t * 0.9 + a.id) * 0.3 * (1 - amp), 0);
      // ailes : battent quand il a peur, s'échappe, ramasse une gemme ou prend un coup
      const flap = a.dead ? 0 : Math.max(w.fear, a.gesture === "pickup" ? 1 : 0, a.react === "escape" || a.react === "hit" || a.react === "spawn" ? 1 : 0, s.burn ? 1 : 0);
      m.flap = (m.flap || 0) + (flap - (m.flap || 0)) * Math.min(1, dt * 10);
      const f = m.flap * (0.5 + 0.5 * Math.sin(t * 22)) * 1.1 + Math.sin(ph) * 0.05 * amp;
      B.p_wing_l.rotation.set(0, 0, f);
      B.p_wing_r.rotation.set(0, 0, -f);
      B.p_dtail.rotation.set(0, Math.sin(t * 7 + a.id) * 0.25 * (0.3 + amp), 0);
      mm.y = bob + sink; mm.z = 0; mm.pitch = pitch; mm.roll = roll; mm.yaw = yaw;
    },
  };
})();
