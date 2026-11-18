// Essais du calcul du relief réel (scripts/lib/relief.mjs), sans internet : on fabrique un faux
// relevé IGN à partir du relief du plan (position décalée, collines ajoutées, étangs de l'est plus
// bas) et on vérifie que le calage et les écarts retrouvés sont les bons.
//
//   node tests/relief.test.mjs
import fs from "node:fs";
import { GEO, altitude, calage, dansPolygone, ecarts, fichierLivre, hauteurPlan, part, protection, versCarte, versPlan } from "../scripts/lib/relief.mjs";

const modele = JSON.parse(fs.readFileSync(new URL("../scripts/donnees/relief-modele.json", import.meta.url), "utf8"));
let passed = 0,
  failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log("  ✓ " + name);
  } catch (error) {
    failed++;
    console.log("  ✗ " + name + "\n      " + String(error.message || error));
  }
}
const ok = (condition, message) => {
  if (!condition) throw new Error(message);
};

const ZERO = 61.3;
const vraiGeo = { ...GEO, tx: GEO.tx + 6, ty: GEO.ty - 4 };
const bosse = (x, z) => 4 * Math.exp(-((x + 150) ** 2 + (z - 20) ** 2) / (2 * 40 ** 2)) - 3 * Math.exp(-((x - 100) ** 2 + (z - 120) ** 2) / (2 * 50 ** 2));
const centre = (poly) => [poly.reduce((a, p) => a + p[0], 0) / poly.length, poly.reduce((a, p) => a + p[1], 0) / poly.length];
/** Faux relevé : altitude « réelle » sur la grille géographique du vrai relevé. */
function fauxReleve(chute) {
  const vrai = (x, z) => {
    if (!modele.iles.some((ile) => dansPolygone(x, z, ile)))
      for (const e of modele.etangs) if (dansPolygone(x, z, e.contour)) return e.niveau + chute(...centre(e.contour));
    return hauteurPlan(modele, x, z) + bosse(x, z) + chute(x, z);
  };
  const ign = { lon0: GEO.lon0, lat0: GEO.lat0, e0: -304, n0: -240, pas: 4, ne: 132, nn: 93, z: [] };
  let seed = 7;
  const bruit = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 0.08;
  for (let j = 0; j < ign.nn; j++)
    for (let i = 0; i < ign.ne; i++) {
      const [x, z] = versPlan(vraiGeo, ign.e0 + i * ign.pas, ign.n0 + j * ign.pas);
      ign.z.push(Math.round((ZERO + vraiGeo.scale * vrai(x, z) + bruit()) * 100) / 100);
    }
  return ign;
}

