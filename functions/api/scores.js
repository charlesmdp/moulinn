// La Fête du Moulin (/moulin2) — le top 10 de chaque jeu, gardé pour de bon.
//
// Fonction Cloudflare Pages : elle répond à /api/scores sur le site publié.
//   GET  /api/scores  → { ok: true, boards: { "<jeu>|<variante>": [{ n, s, c, d }, …] } }
//   POST /api/scores  { game, variant, name, color, score } → { ok, key, rows, rank }
// n : pseudo, s : score, c : couleur du joueur, d : date (AAAA-MM-JJ). Dix lignes au plus par
// tableau, une seule par pseudo (sa meilleure).
//
// Les tableaux sont rangés dans un espace Workers KV lié au projet sous le nom SCORES
// (tableau de bord Cloudflare → Workers & Pages → le projet → Settings → Bindings → KV namespace,
// nom de variable « SCORES »). Sans cette liaison la fonction répond 501 et la page garde ses
// tableaux dans le navigateur de chaque visiteur, échangés entre joueurs présents.
//
// Pas d'arbitre : un score est accepté s'il est plausible pour le jeu (bornes ci-dessous). Ce
// fichier n'importe rien, pour rester simple à déployer ; scripts/serve.mjs et scripts/labo.mjs
// l'utilisent tel quel avec un faux espace de stockage, tests/scores.test.mjs le vérifie.

/** Jeux connus : sens du classement (« low » : le plus petit gagne), score minimal et maximal plausibles. */
export const RULES = {
  rc: ["low", 12, 1800],
  bateaux: ["low", 12, 1800],
  drones: ["low", 8, 1800],
  golf: ["low", 3, 99],
  tir: ["high", 1, 5000],
  canards: ["high", 1, 2000],
  citrouilles: ["high", 1, 200000],
  autos: ["high", 1, 500],
  striker: ["high", 1, 1000],
  moles: ["high", 1, 5000],
  skee: ["high", 1, 2000],
  rings: ["high", 1, 2000],
  bottles: ["high", 1, 5000],
  water: ["low", 3, 300],
  cornhole: ["high", 1, 500],
  dunk: ["high", 1, 500],
  darts: ["high", 1, 5000],
  hoops: ["high", 1, 500],
  // Dream Mill Fest : étangs, rivière, arbres, terrasse, plateau
  chop: ["high", 1, 300],
  axe: ["high", 1, 400],
  climb: ["low", 8, 300],
  skip: ["high", 1, 3000],
  eat: ["high", 1, 400],
  frogs: ["high", 1, 1000],
  logroll: ["high", 1, 1300],
  fish: ["high", 1, 5000],
  derby: ["low", 5, 600],
  maze: ["low", 4, 900],
  pinata: ["high", 1, 5000],
  welly: ["high", 1, 700],
  // rive sud, plateau, pré de l'est : huit jeux de plus
  bull: ["high", 1, 6000],
  stack: ["high", 1, 500],
  pitch: ["high", 1, 200],
  burn: ["high", 1, 9000],
  upround: ["high", 1, 5000],
  market: ["high", 1, 2000],
  train: ["high", 1, 1000],
  grandprix: ["low", 15, 900],
};
const KEY = "top10:v1";
const MAX_VARIANTS = 4;
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

/** Pseudo nettoyé : une ligne, 18 caractères au plus, sans caractères de contrôle ni balises. */
export function cleanName(value) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 18);
}
/** Ajoute une ligne à un tableau : une seule ligne par pseudo (la meilleure), triées, dix au plus. */
export function insert(rows, row, better) {
  const cmp = better === "low" ? (a, b) => a.s - b.s || (a.d < b.d ? -1 : 1) : (a, b) => b.s - a.s || (a.d < b.d ? -1 : 1);
  const best = new Map();
  for (const r of [...rows, row]) {
    const k = r.n.toLowerCase();
    const old = best.get(k);
    if (!old || cmp(r, old) < 0) best.set(k, r);
  }
  return [...best.values()].sort(cmp).slice(0, 10);
}
async function load(env) {
  try {
    const data = await env.SCORES.get(KEY, "json");
    return data && typeof data === "object" ? data : {};
  } catch (error) {
    return {};
  }
}

export async function onRequestGet({ env }) {
  if (!env || !env.SCORES) return json({ ok: false, error: "no-store" }, 501);
  return json({ ok: true, boards: await load(env) });
}

export async function onRequestPost({ request, env }) {
  if (!env || !env.SCORES) return json({ ok: false, error: "no-store" }, 501);
  let body;
  try {
    body = JSON.parse((await request.text()).slice(0, 600));
  } catch (error) {
    return json({ ok: false, error: "bad-json" }, 400);
  }
  const rule = RULES[body && body.game];
  if (!rule) return json({ ok: false, error: "unknown-game" }, 400);
  const variant = String(body.variant ?? "").slice(0, 16);
  if (!/^[a-z0-9 ·.-]{0,16}$/i.test(variant)) return json({ ok: false, error: "bad-variant" }, 400);
  const name = cleanName(body.name);
  const score = Math.round(Number(body.score) * 100) / 100;
  if (!name || !Number.isFinite(score) || score < rule[1] || score > rule[2]) return json({ ok: false, error: "bad-score" }, 400);
  const color = /^#[0-9a-f]{6}$/i.test(body.color) ? body.color.toLowerCase() : "#888888";
  const key = body.game + "|" + variant;
  const boards = await load(env);
  if (!boards[key] && Object.keys(boards).filter((k) => k.startsWith(body.game + "|")).length >= MAX_VARIANTS) return json({ ok: false, error: "too-many-variants" }, 400);
  const before = JSON.stringify(boards[key] || []);
  const row = { n: name, s: score, c: color, d: new Date().toISOString().slice(0, 10) };
  const rows = insert(Array.isArray(boards[key]) ? boards[key] : [], row, rule[0]);
  const rank = rows.findIndex((r) => r === row) + 1;
  if (JSON.stringify(rows) !== before) {
    boards[key] = rows;
    await env.SCORES.put(KEY, JSON.stringify(boards));
  }
  return json({ ok: true, key, rows, rank });
}
