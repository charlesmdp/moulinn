// La Fête du Moulin — « Dream Mill Fest » : les lieux où l'on se retrouve, en dehors des jeux, et
// les clins d'œil aux entrepreneurs et indie hackers (titres de livres, devises et expressions
// connues, en hommage : rien ici ne prétend que ces personnes soutiennent la fête).
//
//   La terrasse du moulin : on s'assoit dans le vrai salon de jardin (canapé, deux fauteuils) et à
//     la vraie table (quatre chaises, l'ordinateur posé dessus).
//   La pointe de la terrasse (par le petit pont du bief) : charrettes, table, et le bouton
//     « SHIP IT » qui tire un feu d'artifice au-dessus de l'étang, vu de tous.
//   Le camp des bûcherons (rive est du Grand étang) : feu de camp « Indie Hackers » (huit rondins où
//     s'asseoir), hamacs « The 4-Hour Workweek ».
//   Le bord du plateau : montgolfière « Up and to the right » où l'on monte à quatre.
//   Un peu partout : panneaux-citations.
//
//   MF.fest.build({ world, places, presence, net, zone, put }) → { update(dt, t, camera) }
(function () {
  "use strict";
  const MF = (globalThis.MoulinFete = globalThis.MoulinFete || {});
  const TAU = Math.PI * 2;
  const BALLOON = { x: -95, z: -4, rise: 34, drift: 18, period: 72 }; // un vol toutes les 72 s : 18 s au sol, montée, palier, descente
  const BUTTON = { x: 10.8, z: 14.4 };
  const SKY = { x: 2, z: 27 }; // le feu d'artifice éclate au-dessus de la baie nord du Grand étang

  /** Feu d'artifice : un seul nuage de points (un appel de dessin), des gerbes qui retombent. */
  function fireworks(parent, count = 540) {
    const THREE = globalThis.THREE;
    const pos = new Float32Array(count * 3).fill(-999), col = new Float32Array(count * 3), parts = [];
    for (let i = 0; i < count; i++) parts.push({ life: 0, vx: 0, vy: 0, vz: 0 });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    // chaque point est un petit disque lumineux (texture dessinée une fois)
    const dot = MF.canvasTexture(32, 32, (c) => {
      const g = c.createRadialGradient(16, 16, 1, 16, 16, 15);
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(0.45, "rgba(255,255,255,0.95)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = g;
      c.fillRect(0, 0, 32, 32);
    });
    const points = new THREE.Points(geo, new THREE.PointsMaterial({ size: 1.15, map: dot, vertexColors: true, transparent: true, depthWrite: false, sizeAttenuation: true }));
    points.frustumCulled = false;
    points.name = "Feu_d_artifice";
    points.userData.live = true;
    points.visible = false;
    parent.add(points);
    const queue = []; // gerbes à venir : { at, x, y, z, color }
    let next = 0, alive = 0, clock = 0;
    function burst(x, y, z, color) {
      const c = MF.color(color);
      for (let k = 0; k < 90; k++) {
        const i = next++ % count, p = parts[i];
        // direction au hasard sur la sphère, vitesse presque égale : une boule qui s'ouvre
        const u = Math.random() * 2 - 1, a = Math.random() * TAU, s = Math.sqrt(1 - u * u), v = 6.5 + Math.random() * 2.5;
        p.vx = Math.cos(a) * s * v;
        p.vy = u * v + 1.5;
        p.vz = Math.sin(a) * s * v;
        p.life = 1.5 + Math.random() * 0.7;
        pos[i * 3] = x;
        pos[i * 3 + 1] = y;
        pos[i * 3 + 2] = z;
        col[i * 3] = c.r;
        col[i * 3 + 1] = c.g;
        col[i * 3 + 2] = c.b;
      }
      geo.attributes.color.needsUpdate = true;
      alive = Math.max(alive, 2.4);
      points.visible = true;
      MF.sfx.play("choc");
    }
    return {
      /** Tire le bouquet « seed » (le même chez tous les joueurs). */
      launch(seed) {
        const rnd = MF.rng(seed | 0), colors = [MF.PAL.red, MF.PAL.yellow, MF.PAL.blue, MF.PAL.green, MF.PAL.pink, MF.PAL.orange, "#ffffff"];
        for (let i = 0; i < 7; i++) queue.push({ at: clock + 0.35 + i * 0.42 + rnd() * 0.2, x: SKY.x + (rnd() - 0.5) * 22, y: 14 + rnd() * 9, z: SKY.z + (rnd() - 0.5) * 10, color: colors[Math.floor(rnd() * colors.length)] });
        MF.sfx.play("swing");
      },
      update(dt) {
        clock += dt;
        while (queue.length && queue[0].at <= clock) {
          const q = queue.shift();
          burst(q.x, q.y, q.z, q.color);
        }
        if (alive <= 0) {
          if (points.visible && !queue.length) points.visible = false;
          return queue.length > 0;
        }
        alive -= dt;
        const drag = Math.exp(-1.6 * dt);
        for (let i = 0; i < count; i++) {
          const p = parts[i];
          if (p.life <= 0) continue;
          p.life -= dt;
          if (p.life <= 0) {
            pos[i * 3 + 1] = -999;
            continue;
          }
          p.vx *= drag;
          p.vz *= drag;
          p.vy = p.vy * drag - 4.2 * dt;
          pos[i * 3] += p.vx * dt;
          pos[i * 3 + 1] += p.vy * dt;
          pos[i * 3 + 2] += p.vz * dt;
        }
        geo.attributes.position.needsUpdate = true;
        return true;
      },
    };
  }

  function build(ctx) {
    const { world, places, presence, net, zone, put } = ctx, P = MF.props, H = (x, z) => world.heightAt(x, z);
    const riding = () => (MF.app && MF.app.seated && MF.app.seated()) || null;
    const taken = (s) => presence.list().some((r) => r.sitting && Math.hypot(r.tx - s.x, r.tz - s.z) < 0.34 && Math.abs(r.ty - s.y) < 1.5);
    const fixed = []; // places fixes qui ont une pose à elles (hamac, table) : les autres joueurs y sont dessinés pareil
    const seatPlace = (s, title, verb, icon, r = 1.0) => places.add({ id: s.id, x: s.x, z: s.z, r, icon, title, verb, when: () => !taken(s), run: () => MF.app && MF.app.sit(s) });
    /** Panneau sur deux piquets, lisible des deux côtés. */
    const board = (parent, text, x, z, heading, o = {}) => {
      const w = o.w || Math.max(2, text.length * 0.17), h = o.h || 0.42, y = o.y ?? H(x, z), top = o.top || 2.4;
      const g = MF.group({ name: "Panneau", x, y, z, ry: heading, parent });
      const sign = MF.sign(text, { w, h, px: 128, bg: o.bg || MF.PAL.cream, color: o.color || MF.PAL.ink, border: o.border || MF.PAL.ink, double: true });
      sign.position.y = top;
      g.add(sign);
      if (o.posts !== false) for (const sx of [-1, 1]) MF.cyl(0.035, 0.035, top, MF.PAL.woodDark, { x: sx * (w / 2 - 0.15), y: top / 2, parent: g, seg: 6 });
      return g;
    };

    /* ---- La terrasse du moulin : le vrai mobilier devient des places (relevé sur la page du moulin) */
    const terrace = zone("Terrasse_du_moulin", -2, 12, 100);
    const sofaExit = { x: -2.9, z: 14.9 };
    const lounge = [
      { id: "sofa-0", x: -3.9, z: 15.7, heading: 3.02, sit: 0.68, exit: sofaExit },
      { id: "sofa-1", x: -4.62, z: 15.61, heading: 3.02, sit: 0.68, exit: sofaExit },
      { id: "sofa-2", x: -5.33, z: 15.53, heading: 3.02, sit: 0.68, exit: sofaExit },
      { id: "armchair-0", x: -6.04, z: 14.43, heading: 1.45, sit: 0.68, exit: { x: -5.3, z: 13.4 } },
      { id: "armchair-1", x: -3.6, z: 13.78, heading: -0.4, sit: 0.68, exit: { x: -4.7, z: 13.2 } },
    ];
    // à la table : l'ordinateur est posé dessus (desk : hauteur du plateau au-dessus du sol)
    const table = [
      { id: "table-0", x: -1.94, z: 11.59, heading: 1.33, exit: { x: -2.95, z: 11.35 } },
      { id: "table-1", x: -1.63, z: 10.31, heading: 1.33, exit: { x: -2.65, z: 10.05 } },
      { id: "table-2", x: -0.27, z: 12.0, heading: -1.81, exit: { x: -0.3, z: 13.1 } },
      { id: "table-3", x: 0.04, z: 10.73, heading: -1.81, exit: { x: 0.75, z: 9.6 } },
    ];
    for (const s of lounge) {
      s.y = H(s.x, s.z);
      // vu de face, depuis le milieu de la terrasse : le salon, et le Grand étang derrière
      s.cam = { x: -4.7, y: s.y + 2.15, z: 11.3 };
      s.look = { x: -4.7, y: s.y + 0.75, z: 15.4 };
      seatPlace(s, "Deep Work Lounge", s.id.startsWith("sofa") ? "Sink into the sofa" : "Take the armchair", "🛋️", 0.85);
      fixed.push(s);
    }
    for (const s of table) {
      s.y = H(s.x, s.z);
      s.sit = 0.6;
      s.desk = 0.79;
      s.back = 3.0;
      seatPlace(s, "Ramen Profitable Table", "Take a seat", "🍜", 0.8);
      fixed.push(s);
    }
    // deux petits chevalets posés sur les tables (hauteurs relevées : table basse 1,55 m, table 1,97 m)
    board(terrace, "DEEP WORK LOUNGE", -4.5, 14.73, 3.02, { w: 0.9, h: 0.2, y: 1.55, top: 0.13, posts: false, bg: "#ff7f6b", color: "#ffffff", border: "#ffffff" });
    board(terrace, "RAMEN PROFITABLE · TABLE FOR 4", -0.95, 11.15, 1.33, { w: 1.1, h: 0.2, y: 1.97, top: 0.13, posts: false, bg: MF.PAL.yellow });

    /* ---- La pointe de la terrasse : on y passe par le petit pont du bief */
    const point = zone("Pointe_de_la_terrasse", 9, 11, 110);
    put(point, P.cart("hotdog"), 12.8, 7.6, -0.5);
    put(point, P.cart("lemonade"), 13.6, 12.4, 2.4);
    put(point, P.picnic(), 7.6, 7.4, 0.2);
    board(point, "BUY ME A COFFEE", 14.4, 13.4, 2.4, { w: 2.2, bg: "#ffdd00", top: 2.5 });
    board(point, "STAY HUNGRY. STAY FOOLISH.", 13.4, 10.4, Math.PI / 2, { w: 3.4, top: 2.7 });
    // le bouton « SHIP IT » : un socle, un gros bouton rouge ; on appuie, le bouquet part
    const by = H(BUTTON.x, BUTTON.z);
    const stand = MF.group({ name: "Bouton_ship_it", x: BUTTON.x, y: by, z: BUTTON.z, parent: point });
    MF.cyl(0.26, 0.32, 0.9, "#2c3e50", { y: 0.45, parent: stand, seg: 12, cast: true });
    MF.cyl(0.34, 0.34, 0.06, MF.PAL.yellow, { y: 0.93, parent: stand, seg: 16 });
    const knob = MF.cyl(0.24, 0.26, 0.12, MF.mat(MF.PAL.red, { unique: true }), { y: 1.02, parent: stand, seg: 16 });
    knob.userData.live = true;
    board(point, "SHIP IT · LAUNCH DAY FIREWORKS", BUTTON.x + 1.3, BUTTON.z - 0.4, 0.5, { w: 3.2, y: by, bg: MF.PAL.red, color: "#ffffff", border: MF.PAL.yellow, top: 2.3 });
    board(point, "IF YOU'RE NOT EMBARRASSED BY V1, YOU SHIPPED TOO LATE", BUTTON.x + 1.3, BUTTON.z - 0.4, 0.5, { w: 3.2, y: by, h: 0.24, top: 1.9, posts: false });
    const show = fireworks(ctx.root || point.parent);
    let pressed = 0, cool = 0;
    const fire = (seed) => {
      pressed = 0.25;
      show.launch(seed);
      world.invalidate();
    };
    if (net) net.on("ship", (d) => Array.isArray(d) && fire(d[0]));
    places.add({
      id: "ship-it",
      x: BUTTON.x,
      z: BUTTON.z,
      r: 1.5,
      icon: "🚀",
      title: "Ship it",
      verb: "Push the button",
      when: () => cool <= 0,
      run() {
        const seed = Math.floor(Math.random() * 1e9);
        cool = 5;
        if (net) net.send("ship", [seed]);
        fire(seed);
      },
    });

    /* ---- Le camp des bûcherons : enseigne, feu de camp, hamacs (au sud des trois jeux d'arbres) */
    const camp = zone("Camp_des_bucherons", 30, 34, 120);
    board(camp, "THE LUMBER CAMP", 28.6, 19.6, 0, { w: 3.2, h: 0.55, bg: "#b5651d", color: "#ffffff", border: MF.PAL.yellow, top: 2.9 });
    board(camp, "IT DOESN'T HAVE TO BE CRAZY AT WORK", 26.4, 32.4, Math.PI / 2, { w: 3.8, top: 0.7, h: 0.34 });
    const fx = 28.4, fz = 43.0, fy = H(fx, fz);
    const pit = MF.group({ name: "Feu_de_camp", x: fx, y: fy, z: fz, parent: camp });
    for (let i = 0; i < 9; i++) MF.sphere(0.16, "#8f979b", { x: Math.cos((i / 9) * TAU) * 0.55, y: 0.08, z: Math.sin((i / 9) * TAU) * 0.55, parent: pit, seg: 6 });
    for (let i = 0; i < 3; i++) MF.cyl(0.07, 0.07, 0.9, "#6b4a2e", { y: 0.16, ry: i * 1.05, rz: Math.PI / 2 - 0.25, parent: pit, seg: 6 });
    const flames = MF.group({ parent: pit });
    flames.userData.live = true;
    const glow = MF.mat("#ffb02e", { emissive: "#ff7a1a", emissiveIntensity: 1 });
    const tongues = [0.5, 0.36, 0.3].map((h, i) => MF.cone(0.2 - i * 0.04, h, glow, { x: (i - 1) * 0.12, y: 0.2 + h / 2, z: (i % 2) * 0.1, parent: flames, seg: 6 }));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU, x = fx + Math.sin(a) * 2.0, z = fz + Math.cos(a) * 2.0, y = H(x, z);
      MF.cyl(0.3, 0.3, 0.44, i % 2 ? "#9a6a3c" : "#8a5a33", { x, y: y + 0.22, z, parent: camp, seg: 10, cast: true });
      MF.cyl(0.24, 0.24, 0.02, "#e6c998", { x, y: y + 0.45, z, parent: camp, seg: 10 });
      seatPlace({ id: "fire-" + i, x, y, z, heading: a + Math.PI }, "Indie Hackers Campfire", "Pull up a log", "🔥", 0.9);
    }
    board(camp, "INDIE HACKERS CAMPFIRE · BUILD IN PUBLIC", 28.4, 46.2, 0, { w: 4.2, bg: "#2c3e50", color: "#ffffff", border: "#ffffff", top: 2.2 });
    // hamacs à l'ombre des arbres : deux piquets, une toile ; on s'y allonge avec son ordinateur
    const cloth = ["#e84393", "#0984e3", "#00b894"];
    [[33.8, 44.4, 0.25], [35.6, 46.4, -0.3], [36.4, 43.4, 1.2]].forEach(([x, z, h], i) => {
      const y = H(x, z), g = MF.group({ name: "Hamac", x, y, z, ry: h, parent: camp });
      for (const s of [-1, 1]) MF.cyl(0.05, 0.06, 1.3, MF.PAL.woodDark, { z: s * 1.4, y: 0.65, rx: s * 0.2, parent: g, seg: 6, cast: true });
      for (let k = -2; k <= 2; k++) MF.box(0.9, 0.04, 0.54, cloth[i], { y: 0.62 - (1 - Math.abs(k) / 2) * 0.2, z: k * 0.48, rx: -Math.sign(k) * 0.2, parent: g });
      const seat = { id: "hammock-" + i, x, y, z, heading: h, sit: 0.56, tilt: -0.6, back: 2.4, up: 1.6, exit: { x: x + Math.cos(h) * 1.1, z: z - Math.sin(h) * 1.1 } };
      seatPlace(seat, "The 4-Hour Workweek", "Lie in the hammock", "🌴", 1.1);
      fixed.push(seat);
    });
    board(camp, "THE 4-HOUR WORKWEEK · HAMMOCKS", 32.4, 46.4, Math.PI / 2, { w: 3.4, bg: MF.PAL.yellow, top: 2.0 });

    /* ---- Panneaux-citations : l'entrée, l'allée des stands (côté ouest, face aux baraques), la colline */
    const quotes = zone("Citations_entree", 2, -66, 95);
    board(quotes, "IT'S ALWAYS DAY 1", -3.6, -84.6, 0.3, { w: 2.2, top: 0.75, h: 0.36, bg: MF.PAL.yellow });
    board(quotes, "THE LONG, SLOW SaaS RAMP OF DEATH · KEEP CLIMBING", -8.4, -78.3, 0, { w: 4.6, top: 0.75, h: 0.34 });
    for (const [z, text, bg] of [
      [-70.6, "ZERO TO ONE · RING THE BELL", MF.PAL.cream],
      [-64.6, "WHACK THE BUGS BEFORE THEY SHIP", "#d8f5d0"],
      [-58.6, "DO THINGS THAT DON'T SCALE", MF.PAL.cream],
      [-52.8, "SMALL BETS · MANY RINGS", "#ffe3ec"],
    ])
      board(quotes, text, -3.7, z, Math.PI / 2, { w: 3.0, top: 1.25, h: 0.34, bg });
    const hillQuotes = zone("Citations_colline", -52, -70, 110);
    board(hillQuotes, "MOVE FAST AND BREAK THINGS", -33.2, -82.9, 0, { w: 2.9, top: 0.75, h: 0.34 });
    board(hillQuotes, "MAKE SOMETHING PEOPLE WANT", -56.4, -79.4, Math.PI / 2, { w: 2.9, top: 0.75, h: 0.34, bg: "#fff0b8" });
    board(hillQuotes, "SHIP FAST RACEWAY", -66.6, -43.4, 0.9, { w: 3.0, h: 0.5, bg: MF.PAL.red, color: "#ffffff", border: MF.PAL.yellow, top: 3.0 });

    /* ---- Le bord du plateau : poteau indicateur, montgolfière face à la vallée */
    const fields = zone("Bord_du_plateau", -98, -8, 170);
    put(
      fields,
      P.signpost([
        { text: "MINI-GOLF", color: MF.PAL.green, dir: -1.8 },
        { text: "THE IDEA MAZE", color: MF.PAL.purple, dir: -1.05 },
        { text: "BALLOON · UP AND TO THE RIGHT", color: MF.PAL.orange, dir: -0.55 },
        { text: "SHIP FAST RACEWAY · TIM FERRISS WHEEL", color: MF.PAL.red, dir: 2.6 },
      ]),
      -91.6,
      -10.4,
    );
    // la montgolfière : enveloppe rayée, nacelle d'osier, quatre places ; elle monte… et vers la droite
    const B = BALLOON, gy = H(B.x, B.z);
    MF.cyl(2.6, 2.6, 0.08, "#f3e3c2", { x: B.x, y: gy + 0.04, z: B.z, parent: fields, seg: 20 });
    board(fields, "UP AND TO THE RIGHT · BALLOON RIDES", B.x - 3.6, B.z + 3.4, 0.9, { w: 4.2, bg: MF.PAL.orange, color: "#ffffff", border: "#ffffff", top: 2.5 });
    const balloon = MF.group({ name: "Montgolfiere", parent: fields });
    balloon.userData.live = true;
    const shell = MF.group({ parent: balloon });
    MF.sphere(4.4, MF.PAL.red, { y: 8.6, parent: shell, seg: 18, cast: true }).scale.set(1, 1.12, 1);
    for (const [y, r, c] of [[10.6, 3.75, MF.PAL.yellow], [8.6, 4.42, "#ffffff"], [6.6, 3.75, MF.PAL.yellow]]) MF.torus(r, 0.36, c, { y, rx: Math.PI / 2, parent: shell, seg: 24, tubeSeg: 6 });
    MF.cone(1.9, 2.2, MF.PAL.red, { y: 3.9, rx: Math.PI, parent: shell, seg: 14 });
    MF.box(1.9, 0.9, 1.9, "#b98350", { y: 0.75, parent: shell, cast: true });
    MF.box(2.0, 0.1, 2.0, "#8a5a33", { y: 1.22, parent: shell });
    for (const [sx, sz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) MF.cyl(0.02, 0.02, 2.2, "#5d4630", { x: sx * 0.9, y: 2.3, z: sz * 0.9, rz: sx * 0.12, rx: -sz * 0.12, parent: shell, seg: 4 });
    MF.freeze(shell);
    const seats = [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]].map(([dx, dz], i) => ({ id: "balloon-" + i, dx, dz, x: B.x + dx, y: gy + 0.3, z: B.z + dz, heading: Math.PI / 2, moving: true, ride: "balloon", laptop: false, sit: 0.55, back: 3.2, up: 2.6, look: { x: 0, y: 0, z: 0 }, exit: { x: B.x - 3.2, z: B.z } }));
    let lift = 0, back = 0; // hauteur du vol (0…1) ; secondes avant le retour au sol
    places.add({
      id: "balloon",
      x: B.x - 2.6,
      z: B.z,
      r: 3,
      icon: "🎈",
      // en vol : l'invite dit dans combien de temps la nacelle revient (par pas de 5 s)
      get title() {
        return lift < 0.04 ? "Up and to the Right" : "Up and to the Right · back in " + Math.ceil(back / 5) * 5 + " s";
      },
      get verb() {
        return lift < 0.04 ? "Board the balloon" : "Wait for the balloon";
      },
      when: () => seats.some((s) => !taken(s)),
      run() {
        const s = lift < 0.04 && seats.find((q) => !taken(q));
        if (s && MF.app) MF.app.sit(s);
        else MF.sfx.play("bip");
      },
    });
    function pose(time) {
      // au sol (on embarque), montée, palier, descente : la même heure pour tous (celle de l'horloge)
      const p = (time % B.period) / B.period;
      lift = p < 0.25 ? 0 : p < 0.55 ? MF.smooth(0.25, 0.55, p) : p < 0.68 ? 1 : p < 0.97 ? 1 - MF.smooth(0.68, 0.97, p) : 0;
      back = p >= 0.25 && p < 0.97 ? (0.97 - p) * B.period : 0;
      const x = B.x + lift * B.drift, y = gy + 0.1 + lift * B.rise, z = B.z + Math.sin(time * 0.3) * 0.4 * lift;
      balloon.position.set(x, y, z);
      balloon.rotation.y = Math.sin(time * 0.12) * 0.3 * lift;
      for (const s of seats) {
        s.x = x + s.dx;
        s.y = y + 0.3;
        s.z = z + s.dz;
        s.look.x = x + 60;
        s.look.y = y - 14 * lift;
        s.look.z = z + 30;
      }
    }
    const clock = () => Date.now() / 1000;
    pose(clock());
    // Un autre joueur dans la nacelle est dessiné à sa place telle qu'on la voit d'ici (comme pour les
    // manèges) ; dans un hamac ou à la table, il prend la pose de la place.
    const before = presence.snap;
    presence.snap = (r) => {
      let best = null, bd = 3.5;
      for (const s of seats) {
        const d = Math.hypot(r.tx - s.x, r.ty - s.y, r.tz - s.z);
        if (d < bd) ((best = s), (bd = d));
      }
      if (!best) best = fixed.find((s) => Math.hypot(r.tx - s.x, r.tz - s.z) < 0.34) || null;
      return best || (before ? before(r) : null);
    };

    MF.fest.fixed = fixed;
    return {
      balloon: B,
      seats,
      fixed,
      update(dt, time) {
        let dirty = false;
        if (cool > 0) cool -= dt;
        if (pressed > 0) {
          pressed -= dt;
          knob.position.y = pressed > 0 ? 0.97 : 1.02;
          dirty = true;
        }
        if (show.update(dt)) dirty = true;
        if (camp.visible) {
          tongues.forEach((m, i) => m.scale.set(1, 0.75 + Math.abs(Math.sin(time * (7 + i * 2.3) + i)) * 0.6, 1));
          dirty = true;
        }
        const seat = riding();
        if (fields.visible || (seat && seat.ride === "balloon")) {
          pose(clock());
          dirty = true;
        }
        return dirty;
      },
    };
  }

  MF.fest = { build, BALLOON, BUTTON, fixed: null };
})();
