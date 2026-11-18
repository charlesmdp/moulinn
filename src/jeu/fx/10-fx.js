// « Pas touche à mes trésors » — effets visuels (PTMT.fx) : noyau, projectiles, explosions ponctuelles.
//
//   PTMT.fx.init(scene, camera, renderer, { mobile });
//   PTMT.fx.update(dt, time);
//   const p = PTMT.fx.projectile(kind); p.set(position, direction[, solY]); p.release();
//   const p = PTMT.fx.shot(kind, départ, arrivée) : même projectile, déjà placé au départ, orienté vers l'arrivée.
//   PTMT.fx.burst(kind, position, opts);
//   (zones, cônes, aperçus de visée : 11-areas.js ; débris, sac, ressort, filet, vague, rappel : 12-props.js ;
//    tirs et impacts des tours — bogues, boules d'eau, de glace et d'eau sombre, feux — et jets continus
//    PTMT.fx.beam(kind) du berger et des dragons : 13-shots.js ; anciens noms des tirs résolus par _.ALIAS)
//
// Une sorte de projectile (FX._.KINDS[kind]) : { spacing (m entre deux émissions de traînée), mesh() (maillage
// propre, facultatif), start(p), head(p, dt) (sprites posés à chaque image), trail(p, point), place(p)
// (après chaque set : maillage partagé instancié…), free(p) }. Sans head/trail, les cas ci-dessous s'appliquent.
//
// Principes : effets courts (0,3 à 1,5 s), lisibles de haut, couleurs de famille (feu orange, glace
// cyan/blanc, eau turquoise). Les particules sont simulées sur le GPU dans un seul lot (un appel de
// dessin, alpha prémultiplié : additif et normal mélangés) ; les maillages 3D sont réutilisés.
// Sur mobile, le nombre de particules est divisé par deux.
(function () {
  "use strict";
  if (typeof THREE === "undefined") return; // rendu seulement : sans three.js (banc de simulation), rien à enregistrer
  const PTMT = (globalThis.PTMT = globalThis.PTMT || {});
  const FX = (PTMT.fx = PTMT.fx || {});
  const _ = (FX._ = FX._ || {}); // outils internes partagés entre les fichiers fx

  let S = null;
  FX.shake = 0; // suggestion de secousse de caméra (0..1), décroît seule

  // ---------------------------------------------------------------------------------------------
  // Initialisation
  // ---------------------------------------------------------------------------------------------
  FX.init = function (scene, camera, renderer, opts) {
    opts = opts || {};
    if (S) FX.dispose();
    const mobile = !!opts.mobile;
    const root = new THREE.Group();
    root.name = "ptmt:fx";
    scene.add(root);
    const mat = PTMT.gfx.newSpriteMaterial();
    const P = new PTMT.gfx.SpriteBatch(mobile ? 3072 : 6144, "ring", mat);
    const N = new PTMT.gfx.SpriteBatch(mobile ? 768 : 1536, "immediate", mat);
    P.mesh.renderOrder = 20;
    N.mesh.renderOrder = 21;
    root.add(P.mesh, N.mesh);
    S = {
      scene, camera, renderer, mobile, Q: mobile ? 0.5 : 1, root, P, N, time: 0, dt: 0,
      live: new Set(), // poignées actives (projectiles, zones, cônes, aperçus, sacs) : .frame(dt)
      timed: [], // effets minutés (ressort, vague, rappel…)
      pools: {},
    };
    _.S = S;
    _.initColors();
    if (_.initProps) _.initProps();
    if (_.initAreas) _.initAreas();
    return FX;
  };
  FX.dispose = function () {
    if (!S) return;
    S.root.parent && S.root.parent.remove(S.root);
    S = _.S = null;
  };

  FX.update = function (dt, time) {
    if (!S) return;
    dt = Math.min(Math.max(dt || 0, 0), 0.1);
    S.dt = dt;
    S.time = time;
    S.P.setTime(time);
    S.N.setTime(time);
    S.N.begin();
    for (const h of S.live) h.frame(dt);
    for (let i = S.timed.length - 1; i >= 0; i--) {
      const e = S.timed[i];
      e.t += dt;
      const k = Math.min(1, e.t / e.dur);
      e.step(k, dt, e);
      if (k >= 1) { if (e.end) e.end(e); S.timed.splice(i, 1); }
    }
    if (_.updateProps) _.updateProps(dt);
    FX.shake = Math.max(0, FX.shake - dt * 2.2);
  };
  /** Nombre de particules actives approximatif et appels de dessin propres aux effets (diagnostic). */
  FX.stats = function () {
    if (!S) return null;
    return { live: S.live.size, timed: S.timed.length, particleCapacity: S.P.capacity, mobile: S.mobile };
  };

  // ---------------------------------------------------------------------------------------------
  // Outils
  // ---------------------------------------------------------------------------------------------
  const C = () => PTMT.gfx.CELL;
  const rnd = Math.random;
  const R = (a, b) => a + rnd() * (b - a);
  _.R = R;
  const V = () => new THREE.Vector3();
  const tv = [V(), V(), V(), V()];
  _.count = (n) => Math.max(1, Math.round(n * S.Q));
  _.emit = (o) => S.P.emit(o);
  _.put = (x, y, z, size, cell, c, al, rot, add, orient, aspect) => S.N.put(x, y, z, size, cell, c[0], c[1], c[2], al, rot || 0, add || 0, orient || 0, aspect || 1);
  _.timed = (dur, step, end, data) => {
    const e = Object.assign({ t: 0, dur, step, end }, data || {});
    S.timed.push(e);
    return e;
  };
  _.pool = function (key, make) {
    let p = S.pools[key];
    if (!p) p = S.pools[key] = [];
    const o = p.length ? p.pop() : make();
    return o;
  };
  _.unpool = (key, o) => S.pools[key].push(o);

  // Palettes (linéaires)
  const COL = (_.COL = {});
  _.initColors = function () {
    const c = (hex) => { const k = PTMT.color(hex); return [k.r, k.g, k.b]; };
    Object.assign(COL, {
      white: [1, 1, 1], black: [0, 0, 0],
      fireCore: c(0xfff2b0), fireYellow: c(0xffc23a), fireOrange: c(0xff7a1a), fireRed: c(0xd8300f), fireDark: c(0x5a1406),
      ember: c(0xff8a2a), smoke: c(0x3c3634), smokeLight: c(0x8a8480), ash: c(0x2a2524),
      iceWhite: c(0xf2fcff), iceCyan: c(0x7fe3ff), iceBlue: c(0x2fa8e8), iceDeep: c(0x1a6fc0), frost: c(0xcff3ff),
      waterFoam: c(0xf0ffff), waterLight: c(0x7fe8e0), water: c(0x22b8c4), waterDeep: c(0x0f6f8f),
      gold: c(0xffd23a), goldDeep: c(0xf2a60c), goldLight: c(0xfff3a8),
      dust: c(0xcbb893), dirt: c(0x6e5a44), steam: c(0xf4f4f6), lava: c(0xff5a14),
      magic: c(0xbfa8ff),
    });
  };
  // direction aléatoire dans un cône autour de d (demi-angle a)
  _.coneDir = function (out, d, a) {
    const ct = Math.cos(a), z = ct + (1 - ct) * rnd(), phi = rnd() * Math.PI * 2, st = Math.sqrt(1 - z * z);
    const up = Math.abs(d.y) < 0.99 ? tv[3].set(0, 1, 0) : tv[3].set(1, 0, 0);
    const xa = tv[2].crossVectors(up, d).normalize();
    const ya = tv[1].crossVectors(d, xa);
    out.copy(d).multiplyScalar(z).addScaledVector(xa, st * Math.cos(phi)).addScaledVector(ya, st * Math.sin(phi));
    return out;
  };
  _.sphereDir = function (out, upBias) {
    const z = rnd() * 2 - 1, phi = rnd() * Math.PI * 2, st = Math.sqrt(1 - z * z);
    out.set(st * Math.cos(phi), z, st * Math.sin(phi));
    if (upBias) { out.y = Math.abs(out.y) * upBias + out.y * (1 - upBias); out.normalize(); }
    return out;
  };

  // ---------------------------------------------------------------------------------------------
  // Matières des projectiles 3D
  // ---------------------------------------------------------------------------------------------
  const HDR = /* glsl */ `
    uniform float uTime;
    varying vec3 vN; varying vec3 vW; varying vec3 vL;
  `;
  const VERT3D = /* glsl */ `
    uniform float uTime;
    varying vec3 vN; varying vec3 vW; varying vec3 vL;
    void main(){
      mat4 m = modelMatrix;
      #ifdef USE_INSTANCING
        m = modelMatrix * instanceMatrix;
      #endif
      vec4 wp = m * vec4(position, 1.0);
      vN = normalize(mat3(m) * normal);
      vW = wp.xyz; vL = position;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }`;
  const OUT = /* glsl */ `
    #include <tonemapping_fragment>
    #include <encodings_fragment>
  `;
  _.shader = function (key, frag, opts) {
    return PTMT.mat("fx:" + key, () => {
      const m = new THREE.ShaderMaterial(Object.assign({
        uniforms: { uTime: { value: 0 } },
        vertexShader: VERT3D,
        fragmentShader: HDR + PTMT.gfx.GLSL.noise + frag.replace("OUT_COLOR", OUT),
      }, opts || {}));
      m.name = "ptmt:fx:" + key;
      _.timeMats.push(m);
      return m;
    });
  };
  _.timeMats = [];
  const tick = FX.update;
  FX.update = function (dt, time) {
    for (const m of _.timeMats) m.uniforms.uTime.value = time;
    tick(dt, time);
  };

  // roche de lave (obus, météore, débris)
  _.lavaMat = () => _.shader("lava", /* glsl */ `
    uniform float uHeat;
    void main(){
      vec3 N = normalize(vN);
      vec3 L = normalize(vec3(0.35, 0.85, 0.4));
      float diff = 0.35 + 0.65 * max(dot(N, L), 0.0);
      float n = ptNoise3(vL * 5.0 + vec3(0.0, uTime * 0.6, 0.0));
      float n2 = ptNoise3(vL * 11.0 - vec3(uTime * 0.4));
      float crack = 1.0 - smoothstep(0.02, 0.09, abs(n - 0.5) + 0.04 * n2);
      vec3 crust = mix(vec3(0.07, 0.045, 0.04), vec3(0.2, 0.11, 0.07), n2) * diff;
      vec3 hot = mix(vec3(1.0, 0.32, 0.04), vec3(1.0, 0.85, 0.35), crack * n2) * 3.0;
      vec3 col = mix(crust, hot, crack);
      vec3 V = normalize(cameraPosition - vW);
      col += vec3(1.0, 0.4, 0.08) * pow(1.0 - abs(dot(N, V)), 3.0) * 1.2;
      gl_FragColor = vec4(col, 1.0);
      OUT_COLOR
    }`, { uniforms: { uTime: { value: 0 }, uHeat: { value: 1 } } });
  // cristal de glace
  _.iceMat = () => _.shader("ice", /* glsl */ `
    void main(){
      vec3 N = normalize(vN);
      vec3 V = normalize(cameraPosition - vW);
      vec3 L = normalize(vec3(0.35, 0.85, 0.4));
      float fres = pow(1.0 - abs(dot(N, V)), 2.0);
      float diff = max(dot(N, L), 0.0);
      vec3 col = mix(vec3(0.22, 0.62, 0.95), vec3(0.9, 0.98, 1.0), 0.25 + 0.45 * diff + 0.6 * fres);
      col += vec3(1.0) * pow(max(dot(reflect(-L, N), V), 0.0), 24.0) * 1.2;
      col += vec3(0.5, 0.9, 1.0) * 0.35;
      gl_FragColor = vec4(col, 0.72 + 0.28 * fres);
      OUT_COLOR
    }`, { transparent: true, depthWrite: true });
  // eau (jet, boule d'eau, vague)
  _.waterMat = (key, axisScroll) => _.shader("water:" + key, /* glsl */ `
    uniform float uAlpha;
    void main(){
      vec3 N = normalize(vN);
      vec3 V = normalize(cameraPosition - vW);
      vec3 L = normalize(vec3(0.35, 0.85, 0.4));
      float fres = pow(1.0 - abs(dot(N, V)), 2.0);
      float diff = max(dot(N, L), 0.0);
      ${axisScroll
        ? "vec2 q = vec2(vL.z * 2.2 - uTime * 9.0, atan(vL.y, vL.x) * 1.3);"
        : "vec2 q = vec2(atan(vL.z, vL.x) * 1.6 + uTime * 5.0, vL.y * 4.0 - uTime * 2.0);"}
      float n = ptFbm(q * 1.5);
      float streak = smoothstep(0.55, 0.72, n);
      vec3 col = mix(vec3(0.05, 0.5, 0.62), vec3(0.35, 0.92, 0.95), 0.3 + 0.5 * diff);
      col = mix(col, vec3(0.95, 1.0, 1.0), streak * 0.85 + fres * 0.5);
      col += vec3(1.0) * pow(max(dot(reflect(-L, N), V), 0.0), 40.0);
      gl_FragColor = vec4(col, (0.78 + 0.22 * fres) * uAlpha);
      OUT_COLOR
    }`, { uniforms: { uTime: { value: 0 }, uAlpha: { value: 1 } }, transparent: true, depthWrite: false });

  // ---------------------------------------------------------------------------------------------
  // Projectiles
  // ---------------------------------------------------------------------------------------------
  const GEO = {};
  function geo(key, make) { return GEO[key] || (GEO[key] = make()); }
  function crystalGeo(len, rad, sides) {
    // bipyramide allongée le long de +Z (pointe avant plus longue)
    const g = new THREE.CylinderGeometry(rad, rad, len * 0.5, sides || 6, 1);
    const pos = g.getAttribute("position");
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y > 0) { pos.setX(i, 0); pos.setZ(i, 0); pos.setY(i, len * 0.62); }
      else { pos.setX(i, pos.getX(i) * 1.0); pos.setZ(i, pos.getZ(i)); pos.setY(i, -len * 0.05); }
    }
    const b = new THREE.ConeGeometry(rad, len * 0.3, sides || 6, 1);
    b.rotateX(Math.PI);
    b.translate(0, -len * 0.2, 0);
    const merged = THREE.BufferGeometryUtils ? THREE.BufferGeometryUtils.mergeBufferGeometries([g.toNonIndexed(), b.toNonIndexed()]) : g;
    merged.rotateX(Math.PI / 2);
    merged.computeVertexNormals();
    return merged;
  }
  function rockGeo(r, detail, seed) {
    const g = new THREE.IcosahedronGeometry(r, detail);
    const pos = g.getAttribute("position");
    const rng = PTMT.rng(seed || 3);
    const map = new Map();
    for (let i = 0; i < pos.count; i++) {
      const key = pos.getX(i).toFixed(3) + "," + pos.getY(i).toFixed(3) + "," + pos.getZ(i).toFixed(3);
      let k = map.get(key);
      if (!k) { k = 0.78 + rng() * 0.4; map.set(key, k); }
      pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k, pos.getZ(i) * k);
    }
    g.computeVertexNormals();
    return g;
  }
  _.crystalGeo = crystalGeo;
  _.rockGeo = rockGeo;
  _.geo = geo;

  const KINDS = (_.KINDS = {
    fireball: { spacing: 0.16, mesh: null },
    lavaShell: { spacing: 0.22, mesh: () => new THREE.Mesh(geo("lavaRock", () => rockGeo(0.36, 1, 7)), _.lavaMat()) },
    iceShard: { spacing: 0.2, mesh: () => new THREE.Mesh(geo("iceShardP", () => crystalGeo(1.35, 0.21, 6)), _.iceMat()) },
    iceSpike: { spacing: 0.2, mesh: () => iceSpikeMesh() },
    waterJet: { spacing: 0.12, mesh: () => waterJetMesh() },
    waterBlast: { spacing: 0.16, mesh: () => waterBlastMesh() },
    meteor: { spacing: 0.18, mesh: () => new THREE.Mesh(geo("meteorRock", () => rockGeo(0.85, 1, 13)), _.lavaMat()) },
  });
  function iceSpikeMesh() {
    const g = new THREE.Group();
    const m = _.iceMat();
    const main = new THREE.Mesh(geo("iceSpikeMain", () => crystalGeo(1.9, 0.26, 6)), m);
    g.add(main);
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Mesh(geo("iceShard", () => crystalGeo(1.1, 0.16, 6)), m);
      const a = (i / 3) * Math.PI * 2;
      s.position.set(Math.cos(a) * 0.2, Math.sin(a) * 0.2, -0.35);
      s.rotation.set(Math.sin(a) * 0.35, -Math.cos(a) * 0.35, 0);
      s.scale.setScalar(0.7);
      g.add(s);
    }
    return g;
  }
  function waterJetMesh() {
    const g = new THREE.Group();
    const cap = new THREE.Mesh(geo("jet", () => {
      const c = new THREE.CylinderGeometry(0.2, 0.2, 1.7, 12, 6, false);
      // profil en goutte étirée : épais à l'avant, fin à l'arrière
      const pos = c.getAttribute("position");
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i), t = (y + 0.85) / 1.7;
        const k = 0.45 + 0.75 * Math.pow(Math.max(0, Math.min(1, t)), 0.6);
        pos.setX(i, pos.getX(i) * k); pos.setZ(i, pos.getZ(i) * k);
      }
      c.computeVertexNormals();
      c.rotateX(Math.PI / 2);
      return c;
    }), _.waterMat("jet", true));
    g.add(cap);
    return g;
  }
  function waterBlastMesh() {
    const g = new THREE.Group();
    const ball = new THREE.Mesh(geo("blast", () => new THREE.SphereGeometry(0.48, 18, 12)), _.waterMat("blast", false));
    g.add(ball);
    const ring = new THREE.Mesh(geo("blastRing", () => new THREE.TorusGeometry(0.55, 0.07, 6, 20)), _.waterMat("blastRing", false));
    ring.name = "ring";
    g.add(ring);
    return g;
  }

  class Projectile {
    constructor(kind) {
      this.kind = kind;
      this.def = KINDS[kind];
      if (!this.def) throw new Error("PTMT.fx.projectile : type inconnu « " + kind + " »");
      this.pos = V(); this.prev = V(); this.last = V(); this.dir = new THREE.Vector3(0, 0, 1);
      this.mesh = this.def.mesh ? this.def.mesh() : null;
      if (this.mesh) { this.mesh.visible = false; S.root.add(this.mesh); this.mesh.frustumCulled = false; }
      this.spin = new THREE.Euler();
      this.q = new THREE.Quaternion();
      this.t = 0;
      this.started = false;
      this.active = false;
    }
    _start() {
      this.active = true;
      this.started = false;
      this.t = 0;
      this.acc = 0;
      this.seed = rnd() * 100;
      this.ground = null;
      S.live.add(this);
      if (this.def.start) this.def.start(this);
    }
    /** Position et direction de vol (monde), hauteur du sol sous le projectile (facultative). Appeler à chaque image. */
    set(position, direction, ground) {
      if (!this.active) return this;
      if (direction && direction.lengthSq() > 1e-10) this.dir.copy(direction).normalize();
      this.ground = ground === undefined ? null : ground;
      if (!this.started) {
        this.pos.copy(position); this.prev.copy(position); this.last.copy(position);
        this.started = true;
        if (this.mesh) this.mesh.visible = true;
      } else {
        this.prev.copy(this.pos);
        this.pos.copy(position);
      }
      // traînée émise selon la distance parcourue (continue quelle que soit la cadence)
      const sp = this.def.spacing / Math.max(0.35, S.Q);
      const d = this.pos.distanceTo(this.last);
      if (d > sp) {
        const n = Math.min(24, Math.floor(d / sp));
        for (let i = 1; i <= n; i++) {
          tv[0].lerpVectors(this.last, this.pos, i / n);
          if (this.def.trail) this.def.trail(this, tv[0]);
          else trail(this, tv[0]);
        }
        this.last.copy(this.pos);
      }
      if (this.mesh) {
        this.mesh.position.copy(this.pos);
        this.q.setFromUnitVectors(tv[1].set(0, 0, 1), this.dir);
        this.mesh.quaternion.copy(this.q);
      }
      if (this.def.place) this.def.place(this);
      return this;
    }
    frame(dt) {
      this.t += dt;
      if (!this.started) return;
      if (this.def.head) this.def.head(this, dt);
      else head(this, dt);
    }
    release() {
      if (!this.active) return;
      this.active = false;
      S.live.delete(this);
      if (this.mesh) this.mesh.visible = false;
      if (this.def.free) this.def.free(this);
      _.unpool("proj:" + this.kind, this);
    }
  }
  _.Projectile = Projectile;
  FX.projectile = function (kind) {
    if (!S) throw new Error("PTMT.fx.projectile : appeler d’abord PTMT.fx.init()");
    kind = (_.ALIAS && _.ALIAS[kind]) || kind; // anciens noms (waterJet → waterOrb…, voir 13-shots.js)
    const p = _.pool("proj:" + kind, () => new Projectile(kind));
    p._start();
    return p;
  };
  /** Projectile déjà placé au départ et orienté vers l'arrivée (le rendu le déplace ensuite avec set). */
  FX.shot = function (kind, from, to) {
    const p = FX.projectile(kind);
    if (from) p.set(from, to ? tv[3].copy(to).sub(from) : null);
    return p;
  };

  // tête du projectile (sprites posés à chaque image + petites émissions)
  function head(p, dt) {
    const x = p.pos.x, y = p.pos.y, z = p.pos.z, t = S.time, c = C();
    const fl = 0.85 + 0.15 * Math.sin(t * 40 + p.seed) + 0.08 * Math.sin(t * 23);
    switch (p.kind) {
      case "fireball":
        _.put(x, y, z, 2.4 * fl, c.glow, COL.fireOrange, 0.8, 0, 1);
        _.put(x, y, z, 1.25 * fl, c.puff, COL.fireOrange, 1, t * 6, 0.35);
        _.put(x, y, z, 0.95 * fl, c.puff, COL.fireYellow, 1, -t * 8, 0.55);
        _.put(x, y, z, 0.6, c.glow, COL.fireCore, 1, 0, 1);
        break;
      case "lavaShell":
        _.put(x, y, z, 1.6 * fl, c.glow, COL.fireOrange, 0.7, 0, 1);
        p.mesh.rotation.set(0, 0, 0);
        p.mesh.rotateX(t * 5 + p.seed);
        p.mesh.rotateZ(t * 3.1);
        break;
      case "iceShard":
        _.put(x, y, z, 1.6 * fl, c.glow, COL.iceCyan, 0.6, 0, 0.35);
        _.put(x, y, z, 0.8, c.twinkle, COL.iceWhite, 0.95, t * 3, 0.6);
        p.mesh.rotateZ(dt * 9);
        break;
      case "iceSpike":
        _.put(x, y, z, 2.2 * fl, c.glow, COL.iceCyan, 0.6, 0, 0.35);
        _.put(x, y, z, 1.1, c.twinkle, COL.iceWhite, 0.95, -t * 2, 0.6);
        p.mesh.rotateZ(dt * 5);
        break;
      case "waterJet":
        _.put(x, y, z, 1.1, c.glow, COL.waterFoam, 0.3, 0, 0.3);
        break;
      case "waterBlast": {
        _.put(x, y, z, 1.4, c.glow, COL.waterFoam, 0.35, 0, 0.3);
        const ring = p.ring || (p.ring = p.mesh.getObjectByName("ring"));
        if (ring) { ring.rotation.set(Math.PI / 2 + Math.sin(t * 7) * 0.3, t * 9, 0); const s = 1 + 0.12 * Math.sin(t * 20); ring.scale.set(s, s, s); }
        p.mesh.children[0].rotation.y = t * 4;
        break;
      }
      case "meteor":
        _.put(x, y, z, 4.2 * fl, c.glow, COL.fireOrange, 0.85, 0, 1);
        _.put(x, y, z, 2.6 * fl, c.puff, COL.fireYellow, 0.9, t * 3, 0.55);
        p.mesh.rotation.set(0, 0, 0);
        p.mesh.rotateX(t * 2.2 + p.seed);
        p.mesh.rotateY(t * 1.3);
        break;
    }
  }
  // traînée : particules émises tous les « spacing » mètres (recettes préparées : aucune allocation)
  let TR = null;
  function trailRecipes() {
    if (TR) return TR;
    const c = C();
    TR = {
      fire: { drag: 2, life: [0.22, 0.34], s0: [0.6, 0.8], s1: 0.06, cell: c.flameB, col: COL.fireYellow, col1: COL.fireRed, a: 1, a1: 0, add: 0.5, rot: "rand", spin: [-3, 3], curve: 1 },
      fireSmoke: { drag: 1.5, life: [0.6, 0.9], s0: 0.3, s1: 0.8, cell: c.puffDark, col: COL.smoke, a: 0.45, a1: 0, rot: "rand", curve: 1 },
      ember: { grav: 3, life: [0.3, 0.6], s0: 0.06, s1: 0.02, cell: c.disc, col: COL.ember, a: 1, a1: 0.4, add: 1 },
      ash: { drag: 1.2, life: [0.7, 1.0], s0: 0.35, s1: 0.95, cell: c.puffDark, col: COL.ash, a: 0.6, a1: 0, rot: "rand", spin: [-1, 1], curve: 1 },
      lavaFlame: { drag: 2, life: 0.3, s0: 0.5, s1: 0.1, cell: c.flameB, col: COL.fireOrange, col1: COL.fireRed, a: 0.9, a1: 0, add: 0.8, rot: "rand" },
      lavaDrop: { grav: 9, life: [0.5, 0.8], s0: 0.09, s1: 0.04, cell: c.disc, col: COL.lava, a: 1, a1: 0.5, add: 1 },
      frost: { drag: 2, life: [0.35, 0.6], s0: [0.14, 0.24], s1: 0.02, cell: c.twinkle, col: COL.iceWhite, a: 1, a1: 0, add: 0.6, rot: "rand", spin: [-4, 4] },
      frostMist: { drag: 1.5, life: 0.55, s0: 0.35, s1: 0.8, cell: c.puffDark, col: COL.frost, a: 0.3, a1: 0, rot: "rand", curve: 1 },
      drop: { grav: 9, life: [0.3, 0.55], s0: [0.08, 0.14], s1: 0.06, cell: c.drop, mode: 2, stretch: 0.05, col: COL.waterLight, a: 0.95, a1: 0.3 },
      foam: { drag: 2, life: 0.4, s0: 0.25, s1: 0.45, cell: c.foam, a: 0.7, a1: 0, rot: "rand" },
      bubble: { life: 0.6, s0: 0.1, s1: 0.2, cell: c.bubble, a: 0.9, a1: 0 },
      meteorFire: { drag: 1.8, life: [0.4, 0.6], s0: [1.4, 2.0], s1: 0.4, cell: c.flameB, col: COL.fireYellow, col1: COL.fireRed, a: 1, a1: 0, add: 0.65, rot: "rand", spin: [-2, 2] },
      meteorSmoke: { drag: 1, life: [1.0, 1.4], s0: 0.9, s1: 2.2, cell: c.puffDark, col: COL.smoke, a: 0.6, a1: 0, rot: "rand", spin: [-0.6, 0.6], curve: 1 },
      meteorEmber: { grav: 6, life: [0.4, 0.8], s0: 0.12, s1: 0.04, cell: c.disc, col: COL.ember, a: 1, a1: 0.4, add: 1 },
    };
    return TR;
  }
  function trail(p, at) {
    const c = C(), d = p.dir, x = at.x, y = at.y, z = at.z, T = trailRecipes(), P = S.P;
    switch (p.kind) {
      case "fireball":
        T.fire.cell = rnd() < 0.5 ? c.flameB : c.puff;
        P.emitR(T.fire, x + R(-0.1, 0.1), y + R(-0.1, 0.1), z + R(-0.1, 0.1), -d.x * 1.5 + R(-0.5, 0.5), -d.y * 1.5 + R(0.3, 1.0), -d.z * 1.5 + R(-0.5, 0.5));
        if (rnd() < 0.35) P.emitR(T.fireSmoke, x, y, z, R(-0.3, 0.3), R(0.4, 1.0), R(-0.3, 0.3));
        if (rnd() < 0.5) P.emitR(T.ember, x, y, z, R(-1.5, 1.5), R(-0.5, 1.5), R(-1.5, 1.5));
        break;
      case "lavaShell":
        P.emitR(T.ash, x, y, z, R(-0.3, 0.3), R(0.3, 0.9), R(-0.3, 0.3));
        P.emitR(T.lavaFlame, x, y, z, -d.x * 0.5 + R(-0.2, 0.2), -d.y * 0.5, -d.z * 0.5 + R(-0.2, 0.2));
        if (rnd() < 0.6) P.emitR(T.lavaDrop, x, y, z, R(-0.8, 0.8), R(-0.2, 0.8), R(-0.8, 0.8));
        break;
      case "iceShard":
      case "iceSpike": {
        const big = p.kind === "iceSpike" ? 1.5 : 1;
        T.frost.cell = rnd() < 0.5 ? c.twinkle : c.snow;
        T.frost.s0[0] = 0.14 * big; T.frost.s0[1] = 0.24 * big;
        P.emitR(T.frost, x + R(-0.1, 0.1) * big, y + R(-0.1, 0.1) * big, z + R(-0.1, 0.1) * big, R(-0.3, 0.3), R(-0.3, 0.2), R(-0.3, 0.3));
        T.frostMist.s0 = 0.35 * big; T.frostMist.s1 = 0.8 * big;
        P.emitR(T.frostMist, x, y, z, -d.x * 0.4, -0.2, -d.z * 0.4);
        break;
      }
      case "waterJet":
        P.emitR(T.drop, x + R(-0.12, 0.12), y + R(-0.12, 0.12), z + R(-0.12, 0.12), R(-0.9, 0.9) + d.x * 1.5, R(0.2, 1.4), R(-0.9, 0.9) + d.z * 1.5);
        if (rnd() < 0.4) P.emitR(T.foam, x, y, z, R(-0.3, 0.3), R(-0.1, 0.3), R(-0.3, 0.3));
        break;
      case "waterBlast":
        for (let i = 0; i < 2; i++) P.emitR(T.drop, x + R(-0.3, 0.3), y + R(-0.3, 0.3), z + R(-0.3, 0.3), R(-1.2, 1.2), R(0, 1.5), R(-1.2, 1.2));
        if (rnd() < 0.5) P.emitR(T.bubble, x, y, z, R(-0.2, 0.2), R(0.1, 0.5), R(-0.2, 0.2));
        break;
      case "meteor":
        T.meteorFire.cell = rnd() < 0.5 ? c.flameB : c.puff;
        P.emitR(T.meteorFire, x + R(-0.4, 0.4), y + R(-0.4, 0.4), z + R(-0.4, 0.4), -d.x * 2 + R(-0.6, 0.6), -d.y * 2 + R(0, 1), -d.z * 2 + R(-0.6, 0.6));
        P.emitR(T.meteorSmoke, x, y, z, R(-0.5, 0.5), R(0.2, 0.8), R(-0.5, 0.5));
        if (rnd() < 0.7) P.emitR(T.meteorEmber, x, y, z, R(-3, 3), R(-1, 3), R(-3, 3));
        break;
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Éclats ponctuels
  // ---------------------------------------------------------------------------------------------
  const BURSTS = (_.BURSTS = {});
  /** Effet ponctuel. kind : voir la liste ; opts selon l'effet (radius, amount, to, length/width/yaw…). */
  FX.burst = function (kind, position, opts) {
    if (!S) return;
    const b = BURSTS[kind];
    if (!b) { console.warn("PTMT.fx.burst : effet inconnu « " + kind + " »"); return; }
    b(position, opts || {});
  };

  function ring(x, y, z, s0, s1, life, col, a, add, cell) {
    _.emit({ x, y: y + 0.04, z, life, s0, s1, cell: cell === undefined ? C().ring : cell, mode: 1, r: col[0], g: col[1], b: col[2], a, a1: 0, add: add || 0, curve: 1, rot: R(0, 6) });
  }
  _.ring = ring;
  function flash(x, y, z, size, col, life) {
    _.emit({ x, y, z, life: life || 0.16, s0: size * 0.6, s1: size, cell: C().glow, r: col[0], g: col[1], b: col[2], a: 1, a1: 0, add: 1, curve: 1 });
  }
  _.flash = flash;
  function decal(x, y, z, size, cell, col, a, life) {
    _.emit({ x, y: y + 0.03, z, life, s0: size, s1: size * 1.05, cell, mode: 1, r: col[0], g: col[1], b: col[2], a, a1: a, fadeIn: 0.04, fadeOut: 0.6, rot: R(0, 6) });
  }
  _.decal = decal;

  BURSTS.explosion = function (p, o) {
    const r = o.radius || 2, c = C(), n = _.count;
    const x = p.x, y = p.y, z = p.z;
    flash(x, y + r * 0.4, z, r * 3.2, COL.fireCore, 0.18);
    // boule de feu de dessin animé : nuages orange qui gonflent puis noircissent
    for (let i = 0, k = n(14); i < k; i++) {
      _.sphereDir(tv[0], 0.6);
      const sp = R(1.2, 2.6) * r;
      _.emit({ x: x + tv[0].x * r * 0.2, y: y + r * 0.35 + tv[0].y * r * 0.2, z: z + tv[0].z * r * 0.2, vx: tv[0].x * sp, vy: tv[0].y * sp + 0.8, vz: tv[0].z * sp, drag: 5, life: R(0.5, 0.8), s0: r * 0.55, s1: r * R(1.0, 1.4), cell: c.puff, r: COL.fireYellow[0], g: COL.fireYellow[1], b: COL.fireYellow[2], r1: COL.fireRed[0], g1: COL.fireRed[1], b1: COL.fireRed[2], a: 1, a1: 0, add: 0.45, rot: R(0, 6), spin: R(-1, 1), curve: 1, fadeOut: 0.6 });
    }
    for (let i = 0, k = n(6); i < k; i++) {
      _.sphereDir(tv[0], 0.8);
      _.emit({ x: x + tv[0].x * r * 0.3, y: y + r * 0.9, z: z + tv[0].z * r * 0.3, vx: tv[0].x * r * 0.6, vy: R(2.2, 3.4), vz: tv[0].z * r * 0.6, drag: 2, life: R(0.7, 0.95), s0: r * 0.4, s1: r * 0.95, cell: c.puff, r: COL.smokeLight[0], g: COL.smokeLight[1], b: COL.smokeLight[2], a: 0.5, a1: 0, rot: R(0, 6), spin: R(-0.5, 0.5), curve: 1, delay: 0.28 });
    }
    for (let i = 0, k = n(18); i < k; i++) {
      _.sphereDir(tv[0], 0.5);
      const sp = R(5, 11) * Math.sqrt(r);
      _.emit({ x, y: y + 0.3, z, vx: tv[0].x * sp, vy: Math.abs(tv[0].y) * sp * 0.8 + 2, vz: tv[0].z * sp, grav: 12, drag: 0.8, life: R(0.35, 0.7), s0: 0.12, s1: 0.04, cell: c.spark, mode: 2, stretch: 0.045, r: COL.fireYellow[0], g: COL.fireYellow[1], b: COL.fireYellow[2], r1: COL.fireRed[0], g1: COL.fireRed[1], b1: COL.fireRed[2], a: 1, a1: 0.5, add: 1, floor: y });
    }
    ring(x, y, z, r * 0.4, r * 2.6, 0.38, COL.fireCore, 0.9, 0.6);
    decal(x, y, z, r * 1.9, c.scorch, COL.black, 0.42, 1.4);
    decal(x, y + 0.005, z, r * 1.1, c.cracks, [0.12, 0.05, 0.03], 0.45, 1.0);
    FX.shake = Math.max(FX.shake, Math.min(1, r * 0.2));
  };

  BURSTS.lavaSplash = function (p, o) {
    const r = o.radius || 1.5, c = C(), n = _.count;
    const x = p.x, y = p.y, z = p.z;
    flash(x, y + 0.3, z, r * 2, COL.fireOrange, 0.2);
    for (let i = 0, k = n(22); i < k; i++) {
      const a = R(0, Math.PI * 2), sp = R(2, 5) * Math.sqrt(r);
      _.emit({ x, y: y + 0.2, z, vx: Math.cos(a) * sp, vy: R(3, 6.5), vz: Math.sin(a) * sp, grav: 14, life: R(0.55, 0.9), s0: R(0.14, 0.26), s1: 0.1, cell: c.disc, mode: 2, stretch: 0.03, r: COL.lava[0], g: COL.lava[1], b: COL.lava[2], r1: COL.fireDark[0], g1: COL.fireDark[1], b1: COL.fireDark[2], a: 1, a1: 1, add: 0.8, floor: y + 0.05, fadeOut: 0.85 });
    }
    for (let i = 0, k = n(7); i < k; i++) {
      const a = R(0, Math.PI * 2), d = R(0.2, 1) * r;
      _.emit({ x: x + Math.cos(a) * d, y: y + 0.035, z: z + Math.sin(a) * d, life: R(1.0, 1.5), s0: R(0.4, 0.8), s1: R(0.5, 0.9), cell: c.splat, mode: 1, r: COL.fireOrange[0], g: COL.fireOrange[1], b: COL.fireOrange[2], r1: COL.fireDark[0] * 0.5, g1: COL.fireDark[1] * 0.5, b1: COL.fireDark[2] * 0.5, a: 1, a1: 0.9, add: 0.5, fadeOut: 0.7, rot: R(0, 6), delay: R(0.2, 0.45) });
    }
    for (let i = 0, k = n(5); i < k; i++) _.emit({ x: x + R(-0.4, 0.4), y: y + 0.3, z: z + R(-0.4, 0.4), vy: R(1, 2), drag: 1, life: 1.1, s0: 0.5, s1: 1.3, cell: c.puffDark, r: COL.smoke[0], g: COL.smoke[1], b: COL.smoke[2], a: 0.6, a1: 0, rot: R(0, 6), curve: 1, delay: 0.1 });
  };

  BURSTS.meteorImpact = function (p, o) {
    const r = o.radius || 3.5, c = C(), n = _.count;
    const x = p.x, y = p.y, z = p.z;
    flash(x, y + 1, z, r * 4, COL.fireCore, 0.22);
    flash(x, y + 0.5, z, r * 2.5, COL.fireOrange, 0.4);
    // colonne de feu
    for (let i = 0, k = n(10); i < k; i++) _.emit({ x: x + R(-0.4, 0.4), y: y + 0.4, z: z + R(-0.4, 0.4), vx: R(-0.6, 0.6), vy: R(5, 9), vz: R(-0.6, 0.6), drag: 2.5, life: R(0.5, 0.75), s0: r * 0.45, s1: r * 0.2, cell: c.flameB, mode: 3, r: COL.fireYellow[0], g: COL.fireYellow[1], b: COL.fireYellow[2], r1: COL.fireRed[0], g1: COL.fireRed[1], b1: COL.fireRed[2], a: 1, a1: 0, add: 0.8 });
    // dôme de feu et fumée
    for (let i = 0, k = n(20); i < k; i++) {
      _.sphereDir(tv[0], 0.4);
      const sp = R(2, 4) * r;
      _.emit({ x, y: y + 0.5, z, vx: tv[0].x * sp, vy: Math.abs(tv[0].y) * sp * 0.6 + 1, vz: tv[0].z * sp, drag: 4.5, life: R(0.55, 0.85), s0: r * 0.45, s1: r * 0.9, cell: c.puff, r: COL.fireYellow[0], g: COL.fireYellow[1], b: COL.fireYellow[2], r1: COL.fireRed[0], g1: COL.fireRed[1], b1: COL.fireRed[2], a: 1, a1: 0, add: 0.55, rot: R(0, 6), curve: 1, fadeOut: 0.5 });
    }
    for (let i = 0, k = n(10); i < k; i++) {
      const a = R(0, Math.PI * 2), sp = R(2.5, 5) * Math.sqrt(r);
      _.emit({ x: x + Math.cos(a) * r * 0.3, y: y + 0.3, z: z + Math.sin(a) * r * 0.3, vx: Math.cos(a) * sp, vy: R(0.5, 2), vz: Math.sin(a) * sp, drag: 2.8, life: R(0.75, 1.05), s0: r * 0.3, s1: r * 0.75, cell: c.puff, r: COL.dust[0], g: COL.dust[1], b: COL.dust[2], a: 0.6, a1: 0, rot: R(0, 6), curve: 1, delay: 0.08, fadeOut: 0.6 });
    }
    for (let i = 0, k = n(24); i < k; i++) {
      _.sphereDir(tv[0], 0.6);
      const sp = R(6, 13);
      _.emit({ x, y: y + 0.5, z, vx: tv[0].x * sp, vy: Math.abs(tv[0].y) * sp + 3, vz: tv[0].z * sp, grav: 14, life: R(0.5, 1.0), s0: 0.16, s1: 0.06, cell: c.spark, mode: 2, stretch: 0.04, r: COL.fireYellow[0], g: COL.fireYellow[1], b: COL.fireYellow[2], r1: COL.fireRed[0], g1: COL.fireRed[1], b1: COL.fireRed[2], a: 1, a1: 0.5, add: 1, floor: y });
    }
    ring(x, y, z, r * 0.4, r * 3.2, 0.45, COL.fireCore, 1, 0.6);
    ring(x, y, z, r * 0.3, r * 2.2, 0.6, COL.dust, 0.8, 0, C().ripple);
    decal(x, y, z, r * 2.1, c.scorch, COL.black, 0.55, 1.8);
    decal(x, y + 0.005, z, r * 1.05, c.cracks, COL.fireOrange, 0.55, 0.8);
    if (_.debris) _.debris("rock", p, _.count(12), { speed: 7, up: 7, size: 0.55 * Math.sqrt(r / 3.5), spread: 0.6 });
    FX.shake = 1;
  };

  BURSTS.iceShatter = function (p, o) {
    const r = o.radius || 1, c = C(), n = _.count;
    const x = p.x, y = p.y + 0.8 * r, z = p.z;
    _.emit({ x, y, z, life: 0.16, s0: 1.5 * r, s1: 2.6 * r, cell: C().glow, r: COL.iceWhite[0], g: COL.iceWhite[1], b: COL.iceWhite[2], a: 0.9, a1: 0, add: 0.4 });
    if (_.debris) _.debris("ice", tv[0].set(x, y, z), n(16), { speed: 5, up: 4.5, size: 0.4 * r, spread: 0.45 * r, floor: p.y });
    for (let i = 0, k = n(10); i < k; i++) {
      _.sphereDir(tv[0], 0.3);
      _.emit({ x: x + tv[0].x * 0.3, y: y + tv[0].y * 0.3, z: z + tv[0].z * 0.3, vx: tv[0].x * 2.5, vy: tv[0].y * 2, vz: tv[0].z * 2.5, drag: 4, life: R(0.5, 0.8), s0: 0.4 * r, s1: 1.0 * r, cell: c.puffDark, r: COL.frost[0], g: COL.frost[1], b: COL.frost[2], a: 0.7, a1: 0, rot: R(0, 6), curve: 1 });
    }
    for (let i = 0, k = n(14); i < k; i++) {
      _.sphereDir(tv[0], 0.4);
      _.emit({ x, y, z, vx: tv[0].x * 4, vy: tv[0].y * 4 + 1, vz: tv[0].z * 4, drag: 3, grav: 2, life: R(0.4, 0.8), s0: R(0.12, 0.25), s1: 0.02, cell: rnd() < 0.5 ? c.twinkle : c.shard, r: 1, g: 1, b: 1, a: 1, a1: 0, add: 0.6, rot: R(0, 6), spin: R(-8, 8) });
    }
    ring(x, p.y, z, 0.3, 2.2 * r, 0.35, COL.iceWhite, 0.8, 0.4);
  };

  BURSTS.freezeFlash = function (p, o) {
    const r = o.radius || 2, c = C(), n = _.count;
    const x = p.x, y = p.y, z = p.z;
    _.emit({ x, y: y + 0.6, z, life: 0.2, s0: r * 1.4, s1: r * 2.4, cell: C().glow, r: COL.iceWhite[0], g: COL.iceWhite[1], b: COL.iceWhite[2], a: 0.85, a1: 0, add: 0.35 });
    ring(x, y, z, r * 0.2, r * 2.2, 0.4, COL.iceWhite, 1, 0.6);
    ring(x, y, z, r * 0.1, r * 1.6, 0.5, COL.iceCyan, 0.9, 0.5, C().frost);
    decal(x, y, z, r * 2.0, c.frost, COL.frost, 0.85, 1.5);
    for (let i = 0, k = n(24); i < k; i++) {
      const a = R(0, Math.PI * 2), d = R(0, r);
      _.emit({ x: x + Math.cos(a) * d, y: y + R(0.1, 0.6), z: z + Math.sin(a) * d, vx: Math.cos(a) * 1.5, vy: R(0.8, 2.2), vz: Math.sin(a) * 1.5, drag: 2, grav: 0.8, life: R(0.5, 0.9), s0: R(0.18, 0.32), s1: 0.05, cell: c.snow, r: 1, g: 1, b: 1, a: 1, a1: 0, add: 0.5, rot: R(0, 6), spin: R(-3, 3) });
    }
    for (let i = 0, k = n(8); i < k; i++) {
      const a = (i / 8) * Math.PI * 2;
      _.emit({ x: x + Math.cos(a) * r * 0.7, y: y + 0.1, z: z + Math.sin(a) * r * 0.7, vx: Math.cos(a), vz: Math.sin(a), vy: 0.3, drag: 2, life: 0.8, s0: 0.6, s1: 1.2, cell: c.puffDark, r: COL.frost[0], g: COL.frost[1], b: COL.frost[2], a: 0.55, a1: 0, rot: R(0, 6), curve: 1 });
    }
  };

  BURSTS.splash = function (p, o) {
    const r = o.radius || 1, c = C(), n = _.count;
    const x = p.x, y = p.y, z = p.z;
    for (let i = 0, k = n(22); i < k; i++) {
      const a = R(0, Math.PI * 2), sp = R(1, 3) * r;
      _.emit({ x: x + Math.cos(a) * 0.2 * r, y: y + 0.1, z: z + Math.sin(a) * 0.2 * r, vx: Math.cos(a) * sp, vy: R(3.5, 6.5) * Math.sqrt(r), vz: Math.sin(a) * sp, grav: 13, life: R(0.55, 0.9), s0: R(0.15, 0.27) * Math.sqrt(r), s1: 0.1, cell: c.drop, mode: 2, stretch: 0.04, r: COL.waterFoam[0], g: COL.waterFoam[1], b: COL.waterFoam[2], r1: COL.waterLight[0], g1: COL.waterLight[1], b1: COL.waterLight[2], a: 1, a1: 0.4, floor: y });
    }
    _.emit({ x, y: y + 0.75 * r, z, life: 0.5, s0: 1.6 * r, s1: 2.6 * r, cell: c.splash, mode: 3, r: COL.waterFoam[0], g: COL.waterFoam[1], b: COL.waterFoam[2], a: 0.95, a1: 0, curve: 1 });
    ring(x, y, z, 0.4 * r, 2.6 * r, 0.7, COL.waterFoam, 0.9, 0, c.ripple);
    ring(x, y, z, 0.2 * r, 1.6 * r, 0.9, COL.waterLight, 0.7, 0, c.ripple);
    for (let i = 0, k = n(6); i < k; i++) { const a = R(0, 6.28); _.emit({ x: x + Math.cos(a) * 0.5 * r, y: y + 0.05, z: z + Math.sin(a) * 0.5 * r, vx: Math.cos(a) * 0.8, vz: Math.sin(a) * 0.8, drag: 2, life: 0.8, s0: 0.4 * r, s1: 0.8 * r, cell: c.foam, mode: 1, r: 1, g: 1, b: 1, a: 0.8, a1: 0, rot: R(0, 6) }); }
  };

  BURSTS.steam = function (p, o) {
    const r = o.radius || 1, c = C(), n = _.count;
    for (let i = 0, k = n(12); i < k; i++) {
      _.emit({ x: p.x + R(-0.5, 0.5) * r, y: p.y + R(0.1, 0.6), z: p.z + R(-0.5, 0.5) * r, vx: R(-0.4, 0.4), vy: R(2.5, 4.5), vz: R(-0.4, 0.4), drag: 2.4, life: R(0.8, 1.3), s0: 0.4 * r, s1: 1.4 * r, cell: c.puffDark, r: COL.steam[0], g: COL.steam[1], b: COL.steam[2], a: 0.8, a1: 0, rot: R(0, 6), spin: R(-1, 1), curve: 1, delay: R(0, 0.25) });
    }
    for (let i = 0, k = n(5); i < k; i++) _.emit({ x: p.x + R(-0.3, 0.3), y: p.y + 0.3, z: p.z + R(-0.3, 0.3), vy: R(3, 5), drag: 2, life: 0.5, s0: 0.25, s1: 0.5, cell: c.wind, mode: 3, r: 1, g: 1, b: 1, a: 0.8, a1: 0, rot: R(-0.5, 0.5) });
  };

  BURSTS.smoke = function (p, o) {
    const r = o.radius || 1, c = C(), n = _.count;
    for (let i = 0, k = n(12); i < k; i++) {
      const a = R(0, 6.28), sp = R(0.5, 2) * r;
      _.emit({ x: p.x, y: p.y + R(0.2, 0.8), z: p.z, vx: Math.cos(a) * sp, vy: R(0.6, 1.8), vz: Math.sin(a) * sp, drag: 2.5, life: R(0.9, 1.4), s0: 0.5 * r, s1: 1.5 * r, cell: c.puff, r: COL.smokeLight[0], g: COL.smokeLight[1], b: COL.smokeLight[2], a: 0.85, a1: 0, rot: R(0, 6), spin: R(-0.6, 0.6), curve: 1 });
    }
  };

  BURSTS.coins = function (p, o) {
    const amount = Math.max(1, Math.min(40, Math.round(o.amount || 8))), c = C();
    if (_.debris) _.debris("coin", tv[0].set(p.x, p.y + 0.4, p.z), Math.max(3, Math.round(amount * (S.mobile ? 0.6 : 1))), { speed: 2.4, up: 6.5, size: 0.24, spread: 0.2, floor: p.y });
    for (let i = 0, k = _.count(10); i < k; i++) _.emit({ x: p.x + R(-0.6, 0.6), y: p.y + R(0.3, 1.4), z: p.z + R(-0.6, 0.6), vy: 0.4, life: R(0.4, 0.8), s0: 0.05, s1: 0.4, cell: c.twinkle, r: COL.gold[0], g: COL.gold[1], b: COL.gold[2], a: 1, a1: 0, add: 1, delay: R(0, 0.4), curve: 2, spin: 4 });
    flash(p.x, p.y + 0.5, p.z, 2.2, COL.gold, 0.25);
  };

  /** Sac lâché au sol (voleur K.-O. ou qui s'en débarrasse) : bouffée de poussière, pièces, reflets dorés. */
  BURSTS.sackPop = function (p, o) {
    const c = C(), n = _.count;
    for (let i = 0, k = n(8); i < k; i++) {
      const a = R(0, 6.28), sp = R(0.8, 2.2);
      _.emit({ x: p.x, y: p.y + 0.1, z: p.z, vx: Math.cos(a) * sp, vy: R(0.4, 1.2), vz: Math.sin(a) * sp, drag: 3, life: R(0.6, 0.9), s0: 0.3, s1: 0.8, cell: c.puff, r: COL.dust[0], g: COL.dust[1], b: COL.dust[2], a: 0.75, a1: 0, rot: R(0, 6), curve: 1 });
    }
    if (_.debris) _.debris("coin", tv[0].set(p.x, p.y + 0.5, p.z), S.mobile ? 3 : 5, { speed: 1.8, up: 5, size: 0.22, spread: 0.2, floor: p.y });
    for (let i = 0, k = n(8); i < k; i++) _.emit({ x: p.x + R(-0.5, 0.5), y: p.y + R(0.3, 1.0), z: p.z + R(-0.5, 0.5), vy: 0.3, life: R(0.4, 0.7), s0: 0.05, s1: 0.35, cell: c.twinkle, r: COL.gold[0], g: COL.gold[1], b: COL.gold[2], a: 1, a1: 0, add: 1, delay: R(0, 0.3), curve: 2, spin: 4 });
    void o;
  };

  BURSTS.sparkle = function (p, o) {
    const r = o.radius || 1, c = C(), n = _.count;
    const col = o.color ? (() => { const k = PTMT.color(o.color); return [k.r, k.g, k.b]; })() : COL.goldLight;
    for (let i = 0, k = n(22); i < k; i++) {
      _.sphereDir(tv[0], 0.3);
      _.emit({ x: p.x + tv[0].x * 0.3 * r, y: p.y + 0.6 + tv[0].y * 0.4 * r, z: p.z + tv[0].z * 0.3 * r, vx: tv[0].x * 2.6 * r, vy: tv[0].y * 2.4 * r + 0.8, vz: tv[0].z * 2.6 * r, drag: 3, life: R(0.5, 0.85), s0: 0.08, s1: R(0.5, 0.8) * r, cell: c.twinkle, r: col[0], g: col[1], b: col[2], a: 1, a1: 0, add: 1, spin: R(-5, 5), curve: 2, delay: R(0, 0.15) });
    }
    flash(p.x, p.y + 0.6, p.z, 1.6 * r, col, 0.2);
  };

  BURSTS.ko = function (p, o) {
    const c = C(), n = _.count;
    for (let i = 0, k = n(12); i < k; i++) {
      const a = (i / 12) * Math.PI * 2;
      _.emit({ x: p.x, y: p.y + 0.5, z: p.z, vx: Math.cos(a) * 2.6, vy: R(0.5, 1.8), vz: Math.sin(a) * 2.6, drag: 4, life: 0.75, s0: 0.5, s1: 1.1, cell: c.poof, a: 1, a1: 0, rot: R(0, 6), fadeOut: 0.55, curve: 2 });
    }
    for (let i = 0, k = n(6); i < k; i++) _.emit({ x: p.x, y: p.y + 0.9, z: p.z, vx: R(-3, 3), vy: R(2, 4), vz: R(-3, 3), grav: 7, life: 0.7, s0: 0.24, s1: 0.1, cell: c.star, a: 1, a1: 0, spin: R(-8, 8) });
  };

  BURSTS.hit = function (p, o) {
    const c = C(), s = o.radius || 1;
    const col = o.family === "ice" ? COL.iceWhite : o.family === "water" ? COL.waterFoam : o.family === "fire" ? COL.fireYellow : [1, 0.95, 0.75];
    _.emit({ x: p.x, y: p.y, z: p.z, life: 0.24, s0: 0.6 * s, s1: 1.3 * s, cell: c.zap, r: col[0], g: col[1], b: col[2], a: 1, a1: 0, add: 0.5, rot: R(0, 6), curve: 1 });
    _.emit({ x: p.x, y: p.y, z: p.z, life: 0.18, s0: 1.0 * s, s1: 1.8 * s, cell: c.glow, r: col[0], g: col[1], b: col[2], a: 0.8, a1: 0, add: 1 });
    for (let i = 0, k = _.count(7); i < k; i++) {
      _.sphereDir(tv[0], 0.3);
      _.emit({ x: p.x, y: p.y, z: p.z, vx: tv[0].x * 6, vy: tv[0].y * 4 + 1.5, vz: tv[0].z * 6, grav: 9, life: R(0.28, 0.45), s0: 0.14 * s, s1: 0.04, cell: c.spark, mode: 2, stretch: 0.05, r: col[0], g: col[1], b: col[2], a: 1, a1: 0, add: 1 });
    }
  };
})();
