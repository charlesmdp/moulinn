// La Fête du Moulin — mini-golf du moulin, 9 trous.
//
// Chacun joue à son tour : sur chaque trou, tout le monde frappe son premier coup dans l'ordre de la
// partie ; ensuite c'est toujours le joueur dont la balle est la plus loin du trou qui joue. Sept
// coups au plus par trou (au-delà, on ramasse : 8). Les obstacles rappellent le moulin : roue à aubes,
// petit pont sur le bief, meules, maison du moulin, vanne, étangs, moulin à vent.
//
// Pas d'arbitre : chaque coup terminé est annoncé par le tireur (« coup » : trou, nombre de coups,
// position de repos) et chaque joueur tient le même tableau, dont il déduit à qui c'est le tour.
// Les obstacles mobiles tournent selon l'heure de la partie, la même pour tous.
(function () {
  "use strict";
  const MF = globalThis.MoulinFete;

  const LEN = 8.6, WID = 2.3, HW = WID / 2; // un trou : 8,6 × 2,3 m ; u le long (0…LEN), v en travers (−HW…HW)
  const BALL = 0.055, CUP = 0.095, MAX_STROKES = 7, VMAX = 8.5, TURN_LIMIT = 40;
  const COLS = [99.8, 109.8], ROWS = [-9.3, -6.9, -4.5, -2.1, 0.3];
  // Emplacements en serpentin : [colonne, rangée, sens] (sens 1 : on joue vers l'est ; −1 : vers l'ouest)
  const PLACES = [[0, 0, 1], [1, 0, 1], [1, 1, -1], [0, 1, -1], [0, 2, 1], [1, 2, 1], [1, 3, -1], [0, 3, -1], [0, 4, 1]];
  const HOLES = [
    { name: "L'échauffement", par: 2, tee: [0.9, 0], cup: [7.6, 0], circles: [[4.3, -0.78, 0.2], [4.3, 0.78, 0.2]] },
    { name: "Le coude", par: 2, tee: [0.9, -0.6], cup: [7.6, -0.6], walls: [[4.3, -HW, 4.3, 0.3], [6.0, HW, 7.3, 0.25]] },
    { name: "La roue à aubes", par: 3, tee: [0.9, 0], cup: [7.6, 0], wheel: { u: 4.3, v: 0, len: 0.98, w: 1.5 } },
    { name: "Le petit pont", par: 3, tee: [0.9, 0.55], cup: [7.6, -0.5], water: [[3.7, -HW, 5.0, -0.27], [3.7, 0.27, 5.0, HW]], walls: [[3.7, -0.27, 5.0, -0.27], [3.7, 0.27, 5.0, 0.27]] },
    { name: "Les meules", par: 3, tee: [0.9, 0], cup: [7.6, 0.2], circles: [[2.9, -0.4, 0.32], [4.3, 0.5, 0.32], [5.7, -0.35, 0.32], [4.3, -0.85, 0.2], [5.7, 0.8, 0.2]] },
    { name: "La maison du moulin", par: 3, tee: [0.9, -0.5], cup: [7.6, 0.4], house: [4.0, 5.3, 0.2] },
    { name: "La vanne", par: 3, tee: [0.9, 0], cup: [7.6, 0], walls: [[4.6, -HW, 4.6, -0.33], [4.6, 0.33, 4.6, HW]], gate: { u: 4.6, half: 0.33, open: 1.7, closed: 1.5 } },
    { name: "Entre deux étangs", par: 3, tee: [0.9, -0.5], cup: [7.6, 0.5], ponds: [[3.3, -0.42, 0.7], [5.5, 0.42, 0.7]] },
    { name: "Le moulin à vent", par: 4, tee: [0.9, 0.5], cup: [7.7, 0], walls: [[3.9, -HW, 3.9, -0.25], [3.9, 0.25, 3.9, HW], [5.6, -HW, 7.1, -0.32], [5.6, HW, 7.1, 0.32]], mill: { u: 3.9, half: 0.25, w: 1.15 } },
  ];
  for (const h of HOLES) {
    if (h.house) {
      // tunnel dans la porte : la maison barre le trou, sauf un couloir au milieu
      const [a, b, g] = h.house;
      h.walls = (h.walls || []).concat([[a, -HW, a, -g], [a, g, a, HW], [a, -g, b, -g], [a, g, b, g], [b, -HW, b, -g], [b, g, b, HW]]);
    }
  }
  const PAR = HOLES.map((h) => h.par);

  MF.registerGame({
    id: "golf",
    title: "Mini-golf du moulin",
    icon: "⛳",
    color: MF.PAL.green,
    blurb: "9 trous · chacun son tour",
    station: { x: 98, z: -4.5, heading: Math.PI / 2 },
    kiosk: { x: 98.4, z: -9.6, heading: Math.PI / 2 },
    minPlayers: 1,
    maxPlayers: 8,
    maxTime: 1500,
    options: [{ key: "holes", label: "Parcours", values: [9, 3], default: 9, format: (v) => (v === 9 ? "9 trous" : "3 trous (rapide)") }],
    help: "Tire en arrière depuis la balle comme un lance-pierre, puis relâche (ou ← → pour viser, maintiens Espace pour doser). Le plus loin du trou joue toujours le premier.",
    rank: (list) => list.slice().sort((a, b) => (a.strokes ? 0 : 1) - (b.strokes ? 0 : 1) || (a.strokes || 0) - (b.strokes || 0) || (a.name < b.name ? -1 : 1)),
    describe: (r, opts) => {
      if (!r.strokes) return "n'a pas fini";
      const par = PAR.slice(0, (opts && opts.holes) || 9).reduce((a, b) => a + b, 0), d = r.strokes - par;
      return r.strokes + " coups (" + (d > 0 ? "+" + d : d === 0 ? "par" : d) + ")";
    },

    create(ctx) {
      const { world, session, hud, input, group, camera } = ctx;
      const THREE = world.THREE;

      /* ---------------------------------------------------------------- les neuf trous (une fois) */
      const felt = MF.mat("#35a852"), wood = MF.mat(MF.PAL.wood), stone = MF.mat("#b9b3a6"), blue = MF.mat("#3fa9f5");
      const holes = HOLES.map((def, i) => {
        const [c, r, dir] = PLACES[i];
        const ox = dir > 0 ? COLS[c] : COLS[c] + LEN, oz = ROWS[r];
        const cx = COLS[c] + LEN / 2;
        let y = 0;
        for (const dx of [0, LEN / 2, LEN]) for (const dz of [-HW, HW]) y = Math.max(y, world.heightAt(COLS[c] + dx, oz + dz));
        y += 0.12;
        const h = Object.assign({ i, ox, oz, dir, y, cx }, def);
        // du repère du trou (u, v) au monde
        h.X = (u) => ox + dir * u;
        h.Z = (v) => oz + dir * v;
        const g = MF.group({ name: "Trou_" + (i + 1), parent: group });
        MF.box(LEN + 0.24, 0.5, WID + 0.24, wood, { x: cx, y: y - 0.26, z: oz, parent: g, cast: true });
        MF.box(LEN, 0.02, WID, felt, { x: cx, y: y, z: oz, parent: g });
        const beam = (u0, v0, u1, v1, hgt = 0.1, mat = wood) => {
          const len = Math.hypot(u1 - u0, v1 - v0);
          MF.box(len + 0.07, hgt, 0.07, mat, { x: h.X((u0 + u1) / 2), y: y + hgt / 2, z: h.Z((v0 + v1) / 2), ry: -Math.atan2(dir * (v1 - v0), dir * (u1 - u0)), parent: g });
        };
        beam(0, -HW, LEN, -HW);
        beam(0, HW, LEN, HW);
        beam(0, -HW, 0, HW);
        beam(LEN, -HW, LEN, HW);
        for (const w of def.house ? [] : def.walls || []) beam(w[0], w[1], w[2], w[3]);
        for (const cc of def.circles || []) {
          MF.cyl(cc[2], cc[2], 0.16, stone, { x: h.X(cc[0]), y: y + 0.08, z: h.Z(cc[1]), parent: g, seg: 14 });
          MF.cyl(cc[2] * 0.25, cc[2] * 0.25, 0.17, MF.PAL.woodDark, { x: h.X(cc[0]), y: y + 0.085, z: h.Z(cc[1]), parent: g, seg: 8 });
        }
        for (const w of def.water || []) MF.box(w[2] - w[0], 0.012, w[3] - w[1], blue, { x: h.X((w[0] + w[2]) / 2), y: y + 0.012, z: h.Z((w[1] + w[3]) / 2), parent: g });
        if (def.water) MF.box(1.42, 0.05, 0.6, wood, { x: h.X(4.35), y: y + 0.03, z: h.Z(0), parent: g }); // tablier du petit pont
        for (const p of def.ponds || []) MF.cyl(p[2], p[2], 0.012, blue, { x: h.X(p[0]), y: y + 0.014, z: h.Z(p[1]), parent: g, seg: 20 });
        if (def.wheel) {
          // roue à aubes couchée : un moyeu et une grande pale double qui balaie le passage
          h.wheelMesh = MF.group({ x: h.X(def.wheel.u), y: y + 0.01, z: h.Z(def.wheel.v), parent: g });
          MF.box(def.wheel.len * 2, 0.13, 0.07, MF.PAL.woodDark, { y: 0.08, parent: h.wheelMesh });
          MF.box(0.07, 0.13, 0.5, MF.PAL.woodDark, { y: 0.08, parent: h.wheelMesh });
          MF.cyl(0.13, 0.13, 0.2, MF.PAL.red, { x: h.X(def.wheel.u), y: y + 0.1, z: h.Z(def.wheel.v), parent: g, seg: 10 });
        }
        if (def.house) {
          const [a, b, gap] = def.house, mid = (a + b) / 2, hx = h.X(mid);
          for (const side of [-1, 1]) MF.box(b - a, 0.62, HW - gap, MF.PAL.cream, { x: hx, y: y + 0.31, z: h.Z(side * (gap + (HW - gap) / 2)), parent: g, cast: true });
          MF.box(b - a, 0.36, gap * 2, MF.PAL.cream, { x: hx, y: y + 0.44, z: oz, parent: g });
          MF.box(b - a + 0.12, 0.05, WID + 0.1, "#55606e", { x: hx, y: y + 0.66, z: oz, parent: g });
          MF.cone(0.9, 0.55, "#55606e", { x: hx, y: y + 0.94, z: oz, ry: Math.PI / 4, seg: 4, parent: g }).scale.set(1, 1, 1.25);
        }
        if (def.gate) {
          for (const side of [-1, 1]) MF.box(0.09, 0.55, 0.09, MF.PAL.woodDark, { x: h.X(def.gate.u), y: y + 0.27, z: h.Z(side * (def.gate.half + 0.04)), parent: g });
          MF.box(0.09, 0.08, def.gate.half * 2 + 0.26, MF.PAL.woodDark, { x: h.X(def.gate.u), y: y + 0.58, z: oz, parent: g });
          h.gateMesh = MF.box(0.05, 0.3, def.gate.half * 2, MF.PAL.red, { x: h.X(def.gate.u), y: y + 0.15, z: oz, parent: g });
        }
        if (def.mill) {
          // moulin à vent : une tour à cheval sur le passage, quatre ailes qui passent devant
          const mx = h.X(def.mill.u);
          for (const side of [-1, 1]) MF.box(0.2, 0.42, 0.14, MF.PAL.cream, { x: mx, y: y + 0.21, z: h.Z(side * (def.mill.half + 0.08)), parent: g });
          MF.cyl(0.2, 0.36, 0.95, MF.PAL.cream, { x: mx, y: y + 0.88, z: oz, parent: g, seg: 10, cast: true });
          MF.cone(0.3, 0.3, MF.PAL.red, { x: mx, y: y + 1.5, z: oz, parent: g, seg: 10 });
          h.millMesh = MF.group({ x: h.X(def.mill.u - 0.26), y: y + 0.98, z: oz, parent: g });
          for (let k = 0; k < 4; k++) {
            const arm = MF.group({ rx: (k * Math.PI) / 2, parent: h.millMesh });
            MF.box(0.03, 0.9, 0.17, MF.PAL.white, { y: -0.5, parent: arm });
          }
        }
        // trou, drapeau, départ, panneau, bâche du sponsor
        MF.cyl(CUP, CUP, 0.012, MF.PAL.black, { x: h.X(def.cup[0]), y: y + 0.014, z: h.Z(def.cup[1]), parent: g, seg: 14 });
        MF.cyl(0.012, 0.012, 0.75, MF.PAL.white, { x: h.X(def.cup[0]), y: y + 0.38, z: h.Z(def.cup[1]), parent: g, seg: 5 });
        MF.box(0.24, 0.15, 0.01, i === 8 ? MF.PAL.yellow : MF.PAL.red, { x: h.X(def.cup[0]) + 0.12, y: y + 0.68, z: h.Z(def.cup[1]), parent: g });
        MF.cyl(0.11, 0.11, 0.008, MF.PAL.white, { x: h.X(def.tee[0]), y: y + 0.013, z: h.Z(def.tee[1]), parent: g, seg: 12 });
        const sign = MF.sign(i + 1 + " · par " + def.par, { w: 0.9, h: 0.3, bg: MF.PAL.green, color: "#ffffff", border: "#ffffff", double: true });
        sign.position.set(h.X(-0.25), y + 0.75, oz);
        sign.rotation.y = Math.PI / 2;
        g.add(sign);
        MF.cyl(0.025, 0.025, 0.7, MF.PAL.woodDark, { x: h.X(-0.25), y: y + 0.3, z: oz, parent: g, seg: 5 });
        const sp = MF.sponsors.banner("golf-" + (i + 1), 1.8, 0.42, { lift: 0.5 });
        sp.position.set(h.X(LEN + 0.42), y - 0.3, oz);
        sp.rotation.y = Math.PI / 2;
        g.add(sp);
        return h;
      });

      /* ---------------------------------------------------------------- physique d'un trou */
      /** Segments fixes et mobiles du trou à l'instant t : [u0, v0, u1, v1, pivot u, pivot v, vitesse de rotation]. */
      const segs = [];
      function wallsAt(h, t) {
        segs.length = 0;
        segs.push([0, -HW, LEN, -HW], [0, HW, LEN, HW], [0, -HW, 0, HW], [LEN, -HW, LEN, HW]);
        for (const w of h.walls || []) segs.push(w);
        if (h.wheel) {
          const a = t * h.wheel.w, c = Math.cos(a) * h.wheel.len, s = Math.sin(a) * h.wheel.len;
          segs.push([h.wheel.u - c, h.wheel.v - s, h.wheel.u + c, h.wheel.v + s, h.wheel.u, h.wheel.v, h.wheel.w]);
        }
        if (h.gate && !gateOpen(h, t)) segs.push([h.gate.u, -h.gate.half, h.gate.u, h.gate.half]);
        if (h.mill && millBlocked(h, t)) segs.push([h.mill.u, -h.mill.half, h.mill.u, h.mill.half]);
        return segs;
      }
      const gateOpen = (h, t) => t % (h.gate.open + h.gate.closed) < h.gate.open;
      // une aile passe devant le passage quand elle pointe vers le bas (quatre ailes : quatre fois par tour)
      const millBlocked = (h, t) => Math.cos(4 * t * h.mill.w) > 0.25;
      /** Fait rouler une balle { u, v, vu, vv } pendant dt. Renvoie "water", "holed", "rest" ou null (elle roule encore). */
      function roll(h, b, dt, t) {
        const steps = Math.max(1, Math.ceil((Math.hypot(b.vu, b.vv) * dt) / 0.03));
        const sdt = dt / steps;
        for (let n = 0; n < steps; n++) {
          b.u += b.vu * sdt;
          b.v += b.vv * sdt;
          for (const s of wallsAt(h, t)) {
            const eu = s[2] - s[0], ev = s[3] - s[1], l2 = eu * eu + ev * ev;
            const k = MF.clamp(((b.u - s[0]) * eu + (b.v - s[1]) * ev) / l2, 0, 1);
            const pu = s[0] + eu * k, pv = s[1] + ev * k;
            let nu = b.u - pu, nv = b.v - pv;
            const d = Math.hypot(nu, nv);
            if (d >= BALL + 0.03 || d < 1e-6) continue;
            nu /= d;
            nv /= d;
            b.u = pu + nu * (BALL + 0.03);
            b.v = pv + nv * (BALL + 0.03);
            // paroi mobile (pale de la roue) : on rebondit par rapport à sa vitesse au point de contact
            const su = s.length > 4 ? -s[6] * (pv - s[5]) : 0, sv = s.length > 4 ? s[6] * (pu - s[4]) : 0;
            const vn = (b.vu - su) * nu + (b.vv - sv) * nv;
            if (vn < 0) {
              b.vu -= 1.72 * vn * nu;
              b.vv -= 1.72 * vn * nv;
              b.hit = true;
            }
          }
          for (const c of h.circles || []) {
            let nu = b.u - c[0], nv = b.v - c[1];
            const d = Math.hypot(nu, nv), lim = c[2] + BALL;
            if (d >= lim || d < 1e-6) continue;
            nu /= d;
            nv /= d;
            b.u = c[0] + nu * lim;
            b.v = c[1] + nv * lim;
            const vn = b.vu * nu + b.vv * nv;
            if (vn < 0) {
              b.vu -= 1.85 * vn * nu;
              b.vv -= 1.85 * vn * nv;
              b.hit = true;
            }
          }
          for (const w of h.water || []) if (b.u > w[0] && b.u < w[2] && b.v > w[1] && b.v < w[3]) return "water";
          for (const p of h.ponds || []) if (Math.hypot(b.u - p[0], b.v - p[1]) < p[2]) return "water";
          const speed = Math.hypot(b.vu, b.vv);
          const dc = Math.hypot(b.u - h.cup[0], b.v - h.cup[1]);
          if (dc < CUP) {
            if (speed < 2.4) return "holed";
            // trop vite : la balle fait le tour du trou et ressort
            b.vu += ((h.cup[0] - b.u) / (dc || 1)) * 4 * sdt * speed;
            b.vv += ((h.cup[1] - b.v) / (dc || 1)) * 4 * sdt * speed;
          }
          // le feutre freine la balle
          const slow = (1.5 + speed * 0.28) * sdt;
          if (speed <= slow) {
            b.vu = b.vv = 0;
            return "rest";
          }
          b.vu -= (b.vu / speed) * slow;
          b.vv -= (b.vv / speed) * slow;
        }
        return null;
      }

      /* ---------------------------------------------------------------- le tableau de la partie */
      // table : uid → { strokes: [coups par trou], u, v, done (trou en cours terminé), gone (joueur parti) }
      const table = new Map();
      let hole = 0, nHoles = 9, holeEnd = 0, turnSince = 0, turnOf = null, reported = false;
      function resetTable(st) {
        table.clear();
        nHoles = (st.opts && st.opts.holes) || 9;
        hole = 0;
        holeEnd = 0;
        reported = false;
        for (const p of st.roster) table.set(p.uid, { strokes: new Array(nHoles).fill(0), u: HOLES[0].tee[0], v: HOLES[0].tee[1], done: false, gone: false });
      }
      const total = (e) => e.strokes.reduce((a, b) => a + b, 0);
      /** À qui le tour ? D'abord ceux qui n'ont pas encore joué ce trou (dans l'ordre de la partie), puis le plus loin du trou. */
      function whoPlays(st) {
        if (!st || hole >= nHoles || holeEnd) return null;
        const h = HOLES[hole];
        let best = null, bd = -1;
        for (const p of st.roster) {
          const e = table.get(p.uid);
          if (!e || e.done || e.gone) continue;
          if (!e.strokes[hole]) return p.uid;
          const d = Math.hypot(e.u - h.cup[0], e.v - h.cup[1]);
          if (d > bd + 1e-6) {
            bd = d;
            best = p.uid;
          }
        }
        return best;
      }
      function afterChange(st) {
        // tout le monde a fini le trou ? on souffle un instant, puis on passe au suivant
        if (hole < nHoles && !holeEnd && [...table.values()].every((e) => e.done || e.gone)) holeEnd = session.time() + 0.001;
        const who = whoPlays(st);
        if (who !== turnOf) {
          turnOf = who;
          turnSince = session.time();
          if (who === ctx.self.uid && ctx.active()) {
            hud.flash("À toi de jouer !", { color: MF.PAL.yellow, hold: 1.2 });
            MF.sfx.play("ting");
          }
        }
      }
      function applyStroke(uid, d, st) {
        const e = table.get(uid);
        if (!e || d.h !== hole || e.done) return;
        e.strokes[hole] = MF.clamp(+d.n || 1, 1, MAX_STROKES + 1);
        e.u = MF.clamp(+d.u || 0, 0, LEN);
        e.v = MF.clamp(+d.v || 0, -HW, HW);
        if (d.holed) e.done = true;
        else if (e.strokes[hole] >= MAX_STROKES) {
          e.strokes[hole] = MAX_STROKES + 1; // on ramasse
          e.done = true;
        }
        afterChange(st);
      }
      session.on("coup", (d, peer) => d && applyStroke(peer.uid, d, session.state));
      session.on("passe", (d) => {
        // l'hôte fait passer le tour d'un joueur trop lent (trou abandonné) ou parti (partie abandonnée)
        const e = d && table.get(d.uid);
        if (!e || d.h !== hole) return;
        if (d.gone) e.gone = true;
        else {
          e.strokes[hole] = MAX_STROKES + 1;
          e.done = true;
        }
        afterChange(session.state);
      });
      session.on("table?", (d, peer) => {
        if (session.inRoster() && table.size) session.sendTo(peer.uid, "table", { hole, n: nHoles, t: [...table].map(([uid, e]) => [uid, e.strokes, e.u, e.v, e.done ? 1 : 0, e.gone ? 1 : 0]) });
      });
      session.on("table", (d) => {
        if (!d || !Array.isArray(d.t) || (table.size && session.inRoster())) return;
        table.clear();
        hole = d.hole;
        nHoles = d.n;
        holeEnd = 0;
        for (const r of d.t) table.set(r[0], { strokes: r[1], u: r[2], v: r[3], done: !!r[4], gone: !!r[5] });
        afterChange(session.state);
      });

      /* ---------------------------------------------------------------- balles, visée */
      const balls = new Map(); // uid → maillage
      function ballOf(p) {
        let m = balls.get(p.uid);
        if (!m) {
          m = MF.sphere(BALL * 1.35, MF.mat(p.color), { parent: group, seg: 10, cast: true });
          balls.set(p.uid, m);
        }
        return m;
      }
      function clearBalls() {
        for (const m of balls.values()) {
          group.remove(m);
          m.geometry.dispose();
        }
        balls.clear();
      }
      const remotes = MF.remotes({
        session,
        size: 2,
        delay: 0.1,
        timeout: 1.2,
        make: () => ({}),
        apply(o, v) {
          o.u = v[0];
          o.v = v[1];
        },
        remove() {},
      });
      const arrowG = MF.group({ name: "Visee", parent: group });
      const shaft = MF.box(0.05, 0.02, 1, MF.mat(MF.PAL.yellow, { basic: true }), { z: 0.5, parent: arrowG });
      const tip = MF.cone(0.11, 0.24, MF.mat(MF.PAL.yellow, { basic: true }), { rx: Math.PI / 2, parent: arrowG, seg: 8 });
      arrowG.visible = false;
      const my = { rolling: null, aim: 0, power: 0, charging: false, dir: 1, drag: false, strokesShown: -1 };
      const ray = { o: new THREE.Vector3(), d: new THREE.Vector3() };
      const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), camTo = new THREE.Vector3(), lookTo = new THREE.Vector3();
      let sway = 0, lastBoard = 0, askAt = 0, snap = true;
      /** Point du plateau sous le pointeur, dans le repère du trou. */
      function pointerUV(h, P, out) {
        ray.o.copy(camera.position);
        ray.d.set(P.nx, P.ny, 0.5).unproject(camera).sub(ray.o).normalize();
        const k = (h.y - ray.o.y) / (ray.d.y || -1e-6);
        out.u = (ray.o.x + ray.d.x * k - h.ox) * h.dir;
        out.v = (ray.o.z + ray.d.z * k - h.oz) * h.dir;
        return k > 0;
      }
      const p0 = { u: 0, v: 0 }, p1 = { u: 0, v: 0 };
      function shoot(h, e, angle, power) {
        const v = 0.6 + power * (VMAX - 0.6);
        my.rolling = { u: e.u, v: e.v, vu: Math.cos(angle) * v, vv: Math.sin(angle) * v, fromU: e.u, fromV: e.v, n: e.strokes[hole] + 1 };
        MF.sfx.play("swing");
      }
      function myTurn(dt, h, e, st) {
        const S = input.state, P = S.pointer;
        // viser : lance-pierre au pointeur (on tire en arrière depuis la balle), ou flèches + Espace
        if (S.x) my.aim += S.x * 1.5 * dt; // la caméra est derrière la balle : la droite de l'écran est vers +v
        if (P.down && pointerUV(h, P, p0)) my.drag = true;
        if (my.drag && P.isDown && pointerUV(h, P, p1)) {
          const du = p0.u - p1.u, dv = p0.v - p1.v, len = Math.hypot(du, dv);
          if (len > 0.08) {
            my.aim = Math.atan2(dv, du);
            my.power = MF.clamp(len / 2.4, 0, 1);
          } else my.power = 0;
        }
        if (my.drag && P.up) {
          my.drag = false;
          if (my.power > 0.05) shoot(h, e, my.aim, my.power);
          my.power = 0;
        }
        if (S.a && !my.drag) {
          if (!my.charging) {
            my.charging = true;
            my.power = 0;
            my.dir = 1;
          }
          my.power += (my.dir * dt) / 1.1;
          if (my.power >= 1) {
            my.power = 1;
            my.dir = -1;
          } else if (my.power <= 0.03 && my.dir < 0) my.dir = 1;
        } else if (my.charging) {
          my.charging = false;
          shoot(h, e, my.aim, my.power);
          my.power = 0;
        }
        hud.gauge(my.drag || my.charging ? my.power : null, "Puissance");
        // flèche de visée posée sur le feutre
        const len = 0.5 + (my.drag || my.charging ? my.power : 0.35) * 1.6;
        arrowG.visible = !my.rolling;
        arrowG.position.set(h.X(e.u), h.y + 0.03, h.Z(e.v));
        arrowG.rotation.y = Math.atan2(h.dir * Math.cos(my.aim), h.dir * Math.sin(my.aim));
        shaft.scale.z = len;
        shaft.position.z = 0.1 + len / 2;
        tip.position.z = 0.1 + len + 0.1;
      }
      function verdict(n, par) {
        const d = n - par;
        return n === 1 ? "Trou en un !" : d <= -2 ? "Eagle !" : d === -1 ? "Birdie !" : d === 0 ? "Par" : d === 1 ? "Bogey" : n + " coups";
      }

      return {
        holes,
        table,
        state: () => ({ hole, turnOf, holeEnd: !!holeEnd, rolling: !!my.rolling }),
        my,
        roll,
        enter() {
          input.use({ layout: "pointer", buttons: [{ id: "a", label: "FRAPPER", key: "Espace" }] });
          hud.stats([{ key: "hole", label: "Trou" }, { key: "par", label: "Par" }, { key: "n", label: "Coups" }, { key: "tot", label: "Total" }]);
          sway = 0;
          snap = true;
        },
        leave() {
          arrowG.visible = false;
          hud.gauge(null);
          my.rolling = null;
        },
        idle() {
          clearBalls();
          table.clear();
          remotes.clear();
        },
        onPhase(state, prev) {
          if (state && state.phase === "countdown" && (!prev || prev.phase !== "countdown")) {
            resetTable(state);
            clearBalls();
            Object.assign(my, { rolling: null, aim: 0, power: 0, charging: false, drag: false });
            turnOf = null;
            snap = true;
            afterChange(state);
          } else if (state && state.phase === "lobby") {
            clearBalls();
            table.clear();
          }
        },
        update(dt, time) {
          remotes.update();
          const st = session.state, phase = st ? st.phase : "lobby";
          const t = Math.max(0, session.time());
          const playing = !!st && (phase === "run" || phase === "countdown") && table.size > 0;
          // obstacles mobiles : à l'heure de la partie (ou à l'heure locale quand personne ne joue)
          const clock = playing ? t : time;
          for (const h of holes) {
            if (h.wheelMesh) h.wheelMesh.rotation.y = -clock * h.wheel.w;
            if (h.gateMesh) h.gateMesh.position.y = MF.damp(h.gateMesh.position.y, h.y + (gateOpen(h, clock) ? 0.5 : 0.15), 14, dt);
            if (h.millMesh) h.millMesh.rotation.x = clock * h.mill.w;
          }
          // spectateur arrivé en cours de partie : il demande le tableau
          if (ctx.active() && st && phase === "run" && !table.size && time - askAt > 2) {
            askAt = time;
            session.send("table?", 1);
          }
          if (!playing) {
            arrowG.visible = false;
            if (ctx.active()) {
              sway += dt;
              MF.cam.set(camera, { x: 96.2, y: world.heightAt(98, -4.5) + 6.8, z: -4.5 + Math.sin(sway * 0.2) * 2 }, { x: 108, y: 1.2, z: -4.5 }, 55);
            }
            return true;
          }
          // passage au trou suivant, fin de partie
          if (holeEnd && session.time() - holeEnd > 2.4) {
            holeEnd = 0;
            hole++;
            snap = true;
            if (hole < nHoles) {
              for (const e of table.values()) {
                e.u = HOLES[hole].tee[0];
                e.v = HOLES[hole].tee[1];
                e.done = false;
              }
              my.aim = 0;
            }
            turnOf = null;
            afterChange(st);
          }
          const mine = session.inRoster() && table.get(ctx.self.uid);
          if (hole >= nHoles) {
            if (mine && !reported && phase === "run") {
              reported = true;
              session.report({ strokes: total(mine), holes: mine.strokes });
            }
            arrowG.visible = false;
            return true;
          }
          const h = holes[hole];
          const myGo = mine && phase === "run" && turnOf === ctx.self.uid && !holeEnd;
          // ma balle roule : je la simule, je la montre aux autres, puis j'annonce le coup
          if (my.rolling) {
            const b = my.rolling;
            b.hit = false;
            const res = roll(h, b, dt, t);
            if (b.hit) MF.sfx.play("toc");
            remotes.send([b.u, b.v], hole);
            if (res) {
              const water = res === "water";
              const d = { h: hole, n: b.n + (water ? 1 : 0), u: water ? b.fromU : b.u, v: water ? b.fromV : b.v, holed: res === "holed" };
              my.rolling = null;
              session.send("coup", d);
              applyStroke(ctx.self.uid, d, st);
              if (water) {
                hud.flash("Plouf ! +1 coup", { color: "#8fd3ff", hold: 1.4 });
                MF.sfx.play("plouf");
              } else if (d.holed) {
                hud.flash(verdict(d.n, h.par), { color: MF.PAL.yellow, hold: 2 });
                MF.sfx.play("trou");
              } else if (d.n >= MAX_STROKES) hud.flash("Sept coups : on ramasse", { hold: 1.6 });
            }
          } else if (myGo) myTurn(dt, h, mine, st);
          else arrowG.visible = false;
          if (!myGo || my.rolling) hud.gauge(null);
          // l'hôte veille : un joueur parti ou trop lent ne bloque pas les autres
          if (session.isHost() && turnOf && !holeEnd && phase === "run") {
            const here = session.players().some((p) => p.uid === turnOf);
            const wait = session.time() - turnSince;
            if ((!here && wait > 3) || wait > TURN_LIMIT) {
              const d = { uid: turnOf, h: hole, gone: !here };
              turnSince = session.time();
              session.send("passe", d);
              const e = table.get(turnOf);
              if (e) {
                if (d.gone) e.gone = true;
                else {
                  e.strokes[hole] = MAX_STROKES + 1;
                  e.done = true;
                }
                afterChange(st);
              }
            }
          }
          // les balles
          for (const p of st.roster) {
            const e = table.get(p.uid);
            if (!e) continue;
            const m = ballOf(p);
            const r = p.uid === ctx.self.uid ? my.rolling : remotes.get(p.uid) && remotes.get(p.uid).obj.u !== undefined ? remotes.get(p.uid).obj : null;
            const u = r ? r.u : e.u, v = r ? r.v : e.v;
            m.visible = !e.gone && (!e.done || !!r); // rentrée ou ramassée : la balle n'est plus sur le feutre
            m.position.set(h.X(u), h.y + BALL * 1.35 + 0.01, h.Z(v));
          }
          if (!ctx.active()) return true;

          // caméra : derrière ma balle quand je vise, vue d'ensemble du trou sinon
          const e = mine || null;
          if (myGo && e && !my.rolling) {
            const du = h.cup[0] - e.u, dv = h.cup[1] - e.v, l = Math.hypot(du, dv) || 1;
            camTo.set(h.X(e.u - (du / l) * 2.7), h.y + 2.1, h.Z(e.v - (dv / l) * 2.7));
            lookTo.set(h.X(e.u + (du / l) * 2.2), h.y, h.Z(e.v + (dv / l) * 2.2));
          } else {
            camTo.set(h.cx, h.y + 7.4, h.oz + 4.4);
            lookTo.set(h.cx, h.y, h.oz - 0.2);
          }
          if (snap) {
            camPos.copy(camTo);
            camLook.copy(lookTo);
            snap = false;
          } else {
            const k = 1 - Math.exp(-3.2 * dt);
            camPos.lerp(camTo, k);
            camLook.lerp(lookTo, k);
          }
          MF.cam.set(camera, camPos, camLook, 50);
          camera.updateMatrixWorld();
          hud.set("hole", hole + 1 + " / " + nHoles);
          hud.set("par", h.par);
          hud.set("n", e ? e.strokes[hole] : "–");
          hud.set("tot", e ? total(e) : "–");
          const who = st.roster.find((p) => p.uid === turnOf);
          const left = Math.ceil(TURN_LIMIT - (session.time() - turnSince));
          hud.hint(holeEnd ? "Trou terminé : " + h.name : myGo ? (my.rolling ? "" : (input.touch ? "Tire en arrière depuis la balle, relâche pour frapper" : "Tire en arrière à la souris et relâche · ou ← → et Espace maintenu") + (left <= 15 ? " · encore " + left + " s" : "")) : who ? who.name + " joue…" : "");
          if (time - lastBoard > 0.4) {
            lastBoard = time;
            hud.board(st.roster.map((p) => ({ p, e: table.get(p.uid) })).filter((r) => r.e).sort((a, b) => total(a.e) - total(b.e)).map((r) => ({ name: r.p.name, color: r.p.color, self: r.p.uid === ctx.self.uid, text: r.e.gone ? "parti" : total(r.e) + (r.p.uid === turnOf ? " ●" : "") })));
          }
          return true;
        },
      };
    },
  });
})();
