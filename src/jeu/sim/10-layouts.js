// « Pas touche à mes trésors » — les cinq dispositions du domaine.
//
// Chaque disposition réorganise les mêmes ensembles : moulin + roue + bief, étangs et berges,
// ponts, bâtiments de stockage, bosquets, rochers. Coordonnées en U (1 U = 1,8 m) sur une carte
// de 64 × 44 U : x vers l'est, z vers le sud. La disposition est fixe pendant un niveau et
// reproductible (identifiant + graine).
//
// Terrain à cases : des zones typées (rocaille pour le feu, givre pour la glace, berge et marais
// pour l'eau) sont découpées en cases de 2 U alignées sur une grille unique ; chaque case libre
// (hors chemins, eau, bâtiments, ponts) devient un support. Des bois couvrent certaines cases :
// il faut les couper avant d'y bâtir. Les chemins partent de portes au bord de la carte.
(function () {
  "use strict";
  const PTMT = (globalThis.PTMT = globalThis.PTMT || {});
  const G = PTMT.geom;
  const C = PTMT.config;

  const W = 64,
    H = 44;
  const TILE = C.grid.tile;
  const COLS = Math.floor(W / TILE),
    ROWS = Math.floor(H / TILE);
  const ZONE_NAME = { fire: "Rocaille", ice: "Givre", water: "Berge" };
  // Couleurs des entrées (distinctes des couleurs des familles de tours).
  const ENTRY_COLORS = ["#e8453c", "#a259f0", "#f2a20c"];
  const WATER_ENTRY_COLOR = "#ec4fa0";

  function rectPoly(cx, cz, w, h, rot = 0) {
    const t = { x: cx, z: cz, rot };
    return [
      [-w / 2, -h / 2],
      [w / 2, -h / 2],
      [w / 2, h / 2],
      [-w / 2, h / 2],
    ].map((p) => G.xform(p, t));
  }
  function blob(cx, cz, rx, rz, seed, n = 18, wobble = 0.18, rot = 0) {
    const r = PTMT.rng(seed),
      pts = [];
    const phase = r() * 6.28;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const k = 1 + wobble * (Math.sin(a * 2 + phase) * 0.6 + (r() - 0.5));
      pts.push(G.xform([Math.cos(a) * rx * k, Math.sin(a) * rz * k], { x: cx, z: cz, rot }));
    }
    return pts;
  }
  /** Rectangle de carte [x0, x1] × [z0, z1]. */
  function box(x0, z0, x1, z1) {
    return [
      [x0, z0],
      [x1, z0],
      [x1, z1],
      [x0, z1],
    ];
  }
  /** Adoucit une polyligne (Chaikin) : les extrémités restent en place. */
  function chaikin(pts, n = 2) {
    let p = pts;
    for (let k = 0; k < n; k++) {
      if (p.length < 3) return p;
      const q = [p[0]];
      for (let i = 0; i < p.length - 1; i++) {
        const a = p[i],
          b = p[i + 1];
        if (i > 0) q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
        if (i < p.length - 2) q.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
      }
      q.push(p[p.length - 1]);
      p = q;
    }
    return p.map((v) => [Math.round(v[0] * 1000) / 1000, Math.round(v[1] * 1000) / 1000]);
  }
  function polySigned(x, z, poly) {
    let d = Infinity;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) d = Math.min(d, G.segDist(x, z, poly[j], poly[i]));
    return G.pointInPolygon(x, z, poly) ? d : -d;
  }
  /** Distance signée à l'eau (positive dans l'eau, négative sur la terre ferme). */
  function waterSigned(L, x, z) {
    let best = -Infinity;
    for (const p of L.ponds) {
      let d = polySigned(x, z, p.poly);
      if (p.island && d > 0) d = Math.min(d, -polySigned(x, z, p.island));
      if (d > best) best = d;
    }
    for (const st of L.streams) best = Math.max(best, st.width / 2 - G.polylineDist(x, z, st.pts));
    return best;
  }

  /** Constructeur de disposition : modules, graphe des chemins, zones, supports et emplacements. */
  function builder(def) {
    const L = {
      id: def.id,
      level: def.level,
      name: def.name,
      seed: def.seed,
      size: [W, H],
      tile: TILE,
      grid: { cols: COLS, rows: ROWS, tile: TILE },
      pitch: def.pitch || "",
      mill: null,
      buildings: [],
      ponds: [],
      streams: [],
      bridges: [],
      pontoons: [],
      groves: [],
      rocks: [],
      islets: [],
      hills: def.hills || [],
      fields: def.fields || [],
      nodes: {},
      edges: [],
      entries: [],
      exits: [],
      gates: [],
      reserves: [],
      zones: [],
      woods: [],
      sockets: [],
      trapSlots: [],
      blockers: [],
      split: def.split,
    };
    const extraTiles = [];
    const b = {
      L,
      box,
      blob,
      node(id, p, opts = {}) {
        L.nodes[id] = { id, x: p[0], z: p[1], water: !!opts.water };
        if (opts.entry) L.entries.push({ id, node: id, kind: opts.entry, label: opts.label || id });
        if (opts.exit) L.exits.push({ id, node: id, kind: opts.exitKind || "land", label: opts.label || id });
        return id;
      },
      /** Arête entre deux nœuds ; `via` = points intermédiaires ; kind land | water | shore | bridge. Les chemins de terre sont adoucis. */
      edge(a, c, via = [], kind = "land") {
        let pts = [[L.nodes[a].x, L.nodes[a].z], ...via, [L.nodes[c].x, L.nodes[c].z]];
        if (kind === "land" && pts.length > 2) pts = chaikin(pts, 2);
        L.edges.push({ id: "e" + L.edges.length, a, b: c, kind, pts });
        return L.edges.length - 1;
      },
      path(ids, kind = "land") {
        for (let i = 0; i < ids.length - 1; i++) b.edge(ids[i], ids[i + 1], [], kind);
      },
      mill(o) {
        // Ensemble moulin + roue + bief. Repère local : long pan selon z, porte au milieu du pan
        // ouest (x < 0), roue contre le pan est (x > 0). La porte regarde (-cos rot, -sin rot).
        // Le bief arrive à la roue (inflow, depuis un étang) et repart (outflow), en coordonnées carte.
        const t = { x: o.x, z: o.z, rot: o.rot || 0 };
        const X = (p) => G.xform(p, t);
        const wheel = X([2.95, 1.6]);
        const m = {
          kind: "mill",
          x: o.x,
          z: o.z,
          rot: t.rot,
          footprint: [
            [-2.35, -3.95],
            [2.35, -3.95],
            [2.35, 3.95],
            [-2.35, 3.95],
          ].map(X),
          // Véranda de plain-pied contre le pan est, juste au nord de la roue : le jardin est à
          // la hauteur de son dallage (pas de bief ni de talus dessous).
          terrace: [
            [2.3, -2.3],
            [4.25, -2.3],
            [4.25, 1.2],
            [2.3, 1.2],
          ].map(X),
          door: X([-3.1, 0]),
          chest: X([-3.4, 1.4]),
          wheel,
          head: o.inflow[0],
          bief: [...o.inflow, wheel, ...o.outflow],
          meule: o.meule || X([-1.4, 5.4]),
          atelier: o.atelier || X([-5, -5.4]),
          reserve: o.reserve || null,
        };
        L.mill = m;
        L.blockers.push(m.footprint);
        b.node("door" + (o.reserve ? o.reserve.id : "M"), X([-3.8, 0]));
        if (o.reserve) b.reserve(o.reserve, m, m.door, m.chest, "door" + o.reserve.id);
        L.streams.push({ id: "bief", pts: m.bief, width: 0.8, bief: true });
        return m;
      },
      building(kind, o) {
        const t = { x: o.x, z: o.z, rot: o.rot || 0 };
        const w = o.w || 6,
          d = o.d || 4;
        const side = o.door || "n",
          off = o.doorOffset || 0;
        const local = { n: [off, -d / 2], s: [off, d / 2], w: [-w / 2, off], e: [w / 2, off] }[side];
        const out = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] }[side];
        const along = { n: [1, 0], s: [-1, 0], w: [0, -1], e: [0, 1] }[side];
        const P = (k, a) => [local[0] + out[0] * k + along[0] * a, local[1] + out[1] * k + along[1] * a];
        const bd = {
          kind,
          id: o.id || kind,
          x: o.x,
          z: o.z,
          rot: t.rot,
          w,
          d,
          footprint: rectPoly(o.x, o.z, w, d, t.rot),
          door: G.xform(P(0.15, 0), t),
          chest: G.xform(P(0.85, 1.3), t),
          onWater: !!o.onWater,
          island: !!o.island,
        };
        L.buildings.push(bd);
        if (!o.transparent) L.blockers.push(bd.footprint);
        if (o.reserve) {
          const id = "door" + o.reserve.id;
          b.node(id, G.xform(P(0.9, 0), t));
          b.reserve(o.reserve, bd, bd.door, bd.chest, id);
        }
        return bd;
      },
      reserve(r, host, door, chest, node) {
        L.reserves.push({ id: r.id, name: r.name, treasures: r.treasures, host: host.kind, doorNode: node, pos: chest, door });
      },
      pond(poly, opts = {}) {
        const p = { id: opts.id || "etang" + L.ponds.length, poly, island: opts.island || null, name: opts.name || "Étang" };
        L.ponds.push(p);
        return p;
      },
      stream(pts, width = 1.1, opts = {}) {
        L.streams.push({ id: opts.id || "ruisseau" + L.streams.length, pts: opts.raw ? pts : chaikin(pts, 2), width, bief: false });
      },
      bridge(x, z, rot, length = 3.2, width = 1.4) {
        L.bridges.push({ x, z, rot, length, width });
      },
      pontoon(pts, width = 1.1) {
        L.pontoons.push({ pts, width });
      },
      grove(x, z, r, count, species = "oak", seed = 1) {
        L.groves.push({ x, z, r, count, species, seed });
      },
      /** Petit îlot rocheux portant une case, au milieu de l'eau (calé sur la grille). */
      islet(kind, x, z, r = 1.4) {
        const i = Math.floor(x / TILE),
          j = Math.floor(z / TILE);
        const cx = (i + 0.5) * TILE,
          cz = (j + 0.5) * TILE;
        L.islets.push({ x: cx, z: cz, r });
        extraTiles.push({ kind, x: cx, z: cz, i, j, islet: true });
      },
      /** Petit bassin (mare, abreuvoir, flaque du marais) : de l'eau pour les berges. */
      basin(x, z, rx, rz, seed = 1) {
        L.ponds.push({ id: "bassin" + L.ponds.length, poly: blob(x, z, rx, rz, seed, 12, 0.1), island: null, name: "Mare", small: true });
      },
      rock(x, z, s = 1) {
        L.rocks.push({ x, z, s });
      },
      /**
       * Zone de construction typée : ses cases libres deviennent des supports de cette famille.
       * Seules les cases proches d'un chemin (`near`, 5 U par défaut entre le centre de la case et
       * l'axe du chemin : deux rangées de chaque côté) sont gardées.
       */
      zone(kind, poly, opts = {}) {
        L.zones.push({ id: opts.id || "z" + L.zones.length, kind, poly, name: opts.name || ZONE_NAME[kind], near: opts.near || 5 });
      },
      /** Bois : les cases de zone dont le centre est dedans sont boisées (à couper avant de bâtir). */
      woods(poly) {
        L.woods.push(poly);
      },
      circle(x, z, r, n = 14) {
        const pts = [];
        for (let i = 0; i < n; i++) pts.push([x + Math.cos((i / n) * Math.PI * 2) * r, z + Math.sin((i / n) * Math.PI * 2) * r]);
        return pts;
      },
      trap(edgeIndexOrPoint, t) {
        // Emplacement de piège sur une arête : position à la fraction t de l'arête.
        const e = typeof edgeIndexOrPoint === "number" ? L.edges[edgeIndexOrPoint] : null;
        if (!e) return;
        const line = G.polyline(e.pts);
        const p = G.at(line, line.length * t);
        L.trapSlots.push({ id: "t" + L.trapSlots.length, edge: e.id, s: line.length * t, x: p.x, z: p.z, dx: p.dx, dz: p.dz });
      },
      /** Emplacement de piège au point de chemin le plus proche de (x, z). */
      trapNear(x, z) {
        let best = null;
        for (const e of L.edges) {
          if (e.kind !== "land" && e.kind !== "bridge") continue;
          const line = G.polyline(e.pts);
          const pr = G.project(line, x, z);
          if (!best || pr.d < best.d) best = { e, line, pr, d: pr.d };
        }
        if (!best) return;
        const p = G.at(best.line, best.pr.s);
        L.trapSlots.push({ id: "t" + L.trapSlots.length, edge: best.e.id, s: best.pr.s, x: p.x, z: p.z, dx: p.dx, dz: p.dz });
      },
    };
    def.make(b);
    finalize(L, extraTiles);
    return L;
  }

  /** La case de centre (x, z) est-elle libre pour une zone de ce type ? */
  function tileClear(L, kind, x, z, roads) {
    const h = TILE / 2;
    if (x - h < 1 || z - h < 1 || x + h > W - 1 || z + h > H - 1) return false;
    const S = [
      [x, z],
      [x - h, z - h],
      [x + h, z - h],
      [x - h, z + h],
      [x + h, z + h],
      [x, z - h],
      [x, z + h],
      [x - h, z],
      [x + h, z],
    ];
    // Chemins, ponts et débarcadères.
    for (const e of roads) for (const s of S) if (G.polylineDist(s[0], s[1], e.pts) < C.grid.roadClear) return false;
    // Bâtiments (emprise et dégagement).
    for (const poly of L.blockers) {
      if (S.some((s) => G.pointInPolygon(s[0], s[1], poly))) return false;
      if (-polySigned(x, z, poly) < h + 0.45) return false;
    }
    const m = L.mill;
    if (m) {
      if (-polySigned(x, z, m.terrace) < h + 0.3 || G.pointInPolygon(x, z, m.terrace)) return false;
      for (const a of [m.meule, m.atelier]) if (Math.hypot(a[0] - x, a[1] - z) < 2.4) return false;
      if (Math.hypot(m.wheel[0] - x, m.wheel[1] - z) < 2.6) return false;
    }
    for (const r of L.reserves) {
      if (Math.hypot(r.pos[0] - x, r.pos[1] - z) < 2) return false;
      if (Math.hypot(r.door[0] - x, r.door[1] - z) < 1.6) return false;
    }
    for (const br of L.bridges) {
      const hl = br.length / 2 + 0.6;
      const a = [br.x - Math.cos(br.rot) * hl, br.z - Math.sin(br.rot) * hl],
        c = [br.x + Math.cos(br.rot) * hl, br.z + Math.sin(br.rot) * hl];
      if (G.segDist(x, z, a, c) < h + br.width / 2 + 0.4) return false;
    }
    for (const pt of L.pontoons) if (G.polylineDist(x, z, pt.pts) < h + pt.width / 2 + 0.3) return false;
    for (const e of [...L.entries, ...L.exits]) {
      const n = L.nodes[e.node];
      if (Math.hypot(n.x - x, n.z - z) < 3.2) return false;
    }
    // Eau : les cases de berge ont le centre sur la terre ferme, au bord de l'eau.
    if (kind === "water") {
      const wd = waterSigned(L, x, z);
      if (wd > -0.45 || wd < -3.6) return false;
      if (S.some((s) => waterSigned(L, s[0], s[1]) > 0.35)) return false;
    } else if (S.some((s) => waterSigned(L, s[0], s[1]) > -0.3)) return false;
    return true;
  }

  /** Découpe les zones en cases, marque les bois, prépare les portes. */
  function finalize(L, extraTiles) {
    const roads = L.edges.filter((e) => e.kind !== "water");
    const walks = L.edges.filter((e) => e.kind === "land" || e.kind === "bridge");
    const roadDist = (x, z) => Math.min(...walks.map((e) => G.polylineDist(x, z, e.pts)));
    const taken = new Set();
    const tiles = [];
    for (const t of extraTiles) {
      taken.add(t.i + ":" + t.j);
      tiles.push(Object.assign({ zone: null, forest: false }, t));
    }
    for (const zn of L.zones) {
      let x0 = Infinity,
        x1 = -Infinity,
        z0 = Infinity,
        z1 = -Infinity;
      for (const q of zn.poly) {
        x0 = Math.min(x0, q[0]);
        x1 = Math.max(x1, q[0]);
        z0 = Math.min(z0, q[1]);
        z1 = Math.max(z1, q[1]);
      }
      const i0 = Math.max(0, Math.floor(x0 / TILE)),
        i1 = Math.min(COLS - 1, Math.floor(x1 / TILE)),
        j0 = Math.max(0, Math.floor(z0 / TILE)),
        j1 = Math.min(ROWS - 1, Math.floor(z1 / TILE));
      for (let j = j0; j <= j1; j++)
        for (let i = i0; i <= i1; i++) {
          const key = i + ":" + j;
          if (taken.has(key)) continue;
          const x = (i + 0.5) * TILE,
            z = (j + 0.5) * TILE;
          if (!G.pointInPolygon(x, z, zn.poly)) continue;
          if (roadDist(x, z) > zn.near) continue;
          if (!tileClear(L, zn.kind, x, z, roads)) continue;
          taken.add(key);
          tiles.push({ kind: zn.kind, x, z, i, j, zone: zn.id, forest: L.woods.some((w) => G.pointInPolygon(x, z, w)) });
        }
    }
    // Ordre stable : de haut en bas puis de gauche à droite.
    tiles.sort((a, b) => a.j - b.j || a.i - b.i);
    L.sockets = tiles.map((t, n) => Object.assign({ id: "s" + n }, t));
    L.tileAt = {};
    for (const s of L.sockets) L.tileAt[s.i + ":" + s.j] = s.id;
    // Couleur de chaque entrée : la même sur la carte (porte, trajets) et dans l'annonce de vague.
    let land = 0;
    for (const e of L.entries) e.color = e.kind === "water" ? WATER_ENTRY_COLOR : ENTRY_COLORS[land++ % ENTRY_COLORS.length];
    // Portes : au bord de la carte, orientées vers l'intérieur le long du premier chemin.
    const seen = new Set();
    for (const e of [...L.entries, ...L.exits]) {
      if (seen.has(e.node)) continue;
      seen.add(e.node);
      const n = L.nodes[e.node];
      const edge = L.edges.find((x) => x.a === e.node || x.b === e.node);
      let dx = 0,
        dz = 1;
      if (edge) {
        const pts = edge.a === e.node ? edge.pts : edge.pts.slice().reverse();
        const q = pts[Math.min(2, pts.length - 1)];
        const l = Math.hypot(q[0] - n.x, q[1] - n.z) || 1;
        dx = (q[0] - n.x) / l;
        dz = (q[1] - n.z) / l;
      }
      const entry = L.entries.find((x) => x.node === e.node);
      L.gates.push({ node: e.node, x: n.x, z: n.z, dx, dz, kind: entry ? entry.kind : e.kind, entry: !!entry, label: (entry || e).label, color: entry ? entry.color : "#d8c9a0" });
    }
  }

  const layouts = {};

  // ─────────────────────────────────────────────────────────────────────────────
  // Niveau 1 — Bienvenue chez moi : le moulin au bout du grand étang, sa dépendance à l'ouest de
  // la cour. L'allée du nord serpente entre la rocaille et le pré givré ; le sentier du ruisseau
  // longe le bief jusqu'à la cour, entre les mares du marais.
  layouts[1] = builder({
    id: "L1-bienvenue-cases",
    level: 1,
    name: "Bienvenue chez moi",
    seed: 1101,
    pitch: "Le moulin et sa dépendance, l'allée du nord et le sentier du ruisseau.",
    hills: [
      { x: 50, z: 5, r: 12, h: 4 },
      { x: 8, z: 8, r: 12, h: 5 },
      { x: 60, z: 44, r: 10, h: 2.5 },
    ],
    fields: [{ poly: [[-6, -6], [14, -6], [12, 3], [-6, 4]], kind: "crop" }],
    make(b) {
      b.pond(
        [[-1, 33], [4, 31.4], [10, 31], [15.6, 31.6], [20.4, 33.2], [23.2, 35.6], [22.6, 39.4], [19.6, 42.6], [15, 45.2], [-1, 45.4]],
        { id: "grand-etang", name: "Grand étang", island: blob(10.5, 39.5, 2.6, 1.7, 7, 12, 0.15) },
      );
      b.mill({
        x: 31,
        z: 31,
        rot: Math.PI / 2 - 0.3,
        reserve: { id: "A", name: "Le moulin", treasures: 3 },
        inflow: [[23, 35.4], [25.6, 34.8], [27.8, 34.2]],
        outflow: [[33.9, 34.3], [38, 35.6], [44, 36.4], [50, 36], [56, 36.6], [64.8, 36.4]],
        meule: [37.4, 31.4],
        atelier: [8.6, 20.6],
      });
      b.building("dependance", { id: "dependance", x: 15, z: 25, rot: 0, w: 10, d: 4, door: "n", reserve: { id: "B", name: "La dépendance", treasures: 3 } });

      b.node("N", [45, -0.5], { entry: "land", exit: true, label: "Allée du nord" });
      b.node("E", [64.5, 30], { entry: "land", exit: true, label: "Sentier du ruisseau" });
      b.node("n1", [45, 5]);
      b.node("n2", [22, 8]);
      b.node("n3", [30, 15]);
      b.node("C", [35, 22]);
      b.node("e1", [52, 31]);
      b.node("e2", [42, 27]);
      b.edge("N", "n1", [[45, 2.5]]); // 0
      b.edge("n1", "n2", [[45, 7], [40, 7], [26, 7]]); // 1
      b.edge("n2", "n3", [[20, 9.5], [20, 13], [23, 15]]); // 2
      b.edge("n3", "C", [[37, 15], [38, 18], [37, 21]]); // 3
      b.edge("C", "doorA", [[32, 23.5], [31, 25.5]]); // 4
      b.edge("C", "doorB", [[28, 21], [20, 21]]); // 5
      b.edge("E", "e1", [[58, 30], [55, 31]]); // 6
      b.edge("e1", "e2", [[47, 31], [44, 30]]); // 7
      b.edge("e2", "C", [[40, 23], [37, 23]]); // 8

      b.trap(0, 0.6);
      b.trap(1, 0.55);
      b.trap(2, 0.5);
      b.trap(3, 0.4);
      b.trap(4, 0.4);
      b.trap(5, 0.5);
      b.trap(6, 0.5);
      b.trap(7, 0.5);
      b.trap(8, 0.5);

      // Rocaille du coteau nord et du virage ouest, pré givré entre les lacets de l'allée,
      // lavoir de la cour et marais le long du ruisseau.
      b.zone("fire", box(37, 0, 46, 11));
      b.zone("fire", box(13, 3, 25, 17));
      b.zone("ice", box(29, 8, 37, 14));
      b.zone("ice", box(17, 16, 34, 20));
      b.zone("ice", box(38, 13, 45, 24));
      b.basin(23.4, 25.6, 1.4, 1.1, 9);
      b.zone("water", box(19, 22, 28, 30));
      b.zone("fire", box(33, 23, 41, 30));
      b.basin(47, 25.4, 1.3, 1.0, 3);
      b.basin(56.4, 26, 1.2, 0.9, 5);
      b.zone("water", box(40, 23, 58, 36));
      b.woods(b.circle(16, 9, 2.6));
      b.woods(b.circle(41.5, 9, 2.4));
      b.woods(b.circle(40, 3, 1.8));
      b.woods(b.circle(41, 19, 2.2));
      b.woods(b.circle(31, 18, 2.2));
      b.woods(b.circle(19, 18, 2));
      b.woods(b.circle(53, 34, 2.2));
      b.woods(b.circle(58.5, 33, 1.8));

      b.grove(6, 14, 7, 18, "pine", 11);
      b.grove(8, 3, 5, 10, "pine", 12);
      b.grove(58, 10, 6, 14, "oak", 14);
      b.grove(60, 40, 5, 10, "oak", 15);
      b.grove(30, 41, 5, 10, "birch", 16);
      b.grove(4, 27, 3.5, 6, "oak", 17);
      b.rock(33, 3, 1.1);
      b.rock(27, 11, 0.9);
      b.rock(52, 12, 1);
    },
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Niveau 2 — Le domaine coupé en deux : la rivière descend du nord jusqu'à l'étang du milieu ;
  // un seul pont relie l'ouest (la grange) à l'est (le moulin, sur le bief qui sort de l'étang).
  // Les deux chemins du nord longent chacun une rive jusqu'au pont.
  layouts[2] = builder({
    id: "L2-coupe-en-deux-cases",
    level: 2,
    name: "Le domaine coupé en deux",
    seed: 2203,
    pitch: "Une rivière coupe le domaine : deux fronts, un seul pont.",
    hills: [
      { x: 52, z: 6, r: 12, h: 5 },
      { x: 6, z: 40, r: 10, h: 3 },
      { x: 60, z: 44, r: 8, h: 2.5 },
    ],
    fields: [{ poly: [[-6, 46], [14, 46], [12, 52], [-6, 52]], kind: "crop" }],
    make(b) {
      b.stream([[31.4, -1], [32.2, 5], [31.6, 11], [32.4, 18], [32.8, 22.4], [32.2, 26.4]], 1.6, { id: "riviere" });
      b.pond(
        [[27.4, 26.2], [31, 25.2], [35.8, 25.6], [39.6, 28], [41, 31.8], [39.4, 35.6], [35, 37.4], [30, 37.2], [26.6, 35], [25.8, 30.6]],
        { id: "etang", name: "Étang du milieu", island: blob(33.4, 31.4, 1.8, 1.3, 3, 10, 0.12) },
      );
      b.mill({
        x: 55.5,
        z: 34,
        rot: Math.PI / 2,
        reserve: { id: "A", name: "Le moulin", treasures: 3 },
        inflow: [[40.8, 32.6], [43.8, 34.6], [47.6, 36.4], [51.4, 37.2]],
        outflow: [[58.7, 37.4], [61.4, 38.6], [64.8, 39.2]],
        meule: [61.2, 31.6],
        atelier: [60.4, 24.4],
      });
      b.building("grange", { id: "grange", x: 10, z: 28, rot: 0, w: 9, d: 5, door: "n", reserve: { id: "B", name: "La grange", treasures: 3 } });
      b.bridge(32.4, 18, 0, 5.6, 1.5);

      b.node("NW", [8, -0.5], { entry: "land", exit: true, label: "Chemin des champs" });
      b.node("NE", [56, -0.5], { entry: "land", exit: true, label: "Route de la colline" });
      b.node("S", [20, 44.5], { entry: "land", exit: true, label: "Gué du sud" });
      b.node("nw1", [8, 5]);
      b.node("W1", [27, 18]);
      b.node("bw", [29.2, 18]);
      b.node("be", [35.6, 18]);
      b.node("E1", [38, 18]);
      b.node("ne1", [56, 5]);
      b.node("J", [19, 22]);
      b.node("s1", [20, 37]);
      b.edge("NW", "nw1", [[8, 2.5]]); // 0
      b.edge("nw1", "W1", [[10, 7], [21, 7], [25, 9], [26.6, 12], [27, 15]]); // 1
      b.edge("W1", "bw"); // 2
      b.edge("bw", "be", [[32.4, 18]], "bridge"); // 3
      b.edge("be", "E1"); // 4
      b.edge("NE", "ne1", [[56, 2.5]]); // 5
      b.edge("ne1", "E1", [[54, 7], [43, 7], [39.4, 10], [38, 14]]); // 6
      b.edge("E1", "doorA", [[41, 21], [47, 22], [53, 23.6], [55.5, 27]]); // 7
      b.edge("W1", "J", [[25, 21], [22, 22]]); // 8
      b.edge("J", "doorB", [[15, 23], [12, 24]]); // 9
      b.edge("S", "s1", [[20, 41]]); // 10
      b.edge("s1", "J", [[21, 31], [21, 26]]); // 11

      b.trap(1, 0.35);
      b.trap(1, 0.8);
      b.trap(3, 0.5);
      b.trap(6, 0.4);
      b.trap(6, 0.85);
      b.trap(7, 0.35);
      b.trap(7, 0.8);
      b.trap(8, 0.5);
      b.trap(9, 0.5);
      b.trap(11, 0.5);

      // Rives de la rivière de part et d'autre du pont, rocaille de la colline, pré givré des champs.
      b.zone("ice", box(5, 1, 24, 10));
      b.zone("water", box(27, 5, 39, 25));
      b.zone("fire", box(38, 1, 58, 10));
      b.basin(15.4, 17.6, 1.3, 1, 11);
      b.zone("water", box(11, 13, 21, 22));
      b.zone("fire", box(3, 12, 27, 22));
      b.basin(46, 28.2, 1.3, 1, 17);
      b.zone("water", box(41, 24, 50, 31));
      b.zone("fire", box(38, 19, 50, 26));
      b.zone("fire", box(50, 18, 63, 25));
      b.zone("ice", box(50, 25, 63, 31));
      b.zone("water", box(20, 25, 27, 40));
      b.zone("ice", box(10, 31, 20, 44));
      b.woods(b.circle(22, 4, 2.4));
      b.woods(b.circle(29, 12.5, 1.8));
      b.woods(b.circle(35, 22.5, 1.8));
      b.woods(b.circle(35, 10.5, 1.6));
      b.woods(b.circle(16, 4, 1.5));
      b.woods(b.circle(46, 4, 1.5));
      b.woods(b.circle(41, 4, 2.4));
      b.woods(b.circle(15, 40, 2.4));
      b.woods(b.circle(55, 26, 2.2));
      b.woods(b.circle(6, 19, 2.2));

      b.grove(4, 30, 3, 6, "pine", 21);
      b.grove(26, 42, 4, 8, "oak", 22);
      b.grove(4, 42, 4, 8, "oak", 23);
      b.grove(62, 14, 3, 6, "birch", 24);
      b.grove(38, 42, 5, 10, "oak", 26);
      b.grove(56, 42, 3.5, 6, "oak", 27);
      b.rock(47, 11, 1.2);
      b.rock(4, 24, 0.9);
    },
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Niveau 3 — Les trois mauvaises portes : cabane du sorcier au nord-ouest, crypte au nord-est,
  // moulin au sud sur sa mare. Un bosquet sur la butte centrale : aucun passage commun, chaque
  // porte mène à deux réserves.
  layouts[3] = builder({
    id: "L3-trois-portes-cases",
    level: 3,
    name: "Les trois mauvaises portes",
    seed: 3307,
    pitch: "Trois réserves en triangle : cabane du sorcier, crypte et moulin.",
    hills: [
      { x: 32, z: 18, r: 9, h: 4.5 },
      { x: 4, z: 40, r: 8, h: 3 },
      { x: 60, z: 40, r: 8, h: 3 },
    ],
    fields: [{ poly: [[-6, 46], [16, 46], [14, 52], [-6, 52]], kind: "crop" }],
    make(b) {
      b.building("cabane", { id: "cabane", x: 12, z: 11, rot: 0, w: 5, d: 4, door: "s", reserve: { id: "A", name: "La cabane du sorcier", treasures: 2 } });
      b.building("crypte", { id: "crypte", x: 52, z: 11, rot: 0, w: 5, d: 4.2, door: "s", reserve: { id: "B", name: "La crypte", treasures: 2 } });
      b.pond([[16.6, 35.2], [20.4, 33.6], [24.4, 34.2], [26.4, 37.2], [25.2, 40.6], [21.2, 42.2], [17.4, 41], [15.8, 38]], { id: "etang", name: "Mare du moulin" });
      b.mill({
        x: 33,
        z: 37,
        rot: Math.PI / 2 + 0.25,
        reserve: { id: "C", name: "Le moulin", treasures: 2 },
        inflow: [[26.2, 39.2], [29, 40]],
        outflow: [[35.8, 40.2], [40, 41.2], [45, 42.2], [50, 43.4], [54.6, 44.8]],
        meule: [41.4, 35.6],
        atelier: [27.4, 31.4],
      });

      b.node("W", [-0.5, 25], { entry: "land", exit: true, label: "Porte de l'ouest" });
      b.node("N", [33, -0.5], { entry: "land", exit: true, label: "Porte du nord" });
      b.node("E", [64.5, 25], { entry: "land", exit: true, label: "Porte de l'est" });
      b.node("w1", [6, 25]);
      b.node("n1", [33, 5]);
      b.node("e1", [58, 25]);
      b.edge("W", "w1", [[3, 25]]); // 0
      b.edge("w1", "doorA", [[6, 20], [9, 17], [16, 17], [15, 14.8]]); // 1
      b.edge("w1", "doorC", [[7, 31], [12, 31], [15, 27], [22, 27], [27, 31], [33, 31]]); // 2
      b.edge("N", "n1", [[33, 2.5]]); // 3
      b.edge("n1", "doorA", [[27, 5], [22, 7], [21, 12], [17, 14]]); // 4
      b.edge("n1", "doorB", [[39, 5], [44, 7], [45, 12], [49, 15]]); // 5
      b.edge("E", "e1", [[61, 25]]); // 6
      b.edge("e1", "doorB", [[58, 20], [55, 17]]); // 7
      b.edge("e1", "doorC", [[57, 31], [52, 31], [49, 27], [42, 27], [38, 31], [34, 31.4]]); // 8

      b.trap(1, 0.4);
      b.trap(2, 0.25);
      b.trap(2, 0.65);
      b.trap(4, 0.35);
      b.trap(4, 0.75);
      b.trap(5, 0.35);
      b.trap(5, 0.75);
      b.trap(7, 0.5);
      b.trap(8, 0.3);
      b.trap(8, 0.7);

      // Mare du sorcier, bassin de la crypte, mare du moulin ; rocaille au nord, givre à l'est.
      b.basin(5, 11, 1.4, 1.1, 9);
      b.zone("water", box(1, 5, 10, 20));
      b.basin(59, 11.4, 1.4, 1.1, 13);
      b.zone("water", box(54, 5, 63, 20));
      b.zone("water", box(10, 31, 30, 40));
      b.basin(46.4, 34.6, 1.3, 1, 19);
      b.zone("water", box(40, 31, 52, 40));
      b.zone("fire", box(14, 1, 30, 12));
      b.zone("fire", box(36, 1, 50, 12));
      b.zone("ice", box(3, 29, 12, 34));
      b.zone("ice", box(7, 20, 12, 29));
      b.zone("ice", box(52, 29, 61, 34));
      b.zone("ice", box(52, 20, 58, 29));
      b.zone("fire", box(14, 18, 28, 29));
      b.zone("ice", box(36, 14, 50, 29));
      b.woods(b.circle(24, 2.5, 2.4));
      b.woods(b.circle(18, 20, 2));
      b.woods(b.circle(42, 2.5, 2.4));
      b.woods(b.circle(46, 20, 2));
      b.woods(b.circle(3, 31, 2));
      b.woods(b.circle(61, 31, 2));
      b.woods(b.circle(25, 23, 2));
      b.woods(b.circle(40, 23, 2));
      b.woods(b.circle(28.5, 9, 1.8));
      b.woods(b.circle(37.5, 9, 1.8));
      b.woods(b.circle(12, 24, 1.6));
      b.woods(b.circle(52, 24, 1.6));
      b.woods(b.circle(21, 36.6, 1.6));
      b.woods(b.circle(27, 20.6, 1.4));
      b.woods(b.circle(37, 20.6, 1.4));
      b.woods(b.circle(41, 17, 1.6));
      b.woods(b.circle(18, 9, 1.6));
      b.woods(b.circle(49, 7, 1.6));
      b.woods(b.circle(44, 24, 1.5));
      b.woods(b.circle(20, 24, 1.5));

      b.grove(32, 17, 6, 26, "oak", 31);
      b.grove(3, 2, 3, 6, "pine", 32);
      b.grove(61, 2, 3, 6, "pine", 33);
      b.grove(7, 41, 5, 10, "oak", 34);
      b.grove(60, 39, 5, 10, "oak", 35);
      b.rock(28, 13, 1.1);
      b.rock(37, 13, 1);
    },
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Niveau 4 — Les pirates du pédalo : grand étang central, sanctuaire sur l'îlot (ponton au sud),
  // entrepôt sur pilotis au bord nord, moulin sur la rive sud-est ; les nageurs arrivent par le
  // ruisseau d'amont et accostent aux débarcadères. Le chemin fait le tour de l'étang : des berges
  // tout du long, et des îlots rocheux pour le feu et la glace.
  layouts[4] = builder({
    id: "L4-pedalo-cases",
    level: 4,
    name: "Les pirates du pédalo",
    seed: 4409,
    pitch: "L'étang est au centre : les nageurs visent l'îlot et les pilotis.",
    hills: [
      { x: 6, z: 40, r: 10, h: 3.5 },
      { x: 58, z: 4, r: 9, h: 3 },
      { x: 4, z: 4, r: 8, h: 4 },
    ],
    fields: [{ poly: [[40, 46], [70, 46], [70, 52], [40, 52]], kind: "crop" }],
    make(b) {
      b.pond(
        [[14.6, 14.4], [20.4, 11.6], [27.6, 10.8], [34.6, 11.4], [41.2, 13.4], [44.6, 17.6], [44.8, 23.2], [42.6, 28.4], [36.4, 31.8], [28.2, 32.6], [21, 31], [15.6, 27.2], [13.2, 21.4]],
        { id: "grand-etang", name: "Grand étang", island: blob(29.6, 22.2, 4.4, 3.2, 41, 14, 0.12) },
      );
      b.stream([[-1, 22.4], [4.4, 21.8], [9, 21.2], [13.8, 20.8]], 1.4, { id: "amont", raw: true });
      b.building("sanctuaire", { id: "sanctuaire", x: 29.6, z: 21.6, rot: 0, w: 4, d: 3.6, door: "s", island: true, reserve: { id: "A", name: "Le sanctuaire de l'îlot", treasures: 2 } });
      b.building("pilotis", { id: "pilotis", x: 25.2, z: 9.8, rot: 0, w: 6, d: 3.6, door: "n", onWater: true, reserve: { id: "B", name: "L'entrepôt sur pilotis", treasures: 2 } });
      b.mill({
        x: 50,
        z: 30.4,
        rot: Math.PI,
        reserve: { id: "C", name: "Le moulin", treasures: 2 },
        inflow: [[43.4, 27], [45.8, 28.2]],
        outflow: [[46.6, 32.4], [47, 36.4], [47.6, 40.4], [48.4, 44.8]],
        meule: [58.4, 36],
        atelier: [58, 22.4],
      });
      b.pontoon([[29.4, 34], [29.5, 28.6], [29.6, 25.6]], 1.2);
      b.bridge(47.1, 38, 0.06, 3.4, 1.3);
      b.bridge(9.1, 21.2, Math.PI / 2, 3.2, 1.3);

      b.node("N", [37, -0.5], { entry: "land", exit: true, label: "Chemin du nord" });
      b.node("S", [21, 44.5], { entry: "land", exit: true, label: "Plage du sud" });
      b.node("Ww", [-0.5, 22.4], { entry: "water", exit: true, exitKind: "water", label: "Ruisseau d'amont" });
      b.node("E", [64.5, 41], { exit: true, label: "Route de l'est" });
      b.node("n1", [37, 5]);
      b.node("w1", [9, 17.6]);
      b.node("w2", [9, 24.8]);
      b.node("s1", [21, 36]);
      b.node("jetty", [29.4, 35.4]);
      b.node("n3", [49, 20]);
      b.node("s3", [51, 37.4]);
      b.node("land1", [46.4, 24.2]);
      b.node("land2", [30.4, 9.4]);
      b.node("q0", [6.6, 21.6], { water: true });
      b.node("q1", [16.8, 20.8], { water: true });
      b.node("q2", [22.4, 16.4], { water: true });
      b.node("q4", [24.2, 22.8], { water: true });
      b.node("q5", [37.4, 17.8], { water: true });
      b.node("q6", [41.4, 22.6], { water: true });
      b.node("q7", [34.4, 28], { water: true });
      b.node("q8", [28.6, 13], { water: true });
      b.edge("N", "n1", [[37, 2.5]]); // 0
      b.edge("n1", "doorB", [[33, 7], [28, 7]]); // 1
      b.edge("n1", "n3", [[43, 5], [48, 9], [49, 15]]); // 2
      b.edge("n3", "doorC", [[53, 23], [55, 27], [53.8, 30.4]]); // 3
      b.edge("doorB", "w1", [[20, 7], [13, 9], [9, 13]]); // 4
      b.edge("w1", "w2", [[9.1, 21.2]], "bridge"); // 5
      b.edge("w2", "s1", [[10, 31], [15, 35]]); // 6
      b.edge("S", "s1", [[21, 40]]); // 7
      b.edge("s1", "jetty", [[26, 36]]); // 8
      b.edge("jetty", "doorA", [[29.5, 28.6]], "bridge"); // 9
      b.edge("s1", "s3", [[27, 37], [36, 36], [42, 37.4], [45.4, 38], [48.8, 38]], "bridge"); // 10
      b.edge("s3", "doorC", [[55, 36], [55, 32]]); // 11
      b.edge("s3", "E", [[55, 40], [60, 41]]); // 12
      b.edge("land1", "n3", [[47.6, 22]]); // 13
      b.edge("land2", "doorB", [[30, 7]]); // 14
      b.edge("Ww", "q0", [[3.4, 22]], "water"); // 15
      b.edge("q0", "q1", [[11.4, 21.2]], "water"); // 16
      b.edge("q1", "q2", [], "water"); // 17
      b.edge("q2", "q8", [], "water"); // 18
      b.edge("q8", "land2", [], "shore"); // 19
      b.edge("q1", "q4", [[20.6, 22.4]], "water"); // 20
      b.edge("q4", "doorA", [[26.4, 24.8]], "shore"); // 21
      b.edge("q2", "q5", [[30.4, 15.4]], "water"); // 22
      b.edge("q5", "q6", [], "water"); // 23
      b.edge("q6", "land1", [], "shore"); // 24
      b.edge("q4", "q7", [[28.4, 28.2]], "water"); // 25
      b.edge("q7", "q6", [[38.8, 25.6]], "water"); // 26

      b.trap(1, 0.5);
      b.trap(2, 0.4);
      b.trap(3, 0.5);
      b.trap(4, 0.35);
      b.trap(4, 0.75);
      b.trap(6, 0.5);
      b.trap(7, 0.5);
      b.trap(8, 0.5);
      b.trap(10, 0.25);
      b.trap(11, 0.5);
      b.trap(9, 0.45);

      // Berges tout autour de l'étang ; rocaille au nord-est, givre au sud-ouest ; îlots rocheux.
      b.zone("water", box(4, 6, 50, 38));
      b.zone("fire", box(28, 0, 48, 6));
      b.zone("ice", box(2, 3.5, 24, 7));
      b.zone("fire", box(48, 6, 62, 30));
      b.zone("ice", box(1, 24, 20, 41));
      b.zone("fire", box(22, 38, 46, 41));
      b.zone("ice", box(50, 30, 63, 44));
      // Îlots rocheux au bord des voies des nageurs : deux pour l'eau, un pour la glace.
      b.islet("water", 41, 17, 1.5);
      b.islet("ice", 37, 23, 1.4);
      b.islet("water", 19, 25, 1.4);
      b.islet("fire", 23, 29, 1.4);
      b.woods(b.circle(15, 3.5, 2.2));
      b.woods(b.circle(44, 2.5, 2));
      b.woods(b.circle(58, 16, 2.2));
      b.woods(b.circle(5, 33, 2.2));
      b.woods(b.circle(35, 40, 2.2));
      b.woods(b.circle(15, 31, 1.6));
      b.woods(b.circle(58, 41, 2.2));
      b.woods(b.circle(41, 33.6, 1.4));
      b.woods(b.circle(7, 12, 1.8));
      b.woods(b.circle(52, 11, 1.8));
      b.woods(b.circle(25, 39.6, 1.8));
      b.woods(b.circle(7, 29, 1.8));
      b.woods(b.circle(47, 11, 1.8));
      b.woods(b.circle(47.5, 40.5, 1.8));
      b.woods(b.circle(29, 3, 1.6));
      b.woods(b.circle(19, 37, 1.6));
      b.woods(b.circle(12, 6, 1.5));
      b.woods(b.circle(8, 38, 1.5));
      b.woods(b.circle(52, 16, 1.5));
      b.woods(b.circle(58, 38, 1.5));
      b.woods(b.circle(14, 38, 1.5));
      b.woods(b.circle(58, 28, 1.5));

      b.grove(4, 4, 3.5, 8, "pine", 41);
      b.grove(60, 5, 3.5, 8, "oak", 42);
      b.grove(2, 41, 3, 6, "oak", 43);
      b.grove(62, 44, 3, 6, "oak", 44);
      b.rock(40.6, 1.2, 1);
      b.rock(12, 41, 0.9);
    },
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Niveau 5 — Le grand cambriolage : domaine ouvert et asymétrique. Moulin au nord-est au bout
  // du canal de l'étang, grange au sud-ouest, crypte au sud-est ; trois portes, un carrefour au
  // centre et des sorties partout (gué du sud, talus du sud-est).
  layouts[5] = builder({
    id: "L5-grand-cambriolage-cases",
    level: 5,
    name: "Le grand cambriolage",
    seed: 5501,
    pitch: "Trois réserves éloignées, trois portes, des sorties partout.",
    hills: [
      { x: 32, z: 30, r: 7, h: 3 },
      { x: 4, z: 41, r: 8, h: 3 },
      { x: 62, z: 12, r: 8, h: 3 },
    ],
    fields: [{ poly: [[40, 46], [70, 46], [70, 52], [36, 52]], kind: "crop" }],
    make(b) {
      b.pond([[4, 8.4], [9.4, 6.6], [15.4, 7.4], [18.6, 10.6], [17.4, 15], [12.4, 17], [7, 15.8], [3.6, 12.4]], { id: "etang", name: "Étang de l'ouest", island: blob(10.6, 11.8, 1.8, 1.3, 51, 10, 0.12) });
      b.mill({
        x: 47,
        z: 10,
        rot: -Math.PI / 2,
        reserve: { id: "A", name: "Le moulin", treasures: 2 },
        inflow: [[18.4, 11.4], [23, 10.6], [28, 9.8], [34, 8.6], [39, 7.4], [43.4, 6.8]],
        outflow: [[52.4, 6.4], [56.4, 5.4], [60.4, 4.2], [64.8, 3.6]],
        meule: [41, 15.4],
        atelier: [55.6, 11.6],
      });
      b.building("grange", { id: "grange", x: 12, z: 35, rot: 0, w: 8, d: 4.6, door: "n", reserve: { id: "B", name: "La grange", treasures: 2 } });
      b.building("crypte", { id: "crypte", x: 46, z: 39, rot: 0, w: 5, d: 4.2, door: "n", reserve: { id: "C", name: "La crypte", treasures: 2 } });
      b.bridge(24, 10.4, Math.PI / 2, 3.2, 1.4);

      b.node("W", [-0.5, 18], { entry: "land", exit: true, label: "Lisière ouest" });
      b.node("N", [24, -0.5], { entry: "land", exit: true, label: "Chemin du nord" });
      b.node("E", [64.5, 24], { entry: "land", exit: true, label: "Route de l'est" });
      b.node("S", [30, 44.5], { exit: true, label: "Gué du sud" });
      b.node("SE", [64.5, 41], { exit: true, label: "Talus du sud-est" });
      b.node("w1", [6, 18]);
      b.node("n1", [24, 7.4]);
      b.node("n2", [24, 13.4]);
      b.node("H", [32, 24]);
      b.node("e1", [58, 23]);
      b.edge("W", "w1", [[3, 18]]); // 0
      b.edge("w1", "doorB", [[5, 22], [5, 27], [8, 30.2]]); // 1
      b.edge("w1", "H", [[11, 19.5], [18, 19], [24, 21], [28, 24]]); // 2
      b.edge("N", "n1", [[24, 3]]); // 3
      b.edge("n1", "n2", [[24, 10.4]], "bridge"); // 4
      b.edge("n2", "H", [[25, 17], [31, 18], [33, 21]]); // 5
      b.edge("n2", "doorA", [[28, 15], [36, 13.6], [41, 13.4], [45, 14]]); // 6
      b.edge("E", "e1", [[61, 24]]); // 7
      b.edge("e1", "doorA", [[60, 18], [56, 15.6], [51, 15]]); // 8
      b.edge("e1", "doorC", [[59, 28], [56, 31], [51, 32], [47, 34]]); // 9
      b.edge("H", "doorC", [[36, 27], [41, 28], [44, 32]]); // 10
      b.edge("doorB", "S", [[17, 31.4], [22, 34], [26, 38], [29, 42]]); // 11
      b.edge("doorC", "SE", [[51, 35.6], [56, 38], [60, 41]]); // 12

      b.trap(1, 0.5);
      b.trap(2, 0.3);
      b.trap(2, 0.7);
      b.trap(5, 0.5);
      b.trap(6, 0.35);
      b.trap(6, 0.75);
      b.trap(8, 0.5);
      b.trap(9, 0.5);
      b.trap(10, 0.35);
      b.trap(10, 0.75);
      b.trap(11, 0.5);

      // Canal du moulin et étang de l'ouest (berges), mares près de la grange et de la crypte,
      // rocaille au centre et au sud, givre à l'ouest et à l'est.
      b.zone("water", box(18, 4, 46, 17));
      b.basin(2.8, 34.4, 1.3, 1, 21);
      b.zone("water", box(1, 27, 9, 38));
      b.basin(62, 31, 1.2, 1, 17);
      b.zone("water", box(55, 26, 63, 35));
      b.basin(41.4, 38.6, 1.3, 1, 19);
      b.zone("water", box(36, 33, 45, 44));
      b.zone("ice", box(1, 12, 20, 29));
      b.zone("fire", box(24, 16, 42, 31));
      b.zone("fire", box(42, 16, 52, 20));
      b.zone("ice", box(44, 15, 63, 26));
      b.zone("ice", box(48, 29, 58, 38));
      b.zone("fire", box(40, 26, 58, 44), { near: 4.5 });
      b.zone("fire", box(12, 30, 34, 44));
      b.woods(b.circle(28, 3.5, 2));
      b.woods(b.circle(16, 22.5, 2.2));
      b.woods(b.circle(37.5, 17.5, 2));
      b.woods(b.circle(28, 27.5, 2));
      b.woods(b.circle(53, 21, 2.2));
      b.woods(b.circle(44, 30, 2));
      b.woods(b.circle(4, 21, 1.8));
      b.woods(b.circle(24, 38, 2.2));
      b.woods(b.circle(41, 10.5, 1.6));
      b.woods(b.circle(14, 26, 1.5));
      b.woods(b.circle(28, 20, 1.5));
      b.woods(b.circle(50, 18, 1.5));
      b.woods(b.circle(34, 29, 1.5));
      b.woods(b.circle(36, 22, 1.5));
      b.woods(b.circle(26, 34, 1.5));
      b.woods(b.circle(30, 40, 1.5));

      b.grove(33, 31, 3, 6, "oak", 51);
      b.grove(3, 42, 3, 6, "oak", 52);
      b.grove(60, 44, 3, 6, "pine", 53);
      b.grove(14, 1, 3.5, 7, "birch", 55);
      b.grove(46, 42, 4, 8, "oak", 56);
      b.rock(30, 42, 1.1);
      b.rock(60, 12, 1);
    },
  });

  PTMT.layouts = layouts;
  PTMT.layoutHelpers = { rectPoly, blob, box, chaikin, waterSigned, tileClear, polySigned };
})();
