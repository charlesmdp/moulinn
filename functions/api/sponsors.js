// Dream Mill Fest (/moulin2) — les sponsors : qui affiche sa marque, et où.
//
// Fonction Cloudflare Pages : elle répond à /api/sponsors sur le site publié.
//   GET  /api/sponsors                → { ok, open, ads: { fair, top10, games: { <jeu>: annonce } } }
//   GET  /api/sponsors?pending=1      (en-tête x-ads-key) → { ok, requests: [{ id, target, ad, contact, date }] }
//   POST { action: "request", target, ad, contact }        demande d'un visiteur, mise en attente
//   POST { action: "publish", target, ad | null, key }     publie (ou retire) une annonce : propriétaire
//   POST { action: "approve" | "reject", id, key }         traite une demande en attente : propriétaire
// target : "fair" (sponsor principal de toute la fête), "top10" (les tableaux des records) ou
// l'identifiant d'un jeu. annonce : { name, tagline, url, image, bg, fg } ; image est une petite
// image « data: » (PNG, JPEG ou WebP, 90 000 caractères au plus) réduite par la page avant l'envoi.
//
// Rien n'est payant et rien n'est publié sans le propriétaire : sa clé est la variable ADS_KEY du
// projet (tableau de bord Cloudflare → Workers & Pages → le projet → Settings → Variables and
// Secrets). Sans ADS_KEY, personne ne peut publier (open: false) ; les visiteurs peuvent toujours
// prévisualiser dans leur navigateur et envoyer une demande. Les annonces sont rangées dans le même
// espace Workers KV que les scores (liaison SCORES). Ce fichier n'importe rien.

const KEY = "ads:v1", QUEUE = "ads:req:v1";
const MAX_PENDING = 30, MAX_GAMES = 80, MAX_IMAGE = 90000;
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const line = (value, max) =>
  String(value ?? "")
    .replace(/[\u0000-\u001f\u007f<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
const hex = (value, fallback) => (/^#[0-9a-f]{6}$/i.test(value || "") ? value.toLowerCase() : fallback);

/** Annonce nettoyée (ou null si elle n'a pas de nom) : textes courts, lien http(s), image « data: » bornée. */
export function cleanAd(ad) {
  if (!ad || typeof ad !== "object") return null;
  const name = line(ad.name, 28);
  if (!name) return null;
  const url = line(ad.url, 200), image = typeof ad.image === "string" ? ad.image : "";
  return {
    name,
    tagline: line(ad.tagline, 60),
    url: /^https?:\/\/[^\s"'<>]+$/i.test(url) ? url : "",
    image: image.length <= MAX_IMAGE && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(image) ? image : "",
    bg: hex(ad.bg, "#1d2b4f"),
    fg: hex(ad.fg, "#ffffff"),
  };
}
export const cleanTarget = (value) => (typeof value === "string" && /^[a-z0-9]{2,16}$/.test(value) ? value : "");

async function read(env, key, fallback) {
  try {
    const data = await env.SCORES.get(key, "json");
    return data && typeof data === "object" ? data : fallback;
  } catch (error) {
    return fallback;
  }
}
const loadAds = async (env) => {
  const ads = await read(env, KEY, {});
  return { fair: ads.fair || null, top10: ads.top10 || null, games: ads.games && typeof ads.games === "object" ? ads.games : {} };
};
const loadQueue = async (env) => {
  const q = await read(env, QUEUE, []);
  return Array.isArray(q) ? q : [];
};
/** La clé du propriétaire, comparée sans s'arrêter au premier caractère différent. */
function owner(env, key) {
  const want = String((env && env.ADS_KEY) || "");
  const got = String(key || "");
  if (want.length < 6 || got.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ got.charCodeAt(i);
  return diff === 0;
}
function place(ads, target, ad) {
  if (target === "fair" || target === "top10") ads[target] = ad;
  else if (ad) ads.games[target] = ad;
  else delete ads.games[target];
}

export async function onRequestGet({ request, env }) {
  if (!env || !env.SCORES) return json({ ok: false, error: "no-store" }, 501);
  const url = new URL(request.url, "http://localhost");
  if (url.searchParams.get("pending")) {
    if (!owner(env, request.headers.get("x-ads-key"))) return json({ ok: false, error: "bad-key" }, 403);
    return json({ ok: true, requests: await loadQueue(env) });
  }
  return json({ ok: true, open: String(env.ADS_KEY || "").length >= 6, ads: await loadAds(env) });
}

export async function onRequestPost({ request, env }) {
  if (!env || !env.SCORES) return json({ ok: false, error: "no-store" }, 501);
  let body;
  try {
    body = JSON.parse((await request.text()).slice(0, MAX_IMAGE + 4000));
  } catch (error) {
    return json({ ok: false, error: "bad-json" }, 400);
  }
  const action = body && body.action;
  if (action === "request") {
    const target = cleanTarget(body.target), ad = cleanAd(body.ad);
    if (!target || !ad) return json({ ok: false, error: "bad-request" }, 400);
    const queue = await loadQueue(env);
    if (queue.length >= MAX_PENDING) return json({ ok: false, error: "queue-full" }, 429);
    const id = Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
    queue.push({ id, target, ad, contact: line(body.contact, 120), date: new Date().toISOString().slice(0, 10) });
    await env.SCORES.put(QUEUE, JSON.stringify(queue));
    return json({ ok: true, id, pending: queue.length });
  }
  if (action !== "publish" && action !== "approve" && action !== "reject") return json({ ok: false, error: "unknown-action" }, 400);
  if (!owner(env, body.key)) return json({ ok: false, error: env.ADS_KEY ? "bad-key" : "closed" }, 403);
  const ads = await loadAds(env);
  if (action === "publish") {
    const target = cleanTarget(body.target), ad = body.ad ? cleanAd(body.ad) : null;
    if (!target || (body.ad && !ad)) return json({ ok: false, error: "bad-request" }, 400);
    if (ad && target !== "fair" && target !== "top10" && !ads.games[target] && Object.keys(ads.games).length >= MAX_GAMES) return json({ ok: false, error: "too-many" }, 400);
    place(ads, target, ad);
    await env.SCORES.put(KEY, JSON.stringify(ads));
    return json({ ok: true, ads });
  }
  const queue = await loadQueue(env), i = queue.findIndex((r) => r.id === body.id);
  if (i < 0) return json({ ok: false, error: "unknown-request" }, 404);
  const [req] = queue.splice(i, 1);
  if (action === "approve") {
    place(ads, req.target, req.ad);
    await env.SCORES.put(KEY, JSON.stringify(ads));
  }
  await env.SCORES.put(QUEUE, JSON.stringify(queue));
  return json({ ok: true, ads, requests: queue });
}
