// Terrain d'essai de la Fête du Moulin : sert les jeux de /moulin2 dans un décor simplifié, sans
// reconstruire le site (les fichiers de src/moulin2 sont lus tels quels à chaque rechargement).
//
//   node scripts/labo.mjs            → http://localhost:8090/        (PORT=… pour changer)
//   http://localhost:8090/?jeu=rc    → entre directement dans un jeu ; ouvrir deux onglets pour jouer à deux
//   http://localhost:8090/?jeux=rc,golf → ne charge que ces jeux
//
// Avec RELAIS=8091, démarre aussi un petit relais local (protocole Nostr) pour essayer la connexion
// directe entre navigateurs sans dépendre des relais publics : ajouter ?relais=ws://localhost:8091
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PORT) || 8090;
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".woff2": "font/woff2", ".png": "image/png", ".webp": "image/webp" };
const fete = path.join(root, "src", "moulin2");
const list = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".js")).sort() : []);

function page(only) {
  const order = (f) => parseInt(f, 10) || 0;
  const base = list(fete).filter((f) => order(f) < 60 && f !== "00-pre.js");
  // ?jeux=rc,golf : ne charger que ces jeux (pratique quand un autre jeu est en chantier)
  const games = list(path.join(fete, "games")).filter((f) => !only || only.includes(f.replace(/\.js$/, "")));
  const engine = fs.readdirSync(path.join(root, "src", "static", "assets")).filter((f) => /^engine-\d\./.test(f)).sort();
  const scripts = [...engine.map((f) => "/src/static/assets/" + f), ...base.map((f) => "/src/moulin2/" + f), ...games.map((f) => "/src/moulin2/games/" + f), "/src/moulin2/labo/world.js"];
  const p2p = fs.existsSync(path.join(root, "dist", "assets")) ? fs.readdirSync(path.join(root, "dist", "assets")).find((f) => /^p2p\..*\.js$/.test(f)) : null;
  return `<!doctype html>
<html lang="fr" data-route="labo">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex">
<title>Labo · La Fête du Moulin</title>
<link rel="stylesheet" href="/labo.css">
<style>html,body{margin:0;height:100%;overflow:hidden;background:#8fd3ff}#labo{position:fixed;inset:0;overflow:hidden}#labo canvas{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none}</style>
</head>
<body>
<div id="labo"></div>
<script>globalThis.MoulinFete = { route: "labo", version: 1, assets: { p2p: ${JSON.stringify(p2p ? "/dist/assets/" + p2p : "")}, sponsors: "/src/static/moulin2/sponsors.json" } };</script>
${scripts.map((s) => `<script src="${s}"></script>`).join("\n")}
</body>
</html>`;
}

http
  .createServer((request, response) => {
    const url = new URL(request.url, "http://localhost");
    const send = (code, type, body) => response.writeHead(code, { "Content-Type": type, "Cache-Control": "no-store" }).end(body);
    if (url.pathname === "/") return send(200, types[".html"], page(url.searchParams.get("jeux") ? url.searchParams.get("jeux").split(",") : null));
    if (url.pathname === "/labo.css") {
      // la feuille de style de la fête, avec la police prise dans les sources
      return send(200, types[".css"], fs.readFileSync(path.join(fete, "arcade.css"), "utf8").replaceAll("{{asset:fete-font}}", "/src/jeu/fonts/lilita-one-latin.woff2"));
    }
    const file = path.normalize(path.join(root, decodeURIComponent(url.pathname)));
    if (!file.startsWith(root) || !/^\/(src|dist)\//.test(url.pathname)) return send(403, "text/plain", "Interdit");
    fs.readFile(file, (error, data) => (error ? send(404, "text/plain", "Introuvable") : send(200, types[path.extname(file)] || "application/octet-stream", data)));
  })
  .listen(port, () => console.log(`Labo de la fête : http://localhost:${port}/`));

// Relais local facultatif (suffisant pour la mise en relation de Trystero : il rediffuse à chaque
// abonné les événements dont les étiquettes « x » correspondent à ses filtres).
if (process.env.RELAIS) {
  const { WebSocketServer } = await import("ws");
  const wss = new WebSocketServer({ port: Number(process.env.RELAIS) });
  const subs = new Map(); // socket → Map(id d'abonnement → filtres)
  const match = (ev, f) => {
    if (f.kinds && !f.kinds.includes(ev.kind)) return false;
    if (f.since && ev.created_at < f.since) return false;
    for (const key of Object.keys(f)) {
      if (key[0] !== "#") continue;
      const tags = (ev.tags || []).filter((t) => t[0] === key.slice(1)).map((t) => t[1]);
      if (!f[key].some((v) => tags.includes(v))) return false;
    }
    return true;
  };
  wss.on("connection", (ws) => {
    subs.set(ws, new Map());
    ws.on("message", (data) => {
      let msg;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }
      if (msg[0] === "REQ") {
        subs.get(ws).set(msg[1], msg.slice(2));
        ws.send(JSON.stringify(["EOSE", msg[1]]));
      } else if (msg[0] === "CLOSE") subs.get(ws).delete(msg[1]);
      else if (msg[0] === "EVENT") {
        const ev = msg[1];
        ws.send(JSON.stringify(["OK", ev.id, true, ""]));
        for (const [sock, map] of subs) for (const [id, filters] of map) if (filters.some((f) => match(ev, f))) sock.send(JSON.stringify(["EVENT", id, ev]));
      }
    });
    ws.on("close", () => subs.delete(ws));
  });
  console.log(`Relais local : ws://localhost:${process.env.RELAIS}`);
}
