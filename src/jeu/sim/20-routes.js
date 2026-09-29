// « Pas touche à mes trésors » — graphe des chemins, trajets et vérification des dispositions.
//
// Les ennemis suivent des polylignes calculées sur le graphe de la disposition : chemins terrestres
// (land, bridge), voies d'eau (water) et débarcadères (shore). Les nageurs empruntent tout ;
// les autres seulement la terre et les ponts.
(function () {
  "use strict";
  const PTMT = (globalThis.PTMT = globalThis.PTMT || {});
  const G = PTMT.geom;

  function buildGraph(L) {
    const adj = new Map();
    for (const id of Object.keys(L.nodes)) adj.set(id, []);
    const edges = L.edges.map((e) => {
      const line = G.polyline(e.pts);
      const E = { id: e.id, a: e.a, b: e.b, kind: e.kind, pts: e.pts, line, length: line.length };
      adj.get(e.a).push({ edge: E, to: e.b, forward: true });
      adj.get(e.b).push({ edge: E, to: e.a, forward: false });
      return E;
    });
    return { L, adj, edges, byId: new Map(edges.map((e) => [e.id, e])) };
  }

  function allowed(kind, mover) {
    if (kind === "land" || kind === "bridge") return true;
    return mover === "swimmer";
  }
  function edgeCost(E, mover, speeds) {
    if (mover !== "swimmer") return E.length;
    const v = E.kind === "water" ? speeds.water : speeds.land;
    return E.length / v;
  }

  /** Dijkstra depuis un ou plusieurs départs { node, cost } ; renvoie { dist, prev }. */
  function dijkstra(graph, starts, mover = "walker", speeds = { land: 1, water: 1 }) {
    const dist = new Map(),
      prev = new Map(),
      done = new Set();
    const open = [];
    for (const s of starts) {
      if (!dist.has(s.node) || s.cost < dist.get(s.node)) {
        dist.set(s.node, s.cost || 0);
        prev.set(s.node, s.via || null);
        open.push(s.node);
      }
    }
    while (open.length) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (dist.get(open[i]) < dist.get(open[bi])) bi = i;
      const u = open.splice(bi, 1)[0];
      if (done.has(u)) continue;
      done.add(u);
      for (const step of graph.adj.get(u) || []) {
        if (!allowed(step.edge.kind, mover)) continue;
        const nd = dist.get(u) + edgeCost(step.edge, mover, speeds);
        if (!dist.has(step.to) || nd < dist.get(step.to) - 1e-9) {
          dist.set(step.to, nd);
          prev.set(step.to, { from: u, step });
          open.push(step.to);
        }
      }
    }
    return { dist, prev };
  }

  /** Polyligne d'un trajet reconstruit (liste de pas) ; `kinds[i]` = nature du segment i. */
  function assemble(startPt, steps, endPt) {
    const pts = [],
      kinds = [];
    const push = (p, kind) => {
      const last = pts[pts.length - 1];
      if (!last || Math.hypot(last[0] - p[0], last[1] - p[1]) > 1e-6) {
        if (pts.length) kinds.push(kind);
        pts.push([p[0], p[1]]);
      }
    };
    if (startPt) push(startPt, steps[0] ? steps[0].edge.kind : "land");
    for (const st of steps) {
      const seq = st.forward ? st.edge.pts : st.edge.pts.slice().reverse();
      for (let i = 0; i < seq.length; i++) push(seq[i], st.edge.kind);
    }
    if (endPt) push(endPt, kinds[kinds.length - 1] || "land");
    if (pts.length === 1) {
      pts.push([pts[0][0] + 1e-3, pts[0][1]]);
      kinds.push("land");
    }
    return { pts, kinds };
  }

  /** Position sur le graphe la plus proche d'un point : { edge, s, x, z, d }. */
  function locate(graph, x, z, mover = "walker") {
    let best = null;
    for (const E of graph.edges) {
      if (!allowed(E.kind, mover)) continue;
      const pr = G.project(E.line, x, z);
      if (!best || pr.d < best.d) best = { edge: E, s: pr.s, x: pr.x, z: pr.z, d: pr.d };
    }
    return best;
  }

  /**
   * Trajet le plus court d'une position (point quelconque, projeté sur le graphe) vers l'une des
   * cibles (nœuds). Renvoie { pts, kinds, length, target } ou null.
   */
  function route(graph, from, targets, mover = "walker", speeds = { land: 1, water: 1 }) {
    let starts;
    let startPt = null;
    if (typeof from === "string") starts = [{ node: from, cost: 0 }];
    else {
      const loc = from.edge ? from : locate(graph, from.x, from.z, mover);
      if (!loc) return null;
      startPt = [loc.x, loc.z];
      const E = loc.edge;
      const f = edgeCost(E, mover, speeds) / Math.max(1e-9, E.length);
      // Deux départs : vers chaque extrémité de l'arête, avec le tronçon partiel comme premier pas.
      starts = [
        { node: E.a, cost: loc.s * f, via: { partial: true, edge: E, from: loc.s, to: 0 } },
        { node: E.b, cost: (E.length - loc.s) * f, via: { partial: true, edge: E, from: loc.s, to: E.length } },
      ];
    }
    const { dist, prev } = dijkstra(graph, starts, mover, speeds);
    let best = null;
    for (const t of targets) {
      const d = dist.get(t);
      if (d !== undefined && (!best || d < best.d)) best = { t, d };
    }
    if (!best) return null;
    // Reconstruction.
    const steps = [];
    let cur = best.t,
      partial = null;
    while (true) {
      const p = prev.get(cur);
      if (!p) break;
      if (p.partial) {
        partial = p;
        break;
      }
      steps.unshift(p.step);
      cur = p.from;
    }
    let out;
    if (partial) {
      const E = partial.edge;
      const sub = subLine(E, partial.from, partial.to);
      out = assemble(null, [{ edge: { pts: sub, kind: E.kind }, forward: true }, ...steps], null);
    } else out = assemble(startPt, steps, null);
    return { pts: out.pts, kinds: out.kinds, line: G.polyline(out.pts), target: best.t, cost: best.d, steps };
  }

  /** Portion d'une arête entre les abscisses s0 et s1 (dans le sens s0 → s1). */
  function subLine(E, s0, s1) {
    const a = Math.min(s0, s1),
      b = Math.max(s0, s1);
    const out = [];
    const p0 = G.at(E.line, a);
    out.push([p0.x, p0.z]);
    for (let i = 1; i < E.pts.length - 1; i++) if (E.line.cum[i] > a && E.line.cum[i] < b) out.push(E.pts[i]);
    const p1 = G.at(E.line, b);
    out.push([p1.x, p1.z]);
    return s0 <= s1 ? out : out.reverse();
  }

  /** Type de terrain (eau / terre) à l'abscisse s d'un trajet : recherche de l'arête la plus proche. */
  function waterAt(graph, x, z) {
    let best = null;
    for (const E of graph.edges) {
      const pr = G.project(E.line, x, z);
      if (!best || pr.d < best.d) best = { d: pr.d, kind: E.kind };
    }
    return best ? best.kind === "water" : false;
  }

  /** Vérifications d'une disposition. Renvoie la liste des problèmes (vide si tout va bien). */
  function validate(L) {
    const problems = [];
    const g = buildGraph(L);
    const landEntries = L.entries.filter((e) => e.kind === "land");
    const waterEntries = L.entries.filter((e) => e.kind === "water");
    const exits = L.exits.map((e) => e.node);
    for (const r of L.reserves) {
      for (const e of landEntries) if (!route(g, e.node, [r.doorNode], "walker")) problems.push(`${L.id}: réserve ${r.id} inaccessible depuis ${e.id}`);
      for (const e of waterEntries) if (!route(g, e.node, [r.doorNode], "swimmer", { land: 0.9, water: 1.15 })) problems.push(`${L.id}: réserve ${r.id} inaccessible aux nageurs depuis ${e.id}`);
      const out = route(g, r.doorNode, exits.filter((x) => L.exits.find((e) => e.node === x).kind === "land"), "walker");
      if (!out) problems.push(`${L.id}: aucune sortie depuis la réserve ${r.id}`);
      else if (out.line.length < 8) problems.push(`${L.id}: sortie trop proche de la réserve ${r.id} (${out.line.length.toFixed(1)} U)`);
      // Distance d'interception : au moins 12 U entre chaque entrée et la réserve.
      for (const e of landEntries) {
        const rt = route(g, e.node, [r.doorNode], "walker");
        if (rt && rt.line.length < 12) problems.push(`${L.id}: ${e.id} → ${r.id} trop court (${rt.line.length.toFixed(1)} U)`);
      }
    }
    // Les chemins terrestres ne traversent ni l'eau (hors ponts) ni les bâtiments.
    const waterPolys = L.ponds.map((p) => p.poly);
    for (const E of g.edges) {
      if (E.kind !== "land") continue;
      const n = Math.ceil(E.length / 0.4);
      for (let i = 1; i < n; i++) {
        const p = G.at(E.line, (E.length * i) / n);
        if (waterPolys.some((poly) => G.pointInPolygon(p.x, p.z, poly))) {
          problems.push(`${L.id}: le chemin ${E.id} (${E.a}→${E.b}) passe dans l'eau vers (${p.x.toFixed(1)}, ${p.z.toFixed(1)})`);
          break;
        }
        const st = L.streams.find((s) => G.polylineDist(p.x, p.z, s.pts) < s.width / 2 + 0.25);
        if (st) {
          problems.push(`${L.id}: le chemin ${E.id} (${E.a}→${E.b}) coupe ${st.id} vers (${p.x.toFixed(1)}, ${p.z.toFixed(1)}) sans pont`);
          break;
        }
      }
    }
    for (const E of g.edges) {
      if (E.kind === "water") continue;
      for (const poly of L.blockers) {
        let hit = false;
        for (let i = 0; i < E.pts.length - 1 && !hit; i++) hit = G.segmentHitsPolygon(E.pts[i][0], E.pts[i][1], E.pts[i + 1][0], E.pts[i + 1][1], poly);
        if (hit) problems.push(`${L.id}: le chemin ${E.id} (${E.a}→${E.b}) traverse un bâtiment`);
      }
    }
    // Cases : une par case de grille, calées sur la grille, hors chemins, hors bâtiments, hors eau ;
    // les cases de berge ont le centre sur la terre ferme, au bord de l'eau (îlots exceptés).
    const T = L.tile || 2,
      half = T / 2;
    const cells = new Set();
    const walkable = g.edges.filter((E) => E.kind !== "water");
    const waterSigned = PTMT.layoutHelpers.waterSigned;
    for (const s of L.sockets) {
      const key = s.i + ":" + s.j;
      if (cells.has(key)) problems.push(`${L.id}: deux cases sur ${key}`);
      cells.add(key);
      if (Math.abs(s.x - (s.i + 0.5) * T) > 1e-6 || Math.abs(s.z - (s.j + 0.5) * T) > 1e-6) problems.push(`${L.id}: case ${s.id} hors grille`);
      const samples = [
        [s.x, s.z],
        [s.x - half, s.z - half],
        [s.x + half, s.z - half],
        [s.x - half, s.z + half],
        [s.x + half, s.z + half],
      ];
      const dPath = Math.min(...walkable.map((E) => Math.min(...samples.map((p) => G.polylineDist(p[0], p[1], E.pts)))));
      if (dPath < PTMT.config.grid.roadClear - 1e-6) problems.push(`${L.id}: case ${s.id} (${s.kind}) sur un chemin (${dPath.toFixed(2)} U)`);
      if (L.blockers.some((poly) => samples.some((p) => G.pointInPolygon(p[0], p[1], poly)))) problems.push(`${L.id}: case ${s.id} dans un bâtiment`);
      if (s.islet) continue;
      const wd = waterSigned(L, s.x, s.z);
      if (s.kind === "water") {
        if (wd > 0) problems.push(`${L.id}: case de berge ${s.id} dans l'eau`);
        if (wd < -3.7) problems.push(`${L.id}: case de berge ${s.id} loin de l'eau (${(-wd).toFixed(1)} U)`);
      } else if (samples.some((p) => waterSigned(L, p[0], p[1]) > 0)) problems.push(`${L.id}: case ${s.id} dans l'eau`);
    }
    // Chaque réserve a des cases libres (sans bois) des trois familles à moins de 11 U.
    for (const r of L.reserves)
      for (const k of ["fire", "ice", "water"])
        if (!L.sockets.some((s) => s.kind === k && !s.forest && Math.hypot(s.x - r.pos[0], s.z - r.pos[1]) < 11)) problems.push(`${L.id}: pas de case ${k} près de la réserve ${r.id}`);
    return problems;
  }

  PTMT.routes = { buildGraph, dijkstra, route, locate, subLine, waterAt, validate };
})();
