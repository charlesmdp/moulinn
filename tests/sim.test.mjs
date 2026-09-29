// Vérifications de la simulation de « Pas touche à mes trésors » (node tests/sim.test.mjs).
import { loadSim } from "./load-sim.mjs";
import { makeBot } from "./bot.mjs";

const P = loadSim();
const C = P.config;
let failed = 0,
  passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log("  ✓ " + name);
  } catch (e) {
    failed++;
    console.log("  ✗ " + name + "\n      " + (e && e.stack ? e.stack.split("\n").slice(0, 3).join("\n      ") : e));
  }
}
function ok(c, msg) {
  if (!c) throw new Error(msg || "assertion");
}
function eq(a, b, msg) {
  if (a !== b) throw new Error((msg || "égalité") + ` : ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`);
}
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
const unlockedFor = (lv) => Object.entries(C.spells.unlockLevel).filter(([, l]) => l <= lv).map(([k]) => k);

/** Invariants trésors : chaque trésor dans un seul état, stocks cohérents, pas de doublon. */
function checkTreasures(g) {
  const s = g.state;
  const ids = new Set();
  for (const t of s.treasures) {
    ok(["stored", "carried", "dropped", "lost"].includes(t.state), "état inconnu " + t.state);
    ok(!ids.has(t.id), "doublon " + t.id);
    ids.add(t.id);
  }
  eq(s.treasures.length, 6, "six trésors");
  const inStock = s.reserves.flatMap((r) => r.stock);
  eq(new Set(inStock).size, inStock.length, "stock sans doublon");
  for (const t of s.treasures) {
    const stocked = inStock.includes(t.id);
    eq(stocked, t.state === "stored", `trésor ${t.id} (${t.state}) cohérent avec les stocks`);
    if (t.state === "stored") ok(g.reserve(t.reserve).stock.includes(t.id), "rangé dans sa réserve d'origine");
    if (t.state === "carried") ok(s.enemies.some((e) => e.carrying === t.id), "porteur existant pour " + t.id);
  }
  const carriers = s.enemies.filter((e) => e.carrying);
  eq(new Set(carriers.map((e) => e.carrying)).size, carriers.length, "un sac par porteur");
}
/** Fait voler un trésor d'une réserve par un voleur placé devant la porte. */
function stealOne(g, reserveId, type = "voleur") {
  const r = g.reserve(reserveId);
  const e = g.spawnEnemy({ type, elite: false, entry: g.L.entries[0].node, target: reserveId });
  // Place le voleur à la porte : fin de son trajet.
  e.s = e.route.line.length;
  const p = P.geom.at(e.route.line, e.s);
  e.x = p.x;
  e.z = p.z;
  g.arrive(e);
  eq(e.state, "steal", "vol commencé");
  g.state.phase = "wave";
  for (let i = 0; i < 200 && e.state === "steal"; i++) g.tick(C.tick);
  eq(e.state, "flee", "vol réussi, fuite");
  return e;
}
function runToExit(g, e) {
  for (let i = 0; i < 20000 && g.alive(e); i++) {
    e.s = Math.min(e.route.line.length, e.s + 0.5);
    const p = P.geom.at(e.route.line, e.s);
    e.x = p.x;
    e.z = p.z;
    if (e.s >= e.route.line.length) g.arrive(e);
  }
}

console.log("Dispositions");
test("les cinq dispositions passent la vérification (accès, sorties, chemins, supports)", () => {
  for (const L of Object.values(P.layouts)) {
    const pr = P.routes.validate(L);
    ok(!pr.length, pr.join("\n"));
  }
});
test("la disposition change réellement entre deux niveaux (moulin, réserves, étangs, entrées)", () => {
  const ids = new Set();
  for (let a = 1; a <= 5; a++) {
    const A = P.layouts[a];
    ids.add(A.id);
    for (let b = a + 1; b <= 5; b++) {
      const B = P.layouts[b];
      ok(Math.hypot(A.mill.x - B.mill.x, A.mill.z - B.mill.z) > 6 && (Math.hypot(A.mill.x - B.mill.x, A.mill.z - B.mill.z) > 12 || Math.abs(A.mill.rot - B.mill.rot) > 0.5), `moulin déplacé entre ${a} et ${b}`);
      const ra = A.reserves.map((r) => r.pos.join(",")).join(";"),
        rb = B.reserves.map((r) => r.pos.join(",")).join(";");
      ok(ra !== rb, "réserves déplacées");
      const ea = A.entries.map((e) => A.nodes[e.node].x + "," + A.nodes[e.node].z).join(";"),
        eb = B.entries.map((e) => B.nodes[e.node].x + "," + B.nodes[e.node].z).join(";");
      ok(ea !== eb, "entrées déplacées");
    }
  }
  eq(ids.size, 5, "identifiants distincts");
});
test("répartition des trésors : 3 + 3 (niveaux 1-2), 2 + 2 + 2 (niveaux 3-5)", () => {
  for (let lv = 1; lv <= 5; lv++) {
    const n = P.layouts[lv].reserves.map((r) => r.treasures);
    eq(n.reduce((a, b) => a + b, 0), 6, "six trésors");
    eq(n.length, lv <= 2 ? 2 : 3, "nombre de réserves");
  }
});
test("chaque réserve est accessible et reliée à une sortie ; les nageurs ont des voies d'eau", () => {
  for (const L of Object.values(P.layouts)) {
    const g = P.routes.buildGraph(L);
    for (const r of L.reserves) {
      for (const e of L.entries) ok(P.routes.route(g, e.node, [r.doorNode], e.kind === "water" ? "swimmer" : "walker"), `${L.id} ${e.id}→${r.id}`);
      ok(P.routes.route(g, r.doorNode, L.exits.map((x) => x.node), "walker"), `${L.id} ${r.id}→sortie`);
    }
  }
  ok(P.layouts[4].entries.some((e) => e.kind === "water"), "niveau 4 : entrée des nageurs");
  ok(P.layouts[4].edges.some((e) => e.kind === "shore"), "niveau 4 : débarcadères");
});

