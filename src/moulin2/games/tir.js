// La Fête du Moulin — stand de tir forain.
//
// 60 secondes pour faire le meilleur score à la carabine : canettes en pyramides (10 points), canards
// et cocardes qui défilent sur des rails (25), ballons qui montent (15), et parfois une étoile dorée
// très rapide (50). Les cibles sont les mêmes pour tous les joueurs : leur disposition se déduit de la
// graine de la partie et de l'heure de la partie, par vagues de 8 secondes. Une cible touchée est
// « réclamée » (session.claim) : le premier tireur gagne les points et elle tombe chez tout le monde.
(function () {
  "use strict";
  const MF = globalThis.MoulinFete;

  const CX = 51; // axe du stand (x) ; le comptoir est au nord (z = −4,5), la toile de fond au sud (z = 1,25)
  const COUNTER_Z = -4.5, BACK_Z = 1.25, HALF = 4.8;
  const DURATION = 60, WAVE = 8;
  const POINTS = { c: 10, d: 25, b: 25, o: 15, g: 50 };
  const N = { c: 12, d: 3, b: 2, o: 5, g: 1 };
  const RADIUS = { c: 0.15, d: 0.24, b: 0.24, o: 0.23, g: 0.16 };
  const MAG = 6, RELOAD = 1.2, RATE = 0.3;

  MF.registerGame({
    id: "tir",
    title: "Stand de tir forain",
    icon: "🎯",
    color: MF.PAL.orange,
    blurb: "60 secondes · canettes, cibles, ballons",
    station: { x: CX, z: -7.5, heading: 0 },
    kiosk: { x: CX - HALF - 1.3, z: COUNTER_Z - 0.9, heading: 0 }, // au coin du stand, hors de la ligne de tir
    minPlayers: 1,
    maxPlayers: 8,
    maxTime: DURATION + 20,
    help: "Vise à la souris et clique pour tirer (ou flèches et Espace ; au doigt : touche la cible). 6 plombs par chargeur.",
    rank: (list) => list.slice().sort((a, b) => (b.score || 0) - (a.score || 0) || (a.name < b.name ? -1 : 1)),
    describe: (r) => (r.score || 0) + " points",

    create(ctx) {
      const { world, session, hud, input, group, camera } = ctx;
      const THREE = world.THREE;
      const Y0 = world.heightAt(CX, -2) + 0.08; // plancher du stand

      /* ---------------------------------------------------------------- le stand (une fois) */
      const booth = MF.group({ name: "Stand_de_tir", parent: group });
      MF.box(HALF * 2 + 0.8, 0.5, 6.6, MF.PAL.wood, { x: CX, y: Y0 - 0.25, z: -1.6, parent: booth });
      // comptoir rayé rouge et blanc
      for (let i = 0; i < 10; i++) MF.box(0.98, 1.0, 0.5, i % 2 ? MF.PAL.white : MF.PAL.red, { x: CX - HALF + 0.5 + i * 0.96, y: Y0 + 0.5, z: COUNTER_Z, parent: booth, cast: true });
      MF.box(HALF * 2 + 0.3, 0.07, 0.7, MF.PAL.woodDark, { x: CX, y: Y0 + 1.03, z: COUNTER_Z, parent: booth });
      // parois latérales, toile de fond du sponsor, étagères
      for (const side of [-1, 1]) {
        MF.box(0.12, 3.0, BACK_Z - COUNTER_Z, MF.PAL.blue, { x: CX + side * (HALF + 0.06), y: Y0 + 1.5, z: (BACK_Z + COUNTER_Z) / 2, parent: booth, cast: true });
        for (let i = 0; i < 3; i++) MF.sphere(0.2, [MF.PAL.pink, MF.PAL.yellow, MF.PAL.teal][i], { x: CX + side * (HALF - 0.2), y: Y0 + 2.5, z: -3.4 + i * 1.2, parent: booth, seg: 10 }); // lots
      }
      booth.add(MF.sponsors.board("tir-fond", HALF * 2, 2.9, { x: CX, y: Y0 + 1.5, z: BACK_Z, ry: Math.PI, kicker: "Toile de fond du stand de tir" }));
      MF.box(HALF * 2 + 0.3, 3.0, 0.1, MF.PAL.woodDark, { x: CX, y: Y0 + 1.5, z: BACK_Z + 0.07, parent: booth, cast: true });
      const SHELF = [Y0 + 0.95, Y0 + 1.5];
      for (const y of SHELF) MF.box(HALF * 2 - 0.4, 0.05, 0.34, MF.PAL.wood, { x: CX, y: y - 0.03, z: 0.55, parent: booth });
      const RAIL = [Y0 + 1.95, Y0 + 2.45];
      for (const y of RAIL) MF.box(HALF * 2 - 0.2, 0.04, 0.04, MF.PAL.steel, { x: CX, y: y - 0.3, z: -0.1, parent: booth });
      // toit et fronton, tournés vers les joueurs
      for (let i = 0; i < 10; i++) MF.box(0.98, 0.1, BACK_Z - COUNTER_Z + 1.4, i % 2 ? MF.PAL.yellow : MF.PAL.red, { x: CX - HALF + 0.5 + i * 0.96, y: Y0 + 3.12, z: (BACK_Z + COUNTER_Z) / 2 - 0.3, parent: booth, cast: true });
      const title = MF.sign("STAND DE TIR", { w: 4.6, h: 0.7, bg: MF.PAL.red, color: "#ffffff", border: MF.PAL.yellow, x: CX, y: Y0 + 3.85, z: COUNTER_Z - 0.75, ry: Math.PI });
      booth.add(title);
      booth.add(MF.sponsors.board("tir-fronton", 5.6, 0.62, { x: CX, y: Y0 + 3.36, z: COUNTER_Z - 0.76, ry: Math.PI, kicker: "Fronton du stand de tir" }));
      booth.add(MF.bunting({ x: CX - HALF, y: Y0 + 3.05, z: COUNTER_Z - 0.7 }, { x: CX + HALF, y: Y0 + 3.05, z: COUNTER_Z - 0.7 }, { sag: 0.3, size: 0.24 }));

      /* ---------------------------------------------------------------- les cibles (réutilisées de vague en vague) */
      const targets = []; // { type, i, mesh, key, x, y, z, live }
      const canMat = [MF.mat(MF.PAL.red), MF.mat(MF.PAL.blue), MF.mat(MF.PAL.green)];
      function make(type, i) {
        let mesh;
        if (type === "c") {
          mesh = MF.group({ parent: group });
          MF.cyl(0.085, 0.085, 0.2, canMat[i % 3], { parent: mesh, seg: 10 });
          MF.cyl(0.087, 0.087, 0.05, MF.PAL.white, { parent: mesh, seg: 10 });
        } else if (type === "d") {
          mesh = MF.group({ parent: group });
          MF.sphere(0.17, MF.PAL.yellow, { parent: mesh, seg: 10 }).scale.set(1.25, 0.9, 0.35);
          MF.sphere(0.1, MF.PAL.yellow, { x: 0.15, y: 0.14, parent: mesh, seg: 8 }).scale.set(1, 1, 0.4);
          MF.cone(0.045, 0.1, MF.PAL.orange, { x: 0.27, y: 0.13, rz: -Math.PI / 2, parent: mesh, seg: 6 });
        } else if (type === "b") {
          mesh = MF.group({ parent: group });
          [[0.24, MF.PAL.white], [0.17, MF.PAL.red], [0.1, MF.PAL.white], [0.045, MF.PAL.red]].forEach(([r, c], n) => MF.cyl(r, r, 0.03, c, { z: -n * 0.006, rx: Math.PI / 2, parent: mesh, seg: 18 }));
        } else if (type === "o") {
          mesh = MF.balloon([MF.PAL.red, MF.PAL.blue, MF.PAL.green, MF.PAL.purple, MF.PAL.pink][i % 5], 0.2);
          group.add(mesh);
        } else {
          mesh = MF.mesh(new THREE.OctahedronGeometry(0.17), MF.mat(MF.PAL.yellow, { emissive: MF.PAL.yellow, emissiveIntensity: 0.6 }), { parent: group });
          mesh.scale.set(1, 1, 0.45);
        }
        mesh.visible = false;
        targets.push({ type, i, mesh, key: "", x: 0, y: 0, z: 0, live: false });
      }
      for (const type of Object.keys(N)) for (let i = 0; i < N[type]; i++) make(type, i);
      // tirages de la vague en cours (ballons, étoile) : refaits quand la vague change
      const wave = { k: -1, seed: -1, balloon: [], gold: null };
      function drawWave(seed, k) {
        if (wave.k === k && wave.seed === seed) return;
        wave.k = k;
        wave.seed = seed;
        const rnd = MF.rng(((seed >>> 0) ^ (k * 2654435761)) >>> 0);
        wave.balloon.length = 0;
        for (let i = 0; i < N.o; i++) wave.balloon.push({ at: rnd() * 5.2, x: CX - HALF + 0.8 + rnd() * (HALF * 2 - 1.6), speed: 0.55 + rnd() * 0.35, sway: rnd() * 6.28 });
        wave.gold = rnd() < 0.6 ? { at: 1 + rnd() * 4, dir: rnd() < 0.5 ? 1 : -1, y: RAIL[1] + 0.25 - rnd() * 0.5 } : null;
      }
      /** Où est la cible à l'instant t de la partie ? Renvoie faux si elle n'est pas à l'écran. */
      function pose(tg, k, tw, t) {
        const i = tg.i;
        if (tg.type === "c") {
          // deux pyramides de six canettes (3, 2, 1) sur l'étagère du bas et celle du haut
          const p = i < 6 ? 0 : 1, j = i % 6, row = j < 3 ? 0 : j < 5 ? 1 : 2, col = j < 3 ? j - 1 : j < 5 ? j - 3.5 : 0;
          tg.x = CX + (p ? 2.6 : -2.6) + col * 0.19;
          tg.y = SHELF[p] + 0.1 + row * 0.2;
          tg.z = 0.55;
          return true;
        }
        if (tg.type === "d" || tg.type === "b") {
          const span = HALF * 2 - 0.8, duck = tg.type === "d";
          const speed = duck ? 1.25 : 1.9, n = duck ? N.d : N.b;
          let u = (t * speed + (i * span) / n + (duck ? 0 : 1.7)) % span;
          if (!duck) u = span - u; // les cocardes défilent dans l'autre sens
          tg.x = CX - span / 2 + u;
          tg.y = RAIL[duck ? 0 : 1];
          tg.z = -0.1;
          return true;
        }
        if (tg.type === "o") {
          const b = wave.balloon[i], age = tw - b.at;
          if (age < 0) return false;
          tg.y = Y0 + 0.55 + age * b.speed;
          if (tg.y > Y0 + 2.85) return false;
          tg.x = b.x + Math.sin(age * 2.1 + b.sway) * 0.16;
          tg.z = 0.2;
          return true;
        }
        const g = wave.gold;
        if (!g) return false;
        const age = tw - g.at;
        if (age < 0 || age > 2.6) return false;
        tg.x = CX + g.dir * (-HALF + 0.3 + (age / 2.6) * (HALF * 2 - 0.6));
        tg.y = g.y + Math.sin(age * 7) * 0.12;
        tg.z = -0.25;
        return true;
      }
      /** Place toutes les cibles. t : heure de la partie (ou heure locale hors partie). */
      function layout(seed, t, playing) {
        const k = Math.floor(t / WAVE), tw = t - k * WAVE;
        drawWave(seed, k);
        for (const tg of targets) {
          tg.key = k + ":" + tg.type + tg.i;
          const shown = pose(tg, k, tw, t);
          const claim = playing ? session.claims.get(tg.key) : null;
          tg.live = shown && !claim && (playing || tg.type !== "g");
          const m = tg.mesh;
          if (claim) {
            // touchée : la canette s'envole en tournant, les autres basculent ; puis elle disparaît
            const age = t - claim.t / 1000;
            m.visible = shown && age < 0.5 && tg.type !== "o";
            if (m.visible) {
              m.position.set(tg.x + (tg.type === "c" ? Math.sin(tg.i * 7) * age * 1.4 : 0), tg.y + (tg.type === "c" ? age * 2.2 - age * age * 9 : -age * 0.5), tg.z + age * 1.6);
              m.rotation.x = -age * 9;
            }
          } else {
            m.visible = tg.live || (shown && !playing);
            if (m.visible) {
              m.position.set(tg.x, tg.y - (tg.type === "o" ? 0.23 : 0), tg.z);
              m.rotation.set(0, tg.type === "d" ? 0 : tg.type === "g" ? t * 5 : 0, 0);
            }
          }
        }
      }

      /* ---------------------------------------------------------------- carabine, viseur, étincelles */
      // carabine vue à la première personne : on n'en voit que le fût et le canon, en bas à droite
      const gun = MF.group({ name: "Carabine", parent: group });
      MF.box(0.045, 0.055, 0.5, MF.PAL.wood, { z: -0.1, parent: gun });
      MF.cyl(0.012, 0.012, 0.6, MF.PAL.black, { rx: Math.PI / 2, y: 0.03, z: 0.38, parent: gun, seg: 8 });
      MF.box(0.008, 0.03, 0.012, MF.PAL.black, { y: 0.055, z: 0.65, parent: gun }); // guidon
      const flashMesh = MF.sphere(0.04, MF.mat(MF.PAL.yellow, { basic: true }), { y: 0.03, z: 0.72, parent: gun, seg: 6 });
      gun.visible = false;
      const sparks = [];
      for (let i = 0; i < 10; i++) {
        const s = MF.sphere(0.045, MF.mat(i % 2 ? MF.PAL.yellow : MF.PAL.white, { basic: true }), { parent: group, seg: 5 });
        s.visible = false;
        sparks.push({ mesh: s, life: 0, vx: 0, vy: 0, vz: 0 });
      }
      let sparkIx = 0;
      function burst(x, y, z, n) {
        for (let i = 0; i < n; i++) {
          const s = sparks[sparkIx++ % sparks.length];
          s.mesh.position.set(x, y, z);
          s.mesh.visible = true;
          s.life = 0.35;
          s.vx = (Math.random() - 0.5) * 2.4;
          s.vy = Math.random() * 2.2;
          s.vz = -Math.random() * 1.6;
        }
      }
      session.on("pan", (d) => {
        // tir d'un autre joueur : étincelle à l'impact, son discret
        if (!Array.isArray(d)) return;
        burst(+d[0] || 0, +d[1] || 0, +d[2] || 0, 3);
        if (ctx.active()) MF.sfx.play("toc");
      });
      session.onClaim((key, uid) => {
        const type = key.split(":")[1] ? key.split(":")[1][0] : "";
        if (type === "o" && (ctx.active() || session.players().length)) MF.sfx.play("pop");
        if (uid !== ctx.self.uid && type === "c" && ctx.active()) MF.sfx.play("ting");
      });

      const aim = { x: 0, y: 0.1 }; // viseur, en coordonnées d'écran −1…1
      const ray = { o: new THREE.Vector3(), d: new THREE.Vector3() }, tmp = new THREE.Vector3(), aimPoint = new THREE.Vector3();
      let cross = null, ammo = MAG, reload = 0, cool = 0, kick = 0, reported = false, lastBoard = 0, sway = 0, warned = false, shotsFired = 0;
      const scoreOf = (uid) => {
        let s = 0;
        for (const [key, c] of session.claims) if (c.u === uid) s += POINTS[key.split(":")[1][0]] || 0;
        return s;
      };
      function fire(t) {
        if (cool > 0 || reload > 0 || ammo <= 0) return;
        ammo--;
        cool = RATE;
        kick = 0.14;
        shotsFired++;
        if (!ammo) reload = RELOAD;
        MF.sfx.play("tir");
        if (cross) {
          cross.classList.remove("is-fire");
          void cross.offsetWidth;
          cross.classList.add("is-fire");
        }
        // la cible la plus proche le long de la ligne de visée
        let best = null, bestAlong = Infinity;
        for (const tg of targets) {
          if (!tg.live) continue;
          tmp.set(tg.x, tg.y, tg.z).sub(ray.o);
          const along = tmp.dot(ray.d);
          if (along < 0 || along > bestAlong) continue;
          const off2 = tmp.lengthSq() - along * along, r = RADIUS[tg.type];
          if (off2 < r * r) {
            best = tg;
            bestAlong = along;
          }
        }
        const px = ((aim.x + 1) / 2) * hud.root.clientWidth, py = ((1 - aim.y) / 2) * hud.root.clientHeight;
        if (best && session.claim(best.key)) {
          const pts = POINTS[best.type];
          burst(best.x, best.y, best.z, best.type === "o" ? 6 : 4);
          session.send("pan", [best.x, best.y, best.z]);
          hud.pop(best.type === "g" ? "Dans le mille ! +" + pts : "+" + pts, px, py - 30, { color: best.type === "g" ? "#ffe45c" : undefined });
          MF.sfx.play(best.type === "o" ? "pop" : best.type === "g" ? "bravo" : "ting");
        } else {
          // dans la toile : petit impact
          const k = (BACK_Z - 0.05 - ray.o.z) / (ray.d.z || 1e-6);
          const ix = ray.o.x + ray.d.x * k, iy = ray.o.y + ray.d.y * k;
          burst(ix, iy, BACK_Z - 0.06, 2);
          session.send("pan", [ix, iy, BACK_Z - 0.06]);
        }
      }

      return {
        targets,
        score: () => scoreOf(ctx.self.uid),
        aim,
        enter() {
          input.use({ layout: "pointer", buttons: [{ id: "a", label: "TIRER", key: "Espace" }] });
          hud.stats([{ key: "score", label: "Score" }, { key: "time", label: "Temps" }, { key: "ammo", label: "Plombs" }]);
          hud.hint(input.touch ? "Touche une cible pour tirer dessus" : "Vise à la souris, clique pour tirer · ou flèches et Espace");
          cross = hud.widget("fete-cross");
          aim.x = 0;
          aim.y = 0.1;
          sway = 0;
        },
        leave() {
          gun.visible = false;
          cross = null;
        },
        idle() {
          layout(1, performance.now() / 1000, false);
        },
        onPhase(state, prev) {
          if (state && state.phase === "countdown" && (!prev || prev.phase !== "countdown")) {
            ammo = MAG;
            reload = cool = 0;
            reported = warned = false;
            shotsFired = 0;
          }
        },
        update(dt, time) {
          const st = session.state, phase = st ? st.phase : "lobby";
          const t = session.time();
          const running = !!st && phase === "run" && t < DURATION;
          // les cibles : celles de la partie en cours, ou une vague de démonstration hors partie
          layout(running ? st.seed : 1, running ? Math.max(0, t) : time, running);
          for (const s of sparks) {
            if (s.life <= 0) continue;
            s.life -= dt;
            s.vy -= 6 * dt;
            s.mesh.position.x += s.vx * dt;
            s.mesh.position.y += s.vy * dt;
            s.mesh.position.z += s.vz * dt;
            if (s.life <= 0) s.mesh.visible = false;
          }
          if (!ctx.active()) return true;

          const mine = !!st && session.inRoster() && (phase === "run" || phase === "countdown");
          if (mine) {
            // caméra à l'épaule, au comptoir, décalée selon ma place
            const n = st.roster.length, slot = Math.max(0, session.slot());
            const cx = CX + (slot - (n - 1) / 2) * 1.1;
            MF.cam.set(camera, { x: cx, y: Y0 + 1.62, z: COUNTER_Z - 1.75 }, { x: cx * 0.35 + CX * 0.65, y: Y0 + 1.72, z: 0.2 }, 40);
            camera.updateMatrixWorld();
            // viseur : souris (ou doigt posé), sinon flèches
            const P = input.state.pointer, S = input.state;
            if (S.x || S.y) {
              aim.x = MF.clamp(aim.x + S.x * 1.1 * dt, -0.98, 0.98);
              aim.y = MF.clamp(aim.y + S.y * 1.1 * dt, -0.98, 0.98);
              aim.keys = true;
            } else if (!aim.keys || P.isDown || P.down || Math.abs(P.nx - (aim.px || 0)) + Math.abs(P.ny - (aim.py || 0)) > 0.002) {
              aim.keys = false;
              aim.x = P.nx;
              aim.y = P.ny;
            }
            aim.px = P.nx;
            aim.py = P.ny;
            ray.o.copy(camera.position);
            ray.d.set(aim.x, aim.y, 0.5).unproject(camera).sub(ray.o).normalize();
            aimPoint.copy(ray.o).addScaledVector(ray.d, 7);
            if (cross) cross.style.transform = `translate(${(((aim.x + 1) / 2) * hud.root.clientWidth).toFixed(1)}px, ${(((1 - aim.y) / 2) * hud.root.clientHeight).toFixed(1)}px)`;
            cool = Math.max(0, cool - dt);
            kick = Math.max(0, kick - dt);
            if (reload > 0) {
              reload -= dt;
              if (reload <= 0) ammo = MAG;
            }
            if (running && !reported && (P.down || S.hit.a)) fire(t);
            // la carabine, en bas à droite, pointée vers le viseur
            gun.visible = true;
            tmp.set(0.17, -0.2, -0.85).applyQuaternion(camera.quaternion);
            gun.position.copy(camera.position).add(tmp);
            gun.lookAt(aimPoint);
            gun.rotateY(Math.PI); // l'avant de la carabine est +z, lookAt pointe −z
            gun.translateZ(-kick * 0.5);
            gun.rotateX(-kick * 0.9);
            flashMesh.visible = kick > 0.08;
            const left = Math.max(0, DURATION - Math.max(0, t));
            hud.set("score", scoreOf(ctx.self.uid));
            hud.set("time", Math.ceil(left) + " s");
            hud.set("ammo", reload > 0 ? "…" : ammo + " / " + MAG);
            if (running && left < 10 && !warned) {
              warned = true;
              hud.flash("Plus que 10 secondes !", { color: MF.PAL.yellow });
            }
            if (phase === "run" && t >= DURATION && !reported) {
              reported = true;
              gun.visible = false;
              session.report({ score: scoreOf(ctx.self.uid), shots: shotsFired });
            }
            if (time - lastBoard > 0.3) {
              lastBoard = time;
              hud.board(st.roster.map((p) => ({ name: p.name, color: p.color, self: p.uid === ctx.self.uid, score: scoreOf(p.uid) })).sort((a, b) => b.score - a.score).map((r) => ({ name: r.name, color: r.color, self: r.self, text: r.score + " pts" })));
            }
          } else {
            // salle d'attente, spectateur, résultats : vue d'ensemble du stand
            gun.visible = false;
            if (cross) cross.style.transform = "translate(-200px, -200px)";
            sway += dt;
            MF.cam.set(camera, { x: CX + Math.sin(sway * 0.25) * 2.2, y: Y0 + 2.5, z: COUNTER_Z - 7.2 }, { x: CX, y: Y0 + 2.0, z: -1 }, 50);
          }
          return true;
        },
      };
    },
  });
})();
