// Moulin V32 — rivières au naturel.
//
// Le bief n'est maçonné que devant le moulin et sur une trentaine de mètres au-delà de
// la véranda. Ailleurs, le bief et les rivières entre les étangs coulent dans un lit
// naturel : l'eau est plus basse que la prairie, le lit plus profond, les berges en
// pente forment de légers fossés de part et d'autre, et des plantes de berge (roseaux,
// carex, iris jaunes, reine-des-prés, salicaires, fougères, pierres) les accompagnent.
//
// Deux temps :
//  1. pendant la construction du terrain (appelé par le jeu) : niveau d'eau abaissé
//     dans les tronçons naturels (sink) et berges creusées dans le relief (carve) ;
//  2. au démarrage de la V32 : plantes des berges.
(function () {
  "use strict";
  const V32 = globalThis.MoulinV32;

  const SINK = 0.3; // abaissement de l'eau dans les tronçons naturels (m)
  const TAPER = 9; // longueur des raccords avec les étangs, vannes et parties maçonnées (m)
  const STEP = 0.5; // pas du profil le long des cours d'eau (m)
  const BANK = 0.75; // largeur de la berge raide (m)
  const DITCH = 3.4; // largeur du fossé en pente douce au-delà (m)
  // Tronçons maçonnés [début, fin] le long du cours d'eau : le bief à partir de 30 m en
  // amont de la véranda (qui est à ~230 m de la source), et sa sortie vers le grand étang.
  const WALLED = {
    Bief_du_moulin: [200, Infinity],
    Sortie_bief_vers_grand_etang: [-Infinity, Infinity],
  };
  // Ouvrages à ne pas déchausser : passerelles (au-dessus de l'eau), vannes et chutes
  // (dans l'eau : le niveau y reste celui d'origine).
  const KEEP = [
    { x: 17.55, z: 14, r: 3.4 }, // petit pont de la vanne naturelle
    { x: 18, z: 12.3, r: 3, water: true }, // vanne du passage naturel
    { x: 34, z: -25.5, r: 3.2 }, // passerelle en amont du petit bassin
    { x: -102.85, z: 105.37, r: 4.2 }, // passerelle au bout du grand étang
  ];

  const state = {
    ready: false,
    profiles: new Map(),
    ponds: [],
    keep: KEEP.slice(),
    inside: null,
    polyDistance: null,
    pondCache: new Map(),
    carved: 0,
  };

  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const smooth = (a, b, x) => {
    const t = clamp01((x - a) / (b - a));
    return t * t * (3 - 2 * t);
  };
  function hash(ix, iz) {
    let h = Math.imul(ix, 374761393) + Math.imul(iz, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }
  /** Bruit doux entre -1 et 1. */
  function noise(x, z) {
    const ix = Math.floor(x);
    const iz = Math.floor(z);
    const fx = x - ix;
    const fz = z - iz;
    const sx = fx * fx * (3 - 2 * fx);
    const sz = fz * fz * (3 - 2 * fz);
    const a = hash(ix, iz) + (hash(ix + 1, iz) - hash(ix, iz)) * sx;
    const b = hash(ix, iz + 1) + (hash(ix + 1, iz + 1) - hash(ix, iz + 1)) * sx;
    return (a + (b - a) * sz) * 2 - 1;
  }

  function pointAt(channel, along) {
    const lengths = channel.lengths;
    const line = channel.line;
    let i = 0;
    while (i < lengths.length - 2 && lengths[i + 1] < along) i++;
    const span = lengths[i + 1] - lengths[i] || 1;
    const t = clamp01((along - lengths[i]) / span);
    return [line[i][0] + (line[i + 1][0] - line[i][0]) * t, line[i][1] + (line[i + 1][1] - line[i][1]) * t];
  }

  function pondFactor(x, z) {
    const key = Math.round(x * 2) + ":" + Math.round(z * 2);
    const cached = state.pondCache.get(key);
    if (cached !== undefined) return cached;
    let f = 1;
    for (const pond of state.ponds) {
      if (state.inside([x, z], pond.poly)) {
        f = 0;
        break;
      }
      const d = state.polyDistance([x, z], pond.poly, true, 1.5 + TAPER);
      if (d < 1.5 + TAPER) f = Math.min(f, smooth(1.5, 1.5 + TAPER, d));
    }
    state.pondCache.set(key, f);
    return f;
  }

  function keepFactor(x, z, waterOnly) {
    let f = 1;
    for (const k of state.keep) {
      if (waterOnly && !k.water) continue;
      const d = Math.hypot(x - k.x, z - k.z);
      f = Math.min(f, smooth(k.r, k.r + (waterOnly ? TAPER : 3), d));
    }
    return f;
  }

  function buildProfile(channel) {
    const count = Math.max(2, Math.ceil(channel.length / STEP) + 1);
    const values = new Float32Array(count);
    const walled = WALLED[channel.name];
    let max = 0;
    for (let i = 0; i < count; i++) {
      const along = Math.min(channel.length, i * STEP);
      let f = smooth(0, TAPER, along) * smooth(0, TAPER, channel.length - along);
      if (walled) {
        const fromStart = walled[0] === -Infinity ? 1 : smooth(walled[0] - TAPER, walled[0], along);
        const untilEnd = walled[1] === Infinity ? 1 : 1 - smooth(walled[1], walled[1] + TAPER, along);
        f *= 1 - fromStart * untilEnd;
      }
      if (f > 0) {
        const [x, z] = pointAt(channel, along);
        f *= pondFactor(x, z) * keepFactor(x, z, true);
      }
      values[i] = f;
      max = Math.max(max, f);
    }
    return { values, max };
  }

  /** Part « naturelle » d'un cours d'eau à cette distance de sa source (0 : maçonné). */
  function factorAt(channel, along) {
    const profile = state.profiles.get(channel);
    if (!profile) return 0;
    const u = Math.max(0, along) / STEP;
    const i = Math.min(profile.values.length - 2, Math.floor(u));
    const t = clamp01(u - i);
    return profile.values[i] + (profile.values[i + 1] - profile.values[i]) * t;
  }

  V32.riverbeds = {
    SINK,
    /** Appelé par le jeu dès que les étangs et les cours d'eau sont connus. */
    setup({ channels, ponds, inside, polyDistance, cascades }) {
      state.ponds = ponds || [];
      state.inside = inside;
      state.polyDistance = polyDistance;
      for (const cascade of cascades || []) {
        if (cascade && cascade.centre) state.keep.push({ x: cascade.centre[0], z: cascade.centre[1], r: (cascade.width || 2) / 2 + 2.5, water: true });
      }
      for (const channel of channels) state.profiles.set(channel, buildProfile(channel));
      state.ready = true;
    },
    natural(channel, along) {
      return state.ready ? factorAt(channel, along) : 0;
    },
    /** Abaissement de l'eau (m) dans les tronçons naturels. */
    sink(channel, along) {
      return state.ready ? SINK * factorAt(channel, along) : 0;
    },

    /**
     * Creuse les berges naturelles dans le relief (tableaux de sommets du terrain).
     * La rive coupe l'eau un peu avant le bord du ruban d'eau, en suivant un tracé
     * irrégulier : c'est elle qui dessine la ligne d'eau, plus le bord droit du ruban.
     */
    carve({ positions, colors, sample, channels }) {
      if (!state.ready) return 0;
      const CELL = 4;
      const grid = new Map();
      for (const channel of channels) {
        const profile = state.profiles.get(channel);
        if (!profile || profile.max <= 0) continue;
        const reach = channel.maxWidth / 2 + BANK + DITCH + 0.6;
        for (let i = 0; i < channel.line.length - 1; i++) {
          const i0 = Math.floor(channel.lengths[i] / STEP);
          const i1 = Math.min(profile.values.length - 1, Math.ceil(channel.lengths[i + 1] / STEP));
          let useful = false;
          for (let k = i0; k <= i1 && !useful; k++) useful = profile.values[k] > 0;
          if (!useful) continue;
          const a = channel.line[i];
          const b = channel.line[i + 1];
          const gx0 = Math.floor((Math.min(a[0], b[0]) - reach) / CELL);
          const gx1 = Math.floor((Math.max(a[0], b[0]) + reach) / CELL);
          const gz0 = Math.floor((Math.min(a[1], b[1]) - reach) / CELL);
          const gz1 = Math.floor((Math.max(a[1], b[1]) + reach) / CELL);
          for (let gx = gx0; gx <= gx1; gx++)
            for (let gz = gz0; gz <= gz1; gz++) {
              const key = gx + ":" + gz;
              let list = grid.get(key);
              if (!list) grid.set(key, (list = []));
              if (!list.includes(channel)) list.push(channel);
            }
        }
      }
      // Couleurs (linéaires) : terre humide au bord de l'eau, herbe plus drue dans le fossé.
      const mud = [0.085, 0.072, 0.046];
      const lush = [0.06, 0.13, 0.035];
      let changed = 0;
      for (let i = 0; i < positions.length; i += 3) {
        const x = positions[i];
        const z = positions[i + 2];
        const list = grid.get(Math.floor(x / CELL) + ":" + Math.floor(z / CELL));
        if (!list) continue;
        const y0 = positions[i + 1];
        let y = Infinity;
        let mudMix = 0;
        let lushMix = 0;
        for (const channel of list) {
          const reach = channel.maxWidth / 2 + BANK + DITCH + 0.6;
          const s = sample([x, z], channel, reach);
          const half = s.width / 2;
          const d = s.distance;
          if (!(d < half + BANK + DITCH + 0.3)) continue;
          let f = factorAt(channel, s.along);
          if (f <= 0) continue;
          f *= keepFactor(x, z, false) * pondFactor(x, z);
          if (f <= 0.002) continue;
          const h = s.height;
          const edge = half - 0.16 + 0.11 * noise(x * 0.42 + 13.1, z * 0.42 - 7.7);
          let target;
          if (d <= edge) {
            const t = d / Math.max(0.1, edge);
            target = Math.min(y0, h - (0.3 + 0.2 * s.width) * (1 - t * t));
          } else if (d <= edge + BANK) {
            // La berge est reconstruite entièrement (remblai compris) : l'ancien relief
            // descendait parfois sous l'eau au-delà du bord du canal.
            const t = (d - edge) / BANK;
            target = h + 0.3 * Math.sin((t * Math.PI) / 2);
            mudMix = Math.max(mudMix, f * 0.62 * (1 - t) * (1 - t));
          } else {
            const t = (d - edge - BANK) / DITCH;
            if (t >= 1) continue;
            const e = t * t * (3 - 2 * t);
            target = Math.min(y0, h + 0.3 + (y0 - h - 0.3) * e - 0.1 * Math.sin(Math.PI * t));
            // Jamais de flaque sous le niveau de l'eau hors du lit.
            target = Math.max(target, h + 0.22 * (1 - t));
            lushMix = Math.max(lushMix, f * 0.35 * Math.sin(Math.PI * t));
          }
          const candidate = y0 + (target - y0) * f;
          // Plusieurs cours d'eau : le lit le plus bas l'emporte.
          y = y === Infinity ? candidate : Math.min(y, candidate);
        }
        if (y === Infinity || Math.abs(y - y0) < 1e-4) continue;
        positions[i + 1] = y;
        changed++;
        if (colors) {
          for (let c = 0; c < 3; c++) {
            let value = colors[i + c];
            value += (lush[c] - value) * lushMix;
            value += (mud[c] - value) * mudMix;
            colors[i + c] = value;
          }
        }
      }
      state.carved = changed;
      return changed;
    },
    /** Cellules grossières du terrain à subdiviser le long des tronçons naturels. */
    cellsToRefine({ bounds, rows, cols, channels, sample, isCoarse }) {
      if (!state.ready) return [];
      const cw = (bounds.x1 - bounds.x0) / cols;
      const ch = (bounds.z1 - bounds.z0) / rows;
      const seen = new Set();
      const cells = [];
      for (const channel of channels) {
        const profile = state.profiles.get(channel);
        if (!profile || profile.max <= 0) continue;
        const band = channel.maxWidth / 2 + BANK + 1.3;
        for (let i = 0; i < channel.line.length - 1; i++) {
          const a = channel.line[i];
          const b = channel.line[i + 1];
          const c0 = Math.max(0, Math.floor((Math.min(a[0], b[0]) - band - bounds.x0) / cw));
          const c1 = Math.min(cols - 1, Math.floor((Math.max(a[0], b[0]) + band - bounds.x0) / cw));
          const r0 = Math.max(0, Math.floor((Math.min(a[1], b[1]) - band - bounds.z0) / ch));
          const r1 = Math.min(rows - 1, Math.floor((Math.max(a[1], b[1]) + band - bounds.z0) / ch));
          for (let r = r0; r <= r1; r++)
            for (let c = c0; c <= c1; c++) {
              const key = r * cols + c;
              if (seen.has(key)) continue;
              const cx = bounds.x0 + (c + 0.5) * cw;
              const cz = bounds.z0 + (r + 0.5) * ch;
              const s = sample([cx, cz], channel, band + cw);
              if (!(s.distance < s.width / 2 + BANK + 1.3 + cw * 0.72) || factorAt(channel, s.along) <= 0.02) continue;
              seen.add(key);
              if (isCoarse(r, c)) cells.push([r, c]);
            }
        }
      }
      state.refined = cells.length;
      return cells;
    },
    /**
     * Profondeurs des cours d'eau recalculées d'après le relief réel (lit creusé compris).
     * La carte d'origine (1 pixel ≈ 0,9 m) ne voyait presque pas des canaux de 1,5 m de
     * large : l'eau y paraissait partout peu profonde et pâle.
     */
    bakeDepth({ data, size, bounds, channels, sample, terrain }) {
      const [x0, x1, z0, z1] = bounds;
      const dx = (x1 - x0) / size;
      const dz = (z1 - z0) / size;
      let texels = 0;
      for (const channel of channels) {
        const reach = channel.maxWidth / 2 + dx;
        for (let i = 0; i < channel.line.length - 1; i++) {
          const a = channel.line[i];
          const b = channel.line[i + 1];
          const i0 = Math.max(0, Math.floor((Math.min(a[0], b[0]) - reach - x0) / dx));
          const i1 = Math.min(size - 1, Math.ceil((Math.max(a[0], b[0]) + reach - x0) / dx));
          const j0 = Math.max(0, Math.floor((Math.min(a[1], b[1]) - reach - z0) / dz));
          const j1 = Math.min(size - 1, Math.ceil((Math.max(a[1], b[1]) + reach - z0) / dz));
          for (let j = j0; j <= j1; j++)
            for (let ii = i0; ii <= i1; ii++) {
              const x = x0 + (ii + 0.5) * dx;
              const z = z0 + (j + 0.5) * dz;
              const s = sample([x, z], channel, reach);
              if (!(s.distance < s.width / 2)) continue;
              const depth = s.height - terrain(x, z);
              const value = Math.round(Math.max(0, Math.min(1, (depth - 0.12) / 3.4)) * 255);
              const index = (j * size + ii) * 4;
              if (value > data[index]) {
                data[index] = data[index + 1] = data[index + 2] = value;
                texels++;
              }
            }
        }
      }
      return texels;
    },
    state,
    pointAt,
    noise,
  };

  // --- Plantes des berges --------------------------------------------------------------
  // Géométries simples à couleurs de sommets, instanciées par secteurs de 48 m.
  function tintGeometry(THREE, geometry, bottom, top) {
    const position = geometry.attributes.position;
    geometry.computeBoundingBox();
    const minY = geometry.boundingBox.min.y;
    const span = Math.max(1e-4, geometry.boundingBox.max.y - minY);
    const colors = new Float32Array(position.count * 3);
    const a = new THREE.Color(bottom).convertSRGBToLinear();
    const b = new THREE.Color(top).convertSRGBToLinear();
    const c = new THREE.Color();
    for (let i = 0; i < position.count; i++) {
      c.copy(a).lerp(b, (position.getY(i) - minY) / span);
      colors.set([c.r, c.g, c.b], i * 3);
    }
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geometry;
  }

  function merge(THREE, parts) {
    const flat = parts.map((part) => (part.index ? part.toNonIndexed() : part));
    let count = 0;
    for (const part of flat) count += part.attributes.position.count;
    const position = new Float32Array(count * 3);
    const normal = new Float32Array(count * 3);
    const color = new Float32Array(count * 3);
    let offset = 0;
    for (const g of flat) {
      if (!g.attributes.normal) g.computeVertexNormals();
      position.set(g.attributes.position.array, offset * 3);
      normal.set(g.attributes.normal.array, offset * 3);
      color.set(g.attributes.color.array, offset * 3);
      offset += g.attributes.position.count;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(position.subarray(0, offset * 3), 3));
    geometry.setAttribute("normal", new THREE.BufferAttribute(normal.subarray(0, offset * 3), 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(color.subarray(0, offset * 3), 3));
    return geometry;
  }

  /** Lame de feuille arquée (triangles), de la base (0,0,0) vers le haut. */
  function blade(THREE, height, width, lean, turn, bottom, top) {
    const positions = [];
    const segments = 4;
    const cos = Math.cos(turn);
    const sin = Math.sin(turn);
    for (let i = 0; i < segments; i++) {
      const t0 = i / segments;
      const t1 = (i + 1) / segments;
      const w0 = width * (1 - t0 * 0.9);
      const w1 = width * (1 - t1 * 0.9);
      const x0 = lean * t0 * t0;
      const x1 = lean * t1 * t1;
      const y0 = height * t0;
      const y1 = height * t1;
      const quad = [
        [x0, y0, -w0 / 2],
        [x0, y0, w0 / 2],
        [x1, y1, w1 / 2],
        [x0, y0, -w0 / 2],
        [x1, y1, w1 / 2],
        [x1, y1, -w1 / 2],
      ];
      for (const [x, y, z] of quad) positions.push(x * cos - z * sin, y, x * sin + z * cos);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    return tintGeometry(THREE, geometry, bottom, top);
  }

  function plantGeometries(THREE) {
    const leaves = (count, height, width, lean, bottom, top) => {
      const parts = [];
      for (let i = 0; i < count; i++) {
        const turn = (i / count) * Math.PI * 2 + (i % 2) * 0.4;
        parts.push(blade(THREE, height * (0.75 + 0.3 * ((i * 7) % 5) / 4), width, lean * (0.6 + 0.5 * (i % 3) / 2), turn, bottom, top));
      }
      return parts;
    };
    const flower = (geometry, color, y, scale = [1, 1, 1]) => {
      geometry.scale(...scale);
      geometry.translate(0, y, 0);
      return tintGeometry(THREE, geometry, color, color);
    };
    return {
      // Carex : touffe arquée.
      sedge: merge(THREE, leaves(9, 0.62, 0.05, 0.3, "#4b6130", "#9aa956")),
      // Iris jaune des marais : lames droites et fleurs jaunes.
      iris: merge(THREE, [
        ...leaves(6, 0.95, 0.07, 0.12, "#3f5a2c", "#7f9a45"),
        flower(new THREE.IcosahedronGeometry(0.06, 0), "#f2cf3a", 0.86, [1.3, 0.8, 1.3]),
        flower(new THREE.IcosahedronGeometry(0.055, 0), "#f0c630", 0.78, [1.2, 0.8, 1.2]).translate(0.08, 0, 0.03),
      ]),
      // Reine-des-prés : tiges et panicules crème.
      meadowsweet: merge(THREE, [
        ...leaves(4, 0.55, 0.09, 0.25, "#40592c", "#6f8a43"),
        tintGeometry(THREE, new THREE.CylinderGeometry(0.008, 0.012, 1.05, 4).translate(0, 0.52, 0), "#5b6e38", "#6f7f44"),
        flower(new THREE.IcosahedronGeometry(0.11, 1), "#efe8cf", 1.08, [1.1, 0.7, 1.1]),
        flower(new THREE.IcosahedronGeometry(0.07, 0), "#f4eed8", 1.02, [1, 0.7, 1]).translate(0.1, 0, 0.02),
      ]),
      // Salicaire : épis pourpres.
      loosestrife: merge(THREE, [
        ...leaves(4, 0.45, 0.06, 0.2, "#3f5a2c", "#6d8a42"),
        tintGeometry(THREE, new THREE.CylinderGeometry(0.008, 0.01, 0.9, 4).translate(0, 0.45, 0), "#556a34", "#6c7a3f"),
        flower(new THREE.ConeGeometry(0.045, 0.34, 5), "#b3418f", 1.02),
        flower(new THREE.ConeGeometry(0.035, 0.26, 5), "#c54f9c", 0.9).translate(0.09, 0, -0.04),
      ]),
      // Fougère : frondes étalées.
      fern: merge(THREE, leaves(7, 0.7, 0.16, 0.5, "#3c5a2a", "#7ea24a")),
    };
  }

  V32.register(
    "riverbanks",
    function (context) {
      const { THREE, game, hooks } = context;
      if (!state.ready || !game.channels || !game.channelSample || !game.terrainHeight) return null;
      const surfaces = hooks.surfaces;
      const density = hooks.mobile ? 0.55 : 1;
      let seed = 90731;
      const random = () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
      const records = { reed: [], sedge: [], iris: [], meadowsweet: [], loosestrife: [], fern: [], grass: [], rock: [] };

      for (const channel of game.channels) {
        if (!(state.profiles.get(channel)?.max > 0)) continue;
        for (let along = 1; along < channel.length - 1; along += 0.55 + random() * 0.4) {
          const f = factorAt(channel, along);
          if (f < 0.6) continue;
          const [cx, cz] = pointAt(channel, along);
          const s = game.channelSample([cx, cz], channel, channel.maxWidth);
          const fx = s.flow[0];
          const fz = s.flow[1];
          const half = s.width / 2;
          for (const side of [-1, 1]) {
            const nx = -fz * side;
            const nz = fx * side;
            const place = (list, offset, scale, rotation = random() * Math.PI * 2) => {
              const x = cx + nx * offset + fx * (random() - 0.5) * 0.5;
              const z = cz + nz * offset + fz * (random() - 0.5) * 0.5;
              if (keepFactor(x, z, false) < 0.9 || pondFactor(x, z) < 0.9) return;
              list.push({ x, z, y: game.terrainHeight(x, z), scale, rotation });
            };
            const edge = half - 0.1;
            if (random() < 0.42 * density) place(records.reed, edge + random() * 0.35, 7 + random() * 4);
            if (random() < 0.5 * density) place(records.sedge, edge + 0.25 + random() * 1.2, 0.8 + random() * 0.6);
            if (random() < 0.28 * density) place(records.grass, edge + 0.5 + random() * 2.2, 3.5 + random() * 2.5);
            if (random() < 0.07 * density) place(records.iris, edge + random() * 0.4, 0.85 + random() * 0.4);
            if (random() < 0.09 * density) place(records.meadowsweet, edge + 0.9 + random() * 1.8, 0.8 + random() * 0.45);
            if (random() < 0.07 * density) place(records.loosestrife, edge + 0.5 + random() * 1.6, 0.85 + random() * 0.4);
            if (random() < 0.05 * density) place(records.fern, edge + 1.3 + random() * 2, 0.8 + random() * 0.5);
            if (random() < 0.035 * density) place(records.rock, edge - 0.15 + random() * 0.4, 0.45 + random() * 0.5);
          }
        }
      }

      const plants = plantGeometries(THREE);
      const assets = {
        reed: surfaces?.assetGeometry?.("Reed_Clump"),
        grass: surfaces?.assetGeometry?.("Grass_Clump"),
        rock: surfaces?.assetGeometry?.("Rock_Medium_" + (1 + Math.floor(random() * 3))),
      };
      const sway = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, side: THREE.DoubleSide });
      sway.name = "Plantes_des_berges_v32";
      V32.patchMaterial(sway, "bank-sway", (shader) => {
        shader.uniforms.bankTime32 = V32.uniforms.time;
        shader.uniforms.bankWind32 = V32.uniforms.wind;
        shader.uniforms.bankDirection32 = V32.uniforms.windDirection;
        shader.vertexShader =
          "uniform float bankTime32,bankWind32;uniform vec2 bankDirection32;\n" +
          shader.vertexShader.replace(
            "#include <begin_vertex>",
            `#include <begin_vertex>
  #ifdef USE_INSTANCING
   vec3 bankRoot32=(modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.)).xyz;
   vec3 bankAxisX32=instanceMatrix[0].xyz,bankAxisZ32=instanceMatrix[2].xyz;
   float bankScale32=length(instanceMatrix[1].xyz);
  #else
   vec3 bankRoot32=(modelMatrix*vec4(0.,0.,0.,1.)).xyz;
   vec3 bankAxisX32=vec3(1.,0.,0.),bankAxisZ32=vec3(0.,0.,1.);
   float bankScale32=1.;
  #endif
  float bankHeight32=max(0.,position.y)*bankScale32;
  float bankForce32=clamp(bankWind32,0.,1.8);
  float bankPhase32=dot(bankRoot32.xz,vec2(.37,.29));
  float bankGust32=.55+.45*sin(dot(bankRoot32.xz,bankDirection32)*.08-bankTime32*(.7+.4*bankForce32));
  float bankBend32=bankHeight32*bankHeight32*(.03+.12*bankForce32)*(bankGust32+.35*sin(bankTime32*(2.3+bankForce32)+bankPhase32));
  vec2 bankPush32=normalize(bankDirection32+vec2(.00001))*bankBend32;
  // Poussée exprimée dans le repère de la plante (chaque touffe est tournée au hasard).
  float bankLenX32=max(.001,length(bankAxisX32)),bankLenZ32=max(.001,length(bankAxisZ32));
  transformed.x+=dot(bankPush32,bankAxisX32.xz/bankLenX32)/bankLenX32;
  transformed.z+=dot(bankPush32,bankAxisZ32.xz/bankLenZ32)/bankLenZ32;`,
          );
      });
      const stone = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, flatShading: true });
      stone.name = "Pierres_des_berges_v32";

      const group = new THREE.Group();
      group.name = "Berges_naturelles_v32";
      game.scene.add(group);
      const matrix = new THREE.Matrix4();
      const quaternion = new THREE.Quaternion();
      const up = new THREE.Vector3(0, 1, 0);
      const color = new THREE.Color();
      // Toutes les touffes reçoivent une teinte : un même matériau ne peut pas servir à des
      // instances avec et sans couleur propre (le shader serait celui des premières).
      const palettes = {
        reed: ["#8fa057", "#a3a862", "#7f9550", "#b0ad6c"],
        grass: ["#88a54f", "#9aae5a", "#7a9a48"],
        rock: ["#8f958c", "#a0a399", "#7f877f"],
        plant: ["#ffffff", "#eef2e2", "#e2e9d2", "#f6f1e0"],
      };
      let instances = 0;
      const build = (name, geometry, material, list, stretch = [1, 1, 1], sink = 0) => {
        if (!geometry || !list.length) return;
        const chunks = new Map();
        for (const r of list) {
          const key = Math.floor(r.x / 48) + ":" + Math.floor(r.z / 48);
          if (!chunks.has(key)) chunks.set(key, []);
          chunks.get(key).push(r);
        }
        geometry.computeBoundingSphere();
        const radius = geometry.boundingSphere.radius;
        for (const [key, items] of chunks) {
          const shared = new THREE.BufferGeometry();
          shared.index = geometry.index;
          for (const attribute of Object.keys(geometry.attributes)) shared.setAttribute(attribute, geometry.attributes[attribute]);
          const mesh = new THREE.InstancedMesh(shared, material, items.length);
          mesh.name = name + "_" + key;
          mesh.receiveShadow = true;
          mesh.castShadow = false;
          const box = new THREE.Box3();
          items.forEach((r, i) => {
            quaternion.setFromAxisAngle(up, r.rotation);
            const scale = new THREE.Vector3(r.scale * stretch[0], r.scale * stretch[1], r.scale * stretch[2]);
            matrix.compose(new THREE.Vector3(r.x, r.y - sink * r.scale, r.z), quaternion, scale);
            mesh.setMatrixAt(i, matrix);
            const palette = palettes[name.split("_")[0]] || palettes.plant;
            color.set(palette[Math.floor(random() * palette.length)]).convertSRGBToLinear();
            mesh.setColorAt(i, color);
            box.expandByPoint(new THREE.Vector3(r.x, r.y, r.z));
          });
          const sphere = new THREE.Sphere();
          box.getBoundingSphere(sphere);
          sphere.radius += radius * 12;
          shared.boundingSphere = sphere;
          if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
          group.add(mesh);
          instances += items.length;
        }
      };
      build("reed_Roseaux", assets.reed, sway, records.reed);
      build("grass_Herbes_hautes", assets.grass, sway, records.grass, [1, 1.35, 1]);
      build("rock_Pierres", assets.rock, stone, records.rock, [1, 1, 1], 0.12);
      build("Carex", plants.sedge, sway, records.sedge);
      build("Iris_jaunes", plants.iris, sway, records.iris);
      build("Reine_des_pres", plants.meadowsweet, sway, records.meadowsweet);
      build("Salicaires", plants.loosestrife, sway, records.loosestrife);
      build("Fougeres", plants.fern, sway, records.fern);
      state.plants = instances;
      hooks.markDirty();
      return null;
    },
    35,
  );
})();
