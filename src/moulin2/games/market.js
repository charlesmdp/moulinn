// Dream Mill Fest — Go To Market (la traversée, sur la rive sud du Grand étang).
//
// On avance d'une case à la fois vers le marché, le plus loin possible : flèches ou ZQSD (↑ avancer,
// ← → de côté, ↓ reculer), Espace pour avancer, ou un clic (au milieu : avancer ; à gauche ou à
// droite : de côté ; tout en bas : reculer). Devant, des rangées :
//   – les routes, où passent les voitures de la concurrence : on se glisse entre deux ;
//   – les rivières : on ne traverse que sur les radeaux, qui emportent celui qui s'y attarde ;
//   – les voies du « Hype Train » : les feux clignotent une seconde avant son passage ;
//   – l'herbe, pour souffler (les bottes de paille barrent le passage).
// Plus on va loin, plus ça roule vite et serré, et moins il y a d'herbe. Rester sept secondes sans
// progresser, et le marché part sans vous. Le score est la rangée la plus lointaine atteinte. Les
// rangées sont tirées de la graine de la partie : le même parcours pour tous.
(function () {
  "use strict";
  const MF = globalThis.MoulinFete;
  const HALF = 3, Z0 = 4, TOP = 0.5, SPAN = 16, AHEAD = 11, BEHIND = 2, HOP = 0.11, TRAIN = 0.55;
  const GROUND = { grass: "#7cc45a", grass2: "#6db84c", road: "#4a4f5a", river: "#3fa9e0", rail: "#8a6a45" };
  const CARS = ["#e8402c", "#ffc93a", "#7b4bd6", "#ffffff"], LAWN = { type: "grass", blocks: [] };

  MF.booth({
    id: "market",
    title: "Go To Market",
    icon: "🐥",
    color: "#2e9e5b",
    blurb: "Hop across roads, rivers and rails · how far can you go?",
    help: "Hop one square at a time towards the market: arrow keys or WASD (↑ forward, ← → sideways, ↓ back), Space to go forward, or click (middle: forward, sides: sideways, bottom: back). Dodge the cars, cross rivers on the rafts only, and never stand on the rails when the lights flash. It gets faster and tighter the further you go, and standing still for seven seconds ends the run. Your score is the furthest row you reached.",
    hint: "↑ forward · ← → sideways · ↓ back · rafts only on water · mind the train",
    touchHint: "Tap ahead to hop forward, on the sides to step aside",
    at: { x: -79.5, z: 126.3, face: Math.PI / 2 },
    stall: false,
    size: { w: 7.6, d: 12 },
    hall: [5.4, 7.4],
    maxTime: 900,
    cam: { y: 8.8, z: 10.2, look: [0, 0.5, 0.2], fov: 46 },
    cross: false,
    button: "HOP",
    scoreLabel: "Rows",
    stats: [{ key: "next", label: "Ahead" }],
    describe: (r) => "went " + (r.score || 0) + " rows deep",
    board: { label: "Furthest into the market", better: "high", value: (r) => r.score, format: (v) => v + " rows" },
    setup(b) {
      const d = b.decor, THREE = b.THREE;
      // l'estrade (le terrain penche vers l'étang : le jeu est posé dessus, bien à plat) et l'enseigne
      MF.box(2 * HALF + 1.6, 1.7, AHEAD + BEHIND + 1.6, MF.PAL.woodDark, { y: TOP - 0.9, z: Z0 - (AHEAD - BEHIND) / 2, parent: d, cast: true });
      const sign = MF.sign("GO TO MARKET", { w: 3.2, h: 0.56, bg: "#2e9e5b", color: "#ffffff", border: MF.PAL.yellow, double: true });
      sign.position.set(0, 3.3, Z0 - AHEAD - 1.6); // au fond du jeu, face au public
      d.add(sign);
      for (const sx of [-1, 1]) MF.cyl(0.06, 0.06, 3.3, MF.PAL.woodDark, { x: sx * 1.6, y: 1.65, z: Z0 - AHEAD - 1.6, parent: d, seg: 6 });
      const mats = Object.fromEntries(Object.entries(GROUND).map(([k, c]) => [k, MF.mat(c)]));
      const strips = [];
      for (let i = 0; i < AHEAD + BEHIND + 2; i++) {
        const m = MF.box(2 * HALF + 1, 0.06, 1, mats.grass, { parent: b.live });
        strips.push(m);
      }
      const pool = (n, make) => {
        const list = [];
        for (let i = 0; i < n; i++) {
          const m = make(i);
          m.visible = false;
          b.live.add(m);
          list.push(m);
        }
        let used = 0;
        return {
          begin: () => (used = 0),
          take: () => (used < n ? ((list[used].visible = true), list[used++]) : null),
          end: () => {
            for (let i = used; i < n; i++) list[i].visible = false;
          },
        };
      };
      const cars = pool(28, (i) => {
        const g = MF.group();
        MF.box(1, 0.36, 0.62, CARS[i % CARS.length], { y: 0.26, parent: g, cast: true });
        MF.box(0.5, 0.24, 0.5, "#dff3ff", { y: 0.54, parent: g });
        return g;
      });
      const rafts = pool(14, () => MF.box(1, 0.16, 0.78, "#b98350", { cast: true }));
      const bales = pool(12, () => MF.box(0.8, 0.6, 0.8, "#e9c46a", { cast: true }));
      const trains = pool(2, () => {
        const g = MF.group();
        MF.box(10, 0.8, 0.74, MF.PAL.red, { y: 0.5, parent: g, cast: true });
        MF.box(10.02, 0.14, 0.76, MF.PAL.yellow, { y: 0.5, parent: g });
        MF.cyl(0.16, 0.16, 0.4, MF.PAL.ink, { x: 4.4, y: 1.05, parent: g, seg: 8 });
        return g;
      });
      const lampMat = MF.mat("#5a1a14", { unique: true, emissive: "#ff2a1a", emissiveIntensity: 0 });
      const lamps = pool(4, () => {
        const g = MF.group();
        MF.cyl(0.04, 0.04, 0.9, MF.PAL.ink, { y: 0.45, parent: g, seg: 5 });
        MF.sphere(0.13, lampMat, { y: 0.95, parent: g, seg: 7 });
        return g;
      });
      const jack = MF.Presence.buildAvatar(b.ctx.self.color, null, null);
      jack.tag.visible = false;
      if (jack.shadow) jack.shadow.visible = false;
      b.live.add(jack.group);
      let rows = [], col = 0, px = 0, row = 0, best = 0, scroll = 0, hop = 1, fromX = 0, fromRow = 0, queued = null, dead = 0, why = "", idle = 0, facing = Math.PI, wasDir = "", wasA = false;
      const zOf = (r) => Z0 - (r - scroll);
      /** Tire le parcours : des bandes de route, de rivière ou de voie, séparées par un peu d'herbe. */
      function makeRows() {
        rows = [];
        for (let r = 0; r < 4; r++) rows.push({ type: "grass", blocks: [] });
        while (rows.length < 900) {
          const hard = Math.min(1, rows.length / 220), r = b.rand();
          const kind = r < 0.5 ? "road" : r < 0.8 ? "river" : "rail";
          const n = kind === "rail" ? 1 : kind === "river" ? 1 + (b.rand() < 0.3 + hard * 0.3 ? 1 : 0) : 1 + Math.floor(b.rand() * (2 + hard * 1.5));
          for (let i = 0; i < n; i++) {
            const dir = b.rand() < 0.5 ? -1 : 1;
            if (kind === "road") rows.push({ type: "road", dir, speed: (1.4 + b.rand() * 1.6) * (1 + hard * 1.1), gap: Math.max(3.2, 6.5 - hard * 2.4) * (0.8 + b.rand() * 0.5), off: b.rand() * SPAN, len: b.rand() < 0.3 ? 2 : 1.15 });
            else if (kind === "river") rows.push({ type: "river", dir, speed: (0.9 + b.rand() * 0.9) * (1 + hard * 0.8), gap: 4.3 + b.rand() * 1.5 + hard * 1.2, off: b.rand() * SPAN, len: Math.max(1.7, 2.9 - hard * 0.9) });
            else rows.push({ type: "rail", dir, period: Math.max(2.6, 5.5 - hard * 2.2) * (0.8 + b.rand() * 0.4), off: b.rand() * 5 });
          }
          const grass = 1 + (b.rand() > 0.35 + hard * 0.5 ? 1 : 0);
          for (let i = 0; i < grass; i++) {
            const blocks = [];
            for (let k = 0; k < 2; k++) if (b.rand() < 0.45) blocks.push(Math.floor(b.rand() * (2 * HALF + 1)) - HALF);
            rows.push({ type: "grass", blocks });
          }
        }
      }
      /** Positions (x) des voitures ou des radeaux d'une rangée à l'heure t. */
      function movers(R, t, out) {
        const n = Math.max(1, Math.floor(SPAN / R.gap));
        out.length = 0;
        for (let i = 0; i < n; i++) out.push(((((R.off + (i * SPAN) / n + R.dir * R.speed * t) % SPAN) + SPAN) % SPAN) - SPAN / 2);
        return out;
      }
      /** Le train d'une voie : { warn (feux), x (centre du train, ou null) }. */
      function train(R, t) {
        const u = (((t + R.off) % R.period) + R.period) % R.period;
        return { warn: u > R.period - 1.0 || u < TRAIN, x: u < TRAIN ? R.dir * (-13 + (26 * u) / TRAIN) : null };
      }
      const xs = [];
      function draw(t) {
        const r0 = Math.floor(scroll) - BEHIND;
        cars.begin();
        rafts.begin();
        bales.begin();
        trains.begin();
        lamps.begin();
        let blink = 0;
        strips.forEach((m, i) => {
          const r = r0 + i, R = r < 0 ? LAWN : rows[r]; // derrière le départ : de l'herbe
          m.visible = !!R;
          if (!m.visible) return;
          const z = zOf(r);
          m.position.set(0, TOP - 0.03, z);
          m.material = R.type === "grass" ? (r % 2 ? mats.grass : mats.grass2) : mats[R.type];
          if (R.type === "road" || R.type === "river") {
            for (const x of movers(R, t, xs)) {
              if (Math.abs(x) > HALF + 1.6) continue;
              const m2 = (R.type === "road" ? cars : rafts).take();
              if (!m2) continue;
              m2.position.set(x, TOP + (R.type === "river" ? 0.06 : 0), z);
              m2.scale.x = R.len;
              if (R.type === "road") m2.rotation.y = R.dir > 0 ? 0 : Math.PI;
            }
          } else if (R.type === "rail") {
            const tr = train(R, t), lamp = lamps.take();
            if (lamp) lamp.position.set(-HALF - 0.3, TOP, z);
            if (tr.warn) blink = 1;
            if (tr.x !== null) {
              const g = trains.take();
              if (g) {
                g.position.set(tr.x, TOP, z);
                g.rotation.y = R.dir > 0 ? 0 : Math.PI;
              }
            }
          } else
            for (const c of R.blocks) {
              const m2 = bales.take();
              if (m2) m2.position.set(c, TOP + 0.3, z);
            }
        });
        cars.end();
        rafts.end();
        bales.end();
        trains.end();
        lamps.end();
        lampMat.emissiveIntensity = blink && Math.sin(b.time * 22) > 0 ? 1.6 : 0;
        // le fondateur : petit saut d'une case à l'autre
        const u = Math.min(1, hop), x = MF.lerp(fromX, px, u), r = MF.lerp(fromRow, row, u), g = jack.group;
        g.visible = true;
        g.position.set(x, TOP + Math.sin(u * Math.PI) * 0.45 - (why === "water" ? Math.min(1, (b.t - dead) * 2) * 0.9 : 0), zOf(r));
        g.scale.set(0.5, why === "car" || why === "train" ? 0.08 : 0.5, 0.5);
        jack.body.rotation.y = MF.dampAngle ? MF.dampAngle(jack.body.rotation.y, facing, 20, b.dt) : facing;
      }
      function die(reason, text) {
        dead = b.t;
        why = reason;
        b.hud.flash(text + " · " + best + " rows", { color: MF.PAL.yellow, hold: 1.8 });
        MF.sfx.play(reason === "water" ? "plouf" : reason === "idle" ? "perdu" : "choc");
        b.finish();
      }
      function start() {
        makeRows();
        col = px = row = best = scroll = dead = idle = 0;
        hop = 1;
        fromX = fromRow = 0;
        queued = null;
        why = "";
        facing = Math.PI;
      }
      start();
      return {
        reset() {
          jack.setHat(b.ctx.self.hat);
          start();
        },
        camX: () => 0,
        view(_, from, to) {
          // écran étroit (téléphone tenu debout) : on recule pour voir toute la largeur
          const k = Math.max(1, 1.05 / (b.camera.aspect || 1));
          from.set(to.x + (from.x - to.x) * k, to.y + (from.y - to.y) * k, to.z + (from.z - to.z) * k);
        },
        update() {
          const dt = Math.min(b.dt, 0.05), K = b.input.state, t = b.t;
          if (b.playing && !dead) {
            // la case demandée : touches (un appui = un saut), Espace, ou clic selon l'endroit de l'écran
            const dir = K.y > 0.5 ? "F" : K.y < -0.5 ? "B" : K.x < -0.5 ? "L" : K.x > 0.5 ? "R" : "";
            let move = dir && dir !== wasDir ? dir : K.a && !wasA ? "F" : "";
            if (!move && b.press && !K.a) move = b.aim.y < -0.62 ? "B" : b.aim.x < -0.34 ? "L" : b.aim.x > 0.34 ? "R" : "F";
            wasDir = dir;
            wasA = !!K.a;
            if (move) queued = move;
            hop += dt / HOP;
            if (hop >= 1 && queued) {
              const m = queued;
              queued = null;
              const base = MF.clamp(Math.round(px), -HALF, HALF), nc = MF.clamp(base + (m === "L" ? -1 : m === "R" ? 1 : 0), -HALF, HALF), nr = row + (m === "F" ? 1 : m === "B" ? -1 : 0);
              const R = rows[nr];
              facing = m === "F" ? Math.PI : m === "B" ? 0 : m === "L" ? -Math.PI / 2 : Math.PI / 2;
              if (R && nr >= Math.floor(scroll) - 1 && !(R.type === "grass" && R.blocks.includes(nc))) {
                fromX = px;
                fromRow = row;
                // on quitte un radeau : on retombe sur la case la plus proche
                px = m === "F" || m === "B" ? (R.type === "river" ? px : base) : nc;
                if ((m === "L" || m === "R") && rows[row].type === "river") px = MF.clamp(fromX + (m === "L" ? -1 : 1), -HALF, HALF);
                row = nr;
                hop = 0;
                MF.sfx.play("clic");
                if (row > best) {
                  best = row;
                  idle = 0;
                  b.score = best;
                }
              }
            }
            idle += dt;
            const R = rows[row];
            if (hop >= 1) {
              if (R.type === "road") {
                if (movers(R, t, xs).some((x) => Math.abs(x - px) < R.len / 2 + 0.3)) die("car", "Run over by the competition");
              } else if (R.type === "river") {
                if (!movers(R, t, xs).some((x) => Math.abs(x - px) < R.len / 2 + 0.12)) die("water", "Splash! No raft there");
                else {
                  px += R.dir * R.speed * dt; // le radeau emporte
                  fromX = px;
                  if (Math.abs(px) > HALF + 0.6) die("water", "Swept away by the current");
                }
              } else if (R.type === "rail") {
                const tr = train(R, t);
                if (tr.x !== null && Math.abs(tr.x - px) < 5.3) die("train", "Hit by the Hype Train");
              }
            }
            if (!dead && idle > 7) die("idle", "The market moved on without you");
            else if (!dead && idle > 4.5 && idle - dt <= 4.5) b.hud.flash("Keep moving!", { color: "#ffb347", hold: 0.7 });
            scroll = MF.damp(scroll, Math.max(scroll, row - 1.5, best - 4), 6, dt);
          }
          draw(t);
        },
        hud() {
          const R = rows[row + 1];
          b.hud.set("next", !R ? "…" : R.type === "road" ? "road" : R.type === "river" ? "river" : R.type === "rail" ? "rails" : "grass");
        },
        idle() {
          if (!dead) draw(b.time);
        },
        probe: () => ({ row, px, best, dead: !!dead, why }), // pour les essais automatiques
      };
    },
  });
})();
