// La Fête du Moulin — course de bateaux télécommandés sur le Grand étang.
//
// 1 à 8 skippers, 3 ou 5 tours. Le parcours (134 m) part devant la terrasse du moulin, descend le
// long de la rive est, vire au sud, fait une épingle à l'ouest et remonte en longeant l'îlot.
// Même principe que les voitures RC (chacun pilote son bateau et envoie sa position aux autres),
// avec une conduite de bateau : de l'inertie, ça glisse, et le gouvernail n'agit qu'avec de la vitesse.
// Pour le spectacle : un tremplin flottant sur la ligne droite sud (on décolle, on retombe dans une
// gerbe), des bidons de nitro à ramasser (coup d'accélérateur de deux secondes) et un canard de
// bain géant au milieu de l'étang.
(function () {
  "use strict";
  const MF = globalThis.MoulinFete;

  // Tracé (x, z) dans le sens de la course ; le premier point est la ligne de départ. Vérifié sur le
  // relevé : au moins 4,5 m d'eau libre de chaque côté, îlot compris.
  const COURSE = [[-4, 23], [9, 26], [12.5, 39], [8, 53], [-8, 58], [-24, 55.5], [-29.5, 51], [-24, 48], [-13, 50], [-4, 43.5], [-3, 32]];
  const WIDTH = 5; // largeur du chenal balisé (m)
  const BOAT_R = 0.5; // rayon d'encombrement d'un bateau
  const GRACE = 30; // secondes laissées aux autres après l'arrivée du premier
  const B = { vmax: 10.5, acc: 6.5, rev: 2.6, drag: 0.2, turn: 2.05, grip: 2.4, g: 11 };
  const RAMP = { near: [-6, 57.6], len: 2.6, height: 0.75, half: 1.0 }; // tremplin flottant (au milieu du chenal)
  const NITRO = [[10.6, 31, 1], [-21.5, 56, -1], [-9, 47.4, 1], [-3.6, 28, -1]]; // bidons : point proche du tracé, côté
  const NITRO_TIME = 2.2;
  const TRAIL = 22; // points du sillage

  /** Petit hors-bord à la couleur du skipper. Origine à la flottaison, avant vers +z. */
  function buildBoat(color, name) {
    const THREE = globalThis.THREE;
    const g = MF.group({ name: "Bateau_RC" });
    const hull = MF.group({ parent: g });
    const paint = MF.mat(color, { unique: true });
    MF.box(0.34, 0.16, 0.62, paint, { y: 0.03, z: -0.08, parent: hull, cast: true });
    // étrave : une pyramide couchée
    MF.cone(0.24, 0.42, paint, { y: 0.03, z: 0.43, rx: Math.PI / 2, ry: Math.PI / 4, seg: 4, parent: hull }).scale.set(1, 1, 0.48);
    MF.box(0.09, 0.02, 0.9, MF.PAL.white, { y: 0.115, z: 0.02, parent: hull }); // bande blanche sur le pont
    MF.box(0.24, 0.1, 0.05, MF.mat("#9fd8ff", { opacity: 0.75 }), { y: 0.18, z: 0.12, rx: -0.5, parent: hull });
    MF.box(0.12, 0.2, 0.14, MF.PAL.black, { y: 0.08, z: -0.44, parent: hull });
    MF.cyl(0.006, 0.006, 0.4, MF.PAL.steel, { y: 0.32, z: -0.3, parent: hull, seg: 5 });
    MF.box(0.004, 0.07, 0.12, paint, { y: 0.48, z: -0.37, parent: hull });
    MF.freeze(hull);
    // sillage : un ruban blanc qui s'effile derrière le bateau (géométrie réutilisée à chaque image)
    const pos = new Float32Array(TRAIL * 2 * 3), idx = [];
    for (let i = 0; i < TRAIL - 1; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setIndex(idx);
    const wake = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }));
    wake.frustumCulled = false;
    wake.name = "Sillage";
    let tag = null;
    if (name) {
      tag = MF.tag(name, { scale: 0.5 });
      tag.position.y = 1.05;
      g.add(tag);
    }
    return { group: g, hull, paint, wake, pos, trail: [], tag, x: undefined, z: 0, dist: 0 };
  }

  MF.registerGame({
    id: "bateaux",
    title: "RC Boat Race",
    icon: "🚤",
    color: MF.PAL.blue,
    blurb: "1–8 skippers · jump ramp, nitro cans · 3 or 5 laps",
    station: { x: -10, z: 14.6, heading: 0 },
    kiosk: { x: -13.4, z: 15.2, heading: 0 },
    hall: { x: -6.4, z: 15.2, heading: 0 },
    minPlayers: 1,
    maxPlayers: 8,
    maxTime: 300,
    options: [{ key: "laps", label: "Laps", values: [3, 5], default: 3, format: (v) => v + " laps" }],
    help: "Arrows or WASD: throttle and rudder (it only bites with speed) · C: back in the channel. Grab the yellow nitro cans for a burst of speed, and hit the floating ramp flat out to fly.",
    rank: (list) => list.slice().sort((a, b) => (a.time ? 0 : 1) - (b.time ? 0 : 1) || (a.time || 0) - (b.time || 0) || (b.dist || 0) - (a.dist || 0)),
    describe: (r) => (r.time ? MF.time(r.time) : "did not finish"),
    board: { label: "Best race time", better: "low", value: (r) => r.time, variant: (o) => (o.laps || 3) + " laps", format: (v) => MF.time(v) },

    create(ctx) {
      const { world, session, hud, input, group, camera } = ctx;
      const path = MF.path(COURSE, { closed: true, step: 1 });
      const L = path.length;
      const pond = world.waterAt(COURSE[0][0], COURSE[0][1]);
      const level = pond ? pond.level : 0;
      const islands = world.islands || [];
      /** Peut-on naviguer ici ? (de l'eau, assez de fond, pas sur un îlot) */
      const nav = (x, z) => {
        const w = world.waterAt(x, z);
        if (!w || world.heightAt(x, z) > w.level - 0.14) return false;
        for (const poly of islands) if (MF.pointInPoly(x, z, poly)) return false;
        return true;
      };
      const marks = []; // grosses bouées : { x, z, r }

      /* ---------------------------------------------------------------- décor (une fois) */
      const deco = MF.group({ name: "Parcours_des_bateaux", parent: group });
      // balisage du chenal : rouge à gauche, vert à droite, tous les 7 m
      for (let s = 3.5; s < L; s += 7) {
        const p = path.at(s);
        for (const side of [-1, 1]) {
          const x = p.x - p.tz * side * (WIDTH / 2), z = p.z + p.tx * side * (WIDTH / 2);
          const b = MF.group({ x, y: level, z, parent: deco });
          MF.sphere(0.16, side < 0 ? MF.PAL.red : MF.PAL.green, { y: 0.05, parent: b, seg: 8 });
          MF.cone(0.07, 0.22, MF.PAL.white, { y: 0.28, parent: b, seg: 6 });
        }
      }
      // grosses bouées de virage, à l'intérieur des virages, au nom du sponsor
      const buoyTex = MF.sponsors.texture("bateaux-bouees", { w: 2.4, h: 0.6, kicker: "Buoy" });
      const buoyMat = new world.THREE.MeshBasicMaterial({ map: buoyTex });
      const bigBuoy = (s, side, n) => {
        const p = path.at(s);
        const x = p.x - p.tz * side * (WIDTH / 2 + 0.6), z = p.z + p.tx * side * (WIDTH / 2 + 0.6);
        const b = MF.group({ name: "Bouee_de_virage", x, y: level, z, parent: deco });
        MF.cyl(0.42, 0.5, 0.5, MF.PAL.yellow, { y: 0.12, parent: b, seg: 14 });
        MF.mesh(new world.THREE.CylinderGeometry(0.44, 0.44, 0.34, 16, 1, true), buoyMat, { y: 0.42, parent: b });
        MF.cone(0.3, 0.5, MF.PAL.orange, { y: 0.84, parent: b, seg: 10 });
        const num = MF.sign(String(n), { w: 0.5, h: 0.5, bg: MF.PAL.red, color: "#ffffff", border: "#ffffff", double: true });
        num.position.y = 1.45;
        b.add(num);
        marks.push({ x, z, r: 0.52 });
      };
      [[12, 1], [29, 1], [45, 1], [62, 1], [79, 1], [84.5, 1], [90, 1], [102, 1], [113, 1]].forEach(([s, side], i) => bigBuoy(s, side, i + 1));
      // ligne de départ : deux mâts sur flotteurs et une banderole
      const start = path.at(0), startHeading = Math.atan2(start.tx, start.tz);
      const gate = MF.group({ name: "Depart_des_bateaux", x: start.x, y: level, z: start.z, ry: startHeading, parent: deco });
      for (const side of [-1, 1]) {
        const f = MF.group({ x: side * (WIDTH / 2 + 0.9), parent: gate });
        MF.cyl(0.4, 0.46, 0.36, MF.PAL.red, { y: 0.08, parent: f, seg: 12 });
        const pole = MF.pole(2.7, { color: MF.PAL.white });
        pole.position.y = 0.2;
        f.add(pole);
        marks.push({ x: start.x - start.tz * side * (WIDTH / 2 + 0.9), z: start.z + start.tx * side * (WIDTH / 2 + 0.9), r: 0.5 });
      }
      const title = MF.sign("START", { w: WIDTH + 1.4, h: 0.6, bg: MF.PAL.blue, color: "#ffffff", border: "#ffffff", double: true });
      title.position.y = 2.6;
      gate.add(title);
      // ponton de bois au pied de la terrasse, avec la banderole du sponsor tournée vers la course
      const jetty = MF.group({ name: "Ponton", x: -9.5, y: level, z: 20.4, parent: deco });
      MF.box(1.5, 0.1, 5.2, MF.PAL.wood, { y: 0.42, parent: jetty, cast: true });
      for (const [px, pz] of [[-0.65, -2.3], [0.65, -2.3], [-0.65, 0], [0.65, 0], [-0.65, 2.3], [0.65, 2.3]]) MF.cyl(0.07, 0.07, 1.5, MF.PAL.woodDark, { x: px, y: -0.2, z: pz, parent: jetty, seg: 6 });
      const sp = MF.sponsors.banner("bateaux-ponton", 3.6, 0.8, { lift: 0.5 });
      sp.position.set(0.72, 0.42, 0.2);
      sp.rotation.y = Math.PI / 2;
      jetty.add(sp);
      // tremplin flottant : une rampe de bois sur deux flotteurs, dans l'axe du chenal
      const foot = path.at(path.nearest(RAMP.near[0], RAMP.near[1]).s);
      {
        const mid = path.at(foot.s + RAMP.len / 2), tilt = Math.atan2(RAMP.height, RAMP.len);
        const r = MF.group({ name: "Tremplin_flottant", x: mid.x, y: level, z: mid.z, ry: Math.atan2(foot.tx, foot.tz), parent: deco });
        MF.box(RAMP.half * 2, 0.08, Math.hypot(RAMP.len, RAMP.height) + 0.5, MF.PAL.wood, { y: RAMP.height / 2 - 0.08, z: -0.2, rx: -tilt, parent: r, cast: true });
        for (const side of [-1, 1]) {
          MF.cyl(0.22, 0.22, RAMP.len + 0.3, MF.PAL.orange, { x: side * (RAMP.half + 0.2), y: 0.02, rx: Math.PI / 2, parent: r, seg: 10 });
          MF.box(0.08, RAMP.height, 0.08, MF.PAL.woodDark, { x: side * (RAMP.half - 0.05), y: RAMP.height / 2, z: RAMP.len / 2 - 0.05, parent: r });
          const f = MF.props.flag(side < 0 ? MF.PAL.red : MF.PAL.yellow, 2.2);
          f.position.set(side * (RAMP.half + 0.2), 0.1, -RAMP.len / 2);
          r.add(f);
        }
        // flèches peintes sur la rampe
        for (let i = 0; i < 3; i++) MF.cone(0.28, 0.4, MF.PAL.white, { y: 0.04 + ((i + 0.6) / 3.4) * RAMP.height, z: -RAMP.len / 2 + (i + 0.6) * (RAMP.len / 3.4), rx: Math.PI / 2 - tilt, parent: r, seg: 3 }).scale.set(1, 1, 0.12);
      }
      // canard de bain géant, au milieu de l'étang (un amer, hors du chenal)
      {
        const d = MF.group({ name: "Canard_geant", x: 3.2, y: level - 0.1, z: 38.2, ry: -0.9, parent: deco });
        MF.sphere(1.25, "#ffd23e", { y: 0.75, parent: d, seg: 16, cast: true }).scale.set(1, 0.82, 1.25);
        MF.sphere(0.78, "#ffd23e", { y: 2.0, z: 0.75, parent: d, seg: 14, cast: true });
        MF.cone(0.3, 0.62, MF.PAL.orange, { y: 1.9, z: 1.6, rx: Math.PI / 2, parent: d, seg: 8 }).scale.set(1.5, 1, 0.6);
        MF.cone(0.7, 1.0, "#ffd23e", { y: 1.05, z: -1.5, rx: -Math.PI / 2 - 0.7, parent: d, seg: 8 }); // la queue
        for (const side of [-1, 1]) {
          MF.sphere(0.11, MF.PAL.black, { x: side * 0.42, y: 2.25, z: 1.32, parent: d, seg: 8 });
          MF.sphere(0.62, "#f5c22e", { x: side * 1.0, y: 0.85, z: -0.1, parent: d, seg: 10 }).scale.set(0.35, 0.7, 1.1); // les ailes
        }
        marks.push({ x: 3.2, z: 38.2, r: 1.45 });
      }
      MF.freeze(deco);
      // bidons de nitro : ils tournent sur l'eau ; chacun ramasse les siens (ils reviennent 5 s après)
      const cans = NITRO.map(([x, z, side]) => {
        const p = path.at(path.nearest(x, z).s);
        const cx = p.x - p.tz * side * 1.1, cz = p.z + p.tx * side * 1.1;
        const g = MF.group({ name: "Bidon_nitro", x: cx, y: level + 0.42, z: cz, parent: group });
        const glow = MF.mat("#ffe14a", { emissive: "#ffb400", emissiveIntensity: 0.7 });
        MF.cyl(0.2, 0.2, 0.46, glow, { parent: g, seg: 10 });
        MF.cyl(0.07, 0.07, 0.12, MF.PAL.red, { y: 0.29, parent: g, seg: 8 });
        MF.torus(0.36, 0.035, MF.PAL.white, { rx: Math.PI / 2, parent: g, seg: 16, tubeSeg: 5 });
        // l'éclair : deux losanges
        for (const [y, r] of [[0.08, 0.5], [-0.08, -0.5]]) MF.box(0.09, 0.2, 0.012, MF.PAL.red, { y, z: 0.205, rz: r, parent: g });
        return { g, x: cx, z: cz, back: 0 };
      });
      // gerbes d'eau : quelques gouttes blanches réutilisées (amerrissage après le tremplin)
      const drops = [];
      for (let i = 0; i < 14; i++) {
        const m = MF.sphere(0.09, MF.mat("#ffffff", { basic: true }), { parent: group, seg: 5 });
        m.visible = false;
        drops.push({ m, vx: 0, vy: 0, vz: 0, life: 0 });
      }
      function splash(x, z, power) {
        for (const d of drops) {
          const a = Math.random() * Math.PI * 2, v = (0.6 + Math.random()) * power;
          d.m.position.set(x, level + 0.05, z);
          d.vx = Math.cos(a) * v;
          d.vz = Math.sin(a) * v;
          d.vy = 2 + Math.random() * 2.5 * power;
          d.life = 0.9;
          d.m.visible = true;
        }
      }
      function effects(dt, time) {
        for (const c of cans) {
          c.g.rotation.y = time * 2.2;
          c.g.position.y = level + 0.42 + Math.sin(time * 2.6 + c.x) * 0.06;
          if (c.back > 0 && (c.back -= dt) <= 0) c.g.visible = true;
        }
        for (const d of drops) {
          if (d.life <= 0) continue;
          d.life -= dt;
          d.vy -= 9 * dt;
          d.m.position.x += d.vx * dt;
          d.m.position.y += d.vy * dt;
          d.m.position.z += d.vz * dt;
          if (d.life <= 0 || d.m.position.y < level) {
            d.life = 0;
            d.m.visible = false;
          }
        }
      }
      /** Hauteur de la rampe sous ce point (0 hors de la rampe). */
      const rampAt = (x, z) => {
        const dx = x - foot.x, dz = z - foot.z, u = dx * foot.tx + dz * foot.tz;
        if (u <= 0 || u >= RAMP.len) return 0;
        return Math.abs(dx * foot.tz - dz * foot.tx) < RAMP.half ? (RAMP.height * u) / RAMP.len : 0;
      };

      /* ---------------------------------------------------------------- bateaux */
      let me = null;
      const camState = {};
      let engine = null, finished = false, graceEnd = 0, stuck = 0, lastBoard = 0, sway = 0;

      function place(boat, x, z, h, speed, steer, time, alt = 0) {
        const bob = Math.sin(time * 2.3 + x * 0.7) * 0.02;
        boat.group.position.set(x, level - 0.05 + bob + alt, z);
        boat.group.rotation.y = h;
        // nez qui se lève avec la vitesse (et franchement en l'air), gîte dans les virages
        boat.hull.rotation.x = -MF.clamp(speed / B.vmax, -0.3, 1) * 0.16 + Math.sin(time * 1.7 + z) * 0.025 - Math.min(0.4, alt * 0.45);
        if (alt > 0.12) return; // en l'air : pas de sillage
        boat.hull.rotation.z = steer * MF.clamp(Math.abs(speed) / B.vmax, 0, 1) * 0.34;
        // sillage : on mémorise la poupe, le ruban relie les dernières positions en s'effilant
        const sx = x - Math.sin(h) * 0.42, sz = z - Math.cos(h) * 0.42;
        const t = boat.trail;
        if (!t.length || Math.hypot(sx - t[0][0], sz - t[0][1]) > 0.28) {
          const p = t.length >= TRAIL ? t.pop() : [0, 0, 0, 0];
          p[0] = sx;
          p[1] = sz;
          p[2] = Math.cos(h);
          p[3] = -Math.sin(h);
          t.unshift(p);
        }
        const a = boat.pos, wide = 0.1 + MF.clamp(Math.abs(speed) / B.vmax, 0, 1) * 0.3;
        for (let i = 0; i < TRAIL; i++) {
          const p = t[Math.min(i, t.length - 1)], w = wide * (1 - i / (TRAIL - 1)) * (i < t.length ? 1 : 0);
          a[i * 6] = p[0] + p[2] * w;
          a[i * 6 + 1] = level + 0.03;
          a[i * 6 + 2] = p[1] + p[3] * w;
          a[i * 6 + 3] = p[0] - p[2] * w;
          a[i * 6 + 4] = level + 0.03;
          a[i * 6 + 5] = p[1] - p[3] * w;
        }
        boat.wake.geometry.attributes.position.needsUpdate = true;
      }
      const remotes = MF.remotes({
        session,
        size: 6, // x, z, cap, vitesse, barre, hauteur au-dessus de l'eau
        angles: [2],
        make(peer) {
          const boat = buildBoat(peer.color, peer.name);
          group.add(boat.group, boat.wake);
          return boat;
        },
        apply(boat, v, extra) {
          place(boat, v[0], v[1], v[2], v[3], v[4], performance.now() / 1000, v[5] || 0);
          boat.x = v[0];
          boat.z = v[1];
          boat.dist = extra ? extra[0] : 0;
        },
        remove(boat) {
          group.remove(boat.group, boat.wake);
          MF.dispose(boat.group);
          boat.wake.geometry.dispose();
          boat.wake.material.dispose();
        },
      });
      function gridSpot(slot) {
        const row = Math.floor(slot / 2), side = slot % 2 ? 1 : -1;
        const p = path.at(L - 2.2 - row * 2.1);
        return { x: p.x - p.tz * side * 1.1, z: p.z + p.tx * side * 1.1, h: Math.atan2(p.tx, p.tz), s: p.s };
      }
      function spawn(slot) {
        if (!me) {
          me = { boat: buildBoat(ctx.self.color, null) };
          group.add(me.boat.group, me.boat.wake);
        }
        me.boat.paint.color.copy(MF.color(ctx.self.color));
        me.boat.trail.length = 0;
        const g = gridSpot(slot);
        Object.assign(me, { x: g.x, z: g.z, y: level, h: g.h, vx: 0, vz: 0, s: g.s, dist: g.s - L, steer: 0, speed: 0, lastHit: 0, lap: undefined, alt: 0, vy: 0, air: false, nitro: 0, lapStart: 0 });
        for (const c of cans) {
          c.back = 0;
          c.g.visible = true;
        }
        camState.x = undefined;
        finished = false;
        graceEnd = 0;
        stuck = 0;
      }
      function despawn() {
        if (me) {
          group.remove(me.boat.group, me.boat.wake);
          MF.dispose(me.boat.group);
          me.boat.wake.geometry.dispose();
          me.boat.wake.material.dispose();
          me = null;
        }
        if (engine) {
          engine.stop();
          engine = null;
        }
      }
      function reset() {
        const p = path.at(me.s);
        Object.assign(me, { x: p.x, z: p.z, h: Math.atan2(p.tx, p.tz), vx: 0, vz: 0, alt: 0, vy: 0, air: false });
        me.boat.trail.length = 0;
        camState.x = undefined;
        MF.sfx.play("plouf");
      }
      function bounce(nx, nz, depth, restitution) {
        me.x += nx * depth;
        me.z += nz * depth;
        const vn = me.vx * nx + me.vz * nz;
        if (vn < 0) {
          me.vx -= (1 + restitution) * vn * nx;
          me.vz -= (1 + restitution) * vn * nz;
          if (vn < -1.5 && performance.now() - me.lastHit > 300) {
            me.lastHit = performance.now();
            MF.sfx.play("choc");
          }
        }
      }
      function sail(dt, locked) {
        const st = input.state;
        const throttle = locked ? 0 : st.y, steerIn = locked ? 0 : st.x;
        const fx = Math.sin(me.h), fz = Math.cos(me.h);
        let vf = me.vx * fx + me.vz * fz, vl = me.vx * -fz + me.vz * fx;
        me.nitro = Math.max(0, me.nitro - dt);
        const vmax = B.vmax * (me.nitro > 0 ? 1.45 : 1);
        me.steer = MF.damp(me.steer, steerIn, 9, dt);
        if (!me.air) {
          if (throttle > 0.05) vf += B.acc * (me.nitro > 0 ? 2 : 1) * throttle * (1 - Math.max(0, vf) / vmax) * dt;
          else if (throttle < -0.05) vf += B.acc * 0.7 * throttle * dt;
          vf -= vf * B.drag * dt;
          vf = MF.clamp(vf, -B.rev, vmax * 1.05);
          vl -= vl * Math.min(1, B.grip * dt);
          // le gouvernail a besoin d'eau qui file dessus : à l'arrêt, le bateau ne tourne presque pas
          me.h -= me.steer * B.turn * MF.clamp(Math.abs(vf) / 3, 0.12, 1) * Math.sign(vf || 1) * dt;
          me.vx = fx * vf - fz * vl;
          me.vz = fz * vf + fx * vl;
        }
        const ox = me.x, oz = me.z;
        me.x += me.vx * dt;
        me.z += me.vz * dt;
        // tremplin : on suit la rampe, puis on vole ; retour à l'eau dans une gerbe
        let deck = rampAt(me.x, me.z);
        if (!me.air && deck - me.alt > 0.3) {
          // flanc ou dos de la rampe : on bute dessus au lieu d'y grimper d'un coup
          me.x = ox;
          me.z = oz;
          me.vx *= -0.3;
          me.vz *= -0.3;
          deck = rampAt(me.x, me.z);
        }
        const was = me.alt;
        me.vy -= B.g * dt;
        me.alt += me.vy * dt;
        if (me.alt <= deck) {
          if (me.air && me.vy < -2.5) {
            splash(me.x, me.z, 1.2);
            MF.sfx.play("plouf");
            vf *= 0.93;
            me.vx *= 0.93;
            me.vz *= 0.93;
          }
          me.alt = deck;
          me.vy = MF.clamp((deck - was) / Math.max(dt, 1e-3), 0, 6);
          me.air = false;
        } else if (!me.air && me.alt > deck + 0.06) {
          me.air = true;
          if (me.alt > 0.4) hud.flash("Airborne!", { color: "#7fd8ff", hold: 0.7 });
        }
        // bidons de nitro
        if (!locked)
          for (const c of cans)
            if (c.back <= 0 && Math.hypot(me.x - c.x, me.z - c.z) < 1.05) {
              c.back = 5;
              c.g.visible = false;
              me.nitro = NITRO_TIME;
              hud.flash("Nitro!", { color: MF.PAL.yellow, hold: 0.7 });
              MF.sfx.play("swing");
            }
        if (!nav(me.x, me.z)) {
          // rive ou îlot : on revient et on repart mollement vers le milieu du chenal
          const n = path.nearest(ox, oz, me.s, true);
          let nx = n.x - ox, nz = n.z - oz;
          const l = Math.hypot(nx, nz) || 1;
          nx /= l;
          nz /= l;
          me.x = ox;
          me.z = oz;
          const vn = me.vx * nx + me.vz * nz;
          me.vx = (me.vx - vn * nx) * 0.5 + nx * 0.9;
          me.vz = (me.vz - vn * nz) * 0.5 + nz * 0.9;
          if (performance.now() - me.lastHit > 400) {
            me.lastHit = performance.now();
            MF.sfx.play("toc");
          }
          stuck += dt * 4;
        } else stuck = Math.max(0, stuck - dt);
        if (me.alt < 0.5)
          for (const m of marks) {
            const dx = me.x - m.x, dz = me.z - m.z, d = Math.hypot(dx, dz);
            if (d < m.r + BOAT_R && d > 1e-3) bounce(dx / d, dz / d, m.r + BOAT_R - d, 0.4);
          }
        for (const r of remotes.map.values()) {
          const o = r.obj;
          if (o.x === undefined) continue;
          const dx = me.x - o.x, dz = me.z - o.z, d = Math.hypot(dx, dz);
          if (d < BOAT_R * 2 && d > 1e-3) bounce(dx / d, dz / d, (BOAT_R * 2 - d) * 0.6, 0.5);
        }
        me.speed = vf;
        const n2 = path.nearest(me.x, me.z, me.s, true);
        let ds = n2.s - me.s;
        if (ds > L / 2) ds -= L;
        else if (ds < -L / 2) ds += L;
        me.s = n2.s;
        me.dist += ds;
        if (stuck > 2.2 || Math.abs(n2.d) > WIDTH / 2 + 9 || (!locked && st.hit.c)) {
          stuck = 0;
          reset();
        }
      }
      function ranking() {
        const rows = [], st = session.state;
        if (!st) return rows;
        for (const p of st.roster) {
          const mine = p.uid === ctx.self.uid, r = mine ? null : remotes.get(p.uid), res = st.results[p.uid];
          rows.push({ name: p.name, color: p.color, self: mine, dist: mine ? (me ? me.dist : -1) : r ? r.obj.dist || 0 : -1, time: res && res.time ? res.time : 0, gone: !mine && !r && !res });
        }
        return rows.sort((a, b) => (a.time ? 0 : 1) - (b.time ? 0 : 1) || a.time - b.time || b.dist - a.dist);
      }
      const camGround = (x, z) => Math.max(world.heightAt(x, z), level);

      return {
        path,
        boat: () => me,
        remotes,
        enter() {
          input.use({ layout: "radio", radio: { kicker: "REMOTE CONTROL", brand: MF.sponsors.brand("bateaux-telecommande") }, buttons: [{ id: "c", label: "RESET", key: "C" }] });
          hud.stats([{ key: "lap", label: "Lap" }, { key: "time", label: "Time" }, { key: "pos", label: "Position" }]);
          hud.hint(input.touch ? "Left stick: throttle · right stick: rudder" : "Arrows or WASD: throttle and rudder · C: reset");
          sway = 0;
        },
        leave: despawn,
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
          const st = session.state, phase = st ? st.phase : "lobby";
          if (me && (phase === "countdown" || phase === "run")) {
            const t = session.time(), laps = st.opts.laps || 3;
            sail(dt, phase === "countdown" || t < 0 || finished);
            place(me.boat, me.x, me.z, me.h, me.speed, me.steer, time, me.alt);
            effects(dt, time);
            if (!engine) engine = MF.sfx.loop("bateau");
            engine.set(0.6 + Math.abs(me.speed) / B.vmax, finished ? 0.2 : 0.6);
            const lap = MF.clamp(Math.floor(Math.max(0, me.dist) / L) + 1, 1, laps);
            if (!finished && phase === "run") {
              if (me.lap !== lap && me.dist > 1) {
                if (me.lap !== undefined && lap > me.lap) {
                  const lapTime = t - me.lapStart;
                  me.lapStart = t;
                  hud.flash((lap === laps ? "Final lap! · " : "Lap " + lap + " / " + laps + " · ") + MF.time(lapTime, 1), { color: lap === laps ? MF.PAL.yellow : "#ffffff" });
                  MF.sfx.play("tour");
                }
                me.lap = lap;
              }
              if (me.dist >= laps * L) {
                finished = true;
                const before = ranking().filter((r) => r.time).length;
                hud.flash("Finished! " + MF.ordinal(before + 1), { color: MF.PAL.yellow, hold: 3 });
                session.report({ time: Math.round(t * 1000) / 1000, dist: Math.round(me.dist) });
              } else {
                if (!graceEnd && Object.values(st.results).some((r) => r && r.time)) {
                  graceEnd = t + GRACE;
                  hud.flash("First finisher is in: " + GRACE + " s left", { hold: 2.5 });
                }
                if (graceEnd && t > graceEnd) {
                  finished = true;
                  session.report({ dnf: true, dist: Math.round(me.dist) });
                }
              }
            }
            hud.set("lap", lap + " / " + laps);
            hud.set("time", MF.time(Math.max(0, t), 1));
            remotes.send([me.x, me.z, me.h, me.speed, me.steer, me.alt], [Math.round(me.dist), finished ? 1 : 0]);
            MF.cam.fov(camera, me.nitro > 0 ? 70 : 60);
            me.y = level + me.alt * 0.6;
            MF.cam.chase(camera, camState, me, me.h, { dist: 3.6, height: 1.5, look: 2.2, up: 0.3, rate: 5, turn: 3.2, clear: 0.45 }, dt, camGround);
            if (time - lastBoard > 0.3) {
              lastBoard = time;
              const rows = ranking();
              hud.set("pos", rows.findIndex((r) => r.self) + 1 + " / " + rows.length);
              hud.board(rows.map((r) => ({ name: r.name, color: r.color, self: r.self, text: r.time ? MF.time(r.time, 1) : r.gone ? "–" : "lap " + MF.clamp(Math.floor(Math.max(0, r.dist) / L) + 1, 1, laps) })));
            }
          } else {
            if (engine) {
              engine.stop();
              engine = null;
            }
            if (phase === "lobby") {
              const slot = Math.max(0, session.slot());
              if (!me || me.slot !== slot) {
                spawn(slot);
                me.slot = slot;
              }
              place(me.boat, me.x, me.z, me.h, 0, 0, time);
              remotes.send([me.x, me.z, me.h, 0, 0, 0], [Math.round(me.dist), 0]);
            } else if (me) place(me.boat, me.x, me.z, me.h, 0, 0, time);
            effects(dt, time);
            // vue depuis la terrasse : la ligne de départ, le ponton, l'îlot au fond
            sway += dt;
            MF.cam.fov(camera, 50);
            MF.cam.set(camera, { x: -15.5 + Math.sin(sway * 0.2) * 1.6, y: level + 4.2, z: 16.2 }, { x: -5, y: level + 0.4, z: 27 });
          }
          return true;
        },
      };
    },
  });
})();
