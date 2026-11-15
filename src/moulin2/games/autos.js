// La Fête du Moulin — auto-tamponneuses.
//
// 90 secondes sur la piste : un point chaque fois qu'on percute une autre auto avec son avant, à
// bonne vitesse. L'auto percutée part en toupie et son pilote perd la main un instant. Chacun simule
// son auto et l'envoie aux autres ; celui qui percute s'attribue le point et prévient sa victime
// (« choc »), qui encaisse même si elle n'avait pas vu venir le coup. Pour que la piste soit animée
// même seul, des robots complètent jusqu'à cinq autos : ils sont conduits par l'hôte de la partie,
// qui diffuse leurs positions.
(function () {
  "use strict";
  const MF = globalThis.MoulinFete;

  const A = { x0: 80, x1: 95, z0: -10, z1: -1 }; // la piste
  const R = 0.75; // rayon d'une auto (m)
  const DURATION = 90;
  const C = { vmax: 6.5, acc: 10, drag: 1.1, grip: 6, turn: 3.3, ram: 2.5 };
  const SPOTS = [[81.6, -8.2, 1.57], [81.6, -2.8, 1.57], [93.4, -8.2, -1.57], [93.4, -2.8, -1.57], [85.5, -8.6, 0], [89.5, -8.6, 0], [85.5, -2.4, 3.14], [89.5, -2.4, 3.14]];

  function buildCar(color, name) {
    const g = MF.group({ name: "Auto_tamponneuse" });
    const paint = MF.mat(color, { unique: true });
    MF.cyl(R - 0.06, R - 0.02, 0.3, paint, { y: 0.24, parent: g, seg: 18, cast: true });
    MF.torus(R - 0.02, 0.11, MF.PAL.black, { y: 0.16, rx: Math.PI / 2, parent: g, seg: 20, tubeSeg: 7 });
    MF.box(0.62, 0.4, 0.14, MF.PAL.black, { y: 0.56, z: -0.36, parent: g }); // dossier
    MF.box(0.5, 0.1, 0.4, MF.PAL.cream, { y: 0.42, z: -0.12, parent: g });
    MF.torus(0.14, 0.025, MF.PAL.black, { y: 0.62, z: 0.2, rx: -0.9, parent: g, seg: 12, tubeSeg: 5 });
    for (const side of [-1, 1]) MF.sphere(0.07, MF.mat(MF.PAL.yellow, { emissive: MF.PAL.yellow }), { x: side * 0.28, y: 0.32, z: 0.62, parent: g, seg: 6 });
    MF.cyl(0.02, 0.02, 1.9, MF.PAL.steel, { y: 1.3, z: -0.5, parent: g, seg: 5 });
    MF.box(0.3, 0.2, 0.01, paint, { x: 0.16, y: 2.14, z: -0.5, parent: g });
    const shadow = MF.blob(0.95, 0.35);
    shadow.position.y = 0.03;
    g.add(shadow);
    if (name) {
      const tag = MF.tag(name, { scale: 0.45 });
      tag.position.y = 2.45;
      g.add(tag);
    }
    return { group: g, paint };
  }

  MF.registerGame({
    id: "autos",
    title: "Auto-tamponneuses",
    icon: "💥",
    color: MF.PAL.purple,
    blurb: "1 à 8 pilotes · 90 secondes de chocs",
    station: { x: 78, z: -5.5, heading: Math.PI / 2 },
    kiosk: { x: 78.6, z: -0.6, heading: Math.PI / 2 },
    minPlayers: 1,
    maxPlayers: 8,
    maxTime: DURATION + 20,
    help: "Flèches ou ZQSD : conduire · Espace : turbo. Percute les autres avec ton avant pour marquer ; évite de te faire prendre de côté !",
    rank: (list) => list.slice().sort((a, b) => (b.score || 0) - (a.score || 0) || (a.name < b.name ? -1 : 1)),
    describe: (r) => (r.score || 0) + (r.score > 1 ? " chocs" : " choc"),

    create(ctx) {
      const { world, session, hud, input, group, camera } = ctx;
      const H = world.heightAt;
      const CX = (A.x0 + A.x1) / 2, CZ = (A.z0 + A.z1) / 2, W = A.x1 - A.x0, D = A.z1 - A.z0;
      const DY = Math.max(H(A.x0, A.z0), H(A.x1, A.z0), H(A.x0, A.z1), H(A.x1, A.z1), H(CX, CZ)) + 0.1; // plancher

      /* ---------------------------------------------------------------- la piste (une fois) */
      const deco = MF.group({ name: "Piste_des_autos", parent: group });
      MF.box(W + 0.9, 0.7, D + 0.9, "#39424e", { x: CX, y: DY - 0.35, z: CZ, parent: deco });
      MF.box(W, 0.02, D, "#55606e", { x: CX, y: DY + 0.011, z: CZ, parent: deco });
      for (const [x, z, w, d] of [[CX, A.z0 - 0.2, W + 0.9, 0.4], [CX, A.z1 + 0.2, W + 0.9, 0.4], [A.x0 - 0.2, CZ, 0.4, D + 0.1], [A.x1 + 0.2, CZ, 0.4, D + 0.1]]) {
        MF.box(w, 0.36, d, MF.PAL.black, { x, y: DY + 0.18, z, parent: deco, cast: true });
        MF.box(w + 0.02, 0.1, d + 0.02, MF.PAL.yellow, { x, y: DY + 0.33, z, parent: deco });
      }
      const tops = [];
      for (const [x, z] of [[A.x0 - 0.2, A.z0 - 0.2], [A.x1 + 0.2, A.z0 - 0.2], [A.x1 + 0.2, A.z1 + 0.2], [A.x0 - 0.2, A.z1 + 0.2]]) {
        // mâts hauts : les guirlandes passent au-dessus de la caméra des pilotes
        const p = MF.pole(5.2, { color: MF.PAL.purple, top: MF.PAL.yellow });
        p.position.set(x, DY, z);
        deco.add(p);
        tops.push({ x, y: DY + 5.1, z });
      }
      for (let i = 0; i < 4; i++) deco.add(MF.bunting(tops[i], tops[(i + 1) % 4], { sag: 0.45, size: 0.34 }));
      // fronton au-dessus de l'entrée (côté ouest, face au stand) et bandeau le long du côté est
      deco.add(MF.sign("AUTO-TAMPONNEUSES", { w: 5.4, h: 0.7, bg: MF.PAL.purple, color: "#ffffff", border: MF.PAL.yellow, x: A.x0 - 0.25, y: DY + 3.25, z: CZ, ry: -Math.PI / 2 }));
      deco.add(MF.sponsors.board("autos-fronton", 5.0, 0.66, { x: A.x0 - 0.25, y: DY + 2.52, z: CZ, ry: -Math.PI / 2, kicker: "Fronton des auto-tamponneuses" }));
      deco.add(MF.sponsors.board("autos-bandeau", 7.6, 0.8, { x: A.x1 + 0.42, y: DY + 1.05, z: CZ, ry: -Math.PI / 2, kicker: "Bandeau de la piste" }));
      MF.box(0.08, 0.9, 7.8, MF.PAL.woodDark, { x: A.x1 + 0.48, y: DY + 1.05, z: CZ, parent: deco });

      /* ---------------------------------------------------------------- autos */
      let me = null; // { car, x, z, h, vx, vz, stun, spin, turbo, cool, score }
      const camState = {};
      const immune = new Map(); // id de la victime → heure du dernier choc donné
      let engine = null, reported = false, warned = false, lastBoard = 0, sway = 0, shake = 0;
      const others = []; // autos à éviter ou percuter à cette image : { id, x, z, vx, vz }

      const remotes = MF.remotes({
        session,
        size: 4, // x, z, cap, toupie
        angles: [2],
        make(peer) {
          const car = buildCar(peer.color, peer.name);
          group.add(car.group);
          return car;
        },
        apply(car, v, extra, peer, r) {
          const now = performance.now() / 1000, dt = Math.max(1e-3, now - (car.at || now - 0.016));
          car.vx = car.x === undefined ? 0 : (v[0] - car.x) / dt;
          car.vz = car.x === undefined ? 0 : (v[1] - car.z) / dt;
          car.at = now;
          car.x = v[0];
          car.z = v[1];
          car.score = extra || 0;
          car.group.position.set(v[0], DY, v[1]);
          car.group.rotation.y = v[2] + v[3];
        },
      });

      // robots : simulés par l'hôte, lissés chez les autres
      const bots = [];
      function setBots(n) {
        while (bots.length > n) {
          const b = bots.pop();
          group.remove(b.car.group);
          MF.dispose(b.car.group);
        }
        while (bots.length < n) {
          const i = bots.length, car = buildCar(["#9aa3b2", "#c8b8a0", "#8fb39a", "#b79ac0"][i % 4], "Robot " + (i + 1));
          group.add(car.group);
          bots.push({ id: "bot:" + i, car, x: 0, z: 0, h: 0, vx: 0, vz: 0, stun: 0, spin: 0, it: MF.interp(3, [2]), out: [0, 0, 0], owned: false, placed: false, wander: i * 1.7 });
        }
      }
      function placeBots(nPlayers) {
        bots.forEach((b, i) => {
          const s = SPOTS[(nPlayers + i) % SPOTS.length];
          Object.assign(b, { x: s[0], z: s[1], h: s[2], vx: 0, vz: 0, stun: 0, spin: 0, placed: true });
          b.it.clear();
        });
      }
      let lastBots = 0;
      session.on("robots", (d) => {
        if (session.isHost() || !Array.isArray(d)) return;
        const n = Math.floor((d.length - 1) / 4);
        if (bots.length !== n) setBots(n);
        const now = performance.now() / 1000;
        bots.forEach((b, i) => {
          b.it.push(+d[0], [d[1 + i * 4], d[2 + i * 4], d[3 + i * 4]], now);
          b.stun = d[4 + i * 4] ? 0.3 : 0;
          b.owned = false;
        });
      });
      session.on("choc", (d) => {
        if (!d || typeof d.to !== "string") return;
        const dx = +d.x || 0, dz = +d.z || 0, v = MF.clamp(+d.v || 3, 2, 9);
        if (d.to === ctx.self.uid && me) {
          // on m'a percuté : je pars en toupie
          me.vx += dx * v * 0.9;
          me.vz += dz * v * 0.9;
          me.stun = 0.8;
          me.spinV = 11 * (Math.random() < 0.5 ? -1 : 1);
          shake = 0.4;
          if (ctx.active()) {
            hud.flash("Aïe !", { color: MF.PAL.red, hold: 0.8 });
            MF.sfx.play("boing");
          }
        } else if (d.to.startsWith("bot:") && session.isHost()) {
          const b = bots[+d.to.slice(4)];
          if (b) {
            b.vx += dx * v * 0.9;
            b.vz += dz * v * 0.9;
            b.stun = 0.9;
          }
        }
      });

      function spawn(slot) {
        if (!me) {
          me = { car: buildCar(ctx.self.color, null) };
          group.add(me.car.group);
        }
        me.car.paint.color.copy(MF.color(ctx.self.color));
        const s = SPOTS[slot % SPOTS.length];
        Object.assign(me, { x: s[0], z: s[1], h: s[2], vx: 0, vz: 0, stun: 0, spin: 0, spinV: 0, turbo: 0, cool: 0, score: 0, speed: 0 });
        camState.x = undefined;
        immune.clear();
        reported = warned = false;
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
      /** Garde une auto dans la piste ; renvoie vrai si elle a tapé la bordure. */
      function walls(c) {
        let hit = false;
        if (c.x < A.x0 + R) {
          c.x = A.x0 + R;
          if (c.vx < 0) c.vx *= -0.55;
          hit = true;
        } else if (c.x > A.x1 - R) {
          c.x = A.x1 - R;
          if (c.vx > 0) c.vx *= -0.55;
          hit = true;
        }
        if (c.z < A.z0 + R) {
          c.z = A.z0 + R;
          if (c.vz < 0) c.vz *= -0.55;
          hit = true;
        } else if (c.z > A.z1 - R) {
          c.z = A.z1 - R;
          if (c.vz > 0) c.vz *= -0.55;
          hit = true;
        }
        return hit;
      }
      /** Avance une auto (la mienne ou un robot) : gaz et volant de −1 à 1. */
      function move(c, throttle, steer, dt, vmax) {
        const fx = Math.sin(c.h), fz = Math.cos(c.h);
        let vf = c.vx * fx + c.vz * fz, vl = c.vx * -fz + c.vz * fx;
        if (c.stun > 0) {
          c.stun -= dt;
          c.spin += (c.spinV || 9) * dt;
          vf -= vf * 1.6 * dt;
          vl -= vl * 1.6 * dt;
        } else {
          c.h += MF.angleDiff(0, c.spin); // la toupie finie, on repart dans le sens où l'on se retrouve
          c.spin = 0;
          vf += C.acc * throttle * (1 - Math.max(0, vf * Math.sign(throttle || 1)) / vmax) * dt;
          vf -= vf * C.drag * dt;
          vl -= vl * Math.min(1, C.grip * dt);
          c.h -= steer * C.turn * (0.3 + 0.7 * MF.clamp(Math.abs(vf) / 2, 0, 1)) * (vf < -0.2 ? -1 : 1) * dt;
        }
        const nfx = Math.sin(c.h), nfz = Math.cos(c.h);
        c.vx = nfx * vf - nfz * vl;
        c.vz = nfz * vf + nfx * vl;
        c.x += c.vx * dt;
        c.z += c.vz * dt;
        c.speed = vf;
      }
      /** Chocs de l'auto c contre les autres. onRam(autre, direction x, z, vitesse) quand c percute de l'avant. */
      function collide(c, list, selfId, onRam) {
        for (const o of list) {
          if (o.id === selfId) continue;
          const dx = c.x - o.x, dz = c.z - o.z, d = Math.hypot(dx, dz);
          if (d >= R * 2 || d < 1e-3) continue;
          const nx = dx / d, nz = dz / d;
          c.x += nx * (R * 2 - d);
          c.z += nz * (R * 2 - d);
          const vn = (c.vx - (o.vx || 0)) * nx + (c.vz - (o.vz || 0)) * nz;
          if (vn >= 0) continue;
          // suis-je en train de lui rentrer dedans par l'avant ?
          const facing = Math.sin(c.h) * -nx + Math.cos(c.h) * -nz;
          if (-vn > C.ram && facing > 0.5 && c.speed > 2 && !(c.stun > 0)) onRam(o, -nx, -nz, -vn);
          // rebond franc : les autos se séparent au lieu de rester collées à se pousser
          c.vx -= 1.7 * vn * nx;
          c.vz -= 1.7 * vn * nz;
          c.bumped = 0.25;
        }
      }
      function gather() {
        others.length = 0;
        for (const [uid, r] of remotes.map) if (r.obj.x !== undefined) others.push({ id: uid, x: r.obj.x, z: r.obj.z, vx: r.obj.vx || 0, vz: r.obj.vz || 0 });
        for (const b of bots) if (b.placed) others.push({ id: b.id, x: b.x, z: b.z, vx: b.vx, vz: b.vz });
      }
      function driveBots(dt, t, running) {
        const host = session.isHost();
        for (const b of bots) {
          if (!host) {
            // chez les autres joueurs : position lissée reçue de l'hôte
            if (b.it.sample(performance.now() / 1000, b.out)) {
              b.vx = (b.out[0] - b.x) / Math.max(dt, 1e-3);
              b.vz = (b.out[1] - b.z) / Math.max(dt, 1e-3);
              b.x = b.out[0];
              b.z = b.out[1];
              b.h = b.out[2];
              b.placed = true;
            }
            if (b.stun > 0) b.spin += 9 * dt;
            else b.spin = 0;
          } else {
            b.owned = true;
            let throttle = 0, steer = 0;
            if (running && !(b.stun > 0)) {
              // coincé ou tout juste cogné : marche arrière un instant, puis nouvelle charge
              b.slow = Math.abs(b.speed || 0) < 0.9 ? (b.slow || 0) + dt : 0;
              if ((b.slow > 0.5 || b.bumped > 0) && !(b.back > 0)) {
                b.back = 0.6 + ((b.wander * 7.3) % 0.5);
                b.slow = 0;
                b.bumped = 0;
              }
              if (b.back > 0) {
                b.back -= dt;
                throttle = -1;
                steer = Math.sin(b.wander * 3 + t) > 0 ? 0.8 : -0.8;
              } else {
                // le robot fonce sur l'auto la plus proche qui lui laisse de l'élan, avec un peu de fantaisie
                let best = null, bd = 1e9;
                const pick = (o) => {
                  const d = Math.hypot(o.x - b.x, o.z - b.z);
                  if (d > 2.4 && d < bd) {
                    bd = d;
                    best = o;
                  }
                };
                for (const o of others) if (o.id !== b.id) pick(o);
                if (me) pick(me);
                const tx = best ? best.x : CX, tz = best ? best.z : CZ;
                const err = MF.angleDiff(b.h, Math.atan2(tx - b.x, tz - b.z) + Math.sin(t * 0.9 + b.wander) * 0.35);
                steer = MF.clamp(-err * 2, -1, 1);
                throttle = Math.abs(err) > 1.4 ? 0.4 : 1;
              }
            }
            move(b, throttle, steer, dt, C.vmax * 0.72);
            walls(b);
            collide(b, others, b.id, (o, dx, dz, v) => {
              if (t - (b.last || -9) < 1.5 || o.id.startsWith("bot:")) return;
              b.last = t;
              session.send("choc", { to: o.id, x: dx, z: dz, v });
            });
            if (me) collide(b, [{ id: ctx.self.uid, x: me.x, z: me.z, vx: me.vx, vz: me.vz }], b.id, (o, dx, dz, v) => {
              if (t - (b.last || -9) < 1.5) return;
              b.last = t;
              me.vx += dx * v * 0.9;
              me.vz += dz * v * 0.9;
              me.stun = 0.8;
              me.spinV = 11;
              shake = 0.4;
              hud.flash("Aïe !", { color: MF.PAL.red, hold: 0.8 });
              MF.sfx.play("boing");
            });
          }
          b.car.group.visible = b.placed;
          b.car.group.position.set(b.x, DY, b.z);
          b.car.group.rotation.y = b.h + b.spin;
        }
        if (host && bots.length && performance.now() - lastBots > 100) {
          lastBots = performance.now();
          const msg = [Math.round(performance.now()) / 1000];
          for (const b of bots) msg.push(Math.round(b.x * 100) / 100, Math.round(b.z * 100) / 100, Math.round(b.h * 100) / 100, b.stun > 0 ? 1 : 0);
          session.send("robots", msg);
        }
      }

      return {
        car: () => me,
        bots,
        remotes,
        arena: A,
        enter() {
          input.use({ layout: "pilot", buttons: [{ id: "a", label: "TURBO", key: "Espace" }] });
          hud.stats([{ key: "score", label: "Chocs" }, { key: "time", label: "Temps" }, { key: "turbo", label: "Turbo" }]);
          hud.hint(input.touch ? "Manette : conduire · TURBO pour foncer" : "Flèches ou ZQSD : conduire · Espace : turbo");
          sway = 0;
        },
        leave: despawn,
        idle() {
          remotes.clear();
          setBots(0);
        },
        onPhase(state, prev) {
          if (state && state.phase === "countdown" && (!prev || prev.phase !== "countdown")) {
            // des robots complètent la piste jusqu'à cinq autos
            setBots(MF.clamp(5 - state.roster.length, 0, 4));
            placeBots(state.roster.length);
            if (ctx.active()) {
              if (session.inRoster()) spawn(session.slot());
              else despawn();
            }
          } else if (state && (state.phase === "lobby" || state.phase === "results") && prev && prev.phase !== state.phase) setBots(0);
        },
        update(dt, time) {
          remotes.update();
          const st = session.state, phase = st ? st.phase : "lobby";
          const t = session.time();
          const running = !!st && phase === "run" && t < DURATION;
          gather();
          if (phase === "run" || phase === "countdown") driveBots(dt, Math.max(0, t), running);
          if (!ctx.active()) return true;
          if (me && (phase === "countdown" || phase === "run")) {
            const S = input.state, go = running && !reported;
            me.cool = Math.max(0, me.cool - dt);
            me.turbo = Math.max(0, me.turbo - dt);
            if (go && S.hit.a && me.cool <= 0) {
              me.turbo = 1.2;
              me.cool = 5;
              hud.flash("Turbo !", { color: MF.PAL.yellow, hold: 0.7 });
              MF.sfx.play("swing");
            }
            move(me, go ? S.y : 0, go ? S.x : 0, dt, C.vmax * (me.turbo > 0 ? 1.5 : 1));
            if (walls(me) && Math.hypot(me.vx, me.vz) > 2.5) MF.sfx.play("toc");
            collide(me, others, ctx.self.uid, (o, dx, dz, v) => {
              if (!go || t - (immune.get(o.id) || -9) < 1) return;
              immune.set(o.id, t);
              me.score++;
              session.send("choc", { to: o.id, x: Math.round(dx * 100) / 100, z: Math.round(dz * 100) / 100, v: Math.round(v * 10) / 10 });
              hud.flash("BOUM ! +1", { color: MF.PAL.yellow, hold: 0.8 });
              MF.sfx.play("choc");
            });
            me.car.group.position.set(me.x, DY, me.z);
            me.car.group.rotation.y = me.h + me.spin;
            if (!engine) engine = MF.sfx.loop("moteur");
            engine.set(0.45 + Math.abs(me.speed) / C.vmax * 0.6, 0.45);
            remotes.send([me.x, me.z, me.h, me.spin], me.score);
            const left = Math.max(0, DURATION - Math.max(0, t));
            hud.set("score", me.score);
            hud.set("time", Math.ceil(left) + " s");
            hud.set("turbo", me.cool <= 0 ? "prêt" : Math.ceil(me.cool) + " s");
            if (running && left < 10 && !warned) {
              warned = true;
              hud.flash("Plus que 10 secondes !", { color: MF.PAL.yellow });
            }
            if (phase === "run" && t >= DURATION && !reported) {
              reported = true;
              session.report({ score: me.score });
            }
            shake = Math.max(0, shake - dt);
            MF.cam.fov(camera, 58);
            me.y = DY;
            MF.cam.chase(camera, camState, me, me.h, { dist: 5, height: 3.6, look: 1.6, up: 0.4, rate: 6, turn: 3.5 }, dt);
            if (shake > 0) camera.position.x += (Math.random() - 0.5) * shake * 0.5;
            if (time - lastBoard > 0.3) {
              lastBoard = time;
              hud.board(st.roster.map((p) => ({ name: p.name, color: p.color, self: p.uid === ctx.self.uid, score: p.uid === ctx.self.uid ? me.score : (remotes.get(p.uid) || { obj: {} }).obj.score || 0 })).sort((a, b) => b.score - a.score).map((r) => ({ name: r.name, color: r.color, self: r.self, text: String(r.score) })));
            }
          } else {
            if (engine) {
              engine.stop();
              engine = null;
            }
            if (phase === "lobby") {
              // mon auto attend au bord de la piste ; les autres inscrits la voient
              const slot = Math.max(0, session.slot());
              if (!me || me.slot !== slot) {
                spawn(slot);
                me.slot = slot;
              }
              me.car.group.position.set(me.x, DY, me.z);
              me.car.group.rotation.y = me.h;
              remotes.send([me.x, me.z, me.h, 0], 0);
            }
            sway += dt;
            MF.cam.set(camera, { x: A.x0 - 6.5, y: DY + 6.2, z: CZ + Math.sin(sway * 0.22) * 2.5 }, { x: CX + 1, y: DY + 0.6, z: CZ }, 52);
          }
          return true;
        },
      };
    },
  });
})();
