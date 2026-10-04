// « Pas touche à mes trésors » — vagues des quinze missions (PTMT.sim.buildWaves), sans THREE.
//
// Comme dans Cursed Treasure : les trois premières missions ont des vagues écrites à la main (reprises
// des missions 1 à 3 de CT : paysans, voleurs, guerriers, puis ninjas, chevaliers, bardes et un boss à
// la dernière vague) ; les suivantes sont composées à partir d'un budget qui grandit à chaque vague :
// chaque mission présente un ou deux ennemis nouveaux (seuls, la première fois : fiche « Nouvel
// ennemi ! »), puis les mêle aux autres ; des vagues à thème (peloton de cyclistes, montgolfières,
// l'ennemi fétiche de la mission), un champion toutes les cinq vagues et un ou plusieurs boss nommés
// à la fin. Les PV grimpent de vague en vague, de plus en plus vite : la fin d'une mission longue doit
// rester tendue même avec des tours au niveau 7.
//
// Une vague = { groups: [{ type, champion, boss, count, entrance }], spawns: [{ t, type, champion,
// boss, entrance, hpMul }], hpMul, duration } ; t = délai (s) depuis le début de la vague.
(function () {
  "use strict";
  const PTMT = (globalThis.PTMT = globalThis.PTMT || {});
  const S = (PTMT.sim = PTMT.sim || {});
  const D = S.DATA;

  // Missions 1 à 3 : listes de CT (paysan → agriculteur, voleur → quad, guerrier → cow-boy,
  // chevalier → vache, ninja → chasseur, barde → sonneur).
  const HAND = {
    1: ["fermier 4", "fermier 6", "quad 3", "fermier 6, quad 2", "cowboy 3, fermier 5"],
    2: ["fermier 3", "fermier 6", "quad 4", "fermier 9", "fermier 10, quad 2", "cowboy 6", "fermier 14", "chasseur 4", "quad 9, cowboy 2", "vache 1 boss, fermier 6"],
    3: [
      "fermier 4",
      "fermier 6",
      "cowboy 2, quad 2",
      "cowboy 3, quad 3",
      "fermier 6, quad 3",
      "cowboy 6",
      "vache 2, sonneur 2",
      "vache 3, quad 4",
      "chasseur 5",
      "cowboy 10",
      "sonneur 3, vache 3, fermier 6",
      "sonneur 3, cowboy 7",
      "quad 14",
      "chasseur 5, vache 4",
      "chasseur 1 boss, chasseur 4, quad 4",
    ],
  };

  // Missions 4 à 15 : ennemis présentés [type, vague (1 = première)], réserve (s'enrichit des
  // présentés), type fétiche (vagues à thème), boss, multiplicateur de PV de la mission.
  const BASE = ["fermier", "quad", "cowboy", "vache", "chasseur", "sonneur"];
  const LV = {
    4: { intro: [["druide", 3]], pool: BASE, boss: ["druide"], hp: 1.0 },
    5: { intro: [["cycliste", 3], ["bigoudene", 9]], pool: [...BASE, "druide"], heavy: "cycliste", boss: ["bigoudene"], hp: 1.05 },
    6: { intro: [["rugbyman", 3]], pool: [...BASE, "druide", "bigoudene", "cycliste"], boss: ["rugbyman"], hp: 1.0 },
    7: { intro: [], pool: [...BASE, "druide", "bigoudene", "cycliste", "rugbyman"], heavy: "chasseur", boss: ["chasseur", "chasseur"], hp: 1.05 },
    8: { intro: [["pompier", 3]], pool: [...BASE, "druide", "bigoudene", "cycliste", "rugbyman"], boss: ["pompier"], hp: 1.8 },
    9: { intro: [["canard", 3]], pool: [...BASE, "druide", "bigoudene", "cycliste", "rugbyman", "pompier"], heavy: "canard", boss: ["canard", "vache"], hp: 0.95 },
    10: { intro: [["korrigan", 3]], pool: [...BASE, "druide", "bigoudene", "cycliste", "rugbyman", "pompier", "canard"], heavy: "korrigan", boss: ["korrigan"], hp: 2.0 },
    11: { intro: [["montgolfiere", 6]], pool: [...BASE, "druide", "bigoudene", "cycliste", "rugbyman", "pompier", "canard", "korrigan"], heavy: "montgolfiere", boss: ["montgolfiere", "druide"], hp: 1.3 },
    12: { intro: [["touriste", 3]], pool: [...BASE, "druide", "bigoudene", "cycliste", "rugbyman", "pompier", "canard", "korrigan", "montgolfiere"], heavy: "touriste", boss: ["touriste", "rugbyman"], hp: 1.75 },
    13: { intro: [["tracteur", 6]], pool: [...BASE, "druide", "bigoudene", "cycliste", "rugbyman", "pompier", "canard", "korrigan", "montgolfiere", "touriste"], heavy: "tracteur", boss: ["tracteur", "bigoudene"], hp: 0.95 },
    14: { intro: [], pool: [...BASE, "druide", "bigoudene", "cycliste", "rugbyman", "pompier", "canard", "korrigan", "montgolfiere", "touriste", "tracteur"], boss: ["vache", "korrigan", "touriste"], hp: 2.2 },
    15: { intro: [], pool: [...BASE, "druide", "bigoudene", "cycliste", "rugbyman", "pompier", "canard", "korrigan", "montgolfiere", "touriste", "tracteur"], boss: ["tracteur", "montgolfiere", "pompier"], hp: 1.9 },
  };
  S.WAVE_LEVELS = LV;

  function parse(line) {
    return line.split(",").map((part) => {
      const bits = part.trim().split(/\s+/);
      return { type: bits[0], count: Number(bits[1]) || 1, champion: bits.includes("boss") || bits.includes("champion"), boss: bits.includes("boss") };
    });
  }
  /** Intervalle entre deux ennemis d'un groupe (s) : les rapides se suivent de près, le peloton colle. */
  function gap(type) {
    if (type === "cycliste") return 0.45;
    const v = D.ENEMIES[type].speed;
    return v >= 1.4 ? 1.0 : v <= 0.8 ? 1.8 : 1.35;
  }
  function pick(rnd, list) {
    return list[Math.floor(rnd() * list.length) % list.length];
  }

  /**
   * Vagues d'une mission. entrances : entrées de la carte ({ id, opensAt }) ; une barrière ne sert
   * qu'à partir de sa vague d'ouverture (et cette vague-là passe par elle).
   */
  S.buildWaves = function (level, entrances) {
    const map = S.MAPS[level];
    const n = map.waves;
    const rnd = PTMT.rng(9001 + level * 97);
    const cfg = LV[level];
    const ents = (Array.isArray(entrances) ? entrances : Array.from({ length: entrances || 1 }, (_, id) => ({ id, opensAt: 0 }))).map((e) => ({ id: e.id, opensAt: e.opensAt || 0 }));
    const waves = [];
    for (let w = 0; w < n; w++) {
      let groups = HAND[level] ? parse(HAND[level][w]) : compose(level, cfg, w, n, rnd);
      const avail = ents.filter((e) => e.opensAt <= w + 1);
      const fresh = ents.filter((e) => e.opensAt === w + 1 && e.opensAt > 0);
      const A = avail.length;
      // Nombre d'entrées utilisées : une au début, puis deux, puis toutes.
      const spread = A <= 1 ? 1 : w < n / 4 ? 1 : w < n / 2 ? Math.min(2, A) : w < (3 * n) / 4 ? Math.min(3, A) : A;
      const used = [];
      for (let k = 0; k < spread; k++) used.push(avail[(w + k * Math.max(1, Math.floor(A / spread))) % A].id);
      for (const e of fresh) if (!used.includes(e.id)) used.unshift(e.id);
      // Un gros groupe se partage entre les entrées utilisées.
      const out = [];
      for (const g of groups) {
        if (used.length > 1 && !g.boss && g.count >= 4 * used.length) {
          const per = Math.floor(g.count / used.length);
          used.forEach((id, k) => out.push({ type: g.type, champion: g.champion, boss: false, count: per + (k === 0 ? g.count - per * used.length : 0), entrance: id }));
        } else out.push(Object.assign({}, g));
      }
      out.forEach((g, k) => {
        if (g.entrance === undefined) g.entrance = used[k % used.length];
      });
      groups = out;
      // PV : multiplicateur propre à la mission (atteint sur les huit premières vagues), puis montée
      // de plus en plus raide au fil des vagues.
      const levelHp = cfg ? 1 + (cfg.hp - 1) * Math.min(1, 0.3 + w / 8) : level === 3 ? 1.05 : 1;
      const curve = level <= 3 ? 1 + 0.03 * w : 1 + 0.035 * w + 0.0011 * w * w;
      // Fin de mission : les PV accélèrent encore (d'autant plus que la mission est longue), pour que
      // les dernières vagues restent dangereuses même avec des tours au niveau 7.
      const late = level <= 3 ? 1 : 1 + (n >= 40 ? 1.0 : n >= 30 ? 0.45 : 0.3) * Math.pow(Math.max(0, w / Math.max(1, n - 1) - 0.45) / 0.55, 2);
      const hpMul = levelHp * curve * late;
      const spawns = [];
      const byEntrance = new Map();
      for (const g of groups) {
        let t = byEntrance.get(g.entrance) || 0;
        for (let c = 0; c < g.count; c++) {
          spawns.push({ t, type: g.type, champion: !!g.champion, boss: !!g.boss, entrance: g.entrance, hpMul });
          t += g.boss ? 2 : g.champion ? 1.6 : gap(g.type);
        }
        byEntrance.set(g.entrance, t + 1.2);
      }
      spawns.sort((a, b) => a.t - b.t);
      waves.push({ index: w, groups, spawns, hpMul, duration: spawns.length ? spawns[spawns.length - 1].t : 0 });
    }
    return waves;
  };

  function compose(level, cfg, w, n, rnd) {
    const last = w === n - 1;
    const budget = (22 + 4.2 * w) * (1 + 0.08 * (level - 4));
    const count = (type, share) => Math.max(2, Math.min(type === "cycliste" ? 20 : 28, Math.round((budget * share) / D.ENEMIES[type].threat)));
    const intro = cfg.intro.find(([, at]) => at === w + 1);
    // Réserve de la vague : les ennemis de la mission déjà présentés, par rang de difficulté.
    const introduced = cfg.intro.filter(([, at]) => at <= w + 1).map(([t]) => t);
    const cap = w < 3 ? 1 : w < 8 ? 2 : w < 15 ? 3 : 4;
    const pool = [...new Set([...cfg.pool, ...introduced])].filter((t) => (D.ENEMIES[t].tier || 1) <= cap || introduced.includes(t));
    if (last) {
      // Boss (un ou plusieurs) et leur escorte.
      const out = cfg.boss.map((type) => ({ type, count: 1, champion: true, boss: true }));
      const tough = pool.filter((t) => D.ENEMIES[t].hp >= 100 && t !== "montgolfiere");
      const escort = pick(rnd, tough.length ? tough : pool);
      out.push({ type: escort, count: count(escort, 0.5) });
      out.push({ type: pick(rnd, pool), count: count("quad", 0.3) });
      return out;
    }
    // Présentation d'un nouvel ennemi, seul.
    if (intro) return [{ type: intro[0], count: Math.max(D.ENEMIES[intro[0]].threat >= 20 ? 2 : 3, Math.min(D.ENEMIES[intro[0]].threat >= 20 ? 2 : 6, count(intro[0], 0.55))) }];
    const groups = [];
    const has = (t) => pool.includes(t);
    if (cfg.heavy && has(cfg.heavy) && w % 3 === 1 && w >= 4) groups.push({ type: cfg.heavy, count: count(cfg.heavy, 0.9) });
    else if (has("cycliste") && w % 6 === 5) groups.push({ type: "cycliste", count: count("cycliste", 0.7) });
    else if (has("montgolfiere") && w % 5 === 3) {
      groups.push({ type: "montgolfiere", count: Math.max(2, count("montgolfiere", 0.5)) });
      const b = pick(rnd, pool.filter((t) => t !== "montgolfiere"));
      groups.push({ type: b, count: count(b, 0.5) });
    } else if (w % 4 === 3 || rnd() < 0.3) {
      const type = pick(rnd, pool.filter((t) => t !== "montgolfiere"));
      groups.push({ type, count: count(type, 1) });
    } else {
      const a = pick(rnd, pool);
      let b = pick(rnd, pool);
      if (b === a) b = pick(rnd, pool);
      groups.push({ type: a, count: count(a, 0.55) });
      if (b !== a) groups.push({ type: b, count: count(b, 0.45) });
    }
    // Un champion toutes les cinq vagues (dès la cinquième à partir de la mission 6).
    if (w % 5 === 4 && w >= (level >= 6 ? 4 : 9)) {
      const type = pick(rnd, pool);
      groups.push({ type, count: 1 + (w >= 24 ? 1 : 0) + (w >= 39 ? 1 : 0), champion: true });
    }
    return groups;
  }
})();
