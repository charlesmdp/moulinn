// « Pas touche à mes trésors » — vagues des quinze missions (PTMT.sim.buildWaves), sans THREE.
//
// Comme dans Cursed Treasure : les premières missions ont des vagues écrites à la main (reprises
// des missions 1 à 3 de CT : paysans, voleurs, guerriers, puis ninjas, chevaliers, bardes et un
// boss à la dernière vague) ; les suivantes sont composées à partir d'un budget qui grandit à
// chaque vague, avec un ennemi nouveau présenté seul (« Nouvel ennemi ! »), un champion toutes les
// cinq vagues et un boss nommé à la fin. Les PV grimpent doucement de vague en vague.
//
// Une vague = { groups: [{ type, champion, boss, count, entrance }], spawns: [{ t, type, champion,
// boss, entrance, hpMul }] } ; t = délai (s) depuis le début de la vague.
(function () {
  "use strict";
  const PTMT = (globalThis.PTMT = globalThis.PTMT || {});
  const S = (PTMT.sim = PTMT.sim || {});
  const D = S.DATA;

  const BASE = ["fermier", "quad", "cowboy"];
  // Missions 1 à 3 : listes de CT (paysan → agriculteur, voleur → quad, guerrier → cow-boy,
  // chevalier → vache, ninja → chasseur, barde → sonneur).
  const HAND = {
    1: ["fermier 4", "fermier 6", "quad 3", "fermier 6, quad 2", "cowboy 3, fermier 4"],
    2: ["fermier 3", "fermier 5", "quad 3", "fermier 8", "fermier 10", "cowboy 6", "fermier 14", "chasseur 4", "quad 9", "vache 1 boss"],
    3: [
      "fermier 3",
      "fermier 5",
      "cowboy 1, quad 1",
      "cowboy 2, quad 2",
      "fermier 5, quad 2",
      "cowboy 6",
      "vache 2, sonneur 2",
      "vache 2, quad 4",
      "chasseur 5",
      "cowboy 10",
      "sonneur 3, vache 3",
      "sonneur 3, cowboy 6",
      "quad 13",
      "chasseur 4, vache 4",
      "chasseur 1 boss, chasseur 3",
    ],
  };
  // Missions 4 à 15 : ennemi présenté, réserve d'ennemis, type fréquent, boss, multiplicateur de PV.
  const POOL4 = [...BASE, "vache", "chasseur", "sonneur"];
  const LV = {
    4: { intro: "druide", pool: [...POOL4, "druide"], boss: ["sonneur"], hp: 1.1 },
    5: { intro: "bigoudene", pool: [...POOL4, "druide", "bigoudene"], boss: ["druide"], hp: 1.15 },
    6: { intro: "rugbyman", pool: [...POOL4, "druide", "bigoudene", "rugbyman"], boss: ["vache"], hp: 1.22 },
    7: { intro: null, pool: [...POOL4, "druide", "bigoudene", "rugbyman"], heavy: "chasseur", boss: ["chasseur"], hp: 1.3 },
    8: { intro: "pompier", pool: [...POOL4, "druide", "bigoudene", "rugbyman", "pompier"], boss: ["pompier"], hp: 1.36 },
    9: { intro: "canard", pool: [...POOL4, "druide", "bigoudene", "rugbyman", "pompier", "canard"], heavy: "canard", boss: ["canard"], hp: 1.42 },
    10: { intro: null, pool: [...POOL4, "druide", "bigoudene", "rugbyman", "pompier", "canard"], boss: ["bigoudene"], hp: 1.5 },
    11: { intro: null, pool: [...POOL4, "druide", "bigoudene", "rugbyman", "pompier", "canard"], boss: ["druide"], hp: 1.58 },
    12: { intro: null, pool: [...POOL4, "druide", "bigoudene", "rugbyman", "pompier", "canard"], boss: ["rugbyman"], hp: 1.66 },
    13: { intro: null, pool: [...POOL4, "druide", "bigoudene", "rugbyman", "pompier", "canard"], boss: ["pompier"], hp: 1.74 },
    14: { intro: null, pool: [...POOL4, "druide", "bigoudene", "rugbyman", "pompier", "canard"], boss: ["vache"], hp: 1.82 },
    15: { intro: null, pool: [...POOL4, "druide", "bigoudene", "rugbyman", "pompier", "canard"], boss: ["vache", "druide", "pompier"], hp: 1.9 },
  };
  S.WAVE_LEVELS = LV;
  // Rang de difficulté des types (les vagues générées débloquent les rangs au fil des vagues).
  const TIER = { fermier: 1, quad: 1, cowboy: 1, vache: 2, chasseur: 2, sonneur: 2, canard: 2, druide: 3, bigoudene: 3, rugbyman: 3, pompier: 4 };

  function parse(line) {
    return line.split(",").map((part) => {
      const bits = part.trim().split(/\s+/);
      return { type: bits[0], count: Number(bits[1]) || 1, champion: bits.includes("boss") || bits.includes("champion"), boss: bits.includes("boss") };
    });
  }
  /** Intervalle entre deux ennemis d'un groupe (s) : les rapides se suivent de près. */
  function gap(type) {
    const v = D.ENEMIES[type].speed;
    return v >= 1.4 ? 0.75 : v <= 0.8 ? 1.3 : 1.0;
  }

  /**
   * Vagues d'une mission. entrances : nombre d'entrées de la carte.
   * Renvoie un tableau de vagues ; chaque vague a ses groupes (aperçu) et ses apparitions minutées.
   */
  S.buildWaves = function (level, entrances) {
    const map = S.MAPS[level];
    const n = map.waves;
    const rnd = PTMT.rng(9001 + level * 97);
    const waves = [];
    const cfg = LV[level];
    for (let w = 0; w < n; w++) {
      let groups;
      if (HAND[level]) groups = parse(HAND[level][w]);
      else groups = compose(level, cfg, w, n, rnd);
      // Entrées : une seule au début, puis deux, puis toutes (cartes à plusieurs entrées).
      const E = entrances;
      const spread = E <= 1 ? 1 : w < n / 3 ? 1 : w < (2 * n) / 3 ? Math.min(2, E) : E;
      groups.forEach((g, k) => (g.entrance = (w + k * Math.max(1, Math.floor(E / spread))) % E));
      if (spread > 1 && groups.length === 1 && groups[0].count >= 4) {
        // Un gros groupe se partage entre plusieurs entrées.
        const g = groups[0];
        const parts = [];
        for (let e = 0; e < spread; e++) {
          const c = Math.round(g.count / spread) + (e === 0 ? g.count - Math.round(g.count / spread) * spread : 0);
          if (c > 0) parts.push({ type: g.type, count: c, champion: g.champion, boss: g.boss, entrance: (w + e) % E });
        }
        groups = parts;
      }
      // PV : le multiplicateur de la mission monte sur les dix premières vagues (début de partie jouable
      // avec peu de tours), puis chaque vague ajoute un peu, de plus en plus vite.
      const levelHp = cfg ? 1 + (cfg.hp - 1) * Math.min(1, 0.35 + w / 14) : level === 3 ? 1.05 : 1;
      const hpMul = levelHp * (1 + (level <= 3 ? 0.02 : 0.025) * w + (level <= 3 ? 0 : 0.0006 * w * w));
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

  function pick(rnd, list) {
    return list[Math.floor(rnd() * list.length) % list.length];
  }
  function compose(level, cfg, w, n, rnd) {
    const last = w === n - 1;
    const budget = (12 + 2.6 * w) * (1 + 0.06 * (level - 4));
    const count = (type, share) => Math.max(2, Math.min(28, Math.round((budget * share) / D.ENEMIES[type].threat)));
    if (last) {
      // Boss (un ou plusieurs) et son escorte.
      const out = cfg.boss.map((type) => ({ type, count: 1, champion: true, boss: true }));
      const escort = pick(rnd, cfg.pool.filter((t) => D.ENEMIES[t].hp >= 100));
      out.push({ type: escort, count: count(escort, 0.45) });
      return out;
    }
    // Présentation du nouvel ennemi, seul, à la troisième vague.
    if (cfg.intro && w === 2) return [{ type: cfg.intro, count: Math.max(3, count(cfg.intro, 0.5)) }];
    // Montée en puissance : d'abord les ennemis simples, puis les coriaces et les rusés.
    const cap = w < 3 ? 1 : w < 8 ? 2 : w < 15 ? 3 : 4;
    let pool = cfg.pool.filter((t) => (TIER[t] || 1) <= cap || (t === cfg.intro && w >= 2));
    if (cfg.intro && w < 2) pool = pool.filter((t) => t !== cfg.intro);
    const groups = [];
    // Vagues « thème » : le type fréquent de la mission revient une vague sur trois.
    if (cfg.heavy && w % 3 === 1 && w >= 3) groups.push({ type: cfg.heavy, count: count(cfg.heavy, 1) });
    else if (w % 4 === 3 || rnd() < 0.35) {
      const type = pick(rnd, pool);
      groups.push({ type, count: count(type, 1) });
    } else {
      const a = pick(rnd, pool);
      let b = pick(rnd, pool);
      if (b === a) b = pick(rnd, pool);
      groups.push({ type: a, count: count(a, 0.55) });
      if (b !== a) groups.push({ type: b, count: count(b, 0.45) });
    }
    // Un champion toutes les cinq vagues (dès la cinquième dans les missions difficiles).
    if (w % 5 === 4 && w >= (level >= 11 ? 4 : 9)) {
      const type = pick(rnd, pool);
      groups.push({ type, count: 1 + (w >= 25 ? 1 : 0), champion: true });
    }
    return groups;
  }
})();
