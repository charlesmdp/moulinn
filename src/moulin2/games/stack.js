// Dream Mill Fest — Tech Stack (empiler les caisses, sur la rive sud du Grand étang).
//
// Une caisse glisse au-dessus de la pile, de gauche à droite : un clic (ou Espace) la lâche. Ce qui
// dépasse de la caisse du dessous est coupé et tombe ; la caisse suivante n'a plus que la largeur
// qui reste. Posée pile dessus (à 4 cm près), elle garde sa largeur, et trois « perfect » d'affilée
// la rélargissent un peu. Plus la pile monte, plus ça va vite : la caisse part d'un côté au hasard,
// change d'allure en route à partir du 12e étage, et devient à moitié transparente à partir du 25e.
// Une caisse lâchée à côté, et c'est fini. Le score est le nombre de caisses empilées. Les allures
// sont tirées de la graine de la partie : tous les joueurs empilent la même pile.
(function () {
  "use strict";
  const MF = globalThis.MoulinFete;
  const LIFT = 0.45, HC = 0.42, W0 = 2.2, DEPTH = 1.1, SPAN = 3.4, ZP = -1.6, KEEP = 16;
  const NAMES = ["HTML", "CSS", "JS", "SQL", "REACT", "NODE", "POSTGRES", "REDIS", "DOCKER", "STRIPE", "NEXT", "TAILWIND", "RAILS", "PYTHON", "RUST", "GO", "SQLITE", "HTMX", "KAFKA", "AI"];
  const COLORS = ["#e8402c", "#ff8a2a", "#ffc93a", "#2e9e5b", "#2f7fd8", "#7b4bd6", "#e84a8a", "#16a085"];

  MF.booth({
    id: "stack",
    title: "Tech Stack",
    icon: "📦",
    color: "#7b4bd6",
    blurb: "Drop each crate right on top · the stack gets thinner and faster",
    help: "A crate slides above the stack: click (or press Space) to drop it. Whatever overhangs is cut off, so the next crate is narrower. A perfect drop keeps the width, three in a row widen it. It gets faster with every floor. Miss the stack and it's over: your score is the number of crates stacked.",
    hint: "Click or press Space to drop the crate exactly on the stack",
    touchHint: "Tap to drop the crate exactly on the stack",
    at: { x: -45, z: 123.5, face: Math.PI },
    stall: false,
    size: { w: 5, d: 3.2 },
    hall: [4.2, 2.6],
    maxTime: 900,
    cam: { y: 2.6 + LIFT, z: 5.4, look: [0, 1.9 + LIFT, ZP], fov: 46 },
    cross: false,
    button: "DROP",
    scoreLabel: "Crates",
    stats: [{ key: "width", label: "Width" }],
    describe: (r) => "stacked " + (r.score || 0) + " crates",
    board: { label: "Tallest stack", better: "high", value: (r) => r.score, format: (v) => v + " crates" },
    setup(b) {
      const THREE = b.THREE, d = MF.group({ y: LIFT, parent: b.decor }), live = MF.group({ y: LIFT, parent: b.live });
      // une estrade (la rive penche), la palette de départ, deux rails, l'enseigne à côté
      MF.box(6.4, 1.5, 2.4, MF.PAL.woodDark, { y: -0.75, z: ZP, parent: d, cast: true });
      MF.box(3.2, 0.16, 1.5, MF.PAL.wood, { y: 0.08, z: ZP, parent: d, cast: true });
      for (const sx of [-1, 1]) MF.box(0.5, 0.1, 1.5, MF.PAL.woodDark, { x: sx * 1.1, y: 0.03, z: ZP, parent: d });
      const sign = MF.sign("TECH STACK", { w: 2.8, h: 0.54, bg: "#7b4bd6", color: "#ffffff", border: MF.PAL.yellow, double: true });
      sign.position.set(-3.6, 2.3, ZP - 0.4); // à côté de la pile, face au public
      sign.rotation.y = 0.35;
      d.add(sign);
      for (const sx of [-1, 1]) MF.cyl(0.05, 0.05, 2.3, MF.PAL.woodDark, { x: -3.6 + sx * 1.3, y: 1.15, z: ZP - 0.4 - sx * 0.47, parent: d, seg: 6 });
      const rails = MF.group({ parent: live });
      for (const sx of [-1, 1]) MF.cyl(0.05, 0.05, 30, MF.PAL.steel, { x: sx * 2.5, z: ZP, parent: rails, seg: 6 });
      // les caisses : un petit nombre de maillages, réemployés à mesure que la pile monte
      const geo = new THREE.BoxGeometry(1, HC - 0.02, DEPTH);
      const mats = COLORS.map((c) => MF.mat(c)), ghost = COLORS.map((c) => MF.mat(c, { opacity: 0.45 }));
      const pool = [];
      for (let i = 0; i < KEEP + 1; i++) {
        const m = new THREE.Mesh(geo, mats[0]);
        m.castShadow = true;
        m.visible = false;
        live.add(m);
        pool.push(m);
      }
      const labels = NAMES.map((text) => {
        const s = MF.sign(text, { w: 1.0, h: 0.24, px: 96, bg: "#fff3d6", color: "#2b1a10", border: "#2b1a10" });
        s.visible = false;
        live.add(s);
        return s;
      });
      const slider = new THREE.Mesh(geo, mats[1]);
      live.add(slider);
      const cable = MF.cyl(0.015, 0.015, 8, MF.PAL.ink, { parent: live, seg: 4 });
      const chip = new THREE.Mesh(geo, mats[0]); // le morceau coupé, qui tombe
      chip.visible = false;
      live.add(chip);
      let n = 0, w = W0, cx = 0, sx = 0, dir = 1, speed = 0, phase = 0, streak = 0, lost = 0, camY = 0, chipV = 0, wobble = 0, wasA = false;
      const top = () => 0.16 + n * HC; // dessus de la pile
      function place(mesh, x, y, width, color, faint) {
        mesh.visible = true;
        mesh.position.set(x, y, ZP);
        mesh.scale.x = width;
        mesh.material = (faint ? ghost : mats)[color % COLORS.length];
      }
      /** Nouvelle caisse au-dessus de la pile : côté, allure. */
      function next() {
        dir = b.rand() < 0.5 ? -1 : 1;
        sx = -dir * SPAN;
        speed = (2.1 + n * 0.16) * (0.9 + b.rand() * 0.25);
        phase = b.rand() * 6.28;
      }
      function start() {
        n = streak = lost = camY = wobble = 0;
        w = W0;
        cx = 0;
        chip.visible = false;
        for (const m of pool) m.visible = false;
        for (const l of labels) l.visible = false;
        next();
      }
      start();
      slider.visible = cable.visible = false;
      return {
        reset: start,
        camX: () => 0,
        view(_, from, to) {
          from.y += camY;
          to.y += camY;
        },
        update() {
          const dt = b.dt, K = b.input.state, drop = (b.press || (K.a && !wasA)) && b.playing && !lost;
          wasA = !!K.a;
          if (b.playing && !lost) {
            // la caisse va et vient ; à partir du 12e étage son allure ondule
            const pace = n >= 12 ? 1 + Math.sin(b.t * 3.1 + phase) * Math.min(0.55, (n - 11) * 0.05) : 1;
            sx += dir * speed * pace * dt;
            if (Math.abs(sx) > SPAN) {
              sx = Math.sign(sx) * SPAN;
              dir = -dir;
            }
            if (drop) {
              const off = sx - cx, over = w - Math.abs(off);
              if (over <= 0.03) {
                // à côté : la caisse tombe, c'est fini
                lost = b.t;
                place(chip, sx, top() + HC / 2, w, n, false);
                chipV = 0;
                b.hud.flash("Missed! " + n + " crates stacked", { color: MF.PAL.yellow, hold: 1.8 });
                MF.sfx.play("perdu");
                b.finish();
              } else {
                let nx = cx + off / 2, nw = over;
                if (Math.abs(off) < 0.04) {
                  nx = cx;
                  nw = w;
                  streak++;
                  if (streak % 3 === 0) nw = Math.min(W0, w + 0.25);
                  b.hud.pop(streak % 3 === 0 ? "Perfect ×3: wider!" : "Perfect!", ...b.screen(new THREE.Vector3(cx, top() + HC + LIFT, ZP)));
                  MF.sfx.play("ting");
                } else {
                  streak = 0;
                  // le morceau qui dépasse tombe
                  place(chip, cx + (off > 0 ? 1 : -1) * (w / 2 + Math.abs(off) / 2), top() + HC / 2, Math.abs(off), n, false);
                  chipV = 0;
                  MF.sfx.play("toc");
                }
                place(pool[n % pool.length], nx, top() + HC / 2, nw, n, false);
                const label = labels[n % labels.length];
                label.visible = nw > 0.7;
                label.position.set(nx, top() + HC / 2, ZP + DEPTH / 2 + 0.012);
                cx = nx;
                w = nw;
                n++;
                wobble = 1;
                b.score = n;
                next();
              }
            }
          }
          // le morceau coupé tombe ; la pile tremble à chaque caisse posée
          if (chip.visible) {
            chipV -= 14 * dt;
            chip.position.y += chipV * dt;
            chip.rotation.z += dt * 2;
            if (chip.position.y < camY - 3) chip.visible = false;
          } else chip.rotation.z = 0;
          wobble = Math.max(0, wobble - dt * 3);
          camY = MF.damp(camY, Math.max(0, top() - 1.6), 4, dt);
          rails.position.y = camY + 3;
          slider.visible = b.playing && !lost;
          place(slider, sx, top() + HC / 2 + 0.5 + Math.sin(b.time * 30) * 0.01 * wobble, w, n, n >= 25);
          slider.visible = b.playing && !lost;
          cable.visible = slider.visible;
          cable.position.set(sx, top() + HC + 0.5 + 4, ZP);
        },
        hud() {
          b.hud.set("width", Math.round((w / W0) * 100) + " %");
        },
        idle() {
          slider.visible = cable.visible = false;
        },
        probe: () => ({ sx, cx, w, n }), // pour les essais automatiques
      };
    },
  });
})();
