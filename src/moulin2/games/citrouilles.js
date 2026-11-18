// La Fête du Moulin — lance-citrouilles (« Pumpkin Slingshot »).
//
// Un lance-pierre géant au bord de l'étang intermédiaire ; sur l'eau, trois radeaux portent des
// échafaudages de caisses, de planches et de tonneaux où des corbeaux se sont installés. On tire la
// citrouille en arrière (souris ou doigt), une ligne de points montre la trajectoire, on relâche :
// la citrouille part, les piles s'écroulent, tout ce qui tombe du radeau finit à l'eau.
//   +500 par corbeau délogé, +50 par pièce renversée, +1000 par citrouille restante si tous les
//   corbeaux sont partis. Six citrouilles par partie.
// La vue est de profil, comme dans un jeu de lance-pierre : le lancer est simulé dans le plan
// vertical du tir (u : distance vers le nord depuis le lance-pierre, y : hauteur). Chacun joue sur
// son propre décor (le même pour tous, tiré de la graine de la partie) ; on voit passer les
// citrouilles des autres, et les scores se comparent à la fin.
(function () {
  "use strict";
  const MF = globalThis.MoulinFete;

  const SX = 58, SZ = -16.6; // le lance-pierre ; on tire vers le nord (z décroissant)
  const RAFTS = [12.4, 17.2, 22.0]; // distance des radeaux (m)
  const RAFT_W = 3.5, G = 9.8, VMAX = 19.5, PULL = 2.3, SHOTS = 6, DURATION = 150;
  const PR = 0.33; // rayon d'une citrouille
  // pièces : largeur, hauteur, masse, couleur
  const KINDS = {
    crate: { w: 0.7, h: 0.7, m: 3, c: "#b98350" },
    plank: { w: 1.6, h: 0.16, m: 1.6, c: "#d9b27a" },
    post: { w: 0.16, h: 1.2, m: 1.2, c: "#a8733f" },
    barrel: { w: 0.72, h: 0.86, m: 4, c: "#8a5a2c" },
    bale: { w: 1.1, h: 0.55, m: 2, c: "#e2b84a" },
  };
  // échafaudages : [pièce ou "crow", décalage sur le radeau (m), hauteur du pied (m)]
  const LAYOUTS = [
    [["post", -0.62, 0], ["post", 0.62, 0], ["plank", 0, 1.2], ["crow", 0, 1.36], ["crow", 0, 0], ["bale", 1.15, 0]],
    [["crate", -0.45, 0], ["crate", 0.45, 0], ["plank", 0, 0.7], ["crate", 0, 0.86], ["crow", 0, 1.56], ["barrel", -1.25, 0], ["crow", -1.25, 0.86]],
    [["barrel", -0.6, 0], ["barrel", 0.6, 0], ["plank", 0, 0.86], ["post", -0.55, 1.02], ["post", 0.55, 1.02], ["plank", 0, 2.22], ["crow", 0, 2.38], ["crow", 0, 1.02]],
  ];

  MF.registerGame({
    id: "citrouilles",
    title: "Pumpkin Slingshot",
    icon: "🎃",
    color: MF.PAL.orange,
    blurb: "Launch day: pull back, let go, knock the crows off",
    station: { x: SX, z: SZ + 2.6, heading: Math.PI },
    kiosk: { x: SX + 3.4, z: SZ + 2.4, heading: Math.PI },
    hall: { x: SX - 3.4, z: SZ + 2.4, heading: Math.PI },
    range: 110,
    minPlayers: 1,
    maxPlayers: 8,
    maxTime: DURATION + 15,
    help: "Drag back anywhere and release to launch (or ← → power, ↑ ↓ angle, Space). Topple the stacks on the rafts: 500 per crow, 50 per piece, 1000 per pumpkin left once every crow is gone.",
    rank: (list) => list.slice().sort((a, b) => (b.score || 0) - (a.score || 0) || (a.name < b.name ? -1 : 1)),
    describe: (r) => (r.score || 0) + " pts",
    board: { label: "Best score", better: "high", value: (r) => r.score, format: (v) => v + " pts" },

    create(ctx) {
      const { world, session, hud, input, group, camera } = ctx;
      const THREE = world.THREE;
      const pond = world.waterAt(SX, SZ - 15);
      const WATER = pond ? pond.level : -0.42;
      const DECK = world.heightAt(SX, SZ) + 0.12; // plancher du pas de tir
      const REST = { u: 0, y: DECK + 2.25 }; // la citrouille au repos dans la poche
      const RAFT_Y = WATER + 0.36;
      /** Plan du tir → monde. */
      const wx = () => SX, wz = (u) => SZ - u;

      /* ---------------------------------------------------------------- décor (une fois) */
      const deco = MF.group({ name: "Lance_citrouilles", parent: group });
      MF.box(3.6, 0.14, 3.6, MF.decks.WOOD, { x: SX, y: DECK - 0.07, z: SZ + 0.6, parent: deco });
      MF.box(3.6, DECK - world.heightAt(SX, SZ - 1) + 0.9, 0.12, MF.decks.BEAM, { x: SX, y: DECK - 0.55, z: SZ - 1.2, parent: deco });
      // le lance-pierre : une fourche de bois
      MF.cyl(0.13, 0.17, 1.5, MF.PAL.woodDark, { x: SX, y: DECK + 0.75, z: SZ, parent: deco, seg: 8, cast: true });
      for (const side of [-1, 1]) MF.cyl(0.09, 0.12, 1.5, MF.PAL.woodDark, { x: SX + side * 0.5, y: DECK + 2.05, z: SZ, rz: -side * 0.42, parent: deco, seg: 8, cast: true });
      const FORK = [{ x: SX - 0.78, y: DECK + 2.7 }, { x: SX + 0.78, y: DECK + 2.7 }];
      // réserve de citrouilles et bannière
      const stock = [];
      const banner = MF.sponsors.banner("citrouilles-fronton", 3.2, 0.8);
      banner.position.set(SX - 3.1, DECK, SZ + 0.4);
      banner.rotation.y = Math.PI / 2;
      deco.add(banner);
      deco.add(MF.sign("PUMPKIN SLINGSHOT", { w: 3.6, h: 0.6, bg: MF.PAL.orange, color: "#ffffff", border: MF.PAL.ink, x: SX + 2.6, y: DECK + 2.9, z: SZ + 1.6, ry: -Math.PI / 2 }));
      for (const dz of [-1.5, 1.5]) MF.cyl(0.05, 0.06, 3.2, MF.PAL.woodDark, { x: SX + 2.6, y: DECK + 1.6, z: SZ + 1.6 + dz, parent: deco, seg: 6 });
      for (let i = 0; i < 2; i++) {
        const b = MF.props.bale();
        b.position.set(SX + 1.2 + i * 0.3, DECK, SZ + 1.9 - i * 0.6);
        b.rotation.y = 0.4 * i;
        deco.add(b);
      }
      // radeaux : rondins, petit mât avec le fanion du sponsor
      const flagTex = MF.sponsors.texture("citrouilles-cibles", { w: 2.4, h: 0.8, kicker: "Raft flag" });
      for (const u of RAFTS) {
        for (let i = 0; i < 7; i++) MF.cyl(0.2, 0.2, 2.2, i % 2 ? "#a8733f" : "#b98350", { x: SX, y: RAFT_Y - 0.2, z: wz(u - RAFT_W / 2 + 0.25 + i * 0.5), rz: Math.PI / 2, parent: deco, seg: 8, cast: true });
        for (const s of [-1, 1]) MF.box(0.14, 0.1, RAFT_W, MF.decks.BEAM, { x: SX + s * 0.8, y: RAFT_Y - 0.02, z: wz(u), parent: deco });
        MF.cyl(0.03, 0.03, 2.0, MF.PAL.white, { x: SX - 1.0, y: RAFT_Y + 1.0, z: wz(u + RAFT_W / 2 - 0.2), parent: deco, seg: 5 });
        MF.plane(0.9, 0.3, new THREE.MeshBasicMaterial({ map: flagTex, side: THREE.DoubleSide }), { x: SX - 1.0, y: RAFT_Y + 1.82, z: wz(u + RAFT_W / 2 - 0.2) + 0.47, ry: Math.PI / 2, parent: deco, receive: false });
      }
      MF.freeze(deco);

      /* ---------------------------------------------------------------- pièces, corbeaux, citrouilles */
      const live = MF.group({ name: "Pieces", parent: group });
      live.userData.live = true;
      function pumpkinMesh() {
        const g = MF.group({});
        const body = MF.sphere(PR, MF.PAL.orange, { parent: g, seg: 12, cast: true });
        body.scale.set(1, 0.84, 1);
        for (let i = 0; i < 6; i++) MF.sphere(PR * 0.5, "#f07a1c", { x: Math.sin((i / 6) * 6.283) * PR * 0.62, z: Math.cos((i / 6) * 6.283) * PR * 0.62, parent: g, seg: 6 }).scale.set(1, 1.45, 1);
        MF.cyl(0.035, 0.05, 0.14, MF.PAL.green, { y: PR * 0.86, parent: g, seg: 5 });
        MF.freeze(g);
        return g;
      }
      function crowMesh() {
        const g = MF.group({});
        MF.sphere(0.27, "#23232b", { y: 0.27, parent: g, seg: 10, cast: true }).scale.set(0.9, 1, 1.1);
        MF.sphere(0.17, "#23232b", { y: 0.58, z: 0.08, parent: g, seg: 8 });
        MF.cone(0.06, 0.2, MF.PAL.yellow, { y: 0.56, z: 0.3, rx: Math.PI / 2, parent: g, seg: 5 });
        for (const s of [-1, 1]) {
          MF.sphere(0.035, "#ffffff", { x: s * 0.07, y: 0.63, z: 0.2, parent: g, seg: 5 });
          MF.box(0.05, 0.3, 0.26, "#15151b", { x: s * 0.25, y: 0.3, rz: s * 0.3, parent: g });
        }
        MF.cyl(0.13, 0.13, 0.04, MF.PAL.red, { y: 0.74, z: 0.08, parent: g, seg: 8 }); // petit chapeau
        MF.cyl(0.08, 0.08, 0.1, MF.PAL.red, { y: 0.8, z: 0.08, parent: g, seg: 8 });
        MF.freeze(g);
        return g; // le bec vers +z : vers le lance-pierre (au sud)
      }
      let pieces = []; // { kind, w, h, m, u, y, a, vu, vy, va, state, sup, mesh, crow, scored }
      /** Demi-largeur (le long du tir) et demi-hauteur d'une pièce, compte tenu de son angle. */
      const hu = (p) => (p.crow ? 0.27 : (Math.abs(Math.cos(p.a)) * p.w + Math.abs(Math.sin(p.a)) * p.h) / 2);
      const hy = (p) => (p.crow ? 0.3 : (Math.abs(Math.cos(p.a)) * p.h + Math.abs(Math.sin(p.a)) * p.w) / 2);
      const top = (p) => (p.crow ? p.y + 0.6 : p.y + hy(p));
      const foot = (p) => (p.crow ? p.y : p.y - hy(p));
      function clearPieces() {
        for (const p of pieces) {
          live.remove(p.mesh);
          MF.dispose(p.mesh);
        }
        pieces = [];
      }
      function buildPieces(seed) {
        clearPieces();
        const rnd = MF.rng((seed >>> 0) + 17);
        const order = [0, 1, 2].sort(() => rnd() - 0.5);
        RAFTS.forEach((u0, i) => {
          const flip = rnd() < 0.5 ? -1 : 1;
          for (const [kind, du, y0] of LAYOUTS[order[i]]) {
            const crow = kind === "crow";
            const k = crow ? { w: 0.54, h: 0.6, m: 1, c: "" } : KINDS[kind];
            const mesh = crow
              ? crowMesh()
              : kind === "barrel"
                ? MF.group({}, MF.cyl(0.36, 0.36, 0.86, k.c, { seg: 10, cast: true }), MF.cyl(0.375, 0.375, 0.06, "#33363f", { y: 0.25, seg: 10 }), MF.cyl(0.375, 0.375, 0.06, "#33363f", { y: -0.25, seg: 10 }))
                : MF.group({}, MF.box(1.0, k.h, k.w, k.c, { cast: true }), MF.box(1.02, k.h * 0.14, k.w + 0.02, "#7a5028", { y: k.h * 0.36 }), MF.box(1.02, k.h * 0.14, k.w + 0.02, "#7a5028", { y: -k.h * 0.36 }));
            live.add(mesh);
            pieces.push({ kind, crow, w: k.w, h: k.h, m: k.m, u: u0 + du * flip, y: RAFT_Y + y0 + (crow ? 0 : k.h / 2), a: 0, vu: 0, vy: 0, va: 0, state: "static", mesh, sup: [], raft: i });
          }
        });
        // qui repose sur quoi (pour l'écroulement)
        for (const p of pieces) {
          for (const q of pieces) {
            if (q === p || q.crow) continue;
            if (Math.abs(top(q) - foot(p)) < 0.04 && Math.abs(q.u - p.u) < hu(q) + hu(p) - 0.03) p.sup.push(q);
          }
          p.onRaft = Math.abs(foot(p) - RAFT_Y) < 0.04;
        }
        place();
      }
      function place() {
        for (const p of pieces) {
          p.mesh.visible = p.state !== "gone";
          p.mesh.position.set(wx(), p.y, wz(p.u));
          p.mesh.rotation.x = p.a; // tourne dans le plan du tir
        }
      }

      // mes citrouilles : une en vol au plus ; celles des autres : fantômes en vol simple
      const ball = { mesh: pumpkinMesh(), on: false, u: 0, y: 0, vu: 0, vy: 0, bounces: 0, spin: 0, age: 0 };
      live.add(ball.mesh);
      const loaded = pumpkinMesh(); // celle qui attend dans la poche
      live.add(loaded);
      const ghosts = [];
      for (let i = 0; i < 6; i++) {
        const m = pumpkinMesh();
        m.visible = false;
        live.add(m);
        ghosts.push({ mesh: m, on: false, u: 0, y: 0, vu: 0, vy: 0 });
      }
      // élastiques (deux barres étirées de la fourche à la poche) et points de trajectoire
      const bands = FORK.map(() => MF.box(0.05, 0.05, 1, "#3a2a1a", { parent: live }));
      const dots = [];
      for (let i = 0; i < 16; i++) {
        const d = MF.sphere(0.09 - i * 0.003, MF.mat("#ffffff", { basic: true }), { parent: live, seg: 5 });
        d.visible = false;
        dots.push(d);
      }
      for (let i = 0; i < SHOTS; i++) {
        const m = pumpkinMesh();
        m.position.set(SX - 1.1 + (i % 3) * 0.5, DECK + PR * 0.84, SZ + 1.4 + Math.floor(i / 3) * 0.55);
        live.add(m);
        stock.push(m);
      }
      const splashes = [];
      for (let i = 0; i < 5; i++) {
        const ring = MF.mesh(new THREE.RingGeometry(0.3, 0.42, 20), MF.mat("#ffffff", { opacity: 0.8, unique: true }), { rx: -Math.PI / 2, parent: live });
        ring.visible = false;
        splashes.push({ ring, t: 9 });
      }
      let splashIx = 0;
      function splash(u, size = 1) {
        const s = splashes[splashIx++ % splashes.length];
        s.ring.position.set(wx(), WATER + 0.03, wz(u));
        s.t = 0;
        s.size = size;
        s.ring.visible = true;
        if (ctx.active() || session.players().length) MF.sfx.play("plouf");
      }
      const feathers = MF.props.confetti(group, 36);
      const v3 = new THREE.Vector3();
      /** Point du plan de tir → pixels de l'écran. */
      function screen(u, y) {
        v3.set(wx(), y, wz(u)).project(camera);
        return [((v3.x + 1) / 2) * hud.root.clientWidth, ((1 - v3.y) / 2) * hud.root.clientHeight];
      }

      /* ---------------------------------------------------------------- la partie de chacun */
      let score = 0, shots = SHOTS, reported = false, settle = 0, aim = { angle: 0.62, power: 0.72 }, drag = null, sway = 0, lastShot = -9, bonusDone = false, warned = false, builtFor = -1;
      const awake = (p) => {
        if (p.state !== "static") return;
        p.state = "dyn";
        if (!p.crow && !p.scored) {
          p.scored = true;
          gain(50, p.u, p.y);
        }
        // ce qui reposait dessus perd son appui
        for (const q of pieces) {
          if (q.state !== "static" || !q.sup.includes(p)) continue;
          q.sup = q.sup.filter((s) => s !== p);
          const held = q.sup.filter((s) => s.state === "static");
          if (q.onRaft) continue;
          if (!held.length || held.every((s) => Math.abs(s.u - q.u) > hu(s))) {
            // plus rien dessous, ou porte-à-faux : il bascule à son tour
            q.va += (held.length ? Math.sign(q.u - held[0].u) : Math.sign(q.u - p.u) || 1) * -1.5;
            awake(q);
          }
        }
      };
      function gain(pts, u, y, text) {
        score += pts;
        if (ctx.active()) {
          const [px, py] = screen(u, y + 0.5);
          hud.pop(text || "+" + pts, px, py, { color: pts >= 500 ? "#ffe45c" : undefined });
        }
      }
      function pop(p) {
        if (p.state === "gone") return;
        p.state = "gone";
        p.mesh.visible = false;
        feathers.burst(wx(), p.y + 0.3, wz(p.u), 14, 0.7);
        gain(500, p.u, p.y);
        if (ctx.active()) MF.sfx.play("pop");
        // un corbeau parti libère ce qui s'appuyait… rien ne s'appuie sur un corbeau
      }
      /** Point le plus proche d'un rectangle tourné (pièce p) pour un point (u, y) : renvoie la normale et la distance. */
      function nearest(p, u, y) {
        const c = Math.cos(p.a), s = Math.sin(p.a);
        const du = u - p.u, dy = y - p.y;
        // repère de la pièce : l'angle tourne dans le plan (u vers la droite de la caméra, y vers le haut)
        const lx = du * c + dy * s, ly = -du * s + dy * c;
        const cx = MF.clamp(lx, -p.w / 2, p.w / 2), cy = MF.clamp(ly, -p.h / 2, p.h / 2);
        const ex = lx - cx, ey = ly - cy;
        const d = Math.hypot(ex, ey);
        if (d < 1e-6) return { d: 0, nu: -Math.sign(du) || -1, ny: 0, lx: cx, ly: cy };
        return { d, nu: (ex * c - ey * s) / d, ny: (ex * s + ey * c) / d, lx: cx, ly: cy };
      }
      const raftAt = (u) => RAFTS.some((r) => Math.abs(u - r) < RAFT_W / 2);
      function stepPieces(dt) {
        let moving = false;
        for (const p of pieces) {
          if (p.state !== "dyn") continue;
          moving = true;
          p.vy -= G * dt;
          p.u += p.vu * dt;
          p.y += p.vy * dt;
          p.a += p.va * dt;
          const half = p.crow ? 0 : hy(p), halfW = hu(p);
          const low = p.y - half; // le dessous de la pièce
          // une pièce qui tombe réveille ou écrase ce qu'elle rencontre
          for (const q of pieces) {
            if (q === p || q.state === "gone") continue;
            const qc = q.crow ? q.y + 0.3 : q.y, pc = p.crow ? p.y + 0.3 : p.y;
            if (Math.abs(q.u - p.u) > hu(q) + halfW || Math.abs(qc - pc) > hy(q) + (p.crow ? 0.3 : half)) continue;
            const speed = Math.hypot(p.vu, p.vy);
            if (q.crow && speed > 1.4) pop(q);
            else if (q.state === "static" && !q.crow && speed > 2.2 && low < top(q) - 0.12) {
              q.vu += p.vu * 0.45;
              q.vy += Math.max(0, p.vy * 0.2);
              q.va += (Math.random() - 0.5) * 2;
              p.vu *= 0.55;
              p.vy *= 0.55;
              awake(q);
            } else if (q.state === "static" && !q.crow && p.vy < 0 && low < top(q) && low > top(q) - 0.3 && Math.abs(q.u - p.u) < hu(q) + halfW * 0.4) {
              // se pose sur une pièce restée debout
              p.y = top(q) + half;
              p.vy *= -0.15;
              p.vu *= 0.6;
              if (settle1(p, dt)) rest(p, [q]);
            }
          }
          if (p.state !== "dyn") continue;
          if (low <= RAFT_Y && raftAt(p.u) && p.vy <= 0 && low > RAFT_Y - 0.5) {
            if (p.crow && p.vy < -3) {
              pop(p);
              continue;
            }
            p.y = RAFT_Y + half;
            p.vy *= -0.22;
            p.vu *= 0.7;
            if (settle1(p, dt)) rest(p, []);
          } else if (p.y < WATER - 0.1) {
            splash(p.u, p.crow ? 0.7 : 1);
            if (p.crow) pop(p);
            else {
              p.state = "gone";
              p.mesh.visible = false;
            }
          }
        }
        return moving;
      }
      /**
       * Une pièce qui touche un appui : debout sur un petit côté, elle bascule dès qu'elle penche trop ;
       * sinon elle revient à plat. Renvoie vrai quand elle peut s'immobiliser.
       */
      function settle1(p, dt) {
        if (p.crow) return Math.abs(p.vy) < 0.7 && Math.abs(p.vu) < 0.6;
        const quarter = Math.round(p.a / (Math.PI / 2)) * (Math.PI / 2);
        const lean = p.a - quarter;
        const upright = Math.abs(Math.round(p.a / (Math.PI / 2))) % 2 === 0;
        const bw = upright ? p.w : p.h, bh = upright ? p.h : p.w; // base et hauteur dans cette position
        const critical = Math.atan2(bw, bh) * 0.8;
        p.va *= 1 - Math.min(1, 4 * dt); // le frottement de l'appui freine la rotation
        if (Math.abs(lean) > critical) p.va += Math.sign(lean) * 11 * dt; // elle part à la renverse
        else {
          p.va -= lean * 45 * dt; // elle retombe sur sa base
          p.va *= 1 - Math.min(1, 10 * dt);
        }
        // une poussée de côté fait pencher ce qui est haut et étroit
        if (bh > bw * 1.5 && Math.abs(p.vu) > 0.3) p.va -= (p.vu / bh) * 4 * dt;
        p.life = (p.life || 0) + dt;
        return p.life > 5 || (Math.abs(lean) < 0.08 && Math.abs(p.va) < 0.6 && Math.abs(p.vy) < 0.8 && Math.abs(p.vu) < 0.6);
      }
      /** La pièce s'immobilise là où elle est, couchée ou debout (angle ramené au quart de tour le plus proche). */
      function rest(p, sup) {
        const low = foot(p);
        p.state = "static";
        p.vu = p.vy = p.va = 0;
        p.life = 0;
        p.sup = sup;
        p.onRaft = !sup.length;
        if (!p.crow) {
          p.a = Math.round(p.a / (Math.PI / 2)) * (Math.PI / 2);
          p.y = (sup.length ? top(sup[0]) : RAFT_Y) + hy(p);
        } else p.y = sup.length ? top(sup[0]) : Math.max(RAFT_Y, low);
      }
      function stepBall(dt) {
        if (!ball.on) return false;
        ball.age += dt;
        // pas fins : la citrouille est rapide
        const n = Math.max(1, Math.ceil((Math.hypot(ball.vu, ball.vy) * dt) / 0.12));
        const h = dt / n;
        for (let i = 0; i < n && ball.on; i++) {
          ball.vy -= G * h;
          ball.u += ball.vu * h;
          ball.y += ball.vy * h;
          for (const p of pieces) {
            if (p.state === "gone") continue;
            if (p.crow) {
              if (Math.hypot(p.u - ball.u, p.y + 0.3 - ball.y) < PR + 0.3) pop(p);
              continue;
            }
            const c = nearest(p, ball.u, ball.y);
            if (c.d >= PR) continue;
            const vn = ball.vu * c.nu + ball.vy * c.ny;
            ball.u += c.nu * (PR - c.d);
            ball.y += c.ny * (PR - c.d);
            if (vn >= 0) continue;
            const impact = -vn, mb = 4;
            if (impact > 1.3 || p.state === "dyn") {
              // la pièce encaisse : elle part, tourne, et ce qu'elle portait tombe
              const j = ((1.35 * impact) * (mb * p.m)) / (mb + p.m);
              awake(p);
              p.vu -= (c.nu * j) / p.m;
              p.vy -= (c.ny * j) / p.m;
              // couple : bras de levier (du centre de la pièce au point touché) × poussée
              const ru = ball.u - c.nu * PR - p.u, ry = ball.y - c.ny * PR - p.y;
              p.va += ((ru * -c.ny - ry * -c.nu) * j) / ((p.m * (p.w * p.w + p.h * p.h)) / 12 + 0.05);
              ball.vu = (ball.vu + (c.nu * j) / mb) * 0.55;
              ball.vy = (ball.vy + (c.ny * j) / mb) * 0.55;
              if (ctx.active()) MF.sfx.play(impact > 6 ? "choc" : "toc");
            } else {
              ball.vu -= 1.4 * vn * c.nu;
              ball.vy -= 1.4 * vn * c.ny;
            }
            ball.bounces += 1;
          }
          if (!ball.on) break;
          if (ball.y - PR <= RAFT_Y && raftAt(ball.u) && ball.vy < 0 && ball.y > RAFT_Y - 0.3) {
            ball.y = RAFT_Y + PR;
            ball.vy *= -0.3;
            ball.vu *= 0.5;
            ball.bounces += 1.5;
            if (ctx.active()) MF.sfx.play("toc");
          } else if (ball.u < 9.2 && ball.y - PR < world.heightAt(SX, wz(ball.u)) && ball.u > 0.5) {
            // retombée sur la berge
            ball.on = false;
          } else if (ball.y < WATER) {
            splash(ball.u, 1.3);
            ball.on = false;
          }
          if (ball.bounces > 4 || ball.age > 7 || ball.u > 34 || (ball.bounces >= 1.5 && Math.hypot(ball.vu, ball.vy) < 1.2)) ball.on = false;
        }
        ball.spin += dt * 6;
        ball.mesh.visible = ball.on;
        ball.mesh.position.set(wx(), ball.y, wz(ball.u));
        ball.mesh.rotation.x = -ball.spin;
        return true;
      }
      const velocity = (a) => ({ vu: Math.cos(a.angle) * a.power * VMAX, vy: Math.sin(a.angle) * a.power * VMAX });
      function launch() {
        const v = velocity(aim);
        Object.assign(ball, { on: true, u: REST.u, y: REST.y, vu: v.vu, vy: v.vy, bounces: 0, age: 0 });
        shots--;
        settle = 0;
        lastShot = session.time();
        stock.forEach((m, i) => (m.visible = i < shots - 1));
        MF.sfx.play("swing");
        session.send("lance", [Math.round(v.vu * 100) / 100, Math.round(v.vy * 100) / 100, score]);
      }
      const scores = new Map();
      session.on("lance", (d, peer) => {
        if (!Array.isArray(d)) return;
        scores.set(peer.uid, +d[2] || 0);
        const g = ghosts.find((x) => !x.on);
        if (g) Object.assign(g, { on: true, u: REST.u, y: REST.y, vu: MF.clamp(+d[0] || 0, -VMAX, VMAX), vy: MF.clamp(+d[1] || 0, -VMAX, VMAX) });
      });
      session.on("pts", (d, peer) => scores.set(peer.uid, +d || 0));

      function reset(seed) {
        buildPieces(seed);
        builtFor = seed;
        score = 0;
        shots = SHOTS;
        reported = bonusDone = warned = false;
        settle = 0;
        lastShot = -9;
        ball.on = false;
        ball.mesh.visible = false;
        drag = null;
        scores.clear();
        stock.forEach((m, i) => (m.visible = i < shots - 1));
      }
      buildPieces(1);

      return {
        pieces: () => pieces,
        ball,
        aim,
        launch: () => launch(),
        score: () => score,
        shots: () => shots,
        enter() {
          input.use({ layout: "pointer", buttons: [{ id: "a", label: "LAUNCH", key: "Space" }] });
          hud.stats([{ key: "score", label: "Score" }, { key: "left", label: "Pumpkins" }, { key: "crows", label: "Crows" }]);
          hud.hint(input.touch ? "Drag back anywhere, release to launch" : "Drag back with the mouse and release · or ← → power, ↑ ↓ angle, Space");
          sway = 0;
        },
        leave() {
          for (const d of dots) d.visible = false;
        },
        idle() {
          for (const g of ghosts) {
            g.on = false;
            g.mesh.visible = false;
          }
        },
        onPhase(state, prev) {
          if (state && state.phase === "countdown" && (!prev || prev.phase !== "countdown")) reset(state.seed);
        },
        update(dt, time) {
          const st = session.state, phase = st ? st.phase : "lobby";
          const t = session.time();
          const running = !!st && phase === "run";
          // les citrouilles des autres : vol simple, plouf
          for (const g of ghosts) {
            if (!g.on) continue;
            g.vy -= G * dt;
            g.u += g.vu * dt;
            g.y += g.vy * dt;
            g.mesh.visible = true;
            g.mesh.position.set(wx() + 0.9, g.y, wz(g.u));
            if (g.y < WATER || g.u > 34) {
              g.on = false;
              g.mesh.visible = false;
              if (g.y < WATER) splash(g.u, 1);
            }
          }
          for (const s of splashes) {
            if (s.t > 1) continue;
            s.t += dt * 1.6;
            s.ring.scale.setScalar((0.6 + s.t * 3.2) * (s.size || 1));
            s.ring.material.opacity = Math.max(0, 0.8 * (1 - s.t));
            if (s.t > 1) s.ring.visible = false;
          }
          feathers.update(dt);
          const mine = ctx.active() && !!st && session.inRoster() && (phase === "run" || phase === "countdown");
          if (mine && st.seed !== builtFor) reset(st.seed);
          const flying = stepBall(dt);
          const tumbling = stepPieces(dt);
          place();
          if (!ctx.active()) return true;

          const aspect = camera.aspect || 1.6;
          if (mine) {
            // vue de profil, depuis l'est : le lance-pierre à gauche, les radeaux à droite
            const mid = (RAFTS[2] + RAFT_W / 2 + 1 - 3) / 2, half = (RAFTS[2] + RAFT_W / 2 + 1 + 3) / 2 + 0.6;
            const fov = aspect < 1 ? 62 : 42;
            const dist = MF.clamp(half / (Math.tan((fov * Math.PI) / 360) * aspect), 16, 64);
            MF.cam.set(camera, { x: SX + dist, y: WATER + 4.6 + dist * 0.06, z: wz(mid) }, { x: SX, y: WATER + 3.4, z: wz(mid) }, fov);
            camera.updateMatrixWorld();
            const P = input.state.pointer, S = input.state;
            const canShoot = running && !reported && shots > 0 && !ball.on && !tumbling && t - lastShot > 0.5;
            // viser : on tire en arrière depuis n'importe où ; le lancer part dans l'autre sens
            if (canShoot && P.down) drag = { x: P.nx, y: P.ny };
            if (drag && P.isDown && canShoot) {
              // un geste d'un cinquième de l'écran donne la pleine puissance
              const du = (drag.x - P.nx) * half * 0.45, dy = ((drag.y - P.ny) * half * 0.45) / aspect;
              const len = Math.hypot(du, dy);
              if (len > 0.15) {
                aim.power = MF.clamp(len / PULL, 0.12, 1);
                aim.angle = MF.clamp(Math.atan2(dy, Math.max(0.05, du)), -0.25, 1.35);
              }
            } else if (S.x || S.y) {
              aim.power = MF.clamp(aim.power + S.x * 0.5 * dt, 0.12, 1);
              aim.angle = MF.clamp(aim.angle + S.y * 0.7 * dt, -0.25, 1.35);
            }
            const released = drag && (P.up || !P.isDown);
            if (canShoot && ((released && aim.power > 0.14) || S.hit.a)) launch();
            if (!P.isDown) drag = null;
            // la poche, les élastiques, la trajectoire
            const pull = canShoot ? aim.power * PULL * (drag || S.x || S.y ? 1 : 0.35) : 0;
            const pu = REST.u - Math.cos(aim.angle) * pull, py = REST.y - Math.sin(aim.angle) * pull;
            loaded.visible = canShoot || (running && shots > 0 && !ball.on);
            loaded.position.set(wx(), py, wz(pu));
            FORK.forEach((f, i) => {
              const b = bands[i];
              const ax = f.x, ay = f.y, az = SZ, bx = wx(), by = loaded.visible ? py : REST.y, bz = loaded.visible ? wz(pu) : SZ;
              b.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
              b.scale.z = Math.hypot(ax - bx, ay - by, az - bz);
              b.lookAt(bx, by, bz);
            });
            const v = velocity(aim);
            dots.forEach((d, i) => {
              const tt = 0.09 * (i + 1);
              d.visible = canShoot && (!!drag || S.x !== 0 || S.y !== 0 || input.touch === false);
              if (d.visible) d.position.set(wx(), REST.y + v.vy * tt - 0.5 * G * tt * tt, wz(REST.u + v.vu * tt));
            });
            // fin de coup, fin de partie
            const crows = pieces.filter((p) => p.crow && p.state !== "gone").length;
            if (running && !reported) {
              if (!flying && !tumbling) settle += dt;
              else settle = 0;
              if (!crows && !bonusDone && !flying && !tumbling) {
                bonusDone = true;
                if (shots > 0) {
                  gain(1000 * shots, RAFTS[1], RAFT_Y + 3, "ALL CLEAR! +" + 1000 * shots);
                  hud.flash("All clear! +" + 1000 * shots, { color: MF.PAL.yellow, hold: 2 });
                  MF.sfx.play("bravo");
                }
              }
              const out = (!crows && bonusDone) || (shots <= 0 && !flying && settle > 1.2) || t >= DURATION;
              if (out && settle > 0.9) {
                reported = true;
                session.report({ score, crows: pieces.filter((p) => p.crow).length - crows, left: shots });
              }
              if (t > DURATION - 15 && !warned) {
                warned = true;
                hud.flash("15 seconds left!", { color: MF.PAL.yellow });
              }
            }
            hud.set("score", score);
            hud.set("left", Math.max(0, shots));
            hud.set("crows", crows);
            if (running && Math.floor(time * 2) !== Math.floor((time - dt) * 2)) session.send("pts", score);
            hud.board(
              st.roster
                .map((p) => ({ name: p.name, color: p.color, self: p.uid === ctx.self.uid, score: p.uid === ctx.self.uid ? score : scores.get(p.uid) || 0 }))
                .sort((a, b) => b.score - a.score)
                .map((r) => ({ name: r.name, color: r.color, self: r.self, text: r.score + " pts" })),
            );
          } else {
            loaded.visible = false;
            for (const d of dots) d.visible = false;
            sway += dt;
            MF.cam.set(camera, { x: SX + 13 + Math.sin(sway * 0.2) * 2, y: DECK + 6.5, z: SZ + 7 }, { x: SX, y: WATER + 1.5, z: wz(13) }, 50);
          }
          return true;
        },
      };
    },
  });
})();
