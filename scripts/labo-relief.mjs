// Met à jour le relief du banc d'essai de la fête d'après le site construit.
//
//   node scripts/build.mjs && node scripts/labo-relief.mjs
//
// Le banc d'essai (scripts/labo.mjs) et ses essais utilisent une copie allégée du terrain :
// src/moulin2/labo/site.json. Après un changement du relief (relief réel de l'IGN, retouche du
// plan), ce script relit les hauteurs sur la page du moulin et les y range ; étangs, bâtiments et
// arbres ne sont pas touchés. À faire suivre des essais des jeux (README, « Relief réel »).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openMoulin } from "./lib/page.mjs";

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "moulin2", "labo", "site.json");
const site = JSON.parse(fs.readFileSync(file, "utf8"));
const grid = site.grid;
const before = new Int16Array(new Uint8Array(Buffer.from(grid.h, "base64")).buffer);
const { page, errors, close } = await openMoulin({ route: "moulin" });
try {
  const heights = await page.evaluate(({ x0, z0, step, nx, nz }) => {
    const game = window.MoulinV32.context.game;
    const out = new Array(nx * nz);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) out[j * nx + i] = Math.round(game.terrainHeight(x0 + i * step, z0 + j * step) * 100);
    return out;
  }, grid);
  if (errors.length) console.log("Erreurs de la page :", errors.slice(0, 3).join(" | "));
  const after = new Int16Array(before.length);
  let changed = 0, max = 0, near = 0;
  for (let k = 0; k < before.length; k++) {
    after[k] = Number.isFinite(heights[k]) ? Math.max(-32000, Math.min(32000, heights[k])) : before[k];
    const d = Math.abs(after[k] - before[k]) / 100;
    if (d > 0.02) changed++;
    max = Math.max(max, d);
    const x = grid.x0 + (k % grid.nx) * grid.step, z = grid.z0 + Math.floor(k / grid.nx) * grid.step;
    if (Math.hypot(x, z) < 25) near = Math.max(near, d);
  }
  grid.h = Buffer.from(after.buffer).toString("base64");
  fs.writeFileSync(file, JSON.stringify(site));
  console.log(`Banc d'essai mis à jour : ${changed} points sur ${before.length} ont changé (${max.toFixed(2)} m au plus ; autour du moulin : ${near.toFixed(2)} m).`);
} finally {
  await close();
}