console.log("Relief réel");
test("plan ↔ carte : aller et retour", () => {
  const [e, n] = versCarte(vraiGeo, -120, 85);
  const [x, z] = versPlan(vraiGeo, e, n);
  ok(Math.abs(x + 120) < 1e-9 && Math.abs(z - 85) < 1e-9, "retour : " + x + ", " + z);
  ok(Math.abs(versCarte(GEO, 100, 0)[0] - GEO.tx - 102.6) < 0.01, "échelle");
  ok(versCarte(GEO, 0, 100)[1] < GEO.ty - 100, "z vers le sud");
});
test("rien ne bouge autour du moulin, de la dépendance ni au bord de l'eau", () => {
  ok(part(0, 0, 30) === 0 && part(10, -20, 30) === 0, "moulin");
  ok(part(-30, 6, 30) === 0 && part(-19, 18, 30) === 0, "dépendance");
  ok(part(-200, 100, 3) === 0 && part(-200, 100, 30) === 1, "berge / pleine terre");
  ok(part(0, -80, 30) === 1, "entrée du domaine");
});
const sansChute = fauxReleve(() => 0);
let trouve = null;
test("calage : la position décalée de (6 ; −4) m est retrouvée sur les étangs", () => {
  trouve = calage(modele, sansChute, GEO);
  ok(Math.abs(trouve.tx - vraiGeo.tx) <= 1.5 && Math.abs(trouve.ty - vraiGeo.ty) <= 1.5, "trouvé " + trouve.tx + ", " + trouve.ty + " pour " + vraiGeo.tx + ", " + vraiGeo.ty);
  ok(trouve.score > trouve.initial + 0.2 && trouve.score > trouve.typique + 0.4, "score " + trouve.score.toFixed(2) + " (départ " + trouve.initial.toFixed(2) + ", typique " + trouve.typique.toFixed(2) + ")");
});
test("écarts : les collines ajoutées sont retrouvées, le zéro est celui du grand étang", () => {
  const geo = { ...GEO, tx: trouve.tx, ty: trouve.ty };
  const r = ecarts(modele, sansChute, geo);
  ok(Math.abs(r.zero - ZERO) < 0.1, "zéro " + r.zero);
  const g = r.grille;
  let n = 0, somme = 0, pire = 0, loin = 0;
  for (let j = 0; j < g.nz; j++)
    for (let i = 0; i < g.nx; i++) {
      const x = g.x0 + i * g.pas, z = g.z0 + j * g.pas;
      const k = Math.round((z - modele.emprise.z0) / modele.pas) * modele.nx + Math.round((x - modele.emprise.x0) / modele.pas);
      if (modele.eau[k] / 10 < 20) continue;
      const e = Math.abs(g.d[j * g.nx + i] - bosse(x, z));
      n++;
      somme += e;
      pire = Math.max(pire, e);
      if (e > 0.6) loin++;
    }
  ok(n > 1500, "points comparés : " + n);
  ok(somme / n < 0.25 && loin / n < 0.05, "erreur moyenne " + (somme / n).toFixed(2) + " m, " + ((100 * loin) / n).toFixed(1) + " % au-delà de 0,6 m, pire " + pire.toFixed(2) + " m");
  ok(r.bilan.ecartMoyenApres < r.bilan.ecartMoyenAvant * 0.6, "bilan : " + r.bilan.ecartMoyenAvant.toFixed(2) + " → " + r.bilan.ecartMoyenApres.toFixed(2));
});
test("ouvrages aux niveaux fixés (allée, escaliers, fauteuil) : le recalage les contourne", () => {
  const geo = { ...GEO, tx: vraiGeo.tx, ty: vraiGeo.ty };
  const r0 = ecarts(modele, sansChute, geo);
  ok(modele.ouvrages.length > 8 && modele.allee.points.length === modele.allee.niveaux.length, "ouvrages relevés : " + modele.ouvrages.length);
  const garde = protection(modele);
  for (const [x, z] of [...modele.allee.points, [-34.8, -10.3], [-29.5, -30.5]]) ok(garde(x, z) === 0 && garde(x + 4, z) === 0, "protégé en " + x + ", " + z);
  ok(garde(-150, 20) === 1 && garde(40, -80) === 1, "pleine campagne");
  const g = r0.grille;
  let pire = 0;
  for (let j = 0; j < g.nz; j++)
    for (let i = 0; i < g.nx; i++) {
      const x = g.x0 + i * g.pas, z = g.z0 + j * g.pas;
      if (garde(x, z) === 0) pire = Math.max(pire, Math.abs(g.d[j * g.nx + i]));
    }
  ok(pire === 0, "écart livré sur les ouvrages : " + pire);
  ok(r0.allee.length === 7 && r0.allee.every((a) => Number.isFinite(a.reel)), "profil de l'allée");
});
test("étangs de l'est plus bas en vrai : niveaux mesurés, aucun étang perché", () => {
  const chute = (x) => -1.5 / (1 + Math.exp(-(x - 36) / 2));
  const releve = fauxReleve(chute);
  const c = calage(modele, releve, GEO);
  ok(Math.abs(c.tx - vraiGeo.tx) <= 1.5 && Math.abs(c.ty - vraiGeo.ty) <= 1.5, "calage " + c.tx + ", " + c.ty);
  const r = ecarts(modele, releve, { ...GEO, tx: c.tx, ty: c.ty });
  const niveau = (nom) => r.niveaux.find((n) => n.nom.startsWith(nom));
  ok(Math.abs(niveau("Grand").decalage) < 0.05, "grand étang " + niveau("Grand").decalage);
  ok(Math.abs(niveau("Étang inter").decalage + 1.5) < 0.2, "étang intermédiaire " + niveau("Étang inter").decalage);
  ok(Math.abs(niveau("Petit étang").decalage + 1.5) < 0.2, "petit étang " + niveau("Petit étang").decalage);
  // autour de l'étang intermédiaire (6 à 14 m du bord), le terrain livré reste à la hauteur de l'étang du plan
  const inter = modele.etangs.find((e) => e.nom.startsWith("Étang inter"));
  const g = r.grille;
  // (sans cette précaution, le terrain y serait abaissé de 1,5 m et l'étang resterait perché)
  let n = 0, pire = 0, somme = 0;
  for (let j = 0; j < g.nz; j++)
    for (let i = 0; i < g.nx; i++) {
      const x = g.x0 + i * g.pas, z = g.z0 + j * g.pas;
      if (dansPolygone(x, z, inter.contour)) continue;
      let d = Infinity;
      for (const p of inter.contour) d = Math.min(d, Math.hypot(x - p[0], z - p[1]));
      if (d < 6 || d > 14) continue;
      const e = Math.abs(g.d[j * g.nx + i] - bosse(x, z));
      n++;
      somme += e;
      pire = Math.max(pire, e);
    }
  ok(n > 20 && somme / n < 0.35 && pire < 0.9, n + " points, écart livré moyen " + (somme / n).toFixed(2) + " m, jusqu'à " + pire.toFixed(2) + " m autour de l'étang");
});
test("fichier livré : vide sans relevé, lisible avec", () => {
  ok(/reliefLivre = null/.test(fichierLivre(null)), "vide");
  const text = fichierLivre({ date: "2026-01-01", source: "essai", zero: 61.3, geo: GEO, x0: 0, z0: 0, pas: 6, nx: 2, nz: 2, d: [0, 1, 2, 3] });
  const box = { MoulinV32: {} };
  new Function("globalThis", text)(box);
  ok(box.MoulinV32.reliefLivre.d.length === 4 && box.MoulinV32.reliefLivre.pas === 6, "contenu");
  ok(Number.isNaN(altitude({ e0: 0, n0: 0, pas: 4, ne: 2, nn: 2, z: [1, null, 1, 1] }, 1, 1)), "donnée manquante");
});
console.log(`\n${passed} réussis, ${failed} échoués`);
process.exit(failed ? 1 : 0);
