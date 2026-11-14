// La Fête du Moulin — décor commun : panneaux des stands, arche d'entrée, fanions.
//
// Rien ici ne touche à la maison ni au terrain : ce sont des objets de fête posés par-dessus
// (poteaux, panneaux, guirlandes), comme pour une kermesse dans le jardin.
//
//   MF.site.kiosk(def, world) → panneau du stand d'un jeu (au point def.station)
//   MF.site.spot(station, i)  → où se tient le i-ème joueur du jeu
//   MF.site.build({ world, root }) → arche d'entrée, guirlandes, panneau des jeux
(function () {
  "use strict";
  const MF = (globalThis.MoulinFete = globalThis.MoulinFete || {});

  /** Place du i-ème joueur : en ligne, de part et d'autre du panneau, tournés vers le jeu. */
  function spot(station, i) {
    const h = station.heading || 0;
    const side = (i % 2 ? 1 : -1) * (0.55 + Math.floor(i / 2) * 0.8);
    // en travers du regard (cap h, 0 = vers +z) : un coup à gauche, un coup à droite
    return { x: station.x + Math.cos(h) * side, z: station.z - Math.sin(h) * side, heading: h };
  }

  /** Panneau d'un stand : mât rayé, pancarte (icône + nom), ballons, rond de couleur au sol. */
  function kiosk(def, world) {
    const s = def.station;
    const y = world.heightAt(s.x, s.z);
    const h = s.heading || 0;
    // le mât est un peu en retrait, derrière le joueur (qui regarde vers le jeu)
    const bx = s.x - Math.sin(h) * 1.5 + Math.cos(h) * 1.7, bz = s.z - Math.cos(h) * 1.5 - Math.sin(h) * 1.7;
    const g = MF.group({ name: "Stand_" + def.id, x: bx, y: world.heightAt(bx, bz), z: bz, ry: h });
    g.add(MF.pole(3.1));
    const color = def.color || MF.PAL.red;
    const board = MF.sign(def.title.toUpperCase(), { w: 2.3, h: 0.5, bg: color, color: "#ffffff", border: "#ffffff", double: true });
    board.position.set(0, 2.45, 0.07);
    g.add(board);
    const sub = MF.sign(def.blurb || "", { w: 2.0, h: 0.3, bg: MF.PAL.cream, color: MF.PAL.ink, double: true });
    sub.position.set(0, 2.02, 0.07);
    g.add(sub);
    const colors = [MF.PAL.yellow, color, MF.PAL.blue];
    colors.forEach((c, i) => {
      const b = MF.balloon(c, 0.2);
      b.position.set((i - 1) * 0.2, 3.1 + (i === 1 ? 0.16 : 0), 0);
      b.rotation.z = (i - 1) * -0.3;
      g.add(b);
    });
    // rond au sol : « c'est ici qu'on joue »
    const THREE = globalThis.THREE;
    const local = new THREE.Vector3(s.x - bx, 0, s.z - bz).applyAxisAngle(new THREE.Vector3(0, 1, 0), -h);
    MF.mesh(new THREE.RingGeometry(0.95, 1.2, 28), MF.mat(color, { opacity: 0.85 }), { x: local.x, y: y - g.position.y + 0.05, z: local.z, rx: -Math.PI / 2, parent: g });
    return g;
  }

  /** Décor d'ensemble. points : repères relevés sur le terrain réel (voir CONCEPTION.md). */
  function build({ world, root }) {
    const g = MF.group({ name: "Decor_de_la_fete", parent: root });
    const H = (x, z) => world.heightAt(x, z);
    // Arche d'entrée en travers de l'allée, juste après le portail.
    const A = MF.site.entrance;
    const ax = (A.left[0] + A.right[0]) / 2, az = (A.left[1] + A.right[1]) / 2;
    const span = Math.hypot(A.right[0] - A.left[0], A.right[1] - A.left[1]);
    const angle = Math.atan2(A.right[0] - A.left[0], A.right[1] - A.left[1]) - Math.PI / 2;
    const arch = MF.group({ name: "Arche_entree", x: ax, y: Math.min(H(...A.left), H(...A.right)), z: az, ry: angle, parent: g });
    for (const side of [-1, 1]) {
      const p = MF.pole(4.4);
      p.position.x = (side * span) / 2;
      arch.add(p);
    }
    const title = MF.sign("LA FÊTE DU MOULIN", { w: span - 0.3, h: 0.95, bg: MF.PAL.red, color: "#ffffff", border: MF.PAL.yellow, double: true });
    title.position.y = 3.85;
    arch.add(title);
    const sp = MF.sponsors.board("village-arche", span - 0.9, 0.62, { y: 3.02, z: 0.02, kicker: "Arche d'entrée" });
    arch.add(sp);
    const spBack = MF.sponsors.board("village-arche", span - 0.9, 0.62, { y: 3.02, z: -0.02, ry: Math.PI, kicker: "Arche d'entrée" });
    spBack.material = sp.material;
    arch.add(spBack);
    [MF.PAL.yellow, MF.PAL.blue, MF.PAL.green, MF.PAL.pink].forEach((c, i) => {
      const b = MF.balloon(c, 0.24);
      b.position.set((i < 2 ? -1 : 1) * (span / 2) + (i % 2 ? 0.22 : -0.18), 4.4 + (i % 2) * 0.2, 0);
      arch.add(b);
    });
    // Guirlandes de fanions entre des mâts (liste de lignes brisées).
    for (const line of MF.site.garlands) {
      let prev = null;
      for (const [x, z] of line) {
        const y = H(x, z);
        const pole = MF.pole(3.3);
        pole.position.set(x, y, z);
        g.add(pole);
        const top = { x, y: y + 3.2, z };
        if (prev) g.add(MF.bunting(prev, top, { sag: 0.55, size: 0.3 }));
        prev = top;
      }
    }
    // Grand panneau des jeux, avec son emplacement de sponsor.
    const P = MF.site.board;
    const panel = MF.group({ name: "Panneau_des_jeux", x: P.x, y: H(P.x, P.z), z: P.z, ry: P.heading, parent: g });
    for (const side of [-1, 1]) MF.cyl(0.06, 0.07, 2.9, MF.PAL.woodDark, { x: side * 1.55, y: 1.45, parent: panel, cast: true, seg: 8 });
    const head = MF.sign("8 JEUX · 1 À 8 JOUEURS", { w: 3.0, h: 0.5, bg: MF.PAL.blue, color: "#ffffff", border: "#ffffff" });
    head.position.set(0, 2.6, 0.03);
    panel.add(head);
    panel.add(MF.sponsors.board("village-panneau", 3.0, 1.25, { y: 1.62, z: 0.03, kicker: "Grand panneau" }));
    MF.box(3.1, 1.85, 0.05, MF.PAL.wood, { y: 1.9, z: -0.01, parent: panel, cast: true });
    return g;
  }

  MF.site = {
    spot,
    kiosk,
    build,
    // Repères du terrain (x vers l'est, z vers le sud ; le moulin est en 0, 0). Ajustés sur la vraie page.
    entrance: { left: [-1.9, -77.5], right: [4.5, -77.5] },
    garlands: [],
    board: { x: 7.6, z: -79.6, heading: -2.0 },
  };
})();
