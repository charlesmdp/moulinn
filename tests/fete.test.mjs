// Vérifications de la Fête du Moulin (/moulin2) sans navigateur : réseau entre « onglets » simulés,
// présence, parties (hôte, décompte, résultats, relève de l'hôte, objets disputés).
//   node tests/fete.test.mjs
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0, passed = 0;
// Un « navigateur » commun : horloge pilotée par le test, canal entre onglets en mémoire.
const world = { time: 1000, channels: new Map() };
function test(name, fn) {
  world.channels = new Map(); // chaque essai a son propre « navigateur »
  try {
    fn();
    passed++;
    console.log("  ✓ " + name);
  } catch (e) {
    failed++;
    console.log("  ✗ " + name + "\n      " + (e && e.stack ? e.stack.split("\n").slice(0, 4).join("\n      ") : e));
  }
}
const ok = (c, msg) => {
  if (!c) throw new Error(msg || "assertion");
};
const eq = (a, b, msg) => {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((msg || "égalité") + ` : ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`);
};

class FakeBC {
  constructor(name) {
    this.name = name;
    this.onmessage = null;
    if (!world.channels.has(name)) world.channels.set(name, new Set());
    world.channels.get(name).add(this);
  }
  postMessage(data) {
    const copy = JSON.parse(JSON.stringify(data));
    for (const other of world.channels.get(this.name)) if (other !== this && other.onmessage) other.onmessage({ data: copy });
  }
  close() {
    world.channels.get(this.name).delete(this);
  }
}
/** Un onglet : son propre MoulinFete, son réseau, sa présence, ses parties. */
function tab(name, room) {
  const sandbox = { console, Math, JSON, Date: { now: () => world.time }, performance: { now: () => world.time }, setTimeout, clearTimeout, crypto: globalThis.crypto, Uint8Array };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  for (const f of ["05-kit.js", "10-net.js", "15-presence.js", "40-session.js"]) vm.runInContext(fs.readFileSync(path.join(root, "src/moulin2", f), "utf8"), sandbox, { filename: f });
  const MF = sandbox.MoulinFete;
  const mine = [];
  class BC extends FakeBC {
    constructor(n) {
      super(n);
      mine.push(this);
    }
  }
  const net = MF.Net.create({ name, color: "#e8402c", rtc: false, BroadcastChannel: BC, now: () => world.time, room });
  const pose = { x: 0, y: 0, z: 0, heading: 0, speed: 0, visible: true };
  const presence = MF.Presence.create({ net, world: { headless: true, player: { pose: () => pose }, heightAt: () => 0, invalidate() {} } });
  const sessions = MF.Sessions.create({ net, presence, now: () => world.time });
  return { MF, net, presence, sessions, pose, name, channels: mine };
}
/** L'onglet plante : il se tait d'un coup, sans dire au revoir. */
function crash(tb) {
  tb.closed = true;
  tb.channels.forEach((c) => c.close());
}
/** Fait avancer le temps : chaque onglet envoie sa présence et fait tourner ses parties. */
function run(tabs, seconds, step = 0.05) {
  for (let t = 0; t < seconds - 1e-9; t += step) {
    world.time += step * 1000;
    for (const tb of tabs) {
      if (tb.closed) continue;
      tb.net.tick();
      tb.presence.update(step, world.time / 1000);
      tb.sessions.tick();
    }
  }
}
const DEF = { minPlayers: 1, maxPlayers: 8, options: [{ key: "laps", values: [3, 5], default: 3 }], maxTime: 120, rank: (list) => list.slice().sort((a, b) => (a.dnf ? 1e9 : a.time) - (b.dnf ? 1e9 : b.time)) };

