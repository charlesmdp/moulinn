// Dream Mill Fest — Garage Grand Prix (la course vue du dessus, comme dans les vieux jeux, sur le plateau).
//
// Tout le circuit tient à l'écran, vu d'en haut. La voiture accélère toute seule : on tourne avec
// ← → (commandes « char » : gauche et droite du pilote), ou elle va vers la souris / le doigt ;
// Espace, ↓ ou le clic maintenu freinent — freiner en tournant fait partir l'arrière (dérapage).
// L'herbe ralentit beaucoup, les flaques d'huile font glisser. Cinq tours, huit secteurs à passer
// dans l'ordre (impossible de couper). Le score est le temps des cinq tours ; le tableau montre
// aussi le meilleur tour. Les voitures des autres joueurs roulent en direct sur le même circuit.
(function () {
  "use strict";
  const MF = globalThis.MoulinFete;
  const LIFT = 0.5, LAPS = 5, HW = 1.05, VMAX = 8.6, VGRASS = 3.4, ACC = 9, TURN = 3.1, SECTORS = 8, PX = 9.9, PZ = 4.9;
  const LINE = [[-8.2, -1.5], [-7, -3.4], [-3.5, -3.6], [-0.5, -2.2], [2.5, -3.6], [6.5, -3.4], [8.3, -1.2], [8.2, 1.8], [6.4, 3.5], [3, 3.3], [0.6, 1.4], [-2.2, 0.3], [-3.2, 2.6], [-5.6, 3.6], [-8, 2.6]];

  MF.booth({
    id: "grandprix",
    title: "Garage Grand Prix",
    icon: "🏎️",
    color: "#e8402c",
    blurb: "Top-down racing like the old arcade games · 5 laps against the clock",
    help: "The whole track fits on the screen, seen from above. Your car accelerates by itself: steer with ← → (the driver's left and right), or let it follow the mouse or your finger. Space, ↓ or holding the click brakes; braking while turning makes the car drift. Grass slows you down a lot and oil makes you slide. Five laps, eight sectors to pass in order. Your score is your total time.",
    hint: "← → to steer (or the mouse) · Space to brake and drift · stay off the grass",
    touchHint: "The car follows your finger · BRAKE to drift · stay off the grass",
    at: { x: -111, z: 5.5, face: Math.PI },
    stall: false,
    size: { w: 20, d: 10 },
    hall: [11.6, 5.2],
    maxTime: 420,
    cam: { y: 18, z: 3.2, look: [0, LIFT, 0.3], fov: 44 },
    cross: false,
    button: "BRAKE",
    scoreLabel: "Lap",
    stats: [{ key: "time", label: "Time" }, { key: "last", label: "Last lap" }, { key: "best", label: "Best lap" }],
    scoreText: (b) => Math.min(LAPS, Math.floor(b.score / 100) + 1) + " / " + LAPS,
    liveText: (v) => (v >= LAPS * 100 ? "finished" : "lap " + (Math.floor(v / 100) + 1) + " · " + (v % 100) + " %"),
    rank: (list) => list.slice().sort((a, c) => (a.time ? 0 : 1) - (c.time ? 0 : 1) || (a.time || 0) - (c.time || 0) || (c.laps || 0) - (a.laps || 0)),
    describe: (r) => (r.time ? LAPS + " laps in " + MF.time(r.time) + " (best lap " + (r.best || 0).toFixed(2) + " s)" : "stopped after " + (r.laps || 0) + " laps"),
    board: { label: "Fastest " + LAPS + " laps", better: "low", value: (r) => r.time, format: (v) => MF.time(v) },
    setup(b) {
      const THREE = b.THREE, d = MF.group({ y: LIFT, parent: b.decor }), flat = MF.group({ y: LIFT, parent: b.live });
      const track = MF.path(LINE, { closed: true, step: 0.4 }), L = track.length;
      // une estrade : le plateau penche un peu, la piste est posée bien à plat dessus
      MF.box(2 * PX + 0.8, 1.7, 2 * PZ + 0.8, MF.PAL.woodDark, { y: -0.85, parent: d, cast: true });
      // la piste : un ruban d'asphalte sur un ruban blanc un peu plus large (les bords), sur l'herbe
      MF.box(2 * PX + 0.8, 0.12, 2 * PZ + 0.8, "#6db84c", { y: 0.06, parent: d });
      const ribbon = (half, y, color) => {
        const n = track.pts.length, pos = new Float32Array(n * 6), idx = [];
        track.pts.forEach((p, i) => {
          pos.set([p.x + p.tz * half, y, p.z - p.tx * half, p.x - p.tz * half, y, p.z + p.tx * half], i * 6);
          const j = (i + 1) % n;
          idx.push(i * 2, i * 2 + 1, j * 2, i * 2 + 1, j * 2 + 1, j * 2);
        });
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        g.setIndex(idx);
        g.computeVertexNormals();
        const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }));
        m.receiveShadow = true;
        flat.add(m); // hors du décor fusionné
      };
      ribbon(HW + 0.14, 0.13, 0xffffff);
      ribbon(HW, 0.14, 0x4a4f5a);
      // ligne de départ en damier, bottes de paille aux angles, les garages (tout a commencé dans un garage)
      const p0 = track.at(0), a0 = Math.atan2(p0.tx, p0.tz);
      for (let i = 0; i < 6; i++) MF.box(0.33, 0.02, 0.3, i % 2 ? "#ffffff" : "#1d1e22", { x: p0.x + p0.tz * (i - 2.5) * 0.34, y: 0.155, z: p0.z - p0.tx * (i - 2.5) * 0.34, ry: a0, parent: d });
      for (const [x, z] of [[-9.4, -4.4], [9.4, -4.4], [9.4, 4.4], [-9.4, 4.4], [0.4, -0.3], [-5.4, 0.6], [4.6, 0.2]]) MF.box(0.7, 0.5, 0.7, "#e9c46a", { x, y: 0.37, z, parent: d, cast: true });
      for (let i = 0; i < 3; i++) {
        MF.box(2.2, 1.5, 1.4, ["#dfe6ee", "#f3e3c2", "#dfe6ee"][i], { x: -2.6 + i * 2.6, y: 0.87, z: -PZ - 1.5, parent: d, cast: true });
        MF.box(1.7, 1.1, 0.06, ["#e8402c", "#2f7fd8", "#ffc93a"][i], { x: -2.6 + i * 2.6, y: 0.7, z: -PZ - 0.78, parent: d });
      }
      const sign = MF.sign("GARAGE GRAND PRIX", { w: 6.4, h: 0.7, bg: "#e8402c", color: "#ffffff", border: MF.PAL.yellow });
      sign.position.set(0, 2.1, -PZ - 1.5);
      sign.rotation.x = -0.9; // couchée vers le ciel : on la lit depuis la caméra, tout en haut
      d.add(sign);
      const oils = [0.31, 0.74].map((u, i) => {
        const p = track.at(u * L), side = i ? 0.4 : -0.35;
        const o = { x: p.x + p.tz * side, z: p.z - p.tx * side };
        MF.cyl(0.55, 0.55, 0.01, "#15161b", { x: o.x, y: 0.15, z: o.z, parent: d, seg: 12 }).scale.set(1, 1, 0.7);
        return o;
      });
      function carMesh(color) {
        const g = MF.group();
        MF.box(0.5, 0.2, 0.96, color, { y: 0.2, parent: g, cast: true });
        MF.box(0.36, 0.14, 0.4, "#1d2b3a", { y: 0.36, z: -0.06, parent: g });
        MF.box(0.52, 0.04, 0.1, "#ffffff", { y: 0.31, z: 0.36, parent: g });
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) MF.box(0.1, 0.18, 0.24, "#15161b", { x: sx * 0.28, y: 0.11, z: sz * 0.3, parent: g });
        return MF.freeze(g);
      }
      const holder = MF.group({ y: LIFT + 0.14, parent: b.live });
      let mine = null;
      const ghosts = new Map();
      const car = { x: 0, z: 0, a: 0, vx: 0, vz: 0 };
      let s = 0, gate = 0, laps = 0, lapStart = 0, last = 0, best = 0, done = 0, slip = 0, spin = 0, sendAt = 0, skid = 0, started = false;
      const target = new THREE.Vector3();
      b.session.on("gp", (data, peer) => {
        if (!Array.isArray(data)) return;
        let g = ghosts.get(peer.uid);
        if (!g) {
          g = { mesh: carMesh(peer.color), x: +data[0] || 0, z: +data[1] || 0, a: +data[2] || 0 };
          holder.add(g.mesh);
          ghosts.set(peer.uid, g);
        }
        Object.assign(g, { tx: +data[0] || 0, tz: +data[1] || 0, ta: +data[2] || 0, seen: b.time });
      });
      /** Place sur la grille de départ, selon mon rang dans la liste des joueurs. */
      function grid() {
        const slot = Math.max(0, b.slot || 0), p = track.at(L - 0.9 - Math.floor(slot / 2) * 1.3), side = slot % 2 ? 0.5 : -0.5;
        Object.assign(car, { x: p.x + p.tz * side, z: p.z - p.tx * side, a: Math.atan2(p.tx, p.tz), vx: 0, vz: 0 });
        s = p.s;
      }
      function start() {
        if (mine) MF.dispose(mine);
        mine = carMesh(b.ctx.self.color);
        holder.add(mine);
        gate = SECTORS - 1;
        laps = last = best = done = slip = spin = skid = 0;
        lapStart = 0;
        started = false;
        grid();
        draw();
      }
      function draw() {
        mine.position.set(car.x, 0, car.z);
        mine.rotation.y = car.a + spin;
        for (const g of ghosts.values()) {
          g.mesh.visible = b.time - g.seen < 3;
          g.x = MF.damp(g.x, g.tx, 12, b.dt);
          g.z = MF.damp(g.z, g.tz, 12, b.dt);
          g.a = MF.dampAngle(g.a, g.ta, 12, b.dt);
          g.mesh.position.set(g.x, 0, g.z);
          g.mesh.rotation.y = g.a;
        }
      }
      start();
      return {
        reset: start,
        camX: () => 0,
        view(_, from, to) {
          // écran étroit : on monte pour voir tout le circuit
          const k = Math.max(1, 1.5 / (b.camera.aspect || 1));
          from.set(to.x + (from.x - to.x) * k, to.y + (from.y - to.y) * k, to.z + (from.z - to.z) * k);
        },
        update() {
          const dt = Math.min(b.dt, 0.05), K = b.input.state, t = b.t;
          if (b.t < 0) grid(); // décompte : sur la grille
          if (b.playing && !done) {
            const near = track.nearest(car.x, car.z, s, true) || { s, d: 0 };
            s = near.s;
            const off = Math.abs(near.d) > HW, brake = K.a || K.y < -0.5 || (b.hold && !K.x && !b.input.touch); // au doigt, on dirige en le posant : seul le bouton freine
            const speed = Math.hypot(car.vx, car.vz);
            // direction : flèches (gauche et droite du pilote), sinon vers le point visé
            const rate = TURN * MF.clamp(speed / 3, 0.25, 1) * dt;
            if (K.x) car.a -= K.x * rate;
            else if (!b.aim.keys && b.hit(LIFT + 0.14, "y", target) && Math.hypot(target.x - car.x, target.z - car.z) > 0.6) car.a += MF.clamp(MF.angleDiff(car.a, Math.atan2(target.x - car.x, target.z - car.z)), -rate, rate);
            // flaques d'huile : on glisse une seconde
            for (const o of oils)
              if (slip <= 0 && Math.hypot(o.x - car.x, o.z - car.z) < 0.6 && speed > 2) {
                slip = 0.9;
                b.hud.flash("Oil!", { color: "#ffb347", hold: 0.5 });
                MF.sfx.play("swing");
              }
            slip = Math.max(0, slip - dt);
            spin = slip > 0 ? spin + dt * 9 : MF.damp(spin % (Math.PI * 2), 0, 10, dt);
            // moteur, frein, adhérence : la vitesse revient vers l'axe de la voiture plus ou moins vite
            const fx = Math.sin(car.a), fz = Math.cos(car.a), vmax = off ? VGRASS : VMAX;
            let along = car.vx * fx + car.vz * fz;
            along += (brake ? -along * 2.6 : along < vmax ? ACC : -(along - vmax) * 4) * dt;
            if (off && along > vmax) along -= (along - vmax) * 5 * dt;
            const grip = slip > 0 ? 0.6 : brake ? 2.2 : off ? 4 : 7.5, keep = Math.exp(-grip * dt);
            const lx = (car.vx - (car.vx * fx + car.vz * fz) * fx) * keep, lz = (car.vz - (car.vx * fx + car.vz * fz) * fz) * keep;
            car.vx = fx * along + lx;
            car.vz = fz * along + lz;
            const lateral = Math.hypot(lx, lz);
            if (lateral > 1.6 && b.time - skid > 0.35) {
              skid = b.time;
              MF.sfx.play("swing");
            }
            car.x += car.vx * dt;
            car.z += car.vz * dt;
            // les bords du plateau
            if (Math.abs(car.x) > PX) {
              car.x = Math.sign(car.x) * PX;
              car.vx *= -0.3;
            }
            if (Math.abs(car.z) > PZ) {
              car.z = Math.sign(car.z) * PZ;
              car.vz *= -0.3;
            }
            // secteurs dans l'ordre ; le tour est compté en repassant la ligne
            const sector = Math.floor((s / L) * SECTORS) % SECTORS;
            if (!off && sector === (gate + 1) % SECTORS) {
              gate = sector;
              if (sector === 0) {
                if (!started) started = true; // premier passage : le départ
                else {
                  laps++;
                  last = t - lapStart;
                  best = best ? Math.min(best, last) : last;
                  MF.sfx.play("tour");
                  if (laps >= LAPS) {
                    done = Math.round(t * 100) / 100;
                    b.hud.flash("Chequered flag! " + MF.time(done), { color: MF.PAL.yellow, hold: 1.8 });
                    MF.sfx.play("bravo");
                    b.finish();
                  } else b.hud.flash(laps === LAPS - 1 ? "Final lap!" : "Lap " + (laps + 1), { hold: 0.8 });
                }
                lapStart = t;
              }
            }
            b.score = Math.min(LAPS * 100, laps * 100 + (started ? Math.min(99, Math.floor((s / L) * 100)) : 0));
            if (b.time - sendAt > 0.1) {
              sendAt = b.time;
              b.session.send("gp", [+car.x.toFixed(2), +car.z.toFixed(2), +car.a.toFixed(2)]);
            }
          }
          draw();
        },
        hud() {
          b.hud.set("time", MF.time(done || Math.max(0, b.t)));
          b.hud.set("last", last ? last.toFixed(2) + " s" : "–");
          b.hud.set("best", best ? best.toFixed(2) + " s" : "–");
        },
        result: () => (done ? { time: done, best: Math.round(best * 100) / 100, laps: LAPS } : { dnf: true, laps }),
        idle() {
          draw();
        },
        probe: () => ({ x: car.x, z: car.z, a: car.a, s, laps, gate, done, L, at: (q) => track.at(q) }), // pour les essais automatiques
      };
    },
  });
})();
