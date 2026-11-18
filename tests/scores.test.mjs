// Essais du top 10 : la fonction Cloudflare (functions/api/scores.js) avec un faux magasin KV, et
// l'accord entre ses règles (jeu → sens, bornes) et les jeux de la fête (def.board).
//
//   node tests/scores.test.mjs
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { RULES, cleanName, insert, onRequestGet, onRequestPost } from "../functions/api/scores.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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

/** Faux KV : une seule clé, comme sur Cloudflare. */
function store() {
  const data = new Map();
  return { data, get: async (key, type) => (data.has(key) ? (type === "json" ? JSON.parse(data.get(key)) : data.get(key)) : null), put: async (key, value) => void data.set(key, value) };
}
const post = (env, body) => onRequestPost({ env, request: { text: async () => JSON.stringify(body) } }).then(async (r) => ({ status: r.status, body: await r.json() }));

/** Les jeux, tels qu'ils se déclarent (aucun affichage : create n'est pas appelé). */
function games() {
  const defs = [];
  const context = vm.createContext({ console, Math, Date, performance: { now: () => 0 }, setInterval: () => 0, setTimeout: () => 0 });
  context.globalThis = context;
  context.MoulinFete = {};
  const run = (file) => vm.runInContext(fs.readFileSync(path.join(root, "src", "moulin2", file), "utf8"), context, { filename: file });
  run("05-kit.js");
  context.MoulinFete.registerGame = (def) => defs.push(def);
  context.MoulinFete.props = {};
  run("48-booth.js");
  for (const f of fs.readdirSync(path.join(root, "src", "moulin2", "games")).sort()) run("games/" + f);
  return defs;
}

await test("sans magasin KV : 501 (le client garde alors ses scores en local)", async () => {
  ok((await onRequestGet({ env: {} })).status === 501, "GET");
  ok((await post({}, { game: "tir", name: "A", score: 10 })).status === 501, "POST");
});
await test("un score entre au tableau, le meilleur de chaque nom est gardé, dix lignes au plus", async () => {
  const env = { SCORES: store() };
  let r = await post(env, { game: "tir", variant: "", name: "  Ada <b> ", color: "#FF0000", score: 120 });
  ok(r.status === 200 && r.body.rank === 1 && r.body.rows[0].n === cleanName("  Ada <b> "), "premier score : " + JSON.stringify(r.body));
  r = await post(env, { game: "tir", variant: "", name: "Ada", score: 90 });
  ok(r.body.rows.length === 2 || r.body.rows[0].s === 120, "un moins bon score ne remplace pas le meilleur");
  for (let i = 0; i < 14; i++) await post(env, { game: "tir", variant: "", name: "J" + i, score: 200 + i });
  const all = await (await onRequestGet({ env })).json();
  const rows = all.boards["tir|"];
  ok(rows.length === 10, "10 lignes, pas " + rows.length);
  ok(rows[0].s === 213 && rows.every((row, i) => !i || rows[i - 1].s >= row.s), "tri décroissant");
});
await test("temps : le plus court gagne ; variantes séparées (3 tours, 5 tours)", async () => {
  const env = { SCORES: store() };
  await post(env, { game: "rc", variant: "3 laps", name: "A", score: 61.5 });
  await post(env, { game: "rc", variant: "3 laps", name: "B", score: 58.25 });
  await post(env, { game: "rc", variant: "5 laps", name: "A", score: 99 });
  const all = await (await onRequestGet({ env })).json();
  ok(all.boards["rc|3 laps"][0].n === "B" && all.boards["rc|5 laps"].length === 1, JSON.stringify(all.boards));
});
await test("scores impossibles, jeux inconnus et noms vides sont refusés", async () => {
  const env = { SCORES: store() };
  ok((await post(env, { game: "tir", name: "A", score: 999999 })).status === 400, "score trop grand");
  ok((await post(env, { game: "rc", variant: "3 laps", name: "A", score: 2 })).status === 400, "temps trop court");
  ok((await post(env, { game: "nope", name: "A", score: 5 })).status === 400, "jeu inconnu");
  ok((await post(env, { game: "tir", name: "   ", score: 5 })).status === 400, "nom vide");
  ok(env.SCORES.data.size === 0, "rien n'a été écrit");
});
await test("insert : une ligne par nom, la meilleure", () => {
  let rows = insert([], { n: "A", s: 5 }, "high");
  rows = insert(rows, { n: "A", s: 9 }, "high");
  rows = insert(rows, { n: "B", s: 7 }, "high");
  ok(rows.length === 2 && rows[0].n === "A" && rows[0].s === 9, JSON.stringify(rows));
});
await test("chaque jeu de la fête a son tableau, et la fonction connaît ses règles", () => {
  const defs = games();
  ok(defs.length === 15, defs.length + " jeux déclarés au lieu de 15");
  for (const def of defs) {
    ok(def.board, def.id + " : pas de tableau (def.board)");
    const rule = RULES[def.id];
    ok(rule, def.id + " : absent des règles de functions/api/scores.js");
    ok(rule[0] === def.board.better, def.id + " : sens du classement différent (" + rule[0] + " / " + def.board.better + ")");
    ok(typeof def.board.value === "function" && typeof def.board.format === "function", def.id + " : tableau incomplet");
    const variant = def.board.variant ? def.board.variant({}) : "";
    ok(/^[a-z0-9 ·.-]{0,16}$/i.test(variant), def.id + " : variante refusée par la fonction (« " + variant + " »)");
  }
});

console.log(`\n${passed} réussis, ${failed} échoués`);
process.exit(failed ? 1 : 0);