console.log("Réseau");
test("deux onglets du même salon se découvrent, avec nom et couleur", () => {
  const a = tab("Alice"), b = tab("Bob");
  run([a, b], 0.5);
  eq(a.net.peers.size, 1);
  eq([...b.net.peers.values()][0].name, "Alice");
  eq(a.net.status().label, "Public room #1");
  a.net.close();
  b.net.close();
});
test("deux salons différents ne se voient pas ; un salon privé a son code", () => {
  const a = tab("Alice", "les-copains"), b = tab("Bob"), c = tab("Chloé", "Les Copains");
  run([a, b, c], 0.5);
  eq(a.net.peers.size, 1, "Alice ne voit que Chloé");
  eq(b.net.peers.size, 0);
  eq(a.net.status().code, "les-copains");
  ok(a.net.status().isPrivate);
  [a, b, c].forEach((t) => t.net.close());
});
test("messages : diffusion, envoi ciblé, et un onglet fermé disparaît", () => {
  const a = tab("Alice"), b = tab("Bob"), c = tab("Chloé");
  run([a, b, c], 0.5);
  const got = { b: [], c: [] };
  b.net.on("test", (d, peer) => got.b.push(d + ":" + peer.name));
  c.net.on("test", (d, peer) => got.c.push(d + ":" + peer.name));
  a.net.send("test", "tous");
  a.net.sendTo(b.net.self.uid, "test", "bob");
  eq(got, { b: ["tous:Alice", "bob:Alice"], c: ["tous:Alice"] });
  let left = null;
  a.net.onLeave((p) => (left = p.name));
  c.net.close();
  c.closed = true;
  eq(left, "Chloé", "départ annoncé");
  // un onglet qui se tait (plantage) finit par être retiré
  crash(b);
  run([a], 9);
  eq(a.net.peers.size, 0);
  a.net.close();
});
test("changement de nom et de couleur transmis", () => {
  const a = tab("Alice"), b = tab("Bob");
  run([a, b], 0.5);
  a.net.setProfile({ name: "Alice la meunière", color: "#2f8fe8" });
  const p = [...b.net.peers.values()][0];
  eq(p.name, "Alice la meunière");
  eq(p.color, "#2f8fe8");
  a.net.close();
  b.net.close();
});

console.log("Présence");
test("position et activité des autres joueurs", () => {
  const a = tab("Alice"), b = tab("Bob");
  run([a, b], 0.5);
  a.pose.x = 12;
  a.pose.z = -30;
  a.presence.setActivity("rc", "wait");
  run([a, b], 0.5);
  const r = b.presence.of(a.net.self.uid);
  eq([r.tx, r.tz, r.game, r.state], [12, -30, "rc", "wait"]);
  eq(b.presence.inGame("rc").map((p) => p.name), ["Alice"]);
  a.net.close();
  b.net.close();
});

