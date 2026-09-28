import { loadSim } from "./load-sim.mjs";
const P = loadSim();
const g = new P.Game({ level: 1 });
console.log("gold", g.state.gold, "treasures", g.state.treasures.map((t) => t.id + ":" + t.reserve).join(" "));
console.log(g.build("s0", "fire"), g.build("s1", "ice").ok, g.state.gold);
console.log(g.preview().routes.map((r) => r.entry + ">" + r.target + " " + r.pts.length));
console.log(g.launchWave());
let t = 0;
while (g.state.phase === "wave" && t < 200) { g.advance(1); t++; }
console.log("after wave1", t, "s phase", g.state.phase, "gold", g.state.gold, "kos", g.state.stats.kos, "lost", g.state.stats.lostTotal, "towers xp", g.state.towers.map((w) => w.xp));
console.log(g.drainEvents().reduce((m, e) => ((m[e.type] = (m[e.type] || 0) + 1), m), {}));
