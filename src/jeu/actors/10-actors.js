// « Pas touche à mes trésors » — les ennemis animés (PTMT.actors).
//
//   await PTMT.actors.load();                            // prépare tous les gabarits (11 types × 3 rangs)
//   const a = PTMT.actors.create(type, champion, boss);  // réutilisé depuis une réserve par variante
//   a.object  a.height  a.carryAnchor  a.update(dt, time, s)  a.event(name[, cible])  a.release()
//
// Personnages « chibi » entièrement procéduraux (11-types.js pour les piétons, 13-mounts.js pour les
// cavaliers) : grosse tête, corps trapu, moufles et gros souliers, couvre-chef et monture lisibles de
// haut. Squelette léger fait maison (21 os de corps + os d'accessoires et de monture), animé à la main :
// démarches, conduite, chevauchée, nage du canard, gestes des capacités (crêpe, fumigène, lasso, biniou,
// pas de côté), réactions (coup, K.-O., gel, feu, peur, étourdissement…). Aucun clip ni mélangeur.
//
// Rangs : 0 ordinaire, 1 champion (couleurs plus riches, dorures), 2 boss (champion + grande couronne et
// cape, ou monture dorée). a.object.scale est réglé d'office (× 1,3 champion, × 1,6 boss, d'après
// PTMT.sim.DATA) ; a.height en tient compte.
//
// Rendu : un seul SkinnedMesh par ennemi (corps, visage, accessoires, monture et coque de contour
// fusionnés), une seule matière partagée par tous les ennemis : un appel de dessin (+ ombre sur
// ordinateur). La coque de contour est une copie retournée de la géométrie, gonflée à l'écran par le
// shader : liseré sombre d'épaisseur constante en pixels, qui détache les silhouettes de l'herbe. Les
// motifs (rayures, vichy, pie noir, camouflage, dentelle, tartan) sont calculés dans le shader et fondus
// quand ils deviennent plus fins que quelques pixels. Les données par instance (éclair de coup, mouillé,
// gelé, brûlé, fantôme, dissolution, immunité, hâte, rayonnement) passent par un « os de données »
// (indice 0) lu par le shader. Les états visibles (glaçon, bulle, flammes, étoiles, notes…) sont
// dessinés en lots partagés (12-overlay.js).
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
  A.RANKS = ["ordinaire", "champion", "boss"];

  // Os du corps, dans l'ordre des tableaux de pose (les accessoires et la monture suivent).
  const BODY = [
    "root", "hips", "body", "head", "eye_l", "eye_r", "brow_l", "brow_r", "mouth",
    "arm_l", "fore_l", "hand_l", "arm_r", "fore_r", "hand_r",
    "thigh_l", "shin_l", "foot_l", "thigh_r", "shin_r", "foot_r",
  ];
  const BI = {};
  BODY.forEach((n, i) => (BI[n] = i));
  A.BODY_BONES = BODY;
  A.BI = BI;

  /** Agrandissement d'un rang (données du jeu si chargées). */
  A.sizeFactor = function (rank) {
    const D = PTMT.sim && PTMT.sim.DATA;
    if (rank >= 2) return (D && D.boss && D.boss.scale) || 1.6;
    if (rank >= 1) return (D && D.champion && D.champion.scale) || 1.3;
    return 1;
  };

  // ---------------------------------------------------------------------------------------------
  // Chargement : tout est procédural, rien à télécharger
  // ---------------------------------------------------------------------------------------------
  A.load = function () {
    if (A.ready) return Promise.resolve(A);
    if (A._loading) return A._loading;
    A._loading = new Promise((ok, ko) => {
      try {
        const t0 = performance.now();
        for (const t of A.TYPES) for (const r of [0, 1, 2]) templateFor(t, r);
        if (A.overlay && A.overlay.init) A.overlay.init();
        A.loadMs = performance.now() - t0;
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
  // coque de contour.
  // ---------------------------------------------------------------------------------------------
  const _m = new THREE.Matrix4(), _n3 = new THREE.Matrix3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e = new THREE.Euler();
  const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _s = new THREE.Vector3();
  const ZERO3 = [0, 0, 0];
  const _UP = new THREE.Vector3(0, 1, 0);
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
      this.minOutline = 0.1; // rayon minimal d'une pièce pour recevoir un contour automatique
    }
    bone(name) {
      const i = this.bi[name];
      if (i === undefined) throw new Error("PTMT.actors : os inconnu « " + name + " »");
      return i;
    }
    /**
     * opt : { color, mat (classe), part (motif), pal (2e couleur du motif, indice de palette), pos, rot,
     *         scale, quat, order, matrix, bone, weights(x,y,z) → [[os, poids], ...],
     *         colors (garder l'attribut color de la géométrie, linéaire), grad [hexHaut, hexBas, y0, y1],
     *         outline (true/false ; automatique selon la taille sinon), jitter, seed, bend(v) }
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
      // bosselage : décalage par position, identique pour les sommets confondus
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
        if (opt.bend) opt.bend(_v);
        P[i * 3] = _v.x; P[i * 3 + 1] = _v.y; P[i * 3 + 2] = _v.z;
        cx += _v.x; cy += _v.y; cz += _v.z;
        if (nor) _v2.set(nor.getX(i), nor.getY(i), nor.getZ(i)).applyMatrix3(_n3).normalize();
        else _v2.set(0, 1, 0);
        N[i * 3] = _v2.x; N[i * 3 + 1] = _v2.y; N[i * 3 + 2] = _v2.z;
      }
      let flip = _m.determinant() < 0;
      if (jit || !nor || opt.bend) computeNormals(P, N, idx, flip);
      // face intérieure (doublure, dedans d'une couronne) : normales et enroulement inversés
      if (opt.invert) {
        for (let i = 0; i < N.length; i++) N[i] = -N[i];
        flip = !flip;
      }
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
      const part = opt.part === undefined ? 0 : opt.part, mat = opt.mat || 0, pal = opt.pal || 0;
      this._push(P, N, C, part, mat, pal, SI, SW, idx, flip);
      // contour : automatique pour les pièces assez grandes
      let outline = opt.invert ? false : opt.outline;
      if (outline === undefined) {
        cx /= n; cy /= n; cz /= n;
        let rr = 0;
        for (let i = 0; i < n; i++) rr = Math.max(rr, (P[i * 3] - cx) ** 2 + (P[i * 3 + 1] - cy) ** 2 + (P[i * 3 + 2] - cz) ** 2);
        outline = Math.sqrt(rr) >= this.minOutline;
      }
      if (outline) {
        const HN = smoothNormals(P, N, n);
        const t0 = this.tris;
        this._push(P, HN, new Float32Array(n * 3), HULL, 0, 0, SI, SW, idx, !flip);
        this.hullTris += this.tris - t0;
      }
      return this;
    }
    _push(P, N, C, part, mat, pal, SI, SW, idx, flip) {
      const o = this.nv, n = P.length / 3;
      for (let i = 0; i < P.length; i++) { this.P.push(P[i]); this.N.push(N[i]); this.C.push(C[i]); }
      for (let i = 0; i < n; i++) { this.M.push(part, mat, pal); for (let k = 0; k < 4; k++) { this.SI.push(SI[i * 4 + k]); this.SW.push(SW[i * 4 + k]); } }
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
      geo.setAttribute("aMat", new THREE.Float32BufferAttribute(this.M, 3));
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
  /** Normales recalculées (pièces bosselées ou tordues), pondérées par l'aire des triangles. */
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
  // Parties (aMat.x) : 0 uni, 2 rayures fines, 3 rayures verticales, 4 blanc des yeux, 5 pupille,
  // 6 dentelle, 7 pie noir, 8 camouflage, 9 vichy, 10 cerceaux larges, 11 tartan, 12 plumage,
  // 30 coque de contour. La 2e couleur d'un motif vient de la palette (aMat.z).
  // Classes (aMat.y) : 0 mat, 1 satiné, 2 brillant, 3 métal, 4 lumineux, 5 fluo, 6 or, 7 verre sombre.
  const VERT_PARS = /* glsl */ `
    attribute vec3 aMat;
    varying vec3 vMat;
    varying vec3 vRest;
    varying vec3 vCol2;
    varying vec4 vFx0;
    varying vec4 vFx1;
    varying vec4 vFx2;
    uniform vec4 uOutline;
    uniform vec3 uPal[16];
  `;
  const VERT_SKIN = /* glsl */ `
    vMat = aMat;
    vRest = position;
    vCol2 = uPal[int(aMat.z + 0.5)];
    #ifdef USE_SKINNING
      mat4 ptData = getBoneMatrix(0.0);
      vFx0 = ptData[0]; vFx1 = ptData[1]; vFx2 = ptData[2];
    #else
      vFx0 = vec4(0.0); vFx1 = vec4(0.0); vFx2 = vec4(0.0);
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
    varying vec3 vMat;
    varying vec3 vRest;
    varying vec3 vCol2;
    varying vec4 vFx0;
    varying vec4 vFx1;
    varying vec4 vFx2;
    uniform float uTime;
    ${"PTMT_NOISE"}
    float ptBayer(vec2 p){
      vec2 q = mod(floor(p), 4.0);
      float i = q.x + q.y * 4.0;
      float b = mod(i * 7.0 + floor(i / 4.0) * 5.0, 16.0);
      return (b + 0.5) / 16.0;
    }
    // créneau 0/1 antialiasé, fondu à la moyenne quand la période devient plus fine que ~4 px
    float ptSq(float x){
      float w = max(fwidth(x), 1e-4);
      float t = abs(fract(x) - 0.5) * 2.0;
      float s = clamp((t - 0.5) / (2.0 * w) + 0.5, 0.0, 1.0);
      return mix(s, 0.5, smoothstep(0.25, 0.5, w));
    }
    // seuil antialiasé d'un champ continu (taches)
    float ptStep(float e, float x){
      float w = max(fwidth(x), 1e-4);
      return clamp((x - e) / w * 0.5 + 0.5, 0.0, 1.0);
    }
  `;
  const FRAG_COLOR = /* glsl */ `
    #include <color_fragment>
    float ptPart = floor(vMat.x + 0.5);
    float ptCls = floor(vMat.y + 0.5);
    float ptHull = step(29.5, ptPart);
    // fantôme (fumigène) et dissolution (K.-O.) : transparence tramée, sans tri
    float ptGhost = vFx1.x, ptDiss = vFx1.y;
    if (ptGhost > 0.01 && ptBayer(gl_FragCoord.xy) < ptGhost * 0.8) discard;
    float ptN = 0.0;
    if (ptDiss > 0.001) { ptN = ptNoise3(vRest * 7.0); if (ptN < ptDiss) discard; }
    vec3 ptAlb = diffuseColor.rgb;
    vec3 ptB = vCol2;
    if (ptHull < 0.5 && ptPart > 1.5) {
      if (ptPart < 2.5) {
        ptAlb = mix(ptAlb, ptB, ptSq(vRest.y * 6.5));
      } else if (ptPart < 3.5) {
        ptAlb = mix(ptAlb, ptB, ptSq(vRest.x * 5.5 + 0.2));
      } else if (ptPart > 5.5 && ptPart < 6.5) {
        // dentelle : jours ronds en quinconce et fines côtes (coiffe bigoudène)
        vec2 uv = vec2(atan(vRest.x, vRest.z - 0.02) * 0.95, vRest.y * 5.5);
        vec2 gq = uv * 2.6;
        gq.x += floor(gq.y) * 0.5;
        vec2 f = fract(gq) - 0.5;
        float wv = max(fwidth(gq.x), fwidth(gq.y));
        float hole = 1.0 - clamp((length(f) - 0.26) / max(wv, 1e-4) + 0.5, 0.0, 1.0);
        float rib = ptSq(uv.y * 2.6 + 0.5) * 0.35;
        float lace = mix(max(hole, rib), 0.3, smoothstep(0.2, 0.45, wv));
        ptAlb = mix(ptAlb, ptB, lace);
      } else if (ptPart > 6.5 && ptPart < 7.5) {
        // pie noir : grandes taches blanches, ventre plus clair (une robe par ennemi)
        float n = ptNoise3(vRest * 1.55 + vec3(vFx2.w * 17.0, vFx2.w * 5.0, 0.0));
        n += (0.78 - vRest.y) * 0.55;
        ptAlb = mix(ptAlb, ptB, ptStep(0.62, n));
      } else if (ptPart > 7.5 && ptPart < 8.5) {
        // camouflage : deux tons de taches par-dessus le vert
        float n1 = ptNoise3(vRest * 3.4 + 3.1), n2 = ptNoise3(vRest * 5.7 + 9.7);
        ptAlb = mix(ptAlb, ptB, ptStep(0.56, n1));
        ptAlb = mix(ptAlb, ptAlb * 0.42, ptStep(0.62, n2));
      } else if (ptPart > 8.5 && ptPart < 9.5) {
        // vichy : bandes croisées (fond de la 2e couleur, croisements de la couleur pleine)
        float a = ptSq(vRest.x * 5.2 + 0.25), b = ptSq(vRest.y * 5.2);
        ptAlb = mix(ptB, ptAlb, (a + b) * 0.5);
      } else if (ptPart > 9.5 && ptPart < 10.5) {
        ptAlb = mix(ptAlb, ptB, ptSq(vRest.y * 3.3 + 0.25));
      } else if (ptPart > 10.5 && ptPart < 11.5) {
        float a = ptSq(vRest.x * 6.0), b = ptSq(vRest.y * 6.0 + 0.3);
        float l = ptSq(vRest.x * 18.0 + 0.5) * ptSq(vRest.y * 18.0);
        ptAlb = mix(ptAlb, ptB, clamp(a * b * 0.8 + l * 0.35, 0.0, 1.0));
      } else if (ptPart > 11.5 && ptPart < 12.5) {
        // plumage : écailles en quinconce, bord plus sombre
        vec2 q = vec2(vRest.x * 7.0, vRest.z * 5.5 - vRest.y * 3.0);
        q.x += floor(q.y) * 0.5;
        vec2 f = fract(q) - vec2(0.5, 0.0);
        float d = length(f * vec2(1.0, 1.4));
        float wv = max(fwidth(q.x), fwidth(q.y));
        float edge = clamp((d - 0.5) / max(wv, 1e-4) + 0.5, 0.0, 1.0) * (1.0 - clamp((d - 0.62) / max(wv, 1e-4) + 0.5, 0.0, 1.0));
        ptAlb = mix(ptAlb, ptB, edge * (1.0 - smoothstep(0.2, 0.45, wv)) * 0.8);
      }
    }
    // blanc des yeux : liseré d'encre au bord du globe (sans coque)
    if (ptPart > 3.5 && ptPart < 4.5) {
      float ptK = abs(dot(normalize(vNormal), normalize(vViewPosition)));
      ptAlb *= mix(0.12, 1.0, smoothstep(0.12, 0.42, ptK));
    }
    // états : gelé, mouillé, brûlé, éclair de coup
    float ptFlash = vFx0.x, ptWet = vFx0.y, ptFrozen = vFx0.z, ptBurn = vFx0.w;
    ptAlb = mix(ptAlb, vec3(0.62, 0.86, 1.0), ptFrozen * 0.5);
    ptAlb *= 1.0 - 0.3 * ptWet;
    ptAlb *= 1.0 - 0.55 * ptBurn * (0.6 + 0.4 * ptNoise(vRest.xy * 12.0));
    ptAlb = mix(ptAlb, vec3(1.0), ptFlash * 0.55);
    if (ptGhost > 0.01) ptAlb = mix(ptAlb, vec3(0.34, 0.4, 0.36), ptGhost * 0.6);
    diffuseColor.rgb = ptAlb;
    // contour : sombre, bleuté (gelé, rayonnement), doré (immunité), clair à l'éclair du coup
    float ptRad = vFx2.y, ptImm = vFx1.z;
    vec3 ptLine = mix(vec3(0.028, 0.022, 0.04), vec3(0.12, 0.3, 0.5), max(ptFrozen * 0.7, ptRad * 0.8));
    ptLine = mix(ptLine, vec3(1.0, 0.72, 0.18), ptImm * 0.85);
    ptLine = mix(ptLine, vec3(1.0, 0.92, 0.7), ptFlash * 0.65);
  `;
  const FRAG_ROUGH = /* glsl */ `
    roughnessFactor = ptCls < 0.5 ? 0.82 : (ptCls < 1.5 ? 0.55 : (ptCls < 2.5 ? 0.3 : (ptCls < 3.5 ? 0.3 : (ptCls < 5.5 ? 0.6 : (ptCls < 6.5 ? 0.34 : 0.14)))));
    if (ptPart > 4.5 && ptPart < 5.5) roughnessFactor = 0.18;
    roughnessFactor *= 1.0 - 0.55 * ptWet;
  `;
  const FRAG_METAL = /* glsl */ `
    metalnessFactor = ptCls > 2.5 && ptCls < 3.5 ? 0.55 : (ptCls > 5.5 && ptCls < 6.5 ? 0.4 : 0.0);
  `;
  const FRAG_EMISSIVE = /* glsl */ `
    {
      vec3 ptV = normalize(vViewPosition);
      float ptFres = pow(1.0 - clamp(abs(dot(normalize(vNormal), ptV)), 0.0, 1.0), 2.5);
      // teintes franches même côté ombre (éclairage de dessin animé) + fin liseré clair
      totalEmissiveRadiance += diffuseColor.rgb * 0.18;
      totalEmissiveRadiance += vec3(1.0, 0.97, 0.9) * ptFres * 0.08;
      if (ptPart > 3.5 && ptPart < 4.5) totalEmissiveRadiance += diffuseColor.rgb * 0.32;
      if (ptCls > 3.5 && ptCls < 4.5) totalEmissiveRadiance += diffuseColor.rgb * 1.4;
      if (ptCls > 4.5 && ptCls < 5.5) totalEmissiveRadiance += diffuseColor.rgb * 0.65;
      if (ptCls > 5.5 && ptCls < 6.5) totalEmissiveRadiance += vec3(1.0, 0.62, 0.12) * (0.22 + 1.3 * ptFres) * (0.8 + 0.2 * sin(uTime * 4.0 + vRest.x * 5.0 + vRest.y * 3.0));
      totalEmissiveRadiance += vec3(1.0, 0.96, 0.9) * ptFlash * 0.9;
      totalEmissiveRadiance += vec3(1.0, 0.36, 0.05) * ptBurn * (0.14 + 0.12 * sin(uTime * 23.0 + vRest.y * 6.0));
      totalEmissiveRadiance += vec3(0.4, 0.75, 1.0) * ptFrozen * 0.12;
      // rayonnement (dragon bleu) : halo bleu qui palpite ; immunité : éclat doré ; hâte : liseré chaud
      totalEmissiveRadiance += vec3(0.25, 0.6, 1.0) * ptRad * (0.16 + 1.7 * ptFres) * (0.75 + 0.25 * sin(uTime * 7.0));
      totalEmissiveRadiance += vec3(1.0, 0.78, 0.3) * ptImm * (0.3 + 2.2 * ptFres);
      totalEmissiveRadiance += vec3(1.0, 0.85, 0.4) * vFx1.w * ptFres * 0.45;
      if (ptDiss > 0.001 && ptN < ptDiss + 0.07) totalEmissiveRadiance += vec3(1.0, 0.9, 0.55) * 2.5;
    }
  `;
  const FRAG_OUT = /* glsl */ `
    if (ptHull > 0.5) gl_FragColor.rgb = ptLine;
    #include <tonemapping_fragment>
  `;

  let bodyMat = null;
  const palUniform = { value: [] };
  function bodyMaterial() {
    if (bodyMat) return bodyMat;
    palUniform.value = (A.PALETTE || [0xffffff]).concat(new Array(16).fill(0xffffff)).slice(0, 16).map((h) => PTMT.color(h));
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, skinning: true, roughness: 0.8, metalness: 0 });
    m.name = "ptmt:actor";
    m.extensions = { derivatives: true };
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = A._timeUniform;
      sh.uniforms.uOutline = A._outline;
      sh.uniforms.uPal = palUniform;
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
    m.customProgramCacheKey = () => "ptmt-actor-ct-v1";
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
        .replace("#include <common>", "#include <common>\nattribute vec3 aMat;")
        .replace("#include <project_vertex>", "#include <project_vertex>\nif (aMat.x > 29.5) gl_Position = vec4(0.0, 0.0, 2.0, 1.0);");
    };
    m.customProgramCacheKey = () => "ptmt-actor-depth-v2";
    depthMat = m;
    return m;
  }

  // ---------------------------------------------------------------------------------------------
  // Gabarit d'une variante : squelette, géométrie fusionnée, statistiques
  // ---------------------------------------------------------------------------------------------
  function templateFor(type, rank) {
    rank = rank | 0;
    const key = type + ":" + rank;
    let tpl = TEMPLATES.get(key);
    if (tpl) return tpl;
    const spec = A.variantSpec(type, rank);
    // squelette : corps + accessoires + monture (positions de liaison dans l'espace du personnage)
    const bones = spec.skeleton.map((b) => ({ name: b.name, parent: b.parent, pos: b.pos.slice() }));
    for (const pd of spec.propDefs) bones.push({ name: "p_" + pd.name, parent: pd.parent === undefined ? "root" : pd.parent, pos: pd.pos.slice(), prop: true });
    const world = {};
    for (const b of bones) world[b.name] = b.pos;
    for (const b of bones) {
      if (b.parent && !world[b.parent]) throw new Error("PTMT.actors : parent inconnu « " + b.parent + " » (" + key + ")");
      const pp = b.parent ? world[b.parent] : ZERO3;
      b.local = [b.pos[0] - pp[0], b.pos[1] - pp[1], b.pos[2] - pp[2]];
    }
    const k = new Builder(bones.map((b) => b.name));
    for (const b of spec.builds) if (b) b(k, spec);
    const bodyTris = k.tris;
    const props = {};
    for (const pd of spec.propDefs) {
      if (!pd.build) continue;
      const t0 = k.tris;
      k.defaultBone = "p_" + pd.name;
      pd.build(k, spec);
      props[pd.name] = k.tris - t0;
    }
    k.defaultBone = "root";
    const geo = k.build();
    geo.computeBoundingSphere();
    geo.boundingSphere.radius = geo.boundingSphere.radius * 1.35 + 0.4;
    geo.computeBoundingBox();
    // os : inverses de liaison (translations pures), os de données en tête
    const inverses = [new THREE.Matrix4()];
    for (const b of bones) inverses.push(new THREE.Matrix4().makeTranslation(-b.pos[0], -b.pos[1], -b.pos[2]));
    tpl = {
      key, type, rank, spec, geometry: geo, bones, boneInverses: inverses,
      stats: {
        triangles: k.tris,
        bodyTriangles: bodyTris,
        accessoryTriangles: k.tris - bodyTris,
        outlineTriangles: k.hullTris,
        props,
        vertices: k.nv,
        bones: bones.length + 1,
        drawCalls: 1,
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
    overhead: [-2.98, 0, 0.16, -0.12, 0, 0, -0.5, 0, 0, 1.8],
    carryUp: [-2.95, 0, 0.3, -0.18, 0, 0, -0.4, 0, 0, 1.7],
    carryFwd: [-2.35, 0, 0.26, -0.55, 0, 0, -0.3, 0, 0, 1.5],
    cheer: [-2.55, 0, 0.8, -0.2, 0, 0, 0, 0, 0, 1.4],
    shrug: [-0.25, 0, 1.05, -1.35, 0, 0, 0.3, 0, 0, 1],
    droop: [0.2, 0, 0.05, -0.1, 0, 0, 0.2, 0, 0, 1.05],
    koA: [-2.6, 0, 1.2, -0.3, 0, 0, 0, 0, 0, 1.1],
    flailA: [-2.9, 0, 0.9, -0.4, 0, 0, 0, 0, 0, 1.2],
    flailB: [-2.05, 0, 1.75, -0.95, 0, 0, 0, 0, 0, 1.2],
    // fourche brandie (bras droit) et poing qui menace (bras gauche)
    forkA: [-2.0, 0, 0.35, -0.95, 0, 0, 0, 0, 0, 1.12],
    forkB: [-2.55, 0, 0.3, -0.35, 0, 0, 0, 0, 0, 1.12],
    fistA: [-1.35, 0, 0.55, -1.75, 0, 0, 0, 0, 0, 1.05],
    fistB: [-1.75, 0, 0.5, -1.35, 0, 0, 0, 0, 0, 1.05],
    // lasso : main au-dessus de la tête qui décrit un petit cercle
    lassoA: [-2.72, 0, 0.36, -0.42, 0, 0, 0, 0, 0, 1.08],
    lassoB: [-2.92, 0, 0.18, -0.22, 0, 0, 0, 0, 0, 1.08],
    toss: [-1.35, 0, 0.12, -0.05, 0, 0, -0.2, 0, 0, 1.3],
    // lancer (crêpe, fumigène) : armé en arrière puis détente vers l'avant
    throwA: [-2.55, 0, 0.55, -1.35, 0, 0, 0.4, 0, 0, 1.05],
    throwB: [-1.35, 0, 0.12, -0.08, 0, 0, -0.3, 0, 0, 1.2],
    // guidon, rênes, cou du canard
    drive: [-0.92, 0, -0.06, -0.3, 0, 0, 0.15, 0, 0, 1.22],
    reins: [-0.95, 0, 0.18, -0.95, 0, 0, 0.2, 0, 0, 1.05],
    neck: [-1.25, 0, 0.18, -0.55, 0, 0, 0, 0, 0, 1.18],
    // bouclier (bidon de lait, bras gauche) et aiguillon (bras droit)
    shield: [-1.05, 0, 0.62, -1.2, 0, 0, 0.2, 0, 0, 1.0],
    lance: [-0.75, 0, 0.3, -0.55, 0, 0, 0, 0, 0, 1.05],
    // biniou : poche sous le bras gauche, main droite sur le hautbois
    bagL: [-0.72, 0, 0.42, -1.55, 0, 0, 0.3, 0, 0, 1.0],
    pipeA: [-1.0, 0, 0.3, -1.85, 0, 0, 0.1, 0, 0, 1.0],
    pipeB: [-1.08, 0, 0.26, -1.95, 0, 0, 0.2, 0, 0, 1.0],
    // plateau de crêpes (bras gauche), ballon calé sous le bras, lance à incendie
    plate: [-0.95, 0, 0.3, -1.15, 0, 0, 0.35, 0, 0, 1.0],
    tuck: [-0.2, 0, 0.32, -1.75, 0, 0, 0.3, 0, 0, 1.0],
    nozzle: [-1.3, 0, 0.18, -0.55, 0, 0, 0, 0, 0, 1.1],
    hoseL: [-1.0, 0, 0.35, -0.9, 0, 0, 0, 0, 0, 1.05],
    // faucille levée, bâton
    sickleA: [-2.1, 0, 0.42, -0.95, 0, 0, 0, 0, 0, 1.05],
    sickleB: [-2.35, 0, 0.38, -0.7, 0, 0, 0, 0, 0, 1.05],
    sneak: [-1.1, 0, 0.38, -1.6, 0, 0, 0.75, 0, 0, 1],
    hip: [0.3, 0, 0.75, -1.95, 0, 0, 0, 0, 0, 1],
    binoc: [-1.55, 0, 0.35, -2.1, 0, 0, 0.3, 0, 0, 1.0],
  };
  A.ARM_POSES = ARM;
  /** Poses animées : [pose A, pose B, fréquence (rad/s), décalage du bras droit]. */
  const OSC = {
    fork: ["forkA", "forkB", 9, 0],
    fist: ["fistA", "fistB", 12, 0],
    lasso: ["lassoA", "lassoB", 11, 0],
    pipe: ["pipeA", "pipeB", 14, 0],
    sickle: ["sickleA", "sickleB", 3.5, 0],
    flail: ["flailA", "flailB", 11, Math.PI],
  };
  // Démarches : longueur de cycle (m), amplitude des jambes, genoux, rebond, bras, penchée, roulis…
  const GAIT = {
    walk: { stride: 1.6, leg: 0.6, knee: 0.95, bob: 0.08, arm: 0.65, fore: 0.35, lean: 0.12, roll: 0.06, twist: 0.12, hop: 0.05 },
    stomp: { stride: 1.55, leg: 0.62, knee: 1.05, bob: 0.1, arm: 0.5, fore: 0.3, lean: 0.2, roll: 0.09, twist: 0.14, hop: 0.07 },
    heavy: { stride: 1.35, leg: 0.46, knee: 0.7, bob: 0.06, arm: 0.35, fore: 0.3, lean: 0.08, roll: 0.13, twist: 0.07, hop: 0.03 },
    march: { stride: 1.6, leg: 0.58, knee: 0.95, bob: 0.08, arm: 0.4, fore: 0.3, lean: 0.06, roll: 0.05, twist: 0.08, hop: 0.05 },
    sneak: { stride: 2.1, leg: 0.66, knee: 1.55, bob: 0.1, arm: 0.12, fore: 0.1, lean: 0.36, roll: 0.07, twist: 0.1, crouch: 0.07, hop: 0.06 },
    run: { stride: 2.3, leg: 0.95, knee: 1.6, bob: 0.13, arm: 1.1, fore: 1.4, lean: 0.34, roll: 0.05, twist: 0.2, hop: 0.1 },
    glide: { stride: 1.6, leg: 0.38, knee: 0.5, bob: 0.03, arm: 0.3, fore: 0.25, lean: 0.05, roll: 0.03, twist: 0.05, hop: 0.015 },
    shuffle: { stride: 1.25, leg: 0.42, knee: 0.62, bob: 0.05, arm: 0.35, fore: 0.3, lean: 0.08, roll: 0.09, twist: 0.06, hop: 0.035 },
    ride: { stride: 1.5, leg: 0, knee: 0, bob: 0, arm: 0, fore: 0, lean: 0, roll: 0, twist: 0, hop: 0 },
  };
  A.GAITS = GAIT;

  // ---------------------------------------------------------------------------------------------
  // Ennemi
  // ---------------------------------------------------------------------------------------------
  const EMPTY = {};
  const NO_ARMS = [null, null];
  let _uid = 1;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const smooth = (cur, target, dt, rate) => cur + (target - cur) * (1 - Math.exp(-dt * rate));
  const ease = (t) => t * t * (3 - 2 * t);
  // Réactions du corps (durées, priorité) et gestes des bras (durées).
  const REACT = { hit: 0.28, healed: 0.45, immune: 0.55, barrierBreak: 0.4, dodge: 0.46, spawn: 0.5, escape: 0.75, die: 1.0 };
  const PRIO = { hit: 1, healed: 2, immune: 3, barrierBreak: 3, dodge: 5, spawn: 7, escape: 8, die: 9 };
  const GESTURE = { pickup: 0.55, drop: 0.6, heal: 0.7, smoke: 0.6, tune: 1.3, lasso: 1.0 };
  A.KO_DURATION = REACT.die;
  A.ESCAPE_DURATION = REACT.escape;
  A.EVENTS = Object.keys(REACT).concat(Object.keys(GESTURE));
  const NB = BODY.length;
  const ORDER_YXZ = new Set([BI.root, BI.hips, BI.body, BI.head]);
  const IDENTITY = new THREE.Matrix4();

  class Actor {
    constructor(tpl) {
      this.id = _uid++;
      this.tpl = tpl;
      this.spec = tpl.spec;
      this.type = tpl.type;
      this.rank = tpl.rank;
      this.champion = tpl.rank >= 1;
      this.boss = tpl.rank >= 2;
      this.elite = this.champion; // ancien nom
      this.label = tpl.spec.label;
      this.dims = tpl.spec.dims;
      this.scale = tpl.spec.scale || 1;
      this.sizeFactor = A.sizeFactor(tpl.rank);
      /** Sommet sans agrandissement de rang (m) ; a.height donne la valeur dans le repère du parent. */
      this.baseHeight = tpl.spec.height;
      const cp = tpl.spec.carry.pos;
      this.carryLift = Math.max(0, (cp[1] + 0.32) * this.scale - this.baseHeight);
      /** Vitesse (m/s) de démonstration (galerie) : celle du jeu pour ce type. */
      this.naturalSpeed = tpl.spec.natural;
      this.gait = Object.assign({}, GAIT[tpl.spec.motion.gait || "walk"], tpl.spec.motion.gaitOver || null);
      this.mountDef = tpl.spec.mount ? A.MOUNTS[tpl.spec.mount.kind] : null;
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
      // point d'accroche de la gemme portée (au-dessus de la tête, suit les bras)
      this.carryAnchor = new THREE.Object3D();
      this.carryAnchor.name = "ptmt:carry";
      this.B.p_gem.add(this.carryAnchor);
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
      const pr = this.pr, pt = this.pt;
      this._R = (b, x, y, z) => { pr[b * 3] += x; pr[b * 3 + 1] += y; pr[b * 3 + 2] += z; };
      this._T = (b, x, y, z) => { pt[b * 3] += x; pt[b * 3 + 1] += y; pt[b * 3 + 2] += z; };
      this.armCur = { l: new Float32Array(10), r: new Float32Array(10) };
      this.armTmp = new Float32Array(10);
      this.w = {};
      this.fly = {};
      /** Mouvement de la selle (monture) appliqué au bassin du cavalier. */
      this.mm = { y: 0, z: 0, pitch: 0, roll: 0, yaw: 0 };
      this.mountT = {};
      this.face = { open: 1, wide: 1, tilt: 0, up: 0, mouth: 0, grin: 1, lookX: 0, lookY: 0, tx: 0, ty: 0, lookT: 0, blinkT: 2, blink: 0, dizzy: 0 };
      this.target = new THREE.Vector3();
      this._reach = { x: 0, z: 0, len: 0 };
      this.hasTarget = false;
      this.anchor = { head: new THREE.Vector3(), headTop: new THREE.Vector3(), chest: new THREE.Vector3(), gem: new THREE.Vector3(), exhaust: new THREE.Vector3(), hand: new THREE.Vector3(), feet: new THREE.Vector3(), fwd: new THREE.Vector3(), right: new THREE.Vector3(), eyeL: new THREE.Vector3(), eyeR: new THREE.Vector3() };
      this.reset();
    }

    /** Sommet (m, depuis les pieds, dans le repère du parent) : pour placer la barre de vie. */
    get height() {
      return (this.baseHeight + this.carryLift * (this.w.carry || 0)) * this.object.scale.y;
    }
    set height(v) {
      // compatibilité : l'ancien code écrivait a.height ; on garde la valeur de base
      this.baseHeight = v / Math.max(1e-3, this.object.scale.y);
    }
    /** Échelle totale (gabarit × rang) appliquée au personnage dans le repère du parent. */
    get worldScale() {
      return this.scale * this.object.scale.y;
    }

    reset() {
      this.object.visible = true;
      this.object.position.set(0, 0, 0);
      this.object.rotation.set(0, 0, 0);
      this.object.scale.setScalar(this.sizeFactor);
      this.rig.position.set(0, 0, 0);
      this.rig.quaternion.identity();
      this.rig.scale.setScalar(this.scale);
      const w = this.w;
      for (const k of ["carry", "frozen", "wet", "burn", "ghost", "haste", "water", "fear", "stun", "radiance", "barrier", "disarm", "armL", "armR", "flash", "move", "diss", "imm", "hp"]) w[k] = 0;
      w.hp = 1;
      this.prev = { carrying: false };
      this.react = null;
      this.reactT = 0;
      this.gesture = null;
      this.gestureT = 0;
      this.finished = false;
      this.dead = false;
      this.speed = 0;
      this.phase = Math.random() * TAU;
      this.idleT = Math.random() * 10;
      this.wheelA = 0;
      this.spin = 0;
      this.dodgeSide = 1;
      this.hatGone = false;
      this.gemPop = 1;
      this.lassoA = Math.random() * TAU;
      this.hasTarget = false;
      this.look = [0, 0];
      this.lookTo = [0, 0];
      this.lookT = 0;
      this.emitT = {};
      this.time = 0;
      this.state = EMPTY;
      this._poofed = false;
      this.seed = Math.random();
      const mm = this.mm;
      mm.y = mm.z = mm.pitch = mm.roll = mm.yaw = 0;
      for (const k in this.mountT) this.mountT[k] = 0;
      for (const k in this.fly) this._landProp(k);
      for (const b of this.tpl.bones) {
        const bone = this.B[b.name];
        bone.position.copy(this.rest[b.name]);
        bone.quaternion.identity();
        bone.scale.set(1, 1, 1);
      }
      // la gemme garde sa taille quel que soit le rang
      this.carryAnchor.scale.setScalar(1 / (this.scale * this.sizeFactor));
      this.armCur.l.set(ARM.rest);
      this.armCur.r.set(ARM.rest);
      const f = this.face;
      f.open = 1; f.wide = 1; f.tilt = 0; f.up = 0; f.mouth = 0; f.grin = 1; f.lookX = 0; f.lookY = 0; f.tx = 0; f.ty = 0; f.lookT = 0; f.blinkT = 1 + Math.random() * 3; f.blink = 0; f.dizzy = 0;
      if (this.mountDef) this.mountDef.pose(this, 0.016, EMPTY, false, 0);
      this._pose(0.016, EMPTY, false, 0);
      if (this.spec.animate) this.spec.animate(this, 0.016, EMPTY, false, 0);
      this._writeData(0);
    }

    // --- événements ponctuels ------------------------------------------------------------------
    /**
     * name : "hit" | "die" | "pickup" | "drop" | "heal" | "healed" | "smoke" | "tune" | "lasso" | "dodge"
     *        | "barrierBreak" | "spawn" | "escape" | "immune". target (facultatif) : position monde visée
     *        (crêpe lancée vers l'allié soigné, lasso vers la gemme).
     */
    event(name, target) {
      if (this.dead) return;
      if (target && target.x !== undefined) {
        this.target.set(target.x, target.y || 0, target.z);
        this.hasTarget = true;
      } else this.hasTarget = false;
      if (GESTURE[name] !== undefined) {
        this.gesture = name;
        this.gestureT = 0;
      } else if (REACT[name] !== undefined) {
        if (name === "die") {
          this.dead = true;
          this.gesture = null;
          this._react("die");
          if (this.B.p_hat && !this.hatGone) {
            this.hatGone = true;
            this._launchProp("hat", (Math.random() - 0.5) * 2, 4.2, -1.6, 12);
          }
        } else if (name === "hit") {
          if (!this.react || this.react === "hit") this._react("hit");
          this.w.flash = 1;
        } else {
          if (this.react && PRIO[this.react] > PRIO[name] && this.reactT < REACT[this.react]) return;
          if (name === "dodge") this.dodgeSide = Math.random() < 0.5 ? -1 : 1;
          if (name === "immune") this.w.imm = 1;
          this._react(name);
        }
      } else return;
      const ov = A.overlay;
      if (ov && ov.burst) ov.burst(this, name);
    }
    _react(name) {
      this.react = name;
      this.reactT = 0;
    }
    /** Fait décoller un accessoire (chapeau) dans le repère de la scène. */
    _launchProp(name, side, up, back, spin) {
      const bone = this.B["p_" + name];
      const scene = this.object.parent;
      if (!bone || !scene) { if (bone) bone.scale.setScalar(0); return; }
      this.object.updateMatrixWorld(true);
      bone.matrixWorld.decompose(_v, _q, _v2);
      const f = { bone, parent: bone.parent, t: 0, pos: _v.clone(), quat: _q.clone(), scl: _v2.clone(), vel: new THREE.Vector3(), spin: new THREE.Vector3(spin, spin * 0.4, spin * 0.25), ground: this.object.position.y };
      const yaw = this.object.rotation.y;
      const fx = Math.sin(yaw), fz = Math.cos(yaw);
      const k = this.object.scale.y;
      f.vel.set((fz * side * 0.6 + fx * back * 0.5) * k, up * Math.sqrt(k), (-fx * side * 0.6 + fz * back * 0.5) * k);
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
        if (f.pos.y < f.ground + 0.08 && f.vel.y < 0) {
          f.pos.y = f.ground + 0.08;
          f.vel.multiplyScalar(0.45);
          f.vel.y = -f.vel.y * 0.7;
          f.spin.multiplyScalar(0.5);
        }
        _e.set(f.spin.x * dt, f.spin.y * dt, f.spin.z * dt, "XYZ");
        f.quat.multiply(_q.setFromEuler(_e));
        const shrink = f.t > 0.8 ? Math.max(0, 1 - (f.t - 0.8) / 0.2) : 1;
        f.bone.position.copy(f.pos);
        f.bone.quaternion.copy(f.quat);
        f.bone.scale.copy(f.scl).multiplyScalar(shrink);
        if (shrink <= 0) this._landProp(k);
      }
    }

    // --- mise à jour -------------------------------------------------------------------------
    /**
     * s = { speed (m/s au sol), moving, carrying, water, slow (0..1), freeze, burn, fear, invisible (0..1),
     *       barrier (0..1), haste, stun, disarmed, radiance, hp (0..1) }
     */
    update(dt, time, s) {
      s = s || EMPTY;
      dt = clamp(dt || 0, 0, 0.1);
      this.time = time;
      this.state = s;
      A._timeUniform.value = time;
      const ov = A.overlay;
      if (ov && ov.frame) ov.frame(time, this.object);
      const w = this.w;

      // réaction et geste en cours
      if (this.react) {
        this.reactT += dt;
        if (this.reactT >= REACT[this.react]) {
          if (this.react === "die" || this.react === "escape") this.finished = true;
          else this.react = null;
        }
      }
      if (this.gesture) {
        this.gestureT += dt;
        if (this.gestureT >= GESTURE[this.gesture]) this.gesture = null;
      }
      const dead = this.dead, gone = this.react === "escape";
      const frozen = !!s.freeze && !dead;
      const moving = !!s.moving && !dead && !gone;
      const speed = moving ? Math.max(0, s.speed === undefined ? this.naturalSpeed : s.speed) : 0;
      this.speed = speed;

      // poids lissés
      w.carry = smooth(w.carry, s.carrying && !dead ? 1 : 0, dt, 10);
      w.frozen = smooth(w.frozen, frozen ? 1 : 0, dt, 14);
      w.wet = smooth(w.wet, clamp((s.slow || 0) * 1.8, 0, 1), dt, 3);
      w.burn = smooth(w.burn, s.burn && !dead ? 1 : 0, dt, 6);
      w.ghost = smooth(w.ghost, clamp(s.invisible || 0, 0, 1), dt, 8);
      w.haste = smooth(w.haste, s.haste && !dead ? 1 : 0, dt, 6);
      w.water = smooth(w.water, s.water ? 1 : 0, dt, 4);
      w.fear = smooth(w.fear, s.fear && !dead ? 1 : 0, dt, 8);
      w.stun = smooth(w.stun, s.stun && !dead ? 1 : 0, dt, 10);
      w.radiance = smooth(w.radiance, s.radiance && !dead ? 1 : 0, dt, 6);
      w.barrier = smooth(w.barrier, dead ? 0 : clamp(s.barrier || 0, 0, 1), dt, 10);
      w.disarm = smooth(w.disarm, s.disarmed && !dead ? 1 : 0, dt, 6);
      w.hp = s.hp === undefined ? 1 : s.hp;
      w.move = smooth(w.move, moving ? 1 : 0, dt, 7);
      w.imm = Math.max(0, w.imm - dt * 2.2);
      w.flash = Math.max(0, w.flash - dt * 5);
      if (s.carrying && !this.prev.carrying) this.gemPop = 0;
      this.gemPop = Math.min(1, this.gemPop + dt / 0.35);
      this.prev.carrying = !!s.carrying;

      const solid = frozen && w.frozen > 0.98;
      if (!solid) {
        if (this.mountDef) this.mountDef.pose(this, dt, s, moving, speed);
        this._pose(dt, s, moving, speed);
        if (this.spec.animate) this.spec.animate(this, dt, s, moving, speed);
      }
      this._rigLayer(dt, s, moving, speed, solid);
      this._common(dt, s, moving, speed);
      this._updateFly(dt);
      w.diss = this.react === "die" ? clamp((this.reactT - 0.72) / 0.26, 0, 1) : this.react === "escape" ? clamp((this.reactT - 0.55) / 0.2, 0, 1) : 0;
      this._writeData(speed);
      if (ov && ov.actor) ov.actor(this, dt, s);
    }

    // --- pose du squelette (couches : démarche, monture, bras, réactions, visage) ---------------
    _pose(dt, s, moving, speed) {
      const pr = this.pr, pt = this.pt, ps = this.ps;
      pr.fill(0);
      pt.fill(0);
      ps.fill(1);
      const spec = this.spec, mo = spec.motion, g = this.gait, w = this.w;
      const t = this.time;
      const R = this._R, T = this._T;
      const ride = !!spec.mount;
      const react = this.react, rt = this.reactT, dead = react === "die";
      const ges = this.gesture, gt = this.gestureT;

      // 1) démarche (à reculons quand il a peur)
      const amp = ride ? 0 : w.move;
      const back = w.fear > 0.5 ? -1 : 1;
      const rateMul = (1 + 0.5 * w.haste) * (s.burn ? 1.25 : 1) * (1 + 0.35 * w.fear);
      const rate = moving ? Math.max(0.6, speed / g.stride) * rateMul : 0;
      this.phase += dt * rate * TAU * back;
      this.idleT += dt;
      const ph = this.phase;
      const sn = Math.sin(ph), cs = Math.cos(ph);
      if (!ride) {
        for (let si = 0; si < 2; si++) {
          const p = ph + (si ? Math.PI : 0), sp = Math.sin(p), cp = Math.cos(p);
          const th = si ? BI.thigh_r : BI.thigh_l, sh = si ? BI.shin_r : BI.shin_l, ft = si ? BI.foot_r : BI.foot_l;
          const lift = Math.max(0, cp * back);
          R(th, -g.leg * sp * amp - (g.crouch ? 0.25 * amp : 0), 0, 0);
          R(sh, (g.knee * lift + (g.crouch ? 0.4 : 0)) * amp, 0, 0);
          R(ft, -(-g.leg * sp + g.knee * lift) * 0.55 * amp, 0, 0);
        }
        const bob = g.bob * (Math.abs(cs) - 0.5) * 2 * amp;
        T(BI.hips, 0, bob - (g.crouch || 0) * amp, 0);
        R(BI.hips, 0, g.twist * sn * amp, g.roll * sn * amp);
        const lean = g.lean * (1 - 1.9 * w.fear) + 0.12 * w.haste;
        R(BI.body, lean * amp, -g.twist * 1.3 * sn * amp, -g.roll * 0.4 * sn * amp);
        R(BI.head, -lean * 0.55 * amp + Math.sin(ph * 2 - 0.8) * 0.04 * amp, 0, g.roll * 0.6 * sn * amp);
      } else {
        // en selle : bassin sur la selle (mouvement de la monture), jambes de part et d'autre
        const st = spec.mount.seat, mm = this.mm;
        T(BI.hips, 0, st.dy + mm.y, st.dz + mm.z);
        R(BI.hips, mm.pitch, mm.yaw, mm.roll);
        for (let si = 0; si < 2; si++) {
          const sg = si ? -1 : 1;
          R(si ? BI.thigh_r : BI.thigh_l, st.thigh, 0, sg * st.spread);
          R(si ? BI.shin_r : BI.shin_l, st.shin, 0, -sg * st.spread * 0.55);
          R(si ? BI.foot_r : BI.foot_l, st.foot || 0.1, 0, 0);
        }
        R(BI.body, (st.lean || 0) - mm.pitch * 0.5, 0, -mm.roll * 0.4);
      }
      // respiration au repos
      const idle = 1 - w.move;
      if (!dead) {
        const br = Math.sin(this.idleT * 2.2 + this.id);
        ps[BI.body * 3 + 1] *= 1 + br * 0.018 * idle;
        R(BI.head, br * 0.02 * idle, 0, 0);
      }

      // 2) bras
      let poseL = null, poseR = null, osc = null;
      const arms = mo.arms || NO_ARMS;
      const carry = !!s.carrying && !dead;
      const carryArms = spec.carry.arms;
      if (dead) poseL = poseR = "koA";
      else if (react === "escape" || ges === "pickup") poseL = poseR = "cheer";
      else if (ges === "drop") poseL = poseR = "shrug";
      else if (ges === "heal" || ges === "smoke") {
        poseR = gt < 0.24 ? "throwA" : "throwB";
        poseL = carry ? carryArms[0] : arms[0];
      } else if (ges === "lasso") {
        poseR = gt < 0.3 ? "lasso" : gt < 0.75 ? "toss" : "lasso";
        poseL = arms[0];
      } else if ((w.fear > 0.5 || s.burn) && !ride && !carry) osc = "flail";
      else if (w.stun > 0.5 && !carry) poseL = poseR = "droop";
      else if (carry) { poseL = carryArms[0]; poseR = carryArms[1]; }
      else { poseL = arms[0]; poseR = arms[1]; }
      if (w.disarm > 0.5 && !carry && !dead && !ges && poseR && mo.disarmDrop) poseR = "droop";
      const tmp = this.armTmp;
      for (let si = 0; si < 2; si++) {
        const side = si ? "r" : "l";
        const sg = si ? -1 : 1;
        const name = si ? poseR : poseL;
        let active = false, fast = false;
        const o = osc ? OSC[osc] : name ? OSC[name] : null;
        if (o) {
          const a = ARM[o[0]], b = ARM[o[1]];
          const k = 0.5 + 0.5 * Math.sin(t * o[2] * (ges === "tune" && name === "pipe" ? 1.6 : 1) + (si ? o[3] : 0) + this.id);
          for (let i = 0; i < 10; i++) tmp[i] = a[i] + (b[i] - a[i]) * k;
          active = true;
          fast = true;
        } else if (name && ARM[name]) {
          tmp.set(ARM[name]);
          active = true;
        }
        const key = si ? "armR" : "armL";
        const cur = this.armCur[side];
        if (active) {
          const kk = w[key] < 0.02 ? 1 : 1 - Math.exp(-dt * (fast || ges ? 30 : 12));
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
      // K.-O. : jambes en l'air (à pied)
      if (dead && !ride) {
        for (let si = 0; si < 2; si++) {
          R(si ? BI.thigh_r : BI.thigh_l, -0.9 + Math.sin(t * 9 + si) * 0.12, 0, (si ? -1 : 1) * 0.35);
          R(si ? BI.shin_r : BI.shin_l, 0.5, 0, 0);
        }
      }
      // gestes : lancer (le buste accompagne), ramassage (accroupi puis debout), air de biniou (balancement)
      if (ges === "heal" || ges === "smoke") {
        const k = gt < 0.24 ? -gt / 0.24 : Math.sin(clamp((gt - 0.24) / 0.3, 0, 1) * Math.PI);
        R(BI.body, 0.25 * k, 0.35 * (gt < 0.24 ? -gt / 0.24 : 1 - clamp((gt - 0.24) / 0.4, 0, 1)), 0);
      }
      if (ges === "pickup" && !ride) {
        const k = Math.sin(clamp(gt / 0.22, 0, 1) * Math.PI);
        T(BI.hips, 0, -0.18 * k, 0);
        R(BI.body, 0.5 * k, 0, 0);
        for (let si = 0; si < 2; si++) { R(si ? BI.thigh_r : BI.thigh_l, -0.8 * k, 0, 0); R(si ? BI.shin_r : BI.shin_l, 1.3 * k, 0, 0); }
      }
      if (ges === "tune") {
        const k = Math.sin(clamp(gt / GESTURE.tune, 0, 1) * Math.PI);
        R(BI.body, -0.12 * k, Math.sin(gt * 9) * 0.15 * k, Math.sin(gt * 4.5) * 0.12 * k);
        R(BI.head, -0.2 * k, 0, Math.sin(gt * 9) * 0.12 * k);
      }
      // porteur : petit dandinement de joie
      if (carry && moving && !dead) R(BI.head, 0, 0, Math.sin(ph) * 0.05);

      // 3) tête : K.-O., étourdi, coup, peur (regarde derrière lui)
      if (dead) R(BI.head, 0, 0, Math.sin(t * 6) * 0.22);
      if (w.stun > 0.01) R(BI.head, Math.cos(t * 5) * 0.12 * w.stun, 0, Math.sin(t * 5) * 0.18 * w.stun);
      if (react === "hit") { const k = Math.sin((rt / REACT.hit) * Math.PI); R(BI.head, 0.35 * k, 0, 0); R(BI.body, -0.15 * k, 0, 0); }
      if (react === "dodge") { const k = Math.sin(clamp(rt / REACT.dodge, 0, 1) * Math.PI); R(BI.body, 0, 0, -this.dodgeSide * 0.35 * k); }
      if (react === "immune") { const k = Math.sin(clamp(rt / REACT.immune, 0, 1) * Math.PI); R(BI.body, -0.18 * k, 0, 0); R(BI.head, -0.15 * k, 0, 0); }
      if (w.fear > 0.01 && !dead) R(BI.head, 0, Math.sin(t * 6.5) * 0.55 * w.fear, 0);

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
      const f = this.face, w = this.w, t = this.time, spec = this.spec;
      const dead = react === "die";
      // humeur : [ouverture, écarquillé, sourcils (colère > 0), hauteur, bouche ouverte, sourire large]
      const m = MOODS[spec.mood] || MOODS.neutral;
      let open = m[0], wide = m[1], tilt = m[2], up = m[3], mouth = m[4], grin = m[5];
      if (spec.mood === "angry" && moving) mouth = 0.55 + 0.45 * Math.abs(Math.sin(t * 5 + this.id));
      if (spec.mood === "puff") mouth = 0.15;
      const scared = s.burn || w.fear > 0.5 || s.freeze;
      if (s.carrying) { tilt = -0.15; up = 0.02; grin = 1.45; open = 0.8; mouth = Math.max(mouth, 0.3); }
      if (scared) { wide = 1.25; tilt = -0.38; up = 0.05; mouth = 1; grin = 0.8; open = 1; }
      if (w.stun > 0.5) { wide = 1.05; tilt = -0.2; mouth = 0.6; }
      if (react === "hit") { open = 0.15; tilt = 0.45; mouth = 0.6; }
      if (this.gesture === "pickup" || react === "escape") { open = 0.55; tilt = -0.25; up = 0.04; mouth = 0.8; grin = 1.5; }
      if (this.gesture === "drop") { wide = 1.2; tilt = -0.4; up = 0.05; mouth = 0.5; }
      if (react === "immune") { open = 0.6; tilt = 0.2; grin = 1.4; mouth = 0.2; }
      if (dead) { wide = 1.1; tilt = -0.2; up = 0.03; mouth = 1; }
      const k = 1 - Math.exp(-dt * 14);
      f.open += (open - f.open) * k;
      f.wide += (wide - f.wide) * k;
      f.tilt += (tilt - f.tilt) * k;
      f.up += (up - f.up) * k;
      f.mouth += (mouth - f.mouth) * k;
      f.grin += (grin - f.grin) * k;
      f.dizzy = dead || w.stun > 0.5 ? Math.min(1, f.dizzy + dt * 4) : Math.max(0, f.dizzy - dt * 4);
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
      ps[BI.mouth * 3 + 1] = 1 + f.mouth * 2.6;
    }

    _rigLayer(dt, s, moving, speed, solid) {
      const spec = this.spec, w = this.w, rig = this.rig, t = this.time;
      if (solid) return;
      const ride = !!spec.mount;
      let y = 0, pitch = 0, roll = 0, yaw = 0, sx = 1, sy = 1, px = 0, pz = 0, pivotY = 0;
      const ph = this.phase;
      const react = this.react, rt = this.reactT;
      // petit bond à chaque pas (en l'air au passage des jambes, écrasé au contact)
      if (!ride && w.move > 0.01) {
        const g = this.gait, up = Math.abs(Math.cos(ph)), k = w.move;
        y += up * (g.hop || 0) * w.move;
        sy *= 1 + (up - 0.5) * 0.07 * k;
        sx *= 1 - (up - 0.5) * 0.045 * k;
      }
      // états
      if (s.burn && !ride && !this.dead) y += Math.abs(Math.sin(t * 9)) * 0.12;
      if (w.stun > 0.01) { roll += Math.sin(t * 4.5) * 0.07 * w.stun; pitch += Math.cos(t * 4.5) * 0.04 * w.stun; }
      if (w.fear > 0.01) px += Math.sin(t * 31) * 0.02 * w.fear;
      // réactions
      if (react === "hit") { const k = Math.sin((rt / REACT.hit) * Math.PI); sy *= 1 - 0.12 * k; sx *= 1 + 0.09 * k; }
      if (react === "healed") { const k = Math.sin(clamp(rt / REACT.healed, 0, 1) * Math.PI); y += 0.25 * k; sy *= 1 + 0.06 * k; }
      if (react === "barrierBreak") { const k = Math.sin(clamp(rt / REACT.barrierBreak, 0, 1) * Math.PI); sy *= 1 - 0.1 * k; sx *= 1 + 0.08 * k; }
      if (react === "dodge") {
        // cadrage-débordement : bond de côté puis retour
        const k = clamp(rt / REACT.dodge, 0, 1);
        const q = Math.sin(k * Math.PI);
        px += this.dodgeSide * q * 1.0;
        roll -= this.dodgeSide * q * 0.22;
        y += Math.sin(Math.min(1, k * 2) * Math.PI) * 0.22;
      }
      if (react === "spawn") {
        const k = clamp(rt / REACT.spawn, 0, 1);
        const sc = k < 0.55 ? backOut(k / 0.55) : 1 + 0.08 * Math.sin(((k - 0.55) / 0.45) * Math.PI) * (1 - k);
        sx *= Math.max(0.01, sc); sy *= Math.max(0.01, sc);
        y += (1 - Math.min(1, k * 2)) * 0.6;
      }
      if (react === "escape") {
        // saut de joie, pirouette, puis « pouf »
        const k = clamp(rt / REACT.escape, 0, 1);
        y += Math.sin(Math.min(1, k / 0.7) * Math.PI) * 1.3;
        yaw += ease(k) * TAU;
        const sh = 1 - clamp((k - 0.62) / 0.3, 0, 1);
        sx *= Math.max(0.001, sh); sy *= Math.max(0.001, sh * (1 + 0.3 * (1 - sh)));
      }
      if (react === "die") {
        const C = spec.center;
        if (ride) {
          // la monture bascule sur le flanc
          const k = clamp(rt / 0.34, 0, 1);
          const side = this.id % 2 ? 1 : -1;
          roll += side * bounceOut(k) * 1.35;
          px += side * bounceOut(k) * 0.35 * (spec.dims.w / this.scale);
          y += Math.sin(clamp(rt / 0.2, 0, 1) * Math.PI) * 0.25;
        } else {
          // chute en arrière, rebond, puis couché
          const k = clamp(rt / 0.32, 0, 1);
          pitch -= bounceOut(k) * (Math.PI / 2 - 0.12);
          y += Math.sin(clamp(rt / 0.2, 0, 1) * Math.PI) * 0.35 + 0.16 * bounceOut(k);
          pz -= bounceOut(k) * 0.2;
          pivotY = 0.05;
          if (rt < 0.4) { const q = Math.sin(clamp(rt / 0.4, 0, 1) * Math.PI); sy *= 1 + 0.1 * q; }
          void C;
        }
        const sh = clamp((rt - 0.72) / 0.26, 0, 1);
        sx *= 1 - 0.3 * sh; sy *= 1 - 0.3 * sh;
      }
      // composition : pivot près du sol pour les chutes
      _e.set(pitch, yaw, roll, "YXZ");
      rig.quaternion.setFromEuler(_e);
      const sc = this.scale;
      _v.set(0, pivotY * sc, 0);
      _v2.copy(_v).applyQuaternion(rig.quaternion);
      rig.position.set(px + _v.x - _v2.x, y + _v.y - _v2.y, pz + _v.z - _v2.z);
      rig.scale.set(sx * sc, sy * sc, sx * sc);
    }

    /** Accessoires communs : gemme portée (petit saut à la prise), cape, chapeau. */
    _common(dt, s, moving, speed) {
      const B = this.B, w = this.w, t = this.time;
      // gemme : ancre qui « pop » à la prise et suit le pas
      const gb = B.p_gem, gr = this.rest.p_gem;
      if (gb) {
        const p = this.gemPop;
        const k = s.carrying ? (p < 1 ? 0.35 + 0.65 * backOut(p) : 1) : 1;
        gb.scale.setScalar(k);
        gb.position.set(gr.x, gr.y + (moving ? Math.abs(Math.sin(this.phase)) * 0.06 : Math.sin(t * 2.4 + this.id) * 0.03), gr.z);
        gb.rotation.set(0, 0, moving ? Math.sin(this.phase) * 0.06 : 0);
      }
      // cape : se soulève avec la vitesse et ondule
      if (B.p_cape && !this.dead) {
        const k = Math.min(1, speed / 4);
        B.p_cape.rotation.set(0.12 + 0.45 * k + Math.sin(t * 7 + this.id) * 0.05 * (0.3 + k), 0, Math.sin(this.phase) * 0.06 * w.move);
      }
      if (B.p_hat && !this.fly.hat) {
        B.p_hat.scale.setScalar(this.hatGone ? 0 : 1);
        if (!this.hatGone) B.p_hat.rotation.set(this.react === "hit" ? -0.25 * Math.sin((this.reactT / REACT.hit) * Math.PI) : 0, 0, 0);
      }
    }

    /**
     * Accessoire tenu en main (os p_<name>, enfant de la main) gardé dans une orientation voulue par
     * rapport au buste : on annule la rotation cumulée du bras, puis on applique (rx, ry, rz).
     */
    hold(name, side, rx, ry, rz) {
      const b = this.B["p_" + name];
      if (!b) return;
      const bones = this.bones;
      const arm = bones[side ? BI.arm_r : BI.arm_l], fore = bones[side ? BI.fore_r : BI.fore_l], hand = bones[side ? BI.hand_r : BI.hand_l];
      _q.copy(arm.quaternion).multiply(fore.quaternion).multiply(hand.quaternion).invert();
      _q2.setFromEuler(_e.set(rx || 0, ry || 0, rz || 0, "XYZ"));
      b.quaternion.copy(_q).multiply(_q2);
    }

    /** Décale un accessoire tenu en main, le décalage (ox, oy, oz) étant exprimé dans le repère du buste. */
    holdOffset(name, side, ox, oy, oz) {
      const b = this.B["p_" + name];
      if (!b) return;
      const r = this.rest["p_" + name];
      if (!ox && !oy && !oz) { b.position.copy(r); return; }
      const bones = this.bones;
      _q.copy(bones[side ? BI.arm_r : BI.arm_l].quaternion).multiply(bones[side ? BI.fore_r : BI.fore_l].quaternion).multiply(bones[side ? BI.hand_r : BI.hand_l].quaternion).invert();
      _v.set(ox, oy, oz).applyQuaternion(_q);
      b.position.copy(r).add(_v);
    }
    /** Oriente un bout de corde (cylindre unité le long de +Y, os enfant de la main) vers (dx, dy, dz),
     *  vecteur du repère du buste, et l'étire à sa longueur ; show = 0 le cache. */
    aimFromHand(name, side, dx, dy, dz, show) {
      const b = this.B["p_" + name];
      if (!b) return;
      const len = Math.hypot(dx, dy, dz);
      if (!show || len < 1e-4) { b.scale.setScalar(0); return; }
      const bones = this.bones;
      _q.copy(bones[side ? BI.arm_r : BI.arm_l].quaternion).multiply(bones[side ? BI.fore_r : BI.fore_l].quaternion).multiply(bones[side ? BI.hand_r : BI.hand_l].quaternion).invert();
      _v.set(dx / len, dy / len, dz / len);
      _q2.setFromUnitVectors(_UP, _v);
      b.quaternion.copy(_q).multiply(_q2);
      b.scale.set(1, len, 1);
    }
    /** Vecteur horizontal (repère du personnage, m avant échelle) vers la cible de l'événement, borné. */
    reachTo(maxLen, defLen) {
      const r = this._reach;
      if (!this.hasTarget || !this.object.parent) { r.x = 0; r.z = defLen; r.len = defLen; return r; }
      this.object.updateMatrixWorld();
      _v.copy(this.target);
      this.object.worldToLocal(_v);
      _v.divideScalar(this.scale);
      const len = Math.hypot(_v.x, _v.z) || 1e-3;
      const k = Math.min(1, maxLen / len);
      r.x = _v.x * k; r.z = _v.z * k; r.len = len * k;
      return r;
    }

    _writeData(speed) {
      const e = this.dataBone.matrixWorld.elements, w = this.w;
      e[0] = Math.max(w.flash, this.react === "hit" ? Math.max(0, 1 - this.reactT / REACT.hit) * 0.8 : 0); e[1] = w.wet; e[2] = w.frozen; e[3] = w.burn;
      e[4] = w.ghost * 0.85; e[5] = w.diss; e[6] = w.imm; e[7] = w.haste;
      e[8] = Math.min(1.5, speed / 3); e[9] = w.radiance; e[10] = w.stun; e[11] = this.seed;
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
  // Humeurs : [ouverture, écarquillé, sourcils (colère > 0), hauteur, bouche, sourire]
  const MOODS = {
    neutral: [1, 1, 0.28, 0, 0, 1],
    angry: [0.85, 1.05, 0.7, -0.02, 0.6, 1.1],
    sly: [0.6, 1, 0.35, 0, 0, 1.35],
    stern: [0.7, 1, 0.45, -0.01, 0, 0.9],
    calm: [0.55, 1, -0.1, 0.01, 0, 1.15],
    jolly: [0.9, 1.05, -0.2, 0.03, 0.35, 1.45],
    sneaky: [0.65, 1, 0.4, 0, 0, 1.25],
    fierce: [0.8, 1.05, 0.55, -0.01, 0.45, 1.2],
    puff: [0.75, 1, 0.1, 0.02, 0.15, 0.7],
    proud: [0.8, 1, 0.3, 0, 0, 1.3],
  };
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
  function backOut(t) {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }
  A.Actor = Actor;
  A.MOUNTS = A.MOUNTS || {};

  // ---------------------------------------------------------------------------------------------
  // API publique
  // ---------------------------------------------------------------------------------------------
  /** Crée (ou réutilise) un ennemi. type : une clé de PTMT.actors.TYPES ; champion, boss : booléens. */
  A.create = function (type, champion, boss) {
    if (!A.ready) throw new Error("PTMT.actors.create : appeler d’abord await PTMT.actors.load()");
    const rank = boss ? 2 : champion ? 1 : 0;
    const tpl = templateFor(type, rank);
    const pool = POOLS.get(tpl.key);
    let a = pool && pool.length ? pool.pop() : null;
    if (a) { a.reset(); a.released = false; a.object.visible = true; }
    else a = new Actor(tpl);
    a.mesh.castShadow = !A.mobile;
    A.actives.add(a);
    return a;
  };
  /** Pré-remplit la réserve (évite les pics de création en jeu). */
  A.prewarm = function (type, champion, boss, count) {
    const list = [];
    for (let i = 0; i < (count || 1); i++) list.push(A.create(type, champion, boss));
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
})();
