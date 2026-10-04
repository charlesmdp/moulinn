// Vérifications de la simulation de « Pas touche à mes trésors » v4 (node tests/sim.test.mjs).
// Règles de Cursed Treasure : terrains, cachettes multiples, gemmes volées puis ramassées par les
// autres, déplacement libre dans des routes larges, trois façons d'attaquer (tir, charges, jet
// continu), capacités des seize ennemis, surprises (marée, barrière, passage secret, canards,
// montgolfières), sorts, compétences, progression, et un robot qui doit gagner les quinze missions.
import { loadSim } from "./load-sim.mjs";
import { playMission } from "./bot.mjs";

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
const near = (a, b, eps, msg) => ok(Math.abs(a - b) <= eps, (msg || "proche") + ` : ${a} ≉ ${b}`);
const run = (g, seconds) => {
  for (let t = 0; t < seconds - 1e-9; t += 0.1) g.step(0.1);
};
/** Partie sans vagues automatiques : on place les ennemis à la main. */
function quiet(level = 1, opts = {}) {
  const g = S.createGame(Object.assign({ level, seed: 3 }, opts));
  g.state.wave.countdown = 1e9;
  return g;
}
/** Ennemi posé au centre de la case (i, j) (ou à l'entrée si i est omis). */
function spawnAt(g, type, i, j, extra = {}) {
  const sp = Object.assign({ type, champion: false, boss: false, entrance: 0, hpMul: 1 }, extra);
  const e = i === undefined ? g.spawn(sp) : g.spawn(sp, { x: i + 0.5, y: j + 0.5 });
  e.retarget = true;
  return e;
}
const freeze = (e) => (e.baseSpeed = 0);
function find(g, c, pred = () => true) {
  for (let j = 0; j < D.H; j++) for (let i = 0; i < D.W; i++) if (g.grid.char(i, j) === c && pred(i, j)) return [i, j];
  return null;
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
  for (const L of s.map.lairs) eq(L.stock, s.gems.filter((x) => x.where === "lair" && x.lair === L.id).length, "stock de " + L.name);
}
/** Aucun ennemi au sol hors d'une case praticable (sauf pendant qu'il patauge). */
function checkPositions(g) {
  for (const e of g.state.enemies) {
    if (e.dead || e.flying || e.fx.wading) continue;
    ok(g.grid.passable(Math.floor(e.x), Math.floor(e.y), e.mode), `${e.type} #${e.id} sur ${g.grid.char(Math.floor(e.x), Math.floor(e.y))} (${e.x.toFixed(2)}, ${e.y.toFixed(2)})`);
  }
}

