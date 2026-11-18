// Dream Mill Fest — Burn Rate (la cabine à billets, sur la rive sud du Grand étang).
//
// Dans la cabine, une soufflerie fait voler les billets. On promène son épuisette (la souris, le
// doigt ou les flèches) pour les attraper : chaque billet rallonge la piste (« runway »), une
// « term sheet » dorée la rallonge beaucoup, une facture rouge la raccourcit. Mais la caisse se vide
// toute seule, de plus en plus vite (le « burn rate »), les billets filent de plus en plus et les
// factures se multiplient : la partie s'arrête quand il ne reste plus rien. Le score est le temps
// tenu. Les billets sont tirés de la graine de la partie : la même soufflerie pour tous.
(function () {
  "use strict";
  const MF = globalThis.MoulinFete;
  const ZP = -1.5, X1 = 1.75, Y0 = 0.55, Y1 = 3.35, CAP = 16, N = 18;
  const KINDS = [
    { color: "#3fbf6a", w: 0.34, h: 0.17, gain: 1.4, text: "+1.4 s" }, // billet
    { color: "#e8402c", w: 0.3, h: 0.36, gain: -3.5, text: "Invoice! −3.5 s" }, // facture
    { color: "#ffc93a", w: 0.36, h: 0.26, gain: 4, text: "Term sheet! +4 s" }, // term sheet
  ];

  MF.booth({
    id: "burn",
    title: "Burn Rate",
    icon: "💸",
    color: "#2e9e5b",
    blurb: "Catch the cash before your runway runs out · it burns faster and faster",
    help: "Move your net over the flying bills (mouse, finger or arrow keys): each one adds runway, golden term sheets add a lot, red invoices take some away. Your cash burns by itself, faster and faster. When the runway is empty, it's over: your score is how long you lasted.",
    hint: "Sweep the net over the green bills · avoid the red invoices",
    touchHint: "Drag the net over the green bills · avoid the red invoices",
    at: { x: -47.5, z: 113, face: 0 },
    stall: { w: 4.4, d: 3.0, h: 3.7, colors: ["#2e9e5b", "#ffffff"], counter: false },
    hall: [3.6, 2.6],
    maxTime: 900,
    cam: { y: 1.95, z: 4.3, look: [0, 1.95, ZP], fov: 46 },
    cross: false,
    button: "GO",
    scoreLabel: "Alive",
    stats: [{ key: "burn", label: "Burn" }],
    scoreText: (b) => (b.score / 10).toFixed(1) + " s",
    liveText: (v) => (v / 10).toFixed(1) + " s",
    describe: (r) => "stayed alive " + ((r.score || 0) / 10).toFixed(1) + " s",
    board: { label: "Longest runway", better: "high", value: (r) => r.score, format: (v) => (v / 10).toFixed(1) + " s" },
    setup(b) {
      const d = b.decor, THREE = b.THREE;
      // la cabine vitrée et sa soufflerie
      MF.box(3.9, 3.2, 0.06, MF.mat("#bfe6f2", { opacity: 0.28 }), { y: 1.95, z: ZP - 0.5, parent: d });
      for (const sx of [-1, 1]) MF.box(0.1, 3.2, 0.1, MF.PAL.steel, { x: sx * 1.95, y: 1.95, z: ZP, parent: d });
      MF.box(4.0, 0.12, 0.12, MF.PAL.steel, { y: 3.55, z: ZP, parent: d });
      MF.cyl(0.7, 0.8, 0.3, "#3a3d46", { y: 0.3, z: ZP - 0.1, parent: d, seg: 14 });
      const fan = MF.group({ y: 0.47, z: ZP - 0.1, parent: b.live });
      for (let i = 0; i < 4; i++) MF.box(1.2, 0.03, 0.2, "#9aa3ad", { ry: (i * Math.PI) / 4, parent: fan });
      const mats = KINDS.map((k) => MF.mat(k.color, { side: "double" }));
      const geo = new THREE.PlaneGeometry(1, 1);
      const bills = [];
      for (let i = 0; i < N; i++) {
        const m = new THREE.Mesh(geo, mats[0]);
        m.visible = false;
        b.live.add(m);
        bills.push({ m, x: 0, y: 0, vx: 0, vy: 0, kind: 0, live: false, age: 0, spin: 0 });
      }
      const net = MF.group({ parent: b.live });
      MF.torus(0.32, 0.035, "#ffffff", { parent: net, seg: 18, tubeSeg: 6 });
      MF.cyl(0.025, 0.025, 0.7, MF.PAL.wood, { x: 0.36, y: -0.5, rz: 0.6, parent: net, seg: 5 });
      net.visible = false;
      const at = new THREE.Vector3(), where = new THREE.Vector3();
      let runway = 0, spawn = 0, dead = false, nx = 0, ny = 2;
      const burn = () => 1 + b.t / 17;
      return {
        reset() {
          runway = 11;
          spawn = 0.3;
          dead = false;
          for (const p of bills) p.live = p.m.visible = false;
        },
        update() {
          const dt = b.dt, t = b.t;
          fan.rotation.y += dt * 14;
          // l'épuisette suit le viseur, dans la cabine
          const h = b.hit(ZP, "z", at);
          if (h) {
            nx = MF.clamp(h.x, -X1, X1);
            ny = MF.clamp(h.y, Y0, Y1);
          }
          net.visible = b.playing && !dead;
          net.position.set(nx, ny, ZP + 0.05);
          if (b.playing && !dead) {
            // nouveaux billets : de plus en plus nombreux, de plus en plus de factures
            spawn -= dt;
            if (spawn <= 0) {
              spawn = Math.max(0.22, 0.62 - t / 150) * (0.6 + b.rand() * 0.8);
              const p = bills.find((q) => !q.live), r = b.rand();
              if (p) {
                p.live = true;
                p.kind = r < Math.min(0.5, 0.14 + t / 110) ? 1 : r > 0.95 ? 2 : 0;
                p.x = (b.rand() * 2 - 1) * X1 * 0.9;
                p.y = Y0;
                const fast = 1 + t / 45;
                p.vx = (b.rand() * 2 - 1) * 1.4 * fast;
                p.vy = (1.6 + b.rand() * 1.6) * fast;
                p.age = 0;
                p.spin = (b.rand() * 2 - 1) * 5;
                p.m.material = mats[p.kind];
                p.m.scale.set(KINDS[p.kind].w, KINDS[p.kind].h, 1);
              }
            }
            runway -= burn() * dt;
            for (const p of bills) {
              if (!p.live) continue;
              p.age += dt;
              // tourbillon : les billets montent, virevoltent, rebondissent sur les vitres, puis retombent
              p.vx += Math.sin(p.age * 3.1 + p.spin) * 3.2 * dt;
              p.vy += (p.age < 2.2 ? 0.6 : -2.6) * dt;
              p.x += p.vx * dt;
              p.y += p.vy * dt;
              if (Math.abs(p.x) > X1) {
                p.x = Math.sign(p.x) * X1;
                p.vx = -p.vx * 0.8;
              }
              if (p.y > Y1) {
                p.y = Y1;
                p.vy = -Math.abs(p.vy) * 0.6;
              }
              if (p.y < Y0 - 0.2) p.live = false;
              else if (Math.hypot(p.x - nx, p.y - ny) < 0.38) {
                const k = KINDS[p.kind];
                p.live = false;
                runway = Math.min(CAP, runway + k.gain);
                b.hud.pop(k.text, ...b.screen(where.set(p.x, p.y, ZP)), { color: k.gain < 0 ? "#ff6b6b" : p.kind === 2 ? "#ffe45c" : undefined });
                MF.sfx.play(k.gain < 0 ? "choc" : p.kind === 2 ? "bravo" : "ting");
              }
              p.m.visible = p.live;
              p.m.position.set(p.x, p.y, ZP);
              p.m.rotation.set(Math.sin(p.age * 6 + p.spin) * 0.9, p.age * p.spin, Math.sin(p.age * 2.3) * 0.6);
            }
            b.score = Math.round(t * 10);
            if (runway <= 0) {
              dead = true;
              b.hud.gauge(null);
              b.hud.flash("Out of runway after " + t.toFixed(1) + " s", { color: MF.PAL.yellow, hold: 1.8 });
              MF.sfx.play("perdu");
              b.finish();
            } else b.hud.gauge(runway / CAP, "Runway");
          } else b.hud.gauge(null);
        },
        hud() {
          b.hud.set("burn", "× " + burn().toFixed(1));
        },
        idle() {
          fan.rotation.y += b.dt * 6;
          net.visible = false;
          b.hud.gauge(null);
        },
        leave() {
          b.hud.gauge(null);
        },
      };
    },
  });
})();
