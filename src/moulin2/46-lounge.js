// La Fête du Moulin — le Ponton des fondateurs : s'asseoir avec son ordinateur, face à l'étang.
//
// Sur la rive nord-ouest du Grand étang, à deux pas de la terrasse du moulin (la rive est est
// bordée d'un grand massif de rhododendrons qui bouchait la vue) : trois gradins de bois descendent
// la pelouse, puis un ponton sur pilotis avance sur l'eau. Soixante-six poufs, tous tournés vers le
// sud : l'étang dans toute sa longueur, l'îlot, la course de bateaux qui passe devant. On
// s'approche d'un pouf libre, « Sit » : le personnage s'assoit, ouvre son ordinateur sur ses
// genoux, et les autres voient son pseudo et ce sur quoi il travaille. Échap pour se lever.
(function () {
  "use strict";
  const MF = (globalThis.MoulinFete = globalThis.MoulinFete || {});

  // Rangées : bandes est-ouest (x0 → x1), de la pelouse (nord) vers l'eau (sud) ; dessus à la hauteur y.
  const X0 = -41.6, X1 = -20.5, DEPTH = 2.4, PER_ROW = 11;
  const ROWS = [
    { z0: 23.0, y: 1.3 },
    { z0: 25.4, y: 1.0 },
    { z0: 27.8, y: 0.72 },
    { z0: 30.2, y: 0.5 }, // le ponton, au-dessus de l'eau
    { z0: 32.6, y: 0.5 },
    { z0: 35.0, y: 0.5 },
  ];
  const HEADING = 0; // tournés vers le sud : l'étang
  const COLORS = ["#ff8a2a", "#2f8fe8", "#ffc93a", "#3fae4a", "#9b59d0", "#e8402c", "#1fb5a8", "#ff6fa5"];
  const CX = (X0 + X1) / 2, Z_BACK = ROWS[0].z0, Z_FRONT = ROWS[ROWS.length - 1].z0 + DEPTH;

  function build(ctx) {
    const { world, places, presence, zone, put } = ctx;
    const g = zone("Ponton_des_fondateurs", CX, 30, 130);
    const P = MF.props;
    for (const [i, r] of ROWS.entries()) MF.decks.rect(world, g, { x: CX, z: r.z0 + DEPTH / 2, w: X1 - X0, l: DEPTH, heading: 0, y: r.y, name: "gradin" + i });
    // accès : par l'arrière (la pelouse côté moulin) et par le côté est (vers la terrasse et le ponton des bateaux)
    MF.decks.stairs(world, g, { from: [CX, Z_BACK - 2.0, world.groundAt(CX, Z_BACK - 2.0) + 0.03], to: [CX, Z_BACK + 0.1, ROWS[0].y], width: 3.2, name: "ponton", rails: false, steps: false });
    MF.decks.stairs(world, g, { from: [X1 + 2.2, ROWS[1].z0 + 1.2, world.groundAt(X1 + 2.2, ROWS[1].z0 + 1.2) + 0.03], to: [X1 - 0.1, ROWS[1].z0 + 1.2, ROWS[1].y], width: 2.2, name: "ponton-est", rails: false, steps: false });
    // les poufs
    const seats = [];
    const rnd = MF.rng(2026);
    for (const r of ROWS)
      for (let k = 0; k < PER_ROW; k++) {
        const x = X0 + 1.05 + k * 1.9 + (rnd() - 0.5) * 0.3, z = r.z0 + DEPTH / 2 - 0.2;
        const heading = HEADING + (rnd() - 0.5) * 0.3;
        const seat = { id: "seat-" + seats.length, x, y: r.y, z, heading };
        seats.push(seat);
        put(g, P.pouf(COLORS[Math.floor(rnd() * COLORS.length)]), x, z, heading, r.y);
      }
    const taken = (s) => presence.list().some((r) => r.sitting && Math.hypot(r.tx - s.x, r.tz - s.z) < 0.7);
    for (const s of seats)
      places.add({ id: s.id, x: s.x, z: s.z, r: 1.05, icon: "💻", title: "Founders' Deck", verb: "Sit & work", when: () => !taken(s), run: () => MF.app && MF.app.sit(s) });
    // enseigne (au dos, côté pelouse : c'est par là qu'on arrive), guirlandes, parasols, café
    const top = ROWS[0].y;
    const sign = MF.sign("FOUNDERS' DECK", { w: 4.2, h: 0.8, bg: MF.PAL.purple, color: "#ffffff", border: MF.PAL.yellow, double: true });
    sign.position.set(CX, top + 3.3, Z_BACK - 0.3);
    g.add(sign);
    const sub = MF.sign("SIT · OPEN YOUR LAPTOP · SHIP SOMETHING", { w: 4.2, h: 0.36, bg: MF.PAL.cream, color: MF.PAL.ink, double: true });
    sub.position.set(CX, top + 2.72, Z_BACK - 0.3);
    g.add(sub);
    for (const dx of [-2.2, 2.2]) put(g, MF.pole(3.9), CX + dx, Z_BACK - 0.3, 0, top - 0.3);
    const posts = [];
    for (const x of [X0 + 0.3, CX, X1 - 0.3]) {
      for (const [z, y] of [[Z_BACK + 0.3, top], [Z_FRONT - 0.3, ROWS[5].y]]) {
        put(g, MF.pole(3.4), x, z, 0, y);
        posts.push({ x, y: y + 3.3, z });
      }
    }
    for (let i = 0; i + 1 < posts.length; i += 2) g.add(P.lights(posts[i], posts[i + 1], { sag: 0.9, color: "#ffe28a" }));
    for (let i = 0; i + 3 < posts.length; i += 2) g.add(P.lights(posts[i + 1], posts[i + 3], { sag: 0.5, color: "#ffe28a" }));
    for (const [x, z, y, c] of [[X0 + 5.6, ROWS[1].z0 + 2.3, ROWS[1].y, MF.PAL.red], [X1 - 5.6, ROWS[1].z0 + 2.3, ROWS[1].y, MF.PAL.blue], [CX, ROWS[4].z0 + 2.3, ROWS[4].y, MF.PAL.yellow]]) {
      const parasol = MF.group({ name: "Parasol" });
      MF.cyl(0.035, 0.035, 2.5, MF.PAL.white, { y: 1.25, parent: parasol, seg: 6 });
      MF.cone(1.5, 0.5, c, { y: 2.6, parent: parasol, seg: 10, cast: true });
      put(g, parasol, x, z, 0, y);
    }
    put(g, P.cart("lemonade"), X1 + 2.6, Z_BACK - 1.6, Math.PI);
    put(g, P.bench(), CX + 6.5, Z_BACK - 1.9, 0);
    return { seats, update: () => false };
  }

  MF.lounge = { build, ROWS };
})();
