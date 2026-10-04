// « Pas touche à mes trésors » — les cavaliers, leurs montures et les véhicules (PTMT.actors).
//
// Voleur en quad (voleur de CT : rapide), fermier sur sa vache bretonne pie noir (chevalier : lent, le
// bidon de lait sert de bouclier), matelot sur son colvert géant (valkyrie : coupe par l'eau), cycliste
// du peloton (essaim), tracteur du voisin (tank : trois agriculteurs en sautent quand il se renverse) et
// montgolfière (vole au-dessus de tout, la gemme dans la nacelle).
//
// Lisibilité vue du dessus : la monture d'abord. La vache est énorme et caricaturale (robe blanche à
// grosses taches noires, cornes en lyre, mufle rose, cloche, queue, quatre pattes qui marchent), le
// cavalier assis bien haut dessus, jambes de part et d'autre ; le quad est un vrai petit quad rouge vif
// aux grosses roues ; le canard est un colvert géant (tête verte brillante, bec jaune, collier blanc) ;
// le tracteur rouge a d'énormes roues arrière et une cheminée qui fume ; le ballon de la montgolfière
// est rayé de couleurs vives. Le cavalier est un peu réduit (spec.riderScale) pour laisser la monture
// dominer.
//
// La monture fait partie du même maillage que le cavalier (un seul appel de dessin) : ses pièces sont
// liées à des os d'accessoires (châssis, roues, guidon, pédalier ; corps, tête, pattes, queue, cloche ;
// cou, tête, ailes, pattes du canard ; ballon, brûleur, sacs de sable) que A.MOUNTS[kind].pose anime à
// chaque image. Le mouvement de la selle (rebond, tangage, roulis, enfoncement dans l'eau) est recopié
// sur le bassin du cavalier (a.mm) ; le vélo pilote aussi les jambes (pédalage, a.mm.ik).
// Boss : quad doré, cornes et cloche dorées, canard tout en or, vélo doré, tracteur à jantes d'or,
// ballon arc-en-ciel.
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
  const rod = P.rod;

  /** Hauteur de bassin (os « hips ») pour un cavalier assis en y = seat (réduit de rs autour du bassin). */
  const seatDy = (seat, rs, p) => seat - ((p && p.hip) || 0.56) - 0.02 + 0.15 * (rs || 1);

  /** Fente de la cagoule (bande de peau autour des yeux). */
  function balaclava(k, p, skin) {
    k.add(G.band(p.headR * 1.012, 12, 2, Math.PI / 2 - 1.0, 2.0, 1.12, 0.58), { bone: "head", pos: P.HC(p), scale: [1, 0.96, 0.97], color: skin, mat: 1, outline: false });
  }
  /** Sac de toile noué, dans le dos. */
  function lootSack(k, p, col) {
    k.add(G.lathe("loot", [[0.001, 0], [0.26, 0.05], [0.3, 0.26], [0.18, 0.44], [0.07, 0.52], [0.13, 0.6], [0.001, 0.62]], 7), { bone: "body", pos: [0.02, p.waist + 0.12, -p.torsoR * p.torsoD - 0.2], rot: [-0.35, 0.3, 0.12], scale: [1.1, 1, 0.8], color: col, mat: 0, outline: true, jitter: 0.04, seed: 5 });
    k.add(G.torus(0.08, 0.02, 3, 8), { bone: "body", pos: [0.02, p.waist + 0.58, -p.torsoR * p.torsoD - 0.37], rot: [Math.PI / 2 - 0.35, 0, 0], color: 0x7a5a30, outline: false });
  }
  /**
   * Roue d'axe X : pneu, moyeu, crampons (barrettes en travers de la bande de roulement) et rayons (on
   * voit la roue tourner). o : { r, w, tire, hub, hubR, lugs, lugH, lugD, spokes, spokeCol, seg, gold }
   */
  function wheel(k, c, o) {
    const rot = [0, 0, Math.PI / 2];
    k.add(G.cyl(o.r, o.r, o.w, o.seg || 12), { pos: c, rot, color: o.tire, mat: 0, outline: true });
    k.add(G.cyl(o.hubR, o.hubR, o.w + 0.03, o.hubSeg || 8), { pos: c, rot, color: o.hub, mat: o.gold ? MAT.gold : o.hubMat === undefined ? MAT.metal : o.hubMat, outline: false });
    for (let i = 0; i < (o.lugs || 0); i++) {
      const a = (i / o.lugs) * TAU;
      k.add(G.box(o.w * 0.98, o.lugH || 0.07, o.lugD || 0.11), { pos: [c[0], c[1] + Math.cos(a) * o.r, c[2] + Math.sin(a) * o.r], rot: [a, o.lugTwist ? (i % 2 ? 0.45 : -0.45) : 0, 0], color: o.tire, mat: 0, outline: false });
    }
    for (let i = 0; i < (o.spokes || 0); i++) k.add(G.box(o.w + 0.05, o.hubR * 0.32, o.hubR * 1.9), { pos: c, rot: [(i / o.spokes) * Math.PI, 0, 0], color: o.spokeCol || o.tire, mat: 1, outline: false });
  }
  A.parts.wheel = wheel;

  // ---------------------------------------------------------------------------------------------
  // Voleur en quad : cagoule, pull rayé, sac de toile, quad rouge vif aux grosses roues
  // ---------------------------------------------------------------------------------------------
  const QSEAT = 1.04, QWX = 0.68, QWZ = 0.74, QWR = 0.43;
  T.quad = {
    label: "Voleur en quad",
    championLabel: "As du quad",
    riderScale: 0.9,
    p: {},
    look: {
      legOutline: false, lite: true, skin: 0xf2c4a0, headColor: 0x1b1b20, noEars: true, cheek: null, noNose: true, brow: 0x0e0e12, browW: 1.1,
      shirt: 0x1e1e24, shirtPart: PART.stripes, shirtPal: PAL.cream, sleeve: 1,
      pants: 0x26262e, pantsLen: 1, shoe: 0xf2f2f2, sole: 0xd83020, glove: 0x1b1b20,
      body: 0xf0141e, trim: 0x2a2a30, seat: 0x1a1a1e, rim: 0xd8dde3, tire: 0x1e1e22, sack: 0xc8a36a,
    },
    champion: { look: { trim: GOLD, rim: GOLD, seat: 0x3a1a10 } },
    boss: { look: { body: GOLD, trim: 0xe8243a, seat: 0xc81e2a } },
    mood: "sly",
    motion: { gait: "ride", arms: ["drive", "drive"] },
    mount: { kind: "quad", seat: { dy: seatDy(QSEAT, 0.9), dz: -0.22, thigh: -1.25, shin: 1.35, spread: 0.42, foot: 0.25, lean: 0.34 } },
    carry: { pos: [-0.5, 2.85, 0.15], arms: ["drive", "carryUp"] },
    dims: { w: 1.75, h: 2.7, d: 2.35 },
    height: 2.72,
    center: 0.9,
    wadeDepth: 0.3,
    props(s) {
      return [
        { name: "mount", parent: "root", pos: [0, QSEAT, -0.1], build: (k, s) => quadBody(k, s.look, s.boss) },
        { name: "bars", parent: "p_mount", pos: [0, 1.22, 0.5], build: (k) => quadBars(k) },
        { name: "wheelF", parent: "root", pos: [0, QWR, QWZ], build: (k, s) => quadWheels(k, QWZ, s.look, s.boss) },
        { name: "wheelR", parent: "root", pos: [0, QWR, -QWZ], build: (k, s) => quadWheels(k, -QWZ, s.look, s.boss) },
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
    // châssis sombre, garde-boue avant et arrière larges (ils couvrent les roues), réservoir, selle
    k.add(G.rbox(0.72, 0.32, 1.5, 0.1, 1), { pos: [0, 0.6, -0.02], color: 0x2a2a30, mat: 1, outline: true });
    k.add(G.rbox(1.62, 0.17, 0.72, 0.08, 2), { pos: [0, 0.94, QWZ - 0.02], color: b, mat: mb, outline: true });
    k.add(G.rbox(1.62, 0.17, 0.72, 0.08, 2), { pos: [0, 0.94, -QWZ + 0.02], color: b, mat: mb, outline: true });
    k.add(G.rbox(0.66, 0.32, 0.6, 0.12, 2), { pos: [0, 1.0, 0.3], color: b, mat: mb, outline: true });
    k.add(G.rbox(0.78, 0.22, 0.4, 0.1, 2), { pos: [0, 0.92, 1.08], color: b, mat: mb, outline: true });
    k.add(G.rbox(0.44, 0.15, 0.84, 0.07, 2), { pos: [0, QSEAT - 0.07, -0.24], color: L.seat, mat: 1, outline: true });
    k.add(G.box(0.14, 0.025, 0.56), { pos: [0, 1.17, 0.3], color: L.trim, mat: gold ? 2 : MAT.gold, outline: false });
    // phares
    for (const sd of [1, -1]) {
      k.add(G.cyl(0.1, 0.1, 0.07, 8), { pos: [sd * 0.24, 0.94, 1.28], rot: [Math.PI / 2, 0, 0], color: 0x3a3a40, mat: MAT.metal, outline: false });
      k.add(G.cyl(0.08, 0.08, 0.02, 8), { pos: [sd * 0.24, 0.94, 1.32], rot: [Math.PI / 2, 0, 0], color: 0xfff4b0, mat: MAT.glow, outline: false });
    }
    // pare-chocs tubulaire, repose-pieds, pot d'échappement
    k.add(G.box(1.0, 0.06, 0.06), { pos: [0, 0.72, 1.3], color: 0x3a3e44, mat: MAT.metal, outline: true });
    for (const sd of [1, -1]) k.add(G.box(0.24, 0.05, 0.56), { pos: [sd * 0.46, 0.5, -0.02], color: 0x2a2a30, mat: MAT.metal, outline: false });
    k.add(G.cyl(0.07, 0.07, 0.46, 6), { pos: [-0.4, 0.66, -1.14], rot: [Math.PI / 2, 0, 0], color: 0xaab2bb, mat: MAT.metal, outline: true });
    // numéro de course sur le capot
    k.add(G.cyl(0.13, 0.13, 0.02, 10), { pos: [0, 1.04, 1.1], color: 0xfbfbf7, mat: 1, outline: false });
  }
  function quadBars(k) {
    k.add(G.cyl(0.035, 0.035, 0.36, 5), { pos: [0, 1.1, 0.46], rot: [-0.35, 0, 0], color: 0x2a2a30, mat: MAT.metal, outline: false });
    k.add(G.cyl(0.036, 0.036, 0.96, 6), { pos: [0, 1.24, 0.53], rot: [0, 0, Math.PI / 2], color: 0x8a9098, mat: MAT.metal, outline: true });
    for (const sd of [1, -1]) k.add(G.cyl(0.055, 0.055, 0.18, 6), { pos: [sd * 0.44, 1.24, 0.53], rot: [0, 0, Math.PI / 2], color: 0x1a1a1e, mat: 1, outline: true });
  }
  function quadWheels(k, z, L, gold) {
    for (const sd of [1, -1]) wheel(k, [sd * QWX, QWR, z], { r: QWR, w: 0.38, tire: L.tire, hub: L.rim, hubR: 0.22, gold, lugs: 6, lugH: 0.09, lugD: 0.13, spokes: 2, spokeCol: L.body, seg: 10 });
  }
  MOUNTS.quad = {
    /** Quad : roues selon la vitesse, suspension qui cahote, guidon qui tremble. */
    pose(a, dt, s, moving, speed) {
      const B = a.B, t = a.time, mm = a.mm, r = a.rest.p_mount;
      a.wheelA += (speed * dt) / (QWR * a.worldScale);
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
    exhaust: [-0.4, -0.38, -1.4],
  };

  // ---------------------------------------------------------------------------------------------
  // Cavalier sur vache : seau à plumet en guise de casque, bidon de lait en bouclier, aiguillon ;
  // vache bretonne pie noir énorme (robe blanche à grosses taches noires)
  // ---------------------------------------------------------------------------------------------
  const CSEAT = 1.88;
  const COW = { y: 1.24, z: -0.08, rx: 0.68, ry: 0.54, rz: 1.18 };
  T.vache = {
    label: "Cavalier sur vache",
    championLabel: "Cavalier sur vache primée",
    // la vache d'abord : tout le modèle est agrandi, le cavalier réduit d'autant
    scale: 1.12,
    riderScale: 0.78,
    p: {},
    look: {
      lite: true, skin: 0xf0b088, brow: 0x3a2414, browW: 1.2, cheek: 0xff8f7a, shirt: 0x3a6ab0, sleeve: 1, pants: 0x2a4a8a, pantsLen: 1, shoe: 0x18120e, glove: null,
      bucket: 0xc6d0da, bucketBand: 0xe0302a, plume: 0xe8262a, can: 0xdfe5ec, canBand: 0x2a5ac8,
      cow: 0xfbf7ee, muzzle: 0xf59aa8, horn: 0xf4ead0, hoof: 0x3a3036, bell: 0xe0a830, collar: 0xc0281e, blanket: 0, saddle: 0x7a4a22, mustache: 0x5a3418, udder: 0xf6a6b4,
    },
    champion: { look: { shirt: 0x2446b8, canBand: GOLD, blanket: 0xc81e2a, collar: 0x2446b8, bell: GOLD, bucketBand: GOLD, plume: 0x2446b8 } },
    boss: { look: { horn: GOLD, bell: GOLD, blanket: 0x7a1a3a, plume: GOLD } },
    mood: "stern",
    motion: { gait: "ride", arms: ["shield", "lance"] },
    mount: { kind: "cow", seat: { dy: seatDy(CSEAT, 0.78), dz: -0.22, thigh: -0.3, shin: 0.3, spread: 1.38, foot: 0.3, lean: 0.04 } },
    carry: { pos: [-0.45, 3.9, -0.1], arms: ["shield", "carryUp"] },
    dims: { w: 1.7, h: 3.7, d: 3.4 },
    height: 3.95,
    center: 1.3,
    wadeDepth: 0.55,
    tipAngle: 1.5,
    props(s) {
      const p = s.p, hl = A.handC(p, 1), hr = A.handC(p, -1);
      return [
        { name: "hat", parent: "head", pos: [0, p.headY + 0.3, p.headZ], build: (k, s) => bucket(k, s.p, s.look, s.champion, s.boss) },
        { name: "can", parent: "hand_l", pos: hl, build: (k, s) => milkCan(k, hl, s.look) },
        { name: "lance", parent: "hand_r", pos: hr, build: (k) => {
          k.add(G.cyl(0.032, 0.032, 2.1, 5), { pos: [hr[0], hr[1] + 0.4, hr[2]], color: 0xa0703a, mat: 1, outline: true });
          k.add(G.cone(0.06, 0.2, 4), { pos: [hr[0], hr[1] + 1.55, hr[2]], color: 0xc8d0d8, mat: MAT.metal, outline: true });
        } },
        { name: "mount", parent: "root", pos: [0, CSEAT, -0.1], build: (k, s) => cowBody(k, s) },
        { name: "chead", parent: "p_mount", pos: [0, 1.46, 0.95], build: (k, s) => cowHead(k, s.look, s.boss) },
        { name: "bell", parent: "p_chead", pos: [0, 1.12, 1.24], build: (k, s) => cowBell(k, s.look, s.boss) },
        { name: "tail", parent: "p_mount", pos: [0, 1.6, -1.22], build: (k, s) => {
          k.add(G.tube("cowtail2", [[0, 1.6, -1.22], [0, 1.45, -1.38], [0, 1.12, -1.46], [0, 0.84, -1.44]], 0.04, 5, 3), { color: s.look.cow, mat: 1, outline: true });
          k.add(G.sphere(0.11, 4, 3), { pos: [0, 0.78, -1.44], scale: [0.8, 1.4, 0.8], color: 0x1c1a1e, mat: 1, outline: true });
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
        [0x2446b8, 0xf4f4f0, 0xe0262a].forEach((c, i) => k.add(G.torus(p.torsoR * 1.12, 0.03, 3, 8), { bone: "body", pos: [0.0, p.waist + 0.3, 0], rot: [0, 0, 0.75 + (i - 1) * 0.07], scale: [1, 1.15, p.torsoD * 1.25], color: c, mat: 1, outline: false }));
      }
    },
    animate(a) {
      a.hold("can", 0, 0, -0.35, 0);
      a.hold("lance", 1, 1.2, 0, 0.12);
    },
  };
  function bucket(k, p, L, gold, boss) {
    const y0 = p.headY + 0.1, z = p.headZ - 0.01;
    k.add(G.cyl(0.38, 0.5, 0.54, 10, true), { pos: [0, y0 + 0.27, z], color: L.bucket, mat: MAT.metal, outline: true });
    k.add(G.cyl(0.38, 0.38, 0.02, 10), { pos: [0, y0 + 0.54, z], color: shade(L.bucket, 0.85), mat: MAT.metal, outline: false });
    k.add(G.cyl(0.47, 0.49, 0.1, 10, true), { pos: [0, y0 + 0.12, z], color: L.bucketBand, mat: gold ? MAT.gold : 2, outline: false });
    k.add(G.torus(0.385, 0.03, 3, 8), { pos: [0, y0 + 0.54, z], rot: [Math.PI / 2, 0, 0], color: shade(L.bucket, 1.12), mat: MAT.metal, outline: false });
    // l'anse sert de jugulaire
    k.add(G.torus(0.49, 0.02, 3, 12, Math.PI), { pos: [0, y0 + 0.05, z + 0.06], rot: [0.25, 0, Math.PI], color: 0x6a7078, mat: MAT.metal, outline: false });
    // plumet de chevalier (bien visible de haut)
    if (!boss) {
      k.add(G.cyl(0.04, 0.05, 0.12, 5), { pos: [0, y0 + 0.6, z], color: 0x8a9098, mat: MAT.metal, outline: false });
      k.add(G.sphere(0.2, 5, 4), { pos: [0, y0 + 0.74, z - 0.12], rot: [-0.5, 0, 0], scale: [0.7, 1.15, 1.35], color: L.plume, mat: 1, outline: true });
      return y0 + 0.92;
    }
    P.crown(k, { pos: [0, y0 + 0.5, z], r: 0.33, h: 0.17, big: true });
    return y0 + 0.9;
  }
  function milkCan(k, hc, L) {
    const [x, y, z] = hc;
    k.add(G.lathe("milkcan", [[0.001, -0.34], [0.23, -0.32], [0.23, 0.1], [0.1, 0.24], [0.1, 0.3], [0.14, 0.34], [0.001, 0.37]], 7), { pos: [x + 0.06, y + 0.02, z + 0.06], scale: 1.15, color: L.can, mat: MAT.metal, outline: true });
    k.add(G.cyl(0.27, 0.27, 0.11, 8, true), { pos: [x + 0.06, y - 0.08, z + 0.06], color: L.canBand, mat: L.canBand === GOLD ? MAT.gold : 2, outline: false });
  }
  /** Os des pattes : haut (épaule / hanche) et bas (genou / jarret), plus le sabot. */
  function cowLegs() {
    const out = [];
    for (const [id, x, z] of [["fl", 0.4, 0.62], ["fr", -0.4, 0.62], ["bl", 0.4, -0.74], ["br", -0.4, -0.74]]) {
      out.push({ name: "leg_" + id, parent: "p_mount", pos: [x, 1.0, z], build: (k, s) => {
        const a = [x, 1.08, z], e = [x * 1.03, 0.52, z + 0.03], b = [x * 1.03, 0.14, z];
        k.add(A.limbGeo("cowleg2" + id, [a, e, b], 0.18, 0.13, [[0, s.look.cow]], 4, 2), { colors: true, weights: A.limbWeights(a, e, b, "p_leg_" + id, "p_shin_" + id, 0.08), outline: true });
        k.add(G.cyl(0.13, 0.15, 0.16, 5), { bone: "p_shin_" + id, pos: [x * 1.03, 0.08, z + 0.01], color: s.look.hoof, mat: 1, outline: false });
      } });
      out.push({ name: "shin_" + id, parent: "p_leg_" + id, pos: [x * 1.03, 0.52, z + 0.03] });
    }
    return out;
  }
  function cowBody(k, s) {
    const L = s.look;
    // corps : robe pie noir calculée dans le shader (taches différentes pour chaque vache)
    k.add(G.sphere(0.5, 11, 7), { pos: [0, COW.y, COW.z], scale: [COW.rx * 2, COW.ry * 2, COW.rz * 2], color: L.cow, part: PART.pie, pal: PAL.ink, mat: 1, outline: true });
    // pis rose (on ne le voit que de profil)
    k.add(G.sphere(0.2, 5, 3), { pos: [0, 0.78, -0.58], scale: [1.1, 0.8, 1.0], color: L.udder, mat: 1, outline: false });
    // selle de cuir étroite (les jambes du cavalier débordent de chaque côté) et sangle sous le ventre
    k.add(G.rbox(0.46, 0.12, 0.66, 0.05, 1), { pos: [0, CSEAT - 0.06, -0.2], color: L.saddle, mat: 1, outline: true });
    k.add(G.cyl(COW.rx + 0.015, COW.rx + 0.015, 0.12, 12, true, -1.9, 3.8), { pos: [0, COW.y, -0.2], rot: [Math.PI / 2, 0, 0], scale: [1, 1, COW.ry / COW.rx], color: L.saddle, mat: 1, outline: false });
    if (L.blanket) {
      // couverture de selle (champion, boss) : drapé sur le dos, franges dorées sur les flancs
      k.add(G.cyl(COW.rx + 0.03, COW.rx + 0.03, 0.85, 10, true, Math.PI - 1.25, 2.5), { pos: [0, COW.y + 0.02, -0.2], rot: [Math.PI / 2, 0, 0], scale: [1, 1, COW.ry / COW.rx + 0.04], color: L.blanket, mat: 1, outline: true });
      for (const sd of [1, -1]) k.add(G.box(0.05, 0.06, 0.88), { pos: [sd * 0.64, COW.y + 0.2, -0.2], color: GOLD, mat: MAT.gold, outline: false });
    }
    if (s.champion && !s.boss) P.rosette(k, "p_mount", [0.5, 1.5, 0.55], 1.5);
  }
  function cowHead(k, L, gold) {
    // grosse tête blanche, tache noire autour d'un œil, grand mufle rose, oreilles, cornes en lyre
    k.add(G.sphere(0.4, 9, 6), { pos: [0, 1.64, 1.42], scale: [0.95, 0.86, 1.12], color: L.cow, mat: 1, outline: true });
    k.add(G.sphere(0.24, 6, 4), { pos: [0.17, 1.76, 1.6], scale: [1.05, 1.0, 0.75], rot: [0, 0.4, 0], color: 0x1c1a1e, mat: 1, outline: false });
    k.add(G.sphere(0.3, 7, 5), { pos: [0, 1.5, 1.86], scale: [1.18, 0.8, 0.78], color: L.muzzle, mat: 1, outline: true });
    for (const sd of [1, -1]) {
      k.add(G.sphere(0.055, 4, 2), { pos: [sd * 0.13, 1.53, 2.08], scale: [1, 1.3, 0.6], color: 0x7a2a3a, outline: false });
      // grands yeux de dessin animé, sur le dessus de la tête (on les voit d'en haut)
      k.add(G.sphere(0.13, 5, 4), { pos: [sd * 0.2, 1.84, 1.66], scale: [0.95, 1.1, 0.8], color: 0xffffff, part: PART.eye, mat: 2, outline: false });
      k.add(G.sphere(0.07, 4, 3), { pos: [sd * 0.21, 1.83, 1.75], color: 0x17110d, part: PART.pupil, mat: 2, outline: false });
      // oreilles tendues de côté (dessous rose)
      k.add(G.sphere(0.17, 5, 3), { pos: [sd * 0.5, 1.72, 1.32], rot: [0, 0, sd * -0.35], scale: [1.3, 0.48, 0.8], color: L.cow, mat: 1, outline: true });
      const h0 = [sd * 0.2, 1.92, 1.36], h1 = [sd * 0.5, 2.0, 1.33], h2 = [sd * 0.7, 2.26, 1.28], h3 = [sd * 0.6, 2.52, 1.32];
      k.add(A.limbGeo("horn2" + sd, [h0, h1, h2, h3], 0.085, 0.03, [[0, L.horn], [0.8, 0x3a3030]], 4, 3), { colors: true, mat: L.horn === GOLD ? MAT.gold : 2, outline: true });
    }
    // toupet noir entre les cornes
    k.add(G.cone(0.13, 0.22, 5), { pos: [0, 2.0, 1.4], rot: [0.5, 0, 0], color: 0x1c1a1e, mat: 1, outline: false });
    void gold;
  }
  function cowBell(k, L, gold) {
    k.add(G.torus(0.42, 0.06, 3, 10), { bone: "p_chead", pos: [0, 1.42, 1.08], rot: [Math.PI / 2 + 0.5, 0, 0], color: L.collar, mat: 1, outline: false });
    k.add(G.lathe("bell2", [[0.001, -0.15], [0.19, -0.15], [0.11, 0.08], [0.001, 0.15]], 7), { pos: [0, 0.98, 1.3], color: L.bell, mat: gold || L.bell === GOLD ? MAT.gold : MAT.metal, outline: true });
    k.add(G.sphere(0.05, 3, 2), { pos: [0, 0.82, 1.3], color: 0x3a3030, outline: false });
  }
  MOUNTS.cow = {
    /** Vache : pas croisés (diagonales), dos qui roule, tête qui dodeline, queue, cloche. */
    pose(a, dt, s, moving, speed) {
      const B = a.B, t = a.time, mm = a.mm, w = a.w, m = a.mountT;
      m.ph = (m.ph || 0) + dt * (moving ? Math.max(0.5, speed / (1.7 * a.worldScale)) : 0) * TAU;
      const ph = m.ph, amp = w.move;
      const legs = [["fl", 0], ["br", 0], ["fr", Math.PI], ["bl", Math.PI]];
      for (const [id, off] of legs) {
        const q = ph + off + (id[0] === "b" ? 0.35 : 0);
        B["p_leg_" + id].rotation.set(-Math.sin(q) * 0.4 * amp, 0, 0);
        B["p_shin_" + id].rotation.set(Math.max(0, Math.cos(q)) * 0.75 * amp, 0, 0);
      }
      const y = (Math.abs(Math.cos(ph)) - 0.5) * 0.07 * amp;
      const roll = Math.sin(ph) * 0.04 * amp;
      const pitch = Math.sin(ph * 2) * 0.02 * amp;
      const r = a.rest.p_mount;
      B.p_mount.position.set(r.x, r.y + y, r.z);
      B.p_mount.rotation.set(pitch, 0, roll);
      const idle = 1 - amp;
      const hp = Math.sin(ph * 2 + 0.6) * 0.08 * amp + (Math.sin(t * 0.8 + a.id) * 0.5 + 0.5) * 0.2 * idle;
      B.p_chead.rotation.set(hp, Math.sin(t * 0.6 + a.id) * 0.3 * idle + Math.sin(ph) * 0.08 * amp, Math.sin(t * 1.3 + a.id) * 0.06 * idle);
      B.p_tail.rotation.set(0.15 + Math.sin(t * 2.2) * 0.08, 0, Math.sin(t * 3.1 + a.id) * 0.45);
      B.p_bell.rotation.set(-hp * 1.3 + Math.sin(ph * 2) * 0.3 * amp, 0, Math.sin(ph) * 0.25 * amp);
      mm.y = y; mm.z = 0; mm.pitch = pitch; mm.roll = roll; mm.yaw = 0;
    },
  };

  // ---------------------------------------------------------------------------------------------
  // Cavalier sur canard : matelot (bachi à pompon rouge, marinière) sur un colvert géant
  // ---------------------------------------------------------------------------------------------
  const DSEAT = 1.52;
  T.canard = {
    label: "Cavalier sur canard",
    championLabel: "Matelot sur canard royal",
    scale: 1.08,
    riderScale: 0.8,
    p: {},
    look: {
      legOutline: false, lite: true, skin: 0xf0b894, brow: 0x5a3a24, cheek: 0xff8a8a,
      shirt: 0xf2ead8, shirtPart: PART.stripes, shirtPal: PAL.navy, sleeve: 1, pants: 0x1f2a5c, pantsLen: 1, shoe: 0x18181c, glove: null,
      bachi: 0xf8f8f4, bachiBand: 0x1f2a5c, pompon: 0xe0262a,
      duck: 0xbcb4a6, back: 0x76695a, breast: 0x8a3e20, head: 0x0c9a40, beak: 0xffc818, feet: 0xff8a1a, wing: 0x8c8476, spec: 0x2a5ae0, tail: 0xf4f4f0, dmat: MAT.satin,
    },
    champion: { look: { shirtPal: PAL.royal, bachiBand: 0x2446b8, pompon: GOLD, spec: GOLD, saddle: 0x2446b8 } },
    boss: { look: { duck: GOLD, back: 0xe8a818, breast: 0xd89a10, head: 0xf2c020, wing: 0xe8b020, tail: GOLD, dmat: MAT.gold } },
    mood: "jolly",
    motion: { gait: "ride", arms: ["neck", "neck"] },
    mount: { kind: "duck", seat: { dy: seatDy(DSEAT, 0.8), dz: -0.3, thigh: -0.85, shin: 1.05, spread: 1.0, foot: 0.25, lean: 0.12 } },
    carry: { pos: [0, 3.55, -0.2], arms: ["overhead", "overhead"] },
    dims: { w: 1.6, h: 3.3, d: 2.9 },
    height: 3.3,
    center: 1.0,
    props(s) {
      const p = s.p;
      return [
        { name: "hat", parent: "head", pos: [0, p.headY + 0.3, p.headZ], build: (k, s) => {
          const top = bachi(k, s.p, s.look);
          if (s.boss) P.crown(k, { pos: [0, top - 0.02, s.p.headZ - 0.02], r: 0.3, h: 0.16, big: true });
        } },
        { name: "mount", parent: "root", pos: [0, DSEAT, -0.1], build: (k, s) => duckBody(k, s) },
        { name: "neck", parent: "p_mount", pos: [0, 1.32, 0.78], build: (k, s) => duckNeck(k, s.look) },
        { name: "dhead", parent: "p_neck", pos: [0, 2.0, 1.0], build: (k, s) => duckHead(k, s.look) },
        { name: "wing_l", parent: "p_mount", pos: [0.58, 1.3, 0.2], build: (k, s) => duckWing(k, s.look, 1) },
        { name: "wing_r", parent: "p_mount", pos: [-0.58, 1.3, 0.2], build: (k, s) => duckWing(k, s.look, -1) },
        { name: "dleg_l", parent: "p_mount", pos: [0.27, 0.62, 0.06], build: (k, s) => duckLeg(k, s.look, 1) },
        { name: "dleg_r", parent: "p_mount", pos: [-0.27, 0.62, 0.06], build: (k, s) => duckLeg(k, s.look, -1) },
        { name: "dtail", parent: "p_mount", pos: [0, 1.15, -1.1], build: (k, s) => {
          k.add(G.cone(0.3, 0.6, 6), { pos: [0, 1.28, -1.3], rot: [-2.05, 0, 0], scale: [1.1, 1, 0.5], color: s.look.tail, mat: s.look.dmat, outline: true });
          k.add(G.torus(0.1, 0.03, 3, 8, Math.PI * 1.4), { pos: [0, 1.52, -1.32], rot: [0, Math.PI / 2, 0], color: 0x18181c, mat: 2, outline: false });
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
    k.add(G.cyl(0.56, 0.52, 0.08, 12), { pos: [0, p.headY + R - 0.02, z - 0.02], rot: [-0.12, 0, 0.1], color: L.bachi, mat: 1, outline: true });
    k.add(G.sphere(0.14, 6, 4), { pos: [0, p.headY + R + 0.08, z - 0.03], color: L.pompon, mat: L.pompon === GOLD ? MAT.gold : 1, outline: true });
    for (const sd of [1, -1]) k.add(G.box(0.07, 0.34, 0.02), { pos: [sd * 0.08, yb - 0.12, z - R * 0.95], rot: [0.2, 0, sd * 0.15], color: L.bachiBand, mat: 1, outline: false });
    return p.headY + R + 0.12;
  }
  function duckBody(k, s) {
    const L = s.look;
    k.add(G.sphere(0.5, 11, 7), { pos: [0, 1.0, -0.15], scale: [1.38, 1.04, 2.1], color: L.duck, part: s.boss ? 0 : PART.feather, pal: PAL.dusk, mat: L.dmat, outline: true });
    k.add(G.sphere(0.45, 8, 4), { pos: [0, 1.18, -0.34], scale: [1.18, 0.74, 1.75], color: L.back, mat: L.dmat, outline: false });
    k.add(G.sphere(0.5, 8, 5), { pos: [0, 1.02, 0.6], scale: [1.0, 1.0, 0.88], color: L.breast, mat: L.dmat, outline: true });
    if (L.saddle) {
      k.add(G.cyl(0.4, 0.44, 0.07, 10), { pos: [0, DSEAT - 0.02, -0.3], scale: [1, 1, 1.25], color: L.saddle, mat: 1, outline: true });
      k.add(G.torus(0.43, 0.025, 3, 12), { pos: [0, DSEAT - 0.04, -0.3], rot: [Math.PI / 2, 0, 0], scale: [1, 1.25, 1], color: GOLD, mat: MAT.gold, outline: false });
    }
  }
  function duckNeck(k, L) {
    rod(k, [0, 1.3, 0.76], [0, 2.02, 0.98], 0.23, L.head, { mat: L.head === 0xf2c020 ? MAT.gold : 2, outline: true, seg: 9 });
    k.add(G.torus(0.24, 0.05, 4, 12), { pos: [0, 1.5, 0.83], rot: [Math.PI / 2 + 0.3, 0, 0], color: 0xfbfbf7, mat: 1, outline: true });
  }
  function duckHead(k, L) {
    const gold = L.head === 0xf2c020;
    k.add(G.sphere(0.4, 9, 7), { pos: [0, 2.18, 1.06], scale: [0.88, 0.92, 1.05], color: L.head, mat: gold ? MAT.gold : 2, outline: true });
    k.add(G.sphere(0.26, 7, 4), { pos: [0, 2.08, 1.52], scale: [0.82, 0.32, 1.3], rot: [0.12, 0, 0], color: L.beak, mat: 2, outline: true });
    k.add(G.sphere(0.06, 4, 2), { pos: [0, 2.05, 1.84], scale: [1.3, 0.6, 0.8], color: 0x2a2020, outline: false });
    for (const sd of [1, -1]) {
      k.add(G.sphere(0.11, 5, 4), { pos: [sd * 0.22, 2.3, 1.26], scale: [0.85, 1.1, 0.85], color: 0xffffff, part: PART.eye, mat: 2, outline: false });
      k.add(G.sphere(0.06, 4, 3), { pos: [sd * 0.25, 2.3, 1.32], color: 0x17110d, part: PART.pupil, mat: 2, outline: false });
    }
  }
  function duckWing(k, L, sd) {
    // aile repliée le long du flanc, pointe relevée vers la queue, miroir bleu bordé de blanc
    k.add(G.sphere(0.5, 7, 4), { pos: [sd * 0.55, 1.16, -0.34], rot: [-0.16, 0, sd * 0.1], scale: [0.26, 0.56, 1.85], color: L.wing, mat: L.dmat, outline: true });
    k.add(G.box(0.04, 0.15, 0.42), { pos: [sd * 0.66, 1.21, -0.18], rot: [-0.16, 0, sd * 0.1], color: L.spec, mat: L.spec === GOLD ? MAT.gold : 2, outline: false });
    k.add(G.box(0.042, 0.035, 0.42), { pos: [sd * 0.66, 1.3, -0.16], rot: [-0.16, 0, sd * 0.1], color: 0xf8f8f4, outline: false });
  }
  function duckLeg(k, L, sd) {
    k.add(G.cyl(0.07, 0.06, 0.6, 5), { pos: [sd * 0.27, 0.34, 0.06], color: L.feet, mat: 1, outline: true });
    k.add(G.shape("webfoot2", [[-0.2, 0], [0.2, 0], [0.28, 0.38], [0.1, 0.3], [0, 0.4], [-0.1, 0.3], [-0.28, 0.38]], 0.045), { pos: [sd * 0.27, 0.04, 0.04], rot: [Math.PI / 2, 0, 0], color: L.feet, mat: 1, outline: true });
  }
  MOUNTS.duck = {
    /** Canard : dandinement sur terre ; dans l'eau, le corps s'enfonce, les pattes pagaient. */
    pose(a, dt, s, moving, speed) {
      const B = a.B, t = a.time, mm = a.mm, w = a.w, m = a.mountT;
      const water = w.water, land = 1 - water;
      m.ph = (m.ph || 0) + dt * (moving ? Math.max(0.6, speed / (1.2 * a.worldScale)) : 0) * TAU * (land > 0.5 ? 1 : 0.55);
      const ph = m.ph, amp = w.move;
      const roll = Math.sin(ph) * 0.14 * amp * land + Math.sin(t * 1.9 + a.id) * 0.035 * water;
      const yaw = Math.sin(ph) * 0.08 * amp * land;
      const bob = Math.abs(Math.cos(ph)) * 0.07 * amp * land + Math.sin(t * 2.4 + a.id) * 0.03 * water;
      const sink = -0.62 * water;
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

  // ---------------------------------------------------------------------------------------------
  // Cycliste du peloton : maillot jaune ou à pois (selon le coureur), casque, lunettes, dossard, vélo de
  // course dont les roues et le pédalier tournent ; couché sur le guidon. Champion : maillot arc-en-ciel
  // (champion du monde) ; boss : « Le Maillot jaune » sur un vélo doré.
  // ---------------------------------------------------------------------------------------------
  const BSEAT = 0.94, BWR = 0.43, BWZF = 0.72, BWZR = -0.64, BB = [0, 0.52, -0.02], CRANK = 0.16;
  const BIKE_P = { hip: 0.7, knee: 0.4, ankle: 0.1, legR: 0.085, foot: [0.2, 0.13, 0.36] };
  T.cycliste = {
    label: "Cycliste du peloton",
    championLabel: "Champion du monde",
    p: BIKE_P,
    look: {
      legOutline: false, lite: true, skin: 0xe8a878, brow: 0x3a2414, browW: 1.1, cheek: 0xff7a6a,
      shirt: 0xffd21a, shirtPart: PART.jersey, sleevePart: PART.jersey, shirtPal: PAL.scarlet, sleeve: 0.34,
      pants: 0x18181c, legStops: [[0, 0x18181c], [0.48, 0xe8a878], [0.8, 0xfbfbf7]], shoe: 0xfbfbf7, sole: 0x18181c, glove: 0x18181c,
      helmet: 0xffd21a, helmetPart: PART.jersey, frame: 0xe0302a, tire: 0x1a1a1e, rim: 0x2a2a30, spoke: 0xd8dde3, bar: 0x2a2a30,
      shades: 0x101418, bib: 0xfbfbf7,
    },
    champion: { look: { shirt: 0xfbfbf7, shirtPart: 0, sleevePart: 0, helmet: 0xfbfbf7, helmetPart: 0, frame: 0x1f2a5c, rainbow: true, rim: GOLD } },
    boss: { look: { shirt: 0xffd21a, shirtPart: 0, sleevePart: 0, helmet: GOLD, helmetPart: 0, frame: GOLD, rainbow: false, rim: GOLD, spoke: GOLD } },
    mood: "effort",
    motion: { gait: "ride", arms: ["bars", "bars"] },
    mount: { kind: "bike", seat: { dy: seatDy(BSEAT, 1, BIKE_P), dz: -0.28, thigh: -1.0, shin: 1.2, spread: 0.08, foot: 0.2, hipPitch: 0.42, lean: 0.72, head: -0.95 } },
    carry: { pos: [-0.35, 2.75, 0.45], arms: ["bars", "carryUp"] },
    dims: { w: 1.1, h: 2.4, d: 2.3 },
    height: 2.35,
    center: 0.9,
    wadeDepth: 0.3,
    tipAngle: 1.45,
    props(s) {
      const p = s.p;
      return [
        { name: "hat", parent: "head", pos: [0, p.headY + 0.3, p.headZ], build: (k, s) => {
          const top = bikeHelmet(k, s.p, s.look);
          if (s.boss) P.crown(k, { pos: [0, top - 0.08, s.p.headZ - 0.06], r: 0.28, h: 0.15, big: true });
        } },
        { name: "mount", parent: "root", pos: [0, BSEAT, -0.1], build: (k, s) => bikeFrame(k, s.look, s.boss) },
        { name: "wheelF", parent: "p_mount", pos: [0, BWR, BWZF], build: (k, s) => bikeWheel(k, BWZF, s.look) },
        { name: "wheelR", parent: "p_mount", pos: [0, BWR, BWZR], build: (k, s) => bikeWheel(k, BWZR, s.look) },
        { name: "crank", parent: "p_mount", pos: BB.slice(), build: (k, s) => bikeCrank(k, s.look, s.boss) },
      ];
    },
    build(k, s) {
      const p = s.p, L = s.look;
      A.body(k, p, L);
      // lunettes de soleil enveloppantes
      k.add(G.band(p.headR * 1.04, 12, 2, Math.PI / 2 - 0.85, 1.7, 1.38, 0.3), { bone: "head", pos: P.HC(p), scale: [1, 0.96, 0.97], color: L.shades, mat: MAT.glass, outline: true });
      // dossard dans le dos (on le voit d'en haut, le coureur est couché sur le vélo)
      k.add(G.rbox(0.34, 0.3, 0.03, 0.03, 1), { bone: "body", pos: [0, p.waist + 0.36, -p.torsoR * p.torsoD - 0.02], color: L.bib, mat: 1, outline: true });
      for (const dx of [-0.06, 0.06]) k.add(G.box(0.05, 0.17, 0.02), { bone: "body", pos: [dx, p.waist + 0.36, -p.torsoR * p.torsoD - 0.04], color: 0x18181c, outline: false });
      if (L.rainbow) {
        // maillot de champion du monde : bandes arc-en-ciel sur la poitrine
        [0x2446d8, 0xe0262a, 0x18181c, 0xffcf1f, 0x22a83c].forEach((c, i) => {
          const y = p.waist + 0.38 + i * 0.065;
          const r = p.torsoR * (1.06 - Math.max(0, i - 2) * 0.03);
          k.add(G.cyl(r, r, 0.06, 12, true), { bone: "body", pos: [0, y, 0], scale: [1, 1, p.torsoD + 0.04], color: c, mat: 1, outline: false });
        });
      }
    },
    animate(a) {
      // tête relevée pour regarder la route (il est couché sur le guidon)
      void a;
    },
  };
  function bikeHelmet(k, p, L) {
    const bone = "p_hat", R = p.headR * 1.1, z = p.headZ - 0.06;
    // casque profilé, allongé vers l'arrière, aérations sombres
    k.add(G.dome(R, 12, 5, 1.45), { bone, pos: [0, p.headY + 0.02, z], scale: [0.96, 0.82, 1.22], color: L.helmet, part: L.helmetPart || 0, pal: PAL.scarlet, mat: L.helmet === GOLD ? MAT.gold : 2, outline: true });
    for (const dx of [-0.16, 0, 0.16]) k.add(G.box(0.06, 0.04, 0.5), { bone, pos: [dx, p.headY + R * 0.78, z - 0.02], rot: [0.1, 0, 0], color: 0x18181c, outline: false });
    k.add(G.cone(0.18, 0.35, 6), { bone, pos: [0, p.headY + 0.12, z - R * 1.12], rot: [-Math.PI / 2 - 0.35, 0, 0], scale: [1.2, 1, 0.5], color: L.helmet, mat: L.helmet === GOLD ? MAT.gold : 2, outline: true });
    return p.headY + R * 0.82 + 0.04;
  }
  function bikeFrame(k, L, gold) {
    const fm = gold ? MAT.gold : 2, c = L.frame;
    const ST = [0, 0.9, -0.28], HT = [0, 0.9, 0.52], HB = [0, 0.72, 0.56], RA = BWZR, FA = BWZF;
    rod(k, BB, ST, 0.04, c, { mat: fm, outline: true });
    rod(k, ST, HT, 0.036, c, { mat: fm, outline: true });
    rod(k, BB, HB, 0.045, c, { mat: fm, outline: true });
    rod(k, HB, HT, 0.045, c, { mat: fm, outline: false });
    for (const sd of [1, -1]) {
      rod(k, [sd * 0.05, BB[1], BB[2]], [sd * 0.06, BWR, RA], 0.025, c, { mat: fm, outline: false });
      rod(k, [sd * 0.03, ST[1] - 0.05, ST[2]], [sd * 0.06, BWR, RA], 0.022, c, { mat: fm, outline: false });
      rod(k, [sd * 0.03, HB[1], HB[2]], [sd * 0.05, BWR, FA], 0.028, c, { mat: fm, outline: true });
    }
    // selle, tige de selle, potence et cintre à crochets
    rod(k, ST, [0, BSEAT - 0.03, -0.32], 0.025, 0x8a9098, { mat: MAT.metal, outline: false });
    k.add(G.rbox(0.14, 0.06, 0.3, 0.03, 1), { pos: [0, BSEAT - 0.02, -0.32], color: 0x18181c, mat: 1, outline: true });
    rod(k, HT, [0, 0.95, 0.62], 0.025, L.bar, { mat: MAT.metal, outline: false });
    k.add(G.cyl(0.024, 0.024, 0.44, 5), { pos: [0, 0.95, 0.63], rot: [0, 0, Math.PI / 2], color: L.bar, mat: 1, outline: true });
    for (const sd of [1, -1]) k.add(G.tube("drop2" + sd, [[sd * 0.21, 0.95, 0.63], [sd * 0.21, 0.91, 0.73], [sd * 0.21, 0.81, 0.72], [sd * 0.21, 0.79, 0.62]], 0.026, 5, 4), { color: L.bar, mat: 1, outline: true });
    // bidon sur le tube oblique
    k.add(G.cyl(0.05, 0.05, 0.2, 6), { pos: [0, 0.66, 0.2], rot: [0.95, 0, 0], color: gold ? 0xfbfbf7 : 0x2a8ad8, mat: 2, outline: false });
  }
  function bikeWheel(k, z, L) {
    const c = [0, BWR, z];
    k.add(G.torus(BWR - 0.03, 0.035, 4, 14), { pos: c, rot: [0, Math.PI / 2, 0], color: L.tire, mat: 1, outline: true });
    k.add(G.torus(BWR - 0.075, 0.018, 3, 12), { pos: c, rot: [0, Math.PI / 2, 0], color: L.rim, mat: L.rim === GOLD ? MAT.gold : MAT.metal, outline: false });
    // trois bâtons (roue à bâtons : on la voit tourner)
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU;
      k.add(G.box(0.025, BWR - 0.08, 0.05), { pos: [0, c[1] + Math.cos(a) * (BWR - 0.08) * 0.5, c[2] + Math.sin(a) * (BWR - 0.08) * 0.5], rot: [a, 0, 0], color: L.spoke, mat: L.spoke === GOLD ? MAT.gold : 2, outline: false });
    }
    k.add(G.cyl(0.04, 0.04, 0.1, 6), { pos: c, rot: [0, 0, Math.PI / 2], color: 0x8a9098, mat: MAT.metal, outline: false });
  }
  function bikeCrank(k, L, gold) {
    const [x, y, z] = BB;
    k.add(G.torus(0.13, 0.022, 3, 12), { pos: [x - 0.07, y, z], rot: [0, Math.PI / 2, 0], color: gold ? GOLD : 0xc8ced6, mat: gold ? MAT.gold : MAT.metal, outline: false });
    for (const sd of [1, -1]) {
      // manivelle et pédale (opposées)
      k.add(G.box(0.03, CRANK, 0.04), { pos: [sd * 0.1, y - sd * CRANK * 0.5, z], color: 0x3a3e44, mat: MAT.metal, outline: false });
      k.add(G.box(0.12, 0.03, 0.08), { pos: [sd * 0.16, y - sd * CRANK, z], color: 0x18181c, mat: 1, outline: false });
    }
    void L;
  }
  /** Pédalage : jambes calculées par cinématique inverse (hanche → pédale) dans le plan du vélo. */
  function legIK(hy, hz, py, pz, L1, L2, out, o) {
    let dy = py - hy, dz = pz - hz;
    let D = Math.hypot(dy, dz);
    const Dmax = L1 + L2 - 1e-3, Dmin = Math.abs(L1 - L2) + 1e-3;
    if (D > Dmax) { dy *= Dmax / D; dz *= Dmax / D; D = Dmax; }
    if (D < Dmin) D = Dmin;
    const ad = Math.atan2(-dz, -dy); // angle de la direction hanche → pédale (0 : droit en bas, < 0 : vers l'avant)
    const al = Math.acos(clamp((L1 * L1 + D * D - L2 * L2) / (2 * L1 * D), -1, 1));
    const ga = Math.acos(clamp((L1 * L1 + L2 * L2 - D * D) / (2 * L1 * L2), -1, 1));
    const th = ad - al, kn = Math.PI - ga;
    out[o] = th;
    out[o + 1] = kn;
    out[o + 2] = -(th + kn) * 0.6 + 0.15;
  }
  MOUNTS.bike = {
    /** Vélo : roues et pédalier tournent avec la vitesse, jambes sur les pédales, danseuse en côte. */
    pose(a, dt, s, moving, speed) {
      const B = a.B, t = a.time, mm = a.mm, m = a.mountT, p = a.spec.p, st = a.spec.mount.seat;
      const ws = a.worldScale;
      a.wheelA += (speed * dt) / (BWR * ws);
      B.p_wheelF.rotation.set(a.wheelA, 0, 0);
      B.p_wheelR.rotation.set(a.wheelA, 0, 0);
      // pédalier : un tour pour ~2,6 tours de roue, un peu de moulinette même au ralenti
      m.crank = (m.crank || 0) + dt * (moving ? Math.max(2.5, (speed / (BWR * ws)) / 2.6) : 0);
      const c = m.crank;
      B.p_crank.rotation.set(c, 0, 0);
      // roulis de danseuse, léger tangage
      const k = Math.min(1, speed / 6);
      const roll = moving ? Math.sin(c) * 0.06 * (0.3 + k) : 0;
      const y = moving ? Math.abs(Math.sin(c)) * 0.01 : 0;
      const r = a.rest.p_mount;
      B.p_mount.position.set(r.x, r.y + y, r.z);
      B.p_mount.rotation.set(0, 0, roll);
      // jambes : la hanche suit la selle ; pédales autour du boîtier (repère du vélo ≈ repère du personnage)
      const hy = p.hip + st.dy + y, hz = st.dz;
      const L1 = p.hip - p.knee, L2 = p.knee - p.ankle + 0.06;
      for (let si = 0; si < 2; si++) {
        const q = c + (si ? Math.PI : 0);
        // la pédale gauche est à -CRANK (vers le bas) quand c = 0 (voir bikeCrank)
        const py = BB[1] - Math.cos(q) * CRANK, pz = BB[2] - Math.sin(q) * CRANK;
        legIK(hy, hz, py, pz, L1, L2, mm.legs, si * 3);
        mm.legs[si * 3] -= st.hipPitch || 0; // les cuisses suivent le bassin penché
      }
      mm.ik = true;
      mm.y = y; mm.z = 0; mm.pitch = 0; mm.roll = roll; mm.yaw = 0;
    },
  };

  // ---------------------------------------------------------------------------------------------
  // Tracteur du voisin : gros tracteur rouge, énormes roues arrière à crampons, cheminée qui fume,
  // cabine vitrée (on voit le fermier au volant), botte de foin à l'arrière. Lent et lourd ; détruit,
  // il se renverse dans une explosion de foin (« split ») et trois agriculteurs en sautent (le rendu).
  // ---------------------------------------------------------------------------------------------
  const TSEAT = 1.42, TRR = 0.86, TRX = 0.86, TRZ = -0.5, TFR = 0.48, TFX = 0.7, TFZ = 1.08;
  T.tracteur = {
    label: "Tracteur du voisin",
    championLabel: "Tracteur de concours",
    riderScale: 0.74,
    p: { torsoR: 0.36, belly: 0.04 },
    look: {
      legOutline: false, lite: true, noLegs: true, skin: 0xf2a47e, cheek: 0xff5e4e, brow: 0x3a2412, browW: 1.25, browH: 1.3, nose: 0xe88a66,
      shirt: 0xd8302a, shirtPart: PART.check, shirtPal: PAL.white, sleeve: 0.5,
      pants: 0x2f63c0, legStops: [[0, 0x2f63c0], [0.5, 0x2f8a3a]], shoe: 0x2f8a3a, sole: 0x1a4a1f, cap: 0xd8302a, capFront: 0xf4efe2, mustache: 0x5a3418,
      body: 0xe0181a, dark: 0x26262a, rim: 0xffcf1f, tire: 0x222226, roof: 0xf4f2ec, glass: 0xa8dcf0, chimney: 0x1e1e22, hay: 0xf0c050, grille: 0x3a3a40, light: 0xfff2b0,
    },
    champion: { look: { rim: GOLD, roof: 0xfbfbf7, grille: GOLD, cap: 0xc81e2a } },
    boss: { look: { rim: GOLD, roof: GOLD, grille: GOLD, chimney: GOLD } },
    mood: "angry",
    motion: { gait: "ride", arms: ["wheel", "wheel"], koArms: "droop" },
    mount: { kind: "tractor", seat: { dy: seatDy(TSEAT, 0.74), dz: -0.5, thigh: -1.3, shin: 1.35, spread: 0.3, foot: 0.2, lean: 0.06 } },
    carry: { pos: [0, 3.05, -0.45], parent: "p_mount", arms: ["wheel", "wheel"] },
    dims: { w: 2.3, h: 3.2, d: 3.1 },
    height: 3.2,
    center: 1.2,
    wadeDepth: 0.4,
    dieTime: 1.5,
    tipAngle: 1.62,
    tipHop: 0.7,
    tipTime: 0.6,
    props(s) {
      const p = s.p;
      return [
        { name: "hat", parent: "head", pos: [0, p.headY + 0.3, p.headZ], build: (k, s) => {
          const top = P.cap(k, s.p, { bone: "p_hat", color: s.look.cap, front: s.look.capFront, band: s.champion ? GOLD : 0, theta: 1.02 });
          if (s.boss) P.crown(k, { pos: [0, top - 0.06, s.p.headZ - 0.03], r: 0.3, h: 0.16, big: true });
        } },
        { name: "mount", parent: "root", pos: [0, 1.0, 0], build: (k, s) => tractorBody(k, s) },
        { name: "steer", parent: "p_mount", pos: [0, 2.0, -0.08], build: (k) => {
          rod(k, [0, 1.6, 0.1], [0, 2.0, -0.08], 0.03, 0x2a2a30, { mat: MAT.metal, outline: false });
          k.add(G.torus(0.2, 0.03, 3, 12), { pos: [0, 2.02, -0.1], rot: [Math.PI / 2 - 0.6, 0, 0], color: 0x1a1a1e, mat: 1, outline: false });
        } },
        { name: "wheelR", parent: "p_mount", pos: [0, TRR, TRZ], build: (k, s) => {
          for (const sd of [1, -1]) wheel(k, [sd * TRX, TRR, TRZ], { r: TRR, w: 0.5, tire: s.look.tire, hub: s.look.rim, hubR: 0.5, gold: s.look.rim === GOLD, lugs: 10, lugH: 0.13, lugD: 0.16, lugTwist: true, seg: 12, hubSeg: 8, spokes: 0 });
          for (const sd of [1, -1]) k.add(G.cyl(0.16, 0.16, 0.56, 8), { pos: [sd * TRX, TRR, TRZ], rot: [0, 0, Math.PI / 2], color: s.look.body, mat: 2, outline: false });
        } },
        { name: "wheelF", parent: "p_mount", pos: [0, TFR, TFZ], build: (k, s) => {
          for (const sd of [1, -1]) wheel(k, [sd * TFX, TFR, TFZ], { r: TFR, w: 0.3, tire: s.look.tire, hub: s.look.rim, hubR: 0.27, gold: s.look.rim === GOLD, lugs: 6, lugH: 0.09, lugD: 0.12, lugTwist: true, seg: 10, spokes: 0 });
        } },
      ];
    },
    build(k, s) {
      const p = s.p, L = s.look;
      A.body(k, p, L);
      P.overalls(k, p, L.pants, s.champion ? GOLD : 0xe8c45a);
      P.mustache(k, p, L.mustache, 1.25);
    },
  };
  function tractorBody(k, s) {
    const L = s.look, b = L.body, gold = s.boss;
    const mb = MAT.gloss;
    // châssis sombre et capot (moteur) rouge à l'avant, calandre, phares
    k.add(G.box(0.66, 0.42, 2.3), { pos: [0, 0.74, 0.25], color: L.dark, mat: 1, outline: true });
    k.add(G.rbox(0.82, 0.66, 1.25, 0.14, 2), { pos: [0, 1.22, 0.72], color: b, mat: mb, outline: true });
    k.add(G.rbox(0.72, 0.5, 0.06, 0.03, 1), { pos: [0, 1.17, 1.36], color: L.grille, mat: gold ? MAT.gold : MAT.metal, outline: false });
    for (let i = 0; i < 4; i++) k.add(G.box(0.62, 0.035, 0.03), { pos: [0, 1.0 + i * 0.11, 1.4], color: 0x18181c, outline: false });
    for (const sd of [1, -1]) {
      k.add(G.cyl(0.085, 0.085, 0.05, 8), { pos: [sd * 0.3, 1.48, 1.36], rot: [Math.PI / 2, 0, 0], color: L.light, mat: MAT.glow, outline: false });
      // bande blanche sur le capot
      k.add(G.box(0.03, 0.12, 1.1), { pos: [sd * 0.415, 1.3, 0.72], color: 0xfbfbf7, mat: 1, outline: false });
    }
    // garde-boue des roues arrière (demi-coques rouges)
    for (const sd of [1, -1]) k.add(G.cyl(TRR + 0.1, TRR + 0.1, 0.58, 12, true, Math.PI / 2 - 0.2, Math.PI + 0.4), { pos: [sd * TRX, TRR, TRZ], rot: [0, 0, Math.PI / 2], color: b, mat: mb, outline: true });
    // plancher, siège, cabine : montants sombres, toit blanc, vitres (on voit le conducteur au travers)
    k.add(G.rbox(1.15, 0.12, 1.15, 0.04, 1), { pos: [0, TSEAT - 0.32, TRZ], color: L.dark, mat: 1, outline: false });
    k.add(G.rbox(0.5, 0.12, 0.44, 0.04, 1), { pos: [0, TSEAT - 0.06, TRZ - 0.02], color: 0x1a1a1e, mat: 1, outline: false });
    const cy0 = TSEAT - 0.3, cy1 = 2.95, cx = 0.58, cz0 = TRZ - 0.58, cz1 = TRZ + 0.6;
    for (const [x, z] of [[cx, cz0], [-cx, cz0], [cx, cz1], [-cx, cz1]]) rod(k, [x, cy0, z], [x, cy1, z], 0.05, L.dark, { mat: 2, outline: false, seg: 4 });
    k.add(G.rbox(1.36, 0.14, 1.36, 0.06, 2), { pos: [0, cy1 + 0.04, TRZ], color: L.roof, mat: gold ? MAT.gold : 1, outline: true });
    const gh = cy1 - cy0 - 0.25, gy = cy0 + 0.18 + gh / 2;
    k.add(G.box(1.12, gh, 0.02), { pos: [0, gy, cz1], color: L.glass, part: PART.glass, mat: 2, outline: false });
    k.add(G.box(1.12, gh, 0.02), { pos: [0, gy, cz0], color: L.glass, part: PART.glass, mat: 2, outline: false });
    for (const sd of [1, -1]) k.add(G.box(0.02, gh, 1.15), { pos: [sd * cx, gy, TRZ], color: L.glass, part: PART.glass, mat: 2, outline: false });
    // gyrophare orange sur le toit
    k.add(G.cyl(0.08, 0.1, 0.12, 6), { pos: [0.4, cy1 + 0.17, TRZ - 0.4], color: 0xff8a1a, mat: MAT.glow, outline: true });
    // cheminée d'échappement (elle fume : 12-overlay.js)
    k.add(G.cyl(0.07, 0.07, 1.25, 6), { pos: [0.3, 2.05, 1.0], color: L.chimney, mat: L.chimney === GOLD ? MAT.gold : MAT.metal, outline: true });
    k.add(G.cyl(0.1, 0.08, 0.1, 6), { pos: [0.3, 2.7, 1.0], color: L.chimney, mat: L.chimney === GOLD ? MAT.gold : MAT.metal, outline: false });
    // botte de foin sur le relevage arrière
    k.add(G.rbox(0.95, 0.5, 0.55, 0.08, 1), { pos: [0, 1.25, -1.42], color: L.hay, part: PART.straw, mat: 0, outline: true });
    for (const dx of [-0.25, 0.25]) k.add(G.box(0.03, 0.52, 0.57), { pos: [dx, 1.25, -1.42], color: 0xb8742a, outline: false });
    k.add(G.box(0.8, 0.06, 0.12), { pos: [0, 0.98, -1.18], color: L.dark, mat: MAT.metal, outline: false });
    if (s.champion && !s.boss) P.rosette(k, "p_mount", [0.43, 1.45, 0.75], 1.4);
  }
  MOUNTS.tractor = {
    /** Tracteur : grosses roues lentes, moteur qui vibre, caisse qui tangue sur les mottes. */
    pose(a, dt, s, moving, speed) {
      const B = a.B, t = a.time, mm = a.mm, ws = a.worldScale;
      a.wheelA += (speed * dt) / (TRR * ws);
      a.spin += (speed * dt) / (TFR * ws);
      B.p_wheelR.rotation.set(a.wheelA, 0, 0);
      B.p_wheelF.rotation.set(a.spin, 0, 0);
      const k = Math.min(1, speed / 2);
      const vib = Math.sin(t * 41 + a.id) * 0.012 + Math.sin(t * 27) * 0.006;
      const y = vib + (moving ? Math.max(0, Math.sin(t * 2.3 + a.id)) * 0.04 * k : 0);
      const pitch = moving ? Math.sin(t * 1.9 + a.id) * 0.025 * k : 0;
      const roll = moving ? Math.sin(t * 1.4 + a.id * 2) * 0.03 * k : vib * 0.3;
      const r = a.rest.p_mount;
      B.p_mount.position.set(r.x, r.y + y, r.z);
      B.p_mount.rotation.set(pitch, 0, roll);
      B.p_steer.rotation.set(0, 0, Math.sin(t * 0.9 + a.id) * 0.4 * k);
      mm.y = y; mm.z = 0; mm.pitch = pitch; mm.roll = roll; mm.yaw = 0;
      // les roues continuent de tourner une fois renversé
      if (a.dead) a.wheelA += dt * 4;
    },
    /** Haut de la cheminée (repère de l'os p_mount) : fumée noire. */
    exhaust: [0.3, 1.8, 1.0],
  };

  // ---------------------------------------------------------------------------------------------
  // Montgolfière : grand ballon à fuseaux de couleurs vives, nacelle d'osier, sacs de sable, brûleur ;
  // un voleur cagoulé dans la nacelle, la gemme volée posée à côté de lui. Le modèle a la nacelle au
  // niveau 0 ; a.flying = true : le rendu la soulève (≈ 6 m) et dessine l'ombre au sol. Balancement
  // doux ; « die » : le ballon se dégonfle et tout tombe (s.alt : hauteur de chute).
  // ---------------------------------------------------------------------------------------------
  const ENV = [[0.42, 2.9], [0.66, 3.25], [1.25, 3.85], [1.82, 4.5], [2.14, 5.2], [2.2, 5.85], [2.04, 6.55], [1.6, 7.15], [0.88, 7.55], [0.001, 7.7]];
  const NGORE = 12;
  T.montgolfiere = {
    label: "Montgolfière",
    championLabel: "Montgolfière de la fête",
    flying: true,
    p: {},
    look: {
      legOutline: false, lite: true, noLegs: true, skin: 0xf2c4a0, headColor: 0x1b1b20, noEars: true, cheek: null, noNose: true, brow: 0x0e0e12, browW: 1.1,
      shirt: 0x1e1e24, shirtPart: PART.stripes, shirtPal: PAL.cream, sleeve: 1, pants: 0x26262e, pantsLen: 1, shoe: 0x18181c, glove: 0x1b1b20,
      wicker: 0xd09a52, rim: 0x6a3a18, sand: 0xdcc89a, rope: 0xe8d8b0, burner: 0x8a9098,
      gores: [0xe8262a, 0xffd21a], crownC: 0xfbfbf7, band: 0x2446b8,
    },
    champion: { look: { gores: [0xe8262a, 0xfbfbf7], band: GOLD, crownC: GOLD } },
    boss: { look: { gores: [0xe8262a, 0xff8a1a, 0xffd21a, 0x2fb84a, 0x2a7ae8, 0x8a3ad8], band: GOLD, crownC: GOLD } },
    mood: "sly",
    motion: { gait: "ride", arms: ["rim", "wave"], koArms: "flailA" },
    mount: { kind: "balloon", seat: { dy: 0.1, dz: -0.12, thigh: 0, shin: 0, spread: 0.05, foot: 0, lean: 0 } },
    carry: { pos: [0.32, 1.0, 0.36], parent: "p_mount", noLift: true, arms: ["rim", "rim"] },
    dims: { w: 1.5, h: 2.2, d: 1.5 },
    height: 7.75,
    center: 1.0,
    pivotY: 5.6,
    dieTime: 1.75,
    hatScale: 1,
    props(s) {
      return [
        { name: "mount", parent: "root", pos: [0, 0.5, 0], build: (k, s) => balloonBasket(k, s) },
        { name: "env", parent: "p_mount", pos: [0, 2.9, 0], build: (k, s) => balloonEnvelope(k, s) },
        { name: "flame", parent: "p_mount", pos: [0, 2.55, 0], build: (k) => {
          k.add(G.cone(0.16, 0.5, 6), { pos: [0, 2.85, 0], color: 0xffa020, mat: MAT.flash, outline: false });
          k.add(G.cone(0.08, 0.3, 5), { pos: [0, 2.78, 0], color: 0xfff0a0, mat: MAT.flash, outline: false });
        } },
      ].concat(sandBags());
    },
    build(k, s) {
      const p = s.p, L = s.look;
      A.body(k, p, L);
      balaclava(k, p, L.skin);
      if (s.champion) k.add(G.torus(p.torsoR * 0.8, 0.028, 4, 14), { bone: "body", pos: [0, p.chest - 0.08, 0.03], rot: [Math.PI / 2 + 0.35, 0, 0], color: GOLD, mat: MAT.gold, outline: false });
      if (s.boss) P.crown(k, { bone: "head", pos: [0, p.headY + 0.34, p.headZ - 0.02], r: 0.3, h: 0.16, big: true });
    },
  };
  function sandBags() {
    const out = [];
    [[0.66, 0.2], [-0.66, -0.2], [0.2, -0.66], [-0.2, 0.66]].forEach(([x, z], i) => {
      out.push({ name: "sand" + i, parent: "p_mount", pos: [x, 0.95, z], build: (k, s) => {
        const sx = x * 1.08, sz = z * 1.08;
        rod(k, [x, 0.95, z], [sx, 0.62, sz], 0.012, s.look.rope, { outline: false });
        k.add(G.sphere(0.16, 6, 4), { pos: [sx, 0.48, sz], scale: [0.9, 1.15, 0.8], color: s.look.sand, mat: 0, outline: true });
        k.add(G.cyl(0.05, 0.07, 0.05, 5), { pos: [sx, 0.65, sz], color: 0x8a6a3a, outline: false });
      } });
    });
    return out;
  }
  function balloonBasket(k, s) {
    const L = s.look;
    // nacelle d'osier tressé, bord de cuir, cordes vers le brûleur et le ballon
    k.add(G.rbox(1.3, 0.95, 1.3, 0.12, 2), { pos: [0, 0.48, 0], color: L.wicker, part: PART.wicker, pal: PAL.wicker, mat: 0, outline: true });
    k.add(G.rbox(1.38, 0.1, 1.38, 0.05, 1), { pos: [0, 0.97, 0], color: L.rim, mat: 1, outline: true });
    for (const [x, z] of [[0.6, 0.6], [-0.6, 0.6], [0.6, -0.6], [-0.6, -0.6]]) {
      rod(k, [x, 1.0, z], [x * 0.33, 2.55, z * 0.33], 0.025, L.rope, { outline: false });
      rod(k, [x * 0.33, 2.55, z * 0.33], [x * 0.68, 2.98, z * 0.68], 0.022, L.rope, { outline: false });
    }
    // brûleur : cadre métallique et bonbonnes
    k.add(G.rbox(0.5, 0.16, 0.5, 0.04, 1), { pos: [0, 2.55, 0], color: L.burner, mat: MAT.metal, outline: true });
    k.add(G.cyl(0.12, 0.1, 0.2, 6), { pos: [0, 2.42, 0], color: 0x3a3e44, mat: MAT.metal, outline: false });
    for (const sd of [1, -1]) k.add(G.cyl(0.12, 0.12, 0.5, 6), { pos: [sd * 0.4, 0.75, -0.42], color: 0xc8ced6, mat: MAT.metal, outline: false });
    if (s.champion) for (const sd of [1, -1]) k.add(G.box(1.32, 0.05, 0.02), { pos: [0, 0.7, sd * 0.66], color: GOLD, mat: MAT.gold, outline: false });
  }
  function balloonEnvelope(k, s) {
    const L = s.look, cols = L.gores, n = NGORE;
    const seg = TAU / n;
    // un seul liseré pour tout le ballon, puis les fuseaux colorés (sans liseré propre)
    k.add(G.lathe("envHull", ENV, n * 2), { color: 0xffffff, hullOnly: true });
    for (let i = 0; i < n; i++) {
      const c = cols[i % cols.length];
      k.add(G.lathe("env", ENV, 2, i * seg, seg), { color: c, mat: c === GOLD ? MAT.gold : 1, outline: false });
    }
    // calotte et bande décorative
    k.add(G.dome(0.95, 12, 3, 0.62), { pos: [0, 7.7 - 0.95 * 1.0 + 0.02, 0], scale: [1, 0.55, 1], color: L.crownC, mat: L.crownC === GOLD ? MAT.gold : 1, outline: false });
    k.add(G.cyl(2.215, 2.2, 0.26, 24, true), { pos: [0, 5.5, 0], color: L.band, mat: L.band === GOLD ? MAT.gold : 1, outline: false });
    // jupe de toile sous la bouche
    k.add(G.cyl(0.44, 0.36, 0.3, 10, true), { pos: [0, 2.82, 0], color: shade(cols[0], 0.7), mat: 1, outline: false });
  }
  MOUNTS.balloon = {
    /** Montgolfière : brûleur qui s'allume par bouffées, ballon qui respire, sacs qui se balancent ;
     *  au K.-O., le ballon se dégonfle (écrasé, froissé) pendant la chute. */
    pose(a, dt, s, moving, speed) {
      const B = a.B, t = a.time, mm = a.mm, m = a.mountT;
      // brûleur : bouffée régulière (plus forte quand il monte en vitesse)
      m.burn = (m.burn || 0) + dt;
      const cyc = (m.burn + a.id * 0.7) % 3.2;
      const fire = a.dead ? 0 : cyc < 0.7 ? Math.sin((cyc / 0.7) * Math.PI) : 0;
      a.glow = fire * 0.8;
      B.p_flame.scale.set(0.4 + 0.6 * fire, 0.2 + 1.2 * fire * (0.85 + 0.15 * Math.sin(t * 30)), 0.4 + 0.6 * fire);
      // ballon : respiration lente ; dégonflage au K.-O.
      const env = B.p_env, er = a.rest.p_env;
      if (a.dead) {
        // 1) il se vide en tombant (froissé, il tremble) ; 2) posé au sol, la toile s'affale derrière la nacelle
        const rt = a.reactT;
        const k1 = clamp((rt - 0.05) / 0.9, 0, 1), e1 = k1 * k1 * (3 - 2 * k1);
        const k2 = clamp((rt - 1.0) / 0.35, 0, 1), e2 = k2 * k2 * (3 - 2 * k2);
        const wob = Math.sin(rt * 17) * 0.06 * (1 - e2);
        env.scale.set(1 - 0.32 * e1 + wob, 1 - 0.3 * e1 - 0.05 * e2, 1 - 0.3 * e1 - 0.52 * e2 + wob);
        env.rotation.set(-1.42 * e2 + Math.sin(rt * 11) * 0.12 * e1 * (1 - e2), rt * 1.2 * (1 - e2), 0.25 * e1 * (1 - e2));
        env.position.set(er.x, er.y - 2.25 * e2, er.z - 0.75 * e2);
      } else {
        env.position.copy(er);
        const br = 1 + Math.sin(t * 1.3 + a.id) * 0.015 + fire * 0.02;
        env.scale.set(br, 1 + (br - 1) * 0.5, br);
        env.rotation.set(0, Math.sin(t * 0.3 + a.id) * 0.08, 0);
      }
      for (let i = 0; i < 4; i++) B["p_sand" + i].rotation.set(Math.sin(t * 1.7 + i * 1.3 + a.id) * 0.12, 0, Math.cos(t * 1.4 + i) * 0.12);
      const r = a.rest.p_mount;
      B.p_mount.position.set(r.x, r.y, r.z);
      B.p_mount.rotation.set(0, 0, 0);
      mm.y = 0; mm.z = 0; mm.pitch = 0; mm.roll = 0; mm.yaw = 0;
    },
    /** Flamme du brûleur (repère de l'os p_mount). */
    exhaust: [0, 2.5, 0],
  };
})();
