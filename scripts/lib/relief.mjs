// Relief réel : calculs communs à scripts/relief.mjs et à tests/relief.test.mjs.
//
// Données en entrée :
//  - le relief du plan (scripts/donnees/relief-modele.json, écrit par scripts/relief-modele.mjs) ;
//  - les altitudes de l'IGN sur une grille géographique (scripts/donnees/relief-ign.json, écrit par
//    scripts/releve-ign.mjs) : z[j * ne + i] à e0 + i·pas mètres à l'est et n0 + j·pas mètres au
//    nord du point de référence (lon0, lat0).
//
// Repères : le plan a x vers l'est et z vers le sud, en unités du plan ; le calage (geo) donne
// l'échelle (mètres par unité), l'orientation et la position de l'origine du plan (le moulin).

/** Calage par défaut : le même que dans src/app/v32/67-relief-ign.js. */
export const GEO = { theta: (0.1 * Math.PI) / 180, scale: 1.026, tx: 12, ty: 0.5, lon0: -2.53509, lat0: 47.72225 };
export const metresParDegre = (lat0) => ({ kx: 111320 * Math.cos((lat0 * Math.PI) / 180), ky: 110540 });

/** Plan → mètres à l'est et au nord du point de référence. */
export function versCarte(geo, x, z) {
  const c = Math.cos(geo.theta),
    s = Math.sin(geo.theta);
  return [geo.scale * (x * c + z * s) + geo.tx, geo.scale * (x * s - z * c) + geo.ty];
}
/** Mètres à l'est et au nord du point de référence → plan. */
export function versPlan(geo, e, n) {
  const c = Math.cos(geo.theta),
    s = Math.sin(geo.theta),
    u = (e - geo.tx) / geo.scale,
    v = (n - geo.ty) / geo.scale;
  return [u * c + v * s, u * s - v * c];
}

/** Altitude IGN en un point de la carte (bilinéaire) ; NaN hors de la grille ou sans donnée. */
export function altitude(ign, e, n) {
  const fx = (e - ign.e0) / ign.pas,
    fy = (n - ign.n0) / ign.pas;
  if (!(fx >= 0 && fy >= 0 && fx <= ign.ne - 1 && fy <= ign.nn - 1)) return NaN;
  const i = Math.min(ign.ne - 2, Math.floor(fx)),
    j = Math.min(ign.nn - 2, Math.floor(fy)),
    tx = fx - i,
    ty = fy - j,
    k = j * ign.ne + i;
  const a = ign.z[k],
    b = ign.z[k + 1],
    c = ign.z[k + ign.ne],
    d = ign.z[k + ign.ne + 1];
  if (a === null || b === null || c === null || d === null) return NaN;
  return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
}

/** Hauteur du plan en un point (bilinéaire dans la grille du relevé). */
export function hauteurPlan(modele, x, z) {
  const fx = Math.min(modele.nx - 1.001, Math.max(0, (x - modele.emprise.x0) / modele.pas)),
    fz = Math.min(modele.nz - 1.001, Math.max(0, (z - modele.emprise.z0) / modele.pas));
  const i = Math.floor(fx),
    j = Math.floor(fz),
    tx = fx - i,
    tz = fz - j,
    k = j * modele.nx + i,
    h = modele.h;
  return ((h[k] + (h[k + 1] - h[k]) * tx) * (1 - tz) + (h[k + modele.nx] + (h[k + modele.nx + 1] - h[k + modele.nx]) * tx) * tz) / 100;
}

export function dansPolygone(x, z, poly) {
  let res = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i],
      [xj, zj] = poly[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi || 1e-9) + xi) res = !res;
  }
  return res;
}
export function distanceContour(x, z, poly) {
  let d = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[j],
      b = poly[i],
      dx = b[0] - a[0],
      dz = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1e-9)));
    d = Math.min(d, Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz));
  }
  return d;
}
const mediane = (values) => {
  const v = values.filter(Number.isFinite).sort((a, b) => a - b);
  return v.length ? (v.length % 2 ? v[v.length >> 1] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2) : NaN;
};
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Points d'essai d'un étang : à l'intérieur (à plus de `retrait` m du bord et des îles) et sur une
 * couronne de terre autour (de `pres` à `loin` m du bord).
 */
