// Joueur automatique simple : construit, améliore, lance les sorts. Sert à vérifier que chaque
// niveau se gagne avec les équipements réellement accessibles, et à régler l'équilibrage.
export function makeBot(P, game, opts = {}) {
  const C = P.config,
    G = P.geom,
    R = P.routes;
  const L = game.L;
  const mix = opts.mix || { fire: 0.42, ice: 0.3, water: 0.28 };
  const useSpells = opts.spells !== false;

  function routeSamples() {
    // Points échantillonnés sur les trajets probables : entrées → réserves, réserves → sorties.
    const pts = [];
    const exits = L.exits.filter((e) => e.kind === "land").map((e) => e.node);
    for (const e of L.entries) {
      for (const r of game.state.reserves) {
        const rt = R.route(game.graph, e.node, [r.doorNode], e.kind === "water" ? "swimmer" : "walker", { land: 0.9, water: 1.15 });
        if (!rt) continue;
        for (let s = 0; s < rt.line.length; s += 0.8) {
          const p = G.at(rt.line, s);
          pts.push({ x: p.x, z: p.z, w: 1 + (s / rt.line.length) * 1.5 });
        }
      }
    }
    for (const r of game.state.reserves) {
      const rt = R.route(game.graph, r.doorNode, exits, "walker");
      if (!rt) continue;
      for (let s = 0; s < rt.line.length; s += 0.8) {
        const p = G.at(rt.line, s);
        pts.push({ x: p.x, z: p.z, w: 2.2 });
      }
    }
    return pts;
  }
  const samples = routeSamples();
  function coverage(x, z, range) {
    let c = 0;
    for (const p of samples) if ((p.x - x) ** 2 + (p.z - z) ** 2 <= range * range && game.los(x, z, p.x, p.z)) c += p.w;
    return c;
  }
  function counts() {
    const n = { fire: 0, ice: 0, water: 0 };
    for (const t of game.state.towers) n[t.family]++;
    return n;
  }
  function buildOne() {
    const s = game.state;
    const n = counts();
    const total = n.fire + n.ice + n.water + 1;
    let best = null,
      bestWood = null;
    for (const so of L.sockets) {
      if (game.towerAt(so.id)) continue;
      const fam = so.kind;
      const cost = C.towers[fam].forms["1"].cost;
      const deficit = mix[fam] - n[fam] / total;
      const score = coverage(so.x, so.z, C.towers[fam].forms["1"].range) * (1 + deficit * 2.5);
      if (game.isForest(so.id)) {
        // Case boisée : candidate à la coupe si elle vaut nettement mieux que les cases libres.
        if (opts.cut !== false && game.cutProgress(so.id) === null && (!bestWood || score > bestWood.score)) bestWood = { so, fam, score, cost };
        continue;
      }
      if (s.gold < cost) continue;
      if (!best || score > best.score) best = { so, fam, score };
    }
    if (bestWood && (!best || bestWood.score > best.score * 1.35) && s.gold >= game.cutCost() + bestWood.cost + 40) {
      if (game.cut(bestWood.so.id).ok) cutsDone++;
    }
    if (best && best.score > 4) return game.build(best.so.id, best.fam).ok;
    return false;
  }
  let cutsDone = 0;
  function prep() {
    const s = game.state;
    // Revenus : la meule s'amortit en quelques vagues.
    if (s.wave >= 1 && s.mill.meule === 0 && s.gold >= 80 + 90) game.upgradeMill("meule");
    // Atelier dès qu'une tour peut évoluer.
    const maxXp = Math.max(0, ...s.towers.map((t) => t.xp));
    if (s.mill.atelier === 0 && maxXp >= 30 && s.gold >= 120) game.upgradeMill("atelier");
    if (s.mill.atelier === 1 && maxXp >= 90 && s.gold >= 240) game.upgradeMill("atelier");
    // Évolutions.
    for (const tw of s.towers.slice().sort((a, b) => b.xp - a.xp)) {
      const info = game.upgradeInfo(tw);
      if (info.max) continue;
      const pick = tw.tier === 1 ? (tw.family === "fire" ? (tw.x * 7 + tw.z) % 2 < 1 ? "B" : "A" : tw.family === "ice" ? "A" : "B") : tw.branch;
      game.upgradeTower(tw.id, pick);
    }
    // Pièges : filets sur les emplacements les plus fréquentés.
    while (s.traps.length < game.trapLimit() && s.gold >= 150 && s.towers.length >= 4) {
      let best = null;
      for (const sl of L.trapSlots) {
        if (s.traps.some((t) => t.slot === sl.id)) continue;
        const c = coverage(sl.x, sl.z, 1.5);
        if (!best || c > best.c) best = { sl, c };
      }
      if (!best) break;
      const kind = s.traps.length % 3 === 1 ? "spring" : "net";
      if (!game.buildTrap(best.sl.id, kind).ok) break;
    }
    let guard = 0;
    while (buildOne() && guard++ < 20);
    // Réserves : coffre renforcé si de l'or reste.
    if (s.mill.atelier >= 1) for (const r of s.reserves) if (r.tier === 1 && s.gold > 300) game.upgradeReserve(r.id);
    if (s.mill.roue === 0 && s.gold > 400) game.upgradeMill("roue");
  }
  function duringWave() {
    if (!useSpells) return;
    const s = game.state;
    // Rappel des sacs tombés.
    const dropped = s.treasures.filter((t) => t.state === "dropped");
    if (dropped.length && !game.spellBlocked("recall")) game.cast("recall", dropped[0].x, dropped[0].z);
    // Météore sur le groupe le plus dense, ou sur un porteur proche de la sortie.
    if (!game.spellBlocked("meteor")) {
      let best = null;
      for (const e of s.enemies) {
        const n = game.enemiesIn(e.x, e.z, 1.6).length + (e.carrying ? 2 : 0);
        if (!best || n > best.n) best = { e, n };
      }
      if (best && best.n >= 3) game.cast("meteor", best.e.x, best.e.z);
    }
    if (game.unlocked.has("freeze") && !game.spellBlocked("freeze")) {
      const c = s.enemies.find((e) => e.carrying && game.remaining(e) < 8);
      if (c) game.cast("freeze", c.x, c.z);
    }
    if (game.unlocked.has("flood") && !game.spellBlocked("flood")) {
      const c = s.enemies.find((e) => e.carrying && game.remaining(e) < 6);
      if (c) game.cast("flood", c.x, c.z);
    }
    if (game.unlocked.has("frenzy") && !game.spellBlocked("frenzy") && s.enemies.length >= 8) {
      const tw = s.towers[0];
      if (tw) game.cast("frenzy", tw.x, tw.z);
    }
  }
  return {
    play(maxWaves = 200) {
      const s = game.state;
      let guard = 0;
      while (!game.isOver && guard++ < maxWaves) {
        prep();
        const r = game.launchWave();
        if (!r.ok) break;
        let t = 0;
        while (s.phase === "wave" && t < 900) {
          game.advance(0.5);
          duringWave();
          t += 0.5;
        }
        game.drainEvents();
        if (s.phase === "prep" && opts.stopAfterVictory === false) continue;
      }
      return s.result || game.computeResult(false);
    },
    prep,
    duringWave,
    get cuts() {
      return cutsDone;
    },
  };
}
