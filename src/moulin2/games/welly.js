// La Fête du Moulin — Bootstrap Toss (le lancer de botte : les « bootstrappers » vont loin).
//
// Trois bottes à lancer le plus loin possible dans le pré de l'est, le long de la rivière. On maintient le
// clic : la jauge monte et redescend ; on lâche au plus haut… mais pas tout en haut : au-delà de
// 96 %, on mord la ligne et le lancer est nul. Le vent pousse ou freine. La meilleure distance est
// le score.
(function () {
  "use strict";
  const MF = globalThis.MoulinFete;
  const BOOTS = 3;
  const MARKS = [[10, "10 m · SIDE PROJECT"], [20, "20 m · RAMEN PROFITABLE"], [30, "30 m · QUIT YOUR JOB"], [40, "40 m · $10K MRR"]];

  MF.booth({
    id: "welly",
    title: "Bootstrap Toss",
    icon: "🥾",
    color: "#d35400",
    blurb: "3 boots · bootstrappers go the distance",
    help: "Hold the click: the gauge rises and falls. Release as high as you can, but not at the very top: above 96 % you step over the line and the throw is void. Mind the wind. Your best distance is your score.",
    hint: "Hold, release near the top of the gauge (not above 96 %)",
    at: { x: 160, z: -3.6, face: Math.PI / 2 },
    stall: false,
    size: { w: 3, d: 1.2 },
    hall: [3.2, 2.6],
    maxTime: 90,
    cam: { y: 2.0, z: 2.6, look: [0, 1.0, -10], fov: 52 },
    cross: false,
    button: "TOSS",
    scoreLabel: "Best",
    scoreText: (b) => (b.score / 10).toFixed(1) + " m",
    liveText: (v) => (v / 10).toFixed(1) + " m",
    describe: (r) => ((r.score || 0) / 10).toFixed(1) + " m",
    stats: [{ key: "boots", label: "Boots" }, { key: "wind", label: "Wind" }],
    board: { label: "Longest toss", better: "high", value: (r) => r.score, format: (v) => (v / 10).toFixed(1) + " m" },
    setup(b) {
      const THREE = b.THREE, d = b.decor;
      // la ligne de lancer, les panneaux de distance, l'enseigne
      MF.box(3.4, 0.05, 0.16, "#ffffff", { y: 0.05, z: 0.4, parent: d });
      for (const [m, text] of MARKS) {
        const y = b.ground(2.6, -m);
        const s = MF.sign(text, { w: 2.6, h: 0.36, bg: "#d35400", color: "#ffffff", border: "#ffffff", double: true });
        s.position.set(2.6, y + 1.0, -m);
        s.rotation.y = -0.5;
        d.add(s);
        MF.cyl(0.03, 0.03, 0.9, MF.PAL.woodDark, { x: 2.6, y: y + 0.45, z: -m, parent: d, seg: 5 });
        MF.box(3.6, 0.03, 0.08, "#ffffff", { y: b.ground(0, -m) + 0.04, z: -m, parent: d });
      }
      const sign = MF.sign("BOOTSTRAP TOSS", { w: 2.6, h: 0.5, bg: "#d35400", color: "#ffffff", border: MF.PAL.yellow, double: true });
      sign.position.set(0, 2.6, 3.6);
      d.add(sign);
      for (const sx of [-1, 1]) MF.cyl(0.04, 0.04, 2.6, MF.PAL.woodDark, { x: sx * 1.3, y: 1.3, z: 3.6, parent: d, seg: 6 });
      const boot = MF.group({ parent: b.live });
      MF.box(0.14, 0.34, 0.14, "#2d3436", { y: 0.2, parent: boot });
      MF.box(0.14, 0.12, 0.3, "#2d3436", { y: 0.03, z: -0.08, parent: boot });
      MF.box(0.15, 0.04, 0.15, MF.PAL.yellow, { y: 0.38, parent: boot });
      boot.visible = false;
      const flags = [];
      for (let i = 0; i < BOOTS; i++) {
        const f = MF.cone(0.12, 0.5, [MF.PAL.red, MF.PAL.yellow, MF.PAL.green][i], { parent: b.live, seg: 6 });
        f.visible = false;
        flags.push(f);
      }
      const a = new THREE.Vector3(), c = new THREE.Vector3(), e = new THREE.Vector3();
      let left = BOOTS, busy = false, wind = 0, follow = 0, best = 0;
      const newWind = () => (wind = Math.round((b.rand() * 2 - 1) * 30) / 10);
      function toss(power) {
        busy = true;
        const i = BOOTS - left;
        left--;
        MF.sfx.play("swing");
        if (power > 0.96) {
          b.hud.flash("Stepped over the line: no throw", { color: MF.PAL.red, hold: 1.1 });
          MF.sfx.play("perdu");
          busy = false;
          newWind();
          if (!left) b.finish();
          return;
        }
        const dist = Math.max(2, 6 + 36 * Math.pow(power, 1.35) + wind * power * 1.6), side = (b.rand() - 0.5) * dist * 0.06;
        a.set(0.3, 1.5, 0.2);
        c.set(side, b.ground(side, -dist) + 0.1, -dist);
        b.fly(boot, a, c, 1.5 + dist * 0.2, 0.9 + dist * 0.025, () => {
          MF.sfx.play("toc");
          e.set(side, b.ground(side, -dist - dist * 0.05) + 0.1, -dist - dist * 0.05);
          b.fly(boot, c, e, 0.4, 0.3, () => {
            const total = Math.round((dist * 1.05) * 10) / 10;
            flags[i].visible = true;
            flags[i].position.set(e.x, e.y + 0.25, e.z);
            if (total * 10 > b.score) b.score = Math.round(total * 10);
            best = Math.max(best, total);
            b.hud.flash(total.toFixed(1) + " m" + (total >= best && i ? " · your best" : ""), { color: MF.PAL.yellow, hold: 1.2 });
            MF.sfx.play(total > 30 ? "bravo" : "ting");
            busy = false;
            follow = 0;
            newWind();
            if (!left) b.finish();
          });
        });
      }
      return {
        reset() {
          left = BOOTS;
          busy = false;
          best = follow = 0;
          boot.visible = false;
          for (const f of flags) f.visible = false;
          newWind();
        },
        view(_, from, to) {
          // en vol, la caméra suit la botte de loin
          follow = MF.damp(follow, busy && boot.visible ? 1 : 0, 4, b.dt);
          const z = boot.position.z * follow;
          from.z += z * 0.85;
          to.z += z;
          to.y += follow * 0.6;
        },
        update() {
          if (boot.visible && busy) boot.rotation.x -= 9 * b.dt;
          if (busy || !left) return;
          const power = b.charge(1.0);
          if (power !== null) toss(power);
        },
        hud() {
          b.hud.set("boots", left + " / " + BOOTS);
          b.hud.set("wind", wind === 0 ? "calm" : (wind > 0 ? "tailwind " : "headwind ") + Math.abs(wind).toFixed(1));
        },
      };
    },
  });
})();
