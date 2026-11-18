// Moulin V32 — arbres détaillés.
//
// Les 1 260 arbres de la vallée étaient des volumes à facettes (icosaèdres sur des
// branches à cinq pans) : un rendu de logiciel de modélisation. Ils sont désormais
// construits au chargement, sans fichier en plus, comme dans un jeu :
//  - un atlas de feuillages dessiné sur un canevas (brindilles de chêne aux feuilles
//    lobées, rameaux retombants du bouleau, pinceaux d'aiguilles des pins, masses de
//    petites feuilles pour les arbres lointains) ;
//  - des écorces calculées (chêne crevassé à lichens, plaques du pin, bouleau blanc) ;
//  - pour chaque essence, un squelette ramifié (tronc évasé, charpentières, branches,
//    rameaux) et une couronne de cartes de feuilles posées en bouquets au bout des
//    rameaux, avec des normales arrondies (la couronne s'éclaire comme un volume) ;
//  - deux niveaux de détail : l'arbre complet près de la caméra (construit seulement quand
//    il en faut un), une version à grandes cartes au-delà, en un seul appel de dessin par
//    groupe ; un arbre qui change de niveau passe de l'un à l'autre en 0,6 s (fondu tramé
//    dans le shader), sans jamais rester tramé ;
//  - le vent balance l'arbre entier (mêmes rafales que la V32), fait osciller chaque
//    charpentière et frémir les bouquets, entièrement dans le shader ;
//  - les ombres portées gardent les trouées du feuillage (test alpha sur l'atlas).
//
// MoulinForest garde l'interface de l'ancienne forêt (records, add, update, remove,
// pick, replace, rebuild, resettle, updateLOD, exportGroup, materials…).
(function () {
  "use strict";
  const V32 = globalThis.MoulinV32;
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const mix = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };

  // Hasard reproductible : un même arbre se reconstruit toujours à l'identique.
  function random(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const range = (rnd, a, b) => a + (b - a) * rnd();

  // Petits vecteurs [x, y, z].
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const length = (a) => Math.hypot(a[0], a[1], a[2]);
  const norm = (a) => {
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  };
  const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  function randomUnit(rnd) {
    const z = rnd() * 2 - 1;
    const a = rnd() * TAU;
    const r = Math.sqrt(1 - z * z);
    return [r * Math.cos(a), z, r * Math.sin(a)];
  }
  function rotateAround(v, axis, angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const k = cross(axis, v);
    const d = dot(axis, v) * (1 - c);
    return [v[0] * c + k[0] * s + axis[0] * d, v[1] * c + k[1] * s + axis[1] * d, v[2] * c + k[2] * s + axis[2] * d];
  }
  function fromAngles(azimuth, polar) {
    return [Math.sin(polar) * Math.cos(azimuth), Math.cos(polar), Math.sin(polar) * Math.sin(azimuth)];
  }

  // ---------------------------------------------------------------------------
  // Bruits périodiques (textures sans raccord). Les réseaux de valeurs et les points de
  // Worley sont tirés une fois ; chaque pixel ne fait plus que des lectures de tableau.
  // ---------------------------------------------------------------------------
  function hash2(x, y, seed) {
    let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function makeNoise(cx, cy, seed) {
    const grid = new Float32Array(cx * cy);
    for (let y = 0; y < cy; y++) for (let x = 0; x < cx; x++) grid[y * cx + x] = hash2(x, y, seed);
    return (u, v) => {
      let x = u * cx;
      let y = v * cy;
      x -= Math.floor(x / cx) * cx;
      y -= Math.floor(y / cy) * cy;
      const ix = Math.floor(x);
      const iy = Math.floor(y);
      const fx = x - ix;
      const fy = y - iy;
      const sx = fx * fx * (3 - 2 * fx);
      const sy = fy * fy * (3 - 2 * fy);
      const x1 = ix + 1 === cx ? 0 : ix + 1;
      const r0 = iy * cx;
      const r1 = (iy + 1 === cy ? 0 : iy + 1) * cx;
      const a = grid[r0 + ix];
      const b = grid[r0 + x1];
      const c = grid[r1 + ix];
      const d = grid[r1 + x1];
      return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
    };
  }
  function makeFbm(cx, cy, seed, octaves) {
    const layers = [];
    let amp = 0.5;
    let total = 0;
    for (let o = 0; o < octaves; o++) {
      layers.push([makeNoise(cx << o, cy << o, seed + o * 31), amp]);
      total += amp;
      amp *= 0.5;
    }
    return (u, v) => {
      let sum = 0;
      for (let i = 0; i < layers.length; i++) sum += layers[i][0](u, v) * layers[i][1];
      return sum / total;
    };
  }
  // Cellules de Worley périodiques : distance au point le plus proche, au suivant, et
  // un identifiant par cellule.
  function makeWorley(cx, cy, seed) {
    const px = new Float32Array(cx * cy);
    const py = new Float32Array(cx * cy);
    const ids = new Float32Array(cx * cy);
    for (let y = 0; y < cy; y++)
      for (let x = 0; x < cx; x++) {
        const i = y * cx + x;
        px[i] = 0.15 + 0.7 * hash2(x, y, seed);
        py[i] = 0.15 + 0.7 * hash2(x, y, seed + 7);
        ids[i] = hash2(x, y, seed + 13);
      }
    return (u, v, out) => {
      let x = u * cx;
      let y = v * cy;
      x -= Math.floor(x / cx) * cx;
      y -= Math.floor(y / cy) * cy;
      const ix = Math.floor(x);
      const iy = Math.floor(y);
      let f1 = 9;
      let f2 = 9;
      let id = 0;
      for (let j = -1; j <= 1; j++) {
        const gy = iy + j;
        const wy = gy < 0 ? gy + cy : gy >= cy ? gy - cy : gy;
        for (let i = -1; i <= 1; i++) {
          const gx = ix + i;
          const wx = gx < 0 ? gx + cx : gx >= cx ? gx - cx : gx;
          const k = wy * cx + wx;
          const dx = gx + px[k] - x;
          const dy = gy + py[k] - y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < f1) {
            f2 = f1;
            f1 = d;
            id = ids[k];
          } else if (d < f2) f2 = d;
        }
      }
      out[0] = f1;
      out[1] = f2;
      out[2] = id;
      return out;
    };
  }

  // ---------------------------------------------------------------------------
  // Écorces : couleur (sRGB) et relief, calculés une fois au chargement
  // ---------------------------------------------------------------------------
  function barkPixels(kind, w, h) {
    const color = new Uint8Array(w * h * 4);
    const height = new Float32Array(w * h);
    const cell = [0, 0, 0];
    const oak = kind === "oak";
    const N = {};
    if (kind === "birch") {
      N.grain = makeFbm(8, 16, 3, 3);
      N.patch = makeFbm(3, 6, 11, 4);
      N.patchJitter = makeNoise(12, 3, 5);
      N.warp = makeNoise(4, 24, 9);
      N.band = makeNoise(5, 42, 21);
      N.bandMask = makeNoise(10, 42, 27);
      N.peel = makeFbm(4, 10, 41, 3);
    } else {
      N.warp = makeFbm(4, 8, oak ? 5 : 15, 3);
      N.cells = makeWorley(oak ? 9 : 6, 5, oak ? 17 : 29);
      N.fibre = makeNoise(oak ? 48 : 30, 6, 33);
      N.fine = makeFbm(16, 32, 45, 2);
      N.lichen = makeFbm(5, 10, 55, 3);
      N.flake = makeNoise(22, 30, 61);
    }
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const u = (x + 0.5) / w;
        const v = (y + 0.5) / h;
        let r;
        let g;
        let b;
        let hv;
        if (kind === "birch") {
          // Bouleau : blanc crayeux, lenticelles sombres horizontales, plaques noires.
          const grain = N.grain(u, v);
          const dark = smooth(0.62, 0.7, N.patch(u, v)) * (0.55 + 0.45 * N.patchJitter(u, v));
          const lx = u * 5 + N.warp(u, v) * 0.6;
          const lenticel = smooth(0.8, 0.9, N.band(lx, v)) * smooth(0.25, 0.6, N.bandMask(u, v));
          const peel = smooth(0.55, 0.75, N.peel(u, v)) * 0.35;
          const tone = 222 + (grain - 0.5) * 30;
          r = tone - peel * 6;
          g = tone - 3 - peel * 16;
          b = tone - 10 - peel * 22;
          const k = Math.max(dark, lenticel * 0.85);
          r = mix(r, 38, k);
          g = mix(g, 35, k);
          b = mix(b, 33, k);
          hv = 0.6 - lenticel * 0.5 - dark * 0.25 + (grain - 0.5) * 0.2;
        } else {
          // Chêne : crêtes verticales étroites coupées de crevasses ; pin : grandes plaques.
          const warp = (N.warp(u, v) - 0.5) * (oak ? 0.16 : 0.1);
          N.cells(u + warp, v, cell);
          const edge = cell[1] - cell[0];
          const plate = smooth(0.02, oak ? 0.2 : 0.16, edge);
          const fibre = N.fibre(u * 3 + warp * 2, v);
          const fine = N.fine(u, v);
          const id = cell[2];
          if (oak) {
            const lichen = smooth(0.6, 0.74, N.lichen(u, v)) * plate;
            const tone = 108 + (id - 0.5) * 26 + (fibre - 0.5) * 34 + (fine - 0.5) * 20;
            r = tone;
            g = tone * 0.93;
            b = tone * 0.84;
            // Lichens gris-vert pâle, très présents sur les chênes bretons.
            r = mix(r, 150 + fine * 20, lichen * 0.75);
            g = mix(g, 158 + fine * 20, lichen * 0.75);
            b = mix(b, 128 + fine * 16, lichen * 0.75);
            const furrow = 1 - plate;
            r = mix(r, 34, furrow * 0.92);
            g = mix(g, 29, furrow * 0.92);
            b = mix(b, 25, furrow * 0.92);
            hv = plate * 0.8 + (fibre - 0.5) * 0.25 + lichen * 0.05;
          } else {
            const tone = 150 + (id - 0.5) * 40 + (fine - 0.5) * 26;
            r = tone;
            g = tone * 0.8;
            b = tone * 0.66;
            const flake = smooth(0.55, 0.8, N.flake(u, v)) * plate;
            r = mix(r, 196, flake * 0.4);
            g = mix(g, 142, flake * 0.4);
            b = mix(b, 100, flake * 0.4);
            const furrow = 1 - plate;
            r = mix(r, 44, furrow * 0.9);
            g = mix(g, 32, furrow * 0.9);
            b = mix(b, 26, furrow * 0.9);
            hv = plate * 0.7 + (fine - 0.5) * 0.15 + flake * 0.1;
          }
        }
        const i = (y * w + x) * 4;
        color[i] = r < 0 ? 0 : r > 255 ? 255 : r;
        color[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
        color[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
        color[i + 3] = 255;
        height[y * w + x] = hv;
      }
    const normal = new Uint8Array(w * h * 4);
    const strength = kind === "birch" ? 2.2 : 5.5;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const dx = (height[y * w + ((x + w - 1) % w)] - height[y * w + ((x + 1) % w)]) * strength;
        const dy = (height[((y + h - 1) % h) * w + x] - height[((y + 1) % h) * w + x]) * strength;
        const l = Math.hypot(dx, dy, 1);
        const i = (y * w + x) * 4;
        normal[i] = ((dx / l) * 0.5 + 0.5) * 255;
        normal[i + 1] = ((-dy / l) * 0.5 + 0.5) * 255;
        normal[i + 2] = ((1 / l) * 0.5 + 0.5) * 255;
        normal[i + 3] = 255;
      }
    return { color, normal };
  }

  function dataTexture(THREE, data, w, h, srgb) {
    // Vue « clamped » des mêmes octets : l'export GLB passe ce tableau tel quel à ImageData,
    // qui refuse un simple Uint8Array.
    const pixels = data instanceof Uint8ClampedArray ? data : new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength);
    const texture = new THREE.DataTexture(pixels, w, h, THREE.RGBAFormat);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.anisotropy = 4;
    texture.encoding = srgb ? THREE.sRGBEncoding : THREE.LinearEncoding;
    texture.needsUpdate = true;
    return texture;
  }

  // ---------------------------------------------------------------------------
  // Atlas des feuillages : 4 × 4 cases dessinées sur un canevas
  // ---------------------------------------------------------------------------
  const CELL = {
    oakA: 0,
    oakB: 1,
    oakC: 2,
    oakDense: 3,
    birchA: 4,
    birchB: 5,
    birchDense: 6,
    oakDenseB: 7,
    pineA: 8,
    pineB: 9,
    pineDense: 10,
    pineC: 11,
    bark: 12,
    birchBark: 13,
    oakAutumn: 14,
    pineSpray: 15,
  };
  // Rectangle d'une case en coordonnées de texture (v = 0 en haut du canevas).
  function cellRect(index, inset = 0.004) {
    const col = index % 4;
    const row = Math.floor(index / 4);
    return [col / 4 + inset, row / 4 + inset, (col + 1) / 4 - inset, (row + 1) / 4 - inset];
  }

  const LEAF_COLOURS = {
    // Vert olive des chênes des photos (fin d'été), un peu plus jaune au soleil.
    oak: ["#525c35", "#5a643a", "#4b5531", "#626b40", "#566037", "#46502e", "#666f40", "#505a34"],
    oakLight: ["#747a47", "#7d824d", "#6d7444"],
    oakAutumn: ["#827638", "#906c33", "#76783a", "#9a8040", "#6a6e37"],
    birch: ["#667539", "#6f803e", "#7a8b45", "#5f6e35", "#84944b", "#6a7a3c"],
    pine: ["#34472f", "#3a4e34", "#415539", "#2f4230", "#475c3e", "#3d5236"],
    fir: ["#2f4531", "#354c37", "#3b523c", "#314733", "#40593f", "#374e39"],
  };
  function hexRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgbString(rgb, k = 1, warm = 0) {
    return `rgb(${clamp(Math.round(rgb[0] * k + warm * 10), 0, 255)},${clamp(Math.round(rgb[1] * k + warm * 4), 0, 255)},${clamp(
      Math.round(rgb[2] * k - warm * 6),
      0,
      255,
    )})`;
  }
  const pick = (rnd, list) => list[Math.floor(rnd() * list.length)];

  // Contours de feuilles (demi-largeur le long de la nervure, s de 0 au pétiole à 1 à la pointe).
  // Chêne pédonculé : obovale, 4 à 5 lobes arrondis de chaque côté, sinus étroits.
  function oakOutline(rnd) {
    const lobes = 4 + (rnd() < 0.5 ? 1 : 0);
    const phase = [rnd() * 0.3, rnd() * 0.3];
    return (s, side) => {
      const envelope = Math.pow(Math.sin(Math.PI * Math.pow(s, 0.78)), 0.85) * (0.42 + 0.58 * smooth(0, 0.72, s));
      // Lobes en demi-cercle (arrondis des deux côtés), sinus étroits entre eux.
      const f = lobes * s + phase[side];
      const u = 2 * (f - Math.floor(f)) - 1;
      const lobe = 0.58 + 0.42 * Math.sqrt(Math.max(0, 1 - u * u));
      return 0.27 * envelope * (s > 0.86 ? mix(lobe, 1, smooth(0.86, 0.96, s)) : lobe);
    };
  }
  // Bouleau : feuille triangulaire, pointe effilée, bord finement denté.
  function birchOutline() {
    return (s) => 0.42 * Math.pow(Math.sin(Math.PI * Math.pow(s, 0.55)), 1.2) * (1 - 0.12 * s) * (1 + 0.06 * Math.sin(s * 70));
  }
  // Dessine une feuille : limbe, moitié pliée plus sombre, nervure claire.
  function paintLeaf(ctx, leaf) {
    const { x, y, angle, length: L, outline, colour } = leaf;
    const N = leaf.detail || 30;
    const right = [];
    const left = [];
    for (let i = 1; i < N; i++) {
      const s = i / N;
      right.push([outline(s, 0) * L, -s * L]);
      left.push([-outline(s, 1) * L, -s * L]);
    }
    const c = Math.cos(angle);
    const sn = Math.sin(angle);
    const tx = (p) => x + p[0] * c - p[1] * sn;
    const ty = (p) => y + p[0] * sn + p[1] * c;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (const p of right) ctx.lineTo(tx(p), ty(p));
    ctx.lineTo(tx([0, -L]), ty([0, -L]));
    for (let i = left.length - 1; i >= 0; i--) ctx.lineTo(tx(left[i]), ty(left[i]));
    ctx.closePath();
    ctx.fillStyle = colour;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (const p of leaf.fold ? right : left) ctx.lineTo(tx(p), ty(p));
    ctx.lineTo(tx([0, -L]), ty([0, -L]));
    ctx.closePath();
    ctx.fillStyle = leaf.fold ? "rgba(8,16,4,0.2)" : "rgba(255,255,215,0.07)";
    ctx.fill();
    ctx.strokeStyle = "rgba(210,220,150,0.28)";
    ctx.lineWidth = Math.max(0.0035, L * 0.035);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(tx([0, -L * 0.86]), ty([0, -L * 0.86]));
    ctx.stroke();
  }

  // Chaque motif de l'atlas est d'abord décrit (rameaux, feuilles, aiguilles), puis recadré
  // pour remplir sa case sans jamais déborder : aucune feuille coupée au bord de la case.
  //
  // Pousse de chêne : feuilles groupées vers le bout de chaque rameau, mais étagées sur
  // les derniers centimètres (pas en étoile), quelques feuilles alternes plus bas.
  function oakShoot(rnd, twigs, leaves, start, direction, reach, width) {
    const bend = (rnd() - 0.5) * 0.5;
    const pts = [];
    for (let i = 0; i <= 5; i++) {
      const t = i / 5;
      const a = direction + bend * t;
      pts.push([start[0] + Math.cos(a) * reach * t, start[1] + Math.sin(a) * reach * t]);
    }
    twigs.push({ pts, width });
    const at = (t) => {
      const f = t * 5;
      const i = Math.min(4, Math.floor(f));
      return [mix(pts[i][0], pts[i + 1][0], f - i), mix(pts[i][1], pts[i + 1][1], f - i)];
    };
    const tip = direction + bend;
    const cluster = 4 + Math.floor(rnd() * 3);
    for (let r = 0; r < cluster; r++) {
      const t = 0.72 + (r / cluster) * 0.28;
      const side = r % 2 ? 1 : -1;
      const spread = r === cluster - 1 ? (rnd() - 0.5) * 0.3 : side * (0.35 + rnd() * 0.75);
      const p = at(t);
      leaves.push({ x: p[0], y: p[1], angle: tip + spread + Math.PI / 2, length: 0.17 + rnd() * 0.07 });
    }
    for (let t = 0.22; t < 0.66; t += 0.16 + rnd() * 0.08) {
      const side = rnd() < 0.5 ? 1 : -1;
      const p = at(t);
      leaves.push({ x: p[0], y: p[1], angle: direction + bend * t + side * (0.7 + rnd() * 0.5) + Math.PI / 2, length: 0.13 + rnd() * 0.05 });
    }
    return pts;
  }

  function oakSprig(rnd, palette, dense, light) {
    const twigs = [];
    const leaves = [];
    if (dense) {
      // Bouquet dense (arbres lointains) : pousses dans toutes les directions.
      const shoots = 9;
      for (let k = 0; k < shoots; k++) {
        const direction = (k / shoots) * TAU + rnd() * 0.5;
        oakShoot(rnd, twigs, leaves, [Math.cos(direction) * 0.04, Math.sin(direction) * 0.04], direction, 0.3 + rnd() * 0.12, 0.01);
      }
      for (let k = 0; k < 16; k++) {
        const a = rnd() * TAU;
        const r = 0.08 + Math.sqrt(rnd()) * 0.22;
        leaves.push({ x: Math.cos(a) * r, y: Math.sin(a) * r, angle: a + Math.PI / 2 + (rnd() - 0.5) * 1.4, length: 0.13 + rnd() * 0.06 });
      }
    } else {
      // Rameau : un axe qui monte, des pousses latérales alternes plus courtes.
      const axisDirection = -Math.PI / 2 + (rnd() - 0.5) * 0.3;
      const axis = oakShoot(rnd, twigs, leaves, [0, 0], axisDirection, 0.62 + rnd() * 0.1, 0.014);
      const sides = 3 + Math.floor(rnd() * 2);
      for (let k = 0; k < sides; k++) {
        const t = 0.18 + (k / sides) * 0.55 + rnd() * 0.06;
        const f = t * 5;
        const i = Math.min(4, Math.floor(f));
        const from = [mix(axis[i][0], axis[i + 1][0], f - i), mix(axis[i][1], axis[i + 1][1], f - i)];
        const side = k % 2 ? 1 : -1;
        oakShoot(rnd, twigs, leaves, from, axisDirection + side * (0.55 + rnd() * 0.35), (0.3 + rnd() * 0.14) * (1 - t * 0.35), 0.01);
      }
    }
    // Ordre de dessin mélangé ; les feuilles du fond (dessinées d'abord) sont plus sombres.
    for (let i = leaves.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [leaves[i], leaves[j]] = [leaves[j], leaves[i]];
    }
    leaves.forEach((leaf, i) => {
      const depth = i / leaves.length;
      const bright = light && rnd() < light * (0.3 + depth);
      leaf.colour = rgbString(hexRgb(pick(rnd, bright ? palette.light : palette.main)), 0.74 + 0.34 * depth + rnd() * 0.08, rnd() * 0.3);
      leaf.outline = oakOutline(rnd);
      leaf.detail = 64;
      leaf.fold = rnd() < 0.55;
    });
    return { twigs, leaves, needles: [], twigColour: "#4d3f31" };
  }

  function birchSprig(rnd, palette, dense) {
    const twigs = [];
    const leaves = [];
    const strands = dense ? 8 : 4 + Math.floor(rnd() * 2);
    for (let k = 0; k < strands; k++) {
      const x0 = dense ? (rnd() - 0.5) * 0.7 : (k - (strands - 1) / 2) * 0.13 + (rnd() - 0.5) * 0.06;
      const y0 = dense ? (rnd() - 0.5) * 0.3 : rnd() * 0.08;
      const out = (x0 >= 0 ? 1 : -1) * (0.05 + rnd() * 0.12);
      const L = dense ? 0.45 + rnd() * 0.25 : 0.55 + rnd() * 0.4;
      const pts = [];
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        // Tige qui part vers l'extérieur puis retombe.
        pts.push([x0 + out * Math.sin(t * 1.6) + Math.sin(t * 5 + k) * 0.012, y0 + L * t * t * 0.85 + L * t * 0.15]);
      }
      twigs.push({ pts, width: 0.0065 });
      let t = 0.12 + rnd() * 0.08;
      let side = rnd() < 0.5 ? 1 : -1;
      while (t < 1) {
        const f = t * 8;
        const i = Math.min(7, Math.floor(f));
        const p = [mix(pts[i][0], pts[i + 1][0], f - i), mix(pts[i][1], pts[i + 1][1], f - i)];
        leaves.push({ x: p[0], y: p[1], angle: Math.PI + side * (0.35 + rnd() * 0.75), length: 0.085 + rnd() * 0.05 });
        side = -side;
        t += 0.07 + rnd() * 0.07;
      }
      const tip = pts[8];
      for (let r = 0; r < 3; r++) leaves.push({ x: tip[0], y: tip[1], angle: Math.PI + (r - 1) * 0.5 + (rnd() - 0.5) * 0.3, length: 0.08 + rnd() * 0.04 });
    }
    leaves.forEach((leaf) => {
      leaf.colour = rgbString(hexRgb(pick(rnd, palette)), 0.82 + rnd() * 0.3, rnd() * 0.5);
      leaf.outline = birchOutline();
      leaf.fold = rnd() < 0.5;
    });
    return { twigs, leaves, needles: [], twigColour: "#3f3129" };
  }

  function pineTufts(rnd, palette, dense) {
    const twigs = [];
    const needles = [];
    const tufts = dense ? 9 : 4 + Math.floor(rnd() * 2);
    for (let k = 0; k < tufts; k++) {
      let tip;
      let direction;
      if (dense) {
        direction = rnd() * TAU;
        const r = 0.05 + rnd() * 0.18;
        tip = [Math.cos(direction) * r, Math.sin(direction) * r];
      } else {
        direction = -Math.PI / 2 + (k - (tufts - 1) / 2) * 0.48 + (rnd() - 0.5) * 0.2;
        const reach = 0.3 + rnd() * 0.2;
        tip = [Math.cos(direction) * reach, Math.sin(direction) * reach];
        twigs.push({ pts: [[0, 0], [tip[0] * 0.5, tip[1] * 0.5], tip], width: 0.014 });
      }
      const count = dense ? 95 : 120;
      for (let n = 0; n < count; n++) {
        // Aiguilles par paires, rayonnant en pinceau depuis le bout de la pousse.
        const spread = n < count * 0.2 ? 2.9 : 1.9;
        const a = direction + (rnd() - 0.5) * spread;
        const L = 0.11 + rnd() * 0.1;
        const back = rnd() * 0.08;
        const x0 = tip[0] - Math.cos(direction) * back;
        const y0 = tip[1] - Math.sin(direction) * back;
        const curl = a + (rnd() - 0.5) * 0.35;
        needles.push({
          x0,
          y0,
          cx: x0 + Math.cos(a) * L * 0.55,
          cy: y0 + Math.sin(a) * L * 0.55,
          x1: x0 + Math.cos(curl) * L,
          y1: y0 + Math.sin(curl) * L,
          width: 0.0055 + rnd() * 0.0025,
          colour: rgbString(hexRgb(pick(rnd, palette)), 0.8 + rnd() * 0.45),
        });
      }
    }
    return { twigs, leaves: [], needles, twigColour: "#57402f" };
  }

  // Masse de feuillage des arbres lointains : environ deux cents petites feuilles en
  // quelques touffes (une carte couvre 2 à 3 m : les feuilles gardent leur taille réelle).
  function leafMass(rnd, palette, light, kind) {
    const twigs = [];
    const leaves = [];
    const tufts = [];
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * TAU + rnd() * 0.6;
      const r = k === 0 ? 0 : 0.18 + rnd() * 0.16;
      tufts.push([Math.cos(a) * r, Math.sin(a) * r, 0.16 + rnd() * 0.08]);
    }
    for (const [cx, cy] of tufts) twigs.push({ pts: [[0, 0.05], [cx * 0.6, cy * 0.6 + 0.03], [cx, cy]], width: 0.008 });
    const count = kind === "birch" ? 170 : 210;
    for (let i = 0; i < count; i++) {
      const [cx, cy, spread] = tufts[Math.floor(rnd() * tufts.length)];
      const a = rnd() * TAU;
      const r = spread * Math.sqrt(rnd());
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r * (kind === "birch" ? 1.25 : 1);
      const angle = kind === "birch" ? Math.PI + (rnd() - 0.5) * 1.6 : a + Math.PI / 2 + (rnd() - 0.5) * 1.8;
      leaves.push({ x, y, angle, length: kind === "birch" ? 0.055 + rnd() * 0.025 : 0.07 + rnd() * 0.03 });
    }
    leaves.forEach((leaf, i) => {
      const depth = i / leaves.length;
      const bright = light && rnd() < light * (0.3 + depth);
      const hex = bright && palette.light ? pick(rnd, palette.light) : pick(rnd, palette.main || palette);
      leaf.colour = rgbString(hexRgb(hex), 0.72 + 0.36 * depth + rnd() * 0.08, rnd() * 0.3);
      leaf.outline = kind === "birch" ? birchOutline() : oakOutline(rnd);
      leaf.detail = kind === "birch" ? 16 : 28;
      leaf.fold = rnd() < 0.5;
    });
    return { twigs, leaves, needles: [], twigColour: "#4d3f31" };
  }

  // Rameau de résineux à plat (jeune pin conique, « sapin à étages ») : une tige et ses
  // pousses latérales garnies d'aiguilles courtes des deux côtés.
  function pineSpray(rnd, palette) {
    const twigs = [];
    const needles = [];
    const shoots = [];
    const axis = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      axis.push([Math.sin(t * 2.2) * 0.04, -t * 0.95]);
    }
    shoots.push({ pts: axis, width: 0.014 });
    for (let k = 0; k < 7; k++) {
      const t = 0.12 + k * 0.11 + (rnd() - 0.5) * 0.03;
      const i = Math.min(7, Math.floor(t * 8));
      const f = t * 8 - i;
      const from = [mix(axis[i][0], axis[i + 1][0], f), mix(axis[i][1], axis[i + 1][1], f)];
      const side = k % 2 ? 1 : -1;
      const a = -Math.PI / 2 + side * (0.95 + rnd() * 0.3);
      const L = (0.42 - t * 0.28) * (0.8 + rnd() * 0.3);
      const pts = [];
      for (let j = 0; j <= 4; j++) {
        const s = j / 4;
        const bend = a - side * 0.25 * s;
        pts.push([from[0] + Math.cos(bend) * L * s, from[1] + Math.sin(bend) * L * s]);
      }
      shoots.push({ pts, width: 0.008 });
    }
    for (const shoot of shoots) {
      twigs.push(shoot);
      const pts = shoot.pts;
      for (let j = 0; j < pts.length - 1; j++) {
        const a = Math.atan2(pts[j + 1][1] - pts[j][1], pts[j + 1][0] - pts[j][0]);
        for (let s = 0; s < 1; s += 0.12) {
          const p = [mix(pts[j][0], pts[j + 1][0], s), mix(pts[j][1], pts[j + 1][1], s)];
          for (const side of [-1, 1]) {
            const na = a + side * (0.95 + rnd() * 0.35);
            const L = 0.05 + rnd() * 0.035;
            needles.push({
              x0: p[0],
              y0: p[1],
              cx: p[0] + Math.cos(na) * L * 0.5,
              cy: p[1] + Math.sin(na) * L * 0.5,
              x1: p[0] + Math.cos(na + side * 0.12) * L,
              y1: p[1] + Math.sin(na + side * 0.12) * L,
              width: 0.006 + rnd() * 0.002,
              colour: rgbString(hexRgb(pick(rnd, palette)), 0.82 + rnd() * 0.4),
            });
          }
        }
      }
    }
    return { twigs, leaves: [], needles, twigColour: "#4a3a2c" };
  }

  // Recadre un motif dans le carré [0,1] (marge comprise) sans le déformer.
  function fitPattern(pattern, margin) {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    const grow = (x, y, r = 0) => {
      x0 = Math.min(x0, x - r);
      y0 = Math.min(y0, y - r);
      x1 = Math.max(x1, x + r);
      y1 = Math.max(y1, y + r);
    };
    for (const t of pattern.twigs) for (const p of t.pts) grow(p[0], p[1], t.width);
    for (const l of pattern.leaves) {
      grow(l.x, l.y, 0.01);
      const tip = [l.x + Math.sin(l.angle) * l.length, l.y - Math.cos(l.angle) * l.length];
      grow(tip[0], tip[1], l.length * 0.35);
      grow((l.x + tip[0]) / 2, (l.y + tip[1]) / 2, l.length * 0.36);
    }
    for (const n of pattern.needles) {
      grow(n.x0, n.y0, n.width);
      grow(n.x1, n.y1, n.width);
      grow(n.cx, n.cy, n.width);
    }
    const size = Math.max(x1 - x0, y1 - y0);
    const k = (1 - 2 * margin) / size;
    const ox = margin + (1 - 2 * margin - (x1 - x0) * k) / 2 - x0 * k;
    const oy = margin + (1 - 2 * margin - (y1 - y0) * k) - y0 * k;
    return { k, ox, oy };
  }

  function paintPattern(ctx, pattern) {
    ctx.lineCap = "round";
    ctx.strokeStyle = pattern.twigColour;
    for (const t of pattern.twigs) {
      for (let i = 0; i < t.pts.length - 1; i++) {
        ctx.lineWidth = t.width * mix(1, 0.55, i / (t.pts.length - 1));
        ctx.beginPath();
        ctx.moveTo(t.pts[i][0], t.pts[i][1]);
        ctx.lineTo(t.pts[i + 1][0], t.pts[i + 1][1]);
        ctx.stroke();
      }
    }
    for (const leaf of pattern.leaves) paintLeaf(ctx, leaf);
    for (const n of pattern.needles) {
      ctx.strokeStyle = n.colour;
      ctx.lineWidth = n.width;
      ctx.beginPath();
      ctx.moveTo(n.x0, n.y0);
      ctx.quadraticCurveTo(n.cx, n.cy, n.x1, n.y1);
      ctx.stroke();
    }
  }

  function buildLeafAtlas(THREE, size, barkImage) {
    const timings = {};
    let clock = performance.now();
    const lap = (name) => {
      const now = performance.now();
      timings[name] = Math.round(now - clock);
      clock = now;
    };
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, size, size);
    const cellSize = size / 4;
    const paint = (index, seed, make) => {
      const col = index % 4;
      const row = Math.floor(index / 4);
      const pattern = make(random(seed));
      // Marge transparente : les niveaux réduits de l'atlas ne débordent pas sur la case voisine.
      const fit = fitPattern(pattern, 0.035);
      ctx.save();
      ctx.translate(col * cellSize, row * cellSize);
      ctx.scale(cellSize, cellSize);
      ctx.translate(fit.ox, fit.oy);
      ctx.scale(fit.k, fit.k);
      paintPattern(ctx, pattern);
      ctx.restore();
    };
    const oak = { main: LEAF_COLOURS.oak, light: LEAF_COLOURS.oakLight };
    paint(CELL.oakA, 101, (rnd) => oakSprig(rnd, oak, false, 0.08));
    paint(CELL.oakB, 202, (rnd) => oakSprig(rnd, oak, false, 0.05));
    paint(CELL.oakC, 303, (rnd) => oakSprig(rnd, oak, false, 0.12));
    paint(CELL.oakDense, 404, (rnd) => leafMass(rnd, oak, 0.08, "oak"));
    paint(CELL.oakDenseB, 505, (rnd) => leafMass(rnd, oak, 0.12, "oak"));
    paint(CELL.oakAutumn, 606, (rnd) => oakSprig(rnd, { main: LEAF_COLOURS.oakAutumn, light: LEAF_COLOURS.oakLight }, false, 0.2));
    paint(CELL.birchA, 707, (rnd) => birchSprig(rnd, LEAF_COLOURS.birch, false));
    paint(CELL.birchB, 808, (rnd) => birchSprig(rnd, LEAF_COLOURS.birch, false));
    paint(CELL.pineSpray, 818, (rnd) => pineSpray(rnd, LEAF_COLOURS.fir));
    paint(CELL.birchDense, 909, (rnd) => leafMass(rnd, LEAF_COLOURS.birch, 0, "birch"));
    paint(CELL.pineA, 1001, (rnd) => pineTufts(rnd, LEAF_COLOURS.pine, false));
    paint(CELL.pineB, 1102, (rnd) => pineTufts(rnd, LEAF_COLOURS.pine, false));
    paint(CELL.pineC, 1203, (rnd) => pineTufts(rnd, LEAF_COLOURS.pine, false));
    paint(CELL.pineDense, 1304, (rnd) => pineTufts(rnd, LEAF_COLOURS.pine, true));
    // Écorces des arbres lointains (le tronc est dessiné avec le feuillage : un seul appel).
    for (const [index, tone] of [
      [CELL.bark, "#6e6457"],
      [CELL.birchBark, "#dedbd2"],
    ]) {
      const col = index % 4;
      const row = Math.floor(index / 4);
      ctx.fillStyle = tone;
      ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
      if (index === CELL.bark && barkImage) {
        ctx.globalAlpha = 0.55;
        ctx.globalCompositeOperation = "multiply";
        ctx.drawImage(barkImage, col * cellSize, row * cellSize, cellSize, cellSize);
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1;
      }
      if (index === CELL.birchBark) {
        const rnd = random(77);
        ctx.fillStyle = "#2f2c29";
        for (let i = 0; i < 40; i++)
          ctx.fillRect(col * cellSize + rnd() * cellSize * 0.8, row * cellSize + rnd() * cellSize, cellSize * (0.04 + rnd() * 0.16), cellSize * 0.012);
      }
    }
    lap("draw");
    // Le canevas est envoyé tel quel, en alpha prémultiplié : pas de relecture (lente) et
    // des niveaux réduits sans liseré sombre ; le shader rétablit la couleur des feuilles.
    // v = 0 en haut du canevas (pas de retournement), comme les rectangles de cellRect.
    const texture = new THREE.CanvasTexture(canvas);
    texture.flipY = false;
    texture.premultiplyAlpha = true;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.anisotropy = 4;
    texture.encoding = THREE.sRGBEncoding;
    texture.needsUpdate = true;
    return { texture, canvas, timings };
  }

  // ---------------------------------------------------------------------------
  // Squelettes : tronc, charpentières, branches, rameaux et bouquets de feuilles
  // ---------------------------------------------------------------------------
  // Hauteur 1 = sommet de l'arbre ; la largeur est ensuite multipliée par l'étalement.
  // Rayon du tronc à 1,30 m pour un arbre « moyen » (diamètre = 4,1 % de la hauteur) :
  // l'épaisseur réelle de chaque arbre est rétablie dans le shader.
  const TRUNK_RADIUS = 0.0205;

  function profile(species, variant, hero) {
    const heroK = hero ? 1 : 0;
    if (species === "pine") {
      const young = variant % 2 === 1;
      return {
        kind: "pine",
        young,
        crown: young ? { c: [0, 0.58, 0], r: [0.27, 0.42, 0.27] } : { c: [0, 0.8, 0], r: [0.25, 0.2, 0.25] },
        trunkTop: young ? 0.99 : 0.97,
        trunkTopRadius: 0.16,
        flare: 0.25,
        lean: young ? 0.012 : 0.035,
        wiggle: young ? 0.004 : 0.012,
        cardsPerLobe: (young ? 10 : 18) + heroK * 6,
        cardSize: young ? 0.026 : 0.032,
        cardUp: young ? 0.7 : 0.55,
        cells: young ? [CELL.pineSpray] : [CELL.pineA, CELL.pineB, CELL.pineC],
        farCells: young ? [CELL.pineSpray] : [CELL.pineA, CELL.pineB, CELL.pineC],
        farCards: young ? 1 : 3,
        farSize: 0.95,
        bark: "pine",
      };
    }
    if (species === "birch") {
      const weeping = variant % 2 === 1;
      return {
        kind: "birch",
        crown: { c: [0, 0.62, 0], r: [weeping ? 0.23 : 0.2, 0.37, weeping ? 0.23 : 0.2] },
        trunkTop: 0.95,
        trunkTopRadius: 0.12,
        flare: 0.2,
        lean: 0.02,
        wiggle: 0.008,
        lobes: 34 + heroK * 12,
        lobeRadius: 0.058,
        lobeSquash: [0.85, 1.3, 0.85],
        limbs: 12 + heroK * 3,
        limbFrom: 0.26,
        limbTo: 0.86,
        limbPolar: [0.35, 0.72],
        limbBend: weeping ? -0.12 : -0.06,
        gnarl: 0.02,
        limbRadius: 0.3,
        cardsPerLobe: 18 + heroK * 6,
        cardSize: 0.026,
        cardUp: -0.2,
        inner: 0.1,
        hanging: true,
        cells: [CELL.birchA, CELL.birchB],
        farCells: [CELL.birchDense, CELL.birchA],
        farCards: 2,
        farSize: 1.2,
        bark: "birch",
      };
    }
    const old = species === "old";
    const v = variant % 4;
    const narrow = !old && v === 1;
    const broad = old || v === 2;
    const leaning = !old && v === 3;
    const wx = old ? 1.45 : broad ? 1.14 : narrow ? 0.8 : 1;
    const hy = old ? 0.9 : narrow ? 1.08 : broad ? 0.93 : 1;
    return {
      kind: old ? "old" : "oak",
      crown: {
        c: [leaning ? 0.05 : 0, 1 - 0.36 * hy, leaning ? -0.02 : 0],
        r: [0.38 * wx, 0.36 * hy, 0.38 * wx * (leaning ? 0.88 : 1)],
      },
      trunkTop: old ? 0.33 : narrow ? 0.7 : broad ? 0.5 : 0.6,
      trunkTopRadius: old ? 0.8 : 0.52,
      flare: old ? 0.9 : 0.6,
      lean: leaning ? 0.05 : 0.015,
      wiggle: old ? 0.02 : 0.01,
      lobes: (old ? 66 : 56) + heroK * 18,
      lobeRadius: old ? 0.1 : 0.088,
      lobeSquash: [1, 0.86, 1],
      limbs: (old ? 6 : 5) + heroK * 2,
      limbFrom: old ? 0.2 : broad ? 0.36 : 0.34,
      limbTo: old ? 0.33 : narrow ? 0.66 : 0.58,
      limbPolar: old ? [0.95, 1.35] : narrow ? [0.35, 0.7] : [0.55, 0.95],
      limbBend: old ? 0.1 : 0.06,
      gnarl: old ? 0.07 : 0.035,
      limbRadius: old ? 0.62 : 0.5,
      leader: !old,
      cardsPerLobe: (old ? 28 : 27) + heroK * 8,
      cardSize: 0.033,
      cardUp: 0.12,
      inner: old ? 0.2 : 0.22,
      accentCell: CELL.oakAutumn,
      accent: 0.035,
      cells: [CELL.oakA, CELL.oakB, CELL.oakC],
      farCells: [CELL.oakDense, CELL.oakDenseB],
      farCards: 2,
      farSize: 1.26,
      bark: "oak",
    };
  }

  function envelopeDistance(p, d, C, R) {
    const px = (p[0] - C[0]) / R[0];
    const py = (p[1] - C[1]) / R[1];
    const pz = (p[2] - C[2]) / R[2];
    const dx = d[0] / R[0];
    const dy = d[1] / R[1];
    const dz = d[2] / R[2];
    const a = dx * dx + dy * dy + dz * dz;
    const b = 2 * (px * dx + py * dy + pz * dz);
    const c = px * px + py * py + pz * pz - 1;
    const disc = b * b - 4 * a * c;
    if (disc < 0) return 0;
    return Math.max(0, (-b + Math.sqrt(disc)) / (2 * a));
  }

  // Courbe d'une branche de a vers b : cambrure (bend, décalage au milieu) et nœuds (gnarl).
  function bough(a, b, segments, bendVector, gnarl, rnd) {
    const axis = sub(b, a);
    const l = length(axis);
    const dir = scale(axis, 1 / (l || 1));
    let side = cross(dir, [0, 1, 0]);
    if (length(side) < 0.1) side = [1, 0, 0];
    side = norm(side);
    const other = norm(cross(dir, side));
    const g1 = (rnd() - 0.5) * 2;
    const g2 = (rnd() - 0.5) * 2;
    const g3 = (rnd() - 0.5) * 2;
    const phase = rnd() * TAU;
    const pts = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      let p = lerp3(a, b, t);
      p = add(p, scale(bendVector, 4 * t * (1 - t)));
      const wob = Math.sin(Math.PI * t) * gnarl * l;
      p = add(p, scale(side, wob * (g1 * 0.7 * Math.sin(t * 5 + phase) + g3 * 0.3)));
      p = add(p, scale(other, wob * g2 * 0.6 * Math.sin(t * 7 + phase * 1.7)));
      pts.push(p);
    }
    return pts;
  }
  function pointAt(pts, t) {
    const f = clamp(t, 0, 1) * (pts.length - 1);
    const i = Math.min(pts.length - 2, Math.floor(f));
    return lerp3(pts[i], pts[i + 1], f - i);
  }
  function closestT(pts, p, tMin) {
    let best = tMin;
    let bestD = Infinity;
    for (let k = 0; k <= 24; k++) {
      const t = mix(tMin, 1, k / 24);
      const q = pointAt(pts, t);
      const d = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2 + (q[2] - p[2]) ** 2;
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    return best;
  }

  // Squelette complet d'une essence : branches (polylignes et rayons) et bouquets.
  function skeleton(species, variant, hero) {
    const P = profile(species, variant, hero);
    const seed = (variant % 4) * 7919 + ({ oak: 17, pine: 71, birch: 39, old: 101 }[species] || 17) * 104729 + (hero ? 3 : 0);
    const rnd = random(seed);
    const branches = [];
    const lobes = [];
    const C = P.crown.c;
    const R = P.crown.r;
    // Tronc : léger fruit, sinuosité, empattement au pied.
    const leanDir = norm([Math.cos(rnd() * TAU), 0, Math.sin(rnd() * TAU)]);
    const wigglePhase = rnd() * TAU;
    const trunkAxis = (y) => [
      leanDir[0] * P.lean * y + Math.sin(y * 9 + wigglePhase) * P.wiggle * y,
      y,
      leanDir[2] * P.lean * y + Math.cos(y * 7 + wigglePhase) * P.wiggle * y,
    ];
    const trunkRadius = (y) => TRUNK_RADIUS * mix(1.1, P.trunkTopRadius, Math.pow(clamp(y / P.trunkTop, 0, 1), 0.85));
    const trunkPts = [];
    const trunkRad = [];
    const rings = Math.max(8, Math.round(P.trunkTop / 0.045));
    trunkPts.push(trunkAxis(-0.025));
    trunkRad.push(trunkRadius(0));
    for (let i = 0; i <= rings; i++) {
      const t = i / rings;
      const y = P.trunkTop * Math.pow(t, 1.15);
      trunkPts.push(trunkAxis(y));
      trunkRad.push(trunkRadius(y));
    }
    branches.push({ pts: trunkPts, radii: trunkRad, level: 0, trunk: true, phase: 0, w0: 0, w1: P.kind === "pine" || P.kind === "birch" ? 0.12 : 0.04 });
    const flarePhase = rnd() * TAU;
    const flare = (y, angle) => {
      const f = Math.exp(-Math.max(0, y) / 0.028);
      return 1 + P.flare * f * (0.7 + 0.3 * Math.cos(angle * 5 + flarePhase)) + (y < 0 ? P.flare * 0.3 : 0);
    };
    branches[0].flare = flare;

    // Cartes posées une à une le long des branches (rameaux à plat des jeunes pins).
    const sprays = [];
    const farSprays = [];
    if (P.kind === "pine") pineCrown(P, rnd, trunkAxis, trunkRadius, branches, lobes, hero, sprays, farSprays);
    else broadleafCrown(P, rnd, trunkAxis, trunkRadius, branches, lobes, hero);
    return { P, branches, lobes, sprays, farSprays, crown: P.crown };
  }

  // Feuillus : on répartit d'abord les bouquets dans l'enveloppe de la couronne, puis
  // on fait pousser les charpentières, branches et rameaux qui vont les porter.
  function broadleafCrown(P, rnd, trunkAxis, trunkRadius, branches, lobes, hero) {
    const C = P.crown.c;
    const R = P.crown.r;
    // Silhouette irrégulière : trois ondulations aléatoires de l'enveloppe.
    const bumps = [0, 1, 2].map(() => [randomUnit(rnd), 0.06 + rnd() * 0.06, rnd() * TAU, 2 + rnd() * 2]);
    const irregular = (d) => 1 + bumps.reduce((s, [axis, amp, ph, k]) => s + amp * Math.cos(dot(axis, d) * k + ph), 0);
    const baseR = P.lobeRadius;
    const minDist = baseR * 1.05;
    let attempts = 0;
    const crownBase = P.limbFrom + 0.04;
    while (lobes.length < P.lobes && attempts < P.lobes * 60) {
      attempts++;
      const d = randomUnit(rnd);
      // Moins de bouquets sous la couronne, plus vers le haut et les côtés.
      if (rnd() > 0.15 + 0.85 * smooth(-0.9, 0.1, d[1])) continue;
      // Dessous de couronne plus plat : les bouquets du bas restent près du centre.
      const f = (0.6 + 0.3 * Math.sqrt(rnd())) * irregular(d) * mix(0.8, 1, smooth(-0.9, -0.3, d[1]));
      const c = [C[0] + d[0] * R[0] * f, C[1] + d[1] * R[1] * f, C[2] + d[2] * R[2] * f];
      if (c[1] < crownBase) continue;
      if (lobes.some((l) => (l.c[0] - c[0]) ** 2 + (l.c[1] - c[1]) ** 2 + (l.c[2] - c[2]) ** 2 < minDist * minDist)) continue;
      const r = baseR * (0.8 + 0.4 * rnd()) * (0.85 + 0.3 * smooth(-0.5, 0.8, d[1]));
      lobes.push({ c, r: [r * P.lobeSquash[0], r * P.lobeSquash[1], r * P.lobeSquash[2]], dir: d, w: 0.9 + rnd() * 0.1 });
    }
    // Bouquets intérieurs, moins garnis et plus sombres : ils bouchent les trouées qu'on
    // verrait sinon à travers toute la couronne.
    const innerCount = Math.round(P.lobes * (P.inner || 0));
    for (let k = 0, tries = 0; k < innerCount && tries < innerCount * 40; tries++) {
      const d = randomUnit(rnd);
      const f = 0.22 + 0.32 * rnd();
      const c = [C[0] + d[0] * R[0] * f, C[1] + d[1] * R[1] * f * 0.8, C[2] + d[2] * R[2] * f];
      if (c[1] < crownBase + 0.03) continue;
      const r = baseR * (1.05 + 0.3 * rnd());
      lobes.push({ c, r: [r, r * 0.9, r], dir: d, w: 0.7, density: 0.55, inner: true });
      k++;
    }
    // Charpentières réparties en spirale.
    const limbs = [];
    const count = P.limbs;
    for (let i = 0; i < count; i++) {
      const h = mix(P.limbFrom, P.limbTo, count > 1 ? (i + rnd() * 0.6) / count : 0.5);
      const azimuth = i * 2.39996 + rnd() * 0.5;
      const polar = range(rnd, P.limbPolar[0], P.limbPolar[1]);
      limbs.push({ base: trunkAxis(Math.min(h, P.trunkTop)), dir: fromAngles(azimuth, polar), lobes: [], phase: rnd() * TAU });
    }
    if (P.leader) limbs.push({ base: trunkAxis(P.trunkTop * 0.96), dir: norm([rnd() * 0.2 - 0.1, 1, rnd() * 0.2 - 0.1]), lobes: [], phase: rnd() * TAU, leader: true });
    for (const lobe of lobes) {
      let best = null;
      let bestScore = -Infinity;
      for (const limb of limbs) {
        const to = norm(sub(lobe.c, limb.base));
        const score = dot(to, limb.dir) - (limb.leader ? 0.15 : 0);
        if (score > bestScore) {
          bestScore = score;
          best = limb;
        }
      }
      best.lobes.push(lobe);
    }
    for (const limb of limbs) {
      if (!limb.lobes.length) continue;
      const centroid = scale(limb.lobes.reduce((s, l) => add(s, l.c), [0, 0, 0]), 1 / limb.lobes.length);
      const reach = sub(centroid, limb.base);
      const end = add(limb.base, scale(reach, limb.leader ? 0.62 : 0.7));
      const lLen = length(sub(end, limb.base));
      const bendUp = [0, -P.limbBend * lLen, 0];
      const pts = bough(limb.base, end, 7, bendUp, P.gnarl, rnd);
      const r0 = trunkRadius(limb.base[1]) * P.limbRadius * (limb.leader ? 1.1 : 1);
      const radii = pts.map((_, i) => r0 * mix(1, 0.42, i / (pts.length - 1)));
      branches.push({ pts, radii, level: 1, phase: limb.phase, w0: 0.04, w1: 0.45 });
      // Branches secondaires : bouquets triés autour de l'axe de la charpentière, par groupes.
      const axis = norm(sub(end, limb.base));
      let side = norm(cross(axis, Math.abs(axis[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0]));
      const other = cross(axis, side);
      const sorted = limb.lobes
        .map((l) => {
          const q = sub(l.c, limb.base);
          return { l, a: Math.atan2(dot(q, other), dot(q, side)) + dot(q, axis) * 2 };
        })
        .sort((a, b) => a.a - b.a)
        .map((e) => e.l);
      const groupSize = P.kind === "birch" ? 2 : 3;
      for (let g = 0; g < sorted.length; g += groupSize) {
        const group = sorted.slice(g, g + groupSize);
        const gc = scale(group.reduce((s, l) => add(s, l.c), [0, 0, 0]), 1 / group.length);
        const t = Math.max(0.3, closestT(pts, gc, 0.3));
        const attach = pointAt(pts, t);
        const sEnd = lerp3(attach, gc, 0.8);
        const sLen = length(sub(sEnd, attach));
        const sPts = bough(attach, sEnd, 4, [0, P.kind === "birch" ? 0.05 * sLen : -0.08 * sLen, 0], P.gnarl * 0.8, rnd);
        const sr0 = radii[Math.round(t * (radii.length - 1))] * 0.62;
        branches.push({ pts: sPts, radii: sPts.map((_, i) => sr0 * mix(1, 0.45, i / (sPts.length - 1))), level: 2, phase: limb.phase, w0: mix(0.04, 0.45, t), w1: 0.8 });
        for (const lobe of group) {
          const twigEnd = lerp3(sEnd, lobe.c, P.hanging ? 0.55 : 0.7);
          lobe.attach = twigEnd;
          lobe.phase = limb.phase;
          branches.push({ pts: [sEnd, lerp3(sEnd, twigEnd, 0.5), twigEnd], radii: [sr0 * 0.4, sr0 * 0.3, sr0 * 0.2], level: 3, phase: limb.phase, w0: 0.8, w1: 0.92 });
        }
      }
    }
    for (const lobe of lobes) {
      if (!lobe.attach) {
        lobe.attach = lerp3([C[0], lobe.c[1] * 0.8, C[2]], lobe.c, 0.6);
        lobe.phase = 0;
      }
      if (P.hanging) lobe.c = add(lobe.c, [0, -lobe.r[1] * 0.35, 0]);
    }
  }

  // Pins : charpentières presque horizontales en haut d'un long fût, bouquets plats
  // d'aiguilles (pin mûr) ou étages réguliers (jeune pin conique).
  function pineCrown(P, rnd, trunkAxis, trunkRadius, branches, lobes, hero, sprays, farSprays) {
    const C = P.crown.c;
    const R = P.crown.r;
    const flat = (r) => [r * 1.15, r * 0.5, r * 1.15];
    const addLobe = (c, r, attach, phase, w) => lobes.push({ c, r: flat(r), dir: norm(sub(c, [C[0], c[1] - 0.05, C[2]])), attach, phase, w });
    if (P.young) {
      const coneR = (y) => 0.27 * Math.pow(clamp(1 - (y - 0.2) / 0.8, 0, 1), 0.95) + 0.025;
      let whorl = 0;
      for (let y = 0.24; y < 0.95; y += 0.07 + rnd() * 0.012, whorl++) {
        const n = 4 + (rnd() < 0.5 ? 1 : 0) + (hero ? 1 : 0);
        for (let k = 0; k < n; k++) {
          const azimuth = (k / n) * TAU + whorl * 0.9 + rnd() * 0.4;
          const polar = mix(1.62, 1.35, (y - 0.22) / 0.73) + (rnd() - 0.5) * 0.15;
          const dir = fromAngles(azimuth, polar);
          const base = trunkAxis(y);
          const L = coneR(y) * (0.85 + rnd() * 0.2);
          const end = add(base, scale(dir, L));
          const pts = bough(base, end, 3, [0, -0.12 * L, 0], 0.03, rnd);
          const r0 = trunkRadius(y) * 0.32;
          const phase = rnd() * TAU;
          branches.push({ pts, radii: pts.map((_, i) => r0 * mix(1, 0.3, i / (pts.length - 1))), level: 1, phase, w0: 0.1, w1: 0.8 });
          // Étage de rameaux à plat de part et d'autre de la branche, qui retombent un peu.
          const flatDir = norm([dir[0], 0, dir[2]]);
          const side = norm(cross([0, 1, 0], flatDir));
          for (const t of [0.16, 0.3, 0.44, 0.58, 0.72, 0.86]) {
            const p = pointAt(pts, t);
            const h = clamp(coneR(y) * 0.44, 0.034, 0.085) * (1.15 - 0.4 * t);
            for (const sgn of [-1, 1]) {
              sprays.push({
                centre: add(p, add(scale(side, sgn * h * 0.72), [0, 0.006, 0])),
                normal: norm([side[0] * sgn * 0.32 + (rnd() - 0.5) * 0.2, 1, side[2] * sgn * 0.32 + (rnd() - 0.5) * 0.2]),
                up: norm(add(scale(side, sgn), scale(flatDir, 0.75))),
                half: h,
                phase,
                w: mix(0.5, 1, t),
              });
            }
            // Rameaux qui pendent sous la branche : ils comblent le vide entre deux étages.
            if (t > 0.25 && t < 0.8 && rnd() < 0.7) {
              const sgn = rnd() < 0.5 ? 1 : -1;
              sprays.push({
                centre: add(p, add(scale(side, sgn * h * 0.3), [0, -h * 0.65, 0])),
                normal: norm(add(scale(side, sgn), scale(flatDir, 0.35))),
                up: norm([flatDir[0] * 0.4, -1, flatDir[2] * 0.4]),
                half: h * 0.85,
                phase,
                w: mix(0.5, 1, t),
              });
            }
          }
          const tipHalf = clamp(coneR(y) * 0.3, 0.028, 0.06);
          sprays.push({ centre: add(end, scale(flatDir, tipHalf * 0.5)), normal: [0, 1, 0], up: flatDir, half: tipHalf, phase, w: 1 });
          // Arbre lointain : une grande carte inclinée par branche (visible de côté comme
          // d'en haut), l'ensemble dessine le cône étagé.
          farSprays.push({
            centre: add(pointAt(pts, 0.55), [0, 0.01, 0]),
            normal: norm([flatDir[0] * 0.6, 0.8, flatDir[2] * 0.6]),
            up: flatDir,
            half: L * 0.62 + 0.02,
            phase,
            w: 0.8,
          });
          // …et une carte debout, de profil, pour les branches vues par la tranche.
          farSprays.push({ centre: add(pointAt(pts, 0.5), [0, -0.01, 0]), normal: side, up: norm([flatDir[0], -0.35, flatDir[2]]), half: L * 0.5 + 0.015, phase, w: 0.8 });
        }
      }
      addLobe(trunkAxis(0.965), 0.035, trunkAxis(0.92), 0, 0.9);
      return;
    }
    // Chicots : branches mortes sous la couronne (le pin s'élague seul).
    for (let i = 0; i < 7; i++) {
      const y = mix(0.3, 0.57, rnd());
      const dir = fromAngles(rnd() * TAU, 1.35 + rnd() * 0.4);
      const base = trunkAxis(y);
      const end = add(base, scale(dir, 0.025 + rnd() * 0.035));
      branches.push({ pts: [base, end], radii: [trunkRadius(y) * 0.2, trunkRadius(y) * 0.08], level: 2, phase: 0, w0: 0, w1: 0.05, dead: true });
    }
    const count = 14 + (hero ? 3 : 0);
    for (let i = 0; i < count; i++) {
      const y = mix(0.56, 0.93, (i + rnd() * 0.7) / count);
      const azimuth = i * 2.39996 + rnd() * 0.6;
      const polar = mix(1.55, 0.95, (y - 0.56) / 0.37) + (rnd() - 0.5) * 0.3;
      const dir = fromAngles(azimuth, polar);
      const base = trunkAxis(y);
      const L = Math.max(0.05, envelopeDistance(base, dir, C, R) * (0.78 + rnd() * 0.18));
      const end = add(base, scale(dir, L));
      const pts = bough(base, end, 6, [0, -0.1 * L, 0], 0.08, rnd);
      const r0 = trunkRadius(y) * 0.42;
      const radii = pts.map((_, k) => r0 * mix(1, 0.35, k / (pts.length - 1)));
      const phase = rnd() * TAU;
      branches.push({ pts, radii, level: 1, phase, w0: 0.06, w1: 0.6 });
      // Touffe au bout de la charpentière, une autre à mi-longueur, et des rameaux latéraux.
      addLobe(add(end, [0, 0.02, 0]), 0.075 + rnd() * 0.025, pointAt(pts, 0.8), phase, 0.95);
      addLobe(add(pointAt(pts, 0.62), [0, 0.02, 0]), 0.05 + rnd() * 0.015, pointAt(pts, 0.45), phase, 0.7);
      const sec = 2 + (rnd() < 0.5 ? 1 : 0);
      for (let s = 0; s < sec; s++) {
        const t = 0.45 + rnd() * 0.4;
        const at = pointAt(pts, t);
        const sDir = norm(add(rotateAround(dir, [0, 1, 0], (s % 2 ? 1 : -1) * (0.5 + rnd() * 0.6)), [0, 0.3, 0]));
        const sEnd = add(at, scale(sDir, L * (0.3 + rnd() * 0.2)));
        const sPts = bough(at, sEnd, 3, [0, -0.02, 0], 0.05, rnd);
        const sr = radii[Math.round(t * (radii.length - 1))] * 0.6;
        branches.push({ pts: sPts, radii: [sr, sr * 0.7, sr * 0.5, sr * 0.35], level: 2, phase, w0: mix(0.06, 0.6, t), w1: 0.85 });
        addLobe(add(sEnd, [0, 0.018, 0]), 0.06 + rnd() * 0.02, at, phase, 0.95);
      }
    }
    // Cime : bouquets autour de la flèche.
    for (let k = 0; k < 3; k++) {
      const a = k * 2.1 + rnd();
      addLobe(add(trunkAxis(0.95), [Math.cos(a) * 0.035, 0.01 + k * 0.012, Math.sin(a) * 0.035]), 0.045, trunkAxis(0.92), 0, 0.9);
    }
  }

  // ---------------------------------------------------------------------------
  // Maillages : tubes d'écorce et cartes de feuilles
  // ---------------------------------------------------------------------------
  class MeshBuilder {
    constructor() {
      this.position = [];
      this.normal = [];
      this.uv = [];
      this.color = [];
      this.wind = [];
      this.wood = [];
      this.index = [];
      this.count = 0;
    }
    put(px, py, pz, nx, ny, nz, u, v, r, g, b, w0, w1, w2, w3, a0, a1, a2) {
      this.position.push(px, py, pz);
      this.normal.push(nx, ny, nz);
      this.uv.push(u, v);
      this.color.push(r, g, b);
      this.wind.push(w0, w1, w2, w3);
      this.wood.push(a0, a1, a2);
      return this.count++;
    }
    geometry(THREE) {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(this.position, 3));
      g.setAttribute("normal", new THREE.Float32BufferAttribute(this.normal, 3));
      g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2));
      g.setAttribute("color", new THREE.Float32BufferAttribute(this.color, 3));
      g.setAttribute("aWind", new THREE.Float32BufferAttribute(this.wind, 4));
      g.setAttribute("aWood", new THREE.Float32BufferAttribute(this.wood, 3));
      g.setIndex(this.count > 65535 ? new THREE.Uint32BufferAttribute(this.index, 1) : new THREE.Uint16BufferAttribute(this.index, 1));
      g.computeBoundingBox();
      g.computeBoundingSphere();
      return g;
    }
  }

  // Teinte de l'écorce selon la hauteur et le rang de la branche.
  // Pied des chênes verdi par les mousses, comme dans les sous-bois humides bretons.
  const mossy = (base, y, level) => {
    if (level > 0) return base;
    const k = (1 - smooth(0, 0.14, y)) * 0.55;
    return [mix(base[0], 0.56, k), mix(base[1], 0.68, k), mix(base[2], 0.44, k)];
  };
  const BARK_TINT = {
    oak: (y, level) => mossy(level > 1 ? [0.66, 0.62, 0.58] : [0.8, 0.78, 0.74], y, level),
    old: (y, level) => mossy(level > 1 ? [0.62, 0.6, 0.56] : [0.74, 0.72, 0.68], y, level),
    birch: (y, level) => {
      // Tronc blanc, pied noirci et crevassé ; rameaux fins brun-rouge sombre.
      if (level >= 2) return [0.36, 0.3, 0.27];
      if (level === 1) return [0.78, 0.77, 0.75];
      const k = smooth(0.0, 0.12, y);
      return [mix(0.32, 1, k), mix(0.3, 1, k), mix(0.28, 0.98, k)];
    },
    pine: (y, level) => {
      // Fût gris-brun en bas, écorce orangée en haut ; charpentières plus sombres.
      if (level >= 1) return [0.55, 0.46, 0.4];
      const k = smooth(0.45, 0.75, y);
      return [mix(0.6, 0.92, k), mix(0.54, 0.6, k), mix(0.5, 0.44, k)];
    },
  };

  // Tube d'écorce le long d'une polyligne (repères transportés, sans torsion).
  function tube(B, branch, sides, tint, uvRect) {
    let { pts, radii } = branch;
    // Bout fermé par un petit cône : pas de tube ouvert ni de tronc coupé net (inutile
    // pour les rameaux fins et pour les arbres lointains).
    if (!uvRect && branch.level <= 1 && !branch.dead) {
      const last = pts.length - 1;
      const dir = norm(sub(pts[last], pts[last - 1]));
      const r = radii[last];
      pts = [...pts, add(pts[last], scale(dir, r * 1.6))];
      radii = [...radii, r * 0.12];
    }
    const n = pts.length;
    const T = [];
    for (let i = 0; i < n; i++) T.push(norm(sub(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)])));
    let normalRef = Math.abs(T[0][1]) < 0.9 ? norm(cross(T[0], [0, 1, 0])) : norm(cross(T[0], [1, 0, 0]));
    const circumference = TAU * radii[0] * 15;
    const uRepeat = uvRect ? 1 : Math.max(1, Math.round(circumference / 0.6));
    // Sur une branche fine, un seul motif fait le tour : on le réduit aussi en hauteur pour
    // garder ses proportions (écorce plus fine, pas de losanges étirés).
    const barkRatio = uvRect ? 1 : Math.min(1.25, circumference / uRepeat / 0.6);
    let along = 0;
    const base = B.count;
    for (let i = 0; i < n; i++) {
      if (i > 0) {
        along += length(sub(pts[i], pts[i - 1]));
        normalRef = norm(sub(normalRef, scale(T[i], dot(normalRef, T[i]))));
      }
      const binormal = cross(T[i], normalRef);
      const t = n > 1 ? i / (n - 1) : 0;
      const w = mix(branch.w0, branch.w1, t);
      const colour = tint(pts[i][1], branch.level);
      const ao = branch.trunk ? mix(0.82, 1, smooth(-0.02, 0.2, pts[i][1])) : mix(0.8, 1, t);
      const cr = colour[0] * ao;
      const cg = colour[1] * ao;
      const cb = colour[2] * ao;
      const P = pts[i];
      const a0 = branch.trunk ? P[0] : 0;
      const a1 = branch.trunk ? P[2] : 0;
      const a2 = branch.trunk ? 1 : 0;
      for (let k = 0; k <= sides; k++) {
        const angle = (k / sides) * TAU;
        const ca = Math.cos(angle);
        const sa = Math.sin(angle);
        const dx = normalRef[0] * ca + binormal[0] * sa;
        const dy = normalRef[1] * ca + binormal[1] * sa;
        const dz = normalRef[2] * ca + binormal[2] * sa;
        const r = radii[i] * (branch.flare ? branch.flare(P[1], angle) : 1);
        let u;
        let v;
        if (uvRect) {
          u = mix(uvRect[0], uvRect[2], k / sides);
          v = mix(uvRect[1], uvRect[3], t);
        } else {
          u = (k / sides) * uRepeat;
          v = (along * 15) / (1.2 * barkRatio);
        }
        B.put(P[0] + dx * r, P[1] + dy * r, P[2] + dz * r, dx, dy, dz, u, v, cr, cg, cb, w, branch.phase, 0, 0, a0, a1, a2);
      }
    }
    const ring = sides + 1;
    for (let i = 0; i < n - 1; i++)
      for (let k = 0; k < sides; k++) {
        const a = base + i * ring + k;
        const b = a + 1;
        const c = a + ring;
        const d = c + 1;
        B.index.push(a, b, c, b, d, c);
      }
  }

  // Carte de feuilles : un quadrilatère texturé par une case de l'atlas.
  // Les normales sont celles de la couronne (volume arrondi), pas celles de la carte.
  // (Calculs en scalaires : c'est la boucle la plus chaude de la construction.)
  const CORNERS = [
    [-1, -1, 0, 3],
    [1, -1, 2, 3],
    [1, 1, 2, 1],
    [-1, 1, 0, 1],
  ];
  function leafCard(B, S, centre, normal, up, half, cell, flip, tint, lobe, wind) {
    const right = norm(cross(up, normal));
    const top = cross(normal, right);
    const rect = cellRect(cell);
    const C = S.crown.c;
    const R = S.crown.r;
    const Lc = lobe.c;
    const Lr = lobe.r;
    const base = B.count;
    for (let k = 0; k < 4; k++) {
      const x = CORNERS[k][0];
      const y = CORNERS[k][1];
      const u = rect[flip ? 2 - CORNERS[k][2] : CORNERS[k][2]];
      const v = rect[CORNERS[k][3]];
      const px = centre[0] + (right[0] * x + top[0] * y) * half;
      const py = centre[1] + (right[1] * x + top[1] * y) * half;
      const pz = centre[2] + (right[2] * x + top[2] * y) * half;
      // Normale arrondie : gradient de l'enveloppe de la couronne, un peu de celui du
      // bouquet et une pointe de la carte elle-même.
      let cx = (px - C[0]) / (R[0] * R[0]);
      let cy = (py - C[1]) / (R[1] * R[1]);
      let cz = (pz - C[2]) / (R[2] * R[2]);
      let l = Math.sqrt(cx * cx + cy * cy + cz * cz) || 1;
      cx /= l;
      cy /= l;
      cz /= l;
      let lx = px - Lc[0];
      let ly = py - Lc[1];
      let lz = pz - Lc[2];
      l = Math.sqrt(lx * lx + ly * ly + lz * lz) || 1;
      lx /= l;
      ly /= l;
      lz /= l;
      let nx = cx * 0.58 + lx * 0.3 + normal[0] * 0.12;
      let ny = cy * 0.58 + ly * 0.3 + normal[1] * 0.12 + 0.1;
      let nz = cz * 0.58 + lz * 0.3 + normal[2] * 0.12;
      l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      nx /= l;
      ny /= l;
      nz /= l;
      // Occlusion : cœur de la couronne, dessous et intérieur des bouquets plus sombres.
      const ex = (px - C[0]) / R[0];
      const ey = (py - C[1]) / R[1];
      const ez = (pz - C[2]) / R[2];
      const inner = mix(0.6, 1, smooth(0.35, 1.0, Math.sqrt(ex * ex + ey * ey + ez * ez)));
      const h = clamp((py - (C[1] - R[1])) / (2 * R[1]), 0, 1);
      const below = mix(0.78, 1, Math.pow(h, 0.7));
      const qx = (px - Lc[0]) / Lr[0];
      const qy = (py - Lc[1]) / Lr[1];
      const qz = (pz - Lc[2]) / Lr[2];
      const clump = mix(0.8, 1, smooth(0.2, 1, Math.sqrt(qx * qx + qy * qy + qz * qz)));
      const ao = Math.max(0.5, inner * below * clump);
      B.put(px, py, pz, nx, ny, nz, u, v, tint[0] * ao, tint[1] * ao, tint[2] * ao, wind[0], wind[1], wind[2], wind[3], 0, 0, 0);
    }
    B.index.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  function crownCards(B, S, rnd, far) {
    const P = S.P;
    const C = S.crown.c;
    for (const lobe of S.lobes) {
      const outward = norm(sub(lobe.c, [C[0], C[1] - S.crown.r[1] * 0.3, C[2]]));
      const cards = Math.max(1, Math.round((far ? P.farCards : P.cardsPerLobe) * (lobe.density || 1)));
      const wind = (phase) => [lobe.w, lobe.phase || 0, 1, phase];
      for (let i = 0; i < cards; i++) {
        let dir;
        let f;
        if (far) {
          dir = norm(add(randomUnit(rnd), scale(outward, 1.3)));
          f = 0.25 + rnd() * 0.2;
        } else {
          dir = norm(add(randomUnit(rnd), scale(outward, 0.9)));
          f = 0.5 + 0.5 * Math.pow(rnd(), 0.7);
        }
        const centre = [lobe.c[0] + dir[0] * lobe.r[0] * f, lobe.c[1] + dir[1] * lobe.r[1] * f, lobe.c[2] + dir[2] * lobe.r[2] * f];
        let normal = norm(add(add(scale(dir, 0.7), scale(randomUnit(rnd), far ? 0.6 : 0.5)), [0, P.cardUp, 0]));
        if (dot(normal, outward) < 0) normal = scale(normal, -1);
        // Le haut de la carte (bout des pousses) s'éloigne du rameau qui porte le bouquet.
        let up = P.hanging ? [0, 1, 0] : norm(sub(centre, lobe.attach));
        up = sub(up, scale(normal, dot(up, normal)));
        if (length(up) < 0.05) up = sub([0, 1, 0], scale(normal, normal[1]));
        if (length(up) < 0.05) up = [1, 0, 0];
        up = rotateAround(norm(up), normal, (rnd() - 0.5) * (P.hanging ? 0.5 : 1.1));
        const half = far ? Math.max(lobe.r[0], lobe.r[1]) * P.farSize * (0.85 + rnd() * 0.3) : P.cardSize * (0.75 + rnd() * 0.5);
        const cells = far ? P.farCells : P.cells;
        // Quelques bouquets déjà jaunissants (fin d'été), seulement sur le modèle détaillé.
        const cell = !far && P.accentCell !== undefined && rnd() < P.accent ? P.accentCell : cells[Math.floor(rnd() * cells.length)];
        const k = 0.9 + rnd() * 0.2;
        const warm = (rnd() - 0.5) * 0.1;
        const tint = [k * (1 + warm), k, k * (1 - warm * 1.5)];
        leafCard(B, S, centre, normal, up, half, cell, rnd() < 0.5, tint, lobe, wind(rnd() * TAU));
      }
    }
    // Rameaux posés un à un (jeunes pins en étages).
    for (const spray of far ? S.farSprays : S.sprays) {
      const pseudoLobe = { c: spray.centre, r: [spray.half, spray.half, spray.half] };
      const k = 0.9 + rnd() * 0.2;
      const cells = far ? P.farCells : P.cells;
      leafCard(B, S, spray.centre, spray.normal, spray.up, spray.half, cells[Math.floor(rnd() * cells.length)], rnd() < 0.5, [k, k, k], pseudoLobe, [spray.w, spray.phase, 1, rnd() * TAU]);
    }
  }

  // Construit les géométries d'une essence : l'arbre lointain (bois simplifié + grandes
  // cartes, dans un seul maillage) tout de suite ; le bois et le feuillage détaillés à la
  // demande (buildDetail), car seuls les arbres proches de la caméra en ont besoin.
  function buildModel(THREE, species, variant, hero, detailed = true) {
    const S = skeleton(species, variant, hero);
    const P = S.P;
    const tint = BARK_TINT[species === "old" ? "old" : P.bark] || BARK_TINT.oak;
    const far = new MeshBuilder();
    const barkCell = cellRect(P.bark === "birch" ? CELL.birchBark : CELL.bark, 0.02);
    for (const branch of S.branches) {
      if (branch.level > 1 || branch.dead) continue;
      // Jeunes pins : les rameaux à plat cachent les branches, seul le fût reste.
      if (P.young && !branch.trunk) continue;
      const simplified = { ...branch };
      const keep = branch.trunk ? 4 : 3;
      if (branch.pts.length > keep) {
        simplified.pts = [];
        simplified.radii = [];
        for (let i = 0; i < keep; i++) {
          const f = Math.round((i / (keep - 1)) * (branch.pts.length - 1));
          simplified.pts.push(branch.pts[f]);
          simplified.radii.push(branch.radii[f]);
        }
      }
      tube(far, simplified, branch.trunk ? 5 : 3, tint, barkCell);
    }
    crownCards(far, S, random(777 + variant * 13 + (hero ? 5 : 0)), true);
    const model = { far: far.geometry(THREE), wood: null, leaves: null, skeleton: S, species, variant, hero };
    model.far.userData.catalogue28 = { species, variant, detailed: hero };
    if (detailed) buildDetail(THREE, model);
    return model;
  }
  function buildDetail(THREE, model) {
    if (model.wood) return model;
    const { skeleton: S, species, variant, hero } = model;
    const P = S.P;
    const tint = BARK_TINT[species === "old" ? "old" : P.bark] || BARK_TINT.oak;
    const wood = new MeshBuilder();
    for (const branch of S.branches) {
      // Jeunes pins : une quarantaine de branches fines, presque cachées par les rameaux.
      const sides = branch.trunk ? (hero ? 14 : 10) : branch.level === 1 ? (P.young ? 4 : hero ? 8 : 6) : branch.level === 2 ? 4 : 3;
      tube(wood, branch, sides, tint);
    }
    const leaves = new MeshBuilder();
    crownCards(leaves, S, random(4242 + variant * 31 + (hero ? 7 : 0)), false);
    model.wood = wood.geometry(THREE);
    model.leaves = leaves.geometry(THREE);
    model.wood.userData.catalogue28 = model.leaves.userData.catalogue28 = { species, variant, detailed: hero };
    return model;
  }

  // ---------------------------------------------------------------------------
  // Matériaux et shaders
  // ---------------------------------------------------------------------------
  const VERTEX_PARS = `attribute vec4 aWind;
attribute vec3 aWood;
attribute vec4 aTreeInst;
uniform float uTreeTime;
uniform float uTreeWind;
uniform vec2 uTreeWindDir;
uniform float uTreeClock;
varying vec2 vTreeLod;
varying float vTreeLeaf;
`;
  // Même front de rafales que la V32 (MoulinWind20) : balancement de l'arbre entier,
  // puis oscillation propre à chaque charpentière et frémissement des bouquets.
  const VERTEX_MAIN = `#include <begin_vertex>
  vec3 treeAxisX=modelMatrix[0].xyz,treeAxisY=modelMatrix[1].xyz,treeAxisZ=modelMatrix[2].xyz;
  vec3 treeOrigin=modelMatrix[3].xyz;
  #ifdef USE_INSTANCING
   treeAxisX=(modelMatrix*vec4(instanceMatrix[0].xyz,0.)).xyz;
   treeAxisY=(modelMatrix*vec4(instanceMatrix[1].xyz,0.)).xyz;
   treeAxisZ=(modelMatrix*vec4(instanceMatrix[2].xyz,0.)).xyz;
   treeOrigin=(modelMatrix*vec4(instanceMatrix[3].xyz,1.)).xyz;
  #endif
  float treeSX=max(length(treeAxisX),.001),treeH=max(length(treeAxisY),.001),treeSZ=max(length(treeAxisZ),.001);
  // Épaisseur réelle du tronc (diamètre relevé pour chaque arbre).
  transformed.xz=aWood.xy+(transformed.xz-aWood.xy)*mix(1.,aTreeInst.x>0.?aTreeInst.x:1.,aWood.z);
  // Passage entre l'arbre détaillé (rôle 0) et l'arbre lointain (rôle 1) : fondu tramé de
  // 0,6 s à partir de l'instant du changement (|w|) ; w < 0 : le modèle disparaît.
  float treeVis=clamp((uTreeClock-abs(aTreeInst.w))*1.6667,0.,1.);
  if(aTreeInst.w<0.)treeVis=1.-treeVis;
  vTreeLod=vec2(aTreeInst.y,aTreeInst.y<.5?treeVis:1.-treeVis);
  vTreeLeaf=aWind.z;
  // Modèle masqué : sommet rejeté hors de l'écran, sans calcul de vent ni de lumière.
  if(treeVis<.003){gl_Position=vec4(0.,0.,2.,1.);return;}
  float treeForce=pow(clamp(uTreeWind,0.,1.8),1.05);
  float treeOn=step(.001,uTreeWind);
  vec2 treeDir=normalize(uTreeWindDir+vec2(.00001));
  vec2 treeCross=vec2(-treeDir.y,treeDir.x);
  float treeAlong=dot(treeOrigin.xz,treeDir);
  float treeRand=fract(sin(dot(floor(treeOrigin.xz*1.7),vec2(12.9898,78.233)))*43758.5453);
  float treeFront=sin(treeAlong*.042-uTreeTime*(.55+treeForce*.45)+sin(treeAlong*.011+uTreeTime*.07)*2.2);
  float treeGust=smoothstep(-.2,1.,treeFront)*(.6+.4*sin(uTreeTime*.23+treeRand*6.28));
  float treeReach=(.03+.32*treeForce)*sqrt(treeH*.1)*(.75+.5*treeRand);
  float treeFreq=6.2832*1.2/sqrt(treeH)*(.9+.2*treeRand);
  float treeLean=treeReach*(.45+.55*treeGust);
  float treeSwing=treeReach*.35*sin(uTreeTime*treeFreq+treeRand*6.283-treeAlong*.05);
  float treeSide=treeReach*.18*sin(uTreeTime*treeFreq*1.31+treeRand*11.)*(.5+.5*treeGust);
  float treeMask=clamp(position.y,0.,1.2);treeMask*=treeMask;
  vec3 treeD3=vec3(treeDir.x,0.,treeDir.y),treeC3=vec3(treeCross.x,0.,treeCross.y);
  vec3 treePush=treeD3*treeMask*(treeLean+treeSwing)+treeC3*treeMask*treeSide;
  treePush.y-=dot(treePush.xz,treePush.xz)*.5/treeH;
  float treeBranch=aWind.x*(.015+.13*treeForce)*sqrt(treeH*.07)*(.35+.65*treeGust)*treeOn;
  float treeBT=uTreeTime*(1.25+.5*fract(aWind.y*.159)+.4*treeForce)+aWind.y;
  treePush+=treeD3*treeBranch*(.55+.45*sin(treeBT))+treeC3*treeBranch*.5*sin(treeBT*1.37+1.3)+vec3(0.,treeBranch*.35*sin(treeBT*.83+2.),0.);
  float treeLeafAmp=aWind.z*(.01+.045*treeForce)*(.45+.8*treeGust)*treeOn;
  float treeLT=uTreeTime*(6.3+treeForce*3.)+aWind.w;
  float treeCorner=fract(sin(dot(position,vec3(12.9898,78.233,37.719)))*43758.5453)*6.2831;
  treePush+=treeLeafAmp*vec3(sin(treeLT+treeCorner*.4),.7*sin(treeLT*1.13+1.7+treeCorner*.6),cos(treeLT*.91+treeCorner*.5));
  transformed.x+=dot(treePush.xz,treeAxisX.xz/treeSX)/treeSX;
  transformed.z+=dot(treePush.xz,treeAxisZ.xz/treeSZ)/treeSZ;
  transformed.y+=treePush.y/treeH;`;
  const VERTEX_PROJECT = `#include <project_vertex>`;
  const FRAGMENT_PARS = `varying vec2 vTreeLod;
varying float vTreeLeaf;
float treeDither(){return fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));}
`;
  const FRAGMENT_LOD = `#include <clipping_planes_fragment>
  {float treeN=treeDither();if(vTreeLod.x<.5?treeN>vTreeLod.y:treeN<=vTreeLod.y)discard;}`;

  function patchShader(shader, uniforms, kind) {
    shader.uniforms.uTreeTime = uniforms.time;
    shader.uniforms.uTreeWind = uniforms.wind;
    shader.uniforms.uTreeWindDir = uniforms.windDirection;
    shader.uniforms.uTreeClock = uniforms.clock;
    shader.vertexShader = VERTEX_PARS + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", VERTEX_MAIN);
    shader.vertexShader = shader.vertexShader.replace("#include <project_vertex>", VERTEX_PROJECT);
    shader.fragmentShader = FRAGMENT_PARS + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace("#include <clipping_planes_fragment>", FRAGMENT_LOD);
    if (kind === "leaf") {
      shader.uniforms.uTreeCoverage = uniforms.coverage;
      shader.uniforms.uTreeAtlasSize = uniforms.atlasSize;
      shader.uniforms.uTreeSun = V32.uniforms.sunDirection;
      shader.uniforms.uTreeSunColor = V32.uniforms.sunColor;
      shader.uniforms.uTreeDaylight = V32.uniforms.daylight;
      shader.vertexShader = "varying vec3 vTreeWorld;\n" + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        "#include <color_vertex>",
        `#ifdef USE_COLOR
   vColor=color;
  #endif
  #ifdef USE_INSTANCING_COLOR
   vColor.xyz*=mix(vec3(1.),instanceColor.xyz,aWind.z);
  #endif`,
      );
      shader.vertexShader = shader.vertexShader.replace(
        "#include <project_vertex>",
        `#include <project_vertex>
  vec4 treeWorld=vec4(transformed,1.);
  #ifdef USE_INSTANCING
   treeWorld=instanceMatrix*treeWorld;
  #endif
  vTreeWorld=(modelMatrix*treeWorld).xyz;`,
      );
      // Les deux faces d'une carte reçoivent la lumière de la couronne (normale arrondie).
      shader.vertexShader = shader.vertexShader.replace(
        "#include <lights_lambert_vertex>",
        `#include <lights_lambert_vertex>
  #ifdef DOUBLE_SIDED
   vLightBack=vLightFront;vIndirectBack=vIndirectFront;
  #endif`,
      );
      shader.fragmentShader =
        `varying vec3 vTreeWorld;
uniform float uTreeCoverage,uTreeAtlasSize,uTreeDaylight;
uniform vec3 uTreeSun,uTreeSunColor;
` + shader.fragmentShader;
      // Découpe des feuilles : couverture alpha (bords lissés par l'anticrénelage) sur
      // l'écran, test alpha classique dans les rendus intermédiaires (reflets).
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <alphatest_fragment>",
        `float treeAlpha=diffuseColor.a;
  // Atlas en alpha prémultiplié (décodé sRGB) : on retrouve la couleur propre des feuilles.
  diffuseColor.rgb/=max(pow(treeAlpha,2.2),.004);
  // Une carte vue par la tranche disparaît au lieu de dessiner un trait sombre (dérivées
  // calculées hors de toute condition ; le bois des arbres lointains n'est pas concerné).
  vec3 treeFlat=normalize(cross(dFdx(vTreeWorld),dFdy(vTreeWorld)));
  treeAlpha*=mix(1.,smoothstep(.07,.32,abs(dot(treeFlat,normalize(cameraPosition-vTreeWorld)))),vTreeLeaf);
  if(uTreeCoverage>.5){
   diffuseColor.a=clamp((treeAlpha-.45)/max(fwidth(treeAlpha),.0001)+.5,0.,1.);
   if(diffuseColor.a<.02)discard;
  }else{
   vec2 treeTexel=fwidth(vUv)*uTreeAtlasSize;
   float treeMip=max(0.,log2(max(max(treeTexel.x,treeTexel.y),1.)));
   if(treeAlpha*(1.+treeMip*.22)<.5)discard;
   diffuseColor.a=1.;
  }`,
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        "reflectedLight.directDiffuse *= BRDF_Diffuse_Lambert( diffuseColor.rgb ) * getShadowMask();",
        `float treeShadow=getShadowMask();
  reflectedLight.directDiffuse *= BRDF_Diffuse_Lambert( diffuseColor.rgb ) * treeShadow;`,
      );
      // Lumière qui traverse les feuilles quand on regarde vers le soleil.
      shader.fragmentShader = shader.fragmentShader.replace(
        "gl_FragColor = vec4( outgoingLight, diffuseColor.a );",
        `vec3 treeView=normalize(cameraPosition-vTreeWorld);
  float treeBack=pow(max(dot(treeView,-normalize(uTreeSun)),0.),4.);
  outgoingLight+=diffuseColor.rgb*uTreeSunColor*vec3(1.1,1.3,.55)*treeBack*(.25+.75*treeShadow)*vTreeLeaf*1.5*uTreeDaylight;
  gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,
      );
    }
  }

  // Tout ce qui est partagé par les forêts : atlas, écorces, matériaux (une seule fois).
  let sharedKit = null;
  function treeKit(THREE, surfaces, mobile, renderer) {
    if (sharedKit) return sharedKit;
    const started = performance.now();
    // Écorces : le chêne, le plus présent, en pleine définition ; pin et bouleau à moitié.
    const barkSize = { oak: mobile ? [128, 256] : [256, 512], pine: mobile ? [64, 128] : [128, 256], birch: mobile ? [64, 128] : [128, 256] };
    const atlasSize = mobile ? 1024 : 2048;
    const atlas = buildLeafAtlas(THREE, atlasSize, surfaces && surfaces.treeBark && surfaces.treeBark.image);
    const atlasMs = performance.now() - started;
    const barks = {};
    for (const kind of ["oak", "pine", "birch"]) {
      const [w, h] = barkSize[kind];
      const { color, normal } = barkPixels(kind, w, h);
      barks[kind] = { map: dataTexture(THREE, color, w, h, true), normal: dataTexture(THREE, normal, w, h, false) };
    }
    const barkMs = performance.now() - started - atlasMs;
    const uniforms = {
      time: { value: 0 },
      wind: { value: 0 },
      windDirection: { value: new THREE.Vector2(0.96, 0.28).normalize() },
      // Horloge des fondus (secondes depuis l'ouverture de la page).
      clock: { value: performance.now() / 1000 + 10 },
      coverage: { value: 0 },
      atlasSize: { value: atlasSize },
    };
    const patched = (material, kind) => {
      material.onBeforeCompile = (shader) => patchShader(shader, uniforms, kind);
      material.customProgramCacheKey = () => "moulin-arbres32-" + kind;
      return material;
    };
    const leaf = patched(
      new THREE.MeshLambertMaterial({ color: 0xffffff, map: atlas.texture, vertexColors: true, side: THREE.DoubleSide }),
      "leaf",
    );
    leaf.name = "Feuillages_des_arbres_v32";
    leaf.extensions = { derivatives: true };
    const woodMaterial = (kind, name, normalScale) => {
      const material = patched(
        new THREE.MeshStandardMaterial({
          color: 0xffffff,
          map: barks[kind].map,
          normalMap: barks[kind].normal,
          vertexColors: true,
          roughness: 0.96,
          metalness: 0,
          envMapIntensity: 0,
        }),
        "wood",
      );
      material.normalScale.set(normalScale, normalScale);
      material.name = name;
      return material;
    };
    const oakWood = woodMaterial("oak", "Ecorce_des_chenes_v32", 1.1);
    const birchWood = woodMaterial("birch", "Ecorce_des_bouleaux_v32", 0.5);
    const pineWood = woodMaterial("pine", "Ecorce_des_pins_v32", 1);
    const leafDepth = patched(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: atlas.texture, alphaTest: 0.5, side: THREE.DoubleSide }), "leaf-depth");
    const woodDepth = patched(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), "wood-depth");
    // Couverture alpha seulement si l'écran est anticrénelé (MSAA) ; les reflets et les
    // ombres gardent le test alpha classique.
    let msaa = false;
    try {
      const host = globalThis.MoulinHost30 && globalThis.MoulinHost30.renderer;
      const gl = renderer ? renderer.getContext() : host && host.context;
      msaa = !!gl && gl.getParameter(gl.SAMPLES) > 0;
    } catch {}
    leaf.alphaToCoverage = msaa;
    const coverageHook = (r) => {
      uniforms.coverage.value = msaa && !r.getRenderTarget() ? 1 : 0;
    };
    sharedKit = {
      atlas,
      barks,
      uniforms,
      leaf,
      wood: { oak: oakWood, old: oakWood, birch: birchWood, pine: pineWood },
      leafDepth,
      woodDepth,
      coverageHook,
      msaa,
      buildMs: 0,
    };
    sharedKit.buildMs = Math.round(performance.now() - started);
    sharedKit.timings = { atlas: Math.round(atlasMs), bark: Math.round(barkMs), ...atlas.timings };
    return sharedKit;
  }

  // ---------------------------------------------------------------------------
  // La forêt
  // ---------------------------------------------------------------------------
  const HERO_IDS = ["arbre-1239", "arbre-1256", "arbre-1257", "arbre-274"];
  // Teinte de chaque arbre (multiplicateur linéaire de l'atlas), un peu plus froide que
  // l'atlas : les chênes des photos sont vert olive sombre, pas vert tendre.
  const LEAF_TINTS = {
    oak: [
      [0.96, 0.95, 0.93],
      [0.92, 0.94, 0.92],
      [0.99, 0.95, 0.88],
      [0.9, 0.93, 0.95],
    ],
    old: [
      [0.88, 0.88, 0.86],
      [0.94, 0.91, 0.84],
      [0.86, 0.88, 0.88],
      [0.91, 0.9, 0.86],
    ],
    pine: [
      [0.95, 0.97, 0.95],
      [0.9, 0.95, 0.96],
      [0.98, 0.97, 0.9],
      [0.92, 0.94, 0.93],
    ],
    birch: [
      [0.98, 0.98, 0.88],
      [1.02, 0.99, 0.84],
      [0.96, 0.98, 0.9],
      [1.02, 0.97, 0.86],
    ],
  };
  // Portée du modèle détaillé (mètres, du centre de la couronne à la caméra), selon
  // l'appareil et la qualité ; les quatre arbres remarquables vont 40 % plus loin.
  const LOD_RADIUS = {
    desktop: { fast: 46, balanced: 70, detail: 95 },
    mobile: { fast: 30, balanced: 40, detail: 52 },
  };
  const LOD_HYSTERESIS = 4;
  const LOD_FADE = 0.6;

  globalThis.MoulinForest = function (THREE, options) {
    const { root, ground, surfaces } = options;
    const mobile = !!options.mobile;
    const kit = treeKit(THREE, surfaces, mobile, options.renderer);
    const records = [];
    const derived = new Map();
    const speciesInfo = {
      oak: { label: "Feuillu \xE0 couronne naturelle" },
      pine: { label: "Sapin des sous-bois" },
      birch: { label: "Bouleau l\xE9ger" },
      old: { label: "Vieux ch\xEAne \xE9tal\xE9" },
    };
    const models = new Map();
    const groups = [];
    let serial = 0;
    let version = 0;
    let contact = null;
    const stats = { uniform: 0, near: 0, middle: 0, far: 0, triangles: 0, draws: 0, detailed: 0, lodRadius: 0, kitMs: kit.buildMs, models: 0, modelMs: 0 };
    const lod = { center: new THREE.Vector3(0, 30, 60), time: -1e9, quality: mobile ? "fast" : "balanced", version: -1, radius: 0, fadeUntil: 0 };
    const up = new THREE.Vector3(0, 1, 0);
    const tmpMatrix = new THREE.Matrix4();
    const tmpQuat = new THREE.Quaternion();
    const tmpScale = new THREE.Vector3();
    const tmpPos = new THREE.Vector3();
    const tmpColor = new THREE.Color();

    // Ombre douce au pied de chaque arbre (inchangée).
    const contactData = new Uint8Array(4096 * 4);
    for (let y = 0; y < 64; y++)
      for (let x = 0; x < 64; x++) {
        const i = (y * 64 + x) * 4;
        const d = Math.hypot((x - 31.5) / 31.5, (y - 31.5) / 31.5);
        contactData[i] = contactData[i + 1] = contactData[i + 2] = 35;
        contactData[i + 3] = Math.round(Math.pow(Math.max(0, 1 - d), 2) * 105);
      }
    const contactMaterial = new THREE.MeshBasicMaterial({
      map: surfaces.fromData(contactData, 64, true, false),
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      opacity: 0.65,
    });
    const contactPlane = new THREE.PlaneGeometry(1, 1);
    contactPlane.rotateX(-Math.PI / 2);

    // Les maillages détaillés n'existent qu'une fois un arbre proche : chaque matière des
    // arbres a donc un petit porteur invisible, pour que les parcours de la scène (météo,
    // boule à neige, nuit) la trouvent dès le départ, comme matière d'arbre.
    const holder = new THREE.Group();
    holder.name = "Matieres_des_arbres";
    holder.userData.exportSkip = true;
    const stub = new THREE.BufferGeometry();
    stub.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(9), 3));
    stub.setAttribute("normal", new THREE.Float32BufferAttribute(new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0]), 3));
    stub.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(6), 2));
    for (const material of [kit.leaf, kit.wood.oak, kit.wood.birch, kit.wood.pine]) {
      const carrier = new THREE.Mesh(stub, material);
      carrier.visible = false;
      carrier.userData.treeIds = [];
      carrier.userData.exportSkip = true;
      carrier.userData.forest32 = true;
      holder.add(carrier);
    }
    root.add(holder);

    const modelKey = (rec) => rec.species + ":" + (rec.species === "oak" ? rec.variant % 4 : rec.variant % 2) + ":" + HERO_IDS.includes(rec.id);
    function modelFor(rec) {
      const key = modelKey(rec);
      let model = models.get(key);
      if (!model) {
        const started = performance.now();
        const variant = rec.species === "oak" ? Math.abs(rec.variant) % 4 : Math.abs(rec.variant) % 2;
        model = buildModel(THREE, rec.species, variant, HERO_IDS.includes(rec.id), false);
        model.key = key;
        models.set(key, model);
        stats.models = models.size;
        stats.modelMs += Math.round(performance.now() - started);
      }
      return model;
    }
    // Modèle détaillé construit au premier arbre proche, ou en tâche de fond après le
    // chargement (un par un, entre deux images).
    function detailOf(model) {
      if (!model.wood) {
        const started = performance.now();
        buildDetail(THREE, model);
        stats.detailMs = (stats.detailMs || 0) + Math.round(performance.now() - started);
      }
      return model;
    }
    let warming = false;
    function warmDetails() {
      if (warming) return;
      warming = true;
      const next = () => {
        const model = [...models.values()].find((m) => !m.wood);
        if (!model) return void (warming = false);
        detailOf(model);
        setTimeout(next, 80);
      };
      setTimeout(next, 1500);
    }

    function add(input) {
      const species = speciesInfo[input.species] ? input.species : "oak";
      const rec = {
        id: input.id || "arbre-" + ++serial,
        species,
        x: +input.x,
        z: +input.z,
        height: input.height || 15,
        diameter: input.diameter || 0.68,
        spread: input.spread || 1,
        rotation: input.rotation ?? (serial * 2.39996) % 6.283,
        variant: input.variant ?? serial % 4,
        label: input.label || speciesInfo[species].label,
      };
      serial = Math.max(serial, Number(rec.id.split("-").pop()) || 0);
      records.push(rec);
      version++;
      return rec;
    }

    // Données dérivées d'un arbre : matrice, épaisseur du tronc, teinte, centre, et état
    // du niveau de détail (proche ou non, instant du dernier changement).
    function derive(rec) {
      let d = derived.get(rec);
      if (!d) {
        d = { matrix: new THREE.Matrix4(), centre: new THREE.Vector3(), tint: new THREE.Color(), trunk: 1, seed: 0.5, near: false, switchAt: 0.001, reach: 1 };
        derived.set(rec, d);
      }
      const y = ground(rec.x, rec.z);
      const width = rec.height * rec.spread;
      tmpPos.set(rec.x, y, rec.z);
      tmpQuat.setFromAxisAngle(up, rec.rotation);
      tmpScale.set(width, rec.height, width);
      d.matrix.compose(tmpPos, tmpQuat, tmpScale);
      d.centre.set(rec.x, y + rec.height * 0.55, rec.z);
      d.ground = y;
      const h = Math.sin(rec.x * 17.17 + rec.z * 8.13) * 43758.5453;
      d.seed = h - Math.floor(h);
      d.trunk = clamp((rec.diameter * 0.5) / (TRUNK_RADIUS * width), 0.3, 4);
      d.reach = HERO_IDS.includes(rec.id) ? 1.4 : 1;
      const palette = LEAF_TINTS[rec.species] || LEAF_TINTS.oak;
      const t = palette[Math.abs(rec.variant || 0) % 4];
      d.tint.setRGB(t[0], t[1], t[2]).multiplyScalar(0.92 + d.seed * 0.14);
      return d;
    }

    function instanced(geometry, material, capacity, depthMaterial, name, leafy) {
      const g = new THREE.BufferGeometry();
      g.index = geometry.index;
      for (const key of Object.keys(geometry.attributes)) g.setAttribute(key, geometry.attributes[key]);
      // Normales de couronne déjà arrondies : les retouches génériques des feuillages
      // (lissage des massifs) ne doivent pas y toucher.
      g.userData.v32Smooth = true;
      g.userData.v32Rounded = true;
      const inst = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
      inst.setUsage(THREE.DynamicDrawUsage);
      g.setAttribute("aTreeInst", inst);
      const mesh = new THREE.InstancedMesh(g, material, capacity);
      mesh.name = name;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      if (leafy) {
        mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
        mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
        mesh.onBeforeRender = kit.coverageHook;
      }
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.customDepthMaterial = depthMaterial;
      mesh.frustumCulled = true;
      mesh.userData.forest32 = true;
      root.add(mesh);
      return mesh;
    }
    // Instant (signé) du fondu d'un modèle : positif, il apparaît ; négatif, il disparaît.
    function fadeStamp(d, role) {
      const t = Math.max(0.001, d.switchAt);
      return (role === 0) === d.near ? t : -t;
    }
    function writeSlot(mesh, slot, rec, role) {
      const d = derived.get(rec) || derive(rec);
      mesh.setMatrixAt(slot, d.matrix);
      const a = mesh.geometry.attributes.aTreeInst.array;
      a[slot * 4] = d.trunk;
      a[slot * 4 + 1] = role;
      a[slot * 4 + 2] = d.seed;
      a[slot * 4 + 3] = fadeStamp(d, role);
      if (mesh.instanceColor) mesh.setColorAt(slot, d.tint);
    }
    function flush(mesh) {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.geometry.attributes.aTreeInst.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    function groupBounds(group) {
      const box = new THREE.Box3();
      for (const rec of group.list) {
        const d = derived.get(rec) || derive(rec);
        const r = Math.max(rec.height * rec.spread * 0.72, rec.diameter * 4);
        box.expandByPoint(tmpPos.set(rec.x - r, d.ground - 0.4, rec.z - r));
        box.expandByPoint(tmpPos.set(rec.x + r, d.ground + rec.height * 1.1, rec.z + r));
      }
      const sphere = box.getBoundingSphere(new THREE.Sphere());
      for (const mesh of group.meshes) {
        mesh.geometry.boundingBox = box.clone();
        mesh.geometry.boundingSphere = sphere.clone();
      }
    }
    function writeFar(group) {
      group.list.forEach((rec, i) => writeSlot(group.far, i, rec, 1));
      group.far.count = group.list.length;
      flush(group.far);
    }
    function writeNear(group) {
      let wanted = 0;
      for (let i = 0; i < group.list.length; i++) wanted += group.near[i];
      if (!group.wood) {
        if (!wanted) return;
        // Premiers arbres proches de ce groupe : maillages détaillés créés maintenant.
        const model = detailOf(group.model);
        const n = group.list.length;
        const wood = kit.wood[model.species] || kit.wood.oak;
        group.wood = instanced(model.wood, wood, n, kit.woodDepth, "Arbres_" + group.key + "_bois", false);
        group.leaves = instanced(model.leaves, kit.leaf, n, kit.leafDepth, "Arbres_" + group.key + "_frondaison", true);
        group.meshes.push(group.wood, group.leaves);
        for (const mesh of [group.wood, group.leaves]) {
          mesh.userData.treeIds = group.far.userData.treeIds;
          mesh.geometry.boundingBox = group.far.geometry.boundingBox.clone();
          mesh.geometry.boundingSphere = group.far.geometry.boundingSphere.clone();
          mesh.updateMatrixWorld(true);
        }
      }
      let slot = 0;
      for (let i = 0; i < group.list.length; i++)
        if (group.near[i]) {
          writeSlot(group.wood, slot, group.list[i], 0);
          writeSlot(group.leaves, slot, group.list[i], 0);
          slot++;
        }
      group.wood.count = group.leaves.count = slot;
      group.wood.visible = group.leaves.visible = slot > 0;
      if (slot) {
        flush(group.wood);
        flush(group.leaves);
      }
    }

    function rebuild() {
      // Reconstruction complète : les données dérivées sont recalculées (l'éditeur peut
      // avoir modifié les fiches directement).
      derived.clear();
      for (const group of groups)
        for (const mesh of group.meshes) {
          root.remove(mesh);
          mesh.geometry.dispose();
        }
      groups.length = 0;
      if (contact) root.remove(contact);
      contact = new THREE.InstancedMesh(contactPlane, contactMaterial, Math.max(1, records.length));
      contact.name = "Ombres_de_contact_des_arbres";
      contact.count = records.length;
      contact.frustumCulled = false;
      contact.renderOrder = 1;
      root.add(contact);
      const byKey = new Map();
      for (const rec of records) {
        const key = modelKey(rec) + ":" + Math.floor(rec.x / 96) + ":" + Math.floor(rec.z / 96);
        if (!byKey.has(key)) byKey.set(key, []);
        byKey.get(key).push(rec);
      }
      for (const [key, list] of byKey) {
        const model = modelFor(list[0]);
        const n = list.length;
        const group = {
          key,
          list,
          model,
          far: instanced(model.far, kit.leaf, n, kit.leafDepth, "Arbres_" + key + "_loin", true),
          // Bois et feuillage détaillés : créés au premier arbre proche (writeNear).
          wood: null,
          leaves: null,
          near: new Uint8Array(n),
        };
        group.meshes = [group.far];
        group.far.userData.treeIds = list.map((r) => r.id);
        writeFar(group);
        groupBounds(group);
        groups.push(group);
      }
      version++;
      placeContacts();
      updateLOD(null, null, true);
      root.updateMatrixWorld(true);
      warmDetails();
    }

    function placeContacts() {
      if (!contact) return;
      const normal = new THREE.Vector3();
      records.forEach((rec, i) => {
        const y = ground(rec.x, rec.z);
        const sx = (ground(rec.x + 0.2, rec.z) - ground(rec.x - 0.2, rec.z)) / 0.4;
        const sz = (ground(rec.x, rec.z + 0.2) - ground(rec.x, rec.z - 0.2)) / 0.4;
        normal.set(-sx, 1, -sz).normalize();
        const size = Math.max(1.4, Math.min(4, rec.diameter * 3.5));
        tmpPos.set(rec.x, y + 0.025, rec.z);
        tmpQuat.setFromUnitVectors(up, normal);
        tmpScale.set(size, 1, size);
        contact.setMatrixAt(i, tmpMatrix.compose(tmpPos, tmpQuat, tmpScale));
      });
      contact.instanceMatrix.needsUpdate = true;
    }

    // Niveau de détail. Chaque arbre est « proche » (modèle détaillé) ou « lointain »
    // (grandes cartes), avec une petite marge pour ne pas hésiter à la limite. Quand il
    // change, les deux modèles se relaient en 0,6 s (fondu tramé calculé par le shader) ;
    // hors de ces instants, aucun arbre n'est tramé. Les arbres lointains sont tous dans
    // leur maillage (le shader écarte ceux qui sont proches) ; seuls les maillages
    // détaillés des groupes concernés sont réécrits.
    function bucket(centre, radius, now, settle) {
      let detailed = 0;
      let triangles = 0;
      let draws = 0;
      for (const group of groups) {
        let nearDirty = settle;
        let farDirty = false;
        const list = group.list;
        for (let i = 0; i < list.length; i++) {
          const d = derived.get(list[i]) || derive(list[i]);
          const limit = radius * d.reach + (d.near ? LOD_HYSTERESIS : -LOD_HYSTERESIS);
          const near = d.centre.distanceTo(centre) < limit;
          if (near !== d.near) {
            d.near = near;
            d.switchAt = settle ? 0.001 : now;
            if (!settle) lod.fadeUntil = Math.max(lod.fadeUntil, now + LOD_FADE);
            group.far.geometry.attributes.aTreeInst.array[i * 4 + 3] = fadeStamp(d, 1);
            farDirty = true;
            nearDirty = true;
          }
          // Le modèle détaillé reste le temps de s'effacer.
          const keep = d.near || now - d.switchAt < LOD_FADE + 0.05 ? 1 : 0;
          if (keep !== group.near[i]) {
            group.near[i] = keep;
            nearDirty = true;
          }
        }
        if (farDirty) group.far.geometry.attributes.aTreeInst.needsUpdate = true;
        if (nearDirty) writeNear(group);
        const nearCount = group.wood ? group.wood.count : 0;
        detailed += nearCount;
        draws += 1 + (nearCount ? 2 : 0);
        triangles += (group.model.far.index.count / 3) * list.length;
        if (nearCount) triangles += ((group.model.wood.index.count + group.model.leaves.index.count) / 3) * nearCount;
      }
      stats.detailed = stats.near = detailed;
      stats.far = records.length - detailed;
      stats.uniform = records.length;
      stats.draws = draws;
      stats.triangles = Math.round(triangles);
    }

    function updateLOD(position, quality, force = false) {
      const now = performance.now() / 1000 + 10;
      kit.uniforms.clock.value = now;
      if (quality && quality !== lod.quality) {
        lod.quality = quality;
        force = true;
      }
      const table = LOD_RADIUS[mobile ? "mobile" : "desktop"];
      const radius = table[lod.quality] || table.balanced;
      if (radius !== lod.radius) {
        lod.radius = radius;
        stats.lodRadius = radius;
        force = true;
      }
      if (position) lod.center.copy(position);
      const rebuilt = lod.version !== version;
      // Tri des arbres au plus quatre fois par seconde (1 222 distances : quelques
      // centièmes de milliseconde), et à chaque reconstruction.
      if (!force && !rebuilt && now - lod.time < 0.25) return false;
      lod.time = now;
      lod.version = version;
      bucket(lod.center, radius, now, force || rebuilt);
      // Les ombres ne sont recalculées qu'après une modification des arbres.
      return force || rebuilt;
    }

    function refresh(rec) {
      derive(rec);
      for (const group of groups) {
        const i = group.list.indexOf(rec);
        if (i < 0) continue;
        writeSlot(group.far, i, rec, 1);
        flush(group.far);
        groupBounds(group);
        if (group.near[i]) writeNear(group);
      }
    }

    function update(id, patch) {
      const rec = records.find((r) => r.id === id);
      if (!rec) return;
      const before = modelKey(rec) + ":" + Math.floor(rec.x / 96) + ":" + Math.floor(rec.z / 96);
      Object.assign(rec, patch);
      if (!speciesInfo[rec.species]) rec.species = "oak";
      version++;
      const after = modelKey(rec) + ":" + Math.floor(rec.x / 96) + ":" + Math.floor(rec.z / 96);
      if (before !== after) rebuild();
      else {
        refresh(rec);
        placeContacts();
        lod.version = version;
      }
    }
    function remove(id) {
      const i = records.findIndex((r) => r.id === id);
      if (i >= 0) {
        derived.delete(records[i]);
        records.splice(i, 1);
        rebuild();
      }
    }
    function resettle() {
      version++;
      for (const rec of records) derive(rec);
      for (const group of groups) {
        writeFar(group);
        writeNear(group);
        groupBounds(group);
      }
      placeContacts();
      updateLOD(null, null, true);
    }
    function replace(list) {
      records.length = 0;
      derived.clear();
      serial = 0;
      list.forEach(add);
      rebuild();
    }

    // Sélection dans l'éditeur : on teste la couronne simplifiée et le bois de chaque arbre.
    const pickMesh = new THREE.Mesh();
    function pick(raycaster) {
      let best = null;
      const sphere = new THREE.Sphere();
      for (const rec of records) {
        const d = derived.get(rec) || derive(rec);
        sphere.center.set(rec.x, d.ground + rec.height * 0.6, rec.z);
        sphere.radius = rec.height * Math.max(0.62, rec.spread * 0.66);
        if (!raycaster.ray.intersectsSphere(sphere)) continue;
        const model = modelFor(rec);
        // Le modèle lointain contient le tronc, les charpentières et la couronne.
        for (const [geometry, material] of [[model.far, kit.leaf]]) {
          pickMesh.geometry = geometry;
          pickMesh.material = material;
          pickMesh.matrixWorld.copy(d.matrix);
          const hits = [];
          pickMesh.raycast(raycaster, hits);
          for (const hit of hits)
            if (!best || hit.distance < best.distance) best = { id: rec.id, point: hit.point, distance: hit.distance };
        }
      }
      return best;
    }

    // Export GLB : un groupe par arbre, avec le modèle détaillé et des matières simples.
    const exportCache = new Map();
    function exportGeometry(source) {
      let g = exportCache.get(source);
      if (!g) {
        g = new THREE.BufferGeometry();
        for (const key of ["position", "normal", "uv", "color"]) g.setAttribute(key, source.attributes[key]);
        g.setIndex(source.index);
        exportCache.set(source, g);
      }
      return g;
    }
    function exportGroup() {
      const group = new THREE.Group();
      group.name = "Boisements";
      const barkMaterials = new Map();
      for (const rec of records) {
        const d = derived.get(rec) || derive(rec);
        const model = detailOf(modelFor(rec));
        const tree = new THREE.Group();
        tree.name = rec.id;
        d.matrix.decompose(tree.position, tree.quaternion, tree.scale);
        const source = kit.wood[rec.species] || kit.wood.oak;
        if (!barkMaterials.has(source))
          barkMaterials.set(source, new THREE.MeshStandardMaterial({ map: source.map, vertexColors: true, roughness: 1, metalness: 0, name: source.name }));
        tree.add(new THREE.Mesh(exportGeometry(model.wood), barkMaterials.get(source)));
        const leafMaterial = new THREE.MeshStandardMaterial({
          map: kit.atlas.texture,
          color: tmpColor.copy(d.tint),
          vertexColors: true,
          alphaTest: 0.5,
          side: THREE.DoubleSide,
          roughness: 1,
          metalness: 0,
          name: "Feuillage_" + rec.id,
        });
        tree.add(new THREE.Mesh(exportGeometry(model.leaves), leafMaterial));
        group.add(tree);
      }
      return group;
    }

    root.userData.forestRender = true;
    const api = {
      setDaylight: () => {},
      records,
      species: speciesInfo,
      stats,
      // Index 2 : le feuillage (même rôle que l'ancienne matière des couronnes).
      materials: [kit.wood.oak, kit.wood.birch, kit.leaf, kit.wood.pine, kit.leafDepth, kit.woodDepth],
      windUniforms: { time: kit.uniforms.time, wind: kit.uniforms.wind, windDirection: kit.uniforms.windDirection },
      uniforms: kit.uniforms,
      kit,
      add,
      rebuild,
      update,
      remove,
      resettle,
      pick,
      replace,
      updateLOD,
      exportGroup,
      // Vrai tant qu'un fondu entre modèles est en cours (il faut alors redessiner).
      fading: () => performance.now() / 1000 + 10 < lod.fadeUntil,
      get: (id) => records.find((r) => r.id === id),
      get count() {
        return records.length;
      },
    };
    root.moulinForest = api;
    return api;
  };

  // Accès pour les essais (laboratoire, console).
  V32.trees = { buildModel, buildLeafAtlas, barkPixels, profile, skeleton, CELL };

  // Un fondu entre modèle détaillé et modèle lointain dure 0,6 s : on demande des images
  // jusqu'à sa fin, même quand rien d'autre ne bouge (sinon l'arbre resterait tramé).
  if (V32.register)
    V32.register(
      "arbres",
      function (context) {
        const forest = context.game && context.game.forest;
        if (!forest || typeof forest.fading !== "function") return null;
        return {
          update() {
            return forest.fading();
          },
        };
      },
      16,
    );
})();
