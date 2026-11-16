// Relève l'altitude réelle du domaine auprès de l'IGN (service altimétrique de la Géoplateforme).
//
//   node scripts/releve-ign.mjs
//
// Lit scripts/donnees/relief-points.json (grille de 12 m sur le domaine, préparée depuis la page du
// moulin) et écrit scripts/donnees/relief-ign.json : l'altitude NGF de chaque point, dans le même
// ordre, plus celle des points de référence du grand étang. Le modèle le plus précis disponible est
// utilisé (LiDAR HD s'il couvre la commune, sinon RGE ALTI). Il faut que data.geopf.fr soit joignable.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "donnees");
const input = JSON.parse(fs.readFileSync(path.join(dir, "relief-points.json"), "utf8"));
const API = "https://data.geopf.fr/altimetrie/1.0";

function get(url, params = {}) {
  // curl : il suit le mandataire et les certificats de l'environnement (le fetch de Node ne le fait pas)
  const args = ["-sS", "-m", "60", "--retry", "2", "--get", url];
  for (const [key, value] of Object.entries(params)) args.push("--data-urlencode", key + "=" + value);
  return JSON.parse(execFileSync("curl", args, { encoding: "utf8", maxBuffer: 1 << 26 }));
}
function elevations(resource, points) {
  const out = [];
  for (let i = 0; i < points.length; i += 100) {
    const chunk = points.slice(i, i + 100);
    const data = get(API + "/calcul/alti/rest/elevation.json", { lon: chunk.map((p) => p[2]).join("|"), lat: chunk.map((p) => p[3]).join("|"), resource, delimiter: "|", zonly: "true" });
    const list = data.elevations || [];
    if (list.length !== chunk.length) throw new Error(resource + " : " + list.length + " altitudes pour " + chunk.length + " points");
    for (const v of list) out.push(typeof v === "number" ? v : Number(v.z));
    process.stdout.write("\r" + resource + " : " + Math.min(points.length, i + 100) + " / " + points.length);
  }
  process.stdout.write("\n");
  return out;
}
const valid = (v) => Number.isFinite(v) && v > -500 && v < 5000;

// Ressources proposées par le service ; on préfère un modèle de terrain LiDAR HD, puis le RGE ALTI.
let names = [];
try {
  const list = get(API + "/resources");
  names = (list.resources || list || []).map((r) => r._id || r.id || r.name || r).filter((n) => typeof n === "string");
} catch (error) {
  console.log("Liste des ressources indisponible (" + String(error.message).slice(0, 80) + ") : on essaie les noms connus.");
}
const wanted = [...names.filter((n) => /lidar/i.test(n) && /mnt/i.test(n)), "ign_lidar_hd_mnt_wld", "ign_rge_alti_wld"].filter((n, i, a) => a.indexOf(n) === i);
const result = { date: new Date().toISOString().slice(0, 10), source: "IGN, Géoplateforme, service altimétrique", ressources: names.filter((n) => /alti|lidar|mnt/i.test(n)).slice(0, 40), mesures: {} };
const all = [...input.etang, ...input.points];
for (const resource of wanted) {
  try {
    const test = elevations(resource, input.etang.slice(0, 3));
    if (!test.every(valid)) {
      console.log(resource + " : pas de donnée ici (" + test.join(", ") + ")");
      continue;
    }
    const values = elevations(resource, all).map((v) => (valid(v) ? Math.round(v * 100) / 100 : null));
    result.mesures[resource] = { etang: values.slice(0, input.etang.length), points: values.slice(input.etang.length) };
    const ok = values.filter((v) => v !== null);
    console.log(resource + " : " + ok.length + " / " + values.length + " points, de " + Math.min(...ok) + " à " + Math.max(...ok) + " m NGF");
  } catch (error) {
    console.log(resource + " : échec (" + String(error.message).slice(0, 160) + ")");
  }
}
if (!Object.keys(result.mesures).length) {
  console.error("Aucune altitude obtenue : le service IGN (data.geopf.fr) est-il joignable ?");
  process.exit(1);
}
result.ressource = Object.keys(result.mesures)[0];
fs.writeFileSync(path.join(dir, "relief-ign.json"), JSON.stringify(result));
console.log("Écrit : scripts/donnees/relief-ign.json (ressource retenue : " + result.ressource + ")");
