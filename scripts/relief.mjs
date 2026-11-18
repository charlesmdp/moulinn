// Calcule le relief livré : compare le relief du plan aux altitudes de l'IGN.
//
//   node scripts/relief.mjs            calcule les écarts et écrit src/app/v32/66-relief-livre.js
//   node scripts/relief.mjs --sans     retire le relief livré (retour au relief du plan)
//
// Options : --calage=non (garder la position du plan sur la carte), --sigma=9 (lissage, en m),
// --borne=15 (écart maximal, en m).
//
// Entrées : scripts/donnees/relief-modele.json (node scripts/relief-modele.mjs) et
// scripts/donnees/relief-ign.json (node scripts/releve-ign.mjs). Ensuite : node scripts/build.mjs,
// puis node scripts/labo-relief.mjs pour le banc d'essai de la fête, et les essais.
//
// Ce qui ne bouge jamais : le moulin, la dépendance et leurs abords, les berges et les niveaux
// d'eau (voir « part » dans scripts/lib/relief.mjs et « keep » dans 67-relief-ign.js), ni les
// ouvrages aux niveaux fixés à la main — allée, cour, terrasse, escaliers, murets (« protection »).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GEO, calage, ecarts, fichierLivre } from "./lib/relief.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(root, "src", "app", "v32", "66-relief-livre.js");
const option = (name, fallback) => {
  const arg = process.argv.find((a) => a.startsWith("--" + name + "="));
  return arg ? arg.slice(name.length + 3) : fallback;
};
if (process.argv.includes("--sans")) {
  fs.writeFileSync(target, fichierLivre(null));
  console.log("Relief livré retiré : le relief du plan revient au prochain « node scripts/build.mjs ».");
  process.exit(0);
}
const read = (name, how) => {
  const file = path.join(root, "scripts", "donnees", name);
  if (!fs.existsSync(file)) {
    console.error("Il manque scripts/donnees/" + name + " : lancer d'abord « " + how + " ».");
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
};
const modele = read("relief-modele.json", "node scripts/relief-modele.mjs");
const ign = read("relief-ign.json", "node scripts/releve-ign.mjs");
const m = (v, n = 2) => (Number.isFinite(v) ? (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(n) : "?");

console.log(`Relevé IGN : ${ign.ressource}, ${ign.date} — ${ign.ne} × ${ign.nn} points tous les ${ign.pas} m.`);
let geo = { ...GEO, lon0: ign.lon0, lat0: ign.lat0 };
if (option("calage", "oui") !== "non") {
  const c = calage(modele, ign, geo);
  const net = c.score - c.typique;
  console.log(`Calage sur les étangs (${c.etangs.join(", ")}) : plan déplacé de ${m(c.tx - geo.tx, 1)} m vers l'est et ${m(c.ty - geo.ty, 1)} m vers le nord (note ${c.score.toFixed(2)} sur 2 ; avant ${c.initial.toFixed(2)} ; ailleurs ${c.typique.toFixed(2)}).`);
  if (c.score >= 1.0 && net >= 0.3) geo = { ...geo, tx: c.tx, ty: c.ty };
  else console.log("  Calage peu net (étangs non plats dans ce modèle de terrain ?) : la position du plan est gardée. Vérifier la carte des écarts avant de publier.");
}
const r = ecarts(modele, ign, geo, { sigma: Number(option("sigma", 9)), borne: Number(option("borne", 15)) });
console.log(`Surface du grand étang : ${r.zero.toFixed(2)} m NGF (zéro du plan).`);
console.log("Niveau des étangs par rapport au grand étang (réel / plan) :");
for (const n of r.niveaux) console.log(`  ${n.nom.padEnd(28)} ${m(n.reel)} m / ${m(n.plan)} m   écart ${m(n.decalage)} m   (${n.points} points)`);
if (r.allee.length) {
  console.log("Allée d'accès, de l'entrée vers la cour (réel / plan, au-dessus du grand étang) — ses niveaux sont fixés dans le plan (driveLevels) et ne sont pas modifiés :");
  console.log("  " + r.allee.map((a) => `${m(a.reel, 1)} / ${m(a.plan, 1)}`).join("   "));
}
const b = r.bilan;
console.log(`Relief hors de l'eau (${b.points} points) : écart moyen avec l'IGN ${b.ecartMoyenAvant.toFixed(2)} m (9 points sur 10 sous ${b.ecart90Avant.toFixed(1)} m, maximum ${b.ecartMaxAvant.toFixed(1)} m).`);
console.log(`Après recalage : écart moyen ${b.ecartMoyenApres.toFixed(2)} m (9 points sur 10 sous ${b.ecart90Apres.toFixed(1)} m) ; le sol bouge de ${b.deplacementMoyen.toFixed(2)} m en moyenne, ${b.deplacementMax.toFixed(1)} m au plus.`);
// Où le relief change le plus (carte grossière, un caractère pour 12 m : chiffres = mètres, minuscules = baisse).
const g = r.grille;
console.log("Carte des écarts livrés (nord en haut ; « . » moins de 0,5 m, chiffre = hausse en m, lettre = baisse : a = 1 m, b = 2 m…) :");
for (let j = 0; j < g.nz; j += 2) {
  let line = "  ";
  for (let i = 0; i < g.nx; i += 2) {
    const v = g.d[j * g.nx + i];
    line += Math.abs(v) < 0.5 ? "." : v > 0 ? String(Math.min(9, Math.round(v))) : String.fromCharCode(96 + Math.min(26, Math.round(-v)));
  }
  console.log(line);
}
const livre = { date: ign.date, source: "IGN (" + ign.ressource + "), Géoplateforme", zero: Math.round(r.zero * 100) / 100, geo: { theta: geo.theta, scale: geo.scale, tx: geo.tx, ty: geo.ty, lon0: geo.lon0, lat0: geo.lat0 }, niveaux: r.niveaux.map((n) => ({ nom: n.nom, reel: Number.isFinite(n.reel) ? Math.round(n.reel * 100) / 100 : null })), ...g };
fs.writeFileSync(target, fichierLivre(livre));
console.log("Écrit : src/app/v32/66-relief-livre.js. Ensuite : node scripts/build.mjs, node scripts/labo-relief.mjs, puis les essais (README, « Relief réel »).");
