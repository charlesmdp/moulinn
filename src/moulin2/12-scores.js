// La Fête du Moulin — classements : le top 10 de chaque jeu, « écrit ici pour toujours ».
//
// Un jeu déclare son tableau dans sa définition :
//   board: { label: "Best time", better: "low" | "high",   // « low » : le plus petit gagne (temps, coups)
//            value: (résultat, options) => nombre ou null,  // ce qui est classé (null : rien à inscrire)
//            variant: (options) => "3 laps",                // un tableau par réglage (facultatif)
//            format: (valeur) => "1:02.34" }
//
// Où sont gardés les tableaux :
//  - sur le site publié, par la fonction /api/scores (functions/api/scores.js, stockage durable) ;
//  - toujours aussi dans le navigateur du visiteur, et échangés entre les joueurs présents : si la
//    fonction ne répond pas (essai en local, stockage non branché), les tableaux vivent quand même.
//
//   const scores = MF.Scores.create({ net, defs, url });
//   scores.table(def, options) → { key, variant, rows: [{ n, s, c, d }], text(row) }
//   scores.submit(def, options, résultat, moi) → { rank } si le score entre dans le top 10, sinon null
//   scores.onChange(fn(clé)) ; scores.sync()
(function () {
  "use strict";
  const MF = (globalThis.MoulinFete = globalThis.MoulinFete || {});
  const STORE = "fete-top10";
  const cleanName = (value) =>
    String(value ?? "")
      .replace(/[\u0000-\u001f\u007f<>]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 18);
  /** Même règle que le serveur : une ligne par pseudo (la meilleure), triées, dix au plus. */
  function insert(rows, row, better) {
    const cmp = better === "low" ? (a, b) => a.s - b.s || (a.d < b.d ? -1 : 1) : (a, b) => b.s - a.s || (a.d < b.d ? -1 : 1);
    const best = new Map();
    for (const r of [...rows, row]) {
      const k = r.n.toLowerCase();
      const old = best.get(k);
      if (!old || cmp(r, old) < 0) best.set(k, r);
    }
    return [...best.values()].sort(cmp).slice(0, 10);
  }
  const validRow = (r) => r && typeof r.n === "string" && Number.isFinite(r.s) && cleanName(r.n).length > 0;
  const tidy = (r) => ({ n: cleanName(r.n), s: Math.round(r.s * 100) / 100, c: /^#[0-9a-f]{6}$/i.test(r.c) ? r.c : "#888888", d: /^\d{4}-\d{2}-\d{2}$/.test(r.d) ? r.d : "" });

  function create({ net, defs, url, storage }) {
    const store = storage === undefined ? (typeof localStorage !== "undefined" ? localStorage : null) : storage;
    const byId = new Map(defs.filter((d) => d.board).map((d) => [d.id, d]));
    const boards = new Map();
    const listeners = [];
    const pending = []; // mes scores que le serveur n'a pas encore reçus
    let api = url ? "?" : "non";
    const emit = (key) => listeners.slice().forEach((fn) => fn(key));
    const defOf = (key) => byId.get(String(key).split("|")[0]);
    function save() {
      if (!store) return;
      try {
        store.setItem(STORE, JSON.stringify({ boards: Object.fromEntries(boards), pending }));
      } catch (e) {}
    }
    function setRows(key, rows) {
      const next = rows.slice(0, 10);
      if (JSON.stringify(next) === JSON.stringify(boards.get(key) || [])) return false;
      boards.set(key, next);
      save();
      emit(key);
      return true;
    }
    /** Fusionne des lignes venues d'ailleurs (serveur, autre joueur, navigateur). */
    function merge(key, rows) {
      const def = defOf(key);
      if (!def || !Array.isArray(rows) || String(key).length > 40) return false;
      let table = boards.get(key) || [];
      for (const r of rows.slice(0, 10)) if (validRow(r)) table = insert(table, tidy(r), def.board.better);
      return setRows(key, table);
    }
    try {
      const saved = store ? JSON.parse(store.getItem(STORE) || "null") : null;
      if (saved && saved.boards) for (const key of Object.keys(saved.boards)) merge(key, saved.boards[key]);
      if (saved && Array.isArray(saved.pending)) pending.push(...saved.pending.slice(0, 20));
    } catch (e) {}

    async function post(entry) {
      if (!url || api === "non") return false;
      try {
        const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(entry) });
        if (res.status === 501 || res.status === 404 || res.status === 405) {
          api = "non";
          return false;
        }
        const data = await res.json();
        if (data && data.ok && Array.isArray(data.rows)) {
          api = "oui";
          const def = defOf(data.key);
          if (def) setRows(data.key, data.rows.filter(validRow).map(tidy));
        }
        return res.status < 500; // refusé pour de bon (400) : inutile de réessayer
      } catch (e) {
        return false;
      }
    }
    async function flush() {
      while (pending.length && api !== "non") {
        if (!(await post(pending[0]))) break;
        pending.shift();
        save();
      }
    }
    /** Relit les tableaux du serveur ; ceux-ci font foi quand il répond. */
    async function sync() {
      if (!url || api === "non") return false;
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) {
          if (res.status === 501 || res.status === 404) api = "non";
          return false;
        }
        const data = await res.json();
        if (!data || !data.ok || !data.boards) return false;
        api = "oui";
        for (const key of Object.keys(data.boards)) if (defOf(key) && Array.isArray(data.boards[key])) setRows(key, data.boards[key].filter(validRow).map(tidy));
        await flush();
        return true;
      } catch (e) {
        return false;
      }
    }

    // Entre joueurs présents : un nouveau record est annoncé à tous ; sans serveur, un arrivant
    // reçoit aussi les tableaux de ceux qui sont là.
    if (net) {
      net.on("sb", (d) => d && typeof d.k === "string" && merge(d.k, d.r));
      net.on("sb*", (d) => {
        if (d && typeof d === "object") for (const key of Object.keys(d).slice(0, 80)) merge(key, d[key]);
      });
      net.onJoin((peer, changed) => {
        if (changed || api === "oui" || !boards.size) return;
        setTimeout(() => net.sendTo(peer.uid, "sb*", Object.fromEntries(boards)), 1500 + Math.random() * 1500);
      });
    }

    const scores = {
      boards,
      /** "oui" : le serveur garde les tableaux ; "non" : navigateur et joueurs présents seulement ; "?" : pas encore su. */
      mode: () => api,
      onChange: (fn) => listeners.push(fn),
      sync,
      keyOf: (def, opts) => def.id + "|" + (def.board && def.board.variant ? String(def.board.variant(opts || {})).slice(0, 16) : ""),
      /** Tableau d'un jeu pour des réglages donnés (ceux par défaut si opts est absent). */
      table(def, opts) {
        if (!def.board) return null;
        const options = opts || Object.fromEntries((def.options || []).map((o) => [o.key, o.default]));
        const key = scores.keyOf(def, options);
        return { key, variant: key.split("|")[1], rows: boards.get(key) || [], text: (row) => (def.board.format ? def.board.format(row.s) : String(row.s)), label: def.board.label || "" };
      },
      /** Inscrit mon résultat s'il entre dans le top 10. Renvoie { rank, key } ou null. */
      submit(def, opts, result, self) {
        const b = def.board;
        if (!b || !result || result.dnf) return null;
        const value = b.value(result, opts || {});
        if (!Number.isFinite(value)) return null;
        const key = scores.keyOf(def, opts);
        const row = { n: cleanName(self.name) || "Miller", s: Math.round(value * 100) / 100, c: self.color, d: new Date().toISOString().slice(0, 10) };
        const rows = insert(boards.get(key) || [], row, b.better);
        const rank = rows.indexOf(row) + 1;
        if (!rank) return null;
        setRows(key, rows);
        if (net) net.send("sb", { k: key, r: rows });
        const entry = { game: def.id, variant: key.split("|")[1], name: row.n, color: row.c, score: row.s };
        if (url && api !== "non") {
          pending.push(entry);
          save();
          flush();
        }
        return { rank, key };
      },
    };
    return scores;
  }

  MF.Scores = { create, insert, cleanName };
})();
