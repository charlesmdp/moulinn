// « Pas touche à mes trésors » — socle des objets posés sur la carte (décor, gemmes, repaire…).
//
// Outils partagés par 41-gems.js (gemmes, moulin-repaire), 42-landmarks.js (menhirs, entrées),
// 43-forests.js (forêts à couper, petits éléments de sol) et 44-decor.js (décor des cases X) :
//  - des gabarits de géométries indexées (sphères cabossées, rochers, cônes, lames, frondes…) ;
//  - un accumulateur (P.Acc) qui fusionne des milliers de pièces transformées en UN maillage par
//    matière : couleurs de sommets (dégradés, mousse, occlusion, grain), UV projetées, et pour chaque
//    sommet son pivot (pied de la plante), sa case, son balancement au vent, sa lueur et son rôle ;
//  - la matière « peinte » commune (MeshStandardMaterial retouchée) : balancement au vent, chute des
//    arbres d'une case coupée (lue dans une petite texture d'états : les lots ne sont jamais
//    reconstruits), roue et cloche du moulin, liseré sombre sur les silhouettes rondes, couleurs
//    franches même à l'ombre, scintillement ; et sa jumelle pour les ombres portées ;
//  - des lueurs et particules animées entièrement par la carte graphique (fumée, étincelles, gouttes,
//    halos, chevrons au sol, rayons, ondes), toutes dans un seul appel de dessin par objet grâce à
//    l'alpha prémultiplié (chaque sprite choisit son mélange, de normal à additif).
//
// Rôles de sommet (aInfo.w) : 0 plante qui tombe à la coupe, 1 fixe (souche, bâti), 2 s'enfonce à la
// coupe (rocher, tertre), 3 roue du moulin, 4 cloche du moulin, 5 tas de gemmes (s'aplatit).
(function () {
  "use strict";
  const PTMT = globalThis.PTMT;
  if (!PTMT || typeof THREE === "undefined" || !PTMT.models || !PTMT.models.kit) return;
  const K = PTMT.models.kit;
  const P = (PTMT.models.props = PTMT.models.props || {});
  const { TAU, clamp, lerp, smooth } = K.math;
  const { noise3, hash2 } = K.noise;
  const col = K.col;
  P.TILE = 3.6;

  /* ------------------------------------------------------------------ horloge et vent partagés */
  // Uniformes communs à toutes les matières du décor : un seul réglage par image suffit.
  const U = (P.U = { time: { value: 0 }, wind: { value: 1 } });
  P.tick = function (time) {
    // Temps ramené sur une période longue (précision des calculs du shader sur téléphone).
    U.time.value = time % 3600;
    K.tick(time);
  };

  /* ------------------------------------------------------------------ gabarits */
  const _v = new THREE.Vector3();
  /** Gabarit : tableaux bruts d'une géométrie indexée (positions, normales, UV, indices). */
  class Tpl {
    constructor(pos, nor, idx, uv) {
      this.pos = pos;
      this.nor = nor;
      this.idx = idx;
      this.uv = uv || null;
      this.n = pos.length / 3;
      this.col = null; // couleurs propres (linéaires), sinon couleur de la pièce
      this.inf = null; // par sommet : balancement, lueur, rôle, liseré
    }
  }
  P.Tpl = Tpl;

  function smoothNormalsIdx(pos, idx) {
    const nor = new Float32Array(pos.length);
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t] * 3,
        b = idx[t + 1] * 3,
        c = idx[t + 2] * 3;
      const ux = pos[b] - pos[a],
        uy = pos[b + 1] - pos[a + 1],
        uz = pos[b + 2] - pos[a + 2];
      const vx = pos[c] - pos[a],
        vy = pos[c + 1] - pos[a + 1],
        vz = pos[c + 2] - pos[a + 2];
      const nx = uy * vz - uz * vy,
        ny = uz * vx - ux * vz,
        nz = ux * vy - uy * vx;
      for (const k of [a, b, c]) {
        nor[k] += nx;
        nor[k + 1] += ny;
        nor[k + 2] += nz;
      }
    }
    for (let i = 0; i < nor.length; i += 3) {
      const l = Math.hypot(nor[i], nor[i + 1], nor[i + 2]) || 1;
      nor[i] /= l;
      nor[i + 1] /= l;
      nor[i + 2] /= l;
    }
    return nor;
  }
  /** Soude les sommets confondus (sphères, polyèdres) : normales lisses, moins de sommets. */
  function weld(pos) {
    const map = new Map();
    const out = [];
    const idx = new Uint32Array(pos.length / 3);
    for (let i = 0; i < pos.length / 3; i++) {
      const k = Math.round(pos[i * 3] * 1e4) + "," + Math.round(pos[i * 3 + 1] * 1e4) + "," + Math.round(pos[i * 3 + 2] * 1e4);
      let j = map.get(k);
      if (j === undefined) {
        j = out.length / 3;
        map.set(k, j);
        out.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
      }
      idx[i] = j;
    }
    return { pos: new Float32Array(out), idx };
  }
  /**
   * Gabarit tiré d'une géométrie three.js.
   *  mode "smooth" : sommets soudés, normales lisses ; "flat" : facettes (normales par face) ;
   *  par défaut : la géométrie telle quelle (indices, normales et UV conservés).
   */
  function fromGeo(g, mode) {
    if (mode === "smooth") {
      const src = g.index ? g.toNonIndexed() : g;
      const w = weld(src.attributes.position.array);
      return new Tpl(w.pos, smoothNormalsIdx(w.pos, w.idx), w.idx, null);
    }
    if (mode === "flat") {
      const src = g.index ? g.toNonIndexed() : g.clone();
      src.computeVertexNormals();
      const n = src.attributes.position.count;
      const idx = new Uint32Array(n);
      for (let i = 0; i < n; i++) idx[i] = i;
      const uv = src.attributes.uv ? new Float32Array(src.attributes.uv.array) : null;
      return new Tpl(new Float32Array(src.attributes.position.array), new Float32Array(src.attributes.normal.array), idx, uv);
    }
    if (!g.attributes.normal) g.computeVertexNormals();
    const n = g.attributes.position.count;
    let idx;
    if (g.index) idx = Uint32Array.from(g.index.array);
    else {
      idx = new Uint32Array(n);
      for (let i = 0; i < n; i++) idx[i] = i;
    }
    return new Tpl(
      new Float32Array(g.attributes.position.array),
      new Float32Array(g.attributes.normal.array),
      idx,
      g.attributes.uv ? new Float32Array(g.attributes.uv.array) : null,
    );
  }
  P.fromGeo = fromGeo;

  /** Déforme les positions d'un gabarit (fonction (x, y, z, i) → [x, y, z]) puis recalcule les normales lisses. */
  function deform(t, fn, keepNormals) {
    const p = t.pos;
    for (let i = 0; i < t.n; i++) {
      const r = fn(p[i * 3], p[i * 3 + 1], p[i * 3 + 2], i);
      p[i * 3] = r[0];
      p[i * 3 + 1] = r[1];
      p[i * 3 + 2] = r[2];
    }
    if (!keepNormals) t.nor = smoothNormalsIdx(p, t.idx);
    return t;
  }
  P.deform = deform;
  /** Retire les triangles dont les trois sommets sont sous le seuil (dessous invisible d'en haut). */
  function cullBelow(t, dirY, cut) {
    const keep = [];
    for (let i = 0; i < t.idx.length; i += 3) {
      const a = t.idx[i],
        b = t.idx[i + 1],
        c = t.idx[i + 2];
      if (Math.max(dirY[a], dirY[b], dirY[c]) >= cut) keep.push(a, b, c);
    }
    t.idx = Uint32Array.from(keep);
    return t;
  }
  P.cullBelow = cullBelow;
  /** Normales arrondies (mélange avec la direction depuis le centre) : ombrage doux de boule peinte. */
  function roundNormals(t, k) {
    for (let i = 0; i < t.n; i++) {
      const x = t.pos[i * 3],
        y = t.pos[i * 3 + 1],
        z = t.pos[i * 3 + 2];
      const l = Math.hypot(x, y, z) || 1;
      let nx = t.nor[i * 3] * (1 - k) + (x / l) * k,
        ny = t.nor[i * 3 + 1] * (1 - k) + (y / l) * k,
        nz = t.nor[i * 3 + 2] * (1 - k) + (z / l) * k;
      const m = Math.hypot(nx, ny, nz) || 1;
      t.nor[i * 3] = nx / m;
      t.nor[i * 3 + 1] = ny / m;
      t.nor[i * 3 + 2] = nz / m;
    }
    return t;
  }
  P.roundNormals = roundNormals;

  // Gabarits en cache (clé → gabarit ; ne jamais modifier un gabarit partagé).
  const tplCache = new Map();
  const tc = (key, f) => {
    let t = tplCache.get(key);
    if (!t) {
      t = f();
      tplCache.set(key, t);
    }
    return t;
  };
  P.tc = tc;
  const T = (P.T = {
    /**
     * Sphère cabossée (icosaèdre soudé) de rayon ~1 : houppiers, buissons, meules.
     * cut : on retire les triangles du dessous (y < cut sur la sphère unité), jamais vus d'en haut.
     */
    blob: (seed, detail, amp, freq, cut) =>
      tc(`blob${seed},${detail},${amp},${freq},${cut}`, () => {
        const t = fromGeo(new THREE.IcosahedronGeometry(1, detail === undefined ? 1 : detail), "smooth");
        const f = freq || 1.7;
        const dirY = new Float32Array(t.n);
        deform(t, (x, y, z, i) => {
          const l = Math.hypot(x, y, z) || 1;
          x /= l;
          y /= l;
          z /= l;
          dirY[i] = y;
          const n = noise3(x * f + seed * 1.37, y * f + 11.3, z * f - seed * 0.71, seed | 0) * 0.7 + noise3(x * f * 2.6, y * f * 2.6, z * f * 2.6, (seed | 0) + 5) * 0.3;
          const k = 1 + (amp === undefined ? 0.16 : amp) * (n * 2 - 1);
          return [x * k, y * k, z * k];
        });
        roundNormals(t, 0.7);
        return cut === undefined ? t : cullBelow(t, dirY, cut);
      }),
    /** Rocher : sphère cabossée à facettes douces, base aplatie (y ≥ −0,25), dessous retiré. */
    rock: (seed, detail, amp) =>
      tc(`rock${seed},${detail},${amp}`, () => {
        const t = fromGeo(new THREE.IcosahedronGeometry(1, detail === undefined ? 1 : detail), "smooth");
        const dirY = new Float32Array(t.n);
        deform(t, (x, y, z, i) => {
          const l = Math.hypot(x, y, z) || 1;
          x /= l;
          y /= l;
          z /= l;
          dirY[i] = y;
          const n = noise3(x * 1.4 + seed, y * 1.4 - seed * 0.3, z * 1.4 + 3.1, seed | 0) * 0.65 + noise3(x * 3.1, y * 3.1 + seed, z * 3.1, (seed | 0) + 9) * 0.35;
          const k = 1 + (amp === undefined ? 0.28 : amp) * (n * 2 - 1);
          return [x * k, Math.max(y * k, -0.25), z * k];
        });
        return cullBelow(t, dirY, -0.3);
      }),
    /** Tétraèdre et octaèdre à facettes (fleurs, baies, éclats : 4 et 8 triangles). */
    tet: (r) => tc(`tet${r}`, () => fromGeo(new THREE.TetrahedronGeometry(r, 0), "flat")),
    octa: (r) => tc(`octa${r}`, () => fromGeo(new THREE.OctahedronGeometry(r, 0), "flat")),
    /** Cône ouvert (sans fond) : étages de sapin. */
    coneOpen: (r, h, seg) => tc(`coneO${r},${h},${seg}`, () => fromGeo(new THREE.ConeGeometry(r, h, seg || 10, 1, true).translate(0, h / 2, 0))),
    /** Fleur à plat, face au ciel : n pétales, cœur d'une autre couleur (couleurs du gabarit). */
    flower: (n, r, cup, outer, inner) =>
      tc(`flower${n},${r},${cup},${outer},${inner}`, () => {
        const pos = [0, cup * 0.2, 0],
          idx = [];
        const m = n * 2;
        for (let i = 0; i < m; i++) {
          const a = (i / m) * TAU;
          const rr = i % 2 ? r * 0.45 : r;
          pos.push(Math.cos(a) * rr, i % 2 ? cup * 0.5 : cup, Math.sin(a) * rr);
        }
        for (let i = 1; i <= m; i++) idx.push(0, (i % m) + 1, i);
        const p = new Float32Array(pos);
        const t = new Tpl(p, smoothNormalsIdx(p, idx), Uint32Array.from(idx), null);
        t.nor.fill(0);
        for (let i = 0; i < t.n; i++) t.nor[i * 3 + 1] = 1;
        const ci = col(inner),
          co = col(outer);
        t.col = new Float32Array(t.n * 3);
        for (let i = 0; i < t.n; i++) {
          const c = i === 0 ? ci : co;
          t.col[i * 3] = c.r;
          t.col[i * 3 + 1] = c.g;
          t.col[i * 3 + 2] = c.b;
        }
        return t;
      }),
    box: (w, h, d) => tc(`box${w},${h},${d}`, () => fromGeo(new THREE.BoxGeometry(w, h, d))),
    /** Boîte subdivisée (grands pans : les couleurs de sommets peuvent y varier par plaques). */
    boxSeg: (w, h, d, sx, sy, sz) => tc(`boxS${w},${h},${d},${sx},${sy},${sz}`, () => fromGeo(new THREE.BoxGeometry(w, h, d, sx, sy, sz))),
    /** Boîte posée (base à y = 0). */
    boxB: (w, h, d) => tc(`boxB${w},${h},${d}`, () => fromGeo(new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0))),
    cyl: (rt, rb, h, seg, open) => tc(`cyl${rt},${rb},${h},${seg},${open}`, () => fromGeo(new THREE.CylinderGeometry(rt, rb, h, seg || 8, 1, !!open))),
    /** Cylindre posé (base à y = 0). */
    cylB: (rt, rb, h, seg, open) => tc(`cylB${rt},${rb},${h},${seg},${open}`, () => fromGeo(new THREE.CylinderGeometry(rt, rb, h, seg || 8, 1, !!open).translate(0, h / 2, 0))),
    cone: (r, h, seg) => tc(`cone${r},${h},${seg}`, () => fromGeo(new THREE.ConeGeometry(r, h, seg || 8, 1).translate(0, h / 2, 0))),
    sphere: (r, ws, hs, t0, tl) => tc(`sph${r},${ws},${hs},${t0},${tl}`, () => fromGeo(new THREE.SphereGeometry(r, ws || 10, hs || 7, 0, TAU, t0 || 0, tl === undefined ? Math.PI : tl))),
    /** Dôme (demi-sphère) posé. */
    dome: (r, ws, hs) => tc(`dome${r},${ws},${hs}`, () => fromGeo(new THREE.SphereGeometry(r, ws || 10, hs || 5, 0, TAU, 0, Math.PI / 2))),
    torus: (R, r, rs, ts, arc) => tc(`tor${R},${r},${rs},${ts},${arc}`, () => fromGeo(new THREE.TorusGeometry(R, r, rs || 6, ts || 16, arc || TAU))),
    disc: (r, seg) => tc(`disc${r},${seg}`, () => fromGeo(new THREE.CircleGeometry(r, seg || 12).rotateX(-Math.PI / 2))),
    lathe: (key, pts, seg) => tc("lathe:" + key, () => fromGeo(new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(p[0], p[1])), seg || 10))),
    ico: (r, d) => tc(`ico${r},${d}`, () => fromGeo(new THREE.IcosahedronGeometry(r, d || 0), "flat")),
    /** Prisme extrudé d'un contour 2D (plan XY, épaisseur selon Z, centré). */
    extrude: (key, pts, depth, bevel) =>
      tc("ext:" + key, () => {
        const s = new THREE.Shape(pts.map((p) => new THREE.Vector2(p[0], p[1])));
        const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: !!bevel, bevelThickness: bevel || 0, bevelSize: bevel || 0, bevelSegments: 1, curveSegments: 6, steps: 1 });
        g.translate(0, 0, -depth / 2);
        return fromGeo(g, "flat");
      }),
    /** Lame (roseau, herbe) : triangle effilé courbé, deux faces ; pied à l'origine, hauteur 1. */
    blade: (bend, w, segs) =>
      tc(`blade${bend},${w},${segs}`, () => {
        const pos = [],
          idx = [];
        const seg = segs || 3;
        for (let i = 0; i <= seg; i++) {
          const t = i / seg;
          const x = bend * t * t;
          const hw = (w || 0.06) * (1 - t * 0.92);
          pos.push(x - hw, t, 0, x + hw, t, 0);
        }
        for (let i = 0; i < seg; i++) {
          const a = i * 2;
          idx.push(a, a + 1, a + 3, a, a + 3, a + 2);
        }
        return twoSided(new Float32Array(pos), idx);
      }),
    /** Fronde de fougère : feuille allongée et découpée qui s'arque vers l'extérieur (+X). */
    frond: (len, arch, segs) =>
      tc(`frond${len},${arch},${segs}`, () => {
        const pos = [],
          idx = [];
        const seg = segs || 4;
        for (let i = 0; i <= seg; i++) {
          const t = i / seg;
          const x = t * len;
          const y = Math.sin(t * Math.PI * 0.8) * arch;
          const hw = len * 0.2 * Math.sin(Math.PI * Math.min(1, t * 1.15)) * (i % 2 ? 0.7 : 1);
          pos.push(x, y, -hw, x, y + hw * 0.25, 0, x, y, hw);
        }
        for (let i = 0; i < seg; i++) {
          const a = i * 3,
            b = a + 3;
          idx.push(a, a + 1, b + 1, a, b + 1, b, a + 1, a + 2, b + 2, a + 1, b + 2, b + 1);
        }
        return twoSided(new Float32Array(pos), idx);
      }),
    /** Pétales en étoile à plat (fleurs, nénuphars) : disque découpé en n lobes. */
    petals: (n, r, cup) =>
      tc(`petals${n},${r},${cup}`, () => {
        const pos = [0, cup * 0.3, 0],
          idx = [];
        const m = n * 3;
        for (let i = 0; i <= m; i++) {
          const a = (i / m) * TAU;
          const lobe = 0.55 + 0.45 * Math.abs(Math.cos((a * n) / 2));
          pos.push(Math.cos(a) * r * lobe, cup * lobe, Math.sin(a) * r * lobe);
        }
        for (let i = 1; i <= m; i++) idx.push(0, i + 1, i);
        return twoSided(new Float32Array(pos), idx);
      }),
  });
  /** Surface mince à deux faces (feuilles, lames) : on double les triangles, normales opposées. */
  function twoSided(pos, idx) {
    const n = pos.length / 3;
    const p2 = new Float32Array(pos.length * 2);
    p2.set(pos);
    p2.set(pos, pos.length);
    const i2 = new Uint32Array(idx.length * 2);
    for (let i = 0; i < idx.length; i += 3) {
      i2[i] = idx[i];
      i2[i + 1] = idx[i + 1];
      i2[i + 2] = idx[i + 2];
      i2[idx.length + i] = idx[i] + n;
      i2[idx.length + i + 1] = idx[i + 2] + n;
      i2[idx.length + i + 2] = idx[i + 1] + n;
    }
    const nor = smoothNormalsIdx(p2, i2.subarray(0, idx.length));
    const nb = smoothNormalsIdx(p2, i2);
    // Normales de la face avant, puis opposées pour la face arrière ; légèrement relevées (lumière du ciel).
    for (let i = 0; i < n; i++) {
      let x = nor[i * 3],
        y = nor[i * 3 + 1],
        z = nor[i * 3 + 2];
      y += 0.35;
      const l = Math.hypot(x, y, z) || 1;
      nb[i * 3] = x / l;
      nb[i * 3 + 1] = y / l;
      nb[i * 3 + 2] = z / l;
      nb[(n + i) * 3] = -x / l;
      nb[(n + i) * 3 + 1] = Math.abs(y / l) * 0.6;
      nb[(n + i) * 3 + 2] = -z / l;
    }
    return new Tpl(p2, nb, i2, null);
  }
  P.twoSided = twoSided;

  /* ------------------------------------------------------------------ accumulateur */
  const _m = new THREE.Matrix4(),
    _nm = new THREE.Matrix3(),
    _q = new THREE.Quaternion(),
    _e = new THREE.Euler(),
    _s = new THREE.Vector3(),
    _p = new THREE.Vector3();
  /** Matrice depuis position, rotation (Euler XYZ), échelle (nombre ou [x, y, z]). */
  function mat(p, r, s, out) {
    out = out || new THREE.Matrix4();
    _p.set(p ? p[0] : 0, p ? p[1] : 0, p ? p[2] : 0);
    _e.set(r ? r[0] : 0, r ? r[1] : 0, r ? r[2] : 0, "YXZ");
    _q.setFromEuler(_e);
    if (s === undefined) _s.set(1, 1, 1);
    else if (typeof s === "number") _s.set(s, s, s);
    else _s.set(s[0], s[1], s[2]);
    return out.compose(_p, _q, _s);
  }
  P.mat = mat;
  const colOf = (c) => (c === undefined || c === null ? col("#ffffff") : typeof c === "string" ? col(c) : c);

  /**
   * Accumulateur de pièces.
   *   const a = new P.Acc({ uv: true, seed });
   *   a.add(gabarit, matrice, { c, g:[c0,c1,y0,y1], vj, vs, moss:[c, n0, n1], ao:[bas, y0, y1], tint,
   *                            pivot:[x,y,z], tile, sway, emit, role, rim, box (taille de motif UV), uvs:[su,sv], dark })
   *   a.toTpl()  → gabarit composite (réutilisable, garde couleurs et informations par sommet)
   *   a.toGeometry() → BufferGeometry (position, normal, color, uv, aPivot, aInfo)
   * Les dégradés, la mousse et l'occlusion se calculent dans l'espace de l'assemblage (après placement).
   */
  class Acc {
    constructor(o) {
      this.o = o || {};
      this.parts = [];
      this.nv = 0;
      this.ni = 0;
      this.seed = (this.o.seed | 0) + 17;
    }
    add(tpl, m, o) {
      this.parts.push(tpl, m ? m.clone() : new THREE.Matrix4(), o || {});
      this.nv += tpl.n;
      this.ni += tpl.idx.length;
      return this;
    }
    /** Raccourci : position / rotation / échelle au lieu d'une matrice (et matrice parente facultative). */
    put(tpl, p, r, s, o, parent) {
      mat(p, r, s, _m);
      if (parent) _m.premultiply(parent);
      return this.add(tpl, _m, o);
    }
    get empty() {
      return this.nv === 0;
    }
    _bake(withUv) {
      const N = this.nv;
      const pos = new Float32Array(N * 3),
        nor = new Float32Array(N * 3),
        cl = new Float32Array(N * 3),
        pv = new Float32Array(N * 4),
        inf = new Float32Array(N * 4),
        uv = withUv ? new Float32Array(N * 2) : null;
      const idx = N > 65535 ? new Uint32Array(this.ni) : new Uint16Array(this.ni);
      let vo = 0,
        io = 0;
      const seed = this.seed;
      for (let k = 0; k < this.parts.length; k += 3) {
        const t = this.parts[k],
          m = this.parts[k + 1],
          o = this.parts[k + 2];
        const e = m.elements;
        _nm.getNormalMatrix(m);
        const ne = _nm.elements;
        const flip = m.determinant() < 0;
        const base = colOf(o.c);
        const tint = o.tint ? colOf(o.tint) : null;
        const g0 = o.g ? colOf(o.g[0]) : null,
          g1 = o.g ? colOf(o.g[1]) : null;
        const moss = o.moss ? colOf(o.moss[0]) : null;
        const vs = o.vs || 2.2;
        // Pivot : donné, sinon l'origine de la pièce placée.
        let px, py, pz;
        if (o.pivot) {
          px = o.pivot[0];
          py = o.pivot[1];
          pz = o.pivot[2];
        } else {
          px = e[12];
          py = e[13];
          pz = e[14];
        }
        const jit = o.j ? 1 + (hash2(k, 7, seed) - 0.5) * 2 * o.j : 1;
        for (let i = 0; i < t.n; i++) {
          const x = t.pos[i * 3],
            y = t.pos[i * 3 + 1],
            z = t.pos[i * 3 + 2];
          const X = e[0] * x + e[4] * y + e[8] * z + e[12];
          const Y = e[1] * x + e[5] * y + e[9] * z + e[13];
          const Z = e[2] * x + e[6] * y + e[10] * z + e[14];
          const a = t.nor[i * 3],
            b = t.nor[i * 3 + 1],
            c = t.nor[i * 3 + 2];
          let nx = ne[0] * a + ne[3] * b + ne[6] * c;
          let ny = ne[1] * a + ne[4] * b + ne[7] * c;
          let nz = ne[2] * a + ne[5] * b + ne[8] * c;
          const nl = Math.hypot(nx, ny, nz) || 1;
          nx /= nl;
          ny /= nl;
          nz /= nl;
          const w = vo + i;
          pos[w * 3] = X;
          pos[w * 3 + 1] = Y;
          pos[w * 3 + 2] = Z;
          nor[w * 3] = nx;
          nor[w * 3 + 1] = ny;
          nor[w * 3 + 2] = nz;
          // Couleur : propre au gabarit, ou couleur / dégradé de la pièce.
          let r, gg, bb;
          if (t.col && !o.c && !o.g) {
            r = t.col[i * 3];
            gg = t.col[i * 3 + 1];
            bb = t.col[i * 3 + 2];
          } else if (g0) {
            const f = smooth(o.g[2], o.g[3], Y);
            r = lerp(g0.r, g1.r, f);
            gg = lerp(g0.g, g1.g, f);
            bb = lerp(g0.b, g1.b, f);
          } else {
            r = base.r;
            gg = base.g;
            bb = base.b;
          }
          if (moss) {
            const f = smooth(o.moss[1], o.moss[2], ny) * (0.55 + 0.9 * noise3(X * 1.3, Y * 1.3, Z * 1.3, seed + 3));
            const q = clamp(f, 0, 1);
            r = lerp(r, moss.r, q);
            gg = lerp(gg, moss.g, q);
            bb = lerp(bb, moss.b, q);
          }
          let f = jit;
          if (o.vj) f *= 1 + (noise3(X * vs, Y * vs, Z * vs, seed + (o.vseed | 0)) - 0.5) * 2 * o.vj;
          if (o.ao) f *= lerp(o.ao[0], 1, smooth(o.ao[1], o.ao[2], Y));
          if (o.dark) f *= 1 - o.dark * smooth(-0.2, -1, ny);
          if (tint) {
            r *= tint.r;
            gg *= tint.g;
            bb *= tint.b;
          }
          cl[w * 3] = r * f;
          cl[w * 3 + 1] = gg * f;
          cl[w * 3 + 2] = bb * f;
          // Informations par sommet (gabarit composite × réglages de la pièce).
          const ti = t.inf;
          const sway = (ti ? ti[i * 4] : 1) * (o.sway === undefined ? (ti ? 1 : 0) : o.sway);
          const emit = o.emit !== undefined ? o.emit : ti ? ti[i * 4 + 1] : 0;
          const role = o.role !== undefined ? o.role : ti ? ti[i * 4 + 2] : 1;
          const rim = o.rim !== undefined ? o.rim : ti ? ti[i * 4 + 3] : 0;
          pv[w * 4] = px;
          pv[w * 4 + 1] = py;
          pv[w * 4 + 2] = pz;
          pv[w * 4 + 3] = rim;
          inf[w * 4] = o.tile || 0;
          inf[w * 4 + 1] = sway;
          inf[w * 4 + 2] = emit;
          inf[w * 4 + 3] = role;
          if (uv) {
            if (o.box) {
              // Projection sur l'axe dominant de la normale (espace de l'assemblage) : motif continu.
              const ax = Math.abs(nx),
                ay = Math.abs(ny),
                az = Math.abs(nz);
              let u, v;
              if (ay >= ax && ay >= az) {
                u = X;
                v = Z;
              } else if (ax >= az) {
                u = Z;
                v = Y;
              } else {
                u = X;
                v = Y;
              }
              uv[w * 2] = u / o.box + (o.uo || 0);
              uv[w * 2 + 1] = v / o.box + (o.vo || 0);
            } else {
              const tu = t.uv ? t.uv[i * 2] : 0,
                tv = t.uv ? t.uv[i * 2 + 1] : 0;
              uv[w * 2] = tu * (o.uvs ? o.uvs[0] : 1) + (o.uo || 0);
              uv[w * 2 + 1] = tv * (o.uvs ? o.uvs[1] : 1) + (o.vo || 0);
            }
          }
        }
        const ix = t.idx;
        for (let i = 0; i < ix.length; i += 3) {
          idx[io + i] = ix[i] + vo;
          idx[io + i + 1] = (flip ? ix[i + 2] : ix[i + 1]) + vo;
          idx[io + i + 2] = (flip ? ix[i + 1] : ix[i + 2]) + vo;
        }
        vo += t.n;
        io += ix.length;
      }
      return { pos, nor, cl, pv, inf, uv, idx };
    }
    /** Gabarit composite (couleurs et informations par sommet conservées, pivot oublié). */
    toTpl() {
      const b = this._bake(false);
      const t = new Tpl(b.pos, b.nor, Uint32Array.from(b.idx), null);
      t.col = b.cl;
      t.inf = new Float32Array(this.nv * 4);
      for (let i = 0; i < this.nv; i++) {
        t.inf[i * 4] = b.inf[i * 4 + 1]; // balancement
        t.inf[i * 4 + 1] = b.inf[i * 4 + 2]; // lueur
        t.inf[i * 4 + 2] = b.inf[i * 4 + 3]; // rôle
        t.inf[i * 4 + 3] = b.pv[i * 4 + 3]; // liseré
      }
      return t;
    }
    toGeometry() {
      const b = this._bake(!!this.o.uv);
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(b.pos, 3));
      g.setAttribute("normal", new THREE.BufferAttribute(b.nor, 3));
      g.setAttribute("color", new THREE.BufferAttribute(b.cl, 3));
      g.setAttribute("aPivot", new THREE.BufferAttribute(b.pv, 4));
      g.setAttribute("aInfo", new THREE.BufferAttribute(b.inf, 4));
      if (b.uv) g.setAttribute("uv", new THREE.BufferAttribute(b.uv, 2));
      g.setIndex(new THREE.BufferAttribute(b.idx, 1));
      g.computeBoundingSphere();
      g.computeBoundingBox();
      return g;
    }
  }
  P.Acc = Acc;

  /* ------------------------------------------------------------------ matière peinte */
  const VERT_PARS = /* glsl */ `
    attribute vec4 aPivot;
    attribute vec4 aInfo;
    uniform float uTime;
    uniform float uWind;
    varying float vEmit;
    varying float vRim;
    #ifdef PT_TRI
      varying vec3 vTriP;
      varying vec3 vTriN;
    #endif
    #ifdef PT_CUT
      uniform sampler2D uCut;
      uniform float uCutN;
    #endif
    #ifdef PT_RIG
      uniform vec4 uWheel;   // centre xyz, angle
      uniform vec4 uBell;    // centre xyz, angle
      uniform vec4 uHeap;    // centre xyz, écrasement vertical
    #endif
    float ptHash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    vec3 ptRot(vec3 v, vec3 k, float a) {
      float c = cos(a), s = sin(a);
      return v * c + cross(k, v) * s + k * dot(k, v) * (1.0 - c);
    }
  `;
  // Déformations communes (rendu et ombres) : ptPos / ptN.
  const DEFORM = /* glsl */ `
    vec3 ptPos = vec3(position);
    vec3 ptN = vec3(normal);
    float ptRole = aInfo.w;
    #ifdef PT_CUT
    {
      // Case coupée : r = tremblement, g = chute (0 → 1), b = effacement des souches.
      vec4 cs = texture2D(uCut, vec2((aInfo.x + 0.5) / uCutN, 0.5));
      vec3 rel = ptPos - aPivot.xyz;
      float ph = ptHash(aPivot.xz);
      if (ptRole < 0.5) {
        float up = max(rel.y, 0.0);
        rel.x += sin(uTime * 41.0 + ph * 30.0) * cs.r * 0.06 * up;
        rel.z += cos(uTime * 33.0 + ph * 17.0) * cs.r * 0.05 * up;
        float f = cs.g;
        if (f > 0.0) {
          float a = ph * 6.2832;
          vec3 ax = vec3(cos(a), 0.0, sin(a));
          float ang = f * 1.45;
          rel = ptRot(rel, ax, ang);
          ptN = ptRot(ptN, ax, ang);
          rel *= 1.0 - smoothstep(0.55, 1.0, f);
        }
      } else if (ptRole < 1.5) {
        rel *= 1.0 - cs.b;
      } else if (ptRole < 2.5) {
        float f = cs.g;
        rel.y -= f * f * 0.9;
        rel *= 1.0 - smoothstep(0.35, 1.0, f);
      }
      ptPos = aPivot.xyz + rel;
    }
    #endif
    #ifdef PT_SWAY
    {
      float sw = aInfo.y;
      if (sw > 0.0) {
        float ph = aPivot.x * 0.31 + aPivot.z * 0.27;
        float h = max(0.0, ptPos.y - aPivot.y);
        float s = sw * uWind * h;
        ptPos.x += (sin(uTime * 1.7 + ph) * 0.6 + sin(uTime * 3.1 + ph * 1.7) * 0.4) * s * 0.022;
        ptPos.z += cos(uTime * 1.3 + ph * 1.3) * s * 0.016;
      }
    }
    #endif
    #ifdef PT_RIG
      if (ptRole > 4.5 && ptRole < 5.5) {
        ptPos.y = uHeap.y + (ptPos.y - uHeap.y) * uHeap.w;
      } else if (ptRole > 2.5 && ptRole < 3.5) {
        ptPos = uWheel.xyz + ptRot(ptPos - uWheel.xyz, vec3(0.0, 0.0, 1.0), uWheel.w);
        ptN = ptRot(ptN, vec3(0.0, 0.0, 1.0), uWheel.w);
      } else if (ptRole > 3.5 && ptRole < 4.5) {
        ptPos = uBell.xyz + ptRot(ptPos - uBell.xyz, vec3(0.0, 0.0, 1.0), uBell.w);
        ptN = ptRot(ptN, vec3(0.0, 0.0, 1.0), uBell.w);
      }
    #endif
  `;
  const VERT_MAIN = /* glsl */ `
    ${DEFORM}
    vec3 objectNormal = ptN;
    #ifdef USE_TANGENT
      vec3 objectTangent = vec3( tangent.xyz );
    #endif
    // Lueur : fixe (0..1) ou scintillante (> 1 : intensité − 1, éclats brefs propres à chaque sommet).
    vEmit = aInfo.z;
    if (vEmit > 1.0) {
      float h = ptHash(position.xz + position.y * 3.7);
      float tw = pow(0.5 + 0.5 * sin(uTime * (2.5 + 3.5 * h) + h * 60.0), 8.0);
      vEmit = (vEmit - 1.0) * (0.25 + 1.6 * tw);
    }
    vRim = aPivot.w;
  `;
  const FRAG_PARS = /* glsl */ `
    varying float vEmit;
    varying float vRim;
    uniform vec3 uRim;
    uniform float uLift;
    #ifdef PT_TRI
      varying vec3 vTriP;
      varying vec3 vTriN;
      uniform float uTri;
    #endif
  `;
  // Placage « triplanaire » (rochers ronds) : trois projections mêlées selon la normale du monde.
  const FRAG_MAP = /* glsl */ `
    #ifdef PT_TRI
    {
      vec3 tw = abs(normalize(vTriN));
      tw = tw * tw * tw * tw;
      tw /= (tw.x + tw.y + tw.z);
      vec4 tx = texture2D(map, vTriP.zy * uTri) * tw.x + texture2D(map, vTriP.xz * uTri + 0.37) * tw.y + texture2D(map, vTriP.xy * uTri + 0.71) * tw.z;
      diffuseColor *= mapTexelToLinear(tx);
    }
    #else
      #include <map_fragment>
    #endif
  `;
  // Liseré sombre sur les bords arrondis vus de biais (silhouettes des houppiers, rochers, meules).
  const FRAG_RIM = /* glsl */ `
    #include <normal_fragment_maps>
    {
      vec3 ptV = isOrthographic ? vec3(0.0, 0.0, 1.0) : normalize(vViewPosition);
      float ptNdV = abs(dot(normal, ptV));
      float ptR = 1.0 - smoothstep(uRim.x, uRim.y, ptNdV);
      diffuseColor.rgb *= 1.0 - ptR * uRim.z * vRim;
    }
  `;
  const FRAG_EMIT = /* glsl */ `
    #include <emissivemap_fragment>
    totalEmissiveRadiance += diffuseColor.rgb * (uLift + vEmit);
  `;
  function patchMain(sh, u) {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\n" + VERT_PARS)
      .replace("#include <beginnormal_vertex>", VERT_MAIN)
      .replace(
        "#include <begin_vertex>",
        "vec3 transformed = ptPos;\n#ifdef PT_TRI\nvTriP = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvTriN = mat3(modelMatrix) * objectNormal;\n#endif",
      );
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\n" + FRAG_PARS)
      .replace("#include <map_fragment>", FRAG_MAP)
      .replace("#include <normal_fragment_maps>", FRAG_RIM)
      .replace("#include <emissivemap_fragment>", FRAG_EMIT);
  }
  function patchDepth(sh, u) {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\n" + VERT_PARS.replace(/varying (float|vec3) v\w+;/g, ""))
      .replace("#include <begin_vertex>", DEFORM + "\nvec3 transformed = ptPos;");
  }
  let matSeq = 0;
  /**
   * Matière peinte (couleurs de sommets).
   *  o = { map, sway, cut: { tex, n }, rig: { wheel: Vector4, bell: Vector4 }, lift, rim: [bord0, bord1, force],
   *        rough, metal, flat, side, name }
   * La matière porte sa jumelle d'ombre dans userData.depth (à poser en customDepthMaterial).
   */
  P.paint = function (o) {
    o = o || {};
    const defines = {};
    if (o.sway) defines.PT_SWAY = "";
    if (o.cut) defines.PT_CUT = "";
    if (o.rig) defines.PT_RIG = "";
    if (o.tri) defines.PT_TRI = "";
    const u = {
      uTime: U.time,
      uWind: U.wind,
      uRim: { value: new THREE.Vector3().fromArray(o.rim || [0.05, 0.42, 0.55]) },
      uLift: { value: o.lift === undefined ? 0.14 : o.lift },
    };
    if (o.tri) u.uTri = { value: 1 / o.tri };
    if (o.cut) {
      u.uCut = { value: o.cut.tex };
      u.uCutN = { value: o.cut.n };
    }
    if (o.rig) {
      u.uWheel = { value: o.rig.wheel || new THREE.Vector4() };
      u.uBell = { value: o.rig.bell || new THREE.Vector4() };
      u.uHeap = { value: o.rig.heap || new THREE.Vector4(0, 0, 0, 1) };
    }
    const m = new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: o.map || null,
      roughness: o.rough === undefined ? 0.86 : o.rough,
      metalness: o.metal || 0,
      flatShading: !!o.flat,
      side: o.side || THREE.FrontSide,
    });
    m.defines = defines;
    m.name = "ptmt:props:" + (o.name || "paint");
    const key = "ptmt-props-paint-" + Object.keys(defines).join("-");
    m.onBeforeCompile = (sh) => patchMain(sh, u);
    m.customProgramCacheKey = () => key;
    m.userData.u = u;
    if (o.sway || o.cut || o.rig) {
      const d = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
      d.defines = Object.assign({}, defines);
      d.onBeforeCompile = (sh) => patchDepth(sh, u);
      d.customProgramCacheKey = () => key + "-depth";
      m.userData.depth = d;
    }
    m.userData.seq = matSeq++;
    return m;
  };
  /** Matières peintes partagées (décor sans uniformes propres). */
  const shared = new Map();
  P.shared = function (key, f) {
    let m = shared.get(key);
    if (!m) {
      m = f();
      shared.set(key, m);
    }
    return m;
  };
  /** Maillage d'un accumulateur avec sa matière (ombres selon o.cast / o.receive). */
  P.mesh = function (acc, material, o) {
    o = o || {};
    const mesh = new THREE.Mesh(acc.toGeometry(), material);
    mesh.castShadow = !!o.cast;
    mesh.receiveShadow = o.receive !== false;
    if (material.userData.depth) mesh.customDepthMaterial = material.userData.depth;
    if (o.name) mesh.name = o.name;
    // Les déformations (chute, balancement) débordent un peu de la boîte d'origine.
    if (mesh.geometry.boundingSphere) mesh.geometry.boundingSphere.radius += o.pad === undefined ? 1.5 : o.pad;
    return mesh;
  };

  /* ------------------------------------------------------------------ granit naturel */
  // Granit breton (rochers, chaos, falaises) : grain moucheté (quartz clair, biotite sombre, feldspath
  // rosé), marbrures larges ; blanc cassé à teinter par les couleurs de sommets.
  let graniteTex = null;
  P.graniteTex = function () {
    if (graniteTex) return graniteTex;
    const S = 256,
      cv = document.createElement("canvas");
    cv.width = cv.height = S;
    const g = cv.getContext("2d");
    const img = g.createImageData(S, S);
    const { fbm, voronoi } = K.noise;
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const u = x / S,
          v = y / S;
        let l = 0.84 + (fbm(u, v, 3, 5, 3) - 0.5) * 0.3 + (fbm(u, v, 10, 9, 2) - 0.5) * 0.12;
        const cell = voronoi(u, v, 48, 13, 0.95);
        const h = hash2(cell.id, 3, 77);
        let r = 1,
          gg = 0.985,
          b = 0.95;
        if (h < 0.1) l *= 0.62;
        else if (h < 0.22) l *= 1.12;
        else if (h < 0.3) {
          r = 1.05;
          gg = 0.92;
          b = 0.88;
        }
        const edge = cell.d2 - cell.d1;
        if (edge < 0.05) l *= 0.94;
        l += (hash2(x, y, 5) - 0.5) * 0.05;
        const i = (y * S + x) * 4;
        img.data[i] = clamp(255 * l * r, 0, 255);
        img.data[i + 1] = clamp(255 * l * gg, 0, 255);
        img.data[i + 2] = clamp(255 * l * b, 0, 255);
        img.data[i + 3] = 255;
      }
    g.putImageData(img, 0, 0);
    graniteTex = new THREE.CanvasTexture(cv);
    graniteTex.encoding = THREE.sRGBEncoding;
    graniteTex.wrapS = graniteTex.wrapT = THREE.RepeatWrapping;
    graniteTex.anisotropy = 4;
    graniteTex.name = "ptmt:props-granite";
    return graniteTex;
  };
  /** Matière des rochers naturels (granit moucheté, liseré sombre), partagée. */
  P.rockMat = function (o) {
    const base = { map: P.graniteTex(), tri: 1.6, rim: [0.16, 0.5, 0.75], lift: 0.1, rough: 0.9, name: "rochers" };
    if (o) return P.paint(Object.assign(base, o));
    return P.shared("rock", () => P.paint(base));
  };

  /* ------------------------------------------------------------------ planche des lueurs */
  // 4 × 4 cases de 128 px, dessinées au chargement (blanc sur transparent, à teinter).
  const CELL = (P.CELL = { glow: 0, puff: 1, star: 2, chevron: 3, ring: 4, drop: 5, beam: 6, triskel: 7, ding: 8, leaf: 9, spark: 10, halo: 11, arrow: 12, dot: 13, chevronO: 14, ringO: 15 });
  let atlasTex = null;
  P.atlas = function () {
    if (atlasTex) return atlasTex;
    const S = 128,
      cv = document.createElement("canvas");
    cv.width = cv.height = S * 4;
    const g = cv.getContext("2d");
    const cell = (i, fn) => {
      g.save();
      g.translate((i % 4) * S, Math.floor(i / 4) * S);
      g.beginPath();
      g.rect(0, 0, S, S);
      g.clip();
      fn(g, S);
      g.restore();
    };
    const radial = (x, y, r, stops) => {
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      for (const [t, a] of stops) gr.addColorStop(t, `rgba(255,255,255,${a})`);
      return gr;
    };
    cell(CELL.glow, (g, S) => {
      g.fillStyle = radial(S / 2, S / 2, S / 2, [
        [0, 1],
        [0.2, 0.8],
        [0.5, 0.28],
        [0.78, 0.07],
        [1, 0],
      ]);
      g.fillRect(0, 0, S, S);
    });
    cell(CELL.puff, (g, S) => {
      const rnd = PTMT.rng(21);
      for (let i = 0; i < 9; i++) {
        const a = rnd() * TAU,
          d = rnd() * S * 0.18,
          r = S * (0.2 + rnd() * 0.14);
        g.fillStyle = radial(S / 2 + Math.cos(a) * d, S / 2 + Math.sin(a) * d, r, [
          [0, 0.8],
          [0.55, 0.55],
          [1, 0],
        ]);
        g.fillRect(0, 0, S, S);
      }
    });
    cell(CELL.star, (g, S) => {
      const c = S / 2;
      g.fillStyle = radial(c, c, S * 0.3, [
        [0, 1],
        [0.35, 0.5],
        [1, 0],
      ]);
      g.fillRect(0, 0, S, S);
      g.fillStyle = "#fff";
      for (const [w, l] of [
        [S * 0.07, S * 0.48],
        [S * 0.05, S * 0.3],
      ]) {
        g.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * TAU - Math.PI / 2 + (l < S * 0.4 ? Math.PI / 4 : 0);
          const r = i % 2 ? w : l;
          g.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r);
        }
        g.closePath();
        g.fill();
      }
    });
    cell(CELL.chevron, (g, S) => {
      g.strokeStyle = "#fff";
      g.lineWidth = S * 0.16;
      g.lineCap = "round";
      g.lineJoin = "round";
      g.shadowColor = "#fff";
      g.shadowBlur = S * 0.08;
      g.beginPath();
      g.moveTo(S * 0.16, S * 0.7);
      g.lineTo(S * 0.5, S * 0.3);
      g.lineTo(S * 0.84, S * 0.7);
      g.stroke();
    });
    cell(CELL.ring, (g, S) => {
      g.strokeStyle = "#fff";
      g.lineWidth = S * 0.07;
      g.shadowColor = "#fff";
      g.shadowBlur = S * 0.06;
      g.beginPath();
      g.arc(S / 2, S / 2, S * 0.4, 0, TAU);
      g.stroke();
    });
    cell(CELL.drop, (g, S) => {
      g.fillStyle = radial(S / 2, S / 2, S * 0.45, [
        [0, 1],
        [0.35, 0.9],
        [0.6, 0.3],
        [1, 0],
      ]);
      g.fillRect(0, 0, S, S);
    });
    cell(CELL.beam, (g, S) => {
      const img = g.createImageData(S, S);
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          const u = (x + 0.5) / S - 0.5,
            v = (y + 0.5) / S; // v = 0 en haut (sommet du rayon), 1 en bas
          const across = Math.exp(-Math.pow(u / 0.2, 2)) * 0.75 + Math.exp(-Math.pow(u / 0.06, 2)) * 0.25;
          const along = Math.pow(v, 1.6) * smooth(1, 0.9, v);
          const i = (y * S + x) * 4;
          img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
          img.data[i + 3] = 255 * clamp(across * along, 0, 1);
        }
      g.putImageData(img, (CELL.beam % 4) * S, Math.floor(CELL.beam / 4) * S);
    });
    cell(CELL.triskel, (g, S) => {
      // Triskèle breton : trois spirales qui tournent autour du centre.
      const c = S / 2;
      g.strokeStyle = "#fff";
      g.lineWidth = S * 0.045;
      g.lineCap = "round";
      g.shadowColor = "#fff";
      g.shadowBlur = S * 0.05;
      for (let k = 0; k < 3; k++) {
        const a0 = (k / 3) * TAU;
        g.beginPath();
        for (let t = 0; t <= 1.001; t += 0.02) {
          const a = a0 + t * TAU * 1.25;
          const r = S * 0.04 + t * S * 0.36;
          const x = c + Math.cos(a) * r,
            y = c + Math.sin(a) * r;
          if (t === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
        g.stroke();
      }
      g.lineWidth = S * 0.035;
      g.beginPath();
      g.arc(c, c, S * 0.46, 0, TAU);
      g.stroke();
    });
    cell(CELL.ding, (g, S) => {
      g.strokeStyle = "#fff";
      g.lineWidth = S * 0.08;
      g.lineCap = "round";
      g.shadowColor = "#fff";
      g.shadowBlur = S * 0.05;
      for (const s of [-1, 1])
        for (const r of [0.22, 0.38]) {
          g.beginPath();
          g.arc(S / 2, S / 2, S * r, s < 0 ? Math.PI * 0.72 : -Math.PI * 0.28, s < 0 ? Math.PI * 1.28 : Math.PI * 0.28);
          g.stroke();
        }
    });
    cell(CELL.leaf, (g, S) => {
      g.fillStyle = "#fff";
      g.beginPath();
      g.moveTo(S * 0.5, S * 0.1);
      g.quadraticCurveTo(S * 0.9, S * 0.5, S * 0.5, S * 0.9);
      g.quadraticCurveTo(S * 0.1, S * 0.5, S * 0.5, S * 0.1);
      g.fill();
    });
    cell(CELL.spark, (g, S) => {
      const c = S / 2;
      g.fillStyle = radial(c, c, S * 0.5, [
        [0, 1],
        [0.12, 1],
        [0.3, 0.35],
        [1, 0],
      ]);
      g.fillRect(0, 0, S, S);
      g.fillStyle = "rgba(255,255,255,0.9)";
      g.fillRect(c - S * 0.02, S * 0.12, S * 0.04, S * 0.76);
      g.fillRect(S * 0.12, c - S * 0.02, S * 0.76, S * 0.04);
    });
    cell(CELL.halo, (g, S) => {
      g.fillStyle = radial(S / 2, S / 2, S / 2, [
        [0, 0.55],
        [0.45, 0.35],
        [0.72, 0.9],
        [0.8, 0.9],
        [0.9, 0.25],
        [1, 0],
      ]);
      g.fillRect(0, 0, S, S);
    });
    cell(CELL.arrow, (g, S) => {
      g.fillStyle = "#fff";
      g.shadowColor = "#fff";
      g.shadowBlur = S * 0.06;
      g.beginPath();
      g.moveTo(S * 0.5, S * 0.08);
      g.lineTo(S * 0.88, S * 0.5);
      g.lineTo(S * 0.64, S * 0.5);
      g.lineTo(S * 0.64, S * 0.92);
      g.lineTo(S * 0.36, S * 0.92);
      g.lineTo(S * 0.36, S * 0.5);
      g.lineTo(S * 0.12, S * 0.5);
      g.closePath();
      g.fill();
    });
    cell(CELL.dot, (g, S) => {
      g.fillStyle = "#fff";
      g.beginPath();
      g.arc(S / 2, S / 2, S * 0.4, 0, TAU);
      g.fill();
    });
    // Versions cernées de sombre (lisibles sur un sol clair, en mélange normal).
    cell(CELL.chevronO, (g, S) => {
      g.lineCap = "round";
      g.lineJoin = "round";
      g.strokeStyle = "rgba(40,24,10,0.9)";
      g.lineWidth = S * 0.24;
      g.beginPath();
      g.moveTo(S * 0.16, S * 0.72);
      g.lineTo(S * 0.5, S * 0.3);
      g.lineTo(S * 0.84, S * 0.72);
      g.stroke();
      g.strokeStyle = "#fff";
      g.lineWidth = S * 0.13;
      g.stroke();
    });
    cell(CELL.ringO, (g, S) => {
      g.strokeStyle = "rgba(20,16,30,0.85)";
      g.lineWidth = S * 0.12;
      g.beginPath();
      g.arc(S / 2, S / 2, S * 0.4, 0, TAU);
      g.stroke();
      g.strokeStyle = "#fff";
      g.lineWidth = S * 0.06;
      g.stroke();
    });
    atlasTex = new THREE.CanvasTexture(cv);
    atlasTex.encoding = THREE.LinearEncoding;
    atlasTex.minFilter = THREE.LinearMipmapLinearFilter;
    atlasTex.name = "ptmt:props-atlas";
    return atlasTex;
  };

  /* ------------------------------------------------------------------ lueurs et particules */
  // Modes : 0 lueur fixe (vacille), 1 fumée qui monte, 2 étincelle en spirale, 3 goutte en cloche,
  // 4 marque au sol qui glisse (chevrons), 5 onde qui s'élargit (à plat), 6 rayon vertical,
  // 7 éclat bref (scintillement), 8 onde face à la caméra, 9 marque au sol fixe (vacille).
  const FX_VERT = /* glsl */ `
    attribute vec2 aCorner;
    attribute vec4 aA;   // mode, phase, vitesse, taille
    attribute vec4 aB;   // selon le mode
    attribute vec4 aC;   // selon le mode ; w = case de la planche
    attribute vec4 aCol; // couleur linéaire, opacité
    attribute vec4 aD;   // additif (0..1), groupe, vacillement, rotation
    uniform float uTime;
    uniform vec4 uGain;
    uniform vec4 uGain2;
    varying vec2 vUv;
    varying vec4 vCol;
    varying float vAdd;
    float ptGain(float g) {
      if (g < 0.5) return uGain.x; if (g < 1.5) return uGain.y; if (g < 2.5) return uGain.z; if (g < 3.5) return uGain.w;
      if (g < 4.5) return uGain2.x; if (g < 5.5) return uGain2.y; if (g < 6.5) return uGain2.z; return uGain2.w;
    }
    void main() {
      float mode = aA.x, ph = aA.y, sp = aA.z, size = aA.w;
      float gain = ptGain(aD.y);
      vec3 c = position;
      float alpha = aCol.a * gain;
      float s = size;
      float t = fract(uTime * sp + ph);
      int kind = 0; // 0 face caméra, 1 à plat, 2 rayon
      if (mode < 0.5) {
        s *= 1.0 + aD.z * (0.6 * sin(uTime * 7.3 + ph * 40.0) + 0.4 * sin(uTime * 12.7 + ph * 17.0));
      } else if (mode < 1.5) {
        c += vec3(aB.y * t + sin(t * 5.0 + ph * 9.0) * 0.12, aB.x * t, aB.z * t);
        s = mix(size, aB.w, t);
        alpha *= smoothstep(0.0, 0.15, t) * (1.0 - t);
      } else if (mode < 2.5) {
        float a = ph * 6.2832 + t * aB.y;
        float r = aB.x * (1.0 - 0.35 * t);
        c += vec3(cos(a) * r, t * aB.z, sin(a) * r);
        alpha *= sin(3.1416 * t);
        s *= 0.55 + 0.45 * sin(uTime * 11.0 + ph * 50.0);
      } else if (mode < 3.5) {
        c += aC.xyz * t + vec3(0.0, -0.5 * aB.x * t * t, 0.0);
        alpha *= 1.0 - t * t;
      } else if (mode < 4.5) {
        kind = 1;
        c += vec3(aC.x, 0.0, aC.z) * (t - 0.5) * aB.x;
        alpha *= sin(3.1416 * t);
      } else if (mode < 5.5) {
        kind = 1;
        s = mix(size, aB.x, t);
        alpha *= (1.0 - t) * smoothstep(0.0, 0.1, t);
      } else if (mode < 6.5) {
        kind = 2;
        alpha *= 0.8 + 0.2 * sin(uTime * 3.0 + ph * 6.0);
      } else if (mode < 7.5) {
        float b = pow(max(0.0, sin((uTime * sp + ph) * 6.2832)), 18.0);
        s *= b;
        alpha *= b;
      } else if (mode < 8.5) {
        s = mix(size, aB.x, t);
        alpha *= (1.0 - t) * smoothstep(0.0, 0.1, t);
      } else {
        kind = 1;
        s *= 1.0 + aD.z * 0.12 * sin(uTime * 3.1 + ph * 20.0);
      }
      // Taille apparente : suit l'échelle de l'objet (gemme portée plus petite).
      float sc = length(modelMatrix[0].xyz);
      vec4 mv;
      if (kind == 1) {
        float ca = cos(aD.w), sa = sin(aD.w);
        vec2 q = vec2(aCorner.x * ca - aCorner.y * sa, aCorner.x * sa + aCorner.y * ca) * s;
        mv = modelViewMatrix * vec4(c + vec3(q.x, 0.0, q.y), 1.0);
      } else if (kind == 2) {
        mv = modelViewMatrix * vec4(c + vec3(0.0, (aCorner.y * 0.5 + 0.5) * aB.x, 0.0), 1.0);
        mv.x += aCorner.x * s * sc;
      } else {
        float ca = cos(aD.w), sa = sin(aD.w);
        mv = modelViewMatrix * vec4(c, 1.0);
        mv.xy += vec2(aCorner.x * ca - aCorner.y * sa, aCorner.x * sa + aCorner.y * ca) * s * sc;
        mv.z += 0.3 * sc;
      }
      gl_Position = projectionMatrix * mv;
      float cell = aC.w;
      vec2 cuv = vec2(mod(cell, 4.0), 3.0 - floor(cell / 4.0));
      vUv = (cuv + (aCorner * 0.5 + 0.5)) * 0.25;
      vCol = vec4(aCol.rgb, alpha);
      vAdd = aD.x;
    }
  `;
  const FX_FRAG = /* glsl */ `
    uniform sampler2D uAtlas;
    varying vec2 vUv;
    varying vec4 vCol;
    varying float vAdd;
    void main() {
      vec4 tx = texture2D(uAtlas, vUv);
      float a = tx.a * vCol.a;
      if (a < 0.004) discard;
      gl_FragColor = vec4(vCol.rgb * tx.rgb, 1.0);
      #include <tonemapping_fragment>
      #include <encodings_fragment>
      gl_FragColor.rgb *= a;
      gl_FragColor.a = a * (1.0 - vAdd);
    }
  `;
  const MODE = (P.FXMODE = { glow: 0, smoke: 1, spark: 2, drop: 3, slide: 4, ringFlat: 5, beam: 6, glint: 7, ring: 8, decal: 9 });
  /**
   * Lot de lueurs animées par la carte graphique (un appel de dessin).
   *  specs : [{ mode, p:[x,y,z], size, cell, color, a, add, speed, phase, group, flick, rot,
   *             rise, drift:[x,z], end (taille finale), r (rayon), turns, h (hauteur),
   *             vel:[x,y,z], grav, len, dir:[x,z] }]
   *  → { mesh, gain: Vector4 (groupes 0..3), gain2: Vector4 (groupes 4..7) }
   */
  P.fx = function (specs, o) {
    o = o || {};
    const n = specs.length;
    const pos = new Float32Array(n * 12),
      cor = new Float32Array(n * 8),
      A = new Float32Array(n * 16),
      B = new Float32Array(n * 16),
      C = new Float32Array(n * 16),
      Cl = new Float32Array(n * 16),
      D = new Float32Array(n * 16),
      idx = new Uint16Array(n * 6);
    const corners = [-1, -1, 1, -1, 1, 1, -1, 1];
    let rMax = 0;
    specs.forEach((s, i) => {
      const mode = typeof s.mode === "string" ? MODE[s.mode] : s.mode || 0;
      const c = col(s.color || "#ffffff");
      let b = [0, 0, 0, 0],
        cc = [0, 0, 0, s.cell === undefined ? CELL.glow : typeof s.cell === "string" ? CELL[s.cell] : s.cell];
      if (mode === 1) b = [s.rise || 1.5, s.drift ? s.drift[0] : 0.2, s.drift ? s.drift[1] : 0, s.end || s.size * 2.5];
      else if (mode === 2) b = [s.r || 0.5, s.turns || 3, s.h || 2, 0];
      else if (mode === 3) {
        b = [s.grav || 9, 0, 0, 0];
        cc[0] = s.vel[0];
        cc[1] = s.vel[1];
        cc[2] = s.vel[2];
      } else if (mode === 4) {
        b = [s.len || 2, 0, 0, 0];
        cc[0] = s.dir ? s.dir[0] : 0;
        cc[2] = s.dir ? s.dir[1] : 1;
      } else if (mode === 5 || mode === 8) b = [s.end || s.size * 3, 0, 0, 0];
      else if (mode === 6) b = [s.h || 3, 0, 0, 0];
      const sp = s.speed === undefined ? 0.5 : s.speed;
      for (let k = 0; k < 4; k++) {
        const v = i * 4 + k;
        pos[v * 3] = s.p[0];
        pos[v * 3 + 1] = s.p[1];
        pos[v * 3 + 2] = s.p[2];
        cor[v * 2] = corners[k * 2];
        cor[v * 2 + 1] = corners[k * 2 + 1];
        A.set([mode, s.phase || 0, sp, s.size || 0.3], v * 4);
        B.set(b, v * 4);
        C.set(cc, v * 4);
        Cl.set([c.r, c.g, c.b, s.a === undefined ? 1 : s.a], v * 4);
        D.set([s.add === undefined ? 1 : s.add, s.group || 0, s.flick || 0, s.rot || 0], v * 4);
      }
      idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
      const reach = Math.hypot(s.p[0], s.p[1], s.p[2]) + (s.size || 0.3) * 3 + (s.rise || 0) + (s.h || 0) + (s.len || 0) + (s.end || 0) + (s.vel ? Math.hypot(s.vel[0], s.vel[1], s.vel[2]) : 0);
      rMax = Math.max(rMax, reach);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aCorner", new THREE.BufferAttribute(cor, 2));
    g.setAttribute("aA", new THREE.BufferAttribute(A, 4));
    g.setAttribute("aB", new THREE.BufferAttribute(B, 4));
    g.setAttribute("aC", new THREE.BufferAttribute(C, 4));
    g.setAttribute("aCol", new THREE.BufferAttribute(Cl, 4));
    g.setAttribute("aD", new THREE.BufferAttribute(D, 4));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), rMax + 1);
    const gain = new THREE.Vector4(1, 1, 1, 1),
      gain2 = new THREE.Vector4(1, 1, 1, 1);
    const m = new THREE.ShaderMaterial({
      uniforms: { uTime: o.time || U.time, uGain: { value: gain }, uGain2: { value: gain2 }, uAtlas: { value: P.atlas() } },
      vertexShader: FX_VERT,
      fragmentShader: FX_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      // Les marques au sol sont vues de dessus (sens horaire) : on dessine les deux faces.
      side: THREE.DoubleSide,
    });
    m.name = "ptmt:props:fx";
    const mesh = new THREE.Mesh(g, m);
    mesh.name = o.name || "lueurs";
    mesh.renderOrder = o.order === undefined ? 5 : o.order;
    mesh.castShadow = mesh.receiveShadow = false;
    mesh.userData.noBounds = true;
    return { mesh, gain, gain2, material: m };
  };

  /* ------------------------------------------------------------------ eau qui coule */
  // Coursier, chute et bief du moulin : filets clairs qui défilent selon v (vitesse par sommet).
  const WATER_VERT = /* glsl */ `
    attribute vec4 aCol;
    attribute float aFlow;
    uniform float uTime;
    varying vec2 vUv;
    varying vec4 vCol;
    varying float vFlow;
    varying vec3 vPos;
    void main() {
      vUv = uv;
      vCol = aCol;
      vFlow = aFlow;
      vPos = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;
  const WATER_FRAG = /* glsl */ `
    uniform float uTime;
    varying vec2 vUv;
    varying vec4 vCol;
    varying float vFlow;
    varying vec3 vPos;
    float wh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float wn(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(wh(i), wh(i + vec2(1.0, 0.0)), f.x), mix(wh(i + vec2(0.0, 1.0)), wh(i + vec2(1.0, 1.0)), f.x), f.y);
    }
    void main() {
      vec2 q = vec2(vUv.x * 6.0, vUv.y * 2.0 - uTime * vFlow);
      float n = wn(q * vec2(1.0, 1.0)) * 0.6 + wn(q * vec2(2.3, 2.0) + 7.0) * 0.4;
      float streak = smoothstep(0.55, 0.85, n);
      float edge = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);
      vec3 c = mix(vCol.rgb, vec3(0.93, 0.98, 1.0), streak * 0.75);
      float a = vCol.a * mix(0.8, 1.0, streak) * mix(0.55, 1.0, edge);
      gl_FragColor = vec4(c, 1.0);
      #include <tonemapping_fragment>
      #include <encodings_fragment>
      gl_FragColor.a = a;
    }
  `;
  let waterMat = null;
  P.waterMaterial = function () {
    if (waterMat) return waterMat;
    waterMat = new THREE.ShaderMaterial({
      uniforms: { uTime: U.time },
      vertexShader: WATER_VERT,
      fragmentShader: WATER_FRAG,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    waterMat.name = "ptmt:props:water";
    return waterMat;
  };
  /**
   * Ruban d'eau le long d'une suite de points (largeur, normale « haut » donnée) :
   *  pts : [[x, y, z], ...], w : largeur, up : [x, y, z] (axe de la largeur = up × tangente),
   *  color, a, flow (vitesse de défilement). Renvoie des tableaux à fusionner (P.waterMesh).
   */
  P.waterStrip = function (pts, w, side, color, a, flow) {
    const c = col(color);
    const out = { pos: [], uv: [], col: [], flow: [], idx: [] };
    let len = 0;
    for (let i = 0; i < pts.length; i++) {
      if (i > 0) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]);
      const sx = side[0] * w * 0.5,
        sy = side[1] * w * 0.5,
        sz = side[2] * w * 0.5;
      out.pos.push(pts[i][0] - sx, pts[i][1] - sy, pts[i][2] - sz, pts[i][0] + sx, pts[i][1] + sy, pts[i][2] + sz);
      out.uv.push(0, -len / w, 1, -len / w);
      const aa = typeof a === "function" ? a(i / (pts.length - 1)) : a;
      out.col.push(c.r, c.g, c.b, aa, c.r, c.g, c.b, aa);
      out.flow.push(flow, flow);
      if (i > 0) {
        const b = (i - 1) * 2;
        out.idx.push(b, b + 1, b + 3, b, b + 3, b + 2);
      }
    }
    return out;
  };
  P.waterMesh = function (strips) {
    const pos = [],
      uv = [],
      cl = [],
      fl = [],
      idx = [];
    for (const s of strips) {
      const o = pos.length / 3;
      pos.push(...s.pos);
      uv.push(...s.uv);
      cl.push(...s.col);
      fl.push(...s.flow);
      for (const i of s.idx) idx.push(i + o);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute("aCol", new THREE.Float32BufferAttribute(cl, 4));
    g.setAttribute("aFlow", new THREE.Float32BufferAttribute(fl, 1));
    g.setIndex(idx);
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, P.waterMaterial());
    m.renderOrder = 3;
    m.name = "eau";
    return m;
  };

  /* ------------------------------------------------------------------ petites aides */
  P.rng = (seed) => PTMT.rng(((seed | 0) * 2654435761) >>> 0 || 1);
  /** Couleur hexadécimale légèrement variée (luminosité, teinte) — pour varier les plantes. */
  P.vary = function (hex, rnd, dl, dh) {
    const c = new THREE.Color(hex);
    const hsl = { h: 0, s: 0, l: 0 };
    c.getHSL(hsl);
    c.setHSL((hsl.h + (rnd() - 0.5) * (dh || 0.03) + 1) % 1, hsl.s, clamp(hsl.l * (1 + (rnd() - 0.5) * (dl || 0.16)), 0, 1));
    return "#" + c.getHexString();
  };
  /** Nombre de triangles et d'appels de dessin (objets visibles) d'un objet : bilans de budget. */
  P.stats = function (obj) {
    let tris = 0,
      calls = 0;
    (function walk(o) {
      if (!o.visible) return;
      if ((o.isMesh || o.isPoints) && o.geometry) {
        const g = o.geometry;
        const c = g.index ? g.index.count : g.attributes.position.count;
        tris += (o.isInstancedMesh ? o.count : 1) * (g.drawRange && g.drawRange.count !== Infinity ? Math.min(c, g.drawRange.count) : c) / 3;
        calls++;
      }
      for (const ch of o.children) walk(ch);
    })(obj);
    return { tris: Math.round(tris), calls };
  };
})();