console.log("Données et cartes");
test("chaque famille a 7 niveaux par spécialisation et sa façon d'attaquer", () => {
  const modes = { boar: "shot", swan: "charges", dog: "beam" };
  for (const f of ["boar", "swan", "dog"]) {
    for (let l = 1; l <= 3; l++) eq(D.towerLevel(f, l, null).attack, modes[f], f + l);
    for (const sp of ["A", "B"]) for (let l = 4; l <= 7; l++) ok(D.towerLevel(f, l, sp).cost > 0, f + l + sp);
  }
  ok(D.towerLevel("swan", 1).charges >= 2 && D.towerLevel("swan", 1).reload > 0, "le cygne a des charges");
  ok(D.towerLevel("dog", 1).heatMax > 2, "le jet chauffe");
  eq(D.towerLevel("boar", 7, "A").multi, 2, "Grand Solitaire : deux cibles");
  eq(D.towerLevel("dog", 7, "A").beams, 2, "Grand dragon rouge : deux jets");
  ok(D.towerLevel("dog", 7, "B").chain, "Grand dragon bleu : rebond");
  eq(Object.keys(D.ENEMIES).length, 16, "seize ennemis");
});
test("quinze missions valides : entrées au bord, cachettes 2 × 2 reliées, moulin, menhirs", () => {
  eq(S.MAPS.length - 1, 15);
  for (let n = 1; n <= 15; n++) {
    const m = S.MAPS[n];
    // Barrières ouvertes : on vérifie aussi le chemin qu'elles ouvriront.
    const g = new S.Grid(Object.assign({}, m, { grid: m.grid.map((r) => r.replace(/g/g, "E")) }));
    eq(g.lairs.length, m.lairs.length, m.name + " : cachettes");
    eq(m.gems, m.lairs.reduce((a, L) => a + L.gems, 0), m.name + " : gemmes");
    for (const L of g.lairs) {
      eq(L.tiles.length, 4, m.name + " : cachette 2 × 2");
      for (const low of g.lairs.length && m.tide ? [false, true] : [false]) {
        g.setTide(low);
        const f = g.toLair(L.id, "walk"),
          fs = g.toLair(L.id, "swim");
        for (const e of g.entrances) {
          const d = Math.min(...e.tiles.map(([i, j]) => g.at(f, i, j)));
          ok(d < 1e8, `${m.name} : entrée ${e.letter} → ${L.name}`);
          ok(Math.min(...e.tiles.map(([i, j]) => g.at(fs, i, j))) <= d + 1e-3, "la nage n'allonge jamais");
          if (e.open) ok(d >= 9, `${m.name} : entrée ${e.letter} trop près de ${L.name} (${d.toFixed(1)})`);
        }
      }
    }
    for (const e of g.entrances) for (const [i, j] of e.tiles) ok(i === 0 || j === 0 || i === D.W - 1 || j === D.H - 1, m.name + " : entrée au bord");
    eq(m.mill.length, 6, m.name + " : moulin de six cases");
    for (const [i, j] of m.mill) eq(g.char(i, j), "X", m.name + " : moulin sur X");
    ok(m.mill.some(([i, j]) => g.lairs[0].tiles.some(([a, b]) => Math.abs(a - i) + Math.abs(b - j) === 1)), m.name + " : moulin collé à la cachette principale");
    for (const [i, j] of m.mana) ok(D.TILES[g.char(i, j)].build, m.name + " : menhir constructible");
    eq(S.buildWaves(n, g.entrances).length, m.waves, m.name + " : nombre de vagues");
  }
});
test("routes larges : la plupart des cases de chemin ont des voisines de chemin des deux côtés", () => {
  for (let n = 1; n <= 15; n++) {
    const g = new S.Grid(S.MAPS[n]);
    let road = 0,
      wide = 0;
    for (let j = 0; j < D.H; j++)
      for (let i = 0; i < D.W; i++) {
        if (!g.walkable(i, j)) continue;
        road++;
        if ((g.walkable(i - 1, j) && g.walkable(i + 1, j)) || (g.walkable(i, j - 1) && g.walkable(i, j + 1))) wide++;
      }
    ok(wide / road > 0.8, `${S.MAPS[n].name} : ${Math.round((100 * wide) / road)} % de route large`);
  }
});
test("cartes à plusieurs cachettes dès la mission 7 ; surprises aux bonnes missions", () => {
  ok(S.MAPS[7].lairs.length === 2 && S.MAPS[9].lairs.length === 2 && S.MAPS[15].lairs.length === 3);
  ok(S.MAPS[6].tide && S.MAPS[15].tide, "marée");
  ok(S.MAPS[8].gates && S.MAPS[13].gates && S.MAPS[15].gates, "barrières");
  eq(S.MAPS[14].secretWave, 25, "passage secret");
});
test("vagues : boss à la fin, nouvel ennemi présenté seul, barrière utilisée dès son ouverture", () => {
  for (let n = 2; n <= 15; n++) {
    const g = new S.Grid(S.MAPS[n]);
    const w = S.buildWaves(n, g.entrances);
    ok(w[w.length - 1].groups.some((x) => x.boss), "boss mission " + n);
    for (const e of g.entrances.filter((x) => !x.open)) {
      for (let k = 0; k < e.opensAt - 1; k++) ok(w[k].groups.every((x) => x.entrance !== e.id), `mission ${n} : barrière ${e.letter} fermée à la vague ${k + 1}`);
      ok(w[e.opensAt - 1].groups.some((x) => x.entrance === e.id), `mission ${n} : la vague ${e.opensAt} passe par la barrière`);
    }
  }
  const w4 = S.buildWaves(4, new S.Grid(S.MAPS[4]).entrances);
  ok(w4[2].groups.every((x) => x.type === "druide"), "druide présenté seul en mission 4");
  ok(!w4[0].groups.some((x) => x.type === "druide"), "pas de druide avant");
});
test("les PV montent jusqu'à la dernière vague, plus vite à la fin des longues missions", () => {
  const w = S.buildWaves(14, new S.Grid(S.MAPS[14]).entrances);
  for (let k = 1; k < w.length; k++) ok(w[k].hpMul > w[k - 1].hpMul, "vague " + (k + 1));
  const a = w[24].hpMul / w[19].hpMul,
    b = w[49].hpMul / w[44].hpMul;
  ok(b > a, `accélération en fin de mission (${a.toFixed(2)} puis ${b.toFixed(2)})`);
});

