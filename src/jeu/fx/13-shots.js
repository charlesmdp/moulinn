// « Pas touche à mes trésors » — tirs, jets et impacts des tours (PTMT.fx, suite de 10-fx.js).
//
//   const p = PTMT.fx.projectile(kind);  p.set(position, direction[, solY]);  p.release();
//   PTMT.fx.burst(kind + "Hit", positionAuSol, { radius (cases), h (hauteur de l'impact, m), crit });
//   const b = PTMT.fx.beam(kind);  b.set(départ, arrivée, chaleur01, temps);  b.release();
//   PTMT.fx.burst("levelUp", positionAuSol, { height });  PTMT.fx.burst("dazzle", positionAuSol, { height });
//
// Projectiles (CONCEPTION.md §3) :
//   chestnut     bogue de châtaigne verte hérissée, liseré sombre, qui tourne sur elle-même (sanglier)
//   bigChestnut  grosse bogue lancée en cloche, ombre au sol si solY est donné (laie baliste, catapulte)
//   waterOrb     boule d'eau translucide qui tremble, gouttes et écume en traînée (cygne 1-3)
//   iceOrb       boule de glace bleue facettée qui vrille, givre et flocons (cygne des glaces)
//   darkOrb      boule d'eau sombre violette, étincelles de mana qui tournent et montent (cygne noir)
//   fireball, dragonFire, blueFire : boules de feu (restent disponibles)
//   anciens noms : waterJet → waterOrb, iceShard → iceOrb, darkWater → darkOrb (projectiles et impacts).
// Impacts : chestnutHit (« !! » si crit), bigChestnutHit (épines et feuilles sur opts.radius cases),
// waterOrbHit (éclaboussure), iceOrbHit (cristaux, givre), darkOrbHit (éclaboussure violette, mana),
// fireballHit, dragonFireHit, blueFireHit, levelUp (colonne dorée), dazzle (flash d'appareil photo).
//
// Jets continus (berger, dragon) : PTMT.fx.beam("fire" | "dragonFire" | "blueFire"). Un ruban de flammes
// face caméra va de la gueule à la cible, ondule, s'épaissit et blanchit avec la chaleur, des langues de feu
// coulent vers la cible, lèchent la cible (flammes qui montent, braises, fumée) ; il s'allonge en 0,1 s à
// l'ouverture et se détache de la gueule en s'éteignant au release(). Tous les jets partagent UN maillage
// (sommets réécrits à chaque image, un seul appel de dessin) ; les flammes passent par les lots de particules.
//
// Le rendu déplace les projectiles selon la simulation (position et direction à chaque image) : aucune
// trajectoire propre. Les corps 3D sont des maillages instanciés partagés (un ou deux appels de dessin par
// sorte, quel que soit le nombre de projectiles). Aucune allocation par image (recettes préparées une fois).
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
  const AX = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };

  // Anciens noms des tirs du cygne (v3) : mêmes effets sous les nouveaux noms.
  _.ALIAS = Object.assign(_.ALIAS || {}, { waterJet: "waterOrb", iceShard: "iceOrb", darkWater: "darkOrb" });

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
      waterD: c("#1a7fd0"),
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
      dragonTint: c("#ffb0a0"),
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
  function huskGeo(r, spike) {
    const K = PTMT.models && PTMT.models.kit;
    if (K && K.g && K.g.husk) return K.g.husk(r, spike).clone();
    return new THREE.IcosahedronGeometry(r * 1.4, 1);
  }
  function nutGeo(r) {
    const K = PTMT.models && PTMT.models.kit;
    if (K && K.g && K.g.nut) return K.g.nut(r).clone();
    return new THREE.SphereGeometry(r, 8, 6);
  }
  /** Boule d'eau qui tremble (bosses douces), étirée vers l'avant (+Z). */
  function orbGeo(r, detail, stretch, wob) {
    const g = new THREE.IcosahedronGeometry(r, detail);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        y = p.getY(i),
        z = p.getZ(i);
      const k = 1 + wob * Math.sin(x * 11 + y * 7) + wob * 0.7 * Math.sin(z * 13 - y * 5);
      p.setXYZ(i, x * k, y * k, z * (k + stretch));
    }
    g.computeVertexNormals();
    return g;
  }
  const GEO = {
    chestnut: () =>
      mergeColored([
        [huskGeo(0.25, 2.0), "#a8e040"],
        [nutGeo(0.15).translate(0, 0.21, 0.05), "#8a4a22"],
      ]),
    bigChestnut: () =>
      mergeColored([
        [huskGeo(0.36, 1.95), "#a8e040"],
        [nutGeo(0.22).rotateZ(0.5).translate(0.15, 0.35, 0.02), "#8a4a22"],
        [nutGeo(0.21).rotateZ(-0.6).translate(-0.17, 0.33, -0.06), "#9a5426"],
      ]),
    waterOrb: () => orbGeo(0.32, 2, 0.12, 0.05),
    iceOrb: () => {
      const g = new THREE.IcosahedronGeometry(0.36, 0); // facettes franches
      g.scale(1, 1, 1.18);
      return g;
    },
    darkOrb: () => orbGeo(0.33, 2, 0.2, 0.07),
  };
  // Matières des corps.
  function chestnutMat() {
    return PTMT.mat("tirs:bogue", () => {
      const m = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.55, metalness: 0, emissive: PTMT.color("#2a4a10"), emissiveIntensity: 1 });
      m.name = "ptmt:tirs:bogue";
      return m;
    });
  }
  function waterOrbMat() {
    return _.shader(
      "waterOrb",
      /* glsl */ `
      void main(){
        vec3 N = normalize(vN);
        vec3 V = normalize(cameraPosition - vW);
        float fres = pow(1.0 - abs(dot(N, V)), 2.0);
        float n = ptNoise3(vL * 7.0 + vec3(0.0, uTime * 2.6, uTime * 1.4));
        vec3 col = mix(vec3(0.02, 0.28, 0.66), vec3(0.3, 0.86, 1.0), 0.3 + 0.45 * n + 0.45 * fres);
        col = mix(col, vec3(0.92, 1.0, 1.0), smoothstep(0.66, 0.8, n) * 0.6);
        vec3 L = normalize(vec3(-0.35, 0.85, 0.45));
        col += vec3(1.0) * pow(max(dot(reflect(-L, N), V), 0.0), 26.0) * 1.6;
        gl_FragColor = vec4(col, 0.78 + 0.22 * fres);
        OUT_COLOR
      }`,
      { transparent: true, depthWrite: false },
    );
  }
  function iceOrbMat() {
    return _.shader(
      "iceOrb",
      /* glsl */ `
      void main(){
        vec3 N = normalize(cross(dFdx(vW), dFdy(vW)));
        vec3 V = normalize(cameraPosition - vW);
        if (dot(N, V) < 0.0) N = -N;
        float fres = pow(1.0 - abs(dot(N, V)), 2.0);
        vec3 L = normalize(vec3(-0.35, 0.85, 0.45));
        float diff = max(dot(N, L), 0.0);
        vec3 col = mix(vec3(0.04, 0.34, 0.95), vec3(0.62, 0.92, 1.0), 0.25 + 0.5 * diff + 0.4 * fres);
        col += vec3(0.1, 0.35, 0.6) * 0.5;
        col += vec3(1.0) * pow(max(dot(reflect(-L, N), V), 0.0), 18.0) * 1.4;
        gl_FragColor = vec4(col, 0.92);
        OUT_COLOR
      }`,
      { transparent: true, depthWrite: true, extensions: { derivatives: true } },
    );
  }
  function darkOrbMat() {
    return _.shader(
      "darkOrb",
      /* glsl */ `
      void main(){
        vec3 N = normalize(vN);
        vec3 V = normalize(cameraPosition - vW);
        float fres = pow(1.0 - abs(dot(N, V)), 2.0);
        float n = ptFbm(vL.xy * 5.0 + vec2(uTime * 1.3, -uTime * 2.1));
        float swirl = smoothstep(0.52, 0.7, n);
        vec3 col = mix(vec3(0.07, 0.02, 0.16), vec3(0.4, 0.1, 0.78), 0.35 + 0.45 * n);
        col = mix(col, vec3(0.55, 0.75, 1.0), swirl * 0.8);
        col += vec3(0.75, 0.4, 1.0) * fres * 1.3;
        gl_FragColor = vec4(col, 0.9 + 0.1 * fres);
        OUT_COLOR
      }`,
      { transparent: true, depthWrite: false },
    );
  }
  const MAT = {
    chestnut: chestnutMat,
    bigChestnut: chestnutMat,
    waterOrb: waterOrbMat,
    iceOrb: iceOrbMat,
    darkOrb: darkOrbMat,
  };
  /** Liseré sombre (coque retournée instanciée, un peu plus grande) : lisibles sur l'herbe comme sur l'eau. */
  const HULL = { chestnut: [1.22, "#16200c"], bigChestnut: [1.15, "#16200c"], waterOrb: [1.16, "#0a2a5a"], iceOrb: [1.14, "#0e2a5a"], darkOrb: [1.15, "#12062a"] };
  function hullMat(hex) {
    return PTMT.mat("tirs:liseré:" + hex, () => new THREE.MeshBasicMaterial({ color: PTMT.color(hex), side: THREE.BackSide }));
  }
  function instanced(geo, mat, cap, name, order) {
    const mesh = new THREE.InstancedMesh(geo, mat, cap);
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.castShadow = false;
    mesh.renderOrder = order || 5;
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
      const geo = _.geo("tirs4:" + kind, GEO[kind]);
      const mesh = instanced(geo, MAT[kind](), cap, "ptmt:tirs:" + kind, 6);
      const h = HULL[kind];
      const hull = h ? instanced(geo, hullMat(h[1]), cap, "ptmt:tirs:" + kind + ":liseré", 5) : null;
      b = S.shotBodies[kind] = { mesh, hull, hs: h ? h[0] : 1, free: [], n: 0, cap };
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
  /** Place le corps : orienté selon la direction de vol, rotation propre (culbute autour de X ou vrille autour de Z). */
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
      streak: { drag: 3, life: 0.16, s0: 0.24, s1: 0.1, cell: c.spark, mode: 2, stretch: 0.06, col: L.cream, a: 0.5, a1: 0, add: 0.6 },
      drop: { grav: 9, life: [0.3, 0.5], s0: [0.08, 0.14], s1: 0.05, cell: c.drop, mode: 2, stretch: 0.05, col: L.waterL, col1: L.water, a: 0.95, a1: 0.3 },
      wstreak: { drag: 2.5, life: 0.22, s0: 0.3, s1: 0.12, cell: c.spark, mode: 2, stretch: 0.07, col: L.waterL, col1: L.water, a: 0.8, a1: 0, add: 0.3 },
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
      // jets continus (couleurs réglées par sorte avant chaque émission)
      jFlow: { drag: 0.5, life: [0.26, 0.36], s0: [0.3, 0.42], s1: [0.6, 0.9], cell: c.flameB, col: L.fireY, col1: L.fireR, a: 0.85, a1: 0, add: 0.55, rot: "rand", spin: [-2, 2], curve: 1, fadeOut: 0.7 },
      jLick: { drag: 1.8, life: [0.32, 0.5], s0: [0.6, 0.9], s1: 0.15, cell: c.flame, mode: 3, col: L.white, a: 1, a1: 0, add: 0.2, curve: 2 },
      jEmber: { grav: 6, drag: 0.6, life: [0.35, 0.7], s0: [0.09, 0.14], s1: 0.03, cell: c.spark, mode: 2, stretch: 0.05, col: L.fireY, col1: L.fireR, a: 1, a1: 0.3, add: 1 },
      jSmoke: { drag: 1.2, life: [0.8, 1.2], s0: [0.4, 0.6], s1: [1.2, 1.7], cell: c.puffDark, col: L.smoke, a: 0.45, a1: 0, rot: "rand", spin: [-0.6, 0.6], curve: 1 },
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
    const k = 1 / (1 + h * 0.15);
    put(p.pos.x, p.ground + 0.03, p.pos.z, size * (0.7 + 0.5 * k), C().shadow, pal().black, 0.55 * k, 0, 0, 1);
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
      put(p.pos.x, p.pos.y, p.pos.z, 1.0, c.glow, L.cream, 0.28, 0, 1);
      groundShadow(p, 0.55);
    },
    trail(p, at) {
      const T = rec(),
        P2 = _.S.P,
        d = p.dir;
      P2.emitR(T.streak, at.x, at.y, at.z, -d.x * 2, -d.y * 2, -d.z * 2);
      if (rnd() < 0.3) P2.emitR(T.leaf, at.x, at.y, at.z, R(-1, 1), R(0, 1.2), R(-1, 1));
      if (rnd() < 0.2) P2.emitR(T.dust, at.x, at.y, at.z, R(-0.3, 0.3), R(0, 0.4), R(-0.3, 0.3));
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
      put(p.pos.x, p.pos.y, p.pos.z, 1.8, c.glow, L.cream, 0.3, 0, 1);
      groundShadow(p, 1.3);
    },
    trail(p, at) {
      const T = rec(),
        P2 = _.S.P;
      if (rnd() < 0.55) P2.emitR(T.leaf, at.x + R(-0.2, 0.2), at.y, at.z + R(-0.2, 0.2), R(-1.2, 1.2), R(0, 1.5), R(-1.2, 1.2));
      P2.emitR(T.dust, at.x, at.y, at.z, R(-0.4, 0.4), R(0, 0.5), R(-0.4, 0.4));
    },
  };
  K.waterOrb = {
    spacing: 0.13,
    start: bodyStart,
    free: bodyFree,
    place(p) {
      const w = 1 + 0.09 * Math.sin(p.t * 26 + p.seed);
      bodyPlace(p, "z", p.t * 5, w, 2 - w, 1);
    },
    head(p) {
      const c = C(),
        L = pal();
      put(p.pos.x, p.pos.y, p.pos.z, 1.15, c.glow, L.water, 0.4, 0, 1);
      put(p.pos.x - p.dir.x * 0.05, p.pos.y + 0.12, p.pos.z - p.dir.z * 0.05, 0.42, c.twinkle, L.foam, 0.9, p.t * 4, 0.7);
    },
    trail(p, at) {
      const T = rec(),
        P2 = _.S.P,
        d = p.dir;
      P2.emitR(T.wstreak, at.x, at.y, at.z, -d.x * 2.5, -d.y * 2.5, -d.z * 2.5);
      P2.emitR(T.drop, at.x + R(-0.12, 0.12), at.y + R(-0.1, 0.1), at.z + R(-0.12, 0.12), R(-0.8, 0.8) + d.x * 1.2, R(0.3, 1.4), R(-0.8, 0.8) + d.z * 1.2);
      if (rnd() < 0.4) P2.emitR(T.foam, at.x, at.y, at.z, R(-0.3, 0.3), R(-0.1, 0.3), R(-0.3, 0.3));
    },
  };
  K.iceOrb = {
    spacing: 0.17,
    start: bodyStart,
    free: bodyFree,
    place(p) {
      bodyPlace(p, "z", p.t * 9 + p.seed, 1, 1, 1);
    },
    head(p) {
      const c = C(),
        L = pal();
      put(p.pos.x, p.pos.y, p.pos.z, 1.35, c.glow, L.ice, 0.45, 0, 0.5);
      put(p.pos.x, p.pos.y + 0.05, p.pos.z, 0.7, c.twinkle, L.iceW, 0.95, _.S.time * 3, 0.6);
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
  K.darkOrb = {
    spacing: 0.15,
    start: bodyStart,
    free: bodyFree,
    place(p) {
      const w = 1 + 0.1 * Math.sin(p.t * 17 + p.seed);
      bodyPlace(p, "z", p.t * 6, w, 2 - w, 1);
    },
    head(p) {
      const c = C(),
        L = pal(),
        t = _.S.time;
      put(p.pos.x, p.pos.y, p.pos.z, 1.45, c.glow, L.violet, 0.55, 0, 1);
      for (let i = 0; i < 2; i++) {
        const a = t * 9 + i * Math.PI + p.seed;
        put(p.pos.x + Math.cos(a) * 0.45, p.pos.y + Math.sin(a * 0.7) * 0.2, p.pos.z + Math.sin(a) * 0.45, 0.42, c.twinkle, L.manaL, 1, a, 1);
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
    em({ x, y, z, life: 0.22, s0: 0.4, s1: 1.3, cell: c.zap, r: L.husk[0], g: L.husk[1], b: L.husk[2], a: 1, a1: 0, add: 0.3, rot: R(0, 6), curve: 1 });
    // épines, feuilles, châtaignes qui rebondissent, poussière
    for (let i = 0, k = n(10); i < k; i++) {
      _.sphereDir(tv[0], 0.3);
      const sp = R(4, 7);
      em({ x, y, z, vx: tv[0].x * sp, vy: tv[0].y * sp * 0.7 + 1.5, vz: tv[0].z * sp, grav: 10, life: R(0.25, 0.4), s0: 0.17, s1: 0.05, cell: c.spark, mode: 2, stretch: 0.05, r: L.husk[0], g: L.husk[1], b: L.husk[2], r1: L.huskD[0], g1: L.huskD[1], b1: L.huskD[2], a: 1, a1: 0.3 });
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
    for (let i = 0, k = n(24); i < k; i++) {
      const a = (i / 24) * 6.28 + R(-0.1, 0.1),
        sp = R(6, 10) * Math.sqrt(r);
      em({ x, y, z, vx: Math.cos(a) * sp, vy: R(1.5, 4), vz: Math.sin(a) * sp, grav: 12, drag: 0.6, life: R(0.35, 0.55), s0: 0.24, s1: 0.06, cell: c.spark, mode: 2, stretch: 0.05, r: L.husk[0], g: L.husk[1], b: L.husk[2], r1: L.huskD[0], g1: L.huskD[1], b1: L.huskD[2], a: 1, a1: 0.4, floor: g + 0.05 });
    }
    for (let i = 0, k = n(14); i < k; i++) em({ x: x + R(-0.4, 0.4), y: y + 0.2, z: z + R(-0.4, 0.4), vx: R(-3, 3) * Math.sqrt(r), vy: R(2, 5), vz: R(-3, 3) * Math.sqrt(r), grav: 5, drag: 1.2, life: R(0.8, 1.2), s0: R(0.24, 0.36), s1: 0.12, cell: c.leaf, a: 1, a1: 0, rot: R(0, 6), spin: R(-10, 10), floor: g + 0.05, fadeOut: 0.7 });
    // morceaux de bogue et châtaignes qui rebondissent
    for (let i = 0, k = n(6); i < k; i++) em({ x, y: y + 0.2, z, vx: R(-3, 3), vy: R(3, 6), vz: R(-3, 3), grav: 14, life: R(0.8, 1.1), s0: 0.3, s1: 0.22, cell: c.shard, r: L.husk[0], g: L.husk[1], b: L.husk[2], a: 1, a1: 0.7, rot: R(0, 6), spin: R(-9, 9), floor: g + 0.08, fadeOut: 0.75 });
    for (let i = 0, k = n(6); i < k; i++) em({ x, y: y + 0.2, z, vx: R(-3.5, 3.5), vy: R(3, 6), vz: R(-3.5, 3.5), grav: 14, life: R(0.9, 1.3), s0: 0.26, s1: 0.24, cell: c.drop, r: L.nut[0], g: L.nut[1], b: L.nut[2], a: 1, a1: 0.8, rot: R(2.6, 3.6), spin: R(-6, 6), floor: g + 0.12, fadeOut: 0.8 });
    decal(x, g, z, r * 1.5, c.splat, L.dirt, 0.5, 1.4);
    if (o.crit) crit(x, y + 0.6, z);
    FX.shake = Math.max(FX.shake, Math.min(0.5, r * 0.12));
  };

  B.waterOrbHit = function (p, o) {
    const c = C(),
      L = pal();
    const r = Math.max(0.5, (o.radius || 0.55) * TILE * 0.5);
    const x = p.x,
      g = p.y,
      z = p.z,
      y = g + (o.h === undefined ? 1.0 : o.h);
    flash(x, y, z, 1.8, L.waterL, 0.16, 0.9);
    em({ x, y: y - 0.1, z, life: 0.5, s0: 1.4, s1: 2.5, cell: c.splash, mode: 3, r: L.foam[0], g: L.foam[1], b: L.foam[2], a: 1, a1: 0, curve: 1 });
    em({ x, y: g + 0.6, z, life: 0.5, s0: 1.3, s1: 2.2, cell: c.splash, mode: 3, r: L.water[0], g: L.water[1], b: L.water[2], a: 0.9, a1: 0, curve: 1, delay: 0.05 });
    for (let i = 0, k = n(18); i < k; i++) {
      const a = R(0, 6.28),
        sp = R(1.2, 3.4);
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

  B.iceOrbHit = function (p, o) {
    const c = C(),
      L = pal();
    const r = Math.max(0.5, (o.radius || 0.6) * TILE * 0.5);
    const x = p.x,
      g = p.y,
      z = p.z,
      y = g + (o.h === undefined ? 1.0 : o.h);
    flash(x, y, z, 2.0, L.iceW, 0.16, 0.9);
    for (let i = 0, k = n(14); i < k; i++) {
      _.sphereDir(tv[0], 0.4);
      em({ x, y, z, vx: tv[0].x * 4.5, vy: tv[0].y * 4 + 1.2, vz: tv[0].z * 4.5, drag: 2, grav: 6, life: R(0.45, 0.8), s0: R(0.22, 0.36), s1: 0.06, cell: rnd() < 0.5 ? c.shard : c.crystal, r: L.iceW[0], g: L.iceW[1], b: L.iceW[2], a: 1, a1: 0, add: 0.3, rot: R(0, 6), spin: R(-8, 8), floor: g + 0.05 });
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

  B.darkOrbHit = function (p, o) {
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
  // anciens noms
  B.waterJetHit = B.waterOrbHit;
  B.iceShardHit = B.iceOrbHit;
  B.darkWaterHit = B.darkOrbHit;

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

  /** Éblouissement d'une tour (flash du touriste) : éclair blanc, rayons, étoiles qui jaillissent. */
  B.dazzle = function (p, o) {
    const c = C(),
      L = pal();
    const x = p.x,
      g = p.y,
      z = p.z,
      y = g + (o.height || 2) * 0.75;
    flash(x, y, z, 5.2, L.white, 0.22, 1);
    flash(x, y, z, 2.6, L.goldL, 0.35, 0.9);
    em({ x, y, z, life: 0.32, s0: 1.0, s1: 3.6, cell: c.zap, r: 1, g: 1, b: 1, a: 1, a1: 0, add: 0.8, rot: R(0, 6), curve: 1 });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * 6.28;
      em({ x, y, z, vx: Math.cos(a) * 5, vy: Math.sin(a) * 3, vz: Math.sin(a) * 1.5, drag: 4, life: 0.3, s0: 0.5, s1: 0.2, cell: c.spark, mode: 2, stretch: 0.12, r: 1, g: 1, b: 0.9, a: 1, a1: 0, add: 1 });
    }
    for (let i = 0, k = n(5); i < k; i++) em({ x, y: y + 0.2, z, vx: R(-2.5, 2.5), vy: R(1.5, 3), vz: R(-2.5, 2.5), grav: 6, life: 0.7, s0: 0.28, s1: 0.12, cell: c.star, a: 1, a1: 0, spin: R(-8, 8), rot: R(0, 6) });
  };

  /* ---------------------------------------------------------------- jets continus */
  const BEAM_KINDS = { fire: 0, dragonFire: 1, blueFire: 2 };
  const SEG = 20; // tronçons le long d'un jet
  const BEAM_VS = /* glsl */ `
    uniform float uTime;
    attribute vec3 aT;
    attribute vec4 aB;
    attribute vec4 aK;
    varying vec4 vB;
    varying vec4 vK;
    void main(){
      // ruban face caméra : élargi dans le plan de l'écran, perpendiculairement au jet
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vec3 tvw = (modelViewMatrix * vec4(aT, 0.0)).xyz;
      float l = length(tvw.xy);
      vec2 dir = l > 1e-5 ? tvw.xy / l : vec2(1.0, 0.0);
      vec2 nrm = vec2(-dir.y, dir.x);
      float u = aB.x, s = aB.z, heat = aK.y, seed = aK.z;
      // ondulation : vagues qui courent vers la cible, nulles à la gueule
      float env = smoothstep(0.0, 0.3, u) * (1.0 - 0.4 * u);
      float wave = (sin(s * 1.7 - uTime * (9.0 + 6.0 * heat) + seed) * 0.6 + sin(s * 3.3 - uTime * 14.0 + seed * 2.0) * 0.4) * (0.07 + 0.09 * heat) * env;
      mv.xy += nrm * (wave + aB.y * aK.w);
      gl_Position = projectionMatrix * mv;
      vB = aB;
      vK = aK;
    }`;
  const BEAM_FS = /* glsl */ `
    uniform float uTime;
    varying vec4 vB;
    varying vec4 vK;
    NOISE
    void main(){
      float u = vB.x, v = vB.y, s = vB.z, heat = vK.y, seed = vK.z;
      float kind = floor(vK.x + 0.5);
      float speed = 7.0 + 6.0 * heat;
      // bouffées qui filent vers la cible (le jet « pousse »), bords déchiquetés
      float puff = 0.5 + 0.5 * sin(s * 1.5 - uTime * speed + seed);
      float n = ptFbm(vec2(s * 1.1 - uTime * speed * 0.9, v * 1.3 + seed));
      float n2 = ptNoise(vec2(s * 3.0 - uTime * speed * 1.3, v * 2.4 - seed));
      float d = abs(v);
      float edge = 0.46 + 0.3 * n + 0.24 * puff;
      float body = 1.0 - smoothstep(edge - 0.16, edge, d);
      float inner = clamp(1.0 - d / max(edge, 0.05), 0.0, 1.0);
      float coreW = 0.09 + 0.15 * heat + 0.08 * n2;
      float core = 1.0 - smoothstep(coreW * 0.4, coreW, d);
      // bouts : naissance nette à la gueule, fin déchiquetée sur la cible
      float a0 = smoothstep(0.0, 0.04, u);
      float a1 = 1.0 - smoothstep(0.86 + 0.1 * n2, 1.0, u);
      float alpha = body * a0 * a1 * vB.w;
      if (alpha < 0.01) discard;
      vec3 cEdge, cBody, cIn, cCore;
      if (kind < 0.5) {
        cEdge = vec3(0.55, 0.04, 0.0); cBody = vec3(1.0, 0.3, 0.02); cIn = vec3(1.0, 0.62, 0.08); cCore = vec3(1.0, 0.9, 0.5);
      } else if (kind < 1.5) {
        cEdge = vec3(0.42, 0.02, 0.0); cBody = vec3(0.92, 0.12, 0.01); cIn = vec3(1.0, 0.42, 0.04); cCore = vec3(1.0, 0.8, 0.4);
      } else {
        cEdge = vec3(0.03, 0.06, 0.45); cBody = vec3(0.1, 0.35, 1.0); cIn = vec3(0.4, 0.75, 1.0); cCore = vec3(0.85, 0.95, 1.0);
      }
      vec3 col = mix(cEdge, cBody, smoothstep(0.0, 0.35, inner));
      col = mix(col, cIn, smoothstep(0.42, 0.85, inner) * (0.45 + 0.55 * n2) * (0.55 + 0.45 * heat));
      col = mix(col, cCore, core * (0.3 + 0.55 * heat));
      col *= 0.82 + 0.32 * puff;
      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <encodings_fragment>
      // alpha prémultiplié : corps en mélange normal (lisible sur l'herbe claire), cœur un peu additif
      float add = core * 0.5 + inner * 0.12;
      gl_FragColor.rgb *= alpha;
      gl_FragColor.a = alpha * (1.0 - add);
    }`;
  function beamMat() {
    return PTMT.mat("fx:beam", () => {
      const m = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        vertexShader: BEAM_VS,
        fragmentShader: BEAM_FS.replace("NOISE", PTMT.gfx.GLSL.noise),
        transparent: true,
        depthWrite: false,
        depthTest: true,
        side: THREE.DoubleSide,
        blending: THREE.CustomBlending,
        blendEquation: THREE.AddEquation,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneMinusSrcAlphaFactor,
        blendSrcAlpha: THREE.OneFactor,
        blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
      });
      m.name = "ptmt:fx:jet";
      _.timeMats.push(m);
      return m;
    });
  }
  /** Lot de tous les jets : un maillage, sommets réécrits à chaque image, un appel de dessin. */
  function beamBatch() {
    const S = _.S;
    if (S.beamBatch) return S.beamBatch;
    const cap = S.mobile ? 12 : 24;
    const nv = cap * (SEG + 1) * 2;
    const pos = new Float32Array(nv * 3),
      tan = new Float32Array(nv * 3),
      ab = new Float32Array(nv * 4),
      ak = new Float32Array(nv * 4);
    const idx = new Uint16Array(cap * SEG * 6);
    for (let b = 0; b < cap; b++)
      for (let i = 0; i < SEG; i++) {
        const v0 = (b * (SEG + 1) + i) * 2,
          k = (b * SEG + i) * 6;
        idx[k] = v0;
        idx[k + 1] = v0 + 1;
        idx[k + 2] = v0 + 2;
        idx[k + 3] = v0 + 1;
        idx[k + 4] = v0 + 3;
        idx[k + 5] = v0 + 2;
      }
    const geo = new THREE.BufferGeometry();
    const mk = (arr, k) => new THREE.BufferAttribute(arr, k).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute("position", mk(pos, 3));
    geo.setAttribute("aT", mk(tan, 3));
    geo.setAttribute("aB", mk(ab, 4));
    geo.setAttribute("aK", mk(ak, 4));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.setDrawRange(0, 0);
    const mesh = new THREE.Mesh(geo, beamMat());
    mesh.frustumCulled = false;
    mesh.renderOrder = 19;
    mesh.name = "ptmt:jets";
    S.root.add(mesh);
    S.beamBatch = { geo, mesh, cap, pos, tan, ab, ak, used: new Array(cap).fill(null), top: 0, dirty: false };
    return S.beamBatch;
  }
  function batchSync(bb) {
    let top = 0;
    for (let i = 0; i < bb.cap; i++) if (bb.used[i]) top = i + 1;
    bb.top = top;
    bb.geo.setDrawRange(0, top * SEG * 6);
  }

  const _d = V(),
    _m = V(),
    _cb = V();
  /** Direction vers le spectateur (axe arrière de la caméra des effets). */
  function camBack(out) {
    const cam = _.S && _.S.camera;
    if (!cam) return out.set(0, 0.85, 0.53);
    const e = cam.matrixWorld.elements;
    return out.set(e[8], e[9], e[10]).normalize();
  }
  class Beam {
    constructor() {
      this.from = V();
      this.to = V();
      this.dir = new THREE.Vector3(0, 0, 1);
      this.len = 1;
      this.slot = -1;
      this.active = false;
    }
    _start(kind) {
      const bb = beamBatch();
      this.kind = BEAM_KINDS[kind] === undefined ? 0 : BEAM_KINDS[kind];
      this.name = kind;
      this.active = true;
      this.alive = true;
      this.has = false;
      this.heat = 0;
      this.grow = 0;
      this.die = -1;
      this.seed = rnd() * 50;
      this.acc = [rnd(), rnd(), rnd(), rnd()];
      let s = bb.used.indexOf(null);
      this.slot = s;
      if (s >= 0) {
        bb.used[s] = this;
        batchSync(bb);
        this._clear();
      }
      _.S.live.add(this);
      return this;
    }
    /** Départ (gueule), arrivée (cible), chaleur 0..1 ; à appeler à chaque image tant que le jet dure. */
    set(from, to, heat01, time) {
      if (!this.alive) return this;
      this.from.copy(from);
      this.to.copy(to);
      _d.subVectors(to, from);
      this.len = Math.max(0.05, _d.length());
      this.dir.copy(_d).multiplyScalar(1 / this.len);
      this.heat = Math.min(1, Math.max(0, heat01 || 0));
      this.has = true;
      void time;
      this._write();
      return this;
    }
    /** Le jet se détache de la gueule et s'éteint en 0,2 s, puis retourne à la réserve. */
    release() {
      if (!this.alive) return;
      this.alive = false;
      this.die = 0;
    }
    _clear() {
      const bb = _.S.beamBatch;
      const a = bb.ab,
        o = this.slot * (SEG + 1) * 2;
      for (let i = 0; i < (SEG + 1) * 2; i++) a[(o + i) * 4 + 3] = 0;
      bb.geo.attributes.aB.needsUpdate = true;
    }
    _free() {
      const bb = _.S.beamBatch;
      this.active = false;
      _.S.live.delete(this);
      if (bb && this.slot >= 0) {
        this._clear();
        bb.used[this.slot] = null;
        batchSync(bb);
      }
      this.slot = -1;
      _.unpool("beam", this);
    }
    _write() {
      const bb = _.S.beamBatch;
      if (!bb || this.slot < 0 || !this.has) return;
      const k = this.kind,
        h = this.heat;
      const fat = k === 1 ? 1.3 : k === 2 ? 1.1 : 1;
      const w0 = (0.16 + 0.06 * h) * fat,
        w1 = (0.52 + 0.46 * h) * fat;
      // naissance : le jet s'allonge depuis la gueule ; extinction : il s'en détache
      const g = Math.min(1, this.grow);
      const lo = this.die >= 0 ? Math.min(1, this.die / 0.2) : 0;
      const fade = this.die >= 0 ? 1 - lo * 0.7 : 1;
      const o = this.slot * (SEG + 1) * 2;
      const P = bb.pos,
        T = bb.tan,
        A = bb.ab,
        Kk = bb.ak;
      const L = this.len;
      for (let i = 0; i <= SEG; i++) {
        const u0 = i / SEG;
        const u = lo + (g - lo) * u0; // portion visible du jet
        _m.copy(this.from).addScaledVector(this.dir, L * u);
        _m.y += Math.sin(Math.PI * u) * Math.min(0.5, L * 0.04); // légère courbe vers le haut
        // largeur : fine à la gueule, large sur la cible, renflée au bout (les flammes s'écrasent)
        const w = (w0 + (w1 - w0) * Math.pow(u, 0.7)) * (1 + 0.45 * Math.max(0, (u - 0.78) / 0.22)) * (this.die >= 0 ? 1 + lo * 0.5 : 1);
        for (let sd = 0; sd < 2; sd++) {
          const vi = o + i * 2 + sd;
          P[vi * 3] = _m.x;
          P[vi * 3 + 1] = _m.y;
          P[vi * 3 + 2] = _m.z;
          T[vi * 3] = this.dir.x;
          T[vi * 3 + 1] = this.dir.y;
          T[vi * 3 + 2] = this.dir.z;
          A[vi * 4] = u0;
          A[vi * 4 + 1] = sd ? 1 : -1;
          A[vi * 4 + 2] = L * u;
          A[vi * 4 + 3] = fade;
          Kk[vi * 4] = k;
          Kk[vi * 4 + 1] = h;
          Kk[vi * 4 + 2] = this.seed;
          Kk[vi * 4 + 3] = w;
        }
      }
      const at = bb.geo.attributes;
      at.position.needsUpdate = at.aT.needsUpdate = at.aB.needsUpdate = at.aK.needsUpdate = true;
    }
    frame(dt) {
      if (!this.active) return;
      if (this.die >= 0) {
        this.die += dt;
        if (this.die >= 0.2) return this._free();
        this._write();
        return;
      }
      if (!this.has) return;
      this.grow = Math.min(1, this.grow + dt / 0.1);
      this._write();
      this._emit(dt);
    }
    /** Flammes qui coulent vers la cible, flammes qui lèchent la cible, braises, fumée ; lueurs posées. */
    _emit(dt) {
      const S = _.S,
        L = pal(),
        T = rec(),
        c = C(),
        P2 = S.P;
      const k = this.kind,
        h = this.heat,
        q = S.Q;
      const blue = k === 2,
        big = k === 1;
      const cY = blue ? L.bLight : L.fireY,
        cR = blue ? L.bDeep : big ? L.fireR : L.fireO,
        cC = blue ? L.bCore : L.fireCore;
      const f = this.from,
        to = this.to,
        d = this.dir,
        len = this.len;
      // lueurs : gueule et point d'impact
      put(f.x, f.y, f.z, (0.7 + 0.6 * h) * (big ? 1.25 : 1), c.glow, cY, 0.85, 0, 1);
      if (this.grow >= 1) {
        put(to.x, to.y, to.z, (1.3 + 1.5 * h) * (big ? 1.25 : 1), c.glow, blue ? L.bFire : L.fireO, 0.55 + 0.3 * h, 0, 1);
        put(to.x, to.y, to.z, 0.6 + 0.6 * h, c.glow, cC, 0.8, 0, 1);
      }
      // langues de feu qui coulent le long du jet
      const sp = len / 0.32;
      T.jFlow.col = cY;
      T.jFlow.col1 = cR;
      T.jFlow.s1[0] = 0.55 + 0.45 * h;
      T.jFlow.s1[1] = 0.8 + 0.6 * h;
      this.acc[0] += dt * (16 + 18 * h) * q * (big ? 1.3 : 1);
      while (this.acc[0] >= 1) {
        this.acc[0] -= 1;
        const j = R(0, 0.15);
        P2.emitR(T.jFlow, f.x + d.x * len * j, f.y + d.y * len * j, f.z + d.z * len * j, d.x * sp + R(-0.4, 0.4), d.y * sp + R(-0.2, 0.5), d.z * sp + R(-0.4, 0.4));
      }
      if (this.grow < 1) return;
      // grandes flammes posées sur la cible (elle brûle) et flammes qui lèchent la cible en montant
      const fl = 0.85 + 0.15 * Math.sin(S.time * 31 + this.seed) + 0.08 * Math.sin(S.time * 17);
      const fz = (1.0 + 0.9 * h) * (big ? 1.2 : 1) * fl;
      const fc = blue ? L.bLight : big ? L.dragonTint : L.white;
      // posées en avant de la cible (vers la caméra) : sinon son corps les cacherait
      camBack(_cb);
      const ox = to.x + _cb.x * 0.6,
        oy = to.y + _cb.y * 0.6,
        oz = to.z + _cb.z * 0.6;
      put(ox - d.z * 0.22, oy - 0.3 + fz * 0.3, oz + d.x * 0.22, fz, blue ? c.flameB : c.flame, fc, 1, Math.sin(S.time * 9) * 0.12, blue ? 0.6 : 0.2, 3, 0.85);
      put(ox + d.z * 0.25, oy - 0.35 + fz * 0.25, oz - d.x * 0.25, fz * 0.78, blue ? c.flameB : c.flame, fc, 1, -Math.sin(S.time * 11) * 0.12, blue ? 0.6 : 0.2, 3, 0.85);
      T.jLick.cell = blue ? c.flameB : c.flame;
      T.jLick.col = blue ? L.bLight : big ? L.dragonTint : L.white;
      T.jLick.col1 = blue ? L.bFire : T.jLick.col;
      T.jLick.add = blue ? 0.65 : 0.2;
      T.jLick.s0[0] = 0.55 + 0.35 * h;
      T.jLick.s0[1] = 0.8 + 0.55 * h;
      this.acc[1] += dt * (10 + 22 * h) * q;
      while (this.acc[1] >= 1) {
        this.acc[1] -= 1;
        const a = R(0, 6.28),
          r = R(0.1, 0.45);
        P2.emitR(T.jLick, ox + Math.cos(a) * r, oy + R(-0.5, 0.2), oz + Math.sin(a) * r * 0.5, Math.cos(a) * 0.6 + d.x * 0.8, R(1.8, 3.2), Math.sin(a) * 0.3 + d.z * 0.8);
      }
      // braises et étincelles qui rejaillissent
      T.jEmber.col = blue ? L.bCore : L.fireY;
      T.jEmber.col1 = blue ? L.bLight : L.fireR;
      T.jEmber.cell = blue ? c.twinkle : c.spark;
      T.jEmber.mode = blue ? 0 : 2;
      this.acc[2] += dt * (6 + 18 * h) * q * (big ? 1.5 : 1);
      while (this.acc[2] >= 1) {
        this.acc[2] -= 1;
        _.sphereDir(tv[0], 0.5);
        P2.emitR(T.jEmber, to.x, to.y, to.z, tv[0].x * 4 - d.x * 2, Math.abs(tv[0].y) * 4 + 1.5, tv[0].z * 4 - d.z * 2, to.y - 1.1);
      }
      // fumée sombre au-dessus de la cible (bleutée pour le feu bleu)
      T.jSmoke.col = blue ? L.bDeep : L.smoke;
      this.acc[3] += dt * (2 + 5 * h) * q;
      while (this.acc[3] >= 1) {
        this.acc[3] -= 1;
        P2.emitR(T.jSmoke, to.x + R(-0.3, 0.3), to.y + 0.4, to.z + R(-0.3, 0.3), R(-0.3, 0.3), R(1.0, 1.8), R(-0.3, 0.3), undefined, 0.6 + 0.4 * h);
      }
    }
  }
  /** Jet continu : « fire » (berger), « dragonFire » (dragon rouge), « blueFire » (dragon bleu). */
  FX.beam = function (kind) {
    if (!_.S) throw new Error("PTMT.fx.beam : appeler d’abord PTMT.fx.init()");
    const b = _.pool("beam", () => new Beam());
    return b._start(kind);
  };
})();
