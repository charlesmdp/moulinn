// La Fête du Moulin — The Idea Maze (le labyrinthe de haies, sur le plateau).
//
// Un labyrinthe de 22 m de côté vu d'en haut. À chaque partie, trois ampoules (l'idée, le
// prototype, les premiers clients) sont posées dans des culs-de-sac tirés au sort : il faut les
// ramasser toutes les trois, puis gagner la sortie, au nord. Flèches ou ZQSD/WASD pour marcher (ou
// maintenir le doigt dans la direction voulue). Le temps est le score.
(function () {
  "use strict";
  const MF = globalThis.MoulinFete;
  const N = 11, CELL = 2, HALF = (N * CELL) / 2, WALL = 0.42, SPEED = 4.6, RAD = 0.36;
  const STEPS = ["The idea", "The MVP", "First customers"];

  // Labyrinthe fixe (le même pour tous) : parcours en profondeur depuis une graine constante.
  // open[i][j] : bit 1 = passage vers l'est, bit 2 = passage vers le sud.
  function carve() {
    const rnd = MF.rng(20261118), open = Array.from({ length: N }, () => new Array(N).fill(0)), seen = Array.from({ length: N }, () => new Array(N).fill(false));
    const stack = [[5, N - 1]];
    seen[5][N - 1] = true;
    while (stack.length) {
      const [i, j] = stack[stack.length - 1];
      const next = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([di, dj]) => [i + di, j + dj]).filter(([a, c]) => a >= 0 && c >= 0 && a < N && c < N && !seen[a][c]);
      if (!next.length) {
        stack.pop();
        continue;
      }
      const [a, c] = next[Math.floor(rnd() * next.length)];
      if (a > i) open[i][j] |= 1;
      else if (a < i) open[a][c] |= 1;
      else if (c > j) open[i][j] |= 2;
      else open[a][c] |= 2;
      seen[a][c] = true;
      stack.push([a, c]);
    }
    // quelques ouvertures de plus : plusieurs chemins possibles, c'est plus amusant qu'un labyrinthe parfait
    for (let k = 0; k < 9; k++) open[1 + Math.floor(rnd() * (N - 2))][1 + Math.floor(rnd() * (N - 2))] |= rnd() < 0.5 ? 1 : 2;
    return open;
  }

  MF.booth({
    id: "maze",
    title: "The Idea Maze",
    icon: "💡",
    color: "#8e44ad",
    blurb: "Find the idea, the MVP and the first customers, then the exit",
    help: "Walk with the arrows or WASD (or hold a finger in the direction you want to go). Pick up the three light bulbs hidden in dead ends, then reach the exit at the top. Your time is your score.",
    hint: "Arrows or WASD to walk · 3 bulbs, then the exit at the top",
    touchHint: "Hold a finger where you want to go · 3 bulbs, then the exit at the top",
    at: { x: -163, z: 18, face: 0 },
    stall: false,
    size: { w: 4, d: 24.6 },
    hall: [4.2, 13.6],
    duration: 150,
    cam: { y: 30, z: 13, look: [0, 0, -1.5], fov: 48 },
    cross: false,
    button: "RUN",
    scoreLabel: "Bulbs",
    scoreText: (b) => Math.min(3, b.score) + " / 3",
    liveText: (v) => (v >= 4 ? "OUT!" : Math.min(3, v) + " / 3"),
    rank: (list) => list.slice().sort((a, b) => (a.time ? 0 : 1) - (b.time ? 0 : 1) || (a.time || 0) - (b.time || 0) || (b.bulbs || 0) - (a.bulbs || 0)),
    describe: (r) => (r.time ? "out in " + MF.time(r.time) : "still lost (" + (r.bulbs || 0) + " / 3 bulbs)"),
    board: { label: "Fastest way out", better: "low", value: (r) => r.time, format: (v) => MF.time(v) },
    setup(b) {
      const d = b.decor, open = carve();
      const cx = (i) => -HALF + (i + 0.5) * CELL, cz = (j) => -HALF + (j + 0.5) * CELL;
      // haies : le tour (avec l'entrée en bas et la sortie en haut, au milieu) et les cloisons
      const walls = []; // rectangles { x0, x1, z0, z1 }
      const hedge = (x0, z0, x1, z1) => {
        const w = Math.abs(x1 - x0) + WALL, l = Math.abs(z1 - z0) + WALL, x = (x0 + x1) / 2, z = (z0 + z1) / 2;
        MF.box(w, 1.5, l, (walls.length % 3 ? "#2f8f46" : "#3aa055"), { x, y: 0.75 + b.ground(x, z), z, parent: d, cast: true });
        walls.push({ x0: x - w / 2, x1: x + w / 2, z0: z - l / 2, z1: z + l / 2 });
      };
      const door = 5; // colonne de l'entrée et de la sortie
      for (let i = 0; i < N; i++) {
        if (i !== door) hedge(-HALF + i * CELL, -HALF, -HALF + (i + 1) * CELL, -HALF);
        if (i !== door) hedge(-HALF + i * CELL, HALF, -HALF + (i + 1) * CELL, HALF);
        hedge(-HALF, -HALF + i * CELL, -HALF, -HALF + (i + 1) * CELL);
        hedge(HALF, -HALF + i * CELL, HALF, -HALF + (i + 1) * CELL);
      }
      const deadEnds = [];
      for (let i = 0; i < N; i++)
        for (let j = 0; j < N; j++) {
          if (i < N - 1 && !(open[i][j] & 1)) hedge(-HALF + (i + 1) * CELL, -HALF + j * CELL, -HALF + (i + 1) * CELL, -HALF + (j + 1) * CELL);
          if (j < N - 1 && !(open[i][j] & 2)) hedge(-HALF + i * CELL, -HALF + (j + 1) * CELL, -HALF + (i + 1) * CELL, -HALF + (j + 1) * CELL);
          const ways = (open[i][j] & 1 ? 1 : 0) + (open[i][j] & 2 ? 1 : 0) + (i > 0 && open[i - 1][j] & 1 ? 1 : 0) + (j > 0 && open[i][j - 1] & 2 ? 1 : 0);
          if (ways === 1 && !(i === door && (j === 0 || j === N - 1))) deadEnds.push([i, j]);
        }
      const gy = b.ground(0, 0);
      const exit = MF.group({ x: cx(door), y: b.ground(cx(door), -HALF - 1.2), z: -HALF - 1.2, parent: d });
      exit.add(MF.props.flag(MF.PAL.yellow, 3.4));
      const sign = MF.sign("THE IDEA MAZE", { w: 3.4, h: 0.6, bg: "#8e44ad", color: "#ffffff", border: MF.PAL.yellow, double: true });
      sign.position.set(cx(door), b.ground(cx(door), HALF + 1.4) + 2.7, HALF + 1.4);
      d.add(sign);
      for (const sx of [-1, 1]) MF.cyl(0.05, 0.05, 2.7, MF.PAL.woodDark, { x: cx(door) + sx * 1.8, y: b.ground(cx(door), HALF + 1.4) + 1.35, z: HALF + 1.4, parent: d, seg: 6 });
      // les trois ampoules et mon pion
      const bulbs = STEPS.map(() => {
        const g = MF.group({ parent: b.live });
        MF.sphere(0.34, MF.mat("#ffe14a", { emissive: "#ffcc00", emissiveIntensity: 0.9 }), { y: 1.0, parent: g, seg: 10 });
        MF.cyl(0.16, 0.16, 0.22, "#95a5a6", { y: 0.62, parent: g, seg: 8 });
        return { g, i: 0, j: 0, got: false };
      });
      const pawn = MF.group({ parent: b.live });
      const skin = MF.mat(b.ctx.self.color, { unique: true });
      MF.cone(0.36, 1.1, skin, { y: 0.55, parent: pawn, seg: 10 });
      MF.sphere(0.26, "#ffe0bd", { y: 1.25, parent: pawn, seg: 10 });
      MF.cyl(0.42, 0.42, 0.04, "#e9c46a", { y: 1.42, parent: pawn, seg: 14 });
      MF.torus(0.6, 0.05, MF.mat("#ffffff", { basic: true }), { y: 0.06, rx: Math.PI / 2, parent: pawn, seg: 20, tubeSeg: 4 });
      const v = new b.THREE.Vector3();
      let x = 0, z = 0, got = 0, done = 0;
      return {
        reset() {
          x = cx(door);
          z = HALF + 0.9;
          got = done = 0;
          skin.color.copy(MF.color(b.ctx.self.color));
          // trois culs-de-sac tirés au sort (la graine de la partie : les mêmes pour tous les joueurs)
          const pool = deadEnds.slice();
          for (const bulb of bulbs) {
            const k = Math.floor(b.rand() * pool.length), [i, j] = pool.splice(k, 1)[0];
            Object.assign(bulb, { i, j, got: false });
            bulb.g.visible = true;
            bulb.g.position.set(cx(i), b.ground(cx(i), cz(j)), cz(j));
          }
        },
        update() {
          if (b.playing && !done) {
            const K = b.input.state;
            let dx = K.x, dz = -K.y;
            if (!dx && !dz && b.hold && !K.a) {
              // doigt ou souris maintenus : on marche vers le point visé
              const p = b.hit(gy + 0.5, "y", v);
              if (p) {
                dx = p.x - x;
                dz = p.z - z;
              }
            }
            const l = Math.hypot(dx, dz);
            if (l > 0.05) {
              x += (dx / l) * SPEED * b.dt;
              z += (dz / l) * SPEED * b.dt;
              pawn.rotation.y = Math.atan2(dx, dz);
            }
            // haies : on est repoussé hors de chaque rectangle touché
            for (const w of walls) {
              const nx = MF.clamp(x, w.x0, w.x1), nz = MF.clamp(z, w.z0, w.z1), ex = x - nx, ez = z - nz, dist = Math.hypot(ex, ez);
              if (dist >= RAD) continue;
              if (dist > 1e-4) {
                x = nx + (ex / dist) * RAD;
                z = nz + (ez / dist) * RAD;
              } else z = z > (w.z0 + w.z1) / 2 ? w.z1 + RAD : w.z0 - RAD;
            }
            z = Math.min(z, HALF + 1.6);
            // dehors, on ne peut se tenir que devant l'entrée ou la sortie : pas question de faire le tour
            if (Math.abs(z) > HALF) x = MF.clamp(x, cx(door) - 0.7, cx(door) + 0.7);
            for (const bulb of bulbs)
              if (!bulb.got && Math.hypot(x - cx(bulb.i), z - cz(bulb.j)) < 0.8) {
                bulb.got = true;
                bulb.g.visible = false;
                got++;
                b.hud.flash(STEPS[got - 1] + "! " + (got < 3 ? got + " / 3" : "Now find the exit ↑"), { color: MF.PAL.yellow, hold: 1 });
                MF.sfx.play("ting");
              }
            b.score = got;
            if (z < -HALF - 0.5) {
              if (got >= 3) {
                done = Math.round(b.t * 100) / 100;
                b.score = 4;
                b.hud.flash("Launched! " + MF.time(done), { color: MF.PAL.yellow, hold: 1.6 });
                MF.sfx.play("bravo");
                b.confetti(cx(door), gy + 1.5, -HALF - 1, 24);
                b.finish();
              } else {
                z = -HALF - 0.5;
                b.hud.flash("Not yet: " + (3 - got) + " bulb" + (3 - got > 1 ? "s" : "") + " missing", { color: MF.PAL.red, hold: 0.8 });
              }
            }
          }
          pawn.position.set(x, b.ground(x, z), z);
          for (const bulb of bulbs) bulb.g.rotation.y = b.time * 2;
        },
        result: () => (done ? { time: done } : { dnf: true, bulbs: got }),
      };
    },
  });
})();
