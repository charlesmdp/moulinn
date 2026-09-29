// Moulin V32 — matières de jeu : moellons, ardoises, arbustes et massifs lissés.
//
// Les textures de la V27 étaient très stylisées (pierres presque lisses, ardoises bleu
// vif) et les massifs montraient leurs facettes : un rendu de logiciel de modélisation
// plus que de jeu. On régénère ici, au chargement et sans fichier en plus :
//  - les moellons : pierre bombée, joints de mortier sombres, piqûres, veines et lichens ;
//  - les ardoises : gris-bleu nuancé, chaque rang ombrant celui du dessous, épaufrures ;
// et l'on lisse l'éclairage des arbustes et des massifs. Les arbres ont désormais leurs
// propres feuillages détaillés (src/app/v32/15-arbres.js).
(function () {
  "use strict";
  const V32 = globalThis.MoulinV32;

  let SIZE = 512;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const smooth = (a, b, x) => {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  function hash(x, y, seed = 0) {
    let h = Math.imul(x + 374761 * seed, 374761393) ^ Math.imul(y + 668265 + seed, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }
  /** Bruit de valeur périodique (période en cellules), pour des textures sans raccord. */
  function noise(u, v, cells, seed) {
    const x = u * cells;
    const y = v * cells;
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const w = (i) => ((i % cells) + cells) % cells;
    const a = hash(w(ix), w(iy), seed);
    const b = hash(w(ix + 1), w(iy), seed);
    const c = hash(w(ix), w(iy + 1), seed);
    const d = hash(w(ix + 1), w(iy + 1), seed);
    return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
  }
  function fbm(u, v, cells, seed, octaves = 4) {
    let sum = 0;
    let amp = 0.5;
    let total = 0;
    for (let o = 0; o < octaves; o++) {
      sum += noise(u, v, cells << o, seed + o * 17) * amp;
      total += amp;
      amp *= 0.5;
    }
    return sum / total;
  }

  /** Remplit une texture couleur (sRGB) et sa carte de relief à partir d'une fonction. */
  function paint(THREE, colorTexture, normalTexture, shader, strength) {
    const color = new Uint8Array(SIZE * SIZE * 4);
    const height = new Float32Array(SIZE * SIZE);
    for (let y = 0; y < SIZE; y++)
      for (let x = 0; x < SIZE; x++) {
        const [r, g, b, h] = shader((x + 0.5) / SIZE, (y + 0.5) / SIZE, x, y);
        const i = (y * SIZE + x) * 4;
        color[i] = clamp(Math.round(r), 0, 255);
        color[i + 1] = clamp(Math.round(g), 0, 255);
        color[i + 2] = clamp(Math.round(b), 0, 255);
        color[i + 3] = 255;
        height[y * SIZE + x] = h;
      }
    const normal = new Uint8Array(SIZE * SIZE * 4);
    for (let y = 0; y < SIZE; y++)
      for (let x = 0; x < SIZE; x++) {
        const dx = (height[y * SIZE + ((x + SIZE - 1) % SIZE)] - height[y * SIZE + ((x + 1) % SIZE)]) * strength;
        const dy = (height[((y + SIZE - 1) % SIZE) * SIZE + x] - height[((y + 1) % SIZE) * SIZE + x]) * strength;
        const len = Math.hypot(dx, dy, 1);
        const i = (y * SIZE + x) * 4;
        normal[i] = ((dx / len) * 0.5 + 0.5) * 255;
        normal[i + 1] = ((dy / len) * 0.5 + 0.5) * 255;
        normal[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
        normal[i + 3] = 255;
      }
    for (const [texture, data] of [
      [colorTexture, color],
      [normalTexture, normal],
    ]) {
      if (!texture) continue;
      texture.image = { data, width: SIZE, height: SIZE };
      texture.needsUpdate = true;
    }
  }

  // Face d'un moellon (u, v de 0 à 1 sur la face) : joint, arête arrondie, pierre piquée.
  function stoneFace(u, v) {
    const edge = Math.min(u, 1 - u, v, 1 - v);
    const wobble = (noise(u, v, 6, 3) - 0.5) * 0.02;
    const e = edge + wobble;
    const mortar = 1 - smooth(0.018, 0.034, e);
    const bevel = smooth(0.03, 0.13, e);
    const grain = fbm(u, v, 8, 11, 5);
    const pits = Math.pow(noise(u, v, 48, 5), 6) * 0.9;
    const veins = Math.max(0, 1 - Math.abs(noise(u * 1.3, v * 0.7, 5, 21) - 0.5) * 22) * 0.35;
    const lichen = smooth(0.72, 0.86, fbm(u, v, 4, 31, 3)) * (0.4 + 0.6 * noise(u, v, 32, 7));
    let tone = 206 + (grain - 0.5) * 44 - pits * 36 - veins * 18;
    tone *= 0.72 + 0.28 * bevel;
    let r = tone * 1.02;
    let g = tone * 0.985;
    let b = tone * 0.92;
    // Lichens jaune-vert et gris clair par plaques.
    r += lichen * 18;
    g += lichen * 26;
    b -= lichen * 12;
    // Joint de mortier : gris brun, en retrait.
    r = r + (104 - r) * mortar;
    g = g + (98 - g) * mortar;
    b = b + (88 - b) * mortar;
    const heightValue = bevel * 0.85 + (grain - 0.5) * 0.18 - pits * 0.12 - mortar * 0.25;
    return [r, g, b, heightValue];
  }

  // Ardoises à pureau : 8 rangs, 4 ardoises décalées par rang.
  function slate(u, v) {
    const rows = 8;
    const row = Math.floor(v * rows);
    const rowV = v * rows - row;
    const shift = (row % 2) * 0.5 + (hash(row, 7, 3) - 0.5) * 0.12;
    const cols = 4;
    const col = Math.floor(u * cols + shift);
    const colU = u * cols + shift - col;
    const id = hash(((col % cols) + cols) % cols, row, 13);
    const gap = 1 - smooth(0.006, 0.02, Math.min(colU, 1 - colU));
    // Le bas de chaque ardoise (rowV proche de 1) recouvre le rang suivant : ombre dessous.
    const lap = smooth(0.0, 0.16, rowV);
    const lip = smooth(0.9, 0.99, rowV) * (1 - smooth(0.992, 1, rowV));
    const grain = fbm(u, v, 16, 41, 4);
    const chip = Math.pow(noise(u, v, 40, 9), 9) * 1.2;
    const hueShift = (hash(col, row, 5) - 0.5) * 12;
    let base = 74 + (id - 0.5) * 26 + (grain - 0.5) * 16;
    base *= 0.62 + 0.38 * lap;
    base += lip * 20 - chip * 18;
    const shade = 1 - gap * 0.55;
    const r = (base * 0.95 + hueShift * 0.4) * shade;
    const g = (base * 1.02) * shade;
    const b = (base * 1.14 - hueShift * 0.3) * shade;
    const heightValue = rowV * 0.55 + (grain - 0.5) * 0.1 - gap * 0.3 - chip * 0.15;
    return [r, g, b, heightValue];
  }

  /**
   * Normales lissées par touffe : on moyenne les normales des faces qui partagent un même
   * point, en gardant une pointe de la facette d'origine pour le relief.
   */
  function smoothNormals(THREE, geometry, keepFlat = 0.12) {
    if (!geometry || geometry.userData.v32Smooth) return false;
    const position = geometry.attributes.position;
    if (!position) return false;
    if (!geometry.attributes.normal) geometry.computeVertexNormals();
    const normal = geometry.attributes.normal;
    const index = geometry.index;
    const count = index ? index.count : position.count;
    const vertex = (i) => (index ? index.getX(i) : i);
    const keyOf = (i) =>
      Math.round(position.getX(i) * 1000) + "," + Math.round(position.getY(i) * 1000) + "," + Math.round(position.getZ(i) * 1000);
    const keys = new Array(position.count);
    for (let i = 0; i < position.count; i++) keys[i] = keyOf(i);
    const sums = new Map();
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    for (let t = 0; t + 2 < count; t += 3) {
      const ia = vertex(t);
      const ib = vertex(t + 1);
      const ic = vertex(t + 2);
      a.fromBufferAttribute(position, ia);
      b.fromBufferAttribute(position, ib).sub(a);
      c.fromBufferAttribute(position, ic).sub(a);
      b.cross(c);
      for (const i of [ia, ib, ic]) {
        const k = keys[i];
        const sum = sums.get(k);
        if (sum) {
          sum[0] += b.x;
          sum[1] += b.y;
          sum[2] += b.z;
        } else sums.set(k, [b.x, b.y, b.z]);
      }
    }
    const n = new THREE.Vector3();
    const f = new THREE.Vector3();
    for (let i = 0; i < position.count; i++) {
      const sum = sums.get(keys[i]);
      if (!sum) continue;
      n.set(sum[0], sum[1], sum[2]).normalize();
      f.fromBufferAttribute(normal, i);
      n.lerp(f, keepFlat).normalize();
      normal.setXYZ(i, n.x, n.y, n.z);
    }
    normal.needsUpdate = true;
    geometry.userData.v32Smooth = true;
    return true;
  }

  const FOLIAGE = /Feuill|Couronne|Massif|Arbuste|Camelia|rhododendron|hortensia|Buisson|Volume_du|bruyere|Charmille|Haie|Bush|_leaf|_green|_rose|_cream|couvre_sol/i;

  V32.register(
    "materials",
    function (context) {
      const { THREE, game, hooks } = context;
      const surfaces = hooks.surfaces || {};
      const stats = { textures: 0 };
      // Téléphone : textures en 256 px (quatre fois moins de calcul au démarrage).
      SIZE = hooks.mobile ? 256 : 512;
      const started = performance.now();
      if (surfaces.masonry27 && surfaces.masonryNormal27) {
        paint(THREE, surfaces.masonry27, surfaces.masonryNormal27, stoneFace, 5.5);
        stats.textures += 2;
      }
      if (surfaces.slate20 && surfaces.slateNormal20) {
        paint(THREE, surfaces.slate20, surfaces.slateNormal20, slate, 4.2);
        stats.textures += 2;
      }
      // Couleurs et relief des matériaux qui utilisent ces textures.
      game.scene.traverse((object) => {
        const list = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of list) {
          if (!material || material.userData.v32Tuned) continue;
          if (material.map === surfaces.slate20) {
            material.color.set(0xffffff);
            if (material.normalScale) material.normalScale.set(0.75, 0.75);
            material.roughness = 0.82;
            material.userData.v32Tuned = true;
          } else if (material.map === surfaces.masonry27) {
            if (material.normalScale) material.normalScale.set(1.05, 1.05);
            material.userData.v32Tuned = true;
          }
        }
        // Arbustes, massifs et haies : plus de facettes calculées au pixel. Les arbres
        // détaillés (userData.forest32) ont déjà des normales de couronne arrondies.
        if (object.isMesh && !object.userData.forest32 && FOLIAGE.test(object.name)) {
          for (const material of list)
            if (material && material.flatShading) {
              material.flatShading = false;
              material.needsUpdate = true;
              stats.smoothMaterials = (stats.smoothMaterials || 0) + 1;
            }
          if (smoothNormals(THREE, object.geometry)) stats.smoothGeometries = (stats.smoothGeometries || 0) + 1;
        }
      });
      stats.ms = Math.round(performance.now() - started);
      V32.materialsStats = stats;
      hooks.invalidate();
      return null;
    },
    72,
  );
})();
