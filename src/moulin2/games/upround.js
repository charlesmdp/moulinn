// Dream Mill Fest — Up Round (le sauteur vertical, sur la rive sud du Grand étang).
//
// Le fondateur rebondit tout seul, de planche en planche, toujours plus haut : on le dirige à
// gauche et à droite (← →, ou la souris / le doigt), et l'on ressort de l'autre côté quand on sort
// de l'écran. La caméra ne redescend jamais : tomber sous l'écran, c'est fini. Plus on monte, plus
// c'est dur : planches plus étroites et plus espacées, planches bleues qui glissent, planches
// fissurées (« vaporware ») qui cèdent au premier appui, et, à partir de 40 m, des ours (« bear
// market ») qui font lâcher prise si on les touche par-dessous — mais sur lesquels on rebondit
// très haut si on leur tombe dessus. Les trampolines (« viral loop ») propulsent d'un coup.
// Le score est la hauteur atteinte. Les planches sont tirées de la graine : la même tour pour tous.
(function () {
  "use strict";
  const MF = globalThis.MoulinFete;
  const LIFT = 0.45, HALF = 3, ZP = -2, G = 22, JUMP = 10.6, SPRING = 17.5, N = 26, VIEW = 5.2;
  const TYPES = { plank: "#c98a4b", slide: "#2f7fd8", crack: "#8a6a45", spring: "#e8402c" };

  MF.booth({
    id: "upround",
    title: "Up Round",
    icon: "🦘",
    color: "#ff8a2a",
    blurb: "Bounce from plank to plank, ever higher · don't fall off the screen",
    help: "Your founder bounces by himself: steer him left and right with ← → (or the mouse / your finger) to land on the next plank. Leaving one side brings you back on the other. Blue planks slide, cracked ones break, red trampolines send you flying, and bears knock you down unless you land on them. The camera never goes back down: fall below the screen and it's over. Your score is the height you reached.",
    hint: "Steer with ← → or the mouse · land on the planks, never fall",
    touchHint: "Slide your finger left and right · land on the planks",
    at: { x: -38.5, z: 123, face: Math.PI },
    stall: false,
    size: { w: 7, d: 3 },
    hall: [4.8, 2.8],
    maxTime: 900,
    cam: { y: 3.1 + LIFT, z: 8.4, look: [0, 3.1 + LIFT, ZP], fov: 46 },
    cross: false,
    button: "GO",
    scoreLabel: "Height",
    stats: [{ key: "round", label: "Round" }],
    scoreText: (b) => b.score + " m",
    liveText: (v) => v + " m",
    describe: (r) => "climbed " + (r.score || 0) + " m",
    board: { label: "Highest round", better: "high", value: (r) => r.score, format: (v) => v + " m" },
    setup(b) {
      const THREE = b.THREE, d = MF.group({ y: LIFT, parent: b.decor }), live = MF.group({ y: LIFT, parent: b.live });
      // une estrade (la rive penche), le socle, l'enseigne devant, deux mâts qui suivent la montée
      MF.box(7.6, 1.5, 2.6, MF.PAL.woodDark, { y: -0.75, z: ZP + 0.3, parent: d, cast: true });
      MF.box(7, 0.2, 1.6, MF.PAL.wood, { y: 0.1, z: ZP, parent: d, cast: true });
      const sign = MF.sign("UP ROUND", { w: 2.6, h: 0.54, bg: "#ff8a2a", color: "#ffffff", border: "#ffffff", double: true });
      sign.position.set(0, 0.5, ZP + 1.0); // posée devant le socle
      d.add(sign);
      const rails = MF.group({ parent: live });
      for (const sx of [-1, 1]) MF.cyl(0.07, 0.07, 40, "#ffffff", { x: sx * (HALF + 0.35), z: ZP, parent: rails, seg: 6 });
      const geo = new THREE.BoxGeometry(1, 0.16, 0.6);
      const mats = Object.fromEntries(Object.entries(TYPES).map(([k, c]) => [k, MF.mat(c)]));
      const planks = [];
      for (let i = 0; i < N; i++) {
        const m = new THREE.Mesh(geo, mats.plank);
        m.castShadow = true;
        live.add(m);
        planks.push({ m, x: 0, y: 0, w: 1, type: "plank", vx: 0, live: false });
      }
      // deux ours en réserve
      const bears = [0, 1].map(() => {
        const g = MF.group({ parent: live });
        MF.sphere(0.36, "#6b4a2e", { parent: g, seg: 10 }).scale.set(1.15, 1, 0.8);
        for (const sx of [-1, 1]) MF.sphere(0.13, "#6b4a2e", { x: sx * 0.26, y: 0.3, parent: g, seg: 7 });
        MF.sphere(0.14, "#d9b38c", { y: -0.06, z: 0.24, parent: g, seg: 7 });
        for (const sx of [-1, 1]) MF.sphere(0.04, MF.PAL.ink, { x: sx * 0.13, y: 0.1, z: 0.27, parent: g, seg: 5 });
        g.visible = false;
        return { g, x: 0, y: 0, vx: 0, live: false };
      });
      const jack = MF.Presence.buildAvatar(b.ctx.self.color, null, null);
      jack.tag.visible = false;
      if (jack.shadow) jack.shadow.visible = false;
      jack.group.scale.setScalar(0.62);
      live.add(jack.group);
      const flags = [];
      for (let i = 0; i < 6; i++) {
        const m = MF.box(0.4, 0.22, 0.02, MF.mat("#ffffff", { unique: true }), { x: -HALF - 0.62, z: ZP, parent: live });
        m.visible = false;
        flags.push(m);
      }
      let x = 0, y = 0, vx = 0, vy = 0, cam = 0, top = 0, best = 0, dead = 0, stun = 0, nextBear = 40, squash = 0;
      /** Planche suivante, au-dessus de la plus haute : écart, largeur et type selon la hauteur. */
      function grow() {
        const p = planks.find((q) => !q.live);
        if (!p) return false;
        const h = top, prev = planks.reduce((a, q) => (q.live && q.y > a.y ? q : a), { y: -1, type: "plank" });
        top += Math.min(1.95, 1.0 + h / 110) * (0.75 + b.rand() * 0.45);
        p.live = true;
        p.y = top;
        p.x = (b.rand() * 2 - 1) * (HALF - 0.5);
        p.w = Math.max(0.85, 1.7 - h / 130) * (0.85 + b.rand() * 0.3);
        const r = b.rand();
        // jamais deux planches fissurées de suite : il y a toujours un appui sûr à portée
        p.type = r < 0.06 ? "spring" : r < 0.06 + Math.min(0.32, h / 220) && prev.type !== "crack" && h > 25 ? "crack" : r > 1 - Math.min(0.36, h / 160) && h > 12 ? "slide" : "plank";
        p.vx = p.type === "slide" ? (b.rand() < 0.5 ? -1 : 1) * (1.1 + Math.min(2.2, h / 60)) : 0;
        p.m.material = mats[p.type];
        p.m.scale.set(p.w, p.type === "spring" ? 1.6 : 1, 1);
        // un ours, de temps en temps, à partir de 40 m
        if (top > nextBear) {
          nextBear = top + 16 + b.rand() * 14 - Math.min(8, h / 40);
          const bear = bears.find((q) => !q.live);
          if (bear) Object.assign(bear, { live: true, x: (b.rand() * 2 - 1) * 2, y: top + 0.9, vx: (b.rand() < 0.5 ? -1 : 1) * (0.8 + Math.min(1.6, h / 120)) });
        }
        return true;
      }
      function start() {
        x = vx = cam = best = dead = stun = squash = 0;
        y = 0.2;
        vy = JUMP;
        top = 0;
        nextBear = 40;
        for (const p of planks) p.live = false;
        for (const q of bears) q.live = false;
        while (top < 14 && grow());
        draw();
      }
      function draw() {
        for (const p of planks) {
          p.m.visible = p.live;
          if (p.live) p.m.position.set(p.x, p.y - 0.08, ZP);
        }
        for (const q of bears) {
          q.g.visible = q.live;
          if (q.live) q.g.position.set(q.x, q.y, ZP);
        }
        rails.position.y = cam + 4;
        jack.group.visible = !dead || b.t - dead < 1.2;
        jack.group.position.set(x, y, ZP);
        jack.group.scale.set(0.62, 0.62 * (1 - squash * 0.25), 0.62);
        jack.body.rotation.y = MF.clamp(vx * 0.12, -0.8, 0.8);
        jack.body.rotation.z = stun > 0 ? Math.sin(b.time * 30) * 0.5 : 0;
        const up = vy > 0 ? 1 : 0;
        jack.arms[0].rotation.set(0, 0, -0.6 - up * 1.9);
        jack.arms[1].rotation.set(0, 0, 0.6 + up * 1.9);
        jack.legs[0].rotation.x = up ? 0.15 : -0.5;
        jack.legs[1].rotation.x = up ? -0.15 : -0.5;
      }
      start();
      return {
        reset() {
          jack.setHat(b.ctx.self.hat);
          start();
        },
        camX: () => 0,
        view(_, from, to) {
          from.y += cam;
          to.y += cam;
          // écran étroit (téléphone tenu debout) : on recule pour voir toute la largeur
          from.z = ZP + (from.z - ZP) * Math.max(1, 0.85 / (b.camera.aspect || 1));
        },
        update() {
          const dt = Math.min(b.dt, 0.05), K = b.input.state;
          if (b.playing && !dead) {
            // direction : flèches, sinon le fondateur suit la souris ou le doigt
            stun = Math.max(0, stun - dt);
            squash = Math.max(0, squash - dt * 5);
            const want = stun > 0 ? 0 : K.x ? K.x * 6.5 : b.aim.keys ? 0 : MF.clamp((b.aim.x * (HALF + 0.6) - x) * 9, -7.5, 7.5);
            vx = MF.damp(vx, want, K.x ? 12 : 16, dt);
            x += vx * dt;
            if (x > HALF + 0.3) x -= 2 * HALF + 0.6;
            else if (x < -HALF - 0.3) x += 2 * HALF + 0.6;
            const y0 = y;
            vy -= G * dt;
            y += vy * dt;
            for (const p of planks) {
              if (!p.live) continue;
              if (p.vx) {
                p.x += p.vx * dt;
                if (Math.abs(p.x) > HALF - p.w / 2) p.vx = -Math.sign(p.x) * Math.abs(p.vx);
              }
              // on ne se pose qu'en descendant, les pieds passant le dessus de la planche
              if (vy < 0 && y0 >= p.y && y <= p.y && Math.abs(x - p.x) < p.w / 2 + 0.18) {
                y = p.y;
                squash = 1;
                if (p.type === "crack") {
                  p.live = false;
                  vy = JUMP * 0.55;
                  MF.sfx.play("toc");
                } else {
                  vy = p.type === "spring" ? SPRING : JUMP;
                  MF.sfx.play(p.type === "spring" ? "boing" : "clic");
                }
              }
              if (p.y < cam - 1) p.live = false;
            }
            for (const q of bears) {
              if (!q.live) continue;
              q.x += q.vx * dt;
              if (Math.abs(q.x) > HALF - 0.4) q.vx = -Math.sign(q.x) * Math.abs(q.vx);
              if (q.y < cam - 1) q.live = false;
              else if (Math.abs(x - q.x) < 0.55 && y < q.y + 0.4 && y + 1.0 > q.y - 0.3) {
                if (vy < 0 && y0 >= q.y + 0.25) {
                  // tombé sur l'ours : gros rebond, l'ours s'en va
                  q.live = false;
                  vy = SPRING * 0.9;
                  b.hud.pop("Bear trap!", ...b.screen(new THREE.Vector3(q.x, q.y + LIFT, ZP)));
                  MF.sfx.play("boing");
                } else if (stun <= 0) {
                  stun = 0.7;
                  vy = Math.min(vy, -5);
                  b.hud.flash("Bear market!", { color: "#ffb347", hold: 0.6 });
                  MF.sfx.play("choc");
                }
              }
            }
            while (top < cam + VIEW + 9 && grow());
            cam = Math.max(cam, y - 2.6);
            best = Math.max(best, y);
            b.score = Math.floor(best);
            if (y < cam - 1.2) {
              dead = b.t;
              b.hud.flash("Down round at " + b.score + " m", { color: MF.PAL.yellow, hold: 1.8 });
              MF.sfx.play("perdu");
              b.finish();
            }
          } else if (dead) {
            vy -= G * dt;
            y += vy * dt;
          }
          draw();
          const others = b.others().filter((o) => !o.self);
          flags.forEach((m, i) => {
            const o = others[i];
            m.visible = !!o && o.score > cam - 1 && o.score < cam + 2 * VIEW;
            if (!m.visible) return;
            m.material.color.copy(MF.color(o.color));
            m.position.y = o.score;
          });
        },
        hud() {
          b.hud.set("round", b.score < 15 ? "pre-seed" : b.score < 40 ? "seed" : b.score < 80 ? "series A" : b.score < 130 ? "series B" : b.score < 200 ? "series C" : "IPO");
        },
        idle() {
          if (!dead) draw();
        },
        probe: () => ({ x, y, vy, cam, planks: planks.filter((p) => p.live && p.type !== "crack").map((p) => [p.x, p.y]) }), // pour les essais automatiques
      };
    },
  });
})();