console.log("Champs d'écoulement et déplacement libre");
test("dans une route droite, l'écoulement suit l'axe de la route", () => {
  const g = new S.Grid(S.MAPS[1]);
  const f = g.toLair(0, "walk");
  // Bande du haut de la mission 1 (lignes 1 à 3, de gauche à droite) : loin du virage.
  for (let j = 1; j <= 3; j++)
    for (let i = 2; i <= 6; i++) {
      const k = j * D.W + i;
      ok(f.F[k * 2] > 0.85, `case ${i},${j} : (${f.F[k * 2].toFixed(2)}, ${f.F[k * 2 + 1].toFixed(2)})`);
    }
});
test("les ennemis occupent toute la largeur de la route (milieu, bords) et ne sortent jamais du chemin", () => {
  const g = quiet(1);
  const ys = [];
  for (let k = 0; k < 24; k++) spawnAt(g, "fermier", undefined, undefined, { hpMul: 50 });
  for (let t = 0; t < 30; t += 0.1) {
    g.step(0.1);
    checkPositions(g);
    for (const e of g.state.enemies) if (!e.carrying && e.x > 4 && e.x < 9 && e.y < 4.2) ys.push(e.y);
  }
  ok(ys.length > 100, "des passages dans la bande du haut");
  const lo = ys.filter((y) => y < 2.2).length / ys.length,
    hi = ys.filter((y) => y > 2.8).length / ys.length;
  ok(lo > 0.1 && hi > 0.1, `répartis sur la largeur (haut ${Math.round(lo * 100)} %, bas ${Math.round(hi * 100)} %)`);
});
test("une partie entière sans tours : personne ne traverse un talus, les gemmes restent cohérentes", () => {
  for (const n of [4, 6, 11, 15]) {
    const g = S.createGame({ level: n, seed: 5 });
    for (let t = 0; t < 400 && !g.state.over; t += 0.1) {
      g.step(0.1);
      checkPositions(g);
      if (Math.round(t * 10) % 50 === 0) checkGems(g);
    }
    ok(g.state.over && !g.state.over.win, S.MAPS[n].name + " : perdue sans défense");
  }
});

