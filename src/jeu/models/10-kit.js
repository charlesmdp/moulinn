// « Pas touche à mes trésors » — kit de modélisation procédurale partagé.
//
// Tout ce qui sert aux modèles (tours, décor, bâtiments) :
//  - maths d'animation (ressorts amortis, lissages, angles) sans allocation par image ;
//  - petites textures dessinées au chargement sur des canvas (moellons, briques, planches,
//    ardoises, lave, eau, tourbillon, runes, filet, braises, pièces d'or…), aucune ressource externe ;
//  - une palette de matières partagées (couleurs de sommets : une seule matière « pierre » sert à
//    toutes les teintes, ce qui permet de fusionner les pièces et de limiter les appels de dessin) ;
//  - des constructeurs de géométries (boîtes arrondies, tours, cristaux, rochers, tubes effilés…) ;
//  - K.part(clé) : assemble des pièces transformées puis les fusionne par matière (résultat mis en
//    cache par clé : deux tours identiques partagent leurs géométries) ;
//  - K.face(...) : des yeux expressifs (paupières boudeuses, sourcils, pupilles qui regardent, clignements) ;
//  - les effets communs (halo au sol, anneau de sélection, aura de Frénésie) ;
//  - les tours v3 : gabarits articulés (UN maillage animé par os pour toute une tour, matière « dessin
//    animé » à liseré sombre, yeux, fanion), la coque commune et le registre
//    PTMT.models.ctTower(famille, niveau, spécialisation) / ctTowerInfo (familles : 20-boar, 21-swan, 22-dog).
(function () {
  "use strict";
  const PTMT = globalThis.PTMT;
  if (!PTMT || typeof THREE === "undefined") return;
  const K = (PTMT.models.kit = PTMT.models.kit || {});

  /* ------------------------------------------------------------------ maths */
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  /** Lissage exponentiel indépendant de la cadence. */
  const damp = (a, b, k, dt) => b + (a - b) * Math.exp(-k * dt);
  /** Bosse 0 → 1 → 0 sur [0, 1]. */
  const bump = (t) => (t <= 0 || t >= 1 ? 0 : Math.sin(Math.PI * t));
  const easeOut = (t) => 1 - (1 - t) * (1 - t) * (1 - t);
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  function angleTo(cur, target, maxStep) {
    let d = (target - cur) % TAU;
    if (d > Math.PI) d -= TAU;
    else if (d < -Math.PI) d += TAU;
    return cur + (d > maxStep ? maxStep : d < -maxStep ? -maxStep : d);
  }
  /** Pseudo-bruit lisse à base de sinus (flammes, tremblements), sans allocation. */
  const wob = (t, s) => Math.sin(t * 1.7 + s) * 0.5 + Math.sin(t * 2.9 + s * 1.3) * 0.3 + Math.sin(t * 5.3 + s * 0.7) * 0.2;
  K.math = { TAU, clamp, lerp, smooth, damp, bump, easeOut, easeInOut, angleTo, wob };

  /** Ressort amorti (recul, rebonds) intégré par sous-pas : stable même à 20 images/s. */
  class Spring {
    constructor(k, c, x) {
      this.k = k;
      this.c = c;
      this.x = x || 0;
      this.v = 0;
      this.target = this.x;
    }
    step(dt) {
      const n = dt > 1 / 120 ? Math.min(10, Math.ceil(dt * 120)) : 1;
      const h = dt / n;
      for (let i = 0; i < n; i++) {
        this.v += (-this.k * (this.x - this.target) - this.c * this.v) * h;
        this.x += this.v * h;
      }
      return this.x;
    }
    kick(v) {
      this.v += v;
      return this;
    }
    set(x, v) {
      this.x = x;
      this.v = v || 0;
      return this;
    }
  }
  K.Spring = Spring;

  /* ------------------------------------------------------------------ bruit */
  function hash2(x, y, s) {
    let h = Math.imul((x | 0) + Math.imul(s | 0, 374761), 374761393) ^ Math.imul((y | 0) + 668265 + (s | 0), 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }
  const hash3 = (x, y, z, s) => hash2((x | 0) + Math.imul(z | 0, 1013), (y | 0) - Math.imul(z | 0, 7919), s);
  /** Bruit de valeur périodique (cx × cy cellules sur [0,1]²) : textures sans raccord. */
  function vnoise(u, v, cx, cy, seed) {
    const x = u * cx,
      y = v * cy,
      ix = Math.floor(x),
      iy = Math.floor(y);
    const fx = x - ix,
      fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx),
      sy = fy * fy * (3 - 2 * fy);
    const wx = (i) => ((i % cx) + cx) % cx,
      wy = (i) => ((i % cy) + cy) % cy;
    const a = hash2(wx(ix), wy(iy), seed),
      b = hash2(wx(ix + 1), wy(iy), seed),
      c = hash2(wx(ix), wy(iy + 1), seed),
      d = hash2(wx(ix + 1), wy(iy + 1), seed);
    return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
  }
  function fbm(u, v, cells, seed, oct) {
    let s = 0,
      a = 0.5,
      t = 0;
    for (let o = 0; o < (oct || 4); o++) {
      s += vnoise(u, v, cells << o, cells << o, seed + o * 17) * a;
      t += a;
      a *= 0.5;
    }
    return s / t;
  }
  function noise3(x, y, z, seed) {
    const ix = Math.floor(x),
      iy = Math.floor(y),
      iz = Math.floor(z);
    const fx = x - ix,
      fy = y - iy,
      fz = z - iz;
    const sx = fx * fx * (3 - 2 * fx),
      sy = fy * fy * (3 - 2 * fy),
      sz = fz * fz * (3 - 2 * fz);
    const h = (i, j, k) => hash3(ix + i, iy + j, iz + k, seed);
    const x00 = lerp(h(0, 0, 0), h(1, 0, 0), sx),
      x10 = lerp(h(0, 1, 0), h(1, 1, 0), sx),
      x01 = lerp(h(0, 0, 1), h(1, 0, 1), sx),
      x11 = lerp(h(0, 1, 1), h(1, 1, 1), sx);
    return lerp(lerp(x00, x10, sy), lerp(x01, x11, sy), sz);
  }
  const VOR = { d1: 0, d2: 0, id: 0, cx: 0, cy: 0 };
  /** Voronoï périodique : distances au 1er et 2e germe et identifiant de cellule. */
  function voronoi(u, v, n, seed, jit) {
    const x = u * n,
      y = v * n,
      ix = Math.floor(x),
      iy = Math.floor(y);
    let d1 = 9,
      d2 = 9,
      id = 0,
      cx = 0,
      cy = 0;
    for (let j = -1; j <= 1; j++)
      for (let i = -1; i <= 1; i++) {
        const gx = ix + i,
          gy = iy + j;
        const wx = ((gx % n) + n) % n,
          wy = ((gy % n) + n) % n;
        const px = gx + 0.5 + (hash2(wx, wy, seed) - 0.5) * jit;
        const py = gy + 0.5 + (hash2(wx, wy, seed + 7) - 0.5) * jit;
        const dx = px - x,
          dy = py - y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < d1) {
          d2 = d1;
          d1 = d;
          id = wx + wy * n;
          cx = dx;
          cy = dy;
        } else if (d < d2) d2 = d;
      }
    VOR.d1 = d1;
    VOR.d2 = d2;
    VOR.id = id;
    VOR.cx = cx;
    VOR.cy = cy;
    return VOR;
  }
  K.noise = { hash2, hash3, vnoise, fbm, noise3, voronoi };

  /* ------------------------------------------------------------------ couleurs */
  const colCache = new Map();
  /** Couleur linéaire partagée (ne pas modifier l'objet renvoyé). */
  function col(hex) {
    let c = colCache.get(hex);
    if (!c) {
      c = PTMT.color(hex);
      colCache.set(hex, c);
    }
    return c;
  }
  K.col = col;

  /* ------------------------------------------------------------------ textures */
  const texCache = new Map();
  function canvasTex(key, w, h, draw, opt) {
    let t = texCache.get(key);
    if (t) return t;
    const cv = document.createElement("canvas");
    cv.width = w;
    cv.height = h;
    const g = cv.getContext("2d");
    draw(g, w, h);
    t = new THREE.CanvasTexture(cv);
    t.encoding = THREE.sRGBEncoding;
    t.wrapS = t.wrapT = opt && opt.clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
    t.anisotropy = 4;
    t.name = "ptmt:" + key;
    texCache.set(key, t);
    return t;
  }
  function paint(g, w, h, fn) {
    const img = g.createImageData(w, h),
      d = img.data,
      o = [0, 0, 0, 255];
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        o[3] = 255;
        fn(x, y, o);
        const i = (y * w + x) * 4;
        d[i] = o[0];
        d[i + 1] = o[1];
        d[i + 2] = o[2];
        d[i + 3] = o[3];
      }
    g.putImageData(img, 0, 0);
  }
  function glyph(g, k, cx, top, bot, s) {
    // Runes inventées (traits simples lisibles de loin).
    const m = (top + bot) / 2,
      w = s;
    g.beginPath();
    switch (k % 10) {
      case 0:
        g.moveTo(cx - w * 0.3, top);
        g.lineTo(cx - w * 0.3, bot);
        g.moveTo(cx - w * 0.3, top + 2);
        g.lineTo(cx + w * 0.5, top + (bot - top) * 0.28);
        g.moveTo(cx - w * 0.3, m - 2);
        g.lineTo(cx + w * 0.5, m + (bot - top) * 0.12);
        break;
      case 1:
        g.moveTo(cx - w * 0.4, bot);
        g.lineTo(cx - w * 0.4, top);
        g.lineTo(cx + w * 0.4, top + (bot - top) * 0.35);
        g.lineTo(cx + w * 0.4, bot);
        break;
      case 2:
        g.moveTo(cx - w * 0.3, top);
        g.lineTo(cx - w * 0.3, bot);
        g.moveTo(cx - w * 0.3, top + (bot - top) * 0.25);
        g.lineTo(cx + w * 0.4, m);
        g.lineTo(cx - w * 0.3, top + (bot - top) * 0.75);
        break;
      case 3:
        g.moveTo(cx, bot);
        g.lineTo(cx, top);
        g.moveTo(cx, m);
        g.lineTo(cx - w * 0.5, top + 2);
        g.moveTo(cx, m);
        g.lineTo(cx + w * 0.5, top + 2);
        break;
      case 4:
        g.moveTo(cx, top);
        g.lineTo(cx + w * 0.45, m - 4);
        g.lineTo(cx, bot - 10);
        g.lineTo(cx - w * 0.45, m - 4);
        g.closePath();
        g.moveTo(cx - w * 0.2, bot - 12);
        g.lineTo(cx - w * 0.5, bot);
        g.moveTo(cx + w * 0.2, bot - 12);
        g.lineTo(cx + w * 0.5, bot);
        break;
      case 5:
        g.moveTo(cx, bot);
        g.lineTo(cx, top);
        g.moveTo(cx - w * 0.45, top + (bot - top) * 0.35);
        g.lineTo(cx, top);
        g.lineTo(cx + w * 0.45, top + (bot - top) * 0.35);
        break;
      case 6:
        g.moveTo(cx - w * 0.5, top);
        g.lineTo(cx + w * 0.5, bot);
        g.moveTo(cx + w * 0.5, top);
        g.lineTo(cx - w * 0.5, bot);
        break;
      case 7:
        g.moveTo(cx - w * 0.4, bot);
        g.lineTo(cx - w * 0.4, top);
        g.lineTo(cx + w * 0.4, m);
        g.moveTo(cx + w * 0.4, bot);
        g.lineTo(cx + w * 0.4, top);
        g.lineTo(cx - w * 0.4, m);
        break;
      case 8:
        g.arc(cx, m, w * 0.42, 0, TAU);
        g.moveTo(cx, top - 1);
        g.lineTo(cx, bot + 1);
        break;
      default:
        g.moveTo(cx - w * 0.3, top);
        g.lineTo(cx - w * 0.3, bot);
        g.moveTo(cx - w * 0.3, top + 2);
        g.quadraticCurveTo(cx + w * 0.6, top + (bot - top) * 0.25, cx - w * 0.3, m);
        g.quadraticCurveTo(cx + w * 0.6, top + (bot - top) * 0.75, cx - w * 0.3, bot - 2);
    }
    g.stroke();
  }
  function seal(g, w, h, center, seed) {
    g.fillStyle = "#000";
    g.fillRect(0, 0, w, h);
    const cx = w / 2,
      cy = h / 2,
      R = w * 0.47;
    g.strokeStyle = "#fff";
    g.lineCap = "round";
    g.lineJoin = "round";
    g.shadowColor = "#fff";
    g.shadowBlur = 5;
    g.lineWidth = 4;
    g.beginPath();
    g.arc(cx, cy, R, 0, TAU);
    g.stroke();
    g.lineWidth = 2.5;
    g.beginPath();
    g.arc(cx, cy, R * 0.8, 0, TAU);
    g.stroke();
    g.beginPath();
    g.arc(cx, cy, R * 0.34, 0, TAU);
    g.stroke();
    const rnd = PTMT.rng(seed);
    const n = 12;
    g.lineWidth = 3;
    for (let i = 0; i < n; i++) {
      g.save();
      g.translate(cx, cy);
      g.rotate((i / n) * TAU);
      glyph(g, Math.floor(rnd() * 10), 0, -R * 0.97, -R * 0.83, R * 0.12);
      g.restore();
    }
    g.lineWidth = 3;
    if (center === "flake") {
      for (let i = 0; i < 6; i++) {
        g.save();
        g.translate(cx, cy);
        g.rotate((i / 6) * TAU);
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(0, -R * 0.74);
        for (const f of [0.34, 0.54]) {
          g.moveTo(0, -R * f);
          g.lineTo(-R * 0.12, -R * (f + 0.12));
          g.moveTo(0, -R * f);
          g.lineTo(R * 0.12, -R * (f + 0.12));
        }
        g.stroke();
        g.restore();
      }
    } else if (center === "spiral") {
      g.beginPath();
      for (let a = 0; a < TAU * 2.6; a += 0.08) {
        const r = R * 0.05 + a * R * 0.042;
        const x = cx + Math.cos(a) * r,
          y = cy + Math.sin(a) * r;
        if (a === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
    } else if (center === "tri") {
      // Un seul triangle (symbole alchimique neutre) barré, avec un point central.
      g.beginPath();
      for (let i = 0; i <= 3; i++) {
        const a = (i / 3) * TAU - Math.PI / 2;
        const x = cx + Math.cos(a) * R * 0.66,
          y = cy + Math.sin(a) * R * 0.66;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.moveTo(cx - R * 0.3, cy + R * 0.08);
      g.lineTo(cx + R * 0.3, cy + R * 0.08);
      g.stroke();
      g.beginPath();
      g.arc(cx, cy - R * 0.12, R * 0.07, 0, TAU);
      g.fillStyle = "#fff";
      g.fill();
    }
  }

  const T = (K.tex = {
    /** Moellons de granit (gris neutre, à teinter). */
    rubble: () =>
      canvasTex("rubble", 256, 256, (g, w, h) =>
        paint(g, w, h, (x, y, o) => {
          const u = x / w,
            v = y / h;
          voronoi(u, v, 5, 11, 0.9);
          const e = VOR.d2 - VOR.d1;
          const tone = 0.7 + hash2(VOR.id, 1, 5) * 0.28;
          const dome = 1.1 - VOR.d1 * 0.5 + VOR.cy * 0.12;
          const n = fbm(u, v, 8, 3, 3);
          let l = tone * dome * (0.84 + n * 0.3) + (hash2(x, y, 9) - 0.5) * 0.08;
          const m = smooth(0.02, 0.085, e);
          l = lerp(0.3 + n * 0.1, l, m) * (0.8 + 0.2 * smooth(0.0, 0.16, e));
          const lichen = smooth(0.68, 0.8, fbm(u, v, 4, 21, 2)) * m;
          o[0] = 255 * l * (1.0 - lichen * 0.08);
          o[1] = 255 * l * (0.99 - lichen * 0.02);
          o[2] = 255 * l * (0.95 - lichen * 0.18);
        }),
      ),
    /** Pierres de taille / briques (8 rangs × 4 blocs). */
    blocks: () =>
      canvasTex("blocks", 256, 256, (g, w, h) =>
        paint(g, w, h, (x, y, o) => {
          const rh = h / 8,
            row = Math.floor(y / rh),
            fy = y % rh;
          const bw = w / 4,
            xx = (x + (row & 1 ? bw / 2 : 0)) % w,
            c = Math.floor(xx / bw),
            fx = xx % bw;
          const edge = Math.min(fx, bw - fx, fy, rh - fy);
          const n = fbm(x / w, y / h, 8, 5, 3);
          let l = (0.7 + hash2(c, row, 3) * 0.3) * (0.84 + n * 0.3) + (hash2(x, y, 4) - 0.5) * 0.07;
          if (fy < 5) l *= 1.08;
          if (rh - fy < 6) l *= 0.84;
          if (edge < 2.6) l = 0.36 + n * 0.12;
          o[0] = 255 * l * 1.02;
          o[1] = 255 * l;
          o[2] = 255 * l * 0.97;
        }),
      ),
    /** Planches verticales, veinage, clous. */
    planks: () =>
      canvasTex("planks", 256, 256, (g, w, h) =>
        paint(g, w, h, (x, y, o) => {
          const pw = w / 4,
            p = Math.floor(x / pw),
            fx = x % pw;
          const u = x / w,
            v = y / h;
          const grain = vnoise(u, v, 40, 3, 5 + p) * 0.6 + vnoise(u, v, 90, 6, 9) * 0.4;
          let l = (0.72 + hash2(p, 7, 2) * 0.26) * (0.78 + grain * 0.36);
          const ring = Math.sin((u * 40 + vnoise(u, v, 8, 2, 3) * 6) * 3) * 0.04;
          l += ring;
          if (fx < 2 || fx > pw - 2) l *= 0.42;
          const ny = [26, 150];
          for (const yy of ny) {
            const dx = fx - pw * 0.5,
              dy = y - yy;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < 3.2) l *= 0.45;
          }
          o[0] = 255 * l * 1.04;
          o[1] = 255 * l * 0.98;
          o[2] = 255 * l * 0.9;
        }),
      ),
    /** Ardoises (rangs décalés, bords ombrés). */
    slate: () =>
      canvasTex("slate", 256, 256, (g, w, h) =>
        paint(g, w, h, (x, y, o) => {
          const rh = h / 8,
            row = Math.floor(y / rh),
            fy = y % rh;
          const tw = w / 4,
            xx = (x + (row & 1 ? tw / 2 : 0)) % w,
            c = Math.floor(xx / tw),
            fx = xx % tw;
          const n = fbm(x / w, y / h, 8, 8, 3);
          let l = (0.58 + hash2(c, row, 8) * 0.32) * (0.86 + n * 0.24) + (hash2(x, y, 3) - 0.5) * 0.05;
          if (fy < 5) l *= 0.55 + fy * 0.07;
          if (rh - fy < 2.5) l *= 1.18;
          if (fx < 1.5 || tw - fx < 1.5) l *= 0.6;
          const lichen = smooth(0.66, 0.8, fbm(x / w, y / h, 4, 31, 2)) * 0.6;
          o[0] = 255 * l * (0.92 - lichen * 0.12);
          o[1] = 255 * l * (0.97 - lichen * 0.04);
          o[2] = 255 * l * (1.06 - lichen * 0.3);
        }),
      ),
    /** Écorce (rainures verticales). */
    bark: () =>
      canvasTex("bark", 128, 128, (g, w, h) =>
        paint(g, w, h, (x, y, o) => {
          const u = x / w,
            v = y / h;
          const r = vnoise(u + vnoise(u, v, 4, 4, 2) * 0.08, v, 14, 2, 7);
          let l = 0.5 + r * 0.45 + (hash2(x, y, 5) - 0.5) * 0.08;
          if (r < 0.28) l *= 0.55;
          o[0] = 255 * l;
          o[1] = 255 * l * 0.93;
          o[2] = 255 * l * 0.85;
        }),
      ),
    /** Toile de jute (sacs). */
    burlap: () =>
      canvasTex("burlap", 128, 128, (g, w, h) =>
        paint(g, w, h, (x, y, o) => {
          const a = Math.sin(x * Math.PI * 0.5) * Math.sin(y * Math.PI * 0.5);
          let l = 0.8 + a * 0.1 + (vnoise(x / w, y / h, 16, 16, 3) - 0.5) * 0.2 + (hash2(x, y, 1) - 0.5) * 0.08;
          o[0] = 255 * l;
          o[1] = 255 * l * 0.93;
          o[2] = 255 * l * 0.8;
        }),
      ),
    /** Plaques de fer rivetées. */
    plates: () =>
      canvasTex("plates", 256, 256, (g, w, h) =>
        paint(g, w, h, (x, y, o) => {
          const fx = x % 128,
            fy = y % 128;
          const n = fbm(x / w, y / h, 8, 44, 3);
          let l = 0.62 + (n - 0.5) * 0.35 + (hash2(x >> 3, y >> 3, 2) - 0.5) * 0.06;
          if (fx < 2 || fy < 2) l = 0.28;
          else if (fx < 4 || fy < 4) l *= 1.2;
          const rx = ((fx + 8) % 32) - 8;
          for (const [dx, dy] of [
            [rx, fy - 9],
            [fx - 9, ((fy + 8) % 32) - 8],
          ]) {
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < 4.2) l = 0.7 + (-dx - dy) * 0.07;
            else if (d < 5.2) l *= 0.6;
          }
          o[0] = o[1] = o[2] = 255 * l;
        }),
      ),
    /** Lave : croûte sombre fendue de fissures incandescentes. */
    lava: () =>
      canvasTex("lava", 256, 256, (g, w, h) =>
        paint(g, w, h, (x, y, o) => {
          const u = x / w,
            v = y / h;
          voronoi(u, v, 4, 31, 0.95);
          const e = VOR.d2 - VOR.d1;
          const n = fbm(u, v, 8, 13, 3);
          const t = clamp((1 - smooth(0.0, 0.16, e)) * (0.7 + 0.3 * n) + smooth(0.6, 0.85, n) * 0.45, 0, 1);
          o[0] = lerp(70 + n * 50, 255, t);
          o[1] = lerp(18 + n * 14, 70 + 170 * t * t, t);
          o[2] = lerp(10, 20 + 110 * t * t * t, t);
        }),
      ),
    /** Eau magique : caustiques claires sur fond turquoise. */
    water: () =>
      canvasTex("water", 256, 256, (g, w, h) =>
        paint(g, w, h, (x, y, o) => {
          const u = x / w,
            v = y / h;
          const wu = u + (vnoise(u, v, 4, 4, 5) - 0.5) * 0.12,
            wv = v + (vnoise(u, v, 4, 4, 9) - 0.5) * 0.12;
          voronoi(((wu % 1) + 1) % 1, ((wv % 1) + 1) % 1, 6, 17, 0.9);
          const e = VOR.d2 - VOR.d1;
          const c = Math.pow(1 - smooth(0.0, 0.2, e), 2.2);
          const n = fbm(u, v, 4, 3, 3);
          o[0] = lerp(18 + n * 20, 190, c);
          o[1] = lerp(104 + n * 40, 255, c);
          o[2] = lerp(138 + n * 30, 245, c);
        }),
      ),
    /** Tourbillon (bras spiralés) pour les bassins. */
    swirl: () =>
      canvasTex("swirl", 256, 256, (g, w, h) =>
        paint(g, w, h, (x, y, o) => {
          const dx = x / w - 0.5,
            dy = y / h - 0.5;
          const r = Math.sqrt(dx * dx + dy * dy) * 2,
            a = Math.atan2(dy, dx);
          const arms = 0.5 + 0.5 * Math.sin(a * 3 + Math.log(r + 0.03) * 6.5 + vnoise(x / w, y / h, 6, 6, 2) * 1.5);
          const foam = smooth(0.72, 0.96, arms) * smooth(0.06, 0.3, r);
          const deep = smooth(0.95, 0.05, r);
          const n = fbm(x / w, y / h, 8, 5, 2);
          o[0] = lerp(lerp(30, 8, deep) + n * 18, 205, foam);
          o[1] = lerp(lerp(140, 70, deep) + n * 30, 255, foam);
          o[2] = lerp(lerp(165, 110, deep) + n * 20, 250, foam);
        }),
      ),
    /** Bande de runes (blanches sur noir : à utiliser en additif et à teinter). */
    runes: () =>
      canvasTex("runes", 512, 64, (g, w, h) => {
        g.fillStyle = "#000";
        g.fillRect(0, 0, w, h);
        g.strokeStyle = "#fff";
        g.lineWidth = 4.5;
        g.lineCap = "round";
        g.lineJoin = "round";
        g.shadowColor = "#fff";
        g.shadowBlur = 7;
        const seq = [0, 3, 1, 8, 5, 2, 7, 4];
        for (let i = 0; i < 8; i++) glyph(g, seq[i], i * 64 + 32, 12, 52, 26);
      }),
    sealIce: () => canvasTex("sealIce", 256, 256, (g, w, h) => seal(g, w, h, "flake", 5)),
    sealSpiral: () => canvasTex("sealSpiral", 256, 256, (g, w, h) => seal(g, w, h, "spiral", 9)),
    sealTri: () => canvasTex("sealTri", 256, 256, (g, w, h) => seal(g, w, h, "tri", 13)),
    /** Filet de corde (alpha). */
    net: () =>
      canvasTex("net", 128, 128, (g, w, h) => {
        g.clearRect(0, 0, w, h);
        g.lineCap = "round";
        for (const [c, lw] of [
          ["#6b5436", 7],
          ["#d9bf86", 4.5],
        ]) {
          g.strokeStyle = c;
          g.lineWidth = lw;
          for (let k = -4; k <= 4; k++) {
            g.beginPath();
            g.moveTo(k * 32, 0);
            g.lineTo(k * 32 + 128, 128);
            g.moveTo(k * 32 + 128, 0);
            g.lineTo(k * 32, 128);
            g.stroke();
          }
        }
        g.fillStyle = "#8a6a3e";
        for (let i = 0; i <= 4; i++)
          for (let j = 0; j <= 4; j++) {
            g.beginPath();
            g.arc(i * 32 + ((j & 1) * 16), j * 32, 4.5, 0, TAU);
            g.fill();
          }
      }),
    /** Halo radial doux (blanc, alpha). */
    soft: () =>
      canvasTex(
        "soft",
        64,
        64,
        (g, w, h) => {
          const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
          gr.addColorStop(0, "rgba(255,255,255,1)");
          gr.addColorStop(0.3, "rgba(255,255,255,0.6)");
          gr.addColorStop(0.65, "rgba(255,255,255,0.16)");
          gr.addColorStop(1, "rgba(255,255,255,0)");
          g.fillStyle = gr;
          g.fillRect(0, 0, w, h);
        },
        { clamp: true },
      ),
    /** Anneau de sélection (profil doux, tirets). */
    selRing: () =>
      canvasTex("selRing", 256, 32, (g, w, h) =>
        paint(g, w, h, (x, y, o) => {
          const v = (y + 0.5) / h;
          const a = Math.exp(-Math.pow((v - 0.5) / 0.2, 2));
          const dash = x % 32 < 22 ? 1 : 0.3;
          o[0] = o[1] = o[2] = 255;
          o[3] = 255 * a * (0.35 + 0.65 * dash);
        }),
      ),
    /** Chevrons (aura de Frénésie). */
    chevrons: () =>
      canvasTex("chevrons", 256, 64, (g, w, h) => {
        g.clearRect(0, 0, w, h);
        g.strokeStyle = "#fff";
        g.lineWidth = 9;
        g.lineCap = "round";
        g.lineJoin = "round";
        g.shadowColor = "#fff";
        g.shadowBlur = 8;
        for (let i = 0; i < 4; i++) {
          g.beginPath();
          g.moveTo(i * 64 + 16, 12);
          g.lineTo(i * 64 + 42, 32);
          g.lineTo(i * 64 + 16, 52);
          g.stroke();
        }
      }),
    /** Traînées verticales (colonne d'aura). */
    streaks: () =>
      canvasTex("streaks", 64, 128, (g, w, h) => {
        g.clearRect(0, 0, w, h);
        const rnd = PTMT.rng(3);
        for (let i = 0; i < 14; i++) {
          const x = rnd() * w,
            y0 = rnd() * h,
            len = 24 + rnd() * 60;
          const gr = g.createLinearGradient(0, y0, 0, y0 + len);
          gr.addColorStop(0, "rgba(255,255,255,0)");
          gr.addColorStop(0.5, "rgba(255,255,255,0.9)");
          gr.addColorStop(1, "rgba(255,255,255,0)");
          g.fillStyle = gr;
          const lw = 1.5 + rnd() * 2.5;
          g.fillRect(x, y0, lw, len);
          if (y0 + len > h) g.fillRect(x, y0 - h, lw, len);
        }
      }),
    /** Braises : fissures incandescentes sur fond noir (additif). */
    ember: () =>
      canvasTex("ember", 256, 256, (g, w, h) =>
        paint(g, w, h, (x, y, o) => {
          const u = x / w,
            v = y / h;
          voronoi(u, v, 5, 41, 0.9);
          const e = VOR.d2 - VOR.d1;
          const crack = 1 - smooth(0.0, 0.07, e);
          const mask = smooth(0.42, 0.66, fbm(u, v, 4, 17, 3));
          const t = crack * mask + smooth(0.8, 0.95, fbm(u, v, 8, 5, 2)) * 0.5;
          o[0] = 255 * clamp(t * 1.2, 0, 1);
          o[1] = 255 * clamp(t * 0.42 + t * t * t * 0.5, 0, 1);
          o[2] = 255 * clamp(t * t * t * 0.25, 0, 1);
        }),
      ),
    /** Écailles de poisson (rangs de demi-cercles). */
    scales: () =>
      canvasTex("scales", 128, 128, (g, w, h) =>
        paint(g, w, h, (x, y, o) => {
          const rh = 16,
            row = Math.floor(y / rh),
            cw = 32,
            xx = (x + (row & 1 ? cw / 2 : 0)) % w;
          const cx = Math.floor(xx / cw) * cw + cw / 2,
            dx = xx - cx,
            dy = (y % rh) + 4;
          const d = Math.sqrt(dx * dx + dy * dy) / (cw * 0.62);
          let l = 0.62 + (1 - d) * 0.3 + (hash2(x, y, 3) - 0.5) * 0.05;
          if (d > 0.86 && d < 1.02) l = 0.95;
          if (d >= 1.02) l = 0.45;
          o[0] = o[1] = o[2] = 255 * clamp(l, 0, 1);
        }),
      ),
    /** Tas de pièces d'or. */
    coins: () =>
      canvasTex("coins", 128, 128, (g, w, h) => {
        g.fillStyle = "#8a5a12";
        g.fillRect(0, 0, w, h);
        const rnd = PTMT.rng(19);
        for (let i = 0; i < 70; i++) {
          const x = rnd() * w,
            y = rnd() * h,
            r = 7 + rnd() * 6,
            sq = 0.55 + rnd() * 0.45;
          for (const ox of [-w, 0, w])
            for (const oy of [-h, 0, h]) {
              const cx = x + ox,
                cy = y + oy;
              if (cx < -r || cx > w + r || cy < -r || cy > h + r) continue;
              g.save();
              g.translate(cx, cy);
              g.scale(1, sq);
              const gr = g.createRadialGradient(-r * 0.3, -r * 0.3, 1, 0, 0, r);
              gr.addColorStop(0, "#fff3b0");
              gr.addColorStop(0.5, "#ffc93c");
              gr.addColorStop(1, "#b07818");
              g.fillStyle = gr;
              g.beginPath();
              g.arc(0, 0, r, 0, TAU);
              g.fill();
              g.strokeStyle = "#8a5a10";
              g.lineWidth = 1.2;
              g.stroke();
              g.beginPath();
              g.arc(0, 0, r * 0.62, 0, TAU);
              g.strokeStyle = "rgba(140,90,16,0.6)";
              g.stroke();
              g.restore();
            }
        }
      }),
  });

  /* ------------------------------------------------------------------ matières */
  const std = (o) => new THREE.MeshStandardMaterial(Object.assign({ color: 0xffffff, vertexColors: true, roughness: 0.8, metalness: 0 }, o));
  const basic = (o) => new THREE.MeshBasicMaterial(Object.assign({ color: 0xffffff, vertexColors: true }, o));
  const ADD = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false };
  const MATS = {
    matte: () => std({ roughness: 0.86 }),
    satin: () => std({ roughness: 0.55 }),
    glossy: () => std({ roughness: 0.26, metalness: 0.02 }),
    metal: () => std({ roughness: 0.38, metalness: 0.32 }),
    gold: () => std({ roughness: 0.32, metalness: 0.6, emissive: col("#5a3400"), emissiveIntensity: 0.45 }),
    stone: () => std({ map: T.rubble(), roughness: 0.92 }),
    blocks: () => std({ map: T.blocks(), roughness: 0.9 }),
    wood: () => std({ map: T.planks(), roughness: 0.82 }),
    slate: () => std({ map: T.slate(), roughness: 0.62, metalness: 0.05 }),
    bark: () => std({ map: T.bark(), roughness: 0.92 }),
    burlap: () => std({ map: T.burlap(), roughness: 0.96 }),
    iron: () => std({ map: T.plates(), roughness: 0.5, metalness: 0.28 }),
    scaly: () => std({ map: T.scales(), roughness: 0.38, metalness: 0.3 }),
    coins: () => std({ map: T.coins(), roughness: 0.35, metalness: 0.45, emissive: col("#6a4000"), emissiveIntensity: 0.55 }),
    ice: () => std({ roughness: 0.12, metalness: 0.05, flatShading: true, emissive: col("#2f9dff"), emissiveIntensity: 0.3 }),
    iceSoft: () => std({ roughness: 0.18, metalness: 0.03, emissive: col("#4fb4ff"), emissiveIntensity: 0.22 }),
    snow: () => std({ roughness: 0.9, emissive: col("#9fc2ef"), emissiveIntensity: 0.14 }),
    water: () => std({ map: T.water(), emissiveMap: T.water(), emissive: col("#ffffff"), emissiveIntensity: 0.5, roughness: 0.08, metalness: 0.12 }),
    swirl: () => std({ map: T.swirl(), emissiveMap: T.swirl(), emissive: col("#ffffff"), emissiveIntensity: 0.55, roughness: 0.08, metalness: 0.1 }),
    eye: () => std({ roughness: 0.3 }),
    net: () => std({ map: T.net(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 }),
    glow: () => basic({}),
    lava: () => basic({ map: T.lava() }),
    glowAdd: () => basic(Object.assign({}, ADD)),
    halo: () => basic(Object.assign({ map: T.soft() }, ADD)),
    runes: () => basic(Object.assign({ map: T.runes(), polygonOffset: true, polygonOffsetFactor: -2, side: THREE.DoubleSide }, ADD)),
    sealIce: () => basic(Object.assign({ map: T.sealIce(), polygonOffset: true, polygonOffsetFactor: -2 }, ADD)),
    sealSpiral: () => basic(Object.assign({ map: T.sealSpiral(), polygonOffset: true, polygonOffsetFactor: -2 }, ADD)),
    sealTri: () => basic(Object.assign({ map: T.sealTri(), polygonOffset: true, polygonOffsetFactor: -2 }, ADD)),
    ember: () => basic(Object.assign({ map: T.ember(), polygonOffset: true, polygonOffsetFactor: -2 }, ADD)),
    sel: () => basic(Object.assign({ map: T.selRing(), side: THREE.DoubleSide }, ADD)),
    /** Anneau coloré en mélange normal (couleurs d'état fidèles : vert valide, rouge interdit). */
    selN: () => basic({ map: T.selRing(), side: THREE.DoubleSide, transparent: true, depthWrite: false }),
    chev: () => basic(Object.assign({ map: T.chevrons(), side: THREE.DoubleSide }, ADD)),
    chevN: () => basic({ map: T.chevrons(), side: THREE.DoubleSide, transparent: true, depthWrite: false }),
    streak: () => basic(Object.assign({ map: T.streaks(), side: THREE.DoubleSide }, ADD)),
    waterFx: () => std({ map: T.water(), emissiveMap: T.water(), emissive: col("#ffffff"), emissiveIntensity: 0.7, roughness: 0.08, transparent: true, opacity: 0.82, depthWrite: false }),
  };
  /** Matières sans ombre portée (lumières, décalques, effets). */
  const NO_SHADOW = new Set(["glow", "lava", "glowAdd", "halo", "runes", "sealIce", "sealSpiral", "sealTri", "ember", "sel", "selN", "chev", "chevN", "streak", "waterFx", "pupil"]);
  MATS.pupil = () => basic({});
  K.defMat = (name, factory, noShadow) => {
    MATS[name] = factory;
    if (noShadow) NO_SHADOW.add(name);
  };
  K.mat = (name) => {
    const f = MATS[name];
    if (!f) throw new Error("PTMT kit : matière inconnue " + name);
    return PTMT.mat("kit:" + name, f);
  };
  K.castsShadow = (name) => !NO_SHADOW.has(name);

  /** Anime les matières partagées (défilement de la lave et de l'eau) : idempotent pour un temps donné. */
  let lastTick = -1;
  K.tick = function (time) {
    if (time === lastTick) return;
    lastTick = time;
    const w = T.water();
    w.offset.set((time * 0.05) % 1, (-time * 0.11) % 1);
    const l = T.lava();
    l.offset.set((time * 0.013) % 1, (-time * 0.045) % 1);
    const s = T.streaks();
    s.offset.y = (-time * 0.9) % 1;
    const c = T.chevrons();
    c.offset.x = (-time * 1.6) % 1;
  };

  /* ------------------------------------------------------------------ géométries */
  const gc = (key, f) => PTMT.geo("kit:" + key, f);

  function roundedBox(w, h, d, r, seg) {
    const s = seg * 2 + 1;
    r = Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4);
    const g = new THREE.BoxGeometry(1, 1, 1, s, s, s);
    const pos = g.attributes.position,
      nor = g.attributes.normal;
    const hx = w / 2 - r,
      hy = h / 2 - r,
      hz = d / 2 - r,
      half = 0.5 / s;
    const n = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i),
        y = pos.getY(i),
        z = pos.getZ(i);
      const sx = Math.sign(x),
        sy = Math.sign(y),
        sz = Math.sign(z);
      n.set(x - sx * half, y - sy * half, z - sz * half).normalize();
      pos.setXYZ(i, hx * sx + n.x * r, hy * sy + n.y * r, hz * sz + n.z * r);
      nor.setXYZ(i, n.x, n.y, n.z);
    }
    return g;
  }

  /** Normales lissées par position (efface les coutures des sphères et lathes déformées). */
  function smoothNormals(g) {
    const pos = g.attributes.position;
    const idx = g.index;
    const keyMap = new Map();
    const gid = new Int32Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      const k = Math.round(pos.getX(i) * 1e4) + "," + Math.round(pos.getY(i) * 1e4) + "," + Math.round(pos.getZ(i) * 1e4);
      let id = keyMap.get(k);
      if (id === undefined) keyMap.set(k, (id = keyMap.size));
      gid[i] = id;
    }
    const acc = new Float32Array(keyMap.size * 3);
    const tri = idx ? idx.count / 3 : pos.count / 3;
    const a = new THREE.Vector3(),
      b = new THREE.Vector3(),
      c = new THREE.Vector3();
    for (let t = 0; t < tri; t++) {
      const i0 = idx ? idx.getX(t * 3) : t * 3,
        i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1,
        i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
      a.fromBufferAttribute(pos, i0);
      b.fromBufferAttribute(pos, i1);
      c.fromBufferAttribute(pos, i2);
      c.sub(b);
      a.sub(b);
      c.cross(a);
      for (const i of [i0, i1, i2]) {
        acc[gid[i] * 3] += c.x;
        acc[gid[i] * 3 + 1] += c.y;
        acc[gid[i] * 3 + 2] += c.z;
      }
    }
    const nor = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = acc[gid[i] * 3],
        y = acc[gid[i] * 3 + 1],
        z = acc[gid[i] * 3 + 2];
      const l = Math.sqrt(x * x + y * y + z * z) || 1;
      nor[i * 3] = x / l;
      nor[i * 3 + 1] = y / l;
      nor[i * 3 + 2] = z / l;
    }
    g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
    return g;
  }

  function crystalGeo(r, h, sides, tipT, tipB, topScale) {
    const pos = [];
    const ind = [];
    const off = Math.PI / sides;
    pos.push(0, -tipB, 0);
    for (let k = 0; k < 2; k++) {
      const rr = k ? r * topScale : r;
      for (let i = 0; i < sides; i++) {
        const a = off + (i / sides) * TAU;
        pos.push(Math.sin(a) * rr, k ? h : 0, Math.cos(a) * rr);
      }
    }
    pos.push(0, h + tipT, 0);
    const top = 1 + sides * 2;
    for (let i = 0; i < sides; i++) {
      const a0 = 1 + i,
        a1 = 1 + ((i + 1) % sides),
        b0 = 1 + sides + i,
        b1 = 1 + sides + ((i + 1) % sides);
      ind.push(0, a1, a0);
      ind.push(a0, a1, b1, a0, b1, b0);
      ind.push(b0, b1, top);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(ind);
    const ng = g.toNonIndexed();
    ng.computeVertexNormals();
    return ng;
  }

  function blobGeo(r, detail, amp, seed, freq) {
    const g = new THREE.IcosahedronGeometry(1, detail);
    const p = g.attributes.position;
    const f = freq || 1.6;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i),
        y = p.getY(i),
        z = p.getZ(i);
      const l = Math.sqrt(x * x + y * y + z * z);
      x /= l;
      y /= l;
      z /= l;
      const n = noise3(x * f + seed * 1.37, y * f + 11.3, z * f - seed * 0.71, seed | 0) * 0.65 + noise3(x * f * 2.3, y * f * 2.3, z * f * 2.3, (seed | 0) + 5) * 0.35;
      const k = r * (1 + amp * (n * 2 - 1));
      p.setXYZ(i, x * k, y * k, z * k);
    }
    g.computeVertexNormals();
    return g;
  }

  function taperTubeGeo(pts, rf, seg, rad) {
    const curve = new THREE.CatmullRomCurve3(pts.map((q) => new THREE.Vector3(q[0], q[1], q[2])));
    const fr = curve.computeFrenetFrames(seg, false);
    const pos = [],
      nor = [],
      uv = [],
      ind = [];
    const P = new THREE.Vector3();
    for (let i = 0; i <= seg; i++) {
      const t = i / seg;
      curve.getPointAt(t, P);
      const r = typeof rf === "function" ? rf(t) : lerp(rf[0], rf[1], t);
      const N = fr.normals[i],
        B = fr.binormals[i];
      for (let j = 0; j <= rad; j++) {
        const a = (j / rad) * TAU,
          s = Math.sin(a),
          c = -Math.cos(a);
        const nx = c * N.x + s * B.x,
          ny = c * N.y + s * B.y,
          nz = c * N.z + s * B.z;
        pos.push(P.x + r * nx, P.y + r * ny, P.z + r * nz);
        nor.push(nx, ny, nz);
        uv.push(t, j / rad);
      }
    }
    for (let i = 1; i <= seg; i++)
      for (let j = 1; j <= rad; j++) {
        const a = (rad + 1) * (i - 1) + (j - 1),
          b = (rad + 1) * i + (j - 1),
          c = (rad + 1) * i + j,
          d = (rad + 1) * (i - 1) + j;
        ind.push(a, b, d, b, c, d);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(ind);
    return g;
  }

  function ringFlatGeo(rIn, rOut, seg, uRep) {
    const pos = [],
      nor = [],
      uv = [],
      ind = [];
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * TAU,
        c = Math.cos(a),
        s = Math.sin(a);
      pos.push(c * rIn, 0, s * rIn, c * rOut, 0, s * rOut);
      nor.push(0, 1, 0, 0, 1, 0);
      uv.push((i / seg) * uRep, 0, (i / seg) * uRep, 1);
    }
    for (let i = 0; i < seg; i++) {
      const i0 = i * 2,
        o0 = i * 2 + 1,
        i1 = i * 2 + 2,
        o1 = i * 2 + 3;
      ind.push(i0, i1, o0, o0, i1, o1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(ind);
    return g;
  }

  function shapeFrom(pts, smoothCurve) {
    const v = pts.map((p) => new THREE.Vector2(p[0], p[1]));
    const s = new THREE.Shape();
    if (smoothCurve) {
      s.moveTo(v[0].x, v[0].y);
      s.splineThru(v.slice(1).concat([v[0]]));
    } else s.setFromPoints(v);
    return s;
  }
  function extrudeGeo(shape, depth, bevel, curveSeg) {
    const g = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: bevel > 0,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 2,
      curveSegments: curveSeg || 8,
      steps: 1,
    });
    g.translate(0, 0, -depth / 2);
    g.clearGroups();
    return g;
  }
  function starShape(points, rOut, rIn) {
    const pts = [];
    for (let i = 0; i < points * 2; i++) {
      const a = (i / (points * 2)) * TAU + Math.PI / 2,
        r = i & 1 ? rIn : rOut;
      pts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    return shapeFrom(pts);
  }

  const G = (K.g = {
    box: (w, h, d) => gc(`box${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d)),
    rbox: (w, h, d, r, s) => gc(`rbox${w},${h},${d},${r},${s || 1}`, () => roundedBox(w, h, d, r, s || 1)),
    cyl: (rt, rb, h, seg, open, hs) => gc(`cyl${rt},${rb},${h},${seg},${open},${hs}`, () => new THREE.CylinderGeometry(rt, rb, h, seg || 12, hs || 1, !!open)),
    sphere: (r, ws, hs, t0, tl) =>
      gc(`sph${r},${ws},${hs},${t0},${tl}`, () => new THREE.SphereGeometry(r, ws || 16, hs || 12, 0, TAU, t0 || 0, tl === undefined ? Math.PI : tl)),
    cone: (r, h, seg, open) => gc(`cone${r},${h},${seg},${open}`, () => new THREE.ConeGeometry(r, h, seg || 10, 1, !!open)),
    torus: (R, r, rs, ts, arc) => gc(`tor${R},${r},${rs},${ts},${arc}`, () => new THREE.TorusGeometry(R, r, rs || 8, ts || 24, arc || TAU)),
    ico: (r, d) => gc(`ico${r},${d}`, () => new THREE.IcosahedronGeometry(r, d || 0)),
    oct: (r) => gc(`oct${r}`, () => new THREE.OctahedronGeometry(r, 0)),
    /** Profil de révolution [[rayon, y], ...] (du bas vers le haut). */
    lathe: (key, pts, seg, p0, pl) =>
      gc("lathe:" + key, () => new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(p[0], p[1])), seg || 16, p0 || 0, pl || TAU)),
    disc: (r, seg) => gc(`disc${r},${seg}`, () => new THREE.CircleGeometry(r, seg || 20)),
    discUp: (r, seg) => gc(`discUp${r},${seg}`, () => new THREE.CircleGeometry(r, seg || 20).rotateX(-Math.PI / 2)),
    plane: (w, h, ws, hs) => gc(`plane${w},${h},${ws},${hs}`, () => new THREE.PlaneGeometry(w, h, ws || 1, hs || 1)),
    planeUp: (w, h) => gc(`planeUp${w},${h}`, () => new THREE.PlaneGeometry(w, h).rotateX(-Math.PI / 2)),
    ring: (rIn, rOut, seg, uRep) => gc(`ring${rIn},${rOut},${seg},${uRep}`, () => ringFlatGeo(rIn, rOut, seg || 32, uRep || 1)),
    crystal: (r, h, sides, tipT, tipB, topScale) =>
      gc(`cry${r},${h},${sides},${tipT},${tipB},${topScale}`, () => crystalGeo(r, h, sides || 6, tipT, tipB, topScale === undefined ? 0.9 : topScale)),
    rock: (r, detail, amp, seed) => gc(`rock${r},${detail},${amp},${seed}`, () => blobGeo(r, detail === undefined ? 1 : detail, amp === undefined ? 0.22 : amp, seed || 1)),
    blob: (r, detail, amp, seed) => gc(`blob${r},${detail},${amp},${seed}`, () => smoothNormals(blobGeo(r, detail === undefined ? 2 : detail, amp === undefined ? 0.12 : amp, seed || 1))),
    /** Capsule (axe Y, centrée). */
    capsule: (r, len, seg, rings) =>
      gc(`caps${r},${len},${seg},${rings}`, () => {
        const pts = [];
        const n = rings || 4;
        for (let i = 0; i <= n; i++) {
          const a = -Math.PI / 2 + (i / n) * (Math.PI / 2);
          pts.push(new THREE.Vector2(Math.max(1e-4, Math.cos(a) * r), -len / 2 + Math.sin(a) * r));
        }
        for (let i = 0; i <= n; i++) {
          const a = (i / n) * (Math.PI / 2);
          pts.push(new THREE.Vector2(Math.max(1e-4, Math.cos(a) * r), len / 2 + Math.sin(a) * r));
        }
        return new THREE.LatheGeometry(pts, seg || 10);
      }),
    /** Tube effilé le long d'une courbe ; rf = [r0, r1] ou fonction t → rayon. */
    tube: (key, pts, rf, seg, rad) => gc("tube:" + key, () => taperTubeGeo(pts, rf, seg || 12, rad || 8)),
    extrude: (key, shapeOrPts, depth, bevel, smoothCurve) =>
      gc("ext:" + key, () => extrudeGeo(Array.isArray(shapeOrPts) ? shapeFrom(shapeOrPts, smoothCurve) : shapeOrPts, depth, bevel || 0)),
    star: (points, rOut, rIn, depth) => gc(`star${points},${rOut},${rIn},${depth}`, () => extrudeGeo(starShape(points, rOut, rIn), depth, 0)),
    /** Flocon à six branches (plat, face +Z). */
    flake: (r) =>
      gc(`flake${r}`, () => {
        const parts = [];
        const m = new THREE.Matrix4();
        const t = r * 0.13;
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI;
          parts.push(new THREE.BoxGeometry(t, r * 2, t * 0.6).applyMatrix4(m.makeRotationZ(a)));
        }
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU;
          for (const s of [-1, 1]) {
            const b = new THREE.BoxGeometry(t * 0.8, r * 0.42, t * 0.5);
            b.translate(0, r * 0.2, 0);
            b.applyMatrix4(m.makeRotationZ(s * 0.75));
            b.translate(0, r * 0.55, 0);
            b.applyMatrix4(m.makeRotationZ(a));
            parts.push(b);
          }
        }
        return mergeRaw(parts);
      }),
  });
  K.shape = shapeFrom;
  K.smoothNormals = smoothNormals;

  /* ------------------------------------------------------------------ assemblage */
  function ensureAttrs(g) {
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    return g;
  }
  /** Fusion brute (non indexée) de géométries déjà placées. */
  function mergeRaw(list) {
    const flat = list.map((g) => ensureAttrs(g.index ? g.toNonIndexed() : g));
    let n = 0;
    for (const g of flat) n += g.attributes.position.count;
    const pos = new Float32Array(n * 3),
      nor = new Float32Array(n * 3),
      uv = new Float32Array(n * 2);
    let o = 0;
    for (const g of flat) {
      pos.set(g.attributes.position.array, o * 3);
      nor.set(g.attributes.normal.array, o * 3);
      uv.set(g.attributes.uv.array, o * 2);
      o += g.attributes.position.count;
    }
    const m = new THREE.BufferGeometry();
    m.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    m.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
    m.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    return m;
  }

  const _m4 = new THREE.Matrix4(),
    _q = new THREE.Quaternion(),
    _e = new THREE.Euler(),
    _v = new THREE.Vector3(),
    _s = new THREE.Vector3();
  function itemMatrix(o, out) {
    const p = o.p,
      r = o.r,
      s = o.s;
    _v.set(p ? p[0] : 0, p ? p[1] : 0, p ? p[2] : 0);
    _e.set(r ? r[0] : 0, r ? r[1] : 0, r ? r[2] : 0, o.ro || "XYZ");
    _q.setFromEuler(_e);
    if (s === undefined) _s.set(1, 1, 1);
    else if (typeof s === "number") _s.set(s, s, s);
    else _s.set(s[0], s[1], s[2]);
    out.compose(_v, _q, _s);
    if (o.m) out.premultiply(o.m);
    return out;
  }
  const AXIS = { x: 0, y: 1, z: 2 };
  function bakeItem(geoIn, o, idx, seed) {
    let g = typeof geoIn === "function" ? geoIn() : geoIn;
    g = ensureAttrs(g.index ? g.toNonIndexed() : g.clone());
    const pa = g.attributes.position.array;
    const n = pa.length / 3;
    const colors = new Float32Array(n * 3);
    const base = col(o.c || "#ffffff");
    const jit = o.j ? 1 + (hash2(idx, 3, seed) - 0.5) * 2 * o.j : 1;
    let c0, c1, ax, y0, y1;
    if (o.g) {
      c0 = col(o.g[0]);
      c1 = col(o.g[1]);
      ax = AXIS[o.g[4] || "y"];
      y0 = o.g[2];
      y1 = o.g[3];
    }
    for (let i = 0; i < n; i++) {
      let r = base.r,
        gg = base.g,
        b = base.b;
      if (o.g) {
        const t = smooth(y0, y1, pa[i * 3 + ax]);
        r = lerp(c0.r, c1.r, t);
        gg = lerp(c0.g, c1.g, t);
        b = lerp(c0.b, c1.b, t);
      }
      let f = jit;
      if (o.vj) {
        const vs = o.vs || 6;
        f *= 1 + (noise3(pa[i * 3] * vs, pa[i * 3 + 1] * vs, pa[i * 3 + 2] * vs, seed + idx) - 0.5) * 2 * o.vj;
      }
      colors[i * 3] = r * f;
      colors[i * 3 + 1] = gg * f;
      colors[i * 3 + 2] = b * f;
    }
    itemMatrix(o, _m4);
    g.applyMatrix4(_m4);
    const uvs = g.attributes.uv.array;
    let nor = g.attributes.normal.array;
    if (_m4.determinant() < 0) {
      // Pièce en miroir : on retourne l'ordre des sommets pour garder les faces vers l'extérieur.
      const sw = (arr, k, a, b) => {
        for (let c = 0; c < k; c++) {
          const t = arr[a * k + c];
          arr[a * k + c] = arr[b * k + c];
          arr[b * k + c] = t;
        }
      };
      for (let t = 0; t < n; t += 3) {
        sw(pa, 3, t + 1, t + 2);
        sw(nor, 3, t + 1, t + 2);
        sw(uvs, 2, t + 1, t + 2);
        sw(colors, 3, t + 1, t + 2);
      }
    }
    if (o.flat) {
      // Facettes : normales recalculées après l'éventuel retournement (non indexé → normales plates).
      g.deleteAttribute("normal");
      g.computeVertexNormals();
      nor = g.attributes.normal.array;
    }
    if (o.gp) {
      // Dégradé calculé dans l'espace de l'assemblage (après placement) : o.gp = [c0, c1, y0, y1].
      const a0 = col(o.gp[0]),
        a1 = col(o.gp[1]);
      for (let i = 0; i < n; i++) {
        const t = smooth(o.gp[2], o.gp[3], pa[i * 3 + 1]);
        colors[i * 3] = lerp(a0.r, a1.r, t);
        colors[i * 3 + 1] = lerp(a0.g, a1.g, t);
        colors[i * 3 + 2] = lerp(a0.b, a1.b, t);
      }
    }
    if (o.ao) {
      const lo = o.ao === true ? 0.45 : o.ao;
      const hi = o.aoH || 0.9;
      for (let i = 0; i < n; i++) {
        const f = lerp(lo, 1, smooth(0, hi, pa[i * 3 + 1]));
        colors[i * 3] *= f;
        colors[i * 3 + 1] *= f;
        colors[i * 3 + 2] *= f;
      }
    }
    if (o.uv === "box") {
      const tile = o.tile || 1;
      for (let t = 0; t < n; t += 3) {
        const nx = Math.abs(nor[t * 3] + nor[t * 3 + 3] + nor[t * 3 + 6]),
          ny = Math.abs(nor[t * 3 + 1] + nor[t * 3 + 4] + nor[t * 3 + 7]),
          nz = Math.abs(nor[t * 3 + 2] + nor[t * 3 + 5] + nor[t * 3 + 8]);
        for (let k = 0; k < 3; k++) {
          const i = t + k,
            x = pa[i * 3],
            y = pa[i * 3 + 1],
            z = pa[i * 3 + 2];
          let u, v;
          if (ny >= nx && ny >= nz) {
            u = x;
            v = z;
          } else if (nx >= nz) {
            u = z;
            v = y;
          } else {
            u = x;
            v = y;
          }
          uvs[i * 2] = u / tile + (o.uo || 0);
          uvs[i * 2 + 1] = v / tile + (o.vo || 0);
        }
      }
    } else if (o.uv) {
      for (let i = 0; i < n; i++) {
        uvs[i * 2] *= o.uv[0];
        uvs[i * 2 + 1] *= o.uv[1];
      }
    }
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return g;
  }
  function mergeBaked(list) {
    let n = 0;
    for (const g of list) n += g.attributes.position.count;
    const pos = new Float32Array(n * 3),
      nor = new Float32Array(n * 3),
      uv = new Float32Array(n * 2),
      cl = new Float32Array(n * 3);
    let o = 0;
    for (const g of list) {
      pos.set(g.attributes.position.array, o * 3);
      nor.set(g.attributes.normal.array, o * 3);
      uv.set(g.attributes.uv.array, o * 2);
      cl.set(g.attributes.color.array, o * 3);
      o += g.attributes.position.count;
      g.dispose();
    }
    const m = new THREE.BufferGeometry();
    m.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    m.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
    m.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    m.setAttribute("color", new THREE.BufferAttribute(cl, 3));
    m.computeBoundingSphere();
    m.computeBoundingBox();
    return m;
  }
  const partCache = new Map();
  function strSeed(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return (h >>> 0) % 100000;
  }
  /**
   * Assemblage de pièces fusionnées par matière.
   *   const p = K.part("clé-unique");
   *   p.add(geo, "stone", { p:[x,y,z], r:[rx,ry,rz], s:1|[sx,sy,sz], c:"#hex", g:[c0,c1,y0,y1,axe], ao:true, uv:"box"|[su,sv], tile, j, vj, flat });
   *   const group = p.build({ mats: { glow: matièreParInstance } });
   * Avec une clé déjà construite, les ajouts sont ignorés et les géométries fusionnées réutilisées.
   */
  class Part {
    constructor(key) {
      this.key = key;
      this.items = [];
      this.cached = key ? partCache.get(key) : undefined;
    }
    add(geo, mat, o) {
      if (!this.cached) this.items.push(geo, mat, o || {});
      return this;
    }
    build(opt) {
      let entry = this.cached;
      if (!entry) {
        const seed = strSeed(this.key || "part");
        const byMat = new Map();
        for (let i = 0; i < this.items.length; i += 3) {
          const mat = this.items[i + 1];
          let arr = byMat.get(mat);
          if (!arr) byMat.set(mat, (arr = []));
          arr.push(bakeItem(this.items[i], this.items[i + 2], i / 3, seed));
        }
        entry = [];
        for (const [mat, list] of byMat) entry.push([mat, mergeBaked(list)]);
        if (this.key) partCache.set(this.key, entry);
        this.items.length = 0;
      }
      const grp = new THREE.Group();
      for (const [mat, geo] of entry) {
        const m = (opt && opt.mats && opt.mats[mat]) || K.mat(mat);
        const mesh = new THREE.Mesh(geo, m);
        const lit = K.castsShadow(mat);
        mesh.castShadow = opt && opt.cast === false ? false : lit;
        mesh.receiveShadow = lit && !(opt && opt.receive === false);
        mesh.name = mat;
        grp.add(mesh);
      }
      if (opt && opt.name) grp.name = opt.name;
      return grp;
    }
  }
  K.part = (key) => new Part(key);
  /** Nouveau nœud (pivot d'animation). */
  K.node = (parent, x, y, z, name) => {
    const n = new THREE.Group();
    n.position.set(x || 0, y || 0, z || 0);
    if (name) n.name = name;
    if (parent) parent.add(n);
    return n;
  };
  /** Nombre de triangles d'un objet (pour les budgets). */
  K.triangles = (obj) => {
    let t = 0;
    obj.traverse((o) => {
      if (!o.isMesh || !o.geometry) return;
      const g = o.geometry;
      t += (g.index ? g.index.count : g.attributes.position.count) / 3;
    });
    return Math.round(t);
  };

  /** Hauteur du sommet des parties solides (ignore sprites, fumées, effets marqués userData.noBounds). */
  K.solidTop = (obj) => {
    obj.updateMatrixWorld(true);
    let top = 0;
    const b = new THREE.Box3();
    (function walk(o) {
      if (o.userData.noBounds || o.isSprite) return;
      if (o.isMesh && o.geometry) {
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        b.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
        if (b.max.y > top) top = b.max.y;
      }
      for (const c of o.children) walk(c);
    })(obj);
    return top - obj.getWorldPosition(new THREE.Vector3()).y;
  };
  /** Triangles réellement dessinés (objets visibles uniquement). */
  K.visibleTriangles = (obj) => {
    let t = 0;
    (function walk(o) {
      if (!o.visible) return;
      if (o.isMesh && o.geometry) {
        const g = o.geometry;
        t += (g.index ? g.index.count : g.attributes.position.count) / 3;
      } else if (o.isSprite) t += 2;
      for (const c of o.children) walk(c);
    })(obj);
    return Math.round(t);
  };

  /* ------------------------------------------------------------------ yeux */
  let faceSeed = 1;
  /**
   * Paire d'yeux expressifs.
   * o = { key, p:[x,y,z], r:[rx,ry,rz], gap, eye (rayon), skin, lidMat, brow (couleur | null),
   *       slant (rad, coin intérieur vers le bas = fâché), rest (angle de repos de la paupière :
   *       0 = mi-clos, négatif = ouvert), pupil (taille relative), iris (couleur), white, glowEyes }
   * Contrôle : update(dt), look(x, y) (-1..1, null = regard libre), setOpen(v) (-1 plissé … +1 écarquillé), blink().
   */
  K.face = function (parent, o) {
    const r = o.eye,
      gap = o.gap,
      key = "face:" + o.key;
    const grp = new THREE.Group();
    if (o.p) grp.position.set(o.p[0], o.p[1], o.p[2]);
    if (o.r) grp.rotation.set(o.r[0], o.r[1], o.r[2]);
    if (o.s) grp.scale.setScalar(o.s);
    parent.add(grp);
    const lo = o.lod === "lo";
    const SIDES = o.single ? [0] : [-1, 1];
    const slant = o.slant === undefined ? 0.35 : o.slant;
    // Blancs des yeux et sourcils dans un même maillage (un seul appel de dessin).
    const sc = K.part(key + ":white");
    for (const sx of SIDES) sc.add(G.sphere(r, lo ? 8 : 11, lo ? 6 : 8), o.glowEyes ? "glow" : "eye", { p: [sx * gap, 0, 0], c: o.white || (o.glowEyes ? o.glowEyes : "#fbfaf2") });
    if (o.brow) {
      const bw = o.browW || r * 1.25;
      const bt = o.browT || r * 0.3;
      const tilt = o.browTilt === undefined ? slant * 1.15 : o.browTilt;
      for (const sx of SIDES)
        sc.add(G.capsule(bt, bw, lo ? 5 : 6, 2), o.glowEyes ? "matte" : "eye", {
          p: [sx * gap, r * (o.browY || 1.3), r * 0.55],
          r: [0, 0, Math.PI / 2 + (sx || 1) * tilt],
          c: o.brow,
        });
    }
    grp.add(sc.build({ cast: false }));
    const pr = r * (o.pupil || 0.5);
    const pu = K.part(key + ":pupil");
    for (const sx of SIDES) {
      pu.add(G.disc(pr, lo ? 8 : 12), "pupil", { p: [sx * gap, 0, r * 1.005], c: o.iris || "#15110f" });
      pu.add(G.disc(pr * 0.34, 5), "pupil", { p: [sx * gap + pr * 0.32, pr * 0.36, r * 1.012], c: "#ffffff" });
    }
    const pupils = pu.build();
    grp.add(pupils);
    // Paupières : calottes hémisphériques inclinées (boudeuses), liseré sombre au bord (dégradé de sommets).
    // Les deux centres sont sur l'axe X du groupe : un seul maillage pivote autour de cet axe.
    const lp = K.part(key + ":lids");
    for (const sx of SIDES)
      lp.add(G.sphere(r * 1.1, lo ? 8 : 11, lo ? 3 : 4, 0, Math.PI / 2), o.lidMat || "matte", {
        p: [sx * gap, 0, 0],
        r: [0, 0, (sx || 1) * slant],
        g: [o.lash || "#1b1512", o.skin || "#6b625c", r * 0.02, r * 0.3],
      });
    const lids = lp.build({ cast: false });
    grp.add(lids);
    const rng = PTMT.rng(faceSeed++ * 977 + 13);
    const rest = o.rest === undefined ? 0.05 : o.rest;
    const st = { open: 0, openT: 0, blinkT: 0, nextBlink: 1 + rng() * 3, sac: 0, lx: 0, ly: 0, fx: null, fy: 0, px: 0, py: 0 };
    const maxOff = r * 0.3;
    return {
      group: grp,
      pupils,
      lids,
      look(x, y) {
        st.fx = x;
        st.fy = y || 0;
      },
      setOpen(v) {
        st.openT = v;
      },
      blink() {
        st.blinkT = 0.15;
      },
      update(dt) {
        st.nextBlink -= dt;
        if (st.nextBlink <= 0) {
          st.blinkT = 0.15;
          st.nextBlink = 1.6 + rng() * 4.2;
        }
        let bl = 0;
        if (st.blinkT > 0) {
          st.blinkT -= dt;
          bl = bump(1 - st.blinkT / 0.15);
        }
        st.open = damp(st.open, st.openT, 12, dt);
        const op = st.open;
        let ang = rest - (op > 0 ? op * 1.05 : op * 0.55);
        ang = lerp(ang, 1.62, bl);
        lids.rotation.x = ang;
        st.sac -= dt;
        if (st.sac <= 0) {
          st.lx = (rng() - 0.5) * 1.4;
          st.ly = (rng() - 0.5) * 0.7;
          st.sac = 0.7 + rng() * 2.4;
        }
        const tx = st.fx === null ? st.lx : st.fx,
          ty = st.fx === null ? st.ly : st.fy;
        st.px = damp(st.px, tx, 16, dt);
        st.py = damp(st.py, ty, 16, dt);
        pupils.position.set(clamp(st.px, -1, 1) * maxOff, clamp(st.py, -1, 1) * maxOff, 0);
      },
    };
  };

  /* ------------------------------------------------------------------ effets communs */
  const FX = (K.fx = {});
  /** Halo lumineux posé au sol (disque additif). */
  FX.halo = (hex, radius, y) => {
    const p = K.part("halo:" + hex);
    p.add(G.planeUp(2, 2), "halo", { c: hex });
    const g = p.build();
    g.scale.set(radius, 1, radius);
    g.position.y = y === undefined ? 0.03 : y;
    g.renderOrder = 2;
    return g;
  };
  /** Halo vertical (sprite) pour les bouches, lanternes, yeux lumineux. */
  const spriteMats = new Map();
  FX.sprite = (hex, size, opacity) => {
    const k = hex + ":" + (opacity || 1);
    let m = spriteMats.get(k);
    if (!m) {
      m = new THREE.SpriteMaterial({ map: T.soft(), color: col(hex), transparent: true, opacity: opacity || 1, blending: THREE.AdditiveBlending, depthWrite: false });
      spriteMats.set(k, m);
    }
    const s = new THREE.Sprite(m);
    s.scale.setScalar(size);
    return s;
  };
  /** Bouffée de fumée douce (sprite en mélange normal, matière partagée par teinte). */
  const smokeMats = new Map();
  FX.smoke = (hex, size, opacity) => {
    const k = hex + ":" + (opacity || 0.7);
    let m = smokeMats.get(k);
    if (!m) {
      m = new THREE.SpriteMaterial({ map: T.soft(), color: col(hex), transparent: true, opacity: opacity || 0.7, depthWrite: false });
      smokeMats.set(k, m);
    }
    const s = new THREE.Sprite(m);
    s.scale.setScalar(size);
    s.userData.noBounds = true;
    return s;
  };
  /** Anneau de sélection au sol. */
  FX.selRing = (radius) => {
    const p = K.part("selring");
    p.add(G.ring(0.84, 1.08, 48, 12), "sel", { c: "#ffe9a8", p: [0, 0, 0] });
    const g = p.build();
    g.scale.set(radius, 1, radius);
    g.position.y = 0.05;
    g.visible = false;
    g.renderOrder = 3;
    return g;
  };
  /** Aura de Frénésie (chevrons tournants + colonne de traînées). */
  FX.aura = (radius, height) => {
    const grp = new THREE.Group();
    const p = K.part("aura:ring");
    p.add(G.ring(0.78, 1.0, 32, 8), "chevN", { c: "#ff4a1a" });
    const ring = p.build();
    ring.position.y = 0.06;
    grp.add(ring);
    const q = K.part("aura:band");
    q.add(G.cyl(1, 1, 1, 20, true), "streak", { p: [0, 0.5, 0], c: "#ff6a2a", uv: [4, 1] });
    const band = q.build();
    band.scale.set(0.92, height, 0.92);
    grp.add(band);
    grp.scale.set(radius, 1, radius);
    grp.visible = false;
    grp.userData.ring = ring.id;
    return { group: grp, ring, band };
  };
  /** Flamme (goutte) avec dégradé jaune → rouge : géométrie centrée à la base. */
  G.flame = (r, h, seg, prof) =>
    gc(`flame${r},${h},${seg},${prof || 8}`, () => {
      const pts = [];
      const n = prof || 8;
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const rr = r * Math.sin(Math.PI * Math.pow(t, 0.72)) * (1 - t * 0.15);
        pts.push(new THREE.Vector2(Math.max(1e-4, rr), t * h));
      }
      return new THREE.LatheGeometry(pts, seg || 10);
    });


  /* ------------------------------------------------------------------ tours v3 : créatures articulées */
  // Chaque tour (sanglier, cygne, berger-dragon) est UN SkinnedMesh : socle, corps, tête, yeux et
  // accessoires sont fusionnés dans une géométrie partagée par toutes les tours identiques, chaque
  // sommet suivant un seul os (pièces rigides). Les os sont de simples Object3D animés à la main.
  // Une seule matière « dessin animé » sert à toutes les tours : couleurs de sommets franches, motifs
  // calculés dans le shader (rayures de marcassin, robe merle, écailles, plumes, bois, paille, granit)
  // et liseré sombre (coque retournée, gonflée à l'écran : épaisseur constante en pixels, écartée des
  // ombres). Les lueurs additives (flammes, runes, braises vives) forment un second groupe du même
  // maillage. Soit un appel de dessin par tour (deux avec des lueurs), plus l'ombre.
  //
  //   K.ctTemplate(clé, (R) => { R.bone(nom, parent, [x, y, z]); R.add(géo, os, opt); R.glow(géo, os, opt); … })
  //   K.ctInstance(gabarit) → { mesh, bones, bone: { nom: Bone } }
  //   K.defCt(famille, { variant(niveau, spé, opts) → variante, info(niveau, spé) })
  //   PTMT.models.ctTower(famille, niveau, spé, opts) ; PTMT.models.ctTowerInfo(famille, niveau, spé)

  /** Bogue de châtaigne : boule hérissée de piquants (icosaèdre dont les milieux d'arêtes sont tirés vers l'extérieur). */
  G.husk = (r, spike) =>
    gc(`husk${r},${spike}`, () => {
      const g = new THREE.IcosahedronGeometry(1, 1);
      const p = g.attributes.position;
      const orig = new Set();
      const base = new THREE.IcosahedronGeometry(1, 0).attributes.position;
      for (let i = 0; i < base.count; i++) orig.add(Math.round(base.getX(i) * 1000) + "," + Math.round(base.getY(i) * 1000) + "," + Math.round(base.getZ(i) * 1000));
      const k = spike || 1.85;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i),
          y = p.getY(i),
          z = p.getZ(i);
        const l = Math.sqrt(x * x + y * y + z * z);
        const isOrig = orig.has(Math.round((x / l) * 1000) + "," + Math.round((y / l) * 1000) + "," + Math.round((z / l) * 1000));
        const f = (isOrig ? 0.7 : k) * r;
        p.setXYZ(i, (x / l) * f, (y / l) * f, (z / l) * f);
      }
      g.computeVertexNormals();
      return g;
    });
  /** Châtaigne : goutte aplatie, pointe en haut (+Y). */
  G.nut = (r) =>
    gc(`nut${r}`, () => {
      const pts = [];
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        const a = t * Math.PI;
        const rr = Math.sin(a) * r * (1 - 0.35 * t * t);
        pts.push(new THREE.Vector2(Math.max(1e-4, rr), -Math.cos(a) * r * 0.85 + t * t * r * 0.35));
      }
      return new THREE.LatheGeometry(pts, 10);
    });

  /** Motifs (aMat.x) et classes de matière (aMat.y) de la matière des tours. */
  const PAT = (K.PAT = { plain: 0, fur: 1, stripes: 2, merle: 3, scales: 4, eyeW: 5, iris: 6, feather: 7, wood: 8, straw: 9, stone: 10, ember: 11, emberBlue: 12, hull: 30, glow: 31 });
  const CLS = (K.CLS = { matte: 0, satin: 1, glossy: 2, metal: 3, glow: 4, heat: 5, gold: 6, ice: 7, wet: 8, irid: 9 });
  /** Uniformes partagés : horloge des lueurs, résolution du tampon (x, y), rapport de pixels (z), contour actif (w). */
  const TOON = (K.toon = { time: { value: 0 }, outline: { value: new THREE.Vector4(1280, 800, 1, 1) } });

  const TV_PARS = /* glsl */ `
    attribute vec2 aMat;
    varying vec2 vMat;
    varying vec3 vRest;
    varying vec2 vPUv;
    uniform vec4 uOutline;
  `;
  const TV_BEGIN = /* glsl */ `
    vMat = aMat;
    vRest = position;
    vPUv = uv;
  `;
  const TV_HULL = /* glsl */ `
    if (aMat.x > 29.5) {
      // coque : poussée vers l'extérieur à l'écran (1,2 à 2,8 px selon le zoom)
      float oW = max(gl_Position.w, 0.001);
      float oPx = clamp(0.05 * projectionMatrix[1][1] * uOutline.y * 0.5 / oW / max(uOutline.z, 0.5), 1.2, 2.8) * uOutline.z * uOutline.w;
      vec3 oN = normalize(transformedNormal);
      gl_Position.xy += oN.xy * oPx * 2.0 / uOutline.xy * oW;
    }
  `;
  const TF_PARS = /* glsl */ `
    varying vec2 vMat;
    varying vec3 vRest;
    varying vec2 vPUv;
    uniform float uTime;
    float tHash3(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
    float tNoise3(vec3 p){ vec3 i = floor(p), f = fract(p); vec3 u = f * f * (3.0 - 2.0 * f);
      float a = mix(mix(tHash3(i), tHash3(i + vec3(1.0,0.0,0.0)), u.x), mix(tHash3(i + vec3(0.0,1.0,0.0)), tHash3(i + vec3(1.0,1.0,0.0)), u.x), u.y);
      float b = mix(mix(tHash3(i + vec3(0.0,0.0,1.0)), tHash3(i + vec3(1.0,0.0,1.0)), u.x), mix(tHash3(i + vec3(0.0,1.0,1.0)), tHash3(i + vec3(1.0,1.0,1.0)), u.x), u.y);
      return mix(a, b, u.z); }
    float tHash2(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    float tNoise2(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(tHash2(i), tHash2(i + vec2(1.0, 0.0)), u.x), mix(tHash2(i + vec2(0.0, 1.0)), tHash2(i + vec2(1.0, 1.0)), u.x), u.y); }
  `;
  const TF_COLOR = /* glsl */ `
    #include <color_fragment>
    float tPat = floor(vMat.x + 0.5);
    float tCls = floor(vMat.y + 0.5);
    float tHull = step(29.5, tPat);
    vec3 tAlb = diffuseColor.rgb;
    float tCrack = 0.0;
    if (tPat > 10.5 && tPat < 12.5) {
      // granit fissuré de braises : lignes de niveau d'un bruit 3D = veines qui suivent la roche
      float n = tNoise3(vRest * 1.25 + 3.7) * 0.72 + tNoise3(vRest * 3.6) * 0.28;
      tCrack = 1.0 - smoothstep(0.008, 0.028, abs(n - 0.5));
      tCrack *= smoothstep(0.35, 0.6, tNoise3(vRest * 0.9 - 2.3));
      float g = tNoise3(vRest * 2.6) * 0.5 + tNoise3(vRest * 7.0) * 0.3 + tNoise3(vRest * 21.0) * 0.2;
      tAlb *= 0.78 + 0.42 * g;
      tAlb *= 1.0 - 0.4 * step(0.83, tNoise3(vRest * 31.0));
      tAlb = mix(tAlb, tAlb * 0.25, tCrack);
    }
    if (tPat > 0.5 && tPat < 1.5) {
      // poil : touffes plus sombres et plus claires
      float n = tNoise3(vRest * 9.0) * 0.6 + tNoise3(vRest * 23.0) * 0.4;
      tAlb *= 0.84 + 0.3 * n;
    } else if (tPat > 1.5 && tPat < 2.5) {
      // rayures de marcassin : bandes crème le long du corps (u = tour autour de l'axe du corps)
      float d = abs(fract(vPUv.x) - 0.5);
      float st = 1.0 - smoothstep(0.1, 0.17, d);
      tAlb = mix(tAlb, vec3(0.83, 0.62, 0.33), st * 0.9);
      tAlb *= 0.9 + 0.2 * tNoise3(vRest * 12.0);
    } else if (tPat > 2.5 && tPat < 4.5) {
      // robe merle : marbrures sombres irrégulières (+ écailles pour les dragons)
      float n = tNoise3(vRest * 3.3 + 7.3) * 0.62 + tNoise3(vRest * 7.9 - 2.1) * 0.38;
      float m = smoothstep(0.585, 0.625, n);
      tAlb *= 0.88 + 0.26 * tNoise3(vRest * 5.3 + 1.7);
      tAlb = mix(tAlb, tAlb * 0.13, m);
      if (tPat > 3.5) {
        vec2 q = vPUv;
        q.x += 0.5 * mod(floor(q.y), 2.0);
        vec2 f = fract(q) - vec2(0.5, 0.15);
        float e = smoothstep(0.34, 0.5, length(f * vec2(1.0, 1.25)));
        tAlb *= mix(1.1, 0.66, e);
      }
    } else if (tPat > 6.5 && tPat < 7.5) {
      // plumes : festons en rangs décalés
      vec2 q = vPUv;
      q.x += 0.5 * mod(floor(q.y), 2.0);
      vec2 f = fract(q) - vec2(0.5, 1.0);
      float e = smoothstep(0.55, 0.72, length(f * vec2(1.0, 0.8)));
      tAlb *= mix(1.04, 0.8, e);
    } else if (tPat > 7.5 && tPat < 8.5) {
      // bois : veines le long de v, planches marquées
      float g = tNoise2(vec2(vPUv.x * 4.0, vPUv.y * 34.0)) * 0.55 + tNoise2(vec2(vPUv.x * 11.0, vPUv.y * 90.0)) * 0.45;
      tAlb *= 0.78 + 0.34 * g;
      tAlb *= 1.0 - 0.35 * (1.0 - smoothstep(0.0, 0.05, abs(fract(vPUv.x * 3.0) - 0.5) - 0.44));
    } else if (tPat > 8.5 && tPat < 9.5) {
      // paille, roseaux, brindilles : fibres fines
      float g = tNoise2(vec2(vPUv.x * 70.0, vPUv.y * 5.0)) * 0.7 + tNoise2(vec2(vPUv.x * 160.0, vPUv.y * 9.0)) * 0.3;
      tAlb *= 0.7 + 0.5 * g;
    } else if (tPat > 9.5 && tPat < 10.5) {
      // pierre, terre : grain, taches claires et sombres
      float n = tNoise3(vRest * 2.6) * 0.5 + tNoise3(vRest * 7.0) * 0.3 + tNoise3(vRest * 21.0) * 0.2;
      tAlb *= 0.74 + 0.5 * n;
      tAlb *= 1.0 - 0.45 * step(0.83, tNoise3(vRest * 31.0));
    }
    diffuseColor.rgb = tAlb;
  `;
  const TF_ROUGH = /* glsl */ `
    roughnessFactor = tCls < 0.5 ? 0.86 : (tCls < 1.5 ? 0.55 : (tCls < 2.5 ? 0.3 : (tCls < 3.5 ? 0.34 : (tCls < 6.5 ? 0.4 : (tCls < 7.5 ? 0.12 : (tCls < 8.5 ? 0.18 : 0.24))))));
    if (tPat > 5.5 && tPat < 6.5) roughnessFactor = 0.16;
  `;
  const TF_METAL = /* glsl */ `
    metalnessFactor = (tCls > 2.5 && tCls < 3.5) ? 0.5 : ((tCls > 5.5 && tCls < 6.5) ? 0.35 : 0.0);
  `;
  const TF_EMIS = /* glsl */ `
    {
      vec3 tV = isOrthographic ? vec3(0.0, 0.0, 1.0) : normalize(vViewPosition);
      float tFres = pow(1.0 - clamp(abs(dot(normalize(vNormal), tV)), 0.0, 1.0), 2.5);
      // teintes franches même côté ombre (éclairage de dessin animé) + fin liseré clair
      totalEmissiveRadiance += diffuseColor.rgb * 0.18 + vec3(1.0, 0.97, 0.9) * tFres * 0.09;
      if (tPat > 4.5 && tPat < 5.5) totalEmissiveRadiance += diffuseColor.rgb * 0.34;
      if (tCls > 3.5 && tCls < 4.5) totalEmissiveRadiance += diffuseColor.rgb * 1.5;
      if (tCls > 4.5 && tCls < 5.5) totalEmissiveRadiance += diffuseColor.rgb * (1.0 + 1.1 * (0.5 + 0.5 * sin(uTime * 2.3 + dot(vRest, vec3(2.3, 1.7, 1.9)))));
      if (tCls > 5.5 && tCls < 6.5) totalEmissiveRadiance += vec3(1.0, 0.62, 0.12) * (0.16 + 1.1 * tFres);
      if (tCls > 6.5 && tCls < 7.5) totalEmissiveRadiance += vec3(0.45, 0.8, 1.0) * (0.08 + 0.95 * tFres) + diffuseColor.rgb * 0.22;
      if (tCls > 8.5 && tCls < 9.5) totalEmissiveRadiance += vec3(0.5, 0.28, 1.0) * (0.04 + 1.3 * tFres) + vec3(0.1, 0.35, 1.0) * pow(tFres, 4.0) * 0.8;
      if (tCrack > 0.0) {
        float pulse = 0.75 + 0.25 * sin(uTime * 2.1 + dot(vRest, vec3(1.3, 2.1, 1.7)));
        vec3 emb = tPat < 11.5 ? vec3(1.0, 0.36, 0.04) : vec3(0.18, 0.55, 1.0);
        totalEmissiveRadiance += emb * tCrack * 2.6 * pulse;
      }
    }
  `;
  const TF_OUT = /* glsl */ `
    if (tHull > 0.5) gl_FragColor.rgb = vec3(0.035, 0.028, 0.045);
    #include <tonemapping_fragment>
  `;

  /** Matière commune de toutes les tours (os, couleurs de sommets, motifs, contour). */
  function toonMat() {
    return PTMT.mat("kit:ctToon", () => {
      const m = new THREE.MeshStandardMaterial({ vertexColors: true, skinning: true, roughness: 0.8, metalness: 0 });
      m.onBeforeCompile = (sh) => {
        sh.uniforms.uTime = TOON.time;
        sh.uniforms.uOutline = TOON.outline;
        sh.vertexShader = sh.vertexShader
          .replace("#include <common>", "#include <common>\n" + TV_PARS)
          .replace("#include <begin_vertex>", "#include <begin_vertex>\n" + TV_BEGIN)
          .replace("#include <project_vertex>", "#include <project_vertex>\n" + TV_HULL);
        sh.fragmentShader = sh.fragmentShader
          .replace("#include <common>", "#include <common>\n" + TF_PARS)
          .replace("#include <color_fragment>", TF_COLOR)
          .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\n" + TF_ROUGH)
          .replace("#include <metalnessmap_fragment>", "#include <metalnessmap_fragment>\n" + TF_METAL)
          .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n" + TF_EMIS)
          .replace("#include <tonemapping_fragment>", TF_OUT);
      };
      m.customProgramCacheKey = () => "ptmt-ct-toon-v1";
      return m;
    });
  }
  /** Ombre portée : la coque de contour et les lueurs sont écartées. */
  function toonDepthMat() {
    return PTMT.mat("kit:ctDepth", () => {
      const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, skinning: true });
      m.onBeforeCompile = (sh) => {
        sh.vertexShader = sh.vertexShader
          .replace("#include <common>", "#include <common>\nattribute vec2 aMat;")
          .replace("#include <project_vertex>", "#include <project_vertex>\nif (aMat.x > 29.5) gl_Position = vec4(0.0, 0.0, 2.0, 1.0);");
      };
      m.customProgramCacheKey = () => "ptmt-ct-depth-v1";
      return m;
    });
  }
  /** Lueurs additives (flammes, runes, yeux ardents) : fondu doux sur les bords, léger scintillement. */
  function glowMat() {
    return PTMT.mat("kit:ctGlow", () => {
      const m = new THREE.ShaderMaterial({
        uniforms: { uTime: TOON.time },
        vertexShader: /* glsl */ `
          #include <common>
          #include <skinning_pars_vertex>
          varying vec3 vCol;
          varying float vEdge;
          varying vec3 vRest;
          void main() {
            #include <beginnormal_vertex>
            #include <skinbase_vertex>
            #include <skinnormal_vertex>
            #include <defaultnormal_vertex>
            #include <begin_vertex>
            #include <skinning_vertex>
            #include <project_vertex>
            vec3 n = normalize(transformedNormal);
            vec3 vd = isOrthographic ? vec3(0.0, 0.0, 1.0) : normalize(-mvPosition.xyz);
            vEdge = abs(dot(n, vd));
            vCol = color;
            vRest = position;
          }`,
        fragmentShader: /* glsl */ `
          uniform float uTime;
          varying vec3 vCol;
          varying float vEdge;
          varying vec3 vRest;
          void main() {
            float k = 0.2 + 0.8 * pow(vEdge, 1.4);
            float fl = 0.82 + 0.18 * sin(uTime * 13.0 + vRest.y * 9.0 + vRest.x * 5.0);
            gl_FragColor = vec4(vCol * k * fl, 1.0);
            #include <tonemapping_fragment>
            #include <encodings_fragment>
          }`,
        skinning: true,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      m.name = "ptmt:ct:glow";
      return m;
    });
  }
  K.toonMat = toonMat;
  K.glowMat = glowMat;

  /** Résolution du tampon de dessin pour l'épaisseur du contour (une fois par image). */
  const _res = new THREE.Vector2();
  let _resFrame = -1;
  function toonBeforeRender(renderer) {
    const f = renderer.info.render.frame;
    if (f === _resFrame) return;
    _resFrame = f;
    renderer.getDrawingBufferSize(_res);
    const o = TOON.outline.value;
    o.x = _res.x;
    o.y = _res.y;
    o.z = renderer.getPixelRatio();
  }
  /** Active ou coupe le liseré des tours (réglage de qualité). */
  K.setOutline = (on) => {
    TOON.outline.value.w = on ? 1 : 0;
  };

  /* ---- gabarits articulés ---- */
  class CtRig {
    constructor(key) {
      this.key = key;
      this.bones = [{ name: "root", parent: -1, p: [0, 0, 0], w: [0, 0, 0] }];
      this.bi = { root: 0 };
      this.items = [];
      this.meta = { eyes: [], sway: [] };
    }
    /** Os (position de repos relative à l'os parent ; la racine « root » est à l'origine). */
    bone(name, parent, p) {
      const pi = this.bi[parent || "root"];
      if (pi === undefined) throw new Error("PTMT tours : os parent inconnu " + parent);
      const w = this.bones[pi].w;
      p = p || [0, 0, 0];
      this.bi[name] = this.bones.length;
      this.bones.push({ name, parent: pi, p: p.slice(), w: [w[0] + p[0], w[1] + p[1], w[2] + p[2]] });
      return this;
    }
    /** Position de repos d'un os dans le repère du modèle. */
    at(name) {
      const i = this.bi[name];
      if (i === undefined) throw new Error("PTMT tours : os inconnu " + name);
      return this.bones[i].w;
    }
    has(name) {
      return this.bi[name] !== undefined;
    }
    /**
     * Pièce opaque liée à un os ; o.p est relatif à l'os. Options de K.part (p, r, s, c, g, gp, j, vj, flat,
     * uv…) + pat (motif K.PAT), cls (classe K.CLS), ol (contour : true / false / automatique selon la taille).
     */
    add(geo, bone, o) {
      this.items.push({ geo, bone: bone || "root", o: o || {}, glow: false });
      return this;
    }
    /** Pièce lumineuse additive (second groupe du maillage, sans contour ni ombre). */
    glow(geo, bone, o) {
      this.items.push({ geo, bone: bone || "root", o: o || {}, glow: true });
      return this;
    }
    /** Balancement automatique d'un os (fanion, queue, oreilles…) : rotation[ax] = base + amp·sin(f·t + ph). */
    sway(bone, ax, base, amp, f, ph) {
      this.meta.sway.push({ bone, ax, base: base || 0, amp, f, ph: ph || 0 });
      return this;
    }
  }

  const ctCache = new Map();
  const _hv = new THREE.Vector3();
  /** Gabarit (géométrie fusionnée, os de repos, méta-données) construit une fois par clé. */
  K.ctTemplate = function (key, author) {
    let tpl = ctCache.get(key);
    if (tpl) return tpl;
    const R = new CtRig(key);
    author(R);
    const seed = strSeed(key);
    const opaque = [];
    const glows = [];
    let top = 0;
    let hullTris = 0;
    const byBone = {};
    R.items.forEach((it, idx) => {
      const bi = R.bi[it.bone];
      if (bi === undefined) throw new Error("PTMT tours : os inconnu " + it.bone + " (" + key + ")");
      const w = R.bones[bi].w;
      const g = bakeItem(it.geo, it.o, idx, seed);
      if (w[0] || w[1] || w[2]) g.translate(w[0], w[1], w[2]);
      const e = { g, bi, pat: it.glow ? PAT.glow : it.o.pat || 0, cls: it.o.cls || 0 };
      const tris = g.attributes.position.count / 3;
      const bk = it.bone.split(":")[0];
      byBone[bk] = (byBone[bk] || 0) + tris;
      if (it.glow) {
        glows.push(e);
        return;
      }
      opaque.push(e);
      const pa = g.attributes.position.array;
      let cx = 0,
        cy = 0,
        cz = 0;
      const n = pa.length / 3;
      for (let i = 0; i < n; i++) {
        cx += pa[i * 3];
        cy += pa[i * 3 + 1];
        cz += pa[i * 3 + 2];
        if (!it.o.noTop && pa[i * 3 + 1] > top) top = pa[i * 3 + 1];
      }
      let ol = it.o.ol;
      if (ol === undefined) {
        cx /= n;
        cy /= n;
        cz /= n;
        let rr = 0;
        for (let i = 0; i < n; i++) {
          _hv.set(pa[i * 3] - cx, pa[i * 3 + 1] - cy, pa[i * 3 + 2] - cz);
          rr = Math.max(rr, _hv.lengthSq());
        }
        ol = Math.sqrt(rr) >= 0.1;
      }
      if (ol) {
        const h = hullOf(g);
        hullTris += h.attributes.position.count / 3;
        byBone[bk] += h.attributes.position.count / 3;
        opaque.push({ g: h, bi, pat: PAT.hull, cls: 0 });
      }
    });
    const list = opaque.concat(glows);
    let nv = 0;
    for (const e of list) nv += e.g.attributes.position.count;
    const P = new Float32Array(nv * 3),
      N = new Float32Array(nv * 3),
      U = new Float32Array(nv * 2),
      Cl = new Float32Array(nv * 3),
      M = new Float32Array(nv * 2),
      SI = new Uint16Array(nv * 4),
      SW = new Float32Array(nv * 4);
    let o = 0,
      opaqueCount = 0;
    for (const e of list) {
      const g = e.g,
        c = g.attributes.position.count;
      P.set(g.attributes.position.array, o * 3);
      N.set(g.attributes.normal.array, o * 3);
      U.set(g.attributes.uv.array, o * 2);
      if (g.attributes.color) Cl.set(g.attributes.color.array, o * 3);
      for (let i = 0; i < c; i++) {
        M[(o + i) * 2] = e.pat;
        M[(o + i) * 2 + 1] = e.cls;
        SI[(o + i) * 4] = e.bi;
        SW[(o + i) * 4] = 1;
      }
      o += c;
      if (e.pat !== PAT.glow) opaqueCount = o;
      g.dispose();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(P, 3));
    geo.setAttribute("normal", new THREE.BufferAttribute(N, 3));
    geo.setAttribute("uv", new THREE.BufferAttribute(U, 2));
    geo.setAttribute("color", new THREE.BufferAttribute(Cl, 3));
    geo.setAttribute("aMat", new THREE.BufferAttribute(M, 2));
    geo.setAttribute("skinIndex", new THREE.BufferAttribute(SI, 4));
    geo.setAttribute("skinWeight", new THREE.BufferAttribute(SW, 4));
    const glowCount = nv - opaqueCount;
    if (glowCount > 0) {
      geo.addGroup(0, opaqueCount, 0);
      geo.addGroup(opaqueCount, glowCount, 1);
    }
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    geo.boundingSphere.radius *= 1.35;
    geo.name = "ptmt:ct:" + key;
    const inverses = R.bones.map((b) => new THREE.Matrix4().makeTranslation(-b.w[0], -b.w[1], -b.w[2]));
    tpl = {
      key,
      geo,
      bones: R.bones.map((b) => ({ name: b.name, parent: b.parent, p: b.p })),
      inverses,
      glow: glowCount > 0,
      meta: Object.assign(R.meta, { top: Math.round(top * 100) / 100 }),
      stats: { triangles: nv / 3, hull: hullTris, glow: glowCount / 3, bones: R.bones.length, byBone },
    };
    ctCache.set(key, tpl);
    return tpl;
  };
  /** Coque de contour : copie aux normales lissées (sans fente aux arêtes) et à l'ordre des sommets inversé. */
  function hullOf(g) {
    const pa = g.attributes.position.array;
    const n = pa.length / 3;
    const map = new Map();
    const keys = new Array(n);
    const acc = [];
    const na = g.attributes.normal.array;
    for (let i = 0; i < n; i++) {
      const k = Math.round(pa[i * 3] * 2000) + "," + Math.round(pa[i * 3 + 1] * 2000) + "," + Math.round(pa[i * 3 + 2] * 2000);
      keys[i] = k;
      let a = map.get(k);
      if (a === undefined) {
        a = acc.length;
        map.set(k, a);
        acc.push(0, 0, 0);
      }
      acc[a] += na[i * 3];
      acc[a + 1] += na[i * 3 + 1];
      acc[a + 2] += na[i * 3 + 2];
    }
    const P = new Float32Array(n * 3),
      N = new Float32Array(n * 3);
    for (let t = 0; t < n; t += 3) {
      // ordre inversé : 0, 2, 1
      const src = [t, t + 2, t + 1];
      for (let k = 0; k < 3; k++) {
        const s = src[k],
          d = t + k,
          a = map.get(keys[s]);
        P[d * 3] = pa[s * 3];
        P[d * 3 + 1] = pa[s * 3 + 1];
        P[d * 3 + 2] = pa[s * 3 + 2];
        const l = Math.hypot(acc[a], acc[a + 1], acc[a + 2]) || 1;
        N[d * 3] = acc[a] / l;
        N[d * 3 + 1] = acc[a + 1] / l;
        N[d * 3 + 2] = acc[a + 2] / l;
      }
    }
    const h = new THREE.BufferGeometry();
    h.setAttribute("position", new THREE.BufferAttribute(P, 3));
    h.setAttribute("normal", new THREE.BufferAttribute(N, 3));
    h.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    return h;
  }
  const IDENT = new THREE.Matrix4();
  /** Instance d'un gabarit : os neufs, géométrie et matières partagées. */
  K.ctInstance = function (tpl) {
    const bones = [];
    const bone = {};
    for (const d of tpl.bones) {
      const b = new THREE.Bone();
      b.name = d.name;
      b.position.set(d.p[0], d.p[1], d.p[2]);
      b.userData.rest = b.position.clone();
      if (d.parent >= 0) bones[d.parent].add(b);
      bones.push(b);
      bone[d.name] = b;
    }
    const mesh = new THREE.SkinnedMesh(tpl.geo, tpl.glow ? [toonMat(), glowMat()] : toonMat());
    mesh.name = "ptmt:ct";
    mesh.add(bones[0]);
    mesh.bind(new THREE.Skeleton(bones, tpl.inverses), IDENT);
    mesh.customDepthMaterial = toonDepthMat();
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    mesh.onBeforeRender = toonBeforeRender;
    return { mesh, bones, bone };
  };

  /* ---- yeux de dessin animé (dans un gabarit) ---- */
  /**
   * Paire d'yeux (ou œil unique) sous l'os « bone » : os « <nom>:lids » (paupières, pivotent autour de X),
   * « <nom>:pup » (pupilles, glissent en X/Y) et « <nom>:brow » (sourcils).
   * o = { name, p:[x,y,z] (milieu des yeux, relatif à l'os), gap, r (rayon), skin (paupières), lash,
   *       iris (couleur ou [droite, gauche]), pupil (taille relative de l'iris), dot (pupille noire, relatif),
   *       slant (rad, coin intérieur vers le bas = fâché), rest (paupière au repos : 0 mi-clos, négatif ouvert),
   *       up (rad : le regard se relève vers la caméra, qui voit la scène d'en haut),
   *       brow (couleur | null), browW, browT, browY, browTilt, white, single, glowIris }
   */
  K.ctEyes = function (R, bone, o) {
    const nm = o.name || "eyes";
    const r = o.r,
      gap = o.gap || 0;
    const sides = o.single ? [0] : [-1, 1];
    const c = o.p;
    const up = o.up || 0;
    const cu = Math.cos(up),
      su = Math.sin(up);
    // Point (x, y, z) du repère de l'œil (+Z = regard) tourné de « up » vers le haut.
    const T = (x, y, z) => [x, y * cu + z * su, -y * su + z * cu];
    R.bone(nm + ":lids", bone, c);
    R.bone(nm + ":pup", bone, c);
    R.bone(nm + ":brow", bone, c);
    const iris = Array.isArray(o.iris) ? o.iris : [o.iris || "#3a2414", o.iris || "#3a2414"];
    const slant = o.slant === undefined ? 0.3 : o.slant;
    const pr = r * (o.pupil || 0.62);
    // Découpage selon la taille : un œil de 8 cm ne fait que quelques pixels vu du ciel.
    const hi = r >= 0.14;
    const ws = hi ? 12 : 8,
      hs = hi ? 8 : 6;
    sides.forEach((sx, i) => {
      R.add(G.sphere(r, ws, hs), nm + ":lids", { p: [sx * gap, 0, 0], c: o.white || "#fbfaf2", pat: PAT.eyeW, cls: CLS.glossy, ol: true });
      R.add(G.sphere(pr, hi ? 10 : 8, hi ? 6 : 4), nm + ":pup", { p: T(sx * gap, 0, r * 0.8), r: [-up, 0, 0], s: [1, 1.08, 0.46], c: iris[i], pat: PAT.iris, cls: o.glowIris ? CLS.glow : CLS.glossy, ol: false });
      if (o.dot !== 0) R.add(G.sphere(pr * (o.dot || 0.55), hi ? 8 : 6, 4), nm + ":pup", { p: T(sx * gap, 0, r * 0.87), r: [-up, 0, 0], s: [1, 1.1, 0.4], c: "#0c0a0d", pat: PAT.iris, cls: CLS.glossy, ol: false });
      R.add(G.sphere(pr * 0.3, 4, 3), nm + ":pup", { p: T(sx * gap + pr * 0.34, pr * 0.42, r * 0.97), c: "#ffffff", cls: CLS.glow, ol: false });
      R.add(G.sphere(r * 1.1, hi ? 10 : 8, 2, 0, Math.PI / 2), nm + ":lids", {
        p: [sx * gap, 0, 0],
        r: [0, 0, (sx || 1) * slant],
        g: [o.lash || "#1b1512", o.skin || "#7a6a5a", r * 0.02, r * 0.32],
        ol: false,
      });
      if (o.brow) {
        const bw = o.browW || r * 1.3,
          bt = o.browT || r * 0.28;
        const tilt = o.browTilt === undefined ? slant * 1.1 : o.browTilt;
        R.add(G.capsule(bt, bw, 4, 1), nm + ":brow", { p: T(sx * gap, r * (o.browY || 1.28), r * 0.5), r: [-up, 0, Math.PI / 2 + (sx || 1) * tilt], ro: "XZY", c: o.brow, cls: CLS.satin, ol: false });
      }
    });
    R.meta.eyes.push({ lids: nm + ":lids", pup: nm + ":pup", brow: nm + ":brow", rest: (o.rest === undefined ? -0.35 : o.rest) - up, off: r * 0.26, r, cu, su });
  };
  function eyeCtl(lids, pup, brow, d, rng) {
    const st = { open: 0, openT: 0, blinkT: 0, next: 1 + rng() * 3, sac: 0, lx: 0, ly: 0, fx: null, fy: 0, px: 0, py: 0 };
    const p0 = pup.userData.rest,
      b0 = brow.userData.rest;
    return {
      look(x, y) {
        st.fx = x;
        st.fy = y || 0;
      },
      setOpen(v) {
        st.openT = v;
      },
      blink() {
        st.blinkT = 0.14;
      },
      update(dt) {
        st.next -= dt;
        if (st.next <= 0) {
          st.blinkT = 0.14;
          st.next = 1.8 + rng() * 4.2;
        }
        let bl = 0;
        if (st.blinkT > 0) {
          st.blinkT -= dt;
          bl = bump(1 - st.blinkT / 0.14);
        }
        st.open = damp(st.open, st.openT, 12, dt);
        const op = st.open;
        let ang = d.rest - (op > 0 ? op * 0.9 : op * 0.62);
        ang = lerp(ang, 1.5, bl);
        lids.rotation.x = ang;
        st.sac -= dt;
        if (st.sac <= 0) {
          st.lx = (rng() - 0.5) * 1.5;
          st.ly = (rng() - 0.5) * 0.8;
          st.sac = 0.6 + rng() * 2.2;
        }
        const tx = st.fx === null ? st.lx : st.fx,
          ty = st.fx === null ? st.ly : st.fy;
        st.px = damp(st.px, tx, 16, dt);
        st.py = damp(st.py, ty, 16, dt);
        const oy = clamp(st.py, -1, 1) * d.off;
        pup.position.set(p0.x + clamp(st.px, -1, 1) * d.off, p0.y + oy * d.cu, p0.z - oy * d.su);
        brow.position.set(b0.x, b0.y + op * d.r * 0.22 * d.cu, b0.z - op * d.r * 0.22 * d.su);
      },
    };
  }

  /* ---- fanion (niveau lisible de haut) ---- */
  /**
   * Mât planté + drapeau en deux panneaux qui flottent + étoiles d'or.
   * o = { bone (parent, "root" par défaut), p:[x,y,z] (pied du mât, relatif à l'os), h (hauteur), color,
   *       trim (bordure), stars (0..3), len, tall, name, dir (orientation du drapeau, rad), tail ("swallow"|"point") }
   */
  K.ctPennant = function (R, o) {
    const bone = o.bone || "root";
    const [x, y, z] = o.p;
    const h = o.h || 1.6,
      L = o.len || 0.62,
      T = o.tall || 0.4,
      nm = o.name || "flag";
    R.add(G.cyl(0.032, 0.045, h, 6), bone, { p: [x, y + h / 2, z], c: o.pole || "#6d4a2a", pat: PAT.wood, uv: [0.3, 2], ol: true });
    R.add(G.sphere(0.075, 8, 5), bone, { p: [x, y + h + 0.04, z], c: "#ffcf3a", cls: CLS.gold, ol: true });
    const fy = y + h - T / 2 - 0.05;
    R.bone(nm, bone, [x, fy, z]);
    R.bone(nm + "2", nm, [L * 0.5, 0, 0]);
    const d = 0.03;
    const half = L * 0.5;
    const s1 = [
      [0, -T / 2],
      [half + 0.01, -T / 2],
      [half + 0.01, T / 2],
      [0, T / 2],
    ];
    const s2 =
      o.tail === "point"
        ? [
            [-0.01, -T / 2],
            [half, -0.02],
            [half, 0.02],
            [-0.01, T / 2],
          ]
        : [
            [-0.01, -T / 2],
            [half, -T / 2 - 0.04],
            [half - 0.14, 0],
            [half, T / 2 + 0.04],
            [-0.01, T / 2],
          ];
    const key = "flag:" + L + ":" + T + ":" + (o.tail || "s");
    R.add(G.extrude(key + ":1", s1, d, 0), nm, { c: o.color || "#c8322a", cls: CLS.satin, ol: true });
    R.add(G.extrude(key + ":2", s2, d, 0), nm + "2", { c: o.color || "#c8322a", cls: CLS.satin, ol: true });
    if (o.trim) {
      R.add(G.box(half + 0.02, 0.05, d + 0.012), nm, { p: [half / 2, T / 2 - 0.025, 0], c: o.trim, cls: CLS.satin, ol: false });
      R.add(G.box(half + 0.02, 0.05, d + 0.012), nm, { p: [half / 2, -T / 2 + 0.025, 0], c: o.trim, cls: CLS.satin, ol: false });
    }
    const n = o.stars || 0;
    const sr = Math.min(0.12, T * 0.3);
    for (let i = 0; i < n; i++) {
      // étoiles réparties sur la longueur, sur les deux faces
      const u = n === 1 ? 0.3 : 0.14 + (i / (n - 1)) * 0.46;
      const sx = u * L;
      const onFirst = sx < half - 0.02;
      const b = onFirst ? nm : nm + "2";
      const lx = onFirst ? sx : sx - half;
      const yy = n === 3 && i === 1 ? 0.03 : 0;
      for (const sz of [-1, 1])
        R.add(G.star(5, sr, sr * 0.45, 0.022), b, { p: [lx, yy, sz * (d / 2 + 0.008)], c: "#ffd23a", cls: CLS.gold, ol: false });
    }
    const dir = o.dir || 0;
    R.sway(nm, "y", dir, 0.22, 2.3, 0);
    R.sway(nm + "2", "y", 0, 0.38, 2.3, -1.1);
    R.sway(nm, "z", 0, 0.04, 3.1, 0.4);
  };

  /* ---- coque commune des tours v3 ---- */
  const CT = (K.ct = {});
  /**
   * Enregistre une famille. def = {
   *   variant(niveau, spé, opts) → { key, author(R), pose(st, B, dt), muzzle: [os, [x, y, z]], release (s),
   *     dur (s), ring (rayon de l'anneau de sélection), height, footprint, turn (rad/s), extras(root, inst, st) },
   *   info(niveau, spé) → { height, footprint } (sans construire) }
   */
  K.defCt = (family, def) => {
    CT[family] = def;
  };
  let ctSeed = 1;
  const _wp = new THREE.Vector3();
  const normLevel = (level, spec) => {
    level = clamp(level | 0 || 1, 1, 7);
    return [level, level >= 4 ? (spec === "B" ? "B" : "A") : null];
  };

  function ctShell(family, level, spec, v) {
    const tpl = K.ctTemplate(v.key, v.author);
    const inst = K.ctInstance(tpl);
    const B = inst.bone;
    const root = new THREE.Group();
    root.name = "ptmt-tour-" + v.key;
    root.add(inst.mesh);
    const rng = PTMT.rng(ctSeed++ * 7919 + 31);
    const D = PTMT.sim && PTMT.sim.DATA;
    const data = D && D.towerLevel ? D.towerLevel(family, level, spec) : null;
    const rate = data && data.rate ? data.rate : 1;
    const R0 = v.release || 0.2;
    const D0 = Math.max(R0 + 0.18, Math.min(v.dur || 0.8, 0.95 / rate));
    const muzzle = new THREE.Object3D();
    muzzle.name = "bouche";
    muzzle.position.fromArray(v.muzzle[1]);
    B[v.muzzle[0]].add(muzzle);
    const eyes = tpl.meta.eyes.map((d) => eyeCtl(B[d.lids], B[d.pup], B[d.brow], d, rng));
    const sway = tpl.meta.sway;
    const ringR = v.ring || 1.5;
    const height = v.height || tpl.meta.top;
    let sel = null,
      aura = null;
    const yawRest = B.yaw ? B.yaw.userData.rest : null;
    const st = {
      t: rng() * 20,
      dt: 0,
      time: 0,
      rng,
      yaw: 0,
      yawT: 0,
      turn: 0,
      ae: -1,
      w: 0,
      s: 0,
      a: 0,
      shots: 0,
      fr: 0,
      frOn: false,
      sel: 0,
      selOn: false,
      cj: 9,
      jump: 0,
      squash: 0,
      fid: 0,
      fidK: 0,
      nextFid: 2.5 + rng() * 4,
      sinceAtk: 9,
      eyeOpen: 0,
      look: null,
      lookY: 0,
      level,
      spec,
      release: R0,
      dur: D0,
      phase: rng() * TAU,
    };
    const extra = v.extras ? v.extras(root, inst, st) : null;
    const api = {
      object: root,
      height,
      footprint: v.footprint || 1.5,
      muzzle,
      family,
      level,
      spec,
      bones: B,
      /** yaw monde (0 = vers +Z) : la bête pivote en douceur, le socle reste fixe. */
      aim(yaw) {
        st.yawT = yaw;
      },
      /** Déclenche l'attaque ; renvoie le délai (s) avant le départ du projectile. */
      attack() {
        const F = 1 + 0.8 * st.fr;
        st.ae = 0;
        st.shots++;
        st.sinceAtk = 0;
        st.fid = 0;
        if (v.onAttack) v.onAttack(st, B);
        return R0 / F;
      },
      update(dt, time) {
        if (!(dt > 0)) dt = 0;
        if (dt > 0.1) dt = 0.1;
        TOON.time.value = time;
        K.tick(time);
        st.time = time;
        st.fr = damp(st.fr, st.frOn ? 1 : 0, 6, dt);
        const F = 1 + 0.8 * st.fr;
        const sdt = dt * F;
        st.dt = sdt;
        st.t += sdt;
        // Attaque : élan (w) jusqu'au départ du projectile, puis détente (s) qui retombe.
        if (st.ae >= 0) {
          st.ae += sdt;
          const e = st.ae;
          if (e < R0) {
            st.w = smooth(0, R0, e);
            st.s = 0;
          } else {
            st.w = 1 - smooth(R0, R0 + 0.09, e);
            const k = (e - R0) / (D0 - R0);
            st.s = k < 0.16 ? k / 0.16 : 1 - smooth(0.16, 1, k);
          }
          st.a = Math.min(1, e / D0);
          if (e >= D0) {
            st.ae = -1;
            st.w = st.s = st.a = 0;
          }
        }
        st.sinceAtk += dt;
        // Visée lissée.
        const prev = st.yaw;
        st.yaw = angleTo(st.yaw, st.yawT, (v.turn || 6.5) * (1 + 0.6 * st.fr) * dt);
        st.turn = dt > 0 ? damp(st.turn, (st.yaw - prev) / dt, 10, dt) : st.turn;
        // Célébration : saut, écrasement à l'atterrissage.
        st.jump = 0;
        st.squash = 0;
        if (st.cj < 1.2) {
          st.cj += dt;
          const k = st.cj / 0.55;
          if (k < 1) {
            st.jump = 4 * (v.jumpH || 0.5) * k * (1 - k);
            st.squash = k < 0.12 ? (0.12 - k) * 6 : -Math.sin(k * Math.PI) * 0.25;
          } else {
            const q = (st.cj - 0.55) / 0.5;
            st.squash = q < 1 ? Math.sin(q * Math.PI * 2) * Math.exp(-q * 3) * 0.9 : 0;
          }
        }
        if (B.yaw) {
          B.yaw.rotation.y = st.yaw;
          B.yaw.position.y = yawRest.y + st.jump;
          const q = st.squash;
          B.yaw.scale.set(1 + q * 0.14, 1 - q * 0.2, 1 + q * 0.14);
        }
        // Manies d'inactivité (grogne, s'ébroue, se lèche…).
        if (st.sinceAtk > 2.2 && st.ae < 0) {
          st.nextFid -= dt;
          if (st.nextFid <= 0) {
            st.fid = 1;
            st.fidK = (rng() * 3) | 0;
            st.nextFid = 3.5 + rng() * 6;
          }
        }
        st.fid = Math.max(0, st.fid - dt / (v.fidDur || 1.3));
        // Balancements secondaires.
        for (let i = 0; i < sway.length; i++) {
          const s = sway[i];
          B[s.bone].rotation[s.ax] = s.base + s.amp * Math.sin(st.t * s.f + s.ph + st.phase);
        }
        st.eyeOpen = 0;
        st.look = null;
        st.lookY = 0;
        v.pose(st, B, dt);
        for (let i = 0; i < eyes.length; i++) {
          const e = eyes[i];
          e.setOpen(st.eyeOpen);
          e.look(st.look, st.lookY);
          e.update(sdt);
        }
        // Anneau de sélection et aura de Frénésie (créés à la demande).
        st.sel = damp(st.sel, st.selOn ? 1 : 0, 10, dt);
        if (st.selOn && !sel) {
          sel = K.fx.selRing(ringR);
          root.add(sel);
        }
        if (sel) {
          sel.visible = st.sel > 0.02;
          if (sel.visible) {
            const s = ringR * (0.94 + 0.06 * st.sel + Math.sin(time * 4) * 0.015);
            sel.scale.set(s, 1, s);
            sel.rotation.y = time * 0.35;
          }
        }
        if (st.frOn && !aura) {
          aura = K.fx.aura(ringR * 0.95, Math.max(1.4, height * 0.75));
          root.add(aura.group);
        }
        if (aura) {
          aura.group.visible = st.fr > 0.03;
          if (aura.group.visible) {
            aura.ring.rotation.y = -time * 2.4;
            const s = ringR * 0.95 * (0.7 + 0.3 * st.fr);
            aura.group.scale.set(s, st.fr, s);
          }
        }
        if (extra && extra.update) extra.update(st, dt, time);
      },
      setSelected(b) {
        st.selOn = !!b;
      },
      setFrenzy(b) {
        st.frOn = !!b;
      },
      /** Montée de niveau : saut, écrasement et colonne d'étincelles (si les effets sont prêts). */
      celebrate(o) {
        st.cj = 0;
        if (o && o.fx === false) return;
        const FX = PTMT.fx;
        if (FX && FX._ && FX._.S && FX.burst) {
          root.getWorldPosition(_wp);
          FX.burst("levelUp", _wp, { height });
        }
      },
      /** Statistiques (triangles, os, lueurs) du gabarit. */
      stats() {
        return tpl.stats;
      },
      dispose() {
        if (root.parent) root.parent.remove(root);
        inst.mesh.skeleton.dispose();
        if (extra && extra.dispose) extra.dispose();
      },
    };
    return api;
  }

  /** Tour v3 : famille "boar" | "swan" | "dog", niveau 1..7, spécialisation null (1-3) | "A" | "B" (4-7). */
  PTMT.models.ctTower = function (family, level, spec, opts) {
    const def = CT[family];
    if (!def) throw new Error("PTMT : famille de tour inconnue " + family);
    [level, spec] = normLevel(level, spec);
    return ctShell(family, level, spec, def.variant(level, spec, opts || {}));
  };
  /** Hauteur (m) et rayon d'emprise (m) d'une tour, sans la construire quand la famille les connaît. */
  PTMT.models.ctTowerInfo = function (family, level, spec) {
    const def = CT[family];
    if (!def) return null;
    [level, spec] = normLevel(level, spec);
    const known = def.info && def.info(level, spec);
    if (known) return known;
    const v = def.variant(level, spec, {});
    const tpl = K.ctTemplate(v.key, v.author);
    return { height: v.height || tpl.meta.top, footprint: v.footprint || 1.5 };
  };
})();
