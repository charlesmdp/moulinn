// « Pas touche à mes trésors » — la carte en 3D (PTMT.view, partie « carte »).
//
// Une mission (PTMT.sim.MAPS[n], 20 × 13 cases) devient une scène peinte vue d'avion :
//  - un relief en un seul maillage (≈ 8 × 8 sous-divisions par case) calculé par un noyau de
//    mélange entre cases voisines : routes larges en creux (0 m) bordées de petites falaises nettes,
//    plateaux d'herbe et de roche (+0,45 m), buttes (+1,3 m, ou socle posé au niveau de la route
//    quand le modèle PTMT.models.highGround existe), lit des étangs (−0,9 m) et berges en pente
//    douce, estran (−0,42 m : sable mouillé que la marée recouvre), talus et rochers des cases X ;
//    les bords ondulent (bruit de déformation) pour éviter l'effet « quadrillage » ;
//  - un tablier décoratif de 4 cases autour de la carte (forêt sombre, champs du bocage, chemins
//    et rivières qui sortent de la carte) : l'écran est rempli quel que soit son format ;
//  - une grande texture peinte sur canvas au chargement, ALIGNÉE sur le relief : les régions sont
//    tracées par « marching squares » sur les mêmes champs que les hauteurs (herbe riche, grandes
//    surfaces de terre battue marquées des ornières, sentes et empreintes laissées par les vrais
//    trajets des ennemis, granit aux fissures de braise, sable mouillé de l'estran, sable des
//    berges, cercles de runes) ; une texture d'émission (braises, runes) animée dans le shader ;
//    une petite texture de détail garde du grain sur les grands écrans ;
//  - les ombres du relief (et, en qualité « low », celles du décor fixe) précalculées dans une
//    texture légère, recalculée si le soleil tourne avec l'écran (portrait) ;
//  - l'eau animée (shader : vaguelettes, reflets, écume des berges, courant des rivières) et la
//    marée : sur l'estran, l'eau se retire du côté de la terre vers le large en ≈ 2 s (ligne
//    d'écume qui recule, flaques qui restent) puis revient ;
//  - ponts de bois, forêts à couper, tablier boisé, décor des cases X, menhirs et passage secret :
//    modèles de l'agent Décor (PTMT.models.*) s'ils existent, sinon formes de secours dessinées
//    ici ; cachettes, moulin, entrées, barrières et buttes : render/15-places.js ;
//  - des surimpressions calculées dans les shaders du sol et de l'eau, qui épousent le relief :
//    grille discrète des cases constructibles, mode construction (cases libres, à couper, case
//    visée verte ou rouge), disque de portée à liseré net, réticules des sorts.
//
// Repères : case (i, j), coordonnées continues (x, y) en cases ; monde X = (x − 10) × 3,6,
// Z = (y − 6,5) × 3,6, Y vers le haut.
(function () {
  "use strict";
  const PTMT = (globalThis.PTMT = globalThis.PTMT || {});
  if (typeof THREE === "undefined") return; // rendu seulement
  const VIEW = (PTMT.view = PTMT.view || {});
  const MK = (VIEW._map = VIEW._map || {});

  const TILE = 3.6, MW = 20, MH = 13, APRON = 4;
  const WATER_Y = -0.25, BED_Y = -0.9, DECK_Y = 0.16, TIDE_Y = -0.42, HIGH_Y = 1.3;
  MK.K = { TILE, MW, MH, APRON, WATER_Y, BED_Y, DECK_Y, TIDE_Y, HIGH_Y };

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const smooth01 = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
  const lin = (hex) => (PTMT.color ? PTMT.color(hex) : new THREE.Color(hex).convertSRGBToLinear());
  const toX = (x) => (x - MW / 2) * TILE;
  const toZ = (y) => (y - MH / 2) * TILE;

  /* ------------------------------------------------------------------ bruit */
  function hash2(ix, iy, s) {
    let h = Math.imul(ix | 0, 374761393) ^ Math.imul(iy | 0, 668265263) ^ Math.imul(s | 0, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function vnoise(x, y, s) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const a = hash2(ix, iy, s), b = hash2(ix + 1, iy, s), c = hash2(ix, iy + 1, s), d = hash2(ix + 1, iy + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, y, s) {
    return vnoise(x, y, s) * 0.55 + vnoise(x * 2.03 + 5.2, y * 2.03 + 1.3, s + 1) * 0.3 + vnoise(x * 4.1 + 9.7, y * 4.1 + 3.1, s + 2) * 0.15;
  }
  MK.noise = { hash2, vnoise, fbm };

  /* ------------------------------------------------------------------ classes de sol */
  // Chaque case (carte et tablier) reçoit une classe. Le relief se construit par couches : des
  // poids de classes lissés (noyau de rayon ROUND : arrondi des coins, contour à 0,5 sur la limite
  // des cases) donnent la FORME de chaque région ; un profil propre à la classe donne la RAIDEUR
  // (petite falaise des chemins et des buttes, berge en pente douce de l'eau, talus arrondis).
  const C = { ROAD: 0, GRASS: 1, ROCK: 2, WATER: 3, HIGH: 4, MILL: 5, TALUS: 6, CLIFF: 7, BOULD: 8, FLAT: 9, WILD: 10, FIELD: 11, SECRET: 12, TIDE: 13 };
  const NC = 14;
  const LEVEL = [0, 0.45, 0.45, BED_Y, HIGH_Y, 0.45, 1.8, 2.5, 0.85, 0.45, 0.62, 0.45, 0, TIDE_Y];
  const ROUND = [0.2, 0.16, 0.3, 0.36, 0.22, 0.16, 0.28, 0.22, 0.3, 0.16, 0.3, 0.12, 0.2, 0.26];
  const AMP = [0.015, 0.06, 0.09, 0.12, 0.07, 0.02, 0.22, 0.35, 0.28, 0.05, 0.3, 0.04, 0.02, 0.025];
  MK.C = C;
  MK.LEVEL = LEVEL;
  const DECOR_CLASS = { talus: C.TALUS, cliff: C.CLIFF, boulders: C.BOULD, pond_rocks: C.BOULD };
  function classOfChar(ch) {
    switch (ch) {
      case "#": case "E": case "L": case "g": return C.ROAD;
      case "s": return C.SECRET;
      case "=": case "~": case "w": return C.WATER;
      case "^": case "r": return C.ROCK;
      case "H": case "h": return C.HIGH;
      case "m": return C.TIDE;
      default: return C.GRASS;
    }
  }
  /** Rayon du noyau entre deux classes (symétrique : le contour 0,5 reste sur la limite des cases). */
  function sigma(a, b) {
    if ((a === C.ROAD || a === C.SECRET) && b === C.WATER) return 0.14;
    if ((b === C.ROAD || b === C.SECRET) && a === C.WATER) return 0.14;
    return ROUND[a] > ROUND[b] ? ROUND[a] : ROUND[b];
  }
  const ss = (a, b, x) => smooth01((x - a) / (b - a));
  // cases où l'on marche (estran et barrières compris : chemins qui sortent, ornières, orientation)
  const WALK = "#=ELsgm";
  const ROADLIKE = "#=ELsg";

  /* ------------------------------------------------------------------ champ de la carte */
  function Field(map, opts) {
    const A = APRON, EW = MW + 2 * A, EH = MH + 2 * A;
    this.map = map;
    // décor fourni (PTMT.models.decorBatch) : ses talus et falaises ont leur propre relief, les cases X
    // restent au niveau de l'herbe ; sinon le relief monte ici pour les formes de secours
    this.flatX = !!(opts && opts.flatX);
    // buttes fournies (PTMT.models.highGround) : le socle de granit est un modèle posé au niveau de la
    // route ; le relief reste à plat sous lui (au niveau de la route si elle le touche, sinon du plateau)
    this.flatH = !!(opts && opts.flatH);
    this.A = A;
    this.EW = EW;
    this.EH = EH;
    this.grid = map.grid.map((r) => r.split(""));
    this.cls = new Uint8Array(EW * EH);
    this.kind = new Array(EW * EH).fill(null);
    this.seed = ((map.id || 1) * 7919) | 0;
    const byBiome = (PTMT.sim && PTMT.sim.DECOR_BY_BIOME) || {};
    this.mill = new Set((map.mill || []).map((p) => p[0] + "," + p[1]));
    for (let j = -A; j < MH + A; j++)
      for (let i = -A; i < MW + A; i++) {
        const e = (j + A) * EW + (i + A);
        let c;
        if (i >= 0 && j >= 0 && i < MW && j < MH) {
          const ch = this.grid[j][i];
          if (ch === "X") {
            const key = i + "," + j;
            const kind = this.mill.has(key) ? "mill" : (map.decor && map.decor[key]) || byBiome[map.biome] || "talus";
            this.kind[e] = kind;
            c = kind === "mill" ? C.MILL : DECOR_CLASS[kind] !== undefined ? DECOR_CLASS[kind] : C.FLAT;
          } else if ((ch === "H" || ch === "h") && this.flatH) c = this.roadNear(i, j) ? C.ROAD : C.GRASS;
          else c = classOfChar(ch);
        } else c = this.apronClass(i, j);
        this.cls[e] = c;
      }
  }
  /** Une case de route (ou de pont, d'entrée…) touche-t-elle la case (i, j) par un côté ? */
  Field.prototype.roadNear = function (i, j) {
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const c = this.charAt(i + di, j + dj);
      if (c && ROADLIKE.includes(c)) return true;
    }
    return false;
  };
  Field.prototype.charAt = function (i, j) {
    return i >= 0 && j >= 0 && i < MW && j < MH ? this.grid[j][i] : null;
  };
  Field.prototype.exitDir = function (i, j) {
    const cand = [];
    if (i === 0) cand.push([-1, 0]);
    if (i === MW - 1) cand.push([1, 0]);
    if (j === 0) cand.push([0, -1]);
    if (j === MH - 1) cand.push([0, 1]);
    if (cand.length <= 1) return cand[0] || null;
    for (const d of cand) {
      const c = this.charAt(i - d[0], j - d[1]);
      if (c && WALK.includes(c)) return d;
    }
    return cand[0];
  };
  Field.prototype.apronClass = function (i, j) {
    const ci = clamp(i, 0, MW - 1), cj = clamp(j, 0, MH - 1);
    const ch = this.grid[cj][ci];
    if (ch === "E" || ch === "g") {
      const d = this.exitDir(ci, cj);
      if (d && ((d[0] && j === cj && Math.sign(i - ci) === d[0]) || (d[1] && i === ci && Math.sign(j - cj) === d[1]))) return C.ROAD;
    }
    if (ch === "~" || ch === "w" || ch === "=") return C.WATER;
    const n = fbm(i * 0.31 + 17.3, j * 0.31 + 5.9, this.seed + 3);
    return n > 0.58 ? C.FIELD : C.WILD;
  };
  Field.prototype.clsAt = function (i, j) {
    const A = this.A;
    i = i < -A ? -A : i >= MW + A ? MW + A - 1 : i;
    j = j < -A ? -A : j >= MH + A ? MH + A - 1 : j;
    return this.cls[(j + A) * this.EW + (i + A)];
  };
  Field.prototype.kindAt = function (i, j) {
    const A = this.A;
    if (i < -A || j < -A || i >= MW + A || j >= MH + A) return null;
    return this.kind[(j + A) * this.EW + (i + A)];
  };
  /** Hauteur analytique en (x, y) (cases) ; cw reçoit les poids des classes (somme 1). */
  const WARP = 0.085;
  Field.prototype.evaluate = function (x, y, cw) {
    cw.fill(0);
    const wx = x + WARP * (vnoise(x * 1.35 + 11.3, y * 1.35 + 7.1, 7) * 2 - 1);
    const wy = y + WARP * (vnoise(x * 1.35 + 3.7, y * 1.35 + 19.9, 9) * 2 - 1);
    const i0 = Math.floor(wx), j0 = Math.floor(wy);
    const fx = wx - i0, fy = wy - j0;
    const hc = this.clsAt(i0, j0);
    let ws = 1, hs = LEVEL[hc];
    cw[hc] = 1;
    for (let dj = -1; dj <= 1; dj++) {
      const dy = dj < 0 ? fy : dj > 0 ? 1 - fy : 0;
      for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const dx = di < 0 ? fx : di > 0 ? 1 - fx : 0;
        const nc = this.clsAt(i0 + di, j0 + dj);
        const s = sigma(hc, nc);
        const d2 = dx * dx + dy * dy;
        if (d2 >= s * s) continue;
        const w = 1 - smooth01(Math.sqrt(d2) / s);
        ws += w;
        hs += w * LEVEL[nc];
        cw[nc] += w;
      }
    }
    const inv = 1 / ws;
    let amp = 0;
    for (let c = 0; c < NC; c++)
      if (cw[c]) {
        cw[c] *= inv;
        amp += cw[c] * AMP[c];
      }
    void hs;
    // Couches : plateau de base, routes creusées (petite falaise nette), cour du moulin, estran
    // (sable mouillé en pente douce vers la route, rive rocheuse sous les plateaux), eau (berge
    // douce, plus raide contre un chemin), buttes, blocs, talus et falaises des cases X.
    const road = cw[C.ROAD] + cw[C.SECRET];
    const pRoad = ss(0.42, 0.58, road);
    let h = 0.45 + cw[C.WILD] * 0.17;
    h += (0 - h) * pRoad;
    h += (LEVEL[C.MILL] - h) * ss(0.3, 0.7, cw[C.MILL]);
    h += (TIDE_Y - h) * ss(0.3, 0.7, cw[C.TIDE]);
    const pw = ss(0.08, 0.92, cw[C.WATER]) * (1 - 0.65 * ss(0.3, 0.6, road));
    h += (BED_Y - h) * pw;
    h += (HIGH_Y - h) * ss(0.16, 0.42, cw[C.HIGH]);
    if (!this.flatX) {
      h += (0.85 - h) * ss(0.2, 0.8, cw[C.BOULD]);
      h += (1.8 - h) * ss(0.18, 0.82, cw[C.TALUS]);
      h += (2.5 - h) * ss(0.3, 0.7, cw[C.CLIFF]);
    }
    return h + amp * (fbm(x * 0.9 + 3.1, y * 0.9 + 1.7, 21) * 2 - 1);
  };
  Field.prototype.buildHeights = function (R) {
    this.R = R;
    const nx = this.EW * R + 1, ny = this.EH * R + 1;
    this.nx = nx;
    this.ny = ny;
    const h = (this.h = new Float32Array(nx * ny));
    const cw = new Float32Array(NC);
    const A = this.A;
    for (let gy = 0; gy < ny; gy++) {
      const y = gy / R - A;
      for (let gx = 0; gx < nx; gx++) h[gy * nx + gx] = this.evaluate(gx / R - A, y, cw);
    }
  };
  /** Hauteur du relief (maillage) en (x, y) cases, interpolée. */
  Field.prototype.heightAt = function (x, y) {
    const R = this.R, nx = this.nx, ny = this.ny;
    let gx = (x + this.A) * R, gy = (y + this.A) * R;
    gx = gx < 0 ? 0 : gx > nx - 1.001 ? nx - 1.001 : gx;
    gy = gy < 0 ? 0 : gy > ny - 1.001 ? ny - 1.001 : gy;
    const i = gx | 0, j = gy | 0, fx = gx - i, fy = gy - j;
    const k = j * nx + i, h = this.h;
    const a = h[k], b = h[k + 1], c = h[k + nx], d = h[k + nx + 1];
    // même découpe en triangles que le maillage (diagonale haut-droit → bas-gauche)
    if (fx + fy <= 1) return a + (b - a) * fx + (c - a) * fy;
    return d + (c - d) * (1 - fx) + (b - d) * (1 - fy);
  };
  /** Grille fine (F points par case) : hauteur du maillage et poids des classes utiles à la peinture. */
  Field.prototype.buildFine = function (F) {
    const A = this.A;
    const nx = this.EW * F + 1, ny = this.EH * F + 1, n = nx * ny;
    const f = { F, nx, ny, h: new Float32Array(n) };
    const names = ["road", "secret", "water", "rock", "high", "mill", "talus", "cliff", "bould", "flat", "wild", "field", "grass", "tide"];
    for (const k of names) f[k] = new Float32Array(n);
    const cw = new Float32Array(NC);
    for (let gy = 0; gy < ny; gy++) {
      const y = gy / F - A;
      for (let gx = 0; gx < nx; gx++) {
        const x = gx / F - A, k = gy * nx + gx;
        this.evaluate(x, y, cw);
        f.h[k] = this.heightAt(x, y);
        f.road[k] = cw[C.ROAD] + cw[C.SECRET];
        f.secret[k] = cw[C.SECRET];
        f.water[k] = cw[C.WATER];
        f.rock[k] = cw[C.ROCK];
        f.high[k] = cw[C.HIGH];
        f.mill[k] = cw[C.MILL];
        f.talus[k] = cw[C.TALUS];
        f.cliff[k] = cw[C.CLIFF];
        f.bould[k] = cw[C.BOULD];
        f.flat[k] = cw[C.FLAT];
        f.wild[k] = cw[C.WILD];
        f.field[k] = cw[C.FIELD];
        f.grass[k] = cw[C.GRASS];
        f.tide[k] = cw[C.TIDE];
      }
    }
    if (this.hasTide()) this.tideOrder(f);
    return f;
  };
  Field.prototype.hasTide = function () {
    for (let j = 0; j < MH; j++) if (this.grid[j].includes("m")) return true;
    return false;
  };
  /**
   * Ordre de découvrement de l'estran (grille fine, 0..1) : distance à l'eau permanente, rapportée à
   * 1,6 case. À marée descendante, le sable sort d'abord loin de l'eau (côté terre), puis la ligne
   * d'eau recule vers le large ; à marée montante, l'inverse. Distance de chanfrein en deux passes.
   */
  Field.prototype.tideOrder = function (f) {
    const nx = f.nx, ny = f.ny, n = nx * ny, F = f.F;
    const d = new Float32Array(n);
    for (let k = 0; k < n; k++) d[k] = f.water[k] > 0.5 && f.tide[k] < 0.5 ? 0 : 1e6;
    const a = 1, b = Math.SQRT2;
    for (let y = 0; y < ny; y++)
      for (let x = 0; x < nx; x++) {
        const k = y * nx + x;
        let v = d[k];
        if (x > 0) v = Math.min(v, d[k - 1] + a);
        if (y > 0) {
          v = Math.min(v, d[k - nx] + a);
          if (x > 0) v = Math.min(v, d[k - nx - 1] + b);
          if (x < nx - 1) v = Math.min(v, d[k - nx + 1] + b);
        }
        d[k] = v;
      }
    for (let y = ny - 1; y >= 0; y--)
      for (let x = nx - 1; x >= 0; x--) {
        const k = y * nx + x;
        let v = d[k];
        if (x < nx - 1) v = Math.min(v, d[k + 1] + a);
        if (y < ny - 1) {
          v = Math.min(v, d[k + nx] + a);
          if (x < nx - 1) v = Math.min(v, d[k + nx + 1] + b);
          if (x > 0) v = Math.min(v, d[k + nx - 1] + b);
        }
        d[k] = v;
      }
    const order = (f.tideOrder = new Float32Array(n));
    for (let k = 0; k < n; k++) order[k] = clamp(d[k] / (1.6 * F), 0, 1);
  };
  MK.Field = Field;

  /* ------------------------------------------------------------------ marching squares */
  // Région « champ ≥ iso » : un seul chemin (cases pleines regroupées en bandes + polygones des
  // cases partielles, tous dans le même sens) rempli en une fois : aucune couture entre cellules.
  function regionPath(fld, nx, ny, iso, s) {
    const P = new Path2D();
    for (let j = 0; j < ny - 1; j++) {
      let run = -1;
      const y = j * s;
      for (let i = 0; i < nx - 1; i++) {
        const k = j * nx + i;
        const a = fld[k], b = fld[k + 1], c = fld[k + nx + 1], d = fld[k + nx];
        const code = (a >= iso ? 8 : 0) | (b >= iso ? 4 : 0) | (c >= iso ? 2 : 0) | (d >= iso ? 1 : 0);
        if (code === 15) {
          if (run < 0) run = i;
          continue;
        }
        if (run >= 0) {
          P.rect(run * s, y, (i - run) * s, s);
          run = -1;
        }
        if (code) cellPoly(P, code, a, b, c, d, iso, i * s, y, s);
      }
      if (run >= 0) P.rect(run * s, y, (nx - 1 - run) * s, s);
    }
    return P;
  }
  function cellPoly(P, code, a, b, c, d, iso, x, y, s) {
    if (code === 5 || code === 10) {
      if ((a + b + c + d) * 0.25 < iso) {
        const tab = (iso - a) / (b - a), tbc = (iso - b) / (c - b), tcd = (iso - c) / (d - c), tda = (iso - d) / (a - d);
        if (code === 10) {
          P.moveTo(x, y); P.lineTo(x + tab * s, y); P.lineTo(x, y + s - tda * s); P.closePath();
          P.moveTo(x + s, y + s); P.lineTo(x + s - tcd * s, y + s); P.lineTo(x + s, y + tbc * s); P.closePath();
        } else {
          P.moveTo(x + s, y); P.lineTo(x + s, y + tbc * s); P.lineTo(x + tab * s, y); P.closePath();
          P.moveTo(x, y + s); P.lineTo(x, y + s - tda * s); P.lineTo(x + s - tcd * s, y + s); P.closePath();
        }
        return;
      }
    }
    const ia = a >= iso, ib = b >= iso, ic = c >= iso, id = d >= iso;
    let first = true;
    const pt = (px, py) => {
      if (first) {
        P.moveTo(px, py);
        first = false;
      } else P.lineTo(px, py);
    };
    if (ia) pt(x, y);
    if (ia !== ib) pt(x + ((iso - a) / (b - a)) * s, y);
    if (ib) pt(x + s, y);
    if (ib !== ic) pt(x + s, y + ((iso - b) / (c - b)) * s);
    if (ic) pt(x + s, y + s);
    if (ic !== id) pt(x + s - ((iso - c) / (d - c)) * s, y + s);
    if (id) pt(x, y + s);
    if (id !== ia) pt(x, y + s - ((iso - d) / (a - d)) * s);
    P.closePath();
  }
  /** Segments d'iso-contour [x0, y0, x1, y1, …] en pixels (pour les traits et semis de bord). */
  function contourSegs(fld, nx, ny, iso, s) {
    const out = [];
    for (let j = 0; j < ny - 1; j++)
      for (let i = 0; i < nx - 1; i++) {
        const k = j * nx + i;
        const a = fld[k], b = fld[k + 1], c = fld[k + nx + 1], d = fld[k + nx];
        const code = (a >= iso ? 8 : 0) | (b >= iso ? 4 : 0) | (c >= iso ? 2 : 0) | (d >= iso ? 1 : 0);
        if (code === 0 || code === 15) continue;
        const x = i * s, y = j * s;
        const T = () => [x + ((iso - a) / (b - a)) * s, y];
        const Rr = () => [x + s, y + ((iso - b) / (c - b)) * s];
        const B = () => [x + s - ((iso - c) / (d - c)) * s, y + s];
        const L = () => [x, y + s - ((iso - d) / (a - d)) * s];
        const seg = (p, q) => out.push(p[0], p[1], q[0], q[1]);
        const center = (a + b + c + d) * 0.25 >= iso;
        switch (code) {
          case 1: case 14: seg(L(), B()); break;
          case 2: case 13: seg(B(), Rr()); break;
          case 3: case 12: seg(L(), Rr()); break;
          case 4: case 11: seg(T(), Rr()); break;
          case 6: case 9: seg(T(), B()); break;
          case 7: case 8: seg(L(), T()); break;
          case 5: if (center) { seg(L(), T()); seg(B(), Rr()); } else { seg(T(), Rr()); seg(L(), B()); } break;
          case 10: if (center) { seg(T(), Rr()); seg(L(), B()); } else { seg(L(), T()); seg(B(), Rr()); } break;
        }
      }
    return out;
  }
  function segsPath(segs) {
    const P = new Path2D();
    for (let i = 0; i < segs.length; i += 4) {
      P.moveTo(segs[i], segs[i + 1]);
      P.lineTo(segs[i + 2], segs[i + 3]);
    }
    return P;
  }
  MK.regionPath = regionPath;
  MK.contourSegs = contourSegs;

  /* ------------------------------------------------------------------ trajets types */
  /** Flaque de l'estran en (x, y) cases : le même bruit sert à la peinture et au masque de l'eau. */
  MK.puddleV = (x, y) => vnoise(x * 1.9 + 3.3, y * 1.9 + 8.1, 51) * 0.75 + vnoise(x * 5.3, y * 5.3, 52) * 0.25;
  MK.puddle = (x, y) => MK.puddleV(x, y) > 0.66;
  const RADIUS = 0.2;
  /**
   * Trajets types des ennemis (polylignes en cases) : depuis chaque entrée (barrières comprises),
   * quelques marcheurs virtuels suivent le champ d'écoulement de la simulation (PTMT.sim.Grid) vers
   * chaque cachette en gardant leur voie dans la largeur de la route, exactement comme les vrais
   * (même pente, même voie, même glissement le long des bords). Leurs traces deviennent ornières,
   * sentes et empreintes. Sans simulation chargée : aucun trajet.
   */
  MK.walkLine = function (g, f, x, y, lane, mode, maxLen, out, wobble) {
    const GW = g.w;
    const lane0 = lane;
    const tmp = { x: 0, y: 0 };
    out = out || [];
    out.length = 0;
    out.push(x, y);
    let len = 0, lx = x, ly = y;
    const dt = 0.06;
    for (let s = 0; s < 2400 && len < maxLen; s++) {
      const ti = Math.floor(x), tj = Math.floor(y);
      if (!g.inside(ti, tj)) {
        // départ un peu hors de la carte (montgolfières, bords) : on entre droit
        const p = g.nearestPassable(x, y, mode);
        if (!p) break;
        const dx = p[0] - x, dy = p[1] - y, d = Math.hypot(dx, dy) || 1;
        x += (dx / d) * dt;
        y += (dy / d) * dt;
        continue;
      }
      const idx = tj * GW + ti;
      if (!g.passable(ti, tj, mode) || f.D[idx] >= 1e8) break;
      if (f.D[idx] === 0) break;
      if (wobble) lane = clamp(lane0 + wobble * Math.sin(len * 0.42 + lane0 * 5.1) + wobble * 0.5 * Math.sin(len * 1.13 + 1.7), -1, 1);
      let fx, fy;
      if (g.flowAt(f, x, y, tmp)) {
        fx = tmp.x;
        fy = tmp.y;
      } else break;
      let lat = 0, nx = -fy, ny = fx;
      const tfx = f.F[idx * 2], tfy = f.F[idx * 2 + 1];
      if (tfx || tfy) {
        nx = -tfy;
        ny = tfx;
        const off = (x - ti - 0.5) * nx + (y - tj - 0.5) * ny;
        const Lp = f.Lp[idx], Ln = f.Ln[idx];
        const hw = (Lp + Ln) / 2;
        const target = (Lp - Ln) / 2 + lane * Math.max(0, hw - 0.42);
        lat = clamp((target - off) * 1.6, -0.9, 0.9);
      }
      let vx = fx + nx * lat, vy = fy + ny * lat;
      let l = Math.hypot(vx, vy) || 1;
      if (lat && !g.passable(Math.floor(x + (vx / l) * 0.45), Math.floor(y + (vy / l) * 0.45), mode)) {
        vx = fx;
        vy = fy;
        l = 1;
      }
      let x1 = x + (vx / l) * dt, y1 = y + (vy / l) * dt;
      if (!g.passable(Math.floor(x1), Math.floor(y1), mode)) {
        if (g.passable(Math.floor(x1), Math.floor(y), mode)) y1 = y;
        else if (g.passable(Math.floor(x), Math.floor(y1), mode)) x1 = x;
        else break;
      }
      const i = Math.floor(x1), j = Math.floor(y1);
      if (!g.passable(i - 1, j, mode)) x1 = Math.max(x1, i + RADIUS);
      if (!g.passable(i + 1, j, mode)) x1 = Math.min(x1, i + 1 - RADIUS);
      if (!g.passable(i, j - 1, mode)) y1 = Math.max(y1, j + RADIUS);
      if (!g.passable(i, j + 1, mode)) y1 = Math.min(y1, j + 1 - RADIUS);
      const moved = Math.hypot(x1 - x, y1 - y);
      if (moved < dt * 0.05) break;
      x = x1;
      y = y1;
      len += moved;
      if (Math.hypot(x - lx, y - ly) >= 0.12) {
        out.push(x, y);
        lx = x;
        ly = y;
      }
    }
    if (out[out.length - 2] !== x || out[out.length - 1] !== y) out.push(x, y);
    return out;
  };
  MK.trafficLines = function (map) {
    const S = PTMT.sim;
    if (!S || !S.Grid || !S.DATA || !map || !map.grid) return [];
    let g;
    try {
      // les barrières comptent comme des entrées (la route existe déjà derrière elles)
      g = new S.Grid(Object.assign({}, map, { grid: map.grid.map((r) => r.replace(/g/g, "E")), gates: [] }));
    } catch (e) {
      return [];
    }
    const out = [];
    const rng = PTMT.rng(((map.id || 1) * 131) | 0);
    for (const e of g.entrances) {
      const w = e.tiles.length;
      // ornières de charrette (0) sur une voie au hasard, sente tassée (1) au milieu, empreintes (2)
      const plan = w <= 1 ? [[0, -0.3], [2, 0.35]] : [[0, -0.55 + rng() * 0.3], [1, (rng() - 0.5) * 0.3], [2, 0.5 + rng() * 0.3], [0, 0.4 + rng() * 0.3]];
      for (const L of g.lairs) {
        const f = g.toLair(L.id, "walk");
        // départ : le milieu de l'entrée, au bord de la carte
        const sx = e.x, sy = e.y;
        if (g.at(f, Math.floor(sx), Math.floor(sy)) >= 1e8) continue;
        for (const [kind, lane] of plan) {
          const pts = MK.walkLine(g, f, sx + (rng() - 0.5) * 0.3, sy + (rng() - 0.5) * 0.3, lane, "walk", 90, [], kind === 1 ? 0.15 : 0.25 + rng() * 0.15);
          if (pts.length < 6) continue;
          out.push({ pts, kind });
        }
      }
    }
    return out;
  };

  /* ------------------------------------------------------------------ peinture */
  function makeCanvas(w, h) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  }
  /** Appelle fn(x, y) aux copies nécessaires pour qu'un motif de rayon r se raccorde sans couture. */
  function wrapAt(S, x, y, r, fn) {
    fn(x, y);
    const nx = x < r ? S : x > S - r ? -S : 0, ny = y < r ? S : y > S - r ? -S : 0;
    if (nx) fn(x + nx, y);
    if (ny) fn(x, y + ny);
    if (nx && ny) fn(x + nx, y + ny);
  }
  function softDot(c, x, y, r, color) {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, color.replace(/[\d.]+\)$/, "0)"));
    c.fillStyle = g;
    c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const PAT = {};
  function patGrass(rng) {
    const S = 256, cv = makeCanvas(S, S), c = cv.getContext("2d");
    c.fillStyle = "#64a034";
    c.fillRect(0, 0, S, S);
    for (let i = 0; i < 26; i++) {
      const x = rng() * S, y = rng() * S, r = 18 + rng() * 34;
      const col = rng() < 0.5 ? "rgba(132,188,70,0.25)" : "rgba(64,118,36,0.25)";
      wrapAt(S, x, y, r, (px, py) => softDot(c, px, py, r, col));
    }
    const cols = ["#4f8c2c", "#5c9a32", "#7cb744", "#8ec450", "#437c26", "#69a83a", "#98c858"];
    c.lineCap = "round";
    for (let i = 0; i < 1500; i++) {
      const x = rng() * S, y = rng() * S, l = 2.4 + rng() * 4.2, a = -Math.PI / 2 + (rng() - 0.5) * 1.2;
      c.strokeStyle = cols[(rng() * cols.length) | 0];
      c.lineWidth = 0.9 + rng() * 0.9;
      wrapAt(S, x, y, l + 2, (px, py) => {
        c.beginPath();
        c.moveTo(px, py);
        c.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l);
        c.stroke();
      });
    }
    return cv;
  }
  function patDirt(rng) {
    const S = 256, cv = makeCanvas(S, S), c = cv.getContext("2d");
    c.fillStyle = "#c09058";
    c.fillRect(0, 0, S, S);
    for (let i = 0; i < 30; i++) {
      const x = rng() * S, y = rng() * S, r = 14 + rng() * 30;
      const col = rng() < 0.5 ? "rgba(222,186,128,0.35)" : "rgba(160,116,68,0.25)";
      wrapAt(S, x, y, r, (px, py) => softDot(c, px, py, r, col));
    }
    for (let i = 0; i < 1100; i++) {
      const x = rng() * S, y = rng() * S, r = 0.5 + rng() * 1.3;
      c.fillStyle = rng() < 0.5 ? "rgba(236,206,152,0.8)" : "rgba(128,92,52,0.55)";
      wrapAt(S, x, y, r, (px, py) => {
        c.beginPath();
        c.arc(px, py, r, 0, Math.PI * 2);
        c.fill();
      });
    }
    for (let i = 0; i < 70; i++) {
      const x = rng() * S, y = rng() * S, r = 1.4 + rng() * 2.6, ang = rng() * 3;
      wrapAt(S, x, y, r + 2, (px, py) => {
        c.fillStyle = "rgba(96,66,36,0.45)";
        c.beginPath();
        c.ellipse(px + 0.8, py + 1, r, r * 0.72, ang, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = rng() < 0.5 ? "#e8d4a8" : "#cbb18a";
        c.beginPath();
        c.ellipse(px, py, r, r * 0.72, ang, 0, Math.PI * 2);
        c.fill();
      });
    }
    return cv;
  }
  /** Granit en dalles (cellules de Voronoï répétables) : joints sombres, reflets, grain. */
  function patRock(rng) {
    const S = 256, cv = makeCanvas(S, S), c = cv.getContext("2d");
    const N = 22, pts = [];
    for (let i = 0; i < N; i++) pts.push([rng() * S, rng() * S, 0.82 + rng() * 0.3, rng() * 0.08]);
    const img = c.createImageData(S, S), d = img.data;
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        let d1 = 1e9, d2 = 1e9, best = 0, bx = 0, by = 0;
        for (let i = 0; i < N; i++) {
          let dx = Math.abs(x - pts[i][0]), dy = Math.abs(y - pts[i][1]);
          if (dx > S / 2) dx = S - dx;
          if (dy > S / 2) dy = S - dy;
          const dd = dx * dx + dy * dy;
          if (dd < d1) {
            d2 = d1;
            d1 = dd;
            best = i;
            bx = x - pts[i][0];
            by = y - pts[i][1];
          } else if (dd < d2) d2 = dd;
        }
        const edge = Math.sqrt(d2) - Math.sqrt(d1);
        const p = pts[best];
        // dalle légèrement bombée : plus claire vers le haut-gauche de sa cellule
        if (bx > S / 2) bx -= S;
        if (bx < -S / 2) bx += S;
        if (by > S / 2) by -= S;
        if (by < -S / 2) by += S;
        const shade = 1 - (bx + by) * 0.0022;
        const grain = (hash2(x, y, 77) - 0.5) * 0.16 + (vnoise(x * 0.09, y * 0.09, 78) - 0.5) * 0.12;
        let v = (p[2] + grain) * shade;
        let r = 142 * v, g = 138 * v, b = 132 * v + 4;
        r += p[3] * 90;
        g += p[3] * 40;
        if (edge < 2.2) {
          const k = edge / 2.2;
          r = r * (0.35 + 0.65 * k) - 6;
          g = g * (0.33 + 0.67 * k) - 6;
          b = b * (0.33 + 0.67 * k) - 6;
        } else if (edge < 4.5) {
          r += 16;
          g += 15;
          b += 13;
        }
        const k = (y * S + x) * 4;
        d[k] = clamp(r, 0, 255);
        d[k + 1] = clamp(g, 0, 255);
        d[k + 2] = clamp(b, 0, 255);
        d[k + 3] = 255;
      }
    c.putImageData(img, 0, 0);
    for (let i = 0; i < 500; i++) {
      const x = rng() * S, y = rng() * S, r = 0.5 + rng() * 1.1;
      c.fillStyle = rng() < 0.5 ? "rgba(236,232,222,0.7)" : "rgba(40,36,34,0.6)";
      wrapAt(S, x, y, r, (px, py) => {
        c.beginPath();
        c.arc(px, py, r, 0, Math.PI * 2);
        c.fill();
      });
    }
    return cv;
  }
  function patForestFloor(rng) {
    const S = 256, cv = makeCanvas(S, S), c = cv.getContext("2d");
    c.fillStyle = "#46632a";
    c.fillRect(0, 0, S, S);
    for (let i = 0; i < 30; i++) {
      const x = rng() * S, y = rng() * S, r = 14 + rng() * 30;
      const col = rng() < 0.4 ? "rgba(110,92,48,0.3)" : "rgba(40,62,26,0.35)";
      wrapAt(S, x, y, r, (px, py) => softDot(c, px, py, r, col));
    }
    const cols = ["#3a5522", "#577530", "#6b5a32", "#7a6436", "#4d6a2a"];
    for (let i = 0; i < 900; i++) {
      const x = rng() * S, y = rng() * S, r = 1.2 + rng() * 2.2, ang = rng() * 3.14;
      c.fillStyle = cols[(rng() * cols.length) | 0];
      wrapAt(S, x, y, r + 1, (px, py) => {
        c.beginPath();
        c.ellipse(px, py, r, r * 0.45, ang, 0, Math.PI * 2);
        c.fill();
      });
    }
    return cv;
  }
  function patCobble(rng) {
    const S = 256, cv = makeCanvas(S, S), c = cv.getContext("2d");
    c.fillStyle = "#6f6558";
    c.fillRect(0, 0, S, S);
    const n = 16, step = S / n;
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const x = (i + (j % 2) * 0.5 + (rng() - 0.5) * 0.2) * step, y = (j + 0.5 + (rng() - 0.5) * 0.2) * step;
        const r = step * (0.4 + rng() * 0.08);
        const v = 150 + rng() * 50 | 0;
        wrapAt(S, x, y, r + 2, (px, py) => {
          c.fillStyle = `rgb(${v},${v - 8},${v - 20})`;
          c.beginPath();
          c.ellipse(px, py, r, r * 0.86, rng() * 3, 0, Math.PI * 2);
          c.fill();
          c.fillStyle = "rgba(255,248,230,0.25)";
          c.beginPath();
          c.ellipse(px - r * 0.2, py - r * 0.25, r * 0.5, r * 0.35, 0, 0, Math.PI * 2);
          c.fill();
        });
      }
    return cv;
  }
  function patSand(rng) {
    const S = 256, cv = makeCanvas(S, S), c = cv.getContext("2d");
    c.fillStyle = "#d6c08a";
    c.fillRect(0, 0, S, S);
    for (let i = 0; i < 1400; i++) {
      const x = rng() * S, y = rng() * S, r = 0.4 + rng() * 1.1;
      c.fillStyle = rng() < 0.5 ? "rgba(240,226,186,0.85)" : "rgba(150,128,86,0.5)";
      wrapAt(S, x, y, r, (px, py) => c.fillRect(px - r, py - r, r * 2, r * 2));
    }
    return cv;
  }

  /**
   * Peint la carte : { color, emis } (canvas) et le masque des sols (Uint8Array, grille fine)
   * pour la texture de détail. T : pixels par case.
   */
  MK.paint = function (field, fine, T, opts) {
    const t0 = performance.now();
    const A = field.A, EW = field.EW, EH = field.EH;
    const W = Math.round(EW * T), H = Math.round(EH * T);
    const cv = makeCanvas(W, H), c = cv.getContext("2d");
    const ecv = makeCanvas(Math.round(W / 2), Math.round(H / 2)), e = ecv.getContext("2d");
    e.fillStyle = "#000";
    e.fillRect(0, 0, ecv.width, ecv.height);
    e.scale(0.5, 0.5);
    const rng = PTMT.rng(field.seed + 11);
    const F = fine.F, nx = fine.nx, ny = fine.ny, s = T / F;
    const px = (x) => (x + A) * T; // cases → pixels
    const region = (fld, iso) => regionPath(fld, nx, ny, iso, s);
    const contour = (fld, iso) => contourSegs(fld, nx, ny, iso, s);
    const at = (fld, x, y) => {
      // valeur d'un champ fin en (x, y) cases (plus proche)
      const gx = Math.round((x + A) * F), gy = Math.round((y + A) * F);
      if (gx < 0 || gy < 0 || gx >= nx || gy >= ny) return 0;
      return fld[gy * nx + gx];
    };
    const derive = (fn) => {
      const out = new Float32Array(nx * ny);
      for (let k = 0; k < out.length; k++) out[k] = fn(k);
      return out;
    };
    const pat = (key, make) => {
      const src = PAT[key] || (PAT[key] = make(PTMT.rng(key.length * 977 + 5)));
      const p = c.createPattern(src, "repeat");
      const k = T / 72;
      if (p.setTransform && Math.abs(k - 1) > 0.05) p.setTransform(new DOMMatrix().scale(k, k));
      return p;
    };
    const P_GRASS = pat("grass", patGrass), P_DIRT = pat("dirt", patDirt), P_ROCK = pat("rock", patRock);
    const P_FOREST = pat("forest", patForestFloor), P_COBBLE = pat("cobble", patCobble), P_SAND = pat("sand", patSand);
    const inMap = (x, y) => x >= 0 && y >= 0 && x < MW && y < MH;

    // 1. Herbe de base et grandes nuances.
    c.fillStyle = P_GRASS;
    c.fillRect(0, 0, W, H);
    const nBlobs = Math.round(EW * EH * 1.3);
    for (let i = 0; i < nBlobs; i++) {
      const x = rng() * W, y = rng() * H, r = (0.5 + rng() * 1.6) * T;
      const k = rng();
      softDot(c, x, y, r, k < 0.35 ? "rgba(140,196,70,0.2)" : k < 0.72 ? "rgba(58,110,34,0.24)" : "rgba(170,190,76,0.16)");
    }

    // 2. Tablier : sous-bois sombre, champs du bocage bordés de haies.
    c.fillStyle = P_FOREST;
    c.fill(region(fine.wild, 0.5));
    {
      const fp = region(fine.field, 0.5);
      c.save();
      c.clip(fp);
      const crops = [
        ["#d9c064", "#b99a42"],
        ["#9a7448", "#7c5a36"],
        ["#a9c75f", "#8dac4c"],
        ["#e1cf5c", "#c8b040"],
      ];
      for (let j = -A; j < MH + A; j += 2)
        for (let i = -A; i < MW + A; i += 2) {
          const n = hash2(i, j, field.seed + 5);
          const [c0, c1] = crops[(n * crops.length) | 0];
          const x0 = px(i), y0 = px(j), sz = 2 * T;
          c.fillStyle = c0;
          c.fillRect(x0, y0, sz, sz);
          c.strokeStyle = c1;
          c.lineWidth = Math.max(1, T * 0.035);
          const vert = hash2(i, j, field.seed + 9) < 0.5;
          for (let q = 0.12; q < 2; q += 0.13) {
            c.beginPath();
            if (vert) {
              c.moveTo(x0 + q * T, y0);
              c.lineTo(x0 + q * T, y0 + sz);
            } else {
              c.moveTo(x0, y0 + q * T);
              c.lineTo(x0 + sz, y0 + q * T);
            }
            c.stroke();
          }
        }
      c.restore();
      // haies du bocage autour des champs
      const hedge = contour(fine.field, 0.5);
      c.lineCap = "round";
      c.strokeStyle = "rgba(40,66,26,0.9)";
      c.lineWidth = T * 0.16;
      c.stroke(segsPath(hedge));
      c.fillStyle = "#3f6a2a";
      for (let i = 0; i < hedge.length; i += 4) {
        if (rng() < 0.55) continue;
        const x = hedge[i], y = hedge[i + 1];
        c.beginPath();
        c.arc(x, y, T * (0.07 + rng() * 0.06), 0, Math.PI * 2);
        c.fill();
      }
    }

    // 3. Cases X : talus bocagers, blocs, falaises, cours des maisons, cour du moulin.
    {
      const tal = derive((k) => fine.talus[k] + fine.cliff[k]);
      c.fillStyle = "#5e8a36";
      c.fill(region(tal, 0.3));
      c.save();
      c.clip(region(tal, 0.3));
      for (let i = 0; i < 260; i++) {
        const x = rng() * W, y = rng() * H;
        if (at(tal, x / T - A, y / T - A) < 0.3) continue;
        softDot(c, x, y, T * (0.12 + rng() * 0.2), rng() < 0.6 ? "rgba(128,96,58,0.55)" : "rgba(64,96,40,0.5)");
      }
      c.restore();
      c.fillStyle = P_ROCK;
      c.fill(region(fine.cliff, 0.35));
      c.fillStyle = "rgba(120,112,98,0.85)";
      c.fill(region(fine.bould, 0.45));
      c.save();
      c.globalAlpha = 0.55;
      c.fillStyle = P_ROCK;
      c.fill(region(fine.bould, 0.45));
      c.restore();
      c.fillStyle = P_COBBLE;
      c.fill(region(fine.flat, 0.5));
      c.fillStyle = "rgba(90,70,48,0.25)";
      c.fill(region(fine.flat, 0.5));
      c.fillStyle = P_COBBLE;
      c.fill(region(fine.mill, 0.4));
      c.strokeStyle = "rgba(60,48,34,0.55)";
      c.lineWidth = Math.max(1.5, T * 0.03);
      c.stroke(segsPath(contour(fine.flat, 0.5)));
      c.stroke(segsPath(contour(fine.mill, 0.4)));
    }

    // 4. Buttes : falaise de granit (plus sombre vers le pied), dessus d'herbe claire, lèvre
    //    ensoleillée et touffes qui débordent.
    {
      c.fillStyle = "#5e554b";
      c.fill(region(fine.high, 0.14));
      c.save();
      c.globalAlpha = 0.75;
      c.fillStyle = P_ROCK;
      c.fill(region(fine.high, 0.2));
      c.globalAlpha = 1;
      c.restore();
      c.fillStyle = "rgba(255,244,220,0.12)";
      c.fill(region(fine.high, 0.3));
      // fissures verticales de la falaise (le long de la pente)
      c.save();
      c.clip(region(fine.high, 0.16));
      c.strokeStyle = "rgba(40,34,28,0.55)";
      c.lineWidth = Math.max(1, T * 0.014);
      for (let i = 0; i < EW * EH * 6; i++) {
        const gx = rng() * EW - A, gy = rng() * EH - A, v = at(fine.high, gx, gy);
        if (v < 0.17 || v > 0.4) continue;
        const dx = at(fine.high, gx + 0.04, gy) - at(fine.high, gx - 0.04, gy), dy = at(fine.high, gx, gy + 0.04) - at(fine.high, gx, gy - 0.04);
        const l = Math.hypot(dx, dy) || 1;
        c.beginPath();
        c.moveTo(px(gx), px(gy));
        c.lineTo(px(gx) + (dx / l) * T * 0.07, px(gy) + (dy / l) * T * 0.07);
        c.stroke();
      }
      c.restore();
      const top = region(fine.high, 0.42);
      c.fillStyle = P_GRASS;
      c.fill(top);
      c.fillStyle = "rgba(170,214,96,0.3)";
      c.fill(top);
      c.strokeStyle = "rgba(236,240,190,0.8)";
      c.lineWidth = Math.max(1.2, T * 0.03);
      c.stroke(segsPath(contour(fine.high, 0.41)));
      const lipH = contour(fine.high, 0.41);
      c.lineCap = "round";
      for (let i = 0; i < lipH.length; i += 4) {
        if (rng() < 0.4) continue;
        const x = lipH[i], y = lipH[i + 1];
        const gx = x / T - A, gy = y / T - A;
        const dx = at(fine.high, gx - 0.05, gy) - at(fine.high, gx + 0.05, gy), dy = at(fine.high, gx, gy - 0.05) - at(fine.high, gx, gy + 0.05);
        const l = Math.hypot(dx, dy) || 1;
        c.strokeStyle = rng() < 0.5 ? "#6aa83b" : "#86bd4a";
        c.lineWidth = Math.max(1, T * 0.016);
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x + (dx / l) * T * (0.04 + rng() * 0.05), y + (dy / l) * T * (0.04 + rng() * 0.05));
        c.stroke();
      }
    }

    // 5. Roche : granit en dalles, joints, fissures de braise (émission).
    {
      const rp = region(fine.rock, 0.5);
      c.fillStyle = P_ROCK;
      c.fill(rp);
      c.save();
      c.clip(rp);
      for (let i = 0; i < 400; i++) {
        const x = rng() * W, y = rng() * H;
        if (at(fine.rock, x / T - A, y / T - A) < 0.5) continue;
        softDot(c, x, y, T * (0.1 + rng() * 0.25), rng() < 0.5 ? "rgba(214,206,192,0.3)" : "rgba(60,54,50,0.28)");
      }
      // bord ombré (la roche bombe un peu) et reflet intérieur
      c.strokeStyle = "rgba(34,28,24,0.4)";
      c.lineWidth = T * 0.1;
      c.stroke(segsPath(contour(fine.rock, 0.5)));
      c.strokeStyle = "rgba(255,250,236,0.18)";
      c.lineWidth = T * 0.03;
      c.stroke(segsPath(contour(fine.rock, 0.62)));
      c.restore();
      c.strokeStyle = "rgba(46,36,30,0.75)";
      c.lineWidth = Math.max(1, T * 0.016);
      c.stroke(segsPath(contour(fine.rock, 0.5)));
      // fissures
      for (let j = 0; j < MH; j++)
        for (let i = 0; i < MW; i++) {
          const ch = field.grid[j][i];
          if (ch !== "^" && ch !== "r") continue;
          const n = 2 + ((hash2(i, j, field.seed) * 3) | 0);
          for (let q = 0; q < n; q++) {
            let x = i + 0.15 + rng() * 0.7, y = j + 0.15 + rng() * 0.7, a = rng() * Math.PI * 2;
            const pts = [[x, y]];
            const segs = 4 + ((rng() * 5) | 0);
            for (let k = 0; k < segs; k++) {
              a += (rng() - 0.5) * 1.6;
              const l = 0.05 + rng() * 0.07;
              x += Math.cos(a) * l;
              y += Math.sin(a) * l;
              if (at(fine.rock, x, y) < 0.6) break;
              pts.push([x, y]);
            }
            if (pts.length < 2) continue;
            const path = new Path2D();
            pts.forEach((p, k) => (k ? path.lineTo(px(p[0]), px(p[1])) : path.moveTo(px(p[0]), px(p[1]))));
            c.lineCap = c.lineJoin = "round";
            c.strokeStyle = "rgba(60,26,12,0.3)";
            c.lineWidth = Math.max(2.5, T * 0.06);
            c.stroke(path);
            c.strokeStyle = "#1e1210";
            c.lineWidth = Math.max(1.4, T * 0.026);
            c.stroke(path);
            c.strokeStyle = "#d8480e";
            c.lineWidth = Math.max(0.7, T * 0.009);
            c.stroke(path);
            e.lineCap = e.lineJoin = "round";
            e.strokeStyle = "rgba(180,40,4,0.3)";
            e.lineWidth = T * 0.055;
            e.stroke(path);
            e.strokeStyle = "rgba(255,96,16,0.95)";
            e.lineWidth = Math.max(0.8, T * 0.012);
            e.stroke(path);
          }
          // cailloux clairs
          for (let q = 0; q < 5; q++) {
            const x = px(i + 0.1 + rng() * 0.8), y = px(j + 0.1 + rng() * 0.8), r = T * (0.02 + rng() * 0.035);
            c.fillStyle = "rgba(40,34,30,0.5)";
            c.beginPath();
            c.ellipse(x + r * 0.3, y + r * 0.35, r, r * 0.75, 0, 0, Math.PI * 2);
            c.fill();
            c.fillStyle = rng() < 0.5 ? "#b9b3a8" : "#9d978d";
            c.beginPath();
            c.ellipse(x, y, r, r * 0.75, 0, 0, Math.PI * 2);
            c.fill();
          }
        }
    }

    // 6. Eau : berges de sable et de mousse, lit qui s'assombrit avec la profondeur.
    {
      const bank = derive((k) => (fine.water[k] > 0.015 && fine.h[k] < 0.3 ? 1 : 0));
      const bp = region(bank, 0.5);
      c.fillStyle = P_SAND;
      c.fill(bp);
      c.save();
      c.clip(bp);
      c.strokeStyle = "rgba(110,140,60,0.55)";
      c.lineWidth = T * 0.07;
      c.stroke(segsPath(contour(bank, 0.5)));
      c.restore();
      const deep = (lvl) => derive((k) => lvl - fine.h[k]);
      c.fillStyle = "#b09a68";
      c.fill(region(deep(WATER_Y + 0.07), 0));
      c.fillStyle = "#7e9468";
      c.fill(region(deep(WATER_Y - 0.08), 0));
      c.fillStyle = "#5b7a60";
      c.fill(region(deep(WATER_Y - 0.25), 0));
      c.fillStyle = "#40625a";
      c.fill(region(deep(WATER_Y - 0.45), 0));
      // ligne mouillée au bord de l'eau
      c.strokeStyle = "rgba(90,70,40,0.45)";
      c.lineWidth = Math.max(1, T * 0.03);
      c.stroke(segsPath(contour(deep(WATER_Y + 0.02), 0)));
      // galets et touffes de joncs sur les berges
      const shore = contour(bank, 0.5);
      for (let i = 0; i < shore.length; i += 4) {
        if (rng() < 0.7) continue;
        const x = shore[i], y = shore[i + 1];
        if (rng() < 0.5) {
          const r = T * (0.02 + rng() * 0.03);
          c.fillStyle = "#9c948a";
          c.beginPath();
          c.ellipse(x, y, r, r * 0.7, 0, 0, Math.PI * 2);
          c.fill();
        } else {
          c.strokeStyle = rng() < 0.5 ? "#4f7a2a" : "#6f9a3a";
          c.lineWidth = Math.max(1, T * 0.014);
          for (let q = 0; q < 4; q++) {
            c.beginPath();
            c.moveTo(x, y);
            c.lineTo(x + (rng() - 0.5) * T * 0.08, y - T * (0.05 + rng() * 0.06));
            c.stroke();
          }
        }
      }
    }

    // 7. Estran (cases de marée) : sable mouillé, rides parallèles à la ligne d'eau, goémon,
    //    coquillages, laisse de mer sur le haut de plage et flaques qui restent à marée basse.
    if (fine.tideOrder) {
      const ord = fine.tideOrder;
      const sand = region(fine.tide, 0.3);
      c.fillStyle = "#b29c70";
      c.fill(sand);
      c.save();
      c.clip(sand);
      c.globalAlpha = 0.45;
      c.fillStyle = P_SAND;
      c.fillRect(0, 0, W, H);
      c.globalAlpha = 1;
      // sable plus sombre et plus mouillé vers le large
      for (let i = 0; i < EW * EH * 2; i++) {
        const gx = rng() * EW - A, gy = rng() * EH - A;
        if (at(fine.tide, gx, gy) < 0.2) continue;
        const o = at(ord, gx, gy);
        softDot(c, px(gx), px(gy), T * (0.25 + rng() * 0.45), o < 0.45 ? "rgba(70,66,52,0.22)" : "rgba(214,196,150,0.18)");
      }
      // rides : traits ondulés perpendiculaires à la pente de l'ordre de découvrement
      c.lineCap = "round";
      const step = 0.16;
      for (let gy = -1; gy < MH + 1; gy += step)
        for (let gx = -1; gx < MW + 1; gx += step) {
          const x = gx + (rng() - 0.5) * step, y = gy + (rng() - 0.5) * step;
          if (at(fine.tide, x, y) < 0.45) continue;
          const dx = at(ord, x + 0.1, y) - at(ord, x - 0.1, y), dy = at(ord, x, y + 0.1) - at(ord, x, y - 0.1);
          const l = Math.hypot(dx, dy);
          const ux = l > 1e-4 ? -dy / l : 1, uy = l > 1e-4 ? dx / l : 0;
          const len = T * (0.1 + rng() * 0.12);
          const X = px(x), Y = px(y);
          c.strokeStyle = rng() < 0.5 ? "rgba(84,72,50,0.32)" : "rgba(236,222,186,0.35)";
          c.lineWidth = Math.max(1, T * 0.014);
          c.beginPath();
          c.moveTo(X - ux * len, Y - uy * len);
          c.quadraticCurveTo(X + (uy * T * 0.02), Y - (ux * T * 0.02), X + ux * len, Y + uy * len);
          c.stroke();
        }
      // flaques (même bruit que le masque de l'eau : elles restent pleines à marée basse)
      const pud = derive((k) => (fine.tide[k] > 0.55 ? MK.puddleV((k % nx) / F - A, Math.floor(k / nx) / F - A) : 0));
      c.fillStyle = "rgba(52,70,70,0.5)";
      c.fill(region(pud, 0.66));
      c.strokeStyle = "rgba(240,232,206,0.45)";
      c.lineWidth = Math.max(1, T * 0.012);
      c.stroke(segsPath(contour(pud, 0.665)));
      // goémon (lanières sombres) et coquillages
      for (let i = 0; i < EW * EH * 3; i++) {
        const gx = rng() * EW - A, gy = rng() * EH - A;
        if (at(fine.tide, gx, gy) < 0.5) continue;
        const X = px(gx), Y = px(gy);
        if (rng() < 0.55) {
          c.strokeStyle = rng() < 0.5 ? "rgba(70,62,24,0.75)" : "rgba(92,84,30,0.7)";
          c.lineWidth = Math.max(1, T * (0.012 + rng() * 0.01));
          let a = rng() * 6.28, x = X, y = Y;
          c.beginPath();
          c.moveTo(x, y);
          for (let q = 0; q < 4; q++) {
            a += (rng() - 0.5) * 1.2;
            x += Math.cos(a) * T * 0.04;
            y += Math.sin(a) * T * 0.04;
            c.lineTo(x, y);
          }
          c.stroke();
        } else {
          c.fillStyle = rng() < 0.6 ? "rgba(255,248,236,0.9)" : "rgba(255,196,180,0.85)";
          c.beginPath();
          c.ellipse(X, Y, T * 0.012, T * 0.009, rng() * 3, 0, Math.PI * 2);
          c.fill();
        }
      }
      c.restore();
      // laisse de mer : liseré de goémon sec le long du haut de plage
      const wrack = contour(derive((k) => fine.tide[k] * (ord[k] > 0.55 ? 1 : 0)), 0.3);
      c.lineCap = "round";
      for (let i = 0; i < wrack.length; i += 4) {
        if (rng() < 0.3) continue;
        c.strokeStyle = rng() < 0.5 ? "rgba(60,50,24,0.7)" : "rgba(96,84,40,0.6)";
        c.lineWidth = Math.max(1.2, T * 0.02);
        c.beginPath();
        c.moveTo(wrack[i], wrack[i + 1]);
        c.lineTo(wrack[i + 2] + (rng() - 0.5) * T * 0.05, wrack[i + 3] + (rng() - 0.5) * T * 0.05);
        c.stroke();
      }
    }

    // 8. Routes larges : faces des petites falaises (nettes, pierreuses), grande surface de terre
    //    battue aux tons variés, ombre au pied des falaises, traces des vrais trajets des ennemis
    //    (ornières de charrettes, sentes tassées, empreintes), cailloux, herbe sur les parties peu
    //    fréquentées, herbe qui déborde du plateau.
    {
      const others = (k) => clamp(fine.high[k] + fine.talus[k] + fine.cliff[k] + fine.water[k] * 2 + fine.tide[k] * 2, 0, 1);
      const face = derive((k) => fine.road[k] * (1 - others(k)));
      const facePath = region(face, 0.3);
      c.fillStyle = "#6e4c30";
      c.fill(facePath);
      c.save();
      c.clip(facePath);
      // pierres de la paroi (grosses, sombres en bas, claires en haut)
      for (let i = 0; i < EW * EH * 14; i++) {
        const gx = rng() * EW - A, gy = rng() * EH - A;
        const v = at(face, gx, gy);
        if (v < 0.3 || v > 0.62) continue;
        const k = (v - 0.3) / 0.32;
        const x = px(gx), y = px(gy), r = T * (0.018 + rng() * 0.026);
        c.fillStyle = k < 0.5 ? (rng() < 0.6 ? "rgba(150,132,108,0.85)" : "rgba(118,98,76,0.85)") : rng() < 0.5 ? "rgba(96,74,52,0.8)" : "rgba(64,44,28,0.75)";
        c.beginPath();
        c.ellipse(x, y, r, r * 0.72, rng() * 3, 0, Math.PI * 2);
        c.fill();
      }
      c.restore();
      const floor = region(fine.road, 0.6);
      c.fillStyle = P_DIRT;
      c.fill(floor);
      c.save();
      c.clip(floor);
      // grandes nuances de la terre battue : plaques tassées claires, zones humides plus sombres
      for (let i = 0; i < EW * EH * 0.9; i++) {
        const gx = rng() * EW - A, gy = rng() * EH - A;
        if (at(fine.road, gx, gy) < 0.5) continue;
        const r = T * (0.5 + rng() * 1.1), q = rng();
        softDot(c, px(gx), px(gy), r, q < 0.45 ? "rgba(236,204,150,0.2)" : q < 0.8 ? "rgba(132,92,52,0.16)" : "rgba(150,120,70,0.14)");
      }
      // passage secret : sentier envahi
      c.save();
      c.clip(region(fine.secret, 0.5));
      c.fillStyle = P_GRASS;
      c.globalAlpha = 0.55;
      c.fillRect(0, 0, W, H);
      c.globalAlpha = 1;
      c.restore();
      // ombre au pied des falaises (franche contre la paroi, puis fondue)
      c.strokeStyle = "rgba(60,34,14,0.42)";
      c.lineWidth = T * 0.16;
      c.stroke(segsPath(contour(face, 0.62)));
      c.strokeStyle = "rgba(52,28,10,0.38)";
      c.lineWidth = T * 0.06;
      c.stroke(segsPath(contour(face, 0.62)));
      // traces des trajets : sentes, ornières, empreintes (les couloirs les plus suivis s'usent)
      const tracks = opts.tracks || [];
      const busy = new Uint8Array(nx * ny);
      const mark = (x, y, r) => {
        const gx0 = Math.round((x + A) * F), gy0 = Math.round((y + A) * F), rr = Math.ceil(r * F);
        for (let yy = gy0 - rr; yy <= gy0 + rr; yy++)
          for (let xx = gx0 - rr; xx <= gx0 + rr; xx++) if (xx >= 0 && yy >= 0 && xx < nx && yy < ny) busy[yy * nx + xx] = 1;
      };
      const linePath = (pts, off) => {
        const P2 = new Path2D();
        for (let k = 0; k < pts.length; k += 2) {
          const k0 = Math.max(0, k - 2), k1 = Math.min(pts.length - 2, k + 2);
          let tx = pts[k1] - pts[k0], ty = pts[k1 + 1] - pts[k0 + 1];
          const l = Math.hypot(tx, ty) || 1;
          tx /= l;
          ty /= l;
          const X = px(pts[k] - ty * off), Y = px(pts[k + 1] + tx * off);
          if (k) P2.lineTo(X, Y);
          else P2.moveTo(X, Y);
        }
        return P2;
      };
      c.lineCap = c.lineJoin = "round";
      // usure générale des couloirs (bande large, à peine plus sombre)
      for (const t of tracks) {
        c.strokeStyle = "rgba(120,82,44,0.05)";
        c.lineWidth = T * 0.7;
        c.stroke(linePath(t.pts, 0));
      }
      tracks.forEach((t, n) => {
        const pts = t.pts;
        for (let k = 0; k < pts.length; k += 6) mark(pts[k], pts[k + 1], 0.32);
        const kind = t.kind;
        if (kind === 0) {
          // ornières : deux sillons sombres et doux (essieu d'une charrette, ≈ 1 m), interrompus par
          // endroits (sol plus dur, flaques séchées)
          const r3 = PTMT.rng(field.seed + 57 * n);
          for (const s of [-1, 1]) {
            c.setLineDash([T * (0.9 + r3() * 1.4), T * (0.12 + r3() * 0.3), T * (0.4 + r3() * 0.8), T * (0.2 + r3() * 0.4)]);
            c.lineDashOffset = r3() * T * 3;
            c.strokeStyle = "rgba(96,62,30,0.12)";
            c.lineWidth = T * 0.075;
            c.stroke(linePath(pts, s * 0.14));
            c.strokeStyle = "rgba(78,48,22,0.22)";
            c.lineWidth = T * 0.024;
            c.stroke(linePath(pts, s * 0.14));
          }
          c.setLineDash([]);
        } else if (kind === 1) {
          // sente tassée : bande claire et lisse
          c.strokeStyle = "rgba(244,218,170,0.16)";
          c.lineWidth = T * 0.36;
          c.stroke(linePath(pts, 0));
        } else {
          // empreintes (pas, sabots), alternées de part et d'autre de la trace
          const r2 = PTMT.rng(field.seed + 31 * n);
          let acc = 0, side = 1;
          for (let k = 2; k < pts.length; k += 2) {
            const dx = pts[k] - pts[k - 2], dy = pts[k + 1] - pts[k - 1];
            acc += Math.hypot(dx, dy);
            if (acc < 0.16) continue;
            acc = 0;
            side = -side;
            const l = Math.hypot(dx, dy) || 1;
            const X = px(pts[k] - (dy / l) * 0.05 * side), Y = px(pts[k + 1] + (dx / l) * 0.05 * side);
            c.fillStyle = "rgba(86,56,28,0.34)";
            c.beginPath();
            c.ellipse(X, Y, T * 0.026, T * 0.016, Math.atan2(dy, dx), 0, Math.PI * 2);
            c.fill();
            if (r2() < 0.3) {
              c.fillStyle = "rgba(240,220,180,0.3)";
              c.beginPath();
              c.ellipse(X + T * 0.01, Y - T * 0.01, T * 0.014, T * 0.008, Math.atan2(dy, dx), 0, Math.PI * 2);
              c.fill();
            }
          }
        }
      });
      // cailloux (moins nombreux sur les couloirs les plus suivis)
      for (let i = 0; i < EW * EH * 4; i++) {
        const gx = rng() * EW - A, gy = rng() * EH - A;
        if (at(fine.road, gx, gy) < 0.75) continue;
        const gk = Math.round((gy + A) * F) * nx + Math.round((gx + A) * F);
        if (busy[gk] && rng() < 0.7) continue;
        const x = px(gx), y = px(gy), rr = T * (0.015 + rng() * 0.03);
        c.fillStyle = "rgba(90,60,30,0.45)";
        c.beginPath();
        c.ellipse(x + rr * 0.3, y + rr * 0.4, rr, rr * 0.7, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = rng() < 0.5 ? "#ead7ad" : "#b69b74";
        c.beginPath();
        c.ellipse(x, y, rr, rr * 0.7, 0, 0, Math.PI * 2);
        c.fill();
      }
      // herbe qui repousse là où l'on passe peu (touffes, petites fleurs)
      if (tracks.length)
        for (let i = 0; i < EW * EH * 5; i++) {
          const gx = rng() * EW - A, gy = rng() * EH - A;
          if (at(fine.road, gx, gy) < 0.8) continue;
          const gk = Math.round((gy + A) * F) * nx + Math.round((gx + A) * F);
          if (busy[gk] || !inMap(gx, gy)) continue;
          const x = px(gx), y = px(gy);
          c.strokeStyle = rng() < 0.5 ? "rgba(92,140,48,0.8)" : "rgba(120,160,60,0.75)";
          c.lineWidth = Math.max(1, T * 0.012);
          for (let q = 0; q < 4; q++) {
            c.beginPath();
            c.moveTo(x, y);
            c.lineTo(x + (q - 1.5) * T * 0.016 + (rng() - 0.5) * T * 0.01, y - T * (0.035 + rng() * 0.035));
            c.stroke();
          }
          if (rng() < 0.15) {
            c.fillStyle = rng() < 0.5 ? "#fff6d8" : "#ffe14a";
            c.beginPath();
            c.arc(x + T * 0.01, y - T * 0.05, T * 0.012, 0, Math.PI * 2);
            c.fill();
          }
        }
      // pied des cachettes : terre piétinée tout autour
      for (const L of opts.lairs || []) {
        const g = c.createRadialGradient(px(L.x), px(L.y), T * 0.5, px(L.x), px(L.y), T * 1.45);
        g.addColorStop(0, "rgba(96,64,36,0.32)");
        g.addColorStop(1, "rgba(96,64,36,0)");
        c.fillStyle = g;
        c.fillRect(px(L.x) - T * 1.5, px(L.y) - T * 1.5, T * 3, T * 3);
      }
      c.restore();
      // liseré sombre au haut des falaises (le bord du plateau se lit net)
      c.strokeStyle = "rgba(48,32,18,0.55)";
      c.lineWidth = Math.max(1.2, T * 0.022);
      c.stroke(segsPath(contour(face, 0.3)));
      // herbe qui retombe sur le bord des falaises
      const lip = contour(face, 0.32);
      const cols = ["#5c9434", "#6fa83d", "#86bd4a", "#4c8330"];
      c.lineCap = "round";
      for (let i = 0; i < lip.length; i += 4) {
        const x0 = lip[i], y0 = lip[i + 1], x1 = lip[i + 2], y1 = lip[i + 3];
        const gx = x0 / T - A, gy = y0 / T - A;
        if (!inMap(gx, gy) && rng() < 0.5) continue;
        if (at(fine.rock, gx, gy) > 0.3 && rng() < 0.7) continue;
        // direction vers le chemin (gradient du champ)
        const dx = at(face, gx + 0.05, gy) - at(face, gx - 0.05, gy), dy = at(face, gx, gy + 0.05) - at(face, gx, gy - 0.05);
        const l = Math.hypot(dx, dy) || 1;
        const ux = dx / l, uy = dy / l;
        const nb = 2 + ((rng() * 3) | 0);
        for (let q = 0; q < nb; q++) {
          const t = rng(), bx = x0 + (x1 - x0) * t, by = y0 + (y1 - y0) * t;
          const len = T * (0.05 + rng() * 0.07);
          c.strokeStyle = cols[(rng() * cols.length) | 0];
          c.lineWidth = Math.max(1, T * (0.012 + rng() * 0.012));
          c.beginPath();
          c.moveTo(bx - ux * T * 0.03, by - uy * T * 0.03);
          c.lineTo(bx + ux * len + (rng() - 0.5) * T * 0.04, by + uy * len + (rng() - 0.5) * T * 0.04);
          c.stroke();
        }
      }
    }

    // 9. Menhirs : cercle de pierres gravé de runes (runes lumineuses dans l'émission).
    for (const [mi, mj] of field.map.mana || []) {
      const x = px(mi + 0.5), y = px(mj + 0.5), r = T * 0.38;
      c.save();
      c.strokeStyle = "rgba(60,54,48,0.6)";
      c.lineWidth = T * 0.09;
      c.beginPath();
      c.arc(x, y + T * 0.01, r, 0, Math.PI * 2);
      c.stroke();
      c.strokeStyle = "#b9b2a4";
      c.lineWidth = T * 0.07;
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.stroke();
      c.restore();
      e.save();
      e.strokeStyle = "rgba(80,190,255,0.35)";
      e.lineWidth = T * 0.1;
      e.beginPath();
      e.arc(x, y, r, 0, Math.PI * 2);
      e.stroke();
      e.strokeStyle = "#8fe4ff";
      e.lineWidth = Math.max(1, T * 0.018);
      e.lineCap = "round";
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2, rx = x + Math.cos(a) * r, ry = y + Math.sin(a) * r;
        e.beginPath();
        e.moveTo(rx - Math.sin(a) * T * 0.025, ry + Math.cos(a) * T * 0.025);
        e.lineTo(rx + Math.sin(a) * T * 0.025, ry - Math.cos(a) * T * 0.025);
        e.moveTo(rx, ry);
        e.lineTo(rx + Math.cos(a + 0.8) * T * 0.02, ry + Math.sin(a + 0.8) * T * 0.02);
        e.stroke();
      }
      e.restore();
      c.strokeStyle = "#3f7fa0";
      c.lineWidth = Math.max(1, T * 0.015);
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2, rx = x + Math.cos(a) * r, ry = y + Math.sin(a) * r;
        c.beginPath();
        c.moveTo(rx - Math.sin(a) * T * 0.025, ry + Math.cos(a) * T * 0.025);
        c.lineTo(rx + Math.sin(a) * T * 0.025, ry - Math.cos(a) * T * 0.025);
        c.stroke();
      }
    }

    // 10. Détails de l'herbe : fleurs, trèfles, touffes sombres (jamais sur les chemins).
    {
      const fl = [
        ["#ffffff", "#f7e27a"],
        ["#ffe14a", "#e0a020"],
        ["#e89ad8", "#b95aa8"],
        ["#b9a4ff", "#7a62d8"],
        ["#ff9a7a", "#e0603a"],
      ];
      const n = Math.round(EW * EH * (opts.mobile ? 5 : 8));
      for (let i = 0; i < n; i++) {
        const gx = rng() * EW - A, gy = rng() * EH - A;
        const g = at(fine.grass, gx, gy) + at(fine.high, gx, gy) * 0.8 + at(fine.wild, gx, gy) * 0.3;
        if (g < 0.85 || at(fine.road, gx, gy) > 0.02 || at(fine.water, gx, gy) > 0.02) continue;
        const x = px(gx), y = px(gy);
        const kind = rng();
        if (kind < 0.55) {
          const [p, h] = fl[(rng() * fl.length) | 0];
          const m = 2 + ((rng() * 5) | 0);
          for (let q = 0; q < m; q++) {
            const fx = x + (rng() - 0.5) * T * 0.16, fy = y + (rng() - 0.5) * T * 0.12, r = T * (0.012 + rng() * 0.01);
            c.fillStyle = "rgba(40,70,20,0.35)";
            c.beginPath();
            c.arc(fx + r * 0.4, fy + r * 0.5, r, 0, Math.PI * 2);
            c.fill();
            c.fillStyle = p;
            c.beginPath();
            c.arc(fx, fy, r, 0, Math.PI * 2);
            c.fill();
            c.fillStyle = h;
            c.beginPath();
            c.arc(fx, fy, r * 0.4, 0, Math.PI * 2);
            c.fill();
          }
        } else if (kind < 0.8) {
          c.strokeStyle = rng() < 0.5 ? "#4d8a2c" : "#3f7626";
          c.lineWidth = Math.max(1, T * 0.013);
          c.lineCap = "round";
          for (let q = 0; q < 5; q++) {
            c.beginPath();
            c.moveTo(x, y);
            c.lineTo(x + (q - 2) * T * 0.018 + (rng() - 0.5) * T * 0.02, y - T * (0.04 + rng() * 0.04));
            c.stroke();
          }
        } else {
          softDot(c, x, y, T * (0.06 + rng() * 0.08), rng() < 0.5 ? "rgba(120,178,60,0.45)" : "rgba(70,120,40,0.4)");
        }
      }
    }

    // Masque des sols pour la texture de détail : r herbe, g terre, b roche (grille fine).
    const mask = new Uint8Array(nx * ny * 4);
    for (let k = 0; k < nx * ny; k++) {
      const dirt = clamp(fine.road[k] + fine.mill[k] + fine.flat[k] * 0.6 + fine.field[k] * 0.5 + fine.tide[k] + (fine.water[k] > 0.02 && fine.h[k] < 0.3 ? 0.8 : 0), 0, 1);
      const rock = clamp(fine.rock[k] + fine.cliff[k] + fine.bould[k] * 0.8, 0, 1) * (1 - dirt);
      const grass = clamp(1 - dirt - rock, 0, 1);
      mask[k * 4] = grass * 255;
      mask[k * 4 + 1] = dirt * 255;
      mask[k * 4 + 2] = rock * 255;
      mask[k * 4 + 3] = 255;
    }
    MK.lastPaintMs = performance.now() - t0;
    /** Passage secret ouvert : le sentier envahi devient un chemin de terre (repeint sur place). */
    const openSecret = () => {
      const zone = region(fine.secret, 0.5);
      c.save();
      c.clip(zone);
      c.fillStyle = P_DIRT;
      c.fillRect(0, 0, W, H);
      // herbe foulée qui subsiste et touffes arrachées
      c.globalAlpha = 0.2;
      c.fillStyle = P_GRASS;
      c.fillRect(0, 0, W, H);
      c.globalAlpha = 1;
      const r2 = PTMT.rng(field.seed + 77);
      for (let j = 0; j < MH; j++)
        for (let i = 0; i < MW; i++) {
          if (field.grid[j][i] !== "s") continue;
          for (let q = 0; q < 26; q++) {
            const x = px(i + r2()), y = px(j + r2());
            softDot(c, x, y, T * (0.04 + r2() * 0.07), r2() < 0.5 ? "rgba(96,150,48,0.5)" : "rgba(120,84,48,0.45)");
          }
        }
      c.restore();
    };
    return { color: cv, emis: ecv, mask, maskW: nx, maskH: ny, openSecret };
  };

  /** Texture de détail répétée (r brins d'herbe, g grain de terre, b grain de roche), centrée sur 0,5. */
  let DETAIL = null;
  function detailTexture() {
    if (DETAIL) return DETAIL;
    const S = 128, data = new Uint8Array(S * S * 4);
    const per = (x, y, s, p) => {
      // bruit de valeur périodique (période p)
      const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
      const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
      const h = (a, b) => hash2(((a % p) + p) % p, ((b % p) + p) % p, s);
      const a = h(ix, iy), b = h(ix + 1, iy), c = h(ix, iy + 1), d = h(ix + 1, iy + 1);
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const k = (y * S + x) * 4;
        const blades = per(x * 0.5, y * 0.12, 3, 64) * 0.6 + per(x * 0.25, y * 0.25, 4, 32) * 0.4;
        const grain = per(x * 0.5, y * 0.5, 5, 64) * 0.5 + hash2(x, y, 6) * 0.5;
        const rock = per(x * 0.19, y * 0.19, 7, 24) * 0.6 + hash2(x, y, 8) * 0.4;
        data[k] = clamp(blades, 0, 1) * 255;
        data[k + 1] = clamp(grain, 0, 1) * 255;
        data[k + 2] = clamp(rock, 0, 1) * 255;
        data[k + 3] = 255;
      }
    const t = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.needsUpdate = true;
    DETAIL = t;
    return t;
  }
  /** Bruit répété pour l'eau : r, g pente, b hauteur, a écume. */
  let WNOISE = null;
  function waterNoise() {
    if (WNOISE) return WNOISE;
    const S = 128, P = 16, data = new Uint8Array(S * S * 4);
    const hgt = new Float32Array(S * S);
    const per = (x, y, s, p) => {
      const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
      const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
      const h = (a, b) => hash2(((a % p) + p) % p, ((b % p) + p) % p, s);
      const a = h(ix, iy), b = h(ix + 1, iy), c = h(ix, iy + 1), d = h(ix + 1, iy + 1);
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const fx = (x / S) * P, fy = (y / S) * P;
        hgt[y * S + x] = per(fx, fy, 31, P) * 0.6 + per(fx * 2, fy * 2, 32, P * 2) * 0.28 + per(fx * 4, fy * 4, 33, P * 4) * 0.12;
      }
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const k = y * S + x;
        const dx = hgt[y * S + ((x + 1) % S)] - hgt[y * S + ((x + S - 1) % S)];
        const dy = hgt[((y + 1) % S) * S + x] - hgt[((y + S - 1) % S) * S + x];
        data[k * 4] = clamp(0.5 + dx * 4, 0, 1) * 255;
        data[k * 4 + 1] = clamp(0.5 + dy * 4, 0, 1) * 255;
        data[k * 4 + 2] = hgt[k] * 255;
        const fx = (x / S) * 8, fy = (y / S) * 8;
        data[k * 4 + 3] = clamp(per(fx, fy, 34, 8) * 0.7 + per(fx * 3, fy * 3, 35, 24) * 0.3, 0, 1) * 255;
      }
    const t = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.needsUpdate = true;
    WNOISE = t;
    return t;
  }

  /* ------------------------------------------------------------------ surimpressions (GLSL) */
  // Grille discrète, mode construction, portée et réticules : calculés dans les shaders du sol et
  // de l'eau à partir de la position monde, ils suivent exactement le relief.
  MK.OVERLAY_GLSL = /* glsl */ `
    uniform float uOvTime, uPxM, uGridA;
    uniform sampler2D uTiles;
    uniform vec4 uBuild, uRange, uRet, uMapRect;
    uniform vec3 uRangeCol, uRetCol;
    float ptRBox(vec2 p, float b, float r) { vec2 q = abs(p) - vec2(b - r); return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
    vec4 ptOver(vec4 d, vec4 s) {
      float a = s.a + d.a * (1.0 - s.a);
      return vec4((s.rgb * s.a + d.rgb * d.a * (1.0 - s.a)) / max(a, 1e-4), a);
    }
    vec4 ptOverlay(vec2 w) {
      vec4 o = vec4(0.0);
      vec2 t = w / 3.6 + vec2(10.0, 6.5);
      float aa = 1.0 / max(uPxM * 3.6, 1.0);
      if (t.x > 0.0 && t.y > 0.0 && t.x < 20.0 && t.y < 13.0) {
        vec2 ti = floor(t), f = t - ti - 0.5;
        vec4 st = texture2D(uTiles, (ti + 0.5) / vec2(20.0, 13.0));
        float d = ptRBox(f, 0.475, 0.09);
        if (st.r > 0.5 && uGridA > 0.0) {
          float line = 1.0 - smoothstep(aa * 0.5, aa * 1.6, abs(d + 0.012));
          o = ptOver(o, vec4(0.1, 0.16, 0.05, line * uGridA));
        }
        if (uBuild.x > 0.5) {
          float g = floor(st.g * 255.0 + 0.5);
          bool hov = abs(ti.x - uBuild.y) < 0.5 && abs(ti.y - uBuild.z) < 0.5;
          float edge = 1.0 - smoothstep(aa * 0.8, aa * 2.4, abs(d + 0.035));
          float inside = 1.0 - smoothstep(-aa, aa, d + 0.035);
          if (hov) {
            vec3 c = uBuild.w > 0.5 ? vec3(0.45, 1.0, 0.35) : vec3(1.0, 0.28, 0.2);
            o = ptOver(o, vec4(c, max(inside * (0.32 + 0.1 * sin(uOvTime * 6.0)), edge)));
          } else if (g > 0.5 && g < 1.5) {
            float edge2 = 1.0 - smoothstep(aa * 0.5, aa * 1.7, abs(d + 0.035));
            o = ptOver(o, vec4(0.78, 1.0, 0.6, max(inside * 0.08, edge2 * 0.6)));
          } else if (g > 1.5 && g < 2.5) {
            float dash = step(0.5, fract((f.x - f.y) * 3.0 + uOvTime * 0.6));
            o = ptOver(o, vec4(1.0, 0.8, 0.4, edge * (0.25 + 0.5 * dash)));
          }
        }
      }
      if (uRange.w > 0.0) {
        float dr = length(w - uRange.xy);
        float px = 1.0 / max(uPxM, 0.1);
        float rim = 1.0 - smoothstep(px * 0.7, px * 1.9, abs(dr - uRange.z + px * 1.6));
        float fill = 1.0 - smoothstep(uRange.z - px, uRange.z, dr);
        float halo = fill * smoothstep(uRange.z * 0.55, uRange.z, dr) * 0.1;
        o = ptOver(o, vec4(uRangeCol, max(fill * 0.13 + halo, rim * 0.95) * uRange.w));
      }
      if (uRet.w > 0.5) {
        float px = 1.0 / max(uPxM, 0.1);
        vec2 q = w - uRet.xy;
        if (uRet.w < 1.5) {
          float dr = length(q);
          float ang = atan(q.y, q.x);
          float rim = 1.0 - smoothstep(px * 0.8, px * 2.2, abs(dr - uRet.z + px * 2.0));
          float dash = step(0.45, fract(ang / 6.2831853 * 20.0 - uOvTime * 0.5));
          float ring2 = (1.0 - smoothstep(px * 0.6, px * 1.6, abs(dr - uRet.z * 0.82))) * dash;
          float fill = (1.0 - smoothstep(uRet.z - px, uRet.z, dr)) * (0.16 + 0.07 * sin(uOvTime * 7.0));
          float pr = fract(uOvTime * 0.9);
          float wave = (1.0 - smoothstep(0.0, px * 3.0, abs(dr - pr * uRet.z))) * (1.0 - pr) * 0.6;
          float cross = (1.0 - smoothstep(px * 0.6, px * 1.6, min(abs(q.x), abs(q.y)))) * step(dr, uRet.z * 0.22);
          o = ptOver(o, vec4(uRetCol, clamp(max(max(fill, rim), max(ring2 * 0.8, max(wave, cross * 0.9))), 0.0, 1.0)));
        } else {
          float d = ptRBox(q / 3.6, 0.5, 0.1);
          float aa2 = px / 3.6;
          float edge = 1.0 - smoothstep(aa2 * 0.8, aa2 * 2.6, abs(d + 0.03));
          float inside = 1.0 - smoothstep(-aa2, aa2, d + 0.03);
          float corner = step(0.28, abs(q.x / 3.6)) * step(0.28, abs(q.y / 3.6));
          o = ptOver(o, vec4(uRetCol, max(inside * (0.2 + 0.08 * sin(uOvTime * 6.0)), edge * (0.55 + 0.45 * corner))));
        }
      }
      return o;
    }
  `;
  MK.makeOverlayUniforms = function () {
    const data = new Uint8Array(MW * MH * 4);
    const tex = new THREE.DataTexture(data, MW, MH, THREE.RGBAFormat);
    tex.magFilter = tex.minFilter = THREE.NearestFilter;
    tex.needsUpdate = true;
    return {
      uOvTime: { value: 0 },
      uPxM: { value: 16 },
      uGridA: { value: 0.1 },
      uTiles: { value: tex },
      uBuild: { value: new THREE.Vector4(0, -9, -9, 0) },
      uRange: { value: new THREE.Vector4(0, 0, 1, 0) },
      uRangeCol: { value: new THREE.Color(1, 1, 1) },
      uRet: { value: new THREE.Vector4(0, 0, 1, 0) },
      uRetCol: { value: new THREE.Color(1, 0.8, 0.3) },
      uMapRect: { value: new THREE.Vector4(-MW * TILE / 2, -MH * TILE / 2, MW * TILE / 2, MH * TILE / 2) },
    };
  };

  /* ------------------------------------------------------------------ géométries des arbres */
  // Arbres ronds et touffus (couleurs par sommet, normales arrondies = ombrage doux, attribut
  // « sway » pour le vent), une géométrie par essence et variante, partagée par les lots.
  function mergeParts(parts) {
    let n = 0;
    for (const p of parts) {
      if (p.g.index) p.g = p.g.toNonIndexed();
      n += p.g.attributes.position.count;
    }
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3), sway = new Float32Array(n);
    let o = 0;
    for (const p of parts) {
      const g = p.g;
      g.computeVertexNormals();
      const P = g.attributes.position, N = g.attributes.normal;
      const c = lin(p.color);
      let ymin = Infinity, ymax = -Infinity;
      for (let i = 0; i < P.count; i++) {
        ymin = Math.min(ymin, P.getY(i));
        ymax = Math.max(ymax, P.getY(i));
      }
      for (let i = 0; i < P.count; i++) {
        const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
        pos[(o + i) * 3] = x;
        pos[(o + i) * 3 + 1] = y;
        pos[(o + i) * 3 + 2] = z;
        let nx = N.getX(i), ny = N.getY(i), nz = N.getZ(i);
        if (p.round) {
          const rx = x - p.round[0], ry = y - p.round[1], rz = z - p.round[2];
          const l = Math.hypot(rx, ry, rz) || 1;
          nx = nx * 0.3 + (rx / l) * 0.7;
          ny = ny * 0.3 + (ry / l) * 0.7 + 0.12;
          nz = nz * 0.3 + (rz / l) * 0.7;
          const l2 = Math.hypot(nx, ny, nz) || 1;
          nx /= l2;
          ny /= l2;
          nz /= l2;
        }
        nor[(o + i) * 3] = nx;
        nor[(o + i) * 3 + 1] = ny;
        nor[(o + i) * 3 + 2] = nz;
        const k = p.shade ? 1 - p.shade * (1 - (y - ymin) / Math.max(1e-3, ymax - ymin)) : 1;
        col[(o + i) * 3] = c.r * k;
        col[(o + i) * 3 + 1] = c.g * k;
        col[(o + i) * 3 + 2] = c.b * k;
        sway[o + i] = p.sway ? Math.max(0, y) * p.sway : 0;
      }
      o += P.count;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    g.setAttribute("sway", new THREE.BufferAttribute(sway, 1));
    g.computeBoundingSphere();
    return g;
  }
  MK.mergeParts = mergeParts;
  function lumpy(g, amt, seed, cx, cy, cz, sy) {
    // bosselage fonction de la position (les sommets confondus bougent ensemble : pas de fissure)
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const k = 1 + amt * (vnoise(x * 2.3 + seed, z * 2.3 + y * 1.7, 41) - 0.5) * 2;
      p.setXYZ(i, x * k + cx, y * k * (sy || 1) + cy, z * k + cz);
    }
    return g;
  }
  const TREE_GEO = new Map();
  MK.treeGeo = function (kind, v, detail) {
    const key = kind + ":" + v + ":" + detail;
    let g = TREE_GEO.get(key);
    if (g) return g;
    const rng = PTMT.rng(kind.length * 131 + v * 17 + 3);
    const parts = [];
    const blob = (r, x, y, z, color, round, sy) => parts.push({ g: lumpy(new THREE.IcosahedronGeometry(r, detail), 0.14, rng() * 50, x, y, z, sy || 0.88), color, round, shade: 0.35, sway: 1 });
    const trunk = (h, r, color, lean) => {
      const t = new THREE.CylinderGeometry(r * 0.62, r, h, 6, 2);
      t.translate(0, h / 2, 0);
      const p = t.attributes.position;
      for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) + (p.getY(i) / h) * (lean || 0));
      parts.push({ g: t, color, shade: 0.3, sway: 0.25 });
    };
    if (kind === "oak" || kind === "chestnut") {
      const cols = kind === "oak" ? ["#3c6e29", "#4a8132", "#579238", "#447a2e"] : ["#5a8c2e", "#6a9c36", "#78ab3f", "#608f31"];
      trunk(1.9, 0.3, "#6b4f35", 0.15 * (v - 0.5));
      const cy = 3.0;
      blob(1.35, 0, cy + 0.25, 0, cols[2], [0, cy, 0]);
      const m = 5 + v;
      for (let i = 0; i < m; i++) {
        const a = (i / m) * Math.PI * 2 + v * 0.7, d = 0.95 + rng() * 0.25;
        blob(0.85 + rng() * 0.25, Math.cos(a) * d, cy - 0.25 + rng() * 0.55, Math.sin(a) * d, cols[i % 4], [0, cy, 0]);
      }
      blob(0.9, 0.15, cy + 0.95, -0.1, cols[2], [0, cy, 0]);
    } else if (kind === "pine") {
      trunk(1.3, 0.2, "#6b4a2e");
      const cols = ["#2c5a3b", "#336646", "#3b7050", "#2f5f40"];
      const tiers = [[1.35, 1.9, 1.15], [1.05, 1.7, 2.1], [0.72, 1.45, 3.0], [0.4, 1.0, 3.75]];
      tiers.forEach(([r, h, y], i) => {
        const cone = new THREE.ConeGeometry(r * (1 + (v - 0.5) * 0.12), h, 8, 1);
        cone.translate(0, y, 0);
        lumpy(cone, 0.08, rng() * 40, 0, 0, 0, 1);
        parts.push({ g: cone, color: cols[(i + v) % 4], round: [0, y - h * 0.2, 0], shade: 0.35, sway: 1 });
      });
    } else if (kind === "bush") {
      const cols = ["#4a7c2e", "#588c35", "#3f6f28"];
      for (let i = 0; i < 3; i++) blob(0.5 + rng() * 0.25, (rng() - 0.5) * 0.8, 0.42 + rng() * 0.15, (rng() - 0.5) * 0.8, cols[i % 3], [0, 0.3, 0], 0.8);
    } else if (kind === "bramble") {
      const cols = ["#3a5e28", "#46702c", "#52602a", "#34562a"];
      for (let i = 0; i < 4; i++) blob(0.45 + rng() * 0.25, (rng() - 0.5) * 1.0, 0.4 + rng() * 0.25, (rng() - 0.5) * 1.0, cols[i % 4], [0, 0.3, 0], 0.85);
      for (let i = 0; i < 5; i++) blob(0.07, (rng() - 0.5) * 1.1, 0.7 + rng() * 0.3, (rng() - 0.5) * 1.1, i % 2 ? "#e8e4f0" : "#5a2448", null, 1);
    } else if (kind === "reeds") {
      const cols = ["#6f8f3a", "#86a64a", "#5d7f30"];
      for (let i = 0; i < 12; i++) {
        const h = 1.1 + rng() * 0.8, bx = (rng() - 0.5) * 0.9, bz = (rng() - 0.5) * 0.9;
        const blade = new THREE.ConeGeometry(0.06, h, 3, 1);
        blade.translate(0, h / 2, 0);
        const lean = (rng() - 0.5) * 0.5, leanz = (rng() - 0.5) * 0.5;
        const p = blade.attributes.position;
        for (let k = 0; k < p.count; k++) {
          const t = p.getY(k) / h;
          p.setXYZ(k, p.getX(k) + bx + lean * t * t, p.getY(k), p.getZ(k) + bz + leanz * t * t);
        }
        parts.push({ g: blade, color: cols[i % 3], shade: 0.4, sway: 1.4 });
        if (i % 4 === 0) {
          const head = new THREE.CylinderGeometry(0.075, 0.075, 0.32, 6, 1);
          head.translate(bx + lean * 0.8, h * 0.82, bz + leanz * 0.8);
          parts.push({ g: head, color: "#6b4226", sway: 1.4 });
        }
      }
    } else if (kind === "lily") {
      const pad = new THREE.CircleGeometry(0.42, 10, 0.4, Math.PI * 2 - 0.5);
      pad.rotateX(-Math.PI / 2);
      pad.translate(0, 0.02, 0);
      parts.push({ g: pad, color: "#4f8f3a" });
      const fl = new THREE.IcosahedronGeometry(0.1, 0);
      fl.scale(1, 0.6, 1);
      fl.translate(0.12, 0.08, 0.05);
      parts.push({ g: fl, color: v ? "#f7b6d8" : "#fff6e8" });
    } else if (kind === "boulder") {
      const g2 = new THREE.DodecahedronGeometry(0.75, 0);
      lumpy(g2, 0.22, rng() * 30, 0, 0.28, 0, 0.66);
      const P = g2.attributes.position;
      g2.computeVertexNormals();
      parts.push({ g: g2, color: v ? "#8f8a82" : "#9b958b", shade: 0.3 });
      const moss = new THREE.DodecahedronGeometry(0.32, 0);
      lumpy(moss, 0.2, rng() * 30, -0.12, 0.66, 0.1, 0.35);
      parts.push({ g: moss, color: "#7a8f52", shade: 0.2 });
      void P;
    } else if (kind === "stone") {
      // pierre nue des flancs de butte (granit, sans mousse)
      const g2 = new THREE.DodecahedronGeometry(0.75, 0);
      lumpy(g2, 0.25, rng() * 30, 0, 0.26, 0, 0.7);
      parts.push({ g: g2, color: v ? "#8a857c" : "#99938a", shade: 0.35 });
    } else if (kind === "stump") {
      const t = new THREE.CylinderGeometry(0.22, 0.3, 0.38, 7, 1);
      t.translate(0, 0.19, 0);
      parts.push({ g: t, color: "#5b3d27", shade: 0.3 });
      const top = new THREE.CircleGeometry(0.21, 7);
      top.rotateX(-Math.PI / 2);
      top.translate(0, 0.385, 0);
      parts.push({ g: top, color: "#e3c28c" });
    }
    g = mergeParts(parts);
    TREE_GEO.set(key, g);
    return g;
  };
  /** Matière des arbres : couleurs par sommet (et par instance), balancement au vent. */
  MK.treeMaterial = function (key, uTime) {
    return PTMT.mat("view:tree:" + key, () => {
      const m = new THREE.MeshLambertMaterial({ vertexColors: true });
      m.onBeforeCompile = (sh) => {
        sh.uniforms.uTime = uTime;
        sh.vertexShader = sh.vertexShader
          .replace("#include <common>", "#include <common>\nattribute float sway;\nuniform float uTime;")
          .replace(
            "#include <begin_vertex>",
            `#include <begin_vertex>
            #ifdef USE_INSTANCING
              vec4 iw = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
            #else
              vec4 iw = vec4(0.0);
            #endif
            float ph = iw.x * 0.21 + iw.z * 0.17;
            float sw = sway * 0.022;
            transformed.x += sin(uTime * 1.3 + ph) * sw;
            transformed.z += cos(uTime * 1.05 + ph * 1.3) * sw * 0.7;`,
          );
      };
      m.customProgramCacheKey = () => "ptmt-view-tree";
      return m;
    });
  };

  /* ------------------------------------------------------------------ monde */
  function World(o) {
    this.o = o;
    this.map = o.map;
    this.mobile = !!o.mobile;
    this.quality = o.quality || (o.mobile ? "low" : "high");
    this.high = this.quality === "high";
    this.root = new THREE.Group();
    this.root.name = "PTMT:carte";
    o.scene.add(this.root);
    this.disposables = [];
    this.animated = [];
    this.uTime = { value: 0 };
    const t0 = performance.now();
    const M = PTMT.models || {};
    this.nativeButte = typeof M.highGround === "function";
    const field = (this.field = new Field(this.map, { flatX: typeof M.decorBatch === "function", flatH: this.nativeButte }));
    field.buildHeights(this.high ? 8 : 6);
    this.fine = field.buildFine(this.mobile ? 12 : 16);
    this.timings = { field: performance.now() - t0 };
    // cachettes et entrées de la carte (mêmes numéros, lettres et couleurs que la simulation)
    this.places = MK.mapPlaces ? MK.mapPlaces(this.map) : { lairs: [], entrances: [] };
    this.highTop = new Map();
    // marée : 0 = haute (l'estran est sous l'eau), 1 = basse ; animée vers sa consigne
    this.tideLevel = 0;
    this.tideTarget = 0;
    this.ov = MK.makeOverlayUniforms();
    this.disposables.push(this.ov.uTiles.value);
    const tp = performance.now();
    const T = o.texPerTile || (this.mobile ? 52 : this.high ? 72 : 60);
    const tt = performance.now();
    const tracks = MK.trafficLines(this.map);
    this.timings.tracks = performance.now() - tt;
    this.paint = MK.paint(field, this.fine, T, { mobile: this.mobile, tracks, lairs: this.places.lairs });
    this.timings.paint = performance.now() - tp;
    this.buildTextures();
    this.buildLights();
    this.buildTerrain();
    this.buildWater();
    this.buildBridges();
    this.buildBackground();
    this.buildObjects();
    this.timings.total = performance.now() - t0;
  }
  const W = World.prototype;
  MK.World = World;

  W.toWorld = function (x, y, h, out) {
    return (out || new THREE.Vector3()).set(toX(x), h === undefined ? this.field.heightAt(x, y) : h, toZ(y));
  };
  W.heightAt = function (x, y) {
    return this.field.heightAt(x, y);
  };
  /** Dessus d'une case (m) : herbe/roche ≈ 0,45, butte ≈ 1,3 (dessus du socle), eau = surface, pont = tablier. */
  W.tileTop = function (i, j) {
    const ch = this.field.charAt(i, j);
    if (ch === "~" || ch === "w") return WATER_Y;
    if (ch === "=") return DECK_Y;
    if (ch === "H" || ch === "h") {
      const top = this.highTop.get(i + "," + j);
      if (top !== undefined) return top;
    }
    return this.field.heightAt(i + 0.5, j + 0.5);
  };
  /** Sol où l'on marche en (x, y) : tablier des ponts, surface de l'eau pour les nageurs. */
  W.groundAt = function (x, y, swimmer) {
    const i = Math.floor(x), j = Math.floor(y);
    const ch = this.field.charAt(i, j);
    const h = this.field.heightAt(x, y);
    if (ch === "=") return DECK_Y;
    // rampes vers les ponts
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (this.field.charAt(i + di, j + dj) !== "=") continue;
      const d = di ? (di > 0 ? i + 1 - x : x - i) : dj > 0 ? j + 1 - y : y - j;
      if (d < 0.3) return Math.max(h, DECK_Y * (1 - d / 0.3));
    }
    if (swimmer && h < WATER_Y) return WATER_Y;
    return h;
  };

  W.buildTextures = function () {
    const p = this.paint;
    const col = new THREE.CanvasTexture(p.color);
    col.encoding = THREE.sRGBEncoding;
    col.flipY = false;
    col.anisotropy = 4;
    col.minFilter = THREE.LinearMipmapLinearFilter;
    const em = new THREE.CanvasTexture(p.emis);
    em.encoding = THREE.sRGBEncoding;
    em.flipY = false;
    const mask = new THREE.DataTexture(p.mask, p.maskW, p.maskH, THREE.RGBAFormat);
    mask.magFilter = mask.minFilter = THREE.LinearFilter;
    mask.needsUpdate = true;
    // lit de l'eau (grille fine) : r = hauteur du relief (−1,2 … +0,6 m) ; marée : g = estran,
    // b = ordre de découvrement (0 au bord de l'eau, 1 côté terre), a = flaques qui restent
    const f = this.fine, n = f.nx * f.ny, A0 = this.field.A;
    const bed = new Uint8Array(n * 4);
    const ord = f.tideOrder;
    for (let k = 0; k < n; k++) {
      bed[k * 4] = clamp((f.h[k] + 1.2) / 1.8, 0, 1) * 255;
      if (ord && f.tide[k] > 0.01) {
        const x = (k % f.nx) / f.F - A0, y = Math.floor(k / f.nx) / f.F - A0;
        bed[k * 4 + 1] = clamp(f.tide[k] * 1.6, 0, 1) * 255;
        bed[k * 4 + 2] = ord[k] * 255;
        bed[k * 4 + 3] = clamp((MK.puddleV(x, y) - 0.64) / 0.05, 0, 1) * 255;
      } else bed[k * 4 + 3] = 0;
    }
    const bedTex = new THREE.DataTexture(bed, f.nx, f.ny, THREE.RGBAFormat);
    bedTex.magFilter = bedTex.minFilter = THREE.LinearFilter;
    bedTex.needsUpdate = true;
    this.tex = { color: col, emis: em, mask, bed: bedTex, shadow: null };
    this.disposables.push(col, em, mask, bedTex);
    const A = this.field.A;
    // étendue (monde) couverte par les textures : origine au coin (−A, −A)
    this.extent = new THREE.Vector4(toX(-A), toZ(-A), this.field.EW * TILE, this.field.EH * TILE);
  };

  /* ------------------------------------------------------------------ lumière et ombres */
  // Soleil chaud de fin d'après-midi, par la gauche de l'écran et un peu devant : les faces vues
  // sont éclairées, les ombres partent vers la droite et le fond. Le soleil tourne avec la caméra
  // (portrait) : la texture d'ombres du relief est alors recalculée.
  const SUN_CAM = new THREE.Vector3(-0.56, 0.76, 0.33).normalize();
  W.buildLights = function () {
    const hemi = new THREE.HemisphereLight(lin("#d8e6ff"), lin("#5e5236"), 0.62);
    const sun = new THREE.DirectionalLight(lin("#ffdcab"), 0.95);
    sun.name = "Soleil";
    this.hemi = hemi;
    this.sun = sun;
    this.sunDir = SUN_CAM.clone();
    this.root.add(hemi, sun, sun.target);
    if (this.high) {
      sun.castShadow = true;
      const s = this.mobile ? 1024 : 2048;
      sun.shadow.mapSize.set(s, s);
      sun.shadow.bias = -0.0005;
      sun.shadow.normalBias = 0.025;
      sun.shadow.radius = 2;
    }
  };
  /** Oriente le soleil selon l'azimut de la caméra (0 : vue du sud ; π/2 : vue de l'est). */
  W.setSunAzimuth = function (az) {
    if (this.sunAz === az && this.tex.shadow) return;
    this.sunAz = az;
    const c = Math.cos(az), s = Math.sin(az);
    this.sunDir.set(SUN_CAM.x * c + SUN_CAM.z * s, SUN_CAM.y, -SUN_CAM.x * s + SUN_CAM.z * c).normalize();
    const sun = this.sun;
    sun.position.copy(this.sunDir).multiplyScalar(90);
    sun.target.position.set(0, 0, 0);
    sun.target.updateMatrixWorld();
    if (sun.castShadow) {
      const cam = sun.shadow.camera;
      const r = Math.hypot(MW * TILE, MH * TILE) / 2 + TILE * 1.5;
      cam.left = -r;
      cam.right = r;
      cam.top = r;
      cam.bottom = -r;
      cam.near = 40;
      cam.far = 150;
      cam.updateProjectionMatrix();
      sun.shadow.needsUpdate = true;
    }
    this.bakeShadows();
    // taches d'ombre (qualité « low ») : décalées du nouveau côté
    if (this.blobMesh) for (let i = 0; i < this.blobArgs.length; i++) if (this.blobArgs[i]) this.placeBlob(i);
  };
  /** Ombres du relief (et du décor fixe en qualité « low ») : texture douce à 10 px par case. */
  W.bakeShadows = function () {
    const f = this.field, A = f.A, S = this.mobile ? 8 : 10;
    const w = f.EW * S, h = f.EH * S;
    const d = this.sunDir;
    const hl = Math.hypot(d.x, d.z) || 1;
    const dx = d.x / hl, dz = d.z / hl, tanE = d.y / hl;
    const occ = new Float32Array(w * h);
    const step = 0.1, maxT = 3.2;
    for (let py = 0; py < h; py++) {
      const y = (py + 0.5) / S - A;
      for (let pxl = 0; pxl < w; pxl++) {
        const x = (pxl + 0.5) / S - A;
        const h0 = Math.max(f.heightAt(x, y), WATER_Y);
        let o = 0;
        for (let t = step; t <= maxT; t += step) {
          const hq = f.heightAt(x + dx * t, y + dz * t);
          const v = (hq - (h0 + t * TILE * tanE) - 0.02) / 0.22;
          if (v > o) {
            o = v;
            if (o >= 1) break;
          }
        }
        occ[py * w + pxl] = o > 1 ? 1 : o;
      }
    }
    // flou (boîte 3 × 3, deux passes)
    const tmp = new Float32Array(w * h);
    for (let pass = 0; pass < 2; pass++) {
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          let s = 0, n = 0;
          for (let k = -1; k <= 1; k++) {
            const xx = x + k;
            if (xx < 0 || xx >= w) continue;
            s += occ[y * w + xx];
            n++;
          }
          tmp[y * w + x] = s / n;
        }
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          let s = 0, n = 0;
          for (let k = -1; k <= 1; k++) {
            const yy = y + k;
            if (yy < 0 || yy >= h) continue;
            s += tmp[yy * w + x];
            n++;
          }
          occ[y * w + x] = s / n;
        }
    }
    let cv = this._shadowCanvas;
    if (!cv) cv = this._shadowCanvas = makeCanvas(w, h);
    const c = cv.getContext("2d");
    const img = c.createImageData(w, h);
    for (let k = 0; k < w * h; k++) {
      const v = 255 * (1 - 0.62 * occ[k]);
      img.data[k * 4] = img.data[k * 4 + 1] = img.data[k * 4 + 2] = v;
      img.data[k * 4 + 3] = 255;
    }
    c.putImageData(img, 0, 0);
    // qualité « low » : ombres portées du décor fixe (tablier, cases X, repaire)
    if (!this.high && this.staticShadowCasters) {
      c.save();
      for (const s of this.staticShadowCasters) {
        const len = s.h / Math.max(0.35, tanE) / TILE;
        const cx = (s.x - dx * len * 0.55 + A) * S, cy = (s.y - dz * len * 0.55 + A) * S;
        const r = s.r * S;
        const g = c.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, `rgba(0,0,0,${0.4 * (s.a || 1)})`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        c.fillStyle = g;
        c.beginPath();
        c.ellipse(cx, cy, r * (1 + len * 0.25), r, Math.atan2(-dz, -dx), 0, Math.PI * 2);
        c.fill();
      }
      c.restore();
    }
    if (!this.tex.shadow) {
      const t = new THREE.CanvasTexture(cv);
      t.flipY = false;
      t.magFilter = t.minFilter = THREE.LinearFilter;
      t.generateMipmaps = false;
      this.tex.shadow = t;
      this.disposables.push(t);
      if (this.terrainUniforms) this.terrainUniforms.uShadowTex.value = t;
      if (this.waterUniforms) this.waterUniforms.uShadowTex.value = t;
    } else this.tex.shadow.needsUpdate = true;
  };

  /* ------------------------------------------------------------------ relief */
  W.buildTerrain = function () {
    const f = this.field, R = f.R, nx = f.nx, ny = f.ny, A = f.A;
    const n = nx * ny;
    const pos = new Float32Array(n * 3), uv = new Float32Array(n * 2);
    for (let gy = 0; gy < ny; gy++)
      for (let gx = 0; gx < nx; gx++) {
        const k = gy * nx + gx, x = gx / R - A, y = gy / R - A;
        pos[k * 3] = toX(x);
        pos[k * 3 + 1] = f.h[k];
        pos[k * 3 + 2] = toZ(y);
        uv[k * 2] = gx / (nx - 1);
        uv[k * 2 + 1] = gy / (ny - 1);
      }
    const idx = new Uint32Array((nx - 1) * (ny - 1) * 6);
    let q = 0;
    for (let gy = 0; gy < ny - 1; gy++)
      for (let gx = 0; gx < nx - 1; gx++) {
        const a = gy * nx + gx, b = a + 1, c = a + nx, d = c + 1;
        idx[q++] = a; idx[q++] = c; idx[q++] = b;
        idx[q++] = b; idx[q++] = c; idx[q++] = d;
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    const U = (this.terrainUniforms = Object.assign(
      {
        uDetail: { value: detailTexture() },
        uMask: { value: this.tex.mask },
        uEmis: { value: this.tex.emis },
        uShadowTex: { value: this.tex.shadow },
        uExtent: { value: this.extent },
        uTime: this.uTime,
      },
      this.ov,
    ));
    const mat = new THREE.MeshLambertMaterial({ map: this.tex.color });
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vWPos;")
        .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;");
      sh.fragmentShader = sh.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
          varying vec3 vWPos;
          uniform sampler2D uDetail, uMask, uEmis, uShadowTex;
          uniform vec4 uExtent;
          uniform float uTime;
          float ptH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          float ptN(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(mix(ptH(i), ptH(i + vec2(1.0, 0.0)), u.x), mix(ptH(i + vec2(0.0, 1.0)), ptH(i + vec2(1.0, 1.0)), u.x), u.y); }
          ${MK.OVERLAY_GLSL}`,
        )
        .replace(
          "#include <map_fragment>",
          `#include <map_fragment>
          vec2 ptUv = (vWPos.xz - uExtent.xy) / uExtent.zw;
          vec4 ptMk = texture2D(uMask, ptUv);
          vec3 ptDt = texture2D(uDetail, vWPos.xz * 0.36).rgb;
          float ptD = dot(ptMk.rgb, ptDt) / max(ptMk.r + ptMk.g + ptMk.b, 0.01);
          diffuseColor.rgb *= 0.86 + 0.28 * ptD;`,
        )
        .replace(
          "#include <emissivemap_fragment>",
          `#include <emissivemap_fragment>
          float ptFl = 0.55 + 0.6 * ptN(vWPos.xz * 0.8 + vec2(uTime * 0.7, -uTime * 0.45)) + 0.15 * sin(uTime * 3.1 + vWPos.x);
          totalEmissiveRadiance += texture2D(uEmis, ptUv).rgb * ptFl * 1.35;`,
        )
        .replace(
          "#include <aomap_fragment>",
          `reflectedLight.directDiffuse *= texture2D(uShadowTex, ptUv).r;
          #include <aomap_fragment>`,
        )
        .replace(
          "#include <envmap_fragment>",
          `#include <envmap_fragment>
          {
            vec2 ptOut = max(max(uMapRect.xy - vWPos.xz, vWPos.xz - uMapRect.zw), 0.0);
            float ptV = smoothstep(0.0, 13.0, length(ptOut));
            outgoingLight = mix(outgoingLight, outgoingLight * vec3(0.42, 0.5, 0.4), ptV);
            vec4 ptO = ptOverlay(vWPos.xz);
            outgoingLight = mix(outgoingLight, ptO.rgb, ptO.a);
          }`,
        );
    };
    mat.customProgramCacheKey = () => "ptmt-view-terrain";
    const mesh = new THREE.Mesh(g, mat);
    mesh.name = "Relief";
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    this.root.add(mesh);
    this.terrain = mesh;
    this.disposables.push(g, mat);
  };

  /* ------------------------------------------------------------------ eau */
  W.buildWater = function () {
    const f = this.field, A = f.A, Q = 4; // quarts de case
    const cols = f.EW * Q, rows = f.EH * Q;
    const pos = [], flow = [], idx = [];
    const vmap = new Map();
    const flowOf = (i, j) => {
      // courant : le long des rivières (grandes lignes d'eau), dérive légère sur les étangs
      const isW = (a, b) => f.clsAt(a, b) === C.WATER;
      let hr = 0, vr = 0;
      for (let k = 1; k < 4; k++) {
        hr += isW(i + k, j) + isW(i - k, j);
        vr += isW(i, j + k) + isW(i, j - k);
      }
      if (hr >= vr * 2 + 1) return [0.55, 0.0];
      if (vr >= hr * 2 + 1) return [0.0, 0.55];
      return [0.12, 0.07];
    };
    const vert = (gx, gy) => {
      const key = gy * (cols + 1) + gx;
      let v = vmap.get(key);
      if (v !== undefined) return v;
      v = pos.length / 3;
      const x = gx / Q - A, y = gy / Q - A;
      pos.push(toX(x), WATER_Y, toZ(y));
      const [fx, fz] = flowOf(Math.floor(x), Math.floor(y));
      flow.push(fx, fz);
      vmap.set(key, v);
      return v;
    };
    for (let gy = 0; gy < rows; gy++)
      for (let gx = 0; gx < cols; gx++) {
        const x0 = gx / Q - A, y0 = gy / Q - A, x1 = x0 + 1 / Q, y1 = y0 + 1 / Q;
        let m = Infinity;
        for (let sy = 0; sy <= 2; sy++) for (let sx = 0; sx <= 2; sx++) m = Math.min(m, f.heightAt(x0 + (sx / 2) * (x1 - x0), y0 + (sy / 2) * (y1 - y0)));
        if (m > WATER_Y + 0.12) continue;
        const a = vert(gx, gy), b = vert(gx + 1, gy), c = vert(gx, gy + 1), d = vert(gx + 1, gy + 1);
        idx.push(a, c, b, b, c, d);
      }
    if (!idx.length) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("flow", new THREE.Float32BufferAttribute(flow, 2));
    g.setIndex(idx);
    g.computeBoundingSphere();
    const U = (this.waterUniforms = Object.assign(
      {
        uTime: this.uTime,
        uBed: { value: this.tex.bed },
        uNoise: { value: waterNoise() },
        uShadowTex: { value: this.tex.shadow },
        uExtent: { value: this.extent },
        uSun: { value: this.sunDir },
        uSunCol: { value: lin("#fff0cc") },
        uSky: { value: lin("#d8f0f4") },
        uShallow: { value: lin("#5cc6b8") },
        uDeep: { value: lin("#155a78") },
        uFoam: { value: lin("#f4fbf6") },
        uTide: { value: this.tideLevel },
      },
      this.ov,
    ));
    const mat = new THREE.ShaderMaterial({
      uniforms: U,
      transparent: true,
      depthWrite: false,
      vertexShader: /* glsl */ `
        attribute vec2 flow;
        varying vec3 vW; varying vec2 vFlow;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vW = w.xyz; vFlow = flow;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime, uTide;
        uniform sampler2D uBed, uNoise, uShadowTex;
        uniform vec4 uExtent;
        uniform vec3 uSun, uSunCol, uSky, uShallow, uDeep, uFoam;
        varying vec3 vW; varying vec2 vFlow;
        ${MK.OVERLAY_GLSL}
        void main() {
          vec2 uv = (vW.xz - uExtent.xy) / uExtent.zw;
          vec4 bt = texture2D(uBed, uv);
          float bed = bt.r * 1.8 - 1.2;
          float depth = max(0.0, -0.25 - bed);
          // marée : sur l'estran (bt.g), l'eau se retire du côté de la terre (ordre bt.b élevé) vers le
          // large quand uTide va de 0 (haute) à 1 (basse) ; les flaques (bt.a) restent pleines
          float front = 1.08 - uTide * 1.1;
          float dryK = bt.g * smoothstep(front - 0.05, front + 0.03, bt.b) * (1.0 - bt.a);
          float tideLine = bt.g * (1.0 - smoothstep(0.0, 0.09, abs(bt.b - front + 0.03))) * smoothstep(0.0, 0.04, uTide) * (1.0 - smoothstep(0.96, 1.0, uTide));
          float ph = fract(uTime * 0.12);
          float bl = abs(1.0 - 2.0 * ph);
          vec2 p1 = vW.xz - vFlow * ph * 8.0;
          vec2 p2 = vW.xz - vFlow * fract(ph + 0.5) * 8.0 + vec2(3.7, 1.3);
          vec4 n1 = texture2D(uNoise, p1 * 0.085 + vec2(uTime * 0.011, uTime * 0.007));
          vec4 n2 = texture2D(uNoise, p2 * 0.085 - vec2(uTime * 0.009, -uTime * 0.012));
          vec4 na = mix(n1, n2, bl);
          vec4 nb = texture2D(uNoise, vW.xz * 0.23 + vec2(-uTime * 0.021, uTime * 0.017));
          vec2 slope = (na.rg * 2.0 - 1.0) * 0.7 + (nb.rg * 2.0 - 1.0) * 0.45;
          vec3 N = normalize(vec3(-slope.x * 0.55, 1.0, -slope.y * 0.55));
          vec3 V = normalize(cameraPosition - vW);
          float deep = smoothstep(0.03, 0.5, depth);
          vec3 col = mix(uShallow, uDeep, deep);
          // reflets du ciel : bandes claires des vaguelettes (plutôt que du bruit fin)
          float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
          float glint = smoothstep(0.62, 0.8, na.b * 0.65 + nb.b * 0.5);
          col = mix(col, uSky, 0.08 + fres * 0.45 + glint * 0.22);
          float caus = smoothstep(0.6, 0.82, nb.b + na.b * 0.4 - 0.2) * (1.0 - deep);
          col += vec3(0.2, 0.28, 0.18) * caus * 0.55;
          vec3 Hh = normalize(uSun + V);
          float spec = pow(max(dot(N, Hh), 0.0), 90.0);
          col += uSunCol * spec * 0.9;
          // écume : liseré au rivage et vaguelettes qui viennent mourir
          float shore = 1.0 - smoothstep(0.0, 0.05, depth);
          float lines = smoothstep(0.6, 0.85, sin(depth * 48.0 - uTime * 2.2 + nb.b * 4.0) * 0.5 + 0.5) * (1.0 - smoothstep(0.02, 0.13, depth));
          float foam = max(shore * (0.6 + 0.4 * na.a), lines * 0.6 * nb.a);
          foam *= smoothstep(0.2, 0.5, na.a + 0.25);
          col = mix(col, uFoam, clamp(foam, 0.0, 0.9));
          col *= mix(0.6, 1.0, texture2D(uShadowTex, uv).r);
          float alpha = mix(0.66, 0.94, deep);
          alpha = max(alpha, foam);
          // estran découvert : plus d'eau ; ligne d'écume qui avance ou recule pendant la marée
          alpha *= 1.0 - dryK;
          float tl = tideLine * (0.7 + 0.3 * na.a);
          col = mix(col, uFoam, clamp(tl * 1.4, 0.0, 0.97));
          alpha = max(alpha, tl * 0.95);
          vec2 ptOut = max(max(uMapRect.xy - vW.xz, vW.xz - uMapRect.zw), 0.0);
          col *= mix(1.0, 0.5, smoothstep(0.0, 13.0, length(ptOut)));
          vec4 ov = ptOverlay(vW.xz);
          col = mix(col, ov.rgb, ov.a);
          alpha = max(alpha, ov.a * (1.0 - dryK));
          if (alpha < 0.004) discard;
          gl_FragColor = vec4(col, alpha);
          #include <tonemapping_fragment>
          #include <encodings_fragment>
        }`,
    });
    const mesh = new THREE.Mesh(g, mat);
    mesh.name = "Eau";
    mesh.renderOrder = 2;
    this.root.add(mesh);
    this.water = mesh;
    this.disposables.push(g, mat);
  };

  /* ------------------------------------------------------------------ ponts */
  W.buildBridges = function () {
    const f = this.field;
    const seen = new Set();
    const parts = [];
    const box = (w, h, d, x, y, z, color, ry) => {
      const g = new THREE.BoxGeometry(w, h, d);
      if (ry) g.rotateY(ry);
      g.translate(x, y, z);
      parts.push({ g, color, shade: 0.25 });
    };
    for (let j = 0; j < MH; j++)
      for (let i = 0; i < MW; i++) {
        if (f.charAt(i, j) !== "=" || seen.has(i + "," + j)) continue;
        // tronçon de ponts consécutifs, orienté selon les chemins qui l'encadrent
        const walk = (a, b) => WALK.includes(f.charAt(a, b) || "x");
        const alongX = !(f.charAt(i, j + 1) === "=" || f.charAt(i, j - 1) === "=") && (walk(i - 1, j) || walk(i + 1, j) || !(walk(i, j - 1) || walk(i, j + 1)));
        let len = 0;
        while (f.charAt(i + (alongX ? len : 0), j + (alongX ? 0 : len)) === "=") {
          seen.add(i + (alongX ? len : 0) + "," + (j + (alongX ? 0 : len)));
          len++;
        }
        const cx = alongX ? i + len / 2 : i + 0.5, cy = alongX ? j + 0.5 : j + len / 2;
        const L = (len + 0.5) * TILE, Wd = 0.78 * TILE;
        const X = toX(cx), Z = toZ(cy);
        const ry = alongX ? Math.PI / 2 : 0; // axe local Z = long du pont
        const put = (w, h, d, lx, y, lz, color) => {
          const c = Math.cos(ry), s = Math.sin(ry);
          box(w, h, d, X + lx * c + lz * s, y, Z - lx * s + lz * c, color, ry);
        };
        // planches
        const nPl = Math.round(L / 0.42);
        for (let k = 0; k < nPl; k++) {
          const lz = -L / 2 + (k + 0.5) * (L / nPl);
          put(Wd + (k % 3 === 1 ? 0.12 : 0), 0.16, L / nPl - 0.05, 0, DECK_Y - 0.08, lz, k % 2 ? "#9a6e44" : "#8a603a");
        }
        // poutres, garde-corps, poteaux
        for (const sx of [-1, 1]) {
          put(0.22, 0.26, L, sx * (Wd / 2 - 0.1), DECK_Y - 0.26, 0, "#5e4028");
          put(0.14, 0.14, L - 0.3, sx * (Wd / 2), DECK_Y + 0.72, 0, "#7a5434");
          const np = Math.max(2, Math.round(L / 1.5));
          for (let k = 0; k <= np; k++) {
            const lz = -L / 2 + 0.2 + (k * (L - 0.4)) / np;
            put(0.16, 0.95, 0.16, sx * (Wd / 2), DECK_Y + 0.3, lz, "#5e4028");
          }
          for (let k = 0; k < Math.max(1, Math.round(L / TILE)); k++) {
            const lz = -L / 2 + ((k + 0.5) * L) / Math.max(1, Math.round(L / TILE));
            put(0.24, 1.3, 0.24, sx * (Wd / 2 - 0.1), -0.55, lz, "#4a3220");
          }
        }
      }
    if (!parts.length) return;
    const g = mergeParts(parts);
    const mat = PTMT.mat("view:bridge", () => new THREE.MeshLambertMaterial({ vertexColors: true }));
    const mesh = new THREE.Mesh(g, mat);
    mesh.name = "Ponts";
    mesh.castShadow = this.high;
    mesh.receiveShadow = true;
    this.root.add(mesh);
    this.disposables.push(g);
  };

  /* ------------------------------------------------------------------ au-delà du tablier */
  W.buildBackground = function () {
    // Au-delà du tablier (écrans très allongés, téléphone en portrait) : une canopée continue vue
    // d'avion, peinte une fois (cimes rondes ombrées), à hauteur des houppiers du tablier.
    const S = 256, cv = makeCanvas(S, S), c = cv.getContext("2d");
    const rng = PTMT.rng(4242);
    c.fillStyle = "#1c3016";
    c.fillRect(0, 0, S, S);
    const crowns = [];
    for (let i = 0; i < 70; i++) crowns.push([rng() * S, rng() * S, 14 + rng() * 16, rng()]);
    crowns.sort((a, b) => a[1] - b[1]);
    for (const [x, y, r, k] of crowns)
      wrapAt(S, x, y, r + 4, (px, py) => {
        c.fillStyle = "rgba(8,16,6,0.55)";
        c.beginPath();
        c.arc(px + r * 0.25, py + r * 0.3, r, 0, Math.PI * 2);
        c.fill();
        const g = c.createRadialGradient(px - r * 0.35, py - r * 0.4, r * 0.1, px, py, r);
        g.addColorStop(0, k < 0.3 ? "#4f7a30" : k < 0.7 ? "#3f6a2a" : "#34592a");
        g.addColorStop(1, "#1f3a18");
        c.fillStyle = g;
        c.beginPath();
        c.arc(px, py, r, 0, Math.PI * 2);
        c.fill();
      });
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.encoding = THREE.sRGBEncoding;
    tex.repeat.set(900 / 16, 900 / 16);
    const g = new THREE.PlaneGeometry(900, 900);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.MeshBasicMaterial({ map: tex, color: lin("#8a9a86") });
    const mesh = new THREE.Mesh(g, m);
    mesh.position.y = 2.6;
    mesh.name = "Lointain";
    // trou au centre : la canopée ne passe pas sous le tablier
    const f = this.field;
    const hw = (f.EW / 2 - 0.6) * TILE, hh = (f.EH / 2 - 0.6) * TILE;
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uHole = { value: new THREE.Vector2(hw, hh) };
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec2 vWxz;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvWxz = (modelMatrix * vec4(position, 1.0)).xz;");
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying vec2 vWxz;\nuniform vec2 uHole;")
        .replace("#include <clipping_planes_fragment>", "#include <clipping_planes_fragment>\nif (abs(vWxz.x) < uHole.x && abs(vWxz.y) < uHole.y) discard;");
    };
    this.root.add(mesh);
    this.disposables.push(g, m, tex);
  };

  /* ------------------------------------------------------------------ outils des lots */
  const _m4 = new THREE.Matrix4(), _q4 = new THREE.Quaternion(), _q5 = new THREE.Quaternion();
  const _p4 = new THREE.Vector3(), _s4 = new THREE.Vector3(), _ax = new THREE.Vector3(), _UP = new THREE.Vector3(0, 1, 0);
  const _c4 = new THREE.Color();
  /** Géométrie colorée (attribut color, ombrage vers le bas). */
  function colorize(g, hex, shade) {
    if (g.index) g = g.toNonIndexed();
    g.computeVertexNormals();
    const P = g.attributes.position, n = P.count, col = new Float32Array(n * 3), c = lin(hex);
    let ymin = Infinity, ymax = -Infinity;
    for (let i = 0; i < n; i++) {
      ymin = Math.min(ymin, P.getY(i));
      ymax = Math.max(ymax, P.getY(i));
    }
    for (let i = 0; i < n; i++) {
      const k = shade ? 1 - shade * (1 - (P.getY(i) - ymin) / Math.max(1e-3, ymax - ymin)) : 1;
      col[i * 3] = c.r * k;
      col[i * 3 + 1] = c.g * k;
      col[i * 3 + 2] = c.b * k;
    }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return g;
  }
  /** Fusion de géométries colorées placées par des matrices : [{ g, m, tint }] → une géométrie. */
  function mergeColored(list) {
    let n = 0;
    for (const it of list) n += it.g.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
    const v = new THREE.Vector3(), nm = new THREE.Matrix3();
    let o = 0;
    for (const it of list) {
      const P = it.g.attributes.position, N = it.g.attributes.normal, Cc = it.g.attributes.color;
      nm.getNormalMatrix(it.m);
      const t = it.tint || 1;
      for (let i = 0; i < P.count; i++) {
        v.fromBufferAttribute(P, i).applyMatrix4(it.m);
        pos[(o + i) * 3] = v.x;
        pos[(o + i) * 3 + 1] = v.y;
        pos[(o + i) * 3 + 2] = v.z;
        v.fromBufferAttribute(N, i).applyMatrix3(nm).normalize();
        nor[(o + i) * 3] = v.x;
        nor[(o + i) * 3 + 1] = v.y;
        nor[(o + i) * 3 + 2] = v.z;
        col[(o + i) * 3] = (Cc ? Cc.getX(i) : 1) * t;
        col[(o + i) * 3 + 1] = (Cc ? Cc.getY(i) : 1) * t;
        col[(o + i) * 3 + 2] = (Cc ? Cc.getZ(i) : 1) * t;
      }
      o += P.count;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    g.computeBoundingSphere();
    return g;
  }
  /** Couleur d'instance uniforme (une matière partagée exige que tous ses lots en aient une). */
  function fillColor(mesh, k) {
    for (let i = 0; i < mesh.count; i++) mesh.setColorAt(i, _c4.setRGB(k, k, k));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }
  MK.fillColor = fillColor;
  MK.colorize = colorize;
  MK.mergeColored = mergeColored;
  const mat4 = (x, y, z, ry, s, sy) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(_UP, ry || 0), new THREE.Vector3(s || 1, (s || 1) * (sy || 1), s || 1));
  /** Un seul maillage (couleurs par sommet) à partir de pièces [{ g, color, m, shade }]. */
  function buildMerged(parts, name) {
    const list = parts.map((p) => ({ g: colorize(p.g, p.color, p.shade || 0), m: p.m || new THREE.Matrix4() }));
    const g = mergeColored(list);
    g.setAttribute("sway", new THREE.BufferAttribute(new Float32Array(g.attributes.position.count), 1));
    const mesh = new THREE.Mesh(g, PTMT.mat("view:merged", () => new THREE.MeshLambertMaterial({ vertexColors: true })));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = name || "Pièces";
    return mesh;
  }
  MK.buildMerged = buildMerged;
  const T4 = (x, y, z, rx, ry, rz, sx, sy, sz) => new THREE.Matrix4().compose(new THREE.Vector3(x || 0, y || 0, z || 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0)), new THREE.Vector3(sx || 1, sy || sx || 1, sz || sx || 1));
  MK.T4 = T4;
  /** Objet 3D d'un modèle fourni (objet, poignée { object }, ou rien). */
  function objOf(r) {
    if (!r) return null;
    if (r.isObject3D) return r;
    return r.object && r.object.isObject3D ? r.object : null;
  }
  MK.objOf = objOf;
  /** Appelle un constructeur de modèle optionnel sans jamais faire échouer la carte. */
  function tryModel(name, ...args) {
    const f = PTMT.models && PTMT.models[name];
    if (typeof f !== "function") return null;
    try {
      const r = f(...args);
      return objOf(r) ? r : null;
    } catch (e) {
      console.warn("PTMT.models." + name + " indisponible :", e);
      return null;
    }
  }
  MK.tryModel = tryModel;
  const GEM_HEX = ["#ff2b45", "#2df27c", "#4290ff", "#c95cff", "#ffa524", "#e8fbff"];
  MK.GEM_HEX = GEM_HEX;

  /* ------------------------------------------------------------------ taches d'ombre douces */
  // Lot unique de taches sombres posées au sol (mélange multiplicatif) : ombres des forêts, des
  // tours et des gemmes en qualité « low » (sans carte d'ombres), ombre de contact partout.
  W.buildBlobs = function () {
    const cap = 700;
    const g = new THREE.PlaneGeometry(1, 1);
    g.rotateX(-Math.PI / 2);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.MultiplyBlending,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
      vertexShader: /* glsl */ `
        varying vec2 vUv; varying float vK;
        void main() {
          vUv = uv;
          vK = instanceColor.r;
          gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        varying vec2 vUv; varying float vK;
        void main() {
          float d = length(vUv - 0.5) * 2.0;
          float a = (1.0 - smoothstep(0.3, 1.0, d)) * vK;
          gl_FragColor = vec4(mix(vec3(1.0), vec3(0.32, 0.36, 0.28), a), 1.0);
        }`,
    });
    const mesh = new THREE.InstancedMesh(g, mat, cap);
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.renderOrder = 1;
    mesh.name = "Taches d'ombre";
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.root.add(mesh);
    this.blobMesh = mesh;
    this.blobFree = [];
    this.blobArgs = [];
    this.disposables.push(g, mat);
  };
  /** Ajoute une tache (monde : X, Z, hauteur y, rayons rx, rz, force 0..1, décalage off en m du côté
   *  opposé au soleil — suivi quand le soleil tourne) ; renvoie son indice. */
  W.addBlob = function (X, Z, y, rx, rz, k, off) {
    const m = this.blobMesh;
    if (!m) return -1;
    let i = this.blobFree.length ? this.blobFree.pop() : m.count < m.instanceMatrix.count ? m.count++ : -1;
    if (i < 0) return -1;
    this.setBlob(i, X, Z, y, rx, rz, k, off);
    return i;
  };
  W.setBlob = function (i, X, Z, y, rx, rz, k, off) {
    const m = this.blobMesh;
    if (!m || i < 0) return;
    const a = this.blobArgs[i] || (this.blobArgs[i] = new Float32Array(7));
    a[0] = X; a[1] = Z; a[2] = y; a[3] = rx; a[4] = rz; a[5] = k; a[6] = off || 0;
    this.placeBlob(i);
  };
  W.placeBlob = function (i) {
    const m = this.blobMesh, a = this.blobArgs[i];
    const d = this.sunDirH(), off = a[6];
    _m4.compose(_p4.set(a[0] - d.x * off, a[2] + 0.04, a[1] - d.z * off), _q4.identity(), _s4.set(Math.max(0.001, a[3] * 2), 1, Math.max(0.001, a[4] * 2)));
    m.setMatrixAt(i, _m4);
    m.instanceColor.setXYZ(i, a[5], a[5], a[5]);
    m.instanceMatrix.needsUpdate = true;
    m.instanceColor.needsUpdate = true;
  };
  W.removeBlob = function (i) {
    if (i < 0 || !this.blobMesh) return;
    this.setBlob(i, 0, 0, -50, 0, 0, 0, 0);
    this.blobFree.push(i);
  };

  /* ------------------------------------------------------------------ forêts à couper (secours) */
  // Quatre sortes de cases boisées : feuillus (herbe), pins et blocs (roche), roseaux et nénuphars
  // (eau), pins et feuillus (butte). Un lot instancié par essence ; cut(clé) fait trembler les
  // arbres sous les coups de hache, les couche, les efface et laisse des souches.
  function FallbackForests(list, world) {
    this.world = world;
    this.object = new THREE.Group();
    this.object.name = "Forêts (secours)";
    this.tiles = new Map();
    const slots = [];
    const detail = world.high ? 1 : 0;
    const add = (tile, sp, dx, dz, s, v) => {
      const sl = { tile, sp, v: v || 0, x: tile.x + dx, z: tile.z + dz, y: tile.y, s, r: tile.rng() * 6.28, phase: tile.rng() * 6.28 };
      if (sp === "lily") sl.y = WATER_Y + 0.02;
      else if (sp === "reeds") sl.y = Math.max(WATER_Y - 0.25, world.field.heightAt(sl.x / TILE + MW / 2, sl.z / TILE + MH / 2) - 0.05);
      else sl.y = world.field.heightAt(sl.x / TILE + MW / 2, sl.z / TILE + MH / 2) - 0.08;
      tile.slots.push(sl);
      slots.push(sl);
    };
    for (const it of list) {
      const rng = PTMT.rng(it.seed | 0);
      const tile = { key: it.key, kind: it.kind, x: it.x, z: it.z, y: it.y, rng, slots: [], state: "up", t: 0, dir: rng() * 6.28 };
      this.tiles.set(it.key, tile);
      const j = () => (rng() - 0.5) * 0.45;
      if (it.kind === "grass") {
        const sp = () => (rng() < 0.6 ? "oak" : "chestnut");
        add(tile, sp(), -0.75 + j(), -0.55 + j(), 0.7 + rng() * 0.2, (rng() * 2) | 0);
        add(tile, sp(), 0.8 + j(), -0.3 + j(), 0.72 + rng() * 0.2, (rng() * 2) | 0);
        add(tile, sp(), -0.05 + j(), 0.75 + j(), 0.66 + rng() * 0.22, (rng() * 2) | 0);
        add(tile, "bush", 0.85 + j(), 0.95 + j(), 0.9 + rng() * 0.3);
        if (rng() < 0.6) add(tile, "bush", -1.0 + j(), 0.6 + j(), 0.8 + rng() * 0.3);
      } else if (it.kind === "rock") {
        add(tile, "pine", -0.6 + j(), -0.45 + j(), 0.75 + rng() * 0.2, (rng() * 2) | 0);
        add(tile, "pine", 0.65 + j(), 0.35 + j(), 0.68 + rng() * 0.22, (rng() * 2) | 0);
        add(tile, "boulder", 0.7 + j(), -0.75 + j(), 0.9 + rng() * 0.3, (rng() * 2) | 0);
        add(tile, "boulder", -0.75 + j(), 0.75 + j(), 0.7 + rng() * 0.3, (rng() * 2) | 0);
      } else if (it.kind === "reeds") {
        for (const [dx, dz] of [[-0.8, -0.7], [0.8, -0.55], [-0.6, 0.75], [0.75, 0.8], [0, 0]]) add(tile, "reeds", dx + j(), dz + j(), 0.85 + rng() * 0.3, (rng() * 2) | 0);
        add(tile, "lily", 0.1 + j(), -0.9 + j(), 0.9 + rng() * 0.3, (rng() * 2) | 0);
        add(tile, "lily", -1.0 + j(), 0.05 + j(), 0.8 + rng() * 0.3, (rng() * 2) | 0);
      } else {
        add(tile, "pine", -0.55 + j(), -0.45 + j(), 0.72 + rng() * 0.2, (rng() * 2) | 0);
        add(tile, rng() < 0.5 ? "oak" : "chestnut", 0.6 + j(), 0.45 + j(), 0.66 + rng() * 0.2, (rng() * 2) | 0);
        add(tile, "boulder", 0.75 + j(), -0.7 + j(), 0.7 + rng() * 0.2, 0);
      }
    }
    const byKey = new Map();
    for (const sl of slots) {
      const key = sl.sp + ":" + sl.v;
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(sl);
    }
    const mat = MK.treeMaterial("forest", world.uTime);
    this.meshes = [];
    for (const [key, arr] of byKey) {
      const [sp, v] = key.split(":");
      const mesh = new THREE.InstancedMesh(MK.treeGeo(sp, +v, sp === "boulder" ? 0 : detail), mat, arr.length);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.castShadow = world.high && sp !== "lily";
      mesh.receiveShadow = sp === "boulder";
      mesh.frustumCulled = false;
      mesh.name = "Forêt_" + key;
      arr.forEach((sl, i) => {
        sl.mesh = mesh;
        sl.index = i;
        const k = 0.9 + sl.phase * 0.03;
        mesh.setColorAt(i, _c4.setRGB(k, k, k));
      });
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      this.object.add(mesh);
      this.meshes.push(mesh);
    }
    // souches (cachées tant que la forêt est debout)
    const trees = slots.filter((s) => s.sp === "oak" || s.sp === "chestnut" || s.sp === "pine");
    this.stumps = new THREE.InstancedMesh(MK.treeGeo("stump", 0, 0), mat, Math.max(1, trees.length));
    this.stumps.frustumCulled = false;
    this.stumps.name = "Souches";
    fillColor(this.stumps, 1);
    trees.forEach((s, i) => (s.stump = i));
    this.object.add(this.stumps);
    for (const t of this.tiles.values()) this.place(t, 0);
    for (const m of this.meshes) m.instanceMatrix.needsUpdate = true;
    this.stumps.instanceMatrix.needsUpdate = true;
    this.active = new Set();
  }
  FallbackForests.prototype.place = function (t, time) {
    const falling = t.state === "fall";
    const k = falling ? clamp((t.t - 0.55) / 0.7, 0, 1) : 0;
    const ang = falling ? k * k * 1.5 : 0;
    const shrink = falling ? clamp(1 - (t.t - 1.35) / 0.35, 0, 1) : 1;
    const gone = t.state === "gone";
    for (const sl of t.slots) {
      _q4.setFromAxisAngle(_UP, sl.r);
      let s = sl.s;
      if (t.state === "fall" && t.t < 0.55) {
        // coups de hache : les arbres frémissent
        const a = Math.sin(time * 40 + sl.phase) * 0.06 * (1 - (t.t % 0.18) / 0.18);
        _ax.set(Math.cos(sl.phase), 0, Math.sin(sl.phase));
        _q5.setFromAxisAngle(_ax, a);
        _q4.premultiply(_q5);
      } else if (falling) {
        _ax.set(Math.cos(t.dir + sl.phase * 0.2), 0, Math.sin(t.dir + sl.phase * 0.2));
        _q5.setFromAxisAngle(_ax, sl.sp === "boulder" || sl.sp === "lily" ? 0 : ang);
        _q4.premultiply(_q5);
        s *= shrink;
      }
      if (gone) s = 0;
      _m4.compose(_p4.set(sl.x, sl.y, sl.z), _q4, _s4.setScalar(Math.max(0.0001, s)));
      sl.mesh.setMatrixAt(sl.index, _m4);
      sl.mesh.instanceMatrix.needsUpdate = true;
      if (sl.stump !== undefined) {
        const show = gone || (falling && t.t > 1.0);
        _q4.setFromAxisAngle(_UP, sl.r);
        _m4.compose(_p4.set(sl.x, sl.y, sl.z), _q4, _s4.setScalar(show ? sl.s * 1.5 : 0.0001));
        this.stumps.setMatrixAt(sl.stump, _m4);
        this.stumps.instanceMatrix.needsUpdate = true;
      }
    }
  };
  FallbackForests.prototype.cut = function (key) {
    const t = this.tiles.get(key);
    if (!t || t.state !== "up") return Promise.resolve();
    t.state = "fall";
    t.t = 0;
    t.beat = -1;
    this.active.add(t);
    return new Promise((res) => (t.resolve = res));
  };
  /** Case coupée d'avance (reprise de partie) : sans animation. */
  FallbackForests.prototype.clear = function (key) {
    const t = this.tiles.get(key);
    if (!t) return;
    t.state = "gone";
    this.place(t, 0);
  };
  FallbackForests.prototype.update = function (dt, time) {
    for (const t of this.active) {
      t.t += dt;
      const beat = Math.floor(t.t / 0.18);
      if (t.t < 0.55 && beat !== t.beat) {
        t.beat = beat;
        if (PTMT.fx && PTMT.fx.burst && PTMT.fx._ && PTMT.fx._.BURSTS && PTMT.fx._.BURSTS.woodChips) PTMT.fx.burst("woodChips", _p4.set(t.x, t.y + 0.8, t.z), { radius: 0.7, kind: t.kind });
      }
      if (t.t > 1.2 && !t.poof) {
        t.poof = true;
        if (PTMT.fx && PTMT.fx.burst && PTMT.fx._ && PTMT.fx._.BURSTS) {
          const B = PTMT.fx._.BURSTS;
          if (B.leafBurst) PTMT.fx.burst("leafBurst", _p4.set(t.x, t.y + 0.5, t.z), { radius: 1.2, kind: t.kind });
          else if (B.smoke) PTMT.fx.burst("smoke", _p4.set(t.x, t.y + 0.3, t.z), { radius: 1.2 });
        }
      }
      if (t.t >= 1.75) {
        t.state = "gone";
        this.active.delete(t);
        if (t.resolve) t.resolve();
      }
      this.place(t, time);
    }
  };

  /* ------------------------------------------------------------------ arbres, décor, cachettes… */
  W.buildObjects = function () {
    this.buildBlobs();
    // buttes d'abord : leur dessus sert aux forêts des cases « h » et aux tours
    if (this.buildButtes) this.buildButtes();
    this.buildForests();
    this.buildApronTrees();
    this.buildButteRocks();
    this.buildDecor();
    if (this.buildLairs) this.buildLairs();
    if (this.buildMill) this.buildMill();
    this.buildMenhirs();
    if (this.buildEntrances) this.buildEntrances();
    this.buildSecret();
    this.buildScatter();
  };

  W.buildForests = function () {
    const f = this.field, list = [];
    for (let j = 0; j < MH; j++)
      for (let i = 0; i < MW; i++) {
        const ch = f.grid[j][i];
        const kind = ch === "f" ? "grass" : ch === "r" ? "rock" : ch === "w" ? "reeds" : ch === "h" ? "high" : null;
        if (!kind) continue;
        list.push({ key: i + "," + j, kind, i, j, x: toX(i + 0.5), y: this.tileTop(i, j), z: toZ(j + 0.5), seed: (hash2(i, j, f.seed + 71) * 1e6) | 0 });
      }
    this.forestTiles = new Map(list.map((it) => [it.key, it]));
    this.forestBlobs = new Map();
    if (!list.length) return;
    let forests = tryModel("forests", list);
    if (!forests) forests = new FallbackForests(list, this);
    this.forests = forests;
    this.root.add(objOf(forests));
    // ombre douce sous chaque bosquet (qualité « low » : pas de carte d'ombres)
    if (!this.high)
      for (const it of list) {
        if (it.kind === "reeds") continue;
        this.forestBlobs.set(it.key, this.addBlob(it.x, it.z, it.y, 2.3, 2.1, 0.7, 0.9));
      }
  };
  /** Une tour se pose sur une case coupée : plus de souches. */
  W.clearForest = function (i, j) {
    const key = i + "," + j;
    if (!this.forestTiles || !this.forestTiles.has(key) || !this.forests) return;
    try {
      if (this.forests.clear) this.forests.clear(key);
    } catch (e) {}
  };
  W.sunDirH = function () {
    const d = this.sunDir || SUN_CAM;
    const l = Math.hypot(d.x, d.z) || 1;
    return { x: d.x / l, z: d.z / l };
  };
  /** Coupe la forêt d'une case (animation) ; renvoie une promesse. */
  W.cutForest = function (i, j) {
    const key = i + "," + j;
    const b = this.forestBlobs && this.forestBlobs.get(key);
    if (b !== undefined) {
      this.removeBlob(b);
      this.forestBlobs.delete(key);
    }
    if (!this.forests || !this.forests.cut) return Promise.resolve();
    try {
      return Promise.resolve(this.forests.cut(key));
    } catch (e) {
      return Promise.resolve();
    }
  };

  W.buildApronTrees = function () {
    const f = this.field, fine = this.fine, A = f.A;
    const at = (fld, x, y) => {
      const gx = Math.round((x + A) * fine.F), gy = Math.round((y + A) * fine.F);
      if (gx < 0 || gy < 0 || gx >= fine.nx || gy >= fine.ny) return 0;
      return fld[gy * fine.nx + gx];
    };
    const rng = PTMT.rng(f.seed + 404);
    const lists = { oak: [], chestnut: [], pine: [], bush: [] };
    const dens = this.mobile ? 1.35 : 2.3;
    this.staticShadowCasters = this.staticShadowCasters || [];
    for (let j = -A; j < MH + A; j++)
      for (let i = -A; i < MW + A; i++) {
        if (i >= 0 && j >= 0 && i < MW && j < MH) continue;
        if (f.clsAt(i, j) !== C.WILD) continue;
        const n = Math.floor(dens + rng());
        for (let q = 0; q < n; q++) {
          const x = i + 0.1 + rng() * 0.8, y = j + 0.1 + rng() * 0.8;
          const out = Math.max(-x, x - MW, -y, y - MH);
          if (out < 0.4) continue;
          if (at(fine.road, x, y) > 0.05 || at(fine.water, x, y) > 0.05 || at(fine.field, x, y) > 0.2) continue;
          const r = rng();
          const sp = r < 0.42 ? "oak" : r < 0.7 ? "chestnut" : r < 0.93 ? "pine" : "bush";
          const dark = 0.9 - 0.3 * smooth01(out / 3.5);
          // qualité « low » : une seule variante par essence (moins d'appels de dessin)
          lists[sp].push({ x, y, s: (sp === "bush" ? 1.2 : 0.8) + rng() * 0.35, r: rng() * 6.28, v: this.high ? (rng() * 2) | 0 : 0, k: dark * (0.9 + rng() * 0.15) });
          if (sp !== "bush") this.staticShadowCasters.push({ x, y, r: 0.55, h: 3.2 });
        }
      }
    // haies du bocage autour des champs du tablier
    const segs = contourSegs(fine.field, fine.nx, fine.ny, 0.5, 1 / fine.F);
    let acc = 0;
    const gap = this.mobile ? 0.62 : 0.42;
    for (let k = 0; k < segs.length; k += 4) {
      acc += Math.hypot(segs[k + 2] - segs[k], segs[k + 3] - segs[k + 1]);
      if (acc < gap) continue;
      acc = 0;
      const x = segs[k] - A, y = segs[k + 1] - A;
      const out = Math.max(-x, x - MW, -y, y - MH);
      if (out < 0.3 || at(fine.road, x, y) > 0.1 || at(fine.water, x, y) > 0.1) continue;
      lists.bush.push({ x, y, s: 0.8 + rng() * 0.5, r: rng() * 6.28, v: 0, k: 0.75 + rng() * 0.15 });
    }
    const mat = MK.treeMaterial("apron", this.uTime);
    this.apronMeshes = [];
    for (const sp of Object.keys(lists)) {
      for (const v of [0, 1]) {
        const arr = lists[sp].filter((t) => (sp === "bush" ? true : t.v === v));
        if (sp === "bush" && v === 1) continue;
        if (!arr.length) continue;
        const mesh = new THREE.InstancedMesh(MK.treeGeo(sp, v, 0), mat, arr.length);
        arr.forEach((t, i) => {
          _q4.setFromAxisAngle(_UP, t.r);
          _m4.compose(_p4.set(toX(t.x), f.heightAt(t.x, t.y) - 0.1, toZ(t.y)), _q4, _s4.setScalar(t.s));
          mesh.setMatrixAt(i, _m4);
          mesh.setColorAt(i, _c4.setRGB(t.k, t.k * 0.97, t.k * 0.93));
        });
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        mesh.frustumCulled = false;
        mesh.castShadow = false;
        mesh.name = "Tablier_" + sp;
        this.root.add(mesh);
        this.apronMeshes.push(mesh);
      }
    }
  };

  /** Rochers de granit posés le long des flancs des buttes (flancs rocheux en relief). */
  W.buildButteRocks = function () {
    const f = this.field, fine = this.fine, A = f.A;
    const segs = contourSegs(fine.high, fine.nx, fine.ny, 0.22, 1 / fine.F);
    if (!segs.length) return;
    const rng = PTMT.rng(f.seed + 505);
    const list = [];
    let acc = 0;
    for (let k = 0; k < segs.length; k += 4) {
      const x0 = segs[k] - A, y0 = segs[k + 1] - A, x1 = segs[k + 2] - A, y1 = segs[k + 3] - A;
      acc += Math.hypot(x1 - x0, y1 - y0);
      if (acc < 0.34 + rng() * 0.2) continue;
      acc = 0;
      const x = x0 + (rng() - 0.5) * 0.06, y = y0 + (rng() - 0.5) * 0.06;
      list.push({ x, y, s: 0.55 + rng() * 0.45, r: rng() * 6.28, v: this.high ? (rng() * 2) | 0 : 0 });
    }
    const mat = MK.treeMaterial("rocks", this.uTime);
    for (const v of [0, 1]) {
      const arr = list.filter((t) => t.v === v);
      if (!arr.length) continue;
      const mesh = new THREE.InstancedMesh(MK.treeGeo("stone", v, 0), mat, arr.length);
      arr.forEach((t, i) => {
        _q4.setFromAxisAngle(_UP, t.r);
        _m4.compose(_p4.set(toX(t.x), f.heightAt(t.x, t.y) - 0.42 * t.s, toZ(t.y)), _q4, _s4.set(t.s * 1.2, t.s * 1.1, t.s * 1.2));
        mesh.setMatrixAt(i, _m4);
        const k = 0.85 + rng() * 0.25;
        mesh.setColorAt(i, _c4.setRGB(k, k, k * 0.98));
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.frustumCulled = false;
      mesh.castShadow = this.high;
      mesh.receiveShadow = true;
      mesh.name = "Rochers des buttes";
      this.root.add(mesh);
    }
  };

  /* ------------------------------------------------------------------ décor des cases X */
  function houseParts(list, m, big) {
    const k = big ? 1.25 : 1;
    const put = (g, hex, shade, lm) => list.push({ g: colorize(g, hex, shade), m: new THREE.Matrix4().multiplyMatrices(m, lm || new THREE.Matrix4()) });
    const T = (x, y, z, rx, ry, rz, sx, sy, sz) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0)), new THREE.Vector3(sx || 1, sy || 1, sz || 1));
    put(new THREE.BoxGeometry(3.0 * k, 2.1 * k, 2.3 * k), "#b3aa98", 0.25, T(0, 1.05 * k, 0));
    // pignons : prisme triangulaire en granit, puis deux pans d'ardoise
    const sh = new THREE.Shape();
    sh.moveTo(-1.15 * k, 0);
    sh.lineTo(1.15 * k, 0);
    sh.lineTo(0, 1.15 * k);
    sh.closePath();
    const gable = new THREE.ExtrudeGeometry(sh, { depth: 2.9 * k, bevelEnabled: false });
    gable.translate(0, 0, -1.45 * k);
    gable.rotateY(Math.PI / 2);
    put(gable, "#a9a08e", 0.1, T(0, 2.1 * k, 0));
    for (const sgn of [-1, 1]) put(new THREE.BoxGeometry(3.3 * k, 0.14, 1.72 * k), sgn > 0 ? "#566170" : "#4a5462", 0, T(0, 2.1 * k + 0.6 * k, sgn * 0.6 * k, sgn * 0.78, 0, 0));
    put(new THREE.BoxGeometry(0.42, 1.1 * k, 0.42), "#9d9484", 0.2, T(1.0 * k, 2.9 * k, -0.2));
    put(new THREE.BoxGeometry(0.72, 1.25, 0.06), "#6a4428", 0, T(0.35 * k, 0.63, 1.16 * k));
    for (const wx of [-0.8, 1.05]) {
      put(new THREE.BoxGeometry(0.52, 0.5, 0.06), "#f2ead8", 0, T(wx * k - 0.35 * (wx > 0 ? 1 : 0), 1.35 * k, 1.16 * k));
      put(new THREE.BoxGeometry(0.4, 0.38, 0.07), "#3d5a78", 0, T(wx * k - 0.35 * (wx > 0 ? 1 : 0), 1.35 * k, 1.17 * k));
    }
  }
  MK.houseParts = houseParts;
  W.buildDecor = function () {
    const f = this.field, rng = PTMT.rng(f.seed + 606);
    const items = [];
    this.staticShadowCasters = this.staticShadowCasters || [];
    const road = (i, j) => {
      const c = f.charAt(i, j);
      return c && WALK.includes(c);
    };
    for (let j = 0; j < MH; j++)
      for (let i = 0; i < MW; i++) {
        if (f.grid[j][i] !== "X") continue;
        const kind = f.kindAt(i, j);
        if (kind === "mill") continue;
        // orientation : vers le chemin voisin (maisons), sinon selon l'alignement des cases X
        let rot = 0;
        const dirs = [[0, 1, 0], [1, 0, Math.PI / 2], [0, -1, Math.PI], [-1, 0, -Math.PI / 2]];
        const rd = dirs.find(([di, dj]) => road(i + di, j + dj));
        if (rd) rot = rd[2];
        else {
          const hx = (f.charAt(i - 1, j) === "X") + (f.charAt(i + 1, j) === "X"), vy = (f.charAt(i, j - 1) === "X") + (f.charAt(i, j + 1) === "X");
          rot = vy > hx ? Math.PI / 2 : 0;
        }
        const same = (a, b) => f.charAt(a, b) === "X" && f.kindAt(a, b) === kind;
        const link = (same(i + 1, j) ? 1 : 0) | (same(i, j + 1) ? 2 : 0) | (same(i - 1, j) ? 4 : 0) | (same(i, j - 1) ? 8 : 0);
        items.push({ kind, i, j, x: toX(i + 0.5), y: f.heightAt(i + 0.5, j + 0.5), z: toZ(j + 0.5), rot, seed: (hash2(i, j, 99) * 1e6) | 0, link });
        const hh = kind === "house" || kind === "chapel" ? 4 : kind === "talus" ? 2.2 : kind === "calvaire" ? 2.5 : 1.4;
        this.staticShadowCasters.push({ x: i + 0.5, y: j + 0.5, r: 0.55, h: hh });
      }
    this.decorItems = items;
    if (!items.length) return;
    const got = tryModel("decorBatch", items);
    if (got) {
      this.decor = got;
      this.root.add(objOf(got));
      return;
    }
    // secours : une géométrie fusionnée pour tout le décor
    const list = [];
    const tree = (sp, v, x, y, z, s, ry, sy) => list.push({ g: MK.treeGeo(sp, v, 0), m: mat4(x, y, z, ry, s, sy) });
    for (const it of items) {
      const r = PTMT.rng(it.seed);
      const m = mat4(it.x, it.y, it.z, it.rot, 1);
      const J = () => (r() - 0.5) * 0.5;
      switch (it.kind) {
        case "house":
        case "chapel":
          houseParts(list, m, it.kind === "chapel");
          tree("bush", 0, it.x + 1.4, it.y, it.z + 1.2, 0.9);
          break;
        case "calvaire": {
          const put = (g, hex, lm) => list.push({ g: colorize(g, hex, 0.2), m: new THREE.Matrix4().multiplyMatrices(m, lm) });
          put(new THREE.BoxGeometry(1.3, 0.3, 1.3), "#a39c8e", mat4(0, 0.15, 0));
          put(new THREE.BoxGeometry(0.9, 0.3, 0.9), "#aaa395", mat4(0, 0.45, 0));
          put(new THREE.BoxGeometry(0.26, 2.3, 0.26), "#b1aa9c", mat4(0, 1.7, 0));
          put(new THREE.BoxGeometry(1.1, 0.24, 0.24), "#b1aa9c", mat4(0, 2.35, 0));
          tree("bush", 0, it.x - 1.1, it.y, it.z + 0.9, 0.8);
          break;
        }
        case "boulders":
          tree("boulder", 0, it.x - 0.6 + J(), it.y - 0.2, it.z - 0.4 + J(), 1.5 + r() * 0.4, r() * 6);
          tree("boulder", 1, it.x + 0.7 + J(), it.y - 0.2, it.z + 0.5 + J(), 1.2 + r() * 0.4, r() * 6);
          if (r() < 0.6) tree("boulder", 0, it.x + 0.4 + J(), it.y - 0.1, it.z - 0.9 + J(), 0.8, r() * 6);
          break;
        case "cliff":
          for (let q = 0; q < 3; q++) tree("boulder", q % 2, it.x + (q - 1) * 1.0 + J(), it.y - 0.3, it.z + J(), 1.5 + r() * 0.3, r() * 6, 1.5);
          break;
        case "pond_rocks":
          tree("boulder", 0, it.x - 0.5 + J(), it.y - 0.2, it.z - 0.3 + J(), 1.3, r() * 6);
          tree("boulder", 1, it.x + 0.7 + J(), it.y - 0.2, it.z + 0.6 + J(), 1.0, r() * 6);
          tree("reeds", 0, it.x + 0.8, it.y - 0.1, it.z - 0.8, 0.9, r() * 6);
          tree("reeds", 1, it.x - 0.9, it.y - 0.1, it.z + 0.8, 0.8, r() * 6);
          break;
        case "haystack": {
          const g = new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
          list.push({ g: colorize(g, "#d8b64e", 0.3), m: new THREE.Matrix4().multiplyMatrices(m, mat4(0, 0, 0, 0, 1.2, 1.1)) });
          break;
        }
        case "well": {
          const put = (g, hex, lm) => list.push({ g: colorize(g, hex, 0.2), m: new THREE.Matrix4().multiplyMatrices(m, lm) });
          put(new THREE.CylinderGeometry(0.75, 0.8, 0.8, 12), "#a39c8e", mat4(0, 0.4, 0));
          put(new THREE.CylinderGeometry(0.55, 0.55, 0.05, 12), "#2b4a5a", mat4(0, 0.78, 0));
          for (const sx of [-0.7, 0.7]) put(new THREE.BoxGeometry(0.14, 1.7, 0.14), "#6b4a2e", mat4(sx, 0.85, 0));
          put(new THREE.ConeGeometry(1.0, 0.7, 4), "#4f5968", mat4(0, 1.95, 0, Math.PI / 4));
          break;
        }
        case "hedge":
          for (let q = 0; q < 4; q++) tree("bush", 0, it.x + (q - 1.5) * 0.85 * Math.cos(it.rot), it.y, it.z - (q - 1.5) * 0.85 * Math.sin(it.rot), 1.0 + r() * 0.3, r() * 6);
          break;
        default:
          // talus bocager : haie touffue et un petit chêne sur le dessus du talus
          for (let q = 0; q < 4; q++) {
            const a = (q / 4) * Math.PI * 2 + r();
            tree("bush", 0, it.x + Math.cos(a) * 0.9 + J(), it.y - 0.05, it.z + Math.sin(a) * 0.9 + J(), 1.1 + r() * 0.35, r() * 6);
          }
          tree(r() < 0.5 ? "oak" : "chestnut", (r() * 2) | 0, it.x + J(), it.y - 0.1, it.z + J(), 0.62 + r() * 0.15, r() * 6);
      }
    }
    const g = mergeColored(list);
    const mat = MK.treeMaterial("decor", this.uTime);
    const mesh = new THREE.Mesh(g, mat);
    mesh.castShadow = this.high;
    mesh.receiveShadow = true;
    mesh.name = "Décor (secours)";
    // pas de balancement pour les maisons : l'attribut sway manque, le shader lit 0
    g.setAttribute("sway", new THREE.BufferAttribute(new Float32Array(g.attributes.position.count), 1));
    this.root.add(mesh);
    this.decor = { object: mesh };
    this.disposables.push(g);
  };

  /* ------------------------------------------------------------------ gemmes de secours */
  function gemGeometry() {
    return PTMT.geo("view:gem", () => {
      // brillant : couronne à 8 facettes, pavillon pointu
      const pts = [new THREE.Vector2(0, -0.34), new THREE.Vector2(0.3, 0.02), new THREE.Vector2(0.22, 0.14), new THREE.Vector2(0.0, 0.16)];
      const g = new THREE.LatheGeometry(pts, 8);
      g.computeVertexNormals();
      return g.toNonIndexed();
    });
  }
  MK.gemGeometry = gemGeometry;
  function gemMaterial(color) {
    return PTMT.mat("view:gem:" + color, () => {
      const hex = GEM_HEX[color % GEM_HEX.length];
      return new THREE.MeshStandardMaterial({ color: lin(hex), emissive: lin(hex), emissiveIntensity: 0.55, roughness: 0.18, metalness: 0.1, flatShading: true });
    });
  }
  MK.gemMaterial = gemMaterial;
  /* ------------------------------------------------------------------ menhirs (puits de mana) */
  function FallbackMenhir() {
    const g = new THREE.Group();
    const stone = new THREE.DodecahedronGeometry(0.5, 0);
    stone.scale(0.9, 2.9, 0.7);
    lumpy(stone, 0.12, 3.3, 0, 1.25, 0, 1);
    const m = buildMerged([{ g: stone, color: "#a39d91", shade: 0.3 }], "Menhir");
    g.add(m);
    const runeMat = new THREE.MeshStandardMaterial({ color: lin("#5fd0ff"), emissive: lin("#3fb8ff"), emissiveIntensity: 0.6, roughness: 0.4 });
    const rl = [];
    for (let k = 0; k < 4; k++) rl.push({ g: new THREE.BoxGeometry(0.08, 0.34, 0.04), color: "#ffffff", m: T4(k % 2 ? 0.12 : -0.1, 0.55 + k * 0.45, 0.36, 0, 0, k % 2 ? 0.4 : -0.3) });
    const runes = new THREE.Mesh(mergeColored(rl.map((p) => ({ g: colorize(p.g, p.color), m: p.m }))), runeMat);
    g.add(runes);
    let on = false;
    return {
      object: g,
      setActive(a) {
        on = !!a;
      },
      update(dt, time) {
        runeMat.emissiveIntensity = on ? 1.6 + Math.sin(time * 4) * 0.5 : 0.45 + Math.sin(time * 1.5) * 0.15;
      },
    };
  }
  W.buildMenhirs = function () {
    this.menhirs = [];
    for (const [i, j] of this.map.mana || []) {
      const mh = tryModel("menhir") || FallbackMenhir();
      const o = objOf(mh);
      // au coin arrière-gauche de la case : la tour posée au centre ne le cache pas
      o.position.set(toX(i + 0.2), this.tileTop(i, j) - 0.05, toZ(j + 0.18));
      o.rotation.y = 0.35;
      o.scale.setScalar(0.85);
      this.root.add(o);
      this.menhirs.push({ i, j, model: mh });
      this.staticShadowCasters = this.staticShadowCasters || [];
      this.staticShadowCasters.push({ x: i + 0.2, y: j + 0.18, r: 0.2, h: 2.4 });
    }
  };

  /* ------------------------------------------------------------------ passage secret */
  // Fourré dense de ronces et de buissons sur les cases « s » ; open() écarte les buissons de part
  // et d'autre du sentier (1,2 s) quand le passage s'ouvre.
  W.buildSecret = function () {
    const f = this.field, rng = PTMT.rng(f.seed + 808);
    const slots = [];
    for (let j = 0; j < MH; j++)
      for (let i = 0; i < MW; i++) {
        if (f.grid[j][i] !== "s") continue;
        const vertical = f.charAt(i, j - 1) === "s" || f.charAt(i, j + 1) === "s" || WALK.includes(f.charAt(i, j - 1) || "x");
        for (let q = 0; q < 9; q++) {
          const u = (q % 3) - 1 + (rng() - 0.5) * 0.4, v = Math.floor(q / 3) - 1 + (rng() - 0.5) * 0.4;
          const x = i + 0.5 + u * 0.3, y = j + 0.5 + v * 0.3;
          const side = vertical ? Math.sign(u || 0.01) : Math.sign(v || 0.01);
          slots.push({ x, y, s: 1.0 + rng() * 0.4, r: rng() * 6.28, sp: q % 3 === 1 ? "bush" : "bramble", side, vertical });
        }
      }
    if (!slots.length) return;
    const mat = MK.treeMaterial("forest", this.uTime);
    const meshes = {};
    for (const sp of ["bramble", "bush"]) {
      const arr = slots.filter((s) => s.sp === sp);
      if (!arr.length) continue;
      const m = new THREE.InstancedMesh(MK.treeGeo(sp, 0, this.high ? 1 : 0), mat, arr.length);
      m.frustumCulled = false;
      m.castShadow = this.high;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      arr.forEach((s, k) => ((s.mesh = m), (s.index = k)));
      fillColor(m, 0.95);
      meshes[sp] = m;
      this.root.add(m);
    }
    const place = (k) => {
      for (const s of slots) {
        const push = smooth01(k) * 1.1;
        const x = s.x + (s.vertical ? s.side * push * 0.55 : 0), y = s.y + (s.vertical ? 0 : s.side * push * 0.55);
        _q4.setFromAxisAngle(_UP, s.r + k * 0.6);
        _m4.compose(_p4.set(toX(x), this.field.heightAt(x, y) - 0.05, toZ(y)), _q4, _s4.setScalar(s.s * (1 - 0.45 * smooth01(k))));
        s.mesh.setMatrixAt(s.index, _m4);
        s.mesh.instanceMatrix.needsUpdate = true;
      }
    };
    place(0);
    this.secret = { slots, place, t: -1 };
  };
  /** Ouvre le passage secret (animation). */
  W.openSecret = function (animate) {
    if (!this.secret || this.secret.t >= 0) return;
    if (animate === false) {
      // vue recréée en cours de partie : le passage est déjà ouvert
      this.secret.t = 9;
      this.secret.place(1);
      if (this.paint && this.paint.openSecret) {
        this.paint.openSecret();
        this.tex.color.needsUpdate = true;
      }
      return;
    }
    this.secret.t = 0;
    this.secretRepaint = true;
    for (let j = 0; j < MH; j++)
      for (let i = 0; i < MW; i++)
        if (this.field.grid[j][i] === "s" && PTMT.fx && PTMT.fx._ && PTMT.fx._.BURSTS && PTMT.fx._.BURSTS.leafBurst) PTMT.fx.burst("leafBurst", _p4.set(toX(i + 0.5), 0.6, toZ(j + 0.5)), { radius: 1.4, kind: "grass" });
  };

  /* ------------------------------------------------------------------ menus détails 3D (agent Décor) */
  W.buildScatter = function () {
    if (typeof (PTMT.models && PTMT.models.scatter) !== "function") return;
    const f = this.field, fine = this.fine, A = f.A, rng = PTMT.rng(f.seed + 909);
    const at = (fld, x, y) => {
      const gx = Math.round((x + A) * fine.F), gy = Math.round((y + A) * fine.F);
      if (gx < 0 || gy < 0 || gx >= fine.nx || gy >= fine.ny) return 0;
      return fld[gy * fine.nx + gx];
    };
    const items = [];
    const push = (kind, x, y) => items.push({ kind, x: toX(x), y: f.heightAt(x, y), z: toZ(y), seed: (rng() * 1e6) | 0 });
    const n = this.mobile ? 160 : 320;
    for (let k = 0; k < n * 4 && items.length < n; k++) {
      const x = rng() * (MW + 2) - 1, y = rng() * (MH + 2) - 1;
      const fx = x - Math.floor(x) - 0.5, fy = y - Math.floor(y) - 0.5;
      const nearCenter = Math.abs(fx) < 0.3 && Math.abs(fy) < 0.3;
      const road = at(fine.road, x, y), grass = at(fine.grass, x, y), rock = at(fine.rock, x, y), tal = at(fine.talus, x, y);
      // estran : goémon, coquillages et flaques de rocher (sous l'eau à marée haute)
      if (at(fine.tide, x, y) > 0.55) {
        const q = rng();
        push(q < 0.45 ? "seaweed" : q < 0.8 ? "shells" : "rockpool", x, y);
        continue;
      }
      if (road > 0.3 && road < 0.5) push("tuft", x, y);
      else if (road > 0.05 || at(fine.water, x, y) > 0.05) continue;
      else if (rock > 0.7 && !nearCenter) push("pebbles", x, y);
      else if (tal > 0.4) push(rng() < 0.5 ? "gorse" : "foxglove", x, y);
      else if (grass > 0.9 && !nearCenter) push(rng() < 0.4 ? "flowers" : rng() < 0.6 ? "daisies" : rng() < 0.85 ? "tuft" : "mushrooms", x, y);
    }
    const got = tryModel("scatter", items);
    if (got) {
      this.scatter = got;
      this.root.add(objOf(got));
    }
  };

  /**
   * Marée : low = true (basse : l'estran sort de l'eau) ou false (haute) ; animate = false pour poser
   * l'état d'un coup (vue recréée en cours de partie). La ligne d'eau parcourt l'estran en ≈ 2 s.
   */
  W.setTide = function (low, animate) {
    this.tideTarget = low ? 1 : 0;
    if (animate === false) this.tideLevel = this.tideTarget;
  };
  W.update = function (dt, time) {
    this.uTime.value = time;
    this.ov.uOvTime.value = time;
    if (this.tideLevel !== this.tideTarget) {
      const d = this.tideTarget - this.tideLevel, step = dt / 2.1;
      this.tideLevel = Math.abs(d) <= step ? this.tideTarget : this.tideLevel + Math.sign(d) * step;
    }
    if (this.waterUniforms) this.waterUniforms.uTide.value = smooth01(this.tideLevel);
    if (this.forests && this.forests.update) this.forests.update(dt, time);
    if (this.decor && this.decor.update) this.decor.update(dt, time);
    if (this.scatter && this.scatter.update) this.scatter.update(dt, time);
    if (this.menhirs) for (const m of this.menhirs) m.model.update && m.model.update(dt, time);
    if (this.updatePlaces) this.updatePlaces(dt, time);
    if (this.secret && this.secret.t >= 0 && this.secret.t < 1.3) {
      this.secret.t += dt;
      // le sol se repeint quand le fourré s'est écarté (une seule fois)
      if (this.secretRepaint && this.secret.t > 0.45 && this.paint && this.paint.openSecret) {
        this.secretRepaint = false;
        this.paint.openSecret();
        this.tex.color.needsUpdate = true;
      }
      this.secret.place(Math.min(1, this.secret.t / 1.2));
    }
    for (const a of this.animated) a(dt, time);
  };
  W.dispose = function () {
    if (this.disposePlaces) this.disposePlaces();
    this.root.parent && this.root.parent.remove(this.root);
    for (const d of this.disposables) d && d.dispose && d.dispose();
    this.disposables.length = 0;
  };
})();
