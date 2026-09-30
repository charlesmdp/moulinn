// « Pas touche à mes trésors » — zones persistantes, cônes d'attaque et aperçus de visée (PTMT.fx).
//
//   const a = PTMT.fx.area(kind, position, radius); a.update(position, radius, t01); a.release();
//     kind : 'groundFire' | 'blizzard' | 'polarStorm' | 'vortex' | 'maelstrom' | 'frenzy' | 'freezeZone'
//     t01 : progression de la durée de vie (apparition au début, disparition à la fin)
//   const c = PTMT.fx.cone(kind, origin, yaw, angleRad, range); c.update(origin, yaw, pulse01); c.release();
//     kind : 'flame' (souffle de dragon) | 'waterCone' (tsunami) ; yaw 0 = vers +Z
//   const t = PTMT.fx.telegraph(kind, position, radius | { length, width, yaw }); t.update(position, shape); t.release();
//     kind : famille 'fire' | 'ice' | 'water' | 'gold' (ou nom d'effet : couleur de sa famille)
//     bande : centrée sur position, longueur selon yaw
//
// Chaque zone a un décor au sol (shader) qui montre nettement son étendue vue de haut, plus des
// particules et, pour certaines, un maillage 3D (entonnoir du maelström, mur de la tempête polaire,
// cristaux de la zone gelée, colonne de lumière de la frénésie).
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

  // ---------------------------------------------------------------------------------------------
  // Décors au sol
  // ---------------------------------------------------------------------------------------------
  const DECAL_VERT = /* glsl */ `
    varying vec2 vP;
    void main(){
      vP = vec2(position.x, -position.z);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`;
  const DECAL_HEAD = /* glsl */ `
    uniform float uTime, uI, uR, uAngle, uSeed;
    varying vec2 vP;
  `;
  const OUT = "#include <tonemapping_fragment>\n#include <encodings_fragment>";
  const DECALS = {
    groundFire: /* glsl */ `
      void main(){
        float r = length(vP);
        float ang = atan(vP.y, vP.x);
        float wob = 0.05 * sin(ang * 7.0 + uTime * 3.0 + uSeed) + 0.06 * (ptNoise(vP * 4.0 + uTime * 0.7) - 0.5);
        float edge = 1.0 - smoothstep(0.8, 1.0, r + wob);
        if (edge <= 0.001) discard;
        vec2 q = vP * uR;
        float n = ptFbm(q * 0.8 + uSeed);
        float n2 = ptFbm(q * 1.9 + vec2(uTime * 0.5, -uTime * 1.2));
        vec3 col = mix(vec3(0.06, 0.03, 0.02), vec3(0.2, 0.07, 0.02), n);
        float heat = smoothstep(0.42, 0.78, n2) * (0.75 + 0.25 * sin(uTime * 7.0 + n * 12.0));
        col += vec3(1.0, 0.3, 0.03) * heat * 1.9 + vec3(1.0, 0.7, 0.25) * pow(heat, 3.0) * 1.1;
        float rim = smoothstep(0.62, 0.95, r + wob) * edge;
        col += vec3(1.0, 0.42, 0.08) * rim * (1.1 + 0.4 * sin(uTime * 9.0 + ang * 5.0));
        gl_FragColor = vec4(col, 1.0);
        ${OUT}
        gl_FragColor.a = edge * uI * 0.93;
      }`,
    frost: /* glsl */ `
      uniform float uStorm;
      void main(){
        float r = length(vP);
        if (r > 1.0) discard;
        float ang = atan(vP.y, vP.x);
        float edge = 1.0 - smoothstep(0.86, 1.0, r);
        float swirl = 0.5 + 0.5 * sin(ang * 3.0 + r * (9.0 + 4.0 * uStorm) - uTime * (3.0 + 2.0 * uStorm));
        float n = ptFbm(vP * uR * 0.7 + vec2(uTime * 0.25, uTime * 0.1));
        vec3 col = mix(vec3(0.42, 0.72, 1.0), vec3(1.0), 0.45 * swirl + 0.4 * n);
        col = mix(col, vec3(0.18, 0.42, 0.85), uStorm * (1.0 - r) * 0.5);
        float rim = smoothstep(0.88, 0.95, r) * (1.0 - smoothstep(0.96, 1.0, r));
        float arms = smoothstep(0.55, 0.95, swirl) * smoothstep(0.08, 0.5, r);
        float a = edge * (0.3 + 0.5 * arms + 0.2 * n + 0.15 * uStorm) + rim * 0.95;
        gl_FragColor = vec4(col + rim * 0.3, 1.0);
        ${OUT}
        gl_FragColor.a = clamp(a, 0.0, 1.0) * uI;
      }`,
    vortex: /* glsl */ `
      uniform float uArms;
      void main(){
        float r = length(vP);
        if (r > 1.0) discard;
        float ang = atan(vP.y, vP.x);
        float edge = 1.0 - smoothstep(0.86, 1.0, r);
        float spiral = sin(ang * uArms + log(r + 0.04) * 7.0 + uTime * 7.0);
        float spiral2 = sin(ang * (uArms + 2.0) + log(r + 0.04) * 11.0 + uTime * 9.0 + 1.3);
        float foam = smoothstep(0.45, 0.95, spiral) * smoothstep(0.06, 0.35, r);
        float foam2 = smoothstep(0.75, 1.0, spiral2) * smoothstep(0.2, 0.6, r) * 0.6;
        vec3 deep = vec3(0.01, 0.12, 0.2), mid = vec3(0.05, 0.5, 0.62);
        vec3 col = mix(deep, mid, smoothstep(0.0, 0.85, r));
        col = mix(col, vec3(0.92, 1.0, 1.0), clamp(foam * 0.85 + foam2, 0.0, 1.0));
        float rim = smoothstep(0.86, 0.95, r) * (1.0 - smoothstep(0.95, 1.0, r));
        col = mix(col, vec3(1.0), rim * 0.8);
        gl_FragColor = vec4(col, 1.0);
        ${OUT}
        gl_FragColor.a = (edge * (0.82 + 0.15 * r) + rim * 0.5) * uI;
      }`,
    frenzy: /* glsl */ `
      void main(){
        float r = length(vP);
        if (r > 1.0) discard;
        float ang = atan(vP.y, vP.x);
        float ring1 = smoothstep(0.84, 0.88, r) * (1.0 - smoothstep(0.93, 0.97, r));
        float ring2 = smoothstep(0.62, 0.65, r) * (1.0 - smoothstep(0.68, 0.71, r));
        float ticks = step(0.5, fract(ang / 6.2831853 * 18.0 + uTime * 0.35)) * smoothstep(0.72, 0.74, r) * (1.0 - smoothstep(0.8, 0.82, r));
        float runes = step(0.72, fract(ang / 6.2831853 * 9.0 - uTime * 0.2)) * step(0.72, ptNoise(vec2(floor(ang / 6.2831853 * 36.0), 3.0) + floor(uTime))) * smoothstep(0.73, 0.75, r) * (1.0 - smoothstep(0.8, 0.82, r));
        float glow = (1.0 - smoothstep(0.0, 0.9, r)) * (0.35 + 0.15 * sin(uTime * 8.0));
        float pulse = fract(uTime * 1.3);
        float wave = smoothstep(pulse - 0.06, pulse, r) * (1.0 - smoothstep(pulse, pulse + 0.02, r)) * (1.0 - pulse);
        float m = ring1 + ring2 * 0.8 + ticks * 0.9 + runes + wave * 0.8;
        vec3 col = mix(vec3(1.0, 0.22, 0.04), vec3(1.0, 0.62, 0.12), clamp(m, 0.0, 1.0)) * (0.85 + 0.35 * m);
        gl_FragColor = vec4(col, 1.0);
        ${OUT}
        gl_FragColor.a = clamp(m + glow * 0.5, 0.0, 1.0) * uI;
      }`,
    freezeZone: /* glsl */ `
      void main(){
        float r = length(vP);
        float ang = atan(vP.y, vP.x);
        float wob = 0.04 * sin(ang * 9.0 + uSeed) + 0.04 * (ptNoise(vP * 5.0 + uSeed) - 0.5);
        float edge = 1.0 - smoothstep(0.9, 1.0, r + wob);
        if (edge <= 0.001) discard;
        vec2 q = vP * uR;
        // plaques de glace craquelées
        vec2 g = q * 1.3;
        vec2 cell = floor(g); vec2 f = fract(g);
        float d1 = 8.0, d2 = 8.0;
        for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
          vec2 o = vec2(float(i), float(j));
          vec2 p = o + vec2(ptHash(cell + o + uSeed), ptHash(cell + o + 7.1 + uSeed)) - f;
          float d = dot(p, p);
          if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
        }
        float crack = 1.0 - smoothstep(0.0, 0.08, sqrt(d2) - sqrt(d1));
        float n = ptFbm(q * 0.9 + uSeed);
        vec3 col = mix(vec3(0.42, 0.78, 0.98), vec3(0.85, 0.97, 1.0), n);
        col = mix(col, vec3(1.0), crack * 0.9);
        float sheen = pow(0.5 + 0.5 * sin(q.x * 0.9 + q.y * 0.6 - uTime * 1.5), 12.0);
        col += vec3(0.6, 0.9, 1.0) * sheen * 0.5;
        float rim = smoothstep(0.78, 0.95, r + wob) * edge;
        col = mix(col, vec3(1.0), rim * 0.6);
        gl_FragColor = vec4(col, 1.0);
        ${OUT}
        gl_FragColor.a = edge * uI * (0.82 + 0.15 * crack);
      }`,
    sectorFire: /* glsl */ `
      void main(){
        float r = length(vP);
        float ang = atan(vP.x, vP.y);
        float lim = uAngle * 0.5;
        if (r > 1.0 || abs(ang) > lim) discard;
        float side = 1.0 - smoothstep(lim * 0.75, lim, abs(ang));
        float far = 1.0 - smoothstep(0.8, 1.0, r);
        float near = smoothstep(0.0, 0.12, r);
        float n = ptFbm(vec2(ang * 4.0, r * uR * 0.9 - uTime * 4.0));
        vec3 col = mix(vec3(0.25, 0.06, 0.01), vec3(1.0, 0.4, 0.06), n) * (1.0 + n);
        gl_FragColor = vec4(col, 1.0);
        ${OUT}
        gl_FragColor.a = side * far * near * uI * (0.35 + 0.45 * n);
      }`,
    sectorWater: /* glsl */ `
      void main(){
        float r = length(vP);
        float ang = atan(vP.x, vP.y);
        float lim = uAngle * 0.5;
        if (r > 1.0 || abs(ang) > lim) discard;
        float side = 1.0 - smoothstep(lim * 0.8, lim, abs(ang));
        float far = 1.0 - smoothstep(0.85, 1.0, r);
        float n = ptFbm(vec2(ang * 5.0, r * uR * 1.2 - uTime * 5.0));
        float band = smoothstep(0.55, 0.8, sin(r * uR * 2.2 - uTime * 9.0) * 0.5 + 0.5);
        vec3 col = mix(vec3(0.05, 0.45, 0.6), vec3(0.9, 1.0, 1.0), clamp(band * 0.7 + n * 0.4, 0.0, 1.0));
        gl_FragColor = vec4(col, 1.0);
        ${OUT}
        gl_FragColor.a = side * far * uI * (0.45 + 0.35 * band);
      }`,
    telegraph: /* glsl */ `
      uniform vec3 uColor;
      uniform float uBand, uAspect;
      void main(){
        float m = 0.0, fill = 0.0;
        if (uBand < 0.5) {
          float r = length(vP);
          if (r > 1.0) discard;
          float ang = atan(vP.y, vP.x);
          float ring = smoothstep(0.9, 0.93, r) * (1.0 - smoothstep(0.975, 1.0, r));
          float dash = step(0.45, fract(ang / 6.2831853 * 28.0 - uTime * 0.6)) * smoothstep(0.8, 0.82, r) * (1.0 - smoothstep(0.86, 0.88, r));
          float pr = fract(uTime * 0.9);
          float wave = smoothstep(pr - 0.07, pr, r) * (1.0 - smoothstep(pr, pr + 0.015, r)) * (1.0 - pr);
          float cross = (1.0 - smoothstep(0.004, 0.012, abs(vP.x))) * step(r, 0.12) + (1.0 - smoothstep(0.004, 0.012, abs(vP.y))) * step(r, 0.12);
          m = ring + dash * 0.8 + wave * 0.6 + cross * 0.7;
          fill = 0.16 + 0.06 * sin(uTime * 5.0);
        } else {
          vec2 a = abs(vP);
          if (a.x > 1.0 || a.y > 1.0) discard;
          float bx = 0.06, by = 0.06 / max(uAspect, 0.2);
          float border = max(smoothstep(1.0 - bx, 1.0 - bx * 0.5, a.x), smoothstep(1.0 - by, 1.0 - by * 0.5, a.y));
          float chev = fract(vP.y * uAspect * 1.2 - abs(vP.x) * 0.9 - uTime * 1.4);
          float ch = smoothstep(0.0, 0.08, chev) * (1.0 - smoothstep(0.22, 0.3, chev)) * step(a.x, 0.7);
          m = border + ch * 0.55;
          fill = 0.14 + 0.06 * sin(uTime * 5.0);
        }
        vec3 col = uColor * (1.0 + m * 0.8);
        gl_FragColor = vec4(col, 1.0);
        ${OUT}
        gl_FragColor.a = clamp(fill + m, 0.0, 1.0) * uI;
      }`,
  };

  function decalMaterial(kind, extra) {
    // une matière par poignée (uniformes propres), mais un seul programme GPU par type
    const m = new THREE.ShaderMaterial({
      uniforms: Object.assign({ uTime: { value: 0 }, uI: { value: 1 }, uR: { value: 1 }, uAngle: { value: 1 }, uSeed: { value: rnd() * 50 } }, extra || {}),
      vertexShader: DECAL_VERT,
      fragmentShader: DECAL_HEAD + PTMT.gfx.GLSL.noise + DECALS[kind],
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -4,
    });
    m.name = "ptmt:fx:decal:" + kind;
    m.customProgramCacheKey = () => "ptmt-decal-" + kind;
    return m;
  }
  let PLANE = null;
  function decalMesh(kind, extra) {
    if (!PLANE) { PLANE = new THREE.PlaneGeometry(2, 2, 1, 1); PLANE.rotateX(-Math.PI / 2); }
    const mesh = new THREE.Mesh(PLANE, decalMaterial(kind, extra));
    mesh.renderOrder = 3;
    mesh.frustumCulled = false;
    mesh.visible = false;
    return mesh;
  }
  _.decalMesh = decalMesh;

  // ---------------------------------------------------------------------------------------------
  // Maillages 3D des zones
  // ---------------------------------------------------------------------------------------------
  function funnel() {
    // entonnoir d'eau : révolution ouverte, large en haut
    const pts = [];
    for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(new THREE.Vector2(0.12 + Math.pow(t, 1.6) * 0.95, t * 1.0)); }
    const g = new THREE.LatheGeometry(pts, 28);
    const m = _.shader("funnel", /* glsl */ `
      uniform float uI;
      void main(){
        float ang = atan(vL.z, vL.x);
        float s = sin(ang * 4.0 + vL.y * 9.0 - uTime * 8.0);
        float n = ptFbm(vec2(ang * 3.0 + uTime * 2.0, vL.y * 5.0 - uTime * 3.0));
        float foam = smoothstep(0.35, 0.9, s * 0.6 + n * 0.8);
        vec3 col = mix(vec3(0.02, 0.32, 0.46), vec3(0.95, 1.0, 1.0), foam);
        float a = (0.62 + 0.35 * foam) * smoothstep(0.0, 0.18, vL.y) * (1.0 - smoothstep(0.8, 1.0, vL.y)) * uI;
        gl_FragColor = vec4(col, 1.0);
        OUT_COLOR
        gl_FragColor.a = a;
      }`, { transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uTime: { value: 0 }, uI: { value: 1 } } });
    const mesh = new THREE.Mesh(g, m.clone());
    mesh.material.uniforms.uTime = m.uniforms.uTime;
    return mesh;
  }
  function stormWall() {
    const g = new THREE.CylinderGeometry(1, 0.92, 1, 28, 1, true);
    g.translate(0, 0.5, 0);
    const base = _.shader("stormWall", /* glsl */ `
      uniform float uI;
      void main(){
        float ang = atan(vL.z, vL.x);
        float n = ptFbm(vec2(ang * 5.0 - uTime * 3.5, vL.y * 3.0 + uTime * 0.5));
        float n2 = ptFbm(vec2(ang * 9.0 - uTime * 5.0, vL.y * 6.0));
        float streak = smoothstep(0.5, 0.85, n);
        float fade = smoothstep(0.0, 0.15, vL.y) * (1.0 - smoothstep(0.45, 1.0, vL.y));
        vec3 col = mix(vec3(0.55, 0.78, 1.0), vec3(1.0), streak * 0.8 + n2 * 0.2);
        gl_FragColor = vec4(col, 1.0);
        OUT_COLOR
        gl_FragColor.a = (0.1 + 0.6 * streak) * fade * uI;
      }`, { transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uTime: { value: 0 }, uI: { value: 1 } } });
    const m = base.clone();
    m.uniforms.uTime = base.uniforms.uTime;
    return new THREE.Mesh(g, m);
  }
  function lightColumn() {
    const g = new THREE.CylinderGeometry(1, 1, 1, 24, 1, true);
    g.translate(0, 0.5, 0);
    const base = _.shader("frenzyColumn", /* glsl */ `
      uniform float uI;
      void main(){
        float ang = atan(vL.z, vL.x);
        float n = ptFbm(vec2(ang * 3.0, vL.y * 2.0 - uTime * 2.5));
        float streak = smoothstep(0.55, 0.85, ptFbm(vec2(ang * 7.0, vL.y * 3.0 - uTime * 4.0)));
        float fade = pow(1.0 - vL.y, 1.5) * smoothstep(0.0, 0.05, vL.y);
        vec3 col = mix(vec3(1.0, 0.32, 0.06), vec3(1.0, 0.72, 0.25), n + streak * 0.5);
        gl_FragColor = vec4(col, 1.0);
        OUT_COLOR
        gl_FragColor.a = (0.12 + 0.3 * n + 0.35 * streak) * fade * uI;
      }`, { transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uTime: { value: 0 }, uI: { value: 1 } } });
    const m = base.clone();
    m.uniforms.uTime = base.uniforms.uTime;
    return new THREE.Mesh(g, m);
  }
  function crystalRing() {
    const grp = new THREE.Group();
    const m = _.iceMat();
    const n = 12;
    for (let i = 0; i < n; i++) {
      const s = new THREE.Mesh(_.geo("zoneCrystal", () => _.crystalGeo(1, 0.22, 5)), m);
      grp.add(s);
    }
    grp.userData.layout = function (radius, k, seed) {
      const rng = PTMT.rng(Math.floor(seed * 1000));
      grp.children.forEach((s, i) => {
        const a = (i / n) * Math.PI * 2 + rng() * 0.3;
        const d = radius * (0.88 + rng() * 0.12);
        const h = (0.5 + rng() * 0.6) * Math.min(1.4, 0.4 + radius * 0.25);
        s.position.set(Math.cos(a) * d, 0, Math.sin(a) * d);
        s.rotation.set(-Math.PI / 2 + (rng() - 0.5) * 0.5, 0, 0);
        s.rotateOnWorldAxis(tv[0].set(-Math.sin(a), 0, Math.cos(a)), -0.35 - rng() * 0.3);
        s.scale.set(h * 0.8, h * 0.8, h * k);
      });
    };
    return grp;
  }

  // ---------------------------------------------------------------------------------------------
  // Zones
  // ---------------------------------------------------------------------------------------------
  const AREA_DECAL = { groundFire: "groundFire", blizzard: "frost", polarStorm: "frost", vortex: "vortex", maelstrom: "vortex", frenzy: "frenzy", freezeZone: "freezeZone" };
  class Area {
    constructor(kind) {
      const S = _.S;
      this.kind = kind;
      const dk = AREA_DECAL[kind];
      if (!dk) throw new Error("PTMT.fx.area : type inconnu « " + kind + " »");
      const extra = {};
      if (dk === "frost") extra.uStorm = { value: kind === "polarStorm" ? 1 : 0 };
      if (dk === "vortex") extra.uArms = { value: kind === "maelstrom" ? 4 : 3 };
      this.decal = decalMesh(dk, extra);
      S.root.add(this.decal);
      this.extra = null;
      if (kind === "maelstrom") this.extra = funnel();
      if (kind === "polarStorm") this.extra = stormWall();
      if (kind === "frenzy") this.extra = lightColumn();
      if (kind === "freezeZone") this.extra = crystalRing();
      if (this.extra) { this.extra.visible = false; this.extra.frustumCulled = false; S.root.add(this.extra); }
      this.pos = V();
      this.radius = 1;
      this.t01 = 0;
      this.acc = {};
    }
    _start(position, radius) {
      this.active = true;
      this.age = 0;
      this.seed = rnd();
      this.decal.material.uniforms.uSeed.value = this.seed * 50;
      this.laidOut = -1;
      this.update(position, radius, 0);
      this.decal.visible = true;
      if (this.extra) this.extra.visible = true;
      _.S.live.add(this);
    }
    /** Nouvelle position/rayon (mètres) et progression de vie t01 (0 → 1). */
    update(position, radius, t01) {
      if (!this.active) return this;
      if (position) this.pos.copy(position);
      if (radius !== undefined && radius !== null) this.radius = Math.max(0.2, radius);
      if (t01 !== undefined && t01 !== null) this.t01 = Math.min(1, Math.max(0, t01));
      const r = this.radius, p = this.pos;
      this.decal.position.set(p.x, p.y + 0.05, p.z);
      this.decal.scale.set(r, 1, r);
      this.decal.material.uniforms.uR.value = r;
      if (this.extra) {
        this.extra.position.set(p.x, p.y + 0.04, p.z);
        if (this.kind === "maelstrom") this.extra.scale.set(r * 0.8, Math.min(3.5, 1.2 + r * 0.45), r * 0.8);
        if (this.kind === "polarStorm") this.extra.scale.set(r, Math.min(2.8, 1.5 + r * 0.3), r);
        if (this.kind === "frenzy") this.extra.scale.set(r * 0.8, Math.min(7, 3 + r), r * 0.8);
      }
      return this;
    }
    intensity() {
      const t = this.t01;
      return Math.min(1, t / 0.07 + 0.08, (1 - t) / 0.12);
    }
    frame(dt) {
      this.age += dt;
      const I = Math.max(0, this.intensity()), u = this.decal.material.uniforms;
      u.uTime.value = _.S.time;
      u.uI.value = I;
      if (this.extra) {
        if (this.extra.material && this.extra.material.uniforms && this.extra.material.uniforms.uI) this.extra.material.uniforms.uI.value = I;
        if (this.kind === "maelstrom") this.extra.rotation.y = -_.S.time * 2.2;
        if (this.kind === "freezeZone") {
          const k = Math.min(1, this.age / 0.25) * (this.t01 > 0.88 ? Math.max(0, (1 - this.t01) / 0.12) : 1);
          if (Math.abs(this.laidOut - k) > 0.02 || this.laidR !== this.radius) { this.extra.userData.layout(this.radius, Math.max(0.001, k), this.seed); this.laidOut = k; this.laidR = this.radius; }
        }
      }
      AREA_EMIT[this.kind](this, dt, I);
    }
    every(key, rate, dt) {
      const a = (this.acc[key] || 0) + rate * dt;
      const n = Math.floor(a);
      this.acc[key] = a - n;
      return n;
    }
    release() {
      if (!this.active) return;
      this.active = false;
      this.decal.visible = false;
      if (this.extra) this.extra.visible = false;
      _.S.live.delete(this);
      _.unpool("area:" + this.kind, this);
    }
  }
  const COL = () => _.COL;
  // Recettes de particules des zones et cônes (préparées une fois : aucune allocation par image).
  let AR = null;
  function areaRecipes() {
    if (AR) return AR;
    const c = C(), K = COL();
    AR = {
      fireFlame: { drag: 1.5, life: [0.45, 0.75], s0: 1, s1: 0.3, cell: c.flame, mode: 3, col1: [1, 0.6, 0.4], a: 1, a1: 0, add: 0.35, rot: [-0.2, 0.2], fadeIn: 0.15 },
      fireSmoke: { drag: 0.8, life: [1.0, 1.4], s0: 0.5, s1: 1.4, cell: c.puffDark, col: K.smoke, a: 0.45, a1: 0, rot: "rand", spin: [-0.5, 0.5], curve: 1 },
      ember: { drag: 1, grav: 1, life: [0.5, 1.0], s0: 0.07, s1: 0.02, cell: c.disc, col: K.ember, a: 1, a1: 0.3, add: 1 },
      frenzySpark: { drag: 0.6, life: [0.5, 0.9], s0: 0.14, s1: 0.05, cell: c.spark, mode: 2, stretch: 0.08, col: K.fireYellow, col1: K.fireRed, a: 1, a1: 0, add: 1 },
      frenzyFlame: { life: [0.4, 0.6], s0: [0.35, 0.6], s1: 0.1, cell: c.flameB, mode: 3, col: K.fireOrange, col1: K.fireRed, a: 0.9, a1: 0, add: 0.8 },
      frostMist: { drag: 1, life: [1.2, 1.8], s0: 0.6, s1: 1.4, cell: c.puffDark, col: K.frost, a: 0.28, a1: 0, rot: "rand", spin: [-0.3, 0.3], curve: 1 },
      twinkle: { life: [0.4, 0.7], s0: 0.03, s1: [0.2, 0.35], cell: c.twinkle, a: 1, a1: 0, add: 1, curve: 2, spin: 3 },
      snow: { grav: [-0.4, 0.2], angle0: [0, 6.283], mode: 4, life: [0.8, 1.3], s0: [0.16, 0.32], s1: 0.08, cell: c.snow, a: 1, a1: 0, add: 0.2, rot: "rand", spin: [-3, 3], fadeIn: 0.15 },
      wind: { angle0: [0, 6.283], mode: 4, life: [0.5, 0.8], s0: 1, s1: 0.6, cell: c.wind, a: 0.95, a1: 0, add: 0.2, fadeIn: 0.2 },
      shard: { angle0: [0, 6.283], mode: 4, life: [0.6, 1.0], s0: [0.2, 0.35], s1: 0.1, cell: c.shard, a: 1, a1: 0, spin: [-8, 8] },
      whirlDrop: { grav: -0.3, angle0: [0, 6.283], mode: 4, life: [0.7, 1.1], s0: [0.1, 0.18], s1: 0.05, cell: c.drop, col: K.waterFoam, a: 0.95, a1: 0, fadeIn: 0.15 },
      whirlDropStrong: { grav: [-3, -1.5], angle0: [0, 6.283], mode: 4, life: [0.7, 1.1], s0: [0.1, 0.18], s1: 0.05, cell: c.drop, col: K.waterFoam, a: 0.95, a1: 0, fadeIn: 0.15 },
      whirlFoam: { angle0: [0, 6.283], mode: 5, life: [0.8, 1.2], s0: [0.3, 0.6], s1: 0.15, cell: c.foam, a: 0.85, a1: 0, rot: "rand", fadeIn: 0.2 },
      spray: { grav: 8, life: [0.5, 0.8], s0: 0.12, s1: 0.06, cell: c.drop, mode: 2, stretch: 0.05, col: K.waterFoam, a: 1, a1: 0.3 },
      ring: { life: 0.6, s0: 1, s1: 2, cell: c.ring, mode: 1, col: K.fireYellow, a: 0.7, a1: 0, add: 0.8, curve: 1, rot: "rand" },
      breath: { drag: 0.6, life: [0.47, 0.6], s0: [0.25, 0.4], s1: 1, cell: c.puff, col: K.fireOrange, col1: K.fireRed, a: 1, a1: 0, add: 0.42, rot: "rand", spin: [-2, 2], curve: 1, fadeOut: 0.6 },
      breathSmoke: { drag: 1.2, life: [0.9, 1.2], s0: 0.4, s1: 1.8, cell: c.puffDark, col: K.smoke, a: 0.5, a1: 0, rot: "rand", curve: 1, delay: 0.35 },
      breathSpark: { grav: 6, life: [0.4, 0.7], s0: 0.1, s1: 0.03, cell: c.spark, mode: 2, stretch: 0.03, col: K.fireYellow, a: 1, a1: 0.2, add: 1 },
      waveFoam: { drag: 0.8, life: 0.6, s0: 0.3, s1: 1.2, cell: c.foam, col: K.waterFoam, a: 0.9, a1: 0, rot: "rand", spin: [-1.5, 1.5], curve: 1, fadeOut: 0.6 },
      waveBody: { drag: 0.7, life: 0.6, s0: 0.35, s1: 1.4, cell: c.puff, col: K.water, col1: K.waterLight, a: 0.85, a1: 0, rot: "rand", spin: [-1.5, 1.5], curve: 1, fadeOut: 0.6 },
      waveDrop: { grav: 7, life: [0.54, 0.72], s0: [0.16, 0.26], s1: 0.12, cell: c.drop, mode: 2, stretch: 0.03, col: K.waterLight, a: 1, a1: 0.4 },
      crown: { life: 0.4, s0: 0.8, s1: 1.4, cell: c.splash, mode: 3, a: 0.9, a1: 0, curve: 1 },
    };
    return AR;
  }
  function ringR(x, y, z, s0, s1, life, col, a, add, cell) {
    const r = areaRecipes().ring;
    r.s0 = s0; r.s1 = s1; r.life = life; r.col = col; r.a = a; r.add = add; r.cell = cell === undefined ? C().ring : cell;
    _.S.P.emitR(r, x, y + 0.04, z, 0, 0, 0);
  }
  // émissions par zone (taux proportionnels à la surface, plafonnés, divisés par deux sur mobile)
  const AREA_EMIT = {
    groundFire(a, dt, I) {
      const r = a.radius, p = a.pos, c = C(), Q = _.S.Q, P = _.S.P, A = areaRecipes();
      const rate = Math.min(90, 10 + r * r * 7) * Q * I;
      for (let i = 0, n = a.every("fl", rate, dt); i < n; i++) {
        const ang = R(0, 6.283), d = Math.sqrt(rnd()) * r * 0.85;
        const sz = R(0.75, 1.25) * Math.min(1.5, 0.8 + r * 0.1);
        A.fireFlame.s0 = sz; A.fireFlame.s1 = sz * 0.3; A.fireFlame.cell = rnd() < 0.7 ? c.flame : c.flameB;
        P.emitR(A.fireFlame, p.x + Math.cos(ang) * d, p.y + 0.1, p.z + Math.sin(ang) * d, R(-0.2, 0.2), R(1.2, 2.2), R(-0.2, 0.2));
      }
      for (let i = 0, n = a.every("sm", rate * 0.18, dt); i < n; i++) {
        const ang = R(0, 6.283), d = Math.sqrt(rnd()) * r * 0.8;
        P.emitR(A.fireSmoke, p.x + Math.cos(ang) * d, p.y + 0.8, p.z + Math.sin(ang) * d, R(-0.3, 0.3), R(1, 1.8), R(-0.3, 0.3));
      }
      for (let i = 0, n = a.every("em", rate * 0.5, dt); i < n; i++) {
        const ang = R(0, 6.283), d = Math.sqrt(rnd()) * r;
        P.emitR(A.ember, p.x + Math.cos(ang) * d, p.y + 0.2, p.z + Math.sin(ang) * d, R(-0.6, 0.6), R(1.5, 3.5), R(-0.6, 0.6));
      }
    },
    blizzard(a, dt, I) { snowStorm(a, dt, I, false); },
    polarStorm(a, dt, I) { snowStorm(a, dt, I, true); },
    vortex(a, dt, I) { whirl(a, dt, I, false); },
    maelstrom(a, dt, I) { whirl(a, dt, I, true); },
    frenzy(a, dt, I) {
      const r = a.radius, p = a.pos, K = COL(), Q = _.S.Q, P = _.S.P, A = areaRecipes();
      const rate = Math.min(60, 14 + r * 6) * Q * I;
      for (let i = 0, n = a.every("sp", rate, dt); i < n; i++) {
        const ang = R(0, 6.283), d = r * R(0.55, 0.95);
        P.emitR(A.frenzySpark, p.x + Math.cos(ang) * d, p.y + 0.1, p.z + Math.sin(ang) * d, 0, R(3, 6), 0);
      }
      for (let i = 0, n = a.every("fl", rate * 0.35, dt); i < n; i++) {
        const ang = R(0, 6.283), d = r * R(0.8, 1.0);
        P.emitR(A.frenzyFlame, p.x + Math.cos(ang) * d, p.y + 0.1, p.z + Math.sin(ang) * d, 0, R(1, 2), 0);
      }
      for (let i = 0, n = a.every("rn", 1.2 * I, dt); i < n; i++) ringR(p.x, p.y + 0.02, p.z, r * 0.3, r * 1.15, 0.6, K.fireYellow, 0.7, 0.8);
    },
    freezeZone(a, dt, I) {
      const r = a.radius, p = a.pos, Q = _.S.Q, P = _.S.P, A = areaRecipes();
      const rate = Math.min(40, 6 + r * r * 3) * Q * I;
      for (let i = 0, n = a.every("mi", rate * 0.4, dt); i < n; i++) {
        const ang = R(0, 6.283), d = Math.sqrt(rnd()) * r;
        P.emitR(A.frostMist, p.x + Math.cos(ang) * d, p.y + 0.15, p.z + Math.sin(ang) * d, R(-0.3, 0.3), R(0.05, 0.3), R(-0.3, 0.3));
      }
      for (let i = 0, n = a.every("tw", rate * 0.6, dt); i < n; i++) {
        const ang = R(0, 6.283), d = Math.sqrt(rnd()) * r;
        P.emitR(A.twinkle, p.x + Math.cos(ang) * d, p.y + R(0.05, 0.4), p.z + Math.sin(ang) * d, 0, 0, 0);
      }
    },
  };
  function snowStorm(a, dt, I, strong) {
    const r = a.radius, p = a.pos, c = C(), K = COL(), Q = _.S.Q, P = _.S.P, A = areaRecipes();
    const rate = Math.min(strong ? 190 : 140, (strong ? 40 : 28) + r * r * (strong ? 12 : 9)) * Q * I;
    const w = strong ? 2.6 : 1.8;
    for (let i = 0, n = a.every("sn", rate, dt); i < n; i++) {
      const d = Math.sqrt(rnd()) * r;
      A.snow.cell = rnd() < 0.6 ? c.snow : c.disc;
      // orbite : vx = rayon, vy = vitesse radiale, vz = vitesse angulaire (voir SpriteBatch)
      P.emitR(A.snow, p.x, p.y + R(0.1, strong ? 2.8 : 2.0), p.z, d, R(-0.3, 0.2) * r * 0.1, w * R(0.8, 1.2) * (1.2 - (d / r) * 0.5));
    }
    for (let i = 0, n = a.every("wi", rate * 0.16, dt); i < n; i++) {
      const d = r * R(0.3, 0.95);
      A.wind.s0 = R(1.0, 1.6) * Math.min(1.5, 0.6 + r * 0.15);
      P.emitR(A.wind, p.x, p.y + R(0.2, strong ? 2.2 : 1.5), p.z, d, 0, w * 0.9);
    }
    if (strong) {
      for (let i = 0, n = a.every("sh", rate * 0.15, dt); i < n; i++) {
        const d = r * R(0.2, 0.9);
        P.emitR(A.shard, p.x, p.y + R(0.3, 2.5), p.z, d, -0.2, w * 1.1);
      }
      for (let i = 0, n = a.every("fr", 1.5 * I, dt); i < n; i++) ringR(p.x, p.y + 0.03, p.z, r * 0.2, r * 1.1, 0.8, K.iceWhite, 0.6, 0.3, c.frost);
    }
  }
  function whirl(a, dt, I, strong) {
    const r = a.radius, p = a.pos, Q = _.S.Q, P = _.S.P, A = areaRecipes();
    const rate = Math.min(strong ? 120 : 80, (strong ? 26 : 14) + r * r * (strong ? 7 : 5)) * Q * I;
    for (let i = 0, n = a.every("dr", rate, dt); i < n; i++) {
      const d = r * R(0.55, 1.0);
      P.emitR(strong ? A.whirlDropStrong : A.whirlDrop, p.x, p.y + R(0.05, 0.3), p.z, d, -d * R(0.5, 0.8), R(3.5, 5.5) * (strong ? 1.3 : 1));
    }
    for (let i = 0, n = a.every("fo", rate * 0.35, dt); i < n; i++) {
      const d = r * R(0.35, 0.95);
      P.emitR(A.whirlFoam, p.x, p.y + 0.07, p.z, d, -d * 0.4, R(2.5, 4));
    }
    if (strong) {
      for (let i = 0, n = a.every("sp", rate * 0.25, dt); i < n; i++) {
        const ang = R(0, 6.283), d = r * R(0.1, 0.4);
        P.emitR(A.spray, p.x + Math.cos(ang) * d, p.y + R(1.0, 2.5), p.z + Math.sin(ang) * d, Math.cos(ang) * 2, R(1, 3), Math.sin(ang) * 2);
      }
    }
  }

  FX.area = function (kind, position, radius) {
    if (!_.S) throw new Error("PTMT.fx.area : appeler d’abord PTMT.fx.init()");
    const a = _.pool("area:" + kind, () => new Area(kind));
    a._start(position, radius);
    return a;
  };

  // ---------------------------------------------------------------------------------------------
  // Cônes (attaques continues pulsées)
  // ---------------------------------------------------------------------------------------------
  class Cone {
    constructor(kind) {
      if (kind !== "flame" && kind !== "waterCone") throw new Error("PTMT.fx.cone : type inconnu « " + kind + " »");
      this.kind = kind;
      this.decal = decalMesh(kind === "flame" ? "sectorFire" : "sectorWater");
      _.S.root.add(this.decal);
      this.origin = V();
      this.dir = V();
      this.acc = 0;
      this.acc2 = 0;
    }
    _start(origin, yaw, angle, range) {
      this.active = true;
      this.angle = Math.max(0.1, Math.min(Math.PI * 1.6, angle || 0.8));
      this.range = Math.max(0.5, range || 6);
      this.pulse = 1;
      this.age = 0;
      this.update(origin, yaw, 1);
      this.decal.visible = true;
      _.S.live.add(this);
    }
    /** Origine (monde), direction (yaw, 0 = +Z) et intensité pulsée 0..1. */
    update(origin, yaw, pulse01) {
      if (!this.active) return this;
      if (origin) this.origin.copy(origin);
      if (yaw !== undefined && yaw !== null) this.yaw = yaw;
      if (pulse01 !== undefined && pulse01 !== null) this.pulse = Math.max(0, Math.min(1, pulse01));
      this.dir.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
      const o = this.origin;
      this.decal.position.set(o.x, o.y + 0.06 - (this.kind === "flame" ? 0 : 0), o.z);
      // vP.y = avant : le plan est tourné pour que -Z local (vP.y > 0) pointe vers yaw
      this.decal.rotation.set(0, this.yaw + Math.PI, 0);
      this.decal.scale.set(this.range, 1, this.range);
      const u = this.decal.material.uniforms;
      u.uR.value = this.range;
      u.uAngle.value = this.angle;
      return this;
    }
    frame(dt) {
      this.age += dt;
      const u = this.decal.material.uniforms;
      u.uTime.value = _.S.time;
      const I = Math.min(1, this.age / 0.12) * (0.35 + 0.65 * this.pulse);
      u.uI.value = I;
      if (this.kind === "flame") flameCone(this, dt, I);
      else waterCone(this, dt, I);
    }
    release() {
      if (!this.active) return;
      this.active = false;
      this.decal.visible = false;
      _.S.live.delete(this);
      _.unpool("cone:" + this.kind, this);
    }
  }
  function coneVel(out, c, speed, spreadUp) {
    const a = c.yaw + R(-0.5, 0.5) * c.angle * 0.92;
    out.set(Math.sin(a) * speed, R(-0.05, spreadUp) * speed, Math.cos(a) * speed);
    return out;
  }
  function flameCone(c, dt, I) {
    const K = COL(), cc = C(), Q = _.S.Q, o = c.origin, P = _.S.P, A = areaRecipes();
    const life = 0.55;
    const rate = Math.min(140, 40 + c.range * c.angle * 12) * Q * (0.4 + 0.6 * c.pulse);
    c.acc += rate * dt;
    const n = Math.floor(c.acc);
    c.acc -= n;
    const big = Math.min(2.4, 0.9 + c.range * 0.13) * (0.8 + 0.4 * c.pulse);
    for (let i = 0; i < n; i++) {
      const sp = (c.range / life) * R(0.85, 1.15);
      coneVel(tv[0], c, sp, 0.12);
      A.breath.cell = rnd() < 0.6 ? cc.puff : cc.flameB;
      A.breath.col = rnd() < 0.3 ? K.fireYellow : K.fireOrange;
      A.breath.s1 = big * R(0.8, 1.2);
      P.emitR(A.breath, o.x + tv[0].x * 0.03, o.y + R(-0.1, 0.1), o.z + tv[0].z * 0.03, tv[0].x, tv[0].y + 0.4, tv[0].z);
    }
    for (let i = 0, k = Math.floor(rate * dt * 0.25 + rnd()); i < k; i++) {
      coneVel(tv[0], c, (c.range / 0.7) * R(0.8, 1.1), 0.2);
      P.emitR(A.breathSmoke, o.x, o.y, o.z, tv[0].x, tv[0].y + 1.5, tv[0].z);
    }
    for (let i = 0, k = Math.floor(rate * dt * 0.4 + rnd()); i < k; i++) {
      coneVel(tv[0], c, (c.range / 0.5) * R(0.7, 1.2), 0.3);
      P.emitR(A.breathSpark, o.x, o.y, o.z, tv[0].x, tv[0].y + 2, tv[0].z);
    }
    _.put(o.x, o.y, o.z, 1.6 * (0.7 + 0.5 * c.pulse), cc.glow, K.fireOrange, 0.9 * I, 0, 1);
  }
  function waterCone(c, dt, I) {
    const K = COL(), cc = C(), Q = _.S.Q, o = c.origin, P = _.S.P, A = areaRecipes();
    const life = 0.6;
    const rate = Math.min(150, 40 + c.range * c.angle * 14) * Q * (0.4 + 0.6 * c.pulse);
    c.acc += rate * dt;
    const n = Math.floor(c.acc);
    c.acc -= n;
    A.waveFoam.s1 = Math.min(1.8, 0.7 + c.range * 0.12);
    A.waveBody.s1 = Math.min(2.0, 0.8 + c.range * 0.14);
    for (let i = 0; i < n; i++) {
      const sp = (c.range / life) * R(0.8, 1.1);
      coneVel(tv[0], c, sp, 0.35);
      const kind = rnd();
      if (kind < 0.2) P.emitR(A.waveFoam, o.x, o.y, o.z, tv[0].x, tv[0].y, tv[0].z);
      else if (kind < 0.45) P.emitR(A.waveBody, o.x, o.y, o.z, tv[0].x, tv[0].y + 0.3, tv[0].z);
      else P.emitR(A.waveDrop, o.x, o.y, o.z, tv[0].x, tv[0].y + 1.5, tv[0].z, o.y - 0.3);
    }
    if (rnd() < dt * 8 * c.pulse) {
      tv[1].copy(c.dir).multiplyScalar(c.range * R(0.6, 0.95)).add(o);
      P.emitR(A.crown, tv[1].x, o.y + 0.35, tv[1].z, 0, 0, 0);
    }
    _.put(o.x, o.y, o.z, 1.4 * (0.7 + 0.5 * c.pulse), cc.glow, K.waterFoam, 0.4 * I, 0, 0.3);
  }
  FX.cone = function (kind, origin, yaw, angleRad, range) {
    if (!_.S) throw new Error("PTMT.fx.cone : appeler d’abord PTMT.fx.init()");
    const c = _.pool("cone:" + kind, () => new Cone(kind));
    c._start(origin, yaw, angleRad, range);
    return c;
  };

  // ---------------------------------------------------------------------------------------------
  // Aperçus de visée
  // ---------------------------------------------------------------------------------------------
  const FAMILY = {
    fire: ["fire", "fireball", "lavaShell", "meteor", "groundFire", "flame", "explosion", "lavaSplash", "meteorImpact", "frenzy", "feu"],
    ice: ["ice", "iceShard", "iceSpike", "blizzard", "polarStorm", "freezeZone", "freezeFlash", "iceShatter", "glace"],
    water: ["water", "waterJet", "waterBlast", "waterCone", "waterWave", "vortex", "maelstrom", "splash", "eau"],
    gold: ["gold", "recall", "coins", "sack", "or"],
  };
  const FAMILY_COLOR = { fire: 0xff7a1a, ice: 0x8fe6ff, water: 0x2fd0d8, gold: 0xffd23a, neutral: 0xf2f2f2 };
  function familyOf(kind) {
    for (const f in FAMILY) if (FAMILY[f].indexOf(kind) >= 0) return f;
    return "neutral";
  }
  FX.family = familyOf;
  class Telegraph {
    constructor() {
      this.mesh = decalMesh("telegraph", { uColor: { value: new THREE.Color() }, uBand: { value: 0 }, uAspect: { value: 1 } });
      this.mesh.renderOrder = 4;
      _.S.root.add(this.mesh);
      this.pos = V();
    }
    _start(kind, position, shape) {
      this.active = true;
      this.age = 0;
      this.mesh.material.uniforms.uColor.value.copy(PTMT.color(FAMILY_COLOR[familyOf(kind)]));
      this.update(position, shape);
      this.mesh.visible = true;
      _.S.live.add(this);
    }
    update(position, shape) {
      if (!this.active) return this;
      if (position) this.pos.copy(position);
      if (shape !== undefined && shape !== null) this.shape = shape;
      const u = this.mesh.material.uniforms, s = this.shape, p = this.pos;
      this.mesh.position.set(p.x, p.y + 0.07, p.z);
      if (typeof s === "number") {
        u.uBand.value = 0;
        this.mesh.rotation.set(0, 0, 0);
        this.mesh.scale.set(s, 1, s);
      } else if (s) {
        u.uBand.value = 1;
        const L = s.length || 4, W = s.width || 2;
        u.uAspect.value = L / W;
        this.mesh.rotation.set(0, (s.yaw || 0) + Math.PI, 0);
        this.mesh.scale.set(W / 2, 1, L / 2);
      }
      return this;
    }
    frame(dt) {
      this.age += dt;
      const u = this.mesh.material.uniforms;
      u.uTime.value = _.S.time;
      u.uI.value = Math.min(1, this.age / 0.12) * (0.85 + 0.15 * Math.sin(_.S.time * 6));
    }
    release() {
      if (!this.active) return;
      this.active = false;
      this.mesh.visible = false;
      _.S.live.delete(this);
      _.unpool("tele", this);
    }
  }
  FX.telegraph = function (kind, position, shape) {
    if (!_.S) throw new Error("PTMT.fx.telegraph : appeler d’abord PTMT.fx.init()");
    const t = _.pool("tele", () => new Telegraph());
    t._start(kind, position, shape);
    return t;
  };
})();
