// Robot joueur pour les essais : construit sur les meilleures cases, améliore, coupe la forêt et
// lance les sorts. Pas parfait exprès : s'il gagne toutes les missions, un humain attentif aussi.
//
// Il « lit la carte » comme un joueur : il couvre surtout les routes près des cachettes (passage à
// l'aller et au retour), anticipe ce qu'annonce la frise (barrière qui s'ouvre, passage secret,
// marée basse) et garde un peu de mana pour Météore et Frénésie.
export function makeBot(P, game, opts = {}) {
  const D = P.sim.DATA;
  const s = game.state;
  const W = D.W,
    H = D.H;
  const route = new Map(); // case → poids (proche d'une cachette = précieux : passage aller et retour)
  function computeRoute() {
    route.clear();
    // Le robot anticipe : passage secret ouvert, barrières ouvertes, marée basse comme haute.
    const lines = game.grid.lines().map((r) => r.replace(/s/g, "#").replace(/g/g, "E"));
    const g = new P.sim.Grid({ id: 0, grid: lines, mana: [], lairs: game.def.lairs });
    // Trafic : une case compte pour chaque trajet entrée → cachette qui passe par elle (à une case
    // et demie près, les routes sont larges), d'autant plus qu'elle est proche de la cachette (les
    // ennemis y passent à l'aller et au retour). Les carrefours et l'abord des cachettes pèsent lourd.
    const weight = new Float32Array(W * H);
    const lowNow = s.tide === "low";
    for (const low of s.tide ? [false, true] : [false]) {
      g.setTide(low);
      for (const mode of ["walk", "swim"]) {
        const k = (mode === "swim" ? opts.swimWeight ?? 0.25 : 1) * (low === lowNow ? 1 : 0.4);
        if (!k) continue;
        for (const e of g.entrances) {
          const fe = g.field("e" + e.id, e.tiles, mode);
          for (let l = 0; l < g.lairs.length; l++) {
            const fl = g.toLair(l, mode);
            const total = Math.min(...e.tiles.map(([i, j]) => g.at(fl, i, j)));
            if (!(total < 1e8)) continue;
            const gems = (game.def.lairs[l] && game.def.lairs[l].gems) || 5;
            for (let idx = 0; idx < W * H; idx++) {
              const de = fe.D[idx],
                dl = fl.D[idx];
              if (de >= 1e8 || dl >= 1e8 || de + dl > total + 1.6) continue;
              weight[idx] = Math.max(weight[idx], 0) + k * (0.4 + gems / 5) * (1 + 0.9 * (1 - dl / Math.max(1, total)));
            }
          }
        }
      }
    }
    let max = 0;
    for (let k = 0; k < W * H; k++) max = Math.max(max, weight[k]);
    for (let k = 0; k < W * H; k++) if (weight[k] > 0) route.set(k, (2.4 * weight[k]) / max);
    // Montgolfières (dès qu'il y en a dans la mission) : elles volent en ligne droite d'une entrée à
    // une cachette ; le robot couvre aussi ces lignes, surtout près des cachettes.
    const flyers = game.waves.some((w) => w.groups.some((gr) => gr.type === "montgolfiere"));
    if (flyers)
      for (const e of g.entrances)
        for (const L of g.lairs) {
          const n = Math.ceil(Math.hypot(L.x - e.x, L.y - e.y) * 2);
          for (let k = 0; k <= n; k++) {
            const x = e.x + ((L.x - e.x) * k) / n,
              y = e.y + ((L.y - e.y) * k) / n;
            const idx = Math.floor(y) * W + Math.floor(x);
            if (idx < 0 || idx >= W * H) continue;
            route.set(idx, Math.max(route.get(idx) || 0, 0.5 + (1.2 * k) / n));
          }
        }
    for (const L of game.def.lairs) {
      const k = L.at[1] * W + L.at[0];
      route.set(k, (route.get(k) || 1) + 1.5);
    }
  }
  computeRoute();
  let mapVersion = s.map.version;
  const baseRange = { boar: D.FAMILIES.boar.base[0].range, swan: D.FAMILIES.swan.base[0].range, dog: D.FAMILIES.dog.base[0].range };
  // Rendement décroissant : une case déjà couverte par plusieurs tours vaut moins.
  function covered(a, b) {
    let n = 0;
    for (const t of s.towers) if ((t.x - a - 0.5) ** 2 + (t.y - b - 0.5) ** 2 <= (t.range || 2.4) ** 2) n++;
    return n;
  }
  function coverage(i, j, family, high, cov) {
    const r = baseRange[family] * (high ? 1.3 : 1) + 0.3;
    let sc = 0;
    for (const [k, w] of route) {
      const a = k % W,
        b = Math.floor(k / W);
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
        const fams = tile.build || (tile.cutTo && D.TILES[tile.cutTo].build) || [];
        if (!fams.length) continue;
        for (const f of fams) {
          const c = coverage(i, j, f, tile.high, cov);
          if (c <= 0.5) continue;
          const variety = 1 + 0.25 / (1 + count[f]);
          const pref = f === "dog" ? 1.2 : f === "swan" ? 1.1 : 1;
          const mana = info.mana ? 1.15 : 1;
          const cost = game.costFor(f, 1);
          out.push({ i, j, family: f, forest: !!tile.forest, score: (c * variety * pref * mana) / Math.sqrt(cost / 50), cost });
        }
      }
    out.sort((a, b) => b.score - a.score);
    return out;
  }
  const skill = opts.skill == null ? 1 : opts.skill; // < 1 : joue plus lentement (moins d'actions)
  let cache = null,
    cacheAt = -1;
  /** Dégâts par seconde estimés (zone et effets comptés grossièrement). */
  function dps(st) {
    if (!st) return 0;
    if (st.attack === "beam") return st.dps * (1 + st.heatMax) * 0.5 * (st.beams || 1) * (st.splash ? 1.35 : 1) * (st.chain ? 1.4 : 1) * (st.radiance ? 1.15 : 1);
    const zone = st.splash ? 1 + st.splash : 1;
    if (st.attack === "charges") return (st.dmg / st.reload) * zone * (st.slow ? 1.15 : 1);
    const crit = st.crit ? 1 + st.crit.chance * (st.crit.mult - 1) : 1;
    return st.dmg * st.rate * crit * (st.multi || 1) * zone;
  }
  function specFor(t) {
    if (t.family === "swan") return t.id % 3 === 0 ? "B" : "A";
    if (t.family === "boar") return t.id % 2 ? "B" : "A";
    return t.id % 2 ? "A" : "B";
  }
  function decide() {
    if (s.map.version !== mapVersion) {
      mapVersion = s.map.version;
      computeRoute();
      cache = null;
    }
    // 1. Améliorations : celle qui rapporte le plus de dégâts par pièce d'or, parmi les tours qui ont
    // l'expérience nécessaire.
    let best = null,
      bestCost = 0,
      bestValue = 0;
    for (const t of s.towers) {
      if (t.level >= 7 || t.xp < D.XP[t.level]) continue;
      const sp = t.level === 3 ? specFor(t) : t.spec;
      const cost = game.costFor(t.family, t.level + 1, sp);
      const value = (dps(game.statsFor(t, t.level + 1, sp)) - dps(t.st)) / cost;
      if (value > bestValue) {
        best = t;
        bestCost = cost;
        bestValue = value;
      }
    }
    const wanted = 5 + Math.floor(Math.max(0, s.wave.index) * 0.6);
    if (best && s.gold >= bestCost && (s.towers.length >= wanted || s.gold >= bestCost + 60)) {
      if (game.upgrade(best.id, best.level === 3 ? specFor(best) : null).ok) return;
    }
    // 2. Construction sur la meilleure case libre
    if (!cache || s.time - cacheAt > 3) {
      cache = candidates();
      cacheAt = s.time;
    }
    const open = cache.filter((c) => !c.forest && !game.towerAt(c.i, c.j) && D.TILES[s.map.grid[c.j][c.i]].build);
    let free = open[0];
    if (free && s.gold < free.cost) {
      const alt = open.slice(0, 8).find((c) => s.gold >= c.cost && c.score >= free.score * 0.75);
      if (alt) free = alt;
    }
    const wood = cache.find((c) => c.forest && D.TILES[s.map.grid[c.j][c.i]].cutTo);
    if (wood && (!free || wood.score > free.score * 1.15) && s.spells.cut.unlocked && s.mana >= s.spells.cut.cost + (s.spells.meteor.unlocked ? 20 : 0)) {
      if (game.cast("cut", { x: wood.i + 0.5, y: wood.j + 0.5 }).ok) {
        cache = null;
        return;
      }
    }
    // Une tour a l'expérience pour monter mais l'or manque : on économise pour elle (une tour de
    // niveau 4 à 7 vaut bien mieux qu'une tour de plus au niveau 1), sauf au tout début.
    const saving = best && s.towers.length >= wanted ? bestCost : 0;
    const reserve = Math.max(s.towers.length >= 6 ? 40 : 0, saving);
    if (free && s.gold >= free.cost + reserve) {
      if (game.build(free.i, free.j, free.family).ok) {
        cache = null;
        return;
      }
    }
    // 3. Sorts
    const live = s.enemies.filter((e) => !e.dead);
    if (s.spells.meteor.ready) {
      let best = null,
        bestN = 0;
      for (const e of live) {
        let n = 0;
        for (const o of live) if ((o.x - e.x) ** 2 + (o.y - e.y) ** 2 <= 1.2 * 1.2) n += o.carrying ? 3 : o.champion || o.boss ? 2 : 1;
        if (n > bestN) {
          bestN = n;
          best = e;
        }
      }
      if (best && bestN >= 5) {
        game.cast("meteor", { x: best.x + best.vx * 0.6, y: best.y + best.vy * 0.6 });
        return;
      }
    }
    if (s.spells.frenzy.ready && !s.frenzy) {
      const threat = live.filter((e) => e.carrying || e.champion || e.boss).length;
      if (threat >= 1 || live.length >= 10) {
        game.cast("frenzy");
        return;
      }
    }
  }
  let clock = 0;
  return {
    step(dt) {
      clock += dt;
      if (clock >= 0.25 / skill) {
        clock = 0;
        decide();
      }
    },
  };
}