console.log("Construction, amélioration, sorts");
test("terrains : sanglier sur l'herbe, cygne sur l'eau, berger sur la roche, butte = tous", () => {
  const g = quiet(2);
  g.state.gold = 5000;
  const [gi, gj] = find(g, ".");
  const [wi, wj] = find(g, "~");
  const [ri, rj] = find(g, "^");
  const [hi, hj] = find(g, "H");
  ok(!g.build(gi, gj, "dog").ok, "berger refusé sur l'herbe");
  ok(g.build(gi, gj, "boar").ok, "sanglier sur l'herbe");
  ok(!g.build(gi, gj, "boar").ok, "case déjà prise");
  ok(g.build(wi, wj, "swan").ok, "cygne sur l'eau");
  ok(g.build(ri, rj, "dog").ok, "berger sur la roche");
  ok(g.build(hi, hj, "swan").ok, "cygne sur la butte");
  ok(g.towerAt(hi, hj).high && g.towerAt(hi, hj).range > D.towerLevel("swan", 1).range, "bonus de portée sur la butte");
  const [ci, cj] = find(g, "#");
  ok(!g.build(ci, cj, "boar").ok, "pas sur le chemin");
  const [li, lj] = find(g, "L");
  ok(!g.build(li, lj, "boar").ok, "pas sur une cachette");
});
test("forêt : Couper coûte du mana et rend la case constructible", () => {
  const g = quiet(1);
  const [fi, fj] = find(g, "f");
  ok(!g.build(fi, fj, "boar").ok, "boisée : refusée");
  const mana = g.state.mana;
  ok(g.cast("cut", { x: fi + 0.5, y: fj + 0.5 }).ok, "coupe");
  eq(g.grid.char(fi, fj), ".");
  near(g.state.mana, mana - D.SPELLS.cut.cost, 1e-9, "mana dépensé");
  ok(g.build(fi, fj, "boar").ok, "constructible après la coupe");
  ok(g.drainEvents().some((e) => e.type === "cut"), "événement cut");
});
test("amélioration : l'expérience d'abord, puis l'or ; spécialisation obligatoire au niveau 4", () => {
  const g = quiet(1);
  g.state.gold = 5000;
  const [i, j] = find(g, ".");
  const r = g.build(i, j, "boar");
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
  eq(info.attack, "shot");
  ok(info.stats.splash > 0, "tir de zone");
  while (t.level < 7) ok(g.upgrade(t.id).ok);
  eq(g.towerInfo(t.id).name, "Catapulte à châtaignes");
  ok(!g.upgrade(t.id).ok, "niveau maximum");
  const sold = g.sell(t.id);
  ok(sold.ok && sold.gold === Math.floor(t.invested * D.economy.sellRatio), "revente à 60 %");
});
/** Tour posée à côté d'une cible immobile très résistante. */
function range1(level, family) {
  const g = quiet(level);
  g.state.gold = 10000;
  g.state.mana = 0;
  const terrain = { boar: ".", swan: "~", dog: "^" }[family];
  // Une case du bon terrain qui touche une route.
  const at = find(g, terrain, (i, j) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => g.grid.walkable(i + a, j + b)));
  const [ti, tj] = at;
  const [ri, rj] = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => [ti + a, tj + b]).find(([a, b]) => g.grid.walkable(a, b));
  const r = g.build(ti, tj, family);
  ok(r.ok, "construction " + family);
  const t = g.towerById(r.towerId);
  const e = spawnAt(g, "vache", ri, rj, { hpMul: 1000 });
  freeze(e);
  e.shield = 0;
  return { g, t, e };
}
test("sanglier : un tir à la suite ; Frénésie double la cadence", () => {
  const { g, t, e } = range1(3, "boar");
  run(g, 3);
  const before = t.shots;
  run(g, 5);
  const normal = t.shots - before;
  near(normal, 5 * t.st.rate, 1.5, "cadence");
  g.state.mana = 100;
  ok(g.cast("frenzy").ok);
  const b2 = t.shots;
  run(g, 5);
  const fast = t.shots - b2;
  ok(fast >= normal * 1.5, `frénésie ${fast} tirs contre ${normal}`);
  ok(e.hp < e.hpMax, "touchée");
});
test("cygne : lâche ses charges en rafale puis se recharge une à une", () => {
  const { g, t } = range1(2, "swan");
  const max = t.ammoMax;
  ok(max >= 2, "au moins deux charges");
  eq(t.ammo, max, "plein à la construction");
  const times = [];
  for (let k = 0; k < 120; k++) {
    g.tick(D.tick);
    for (const ev of g.drainEvents()) if (ev.type === "shot" && ev.towerId === t.id) times.push(g.state.time);
  }
  ok(times.length >= max, "la rafale part");
  ok(times[1] - times[0] < 0.5, `rafale serrée (${(times[1] - times[0]).toFixed(2)} s)`);
  ok(times[max] === undefined || times[max] - times[max - 1] > t.st.reload * 0.7, "puis attente de la recharge");
  ok(t.ammo < max, "réserve entamée");
  run(g, max * t.st.reload + 1);
  ok(t.ammo > 0, "recharge");
});
test("berger : jet continu qui chauffe sur la même cible, coupé quand elle sort de portée", () => {
  const { g, t, e } = range1(1, "dog");
  g.tick(D.tick);
  const evs = g.drainEvents();
  ok(evs.some((x) => x.type === "beamOn" && x.towerId === t.id), "jet allumé");
  eq(t.beams.length, 1, "un jet");
  eq(t.beams[0].targetId, e.id);
  const hp0 = e.hp;
  run(g, 0.5);
  const first = hp0 - e.hp;
  run(g, 3);
  const hp1 = e.hp;
  run(g, 0.5);
  const later = hp1 - e.hp;
  ok(later > first * 1.8, `chauffe : ${first.toFixed(1)} puis ${later.toFixed(1)} PV par demi-seconde`);
  ok(t.beams[0].heat > 0.95, "chaleur au maximum");
  // La cible s'éloigne : le jet s'éteint.
  e.x += 10;
  g.tick(D.tick);
  ok(g.drainEvents().some((x) => x.type === "beamOff" && x.towerId === t.id), "jet éteint");
  eq(t.beams.length, 0);
});
test("dragons : rouge niveau 7 = deux jets ; bleu niveau 7 = rebond ; Grand Solitaire = deux cibles", () => {
  {
    const { g, t, e } = range1(1, "dog");
    t.xp = 1e5;
    while (t.level < 7) ok(g.upgrade(t.id, "A").ok);
    const e2 = spawnAt(g, "vache", Math.floor(e.x), Math.floor(e.y), { hpMul: 1000 });
    freeze(e2);
    run(g, 0.5);
    eq(t.beams.length, 2, "deux jets");
    ok(t.beams[0].targetId !== t.beams[1].targetId, "deux cibles");
  }
  {
    const { g, t, e } = range1(1, "dog");
    t.xp = 1e5;
    while (t.level < 7) ok(g.upgrade(t.id, "B").ok);
    const e2 = spawnAt(g, "vache", Math.floor(e.x), Math.floor(e.y), { hpMul: 1000 });
    freeze(e2);
    e2.x = e.x + 0.5;
    run(g, 0.5);
    ok(t.beams[0].chainId, "rebond");
    ok(e2.hp < e2.hpMax && e.hp < e.hpMax, "les deux brûlent");
    ok(e.t.rad > 0, "rayonnement");
  }
  {
    const { g, t, e } = range1(1, "boar");
    t.xp = 1e5;
    while (t.level < 7) ok(g.upgrade(t.id, "A").ok);
    const e2 = spawnAt(g, "vache", Math.floor(e.x), Math.floor(e.y), { hpMul: 1000 });
    freeze(e2);
    let both = false;
    for (let k = 0; k < 60 && !both; k++) {
      g.tick(D.tick);
      for (const ev of g.drainEvents()) if (ev.type === "attack" && ev.towerId === t.id && ev.targets.length === 2) both = true;
    }
    ok(both, "deux cibles à la fois");
  }
});
test("Météore frappe après son délai", () => {
  const g = quiet(3);
  g.state.mana = 100;
  const [i, j] = find(g, "#");
  const e = spawnAt(g, "vache", i, j, { hpMul: 100 });
  freeze(e);
  const hp = e.hp;
  ok(g.cast("meteor", { x: e.x, y: e.y }).ok);
  g.tick(0.1);
  eq(e.hp, hp, "pas encore d'impact");
  run(g, 1.5);
  ok(e.hp < hp, "impact");
  ok(g.drainEvents().some((ev) => ev.type === "meteorImpact"));
});