export function pointsEtang(modele, etang, retrait = 3, maille = 2, pres = 5, loin = 9) {
  const xs = etang.contour.map((p) => p[0]),
    zs = etang.contour.map((p) => p[1]);
  const dedans = [],
    couronne = [];
  const autres = modele.etangs.filter((e) => e !== etang);
  for (let x = Math.min(...xs) - 10; x <= Math.max(...xs) + 10; x += maille)
    for (let z = Math.min(...zs) - 10; z <= Math.max(...zs) + 10; z += maille) {
      const d = distanceContour(x, z, etang.contour);
      if (dansPolygone(x, z, etang.contour)) {
        if (d < retrait) continue;
        if (modele.iles.some((ile) => dansPolygone(x, z, ile) || distanceContour(x, z, ile) < retrait)) continue;
        dedans.push([x, z]);
      } else if (d >= pres && d <= loin && !autres.some((e) => dansPolygone(x, z, e.contour) || distanceContour(x, z, e.contour) < 3)) couronne.push([x, z]);
    }
  return { dedans, couronne };
}

/**
 * Affine la position du plan sur la carte : dans le modèle de terrain de l'IGN, la surface d'un
 * étang est plate et ses berges montent. On cherche le décalage (est, nord) pour lequel
 * l'intérieur des étangs du plan tombe sur du plat et leur couronne sur plus haut.
 */
export function calage(modele, ign, geo, { rayon = 30 } = {}) {
  const grands = modele.etangs
    .map((etang) => ({ etang, ...pointsEtang(modele, etang, 1, 2, 1.5, 8) }))
    .filter((p) => p.dedans.length >= 40 && p.couronne.length >= 20);
  // quelques centaines de points par étang suffisent
  const some = (list, max) => (list.length <= max ? list : list.filter((_, i) => i % Math.ceil(list.length / max) === 0));
  for (const p of grands) {
    p.dedans = some(p.dedans, 500).map(([x, z]) => versCarte({ ...geo, tx: 0, ty: 0 }, x, z));
    p.couronne = some(p.couronne, 300).map(([x, z]) => versCarte({ ...geo, tx: 0, ty: 0 }, x, z));
  }
  const score = (tx, ty) => {
    let total = 0;
    for (const p of grands) {
      const zs = p.dedans.map(([e, n]) => altitude(ign, e + tx, n + ty));
      const m = mediane(zs);
      if (!Number.isFinite(m)) continue;
      // notes progressives : le score varie continûment avec le décalage, sans palier
      let plat = 0,
        haut = 0;
      for (const v of zs) plat += Math.max(0, 1 - Math.abs(v - m) / 0.3) || 0;
      for (const [e, n] of p.couronne) haut += Math.min(1, Math.max(0, (altitude(ign, e + tx, n + ty) - m) / 0.6)) || 0;
      total += plat / zs.length + haut / p.couronne.length;
    }
    return total / Math.max(1, grands.length);
  };
  const initial = score(geo.tx, geo.ty);
  // Balayage au mètre, puis au quart de mètre autour du meilleur ; on retient le centre des
  // meilleurs décalages (à égalité, le premier trouvé tirerait toujours du même côté).
  const balayage = (cx, cy, r, step) => {
    const list = [];
    for (let dy = -r; dy <= r; dy += step) for (let dx = -r; dx <= r; dx += step) list.push({ tx: cx + dx, ty: cy + dy, score: score(cx + dx, cy + dy) });
    const top = Math.max(...list.map((c) => c.score));
    const bests = list.filter((c) => c.score >= top - 0.004);
    return { list, top, tx: bests.reduce((a, c) => a + c.tx, 0) / bests.length, ty: bests.reduce((a, c) => a + c.ty, 0) / bests.length };
  };
  const large = balayage(geo.tx, geo.ty, rayon, 1);
  const fin = balayage(Math.round(large.tx), Math.round(large.ty), 2, 0.25);
  const tx = Math.round(fin.tx * 4) / 4,
    ty = Math.round(fin.ty * 4) / 4;
  return { tx, ty, score: score(tx, ty), initial, typique: mediane(large.list.map((c) => c.score)), etangs: grands.map((p) => p.etang.nom) };
}

