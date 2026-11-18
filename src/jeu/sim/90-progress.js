// « Pas touche à mes trésors » — progression du joueur (PTMT.progress) : missions gagnées, gemmes
// sauvées, rang « Brillant », points et rangs de compétences, ennemis déjà rencontrés, réglages.
//
// Comme dans Cursed Treasure : chaque mission gagnée pour la première fois rapporte 3 points de
// compétence ; on peut redistribuer les points à tout moment entre les missions. La progression reste
// dans le navigateur (localStorage, clé « ptmt-v3 »), avec repli en mémoire si le stockage est bloqué.
(function () {
  "use strict";
  const PTMT = (globalThis.PTMT = globalThis.PTMT || {});
  const D = PTMT.sim.DATA;
  const KEY = "ptmt-v3";
  let memory = null;

  const P = (PTMT.progress = {});
  P.fresh = () => ({ version: 3, levels: {}, unlocked: 1, skills: {}, seen: {}, settings: { quality: "auto", speed: 1 } });

  P.load = function () {
    let raw = null;
    try {
      raw = globalThis.localStorage ? localStorage.getItem(KEY) : null;
    } catch {}
    let p = null;
    try {
      p = raw ? JSON.parse(raw) : memory ? JSON.parse(memory) : null;
    } catch {}
    return P.sanitize(p);
  };
  P.save = function (p) {
    const text = JSON.stringify(P.sanitize(p));
    memory = text;
    try {
      if (globalThis.localStorage) localStorage.setItem(KEY, text);
    } catch {}
  };
  /** Relit une progression inconnue sans jamais planter (valeurs bornées, compétences cohérentes). */
  P.sanitize = function (p) {
    const out = P.fresh();
    if (!p || typeof p !== "object") return out;
    const maxLevel = PTMT.sim.MAPS ? PTMT.sim.MAPS.length - 1 : 15;
    if (p.levels && typeof p.levels === "object")
      for (const [k, v] of Object.entries(p.levels)) {
        const n = Number(k);
        if (!(n >= 1 && n <= maxLevel) || !v || typeof v !== "object") continue;
        out.levels[n] = { won: !!v.won, bestGems: Math.max(0, Math.floor(v.bestGems || 0)), gemsTotal: Math.max(0, Math.floor(v.gemsTotal || 0)), brilliant: !!v.brilliant };
      }
    const won = Object.keys(out.levels).filter((k) => out.levels[k].won).map(Number);
    out.unlocked = Math.min(maxLevel, Math.max(1, Math.floor(p.unlocked || 1), ...won.map((n) => n + 1)));
    if (p.seen && typeof p.seen === "object") for (const k of Object.keys(p.seen)) if (D.ENEMIES[k]) out.seen[k] = true;
    if (p.settings && typeof p.settings === "object") {
      if (["auto", "high", "low"].includes(p.settings.quality)) out.settings.quality = p.settings.quality;
      if ([1, 2, 3].includes(p.settings.speed)) out.settings.speed = p.settings.speed;
    }
    // Compétences : rangs bornés, puis retrait de ce qui dépasse les points ou les prérequis.
    if (p.skills && typeof p.skills === "object")
      for (const s of D.SKILLS) {
        const r = Math.floor(p.skills[s.id] || 0);
        if (r > 0) out.skills[s.id] = Math.min(s.max, r);
      }
    while (P.pointsSpent(out) > P.pointsTotal(out) || !P.valid(out)) {
      const last = [...D.SKILLS].reverse().find((s) => out.skills[s.id] > 0);
      if (!last) break;
      out.skills[last.id]--;
      if (!out.skills[last.id]) delete out.skills[last.id];
    }
    return out;
  };
  P.pointsTotal = (p) => Object.values(p.levels).filter((l) => l.won).length * D.pointsPerLevel;
  P.pointsSpent = (p) => Object.values(p.skills || {}).reduce((a, b) => a + b, 0);
  P.pointsFree = (p) => Math.max(0, P.pointsTotal(p) - P.pointsSpent(p));
  P.branchPoints = (p, branch) => D.SKILLS.filter((s) => s.branch === branch).reduce((a, s) => a + (p.skills[s.id] || 0), 0);
  /** Chaque compétence prise respecte son prérequis (points dans la branche sans compter elle-même). */
  P.valid = function (p) {
    for (const s of D.SKILLS) {
      const r = p.skills[s.id] || 0;
      if (!r) continue;
      if (P.branchPoints(p, s.branch) - r < s.req) return false;
    }
    return true;
  };
  P.canRaise = function (p, id) {
    const s = D.SKILL[id];
    if (!s) return { ok: false, reason: "Compétence inconnue" };
    const r = p.skills[id] || 0;
    if (r >= s.max) return { ok: false, reason: "Rang maximum" };
    if (P.pointsFree(p) <= 0) return { ok: false, reason: "Plus de point libre : gagne une mission" };
    const have = P.branchPoints(p, s.branch) - r;
    if (have < s.req) return { ok: false, reason: "Demande " + s.req + " points dans la branche " + D.BRANCHES[s.branch].name + " (" + have + ")" };
    return { ok: true };
  };
  P.raise = function (p, id) {
    if (!P.canRaise(p, id).ok) return false;
    p.skills[id] = (p.skills[id] || 0) + 1;
    return true;
  };
  P.canLower = function (p, id) {
    if (!(p.skills[id] > 0)) return { ok: false, reason: "Aucun rang à retirer" };
    p.skills[id]--;
    const ok = P.valid(p);
    p.skills[id]++;
    return ok ? { ok: true } : { ok: false, reason: "D'autres compétences de la branche en dépendent" };
  };
  P.lower = function (p, id) {
    if (!P.canLower(p, id).ok) return false;
    p.skills[id]--;
    if (!p.skills[id]) delete p.skills[id];
    return true;
  };
  P.resetSkills = function (p) {
    p.skills = {};
  };
  P.markSeen = function (p, type) {
    if (!D.ENEMIES[type] || p.seen[type]) return false;
    p.seen[type] = true;
    return true;
  };
  /** Enregistre la fin d'une mission ; renvoie ce qui a changé (pour l'écran de victoire). */
  P.recordResult = function (p, level, over) {
    const cur = p.levels[level] || { won: false, bestGems: 0, gemsTotal: 0, brilliant: false };
    const firstWin = !!over.win && !cur.won;
    if (over.win) {
      cur.won = true;
      cur.bestGems = Math.max(cur.bestGems, over.gemsLeft);
      cur.gemsTotal = over.gemsTotal;
      cur.brilliant = cur.brilliant || !!over.brilliant;
    }
    p.levels[level] = cur;
    const maxLevel = PTMT.sim.MAPS.length - 1;
    const before = p.unlocked;
    if (over.win) p.unlocked = Math.min(maxLevel, Math.max(p.unlocked, level + 1));
    return { firstWin, points: firstWin ? D.pointsPerLevel : 0, unlocked: p.unlocked > before ? p.unlocked : null, best: cur };
  };
})();
