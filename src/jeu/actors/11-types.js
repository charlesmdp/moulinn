// « Pas touche à mes trésors » — les douze voleurs : tenues, proportions, accessoires, animations.
//
// Chaque accessoire est modelé dans l'espace de pose de liaison du personnage (pose en T, face à +Z,
// gauche du personnage = +X, pieds à y = 0, sommet du crâne ≈ 1,81 m) puis attaché rigidement à un os.
// Les accessoires qui s'animent seuls (casserole, claquettes, sac, bouée, pédalo, roues) ont leur propre
// « os d'accessoire » : les masquer revient à les réduire à zéro, sans matière par instance.
(function () {
  "use strict";
  const PTMT = (globalThis.PTMT = globalThis.PTMT || {});
  const A = (PTMT.actors = PTMT.actors || {});

  // Repères anatomiques (pose de liaison, mètres)
  const HEAD_C = [0, 1.712, -0.012]; // centre du crâne
  const FACE_Z = 0.1; // avant du visage
  const EYE_Y = 1.703;

  // ---------------------------------------------------------------------------------------------
  // Petites pièces réutilisables (toutes reçoivent un « add » lié à un Parts)
  // ---------------------------------------------------------------------------------------------
  const G = {
    sphere: (r, w, h) => new THREE.SphereGeometry(r, w || 10, h || 7),
    cap: (r, w, h, theta) => new THREE.SphereGeometry(r, w || 12, h || 5, 0, Math.PI * 2, 0, theta || Math.PI / 2),
    cyl: (rt, rb, h, s, open, t0, tl) => new THREE.CylinderGeometry(rt, rb, h, s || 10, 1, !!open, t0 || 0, tl || Math.PI * 2),
    box: (w, h, d) => new THREE.BoxGeometry(w, h, d),
    rbox: (w, h, d, r, s) => PTMT.gfx.roundBox(w, h, d, r, s),
    torus: (R, r, rs, ts, arc) => new THREE.TorusGeometry(R, r, rs || 6, ts || 12, arc || Math.PI * 2),
    cone: (r, h, s) => new THREE.ConeGeometry(r, h, s || 8),
    circle: (r, s) => new THREE.CircleGeometry(r, s || 10),
    lathe: (p, s) => PTMT.gfx.lathe(p, s || 10),
    tube: (pts, r, t, rs) => PTMT.gfx.tube(pts, r, t, rs),
  };
  A.G = G;

  /** Yeux de dessin animé : blanc bombé + pupille (+ sourcil optionnel). */
  function cartoonEyes(add, o) {
    o = o || {};
    const y = o.y || EYE_Y, z = o.z || 0.083, dx = o.dx || 0.034, r = o.r || 0.021;
    for (const s of [-1, 1]) {
      add(G.sphere(r, 10, 8), 0xffffff, { bone: "Head", pos: [s * dx, y, z], scale: [1, o.tall || 1.15, 0.7], mat: 2 });
      add(G.sphere(r * 0.5, 8, 6), 0x151515, { bone: "Head", pos: [s * dx + (o.look || 0) * 0.004, y - 0.002, z + r * 0.62], scale: [1, 1.2, 0.5], mat: 2 });
      if (o.brow) {
        add(G.box(0.046, 0.012, 0.014), o.browColor || 0x2a1d14, {
          bone: "Head", pos: [s * dx, y + r * 1.25 + (o.browUp || 0), z + 0.006], rot: [0, 0, -s * (o.brow === "angry" ? 0.42 : o.brow === "sad" ? -0.3 : 0.08)],
        });
      }
    }
  }
  /** Gros nez de clown discret. */
  function nose(add, color, r, o) {
    o = o || {};
    add(G.sphere(r || 0.032, 10, 8), color || 0xf0a58a, { bone: "Head", pos: [0, o.y || 1.668, o.z || 0.108], scale: o.scale || [1, 0.9, 1], mat: 1 });
  }
  function mustache(add, color, w) {
    w = w || 1;
    for (const s of [-1, 1]) {
      add(G.sphere(0.034, 9, 6), color, { bone: "Head", pos: [s * 0.032 * w, 1.64, 0.105], scale: [1.5 * w, 0.55, 0.7], rot: [0, 0, s * 0.35], mat: 0 });
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Définitions des types
  // ---------------------------------------------------------------------------------------------
  // outfit : couleurs sRGB et découpes (x = |x| en pose en T le long des bras, y = hauteur) :
  //   sleeve  : au-delà, le sweat devient peau (0.17 débardeur, 0.4 manches courtes, 0.9 manches longues)
  //   trouserTop / hem : jambe entre hem et trouserTop colorée en pantalon (0.64 / 0.64 = aucun)
  //   sockTop : chaussettes sous cette hauteur (0 = aucune) ; gloveX : gants au-delà (1 = aucun)
  const T = {};

  // --- Voleur du dimanche ------------------------------------------------------------------------
  T.voleur = {
    label: "Voleur du dimanche",
    body: { scale: [1, 1, 1], head: 1.32, hands: 1.2 },
    skin: 0xfff0e6, hair: "none", hairColor: 0x2b1d14,
    outfit: {
      sweaterA: 0xf3efe4, sweaterB: 0x202329, stripes: 7.5, sleeve: 0.9,
      shorts: 0x24262c, trousers: 0x24262c, trouserTop: 0.66, hem: 0.1,
      socks: 0x24262c, sockTop: 0, shoes: 0x18181c, sole: 0xf1ede2, gloves: 0x1c1c20, gloveX: 0.69,
    },
    motion: { loco: "Walk_Loop", natural: 1.1, lean: 0.22, moveArms: "sneak", carry: "carryBoth", tiptoe: 1 },
    sack: { parent: "spine_03", pos: [0.02, 0.98, -0.5], rot: [0.62, Math.PI, -0.18], scale: 1.1, hold: "carryBoth" },
    dims: { w: 0.95, h: 2.15, d: 0.95 },
    height: 2.1,
    build(add) {
      // bonnet noir à revers
      add(G.cap(0.118, 14, 6, Math.PI * 0.56), 0x23252c, { bone: "Head", pos: [0, 1.708, -0.018], rot: [-0.22, 0, 0], scale: [1.0, 1.08, 1.08] });
      add(G.torus(0.112, 0.026, 6, 16), 0x2d3038, { bone: "Head", pos: [0, 1.73, -0.02], rot: [Math.PI / 2 - 0.22, 0, 0], scale: [1.04, 1.12, 1.4] });
      // loup noir (bandeau sur les yeux, noué derrière)
      add(G.cyl(0.107, 0.107, 0.042, 18, true), 0x121214, { bone: "Head", pos: [0, EYE_Y + 0.004, -0.008], scale: [1.0, 1, 1.02] });
      add(G.rbox(0.03, 0.02, 0.07, 0.008), 0x121214, { bone: "Head", pos: [0.02, EYE_Y - 0.01, -0.135], rot: [0.5, 0, 0.4] });
      add(G.rbox(0.03, 0.02, 0.07, 0.008), 0x121214, { bone: "Head", pos: [-0.02, EYE_Y - 0.012, -0.135], rot: [0.6, 0, -0.5] });
      cartoonEyes(add, { z: 0.098, r: 0.02, dx: 0.036, brow: "angry", browUp: 0.012, browColor: 0x121214 });
      nose(add, 0xf2a488, 0.03);
    },
    eliteLabel: "Voleur à casserole",
    elite: {
      outfit: { sweaterA: 0xf4efe2, sweaterB: 0x1f3f8f },
      build(add) {
        // foulard rouge noué
        add(G.cone(0.13, 0.16, 8), 0xd8322b, { bone: "spine_03", pos: [0, 1.46, 0.1], rot: [Math.PI + 0.35, 0, 0], scale: [1.3, 1, 0.45] });
        add(G.torus(0.085, 0.022, 5, 12), 0xc62a24, { bone: "neck_01", pos: [0, 1.5, -0.01], rot: [Math.PI / 2 + 0.2, 0, 0] });
      },
      props: [
        {
          name: "helmet", parent: "Head", pos: [0, 1.8, -0.02],
          build(add) {
            // casserole renversée + manche
            add(G.cyl(0.128, 0.138, 0.13, 16, true), 0xb9c2cc, { pos: [0, 1.79, -0.02], rot: [-0.15, 0, 0.08], mat: 3 });
            add(G.circle(0.128, 16), 0xa8b2bd, { pos: [0, 1.855, -0.03], rot: [-Math.PI / 2 - 0.15, 0, 0.08], mat: 3 });
            add(G.torus(0.138, 0.012, 4, 16), 0xd5dde6, { pos: [0, 1.727, -0.011], rot: [Math.PI / 2 - 0.15, 0, 0.08], mat: 3 });
            add(G.rbox(0.3, 0.03, 0.05, 0.012), 0x2a2a2e, { pos: [-0.27, 1.76, -0.02], rot: [0, 0.25, -0.12], mat: 2 });
            add(G.torus(0.022, 0.008, 4, 8), 0x2a2a2e, { pos: [-0.43, 1.78, 0.02], rot: [Math.PI / 2, 0, 0] });
          },
        },
      ],
    },
  };

  // --- Sprinteur en claquettes -------------------------------------------------------------------
  T.sprinteur = {
    label: "Sprinteur en claquettes",
    body: { scale: [0.86, 1.04, 0.86], head: 1.3, hands: 1.1 },
    skin: 0xe8c4a6, hair: "long", hairColor: 0xc9962f,
    outfit: {
      sweaterA: 0xffe13a, sweaterB: 0xffe13a, stripes: 0, sleeve: 0.17, neck: 1,
      shorts: 0xe8352b, trousers: 0xe8352b, trouserTop: 0.64, hem: 0.64,
      socks: 0xf7f7f2, socks2: 0x2b6be8, sockTop: 0.36, shoes: 0xf7f7f2, barefoot: true, gloves: 0, gloveX: 1,
    },
    motion: { loco: "Sprint_Loop", natural: 5.6, lean: 0.12, carry: "carryR" },
    sack: { parent: "spine_03", pos: [0.02, 0.98, -0.48], rot: [0.62, Math.PI, -0.18], scale: 1.0, hold: "carryR" },
    dims: { w: 0.85, h: 2.1, d: 0.95 },
    height: 2.05,
    build(add) {
      // bandeau éponge + lunettes de soleil enveloppantes
      add(G.torus(0.103, 0.017, 5, 18), 0xe8352b, { bone: "Head", pos: [0, 1.738, -0.014], rot: [Math.PI / 2 - 0.22, 0, 0], scale: [1, 1.12, 1.0] });
      add(G.cyl(0.104, 0.104, 0.034, 14, true, 0), 0x0d0d12, { bone: "Head", pos: [0, EYE_Y + 0.002, -0.004], mat: 7 });
      add(G.box(0.14, 0.036, 0.02), 0x14141a, { bone: "Head", pos: [0, EYE_Y + 0.002, 0.098], mat: 7 });
      add(G.box(0.05, 0.03, 0.012), 0x3aa6ff, { bone: "Head", pos: [0.035, EYE_Y + 0.004, 0.109], mat: 2 });
      add(G.box(0.05, 0.03, 0.012), 0x3aa6ff, { bone: "Head", pos: [-0.035, EYE_Y + 0.004, 0.109], mat: 2 });
      nose(add, 0xe0a07e, 0.026);
      // dossard
      add(G.box(0.15, 0.13, 0.012), 0xffffff, { bone: "spine_03", pos: [0, 1.27, 0.142], rot: [-0.1, 0, 0] });
      add(G.box(0.028, 0.07, 0.006), 0x111111, { bone: "spine_03", pos: [0.022, 1.27, 0.15], rot: [-0.1, 0, 0] });
      add(G.box(0.028, 0.07, 0.006), 0x111111, { bone: "spine_03", pos: [-0.022, 1.27, 0.15], rot: [-0.1, 0, 0] });
    },
    props: [
      { name: "flip_l", parent: "foot_l", pos: [0.114, -0.012, -0.01], build: (add) => flipflop(add, 0.114, 0x19c2d9, 0xff4f9a) },
      { name: "flip_r", parent: "foot_r", pos: [-0.114, -0.012, -0.01], build: (add) => flipflop(add, -0.114, 0x19c2d9, 0xff4f9a) },
    ],
    eliteLabel: "Patineur du dimanche",
    elite: {
      outfit: { sweaterA: 0x9a4dff, sweaterB: 0x9a4dff, shorts: 0x20c9b5, trousers: 0x20c9b5, socks: 0xffffff, socks2: 0xff4f9a },
      motion: { loco: "Jog_Fwd_Loop", natural: 4.2, lean: 0.25, skate: 1, carry: "carryR" },
      props: [
        { name: "skate_l", parent: "foot_l", pos: [0.114, 0.0, 0.0], build: (add) => skate(add, 0.114) },
        { name: "skate_r", parent: "foot_r", pos: [-0.114, 0.0, 0.0], build: (add) => skate(add, -0.114) },
      ],
      noProps: ["flip_l", "flip_r"],
      build(add) {
        // genouillères + coudières
        for (const s of [-1, 1]) {
          add(G.sphere(0.07, 10, 6), 0x1a1a1e, { bone: s > 0 ? "calf_l" : "calf_r", pos: [s * 0.114, 0.54, 0.05], scale: [1, 1.1, 0.8], mat: 2 });
          add(G.sphere(0.05, 8, 5), 0xff4f9a, { bone: s > 0 ? "calf_l" : "calf_r", pos: [s * 0.114, 0.54, 0.09], scale: [1, 1, 0.5], mat: 2 });
          add(G.cyl(0.058, 0.058, 0.09, 10), 0x1a1a1e, { bone: s > 0 ? "lowerarm_l" : "lowerarm_r", pos: [s * 0.47, 1.455, -0.07], rot: [0, 0, Math.PI / 2], mat: 2 });
        }
      },
    },
  };
  function flipflop(add, x, sole, strap) {
    add(G.rbox(0.105, 0.022, 0.29, 0.01, 2), sole, { pos: [x, -0.012, 0.0], mat: 1 });
    add(G.rbox(0.1, 0.008, 0.285, 0.004, 1), 0xf4f4ee, { pos: [x, 0.003, 0.0] });
    add(G.tube([[x - 0.045, 0.01, -0.01], [x - 0.02, 0.07, 0.05], [x, 0.03, 0.1]], 0.009, 6, 4), strap, {});
    add(G.tube([[x + 0.045, 0.01, -0.01], [x + 0.02, 0.07, 0.05], [x, 0.03, 0.1]], 0.009, 6, 4), strap, {});
  }
  function skate(add, x) {
    add(G.rbox(0.12, 0.2, 0.28, 0.04, 2), 0xf6f2ea, { pos: [x, 0.07, 0.0], mat: 1 });
    add(G.rbox(0.13, 0.03, 0.3, 0.01, 1), 0x222226, { pos: [x, -0.035, 0.0] });
    add(G.box(0.12, 0.018, 0.022), 0xff4f9a, { pos: [x, 0.12, 0.12] });
    add(G.sphere(0.03, 6, 5), 0xff4f9a, { pos: [x, 0.03, 0.155], mat: 2 });
    for (const zz of [-0.1, 0.1]) {
      add(G.cyl(0.036, 0.036, 0.13, 10), 0xffd23a, { pos: [x, -0.058, zz], rot: [0, 0, Math.PI / 2], mat: 2 });
    }
  }

  // --- Déménageur en matelas ---------------------------------------------------------------------
  T.demenageur = {
    label: "Déménageur en matelas",
    body: { scale: [1.3, 1.18, 1.26], head: 1.12, hands: 1.35 },
    skin: 0xc28e6e, hair: "none", hairColor: 0x2d2018,
    outfit: {
      sweaterA: 0xe3ded2, sweaterB: 0xe3ded2, stripes: 0, sleeve: 0.4,
      shorts: 0x2f63b0, trousers: 0x2f63b0, trouserTop: 0.66, hem: 0.12,
      socks: 0x2f63b0, sockTop: 0, shoes: 0x6b4426, sole: 0x2a1c12, gloves: 0xe6b94f, gloveX: 0.7,
    },
    motion: { loco: "Walk_Loop", natural: 1.05, lean: 0.14, heavy: 1, moveArms: "mattress", carry: "mattress" },
    sack: { parent: "spine_03", pos: [0, 1.93, -0.5], rot: [-0.25, 0, 0], scale: 0.85, hold: "mattress" },
    dims: { w: 1.4, h: 2.55, d: 1.3 },
    height: 2.45,
    tick: { color: 0x2f5fb3, freq: 11 },
    build(add) {
      moverBody(add);
      // casquette rouge
      add(G.cap(0.112, 14, 5, Math.PI * 0.5), 0xd8322b, { bone: "Head", pos: [0, 1.73, -0.012], scale: [1.02, 0.8, 1.08] });
      add(G.cyl(0.1, 0.1, 0.012, 14), 0xb52620, { bone: "Head", pos: [0, 1.737, 0.08], scale: [0.95, 1, 0.9], rot: [0.08, 0, 0] });
    },
    props: [
      {
        name: "mattress", parent: "spine_03", pos: [0, 1.25, -0.3],
        build(add) {
          add(G.rbox(1.0, 1.55, 0.22, 0.08, 3), 0xf5f1e6, { pos: [0, 1.26, -0.34], rot: [0.1, 0, 0], part: 21, mat: 1 });
          // boutons de capiton
          for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) {
            add(G.sphere(0.018, 5, 4), 0x28488a, { pos: [-0.3 + i * 0.3, 0.72 + j * 0.36, -0.46 + (0.72 + j * 0.36 - 1.26) * 0.1], scale: [1, 1, 0.5] });
          }
        },
      },
    ],
    eliteLabel: "Forteresse canapé",
    elite: {
      outfit: { sweaterA: 0xf2e8d0, shorts: 0x7a3fa0, trousers: 0x7a3fa0 },
      motion: { loco: "Walk_Loop", natural: 1.05, lean: -0.05, heavy: 1, moveArms: "shield", idleArms: "shield", carry: "shield" },
      sack: { parent: "spine_03", pos: [0, 1.0, -0.42], rot: [0.12, 0, 0], scale: 0.9, hold: "shield" },
      noProps: ["mattress"],
      dims: { w: 2.2, h: 2.45, d: 1.8 },
      props: [
        {
          name: "sofa", parent: "spine_02", pos: [0, 1.0, 0.62],
          build(add) {
            const c = 0xe0902c, d = 0xb8701c;
            // assise, dossier (vers l'avant = bouclier), accoudoirs, coussins, pieds
            add(G.rbox(1.9, 0.26, 0.78, 0.07, 2), c, { pos: [0, 0.78, 0.62], part: 22, mat: 1 });
            add(G.rbox(1.9, 0.72, 0.24, 0.09, 2), c, { pos: [0, 1.2, 0.95], rot: [-0.08, 0, 0], part: 22, mat: 1 });
            for (const s of [-1, 1]) {
              add(G.rbox(0.24, 0.5, 0.8, 0.08, 2), d, { pos: [s * 0.9, 1.0, 0.64], part: 22, mat: 1 });
              add(G.rbox(0.8, 0.14, 0.62, 0.06, 2), 0xf0a640, { pos: [s * 0.4, 0.96, 0.58], part: 22, mat: 1 });
              add(G.cone(0.05, 0.14, 6), 0x5a3a22, { pos: [s * 0.82, 0.6, 0.3], rot: [Math.PI, 0, 0] });
              add(G.cone(0.05, 0.14, 6), 0x5a3a22, { pos: [s * 0.82, 0.6, 0.95], rot: [Math.PI, 0, 0] });
            }
          },
        },
      ],
      noBuild: true,
      build(add) {
        moverBody(add);
        // casque de chantier jaune
        add(G.cap(0.122, 14, 6, Math.PI * 0.5), 0xffc21a, { bone: "Head", pos: [0, 1.728, -0.012], scale: [1.02, 0.95, 1.1], mat: 2 });
        add(G.cyl(0.15, 0.15, 0.014, 16), 0xf2b20e, { bone: "Head", pos: [0, 1.73, 0.0], scale: [1, 1, 1.12], mat: 2 });
        add(G.box(0.03, 0.03, 0.2), 0xf2b20e, { bone: "Head", pos: [0, 1.845, -0.012], mat: 2 });
      },
    },
  };
  function moverBody(add) {
    cartoonEyes(add, { r: 0.02, dx: 0.034, brow: "sad", browUp: 0.004, browColor: 0x2d2018 });
    nose(add, 0xb86c55, 0.036, { scale: [1, 0.85, 1] });
    mustache(add, 0x2d2018, 1.15);
    // salopette : bavette + bretelles
    add(G.rbox(0.26, 0.2, 0.05, 0.02), 0x2f63b0, { bone: "spine_02", pos: [0, 1.2, 0.1], rot: [-0.08, 0, 0] });
    add(G.box(0.08, 0.05, 0.02), 0x234c88, { bone: "spine_02", pos: [0, 1.22, 0.128], rot: [-0.08, 0, 0] });
    for (const s of [-1, 1]) {
      add(G.tube([[s * 0.1, 1.28, 0.11], [s * 0.12, 1.47, 0.07], [s * 0.12, 1.5, -0.05], [s * 0.1, 1.3, -0.17], [s * 0.08, 1.1, -0.16]], 0.016, 8, 4), 0x2f63b0, { bone: "spine_03" });
      add(G.cyl(0.018, 0.018, 0.012, 8), 0xd9c27a, { bone: "spine_03", pos: [s * 0.1, 1.29, 0.125], rot: [Math.PI / 2, 0, 0], mat: 3 });
    }
  }

  // --- Voleur au fumigène ------------------------------------------------------------------------
  T.fumigene = {
    label: "Voleur au fumigène",
    body: { scale: [0.96, 1.0, 0.96], head: 1.28, hands: 1.15 },
    skin: 0xf2d0b4, hair: "none", hairColor: 0x111111,
    outfit: {
      sweaterA: 0x3b3356, sweaterB: 0x3b3356, stripes: 0, sleeve: 0.9,
      shorts: 0x2c2640, trousers: 0x2c2640, trouserTop: 0.66, hem: 0.1,
      socks: 0x2c2640, sockTop: 0, shoes: 0x1b1824, sole: 0x453c5e, gloves: 0x1b1824, gloveX: 0.69,
    },
    motion: { loco: "Jog_Fwd_Loop", natural: 4.2, lean: 0.38, moveArms: "naruto", carry: "carryBoth" },
    sack: { parent: "spine_03", pos: [0.02, 0.98, -0.5], rot: [0.62, Math.PI, -0.18], scale: 1.05, hold: "carryBoth" },
    dims: { w: 0.95, h: 2.1, d: 0.95 },
    height: 2.05,
    build(add) {
      // cagoule : crâne + bas du visage, fente pour les yeux
      add(G.cap(0.117, 14, 6, Math.PI * 0.5), 0x2e2744, { bone: "Head", pos: [0, 1.722, -0.012], scale: [1, 1.0, 1.07] });
      add(G.cyl(0.113, 0.1, 0.1, 16, true), 0x2e2744, { bone: "Head", pos: [0, 1.64, -0.004], scale: [1, 1, 1.05] });
      add(G.sphere(0.1, 12, 6), 0x2e2744, { bone: "Head", pos: [0, 1.6, 0.0], scale: [1.02, 0.55, 1.08] });
      // bandeau rouge et ses pans
      add(G.torus(0.115, 0.017, 5, 16), 0xd8243a, { bone: "Head", pos: [0, 1.745, -0.012], rot: [Math.PI / 2, 0, 0], scale: [1, 1.1, 1] });
      add(G.rbox(0.05, 0.012, 0.3, 0.005), 0xd8243a, { bone: "Head", pos: [0.035, 1.71, -0.25], rot: [-0.6, 0.25, 0] });
      add(G.rbox(0.05, 0.012, 0.26, 0.005), 0xd8243a, { bone: "Head", pos: [-0.035, 1.7, -0.23], rot: [-0.8, -0.3, 0] });
      cartoonEyes(add, { r: 0.019, dx: 0.035, z: 0.086, brow: "angry", browColor: 0x14111e, tall: 0.9 });
      // ceinture de fumigènes
      add(G.torus(0.2, 0.022, 5, 18), 0x5a3a22, { bone: "pelvis", pos: [0, 1.0, -0.02], rot: [Math.PI / 2, 0, 0], scale: [1.02, 0.82, 1] });
      const bombs = [[0.17, 0.09], [0.07, 0.16], [-0.1, 0.15], [-0.19, 0.03]];
      for (const b of bombs) {
        add(G.sphere(0.052, 9, 6), 0x303036, { bone: "pelvis", pos: [b[0], 0.98, b[1]], mat: 2 });
        add(G.cyl(0.008, 0.008, 0.05, 5), 0xb09a70, { bone: "pelvis", pos: [b[0], 1.04, b[1]] });
        add(G.sphere(0.013, 5, 4), 0xffa12b, { bone: "pelvis", pos: [b[0], 1.066, b[1]], mat: 4 });
      }
    },
    eliteLabel: "Ninja au rideau de douche",
    elite: {
      outfit: { sweaterA: 0x2b5b77, sweaterB: 0x2b5b77, shorts: 0x1f4257, trousers: 0x1f4257, socks: 0x1f4257 },
      cape: true,
      build(add) {
        // charlotte de douche à froufrous (par-dessus la cagoule)
        add(G.cap(0.13, 14, 6, Math.PI * 0.5), 0xffb3d1, { bone: "Head", pos: [0, 1.738, -0.014], scale: [1.02, 0.95, 1.07], mat: 2 });
        add(G.torus(0.128, 0.022, 5, 20), 0xfff0f6, { bone: "Head", pos: [0, 1.742, -0.014], rot: [Math.PI / 2, 0, 0], scale: [1.02, 1.1, 1] });
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2;
          add(G.sphere(0.014, 5, 4), 0xffffff, { bone: "Head", pos: [Math.cos(a) * 0.08, 1.83, -0.014 + Math.sin(a) * 0.08], mat: 2 });
        }
      },
    },
  };

  // --- Nageur en flamant rose --------------------------------------------------------------------
  T.nageur = {
    label: "Nageur en flamant rose",
    body: { scale: [1.04, 0.97, 1.08], head: 1.3, hands: 1.1 },
    skin: 0xffc4b0, hair: "none", hairColor: 0x3b2a1e,
    outfit: {
      sweaterA: 0xffffff, sweaterB: 0xffffff, stripes: 0, sleeve: 0.0, shirtless: true,
      shorts: 0x14b8c4, trousers: 0x14b8c4, trouserTop: 0.64, hem: 0.64,
      socks: 0xffffff, sockTop: 0, shoes: 0xffd21f, barefoot: true, gloves: 0, gloveX: 1,
    },
    motion: { loco: "Walk_Loop", natural: 1.05, lean: 0.0, waddle: 1, moveArms: "waist", idleArms: "waist", carry: "waist", swims: 1 },
    sack: { parent: "p_float", pos: [0.0, 0.98, 0.42], rot: [0.1, 0, 0], scale: 0.62, hold: "waist" },
    dims: { w: 1.25, h: 2.05, d: 1.25 },
    height: 2.0,
    build(add) {
      // bonnet de bain + lunettes relevées + crème solaire sur le nez
      add(G.cap(0.116, 14, 6, Math.PI * 0.55), 0xffffff, { bone: "Head", pos: [0, 1.716, -0.012], scale: [1, 1.05, 1.07], mat: 2 });
      for (let i = 0; i < 5; i++) {
        const a = -0.9 + i * 0.45;
        add(G.circle(0.018, 8), 0xff5aa0, { bone: "Head", pos: [Math.sin(a) * 0.1, 1.79, Math.cos(a) * 0.1 - 0.02], rot: [-0.9, a, 0] });
      }
      add(G.torus(0.108, 0.01, 4, 16), 0x1a6bd8, { bone: "Head", pos: [0, 1.765, -0.012], rot: [Math.PI / 2 - 0.35, 0, 0], scale: [1, 1.1, 1] });
      for (const s of [-1, 1]) {
        add(G.cyl(0.026, 0.026, 0.02, 10), 0x37b6ff, { bone: "Head", pos: [s * 0.036, 1.79, 0.085], rot: [Math.PI / 2 - 0.6, 0, 0], mat: 2 });
      }
      cartoonEyes(add, { r: 0.021, dx: 0.035, brow: "sad", browColor: 0x3b2a1e });
      nose(add, 0xffffff, 0.03, { scale: [1, 0.9, 1] });
      // palmes jaunes
      for (const s of [-1, 1]) {
        const fin = new THREE.Shape();
        fin.moveTo(-0.05, -0.12); fin.lineTo(0.05, -0.12); fin.lineTo(0.1, 0.24); fin.quadraticCurveTo(0.0, 0.3, -0.1, 0.24); fin.closePath();
        const g = new THREE.ExtrudeGeometry(fin, { depth: 0.018, bevelEnabled: false, curveSegments: 4 });
        g.rotateX(Math.PI / 2);
        add(g, 0xffd21f, { bone: s > 0 ? "foot_l" : "foot_r", pos: [s * 0.114, 0.008, 0.07], mat: 2 });
        add(G.rbox(0.11, 0.07, 0.14, 0.03), 0xffc400, { bone: s > 0 ? "foot_l" : "foot_r", pos: [s * 0.114, 0.04, -0.03], mat: 2 });
      }
    },
    props: [
      {
        name: "float", parent: null, pos: [0, 0.98, 0],
        build(add) {
          add(G.torus(0.44, 0.14, 7, 16), 0xff78ae, { pos: [0, 0.98, 0], rot: [Math.PI / 2, 0, 0], mat: 2 });
          add(G.torus(0.44, 0.03, 3, 16), 0xffffff, { pos: [0, 1.1, 0], rot: [Math.PI / 2, 0, 0], mat: 2 });
          // cou et tête du flamant
          add(G.tube([[0, 1.05, 0.5], [0, 1.3, 0.64], [0, 1.5, 0.56], [0, 1.62, 0.42], [0, 1.74, 0.48]], 0.05, 10, 5), 0xff78ae, { mat: 2 });
          add(G.sphere(0.085, 9, 7), 0xff78ae, { pos: [0, 1.78, 0.5], scale: [0.9, 0.95, 1.1], mat: 2 });
          add(G.cone(0.04, 0.14, 8), 0xf6f0e6, { pos: [0, 1.74, 0.62], rot: [Math.PI / 2 + 0.9, 0, 0], mat: 2 });
          add(G.cone(0.028, 0.06, 8), 0x151515, { pos: [0, 1.69, 0.68], rot: [Math.PI / 2 + 1.1, 0, 0], mat: 2 });
          for (const s of [-1, 1]) add(G.sphere(0.016, 5, 4), 0x151515, { pos: [s * 0.068, 1.8, 0.53], mat: 2 });
        },
      },
    ],
    eliteLabel: "Pirate en pédalo",
    elite: {
      skin: 0xe0b08e,
      outfit: { sweaterA: 0xf2efe6, sweaterB: 0xd02a2a, stripes: 8, sleeve: 0.5, shirtless: false, shorts: 0x2a2a33, trousers: 0x2a2a33, barefoot: false, shoes: 0x2a1c14 },
      motion: { loco: "Walk_Loop", natural: 1.05, lean: 0.05, waddle: 0.4, moveArms: "overhead", idleArms: "overhead", carry: "overhead", swims: 1, boat: 1 },
      sack: { parent: "p_boat", pos: [0.0, 0.5, -0.72], rot: [0, 0, 0], scale: 0.7, hold: "overhead" },
      noProps: ["float"],
      dims: { w: 1.5, h: 2.3, d: 2.3 },
      height: 2.3,
      noBuild: true,
      build(add) {
        // tricorne + tête de mort, bandeau sur l'œil, barbe
        add(G.cyl(0.2, 0.2, 0.025, 3), 0x1b1b20, { bone: "Head", pos: [0, 1.79, -0.012], rot: [0, Math.PI, 0], scale: [1, 1, 1.05] });
        add(G.cap(0.112, 12, 5, Math.PI * 0.5), 0x1b1b20, { bone: "Head", pos: [0, 1.78, -0.012], scale: [1, 0.9, 1.05] });
        add(G.torus(0.2, 0.012, 3, 3), 0xd9b24a, { bone: "Head", pos: [0, 1.805, -0.012], rot: [Math.PI / 2, 0, Math.PI / 6], mat: 3 });
        add(G.circle(0.03, 10), 0xffffff, { bone: "Head", pos: [0, 1.83, 0.078], rot: [-0.5, 0, 0] });
        add(G.box(0.07, 0.012, 0.01), 0xffffff, { bone: "Head", pos: [0, 1.81, 0.088], rot: [-0.5, 0, 0.6] });
        add(G.box(0.07, 0.012, 0.01), 0xffffff, { bone: "Head", pos: [0, 1.81, 0.088], rot: [-0.5, 0, -0.6] });
        add(G.cyl(0.03, 0.03, 0.012, 10), 0x111111, { bone: "Head", pos: [0.035, EYE_Y, 0.093], rot: [Math.PI / 2, 0, 0] });
        add(G.cyl(0.106, 0.106, 0.012, 16, true), 0x111111, { bone: "Head", pos: [0, EYE_Y + 0.012, -0.006], rot: [0, 0, -0.3] });
        add(G.sphere(0.021, 10, 8), 0xffffff, { bone: "Head", pos: [-0.034, EYE_Y, 0.083], scale: [1, 1.1, 0.7], mat: 2 });
        add(G.sphere(0.011, 8, 6), 0x151515, { bone: "Head", pos: [-0.034, EYE_Y - 0.002, 0.096], scale: [1, 1.2, 0.5], mat: 2 });
        nose(add, 0xd89070, 0.033);
        add(G.sphere(0.075, 10, 7), 0x3a2414, { bone: "Head", pos: [0, 1.6, 0.05], scale: [1.2, 1.0, 0.9] });
      },
      props: [
        {
          name: "boat", parent: null, pos: [0, 0.5, 0],
          build(add) {
            // pédalo : deux flotteurs, plateau, siège, roue à aubes, mât et drapeau pirate
            for (const s of [-1, 1]) {
              add(G.rbox(0.36, 0.34, 2.1, 0.15, 3), 0xf4f1ea, { pos: [s * 0.52, 0.2, 0], mat: 2 });
              add(G.rbox(0.37, 0.08, 2.05, 0.04, 1), 0xd8322b, { pos: [s * 0.52, 0.34, 0], mat: 2 });
              add(G.cone(0.17, 0.3, 8), 0xf4f1ea, { pos: [s * 0.52, 0.2, 1.18], rot: [Math.PI / 2, 0, 0], scale: [1, 1, 1.1], mat: 2 });
            }
            add(G.rbox(1.2, 0.08, 1.3, 0.03, 1), 0x3aa0d8, { pos: [0, 0.42, -0.1], mat: 1 });
            add(G.rbox(0.62, 0.1, 0.46, 0.04, 1), 0xffd23a, { pos: [0, 0.52, -0.35], mat: 2 });
            add(G.rbox(0.62, 0.5, 0.1, 0.04, 1), 0xffd23a, { pos: [0, 0.78, -0.58], rot: [-0.2, 0, 0], mat: 2 });
            add(G.cyl(0.03, 0.03, 1.5, 6), 0x7a4a24, { pos: [0.0, 1.2, 0.55] });
            add(G.box(0.02, 0.44, 0.6), 0x16161a, { pos: [0.0, 1.7, 0.27] });
            add(G.circle(0.09, 10), 0xffffff, { pos: [0.012, 1.74, 0.27], rot: [0, Math.PI / 2, 0] });
            add(G.circle(0.09, 10), 0xffffff, { pos: [-0.012, 1.74, 0.27], rot: [0, -Math.PI / 2, 0] });
            add(G.box(0.03, 0.03, 0.34), 0xffffff, { pos: [0, 1.6, 0.27], rot: [0.7, 0, 0] });
            add(G.box(0.03, 0.03, 0.34), 0xffffff, { pos: [0, 1.6, 0.27], rot: [-0.7, 0, 0] });
            add(G.cyl(0.07, 0.05, 0.3, 8), 0x2a2a2e, { pos: [0, 0.55, 0.62], rot: [Math.PI / 2 - 0.4, 0, 0], mat: 3 });
          },
        },
        {
          name: "paddle", parent: "p_boat", pos: [0, 0.3, -1.05],
          build(add) {
            for (let i = 0; i < 4; i++) add(G.box(0.5, 0.05, 0.3), 0xd8322b, { pos: [0, 0.3, -1.05], rot: [(i * Math.PI) / 4, 0, 0] });
            add(G.cyl(0.04, 0.04, 0.7, 8), 0x7a7a80, { pos: [0, 0.3, -1.05], rot: [0, 0, Math.PI / 2], mat: 3 });
          },
        },
      ],
    },
  };

  // --- Chef en tondeuse blindée ------------------------------------------------------------------
  T.boss = {
    label: "Chef en tondeuse blindée",
    body: { scale: [1.2, 1.12, 1.2], head: 1.28, hands: 1.3 },
    skin: 0xf0c8a8, hair: "none", hairColor: 0x1a120c,
    outfit: {
      sweaterA: 0xf3efe4, sweaterB: 0x1d1f25, stripes: 7, sleeve: 0.9,
      shorts: 0x26282e, trousers: 0x26282e, trouserTop: 0.66, hem: 0.1,
      socks: 0x26282e, sockTop: 0, shoes: 0x2b1e16, sole: 0x111111, gloves: 0x1c1c20, gloveX: 0.69,
    },
    motion: { loco: "Driving_Loop", natural: 1.2, lean: 0, vehicle: 1, carry: null },
    sack: { parent: "p_vehicle", pos: [0, 1.0, -1.25], rot: [0, 0, 0], scale: 1.0, hold: null },
    seat: { y: 0.95, z: -0.55 },
    dims: { w: 1.9, h: 2.6, d: 3.2 },
    height: 2.5,
    build(add) {
      // toque de chef + moustache + médaillon
      add(G.cyl(0.1, 0.1, 0.1, 14), 0xffffff, { bone: "Head", pos: [0, 1.79, -0.015], mat: 1 });
      add(G.sphere(0.14, 12, 8), 0xffffff, { bone: "Head", pos: [0, 1.93, -0.015], scale: [1, 0.72, 1], mat: 1 });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        add(G.sphere(0.07, 8, 6), 0xf6f6f2, { bone: "Head", pos: [Math.cos(a) * 0.09, 1.95, -0.015 + Math.sin(a) * 0.09], mat: 1 });
      }
      cartoonEyes(add, { r: 0.02, dx: 0.035, brow: "angry", browUp: 0.006, browColor: 0x1a120c });
      nose(add, 0xe89a80, 0.04);
      mustache(add, 0x1a120c, 1.3);
      add(G.torus(0.12, 0.012, 4, 14), 0xffc21a, { bone: "spine_03", pos: [0, 1.43, 0.03], rot: [Math.PI / 2 + 0.5, 0, 0], mat: 6 });
      add(G.cyl(0.05, 0.05, 0.015, 12), 0xffc21a, { bone: "spine_03", pos: [0, 1.3, 0.13], rot: [Math.PI / 2 - 0.1, 0, 0], mat: 6 });
    },
    props: [
      { name: "vehicle", parent: null, pos: [0, 0, 0], build: (add) => mowerBody(add, false) },
      { name: "armor", parent: "p_vehicle", pos: [0, 0, 0], build: (add) => mowerArmor(add, false) },
      { name: "wheelR", parent: "p_vehicle", pos: [0, 0.5, -1.05], build: (add) => wheels(add, 0.5, -1.05, 0.5, 0.86, 0.36) },
      { name: "wheelF", parent: "p_vehicle", pos: [0, 0.3, 0.95], build: (add) => wheels(add, 0.3, 0.95, 0.3, 0.72, 0.22) },
    ],
    eliteLabel: "Limousine-tondeuse",
    elite: {
      outfit: { sweaterA: 0x1d1f25, sweaterB: 0x1d1f25, stripes: 0, shorts: 0x1d1f25, trousers: 0x1d1f25 },
      dims: { w: 1.9, h: 2.5, d: 4.9 },
      noBuild: true,
      build(add) {
        // couronne + lunettes noires + moustache
        add(G.cyl(0.118, 0.11, 0.08, 10, true), 0xffc21a, { bone: "Head", pos: [0, 1.8, -0.015], mat: 6 });
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          add(G.cone(0.03, 0.08, 4), 0xffc21a, { bone: "Head", pos: [Math.cos(a) * 0.105, 1.87, -0.015 + Math.sin(a) * 0.105], mat: 6 });
          add(G.sphere(0.014, 5, 4), i % 2 ? 0xe8243a : 0x2b8cff, { bone: "Head", pos: [Math.cos(a) * 0.118, 1.8, -0.015 + Math.sin(a) * 0.118], mat: 4 });
        }
        add(G.box(0.15, 0.036, 0.02), 0x0d0d12, { bone: "Head", pos: [0, EYE_Y + 0.002, 0.098], mat: 7 });
        add(G.cyl(0.104, 0.104, 0.03, 14, true), 0x0d0d12, { bone: "Head", pos: [0, EYE_Y + 0.002, -0.004], mat: 7 });
        nose(add, 0xe89a80, 0.04);
        mustache(add, 0x1a120c, 1.3);
        add(G.torus(0.12, 0.014, 4, 14), 0xffc21a, { bone: "spine_03", pos: [0, 1.43, 0.03], rot: [Math.PI / 2 + 0.5, 0, 0], mat: 6 });
      },
      sack: { parent: "p_vehicle", pos: [0, 0.95, -1.95], rot: [0, 0, 0], scale: 1.0, hold: null },
      seat: { y: 0.95, z: -1.2 },
      props: [
        { name: "vehicle", parent: null, pos: [0, 0, 0], build: (add) => mowerBody(add, true) },
        { name: "armor", parent: "p_vehicle", pos: [0, 0, 0], build: (add) => mowerArmor(add, true) },
        { name: "wheelR", parent: "p_vehicle", pos: [0, 0.5, -1.7], build: (add) => wheels(add, 0.5, -1.7, 0.5, 0.86, 0.36, true) },
        { name: "wheelF", parent: "p_vehicle", pos: [0, 0.34, 1.6], build: (add) => wheels(add, 0.34, 1.6, 0.34, 0.76, 0.24, true) },
      ],
    },
  };

  function wheels(add, y, z, r, x, w, limo) {
    for (const s of [-1, 1]) {
      add(G.cyl(r, r, w, 14), 0x1d1d20, { pos: [s * x, y, z], rot: [0, 0, Math.PI / 2], mat: 0 });
      add(G.cyl(r * 0.55, r * 0.55, w + 0.02, 10), limo ? 0xd8dde3 : 0xffd23a, { pos: [s * x, y, z], rot: [0, 0, Math.PI / 2], mat: limo ? 3 : 2 });
      // crampons / rayons visibles pour lire la rotation
      for (let i = 0; i < 4; i++) add(G.box(w + 0.03, r * 0.16, r * 1.02), limo ? 0x9aa2ab : 0xc98f12, { pos: [s * x, y, z], rot: [(i * Math.PI) / 4, 0, 0] });
    }
  }
  // Tondeuse : carrosserie (accessoire « vehicle ») et kit de blindage (accessoire « armor »), tous deux
  // portés par l'os du véhicule ; chacun reste sous 800 triangles.
  function mowerBody(add, limo) {
    const body = limo ? 0x17171c : 0x3f9b3a, trim = limo ? 0xd8dde3 : 0xffd23a, deck = 0x44484f;
    // plateau de coupe + châssis
    add(G.rbox(limo ? 1.1 : 1.5, 0.22, limo ? 1.2 : 1.5, 0.08, 1), deck, { pos: [0, 0.3, 0.1], mat: 3 });
    add(G.rbox(1.2, 0.5, (limo ? 3.9 : 2.5), 0.14, 2), body, { pos: [0, 0.72, limo ? 0.0 : 0.1], mat: 2 });
    // capot moteur avant
    add(G.rbox(1.12, 0.5, 1.0, 0.18, 2), body, { pos: [0, 1.0, (limo ? 1.35 : 0.8)], mat: 2 });
    add(G.box(1.14, 0.06, 0.5), trim, { pos: [0, 1.25, (limo ? 1.35 : 0.8)], mat: 2 });
    // calandre (rougit en surchauffe) + phares
    add(G.box(0.8, 0.34, 0.06), 0x2a2a2e, { pos: [0, 0.98, (limo ? 1.87 : 1.32)], mat: 5 });
    for (let i = 0; i < 3; i++) add(G.box(0.72, 0.035, 0.02), 0x111114, { pos: [0, 0.88 + i * 0.1, (limo ? 1.905 : 1.355)] });
    for (const s of [-1, 1]) {
      add(G.cyl(0.11, 0.11, 0.08, 10), trim, { pos: [s * 0.44, 1.12, (limo ? 1.86 : 1.31)], rot: [Math.PI / 2, 0, 0], mat: 3 });
      add(G.circle(0.085, 10), 0xfff6c2, { pos: [s * 0.44, 1.12, (limo ? 1.905 : 1.355)], mat: 4 });
    }
    // siège + dossier
    const sz = limo ? -1.2 : -0.55;
    add(G.rbox(0.62, 0.14, 0.55, 0.06, 1), 0x1b1b1f, { pos: [0, 0.98 + 0.02, sz], mat: 1 });
    add(G.rbox(0.66, 0.62, 0.14, 0.06, 1), 0x1b1b1f, { pos: [0, 1.32, sz - 0.33], rot: [-0.18, 0, 0], mat: 1 });
    // volant
    add(G.cyl(0.03, 0.03, 0.55, 6), 0x2a2a2e, { pos: [0, 1.25, sz + 0.55], rot: [-0.6, 0, 0], mat: 3 });
    add(G.torus(0.17, 0.025, 4, 12), 0x16161a, { pos: [0, 1.46, sz + 0.44], rot: [Math.PI / 2 - 0.6, 0, 0], mat: 2 });
    // pot d'échappement (la fumée sort d'ici)
    add(G.cyl(0.06, 0.06, 0.6, 8), 0xaab2bb, { pos: [0.45, 1.2, sz - 0.5], mat: 3 });
    add(G.cyl(0.08, 0.06, 0.08, 8), 0x55585e, { pos: [0.45, 1.52, sz - 0.5], mat: 3 });
    if (limo) {
      // habitacle à vitres teintées + fanions + tapis rouge enroulé
      add(G.rbox(1.14, 0.55, 1.5, 0.12, 2), body, { pos: [0, 1.22, 0.1], mat: 2 });
      for (const s of [-1, 1]) add(G.box(0.02, 0.3, 1.2), 0x1c2a3a, { pos: [s * 0.575, 1.26, 0.1], mat: 7 });
      add(G.box(1.0, 0.02, 1.2), 0x1c2a3a, { pos: [0, 1.5, 0.1], mat: 7 });
      add(G.box(1.2, 0.04, 3.95), trim, { pos: [0, 0.98, 0.0], mat: 3 });
      for (const s of [-1, 1]) {
        add(G.cyl(0.012, 0.012, 0.4, 5), 0xd8dde3, { pos: [s * 0.5, 1.45, 1.75], mat: 3 });
        add(G.box(0.01, 0.12, 0.2), s > 0 ? 0xe8243a : 0x2b8cff, { pos: [s * 0.5, 1.58, 1.64] });
      }
      add(G.cyl(0.1, 0.1, 1.0, 8), 0xc81d2e, { pos: [0, 0.7, -2.0], rot: [0, 0, Math.PI / 2], mat: 1 });
    } else {
      // gros bac de ramassage à l'arrière
      add(G.rbox(1.0, 0.6, 0.55, 0.1, 2), 0x2f7a2c, { pos: [0, 0.8, -1.25], mat: 1 });
    }
  }
  function mowerArmor(add, limo) {
    const plate = limo ? 0x2a2a31 : 0x565e68;
    // plaques de blindage rivetées sur les flancs
    for (const s of [-1, 1]) {
      const n = limo ? 5 : 3;
      for (let i = 0; i < n; i++) {
        const z = (limo ? -1.6 : -0.9) + i * (limo ? 0.72 : 0.75);
        add(G.box(0.05, 0.4, 0.66), plate, { pos: [s * 0.62, 0.72, z], mat: 3 });
        for (const dz of [-0.26, 0.26]) for (const dy of [-0.14, 0.14]) add(G.octa(0.022), 0xc0c6cd, { pos: [s * 0.65, 0.72 + dy, z + dz], mat: 3 });
      }
    }
    // pare-chocs à pointes
    add(G.rbox(1.3, 0.14, 0.16, 0.05, 1), plate, { pos: [0, 0.55, (limo ? 2.02 : 1.47)], mat: 3 });
    for (let i = 0; i < 5; i++) add(G.cone(0.05, 0.2, 6), 0xd0d4da, { pos: [-0.5 + i * 0.25, 0.55, (limo ? 2.18 : 1.62)], rot: [Math.PI / 2, 0, 0], mat: 3 });
    // plaque frontale sur la calandre
    add(G.box(0.9, 0.08, 0.05), plate, { pos: [0, 1.2, (limo ? 1.92 : 1.37)], mat: 3 });
  }
  G.octa = (r) => new THREE.OctahedronGeometry(r, 0);

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
    const spec = merge(base, e ? Object.assign({}, e, { build: undefined, props: undefined, noProps: undefined }) : null);
    spec.type = type;
    spec.isElite = !!elite;
    spec.label = elite ? base.eliteLabel : base.label;
    // accessoires : ceux du type (sauf si l'élite les remplace) + ceux de l'élite
    spec.builds = [];
    if (!(e && e.noBuild)) spec.builds.push(base.build);
    if (e && e.build) spec.builds.push(e.build);
    const drop = new Set((e && e.noProps) || []);
    spec.propDefs = (base.props || []).filter((p) => !drop.has(p.name)).concat((e && e.props) || []);
    spec.cape = !!(e && e.cape);
    return spec;
  };
  A.TYPES = ["voleur", "sprinteur", "demenageur", "fumigene", "nageur", "boss"];
  A.typeDefs = T;
})();
