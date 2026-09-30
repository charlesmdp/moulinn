// Robot joueur pour les essais : construit sur les meilleures cases, améliore, coupe la forêt et
// lance les sorts. Pas parfait exprès : s'il gagne toutes les missions, un humain attentif aussi.
export function makeBot(P, game, opts = {}) {
  const D = P.sim.DATA;
  const s = game.state;
  const W = D.W, H = D.H;
  const route = new Map(); // case de chemin → poids (proche du repaire = précieux : passage aller et retour)
  function computeRoute() {
    route.clear();
    // Le robot anticipe le passage secret : il raisonne sur la carte ouverte.
    const g = new P.sim.Grid({ id: 0, grid: game.grid.lines().map((r) => r.replace(/s/g, "#")), mana: [] });
    const toLair = g.toLair(false), toLairSwim = g.toLair(true);
    let max = 1;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const d = g.at(toLair, i, j); if (d < 1e8) max = Math.max(max, d); }
    for (let j = 0; j < H; j++)
      for (let i = 0; i < W; i++) {
        const d = g.at(toLair, i, j), ds = g.at(toLairSwim, i, j);
        if (d < 1e8 && g.walkable(i, j)) route.set(j * W + i, 1 + 1.2 * (1 - d / max));
        else if (ds < 1e8 && g.swimmable(i, j)) route.set(j * W + i, 0.35);
      }
  }
  computeRoute();
  let mapVersion = s.map.version;
  const baseRange = { boar: D.FAMILIES.boar.base[0].range, swan: D.FAMILIES.swan.base[0].range, dog: D.FAMILIES.dog.base[0].range };
  // Rendement décroissant : une case de chemin déjà couverte par plusieurs tours vaut moins
  // (les tours s'étalent le long du chemin, ce qui gêne les chasseurs et leur fumigène).
  function covered(a, b) {
    let n = 0;
    for (const t of s.towers) if ((t.x - a - 0.5) ** 2 + (t.y - b - 0.5) ** 2 <= (t.range || 2.4) ** 2) n++;
    return n;
  }
  function coverage(i, j, family, high, cov) {
    const r = baseRange[family] * (high ? 1.3 : 1) + 0.3;
    let sc = 0;
    for (const [k, w] of route) {
      const a = k % W, b = Math.floor(k / W);
      const d2 = (a - i) ** 2 + (b - j) ** 2;
      if (d2 <= r * r) sc += w * Math.pow(0.7, cov.get(k) || 0);
    }
    return sc;
  }
  function candidates() {
    const out = [];
    const cov = new Map();
    for (const k of route.keys()) cov.set(k, covered(k % W, Math.floor(k / W)));
    const count = { boar: 0, swan: 0, dog: 0 };
    for (const t of s.towers) count[t.family]++;
    for (let j = 0; j < H; j++)
      for (let i = 0; i < W; i++) {
        const info = game.tileInfo(i, j);
        if (!info || info.towerId) continue;
        const tile = D.TILES[info.char];
        if (!tile) continue;
        let fams = tile.build || (tile.cutTo && D.TILES[tile.cutTo].build) || [];
        if (!fams.length) continue;
        for (const f of fams) {
          const c = coverage(i, j, f, tile.high, cov);
          if (c <= 0.5) continue;
          const variety = 1 + 0.25 / (1 + count[f]);
          const pref = f === "dog" ? 1.25 : f === "swan" ? 1.1 : 1;
          const cost = game.costFor(f, 1);
          out.push({ i, j, family: f, forest: !!tile.forest, score: (c * variety * pref) / Math.sqrt(cost / 50), cost });
        }
      }
    out.sort((a, b) => b.score - a.score);
    return out;
  }
  let cache = null, cacheAt = -1;
  function decide() {
    if (s.map.version !== mapVersion) { mapVersion = s.map.version; computeRoute(); cache = null; }
    // 1. Améliorations possibles (les tours proches du repaire d'abord)
    const ups = game.upgradeable();
    if (ups.length) {
      const t = game.towerById(ups[0]);
      const spec = t.level === 3 ? (t.family === "swan" ? "A" : t.family === "boar" ? (t.id % 2 ? "B" : "A") : t.id % 2 ? "A" : "B") : null;
      if (game.upgrade(t.id, spec).ok) return;
    }
    // 2. Construction sur la meilleure case libre
    if (!cache || s.time - cacheAt > 3) { cache = candidates(); cacheAt = s.time; }
    const open = cache.filter((c) => !c.forest && !game.towerAt(c.i, c.j) && D.TILES[s.map.grid[c.j][c.i]].build);
    let free = open[0];
    // Case la meilleure trop chère : une bonne case abordable fait l'affaire.
    if (free && s.gold < free.cost) {
      const alt = open.slice(0, 8).find((c) => s.gold >= c.cost && c.score >= free.score * 0.75);
      if (alt) free = alt;
    }
    const wood = cache.find((c) => c.forest && D.TILES[s.map.grid[c.j][c.i]].cutTo);
    if (wood && (!free || wood.score > free.score * 1.15) && s.spells.cut.unlocked && s.mana >= s.spells.cut.cost + (s.spells.meteor.unlocked ? 20 : 0)) {
      if (game.cast("cut", { x: wood.i + 0.5, y: wood.j + 0.5 }).ok) { cache = null; return; }
    }
    // Garde un peu d'or pour les améliorations quand il y a déjà des tours
    const reserve = s.towers.length >= 6 ? 40 : 0;
    if (free && s.gold >= free.cost + reserve) {
      if (game.build(free.i, free.j, free.family).ok) { cache = null; return; }
    }
    // 3. Sorts
    const live = s.enemies.filter((e) => !e.dead);
    if (s.spells.meteor.ready) {
      let best = null, bestN = 0;
      for (const e of live) {
        let n = 0;
        for (const o of live) if ((o.x - e.x) ** 2 + (o.y - e.y) ** 2 <= 1.2 * 1.2) n += o.carrying ? 3 : o.champion ? 2 : 1;
        if (n > bestN) { bestN = n; best = e; }
      }
      if (best && bestN >= 5) { game.cast("meteor", { x: best.x, y: best.y }); return; }
    }
    if (s.spells.frenzy.ready && !s.frenzy) {
      const threat = live.filter((e) => e.carrying || e.champion).length;
      if (threat >= 1 || live.length >= 10) { game.cast("frenzy"); return; }
    }
  }
  let clock = 0;
  return {
    step(dt) {
      clock += dt;
      if (clock >= 0.25) { clock = 0; decide(); }
    },
  };
}

/** Rangs de compétences pour n points (répartition raisonnable, dans l'ordre de l'arbre). */
export function botSkills(P, points) {
  const p = P.progress.fresh();
  p.levels = {};
  for (let k = 1; k <= Math.ceil(points / 3); k++) p.levels[k] = { won: true, bestGems: 5, gemsTotal: 5, brilliant: false };
  const order = ["goldVault", "training", "manaStock", "goldVault", "training", "heights", "cutStudy", "manaSpring", "goldVault", "training", "meteorStudy", "frenzyStudy", "sawmill", "returnPortal", "marksman", "goldVault", "training", "meteorMastery", "manaSpring", "coldWater", "boarLord", "mining", "radiance", "dogLord", "swanLord", "frenzyLong", "hotGems", "manaPool", "meteorMastery", "heights"];
  let spent = 0, guard = 0;
  while (spent < points && guard++ < 400) {
    let raised = false;
    for (const id of order) {
      if (spent >= points) break;
      if (P.progress.raise(p, id)) { spent++; raised = true; }
    }
    if (!raised) break;
  }
  return p.skills;
}
