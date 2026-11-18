// La Fête du Moulin — réseau multijoueur sans serveur.
//
// Tous ceux qui ouvrent /moulin2 se retrouvent dans un « salon ». Les messages voyagent par deux
// chemins, utilisés ensemble :
//  - « onglets » (BroadcastChannel) : les onglets d'un même navigateur se voient tout de suite, même
//    hors connexion ; c'est aussi ce qui sert aux essais automatiques ;
//  - « direct » (WebRTC, bibliothèque Trystero) : les navigateurs de joueurs différents se trouvent
//    grâce à des relais publics (aucun serveur à nous), puis se parlent directement, de pair à pair.
//
// Salons : sans rien préciser, on entre dans un salon public (« public-1 », puis « public-2 » quand le
// premier est plein…). L'adresse /moulin2/?salon=mon-code ouvre un salon privé : tous ceux qui ont
// ce lien jouent ensemble.
//
//   const net = MF.Net.create({ name, color, room?, rtc?: false, relayUrls?, cap? });
//   net.self → { uid, name, color }      net.peers → Map(uid → { uid, name, color, ... })
//   net.on(type, (data, peer) => …)      net.send(type, data)      net.sendTo(uid, type, data)
//   net.onJoin(fn(peer)) ; net.onLeave(fn(peer)) ; net.onStatus(fn(status))
//   net.status() → { room, label, isPrivate, online, relays, peers, full }
//   net.setProfile({ name, color }) ; net.switchRoom(code | null) ; net.tick(now) ; net.close()
//
// Chaque message porte l'identifiant de son auteur (uid, tiré au hasard à l'ouverture de la page) et un
// numéro d'ordre : un message reçu deux fois (par les deux chemins) n'est traité qu'une fois.
(function () {
  "use strict";
  const MF = (globalThis.MoulinFete = globalThis.MoulinFete || {});
  const PROTO = 1; // version du protocole : deux versions différentes ne se parlent pas
  const APP_ID = "moulin-saint-christophe.fete/v" + PROTO;
  const PEER_TIMEOUT = 6500; // ms sans nouvelles avant de considérer un joueur parti
  const HEARTBEAT = 1500;

  const cleanCode = (code) =>
    String(code || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32);

  /* ------------------------------------------------------------------ chemin « onglets » */
  function tabsTransport(BC) {
    let channel = null, onMessage = null;
    return {
      name: "onglets",
      available: typeof BC === "function",
      start(roomId, handler) {
        this.stop();
        onMessage = handler;
        if (!this.available) return;
        channel = new BC("fete-moulin:" + roomId);
        channel.onmessage = (ev) => onMessage && onMessage(ev.data, null);
      },
      sendAll(env) {
        if (channel) channel.postMessage(env);
      },
      stop() {
        if (channel) {
          try {
            channel.close();
          } catch (e) {}
        }
        channel = null;
      },
    };
  }

  /* ------------------------------------------------------------------ chemin « direct » (WebRTC) */
  // La bibliothèque est chargée à la demande (fichier séparé) : le jeu démarre sans elle et reste
  // jouable seul ou entre onglets si elle est indisponible.
  let p2pLoading = null;
  function loadP2P() {
    if (globalThis.MoulinP2P) return Promise.resolve(globalThis.MoulinP2P);
    if (p2pLoading) return p2pLoading;
    const url = MF.assets && MF.assets.p2p;
    if (!url || url.startsWith("{{") || typeof document === "undefined") return Promise.reject(new Error("bibliothèque P2P absente"));
    p2pLoading = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      // le fichier est à côté des autres ressources (la page lit tout depuis la racine du site)
      s.src = new URL(url, document.baseURI).href;
      s.async = true;
      s.onload = () => (globalThis.MoulinP2P ? resolve(globalThis.MoulinP2P) : reject(new Error("bibliothèque P2P vide")));
      s.onerror = () => reject(new Error("bibliothèque P2P indisponible"));
      document.head.appendChild(s);
    });
    return p2pLoading;
  }
  function directTransport(options) {
    let room = null, action = null, generation = 0;
    const t = {
      name: "direct",
      state: "arrêt", // arrêt | chargement | recherche | prêt | indisponible
      roomId: null,
      full: false,
      /**
       * base : nom du salon ; shard : true pour un salon public (on passe au suivant quand il est plein).
       * handlers : { message(env, addr), up(addr), down(addr), room(id, index), state() }
       */
      start(base, shard, handlers) {
        this.stop();
        const gen = ++generation;
        t.state = "chargement";
        handlers.state();
        loadP2P().then(
          (lib) => {
            if (gen !== generation) return;
            let index = 1;
            const join = () => {
              if (gen !== generation) return;
              const id = shard ? base + "-" + index : base;
              t.roomId = id;
              t.full = false;
              t.state = "recherche";
              handlers.room(id, index);
              handlers.state();
              const config = { appId: APP_ID, identity: "none", maxUsers: options.cap || 12 };
              if (options.relayUrls) config.relayConfig = { urls: options.relayUrls, warnOnRelayFailure: false };
              else config.relayConfig = { warnOnRelayFailure: false };
              if (options.turn) config.turnConfig = options.turn;
              try {
                room = lib.joinRoom(config, id);
              } catch (error) {
                t.state = "indisponible";
                handlers.state();
                return;
              }
              const mine = room;
              action = room.makeAction("m");
              action.onMessage((data, context) => gen === generation && mine === room && handlers.message(data, context.peerId));
              room.onPeerJoin((context) => {
                if (gen !== generation || mine !== room) return;
                t.state = "prêt";
                handlers.up(context.peerId);
                handlers.state();
              });
              room.onPeerLeave((context) => gen === generation && mine === room && handlers.down(context.peerId));
              room.onError((error) => {
                if (gen !== generation || mine !== room) return;
                if (error && error.code === "room-full" && Object.keys(room.getPeers()).length === 0) {
                  // refusé à la porte : salon public suivant, ou salon privé complet
                  if (shard && index < 40) {
                    index++;
                    const old = room;
                    room = action = null;
                    Promise.resolve(old.leave()).catch(() => {}).then(join);
                  } else {
                    t.full = true;
                    handlers.state();
                  }
                }
              });
              Promise.resolve(room.ready).then(
                () => {
                  if (gen === generation && mine === room && t.state === "recherche") {
                    t.state = "prêt";
                    handlers.state();
                  }
                },
                () => {},
              );
            };
            join();
          },
          () => {
            if (gen !== generation) return;
            t.state = "indisponible";
            handlers.state();
          },
        );
      },
      sendAll(env, addrs) {
        if (!action || !addrs.length) return;
        action.send(env, { target: addrs }).catch(() => {});
      },
      relays() {
        try {
          const sockets = (globalThis.MoulinP2P && globalThis.MoulinP2P.getRelaySockets && globalThis.MoulinP2P.getRelaySockets()) || {};
          const list = Object.values(sockets);
          return { total: list.length, up: list.filter((s) => s && s.readyState === 1).length };
        } catch (e) {
          return { total: 0, up: 0 };
        }
      },
      stop() {
        generation++;
        const old = room;
        room = action = null;
        t.roomId = null;
        t.state = "arrêt";
        if (old) Promise.resolve(old.leave()).catch(() => {});
      },
    };
    return t;
  }

  /* ------------------------------------------------------------------ le réseau */
  function create(options = {}) {
    const BC = options.BroadcastChannel || globalThis.BroadcastChannel;
    const now = options.now || (() => Date.now());
    // kit : l'ordinateur choisi ; bio : « ce sur quoi je travaille » (affiché quand on est assis)
    const cleanBio = (v) => String(v ?? "").replace(/[\u0000-\u001f\u007f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 40);
    const cleanKit = (v) => (/^[a-z0-9-]{1,16}$/.test(v) ? v : "");
    const self = { uid: options.uid || MF.uid(10), name: options.name || "Miller", color: options.color || MF.PLAYER_COLORS[0], kit: cleanKit(options.kit), bio: cleanBio(options.bio) };
    const card = (ask) => ({ name: self.name, color: self.color, kit: self.kit, bio: self.bio, v: PROTO, ask: !!ask });
    const peers = new Map();
    const handlers = new Map();
    const joinFns = [], leaveFns = [], statusFns = [];
    const tabs = tabsTransport(BC);
    const direct = options.rtc === false ? null : directTransport(options);
    let counter = 0, lastSent = 0, closed = false;
    let base = null, isPrivate = false, roomId = null, roomIndex = 1;

    const emit = (list, ...args) => {
      for (const fn of list.slice()) {
        try {
          fn(...args);
        } catch (error) {
          console.error("[Fête du Moulin] réseau", error);
        }
      }
    };
    const fireStatus = () => emit(statusFns, net.status());

    function envelope(type, data, to) {
      const env = { u: self.uid, n: ++counter, t: type, d: data === undefined ? null : data };
      if (to) env.to = to;
      lastSent = now();
      return env;
    }
    function dispatch(env, to) {
      // onglets : un seul envoi atteint tous les onglets (le destinataire éventuel est dans l'enveloppe)
      tabs.sendAll(env);
      if (!direct) return;
      // direct : seulement vers ceux qu'on ne joint pas déjà par les onglets
      const addrs = [];
      for (const p of peers.values()) {
        if (to && p.uid !== to) continue;
        if (p.links.direct && !p.links.tabs) addrs.push(p.links.direct);
      }
      // pairs directs pas encore identifiés (leur premier « bonjour » n'est pas arrivé)
      if (!to) for (const addr of pendingDirect) if (!addrs.includes(addr)) addrs.push(addr);
      direct.sendAll(env, addrs);
    }
    const pendingDirect = new Set();

    function hello(ask, to) {
      dispatch(envelope("hello", card(ask), to), to);
    }
    function dropPeer(peer, why) {
      if (!peers.delete(peer.uid)) return;
      emit(leaveFns, peer, why);
      fireStatus();
    }
    function receive(env, addr, via) {
      if (closed || !env || typeof env !== "object" || typeof env.u !== "string" || env.u === self.uid) return;
      if (env.to && env.to !== self.uid) return;
      let peer = peers.get(env.u);
      const t = now();
      if (!peer) {
        if (env.t !== "hello") {
          // inconnu : on lui demande de se présenter (une fois par seconde au plus)
          if (!receive.asked) receive.asked = new Map();
          if (t - (receive.asked.get(env.u) || 0) > 1000) {
            receive.asked.set(env.u, t);
            if (via === "direct" && addr) {
              pendingDirect.add(addr);
              direct.sendAll(envelope("hello", card(true), env.u), [addr]);
            } else hello(true, env.u);
          }
          return;
        }
        if (!env.d || env.d.v !== PROTO) return; // autre version du jeu : on s'ignore
        peer = { uid: env.u, name: "", color: "#888888", kit: "", bio: "", links: { tabs: false, direct: null }, seen: { tabs: 0, direct: 0 }, n: 0, joined: t, data: {} };
        peers.set(peer.uid, peer);
        peer.fresh = true;
      }
      if (via === "tabs") {
        peer.links.tabs = true;
        peer.seen.tabs = t;
      } else if (addr) {
        peer.links.direct = addr;
        peer.seen.direct = t;
        pendingDirect.delete(addr);
      }
      peer.last = t;
      if (env.t === "hello") {
        const d = env.d || {};
        const kit = cleanKit(d.kit), bio = cleanBio(d.bio);
        const changed = peer.name !== d.name || peer.color !== d.color || peer.kit !== kit || peer.bio !== bio;
        peer.name = String(d.name || "Miller").slice(0, 18);
        peer.color = /^#[0-9a-f]{6}$/i.test(d.color) ? d.color : "#888888";
        peer.kit = kit;
        peer.bio = bio;
        if (peer.fresh) {
          peer.fresh = false;
          emit(joinFns, peer);
          fireStatus();
        } else if (changed) emit(joinFns, peer, true);
        if (d.ask) hello(false, peer.uid);
        return;
      }
      if (env.t === "bye") return dropPeer(peer, "parti");
      if (typeof env.n === "number") {
        if (env.n <= peer.n) return; // déjà reçu par l'autre chemin
        peer.n = env.n;
      }
      if (env.t === "ping") return;
      const list = handlers.get(env.t);
      if (list) emit(list, env.d, peer);
    }

    function startRoom() {
      // onglets : même nom que le salon réellement rejoint (suit les changements de salon public)
      tabs.start(roomId, (env) => receive(env, null, "tabs"));
      hello(true);
      fireStatus();
    }
    function enter(code) {
      for (const p of [...peers.values()]) dropPeer(p, "changement de salon");
      pendingDirect.clear();
      const clean = cleanCode(code);
      isPrivate = !!clean;
      base = isPrivate ? "prive-" + clean : "public";
      roomIndex = 1;
      roomId = isPrivate ? base : base + "-1";
      if (direct) {
        direct.start(base, !isPrivate, {
          message: (env, addr) => receive(env, addr, "direct"),
          up(addr) {
            pendingDirect.add(addr);
            direct.sendAll(envelope("hello", card(true)), [addr]);
          },
          down(addr) {
            pendingDirect.delete(addr);
            for (const p of [...peers.values()])
              if (p.links.direct === addr) {
                p.links.direct = null;
                if (!p.links.tabs) dropPeer(p, "déconnecté");
              }
          },
          room(id, index) {
            if (id !== roomId) {
              // salon public plein : on a glissé vers le suivant
              for (const p of [...peers.values()]) dropPeer(p, "changement de salon");
              roomId = id;
              roomIndex = index;
              startRoom();
            }
          },
          state: fireStatus,
        });
      }
      startRoom();
    }

    const net = {
      self,
      peers,
      proto: PROTO,
      on(type, fn) {
        if (!handlers.has(type)) handlers.set(type, []);
        handlers.get(type).push(fn);
        return () => net.off(type, fn);
      },
      off(type, fn) {
        const list = handlers.get(type);
        if (list && list.includes(fn)) list.splice(list.indexOf(fn), 1);
      },
      send(type, data) {
        if (!closed) dispatch(envelope(type, data));
      },
      sendTo(uid, type, data) {
        if (!closed && peers.has(uid)) dispatch(envelope(type, data, uid), uid);
      },
      onJoin: (fn) => joinFns.push(fn),
      onLeave: (fn) => leaveFns.push(fn),
      onStatus: (fn) => statusFns.push(fn),
      setProfile(profile) {
        if (profile.name !== undefined) self.name = String(profile.name).trim().slice(0, 18) || "Miller";
        if (profile.color !== undefined) self.color = profile.color;
        if (profile.kit !== undefined) self.kit = cleanKit(profile.kit);
        if (profile.bio !== undefined) self.bio = cleanBio(profile.bio);
        hello(false);
      },
      status() {
        const relays = direct ? direct.relays() : { total: 0, up: 0 };
        return {
          room: roomId,
          label: isPrivate ? "Private room “" + base.slice(6) + "”" : "Public room #" + roomIndex,
          code: isPrivate ? base.slice(6) : null,
          isPrivate,
          direct: direct ? direct.state : "arrêt",
          online: !!direct && (direct.state === "prêt" || direct.state === "recherche"),
          full: !!direct && direct.full,
          relays,
          peers: peers.size,
        };
      },
      switchRoom(code) {
        enter(code);
      },
      /** À appeler régulièrement (chaque image ou chaque seconde) : battement de cœur et départs silencieux. */
      tick() {
        if (closed) return;
        const t = now();
        if (t - lastSent > HEARTBEAT) dispatch(envelope("ping", null));
        for (const p of [...peers.values()]) {
          if (p.links.tabs && t - p.seen.tabs > PEER_TIMEOUT) p.links.tabs = false;
          if (!p.links.tabs && !p.links.direct) dropPeer(p, "silencieux");
          else if (t - p.last > PEER_TIMEOUT * 2.5) dropPeer(p, "silencieux");
        }
      },
      close() {
        if (closed) return;
        try {
          dispatch(envelope("bye", null));
        } catch (e) {}
        closed = true;
        tabs.stop();
        if (direct) direct.stop();
      },
    };
    enter(options.room);
    if (typeof addEventListener === "function") addEventListener("pagehide", () => net.close());
    return net;
  }

  MF.Net = { create, cleanCode, PROTO, APP_ID };
})();
