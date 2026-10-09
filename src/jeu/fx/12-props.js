// « Pas touche à mes trésors » — objets d'effets en 3D (PTMT.fx) : débris, sac de trésor au sol,
// ressort, filet lancé, vague, rappel du sac vers la réserve.
//
//   const s = PTMT.fx.sack(); s.set(position, 'dropped' | 'floating' | 'hidden'); s.release();
//   PTMT.fx.burst('springBoing' | 'netThrow' | 'waterWave' | 'recall', position, opts)
//     waterWave : opts { length, width, yaw } — bande centrée sur position, la vague la parcourt selon yaw
//     recall    : opts { to: Vector3 } — le sac file en arc doré vers la réserve
//
// Débris : trois lots instanciés (éclats de glace, roches brûlantes, pièces d'or) simulés sur le CPU
// (gravité, rebonds, rotation), un appel de dessin par lot.
(function () {
  "use strict";
  if (typeof THREE === "undefined") return; // rendu seulement : sans three.js (banc de simulation), rien à enregistrer
  const PTMT = (globalThis.PTMT = globalThis.PTMT || {});
  const FX = (PTMT.fx = PTMT.fx || {});
  const _ = (FX._ = FX._ || {});
  const rnd = Math.random;
  const R = (a, b) => a + rnd() * (b - a);
  const C = () => PTMT.gfx.CELL;
  const V = () => new THREE.Vector3();
  const tv = [V(), V(), V()];
  const tq = new THREE.Quaternion(), te = new THREE.Euler(), tm = new THREE.Matrix4(), ts = V();

  // ---------------------------------------------------------------------------------------------
  // Débris
  // ---------------------------------------------------------------------------------------------
  class Debris {
    constructor(geometry, material, cap, name) {
      this.cap = cap;
      this.mesh = new THREE.InstancedMesh(geometry, material, cap);
      this.mesh.name = name;
      this.mesh.count = 0;
      this.mesh.frustumCulled = false;
      this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.mesh.castShadow = false;
      const f = (n) => new Float32Array(cap * n);
      this.p = f(3); this.v = f(3); this.r = f(3); this.w = f(3); this.s = f(1); this.age = f(1); this.life = f(1); this.floor = f(1);
      this.alive = 0;
    }
    spawn(pos, n, o) {
      for (let k = 0; k < n; k++) {
        let i = this.alive;
        if (i >= this.cap) { i = Math.floor(rnd() * this.cap); } else this.alive++;
        const sp = o.speed || 4, up = o.up || 4, spread = o.spread || 0.3;
        const a = rnd() * Math.PI * 2, h = rnd();
        this.p[i * 3] = pos.x + Math.cos(a) * spread * rnd();
        this.p[i * 3 + 1] = pos.y + spread * rnd() * 0.5;
        this.p[i * 3 + 2] = pos.z + Math.sin(a) * spread * rnd();
        this.v[i * 3] = Math.cos(a) * sp * (0.4 + 0.6 * h);
        this.v[i * 3 + 1] = up * (0.6 + 0.6 * rnd());
        this.v[i * 3 + 2] = Math.sin(a) * sp * (0.4 + 0.6 * h);
        this.r[i * 3] = rnd() * 6; this.r[i * 3 + 1] = rnd() * 6; this.r[i * 3 + 2] = rnd() * 6;
        const spin = o.spin || 10;
        this.w[i * 3] = R(-spin, spin); this.w[i * 3 + 1] = R(-spin, spin) * 0.5; this.w[i * 3 + 2] = R(-spin, spin);
        this.s[i] = (o.size || 0.3) * R(0.6, 1.3);
        this.age[i] = 0;
        this.life[i] = (o.life || 1.2) * R(0.8, 1.2);
        this.floor[i] = o.floor !== undefined ? o.floor : pos.y - 0.5;
      }
    }
    update(dt) {
      const p = this.p, v = this.v, r = this.r, w = this.w;
      for (let i = 0; i < this.alive; i++) {
        this.age[i] += dt;
        if (this.age[i] >= this.life[i]) {
          const j = --this.alive;
          if (i !== j) {
            for (let c = 0; c < 3; c++) { p[i * 3 + c] = p[j * 3 + c]; v[i * 3 + c] = v[j * 3 + c]; r[i * 3 + c] = r[j * 3 + c]; w[i * 3 + c] = w[j * 3 + c]; }
            this.s[i] = this.s[j]; this.age[i] = this.age[j]; this.life[i] = this.life[j]; this.floor[i] = this.floor[j];
          }
          i--;
          continue;
        }
        v[i * 3 + 1] -= 14 * dt;
        p[i * 3] += v[i * 3] * dt; p[i * 3 + 1] += v[i * 3 + 1] * dt; p[i * 3 + 2] += v[i * 3 + 2] * dt;
        const fl = this.floor[i] + this.s[i] * 0.2;
        if (p[i * 3 + 1] < fl) {
          p[i * 3 + 1] = fl;
          if (v[i * 3 + 1] < 0) v[i * 3 + 1] = -v[i * 3 + 1] * 0.38;
          v[i * 3] *= 0.6; v[i * 3 + 2] *= 0.6;
          w[i * 3] *= 0.6; w[i * 3 + 1] *= 0.6; w[i * 3 + 2] *= 0.6;
        }
        r[i * 3] += w[i * 3] * dt; r[i * 3 + 1] += w[i * 3 + 1] * dt; r[i * 3 + 2] += w[i * 3 + 2] * dt;
        const k = this.age[i] / this.life[i];
        const sc = this.s[i] * (k > 0.8 ? Math.max(0, 1 - (k - 0.8) / 0.2) : Math.min(1, this.age[i] / 0.05));
        te.set(r[i * 3], r[i * 3 + 1], r[i * 3 + 2]);
        tq.setFromEuler(te);
        ts.set(sc, sc, sc);
        tv[0].set(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
        tm.compose(tv[0], tq, ts);
        this.mesh.setMatrixAt(i, tm);
      }
      this.mesh.count = this.alive;
      if (this.alive > 0 || this.wasAlive) this.mesh.instanceMatrix.needsUpdate = true;
      this.wasAlive = this.alive > 0;
    }
  }

  let DEB = null;
  _.initProps = function () {
    const S = _.S;
    const coinGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.14, 14);
    const coinMat = new THREE.MeshStandardMaterial({ color: PTMT.color(0xffc62a), emissive: PTMT.color(0xb87a00), emissiveIntensity: 0.35, metalness: 0.55, roughness: 0.32 });
    const cap = S.mobile ? 96 : 192;
    DEB = {
      ice: new Debris(_.geo("debrisIce", () => _.crystalGeo(1, 0.28, 5)), _.iceMat(), cap, "ptmt:fx:debris:ice"),
      rock: new Debris(_.geo("debrisRock", () => _.rockGeo(0.5, 0, 21)), _.lavaMat(), cap / 2, "ptmt:fx:debris:rock"),
      coin: new Debris(coinGeo, coinMat, cap, "ptmt:fx:debris:coin"),
    };
    for (const k in DEB) S.root.add(DEB[k].mesh);
  };
  _.debris = function (kind, pos, n, o) {
    if (!DEB) return;
    DEB[kind].spawn(pos, n, o || {});
  };
  _.updateProps = function (dt) {
    if (DEB) for (const k in DEB) DEB[k].update(dt);
    if (PTMT.gfx.propTime) PTMT.gfx.propTime.value = _.S.time;
  };

  // ---------------------------------------------------------------------------------------------
  // Sac de trésor au sol
  // ---------------------------------------------------------------------------------------------
  let SACK_GEO = null;
  function sackGeometry() {
    if (SACK_GEO) return SACK_GEO;
    const parts = new PTMT.gfx.Parts();
    PTMT.gfx.addSack(parts, { scale: 1.25 });
    SACK_GEO = parts.build();
    SACK_GEO.computeBoundingSphere();
    return SACK_GEO;
  }
  class Sack {
    constructor() {
      this.mesh = new THREE.Mesh(sackGeometry(), PTMT.gfx.propMaterial("sack"));
      this.mesh.castShadow = true;
      this.mesh.visible = false;
      _.S.root.add(this.mesh);
      this.pos = V();
      this.state = "hidden";
    }
    _start() {
      this.active = true;
      this.state = "hidden";
      this.t = 0;
      this.pop = 1;
      this.seed = rnd() * 10;
      this.ripple = 0;
      _.S.live.add(this);
    }
    /** position (monde, au sol ou à la surface de l'eau) et état 'dropped' | 'floating' | 'hidden'. */
    set(position, state) {
      if (!this.active) return this;
      if (position) this.pos.copy(position);
      state = state || this.state;
      if (state !== this.state) {
        if (this.state === "hidden" && state !== "hidden") { this.pop = 0; burstDrop(this.pos, state === "floating"); }
        this.state = state;
      }
      this.mesh.visible = state !== "hidden";
      return this;
    }
    frame(dt) {
      this.t += dt;
      if (this.state === "hidden") return;
      const K = _.COL, c = C(), t = _.S.time, p = this.pos;
      this.pop = Math.min(1, this.pop + dt / 0.45);
      // petit rebond d'apparition (le sac tombe et s'écrase un peu)
      const k = this.pop;
      const drop = k < 0.45 ? (1 - k / 0.45) * 1.2 : 0;
      const squash = k < 0.45 ? 1 : 1 - Math.sin(Math.min(1, (k - 0.45) / 0.55) * Math.PI * 2) * 0.12 * (1 - k);
      const floating = this.state === "floating";
      const bob = floating ? Math.sin(t * 2.4 + this.seed) * 0.06 : 0;
      this.mesh.position.set(p.x, p.y + drop + bob - (floating ? 0.32 : 0), p.z);
      this.mesh.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
      this.mesh.rotation.set(floating ? Math.sin(t * 1.7 + this.seed) * 0.12 : 0.08, this.seed + (floating ? t * 0.2 : 0), floating ? Math.sin(t * 2.1) * 0.1 : -0.1);
      // icône flottante + anneau doré pulsé au sol : silhouette reconnaissable de haut
      const hover = p.y + 1.55 + Math.sin(t * 3 + this.seed) * 0.1;
      _.put(p.x, hover, p.z, 0.7, c.sackIcon, K.white, 1, 0, 0);
      _.put(p.x, hover, p.z, 1.3, c.glow, K.gold, 0.45, 0, 1);
      const pulse = (t * 1.2 + this.seed) % 1;
      _.put(p.x, p.y + (floating ? 0.02 : 0.05), p.z, 1.3 + pulse * 1.3, c.ring, K.gold, 0.8 * (1 - pulse), 0, 0.5, 1);
      _.put(p.x, p.y + (floating ? 0.02 : 0.045), p.z, 1.6, c.glow, K.goldDeep, 0.35, 0, 0.6, 1);
      if (floating) {
        this.ripple += dt;
        if (this.ripple > 0.55) {
          this.ripple = 0;
          _.emit({ x: p.x, y: p.y + 0.02, z: p.z, life: 1.4, s0: 1.0, s1: 3.2, cell: c.ripple, mode: 1, r: 1, g: 1, b: 1, a: 0.6, a1: 0, curve: 1 });
        }
      } else if (rnd() < dt * 5) {
        _.emit({ x: p.x + R(-0.5, 0.5), y: p.y + R(0.3, 1.0), z: p.z + R(-0.5, 0.5), life: 0.6, s0: 0.04, s1: 0.3, cell: c.twinkle, r: K.goldLight[0], g: K.goldLight[1], b: K.goldLight[2], a: 1, a1: 0, add: 1, curve: 2, spin: 3 });
      }
    }
    release() {
      if (!this.active) return;
      this.active = false;
      this.mesh.visible = false;
      _.S.live.delete(this);
      _.unpool("sack", this);
    }
  }
  function burstDrop(p, water) {
    const K = _.COL, c = C();
    if (water) { _.BURSTS.splash(p, { radius: 0.8 }); return; }
    for (let i = 0; i < _.count(8); i++) {
      const a = (i / 8) * Math.PI * 2;
      _.emit({ x: p.x, y: p.y + 0.1, z: p.z, vx: Math.cos(a) * 1.6, vy: 0.4, vz: Math.sin(a) * 1.6, drag: 3, life: 0.6, s0: 0.3, s1: 0.7, cell: c.puff, r: K.dust[0], g: K.dust[1], b: K.dust[2], a: 0.8, a1: 0, rot: R(0, 6), curve: 1, delay: 0.18 });
    }
    _.debris("coin", tv[0].set(p.x, p.y + 0.4, p.z), _.count(5), { speed: 1.8, up: 5, size: 0.2, spread: 0.2, floor: p.y });
  }
  FX.sack = function () {
    if (!_.S) throw new Error("PTMT.fx.sack : appeler d’abord PTMT.fx.init()");
    const s = _.pool("sack", () => new Sack());
    s._start();
    return s;
  };

  // ---------------------------------------------------------------------------------------------
  // Ressort « boing »
  // ---------------------------------------------------------------------------------------------
  function springMesh() {
    const g = new THREE.Group();
    const pts = [];
    const turns = 5, n = 60;
    for (let i = 0; i <= n; i++) {
      const t = i / n, a = t * turns * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * 0.32, t * 1.0, Math.sin(a) * 0.32));
    }
    const coil = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 90, 0.045, 6, false), new THREE.MeshStandardMaterial({ color: PTMT.color(0xc9d2dc), metalness: 0.6, roughness: 0.3 }));
    g.add(coil);
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.1, 18), new THREE.MeshStandardMaterial({ color: PTMT.color(0xe8322b), roughness: 0.45 }));
    plate.position.y = 1.03;
    plate.name = "plate";
    g.add(plate);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.6, 0.1, 18), new THREE.MeshStandardMaterial({ color: PTMT.color(0x4b525b), roughness: 0.6, metalness: 0.3 }));
    base.position.y = 0.03;
    g.add(base);
    g.visible = false;
    return g;
  }
  _.BURSTS.springBoing = function (p, o) {
    const S = _.S, K = _.COL, c = C();
    const m = _.pool("spring", () => { const s = springMesh(); S.root.add(s); return s; });
    m.visible = true;
    m.position.copy(p);
    const sc = o.radius || 1;
    _.timed(0.95, (k) => {
      // détente brutale puis oscillation amortie, et rentrée dans le sol
      let h;
      if (k < 0.1) h = (k / 0.1) * 1.5;
      else h = 1 + 0.5 * Math.exp(-(k - 0.1) * 6) * Math.cos((k - 0.1) * 28);
      if (k > 0.82) h *= Math.max(0, 1 - (k - 0.82) / 0.18);
      m.scale.set(sc * (1 + (1 - Math.min(1, h)) * 0.2), sc * Math.max(0.01, h), sc * (1 + (1 - Math.min(1, h)) * 0.2));
      m.rotation.y = Math.sin(k * 20) * 0.2 * (1 - k);
    }, () => { m.visible = false; _.unpool("spring", m); });
    _.emit({ x: p.x, y: p.y + 2.1 * sc, z: p.z, vy: 0.6, life: 0.85, s0: 1.2 * sc, s1: 1.5 * sc, cell: c.boing, a: 1, a1: 1, fadeOut: 0.7, curve: 2, rot: R(-0.2, 0.2) });
    _.ring(p.x, p.y, p.z, 0.4 * sc, 2.2 * sc, 0.45, K.dust, 0.9, 0, c.ripple);
    for (let i = 0; i < _.count(8); i++) {
      const a = (i / 8) * Math.PI * 2;
      _.emit({ x: p.x, y: p.y + 0.1, z: p.z, vx: Math.cos(a) * 2.2, vy: 0.5, vz: Math.sin(a) * 2.2, drag: 3, life: 0.55, s0: 0.3, s1: 0.8, cell: c.puff, r: K.dust[0], g: K.dust[1], b: K.dust[2], a: 0.85, a1: 0, rot: R(0, 6), curve: 1 });
    }
    for (let i = 0; i < _.count(5); i++) _.emit({ x: p.x, y: p.y + 1.4 * sc, z: p.z, vx: R(-2.5, 2.5), vy: R(2, 4), vz: R(-2.5, 2.5), grav: 8, life: 0.6, s0: 0.25, s1: 0.1, cell: c.star, a: 1, a1: 0, spin: R(-8, 8) });
  };

  // ---------------------------------------------------------------------------------------------
  // Filet lancé
  // ---------------------------------------------------------------------------------------------
  let NET_TEX = null;
  function netMesh() {
    if (!NET_TEX) {
      const cv = document.createElement("canvas");
      cv.width = cv.height = 128;
      const x = cv.getContext("2d");
      x.strokeStyle = "#e7cf98"; x.lineWidth = 7; x.lineCap = "round";
      for (let i = -2; i < 4; i++) {
        x.beginPath(); x.moveTo(i * 64, 0); x.lineTo(i * 64 + 128, 128); x.stroke();
        x.beginPath(); x.moveTo(i * 64 + 128, 0); x.lineTo(i * 64, 128); x.stroke();
      }
      NET_TEX = new THREE.CanvasTexture(cv);
      NET_TEX.wrapS = NET_TEX.wrapT = THREE.RepeatWrapping;
      NET_TEX.repeat.set(7, 3);
      NET_TEX.encoding = THREE.sRGBEncoding;
    }
    const g = new THREE.Group();
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 6, 0, Math.PI * 2, 0, Math.PI * 0.45), new THREE.MeshStandardMaterial({ map: NET_TEX, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 }));
    g.add(dome);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.99, 0.03, 4, 24), new THREE.MeshStandardMaterial({ color: PTMT.color(0x8a6a3a), roughness: 0.9 }));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = Math.cos(Math.PI * 0.45);
    g.add(rim);
    for (let i = 0; i < 8; i++) {
      const w = new THREE.Mesh(_.geo("netWeight", () => new THREE.SphereGeometry(0.07, 6, 5)), new THREE.MeshStandardMaterial({ color: PTMT.color(0x3a3f46), roughness: 0.5, metalness: 0.4 }));
      const a = (i / 8) * Math.PI * 2;
      w.position.set(Math.cos(a) * Math.sin(Math.PI * 0.45), Math.cos(Math.PI * 0.45) - 0.02, Math.sin(a) * Math.sin(Math.PI * 0.45));
      g.add(w);
    }
    g.visible = false;
    return g;
  }
  _.BURSTS.netThrow = function (p, o) {
    const S = _.S, K = _.COL, c = C();
    const m = _.pool("net", () => { const n = netMesh(); S.root.add(n); return n; });
    const r = o.radius || 1.1;
    const from = o.from ? o.from.clone() : new THREE.Vector3(p.x - 1.2, p.y + 4, p.z + 1.2);
    const to = p.clone();
    m.visible = true;
    _.timed(0.55, (k) => {
      // vol en cloche, déploiement, puis plaquage au sol
      const f = Math.min(1, k / 0.75);
      const e = 1 - Math.pow(1 - f, 2);
      m.position.set(from.x + (to.x - from.x) * e, from.y + (to.y - from.y) * e + Math.sin(f * Math.PI) * 1.2, from.z + (to.z - from.z) * e);
      const open = 0.25 + 0.75 * e;
      const flat = k > 0.75 ? 1 - (k - 0.75) / 0.25 * 0.6 : 1;
      m.scale.set(r * open, r * 1.6 * (0.4 + 0.6 * e) * flat, r * open);
      m.rotation.set(Math.sin(k * 9) * 0.2 * (1 - e), k * 5, Math.cos(k * 7) * 0.2 * (1 - e));
    }, () => {
      m.visible = false;
      _.unpool("net", m);
      for (let i = 0; i < _.count(6); i++) {
        const a = (i / 6) * Math.PI * 2;
        _.emit({ x: to.x, y: to.y + 0.1, z: to.z, vx: Math.cos(a) * 1.4, vy: 0.3, vz: Math.sin(a) * 1.4, drag: 3, life: 0.5, s0: 0.25, s1: 0.6, cell: c.puff, r: K.dust[0], g: K.dust[1], b: K.dust[2], a: 0.7, a1: 0, curve: 1 });
      }
    });
    _.emit({ x: from.x, y: from.y, z: from.z, life: 0.2, s0: 0.3, s1: 0.8, cell: c.zap, r: 1, g: 0.95, b: 0.8, a: 0.9, a1: 0, add: 0.5 });
  };

  // ---------------------------------------------------------------------------------------------
  // Vague (raz-de-marée en bande)
  // ---------------------------------------------------------------------------------------------
  function waveMesh() {
    // profil (z, y) d'une vague qui déferle, extrudé sur la largeur (x de -0,5 à 0,5)
    const sh = new THREE.Shape();
    const prof = [[-1.6, 0], [-1.1, 0.18], [-0.6, 0.5], [-0.2, 0.9], [0.05, 1.12], [0.3, 1.18], [0.5, 1.08], [0.6, 0.9], [0.45, 0.82], [0.25, 0.86], [0.05, 0.6], [0.0, 0.0]];
    sh.moveTo(prof[0][0], prof[0][1]);
    for (let i = 1; i < prof.length; i++) sh.lineTo(prof[i][0], prof[i][1]);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 1, bevelEnabled: false, steps: 6, curveSegments: 1 });
    // la forme est dans le plan XY (x = avancée, y = hauteur) : on la tourne pour avancer selon +Z
    g.translate(0, 0, -0.5);
    g.rotateY(-Math.PI / 2);
    // bords arrondis en largeur
    const pos = g.getAttribute("position");
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const k = 1 - Math.pow(Math.abs(x) * 2, 4);
      pos.setY(i, pos.getY(i) * (0.3 + 0.7 * Math.max(0, k)));
    }
    g.computeVertexNormals();
    const base = _.shader("wave", /* glsl */ `
      uniform float uAlpha;
      void main(){
        vec3 N = normalize(vN);
        vec3 V = normalize(cameraPosition - vW);
        vec3 L = normalize(vec3(0.35, 0.85, 0.4));
        float diff = max(dot(N, L), 0.0);
        float h = clamp(vL.y / 1.18, 0.0, 1.0);
        float n = ptFbm(vec2(vL.x * 3.0, vL.z * 2.0 - uTime * 3.0));
        vec3 col = mix(vec3(0.02, 0.33, 0.48), vec3(0.12, 0.68, 0.78), h) * (0.6 + 0.55 * diff);
        float crest = smoothstep(0.7, 0.9, h + (n - 0.5) * 0.3);
        float streak = smoothstep(0.6, 0.8, ptFbm(vec2(vL.x * 6.0, vL.y * 7.0 - uTime * 4.0))) * smoothstep(0.3, 0.8, h);
        col = mix(col, vec3(0.96, 1.0, 1.0), clamp(crest + streak * 0.6, 0.0, 1.0));
        col += vec3(1.0) * pow(max(dot(reflect(-L, N), V), 0.0), 30.0) * 0.5;
        gl_FragColor = vec4(col, 1.0);
        OUT_COLOR
        gl_FragColor.a = (0.8 + 0.2 * crest) * uAlpha;
      }`, { transparent: true, depthWrite: true, side: THREE.DoubleSide, uniforms: { uTime: { value: 0 }, uAlpha: { value: 1 } } });
    const mat = base.clone();
    mat.uniforms.uTime = base.uniforms.uTime;
    const m = new THREE.Mesh(g, mat);
    m.visible = false;
    return m;
  }
  _.BURSTS.waterWave = function (p, o) {
    const S = _.S, K = _.COL, c = C();
    const L = o.length || 8, W = o.width || 3, yaw = o.yaw || 0;
    const dir = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const side = new THREE.Vector3(dir.z, 0, -dir.x);
    const start = p.clone().addScaledVector(dir, -L / 2);
    const m = _.pool("wave", () => { const w = waveMesh(); S.root.add(w); return w; });
    m.visible = true;
    m.rotation.set(0, yaw, 0);
    const H = Math.min(2.2, 0.9 + W * 0.18);
    const dur = Math.min(1.4, 0.55 + L * 0.06);
    const e = _.timed(dur, (k, dt) => {
      const grow = Math.min(1, k / 0.15), fall = k > 0.8 ? Math.max(0, 1 - (k - 0.8) / 0.2) : 1;
      const d = L * k;
      m.position.copy(start).addScaledVector(dir, d);
      m.scale.set(W, H * grow * fall + 0.01, Math.max(0.6, 1.2 * grow));
      m.material.uniforms.uAlpha.value = Math.min(1, fall * 1.2);
      // écume sur la crête et embruns
      e.acc = (e.acc || 0) + dt * 40 * S.Q * W / 3;
      for (let n = Math.floor(e.acc); n > 0; n--, e.acc--) {
        const s = R(-0.5, 0.5) * W;
        tv[0].copy(m.position).addScaledVector(side, s).addScaledVector(dir, 0.3);
        _.emit({ x: tv[0].x, y: tv[0].y + H * 1.05 * grow * fall, z: tv[0].z, vx: dir.x * 3 + R(-0.5, 0.5), vy: R(1, 3), vz: dir.z * 3 + R(-0.5, 0.5), grav: 9, life: R(0.4, 0.7), s0: R(0.12, 0.22), s1: 0.08, cell: c.drop, mode: 2, stretch: 0.04, r: K.waterFoam[0], g: K.waterFoam[1], b: K.waterFoam[2], a: 1, a1: 0.3, floor: p.y });
        if (rnd() < 0.5) _.emit({ x: tv[0].x, y: tv[0].y + H * 0.95 * grow * fall, z: tv[0].z, vx: dir.x * 2.5, vy: 0.5, vz: dir.z * 2.5, drag: 2, life: 0.5, s0: 0.5, s1: 0.9, cell: c.puffDark, r: 1, g: 1, b: 1, a: 0.8, a1: 0, rot: R(0, 6), curve: 1 });
        if (rnd() < 0.35) _.emit({ x: tv[0].x - dir.x * 0.8, y: p.y + 0.04, z: tv[0].z - dir.z * 0.8, life: R(0.6, 0.9), s0: R(0.5, 0.9), s1: 1.1, cell: c.foam, mode: 1, r: 1, g: 1, b: 1, a: 0.75, a1: 0, rot: R(0, 6) });
      }
    }, () => {
      m.visible = false;
      _.unpool("wave", m);
      tv[0].copy(start).addScaledVector(dir, L);
      _.BURSTS.splash(tv[0], { radius: Math.min(1.6, W / 3) });
    });
  };

  // ---------------------------------------------------------------------------------------------
  // Rappel : le sac file en arc doré jusqu'à la réserve
  // ---------------------------------------------------------------------------------------------
  _.BURSTS.recall = function (p, o) {
    const K = _.COL, c = C();
    const to = o.to || new THREE.Vector3(p.x, p.y, p.z + 10);
    const dist = Math.hypot(to.x - p.x, to.z - p.z);
    const T = Math.min(1.2, 0.55 + dist * 0.018);
    const g = Math.max(6, dist * 1.2);
    // vitesse initiale pour atterrir sur « to » après T secondes (trajectoire balistique = arc)
    const vx = (to.x - p.x) / T, vz = (to.z - p.z) / T, vy = (to.y - p.y) / T + 0.5 * g * T;
    const n = _.count(46);
    for (let i = 0; i < n; i++) {
      const d = (i / n) * 0.45;
      _.emit({ x: p.x + R(-0.08, 0.08), y: p.y + 0.6, z: p.z + R(-0.08, 0.08), vx, vy, vz, grav: g, life: T, s0: R(0.22, 0.34), s1: 0.12, cell: c.spark, mode: 2, stretch: 0.02, r: K.goldLight[0], g: K.goldLight[1], b: K.goldLight[2], r1: K.gold[0], g1: K.gold[1], b1: K.gold[2], a: 1, a1: 0.8, add: 1, delay: d, fadeIn: 0.02, fadeOut: 0.95 });
      if (i % 3 === 0) _.emit({ x: p.x, y: p.y + 0.6, z: p.z, vx: vx + R(-0.6, 0.6), vy: vy + R(-0.6, 0.6), vz: vz + R(-0.6, 0.6), grav: g, life: T * R(0.9, 1.05), s0: 0.05, s1: 0.3, cell: c.twinkle, r: K.gold[0], g: K.gold[1], b: K.gold[2], a: 1, a1: 0, add: 1, delay: d, spin: 5 });
    }
    // le sac lui-même (icône) en tête de l'arc
    _.emit({ x: p.x, y: p.y + 0.6, z: p.z, vx, vy, vz, grav: g, life: T, s0: 0.9, s1: 0.6, cell: c.sackIcon, a: 1, a1: 1, fadeIn: 0.02, fadeOut: 0.98, spin: 2 });
    _.emit({ x: p.x, y: p.y + 0.6, z: p.z, vx, vy, vz, grav: g, life: T, s0: 1.6, s1: 1.1, cell: c.glow, r: K.gold[0], g: K.gold[1], b: K.gold[2], a: 0.8, a1: 0.6, add: 1, fadeIn: 0.02 });
    _.BURSTS.sparkle(p, { radius: 1 });
    _.ring(p.x, p.y, p.z, 0.4, 2.4, 0.5, K.gold, 1, 0.6);
    _.timed(T, () => {}, () => {
      _.flash(to.x, to.y + 0.6, to.z, 3, K.gold, 0.3);
      _.ring(to.x, to.y, to.z, 0.3, 2.8, 0.5, K.gold, 1, 0.6);
      _.BURSTS.sparkle(to, { radius: 1.3 });
    });
  };
})();
