// La Fête du Moulin — parties : qui joue à quoi, salle d'attente, départ, résultats.
//
// Il n'y a pas de serveur : pour chaque jeu, l'un des joueurs inscrits est « l'hôte » de la partie.
// Lui seul change l'état commun (salle d'attente → décompte → partie → résultats) et le diffuse ; les
// autres lui envoient leurs demandes (« on lance », « on rejoue », « 5 tours »). Si l'hôte s'en va,
// le suivant de la liste reprend le rôle avec le dernier état connu.
//
//   const sessions = MF.Sessions.create({ net, presence });
//   const s = sessions.get("rc", def)        // def : { minPlayers, maxPlayers, options, maxTime, rank(results) }
//   s.join() ; s.leave()                     // le joueur local s'inscrit ou se retire
//   s.state → { id, born, rev, host, phase, run, opts, seed, roster: [{ uid, name, color }], results, ranking } | null
//       phase : "lobby" (salle d'attente) | "countdown" (3, 2, 1) | "run" (partie) | "results"
//   s.players() → inscrits en ce moment ; s.isHost() ; s.joined ; s.slot(uid) (rang dans la partie)
//   s.requestStart() ; s.requestLobby() ; s.setOption(clé, valeur)
//   s.time() → secondes écoulées depuis le départ (négatif pendant le décompte)
//   s.report(résultat)                       // mon résultat (temps, score…) : l'hôte clôt quand tous ont fini
//   s.send(type, data) / s.sendTo(uid, type, data) / s.on(type, fn(data, peer))   // messages du jeu
//   s.sendState(data) / s.onState(fn(data, peer))                                 // positions, 10 à 15 fois par seconde
//   s.claim(clé) → vrai si c'est (pour l'instant) à moi ; s.owner(clé) ; s.onClaim(fn(clé, uid))
//       objets que plusieurs joueurs se disputent (une cible, un canard) : le plus rapide l'emporte,
//       et tout le monde arrive à la même conclusion quel que soit l'ordre d'arrivée des messages
//   s.onChange(fn(state, précédent))         // changement de phase ou d'options
(function () {
  "use strict";
  const MF = (globalThis.MoulinFete = globalThis.MoulinFete || {});
  const COUNTDOWN = 3.6; // secondes entre « on lance » et le départ

  function create({ net, presence, now }) {
    const clock = now || (() => performance.now());
    const all = new Map();

    function makeSession(game, def) {
      const listeners = { change: [], state: [], claim: [], msg: new Map() };
      const s = {
        game,
        def: Object.assign({ minPlayers: 1, maxPlayers: 8, options: [], maxTime: 600 }, def || {}),
        state: null,
        joined: false,
        runStart: 0, // heure locale (ms) du départ de la partie en cours
        phaseStart: 0,
        claims: new Map(),
        myResult: null,
        askTimer: 0,
      };
      const emit = (list, ...args) => {
        for (const fn of list.slice()) {
          try {
            fn(...args);
          } catch (error) {
            console.error("[Fête du Moulin] " + game, error);
          }
        }
      };
      const defaults = () => Object.fromEntries((s.def.options || []).map((o) => [o.key, o.default !== undefined ? o.default : o.values[0]]));
      const players = () => presence.inGame(game);
      s.players = players;
      s.isHost = () => s.joined && !!s.state && s.state.host === net.self.uid;
      s.slot = (uid) => {
        const list = s.state && s.state.phase !== "lobby" ? s.state.roster : players();
        return list.findIndex((p) => p.uid === (uid || net.self.uid));
      };
      s.inRoster = (uid) => !!s.state && s.state.roster.some((p) => p.uid === (uid || net.self.uid));
      s.time = () => (clock() - s.runStart) / 1000;

      /** Ce que fait le joueur local dans ce jeu, vu par les autres : attend, joue, a fini, regarde. */
      function syncActivity() {
        if (!s.joined) return;
        const st = s.state;
        const running = !!st && (st.phase === "run" || st.phase === "countdown");
        presence.setActivity(game, !running ? "wait" : !s.inRoster() ? "watch" : s.myResult ? "done" : "play");
      }
      function adopt(next, elapsedMs) {
        const prev = s.state;
        s.state = next;
        const t = clock();
        if (!prev || prev.phase !== next.phase || prev.run !== next.run) {
          s.phaseStart = t - (elapsedMs || 0);
          if (next.phase === "countdown") s.runStart = s.phaseStart + COUNTDOWN * 1000;
          else if (next.phase === "run" && (!prev || prev.phase !== "countdown" || prev.run !== next.run)) s.runStart = s.phaseStart;
          if (next.phase === "countdown" || (next.phase === "run" && (!prev || prev.run !== next.run))) {
            s.claims.clear();
            s.myResult = null;
          }
        }
        syncActivity();
        emit(listeners.change, next, prev);
      }
      function broadcast(to) {
        const st = s.state;
        const payload = { g: game, s: st, e: Math.round(clock() - s.phaseStart) };
        if (to) {
          // réponse à un arrivant : il lui faut aussi les objets déjà gagnés (cibles tombées, canards pêchés)
          if (s.claims.size && st.phase === "run") payload.c = [...s.claims].map(([key, c]) => [key, c.u, c.t]);
          net.sendTo(to, "gs", payload);
        } else net.send("gs", payload);
      }
      /** L'hôte change l'état commun et le diffuse. */
      function commit(patch) {
        const next = Object.assign({}, s.state, patch, { rev: (s.state ? s.state.rev : 0) + 1, host: net.self.uid });
        adopt(next, 0);
        broadcast();
      }
      function freshLobby() {
        return { id: MF.uid(6), born: Date.now(), rev: 0, host: net.self.uid, phase: "lobby", run: 0, opts: defaults(), seed: 0, roster: [], results: {}, ranking: [] };
      }
      function startCountdown() {
        const list = players().slice(0, s.def.maxPlayers);
        if (list.length < s.def.minPlayers) return;
        commit({ phase: "countdown", run: (s.state.run || 0) + 1, seed: (Math.random() * 0xffffffff) >>> 0, roster: list.map((p) => ({ uid: p.uid, name: p.name, color: p.color })), results: {}, ranking: [] });
      }
      function finalize() {
        const st = s.state;
        const results = Object.assign({}, st.results);
        for (const p of st.roster) if (!results[p.uid]) results[p.uid] = { dnf: true };
        const entries = st.roster.map((p) => Object.assign({ uid: p.uid, name: p.name, color: p.color }, results[p.uid]));
        const ranking = s.def.rank ? s.def.rank(entries, st.opts) : entries;
        commit({ phase: "results", results, ranking: ranking.map((e) => e.uid) });
      }

      s.join = function () {
        if (s.joined) return;
        s.joined = true;
        presence.setActivity(game, "wait");
        s.hostGone = 0;
        const others = players().filter((p) => !p.self);
        if (s.state || others.length) {
          // une partie existe déjà (on la suivait en spectateur) ou d'autres y sont : on la rejoint, en
          // redemandant l'état pour être sûr d'avoir le dernier
          syncActivity();
          if (s.state) emit(listeners.change, s.state, s.state);
          net.send("gs?", { g: game });
          s.askTimer = clock() + 1500;
        } else {
          adopt(freshLobby(), 0);
          commit({});
        }
      };
      s.leave = function () {
        if (!s.joined) return;
        const st = s.state;
        if (st && st.host === net.self.uid) {
          // l'hôte s'en va : il passe la main tout de suite au suivant (sans attendre qu'on le croie parti)
          const list = players().filter((p) => !p.self);
          const pool = st.phase === "lobby" ? list : st.roster.filter((p) => list.some((q) => q.uid === p.uid)).concat(list);
          if (pool.length) {
            s.state = Object.assign({}, st, { rev: st.rev + 1, host: pool[0].uid });
            broadcast();
          }
        }
        s.joined = false;
        presence.setActivity(null);
        s.myResult = null;
        s.askTimer = 0;
        s.hostGone = 0;
        if (s.state) emit(listeners.change, s.state, s.state);
      };
      s.requestStart = function () {
        if (!s.state || s.state.phase !== "lobby") return;
        if (s.isHost()) startCountdown();
        else net.sendTo(s.state.host, "gr", { g: game, a: "start" });
      };
      s.requestLobby = function () {
        if (!s.state || s.state.phase !== "results") return;
        if (s.isHost()) commit({ phase: "lobby", roster: [], results: {}, ranking: [] });
        else net.sendTo(s.state.host, "gr", { g: game, a: "lobby" });
      };
      s.setOption = function (key, value) {
        if (!s.state || s.state.phase !== "lobby") return;
        const opt = (s.def.options || []).find((o) => o.key === key);
        if (!opt || !opt.values.includes(value)) return;
        if (s.isHost()) commit({ opts: Object.assign({}, s.state.opts, { [key]: value }) });
        else net.sendTo(s.state.host, "gr", { g: game, a: "opt", k: key, v: value });
      };
      s.report = function (result) {
        if (!s.state || (s.state.phase !== "run" && s.state.phase !== "countdown") || !s.inRoster()) return;
        s.myResult = result;
        net.send("gf", { g: game, r: result, run: s.state.run });
        s.state.results[net.self.uid] = result;
        syncActivity();
        emit(listeners.change, s.state, s.state);
        checkDone();
      };
      function checkDone() {
        const st = s.state;
        if (!st || st.phase !== "run" || !s.isHost()) return;
        const present = new Set(players().map((p) => p.uid));
        const waiting = st.roster.filter((p) => present.has(p.uid) && !st.results[p.uid]);
        if (!waiting.length || s.time() > s.def.maxTime) finalize();
      }
      s.send = (type, data) => net.send("gm", { g: game, k: type, d: data });
      s.sendTo = (uid, type, data) => net.sendTo(uid, "gm", { g: game, k: type, d: data });
      s.on = (type, fn) => {
        if (!listeners.msg.has(type)) listeners.msg.set(type, []);
        listeners.msg.get(type).push(fn);
      };
      s.sendState = (data) => net.send("gx", { g: game, d: data });
      s.onState = (fn) => listeners.state.push(fn);
      s.onChange = (fn) => listeners.change.push(fn);
      s.onClaim = (fn) => listeners.claim.push(fn);
      s.owner = (key) => {
        const c = s.claims.get(key);
        return c ? c.u : null;
      };
      function applyClaim(key, uid, t) {
        const cur = s.claims.get(key);
        if (cur && (cur.t < t || (cur.t === t && cur.u <= uid))) return false;
        s.claims.set(key, { u: uid, t });
        emit(listeners.claim, key, uid, cur ? cur.u : null);
        return true;
      }
      s.claim = function (key) {
        const cur = s.claims.get(key);
        if (cur) return cur.u === net.self.uid; // déjà pris (par moi ou par un autre) : rien à disputer
        const t = Math.round(s.time() * 1000);
        if (!applyClaim(key, net.self.uid, t)) return false;
        s.send("claim", [key, t]);
        return true;
      };
      /** Nombre de clés gagnées par un joueur (score des jeux à cibles partagées). */
      s.claimed = (uid) => {
        let n = 0;
        for (const c of s.claims.values()) if (c.u === uid) n++;
        return n;
      };

      // réception
      // Deux états pour un même jeu : lequel garder ? Tous les joueurs doivent conclure pareil, sans
      // dépendre de l'ordre d'arrivée des messages.
      //  - même partie (même id) : la révision la plus récente ;
      //  - deux parties ouvertes en même temps : une partie lancée l'emporte sur une salle d'attente,
      //    puis la plus ancienne, puis le plus petit identifiant.
      const live = (st) => (st.phase === "lobby" ? 0 : 1);
      function better(next, cur) {
        if (next.id === cur.id) return next.rev > cur.rev || (next.rev === cur.rev && next.host < cur.host);
        if (live(next) !== live(cur)) return live(next) > live(cur);
        if ((next.born || 0) !== (cur.born || 0)) return (next.born || 0) < (cur.born || 0);
        return next.id < cur.id;
      }
      const pushed = new Map(); // uid → heure du dernier rappel envoyé (pas plus d'un par seconde)
      s._gs = function (payload, peer) {
        const next = payload.s;
        if (!next || typeof next.rev !== "number" || typeof next.id !== "string" || !Array.isArray(next.roster)) return;
        const cur = s.state;
        if (!cur || better(next, cur)) {
          s.askTimer = 0;
          adopt(next, payload.e || 0);
          if (Array.isArray(payload.c)) for (const c of payload.c) applyClaim(c[0], c[1], +c[2] || 0);
        } else if (s.isHost() && (next.id !== cur.id || next.rev < cur.rev)) {
          // l'autre a un état dépassé ou une partie concurrente : je lui renvoie le bon
          const t = clock();
          if (t - (pushed.get(peer.uid) || -1e9) > 1000) {
            pushed.set(peer.uid, t);
            broadcast(peer.uid);
          }
        }
      };
      s._ask = function (peer) {
        // tout joueur inscrit répond (l'arrivant garde le plus récent) : l'hôte peut être injoignable pour lui
        if (s.state && s.joined) broadcast(peer.uid);
      };
      s._req = function (d, peer) {
        if (!s.isHost()) return;
        if (d.a === "start" && s.state.phase === "lobby") startCountdown();
        else if (d.a === "lobby" && s.state.phase === "results") commit({ phase: "lobby", roster: [], results: {}, ranking: [] });
        else if (d.a === "opt" && s.state.phase === "lobby") {
          const opt = (s.def.options || []).find((o) => o.key === d.k);
          if (opt && opt.values.includes(d.v)) commit({ opts: Object.assign({}, s.state.opts, { [d.k]: d.v }) });
        }
      };
      s._fin = function (d, peer) {
        if (!s.state || d.run !== s.state.run || !s.inRoster(peer.uid)) return;
        if (s.state.phase !== "run" && s.state.phase !== "countdown") return;
        s.state.results[peer.uid] = d.r;
        emit(listeners.change, s.state, s.state);
        checkDone();
      };
      s._msg = function (d, peer) {
        if (d.k === "claim" && Array.isArray(d.d)) return void applyClaim(d.d[0], peer.uid, +d.d[1] || 0);
        const list = listeners.msg.get(d.k);
        if (list) emit(list, d.d, peer);
      };
      s._state = (d, peer) => emit(listeners.state, d.d, peer);

      /** Chaque image : passage du décompte à la partie, relève de l'hôte, clôture. */
      s.tick = function () {
        const st = s.state;
        const t = clock();
        const list = players();
        if (!st) {
          if (s.joined && s.askTimer && t > s.askTimer) {
            // personne n'a répondu : j'ouvre la salle d'attente
            s.askTimer = 0;
            adopt(freshLobby(), 0);
            commit({});
          } else if (!s.joined && list.length && t > (s.nextAsk || 0)) {
            // des joueurs sont à ce jeu et je ne sais pas où ils en sont (je viens d'arriver) : je demande
            s.nextAsk = t + 2000;
            net.send("gs?", { g: game });
          }
          return;
        }
        if (st.phase === "countdown" && t >= s.runStart) {
          // départ : chacun passe en « partie » de son côté, au même instant de son horloge
          const next = Object.assign({}, st, { phase: "run" });
          s.state = next;
          s.phaseStart = s.runStart;
          syncActivity();
          emit(listeners.change, next, st);
          if (s.isHost()) {
            next.rev++;
            broadcast();
          }
          return;
        }
        // l'hôte n'est plus là (après un court délai : sa présence peut simplement tarder à arriver)
        if (!list.some((p) => p.uid === st.host)) {
          if (!s.hostGone) s.hostGone = t;
          if (t - s.hostGone > 2500) {
            if (s.joined) {
              // relève : le premier des joueurs restants reprend la partie là où elle en est
              const pool = st.phase === "lobby" ? list : st.roster.filter((p) => list.some((q) => q.uid === p.uid)).concat(list);
              if (pool.length && pool[0].uid === net.self.uid) {
                s.hostGone = 0;
                commit({});
              }
            } else {
              // spectateur d'une partie sans hôte : on l'oublie (et on redemandera s'il reste des joueurs)
              s.hostGone = 0;
              s.state = null;
              s.claims.clear();
              emit(listeners.change, null, st);
              return;
            }
          }
        } else s.hostGone = 0;
        if (st.phase === "run" && s.isHost()) checkDone();
      };
      return s;
    }

    const route = (fn) => (d, peer) => {
      if (!d || typeof d.g !== "string") return;
      const s = all.get(d.g);
      if (s) s[fn](d, peer);
    };
    net.on("gs", route("_gs"));
    net.on("gs?", (d, peer) => {
      const s = d && all.get(d.g);
      if (s) s._ask(peer);
    });
    net.on("gr", route("_req"));
    net.on("gf", route("_fin"));
    net.on("gm", route("_msg"));
    net.on("gx", route("_state"));

    const sessions = {
      all,
      get(game, def) {
        if (!all.has(game)) all.set(game, makeSession(game, def));
        return all.get(game);
      },
      tick() {
        for (const s of all.values()) s.tick();
      },
      COUNTDOWN,
    };
    return sessions;
  }

  MF.Sessions = { create, COUNTDOWN };
})();
