// La Fête du Moulin — lancer de citrouilles.
//
// Chacun a sa catapulte sur la rive sud de l'étang intermédiaire et cinq (ou huit) citrouilles à
// envoyer sur les cibles : quatre grandes cibles à anneaux sur la rive d'en face (50, 30 ou 10 points)
// et trois bassines qui dérivent sur l'eau (20 points). On règle la direction, on maintient pour
// charger (la jauge monte et redescend), on relâche. Un vent, le même pour tous, dévie les tirs.
// Tout le monde tire en même temps : chaque joueur simule ses citrouilles et annonce ses lancers ;
// les autres rejouent la même trajectoire et voient le même impact.
(function () {
  "use strict";
  const MF = globalThis.MoulinFete;

  const PAD = { x: 58, z: -16.6 }; // milieu de la ligne des catapultes ; on tire vers le nord (−z)
  const LANE = 1.7; // écart entre deux catapultes (m)
  const BANK = [ // cibles de la rive nord : x, z, rayon, hauteur du centre au-dessus du sol
    { x: 52, z: -45.4, r: 1.5, up: 1.7 },
    { x: 56.6, z: -46.9, r: 1.5, up: 1.7 },
    { x: 60.2, z: -44.3, r: 1.5, up: 1.7 },
    { x: 55, z: -49.6, r: 1.25, up: 3.4 },
  ];
  const RAFTS = [ // bassines flottantes : x moyen, z, amplitude et vitesse de la dérive
    { x: 53, z: -29, a: 4, w: 0.27, p: 0 },
    { x: 59.5, z: -33, a: 4.5, w: 0.21, p: 2 },
    { x: 55, z: -36.6, a: 3.5, w: 0.33, p: 4 },
  ];
  const TILT = 0.52; // les cibles de la rive sont couchées en arrière (rad) : la citrouille arrive presque de face
  const G = 9.8, DRAG = 0.012, TIME_LIMIT = 90;
  const speedOf = (p) => 9 + 12 * p; // vitesse de départ selon la jauge (0…1)

  function buildPumpkin() {
    const g = MF.group({ name: "Citrouille" });
    MF.sphere(0.24, MF.PAL.orange, { parent: g, seg: 10 }).scale.set(1, 0.8, 1);
    for (let i = 0; i < 6; i++) MF.sphere(0.11, "#ff9d3d", { x: Math.cos(i * 1.047) * 0.17, z: Math.sin(i * 1.047) * 0.17, parent: g, seg: 6 }).scale.set(1, 1.5, 1);
    MF.cyl(0.03, 0.04, 0.1, MF.PAL.green, { y: 0.2, parent: g, seg: 5 });
    return MF.freeze(g);
  }
  /** Catapulte de fête : bâti en bois, bras qui bascule autour d'un axe, contrepoids. Avant vers −z. */
  function buildCatapult(color) {
    const g = MF.group({ name: "Catapulte" });
    MF.box(1.1, 0.12, 1.9, MF.PAL.wood, { y: 0.1, parent: g, cast: true });
    for (const side of [-1, 1]) {
      MF.box(0.1, 1.35, 0.12, MF.PAL.woodDark, { x: side * 0.42, y: 0.78, z: -0.25, rx: 0.22, parent: g, cast: true });
      MF.box(0.1, 1.35, 0.12, MF.PAL.woodDark, { x: side * 0.42, y: 0.78, z: 0.3, rx: -0.22, parent: g });
      MF.cyl(0.2, 0.2, 0.1, MF.PAL.black, { x: side * 0.6, y: 0.2, z: 0.6, rz: Math.PI / 2, parent: g, seg: 10 });
      MF.cyl(0.2, 0.2, 0.1, MF.PAL.black, { x: side * 0.6, y: 0.2, z: -0.6, rz: Math.PI / 2, parent: g, seg: 10 });
    }
    MF.cyl(0.05, 0.05, 1.0, MF.PAL.steel, { y: 1.4, z: 0.02, rz: Math.PI / 2, parent: g, seg: 6 });
    const arm = MF.group({ y: 1.4, z: 0.02, parent: g });
    arm.userData.live = true; // le bras bascule
    MF.box(0.09, 0.09, 2.3, MF.PAL.wood, { z: 0.45, parent: arm });
    MF.box(0.36, 0.36, 0.36, MF.mat(color), { z: -0.62, y: -0.1, parent: arm }); // contrepoids à la couleur du joueur
    MF.cyl(0.3, 0.22, 0.14, MF.PAL.woodDark, { z: 1.58, y: 0.08, parent: arm, seg: 10 }); // panier
    const load = buildPumpkin();
    load.position.set(0, 0.3, 1.58);
    arm.add(load);
    MF.freeze(g);
    return { group: g, arm, load, swing: 0 };
  }

  MF.registerGame({
    id: "citrouilles",
    title: "Lancer de citrouilles",
    icon: "🎃",
    color: MF.PAL.orange,
    blurb: "Catapulte par-dessus l'étang",
    station: { x: PAD.x, z: PAD.z + 2.6, heading: Math.PI },
    kiosk: { x: PAD.x + 8.6, z: PAD.z + 2.2, heading: Math.PI },
    minPlayers: 1,
    maxPlayers: 8,
    maxTime: TIME_LIMIT + 30,
    options: [{ key: "shots", label: "Citrouilles", values: [5, 8], default: 5, format: (v) => v + " tirs" }],
    help: "← → : viser · ↑ ↓ : hausse · maintiens Espace (ou le clic) pour charger, relâche pour lancer. Attention au vent !",
    rank: (list) => list.slice().sort((a, b) => (b.score || 0) - (a.score || 0) || (a.name < b.name ? -1 : 1)),
    describe: (r) => (r.score || 0) + " points",

    create(ctx) {
      const { world, session, hud, input, group, camera } = ctx;
      const THREE = world.THREE;
      const H = world.heightAt;
      const pond = world.waterAt(56, -32);
      const WL = pond ? pond.level : -0.42;
      const Y0 = H(PAD.x, PAD.z);

      /* ---------------------------------------------------------------- décor (une fois) */
      const deco = MF.group({ name: "Lancer_de_citrouilles", parent: group });
      MF.box(15.5, 0.12, 2.6, MF.PAL.wood, { x: PAD.x, y: Y0 + 0.02, z: PAD.z, parent: deco });
      const sp = MF.sponsors.banner("citrouilles-fronton", 5, 0.95, { lift: 0.35 });
      sp.position.set(PAD.x - 6.4, H(PAD.x - 6.4, PAD.z - 1.9), PAD.z - 1.9);
      sp.rotation.y = 0.35;
      deco.add(sp);
      for (let i = 0; i < 5; i++) { // tas de citrouilles
        const p = buildPumpkin();
        p.position.set(PAD.x + 8.4 + (i % 3) * 0.5 - (i > 2 ? 0.25 : 0), Y0 + 0.28 + (i > 2 ? 0.36 : 0), PAD.z + 0.2 + (i % 2) * 0.3);
        deco.add(p);
      }
      // manche à air : elle montre d'où vient le vent et sa force
      const sockPole = MF.pole(3.4, { color: MF.PAL.white, top: MF.PAL.red });
      sockPole.position.set(PAD.x + 9.6, H(PAD.x + 9.6, PAD.z - 1), PAD.z - 1);
      deco.add(sockPole);
      const sock = MF.group({ x: PAD.x + 9.6, y: sockPole.position.y + 3.3, z: PAD.z - 1, parent: deco });
      sock.userData.live = true; // elle tourne avec le vent
      MF.cone(0.22, 1.3, MF.PAL.red, { z: 0.65, rx: -Math.PI / 2, parent: sock, seg: 8 });
      // cibles de la rive nord : disque à anneaux couché en arrière, sur un chevalet, bâche du sponsor dessous
      const ringTex = MF.canvasTexture(256, 256, (c, W) => {
        [["#ffffff", 1], [MF.PAL.red, 0.66], [MF.PAL.yellow, 0.33]].forEach(([col, k]) => {
          c.fillStyle = col;
          c.beginPath();
          c.arc(W / 2, W / 2, (W / 2) * k * 0.98, 0, 6.3);
          c.fill();
        });
        c.strokeStyle = "#2b1a10";
        c.lineWidth = 8;
        c.beginPath();
        c.arc(W / 2, W / 2, W / 2 - 5, 0, 6.3);
        c.stroke();
      });
      const ringMat = new THREE.MeshBasicMaterial({ map: ringTex, transparent: true });
      const normal = new THREE.Vector3(0, Math.sin(TILT), Math.cos(TILT)); // face aux lanceurs (sud) et vers le haut
      for (const t of BANK) {
        t.gy = H(t.x, t.z);
        t.cy = t.gy + t.up;
        const g = MF.group({ name: "Cible", x: t.x, y: t.cy, z: t.z, parent: deco });
        MF.mesh(new THREE.CircleGeometry(t.r, 28), ringMat, { rx: -TILT, parent: g });
        MF.cyl(t.r, t.r, 0.08, MF.PAL.woodDark, { rx: Math.PI / 2 - TILT, z: -0.06, parent: g, seg: 20, cast: true });
        for (const side of [-1, 1]) MF.cyl(0.05, 0.06, t.up + 0.2, MF.PAL.woodDark, { x: side * t.r * 0.6, y: -t.up / 2 - 0.1, z: -0.5, parent: g, seg: 6 });
        const b = MF.sponsors.banner("citrouilles-cibles", 2.6, 0.55, { lift: 0.1, posts: t.up > 2.5 });
        b.position.set(t.x, t.up > 2.5 ? t.cy - t.r - 0.8 : t.gy, t.z + (t.up > 2.5 ? -0.4 : 1.25));
        deco.add(b);
      }
      // bassines flottantes
      const rafts = RAFTS.map((r) => {
        const g = MF.group({ name: "Bassine_flottante", x: r.x, y: WL, z: r.z, parent: deco });
        g.userData.live = true; // elle dérive
        MF.box(2.0, 0.14, 2.0, MF.PAL.wood, { y: 0.05, parent: g });
        MF.cyl(0.9, 0.78, 0.5, MF.PAL.red, { y: 0.36, parent: g, seg: 16, open: true });
        MF.cyl(0.78, 0.78, 0.04, MF.PAL.white, { y: 0.14, parent: g, seg: 16 });
        MF.cyl(0.92, 0.92, 0.07, MF.PAL.white, { y: 0.6, parent: g, seg: 16, open: true });
        return Object.assign({ group: g, cx: r.x }, r);
      });
      const raftX = (r, t) => r.x + Math.sin(t * r.w + r.p) * r.a;
      MF.freeze(deco);

      /* ---------------------------------------------------------------- catapultes, citrouilles, éclats */
      const pults = new Map(); // uid → catapulte (une par joueur de la partie)
      const laneX = (slot, n) => PAD.x + (slot - (n - 1) / 2) * LANE;
      function syncPults() {
        const st = session.state;
        const roster = st && st.phase !== "lobby" ? st.roster : session.players();
        const want = new Set(roster.map((p) => p.uid));
        for (const [uid, c] of pults) if (!want.has(uid)) {
          group.remove(c.group);
          MF.dispose(c.group);
          pults.delete(uid);
        }
        roster.forEach((p, i) => {
          let c = pults.get(p.uid);
          if (!c) {
            c = buildCatapult(p.color);
            group.add(c.group);
            pults.set(p.uid, c);
          }
          c.x = laneX(i, roster.length);
          c.group.position.set(c.x, H(c.x, PAD.z) + 0.08, PAD.z);
        });
      }
      const shots = []; // citrouilles en vol : { mesh, x, y, z, vx, vy, vz, mine, alive }
      for (let i = 0; i < 12; i++) {
        const mesh = buildPumpkin();
        mesh.visible = false;
        group.add(mesh);
        shots.push({ mesh, alive: false });
      }
      const bits = [];
      for (let i = 0; i < 18; i++) {
        const m = MF.sphere(0.09, i % 3 ? MF.PAL.orange : MF.PAL.white, { parent: group, seg: 5 });
        m.visible = false;
        bits.push({ mesh: m, life: 0, vx: 0, vy: 0, vz: 0 });
      }
      let bitIx = 0;
      function burst(x, y, z, n, water) {
        for (let i = 0; i < n; i++) {
          const b = bits[bitIx++ % bits.length];
          b.mesh.position.set(x, y, z);
          b.mesh.material = MF.mat(water ? MF.PAL.white : i % 3 ? MF.PAL.orange : "#ffd27a");
          b.mesh.visible = true;
          b.life = 0.7;
          b.vx = (Math.random() - 0.5) * 5;
          b.vy = 2 + Math.random() * 4;
          b.vz = (Math.random() - 0.5) * 5;
        }
      }
      let wind = 0; // vent de travers (m/s, + vers l'est), tiré de la graine
      const windOf = (seed) => Math.round((MF.rng((seed >>> 0) ^ 0x9e3779b9)() * 2 - 1) * 28) / 10;
      function launch(d, mine) {
        const s = shots.find((q) => !q.alive);
        if (!s) return null;
        Object.assign(s, { x: d[0], y: d[1], z: d[2], vx: d[3], vy: d[4], vz: d[5], mine, alive: true, age: 0 });
        s.mesh.visible = true;
        return s;
      }
      /** Fait avancer une citrouille ; renvoie les points marqués à l'impact (null tant qu'elle vole). */
      const pv = new THREE.Vector3(), pc = new THREE.Vector3();
      function fly(s, dt, t) {
        const ox = s.x, oy = s.y, oz = s.z;
        s.vx += (wind - s.vx) * 0.09 * dt - s.vx * DRAG * dt;
        s.vy -= G * dt;
        s.vz -= s.vz * DRAG * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.z += s.vz * dt;
        s.age += dt;
        if (s.mesh) {
          s.mesh.position.set(s.x, s.y, s.z);
          s.mesh.rotation.x -= dt * 7;
        }
        // cibles de la rive : la citrouille traverse-t-elle le plan du disque, à l'intérieur ?
        for (const tg of BANK) {
          const d0 = (ox - tg.x) * normal.x + (oy - tg.cy) * normal.y + (oz - tg.z) * normal.z;
          const d1 = (s.x - tg.x) * normal.x + (s.y - tg.cy) * normal.y + (s.z - tg.z) * normal.z;
          if (d0 > 0 && d1 <= 0) {
            const k = d0 / (d0 - d1);
            pv.set(ox + (s.x - ox) * k - tg.x, oy + (s.y - oy) * k - tg.cy, oz + (s.z - oz) * k - tg.z);
            const r = pv.length();
            if (r <= tg.r + 0.2) return end(s, r < tg.r * 0.33 ? 50 : r < tg.r * 0.66 ? 30 : 10, false);
          }
        }
        const w = world.waterAt(s.x, s.z);
        if (w && s.y <= w.level + 0.62) {
          for (const r of rafts) if (Math.hypot(s.x - raftX(r, t), s.z - r.z) < 0.98) return end(s, 20, false);
          if (s.y <= w.level) return end(s, 0, true);
        }
        if (s.y <= H(s.x, s.z) + 0.15) return end(s, 0, false);
        return s.age > 9 ? end(s, 0, false) : null;
      }
      function end(s, points, water) {
        s.alive = false;
        if (!s.mesh) return points || 0; // tir d'essai (simulate) : ni éclats ni bruit
        s.mesh.visible = false;
        burst(s.x, Math.max(s.y, water ? WL : -9), s.z, points ? 9 : 6, water);
        const near = ctx.active() || session.players().length > 0;
        if (near) MF.sfx.play(water ? "plouf" : points ? "pop" : "toc");
        return points || 0;
      }
      session.on("tir", (d, peer) => {
        if (!Array.isArray(d) || d.length < 6) return;
        launch(d, false);
        const c = pults.get(peer.uid);
        if (c) c.swing = 0.0001;
      });
      const scores = new Map(); // uid → points (annoncés par chacun)
      session.on("score", (d, peer) => scores.set(peer.uid, +d || 0));

      // repère de visée : pointillés de la trajectoire prévue (sans le vent)
      const dots = [];
      for (let i = 0; i < 12; i++) {
        const m = MF.sphere(0.07, MF.mat(MF.PAL.white, { basic: true }), { parent: group, seg: 5 });
        m.visible = false;
        dots.push(m);
      }
      const me = { az: 0, el: 0.78, power: 0, charging: false, dir: 1, left: 0, score: 0, cool: 0, follow: null, hold: 0 };
      let reported = false, lastBoard = 0, sway = 0, camK = 0;
      const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();

      function play(dt, t, running, st) {
        const S = input.state, P = S.pointer;
        const c = pults.get(ctx.self.uid);
        if (!c) return;
        me.az = MF.clamp(me.az + S.x * 0.6 * dt, -0.5, 0.5);
        me.el = MF.clamp(me.el + S.y * 0.5 * dt, 0.5, 1.1);
        if (P.isDown && !input.touch) me.az = MF.clamp(me.az + (P.nx - (me.pnx ?? P.nx)) * 0.9, -0.5, 0.5); // glisser pour affiner
        if (P.isDown && input.touch) me.az = MF.clamp(me.az + (P.nx - (me.pnx ?? P.nx)) * 1.2, -0.5, 0.5);
        me.pnx = P.nx;
        me.cool = Math.max(0, me.cool - dt);
        const holding = running && me.left > 0 && me.cool <= 0 && (S.a || P.isDown);
        if (holding) {
          if (!me.charging) {
            me.charging = true;
            me.power = 0;
            me.dir = 1;
          }
          // la jauge monte et redescend : tout l'art est de relâcher au bon moment
          me.power += me.dir * dt / 1.25;
          if (me.power >= 1) {
            me.power = 1;
            me.dir = -1;
          } else if (me.power <= 0.04 && me.dir < 0) me.dir = 1;
          hud.gauge(me.power, "Puissance");
        } else if (me.charging) {
          me.charging = false;
          hud.gauge(null);
          const v = speedOf(me.power), ch = Math.cos(me.el);
          const d = [c.x + Math.sin(me.az) * 0.4, c.group.position.y + 2.7, PAD.z - 1.2, Math.sin(me.az) * ch * v, Math.sin(me.el) * v, -Math.cos(me.az) * ch * v];
          me.follow = launch(d, true);
          session.send("tir", d.map((n) => Math.round(n * 1000) / 1000));
          c.swing = 0.0001;
          me.left--;
          me.cool = 1.3;
          MF.sfx.play("swing");
          if (me.left === 1) hud.flash("Dernière citrouille !", { color: MF.PAL.yellow });
        }
        // bras de ma catapulte : il recule en chargeant
        if (!c.swing) c.arm.rotation.x = -0.5 - (me.charging ? me.power * 0.45 : 0);
        c.group.rotation.y = -me.az;
        c.load.visible = me.left > 0 && me.cool <= 0.4 && !c.swing;
        // pointillés : début de la trajectoire à la puissance actuelle
        const v = speedOf(me.charging ? me.power : 0.5), ch = Math.cos(me.el);
        for (let i = 0; i < dots.length; i++) {
          const k = (i + 1) * 0.11;
          dots[i].visible = running && me.left > 0 && me.cool <= 0;
          dots[i].position.set(c.x + Math.sin(me.az) * (0.4 + ch * v * k), c.group.position.y + 2.7 + Math.sin(me.el) * v * k - 0.5 * G * k * k, PAD.z - 1.2 - Math.cos(me.az) * ch * v * k);
        }
        // caméra : derrière la catapulte ; elle accompagne un instant la citrouille en vol
        const f = me.follow;
        const flying = f && f.alive;
        if (f && !f.alive) {
          me.hold += dt;
          if (me.hold > 1.1) {
            me.follow = null;
            me.hold = 0;
          }
        }
        camK = MF.damp(camK, f ? 1 : 0, f ? 2.2 : 3, dt);
        const fx = f ? f.x : c.x, fz = f ? f.z : PAD.z, fy = f ? Math.max(f.y, Y0) : Y0;
        camPos.set(c.x - Math.sin(me.az) * 4.6 + (fx - c.x) * 0.5 * camK, Y0 + 3.3 + Math.max(0, fy - Y0) * 0.35 * camK, PAD.z + Math.cos(me.az) * 4.6 + (fz - PAD.z) * 0.55 * camK);
        camLook.set(c.x + Math.sin(me.az) * 14 + (fx - c.x - Math.sin(me.az) * 14) * camK * 0.85, Y0 + 2.2 + (fy - Y0 - 2.2) * camK * 0.7, PAD.z - 14 + (fz - PAD.z + 14) * camK * 0.85);
        MF.cam.set(camera, camPos, camLook, 55);
        void flying;
      }

      return {
        me,
        shots,
        pults,
        rafts,
        bank: BANK,
        raftX,
        speedOf,
        /** Où retomberait un tir (pour les essais) : direction, hausse, puissance, x de la catapulte, heure. */
        simulate(az, el, power, x, t) {
          const v = speedOf(power), ch = Math.cos(el);
          const s = { x: x + Math.sin(az) * 0.4, y: H(x, PAD.z) + 2.78, z: PAD.z - 1.2, vx: Math.sin(az) * ch * v, vy: Math.sin(el) * v, vz: -Math.cos(az) * ch * v, alive: true, age: 0, mesh: null };
          let pts = null;
          for (let i = 0; i < 900 && pts === null; i++) pts = fly(s, 1 / 60, t + i / 60);
          return { points: pts || 0, x: s.x, z: s.z };
        },
        enter() {
          input.use({ layout: "pointer", buttons: [{ id: "a", label: "LANCER", key: "Espace" }] });
          hud.stats([{ key: "score", label: "Score" }, { key: "left", label: "Citrouilles" }, { key: "wind", label: "Vent" }, { key: "time", label: "Temps" }]);
          hud.hint(input.touch ? "Glisse pour viser · maintiens LANCER pour charger, relâche pour tirer" : "← → viser · ↑ ↓ hausse · maintiens Espace ou le clic pour charger, relâche pour lancer");
          sway = 0;
        },
        leave() {
          for (const d of dots) d.visible = false;
          hud.gauge(null);
        },
        idle() {
          for (const [, c] of pults) {
            group.remove(c.group);
            MF.dispose(c.group);
          }
          pults.clear();
          for (const s of shots) {
            s.alive = false;
            s.mesh.visible = false;
          }
        },
        onPhase(state, prev) {
          if (state && state.phase === "countdown" && (!prev || prev.phase !== "countdown")) {
            scores.clear();
            wind = windOf(state.seed);
            reported = false;
            Object.assign(me, { az: 0, el: 0.78, power: 0, charging: false, left: state.opts.shots || 5, score: 0, cool: 0, follow: null });
            for (const s of shots) {
              s.alive = false;
              s.mesh.visible = false;
            }
          }
        },
        update(dt, time) {
          const st = session.state, phase = st ? st.phase : "lobby";
          const t = session.time();
          const running = !!st && phase === "run" && t < TIME_LIMIT;
          if (st && st.seed && phase !== "lobby") wind = windOf(st.seed);
          syncPults();
          const tt = running || phase === "countdown" ? Math.max(0, t) : time;
          for (const r of rafts) r.group.position.x = raftX(r, tt);
          sock.rotation.y = wind >= 0 ? Math.PI / 2 : -Math.PI / 2;
          sock.scale.z = 0.35 + Math.abs(wind) / 2.8;
          for (const s of shots) {
            if (!s.alive) continue;
            const pts = fly(s, dt, tt);
            if (pts === null || !s.mine) continue;
            me.score += pts;
            session.send("score", me.score);
            if (ctx.active()) hud.flash(pts >= 50 ? "Dans le mille ! +50" : pts ? "+" + pts : world.waterAt(s.x, s.z) ? "Plouf !" : "Raté…", { color: pts ? MF.PAL.yellow : "#ffffff", hold: 1.2 });
            if (pts >= 30) MF.sfx.play("bravo");
          }
          for (const b of bits) {
            if (b.life <= 0) continue;
            b.life -= dt;
            b.vy -= 12 * dt;
            b.mesh.position.x += b.vx * dt;
            b.mesh.position.y += b.vy * dt;
            b.mesh.position.z += b.vz * dt;
            if (b.life <= 0) b.mesh.visible = false;
          }
          for (const [, c] of pults) {
            // bras qui bascule d'un coup au lancer, puis revient
            if (!c.swing) continue;
            c.swing += dt;
            c.arm.rotation.x = c.swing < 0.14 ? -0.9 + (c.swing / 0.14) * 1.9 : MF.lerp(1.0, -0.5, MF.clamp((c.swing - 0.14) / 0.9, 0, 1));
            if (c.swing > 1.1) {
              c.swing = 0;
              c.arm.rotation.x = -0.5;
            }
          }
          if (!ctx.active()) return true;
          const mine = !!st && session.inRoster() && (phase === "run" || phase === "countdown");
          if (mine) {
            play(dt, t, running && !reported, st);
            hud.set("score", me.score);
            hud.set("left", me.left + " / " + (st.opts.shots || 5));
            hud.set("wind", (wind > 0.05 ? "→ " : wind < -0.05 ? "← " : "") + Math.abs(wind).toFixed(1) + " m/s");
            hud.set("time", Math.ceil(Math.max(0, TIME_LIMIT - Math.max(0, t))) + " s");
            // fini : plus de citrouilles (et la dernière est retombée), ou temps écoulé
            const flying = shots.some((s) => s.alive && s.mine);
            if (phase === "run" && !reported && ((me.left <= 0 && !flying && !me.follow) || t >= TIME_LIMIT)) {
              reported = true;
              for (const d of dots) d.visible = false;
              session.report({ score: me.score });
            }
            if (time - lastBoard > 0.3) {
              lastBoard = time;
              hud.board(st.roster.map((p) => ({ name: p.name, color: p.color, self: p.uid === ctx.self.uid, score: p.uid === ctx.self.uid ? me.score : scores.get(p.uid) || 0 })).sort((a, b) => b.score - a.score).map((r) => ({ name: r.name, color: r.color, self: r.self, text: r.score + " pts" })));
            }
          } else {
            for (const d of dots) d.visible = false;
            sway += dt;
            MF.cam.set(camera, { x: PAD.x + Math.sin(sway * 0.2) * 3.5, y: Y0 + 5.2, z: PAD.z + 8.5 }, { x: PAD.x, y: Y0 + 0.5, z: PAD.z - 14 }, 52);
          }
          return true;
        },
      };
    },
  });
})();
