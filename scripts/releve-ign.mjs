// Relève l'altitude réelle du domaine auprès de l'IGN (service altimétrique de la Géoplateforme).
//
//   node scripts/releve-ign.mjs
//
// Écrit scripts/donnees/relief-ign.json : l'altitude NGF sur une grille de 4 m couvrant le domaine
// et ses abords (environ 520 m × 370 m autour du moulin, soit 12 000 points en une soixantaine de
// requêtes). Le modèle de terrain le plus précis disponible est utilisé : LiDAR HD s'il couvre la
// commune, sinon RGE ALTI. Il faut que data.geopf.fr soit joignable (ordinateur personnel, ou
// environnement Claude qui autorise cet hôte). Ensuite : node scripts/relief.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GEO, metresParDegre } from "./lib/relief.mjs";

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), "donnees", "relief-ign.json");
const API = "https://data.geopf.fr/altimetrie/1.0";
// Emprise en mètres à l'est et au nord du point de référence (GEO.lon0, GEO.lat0) : le relief du
// plan, plus 30 m de marge pour affiner le calage.
const BOX = { e0: -304, e1: 220, n0: -240, n1: 128, pas: 4 };
const { kx, ky } = metresParDegre(GEO.lat0);

function get(url, params = {}) {
  // curl : il suit le mandataire et les certificats de l'environnement (le fetch de Node ne le fait pas)
  const args = ["-sS", "-m", "60", "--retry", "2", "--get", url];
  for (const [key, value] of Object.entries(params)) args.push("--data-urlencode", key + "=" + value);
  return JSON.parse(execFileSync("curl", args, { encoding: "utf8", maxBuffer: 1 << 26 }));
}
const pause = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
/** Altitudes d'une liste de points [lon, lat], dans l'ordre ; un lot qui échoue est redemandé par moitiés. */
function elevations(resource, points, progress) {
  const ask = (chunk) => {
    try {
      const data = get(API + "/calcul/alti/rest/elevation.json", { lon: chunk.map((p) => p[0].toFixed(6)).join("|"), lat: chunk.map((p) => p[1].toFixed(6)).join("|"), resource, delimiter: "|", zonly: "true" });
      const list = data.elevations || [];
      if (list.length !== chunk.length) throw new Error(list.length + " altitudes pour " + chunk.length + " points");
      return list.map((v) => (typeof v === "number" ? v : Number(v.z)));
    } catch (error) {
      if (chunk.length <= 10) throw error;
      pause(500);
      const half = chunk.length >> 1;
      return [...ask(chunk.slice(0, half)), ...ask(chunk.slice(half))];
    }
  };
  const values = [];
  for (let i = 0; i < points.length; i += 150) {
    values.push(...ask(points.slice(i, i + 150)));
    if (progress) process.stdout.write("\r" + resource + " : " + Math.min(points.length, i + 150) + " / " + points.length);
    pause(120);
  }
  if (progress) process.stdout.write("\n");
  return values;
}
const valid = (v) => Number.isFinite(v) && v > -500 && v < 5000;

const ne = Math.round((BOX.e1 - BOX.e0) / BOX.pas) + 1,
  nn = Math.round((BOX.n1 - BOX.n0) / BOX.pas) + 1;
const points = [];
for (let j = 0; j < nn; j++) for (let i = 0; i < ne; i++) points.push([GEO.lon0 + (BOX.e0 + i * BOX.pas) / kx, GEO.lat0 + (BOX.n0 + j * BOX.pas) / ky]);

// Ressources proposées par le service ; on préfère un modèle de terrain LiDAR HD, puis le RGE ALTI.
let names = [];
try {
  const list = get(API + "/resources");
  names = (list.resources || list || []).map((r) => r._id || r.id || r.name || r).filter((n) => typeof n === "string");
} catch (error) {
  console.log("Liste des ressources indisponible (" + String(error.message).slice(0, 80) + ") : on essaie les noms connus.");
}
const wanted = [...names.filter((n) => /lidar/i.test(n) && /mnt/i.test(n)), "ign_lidar_hd_mnt_wld", "ign_rge_alti_wld"].filter((n, i, a) => a.indexOf(n) === i);
const centre = [points[(nn >> 1) * ne + (ne >> 1)], points[(nn >> 2) * ne + (ne >> 2)], points[3 * (nn >> 2) * ne + 3 * (ne >> 2)]];
let result = null;
for (const resource of wanted) {
  try {
    const test = elevations(resource, centre, false);
    if (!test.every(valid)) {
      console.log(resource + " : pas de donnée ici (" + test.join(", ") + ")");
      continue;
    }
    const z = elevations(resource, points, true).map((v) => (valid(v) ? Math.round(v * 100) / 100 : null));
    const known = z.filter((v) => v !== null);
    console.log(resource + " : " + known.length + " / " + z.length + " points, de " + Math.min(...known) + " à " + Math.max(...known) + " m NGF");
    if (known.length < z.length * 0.9) continue;
    result = { date: new Date().toISOString().slice(0, 10), source: "IGN, Géoplateforme, service altimétrique", ressource: resource, lon0: GEO.lon0, lat0: GEO.lat0, kx, ky, e0: BOX.e0, n0: BOX.n0, pas: BOX.pas, ne, nn, z };
    break;
  } catch (error) {
    console.log(resource + " : échec (" + String(error.message).slice(0, 160) + ")");
  }
}
if (!result) {
  console.error("Aucune altitude obtenue : le service IGN (data.geopf.fr) est-il joignable d'ici ?");
  process.exit(1);
}
fs.writeFileSync(out, JSON.stringify(result));
console.log("Écrit : scripts/donnees/relief-ign.json (" + result.ressource + "). Ensuite : node scripts/relief.mjs");
