// La Fête du Moulin — Corn Hole (le lancer de sacs de maïs, grand classique des foires américaines).
//
// Huit sacs à lancer sur une planche inclinée percée d'un trou, à six mètres. On vise à la souris
// (gauche, droite), on maintient le clic pour doser la force et on lâche. Un sac qui reste sur la
// planche : 1 point ; dans le trou (direct ou en glissant) : 3 points. 24 points au maximum.
(function () {
  "use strict";
  const MF = globalThis.MoulinFete;
  const BAGS = 8;
  const BOARD = { z0: -3.95, z1: -5.45, half: 0.46, y0: 0.1, y1: 0.42, hole: -5.05, r: 0.15 }; // bord avant, bord arrière, trou
  const NEAR = 2.2, REACH = 3.9; // portée : de 2,2 m (jauge vide) à 6,1 m (jauge pleine)

  MF.booth({
    id: "cornhole",
    title: "Corn Hole",
    icon: "🌽",
    color: MF.PAL.yellow,
    blurb: "8 bags · 3 points in the hole, 1 on the board",
    help: "Aim left or right with the mouse, hold the click to set the power and release to toss. A bag that stays on the board scores 1, a bag in the hole scores 3: it can slide in, so land it just short of the hole.",
    hint: "Aim, hold to set the power, release to toss",
    at: { x: -52, z: -82.6, face: Math.PI / 2 },
    stall: false,
    size: { w: 2.4, d: 1.2 },
    maxTime: 110,
    cam: { y: 2.1, z: 2.2, look: [0, 0.55, -4.6], fov: 30 },
    cross: false,
    button: "TOSS",
    stats: [{ key: "bags", label: "Bags" }],
    setup(b) {
      const THREE = b.THREE, d = b.decor;
      const tilt = Math.atan2(BOARD.y1 - BOARD.y0, BOARD.z0 - BOARD.z1), len = Math.hypot(BOARD.z0 - BOARD.z1, BOARD.y1 - BOARD.y0);
      const slope = (z) => BOARD.y0 + ((BOARD.z0 - z) / (BOARD.z0 - BOARD.z1)) * (BOARD.y1 - BOARD.y0);
      // le tapis du lanceur, la ligne de lancer, les deux planches ; le fond du jeu est posé à la
      // hauteur du terrain là-bas (GY), qui n'est pas tout à fait celle du lanceur
      const GY = b.ground(0, (BOARD.z0 + BOARD.z1) / 2);
      MF.box(2.4, 0.06, 2.0, "#86d06c", { y: 0.03, z: 1.3, parent: d });
      MF.box(2.4, 0.03, 0.12, "#ffffff", { y: 0.07, z: 0.75, parent: d });
      const board = (z, flip) => {
        const g = MF.group({ y: flip ? 0 : GY, z, ry: flip ? Math.PI : 0, parent: d });
        MF.box(BOARD.half * 2, 0.05, len, "#f3e3c2", { y: (BOARD.y0 + BOARD.y1) / 2, rx: tilt, parent: g, cast: true });
        for (const sx of [-1, 1]) MF.box(0.04, 0.06, len, MF.PAL.red, { x: sx * (BOARD.half - 0.02), y: (BOARD.y0 + BOARD.y1) / 2 + 0.03, rx: tilt, parent: g });
        const hz = BOARD.hole - (BOARD.z0 + BOARD.z1) / 2;
        MF.cyl(BOARD.r, BOARD.r, 0.02, "#17130f", { y: slope(BOARD.hole) + 0.035, z: hz, rx: tilt, parent: g, seg: 20 });
        MF.torus(BOARD.r + 0.01, 0.014, MF.PAL.red, { y: slope(BOARD.hole) + 0.04, z: hz, rx: tilt + Math.PI / 2, parent: g, seg: 20, tubeSeg: 4 });
        MF.box(BOARD.half * 2, BOARD.y1, 0.05, MF.PAL.woodDark, { y: BOARD.y1 / 2, z: (BOARD.z1 - BOARD.z0) / 2 + 0.03, parent: g });
        return g;
      };
      board((BOARD.z0 + BOARD.z1) / 2, false);
      board(1.45, true).position.x = 1.0; // la planche d'en face, posée à côté du lanceur (décor)
      const put = (object, x, z) => {
        object.position.set(x, b.ground(x, z), z);
        d.add(object);
      };
      for (const sx of [-1, 1]) {
        for (const z of [0.9, -6.2]) put(MF.props.flag(sx < 0 ? MF.PAL.red : MF.PAL.blue, 2.4), sx * 1.25, z);
        put(MF.props.bale(), sx * 1.6, -6.3);
      }
      const title = MF.sign("CORN HOLE", { w: 2.2, h: 0.5, bg: MF.PAL.yellow, color: MF.PAL.ink, border: "#ffffff", double: true });
      title.position.set(0, 2.5 + GY, -6.7);
      d.add(title);
      for (const sx of [-1, 1]) MF.cyl(0.04, 0.04, 2.5, MF.PAL.woodDark, { x: sx * 1.0, y: 1.25 + GY, z: -6.7, parent: d, seg: 6 });
      // les sacs (réutilisés) et le repère de visée posé sur l'herbe
      const bags = [];
      for (let i = 0; i < BAGS; i++) {
        const m = MF.box(0.2, 0.06, 0.2, i % 2 ? MF.PAL.blue : MF.PAL.red, { parent: b.live });
        m.visible = false;
        bags.push(m);
      }
      const marker = MF.cone(0.12, 0.32, MF.PAL.yellow, { y: 0.05, z: -2.6, rx: -Math.PI / 2, parent: b.live, seg: 3 });
      marker.scale.set(1, 1, 0.15);
      const yAt = (z) => GY + slope(z); // hauteur de la planche du fond, dans le repère du stand
      const hand = new THREE.Vector3(), land = new THREE.Vector3(), end = new THREE.Vector3();
      let left = BAGS, busy = false, aimX = 0, holes = 0;

      function settle(bag, pts, text, at) {
        if (pts) b.add(pts, text, at);
        else b.hud.pop(text, ...b.screen(at));
        MF.sfx.play(pts === 3 ? "bravo" : pts ? "toc" : "perdu");
        if (pts === 3) {
          holes++;
          b.confetti(at.x, at.y + 0.2, at.z, 18);
          bag.visible = false;
        }
        busy = false;
        if (!left) b.finish();
      }
      function toss(power) {
        busy = true;
        const bag = bags[BAGS - left];
        left--;
        MF.sfx.play("swing");
        const x = aimX + (b.rand() - 0.5) * 0.06, z = -(NEAR + power * REACH);
        const onBoard = Math.abs(x) < BOARD.half && z < BOARD.z0 && z > BOARD.z1;
        hand.set(0.25, 1.1, 1.4);
        land.set(x, onBoard ? yAt(z) + 0.06 : b.ground(x, z) + 0.06, z);
        b.fly(bag, hand, land, 1.0 + power * 0.9, 0.55 + power * 0.35, () => {
          if (!onBoard) return settle(bag, 0, z > BOARD.z0 ? "Short!" : Math.abs(x) >= BOARD.half ? "Wide!" : "Long!", land);
          // sur la planche : le sac glisse vers le haut, d'autant plus qu'il arrive fort
          const stop = z - (0.2 + power * 0.55);
          const inHole = Math.abs(x) < BOARD.r * 0.9 && z > BOARD.hole - BOARD.r * 0.6 && stop < BOARD.hole + BOARD.r * 0.6;
          const zEnd = inHole ? BOARD.hole : Math.max(stop, BOARD.z1 - 0.3);
          end.set(inHole ? x * 0.3 : x, zEnd > BOARD.z1 ? yAt(zEnd) + 0.06 : b.ground(x, zEnd) + 0.06, zEnd);
          b.fly(bag, land, end, 0, 0.25 + (z - zEnd) * 0.5, () => (inHole ? settle(bag, 3, "CORNHOLE! +3", end) : zEnd > BOARD.z1 ? settle(bag, 1, "On the board +1", end) : settle(bag, 0, "Slid off!", end)));
        });
      }
      return {
        reset() {
          left = BAGS;
          busy = false;
          holes = 0;
          for (const m of bags) m.visible = false;
        },
        update() {
          if (!busy) aimX = MF.clamp(b.aim.x * 1.5, -1.0, 1.0);
          marker.position.x = aimX * 0.55;
          marker.visible = b.playing && !busy && left > 0;
          if (busy || !left) return void b.charge();
          const power = b.charge(0.95);
          if (power !== null) toss(power);
        },
        hud() {
          b.hud.set("bags", left + " / " + BAGS);
        },
      };
    },
  });
})();
