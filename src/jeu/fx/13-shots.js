// « Pas touche à mes trésors » — projectiles et impacts des tours v3 (PTMT.fx, suite de 10-fx.js).
//
//   const p = PTMT.fx.projectile(kind);  p.set(position, direction[, solY]);  p.release();
//   PTMT.fx.burst(kind + "Hit", positionAuSol, { radius (cases), h (hauteur de l'impact, m), crit });
//   PTMT.fx.burst("levelUp", positionAuSol, { height });
//
// Sortes (CONCEPTION.md §3) :
//   chestnut     bogue de châtaigne qui tourne sur elle-même (sanglier 1-3, chasseur)
//   bigChestnut  grosse bogue lancée en cloche, ombre au sol si solY est donné (laie baliste, catapulte)
//   waterJet     trait d'eau en goutte étirée, gouttelettes et écume (cygne 1-3)
//   iceShard     grappe de cristaux qui vrille, givre (cygne des glaces)
//   darkWater    orbe d'eau noire violette, étincelles de mana bleu qui montent (cygne noir)
//   fireball     boule de feu de dessin animé (berger 1-3)
//   dragonFire   grosse boule de feu à la queue flamboyante (dragon rouge)
//   blueFire     feu bleu étincelant (dragon bleu)
// Impacts : chestnutHit (« !! » si crit), bigChestnutHit (épines et feuilles sur opts.radius cases),
// waterJetHit, iceShardHit, darkWaterHit, fireballHit, dragonFireHit (flammes sur opts.radius),
// blueFireHit (flammes bleues et œil qui brille), levelUp (colonne d'étincelles dorées).
//
// Le rendu déplace le projectile selon la simulation (position et direction à chaque image) : aucune
// trajectoire propre. Les corps 3D sont des maillages instanciés partagés (un appel de dessin par sorte,
// quel que soit le nombre de projectiles) ; têtes et traînées passent par les lots de sprites de 10-fx.js.
// Aucune allocation par image (recettes de particules préparées une fois).
(function () {
  "use strict";
  if (typeof THREE === "undefined") return;
  const PTMT = globalThis.PTMT;
  const FX = PTMT && PTMT.fx;
  const _ = FX && FX._;
  if (!_ || !_.KINDS || !_.BURSTS) return;
  const rnd = Math.random;
  const R = (a, b) => a + rnd() * (b - a);
  const C = () => PTMT.gfx.CELL;
  const V = () => new THREE.Vector3();
  const tv = [V(), V(), V(), V()];
  const tq = new THREE.Quaternion(),
    tq2 = new THREE.Quaternion(),
    tm = new THREE.Matrix4(),
    ts = V();
  const AX = { x: new THREE.Vector3(1, 0, 0), z: new THREE.Vector3(0, 0, 1) };

  /* ---------------------------------------------------------------- palette (linéaire) */
  let P = null;
  function pal() {
    if (P) return P;
    const c = (hex) => {
      const k = PTMT.color(hex);
      return [k.r, k.g, k.b];
    };
    P = {
      husk: c("#9ad24a"),
      huskD: c("#4e8a22"),
      nut: c("#8a4a22"),
      nutL: c("#c07838"),
      leaf: c("#6fb83a"),
      dust: c("#d8c49a"),
      dirt: c("#5a4028"),
      white: [1, 1, 1],
      black: [0, 0, 0],
      cream: c("#fff4c8"),
      yellow: c("#ffd23a"),
      red: c("#ff3b2f"),
      water: c("#46d2ec"),
      waterL: c("#bff6ff"),
      foam: c("#f2ffff"),
      ice: c("#8fe6ff"),
      iceW: c("#f2fcff"),
      iceD: c("#3f9ee8"),
      violet: c("#8a3ae0"),
      violetL: c("#c890ff"),
      violetD: c("#3a1a6a"),
      mana: c("#5fb0ff"),
      manaL: c("#cfe8ff"),
      fireCore: c("#fff2b0"),
      fireY: c("#ffc23a"),
      fireO: c("#ff7a1a"),
      fireR: c("#d8300f"),
      smoke: c("#3c3634"),
      smokeL: c("#8a8480"),
      bCore: c("#eaf6ff"),
      bLight: c("#8fd0ff"),
      bFire: c("#3f8cff"),
      bDeep: c("#1a3aa8"),
      gold: c("#ffd23a"),
      goldL: c("#fff3a8"),
      goldD: c("#f2a60c"),
    };
    return P;
  }

  /* ---------------------------------------------------------------- corps instanciés */
  /** Fusion de géométries (non indexées) avec une couleur par morceau (attribut color). */
  function mergeColored(list) {
    const parts = list.map(([g, hex]) => [g.index ? g.toNonIndexed() : g, PTMT.color(hex)]);
    let n = 0;
    for (const [g] of parts) n += g.attributes.position.count;
    const pos = new Float32Array(n * 3),
      nor = new Float32Array(n * 3),
      col = new Float32Array(n * 3);
    let o = 0;
    for (const [g, c] of parts) {
      if (!g.attributes.normal) g.computeVertexNormals();
      const k = g.attributes.position.count;
      pos.set(g.attributes.position.array, o * 3);
      nor.set(g.attributes.normal.array, o * 3);
      for (let i = 0; i < k; i++) {
        col[(o + i) * 3] = c.r;
        col[(o + i) * 3 + 1] = c.g;
        col[(o + i) * 3 + 2] = c.b;
      }
      o += k;
    }
    const m = new THREE.BufferGeometry();
    m.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    m.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
    m.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return m;
  }
  /** Boule hérissée (bogue) : icosaèdre dont les milieux d'arêtes sont tirés en piquants. */
  function huskGeo(r) {
    const K = PTMT.models && PTMT.models.kit;
    if (K && K.g && K.g.husk) return K.g.husk(r).clone();
    return new THREE.IcosahedronGeometry(r * 1.4, 1);
  }
  function nutGeo(r) {
    const K = PTMT.models && PTMT.models.kit;
    if (K && K.g && K.g.nut) return K.g.nut(r).clone();
    return new THREE.SphereGeometry(r, 8, 6);
  }
  const GEO = {
    chestnut: () =>
      mergeColored([
        [huskGeo(0.2), "#9ad83e"],
        [nutGeo(0.13).translate(0, 0.17, 0.04), "#8a4a22"],
      ]),
    bigChestnut: () =>
      mergeColored([
        [huskGeo(0.34), "#9ad83e"],
        [nutGeo(0.19).rotateZ(0.5).translate(0.13, 0.3, 0.02), "#8a4a22"],
        [nutGeo(0.18).rotateZ(-0.6).translate(-0.15, 0.28, -0.06), "#9a5426"],
      ]),
    waterJet: () => {
      // goutte étirée le long de +Z : tête ronde à l'avant, queue effilée
      const pts = [];
      for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        const r = t < 0.72 ? 0.24 * Math.pow(t / 0.72, 0.8) : 0.24 * Math.sqrt(Math.max(0, 1 - Math.pow((t - 0.72) / 0.28, 2)));
        pts.push(new THREE.Vector2(Math.max(1e-4, r), -1.05 + t * 1.3));
      }
      const g = new THREE.LatheGeometry(pts, 12);
      g.rotateX(Math.PI / 2);
      g.computeVertexNormals();
      return g;
    },
    iceShard: () => {
      const main = _.crystalGeo(1.25, 0.2, 6);
      const list = [[main, "#ffffff"]];
      for (let i = 0; i < 3; i++) {
        const s = _.crystalGeo(0.8, 0.13, 5);
        const a = (i / 3) * Math.PI * 2;
        s.rotateX(Math.sin(a) * 0.4);
        s.rotateY(-Math.cos(a) * 0.4);
        s.translate(Math.cos(a) * 0.15, Math.sin(a) * 0.15, -0.3);
        list.push([s, "#ffffff"]);
      }
      const g = mergeColored(list);
      g.computeVertexNormals();
      return g;
    },
    darkWater: () => {
      const g = new THREE.IcosahedronGeometry(0.32, 2);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i),
          y = p.getY(i),
          z = p.getZ(i);
        const k = 1 + 0.08 * Math.sin(x * 11 + y * 7) + 0.06 * Math.sin(z * 13 - y * 5);
        p.setXYZ(i, x * k, y * k, z * (k + 0.25));
      }
      g.computeVertexNormals();
      return g;
    },
  };
  // Matières des corps.
  function chestnutMat() {
    return PTMT.mat("tirs:bogue", () => {
      const m = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.55, metalness: 0, emissive: PTMT.color("#223a10"), emissiveIntensity: 1 });
      m.name = "ptmt:tirs:bogue";
      return m;
    });
  }
  function darkWaterMat() {
    return _.shader(
      "darkWater",
      /* glsl */ `
      void main(){
        vec3 N = normalize(vN);
        vec3 V = normalize(cameraPosition - vW);
        float fres = pow(1.0 - abs(dot(N, V)), 2.0);
        float n = ptFbm(vL.xy * 5.0 + vec2(uTime * 1.3, -uTime * 2.1));
        float swirl = smoothstep(0.52, 0.7, n);
        vec3 col = mix(vec3(0.07, 0.02, 0.16), vec3(0.35, 0.08, 0.7), 0.35 + 0.45 * n);
        col = mix(col, vec3(0.55, 0.75, 1.0), swirl * 0.8);
        col += vec3(0.75, 0.4, 1.0) * fres * 1.3;
        gl_FragColor = vec4(col, 0.88 + 0.12 * fres);
        OUT_COLOR
      }`,
      { transparent: true, depthWrite: false },
    );
  }
  const MAT = {
    chestnut: chestnutMat,
    bigChestnut: chestnutMat,
    waterJet: () => _.waterMat("jetV3", true),
    iceShard: () => _.iceMat(),
    darkWater: darkWaterMat,
  };
  /** Liseré sombre des bogues (coque retournée instanciée, un peu plus grande) : lisibles sur l'herbe. */
  const HULL = { chestnut: 1.2, bigChestnut: 1.14 };
  function hullMat() {
    return PTMT.mat("tirs:liseré", () => new THREE.MeshBasicMaterial({ color: PTMT.color("#16200c"), side: THREE.BackSide }));
  }
  function instanced(geo, mat, cap, name) {
    const mesh = new THREE.InstancedMesh(geo, mat, cap);
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.castShadow = false;
    mesh.renderOrder = 5;
    mesh.name = name;
    _.S.root.add(mesh);
    return mesh;
  }
  /** Lot instancié d'une sorte (créé à la demande dans la scène des effets). */
  function bodies(kind) {
    const S = _.S;
    if (!S.shotBodies) S.shotBodies = {};
    let b = S.shotBodies[kind];
    if (!b) {
      const cap = S.mobile ? 48 : 96;
      const geo = _.geo("tirs:" + kind, GEO[kind]);
      const mesh = instanced(geo, MAT[kind](), cap, "ptmt:tirs:" + kind);
      const hull = HULL[kind] ? instanced(geo, hullMat(), cap, "ptmt:tirs:" + kind + ":liseré") : null;
      b = S.shotBodies[kind] = { mesh, hull, hs: HULL[kind] || 1, free: [], n: 0, cap };
    }
    return b;
  }
  const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
  function setAt(b, i, m) {
    b.mesh.setMatrixAt(i, m);
    b.mesh.instanceMatrix.needsUpdate = true;
    if (b.hull) {
      b.hull.setMatrixAt(i, m === ZERO ? ZERO : tm.scale(ts.set(b.hs, b.hs, b.hs)));
      b.hull.instanceMatrix.needsUpdate = true;
    }
  }
  function bodyStart(p) {
    const b = bodies(p.kind);
    let i = b.free.length ? b.free.pop() : b.n < b.cap ? b.n++ : -1;
    p.slot = i;
    p.body = b;
    if (i >= 0 && i + 1 > b.mesh.count) {
      b.mesh.count = i + 1;
      if (b.hull) b.hull.count = i + 1;
    }
    if (i >= 0) setAt(b, i, ZERO);
  }
  function bodyFree(p) {
    const b = p.body;
    if (!b || p.slot < 0) return;
    setAt(b, p.slot, ZERO);
    b.free.push(p.slot);
    p.slot = -1;
  }
  /** Place le corps : orienté selon la direction de vol, rotation propre (tumble autour de X ou vrille autour de Z). */
  function bodyPlace(p, axis, spin, sx, sy, sz) {
    if (!p.body || p.slot < 0) return;
    tq.setFromUnitVectors(AX.z, p.dir);
    if (spin) tq.multiply(tq2.setFromAxisAngle(AX[axis], spin));
    ts.set(sx, sy, sz);
    tm.compose(p.pos, tq, ts);
    setAt(p.body, p.slot, tm);
  }

  /* ---------------------------------------------------------------- recettes de traînées */
  let TR = null;
  function rec() {
    if (TR) return TR;
    const c = C(),
      L = pal();
    TR = {
      leaf: { grav: 3, drag: 1.5, life: [0.35, 0.6], s0: [0.14, 0.22], s1: 0.08, cell: c.leaf, col: L.leaf, a: 1, a1: 0, rot: "rand", spin: [-8, 8] },
      dust: { drag: 2.2, life: [0.3, 0.5], s0: 0.18, s1: 0.45, cell: c.puff, col: L.dust, a: 0.55, a1: 0, rot: "rand", curve: 1 },
      streak: { drag: 3, life: 0.16, s0: 0.2, s1: 0.1, cell: c.spark, mode: 2, stretch: 0.06, col: L.cream, a: 0.55, a1: 0, add: 0.6 },
      drop: { grav: 9, life: [0.3, 0.5], s0: [0.08, 0.14], s1: 0.05, cell: c.drop, mode: 2, stretch: 0.05, col: L.waterL, col1: L.water, a: 0.95, a1: 0.3 },
      foam: { drag: 2, life: 0.35, s0: 0.2, s1: 0.38, cell: c.foam, col: L.foam, a: 0.7, a1: 0, rot: "rand" },
      frost: { drag: 2, life: [0.35, 0.6], s0: [0.14, 0.24], s1: 0.02, cell: c.twinkle, col: L.iceW, a: 1, a1: 0, add: 0.6, rot: "rand", spin: [-4, 4] },
      snow: { drag: 2, grav: 0.6, life: [0.4, 0.7], s0: [0.12, 0.2], s1: 0.04, cell: c.snow, col: L.iceW, a: 0.9, a1: 0, add: 0.3, rot: "rand", spin: [-3, 3] },
      mist: { drag: 1.5, life: 0.55, s0: 0.3, s1: 0.7, cell: c.puffDark, col: L.ice, a: 0.25, a1: 0, rot: "rand", curve: 1 },
      vdrop: { grav: 8, life: [0.3, 0.5], s0: [0.08, 0.13], s1: 0.05, cell: c.drop, mode: 2, stretch: 0.05, col: L.violetL, col1: L.violet, a: 0.95, a1: 0.2 },
      mana: { grav: -3, drag: 1.5, life: [0.5, 0.8], s0: [0.1, 0.18], s1: 0.02, cell: c.twinkle, col: L.manaL, col1: L.mana, a: 1, a1: 0, add: 1, rot: "rand", spin: [-5, 5] },
      vmist: { drag: 1.4, life: 0.6, s0: 0.3, s1: 0.75, cell: c.puffDark, col: L.violetD, a: 0.35, a1: 0, rot: "rand", curve: 1 },
      fire: { drag: 2, life: [0.22, 0.34], s0: [0.55, 0.75], s1: 0.06, cell: c.flameB, col: L.fireY, col1: L.fireR, a: 1, a1: 0, add: 0.5, rot: "rand", spin: [-3, 3], curve: 1 },
      bigFire: { drag: 1.8, life: [0.3, 0.45], s0: [0.9, 1.25], s1: 0.1, cell: c.flameB, col: L.fireY, col1: L.fireR, a: 1, a1: 0, add: 0.55, rot: "rand", spin: [-3, 3], curve: 1 },
      tongue: { drag: 3, life: 0.22, s0: 0.7, s1: 0.2, cell: c.flameB, mode: 2, stretch: 0.25, col: L.fireY, col1: L.fireR, a: 0.9, a1: 0, add: 0.7 },
      smoke: { drag: 1.5, life: [0.6, 0.9], s0: 0.3, s1: 0.8, cell: c.puffDark, col: L.smoke, a: 0.4, a1: 0, rot: "rand", curve: 1 },
      ember: { grav: 3, life: [0.3, 0.6], s0: 0.07, s1: 0.02, cell: c.disc, col: L.fireO, a: 1, a1: 0.4, add: 1 },
      bfire: { drag: 2, life: [0.25, 0.38], s0: [0.75, 1.0], s1: 0.08, cell: c.flameB, col: L.bFire, col1: L.bDeep, a: 1, a1: 0, add: 0.55, rot: "rand", spin: [-3, 3], curve: 1 },
      btongue: { drag: 3, life: 0.22, s0: 0.65, s1: 0.2, cell: c.flameB, mode: 2, stretch: 0.25, col: L.bLight, col1: L.bFire, a: 0.9, a1: 0, add: 0.7 },
      bspark: { grav: 2, drag: 1, life: [0.3, 0.55], s0: [0.1, 0.16], s1: 0.02, cell: c.twinkle, col: L.bCore, col1: L.bLight, a: 1, a1: 0, add: 1, rot: "rand", spin: [-6, 6] },
    };
    return TR;
  }

  /* ---------------------------------------------------------------- sortes de projectiles */
  const K = _.KINDS;
  const put = (x, y, z, size, cell, col, al, rot, add, orient, aspect) => _.put(x, y, z, size, cell, col, al, rot, add, orient, aspect);
  /** Ombre portée au sol (projectiles en cloche), si le rendu donne la hauteur du sol. */
  function groundShadow(p, size) {
    if (p.ground === null || p.ground === undefined) return;
    const h = Math.max(0, p.pos.y - p.ground);
    const k = 1 / (1 + h * 0.18);
    put(p.pos.x, p.ground + 0.03, p.pos.z, size * (0.7 + 0.5 * k), C().shadow, pal().black, 0.45 * k, 0, 0, 1);
  }

  K.chestnut = {
    spacing: 0.3,
    start: bodyStart,
    free: bodyFree,
    place(p) {
      bodyPlace(p, "x", p.t * 16 + p.seed, 1, 1, 1);
    },
    head(p) {
      const c = C(),
        L = pal();
      put(p.pos.x, p.pos.y, p.pos.z, 1.3, c.glow, L.cream, 0.4, 0, 1);
      groundShadow(p, 0.5);
    },
    trail(p, at) {
      const T = rec(),
        P2 = _.S.P,
        d = p.dir;
      P2.emitR(T.streak, at.x, at.y, at.z, -d.x * 2, -d.y * 2, -d.z * 2);
      if (rnd() < 0.3) P2.emitR(T.leaf, at.x, at.y, at.z, R(-1, 1), R(0, 1.2), R(-1, 1));
      if (rnd() < 0.25) P2.emitR(T.dust, at.x, at.y, at.z, R(-0.3, 0.3), R(0, 0.4), R(-0.3, 0.3));
    },
  };
  K.bigChestnut = {
    spacing: 0.34,
    start: bodyStart,
    free: bodyFree,
    place(p) {
      bodyPlace(p, "x", p.t * 7 + p.seed, 1, 1, 1);
    },
    head(p) {
      const c = C(),
        L = pal();
      put(p.pos.x, p.pos.y, p.pos.z, 2.2, c.glow, L.cream, 0.35, 0, 1);
      groundShadow(p, 1.1);
    },
    trail(p, at) {
      const T = rec(),
        P2 = _.S.P;
      if (rnd() < 0.55) P2.emitR(T.leaf, at.x + R(-0.2, 0.2), at.y, at.z + R(-0.2, 0.2), R(-1.2, 1.2), R(0, 1.5), R(-1.2, 1.2));
      P2.emitR(T.dust, at.x, at.y, at.z, R(-0.4, 0.4), R(0, 0.5), R(-0.4, 0.4));
    },
  };
  K.waterJet = {
    spacing: 0.14,
    start: bodyStart,
    free: bodyFree,
    place(p) {
      const w = 1 + 0.08 * Math.sin(p.t * 30 + p.seed);
      bodyPlace(p, "z", p.t * 4, w, w, 1.1);
    },
    head(p) {
      const c = C(),
        L = pal();
      put(p.pos.x, p.pos.y, p.pos.z, 1.35, c.glow, L.water, 0.45, 0, 1);
      put(p.pos.x + p.dir.x * 0.2, p.pos.y + p.dir.y * 0.2, p.pos.z + p.dir.z * 0.2, 0.55, c.twinkle, L.foam, 0.9, p.t * 5, 0.6);
    },
    trail(p, at) {
      const T = rec(),
        P2 = _.S.P,
        d = p.dir;
      P2.emitR(T.drop, at.x + R(-0.12, 0.12), at.y + R(-0.1, 0.1), at.z + R(-0.12, 0.12), R(-0.8, 0.8) + d.x * 1.5, R(0.3, 1.4), R(-0.8, 0.8) + d.z * 1.5);
      if (rnd() < 0.45) P2.emitR(T.foam, at.x, at.y, at.z, R(-0.3, 0.3), R(-0.1, 0.3), R(-0.3, 0.3));
    },
  };
  K.iceShard = {
    spacing: 0.18,
    start: bodyStart,
    free: bodyFree,
    place(p) {
      bodyPlace(p, "z", p.t * 9 + p.seed, 1, 1, 1);
    },
    head(p) {
      const c = C(),
        L = pal();
      put(p.pos.x, p.pos.y, p.pos.z, 1.6, c.glow, L.ice, 0.5, 0, 0.5);
      put(p.pos.x, p.pos.y, p.pos.z, 0.85, c.twinkle, L.iceW, 0.95, _.S.time * 3, 0.6);
    },
    trail(p, at) {
      const T = rec(),
        P2 = _.S.P,
        d = p.dir,
        c = C();
      T.frost.cell = rnd() < 0.5 ? c.twinkle : c.snow;
      P2.emitR(T.frost, at.x + R(-0.12, 0.12), at.y + R(-0.12, 0.12), at.z + R(-0.12, 0.12), R(-0.3, 0.3), R(-0.3, 0.2), R(-0.3, 0.3));
      if (rnd() < 0.6) P2.emitR(T.mist, at.x, at.y, at.z, -d.x * 0.4, -0.2, -d.z * 0.4);
    },
  };
  K.darkWater = {
    spacing: 0.16,
    start: bodyStart,
    free: bodyFree,
    place(p) {
      const w = 1 + 0.1 * Math.sin(p.t * 17 + p.seed);
      bodyPlace(p, "z", p.t * 6, w, 2 - w, 1.05);
    },
    head(p) {
      const c = C(),
        L = pal(),
        t = _.S.time;
      put(p.pos.x, p.pos.y, p.pos.z, 1.6, c.glow, L.violet, 0.6, 0, 1);
      for (let i = 0; i < 2; i++) {
        const a = t * 9 + i * Math.PI + p.seed;
        put(p.pos.x + Math.cos(a) * 0.42, p.pos.y + Math.sin(a * 0.7) * 0.2, p.pos.z + Math.sin(a) * 0.42, 0.42, c.twinkle, L.manaL, 1, a, 1);
      }
    },
    trail(p, at) {
      const T = rec(),
        P2 = _.S.P,
        d = p.dir;
      P2.emitR(T.vdrop, at.x + R(-0.12, 0.12), at.y + R(-0.1, 0.1), at.z + R(-0.12, 0.12), R(-0.7, 0.7) + d.x, R(0.2, 1.2), R(-0.7, 0.7) + d.z);
      if (rnd() < 0.5) P2.emitR(T.mana, at.x + R(-0.2, 0.2), at.y, at.z + R(-0.2, 0.2), R(-0.3, 0.3), R(0.4, 1.2), R(-0.3, 0.3));
      if (rnd() < 0.35) P2.emitR(T.vmist, at.x, at.y, at.z, 0, 0.3, 0);
    },
  };
  function fireHead(p, big, blue) {
    const c = C(),
      L = pal(),
      t = _.S.time;
    const fl = 0.85 + 0.15 * Math.sin(t * 40 + p.seed) + 0.08 * Math.sin(t * 23);
    const x = p.pos.x,
      y = p.pos.y,
      z = p.pos.z;
    const s = big ? 1.4 : 1;
    if (blue) {
      put(x, y, z, 2.4 * s * fl, c.glow, L.bFire, 0.6, 0, 1);
      put(x, y, z, 1.3 * s * fl, c.puff, L.bFire, 1, t * 6, 0.35);
      put(x, y, z, 0.95 * s * fl, c.puff, L.bLight, 1, -t * 8, 0.5);
      put(x, y, z, 0.55 * s, c.glow, L.bCore, 0.9, 0, 1);
      put(x, y, z, 0.8 * s, c.twinkle, L.bLight, 0.9, t * 4, 1);
    } else {
      put(x, y, z, 2.5 * s * fl, c.glow, L.fireO, 0.8, 0, 1);
      put(x, y, z, 1.3 * s * fl, c.puff, L.fireO, 1, t * 6, 0.35);
      put(x, y, z, 0.95 * s * fl, c.puff, L.fireY, 1, -t * 8, 0.55);
      put(x, y, z, 0.6 * s, c.glow, L.fireCore, 1, 0, 1);
    }
  }
  K.fireball = {
    spacing: 0.16,
    head(p) {
      fireHead(p, false, false);
    },
    trail(p, at) {
      const T = rec(),
        P2 = _.S.P,
        d = p.dir,
        c = C();
      T.fire.cell = rnd() < 0.5 ? c.flameB : c.puff;
      P2.emitR(T.fire, at.x + R(-0.1, 0.1), at.y + R(-0.1, 0.1), at.z + R(-0.1, 0.1), -d.x * 1.5 + R(-0.5, 0.5), -d.y * 1.5 + R(0.3, 1.0), -d.z * 1.5 + R(-0.5, 0.5));
      if (rnd() < 0.3) P2.emitR(T.smoke, at.x, at.y, at.z, R(-0.3, 0.3), R(0.4, 1.0), R(-0.3, 0.3));
      if (rnd() < 0.5) P2.emitR(T.ember, at.x, at.y, at.z, R(-1.5, 1.5), R(-0.5, 1.5), R(-1.5, 1.5));
    },
  };
  K.dragonFire = {
    spacing: 0.14,
    head(p) {
      fireHead(p, true, false);
    },
    trail(p, at) {
      const T = rec(),
        P2 = _.S.P,
        d = p.dir,
        c = C();
      T.bigFire.cell = rnd() < 0.5 ? c.flameB : c.puff;
      P2.emitR(T.bigFire, at.x + R(-0.15, 0.15), at.y + R(-0.15, 0.15), at.z + R(-0.15, 0.15), -d.x * 2 + R(-0.6, 0.6), -d.y * 2 + R(0.3, 1.1), -d.z * 2 + R(-0.6, 0.6));
      P2.emitR(T.tongue, at.x, at.y, at.z, -d.x * 5, -d.y * 5, -d.z * 5);
      if (rnd() < 0.45) P2.emitR(T.smoke, at.x, at.y, at.z, R(-0.3, 0.3), R(0.5, 1.1), R(-0.3, 0.3));
      if (rnd() < 0.8) P2.emitR(T.ember, at.x, at.y, at.z, R(-2, 2), R(-0.5, 2), R(-2, 2));
    },
  };
  K.blueFire = {
    spacing: 0.14,
    head(p) {
      fireHead(p, true, true);
    },
    trail(p, at) {
      const T = rec(),
        P2 = _.S.P,
        d = p.dir,
        c = C();
      T.bfire.cell = rnd() < 0.5 ? c.flameB : c.puff;
      P2.emitR(T.bfire, at.x + R(-0.15, 0.15), at.y + R(-0.15, 0.15), at.z + R(-0.15, 0.15), -d.x * 2 + R(-0.6, 0.6), -d.y * 2 + R(0.3, 1.1), -d.z * 2 + R(-0.6, 0.6));
      P2.emitR(T.btongue, at.x, at.y, at.z, -d.x * 5, -d.y * 5, -d.z * 5);
      if (rnd() < 0.7) P2.emitR(T.bspark, at.x, at.y, at.z, R(-1.8, 1.8), R(-0.3, 1.8), R(-1.8, 1.8));
    },
  };

  /* ---------------------------------------------------------------- impacts */
  const B = _.BURSTS;
  const TILE = 3.6;
  const em = (o) => _.emit(o);
  const n = (k) => _.count(k);
  function ring(x, y, z, s0, s1, life, col, a, add, cell) {
    em({ x, y: y + 0.05, z, life, s0, s1, cell: cell === undefined ? C().ring : cell, mode: 1, r: col[0], g: col[1], b: col[2], a, a1: 0, add: add || 0, curve: 1, rot: R(0, 6) });
  }
  function flash(x, y, z, size, col, life, a) {
    em({ x, y, z, life: life || 0.16, s0: size * 0.6, s1: size, cell: C().glow, r: col[0], g: col[1], b: col[2], a: a || 1, a1: 0, add: 1, curve: 1 });
  }
  function decal(x, y, z, size, cell, col, a, life, add) {
    em({ x, y: y + 0.03, z, life, s0: size, s1: size * 1.06, cell, mode: 1, r: col[0], g: col[1], b: col[2], a, a1: a, fadeIn: 0.04, fadeOut: 0.55, rot: R(0, 6), add: add || 0 });
  }
  /** « !! » au-dessus de l'impact (coup critique du sanglier chasseur). */
  function crit(x, y, z) {
    const c = C(),
      L = pal();
    for (const sx of [-1, 1]) em({ x: x + sx * 0.34, y: y + 0.9, z, vy: 1.4, drag: 2, life: 0.8, s0: 1.2, s1: 1.1, cell: c.exclaim, a: 1, a1: 0, rot: sx * 0.15, curve: 2, fadeOut: 0.7 });
    em({ x, y: y + 0.4, z, life: 0.3, s0: 0.6, s1: 2.2, cell: c.zap, r: L.yellow[0], g: L.yellow[1], b: L.yellow[2], a: 1, a1: 0, add: 0.6, rot: R(0, 6), curve: 1 });
    for (let i = 0; i < 4; i++) em({ x, y: y + 0.6, z, vx: R(-3, 3), vy: R(2.5, 4.5), vz: R(-3, 3), grav: 9, life: 0.7, s0: 0.3, s1: 0.12, cell: c.star, a: 1, a1: 0, spin: R(-8, 8), rot: R(0, 6) });
  }

  B.chestnutHit = function (p, o) {
    const c = C(),
      L = pal();
    const x = p.x,
      g = p.y,
      z = p.z,
      y = g + (o.h === undefined ? 1.0 : o.h);
    flash(x, y, z, 1.4, L.cream, 0.14);
    em({ x, y, z, life: 0.22, s0: 0.4, s1: 1.2, cell: c.zap, r: L.husk[0], g: L.husk[1], b: L.husk[2], a: 1, a1: 0, add: 0.3, rot: R(0, 6), curve: 1 });
    // épines, feuilles, châtaignes qui rebondissent, poussière
    for (let i = 0, k = n(9); i < k; i++) {
      _.sphereDir(tv[0], 0.3);
      const sp = R(4, 7);
      em({ x, y, z, vx: tv[0].x * sp, vy: tv[0].y * sp * 0.7 + 1.5, vz: tv[0].z * sp, grav: 10, life: R(0.25, 0.4), s0: 0.16, s1: 0.05, cell: c.spark, mode: 2, stretch: 0.05, r: L.husk[0], g: L.husk[1], b: L.husk[2], r1: L.huskD[0], g1: L.huskD[1], b1: L.huskD[2], a: 1, a1: 0.3 });
    }
    for (let i = 0, k = n(5); i < k; i++) em({ x: x + R(-0.2, 0.2), y, z: z + R(-0.2, 0.2), vx: R(-2, 2), vy: R(1, 3), vz: R(-2, 2), grav: 4, drag: 1.5, life: R(0.6, 0.9), s0: R(0.18, 0.26), s1: 0.1, cell: c.leaf, a: 1, a1: 0, rot: R(0, 6), spin: R(-9, 9), floor: g + 0.05 });
    for (let i = 0, k = n(3); i < k; i++) em({ x, y, z, vx: R(-2.2, 2.2), vy: R(2, 3.5), vz: R(-2.2, 2.2), grav: 12, life: R(0.7, 1.0), s0: 0.2, s1: 0.18, cell: c.drop, r: L.nut[0], g: L.nut[1], b: L.nut[2], a: 1, a1: 0.8, rot: R(2.6, 3.6), spin: R(-6, 6), floor: g + 0.1, fadeOut: 0.8 });
    for (let i = 0, k = n(3); i < k; i++) em({ x: x + R(-0.3, 0.3), y: y - 0.2, z: z + R(-0.3, 0.3), vx: R(-0.6, 0.6), vy: R(0.3, 0.9), vz: R(-0.6, 0.6), drag: 2, life: R(0.5, 0.7), s0: 0.3, s1: 0.75, cell: c.puff, r: L.dust[0], g: L.dust[1], b: L.dust[2], a: 0.6, a1: 0, rot: R(0, 6), curve: 1 });
    if (o.crit) crit(x, y, z);
  };

  B.bigChestnutHit = function (p, o) {
    const c = C(),
      L = pal();
    const r = Math.max(0.6, (o.radius || 1) * TILE * 0.5);
    const x = p.x,
      g = p.y,
      z = p.z,
      y = g + (o.h === undefined ? 0.3 : o.h);
    flash(x, y + 0.4, z, r * 1.6, L.cream, 0.18);
    ring(x, g, z, r * 0.3, r * 2.2, 0.45, L.dust, 0.9, 0);
    ring(x, g, z, r * 0.2, r * 1.6, 0.35, L.husk, 0.8, 0.3, c.dashring);
    // nuage de poussière et de feuilles
    for (let i = 0, k = n(10); i < k; i++) {
      const a = R(0, 6.28),
        sp = R(1.5, 3) * r;
      em({ x: x + Math.cos(a) * 0.3, y: g + 0.3, z: z + Math.sin(a) * 0.3, vx: Math.cos(a) * sp, vy: R(0.6, 1.6), vz: Math.sin(a) * sp, drag: 3.2, life: R(0.6, 0.9), s0: r * 0.35, s1: r * 0.8, cell: c.puff, r: L.dust[0], g: L.dust[1], b: L.dust[2], a: 0.75, a1: 0, rot: R(0, 6), curve: 1, fadeOut: 0.6 });
    }
    // épines projetées en étoile
    for (let i = 0, k = n(22); i < k; i++) {
      const a = (i / 22) * 6.28 + R(-0.1, 0.1),
        sp = R(6, 10) * Math.sqrt(r);
      em({ x, y, z, vx: Math.cos(a) * sp, vy: R(1.5, 4), vz: Math.sin(a) * sp, grav: 12, drag: 0.6, life: R(0.35, 0.55), s0: 0.22, s1: 0.06, cell: c.spark, mode: 2, stretch: 0.05, r: L.husk[0], g: L.husk[1], b: L.husk[2], r1: L.huskD[0], g1: L.huskD[1], b1: L.huskD[2], a: 1, a1: 0.4, floor: g + 0.05 });
    }
    for (let i = 0, k = n(12); i < k; i++) em({ x: x + R(-0.4, 0.4), y: y + 0.2, z: z + R(-0.4, 0.4), vx: R(-3, 3) * Math.sqrt(r), vy: R(2, 5), vz: R(-3, 3) * Math.sqrt(r), grav: 5, drag: 1.2, life: R(0.8, 1.2), s0: R(0.22, 0.34), s1: 0.12, cell: c.leaf, a: 1, a1: 0, rot: R(0, 6), spin: R(-10, 10), floor: g + 0.05, fadeOut: 0.7 });
    // morceaux de bogue et châtaignes qui rebondissent
    for (let i = 0, k = n(6); i < k; i++) em({ x, y: y + 0.2, z, vx: R(-3, 3), vy: R(3, 6), vz: R(-3, 3), grav: 14, life: R(0.8, 1.1), s0: 0.3, s1: 0.22, cell: c.shard, r: L.husk[0], g: L.husk[1], b: L.husk[2], a: 1, a1: 0.7, rot: R(0, 6), spin: R(-9, 9), floor: g + 0.08, fadeOut: 0.75 });
    for (let i = 0, k = n(6); i < k; i++) em({ x, y: y + 0.2, z, vx: R(-3.5, 3.5), vy: R(3, 6), vz: R(-3.5, 3.5), grav: 14, life: R(0.9, 1.3), s0: 0.26, s1: 0.24, cell: c.drop, r: L.nut[0], g: L.nut[1], b: L.nut[2], a: 1, a1: 0.8, rot: R(2.6, 3.6), spin: R(-6, 6), floor: g + 0.12, fadeOut: 0.8 });
    decal(x, g, z, r * 1.5, c.splat, L.dirt, 0.5, 1.4);
    if (o.crit) crit(x, y + 0.6, z);
    FX.shake = Math.max(FX.shake, Math.min(0.5, r * 0.12));
  };

  B.waterJetHit = function (p, o) {
    const c = C(),
      L = pal();
    const r = Math.max(0.5, (o.radius || 0.55) * TILE * 0.5);
    const x = p.x,
      g = p.y,
      z = p.z,
      y = g + (o.h === undefined ? 1.0 : o.h);
    flash(x, y, z, 1.8, L.waterL, 0.16, 0.9);
    em({ x, y: y - 0.1, z, life: 0.5, s0: 1.4, s1: 2.4, cell: c.splash, mode: 3, r: L.foam[0], g: L.foam[1], b: L.foam[2], a: 1, a1: 0, curve: 1 });
    em({ x, y: g + 0.6, z, life: 0.5, s0: 1.3, s1: 2.2, cell: c.splash, mode: 3, r: L.water[0], g: L.water[1], b: L.water[2], a: 0.9, a1: 0, curve: 1, delay: 0.05 });
    for (let i = 0, k = n(16); i < k; i++) {
      const a = R(0, 6.28),
        sp = R(1.2, 3.2);
      em({ x: x + Math.cos(a) * 0.2, y, z: z + Math.sin(a) * 0.2, vx: Math.cos(a) * sp, vy: R(2.5, 5), vz: Math.sin(a) * sp, grav: 13, life: R(0.5, 0.8), s0: R(0.18, 0.28), s1: 0.1, cell: c.drop, mode: 2, stretch: 0.04, r: L.foam[0], g: L.foam[1], b: L.foam[2], r1: L.water[0], g1: L.water[1], b1: L.water[2], a: 1, a1: 0.5, floor: g });
    }
    ring(x, g, z, 0.3, r * 2.1, 0.6, L.foam, 1, 0.2, c.ripple);
    ring(x, g, z, 0.2, r * 1.5, 0.8, L.water, 0.9, 0.2, c.ripple);
    for (let i = 0, k = n(4); i < k; i++) {
      const a = R(0, 6.28),
        d = R(0.2, 0.7) * r;
      em({ x: x + Math.cos(a) * d, y: g + 0.05, z: z + Math.sin(a) * d, vx: Math.cos(a) * 0.6, vz: Math.sin(a) * 0.6, drag: 2, life: 0.8, s0: 0.35, s1: 0.7, cell: c.foam, mode: 1, a: 0.8, a1: 0, rot: R(0, 6) });
    }
    decal(x, g, z, r * 1.8, c.splat, L.water, 0.3, 1.2);
  };

  B.iceShardHit = function (p, o) {
    const c = C(),
      L = pal();
    const r = Math.max(0.5, (o.radius || 0.6) * TILE * 0.5);
    const x = p.x,
      g = p.y,
      z = p.z,
      y = g + (o.h === undefined ? 1.0 : o.h);
    flash(x, y, z, 2.0, L.iceW, 0.16, 0.9);
    for (let i = 0, k = n(12); i < k; i++) {
      _.sphereDir(tv[0], 0.4);
      em({ x, y, z, vx: tv[0].x * 4.5, vy: tv[0].y * 4 + 1.2, vz: tv[0].z * 4.5, drag: 2, grav: 6, life: R(0.45, 0.8), s0: R(0.2, 0.34), s1: 0.06, cell: rnd() < 0.5 ? c.shard : c.crystal, r: L.iceW[0], g: L.iceW[1], b: L.iceW[2], a: 1, a1: 0, add: 0.3, rot: R(0, 6), spin: R(-8, 8), floor: g + 0.05 });
    }
    for (let i = 0, k = n(8); i < k; i++) {
      _.sphereDir(tv[0], 0.2);
      em({ x: x + tv[0].x * 0.3, y: y + tv[0].y * 0.3, z: z + tv[0].z * 0.3, vx: tv[0].x * 1.5, vy: tv[0].y * 1.5, vz: tv[0].z * 1.5, drag: 3, life: R(0.5, 0.8), s0: 0.35, s1: 0.9, cell: c.puffDark, r: L.ice[0], g: L.ice[1], b: L.ice[2], a: 0.5, a1: 0, rot: R(0, 6), curve: 1 });
    }
    for (let i = 0, k = n(8); i < k; i++) em({ x: x + R(-0.5, 0.5), y: y + R(-0.3, 0.4), z: z + R(-0.5, 0.5), vy: R(0.3, 0.9), life: R(0.4, 0.7), s0: 0.05, s1: 0.4, cell: c.twinkle, r: 1, g: 1, b: 1, a: 1, a1: 0, add: 1, curve: 2, spin: 4, delay: R(0, 0.2) });
    ring(x, g, z, 0.3, r * 2, 0.4, L.iceW, 0.9, 0.5);
    decal(x, g, z, r * 1.9, c.frost, L.ice, 0.85, 1.3, 0.4);
    if (_.debris) _.debris("ice", tv[1].set(x, y, z), n(5), { speed: 3.5, up: 3.5, size: 0.22, spread: 0.3, floor: g });
  };

  B.darkWaterHit = function (p, o) {
    const c = C(),
      L = pal();
    const r = Math.max(0.5, (o.radius || 0.7) * TILE * 0.5);
    const x = p.x,
      g = p.y,
      z = p.z,
      y = g + (o.h === undefined ? 1.0 : o.h);
    flash(x, y, z, 1.8, L.violet, 0.18, 0.9);
    em({ x, y: g + 0.7, z, life: 0.45, s0: 1.2, s1: 2.0, cell: c.splash, mode: 3, r: L.violetL[0], g: L.violetL[1], b: L.violetL[2], a: 0.95, a1: 0, curve: 1 });
    for (let i = 0, k = n(14); i < k; i++) {
      const a = R(0, 6.28),
        sp = R(1.2, 3);
      em({ x: x + Math.cos(a) * 0.2, y, z: z + Math.sin(a) * 0.2, vx: Math.cos(a) * sp, vy: R(2.5, 5), vz: Math.sin(a) * sp, grav: 13, life: R(0.5, 0.8), s0: R(0.13, 0.22), s1: 0.08, cell: c.drop, mode: 2, stretch: 0.04, r: L.violetL[0], g: L.violetL[1], b: L.violetL[2], r1: L.violet[0], g1: L.violet[1], b1: L.violet[2], a: 1, a1: 0.4, add: 0.3, floor: g });
    }
    // étincelles de mana qui montent
    for (let i = 0, k = n(12); i < k; i++) em({ x: x + R(-0.5, 0.5), y: y + R(-0.3, 0.3), z: z + R(-0.5, 0.5), vx: R(-0.4, 0.4), vy: R(1.8, 3.6), vz: R(-0.4, 0.4), grav: -1.5, drag: 1, life: R(0.7, 1.1), s0: R(0.14, 0.24), s1: 0.03, cell: c.twinkle, r: L.manaL[0], g: L.manaL[1], b: L.manaL[2], r1: L.mana[0], g1: L.mana[1], b1: L.mana[2], a: 1, a1: 0, add: 1, rot: R(0, 6), spin: R(-5, 5), delay: R(0, 0.25) });
    ring(x, g, z, 0.3, r * 2, 0.6, L.violetL, 0.85, 0.4, c.ripple);
    em({ x, y: g + 0.05, z, life: 0.9, s0: r * 1.2, s1: r * 1.6, cell: c.rune, mode: 1, r: L.violetL[0], g: L.violetL[1], b: L.violetL[2], a: 0.9, a1: 0, add: 1, rot: R(0, 6), spin: 2, fadeIn: 0.1 });
    decal(x, g, z, r * 1.8, c.splat, L.violet, 0.35, 1.2, 0.4);
  };

  function fireBurst(p, o, big, blue) {
    const c = C(),
      L = pal();
    const r = Math.max(0.6, (o.radius || (big ? 0.9 : 0.35)) * TILE * 0.5);
    const x = p.x,
      g = p.y,
      z = p.z,
      y = g + (o.h === undefined ? 1.0 : o.h);
    const c1 = blue ? L.bLight : L.fireO,
      c2 = blue ? L.bDeep : L.fireR,
      c0 = blue ? L.bLight : L.fireCore;
    flash(x, y, z, r * 2.6, c0, 0.18);
    // flammes de dessin animé qui jaillissent (bicolores pour le feu, teintées pour le feu bleu)
    for (let i = 0, k = n(big ? 7 : 4); i < k; i++) {
      const a = R(0, 6.28),
        d = R(0.1, 0.6) * r;
      em({ x: x + Math.cos(a) * d, y: g + 0.2, z: z + Math.sin(a) * d, vx: Math.cos(a) * 0.8, vy: R(2, 3.5), vz: Math.sin(a) * 0.8, drag: 2, life: R(0.4, 0.6), s0: r * 0.5, s1: r * 0.15, cell: blue ? c.flameB : c.flame, mode: 3, r: blue ? L.bLight[0] : 1, g: blue ? L.bLight[1] : 1, b: blue ? L.bLight[2] : 1, a: 1, a1: 0, add: blue ? 0.8 : 0.15, curve: 2, fadeOut: 0.6 });
    }
    for (let i = 0, k = n(big ? 14 : 8); i < k; i++) {
      _.sphereDir(tv[0], 0.6);
      const sp = R(1.2, 2.6) * r;
      em({ x: x + tv[0].x * r * 0.2, y: y + tv[0].y * r * 0.2, z: z + tv[0].z * r * 0.2, vx: tv[0].x * sp, vy: tv[0].y * sp + 0.8, vz: tv[0].z * sp, drag: 5, life: R(0.45, 0.7), s0: r * 0.5, s1: r * R(0.9, 1.3), cell: c.puff, r: c1[0], g: c1[1], b: c1[2], r1: c2[0], g1: c2[1], b1: c2[2], a: 1, a1: 0, add: blue ? 0.7 : 0.45, rot: R(0, 6), spin: R(-1, 1), curve: 1, fadeOut: 0.6 });
    }
    for (let i = 0, k = n(big ? 18 : 10); i < k; i++) {
      _.sphereDir(tv[0], 0.5);
      const sp = R(5, 10) * Math.sqrt(r);
      em({ x, y, z, vx: tv[0].x * sp, vy: Math.abs(tv[0].y) * sp * 0.8 + 2, vz: tv[0].z * sp, grav: 12, drag: 0.8, life: R(0.35, 0.65), s0: 0.13, s1: 0.04, cell: blue ? c.twinkle : c.spark, mode: blue ? 0 : 2, stretch: 0.045, r: c1[0], g: c1[1], b: c1[2], r1: c2[0], g1: c2[1], b1: c2[2], a: 1, a1: 0.5, add: 1, floor: g });
    }
    for (let i = 0, k = n(big ? 5 : 3); i < k; i++) {
      _.sphereDir(tv[0], 0.8);
      em({ x: x + tv[0].x * r * 0.3, y: y + r * 0.6, z: z + tv[0].z * r * 0.3, vx: tv[0].x * r * 0.5, vy: R(1.8, 3), vz: tv[0].z * r * 0.5, drag: 2, life: R(0.7, 0.95), s0: r * 0.4, s1: r * 0.9, cell: c.puff, r: blue ? 0.3 : L.smokeL[0], g: blue ? 0.35 : L.smokeL[1], b: blue ? 0.5 : L.smokeL[2], a: 0.45, a1: 0, rot: R(0, 6), curve: 1, delay: 0.22 });
    }
    ring(x, g, z, r * 0.4, r * 2.4, 0.38, blue ? c0 : L.fireY, 0.9, 0.5);
    decal(x, g, z, r * 1.8, c.scorch, L.black, 0.4, 1.3);
    if (big) {
      // flammes qui dansent sur la zone brûlante
      for (let i = 0, k = n(9); i < k; i++) {
        const a = R(0, 6.28),
          d = Math.sqrt(rnd()) * r;
        em({ x: x + Math.cos(a) * d, y: g + 0.3, z: z + Math.sin(a) * d, vy: R(0.5, 1.2), life: R(0.7, 1.1), s0: R(0.5, 0.8), s1: 0.2, cell: c.flameB, mode: 3, r: c1[0], g: c1[1], b: c1[2], r1: c2[0], g1: c2[1], b1: c2[2], a: 1, a1: 0, add: 0.8, delay: R(0.05, 0.35), curve: 2 });
      }
      FX.shake = Math.max(FX.shake, Math.min(0.6, r * 0.15));
    }
    return { x, y, z, g, r };
  }
  B.fireballHit = (p, o) => fireBurst(p, o, false, false);
  B.dragonFireHit = (p, o) => fireBurst(p, o, true, false);
  B.blueFireHit = function (p, o) {
    const q = fireBurst(p, o, false, true);
    const c = C(),
      L = pal();
    // L'œil qui brille : la cible est marquée (rayonnement).
    const ey = q.y + 1.1;
    em({ x: q.x, y: ey, z: q.z, vy: 0.5, life: 1.0, s0: 0.2, s1: 1.1, cell: c.glow, r: L.bFire[0], g: L.bFire[1], b: L.bFire[2], a: 0.9, a1: 0, add: 1, curve: 2 });
    em({ x: q.x, y: ey, z: q.z, vy: 0.5, life: 1.0, s0: 0.1, s1: 0.75, cell: c.eyeWhite, r: L.manaL[0], g: L.manaL[1], b: L.manaL[2], a: 1, a1: 0, add: 0.4, curve: 2, fadeOut: 0.65, aspect: 1.35 });
    em({ x: q.x, y: ey, z: q.z, vy: 0.5, life: 1.0, s0: 0.06, s1: 0.36, cell: c.pupil, r: L.bDeep[0], g: L.bDeep[1], b: L.bDeep[2], a: 1, a1: 0, curve: 2, fadeOut: 0.65 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * 6.28;
      em({ x: q.x + Math.cos(a) * 0.5, y: ey, z: q.z + Math.sin(a) * 0.5, vx: Math.cos(a) * 1.2, vy: 0.4, vz: Math.sin(a) * 1.2, drag: 2, life: 0.6, s0: 0.35, s1: 0.1, cell: c.spark, mode: 2, stretch: 0.08, r: L.bLight[0], g: L.bLight[1], b: L.bLight[2], a: 1, a1: 0, add: 1, delay: 0.1 });
    }
  };

  /** Montée de niveau : colonne d'étincelles dorées, étoiles et anneau au sol. */
  B.levelUp = function (p, o) {
    const c = C(),
      L = pal();
    const x = p.x,
      g = p.y,
      z = p.z,
      H = (o.height || 2.5) + 0.8;
    flash(x, g + H * 0.5, z, 3.2, L.goldL, 0.3, 0.8);
    ring(x, g, z, 0.5, 3.4, 0.6, L.gold, 1, 0.8);
    ring(x, g, z, 0.3, 2.4, 0.8, L.goldL, 0.8, 0.8, c.dashring);
    for (let i = 0, k = n(26); i < k; i++) {
      const a = R(0, 6.28),
        d = R(0.3, 1.3);
      em({ x: x + Math.cos(a) * d, y: g + R(0.1, 0.6), z: z + Math.sin(a) * d, vx: -Math.sin(a) * 0.6, vy: R(2.5, 5.5), vz: Math.cos(a) * 0.6, drag: 1.2, life: R(0.7, 1.2), s0: R(0.14, 0.28), s1: 0.03, cell: c.twinkle, r: L.goldL[0], g: L.goldL[1], b: L.goldL[2], r1: L.goldD[0], g1: L.goldD[1], b1: L.goldD[2], a: 1, a1: 0, add: 1, rot: R(0, 6), spin: R(-5, 5), delay: R(0, 0.35) });
    }
    for (let i = 0, k = n(6); i < k; i++) {
      const a = (i / 6) * 6.28;
      em({ x: x + Math.cos(a) * 0.8, y: g + H, z: z + Math.sin(a) * 0.8, vx: Math.cos(a) * 1.4, vy: R(1, 2), vz: Math.sin(a) * 1.4, grav: 5, life: 0.9, s0: 0.2, s1: 0.4, cell: c.star, a: 1, a1: 0, rot: R(0, 6), spin: R(-4, 4), curve: 2, delay: 0.15 });
    }
    em({ x, y: g + 0.1, z, life: 0.8, s0: 1.5, s1: 3.6, cell: c.glow, mode: 1, r: L.gold[0], g: L.gold[1], b: L.gold[2], a: 0.8, a1: 0, add: 1, curve: 1 });
  };
})();
