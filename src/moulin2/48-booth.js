// La Fête du Moulin — le socle commun des baraques « à score » (chamboule-tout, taupes, skee-ball…).
//
// Une baraque se décrit dans son propre repère : l'origine est au sol, au centre du stand, +z vers
// le public (le comptoir), −z vers le fond, +x à la droite du joueur, y vers le haut. MF.booth
// s'occupe de tout le reste : la baraque en 3D, la place du joueur, le tableau du top 10, la caméra
// au comptoir, le viseur (souris, doigt ou flèches), le chrono, le score en direct entre joueurs,
// l'envoi du résultat.
//
//   MF.booth({
//     id, title, icon, color, blurb, help, hint, touchHint,
//     at: { x, z, face },          // centre de la baraque ; face = cap du comptoir (vers le public)
//     stall: { w, d, h, colors } | false,
//     duration,                    // secondes ; absent : le jeu décide de la fin (b.finish())
//     cam: { y, z, look: [x, y, z], fov }, stats: [{ key, label }], button: "THROW",
//     before(ctx, toWorld),        // facultatif : planchers et pontons à poser avant tout
//     hall: [x, z],                // facultatif : place du tableau du top 10, dans le repère du stand
//     setup(b) → { reset(b), update(b), hud?(b), result?(b), camX?(b), view?(b, de, vers) }
//   })
//
// L'objet b (donné à setup puis à chaque image) :
//   b.decor  groupe du décor fixe (fusionné après setup)      b.live   groupe des objets mobiles
//   b.level  lancers déjà faits dans la partie : b.charge accélère avec lui (spec.ramp : pente, 0,11 par défaut)
//   b.ray    rayon du viseur { o, d } dans le repère du stand   b.aim    viseur à l'écran (−1…1)
//   b.press / b.hold / b.release   clic, doigt ou Espace         b.playing  la partie court
//   b.tap    "L" ou "R" à l'instant d'une frappe à gauche ou à droite (flèches, ou côté du clic)
//   b.t, b.dt, b.time, b.left      heure de partie, pas, horloge, secondes restantes
//   b.score, b.add(points, texte?, point?)   score et petit « +10 » qui s'envole
//   b.rand()  hasard commun à tous les joueurs (graine de la partie)
//   b.charge(vitesse) → puissance au relâchement (sinon null) ; jauge affichée pendant l'appui
//   b.fly(objet, de, vers, flèche, durée, fin)   vol en cloche d'un projectile
//   b.confetti(x, y, z, n)   b.others() → joueurs et scores   b.finish()   b.ground(x, z) → hauteur du terrain
(function () {
  "use strict";
  const MF = globalThis.MoulinFete;

  MF.booth = function (spec) {
    const A = spec.at, face = A.face;
    const S = Object.assign({ w: 4.2, d: 3.2, h: 2.6 }, spec.stall || spec.size || {}); // spec.size : emprise d'un jeu sans baraque
    const sin = Math.sin(face), cos = Math.cos(face);
    const toWorld = (lx, lz) => ({ x: A.x + cos * lx + sin * lz, z: A.z - sin * lx + cos * lz });
    const stand = toWorld(0, S.d / 2 + 1.8), hallAt = spec.hall ? toWorld(spec.hall[0], spec.hall[1]) : toWorld(S.w / 2 + 0.8, S.d / 2 + 0.5);
    const DUR = spec.duration || 0;
    const CAM = Object.assign({ x: 0, y: 1.62, z: S.d / 2 + 1.8, look: [0, 1.25, -S.d / 2], fov: 46 }, spec.cam);

    MF.registerGame({
      id: spec.id,
      title: spec.title,
      icon: spec.icon,
      color: spec.color,
      blurb: spec.blurb,
      station: { x: stand.x, z: stand.z, heading: face + Math.PI },
      kiosk: false, // la baraque porte déjà son nom au fronton : seul le rond au sol marque la place
      hall: { x: hallAt.x, z: hallAt.z, heading: face },
      range: spec.range || 70, // au-delà, le stand n'est pas dessiné (spec.range : un repère visible de loin)
      minPlayers: 1,
      maxPlayers: spec.maxPlayers || 6,
      maxTime: spec.maxTime || DUR + 25,
      options: spec.options,
      help: spec.help,
      rank: spec.rank || ((list) => list.slice().sort((a, b) => (b.score || 0) - (a.score || 0) || (a.name < b.name ? -1 : 1))),
      describe: spec.describe || ((r) => (r.score || 0) + " points"),
      board: spec.board || { label: "Best score", better: "high", value: (r) => r.score, format: (v) => v + " pts" },

      create(ctx) {
        const { world, session, hud, input, group, camera } = ctx, THREE = world.THREE;
        if (spec.before) spec.before(ctx, toWorld); // pontons et planchers du jeu, posés avant de relever les hauteurs
        const root = MF.group({ name: "Baraque_" + spec.id, x: A.x, y: world.heightAt(A.x, A.z) + 0.02, z: A.z, ry: face, parent: group });
        const decor = MF.group({ parent: root }), live = MF.group({ parent: root });
        if (spec.stall !== false) {
          decor.add(MF.props.stall(Object.assign({ title: spec.title.toUpperCase(), skirt: 0.45 }, S)));
          // le sponsor du jeu, sur le devant du comptoir
          if (S.counter !== false) decor.add(MF.sponsors.board(spec.id + "-comptoir", Math.min(S.w - 0.5, 3.2), 0.44, { y: 0.62, z: S.d / 2 + 0.07, kicker: spec.title }));
        }
        root.updateMatrixWorld(true);
        const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
        const tmp = new THREE.Vector3(), from = new THREE.Vector3(), to = new THREE.Vector3();
        const aim = { x: 0, y: 0, keys: false, px: 0, py: 0 };
        const scores = new Map(), flights = [];
        let cross = null, reported = false, sway = 0, lastSent = -1, sentAt = 0, lastBoard = 0, wasHold = false, rng = MF.rng(1), party = null, charging = false, phaseOfCharge = 0, wasX = 0;

        const b = {
          THREE, world, ctx, root, decor, live, hud, input, session, camera, S, DUR,
          ray: { o: new THREE.Vector3(), d: new THREE.Vector3(0, 0, -1) },
          aim, score: 0, t: 0, dt: 0, time: 0, left: DUR, playing: false, press: false, hold: false, release: false, tap: null, slot: 0, over: false, opts: {}, toWorld,
          rand: () => rng(),
          /** Hauteur du terrain sous un point du stand, dans son repère (0 au centre). */
          ground(lx, lz) {
            const w = toWorld(lx, lz);
            return world.heightAt(w.x, w.z) - root.position.y;
          },
          add(points, text, at) {
            b.score = Math.max(0, b.score + points);
            if (text === false) return;
            const p = at ? b.screen(at) : [hud.root.clientWidth / 2, hud.root.clientHeight * 0.45];
            hud.pop(text || (points > 0 ? "+" + points : String(points)), p[0], p[1] - 26, { color: points < 0 ? "#ff6b6b" : points >= 30 ? "#ffe45c" : undefined });
          },
          /** Point du stand → position à l'écran (pixels). */
          screen(v) {
            tmp.copy(v).applyMatrix4(root.matrixWorld).project(camera);
            return [((tmp.x + 1) / 2) * hud.root.clientWidth, ((1 - tmp.y) / 2) * hud.root.clientHeight];
          },
          /** Où le viseur touche le plan z = z0 (ou y = y0 avec plane "y") ; null si on vise ailleurs. */
          hit(value, plane = "z", out = new THREE.Vector3()) {
            const o = b.ray.o, d = b.ray.d, k = plane === "y" ? (value - o.y) / (d.y || 1e-6) : (value - o.z) / (d.z || 1e-6);
            return k > 0 ? out.copy(o).addScaledVector(d, k) : null;
          },
          /** Appui maintenu : la jauge monte et redescend ; au relâchement, renvoie la puissance (0…1). */
          charge(rate = 1.1, label = "Power") {
            if (!b.playing) {
              if (charging) hud.gauge(null);
              charging = false;
              return null;
            }
            if (b.hold) {
              // de plus en plus vite à chaque lancer (b.level : nombre de lancers déjà faits), et, passé le
              // troisième, la jauge ne repart plus de zéro : on ne peut pas compter dans sa tête
              const fast = rate * (1 + Math.min(1.3, b.level * (spec.ramp ?? 0.11)));
              phaseOfCharge = charging ? phaseOfCharge + b.dt * fast : b.level >= 3 ? rng() * 0.7 : 0;
              charging = true;
              const u = phaseOfCharge % 2;
              b.power = u < 1 ? u : 2 - u;
              hud.gauge(b.power, label);
              return null;
            }
            if (!charging) return null;
            charging = false;
            hud.gauge(null);
            b.level++;
            return Math.max(0.02, b.power);
          },
          /** Vol en cloche : l'objet va de `a` à `c` en `dur` secondes, en montant de `apex` au milieu. */
          fly(object, a, c, apex, dur, done) {
            flights.push({ object, a: a.clone(), c: c.clone(), apex, dur, t: 0, done });
            object.visible = true;
            object.position.copy(a);
          },
          confetti(x, y, z, n = 14) {
            if (!party) party = MF.props.confetti(live, 26);
            party.burst(x, y, z, n, 1);
          },
          finish() {
            b.over = true;
          },
          others: () => (session.state ? session.state.roster : []).map((p) => ({ uid: p.uid, name: p.name, color: p.color, self: p.uid === ctx.self.uid, score: p.uid === ctx.self.uid ? b.score : scores.get(p.uid) || 0 })),
        };
        session.on("pts", (d, peer) => scores.set(peer.uid, +d || 0));
        const game = spec.setup(b);
        MF.freeze(decor);

        function animate(dt) {
          for (let i = flights.length - 1; i >= 0; i--) {
            const f = flights[i];
            f.t += dt;
            const u = Math.min(1, f.t / f.dur);
            f.object.position.lerpVectors(f.a, f.c, u);
            f.object.position.y += f.apex * 4 * u * (1 - u);
            if (f.spin) f.object.rotation.x += f.spin * dt;
            if (u >= 1) {
              flights.splice(i, 1);
              if (f.done) f.done(f.object);
            }
          }
          if (party) party.update(dt);
        }

        return {
          b,
          game,
          enter() {
            input.use({ layout: "pointer", buttons: [{ id: "a", label: spec.button || "GO", key: "Space" }] });
            hud.stats([{ key: "score", label: spec.scoreLabel || "Score" }].concat(DUR ? [{ key: "time", label: "Time" }] : [], spec.stats || []));
            hud.hint((input.touch && spec.touchHint) || spec.hint || "");
            cross = spec.cross === false ? null : hud.widget("fete-cross");
            aim.x = aim.y = 0;
            sway = 0;
          },
          leave() {
            cross = null;
            charging = false;
            if (game.leave) game.leave(b);
          },
          idle() {},
          onPhase(state, prev) {
            if (state && state.phase === "countdown" && (!prev || prev.phase !== "countdown")) {
              rng = MF.rng(state.seed || 1);
              Object.assign(b, { score: 0, over: false, level: 0, opts: state.opts || {} });
              reported = false;
              lastSent = -1;
              charging = false;
              flights.length = 0;
              scores.clear();
              game.reset(b);
            }
          },
          update(dt, time) {
            if (!ctx.active()) return false;
            const st = session.state, phase = st ? st.phase : "lobby", t = session.time();
            Object.assign(b, { dt, time, t });
            animate(dt);
            const mine = !!st && session.inRoster() && (phase === "run" || phase === "countdown");
            if (!mine) {
              // salle d'attente, spectateur, résultats : vue d'ensemble de la baraque
              b.playing = false;
              if (charging) b.charge();
              if (cross) cross.style.transform = "translate(-200px, -200px)";
              if (game.idle) game.idle(b);
              sway += dt;
              from.set(Math.sin(sway * 0.25) * 1.2 + CAM.x, CAM.y + 0.5, CAM.z + 1.4).applyMatrix4(root.matrixWorld);
              to.set(CAM.look[0], CAM.look[1] + 0.2, CAM.look[2]).applyMatrix4(root.matrixWorld);
              MF.cam.set(camera, from, to, Math.min(70, CAM.fov + 10));
              return true;
            }
            // caméra au comptoir, un peu décalée selon ma place dans la liste
            const n = st.roster.length, slot = Math.max(0, session.slot());
            b.slot = slot;
            const off = game.camX ? game.camX(b) : MF.clamp((slot - (n - 1) / 2) * 0.7, -(S.w / 2 - 0.8), S.w / 2 - 0.8);
            from.set(CAM.x + off, CAM.y, CAM.z);
            to.set(CAM.look[0] + off * (game.camX ? 1 : 0.3), CAM.look[1], CAM.look[2]);
            if (game.view) game.view(b, from, to); // caméra mobile (grimper, descendre la rivière…), dans le repère du stand
            from.applyMatrix4(root.matrixWorld);
            to.applyMatrix4(root.matrixWorld);
            MF.cam.set(camera, from, to, CAM.fov);
            camera.updateMatrixWorld();
            // viseur : souris (ou doigt posé), sinon flèches
            const P = input.state.pointer, K = input.state;
            if (K.x || K.y) {
              aim.x = MF.clamp(aim.x + K.x * 1.1 * dt, -0.98, 0.98);
              aim.y = MF.clamp(aim.y + K.y * 1.1 * dt, -0.98, 0.98);
              aim.keys = true;
            } else if (!aim.keys || P.isDown || P.down || Math.abs(P.nx - aim.px) + Math.abs(P.ny - aim.py) > 0.002) {
              aim.keys = false;
              aim.x = P.nx;
              aim.y = P.ny;
            }
            aim.px = P.nx;
            aim.py = P.ny;
            b.ray.o.copy(camera.position).applyMatrix4(inv);
            b.ray.d.set(aim.x, aim.y, 0.5).unproject(camera).applyMatrix4(inv).sub(b.ray.o).normalize();
            if (cross) cross.style.transform = `translate(${(((aim.x + 1) / 2) * hud.root.clientWidth).toFixed(1)}px, ${(((1 - aim.y) / 2) * hud.root.clientHeight).toFixed(1)}px)`;
            const hold = !!(P.isDown || K.a);
            // « tape à gauche, tape à droite » : flèches (ou A/D), ou clic du côté gauche ou droit de l'écran
            const kx = K.x < -0.5 ? -1 : K.x > 0.5 ? 1 : 0;
            b.tap = kx && kx !== wasX ? (kx < 0 ? "L" : "R") : hold && !wasHold && !K.a ? (aim.x < 0 ? "L" : "R") : null;
            wasX = kx;
            b.press = hold && !wasHold;
            b.release = !hold && wasHold;
            b.hold = hold;
            wasHold = hold;
            b.playing = phase === "run" && t >= 0 && !reported && !b.over && (!DUR || t < DUR);
            b.left = DUR ? Math.max(0, DUR - Math.max(0, t)) : 0;
            game.update(b);
            hud.set("score", spec.scoreText ? spec.scoreText(b) : b.score);
            if (DUR) hud.set("time", Math.ceil(b.left) + " s");
            if (game.hud) game.hud(b);
            if (phase === "run" && !reported && (b.over || (DUR && t >= DUR))) {
              reported = true;
              if (charging) b.charge();
              session.report(game.result ? game.result(b) : { score: b.score });
            }
            if (b.score !== lastSent && time - sentAt > 0.25) {
              lastSent = b.score;
              sentAt = time;
              session.send("pts", b.score);
            }
            if (time - lastBoard > 0.3) {
              lastBoard = time;
              const rows = b.others().sort((x, y) => (spec.sort ? spec.sort(x, y) : y.score - x.score));
              hud.board(rows.map((r) => ({ name: r.name, color: r.color, self: r.self, text: spec.liveText ? spec.liveText(r.score) : r.score + " pts" })));
            }
            return true;
          },
        };
      },
    });
  };
})();