console.log("Parties");
test("seul : salle d'attente, option, décompte, partie, résultat", () => {
  const a = tab("Alice");
  const s = a.sessions.get("rc", DEF);
  s.join();
  eq(s.state.phase, "lobby");
  ok(s.isHost());
  s.setOption("laps", 5);
  eq(s.state.opts.laps, 5);
  s.setOption("laps", 4);
  eq(s.state.opts.laps, 5, "valeur inconnue refusée");
  s.requestStart();
  eq(s.state.phase, "countdown");
  ok(s.time() < 0, "décompte");
  run([a], 4);
  eq(s.state.phase, "run");
  ok(s.time() > 0 && s.time() < 1, "temps de course " + s.time());
  s.report({ time: 42.5 });
  eq(s.state.phase, "results");
  eq(s.state.ranking, [a.net.self.uid]);
  s.requestLobby();
  eq(s.state.phase, "lobby");
  a.net.close();
});
test("à trois : un seul hôte, tous partent ensemble, classement commun", () => {
  const a = tab("Alice"), b = tab("Bob"), c = tab("Chloé");
  const tabs = [a, b, c];
  run(tabs, 0.5);
  const S = tabs.map((t) => t.sessions.get("rc", DEF));
  S[0].join();
  run(tabs, 0.3);
  S[1].join();
  run(tabs, 0.3);
  S[2].join();
  run(tabs, 2);
  eq(S.map((s) => s.state && s.state.phase), ["lobby", "lobby", "lobby"]);
  eq(S.map((s) => s.state.host), Array(3).fill(a.net.self.uid), "Alice, arrivée la première, est l'hôte");
  eq(S[1].players().map((p) => p.name), ["Alice", "Bob", "Chloé"]);
  S[2].setOption("laps", 5); // demande transmise à l'hôte
  S[1].requestStart();
  run(tabs, 0.2);
  eq(S.map((s) => s.state.phase), ["countdown", "countdown", "countdown"]);
  eq(S.map((s) => s.state.opts.laps), [5, 5, 5]);
  eq(S[2].state.roster.map((p) => p.name), ["Alice", "Bob", "Chloé"]);
  eq(S.map((s) => s.slot()), [0, 1, 2]);
  ok(S[0].state.seed === S[2].state.seed && S[0].state.seed > 0, "même graine");
  run(tabs, 3.8);
  eq(S.map((s) => s.state.phase), ["run", "run", "run"]);
  ok(Math.abs(S[0].time() - S[2].time()) < 0.11, "horloges de course proches");
  eq(b.presence.inGame("rc").map((p) => p.state), ["play", "play", "play"]);
  S[1].report({ time: 61.2 });
  run(tabs, 0.2);
  eq(S[0].state.phase, "run", "on attend les autres");
  eq(Object.keys(S[2].state.results).length, 1, "résultat de Bob connu de Chloé");
  S[0].report({ time: 58.9 });
  S[2].report({ time: 70.1 });
  run(tabs, 0.3);
  eq(S.map((s) => s.state.phase), ["results", "results", "results"]);
  eq(S[1].state.ranking.map((uid) => S[1].state.roster.find((p) => p.uid === uid).name), ["Alice", "Bob", "Chloé"]);
  S[2].requestLobby();
  run(tabs, 0.3);
  eq(S.map((s) => s.state.phase), ["lobby", "lobby", "lobby"]);
  tabs.forEach((t) => t.net.close());
});
test("l'hôte s'en va en pleine partie : le suivant reprend et clôt", () => {
  const a = tab("Alice"), b = tab("Bob"), c = tab("Chloé");
  const tabs = [a, b, c];
  run(tabs, 0.5);
  const S = tabs.map((t) => t.sessions.get("rc", DEF));
  S[0].join();
  run(tabs, 0.3);
  S[1].join();
  run(tabs, 0.3);
  S[2].join();
  run(tabs, 2);
  S[0].requestStart();
  run(tabs, 4.2);
  eq(S.map((s) => s.state.phase), ["run", "run", "run"]);
  crash(a); // l'onglet d'Alice plante
  run(tabs, 12);
  eq([S[1].state.host, S[2].state.host], [b.net.self.uid, b.net.self.uid], "Bob devient l'hôte");
  S[1].report({ time: 50 });
  S[2].report({ time: 49 });
  run(tabs, 0.3);
  eq([S[1].state.phase, S[2].state.phase], ["results", "results"]);
  const names = S[2].state.ranking.map((uid) => S[2].state.roster.find((p) => p.uid === uid).name);
  eq(names, ["Chloé", "Bob", "Alice"], "Alice, partie, est classée dernière");
  ok(S[2].state.results[a.net.self.uid].dnf, "abandon noté");
  [b, c].forEach((t) => t.net.close());
});
test("l'hôte quitte le jeu proprement : la main passe aussitôt", () => {
  const a = tab("Alice"), b = tab("Bob");
  const tabs = [a, b];
  run(tabs, 0.5);
  const sa = a.sessions.get("rc", DEF), sb = b.sessions.get("rc", DEF);
  sa.join();
  run(tabs, 0.3);
  sb.join();
  run(tabs, 1);
  ok(sa.isHost() && !sb.isHost());
  sa.leave();
  run(tabs, 0.2);
  ok(sb.isHost(), "Bob est l'hôte sans délai");
  ok(!sa.isHost(), "Alice ne l'est plus");
  sb.requestStart();
  run(tabs, 0.2);
  eq(sb.state.phase, "countdown");
  eq(sa.state.phase, "countdown", "Alice, restée spectatrice, suit la partie");
  eq(sb.state.roster.map((p) => p.name), ["Bob"]);
  tabs.forEach((t) => t.net.close());
});
test("un passant apprend où en sont les parties en cours, puis les oublie quand tout le monde est parti", () => {
  const a = tab("Alice");
  const sa = a.sessions.get("tir", DEF);
  sa.join();
  sa.requestStart();
  run([a], 5);
  ok(sa.claim("cible-1"));
  const b = tab("Bob"); // arrive sur la page après le départ
  const sb = b.sessions.get("tir", DEF);
  const tabs = [a, b];
  run(tabs, 3);
  eq(sb.state && sb.state.phase, "run", "Bob, simple passant, voit la partie en cours");
  eq(sb.owner("cible-1"), a.net.self.uid, "et les cibles déjà tombées");
  sa.leave();
  run(tabs, 4);
  eq(sb.state, null, "plus personne : partie oubliée");
  eq(sa.state, null);
  tabs.forEach((t) => t.net.close());
});
test("deux parties ouvertes exactement en même temps (messages croisés) : une seule survit", () => {
  const a = tab("Alice"), b = tab("Bob");
  const tabs = [a, b];
  run(tabs, 0.5);
  const sa = a.sessions.get("golf", DEF), sb = b.sessions.get("golf", DEF);
  const hold = [];
  const real = FakeBC.prototype.postMessage;
  FakeBC.prototype.postMessage = function (data) {
    hold.push([this, data]);
  };
  sa.join();
  sb.join();
  FakeBC.prototype.postMessage = real;
  ok(sa.isHost() && sb.isHost(), "chacun se croit seul");
  hold.forEach(([ch, data]) => ch.postMessage(data));
  run(tabs, 2);
  eq(sa.state.id, sb.state.id, "même partie");
  eq(sa.state.host, sb.state.host, "même hôte");
  eq([sa.isHost(), sb.isHost()].filter(Boolean).length, 1);
  eq(sa.players().length, 2);
  tabs.forEach((t) => t.net.close());
});
test("arrivée en cours de partie : on regarde, puis on joue la suivante", () => {
  const a = tab("Alice"), b = tab("Bob");
  const tabs = [a, b];
  run(tabs, 0.5);
  const sa = a.sessions.get("rc", DEF), sb = b.sessions.get("rc", DEF);
  sa.join();
  sa.requestStart();
  run(tabs, 6);
  eq(sa.state.phase, "run");
  sb.join();
  run(tabs, 1);
  eq(sb.state.phase, "run");
  ok(!sb.inRoster(), "Bob n'est pas dans la partie en cours");
  ok(Math.abs(sb.time() - sa.time()) < 0.2, "il a la même horloge de course");
  eq(a.presence.inGame("rc").map((p) => p.state), ["play", "watch"]);
  sb.report({ time: 1 });
  eq(Object.keys(sa.state.results), [], "un spectateur ne peut pas déclarer de résultat");
  sa.report({ time: 30 });
  run(tabs, 0.3);
  eq(sb.state.phase, "results");
  sb.requestLobby();
  run(tabs, 0.3);
  sb.requestStart();
  run(tabs, 0.3);
  eq(sa.state.roster.map((p) => p.name), ["Alice", "Bob"]);
  tabs.forEach((t) => t.net.close());
});
test("deux joueurs ouvrent la même salle au même instant : une seule partie au final", () => {
  const a = tab("Alice"), b = tab("Bob");
  const tabs = [a, b];
  run(tabs, 0.5);
  const sa = a.sessions.get("golf", DEF), sb = b.sessions.get("golf", DEF);
  sa.join();
  sb.join(); // avant que la présence d'Alice ne soit arrivée chez Bob
  run(tabs, 3);
  eq(sa.state.host, sb.state.host, "même hôte");
  eq(sa.state.id, sb.state.id, "même partie");
  sb.requestStart();
  run(tabs, 0.3);
  eq([sa.state.phase, sb.state.phase], ["countdown", "countdown"]);
  tabs.forEach((t) => t.net.close());
});
test("rejoindre un jeu quitté plus tôt : l'ancien état est oublié", () => {
  const a = tab("Alice"), b = tab("Bob");
  const tabs = [a, b];
  run(tabs, 0.5);
  const sa = a.sessions.get("rc", DEF), sb = b.sessions.get("rc", DEF);
  sa.join();
  sa.requestStart();
  run(tabs, 4.5);
  sa.report({ time: 10 });
  sa.requestLobby();
  sa.requestStart();
  run(tabs, 4.5);
  sa.report({ time: 11 });
  ok(sa.state.rev > 6, "plusieurs changements d'état");
  sa.leave();
  run(tabs, 3);
  sb.join(); // Bob ouvre une partie toute neuve
  run(tabs, 0.5);
  sa.join();
  run(tabs, 2.5);
  eq(sa.state.id, sb.state.id);
  eq(sa.state.host, b.net.self.uid);
  eq(sa.state.phase, "lobby");
  tabs.forEach((t) => t.net.close());
});
test("messages et positions d'un jeu : reçus par les autres, tels qu'envoyés", () => {
  const a = tab("Alice"), b = tab("Bob");
  const tabs = [a, b];
  run(tabs, 0.5);
  const sa = a.sessions.get("rc", DEF), sb = b.sessions.get("rc", DEF), other = b.sessions.get("golf", DEF);
  sa.join();
  sb.join();
  run(tabs, 1);
  const got = [];
  sb.onState((d, peer) => got.push(["état", d, peer.name]));
  sb.on("coup", (d, peer) => got.push(["coup", d, peer.name]));
  other.onState(() => got.push(["mauvais jeu"]));
  sa.sendState([12.5, 1, -3, 0.25]);
  sa.send("coup", { force: 3 });
  sa.sendTo(b.net.self.uid, "coup", { force: 4 });
  eq(got, [["état", [12.5, 1, -3, 0.25], "Alice"], ["coup", { force: 3 }, "Alice"], ["coup", { force: 4 }, "Alice"]]);
  tabs.forEach((t) => t.net.close());
});
test("objets disputés : le plus rapide l'emporte, même si les messages se croisent", () => {
  const a = tab("Alice"), b = tab("Bob"), c = tab("Chloé");
  const tabs = [a, b, c];
  run(tabs, 0.5);
  const S = tabs.map((t) => t.sessions.get("tir", DEF));
  S[0].join();
  run(tabs, 0.3);
  S[1].join();
  S[2].join();
  run(tabs, 2);
  S[0].requestStart();
  run(tabs, 4.5);
  ok(S[1].claim("cible-7"), "Bob touche la cible 7");
  eq(S.map((s) => s.owner("cible-7")), Array(3).fill(b.net.self.uid));
  ok(!S[0].claim("cible-7"), "Alice arrive après : refusé");
  // messages croisés : Alice et Chloé réclament la même cible « en même temps » ; on coupe le canal le temps du croisement
  const hold = [];
  const real = FakeBC.prototype.postMessage;
  FakeBC.prototype.postMessage = function (data) {
    hold.push([this, data]);
  };
  ok(S[0].claim("canard-3") && S[2].claim("canard-3"), "chacune croit l'avoir");
  FakeBC.prototype.postMessage = real;
  hold.forEach(([ch, data]) => ch.postMessage(data));
  const winner = S[0].owner("canard-3");
  eq(S.map((s) => s.owner("canard-3")), Array(3).fill(winner), "tout le monde est d'accord");
  eq(S[1].claimed(b.net.self.uid), 1);
  tabs.forEach((t) => t.net.close());
});

console.log(`\n${passed} réussis, ${failed} échoués`);
process.exit(failed ? 1 : 0);
