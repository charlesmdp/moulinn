// Charge la simulation du jeu (scripts classiques) dans un contexte Node, sans rendu.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export function loadSim() {
  const ctx = { console, Math, JSON, Date, Map, Set, Object, Array, Number, String, Symbol, Error, Infinity, NaN, isFinite, parseFloat, parseInt, setTimeout, clearTimeout };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  const files = [path.join(root, "src/jeu/core/00-ptmt.js"), ...fs.readdirSync(path.join(root, "src/jeu/sim")).filter((f) => f.endsWith(".js")).sort().map((f) => path.join(root, "src/jeu/sim", f))];
  for (const f of files) vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: path.relative(root, f) });
  return ctx.PTMT;
}
