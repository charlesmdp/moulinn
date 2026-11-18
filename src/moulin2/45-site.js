// La Fête du Moulin — le champ de foire : plan d'ensemble et décor commun.
//
// Rien ici ne touche à la maison ni au terrain : ce sont des objets de fête posés par-dessus
// (baraques, planchers sur pilotis, guirlandes), comme une vraie fête foraine installée chez soi.
//
// Le plan (x vers l'est, z vers le sud, le moulin est en 0, 0) :
//   Entrée (0, −84)           portail, arche, guichet, poteau indicateur
//   L'Allée des stands        le long de l'allée du moulin, côté est : sept baraques de jeux
//   La Colline (plateau NO)   grand escalier depuis l'entrée ; grande roue, circuit RC, piste des drones
//   Le Pré (prairie est)      manèges et grands jeux : carrousel, tamponneuses, tir, canards, mini-golf
//   Le Ponton des fondateurs  rive est du grand étang : gradins et poufs pour travailler face à l'eau
//
//   MF.site.kiosk(def, world)            panneau du stand d'un jeu (au point def.station)
//   MF.site.hall(def, world, scores, g)  tableau « TOP 10 — écrit ici pour toujours » d'un jeu
//   MF.site.spot(station, i)             où se tient le i-ème joueur du jeu
//   MF.site.build({ world, root, places, presence, hud }) → { update(dt, t, camera) }
(function () {
  "use strict";
  const MF = (globalThis.MoulinFete = globalThis.MoulinFete || {});
  const T = () => globalThis.THREE;

  /** Place du i-ème joueur : en ligne, de part et d'autre du panneau, tournés vers le jeu. */
  function spot(station, i) {
    const h = station.heading || 0;
    const side = (i % 2 ? 1 : -1) * (0.55 + Math.floor(i / 2) * 0.8);
    // en travers du regard (cap h, 0 = vers +z) : un coup à gauche, un coup à droite
    return { x: station.x + Math.cos(h) * side, z: station.z - Math.sin(h) * side, heading: h };
  }
  /** Où planter quelque chose à côté du poste du joueur : `side` mètres à sa gauche (négatif : à droite). */
  const beside = (s, side, back = 0.5) => {
    const h = s.heading || 0;
    return { x: s.x - Math.sin(h) * back + Math.cos(h) * side, z: s.z - Math.cos(h) * back - Math.sin(h) * side, heading: h };
  };

  /** Panneau d'un stand : mât rayé, pancarte (nom du jeu), ballons, rond de couleur au sol. */
  function kiosk(def, world) {
    const s = def.station;
    const y = world.heightAt(s.x, s.z);
    const h = s.heading || 0;
    // le mât est sur le côté du joueur (qui regarde vers le jeu), pour ne pas boucher la vue ;
    // un jeu peut imposer sa place : def.kiosk = { x, z, heading }
    const k = def.kiosk || beside(s, 3.2);
    const bx = k.x, bz = k.z;
    const g = MF.group({ name: "Stand_" + def.id, x: bx, y: world.heightAt(bx, bz), z: bz, ry: k.heading ?? h });
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
    const THREE = T();
    const local = new THREE.Vector3(s.x - bx, 0, s.z - bz).applyAxisAngle(new THREE.Vector3(0, 1, 0), -(k.heading ?? h));
    MF.mesh(new THREE.RingGeometry(0.95, 1.2, 28), MF.mat(color, { opacity: 0.85 }), { x: local.x, y: y - g.position.y + 0.13, z: local.z, rx: -Math.PI / 2, parent: g });
    return g;
  }

  /**
   * Tableau du top 10 d'un jeu, planté à côté du stand : « TOP 10 — WRITTEN HERE FOREVER ».
   * Il se redessine quand un record tombe. def.hall = { x, z, heading } impose sa place.
   */
  function hall(def, world, scores, parent) {
    const s = def.station;
    const k = def.hall || beside(s, -3.2);
    const W = 360, H = 500;
    let variant = 0;
    const variants = () => {
      const keys = [...scores.boards.keys()].filter((key) => key.startsWith(def.id + "|") && scores.boards.get(key).length);
      const base = scores.table(def).key;
      return keys.length ? keys.sort((a, b) => (a === base ? -1 : b === base ? 1 : a < b ? -1 : 1)) : [base];
    };
    const draw = (ctx) => {
      const keys = variants(), key = keys[variant % keys.length];
      const rows = scores.boards.get(key) || [];
      const label = key.split("|")[1];
      ctx.fillStyle = "#2b1a10";
      MF.roundRect(ctx, 0, 0, W, H, 22);
      ctx.fill();
      ctx.fillStyle = "#fff3d6";
      MF.roundRect(ctx, 8, 8, W - 16, H - 16, 16);
      ctx.fill();
      ctx.fillStyle = def.color || MF.PAL.red;
      MF.roundRect(ctx, 8, 8, W - 16, 86, 16);
      ctx.fill();
      MF.fitText(ctx, "TOP 10", W / 2, 40, W - 60, 46, { color: "#ffffff", stroke: "#2b1a10", strokeWidth: 6 });
      MF.fitText(ctx, (def.title + (label ? " · " + label : "")).toUpperCase(), W / 2, 76, W - 40, 20, { color: "#fff3d6", font: "system-ui, sans-serif", weight: "800" });
      ctx.textBaseline = "middle";
      for (let i = 0; i < 10; i++) {
        const y = 118 + i * 33, r = rows[i];
        if (i % 2 === 0) {
          ctx.fillStyle = "rgba(43,26,16,0.07)";
          ctx.fillRect(16, y - 15, W - 32, 31);
        }
        ctx.textAlign = "left";
        ctx.font = `400 23px ${MF.FONT}`;
        ctx.fillStyle = i < 3 ? "#e8402c" : "#8a6a45";
        ctx.fillText(String(i + 1), 26, y + 1);
        if (!r) continue;
        ctx.fillStyle = r.c;
        ctx.beginPath();
        ctx.arc(66, y, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#2b1a10";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = "#2b1a10";
        ctx.font = "700 20px system-ui, sans-serif";
        const text = def.board.format ? def.board.format(r.s) : String(r.s);
        ctx.textAlign = "right";
        ctx.fillText(text, W - 24, y + 1);
        const room = W - 24 - ctx.measureText(text).width - 96;
        let name = r.n;
        ctx.textAlign = "left";
        while (name.length > 3 && ctx.measureText(name).width > room) name = name.slice(0, -2) + "…";
        ctx.fillText(name, 84, y + 1);
      }
      if (!rows.length) MF.fitText(ctx, "Nobody yet.\nBe the first name\non the wall!", W / 2, 250, W - 80, 110, { color: "#8a6a45" });
      ctx.fillStyle = "#2b1a10";
      MF.roundRect(ctx, 8, H - 50, W - 16, 42, 16);
      ctx.fill();
      MF.fitText(ctx, "WRITTEN HERE FOREVER", W / 2, H - 28, W - 50, 24, { color: "#ffcf3a" });
    };
    const tex = MF.canvasTexture(W, H, draw);
    MF.whenFont(() => tex.redraw());
    const mat = new (T().MeshBasicMaterial)({ map: tex });
    const g = MF.group({ name: "Top10_" + def.id, x: k.x, y: world.heightAt(k.x, k.z), z: k.z, ry: (k.heading || 0) + Math.PI, parent });
    const bw = 1.5, bh = (bw * H) / W;
    const face = MF.group({ parent: g });
    face.userData.live = true; // la texture change : laissé hors de la fusion du décor
    MF.plane(bw, bh, mat, { y: 0.75 + bh / 2, z: 0.05, receive: false, parent: face });
    MF.plane(bw, bh, mat, { y: 0.75 + bh / 2, z: -0.05, ry: Math.PI, receive: false, parent: face });
    const frame = MF.group({ parent: g });
    MF.box(bw + 0.14, bh + 0.14, 0.08, MF.PAL.woodDark, { y: 0.75 + bh / 2, parent: frame, cast: true });
    for (const side of [-1, 1]) MF.box(0.1, 0.75 + bh + 0.25, 0.1, MF.PAL.wood, { x: side * (bw / 2 + 0.12), y: (0.75 + bh + 0.25) / 2, parent: frame, cast: true });
    for (const side of [-1, 1]) MF.box(bw * 0.62, 0.06, 0.34, def.color || MF.PAL.red, { x: side * bw * 0.27, y: 0.75 + bh + 0.3, rz: side * -0.32, parent: frame, cast: true });
    const cup = MF.props.trophy(1.5);
    cup.position.y = 0.75 + bh + 0.42;
    frame.add(cup);
    MF.freeze(frame);
    const refresh = () => tex.redraw();
    scores.onChange((key) => key.startsWith(def.id + "|") && refresh());
    // plusieurs réglages classés (3 tours, 5 tours…) : le tableau les montre tour à tour
    setInterval(() => {
      if (variants().length > 1 && g.visible && (!g.parent || g.parent.visible)) {
        variant++;
        refresh();
      }
    }, 9000);
    return { group: g, refresh };
  }

  /* ------------------------------------------------------------------ le décor, zone par zone */
  function build(ctx) {
    const { world, root } = ctx;
    const H = (x, z) => world.heightAt(x, z);
    const Pp = MF.props;
    const zones = [];
    /** Groupe de décor d'une zone, caché quand la caméra en est loin (centre et rayon en mètres). */
    const zone = (name, x, z, r) => {
      const g = MF.group({ name: "Zone_" + name, parent: root });
      zones.push({ g, x, z, r });
      return g;
    };
    const put = (g, object, x, z, heading = 0, y) => {
      object.position.set(x, y === undefined ? H(x, z) : y, z);
      object.rotation.y = heading;
      g.add(object);
      return object;
    };
    const live = []; // { update(dt, t) } : manèges, lieux animés

    /* ---- Entrée : arche, guichet, poteau indicateur, grand escalier vers la colline */
    const gate = zone("Entree", 0, -80, 95);
    {
      const A = MF.site.entrance;
      const ax = (A.left[0] + A.right[0]) / 2, az = (A.left[1] + A.right[1]) / 2;
      const span = Math.hypot(A.right[0] - A.left[0], A.right[1] - A.left[1]);
      const angle = Math.atan2(A.right[0] - A.left[0], A.right[1] - A.left[1]) - Math.PI / 2;
      const arch = MF.group({ name: "Arche_entree", x: ax, y: Math.min(H(...A.left), H(...A.right)), z: az, ry: angle, parent: gate });
      for (const side of [-1, 1]) {
        const p = MF.pole(4.6);
        p.position.x = (side * span) / 2;
        arch.add(p);
      }
      const title = MF.sign("THE MILL FAIR", { w: span - 0.3, h: 0.95, bg: MF.PAL.red, color: "#ffffff", border: MF.PAL.yellow, double: true });
      title.position.y = 4.05;
      arch.add(title);
      const sp = MF.sponsors.board("village-arche", span - 0.9, 0.62, { y: 3.2, z: 0.02, kicker: "Entrance arch" });
      arch.add(sp);
      const spBack = MF.sponsors.board("village-arche", span - 0.9, 0.62, { y: 3.2, z: -0.02, ry: Math.PI, kicker: "Entrance arch" });
      spBack.material = sp.material;
      arch.add(spBack);
      [MF.PAL.yellow, MF.PAL.blue, MF.PAL.green, MF.PAL.pink].forEach((c, i) => {
        const b = MF.balloon(c, 0.24);
        b.position.set((i < 2 ? -1 : 1) * (span / 2) + (i % 2 ? 0.22 : -0.18), 4.6 + (i % 2) * 0.2, 0);
        arch.add(b);
      });
      // guichet (décor) et grand panneau du sponsor principal
      const booth = Pp.stall({ w: 2.4, d: 1.8, h: 2.3, colors: [MF.PAL.blue, MF.PAL.white], title: "TICKETS · FREE" });
      put(gate, booth, 7.4, -84.6, -2.2);
      const B = MF.site.board;
      const panel = MF.group({ name: "Panneau_des_jeux", x: B.x, y: H(B.x, B.z), z: B.z, ry: B.heading, parent: gate });
      for (const side of [-1, 1]) MF.cyl(0.06, 0.07, 2.9, MF.PAL.woodDark, { x: side * 1.55, y: 1.45, parent: panel, cast: true, seg: 8 });
      const head = MF.sign("15 GAMES · FERRIS WHEEL · WORK DECK", { w: 3.0, h: 0.5, bg: MF.PAL.blue, color: "#ffffff", border: "#ffffff" });
      head.position.set(0, 2.6, 0.03);
      panel.add(head);
      panel.add(MF.sponsors.board("village-panneau", 3.0, 1.25, { y: 1.62, z: 0.03, kicker: "Main board" }));
      MF.box(3.1, 1.85, 0.05, MF.PAL.wood, { y: 1.9, z: -0.01, parent: panel, cast: true });
      put(
        gate,
        Pp.signpost([
          { text: "THE MIDWAY · 7 GAME BOOTHS", color: MF.PAL.red, dir: 0 },
          { text: "HILLTOP · FERRIS WHEEL · RACEWAY", color: MF.PAL.blue, dir: -Math.PI / 2 },
          { text: "THE GREEN · RIDES", color: MF.PAL.green, dir: 0.7 },
          { text: "FOUNDERS' DECK · SIT & WORK", color: MF.PAL.purple, dir: 0.15 },
        ]),
        4.9,
        -75.2,
      );
      for (const [x, z, c] of [[-2.6, -86.6, MF.PAL.red], [5.6, -86.8, MF.PAL.yellow], [-3.0, -74.2, MF.PAL.blue]]) put(gate, Pp.flag(c, 4.6), x, z);
      // grand escalier de bois vers le plateau de la colline
      const S = MF.site.stairway;
      MF.decks.stairs(world, gate, { from: [S.x0, S.z, H(S.x0, S.z) + 0.05], to: [S.x1, S.z, H(S.x1, S.z) + 0.05], width: 3, name: "colline" });
      const top = MF.sign("HILLTOP ↑ FERRIS WHEEL · RC RACEWAY · DRONES", { w: 3.4, h: 0.5, bg: MF.PAL.blue, color: "#ffffff", border: MF.PAL.yellow, double: true });
      top.position.set(S.x0 + 0.2, H(S.x0, S.z) + 3.3, S.z);
      top.rotation.y = Math.PI / 2;
      gate.add(top);
      for (const dz of [-1.6, 1.6]) put(gate, MF.pole(3.6), S.x0 + 0.2, S.z + dz);
    }

    /* ---- L'Allée des stands : guirlandes d'ampoules en zigzag, charrettes, bottes de paille */
    const midway = zone("Allee_des_stands", 4, -58, 90);
    {
      const M = MF.site.midway;
      let prev = null, i = 0;
      for (let z = M.z0; z <= M.z1 + 0.1; z += M.step, i++) {
        const x = i % 2 ? M.east : M.west;
        put(midway, MF.pole(3.7), x, z);
        const p = { x, y: H(x, z) + 3.6, z };
        if (prev) midway.add(Pp.lights(prev, p, { sag: 0.55 }));
        prev = p;
      }
      put(midway, Pp.cart("popcorn"), 5.2, -50.6, Math.PI / 2);
      put(midway, Pp.cart("candy"), 5.3, -79.4, Math.PI / 2);
      for (const [x, z, h] of [[7.6, -70.2, 0.3], [7.4, -59.3, -0.2], [7.8, -64.7, 1.2]]) put(midway, Pp.bale(), x, z, h);
      for (const [x, z] of [[7.3, -75.6], [7.5, -53.9]]) put(midway, Pp.barrel(), x, z);
      put(midway, Pp.bin(), 3.6, -69);
      // la terrasse basse : escalier depuis l'allée, tables, limonade
      const L = MF.site.terrace;
      MF.decks.stairs(world, midway, { from: [L.stair[0], L.stair[2], H(L.stair[0], L.stair[2]) + 0.03], to: [L.stair[1], L.stair[2], H(L.stair[1], L.stair[2]) + 0.03], width: 2.4, name: "terrasse", rails: false });
      put(midway, Pp.picnic(), 8.3, -30.4, 0.4);
      put(midway, Pp.picnic(), 8.0, -46.6, -0.2);
      put(midway, Pp.cart("lemonade"), 7.4, -34.6, 1.9);
      put(
        midway,
        Pp.signpost([
          { text: "MORE BOOTHS", color: MF.PAL.red, dir: 1.4 },
          { text: "THE GREEN · RIDES", color: MF.PAL.green, dir: 1.1 },
          { text: "FOUNDERS' DECK", color: MF.PAL.purple, dir: 0.2 },
        ]),
        3.4,
        -41.5,
      );
    }

    /* ---- La Colline : palier, belvédère, bancs ; la grande roue est un manège (plus bas) */
    const hill = zone("Colline", -55, -68, 140);
    {
      const S = MF.site.stairway;
      const y = H(S.x1, S.z) + 0.05;
      MF.decks.rect(world, hill, { x: S.x1 - 2.2, z: S.z, w: 5, l: 4.4, heading: Math.PI / 2, y, rails: "", name: "palier", posts: true });
      put(
        hill,
        Pp.signpost([
          { text: "FERRIS WHEEL", color: MF.PAL.pink, dir: -1.25 },
          { text: "RC RACEWAY", color: MF.PAL.red, dir: -1.75 },
          { text: "DRONE AIRFIELD", color: MF.PAL.teal, dir: -2.6 },
          { text: "BACK TO THE MIDWAY", color: MF.PAL.blue, dir: Math.PI / 2 },
        ]),
        S.x1 - 5.6,
        S.z + 3.4,
      );
      // belvédère : barrière au bord du plateau, bancs tournés vers la vallée, longue-vue
      for (const z of [-85.6, -75.4]) put(hill, Pp.fence(4.4), -26.9, z, Math.PI / 2);
      for (const z of [-75.5, -72.2]) put(hill, Pp.bench(), -29.6, z, Math.PI / 2);
      const scope = MF.group({ name: "Longue_vue" });
      MF.cyl(0.05, 0.08, 1.2, "#33363f", { y: 0.6, parent: scope, seg: 8, cast: true });
      MF.cyl(0.09, 0.07, 0.5, MF.PAL.blue, { y: 1.3, rz: Math.PI / 2 - 0.2, parent: scope, seg: 10 });
      put(hill, scope, -28.4, -77.6, 0);
      for (const [x, z, c] of [[-27.8, -86.4, MF.PAL.red], [-56, -86.5, MF.PAL.yellow], [-27.9, -71.5, MF.PAL.green]]) put(hill, Pp.flag(c, 5), x, z);
      for (const [x, z] of [[-45, -80], [-58, -58], [-72, -78]]) put(hill, Pp.lamp(3.6), x, z);
    }

    /* ---- Le Pré : lampadaires et guirlandes, coin repas ; le carrousel est un manège (plus bas) */
    const green = zone("Pre", 80, -6, 110);
    {
      const posts = [[44.5, -13.6], [57, -12.6], [69, -13.2], [75.2, 1.6], [86, 2.4], [97.6, 2.2], [97.8, -12.4], [110, 2.6], [119.6, -4]];
      let prev = null;
      posts.forEach(([x, z], i) => {
        put(green, Pp.lamp(3.5), x, z);
        const p = { x, y: H(x, z) + 3.5, z };
        if (prev && Math.hypot(p.x - prev.x, p.z - prev.z) < 16 && i !== 3 && i !== 6) green.add(Pp.lights(prev, p, { sag: 0.7 }));
        prev = p;
      });
      put(green, Pp.picnic(), 43.6, -9.6, 0.2);
      put(green, Pp.picnic(), 43.8, -5.2, -0.3);
      put(green, Pp.cart("hotdog"), 44.2, -1.2, 2.2);
      put(green, Pp.bin(), 46.4, -11.8);
      put(
        green,
        Pp.signpost([
          { text: "BUMPER CARS · MINI-GOLF", color: MF.PAL.red, dir: Math.PI / 2 },
          { text: "THE MIDWAY", color: MF.PAL.blue, dir: -1.3 },
          { text: "FOUNDERS' DECK", color: MF.PAL.purple, dir: -0.5 },
        ]),
        42.2,
        -12.4,
      );
    }

    // manèges et espace de travail : chacun dans son fichier, avec ses lieux (« Ride », « Sit »)
    if (MF.rides) live.push(MF.rides.build(Object.assign({ zone, put }, ctx)));
    if (MF.lounge) live.push(MF.lounge.build(Object.assign({ zone, put }, ctx)));

    for (const z of zones) {
      try {
        MF.freeze(z.g);
      } catch (error) {
        console.error("[Fête du Moulin] décor (fusion)", error);
      }
    }
    let timer = 0;
    return {
      zones,
      update(dt, t, camera) {
        timer -= dt;
        if (timer <= 0) {
          timer = 0.5;
          for (const z of zones) {
            const near = Math.hypot(camera.position.x - z.x, camera.position.z - z.z) < z.r;
            if (z.g.visible !== near) {
              z.g.visible = near;
              world.invalidate();
            }
          }
        }
        let dirty = false;
        for (const l of live) if (l && l.update && l.update(dt, t, camera)) dirty = true;
        return dirty;
      },
    };
  }

  MF.site = {
    spot,
    beside,
    kiosk,
    hall,
    build,
    // Repères du terrain (x vers l'est, z vers le sud ; le moulin est en 0, 0). Ajustés sur la vraie page.
    entrance: { left: [-1.9, -77.5], right: [4.5, -77.5] },
    board: { x: 7.6, z: -80.4, heading: -2.0 },
    /** Grand escalier : du pied (x0) au plateau (x1), le long de z. */
    stairway: { x0: -3.4, x1: -26.2, z: -80.6 },
    /** Allée des stands : mâts des guirlandes, de part et d'autre de l'allée. */
    midway: { z0: -75, z1: -51, step: 6, west: -3.0, east: 4.9 },
    /** Terrasse basse (x 6…16, z −45…−28) : petit escalier depuis l'allée [x haut, x bas, z]. */
    terrace: { stair: [3.7, 6.5, -39.4] },
  };
})();
