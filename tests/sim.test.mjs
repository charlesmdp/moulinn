// Vérifications de la simulation de « Pas touche à mes trésors » v3 (node tests/sim.test.mjs).
// Règles de Cursed Treasure : terrains, gemmes volées puis ramassées par les autres, capacités des
// ennemis, sorts, compétences, progression, et un robot qui doit gagner les quinze missions.
import { loadSim } from "./load-sim.mjs";
import { makeBot, botSkills } from "./bot.mjs";

const P = loadSim();
const S = P.sim;
const D = S.DATA;
let failed = 0,
  passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log("  ✓ " + name);
  } catch (e) {
    failed++;
    console.log("  ✗ " + name + "\n      " + (e && e.stack ? e.stack.split("\n").slice(0, 4).join("\n      ") : e));
  }
}
function ok(c, msg) {
  if (!c) throw new Error(msg || "assertion");
}
function eq(a, b, msg) {
  if (a !== b) throw new Error((msg || "égalité") + ` : ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`);
}
const run = (g, seconds) => {
  for (let t = 0; t < seconds; t += 0.1) g.step(0.1);
};
/** Partie sans vagues automatiques : on place les ennemis à la main. */
function quiet(level = 1, opts = {}) {
  const g = S.createGame(Object.assign({ level, seed: 3 }, opts));
  g.state.wave.countdown = 1e9;
  return g;
}
function spawnAt(g, type, i, j, extra = {}) {
  g.spawn(Object.assign({ type, champion: false, boss: false, entrance: 0, hpMul: 1 }, extra));
  const e = g.state.enemies[g.state.enemies.length - 1];
  if (i !== undefined) {
    e.cur = [i, j];
    e.next = null;
    e.px = e.x = i + 0.5;
    e.py = e.y = j + 0.5;
    e.retarget = true;
  }
  return e;
}
function checkGems(g) {
  const s = g.state;
  const ids = new Set();
  for (const gem of s.gems) {
    ok(["lair", "ground", "carried", "lost"].includes(gem.where), "état de gemme " + gem.where);
    ok(!ids.has(gem.id), "gemme en double");
    ids.add(gem.id);
    if (gem.where === "carried") ok(s.enemies.some((e) => !e.dead && e.carrying === gem.id), "porteur de la gemme " + gem.id);
  }
  const carriers = s.enemies.filter((e) => !e.dead && e.carrying);
  eq(new Set(carriers.map((e) => e.carrying)).size, carriers.length, "une gemme par porteur");
}

console.log("Données et cartes");
test("chaque famille a 7 niveaux par spécialisation", () => {
  for (const f of ["boar", "swan", "dog"]) {
    for (let l = 1; l <= 3; l++) ok(D.towerLevel(f, l, null), f + l);
    for (const sp of ["A", "B"]) for (let l = 4; l <= 7; l++) ok(D.towerLevel(f, l, sp).cost > 0, f + l + sp);
  }
});
test("quinze missions valides : chaque entrée rejoint le repaire, à pied et à la nage", () => {
  eq(S.MAPS.length - 1, 15);
  for (let n = 1; n <= 15; n++) {
    const m = S.MAPS[n];
    const g = new S.Grid(m);
    const f = g.toLair(false),
      fs = g.toLair(true);
    for (const e of g.entrances) {
      ok(g.at(f, e.i, e.j) < 1e8, m.name + " : entrée " + e.id);
      ok(g.at(fs, e.i, e.j) <= g.at(f, e.i, e.j), "la nage n'allonge jamais");
    }
    for (const [i, j] of m.mill) eq(g.char(i, j), "X", m.name + " moulin sur X");
    for (const [i, j] of m.mana) ok(D.TILES[g.char(i, j)].build, m.name + " menhir constructible");
    eq(S.buildWaves(n, g.entrances.length).length, m.waves, m.name + " : nombre de vagues");
  }
});
test("le Carrefour a un raccourci à la nage pour les canards", () => {
  const g = new S.Grid(S.MAPS[9]);
  const e = g.entrances.find((x) => x.j === 0);
  ok(g.at(g.toLair(true), e.i, e.j) < g.at(g.toLair(false), e.i, e.j) - 4);
});
test("boss à la dernière vague dès la mission 2 ; nouvel ennemi présenté seul", () => {
  for (let n = 2; n <= 15; n++) {
    const w = S.buildWaves(n, 1);
    ok(w[w.length - 1].groups.some((g) => g.boss), "boss mission " + n);
  }
  const w4 = S.buildWaves(4, 3);
  ok(w4[2].groups.every((g) => g.type === "druide"), "druide présenté seul en mission 4");
  ok(!w4[0].groups.some((g) => g.type === "druide") && !w4[1].groups.some((g) => g.type === "druide"), "pas de druide avant");
});

