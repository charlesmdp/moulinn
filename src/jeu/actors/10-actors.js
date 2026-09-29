// « Pas touche à mes trésors » — les ennemis animés (PTMT.actors).
//
//   await PTMT.actors.load();                   // prépare les douze variantes une seule fois (l'adresse passée est ignorée)
//   const a = PTMT.actors.create(type, elite);  // réutilisé depuis une réserve
//   a.object  a.update(dt, time, s)  a.event(name)  a.release()  a.height
//
// Personnages « chibi » entièrement procéduraux (11-types.js) : grosse tête, corps trapu, moufles et
// gros souliers, couleurs franches propres à chaque type. Squelette léger fait maison (21 os de corps
// + os d'accessoires), animé à la main : marche rebondie, pas de loup, course, patin, dandinement,
// nage, pédalo, conduite, et toutes les réactions (coup, projection, tourbillon, K.-O. étoilé, vol,
// filet, feu, gel…). Aucun clip ni mélangeur d'animations.
//
// Rendu : un seul SkinnedMesh par ennemi (corps, visage, accessoires et coque de contour fusionnés),
// une seule matière partagée par tous les ennemis : un appel de dessin (+ ombre sur ordinateur). La
// coque de contour est une copie retournée de la géométrie, gonflée à l'écran par le shader : liseré
// sombre d'épaisseur constante en pixels, qui détache les silhouettes de l'herbe vue d'avion. Les
// données par instance (éclair de coup, mouillé, gelé, brûlé, fantôme, dissolution, surchauffe)
// passent par un « os de données » (indice 0) lu par le shader. Les états visibles (glaçon, filet,
// flammes, fumée, étoiles…) sont dessinés en lots instanciés partagés (12-overlay.js).
(function () {
  "use strict";
  if (typeof THREE === "undefined") return; // rendu seulement : sans three.js (banc de simulation), rien à enregistrer
  const PTMT = (globalThis.PTMT = globalThis.PTMT || {});
  const A = (PTMT.actors = PTMT.actors || {});

  const TAU = Math.PI * 2;
  const HULL = 30; // identifiant de partie de la coque de contour
  const TEMPLATES = new Map();
  const POOLS = new Map();
  A.actives = new Set();
  A._timeUniform = { value: 0 };
  // x, y : taille du tampon de dessin (px) ; z : rapport de pixels ; w : contour actif (1) ou non (0)
  A._outline = { value: new THREE.Vector4(1280, 800, 1, 1) };

  // Os du corps, dans l'ordre des tableaux de pose (les accessoires suivent).
  const BODY = [
    "root", "hips", "body", "head", "eye_l", "eye_r", "brow_l", "brow_r", "mouth",
    "arm_l", "fore_l", "hand_l", "arm_r", "fore_r", "hand_r",
    "thigh_l", "shin_l", "foot_l", "thigh_r", "shin_r", "foot_r",
  ];
  const BI = {};
  BODY.forEach((n, i) => (BI[n] = i));
  A.BODY_BONES = BODY;

  // ---------------------------------------------------------------------------------------------
  // Chargement : tout est procédural, rien à télécharger
  // ---------------------------------------------------------------------------------------------
  A.load = function () {
    if (A.ready) return Promise.resolve(A);
    if (A._loading) return A._loading;
    A._loading = new Promise((ok, ko) => {
      try {
        for (const t of A.TYPES) for (const e of [false, true]) templateFor(t, e);
        if (A.overlay && A.overlay.init) A.overlay.init();
        A.ready = true;
        ok(A);
      } catch (err) {
        A._loading = null;
        ko(err);
      }
    });
    return A._loading;
  };

  // ---------------------------------------------------------------------------------------------
  // Assemblage : pièces placées dans l'espace de liaison (debout, face +Z, gauche = +X, pieds à y = 0),
  // chacune liée à un os ou pondérée entre plusieurs (bras et jambes « tuyau d'arrosage »), avec sa
  // coque de contour. Même signature que PTMT.gfx.Parts.add (le sac de trésor partagé s'y construit).
  // ---------------------------------------------------------------------------------------------
  const _m = new THREE.Matrix4(), _n3 = new THREE.Matrix3(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
  const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _s = new THREE.Vector3();
  const ZERO3 = [0, 0, 0];
  const colCache = new Map();
  function lin(hex) {
    let c = colCache.get(hex);
    if (!c) colCache.set(hex, (c = PTMT.color(hex)));
    return c;
  }

  class Builder {
    constructor(names) {
      this.bi = {};
      names.forEach((n, i) => (this.bi[n] = i + 1)); // 0 : os de données
      this.P = []; this.N = []; this.C = []; this.M = []; this.SI = []; this.SW = []; this.I = [];
      this.nv = 0;
      this.tris = 0;
      this.hullTris = 0;
      this.defaultBone = "root";
      this.minOutline = 0.085; // rayon minimal d'une pièce pour recevoir un contour automatique
    }
    bone(name) {
      const i = this.bi[name];
      if (i === undefined) throw new Error("PTMT.actors : os inconnu « " + name + " »");
      return i;
    }
    /**
     * opt : { color, mat (classe), part, pos, rot, scale, quat, order, matrix, bone, weights(x,y,z) → [[os, poids], ...],
     *         colors (garder l'attribut color de la géométrie, linéaire), grad [hexHaut, hexBas, y0, y1],
     *         outline (true/false ; automatique selon la taille sinon), jitter, seed }
     */
    add(geometry, opt) {
      opt = opt || {};
      const g = geometry;
      if (opt.matrix) _m.copy(opt.matrix);
      else {
        const r = opt.rot || ZERO3;
        const sc = opt.scale === undefined ? 1 : opt.scale;
        if (opt.quat) _q.copy(opt.quat);
        else _q.setFromEuler(_e.set(r[0], r[1], r[2], opt.order || "XYZ"));
        if (typeof sc === "number") _s.set(sc, sc, sc);
        else _s.set(sc[0], sc[1], sc[2]);
        _m.compose(_v.fromArray(opt.pos || ZERO3), _q, _s);
      }
      const pos = g.getAttribute("position"), nor = g.getAttribute("normal");
      const n = pos.count;
      let idx;
      if (g.index) idx = g.index.array;
      else {
        idx = new Uint32Array(n);
        for (let i = 0; i < n; i++) idx[i] = i;
      }
      // bosselage (sac) : décalage par position, identique pour les sommets confondus
      let jit = null;
      if (opt.jitter) {
        const rnd = PTMT.rng(opt.seed || 7);
        const map = new Map();
        jit = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) {
          const key = pos.getX(i).toFixed(3) + "," + pos.getY(i).toFixed(3) + "," + pos.getZ(i).toFixed(3);
          let d = map.get(key);
          if (!d) map.set(key, (d = [(rnd() - 0.5) * opt.jitter, (rnd() - 0.5) * opt.jitter, (rnd() - 0.5) * opt.jitter]));
          jit[i * 3] = d[0]; jit[i * 3 + 1] = d[1]; jit[i * 3 + 2] = d[2];
        }
      }
      const P = new Float32Array(n * 3), N = new Float32Array(n * 3);
      _n3.getNormalMatrix(_m);
      let cx = 0, cy = 0, cz = 0;
      for (let i = 0; i < n; i++) {
        _v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
        if (jit) _v.set(_v.x + jit[i * 3], _v.y + jit[i * 3 + 1], _v.z + jit[i * 3 + 2]);
        _v.applyMatrix4(_m);
        P[i * 3] = _v.x; P[i * 3 + 1] = _v.y; P[i * 3 + 2] = _v.z;
        cx += _v.x; cy += _v.y; cz += _v.z;
        if (nor) _v2.set(nor.getX(i), nor.getY(i), nor.getZ(i)).applyMatrix3(_n3).normalize();
        else _v2.set(0, 1, 0);
        N[i * 3] = _v2.x; N[i * 3 + 1] = _v2.y; N[i * 3 + 2] = _v2.z;
      }
      const flip = _m.determinant() < 0;
      if (jit || !nor) computeNormals(P, N, idx, flip);
      // couleurs
      const C = new Float32Array(n * 3);
      const base = lin(opt.color === undefined ? 0xffffff : opt.color);
      const gc = opt.colors ? g.getAttribute("color") : null;
      let g0 = null, g1 = null;
      if (opt.grad) { g0 = lin(opt.grad[0]); g1 = lin(opt.grad[1]); }
      for (let i = 0; i < n; i++) {
        let r = base.r, gg = base.g, b = base.b;
        if (gc) { r *= gc.getX(i); gg *= gc.getY(i); b *= gc.getZ(i); }
        if (g0) {
          const y = P[i * 3 + 1];
          const t = Math.max(0, Math.min(1, (y - opt.grad[3]) / (opt.grad[2] - opt.grad[3])));
          r = g1.r + (g0.r - g1.r) * t; gg = g1.g + (g0.g - g1.g) * t; b = g1.b + (g0.b - g1.b) * t;
        }
        C[i * 3] = r; C[i * 3 + 1] = gg; C[i * 3 + 2] = b;
      }
      // peau (indices et poids)
      const SI = new Uint16Array(n * 4), SW = new Float32Array(n * 4);
      if (opt.weights) {
        for (let i = 0; i < n; i++) {
          const ws = opt.weights(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
          let tot = 0;
          for (let k = 0; k < Math.min(4, ws.length); k++) tot += ws[k][1];
          for (let k = 0; k < Math.min(4, ws.length); k++) { SI[i * 4 + k] = this.bone(ws[k][0]); SW[i * 4 + k] = ws[k][1] / (tot || 1); }
        }
      } else {
        const b = this.bone(opt.bone || this.defaultBone);
        for (let i = 0; i < n; i++) { SI[i * 4] = b; SW[i * 4] = 1; }
      }
      this._push(P, N, C, opt.part === undefined ? 0 : opt.part, opt.mat || 0, SI, SW, idx, flip);
      // contour : automatique pour les pièces assez grandes
      let outline = opt.outline;
      if (outline === undefined) {
        cx /= n; cy /= n; cz /= n;
        let rr = 0;
        for (let i = 0; i < n; i++) rr = Math.max(rr, (P[i * 3] - cx) ** 2 + (P[i * 3 + 1] - cy) ** 2 + (P[i * 3 + 2] - cz) ** 2);
        outline = Math.sqrt(rr) >= this.minOutline;
      }
      if (outline) {
        const HN = smoothNormals(P, N, n);
        const t0 = this.tris;
        this._push(P, HN, new Float32Array(n * 3), HULL, 0, SI, SW, idx, !flip);
        this.hullTris += this.tris - t0;
      }
      return this;
    }
    _push(P, N, C, part, mat, SI, SW, idx, flip) {
      const o = this.nv, n = P.length / 3;
      for (let i = 0; i < P.length; i++) { this.P.push(P[i]); this.N.push(N[i]); this.C.push(C[i]); }
      for (let i = 0; i < n; i++) { this.M.push(part, mat); for (let k = 0; k < 4; k++) { this.SI.push(SI[i * 4 + k]); this.SW.push(SW[i * 4 + k]); } }
      for (let i = 0; i < idx.length; i += 3) {
        if (flip) this.I.push(idx[i] + o, idx[i + 2] + o, idx[i + 1] + o);
        else this.I.push(idx[i] + o, idx[i + 1] + o, idx[i + 2] + o);
      }
      this.nv += n;
      this.tris += idx.length / 3;
    }
    build() {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(this.P, 3));
      geo.setAttribute("normal", new THREE.Float32BufferAttribute(this.N, 3));
      geo.setAttribute("color", new THREE.Float32BufferAttribute(this.C, 3));
      geo.setAttribute("aMat", new THREE.Float32BufferAttribute(this.M, 2));
      geo.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(this.SI, 4));
      geo.setAttribute("skinWeight", new THREE.Float32BufferAttribute(this.SW, 4));
      geo.setIndex(new THREE.BufferAttribute(this.nv > 65535 ? new Uint32Array(this.I) : new Uint16Array(this.I), 1));
      return geo;
    }
    get triangles() {
      return this.tris;
    }
  }
  A.Builder = Builder;

  /** Normales lissées par position (coutures fermées) : la coque gonflée ne se fend pas aux arêtes. */
  function smoothNormals(P, N, n) {
    const out = new Float32Array(n * 3);
    const map = new Map();
    const keys = new Array(n);
    for (let i = 0; i < n; i++) {
      const key = Math.round(P[i * 3] * 2000) + "," + Math.round(P[i * 3 + 1] * 2000) + "," + Math.round(P[i * 3 + 2] * 2000);
      keys[i] = key;
      let a = map.get(key);
      if (!a) map.set(key, (a = [0, 0, 0]));
      a[0] += N[i * 3]; a[1] += N[i * 3 + 1]; a[2] += N[i * 3 + 2];
    }
    for (let i = 0; i < n; i++) {
      const a = map.get(keys[i]);
      const l = Math.hypot(a[0], a[1], a[2]) || 1;
      out[i * 3] = a[0] / l; out[i * 3 + 1] = a[1] / l; out[i * 3 + 2] = a[2] / l;
    }
    return out;
  }
  /** Normales recalculées (pièces bosselées), pondérées par l'aire des triangles. */
  function computeNormals(P, N, idx, flip) {
    N.fill(0);
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (let i = 0; i < idx.length; i += 3) {
      const i0 = idx[i], i1 = idx[i + 1], i2 = idx[i + 2];
      a.set(P[i1 * 3] - P[i0 * 3], P[i1 * 3 + 1] - P[i0 * 3 + 1], P[i1 * 3 + 2] - P[i0 * 3 + 2]);
      b.set(P[i2 * 3] - P[i0 * 3], P[i2 * 3 + 1] - P[i0 * 3 + 1], P[i2 * 3 + 2] - P[i0 * 3 + 2]);
      c.crossVectors(a, b);
      if (flip) c.negate();
      for (const k of [i0, i1, i2]) { N[k * 3] += c.x; N[k * 3 + 1] += c.y; N[k * 3 + 2] += c.z; }
    }
    for (let i = 0; i < N.length; i += 3) {
      const l = Math.hypot(N[i], N[i + 1], N[i + 2]) || 1;
      N[i] /= l; N[i + 1] /= l; N[i + 2] /= l;
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Matière partagée (tous les ennemis) : couleurs de sommets franches, motifs, états, contour
  // ---------------------------------------------------------------------------------------------
  // Parties (aMat.x) : 0 uni, 2 rayures horizontales crème, 3 coutil (rayures verticales sur crème),
  // 4 blanc des yeux, 5 pupille, 30 coque de contour. Classes (aMat.y) : 0 mat, 1 satiné, 2 brillant,
  // 3 métal, 4 lumineux, 5 grille chauffée, 6 or, 7 verre sombre.
  const VERT_PARS = /* glsl */ `
    attribute vec2 aMat;
    varying vec2 vMat;
    varying vec3 vRest;
    varying vec4 vFx0;
    varying vec4 vFx1;
    uniform vec4 uOutline;
  `;
  const VERT_SKIN = /* glsl */ `
    vMat = aMat;
    vRest = position;
    #ifdef USE_SKINNING
      mat4 ptData = getBoneMatrix(0.0);
      vFx0 = ptData[0]; vFx1 = ptData[1];
    #else
      vFx0 = vec4(0.0); vFx1 = vec4(0.0);
    #endif
  `;
  const VERT_HULL = /* glsl */ `
    if (aMat.x > 29.5) {
      // coque : poussée vers l'extérieur à l'écran, un peu plus épaisse de près (1,1 à 2,6 px)
      float ptW = max(gl_Position.w, 0.001);
      float ptPx = clamp(0.036 * projectionMatrix[1][1] * uOutline.y * 0.5 / ptW / max(uOutline.z, 0.5), 1.1, 2.6) * uOutline.z * uOutline.w;
      vec3 ptNv = normalize(transformedNormal);
      gl_Position.xy += ptNv.xy * ptPx * 2.0 / uOutline.xy * ptW;
    }
  `;
  const FRAG_PARS = /* glsl */ `
    varying vec2 vMat;
    varying vec3 vRest;
    varying vec4 vFx0;
    varying vec4 vFx1;
    uniform float uTime;
    ${"PTMT_NOISE"}
    float ptBayer(vec2 p){
      vec2 q = mod(floor(p), 4.0);
      float i = q.x + q.y * 4.0;
      float b = mod(i * 7.0 + floor(i / 4.0) * 5.0, 16.0);
      return (b + 0.5) / 16.0;
    }
  `;
  const FRAG_COLOR = /* glsl */ `
    #include <color_fragment>
    float ptPart = floor(vMat.x + 0.5);
    float ptCls = floor(vMat.y + 0.5);
    float ptHull = step(29.5, ptPart);
    // fantôme (fumigène) et dissolution (K.-O.) : transparence tramée, sans tri
    float ptGhost = vFx1.x, ptDiss = vFx1.y;
    if (ptGhost > 0.01 && ptBayer(gl_FragCoord.xy) < ptGhost * 0.82) discard;
    float ptN = 0.0;
    if (ptDiss > 0.001) { ptN = ptNoise3(vRest * 7.0); if (ptN < ptDiss) discard; }
    vec3 ptAlb = diffuseColor.rgb;
    // motifs fondus au loin (pas de moiré vu d'avion)
    float ptNear = smoothstep(75.0, 32.0, length(vViewPosition));
    vec3 ptCream = vec3(0.86, 0.82, 0.72);
    if (ptPart > 1.5 && ptPart < 2.5) {
      float st = step(0.5, fract(vRest.y * 7.0));
      ptAlb = mix(mix(ptAlb, ptCream, 0.42), mix(ptAlb, ptCream, st), ptNear);
    } else if (ptPart > 2.5 && ptPart < 3.5) {
      float st = step(0.6, fract(vRest.x * 5.5 + 0.2));
      ptAlb = mix(mix(ptCream, ptAlb, 0.35), mix(ptCream, ptAlb, st), ptNear);
    }
    // états : gelé, mouillé, brûlé, éclair de coup
    float ptFlash = vFx0.x, ptWet = vFx0.y, ptFrozen = vFx0.z, ptBurn = vFx0.w;
    ptAlb = mix(ptAlb, vec3(0.62, 0.86, 1.0), ptFrozen * 0.5);
    ptAlb *= 1.0 - 0.3 * ptWet;
    ptAlb *= 1.0 - 0.55 * ptBurn * (0.6 + 0.4 * ptNoise(vRest.xy * 12.0));
    ptAlb = mix(ptAlb, vec3(1.0), ptFlash * 0.55);
    if (ptGhost > 0.01) ptAlb = mix(ptAlb, vec3(0.32, 0.26, 0.42), ptGhost * 0.7);
    diffuseColor.rgb = ptAlb;
    // contour : sombre, bleuté quand gelé, clair à l'éclair du coup
    vec3 ptLine = mix(vec3(0.028, 0.022, 0.04), vec3(0.12, 0.3, 0.5), ptFrozen * 0.7);
    ptLine = mix(ptLine, vec3(1.0, 0.92, 0.7), ptFlash * 0.65);
  `;
  const FRAG_ROUGH = /* glsl */ `
    roughnessFactor = ptCls < 0.5 ? 0.8 : (ptCls < 1.5 ? 0.55 : (ptCls < 2.5 ? 0.32 : (ptCls < 3.5 ? 0.34 : (ptCls < 6.5 ? 0.38 : 0.16))));
    if (ptPart > 4.5 && ptPart < 5.5) roughnessFactor = 0.18;
    roughnessFactor *= 1.0 - 0.55 * ptWet;
  `;
  const FRAG_METAL = /* glsl */ `
    metalnessFactor = ptCls > 2.5 && ptCls < 3.5 ? 0.5 : (ptCls > 5.5 && ptCls < 6.5 ? 0.35 : 0.0);
  `;
  const FRAG_EMISSIVE = /* glsl */ `
    {
      vec3 ptV = normalize(vViewPosition);
      float ptFres = pow(1.0 - clamp(abs(dot(normalize(vNormal), ptV)), 0.0, 1.0), 2.5);
      // teintes franches même côté ombre (éclairage de dessin animé) + fin liseré clair
      totalEmissiveRadiance += diffuseColor.rgb * 0.17;
      totalEmissiveRadiance += vec3(1.0, 0.97, 0.9) * ptFres * 0.08;
      if (ptPart > 3.5 && ptPart < 4.5) totalEmissiveRadiance += diffuseColor.rgb * 0.32;
      if (ptCls > 3.5 && ptCls < 4.5) totalEmissiveRadiance += diffuseColor.rgb * 1.4;
      float ptHeat = vFx1.z;
      if (ptCls > 4.5 && ptCls < 5.5) totalEmissiveRadiance += vec3(1.0, 0.28, 0.04) * ptHeat * (2.0 + 0.6 * sin(uTime * 9.0));
      if (ptCls > 5.5 && ptCls < 6.5) totalEmissiveRadiance += vec3(1.0, 0.6, 0.1) * (0.2 + 1.3 * ptFres) * (0.85 + 0.15 * sin(uTime * 4.0));
      totalEmissiveRadiance += vec3(1.0, 0.96, 0.9) * ptFlash * 0.9;
      totalEmissiveRadiance += vec3(1.0, 0.36, 0.05) * ptBurn * (0.14 + 0.12 * sin(uTime * 23.0 + vRest.y * 6.0));
      totalEmissiveRadiance += vec3(0.4, 0.75, 1.0) * ptFrozen * 0.12;
      if (ptDiss > 0.001 && ptN < ptDiss + 0.07) totalEmissiveRadiance += vec3(1.0, 0.9, 0.55) * 2.5;
    }
  `;
  const FRAG_OUT = /* glsl */ `
    if (ptHull > 0.5) gl_FragColor.rgb = ptLine;
    #include <tonemapping_fragment>
  `;

  let bodyMat = null;
  function bodyMaterial() {
    if (bodyMat) return bodyMat;
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, skinning: true, roughness: 0.8, metalness: 0 });
    m.name = "ptmt:actor";
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = A._timeUniform;
      sh.uniforms.uOutline = A._outline;
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\n" + VERT_PARS)
        .replace("#include <skinning_vertex>", "#include <skinning_vertex>\n" + VERT_SKIN)
        .replace("#include <project_vertex>", "#include <project_vertex>\n" + VERT_HULL);
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\n" + FRAG_PARS.replace("PTMT_NOISE", PTMT.gfx.GLSL.noise))
        .replace("#include <color_fragment>", FRAG_COLOR)
        .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\n" + FRAG_ROUGH)
        .replace("#include <metalnessmap_fragment>", "#include <metalnessmap_fragment>\n" + FRAG_METAL)
        .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n" + FRAG_EMISSIVE)
        .replace("#include <tonemapping_fragment>", FRAG_OUT);
    };
    m.customProgramCacheKey = () => "ptmt-actor-chibi-v1";
    bodyMat = m;
    return m;
  }
  /** Ombre portée : la coque de contour est écartée (sommets rejetés hors champ). */
  let depthMat = null;
  function depthMaterial() {
    if (depthMat) return depthMat;
    const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, skinning: true });
    m.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nattribute vec2 aMat;")
        .replace("#include <project_vertex>", "#include <project_vertex>\nif (aMat.x > 29.5) gl_Position = vec4(0.0, 0.0, 2.0, 1.0);");
    };
    m.customProgramCacheKey = () => "ptmt-actor-depth-v1";
    depthMat = m;
    return m;
  }

  /** Rideau de douche translucide (ninja élite) : matière à part, battement dans le vertex shader. */
  function makeCapeMaterial(top, len) {
    return PTMT.mat("actors:cape:" + top + ":" + len, () => {
      const c = document.createElement("canvas");
      c.width = c.height = 256;
      const x = c.getContext("2d");
      x.fillStyle = "rgba(150,220,255,0.62)"; x.fillRect(0, 0, 256, 256);
      // plis verticaux, petits canards jaunes et bulles
      for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? "rgba(255,255,255,0.16)" : "rgba(40,120,200,0.12)"; x.fillRect(i * 32, 0, 16, 256); }
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
        const cx = 42 + i * 86 + (j % 2) * 26, cy = 42 + j * 86;
        x.fillStyle = "#ffd21f"; x.beginPath(); x.ellipse(cx, cy + 8, 22, 15, 0, 0, Math.PI * 2); x.fill();
        x.beginPath(); x.arc(cx + 14, cy - 10, 12, 0, Math.PI * 2); x.fill();
        x.fillStyle = "#ff8a1f"; x.beginPath(); x.moveTo(cx + 24, cy - 12); x.lineTo(cx + 36, cy - 8); x.lineTo(cx + 24, cy - 4); x.fill();
        x.fillStyle = "#111"; x.beginPath(); x.arc(cx + 16, cy - 13, 2.6, 0, Math.PI * 2); x.fill();
        x.strokeStyle = "rgba(255,255,255,0.95)"; x.lineWidth = 3; x.beginPath(); x.arc(cx - 26, cy + 30, 7, 0, Math.PI * 2); x.stroke();
      }
      x.fillStyle = "rgba(255,255,255,0.85)"; x.fillRect(0, 0, 256, 10);
      const tex = new THREE.CanvasTexture(c);
      tex.encoding = THREE.sRGBEncoding;
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      const m = new THREE.MeshStandardMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, skinning: true, roughness: 0.25, metalness: 0, depthWrite: false });
      m.name = "ptmt:actor:cape";
      m.onBeforeCompile = (sh) => {
        sh.uniforms.uTime = A._timeUniform;
        sh.vertexShader = sh.vertexShader
          .replace("#include <common>", "#include <common>\nuniform float uTime;")
          .replace(
            "#include <skinning_vertex>",
            `#include <skinning_vertex>
            {
              float hang = clamp((${top.toFixed(3)} - position.y) / ${len.toFixed(3)}, 0.0, 1.0);
              float spd = 0.0;
              #ifdef USE_SKINNING
                spd = getBoneMatrix(0.0)[2].x;
              #endif
              float wave = sin(uTime * (5.0 + spd * 4.0) + position.y * 5.0 + position.x * 4.0);
              transformed.z -= hang * hang * (0.14 + spd * 0.55 + 0.06 * wave);
              transformed.y += hang * hang * spd * 0.18;
              transformed.x += hang * 0.05 * sin(uTime * 3.0 + position.y * 3.0);
            }`,
          );
      };
      m.customProgramCacheKey = () => "ptmt-cape-chibi-v1";
      return m;
    });
  }

  // ---------------------------------------------------------------------------------------------
  // Gabarit d'une variante : squelette, géométrie fusionnée, statistiques
  // ---------------------------------------------------------------------------------------------
  function templateFor(type, elite) {
    const key = type + (elite ? ":elite" : "");
    let tpl = TEMPLATES.get(key);
    if (tpl) return tpl;
    const spec = A.variantSpec(type, elite);
    // squelette : corps + accessoires (positions de liaison dans l'espace du personnage)
    const bones = spec.skeleton.map((b) => ({ name: b.name, parent: b.parent, pos: b.pos.slice() }));
    for (const pd of spec.propDefs) bones.push({ name: "p_" + pd.name, parent: pd.parent === undefined ? "root" : pd.parent, pos: pd.pos.slice(), prop: true });
    if (spec.sack) bones.push({ name: "p_sack", parent: spec.sack.parent, pos: spec.sack.pos.slice(), prop: true });
    const world = {};
    for (const b of bones) world[b.name] = b.pos;
    for (const b of bones) {
      const pp = b.parent ? world[b.parent] : ZERO3;
      b.local = [b.pos[0] - pp[0], b.pos[1] - pp[1], b.pos[2] - pp[2]];
    }
    const k = new Builder(bones.map((b) => b.name));
    for (const b of spec.builds) if (b) b(k, spec);
    const bodyTris = k.tris;
    const props = {};
    for (const pd of spec.propDefs) {
      const t0 = k.tris;
      k.defaultBone = "p_" + pd.name;
      pd.build(k, spec);
      props[pd.name] = k.tris - t0;
    }
    if (spec.sack) {
      const t0 = k.tris;
      k.defaultBone = "p_sack";
      const sp = spec.sack.pos;
      PTMT.gfx.addSack(k, { bone: "p_sack", pos: sp, rot: spec.sack.rot || ZERO3, scale: spec.sack.scale || 1 });
      props.sack = k.tris - t0;
    }
    k.defaultBone = "root";
    const geo = k.build();
    const d = spec.dims, sc = spec.scale || 1;
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, (d.h / sc) * 0.45, 0), Math.max(d.w, d.h, d.d) / sc * 0.75 + 0.8);
    geo.boundingBox = new THREE.Box3(new THREE.Vector3(-d.w / sc, 0, -d.d / sc), new THREE.Vector3(d.w / sc, (d.h / sc) * 1.2, d.d / sc));
    // os : inverses de liaison (translations pures), os de données en tête
    const inverses = [new THREE.Matrix4()];
    for (const b of bones) inverses.push(new THREE.Matrix4().makeTranslation(-b.pos[0], -b.pos[1], -b.pos[2]));
    // rideau de douche (ninja élite) : maillage translucide séparé sur le même squelette
    let cape = null;
    if (spec.cape) {
      const cs = spec.cape;
      const cg = new THREE.PlaneGeometry(cs.w, cs.len, 6, 8);
      cg.rotateY(Math.PI);
      cg.translate(0, cs.top - cs.len / 2, cs.z);
      const cp = cg.getAttribute("position");
      for (let i = 0; i < cp.count; i++) {
        const y = cp.getY(i), x = cp.getX(i);
        // s'évase vers le bas, épouse le dos en haut
        const t = (cs.top - y) / cs.len;
        cp.setX(i, x * (0.72 + 0.5 * t));
        cp.setZ(i, cp.getZ(i) - 0.06 * t - Math.pow(Math.abs(x) * 1.4, 2) * 0.16 * (1 - t));
      }
      cg.computeVertexNormals();
      const n2 = cp.count;
      const si = new Uint16Array(n2 * 4), sw = new Float32Array(n2 * 4);
      const bb = k.bone("body");
      for (let i = 0; i < n2; i++) { si[i * 4] = bb; sw[i * 4] = 1; }
      cg.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(si, 4));
      cg.setAttribute("skinWeight", new THREE.BufferAttribute(sw, 4));
      cg.boundingSphere = geo.boundingSphere.clone();
      cape = { geometry: cg, material: makeCapeMaterial(cs.top, cs.len) };
    }
    const capeTris = cape ? cape.geometry.index.count / 3 : 0;
    tpl = {
      key, type, elite: !!elite, spec, geometry: geo, bones, boneInverses: inverses, cape,
      stats: {
        triangles: k.tris + capeTris,
        bodyTriangles: bodyTris,
        accessoryTriangles: k.tris - bodyTris,
        outlineTriangles: k.hullTris,
        props,
        vertices: k.nv,
        bones: bones.length + 1,
        drawCalls: cape ? 2 : 1,
      },
    };
    TEMPLATES.set(key, tpl);
    return tpl;
  }

  // ---------------------------------------------------------------------------------------------
  // Poses de bras (bras gauche, +X ; le droit s'obtient par symétrie : y et z changent de signe)
  // [bras x, y, z, avant-bras x, y, z, main x, y, z, étirement] — x < 0 : vers l'avant / le haut
  // ---------------------------------------------------------------------------------------------
  const ARM = {
    rest: [0.05, 0, 0.14, -0.22, 0, 0, 0, 0, 0, 1],
    overhead: [-2.98, 0, 0.16, -0.12, 0, 0, -0.5, 0, 0, 1.85],
    carryR: [-2.95, 0, 0.18, -0.2, 0, 0, -0.5, 0, 0, 1.75],
    cheer: [-2.55, 0, 0.8, -0.2, 0, 0, 0, 0, 0, 1.4],
    mattress: [-2.92, 0, 0.3, -0.22, 0, 0, -0.45, 0, 0, 1.75],
    shield: [-1.35, 0, 0.3, -0.35, 0, 0, 0.2, 0, 0, 1.3],
    waist: [-0.45, 0, 0.62, -1.05, 0, 0, 0.3, 0, 0, 1.05],
    sneak: [-1.1, 0, 0.38, -1.6, 0, 0, 0.75, 0, 0, 1],
    naruto: [1.2, 0, 0.28, -0.12, 0, 0, 0.35, 0, 0, 1.12],
    reach: [-1.5, 0, 0.12, -0.12, 0, 0, -0.25, 0, 0, 1.35],
    fist: [-2.75, 0, 0.3, -1.25, 0, 0, 0, 0, 0, 1.15],
    hip: [0.3, 0, 0.75, -1.95, 0, 0, 0, 0, 0, 1],
    shrug: [-0.25, 0, 1.05, -1.35, 0, 0, 0.3, 0, 0, 1],
    drive: [-1.2, 0, 0.26, -0.75, 0, 0, 0, 0, 0, 1.15],
    pedal: [-1.05, 0, 0.3, -0.9, 0, 0, 0, 0, 0, 1.1],
    boatUp: [-0.35, 0, 0.78, -0.75, 0, 0, 0.2, 0, 0, 1.1],
    flailA: [-2.9, 0, 0.9, -0.4, 0, 0, 0, 0, 0, 1.2],
    flailB: [-2.05, 0, 1.75, -0.95, 0, 0, 0, 0, 0, 1.2],
    swimA: [-2.3, 0, 0.35, -0.35, 0, 0, 0, 0, 0, 1.15],
    swimB: [-1.05, 0, 0.4, -1.4, 0, 0, 0, 0, 0, 1.15],
    digA: [-1.45, 0, 0.18, -0.55, 0, 0, 0.3, 0, 0, 1.3],
    digB: [-0.65, 0, 0.3, -1.35, 0, 0, 0.3, 0, 0, 1.3],
    koA: [-2.6, 0, 1.2, -0.3, 0, 0, 0, 0, 0, 1.1],
  };
  A.ARM_POSES = ARM;
  // Démarches : longueur de cycle (m), amplitude des jambes, genoux, rebond, bras, penchée, roulis…
  const GAIT = {
    walk: { stride: 1.15, leg: 0.6, knee: 0.95, bob: 0.08, arm: 0.65, fore: 0.35, lean: 0.12, roll: 0.06, twist: 0.12 },
    sneak: { stride: 1.25, leg: 0.62, knee: 1.55, bob: 0.1, arm: 0.12, fore: 0.1, lean: 0.34, roll: 0.07, twist: 0.1, crouch: 0.06 },
    jog: { stride: 1.45, leg: 0.8, knee: 1.35, bob: 0.1, arm: 0.9, fore: 1.25, lean: 0.24, roll: 0.05, twist: 0.16 },
    run: { stride: 1.75, leg: 0.95, knee: 1.55, bob: 0.13, arm: 1.15, fore: 1.45, lean: 0.3, roll: 0.05, twist: 0.2 },
    heavy: { stride: 0.8, leg: 0.42, knee: 0.6, bob: 0.05, arm: 0.3, fore: 0.3, lean: 0.1, roll: 0.13, twist: 0.06 },
    skate: { stride: 2.6, leg: 0.22, knee: 0.45, bob: 0.03, arm: 0.95, fore: 0.3, lean: 0.34, roll: 0.14, twist: 0.26, skate: 1 },
    waddle: { stride: 0.85, leg: 0.48, knee: 1.05, bob: 0.07, arm: 0.3, fore: 0.3, lean: 0.0, roll: 0.17, twist: 0.05, flap: 1 },
    drive: { stride: 1.2, leg: 0, knee: 0, bob: 0, arm: 0, fore: 0, lean: 0, roll: 0, twist: 0 },
  };
  A.GAITS = GAIT;

  // ---------------------------------------------------------------------------------------------
  // Ennemi
  // ---------------------------------------------------------------------------------------------
  const EMPTY = {};
  let _uid = 1;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const smooth = (cur, target, dt, rate) => cur + (target - cur) * (1 - Math.exp(-dt * rate));
  const ease = (t) => t * t * (3 - 2 * t);
  const REACT = {
    hit: 0.28, knockback: 0.85, pull: 0.95, ko: 1.75, steal: 0.7, drop: 0.7, helmetOff: 0.9, flipflops: 0.8,
    smokePuff: 0.45, overheat: 1.0, rage: 1.25, splash: 0.5, fooled: 1.0,
  };
  A.KO_DURATION = REACT.ko;
  const NB = BODY.length;
  const ORDER_YXZ = new Set([BI.root, BI.hips, BI.body, BI.head]);
  const IDENTITY = new THREE.Matrix4();

  class Actor {
    constructor(tpl) {
      this.id = _uid++;
      this.tpl = tpl;
      this.spec = tpl.spec;
      this.type = tpl.type;
      this.elite = tpl.elite;
      this.label = tpl.spec.label;
      this.height = tpl.spec.height;
      this.dims = tpl.spec.dims;
      this.scale = tpl.spec.scale || 1;
      /** Vitesse (m/s) de démonstration (galerie) : celle du jeu pour ce type. */
      this.naturalSpeed = tpl.spec.motion.natural;
      this.gait = Object.assign({}, GAIT[tpl.spec.motion.gait || "walk"], tpl.spec.motion.gaitOver || null);
      this.object = new THREE.Group();
      this.object.name = "ptmt:actor:" + tpl.key;
      this.rig = new THREE.Group();
      this.rig.name = "rig";
      this.object.add(this.rig);
      this.dataBone = new THREE.Bone();
      this.dataBone.name = "ptmt:data";
      this.dataBone.matrixAutoUpdate = false;
      const list = [this.dataBone];
      this.B = {};
      this.rest = {};
      for (const b of tpl.bones) {
        const bone = new THREE.Bone();
        bone.name = b.name;
        bone.position.fromArray(b.local);
        (b.parent ? this.B[b.parent] : this.rig).add(bone);
        this.B[b.name] = bone;
        this.rest[b.name] = new THREE.Vector3().fromArray(b.local);
        list.push(bone);
      }
      this.skeleton = new THREE.Skeleton(list, tpl.boneInverses);
      this.mesh = new THREE.SkinnedMesh(tpl.geometry, bodyMaterial());
      this.mesh.name = "ptmt:actor:mesh";
      this.mesh.bind(this.skeleton, IDENTITY);
      this.mesh.customDepthMaterial = depthMaterial();
      // mobile : pas d'ombre projetée (l'ombre douce au sol suffit)
      this.mesh.castShadow = !A.mobile;
      this.mesh.receiveShadow = false;
      this.mesh.onBeforeRender = onBeforeRender;
      this.rig.add(this.mesh);
      if (tpl.cape) {
        this.cape = new THREE.SkinnedMesh(tpl.cape.geometry, tpl.cape.material);
        this.cape.bind(this.skeleton, IDENTITY);
        this.cape.renderOrder = 2;
        this.rig.add(this.cape);
      }
      this.bones = BODY.map((n) => this.B[n]);
      this.restArr = BODY.map((n) => this.rest[n]);
      this.orders = BODY.map((n, i) => (ORDER_YXZ.has(i) ? "YXZ" : "XYZ"));
      // repères pour les effets : centre de la tête et poitrine dans le repère de leur os
      const bpos = {};
      for (const b of tpl.bones) bpos[b.name] = b.pos;
      const hc = this.spec.headC, p = this.spec.p;
      this.offsets = {
        head: new THREE.Vector3(hc[0] - bpos.head[0], hc[1] - bpos.head[1], hc[2] - bpos.head[2]),
        chest: new THREE.Vector3(0, p.chest - 0.3 - bpos.body[1], 0.1),
      };
      // tableaux de pose (aucune allocation par image)
      this.pr = new Float32Array(NB * 3);
      this.pt = new Float32Array(NB * 3);
      this.ps = new Float32Array(NB * 3);
      this.armCur = { l: new Float32Array(10), r: new Float32Array(10) };
      this.armTmp = new Float32Array(10);
      this.w = {};
      this.fly = {};
      this.face = { open: 1, wide: 1, tilt: 0, up: 0, mouth: 0, grin: 1, lookX: 0, lookY: 0, tx: 0, ty: 0, lookT: 0, blinkT: 2, blink: 0, dizzy: 0 };
      this.anchor = { head: new THREE.Vector3(), headTop: new THREE.Vector3(), chest: new THREE.Vector3(), sack: new THREE.Vector3(), exhaust: new THREE.Vector3(), feet: new THREE.Vector3(), fwd: new THREE.Vector3(), right: new THREE.Vector3(), eyeL: new THREE.Vector3(), eyeR: new THREE.Vector3() };
      this.reset();
    }

    reset() {
      this.object.visible = true;
      this.object.position.set(0, 0, 0);
      this.object.rotation.set(0, 0, 0);
      this.object.scale.set(1, 1, 1);
      this.rig.position.set(0, 0, 0);
      this.rig.quaternion.identity();
      this.rig.scale.setScalar(this.scale);
      const w = this.w;
      for (const k of ["carry", "frozen", "wet", "burn", "net", "lure", "ghost", "heat", "boost", "water", "armL", "armR", "flash", "lean", "move", "diss", "steal", "scared"]) w[k] = 0;
      this.prev = { carrying: false, hitFlash: 0 };
      this.react = null;
      this.reactT = 0;
      this.finished = false;
      this.ko = false;
      this.speed = 0;
      this.phase = Math.random() * TAU;
      this.idleT = Math.random() * 10;
      this.wheelA = 0;
      this.spin = 0;
      this.helmetGone = false;
      this.flipGone = false;
      this.sackPop = 1;
      this.lureKind = this.id % 2 ? "heart" : "dollar";
      this.lookT = 0;
      this.look = [0, 0];
      this.lookTo = [0, 0];
      this.emitT = {};
      this.time = 0;
      this.state = EMPTY;
      this._poofed = false;
      for (const k in this.fly) this._landProp(k);
      for (const b of this.tpl.bones) {
        const bone = this.B[b.name];
        bone.position.copy(this.rest[b.name]);
        bone.quaternion.identity();
        bone.scale.set(1, 1, 1);
      }
      this.armCur.l.set(ARM.rest);
      this.armCur.r.set(ARM.rest);
      const f = this.face;
      f.open = 1; f.wide = 1; f.tilt = 0; f.up = 0; f.mouth = 0; f.grin = 1; f.lookX = 0; f.lookY = 0; f.tx = 0; f.ty = 0; f.lookT = 0; f.blinkT = 1 + Math.random() * 3; f.blink = 0; f.dizzy = 0;
      this._pose(0.016, EMPTY, false, 0, false, null, 0);
      this._writeData(0, 0);
    }

    // --- événements ponctuels ------------------------------------------------------------------
    event(name) {
      if (this.ko && name !== "ko") return;
      const ov = A.overlay;
      switch (name) {
        case "ko":
          if (this.ko) return;
          this.ko = true;
          this._react("ko");
          break;
        case "helmetOff":
          if (!this.B.p_helmet || this.helmetGone) return;
          this.helmetGone = true;
          this._launchProp("helmet", 1.6, 4.6, -1.4, 14);
          this._react("helmetOff");
          break;
        case "flipflops":
          if (!this.B.p_flip_l || this.flipGone) return;
          this.flipGone = true;
          this._launchProp("flip_l", 0.9, 3.8, -1.8, 18);
          this._launchProp("flip_r", -0.9, 4.1, -1.6, -16);
          this._react("flipflops");
          break;
        case "smokePuff":
        case "splash":
          // effet seul : n'interrompt pas l'animation en cours
          break;
        case "hit":
          if (!this.react || this.react === "hit") this._react("hit");
          break;
        default:
          if (REACT[name] === undefined) return;
          this._react(name);
      }
      if (ov && ov.burst) ov.burst(this, name);
    }
    _react(name) {
      this.react = name;
      this.reactT = 0;
    }
    /** Fait décoller un accessoire (casserole, claquettes) dans le repère de la scène. */
    _launchProp(name, side, up, back, spin) {
      const bone = this.B["p_" + name];
      const scene = this.object.parent;
      if (!bone || !scene) { if (bone) bone.scale.setScalar(0); return; }
      this.object.updateMatrixWorld(true);
      bone.matrixWorld.decompose(_v, _q, _v2);
      const f = { bone, parent: bone.parent, t: 0, pos: _v.clone(), quat: _q.clone(), scl: _v2.clone(), vel: new THREE.Vector3(), spin: new THREE.Vector3(spin, spin * 0.4, spin * 0.25), ground: this.object.position.y };
      const yaw = this.object.rotation.y;
      const fx = Math.sin(yaw), fz = Math.cos(yaw);
      f.vel.set(fz * side * 0.6 + fx * back * 0.5, up, -fx * side * 0.6 + fz * back * 0.5);
      scene.attach(bone);
      this.fly[name] = f;
    }
    _landProp(name) {
      const f = this.fly[name];
      if (!f) return;
      f.parent.add(f.bone);
      f.bone.position.copy(this.rest[f.bone.name]);
      f.bone.quaternion.identity();
      f.bone.scale.set(0, 0, 0);
      delete this.fly[name];
    }
    _updateFly(dt) {
      for (const k in this.fly) {
        const f = this.fly[k];
        f.t += dt;
        f.vel.y -= 13 * dt;
        f.pos.addScaledVector(f.vel, dt);
        if (f.pos.y < f.ground + 0.05 && f.vel.y < 0) {
          f.pos.y = f.ground + 0.05;
          f.vel.multiplyScalar(0.45);
          f.vel.y = -f.vel.y * 0.8;
          f.spin.multiplyScalar(0.5);
        }
        _e.set(f.spin.x * dt, f.spin.y * dt, f.spin.z * dt, "XYZ");
        f.quat.multiply(_q.setFromEuler(_e));
        const shrink = f.t > 1.3 ? Math.max(0, 1 - (f.t - 1.3) / 0.25) : 1;
        f.bone.position.copy(f.pos);
        f.bone.quaternion.copy(f.quat);
        f.bone.scale.copy(f.scl).multiplyScalar(shrink);
        if (shrink <= 0) this._landProp(k);
      }
    }

    // --- mise à jour -------------------------------------------------------------------------
    update(dt, time, s) {
      s = s || EMPTY;
      dt = clamp(dt || 0, 0, 0.1);
      this.time = time;
      this.state = s;
      A._timeUniform.value = time;
      const ov = A.overlay;
      if (ov && ov.frame) ov.frame(time, this.object);
      const mo = this.spec.motion, w = this.w;

      // réaction en cours
      let react = this.react;
      if (react) {
        this.reactT += dt;
        if (this.reactT >= REACT[react]) {
          if (react === "ko") this.finished = true;
          else this.react = react = null;
        }
      }
      // coup reçu (éclair) : petit sursaut, même sans événement explicite
      const hf = s.hitFlash || 0;
      if (hf > this.prev.hitFlash + 0.35 && !this.ko && (!react || react === "hit")) { this._react("hit"); react = "hit"; }
      this.prev.hitFlash = hf;
      const rt = this.reactT;
      const moving = !!s.moving && !this.ko;
      const speed = moving ? Math.max(0, s.speed === undefined ? mo.natural : s.speed) : 0;
      this.speed = speed;
      const inWater = !!s.inWater;
      const frozen = !!s.frozen && !this.ko;

      // poids lissés
      w.carry = smooth(w.carry, s.carrying ? 1 : 0, dt, 9);
      w.frozen = smooth(w.frozen, frozen ? 1 : 0, dt, 14);
      w.wet = smooth(w.wet, s.wet ? 1 : 0, dt, 3);
      w.burn = smooth(w.burn, s.burning ? 1 : 0, dt, 6);
      w.net = smooth(w.net, s.netted ? 1 : 0, dt, 10);
      w.lure = smooth(w.lure, s.lured ? 1 : 0, dt, 8);
      w.ghost = smooth(w.ghost, s.untargetable ? 1 : 0, dt, 6);
      w.heat = smooth(w.heat, s.overheated ? 1 : 0, dt, 3);
      w.boost = smooth(w.boost, s.boosted ? 1 : 0, dt, 6);
      w.water = smooth(w.water, inWater ? 1 : 0, dt, 5);
      w.move = smooth(w.move, moving ? 1 : 0, dt, 7);
      w.steal = smooth(w.steal, s.stealing && !moving ? 1 : 0, dt, 8);
      w.flash = Math.max(hf, react === "hit" ? Math.max(0, 1 - rt / REACT.hit) * 0.8 : 0);
      if (s.carrying && !this.prev.carrying) this.sackPop = 0;
      this.sackPop = Math.min(1, this.sackPop + dt / 0.35);
      this.prev.carrying = !!s.carrying;

      const solid = frozen && w.frozen > 0.98;
      if (!solid) this._pose(dt, s, moving, speed, inWater, react, rt);
      this._rigLayer(dt, s, moving, speed, inWater, react, rt, solid);
      this._props(dt, s, moving, speed, inWater, react, rt);
      this._updateFly(dt);
      w.diss = react === "ko" ? clamp((rt - 1.25) / 0.45, 0, 1) : 0;
      this._writeData(w.flash, speed);
      if (ov && ov.actor) ov.actor(this, dt, s);
    }

    // --- pose du squelette (couches : démarche, bras, réactions, visage) ------------------------
    _pose(dt, s, moving, speed, inWater, react, rt) {
      const pr = this.pr, pt = this.pt, ps = this.ps;
      pr.fill(0);
      pt.fill(0);
      ps.fill(1);
      const mo = this.spec.motion, g = this.gait, w = this.w;
      const t = this.time;
      const R = (b, x, y, z) => { pr[b * 3] += x; pr[b * 3 + 1] += y; pr[b * 3 + 2] += z; };
      const T = (b, x, y, z) => { pt[b * 3] += x; pt[b * 3 + 1] += y; pt[b * 3 + 2] += z; };
      const swim = mo.swims && inWater && !mo.boat;
      const boatIn = mo.boat && inWater;
      const seated = mo.vehicle || boatIn;
      const ko = react === "ko";

      // 1) démarche
      let amp = w.move;
      if (seated || swim) amp = 0;
      const rate = moving ? Math.max(0.55, speed / g.stride) * (s.burning ? 1.3 : 1) : 0;
      this.phase += dt * rate * TAU;
      this.idleT += dt;
      const ph = this.phase;
      const sn = Math.sin(ph), cs = Math.cos(ph);
      if (!seated && !swim) {
        for (let si = 0; si < 2; si++) {
          const p = ph + (si ? Math.PI : 0), sp = Math.sin(p), cp = Math.cos(p);
          const th = si ? BI.thigh_r : BI.thigh_l, sh = si ? BI.shin_r : BI.shin_l, ft = si ? BI.foot_r : BI.foot_l;
          const sg = si ? -1 : 1;
          if (g.skate) {
            // patin : poussée latérale, genoux fléchis, glisse
            const push = Math.max(0, sp);
            R(th, -0.25 * amp - 0.15 * cp * amp, 0, sg * push * 0.5 * amp);
            R(sh, (0.45 + 0.25 * push) * amp, 0, 0);
            R(ft, -0.2 * amp, 0, -sg * push * 0.3 * amp);
          } else {
            const lift = Math.max(0, cp);
            R(th, -g.leg * sp * amp - (g.crouch ? 0.25 * amp : 0), 0, 0);
            R(sh, (g.knee * lift + (g.crouch ? 0.4 : 0)) * amp, 0, 0);
            const fx = g.flap ? (0.7 * lift - 0.2) * amp : -(-g.leg * sp + g.knee * lift) * 0.55 * amp;
            R(ft, fx, 0, 0);
          }
        }
        const bob = g.bob * (Math.abs(cs) - 0.5) * 2 * amp;
        T(BI.hips, 0, bob - (g.crouch || 0) * amp, 0);
        R(BI.hips, 0, g.twist * sn * amp, g.roll * sn * amp);
        R(BI.body, g.lean * amp, -g.twist * 1.3 * sn * amp, -g.roll * 0.4 * sn * amp);
        R(BI.head, -g.lean * 0.55 * amp + Math.sin(ph * 2 - 0.8) * 0.04 * amp, 0, g.roll * 0.6 * sn * amp);
      }
      // respiration au repos
      const idle = 1 - w.move;
      if (!ko) {
        const br = Math.sin(this.idleT * 2.2 + this.id);
        ps[BI.body * 3 + 1] *= 1 + br * 0.018 * idle;
        R(BI.head, br * 0.02 * idle, 0, 0);
      }
      // assis (tondeuse, pédalo à flot) : bassin sur le siège, jambes pliées
      if (seated) {
        const st = boatIn ? this.spec.boatSeat : this.spec.seat;
        const k = boatIn ? w.water : 1;
        T(BI.hips, 0, st.dy * k, st.dz * k);
        for (let si = 0; si < 2; si++) {
          const th = si ? BI.thigh_r : BI.thigh_l, sh = si ? BI.shin_r : BI.shin_l, ft = si ? BI.foot_r : BI.foot_l;
          let a = 0;
          if (boatIn) a = Math.sin(t * 7 + (si ? Math.PI : 0)) * (moving ? 0.35 : 0.08);
          R(th, (-1.35 + a) * k, 0, (si ? -1 : 1) * 0.12 * k);
          R(sh, (1.25 - a * 0.8) * k, 0, 0);
          R(ft, 0.1 * k, 0, 0);
        }
        if (mo.vehicle) {
          const bump = moving ? Math.sin(t * 13) * 0.02 : 0;
          T(BI.hips, 0, bump, 0);
          R(BI.body, s.overheated ? -0.05 : 0.04, 0, Math.sin(t * 5.1) * 0.03 * (moving ? 1 : 0.2));
        }
      }
      // nage : buste incliné, battements de jambes
      if (swim) {
        R(BI.body, 0.25, 0, Math.sin(t * 3) * 0.06);
        R(BI.head, -0.2, 0, 0);
        for (let si = 0; si < 2; si++) {
          const k = Math.sin(t * 9 + (si ? Math.PI : 0));
          R(si ? BI.thigh_r : BI.thigh_l, -0.35 + 0.35 * k, 0, 0);
          R(si ? BI.shin_r : BI.shin_l, 0.4 - 0.25 * k, 0, 0);
          R(si ? BI.foot_r : BI.foot_l, 0.6, 0, 0);
        }
      }

      // 2) bras
      let poseL = null, poseR = null, osc = null;
      const hold = this.spec.sack ? this.spec.sack.hold : null;
      const big = react === "knockback" || react === "pull" || s.netted;
      if (ko) poseL = poseR = "koA";
      else if (react === "steal") poseL = poseR = "cheer";
      else if (react === "rage" && !mo.vehicle) { poseR = "fist"; poseL = "hip"; }
      else if (react === "fooled") { poseR = "fist"; poseL = "hip"; }
      else if (react === "drop") poseL = poseR = "shrug";
      else if (big) osc = "flail";
      else if (mo.vehicle) poseL = poseR = "drive";
      else if (swim) osc = "swim";
      else if (boatIn) poseL = poseR = "pedal";
      else if (s.burning && !(s.carrying && hold === "carryR")) osc = "flail";
      else if (s.lured) poseL = poseR = "reach";
      else if (w.steal > 0.5 && !s.carrying) osc = "dig";
      else if (s.carrying && hold) poseL = poseR = hold;
      else if (moving && mo.moveArms) poseL = poseR = mo.moveArms;
      else if (!moving && mo.idleArms) poseL = poseR = mo.idleArms;
      if (s.carrying && hold === "carryR" && !ko && !big && react !== "steal") { poseR = "carryR"; poseL = s.burning ? "flailA" : null; if (s.burning) osc = null; }
      const persistent = mo.moveArms === "mattress" || mo.moveArms === "shield";
      if (persistent && !(ko || react === "steal" || react === "drop" || react === "fooled" || big)) poseL = poseR = mo.moveArms;
      if (mo.boat && !inWater && !(big || ko)) poseL = poseR = "boatUp";
      if (mo.swims && !mo.boat && !inWater && !(big || ko || react === "steal")) poseL = poseR = "waist";
      const tmp = this.armTmp;
      for (let si = 0; si < 2; si++) {
        const side = si ? "r" : "l";
        const sg = si ? -1 : 1;
        let name = si ? poseR : poseL;
        let active = false;
        if (osc && !(si === 1 && poseR === "carryR")) {
          const a = ARM[osc + "A"], b = ARM[osc + "B"];
          const f = osc === "flail" ? 11 : osc === "dig" ? 7 : 5.5;
          const k = 0.5 + 0.5 * Math.sin(t * f + (si ? Math.PI : 0) + this.id);
          for (let i = 0; i < 10; i++) tmp[i] = a[i] + (b[i] - a[i]) * k;
          active = true;
        } else if (name && ARM[name]) {
          tmp.set(ARM[name]);
          active = true;
        }
        const key = si ? "armR" : "armL";
        const cur = this.armCur[side];
        if (active) {
          const kk = w[key] < 0.02 ? 1 : 1 - Math.exp(-dt * (osc ? 30 : 12));
          for (let i = 0; i < 10; i++) cur[i] += (tmp[i] - cur[i]) * kk;
        }
        w[key] = smooth(w[key], active ? 1 : 0, dt, 9);
        const aw = w[key];
        // balancement de marche (côté gauche : en arrière quand la jambe gauche avance)
        const swing = (si ? -sn : sn) * g.arm * amp;
        const fore = -g.fore * amp - Math.max(0, si ? sn : -sn) * 0.25 * amp;
        const rest = ARM.rest;
        const ax = rest[0] + swing, az = rest[2], fx = rest[3] + fore;
        const arm = si ? BI.arm_r : BI.arm_l, fo = si ? BI.fore_r : BI.fore_l, ha = si ? BI.hand_r : BI.hand_l;
        R(arm, ax + (cur[0] - ax) * aw, sg * cur[1] * aw, sg * (az + (cur[2] - az) * aw));
        R(fo, fx + (cur[3] - fx) * aw, sg * cur[4] * aw, sg * cur[5] * aw);
        R(ha, cur[6] * aw, sg * cur[7] * aw, sg * cur[8] * aw);
        const str = 1 + (cur[9] - 1) * aw;
        if (str !== 1) {
          ps[arm * 3 + 1] *= str;
          ps[fo * 3 + 1] *= str;
          ps[ha * 3 + 1] /= str * str;
        }
      }
      // K.-O. : jambes en l'air
      if (ko) {
        for (let si = 0; si < 2; si++) {
          R(si ? BI.thigh_r : BI.thigh_l, -0.9 + Math.sin(t * 9 + si) * 0.1, 0, (si ? -1 : 1) * 0.35);
          R(si ? BI.shin_r : BI.shin_l, 0.5, 0, 0);
        }
      }
      // filet : on se débat
      if (s.netted && !ko) {
        R(BI.body, Math.sin(t * 13) * 0.12, Math.sin(t * 7) * 0.2, 0);
        for (let si = 0; si < 2; si++) R(si ? BI.thigh_r : BI.thigh_l, -0.3 + Math.sin(t * 15 + si * 3) * 0.3, 0, 0);
      }
      // vol en cours : penché sur le coffre
      if (w.steal > 0.01 && !ko) {
        R(BI.body, 0.42 * w.steal, 0, Math.sin(t * 5) * 0.05 * w.steal);
        R(BI.head, -0.15 * w.steal, Math.sin(t * 3.1) * 0.25 * w.steal, 0);
        T(BI.hips, 0, -0.06 * w.steal + Math.abs(Math.sin(t * 7)) * 0.03 * w.steal, 0);
      }
      // porteur : petit sautillement de joie
      if (s.carrying && moving && !ko) R(BI.head, 0, 0, Math.sin(ph) * 0.05);

      // 3) tête : colère, K.-O. étourdi, attiré
      if (ko) R(BI.head, 0, 0, Math.sin(t * 6) * 0.22);
      if (react === "fooled" || (react === "rage" && !mo.vehicle)) R(BI.head, 0, Math.sin(t * 22) * 0.22, 0);
      if (react === "hit") { const k = Math.sin((rt / REACT.hit) * Math.PI); R(BI.head, 0.35 * k, 0, 0); R(BI.body, -0.15 * k, 0, 0); }
      if (react === "helmetOff") R(BI.head, 0, 0, Math.sin(rt * 18) * 0.25 * (1 - rt / REACT.helmetOff));
      if (s.lured) R(BI.head, -0.15 + Math.sin(t * 3) * 0.05, 0, 0);
      if (mo.vehicle && react === "rage") {
        R(BI.body, -0.15, 0, 0);
        R(BI.head, 0, Math.sin(t * 20) * 0.25, 0);
        const k = Math.sin(t * 16);
        const cur = this.armCur.r;
        const f = ARM.fist;
        for (let i = 0; i < 9; i++) cur[i] += (f[i] - cur[i]) * 0.9;
        R(BI.fore_r, k * 0.3, 0, 0);
      }
      if (swim) R(BI.head, 0, Math.sin(t * 2.5) * 0.15, 0);

      // 4) visage
      this._face(dt, s, moving, react, rt);

      // application
      const bones = this.bones, rest = this.restArr, ord = this.orders;
      for (let i = 0; i < NB; i++) {
        const b = bones[i], r = rest[i];
        b.position.set(r.x + pt[i * 3], r.y + pt[i * 3 + 1], r.z + pt[i * 3 + 2]);
        _e.set(pr[i * 3], pr[i * 3 + 1], pr[i * 3 + 2], ord[i]);
        b.quaternion.setFromEuler(_e);
        b.scale.set(ps[i * 3], ps[i * 3 + 1], ps[i * 3 + 2]);
      }
    }

    /** Visage : clignements, regard, sourcils, bouche selon l'humeur. */
    _face(dt, s, moving, react, rt) {
      const f = this.face, w = this.w, t = this.time;
      const ko = react === "ko";
      // humeur : [ouverture, écarquillé, inclinaison des sourcils (colère > 0), hauteur, bouche ouverte, sourire large]
      let open = 1, wide = 1, tilt = this.spec.mood === "sad" ? -0.25 : 0.28, up = 0, mouth = 0, grin = 1;
      const scared = s.burning || s.netted || react === "knockback" || react === "pull" || s.frozen || w.water > 0.5 && !this.spec.motion.swims;
      if (s.carrying || w.steal > 0.3) { tilt = -0.15; up = 0.02; grin = 1.45; open = 0.8; }
      if (scared) { wide = 1.22; tilt = -0.35; up = 0.05; mouth = 1; grin = 0.8; }
      if (s.lured) { wide = 1.15; tilt = -0.3; up = 0.05; mouth = 0.7; grin = 1.1; }
      if (react === "hit") { open = 0.15; tilt = 0.45; mouth = 0.6; }
      if (react === "rage" || react === "fooled") { open = 0.75; tilt = 0.6; up = -0.02; mouth = 1; grin = 1.2; }
      if (react === "steal") { open = 0.55; tilt = -0.25; up = 0.04; mouth = 0.8; grin = 1.5; }
      if (react === "drop") { wide = 1.2; tilt = -0.4; up = 0.05; mouth = 0.5; }
      if (react === "overheat" || (s.overheated && this.spec.motion.vehicle)) { tilt = -0.3; up = 0.04; mouth = 0.8; wide = 1.15; }
      if (ko) { wide = 1.1; tilt = -0.2; up = 0.03; mouth = 1; }
      const k = 1 - Math.exp(-dt * 14);
      f.open += (open - f.open) * k;
      f.wide += (wide - f.wide) * k;
      f.tilt += (tilt - f.tilt) * k;
      f.up += (up - f.up) * k;
      f.mouth += (mouth - f.mouth) * k;
      f.grin += (grin - f.grin) * k;
      f.dizzy = ko ? Math.min(1, f.dizzy + dt * 4) : Math.max(0, f.dizzy - dt * 4);
      // clignement
      f.blinkT -= dt;
      if (f.blinkT <= 0) { f.blink = 0.13; f.blinkT = 1.6 + Math.random() * 3.5; }
      let bl = 0;
      if (f.blink > 0) { f.blink -= dt; bl = Math.sin(Math.max(0, f.blink) / 0.13 * Math.PI); }
      // regard : coups d'œil au hasard, droit devant en marche
      f.lookT -= dt;
      if (f.lookT <= 0) {
        f.lookT = 0.6 + Math.random() * 2.2;
        f.tx = (Math.random() - 0.5) * (moving ? 0.8 : 1.8);
        f.ty = (Math.random() - 0.5) * 0.8;
      }
      if (s.lured) { f.tx = 0; f.ty = -0.3; }
      f.lookX += (f.tx - f.lookX) * (1 - Math.exp(-dt * 16));
      f.lookY += (f.ty - f.lookY) * (1 - Math.exp(-dt * 16));
      const pr = this.pr, pt = this.pt, ps = this.ps;
      const eo = f.open * (1 - bl * 0.9);
      for (let si = 0; si < 2; si++) {
        const e = si ? BI.eye_r : BI.eye_l, b = si ? BI.brow_r : BI.brow_l, sg = si ? -1 : 1;
        if (f.dizzy > 0.01) {
          // yeux qui tournent (spirale)
          const a = t * 9 * (si ? -1 : 1);
          pr[e * 3] = Math.sin(a) * 0.45 * f.dizzy;
          pr[e * 3 + 1] = Math.cos(a) * 0.45 * f.dizzy;
        } else {
          pr[e * 3] = -f.lookY * 0.35;
          pr[e * 3 + 1] = f.lookX * 0.45;
        }
        ps[e * 3] = f.wide; ps[e * 3 + 1] = f.wide * Math.max(0.08, eo); ps[e * 3 + 2] = f.wide;
        pr[b * 3 + 2] = sg * f.tilt;
        pt[b * 3 + 1] = f.up + (1 - eo) * -0.02;
      }
      ps[BI.mouth * 3] = f.grin;
      ps[BI.mouth * 3 + 1] = 1 + f.mouth * 2.6 + (react === "steal" ? Math.abs(Math.sin(rt * 20)) * 0.6 : 0);
    }

    _rigLayer(dt, s, moving, speed, inWater, react, rt, solid) {
      const mo = this.spec.motion, w = this.w, rig = this.rig, t = this.time;
      if (solid) return;
      let y = 0, pitch = 0, roll = 0, yaw = 0, sx = 1, sy = 1, px = 0, pz = 0, pivotY = 0;
      const ph = this.phase;
      // eau : nage (bouée à la surface), pédalo à flot, pataugeage pour les autres
      if (mo.swims && !mo.boat) y += w.water * (this.spec.swimY + Math.sin(t * 2.6 + this.id) * 0.04);
      else if (mo.boat) y += w.water * this.spec.boatY;
      else if (!mo.vehicle) y += w.water * -0.42;
      // démarches : petit bond rebondi (dessin animé)
      if (moving && !mo.vehicle && !(mo.swims && inWater)) {
        const hop = Math.abs(Math.sin(ph)) * (this.gait.hop || 0);
        y += hop;
        const sq = Math.cos(ph * 2);
        sy *= 1 + sq * 0.025; sx *= 1 - sq * 0.02;
      }
      // véhicule : cahots, vibration en surchauffe
      if (mo.vehicle) {
        const bump = moving ? Math.sin(t * 13.0) * 0.012 + Math.sin(t * 7.3) * 0.01 : Math.sin(t * 30) * 0.003;
        y += bump;
        pitch += moving ? Math.sin(t * 5.1) * 0.012 : 0;
        if (s.overheated) { px += (Math.random() - 0.5) * 0.05; pz += (Math.random() - 0.5) * 0.05; y += Math.abs(Math.sin(t * 17)) * 0.05; roll += Math.sin(t * 31) * 0.02; }
      }
      // états
      if (s.netted) { px += Math.sin(t * 17) * 0.04; roll += Math.sin(t * 11) * 0.08; sy *= 0.92 + Math.sin(t * 14) * 0.03; }
      if (s.lured) y += Math.abs(Math.sin(t * 4)) * 0.06;
      if (s.burning && !mo.vehicle) y += Math.abs(Math.sin(t * 9)) * 0.12;
      const C = this.spec.center;
      // réactions
      if (react === "hit") { const k = Math.sin((rt / REACT.hit) * Math.PI); sy *= 1 - 0.12 * k; sx *= 1 + 0.09 * k; }
      if (react === "knockback") {
        const T = 0.62, k = clamp(rt / T, 0, 1);
        if (mo.vehicle) { pitch -= Math.sin(k * Math.PI) * 0.45; y += Math.sin(k * Math.PI) * 0.35; pivotY = 0; }
        else {
          pivotY = C;
          pitch -= ease(k) * TAU;
          y += Math.sin(k * Math.PI) * 1.2;
          if (rt > T) { const q = clamp((rt - T) / 0.2, 0, 1); sy *= 1 - 0.2 * Math.sin(q * Math.PI); sx *= 1 + 0.12 * Math.sin(q * Math.PI); }
        }
      }
      if (react === "pull") {
        const k = clamp(rt / REACT.pull, 0, 1);
        this.spin += dt * 16 * Math.sin(k * Math.PI);
        yaw += this.spin;
        roll += Math.sin(k * Math.PI) * 0.35;
        y += Math.sin(k * Math.PI) * 0.3;
      } else this.spin = 0;
      if (react === "ko") {
        if (mo.vehicle) {
          const k = clamp(rt / 0.4, 0, 1);
          pitch -= bounceOut(k) * 0.3; roll += bounceOut(k) * 0.12; y -= bounceOut(k) * 0.15;
        } else {
          const k = clamp(rt / 0.42, 0, 1);
          pitch -= bounceOut(k) * (Math.PI / 2 - 0.12);
          y += Math.sin(clamp(rt / 0.25, 0, 1) * Math.PI) * 0.4 + 0.18 * bounceOut(k);
          pz -= bounceOut(k) * 0.2;
          if (rt < 0.5) { const q = Math.sin(clamp(rt / 0.5, 0, 1) * Math.PI); sy *= 1 + 0.1 * q; }
        }
        const sh = clamp((rt - 1.3) / 0.45, 0, 1);
        sx *= 1 - 0.3 * sh; sy *= 1 - 0.3 * sh;
      }
      if (react === "steal" || react === "flipflops") { const q = Math.abs(Math.sin(clamp(rt / 0.5, 0, 1) * Math.PI)); y += q * 0.55; sy *= 1 + q * 0.08; sx *= 1 - q * 0.05; }
      if (react === "fooled") { y += Math.abs(Math.sin(rt * 14)) * 0.14 * (1 - rt / REACT.fooled); }
      if (react === "rage") {
        if (mo.vehicle) { const k = clamp(rt / REACT.rage, 0, 1); pitch -= Math.sin(k * Math.PI) * 0.35; pivotY = 0; y += Math.sin(k * Math.PI) * 0.1; px += Math.sin(t * 40) * 0.03; }
        else { y += Math.abs(Math.sin(rt * 12)) * 0.18; }
      }
      if (react === "overheat") { const k = 1 - rt / REACT.overheat; y += Math.abs(Math.sin(rt * 25)) * 0.12 * k; roll += Math.sin(rt * 37) * 0.06 * k; }
      if (react === "helmetOff") { const k = 1 - rt / REACT.helmetOff; roll += Math.sin(rt * 18) * 0.12 * k; sy *= 1 - 0.1 * Math.sin(Math.min(1, rt / 0.2) * Math.PI); }
      if (react === "drop") { const q = Math.sin(Math.min(1, rt / 0.35) * Math.PI); sy *= 1 - 0.08 * q; }
      // composition : pivot à mi-corps pour les saltos
      _e.set(pitch, yaw, roll, "YXZ");
      rig.quaternion.setFromEuler(_e);
      const sc = this.scale;
      _v.set(0, pivotY * sc, 0);
      _v2.copy(_v).applyQuaternion(rig.quaternion);
      rig.position.set(px + _v.x - _v2.x, y + _v.y - _v2.y, pz + _v.z - _v2.z);
      rig.scale.set(sx * sc, sy * sc, sx * sc);
    }

    _props(dt, s, moving, speed, inWater, react, rt) {
      const B = this.B, mo = this.spec.motion, w = this.w, t = this.time;
      // sac : apparaît d'un coup (petit rebond), disparaît vite
      if (B.p_sack) {
        let k = 0;
        if (s.carrying && !(react === "ko" && rt > 1.2)) { const p = this.sackPop; k = p < 1 ? 1 + Math.sin(p * Math.PI) * 0.35 - (1 - p) * (1 - p) : 1; }
        else k = w.carry > 0.35 && react !== "drop" ? w.carry : 0;
        B.p_sack.scale.setScalar(Math.max(0, k));
        // balancement au rythme des pas
        B.p_sack.rotation.set(Math.sin(this.phase * 2) * 0.06 * w.move, 0, Math.sin(this.phase) * 0.08 * w.move);
      }
      if (B.p_helmet && !this.fly.helmet) B.p_helmet.scale.setScalar(this.helmetGone ? 0 : 1);
      // matelas : tangue au rythme des pas lourds
      if (B.p_mattress) B.p_mattress.rotation.set(Math.sin(this.phase * 2) * 0.04 * w.move, 0, Math.sin(this.phase) * 0.07 * w.move + (react === "hit" ? 0.1 * Math.sin(rt * 30) : 0));
      for (let fi = 0; fi < 2; fi++) {
        const k = fi ? "flip_r" : "flip_l";
        const b = B["p_" + k];
        if (!b || this.fly[k]) continue;
        if (this.flipGone) { b.scale.setScalar(0); continue; }
        b.scale.setScalar(1);
        // claquette qui bat sous le talon
        const ph = this.phase + (fi ? Math.PI : 0);
        b.rotation.set(moving ? -Math.max(0, Math.sin(ph)) * 0.6 : 0, 0, 0);
      }
      // bouée flamant
      if (B.p_float) {
        const b = B.p_float, r = this.rest.p_float;
        if (inWater || w.water > 0.02) {
          b.position.set(r.x, r.y + Math.sin(t * 2.6 + this.id) * 0.015, r.z);
          b.rotation.set(Math.sin(t * 1.9 + this.id) * 0.07 * w.water, Math.sin(t * 0.7) * 0.1 * w.water, Math.sin(t * 2.3) * 0.07 * w.water);
        } else {
          b.position.set(r.x, r.y + (moving ? Math.abs(Math.cos(this.phase)) * 0.04 : 0), r.z);
          b.rotation.set(0, 0, moving ? Math.sin(this.phase) * 0.14 : 0);
        }
      }
      // pédalo : sur la tête à terre, à flot dans l'eau
      if (B.p_boat) {
        const b = B.p_boat, k = w.water, bs = this.spec.boat;
        const bob = Math.sin(t * 2.2 + this.id) * 0.03;
        const landY = bs.landY + (moving ? Math.abs(Math.sin(this.phase)) * 0.05 : 0);
        b.position.set(0, landY * (1 - k) + (bs.waterY + bob) * k, bs.landZ * (1 - k));
        b.rotation.set(0.05 * (1 - k) + Math.sin(t * 1.7) * 0.03 * k, 0, Math.sin(t * 2.1) * 0.04 * k + (moving && k < 0.5 ? Math.sin(this.phase) * 0.06 : 0));
        if (B.p_paddle) { if (k > 0.5 && moving) this.wheelA += dt * 7; B.p_paddle.rotation.set(this.wheelA, 0, 0); }
      }
      // tondeuse : roues selon la vitesse
      if (B.p_wheelR) {
        this.wheelA += (speed * dt) / 0.45 * (s.overheated ? 1.6 : 1);
        B.p_wheelR.rotation.set(this.wheelA, 0, 0);
        B.p_wheelF.rotation.set(this.wheelA * 1.5, 0, 0);
      }
    }

    _writeData(flash, speed) {
      const e = this.dataBone.matrixWorld.elements, w = this.w;
      e[0] = flash; e[1] = w.wet; e[2] = w.frozen; e[3] = w.burn;
      e[4] = w.ghost; e[5] = w.diss; e[6] = w.heat; e[7] = w.boost;
      e[8] = Math.min(1.5, speed / 3); e[9] = w.lure; e[10] = 0; e[11] = 0;
      e[12] = 0; e[13] = 0; e[14] = 0; e[15] = 1;
    }

    /** Retour à la réserve (caché, remis à zéro). */
    release() {
      if (this.released) return;
      for (const k in this.fly) this._landProp(k);
      this.reset();
      this.object.visible = false;
      this.released = true;
      A.actives.delete(this);
      if (A.overlay && A.overlay.released) A.overlay.released(this);
      const key = this.tpl.key;
      if (!POOLS.has(key)) POOLS.set(key, []);
      POOLS.get(key).push(this);
    }
  }
  /** Résolution du tampon de dessin pour l'épaisseur du contour (une fois par image suffit). */
  const _res = new THREE.Vector2();
  let _resFrame = -1;
  function onBeforeRender(renderer) {
    const f = renderer.info.render.frame;
    if (f === _resFrame) return;
    _resFrame = f;
    renderer.getDrawingBufferSize(_res);
    const o = A._outline.value;
    o.x = _res.x; o.y = _res.y; o.z = renderer.getPixelRatio();
  }
  function bounceOut(t) {
    const n1 = 7.5625, d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  }
  A.Actor = Actor;

  // ---------------------------------------------------------------------------------------------
  // API publique
  // ---------------------------------------------------------------------------------------------
  /** Crée (ou réutilise) un ennemi. type : 'voleur'|'sprinteur'|'demenageur'|'fumigene'|'nageur'|'boss'. */
  A.create = function (type, elite) {
    if (!A.ready) throw new Error("PTMT.actors.create : appeler d’abord await PTMT.actors.load()");
    const tpl = templateFor(type, !!elite);
    const pool = POOLS.get(tpl.key);
    let a = pool && pool.length ? pool.pop() : null;
    if (a) { a.reset(); a.released = false; a.object.visible = true; }
    else a = new Actor(tpl);
    a.mesh.castShadow = !A.mobile;
    A.actives.add(a);
    return a;
  };
  /** Pré-remplit la réserve (évite les pics de création en jeu). */
  A.prewarm = function (type, elite, count) {
    const list = [];
    for (let i = 0; i < count; i++) list.push(A.create(type, elite));
    for (const a of list) a.release();
  };
  /** Statistiques par variante (triangles, sommets, os, appels de dessin). */
  A.stats = function () {
    const out = {};
    for (const [k, t] of TEMPLATES) out[k] = Object.assign({ label: t.spec.label }, t.stats);
    return out;
  };
  /** Active ou coupe le liseré de contour (réglage de qualité). */
  A.setOutline = function (on) {
    A._outline.value.w = on ? 1 : 0;
  };
  A.template = templateFor;
  A.base = () => null;
})();
