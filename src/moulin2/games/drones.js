// La Fête du Moulin — course de drones en vue embarquée (FPV).
//
// 1 à 8 pilotes, 2 ou 3 tours d'un parcours de 191 m autour du moulin : onze portes (des anneaux
// tenus par des ballons) à franchir dans l'ordre — au-dessus de la cour, du bassin de la véranda, au
// ras du Grand étang, par-dessus le toit de la dépendance, puis en piqué vers l'allée. Le pilotage
// est volontairement simple : le drone tient son altitude tout seul et vise celle de la prochaine
// porte si on ne touche pas aux commandes de montée. Chacun simule son drone et l'envoie aux autres.
(function () {
  "use strict";
  const MF = globalThis.MoulinFete;

  // Portes : x, z, hauteur au-dessus du sol (ou de l'eau). Couloir vérifié sur le relevé : au moins
  // 2,5 m des bâtiments et 1,5 m des couronnes d'arbres. La porte 0 est aussi la ligne des tours.
  const GATES = [[1.5, -28, 3], [1, -18, 3.5], [13, -15, 4], [26, -6, 2.2], [22, 9, 3], [8, 24, 1.6], [-13, 27.5, 2.5], [-29, 14, 11.5], [-28, 5, 12.5], [-10, -18, 6], [0, -38, 2.6]];
  const START = { x: 9.5, z: -35, up: 2.5 }; // arche de départ, franchie vers l'ouest
  const PADS = [[11.2, -35.8], [11.2, -34.2], [13.2, -35.8], [13.2, -34.2], [11.2, -37.4], [11.2, -32.6], [13.2, -37.4], [13.2, -32.6]];
  const RING = 2.1; // rayon des anneaux (m)
  const GRACE = 30;
  const D = { vmax: 13, vback: 6, vside: 7, vclimb: 5.5, yaw: 2.5, rate: 2.3, r: 0.32 };

  function buildDrone(color, name) {
    const g = MF.group({ name: "Drone" });
    const body = MF.group({ parent: g });
    const paint = MF.mat(color, { unique: true });
    MF.box(0.2, 0.08, 0.3, paint, { parent: body, cast: true });
    MF.box(0.1, 0.06, 0.1, MF.PAL.black, { y: 0.05, z: 0.12, rx: -0.4, parent: body }); // caméra
    const props = [];
    for (const [x, z] of [[-0.26, 0.24], [0.26, 0.24], [-0.26, -0.24], [0.26, -0.24]]) {
      MF.box(0.05, 0.03, Math.hypot(x, z) * 2 * 0.52, MF.PAL.black, { x: x / 2, z: z / 2, ry: Math.atan2(x, z), parent: body });
      MF.cyl(0.035, 0.035, 0.07, MF.PAL.steel, { x, y: 0.03, z, parent: body, seg: 6 });
      const prop = MF.cyl(0.17, 0.17, 0.012, MF.mat("#dfe8ff", { opacity: 0.45 }), { x, y: 0.08, z, parent: body, seg: 10 });
      prop.userData.live = true; // les hélices tournent
      props.push(prop);
    }
    MF.sphere(0.03, MF.mat(MF.PAL.white, { basic: true }), { z: 0.17, parent: body, seg: 5 });
    MF.sphere(0.03, MF.mat(MF.PAL.red, { basic: true }), { z: -0.17, parent: body, seg: 5 });
    MF.freeze(body);
    body.scale.setScalar(1.35);
    const shadow = MF.blob(0.4, 0.3);
    g.add(shadow);
    if (name) {
      const tag = MF.tag(name, { scale: 0.42 });
      tag.position.y = 0.75;
      g.add(tag);
    }
    return { group: g, body, props, paint, shadow };
  }

  MF.registerGame({
    id: "drones",
    title: "Course de drones FPV",
    icon: "🚁",
    color: MF.PAL.teal,
    blurb: "1 à 8 pilotes · portes autour du moulin",
    station: { x: 15.2, z: -35, heading: -Math.PI / 2 },
    kiosk: { x: 15.4, z: -31.2, heading: -Math.PI / 2 },
    minPlayers: 1,
    maxPlayers: 8,
    maxTime: 300,
    options: [{ key: "laps", label: "Nombre de tours", values: [2, 3], default: 3, format: (v) => v + " tours" }],
    help: "Flèches ou ZQSD : avancer et tourner · I / K : monter, descendre · J / L : glisser de côté · Espace : turbo · E : changer de vue · C : se replacer.",
    rank: (list) => list.slice().sort((a, b) => (a.time ? 0 : 1) - (b.time ? 0 : 1) || (a.time || 0) - (b.time || 0) || (b.gates || 0) - (a.gates || 0)),
    describe: (r) => (r.time ? MF.time(r.time) : "n'a pas fini"),

    create(ctx) {
      const { world, session, hud, input, group, camera } = ctx;
      const THREE = world.THREE;
      const H = world.heightAt;
      const base = (x, z) => {
        const w = world.waterAt(x, z);
        return w ? Math.max(w.level, H(x, z)) : H(x, z);
      };
      const N = GATES.length;

      /* ---------------------------------------------------------------- portes (une fois) */
      const gates = GATES.map(([x, z, up], i) => ({ i, x, z, y: base(x, z) + up }));
      const startGate = { x: START.x, z: START.z, y: base(START.x, START.z) + START.up, nx: -1, ny: 0, nz: 0 };
      const dir = new THREE.Vector3(), q = new THREE.Quaternion(), zAxis = new THREE.Vector3(0, 0, 1);
      const deco = MF.group({ name: "Parcours_des_drones", parent: group });
      const portTex = MF.sponsors.texture("drones-portes", { w: 2.2, h: 0.5, kicker: "Porte" });
      const portMat = new THREE.MeshBasicMaterial({ map: portTex });
      function buildGate(gt, label, sponsorBoard) {
        const g = MF.group({ name: "Porte_" + label, x: gt.x, y: gt.y, z: gt.z, parent: deco });
        dir.set(gt.nx, gt.ny, gt.nz);
        g.quaternion.setFromUnitVectors(zAxis, dir);
        gt.mat = MF.mat(MF.PAL.teal, { unique: true, emissive: MF.PAL.teal, emissiveIntensity: 0.25 });
        MF.torus(RING, 0.11, gt.mat, { parent: g, seg: 28, tubeSeg: 7 });
        // bandeau du sponsor et numéro, lisibles des deux côtés ; ballons qui portent l'anneau
        for (const face of [0, Math.PI]) {
          MF.plane(2.2, 0.5, portMat, { y: RING + 0.45, z: face ? -0.02 : 0.02, ry: face, parent: g, receive: false });
          if (sponsorBoard) g.add(MF.sponsors.board("drones-arche", 3.6, 0.7, { y: RING + 1.15, z: face ? -0.02 : 0.02, ry: face, kicker: "Arche de départ des drones" }));
        }
        const num = MF.sign(label, { w: 0.6, h: 0.5, bg: MF.PAL.ink, color: "#ffffff", border: MF.PAL.yellow, double: true });
        num.position.set(RING + 0.45, 0.6, 0);
        g.add(num);
        const up = sponsorBoard ? RING + 1.7 : RING + 0.85;
        [MF.PAL.red, MF.PAL.yellow, MF.PAL.blue].forEach((c, k) => {
          const b = MF.balloon(c, 0.3);
          b.position.set((k - 1) * 0.42, up + (k === 1 ? 0.25 : 0), 0);
          g.add(b);
        });
        return g;
      }
      gates.forEach((gt, i) => {
        // l'anneau regarde dans le sens du parcours : de la porte d'avant vers la porte d'après
        const a = gates[(i + N - 1) % N], b = gates[(i + 1) % N];
        dir.set(b.x - a.x, (b.y - a.y) * 0.6, b.z - a.z).normalize();
        gt.nx = dir.x;
        gt.ny = dir.y;
        gt.nz = dir.z;
        buildGate(gt, String(i + 1), false);
      });
      buildGate(startGate, "DÉPART", true);
      // aires de décollage
      const padMat = MF.mat(MF.PAL.cream);
      PADS.forEach(([x, z], i) => {
        const y = H(x, z) + 0.04;
        MF.cyl(0.55, 0.55, 0.05, i % 2 ? MF.PAL.orange : MF.PAL.teal, { x, y, z, parent: deco, seg: 16 });
        MF.box(0.5, 0.02, 0.1, padMat, { x, y: y + 0.035, z, parent: deco });
        MF.box(0.1, 0.02, 0.5, padMat, { x: x - 0.2, y: y + 0.035, z, parent: deco });
        MF.box(0.1, 0.02, 0.5, padMat, { x: x + 0.2, y: y + 0.035, z, parent: deco });
      });
      MF.freeze(deco);
      // obstacles : arbres proches du parcours, bâtiments
      const trees = (world.trees || []).filter((t) => t.x > -48 && t.x < 42 && t.z > -52 && t.z < 42).map((t) => ({ x: t.x, z: t.z, g: H(t.x, t.z), h: t.height || 10, r: 0.22 * (t.height || 10) }));
      const solids = (world.solids || []).filter((r) => r.y1 - r.y0 > 1.5);

      /* ---------------------------------------------------------------- drones */
      let me = null; // { drone, x, y, z, vx, vy, vz, yaw, pitch, roll, next, passed, last… }
      const camState = {};
      let engine = null, finished = false, graceEnd = 0, lastBoard = 0, sway = 0, chase = false, arrow = null, crash = 0, missed = 0;
      const proj = new THREE.Vector3();

      const remotes = MF.remotes({
        session,
        size: 6,
        angles: [3, 4, 5],
        make(peer) {
          const d = buildDrone(peer.color, peer.name);
          group.add(d.group);
          return d;
        },
        apply(d, v, extra) {
          pose(d, v[0], v[1], v[2], v[3], v[4], v[5]);
          d.passed = extra ? extra[0] : 0;
          d.x = v[0];
          d.y = v[1];
          d.z = v[2];
        },
      });
      function pose(d, x, y, z, yaw, pitch, roll) {
        d.group.position.set(x, y, z);
        d.body.rotation.set(pitch, yaw, roll, "YXZ");
        for (const p of d.props) p.rotation.y += 1.9;
        d.shadow.position.y = base(x, z) - y + 0.04;
        d.shadow.visible = y - base(x, z) < 6;
      }
      function spawn(slot) {
        if (!me) {
          me = { drone: buildDrone(ctx.self.color, null) };
          group.add(me.drone.group);
        }
        me.drone.paint.color.copy(MF.color(ctx.self.color));
        const p = PADS[slot % PADS.length];
        Object.assign(me, { x: p[0], y: H(p[0], p[1]) + 0.3, z: p[1], vx: 0, vy: 0, vz: 0, yaw: -Math.PI / 2, pitch: 0, roll: 0, next: -1, passed: 0, turbo: 0, cool: 0, lap: undefined });
        camState.x = undefined;
        finished = false;
        graceEnd = 0;
        crash = 0;
      }
      function despawn() {
        if (me) {
          group.remove(me.drone.group);
          MF.dispose(me.drone.group);
          me = null;
        }
        if (engine) {
          engine.stop();
          engine = null;
        }
      }
      const target = () => (me.next < 0 ? startGate : gates[me.next]);
      /** Retour à la dernière porte franchie (ou à l'aire de départ), à l'arrêt, face à la suivante. */
      function reset() {
        const from = me.next < 0 ? null : me.passed ? gates[(me.next + N - 1) % N] : startGate;
        const to = target();
        if (from) Object.assign(me, { x: from.x + (from.nx || 0) * 1.5, y: from.y, z: from.z + (from.nz || 0) * 1.5 });
        else {
          const p = PADS[Math.max(0, session.slot()) % PADS.length];
          Object.assign(me, { x: p[0], y: H(p[0], p[1]) + 1.2, z: p[1] });
        }
        Object.assign(me, { vx: 0, vy: 0, vz: 0, yaw: Math.atan2(to.x - me.x, to.z - me.z) });
        camState.x = undefined;
        crash = 0;
        MF.sfx.play("boing");
      }
      function bump(nx, ny, nz, depth) {
        me.x += nx * depth;
        me.y += ny * depth;
        me.z += nz * depth;
        const vn = me.vx * nx + me.vy * ny + me.vz * nz;
        if (vn < 0) {
          me.vx -= 1.4 * vn * nx;
          me.vy -= 1.4 * vn * ny;
          me.vz -= 1.4 * vn * nz;
          if (vn < -3) {
            MF.sfx.play("choc");
            crash += 0.5;
          }
        }
      }
      function fly(dt, locked) {
        const S = input.state;
        const ox = me.x, oy = me.y, oz = me.z;
        const fwd = locked ? 0 : S.y, turn = locked ? 0 : S.x, side = locked ? 0 : S.x2, climb = locked ? 0 : S.y2;
        me.cool = Math.max(0, me.cool - dt);
        me.turbo = Math.max(0, me.turbo - dt);
        if (!locked && S.hit.a && me.cool <= 0) {
          me.turbo = 1.5;
          me.cool = 5;
          MF.sfx.play("swing");
        }
        me.yaw -= turn * D.yaw * dt;
        const fx = Math.sin(me.yaw), fz = Math.cos(me.yaw), rx = -fz, rz = fx;
        const vmax = D.vmax * (me.turbo > 0 ? 1.45 : 1);
        const wantF = fwd > 0 ? fwd * vmax : fwd * D.vback, wantS = side * D.vside;
        const k = 1 - Math.exp(-D.rate * dt);
        const gate = target();
        // aide discrète : à l'approche d'une porte, le drone se recentre un peu sur son axe (si on ne
        // glisse pas soi-même de côté) — à 13 m/s, un anneau de 4 m passe vite
        let ax = 0, az = 0;
        if (!locked && !side) {
          const gx = gate.x - me.x, gz = gate.z - me.z;
          const along = gx * gate.nx + gz * gate.nz; // distance qu'il reste avant le plan de la porte
          if (along > 0.5 && along < 14) {
            ax = MF.clamp((gx - gate.nx * along) * 0.9, -3, 3);
            az = MF.clamp((gz - gate.nz * along) * 0.9, -3, 3);
          }
        }
        me.vx += (fx * wantF + rx * wantS + ax - me.vx) * k;
        me.vz += (fz * wantF + rz * wantS + az - me.vz) * k;
        // altitude : aux commandes si on y touche, sinon le drone rejoint doucement la hauteur de la prochaine porte
        const wantY = climb ? climb * D.vclimb : locked ? 0 : MF.clamp((gate.y - me.y) * 0.9, -3.2, 3.2);
        me.vy += (wantY - me.vy) * (1 - Math.exp(-4 * dt));
        me.x += me.vx * dt;
        me.y += me.vy * dt;
        me.z += me.vz * dt;
        const vf = me.vx * fx + me.vz * fz, vs = me.vx * rx + me.vz * rz;
        me.pitch = MF.damp(me.pitch, (vf / D.vmax) * 0.38, 8, dt); // le nez plonge quand on avance
        me.roll = MF.damp(me.roll, -(vs / D.vside) * 0.3 - turn * 0.28 * MF.clamp(vf / D.vmax, 0, 1), 8, dt);
        me.speed = vf;
        // sol et eau
        const g = H(me.x, me.z), w = world.waterAt(me.x, me.z);
        if (w && me.y < w.level + 0.22 && g < w.level) {
          MF.sfx.play("plouf");
          hud.flash("Plouf !", { hold: 0.9 });
          return reset();
        }
        if (me.y < g + 0.25) {
          me.y = g + 0.25;
          if (me.vy < 0) me.vy *= -0.3;
        }
        // bâtiments et arbres
        for (const r of solids) {
          if (me.y > r.y1 + D.r || me.y < r.y0 - 1) continue;
          const d = MF.rectDistance(me.x, me.z, r);
          if (d >= D.r) continue;
          if (me.y > r.y1 - 0.6 && oy >= r.y1) {
            bump(0, 1, 0, r.y1 + D.r - me.y); // on se pose sur le toit
          } else {
            const e = 0.05;
            let gx = MF.rectDistance(me.x + e, me.z, r) - MF.rectDistance(me.x - e, me.z, r), gz = MF.rectDistance(me.x, me.z + e, r) - MF.rectDistance(me.x, me.z - e, r);
            const l = Math.hypot(gx, gz) || 1;
            bump(gx / l, 0, gz / l, D.r - d);
          }
        }
        for (const t of trees) {
          const dx = me.x - t.x, dz = me.z - t.z, d = Math.hypot(dx, dz);
          if (d > t.r + D.r || me.y > t.g + t.h) continue;
          const inCrown = me.y > t.g + 0.38 * t.h;
          const lim = inCrown ? t.r * 0.8 + D.r : 0.45 + D.r;
          if (d < lim && d > 1e-3) bump(dx / d, 0, dz / d, lim - d);
        }
        // la porte attendue : franchie si l'on traverse son plan à l'intérieur de l'anneau
        const d0 = (ox - gate.x) * gate.nx + (oy - gate.y) * gate.ny + (oz - gate.z) * gate.nz;
        const d1 = (me.x - gate.x) * gate.nx + (me.y - gate.y) * gate.ny + (me.z - gate.z) * gate.nz;
        if (d0 < 0 && d1 >= 0) {
          const kk = d0 / (d0 - d1);
          const off = Math.hypot(ox + (me.x - ox) * kk - gate.x, oy + (me.y - oy) * kk - gate.y, oz + (me.z - oz) * kk - gate.z);
          if (off < RING - 0.2) {
            if (me.next >= 0) me.passed++;
            me.next = (me.next + 1) % N;
            crash = 0;
            MF.sfx.play("ting");
          } else if (off < RING + 0.35) {
            bump(-gate.nx, -gate.ny, -gate.nz, 0.4); // dans le montant de l'anneau
          } else if (off < 9 && performance.now() - missed > 2500) {
            missed = performance.now();
            hud.flash("Porte manquée !", { color: MF.PAL.red, hold: 1 });
          }
        }
        for (const r of remotes.map.values()) {
          const o = r.obj;
          if (o.x === undefined) continue;
          const dx = me.x - o.x, dy = me.y - o.y, dz = me.z - o.z, d = Math.hypot(dx, dy, dz);
          if (d < D.r * 2.4 && d > 1e-3) bump(dx / d, dy / d, dz / d, (D.r * 2.4 - d) * 0.5);
        }
        crash = Math.max(0, crash - dt * 0.4);
        if (crash > 1.6 || (!locked && S.hit.c)) reset();
      }
      const progress = (passed, x, y, z, next) => {
        const g = next < 0 ? startGate : gates[next];
        return passed + (next < 0 ? -1 : 0) - Math.min(0.99, Math.hypot(g.x - x, g.y - y, g.z - z) / 60);
      };
      function ranking() {
        const rows = [], st = session.state;
        if (!st) return rows;
        for (const p of st.roster) {
          const mine = p.uid === ctx.self.uid, r = mine ? null : remotes.get(p.uid), res = st.results[p.uid];
          const prog = mine ? (me ? progress(me.passed, me.x, me.y, me.z, me.next) : -9) : r ? progress(r.obj.passed || 0, r.obj.x, r.obj.y, r.obj.z, (r.obj.passed || 0) % N) : -9;
          rows.push({ name: p.name, color: p.color, self: mine, prog, passed: mine ? (me ? me.passed : 0) : r ? r.obj.passed || 0 : 0, time: res && res.time ? res.time : 0, gone: !mine && !r && !res });
        }
        return rows.sort((a, b) => (a.time ? 0 : 1) - (b.time ? 0 : 1) || a.time - b.time || b.prog - a.prog);
      }
      function lights(time) {
        // la prochaine porte clignote en jaune, les autres restent turquoise
        const nextI = me ? me.next : -2;
        const set = (gt, on) => {
          gt.mat.color.copy(MF.color(on ? MF.PAL.yellow : MF.PAL.teal));
          gt.mat.emissive.copy(MF.color(on ? MF.PAL.yellow : MF.PAL.teal));
          gt.mat.emissiveIntensity = on ? 0.55 + Math.sin(time * 9) * 0.3 : 0.25;
        };
        set(startGate, nextI === -1);
        for (const gt of gates) set(gt, gt.i === nextI);
      }

      return {
        gates,
        startGate,
        drone: () => me,
        remotes,
        enter() {
          input.use({ layout: "dual", radio: { kicker: "RADIOCOMMANDE", brand: MF.sponsors.brand("drones-radio") }, leftLabel: "MONTER · GLISSER", rightLabel: "AVANCER · TOURNER", buttons: [{ id: "a", label: "TURBO", key: "Espace" }, { id: "b", label: "VUE", key: "E" }, { id: "c", label: "REPLACER", key: "C" }] });
          hud.stats([{ key: "lap", label: "Tour" }, { key: "gate", label: "Porte" }, { key: "time", label: "Temps" }, { key: "pos", label: "Place" }]);
          hud.hint(input.touch ? "Manche droit : avancer et tourner · manche gauche : monter et glisser" : "Flèches ou ZQSD : piloter · I / K : monter, descendre · Espace : turbo · E : vue · C : se replacer");
          arrow = hud.widget("fete-arrow");
          arrow.hidden = true;
          chase = false;
          sway = 0;
        },
        leave() {
          despawn();
          arrow = null;
          lights(0);
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
          const st = session.state, phase = st ? st.phase : "lobby";
          if (me && (phase === "countdown" || phase === "run")) {
            const t = session.time(), laps = st.opts.laps || 3;
            const total = laps * N + 1; // la porte 1 ouvre le premier tour, puis on la repasse à chaque tour
            fly(dt, phase === "countdown" || t < 0 || finished);
            if (input.state.hit.b) chase = !chase;
            pose(me.drone, me.x, me.y, me.z, me.yaw, me.pitch, me.roll);
            me.drone.group.visible = chase;
            if (!engine) engine = MF.sfx.loop("helices");
            engine.set(0.7 + Math.hypot(me.vx, me.vy, me.vz) / D.vmax * 0.7, finished ? 0.2 : 0.55);
            const lap = MF.clamp(Math.floor(Math.max(0, me.passed - 1) / N) + 1, 1, laps);
            if (!finished && phase === "run") {
              if (me.lap !== lap) {
                if (me.lap !== undefined && lap > me.lap) {
                  hud.flash(lap === laps ? "Dernier tour !" : "Tour " + lap + " / " + laps, { color: lap === laps ? MF.PAL.yellow : "#ffffff" });
                  MF.sfx.play("tour");
                }
                me.lap = lap;
              }
              if (me.passed >= total) {
                finished = true;
                const before = ranking().filter((r) => r.time).length;
                hud.flash(before ? "Arrivée ! " + (before + 1) + "ᵉ" : "Arrivée ! 1ᵉʳ", { color: MF.PAL.yellow, hold: 3 });
                session.report({ time: Math.round(t * 1000) / 1000, gates: me.passed });
              } else {
                if (!graceEnd && Object.values(st.results).some((r) => r && r.time)) {
                  graceEnd = t + GRACE;
                  hud.flash("Le premier est arrivé : encore " + GRACE + " s", { hold: 2.5 });
                }
                if (graceEnd && t > graceEnd) {
                  finished = true;
                  session.report({ dnf: true, gates: me.passed });
                }
              }
            }
            hud.set("lap", lap + " / " + laps);
            hud.set("gate", me.next < 0 ? "départ" : me.next + 1 + " / " + N);
            hud.set("time", MF.time(Math.max(0, t), 1));
            remotes.send([me.x, me.y, me.z, me.yaw, me.pitch, me.roll], [me.passed, finished ? 1 : 0]);
            lights(time);
            // caméra embarquée (ou de poursuite), qui s'incline avec le drone
            if (chase) {
              MF.cam.fov(camera, 70);
              MF.cam.chase(camera, camState, me, me.yaw, { dist: 3.2, height: 1.0, look: 2.5, up: 0.2, rate: 9, turn: 7, clear: 0.3 }, dt, H);
            } else {
              MF.cam.fov(camera, me.turbo > 0 ? 104 : 94);
              camera.position.set(me.x, me.y + 0.08, me.z);
              camera.rotation.set(-me.pitch * 0.55 + 0.06, me.yaw + Math.PI, -me.roll * 0.8, "YXZ");
            }
            // flèche vers la prochaine porte quand elle n'est pas à l'écran
            if (arrow) {
              const g = target();
              camera.updateMatrixWorld();
              proj.set(g.x, g.y, g.z).project(camera);
              const behind = proj.z > 1;
              const off = behind || Math.abs(proj.x) > 0.92 || Math.abs(proj.y) > 0.92;
              arrow.hidden = !off || finished;
              if (off) arrow.style.transform = "rotate(" + Math.atan2(-(behind ? -proj.y : proj.y), behind ? -proj.x : proj.x).toFixed(2) + "rad)";
            }
            if (time - lastBoard > 0.3) {
              lastBoard = time;
              const rows = ranking();
              hud.set("pos", rows.findIndex((r) => r.self) + 1 + " / " + rows.length);
              hud.board(rows.map((r) => ({ name: r.name, color: r.color, self: r.self, text: r.time ? MF.time(r.time, 1) : r.gone ? "–" : "porte " + r.passed })));
            }
          } else {
            if (engine) {
              engine.stop();
              engine = null;
            }
            if (arrow) arrow.hidden = true;
            if (phase === "lobby") {
              const slot = Math.max(0, session.slot());
              if (!me || me.slot !== slot) {
                spawn(slot);
                me.slot = slot;
              }
              pose(me.drone, me.x, me.y, me.z, me.yaw, 0, 0);
              me.drone.group.visible = true;
              remotes.send([me.x, me.y, me.z, me.yaw, 0, 0], [0, 0]);
            }
            lights(time);
            sway += dt;
            MF.cam.set(camera, { x: 18.2, y: H(15, -35) + 3.3, z: -35.5 + Math.sin(sway * 0.22) * 2.2 }, { x: 7, y: H(9.5, -35) + 2.6, z: -34.5 }, 55);
          }
          return true;
        },
      };
    },
  });
})();
