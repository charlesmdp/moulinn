// Petit serveur statique pour essayer dist/ en local (ordinateur ou téléphone du même Wi-Fi).
// Usage : npm run serve  (port 8080 par défaut, ou PORT=9000 npm run serve)

import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");
const port = Number(process.env.PORT) || 8080;
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webp": "image/webp",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg",
  ".gz": "application/octet-stream",
  ".txt": "text/plain; charset=utf-8",
};

http
  .createServer((request, response) => {
    const url = new URL(request.url, "http://localhost");
    let file = path.normalize(path.join(root, decodeURIComponent(url.pathname)));
    if (!file.startsWith(root)) return response.writeHead(403).end();
    if (url.pathname.endsWith("/")) file = path.join(file, "index.html");
    fs.stat(file, (error, stat) => {
      // Comme Cloudflare Pages : /jeu redirige vers /jeu/.
      if (!error && stat.isDirectory()) return response.writeHead(308, { Location: url.pathname + "/" }).end();
      if (error || !stat.isFile()) return response.writeHead(404).end("Introuvable");
      response.writeHead(200, {
        "Content-Type": types[path.extname(file)] || "application/octet-stream",
        "Content-Length": stat.size,
        "Cache-Control": "no-cache",
      });
      fs.createReadStream(file).pipe(response);
    });
  })
  .listen(port, () => {
    console.log(`Moulin servi sur http://localhost:${port}`);
    for (const addresses of Object.values(os.networkInterfaces()))
      for (const address of addresses || [])
        if (address.family === "IPv4" && !address.internal) console.log(`Sur le réseau : http://${address.address}:${port}`);
  });