test("terrain à cases : 50 à 95 cases libres et 15 à 40 cases boisées par niveau, trois sols, des tours côte à côte", () => {
  for (let lv = 1; lv <= 5; lv++) {
    const L = P.layouts[lv];
    const free = L.sockets.filter((s) => !s.forest),
      wood = L.sockets.filter((s) => s.forest);
    ok(free.length >= 50 && free.length <= 95, `niveau ${lv} : ${free.length} cases libres`);
    ok(wood.length >= 15 && wood.length <= 40, `niveau ${lv} : ${wood.length} cases boisées`);
    for (const k of ["fire", "ice", "water"]) ok(free.filter((s) => s.kind === k).length >= 12, `niveau ${lv} : au moins 12 cases ${k}`);
    // Cases voisines (côte à côte) du même sol : on peut aligner des tours.
    let pairs = 0;
    for (const s of free) {
      const right = L.tileAt[s.i + 1 + ":" + s.j];
      if (right && L.sockets.find((o) => o.id === right).kind === s.kind) pairs++;
    }
    ok(pairs >= 20, `niveau ${lv} : ${pairs} paires de cases voisines`);
    // Portes : trois au plus, chacune au bord de la carte.
    ok(L.entries.length >= 2 && L.entries.length <= 3, `niveau ${lv} : ${L.entries.length} portes`);
    for (const e of L.entries) {
      const n = L.nodes[e.node];
      ok(n.x <= 0 || n.z <= 0 || n.x >= 64 || n.z >= 44, `porte ${e.id} au bord`);
      ok(/^#[0-9a-f]{6}$/i.test(e.color), `couleur de la porte ${e.id}`);
    }
  }
});
test("les vagues n'utilisent que les portes de leur niveau (nageurs par l'eau)", () => {
  for (let lv = 1; lv <= 5; lv++) {
    const L = P.layouts[lv];
    const ids = new Map(L.entries.map((e) => [e.id, e]));
    for (const [i, w] of P.waves.scripts[lv].entries()) {
      for (const gdef of w) {
        const e = ids.get(gdef.entry);
        ok(e, `niveau ${lv}, vague ${i + 1} : porte ${gdef.entry} inconnue`);
        ok(e.kind === "land" || gdef.type === "nageur", `niveau ${lv}, vague ${i + 1} : ${gdef.type} par l'eau`);
        ok(L.reserves.some((r) => r.id === gdef.target), `niveau ${lv}, vague ${i + 1} : réserve ${gdef.target}`);
      }
    }
  }
});

console.log("Forêts");
function forestTile(g, kind) {
  return g.L.sockets.find((s) => s.forest && (!kind || s.kind === kind));
}
test("couper une forêt : l'or est payé, la case reste inconstructible pendant la coupe, puis se libère", () => {
  const g = new P.Game({ level: 1 });
  const so = forestTile(g);
  ok(so, "une case boisée");
  eq(g.isForest(so.id), true);
  g.state.gold = 500;
  const r0 = g.build(so.id, so.kind);
  ok(!r0.ok && /forêt/i.test(r0.reason), "pas de tour sur une forêt : " + r0.reason);
  const cost = g.cutCost();
  eq(cost, C.forest.cost, "premier prix");
  const r = g.cut(so.id);
  ok(r.ok, r.reason);
  eq(g.state.gold, 500 - cost, "or payé");
  ok(g.drainEvents().some((e) => e.type === "cutStart" && e.id === so.id), "événement de début de coupe");
  ok(!g.build(so.id, so.kind).ok, "pas de tour pendant la coupe");
  ok(!g.cut(so.id).ok, "pas deux coupes en même temps");
  // La coupe avance entre les vagues (phase de préparation).
  eq(g.state.phase, "prep");
  g.advance(C.forest.duration * 0.5);
  ok(near(g.cutProgress(so.id), 0.5, 0.02), "à mi-chemin");
  ok(g.isForest(so.id), "encore boisée");
  g.advance(C.forest.duration * 0.5 + 0.1);
  eq(g.isForest(so.id), false, "coupée");
  eq(g.cutProgress(so.id), null);
  ok(g.drainEvents().some((e) => e.type === "cutDone" && e.id === so.id), "événement de fin de coupe");
  ok(!g.cut(so.id).ok, "on ne coupe pas deux fois");
  ok(g.build(so.id, so.kind).ok, "la case devient un support de son sol");
  eq(g.cutCost(), C.forest.cost + C.forest.costStep, "le prix monte");
  const free = g.L.sockets.find((s) => !s.forest);
  ok(!g.cut(free.id).ok, "pas de coupe sans forêt");
  g.state.gold = 0;
  const other = g.L.sockets.find((s) => s.forest && s.id !== so.id);
  const rr = g.cut(other.id);
  ok(!rr.ok && /manque/.test(rr.reason), "or insuffisant");
});
test("la coupe s'arrête en pause et continue pendant une attaque", () => {
  const g = new P.Game({ level: 2 });
  const so = forestTile(g);
  g.state.gold = 200;
  ok(g.cut(so.id).ok);
  g.setPaused(true);
  g.update(1);
  eq(g.cutProgress(so.id), 0, "rien en pause");
  g.setPaused(false);
  g.launchWave();
  g.advance(C.forest.duration + 0.2);
  eq(g.isForest(so.id), false, "coupée pendant la vague");
});
test("sauvegarde : cases coupées, coupe en cours et prix des coupes sont repris", () => {
  const g = new P.Game({ level: 3, unlocked: unlockedFor(3) });
  g.state.gold = 1000;
  const [a, b2] = g.L.sockets.filter((s) => s.forest);
  ok(g.cut(a.id).ok);
  g.advance(C.forest.duration + 0.1);
  ok(g.build(a.id, a.kind).ok);
  ok(g.cut(b2.id).ok);
  g.advance(1);
  const cp = JSON.parse(JSON.stringify(g.serialize()));
  eq(cp.v, C.version);
  ok(P.Game.compatible(cp), "compatible");
  const h = new P.Game({ level: 3, checkpoint: cp });
  eq(h.isForest(a.id), false, "coupée");
  ok(h.towerAt(a.id), "tour reprise sur la case coupée");
  ok(near(h.cutProgress(b2.id), 1 / C.forest.duration, 0.02), "coupe en cours reprise");
  eq(h.cutCost(), g.cutCost(), "prix repris");
  h.advance(C.forest.duration);
  eq(h.isForest(b2.id), false, "la coupe reprise se termine");
});
test("anciennes sauvegardes : refusées sans erreur, effacées au chargement", () => {
  const g = new P.Game({ level: 1 });
  const cp = g.serialize();
  ok(P.Game.compatible(cp));
  ok(!P.Game.compatible(Object.assign({}, cp, { v: 1 })), "ancien format");
  ok(!P.Game.compatible(Object.assign({}, cp, { layoutId: "L1-bienvenue" })), "ancienne disposition");
  ok(!P.Game.compatible(Object.assign({}, cp, { towers: [{ socket: "s999" }] })), "case inconnue");
  let threw = false;
  try {
    new P.Game({ level: 1, checkpoint: Object.assign({}, cp, { v: 1 }) });
  } catch {
    threw = true;
  }
  ok(threw, "reprise refusée");
  // Stockage du navigateur simulé : l'ancienne partie est effacée, la nouvelle est lue.
  const store = new Map([
    ["ptmt.save.v1", JSON.stringify({ v: 1, level: 1 })],
    ["ptmt.save.v2", JSON.stringify(Object.assign({}, cp, { v: 1 }))],
  ]);
  const ls = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  eq(P.progress.loadCheckpoint(ls), null, "rien à reprendre");
  ok(!store.has("ptmt.save.v1") && !store.has("ptmt.save.v2"), "anciennes sauvegardes effacées");
  P.progress.saveCheckpoint(cp, ls);
  ok(P.progress.loadCheckpoint(ls), "sauvegarde actuelle lue");
});

console.log("Annonce des vagues");
test("prochaine vague : fronts par porte (couleur, nom, cibles, ennemis), trajets et vagues suivantes", () => {
  for (let lv = 1; lv <= 5; lv++) {
    const g = new P.Game({ level: lv, unlocked: unlockedFor(lv) });
    const pv = g.preview();
    eq(pv.number, 1);
    ok(pv.fronts.length >= 1, "au moins un front");
    const total = pv.fronts.reduce((a, f) => a + f.count, 0);
    eq(total, g.state.waves[0].reduce((a, x) => a + x.count, 0), "tous les ennemis annoncés");
    for (const f of pv.fronts) {
      const e = g.L.entries.find((x) => x.node === f.entry);
      ok(e, "porte connue");
      eq(f.color, e.color, "couleur de la porte");
      eq(f.label, e.label, "nom de la porte");
      ok(f.targets.every((t) => g.reserve(t)), "réserves visées");
      ok(f.groups.every((x) => C.enemies[x.type] && x.count > 0), "groupes");
      ok(pv.routes.some((r) => r.entry === f.entry && r.color === f.color), "trajet coloré depuis cette porte");
    }
    eq(pv.upcoming.length, 3, "trois vagues suivantes annoncées");
    eq(pv.upcoming[0].number, 2);
    ok(pv.upcoming[0].fronts.length >= 1);
  }
  // Dernière vague : plus rien après ; puis le mode sans fin annonce aussi ses vagues.
  const g = new P.Game({ level: 1 });
  g.state.wave = g.state.waveCount - 1;
  const last = g.preview();
  ok(last.last, "dernière vague signalée");
  eq(last.upcoming.length, 0);
  g.launchWave();
  g.state.spawns.length = 0;
  g.tick(C.tick);
  eq(g.state.phase, "victory");
  g.continueEndless();
  const pe = g.preview();
  ok(pe.endless && pe.number === 1 && pe.upcoming.length === 3, "sans fin : vague 1 et les trois suivantes");
  eq(pe.upcoming[3 - 1].number, 4);
  const w5 = g.waveDefAt(4);
  ok(g.describeWave(w5.def, 4).boss, "le boss de la cinquième vague sans fin est annoncé");
});
test("la tour d'eau de palier I est le Cygne grincheux", () => {
  eq(C.towers.water.forms["1"].name, "Cygne grincheux");
});

console.log("Trésors, vols et victoire");
test("une réserve vide ne provoque pas de défaite ; le niveau continue", () => {
  const g = new P.Game({ level: 1 });
  for (let i = 0; i < 3; i++) {
    const e = stealOne(g, "B");
    runToExit(g, e);
  }
  eq(g.reserve("B").stock.length, 0, "réserve B vide");
  ok(g.state.phase !== "defeat", "pas de défaite");
  eq(g.savedCount(), 3, "trois trésors encore sauvables");
  checkTreasures(g);
});
test("la défaite n'arrive qu'à la sortie du dernier trésor", () => {
  const g = new P.Game({ level: 1 });
  for (let i = 0; i < 5; i++) runToExit(g, stealOne(g, i < 3 ? "A" : "B"));
  ok(g.state.phase !== "defeat", "5 perdus : pas encore de défaite");
  const last = stealOne(g, "B");
  ok(g.state.phase !== "defeat", "transporté : pas perdu");
  runToExit(g, last);
  eq(g.state.phase, "defeat", "défaite quand le dernier sort");
  eq(g.state.result.win, false);
});
test("victoire avec un seul trésor sauvé (1 étoile)", () => {
  const g = new P.Game({ level: 1 });
  for (let i = 0; i < 5; i++) runToExit(g, stealOne(g, i < 3 ? "A" : "B"));
  g.state.phase = "prep";
  g.state.enemies.length = 0;
  g.state.wave = g.state.waveCount - 1;
  g.launchWave();
  g.state.spawns.length = 0;
  g.tick(C.tick);
  eq(g.state.phase, "victory");
  eq(g.state.result.saved, 1);
  eq(g.state.result.stars, 1);
});
test("étoiles : 3 sans aucun vol, 2 sans perte définitive, l'information « déjà pris » est conservée", () => {
  const g = new P.Game({ level: 1 });
  g.state.phase = "prep";
  g.state.wave = g.state.waveCount - 1;
  g.launchWave();
  g.state.spawns.length = 0;
  g.tick(C.tick);
  eq(g.state.result.stars, 3);
  const h = new P.Game({ level: 1 });
  const e = stealOne(h, "A");
  h.damage(e, 1e6, "direct", {});
  const t = h.state.treasures.find((x) => x.everTaken);
  eq(t.state, "dropped");
  h.state.wave = h.state.waveCount;
  h.state.spawns.length = 0;
  h.state.enemies.length = 0;
  h.tick(C.tick);
  eq(t.state, "stored", "retour automatique avant la victoire");
  ok(t.everTaken, "« déjà pris » conservé");
  eq(h.state.phase, "victory");
  eq(h.state.result.stars, 2);
});
test("trésor volé, lâché, repris, rappelé, puis retour automatique — sans duplication", () => {
  const g = new P.Game({ level: 1, unlocked: ["meteor", "recall"] });
  const e1 = stealOne(g, "A");
  checkTreasures(g);
  const tid = e1.carrying;
  for (let i = 0; i < 30; i++) g.tick(C.tick);
  g.damage(e1, 1e6, "direct", {});
  eq(g.treasure(tid).state, "dropped", "lâché au KO");
  checkTreasures(g);
  // Un autre voleur le ramasse.
  const e2 = g.spawnEnemy({ type: "voleur", elite: false, entry: g.L.entries[0].node, target: "A" });
  // Réserves fictivement vides pour que le sac tombé soit la seule cible.
  for (const r of g.state.reserves) r.stock.length = 0;
  g.state.treasures.filter((t) => t.state === "stored").forEach((t) => (t.state = "lost"));
  g.planFor(e2, null);
  eq(e2.goal.kind, "sack", "vise le sac tombé");
  for (let i = 0; i < 6000 && !e2.carrying; i++) g.tick(C.tick);
  eq(e2.carrying, tid, "sac repris");
  checkTreasures(g);
  g.damage(e2, 1e6, "direct", {});
  eq(g.treasure(tid).state, "dropped");
  // Rappel.
  g.state.mana = 100;
  const t = g.treasure(tid);
  const r = g.cast("recall", t.x, t.z);
  ok(r.ok, r.reason);
  for (let i = 0; i < 30; i++) g.tick(C.tick);
  eq(t.state, "stored", "rappelé");
  ok(g.reserve("A").stock.includes(tid), "dans sa réserve d'origine");
  checkTreasures(g);
  // Deux porteurs ne peuvent pas prendre le même sac.
  const e3 = stealOne(g, "A");
  g.damage(e3, 1e6, "direct", {});
  const sack = g.state.treasures.find((x) => x.state === "dropped");
  ok(g.moveTreasure(sack, "dropped", "carried", { carrier: "X" }), "premier ramassage");
  ok(!g.moveTreasure(sack, "dropped", "carried", { carrier: "Y" }), "second ramassage refusé");
  sack.state = "dropped";
  sack.carrier = null;
  // Fin de vague : retour gratuit.
  g.state.enemies.length = 0;
  g.state.spawns.length = 0;
  g.tick(C.tick);
  eq(sack.state, "stored", "retour automatique en fin de vague");
  checkTreasures(g);
});
test("sac tombé dans l'eau : flottant, accessible au Rappel et aux nageurs seulement", () => {
  const g = new P.Game({ level: 4, unlocked: unlockedFor(4) });
  g.state.phase = "wave";
  const e = g.spawnEnemy({ type: "nageur", elite: false, entry: "Ww", target: "A" });
  for (let i = 0; i < 600 && !(e.onWater && e.s > 8); i++) g.tick(C.tick);
  ok(e.onWater, "le nageur est dans l'eau");
  // Le nageur porte un trésor fictif puis est mis KO dans l'eau.
  const t = g.state.treasures[0];
  g.reserve(t.reserve).stock.splice(g.reserve(t.reserve).stock.indexOf(t.id), 1);
  t.state = "carried";
  t.carrier = e.id;
  e.carrying = t.id;
  g.damage(e, 1e6, "direct", {});
  eq(t.state, "dropped");
  ok(t.floating, "flotte");
  const walker = g.spawnEnemy({ type: "voleur", elite: false, entry: "N", target: "B" });
  ok(!g.nearestSack(walker, "N"), "inaccessible à un marcheur");
  const swimmer = g.spawnEnemy({ type: "nageur", elite: false, entry: "Ww", target: "B" });
  ok(g.nearestSack(swimmer, "Ww"), "accessible à un nageur");
  checkTreasures(g);
});
test("plusieurs voleurs ouvrent en parallèle ; une immobilisation suspend, s'éloigner interrompt", () => {
  const g = new P.Game({ level: 1 });
  g.state.phase = "wave";
  const mk = () => {
    const e = g.spawnEnemy({ type: "voleur", elite: false, entry: "N", target: "A" });
    e.s = e.route.line.length;
    const p = P.geom.at(e.route.line, e.s);
    e.x = p.x;
    e.z = p.z;
    g.arrive(e);
    return e;
  };
  const a = mk(),
    b = mk();
  eq(a.state, "steal");
  eq(b.state, "steal");
  g.tick(C.tick);
  ok(a.stealT < a.stealTotal && b.stealT < b.stealTotal, "les deux progressent");
  g.immobilize(a, "freeze", 1.5);
  const before = a.stealT;
  for (let i = 0; i < 10; i++) g.tick(C.tick);
  ok(near(a.stealT, before), "gel : ouverture suspendue");
  g.damage(b, 1, "direct", {});
  eq(b.state === "steal" || b.state === "flee", true, "un tir n'annule pas l'ouverture");
  const c = mk();
  g.push(c, 3, { family: "trap" });
  eq(c.state, "walk", "éloigné : ouverture interrompue");
});

console.log("Tours, pièges, sorts, moulin");
test("toutes les branches de tours (I, II-A/B, III-A/B) se construisent et tirent", () => {
  for (const fam of ["fire", "ice", "water"])
    for (const br of ["A", "B"]) {
      const g = new P.Game({ level: 1 });
      g.state.gold = 5000;
      const rt = P.routes.route(g.graph, "N", [g.reserve("A").doorNode]);
      const so = g.L.sockets.filter((x) => x.kind === fam).sort((p, q) => P.geom.project(rt.line, p.x, p.z).d - P.geom.project(rt.line, q.x, q.z).d)[0];
      const tw = g.build(so.id, fam).tower;
      g.upgradeMill("atelier");
      g.upgradeMill("atelier");
      tw.xp = 95;
      ok(g.upgradeTower(tw.id, br).ok, fam + " II" + br);
      ok(g.upgradeTower(tw.id).ok, fam + " III" + br);
      eq(tw.tier, 3);
      // Un voleur placé sur son chemin, au plus près de la tour.
      g.state.phase = "wave";
      const e = g.spawnEnemy({ type: "demenageur", elite: false, entry: "N", target: "A" });
      e.hp = e.maxHp = 1e6;
      const pr = P.geom.project(e.route.line, tw.x, tw.z);
      e.s = pr.s;
      e.x = pr.x;
      e.z = pr.z;
      ok(pr.d < g.towerStats(tw).range, "cible à portée");
      let fired = 0;
      for (let i = 0; i < 300; i++) {
        e.s = pr.s;
        e.x = pr.x;
        e.z = pr.z;
        g.tick(C.tick);
        fired += g.drainEvents().filter((ev) => ev.type === "fire").length;
      }
      ok(fired > 0, `${fam} III${br} a attaqué`);
      ok(e.hp < 1e6, `${fam} III${br} a blessé`);
    }
});
test("évolution : XP et Atelier requis, choix irréversible, XP conservée", () => {
  const g = new P.Game({ level: 1 });
  g.state.gold = 5000;
  const tw = g.build(g.L.sockets.find((x) => x.kind === "fire").id, "fire").tower;
  ok(!g.upgradeTower(tw.id, "A").ok, "sans XP");
  tw.xp = 30;
  ok(!g.upgradeTower(tw.id, "A").ok, "sans Atelier I");
  g.upgradeMill("atelier");
  ok(g.upgradeTower(tw.id, "A").ok);
  ok(!g.upgradeTower(tw.id, "B").ok, "branche verrouillée");
  eq(tw.branch, "A");
  eq(tw.xp, 30, "XP conservée");
  tw.xp = 90;
  ok(!g.upgradeTower(tw.id).ok, "palier III : Atelier II requis");
  g.upgradeMill("atelier");
  ok(g.upgradeTower(tw.id).ok);
  eq(tw.spent, 100 + 150 + 280, "coûts additionnés");
});
test("revente : 70 % de l'or réellement dépensé, l'XP disparaît", () => {
  const g = new P.Game({ level: 1 });
  g.state.gold = 1000;
  const tw = g.build(g.L.sockets.find((x) => x.kind === "ice").id, "ice").tower;
  g.upgradeMill("atelier");
  tw.xp = 40;
  g.upgradeTower(tw.id, "B");
  const gold = g.state.gold;
  const r = g.sellTower(tw.id);
  eq(r.gold, Math.floor((90 + 150) * 0.7));
  eq(g.state.gold, gold + r.gold);
  eq(g.state.towers.length, 0);
});
test("XP : 5 par tour ayant contribué, une seule fois par couple tour/ennemi (pas d'XP infinie sur un gelé)", () => {
  const g = new P.Game({ level: 1 });
  g.state.phase = "wave";
  g.state.gold = 1000;
  const ice = g.build(g.L.sockets.find((x) => x.kind === "ice").id, "ice").tower;
  const fire = g.build(g.L.sockets.find((x) => x.kind === "fire").id, "fire").tower;
  const e = g.spawnEnemy({ type: "voleur", elite: false, entry: "N", target: "A" });
  e.maxHp = e.hp = 1e9;
  for (let i = 0; i < 50; i++) {
    g.applySlow(e, "ice", 0.3, 2, ice.id);
    g.immobilize(e, "freeze", 1, { tower: ice.id });
    g.damage(e, 1, "direct", { tower: fire.id, family: "fire" });
  }
  eq(ice.xp + fire.xp, 0, "pas d'XP sans KO");
  e.hp = 1;
  g.damage(e, 5, "direct", { tower: fire.id });
  eq(ice.xp, 5, "glace récompensée pour son contrôle");
  eq(fire.xp, 5, "feu récompensé");
});
test("brûlures et sols : la plus forte seulement, durée rafraîchie", () => {
  const g = new P.Game({ level: 1 });
  const e = g.spawnEnemy({ type: "demenageur", elite: false, entry: "N", target: "A" });
  g.applyBurn(e, 5, 3);
  g.applyBurn(e, 8, 4);
  g.applyBurn(e, 6, 3);
  eq(e.burn.dps, 8);
  ok(near(e.burn.t, 4));
  g.state.areas.push({ id: "a1", kind: "groundFire", x: e.x, z: e.z, r: 2, t: 3, dur: 3, dps: 6 }, { id: "a2", kind: "groundFire", x: e.x, z: e.z, r: 2, t: 3, dur: 3, dps: 10 });
  e.burn = null;
  const hp = e.hp;
  g.updateAreas(1);
  ok(near(hp - e.hp, 10, 1e-6), "sol le plus fort seulement (10/s)");
});
test("contrôles : ralentissement le plus fort plafonné, immunités, ténacité, plafond de 4 s", () => {
  const g = new P.Game({ level: 1 });
  const e = g.spawnEnemy({ type: "voleur", elite: false, entry: "N", target: "A" });
  g.applySlow(e, "a", 0.3, 5);
  g.applySlow(e, "b", 0.9, 5);
  g.updateStatus(e, 0.01);
  eq(e.slow, 0.6, "plafond 60 %");
  const d1 = g.immobilize(e, "freeze", 10);
  ok(near(d1, 4), "plafond de 4 s");
  eq(g.immobilize(e, "net", 1), 0, "immunité après gel");
  ok(near(e.tenacity, 0.7), "ténacité");
  e.ccImmuneT = 0;
  const d2 = g.immobilize(e, "net", 1);
  ok(near(d2, 0.7), "efficacité ×0,7");
  e.moveImmuneT = 0;
  e.s = 10;
  g.push(e, 1, { family: "trap" });
  eq(g.push(e, 1, { family: "trap" }), 0, "immunité de déplacement 2 s");
  for (let i = 0; i < 40; i++) g.immobilize(Object.assign(e, { ccImmuneT: 0 }), "net", 0.01);
  ok(e.tenacity >= C.control.tenacityMin - 1e-9, "ténacité minimale 10 %");
  const boss = g.spawnEnemy({ type: "boss", elite: false, entry: "N", target: "A" });
  g.applySlow(boss, "a", 0.9, 5);
  g.updateStatus(boss, 0.01);
  eq(boss.slow, 0.25, "boss : 25 % max");
  ok(near(g.immobilize(boss, "freeze", 2), 0.7), "boss : 35 % de la durée");
  const mover = g.spawnEnemy({ type: "demenageur", elite: false, entry: "N", target: "A" });
  mover.s = 10;
  ok(near(g.push(mover, 2, { family: "trap" }), 0.8), "lourd : 40 % du recul");
});
test("recul et attraction restent sur le chemin (jamais au-delà du départ ni d'une sortie)", () => {
  const g = new P.Game({ level: 1 });
  const e = g.spawnEnemy({ type: "voleur", elite: false, entry: "N", target: "A" });
  e.s = 1;
  g.push(e, 5, { family: "trap" });
  ok(e.s >= 0, "pas avant le départ");
  e.moveImmuneT = 0;
  e.s = e.route.line.length - 0.5;
  g.pull(e, 1000, 1000, 5, {});
  ok(e.s <= e.route.line.length + 1e-9, "pas au-delà de la fin du trajet");
  const p = P.geom.at(e.route.line, e.s);
  ok(near(p.x, e.x) && near(p.z, e.z), "position sur le trajet");
});
test("pièges : trois paliers, limite de l'Atelier, recharge seulement s'il a agi, leurre une seule fois", () => {
  const g = new P.Game({ level: 1 });
  g.state.gold = 5000;
  const rtNA = P.routes.route(g.graph, "N", [g.reserve("A").doorNode]);
  const slots = g.L.trapSlots.slice().sort((p, q) => P.geom.project(rtNA.line, p.x, p.z).d - P.geom.project(rtNA.line, q.x, q.z).d);
  const a = g.buildTrap(slots[1].id, "net").trap;
  g.buildTrap(slots[2].id, "spring");
  g.buildTrap(slots[0].id, "lure");
  ok(!g.buildTrap(slots[3].id, "net").ok, "limite de 3");
  g.upgradeMill("atelier");
  ok(g.buildTrap(slots[3].id, "net").ok, "4 avec l'Atelier I");
  ok(g.upgradeTrap(a.id).ok, "palier II");
  ok(!g.upgradeTrap(a.id).ok, "palier III : Atelier II requis");
  g.upgradeMill("atelier");
  ok(g.upgradeTrap(a.id).ok, "palier III");
  g.state.phase = "wave";
  g.updateTraps(C.tick);
  eq(a.cd, 0, "pas de recharge sans cible");
  const lure = g.state.traps.find((t) => t.kind === "lure");
  const e = g.spawnEnemy({ type: "voleur", elite: false, entry: "N", target: "A" });
  const pr = P.geom.project(e.route.line, lure.x, lure.z);
  e.s = pr.s;
  const p = P.geom.at(e.route.line, e.s);
  e.x = p.x;
  e.z = p.z;
  ok(Math.hypot(e.x - lure.x, e.z - lure.z) <= C.traps.lure.tiers[1].radius, "voleur à portée du faux coffre");
  g.updateTraps(C.tick);
  ok(e.lure, "attiré");
  eq(e.goal.kind, "lure", "marche vers le coffre");
  for (let i = 0; i < 200; i++) {
    g.updateStatus(e, C.tick);
    if (e.state !== "dead") g.move(e, C.tick);
  }
  eq(e.goal.kind, "reserve", "reprend sa route");
  ok(e.fooled, "trompé une fois");
  lure.cd = 0;
  e.ccImmuneT = 0;
  g.updateTraps(C.tick);
  ok(!e.lure, "ne se laisse plus tromper");
});
test("sorts : trois rangs, mana à l'exécution, recharge en attaque seulement, attente en pause", () => {
  const g = new P.Game({ level: 5, unlocked: unlockedFor(5) });
  g.state.gold = 5000;
  ok(!g.upgradeSpell("meteor").ok, "rang II : Atelier I requis");
  g.upgradeMill("atelier");
  ok(g.upgradeSpell("meteor").ok);
  g.upgradeMill("atelier");
  ok(g.upgradeSpell("meteor").ok);
  eq(g.state.spells.meteor.rank, 3);
  ok(!g.cast("meteor", 30, 20).ok, "hors attaque");
  g.launchWave();
  g.setPaused(true);
  const mana = g.state.mana;
  ok(g.cast("meteor", 30, 20).queued, "mis en attente");
  ok(g.cast("meteor", 31, 21).queued, "remplace la commande précédente");
  eq(Object.keys(g.state.queued).length, 1);
  eq(g.state.mana, mana, "pas de mana en pause");
  g.update(1);
  eq(g.state.spells.meteor.cd, 0, "rien ne progresse en pause");
  g.setPaused(false);
  eq(g.state.mana, mana - 45, "mana consommée à l'exécution");
  ok(g.state.spells.meteor.cd > 0);
  for (const id of ["freeze", "flood", "frenzy"]) {
    g.state.mana = 200;
    ok(g.cast(id, 30, 20).ok, id);
  }
  g.state.mana = 200;
  const r = g.cast("recall", 5, 5);
  ok(!r.ok, "Rappel sans sac : rien de consommé");
  eq(g.state.mana, 200);
});
test("améliorations du moulin : coûts, effets, prérequis et remise à zéro au niveau suivant", () => {
  const g = new P.Game({ level: 1 });
  g.state.gold = 5000;
  ok(g.upgradeMill("roue").ok);
  eq(g.state.manaMax, 120);
  ok(g.state.mana <= 100, "augmenter la capacité ne remplit pas la jauge");
  ok(g.upgradeMill("meule").ok);
  g.upgradeMill("meule");
  g.upgradeMill("meule");
  ok(!g.upgradeMill("meule").ok, "maximum");
  const gold = g.state.gold;
  g.launchWave();
  g.state.spawns.length = 0;
  g.tick(C.tick);
  eq(g.state.gold, gold + 145, "revenu de fin de vague");
  const h = new P.Game({ level: 2 });
  eq(JSON.stringify(h.state.mill), JSON.stringify({ meule: 0, roue: 0, atelier: 0 }), "remis à zéro");
});
test("réserves : paliers II et III ralentissent le vol sans ajouter de trésor", () => {
  const g = new P.Game({ level: 1 });
  g.state.gold = 5000;
  ok(!g.upgradeReserve("A").ok, "Atelier I requis");
  g.upgradeMill("atelier");
  ok(g.upgradeReserve("A").ok);
  g.upgradeMill("atelier");
  ok(g.upgradeReserve("A").ok);
  eq(g.reserve("A").tier, 3);
  eq(g.reserve("A").stock.length, 3, "stock inchangé");
  g.state.phase = "wave";
  const e = g.spawnEnemy({ type: "fumigene", elite: false, entry: "N", target: "A" });
  e.s = e.route.line.length;
  g.arrive(e);
  ok(near(e.stealT, 2.4), "2,4 s");
  e.untargetT = 2;
  ok(g.targetable(e, true), "coffre hurleur : fumigène révélé");
});
test("ennemis : élites (PV ×1,5, prime ×1,4), casserole, fumigène, canapé, surchauffe du boss", () => {
  const g = new P.Game({ level: 5 });
  g.state.phase = "wave";
  g.state.wave = 1;
  const v = g.spawnEnemy({ type: "voleur", elite: true, entry: "N", target: "A" });
  ok(near(v.maxHp, 60 * 1.8 * 1.5), "PV élite niveau 5 vague 1");
  eq(v.bounty, Math.round(8 * 1.4));
  const hp = v.hp;
  g.damage(v, 20, "direct", {});
  ok(near(hp - v.hp, 10), "casserole : premier impact ÷2");
  g.damage(v, 20, "direct", {});
  ok(near(hp - v.hp, 30), "puis dégâts normaux");
  const f = g.spawnEnemy({ type: "fumigene", elite: false, entry: "N", target: "A" });
  g.damage(f, 1, "explosion", {});
  ok(!g.targetable(f, true) && g.targetable(f, false), "fumigène : non ciblable directement, zones OK");
  const sofa = g.spawnEnemy({ type: "demenageur", elite: true, entry: "N", target: "A" });
  const ally = g.spawnEnemy({ type: "voleur", elite: false, entry: "N", target: "A" });
  sofa.x = 10;
  sofa.z = 10;
  sofa.dx = 1;
  sofa.dz = 0;
  ally.x = 9.4;
  ally.z = 10;
  let h0 = ally.hp;
  g.damage(ally, 10, "direct", {});
  ok(near(h0 - ally.hp, 8), "canapé : −20 % en direct");
  h0 = ally.hp;
  g.damage(ally, 10, "explosion", {});
  ok(near(h0 - ally.hp, 10), "explosions ignorent le canapé");
  const boss = g.spawnEnemy({ type: "boss", elite: false, entry: "N", target: "A" });
  for (let i = 0; i < 200; i++) g.tick(C.tick);
  ok(boss.overheatT > 0 || boss.moveClock < 6.1, "surchauffe après 6 s");
});
test("pause et vitesse ×2 : même état après le même temps simulé", () => {
  const a = new P.Game({ level: 1 }),
    b = new P.Game({ level: 1 });
  for (const g of [a, b]) {
    g.build("s0", "fire");
    g.launchWave();
  }
  b.setSpeed(2);
  for (let i = 0; i < 60; i++) a.update(1 / 30);
  for (let i = 0; i < 30; i++) b.update(1 / 30);
  a.setPaused(true);
  a.update(5);
  ok(near(a.state.time, b.state.time, 1e-9), "même temps simulé");
  eq(a.state.enemies.length, b.state.enemies.length);
  ok(near(a.state.enemies[0].s, b.state.enemies[0].s, 1e-9), "même position");
});
test("sauvegarde entre les vagues : reprise exacte de la même disposition et des achats", () => {
  const g = new P.Game({ level: 3, unlocked: unlockedFor(3) });
  const bot = makeBot(P, g);
  bot.prep();
  g.launchWave();
  while (g.state.phase === "wave") g.advance(0.5);
  bot.prep();
  const cp = JSON.parse(JSON.stringify(g.serialize()));
  const h = new P.Game({ level: 3, checkpoint: cp });
  eq(h.state.layoutId, g.state.layoutId);
  eq(h.state.wave, g.state.wave);
  eq(h.state.gold, g.state.gold);
  eq(JSON.stringify(h.state.towers.map((t) => [t.socket, t.family, t.tier, t.branch, t.xp, t.spent])), JSON.stringify(g.state.towers.map((t) => [t.socket, t.family, t.tier, t.branch, t.xp, t.spent])));
  eq(JSON.stringify(h.state.treasures.map((t) => [t.id, t.state, t.everTaken])), JSON.stringify(g.state.treasures.map((t) => [t.id, t.state, t.everTaken])));
  // Les deux parties continuent à l'identique.
  g.launchWave();
  h.launchWave();
  for (let i = 0; i < 300; i++) {
    g.tick(C.tick);
    h.tick(C.tick);
  }
  eq(h.state.stats.kos, g.state.stats.kos, "même déroulé");
});
test("continuer sans fin : conserve tout, pas de nouveaux trésors, boss toutes les 5 vagues, fin à la perte du dernier", () => {
  const g = new P.Game({ level: 1 });
  g.state.phase = "prep";
  g.state.wave = g.state.waveCount - 1;
  g.state.gold = 777;
  g.launchWave();
  g.state.spawns.length = 0;
  g.tick(C.tick);
  eq(g.state.phase, "victory");
  ok(g.continueEndless().ok);
  eq(g.state.treasures.length, 6);
  ok(g.state.gold >= 777);
  for (let n = 1; n <= 10; n++) {
    const w = P.waves.endlessWave(g.L, 1, n);
    eq(w.groups.some((x) => x.type === "boss"), n % 5 === 0, "boss vague " + n);
    if (n === 10) ok(w.groups.some((x) => x.type === "boss" && x.elite), "variante élite du boss");
  }
  g.launchWave();
  eq(g.state.endlessCount, 1);
  ok(g.state.spawns.length > 0);
  for (let i = 0; i < 6; i++) runToExit(g, stealOne(g, i < 3 ? "A" : "B"));
  eq(g.state.phase, "defeat", "le sans-fin se termine à la perte du dernier trésor");
});
test("talents : prérequis, 14 points par famille, pas de points infinis en rejouant", () => {
  const T = P.talents;
  const a = T.emptyAllocation();
  ok(T.canRankUp(a, "fire", "furnace", 20), "avancé bloqué sans 5 points");
  a.fire.embers = 3;
  a.fire.boom = 2;
  ok(!T.canRankUp(a, "fire", "furnace", 20), "avancé disponible avec 5 points");
  a.fire.furnace = 2;
  a.fire.meteorHaste = 1;
  ok(T.canRankUp(a, "fire", "contagion", 20), "ultime : 9 points requis");
  a.fire.meteorHaste = 2;
  ok(!T.canRankUp(a, "fire", "contagion", 20), "ultime : 9 points et un avancé au rang 2");
  a.fire.contagion = 1;
  ok(T.canRankDown(a, "fire", "embers"), "retirer un point de base requis est refusé");
  ok(T.canRankDown(a, "fire", "furnace"), "descendre sous 9 points avec l'ultime est refusé");
  a.fire.boom = 3;
  a.fire.meteorPower = 3;
  eq(T.spentIn(a, "fire"), 14, "famille complète = 14 points");
  ok(!T.canRankDown(a, "fire", "furnace"), "retrait possible s'il reste un avancé au rang 2");
  a.fire.meteorHaste = 1;
  ok(T.canRankDown(a, "fire", "furnace"), "retirer le seul avancé au rang 2 est refusé");
  a.fire.meteorHaste = 2;
  ok(T.validate(a, 20));
  ok(!T.validate(a, 13), "pas plus de points que gagnés");
  const prog = P.progress.fresh();
  const r1 = P.progress.recordResult(prog, 1, { win: true, stars: 3 });
  eq(r1.points, 4, "3 étoiles d'un coup : 4 points");
  const r2 = P.progress.recordResult(prog, 1, { win: true, stars: 3 });
  eq(r2.points, 0, "rejouer ne redonne pas de points");
  eq(P.progress.pointsEarned(prog), 4);
});
test("les talents modifient les valeurs finales (portées, gels, mana, rayons)", () => {
  const al = P.talents.emptyAllocation();
  al.ice.longview = 3;
  al.ice.bite = 3;
  al.ice.holdfast = 1;
  al.ice.thrift = 2;
  al.ice.shards = 0;
  const g = new P.Game({ level: 2, talents: al, unlocked: unlockedFor(2) });
  g.state.gold = 1000;
  const tw = g.build(g.L.sockets.find((x) => x.kind === "ice").id, "ice").tower;
  const f = g.towerStats(tw);
  ok(near(f.range, 6 * 1.15), "portée +15 %");
  ok(near(f.slow.pct, 0.39), "ralentissement +9 points");
  eq(g.spellMana("freeze"), 24, "Gel −20 % de mana");
});
test("le joueur automatique gagne chaque niveau avec les équipements accessibles", () => {
  for (let lv = 1; lv <= 5; lv++) {
    const g = new P.Game({ level: lv, unlocked: unlockedFor(lv) });
    const res = makeBot(P, g).play();
    ok(res.win, `niveau ${lv} gagné (${res.saved}/6)`);
    checkTreasures(g);
  }
});

console.log(`\n${passed} réussis, ${failed} échoués`);
process.exit(failed ? 1 : 0);
