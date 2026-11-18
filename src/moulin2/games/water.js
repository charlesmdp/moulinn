// La Fête du Moulin — Water Gun Race (la course aux pistolets à eau).
//
// Chacun son couloir : une tête de clown, la bouche grande ouverte, qui se balance. On maintient le
// clic et on garde le jet dans la bouche : le ballon au-dessus gonfle. Le premier ballon qui éclate
// gagne ; le temps mis pour le faire éclater est le score (le plus court est le meilleur). En solo,
// deux automates tiennent les couloirs voisins pour qu'il y ait course.
(function () {
  "use strict";
  const MF = globalThis.MoulinFete;
  const LANES = 5, ZT = -1.15, FILL = 11; // secondes de jet parfait pour faire éclater le ballon
  const laneX = (i) => (i - (LANES - 1) / 2) * 0.95;
  const COLORS = ["#ef4b3f", "#3fb4e8", "#f5c531", "#59c36a", "#c56ee0"];

  MF.booth({
    id: "water",
    title: "Water Gun Race",
    icon: "🔫",
    color: MF.PAL.teal,
    blurb: "Keep the jet in the clown's mouth · first balloon to pop wins",
    help: "Hold the click (or your finger, or Space) to spray, and keep the jet in your clown's open mouth while it sways: the balloon above swells. Pop it before the others. Your time is your score.",
    hint: "Hold to spray · keep the jet in the clown's mouth",
    at: { x: -42.6, z: -84.6, face: 0 },
    stall: { w: 5, colors: [MF.PAL.teal, MF.PAL.white] },
    duration: 45,
    maxPlayers: LANES,
    cam: { y: 1.62, z: 3.3, look: [0, 1.75, ZT], fov: 40 },
    button: "SPRAY",
    scoreLabel: "Balloon",
    scoreText: (b) => b.score + " %",
    liveText: (v) => (v >= 100 ? "POP!" : v + " %"),
    rank: (list) => list.slice().sort((a, b) => (a.time ? 0 : 1) - (b.time ? 0 : 1) || (a.time || 0) - (b.time || 0) || (b.fill || 0) - (a.fill || 0)),
    describe: (r) => (r.time ? "popped in " + MF.time(r.time) : "balloon " + (r.fill || 0) + " % full"),
    board: { label: "Fastest pop", better: "low", value: (r) => r.time, format: (v) => MF.time(v) },
    setup(b) {
      const THREE = b.THREE, d = b.decor;
      MF.box(4.9, 0.9, 0.5, MF.PAL.teal, { y: 0.45, z: ZT - 0.1, parent: d, cast: true });
      const lanes = [];
      for (let i = 0; i < LANES; i++) {
        const x = laneX(i);
        MF.cyl(0.03, 0.03, 0.75, MF.PAL.steel, { x, y: 2.35, z: ZT - 0.12, parent: d, seg: 6 }); // mât du ballon
        if (i) MF.box(0.04, 1.6, 0.6, MF.PAL.white, { x: x - 0.475, y: 1.7, z: ZT, parent: d });
        // la tête de clown (elle se balance) : visage, nez rouge, cheveux, bouche ouverte
        const head = MF.group({ x, y: 1.5, z: ZT, parent: b.live });
        MF.sphere(0.27, "#ffe9d6", { parent: head, seg: 14 });
        MF.sphere(0.07, "#ef4b3f", { y: 0.06, z: 0.26, parent: head, seg: 8 });
        for (const sx of [-1, 1]) {
          MF.sphere(0.13, COLORS[i], { x: sx * 0.27, y: 0.13, parent: head, seg: 8 });
          MF.sphere(0.035, MF.PAL.black, { x: sx * 0.1, y: 0.13, z: 0.24, parent: head, seg: 6 });
        }
        MF.cyl(0.105, 0.105, 0.06, "#2a0d12", { y: -0.1, z: 0.235, rx: Math.PI / 2, parent: head, seg: 14 });
        MF.torus(0.105, 0.025, "#ef4b3f", { y: -0.1, z: 0.26, parent: head, seg: 14, tubeSeg: 5 });
        MF.cone(0.16, 0.3, COLORS[i], { y: 0.36, parent: head, seg: 10 });
        MF.freeze(head);
        const balloon = MF.sphere(0.3, MF.mat(COLORS[i], { unique: true }), { x, y: 2.75, z: ZT - 0.12, parent: b.live, seg: 14 });
        balloon.scale.setScalar(0.25);
        lanes.push({ x, head, balloon, fill: 0, popped: false, phase: 0 });
      }
      // le jet : une file de gouttes le long d'une cloche, du pistolet à la cible
      const drops = [];
      for (let i = 0; i < 9; i++) {
        const m = MF.sphere(0.035, MF.mat("#8fd8ff", { basic: true }), { parent: b.live, seg: 5 });
        m.visible = false;
        drops.push(m);
      }
      const gun = MF.group({ parent: b.live });
      MF.box(0.07, 0.1, 0.34, "#ff9d2e", { parent: gun });
      MF.box(0.06, 0.16, 0.08, "#ff9d2e", { y: -0.1, z: 0.1, parent: gun });
      MF.cyl(0.05, 0.05, 0.14, "#3fb4e8", { y: 0.09, z: 0.06, parent: gun, seg: 8 });
      gun.visible = false;
      const spot = new THREE.Vector3(), mouth = new THREE.Vector3();
      let mine = 0, done = 0, robots = [], spraying = false, lastPts = 0;

      const sway = (lane, t) => {
        // plus le ballon gonfle, plus le clown s'agite (jusqu'à 70 % d'amplitude en plus, et des à-coups)
        const f = MF.clamp(lane.fill || 0, 0, 1);
        lane.head.position.x = lane.x + (0.27 + 0.19 * f) * Math.sin(t * 1.7 + lane.phase) + (0.08 + 0.13 * f) * Math.sin(t * 4.3 + lane.phase * 2);
        lane.head.position.y = 1.5 + (0.07 + 0.09 * f) * Math.sin(t * 2.9 + lane.phase);
      };
      const show = (lane) => {
        lane.balloon.visible = !lane.popped;
        lane.balloon.scale.setScalar(0.25 + 0.75 * Math.min(1, lane.fill));
      };
      return {
        lanes,
        camX: () => laneX(mine),
        reset() {
          const n = b.session.state.roster.length;
          mine = Math.max(0, b.session.slot()) % LANES;
          done = 0;
          const phase = b.rand() * 6;
          for (const l of lanes) Object.assign(l, { fill: 0, popped: false, phase }); // même balancement pour tous : la course est juste
          // en solo : deux automates, qui font éclater leur ballon vers 21 s et 27 s
          robots = n > 1 ? [] : [{ lane: lanes[(mine + 1) % LANES], rate: 1 / (20 + b.rand() * 3) }, { lane: lanes[(mine + LANES - 1) % LANES], rate: 1 / (25 + b.rand() * 5) }];
        },
        update() {
          const t = Math.max(0, b.t), me = lanes[mine];
          for (const l of lanes) sway(l, t);
          // le pistolet, en bas à droite, et le jet
          const p = b.hit(ZT + 0.2, "z", spot);
          spraying = b.playing && b.hold && !!p && !me.popped;
          gun.visible = b.t >= 0;
          gun.position.set(laneX(mine) + 0.28, 1.2, 2.5);
          if (p) gun.lookAt(b.root.localToWorld(mouth.copy(p)));
          for (let i = 0; i < drops.length; i++) {
            const m = drops[i];
            m.visible = spraying;
            if (!spraying) continue;
            const u = (i + ((b.time * 9) % 1)) / drops.length;
            m.position.lerpVectors(gun.position, p, u);
            m.position.y += 0.5 * u * (1 - u);
          }
          if (spraying) {
            mouth.set(me.head.position.x, me.head.position.y - 0.1, ZT + 0.24);
            if (Math.hypot(p.x - mouth.x, p.y - mouth.y) < 0.17) {
              me.fill += b.dt / FILL;
              if (me.fill >= 1) {
                me.popped = true;
                done = Math.round(b.t * 100) / 100;
                b.score = 100;
                MF.sfx.play("pop");
                MF.sfx.play("bravo");
                b.confetti(me.x, 2.75, ZT, 24);
                b.hud.flash("POP! " + MF.time(done), { color: MF.PAL.yellow, hold: 1.5 });
                b.finish();
              }
            }
            if (b.time - lastPts > 0.2) {
              lastPts = b.time;
              MF.sfx.play("clic");
            }
          }
          if (!me.popped) b.score = Math.min(99, Math.floor(me.fill * 100));
          // les autres couloirs : ballons des autres joueurs (ou des automates)
          if (b.playing) for (const r of robots) if (!r.lane.popped && (r.lane.fill += b.dt * r.rate) >= 1) {
            r.lane.popped = true;
            MF.sfx.play("pop");
          }
          const roster = b.session.state.roster;
          b.others().forEach((o) => {
            if (o.self) return;
            const l = lanes[roster.findIndex((q) => q.uid === o.uid) % LANES];
            if (!l || l === me) return;
            l.fill = o.score / 100;
            l.popped = o.score >= 100;
          });
          for (const l of lanes) show(l);
        },
        result: () => (done ? { time: done } : { dnf: true, fill: b.score }),
        leave() {
          gun.visible = false;
          for (const m of drops) m.visible = false;
        },
      };
    },
  });
})();
