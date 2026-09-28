// « Pas touche à mes trésors » — compétences permanentes (Feu, Glace, Eau).
//
// Chaque rang coûte 1 point. Talents de base : disponibles tout de suite ; avancés : 5 points déjà
// dépensés dans la famille ; ultime : 9 points dans la famille et au moins un talent avancé au
// rang 2. Les valeurs indiquées sont les totaux atteints à chaque rang.
(function () {
  "use strict";
  const PTMT = (globalThis.PTMT = globalThis.PTMT || {});
  const C = PTMT.config;

  function emptyAllocation() {
    const a = {};
    for (const fam of ["fire", "ice", "water"]) {
      a[fam] = {};
      for (const t of C.talents[fam].items) a[fam][t.id] = 0;
    }
    return a;
  }

  function spentIn(alloc, fam) {
    return Object.values(alloc[fam] || {}).reduce((s, r) => s + r, 0);
  }
  function spentTotal(alloc) {
    return ["fire", "ice", "water"].reduce((s, f) => s + spentIn(alloc, f), 0);
  }

  function tierSpent(alloc, fam, tier) {
    return C.talents[fam].items.filter((t) => t.tier === tier).reduce((s, t) => s + ((alloc[fam] && alloc[fam][t.id]) || 0), 0);
  }
  function hasAdvancedRank2(alloc, fam) {
    return C.talents[fam].items.filter((t) => t.tier === "advanced").some((t) => ((alloc[fam] && alloc[fam][t.id]) || 0) >= 2);
  }

  /** Peut-on ajouter un rang à ce talent ? Renvoie null si oui, sinon la raison. */
  function canRankUp(alloc, fam, id, available) {
    const def = C.talents[fam].items.find((t) => t.id === id);
    if (!def) return "Talent inconnu";
    const r = alloc[fam][id] || 0;
    if (r >= def.ranks) return "Rang maximum atteint";
    if (available - spentTotal(alloc) < 1) return "Aucun point disponible";
    const base = tierSpent(alloc, fam, "base"),
      adv = tierSpent(alloc, fam, "advanced");
    if (def.tier === "advanced" && base < C.talents.advancedNeeds) return `Demande ${C.talents.advancedNeeds} points en ${C.talents[fam].name}`;
    if (def.tier === "ultimate") {
      if (base + adv < C.talents.ultimateNeeds) return `Demande ${C.talents.ultimateNeeds} points en ${C.talents[fam].name}`;
      if (!hasAdvancedRank2(alloc, fam)) return "Demande un talent avancé au rang 2";
    }
    return null;
  }

  /** Retirer un rang doit laisser une répartition valide (prérequis des talents supérieurs). */
  function canRankDown(alloc, fam, id) {
    const r = alloc[fam][id] || 0;
    if (r <= 0) return "Aucun rang à retirer";
    const test = JSON.parse(JSON.stringify(alloc));
    test[fam][id] = r - 1;
    return validate(test, Infinity) ? null : "Un talent supérieur en dépend";
  }

  /** Vérifie une répartition complète (rangs, prérequis et total). */
  function validate(alloc, available) {
    if (spentTotal(alloc) > available) return false;
    for (const fam of ["fire", "ice", "water"]) {
      for (const def of C.talents[fam].items) {
        const r = (alloc[fam] && alloc[fam][def.id]) || 0;
        if (r < 0 || r > def.ranks || r !== Math.floor(r)) return false;
      }
      const base = tierSpent(alloc, fam, "base"),
        adv = tierSpent(alloc, fam, "advanced"),
        ult = tierSpent(alloc, fam, "ultimate");
      if (adv > 0 && base < C.talents.advancedNeeds) return false;
      if (ult > 0 && (base + adv < C.talents.ultimateNeeds || !hasAdvancedRank2(alloc, fam))) return false;
    }
    return true;
  }

  /** Modificateurs de jeu issus d'une répartition. */
  function resolve(alloc) {
    alloc = alloc || emptyAllocation();
    const v = (fam, id) => {
      const def = C.talents[fam].items.find((t) => t.id === id);
      const r = (alloc[fam] && alloc[fam][id]) || 0;
      return r ? def.values[r - 1] : 0;
    };
    const hyd = v("water", "hydraulics");
    return {
      burnDuration: 1 + v("fire", "embers"),
      explosionRadius: 1 + v("fire", "boom"),
      meteorDamage: 1 + v("fire", "meteorPower"),
      fireDamage: 1 + v("fire", "furnace"),
      meteorCooldown: 1 - v("fire", "meteorHaste"),
      contagion: !!v("fire", "contagion"),
      iceRange: 1 + v("ice", "longview"),
      iceSlow: v("ice", "bite"),
      freezeDuration: 1 + v("ice", "holdfast"),
      freezeMana: 1 - v("ice", "thrift"),
      shatter: v("ice", "shards"),
      brittle: v("ice", "brittle"),
      push: 1 + v("water", "pump"),
      waterArea: 1 + v("water", "basin"),
      wetBonus: v("water", "soaked"),
      wetFreeze: 1 + v("water", "frostwater"),
      heavyWater: hyd ? hyd[0] : C.control.heavy.displacement,
      bossWater: hyd ? hyd[1] : C.control.boss.displacement,
      insatiable: !!v("water", "insatiable"),
    };
  }

  PTMT.talents = { emptyAllocation, spentIn, spentTotal, canRankUp, canRankDown, validate, resolve };
})();