/** Rangs de compétences pour n points (répartition raisonnable, dans l'ordre de l'arbre). */
export function botSkills(P, points) {
  const p = P.progress.fresh();
  p.levels = {};
  for (let k = 1; k <= Math.ceil(points / 3); k++) p.levels[k] = { won: true, bestGems: 5, gemsTotal: 5, brilliant: false };
  const order = ["goldVault", "training", "manaStock", "goldVault", "training", "heights", "cutStudy", "manaSpring", "goldVault", "training", "meteorStudy", "frenzyStudy", "sawmill", "returnPortal", "marksman", "goldVault", "training", "meteorMastery", "manaSpring", "coldWater", "boarLord", "mining", "radiance", "dogLord", "swanLord", "frenzyLong", "hotGems", "manaPool", "meteorMastery", "heights"];
  let spent = 0,
    guard = 0;
  while (spent < points && guard++ < 400) {
    let raised = false;
    for (const id of order) {
      if (spent >= points) break;
      if (P.progress.raise(p, id)) {
        spent++;
        raised = true;
      }
    }
    if (!raised) break;
  }
  return p.skills;
}

/** Joue une mission jusqu'au bout ; renvoie le résumé. */
export function playMission(P, n, opts = {}) {
  const S = P.sim;
  const skills = opts.skills || botSkills(P, 3 * (n - 1));
  const g = S.createGame({ level: n, skills, seed: opts.seed || 11 });
  const bot = makeBot(P, g, opts);
  let guard = 0;
  const steals = [];
  while (!g.state.over && guard++ < 240000) {
    g.step(0.05);
    bot.step(0.05);
    for (const ev of g.drainEvents()) if (ev.type === "steal") steals.push(g.state.wave.index + 1);
    if (opts.each && guard % 2000 === 0) opts.each(g);
  }
  const s = g.state;
  return { n, game: g, win: !!(s.over && s.over.win), gems: s.over ? s.over.gemsLeft : null, total: s.gemCount.total, lost: s.gemCount.lost, wave: s.wave.index + 1, waves: s.wave.total, towers: s.towers.length, levels: s.towers.map((t) => t.level).join(""), time: Math.round(s.time), steals };
}
