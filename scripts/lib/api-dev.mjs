// /api/scores pour les serveurs locaux (scripts/serve.mjs, scripts/labo.mjs) : la vraie fonction du
// site (functions/api/scores.js), avec un faux espace de stockage gardé dans .build/scores-dev.json.
// SANS_SCORES=1 imite un site où le stockage n'est pas branché (la fonction répond 501).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { onRequestGet, onRequestPost } from "../../functions/api/scores.js";

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", ".build", "scores-dev.json");
const SCORES = {
  async get(key, type) {
    try {
      const all = JSON.parse(fs.readFileSync(file, "utf8"));
      return key in all ? (type === "json" ? JSON.parse(all[key]) : all[key]) : null;
    } catch (error) {
      return null;
    }
  },
  async put(key, value) {
    let all = {};
    try {
      all = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (error) {}
    all[key] = String(value);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(all));
  },
};

/** Répond à la requête si elle vise /api/scores ; renvoie vrai dans ce cas. */
export function api(request, response) {
  const url = new URL(request.url, "http://localhost");
  if (url.pathname !== "/api/scores") return false;
  const env = process.env.SANS_SCORES ? {} : { SCORES };
  const chunks = [];
  request.on("data", (c) => chunks.push(c));
  request.on("end", async () => {
    try {
      const body = Buffer.concat(chunks).toString("utf8");
      const res = request.method === "POST" ? await onRequestPost({ request: { text: async () => body }, env }) : await onRequestGet({ env });
      response.writeHead(res.status, Object.fromEntries(res.headers)).end(await res.text());
    } catch (error) {
      response.writeHead(500).end(String(error));
    }
  });
  return true;
}
