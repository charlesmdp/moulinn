// Dream Mill Fest — Hype Train (le petit train qui grandit, sur le plateau).
//
// On conduit la locomotive dans l'arène : elle va vers la souris (ou le doigt), ou tourne avec ← →.
// Chaque « like » ramassé ajoute un wagon, une étoile dorée en ajoute trois. Maintenir Espace (ou
// le clic) donne un coup d'accélérateur… qui brûle un wagon toutes les 0,7 s (« burn rate »).
// On est éliminé en percutant la barrière, ou le train d'un concurrent : les trains « Copycat »,
// « Big Corp » et « Stealth Startup » tournent dans l'arène et grandissent eux aussi, et les trains
// des autres joueurs y roulent en direct. Un concurrent qui percute vos wagons explose en likes.
// Plus la partie dure, plus les concurrents sont nombreux, longs et rapides. On peut croiser ses
// propres wagons. Le score est la plus grande longueur atteinte.
(function () {
  "use strict";
  const MF = globalThis.MoulinFete;
  const LIFT = 0.5, R = 8, GAP = 0.6, SPEED = 3.3, BOOST = 5.6, TURN = 3.3, STEP = 0.1, MAXW = 60, LIKES = 16;
  const BOTS = [["Copycat", "#7b4bd6"], ["Big Corp", "#3a3d46"], ["Stealth Startup", "#16a085"], ["Unicorn Inc", "#e84a8a"], ["Me-Too Labs", "#ff8a2a"]];

  MF.booth({
    id: "train",
    title: "Hype Train",
    icon: "🚂",
    color: "#e8402c",
    blurb: "Grow the longest train · crash into nobody · everyone shares the arena",
    help: "Steer your locomotive towards the mouse (or your finger), or turn with ← →. Every like adds a wagon, golden stars add three. Hold Space (or the click) to boost, at the cost of a wagon every 0.7 s. You are out if you hit the fence or another train; a rival that hits your wagons bursts into likes. Rival trains get longer, faster and more numerous. Your score is your longest train.",
    hint: "The train follows the mouse (or ← →) · hold Space to boost · avoid other trains",
    touchHint: "The train follows your finger · hold BOOST to speed up · avoid other trains",
    at: { x: -142.5, z: 29.5, face: Math.PI },
    stall: false,
    size: { w: 2 * R, d: 2 * R },
    hall: [R + 1.6, R + 0.4],
    maxTime: 900,
    cam: { y: 17.5, z: 12.5, look: [0, LIFT, 1.3], fov: 48 },
    cross: false,
    button: "BOOST",
    scoreLabel: "Wagons",
    stats: [{ key: "rivals", label: "Rivals" }],
    describe: (r) => "grew a train of " + (r.score || 0) + " wagons",
    board: { label: "Longest train", better: "high", value: (r) => r.score, format: (v) => v + " wagons" },
    setup(b) {
      const THREE = b.THREE, d = MF.group({ y: LIFT, parent: b.decor }), live = MF.group({ y: LIFT, parent: b.live });
      // l'arène : une estrade (le plateau penche un peu), un plancher clair, une barrière, l'enseigne au fond
      MF.cyl(R + 0.6, R + 0.6, 1.7, MF.PAL.woodDark, { y: -0.85, parent: d, seg: 40, cast: true });
      MF.cyl(R + 0.5, R + 0.5, 0.12, "#f3e3c2", { y: 0.06, parent: d, seg: 40 });
      MF.torus(R + 0.35, 0.16, MF.PAL.red, { y: 0.3, rx: Math.PI / 2, parent: d, seg: 40, tubeSeg: 6 });
      for (let i = 0; i < 20; i++) {
        const a = (i / 20) * Math.PI * 2;
        MF.cyl(0.07, 0.07, 0.5, "#ffffff", { x: Math.sin(a) * (R + 0.35), y: 0.25, z: Math.cos(a) * (R + 0.35), parent: d, seg: 6 });
      }
      const sign = MF.sign("HYPE TRAIN", { w: 3.2, h: 0.6, bg: "#e8402c", color: "#ffffff", border: MF.PAL.yellow, double: true });
      sign.position.set(0, 3.2, -R - 1.6);
      d.add(sign);
      for (const sx of [-1, 1]) MF.cyl(0.06, 0.06, 3.2, MF.PAL.woodDark, { x: sx * 1.6, y: 1.6, z: -R - 1.6, parent: d, seg: 6 });
      // wagons : un seul maillage instancié pour tous les trains
      const MAX = 420, cars = new THREE.InstancedMesh(new THREE.BoxGeometry(0.34, 0.3, 0.5), new THREE.MeshLambertMaterial({ color: 0xffffff }), MAX);
      cars.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      cars.frustumCulled = false;
      live.add(cars);
      const heads = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.2, 0.2, 0.62, 10), new THREE.MeshLambertMaterial({ color: 0xffffff }), 16);
      heads.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      heads.frustumCulled = false;
      live.add(heads);
      const halo = MF.torus(0.42, 0.05, MF.mat("#ffffff", { basic: true }), { rx: Math.PI / 2, parent: live, seg: 18, tubeSeg: 5 }); // ma locomotive
      const likeMat = MF.mat("#ff5a7a"), starMat = MF.mat("#ffc93a", { emissive: "#a36a00", emissiveIntensity: 0.5 });
      const likes = [];
      for (let i = 0; i < LIKES + 30; i++) {
        const m = MF.sphere(0.16, likeMat, { y: 0.3, parent: live, seg: 7 });
        m.visible = false;
        likes.push({ m, x: 0, z: 0, star: false, live: false });
      }
      const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3(1, 1, 1), UP = new THREE.Vector3(0, 1, 0), C = new THREE.Color();
      const QX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
      /** Un train : tête (x, z, cap a), nombre de wagons, trace du chemin parcouru. */
      const make = (name, color) => ({ name, color, x: 0, z: 0, a: 0, n: 3, trail: [], live: false, wait: 0, want: 0, tick: 0 });
      const me = make("", b.ctx.self.color), bots = BOTS.map(([name, color]) => make(name, color)), ghosts = new Map();
      function place(tr, x, z, a, n) {
        Object.assign(tr, { x, z, a, n, live: true, trail: [] });
        for (let i = 0; i < n * (GAP / STEP) + 2; i++) tr.trail.push([x - Math.sin(a) * i * STEP, z - Math.cos(a) * i * STEP]);
      }
      /** Avance la tête ; la trace garde un point tous les 10 cm, juste assez pour ses wagons. */
      function advance(tr, dist, ux = Math.sin(tr.a), uz = Math.cos(tr.a)) {
        tr.x += ux * dist;
        tr.z += uz * dist;
        const last = tr.trail[0];
        if (!last || Math.hypot(tr.x - last[0], tr.z - last[1]) >= STEP) tr.trail.unshift([tr.x, tr.z]);
        const need = Math.ceil((tr.n * GAP) / STEP) + 3;
        if (tr.trail.length > need) tr.trail.length = need;
      }
      const wagon = (tr, i) => tr.trail[Math.min(tr.trail.length - 1, Math.round(((i + 1) * GAP) / STEP))];
      function scatter(tr) {
        // un train éliminé laisse ses wagons en likes
        for (let i = 0; i < tr.n; i += 2) {
          const w = wagon(tr, i), l = likes.find((q) => !q.live);
          if (w && l && Math.hypot(w[0], w[1]) < R - 0.4) Object.assign(l, { x: w[0], z: w[1], star: false, live: true });
        }
      }
      const hits = (tr, x, z, skip = 0) => {
        if (!tr.live) return false;
        for (let i = skip; i < tr.n; i++) {
          const w = wagon(tr, i);
          if (w && Math.hypot(w[0] - x, w[1] - z) < 0.36) return true;
        }
        return Math.hypot(tr.x - x, tr.z - z) < 0.4;
      };
      function spawnLike() {
        const l = likes.slice(0, LIKES).find((q) => !q.live);
        if (!l) return;
        const a = b.rand() * Math.PI * 2, r = Math.sqrt(b.rand()) * (R - 0.8);
        Object.assign(l, { x: Math.sin(a) * r, z: Math.cos(a) * r, star: b.rand() < 0.1, live: true });
      }
      let dead = 0, best = 0, burn = 0, active = 0, wave = 0, sendAt = 0, target = new THREE.Vector3();
      b.session.on("tr", (data, peer) => {
        // le train d'un autre joueur : [x, z, cap, wagons, en vie]
        if (!Array.isArray(data)) return;
        let g = ghosts.get(peer.uid);
        if (!g) ghosts.set(peer.uid, (g = make(peer.name, peer.color)));
        g.color = peer.color;
        if (!data[4]) return void (g.live = false);
        if (!g.live || Math.hypot(g.x - data[0], g.z - data[1]) > 2.5) place(g, +data[0] || 0, +data[1] || 0, +data[2] || 0, MF.clamp(+data[3] || 3, 1, MAXW));
        g.tx = +data[0] || 0;
        g.tz = +data[1] || 0;
        g.a = +data[2] || 0;
        g.n = MF.clamp(+data[3] || 3, 1, MAXW);
        g.seen = b.time;
      });
      function start() {
        dead = burn = wave = 0;
        for (const l of likes) l.live = false;
        for (const g of ghosts.values()) g.live = false;
        const a0 = b.rand() * 6.28;
        place(me, Math.sin(a0) * 2, Math.cos(a0) * 2, a0 + Math.PI / 2, 3);
        me.color = b.ctx.self.color;
        best = 3;
        bots.forEach((bot, i) => {
          bot.live = false;
          bot.wait = i < 3 ? 1 + i * 1.5 : 1e9; // les deux derniers entrent plus tard
        });
        active = 3;
        for (let i = 0; i < 10; i++) spawnLike();
      }
      function draw() {
        let k = 0, h = 0;
        const put = (tr) => {
          if (!tr.live) return;
          C.set(tr.color).convertSRGBToLinear();
          for (let i = 0; i < tr.n && k < MAX; i++) {
            const w = wagon(tr, i), w2 = wagon(tr, i - 1) || [tr.x, tr.z];
            if (!w) break;
            P.set(w[0], 0.3, w[1]);
            Q.setFromAxisAngle(UP, Math.atan2(w2[0] - w[0], w2[1] - w[1]));
            cars.setMatrixAt(k, M.compose(P, Q, S));
            cars.setColorAt(k++, C);
          }
          if (h < 16) {
            P.set(tr.x, 0.36, tr.z);
            Q.setFromAxisAngle(UP, tr.a).multiply(QX);
            heads.setMatrixAt(h, M.compose(P, Q, S));
            heads.setColorAt(h++, C);
          }
        };
        put(me);
        halo.visible = me.live;
        halo.position.set(me.x, 0.14, me.z);
        bots.forEach(put);
        for (const g of ghosts.values()) put(g);
        cars.count = k;
        heads.count = h;
        cars.instanceMatrix.needsUpdate = heads.instanceMatrix.needsUpdate = true;
        if (cars.instanceColor) cars.instanceColor.needsUpdate = true;
        if (heads.instanceColor) heads.instanceColor.needsUpdate = true;
        for (const l of likes) {
          l.m.visible = l.live;
          if (!l.live) continue;
          l.m.material = l.star ? starMat : likeMat;
          l.m.position.set(l.x, 0.32 + Math.sin(b.time * 4 + l.x) * 0.06, l.z);
          l.m.scale.setScalar(l.star ? 1.5 : 1);
        }
      }
      start();
      draw();
      return {
        reset: start,
        camX: () => 0,
        view(_, from, to) {
          const k = Math.max(1, 1.25 / (b.camera.aspect || 1));
          from.set(to.x + (from.x - to.x) * k, to.y + (from.y - to.y) * k, to.z + (from.z - to.z) * k);
        },
        update() {
          const dt = Math.min(b.dt, 0.05), K = b.input.state, t = b.t;
          if (b.playing && !dead) {
            // direction : flèches (on tourne), sinon vers le point visé au sol
            if (K.x) me.a -= K.x * TURN * dt;
            else if (!b.aim.keys && b.hit(LIFT + 0.3, "y", target)) me.a += MF.clamp(MF.angleDiff(me.a, Math.atan2(target.x - me.x, target.z - me.z)), -TURN * dt, TURN * dt);
            const boost = (K.a || (b.hold && !b.input.touch)) && me.n > 2; // au doigt, on dirige en le posant : seul le bouton accélère
            if (boost) {
              burn += dt;
              if (burn > 0.7) {
                burn = 0;
                me.n--;
              }
            }
            advance(me, (boost ? BOOST : SPEED) * dt);
            for (const l of likes)
              if (l.live && Math.hypot(l.x - me.x, l.z - me.z) < 0.55) {
                l.live = false;
                me.n = Math.min(MAXW, me.n + (l.star ? 3 : 1));
                MF.sfx.play(l.star ? "bravo" : "ting");
              }
            if (likes.slice(0, LIKES).filter((l) => l.live).length < 9 + Math.min(5, t / 20)) spawnLike();
            best = Math.max(best, me.n);
            b.score = best;
            // les concurrents : de plus en plus nombreux, rapides et longs
            wave = Math.min(1, t / 150);
            if (active < bots.length && t > 35 + (active - 3) * 40) bots[active++].wait = 0.5;
            for (const bot of bots) {
              if (!bot.live) {
                bot.wait -= dt;
                if (bot.wait <= 0) {
                  const a = b.rand() * 6.28, far = Math.hypot(Math.sin(a) * (R - 1.5) - me.x, Math.cos(a) * (R - 1.5) - me.z);
                  if (far > 4) place(bot, Math.sin(a) * (R - 1.5), Math.cos(a) * (R - 1.5), a + Math.PI * 0.6, 3 + Math.round(wave * 8));
                  else bot.wait = 0.5;
                }
                continue;
              }
              // pilotage : vers le like le plus proche, en s'écartant de la barrière et des wagons droit devant
              bot.tick -= dt;
              if (bot.tick <= 0) {
                bot.tick = 0.18;
                let goal = null, gd = 1e9;
                for (const l of likes) if (l.live && Math.hypot(l.x - bot.x, l.z - bot.z) < gd) ((gd = Math.hypot(l.x - bot.x, l.z - bot.z)), (goal = l));
                bot.want = goal ? Math.atan2(goal.x - bot.x, goal.z - bot.z) : bot.a + 0.4;
                const ax = bot.x + Math.sin(bot.a) * 1.3, az = bot.z + Math.cos(bot.a) * 1.3;
                if (Math.hypot(ax, az) > R - 0.9) bot.want = Math.atan2(-bot.x, -bot.z);
                else if (hits(me, ax, az) || bots.some((o) => o !== bot && hits(o, ax, az))) bot.want = bot.a + (b.rand() < 0.5 ? 1.6 : -1.6) * (b.rand() < 0.75 - wave * 0.3 ? 1 : 0);
              }
              bot.a += MF.clamp(MF.angleDiff(bot.a, bot.want), -TURN * 0.9 * dt, TURN * 0.9 * dt);
              advance(bot, SPEED * (0.72 + wave * 0.42) * dt);
              for (const l of likes)
                if (l.live && Math.hypot(l.x - bot.x, l.z - bot.z) < 0.55) {
                  l.live = false;
                  bot.n = Math.min(26 + Math.round(wave * 20), bot.n + (l.star ? 3 : 1));
                }
              if (Math.hypot(bot.x, bot.z) > R - 0.2 || hits(me, bot.x, bot.z, 0) || bots.some((o) => o !== bot && hits(o, bot.x, bot.z))) {
                if (Math.hypot(bot.x - me.x, bot.z - me.z) < 3) b.hud.pop(bot.name + " derailed!", ...b.screen(P.set(bot.x, LIFT + 0.6, bot.z)));
                scatter(bot);
                bot.live = false;
                bot.wait = 2.5;
              }
            }
            let killer = Math.hypot(me.x, me.z) > R - 0.15 ? "the fence" : "";
            for (const bot of bots) if (!killer && hits(bot, me.x, me.z)) killer = bot.name;
            for (const g of ghosts.values()) if (!killer && hits(g, me.x, me.z)) killer = g.name || "another player";
            if (killer) {
              dead = t;
              scatter(me);
              me.live = false;
              b.session.send("tr", [0, 0, 0, 0, 0]);
              b.hud.flash("Crashed into " + killer + " · " + best + " wagons", { color: MF.PAL.yellow, hold: 1.8 });
              MF.sfx.play("choc");
              b.finish();
            } else if (b.time - sendAt > 0.1) {
              sendAt = b.time;
              b.session.send("tr", [+me.x.toFixed(2), +me.z.toFixed(2), +me.a.toFixed(2), me.n, 1]);
            }
          }
          // les trains des autres joueurs : on rejoint leur dernière position connue
          for (const g of ghosts.values()) {
            if (!g.live) continue;
            if (b.time - g.seen > 2) g.live = false;
            else {
              const far = Math.hypot(g.tx - g.x, g.tz - g.z);
              if (far > 0.01) advance(g, Math.min(far, BOOST * 1.3 * dt), (g.tx - g.x) / far, (g.tz - g.z) / far);
            }
          }
          draw();
        },
        hud() {
          b.hud.set("rivals", bots.filter((q) => q.live).length + [...ghosts.values()].filter((g) => g.live).length);
        },
        idle() {
          draw();
        },
        probe: () => ({ x: me.x, z: me.z, a: me.a, n: me.n, dead: !!dead, bots: bots.filter((q) => q.live).length }), // pour les essais automatiques
      };
    },
  });
})();
