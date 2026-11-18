// La Fête du Moulin — pêche aux canards.
//
// 75 secondes pour pêcher le plus de points. Les canards tournent dans un bassin gonflable, un anneau
// sur la tête ; la valeur de chacun est cachée dessous (1, 2, 3 ou 5 points ; le canard doré vaut 10 ;
// la vieille chaussure en coûte 3). On promène le bout de sa canne au-dessus de l'eau et on plonge
// l'hameçon dans un anneau — mais l'hameçon se balance au bout du fil dès qu'on bouge trop vite.
// Les canards sont les mêmes pour tous : leur ronde se déduit de la graine et de l'heure de la partie,
// et un canard accroché est « réclamé » (session.claim) : il disparaît chez tout le monde, puis revient
// six secondes plus tard.
(function () {
  "use strict";
  const MF = globalThis.MoulinFete;

  const BX = 66, BZ = -3; // centre du bassin
  const R = 2.6; // rayon du bassin (m)
  const DURATION = 75, RESPAWN = 6;
  const DUCKS = 15;
  const LANES = [1.05, 1.5, 1.95]; // rayons des trois rondes
  const CATCH = 0.105; // distance hameçon-anneau pour accrocher (m)

  /** Ce que cache le canard i à sa génération g : { kind: "duck" | "gold" | "shoe", value }. */
  function prize(seed, i, g) {
    const h = MF.hash(seed + ":" + i + ":" + g) % 100;
    if (h < 6) return { kind: "gold", value: 10 };
    if (h < 15) return { kind: "shoe", value: -3 };
    return { kind: "duck", value: h < 45 ? 1 : h < 72 ? 2 : h < 90 ? 3 : 5 };
  }
  const KIND = { duck: 0, gold: 1, shoe: 2 };

  function buildDuck() {
    const g = MF.group({ name: "Canard" });
    const paint = MF.mat(MF.PAL.yellow, { unique: true });
    const duck = MF.group({ parent: g });
    MF.sphere(0.15, paint, { y: 0.07, parent: duck, seg: 10 }).scale.set(1, 0.72, 1.25);
    MF.sphere(0.085, paint, { y: 0.2, z: 0.1, parent: duck, seg: 8 });
    MF.cone(0.04, 0.09, MF.PAL.orange, { y: 0.19, z: 0.2, rx: Math.PI / 2, parent: duck, seg: 6 });
    MF.cone(0.07, 0.14, paint, { y: 0.12, z: -0.19, rx: -1.1, parent: duck, seg: 6 });
    const shoe = MF.group({ parent: g });
    MF.box(0.14, 0.1, 0.34, "#6e4520", { y: 0.03, parent: shoe });
    MF.box(0.13, 0.2, 0.13, "#6e4520", { y: 0.14, z: -0.1, parent: shoe });
    const ring = MF.torus(0.065, 0.014, MF.PAL.white, { y: 0.33, z: 0.1, parent: g, seg: 12, tubeSeg: 5 });
    MF.freeze(duck);
    MF.freeze(shoe);
    return { group: g, duck, shoe, paint, ring };
  }
  /** Canne : une tige de la berge au bout, un fil, un hameçon ; le tout orienté à chaque image. */
  function buildRod(color) {
    const g = MF.group({ name: "Canne_a_peche" });
    const rod = MF.cyl(0.012, 0.022, 1, MF.mat(color), { parent: g, seg: 6 });
    const line = MF.cyl(0.004, 0.004, 1, MF.PAL.white, { parent: g, seg: 4 });
    const hook = MF.torus(0.035, 0.01, MF.PAL.steel, { parent: g, seg: 10, tubeSeg: 4 });
    const carried = buildDuck();
    carried.group.visible = false;
    carried.ring.visible = false;
    g.add(carried.group);
    return { group: g, rod, line, hook, carried };
  }

  MF.registerGame({
    id: "canards",
    title: "Hook-a-Duck",
    icon: "🦆",
    color: MF.PAL.yellow,
    blurb: "75 seconds · harder than it looks",
    station: { x: BX, z: BZ - 4.5, heading: 0 },
    kiosk: { x: BX - 4.4, z: BZ - 3.4, heading: 0 },
    minPlayers: 1,
    maxPlayers: 8,
    maxTime: DURATION + 20,
    help: "Move the rod with the mouse (or arrows), hold the click or Space to dip the hook into a ring. Gently: the line swings!",
    rank: (list) => list.slice().sort((a, b) => (b.score || 0) - (a.score || 0) || (a.name < b.name ? -1 : 1)),
    describe: (r) => (r.score || 0) + " points",
    board: { label: "Best catch", better: "high", value: (r) => r.score, format: (v) => v + " pts" },
    hall: { x: BX - 4.7, z: BZ - 0.4, heading: Math.PI / 2 },

    create(ctx) {
      const { world, session, hud, input, group, camera } = ctx;
      const THREE = world.THREE;
      const Y0 = world.heightAt(BX, BZ) + 0.02;
      const WY = Y0 + 0.38; // niveau de l'eau du bassin
      const TIP_Y = WY + 0.95; // hauteur du bout de la canne

      /* ---------------------------------------------------------------- le stand (une fois) */
      const stand = MF.group({ name: "Peche_aux_canards", parent: group });
      MF.torus(R, 0.26, MF.PAL.blue, { x: BX, y: Y0 + 0.26, z: BZ, rx: Math.PI / 2, parent: stand, seg: 32, tubeSeg: 10 });
      MF.cyl(R - 0.1, R - 0.1, 0.04, MF.mat("#49c6f2", { opacity: 0.88 }), { x: BX, y: WY, z: BZ, parent: stand, seg: 32 });
      MF.cyl(R, R, 0.3, "#2a86c8", { x: BX, y: Y0 + 0.15, z: BZ, parent: stand, seg: 32 });
      // tour du bassin au nom du sponsor (répété quatre fois)
      const bandTex = MF.sponsors.texture("canards-bassin", { w: 4, h: 0.42, kicker: "Pool rim" });
      bandTex.wrapS = THREE.RepeatWrapping;
      bandTex.repeat.x = 4;
      MF.mesh(new THREE.CylinderGeometry(R + 0.27, R + 0.27, 0.4, 40, 1, true), new THREE.MeshBasicMaterial({ map: bandTex }), { x: BX, y: Y0 + 0.26, z: BZ, parent: stand });
      // au centre : une petite roue de moulin qui fait tourner l'eau
      const wheel = MF.group({ x: BX, y: WY + 0.34, z: BZ, parent: stand });
      wheel.userData.live = true; // elle tourne : à laisser hors du décor fusionné
      MF.cyl(0.32, 0.4, 0.5, MF.PAL.cream, { x: BX, y: WY + 0.2, z: BZ, parent: stand, seg: 10 });
      MF.cone(0.42, 0.34, MF.PAL.red, { x: BX, y: WY + 0.62, z: BZ, parent: stand, seg: 10 });
      for (let i = 0; i < 6; i++) MF.box(0.05, 0.16, 0.46, MF.PAL.wood, { x: Math.cos((i * Math.PI) / 3) * 0.55, z: Math.sin((i * Math.PI) / 3) * 0.55, ry: -(i * Math.PI) / 3, y: -0.3, parent: wheel });
      // fronton, derrière le bassin, tourné vers les joueurs
      const arch = MF.group({ x: BX, y: Y0, z: BZ + R + 1.0, ry: Math.PI, parent: stand });
      for (const side of [-1, 1]) {
        const p = MF.pole(3.5, { color: MF.PAL.yellow, top: MF.PAL.red });
        p.position.x = side * 2.7;
        arch.add(p);
        const b = MF.balloon(side < 0 ? MF.PAL.pink : MF.PAL.teal, 0.22);
        b.position.set(side * 2.7, 3.5, 0);
        arch.add(b);
      }
      arch.add(MF.sign("HOOK-A-DUCK", { w: 5.0, h: 0.7, bg: MF.PAL.blue, color: "#ffffff", border: MF.PAL.yellow, y: 3.05, z: 0.02 }));
      arch.add(MF.sponsors.board("canards-fronton", 4.6, 0.62, { y: 2.32, z: 0.02, kicker: "Hook-a-duck front sign" }));
      for (let i = 0; i < 5; i++) MF.sphere(0.16, [MF.PAL.pink, MF.PAL.yellow, MF.PAL.green, MF.PAL.orange, MF.PAL.purple][i], { x: -1.8 + i * 0.9, y: 1.78, z: 0.02, parent: arch, seg: 8 }); // lots
      MF.freeze(stand);

      /* ---------------------------------------------------------------- les canards */
      const ducks = [];
      const colors = [MF.PAL.yellow, MF.PAL.yellow, MF.PAL.orange, MF.PAL.yellow, MF.PAL.pink];
      for (let i = 0; i < DUCKS; i++) {
        const d = buildDuck();
        group.add(d.group);
        ducks.push(Object.assign(d, { i, gen: 0, lane: i % 3, a0: 0, x: 0, z: 0, live: false, kind: "duck", value: 1, seed: -1 }));
      }
      let rnd0 = -1;
      function deal(seed) {
        // angles de départ : tirés de la graine, les mêmes chez tous
        if (rnd0 === seed) return;
        rnd0 = seed;
        const rnd = MF.rng(seed >>> 0 || 1);
        for (const d of ducks) {
          d.a0 = (d.i / DUCKS) * Math.PI * 2 + rnd() * 0.3;
          d.gen = 0;
          d.seed = -1;
        }
      }
      function moveDucks(seed, t, playing) {
        deal(seed);
        for (const d of ducks) {
          // génération en cours : on saute celles qui ont été pêchées et dont le délai de retour est passé
          let gone = false;
          if (playing) {
            for (;;) {
              const c = session.claims.get("d" + d.i + ":" + d.gen);
              if (!c) break;
              if (t * 1000 < c.t + RESPAWN * 1000) {
                gone = true;
                break;
              }
              d.gen++;
            }
          }
          if (d.seed !== seed || d.shown !== d.gen) {
            d.seed = seed;
            d.shown = d.gen;
            const p = prize(seed, d.i, d.gen);
            d.kind = p.kind;
            d.value = p.value;
            d.duck.visible = p.kind !== "shoe";
            d.shoe.visible = p.kind === "shoe";
            d.paint.color.copy(MF.color(p.kind === "gold" ? "#ffb300" : colors[d.i % colors.length]));
            d.paint.emissive.copy(MF.color(p.kind === "gold" ? "#ff9d00" : "#000000"));
          }
          const r = LANES[d.lane], w = 0.62 - d.lane * 0.11;
          const a = d.a0 + t * w;
          d.x = BX + Math.cos(a) * r;
          d.z = BZ + Math.sin(a) * r;
          d.live = !gone;
          d.group.visible = !gone;
          if (!gone) {
            d.group.position.set(d.x, WY - 0.02 + Math.sin(t * 2.2 + d.i) * 0.012, d.z);
            d.group.rotation.set(Math.sin(t * 1.7 + d.i * 2) * 0.06, -a, 0); // le canard regarde dans le sens du courant
          }
        }
        wheel.rotation.y = -t * 0.9;
      }
      const scoreOf = (uid, seed) => {
        let s = 0;
        for (const [key, c] of session.claims) {
          if (c.u !== uid) continue;
          const m = /^d(\d+):(\d+)$/.exec(key);
          if (m) s += prize(seed, +m[1], +m[2]).value;
        }
        return s;
      };

      /* ---------------------------------------------------------------- les cannes */
      const up = new THREE.Vector3(0, 1, 0), va = new THREE.Vector3(), vb = new THREE.Vector3();
      function stick(mesh, a, b) {
        // place un cylindre d'un mètre entre deux points
        vb.copy(b).sub(a);
        const len = vb.length() || 1e-3;
        mesh.position.copy(a).addScaledVector(vb, 0.5);
        mesh.scale.set(1, len, 1);
        mesh.quaternion.setFromUnitVectors(up, vb.multiplyScalar(1 / len));
      }
      const tipV = new THREE.Vector3(), hookV = new THREE.Vector3(), baseV = new THREE.Vector3();
      function drawRod(rod, tx, ty, tz, hx, hy, hz, carried) {
        tipV.set(tx, ty, tz);
        hookV.set(hx, hy, hz);
        baseV.set(BX + (tx - BX) * 0.55, WY + 1.2, BZ - R - 1.0); // la main, au bord nord du bassin
        stick(rod.rod, baseV, tipV);
        stick(rod.line, hookV, tipV);
        rod.hook.position.copy(hookV);
        const c = rod.carried;
        c.group.visible = carried >= 0;
        if (carried >= 0) {
          c.group.position.set(hx, hy - 0.36, hz);
          c.duck.visible = carried !== KIND.shoe;
          c.shoe.visible = carried === KIND.shoe;
          c.paint.color.copy(MF.color(carried === KIND.gold ? "#ffb300" : MF.PAL.yellow));
        }
      }
      const remotes = MF.remotes({
        session,
        size: 6,
        make(peer) {
          const rod = buildRod(peer.color);
          group.add(rod.group);
          return rod;
        },
        apply(rod, v, extra) {
          drawRod(rod, v[0], v[1], v[2], v[3], v[4], v[5], typeof extra === "number" ? extra : -1);
        },
      });

      let rod = null;
      const me = { tx: BX, tz: BZ - 1.2, hx: BX, hz: BZ - 1.2, hvx: 0, hvz: 0, hy: WY + 0.5, carried: -1, lift: 0, catches: 0 };
      const ray = { o: new THREE.Vector3(), d: new THREE.Vector3() }, proj = new THREE.Vector3();
      let reported = false, warned = false, lastBoard = 0, sway = 0, missCool = 0;

      function fish(dt, t, running, seed) {
        const S = input.state, P = S.pointer;
        // où va le bout de la canne : sous le pointeur (souris, doigt), ou déplacé aux flèches
        if (S.x || S.y) {
          me.keys = true;
          me.tx -= S.x * 2.1 * dt; // on regarde vers le sud : la droite de l'écran est vers −x
          me.tz += S.y * 2.1 * dt;
        } else if (!me.keys || P.isDown || Math.abs(P.nx - (me.px || 0)) + Math.abs(P.ny - (me.py || 0)) > 0.002) {
          me.keys = false;
          ray.o.copy(camera.position);
          ray.d.set(P.nx, P.ny, 0.5).unproject(camera).sub(ray.o).normalize();
          const k = (TIP_Y - ray.o.y) / (ray.d.y || -1e-6);
          if (k > 0) {
            me.gx = ray.o.x + ray.d.x * k;
            me.gz = ray.o.z + ray.d.z * k;
          }
          if (me.gx !== undefined) {
            me.tx = MF.damp(me.tx, me.gx, 9, dt);
            me.tz = MF.damp(me.tz, me.gz, 9, dt);
          }
        }
        me.px = P.nx;
        me.py = P.ny;
        const off = Math.hypot(me.tx - BX, me.tz - BZ);
        if (off > R + 0.3) {
          me.tx = BX + ((me.tx - BX) / off) * (R + 0.3);
          me.tz = BZ + ((me.tz - BZ) / off) * (R + 0.3);
        }
        // l'hameçon : un pendule accroché au bout de la canne (peu amorti : il se balance)
        me.hvx += (-(me.hx - me.tx) * 13 - me.hvx * 1.3) * dt;
        me.hvz += (-(me.hz - me.tz) * 13 - me.hvz * 1.3) * dt;
        me.hx += me.hvx * dt;
        me.hz += me.hvz * dt;
        const dive = running && me.carried < 0 && (S.a || (!input.touch && P.isDown));
        me.hy = MF.clamp(me.hy + (dive ? -1.7 : 1.9) * dt, WY + 0.31, WY + 0.62);
        missCool = Math.max(0, missCool - dt);
        if (me.carried >= 0) {
          // un canard au bout du fil : il faut le remonter pour le décrocher
          if (me.hy >= WY + 0.6) {
            me.lift += dt;
            if (me.lift > 0.25) me.carried = -1;
          }
        } else if (running && me.hy < WY + 0.36) {
          for (const d of ducks) {
            if (!d.live) continue;
            const rx = d.x - Math.sin(d.group.rotation.y) * -0.1, rz = d.z + Math.cos(d.group.rotation.y) * 0.1; // l'anneau est sur la tête
            const dist = Math.hypot(me.hx - rx, me.hz - rz);
            if (dist < CATCH && Math.hypot(me.hvx, me.hvz) < 1.6) {
              if (session.claim("d" + d.i + ":" + d.gen)) {
                me.carried = KIND[d.kind];
                me.lift = 0;
                me.catches++;
                proj.set(d.x, WY + 0.5, d.z).project(camera);
                const px = ((proj.x + 1) / 2) * hud.root.clientWidth, py = ((1 - proj.y) / 2) * hud.root.clientHeight;
                hud.pop(d.kind === "gold" ? "Golden duck! +10" : d.kind === "shoe" ? "An old shoe… −3" : "+" + d.value, px, py, { color: d.kind === "shoe" ? "#ff8a80" : d.kind === "gold" ? "#ffe45c" : undefined });
                MF.sfx.play(d.kind === "gold" ? "bravo" : d.kind === "shoe" ? "perdu" : "ting");
              }
              break;
            } else if (dist < 0.3 && missCool <= 0 && me.hy < WY + 0.33) {
              missCool = 1.2;
              MF.sfx.play("plouf");
            }
          }
        }
        if (!rod) {
          rod = buildRod(ctx.self.color);
          group.add(rod.group);
        }
        drawRod(rod, me.tx, TIP_Y, me.tz, me.hx, me.hy, me.hz, me.carried);
        remotes.send([me.tx, TIP_Y, me.tz, me.hx, me.hy, me.hz], me.carried);
      }

      return {
        ducks,
        me,
        remotes,
        score: () => (session.state ? scoreOf(ctx.self.uid, session.state.seed) : 0),
        enter() {
          input.use({ layout: "pointer", buttons: [{ id: "a", label: "DIP", key: "Space" }] });
          hud.stats([{ key: "score", label: "Score" }, { key: "time", label: "Time" }, { key: "n", label: "Catches" }]);
          hud.hint(input.touch ? "Drag to move the rod · DIP button to lower the hook" : "Mouse: move the rod · hold click or Space: dip the hook");
          sway = 0;
        },
        leave() {
          if (rod) {
            group.remove(rod.group);
            MF.dispose(rod.group);
            rod = null;
          }
        },
        idle() {
          remotes.clear();
          moveDucks(1, performance.now() / 1000, false);
        },
        onPhase(state, prev) {
          if (state && state.phase === "countdown" && (!prev || prev.phase !== "countdown")) {
            reported = warned = false;
            Object.assign(me, { carried: -1, catches: 0, hvx: 0, hvz: 0 });
            rnd0 = -1;
          }
        },
        update(dt, time) {
          remotes.update();
          const st = session.state, phase = st ? st.phase : "lobby";
          const t = session.time();
          const running = !!st && phase === "run" && t < DURATION;
          moveDucks(running ? st.seed : 1, running ? Math.max(0, t) : time, running);
          if (!ctx.active()) return true;
          const mine = !!st && session.inRoster() && (phase === "run" || phase === "countdown");
          if (mine) {
            const n = st.roster.length, slot = Math.max(0, session.slot());
            MF.cam.set(camera, { x: BX + (slot - (n - 1) / 2) * 0.5, y: Y0 + 4.3, z: BZ - 5.3 }, { x: BX, y: WY + 0.1, z: BZ + 0.35 }, 46);
            camera.updateMatrixWorld();
            fish(dt, t, running && !reported, st.seed);
            const left = Math.max(0, DURATION - Math.max(0, t));
            hud.set("score", scoreOf(ctx.self.uid, st.seed));
            hud.set("time", Math.ceil(left) + " s");
            hud.set("n", me.catches);
            if (running && left < 10 && !warned) {
              warned = true;
              hud.flash("10 seconds left!", { color: MF.PAL.yellow });
            }
            if (phase === "run" && t >= DURATION && !reported) {
              reported = true;
              session.report({ score: scoreOf(ctx.self.uid, st.seed), catches: me.catches });
            }
            if (time - lastBoard > 0.3) {
              lastBoard = time;
              hud.board(st.roster.map((p) => ({ name: p.name, color: p.color, self: p.uid === ctx.self.uid, score: scoreOf(p.uid, st.seed) })).sort((a, b) => b.score - a.score).map((r) => ({ name: r.name, color: r.color, self: r.self, text: r.score + " pts" })));
            }
          } else {
            if (rod) rod.group.visible = false;
            sway += dt;
            MF.cam.set(camera, { x: BX + Math.sin(sway * 0.25) * 1.8, y: Y0 + 3.0, z: BZ - 8.2 }, { x: BX, y: Y0 + 1.5, z: BZ + 0.5 }, 50);
          }
          if (rod) rod.group.visible = mine;
          return true;
        },
      };
    },
  });
})();
