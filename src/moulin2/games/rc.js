// La Fête du Moulin — course de voitures radiocommandées.
//
// 1 à 8 pilotes, 3 ou 5 tours. Le circuit (environ 225 m) est tracé sur le plateau de la colline, à
// côté de la grande roue : ligne droite des stands, ligne droite nord, épingle vers l'intérieur,
// tribune, chicane, puis tremplin sur la ligne droite sud. Deux bandes d'accélération donnent un
// coup de fouet ; des gaz enfoncés pile au « Go! » aussi (feux de départ sur l'arche).
// Chacun pilote sa voiture sur son écran et envoie sa position aux autres une douzaine de fois par
// seconde ; les voitures des autres sont redessinées en douceur (MF.remotes). Le premier qui boucle ses
// tours gagne ; les autres ont 30 secondes pour finir.
//
// Ce fichier sert de modèle aux autres jeux : décor construit une fois (create), partie pilotée par la
// phase de la session (onPhase), une boucle (update) qui tourne aussi pour les spectateurs.
(function () {
  "use strict";
  const MF = globalThis.MoulinFete;

  // Tracé (x, z), dans le sens de la course ; le premier point est la ligne de départ, sur l'allée.
  const TRACK = [
    [-74, -44], [-74, -58], [-75, -69], [-79, -77], [-88, -80.5], [-98, -80], [-108, -80.5], [-117, -77], [-121, -69], [-119, -61],
    [-112, -57], [-105, -58.5], [-98, -63], [-91, -62], [-88, -55], [-92, -48.5], [-99, -46.5], [-107, -47.5], [-114, -44], [-117, -37.5],
    [-111, -32.5], [-100, -32], [-89, -33], [-80, -34.5], [-75, -38.5],
  ];
  const WIDTH = 3.8; // largeur de la piste (m)
  // tremplin (sur la ligne droite sud) et bandes d'accélération : repérés par un point proche du tracé
  const JUMP = { near: [-102, -32], len: 3.4, height: 0.62 };
  const PADS = [[-97, -80], [-102, -46.8]];
  // bâches (côté extérieur) et piles de pneus (intérieur des virages serrés) : point proche, côté
  const BANNERS = [["rc-bache-1", -74, -62, 1, 3.6], ["rc-bache-2", -93, -80.3, 1, 3.6], ["rc-bache-3", -121, -68, 1, 3.6], ["rc-bache-4", -90, -33, 1, 3.0]];
  const TYRES = [[-79, -77, -1], [-117, -77, -1], [-118, -60, -1], [-89, -58, 1], [-117, -38, -1]]; // pas au dernier virage : la caméra de la grille y passe
  const CAR_R = 0.36; // rayon d'encombrement d'une voiture (m)
  const GRACE = 30; // secondes laissées aux autres après l'arrivée du premier
  const C = { vmax: 14.5, vgrass: 7.5, vrev: 4, acc: 11.5, brake: 19, drag: 0.27, turn: 3.0, grip: 7.5, gripGrass: 4.5, gripDrift: 1.6, g: 15 };

  /** Petite voiture tout-terrain à la couleur du pilote. Origine au sol, avant vers +z. */
  function buildCar(color, name) {
    const g = MF.group({ name: "Voiture_RC" });
    const body = MF.group({ parent: g });
    const paint = MF.mat(color, { unique: true });
    MF.box(0.3, 0.09, 0.56, paint, { y: 0.15, parent: body, cast: true });
    MF.box(0.24, 0.085, 0.24, MF.PAL.black, { y: 0.235, z: -0.03, parent: body });
    MF.box(0.2, 0.05, 0.16, paint, { y: 0.19, z: 0.24, parent: body });
    // aileron arrière et antenne avec son fanion
    MF.box(0.34, 0.02, 0.1, MF.PAL.black, { y: 0.31, z: -0.27, parent: body });
    for (const side of [-1, 1]) MF.box(0.02, 0.1, 0.06, MF.PAL.black, { x: side * 0.13, y: 0.255, z: -0.27, parent: body });
    MF.cyl(0.006, 0.006, 0.42, MF.PAL.steel, { x: 0.09, y: 0.44, z: -0.16, parent: body, seg: 5 });
    MF.box(0.1, 0.06, 0.004, paint, { x: 0.14, y: 0.62, z: -0.16, parent: body });
    MF.freeze(body); // la caisse d'un seul bloc ; les roues restent mobiles
    const wheels = [];
    for (const [x, z, front] of [[-0.19, 0.19, 1], [0.19, 0.19, 1], [-0.19, -0.19, 0], [0.19, -0.19, 0]]) {
      const pivot = MF.group({ x, y: 0.085, z, parent: g });
      const w = MF.cyl(0.085, 0.085, 0.085, MF.PAL.black, { rz: Math.PI / 2, parent: pivot, seg: 10 });
      MF.cyl(0.045, 0.045, 0.09, MF.PAL.yellow, { rz: Math.PI / 2, parent: pivot, seg: 8 });
      wheels.push({ pivot, w, front });
    }
    const shadow = MF.blob(0.42, 0.4);
    shadow.position.y = 0.02;
    g.add(shadow);
    // flamme du coup de fouet (cachée tant qu'on ne dépasse pas la vitesse normale)
    const flame = MF.cone(0.07, 0.34, MF.mat("#ffb02e", { emissive: "#ff7a1a", emissiveIntensity: 1 }), { y: 0.16, z: -0.44, rx: -Math.PI / 2, parent: g, seg: 7 });
    flame.visible = false;
    let tag = null;
    if (name) {
      tag = MF.tag(name, { scale: 0.42 });
      tag.position.y = 0.95;
      g.add(tag);
    }
    return { group: g, body, wheels, paint, tag, shadow, flame, spin: 0 };
  }

  MF.registerGame({
    id: "rc",
    title: "RC Car Race",
    icon: "🏎️",
    color: MF.PAL.red,
    blurb: "Ship Fast Raceway on the hilltop · jump, boost pads · 3 or 5 laps",
    station: { x: -69.6, z: -45.6, heading: -Math.PI / 2 },
    kiosk: { x: -68.8, z: -42.4, heading: -Math.PI / 2 },
    hall: { x: -68.8, z: -48.9, heading: -Math.PI / 2 },
    range: 140,
    minPlayers: 1,
    maxPlayers: 8,
    maxTime: 300,
    options: [{ key: "laps", label: "Laps", values: [3, 5], default: 3, format: (v) => v + " laps" }],
    help: "Arrows or WASD: accelerate, brake, steer · Space: handbrake (drift) · C: back on track. Hit the throttle right on “Go!” for a rocket start; the chevron pads give a boost.",
    // Arrivés d'abord (au temps), puis les autres selon la distance parcourue.
    rank: (list) => list.slice().sort((a, b) => (a.time ? 0 : 1) - (b.time ? 0 : 1) || (a.time || 0) - (b.time || 0) || (b.dist || 0) - (a.dist || 0)),
    describe: (r) => (r.time ? MF.time(r.time) : "did not finish"),
    board: { label: "Best race time", better: "low", value: (r) => r.time, variant: (o) => (o.laps || 3) + " laps", format: (v) => MF.time(v) },

    create(ctx) {
      const { world, session, hud, input, group, camera } = ctx;
      const path = MF.path(TRACK, { closed: true, step: 1 });
      const L = path.length;
      // Les voitures roulent 9 cm au-dessus du relief calculé : c'est la hauteur de la piste, posée assez
      // haut pour ne pas disparaître sous les bosses du sol réel (et l'herbe a cette épaisseur).
      const RIDE = 0.09;
      // Le tremplin : une rampe de bois en travers de la piste, qui monte puis s'arrête net.
      const near = (x, z) => path.nearest(x, z).s;
      const jump0 = near(JUMP.near[0], JUMP.near[1]);
      const foot = path.at(jump0); // pied de la rampe (la piste y est droite : un repère local suffit)
      const ramp = (x, z) => {
        const dx = x - foot.x, dz = z - foot.z;
        const u = dx * foot.tx + dz * foot.tz;
        if (u <= 0 || u >= JUMP.len) return 0;
        return Math.abs(dx * foot.tz - dz * foot.tx) < WIDTH / 2 ? (JUMP.height * u) / JUMP.len : 0;
      };
      const H = (x, z) => world.heightAt(x, z) + RIDE + ramp(x, z);
      const track = { heightAt: H }; // « monde » de la piste : le sol plus la rampe (pour incliner les voitures)
      const obstacles = MF.obstacles(world, [-132, -90, -62, -24]);
      const pads = PADS.map(([x, z]) => path.at(near(x, z)));

      /* ---------------------------------------------------------------- décor (une fois) */
      const deco = MF.group({ name: "Circuit_RC", parent: group });
      deco.add(MF.ribbon(world, path, { width: WIDTH, color: "#d9b77a", edgeColor: "#ffffff", edge: 0.2, stripes: true, lift: RIDE + 0.02, name: "Piste_RC" }));
      // ligne d'arrivée en damier et arche de départ
      const start = path.at(0);
      const startHeading = Math.atan2(start.tx, start.tz);
      const line = MF.plane(WIDTH, 0.7, new world.THREE.MeshBasicMaterial({ map: MF.canvasTexture(256, 64, (c, W, Hh) => {
        for (let i = 0; i < 16; i++) for (let j = 0; j < 4; j++) {
          c.fillStyle = (i + j) % 2 ? "#ffffff" : "#1d1d22";
          c.fillRect((i * W) / 16, (j * Hh) / 4, W / 16 + 1, Hh / 4 + 1);
        }
      }), polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 }), { rx: -Math.PI / 2 });
      const lineHolder = MF.group({ parent: deco });
      lineHolder.add(line);
      MF.seat(lineHolder, world, start.x, start.z, startHeading, RIDE + 0.05);
      const arch = MF.group({ name: "Arche_depart_RC", x: start.x, y: world.heightAt(start.x, start.z), z: start.z, ry: startHeading, parent: deco });
      for (const side of [-1, 1]) {
        const p = MF.pole(3.0, { color: MF.PAL.red });
        p.position.x = side * (WIDTH / 2 + 0.55);
        arch.add(p);
        obstacles.add(start.x - start.tz * side * (WIDTH / 2 + 0.55), start.z + start.tx * side * (WIDTH / 2 + 0.55), 0.12);
      }
      const title = MF.sign("START", { w: 1.5, h: 0.42, bg: MF.PAL.yellow, color: MF.PAL.ink, double: true });
      title.position.y = 3.08;
      arch.add(title);
      for (const face of [0, Math.PI]) arch.add(MF.sponsors.board("rc-arche", WIDTH + 0.9, 0.66, { y: 2.5, z: face ? -0.02 : 0.02, ry: face, kicker: "Start arch" }));
      // bâches de sponsors, à l'extérieur des virages et le long de la ligne droite
      const banner = (id, s, side, w = 3.6) => {
        const p = path.at(s);
        // assez loin du bord pour que la caméra de poursuite ne passe pas au travers
        const off = side * (WIDTH / 2 + 2.3);
        const x = p.x - p.tz * off, z = p.z + p.tx * off;
        const b = MF.sponsors.banner(id, w, 0.9, { lift: 0.25 });
        // la face de la bâche regarde la piste
        b.position.set(x, world.heightAt(x, z), z);
        b.rotation.y = Math.atan2(p.x - x, p.z - z);
        deco.add(b);
        for (const e of [-1, 1]) obstacles.add(x + Math.cos(b.rotation.y) * e * (w / 2), z - Math.sin(b.rotation.y) * e * (w / 2), 0.1);
      };
      for (const [id, x, z, side, w] of BANNERS) banner(id, near(x, z), side, w);
      // piles de pneus à l'intérieur des deux virages serrés
      const tyres = (s, side) => {
        const p = path.at(s), off = side * (WIDTH / 2 + 0.35);
        const x = p.x - p.tz * off, z = p.z + p.tx * off, y = world.heightAt(x, z);
        for (let i = 0; i < 3; i++) MF.torus(0.17, 0.075, i % 2 ? MF.PAL.white : MF.PAL.black, { x, y: y + 0.08 + i * 0.15, z, rx: Math.PI / 2, parent: deco, seg: 12, tubeSeg: 6 });
        obstacles.add(x, z, 0.26);
      };
      for (const [x, z, side] of TYRES) for (const d of [-1.4, 0, 1.4]) tyres(near(x, z) + d, side);
      // tremplin : rampe de bois ; bandes d'accélération : chevrons lumineux
      {
        const a = path.at(jump0 + JUMP.len / 2), h = Math.atan2(a.tx, a.tz);
        const wedge = MF.group({ name: "Tremplin", x: a.x, y: world.heightAt(a.x, a.z) + RIDE, z: a.z, ry: h, parent: deco });
        const tilt = Math.atan2(JUMP.height, JUMP.len);
        MF.box(WIDTH, 0.08, Math.hypot(JUMP.len, JUMP.height), "#b98350", { y: JUMP.height / 2 - 0.02, rx: -tilt, parent: wedge, cast: true });
        MF.box(WIDTH, JUMP.height, 0.12, "#7a5028", { y: JUMP.height / 2, z: JUMP.len / 2, parent: wedge });
        for (const side of [-1, 1]) {
          MF.box(0.1, JUMP.height * 0.5, JUMP.len * 0.5, "#7a5028", { x: side * (WIDTH / 2 - 0.05), y: JUMP.height * 0.42, z: JUMP.len * 0.25, parent: wedge });
          MF.box(0.5, 0.5, 0.06, MF.PAL.yellow, { x: side * (WIDTH / 2 + 0.5), y: 0.9, z: -JUMP.len / 2, parent: wedge });
          MF.cyl(0.03, 0.03, 0.9, MF.PAL.black, { x: side * (WIDTH / 2 + 0.5), y: 0.45, z: -JUMP.len / 2, parent: wedge, seg: 5 });
        }
      }
      for (const pad of pads) {
        const g = MF.group({ name: "Bande_acceleration", parent: deco });
        MF.seat(g, world, pad.x, pad.z, Math.atan2(pad.tx, pad.tz), RIDE + 0.04);
        const glow = MF.mat("#39e6ff", { emissive: "#39e6ff", emissiveIntensity: 0.9 });
        for (let i = 0; i < 3; i++)
          for (const side of [-1, 1]) MF.box(WIDTH * 0.42, 0.02, 0.22, glow, { x: side * WIDTH * 0.19, z: -0.8 + i * 0.8 + 0.25, ry: side * 0.55, parent: g });
      }
      // tribune, tente des stands, portique à feux
      const bleachers = MF.group({ name: "Tribune", parent: deco });
      {
        // dans l'herbe à l'intérieur du circuit, face à la ligne droite de départ
        const a = path.at(8), x = a.x - 6.4, z = a.z;
        bleachers.position.set(x, world.heightAt(x, z), z);
        bleachers.rotation.y = Math.PI / 2;
        for (let i = -3; i <= 3; i++) obstacles.add(x - 0.9, z + i * 1.25, 1.1);
        for (let i = 0; i < 4; i++) {
          MF.box(8, 0.1, 0.6, i % 2 ? MF.PAL.blue : MF.PAL.white, { y: 0.5 + i * 0.45, z: -i * 0.62, parent: bleachers, cast: true });
          MF.box(8, 0.45 + i * 0.45, 0.08, "#8a94a3", { y: (0.45 + i * 0.45) / 2, z: -i * 0.62 - 0.3, parent: bleachers });
        }
        for (const sx of [-3.9, 3.9]) {
          const f = MF.props.flag(sx < 0 ? MF.PAL.red : MF.PAL.yellow, 4.4);
          f.position.set(sx, 0, -2.4);
          bleachers.add(f);
        }
      }
      MF.freeze(deco);
      // feux de départ sur l'arche : cinq rouges qui s'allument un à un, puis tout passe au vert
      const lamps = [];
      {
        const bar = MF.group({ name: "Feux_depart", x: start.x, y: world.heightAt(start.x, start.z) + 3.5, z: start.z, ry: startHeading, parent: group });
        MF.box(1.7, 0.26, 0.1, MF.PAL.black, { parent: bar });
        for (let i = 0; i < 5; i++) {
          const m = MF.mat("#3a0f0f", { unique: true, emissive: "#ff2a2a", emissiveIntensity: 0 });
          for (const face of [-1, 1]) MF.sphere(0.085, m, { x: (i - 2) * 0.32, z: face * 0.05, parent: bar, seg: 10 });
          lamps.push(m);
        }
      }
      let lampState = -1;
      /** n feux rouges allumés (0 à 5), ou 6 : tous verts. */
      function setLamps(n) {
        if (n === lampState) return;
        lampState = n;
        lamps.forEach((m, i) => {
          const green = n === 6, on = green || i < n;
          m.color.copy(MF.color(on ? (green ? "#2bd96a" : "#ff3b3b") : "#3a0f0f"));
          m.emissive.copy(MF.color(green ? "#2bd96a" : "#ff2a2a"));
          m.emissiveIntensity = on ? 1 : 0;
        });
      }

      /* ---------------------------------------------------------------- voitures */
      let me = null; // ma voiture : { car, x, y, z, h, vx, vz, vy, air, s, dist, lap, steer, … }
      const camState = {};
      let engine = null, finished = false, graceEnd = 0, offTimer = 0, lastBoard = 0, sway = 0;

      const remotes = MF.remotes({
        session,
        size: 6, // x, y, z, cap, vitesse, braquage
        angles: [3],
        make(peer) {
          const car = buildCar(peer.color, peer.name);
          group.add(car.group);
          return car;
        },
        apply(car, v, extra) {
          car.group.position.set(v[0], v[1], v[2]);
          MF.seat(car.group, track, v[0], v[2], v[3], 0, v[1]);
          spinWheels(car, v[4], v[5], 1 / 60);
          car.dist = extra ? extra[0] : 0;
          car.done = !!(extra && extra[1]);
          car.x = v[0];
          car.z = v[2];
          car.speed = v[4];
        },
      });
      function spinWheels(car, speed, steer, dt) {
        car.spin += (speed / 0.085) * dt;
        car.flame.visible = speed > C.vmax * 1.1;
        if (car.flame.visible) car.flame.scale.set(1, 0.7 + Math.random() * 0.6, 1);
        for (const w of car.wheels) {
          w.w.rotation.x = car.spin;
          if (w.front) w.pivot.rotation.y = steer * 0.42;
        }
      }
      function gridSpot(slot) {
        const row = Math.floor(slot / 2), side = slot % 2 ? 1 : -1;
        const p = path.at(L - 1.6 - row * 1.5);
        return { x: p.x - p.tz * side * 0.75, z: p.z + p.tx * side * 0.75, h: Math.atan2(p.tx, p.tz), s: p.s };
      }
      function spawn(slot) {
        if (!me) {
          me = { car: buildCar(ctx.self.color, null) };
          group.add(me.car.group);
        }
        me.car.paint.color.copy(MF.color(ctx.self.color));
        const g = gridSpot(slot);
        Object.assign(me, { x: g.x, z: g.z, y: H(g.x, g.z), h: g.h, vx: 0, vz: 0, vy: 0, air: false, s: g.s, dist: g.s - L, steer: 0, speed: 0, lastHit: 0, boost: 0, padCool: 0, launched: false, lapStart: 0, best: 0, gas: true, gasAt: -99 });
        MF.seat(me.car.group, track, me.x, me.z, me.h, 0, me.y);
        camState.x = undefined;
        finished = false;
        graceEnd = 0;
        offTimer = 0;
      }
      function despawn() {
        if (me) {
          group.remove(me.car.group);
          MF.dispose(me.car.group);
          me = null;
        }
        if (engine) {
          engine.stop();
          engine = null;
        }
      }
      /** Replace la voiture au milieu de la piste, à l'arrêt (touche C, sortie de piste, chute à l'eau). */
      function reset() {
        const p = path.at(me.s);
        Object.assign(me, { x: p.x, z: p.z, y: H(p.x, p.z), h: Math.atan2(p.tx, p.tz), vx: 0, vz: 0, vy: 0, air: false });
        camState.x = undefined;
        MF.sfx.play("boing");
      }

      function drive(dt, locked) {
        const st = input.state;
        const throttle = locked ? 0 : st.y, steerIn = locked ? 0 : st.x, hand = !locked && st.a;
        const fx = Math.sin(me.h), fz = Math.cos(me.h);
        let vf = me.vx * fx + me.vz * fz; // vitesse vers l'avant
        let vl = me.vx * -fz + me.vz * fx; // vitesse de côté (dérapage)
        const near = path.nearest(me.x, me.z, me.s, true);
        const onTrack = Math.abs(near.d) < WIDTH / 2 + 0.2;
        me.boost = Math.max(0, me.boost - dt);
        me.padCool = Math.max(0, me.padCool - dt);
        if (!me.air && !locked && me.padCool <= 0) {
          // bande d'accélération sous les roues ?
          for (const pad of pads)
            if (Math.hypot(me.x - pad.x, me.z - pad.z) < WIDTH / 2 + 0.2) {
              me.boost = 1.3;
              me.padCool = 2;
              vf = Math.max(vf, 0) + 5.5;
              hud.flash("Boost!", { color: "#39e6ff", hold: 0.6 });
              MF.sfx.play("swing");
            }
        }
        if (!me.air) {
          const vmax = (onTrack ? C.vmax : C.vgrass) * (me.boost > 0 ? 1.3 : 1);
          if (throttle > 0.05) vf += C.acc * throttle * (1 - Math.max(0, vf) / vmax) * dt;
          else if (throttle < -0.05) vf += (vf > 0.3 ? C.brake : C.acc * 0.7) * throttle * dt;
          if (hand) vf -= Math.sign(vf) * Math.min(Math.abs(vf), C.brake * 0.55 * dt);
          vf -= vf * C.drag * dt + (onTrack ? 0 : vf * 1.4 * dt);
          vf = MF.clamp(vf, -C.vrev, C.vmax * (me.boost > 0 ? 1.42 : 1.08));
          // la pente : on prend de la vitesse en descente, on en perd en montée
          const slope = (H(me.x + fx * 0.3, me.z + fz * 0.3) - H(me.x - fx * 0.3, me.z - fz * 0.3)) / 0.6;
          vf -= slope * C.g * 0.45 * dt;
          // direction : d'autant plus vive qu'on roule, un peu moins à pleine vitesse
          me.steer = MF.damp(me.steer, steerIn, 14, dt);
          const k = MF.clamp(Math.abs(vf) / 2.2, 0, 1) * (1 - 0.32 * MF.clamp(Math.abs(vf) / C.vmax, 0, 1));
          me.h -= me.steer * C.turn * k * Math.sign(vf || 1) * dt * (hand ? 1.25 : 1);
          vl -= vl * Math.min(1, (hand ? C.gripDrift : onTrack ? C.grip : C.gripGrass) * dt);
        } else me.steer = MF.damp(me.steer, 0, 6, dt);
        const nfx = Math.sin(me.h), nfz = Math.cos(me.h);
        // en virage, la vitesse suit le nouveau cap moins vite que le nez : c'est ce qui fait déraper
        const turned = me.air ? 0 : vf * (fx * -nfz + fz * nfx);
        vl += turned;
        vf = me.air ? vf : vf * (fx * nfx + fz * nfz);
        me.vx = nfx * vf + -nfz * vl;
        me.vz = nfz * vf + nfx * vl;
        const before = H(me.x, me.z);
        me.x += me.vx * dt;
        me.z += me.vz * dt;
        // obstacles : arbres, murs, pneus, mâts, voitures des autres
        const hit = obstacles.hit(me.x, me.z, CAR_R);
        if (hit) bounce(hit.nx, hit.nz, hit.depth, 0.35);
        for (const r of remotes.map.values()) {
          const o = r.obj;
          if (o.x === undefined) continue;
          const dx = me.x - o.x, dz = me.z - o.z, d = Math.hypot(dx, dz);
          if (d < CAR_R * 2 && d > 1e-3) bounce(dx / d, dz / d, (CAR_R * 2 - d) * 0.6, 0.5);
        }
        // hauteur : on suit le sol, ou on vole un instant après une bosse
        let ground = H(me.x, me.z);
        if (!me.air && ground - me.y > 0.3) {
          // marche trop haute (dos ou flanc du tremplin) : on ne grimpe pas, on rebondit
          me.x -= me.vx * dt;
          me.z -= me.vz * dt;
          me.vx *= -0.35;
          me.vz *= -0.35;
          ground = H(me.x, me.z);
          MF.sfx.play("toc");
        }
        me.vy -= C.g * dt;
        me.y += me.vy * dt;
        if (me.y <= ground + 0.001) {
          if (me.air && me.vy < -4) MF.sfx.play("toc");
          me.y = ground;
          me.vy = MF.clamp((ground - before) / Math.max(dt, 1e-3), -30, 7);
          me.air = false;
        } else me.air = me.y > ground + 0.05;
        me.speed = vf;
        // progression le long du circuit
        const n2 = path.nearest(me.x, me.z, me.s, true);
        let ds = n2.s - me.s;
        if (ds > L / 2) ds -= L;
        else if (ds < -L / 2) ds += L;
        me.s = n2.s;
        me.dist += ds;
        const water = world.waterAt(me.x, me.z);
        const lost = Math.abs(n2.d) > WIDTH / 2 + 5.5 || (water && me.y < water.level - 0.05);
        offTimer = lost ? offTimer + dt : 0;
        if (offTimer > (water ? 0.2 : 1.2) || (!locked && st.hit.c)) {
          offTimer = 0;
          reset();
        }
      }
      function bounce(nx, nz, depth, restitution) {
        me.x += nx * depth;
        me.z += nz * depth;
        const vn = me.vx * nx + me.vz * nz;
        if (vn < 0) {
          me.vx -= (1 + restitution) * vn * nx;
          me.vz -= (1 + restitution) * vn * nz;
          if (vn < -2.5 && performance.now() - me.lastHit > 250) {
            me.lastHit = performance.now();
            MF.sfx.play("choc");
          }
        }
      }

      function ranking() {
        const rows = [];
        const st = session.state;
        if (!st) return rows;
        for (const p of st.roster) {
          const mine = p.uid === ctx.self.uid;
          const r = mine ? null : remotes.get(p.uid);
          const res = st.results[p.uid];
          const dist = mine ? (me ? me.dist : -1) : r ? r.obj.dist || 0 : -1;
          rows.push({ uid: p.uid, name: p.name, color: p.color, self: mine, dist, time: res && res.time ? res.time : 0, gone: !mine && !r && !res });
        }
        rows.sort((a, b) => (a.time ? 0 : 1) - (b.time ? 0 : 1) || a.time - b.time || b.dist - a.dist);
        return rows;
      }

      return {
        path,
        car: () => me,
        remotes,
        enter() {
          input.use({ layout: "radio", radio: { kicker: "REMOTE CONTROL", brand: MF.sponsors.brand("rc-telecommande") }, buttons: [{ id: "a", label: "BRAKE", key: "Space" }, { id: "c", label: "RESET", key: "C" }] });
          hud.stats([{ key: "lap", label: "Lap" }, { key: "time", label: "Time" }, { key: "pos", label: "Position" }]);
          hud.hint(input.touch ? "Left stick: throttle · right stick: steering" : "Arrows or WASD: drive · Space: handbrake · C: reset");
          sway = 0;
        },
        leave() {
          despawn();
        },
        idle() {
          remotes.clear();
        },
        onPhase(state, prev) {
          if (!ctx.active()) return;
          if (state && state.phase === "countdown" && (!prev || prev.phase !== "countdown")) {
            if (session.inRoster()) spawn(session.slot());
            else despawn();
          }
        },
        update(dt, time) {
          let dirty = remotes.update();
          if (!ctx.active()) return dirty;
          const st = session.state;
          const phase = st ? st.phase : "lobby";
          const racing = !!me && (phase === "countdown" || phase === "run");
          if (racing) {
            const t = session.time();
            const laps = st.opts.laps || 3;
            // feux : un rouge de plus toutes les 0,6 s, vert au départ, éteints ensuite
            setLamps(t < 0 ? MF.clamp(Math.floor((t + 3) / 0.6) + 1, 0, 5) : t < 2.5 ? 6 : 0);
            // départ canon : les gaz enfoncés pile au « Go! » (ni avant, ni trop tard)
            const gas = input.state.y > 0.5;
            if (gas && !me.gas) me.gasAt = t;
            me.gas = gas;
            if (phase === "run" && !me.launched && (gas || t > 0.3)) {
              me.launched = true;
              if (gas && me.gasAt > -0.15 && t <= 0.3) {
                me.boost = 1.4;
                hud.flash("Rocket start!", { color: MF.PAL.yellow, hold: 0.9 });
                MF.sfx.play("swing");
              }
            }
            drive(dt, phase === "countdown" || t < 0 || finished);
            MF.seat(me.car.group, track, me.x, me.z, me.h, 0, me.y);
            spinWheels(me.car, me.speed, me.steer, dt);
            me.car.shadow.position.y = 0.02 - (me.y - H(me.x, me.z));
            if (!engine) engine = MF.sfx.loop("moteur");
            engine.set(0.55 + Math.abs(me.speed) / C.vmax, finished ? 0.25 : 0.7);
            const lap = MF.clamp(Math.floor(Math.max(0, me.dist) / L) + 1, 1, laps);
            if (!finished && phase === "run") {
              if (me.lap !== lap && me.dist > 1) {
                if (me.lap !== undefined && lap > me.lap) {
                  const lapTime = t - me.lapStart;
                  me.lapStart = t;
                  const record = !me.best || lapTime < me.best;
                  if (record) me.best = lapTime;
                  hud.flash((lap === laps ? "Final lap! " : "Lap " + lap + " / " + laps + " · ") + MF.time(lapTime, 1) + (record && lap > 2 ? " (your best)" : ""), { color: lap === laps ? MF.PAL.yellow : "#ffffff" });
                  MF.sfx.play("tour");
                }
                me.lap = lap;
              }
              if (me.dist >= laps * L) {
                finished = true;
                const rows = ranking().filter((r) => r.time);
                hud.flash("Finished! " + MF.ordinal(rows.length + 1), { color: MF.PAL.yellow, hold: 3 });
                session.report({ time: Math.round(t * 1000) / 1000, dist: Math.round(me.dist) });
              } else {
                // le premier est arrivé : il reste 30 secondes aux autres
                const first = Object.values(st.results).some((r) => r && r.time);
                if (first && !graceEnd) {
                  graceEnd = t + GRACE;
                  hud.flash("First finisher is in: " + GRACE + " s left", { hold: 2.5 });
                }
                if (graceEnd && t > graceEnd) {
                  finished = true;
                  session.report({ dnf: true, dist: Math.round(me.dist) });
                }
              }
            } else if (phase === "countdown") me.lap = undefined;
            hud.set("lap", lap + " / " + laps);
            hud.set("time", MF.time(Math.max(0, t), 1));
            remotes.send([me.x, me.y, me.z, me.h, me.speed, me.steer], [Math.round(me.dist), finished ? 1 : 0]);
            MF.cam.fov(camera, 60 + MF.clamp(Math.abs(me.speed) / C.vmax, 0, 1.4) * 9);
            MF.cam.chase(camera, camState, me, me.h, { dist: 2.8, height: 1.1, look: 1.4, up: 0.3, rate: 7, turn: 4.5, clear: 0.35 }, dt, H);
            if (time - lastBoard > 0.3) {
              lastBoard = time;
              const rows = ranking();
              hud.set("pos", rows.findIndex((r) => r.self) + 1 + " / " + rows.length);
              hud.board(rows.map((r) => ({ name: r.name, color: r.color, self: r.self, text: r.time ? MF.time(r.time, 1) : r.gone ? "–" : "lap " + MF.clamp(Math.floor(Math.max(0, r.dist) / L) + 1, 1, laps) })));
            }
          } else {
            // salle d'attente, spectateur ou résultats : vue de la grille de départ, sous l'arche
            if (engine) {
              engine.stop();
              engine = null;
            }
            setLamps(0);
            if (phase === "lobby") {
              // ma voiture attend sur la grille, à ma place dans la liste des inscrits ; les autres la voient
              const slot = Math.max(0, session.slot());
              if (!me || me.slot !== slot) {
                spawn(slot);
                me.slot = slot;
              }
              remotes.send([me.x, me.y, me.z, me.h, 0, 0], [Math.round(me.dist), 0]);
            }
            sway += dt;
            const back = path.at(L - 9.5), look = path.at(L - 1);
            const side = Math.sin(sway * 0.22) * 2.2;
            MF.cam.fov(camera, 50);
            MF.cam.set(camera, { x: back.x - back.tz * side, y: H(back.x, back.z) + 2.7, z: back.z + back.tx * side }, { x: look.x, y: H(look.x, look.z) + 0.9, z: look.z });
          }
          return true;
        },
      };
    },
  });
})();
