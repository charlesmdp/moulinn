// La Fête du Moulin — les manèges : la grande roue de la colline et le carrousel du pré.
//
// Ils tournent en permanence quand on est dans les parages. On peut y monter : « Ride » au pied
// du manège, on s'assoit dans une nacelle (ou sur un cheval de bois), la vue fait le reste ;
// Échap pour descendre. Les autres joueurs vous voient passer, ordinateur sur les genoux.
(function () {
  "use strict";
  const MF = (globalThis.MoulinFete = globalThis.MoulinFete || {});
  const TAU = Math.PI * 2;

  // Grande roue : sur le plateau, disque dans le plan nord-sud, tourné vers la vallée (à l'est).
  const WHEEL = { x: -62, z: -68, r: 10, hub: 11.7, n: 12, period: 52 };
  // Carrousel : au milieu du pré.
  const CAROUSEL = { x: 73.8, z: -5.8, r: 4.2, n: 8, period: 13 }; // entre la pêche aux canards et les tamponneuses

  function build(ctx) {
    const { world, places, zone } = ctx;
    const THREE = world.THREE;
    const H = (x, z) => world.heightAt(x, z);
    const riding = () => (MF.app && MF.app.seated && MF.app.seated()) || null;

    /* ---------------------------------------------------------------- grande roue */
    const W = WHEEL;
    const wz = zone("Grande_roue", W.x, W.z, 260);
    const base = H(W.x, W.z);
    const wg = MF.group({ name: "Grande_roue", x: W.x, y: base, z: W.z, parent: wz });
    const steel = "#e9eef5", red = MF.PAL.red;
    // deux chevalets en A, de part et d'autre du disque (le long de x)
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const leg = MF.box(0.28, Math.hypot(W.hub, 4.6), 0.28, steel, { x: sx * 1.7, y: W.hub / 2, z: sz * 2.3, rx: -sz * Math.atan2(4.6, W.hub), parent: wg, cast: true });
        leg.userData.keep = true;
      }
      MF.box(0.3, 0.3, 9.6, steel, { x: sx * 1.7, y: 0.25, parent: wg });
      MF.box(0.2, 0.2, 4.4, steel, { x: sx * 1.7, y: W.hub * 0.52, parent: wg });
    }
    MF.cyl(0.32, 0.32, 3.9, red, { y: W.hub, rz: Math.PI / 2, parent: wg, seg: 10 });
    // quai d'embarquement et guichet
    MF.box(3.4, 0.14, 5.2, MF.decks.WOOD, { x: 3.0, y: 0.07, parent: wg });
    const sign = MF.sign("FERRIS WHEEL", { w: 3.4, h: 0.62, bg: MF.PAL.pink, color: "#ffffff", border: MF.PAL.yellow, double: true });
    sign.position.set(4.9, 3.4, 0);
    sign.rotation.y = Math.PI / 2;
    wg.add(sign);
    for (const dz of [-1.6, 1.6]) {
      const pole = MF.pole(3.7);
      pole.position.set(4.9, 0, dz);
      wg.add(pole);
    }
    // la partie qui tourne : deux jantes, rayons, ampoules
    const rotor = MF.group({ y: W.hub, parent: wg });
    rotor.userData.live = true;
    const rim = new THREE.TorusGeometry(W.r, 0.11, 6, 48);
    const inner = new THREE.TorusGeometry(W.r * 0.55, 0.07, 5, 36);
    const spokes = MF.group({ parent: rotor });
    for (const sx of [-1, 1]) {
      MF.mesh(rim, steel, { x: sx * 1.15, ry: Math.PI / 2, parent: spokes, cast: true });
      MF.mesh(inner, red, { x: sx * 1.15, ry: Math.PI / 2, parent: spokes });
      for (let i = 0; i < W.n; i++) {
        const a = (i / W.n) * TAU;
        MF.box(0.07, W.r, 0.07, i % 2 ? steel : red, { x: sx * 1.15, y: (Math.sin(a) * W.r) / 2, z: (Math.cos(a) * W.r) / 2, rx: Math.PI / 2 - a, parent: spokes });
      }
    }
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * TAU, c = MF.props.BULBS[i % MF.props.BULBS.length];
      MF.sphere(0.12, MF.mat(c, { emissive: c, emissiveIntensity: 0.9 }), { x: 1.3, y: Math.sin(a) * W.r, z: Math.cos(a) * W.r, parent: spokes, seg: 6 });
    }
    MF.freeze(spokes);
    // nacelles : restent d'aplomb ; chacune est une place assise
    const cabins = [];
    const cabColors = [MF.PAL.red, MF.PAL.yellow, MF.PAL.blue, MF.PAL.green, MF.PAL.orange, MF.PAL.purple];
    for (let i = 0; i < W.n; i++) {
      const cab = MF.group({ parent: wg });
      cab.userData.live = true;
      const c = cabColors[i % cabColors.length];
      const shell = MF.group({ parent: cab });
      MF.cyl(0.05, 0.05, 2.5, steel, { rz: Math.PI / 2, parent: shell, seg: 6 }); // axe entre les jantes
      for (const sx of [-1, 1]) MF.box(0.05, 1.0, 0.05, steel, { x: sx * 0.75, y: -0.5, parent: shell });
      MF.cone(1.15, 0.4, c, { y: -0.22, parent: shell, seg: 8, cast: true });
      MF.box(1.5, 0.08, 1.1, c, { y: -1.75, parent: shell, cast: true }); // plancher
      MF.box(1.5, 0.5, 0.08, c, { y: -1.5, z: -0.55, parent: shell });
      MF.box(1.5, 0.5, 0.08, c, { y: -1.5, z: 0.55, parent: shell });
      MF.box(0.08, 0.5, 1.1, c, { x: -0.75, y: -1.5, parent: shell });
      MF.box(1.2, 0.08, 0.4, "#fff3d6", { x: -0.1, y: -1.33, parent: shell }); // banquette
      for (const [sx, sz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) MF.box(0.04, 1.25, 0.04, steel, { x: sx * 0.72, y: -0.95, z: sz * 0.52, parent: shell });
      MF.freeze(shell);
      // la place : assis dos à l'ouest, regard vers la vallée (est)
      const seat = { id: "wheel-" + i, x: W.x, y: base, z: W.z, heading: Math.PI / 2, moving: true, ride: "wheel", look: { x: 0, y: 6, z: -20 }, exit: { x: W.x + 3.6, z: W.z }, back: 0.4, up: 1.25 };
      cabins.push({ cab, seat, phase: (i / W.n) * TAU });
    }
    const wheelPlace = places.add({
      id: "ferris-wheel",
      x: W.x + 3.4,
      z: W.z,
      r: 3.2,
      icon: "🎡",
      title: "Ferris Wheel",
      verb: "Ride",
      run() {
        // la nacelle la plus proche du quai (en bas)
        let best = null, by = Infinity;
        for (const c of cabins) if (c.seat.y < by && !taken(c.seat)) ((best = c), (by = c.seat.y));
        if (best && MF.app) MF.app.sit(best.seat);
      },
    });
    const taken = (s) => ctx.presence.list().some((r) => r.sitting && Math.hypot(r.tx - s.x, r.tz - s.z) < 0.7 && Math.abs(r.ty - s.y) < 1);

    /* ---------------------------------------------------------------- carrousel */
    const C = CAROUSEL;
    const cz = zone("Carrousel", C.x, C.z, 150);
    const cy = H(C.x, C.z);
    const cg = MF.group({ name: "Carrousel", x: C.x, y: cy, z: C.z, parent: cz });
    MF.cyl(C.r + 0.5, C.r + 0.6, 0.3, MF.PAL.red, { y: 0.15, parent: cg, seg: 28, cast: true });
    MF.cyl(0.45, 0.45, 3.4, "#fff3d6", { y: 1.9, parent: cg, seg: 12 });
    const turn = MF.group({ parent: cg });
    turn.userData.live = true;
    const deck = MF.group({ parent: turn });
    MF.cyl(C.r + 0.3, C.r + 0.3, 0.1, "#fff3d6", { y: 0.36, parent: deck, seg: 28 });
    // chapiteau rayé (secteurs alternés) et lambrequin d'ampoules
    for (let i = 0; i < 16; i++) {
      const a0 = (i / 16) * TAU, a1 = ((i + 1) / 16) * TAU;
      const geo = new THREE.BufferGeometry();
      const R = C.r + 0.8;
      geo.setAttribute("position", new THREE.Float32BufferAttribute([0, 4.9, 0, Math.sin(a0) * R, 3.5, Math.cos(a0) * R, Math.sin(a1) * R, 3.5, Math.cos(a1) * R], 3));
      geo.computeVertexNormals();
      MF.mesh(geo, MF.mat(i % 2 ? MF.PAL.white : MF.PAL.red, { side: "double" }), { parent: deck, cast: true });
      const c = MF.props.BULBS[i % MF.props.BULBS.length];
      MF.sphere(0.1, MF.mat(c, { emissive: c, emissiveIntensity: 0.9 }), { x: Math.sin(a0) * R, y: 3.42, z: Math.cos(a0) * R, parent: deck, seg: 6 });
    }
    MF.cyl(C.r + 0.8, C.r + 0.8, 0.22, MF.PAL.yellow, { y: 3.4, parent: deck, seg: 28, open: true });
    MF.sphere(0.22, MF.PAL.yellow, { y: 5.0, parent: deck, seg: 8 });
    MF.freeze(deck);
    const horses = [];
    const horseColors = ["#ffffff", "#f4c27a", "#c9ced6", "#8a5a2c", "#ffffff", "#f7a8c4", "#9ad8ff", "#2c3140"];
    for (let i = 0; i < C.n; i++) {
      const a = (i / C.n) * TAU, rr = i % 2 ? C.r - 0.5 : C.r - 1.6;
      const pole = MF.cyl(0.035, 0.035, 3.1, MF.PAL.yellow, { x: Math.sin(a) * rr, y: 1.95, z: Math.cos(a) * rr, parent: turn, seg: 6 });
      pole.userData.noMerge = true;
      const horse = MF.group({ x: Math.sin(a) * rr, y: 1.1, z: Math.cos(a) * rr, ry: a + Math.PI / 2, parent: turn });
      const body = MF.group({ parent: horse });
      const hc = horseColors[i % horseColors.length];
      MF.sphere(0.3, hc, { parent: body, seg: 10, cast: true }).scale.set(0.62, 0.72, 1.5);
      MF.box(0.16, 0.5, 0.2, hc, { y: 0.34, z: 0.42, rx: 0.5, parent: body });
      MF.sphere(0.15, hc, { y: 0.58, z: 0.6, parent: body, seg: 8 }).scale.set(0.8, 0.85, 1.4);
      for (const [sx, sz] of [[-1, 0.3], [1, 0.3], [-1, -0.3], [1, -0.3]]) MF.box(0.07, 0.5, 0.07, hc, { x: sx * 0.11, y: -0.42, z: sz, rx: sz > 0 ? -0.35 : 0.35, parent: body });
      MF.box(0.3, 0.06, 0.34, cabColors[i % cabColors.length], { y: 0.2, parent: body }); // selle
      MF.cone(0.05, 0.34, MF.PAL.yellow, { y: 0.14, z: -0.5, rx: -2.2, parent: body, seg: 5 }); // queue
      MF.freeze(body);
      const seat = { id: "horse-" + i, x: C.x, y: cy, z: C.z, heading: 0, moving: true, ride: "carousel", exit: { x: C.x, z: C.z - C.r - 1.6 }, back: 2.4, up: 1.5, a, rr };
      horses.push({ horse, seat, a, rr, i });
    }
    const csign = MF.sign("CAROUSEL", { w: 2.6, h: 0.55, bg: MF.PAL.yellow, color: MF.PAL.red, border: MF.PAL.red, double: true });
    csign.position.set(0, 4.2, -C.r - 1.1);
    cg.add(csign);
    places.add({
      id: "carousel",
      x: C.x,
      z: C.z - C.r - 1.2,
      r: 2.6,
      icon: "🎠",
      title: "Carousel",
      verb: "Ride",
      run() {
        const free = horses.find((h) => !taken(h.seat));
        if (free && MF.app) MF.app.sit(free.seat);
      },
    });

    let wheelA = 0, carA = 0;
    function pose(time) {
      wheelA = ((time / W.period) * TAU) % TAU;
      rotor.rotation.x = -wheelA;
      for (const c of cabins) {
        const a = c.phase + wheelA;
        const y = W.hub + Math.sin(a) * W.r, z = Math.cos(a) * W.r;
        c.cab.position.set(0, y, z);
        c.seat.y = base + y - 1.72;
        c.seat.z = W.z + z;
      }
      carA = ((time / C.period) * TAU) % TAU;
      turn.rotation.y = carA;
      for (const h of horses) {
        const bob = Math.sin(time * 2.1 + h.i * 1.7) * 0.22;
        h.horse.position.y = 1.15 + bob;
        const a = h.a + carA;
        h.seat.x = C.x + Math.sin(a) * h.rr;
        h.seat.z = C.z + Math.cos(a) * h.rr;
        h.seat.y = cy + 0.9 + bob;
        h.seat.heading = a + Math.PI / 2;
      }
    }
    // Tous les visiteurs voient les manèges au même endroit : l'heure commune est celle de l'horloge.
    const clock = () => Date.now() / 1000;
    pose(clock());
    void wheelPlace;
    // Un autre joueur assis dans un manège est dessiné exactement à sa place d'ici (les horloges
    // de deux appareils diffèrent toujours un peu).
    ctx.presence.snap = (r) => {
      let best = null, bd = 3.2;
      for (const list of [cabins, horses])
        for (const item of list) {
          const d = Math.hypot(r.tx - item.seat.x, r.ty - item.seat.y, r.tz - item.seat.z);
          if (d < bd) ((best = item.seat), (bd = d));
        }
      return best;
    };
    return {
      wheel: W,
      carousel: C,
      cabins,
      horses,
      /** Les manèges tournent quand on les voit (ou qu'on est dessus). */
      update() {
        const seat = riding();
        if (!wz.visible && !cz.visible && !(seat && seat.ride)) return false;
        pose(clock());
        return true;
      },
    };
  }

  MF.rides = { build, WHEEL, CAROUSEL };
})();
