// Moulin V32 — sens réel de l'eau.
//
// Sur le terrain, l'eau vient du sud-ouest : le ruisseau entre dans le grand étang sous
// la passerelle du bout de l'étang, le grand étang alimente le moulin (sortie, bief le
// long du pan, roue, chute derrière le moulin), puis l'eau repart vers l'est : bief du
// coteau, bassin devant la véranda, étang intermédiaire, petit étang et rivière vers
// l'est. La première version faisait couler tout le réseau dans l'autre sens.
//
// Ce module inverse le courant partout (rides, écume, roue, chutes) et remet les niveaux
// d'eau en cohérence : le grand étang reste la référence (0), tout ce qui est en aval
// (à l'est) descend, le ruisseau du sud-ouest monte. Le relief suit l'eau : le lit et
// les berges de chaque cours d'eau et de chaque étang sont déplacés du même écart, qui
// s'estompe en quelques mètres dans la prairie. Autour de la maison, du carport, des
// passerelles et des bacs, le relief n'est pas touché (sauf dans le lit lui-même).
(function () {
  "use strict";
  const V32 = globalThis.MoulinV32;

  // Écart de niveau (nouveau − ancien) le long de chaque cours d'eau, en mètres, selon
  // l'abscisse d'origine (mesurée depuis le premier point du tracé du plan).
  const CHANNEL_DELTA = {
    // Bief : grand étang → moulin → chute (vers l'est) → coteau → confluence à l'est.
    Bief_du_moulin: [
      [0, -1.64],
      [217.85, -1.3],
      [218.85, -0.168],
      [249.7, -0.05],
    ],
    // Étang intermédiaire → petit étang → rivière vers l'est.
    Riviere_amont: [
      [0, -1.7],
      [88.9, -1.06],
    ],
    // Bassin devant la véranda → étang intermédiaire.
    Riviere_vers_le_moulin: [
      [0, -1.06],
      [20.8, -0.58],
    ],
    // Grand étang → vanne (déversoir) → bassin devant la véranda.
    Riviere_vers_le_grand_etang: [
      [0, -0.58],
      [12.9, -0.58],
      [13.9, -0.058],
      [28.3, 0],
    ],
    // Grand étang → bief (le long du pan du moulin).
    Sortie_bief_vers_grand_etang: [
      [0, -0.055],
      [3.3, 0],
    ],
    // Petit bassin du sud-ouest → chute (quelques mètres en amont de la passerelle) → grand étang.
    Ruisseau_sous_la_passerelle: [
      [0, 0],
      [12.45, 0.016],
      [13.6, 0.417],
      [15.8, 0.42],
      [16.8, 0.7],
      [26, 0.72],
    ],
    // Ruisseau du sud-ouest → petit bassin.
    Riviere_aval: [
      [0, 0.72],
      [157.2, 1.45],
    ],
  };
  // Nouveaux niveaux des étangs et bassins (le grand étang reste à 0).
  const POND_LEVEL = {
    "Grand étang": 0,
    "Étang intermédiaire": -0.42,
    "Petit étang": -0.62,
    Bassin_devant_la_veranda: -0.28,
    Petit_bassin_aval_du_pont: 0.32,
  };
  // Chutes : amont / aval réels et nouvelle position de la chute du sud-ouest (déplacée de
  // 3,5 m pour ne pas tomber sous la passerelle, coordonnées du plan).
  const CASCADES = {
    Chute_du_bief_derriere_le_moulin: { upperLevel: -0.05, lowerLevel: -0.42 },
    Deversoir_bassin_veranda: { upperLevel: -0.02, lowerLevel: -0.28 },
    Petite_cascade_sous_le_pont: { upperLevel: 0.3, lowerLevel: 0.02, centre: [877.85, 807.3], direction: [0.715, -0.699] },
  };
  // Ouvrages dont les abords ne bougent pas (monde, m) : moulin et terrasse, carport et
  // voiture, bacs en béton, passerelles, vanne, coffre du cygne, bûcher.
  const PROTECT = [
    { box: [-9, 11, -13, 21] },
    { box: [-1, 13, -27, -4] },
    { box: [6, 13, -40, -29] },
    { x: 34, z: -25.5, r: 4.5 },
    { x: 17.8, z: 13.2, r: 4 },
    { x: 3.45, z: 9.45, r: 3 },
    { x: -102.85, z: 105.37, r: 4.5 },
    { x: -97.8, z: 116.2, r: 3 },
    { x: -124, z: 95, r: 7 },
  ];
  // Tronçons creusés à bords francs et maçonnés (le long du carport et de la cour) : le lit
  // descend sans toucher aux abords, deux murs de pierre tiennent les berges.
  const WALLED_CUT = { Bief_du_moulin: [196, 219.2] };
  const FADE = 5; // mètres pour revenir au relief d'origine autour d'un ouvrage protégé
  const CELL = 1; // pas de la grille des écarts (m)

  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const smooth = (a, b, x) => {
    const t = clamp01((x - a) / (b - a));
    return t * t * (3 - 2 * t);
  };
  function interp(table, along) {
    if (along <= table[0][0]) return table[0][1];
    for (let i = 1; i < table.length; i++) {
      if (along <= table[i][0]) {
        const [a0, v0] = table[i - 1];
        const [a1, v1] = table[i];
        return v0 + ((v1 - v0) * (along - a0)) / (a1 - a0 || 1);
      }
    }
    return table[table.length - 1][1];
  }
  const toWorld = (p) => [(p[0] - 1268) * 0.27, (p[1] - 408) * 0.27];

  function protectFactor(x, z) {
    let f = 1;
    for (const p of PROTECT) {
      let d;
      if (p.box) {
        const [x0, x1, z0, z1] = p.box;
        const dx = Math.max(x0 - x, 0, x - x1);
        const dz = Math.max(z0 - z, 0, z - z1);
        d = Math.hypot(dx, dz);
      } else d = Math.max(0, Math.hypot(x - p.x, z - p.z) - p.r);
      if (d < FADE) f = Math.min(f, smooth(0, FADE, d));
      if (f === 0) break;
    }
    return f;
  }

  function pointInPolygon(x, z, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, zi] = poly[i];
      const [xj, zj] = poly[j];
      if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi || 1e-9) + xi) inside = !inside;
    }
    return inside;
  }
  function segmentDistance(x, z, a, b) {
    const vx = b[0] - a[0];
    const vz = b[1] - a[1];
    const len2 = vx * vx + vz * vz || 1e-9;
    const t = clamp01(((x - a[0]) * vx + (z - a[1]) * vz) / len2);
    const px = a[0] + vx * t;
    const pz = a[1] + vz * t;
    return { d: Math.hypot(x - px, z - pz), t };
  }

  const state = {
    enabled: false,
    ponds: [], // { poly, delta }
    channels: [], // { line, lengths, table, halfWidth }
    grid: null,
    reshaped: 0,
  };

  V32.hydro32 = {
    state,
    /** Sens du courant inversé partout (le shader, l'écume, la roue suivent). */
    flip: true,
    /** Sens de rotation de la roue (la base des aubes suit le courant). */
    wheelSpin: 1,

    /** Réécrit les niveaux des étangs et des chutes du plan, avant la construction de l'eau. */
    transform(plan) {
      if (!plan || state.enabled) return;
      state.enabled = true;
      for (const list of [plan.ponds || [], plan.extraPools || []])
        for (const pond of list) {
          if (!(pond.name in POND_LEVEL)) continue;
          const delta = POND_LEVEL[pond.name] - (pond.level || 0);
          pond.level = POND_LEVEL[pond.name];
          if (Math.abs(delta) > 1e-3 && pond.outline) state.ponds.push({ name: pond.name, poly: pond.outline.map(toWorld), delta });
        }
      for (const cascade of plan.cascades || []) {
        const change = CASCADES[cascade.name];
        if (!change) continue;
        cascade.upperLevel = change.upperLevel;
        cascade.lowerLevel = change.lowerLevel;
        cascade.direction = change.direction ? change.direction.slice() : [-cascade.direction[0], -cascade.direction[1]];
        if (change.centre) cascade.centre = change.centre.slice();
      }
      for (const key of Object.keys(plan.hydrology || {})) {
        const channel = plan.hydrology[key];
        const table = CHANNEL_DELTA[channel.name];
        if (table) state.channels.push({ name: channel.name, line: channel.centreline.map(toWorld), table, width: channel.widths ? Math.max(...channel.widths) : channel.width || 1.5 });
      }
      if (plan.outlet && plan.outlet.centreline)
        state.channels.push({ name: "Ruisseau_sous_la_passerelle", line: plan.outlet.centreline.map(toWorld), table: CHANNEL_DELTA.Ruisseau_sous_la_passerelle, width: plan.outlet.width || 3 });
      for (const channel of state.channels) {
        channel.lengths = [0];
        for (let i = 1; i < channel.line.length; i++)
          channel.lengths.push(channel.lengths[i - 1] + Math.hypot(channel.line[i][0] - channel.line[i - 1][0], channel.line[i][1] - channel.line[i - 1][1]));
      }
    },

    /** Écart de niveau d'un cours d'eau à l'abscisse donnée (tracé d'origine). */
    delta(channel, along) {
      if (!state.enabled || !channel) return 0;
      const table = CHANNEL_DELTA[channel.name];
      return table ? interp(table, along) : 0;
    },

    /** Déplace le relief avec l'eau : lits, berges et abords des étangs et cours d'eau. */
    reshape({ positions, grid, bounds }) {
      if (!state.enabled || !positions) return 0;
      const x0 = bounds.x0 - 2,
        z0 = bounds.z0 - 2;
      const nx = Math.ceil((bounds.x1 - bounds.x0 + 4) / CELL) + 1;
      const nz = Math.ceil((bounds.z1 - bounds.z0 + 4) / CELL) + 1;
      const num = new Float32Array(nx * nz);
      const den = new Float32Array(nx * nz);
      const core = new Uint8Array(nx * nz);
      const reach = (delta) => (delta < 0 ? 3 + 4 * -delta : 6 + 6 * delta);
      const visit = (bx0, bx1, bz0, bz1, fn) => {
        const i0 = Math.max(0, Math.floor((bx0 - x0) / CELL));
        const i1 = Math.min(nx - 1, Math.ceil((bx1 - x0) / CELL));
        const j0 = Math.max(0, Math.floor((bz0 - z0) / CELL));
        const j1 = Math.min(nz - 1, Math.ceil((bz1 - z0) / CELL));
        for (let j = j0; j <= j1; j++)
          for (let i = i0; i <= i1; i++) fn(i, j, x0 + i * CELL, z0 + j * CELL, j * nx + i);
      };
      // Cours d'eau : écart du point le plus proche du tracé.
      for (const channel of state.channels) {
        const coreWidth = channel.width / 2 + 1.2;
        const cut = WALLED_CUT[channel.name];
        const cutWidth = channel.width / 2 + 0.42;
        const maxReach = coreWidth + Math.max(...channel.table.map((row) => reach(row[1])));
        let bx0 = Infinity,
          bx1 = -Infinity,
          bz0 = Infinity,
          bz1 = -Infinity;
        for (const p of channel.line) {
          bx0 = Math.min(bx0, p[0]);
          bx1 = Math.max(bx1, p[0]);
          bz0 = Math.min(bz0, p[1]);
          bz1 = Math.max(bz1, p[1]);
        }
        visit(bx0 - maxReach, bx1 + maxReach, bz0 - maxReach, bz1 + maxReach, (i, j, x, z, k) => {
          let best = Infinity,
            along = 0;
          for (let s = 0; s < channel.line.length - 1; s++) {
            const r = segmentDistance(x, z, channel.line[s], channel.line[s + 1]);
            if (r.d < best) {
              best = r.d;
              along = channel.lengths[s] + (channel.lengths[s + 1] - channel.lengths[s]) * r.t;
            }
          }
          const delta = interp(channel.table, along);
          if (Math.abs(delta) < 1e-3) return;
          const walled = cut && along >= cut[0] && along <= cut[1];
          const inner = walled ? cutWidth : coreWidth;
          const w = best <= inner ? 1 : walled ? smooth(inner + 0.25, inner, best) : smooth(coreWidth + reach(delta), coreWidth, best);
          if (w <= 0) return;
          num[k] += delta * w;
          den[k] += w;
          if (best <= inner) core[k] = 1;
        });
      }
      // Étangs : écart constant dans l'étang et sur un liseré de berge.
      for (const pond of state.ponds) {
        const coreWidth = 1;
        const r = reach(pond.delta);
        let bx0 = Infinity,
          bx1 = -Infinity,
          bz0 = Infinity,
          bz1 = -Infinity;
        for (const p of pond.poly) {
          bx0 = Math.min(bx0, p[0]);
          bx1 = Math.max(bx1, p[0]);
          bz0 = Math.min(bz0, p[1]);
          bz1 = Math.max(bz1, p[1]);
        }
        visit(bx0 - coreWidth - r, bx1 + coreWidth + r, bz0 - coreWidth - r, bz1 + coreWidth + r, (i, j, x, z, k) => {
          let d = 0;
          if (!pointInPolygon(x, z, pond.poly)) {
            d = Infinity;
            for (let s = 0; s < pond.poly.length; s++) d = Math.min(d, segmentDistance(x, z, pond.poly[s], pond.poly[(s + 1) % pond.poly.length]).d);
          }
          const w = d <= coreWidth ? 1 : smooth(coreWidth + r, coreWidth, d);
          if (w <= 0) return;
          num[k] += pond.delta * w;
          den[k] += w;
          if (d <= coreWidth) core[k] = 1;
        });
      }
      const field = new Float32Array(nx * nz);
      for (let j = 0; j < nz; j++)
        for (let i = 0; i < nx; i++) {
          const k = j * nx + i;
          if (den[k] <= 0) continue;
          const value = num[k] / Math.max(1, den[k]);
          field[k] = core[k] ? value : value * protectFactor(x0 + i * CELL, z0 + j * CELL);
        }
      const sample = (x, z) => {
        const fx = (x - x0) / CELL,
          fz = (z - z0) / CELL;
        const i = Math.floor(fx),
          j = Math.floor(fz);
        if (i < 0 || j < 0 || i >= nx - 1 || j >= nz - 1) return 0;
        const tx = fx - i,
          tz = fz - j;
        const k = j * nx + i;
        const a = field[k] + (field[k + 1] - field[k]) * tx;
        const b = field[k + nx] + (field[k + nx + 1] - field[k + nx]) * tx;
        return a + (b - a) * tz;
      };
      let moved = 0;
      for (let v = 0; v < positions.length; v += 3) {
        const dh = sample(positions[v], positions[v + 2]);
        if (dh) {
          positions[v + 1] += dh;
          moved++;
        }
      }
      if (grid)
        for (const row of grid) for (const point of row) point[1] += sample(point[0], point[2]);
      state.grid = { sample };
      state.reshaped = moved;
      return moved;
    },

    /** Écart du relief en un point (après reshape), pour les objets posés à la main. */
    offset(x, z) {
      return state.grid ? state.grid.sample(x, z) : 0;
    },
  };

  // Murs de pierre des tronçons maçonnés (construits une fois le relief et l'eau en place).
  V32.register(
    "hydro32-walls",
    function (context) {
      const { THREE, game, hooks } = context;
      if (!state.enabled || !game || !game.channels) return null;
      const sample = game.channelSample;
      const height = hooks.terrainHeight || game.terrainHeight;
      if (!sample || !height) return null;
      const stone = (hooks.materials && (hooks.materials.masonry || hooks.materials.stone)) || new THREE.MeshStandardMaterial({ color: 0x9d978a, roughness: 0.95 });
      const material = stone.clone();
      material.side = THREE.DoubleSide;
      material.vertexColors = false;
      const group = new THREE.Group();
      group.name = "Murs_du_bief_creuse_v32";
      group.userData.exportSkip = true;
      for (const channel of game.channels) {
        const range = WALLED_CUT[channel.name];
        if (!range) continue;
        const half = (channel.widths ? Math.max(...channel.widths) : channel.width) / 2;
        const pos = [],
          uv = [],
          idx = [];
        for (const side of [-1, 1]) {
          let prev = -1,
            run = 0;
          for (let along = range[0]; along <= Math.min(range[1], channel.length); along += 0.4) {
            let i = 0;
            while (i < channel.lengths.length - 2 && channel.lengths[i + 1] < along) i++;
            const a = channel.line[i],
              b = channel.line[i + 1];
            const seg = channel.lengths[i + 1] - channel.lengths[i] || 1;
            const t = (along - channel.lengths[i]) / seg;
            const cx = a[0] + (b[0] - a[0]) * t,
              cz = a[1] + (b[1] - a[1]) * t;
            const dx = (b[0] - a[0]) / seg,
              dz = (b[1] - a[1]) / seg;
            const nx = -dz * side,
              nz = dx * side;
            const water = sample([cx, cz], channel);
            const level = water && Number.isFinite(water.height) ? water.height : 0;
            const ground = height(cx + nx * (half + 0.95), cz + nz * (half + 0.95));
            const top = Math.max(ground + 0.06, level + 0.3);
            const bottom = level - 0.6;
            const inX = cx + nx * (half + 0.04),
              inZ = cz + nz * (half + 0.04),
              outX = cx + nx * (half + 0.4),
              outZ = cz + nz * (half + 0.4);
            const base = pos.length / 3;
            pos.push(inX, bottom, inZ, inX, top, inZ, outX, top, outZ, outX, bottom, outZ);
            uv.push(run, 0, run, (top - bottom) * 0.9, run + 0.1, (top - bottom) * 0.9 + 0.3, run + 0.1, 0);
            if (prev >= 0)
              for (const [p, q] of [
                [0, 1],
                [1, 2],
                [2, 3],
              ])
                idx.push(prev + p, base + p, base + q, prev + p, base + q, prev + q);
            prev = base;
            run += 0.4 * 0.9;
          }
        }
        if (!pos.length) continue;
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
        geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
        geometry.setIndex(idx);
        geometry.computeVertexNormals();
        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = "Murs_maconnes_" + channel.name;
        mesh.castShadow = mesh.receiveShadow = true;
        group.add(mesh);
      }
      if (!group.children.length) return null;
      game.scene.add(group);
      if (hooks.markDirty) hooks.markDirty();
      return { group };
    },
    37,
  );
})();