console.log("Gemmes, cachettes et intelligence des ennemis");
test("un ennemi prend une gemme dans une cachette et repart vers la sortie", () => {
  const g = quiet(2);
  const L = g.state.map.lairs[0];
  const [ni, nj] = L.tiles.flatMap(([a, b]) => [[a + 1, b], [a - 1, b], [a, b + 1], [a, b - 1]]).find(([a, b]) => g.grid.walkable(a, b) && g.grid.char(a, b) !== "L");
  const e = spawnAt(g, "fermier", ni, nj);
  run(g, 3);
  ok(e.carrying, "porte une gemme");
  eq(e.goal, "exit");
  eq(L.stock, 4);
  checkGems(g);
});
test("plusieurs cachettes : chacun va à la plus proche qui a des gemmes, puis à l'autre quand elle est vide", () => {
  const g = quiet(9);
  const [A, B] = g.state.map.lairs;
  // Près du dolmen (cachette B), un ennemi y va ; on vide B, il change de cap.
  const e = spawnAt(g, "fermier", 4, 1);
  g.tick(D.tick);
  eq(e.goal, "lair");
  eq(e.target, B.id, "va au dolmen tout proche");
  for (const gem of g.state.gems) if (gem.lair === B.id) gem.where = "lost";
  g.countGems();
  g.gemsChanged();
  g.tick(D.tick);
  eq(e.target, A.id, "repart vers le moulin");
  checkGems(g);
});
test("porteur tué : la gemme tombe et les autres vont la chercher, demi-tour compris", () => {
  const g = quiet(1);
  const s = g.state;
  // Bande du haut de la mission 1 : un porteur au milieu, un ennemi derrière, un autre devant.
  const carrier = spawnAt(g, "fermier", 9, 2);
  const gem = s.gems[0];
  gem.where = "carried";
  gem.carrier = carrier.id;
  carrier.carrying = gem.id;
  g.countGems();
  const behind = spawnAt(g, "quad", 5, 2);
  const ahead = spawnAt(g, "fermier", 10, 6);
  run(g, 0.3);
  eq(ahead.goal, "lair", "va à la cachette avant la chute");
  g.hurt(carrier, 1e6, { pierce: true });
  checkGems(g);
  eq(gem.where, "ground", "gemme au sol");
  run(g, 0.2);
  eq(behind.target, gem.id, "l'ennemi de derrière vise la gemme");
  eq(ahead.target, gem.id, "celui de devant fait demi-tour pour elle");
  run(g, 8);
  ok(behind.carrying === gem.id || ahead.carrying === gem.id, "ramassée par l'un des deux");
  const holder = behind.carrying === gem.id ? behind : ahead;
  const other = holder === behind ? ahead : behind;
  ok(other.target !== gem.id, "l'autre repart vers une autre gemme");
  eq(holder.goal, "exit", "le ramasseur repart vers la sortie");
  checkGems(g);
});
test("gemme emportée dehors = perdue ; plus aucune gemme = défaite", () => {
  const g = quiet(2);
  const s = g.state;
  for (const gem of s.gems) gem.where = "lost";
  s.gems[0].where = "lair";
  g.countGems();
  spawnAt(g, "quad");
  run(g, 120);
  ok(s.over && !s.over.win, "défaite");
  eq(s.gemCount.lost, s.gemCount.total);
});
test("cow-boy : le lasso attrape une gemme au sol à une case et demie", () => {
  const g = quiet(1);
  const gem = g.state.gems[0];
  gem.where = "ground";
  gem.x = 10.5;
  gem.y = 4.3; // sur le talus, juste sous la bande de route du haut
  g.countGems();
  const e = spawnAt(g, "cowboy", 7, 3);
  e.lane = e.laneGoal = 1;
  run(g, 6);
  eq(e.carrying, gem.id);
  ok(g.drainEvents().some((ev) => ev.type === "lasso"), "événement lasso");
});
test("Portail de retour : une gemme oubliée revient dans sa cachette", () => {
  const g = quiet(9, { skills: { returnPortal: 1, meteorStudy: 3 } });
  eq(g.mods.portal, 40);
  const gem = g.state.gems.find((x) => x.lair === 1);
  gem.where = "ground";
  gem.x = 10.5;
  gem.y = 7.5;
  gem.returnIn = g.mods.portal;
  g.countGems();
  run(g, 41);
  eq(gem.where, "lair");
  eq(g.state.map.lairs[1].stock, 2, "rentrée dans le dolmen");
});

