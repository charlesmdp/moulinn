// « Pas touche à mes trésors » — les gemmes et le repaire (petit moulin breton).
//
//   PTMT.models.gem(color)   0 rubis, 1 émeraude, 2 saphir, 3 améthyste, 4 topaze, 5 diamant
//     → { object, color, update(dt, time), setState("lair" | "ground" | "carried" | "returning"), dispose() }
//     Origine de l'objet : lair = point de repos sur le tas (poser l'objet sur un gemSlot) ;
//     ground = sol (la gemme flotte au-dessus, halo et rayon au sol) ; carried = point d'accroche
//     au-dessus de la tête du porteur (la gemme est centrée juste au-dessus) ; returning = centre de
//     la gemme en vol (traînée lumineuse derrière elle, dans le repère du monde).
//
//   PTMT.models.lair(maxGems)  petit moulin : granit, ardoises, roue à aubes, coursier et chute d'eau,
//     porte en bois, lanterne, cloche ; tas de gemmes sur une meule couchée devant la porte.
//     → { object, footprint: [[i, j], ...] (cases occupées en plus de L, repère local : +Z = devant),
//         gemSlots: [Vector3...] (positions locales sur le tas, recalées par setGems), setGems(n),
//         alarm(bool), update(dt, time), dispose() }
//     Origine = centre de la case L (au niveau du chemin), façade tournée vers +Z.
//
// Gemme : taille brillant (table, couronne, rondiste, culasse) à facettes, dessinée par une matière à
// elle (éclat des facettes calculé par reflet, feux du diamant, liseré sombre d'épaisseur constante à
// l'écran, éclats en étoile) : un seul appel de dessin, plus les lueurs quand elle est au sol.
(function () {
  "use strict";
  const PTMT = globalThis.PTMT;
  if (!PTMT || typeof THREE === "undefined" || !PTMT.models || !PTMT.models.props) return;
  const K = PTMT.models.kit;
  const P = PTMT.models.props;
  const { TAU, clamp, lerp, damp, easeOut } = K.math;
  const T = P.T;
  const col = K.col;

  /* ------------------------------------------------------------------ gemmes : couleurs */
  // a : facettes claires, b : profondeur, c : liseré, d : éclat / halo.
  const GEMS = [
    { name: "Rubis", a: "#ff3a64", b: "#8a0024", c: "#2e020c", d: "#ff2a50" },
    { name: "Émeraude", a: "#2ef088", b: "#03662e", c: "#022412", d: "#1aff7a" },
    { name: "Saphir", a: "#4a94ff", b: "#08268c", c: "#030e34", d: "#3a86ff" },
    { name: "Améthyste", a: "#c46cff", b: "#4a0e96", c: "#1c0636", d: "#b45aff" },
    { name: "Topaze", a: "#ffc62a", b: "#a85200", c: "#361c00", d: "#ffae1a" },
    { name: "Diamant", a: "#ffffff", b: "#6fa4d4", c: "#172838", d: "#d0f0ff" },
  ];
  P.GEMS = GEMS;

  /* ------------------------------------------------------------------ gemme : géométrie */
  // Taille brillant à 8 pans : table octogonale, couronne (étoiles + losanges), rondiste à 16 pans,
  // culasse en deux étages jusqu'à la colette. Diamètre 0,6 m, hauteur ≈ 0,45 m (couronne un peu
  // plus haute qu'une vraie taille : l'icône se lit mieux de profil).
  const GR = 0.3;
  let gemGeo = null;
  function gemGeometry() {
    if (gemGeo) return gemGeo;
    const R = GR,
      yT = 0.14,
      rT = 0.56 * R,
      yG = 0,
      yGb = -0.035,
      yM = -0.14,
      rM = 0.5 * R,
      yC = -0.3;
    const ring = (n, r, y, off) => {
      const a = [];
      for (let i = 0; i < n; i++) {
        const t = off + (i / n) * TAU;
        a.push([Math.cos(t) * r, y, Math.sin(t) * r]);
      }
      return a;
    };
    const Tt = ring(8, rT, yT, 0),
      G = ring(16, R, yG, 0),
      Gb = ring(16, R, yGb, 0),
      M = ring(8, rM, yM, TAU / 16);
    const top = [0, yT, 0],
      cul = [0, yC, 0];
    const tris = [];
    for (let i = 0; i < 8; i++) {
      const i1 = (i + 1) % 8;
      tris.push([top, Tt[i], Tt[i1]]);
      tris.push([Tt[i], Tt[i1], G[2 * i + 1]]);
      tris.push([Tt[i], G[2 * i], G[2 * i + 1]]);
      tris.push([Tt[i1], G[2 * i + 1], G[(2 * i + 2) % 16]]);
    }
    for (let j = 0; j < 16; j++) {
      const j1 = (j + 1) % 16;
      tris.push([G[j], G[j1], Gb[j1]]);
      tris.push([G[j], Gb[j1], Gb[j]]);
    }
    for (let i = 0; i < 8; i++) {
      const i1 = (i + 1) % 8;
      tris.push([Gb[2 * i], Gb[2 * i + 1], M[i]]);
      tris.push([Gb[2 * i + 1], Gb[(2 * i + 2) % 16], M[i]]);
      tris.push([M[i], Gb[(2 * i + 2) % 16], M[i1]]);
      tris.push([M[i], M[i1], cul]);
    }
    // Orientation vers l'extérieur (on retourne les triangles mal tournés) et normales par face.
    const pos = [],
      nor = [],
      kind = [],
      glint = [];
    const cy = (yT + yC) / 2;
    const push = (tri, k, flip) => {
      let [a, b, c] = tri;
      const ux = b[0] - a[0],
        uy = b[1] - a[1],
        uz = b[2] - a[2],
        vx = c[0] - a[0],
        vy = c[1] - a[1],
        vz = c[2] - a[2];
      let nx = uy * vz - uz * vy,
        ny = uz * vx - ux * vz,
        nz = ux * vy - uy * vx;
      const mx = (a[0] + b[0] + c[0]) / 3,
        my = (a[1] + b[1] + c[1]) / 3 - cy,
        mz = (a[2] + b[2] + c[2]) / 3;
      if (nx * mx + ny * my + nz * mz < 0) {
        [b, c] = [c, b];
        nx = -nx;
        ny = -ny;
        nz = -nz;
      }
      const l = Math.hypot(nx, ny, nz) || 1;
      const verts = flip ? [a, c, b] : [a, b, c];
      const rnd = Math.abs(Math.sin(mx * 91.7 + my * 47.3 + mz * 13.1) * 43758.5) % 1;
      for (const v of verts) {
        pos.push(v[0], v[1], v[2]);
        nor.push(nx / l, ny / l, nz / l);
        kind.push(k, rnd, 0, 0);
        glint.push(0, 0);
      }
    };
    for (const t of tris) push(t, 0, false);
    // Coque du liseré : mêmes triangles retournés, poussés vers l'extérieur à l'écran par le shader.
    for (const t of tris) push(t, 1, true);
    // Éclats en étoile (quads face caméra) posés sur la couronne.
    const spots = [
      [0, yT + 0.01, 0],
      [Tt[1][0], yT, Tt[1][2]],
      [Tt[5][0], yT, Tt[5][2]],
      [G[12][0], yG + 0.01, G[12][2]],
    ];
    spots.forEach((s, i) => {
      const cs = [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, -1],
        [1, 1],
        [-1, 1],
      ];
      for (const c of cs) {
        pos.push(s[0], s[1], s[2]);
        nor.push(0, 1, 0);
        kind.push(2, 0, c[0], c[1]);
        glint.push(i * 1.618 + 0.3, i === 0 ? 0.3 : 0.2);
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute("aK", new THREE.Float32BufferAttribute(kind, 4));
    g.setAttribute("aG", new THREE.Float32BufferAttribute(glint, 2));
    g.computeBoundingSphere();
    g.boundingSphere.radius += 0.3;
    gemGeo = g;
    return g;
  }

  /* ------------------------------------------------------------------ gemme : matière */
  const GEM_VERT = /* glsl */ `
    attribute vec4 aK;
    attribute vec2 aG;
    uniform float uTime;
    uniform vec3 uView;     // taille du tampon de dessin (px), épaisseur du liseré (px)
    uniform float uGlint;
    uniform float uSeed;
    varying vec3 vN;
    varying vec3 vVP;
    varying vec4 vK;
    varying float vB;
    void main() {
      vK = aK;
      vB = 0.0;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vN = normalize(normalMatrix * normal);
      float sc = length(modelMatrix[0].xyz);
      if (aK.x > 1.5) {
        float ph = aG.x + uSeed;
        float b = pow(max(0.0, sin(uTime * (1.1 + 0.37 * aG.x) + ph * 7.0)), 30.0) * uGlint;
        mv.xy += aK.zw * aG.y * b * sc;
        mv.z += 0.35 * sc;
        vB = b;
      }
      gl_Position = projectionMatrix * mv;
      if (aK.x > 0.5 && aK.x < 1.5) {
        vec2 d = vN.xy;
        float l = length(d);
        d = l > 1e-4 ? d / l : vec2(0.0, 1.0);
        gl_Position.xy += d * uView.z * 2.0 / uView.xy * gl_Position.w;
        gl_Position.z += 0.002 * gl_Position.w;
      }
      vVP = -mv.xyz;
    }
  `;
  const GEM_FRAG = /* glsl */ `
    uniform vec3 uA;
    uniform vec3 uB;
    uniform vec3 uC;
    uniform float uTime;
    uniform float uFire;
    uniform float uBright;
    varying vec3 vN;
    varying vec3 vVP;
    varying vec4 vK;
    varying float vB;
    vec3 hue(float h) { return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }
    void main() {
      vec3 c;
      if (vK.x > 1.5) {
        // Étoile à quatre branches (découpe nette, pas de tri de transparence).
        vec2 p = abs(vK.zw);
        float arm = max((1.0 - p.x) * step(p.y, 0.16 * (1.0 - p.x)), (1.0 - p.y) * step(p.x, 0.16 * (1.0 - p.y)));
        if (arm < 0.05 && length(p) > 0.24) discard;
        if (vB < 0.02) discard;
        c = mix(uA, vec3(1.0), 0.75) * 2.4;
      } else if (vK.x > 0.5) {
        c = uC;
      } else {
        vec3 N = normalize(vN);
        vec3 V = isOrthographic ? vec3(0.0, 0.0, 1.0) : normalize(vVP);
        vec3 L = normalize(vec3(-0.45, 0.8, 0.45));
        float ndl = dot(N, L);
        vec3 R = reflect(-V, N);
        // « Feux » : l'éclat de chaque facette dépend de la direction réfléchie (change quand elle tourne).
        vec2 q = floor((R.xy + 1.0) * 2.7 + vK.y * 3.0);
        float f = fract(sin(dot(q, vec2(12.9898, 78.233))) * 43758.5453);
        float spec = pow(max(dot(R, L), 0.0), 14.0);
        float fres = pow(1.0 - max(dot(N, V), 0.0), 2.0);
        float up = N.y * 0.5 + 0.5;
        float k = clamp(0.1 + 0.9 * pow(f, 1.4) * (0.55 + 0.45 * ndl), 0.0, 1.0);
        vec3 base = mix(uB * 0.6, uA, k);
        float spark = smoothstep(0.88, 0.98, f) * (0.45 + 0.55 * max(ndl, 0.0));
        c = base * (0.8 + 0.3 * up) + vec3(1.0) * (spec * 0.85 + spark * 0.75);
        c += uA * fres * 0.3;
        c += hue(f + vK.y * 0.5) * uFire * (0.2 + 0.55 * smoothstep(0.55, 0.95, f));
        c *= uBright;
      }
      gl_FragColor = vec4(c, 1.0);
      #include <tonemapping_fragment>
      #include <encodings_fragment>
    }
  `;
  const viewU = { value: new THREE.Vector3(1280, 800, 1.6) };
  const _db = new THREE.Vector2();
  function syncView(renderer) {
    renderer.getDrawingBufferSize(_db);
    viewU.value.set(_db.x, _db.y, Math.max(1.3, 1.6 * renderer.getPixelRatio()));
  }
  function gemMaterial(ci, seed) {
    const g = GEMS[ci];
    const m = new THREE.ShaderMaterial({
      uniforms: {
        uTime: P.U.time,
        uView: viewU,
        uGlint: { value: 1 },
        uSeed: { value: seed },
        uA: { value: col(g.a).clone() },
        uB: { value: col(g.b).clone() },
        uC: { value: col(g.c).clone() },
        uFire: { value: ci === 5 ? 1 : 0.12 },
        uBright: { value: 1 },
      },
      vertexShader: GEM_VERT,
      fragmentShader: GEM_FRAG,
    });
    m.name = "ptmt:props:gem";
    return m;
  }

  /* ------------------------------------------------------------------ gemme : traînée */
  const TRAIL_N = 18;
  const TRAIL_VERT = /* glsl */ `
    attribute float aSide;
    attribute float aT;
    attribute vec3 aTan;
    uniform float uW;
    varying float vT;
    varying float vS;
    void main() {
      vT = aT;
      vS = aSide;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vec2 t = (modelViewMatrix * vec4(aTan, 0.0)).xy;
      float l = length(t);
      t = l > 1e-5 ? t / l : vec2(1.0, 0.0);
      float sc = length(modelMatrix[0].xyz);
      mv.xy += vec2(-t.y, t.x) * aSide * uW * (1.0 - aT * 0.85) * sc;
      gl_Position = projectionMatrix * mv;
    }
  `;
  const TRAIL_FRAG = /* glsl */ `
    uniform vec3 uCol;
    uniform float uA;
    varying float vT;
    varying float vS;
    void main() {
      float a = (1.0 - vT) * (1.0 - vT) * uA;
      float core = 1.0 - smoothstep(0.0, 1.0, abs(vS));
      gl_FragColor = vec4(mix(uCol, vec3(1.0), 0.2 * core * (1.0 - vT)), 1.0);
      #include <tonemapping_fragment>
      #include <encodings_fragment>
      gl_FragColor.rgb *= a * (0.35 + 0.65 * core);
      gl_FragColor.a = a * 0.6 * core;
    }
  `;
  function makeTrail(ci) {
    const n = TRAIL_N;
    const pos = new Float32Array(n * 2 * 3),
      side = new Float32Array(n * 2),
      tt = new Float32Array(n * 2),
      tan = new Float32Array(n * 2 * 3);
    const idx = [];
    for (let i = 0; i < n; i++) {
      side[i * 2] = -1;
      side[i * 2 + 1] = 1;
      tt[i * 2] = tt[i * 2 + 1] = i / (n - 1);
      if (i > 0) {
        const b = (i - 1) * 2;
        idx.push(b, b + 1, b + 3, b, b + 3, b + 2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("aSide", new THREE.BufferAttribute(side, 1));
    g.setAttribute("aT", new THREE.BufferAttribute(tt, 1));
    g.setAttribute("aTan", new THREE.BufferAttribute(tan, 3).setUsage(THREE.DynamicDrawUsage));
    g.setIndex(idx);
    const m = new THREE.ShaderMaterial({
      uniforms: { uCol: { value: col(GEMS[ci].d).clone() }, uA: { value: 1 }, uW: { value: 0.17 } },
      vertexShader: TRAIL_VERT,
      fragmentShader: TRAIL_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      side: THREE.DoubleSide,
    });
    m.name = "ptmt:props:trail";
    const mesh = new THREE.Mesh(g, m);
    mesh.frustumCulled = false;
    mesh.renderOrder = 6;
    mesh.name = "traînée";
    mesh.visible = false;
    return mesh;
  }

  /* ------------------------------------------------------------------ gemme */
  let gemSeq = 0;
  const _w = new THREE.Vector3(),
    _l = new THREE.Vector3();
  PTMT.models.gem = function (color) {
    const ci = clamp(color | 0, 0, 5);
    const G = GEMS[ci];
    const seq = gemSeq++;
    const rnd = P.rng(seq * 31 + ci * 7 + 3);
    const root = new THREE.Group();
    root.name = "ptmt-gem-" + G.name;
    // Nœud de hauteur (flottement), nœud de rotation (inclinaison + tour sur elle-même).
    const lift = new THREE.Group();
    const spin = new THREE.Group();
    root.add(lift);
    lift.add(spin);
    const mat = gemMaterial(ci, rnd() * 10);
    const body = new THREE.Mesh(gemGeometry(), mat);
    body.name = "gemme";
    body.onBeforeRender = syncView;
    spin.add(body);
    // Lueurs : groupe 0 = au sol (halo, onde, rayon, ombre), 1 = éclats, 2 = lueur du retour.
    const d = G.d;
    const fx = P.fx(
      [
        { mode: "decal", p: [0, 0.035, 0], size: 0.95, cell: "halo", color: d, a: 0.9, add: 0.45, flick: 1, phase: rnd(), group: 0 },
        { mode: "decal", p: [0, 0.03, 0], size: 0.42, cell: "glow", color: "#000000", a: 0.5, add: 0, group: 0 },
        { mode: "ringFlat", p: [0, 0.045, 0], size: 0.35, end: 1.7, cell: "ring", color: d, a: 1, add: 0.5, speed: 0.7, group: 0 },
        { mode: "ringFlat", p: [0, 0.045, 0], size: 0.35, end: 1.7, cell: "ring", color: d, a: 1, add: 0.5, speed: 0.7, phase: 0.5, group: 0 },
        { mode: "beam", p: [0, 0, 0], size: 0.42, h: 4.2, cell: "beam", color: d, a: 0.7, add: 0.55, group: 0 },
        { mode: "beam", p: [0, 0, 0], size: 0.14, h: 3.2, cell: "beam", color: "#ffffff", a: 0.65, add: 0.85, group: 0 },
        { mode: "glint", p: [0.22, 0.05, 0.1], size: 0.34, cell: "star", color: "#ffffff", a: 1, add: 1, speed: 0.43, phase: rnd(), group: 1 },
        { mode: "glint", p: [-0.2, 0.18, 0.05], size: 0.26, cell: "star", color: G.a, a: 1, add: 1, speed: 0.37, phase: rnd(), group: 1 },
        { mode: "glint", p: [0.02, -0.12, 0.16], size: 0.22, cell: "star", color: "#ffffff", a: 1, add: 1, speed: 0.51, phase: rnd(), group: 1 },
        { mode: "glow", p: [0, 0, 0], size: 0.62, cell: "glow", color: d, a: 0.8, add: 1, flick: 0.25, group: 2 },
        { mode: "glow", p: [0, 0, 0], size: 0.95, cell: "glow", color: d, a: 0.45, add: 1, flick: 0.15, phase: 0.3, group: 1 },
      ],
      { name: "lueurs de gemme", order: 6 },
    );
    fx.material.uniforms.uLift = { value: new THREE.Vector4() };
    root.add(fx.mesh);
    const trail = makeTrail(ci);
    root.add(trail);
    const hist = new Float32Array(TRAIL_N * 3);
    let histN = 0,
      histT = 0;

    // Pose de repos sur le tas : inclinaison propre à chaque gemme.
    const tiltX = (rnd() - 0.5) * 0.9,
      tiltZ = (rnd() - 0.5) * 0.9,
      yaw0 = rnd() * TAU;
    // k : poids de chaque état (fondus enchaînés), pop : petit bond quand elle tombe au sol.
    const st = { state: "lair", t: rnd() * 10, k: { ground: 0, carried: 0, returning: 0, lair: 1 }, yaw: yaw0, pop: 0 };
    const api = {
      object: root,
      color: ci,
      name: G.name,
      setState(s) {
        if (s === st.state) return;
        if (!(s in st.k)) return;
        if (s === "ground") st.pop = 1;
        if (s === "returning") {
          histN = 0;
          histT = 0;
        }
        st.state = s;
      },
      get state() {
        return st.state;
      },
      update(dt, time) {
        if (dt > 0.1) dt = 0.1;
        if (dt < 0) dt = 0;
        P.tick(time);
        st.t += dt;
        for (const key in st.k) st.k[key] = damp(st.k[key], key === st.state ? 1 : 0, 9, dt);
        const kg = st.k.ground,
          kc = st.k.carried,
          kr = st.k.returning,
          kl = st.k.lair;
        st.pop = Math.max(0, st.pop - dt * 1.6);
        // Hauteur et taille selon l'état (mélange doux entre états).
        const bob = Math.sin(st.t * 2.4) * 0.09;
        const hop = Math.sin(easeOut(1 - st.pop) * Math.PI) * 0.7 * (st.pop > 0 ? 1 : 0);
        const y = kl * 0.19 + kg * (0.62 + bob + hop) + kc * 0.22 + kr * 0;
        const s = kl * 1 + kg * 1.65 + kc * 0.75 + kr * 1.1;
        lift.position.y = y;
        lift.scale.setScalar(s);
        // Rotation : immobile sur le tas, tourne au sol et en vol.
        const sv = kl * 0 + kg * 1.5 + kc * 0.9 + kr * 7;
        st.yaw += sv * dt;
        // Au sol et portée : vue de profil (couronne sur culasse), l'icône classique de la gemme.
        spin.rotation.set(tiltX * kl - 1.0 * (kg + kc) - 0.6 * kr + 0.12 * kg * Math.sin(st.t * 1.1), st.yaw, tiltZ * kl);
        // Lueurs.
        fx.gain.set(kg, Math.max(kg, kc * 0.9, kr), kr, 0);
        fx.material.uniforms.uLift.value.set(0, y, y, 0);
        fx.mesh.visible = kg + kc + kr > 0.02;
        mat.uniforms.uGlint.value = 0.65 + 0.35 * (1 - kl) + kr;
        mat.uniforms.uBright.value = 1 + kg * 0.18 + kr * 0.4 + Math.sin(st.t * 5) * 0.04 * kg;
        // Traînée (points passés, dans le repère du monde, ramenés dans celui de l'objet).
        trail.visible = kr > 0.05;
        if (trail.visible) {
          root.updateWorldMatrix(true, false);
          _w.set(0, y, 0).applyMatrix4(root.matrixWorld);
          // Saut brusque (téléportation, nouvelle course) : la traînée repart de zéro.
          if (histN > 0 && Math.hypot(_w.x - hist[0], _w.y - hist[1], _w.z - hist[2]) > 3) histN = 0;
          histT += dt;
          if (histN === 0 || histT > 0.025) {
            histT = 0;
            hist.copyWithin(3, 0, (TRAIL_N - 1) * 3);
            hist[0] = _w.x;
            hist[1] = _w.y;
            hist[2] = _w.z;
            histN = Math.min(TRAIL_N, histN + 1);
          } else {
            hist[0] = _w.x;
            hist[1] = _w.y;
            hist[2] = _w.z;
          }
          const pa = trail.geometry.attributes.position,
            ta = trail.geometry.attributes.aTan;
          for (let i = 0; i < TRAIL_N; i++) {
            const k = Math.min(i, histN - 1);
            _l.set(hist[k * 3], hist[k * 3 + 1], hist[k * 3 + 2]);
            root.worldToLocal(_l);
            pa.setXYZ(i * 2, _l.x, _l.y, _l.z);
            pa.setXYZ(i * 2 + 1, _l.x, _l.y, _l.z);
            const k2 = Math.min(k + 1, histN - 1);
            const tx = hist[k * 3] - hist[k2 * 3],
              ty = hist[k * 3 + 1] - hist[k2 * 3 + 1],
              tz = hist[k * 3 + 2] - hist[k2 * 3 + 2];
            ta.setXYZ(i * 2, tx, ty, tz);
            ta.setXYZ(i * 2 + 1, tx, ty, tz);
          }
          pa.needsUpdate = true;
          ta.needsUpdate = true;
          trail.material.uniforms.uA.value = kr;
        }
      },
      dispose() {
        if (root.parent) root.parent.remove(root);
        mat.dispose();
        fx.material.dispose();
        fx.mesh.geometry.dispose();
        trail.material.dispose();
        trail.geometry.dispose();
      },
    };
    // Groupes relevés à la hauteur de la gemme (éclats, lueur du retour).
    const vs = fx.material.vertexShader;
    fx.material.vertexShader = vs
      .replace("uniform vec4 uGain2;", "uniform vec4 uGain2;\nuniform vec4 uLift;")
      .replace("vec3 c = position;", "vec3 c = position;\nc.y += aD.y < 0.5 ? uLift.x : (aD.y < 1.5 ? uLift.y : (aD.y < 2.5 ? uLift.z : uLift.w));");
    api.update(0, 0);
    return api;
  };

  /* ================================================================== le repaire : petit moulin */
  const C = {
    granite: "#b3aa97",
    graniteW: "#c9c0ad",
    graniteD: "#8e8574",
    dressed: "#d2c8b2",
    slate: "#7486a0",
    slateD: "#4d586c",
    wood: "#9a7652",
    woodD: "#5e4430",
    woodW: "#a88d6c",
    wet: "#4f3a28",
    door: "#2f6e8e",
    doorD: "#1f4f68",
    shutter: "#3f86a8",
    iron: "#34302e",
    bronze: "#c08a3a",
    grass: "#6fae3e",
    grassD: "#4a8a2e",
    earth: "#8a6a48",
    hay: "#e8c25a",
    burlap: "#d9c49a",
    flowerB: "#4a6cff",
    flowerP: "#ff5aa8",
    lantern: "#ffcf6a",
    window: "#2a3346",
    windowLit: "#ffd07a",
    gold: "#ffcc3a",
  };
  P.MILL_COLORS = C;

  function stoneMat() {
    return P.shared("stone", () => P.paint({ map: K.tex.rubble(), rim: [0.05, 0.4, 0.5], lift: 0.12, name: "granit" }));
  }
  function slateMat() {
    return P.shared("slate", () => P.paint({ map: K.tex.slate(), rough: 0.62, rim: [0.05, 0.4, 0.4], lift: 0.1, name: "ardoise" }));
  }
  P.stoneMat = stoneMat;
  P.slateMat = slateMat;

  /** Toit à deux pans (faîtage selon X local) : renvoie les pièces à ajouter à l'accumulateur d'ardoise. */
  function gableRoof(A, M, L, W, rise, over, y0, cz) {
    const slope = Math.atan2(rise, W / 2);
    const run = W / 2 + over;
    const drop = over * Math.tan(slope);
    const len = Math.hypot(run, rise + drop);
    for (const s of [-1, 1]) {
      A.slate.put(T.boxSeg(L + over * 2, 0.14, len, 10, 1, 5), [0, y0 + (rise - drop) / 2 + 0.07, cz + (s * run) / 2], [s * slope, 0, 0], 1, { c: C.slate, box: 1.1, vj: 0.2, vs: 0.55 }, M);
    }
    A.slate.put(T.box(L + over * 2 + 0.06, 0.22, 0.22), [0, y0 + rise + 0.11, cz], [Math.PI / 4, 0, 0], 1, { c: C.slateD, box: 1.1 }, M);
  }
  /** Pignon triangulaire de granit (plan YZ local, épaisseur selon X). */
  function gable(A, M, x, W, rise, y0, cz, th) {
    A.stone.put(
      T.extrude("gable" + W + "," + rise + "," + th, [
        [-W / 2, 0],
        [W / 2, 0],
        [0, rise],
      ], th),
      [x, y0, cz],
      [0, Math.PI / 2, 0],
      1,
      { c: C.granite, box: 1.6, ao: [0.8, y0, y0 + rise] },
      M,
    );
  }

  const LAIR_FOOT = [
    [-1, -1],
    [0, -1],
    [1, -1],
    [-1, -2],
    [0, -2],
    [1, -2],
  ];

  PTMT.models.lair = function (maxGems) {
    const max = clamp(maxGems | 0 || 5, 1, 9);
    const root = new THREE.Group();
    root.name = "ptmt-lair";
    const rnd = P.rng(4242);
    const M = new THREE.Matrix4();
    const A = { stone: new P.Acc({ uv: true, seed: 11 }), slate: new P.Acc({ uv: true, seed: 12 }), main: new P.Acc({ seed: 13 }) };
    const S = A.stone,
      W = A.main;

    // Repères du plan (voir l'en-tête) : bâtiment, fosse de la roue, coursier, levée du bief.
    const FL = 0.45; // niveau du sol des cases du moulin (herbe)
    const bx0 = -4.6,
      bx1 = 2.4,
      bz0 = -7.0,
      bz1 = -2.4;
    const BL = bx1 - bx0,
      BW = bz1 - bz0,
      bcx = (bx0 + bx1) / 2,
      bcz = (bz0 + bz1) / 2;
    // Moulin assez bas pour ne jamais cacher le tas de gemmes, quelle que soit son orientation
    // (vue du dessus inclinée à 60° : le toit masque le sol sur environ 0,58 fois sa hauteur).
    const EAVE = FL + 2.9,
      RISE = 2.0;
    const WH = { x: 3.9, y: FL + 0.5, z: -2.95, r: 1.38, w: 0.6 }; // roue

    /* --- socle : levée de terre herbue bordée de granit, marches vers le chemin (évidée pour la fosse) */
    const grassO = { c: C.grassD, g: [C.earth, C.grass, -0.2, FL], vj: 0.1 };
    // Sommet de la levée à peine sous le sol peint de la carte : c'est lui qu'on voit (pas d'aplat vert).
    W.put(T.boxB(7.85, FL + 0.31, 6.85), [-1.425, -0.35, -5.52], 0, 1, grassO);
    W.put(T.boxB(2.85, FL + 0.31, 5.3), [3.925, -0.35, -6.3], 0, 1, grassO);
    S.put(T.boxB(10.8, FL + 0.37, 0.36), [0, -0.35, -1.98], 0, 1, { c: C.graniteD, box: 1.4, vj: 0.08 });
    for (let i = 0; i < 2; i++) S.put(T.boxB(1.9 - i * 0.25, 0.15 * (i + 1), 0.34), [-0.3, 0, -1.47 - i * 0.26], 0, 1, { c: C.dressed, box: 1.2 });
    // Pavés devant la porte.
    for (let i = 0; i < 7; i++) S.put(T.boxB(0.5, 0.06, 0.4), [-1.1 + (i % 4) * 0.52 + (i > 3 ? 0.26 : 0), FL, -2.25 + (i > 3 ? 0.0 : 0.05)], [0, (rnd() - 0.5) * 0.2, 0], 1, { c: C.graniteW, box: 0.8, j: 0.08 });

    /* --- bâtiment : murs de moellons, chaînages clairs, pignons, toit d'ardoise */
    const wall = (x, z, w, h, d, tint) => S.put(T.boxB(w, h, d), [x, FL, z], 0, 1, { c: tint || C.granite, box: 1.6, ao: [0.7, FL, FL + 1.4], vj: 0.05 });
    wall(bcx, bz0 + 0.25, BL, EAVE - FL, 0.5);
    wall(bcx, bz1 - 0.25, BL, EAVE - FL, 0.5);
    wall(bx0 + 0.25, bcz, 0.5, EAVE - FL, BW - 1);
    wall(bx1 - 0.25, bcz, 0.5, EAVE - FL, BW - 1);
    for (const sx of [bx0, bx1])
      for (const sz of [bz0, bz1]) {
        const dx = sx === bx0 ? 1 : -1,
          dz = sz === bz0 ? 1 : -1;
        for (let i = 0; i < 9; i++) {
          const long = i % 2 === 0;
          S.put(T.box(long ? 0.66 : 0.4, 0.34, long ? 0.4 : 0.66), [sx + dx * (long ? 0.31 : 0.18), FL + 0.19 + i * 0.37, sz + dz * (long ? 0.18 : 0.31)], 0, 1.02, { c: C.dressed, box: 1.2, j: 0.05 });
        }
      }
    gable(A, M, bx0 + 0.25, BW, RISE, EAVE, bcz, 0.5);
    gable(A, M, bx1 - 0.25, BW, RISE, EAVE, bcz, 0.5);
    gableRoof(A, M, BL, BW, RISE, 0.38, EAVE, bcz);
    // Cheminée sur le pignon gauche.
    S.put(T.boxB(0.75, 1.9, 0.9), [bx0 + 0.45, EAVE + RISE - 0.9, bcz - 0.1], 0, 1, { c: C.granite, box: 1.2 });
    S.put(T.boxB(0.9, 0.14, 1.05), [bx0 + 0.45, EAVE + RISE + 1.0, bcz - 0.1], 0, 1, { c: C.dressed, box: 1.2 });
    // Lucarne (porte du grenier) au-dessus de la porte, avec sa poutre de levage.
    const lx = -1.25,
      lz = bz1 - 0.05;
    S.put(T.boxB(1.5, 1.35, 1.1), [lx, EAVE - 0.35, lz - 0.45], 0, 1, { c: C.granite, box: 1.4 });
    S.put(
      T.extrude("dormerGable", [
        [-0.75, 0],
        [0.75, 0],
        [0, 0.72],
      ], 1.1),
      [lx, EAVE + 1.0, lz - 0.45],
      0,
      1,
      { c: C.granite, box: 1.4 },
      M,
    );
    for (const s of [-1, 1]) A.slate.put(T.box(1.18, 0.1, 1.42), [lx + s * 0.4, EAVE + 1.41, lz - 0.52], [0, 0, -s * 0.765], 1, { c: C.slate, box: 1 }, M);
    W.put(T.boxB(0.95, 0.95, 0.08), [lx, EAVE - 0.2, lz + 0.12], 0, 1, { c: C.woodD });
    for (let i = 0; i < 4; i++) W.put(T.boxB(0.2, 0.9, 0.04), [lx - 0.33 + i * 0.22, EAVE - 0.18, lz + 0.17], 0, 1, { c: C.wood, j: 0.1 });
    W.put(T.box(0.16, 0.16, 1.2), [lx, EAVE + 0.95, lz + 0.35], 0, 1, { c: C.woodD });
    W.put(T.cylB(0.012, 0.012, 1.1, 4), [lx, EAVE - 0.15, lz + 0.9], 0, 1, { c: "#e0cfa0" });
    // Porte d'entrée : encadrement de granit, vantail bleu breton en planches, ferrures.
    const dx = -0.3,
      dw = 1.25,
      dh = 2.15,
      dz = bz1;
    W.put(T.boxB(dw + 0.08, dh, 0.1), [dx, FL, dz + 0.0], 0, 1, { c: "#16110d" });
    for (const s of [-1, 1]) S.put(T.boxB(0.34, dh + 0.05, 0.3), [dx + s * (dw / 2 + 0.17), FL, dz + 0.05], 0, 1, { c: C.dressed, box: 1.1 });
    S.put(T.boxB(dw + 1.0, 0.42, 0.34), [dx, FL + dh, dz + 0.06], 0, 1, { c: C.dressed, box: 1.1 });
    for (let i = 0; i < 5; i++) W.put(T.boxB(dw / 5 - 0.02, dh - 0.06, 0.07), [dx - dw / 2 + dw / 10 + (i * dw) / 5, FL, dz + 0.1], 0, 1, { c: i % 2 ? C.door : C.doorD, j: 0.05 });
    for (const y of [0.35, dh - 0.45]) W.put(T.box(dw * 0.85, 0.08, 0.04), [dx - 0.05, FL + y, dz + 0.16], 0, 1, { c: C.iron });
    W.put(T.torus(0.07, 0.018, 4, 10), [dx + dw * 0.3, FL + 1.05, dz + 0.18], 0, 1, { c: C.iron });
    // Fenêtres à volets bleus (gauche) et petite fenêtre (droite).
    const windowAt = (x, y, w, h, shutters) => {
      S.put(T.box(w + 0.28, h + 0.28, 0.2), [x, y, dz + 0.02], 0, 1, { c: C.dressed, box: 1.1 });
      W.put(T.box(w, h, 0.06), [x, y, dz + 0.1], 0, 1, { c: C.window, emit: 0.05 });
      W.put(T.box(0.05, h, 0.05), [x, y, dz + 0.14], 0, 1, { c: "#f2efe6" });
      W.put(T.box(w, 0.05, 0.05), [x, y, dz + 0.14], 0, 1, { c: "#f2efe6" });
      if (shutters)
        for (const s of [-1, 1]) {
          W.put(T.box(w * 0.55, h + 0.06, 0.06), [x + s * (w * 0.5 + 0.2 + w * 0.27), y, dz + 0.12], 0, 1, { c: C.shutter });
          for (const yy of [-0.25, 0.25]) W.put(T.box(w * 0.5, 0.05, 0.03), [x + s * (w * 0.5 + 0.2 + w * 0.27), y + yy * h, dz + 0.16], 0, 1, { c: C.doorD });
        }
      // Jardinière fleurie.
      W.put(T.boxB(w + 0.2, 0.18, 0.22), [x, y - h / 2 - 0.2, dz + 0.2], 0, 1, { c: C.woodD });
      for (let i = 0; i < 5; i++) W.put(T.blob(40 + i, 0, 0.3), [x - w / 2 + (i + 0.5) * (w / 5), y - h / 2 - 0.02, dz + 0.24], 0, [0.13, 0.11, 0.1], { c: i % 2 ? "#ff5a6a" : "#ffffff", rim: 0.5 });
    };
    windowAt(-2.6, FL + 1.55, 0.8, 0.95, true);
    windowAt(1.45, FL + 1.75, 0.55, 0.65, false);
    // Hortensias bleus et roses au pied de la façade (très bretons).
    const hydrangea = (x, z, s, c) => {
      W.put(T.blob(70 + Math.round(x * 10), 1, 0.14, 1.7, -0.3), [x, FL + 0.3 * s, z], 0, [0.6 * s, 0.42 * s, 0.48 * s], { c: "#2f6a28", rim: 0.8, vj: 0.1, dark: 0.3 });
      const heads = [[0, 0.62, 0.05, 0.27]];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + x;
        heads.push([Math.cos(a) * 0.36, 0.44 + (i % 2) * 0.1, Math.sin(a) * 0.27, 0.23]);
      }
      for (const [hx, hy, hz, r] of heads) W.put(T.blob(80 + Math.floor(rnd() * 5), 1, 0.2, 3), [x + hx * s, FL + hy * s, z + hz * s], 0, r * s, { c: P.vary(c, rnd, 0.25), rim: 0.8, vj: 0.18, vs: 6, emit: 0.1 });
    };
    hydrangea(-3.7, -2.05, 1, C.flowerB);
    hydrangea(-1.65, -2.1, 0.8, C.flowerP);
    hydrangea(2.25, -2.1, 0.75, C.flowerB);
    // Sacs de farine et banc contre le mur.
    for (const [x, z, r] of [
      [-4.05, -1.35, 0.3],
      [-3.55, -1.25, -0.2],
    ]) {
      W.put(T.blob(90 + x, 1, 0.08), [x, 0.33, z], [0, r, 0], [0.3, 0.36, 0.26], { c: C.burlap, rim: 0.5, vj: 0.05 });
      W.put(T.cylB(0.06, 0.1, 0.12, 6), [x, 0.64, z], 0, 1, { c: "#b09a70" });
    }

    /* --- fosse de la roue (murs de granit), roue à aubes (rôle 3 : tourne dans le shader) */
    const pz0 = -3.62,
      pz1 = -2.16;
    S.put(T.boxB(2.85, 2.65, 0.3), [3.925, -0.45, pz0 + 0.15], 0, 1, { c: C.granite, box: 1.5, ao: [0.55, -0.45, 1.4] });
    S.put(T.boxB(0.3, FL + 0.5, pz1 - pz0), [bx1 - 0.05, -0.45, (pz0 + pz1) / 2], 0, 1, { c: C.graniteD, box: 1.4 });
    S.put(T.boxB(0.3, FL + 0.5, pz1 - pz0), [5.25, -0.45, (pz0 + pz1) / 2], 0, 1, { c: C.graniteD, box: 1.4 });
    W.put(T.boxB(0.12, 0.55, 0.8), [5.12, -0.4, WH.z + 0.25], 0, 1, { c: "#0f1418" });
    W.put(T.boxB(2.6, 0.1, pz1 - pz0), [3.925, -0.55, (pz0 + pz1) / 2], 0, 1, { c: "#20303a" });
    const wheelO = { c: C.wet, role: 3, j: 0.06 };
    for (const s of [-1, 1]) W.put(T.torus(WH.r, 0.075, 5, 28), [WH.x, WH.y, WH.z + s * (WH.w / 2)], 0, 1, Object.assign({}, wheelO, { c: C.woodD }));
    for (const s of [-1, 1]) W.put(T.torus(WH.r * 0.62, 0.05, 4, 20), [WH.x, WH.y, WH.z + s * (WH.w / 2)], 0, 1, Object.assign({}, wheelO, { c: C.woodD }));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      for (const s of [-1, 1]) W.put(T.box(0.11, WH.r * 2 - 0.1, 0.09), [WH.x, WH.y, WH.z + s * (WH.w / 2)], [0, 0, a], 1, Object.assign({}, wheelO, { c: C.wood }));
    }
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU;
      W.put(T.box(0.34, 0.07, WH.w + 0.1), [WH.x + Math.cos(a) * (WH.r - 0.12), WH.y + Math.sin(a) * (WH.r - 0.12), WH.z], [0, 0, a + 0.35], 1, Object.assign({}, wheelO, { c: i % 2 ? C.woodW : C.wood }));
    }
    W.put(T.cyl(0.2, 0.2, WH.w + 0.3, 10), [WH.x, WH.y, WH.z], [Math.PI / 2, 0, 0], 1, Object.assign({}, wheelO, { c: C.iron }));
    W.put(T.cyl(0.08, 0.08, 1.1, 6), [WH.x, WH.y, WH.z - 0.5], [Math.PI / 2, 0, 0], 1, { c: C.iron });

    /* --- coursier (auge en bois sur tréteaux) depuis la levée du bief, à l'arrière */
    const fx0 = WH.x + 0.82,
      fyE = WH.y + WH.r + 0.4,
      fzE = WH.z - 0.15,
      fz0 = -8.55,
      fy0 = fyE + 0.18;
    const fl = Math.abs(fz0 - fzE),
      fs = Math.atan2(fy0 - fyE, fl);
    const fcz = (fz0 + fzE) / 2,
      fcy = (fy0 + fyE) / 2;
    W.put(T.box(0.7, 0.08, fl), [fx0, fcy - 0.2, fcz], [fs, 0, 0], 1, { c: C.woodD });
    for (const s of [-1, 1]) W.put(T.box(0.07, 0.38, fl), [fx0 + s * 0.33, fcy, fcz], [fs, 0, 0], 1, { c: C.wood, j: 0.05 });
    for (let i = 0; i < 4; i++) {
      const z = fzE - 0.8 - i * 1.35;
      const yTop = lerp(fyE, fy0, (fzE - z) / fl) - 0.25;
      for (const s of [-1, 1]) W.put(T.boxB(0.12, yTop - FL, 0.12), [fx0 + s * 0.32, FL, z], [0, 0, s * 0.06], 1, { c: C.woodD });
      W.put(T.box(0.8, 0.1, 0.12), [fx0, yTop - 0.05, z], 0, 1, { c: C.woodD });
    }
    // Levée du bief : talus d'herbe, mur de soutènement, vanne.
    W.put(T.blob(301, 1, 0.1), [4.3, fy0 - 1.25, -8.3], 0, [1.6, 1.4, 1.15], { c: C.grass, g: [C.earth, C.grass, FL, fy0], rim: 0.35, vj: 0.12 });
    S.put(T.boxB(2.3, fy0 - FL - 0.1, 0.5), [4.35, FL, -7.4], 0, 1, { c: C.granite, box: 1.4, ao: [0.65, FL, fy0] });
    W.put(T.boxB(0.78, 0.9, 0.1), [fx0, fy0 - 0.45, -7.12], 0, 1, { c: C.woodD });
    W.put(T.box(0.08, 1.3, 0.08), [fx0 - 0.36, fy0 + 0.2, -7.08], 0, 1, { c: C.wood });
    W.put(T.box(0.08, 1.3, 0.08), [fx0 + 0.36, fy0 + 0.2, -7.08], 0, 1, { c: C.wood });
    W.put(T.box(0.9, 0.1, 0.1), [fx0, fy0 + 0.8, -7.08], 0, 1, { c: C.woodD });
    W.put(T.cyl(0.04, 0.04, 0.9, 5), [fx0, fy0 + 0.45, -7.02], 0, 1, { c: C.iron });
    // Touffes et roseaux sur la levée.
    for (let i = 0; i < 7; i++) {
      const a = i * 1.9,
        r = 0.6 + (i % 3) * 0.3;
      for (let k = 0; k < 5; k++)
        W.put(T.blade(0.12 * (k % 2 ? 1 : -1), 0.05), [4.3 + Math.cos(a) * r, fy0 - 0.05, -8.4 + Math.sin(a) * r * 0.6], [0, k * 1.3 + i, (k - 2) * 0.12], [1, 0.55 + (k % 3) * 0.15, 1], {
          c: k % 2 ? "#7fb850" : "#5f9a3a",
        });
    }

    /* --- le tas de gemmes : meule couchée, trésor scintillant (rôle 5 : s'aplatit avec setGems) */
    const mz = 0.55; // tas avancé sur la case L, bien dégagé de l'avant-toit
    W.put(T.cylB(1.08, 1.14, 0.28, 24), [0, 0, mz], 0, 1, { c: "#cbc2b0", vj: 0.1, vs: 4, ao: [0.7, 0, 0.28], rim: 0.2 });
    W.put(T.cylB(1.1, 1.1, 0.05, 24, true), [0, 0.2, mz], 0, 1, { c: "#9c9384" });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      W.put(T.box(0.05, 0.03, 0.62), [Math.cos(a) * 0.72, 0.285, mz + Math.sin(a) * 0.72], [0, -a + Math.PI / 2 + 0.3, 0], 1, { c: "#8a8274" });
    }
    // Monticule de petites gemmes et de pièces d'or (brillances scintillantes).
    const heapTop = 0.28;
    const heapCols = ["#ff4a6a", "#3dff8a", "#4a90ff", "#c77dff", "#ffc93a", "#e8f8ff"];
    W.put(T.blob(501, 1, 0.12), [0, heapTop, mz], 0, [0.82, 0.3, 0.82], { c: "#d9a32a", g: ["#9a6a12", C.gold, heapTop - 0.1, heapTop + 0.3], role: 5, emit: 1.2, rim: 0.3 });
    for (let i = 0; i < 46; i++) {
      const a = rnd() * TAU,
        r = Math.sqrt(rnd()) * 0.8;
      const h = Math.sqrt(Math.max(0, 1 - (r * r) / 0.64)) * 0.28;
      const isCoin = i % 3 === 0;
      if (isCoin) W.put(T.cyl(0.08, 0.08, 0.025, 8), [Math.cos(a) * r, heapTop + h, mz + Math.sin(a) * r], [rnd() * 0.8, rnd() * TAU, rnd() * 0.8], 1, { c: C.gold, role: 5, emit: 1.5 });
      else W.put(T.ico(0.06 + rnd() * 0.04, 0), [Math.cos(a) * r, heapTop + h, mz + Math.sin(a) * r], [rnd() * 3, rnd() * 3, 0], 1, { c: heapCols[i % 6], role: 5, emit: 1.6 });
    }

    /* --- lanterne (support de fer) et cloche d'alarme (rôle 4 : se balance) */
    const lan = { x: 0.75, y: FL + 1.95, z: bz1 + 0.42 };
    W.put(T.box(0.05, 0.05, 0.5), [lan.x, lan.y + 0.62, bz1 + 0.2], 0, 1, { c: C.iron });
    W.put(T.box(0.05, 0.4, 0.05), [lan.x, lan.y + 0.42, bz1 + 0.02], [0.6, 0, 0], 1, { c: C.iron });
    W.put(T.boxB(0.3, 0.04, 0.3), [lan.x, lan.y - 0.02, lan.z], 0, 1, { c: C.iron });
    W.put(T.cone(0.24, 0.2, 4), [lan.x, lan.y + 0.4, lan.z], [0, Math.PI / 4, 0], 1, { c: C.iron });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) W.put(T.boxB(0.03, 0.4, 0.03), [lan.x + sx * 0.12, lan.y, lan.z + sz * 0.12], 0, 1, { c: C.iron });
    W.put(T.boxB(0.2, 0.34, 0.2), [lan.x, lan.y + 0.02, lan.z], 0, 1, { c: C.lantern, emit: 1.1 });
    const bell = { x: -1.5, y: FL + 2.35, z: bz1 + 0.62 };
    // Potence de chêne, petit auvent de planches, et la cloche de bronze.
    W.put(T.box(0.13, 0.13, 0.85), [bell.x, bell.y + 0.2, bz1 + 0.38], 0, 1, { c: C.woodD });
    W.put(T.box(0.1, 0.62, 0.1), [bell.x, bell.y - 0.1, bz1 + 0.12], [-0.75, 0, 0], 1, { c: C.woodD });
    for (const s of [-1, 1]) W.put(T.box(0.5, 0.05, 0.62), [bell.x + s * 0.2, bell.y + 0.44, bell.z - 0.12], [0, 0, -s * 0.55], 1, { c: C.wood, j: 0.08 });
    W.put(
      T.lathe("bell", [
        [0.001, 0.02],
        [0.1, 0.0],
        [0.14, -0.12],
        [0.17, -0.3],
        [0.24, -0.4],
        [0.25, -0.44],
        [0.001, -0.42],
      ], 12),
      [bell.x, bell.y + 0.06, bell.z],
      0,
      1.35,
      { c: C.bronze, role: 4, emit: 0.15, rim: 0.4 },
    );
    W.put(T.sphere(0.08, 6, 4), [bell.x, bell.y - 0.52, bell.z], 0, 1, { c: C.iron, role: 4 });
    W.put(T.cylB(0.014, 0.014, 1.5, 4), [bell.x + 0.06, bell.y - 1.95, bell.z + 0.06], 0, 1, { c: "#d8c79a", role: 4 });

    /* --- maillages */
    const wheelU = new THREE.Vector4(WH.x, WH.y, WH.z, 0);
    const bellU = new THREE.Vector4(bell.x, bell.y + 0.06, bell.z, 0);
    const heapU = new THREE.Vector4(0, heapTop, mz, 1);
    const mainMat = P.paint({ rig: { wheel: wheelU, bell: bellU, heap: heapU }, lift: 0.14, rim: [0.05, 0.42, 0.55], name: "moulin" });
    root.add(P.mesh(S, stoneMat(), { cast: true, name: "granit" }));
    root.add(P.mesh(A.slate, slateMat(), { cast: true, name: "ardoises" }));
    root.add(P.mesh(W, mainMat, { cast: true, name: "moulin" }));

    /* --- eau : bief, coursier, chute sur la roue, fosse et canal de fuite */
    const water = P.waterMesh([
      P.waterStrip(
        [
          [fx0, fy0 - 0.02, fz0 + 0.2],
          [fx0, fyE + 0.12, fzE + 0.05],
        ],
        0.56,
        [1, 0, 0],
        "#3f9fc0",
        0.9,
        1.4,
      ),
      P.waterStrip(
        [
          [fx0, fyE + 0.12, fzE + 0.05],
          [fx0 - 0.02, fyE - 0.05, fzE + 0.28],
          [fx0 - 0.08, WH.y + 1.05, WH.z + 0.1],
          [fx0 - 0.02, WH.y + 0.1, WH.z + 0.12],
          [fx0 + 0.05, -0.2, WH.z + 0.1],
        ],
        0.5,
        [1, 0, 0],
        "#8fd8f0",
        (t) => 0.85 - t * 0.2,
        2.4,
      ),
      P.waterStrip(
        [
          [2.55, -0.28, (pz0 + pz1) / 2 + 0.1],
          [5.12, -0.28, (pz0 + pz1) / 2 + 0.1],
        ],
        1.25,
        [0, 0, 1],
        "#2f86a8",
        0.92,
        0.7,
      ),
      P.waterStrip(
        [
          [3.4, fy0 - 0.05, -8.8],
          [5.3, fy0 - 0.05, -8.8],
        ],
        1.2,
        [0, 0, 1],
        "#3f9fc0",
        0.85,
        0.25,
      ),
    ]);
    root.add(water);

    /* --- lueurs et particules (un seul lot) */
    const specs = [];
    // Groupe 0 : lanterne (chaude) ; 1 : lanterne rouge + ondes de la cloche (alarme) ; 2 : fumée ; 3 : éclaboussures.
    specs.push({ mode: "glow", p: [lan.x, lan.y + 0.2, lan.z + 0.05], size: 0.75, cell: "glow", color: "#ffb84a", a: 0.9, add: 1, flick: 0.18, group: 0 });
    specs.push({ mode: "glow", p: [lan.x, lan.y + 0.2, lan.z + 0.05], size: 1.35, cell: "glow", color: "#ff8a2a", a: 0.35, add: 1, flick: 0.1, group: 0 });
    specs.push({ mode: "glow", p: [lan.x, lan.y + 0.2, lan.z + 0.05], size: 1.3, cell: "glow", color: "#ff2a1a", a: 1, add: 1, flick: 0.5, group: 1 });
    specs.push({ mode: "glow", p: [lan.x, lan.y + 0.2, lan.z + 0.05], size: 2.6, cell: "glow", color: "#ff3a10", a: 0.5, add: 0.8, flick: 0.3, group: 1 });
    specs.push({ mode: "decal", p: [0, 0.05, -0.6], size: 3.0, cell: "glow", color: "#ff2a10", a: 0.6, add: 0.6, flick: 0.4, group: 1 });
    for (let i = 0; i < 3; i++) specs.push({ mode: "ring", p: [bell.x, bell.y - 0.25, bell.z + 0.15], size: 0.35, end: 1.6, cell: "ding", color: "#fff4b0", a: 1, add: 0.55, speed: 1.6, phase: i / 3, group: 1 });
    for (let i = 0; i < 6; i++)
      specs.push({ mode: "smoke", p: [bx0 + 0.45, EAVE + RISE + 1.15, bcz - 0.1], size: 0.35, end: 1.15, rise: 2.8, drift: [0.8, -0.3], cell: "puff", color: "#f2f0ec", a: 0.8, add: 0, speed: 0.16, phase: i / 6, group: 2 });
    for (let i = 0; i < 10; i++) {
      const a = rnd() * TAU;
      specs.push({ mode: "drop", p: [fx0 - 0.05, WH.y + 0.9, WH.z + 0.15], size: 0.07, cell: "drop", color: "#e8fbff", a: 0.95, add: 0.4, speed: 1.4 + rnd(), phase: rnd(), vel: [Math.cos(a) * 0.9 + 0.3, 1.2 + rnd() * 0.8, Math.sin(a) * 0.5], grav: 7, group: 3 });
    }
    for (let i = 0; i < 5; i++)
      specs.push({ mode: "smoke", p: [fx0 - 0.1 + (rnd() - 0.5) * 0.5, -0.25, WH.z + 0.2 + (rnd() - 0.5) * 0.4], size: 0.18, end: 0.5, rise: 0.25, drift: [0.4, 0], cell: "puff", color: "#ffffff", a: 0.8, add: 0.2, speed: 0.9, phase: i / 5, group: 3 });
    for (let i = 0; i < 6; i++)
      specs.push({ mode: "slide", p: [4.0 + (rnd() - 0.5) * 0.6, -0.22, WH.z + 0.15 + (rnd() - 0.5) * 0.6], size: 0.16, len: 1.8, dir: [1, 0], rot: -Math.PI / 2, cell: "leaf", color: "#ffffff", a: 0.55, add: 0.3, speed: 0.6, phase: i / 6, group: 3 });
    // Scintillements sur le tas de gemmes.
    for (let i = 0; i < 6; i++) {
      const a = rnd() * TAU,
        r = rnd() * 0.6;
      specs.push({ mode: "glint", p: [Math.cos(a) * r, heapTop + 0.25, mz + Math.sin(a) * r], size: 0.2, cell: "star", color: heapCols[i], a: 1, add: 1, speed: 0.3 + rnd() * 0.3, phase: rnd(), group: 4 });
    }
    const fx = P.fx(specs, { name: "lueurs du moulin" });
    root.add(fx.mesh);

    /* --- emplacements des gemmes sur le tas */
    const slots = [];
    for (let i = 0; i < max; i++) slots.push(new THREE.Vector3());
    function placeSlots(k) {
      const h = 0.3 * k;
      const ring = max - 1;
      slots[0].set(0.02, heapTop + h * 0.92, mz + 0.02);
      for (let i = 1; i < max; i++) {
        const a = Math.PI / 2 + ((i - 1) / Math.max(1, ring)) * TAU + 0.35;
        const r = ring <= 4 ? 0.46 : 0.52;
        slots[i].set(Math.cos(a) * r, heapTop + h * 0.5 - 0.02, mz + Math.sin(a) * r * 0.9);
      }
    }
    const st = { t: 0, gems: max, heap: 1, heapT: 1, alarm: false, a: 0, bellA: 0, bellV: 0, wheel: 0 };
    placeSlots(1);

    return {
      object: root,
      footprint: LAIR_FOOT.map((f) => f.slice()),
      gemSlots: slots,
      maxGems: max,
      setGems(n) {
        st.gems = clamp(n | 0, 0, max);
        st.heapT = st.gems === 0 ? 0.08 : 0.35 + 0.65 * (st.gems / max);
      },
      alarm(on) {
        st.alarm = !!on;
      },
      update(dt, time) {
        if (dt > 0.1) dt = 0.1;
        if (dt < 0) dt = 0;
        P.tick(time);
        st.t += dt;
        st.a = damp(st.a, st.alarm ? 1 : 0, 6, dt);
        // Roue : tourne lentement (le bord droit descend sous la chute).
        st.wheel -= dt * 0.75;
        wheelU.w = st.wheel % TAU;
        // Cloche : balancement vif pendant l'alarme, ressort qui s'amortit ensuite.
        const target = st.alarm ? Math.sin(st.t * 9.5) * 0.75 : 0;
        st.bellV += ((target - st.bellA) * 60 - st.bellV * 6) * dt;
        st.bellA += st.bellV * dt;
        bellU.w = st.bellA;
        // Tas : s'aplatit en douceur quand des gemmes partent ; emplacements recalés.
        const prev = st.heap;
        st.heap = damp(st.heap, st.heapT, 4, dt);
        heapU.w = st.heap;
        if (Math.abs(prev - st.heap) > 1e-4) placeSlots(Math.max(0, (st.heap - 0.08) / 0.92));
        const blink = 0.5 + 0.5 * Math.sin(st.t * 10);
        fx.gain.set(1 - st.a * 0.85, st.a * (0.55 + 0.45 * blink), 1, 1);
        fx.gain2.set(st.heap > 0.2 ? 1 : 0, 1, 1, 1);
      },
      dispose() {
        if (root.parent) root.parent.remove(root);
        root.traverse((o) => {
          if (o.isMesh) o.geometry.dispose();
        });
        mainMat.dispose();
        fx.material.dispose();
      },
    };
  };
})();
