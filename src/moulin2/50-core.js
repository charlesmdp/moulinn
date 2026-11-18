// La Fête du Moulin — cœur : relie le monde 3D, le réseau, l'interface et les jeux.
//
// Chaque jeu s'enregistre avec MF.registerGame({ … }) (détail dans src/moulin2/CONCEPTION.md) :
//
//   id, title, icon, blurb, color       identité (l'id sert aussi aux emplacements de sponsors)
//   station: { x, z, heading }          où se tient le joueur ; un panneau y est planté
//   minPlayers, maxPlayers, maxTime     1 à 8 joueurs ; durée maximale d'une partie (s)
//   options: [{ key, label, values, default, format(v) }]   réglages de la salle d'attente
//   rank(entrées, options) → entrées triées, la meilleure d'abord (entrée = résultat + uid, name, color)
//   describe(résultat, options) → texte du résultat (« 1:02.34 », « 12 points »)
//   help                                 rappel des commandes
//   create(ctx) → { update(dt, t), enter(), leave(), onPhase(état, avant), idle() }
//
// Le jeu existe pendant toute la visite : il construit son décor une fois (create), dessine les
// voitures, bateaux ou balles des autres joueurs même quand le joueur local se promène (update), et
// prend la caméra et les commandes quand le joueur local s'y inscrit (enter … leave).
// ctx : { MF, THREE, world, def, group, camera, session, net, presence, input, hud, sponsors, sfx,
//         active(), playing(), self }
(function () {
  "use strict";
  const MF = (globalThis.MoulinFete = globalThis.MoulinFete || {});
  MF.games = MF.games || [];
  MF.registerGame = function (def) {
    if (!def || !def.id || typeof def.create !== "function") throw new Error("Jeu de la fête invalide");
    if (!MF.games.some((g) => g.id === def.id)) MF.games.push(def);
  };
  const ORDER = ["rc", "bateaux", "drones", "autos", "citrouilles", "golf", "tir", "canards", "striker", "moles", "skee", "rings", "bottles", "water", "cornhole"];
  const PROFILE_KEY = "fete-profil";
  const NEAR = 3.4; // distance (m) à laquelle un stand propose de jouer

  function loadProfile() {
    try {
      const p = JSON.parse(localStorage.getItem(PROFILE_KEY));
      // « connu » : il a déjà choisi son pseudo ET son ordinateur (sinon on lui repose la question)
      if (p && p.name)
        return { name: String(p.name).slice(0, 18), color: MF.PLAYER_COLORS.includes(p.color) ? p.color : MF.PLAYER_COLORS[0], kit: MF.laptops.valid(p.kit), bio: String(p.bio || "").slice(0, 40), known: !!p.kit };
    } catch (e) {}
    const kits = MF.laptops.list;
    return { name: "Miller " + (10 + Math.floor(Math.random() * 90)), color: MF.PLAYER_COLORS[Math.floor(Math.random() * MF.PLAYER_COLORS.length)], kit: kits[Math.floor(Math.random() * kits.length)].id, bio: "", known: false };
  }
  function saveProfile(p) {
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify({ name: p.name, color: p.color, kit: p.kit, bio: p.bio }));
    } catch (e) {}
  }

  /**
   * Démarre la fête dans un monde 3D. world : voir src/moulin2/99-host-moulin.js (le vrai moulin) et
   * src/moulin2/labo/world.js (terrain d'essai). options : { rtc: false (sans connexion directe), relayUrls,
   * room, welcome: false, name, color, game (jeu où entrer d'emblée), now (horloge des parties, pour les essais) }.
   */
  MF.boot = function (world, options = {}) {
    const params = new URLSearchParams(typeof location !== "undefined" ? location.search : "");
    const profile = loadProfile();
    if (options.name) profile.name = options.name;
    if (options.color) profile.color = options.color;
    if (options.kit) profile.kit = MF.laptops.valid(options.kit);
    let active = null;
    let seated = null; // place où je suis assis (espace de travail), ou null
    const started = performance.now();

    // avant le réseau (qui dit « au revoir » en fermant la page) : rendre la main si on était l'hôte
    if (typeof addEventListener === "function")
      addEventListener("pagehide", () => {
        try {
          if (active) active.session.leave();
        } catch (e) {}
      });
    const net = MF.Net.create({ name: profile.name, color: profile.color, kit: profile.kit, bio: profile.bio, room: options.room !== undefined ? options.room : params.get("salon"), rtc: options.rtc, relayUrls: options.relayUrls, turn: options.turn });
    const presence = MF.Presence.create({ net, world });
    const sessions = MF.Sessions.create({ net, presence, now: options.now });
    const input = MF.Input.create({ dom: world.dom, mobile: world.mobile });
    const hud = MF.Hud.create({ dom: world.dom, mobile: world.mobile });
    hud.setSound(!MF.sfx.muted);
    hud.setMusic(MF.music.on);
    const root = MF.group({ name: "Fete_du_Moulin" });
    world.scene.add(root);
    // planchers praticables, lieux où l'on peut agir (s'asseoir, monter dans un manège…), décor
    MF.decks.install(world);
    const places = MF.Places.create();
    let site = null;
    try {
      site = MF.site.build({ world, root, places, presence, hud, net }) || null;
    } catch (error) {
      console.error("[Fête du Moulin] décor", error);
    }
    // mon ordinateur, porté dans le dos
    const wear = () => world.player.wear && world.player.wear(MF.laptops.backpack(net.self.kit));
    wear();

    /* ---------------------------------------------------------------- les jeux */
    const defs = MF.games.slice().sort((a, b) => (ORDER.indexOf(a.id) + 99) % 99 - (ORDER.indexOf(b.id) + 99) % 99);
    // top 10 de chaque jeu : gardés par le site (/api/scores), le navigateur et les joueurs présents
    const scores = MF.Scores.create({ net, defs, url: options.scoresUrl !== undefined ? options.scoresUrl : MF.assets && MF.assets.scores });
    let fresh = null; // { key, rank, until } : mon record tout juste inscrit
    const entries = defs.map((def) => {
      const session = sessions.get(def.id, def);
      const group = MF.group({ name: "Jeu_" + def.id, parent: root });
      const entry = { def, session, group, instance: {}, broken: false, live: false };
      const ctx = {
        MF,
        THREE: world.THREE,
        world,
        def,
        group,
        camera: world.camera,
        session,
        net,
        presence,
        input,
        hud,
        sponsors: MF.sponsors,
        sfx: MF.sfx,
        self: net.self,
        active: () => active === entry,
        playing: () => active === entry && !!session.state && session.state.phase === "run" && session.inRoster() && !session.myResult,
      };
      entry.ctx = ctx;
      try {
        group.add(MF.freeze(MF.site.kiosk(def, world)));
        if (def.board && MF.site.hall) entry.hall = MF.site.hall(def, world, scores, group);
        entry.instance = def.create(ctx) || {};
      } catch (error) {
        entry.broken = true;
        console.error("[Fête du Moulin] le jeu « " + def.id + " » n'a pas démarré", error);
      }
      session.onChange((state, prev) => {
        call(entry, "onPhase", state, prev);
        // fin de partie : mon résultat tente sa chance au top 10
        if (state && state.phase === "results" && (!prev || prev.phase !== "results") && session.inRoster()) {
          const done = scores.submit(def, state.opts, state.results[net.self.uid], net.self);
          if (done) {
            fresh = { key: done.key, rank: done.rank, until: performance.now() + 15000 };
            if (entry === active) {
              hud.flash("NEW RECORD · #" + done.rank + " ON THE WALL, FOREVER", { color: MF.PAL.yellow, hold: 4 });
              setTimeout(() => MF.sfx.play("bravo"), 700);
            }
          }
        }
        if (entry === active) syncPhase(entry, state, prev);
      });
      return entry;
    });
    function call(entry, method, ...args) {
      if (entry.broken || typeof entry.instance[method] !== "function") return undefined;
      try {
        return entry.instance[method](...args);
      } catch (error) {
        console.error("[Fête du Moulin] " + entry.def.id + "." + method, error);
        return undefined;
      }
    }
    const find = (id) => entries.find((e) => e.def.id === id);

    /* ---------------------------------------------------------------- entrer dans un jeu, en sortir */
    function placeSelf() {
      if (!active) return;
      const i = Math.max(0, active.session.slot());
      if (active.slot === i) return;
      active.slot = i;
      presence.setSpot(MF.site.spot(active.def.station, i));
    }
    function enter(id) {
      const e = find(id);
      if (!e || e.broken) return false;
      if (active === e) return true;
      if (active) leave();
      if (seated) stand();
      if (world.player.walk) world.player.walk();
      world.player.setEnabled(false);
      active = e;
      e.slot = -1;
      world.dom.classList.add("fete-in-game");
      hud.clearGame();
      hud.prompt(null);
      hud.mode("lobby");
      e.session.join();
      placeSelf();
      call(e, "enter");
      syncPhase(e, e.session.state, null);
      refreshCard();
      MF.sfx.play("clic");
      world.invalidate();
      return true;
    }
    function leave() {
      const e = active;
      if (!e) return;
      call(e, "leave");
      e.session.leave();
      active = null;
      input.release();
      presence.setSpot(null);
      hud.clearGame();
      hud.mode("walk");
      lastCount = null;
      world.dom.classList.remove("fete-in-game");
      world.player.setEnabled(true);
      const s = e.def.station;
      world.player.teleport(s.x, s.z, s.heading || 0);
      world.invalidate();
    }
    function syncPhase(e, state, prev) {
      if (!state || state.phase === "lobby") hud.mode("lobby");
      else if (state.phase === "results") {
        hud.mode("results");
        if (!prev || prev.phase !== "results") MF.sfx.play(state.ranking[0] === net.self.uid ? "bravo" : e.session.inRoster() ? "perdu" : "ting");
      } else hud.mode(e.session.inRoster() ? "run" : "watch");
      refreshCard();
    }

    /* ---------------------------------------------------------------- interface */
    function cardModel(e) {
      const s = e.session, st = s.state, def = e.def;
      const base = { icon: def.icon, title: def.title, blurb: def.blurb };
      const players = s.players().map((p) => ({ name: p.name, color: p.color, self: p.self, state: p.state }));
      if (st && st.phase === "results") {
        return Object.assign(base, {
          kind: "results",
          rows: st.ranking.map((uid, i) => {
            const p = st.roster.find((q) => q.uid === uid) || { name: "?", color: "#888888" };
            const r = st.results[uid] || { dnf: true };
            return { pos: i + 1, name: p.name, color: p.color, self: uid === net.self.uid, text: r.dnf ? "did not finish" : def.describe ? def.describe(r, st.opts) : "" };
          }),
        });
      }
      if (st && st.phase !== "lobby") {
        if (s.inRoster()) return null; // en pleine partie : pas de carte
        return Object.assign(base, { kind: "watch", players, wait: "Game in progress: you'll play the next one." });
      }
      const n = players.length;
      return Object.assign(base, {
        kind: "lobby",
        players,
        help: def.help,
        options: (def.options || []).map((o) => ({ key: o.key, label: o.label, values: o.values.map((v) => ({ value: v, text: o.format ? o.format(v) : String(v), on: !!st && st.opts[o.key] === v })) })),
        canStart: !!st && n >= (def.minPlayers || 1),
        startText: n > 1 ? "Start with " + Math.min(n, def.maxPlayers || 8) + " players" : "Play solo",
        wait: !st
          ? "Joining the game…"
          : n < (def.minPlayers || 1)
            ? "At least " + def.minPlayers + " players needed."
            : n > (def.maxPlayers || 8)
              ? "The first " + def.maxPlayers + " play, the others watch."
              : n === 1
                ? "Other players can join until the game starts."
                : "",
      });
    }
    function refreshCard() {
      hud.card(active ? cardModel(active) : null);
      // le top 10 du jeu, pour les réglages en cours : visible dans la salle d'attente et pendant la partie
      const table = active && active.def.board ? scores.table(active.def, active.session.state ? active.session.state.opts : undefined) : null;
      if (fresh && performance.now() > fresh.until) fresh = null;
      hud.top10(
        table && {
          variant: table.variant || table.label,
          rows: table.rows.map((r, i) => ({ pos: i + 1, name: r.n, color: r.c, text: table.text(r), self: r.n.toLowerCase() === net.self.name.toLowerCase() })),
          fresh: fresh && fresh.key === table.key ? fresh.rank : 0,
        },
      );
    }

    /* ---------------------------------------------------------------- s'asseoir, se lever (espace de travail) */
    function sit(seat) {
      if (active) leave();
      if (seated) stand();
      if (world.player.walk) world.player.walk();
      world.player.setEnabled(false);
      seated = seat;
      presence.setSeat({ x: seat.x, y: seat.y, z: seat.z, heading: seat.heading });
      world.dom.classList.add("fete-in-game");
      hud.prompt(null);
      hud.seat({ bio: net.self.bio });
      MF.sfx.play("clic");
      world.invalidate();
    }
    function stand() {
      if (!seated) return;
      const s = seated;
      seated = null;
      presence.setSeat(null);
      hud.seat(null);
      world.dom.classList.remove("fete-in-game");
      world.player.setEnabled(true);
      if (s.exit) world.player.teleport(s.exit.x, s.exit.z, s.heading);
      else world.player.teleport(s.x - Math.sin(s.heading) * 0.9, s.z - Math.cos(s.heading) * 0.9, s.heading);
      world.invalidate();
    }
    const doing = (game, state) => {
      const e = game && find(game);
      if (!e) return "walking around";
      return (state === "play" ? "playing: " : state === "watch" ? "watching: " : state === "done" ? "finished: " : "waiting for players: ") + e.def.title;
    };
    function netText(st) {
      if (st.direct === "arrêt") return "Playing between tabs of this browser only.";
      if (st.direct === "chargement") return "Connecting to other players…";
      if (st.direct === "indisponible") return "Direct connection unavailable: you play solo or between tabs of this browser.";
      if (st.full) return "This room is full.";
      return st.relays.total ? "Peer-to-peer connection · " + st.relays.up + " of " + st.relays.total + " relays reachable" : "Looking for other players…";
    }
    function sponsorsModel() {
      const titles = Object.fromEntries(entries.map((e) => [e.def.id, e.def.title]));
      return {
        contact: MF.sponsors.contact(),
        slots: MF.sponsors.all().map((s) => ({ label: s.label, group: titles[s.game] || "Whole fair", taken: s.taken, name: s.name, url: s.url, price: s.price })),
      };
    }
    let uiTimer = 0;
    function refreshUi() {
      const st = net.status();
      hud.setRoom(st.label, net.peers.size + 1);
      hud.setGames(entries.filter((e) => !e.broken).map((e) => ({ id: e.def.id, title: e.def.title, icon: e.def.icon, blurb: e.def.blurb, players: e.session.players().length, phase: e.session.state ? e.session.state.phase : null })));
      if (hud.panel() === "players") {
        const me = presence.activity();
        hud.setPlayers({
          self: { name: net.self.name, color: net.self.color, kit: net.self.kit, bio: net.self.bio },
          players: [{ name: net.self.name, color: net.self.color, self: true, doing: doing(me.game, me.state) }].concat(presence.list().map((r) => ({ name: r.peer.name, color: r.peer.color, self: false, doing: doing(r.game, r.state) }))),
          room: { label: st.label, isPrivate: st.isPrivate, code: st.code },
          net: netText(st),
        });
      }
      if (hud.panel() === "sponsors") hud.setSponsors(sponsorsModel());
      refreshCard();
      placeSelf();
      // un stand lointain n'est pas dessiné (le moulin est déjà lourd) : on le cache au-delà de sa portée
      const cam = world.camera.position;
      for (const e of entries) {
        const s = e.def.station;
        const near = e === active || Math.hypot(cam.x - s.x, cam.z - s.z) < (e.def.range || 85);
        if (e.group.visible !== near) {
          e.group.visible = near;
          world.invalidate();
        }
      }
      // invitations : un joueur attend des adversaires à un jeu
      if (!active)
        for (const r of presence.list()) {
          if (!r.game) r.invited = null;
          else if (r.state === "wait" && r.invited !== r.game && performance.now() - started > 4000) {
            r.invited = r.game;
            const e = find(r.game);
            if (e) hud.toast(r.peer.name + " is waiting for players: " + e.def.title, { hold: 7, action: { label: "Join", run: () => enter(e.def.id) } });
          }
        }
    }
    MF.sponsors.onChange(() => world.invalidate());

    function inviteLink() {
      const st = net.status();
      const url = new URL(location.href);
      url.search = "";
      url.hash = "";
      if (st.isPrivate) url.searchParams.set("salon", st.code);
      return url.href;
    }
    // lieux du menu : on y est porté d'un clic (debout, hors de tout jeu)
    const SPOTS = { deck: [30.3, 38, -Math.PI / 2], wheel: [-57.4, -68, -Math.PI / 2], carousel: [73.8, -12.2, 0], gate: [1.4, -81.5, 0] };
    hud.on((action, value) => {
      if (action === "spot" && SPOTS[value]) {
        if (active) leave();
        if (seated) stand();
        world.player.teleport(...SPOTS[value]);
        world.invalidate();
      } else if (action === "enter") enter(value);
      else if (action === "leave") leave();
      else if (action === "start") active && active.session.requestStart();
      else if (action === "replay") active && active.session.requestLobby();
      else if (action === "option") active && active.session.setOption(value.key, value.value);
      else if (action === "profile") {
        net.setProfile(value);
        saveProfile(net.self);
        if (value.kit !== undefined) wear();
        if (seated) presence.setSeat({ x: seated.x, y: seated.y, z: seated.z, heading: seated.heading });
      } else if (action === "place") places.run(value);
      else if (action === "stand") stand();
      else if (action === "music") {
        MF.music.setOn(value);
        hud.setMusic(MF.music.on);
      } else if (action === "sound") {
        MF.sfx.setMuted(!value);
        hud.setSound(value);
        if (value) MF.sfx.play("clic");
      } else if (action === "copy") {
        const link = inviteLink();
        const done = () => hud.toast("Link copied: send it to your friends");
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(link).then(done, () => hud.toast(link, { hold: 9 }));
        else hud.toast(link, { hold: 9 });
      } else if (action === "room") {
        if (active) leave();
        const code = MF.Net.cleanCode(value);
        if (value !== null && !code) return hud.toast("Give the private room a name (letters and digits)");
        net.switchRoom(code || null);
        try {
          const url = new URL(location.href);
          if (code) url.searchParams.set("salon", code);
          else url.searchParams.delete("salon");
          history.replaceState(null, "", url.href);
        } catch (e) {}
        hud.toast(code ? "Private room “" + code + "”: share the invite link" : "Back to the public room");
      } else if (action === "panel" && value === "sponsors") hud.setSponsors(sponsorsModel());
      refreshUi();
    });
    net.onJoin((peer, changed) => {
      if (!changed && performance.now() - started > 4000) hud.toast(peer.name + " joined the fair");
      world.invalidate();
    });
    net.onLeave((peer, why) => {
      if (why !== "changement de salon") hud.toast(peer.name + " left");
      world.invalidate();
    });

    // Clavier : E ou Entrée près d'un stand pour jouer ; Échap pour quitter un jeu.
    let nearDef = null, nearPlace = null;
    addEventListener(
      "keydown",
      (ev) => {
        if (ev.target && ev.target.matches && ev.target.matches("input, textarea, select")) return;
        const k = ev.key.toLowerCase();
        if (active && k === "escape") {
          ev.preventDefault();
          ev.stopPropagation();
          leave();
        } else if (seated && k === "escape") {
          ev.preventDefault();
          ev.stopPropagation();
          stand();
        } else if (!active && !seated && (nearDef || nearPlace) && (k === "e" || k === "enter") && !ev.repeat) {
          ev.preventDefault();
          ev.stopPropagation();
          if (nearDef) enter(nearDef.id);
          else places.run(nearPlace.id);
        }
      },
      true,
    );

    /* ---------------------------------------------------------------- boucle */
    let lastCount = null, lastFrame = 0;
    function tickNet(dt, time) {
      net.tick();
      const moved = presence.update(dt, time);
      sessions.tick();
      return moved;
    }
    function update(dt, time) {
      lastFrame = performance.now();
      let dirty = tickNet(dt, time);
      input.update();
      for (const e of entries) {
        if (e.broken) continue;
        const live = e === active || e.session.players().length > 0;
        if (live) {
          if (call(e, "update", dt, time)) dirty = true;
        } else if (e.live) {
          call(e, "idle");
          dirty = true;
        }
        e.live = live;
      }
      if (active) {
        dirty = true;
        // décompte du départ
        const s = active.session, st = s.state;
        let text = null;
        if (st && (st.phase === "countdown" || st.phase === "run") && s.inRoster()) {
          const t = s.time();
          if (t < 0) {
            const n = Math.ceil(-t);
            text = n > 3 ? "" : String(n);
          } else if (t < 0.9) text = "Go!";
        }
        if (text !== lastCount) {
          lastCount = text;
          hud.countdown(text);
          if (text) MF.sfx.play(text === "Go!" ? "top" : "bip");
        }
      } else if (seated) {
        // assis : vue par-dessus l'épaule, vers l'étang (ou vers la vallée, depuis un manège)
        dirty = true;
        nearDef = nearPlace = null;
        if (seated.moving) presence.setSeat({ x: seated.x, y: seated.y, z: seated.z, heading: seated.heading }, true);
        const h = seated.heading, sway = Math.sin(time * 0.22) * 0.25;
        const back = seated.back ?? 2.7, up = seated.up ?? 1.75, side = seated.moving ? 0 : 0.9 + sway;
        const to = seated.look || { x: seated.x + Math.sin(h) * 9, y: seated.y + 0.7, z: seated.z + Math.cos(h) * 9 };
        MF.cam.set(world.camera, { x: seated.x - Math.sin(h) * back + Math.cos(h) * side, y: seated.y + up, z: seated.z - Math.cos(h) * back - Math.sin(h) * side }, to, seated.moving ? 62 : 52);
      } else {
        // près d'un stand ou d'un lieu ? (seulement en se promenant avec le personnage)
        let best = null, bd = NEAR, place = null;
        if (!world.player.walking || world.player.walking()) {
          const p = world.player.pose();
          for (const e of entries) {
            if (e.broken) continue;
            const d = Math.hypot(p.x - e.def.station.x, p.z - e.def.station.z);
            if (d < bd) {
              bd = d;
              best = e.def;
            }
          }
          if (!best) place = places.near(p.x, p.z);
        }
        nearDef = best;
        nearPlace = place;
        hud.prompt(best || (place && { id: place.id, icon: place.icon, title: place.title, verb: place.verb, action: "place" }));
      }
      if (site && site.update && site.update(dt, time, world.camera)) dirty = true;
      uiTimer -= dt;
      if (uiTimer <= 0) {
        uiTimer = 0.25;
        refreshUi();
      }
      return dirty;
    }
    // Onglet en arrière-plan : la boucle d'images s'arrête, mais on reste présent pour les autres.
    setInterval(() => {
      if (performance.now() - lastFrame > 700) tickNet(0, performance.now() / 1000);
    }, 1000);

    MF.sponsors.load();
    const app = { world, net, presence, sessions, input, hud, entries, root, enter, leave, update, find, active: () => active, inviteLink, scores, places, sit, stand, seated: () => seated, site };
    scores.sync();
    setInterval(() => scores.sync(), 120000);
    MF.app = app;

    // Première visite : pseudo et couleur ; puis, avec ?jeu=…, on va droit au jeu demandé.
    const go = () => {
      const wanted = options.game || params.get("jeu");
      if (wanted && find(wanted)) enter(wanted);
    };
    if (!profile.known && options.welcome !== false) {
      hud.welcome(profile, (p) => {
        net.setProfile(p);
        saveProfile(net.self);
        wear();
        MF.sfx.play("ting");
        MF.music.wanted = true;
        MF.music.start();
        go();
      });
    } else go();
    refreshUi();
    return app;
  };
})();
