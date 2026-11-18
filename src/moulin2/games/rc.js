// La Fête du Moulin — course de voitures radiocommandées.
//
// 1 à 8 pilotes, 3 ou 5 tours. Le circuit (116 m) emprunte l'allée du moulin, fait une épingle avant
// le portail, redescend par la prairie (avec une belle bosse), fait demi-tour sur la cour et remonte.
// Chacun pilote sa voiture sur son écran et envoie sa position aux autres une douzaine de fois par
// seconde ; les voitures des autres sont redessinées en douceur (MF.remotes). Le premier qui boucle ses
// tours gagne ; les autres ont 30 secondes pour finir.
//
// Ce fichier sert de modèle aux autres jeux : décor construit une fois (create), partie pilotée par la
// phase de la session (onPhase), une boucle (update) qui tourne aussi pour les spectateurs.
(function () {
  "use strict";
  const MF = globalThis.MoulinFete;

  // Tracé (x, z), dans le sens de la course ; le premier point est la ligne de départ, sur l'allée.
  const TRACK = [
    [-0.2, -56], [0.6, -63], [2.2, -68.5], [5.6, -70.8], [9.0, -68.5], [10.2, -63], [9.6, -56], [8.6, -52], [8.4, -46], [7.6, -41], [6.2, -35],
    [4.6, -29.5], [3.0, -25], [1.8, -20.5], [-0.6, -17.2], [-3.4, -18.6], [-4.6, -22.5], [-4.0, -27.5], [-3.6, -33], [-2.6, -40], [-1.2, -48],
  ];
  const WIDTH = 3.4; // largeur de la piste (m)
  const CAR_R = 0.36; // rayon d'encombrement d'une voiture (m)
  const GRACE = 30; // secondes laissées aux autres après l'arrivée du premier
  const C = { vmax: 13, vgrass: 7, vrev: 4, acc: 10, brake: 18, drag: 0.28, turn: 3.0, grip: 7.5, gripGrass: 4.5, gripDrift: 1.6, g: 15 };

  /** Petite voiture tout-terrain à la couleur du pilote. Origine au sol, avant vers +z. */
  function buildCar(color, name) {
    const g = MF.group({ name: "Voiture_RC" });
    const body = MF.group({ parent: g });
    const paint = MF.mat(color, { unique: true });
    MF.box(0.3, 0.09, 0.56, paint, { y: 0.15, parent: body, cast: true });
    MF.box(0.24, 0.085, 0.24, MF.PAL.black, { y: 0.235, z: -0.03, parent: body });
    MF.box(0.2, 0.05, 0.16, paint, { y: 0.19, z: 0.24, parent: body });
    // aileron arrière et antenne avec son fanion
    MF.box(0.34, 0.02, 0.1, MF.PAL.black, { y: 0.31, z: -0.27, parent: body });
    for (const side of [-1, 1]) MF.box(0.02, 0.1, 0.06, MF.PAL.black, { x: side * 0.13, y: 0.255, z: -0.27, parent: body });
    MF.cyl(0.006, 0.006, 0.42, MF.PAL.steel, { x: 0.09, y: 0.44, z: -0.16, parent: body, seg: 5 });
    MF.box(0.1, 0.06, 0.004, paint, { x: 0.14, y: 0.62, z: -0.16, parent: body });
    MF.freeze(body); // la caisse d'un seul bloc ; les roues restent mobiles
    const wheels = [];
    for (const [x, z, front] of [[-0.19, 0.19, 1], [0.19, 0.19, 1], [-0.19, -0.19, 0], [0.19, -0.19, 0]]) {
      const pivot = MF.group({ x, y: 0.085, z, parent: g });
      const w = MF.cyl(0.085, 0.085, 0.085, MF.PAL.black, { rz: Math.PI / 2, parent: pivot, seg: 10 });
      MF.cyl(0.045, 0.045, 0.09, MF.PAL.yellow, { rz: Math.PI / 2, parent: pivot, seg: 8 });
      wheels.push({ pivot, w, front });
    }
    const shadow = MF.blob(0.42, 0.4);
    shadow.position.y = 0.02;
    g.add(shadow);
    let tag = null;
    if (name) {
      tag = MF.tag(name, { scale: 0.42 });
      tag.position.y = 0.95;
      g.add(tag);
    }
    return { group: g, body, wheels, paint, tag, shadow, spin: 0 };
  }

  MF.registerGame({
    id: "rc",
    title: "RC Car Race",
    icon: "🏎️",
    color: MF.PAL.red,
    blurb: "1–8 drivers · 3 or 5 laps",
    station: { x: 4.5, z: -58, heading: -Math.PI / 2 },
    minPlayers: 1,
    maxPlayers: 8,
    maxTime: 300,
    options: [{ key: "laps", label: "Laps", values: [3, 5], default: 3, format: (v) => v + " laps" }],
    help: "Arrows or WASD: accelerate, brake, steer · Space: handbrake (drift) · C: back on track.",
    // Arrivés d'abord (au temps), puis les autres selon la distance parcourue.
    rank: (list) => list.slice().sort((a, b) => (a.time ? 0 : 1) - (b.time ? 0 : 1) || (a.time || 0) - (b.time || 0) || (b.dist || 0) - (a.dist || 0)),
    describe: (r) => (r.time ? MF.time(r.time) : "did not finish"),

    create(ctx) {
      const { world, session, hud, input, group, camera } = ctx;
      const path = MF.path(TRACK, { closed: true, step: 1 });
      const L = path.length;
      // Les voitures roulent 9 cm au-dessus du relief calculé : c'est la hauteur de la piste, posée assez
      // haut pour ne pas disparaître sous les bosses du sol réel (et l'herbe a cette épaisseur).
      const RIDE = 0.09;
      const H = (x, z) => world.heightAt(x, z) + RIDE;
      const obstacles = MF.obstacles(world, [-12, -80, 18, -10]);
      obstacles.add(6.2, -21.4, 1.3); // voiture garée sur la cour
      obstacles.add(7.4, -21.0, 1.3);

      /* ---------------------------------------------------------------- décor (une fois) */
      const deco = MF.group({ name: "Circuit_RC", parent: group });
      deco.add(MF.ribbon(world, path, { width: WIDTH, color: "#d9b77a", edgeColor: "#ffffff", edge: 0.2, stripes: true, lift: RIDE + 0.02, name: "Piste_RC" }));
      // ligne d'arrivée en damier et arche de départ
      const start = path.at(0);
      const startHeading = Math.atan2(start.tx, start.tz);
      const line = MF.plane(WIDTH, 0.7, new world.THREE.MeshBasicMaterial({ map: MF.canvasTexture(256, 64, (c, W, Hh) => {
        for (let i = 0; i < 16; i++) for (let j = 0; j < 4; j++) {
          c.fillStyle = (i + j) % 2 ? "#ffffff" : "#1d1d22";
          c.fillRect((i * W) / 16, (j * Hh) / 4, W / 16 + 1, Hh / 4 + 1);
        }
      }), polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 }), { rx: -Math.PI / 2 });
      const lineHolder = MF.group({ parent: deco });
      lineHolder.add(line);
      MF.seat(lineHolder, world, start.x, start.z, startHeading, RIDE + 0.05);
      const arch = MF.group({ name: "Arche_depart_RC", x: start.x, y: world.heightAt(start.x, start.z), z: start.z, ry: startHeading, parent: deco });
      for (const side of [-1, 1]) {
        const p = MF.pole(3.0, { color: MF.PAL.red });
        p.position.x = side * (WIDTH / 2 + 0.55);
        arch.add(p);
        obstacles.add(start.x - start.tz * side * (WIDTH / 2 + 0.55), start.z + start.tx * side * (WIDTH / 2 + 0.55), 0.12);
      }
      const title = MF.sign("START", { w: 1.5, h: 0.42, bg: MF.PAL.yellow, color: MF.PAL.ink, double: true });
      title.position.y = 3.08;
      arch.add(title);
      for (const face of [0, Math.PI]) arch.add(MF.sponsors.board("rc-arche", WIDTH + 0.9, 0.66, { y: 2.5, z: face ? -0.02 : 0.02, ry: face, kicker: "Start arch" }));
      // bâches de sponsors, à l'extérieur des virages et le long de la ligne droite
      const banner = (id, s, side, w = 3.6) => {
        const p = path.at(s);
        // assez loin du bord pour que la caméra de poursuite ne passe pas au travers
        const off = side * (WIDTH / 2 + 2.3);
        const x = p.x - p.tz * off, z = p.z + p.tx * off;
        const b = MF.sponsors.banner(id, w, 0.9, { lift: 0.25 });
        // la face de la bâche regarde la piste
        b.position.set(x, world.heightAt(x, z), z);
        b.rotation.y = Math.atan2(p.x - x, p.z - z);
        deco.add(b);
        for (const e of [-1, 1]) obstacles.add(x + Math.cos(b.rotation.y) * e * (w / 2), z - Math.sin(b.rotation.y) * e * (w / 2), 0.1);
      };
      banner("rc-bache-1", 5.5, -1);
      banner("rc-bache-2", 16, -1);
      banner("rc-bache-3", 43, -1);
      banner("rc-bache-4", 70.5, -1, 3.0);
      // piles de pneus à l'intérieur des deux virages serrés
      const tyres = (s, side) => {
        const p = path.at(s), off = side * (WIDTH / 2 + 0.35);
        const x = p.x - p.tz * off, z = p.z + p.tx * off, y = world.heightAt(x, z);
        for (let i = 0; i < 3; i++) MF.torus(0.17, 0.075, i % 2 ? MF.PAL.white : MF.PAL.black, { x, y: y + 0.08 + i * 0.15, z, rx: Math.PI / 2, parent: deco, seg: 12, tubeSeg: 6 });
        obstacles.add(x, z, 0.26);
      };
      for (const s of [13, 15.5, 18, 67, 70, 73]) tyres(s, 1);
      MF.freeze(deco);

      /* ---------------------------------------------------------------- voitures */
      let me = null; // ma voiture : { car, x, y, z, h, vx, vz, vy, air, s, dist, lap, steer, … }
      const camState = {};
      let engine = null, finished = false, graceEnd = 0, offTimer = 0, lastBoard = 0, sway = 0;

      const remotes = MF.remotes({
        session,
        size: 6, // x, y, z, cap, vitesse, braquage
        angles: [3],
        make(peer) {
          const car = buildCar(peer.color, peer.name);
          group.add(car.group);
          return car;
        },
        apply(car, v, extra) {
          car.group.position.set(v[0], v[1], v[2]);
          MF.seat(car.group, world, v[0], v[2], v[3], 0, v[1]);
          spinWheels(car, v[4], v[5], 1 / 60);
          car.dist = extra ? extra[0] : 0;
          car.done = !!(extra && extra[1]);
          car.x = v[0];
          car.z = v[2];
          car.speed = v[4];
        },
      });
      function spinWheels(car, speed, steer, dt) {
        car.spin += (speed / 0.085) * dt;
        for (const w of car.wheels) {
          w.w.rotation.x = car.spin;
          if (w.front) w.pivot.rotation.y = steer * 0.42;
        }
      }
      function gridSpot(slot) {
        const row = Math.floor(slot / 2), side = slot % 2 ? 1 : -1;
        const p = path.at(L - 1.6 - row * 1.5);
        return { x: p.x - p.tz * side * 0.75, z: p.z + p.tx * side * 0.75, h: Math.atan2(p.tx, p.tz), s: p.s };
      }
      function spawn(slot) {
        if (!me) {
          me = { car: buildCar(ctx.self.color, null) };
          group.add(me.car.group);
        }
        me.car.paint.color.copy(MF.color(ctx.self.color));
        const g = gridSpot(slot);
        Object.assign(me, { x: g.x, z: g.z, y: H(g.x, g.z), h: g.h, vx: 0, vz: 0, vy: 0, air: false, s: g.s, dist: g.s - L, steer: 0, speed: 0, lastHit: 0 });
        MF.seat(me.car.group, world, me.x, me.z, me.h, 0, me.y);
        camState.x = undefined;
        finished = false;
        graceEnd = 0;
        offTimer = 0;
      }
      function despawn() {
        if (me) {
          group.remove(me.car.group);
          MF.dispose(me.car.group);
          me = null;
        }
        if (engine) {
          engine.stop();
          engine = null;
        }
      }
      /** Replace la voiture au milieu de la piste, à l'arrêt (touche C, sortie de piste, chute à l'eau). */
      function reset() {
        const p = path.at(me.s);
        Object.assign(me, { x: p.x, z: p.z, y: H(p.x, p.z), h: Math.atan2(p.tx, p.tz), vx: 0, vz: 0, vy: 0, air: false });
        camState.x = undefined;
        MF.sfx.play("boing");
      }

      function drive(dt, locked) {
        const st = input.state;
        const throttle = locked ? 0 : st.y, steerIn = locked ? 0 : st.x, hand = !locked && st.a;
        const fx = Math.sin(me.h), fz = Math.cos(me.h);
        let vf = me.vx * fx + me.vz * fz; // vitesse vers l'avant
        let vl = me.vx * -fz + me.vz * fx; // vitesse de côté (dérapage)
        const near = path.nearest(me.x, me.z, me.s, true);
        const onTrack = Math.abs(near.d) < WIDTH / 2 + 0.2;
        if (!me.air) {
          const vmax = onTrack ? C.vmax : C.vgrass;
          if (throttle > 0.05) vf += C.acc * throttle * (1 - Math.max(0, vf) / vmax) * dt;
          else if (throttle < -0.05) vf += (vf > 0.3 ? C.brake : C.acc * 0.7) * throttle * dt;
          if (hand) vf -= Math.sign(vf) * Math.min(Math.abs(vf), C.brake * 0.55 * dt);
          vf -= vf * C.drag * dt + (onTrack ? 0 : vf * 1.4 * dt);
          vf = MF.clamp(vf, -C.vrev, C.vmax * 1.08);
          // la pente : on prend de la vitesse en descente, on en perd en montée
          const slope = (H(me.x + fx * 0.3, me.z + fz * 0.3) - H(me.x - fx * 0.3, me.z - fz * 0.3)) / 0.6;
          vf -= slope * C.g * 0.45 * dt;
          // direction : d'autant plus vive qu'on roule, un peu moins à pleine vitesse
          me.steer = MF.damp(me.steer, steerIn, 14, dt);
          const k = MF.clamp(Math.abs(vf) / 2.2, 0, 1) * (1 - 0.32 * MF.clamp(Math.abs(vf) / C.vmax, 0, 1));
          me.h -= me.steer * C.turn * k * Math.sign(vf || 1) * dt * (hand ? 1.25 : 1);
          vl -= vl * Math.min(1, (hand ? C.gripDrift : onTrack ? C.grip : C.gripGrass) * dt);
        } else me.steer = MF.damp(me.steer, 0, 6, dt);
        const nfx = Math.sin(me.h), nfz = Math.cos(me.h);
        // en virage, la vitesse suit le nouveau cap moins vite que le nez : c'est ce qui fait déraper
        const turned = me.air ? 0 : vf * (fx * -nfz + fz * nfx);
        vl += turned;
        vf = me.air ? vf : vf * (fx * nfx + fz * nfz);
        me.vx = nfx * vf + -nfz * vl;
        me.vz = nfz * vf + nfx * vl;
        const before = H(me.x, me.z);
        me.x += me.vx * dt;
        me.z += me.vz * dt;
        // obstacles : arbres, murs, pneus, mâts, voitures des autres
        const hit = obstacles.hit(me.x, me.z, CAR_R);
        if (hit) bounce(hit.nx, hit.nz, hit.depth, 0.35);
        for (const r of remotes.map.values()) {
          const o = r.obj;
          if (o.x === undefined) continue;
          const dx = me.x - o.x, dz = me.z - o.z, d = Math.hypot(dx, dz);
          if (d < CAR_R * 2 && d > 1e-3) bounce(dx / d, dz / d, (CAR_R * 2 - d) * 0.6, 0.5);
        }
        // hauteur : on suit le sol, ou on vole un instant après une bosse
        const ground = H(me.x, me.z);
        me.vy -= C.g * dt;
        me.y += me.vy * dt;
        if (me.y <= ground + 0.001) {
          if (me.air && me.vy < -4) MF.sfx.play("toc");
          me.y = ground;
          me.vy = MF.clamp((ground - before) / Math.max(dt, 1e-3), -30, 7);
          me.air = false;
        } else me.air = me.y > ground + 0.05;
        me.speed = vf;
        // progression le long du circuit
        const n2 = path.nearest(me.x, me.z, me.s, true);
        let ds = n2.s - me.s;
        if (ds > L / 2) ds -= L;
        else if (ds < -L / 2) ds += L;
        me.s = n2.s;
        me.dist += ds;
        const water = world.waterAt(me.x, me.z);
        const lost = Math.abs(n2.d) > WIDTH / 2 + 5.5 || (water && me.y < water.level - 0.05);
        offTimer = lost ? offTimer + dt : 0;
        if (offTimer > (water ? 0.2 : 1.2) || (!locked && st.hit.c)) {
          offTimer = 0;
          reset();
        }
      }
      function bounce(nx, nz, depth, restitution) {
        me.x += nx * depth;
        me.z += nz * depth;
        const vn = me.vx * nx + me.vz * nz;
        if (vn < 0) {
          me.vx -= (1 + restitution) * vn * nx;
          me.vz -= (1 + restitution) * vn * nz;
          if (vn < -2.5 && performance.now() - me.lastHit > 250) {
            me.lastHit = performance.now();
            MF.sfx.play("choc");
          }
        }
      }

      function ranking() {
        const rows = [];
        const st = session.state;
        if (!st) return rows;
        for (const p of st.roster) {
          const mine = p.uid === ctx.self.uid;
          const r = mine ? null : remotes.get(p.uid);
          const res = st.results[p.uid];
          const dist = mine ? (me ? me.dist : -1) : r ? r.obj.dist || 0 : -1;
          rows.push({ uid: p.uid, name: p.name, color: p.color, self: mine, dist, time: res && res.time ? res.time : 0, gone: !mine && !r && !res });
        }
        rows.sort((a, b) => (a.time ? 0 : 1) - (b.time ? 0 : 1) || a.time - b.time || b.dist - a.dist);
        return rows;
      }

      return {
        path,
        car: () => me,
        remotes,
        enter() {
          input.use({ layout: "radio", radio: { kicker: "REMOTE CONTROL", brand: MF.sponsors.brand("rc-telecommande") }, buttons: [{ id: "a", label: "BRAKE", key: "Space" }, { id: "c", label: "RESET", key: "C" }] });
          hud.stats([{ key: "lap", label: "Lap" }, { key: "time", label: "Time" }, { key: "pos", label: "Position" }]);
          hud.hint(input.touch ? "Left stick: throttle · right stick: steering" : "Arrows or WASD: drive · Space: handbrake · C: reset");
          sway = 0;
        },
        leave() {
          despawn();
        },
        idle() {
          remotes.clear();
        },
        onPhase(state, prev) {
          if (!ctx.active()) return;
          if (state && state.phase === "countdown" && (!prev || prev.phase !== "countdown")) {
            if (session.inRoster()) spawn(session.slot());
            else despawn();
          }
        },
        update(dt, time) {
          let dirty = remotes.update();
          if (!ctx.active()) return dirty;
          const st = session.state;
          const phase = st ? st.phase : "lobby";
          const racing = !!me && (phase === "countdown" || phase === "run");
          if (racing) {
            const t = session.time();
            const laps = st.opts.laps || 3;
            drive(dt, phase === "countdown" || t < 0 || finished);
            MF.seat(me.car.group, world, me.x, me.z, me.h, 0, me.y);
            spinWheels(me.car, me.speed, me.steer, dt);
            me.car.shadow.position.y = 0.02 - (me.y - H(me.x, me.z));
            if (!engine) engine = MF.sfx.loop("moteur");
            engine.set(0.55 + Math.abs(me.speed) / C.vmax, finished ? 0.25 : 0.7);
            const lap = MF.clamp(Math.floor(Math.max(0, me.dist) / L) + 1, 1, laps);
            if (!finished && phase === "run") {
              if (me.lap !== lap && me.dist > 1) {
                if (me.lap !== undefined && lap > me.lap) {
                  hud.flash(lap === laps ? "Final lap!" : "Lap " + lap + " / " + laps, { color: lap === laps ? MF.PAL.yellow : "#ffffff" });
                  MF.sfx.play("tour");
                }
                me.lap = lap;
              }
              if (me.dist >= laps * L) {
                finished = true;
                const rows = ranking().filter((r) => r.time);
                hud.flash("Finished! " + MF.ordinal(rows.length + 1), { color: MF.PAL.yellow, hold: 3 });
                session.report({ time: Math.round(t * 1000) / 1000, dist: Math.round(me.dist) });
              } else {
                // le premier est arrivé : il reste 30 secondes aux autres
                const first = Object.values(st.results).some((r) => r && r.time);
                if (first && !graceEnd) {
                  graceEnd = t + GRACE;
                  hud.flash("First finisher is in: " + GRACE + " s left", { hold: 2.5 });
                }
                if (graceEnd && t > graceEnd) {
                  finished = true;
                  session.report({ dnf: true, dist: Math.round(me.dist) });
                }
              }
            } else if (phase === "countdown") me.lap = undefined;
            hud.set("lap", lap + " / " + laps);
            hud.set("time", MF.time(Math.max(0, t), 1));
            remotes.send([me.x, me.y, me.z, me.h, me.speed, me.steer], [Math.round(me.dist), finished ? 1 : 0]);
            MF.cam.fov(camera, 62);
            MF.cam.chase(camera, camState, me, me.h, { dist: 2.5, height: 1.0, look: 1.3, up: 0.3, rate: 7, turn: 4.5, clear: 0.35 }, dt, H);
            if (time - lastBoard > 0.3) {
              lastBoard = time;
              const rows = ranking();
              hud.set("pos", rows.findIndex((r) => r.self) + 1 + " / " + rows.length);
              hud.board(rows.map((r) => ({ name: r.name, color: r.color, self: r.self, text: r.time ? MF.time(r.time, 1) : r.gone ? "–" : "lap " + MF.clamp(Math.floor(Math.max(0, r.dist) / L) + 1, 1, laps) })));
            }
          } else {
            // salle d'attente, spectateur ou résultats : vue de la grille de départ, sous l'arche
            if (engine) {
              engine.stop();
              engine = null;
            }
            if (phase === "lobby") {
              // ma voiture attend sur la grille, à ma place dans la liste des inscrits ; les autres la voient
              const slot = Math.max(0, session.slot());
              if (!me || me.slot !== slot) {
                spawn(slot);
                me.slot = slot;
              }
              remotes.send([me.x, me.y, me.z, me.h, 0, 0], [Math.round(me.dist), 0]);
            }
            sway += dt;
            const back = path.at(L - 9.5), look = path.at(L - 1);
            const side = Math.sin(sway * 0.22) * 2.2;
            MF.cam.fov(camera, 50);
            MF.cam.set(camera, { x: back.x - back.tz * side, y: H(back.x, back.z) + 2.7, z: back.z + back.tx * side }, { x: look.x, y: H(look.x, look.z) + 0.9, z: look.z });
          }
          return true;
        },
      };
    },
  });
})();