console.log("Surprises de carte");
test("marée : l'estran se découvre à marée basse (raccourci) et se recouvre ensuite", () => {
  const g = S.createGame({ level: 6, seed: 2 });
  const [mi, mj] = find(g, "m");
  eq(g.state.tide, "high");
  ok(!g.grid.walkable(mi, mj), "estran sous l'eau");
  const cycle = S.MAPS[6].tide.cycle;
  const notes = g.upcoming(cycle + 1).flatMap((w) => w.notes.map((x) => x.kind));
  ok(notes.includes("tideLow"), "annoncée dans la frise");
  for (let k = 0; k <= cycle; k++) g.callWave();
  eq(g.state.tide, "low");
  ok(g.grid.walkable(mi, mj), "estran praticable");
  ok(g.drainEvents().some((e) => e.type === "tide"), "événement tide");
  const E = g.grid.entrances[0];
  const dLow = Math.min(...E.tiles.map(([i, j]) => g.grid.at(g.grid.toLair(0, "walk"), i, j)));
  g.grid.setTide(false);
  const dHigh = Math.min(...E.tiles.map(([i, j]) => g.grid.at(g.grid.toLair(0, "walk"), i, j)));
  ok(dLow < dHigh - 6, `raccourci (${dLow.toFixed(0)} au lieu de ${dHigh.toFixed(0)})`);
});
test("marée montante : un ennemi sur l'estran patauge jusqu'à la terre ferme", () => {
  const g = quiet(6);
  g.setTide(true);
  const [mi, mj] = find(g, "m", (i) => i === 9);
  const e = spawnAt(g, "fermier", mi, mj);
  g.setTide(false);
  run(g, 0.2);
  ok(e.fx.wading, "patauge");
  run(g, 15);
  ok(!e.fx.wading && g.grid.walkable(Math.floor(e.x), Math.floor(e.y)), "revenu sur la route");
});
test("barrière : fermée au début, elle cède à sa vague (annoncée) et devient une entrée", () => {
  const g = S.createGame({ level: 8, seed: 2 });
  const gate = g.state.map.entrances.find((e) => !e.open);
  ok(gate, "une barrière");
  eq(gate.opensAt, 18);
  const [gi, gj] = gate.tiles[0];
  eq(g.grid.char(gi, gj), "g");
  ok(!g.grid.walkable(gi, gj));
  for (let k = 0; k < 16; k++) g.callWave();
  const next = g.nextWave();
  eq(next.index, 16);
  ok(g.upcoming(3).some((w) => w.notes.some((x) => x.kind === "gate" && x.letter === gate.letter)), "annoncée");
  g.callWave();
  g.callWave();
  ok(g.state.map.entrances[gate.id].open, "ouverte");
  eq(g.grid.char(gi, gj), "E");
  ok(g.drainEvents().some((e) => e.type === "gateOpen"), "événement gateOpen");
});
test("passage secret : le fourré s'ouvre en chemin à sa vague", () => {
  const g = S.createGame({ level: 14, seed: 2 });
  const [si, sj] = find(g, "s");
  const E = g.grid.entrances[0];
  const before = Math.min(...E.tiles.map(([i, j]) => g.grid.at(g.grid.toLair(0, "walk"), i, j)));
  for (let k = 0; k < 25; k++) g.callWave();
  eq(g.grid.char(si, sj), "#");
  ok(g.drainEvents().some((e) => e.type === "secretOpen"));
  const after = Math.min(...E.tiles.map(([i, j]) => g.grid.at(g.grid.toLair(0, "walk"), i, j)));
  ok(after < before - 10, `raccourci (${after.toFixed(0)} au lieu de ${before.toFixed(0)})`);
});

