// La Fête du Moulin — le Ponton des fondateurs : s'asseoir avec son ordinateur, face à l'étang.
//
// Sur la rive est du grand étang, quatre gradins de bois descendent vers l'eau ; le premier avance
// au-dessus de l'étang, sur pilotis. Soixante-cinq poufs, tous tournés vers l'eau, l'île et le
// moulin. On s'approche d'un pouf libre, « Sit » : le personnage s'assoit, ouvre son ordinateur sur
// ses genoux, et les autres voient son pseudo et ce sur quoi il travaille. Échap pour se lever.
(function () {
  "use strict";
  const MF = (globalThis.MoulinFete = globalThis.MoulinFete || {});

  // Gradins : bandes nord-sud (z0 → z1), de l'eau (ouest) vers la berge (est) ; dessus à la hauteur y.
  const Z0 = 21, Z1 = 46.6;
  const ROWS = [
    { x0: 16.4, x1: 22.4, y: 0.7, seats: [18.0, 20.9] }, // au-dessus de l'eau
    { x0: 22.4, x1: 25.2, y: 1.0, seats: [23.9] },
    { x0: 25.2, x1: 28.0, y: 1.3, seats: [26.7] },
    { x0: 28.0, x1: 30.9, y: 1.6, seats: [29.5] },
  ];
  const HEADING = -Math.PI / 2; // tournés vers l'ouest : l'étang
  const COLORS = ["#ff8a2a", "#2f8fe8", "#ffc93a", "#3fae4a", "#9b59d0", "#e8402c", "#1fb5a8", "#ff6fa5"];

  function build(ctx) {
    const { world, places, presence, zone, put } = ctx;
    const g = zone("Ponton_des_fondateurs", 24, 34, 120);
    const P = MF.props;
    for (const [i, r] of ROWS.entries())
      MF.decks.rect(world, g, { x: (r.x0 + r.x1) / 2, z: (Z0 + Z1) / 2, w: r.x1 - r.x0, l: Z1 - Z0, heading: 0, y: r.y, name: "gradin" + i });
    // accès : une rampe au nord, depuis le chemin du moulin ; l'arrière des gradins rejoint la pelouse
    const rampTop = ROWS[2];
    MF.decks.stairs(world, g, { from: [26.6, Z0 - 3.1, world.groundAt(26.6, Z0 - 3.1) + 0.03], to: [26.6, Z0 + 0.1, rampTop.y], width: 2.2, name: "ponton", rails: false });
    MF.decks.stairs(world, g, { from: [32.9, 38, world.groundAt(32.9, 38) + 0.03], to: [30.8, 38, ROWS[3].y], width: 3, name: "ponton-est", rails: false, steps: false });
    // les poufs
    const seats = [];
    const rnd = MF.rng(2026);
    for (const r of ROWS)
      for (const x of r.seats)
        for (let k = 0; k < 13; k++) {
          const z = Z0 + 1.35 + k * 1.92 + (rnd() - 0.5) * 0.3;
          const heading = HEADING + (rnd() - 0.5) * 0.3;
          const seat = { id: "seat-" + seats.length, x, y: r.y, z, heading };
          seats.push(seat);
          put(g, P.pouf(COLORS[Math.floor(rnd() * COLORS.length)]), x, z, heading, r.y);
        }
    const taken = (s) => presence.list().some((r) => r.sitting && Math.hypot(r.tx - s.x, r.tz - s.z) < 0.7);
    for (const s of seats)
      places.add({ id: s.id, x: s.x, z: s.z, r: 1.05, icon: "💻", title: "Founders' Deck", verb: "Sit & work", when: () => !taken(s), run: () => MF.app && MF.app.sit(s) });
    // enseigne, guirlandes, parasols, café
    const sign = MF.sign("FOUNDERS' DECK", { w: 4.2, h: 0.8, bg: MF.PAL.purple, color: "#ffffff", border: MF.PAL.yellow, double: true });
    sign.position.set(29.6, ROWS[3].y + 3.3, Z0 - 0.4);
    g.add(sign);
    const sub = MF.sign("SIT · OPEN YOUR LAPTOP · SHIP SOMETHING", { w: 4.2, h: 0.36, bg: MF.PAL.cream, color: MF.PAL.ink, double: true });
    sub.position.set(29.6, ROWS[3].y + 2.72, Z0 - 0.4);
    g.add(sub);
    for (const dx of [-2.2, 2.2]) put(g, MF.pole(3.9), 29.6 + dx, Z0 - 0.4, 0, ROWS[3].y - 0.3);
    const posts = [];
    for (const z of [Z0 + 0.4, (Z0 + Z1) / 2, Z1 - 0.4]) {
      for (const [x, y] of [[16.7, ROWS[0].y], [30.6, ROWS[3].y]]) {
        put(g, MF.pole(3.4), x, z, 0, y);
        posts.push({ x, y: y + 3.3, z });
      }
    }
    for (let i = 0; i + 1 < posts.length; i += 2) g.add(P.lights(posts[i], posts[i + 1], { sag: 0.9, color: "#ffe28a" }));
    for (let i = 0; i + 3 < posts.length; i += 2) g.add(P.lights(posts[i + 1], posts[i + 3], { sag: 0.5, color: "#ffe28a" }));
    for (const [x, z, y, c] of [[21.9, 27.6, ROWS[0].y, MF.PAL.red], [21.9, 40.2, ROWS[0].y, MF.PAL.blue], [28.2, 33.9, ROWS[3].y, MF.PAL.yellow]]) {
      const parasol = MF.group({ name: "Parasol" });
      MF.cyl(0.035, 0.035, 2.5, MF.PAL.white, { y: 1.25, parent: parasol, seg: 6 });
      MF.cone(1.5, 0.5, c, { y: 2.6, parent: parasol, seg: 10, cast: true });
      put(g, parasol, x, z, 0, y);
    }
    put(g, P.cart("lemonade"), 32.6, 31.2, -Math.PI / 2);
    put(g, P.bench(), 32.4, 43.6, -Math.PI / 2);
    return { seats, update: () => false };
  }

  MF.lounge = { build, ROWS };
})();
