// La Fête du Moulin — auto-tamponneuses.
//
// 90 secondes de pagaille sous le pavillon : huit autos en piste (des robots complètent), deux
// piliers de pneus au milieu. On marque :
//   +1  en percutant une autre auto avec son avant ; +2 si le choc est violent (« SLAM ») ;
//   +2  en attrapant l'étoile qui apparaît toutes les sept secondes (elle recharge aussi le turbo) ;
//   la couronne : on la ramasse au centre, elle rapporte +1 toutes les quatre secondes tant qu'on
//   la porte ; percuter son porteur la lui vole (+2) ; un robot qui vous percute la fait tomber.
// Chacun simule son auto et l'envoie aux autres ; celui qui percute s'attribue le point et prévient
// sa victime (« choc »), qui part en toupie. Les robots sont conduits par l'hôte de la partie, qui
// diffuse leurs positions. Étoiles et couronne sont des objets disputés (session.claim) : tout le
// monde tombe d'accord sur qui les a eus.
(function () {
  "use strict";
  const MF = globalThis.MoulinFete;

  const A = { x0: 79, x1: 96, z0: -11.4, z1: 0.6 }; // la piste
  const CX = (A.x0 + A.x1) / 2, CZ = (A.z0 + A.z1) / 2, W = A.x1 - A.x0, D = A.z1 - A.z0;
  const R = 0.78; // rayon d'une auto (m)
  const DURATION = 90, CARS = 8;
  const C = { vmax: 7.4, acc: 13, drag: 0.9, grip: 5, turn: 3.5, ram: 2.4, slam: 6.2 };
  const PILLARS = [[CX - 2.9, CZ, 0.62], [CX + 2.9, CZ, 0.62]];
  const SPOTS = [
    [A.x0 + 1.6, A.z0 + 1.8, 1.2], [A.x1 - 1.6, A.z1 - 1.8, -1.9], [A.x1 - 1.6, A.z0 + 1.8, -1.2], [A.x0 + 1.6, A.z1 - 1.8, 1.9],
    [CX - 2.8, A.z0 + 1.5, 0], [CX + 2.8, A.z1 - 1.5, Math.PI], [CX + 2.8, A.z0 + 1.5, 0], [CX - 2.8, A.z1 - 1.5, Math.PI],
  ];
  const STAR_EVERY = 7, STAR_FIRST = 4, CROWN_EVERY = 4;

  function buildCar(color, name) {
    const g = MF.group({ name: "Auto_tamponneuse" });
    const paint = MF.mat(color, { unique: true });
    const shell = MF.group({ parent: g });
    const body = MF.cyl(R - 0.1, R - 0.04, 0.34, paint, { y: 0.27, parent: shell, seg: 18, cast: true });
    body.scale.z = 1.14;
    MF.torus(R - 0.02, 0.12, MF.PAL.black, { y: 0.17, rx: Math.PI / 2, parent: shell, seg: 20, tubeSeg: 7 }).scale.y = 1.14; // pare-chocs
    MF.box(0.2, 0.1, 1.2, MF.PAL.white, { y: 0.45, parent: shell }); // bande
    MF.box(0.66, 0.44, 0.14, MF.PAL.black, { y: 0.62, z: -0.42, parent: shell }); // dossier
    MF.box(0.54, 0.1, 0.42, MF.PAL.cream, { y: 0.46, z: -0.16, parent: shell });
    MF.torus(0.15, 0.028, MF.PAL.black, { y: 0.68, z: 0.2, rx: -0.9, parent: shell, seg: 12, tubeSeg: 5 }); // volant
    MF.cyl(0.02, 0.02, 0.3, MF.PAL.steel, { y: 0.56, z: 0.27, rx: -0.9, parent: shell, seg: 5 });
    for (const side of [-1, 1]) MF.sphere(0.085, MF.mat("#fff2b0", { emissive: "#ffe28a", emissiveIntensity: 0.9 }), { x: side * 0.3, y: 0.34, z: 0.7, parent: shell, seg: 6 });
    MF.cyl(0.022, 0.022, 2.75, MF.PAL.steel, { y: 1.8, z: -0.55, parent: shell, seg: 5 }); // perche
    MF.box(0.26, 0.04, 0.1, MF.PAL.steel, { y: 3.17, z: -0.55, parent: shell }); // patin sur la grille
    MF.box(0.32, 0.22, 0.012, paint, { x: 0.17, y: 2.6, z: -0.55, parent: shell }); // fanion
    MF.freeze(shell);
    const shadow = MF.blob(1.0, 0.36);
    shadow.position.y = 0.03;
    g.add(shadow);
    // la couronne, quand cette auto la porte
    const crown = buildCrown();
    crown.position.y = 1.2;
    crown.scale.setScalar(0.8);
    crown.visible = false;
    g.add(crown);
    if (name) {
      const tag = MF.tag(name, { scale: 0.45 });
      tag.position.y = 3.5;
      g.add(tag);
    }
    return { group: g, paint, crown };
  }
  function buildCrown() {
    const g = MF.group({ name: "Couronne" });
    const gold = MF.mat("#ffcf3a", { emissive: "#c79a12", emissiveIntensity: 0.6 });
    MF.cyl(0.36, 0.36, 0.2, gold, { y: 0.1, parent: g, seg: 12, open: true });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      MF.cone(0.1, 0.26, gold, { x: Math.sin(a) * 0.33, y: 0.33, z: Math.cos(a) * 0.33, parent: g, seg: 4 });
      MF.sphere(0.05, MF.PAL.red, { x: Math.sin(a) * 0.33, y: 0.48, z: Math.cos(a) * 0.33, parent: g, seg: 5 });
    }
    MF.freeze(g);
    return g;
  }

  MF.registerGame({
    id: "autos",
    title: "Bumper Cars",
    icon: "💥",
    color: MF.PAL.purple,
    blurb: "8 cars · stars, slams and a crown to steal",
    station: { x: CX, z: A.z1 + 2.6, heading: Math.PI },
    kiosk: { x: CX + 5.4, z: A.z1 + 1.9, heading: Math.PI },
    hall: { x: CX - 5.4, z: A.z1 + 1.9, heading: Math.PI },
    minPlayers: 1,
    maxPlayers: 8,
    maxTime: DURATION + 20,
    help: "Arrows or WASD: drive · Space: turbo. Ram with your nose (+1, hard slam +2), grab the stars (+2), hold the crown (+1 every 4 s) or steal it (+2).",
    rank: (list) => list.slice().sort((a, b) => (b.score || 0) - (a.score || 0) || (a.name < b.name ? -1 : 1)),
    describe: (r) => (r.score || 0) + " pts",
    board: { label: "Most points", better: "high", value: (r) => r.score, format: (v) => v + " pts" },

    create(ctx) {
      const { world, session, hud, input, group, camera } = ctx;
      const THREE = world.THREE;
      const H = world.heightAt;
      const DY = Math.max(H(A.x0, A.z0), H(A.x1, A.z0), H(A.x0, A.z1), H(A.x1, A.z1), H(CX, CZ)) + 0.12; // plancher
      const GRID = 3.2; // hauteur de la grille électrique

      /* ---------------------------------------------------------------- le pavillon (une fois) */
      const deco = MF.group({ name: "Piste_des_autos", parent: group });
      MF.box(W + 1.3, 0.9, D + 1.3, "#2f3640", { x: CX, y: DY - 0.45, z: CZ, parent: deco });
      MF.box(W, 0.02, D, "#59636f", { x: CX, y: DY + 0.011, z: CZ, parent: deco });
      // damier central et flèches de circulation
      for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++) if ((i + j) % 2) MF.box(0.9, 0.012, 0.9, "#e9eef5", { x: CX - 2.25 + i * 0.9, y: DY + 0.03, z: CZ - 0.45 + j * 0.9, parent: deco });
      // bordure en caoutchouc, liseré jaune
      for (const [x, z, w, d] of [[CX, A.z0 - 0.25, W + 1.0, 0.5], [CX, A.z1 + 0.25, W + 1.0, 0.5], [A.x0 - 0.25, CZ, 0.5, D], [A.x1 + 0.25, CZ, 0.5, D]]) {
        MF.box(w, 0.42, d, MF.PAL.black, { x, y: DY + 0.21, z, parent: deco, cast: true });
        MF.box(w + 0.02, 0.1, d + 0.02, MF.PAL.yellow, { x, y: DY + 0.39, z, parent: deco });
      }
      // piliers de pneus
      for (const [x, z, r] of PILLARS) {
        for (let k = 0; k < 4; k++) MF.torus(r - 0.14, 0.17, k % 2 ? MF.PAL.red : MF.PAL.black, { x, y: DY + 0.17 + k * 0.33, z, rx: Math.PI / 2, parent: deco, seg: 14, tubeSeg: 6 });
        MF.cyl(0.14, 0.14, GRID, MF.PAL.purple, { x, y: DY + GRID / 2, z, parent: deco, seg: 8, cast: true });
      }
      // quatre colonnes, grille électrique, lambrequin rayé et ampoules
      const corners = [[A.x0 - 0.3, A.z0 - 0.3], [A.x1 + 0.3, A.z0 - 0.3], [A.x1 + 0.3, A.z1 + 0.3], [A.x0 - 0.3, A.z1 + 0.3]];
      for (const [x, z] of corners) MF.cyl(0.17, 0.2, GRID + 1.3, MF.PAL.purple, { x, y: DY + (GRID + 1.3) / 2, z, parent: deco, seg: 10, cast: true });
      for (let i = 0; i <= 8; i++) MF.box(0.035, 0.035, D + 0.6, MF.PAL.steel, { x: A.x0 + (W * i) / 8, y: DY + GRID + 0.02, z: CZ, parent: deco });
      for (let j = 0; j <= 6; j++) MF.box(W + 0.6, 0.035, 0.035, MF.PAL.steel, { x: CX, y: DY + GRID + 0.02, z: A.z0 + (D * j) / 6, parent: deco });
      const valance = (x0, z0, x1, z1) => {
        const len = Math.hypot(x1 - x0, z1 - z0), n = Math.round(len / 0.85), a = Math.atan2(x1 - x0, z1 - z0);
        for (let i = 0; i < n; i++) {
          const t = (i + 0.5) / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
          MF.box(0.1, 0.62, len / n - 0.02, i % 2 ? MF.PAL.yellow : MF.PAL.purple, { x, y: DY + GRID + 0.62, z, ry: a, parent: deco, cast: true });
          const c = MF.props.BULBS[i % MF.props.BULBS.length];
          MF.sphere(0.09, MF.mat(c, { emissive: c, emissiveIntensity: 0.9 }), { x, y: DY + GRID + 0.26, z, parent: deco, seg: 6 });
        }
      };
      corners.forEach((c, i) => valance(c[0], c[1], corners[(i + 1) % 4][0], corners[(i + 1) % 4][1]));
      // fronton côté joueurs (sud) et bandeau du sponsor côté nord
      deco.add(MF.sign("BUMPER CARS", { w: 6.2, h: 0.85, bg: MF.PAL.purple, color: "#ffffff", border: MF.PAL.yellow, x: CX, y: DY + GRID + 1.55, z: A.z1 + 0.36 }));
      deco.add(MF.sponsors.board("autos-fronton", 5.0, 0.6, { x: CX, y: DY + GRID + 0.62, z: A.z1 + 0.42, kicker: "Bumper cars front sign" }));
      deco.add(MF.sponsors.board("autos-bandeau", 8.4, 0.8, { x: CX, y: DY + 1.3, z: A.z0 - 0.52, kicker: "Arena banner" }));
      MF.box(8.6, 0.9, 0.06, MF.PAL.woodDark, { x: CX, y: DY + 1.3, z: A.z0 - 0.57, parent: deco });
      // marches d'accès côté joueurs
      MF.box(5, 0.2, 1.1, MF.PAL.wood, { x: CX, y: DY - 0.02, z: A.z1 + 1.05, parent: deco });
      MF.freeze(deco);

      /* ---------------------------------------------------------------- étoile, couronne, étincelles */
      const star = MF.group({ name: "Etoile", parent: group });
      MF.mesh(new THREE.OctahedronGeometry(0.42), MF.mat("#ffe45c", { emissive: "#ffcf3a", emissiveIntensity: 0.9 }), { parent: star }).scale.set(1, 1, 0.4);
      MF.mesh(new THREE.OctahedronGeometry(0.42), MF.mat("#ffe45c", { emissive: "#ffcf3a", emissiveIntensity: 0.9 }), { parent: star, rz: Math.PI / 4 }).scale.set(1, 1, 0.4);
      star.visible = false;
      const crown = buildCrown();
      group.add(crown);
      const sparks = [];
      for (let i = 0; i < 22; i++) {
        const s = MF.sphere(0.07, MF.mat(i % 2 ? "#ffe45c" : "#ffffff", { basic: true }), { parent: group, seg: 4 });
        s.visible = false;
        sparks.push({ mesh: s, life: 0, vx: 0, vy: 0, vz: 0 });
      }
      let sparkIx = 0;
      function burst(x, y, z, n, power = 1) {
        for (let i = 0; i < n; i++) {
          const s = sparks[sparkIx++ % sparks.length];
          s.mesh.position.set(x, y, z);
          s.mesh.visible = true;
          s.life = 0.3 + Math.random() * 0.25;
          const a = Math.random() * Math.PI * 2;
          s.vx = Math.cos(a) * (1.5 + Math.random() * 3) * power;
          s.vz = Math.sin(a) * (1.5 + Math.random() * 3) * power;
          s.vy = 1.5 + Math.random() * 3;
        }
      }
      const confetti = MF.props.confetti(group, 40);

      /** Où est l'étoile n° k (tirée de la graine de la partie) ? */
      function starAt(seed, k) {
        const rnd = MF.rng(((seed >>> 0) ^ ((k + 1) * 2654435761)) >>> 0);
        for (let tries = 0; tries < 8; tries++) {
          const x = A.x0 + 1.6 + rnd() * (W - 3.2), z = A.z0 + 1.6 + rnd() * (D - 3.2);
          if (PILLARS.every((p) => Math.hypot(x - p[0], z - p[1]) > 1.8) && Math.hypot(x - CX, z - CZ) > 1.6) return [x, z];
        }
        return [CX, A.z0 + 2];
      }
      /** État de la couronne d'après les objets réclamés : { n, owner (uid ou null), since (s) }. */
      function crownState() {
        let n = 0;
        while (session.claims.has("c:" + n)) n++;
        if (!n || session.claims.has("d:" + (n - 1))) return { n, owner: null, since: 0 };
        const last = session.claims.get("c:" + (n - 1));
        return { n, owner: last.u, since: last.t / 1000 };
      }
      /** Points de couronne d'un joueur : +1 toutes les 4 secondes portées. */
      function crownPoints(uid, now) {
        let pts = 0;
        for (let k = 0; session.claims.has("c:" + k); k++) {
          const c = session.claims.get("c:" + k);
          if (c.u !== uid) continue;
          const end = session.claims.get("d:" + k) || session.claims.get("c:" + (k + 1));
          pts += Math.floor(Math.max(0, (end ? end.t / 1000 : now) - c.t / 1000) / CROWN_EVERY);
        }
        return pts;
      }
      const starPoints = (uid) => {
        let n = 0;
        for (const [key, c] of session.claims) if (key[0] === "s" && c.u === uid) n++;
        return n * 2;
      };

      /* ---------------------------------------------------------------- autos */
      let me = null; // { car, x, z, h, vx, vz, stun, spin, turbo, cool, hits }
      const camState = {};
      const immune = new Map(); // id de la victime → heure du dernier choc donné
      let engine = null, reported = false, warned = false, lastBoard = 0, sway = 0, shake = 0, lastCrownPts = 0, celebrated = 0;
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
        apply(car, v, extra) {
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
      const BOT_COLORS = ["#9aa3b2", "#c8b8a0", "#8fb39a", "#b79ac0", "#d3a08f", "#8fb0c7", "#c9c38f"];
      function setBots(n) {
        while (bots.length > n) {
          const b = bots.pop();
          group.remove(b.car.group);
          MF.dispose(b.car.group);
        }
        while (bots.length < n) {
          const i = bots.length, car = buildCar(BOT_COLORS[i % BOT_COLORS.length], "Robot " + (i + 1));
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
      function ouch(dx, dz, v, byBot) {
        me.vx += dx * v * 0.95;
        me.vz += dz * v * 0.95;
        me.stun = 0.75;
        me.spinV = 12 * (Math.random() < 0.5 ? -1 : 1);
        shake = 0.45;
        burst(me.x, DY + 0.5, me.z, 6);
        if (ctx.active()) {
          hud.flash("Ouch!", { color: MF.PAL.red, hold: 0.8 });
          MF.sfx.play("boing");
        }
        // un robot me percute alors que je porte la couronne : elle retombe au centre
        const cs = crownState();
        if (byBot && cs.owner === ctx.self.uid && session.claim("d:" + (cs.n - 1)) && ctx.active()) hud.flash("Crown lost!", { color: MF.PAL.red, hold: 1 });
      }
      session.on("choc", (d) => {
        if (!d || typeof d.to !== "string") return;
        const dx = +d.x || 0, dz = +d.z || 0, v = MF.clamp(+d.v || 3, 2, 10);
        if (d.to === ctx.self.uid && me) ouch(dx, dz, v, false);
        else if (d.to.startsWith("bot:") && session.isHost()) {
          const b = bots[+d.to.slice(4)];
          if (b) {
            b.vx += dx * v * 0.95;
            b.vz += dz * v * 0.95;
            b.stun = 0.9;
          }
        }
        if (Number.isFinite(d.px)) burst(+d.px, DY + 0.5, +d.pz, 5);
      });

      function spawn(slot) {
        if (!me) {
          me = { car: buildCar(ctx.self.color, null) };
          group.add(me.car.group);
        }
        me.car.paint.color.copy(MF.color(ctx.self.color));
        const s = SPOTS[slot % SPOTS.length];
        Object.assign(me, { x: s[0], z: s[1], h: s[2], vx: 0, vz: 0, stun: 0, spin: 0, spinV: 0, turbo: 0, cool: 0, hits: 0, score: 0, speed: 0 });
        camState.x = undefined;
        immune.clear();
        reported = warned = false;
        lastCrownPts = 0;
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
      /** Garde une auto dans la piste et hors des piliers ; renvoie vrai si elle a tapé. */
      function walls(c) {
        let hit = false;
        if (c.x < A.x0 + R) {
          c.x = A.x0 + R;
          if (c.vx < 0) c.vx *= -0.6;
          hit = true;
        } else if (c.x > A.x1 - R) {
          c.x = A.x1 - R;
          if (c.vx > 0) c.vx *= -0.6;
          hit = true;
        }
        if (c.z < A.z0 + R) {
          c.z = A.z0 + R;
          if (c.vz < 0) c.vz *= -0.6;
          hit = true;
        } else if (c.z > A.z1 - R) {
          c.z = A.z1 - R;
          if (c.vz > 0) c.vz *= -0.6;
          hit = true;
        }
        for (const [px, pz, pr] of PILLARS) {
          const dx = c.x - px, dz = c.z - pz, d = Math.hypot(dx, dz);
          if (d >= R + pr || d < 1e-3) continue;
          const nx = dx / d, nz = dz / d;
          c.x = px + nx * (R + pr);
          c.z = pz + nz * (R + pr);
          const vn = c.vx * nx + c.vz * nz;
          if (vn < 0) {
            c.vx -= 1.7 * vn * nx;
            c.vz -= 1.7 * vn * nz;
          }
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
          vf -= vf * 1.5 * dt;
          vl -= vl * 1.5 * dt;
        } else {
          c.h += MF.angleDiff(0, c.spin); // la toupie finie, on repart dans le sens où l'on se retrouve
          c.spin = 0;
          vf += C.acc * throttle * (1 - Math.max(0, vf * Math.sign(throttle || 1)) / vmax) * dt;
          vf -= vf * C.drag * dt;
          vl -= vl * Math.min(1, C.grip * dt);
          c.h -= steer * C.turn * (0.35 + 0.65 * MF.clamp(Math.abs(vf) / 2, 0, 1)) * (vf < -0.2 ? -1 : 1) * dt;
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
          if (-vn > C.ram && facing > 0.45 && c.speed > 2 && !(c.stun > 0)) onRam(o, -nx, -nz, -vn);
          // rebond franc : les autos se séparent au lieu de rester collées à se pousser
          c.vx -= 1.8 * vn * nx;
          c.vz -= 1.8 * vn * nz;
          c.bumped = 0.25;
        }
      }
      function gather() {
        others.length = 0;
        for (const [uid, r] of remotes.map) if (r.obj.x !== undefined) others.push({ id: uid, x: r.obj.x, z: r.obj.z, vx: r.obj.vx || 0, vz: r.obj.vz || 0 });
        for (const b of bots) if (b.placed) others.push({ id: b.id, x: b.x, z: b.z, vx: b.vx, vz: b.vz });
      }
      function driveBots(dt, t, running, cs) {
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
                b.back = 0.5 + ((b.wander * 7.3) % 0.5);
                b.slow = 0;
                b.bumped = 0;
              }
              if (b.back > 0) {
                b.back -= dt;
                throttle = -1;
                steer = Math.sin(b.wander * 3 + t) > 0 ? 0.8 : -0.8;
              } else {
                // le robot fonce sur le porteur de la couronne s'il y en a un, sinon sur l'auto la
                // plus proche qui lui laisse de l'élan ; un sur trois préfère tourner autour de la piste
                let best = null, bd = 1e9;
                const pick = (o, bonus = 0) => {
                  const d = Math.hypot(o.x - b.x, o.z - b.z) - bonus;
                  if (d > 2.2 - bonus && d < bd) {
                    bd = d;
                    best = o;
                  }
                };
                for (const o of others) if (o.id !== b.id) pick(o, o.id === cs.owner ? 5 : 0);
                if (me) pick(me, cs.owner === ctx.self.uid ? 5 : 0);
                let tx = best ? best.x : CX, tz = best ? best.z : CZ;
                if (Math.floor(b.wander) % 3 === 0 && bd > 4) {
                  const a = t * 0.6 + b.wander;
                  tx = CX + Math.sin(a) * (W / 2 - 2);
                  tz = CZ + Math.cos(a) * (D / 2 - 2);
                }
                const err = MF.angleDiff(b.h, Math.atan2(tx - b.x, tz - b.z) + Math.sin(t * 0.9 + b.wander) * 0.3);
                steer = MF.clamp(-err * 2, -1, 1);
                throttle = Math.abs(err) > 1.4 ? 0.4 : 1;
              }
            }
            move(b, throttle, steer, dt, C.vmax * 0.74);
            walls(b);
            collide(b, others, b.id, (o, dx, dz, v) => {
              if (t - (b.last || -9) < 1.5 || o.id.startsWith("bot:")) return;
              b.last = t;
              session.send("choc", { to: o.id, x: dx, z: dz, v, bot: 1 });
            });
            if (me)
              collide(b, [{ id: ctx.self.uid, x: me.x, z: me.z, vx: me.vx, vz: me.vz }], b.id, (o, dx, dz, v) => {
                if (t - (b.last || -9) < 1.5) return;
                b.last = t;
                ouch(dx, dz, v, true);
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
      // un robot a percuté un joueur porteur de la couronne chez un autre hôte : le message le dit
      session.on("choc", (d) => {
        if (!d || d.to !== ctx.self.uid || !d.bot || !me) return;
        const cs = crownState();
        if (cs.owner === ctx.self.uid && session.claim("d:" + (cs.n - 1)) && ctx.active()) hud.flash("Crown lost!", { color: MF.PAL.red, hold: 1 });
      });
      session.onClaim((key, uid) => {
        if (!ctx.active() && !session.players().length) return;
        if (key[0] === "s") MF.sfx.play("ting");
        if (key[0] === "c" && uid !== ctx.self.uid && ctx.active()) MF.sfx.play("bip");
      });

      return {
        car: () => me,
        bots,
        remotes,
        arena: A,
        crownState,
        enter() {
          input.use({ layout: "pilot", buttons: [{ id: "a", label: "TURBO", key: "Space" }] });
          hud.stats([{ key: "score", label: "Points" }, { key: "time", label: "Time" }, { key: "turbo", label: "Turbo" }]);
          hud.hint(input.touch ? "Stick: drive · TURBO to charge" : "Arrows or WASD: drive · Space: turbo · ram noses first, grab stars, steal the crown");
          sway = 0;
        },
        leave: despawn,
        idle() {
          remotes.clear();
          setBots(0);
          star.visible = false;
        },
        onPhase(state, prev) {
          if (state && state.phase === "countdown" && (!prev || prev.phase !== "countdown")) {
            // des robots complètent la piste jusqu'à huit autos
            setBots(MF.clamp(CARS - state.roster.length, 0, CARS - 1));
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
          const cs = running ? crownState() : { n: 0, owner: null };
          if (phase === "run" || phase === "countdown") driveBots(dt, Math.max(0, t), running, cs);
          for (const s of sparks) {
            if (s.life <= 0) continue;
            s.life -= dt;
            s.vy -= 9 * dt;
            s.mesh.position.x += s.vx * dt;
            s.mesh.position.y += s.vy * dt;
            s.mesh.position.z += s.vz * dt;
            if (s.life <= 0) s.mesh.visible = false;
          }
          confetti.update(dt);
          // l'étoile du moment
          const k = running ? Math.floor((t - STAR_FIRST) / STAR_EVERY) : -1;
          const starOn = k >= 0 && !session.claims.has("s:" + k);
          star.visible = starOn;
          let sx = 0, sz = 0;
          if (starOn) {
            [sx, sz] = starAt(st.seed, k);
            star.position.set(sx, DY + 0.85 + Math.sin(time * 4) * 0.12, sz);
            star.rotation.y = time * 3;
          }
          // la couronne : au centre tant que personne ne la porte, sinon sur l'auto de son porteur
          crown.visible = running && !cs.owner;
          if (crown.visible) {
            crown.position.set(CX, DY + 0.75 + Math.sin(time * 3) * 0.1, CZ);
            crown.rotation.y = time * 1.5;
          }
          for (const [uid, r] of remotes.map) r.obj.crown.visible = running && cs.owner === uid;
          if (me) me.car.crown.visible = running && cs.owner === ctx.self.uid;
          if (!ctx.active()) return true;
          if (me && (phase === "countdown" || phase === "run")) {
            const S = input.state, go = running && !reported;
            me.cool = Math.max(0, me.cool - dt);
            me.turbo = Math.max(0, me.turbo - dt);
            if (go && S.hit.a && me.cool <= 0) {
              me.turbo = 1.3;
              me.cool = 4;
              hud.flash("Turbo!", { color: MF.PAL.yellow, hold: 0.6 });
              MF.sfx.play("swing");
            }
            move(me, go ? S.y : 0, go ? S.x : 0, dt, C.vmax * (me.turbo > 0 ? 1.55 : 1));
            if (walls(me) && Math.hypot(me.vx, me.vz) > 2.5) {
              MF.sfx.play("toc");
              burst(me.x, DY + 0.4, me.z, 3, 0.6);
            }
            collide(me, others, ctx.self.uid, (o, dx, dz, v) => {
              if (!go || t - (immune.get(o.id) || -9) < 1) return;
              immune.set(o.id, t);
              const slam = v > C.slam;
              let gain = slam ? 2 : 1, text = slam ? "SLAM! +2" : "BOOM! +1";
              // la victime porte la couronne : je la lui vole
              if (cs.owner === o.id && session.claim("c:" + cs.n)) {
                gain += 2;
                text = "CROWN STOLEN! +" + gain;
                confetti.burst(me.x, DY + 1.4, me.z, 26);
                MF.sfx.play("bravo");
              }
              me.hits += gain;
              const px = (me.x + o.x) / 2, pz = (me.z + o.z) / 2;
              burst(px, DY + 0.5, pz, slam ? 10 : 6, slam ? 1.4 : 1);
              shake = slam ? 0.35 : 0.2;
              session.send("choc", { to: o.id, x: Math.round(dx * 100) / 100, z: Math.round(dz * 100) / 100, v: Math.round(v * 10) / 10, px: Math.round(px * 10) / 10, pz: Math.round(pz * 10) / 10 });
              hud.flash(text, { color: MF.PAL.yellow, hold: 0.8 });
              MF.sfx.play("choc");
            });
            if (go) {
              // étoile et couronne à portée
              if (starOn && Math.hypot(me.x - sx, me.z - sz) < R + 0.55 && session.claim("s:" + k)) {
                me.cool = 0;
                confetti.burst(sx, DY + 1, sz, 18);
                hud.flash("STAR! +2", { color: MF.PAL.yellow, hold: 0.8 });
              }
              if (!cs.owner && Math.hypot(me.x - CX, me.z - CZ) < R + 0.6 && session.claim("c:" + cs.n)) {
                confetti.burst(CX, DY + 1.2, CZ, 22);
                hud.flash("You wear the crown: +1 every 4 s", { color: MF.PAL.yellow, hold: 1.4 });
                MF.sfx.play("bravo");
              }
            }
            const crownPts = crownPoints(ctx.self.uid, Math.min(t, DURATION));
            if (crownPts > lastCrownPts && go) {
              lastCrownPts = crownPts;
              MF.sfx.play("ting");
            }
            me.score = me.hits + starPoints(ctx.self.uid) + crownPts;
            me.car.group.position.set(me.x, DY, me.z);
            me.car.group.rotation.y = me.h + me.spin;
            if (!engine) engine = MF.sfx.loop("moteur");
            engine.set(0.45 + (Math.abs(me.speed) / C.vmax) * 0.6, 0.45);
            remotes.send([me.x, me.z, me.h, me.spin], me.score);
            const left = Math.max(0, DURATION - Math.max(0, t));
            hud.set("score", me.score + (cs.owner === ctx.self.uid ? " 👑" : ""));
            hud.set("time", Math.ceil(left) + " s");
            hud.set("turbo", me.cool <= 0 ? "ready" : Math.ceil(me.cool) + " s");
            if (running && left < 10 && !warned) {
              warned = true;
              hud.flash("10 seconds left!", { color: MF.PAL.yellow });
            }
            if (phase === "run" && t >= DURATION && !reported) {
              reported = true;
              session.report({ score: me.score });
              if (time - celebrated > 5) {
                celebrated = time;
                confetti.burst(me.x, DY + 1.5, me.z, 30);
              }
            }
            shake = Math.max(0, shake - dt);
            MF.cam.fov(camera, 62);
            me.y = DY;
            MF.cam.chase(camera, camState, me, me.h, { dist: 5.4, height: 2.75, look: 1.9, up: 0.5, rate: 6.5, turn: 3.6 }, dt);
            if (shake > 0) {
              camera.position.x += (Math.random() - 0.5) * shake * 0.6;
              camera.position.y += (Math.random() - 0.5) * shake * 0.3;
            }
            if (time - lastBoard > 0.3) {
              lastBoard = time;
              hud.board(
                st.roster
                  .map((p) => ({ name: p.name + (cs.owner === p.uid ? " 👑" : ""), color: p.color, self: p.uid === ctx.self.uid, score: p.uid === ctx.self.uid ? me.score : (remotes.get(p.uid) || { obj: {} }).obj.score || 0 }))
                  .sort((a, b) => b.score - a.score)
                  .map((r) => ({ name: r.name, color: r.color, self: r.self, text: r.score + " pts" })),
              );
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
            MF.cam.set(camera, { x: CX + Math.sin(sway * 0.22) * 4, y: DY + 7.4, z: A.z1 + 8.6 }, { x: CX, y: DY + 0.4, z: CZ - 1 }, 54);
          }
          return true;
        },
      };
    },
  });
})();
