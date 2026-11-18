// Essai des vingt-sept jeux de la fête dans le banc d'essai (scripts/labo.mjs), avec un vrai navigateur :
// chaque jeu est ouvert, lancé et joué quelques secondes d'horloge simulée ; aucune erreur ne doit
// sortir. À relancer après tout changement du relief ou d'un jeu.
//
//   node tests/fete-labo.mjs
//
// Il faut Playwright (présent dans les sessions Claude ; voir scripts/lib/page.mjs).
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = 8900 + Math.floor(Math.random() * 90);
const server = spawn(process.execPath, [path.join(root, "scripts", "labo.mjs")], { env: { ...process.env, PORT: String(port) }, stdio: "ignore" });
const base = "http://localhost:" + port + "/";
let browser,
  failed = true;
try {
  let up = false;
  for (let i = 0; i < 100 && !up; i++) {
    up = await fetch(base).then((r) => r.ok, () => false);
    if (!up) await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!up) throw new Error("le banc d'essai n'a pas démarré");
  const { chromium } = createRequire(import.meta.url)("playwright");
  browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 200)));
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 300)));
  // ?pas= : horloge simulée (les images ne sont dessinées que sur demande)
  await page.goto(base + "?pas=0.0333&nom=Essai", { waitUntil: "load" });
  await page.waitForFunction(() => window.__laboReady, null, { timeout: 60000 });
  const out = await page.evaluate(() => {
    const app = window.MoulinFete.app,
      labo = window.__labo,
      res = {};
    labo.step(2);
    for (const e of app.entries) {
      const s = e.def.station;
      const standable = labo.world.player.canStand(s.x, s.z);
      app.enter(e.def.id);
      for (let i = 0; i < 12; i++) labo.frame(0.0333, false);
      labo.step(1);
      e.session.requestStart();
      for (let i = 0; i < 200; i++) labo.frame(0.0333, false);
      res[e.def.id] = { stand: !!standable, phase: e.session.state ? e.session.state.phase : "?", appels: labo.world.renderer.info.render.calls };
      app.leave();
    }
    return res;
  });
  let bad = 0;
  for (const [id, r] of Object.entries(out)) {
    const good = r.stand && (r.phase === "run" || r.phase === "results");
    if (!good) bad++;
    console.log(`  ${good ? "✓" : "✗"} ${id} : stand ${r.stand ? "praticable" : "HORS SOL PRATICABLE"}, partie « ${r.phase} », ${r.appels} appels de dessin`);
  }
  // les lieux : on s'assoit à une place de chaque sorte, puis on tire le feu d'artifice
  const places = await page.evaluate(() => {
    const app = window.MoulinFete.app, labo = window.__labo, count = {}, sat = {};
    for (const p of app.places.list) {
      const kind = p.id.replace(/-?\d+$/, "");
      count[kind] = (count[kind] || 0) + 1;
    }
    for (const id of ["seat-0", "sofa-1", "armchair-0", "table-2", "fire-3", "hammock-1"]) {
      app.places.run(id);
      for (let i = 0; i < 6; i++) labo.frame(0.0333, false);
      sat[id] = !!app.seated() && app.seated().id === id;
      app.stand();
    }
    app.places.run("ship-it");
    for (let i = 0; i < 40; i++) labo.frame(0.0333, false);
    const show = labo.world.scene.getObjectByName("Feu_d_artifice");
    return { count, sat, fireworks: !!show && show.visible };
  });
  const want = { seat: 66, sofa: 3, armchair: 2, table: 4, fire: 8, hammock: 3, balloon: 1, "ship-it": 1, "ferris-wheel": 1, carousel: 1 };
  const missing = Object.keys(want).filter((k) => places.count[k] !== want[k]);
  const unsat = Object.keys(places.sat).filter((k) => !places.sat[k]);
  const placesOk = !missing.length && !unsat.length && places.fireworks;
  console.log(`  ${placesOk ? "✓" : "✗"} lieux : ${Object.values(places.count).reduce((a, b) => a + b, 0)} places et manèges` + (missing.length ? `, compte inattendu pour ${missing.join(", ")}` : "") + (unsat.length ? `, impossible de s'asseoir à ${unsat.join(", ")}` : "") + (places.fireworks ? ", feu d'artifice tiré" : ", feu d'artifice absent"));
  if (errors.length) console.log("  ✗ erreurs de la page : " + errors.slice(0, 5).join(" | "));
  failed = bad > 0 || errors.length > 0 || Object.keys(out).length < 27 || !placesOk;
  console.log(`\n${Object.keys(out).length} jeux essayés, ${failed ? "des problèmes" : "aucun problème"}`);
} catch (error) {
  console.log("  ✗ " + String(error.message || error));
} finally {
  if (browser) await browser.close();
  server.kill();
}
process.exit(failed ? 1 : 0);
