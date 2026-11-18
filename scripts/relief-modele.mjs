// Relève le relief du plan, tel qu'il est avant tout recalage sur l'IGN.
//
//   node scripts/build.mjs && node scripts/relief-modele.mjs
//
// Ouvre la page du moulin (site construit, recalage désactivé) et écrit
// scripts/donnees/relief-modele.json : la hauteur du relief sur une grille de 3 m (zéro : surface
// du grand étang), la distance à l'eau de chaque point, les étangs avec leur niveau, les îles, les
// cours d'eau, les bâtiments et les ouvrages dont les niveaux sont fixés à la main (allée, cour,
// terrasse, escaliers, murets…). scripts/relief.mjs compare ce relief aux altitudes de l'IGN.
// À relancer si le relief du plan, les étangs ou les cours d'eau changent.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openMoulin } from "./lib/page.mjs";

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), "donnees", "relief-modele.json");
const { page, errors, close } = await openMoulin({ route: "moulin", init: "window.MOULIN_RELIEF_ORIGINE = true;" });
try {
  const data = await page.evaluate(() => {
    const context = window.MoulinV32.context,
      game = context.game;
    const r2 = (v) => Math.round(v * 100) / 100;
    // Emprise du relief : celle du maillage du terrain.
    const values = game.terrainData.values;
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (let i = 0; i < values.length; i += 3) {
      x0 = Math.min(x0, values[i]);
      x1 = Math.max(x1, values[i]);
      z0 = Math.min(z0, values[i + 2]);
      z1 = Math.max(z1, values[i + 2]);
    }
    const pas = 3;
    const bounds = { x0: Math.ceil(x0), x1: Math.floor(x1), z0: Math.ceil(z0), z1: Math.floor(z1) };
    const nx = Math.floor((bounds.x1 - bounds.x0) / pas) + 1,
      nz = Math.floor((bounds.z1 - bounds.z0) / pas) + 1;
    const etangs = (game.waterRegions || []).filter((q) => q.poly && q.poly.length > 2).map((q) => ({ nom: q.name, niveau: r2(q.level || 0), contour: q.poly.map((p) => [r2(p[0]), r2(p[1])]) }));
    const iles = (context.hooks.islands || []).map((poly) => poly.map((p) => [r2(p[0]), r2(p[1])]));
    const canaux = (game.channels || []).map((c) => ({ nom: c.name, largeur: r2(c.maxWidth || c.width || 1.5), trace: (c.line || []).map((p) => [r2(p[0]), r2(p[1])]) }));
    const batiments = ((game.player && game.player.physicalBuildings) || []).map((b) => ({ nom: b.name, cx: r2(b.cx), cz: r2(b.cz), angle: r2(b.angle), u0: r2(b.u0), u1: r2(b.u1), v0: r2(b.v0), v1: r2(b.v1) }));
    // Ouvrages aux niveaux fixés à la main dans le plan : ils ne suivent pas le sol, le recalage
    // les contourne. On relève leurs tracés (suites de points [x, z]).
    const layout = game.siteLayout || {};
    const ouvrages = [];
    const collect = (nom, value, key) => {
      if (!value || typeof value !== "object" || key === "direction") return;
      if (Array.isArray(value)) {
        const pair = (v) => Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === "number");
        if (pair(value)) ouvrages.push({ nom, points: [[r2(value[0]), r2(value[1])]] });
        else if (value.length && value.every(pair)) ouvrages.push({ nom, points: value.map((v) => [r2(v[0]), r2(v[1])]) });
        else for (const v of value) collect(nom, v, key);
      } else for (const k of Object.keys(value)) collect(nom, value[k], k);
    };
    for (const nom of ["drive", "forecourt", "upperTerrace", "upperTerraceParts", "stairs", "hillRoutes", "hillWalls", "seat", "rearWall", "rearBed", "rockFace", "camellia", "fountain", "cars"]) collect(nom, layout[nom], nom);
    const allee = Array.isArray(layout.drive) && Array.isArray(layout.driveLevels) ? { points: layout.drive.map((p) => [r2(p[0]), r2(p[1])]), niveaux: layout.driveLevels.map(r2) } : null;
    const inside = (x, z, poly) => {
      let res = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, zi] = poly[i], [xj, zj] = poly[j];
        if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi || 1e-9) + xi) res = !res;
      }
      return res;
    };
    const segment = (x, z, a, b) => {
      const dx = b[0] - a[0], dz = b[1] - a[1];
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1e-9)));
      return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz);
    };
    // Distance à l'eau (étangs et cours d'eau), bornée à 30 m ; 0 dans l'eau.
    const water = (x, z) => {
      let d = 30;
      for (const e of etangs) {
        if (inside(x, z, e.contour)) return 0;
        for (let i = 0, j = e.contour.length - 1; i < e.contour.length && d > 0; j = i++) d = Math.min(d, segment(x, z, e.contour[j], e.contour[i]));
      }
      for (const c of canaux) for (let i = 1; i < c.trace.length; i++) d = Math.min(d, Math.max(0, segment(x, z, c.trace[i - 1], c.trace[i]) - c.largeur / 2));
      return d;
    };
    const h = [], eau = [];
    for (let j = 0; j < nz; j++)
      for (let i = 0; i < nx; i++) {
        const x = bounds.x0 + i * pas, z = bounds.z0 + j * pas;
        h.push(Math.round(game.terrainHeight(x, z) * 100));
        eau.push(Math.round(water(x, z) * 10));
      }
    return {
      note: "Relief du plan avant recalage IGN. h : hauteur en cm (zéro = surface du grand étang), ligne par ligne du nord au sud, x croissant ; eau : distance à l'eau en dm (bornée à 30 m). Repère : x vers l'est, z vers le sud, en unités du plan.",
      emprise: bounds,
      pas,
      nx,
      nz,
      h,
      eau,
      etangs,
      iles,
      canaux,
      batiments,
      ouvrages,
      allee,
    };
  });
  if (errors.length) console.log("Erreurs de la page :", errors.slice(0, 3).join(" | "));
  fs.writeFileSync(out, JSON.stringify(data));
  const hs = data.h.map((v) => v / 100);
  console.log(`Écrit : scripts/donnees/relief-modele.json — ${data.nx} × ${data.nz} points tous les ${data.pas} m, emprise x ${data.emprise.x0}…${data.emprise.x1}, z ${data.emprise.z0}…${data.emprise.z1}, hauteurs de ${Math.min(...hs).toFixed(1)} à ${Math.max(...hs).toFixed(1)} m ; ${data.etangs.length} étangs (${data.etangs.map((e) => e.nom + " " + e.niveau).join(", ")}) ; ${data.ouvrages.length} tracés d'ouvrages.`);
} finally {
  await close();
}