/** Part du recalage appliquée en un point : la même règle que dans 67-relief-ign.js. */
export function part(x, z, distanceEau) {
  const HOUSE = { x: 0, z: 0, r: 30 },
    ANNEX = { x: -19.4, z: 6.2, angle: 1.53, u0: -3.4, u1: 6.2, v0: -11.7, v1: 9.3 };
  const house = smooth(HOUSE.r, HOUSE.r + 25, Math.hypot(x - HOUSE.x, z - HOUSE.z));
  const c = Math.cos(ANNEX.angle),
    s = Math.sin(ANNEX.angle),
    dx = x - ANNEX.x,
    dz = z - ANNEX.z,
    u = dx * c - dz * s,
    v = dx * s + dz * c;
  const annex = smooth(12, 37, Math.hypot(Math.max(ANNEX.u0 - u, 0, u - ANNEX.u1), Math.max(ANNEX.v0 - v, 0, v - ANNEX.v1)));
  return Math.min(house, annex) * smooth(6, 18, distanceEau);
}

/**
 * Ouvrages aux niveaux fixés à la main (allée, cour, terrasse, escaliers, murets, fauteuil…) : ils
 * ne suivent pas le sol. Le recalage est nul à moins de 6 m d'eux et complet à 26 m.
 */
export function protection(modele) {
  const points = [];
  for (const o of modele.ouvrages || []) {
    for (let i = 0; i < o.points.length; i++) {
      const a = o.points[i],
        b = o.points[i + 1];
      points.push(a);
      if (!b) continue;
      const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2);
      for (let k = 1; k < n; k++) points.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
    }
  }
  return (x, z) => {
    let d2 = Infinity;
    for (const p of points) d2 = Math.min(d2, (x - p[0]) ** 2 + (z - p[1]) ** 2);
    return smooth(6, 26, Math.sqrt(d2));
  };
}

/**
 * Écarts entre le relief réel et le relief du plan, lissés, sur la grille livrée.
 *
 * Le zéro du plan est la surface du grand étang. Chaque étang garde son niveau du plan : près de
 * lui, le relief est comparé par rapport à SON niveau (le niveau réel de l'étang est retiré), pour
 * qu'aucun étang ne se retrouve perché ou encaissé si le dénivelé réel entre étangs diffère de
 * celui du plan. Le rapport donne les niveaux réels, pour décider plus tard de les reprendre.
 */
