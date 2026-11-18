// La Fête du Moulin — présence des joueurs : qui est là, où, et leurs personnages à l'écran.
//
// Chaque joueur envoie sa position plusieurs fois par seconde (dix fois en marchant, une fois à
// l'arrêt) avec ce qu'il est en train de faire (se promène, attend ou joue à tel jeu). Les autres le
// voient sous la forme d'un petit personnage à chapeau de paille, à sa couleur, avec son nom
// au-dessus de la tête. Pendant un jeu, le personnage se tient au poste que le jeu lui donne (les
// pilotes de voitures RC sont alignés au bord du circuit, par exemple).
//
//   const presence = MF.Presence.create({ net, world });
//   presence.update(dt, time)                      // chaque image
//   presence.setActivity(gameId | null, state)     // "wait" | "play" | "done" | null
//   presence.setSpot({ x, z, heading } | null)     // position imposée pendant un jeu
//   presence.of(uid) → { x, y, z, heading, game, state, … } | null       presence.list() → joueurs distants
//
//   MF.interp(n, anglesIdx?) : file d'attente de positions reçues, relues avec un léger retard pour un
//   mouvement fluide — it.push(time, [valeurs…]) ; it.sample(time, sortie) (voir les jeux de course).
(function () {
  "use strict";
  const MF = (globalThis.MoulinFete = globalThis.MoulinFete || {});

  /**
   * Interpolation d'états reçus par le réseau. n valeurs par état ; angles : indices des valeurs qui
   * sont des angles (interpolés par le plus court chemin). delay : retard de lecture (s).
   */
  MF.interp = function (n, angles = [], delay = 0.12) {
    const buf = []; // { t, v }
    let offset = null; // heure locale − heure de l'émetteur (lissée)
    return {
      /** t : heure de l'émetteur (s) ; local : heure locale de réception (s). */
      push(t, values, local) {
        const o = local - t;
        offset = offset === null || Math.abs(o - offset) > 1 ? o : offset + (o - offset) * 0.1;
        if (buf.length && t <= buf[buf.length - 1].t) return;
        buf.push({ t, v: values.slice(0, n) });
        if (buf.length > 12) buf.shift();
      },
      /** Remplit out (tableau de n valeurs) pour l'heure locale donnée ; renvoie false s'il n'y a rien. */
      sample(local, out) {
        if (!buf.length) return false;
        const t = local - offset - delay;
        let i = buf.length - 1;
        while (i > 0 && buf[i - 1].t > t) i--;
        const b = buf[i], a = buf[Math.max(0, i - 1)];
        let k = b.t > a.t ? (t - a.t) / (b.t - a.t) : 1;
        k = MF.clamp(k, 0, 1.6); // un peu d'extrapolation quand un message tarde
        for (let j = 0; j < n; j++) out[j] = angles.includes(j) ? a.v[j] + MF.angleDiff(a.v[j], b.v[j]) * k : a.v[j] + (b.v[j] - a.v[j]) * k;
        return true;
      },
      get age() {
        return buf.length ? buf[buf.length - 1].t : -Infinity;
      },
      clear() {
        buf.length = 0;
        offset = null;
      },
    };
  };

  /* ------------------------------------------------------------------ personnage des autres joueurs */
  const SKIN = "#e8b48c";
  function buildAvatar(color, kit) {
    const g = MF.group({ name: "Joueur_distant" });
    const body = MF.group({ parent: g });
    body.userData.live = true;
    const shirt = MF.mat(color, { unique: true });
    const legMat = MF.mat("#34435e");
    const legs = [], arms = [];
    for (const side of [-1, 1]) {
      const hip = MF.group({ x: side * 0.1, y: 0.84, parent: body });
      MF.box(0.15, 0.84, 0.17, legMat, { y: -0.42, parent: hip });
      MF.box(0.16, 0.08, 0.26, MF.PAL.ink, { y: -0.82, z: 0.04, parent: hip });
      legs.push(hip);
      const shoulder = MF.group({ x: side * 0.275, y: 1.36, parent: body });
      MF.box(0.11, 0.26, 0.13, shirt, { y: -0.12, parent: shoulder });
      MF.box(0.095, 0.3, 0.11, SKIN, { y: -0.39, parent: shoulder });
      arms.push(shoulder);
    }
    MF.box(0.42, 0.58, 0.25, shirt, { y: 1.12, parent: body });
    MF.sphere(0.165, SKIN, { y: 1.59, parent: body, seg: 12 });
    // chapeau de paille : large bord, calotte, ruban à la couleur du joueur
    MF.cyl(0.33, 0.33, 0.03, "#e9c46a", { y: 1.7, parent: body, seg: 16 });
    MF.cyl(0.15, 0.17, 0.13, "#e9c46a", { y: 1.77, parent: body, seg: 12 });
    MF.cyl(0.174, 0.174, 0.045, shirt, { y: 1.735, parent: body, seg: 12 });
    const shadow = MF.blob(0.42, 0.38);
    shadow.position.y = 0.03;
    g.add(shadow);
    const tag = MF.tag("", { scale: 0.8 });
    tag.position.y = 2.22;
    g.add(tag);
    // L'ordinateur du joueur : fermé dans le dos (bretelles), ou ouvert sur les genoux quand il est assis.
    const avatar = { group: g, body, legs, arms, tag, shirt, phase: 0, kit: null, pack: null, lap: null, sitting: false };
    avatar.setKit = function (id) {
      if (!MF.laptops) return;
      id = MF.laptops.valid(id);
      if (avatar.kit === id) return;
      avatar.kit = id;
      for (const old of [avatar.pack, avatar.lap]) if (old) MF.dispose(old);
      avatar.pack = MF.laptops.backpack(id);
      avatar.pack.position.set(0, 1.4, -0.125);
      body.add(avatar.pack);
      avatar.lap = MF.laptops.build(id, { open: 0.95 });
      avatar.lap.scale.setScalar(1.15);
      avatar.lap.rotation.y = Math.PI; // l'écran regarde le joueur
      avatar.lap.position.set(0, 0.93, 0.5);
      body.add(avatar.lap);
      avatar.setSit(avatar.sitting, true);
    };
    /** Assis (jambes allongées, bras vers le clavier, ordinateur ouvert) ou debout. */
    avatar.setSit = function (on, force) {
      if (avatar.sitting === !!on && !force) return;
      avatar.sitting = !!on;
      if (avatar.pack) avatar.pack.visible = !on;
      if (avatar.lap) avatar.lap.visible = !!on;
      body.position.y = on ? -0.42 : 0;
      shadow.visible = !on;
      for (const leg of legs) leg.rotation.x = on ? -1.42 : 0;
      for (const arm of arms) arm.rotation.x = on ? -1.05 : 0;
      tag.position.y = on ? 1.75 : 2.22;
    };
    avatar.setKit(kit);
    return avatar;
  }

  function create({ net, world }) {
    // world.headless (essais automatiques sans 3D) : on suit qui est là, sans dessiner personne
    const root = world.headless ? null : MF.group({ name: "Joueurs_de_la_fete" });
    if (root) world.scene.add(root);
    const remotes = new Map(); // uid → { peer, avatar, pos, target… }
    let activity = { game: null, state: null };
    let spot = null;
    let lastSend = 0, lastPose = null, sendTimer = 0;
    const out = [];

    function ensure(peer) {
      let r = remotes.get(peer.uid);
      if (!r) {
        const avatar = root ? buildAvatar(peer.color, peer.kit) : null;
        if (avatar) {
          avatar.group.visible = false;
          root.add(avatar.group);
        }
        r = { peer, avatar, x: 0, y: 0, z: 0, heading: 0, speed: 0, tx: 0, ty: 0, tz: 0, th: 0, has: false, game: null, state: null, hidden: false, color: peer.color, name: "" };
        remotes.set(peer.uid, r);
      }
      return r;
    }
    net.onJoin((peer) => {
      lastSend = 0; // le nouveau venu apprend tout de suite où je suis et ce que je fais
      const r = ensure(peer);
      if (r.color !== peer.color && r.avatar) {
        r.color = peer.color;
        r.avatar.shirt.color.copy(MF.color(peer.color));
      }
    });
    net.onLeave((peer) => {
      const r = remotes.get(peer.uid);
      if (!r) return;
      if (r.avatar) MF.dispose(r.avatar.group);
      remotes.delete(peer.uid);
      world.invalidate();
    });
    net.on("p", (d, peer) => {
      if (!Array.isArray(d)) return;
      const r = ensure(peer);
      r.tx = +d[0] || 0;
      r.ty = +d[1] || 0;
      r.tz = +d[2] || 0;
      r.th = +d[3] || 0;
      r.speed = +d[4] || 0;
      r.hidden = !!(d[5] & 4);
      r.sitting = !!(d[5] & 8);
      r.game = d[6] || null;
      r.state = d[7] || null;
      r.since = d[8] || 0;
      if (!r.has) {
        r.has = true;
        r.x = r.tx;
        r.y = r.ty;
        r.z = r.tz;
        r.heading = r.th;
      }
      peer.data.game = r.game;
      peer.data.state = r.state;
      peer.data.since = r.since;
    });

    // Assis à une place de l'espace de travail : on reste visible des autres, à sa place.
    let seat = null, selfAvatar = null;
    function localPose() {
      if (seat) return { x: seat.x, y: seat.y, z: seat.z, heading: seat.heading || 0, speed: 0, hidden: false, sitting: true };
      if (spot) return { x: spot.x, y: world.heightAt(spot.x, spot.z), z: spot.z, heading: spot.heading || 0, speed: 0, hidden: !!spot.hidden };
      const p = world.player.pose();
      return { x: p.x, y: p.y, z: p.z, heading: p.heading, speed: p.speed || 0, hidden: !p.visible };
    }

    const presence = {
      root,
      /** Facultatif : (joueur distant assis) → { x, y, z, heading } de sa place vue d'ici (manèges). */
      snap: null,
      activity: () => activity,
      setActivity(game, state) {
        if (activity.game !== game) activity.since = game ? Date.now() : 0;
        activity.game = game || null;
        activity.state = game ? state || "wait" : null;
        lastSend = 0;
      },
      setSpot(s) {
        spot = s || null;
        lastSend = 0;
      },
      /** S'asseoir en { x, y, z, heading } (null pour se lever) : mon personnage y est dessiné, ordinateur ouvert. */
      setSeat(s, keep) {
        const was = seat;
        seat = s || null;
        if (keep && was && seat) {
          // place qui bouge (manège) : on suit, sans rien reconstruire
          if (selfAvatar) {
            selfAvatar.group.position.set(seat.x, seat.y, seat.z);
            selfAvatar.body.rotation.y = seat.heading || 0;
          }
          return;
        }
        lastSend = 0;
        if (!root) return;
        if (seat && !selfAvatar) {
          selfAvatar = buildAvatar(net.self.color, net.self.kit);
          selfAvatar.tag.visible = false;
          root.add(selfAvatar.group);
        }
        if (selfAvatar) {
          selfAvatar.group.visible = !!seat;
          if (seat) {
            selfAvatar.shirt.color.copy(MF.color(net.self.color));
            selfAvatar.setKit(net.self.kit);
            selfAvatar.setSit(true);
            selfAvatar.group.position.set(seat.x, seat.y, seat.z);
            selfAvatar.body.rotation.y = seat.heading || 0;
          }
        }
        world.invalidate();
      },
      seat: () => seat,
      selfAvatar: () => selfAvatar,
      of(uid) {
        return remotes.get(uid) || null;
      },
      list() {
        return [...remotes.values()];
      },
      /** Joueurs (soi compris) inscrits à un jeu : [{ uid, name, color, state, since, self }] triés par arrivée. */
      inGame(game) {
        const list = [];
        if (activity.game === game) list.push({ uid: net.self.uid, name: net.self.name, color: net.self.color, state: activity.state, since: activity.since || 0, self: true });
        for (const r of remotes.values()) if (r.game === game) list.push({ uid: r.peer.uid, name: r.peer.name, color: r.peer.color, state: r.state, since: r.since || 0, self: false });
        return list.sort((a, b) => a.since - b.since || (a.uid < b.uid ? -1 : 1));
      },
      update(dt, time) {
        // envoi de ma position
        sendTimer -= dt;
        const p = localPose();
        const moved = !lastPose || Math.hypot(p.x - lastPose.x, p.z - lastPose.z) > 0.02 || Math.abs(MF.angleDiff(p.heading, lastPose.heading)) > 0.03;
        const now = performance.now();
        if ((moved && now - lastSend > 100) || now - lastSend > 1000) {
          lastSend = now;
          lastPose = p;
          const r2 = (v) => Math.round(v * 100) / 100;
          net.send("p", [r2(p.x), r2(p.y), r2(p.z), r2(p.heading), r2(p.speed), (p.hidden ? 4 : 0) | (p.sitting ? 8 : 0), activity.game, activity.state, activity.since || 0]);
        }
        // personnages des autres
        let moving = false;
        for (const r of remotes.values()) {
          const a = r.avatar;
          if (!a) continue;
          const show = r.has && !r.hidden;
          if (a.group.visible !== show) {
            a.group.visible = show;
            moving = true;
          }
          if (!show) continue;
          const dx = r.tx - r.x, dz = r.tz - r.z;
          const dist = Math.hypot(dx, dz);
          if (dist > 12) {
            r.x = r.tx;
            r.z = r.tz;
            r.y = r.ty;
            r.heading = r.th;
          } else {
            const k = 1 - Math.exp(-11 * dt);
            r.x += dx * k;
            r.z += dz * k;
            r.y += (r.ty - r.y) * k;
            r.heading = MF.dampAngle(r.heading, r.th, 10, dt);
          }
          if (r.sitting && presence.snap) {
            // assis dans un manège : à sa place telle qu'on la voit d'ici
            const at = presence.snap(r);
            if (at) {
              r.x = at.x;
              r.y = at.y;
              r.z = at.z;
              r.heading = at.heading || 0;
            }
          }
          const step = Math.min(dist, Math.hypot(dx, dz) * (1 - Math.exp(-11 * dt)));
          if (dist > 0.01) moving = true;
          a.group.position.set(r.x, r.y, r.z);
          a.body.rotation.y = r.heading;
          // marche : jambes et bras en opposition, d'après la distance parcourue
          if (a.kit !== MF.laptops.valid(r.peer.kit)) {
            a.setKit(r.peer.kit);
            moving = true;
          }
          if (a.sitting !== !!r.sitting) {
            a.setSit(r.sitting);
            moving = true;
          }
          if (r.sitting) {
            // il tape : les avant-bras s'agitent un peu
            a.phase += dt * 9;
            a.arms[0].rotation.x = -1.05 + Math.sin(a.phase) * 0.06;
            a.arms[1].rotation.x = -1.05 + Math.sin(a.phase * 1.3 + 1) * 0.06;
            moving = true;
          } else {
            const walking = dist > 0.03 ? 1 : 0;
            a.phase += step * 3.4;
            const swing = Math.sin(a.phase) * 0.62 * walking;
            a.legs[0].rotation.x = swing;
            a.legs[1].rotation.x = -swing;
            a.arms[0].rotation.x = -swing * 0.8;
            a.arms[1].rotation.x = swing * 0.8;
          }
          const label = r.sitting && r.peer.bio ? r.peer.name + " · " + r.peer.bio : r.peer.name;
          if (r.name !== label) {
            r.name = label;
            a.tag.userData.set(label);
          }
          if (r.color !== r.peer.color) {
            r.color = r.peer.color;
            a.shirt.color.copy(MF.color(r.peer.color));
          }
        }
        if (selfAvatar && seat) {
          // moi, assis : je tape aussi
          selfAvatar.phase += dt * 9;
          selfAvatar.arms[0].rotation.x = -1.05 + Math.sin(selfAvatar.phase) * 0.06;
          selfAvatar.arms[1].rotation.x = -1.05 + Math.sin(selfAvatar.phase * 1.3 + 1) * 0.06;
          moving = true;
        }
        return moving;
      },
    };
    return presence;
  }

  MF.Presence = { create, buildAvatar };
})();
