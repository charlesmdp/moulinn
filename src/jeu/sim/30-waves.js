// « Pas touche à mes trésors » — vagues d'ennemis des cinq niveaux et du mode sans fin.
//
// Une vague = des groupes { type, elite, count, interval, delay, entry, target }. `entry` est
// l'identifiant d'une entrée de la disposition, `target` la réserve principalement visée
// (les voleurs se rabattent sur une autre réserve si elle est vide).
(function () {
  "use strict";
  const PTMT = (globalThis.PTMT = globalThis.PTMT || {});

  const g = (type, count, entry, target, opts = {}) => ({
    type,
    count,
    entry,
    target,
    elite: !!opts.elite,
    interval: opts.interval ?? (type === "sprinteur" ? 1.1 : type === "demenageur" ? 2.2 : type === "boss" ? 6 : 1.5),
    delay: opts.delay || 0,
  });
  const E = (type, count, entry, target, opts = {}) => g(type, count, entry, target, Object.assign({ elite: true }, opts));

  const scripts = {
    1: [
      [g("voleur", 5, "N", "A")],
      [g("voleur", 5, "E", "B")],
      [g("voleur", 4, "N", "A"), g("sprinteur", 3, "E", "B", { delay: 4 })],
      [g("voleur", 5, "E", "A"), g("voleur", 4, "N", "B", { delay: 3 })],
      [g("sprinteur", 6, "N", "A"), g("voleur", 5, "E", "B", { delay: 2 })],
      [g("voleur", 7, "N", "B"), g("sprinteur", 5, "E", "A", { delay: 5 })],
      [g("sprinteur", 8, "E", "A", { interval: 0.8 }), g("voleur", 6, "N", "A", { delay: 6 })],
      [g("voleur", 8, "N", "A"), g("voleur", 8, "E", "B", { delay: 1 }), g("sprinteur", 4, "N", "B", { delay: 10 })],
      [g("sprinteur", 8, "N", "B", { interval: 0.9 }), g("voleur", 9, "E", "A"), g("sprinteur", 5, "E", "B", { delay: 12 })],
      [g("voleur", 10, "N", "A"), g("voleur", 10, "E", "B"), g("sprinteur", 8, "N", "A", { delay: 12, interval: 0.8 }), g("sprinteur", 6, "E", "B", { delay: 16 })],
    ],
    // Trois portes : le chemin des champs (NW) et le gué du sud (S) à l'ouest de la rivière, la route
    // de la colline (NE) à l'est. Viser l'autre rive oblige à passer le pont.
    2: [
      [g("voleur", 5, "NW", "B"), g("voleur", 5, "NE", "A", { delay: 2 })],
      [g("sprinteur", 5, "S", "B"), g("voleur", 5, "NE", "A", { delay: 3 })],
      [g("demenageur", 2, "NE", "A"), g("voleur", 6, "NW", "B", { delay: 2 })],
      [g("voleur", 6, "S", "A"), g("demenageur", 2, "NW", "B", { delay: 5 })],
      [g("sprinteur", 7, "NE", "A", { interval: 0.9 }), g("sprinteur", 7, "NW", "B", { interval: 0.9, delay: 2 })],
      [g("demenageur", 3, "NE", "A"), g("voleur", 8, "S", "B", { delay: 3 }), g("voleur", 5, "NE", "A", { delay: 10 })],
      [g("voleur", 9, "NW", "A"), g("demenageur", 3, "NE", "B", { delay: 4 })],
      [g("sprinteur", 8, "S", "A", { interval: 0.8 }), g("demenageur", 3, "NW", "B"), g("voleur", 7, "NE", "A", { delay: 8 })],
      [g("demenageur", 4, "NE", "A"), g("demenageur", 4, "NW", "B", { delay: 2 }), g("sprinteur", 6, "S", "B", { delay: 12 })],
      [g("voleur", 10, "NE", "A"), g("voleur", 10, "NW", "B"), g("demenageur", 3, "S", "A", { delay: 8 })],
      [g("sprinteur", 10, "NE", "B", { interval: 0.7 }), g("demenageur", 4, "NE", "A", { delay: 3 }), g("voleur", 8, "S", "B", { delay: 6 })],
      [g("demenageur", 5, "NW", "A"), g("demenageur", 5, "NE", "B", { delay: 3 }), g("voleur", 12, "S", "A", { delay: 6 }), g("sprinteur", 10, "NE", "B", { delay: 14, interval: 0.8 })],
    ],
    // Trois portes, trois réserves : chaque porte mène à deux réserves.
    3: [
      [g("voleur", 6, "W", "A")],
      [g("voleur", 6, "N", "B")],
      [g("sprinteur", 6, "E", "C"), g("voleur", 4, "W", "C", { delay: 5 })],
      [g("fumigene", 3, "W", "C"), g("voleur", 5, "N", "A", { delay: 4 })],
      [g("demenageur", 3, "E", "B"), g("fumigene", 3, "W", "C", { delay: 6 })],
      [g("voleur", 5, "W", "A"), g("voleur", 5, "N", "B"), g("voleur", 5, "E", "C")],
      [E("voleur", 4, "N", "A"), g("sprinteur", 6, "E", "C", { delay: 3 })],
      [g("fumigene", 5, "E", "B"), g("demenageur", 3, "W", "C", { delay: 5 })],
      [E("sprinteur", 4, "W", "C"), g("voleur", 8, "N", "B", { delay: 2 }), g("fumigene", 3, "E", "A", { delay: 10 })],
      [g("demenageur", 4, "W", "C"), E("voleur", 5, "E", "B", { delay: 4 }), g("sprinteur", 6, "N", "A", { delay: 8 })],
      [g("fumigene", 6, "N", "A"), g("fumigene", 6, "E", "C", { delay: 3 })],
      [E("demenageur", 2, "W", "C"), g("voleur", 10, "N", "B"), g("sprinteur", 8, "E", "C", { delay: 10, interval: 0.8 })],
      [E("fumigene", 3, "E", "A"), E("voleur", 6, "W", "B", { delay: 2 }), g("demenageur", 4, "N", "C", { delay: 6 })],
      [g("voleur", 8, "W", "A"), g("voleur", 8, "N", "B"), g("voleur", 8, "E", "C"), E("sprinteur", 6, "E", "C", { delay: 12 })],
      [E("demenageur", 3, "N", "A"), E("fumigene", 5, "E", "B", { delay: 3 }), g("sprinteur", 10, "W", "C", { delay: 6, interval: 0.7 }), g("demenageur", 4, "E", "C", { delay: 14 })],
    ],
    // Deux portes (chemin du nord, plage du sud) et le ruisseau d'amont des nageurs.
    4: [
      [g("nageur", 5, "Ww", "B")],
      [g("voleur", 6, "N", "B"), g("nageur", 4, "Ww", "A", { delay: 5 })],
      [g("nageur", 6, "Ww", "A"), g("sprinteur", 5, "N", "C", { delay: 3 })],
      [g("demenageur", 3, "S", "A"), g("nageur", 5, "Ww", "C", { delay: 4 })],
      [g("fumigene", 4, "S", "B"), g("nageur", 6, "Ww", "A", { delay: 6 })],
      [E("nageur", 3, "Ww", "B"), g("voleur", 8, "N", "C", { delay: 2 })],
      [g("sprinteur", 8, "S", "A", { interval: 0.8 }), g("nageur", 6, "Ww", "C", { delay: 5 })],
      [g("demenageur", 4, "N", "B"), E("voleur", 5, "S", "A", { delay: 4 }), g("nageur", 6, "Ww", "B", { delay: 8 })],
      [E("nageur", 5, "Ww", "A"), g("fumigene", 5, "N", "C", { delay: 3 })],
      [g("voleur", 10, "S", "A"), g("voleur", 8, "N", "B", { delay: 2 }), E("sprinteur", 5, "N", "C", { delay: 8 })],
      [g("nageur", 10, "Ww", "B", { interval: 1.1 }), E("demenageur", 2, "S", "A", { delay: 6 })],
      [E("fumigene", 4, "S", "B"), E("nageur", 6, "Ww", "C", { delay: 4 }), g("sprinteur", 8, "N", "C", { delay: 10, interval: 0.8 })],
      [g("demenageur", 5, "S", "C"), g("nageur", 8, "Ww", "A", { delay: 3 }), E("voleur", 6, "N", "B", { delay: 8 })],
      [E("nageur", 8, "Ww", "B"), E("sprinteur", 6, "S", "A", { delay: 5 }), g("fumigene", 6, "N", "C", { delay: 10 })],
      [E("demenageur", 4, "S", "A"), E("nageur", 10, "Ww", "B", { delay: 2 }), E("fumigene", 5, "N", "C", { delay: 8 }), g("sprinteur", 10, "N", "B", { delay: 14, interval: 0.7 })],
    ],
    // Trois portes (lisière ouest, chemin du nord, route de l'est) ; le gué du sud et le talus du
    // sud-est ne servent qu'à fuir.
    5: [
      [g("voleur", 6, "W", "B"), g("voleur", 6, "N", "A", { delay: 3 })],
      [g("sprinteur", 6, "E", "C"), g("voleur", 6, "W", "B", { delay: 3 })],
      [g("demenageur", 3, "N", "A"), g("fumigene", 4, "E", "C", { delay: 4 })],
      [g("voleur", 6, "W", "B"), g("voleur", 6, "N", "C"), g("sprinteur", 6, "E", "A", { delay: 6 })],
      [E("voleur", 5, "N", "A"), g("demenageur", 3, "W", "B", { delay: 5 })],
      [g("fumigene", 6, "W", "B"), E("sprinteur", 5, "E", "C", { delay: 4 })],
      [g("demenageur", 4, "E", "A"), g("voleur", 8, "W", "C", { delay: 2 }), g("sprinteur", 6, "N", "B", { delay: 8 })],
      [E("demenageur", 2, "W", "B"), E("fumigene", 4, "N", "A", { delay: 4 }), g("voleur", 8, "E", "C", { delay: 8 })],
      [g("sprinteur", 10, "N", "A", { interval: 0.7 }), g("sprinteur", 10, "W", "C", { interval: 0.7, delay: 2 })],
      [g("boss", 1, "N", "A"), g("voleur", 8, "E", "C", { delay: 6 }), g("voleur", 8, "W", "B", { delay: 6 })],
      [E("voleur", 8, "W", "B"), g("demenageur", 5, "E", "A", { delay: 4 }), g("fumigene", 5, "N", "C", { delay: 8 })],
      [E("sprinteur", 8, "W", "A"), E("fumigene", 5, "E", "B", { delay: 5 }), g("demenageur", 4, "E", "C", { delay: 10 })],
      [g("voleur", 10, "N", "A"), g("voleur", 10, "E", "C"), g("voleur", 10, "W", "B"), E("demenageur", 3, "E", "A", { delay: 12 })],
      [E("fumigene", 6, "E", "C"), E("demenageur", 3, "N", "B", { delay: 4 }), g("sprinteur", 10, "E", "A", { delay: 9, interval: 0.7 })],
      [g("boss", 1, "E", "C"), E("voleur", 8, "W", "B", { delay: 4 }), g("fumigene", 6, "N", "A", { delay: 8 })],
      [E("sprinteur", 10, "W", "B", { interval: 0.7 }), E("demenageur", 4, "E", "C", { delay: 4 }), E("voleur", 8, "N", "A", { delay: 8 })],
      [g("demenageur", 6, "W", "A"), E("fumigene", 6, "E", "B", { delay: 3 }), E("sprinteur", 8, "E", "C", { delay: 8 })],
      [E("voleur", 10, "N", "A"), E("voleur", 10, "E", "C"), E("demenageur", 4, "W", "B", { delay: 6 }), g("sprinteur", 12, "W", "B", { delay: 12, interval: 0.6 })],
      [g("boss", 1, "W", "B"), g("boss", 1, "E", "A", { delay: 8 }), E("fumigene", 6, "E", "C", { delay: 4 }), E("sprinteur", 8, "N", "A", { delay: 14 })],
      [g("boss", 1, "N", "A"), E("demenageur", 5, "E", "C", { delay: 3 }), E("voleur", 12, "W", "B", { delay: 5 }), E("fumigene", 8, "E", "A", { delay: 10 }), E("sprinteur", 12, "E", "C", { delay: 16, interval: 0.6 })],
    ],
  };

  /** Vagues d'un niveau (copie profonde). */
  function levelWaves(level) {
    return JSON.parse(JSON.stringify(scripts[level] || []));
  }

  /**
   * Vague du mode sans fin numéro n (n = 1 pour la première vague supplémentaire) : plus
   * d'élites, plusieurs fronts, des porteurs rapides, un boss toutes les cinq vagues (variante
   * élite à partir de la dixième). Reproductible : dépend de la graine de la disposition.
   */
  function endlessWave(L, level, n) {
    const rnd = PTMT.rng(L.seed * 97 + n * 131 + level);
    const land = L.entries.filter((e) => e.kind === "land").map((e) => e.id);
    const water = L.entries.filter((e) => e.kind === "water").map((e) => e.id);
    const reserves = L.reserves.map((r) => r.id);
    const pick = (a) => a[Math.floor(rnd() * a.length)];
    const types = ["voleur", "sprinteur", "demenageur", "fumigene"].concat(water.length ? ["nageur"] : []);
    const eliteShare = Math.min(0.85, 0.3 + n * 0.035);
    const fronts = Math.min(land.length, 2 + Math.floor(n / 4));
    const groups = [];
    const pressure = 1 + n * 0.08;
    const spacing = Math.max(0.55, 1.2 - n * 0.02);
    for (let f = 0; f < fronts; f++) {
      const type = pick(types);
      const entry = type === "nageur" ? pick(water) : land[(f + n) % land.length];
      const base = type === "demenageur" ? 3 : type === "sprinteur" ? 8 : 7;
      const count = Math.round(base * pressure * (0.8 + rnd() * 0.4));
      const eliteCount = Math.round(count * eliteShare);
      const target = pick(reserves);
      if (count - eliteCount > 0) groups.push(g(type, count - eliteCount, entry, target, { delay: f * 2 + rnd() * 3, interval: spacing * (type === "demenageur" ? 1.8 : 1) }));
      if (eliteCount > 0) groups.push(E(type, eliteCount, entry, target, { delay: f * 2 + 4 + rnd() * 3, interval: spacing * (type === "demenageur" ? 1.8 : 1) }));
    }
    // Porteurs rapides en fin de vague.
    groups.push(E("sprinteur", 4 + Math.floor(n / 2), pick(land), pick(reserves), { delay: 12, interval: 0.6 }));
    if (n % 5 === 0) {
      const eliteBoss = n >= 10;
      groups.push(g("boss", 1 + Math.floor(n / 15), pick(land), pick(reserves), { delay: 3, elite: eliteBoss }));
    }
    return { groups, bossWarning: n % 5 === 0, eliteBoss: n % 5 === 0 && n >= 10 };
  }

  PTMT.waves = { levelWaves, endlessWave, scripts };
})();
