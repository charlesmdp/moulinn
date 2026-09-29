// « Pas touche à mes trésors » — les cinq dispositions du domaine.
//
// Chaque disposition réorganise les mêmes ensembles : moulin + roue + bief, étang + berges + îlot,
// pont + raccords, bâtiments de stockage, bosquets, rochers. Coordonnées en U (1 U = 1,8 m) sur
// une carte de 64 × 44 U : x vers l'est, z vers le sud. La disposition est fixe pendant un niveau
// et reproductible (identifiant + graine).
(function () {
  "use strict";
  const PTMT = (globalThis.PTMT = globalThis.PTMT || {});
  const G = PTMT.geom;

  const W = 64,
    H = 44;

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

  /** Constructeur de disposition : modules, graphe des chemins, supports et emplacements. */
  function builder(def) {
    const L = {
      id: def.id,
      level: def.level,
      name: def.name,
      seed: def.seed,
      size: [W, H],
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
      reserves: [],
      sockets: [],
      trapSlots: [],
      blockers: [],
      split: def.split,
    };
    const b = {
      L,
      node(id, p, opts = {}) {
        L.nodes[id] = { id, x: p[0], z: p[1], water: !!opts.water };
        if (opts.entry) L.entries.push({ id, node: id, kind: opts.entry, label: opts.label || id });
        if (opts.exit) L.exits.push({ id, node: id, kind: opts.exitKind || "land", label: opts.label || id });
        return id;
      },
      /** Arête entre deux nœuds ; `via` = points intermédiaires ; kind land | water | shore | bridge. */
      edge(a, c, via = [], kind = "land") {
        const pts = [[L.nodes[a].x, L.nodes[a].z], ...via, [L.nodes[c].x, L.nodes[c].z]];
        L.edges.push({ id: "e" + L.edges.length, a, b: c, kind, pts });
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
        L.streams.push({ id: opts.id || "ruisseau" + L.streams.length, pts, width, bief: false });
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
      /** Petit îlot rocheux portant un support, au milieu de l'eau. */
      islet(kind, x, z, r = 1.4) {
        L.islets.push({ x, z, r });
        L.sockets.push({ id: "s" + L.sockets.length, kind, x, z, islet: true });
      },
      /** Petit bassin (puits, abreuvoir, mare du sorcier) : de l'eau pour les supports d'eau. */
      basin(x, z, rx, rz, seed = 1) {
        L.ponds.push({ id: "bassin" + L.ponds.length, poly: blob(x, z, rx, rz, seed, 12, 0.1), island: null, name: "Bassin", small: true });
      },
      rock(x, z, s = 1) {
        L.rocks.push({ x, z, s });
      },
      socket(kind, x, z) {
        L.sockets.push({ id: "s" + L.sockets.length, kind, x, z });
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
    return L;
  }

  const layouts = {};

  // ─────────────────────────────────────────────────────────────────────────────
  // Niveau 1 — Bienvenue chez moi : proche de la scène d'origine. Le moulin au bout du grand
  // étang (bief le long du pan est, roue, puis ruisseau vers l'est), la dépendance à l'ouest de la
  // cour, l'allée qui descend du nord et le sentier du ruisseau à l'est.
  layouts[1] = builder({
    id: "L1-bienvenue",
    level: 1,
    name: "Bienvenue chez moi",
    seed: 1101,
    pitch: "Le moulin et sa dépendance, l'allée du nord et le sentier du ruisseau.",
    hills: [
      { x: 10, z: 8, r: 15, h: 7 },
      { x: 26, z: 3, r: 9, h: 3.5 },
      { x: 58, z: 6, r: 10, h: 2.5 },
      { x: 6, z: 30, r: 10, h: 2.5 },
    ],
    fields: [{ poly: [[42, -6], [70, -6], [70, 8], [48, 9]], kind: "crop" }],
    make(b) {
      b.pond(
        [[42.6, 29.4], [41.2, 31.4], [38.2, 31.8], [34.6, 31.2], [31, 32.2], [27.6, 34], [23.2, 35], [18.4, 35.8], [14, 37.6], [10.4, 40.2], [8.2, 44.8], [36.5, 45.5], [41.5, 42.5], [44.8, 38.4], [46, 34], [45, 30.6]],
        { id: "grand-etang", name: "Grand étang", island: blob(24.5, 40.6, 2.4, 1.6, 7, 12, 0.15) },
      );
      b.mill({
        x: 36,
        z: 22,
        rot: -0.24,
        reserve: { id: "A", name: "Le moulin", treasures: 3 },
        inflow: [[42.6, 31.6], [40.6, 28.6], [39.8, 25.6]],
        // Après la roue, le bief repart vers l'est (pas le long du pan : la véranda est là).
        outflow: [[41.3, 23.9], [44.2, 24], [47.4, 22.9], [51, 22], [55, 22.8], [59, 23.2], [64.8, 22.6]],
        atelier: [44.2, 11.2],
      });
      b.building("dependance", { id: "dependance", x: 25.4, z: 23.2, rot: 0.03, w: 10, d: 4, door: "n", doorOffset: 1.8, reserve: { id: "B", name: "La dépendance", treasures: 3 } });

      b.node("N", [36.5, -0.5], { entry: "land", exit: true, label: "Allée du nord" });
      b.node("E", [64.5, 18.2], { entry: "land", exit: true, label: "Sentier du ruisseau" });
      b.node("n1", [35.8, 6]);
      b.node("fork", [34.6, 10.4]);
      b.node("C", [32.4, 16.2]);
      b.node("e1", [56.2, 18.4]);
      b.node("e2", [48.6, 16.6]);
      b.node("e3", [41.4, 15]);
      b.edge("N", "n1", [[36.3, 2.8]]); // 0
      b.edge("n1", "fork", [[35.2, 8.3]]); // 1
      b.edge("fork", "C", [[33.6, 13.2]]); // 2
      b.edge("C", "doorA", [[31.9, 19.4]]); // 3
      b.edge("fork", "doorB", [[30.8, 12.6], [28.4, 16.6]]); // 4
      b.edge("C", "doorB", [[29.8, 18.4]]); // 5
      b.edge("E", "e1", [[60.4, 18.8]]); // 6
      b.edge("e1", "e2", [[52.4, 17.6]]); // 7
      b.edge("e2", "e3", [[45, 15.4]]); // 8
      b.edge("e3", "C", [[37.4, 14.6], [34.4, 15.2]]); // 9

      b.trap(0, 0.5);
      b.trap(1, 0.5);
      b.trap(4, 0.5);
      b.trap(5, 0.45);
      b.trap(6, 0.5);
      b.trap(7, 0.5);
      b.trap(9, 0.45);
      b.trap(3, 0.35);

      b.socket("fire", 33.2, 4.4);
      b.socket("ice", 39, 7.6);
      b.socket("fire", 31.4, 9.4);
      b.socket("ice", 40.2, 9.6);
      b.basin(37.8, 11.2, 1.2, 0.9, 3);
      b.socket("water", 36.4, 13.2);
      b.socket("fire", 27.4, 14);
      b.socket("ice", 23.4, 18.4);
      b.socket("ice", 26.2, 11.4);
      b.socket("fire", 41.4, 12.4);
      b.socket("ice", 51.6, 14.4);
      b.socket("fire", 58.4, 15.8);
      b.socket("fire", 45.6, 13);
      b.socket("water", 42.6, 26.4);
      b.socket("water", 29.6, 30.6);
      b.socket("fire", 32.4, 28.4);
      b.socket("water", 44.8, 21.6);
      b.socket("water", 50.8, 19.4);
      b.socket("water", 57.2, 20.8);
      b.socket("water", 36.8, 30.2);
      b.socket("ice", 28.6, 27.4);

      b.grove(10, 8, 9, 34, "pine", 11);
      b.grove(20, 4.5, 5.5, 12, "oak", 12);
      b.grove(8, 24, 7, 16, "oak", 13);
      b.grove(52, 7, 7.5, 18, "oak", 14);
      b.grove(56, 33, 8, 20, "oak", 15);
      b.grove(48, 39, 5, 10, "birch", 16);
      b.grove(2, 37, 5, 8, "oak", 17);
      b.rock(47.4, 13.6, 1.1);
      b.rock(28.6, 10, 0.8);
      b.rock(53.5, 25.8, 1);
    },
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Niveau 2 — Le domaine coupé en deux : la rivière descend du nord au milieu du domaine jusqu'à
  // l'étang ; le moulin passe au bord est, sur le bief qui sort de l'étang ; la grange à l'ouest.
  layouts[2] = builder({
    id: "L2-coupe-en-deux",
    level: 2,
    name: "Le domaine coupé en deux",
    seed: 2203,
    pitch: "Une rivière coupe le domaine : deux fronts, un seul pont.",
    hills: [
      { x: 8, z: 6, r: 10, h: 4 },
      { x: 56, z: 6, r: 11, h: 5 },
      { x: 14, z: 40, r: 10, h: 3 },
    ],
    fields: [
      { poly: [[-6, -6], [20, -6], [16, 3], [-6, 4]], kind: "crop" },
      { poly: [[44, 46], [70, 46], [70, 52], [40, 52]], kind: "grass" },
    ],
    make(b) {
      b.stream([[30.8, -1], [31.6, 5], [32.6, 11], [33.4, 16], [32.8, 21], [32.2, 26.4]], 1.5, { id: "riviere" });
      b.pond([[27.6, 26.2], [31.8, 25.2], [36.6, 26], [40.2, 28.6], [41.4, 32.4], [39.6, 36.2], [35.4, 38], [30.4, 37.6], [26.8, 35.2], [25.6, 30.8]], { id: "etang", name: "Étang du milieu", island: blob(33.2, 31.6, 1.6, 1.2, 3, 10, 0.12) });
      b.mill({
        x: 55,
        z: 31,
        rot: Math.PI / 2,
        reserve: { id: "A", name: "Le moulin", treasures: 3 },
        inflow: [[40.2, 33], [44, 34.2], [48, 34.6], [51.4, 34.4]],
        outflow: [[55.6, 34.6], [58.6, 35.4], [61.6, 36.8], [64.8, 37.6]],
        atelier: [47.6, 40.4],
      });
      b.building("grange", { id: "grange", x: 9.4, z: 22, rot: Math.PI / 2, w: 9, d: 5, door: "n", reserve: { id: "B", name: "La grange", treasures: 3 } });
      b.bridge(33.2, 14.6, 0.04, 3.6, 1.4);
      b.bridge(61.2, 36.4, 1.9, 2.8, 1.3);

      b.node("NW", [12, -0.5], { entry: "land", exit: true, label: "Chemin des champs" });
      b.node("NE", [49, -0.5], { entry: "land", exit: true, label: "Route de la colline" });
      b.node("S", [18, 44.5], { entry: "land", exit: true, label: "Gué du sud" });
      b.node("SE", [64.5, 42], { entry: "land", exit: true, label: "Sortie de la vallée" });
      b.node("w1", [13.4, 8]);
      b.node("w2", [15.6, 14.6]);
      b.node("bw", [28.4, 14.4]);
      b.node("be", [38, 14.8]);
      b.node("e1", [47.8, 8.4]);
      b.node("e2", [49.4, 18.6]);
      b.node("s1", [19.6, 33.8]);
      b.node("s2", [17.2, 26.4]);
      b.node("se1", [61.6, 40]);
      b.edge("NW", "w1", [[12.8, 4]]); // 0
      b.edge("w1", "w2", [[14.2, 11.2]]); // 1
      b.edge("w2", "doorB", [[15.2, 18.6]]); // 2
      b.edge("w2", "bw", [[21.6, 14.2]]); // 3
      b.edge("bw", "be", [[33.2, 14.6]], "bridge"); // 4
      b.edge("NE", "e1", [[48.6, 4]]); // 5
      b.edge("e1", "e2", [[48.4, 13.2]]); // 6
      b.edge("be", "e2", [[43.2, 16.4]]); // 7
      b.edge("e2", "doorA", [[52.6, 23.4]]); // 8
      b.edge("S", "s1", [[18.6, 39.4]]); // 9
      b.edge("s1", "s2", [[18.4, 30]]); // 10
      b.edge("s2", "doorB", [[15.2, 24]]); // 11
      b.edge("s1", "bw", [[23.4, 26.6], [25.4, 20.4]]); // 12
      b.edge("SE", "se1", [[63.4, 41.2]]); // 13
      b.edge("se1", "doorA", [[61.2, 36.4], [60.8, 31], [58.4, 27.4]], "bridge"); // 14

      b.trap(1, 0.5);
      b.trap(3, 0.55);
      b.trap(4, 0.5);
      b.trap(6, 0.5);
      b.trap(8, 0.45);
      b.trap(10, 0.5);
      b.trap(12, 0.45);
      b.trap(7, 0.5);

      b.socket("fire", 10.2, 11.6);
      b.socket("ice", 17.8, 9.4);
      b.basin(19.4, 6.2, 1.2, 0.9, 25);
      b.socket("water", 17.4, 5.4);
      b.socket("fire", 19, 18.6);
      b.socket("ice", 11, 14.6);
      b.socket("water", 31, 18.8);
      b.socket("water", 30.2, 9.4);
      b.socket("fire", 24.6, 11.2);
      b.socket("ice", 23.2, 20.8);
      b.basin(19.4, 24.6, 1.9, 1.4, 5);
      b.socket("water", 19.6, 22.2);
      b.socket("fire", 21.4, 36.8);
      b.socket("water", 24.2, 33.4);
      b.socket("ice", 14.6, 30.8);
      b.socket("water", 36.4, 18.8);
      b.socket("water", 35.4, 9.8);
      b.socket("fire", 44.8, 11.2);
      b.socket("ice", 52.4, 13.6);
      b.basin(52.8, 17.4, 1.1, 0.9, 27);
      b.socket("water", 51.2, 15.9);
      b.socket("ice", 63.2, 28.6);
      b.socket("fire", 45, 21.6);
      b.socket("ice", 53.6, 21.4);
      b.socket("water", 46.4, 32.2);
      b.socket("fire", 57, 39.6);
      b.socket("water", 63, 34.6);
      b.socket("ice", 44.6, 28);

      b.grove(6, 6, 7, 16, "pine", 21);
      b.grove(22, 4, 6, 12, "oak", 22);
      b.grove(4, 36, 6, 14, "oak", 23);
      b.grove(41, 4, 4.5, 10, "birch", 24);
      b.grove(59, 13, 5.5, 14, "oak", 25);
      b.grove(48, 44, 4, 8, "oak", 26);
      b.grove(28, 42, 4, 8, "oak", 27);
      b.rock(26, 20, 1.2);
      b.rock(40.4, 22.6, 0.9);
    },
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Niveau 3 — Les trois mauvaises portes : cabane du sorcier au nord-ouest, crypte au nord-est,
  // moulin au sud sur sa mare. Un bosquet sur la butte centrale : aucun passage commun.
  layouts[3] = builder({
    id: "L3-trois-portes",
    level: 3,
    name: "Les trois mauvaises portes",
    seed: 3307,
    pitch: "Trois réserves en triangle : cabane du sorcier, crypte et moulin.",
    hills: [
      { x: 32, z: 19, r: 8, h: 4.5 },
      { x: 4, z: 4, r: 8, h: 3 },
      { x: 60, z: 42, r: 8, h: 3 },
    ],
    fields: [{ poly: [[-6, 46], [22, 46], [20, 52], [-6, 52]], kind: "crop" }],
    make(b) {
      b.building("cabane", { id: "cabane", x: 13, z: 11, rot: 0.3, w: 5, d: 4, door: "s", reserve: { id: "A", name: "La cabane du sorcier", treasures: 2 } });
      b.building("crypte", { id: "crypte", x: 51.5, z: 11.4, rot: -0.35, w: 5, d: 4.2, door: "s", reserve: { id: "B", name: "La crypte", treasures: 2 } });
      b.pond([[20.4, 33.4], [24.6, 31.8], [28.2, 32.4], [29.6, 35.4], [28.4, 38.6], [24.4, 40.4], [20.6, 39.2], [19.4, 36.2]], { id: "etang", name: "Mare du moulin" });
      b.mill({
        x: 34,
        z: 35,
        rot: Math.PI / 2,
        reserve: { id: "C", name: "Le moulin", treasures: 2 },
        inflow: [[28.8, 37.8], [30.4, 38.6]],
        outflow: [[34.6, 38.9], [38.6, 40], [42.4, 41.4], [46, 42.6], [49.4, 44.8]],
        atelier: [40.8, 28.6],
      });
      b.bridge(43.6, 41.8, 1.26, 2.8, 1.3);

      b.node("W", [-0.5, 24], { entry: "land", exit: true, label: "Porte de l'ouest" });
      b.node("N", [31, -0.5], { entry: "land", exit: true, label: "Porte du nord" });
      b.node("E", [64.5, 25], { entry: "land", exit: true, label: "Porte de l'est" });
      b.node("S", [44.5, 44.5], { entry: "land", exit: true, label: "Sentier du sud" });
      b.node("w1", [8.4, 22]);
      b.node("m1", [20.8, 27.6]);
      b.node("n1", [30.2, 6.6]);
      b.node("n2", [23, 9.8]);
      b.node("n3", [39.6, 8.2]);
      b.node("e1", [56.6, 23.6]);
      b.node("m2", [45, 28.4]);
      b.node("s1", [42.6, 38.6]);
      b.edge("W", "w1", [[4.2, 23.4]]); // 0
      b.edge("w1", "doorA", [[9.6, 18.4]]); // 1
      b.edge("w1", "m1", [[14.6, 24.8]]); // 2
      b.edge("m1", "doorC", [[26, 29], [30.6, 30.4]]); // 3
      b.edge("N", "n1", [[30.6, 3.4]]); // 4
      b.edge("n1", "n2", [[26.4, 8.4]]); // 5
      b.edge("n2", "doorA", [[18.4, 13.4], [15.6, 15]]); // 6
      b.edge("n1", "n3", [[35, 7.4]]); // 7
      b.edge("n3", "doorB", [[45.4, 10.6], [49.8, 14.8]]); // 8
      b.edge("E", "e1", [[60.8, 24.8]]); // 9
      b.edge("e1", "doorB", [[54.6, 19.4]]); // 10
      b.edge("e1", "m2", [[50.8, 26.4]]); // 11
      b.edge("m2", "doorC", [[40, 30.2], [36.4, 30.8]]); // 12
      b.edge("S", "s1", [[43.6, 41.8]], "bridge"); // 13
      b.edge("s1", "m2", [[43.4, 33.6]]); // 14
      b.edge("s1", "doorC", [[39.8, 34], [37.2, 31.2]]); // 15

      b.trap(1, 0.45);
      b.trap(2, 0.5);
      b.trap(5, 0.5);
      b.trap(7, 0.5);
      b.trap(8, 0.4);
      b.trap(10, 0.5);
      b.trap(11, 0.5);
      b.trap(12, 0.4);
      b.trap(14, 0.5);

      b.socket("fire", 5.4, 19);
      b.socket("ice", 9.8, 27);
      b.socket("fire", 17.2, 16.8);
      b.socket("fire", 17.6, 5.4);
      b.socket("ice", 25.8, 13.4);
      b.socket("fire", 34.2, 3.6);
      b.socket("ice", 36.8, 11.4);
      b.socket("fire", 44.2, 6.2);
      b.socket("ice", 46.6, 16.6);
      b.socket("ice", 58, 17.8);
      b.socket("fire", 59.6, 28.6);
      b.socket("ice", 49.4, 22.4);
      b.socket("fire", 56.8, 9.6);
      b.socket("fire", 38.8, 25.4);
      b.socket("water", 36.6, 41.6);
      b.socket("ice", 25.8, 26.6);
      b.socket("water", 18.6, 31.8);
      b.socket("fire", 16.4, 29.6);
      b.socket("water", 40.6, 43.4);
      b.socket("water", 47.8, 41.4);
      b.socket("ice", 53.6, 29.4);
      b.socket("ice", 6.2, 14.2);
      b.basin(14.8, 20.4, 1.5, 1.1, 9);
      b.socket("water", 12.6, 19.4);
      b.basin(48.8, 19.8, 1.3, 1, 13);
      b.socket("water", 50.4, 17.8);
      b.basin(26.4, 3.2, 1.3, 1, 15);
      b.socket("water", 25.2, 5.8);
      b.socket("fire", 40.2, 37.6);
      b.basin(47.8, 25.2, 1.1, 0.8, 29);
      b.socket("water", 46.4, 24.2);
      b.socket("ice", 45.6, 34.6);

      b.grove(32, 19, 6.5, 26, "oak", 31);
      b.grove(4, 8, 5, 12, "pine", 32);
      b.grove(60, 6, 6, 14, "pine", 33);
      b.grove(8, 38, 7, 16, "oak", 34);
      b.grove(58, 38, 6, 12, "oak", 35);
      b.grove(22, 44, 4, 6, "birch", 36);
      b.rock(30.8, 26, 1.2);
      b.rock(41.2, 20.4, 1);
      b.rock(21.4, 20.6, 0.9);
    },
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Niveau 4 — Les pirates du pédalo : grand étang central, sanctuaire sur l'îlot (ponton au sud),
  // entrepôt sur pilotis au bord nord, moulin sur la rive sud-est ; les nageurs arrivent par le
  // ruisseau d'amont et accostent aux débarcadères.
  layouts[4] = builder({
    id: "L4-pedalo",
    level: 4,
    name: "Les pirates du pédalo",
    seed: 4409,
    pitch: "L'étang est au centre : les nageurs visent l'îlot et les pilotis.",
    hills: [
      { x: 8, z: 40, r: 10, h: 3.5 },
      { x: 58, z: 4, r: 9, h: 3 },
      { x: 4, z: 4, r: 8, h: 4 },
    ],
    fields: [{ poly: [[18, -6], [44, -6], [42, 0], [20, 0]], kind: "crop" }],
    make(b) {
      b.pond(
        [[14.6, 14.4], [20.4, 11.6], [27.6, 10.8], [34.6, 11.4], [41.2, 13.4], [44.6, 17.6], [44.8, 23.2], [42.6, 28.4], [36.4, 31.8], [28.2, 32.6], [21, 31], [15.6, 27.2], [13.2, 21.4]],
        { id: "grand-etang", name: "Grand étang", island: blob(29.6, 22.2, 4.4, 3.2, 41, 14, 0.12) },
      );
      b.stream([[-1, 22.4], [4.4, 21.8], [9, 21.2], [13.8, 20.8]], 1.3, { id: "amont" });
      b.building("sanctuaire", { id: "sanctuaire", x: 29.6, z: 21.6, rot: 0, w: 4, d: 3.6, door: "s", island: true, reserve: { id: "A", name: "Le sanctuaire de l'îlot", treasures: 2 } });
      b.building("pilotis", { id: "pilotis", x: 25.2, z: 9.4, rot: 0.06, w: 6, d: 3.6, door: "n", onWater: true, reserve: { id: "B", name: "L'entrepôt sur pilotis", treasures: 2 } });
      b.mill({
        x: 48,
        z: 30.4,
        rot: Math.PI,
        reserve: { id: "C", name: "Le moulin", treasures: 2 },
        inflow: [[42.2, 26.8], [43.8, 27.6]],
        outflow: [[44.8, 31.8], [45.4, 36], [46.4, 40.2], [47.4, 44.8]],
        atelier: [57.4, 24.4],
      });
      b.pontoon([[29.4, 32.4], [29.5, 28.6], [29.6, 25.6]], 1.2);
      b.bridge(45.6, 37.6, 0.1, 2.8, 1.3);
      b.bridge(9.4, 21.4, 1.52, 2.8, 1.3);

      b.node("W", [-0.5, 26.4], { entry: "land", exit: true, label: "Rive ouest" });
      b.node("Ww", [-0.5, 22.4], { entry: "water", exit: true, exitKind: "water", label: "Ruisseau d'amont" });
      b.node("N", [36, -0.5], { entry: "land", exit: true, label: "Chemin du nord" });
      b.node("S", [22, 44.5], { entry: "land", exit: true, label: "Plage du sud" });
      b.node("E", [64.5, 32], { entry: "land", exit: true, label: "Route de l'est" });
      b.node("w1", [8.4, 26.2]);
      b.node("w2", [14, 31.6]);
      b.node("n1", [34.4, 4.2]);
      b.node("n2", [41.8, 7.4]);
      b.node("n3", [47.6, 20.6]);
      b.node("s1", [24.4, 37.2]);
      b.node("jetty", [29.4, 33.6]);
      b.node("e1", [57.4, 31.8]);
      b.node("s3", [50.6, 36.6]);
      b.node("land1", [45.6, 24.2]);
      b.node("land2", [30, 10.2]);
      b.node("q0", [7, 21.4], { water: true });
      b.node("q1", [16.8, 20.8], { water: true });
      b.node("q2", [22.4, 16.6], { water: true });
      b.node("q4", [24.4, 22.8], { water: true });
      b.node("q5", [37.4, 17.8], { water: true });
      b.node("q6", [41.2, 22.6], { water: true });
      b.node("q7", [34.4, 27.8], { water: true });
      b.node("q8", [28.6, 13], { water: true });
      b.edge("W", "w1", [[4, 26.4]]); // 0
      b.edge("w1", "w2", [[10.6, 29]]); // 1
      b.edge("w2", "s1", [[18.2, 34.8]]); // 2
      b.edge("S", "s1", [[22.8, 40.8]]); // 3
      b.edge("s1", "jetty", [[27, 35.4]]); // 4
      b.edge("jetty", "doorA", [[29.5, 28.6]], "bridge"); // 5
      b.edge("N", "n1", [[35.6, 2]]); // 6
      b.edge("n1", "doorB", [[30.4, 4.6], [27.8, 5.4]]); // 7
      b.edge("n1", "n2", [[38, 5]]); // 8
      b.edge("n2", "n3", [[46.4, 12.4], [47.4, 16.4]]); // 9
      b.edge("n3", "doorC", [[51.2, 23.2], [52.4, 27.4]]); // 10
      b.edge("E", "e1", [[60.8, 32.2]]); // 11
      b.edge("e1", "doorC", [[54.8, 31.2]]); // 12
      b.edge("s1", "s3", [[33.6, 38.4], [42.6, 37.8], [45.6, 37.6]], "bridge"); // 13
      b.edge("s3", "doorC", [[52.8, 34]]); // 14
      b.edge("w1", "doorB", [[9.6, 23.4], [9.4, 21.3], [10.4, 16.6], [15.8, 9.6], [21.2, 6.4]], "bridge"); // 15
      b.edge("land1", "n3", [[45.8, 21.4]]); // 16
      b.edge("land2", "doorB", [[29.8, 6.2]]); // 17
      b.edge("Ww", "q0", [[3.4, 22]], "water"); // 18
      b.edge("q0", "q1", [[11.4, 21.2]], "water"); // 19
      b.edge("q1", "q2", [], "water"); // 20
      b.edge("q2", "q8", [], "water"); // 21
      b.edge("q8", "land2", [], "shore"); // 22
      b.edge("q1", "q4", [[20.6, 22.4]], "water"); // 23
      b.edge("q4", "doorA", [[26.4, 24.8]], "shore"); // 24
      b.edge("q2", "q5", [[30.4, 15.4]], "water"); // 25
      b.edge("q5", "q6", [], "water"); // 26
      b.edge("q6", "land1", [], "shore"); // 27
      b.edge("q4", "q7", [[28.4, 28.2]], "water"); // 28
      b.edge("q7", "q6", [[38.8, 25.6]], "water"); // 29

      b.trap(1, 0.5);
      b.trap(2, 0.5);
      b.trap(4, 0.5);
      b.trap(7, 0.5);
      b.trap(9, 0.35);
      b.trap(10, 0.5);
      b.trap(12, 0.5);
      b.trap(13, 0.5);
      b.trap(15, 0.55);
      b.trap(5, 0.45);

      b.socket("fire", 6.4, 30.2);
      b.socket("ice", 13, 25.6);
      b.socket("water", 11.8, 18.2);
      b.socket("fire", 19.2, 38.8);
      b.socket("ice", 27.2, 40.2);
      b.socket("water", 25.2, 33.6);
      b.socket("water", 34.2, 33.6);
      b.socket("fire", 31.6, 1.8);
      b.socket("ice", 21, 3.6);
      b.socket("water", 18.6, 10.6);
      b.socket("water", 31.6, 8.6);
      b.socket("fire", 40.4, 10.4);
      b.socket("ice", 50.2, 13.6);
      b.socket("water", 44.4, 14.8);
      b.socket("water", 44.2, 25.4);
      b.socket("fire", 53.4, 22.8);
      b.socket("ice", 57.4, 36.4);
      b.socket("fire", 38.6, 35.2);
      b.socket("ice", 8.2, 12.2);
      b.socket("fire", 52.2, 40.2);
      b.socket("fire", 56.4, 27.6);
      b.basin(59.4, 28.6, 1.2, 0.9, 43);
      b.socket("water", 61.2, 29.8);
      b.socket("water", 41.2, 31.4);
      b.islet("fire", 22.6, 26.4, 1.5);
      b.islet("ice", 36.4, 24.8, 1.4);

      b.grove(4, 4, 6, 14, "pine", 41);
      b.grove(58, 6, 6, 14, "oak", 42);
      b.grove(8, 40, 7, 16, "oak", 43);
      b.grove(58, 42, 5, 10, "oak", 44);
      b.grove(61, 20, 3.5, 8, "birch", 45);
      b.grove(36, 43, 4, 6, "oak", 46);
      b.rock(40.6, 6.2, 1);
      b.rock(16.4, 35, 0.9);
    },
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Niveau 5 — Le grand cambriolage : domaine ouvert et asymétrique. Moulin au nord-est au bout
  // du canal de l'étang, grange au sud-ouest, crypte au sud-est ; quatre accès, six sorties.
  layouts[5] = builder({
    id: "L5-grand-cambriolage",
    level: 5,
    name: "Le grand cambriolage",
    seed: 5501,
    pitch: "Trois réserves éloignées, quatre accès, des sorties partout.",
    hills: [
      { x: 30, z: 27, r: 8, h: 3.5 },
      { x: 4, z: 41, r: 8, h: 3 },
      { x: 62, z: 44, r: 8, h: 3 },
    ],
    fields: [
      { poly: [[-6, -6], [22, -6], [22, -1], [-6, 0]], kind: "crop" },
      { poly: [[40, 46], [70, 46], [70, 52], [36, 52]], kind: "crop" },
    ],
    make(b) {
      b.pond([[7.2, 11.4], [12.4, 9.2], [18.4, 10.2], [20.8, 14.2], [19, 18.6], [13.4, 20.4], [8.2, 18.6], [5.8, 15]], { id: "etang", name: "Étang de l'ouest", island: blob(13.4, 14.6, 1.8, 1.3, 51, 10, 0.12) });
      b.mill({
        x: 43.4,
        z: 9.8,
        rot: -Math.PI / 2,
        reserve: { id: "A", name: "Le moulin", treasures: 2 },
        inflow: [[20.4, 14.8], [26, 12.6], [31.4, 10.6], [35.6, 8.6], [39.6, 6.6], [43, 6.4]],
        outflow: [[48, 6.6], [52, 5.6], [57, 4.2], [64.8, 3.4]],
        atelier: [46.6, 20.2],
      });
      b.building("grange", { id: "grange", x: 13.6, z: 34.6, rot: -0.2, w: 8, d: 4.6, door: "n", reserve: { id: "B", name: "La grange", treasures: 2 } });
      b.building("crypte", { id: "crypte", x: 51.6, z: 34.4, rot: 0.25, w: 5, d: 4.2, door: "n", reserve: { id: "C", name: "La crypte", treasures: 2 } });
      b.bridge(28.4, 11.8, 1.25, 2.8, 1.3);
      b.bridge(34.2, 9.1, 1.1, 2.8, 1.3);

      b.node("W", [-0.5, 27], { entry: "land", exit: true, label: "Lisière ouest" });
      b.node("N", [27.6, -0.5], { entry: "land", exit: true, label: "Chemin du nord" });
      b.node("E", [64.5, 18], { entry: "land", exit: true, label: "Route de l'est" });
      b.node("S", [33, 44.5], { entry: "land", exit: true, label: "Gué du sud" });
      b.node("NW", [-0.5, 5], { exit: true, label: "Bois du nord-ouest" });
      b.node("SE", [64.5, 41], { exit: true, label: "Talus du sud-est" });
      b.node("w1", [7.4, 26.6]);
      b.node("n1", [27.2, 5.6]);
      b.node("c1", [24.6, 20.2]);
      b.node("c2", [38.8, 22.8]);
      b.node("e1", [55.8, 19.4]);
      b.node("s1", [32.4, 37.6]);
      b.node("nw1", [3.6, 7.4]);
      b.edge("W", "w1", [[3.6, 27]]); // 0
      b.edge("w1", "doorB", [[10.6, 29.6]]); // 1
      b.edge("w1", "c1", [[14.4, 23.6], [19.8, 21.4]]); // 2
      b.edge("N", "n1", [[27.4, 2.8]]); // 3
      b.edge("n1", "doorA", [[31.4, 7], [34.2, 9.1], [37.8, 13.2]], "bridge"); // 4
      b.edge("n1", "c1", [[28.4, 11.8], [26.4, 15.6]], "bridge"); // 5
      b.edge("c1", "c2", [[31.6, 19.4], [35.6, 20.8]]); // 6
      b.edge("c2", "doorA", [[41, 16.8]]); // 7
      b.edge("E", "e1", [[60.4, 18.4]]); // 8
      b.edge("e1", "doorA", [[50, 15.4]]); // 9
      b.edge("e1", "doorC", [[55.4, 25.2]]); // 10
      b.edge("c2", "doorC", [[45.4, 26.6]]); // 11
      b.edge("S", "s1", [[33, 41.2]]); // 12
      b.edge("s1", "doorB", [[24.4, 34.8], [20, 30.4], [16.2, 30.2]]); // 13
      b.edge("s1", "doorC", [[40.4, 35.4], [45.8, 32]]); // 14
      b.edge("s1", "c2", [[36, 30]]); // 15
      b.edge("NW", "nw1", [[1.6, 6.2]]); // 16
      b.edge("nw1", "w1", [[3.2, 16], [5.4, 22.6]]); // 17
      b.edge("SE", "doorC", [[58.4, 38.6], [56.6, 33.2], [54.8, 31.2]]); // 18

      b.trap(1, 0.5);
      b.trap(2, 0.4);
      b.trap(4, 0.25);
      b.trap(6, 0.5);
      b.trap(9, 0.4);
      b.trap(10, 0.5);
      b.trap(13, 0.5);
      b.trap(14, 0.5);
      b.trap(15, 0.5);
      b.trap(17, 0.5);

      b.socket("fire", 6.6, 30.6);
      b.basin(4.4, 33.6, 1.4, 1.1, 57);
      b.socket("water", 7.8, 33.2);
      b.socket("ice", 10.4, 23.4);
      b.socket("water", 16.6, 20.4);
      b.socket("fire", 19.4, 27.8);
      b.socket("ice", 21.4, 38.4);
      b.basin(20.2, 36.8, 1.5, 1.1, 21);
      b.socket("water", 22.6, 36.2);
      b.socket("water", 23.2, 16.8);
      b.socket("fire", 31.6, 3.2);
      b.socket("ice", 23.6, 7.6);
      b.socket("water", 31.8, 12.4);
      b.socket("fire", 45.4, 16.8);
      b.socket("ice", 54.4, 14.2);
      b.socket("water", 50, 8.2);
      b.socket("ice", 59.6, 22.8);
      b.socket("fire", 49.4, 24.4);
      b.socket("ice", 35, 25.4);
      b.socket("fire", 28.6, 31.2);
      b.socket("ice", 38.4, 32.8);
      b.socket("fire", 45.8, 39.2);
      b.socket("ice", 58, 29.6);
      b.socket("fire", 26.4, 40.4);
      b.socket("water", 8.6, 8.4);
      b.socket("fire", 42.4, 20.4);
      b.basin(58.2, 24.6, 1.2, 0.9, 17);
      b.socket("fire", 52.8, 22.2);
      b.socket("water", 58.6, 27.2);
      b.socket("fire", 43.4, 30.2);
      b.basin(35.4, 16.6, 1.2, 0.9, 19);
      b.socket("water", 36.8, 18.6);
      b.basin(51.2, 10.8, 1.1, 0.9, 23);
      b.socket("water", 52.8, 12.2);

      b.grove(30, 27, 5, 16, "oak", 51);
      b.grove(4, 41, 6, 12, "oak", 52);
      b.grove(56, 7, 6.5, 14, "pine", 53);
      b.grove(62, 30, 3.5, 8, "oak", 54);
      b.grove(18, 3, 4.5, 10, "birch", 55);
      b.grove(44, 43, 4, 8, "oak", 56);
      b.rock(26, 30.4, 1.1);
      b.rock(58.6, 25.6, 0.9);
      b.rock(40.6, 28.6, 1);
    },
  });

  PTMT.layouts = layouts;
  PTMT.layoutHelpers = { rectPoly, blob };
})();