console.log("Construction, amélioration, sorts");
test("terrains : sanglier sur l'herbe, cygne sur l'eau, berger sur la roche, butte = tous", () => {
  const g = quiet(1);
  const grid = g.grid;
  const find = (c) => {
    for (let j = 0; j < D.H; j++) for (let i = 0; i < D.W; i++) if (grid.char(i, j) === c) return [i, j];
  };
  const [gi, gj] = find(".");
  const [wi, wj] = find("~");
  const [ri, rj] = find("^");
  const [hi, hj] = find("H");
  ok(!g.build(gi, gj, "dog").ok, "berger refusé sur l'herbe");
  ok(g.build(gi, gj, "boar").ok, "sanglier sur l'herbe");
  ok(!g.build(gi, gj, "boar").ok, "case déjà prise");
  g.state.gold = 1000;
  ok(g.build(wi, wj, "swan").ok, "cygne sur l'eau");
  ok(g.build(ri, rj, "dog").ok, "berger sur la roche");
  ok(g.build(hi, hj, "swan").ok, "cygne sur la butte");
  ok(g.towerAt(hi, hj).high, "bonus de butte");
  const [ci, cj] = find("#");
  ok(!g.build(ci, cj, "boar").ok, "pas sur le chemin");
});
test("forêt : Couper coûte du mana et rend la case constructible", () => {
  const g = quiet(1);
  let fi, fj;
  for (let j = 0; j < D.H && fi === undefined; j++) for (let i = 0; i < D.W; i++) if (g.grid.char(i, j) === "f") { fi = i; fj = j; break; }
  ok(!g.build(fi, fj, "boar").ok, "boisée : refusée");
  const mana = g.state.mana;
  ok(g.cast("cut", { x: fi + 0.5, y: fj + 0.5 }).ok, "coupe");
  eq(g.grid.char(fi, fj), ".");
  ok(Math.abs(g.state.mana - (mana - D.SPELLS.cut.cost)) < 1e-9, "mana dépensé");
  ok(g.build(fi, fj, "boar").ok, "constructible après la coupe");
  ok(g.drainEvents().some((e) => e.type === "cut"), "événement cut");
});
test("amélioration : l'expérience d'abord, puis l'or ; spécialisation obligatoire au niveau 4", () => {
  const g = quiet(1);
  g.state.gold = 5000;
  const r = g.build(4, 2, "boar");
  ok(r.ok);
  const t = g.towerById(r.towerId);
  ok(!g.upgrade(t.id).ok, "pas sans expérience");
  t.xp = 1000;
  ok(g.upgrade(t.id).ok && t.level === 2);
  ok(g.upgrade(t.id).ok && t.level === 3);
  ok(!g.upgrade(t.id).ok, "spécialisation requise");
  ok(g.upgrade(t.id, "B").ok && t.level === 4 && t.spec === "B");
  const info = g.towerInfo(t.id);
  eq(info.name, "Laie baliste");
  ok(info.stats.splash > 0, "tir de zone");
  while (t.level < 7) ok(g.upgrade(t.id).ok);
  eq(g.towerInfo(t.id).name, "Catapulte à châtaignes");
  ok(!g.upgrade(t.id).ok, "niveau maximum");
  const sold = g.sell(t.id);
  ok(sold.ok && sold.gold === Math.floor(t.invested * D.economy.sellRatio), "revente à 60 %");
});
test("Frénésie double la cadence ; Météore frappe après son délai", () => {
  const g = quiet(3);
  g.state.gold = 1000;
  g.state.mana = 100;
  const r = g.build(4, 2, "boar");
  ok(r.ok);
  const e = spawnAt(g, "vache", 4, 1, { hpMul: 100 });
  e.baseSpeed = 0;
  run(g, 5);
  const t = g.towerById(r.towerId);
  const before = t.shots;
  run(g, 4);
  const normal = t.shots - before;
  g.state.mana = 100;
  ok(g.cast("frenzy").ok);
  const b2 = t.shots;
  run(g, 4);
  const fast = t.shots - b2;
  ok(fast >= normal * 1.7, `frénésie ${fast} tirs contre ${normal}`);
  g.state.mana = 100;
  const hp = e.hp;
  ok(g.cast("meteor", { x: e.x, y: e.y }).ok);
  g.tick(0.1);
  ok(e.hp >= hp - 60, "pas encore d'impact");
  run(g, 1);
  ok(g.drainEvents().some((ev) => ev.type === "meteorImpact"), "impact");
});

