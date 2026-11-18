// La Fête du Moulin — Milk Bottles (le chamboule-tout aux bouteilles de lait).
//
// Six balles pour faire tomber trois pyramides de six bouteilles. On vise avec la souris, on
// maintient le clic pour armer : une balle lancée mollement retombe avant la cible. Toucher la
// bouteille du milieu, en bas, à pleine force, fait tout tomber d'un coup. 10 points la bouteille,
// 40 la pyramide rasée, et 50 par balle restante si tout est par terre.
(function () {
  "use strict";
  const MF = globalThis.MoulinFete;
  const BALLS = 6, ZP = -0.95, SHELF = 1.05, BH = 0.3, R = 0.078;
  // une pyramide : rangée, décalage en x, et les bouteilles qui la portent (indices)
  const PYRAMID = [[0, -0.17, []], [0, 0, []], [0, 0.17, []], [1, -0.085, [0, 1]], [1, 0.085, [1, 2]], [2, 0, [3, 4]]];

  MF.booth({
    id: "bottles",
    title: "Milk Bottles",
    icon: "🥛",
    color: MF.PAL.blue,
    blurb: "6 balls · knock down three pyramids",
    help: "Aim with the mouse, hold the click to wind up and release to throw: a weak throw drops short. Hit the middle bottle of the bottom row at full power and the whole pyramid goes down. 10 per bottle, 40 per cleared pyramid, 50 per ball left when everything is down.",
    hint: "Aim, hold to wind up, release to throw",
    at: { x: -36.5, z: -84.6, face: 0 },
    stall: { colors: [MF.PAL.blue, MF.PAL.white] },
    maxTime: 110,
    cam: { y: 1.7, z: 3.2, look: [0, 1.45, ZP], fov: 44 },
    button: "THROW",
    stats: [{ key: "balls", label: "Balls" }],
    setup(b) {
      const THREE = b.THREE, d = b.decor;
      const bottles = [];
      [-1.25, 0, 1.25].forEach((px, p) => {
        MF.box(0.8, SHELF, 0.5, p % 2 ? MF.PAL.red : MF.PAL.yellow, { x: px, y: SHELF / 2, z: ZP, parent: d, cast: true });
        MF.box(0.9, 0.04, 0.6, MF.PAL.woodDark, { x: px, y: SHELF, z: ZP, parent: d });
        PYRAMID.forEach(([row, dx, on], i) => {
          const g = MF.group({ parent: b.live });
          MF.cyl(R, R, BH * 0.62, "#f7f4ea", { y: BH * 0.31, parent: g, seg: 10 });
          MF.cone(R, BH * 0.22, "#f7f4ea", { y: BH * 0.73, parent: g, seg: 10 });
          MF.cyl(0.035, 0.04, BH * 0.2, "#f7f4ea", { y: BH * 0.88, parent: g, seg: 8 });
          MF.freeze(g);
          bottles.push({ g, p, i, on, x: px + dx, y: SHELF + 0.02 + row * BH, up: true, vx: 0, vy: 0, vz: 0, spin: 0 });
        });
      });
      const ball = MF.sphere(0.065, "#c0392b", { parent: b.live, seg: 10 });
      ball.visible = false;
      const spot = new THREE.Vector3(), hand = new THREE.Vector3(), hit = new THREE.Vector3(), back = new THREE.Vector3();
      let left = BALLS, busy = false;

      function knock(bt, power, dir) {
        bt.up = false;
        Object.assign(bt, { vx: dir * (0.6 + Math.random() * 1.2), vy: 1.2 + Math.random() * 1.4, vz: -(1.5 + power * 2.5), spin: (Math.random() - 0.5) * 14 });
      }
      function impact(power) {
        const direct = bottles.filter((bt) => bt.up && Math.hypot(hit.x - bt.x, hit.y - (bt.y + BH * 0.45)) < 0.15);
        if (!direct.length) {
          MF.sfx.play("toc");
          return 0;
        }
        const before = bottles.filter((bt) => bt.up).length;
        for (const bt of direct) {
          knock(bt, power, Math.sign(bt.x - hit.x) || 1);
          // un tir appuyé emporte aussi les voisines de la même rangée
          if (power > 0.55) for (const o of bottles) if (o.up && o.p === bt.p && o.y === bt.y && Math.abs(o.x - bt.x) < 0.2) knock(o, power, Math.sign(o.x - bt.x));
        }
        // ce qui n'est plus porté tombe à son tour
        for (let again = true; again; ) {
          again = false;
          for (const bt of bottles)
            if (bt.up && bt.on.some((k) => !bottles[bt.p * 6 + k].up)) {
              knock(bt, power * 0.5, Math.random() < 0.5 ? -1 : 1);
              again = true;
            }
        }
        const down = before - bottles.filter((bt) => bt.up).length;
        let pts = down * 10, text = down + (down > 1 ? " bottles! +" : " bottle +") + down * 10;
        for (const p of new Set(direct.map((bt) => bt.p)))
          if (!bottles.some((bt) => bt.p === p && bt.up)) {
            pts += 40;
            text = "PYRAMID DOWN! +" + pts;
            b.confetti(bottles[p * 6].x + 0.17, SHELF + 0.5, ZP + 0.2, 16);
          }
        b.add(pts, text, hit);
        MF.sfx.play(pts >= 60 ? "bravo" : "choc");
        return down;
      }
      function throwBall(power) {
        busy = true;
        left--;
        MF.sfx.play("swing");
        const p = b.hit(ZP, "z", spot) || spot.set(0, 1.4, ZP);
        hand.set(0.3, 1.3, 1.9);
        // une balle molle retombe : jusqu'à 55 cm sous le point visé
        hit.set(MF.clamp(p.x, -2, 2), MF.clamp(p.y, 0.6, 2.5) - (1 - power) * (1 - power) * 0.55, ZP);
        b.fly(ball, hand, hit, 0.12 + (1 - power) * 0.25, 0.2 + (1 - power) * 0.22, () => {
          impact(power);
          back.set(hit.x, 0.3, ZP - 0.5);
          b.fly(ball, hit, back, 0.1, 0.3, () => {
            ball.visible = false;
            busy = false;
            if (!bottles.some((bt) => bt.up)) {
              if (left) {
                b.add(left * 50, left + (left > 1 ? " balls" : " ball") + " to spare! +" + left * 50);
                MF.sfx.play("bravo");
              }
              b.finish();
            } else if (!left) b.finish();
          });
        });
      }
      return {
        bottles,
        reset() {
          left = BALLS;
          busy = false;
          ball.visible = false;
          for (const bt of bottles) {
            bt.up = true;
            bt.g.visible = true;
            bt.g.position.set(bt.x, bt.y, ZP);
            bt.g.rotation.set(0, 0, 0);
          }
        },
        update() {
          for (const bt of bottles) {
            if (bt.up || !bt.g.visible) continue;
            bt.vy -= 9 * b.dt;
            bt.g.position.x += bt.vx * b.dt;
            bt.g.position.y += bt.vy * b.dt;
            bt.g.position.z += bt.vz * b.dt;
            bt.g.rotation.x -= bt.spin * b.dt;
            if (bt.g.position.y < 0.1) bt.g.visible = false;
          }
          if (busy || !left) return void b.charge();
          const power = b.charge(1.15, "Wind-up");
          if (power !== null) throwBall(power);
        },
        hud() {
          b.hud.set("balls", left + " / " + BALLS);
        },
      };
    },
  });
})();