console.log("Capacités des ennemis");
test("bouclier de la vache : −5 par coup, sauf le feu du berger qui perce", () => {
  const g = quiet(3);
  const e = spawnAt(g, "vache", 3, 5, { hpMul: 10 });
  const hp = e.hp;
  g.hurt(e, 12, {});
  near(hp - e.hp, 7, 1e-9, "12 − 5");
  const hp2 = e.hp;
  g.hurt(e, 12, { pierce: true });
  near(hp2 - e.hp, 12, 1e-9, "perce");
});
test("bulle du druide : absorbe, casse, se reforme après quelques secondes sans coup", () => {
  const g = quiet(4);
  const e = spawnAt(g, "druide", 3, 6);
  freeze(e);
  const B = e.barrier;
  ok(B > 0);
  g.hurt(e, B * 0.6, {});
  eq(e.hp, e.hpMax, "absorbé");
  g.hurt(e, B, {});
  eq(e.barrier, 0);
  ok(e.hp < e.hpMax);
  ok(g.drainEvents().some((ev) => ev.type === "barrierBreak"));
  run(g, D.ENEMIES.druide.ability.regen + 0.3);
  eq(e.barrier, e.barrierMax, "bulle reformée");
});
test("bigoudène : soigne l'allié le plus blessé", () => {
  const g = quiet(5);
  const b = spawnAt(g, "bigoudene", 3, 6);
  const f = spawnAt(g, "fermier", 4, 6);
  freeze(b);
  freeze(f);
  f.hp = 5;
  run(g, 3.5);
  ok(f.hp > 30, "soigné : " + f.hp);
});
test("chasseur : fumigène au premier coup, invisible donc hors de portée des tours", () => {
  const { g, t, e } = range1(7, "boar");
  e.dead = true;
  const c = spawnAt(g, "chasseur", Math.floor(e.x), Math.floor(e.y), { hpMul: 50 });
  freeze(c);
  g.hurt(c, 1, {});
  ok(c.t.invis > 0, "invisible");
  eq(g.pickTarget(t, 3), null, "pas ciblé");
  run(g, D.ENEMIES.chasseur.ability.t + 0.2);
  ok(g.pickTarget(t, 3), "de nouveau visible");
});
test("rugbyman : esquive environ la moitié des tirs visés", () => {
  const g = quiet(6);
  let evaded = 0;
  for (let k = 0; k < 400; k++) {
    const e = spawnAt(g, "rugbyman", 3, 6, { hpMul: 100 });
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
test("cygne noir : désarme (plus de bulle) et rend du mana", () => {
  const g = quiet(4);
  const e = spawnAt(g, "druide", 3, 6);
  g.applyEffects(e, { disarm: 1 }, null);
  ok(e.fx.disarmed && e.barrier === 0);
});
test("canard : sur le Carrefour, il remonte le ruisseau jusqu'au dolmen au lieu de faire le tour", () => {
  const g = quiet(9);
  const west = g.grid.entrances.find((x) => x.tiles.some(([i]) => i === 0));
  const duck = spawnAt(g, "canard", west.tiles[0][0], west.tiles[0][1]);
  const walker = spawnAt(g, "fermier", west.tiles[0][0], west.tiles[0][1]);
  walker.baseSpeed = duck.baseSpeed;
  let swam = false;
  for (let t = 0; t < 40 && !duck.carrying; t += 0.1) {
    g.step(0.1);
    if (duck.water) swam = true;
  }
  ok(swam, "a nagé");
  ok(duck.carrying && !walker.carrying, "arrivé le premier à une cachette");
  eq(g.state.gems.find((x) => x.id === duck.carrying).lair, 1, "au dolmen");
});
test("cyclistes : plus rapides en peloton", () => {
  const g = quiet(5);
  const a = spawnAt(g, "cycliste", 5, 2);
  g.tick(D.tick);
  const alone = a.speed;
  spawnAt(g, "cycliste", 5, 2);
  spawnAt(g, "cycliste", 5, 2);
  g.tick(D.tick);
  near(a.speed / alone, D.ENEMIES.cycliste.ability.mult, 0.05, "bonus de peloton");
});
test("korrigan : touché, il disparaît et réapparaît plus loin sur sa route", () => {
  const g = quiet(10);
  const e = spawnAt(g, "korrigan", 3, 2, { hpMul: 50 });
  g.tick(D.tick);
  const d0 = e.distLeft;
  const x0 = e.x,
    y0 = e.y;
  g.hurt(e, 5, {});
  const ev = g.drainEvents().find((x) => x.type === "blink");
  ok(ev, "événement blink");
  ok(Math.hypot(e.x - x0, e.y - y0) > 1, "a sauté");
  g.tick(D.tick);
  ok(e.distLeft < d0 - 1, "plus près de son but");
  g.hurt(e, 5, {});
  ok(!g.drainEvents().some((x) => x.type === "blink"), "pas deux fois de suite");
});
test("touriste : son flash éblouit la tour la plus proche, qui ne tire plus un moment", () => {
  const { g, t, e } = range1(12, "boar");
  e.dead = true;
  const tour = spawnAt(g, "touriste", Math.floor(e.x), Math.floor(e.y), { hpMul: 100 });
  freeze(tour);
  tour.t.ability = 0;
  g.tick(D.tick);
  ok(g.drainEvents().some((x) => x.type === "flash"), "flash");
  ok(t.dazzled > 0, "tour éblouie");
  const shots = t.shots;
  run(g, D.ENEMIES.touriste.ability.t - 0.3);
  eq(t.shots, shots, "pas de tir");
  run(g, 0.6);
  ok(g.drainEvents().some((x) => x.type === "dazzleEnd"), "fin de l'éblouissement");
});
test("tracteur : bouclier, et trois agriculteurs sautent de la cabine à sa mort", () => {
  const g = quiet(13);
  const e = spawnAt(g, "tracteur", 6, 2);
  freeze(e);
  ok(e.shield > 0, "bouclier");
  const n = g.state.enemies.length;
  g.hurt(e, 1e6, { pierce: true });
  const ev = g.drainEvents().find((x) => x.type === "split");
  ok(ev && ev.spawned.length === 3, "trois agriculteurs");
  eq(g.state.enemies.filter((x) => !x.dead).length, n - 1 + 3);
  ok(g.state.enemies.filter((x) => x.type === "fermier").every((x) => g.grid.walkable(Math.floor(x.x), Math.floor(x.y))), "sur la route");
});
test("montgolfière : vole en ligne droite au-dessus de tout, et sa gemme tombe sur la route", () => {
  const g = quiet(11);
  const e = spawnAt(g, "montgolfiere", undefined, undefined, { entrance: 1 });
  ok(e.flying && e.alt > 0, "en l'air");
  let crossed = false;
  for (let t = 0; t < 60 && !e.carrying; t += 0.1) {
    g.step(0.1);
    if (!g.grid.walkable(Math.floor(e.x), Math.floor(e.y))) crossed = true;
  }
  ok(crossed, "survole les talus et l'eau");
  ok(e.carrying, "a pris une gemme");
  run(g, 1.5);
  g.hurt(e, 1e6, { pierce: true });
  const gem = g.state.gems.find((x) => x.where === "ground");
  ok(gem && g.grid.walkable(Math.floor(gem.x), Math.floor(gem.y)), "la gemme tombe sur une case de route");
  checkGems(g);
});
test("fiches : enemyInfo et upcoming décrivent les ennemis et les vagues à venir", () => {
  const g = S.createGame({ level: 9, seed: 2 });
  const up = g.upcoming(5);
  eq(up.length, 5);
  ok(up.every((w) => w.groups.length && w.groups.every((x) => x.letter && x.color)), "groupes avec entrée lettrée");
  ok(up[1].startsIn > up[0].startsIn, "délais croissants");
  ok(up.some((w) => w.groups.some((x) => x.swims)), "canards signalés");
  g.callWave();
  run(g, 1);
  const e = g.state.enemies[0];
  const info = g.enemyInfo(e.id);
  eq(info.type, e.type);
  ok(info.name && info.blurb && info.hpMax > 0);
});

console.log("Compétences et progression");
test("les compétences modifient la partie", () => {
  const base = S.createGame({ level: 5 });
  const g = S.createGame({ level: 5, skills: { goldVault: 3, mining: 1, manaStock: 2, manaPool: 2, cutStudy: 1, boarLord: 2 } });
  eq(g.state.gold, base.state.gold + 60);
  eq(g.state.gemCount.total, 6);
  eq(g.state.map.lairs[0].stock, 6, "la gemme en plus va dans la cachette principale");
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
test("même graine, même partie (reproductible)", () => {
  const a = playMission(P, 4, { seed: 7 }),
    b = playMission(P, 4, { seed: 7 });
  eq(a.time, b.time);
  eq(a.gems, b.gems);
  eq(a.game.state.stats.kills, b.game.state.stats.kills);
});

console.log("Robot : les quinze missions");
const results = [];
for (let n = 1; n <= 15; n++) {
  test(`mission ${n} « ${S.MAPS[n].name} » gagnée par le robot`, () => {
    const r = playMission(P, n, { seed: 11, each: (g) => (checkGems(g), checkPositions(g)) });
    results.push(r);
    ok(r.win, `défaite (vague ${r.wave}/${r.waves})`);
  });
}
console.log(results.map((r) => `  mission ${r.n} : ${r.win ? "gagnée" : "perdue"}, ${r.gems}/${r.total} gemmes, ${r.towers} tours [${r.levels}], ${r.time} s`).join("\n"));
console.log(`\n${passed} réussis, ${failed} échoués`);
process.exit(failed ? 1 : 0);
