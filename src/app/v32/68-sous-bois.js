// Moulin V32 — atelier : zones de sous-bois.
//
// Onglet « Plantes & objets », section « Sous-bois » : on dessine une grande zone au sol
// (coins posés d'un toucher, ou trait à main levée) et elle se remplit toute seule :
//  - « Fougères » : fougères mâles en couronne, fougères femelles plus claires, taches de
//    fougère aigle ;
//  - « Ronces » : tiges arquées épineuses aux feuilles dentelées sombres, quelques fleurs
//    et mûres ;
//  - « Sous-bois mêlé » : fougères, ronces, tapis de lierre et de feuilles mortes, jeunes
//    pousses d'arbres, pierres moussues et bois mort.
// Les plantes poussent par touffes et par taches, plus denses au cœur de la zone et plus
// clairsemées sur ses bords, en suivant le relief, jamais sur l'eau, les chemins, les
// murets, les ponts, les bâtiments ni dans l'enceinte protégée du moulin.
//
// Rendu : cartes découpées (frondes, feuilles composées, tiges épineuses) peintes au
// chargement sur un petit atlas, puis instanciées — une douzaine d'appels de rendu pour
// toutes les zones. Près de la caméra, les plantes sont complètes ; plus loin, une forme
// allégée prend le relais ; au-delà, elles s'éclaircissent (les survivantes grandissent
// un peu pour garder la couverture) puis s'effacent en rentrant dans le sol. Le vent de la
// V32 fait onduler frondes et tiges. Budget global : 15 000 plantes (6 000 sur téléphone).
//
// Les zones sont gardées dans le navigateur, rejouées à l'ouverture, annulables, et
// voyagent dans le fichier « mes retouches ».
(function () {
  "use strict";
  const V32 = globalThis.MoulinV32;
  if (!V32) return;

  const KEY = "sous-bois";
  const TAU = Math.PI * 2;
  const MIX_IDS = ["fougeres", "ronces", "mele"];
  const MAX_ZONES = 60;
  const MAX_POINTS = 160;
  const MIN_AREA = 6; // m²
  const MAX_AREA = 60000; // m²
  const HOLD_MS = 450; // appui du doigt avant un trait à main levée

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const mix = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  const finite = (v) => typeof v === "number" && Number.isFinite(v);
  const round2 = (v) => Math.round(v * 100) / 100;

  // --- Hasard et bruits --------------------------------------------------------------------

  function random(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash2(ix, iz, seed) {
    let h = Math.imul(ix | 0, 374761393) + Math.imul(iz | 0, 668265263) + Math.imul(seed | 0, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function noise(x, z, seed) {
    const ix = Math.floor(x);
    const iz = Math.floor(z);
    const fx = x - ix;
    const fz = z - iz;
    const sx = fx * fx * (3 - 2 * fx);
    const sz = fz * fz * (3 - 2 * fz);
    const a = hash2(ix, iz, seed);
    const b = hash2(ix + 1, iz, seed);
    const c = hash2(ix, iz + 1, seed);
    const d = hash2(ix + 1, iz + 1, seed);
    return (a + (b - a) * sx) * (1 - sz) + (c + (d - c) * sx) * sz;
  }
  const fbm = (x, z, seed) => noise(x, z, seed) * 0.62 + noise(x * 2.07 + 17.3, z * 2.07 - 9.1, seed + 7) * 0.28 + noise(x * 4.3 - 3.7, z * 4.3 + 5.3, seed + 13) * 0.1;
  function gauss(rnd) {
    const u = Math.max(1e-6, rnd());
    const v = rnd();
    const r = Math.sqrt(-2 * Math.log(u));
    return [r * Math.cos(TAU * v), r * Math.sin(TAU * v)];
  }

  // --- Polygones ---------------------------------------------------------------------------

  function polygonArea(points) {
    let a = 0;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) a += (points[j][0] + points[i][0]) * (points[j][1] - points[i][1]);
    return Math.abs(a) / 2;
  }
  function perimeter(points) {
    let p = 0;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) p += Math.hypot(points[i][0] - points[j][0], points[i][1] - points[j][1]);
    return p;
  }
  function insidePoly(x, z, poly) {
    let result = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0];
      const zi = poly[i][1];
      const xj = poly[j][0];
      const zj = poly[j][1];
      if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) result = !result;
    }
    return result;
  }
  function edgeDistance(x, z, poly) {
    let best = Infinity;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const ax = poly[j][0];
      const az = poly[j][1];
      const vx = poly[i][0] - ax;
      const vz = poly[i][1] - az;
      const t = clamp(((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz || 1), 0, 1);
      const dx = x - ax - vx * t;
      const dz = z - az - vz * t;
      const d = dx * dx + dz * dz;
      if (d < best) best = d;
    }
    return Math.sqrt(best);
  }
  function bounds(poly) {
    let x0 = Infinity;
    let z0 = Infinity;
    let x1 = -Infinity;
    let z1 = -Infinity;
    for (const [x, z] of poly) {
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      z0 = Math.min(z0, z);
      z1 = Math.max(z1, z);
    }
    return [x0, z0, x1, z1];
  }
  function segmentDistance(x, z, ax, az, bx, bz) {
    const vx = bx - ax;
    const vz = bz - az;
    const t = clamp(((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz || 1), 0, 1);
    return Math.hypot(x - ax - vx * t, z - az - vz * t);
  }
  /** Ramer-Douglas-Peucker sur une ligne ouverte. */
  function rdp(points, tolerance) {
    if (points.length < 3) return points.slice();
    const keep = new Uint8Array(points.length);
    keep[0] = keep[points.length - 1] = 1;
    const stack = [[0, points.length - 1]];
    while (stack.length) {
      const [a, b] = stack.pop();
      let far = -1;
      let best = tolerance;
      for (let i = a + 1; i < b; i++) {
        const d = segmentDistance(points[i][0], points[i][1], points[a][0], points[a][1], points[b][0], points[b][1]);
        if (d > best) {
          best = d;
          far = i;
        }
      }
      if (far >= 0) {
        keep[far] = 1;
        stack.push([a, far], [far, b]);
      }
    }
    return points.filter((_, i) => keep[i]);
  }
  /** Contour fermé simplifié (au plus MAX_POINTS sommets). */
  function simplifyRing(points, tolerance) {
    let pts = points.slice();
    if (pts.length > 3) {
      const last = pts[pts.length - 1];
      if (Math.hypot(last[0] - pts[0][0], last[1] - pts[0][1]) < 0.05) pts.pop();
    }
    if (pts.length <= 4) return pts;
    let tol = tolerance;
    for (let pass = 0; pass < 12; pass++) {
      let far = 0;
      let best = -1;
      for (let i = 1; i < pts.length; i++) {
        const d = (pts[i][0] - pts[0][0]) ** 2 + (pts[i][1] - pts[0][1]) ** 2;
        if (d > best) {
          best = d;
          far = i;
        }
      }
      const a = rdp(pts.slice(0, far + 1), tol);
      const b = rdp(pts.slice(far).concat([pts[0]]), tol);
      const ring = a.slice(0, -1).concat(b.slice(0, -1));
      if (ring.length <= MAX_POINTS) return ring;
      tol *= 1.6;
    }
    return pts.slice(0, MAX_POINTS);
  }

  // --- Zones enregistrées -------------------------------------------------------------------

  /** Zones relues (stockage local ou fichier importé) : seules les zones valides restent. */
  function sanitize(input) {
    const list = Array.isArray(input) ? input : input && Array.isArray(input.zones) ? input.zones : [];
    const out = [];
    for (const zone of list) {
      if (out.length >= MAX_ZONES) break;
      if (!zone || typeof zone !== "object" || !MIX_IDS.includes(zone.mix) || !Array.isArray(zone.points)) continue;
      const points = [];
      let valid = true;
      for (const p of zone.points.slice(0, MAX_POINTS)) {
        if (!Array.isArray(p) || !finite(p[0]) || !finite(p[1]) || Math.abs(p[0]) > 5000 || Math.abs(p[1]) > 5000) {
          valid = false;
          break;
        }
        points.push([round2(p[0]), round2(p[1])]);
      }
      if (!valid || points.length < 3) continue;
      const area = polygonArea(points);
      if (!(area >= MIN_AREA && area <= MAX_AREA)) continue;
      const seed = finite(zone.seed) ? Math.abs(Math.floor(zone.seed)) % 2147483647 : 1;
      out.push({ mix: zone.mix, density: round2(clamp(finite(zone.density) ? zone.density : 0.65, 0.15, 1)), seed: seed || 1, points });
    }
    return out;
  }

  // --- Atlas des feuillages -----------------------------------------------------------------
  // Rectangles [u0, v0, u1, v1] (v = 0 en haut du canevas, texture sans retournement).
  const REGION = {
    frondA: [0, 0, 0.25, 1],
    frondB: [0.25, 0, 0.5, 1],
    brambleA: [0.5, 0, 0.75, 0.25],
    brambleB: [0.5, 0.25, 0.75, 0.5],
    flower: [0.75, 0, 0.875, 0.125],
    berry: [0.875, 0, 1, 0.125],
    flowerB: [0.75, 0.125, 0.875, 0.25],
    berryB: [0.875, 0.125, 1, 0.25],
    sprig: [0.75, 0.25, 1, 0.5],
    ivy: [0.5, 0.5, 0.75, 0.75],
    litter: [0.75, 0.5, 1, 0.75],
    cane: [0.5, 0.75, 0.625, 1],
    bark: [0.625, 0.75, 0.75, 0.875],
    stipe: [0.625, 0.875, 0.75, 1],
    bracken: [0.75, 0.75, 1, 1],
  };
  // Rectangle légèrement rentré : les niveaux réduits ne lisent pas la case voisine.
  const inset = (r, k = 0.012) => {
    const du = (r[2] - r[0]) * k;
    const dv = (r[3] - r[1]) * k;
    return [r[0] + du, r[1] + dv, r[2] - du, r[3] - dv];
  };

  // Frondes : fougère mâle (vert profond) et fougère femelle (plus claire, plus fine).
  const FROND_A = {
    stipe: 0.13,
    shape: 0.8,
    pairs: 25,
    angle: 1.2,
    pinnaWidth: 0.17,
    lobes: 11,
    lobeDepth: 0.5,
    colours: ["#3d6a2a", "#46742f", "#396226", "#4d7b32", "#426e2c", "#35602a"],
    tip: "#6f9a3e",
    rachis: "#5b6a2d",
  };
  const FROND_B = {
    stipe: 0.17,
    shape: 0.95,
    pairs: 30,
    angle: 1.26,
    pinnaWidth: 0.15,
    lobes: 14,
    lobeDepth: 0.6,
    colours: ["#557f33", "#5f8a3a", "#4f7832", "#67923e", "#5a8538", "#4a7430"],
    tip: "#86a94f",
    rachis: "#6d7d38",
  };
  // Enveloppe d'une fronde (demi-largeur relative) le long de sa longueur (0 : pied, 1 : pointe).
  function frondEnvelope(s, spec) {
    if (s < spec.stipe) return 0;
    const t = (s - spec.stipe) / (1 - spec.stipe);
    const k = Math.sin(Math.PI * Math.min(1, 0.12 + t * 0.92));
    return k <= 0 ? 0 : Math.pow(k, spec.shape) * (1 - 0.15 * t);
  }
  // Largeur de la carte (un peu plus large que la fronde peinte, qui monte en biais).
  function cardEnvelope(s, spec) {
    if (spec.card) return spec.card(s);
    const e = Math.max(frondEnvelope(s, spec), frondEnvelope(s - 0.035, spec), frondEnvelope(s - 0.07, spec));
    return clamp(0.07 + 1.1 * e, 0.07, 1);
  }

  function hexRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgb(c, k = 1, a = 1) {
    return `rgba(${clamp(Math.round(c[0] * k), 0, 255)},${clamp(Math.round(c[1] * k), 0, 255)},${clamp(Math.round(c[2] * k), 0, 255)},${a})`;
  }
  const mixRgb = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
  const pick = (rnd, list) => list[Math.floor(rnd() * list.length)];

  /** Penne de fronde : limbe lancéolé à pinnules arrondies, moitié repliée plus sombre. */
  function paintPinna(ctx, x, y, side, len, spec, rnd, colour, lobes = spec.lobes, depth = spec.lobeDepth, widthK = spec.pinnaWidth) {
    const a = spec.angle + (rnd() - 0.5) * 0.12;
    const dx = Math.sin(a) * side;
    const dy = -Math.cos(a);
    const width = len * widthK;
    const N = 22;
    const upper = [];
    const lower = [];
    const mid = [];
    for (let k = 0; k <= N; k++) {
      const q = k / N;
      const bend = 0.1 * q * q * len;
      const cx = x + dx * len * q;
      const cy = y + dy * len * q - bend;
      // Tangente (avec la courbure) pour placer les bords.
      const tx = dx * len;
      const ty = dy * len - 0.2 * q * len;
      const tl = Math.hypot(tx, ty) || 1;
      const px = -ty / tl;
      const py = tx / tl;
      const base = Math.pow(Math.sin(Math.PI * Math.min(1, 0.07 + q * 0.95)), 0.55) * (1 - 0.35 * q);
      const lobe = 1 - depth + depth * Math.pow(Math.abs(Math.sin(q * lobes * Math.PI)), 0.45);
      const hw = width * base * lobe;
      upper.push([cx + px * hw, cy + py * hw]);
      lower.push([cx - px * hw, cy - py * hw]);
      mid.push([cx, cy]);
    }
    const c = hexRgb(colour);
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (const p of upper) ctx.lineTo(p[0], p[1]);
    for (let i = lower.length - 1; i >= 0; i--) ctx.lineTo(lower[i][0], lower[i][1]);
    ctx.closePath();
    ctx.fillStyle = rgb(c, 0.94 + rnd() * 0.12);
    ctx.fill();
    // Moitié à l'ombre (la penne est légèrement pliée sur sa nervure).
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (const p of side > 0 ? lower : upper) ctx.lineTo(p[0], p[1]);
    for (let i = mid.length - 1; i >= 0; i--) ctx.lineTo(mid[i][0], mid[i][1]);
    ctx.closePath();
    ctx.fillStyle = "rgba(10,28,6,0.2)";
    ctx.fill();
    ctx.strokeStyle = "rgba(200,220,140,0.32)";
    ctx.lineWidth = Math.max(0.6, width * 0.1);
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let i = 0; i < mid.length - 3; i++) ctx.lineTo(mid[i][0], mid[i][1]);
    ctx.stroke();
  }

  function paintFrond(ctx, w, h, rnd, spec) {
    const cx = w / 2;
    const base = h * 0.985;
    const top = h * 0.015;
    const L = base - top;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const grad = ctx.createLinearGradient(0, base, 0, top);
    grad.addColorStop(0, "#4b3d22");
    grad.addColorStop(spec.stipe * 0.8, spec.rachis);
    grad.addColorStop(1, spec.tip);
    ctx.strokeStyle = grad;
    ctx.lineWidth = Math.max(1.4, w * 0.026);
    ctx.beginPath();
    ctx.moveTo(cx, base);
    ctx.lineTo(cx, top + L * 0.01);
    ctx.stroke();
    // Écailles brunes au pied du stipe.
    ctx.fillStyle = "rgba(110,72,34,0.85)";
    for (let i = 0; i < 12; i++) {
      const y = base - rnd() * spec.stipe * L * 0.9;
      const s = rnd() < 0.5 ? -1 : 1;
      ctx.beginPath();
      ctx.ellipse(cx + s * w * 0.018, y, w * 0.012, w * 0.03, s * 0.5, 0, TAU);
      ctx.fill();
    }
    const tip = hexRgb(spec.tip);
    for (let i = 0; i < spec.pairs; i++) {
      const t = i / (spec.pairs - 1);
      const s = spec.stipe + (1 - spec.stipe) * t * 0.985;
      const len = w * 0.47 * frondEnvelope(s, spec) * (0.93 + rnd() * 0.08);
      if (len < 2) continue;
      const y = base - s * L;
      const colour = "#" + mixRgb(hexRgb(pick(rnd, spec.colours)), tip, smooth(0.5, 1, t) * 0.65)
        .map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0"))
        .join("");
      paintPinna(ctx, cx - w * 0.008, y + L * 0.004, -1, len, spec, rnd, colour);
      paintPinna(ctx, cx + w * 0.008, y, 1, len, spec, rnd, colour);
    }
  }

  // Fougère aigle : limbe triangulaire, pennes découpées, vert jaune.
  const BRACKEN = {
    stipe: 0.02,
    shape: 1,
    angle: 1.1,
    pinnaWidth: 0.3,
    lobes: 8,
    lobeDepth: 0.56,
    colours: ["#4f742b", "#597e30", "#4a6d29", "#628535", "#557a2f"],
    tip: "#7e9c42",
    card: (s) => clamp(0.08 + 1.08 * Math.pow(Math.max(0, 1 - s), 0.8) * smooth(0, 0.1, s + 0.02), 0.08, 1),
  };
  function paintBracken(ctx, w, h, rnd) {
    const cx = w / 2;
    const base = h * 0.975;
    const top = h * 0.025;
    const L = base - top;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#7c7a38";
    ctx.lineWidth = Math.max(1.2, w * 0.016);
    ctx.beginPath();
    ctx.moveTo(cx, base);
    ctx.lineTo(cx, top);
    ctx.stroke();
    const pairs = 10;
    const tip = hexRgb(BRACKEN.tip);
    for (let i = 0; i < pairs; i++) {
      const t = i / (pairs - 1);
      const y0 = base - (0.03 + 0.94 * t) * L;
      const len = w * 0.47 * Math.pow(1 - t * 0.9, 0.85);
      const colour = mixRgb(hexRgb(pick(rnd, BRACKEN.colours)), tip, t * 0.45);
      for (const side of [-1, 1]) {
        // Penne : axe secondaire et pinnules ovales alternes, plus petites vers la pointe.
        const a = side * (1.12 + (rnd() - 0.5) * 0.1);
        const dx = Math.sin(a);
        const dy = -Math.cos(a);
        const y = y0 + (side > 0 ? 0 : L * 0.008);
        ctx.strokeStyle = "rgba(110,120,50,0.9)";
        ctx.lineWidth = Math.max(0.8, w * 0.008);
        ctx.beginPath();
        ctx.moveTo(cx, y);
        ctx.quadraticCurveTo(cx + dx * len * 0.5, y + dy * len * 0.5 - len * 0.04, cx + dx * len, y + dy * len - len * 0.12);
        ctx.stroke();
        const count = Math.max(3, Math.round(3 + len / (w * 0.03)));
        for (let k = 0; k < count; k++) {
          const q = (k + 0.6) / (count + 0.4);
          const px = cx + dx * len * q;
          const py = y + dy * len * q - len * 0.12 * q * q;
          const pl = Math.max(w * 0.012, len * 0.26 * (1 - 0.75 * q));
          for (const s2 of [-1, 1]) {
            const b = a + s2 * 1.05 + (rnd() - 0.5) * 0.15;
            ctx.save();
            ctx.translate(px + Math.sin(b) * pl * 0.5, py - Math.cos(b) * pl * 0.5);
            ctx.rotate(b);
            ctx.beginPath();
            ctx.ellipse(0, 0, pl * 0.22, pl * 0.55, 0, 0, TAU);
            ctx.fillStyle = rgb(colour, 0.9 + rnd() * 0.18);
            ctx.fill();
            ctx.fillStyle = "rgba(10,28,6,0.16)";
            ctx.beginPath();
            ctx.ellipse(pl * 0.08, 0, pl * 0.12, pl * 0.5, 0, 0, TAU);
            ctx.fill();
            ctx.restore();
          }
        }
      }
    }
    // Quelques bords roussis.
    ctx.globalCompositeOperation = "source-atop";
    for (let i = 0; i < 5; i++) {
      const g = ctx.createRadialGradient(rnd() * w, rnd() * h, 0, rnd() * w, rnd() * h, w * 0.22);
      g.addColorStop(0, "rgba(160,110,40,0.3)");
      g.addColorStop(1, "rgba(160,110,40,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.globalCompositeOperation = "source-over";
  }

  /** Foliole de ronce : ovale acuminé, bord denté, nervures claires. */
  function paintLeaflet(ctx, x, y, angle, L, rnd, colour, opts = {}) {
    const width = L * (opts.width || 0.3);
    const teeth = opts.teeth || 16;
    const N = 48;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const P = (u, v) => [x + u * c - v * s, y + u * s + v * c];
    const right = [];
    const left = [];
    for (let k = 1; k < N; k++) {
      const q = k / N;
      const env = Math.pow(Math.sin(Math.PI * Math.pow(q, opts.pow || 0.72)), 0.9) * (1 - 0.18 * q);
      const f = (q * teeth) % 1;
      const tooth = 1 + (opts.serrate ?? 0.08) * (f < 0.75 ? f / 0.75 : (1 - f) / 0.25);
      right.push(P(width * env * tooth, -L * q));
      left.push(P(-width * env * tooth, -L * q));
    }
    const path = new Path2D();
    path.moveTo(x, y);
    for (const p of right) path.lineTo(p[0], p[1]);
    const tip = P(0, -L);
    path.lineTo(tip[0], tip[1]);
    for (let i = left.length - 1; i >= 0; i--) path.lineTo(left[i][0], left[i][1]);
    path.closePath();
    const col = hexRgb(colour);
    ctx.fillStyle = rgb(col);
    ctx.fill(path);
    ctx.save();
    ctx.clip(path);
    // Moitié pliée plus sombre, reflet clair sur l'autre.
    ctx.beginPath();
    const a0 = P(0, 0);
    ctx.moveTo(a0[0], a0[1]);
    for (const p of rnd() < 0.5 ? right : left) ctx.lineTo(p[0], p[1]);
    ctx.lineTo(tip[0], tip[1]);
    ctx.closePath();
    ctx.fillStyle = "rgba(6,16,4,0.2)";
    ctx.fill();
    if (opts.blotch) {
      const b = P((rnd() - 0.5) * width, -L * (0.3 + rnd() * 0.5));
      const g = ctx.createRadialGradient(b[0], b[1], 0, b[0], b[1], L * 0.45);
      g.addColorStop(0, opts.blotch);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - L, y - L * 1.2, L * 2, L * 2.4);
    }
    // Nervures.
    ctx.strokeStyle = opts.vein || "rgba(170,200,130,0.38)";
    ctx.lineWidth = Math.max(0.7, L * 0.022);
    ctx.beginPath();
    ctx.moveTo(a0[0], a0[1]);
    ctx.lineTo(tip[0], tip[1]);
    const veins = opts.veins ?? 7;
    for (let k = 1; k <= veins; k++) {
      const q = k / (veins + 1);
      const env = Math.pow(Math.sin(Math.PI * Math.pow(q, opts.pow || 0.72)), 0.9) * (1 - 0.18 * q);
      for (const sd of [-1, 1]) {
        const p0 = P(0, -L * q);
        const p1 = P(sd * width * env * 0.9, -L * (q + 0.1));
        ctx.moveTo(p0[0], p0[1]);
        ctx.lineTo(p1[0], p1[1]);
      }
    }
    ctx.lineWidth = Math.max(0.5, L * 0.012);
    ctx.stroke();
    ctx.restore();
  }

  const BRAMBLE_GREENS = ["#35552b", "#3d5f2f", "#314f28", "#44652f", "#3a5a2c", "#2f4b26"];
  const BRAMBLE_REDS = ["#3d5a2c", "#44602f", "#38532a", "#4a6532"];
  /**
   * Feuille composée de ronce (5 ou 3 folioles), pétiole en (x, y), dirigée selon angle
   * (0 : vers le haut du canevas) ; size : longueur totale.
   */
  function paintCompound(ctx, x, y, angle, size, rnd, five, reddish) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    const top = -size * 0.13;
    ctx.strokeStyle = "#5a3a30";
    ctx.lineWidth = Math.max(1, size * 0.02);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, top);
    ctx.stroke();
    const pal = reddish ? BRAMBLE_REDS : BRAMBLE_GREENS;
    const leaflets = five
      ? [
          [-2.05, 0.28],
          [2.05, 0.28],
          [-1.05, 0.42],
          [1.05, 0.42],
          [0, 0.62],
        ]
      : [
          [-1.2, 0.46],
          [1.2, 0.46],
          [0, 0.66],
        ];
    for (const [a, len] of leaflets) {
      const stalk = a === 0 ? size * 0.13 : size * 0.045;
      const ox = Math.sin(a) * stalk;
      const oy = top - Math.cos(a) * stalk;
      ctx.beginPath();
      ctx.moveTo(0, top);
      ctx.lineTo(ox, oy);
      ctx.stroke();
      paintLeaflet(ctx, ox, oy, a, size * len * 0.84, rnd, pick(rnd, pal), {
        width: 0.27,
        teeth: 17,
        serrate: 0.1,
        blotch: reddish && rnd() < 0.7 ? "rgba(120,30,55,0.38)" : rnd() < 0.15 ? "rgba(110,40,50,0.2)" : null,
      });
    }
    ctx.restore();
  }
  function paintBramble(ctx, w, h, rnd) {
    paintCompound(ctx, w / 2, h * 0.97, 0, h * 0.95, rnd, true, false);
  }
  // Pousse feuillée : trois ou quatre feuilles composées sur une tige courte.
  function paintBrambleCluster(ctx, w, h, rnd) {
    const bx = w / 2;
    const by = h * 0.98;
    ctx.strokeStyle = "#5e3d32";
    ctx.lineWidth = Math.max(1, w * 0.02);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.quadraticCurveTo(bx - w * 0.02, h * 0.8, bx + w * 0.02, h * 0.6);
    ctx.stroke();
    for (const [t, a, size, five] of [
      [0.12, -1.15, 0.55, true],
      [0.2, 1.15, 0.52, false],
      [0.3, 0.5, 0.5, true],
      [0.36, -0.42, 0.62, true],
    ]) {
      const x = bx + (rnd() - 0.5) * w * 0.02;
      const y = by - t * h;
      paintCompound(ctx, x, y, a + (rnd() - 0.5) * 0.15, size * h, rnd, five, rnd() < 0.25);
    }
  }

  function paintFlower(ctx, w, h, rnd, bud) {
    const cx = w / 2;
    const cy = h / 2;
    const R = w * 0.3;
    const drawFlower = (x, y, r, turn) => {
      for (let p = 0; p < 5; p++) {
        const a = turn + (p / 5) * TAU;
        ctx.save();
        ctx.translate(x + Math.cos(a) * r * 0.48, y + Math.sin(a) * r * 0.48);
        ctx.rotate(a);
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 0.55, r * 0.42, 0, 0, TAU);
        const g = ctx.createRadialGradient(-r * 0.3, 0, 0, 0, 0, r * 0.6);
        g.addColorStop(0, "#fbf3f5");
        g.addColorStop(1, rnd() < 0.5 ? "#f2d8e0" : "#f6eaee");
        ctx.fillStyle = g;
        ctx.fill();
        ctx.restore();
      }
      ctx.beginPath();
      ctx.arc(x, y, r * 0.24, 0, TAU);
      ctx.fillStyle = "#c9c46a";
      ctx.fill();
      ctx.fillStyle = "#e8d890";
      for (let i = 0; i < 14; i++) {
        const a = rnd() * TAU;
        const d = r * (0.18 + rnd() * 0.16);
        ctx.fillRect(x + Math.cos(a) * d, y + Math.sin(a) * d, Math.max(1, r * 0.05), Math.max(1, r * 0.05));
      }
    };
    if (!bud) drawFlower(cx, cy, R, rnd() * TAU);
    else {
      drawFlower(cx - w * 0.14, cy + h * 0.1, R * 0.72, rnd() * TAU);
      // Boutons verts.
      for (const [bx, by] of [
        [cx + w * 0.22, cy - h * 0.18],
        [cx + w * 0.26, cy + h * 0.2],
      ]) {
        ctx.beginPath();
        ctx.ellipse(bx, by, w * 0.07, w * 0.09, 0.4, 0, TAU);
        ctx.fillStyle = "#7d9a44";
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(bx, by - w * 0.03, w * 0.04, w * 0.05, 0.4, 0, TAU);
        ctx.fillStyle = "#efe0e6";
        ctx.fill();
      }
    }
  }

  function paintBerries(ctx, w, h, rnd, ripe) {
    const clusters = ripe
      ? [
          [0.36, 0.4, "ripe"],
          [0.66, 0.58, "ripe"],
          [0.38, 0.74, "red"],
        ]
      : [
          [0.4, 0.42, "red"],
          [0.66, 0.64, "green"],
          [0.34, 0.74, "ripe"],
        ];
    const colours = {
      ripe: ["#140b18", "#1f1024", "#2a1330"],
      red: ["#8c1a24", "#a2242b", "#7a1620"],
      green: ["#6f8a36", "#7d9840", "#65803a"],
    };
    ctx.strokeStyle = "#4e3a2a";
    ctx.lineWidth = Math.max(1, w * 0.025);
    ctx.beginPath();
    ctx.moveTo(w * 0.5, h * 0.98);
    for (const [x, y] of clusters) {
      ctx.moveTo(w * 0.5, h * 0.98);
      ctx.quadraticCurveTo(w * 0.5, y * h + h * 0.1, x * w, y * h);
    }
    ctx.stroke();
    for (const [x, y, kind] of clusters) {
      const R = w * 0.15;
      // Sépales.
      ctx.fillStyle = "#4f6a2c";
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * TAU + 0.3;
        ctx.beginPath();
        ctx.ellipse(x * w + Math.cos(a) * R * 0.7, y * h + Math.sin(a) * R * 0.7 + R * 0.3, R * 0.45, R * 0.16, a, 0, TAU);
        ctx.fill();
      }
      // Drupéoles.
      const n = 16;
      for (let k = 0; k < n; k++) {
        const a = k * 2.39996;
        const d = Math.sqrt((k + 0.5) / n) * R * 0.78;
        const bx = x * w + Math.cos(a) * d;
        const by = y * h + Math.sin(a) * d * 1.1;
        const r = R * (0.28 + rnd() * 0.06);
        ctx.beginPath();
        ctx.arc(bx, by, r, 0, TAU);
        ctx.fillStyle = pick(rnd, colours[kind]);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(bx - r * 0.3, by - r * 0.35, r * 0.28, 0, TAU);
        ctx.fillStyle = kind === "ripe" ? "rgba(170,140,200,0.55)" : "rgba(255,230,210,0.45)";
        ctx.fill();
      }
    }
  }

  function paintSprig(ctx, w, h, rnd) {
    // Rameau de jeune noisetier / hêtre : feuilles alternes ovales dentées.
    const pts = [];
    let x = w * 0.5;
    let y = h * 0.97;
    let a = (rnd() - 0.5) * 0.3;
    for (let i = 0; i < 7; i++) {
      pts.push([x, y]);
      a += (rnd() - 0.5) * 0.25;
      x += Math.sin(a) * h * 0.13;
      y -= Math.cos(a) * h * 0.13;
    }
    ctx.strokeStyle = "#6a4d33";
    ctx.lineCap = "round";
    for (let i = 0; i < pts.length - 1; i++) {
      ctx.lineWidth = Math.max(0.8, w * 0.02 * (1 - i / pts.length));
      ctx.beginPath();
      ctx.moveTo(pts[i][0], pts[i][1]);
      ctx.lineTo(pts[i + 1][0], pts[i + 1][1]);
      ctx.stroke();
    }
    const pal = ["#5b8a35", "#679540", "#4f7d31", "#72a046", "#5f8f3a"];
    for (let i = 1; i < pts.length; i++) {
      const side = i % 2 ? 1 : -1;
      const L = h * (0.3 - i * 0.018) * (0.9 + rnd() * 0.2);
      paintLeaflet(ctx, pts[i][0], pts[i][1], side * (0.95 + rnd() * 0.35), L, rnd, pick(rnd, pal), { width: 0.36, teeth: 14, serrate: 0.06, pow: 0.62, veins: 6 });
    }
    const tip = pts[pts.length - 1];
    paintLeaflet(ctx, tip[0], tip[1], (rnd() - 0.5) * 0.3, h * 0.2, rnd, pick(rnd, pal), { width: 0.36, teeth: 12, serrate: 0.06, pow: 0.62, veins: 5 });
  }

  function paintIvyLeaf(ctx, x, y, size, angle, colour, rnd) {
    const lobes = [
      [-1.75, 0.5],
      [-0.85, 0.78],
      [0, 1],
      [0.85, 0.78],
      [1.75, 0.5],
    ];
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    lobes.forEach(([a, r], i) => {
      const tx = Math.sin(a) * r * size;
      const ty = -Math.cos(a) * r * size;
      const prev = i === 0 ? [-1.9, 0.2] : lobes[i - 1];
      const ma = (a + prev[0]) / 2;
      const mr = i === 0 ? 0.25 : 0.42;
      ctx.quadraticCurveTo(Math.sin(ma) * mr * size, -Math.cos(ma) * mr * size, tx, ty);
    });
    ctx.quadraticCurveTo(Math.sin(2.1) * 0.3 * size, -Math.cos(2.1) * 0.3 * size, 0, 0);
    ctx.closePath();
    ctx.fillStyle = colour;
    ctx.fill();
    ctx.strokeStyle = "rgba(190,210,170,0.45)";
    ctx.lineWidth = Math.max(0.6, size * 0.06);
    ctx.beginPath();
    for (const [a, r] of lobes) {
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.sin(a) * r * size * 0.8, -Math.cos(a) * r * size * 0.8);
    }
    ctx.stroke();
    if (rnd() < 0.5) {
      ctx.fillStyle = "rgba(255,255,230,0.08)";
      ctx.beginPath();
      ctx.arc(-size * 0.2, -size * 0.45, size * 0.35, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function paintIvy(ctx, w, h, rnd) {
    const cx = w / 2;
    const cy = h / 2;
    const R = w * 0.44;
    ctx.strokeStyle = "#4a4a2a";
    ctx.lineCap = "round";
    const stems = [];
    for (let i = 0; i < 9; i++) {
      let a = (i / 9) * TAU + rnd() * 0.5;
      let x = cx + (rnd() - 0.5) * w * 0.12;
      let y = cy + (rnd() - 0.5) * h * 0.12;
      const pts = [[x, y]];
      const n = 7 + Math.floor(rnd() * 4);
      for (let k = 0; k < n; k++) {
        a += (rnd() - 0.5) * 0.7;
        x += Math.cos(a) * w * 0.05;
        y += Math.sin(a) * w * 0.05;
        if (Math.hypot(x - cx, y - cy) > R * 0.92) break;
        pts.push([x, y]);
      }
      stems.push(pts);
      ctx.lineWidth = Math.max(0.8, w * 0.008);
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (const p of pts) ctx.lineTo(p[0], p[1]);
      ctx.stroke();
    }
    const pal = ["#223c1d", "#2a4722", "#1e351a", "#315126", "#27421f", "#3a5a2c"];
    const leaves = [];
    for (const pts of stems) for (const p of pts) if (rnd() < 0.85) leaves.push(p);
    for (let i = 0; i < 120; i++) {
      const a = rnd() * TAU;
      const d = Math.pow(rnd(), 0.6) * R * 0.88;
      leaves.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d]);
    }
    for (let i = leaves.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [leaves[i], leaves[j]] = [leaves[j], leaves[i]];
    }
    leaves.forEach(([x, y], i) => {
      const d = Math.hypot(x - cx, y - cy) / R;
      const size = w * (0.06 + rnd() * 0.04) * (1.05 - d * 0.35);
      const shade = 0.78 + 0.34 * (i / leaves.length);
      paintIvyLeaf(ctx, x, y, size, rnd() * TAU, rgb(hexRgb(pick(rnd, pal)), shade), rnd);
    });
  }

  function paintLitter(ctx, w, h, rnd) {
    const cx = w / 2;
    const cy = h / 2;
    const R = w * 0.46;
    const pal = ["#5a4228", "#66492c", "#6f5433", "#4a3822", "#7a603a", "#5e4a32", "#43331f", "#6b5536", "#7f6a40", "#5f5634"];
    // Terre sombre et humus sous les feuilles (contour irrégulier).
    for (let i = 0; i < 16; i++) {
      const a = rnd() * TAU;
      const d = Math.sqrt(rnd()) * R * 0.5;
      const x = cx + Math.cos(a) * d;
      const y = cy + Math.sin(a) * d;
      const r = R * (0.28 + rnd() * 0.22);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, "rgba(64,48,30,0.92)");
      g.addColorStop(0.55, "rgba(70,54,34,0.8)");
      g.addColorStop(1, "rgba(70,54,34,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    }
    // Brindilles.
    ctx.strokeStyle = "#3e3024";
    ctx.lineCap = "round";
    for (let i = 0; i < 7; i++) {
      const a = rnd() * TAU;
      const d = rnd() * R * 0.6;
      const x = cx + Math.cos(a) * d;
      const y = cy + Math.sin(a) * d;
      const b = rnd() * TAU;
      const l = w * (0.1 + rnd() * 0.16);
      ctx.lineWidth = Math.max(0.8, w * (0.006 + rnd() * 0.006));
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(b) * l, y + Math.sin(b) * l);
      ctx.stroke();
    }
    const n = 190;
    for (let i = 0; i < n; i++) {
      const a = rnd() * TAU;
      const d = Math.pow(rnd(), 0.7) * R;
      const x = cx + Math.cos(a) * d;
      const y = cy + Math.sin(a) * d;
      if (d > R * 0.72 && rnd() < 0.5) continue;
      const depth = i / n;
      const colour = pick(rnd, pal);
      const L = w * (0.045 + rnd() * 0.055);
      const kind = rnd();
      const shade = 0.55 + 0.4 * depth;
      if (kind < 0.45) {
        // Hêtre / châtaignier : ovale, parfois long et denté.
        paintLeaflet(ctx, x, y, rnd() * TAU, L * (kind < 0.2 ? 1.5 : 1), rnd, "#" + hexRgb(colour).map((v) => clamp(Math.round(v * shade), 0, 255).toString(16).padStart(2, "0")).join(""), {
          width: kind < 0.2 ? 0.2 : 0.34,
          teeth: 12,
          serrate: kind < 0.2 ? 0.12 : 0.03,
          vein: "rgba(230,200,150,0.3)",
          veins: 5,
        });
      } else {
        // Chêne : lobes arrondis.
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rnd() * TAU);
        ctx.beginPath();
        const N = 28;
        for (let k = 0; k <= N; k++) {
          const q = k / N;
          const env = Math.pow(Math.sin(Math.PI * Math.pow(q, 0.8)), 0.85);
          const lobe = 0.62 + 0.38 * Math.abs(Math.sin(q * 4.5 * Math.PI));
          const px = L * 0.28 * env * lobe;
          if (k === 0) ctx.moveTo(px, -L * q);
          else ctx.lineTo(px, -L * q);
        }
        for (let k = N; k >= 0; k--) {
          const q = k / N;
          const env = Math.pow(Math.sin(Math.PI * Math.pow(q, 0.8)), 0.85);
          const lobe = 0.62 + 0.38 * Math.abs(Math.sin(q * 4.5 * Math.PI + 0.6));
          ctx.lineTo(-L * 0.28 * env * lobe, -L * q);
        }
        ctx.closePath();
        ctx.fillStyle = rgb(hexRgb(colour), shade);
        ctx.fill();
        ctx.strokeStyle = "rgba(60,40,20,0.35)";
        ctx.lineWidth = Math.max(0.5, L * 0.03);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -L * 0.9);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  function paintCane(ctx, w, h, rnd) {
    const cx = w / 2;
    const half = w * 0.16;
    const g = ctx.createLinearGradient(cx - half, 0, cx + half, 0);
    g.addColorStop(0, "#2e2a1e");
    g.addColorStop(0.35, "#5a4a32");
    g.addColorStop(0.62, "#4e5230");
    g.addColorStop(1, "#28261a");
    ctx.fillStyle = g;
    ctx.fillRect(cx - half, 0, half * 2, h);
    // Pruine claire et teinte verte par endroits.
    for (let i = 0; i < 14; i++) {
      const y = rnd() * h;
      ctx.fillStyle = rnd() < 0.5 ? "rgba(90,110,60,0.3)" : "rgba(120,70,60,0.22)";
      ctx.fillRect(cx - half, y, half * 2, h * (0.04 + rnd() * 0.08));
    }
    // Aiguillons crochus, pointe claire, tournés vers le pied.
    for (let y = 5; y < h - 4; y += h / 18 + rnd() * 3) {
      for (const side of [-1, 1]) {
        if (rnd() < 0.2) continue;
        const yy = y + (side > 0 ? h / 36 : 0);
        const bx = cx + side * half * 0.9;
        ctx.beginPath();
        ctx.moveTo(bx, yy - h * 0.018);
        ctx.lineTo(bx, yy + h * 0.018);
        ctx.quadraticCurveTo(bx + side * w * 0.14, yy + h * 0.02, bx + side * w * 0.2, yy + h * 0.045);
        ctx.closePath();
        const tg = ctx.createLinearGradient(bx, yy, bx + side * w * 0.2, yy + h * 0.04);
        tg.addColorStop(0, "#5a4032");
        tg.addColorStop(1, "#d8c8a4");
        ctx.fillStyle = tg;
        ctx.fill();
      }
    }
  }

  function paintBark(ctx, w, h, rnd) {
    ctx.fillStyle = "#5f5446";
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      const x = rnd() * w;
      ctx.fillStyle = rnd() < 0.5 ? "rgba(40,32,24,0.35)" : "rgba(150,140,120,0.25)";
      ctx.fillRect(x, rnd() * h, Math.max(1, w * 0.02), h * (0.1 + rnd() * 0.5));
    }
    for (let i = 0; i < 26; i++) {
      ctx.beginPath();
      ctx.arc(rnd() * w, rnd() * h, w * (0.02 + rnd() * 0.05), 0, TAU);
      ctx.fillStyle = rnd() < 0.5 ? "rgba(150,165,120,0.55)" : "rgba(95,120,55,0.55)";
      ctx.fill();
    }
  }

  function paintStipe(ctx, w, h) {
    const cx = w / 2;
    const half = w * 0.2;
    const g = ctx.createLinearGradient(cx - half, 0, cx + half, 0);
    g.addColorStop(0, "#3f4a22");
    g.addColorStop(0.45, "#7d8a3e");
    g.addColorStop(1, "#3a4020");
    ctx.fillStyle = g;
    ctx.fillRect(cx - half, 0, half * 2, h);
    const v = ctx.createLinearGradient(0, h, 0, 0);
    v.addColorStop(0, "rgba(70,45,25,0.7)");
    v.addColorStop(0.35, "rgba(70,45,25,0)");
    ctx.fillStyle = v;
    ctx.fillRect(cx - half, 0, half * 2, h);
  }

  function paintAtlas(size) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, size, size);
    const rnd = random(40127);
    const region = (name, painter, margin = 0.03) => {
      const [u0, v0, u1, v1] = REGION[name];
      const x = u0 * size;
      const y = v0 * size;
      const w = (u1 - u0) * size;
      const h = (v1 - v0) * size;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x + 1, y + 1, w - 2, h - 2);
      ctx.clip();
      ctx.translate(x + w * margin, y + h * margin * (w / h));
      painter(ctx, w * (1 - 2 * margin), h - 2 * h * margin * (w / h), rnd);
      ctx.restore();
    };
    region("frondA", (c, w, h, r) => paintFrond(c, w, h, r, FROND_A), 0.01);
    region("frondB", (c, w, h, r) => paintFrond(c, w, h, r, FROND_B), 0.01);
    region("bracken", (c, w, h, r) => paintBracken(c, w, h, r), 0.02);
    region("brambleA", (c, w, h, r) => paintBramble(c, w, h, r), 0.02);
    region("brambleB", (c, w, h, r) => paintBrambleCluster(c, w, h, r), 0.02);
    region("flower", (c, w, h, r) => paintFlower(c, w, h, r, false));
    region("flowerB", (c, w, h, r) => paintFlower(c, w, h, r, true));
    region("berry", (c, w, h, r) => paintBerries(c, w, h, r, true));
    region("berryB", (c, w, h, r) => paintBerries(c, w, h, r, false));
    region("sprig", (c, w, h, r) => paintSprig(c, w, h, r));
    region("ivy", (c, w, h, r) => paintIvy(c, w, h, r));
    region("litter", (c, w, h, r) => paintLitter(c, w, h, r));
    region("cane", (c, w, h, r) => paintCane(c, w, h, r), 0);
    region("bark", (c, w, h, r) => paintBark(c, w, h, r), 0.02);
    region("stipe", (c, w, h) => paintStipe(c, w, h), 0);
    return canvas;
  }

  /**
   * Sol du sous-bois : humus brun olive, mousses, feuilles et brindilles, sans raccord
   * (chaque motif est aussi dessiné de l'autre côté des bords).
   */
  function paintFloor(size) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d");
    const rnd = random(5309);
    ctx.fillStyle = "#4b4631";
    ctx.fillRect(0, 0, size, size);
    const wrap = (draw) => {
      for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) draw(dx, dy);
    };
    // Marbrures : humus sombre, terre plus claire, plaques de mousse.
    for (let i = 0; i < 90; i++) {
      const x = rnd() * size;
      const y = rnd() * size;
      const r = size * (0.04 + rnd() * 0.12);
      const colour = rnd() < 0.4 ? "rgba(38,32,20,0.35)" : rnd() < 0.6 ? "rgba(96,84,52,0.25)" : "rgba(70,96,40,0.3)";
      wrap((dx, dy) => {
        const g = ctx.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
        g.addColorStop(0, colour);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.fillRect(x + dx - r, y + dy - r, r * 2, r * 2);
      });
    }
    const pal = ["#6b5234", "#7a5c36", "#5a4428", "#8a6a3c", "#4e3c26", "#6e6038", "#7c6a40"];
    for (let i = 0; i < 260; i++) {
      const x = rnd() * size;
      const y = rnd() * size;
      const L = size * (0.018 + rnd() * 0.03);
      const a = rnd() * TAU;
      const colour = rgb(hexRgb(pick(rnd, pal)), 0.75 + rnd() * 0.35);
      wrap((dx, dy) => {
        if (x + dx < -L || x + dx > size + L || y + dy < -L || y + dy > size + L) return;
        ctx.save();
        ctx.translate(x + dx, y + dy);
        ctx.rotate(a);
        ctx.beginPath();
        ctx.ellipse(0, 0, L * 0.32, L * 0.62, 0, 0, TAU);
        ctx.fillStyle = colour;
        ctx.fill();
        ctx.restore();
      });
    }
    ctx.strokeStyle = "rgba(40,30,20,0.55)";
    ctx.lineCap = "round";
    for (let i = 0; i < 26; i++) {
      const x = rnd() * size;
      const y = rnd() * size;
      const a = rnd() * TAU;
      const l = size * (0.03 + rnd() * 0.07);
      ctx.lineWidth = Math.max(1, size * 0.005);
      wrap((dx, dy) => {
        ctx.beginPath();
        ctx.moveTo(x + dx, y + dy);
        ctx.lineTo(x + dx + Math.cos(a) * l, y + dy + Math.sin(a) * l);
        ctx.stroke();
      });
    }
    return canvas;
  }

  // --- Géométries --------------------------------------------------------------------------
  // Petits vecteurs [x, y, z].
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (a) => {
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  };
  const UP = [0, 1, 0];

  /** Accumulateur de sommets : position, normale, uv, couleur, aSway (souplesse, rôle, phase). */
  class Builder {
    constructor() {
      this.position = [];
      this.normal = [];
      this.uv = [];
      this.color = [];
      this.sway = [];
      this.index = [];
      this.count = 0;
    }
    v(p, n, u, v, c, s) {
      this.position.push(p[0], p[1], p[2]);
      this.normal.push(n[0], n[1], n[2]);
      this.uv.push(u, v);
      this.color.push(c[0], c[1], c[2]);
      this.sway.push(s[0], s[1], s[2]);
      return this.count++;
    }
    quad(a, b, c, d) {
      this.index.push(a, b, c, a, c, d);
    }
    geometry(THREE) {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(this.position, 3));
      g.setAttribute("normal", new THREE.Float32BufferAttribute(this.normal, 3));
      g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2));
      g.setAttribute("color", new THREE.Float32BufferAttribute(this.color, 3));
      g.setAttribute("aSway", new THREE.Float32BufferAttribute(this.sway, 3));
      g.setIndex(this.index);
      g.computeBoundingSphere();
      return g;
    }
  }

  /**
   * Fronde (ou limbe) : carte cintrée le long d'une nervure qui monte puis retombe, bords
   * légèrement abaissés, largeur qui épouse la fronde peinte. f : { root, azimuth, pitch0,
   * droop, length, roll, phase, shade, flex0, flexK }.
   */
  function frondCard(B, f, spec, region, segs, across, aspect) {
    const [u0, v0, u1, v1] = inset(region);
    const ca = Math.cos(f.azimuth);
    const sa = Math.sin(f.azimuth);
    const width = f.length * aspect;
    const step = f.length / segs;
    const cr = Math.cos(f.roll || 0);
    const sr = Math.sin(f.roll || 0);
    const out = [ca, 0, sa];
    let p = f.root.slice();
    let prev = null;
    const pitchAt = (s) => f.pitch0 - f.droop * Math.pow(s, 1.45);
    for (let k = 0; k <= segs; k++) {
      const s = k / segs;
      const pitch = pitchAt(s);
      const dir = [Math.cos(pitch) * ca, Math.sin(pitch), Math.cos(pitch) * sa];
      const side0 = [-sa, 0, ca];
      let faceUp = norm(cross(side0, dir));
      if (faceUp[1] < 0) faceUp = scl(faceUp, -1);
      const side = norm(add(scl(side0, cr), scl(faceUp, sr)));
      let face = norm(cross(side, dir));
      if (face[1] < 0) face = scl(face, -1);
      const env = cardEnvelope(s, spec);
      const hw = width * 0.5 * env;
      const nrm = norm(add(add(scl(face, 0.5), [0, 0.62, 0]), scl(out, 0.22)));
      const shade = mix(0.46, 1, smooth(0, 0.62, s)) * (f.shade || 1);
      const col = [shade, shade, shade];
      const v = v1 - (v1 - v0) * (0.012 + 0.976 * s);
      const uc = (u0 + u1) / 2;
      const uh = (u1 - u0) * 0.5 * env;
      const flex = (f.flex0 || 0) + s * (f.flexK ?? 1);
      const sw = [flex, 0, f.phase];
      const row = [];
      if (across === 3) {
        const drop = scl(face, -(spec.fold ?? 0.22) * hw);
        row.push(B.v(add(sub(p, scl(side, hw)), drop), nrm, uc - uh, v, col, sw));
        row.push(B.v(p, nrm, uc, v, col, sw));
        row.push(B.v(add(add(p, scl(side, hw)), drop), nrm, uc + uh, v, col, sw));
      } else {
        row.push(B.v(sub(p, scl(side, hw)), nrm, uc - uh, v, col, sw));
        row.push(B.v(add(p, scl(side, hw)), nrm, uc + uh, v, col, sw));
      }
      if (prev) for (let c = 0; c < row.length - 1; c++) B.quad(prev[c], prev[c + 1], row[c + 1], row[c]);
      prev = row;
      if (k < segs) {
        const pm = pitchAt((k + 0.5) / segs);
        p = [p[0] + Math.cos(pm) * ca * step, Math.max(0.01, p[1] + Math.sin(pm) * step), p[2] + Math.cos(pm) * sa * step];
      }
    }
  }

  /** Tige en rubans croisés (ou un seul ruban) le long d'une polyligne. */
  function stem(B, pts, widths, region, opts = {}) {
    const [u0, v0, u1, v1] = inset(region);
    const ribbons = opts.single ? [0] : [0, 1];
    const n = pts.length;
    for (const which of ribbons) {
      let prev = null;
      for (let k = 0; k < n; k++) {
        const dir = norm(sub(pts[Math.min(k + 1, n - 1)], pts[Math.max(k - 1, 0)]));
        let side = cross(dir, UP);
        side = Math.hypot(side[0], side[1], side[2]) < 1e-4 ? [1, 0, 0] : norm(side);
        if (which) side = norm(cross(dir, side));
        const hw = widths[k] / 2;
        const t = k / (n - 1);
        const v = v1 - (v1 - v0) * t * (opts.vScale ?? 1);
        const nrm = norm(add([0, 0.75, 0], scl(norm(cross(side, dir)), 0.35)));
        const shade = opts.shade ? opts.shade(t) : 1;
        const col = opts.colour ? opts.colour.map((c) => c * shade) : [shade, shade, shade];
        const sw = [opts.flex ? opts.flex(t) : t, 0, opts.phase || 0];
        const uA = opts.uNarrow ? u0 + (u1 - u0) * opts.uNarrow[0] : u0;
        const uB = opts.uNarrow ? u0 + (u1 - u0) * opts.uNarrow[1] : u1;
        const row = [B.v(sub(pts[k], scl(side, hw)), nrm, uA, v, col, sw), B.v(add(pts[k], scl(side, hw)), nrm, uB, v, col, sw)];
        if (prev) B.quad(prev[0], prev[1], row[1], row[0]);
        prev = row;
      }
    }
  }

  /**
   * Feuille posée sur une carte : pétiole en anchor, pointe dans la direction « along ».
   * Les feuilles peintes ont leur pétiole en bas de la case (6 % du bord).
   */
  function leafCard(B, anchor, along, size, region, opts = {}) {
    const [u0, v0, u1, v1] = inset(region);
    let across = cross(along, UP);
    across = Math.hypot(across[0], across[1], across[2]) < 1e-4 ? [1, 0, 0] : norm(across);
    const roll = opts.roll || 0;
    let up = norm(cross(across, along));
    if (up[1] < 0) up = scl(up, -1);
    across = norm(add(scl(across, Math.cos(roll)), scl(up, Math.sin(roll))));
    let face = norm(cross(across, along));
    if (face[1] < 0) face = scl(face, -1);
    const nrm = norm(add(scl(face, 0.55), [0, 0.6, 0]));
    const col = opts.colour || [1, 1, 1];
    const sw = [opts.flex ?? 1, opts.part || 0, opts.key ?? opts.phase ?? 0];
    const base = sub(anchor, scl(along, size * (opts.back ?? 0.06)));
    const tip = add(anchor, scl(along, size * (1 - (opts.back ?? 0.06))));
    const half = scl(across, size * 0.5);
    if (opts.fold) {
      const lift = scl(face, size * opts.fold);
      const bm = add(base, lift);
      const tm = add(tip, scl(lift, 0.6));
      const a = B.v(sub(base, half), nrm, u0, v1, col, sw);
      const b = B.v(bm, nrm, (u0 + u1) / 2, v1, col, sw);
      const c = B.v(add(base, half), nrm, u1, v1, col, sw);
      const d = B.v(sub(tip, half), nrm, u0, v0, col, sw);
      const e = B.v(tm, nrm, (u0 + u1) / 2, v0, col, sw);
      const f = B.v(add(tip, half), nrm, u1, v0, col, sw);
      B.quad(a, b, e, d);
      B.quad(b, c, f, e);
    } else {
      const a = B.v(sub(base, half), nrm, u0, v1, col, sw);
      const b = B.v(add(base, half), nrm, u1, v1, col, sw);
      const c = B.v(add(tip, half), nrm, u1, v0, col, sw);
      const d = B.v(sub(tip, half), nrm, u0, v0, col, sw);
      B.quad(a, b, c, d);
    }
  }

  function fernPlan(seed, count, outer) {
    const rnd = random(seed);
    const fronds = [];
    for (let i = 0; i < count; i++) {
      const isOuter = i < outer;
      const azimuth = i * 2.39996 + (rnd() - 0.5) * 0.35;
      fronds.push({
        azimuth,
        length: isOuter ? 0.8 + rnd() * 0.22 : 0.55 + rnd() * 0.2,
        pitch0: isOuter ? 1.12 + rnd() * 0.22 : 1.32 + rnd() * 0.16,
        droop: isOuter ? 0.95 + rnd() * 0.45 : 0.45 + rnd() * 0.3,
        roll: (rnd() - 0.5) * 0.55,
        phase: rnd(),
        shade: isOuter ? 0.88 + rnd() * 0.12 : 1.02 + rnd() * 0.1,
        root: [Math.cos(azimuth) * 0.035, 0.015, Math.sin(azimuth) * 0.035],
      });
    }
    return fronds;
  }
  function fernGeometry(THREE, spec, region, plan, far) {
    const B = new Builder();
    const list = far ? plan.slice(0, 6) : plan;
    for (const f of list) frondCard(B, f, spec, region, far ? 2 : 4, far ? 2 : 3, 0.25);
    return B.geometry(THREE);
  }

  function brackenGeometry(THREE) {
    const B = new Builder();
    const rnd = random(5501);
    for (let i = 0; i < 3; i++) {
      const az = i * 2.2 + rnd() * 0.8;
      const r = 0.06 + rnd() * 0.16;
      const root = [Math.cos(az) * r, 0, Math.sin(az) * r];
      const h = 0.4 + rnd() * 0.38;
      const top = [root[0] + (rnd() - 0.5) * 0.1, h, root[2] + (rnd() - 0.5) * 0.1];
      const mid = [(root[0] + top[0]) / 2 + (rnd() - 0.5) * 0.03, h * 0.5, (root[2] + top[2]) / 2 + (rnd() - 0.5) * 0.03];
      stem(B, [root, mid, top], [0.03, 0.026, 0.02], REGION.stipe, { flex: (t) => t * 0.45, phase: rnd() });
      frondCard(
        B,
        {
          root: top,
          azimuth: az + (rnd() - 0.5) * 1.4,
          length: 0.5 + rnd() * 0.24,
          pitch0: 0.2 + rnd() * 0.25,
          droop: 0.55 + rnd() * 0.3,
          roll: (rnd() - 0.5) * 0.35,
          phase: rnd(),
          shade: 0.95 + rnd() * 0.1,
          flex0: 0.45,
          flexK: 0.55,
        },
        BRACKEN,
        REGION.bracken,
        3,
        3,
        1,
      );
    }
    return B.geometry(THREE);
  }

  function bramblePlan(seed) {
    const rnd = random(seed);
    const canes = [];
    const n = 6;
    for (let i = 0; i < n; i++) {
      const az = (i / n) * TAU + (rnd() - 0.5) * 0.7;
      const r = rnd() * 0.14;
      const root = [Math.cos(az) * r, 0, Math.sin(az) * r];
      const length = 1.3 + rnd() * 0.8;
      const pitch0 = 1.36 + rnd() * 0.16;
      const droop = 2.05 + rnd() * 0.5;
      const pts = [root];
      const segs = 6;
      let p = root;
      for (let k = 0; k < segs; k++) {
        const s = (k + 0.5) / segs;
        const pitch = pitch0 - droop * s;
        p = [p[0] + Math.cos(pitch) * Math.cos(az) * (length / segs), Math.max(0.03, p[1] + Math.sin(pitch) * (length / segs)), p[2] + Math.cos(pitch) * Math.sin(az) * (length / segs)];
        pts.push(p);
      }
      const leaves = [];
      for (let s = 0.12 + rnd() * 0.05; s < 0.99; s += 0.065 + rnd() * 0.035) {
        const cluster = rnd() < 0.74;
        leaves.push({ s, side: leaves.length % 2 ? 1 : -1, size: cluster ? 0.38 + rnd() * 0.14 : 0.24 + rnd() * 0.08, cluster, tilt: 0.1 + rnd() * 0.4, roll: (rnd() - 0.5) * 0.7, yaw: (rnd() - 0.5) * 0.9, phase: rnd() });
      }
      const fruit = [];
      for (let k = 0; k < 2; k++) fruit.push({ s: 0.3 + rnd() * 0.5, kind: rnd(), size: 0.11 + rnd() * 0.05, key: rnd(), yaw: rnd() * TAU });
      canes.push({ pts, az, phase: rnd(), leaves, fruit });
    }
    const basal = [];
    for (let i = 0; i < 10; i++) basal.push({ az: (i / 10) * TAU + rnd() * 0.6, r: 0.1 + rnd() * 0.34, y: 0.04 + rnd() * 0.34, size: 0.34 + rnd() * 0.14, cluster: rnd() < 0.8, tilt: 0.15 + rnd() * 0.45, roll: (rnd() - 0.5) * 0.6, phase: rnd() });
    return { canes, basal };
  }
  function pointOn(pts, s) {
    const f = s * (pts.length - 1);
    const i = Math.min(pts.length - 2, Math.floor(f));
    const t = f - i;
    return [mix(pts[i][0], pts[i + 1][0], t), mix(pts[i][1], pts[i + 1][1], t), mix(pts[i][2], pts[i + 1][2], t)];
  }
  function brambleGeometry(THREE, plan, far) {
    const B = new Builder();
    for (const cane of plan.canes) {
      const pts = far ? cane.pts.filter((_, i) => i % 2 === 0) : cane.pts;
      const widths = pts.map((_, i) => mix(0.05, 0.03, i / (pts.length - 1)));
      stem(B, pts, widths, REGION.cane, { single: far, flex: (t) => 0.15 + 0.85 * t, phase: cane.phase, vScale: 2.2, shade: (t) => 0.62 + 0.22 * t });
      cane.leaves.forEach((leaf) => {
        if (far && !leaf.cluster) return;
        const p = pointOn(cane.pts, leaf.s);
        const q = pointOn(cane.pts, Math.min(1, leaf.s + 0.05));
        const dir = norm(sub(q, p));
        let side = cross(dir, UP);
        side = Math.hypot(side[0], side[1], side[2]) < 1e-4 ? [1, 0, 0] : norm(side);
        const out = norm(add(scl(side, leaf.side), scl([dir[0], 0, dir[2]], 0.6)));
        const ho = [out[0] * Math.cos(leaf.yaw) - out[2] * Math.sin(leaf.yaw), 0, out[0] * Math.sin(leaf.yaw) + out[2] * Math.cos(leaf.yaw)];
        const along = norm([ho[0] * Math.cos(leaf.tilt), Math.sin(leaf.tilt), ho[2] * Math.cos(leaf.tilt)]);
        const anchor = add(p, add(scl(side, leaf.side * 0.02), [0, 0.01, 0]));
        const shade = 0.9 + leaf.s * 0.14;
        leafCard(B, anchor, along, leaf.size, leaf.cluster ? REGION.brambleB : REGION.brambleA, { roll: leaf.roll, flex: 0.2 + 0.8 * leaf.s, phase: leaf.phase, back: 0.04, colour: [shade, shade, shade] });
      });
      if (!far)
        for (const fr of cane.fruit) {
          const p = pointOn(cane.pts, fr.s);
          const along = norm([Math.cos(fr.yaw) * 0.45, 0.9, Math.sin(fr.yaw) * 0.45]);
          const region = fr.kind < 0.3 ? REGION.flower : fr.kind < 0.5 ? REGION.flowerB : fr.kind < 0.8 ? REGION.berry : REGION.berryB;
          leafCard(B, add(p, [0, 0.04, 0]), along, fr.size, region, { part: fr.kind < 0.5 ? 1 : 2, key: fr.key, flex: 0.2 + 0.8 * fr.s, back: 0.5, roll: 0.5 });
        }
    }
    plan.basal.forEach((leaf, i) => {
      if (far && i % 2) return;
      const out = [Math.cos(leaf.az), 0, Math.sin(leaf.az)];
      const along = norm([out[0] * Math.cos(leaf.tilt), Math.sin(leaf.tilt), out[2] * Math.cos(leaf.tilt)]);
      const anchor = [out[0] * leaf.r * 0.4, leaf.y, out[2] * leaf.r * 0.4];
      leafCard(B, anchor, along, leaf.size, leaf.cluster ? REGION.brambleB : REGION.brambleA, { roll: leaf.roll, flex: 0.25, phase: leaf.phase, back: 0.04, colour: [0.8, 0.8, 0.8] });
    });
    return B.geometry(THREE);
  }

  function saplingGeometry(THREE) {
    const B = new Builder();
    const rnd = random(8123);
    const pts = [];
    let x = 0;
    let z = 0;
    for (let k = 0; k <= 5; k++) {
      pts.push([x, k * 0.2, z]);
      x += (rnd() - 0.5) * 0.04;
      z += (rnd() - 0.5) * 0.04;
    }
    stem(B, pts, pts.map((_, i) => mix(0.045, 0.016, i / 5)), REGION.bark, { flex: (t) => t * t, phase: rnd(), vScale: 0.6 });
    const tips = [];
    for (let i = 0; i < 4; i++) {
      const s = 0.42 + i * 0.15;
      const base = pointOn(pts, s);
      const az = i * 2.39996 + rnd() * 0.5;
      const pitch = 0.45 + rnd() * 0.4;
      const len = 0.28 + rnd() * 0.12;
      const end = add(base, [Math.cos(az) * Math.cos(pitch) * len, Math.sin(pitch) * len, Math.sin(az) * Math.cos(pitch) * len]);
      stem(B, [base, end], [0.018, 0.008], REGION.bark, { single: true, flex: () => s * s + 0.2, phase: rnd(), vScale: 0.3 });
      tips.push({ p: end, az, s });
    }
    tips.push({ p: pts[5], az: rnd() * TAU, s: 1 });
    const pal = [
      [1, 1, 1],
      [0.92, 0.98, 0.9],
      [1.05, 1.02, 0.92],
    ];
    for (const tip of tips) {
      for (let k = 0; k < 2; k++) {
        const az = tip.az + (k ? 0.9 : -0.9) + (rnd() - 0.5) * 0.4;
        const tilt = 0.35 + rnd() * 0.5;
        const along = norm([Math.cos(az) * Math.cos(tilt), Math.sin(tilt), Math.sin(az) * Math.cos(tilt)]);
        leafCard(B, tip.p, along, 0.3 + rnd() * 0.08, REGION.sprig, { roll: (rnd() - 0.5) * 0.8, flex: Math.min(1, tip.s + 0.2), phase: rnd(), colour: pick(rnd, pal) });
      }
    }
    return B.geometry(THREE);
  }

  /** Tapis au sol (lierre, feuilles mortes) : carte en léger dôme, pas de vent. */
  function groundGeometry(THREE, region) {
    const B = new Builder();
    const [u0, v0, u1, v1] = inset(region);
    const n = 3;
    const ids = [];
    for (let j = 0; j <= n; j++)
      for (let i = 0; i <= n; i++) {
        const x = i / n - 0.5;
        const z = j / n - 0.5;
        const r2 = (x * x + z * z) * 4;
        ids.push(B.v([x, 0.02 - 0.035 * r2, z], [0, 1, 0], mix(u0, u1, i / n), mix(v0, v1, j / n), [1, 1, 1], [0, 0, 0]));
      }
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) B.quad(ids[j * (n + 1) + i], ids[(j + 1) * (n + 1) + i], ids[(j + 1) * (n + 1) + i + 1], ids[j * (n + 1) + i + 1]);
    return B.geometry(THREE);
  }

  /** Branche morte couchée : tube principal et deux fourches, dessus moussu. */
  function branchGeometry(THREE) {
    const B = new Builder();
    const rnd = random(7717);
    const [u0, v0, u1, v1] = inset(REGION.bark);
    const tube = (pts, r0, r1, sides) => {
      const n = pts.length;
      const rings = [];
      for (let k = 0; k < n; k++) {
        const dir = norm(sub(pts[Math.min(k + 1, n - 1)], pts[Math.max(k - 1, 0)]));
        let nx = cross(dir, UP);
        nx = Math.hypot(nx[0], nx[1], nx[2]) < 1e-4 ? [1, 0, 0] : norm(nx);
        const ny = norm(cross(nx, dir));
        const r = mix(r0, r1, k / (n - 1));
        const ring = [];
        for (let s = 0; s <= sides; s++) {
          const a = (s / sides) * TAU;
          const n3 = norm(add(scl(nx, Math.cos(a)), scl(ny, Math.sin(a))));
          const moss = smooth(0.2, 0.8, n3[1]);
          const col = [mix(1, 0.62, moss), mix(1, 0.86, moss), mix(1, 0.42, moss)];
          ring.push(B.v(add(pts[k], scl(n3, r)), n3, mix(u0, u1, s / sides), mix(v1, v0, k / (n - 1)), col, [0, 0, 0]));
        }
        rings.push(ring);
      }
      for (let k = 0; k < n - 1; k++) for (let s = 0; s < sides; s++) B.quad(rings[k][s], rings[k][s + 1], rings[k + 1][s + 1], rings[k + 1][s]);
    };
    const main = [];
    for (let k = 0; k <= 4; k++) main.push([-0.5 + k * 0.25, 0.045 + (rnd() - 0.5) * 0.02, (rnd() - 0.5) * 0.05]);
    tube(main, 0.05, 0.022, 6);
    for (const [s, a, len] of [
      [0.62, 0.55, 0.34],
      [0.35, -0.7, 0.24],
    ]) {
      const base = pointOn(main, s);
      const end = add(base, [Math.cos(a) * len, 0.02, Math.sin(a) * len]);
      tube([base, [(base[0] + end[0]) / 2, base[1] + 0.012, (base[2] + end[2]) / 2], end], 0.022, 0.009, 4);
    }
    return B.geometry(THREE);
  }

  // --- Essences et mélanges ------------------------------------------------------------------
  // radius : emprise au sol (m, à l'échelle 1) ; scale : échelle tirée ; sink : enfoncement.
  const KINDS = {
    fern: { radius: 0.5, scale: [1.0, 1.75], sink: 0.03, stiff: 1, lods: 2 },
    lady: { radius: 0.46, scale: [0.95, 1.6], sink: 0.03, stiff: 1.15, lods: 2 },
    bracken: { radius: 0.42, scale: [1.0, 1.7], sink: 0.02, stiff: 0.8, lods: 1 },
    bramble: { radius: 0.85, scale: [0.8, 1.3], sink: 0.04, stiff: 0.5, lods: 2 },
    sapling: { radius: 0.35, scale: [1.1, 2.3], sink: 0.03, stiff: 0.45, lods: 1 },
    ivy: { radius: 0.5, scale: [1.0, 2.0], sink: 0, ground: true, lods: 1 },
    litter: { radius: 0.6, scale: [1.2, 2.6], sink: 0, ground: true, lods: 1 },
    branch: { radius: 0.5, scale: [0.9, 2.2], sink: 0.015, align: true, lods: 1 },
    stone: { radius: 0.4, scale: [0.16, 0.45], sink: 0.32, align: true, lods: 1 },
  };
  const KIND_NAMES = Object.keys(KINDS);
  const PLANTS = new Set(["fern", "lady", "bracken", "bramble", "sapling"]);
  const GRANITE = ["#c4bfb3", "#b5b0a5", "#cfc8b8", "#aba69c", "#bbb3a2", "#a9a398"];

  const MIXES = {
    fougeres: {
      label: "Fougères",
      spacing: 2.4,
      perM2: 3.0,
      spread: 0.42,
      litter: 0.3,
      ivy: 0,
      stone: 0.035,
      branch: 0.03,
      pick(n2, r) {
        if (n2 < 0.32 && r < 0.8) return "bracken";
        return r < 0.62 ? "fern" : "lady";
      },
    },
    ronces: {
      label: "Ronces",
      spacing: 3.1,
      perM2: 1.7,
      spread: 0.36,
      litter: 0.25,
      ivy: 0,
      stone: 0.02,
      branch: 0.05,
      pick(n2, r, edge) {
        if (r < 0.04) return "sapling";
        if (r < (edge < 0.5 ? 0.3 : 0.1)) return "fern";
        return "bramble";
      },
    },
    mele: {
      label: "Sous-bois mêlé",
      spacing: 2.7,
      perM2: 2.2,
      spread: 0.4,
      litter: 0.38,
      ivy: 0.55,
      stone: 0.13,
      branch: 0.11,
      pick(n2, r) {
        if (r < 0.06) return "sapling";
        if (n2 > 0.63) return r < 0.82 ? "bramble" : "fern";
        if (n2 < 0.3) return r < 0.72 ? "bracken" : "fern";
        return r < 0.55 ? "fern" : r < 0.88 ? "lady" : "bramble";
      },
    },
  };

  /**
   * Candidats d'une zone, sans tenir compte de ce qui les exclut (eau, chemins…) : une
   * graine par touffe, donc un chemin ajouté plus tard n'efface que les plantes qu'il
   * traverse. Touffes sur une grille jetée au hasard, plantes tirées autour de chaque
   * touffe, éclaircies sur les bords de la zone et dans les « clairières » d'un bruit doux.
   */
  function candidates(zone) {
    const mixSpec = MIXES[zone.mix];
    const poly = zone.points;
    const [x0, z0, x1, z1] = bounds(poly);
    const area = polygonArea(poly);
    const inradius = clamp((2 * area) / Math.max(1, perimeter(poly)), 1, 40);
    const band = clamp(inradius * 0.32, 0.6, 3.5);
    const d = zone.density;
    const sp = mixSpec.spacing * (1 + 1.1 * (1 - d));
    const perParent = mixSpec.perM2 * d * sp * sp;
    const sigma = sp * mixSpec.spread;
    const gapLevel = mix(0.4, 0.1, d);
    const seedN = zone.seed % 99991;
    const list = [];
    const spacing = new Map();
    const cellOf = (x, z) => Math.floor(x / 0.6) * 100003 + Math.floor(z / 0.6);
    const crowded = (x, z, r) => {
      const cx = Math.floor(x / 0.6);
      const cz = Math.floor(z / 0.6);
      for (let dx = -2; dx <= 2; dx++)
        for (let dz = -2; dz <= 2; dz++) {
          const bucket = spacing.get((cx + dx) * 100003 + cz + dz);
          if (!bucket) continue;
          for (const o of bucket) if ((o.x - x) ** 2 + (o.z - z) ** 2 < (0.36 * (o.r + r)) ** 2) return true;
        }
      return false;
    };
    const gx0 = Math.floor((x0 - sp * 0.5) / sp);
    const gx1 = Math.ceil((x1 + sp * 0.5) / sp);
    const gz0 = Math.floor((z0 - sp * 0.5) / sp);
    const gz1 = Math.ceil((z1 + sp * 0.5) / sp);
    const push = (c) => list.push(c);
    for (let gx = gx0; gx <= gx1; gx++)
      for (let gz = gz0; gz <= gz1; gz++) {
        const rnd = random((hash2(gx, gz, zone.seed) * 4294967296) >>> 0);
        const px = (gx + 0.5) * sp + (rnd() - 0.5) * sp * 0.9;
        const pz = (gz + 0.5) * sp + (rnd() - 0.5) * sp * 0.9;
        const patch = fbm(px * 0.085, pz * 0.085, seedN);
        const gapRoll = rnd();
        if (!insidePoly(px, pz, poly) && edgeDistance(px, pz, poly) > sigma * 2) continue;
        if (patch < gapLevel && gapRoll < 0.85) continue;
        const richness = 0.4 + 1.25 * smooth(gapLevel, 0.8, patch);
        const kids = Math.max(1, Math.round(perParent * richness * (0.7 + rnd() * 0.6)));
        for (let k = 0; k < kids; k++) {
          // Pied tiré autour de la touffe ; hors de la zone, on retente deux fois.
          let x = 0;
          let z = 0;
          let inside = false;
          for (let attempt = 0; attempt < 3 && !inside; attempt++) {
            const [ox, oz] = gauss(rnd);
            x = px + ox * sigma;
            z = pz + oz * sigma;
            inside = insidePoly(x, z, poly);
          }
          const rKind = rnd();
          const rScale = rnd();
          const rEdge = rnd();
          const rRot = rnd();
          const rTint = rnd();
          const rTint2 = rnd();
          const u = rnd();
          const phase = rnd();
          const variant = rnd();
          const tilt = rnd();
          if (!inside) continue;
          const edge = smooth(0, band, edgeDistance(x, z, poly));
          if (rEdge > 0.3 + 0.7 * edge) continue;
          const n2 = noise(x * 0.06 + 31.7, z * 0.06 - 12.3, seedN + 101);
          const kind = mixSpec.pick(n2, rKind, edge);
          const spec = KINDS[kind];
          const s = mix(spec.scale[0], spec.scale[1], rScale) * (0.72 + 0.28 * edge) * (0.92 + 0.16 * patch);
          const r = spec.radius * s;
          if (crowded(x, z, r)) continue;
          const key = cellOf(x, z);
          if (!spacing.has(key)) spacing.set(key, []);
          spacing.get(key).push({ x, z, r });
          push({ kind, x, z, s, rot: rRot * TAU, tint: rTint, tint2: rTint2, u, phase, variant, tilt });
        }
        // Tapis de feuilles mortes et de lierre, pierres moussues, bois mort.
        const rLitter = rnd();
        const rIvy = rnd();
        const rStone = rnd();
        const rBranch = rnd();
        const extras = [];
        if (rLitter < mixSpec.litter * (0.6 + patch)) extras.push(["litter", 1]);
        if (rIvy < mixSpec.ivy * (0.5 + patch)) extras.push(["ivy", 1 + Math.floor(rnd() * 3)]);
        if (rStone < mixSpec.stone) extras.push(["stone", 1 + Math.floor(rnd() * 3)]);
        if (rBranch < mixSpec.branch) extras.push(["branch", 1]);
        for (const [kind, count] of extras)
          for (let k = 0; k < count; k++) {
            const [ox, oz] = gauss(rnd);
            const spread = kind === "stone" ? 0.45 : kind === "ivy" ? 0.7 : 0.35;
            const x = px + ox * sigma * spread;
            const z = pz + oz * sigma * spread;
            const rScale = rnd();
            const rRot = rnd();
            const rTint = rnd();
            const rTint2 = rnd();
            const u = rnd();
            if (!insidePoly(x, z, poly)) continue;
            const edge = smooth(0, band, edgeDistance(x, z, poly));
            const spec = KINDS[kind];
            const s = mix(spec.scale[0], spec.scale[1], rScale) * (0.75 + 0.25 * edge);
            push({ kind, x, z, s, rot: rRot * TAU, tint: rTint, tint2: rTint2, u, phase: 0, variant: 0, tilt: 0.5 });
          }
      }
    return list;
  }

  const LIN = (hex) => {
    const c = hexRgb(hex).map((v) => v / 255);
    return c.map((v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  };
  /** Teinte linéaire d'une plante (multiplie l'atlas). */
  function tintOf(c) {
    const t = c.tint;
    const t2 = c.tint2;
    const b = 0.84 + 0.28 * t2;
    const bf = 0.76 + 0.26 * t2;
    switch (c.kind) {
      case "fern":
      case "lady": {
        if (t < 0.05) return [1.28 * bf, 0.86 * bf, 0.5 * bf]; // fronde qui roussit
        const warm = t < 0.5 ? mix(0.9, 1.08, t * 2) : 1;
        return [warm * bf, bf, mix(1.02, 0.86, t) * bf];
      }
      case "bracken":
        if (t < 0.1) return [1.3 * bf, 0.95 * bf, 0.58 * bf];
        return [mix(0.9, 1.02, t) * bf, bf, mix(0.96, 0.86, t) * bf];
      case "bramble": {
        const k = 0.72 + 0.2 * t2;
        return t < 0.2 ? [1.08 * k, 0.9 * k, 0.9 * k] : [k, k * mix(0.96, 1.04, t), k * 0.96];
      }
      case "sapling":
        return [mix(0.92, 1.08, t) * b, b, mix(1, 0.85, t) * b];
      case "ivy":
        return [0.9 * b, b, 0.9 * b];
      case "litter":
        return [mix(0.8, 1.12, t) * b, mix(0.8, 1.05, t) * b, mix(0.85, 1, t) * b];
      case "branch":
        return [0.9 * b, 0.88 * b, 0.84 * b];
      case "stone":
        return LIN(GRANITE[Math.floor(t * GRANITE.length)]).map((v) => v * mix(0.85, 1.08, t2));
      default:
        return [b, b, b];
    }
  }

  // --- Pictogrammes -------------------------------------------------------------------------
  const ICON = {
    fern: '<path d="M7 21c3-4 5-9 5-17"/><path d="M11.8 7.5 8 6M11.6 10.5 7.3 10M11 13.6l-3.8.6M10 16.6l-3 1.2M11.8 7.5l3.8-2.3M11.6 10.5l4.3-1.6M11 13.6l4.1-.6M10 16.6l3.6.3"/>',
    bramble: '<path d="M3 20c1.5-8 8-13.5 17-10"/><path d="M6.4 13.6 5 12.5M9.6 10.2 8.9 8.6M13.6 8.6l-.2-1.8"/><path d="M17.5 10.5c2 .6 3 2.6 2.2 4.8-2-.6-3-2.6-2.2-4.8Z"/><circle cx="12.2" cy="15.8" r="1.6"/><circle cx="15" cy="17.6" r="1.3"/>',
    mixed: '<path d="M5.5 21c.8-4.5.6-8.5-1.5-12"/><path d="M5 13.5 3 12.5M5.6 16.5l-2.4.2M5 13.5l2-1.4M5.6 16.5l2.4-.6"/><path d="M11 21c1.5-5 5.5-8.5 10-8"/><path d="M14.5 15.5l-.8-1.6M17.5 13.8l-.3-1.8"/><circle cx="19" cy="17.5" r="1.4"/><path d="M9 21h13"/><path d="M12.5 8.5c0-2.4 1.8-4.2 4.2-4.2 0 2.4-1.8 4.2-4.2 4.2Z"/>',
    zone: '<path d="M4.5 8.5 11 4l8.5 3.5L20 15l-6.5 5L5 17Z" stroke-dasharray="2.6 2.2"/><circle cx="4.5" cy="8.5" r="1.6" fill="currentColor"/><circle cx="11" cy="4" r="1.3" fill="currentColor"/><circle cx="19.5" cy="7.5" r="1.3" fill="currentColor"/>',
    back: '<path d="M10 7 5 12l5 5"/><path d="M5 12h14"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    undo: '<path d="M9 7 4 12l5 5"/><path d="M4 12h10a6 6 0 0 1 0 12h-3" transform="translate(0 -6)"/>',
    trash: '<path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13"/>',
    tools: '<path d="M4 6.5h2.5M4 12h2.5M4 17.5h2.5M10 6.5h10M10 12h10M10 17.5h10"/>',
  };
  const icon = (name, size = 20) =>
    `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name] || ""}</svg>`;
  const densityWord = (d) => (d < 0.32 ? "clairsemé" : d < 0.56 ? "aéré" : d < 0.8 ? "touffu" : "dense");
  const fmt = (n) => Math.round(n).toLocaleString("fr-FR");

  // --- Shaders ------------------------------------------------------------------------------
  const VERTEX_PARS = `attribute vec4 aSb;
attribute vec3 aSway;
uniform float uSbTime;
uniform float uSbWind;
uniform vec2 uSbDir;
uniform vec4 uSbLod;
varying float vSbUp;
`;
  // Éclaircissement avec la distance (u < part gardée), fondu en rentrant dans le sol, fleurs
  // et fruits sur certaines plantes seulement, puis vent : rafale qui traverse la zone et
  // frémissement propre à chaque fronde.
  const VERTEX_LOD = `
  #ifdef USE_INSTANCING
   vec3 sbRoot=(modelMatrix*vec4(instanceMatrix[3].xyz,1.)).xyz;
   vec3 sbAxisX=instanceMatrix[0].xyz,sbAxisZ=instanceMatrix[2].xyz;
   float sbHeight=length(instanceMatrix[1].xyz);
  #else
   vec3 sbRoot=(modelMatrix*vec4(0.,0.,0.,1.)).xyz;
   vec3 sbAxisX=vec3(1.,0.,0.),sbAxisZ=vec3(0.,0.,1.);
   float sbHeight=1.;
  #endif
  float sbDist=distance(sbRoot,cameraPosition);
  float sbKeep=uSbLod.x/max(sbDist,uSbLod.x);
  sbKeep*=sbKeep;
  float sbSize=smoothstep(aSb.x,aSb.x+.06,sbKeep)*(1.-smoothstep(uSbLod.y-uSbLod.z,uSbLod.y,sbDist));
  sbSize*=min(uSbLod.w,inversesqrt(max(sbKeep,.02)));`;
  const VERTEX_MAIN =
    `#include <begin_vertex>` +
    VERTEX_LOD +
    `
  if(aSway.y>.5)sbSize*=step(aSway.z,aSb.w);
  transformed*=sbSize;
  float sbFlex=aSway.x;
  if(sbFlex>0.&&uSbWind>.001&&sbSize>0.){
   float sbForce=clamp(uSbWind,0.,1.8);
   vec2 sbDir=normalize(uSbDir+vec2(.00001));
   float sbAlong=dot(sbRoot.xz,sbDir);
   float sbGust=.55+.45*sin(sbAlong*.085-uSbTime*(.7+.45*sbForce)+aSb.y*.6);
   float sbFlutter=sin(uSbTime*(2.3+1.3*sbForce)+aSb.y*6.2831+aSway.z*6.2831);
   float sbBend=sbFlex*sbFlex*(.035+.13*sbForce)*aSb.z*sbHeight*sbSize;
   vec2 sbPush=sbDir*sbBend*(sbGust+.32*sbFlutter);
   float sbLenX=max(.001,length(sbAxisX)),sbLenZ=max(.001,length(sbAxisZ));
   transformed.x+=dot(sbPush,sbAxisX.xz/sbLenX)/sbLenX;
   transformed.z+=dot(sbPush,sbAxisZ.xz/sbLenZ)/sbLenZ;
   transformed.y-=sbBend*(.22+.1*sbFlutter)/max(.001,sbHeight);
  }`;
  const VERTEX_UP = `#include <project_vertex>
  vSbUp=inverseTransformDirection(transformedNormal,viewMatrix).y;`;
  const FRAGMENT_PARS = `uniform float uSbCoverage;
uniform float uSbSnow;
varying float vSbUp;
`;
  // Atlas en alpha prémultiplié (décodé sRGB) : on retrouve la couleur des feuilles ; bords
  // découpés en couverture alpha sur l'écran anticrénelé, test alpha ailleurs.
  const FRAGMENT_ALPHA = `float sbAlpha=diffuseColor.a;
  diffuseColor.rgb/=max(pow(sbAlpha,2.2),.004);
  if(uSbCoverage>.5){
   diffuseColor.a=clamp((sbAlpha-.45)/max(fwidth(sbAlpha),.0001)+.5,0.,1.);
   if(diffuseColor.a<.02)discard;
  }else{
   if(sbAlpha<.5)discard;
   diffuseColor.a=1.;
  }
  if(uSbSnow>.001)diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.82,.9,.96),uSbSnow*.75*smoothstep(.15,.75,abs(vSbUp)));`;

  V32.register(
    "sous-bois",
    function (context) {
      const { THREE, game, hooks } = context;
      const root = hooks.root;
      const editor = game.editor;
      const panel = root && root.querySelector("[data-editor-panel]");
      const pane = root && root.querySelector('.v32-pane[data-v32-pane="plantes"]');
      if (!THREE || !editor || !pane || !panel || !game.terrainHeight || typeof editor.groundPoint !== "function") return null;
      const mobile = !!hooks.mobile;
      const BUDGET = mobile ? 6000 : 15000;

      // --- Interface --------------------------------------------------------------------
      const box = document.createElement("fieldset");
      box.className = "v32-bench v32-sousbois";
      box.innerHTML = `<legend>Sous-bois</legend>
        <p class="hint">Dessine une grande zone au sol : elle se remplit toute seule de plantes de sous-bois, en touffes, plus denses au cœur et plus clairsemées sur les bords. L’eau, les chemins, les murets, les ponts et les bâtiments restent dégagés.</p>
        <div class="tool-grid v32-big-tools v32-sb-mixes" role="group" aria-label="Plantes de la zone">
          <button type="button" class="btn" data-sb-mix="fougeres" aria-pressed="false">${icon("fern", 26)}<span>Fougères</span></button>
          <button type="button" class="btn" data-sb-mix="ronces" aria-pressed="false">${icon("bramble", 26)}<span>Ronces</span></button>
          <button type="button" class="btn" data-sb-mix="mele" aria-pressed="false">${icon("mixed", 26)}<span>Sous-bois mêlé</span></button>
        </div>
        <label class="slider-field"><span>Densité <output data-sb-density-value>touffu</output></span><input type="range" min=".15" max="1" step=".05" value=".65" data-sb-density aria-label="Densité de la prochaine zone"></label>
        <div class="v32-sb-scale" aria-hidden="true"><span>clairsemé</span><span>dense</span></div>
        <button type="button" class="btn wide v32-bench-start" data-sb-draw aria-pressed="false">${icon("zone", 20)}<span>Dessiner une zone</span></button>
        <p class="v32-bench-status" data-sb-status role="status">Aucune zone.</p>
        <div class="tool-grid two">
          <button type="button" class="btn" data-sb-back disabled>${icon("back", 18)}<span>Annuler le point</span></button>
          <button type="button" class="btn primary" data-sb-finish disabled>${icon("check", 18)}<span>Terminer</span></button>
        </div>
        <ol class="v32-sb-list" data-sb-list aria-label="Zones de sous-bois"></ol>
        <div class="tool-grid two">
          <button type="button" class="btn" data-sb-undo disabled>${icon("undo", 18)}<span>Annuler la dernière zone</span></button>
          <button type="button" class="btn" data-sb-clear disabled>${icon("trash", 18)}<span>Tout effacer</span></button>
        </div>`;
      const hint = pane.querySelector(".v32-pane-hint");
      if (hint) hint.after(box);
      else pane.prepend(box);
      const $ = (selector) => box.querySelector(selector);
      const densityInput = $("[data-sb-density]");
      const densityValue = $("[data-sb-density-value]");
      const drawButton = $("[data-sb-draw]");
      const statusLine = $("[data-sb-status]");
      const backButton = $("[data-sb-back]");
      const finishButton = $("[data-sb-finish]");
      const undoButton = $("[data-sb-undo]");
      const clearButton = $("[data-sb-clear]");
      const listEl = $("[data-sb-list]");
      const navigateBox = root.querySelector("[data-editor-navigate]");
      const collapseToggle = root.querySelector("[data-editor-collapse]");

      // Barre posée sur la vue pendant le tracé, quand le panneau des outils est replié : sur
      // téléphone, le panneau couvre presque toute la scène, il se replie de lui-même et
      // l'essentiel (où on en est, annuler, terminer, revenir aux outils) reste sous le pouce.
      const bar = document.createElement("div");
      bar.className = "v32-sb-bar";
      bar.hidden = true;
      bar.setAttribute("role", "group");
      bar.setAttribute("aria-label", "Tracé d’une zone de sous-bois");
      bar.innerHTML = `<p class="v32-sb-bar-head"><span class="v32-sb-swatch" data-sb-bar-swatch></span><span data-sb-bar-mix></span></p>
        <p class="v32-sb-bar-status" data-sb-bar-status aria-live="polite"></p>
        <div class="v32-sb-bar-actions">
          <button type="button" class="btn" data-sb-bar-back>${icon("back", 18)}<span>Annuler le point</span></button>
          <button type="button" class="btn primary" data-sb-bar-finish>${icon("check", 18)}<span>Terminer</span></button>
          <button type="button" class="btn" data-sb-bar-exit title="Arrêter de dessiner et revenir aux outils">${icon("tools", 18)}<span>Outils</span></button>
        </div>`;
      root.append(bar);
      const barSwatch = bar.querySelector("[data-sb-bar-swatch]");
      const barMix = bar.querySelector("[data-sb-bar-mix]");
      const barStatus = bar.querySelector("[data-sb-bar-status]");
      const barBack = bar.querySelector("[data-sb-bar-back]");
      const barFinish = bar.querySelector("[data-sb-bar-finish]");
      const barExit = bar.querySelector("[data-sb-bar-exit]");

      // --- État ---------------------------------------------------------------------------
      let zones = sanitize(V32.store.get(KEY, []));
      const settings = V32.store.get(KEY + "-reglages", null) || {};
      const state = {
        mix: MIX_IDS.includes(settings.mix) ? settings.mix : "fougeres",
        density: finite(settings.density) ? clamp(settings.density, 0.15, 1) : 0.65,
        drawing: false,
        points: [],
        navigateBefore: false,
        toolBefore: null,
        autoCollapsed: false,
        sessionZones: [],
        pending: zones.length > 0,
        message: "",
        clearArmed: 0,
        plants: 0,
        scale: 1,
        buildMs: 0,
        envKey: "",
        envCheck: 0,
      };
      densityInput.value = String(state.density);

      const group = new THREE.Group();
      group.name = "Sous_bois_v32";
      group.userData.exportSkip = true;
      game.scene.add(group);
      // Les reflets de l'eau n'ont pas besoin du sous-bois (bas, et déjà loin de l'eau).
      const hidden = game.waterFX20 && game.waterFX20.reflectionHidden;
      if (Array.isArray(hidden)) hidden.push(group);

      // --- Où rien ne pousse --------------------------------------------------------------
      const env = { walls: null, bridges: [], paths: null, trunks: null, objects: null, version: 0 };
      function hashSegments(list) {
        const grid = new Map();
        for (const seg of list) {
          const r = seg.r + 0.5;
          const cx0 = Math.floor((Math.min(seg.ax, seg.bx) - r) / 4);
          const cx1 = Math.floor((Math.max(seg.ax, seg.bx) + r) / 4);
          const cz0 = Math.floor((Math.min(seg.az, seg.bz) - r) / 4);
          const cz1 = Math.floor((Math.max(seg.az, seg.bz) + r) / 4);
          for (let x = cx0; x <= cx1; x++)
            for (let z = cz0; z <= cz1; z++) {
              const key = x * 100003 + z;
              if (!grid.has(key)) grid.set(key, []);
              grid.get(key).push(seg);
            }
        }
        return grid;
      }
      function nearSegment(grid, x, z) {
        const bucket = grid && grid.get(Math.floor(x / 4) * 100003 + Math.floor(z / 4));
        if (!bucket) return false;
        for (const s of bucket) if (segmentDistance(x, z, s.ax, s.az, s.bx, s.bz) < s.r) return true;
        return false;
      }
      function hashDiscs(list) {
        const grid = new Map();
        for (const d of list) {
          const cx0 = Math.floor((d.x - d.r) / 4);
          const cx1 = Math.floor((d.x + d.r) / 4);
          const cz0 = Math.floor((d.z - d.r) / 4);
          const cz1 = Math.floor((d.z + d.r) / 4);
          for (let x = cx0; x <= cx1; x++)
            for (let z = cz0; z <= cz1; z++) {
              const key = x * 100003 + z;
              if (!grid.has(key)) grid.set(key, []);
              grid.get(key).push(d);
            }
        }
        return grid;
      }
      function inDisc(grid, x, z) {
        const bucket = grid && grid.get(Math.floor(x / 4) * 100003 + Math.floor(z / 4));
        if (!bucket) return false;
        for (const d of bucket) if ((x - d.x) ** 2 + (z - d.z) ** 2 < d.r * d.r) return true;
        return false;
      }
      const lines = (points, r) => {
        const out = [];
        for (let i = 0; i < points.length - 1; i++) out.push({ ax: points[i][0], az: points[i][1], bx: points[i + 1][0], bz: points[i + 1][1], r });
        return out;
      };
      /** Signature de ce qui bouge dans l'atelier (sentiers, arbres, objets). */
      function environmentKey() {
        let key = "";
        try {
          for (const p of editor.getPaths ? editor.getPaths() : []) {
            const pts = p.points || p.line || [];
            let sum = 0;
            pts.forEach((q, i) => (sum += (q[0] * 0.37 + q[1] * 0.61) * (1 + (i % 7))));
            key += (p.id || p.name) + ":" + p.width + ":" + pts.length + ":" + sum.toFixed(1) + ";";
          }
        } catch {}
        const forest = game.forest;
        key += "|t" + (forest && forest.records ? forest.records.length : 0);
        const props = game.props;
        if (props && props.records) {
          let n = 0;
          let sx = 0;
          for (const r of props.records) {
            const cat = props.catalog && props.catalog.find((c) => c.id === r.type);
            if (cat && cat.category === "Végétation" && (cat.radius || 0) < 1.1) continue;
            n++;
            sx += r.x * 0.37 + r.z * 0.61;
          }
          key += "|o" + n + ":" + sx.toFixed(1);
        }
        return key;
      }
      function buildEnvironment() {
        const layout = game.siteLayout || {};
        const walls = [];
        for (const w of layout.hillWalls || []) if (w.points && w.points.length > 1) walls.push(...lines(w.points, (w.width || 0.5) / 2 + 0.45));
        for (const w of V32.extraWalls32 || []) if (w.points && w.points.length > 1) walls.push(...lines(w.points, (w.width || 0.5) / 2 + 0.45));
        if (layout.rearWall && layout.rearWall.length > 1) walls.push(...lines(layout.rearWall, 1.2));
        env.walls = hashSegments(walls);
        const bridges = [];
        for (const b of [...(game.walkBridges || []), ...((game.world21 && game.world21.bridgeSurfaces) || [])]) {
          const c = b.centre || (finite(b.x) ? [b.x, b.z] : null);
          if (!c) continue;
          bridges.push({ x: c[0], z: c[1], cos: Math.cos(b.angle || 0), sin: Math.sin(b.angle || 0), hl: (b.length || 3) / 2 + 1.3, hw: (b.width || 1.5) / 2 + 1.1 });
        }
        env.bridges = bridges;
        const paths = [];
        try {
          for (const p of editor.getPaths ? editor.getPaths() : []) {
            const pts = p.points || p.line;
            if (pts && pts.length > 1) paths.push(...lines(pts, (Number(p.width) || 1.2) / 2 + 0.4));
          }
        } catch {}
        env.paths = hashSegments(paths);
        const trunks = [];
        for (const t of (game.forest && game.forest.records) || []) if (finite(t.x) && finite(t.z)) trunks.push({ x: t.x, z: t.z, r: Math.max(0.18, (t.diameter || 0.5) / 2 + 0.14) });
        env.trunks = hashDiscs(trunks);
        const objects = [];
        const props = game.props;
        for (const r of (props && props.records) || []) {
          const cat = props.catalog && props.catalog.find((c) => c.id === r.type);
          if (!cat || !finite(r.x) || !finite(r.z)) continue;
          const scale = finite(r.scale) ? r.scale : 1;
          if (cat.category === "Végétation") {
            if ((cat.radius || 0) >= 1.1) objects.push({ x: r.x, z: r.z, r: cat.radius * scale * 0.45 });
          } else objects.push({ x: r.x, z: r.z, r: (cat.radius || 0.6) * scale * 0.85 + 0.2 });
        }
        env.objects = hashDiscs(objects);
        env.version++;
        allowedCache.clear();
      }
      function ensureEnvironment() {
        if (state.envKey) return;
        state.envKey = environmentKey();
        buildEnvironment();
      }
      const grassAllowed = game.groundLife22 && typeof game.groundLife22.grassAllowed === "function" ? (x, z) => game.groundLife22.grassAllowed(x, z) : null;
      const terrainAllowed = typeof editor.terrainAllowed === "function" ? (x, z) => editor.terrainAllowed(x, z) : null;
      function computeAllowed(x, z) {
        // Premier tracé de la session (aucune zone encore) : les tables ne sont pas prêtes.
        ensureEnvironment();
        // D'abord les exclusions rapides (tables par cases de 4 m), puis celles du jeu.
        if (nearSegment(env.walls, x, z) || nearSegment(env.paths, x, z)) return false;
        if (inDisc(env.trunks, x, z) || inDisc(env.objects, x, z)) return false;
        for (const b of env.bridges) {
          const dx = x - b.x;
          const dz = z - b.z;
          if (Math.abs(dx * b.cos - dz * b.sin) < b.hl && Math.abs(dx * b.sin + dz * b.cos) < b.hw) return false;
        }
        if (!Number.isFinite(game.terrainHeight(x, z))) return false;
        if (terrainAllowed && !terrainAllowed(x, z)) return false;
        if (grassAllowed && !grassAllowed(x, z)) return false;
        if (!terrainAllowed) {
          if (game.protectedSite && game.protectedSite(x, z)) return false;
          if (game.wetAt && game.wetAt([x, z], 0.7)) return false;
        }
        return true;
      }
      // Réponses gardées par cases de 50 cm (les marges des exclusions sont plus larges).
      const allowedCache = new Map();
      function allowedAt(x, z) {
        const ix = Math.round(x * 2);
        const iz = Math.round(z * 2);
        const key = ix * 65536 + iz;
        let v = allowedCache.get(key);
        if (v === undefined) {
          v = computeAllowed(ix / 2, iz / 2);
          allowedCache.set(key, v);
        }
        return v;
      }
      /** Plante entière sur un sol libre : le pied et quatre points de son emprise. */
      function footprintAllowed(c) {
        if (!allowedAt(c.x, c.z)) return false;
        const r = KINDS[c.kind].radius * c.s * (KINDS[c.kind].ground ? 0.4 : 0.62);
        if (r < 0.25) return true;
        return allowedAt(c.x + r, c.z) && allowedAt(c.x - r, c.z) && allowedAt(c.x, c.z + r) && allowedAt(c.x, c.z - r);
      }

      // --- Atlas, matières, formes (au premier besoin) -------------------------------------
      let kit = null;
      const lodSettings = () => {
        const q = hooks.getQuality ? hooks.getQuality() : "balanced";
        const k = q === "fast" ? 0.72 : q === "detail" ? 1.25 : 1;
        return mobile ? { near: 11 * k, thin: 22 * k, cut: 150 * k, fade: 30 * k, max: 2.4 } : { near: 18 * k, thin: 34 * k, cut: 240 * k, fade: 40 * k, max: 2.4 };
      };
      function makeKit() {
        const started = performance.now();
        const size = mobile ? 512 : 1024;
        const canvas = paintAtlas(size);
        const texture = new THREE.CanvasTexture(canvas);
        texture.flipY = false;
        texture.premultiplyAlpha = true;
        texture.magFilter = THREE.LinearFilter;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.generateMipmaps = true;
        texture.anisotropy = 4;
        texture.encoding = THREE.sRGBEncoding;
        texture.needsUpdate = true;
        texture.name = "Atlas_sous_bois_v32";
        const paintMs = performance.now() - started;
        // Anticrénelage de l'écran : on le sait par les arbres (sans interroger la carte
        // graphique, ce qui bloquerait le rendu en cours).
        let msaa = false;
        try {
          const trees = game.forest && game.forest.kit;
          if (trees && typeof trees.msaa === "boolean") msaa = trees.msaa;
          else msaa = !!(game.renderer.getContext().getContextAttributes() || {}).antialias;
        } catch {}
        const lod = lodSettings();
        const uniforms = {
          coverage: { value: 0 },
          lod: { value: new THREE.Vector4(lod.thin, lod.cut, lod.fade, lod.max) },
          snow: (game.weather && game.weather.uniforms && game.weather.uniforms.snow) || { value: 0 },
        };
        const patchFoliage = (shader) => {
          shader.uniforms.uSbTime = V32.uniforms.time;
          shader.uniforms.uSbWind = V32.uniforms.wind;
          shader.uniforms.uSbDir = V32.uniforms.windDirection;
          shader.uniforms.uSbLod = uniforms.lod;
          shader.uniforms.uSbCoverage = uniforms.coverage;
          shader.uniforms.uSbSnow = uniforms.snow;
          shader.vertexShader = VERTEX_PARS + shader.vertexShader.replace("#include <begin_vertex>", VERTEX_MAIN).replace("#include <project_vertex>", VERTEX_UP);
          // Les deux faces d'une carte s'éclairent comme le dessus de la plante.
          shader.vertexShader = shader.vertexShader.replace(
            "#include <lights_lambert_vertex>",
            `#include <lights_lambert_vertex>
  #ifdef DOUBLE_SIDED
   vLightBack=vLightFront;vIndirectBack=vIndirectFront;
  #endif`,
          );
          shader.fragmentShader = FRAGMENT_PARS + shader.fragmentShader.replace("#include <alphatest_fragment>", FRAGMENT_ALPHA);
        };
        const foliage = (name, ground) => {
          const material = new THREE.MeshLambertMaterial({ color: 0xffffff, map: texture, vertexColors: true, side: THREE.DoubleSide });
          material.name = name;
          material.extensions = { derivatives: true };
          material.alphaToCoverage = msaa;
          if (ground) {
            material.polygonOffset = true;
            material.polygonOffsetFactor = -2;
            material.polygonOffsetUnits = -2;
          }
          V32.patchMaterial(material, "sous-bois", patchFoliage);
          return material;
        };
        const leaves = foliage("Sous_bois_feuillages_v32", false);
        const carpet = foliage("Sous_bois_tapis_v32", true);
        // Pierres moussues : la matière des pierres sèches, avec le même éclaircissement.
        let rock = null;
        if (V32.stones) {
          rock = V32.stones.rockMaterial(hooks, "sous-bois", { moss: 0.9, damp: 0.2 });
          V32.patchMaterial(rock, "sous-bois-lod", (shader) => {
            shader.uniforms.uSbLod = uniforms.lod;
            shader.vertexShader = "attribute vec4 aSb;\nuniform vec4 uSbLod;\n" + shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>" + VERTEX_LOD + "\n  transformed*=sbSize;");
          });
        }
        const fernA = fernPlan(3311, 9, 6);
        const fernB = fernPlan(4422, 10, 6);
        const bramble = bramblePlan(6661);
        const geometries = {
          fern: [fernGeometry(THREE, FROND_A, REGION.frondA, fernA, false), fernGeometry(THREE, FROND_A, REGION.frondA, fernA, true)],
          lady: [fernGeometry(THREE, FROND_B, REGION.frondB, fernB, false), fernGeometry(THREE, FROND_B, REGION.frondB, fernB, true)],
          bracken: [brackenGeometry(THREE)],
          bramble: [brambleGeometry(THREE, bramble, false), brambleGeometry(THREE, bramble, true)],
          sapling: [saplingGeometry(THREE)],
          ivy: [groundGeometry(THREE, REGION.ivy)],
          litter: [groundGeometry(THREE, REGION.litter)],
          branch: [branchGeometry(THREE)],
          stone: [
            V32.stones
              ? V32.stones.boulderGeometry({ detail: 1, seed: 913, squash: 0.62, bump: 0.2, cuts: 6, bottom: -0.3, smoothness: 0.55 })
              : new THREE.IcosahedronGeometry(1, 1),
          ],
        };
        // Sol du sous-bois : humus en voile sous les zones (bords fondus, jamais sur un
        // chemin), qui s'efface sous la neige. Une seule géométrie pour toutes les zones.
        const floorTexture = new THREE.CanvasTexture(paintFloor(mobile ? 128 : 256));
        floorTexture.wrapS = floorTexture.wrapT = THREE.RepeatWrapping;
        floorTexture.encoding = THREE.sRGBEncoding;
        floorTexture.anisotropy = 4;
        floorTexture.name = "Humus_sous_bois_v32";
        const floorMaterial = new THREE.MeshLambertMaterial({
          color: 0xffffff,
          map: floorTexture,
          vertexColors: true,
          transparent: true,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -3,
        });
        floorMaterial.name = "Sol_du_sous_bois_v32";
        V32.patchMaterial(floorMaterial, "sous-bois-sol", (shader) => {
          shader.uniforms.uSbSnow = uniforms.snow;
          shader.fragmentShader = "uniform float uSbSnow;\n" + shader.fragmentShader.replace("#include <color_fragment>", "#include <color_fragment>\n  diffuseColor.a *= 1.0 - clamp(uSbSnow, 0.0, 1.0);");
        });
        const floor = new THREE.Mesh(new THREE.BufferGeometry(), floorMaterial);
        floor.name = "Sol_du_sous_bois_v32";
        floor.receiveShadow = true;
        floor.visible = false;
        floor.userData.exportSkip = true;
        group.add(floor);
        const materials = { fern: leaves, lady: leaves, bracken: leaves, bramble: leaves, sapling: leaves, branch: leaves, ivy: carpet, litter: carpet, stone: rock || leaves };
        const onBeforeRender = (renderer) => {
          uniforms.coverage.value = msaa && !renderer.getRenderTarget() ? 1 : 0;
        };
        const batches = {};
        for (const name of KIND_NAMES) batches[name] = new Batch(name, geometries[name], materials[name], onBeforeRender);
        const triangles = {};
        for (const name of KIND_NAMES) triangles[name] = geometries[name].map((g) => (g.index ? g.index.count : g.attributes.position.count) / 3);
        kit = { texture, canvas, uniforms, msaa, batches, triangles, floor, ms: Math.round(performance.now() - started), paintMs: Math.round(paintMs), materials: [leaves, carpet, rock, floorMaterial].filter(Boolean) };
        return kit;
      }

      /** Un InstancedMesh par niveau de détail ; les données sont triées à chaque déplacement. */
      class Batch {
        constructor(name, geometries, material, onBeforeRender) {
          this.name = name;
          this.geometries = geometries;
          this.material = material;
          this.onBeforeRender = onBeforeRender;
          this.lods = geometries.length;
          this.meshes = [];
          this.capacity = 0;
          this.data = { n: 0, pos: new Float32Array(0), mat: new Float32Array(0), col: new Float32Array(0), inst: new Float32Array(0), near: new Uint8Array(0) };
          this.drawn = [0, 0];
        }
        ensure(n) {
          if (n <= this.capacity) return;
          const capacity = Math.max(64, Math.ceil(n * 1.25));
          for (const mesh of this.meshes) {
            group.remove(mesh);
            mesh.geometry.dispose();
            mesh.dispose && mesh.dispose();
          }
          this.meshes = this.geometries.map((shape, lod) => {
            const geometry = new THREE.BufferGeometry();
            for (const key of Object.keys(shape.attributes)) geometry.setAttribute(key, shape.attributes[key]);
            if (shape.index) geometry.setIndex(shape.index);
            geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
            const inst = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
            inst.setUsage(THREE.DynamicDrawUsage);
            geometry.setAttribute("aSb", inst);
            const mesh = new THREE.InstancedMesh(geometry, this.material, capacity);
            mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
            mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
            mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
            mesh.count = 0;
            mesh.visible = false;
            mesh.name = "Sous_bois_v32_" + this.name + (this.lods > 1 ? (lod ? "_loin" : "_pres") : "");
            mesh.frustumCulled = false;
            mesh.castShadow = false;
            mesh.receiveShadow = true;
            mesh.userData.exportSkip = true;
            mesh.onBeforeRender = this.onBeforeRender;
            group.add(mesh);
            return mesh;
          });
          this.capacity = capacity;
        }
        setData(data) {
          this.data = data;
          this.ensure(data.n);
        }
        /** Plantes à dessiner depuis cette caméra (pré-éclaircies, dans le champ). */
        classify(c, lod) {
          const d = this.data;
          const n = d.n;
          const counts = [0, 0];
          if (!this.meshes.length) return false;
          const targets = this.meshes.map((m) => [m.instanceMatrix.array, m.instanceColor.array, m.geometry.attributes.aSb.array]);
          const cut = lod.cut + 3;
          const cut2 = cut * cut;
          const nearIn = lod.near - 2;
          const nearOut = lod.near + 2;
          for (let i = 0; i < n; i++) {
            const dx = d.pos[i * 3] - c.x;
            const dy = d.pos[i * 3 + 1] - c.y;
            const dz = d.pos[i * 3 + 2] - c.z;
            const d2 = dx * dx + dy * dy + dz * dz;
            if (d2 > cut2) continue;
            const dist = Math.sqrt(d2);
            if (dist > 4 && dx * c.fx + dy * c.fy + dz * c.fz < c.cos * dist) continue;
            const dm = Math.max(dist - 3, lod.thin);
            const keep = (lod.thin / dm) * (lod.thin / dm);
            if (d.inst[i * 4] > keep + 0.07) continue;
            let lodIndex = 0;
            if (this.lods > 1) {
              const near = dist < (d.near[i] ? nearOut : nearIn);
              d.near[i] = near ? 1 : 0;
              lodIndex = near ? 0 : 1;
            }
            const j = counts[lodIndex]++;
            const [m, col, inst] = targets[lodIndex];
            const mo = j * 16;
            const mi = i * 16;
            for (let k = 0; k < 16; k++) m[mo + k] = d.mat[mi + k];
            col[j * 3] = d.col[i * 3];
            col[j * 3 + 1] = d.col[i * 3 + 1];
            col[j * 3 + 2] = d.col[i * 3 + 2];
            inst[j * 4] = d.inst[i * 4];
            inst[j * 4 + 1] = d.inst[i * 4 + 1];
            inst[j * 4 + 2] = d.inst[i * 4 + 2];
            inst[j * 4 + 3] = d.inst[i * 4 + 3];
          }
          let changed = false;
          this.meshes.forEach((mesh, lodIndex) => {
            const count = counts[lodIndex];
            if (count || mesh.count) changed = true;
            mesh.count = count;
            mesh.visible = count > 0;
            if (!count) return;
            for (const [attr, size] of [
              [mesh.instanceMatrix, 16],
              [mesh.instanceColor, 3],
              [mesh.geometry.attributes.aSb, 4],
            ]) {
              attr.updateRange.offset = 0;
              attr.updateRange.count = count * size;
              attr.needsUpdate = true;
            }
          });
          this.drawn = counts;
          return changed;
        }
        get count() {
          return this.data.n;
        }
      }

      // --- Plantation ------------------------------------------------------------------------
      const cache = new WeakMap(); // zone → { list, kept, env }
      /**
       * Candidats et tri d'une zone (gardés tant que rien ne change autour). Avec une
       * échéance, le tri s'interrompt et reprend à l'image suivante (renvoie null).
       */
      function zoneCache(zone, deadline = Infinity) {
        let entry = cache.get(zone);
        if (!entry) {
          const t0 = performance.now();
          entry = { list: candidates(zone), kept: null, env: -1, work: null, ms: {} };
          entry.ms.candidates = Math.round(performance.now() - t0);
          cache.set(zone, entry);
        }
        if (entry.env !== env.version) {
          if (!entry.work || entry.work.env !== env.version) entry.work = { env: env.version, i: 0, kept: [], ms: 0 };
          const work = entry.work;
          const t1 = performance.now();
          const list = entry.list;
          while (work.i < list.length) {
            const c = list[work.i++];
            if (footprintAllowed(c)) work.kept.push(c);
            if ((work.i & 127) === 0 && performance.now() > deadline) break;
          }
          work.ms += performance.now() - t1;
          if (work.i < list.length) return null;
          const t2 = performance.now();
          entry.kept = work.kept;
          entry.floor = floorPart(zone);
          entry.ms.filter = Math.round(work.ms);
          entry.ms.floor = Math.round(performance.now() - t2);
          entry.env = env.version;
          entry.work = null;
        }
        return entry;
      }
      // Voile d'humus d'une zone : grille posée sur le relief, opacité fondue vers les bords
      // et nulle sur ce qui est exclu (eau, chemins, murets…), un peu tachée.
      const FLOOR = { fougeres: [[0.95, 1, 0.9], 0.5], ronces: [[0.84, 0.8, 0.74], 0.56], mele: [[1, 0.94, 0.88], 0.58] };
      function floorPart(zone) {
        const poly = zone.points;
        const [x0, z0, x1, z1] = bounds(poly);
        const area = polygonArea(poly);
        const cell = clamp(Math.sqrt(area) / 70, 0.6, 1.6);
        const nx = Math.ceil((x1 - x0) / cell) + 1;
        const nz = Math.ceil((z1 - z0) / cell) + 1;
        const band = clamp(((2 * area) / Math.max(1, perimeter(poly))) * 0.5, 0.8, 4);
        const [tint, strength] = FLOOR[zone.mix];
        const top = strength * (0.55 + 0.45 * zone.density);
        const seedN = zone.seed % 99991;
        const position = new Float32Array(nx * nz * 3);
        const color = new Float32Array(nx * nz * 4);
        const uv = new Float32Array(nx * nz * 2);
        const alpha = new Float32Array(nx * nz);
        for (let j = 0; j < nz; j++)
          for (let i = 0; i < nx; i++) {
            const k = j * nx + i;
            const x = x0 + i * cell;
            const z = z0 + j * cell;
            let a = 0;
            if (insidePoly(x, z, poly) && allowedAt(x, z)) a = top * smooth(0, band, edgeDistance(x, z, poly)) * (0.5 + 0.5 * fbm(x * 0.16, z * 0.16, seedN + 7));
            const shade = 0.88 + 0.24 * noise(x * 0.3, z * 0.3, seedN + 9);
            alpha[k] = a;
            position.set([x, game.terrainHeight(x, z) + 0.04, z], k * 3);
            color.set([tint[0] * shade, tint[1] * shade, tint[2] * shade, a], k * 4);
            uv.set([x / 2.4, z / 2.4], k * 2);
          }
        const index = [];
        for (let j = 0; j < nz - 1; j++)
          for (let i = 0; i < nx - 1; i++) {
            const a = j * nx + i;
            if (alpha[a] + alpha[a + 1] + alpha[a + nx] + alpha[a + nx + 1] < 0.02) continue;
            index.push(a, a + nx, a + 1, a + 1, a + nx, a + nx + 1);
          }
        return { position, color, uv, index, count: nx * nz };
      }
      function rebuildFloor(entries) {
        const floor = kit.floor;
        let vertices = 0;
        let indices = 0;
        for (const e of entries) {
          if (!e.floor.index.length) continue;
          vertices += e.floor.count;
          indices += e.floor.index.length;
        }
        floor.geometry.dispose();
        const geometry = new THREE.BufferGeometry();
        if (indices) {
          const position = new Float32Array(vertices * 3);
          const color = new Float32Array(vertices * 4);
          const uv = new Float32Array(vertices * 2);
          const index = vertices > 65535 ? new Uint32Array(indices) : new Uint16Array(indices);
          let v = 0;
          let n = 0;
          for (const e of entries) {
            const f = e.floor;
            if (!f.index.length) continue;
            position.set(f.position, v * 3);
            color.set(f.color, v * 4);
            uv.set(f.uv, v * 2);
            for (const i of f.index) index[n++] = i + v;
            v += f.count;
          }
          geometry.setAttribute("position", new THREE.BufferAttribute(position, 3));
          const normal = new Float32Array(vertices * 3);
          for (let i = 1; i < normal.length; i += 3) normal[i] = 1;
          geometry.setAttribute("normal", new THREE.BufferAttribute(normal, 3));
          geometry.setAttribute("color", new THREE.BufferAttribute(color, 4));
          geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
          geometry.setIndex(new THREE.BufferAttribute(index, 1));
          geometry.computeBoundingSphere();
        }
        floor.geometry = geometry;
        floor.visible = indices > 0;
        state.floorTriangles = indices / 3;
      }
      const _m = new THREE.Matrix4();
      const _q = new THREE.Quaternion();
      const _q2 = new THREE.Quaternion();
      const _p = new THREE.Vector3();
      const _s = new THREE.Vector3();
      const _n = new THREE.Vector3();
      const _up = new THREE.Vector3(0, 1, 0);
      const _v = new THREE.Vector3();
      function groundNormal(x, z) {
        const e = 0.45;
        const h = game.terrainHeight;
        return _n.set(h(x - e, z) - h(x + e, z), 2 * e, h(x, z - e) - h(x, z + e)).normalize();
      }
      /** Toutes les zones → tableaux par essence (dans la limite du budget). */
      function rebuild() {
        const started = performance.now();
        if (!zones.length && !kit) {
          state.plants = 0;
          state.scale = 1;
          return;
        }
        if (!kit) makeKit();
        ensureEnvironment();
        const entries = zones.map((zone) => zoneCache(zone));
        let total = 0;
        for (const e of entries) total += e.kept.length;
        const fraction = total > BUDGET ? BUDGET / total : 1;
        state.scale = fraction;
        const buckets = {};
        for (const name of KIND_NAMES) buckets[name] = [];
        entries.forEach((e, zi) => {
          // Compte des plantes seules (pierres, bois mort et tapis de feuilles à part).
          let n = 0;
          for (const c of e.kept) {
            if (c.u >= fraction) continue;
            buckets[c.kind].push(c);
            if (PLANTS.has(c.kind)) n++;
          }
          zones[zi]._count = n;
        });
        let plants = 0;
        for (const name of KIND_NAMES) {
          const list = buckets[name];
          const spec = KINDS[name];
          const n = list.length;
          const data = { n, pos: new Float32Array(n * 3), mat: new Float32Array(n * 16), col: new Float32Array(n * 3), inst: new Float32Array(n * 4), near: new Uint8Array(n) };
          list.forEach((c, i) => {
            const y = game.terrainHeight(c.x, c.z);
            const sink = spec.sink * c.s;
            const normal = groundNormal(c.x, c.z);
            if (spec.ground || spec.align) {
              // Posé à plat sur la pente.
              _q.setFromUnitVectors(_up, normal);
            } else {
              // Debout, un peu penché au hasard, avec une part de la pente.
              _v.set(normal.x * 0.3 + (c.tilt - 0.5) * 0.18, 1, normal.z * 0.3 + (c.phase - 0.5) * 0.18).normalize();
              _q.setFromUnitVectors(_up, _v);
            }
            _q2.setFromAxisAngle(_up, c.rot);
            _q.multiply(_q2);
            const s = c.s;
            if (name === "stone") _s.set(s * (0.95 + c.tint2 * 0.35), s * (0.7 + c.tint * 0.3), s * (0.9 + c.phase * 0.2));
            else if (name === "branch") _s.set(s, s * 0.9, s * 0.9);
            else _s.set(s * (0.94 + c.tint2 * 0.12), s * (0.9 + c.variant * 0.2), s * (0.94 + c.tint * 0.12));
            _p.set(c.x, y - sink - (spec.ground ? 0 : 0.005), c.z);
            _m.compose(_p, _q, _s);
            _m.toArray(data.mat, i * 16);
            data.pos[i * 3] = c.x;
            data.pos[i * 3 + 1] = y + s * 0.4;
            data.pos[i * 3 + 2] = c.z;
            const tint = tintOf(c);
            data.col[i * 3] = tint[0];
            data.col[i * 3 + 1] = tint[1];
            data.col[i * 3 + 2] = tint[2];
            data.inst[i * 4] = Math.min(0.999, c.u / fraction);
            data.inst[i * 4 + 1] = c.phase * 6.2831;
            data.inst[i * 4 + 2] = spec.stiff ? spec.stiff * (0.8 + c.tint2 * 0.4) : 0;
            // Ronces : fleurs et mûres sur une plante sur deux, plus ou moins nombreuses.
            data.inst[i * 4 + 3] = name === "bramble" ? (c.variant < 0.5 ? 0 : (c.variant - 0.5) * 2) : 0;
          });
          kit.batches[name].setData(data);
          if (PLANTS.has(name)) plants += n;
        }
        state.plants = plants;
        state.instances = Object.values(buckets).reduce((sum, list) => sum + list.length, 0);
        state.total = total;
        rebuildFloor(entries);
        camera.force = true;
        classify();
        state.buildMs = Math.round(performance.now() - started);
        hooks.markDirty();
      }

      // --- Niveau de détail : tri des plantes selon la caméra -------------------------------
      const camera = { force: true, x: 0, y: 0, z: 0, fx: 0, fy: 0, fz: -1, fov: 0, aspect: 0, quality: "" };
      const _cp = new THREE.Vector3();
      const _cd = new THREE.Vector3();
      function classify() {
        if (!kit) return false;
        const cam = game.camera;
        cam.getWorldPosition(_cp);
        cam.getWorldDirection(_cd);
        const quality = hooks.getQuality ? hooks.getQuality() : "";
        const moved = (_cp.x - camera.x) ** 2 + (_cp.y - camera.y) ** 2 + (_cp.z - camera.z) ** 2 > 4;
        const turned = _cd.x * camera.fx + _cd.y * camera.fy + _cd.z * camera.fz < 0.99;
        if (!camera.force && !moved && !turned && cam.fov === camera.fov && cam.aspect === camera.aspect && quality === camera.quality) return false;
        camera.force = false;
        camera.x = _cp.x;
        camera.y = _cp.y;
        camera.z = _cp.z;
        camera.fx = _cd.x;
        camera.fy = _cd.y;
        camera.fz = _cd.z;
        camera.fov = cam.fov;
        camera.aspect = cam.aspect;
        if (quality !== camera.quality) {
          camera.quality = quality;
          const l = lodSettings();
          kit.uniforms.lod.value.set(l.thin, l.cut, l.fade, l.max);
        }
        const lod = lodSettings();
        lod.near *= state.nearScale || 1;
        const halfV = ((cam.fov || 50) * Math.PI) / 360;
        const halfDiag = Math.atan(Math.tan(halfV) * Math.sqrt(1 + (cam.aspect || 1) ** 2));
        camera.cos = Math.cos(Math.min(Math.PI * 0.97, halfDiag + 0.32));
        const started = performance.now();
        let changed = false;
        let near = 0;
        for (const name of KIND_NAMES) {
          const batch = kit.batches[name];
          if (batch.classify(camera, lod)) changed = true;
          if (batch.lods > 1) near += batch.drawn[0];
        }
        // Plafond de plantes complètes : au-delà, la forme allégée prend le relais plus près.
        const cap = mobile ? 450 : 1400;
        const scale = state.nearScale || 1;
        if (near > cap && scale > 0.35) {
          state.nearScale = Math.max(0.35, scale * 0.8);
          camera.force = true;
        } else if (near < cap * 0.55 && scale < 1) {
          state.nearScale = Math.min(1, scale * 1.15);
          camera.force = true;
        }
        state.classifyMs = performance.now() - started;
        return changed;
      }

      // --- Aperçu du tracé ---------------------------------------------------------------------
      const helpers = new THREE.Group();
      helpers.name = "Apercu_sous_bois_v32";
      helpers.userData.editorHelper = true;
      helpers.userData.exportSkip = true;
      helpers.visible = false;
      (game.scene.getObjectByName("Reperes_editeur") || game.scene).add(helpers);
      const helperMaterial = (options) => {
        const material = new THREE.MeshBasicMaterial(Object.assign({ side: THREE.DoubleSide, depthWrite: false, transparent: true }, options));
        material.toneMapped = false;
        return material;
      };
      const fillMaterial = helperMaterial({ vertexColors: true, opacity: 0.34, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
      const outlineMaterial = helperMaterial({ color: 0xfff1b8, opacity: 0.95, depthTest: false });
      const rubberMaterial = helperMaterial({ color: 0xfff1b8, opacity: 0.55, depthTest: false });
      const zonesMaterial = helperMaterial({ color: 0x9be38f, opacity: 0.55, depthTest: false });
      const pointMaterial = helperMaterial({ color: 0xffffff, opacity: 1, depthTest: false });
      const firstMaterial = helperMaterial({ color: 0xffd36b, opacity: 1, depthTest: false });
      const ringMaterial = helperMaterial({ color: 0x9be38f, opacity: 0.9, depthTest: false });
      const pointGeometry = new THREE.SphereGeometry(1, 12, 8);
      const ringGeometry = new THREE.RingGeometry(0.78, 1, 40);
      ringGeometry.rotateX(-Math.PI / 2);
      const fill = new THREE.Mesh(new THREE.BufferGeometry(), fillMaterial);
      const outline = new THREE.Mesh(new THREE.BufferGeometry(), outlineMaterial);
      const rubber = new THREE.Mesh(new THREE.BufferGeometry(), rubberMaterial);
      const zoneLines = new THREE.Mesh(new THREE.BufferGeometry(), zonesMaterial);
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      fill.renderOrder = 8;
      zoneLines.renderOrder = 9;
      rubber.renderOrder = 10;
      outline.renderOrder = 11;
      ring.renderOrder = 12;
      ring.visible = false;
      const markers = new THREE.Group();
      for (const object of [fill, zoneLines, rubber, outline, ring, markers]) {
        object.userData.editorHelper = true;
        object.userData.exportSkip = true;
        object.frustumCulled = false;
        helpers.add(object);
      }
      const lift = 0.09;
      const heightAt = (x, z) => game.terrainHeight(x, z) + lift;
      /** Ruban posé sur le relief le long d'une ligne (fermée ou non). */
      function ribbon(points, closed, width) {
        const positions = [];
        const index = [];
        const segments = closed ? points.length : points.length - 1;
        let base = 0;
        for (let i = 0; i < segments; i++) {
          const a = points[i];
          const b = points[(i + 1) % points.length];
          const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
          if (len < 1e-3) continue;
          const nx = -(b[1] - a[1]) / len;
          const nz = (b[0] - a[0]) / len;
          const steps = Math.max(1, Math.ceil(len / 0.6));
          for (let k = 0; k <= steps; k++) {
            const t = k / steps;
            const x = a[0] + (b[0] - a[0]) * t;
            const z = a[1] + (b[1] - a[1]) * t;
            const y = heightAt(x, z);
            positions.push(x + nx * width * 0.5, y, z + nz * width * 0.5, x - nx * width * 0.5, y, z - nz * width * 0.5);
            if (k < steps) index.push(base, base + 1, base + 3, base, base + 3, base + 2);
            base += 2;
          }
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
        geometry.setIndex(index);
        return geometry;
      }
      /** Aperçu rempli : vert où les plantes pousseront, rouge là où rien ne poussera. */
      function fillGeometry(points) {
        const contour = points.map(([x, z]) => new THREE.Vector2(x, z));
        let faces = [];
        try {
          faces = THREE.ShapeUtils.triangulateShape(contour, []);
        } catch {
          return new THREE.BufferGeometry();
        }
        const area = polygonArea(points);
        const step = clamp(Math.sqrt(area) / 28, 0.7, 4);
        const positions = [];
        const colors = [];
        const index = [];
        const ok = [0.42, 0.88, 0.38];
        const no = [0.95, 0.36, 0.28];
        for (const [ia, ib, ic] of faces) {
          const a = points[ia];
          const b = points[ib];
          const c = points[ic];
          const edge = Math.max(Math.hypot(b[0] - a[0], b[1] - a[1]), Math.hypot(c[0] - b[0], c[1] - b[1]), Math.hypot(a[0] - c[0], a[1] - c[1]));
          const n = Math.max(1, Math.min(60, Math.ceil(edge / step)));
          const base = positions.length / 3;
          const id = (i, j) => base + (i * (2 * n + 3 - i)) / 2 + j;
          for (let i = 0; i <= n; i++)
            for (let j = 0; j <= n - i; j++) {
              const x = a[0] + ((b[0] - a[0]) * i) / n + ((c[0] - a[0]) * j) / n;
              const z = a[1] + ((b[1] - a[1]) * i) / n + ((c[1] - a[1]) * j) / n;
              positions.push(x, game.terrainHeight(x, z) + 0.06, z);
              colors.push(...(allowedAt(x, z) ? ok : no));
            }
          for (let i = 0; i < n; i++)
            for (let j = 0; j < n - i; j++) {
              index.push(id(i, j), id(i + 1, j), id(i, j + 1));
              if (j < n - i - 1) index.push(id(i + 1, j), id(i + 1, j + 1), id(i, j + 1));
            }
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
        geometry.setIndex(index);
        return geometry;
      }
      function viewWidth(points) {
        const cam = game.camera.position;
        let x = 0;
        let z = 0;
        for (const p of points) {
          x += p[0];
          z += p[1];
        }
        x /= points.length || 1;
        z /= points.length || 1;
        const d = Math.hypot(cam.x - x, cam.y - game.terrainHeight(x, z), cam.z - z);
        return clamp(d * 0.0042, 0.08, 1.1);
      }
      const replaceGeometry = (mesh, geometry) => {
        mesh.geometry.dispose();
        mesh.geometry = geometry;
      };
      let hover = null;
      let helperWidth = 0.2;
      /** Élastique : du dernier point au pointeur puis au premier point (ou fermeture). */
      function refreshRubber() {
        const pts = state.points;
        let band = [];
        if (pts.length >= 1 && hover && state.drawing && !press) band = pts.length >= 2 ? [pts[pts.length - 1], hover, pts[0]] : [pts[0], hover];
        else if (pts.length >= 3) band = [pts[pts.length - 1], pts[0]];
        replaceGeometry(rubber, band.length > 1 ? ribbon(band, false, helperWidth * 0.7) : new THREE.BufferGeometry());
        hooks.markDirty();
      }
      function refreshPreview() {
        const pts = state.points;
        const width = pts.length ? viewWidth(pts) : 0.2;
        helperWidth = width;
        replaceGeometry(outline, pts.length > 1 ? ribbon(pts, false, width) : new THREE.BufferGeometry());
        refreshRubber();
        for (const child of [...markers.children]) markers.remove(child);
        pts.forEach(([x, z], i) => {
          const marker = new THREE.Mesh(pointGeometry, i === 0 ? firstMaterial : pointMaterial);
          marker.position.set(x, heightAt(x, z) + width * 0.4, z);
          marker.scale.setScalar(width * (i === 0 ? 1.5 : 1.05));
          marker.renderOrder = 13;
          marker.frustumCulled = false;
          marker.userData.editorHelper = true;
          markers.add(marker);
        });
        hooks.markDirty();
      }
      function refreshFill() {
        replaceGeometry(fill, state.points.length >= 3 && !press ? fillGeometry(state.points) : new THREE.BufferGeometry());
        hooks.markDirty();
      }
      function refreshZoneLines() {
        if (!state.drawing || !zones.length) {
          replaceGeometry(zoneLines, new THREE.BufferGeometry());
          state.zoneWidth = 0;
          return;
        }
        state.zoneWidth = viewWidth(zones[zones.length - 1].points);
        const parts = zones.map((z) => ribbon(z.points, true, viewWidth(z.points) * 0.6));
        const positions = [];
        const index = [];
        for (const g of parts) {
          const offset = positions.length / 3;
          positions.push(...g.attributes.position.array);
          for (const i of g.index.array) index.push(i + offset);
          g.dispose();
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
        geometry.setIndex(index);
        replaceGeometry(zoneLines, geometry);
      }

      // --- Interface : état des boutons ----------------------------------------------------------
      function save() {
        V32.store.set(KEY, zones.map((z) => ({ mix: z.mix, density: z.density, seed: z.seed, points: z.points })));
      }
      function saveSettings() {
        V32.store.set(KEY + "-reglages", { mix: state.mix, density: state.density });
      }
      function summary() {
        if (!zones.length) return "Aucune zone : choisis les plantes puis « Dessiner une zone ».";
        let text = zones.length + (zones.length > 1 ? " zones · " : " zone · ") + fmt(state.plants) + (state.plants > 1 ? " plantes" : " plante");
        if (state.scale < 0.999) text += " · limite de " + fmt(BUDGET) + " atteinte, zones éclaircies";
        return text + ".";
      }
      function drawingHint() {
        const n = state.points.length;
        const touch = lastPointer === "touch";
        if (!n)
          return touch
            ? "Touche le sol pour poser les coins de la zone, ou garde le doigt appuyé un instant puis glisse pour l’entourer d’un trait. Un glisser rapide tourne la vue."
            : "Clique au sol pour poser les coins de la zone, ou garde le clic appuyé pour l’entourer d’un trait. Alt + glisser tourne la vue.";
        if (n < 3) return n + (n > 1 ? " points" : " point") + " : continue autour de la zone (au moins 3).";
        return n + " points · " + fmt(polygonArea(state.points)) + " m² : « Terminer » la remplit (ou touche le premier point).";
      }
      function renderUi() {
        for (const button of box.querySelectorAll("[data-sb-mix]")) button.setAttribute("aria-pressed", String(button.dataset.sbMix === state.mix));
        densityValue.textContent = densityWord(state.density);
        drawButton.setAttribute("aria-pressed", String(state.drawing));
        box.dataset.drawing = String(state.drawing);
        backButton.disabled = !state.points.length;
        finishButton.disabled = state.points.length < 3;
        undoButton.disabled = !zones.length;
        clearButton.disabled = !zones.length;
        const armed = state.clearArmed > performance.now();
        clearButton.querySelector("span").textContent = armed ? "Confirmer : tout effacer" : "Tout effacer";
        clearButton.classList.toggle("is-armed", armed);
        statusLine.textContent = state.message || (state.drawing ? drawingHint() : summary());
        listEl.replaceChildren(
          ...zones.map((zone, i) => {
            const li = document.createElement("li");
            const swatch = document.createElement("span");
            swatch.className = "v32-sb-swatch";
            swatch.dataset.mix = zone.mix;
            const text = document.createElement("span");
            text.textContent = MIXES[zone.mix].label + " · " + fmt(polygonArea(zone.points)) + " m² · " + densityWord(zone.density) + (finite(zone._count) ? " · " + fmt(zone._count) : "");
            const remove = document.createElement("button");
            remove.type = "button";
            remove.className = "v32-sb-remove";
            remove.dataset.sbRemove = String(i);
            remove.setAttribute("aria-label", "Retirer la zone " + (i + 1));
            remove.title = "Retirer cette zone";
            remove.textContent = "×";
            li.append(swatch, text, remove);
            return li;
          }),
        );
        renderBar();
      }
      function panelCollapsed() {
        return root.dataset.editorCollapsed === "true";
      }
      /** Le panneau ouvert cache-t-il l'essentiel de la vue (téléphone, tablette en hauteur) ? */
      function panelCoversView() {
        const view = canvas.getBoundingClientRect();
        const rect = panel.getBoundingClientRect();
        const w = Math.max(0, Math.min(rect.right, view.right) - Math.max(rect.left, view.left));
        const h = Math.max(0, Math.min(rect.bottom, view.bottom) - Math.max(rect.top, view.top));
        return w * h > 0.4 * view.width * view.height;
      }
      function liveSessionZones() {
        state.sessionZones = state.sessionZones.filter((zone) => zones.includes(zone));
        return state.sessionZones;
      }
      function renderBar() {
        const show = state.drawing && panelCollapsed() && hooks.getMode() === "editor";
        if (bar.hidden !== !show) {
          bar.hidden = !show;
          if (show) {
            // Au-dessus du bouton « Afficher les outils » quand il est posé en bas de l'écran.
            let lift = 0;
            if (collapseToggle) {
              const t = collapseToggle.getBoundingClientRect();
              const r = root.getBoundingClientRect();
              if (t.height && t.top > r.top + r.height * 0.6) lift = Math.round(r.bottom - t.top + 8);
            }
            bar.style.bottom = lift ? lift + "px" : "";
          }
        }
        if (!show) return;
        barSwatch.dataset.mix = state.mix;
        barMix.textContent = MIXES[state.mix].label + " · " + densityWord(state.density);
        barStatus.textContent = statusLine.textContent;
        const undoZone = !state.points.length && liveSessionZones().length > 0;
        barBack.querySelector("span").textContent = undoZone ? "Retirer la zone" : "Annuler le point";
        barBack.disabled = !state.points.length && !undoZone;
        barFinish.disabled = state.points.length < 3;
      }
      function say(message) {
        state.message = message || "";
        renderUi();
      }

      // --- Zones : créer, annuler, effacer ---------------------------------------------------
      function commitZone(points, options = {}) {
        const ring = simplifyRing(points, options.tolerance ?? 0.3).map(([x, z]) => [round2(x), round2(z)]);
        if (ring.length < 3) return { ok: false, reason: "points" };
        const area = polygonArea(ring);
        if (area < MIN_AREA) return { ok: false, reason: "small", area };
        if (area > MAX_AREA) return { ok: false, reason: "large", area };
        if (zones.length >= MAX_ZONES) return { ok: false, reason: "count" };
        const zone = sanitize([
          {
            mix: MIX_IDS.includes(options.mix) ? options.mix : state.mix,
            density: finite(options.density) ? options.density : state.density,
            seed: finite(options.seed) ? options.seed : 1 + Math.floor(Math.random() * 2147483000),
            points: ring,
          },
        ])[0];
        if (!zone) return { ok: false, reason: "invalid" };
        if (!kit) makeKit();
        ensureEnvironment();
        const entry = zoneCache(zone);
        if (!entry.kept.length) return { ok: false, reason: "blocked", area };
        zones.push(zone);
        save();
        rebuild();
        refreshZoneLines();
        return { ok: true, plants: zone._count || 0, area, zone: zones.length - 1, ms: state.buildMs };
      }
      function describeFailure(result) {
        switch (result.reason) {
          case "small":
            return "Zone trop petite : entoure au moins quelques mètres carrés.";
          case "large":
            return "Zone trop grande : dessine-la en plusieurs morceaux.";
          case "count":
            return "Limite de " + MAX_ZONES + " zones atteinte : retire une zone d’abord.";
          case "blocked":
            return "Rien ne peut pousser ici : la zone est sur l’eau, un chemin, un muret ou un bâtiment.";
          default:
            return "Tracé impossible : pose au moins trois points autour de la zone.";
        }
      }
      function finishDrawing(points) {
        const pts = points || state.points;
        if (pts.length < 3) {
          say("Pose au moins trois points autour de la zone.");
          return { ok: false, reason: "points" };
        }
        const result = commitZone(pts);
        if (!result.ok) {
          say(describeFailure(result));
          return result;
        }
        state.points = [];
        if (state.drawing) state.sessionZones.push(zones[result.zone]);
        refreshPreview();
        refreshFill();
        const cut = state.scale < 0.999 ? " Limite de " + fmt(BUDGET) + " plantes : les zones sont un peu éclaircies." : "";
        const undo = bar.hidden ? " « Annuler la dernière zone » la retire." : " « Retirer la zone » l’annule.";
        say("Zone remplie : " + fmt(result.plants) + " plantes sur " + fmt(result.area) + " m²." + undo + cut);
        return result;
      }
      function removeZone(index) {
        if (index < 0 || index >= zones.length) return false;
        zones.splice(index, 1);
        save();
        rebuild();
        refreshZoneLines();
        return true;
      }
      function clearAll() {
        zones = [];
        save();
        rebuild();
        refreshZoneLines();
      }

      // --- Dessin au sol -----------------------------------------------------------------------
      const controls = game.controls;
      function setDrawing(active, restoreTool = true) {
        if (state.drawing === active) return;
        state.drawing = active;
        state.message = "";
        if (active) {
          const pressed = panel.querySelector('[data-tool][aria-pressed="true"]');
          state.toolBefore = pressed ? pressed.dataset.tool : null;
          // Les outils de la V31 sont suspendus ; leur fantôme ne suit plus le pointeur.
          if (state.toolBefore && state.toolBefore !== "select" && editor.setTool) editor.setTool("select");
          state.navigateBefore = navigateBox ? navigateBox.checked : false;
          if (navigateBox && !navigateBox.checked) {
            navigateBox.checked = true;
            navigateBox.dispatchEvent(new Event("change", { bubbles: true }));
          }
          state.sessionZones = [];
          // Petit écran : le panneau se replie le temps du tracé (la barre prend le relais).
          if (collapseToggle && !panelCollapsed() && panelCoversView()) {
            collapseToggle.click();
            state.autoCollapsed = panelCollapsed();
          }
        } else {
          cancelPress();
          state.points = [];
          hover = null;
          ring.visible = false;
          if (navigateBox && navigateBox.checked !== state.navigateBefore) {
            navigateBox.checked = state.navigateBefore;
            navigateBox.dispatchEvent(new Event("change", { bubbles: true }));
          }
          if (restoreTool && state.toolBefore && state.toolBefore !== "select" && editor.setTool && hooks.getMode() === "editor") editor.setTool(state.toolBefore);
          state.toolBefore = null;
          state.sessionZones = [];
          if (state.autoCollapsed) {
            state.autoCollapsed = false;
            if (collapseToggle && panelCollapsed()) {
              collapseToggle.click();
              // Le panneau revient sur le sous-bois (bilan du tracé, liste des zones).
              const top = box.getBoundingClientRect().top - panel.getBoundingClientRect().top;
              if (top < 0 || top > panel.clientHeight * 0.5) panel.scrollTop += top - 8;
            }
          }
        }
        helpers.visible = active;
        refreshZoneLines();
        refreshPreview();
        refreshFill();
        renderUi();
      }
      function addPoint(x, z) {
        if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
        const pts = state.points;
        if (pts.length >= 3) {
          // Toucher le premier point ferme la zone.
          const first = pts[0];
          if (Math.hypot(x - first[0], z - first[1]) < Math.max(0.8, viewWidth(pts) * 3.2)) {
            finishDrawing();
            return true;
          }
        }
        const last = pts[pts.length - 1];
        if (last && Math.hypot(x - last[0], z - last[1]) < 0.3) return false;
        if (pts.length >= 80) {
          say("80 points au plus : « Terminer » remplit la zone.");
          return false;
        }
        pts.push([round2(x), round2(z)]);
        state.message = "";
        refreshPreview();
        refreshFill();
        renderUi();
        return true;
      }

      const canvas = game.renderer.domElement;
      let press = null;
      let lastPointer = matchMedia("(pointer: coarse)").matches ? "touch" : "mouse";
      const pointers = new Set();
      function cancelPress() {
        if (!press) return;
        clearTimeout(press.timer);
        if (press.blocked && controls) controls.enabled = true;
        if (press.captured) {
          try {
            canvas.releasePointerCapture(press.id);
          } catch {}
        }
        press = null;
      }
      function startLasso(p) {
        press.lasso = true;
        press.points = p ? [[p.x, p.z]] : [];
        if (!press.blocked && controls) {
          controls.enabled = false;
          press.blocked = true;
        }
        state.points = [];
        say("Entoure la zone d’un trait, puis relâche.");
        refreshFill();
      }
      function lassoAdd(event) {
        const p = editor.groundPoint(event);
        if (!p) return;
        const pts = press.points;
        const last = pts[pts.length - 1];
        if (last && Math.hypot(p.x - last[0], p.z - last[1]) < 0.45) return;
        if (pts.length >= 600) return;
        pts.push([p.x, p.z]);
        state.points = pts;
        if (pts.length % 2 === 0 || pts.length < 4) refreshPreview();
      }
      canvas.addEventListener(
        "pointerdown",
        (event) => {
          pointers.add(event.pointerId);
          if (!state.drawing || hooks.getMode() !== "editor") return;
          lastPointer = event.pointerType === "touch" ? "touch" : "mouse";
          if (pointers.size > 1) {
            // Deux doigts : la vue garde la main (pincer, tourner).
            if (press && !press.lasso) cancelPress();
            return;
          }
          if (event.button !== 0 || event.altKey) return;
          if (event.pointerType === "touch") {
            // Doigt posé : toucher = un coin ; glisser tout de suite = la vue tourne ; rester
            // appuyé un instant puis glisser = un trait autour de la zone. On tranche sur l'heure
            // des évènements (une image lente ne change pas un toucher en trait) ; le minuteur
            // ne fait qu'annoncer le trait et tenir la vue immobile.
            press = { id: event.pointerId, x: event.clientX, y: event.clientY, stamp: event.timeStamp, touch: true, lasso: false, armed: false, blocked: false };
            const id = event.pointerId;
            press.timer = setTimeout(() => {
              if (!press || press.id !== id || press.lasso || press.armed || pointers.size > 1) return;
              press.armed = true;
              if (controls) {
                controls.enabled = false;
                press.blocked = true;
              }
              say("Glisse pour entourer la zone d’un trait, ou relève le doigt pour poser un coin.");
              if (navigator.vibrate) navigator.vibrate(12);
            }, HOLD_MS);
            return;
          }
          // Souris ou stylet : le glisser dessine, la vue ne tourne pas.
          event.preventDefault();
          event.stopImmediatePropagation();
          press = { id: event.pointerId, x: event.clientX, y: event.clientY, stamp: event.timeStamp, touch: false, lasso: false, blocked: true, captured: false, start: editor.groundPoint(event) };
          if (controls) controls.enabled = false;
          try {
            canvas.setPointerCapture(event.pointerId);
            press.captured = true;
          } catch {}
        },
        true,
      );
      canvas.addEventListener(
        "pointermove",
        (event) => {
          if (!state.drawing || hooks.getMode() !== "editor") return;
          if (press && event.pointerId === press.id) {
            const moved = Math.hypot(event.clientX - press.x, event.clientY - press.y);
            if (!press.lasso) {
              if (press.touch) {
                if (moved <= 10) return;
                if (event.timeStamp - press.stamp < HOLD_MS) {
                  // Le doigt glisse tout de suite : c'est la vue qui bouge (même si une image
                  // lente a laissé passer le minuteur).
                  const armed = press.armed;
                  cancelPress();
                  if (armed) say("");
                  return;
                }
                clearTimeout(press.timer);
                startLasso(editor.groundPoint({ clientX: press.x, clientY: press.y }));
              } else if (moved > 6) startLasso(press.start);
              else return;
            }
            event.preventDefault();
            event.stopImmediatePropagation();
            lassoAdd(event);
            return;
          }
          if (event.pointerType !== "mouse" || press) return;
          // Survol à la souris : anneau sous le pointeur et élastique vers le tracé.
          const p = editor.groundPoint(event);
          if (!p) {
            ring.visible = false;
            hover = null;
            return;
          }
          const width = viewWidth([[p.x, p.z]]);
          ring.position.set(p.x, game.terrainHeight(p.x, p.z) + lift, p.z);
          ring.scale.setScalar(width * 2.4);
          ring.material.color.set(allowedAt(p.x, p.z) ? 0x9be38f : 0xff8a65);
          ring.visible = true;
          hover = [p.x, p.z];
          if (state.points.length) refreshRubber();
          else hooks.markDirty();
        },
        true,
      );
      const release = (event, cancelled) => {
        pointers.delete(event.pointerId);
        if (!press || press.id !== event.pointerId) return;
        const current = press;
        clearTimeout(current.timer);
        if (current.lasso) {
          event.preventDefault();
          event.stopImmediatePropagation();
          const pts = current.points;
          cancelPress();
          state.points = [];
          if (cancelled) {
            refreshPreview();
            say("Trait interrompu.");
            return;
          }
          if (pts.length < 4 || polygonArea(pts) < MIN_AREA) {
            refreshPreview();
            say("Trait trop court : entoure une zone plus large.");
            return;
          }
          finishDrawing(pts);
          return;
        }
        const moved = Math.hypot(event.clientX - current.x, event.clientY - current.y);
        if (!current.touch) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
        cancelPress();
        if (current.armed) state.message = "";
        // Relevé sans avoir glissé : un coin de plus (même après un appui long).
        const p = cancelled || moved > (current.touch ? 10 : 6) ? null : editor.groundPoint(event);
        if (!p || !addPoint(p.x, p.z)) renderUi();
      };
      canvas.addEventListener("pointerup", (event) => release(event, false), true);
      canvas.addEventListener("pointercancel", (event) => release(event, true), true);
      // Un doigt relevé hors de la vue ne doit pas passer pour un deuxième doigt ensuite.
      for (const type of ["pointerup", "pointercancel"])
        window.addEventListener(
          type,
          (event) => {
            if (!press || press.id !== event.pointerId) pointers.delete(event.pointerId);
          },
          true,
        );
      canvas.addEventListener("pointerleave", () => {
        if (!press && ring.visible) {
          ring.visible = false;
          hover = null;
          refreshPreview();
        }
      });
      canvas.addEventListener(
        "contextmenu",
        (event) => {
          if (state.drawing && press && press.touch) event.preventDefault();
        },
        true,
      );
      // Clavier pendant le tracé, avant les raccourcis de l'atelier (Échap quitterait
      // l'atelier, Retour arrière supprimerait l'élément sélectionné).
      window.addEventListener(
        "keydown",
        (event) => {
          if (!state.drawing || hooks.getMode() !== "editor") return;
          const target = event.target;
          if (target && (target.isContentEditable || /^(INPUT|SELECT|TEXTAREA)$/.test(target.tagName))) return;
          const key = event.key;
          if (key !== "Escape" && key !== "Enter" && key !== "Backspace" && key !== "Delete") return;
          // Entrée sur un bouton de l'atelier garde son rôle (activer le bouton).
          if (key === "Enter" && target && target.closest && target.closest("button, a, [role=button], summary")) return;
          event.preventDefault();
          event.stopImmediatePropagation();
          if (key === "Enter") {
            if (state.points.length >= 3) finishDrawing();
          } else if (key === "Escape") {
            if (press && press.lasso) {
              cancelPress();
              state.points = [];
              refreshPreview();
              say("Trait abandonné.");
            } else if (state.points.length) {
              state.points = [];
              refreshPreview();
              refreshFill();
              say("Tracé effacé.");
            } else setDrawing(false);
          } else if (state.points.length && !press) backButton.click();
        },
        true,
      );

      // --- Boutons ---------------------------------------------------------------------------
      box.addEventListener("click", (event) => {
        const mixButton = event.target.closest("[data-sb-mix]");
        if (mixButton) {
          state.mix = mixButton.dataset.sbMix;
          saveSettings();
          say("");
          return;
        }
        const remove = event.target.closest("[data-sb-remove]");
        if (remove) {
          const index = Number(remove.dataset.sbRemove);
          if (removeZone(index)) say("Zone " + (index + 1) + " retirée.");
        }
      });
      densityInput.addEventListener("input", () => {
        state.density = clamp(Number(densityInput.value), 0.15, 1);
        saveSettings();
        renderUi();
      });
      drawButton.addEventListener("click", () => setDrawing(!state.drawing));
      backButton.addEventListener("click", () => {
        state.points.pop();
        state.message = "";
        refreshPreview();
        refreshFill();
        renderUi();
      });
      finishButton.addEventListener("click", () => finishDrawing());
      barBack.addEventListener("click", () => {
        if (state.points.length) {
          backButton.click();
          return;
        }
        const zone = liveSessionZones().pop();
        if (zone && removeZone(zones.indexOf(zone))) say("Zone retirée.");
      });
      barFinish.addEventListener("click", () => finishDrawing());
      barExit.addEventListener("click", () => setDrawing(false));
      // Panneau replié ou rouvert, changement de mode : la barre suit.
      new MutationObserver(renderBar).observe(root, { attributes: true, attributeFilter: ["data-editor-collapsed", "data-mode"] });
      undoButton.addEventListener("click", () => {
        if (!zones.length) return;
        removeZone(zones.length - 1);
        say(zones.length ? "Dernière zone retirée." : "Toutes les zones sont retirées.");
      });
      clearButton.addEventListener("click", () => {
        if (!zones.length) return;
        if (state.clearArmed > performance.now()) {
          state.clearArmed = 0;
          clearAll();
          say("Sous-bois effacé.");
          return;
        }
        state.clearArmed = performance.now() + 4000;
        say("Touche encore « Confirmer » pour effacer les " + zones.length + (zones.length > 1 ? " zones." : " zone."));
        setTimeout(() => {
          if (state.clearArmed && state.clearArmed <= performance.now()) {
            state.clearArmed = 0;
            say("");
          }
        }, 4100);
      });
      // Un autre outil de l'atelier (ou un autre onglet) arrête le dessin.
      panel.addEventListener("click", (event) => {
        if (!state.drawing) return;
        if (event.target.closest("[data-tool], .v32-tab, [data-v32-bench], [data-berges-mode]")) setDrawing(false, false);
      });
      navigateBox &&
        navigateBox.addEventListener("change", (event) => {
          // L'utilisateur décoche « Déplacer la vue » : les outils de la V31 reprennent.
          if (state.drawing && event.isTrusted && !navigateBox.checked) setDrawing(false, false);
        });

      // --- Terrain retouché, sentiers ou arbres ajoutés : on replante -------------------------
      if (V32.stones && V32.stones.onTerrainEdit)
        V32.stones.onTerrainEdit(game, "sous-bois", () => {
          if (!zones.length) return;
          buildEnvironment();
          rebuild();
        });

      // --- Accès direct (essais automatisés, console) -----------------------------------------
      V32.sousBois = {
        /** Même effet qu'un tracé terminé : zone plantée, gardée, annulable. */
        addZone(points, options = {}) {
          const result = commitZone(points, Object.assign({ tolerance: 0.05 }, options));
          if (result.ok) say("Zone remplie : " + fmt(result.plants) + " plantes sur " + fmt(result.area) + " m².");
          else say(describeFailure(result));
          return result;
        },
        startDrawing: () => setDrawing(true),
        stopDrawing: () => setDrawing(false),
        addPoint,
        finish: () => finishDrawing(),
        undo: () => undoButton.click(),
        remove: removeZone,
        clear() {
          clearAll();
          say("Sous-bois effacé.");
        },
        setMix(mix) {
          if (MIX_IDS.includes(mix)) state.mix = mix;
          saveSettings();
          renderUi();
        },
        setDensity(d) {
          state.density = clamp(Number(d) || 0.65, 0.15, 1);
          densityInput.value = String(state.density);
          saveSettings();
          renderUi();
        },
        /** Remplace toutes les zones (import du fichier « mes retouches »). */
        load(list) {
          zones = sanitize(list);
          save();
          if (zones.length) {
            // Le fichier importé a pu changer les sentiers, les arbres et le relief.
            state.envKey = environmentKey();
            buildEnvironment();
          }
          if (kit || zones.length) rebuild();
          refreshZoneLines();
          say("");
          return zones.length;
        },
        get zones() {
          return zones.map((z) => ({ mix: z.mix, density: z.density, seed: z.seed, points: z.points.map((p) => p.slice()) }));
        },
        get state() {
          return { drawing: state.drawing, points: state.points.map((p) => p.slice()), mix: state.mix, density: state.density, message: statusLine.textContent, bar: !bar.hidden, panelCollapsed: panelCollapsed() };
        },
        get stats() {
          const drawn = {};
          let near = 0;
          let far = 0;
          let triangles = 0;
          if (kit)
            for (const name of KIND_NAMES) {
              const b = kit.batches[name];
              drawn[name] = { total: b.count, near: b.drawn[0], far: b.drawn[1] || 0 };
              near += b.drawn[0];
              far += b.drawn[1] || 0;
              triangles += b.drawn[0] * kit.triangles[name][0] + (b.drawn[1] || 0) * (kit.triangles[name][1] || 0);
            }
          return {
            zones: zones.length,
            plants: state.plants,
            instances: state.instances || 0,
            candidates: state.total || 0,
            budget: BUDGET,
            scale: state.scale,
            buildMs: state.buildMs,
            replayMs: Math.round(state.replayMs || 0),
            replayFrameMs: Math.round(state.replayFrameMs || 0),
            classifyMs: state.classifyMs,
            nearScale: +(state.nearScale || 1).toFixed(2),
            kitMs: kit ? kit.ms : 0,
            paintMs: kit ? kit.paintMs : 0,
            drawn,
            near,
            far,
            triangles: Math.round(triangles),
            drawCalls: kit ? Object.values(kit.batches).reduce((sum, b) => sum + b.meshes.filter((m) => m.visible).length, 0) + (kit.floor.visible ? 1 : 0) : 0,
            floorTriangles: state.floorTriangles || 0,
            kindTriangles: kit ? kit.triangles : null,
          };
        },
        allowedAt: (x, z) => allowedAt(x, z),
        /** Diagnostic : candidats d'une zone et part gardée. */
        debugZone(i) {
          const zone = zones[i];
          if (!zone) return null;
          const entry = zoneCache(zone);
          const byKind = {};
          for (const c of entry.list) byKind[c.kind] = (byKind[c.kind] || 0) + 1;
          const sample = {};
          for (const c of entry.kept) if (!sample[c.kind] || sample[c.kind].length < 4) (sample[c.kind] = sample[c.kind] || []).push([+c.x.toFixed(2), +c.z.toFixed(2), +c.s.toFixed(2)]);
          return { area: polygonArea(zone.points), candidates: entry.list.length, kept: entry.kept.length, byKind, sample, ms: entry.ms };
        },
        get atlas() {
          return kit ? kit.canvas : null;
        },
        /** Retrie tout de suite les plantes pour la caméra actuelle (mesures). */
        refresh() {
          camera.force = true;
          return classify();
        },
        group,
      };

      renderUi();
      return {
        update(dt, time) {
          let dirty = false;
          if (state.pending) {
            // À l'ouverture : l'atlas, puis une zone par image, puis l'assemblage (pas
            // d'image figée longtemps, même sur téléphone).
            const started = performance.now();
            const lap = () => {
              const ms = performance.now() - started;
              state.replayMs = (state.replayMs || 0) + ms;
              state.replayFrameMs = Math.max(state.replayFrameMs || 0, ms);
            };
            if (!kit) {
              makeKit();
              lap();
              return false;
            }
            ensureEnvironment();
            const next = zones.find((zone) => {
              const entry = cache.get(zone);
              return !entry || entry.env !== env.version;
            });
            if (next) {
              zoneCache(next, started + 45);
              lap();
              return false;
            }
            state.pending = false;
            rebuild();
            renderUi();
            lap();
            dirty = true;
          }
          const mode = hooks.getMode();
          if (state.drawing && mode !== "editor") setDrawing(false, false);
          // Sentiers, arbres ou objets changés dans l'atelier : on replante (au plus toutes les 1,5 s).
          if (zones.length && mode === "editor" && time - state.envCheck > 1.5 && !press) {
            state.envCheck = time;
            const key = environmentKey();
            if (key !== state.envKey) {
              state.envKey = key;
              buildEnvironment();
              rebuild();
              renderUi();
              dirty = true;
            }
          }
          if (state.clearArmed && state.clearArmed <= performance.now()) {
            state.clearArmed = 0;
            renderUi();
          }
          // Tracé en cours : l'épaisseur des repères suit le zoom de la vue.
          if (state.drawing && !press) {
            if (state.points.length && Math.abs(viewWidth(state.points) / helperWidth - 1) > 0.3) refreshPreview();
            if (zones.length && state.zoneWidth && Math.abs(viewWidth(zones[zones.length - 1].points) / state.zoneWidth - 1) > 0.3) refreshZoneLines();
          }
          if (classify()) dirty = true;
          return dirty;
        },
      };
    },
    68,
  );
})();