console.log("Gemmes et intelligence des ennemis");
test("un ennemi prend une gemme au repaire et repart vers la sortie", () => {
  const g = quiet(2);
  const L = g.grid.lair;
  const [ni, nj] = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => [L.i + a, L.j + b]).find(([a, b]) => g.grid.walkable(a, b));
  const e = spawnAt(g, "fermier", ni, nj);
  run(g, 3);
  ok(e.carrying, "porte une gemme");
  eq(e.goal, "exit");
  eq(g.state.gemCount.lair, 4);
  checkGems(g);
});
test("porteur tué : la gemme tombe et les autres vont la chercher tout droit, demi-tour compris", () => {
  const g = quiet(1);
  const s = g.state;
  // Un porteur au milieu du chemin, un ennemi plus près de l'entrée, un autre plus près du repaire.
  const carrier = spawnAt(g, "fermier", 16, 3);
  const gem = s.gems[0];
  gem.where = "carried";
  gem.carrier = carrier.id;
  carrier.carrying = gem.id;
  g.countGems();
  const behind = spawnAt(g, "quad", 12, 1);
  const ahead = spawnAt(g, "fermier", 10, 5);
  run(g, 0.5);
  eq(ahead.target, "lair", "va au repaire avant la chute");
  g.hurt(carrier, 1e6, { pierce: true });
  checkGems(g);
  eq(gem.where, "ground", "gemme au sol");
  run(g, 0.2);
  eq(behind.target, gem.id, "l'ennemi de derrière vise la gemme");
  eq(ahead.target, gem.id, "celui de devant fait demi-tour pour elle");
  run(g, 6);
  ok(behind.carrying === gem.id || ahead.carrying === gem.id, "ramassée par l'un des deux");
  const other = behind.carrying === gem.id ? ahead : behind;
  ok(other.target !== gem.id, "l'autre repart vers une autre gemme");
  const holder = behind.carrying === gem.id ? behind : ahead;
  eq(holder.goal, "exit", "le ramasseur repart vers la sortie");
  checkGems(g);
});
test("gemme emportée dehors = perdue ; plus aucune gemme = défaite", () => {
  const g = quiet(2);
  const s = g.state;
  for (const gem of s.gems) gem.where = "lost";
  s.gems[0].where = "lair";
  g.countGems();
  const e = spawnAt(g, "quad", 14, 1);
  run(g, 60);
  ok(s.over && !s.over.win, "défaite");
  eq(s.gemCount.lost, s.gemCount.total);
});
test("cow-boy : le lasso attrape une gemme au sol à une case et demie", () => {
  const g = quiet(1);
  const gem = g.state.gems[0];
  gem.where = "ground";
  gem.x = 8.5;
  gem.y = 2.3; // à côté du chemin (ligne 1)
  g.countGems();
  const e = spawnAt(g, "cowboy", 5, 1);
  run(g, 4);
  eq(e.carrying, gem.id);
  ok(g.drainEvents().some((ev) => ev.type === "lasso"), "événement lasso");
});
test("Portail de retour : une gemme oubliée revient au moulin", () => {
  const g = quiet(1, { skills: { returnPortal: 1, meteorStudy: 3 } });
  eq(g.mods.portal, 40);
  const gem = g.state.gems[0];
  gem.where = "ground";
  gem.x = 1.5;
  gem.y = 1.5;
  gem.returnIn = g.mods.portal;
  g.countGems();
  run(g, 41);
  eq(gem.where, "lair");
});

