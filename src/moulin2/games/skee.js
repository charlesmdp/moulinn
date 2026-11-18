// La Fête du Moulin — Skee-Ball.
//
// Neuf boules à faire rouler sur la piste : elles sautent le tremplin et retombent sur le plateau
// incliné, dans un des anneaux (20 à 50, et deux petits « 100 » dans les coins du haut) ; une boule
// qui manque tout redescend jusqu'à la gouttière (10). On vise avec la souris, on dose la force en
// maintenant le clic : la jauge monte et redescend, on lâche au bon moment.
(function () {
  "use strict";
  const MF = globalThis.MoulinFete;
  const BALLS = 9;
  const B0 = { y: 1.02, z: -0.28 }, SLOPE = 0.74, LEN = 1.66; // plateau : pied (y, z), pente (rad), longueur
  // anneaux : x, distance depuis le pied du plateau, rayon, points
  const RINGS = [[-0.56, 1.44, 0.095, 100], [0.56, 1.44, 0.095, 100], [0, 1.2, 0.105, 50], [0, 0.95, 0.13, 40], [0, 0.66, 0.16, 30], [0, 0.34, 0.19, 20]];
  const COLORS = { 100: "#ffd23e", 50: "#ef4b3f", 40: "#ff9d2e", 30: "#3fb4e8", 20: "#59c36a" };

  MF.booth({
    id: "skee",
    title: "Skee-Ball",
    icon: "🎳",
    color: MF.PAL.purple,
    blurb: "9 balls · roll them into the rings",
    help: "Aim with the mouse, hold the click to charge and release to roll. The higher the ring, the more points: 20, 30, 40, 50, and two tiny 100s in the top corners. A miss still scores 10.",
    hint: "Aim, hold to charge, release to roll",
    at: { x: 10.5, z: -61.8, face: -Math.PI / 2 },
    stall: { colors: [MF.PAL.purple, MF.PAL.white], counter: false },
    maxTime: 120,
    cam: { y: 1.95, z: 3.0, look: [0, 1.45, -0.9], fov: 44 },
    button: "ROLL",
    stats: [{ key: "balls", label: "Balls" }],
    setup(b) {
      const THREE = b.THREE, d = b.decor;
      const cs = Math.cos(SLOPE), sn = Math.sin(SLOPE);
      /** Point du plateau : x, s (distance depuis le pied) → repère du stand. */
      const onBoard = (x, s, lift = 0, out = new THREE.Vector3()) => out.set(x, B0.y + s * sn + lift * cs, B0.z - s * cs + lift * sn);
      // la piste, ses rives, le tremplin
      MF.box(1.1, 0.9, 1.9, MF.PAL.purple, { y: 0.45, z: 0.68, parent: d, cast: true });
      MF.box(0.86, 0.04, 1.9, "#f3e3c2", { y: 0.92, z: 0.68, parent: d });
      for (const sx of [-1, 1]) MF.box(0.1, 0.16, 1.9, MF.PAL.woodDark, { x: sx * 0.5, y: 0.98, z: 0.68, parent: d });
      MF.box(0.86, 0.05, 0.42, "#f3e3c2", { y: 0.98, z: -0.12, rx: 0.42, parent: d });
      // le plateau incliné, ses anneaux, ses joues
      const mid = onBoard(0, LEN / 2, -0.04);
      MF.box(1.6, 0.06, LEN, "#2c2440", { x: 0, y: mid.y, z: mid.z, rx: SLOPE, parent: d, cast: true });
      for (const sx of [-1, 1]) MF.box(0.08, 0.5, LEN + 0.1, MF.PAL.purple, { x: sx * 0.84, y: mid.y + 0.16, z: mid.z + 0.1, rx: SLOPE, parent: d });
      MF.box(1.76, 0.5, 0.08, MF.PAL.purple, { y: onBoard(0, LEN + 0.02, 0.2).y, z: onBoard(0, LEN + 0.02, 0.2).z, rx: SLOPE, parent: d });
      for (const [x, s, r, pts] of RINGS) {
        const p = onBoard(x, s, 0.012);
        MF.cyl(r, r, 0.02, "#0d0b14", { x, y: p.y, z: p.z, rx: SLOPE - Math.PI / 2, parent: d, seg: 20 });
        MF.torus(r + 0.02, 0.022, COLORS[pts], { x, y: p.y + 0.01, z: p.z, rx: SLOPE, parent: d, seg: 22, tubeSeg: 5 });
        const label = MF.sign(String(pts), { w: pts === 100 ? 0.22 : 0.17, h: 0.11, bg: COLORS[pts], color: "#1a1326", border: "#ffffff" });
        const q = onBoard(x + (x ? 0 : r + 0.2), s + (x ? -r - 0.1 : 0), 0.03);
        label.position.copy(q);
        label.rotation.x = SLOPE - Math.PI / 2;
        d.add(label);
      }
      const gutter = MF.sign("10", { w: 0.17, h: 0.11, bg: "#c9c2d6", color: "#1a1326", border: "#ffffff" });
      gutter.position.copy(onBoard(0.55, 0.1, 0.03));
      gutter.rotation.x = SLOPE - Math.PI / 2;
      d.add(gutter);
      // la boule (une seule en jeu à la fois) et le repère de visée sur la piste
      const ball = MF.sphere(0.06, "#b5651d", { parent: b.live, seg: 12 });
      ball.visible = false;
      const marker = MF.cone(0.07, 0.2, MF.PAL.yellow, { y: 0.96, z: -0.02, rx: -Math.PI / 2, parent: b.live, seg: 3 });
      marker.scale.set(1, 1, 0.2);
      const hand = new THREE.Vector3(), lip = new THREE.Vector3(), land = new THREE.Vector3(), end = new THREE.Vector3(), spot = new THREE.Vector3();
      let left = BALLS, busy = false, aimX = 0, last = "";

      function score(pts, at) {
        b.add(pts, pts === 100 ? "JACKPOT! +100" : "+" + pts, at);
        MF.sfx.play(pts >= 50 ? "bravo" : pts > 10 ? "ting" : "toc");
        if (pts === 100) b.confetti(at.x, at.y + 0.2, at.z, 18);
        last = "+" + pts;
        ball.visible = false;
        busy = false;
        if (!left) b.finish();
      }
      function roll(power) {
        busy = true;
        left--;
        MF.sfx.play("swing");
        const x = aimX, s = power * 1.82; // pleine force : la boule dépasse le haut du plateau
        hand.set(x * 0.4, 1.0, 1.5);
        lip.set(x, 1.06, -0.2);
        b.fly(ball, hand, lip, 0, 0.32, () => {
          if (s > LEN) {
            // trop fort : elle tape le fond et redescend dans la gouttière
            onBoard(x, LEN - 0.05, 0.06, land);
            return b.fly(ball, lip, land, 0.3, 0.3, () => b.fly(ball, land, onBoard(x, 0.05, 0.06, end), 0, 0.5, () => score(10, end)));
          }
          onBoard(x, Math.max(0.08, s), 0.06, land);
          b.fly(ball, lip, land, 0.22, 0.26, () => {
            // dans un anneau ? sinon elle redescend la pente et tombe dans le premier anneau sur son chemin
            let hit = RINGS.find(([rx, rs, r]) => Math.hypot(x - rx, s - rs) < r);
            if (hit) return score(hit[3], onBoard(hit[0], hit[1], 0.05, end));
            hit = RINGS.filter(([rx, rs, r]) => rs < s && Math.abs(x - rx) < r * 0.8).sort((p, q) => q[1] - p[1])[0];
            onBoard(x, hit ? hit[1] : 0.05, 0.06, end);
            b.fly(ball, land, end, 0, 0.18 + (s - (hit ? hit[1] : 0)) * 0.3, () => score(hit ? hit[3] : 10, end));
          });
        });
      }
      return {
        reset() {
          left = BALLS;
          busy = false;
          last = "";
          ball.visible = false;
        },
        update() {
          // visée : là où le viseur touche le plateau (ou la piste)
          const p = b.hit(-0.6, "z", spot);
          if (p && !busy) aimX = MF.clamp(p.x, -0.66, 0.66);
          marker.position.x = aimX * 0.9;
          marker.visible = b.playing && !busy;
          if (busy || !left) return; // une boule à la fois : pas de jauge pendant le vol
          const power = b.charge(1.0);
          if (power !== null) roll(power);
        },
        hud() {
          b.hud.set("balls", left + " / " + BALLS);
        },
      };
    },
  });
})();