export function ecarts(modele, ign, geo, { sigma = 9, bordEau = 4, sousPas = 2, borne = 15 } = {}) {
  const { nx, nz, pas, emprise } = modele;
  const at = (x, z) => {
    const [e, n] = versCarte(geo, x, z);
    return altitude(ign, e, n);
  };
  // Niveau réel de chaque étang (médiane des altitudes à l'intérieur).
  const niveaux = modele.etangs.map((etang) => {
    let pts = pointsEtang(modele, etang, 2, 2).dedans;
    if (pts.length < 6) pts = pointsEtang(modele, etang, 1, 1).dedans;
    const zs = pts.map(([x, z]) => at(x, z)).filter(Number.isFinite);
    return { nom: etang.nom, plan: etang.niveau, ngf: mediane(zs), points: zs.length, etang };
  });
  const grand = niveaux.find((n) => /grand/i.test(n.nom)) || niveaux[0];
  const zero = grand.ngf;
  if (!Number.isFinite(zero)) throw new Error("Pas d'altitude IGN dans le grand étang : le relevé couvre-t-il le domaine ?");
  for (const n of niveaux) {
    n.reel = Number.isFinite(n.ngf) && n.points >= 4 ? (n.ngf - zero) / geo.scale : NaN;
    n.decalage = Number.isFinite(n.reel) ? n.reel - n.plan : NaN;
  }
  const reperes = niveaux.filter((n) => Number.isFinite(n.decalage));
  const decalage = (x, z) => {
    let num = 0,
      den = 0;
    for (const n of reperes) {
      const d = dansPolygone(x, z, n.etang.contour) ? 0 : distanceContour(x, z, n.etang.contour);
      const w = 1 / (d + 5) ** 2;
      num += n.decalage * w;
      den += w;
    }
    return den ? num / den : 0;
  };
  // Écart brut en chaque point de terre.
  const brut = new Float64Array(nx * nz),
    relatif = new Float64Array(nx * nz),
    valide = new Uint8Array(nx * nz);
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i,
        x = emprise.x0 + i * pas,
        z = emprise.z0 + j * pas;
      const v = at(x, z);
      if (!Number.isFinite(v) || modele.eau[k] / 10 < bordEau) continue;
      brut[k] = (v - zero) / geo.scale - modele.h[k] / 100;
      relatif[k] = brut[k] - decalage(x, z);
      valide[k] = 1;
    }
  // Lissage gaussien normalisé (seuls les points de terre comptent), séparable.
  const rayon = Math.ceil((3 * sigma) / pas),
    noyau = [];
  for (let r = -rayon; r <= rayon; r++) noyau.push(Math.exp(-((r * pas) ** 2) / (2 * sigma * sigma)));
  const passe = (src, horizontal) => {
    const out = new Float64Array(nx * nz);
    for (let j = 0; j < nz; j++)
      for (let i = 0; i < nx; i++) {
        let sum = 0;
        for (let r = -rayon; r <= rayon; r++) {
          const ii = horizontal ? i + r : i,
            jj = horizontal ? j : j + r;
          if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue;
          sum += src[jj * nx + ii] * noyau[r + rayon];
        }
        out[j * nx + i] = sum;
      }
    return out;
  };
  const num = passe(passe(Float64Array.from(relatif, (v, k) => (valide[k] ? v : 0)), true), false);
  const den = passe(passe(Float64Array.from(valide), true), false);
  const plein = noyau.reduce((a, b) => a + b, 0) ** 2;
  const lisse = new Float64Array(nx * nz);
  const garde = protection(modele);
  for (let k = 0; k < nx * nz; k++) {
    if (den[k] <= plein * 0.02) continue;
    lisse[k] = Math.max(-borne, Math.min(borne, num[k] / den[k])) * garde(emprise.x0 + (k % nx) * pas, emprise.z0 + Math.floor(k / nx) * pas);
  }
  // Profil de l'allée : niveaux réels aux points du tracé (le plan fixe les siens à la main).
  const allee = modele.allee ? modele.allee.points.map(([x, z], i) => ({ x, z, plan: modele.allee.niveaux[i], reel: (at(x, z) - zero) / geo.scale })) : [];
  // Grille livrée (un point sur `sousPas`) et bilan.
  const lx = Math.floor((nx - 1) / sousPas) + 1,
    lz = Math.floor((nz - 1) / sousPas) + 1,
    d = [];
  for (let j = 0; j < lz; j++) for (let i = 0; i < lx; i++) d.push(Math.round(lisse[j * sousPas * nx + i * sousPas] * 100) / 100);
  const avant = [],
    apres = [],
    applique = [];
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      if (!valide[k]) continue;
      const p = part(emprise.x0 + i * pas, emprise.z0 + j * pas, modele.eau[k] / 10);
      avant.push(Math.abs(relatif[k]));
      apres.push(Math.abs(relatif[k] - lisse[k] * p));
      applique.push(Math.abs(lisse[k] * p));
    }
  const moyenne = (v) => v.reduce((a, b) => a + b, 0) / Math.max(1, v.length);
  const centile = (v, q) => {
    const s = [...v].sort((a, b) => a - b);
    return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : NaN;
  };
  return {
    zero,
    niveaux: niveaux.map(({ nom, plan, ngf, reel, decalage, points }) => ({ nom, plan, ngf, reel, decalage, points })),
    allee,
    grille: { x0: emprise.x0, z0: emprise.z0, pas: pas * sousPas, nx: lx, nz: lz, d },
    bilan: {
      points: avant.length,
      ecartMoyenAvant: moyenne(avant),
      ecart90Avant: centile(avant, 0.9),
      ecartMaxAvant: centile(avant, 1),
      ecartMoyenApres: moyenne(apres),
      ecart90Apres: centile(apres, 0.9),
      deplacementMoyen: moyenne(applique),
      deplacementMax: centile(applique, 1),
    },
    champs: { brut, relatif, lisse, valide },
  };
}

/** Texte du fichier src/app/v32/66-relief-livre.js. */
export function fichierLivre(livre) {
  const head = `// Moulin V32 — relief livré (altitudes réelles de l'IGN).
//
// Fichier écrit par scripts/relief.mjs : ne pas le modifier à la main.
`;
  if (!livre)
    return (
      head +
      `// Aucun relevé IGN n'a encore été traité : le relief du plan est inchangé.
(function () {
  "use strict";
  globalThis.MoulinV32.reliefLivre = null;
})();
`
    );
  return (
    head +
    `// ${livre.source} — relevé du ${livre.date}. Surface du grand étang : ${livre.zero.toFixed(2)} m NGF.
// d : écart lissé (m) entre le relief réel et celui du plan, ligne par ligne du nord au sud.
(function () {
  "use strict";
  globalThis.MoulinV32.reliefLivre = ${JSON.stringify(livre)};
})();
`
  );
}