console.log("Capacités des ennemis");
test("bouclier de la vache : −5 par coup, sauf le feu du berger qui perce", () => {
  const g = quiet(3);
  const e = spawnAt(g, "vache", 3, 5, { hpMul: 10 });
  const hp = e.hp;
  g.hurt(e, 12, {});
  ok(Math.abs(hp - e.hp - 7) < 1e-9, "12 − 5");
  const hp2 = e.hp;
  g.hurt(e, 12, { pierce: true });
  ok(Math.abs(hp2 - e.hp - 12) < 1e-9, "perce");
});
test("barrière du druide : absorbe, casse, se reforme après 6 s sans coup", () => {
  const g = quiet(4);
  const e = spawnAt(g, "druide", 3, 5);
  e.baseSpeed = 0;
  g.hurt(e, 60, {});
  eq(e.hp, e.hpMax, "absorbé");
  g.hurt(e, 60, {});
  eq(e.barrier, 0);
  ok(e.hp < e.hpMax);
  ok(g.drainEvents().some((ev) => ev.type === "barrierBreak"));
  run(g, 6.3);
  eq(e.barrier, e.barrierMax, "barrière reformée");
});
test("bigoudène : soigne l'allié le plus blessé", () => {
  const g = quiet(5);
  const b = spawnAt(g, "bigoudene", 3, 5);
  const f = spawnAt(g, "fermier", 3, 6);
  b.baseSpeed = f.baseSpeed = 0;
  f.hp = 5;
  run(g, 3.5);
  ok(f.hp > 30, "soigné : " + f.hp);
});
test("chasseur : fumigène au premier coup, invisible donc hors de portée des tours", () => {
  const g = quiet(7);
  g.state.gold = 1000;
  const r = g.build(4, 4, "boar");
  const e = spawnAt(g, "chasseur", 3, 5, { hpMul: 50 });
  e.baseSpeed = 0;
  g.hurt(e, 1, {});
  ok(e.t.invis > 0, "invisible");
  eq(g.pickTarget(g.towerById(r.towerId), 3), null, "pas ciblé");
  run(g, 5.2);
  ok(g.pickTarget(g.towerById(r.towerId), 3), "de nouveau visible");
});
test("rugbyman : esquive environ la moitié des tirs visés", () => {
  const g = quiet(6);
  let evaded = 0;
  for (let k = 0; k < 400; k++) {
    const e = spawnAt(g, "rugbyman", 3, 5, { hpMul: 100 });
    g.impact({ st: { dmg: 1 }, fromTowerId: null, x: e.x, y: e.y, kind: "chestnut" }, e);
    if (e.hp === e.hpMax) evaded++;
    e.dead = true;
  }
  ok(evaded > 150 && evaded < 250, "esquives " + evaded + " / 400");
});
test("sonneur : double la vitesse des alliés proches", () => {
  const g = quiet(4);
  const s = spawnAt(g, "sonneur", 3, 6);
  const f = spawnAt(g, "fermier", 3, 7);
  s.t.ability = 0;
  g.tick(D.tick);
  ok(f.t.haste > 0 && f.t.hasteMult === 2);
});
test("pompier : ignore ralentissements, peur, gel, brûlure et désarmement", () => {
  const g = quiet(8);
  const e = spawnAt(g, "pompier", 3, 6);
  g.applyEffects(e, { slow: { pct: 0.5, t: 2 }, fear: { chance: 1, t: 2 }, freeze: { chance: 1, t: 1 }, burn: { dps: 10, t: 3 }, disarm: 1 }, null);
  eq(e.t.slow, 0);
  eq(e.t.fear, 0);
  eq(e.t.freeze, 0);
  eq(e.t.burn, 0);
  eq(e.fx.disarmed, false);
});
test("cygne noir : désarme (plus de barrière) et rend du mana", () => {
  const g = quiet(4);
  const e = spawnAt(g, "druide", 3, 6);
  g.applyEffects(e, { disarm: 1 }, null);
  ok(e.fx.disarmed && e.barrier === 0);
});
test("canard : coupe par l'eau sur le Carrefour", () => {
  const g = quiet(9);
  const top = g.grid.entrances.find((x) => x.j === 0);
  const duck = spawnAt(g, "canard", top.i, top.j);
  const walker = spawnAt(g, "canard", top.i, top.j);
  walker.swim = false;
  let swam = false;
  for (let t = 0; t < 30 && !duck.carrying; t += 0.1) {
    g.step(0.1);
    if (duck.water) swam = true;
  }
  ok(swam, "a nagé");
  ok(duck.carrying && !walker.carrying, "arrivé le premier au repaire");
});

