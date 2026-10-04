// « Pas touche à mes trésors » — les gemmes et les cachettes.
//
//   PTMT.models.gem(color)   0 rubis, 1 émeraude, 2 saphir, 3 améthyste, 4 topaze, 5 diamant
//     → { object, color, name, state, setState("lair" | "ground" | "carried" | "returning"), update(dt, time), dispose() }
//     Gemme taille brillant de 1,3 m de large, toujours présentée de profil à la caméra du jeu
//     (couronne en haut, pointe en bas : l'icône de la gemme), couleur franche, lueur et éclats.
//     Origine de l'objet selon l'état :
//       lair      = fond de son logement (l'objet posé sur un gemSlot) : la pointe s'y pose, flaque
//                   de lumière de sa couleur tout autour, lente rotation sur elle-même ;
//       ground    = sol : elle flotte bien au-dessus, halo pulsé, ondes au sol, rayon de lumière vertical ;
//       carried   = point d'accroche du porteur (carryAnchor, main levée) : son centre flotte 1 m plus
//                   haut (≈ 0,9 m au-dessus de la tête), un peu plus petite (1 m) ;
//       returning = centre de la gemme en vol (traînée lumineuse, dans le repère du monde).
//     Deux appels de dessin : la gemme (matière à elle : facettes, feux, liseré sombre d'épaisseur
//     constante à l'écran, éclats en étoile) et ses lueurs (+ la traînée pendant le retour).
//
//   PTMT.models.lair(maxGems, { style, mill })   cachette : bloc de 2 × 2 cases (7,2 m).
//     Trou sombre (fond noir bleuté) cerclé d'un bourrelet de terre et de blocs de granit moussus ;
//     les gemmes se posent en couronne dans des coupelles de granit bien espacées (les logements
//     vides restent visibles : anneau clair, creux noir). Styles :
//       "moulin"   cachette principale : pavés et sacs de farine autour (le moulin est un modèle à part) ;
//       "puits"    margelle de vieux puits breton, treuil, arceau de fer et seau dans un coin ;
//       "dolmen"   deux pierres levées et leur table de granit, en portique derrière le trou ;
//       "chapelle" croix celtique de granit, bougies allumées sur ses marches et sur le bord du trou.
//     Le décor de style se tient derrière le trou (−Z local) ou dans les coins : vu du jeu, il ne
//     cache jamais les gemmes, quelle que soit l'orientation donnée à la cachette (vérifié à 0°, 90°
//     et 180°). mill (facultatif, vrai pour la cachette principale) : pavés jusqu'au bord arrière,
//     où se dresse la façade du moulin.
//     → { object, style, maxGems, gemSlots: [Vector3] (repère local : y poser la gemme « lair »),
//         slotWorld(k, out) (le même logement dans le monde), radius (rayon du fond),
//         setSlots([bool…]) (quels logements sont pleins : un logement qui change s'éclaire un
//         instant), setGems(n) (les n premiers pleins), alarm(bool) (cercle rouge, ondes),
//         update(dt, time), dispose() }    PTMT.models.lair.styles : les quatre styles.
//     Origine = centre du bloc 2 × 2, au niveau du chemin. Rien n'est creusé : le fond est posé au
//     ras du sol et le bourrelet donne la profondeur. Trois appels de dessin (granit, le reste, lueurs).
(function () {
  "use strict";
  const PTMT = globalThis.PTMT;
  if (!PTMT || typeof THREE === "undefined" || !PTMT.models || !PTMT.models.props) return;
  const K = PTMT.models.kit;
  const P = PTMT.models.props;
  const { TAU, clamp, damp, easeOut } = K.math;
  const { noise3 } = K.noise;
  const T = P.T;
  const col = K.col;

  /* ------------------------------------------------------------------ gemmes : couleurs */
  // a : facettes claires, b : profondeur, c : liseré, d : lueurs (halo, flaque, rayon).
  const GEMS = [
    { name: "Rubis", a: "#ff2b45", b: "#78000f", c: "#2a0006", d: "#ff1838" },
    { name: "Émeraude", a: "#2df27c", b: "#025a24", c: "#011e0b", d: "#12ff66" },
    { name: "Saphir", a: "#4290ff", b: "#05208e", c: "#020a32", d: "#2a78ff" },
    { name: "Améthyste", a: "#c95cff", b: "#46087e", c: "#1a0430", d: "#b43cff" },
    { name: "Topaze", a: "#ffa524", b: "#b03e00", c: "#361100", d: "#ff8a10" },
    { name: "Diamant", a: "#f6ffff", b: "#58b2dc", c: "#0e2636", d: "#c4f4ff" },
  ];
  P.GEMS = GEMS;

  /* ------------------------------------------------------------------ gemme : géométrie */
  // Taille brillant à 8 pans : table octogonale, couronne (étoiles + losanges), rondiste à 16 pans,
  // culasse en deux étages jusqu'à la colette. Diamètre 1,3 m, hauteur ≈ 0,95 m (couronne un peu
  // plus haute qu'une vraie taille : l'icône se lit mieux de profil).
  const GR = 0.65;
  const G_TOP = 0.467 * GR; // table
  const G_CUL = -GR; // pointe de la culasse
  // Inclinaison vers l'arrière : la gemme se présente de profil à la caméra du jeu (60°), avec un
  // mince ovale de table visible (relief de la couronne).
  const TILT = 0.95;
  const C_TILT = Math.cos(TILT),
    S_TILT = Math.sin(TILT);
  let gemGeo = null;
  function gemGeometry() {
    if (gemGeo) return gemGeo;
    const R = GR,
      yT = G_TOP,
      rT = 0.56 * R,
      yG = 0,
      yGb = -0.117 * R,
      yM = -0.467 * R,
      rM = 0.5 * R,
      yC = G_CUL;
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
      const rnd = Math.abs(Math.sin(mx * 41.7 + my * 21.3 + mz * 6.1) * 43758.5) % 1;
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
      [0, yT + 0.02, 0],
      [Tt[1][0], yT, Tt[1][2]],
      [Tt[5][0], yT, Tt[5][2]],
      [G[12][0], yG + 0.02, G[12][2]],
    ];
    const gs = GR / 0.3;
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
        glint.push(i * 1.618 + 0.3, (i === 0 ? 0.3 : 0.2) * gs);
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute("aK", new THREE.Float32BufferAttribute(kind, 4));
    g.setAttribute("aG", new THREE.Float32BufferAttribute(glint, 2));
    g.computeBoundingSphere();
    g.boundingSphere.radius += GR;
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
        float b = pow(max(0.0, sin(uTime * (1.1 + 0.37 * aG.x) + ph * 7.0)), 24.0) * uGlint;
        mv.xy += aK.zw * aG.y * b * sc;
        mv.z += 0.5 * sc;
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
        float k = clamp(0.18 + 0.82 * pow(f, 1.3) * (0.6 + 0.4 * ndl), 0.0, 1.0);
        vec3 base = mix(uB * 0.75, uA, k);
        float spark = smoothstep(0.86, 0.98, f) * (0.45 + 0.55 * max(ndl, 0.0));
        c = base * (0.82 + 0.3 * up) + vec3(1.0) * (spec * 0.7 + spark * 0.6);
        c += uA * fres * 0.35;
        c += hue(f + vK.y * 0.5) * uFire * (0.2 + 0.55 * smoothstep(0.55, 0.95, f));
        c *= uBright;
      }
      gl_FragColor = vec4(c, 1.0);
      #include <tonemapping_fragment>
      #include <encodings_fragment>
    }
  `;
  const viewU = { value: new THREE.Vector3(1280, 800, 1.8) };
  const _db = new THREE.Vector2();
  function syncView(renderer) {
    renderer.getDrawingBufferSize(_db);
    viewU.value.set(_db.x, _db.y, Math.max(1.5, 1.8 * renderer.getPixelRatio()));
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
        uFire: { value: ci === 5 ? 1 : 0.1 },
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
      uniforms: { uCol: { value: col(GEMS[ci].d).clone() }, uA: { value: 1 }, uW: { value: 0.32 } },
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
  // Centre de la gemme (repère de l'objet) selon l'état.
  const LAIR_C = [0, GR * C_TILT - 0.07, -GR * S_TILT]; // pointe au fond de la coupelle
  const GROUND_Y = 2.0; // vue à 60° : le dessous de la gemme paraît ≈ 0,3 m au-dessus du halo
  const CARRY_Y = 1.0; // au-dessus du point d'accroche (main levée) : ≈ 0,9 m au-dessus de la tête
  const SIZE = { lair: 1, ground: 1.12, carried: 0.8, returning: 1 };
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
    // Nœud du centre (hauteur, taille), nœud de rotation (inclinaison + tour sur elle-même).
    const lift = new THREE.Group();
    const spin = new THREE.Group();
    root.add(lift);
    lift.add(spin);
    const mat = gemMaterial(ci, rnd() * 10);
    const body = new THREE.Mesh(gemGeometry(), mat);
    body.name = "gemme";
    body.onBeforeRender = syncView;
    body.renderOrder = 2;
    spin.add(body);
    // Lueurs : 0 = au sol (halo, ondes, rayon, ombre), 1 = autour de la gemme (lueur, éclats : suivent
    // son centre), 2 = lueur du retour (suit son centre), 3 = flaque de lumière au fond du logement.
    const d = G.d;
    const fx = P.fx(
      [
        { mode: "decal", p: [0, 0.04, 0], size: 1.35, cell: "halo", color: d, a: 1, add: 0.5, flick: 1.4, phase: rnd(), group: 0 },
        { mode: "decal", p: [0, 0.035, 0], size: 0.75, cell: "glow", color: "#000000", a: 0.42, add: 0, group: 0 },
        { mode: "ringFlat", p: [0, 0.05, 0], size: 0.5, end: 2.5, cell: "ring", color: d, a: 1, add: 0.55, speed: 0.6, group: 0 },
        { mode: "ringFlat", p: [0, 0.05, 0], size: 0.5, end: 2.5, cell: "ring", color: d, a: 1, add: 0.55, speed: 0.6, phase: 0.5, group: 0 },
        { mode: "beam", p: [0, 0, 0], size: 1.05, h: 11, cell: "beam", color: d, a: 1, add: 0.75, group: 0 },
        { mode: "beam", p: [0, 0, 0], size: 0.36, h: 9, cell: "beam", color: "#ffffff", a: 0.9, add: 1, group: 0 },
        { mode: "glow", p: [0, 0, 0], size: 1.55, cell: "glow", color: d, a: 0.42, add: 1, flick: 0.12, phase: rnd(), group: 1 },
        { mode: "glint", p: [0.48, 0.16, 0.3], size: 0.78, cell: "star", color: "#ffffff", a: 1, add: 1, speed: 0.41, phase: rnd(), group: 1 },
        { mode: "glint", p: [-0.44, 0.36, 0.2], size: 0.62, cell: "star", color: G.a, a: 1, add: 1, speed: 0.35, phase: rnd(), group: 1 },
        { mode: "glint", p: [0.06, -0.3, 0.35], size: 0.5, cell: "star", color: "#ffffff", a: 1, add: 1, speed: 0.53, phase: rnd(), group: 1 },
        { mode: "glow", p: [0, 0, 0], size: 1.35, cell: "glow", color: d, a: 0.85, add: 1, flick: 0.25, group: 2 },
        { mode: "decal", p: [0, 0.03, -0.3], size: 1.45, cell: "glow", color: d, a: 1, add: 0.95, flick: 0.35, phase: rnd(), group: 3 },
        { mode: "decal", p: [0, 0.035, -0.25], size: 0.7, cell: "glow", color: G.a, a: 0.75, add: 1, group: 3 },
      ],
      { name: "lueurs de gemme", order: 6 },
    );
    // Les groupes 1 et 2 suivent le centre de la gemme (hauteur et recul selon l'état).
    const center = new THREE.Vector3();
    fx.material.uniforms.uCenter = { value: center };
    fx.material.vertexShader = fx.material.vertexShader
      .replace("uniform vec4 uGain2;", "uniform vec4 uGain2;\nuniform vec3 uCenter;")
      .replace("vec3 c = position;", "vec3 c = position;\nif (aD.y > 0.5 && aD.y < 2.5) c += uCenter;");
    root.add(fx.mesh);
    const trail = makeTrail(ci);
    root.add(trail);
    const hist = new Float32Array(TRAIL_N * 3);
    let histN = 0,
      histT = 0;

    // k : poids de chaque état (fondus enchaînés), pop : petit bond quand elle tombe au sol.
    const st = { state: "lair", t: rnd() * 10, k: { ground: 0, carried: 0, returning: 0, lair: 1 }, yaw: rnd() * TAU, pop: 0 };
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
        // Centre et taille selon l'état (mélange doux entre états).
        const bob = Math.sin(st.t * 2.2) * 0.12;
        const hop = st.pop > 0 ? Math.sin(easeOut(1 - st.pop) * Math.PI) * 1.1 : 0;
        const s = kl * SIZE.lair + kg * SIZE.ground + kc * SIZE.carried + kr * SIZE.returning;
        const cy = kl * LAIR_C[1] + kg * (GROUND_Y + bob + hop) + kc * (CARRY_Y + bob * 0.4);
        const cz = kl * LAIR_C[2];
        lift.position.set(0, cy, cz);
        lift.scale.setScalar(s);
        center.set(0, cy, cz);
        // Rotation lente au logement, plus vive au sol et en vol.
        st.yaw += (kl * 0.35 + kg * 1.3 + kc * 0.9 + kr * 7) * dt;
        spin.rotation.set(-TILT + 0.08 * kg * Math.sin(st.t * 1.1), st.yaw, 0);
        // Lueurs.
        fx.gain.set(kg, Math.max(kl * 0.85, kg, kc * 0.9, kr), kr, kl);
        mat.uniforms.uGlint.value = 0.85 + kr * 0.4;
        mat.uniforms.uBright.value = 1 + kg * 0.1 + kr * 0.3 + Math.sin(st.t * 4.5) * 0.035 * (kg + kl);
        // Traînée (points passés, dans le repère du monde, ramenés dans celui de l'objet).
        trail.visible = kr > 0.05;
        if (trail.visible) {
          root.updateWorldMatrix(true, false);
          _w.set(0, cy, 0).applyMatrix4(root.matrixWorld);
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
    api.update(0, 0);
    return api;
  };

  /* ================================================================== cachettes */
  const LC = {
    floor0: "#04060e",
    floor1: "#080c19",
    floor2: "#111522",
    wall0: "#17161c",
    wall1: "#2b2722",
    wall2: "#4a4132",
    crest: "#56683a",
    bank0: "#5c8634",
    bank1: "#68783a",
    foot: "#756848",
    granite: "#bcb5a6",
    graniteD: "#9d9686",
    graniteW: "#d4cdbd",
    moss: "#4a8a2a",
    lichen: "#c8c060",
    socket: "#b4ad9e",
    cavity: "#010205",
    burlap: "#cfae78",
    flour: "#f7f3ea",
    wood: "#9a7652",
    woodD: "#5e4430",
    wax: "#f8f0de",
    iron: "#34302e",
    water: "#0d2636",
    slate: "#5a677c",
    slateD: "#3a4250",
    cobble: ["#d4cbb7", "#c4baa4", "#dcd4c1", "#b9af99"],
  };
  P.LAIR_COLORS = LC;

  /** Disposition des logements (repère du centre de la couronne) : rayon et positions [x, z]. */
  function slotLayout(n) {
    const ring = (r, a0) => {
      const out = [];
      for (let i = 0; i < n; i++) {
        const a = a0 + (i / n) * TAU;
        out.push([Math.cos(a) * r, Math.sin(a) * r]);
      }
      return out;
    };
    if (n <= 1) return { r: 0, pts: [[0, 0]] };
    if (n === 2) return { r: 1.0, pts: [[-1.0, 0], [1.0, 0]] };
    if (n === 3) return { r: 1.1, pts: ring(1.1, -Math.PI / 2) };
    if (n === 4) return { r: 1.3, pts: ring(1.3, Math.PI / 4) };
    if (n === 5) return { r: 1.45, pts: ring(1.45, -Math.PI / 2) };
    if (n === 6) return { r: 1.7, pts: ring(1.7, 0) };
    if (n <= 8) return { r: 2.0, pts: ring(2.0, -Math.PI / 2) };
    const pts = [[0, 0]];
    for (let i = 0; i < n - 1; i++) {
      const a = -Math.PI / 2 + (i / (n - 1)) * TAU;
      pts.push([Math.cos(a) * 2.05, Math.sin(a) * 2.05]);
    }
    return { r: 2.05, pts };
  }
  // La couronne est avancée vers la caméra : les gemmes, de profil, penchent vers l'arrière.
  const RING_DZ = 0.3;

  /** Cuvette : fond noir bleuté, paroi intérieure sombre, crête moussue, talus extérieur (révolution). */
  function craterTpl(Rf, seed) {
    return P.tc(`crater${Rf.toFixed(2)},${seed}`, () => {
      const prof = [
        [0, 0.035, LC.floor0],
        [Rf * 0.45, 0.035, LC.floor0],
        [Rf * 0.82, 0.038, LC.floor1],
        [Rf, 0.045, LC.floor2],
        [Rf + 0.1, 0.12, LC.wall0],
        [Rf + 0.25, 0.27, LC.wall1],
        [Rf + 0.38, 0.38, LC.wall2],
        [Rf + 0.55, 0.45, LC.crest],
        [Rf + 0.76, 0.37, LC.bank0],
        [Rf + 0.93, 0.18, LC.bank1],
        [Rf + 1.03, 0.02, LC.foot],
        [Rf + 1.1, -0.05, LC.foot],
      ];
      const SEG = 56;
      const pos = [],
        cl = [],
        idx = [];
      for (let i = 0; i < prof.length; i++) {
        const [r, y, c] = prof[i];
        const cc = col(c);
        for (let j = 0; j < SEG; j++) {
          const a = (j / SEG) * TAU;
          const ca = Math.cos(a),
            sa = Math.sin(a);
          // Contour irrégulier (pas un cercle parfait) ; le fond reste lisse.
          const wob = i < 3 ? 0 : (noise3(ca * 1.4 + seed, sa * 1.4, 0.5, 7) - 0.5) * 0.28 + (noise3(ca * 3.3, sa * 3.3 + seed, 1.5, 8) - 0.5) * 0.1;
          const rr = r + wob;
          const yy = y + (i >= 5 && i <= 8 ? (noise3(ca * 2.1, sa * 2.1, seed * 0.37, 9) - 0.5) * 0.12 : 0);
          pos.push(ca * rr, yy, sa * rr);
          // Variations de teinte : reflets bleutés au fond, terre et mousse sur le bourrelet.
          const n = noise3(ca * r * 0.9 + seed, sa * r * 0.9, 2.5, 11) - 0.5;
          const f = 1 + n * (i < 4 ? 0.5 : 0.28);
          cl.push(cc.r * f, cc.g * f, cc.b * f * (i < 4 ? 1 + n * 0.3 : 1));
        }
      }
      for (let i = 0; i < prof.length - 1; i++)
        for (let j = 0; j < SEG; j++) {
          const a = i * SEG + j,
            b = i * SEG + ((j + 1) % SEG),
            c2 = (i + 1) * SEG + j,
            d2 = (i + 1) * SEG + ((j + 1) % SEG);
          idx.push(a, b, c2, b, d2, c2);
        }
      const p = new Float32Array(pos);
      const t = new P.Tpl(p, new Float32Array(p.length), Uint32Array.from(idx), null);
      P.deform(t, (x, y, z) => [x, y, z]);
      t.col = new Float32Array(cl);
      return t;
    });
  }
  /** Pierre dressée (dolmen, pierres de bord) : bloc cabossé aux arêtes arrondies, base à y = 0. */
  function megalithTpl(seed) {
    return P.tc("megalith" + seed, () => {
      const t = P.fromGeo(new THREE.BoxGeometry(1, 1, 1, 3, 4, 3).translate(0, 0.5, 0), "smooth");
      const dirY = new Float32Array(t.n);
      P.deform(t, (x, y, z, i) => {
        dirY[i] = y < 0.01 ? -1 : 1;
        const n = noise3(x * 2.3 + seed, y * 2.3, z * 2.3 - seed, seed | 0) - 0.5;
        const k = 1 + n * 0.26;
        const r = Math.max(Math.abs(x) * 2, Math.abs(z) * 2);
        const round = 1 - 0.14 * Math.pow(r, 4) * (0.3 + y);
        const top = y > 0.8 ? 1 - (y - 0.8) * 0.6 : 1;
        return [x * k * round * top, y * (1 + n * 0.1), z * k * round * top];
      });
      return P.cullBelow(t, dirY, 0);
    });
  }
  /** Margelle de puits (anneau de granit tourné). */
  const wellRingTpl = () =>
    P.tc("lairWellRing", () =>
      P.fromGeo(
        new THREE.LatheGeometry(
          [
            [0.44, 0],
            [0.66, 0],
            [0.66, 0.72],
            [0.71, 0.72],
            [0.71, 0.84],
            [0.42, 0.84],
            [0.42, 0.3],
          ].map((p) => new THREE.Vector2(p[0], p[1])),
          14,
        ),
        "flat",
      ),
    );
  /** Sac de farine (toile de jute) noué, parfois ouvert. */
  function sack(A, rnd, x, z, yaw, s, open) {
    A.main.put(T.blob(90 + Math.floor(rnd() * 6), 1, 0.1), [x, 0.3 * s, z], [0, yaw, (rnd() - 0.5) * 0.2], [0.33 * s, 0.38 * s, 0.28 * s], { c: P.vary(LC.burlap, rnd, 0.12), rim: 0.55, vj: 0.08, dark: 0.3 });
    A.main.put(T.cyl(0.335 * s, 0.335 * s, 0.07 * s, 12, true), [x, 0.36 * s, z], [0, yaw, 0], [1, 1, 0.86], { c: "#3a5a9a", rim: 0.4 });
    if (open) {
      A.main.put(T.blob(97, 1, 0.12), [x, 0.62 * s, z], 0, [0.25 * s, 0.09 * s, 0.22 * s], { c: LC.flour, rim: 0.3, emit: 0.06 });
      A.main.put(T.blob(98, 1, 0.1, 1.6, -0.2), [x + Math.cos(yaw) * 0.45, 0.0, z + Math.sin(yaw) * 0.45], 0, [0.36, 0.05, 0.28], { c: LC.flour, rim: 0.2, emit: 0.05 });
    } else {
      A.main.put(T.cylB(0.06 * s, 0.11 * s, 0.13 * s, 6), [x, 0.62 * s, z], 0, 1, { c: "#b39d72" });
      A.main.put(T.torus(0.07 * s, 0.018, 3, 8), [x, 0.66 * s, z], [Math.PI / 2, 0, 0], 1, { c: "#7a5a32" });
    }
  }
  /** Bougie (cire, mèche) et sa flamme dans les lueurs. */
  function candle(A, fxs, x, y, z, h, rnd) {
    A.main.put(T.cylB(0.07, 0.075, h, 7), [x, y, z], [(rnd() - 0.5) * 0.08, 0, (rnd() - 0.5) * 0.08], 1, { c: LC.wax, emit: 0.3, rim: 0.3 });
    A.main.put(T.cylB(0.012, 0.012, 0.05, 3), [x, y + h, z], 0, 1, { c: "#2a2018" });
    fxs.push({ mode: "glow", p: [x, y + h + 0.1, z], size: 0.16, cell: "drop", color: "#fff1b0", a: 1, add: 1, flick: 0.45, phase: rnd(), group: 0 });
    fxs.push({ mode: "glow", p: [x, y + h + 0.1, z], size: 0.55, cell: "glow", color: "#ffa23a", a: 0.5, add: 1, flick: 0.3, phase: rnd(), group: 0 });
  }
  /** Touffes d'herbe et petites fleurs (décor des coins). */
  function tuft(A, rnd, x, y, z, s, flowers) {
    for (let k = 0; k < 5; k++)
      A.main.put(T.blade(0.1 * (rnd() - 0.5), 0.06, 2), [x + (rnd() - 0.5) * 0.15, y, z + (rnd() - 0.5) * 0.15], [0, rnd() * TAU, (rnd() - 0.5) * 0.7], [1, (0.32 + rnd() * 0.2) * s, 1], {
        g: ["#356c20", "#8cc44c", y, y + 0.4 * s],
        sway: 1.1,
      });
    if (flowers) A.main.put(T.flower(5, 0.07, 0.02, flowers, "#ffd21a"), [x, y + 0.22 * s, z], [0, rnd() * TAU, 0], 1, { emit: 0.2, sway: 1.1 });
  }
  const plant = (A, name, v, x, y, z, s, rnd) => {
    if (typeof P.plant !== "function") return;
    A.main.put(P.plant(name, v % (P.PLANT_VARIANTS[name] || 1)), [x, y, z], [0, rnd() * TAU, 0], s, { pivot: [x, y, z] });
  };

  /* --- décors de style (repère de la cachette : −Z = derrière le trou) */
  const STYLE = {};
  // Cachette principale : pavés tout autour, sacs de farine dans deux coins.
  STYLE.moulin = (A, c) => {
    const { rnd, Ro } = c;
    const step = 0.5;
    for (let gz = -3.35; gz <= 3.36; gz += step)
      for (let gx = -3.35; gx <= 3.36; gx += step) {
        const row = Math.round((gz + 3.35) / step);
        const x = gx + (row % 2 ? step * 0.5 : 0) + (rnd() - 0.5) * 0.08,
          z = gz + (rnd() - 0.5) * 0.08;
        if (Math.abs(x) > 3.4 || Math.abs(z) > 3.4) continue;
        const dd = Math.hypot(x, z);
        if (dd < Ro + 0.12) continue;
        if (rnd() < (c.mill && z < 0 ? 0.03 : 0.14)) continue;
        A.rock.put(T.boxB(0.44, 0.1, 0.4), [x, -0.03, z], [0, (rnd() - 0.5) * 0.3, 0], [1 + (rnd() - 0.5) * 0.18, 1, 1 + (rnd() - 0.5) * 0.18], { c: LC.cobble[Math.floor(rnd() * 4)], rim: 0.25, vj: 0.08 });
      }
    sack(A, rnd, -2.95, 2.55, 0.4, 1, false);
    sack(A, rnd, -2.45, 3.0, -0.3, 0.92, true);
    sack(A, rnd, -3.15, 3.12, 1.2, 0.85, false);
    sack(A, rnd, 3.0, -2.75, 2.1, 0.95, false);
    sack(A, rnd, 2.55, -3.1, 0.6, 0.85, false);
    // Petite caisse de bois.
    A.main.put(T.boxB(0.62, 0.48, 0.55), [3.0, 0, 2.85], [0, 0.35, 0], 1, { c: LC.wood, vj: 0.08, rim: 0.3 });
    for (const yy of [0.12, 0.36]) A.main.put(T.box(0.66, 0.06, 0.59), [3.0, yy, 2.85], [0, 0.35, 0], 1, { c: LC.woodD });
  };
  // Vieux puits breton dans le coin arrière gauche (tourné vers le trou).
  STYLE.puits = (A, c) => {
    const { rnd, fxs } = c;
    const wx = -2.6,
      wz = -2.55;
    const M = new THREE.Matrix4().makeRotationY(Math.atan2(-wx, -wz) + Math.PI).setPosition(wx, 0, wz);
    A.rock.put(wellRingTpl(), [0, 0, 0], 0, 1, { c: LC.granite, moss: ["#5f9a34", 0.7, 0.95], rim: 0.5 }, M);
    A.main.put(T.disc(0.43, 14), [0, 0.42, 0], 0, 1, { c: LC.water, emit: 0.08 }, M);
    for (const s of [-1, 1]) A.rock.put(T.boxB(0.2, 1.62, 0.22), [s * 0.62, 0.7, 0], 0, 1, { c: LC.graniteD, rim: 0.4 }, M);
    A.main.put(T.cyl(0.08, 0.08, 1.2, 8), [0, 1.98, 0], [0, 0, Math.PI / 2], 1, { c: LC.woodD }, M);
    A.main.put(T.box(0.05, 0.32, 0.05), [0.66, 1.86, 0.16], [0.5, 0, 0], 1, { c: LC.iron }, M);
    A.main.put(T.cylB(0.012, 0.012, 1.05, 4), [0.12, 0.92, 0], 0, 1, { c: "#d8c79a" }, M);
    A.main.put(T.cylB(0.13, 0.11, 0.24, 8), [0.12, 0.72, 0], 0, 1, { c: LC.wood }, M);
    A.main.put(T.torus(0.125, 0.015, 3, 10), [0.12, 0.9, 0], [Math.PI / 2, 0, 0], 1, { c: LC.iron }, M);
    // Arceau de fer forgé et sa poulie au-dessus du treuil.
    A.main.put(T.torus(0.62, 0.035, 4, 16, Math.PI), [0, 1.98, 0], 0, 1, { c: LC.iron, rim: 0.3 }, M);
    A.main.put(T.torus(0.13, 0.03, 4, 10), [0, 2.48, 0], 0, 1, { c: LC.iron }, M);
    A.main.put(T.sphere(0.07, 6, 4), [0, 2.66, 0], 0, 1, { c: "#c08a3a", emit: 0.2 }, M);
    // Seau posé au sol, fougère et touffes au pied.
    A.main.put(T.cylB(0.15, 0.12, 0.26, 9), [-2.75, 0, -1.25], 0, 1, { c: LC.wood, rim: 0.4 });
    A.main.put(T.torus(0.15, 0.014, 3, 10), [-2.75, 0.24, -1.25], [Math.PI / 2, 0, 0], 1, { c: LC.iron });
    plant(A, "fern", 1, -1.75, 0, -3.15, 0.75, rnd);
    tuft(A, rnd, -3.25, 0, -1.7, 1, "#ffffff");
    tuft(A, rnd, -1.6, 0, -3.3, 0.9, null);
    fxs.push({ mode: "glint", p: [wx, 0.5, wz], size: 0.32, cell: "star", color: "#bfe8ff", a: 0.9, add: 1, speed: 0.17, phase: rnd(), group: 0 });
  };
  // Dolmen : deux pierres levées et leur table, en portique derrière le trou.
  STYLE.dolmen = (A, c) => {
    const { rnd, Ro } = c;
    const z0 = -Math.min(3.0, Ro - 0.1);
    const ro = { c: "#aaa395", rim: 0.85, dark: 0.35, vj: 0.1, moss: ["#5f8a30", 0.75, 0.98] };
    // Pierres levées plus épaisses que la table n'est profonde : elles dépassent devant elle (visibles d'en haut).
    A.rock.put(megalithTpl(3), [-1.35, -0.05, z0 + 0.12], [0.03, 0.12, -0.04], [0.78, 1.95, 0.8], ro);
    A.rock.put(megalithTpl(5), [1.35, -0.05, z0 + 0.1], [-0.02, -0.15, 0.05], [0.72, 1.9, 0.76], ro);
    A.rock.put(megalithTpl(7), [0.0, 1.8, z0 - 0.22], [0.04, 0.06, 0.06], [3.5, 0.44, 0.95], Object.assign({}, ro, { c: "#b3ac9e", moss: ["#7a9a3a", 0.85, 0.99] }));
    // Pierres de calage, lichens jaunes sur la table, bruyère et ajoncs aux coins.
    for (let i = 0; i < 5; i++) {
      const x = (rnd() - 0.5) * 3.8,
        z = z0 + 0.45 + rnd() * 0.3;
      A.rock.put(T.rock(560 + i, 0, 0.3), [x, 0.02, z], [0, rnd() * TAU, 0], [0.22, 0.15, 0.2], { c: "#a39c90", rim: 0.7, moss: ["#5f8a30", 0.5, 0.9] });
    }
    for (let i = 0; i < 6; i++) A.main.put(T.blob(570 + i, 0, 0.3), [(rnd() - 0.5) * 2.8, 2.24, z0 - 0.22 + (rnd() - 0.5) * 0.6], 0, [0.16, 0.025, 0.13], { c: LC.lichen, emit: 0.05 });
    plant(A, "heather", 0, -2.95, 0, -2.75, 1.1, rnd);
    plant(A, "gorse", 1, 2.95, 0, -2.7, 0.95, rnd);
    plant(A, "fern", 0, 3.0, 0, 2.9, 0.8, rnd);
    tuft(A, rnd, -3.0, 0, 2.9, 1, "#ff5aa8");
  };
  // Chapelle : croix celtique de granit sur ses marches, bougies, hortensias.
  STYLE.chapelle = (A, c) => {
    const { rnd, fxs, Rf } = c;
    const cx = 2.55,
      cz = -2.55;
    const S = { c: "#9d968a", rim: 0.6, vj: 0.08, moss: ["#c8c060", 0.8, 0.99] };
    A.rock.put(T.boxB(1.3, 0.24, 1.3), [cx, -0.02, cz], [0, 0.785, 0], 1, { c: "#8a8478", rim: 0.5, vj: 0.08 });
    A.rock.put(T.boxB(0.92, 0.24, 0.92), [cx, 0.22, cz], [0, 0.785, 0], 1, { c: "#979084", rim: 0.5, vj: 0.08 });
    A.rock.put(T.boxB(0.34, 2.2, 0.26), [cx, 0.46, cz], 0, 1, S);
    A.rock.put(T.box(1.3, 0.3, 0.24), [cx, 2.15, cz], 0, 1, S);
    A.rock.put(T.box(0.34, 0.5, 0.24), [cx, 2.78, cz], 0, 1, S);
    A.rock.put(T.torus(0.44, 0.075, 5, 18), [cx, 2.15, cz + 0.02], 0, 1, Object.assign({}, S, { c: "#aaa397" }));
    // Bougies sur les marches et sur le bord du trou.
    candle(A, fxs, cx - 0.5, 0.22, cz + 0.35, 0.28, rnd);
    candle(A, fxs, cx + 0.36, 0.22, cz + 0.48, 0.36, rnd);
    candle(A, fxs, cx - 0.14, 0.46, cz + 0.3, 0.24, rnd);
    for (const a of [-2.55, 2.2, 0.95]) {
      const r = Rf + 0.62;
      candle(A, fxs, Math.cos(a) * r, 0.42, Math.sin(a) * r, 0.24 + rnd() * 0.1, rnd);
    }
    // Hortensias bleus et blancs au pied de la croix.
    for (const [x, z, h] of [
      [cx - 0.9, cz - 0.2, "#5a7aff"],
      [cx + 0.35, cz - 0.85, "#ffffff"],
    ]) {
      A.main.put(T.blob(640 + Math.floor(rnd() * 5), 1, 0.14, 1.7, -0.3), [x, 0.25, z], 0, [0.42, 0.3, 0.36], { c: "#2f6a28", rim: 0.7, vj: 0.1, sway: 0.3 });
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU + rnd();
        A.main.put(T.blob(650 + i, 0, 0.2), [x + Math.cos(a) * 0.24, 0.38 + (i % 2) * 0.08, z + Math.sin(a) * 0.2], 0, 0.17, { c: P.vary(h, rnd, 0.2), rim: 0.6, vj: 0.14, emit: 0.1, sway: 0.3 });
      }
    }
    tuft(A, rnd, -3.0, 0, -2.9, 1, "#ffffff");
    tuft(A, rnd, -3.05, 0, 2.85, 1, "#ffd21a");
    tuft(A, rnd, 3.0, 0, 2.9, 0.9, null);
  };
  const STYLES = Object.keys(STYLE);

  let lairSeq = 0;
  PTMT.models.lair = function (maxGems, opts) {
    opts = opts || {};
    const max = clamp(maxGems | 0 || 5, 1, 9);
    const style = STYLE[opts.style] ? opts.style : "moulin";
    const seq = lairSeq++;
    const rnd = P.rng(4242 + seq * 97 + STYLES.indexOf(style) * 13);
    const root = new THREE.Group();
    root.name = "ptmt-lair-" + style;
    const lay = slotLayout(max);
    const Rf = Math.max(1.4, lay.r + 0.92);
    const Ro = Rf + 1.08;
    const A = { rock: new P.Acc({ seed: 41 + seq }), main: new P.Acc({ seed: 43 + seq }) };
    const fxs = [];

    /* --- cuvette, logements */
    A.main.put(craterTpl(Rf, (seq % 4) + 1), [0, 0, 0], [0, rnd() * TAU, 0], 1, { rim: 0.15 });
    const slots = [];
    for (const [x, z0] of lay.pts) {
      const z = z0 + (lay.r > 0 ? RING_DZ : 0.15);
      slots.push(new THREE.Vector3(x, 0.11, z));
      // Coupelle de granit clair (bien visible vide) et son creux noir.
      A.rock.put(T.torus(0.3, 0.085, 5, 14), [x, 0.07, z], [Math.PI / 2, 0, 0], 1, { c: LC.socket, rim: 0.35 });
      A.main.put(T.disc(0.25, 12), [x, 0.06, z], 0, 1, { c: LC.cavity });
    }

    /* --- crête : blocs de granit moussus (quatre passages aux points cardinaux) */
    const crestR = Rf + 0.56;
    const nStones = Math.max(10, Math.round((TAU * crestR) / 0.92));
    for (let i = 0; i < nStones; i++) {
      const a = (i / nStones) * TAU + (rnd() - 0.5) * 0.12;
      const gap = Math.min(...[0, Math.PI / 2, Math.PI, -Math.PI / 2, (3 * Math.PI) / 2].map((g) => Math.abs(((a - g + Math.PI * 3) % TAU) - Math.PI)));
      if (gap < 0.19) continue;
      const r = crestR + (rnd() - 0.5) * 0.14;
      const so = { c: P.vary(LC.granite, rnd, 0.16, 0.02), rim: 0.9, dark: 0.4, vj: 0.1, moss: [LC.moss, 0.78, 0.98] };
      if (i % 3 !== 1) {
        // Bloc de granit taillé, posé de biais sur la crête.
        A.rock.put(megalithTpl(10 + ((i * 5 + seq) % 9)), [Math.cos(a) * r, 0.2, Math.sin(a) * r], [(rnd() - 0.5) * 0.25, -a + Math.PI / 2 + (rnd() - 0.5) * 0.3, (rnd() - 0.5) * 0.2], [0.82 + rnd() * 0.3, 0.38 + rnd() * 0.18, 0.5 + rnd() * 0.1], so);
      } else {
        A.rock.put(T.rock(600 + ((i * 7 + seq) % 23), 1, 0.3), [Math.cos(a) * r, 0.3, Math.sin(a) * r], [rnd() * 0.25, -a + Math.PI / 2, rnd() * 0.2], [0.5 + rnd() * 0.15, 0.34 + rnd() * 0.12, 0.42 + rnd() * 0.1], so);
      }
      if (rnd() < 0.45) tuft(A, rnd, Math.cos(a + 0.2) * (r + 0.32), 0.24, Math.sin(a + 0.2) * (r + 0.32), 0.9, rnd() < 0.3 ? "#ffffff" : null);
    }

    /* --- décor de style */
    const ctx = { rnd, Rf, Ro, fxs, mill: !!opts.mill, slots };
    STYLE[style](A, ctx);

    /* --- maillages */
    const rockMesh = P.mesh(A.rock, P.rockMat(), { cast: true, name: "granit de la cachette", pad: 0.5 });
    const mainMat = P.shared("lair", () => P.paint({ sway: true, lift: 0.1, rim: [0.06, 0.45, 0.6], name: "cachette" }));
    const mainMesh = P.mesh(A.main, mainMat, { cast: true, name: "cachette", pad: 0.5 });
    root.add(rockMesh, mainMesh);

    /* --- lueurs : 0 = ambiance (reflets bleutés au fond, poussières, flammes), 1 = alarme,
           2..7 = éclair d'un logement qui change (gemme volée ou rendue) */
    fxs.push({ mode: "decal", p: [0, 0.05, 0.1], size: Rf * 0.9, cell: "glow", color: "#2440b0", a: 0.3, add: 1, flick: 0.5, group: 0 });
    for (let i = 0; i < 7; i++) {
      const a = rnd() * TAU,
        r = Math.sqrt(rnd()) * Rf * 0.8;
      fxs.push({ mode: "spark", p: [Math.cos(a) * r, 0.1, Math.sin(a) * r], size: 0.055, cell: "spark", color: i % 2 ? "#9fd8ff" : "#d8c8ff", a: 0.85, add: 1, speed: 0.07 + rnd() * 0.06, phase: rnd(), r: 0.25 + rnd() * 0.3, turns: 0.6, h: 1.1 + rnd() * 0.6, group: 0 });
    }
    fxs.push({ mode: "decal", p: [0, 0.52, 0], size: (crestR + 0.1) / 0.8, cell: "ring", color: "#ff2a1a", a: 1, add: 0.75, flick: 0.6, group: 1 });
    fxs.push({ mode: "decal", p: [0, 0.06, 0], size: Rf * 1.05, cell: "glow", color: "#ff2010", a: 0.6, add: 1, flick: 0.5, group: 1 });
    for (let i = 0; i < 2; i++) fxs.push({ mode: "ringFlat", p: [0, 0.12, 0], size: Rf * 0.4, end: Ro + 1.3, cell: "ring", color: "#ff3a1a", a: 1, add: 0.6, speed: 0.85, phase: i / 2, group: 1 });
    slots.forEach((s, k) => {
      const g = 2 + Math.min(k, 5);
      fxs.push({ mode: "ringFlat", p: [s.x, 0.14, s.z - 0.2], size: 0.35, end: 1.5, cell: "ring", color: "#fff4c8", a: 1, add: 0.8, speed: 1.3, phase: 0.1, group: g });
      fxs.push({ mode: "decal", p: [s.x, 0.12, s.z - 0.2], size: 1.0, cell: "glow", color: "#fff0b8", a: 0.85, add: 1, group: g });
    });
    const fx = P.fx(fxs, { name: "lueurs de la cachette" });
    root.add(fx.mesh);

    const st = { t: rnd() * 10, alarm: false, a: 0, full: new Array(max).fill(true), known: false, flash: new Float32Array(6) };
    // Un logement qui change (gemme volée ou rendue) s'éclaire un instant ; pas au premier réglage.
    const setFull = (k, v) => {
      if (v === st.full[k]) return;
      st.full[k] = v;
      if (st.known) st.flash[Math.min(k, 5)] = 1;
    };
    const api = {
      object: root,
      style,
      maxGems: max,
      gemSlots: slots,
      radius: Rf,
      /** Position dans le monde du logement k (où poser la gemme « lair »). */
      slotWorld(k, out) {
        out = out || new THREE.Vector3();
        root.updateWorldMatrix(true, false);
        return out.copy(slots[clamp(k | 0, 0, max - 1)]).applyMatrix4(root.matrixWorld);
      },
      /** Logements pleins : tableau de booléens (un par logement). */
      setSlots(list) {
        for (let k = 0; k < max; k++) setFull(k, !!(list && list[k]));
        st.known = true;
      },
      /** Les n premiers logements pleins, les autres vides. */
      setGems(n) {
        const m = clamp(n | 0, 0, max);
        for (let k = 0; k < max; k++) setFull(k, k < m);
        st.known = true;
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
        for (let k = 0; k < 6; k++) st.flash[k] = Math.max(0, st.flash[k] - dt * 1.25);
        const f = st.flash;
        const blink = 0.5 + 0.5 * Math.sin(st.t * 9);
        fx.gain.set(1, st.a * (0.45 + 0.55 * blink), f[0], f[1]);
        fx.gain2.set(f[2], f[3], f[4], f[5]);
      },
      dispose() {
        if (root.parent) root.parent.remove(root);
        rockMesh.geometry.dispose();
        mainMesh.geometry.dispose();
        fx.material.dispose();
        fx.mesh.geometry.dispose();
      },
    };
    api.update(0, 0);
    return api;
  };
  PTMT.models.lair.styles = STYLES.slice();
})();
