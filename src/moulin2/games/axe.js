// La Fête du Moulin — Product-Market Fit (le lancer de hache).
//
// Six haches sur une cible en rondelle de tronc, qui se déplace de plus en plus (« le marché
// bouge »). On vise à la souris, on maintient le clic pour armer : la hache tourne en vol, elle ne
// se plante que si la force est dans la bonne zone de la jauge (la bande verte) ; sinon elle rebondit.
// Cercle extérieur 10, intérieur 25, centre 50 : « product-market fit ! ».
(function () {
  "use strict";
  const MF = globalThis.MoulinFete;
  const AXES = 6, ZT = -4.4, YT = 1.75, RT = 0.78, GOOD = [0.58, 0.86];

  MF.booth({
    id: "axe",
    title: "Product-Market Fit",
    icon: "🎯",
    color: "#c0392b",
    blurb: "6 axes · the market moves, find the bullseye",
    help: "Aim with the mouse, hold the click to wind up and release. The axe only sticks when the power is in the green band of the gauge; too weak or too strong and it bounces off. Outer ring 10, inner ring 25, bullseye 50. The target drifts a little more with every axe.",
    hint: "Aim, hold to wind up, release in the green band",
    at: { x: 30.8, z: 29.6, face: -Math.PI / 2 },
    stall: false,
    size: { w: 3, d: 2.0 },
    hall: [3.2, 3.0],
    maxTime: 110,
    cam: { y: 1.7, z: 3.0, look: [0, 1.75, ZT], fov: 46 },
    button: "THROW",
    stats: [{ key: "axes", label: "Axes" }],
    setup(b) {
      const THREE = b.THREE, d = b.decor;
      const gy = b.ground(0, ZT);
      // la ligne de lancer, le portique de rondins qui porte la cible
      MF.box(2.6, 0.04, 0.14, "#ffffff", { y: 0.05, z: 0.9, parent: d });
      for (const sx of [-1, 1]) MF.cyl(0.11, 0.13, 3.2, "#7a4a22", { x: sx * 1.9, y: gy + 1.6, z: ZT - 0.1, parent: d, seg: 8, cast: true });
      MF.cyl(0.09, 0.09, 4.2, "#7a4a22", { y: gy + 3.1, z: ZT - 0.1, rz: Math.PI / 2, parent: d, seg: 8 });
      const sign = MF.sign("PRODUCT-MARKET FIT", { w: 2.9, h: 0.5, bg: "#c0392b", color: "#ffffff", border: MF.PAL.yellow, double: true });
      sign.position.set(0, gy + 3.55, ZT - 0.1);
      d.add(sign);
      MF.box(4.4, 2.6, 0.08, "#5d4630", { y: gy + 1.5, z: ZT - 0.5, parent: d }); // pare-haches
      // la cible : une rondelle de tronc, trois cercles ; elle glisse le long du portique
      const target = MF.group({ y: gy + YT, z: ZT, parent: b.live });
      MF.cyl(RT, RT, 0.16, "#d9b98a", { rx: Math.PI / 2, parent: target, seg: 24 });
      MF.torus(RT - 0.03, 0.035, "#7a4a22", { z: 0.09, parent: target, seg: 28, tubeSeg: 5 });
      MF.torus(0.5, 0.03, "#3fb4e8", { z: 0.09, parent: target, seg: 24, tubeSeg: 5 });
      MF.torus(0.26, 0.03, "#ef4b3f", { z: 0.09, parent: target, seg: 20, tubeSeg: 5 });
      MF.cyl(0.11, 0.11, 0.02, "#ef4b3f", { z: 0.09, rx: Math.PI / 2, parent: target, seg: 14 });
      const pool = [];
      for (let i = 0; i < AXES; i++) {
        const g = MF.group({ parent: b.live });
        MF.cyl(0.022, 0.022, 0.62, MF.PAL.wood, { parent: g, seg: 6 });
        MF.box(0.05, 0.2, 0.22, "#aab2ab", { y: 0.24, z: -0.1, parent: g });
        g.visible = false;
        pool.push(g);
      }
      // la bande verte de la jauge : un repère fixe à l'écran serait plus simple, on la dit dans l'aide et on colore le libellé
      const spot = new THREE.Vector3(), hand = new THREE.Vector3(), hit = new THREE.Vector3(), rest = new THREE.Vector3();
      let left = AXES, busy = false, phase = 0;

      function throwAxe(power) {
        busy = true;
        const axe = pool[AXES - left];
        left--;
        MF.sfx.play("swing");
        const p = b.hit(ZT + 0.1, "z", spot) || spot.set(0, gy + YT, ZT);
        hand.set(0.3, 1.45, 1.4);
        hit.set(MF.clamp(p.x, -2.1, 2.1), MF.clamp(p.y, gy + 0.4, gy + 2.9) - (1 - power) * (1 - power) * 0.5, ZT + 0.12);
        const good = power >= GOOD[0] && power <= GOOD[1];
        axe.parent !== b.live && b.live.attach(axe);
        axe.rotation.set(0, 0, 0);
        const f = { spin: -(10 + power * 12) };
        b.fly(axe, hand, hit, 0.25 + (1 - power) * 0.3, 0.42 - power * 0.12, () => {
          const dx = hit.x - target.position.x, dy = hit.y - target.position.y, r = Math.hypot(dx, dy);
          if (good && r < RT) {
            // plantée : elle reste dans la cible (et bouge avec elle)
            axe.rotation.set(-0.9, 0, 0);
            target.attach(axe);
            const pts = r < 0.11 ? 50 : r < 0.26 ? 25 : r < 0.5 ? 15 : 10;
            b.add(pts, pts === 50 ? "PRODUCT-MARKET FIT! +50" : "+" + pts, hit);
            MF.sfx.play(pts >= 50 ? "bravo" : "toc");
            if (pts === 50) b.confetti(hit.x, hit.y, ZT + 0.4, 20);
            busy = false;
            if (!left) b.finish();
            return;
          }
          // manquée ou mal lancée : elle rebondit et tombe
          b.hud.pop(r >= RT ? "Missed the market" : power < GOOD[0] ? "Too soft: it bounced" : "Too hard: it bounced", ...b.screen(hit));
          MF.sfx.play("choc");
          rest.set(hit.x + (Math.random() - 0.5), gy + 0.1, ZT + 0.9);
          b.fly(axe, hit, rest, 0.5, 0.45, () => {
            axe.rotation.set(Math.PI / 2, 0, 0.4);
            busy = false;
            if (!left) b.finish();
          });
        });
        // la hache tourne pendant tout le vol
        axe.userData.spin = f.spin;
      }
      return {
        target,
        reset() {
          left = AXES;
          busy = false;
          phase = b.rand() * 6;
          for (const g of pool) {
            b.live.attach(g);
            g.visible = false;
          }
          target.position.x = 0;
        },
        update() {
          // le marché bouge : de plus en plus à chaque hache lancée
          const amp = b.t >= 0 ? Math.min(1.25, (AXES - left) * 0.26) : 0;
          target.position.x = Math.sin(b.t * 1.1 + phase) * amp;
          for (const g of pool) if (g.visible && g.parent === b.live && g.userData.spin && busy) g.rotation.x += g.userData.spin * b.dt;
          if (busy || !left) return;
          const power = b.charge(1.05, "Power · release between 60 and 85 %");
          if (power !== null) throwAxe(power);
        },
        hud() {
          b.hud.set("axes", left + " / " + AXES);
        },
      };
    },
  });
})();