console.log("Compétences et progression");
test("les compétences modifient la partie", () => {
  const base = S.createGame({ level: 5 });
  const g = S.createGame({ level: 5, skills: { goldVault: 3, mining: 1, manaStock: 2, manaPool: 2, cutStudy: 1, boarLord: 2 } });
  eq(g.state.gold, base.state.gold + 60);
  eq(g.state.gemCount.total, 6);
  eq(g.state.manaMax, 130);
  eq(g.state.spells.cut.cost, D.SPELLS.cut.cost - 4);
  eq(g.costFor("boar", 1), Math.round(50 * 0.9));
});
test("progression : 3 points par mission gagnée la première fois, prérequis de branche", () => {
  const p = P.progress.fresh();
  let r = P.progress.recordResult(p, 1, { win: true, gemsLeft: 5, gemsTotal: 5, brilliant: true });
  eq(r.points, 3);
  eq(p.unlocked, 2);
  r = P.progress.recordResult(p, 1, { win: true, gemsLeft: 3, gemsTotal: 5 });
  eq(r.points, 0, "pas deux fois");
  eq(p.levels[1].bestGems, 5);
  eq(P.progress.pointsFree(p), 3);
  ok(!P.progress.canRaise(p, "cutStudy").ok, "demande 3 points dans la branche");
  ok(P.progress.raise(p, "goldVault") && P.progress.raise(p, "goldVault") && P.progress.raise(p, "goldVault"));
  ok(!P.progress.raise(p, "heights"), "plus de point");
  P.progress.recordResult(p, 2, { win: true, gemsLeft: 5, gemsTotal: 5 });
  ok(P.progress.raise(p, "cutStudy"), "branche à 3 points");
  ok(!P.progress.canLower(p, "goldVault").ok, "Hache affûtée en dépend");
  const back = P.progress.sanitize(JSON.parse(JSON.stringify(p)));
  eq(back.skills.cutStudy, 1);
  const bad = P.progress.sanitize({ levels: { 1: { won: true } }, skills: { mining: 1, goldVault: 9 } });
  ok(P.progress.pointsSpent(bad) <= 3 && P.progress.valid(bad), "progression nettoyée");
});

console.log("Robot : les quinze missions");
const results = [];
for (let n = 1; n <= 15; n++) {
  test(`mission ${n} « ${S.MAPS[n].name} » gagnée par le robot`, () => {
    const skills = botSkills(P, 3 * (n - 1));
    const g = S.createGame({ level: n, skills, seed: 11 });
    const bot = makeBot(P, g);
    let guard = 0;
    while (!g.state.over && guard++ < 200000) {
      g.step(0.05);
      bot.step(0.05);
      if (guard % 2000 === 0) checkGems(g);
      g.drainEvents();
    }
    const s = g.state;
    results.push({ n, win: s.over && s.over.win, gems: s.over && s.over.gemsLeft, total: s.gemCount.total, towers: s.towers.length, levels: s.towers.map((t) => t.level).join(""), time: Math.round(s.time) });
    ok(s.over && s.over.win, `défaite (gemmes ${s.gemCount.lair}/${s.gemCount.total}, vague ${s.wave.index + 1}/${s.wave.total})`);
  });
}
console.log(results.map((r) => `  mission ${r.n} : ${r.win ? "gagnée" : "perdue"}, ${r.gems}/${r.total} gemmes, ${r.towers} tours [${r.levels}], ${r.time} s`).join("\n"));
console.log(`\n${passed} réussis, ${failed} échoués`);
process.exit(failed ? 1 : 0);
