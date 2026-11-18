// Essais des sponsors : la fonction Cloudflare (functions/api/sponsors.js) avec un faux magasin KV.
// Rien n'est publié sans la clé du propriétaire ; un visiteur ne peut que déposer une demande.
//
//   node tests/sponsors.test.mjs
import { cleanAd, cleanTarget, onRequestGet, onRequestPost } from "../functions/api/sponsors.js";

let passed = 0,
  failed = 0;
async function test(name, fn) {
  try {
    await fn();
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
/** Faux KV, et un site dont la clé du propriétaire est « cle-du-moulin » (ou sans clé). */
function site(key = "cle-du-moulin") {
  const data = new Map();
  const env = { SCORES: { get: async (k, type) => (data.has(k) ? (type === "json" ? JSON.parse(data.get(k)) : data.get(k)) : null), put: async (k, v) => void data.set(k, v) } };
  if (key) env.ADS_KEY = key;
  const request = (body, headers = {}, query = "") => ({ url: "https://site.test/api/sponsors" + query, headers: { get: (name) => headers[name] || null }, text: async () => JSON.stringify(body) });
  const read = async (r) => ({ status: r.status, body: await r.json() });
  return {
    get: (headers, query) => onRequestGet({ env, request: request(null, headers, query) }).then(read),
    post: (body) => onRequestPost({ env, request: request(body) }).then(read),
  };
}
const ad = { name: "Acme Rockets", tagline: "Ship it to the moon", url: "https://acme.example", image: "data:image/png;base64,AAAA", bg: "#112233", fg: "#ffffff" };

await test("annonce nettoyée : balises retirées, lien http(s) seulement, image « data: » seulement", () => {
  const a = cleanAd({ name: "  <b>Acme</b>  ", tagline: "x".repeat(200), url: "javascript:alert(1)", image: "https://ailleurs.test/pixel.png", bg: "rouge" });
  ok(a.name === "bAcme/b", "nom : " + a.name);
  ok(a.tagline.length === 60, "slogan trop long gardé");
  ok(a.url === "" && a.image === "", "lien ou image douteux gardés");
  ok(a.bg === "#1d2b4f" && a.fg === "#ffffff", "couleurs par défaut");
  ok(cleanAd({ name: "   " }) === null, "annonce sans nom acceptée");
  ok(cleanAd({ name: "A", image: "data:image/svg+xml;base64,AAAA" }).image === "", "SVG accepté");
  ok(cleanTarget("fair") === "fair" && cleanTarget("../x") === "" && cleanTarget("RC") === "", "cibles");
});

await test("sans la clé, rien n'est publié ; avec elle, l'annonce paraît pour tous", async () => {
  const s = site();
  let r = await s.get();
  ok(r.body.ok && r.body.open && r.body.ads.fair === null, "état initial");
  r = await s.post({ action: "publish", target: "fair", ad, key: "devine" });
  ok(r.status === 403 && r.body.error === "bad-key", "publication sans la clé : " + r.status);
  r = await s.post({ action: "publish", target: "fair", ad });
  ok(r.status === 403, "publication sans clé du tout");
  r = await s.post({ action: "publish", target: "fair", ad, key: "cle-du-moulin" });
  ok(r.body.ok && r.body.ads.fair.name === "Acme Rockets", "publication du propriétaire");
  r = await s.post({ action: "publish", target: "rc", ad: Object.assign({}, ad, { name: "Turbo" }), key: "cle-du-moulin" });
  ok(r.body.ads.games.rc.name === "Turbo" && r.body.ads.fair.name === "Acme Rockets", "un sponsor par jeu");
  r = await s.post({ action: "publish", target: "fair", ad: null, key: "cle-du-moulin" });
  ok(r.body.ok && r.body.ads.fair === null && r.body.ads.games.rc, "retrait du sponsor principal");
  ok((await s.get()).body.ads.games.rc.name === "Turbo", "lecture publique");
});

await test("un visiteur dépose une demande ; le propriétaire la publie ou la refuse", async () => {
  const s = site();
  let r = await s.post({ action: "request", target: "top10", ad, contact: "moi sur X" });
  ok(r.body.ok && r.body.pending === 1, "demande déposée");
  ok((await s.get()).body.ads.top10 === null, "une demande ne publie rien");
  ok((await s.get({}, "?pending=1")).status === 403, "liste des demandes sans la clé");
  r = await s.get({ "x-ads-key": "cle-du-moulin" }, "?pending=1");
  ok(r.body.requests.length === 1 && r.body.requests[0].contact === "moi sur X", "liste du propriétaire");
  const id = r.body.requests[0].id;
  ok((await s.post({ action: "approve", id, key: "non" })).status === 403, "acceptation sans la clé");
  r = await s.post({ action: "approve", id, key: "cle-du-moulin" });
  ok(r.body.ok && r.body.ads.top10.name === "Acme Rockets" && r.body.requests.length === 0, "acceptation");
  await s.post({ action: "request", target: "golf", ad });
  const next = (await s.get({ "x-ads-key": "cle-du-moulin" }, "?pending=1")).body.requests[0].id;
  r = await s.post({ action: "reject", id: next, key: "cle-du-moulin" });
  ok(r.body.ok && !r.body.ads.games.golf && r.body.requests.length === 0, "refus");
  ok((await s.post({ action: "request", target: "golf", ad: { name: "" } })).status === 400, "demande sans nom");
});

await test("site sans clé du propriétaire : fermé à la publication, ouvert aux demandes", async () => {
  const s = site(null);
  ok((await s.get()).body.open === false, "annoncé ouvert");
  const r = await s.post({ action: "publish", target: "fair", ad, key: "" });
  ok(r.status === 403 && r.body.error === "closed", "publication sur un site fermé : " + r.body.error);
  ok((await s.post({ action: "request", target: "fair", ad })).body.ok, "demande sur un site fermé");
});

await test("file d'attente bornée, site sans stockage", async () => {
  const s = site();
  for (let i = 0; i < 30; i++) ok((await s.post({ action: "request", target: "fair", ad })).body.ok, "demande " + i);
  ok((await s.post({ action: "request", target: "fair", ad })).status === 429, "31e demande acceptée");
  const r = await onRequestGet({ env: {}, request: { url: "https://site.test/api/sponsors", headers: { get: () => null } } });
  ok(r.status === 501, "sans stockage : " + r.status);
});

console.log("\n" + passed + " réussis, " + failed + " échoués");
if (failed) process.exit(1);
