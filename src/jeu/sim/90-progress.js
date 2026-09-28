// « Pas touche à mes trésors » — progression permanente (étoiles, points de talent, déblocages,
// records) et point de reprise de la partie en cours. Stockés séparément dans le navigateur.
(function () {
  "use strict";
  const PTMT = (globalThis.PTMT = globalThis.PTMT || {});
  const C = PTMT.config;
  const KEY_PROGRESS = "ptmt.progress.v1";
  const KEY_SAVE = "ptmt.save.v1";

  function fresh() {
    const levels = {};
    for (let l = 1; l <= 5; l++) levels[l] = { stars: 0, won: false, rewards: { win: false, star2: false, star3: false } };
    return { v: 1, unlockedLevel: 1, highestStarted: 1, levels, talents: PTMT.talents.emptyAllocation(), records: {}, tutorial: {} };
  }
  function pointsEarned(p) {
    let n = 0;
    for (const l of Object.values(p.levels)) n += (l.rewards.win ? C.rewards.win : 0) + (l.rewards.star2 ? C.rewards.star2 : 0) + (l.rewards.star3 ? C.rewards.star3 : 0);
    return n;
  }
  function pointsAvailable(p) {
    return pointsEarned(p) - PTMT.talents.spentTotal(p.talents);
  }
  /** Enregistre un résultat ; renvoie les nouveaux points et déblocages. Rejouer ne redonne rien. */
  function recordResult(p, level, result) {
    const L = p.levels[level];
    let points = 0;
    if (result.win) {
      if (!L.rewards.win) {
        L.rewards.win = true;
        points += C.rewards.win;
      }
      if (result.stars >= 2 && !L.rewards.star2) {
        L.rewards.star2 = true;
        points += C.rewards.star2;
      }
      if (result.stars >= 3 && !L.rewards.star3) {
        L.rewards.star3 = true;
        points += C.rewards.star3;
      }
      L.won = true;
      L.stars = Math.max(L.stars, result.stars);
      p.unlockedLevel = Math.min(5, Math.max(p.unlockedLevel, level + 1));
    }
    return { points, unlockedLevel: p.unlockedLevel };
  }
  function markStarted(p, level) {
    p.highestStarted = Math.max(p.highestStarted || 1, level);
  }
  /** Sorts disponibles : ceux des niveaux déjà atteints restent acquis, même en rejouant. */
  function unlockedSpells(p, level) {
    const reach = Math.max(level, p.highestStarted || 1);
    return Object.entries(C.spells.unlockLevel)
      .filter(([, l]) => l <= reach)
      .map(([k]) => k);
  }
  function recordEndless(p, level, layoutId, waves) {
    const key = level + ":" + layoutId;
    const prev = p.records[key] || 0;
    if (waves > prev) p.records[key] = waves;
    return waves > prev;
  }
  function storage() {
    try {
      return globalThis.localStorage || null;
    } catch {
      return null;
    }
  }
  function load() {
    const st = storage();
    try {
      const raw = st && st.getItem(KEY_PROGRESS);
      if (raw) {
        const p = JSON.parse(raw);
        const f = fresh();
        const merged = Object.assign(f, p);
        merged.levels = Object.assign(f.levels, p.levels || {});
        if (!PTMT.talents.validate(merged.talents || {}, pointsEarned(merged))) merged.talents = PTMT.talents.emptyAllocation();
        return merged;
      }
    } catch {}
    return fresh();
  }
  function save(p) {
    const st = storage();
    try {
      st && st.setItem(KEY_PROGRESS, JSON.stringify(p));
    } catch {}
  }
  function loadCheckpoint() {
    const st = storage();
    try {
      const raw = st && st.getItem(KEY_SAVE);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
  function saveCheckpoint(cp) {
    const st = storage();
    try {
      if (cp) st && st.setItem(KEY_SAVE, JSON.stringify(cp));
      else st && st.removeItem(KEY_SAVE);
    } catch {}
  }

  PTMT.progress = { fresh, pointsEarned, pointsAvailable, recordResult, markStarted, unlockedSpells, recordEndless, load, save, loadCheckpoint, saveCheckpoint };
})();
