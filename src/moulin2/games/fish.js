// La Fête du Moulin — Hooked (le concours de pêche, sur le petit étang).
//
// 60 secondes au bout d'un ponton. Le bouchon flotte ; quand il plonge, on clique tout de suite
// pour ferrer (trop tôt : le poisson s'en va). Puis on mouline en maintenant le clic, en gardant la
// tension dans le vert : trop tendu, le fil casse ; trop mou, le poisson se décroche. Menu fretin,
// truites, et de temps en temps une « baleine » : le poids pêché est le score.
(function () {
  "use strict";
  const MF = globalThis.MoulinFete;
  const ZB = -5.2;
  // poids (kg), durée de moulinage (s), nervosité, nom
  const KINDS = [[0.3, 1.4, 0.5, "Minnow (free user)"], [1.2, 2.0, 0.8, "Trout (paying customer)"], [2.6, 2.6, 1.1, "Pike (annual plan)"], [8, 3.6, 1.5, "WHALE (enterprise deal)"]];

  MF.booth({
    id: "fish",
    title: "Hooked",
    icon: "🎣",
    color: "#2980b9",
    blurb: "60 seconds · strike when the float dips, reel with a steady hand",
    help: "When the float dips, click at once to strike (too early and the fish swims off). Then hold the click to reel and keep the tension in the middle of the gauge: too tight and the line snaps, too slack and the fish gets away. Kilos landed are your score.",
    hint: "Click when the float dips · then hold to reel, tension in the middle",
    at: { x: 134, z: -24.4, face: 0 },
    stall: false,
    size: { w: 2.4, d: 1.0 },
    hall: [-2.2, 14.6],
    duration: 60,
    cam: { y: 1.9, z: 1.9, look: [0, 0.2, ZB], fov: 48 },
    cross: false,
    button: "REEL",
    scoreLabel: "Catch",
    scoreText: (b) => (b.score / 10).toFixed(1) + " kg",
    liveText: (v) => (v / 10).toFixed(1) + " kg",
    describe: (r) => ((r.score || 0) / 10).toFixed(1) + " kg of fish",
    board: { label: "Heaviest catch in 60 s", better: "high", value: (r) => r.score, format: (v) => (v / 10).toFixed(1) + " kg" },
    // un ponton de bois : de la prairie, par-dessus la rivière, jusqu'au milieu de la rive de l'étang
    before(ctx) {
      MF.decks.rect(ctx.world, ctx.group, { x: 134, z: -18.6, w: 2.4, l: 12.4, heading: 0, y: 0.75, rails: "lr", posts: true, name: "ponton-peche" });
      MF.decks.stairs(ctx.world, ctx.group, { from: [134, -10.8, ctx.world.groundAt(134, -10.8) + 0.03], to: [134, -12.5, 0.75], width: 2.2, name: "ponton-peche-acces", rails: false, steps: false });
    },
    setup(b) {
      const THREE = b.THREE, d = b.decor, world = b.world;
      const at = b.toWorld(0, ZB), pond = world.waterAt(at.x, at.z);
      const WY = (pond ? pond.level : -0.62) - b.root.position.y + 0.02;
      const sign = MF.sign("HOOKED · FISHING DERBY", { w: 2.4, h: 0.42, bg: "#2980b9", color: "#ffffff", border: "#ffffff", double: true });
      sign.position.set(0, 2.6, 12.2);
      d.add(sign);
      for (const sx of [-1, 1]) MF.cyl(0.04, 0.04, 2.6, MF.PAL.woodDark, { x: sx * 1.25, y: 1.3 + b.ground(sx * 1.25, 12.2), z: 12.2, parent: d, seg: 6 });
      MF.cyl(0.2, 0.16, 0.3, "#7f8c8d", { x: 0.8, y: 0.15, z: 0.2, parent: d, seg: 10 }); // le seau
      // la canne, le fil, le bouchon, le poisson qui sort de l'eau
      const rod = MF.group({ x: 0.35, y: 1.0, z: 0.9, parent: b.live });
      MF.cyl(0.012, 0.03, 3.4, "#5d4630", { y: 1.7, parent: rod, seg: 6 });
      const bob = MF.group({ parent: b.live });
      MF.sphere(0.09, MF.PAL.red, { parent: bob, seg: 10 });
      MF.sphere(0.091, "#ffffff", { y: -0.03, parent: bob, seg: 10 }).scale.set(1, 0.6, 1);
      MF.cyl(0.008, 0.008, 0.22, "#ffffff", { y: 0.15, parent: bob, seg: 5 });
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0xffffff }));
      line.frustumCulled = false;
      b.live.add(line);
      const fish = MF.group({ parent: b.live });
      const skin = MF.mat("#8fb7c9", { unique: true });
      MF.sphere(0.22, skin, { parent: fish, seg: 10 }).scale.set(0.45, 0.7, 1.5);
      MF.cone(0.16, 0.26, skin, { z: 0.42, rx: -Math.PI / 2, parent: fish, seg: 4 }).scale.set(0.3, 1, 1);
      MF.sphere(0.03, MF.PAL.black, { x: 0.08, y: 0.05, z: -0.2, parent: fish, seg: 5 });
      fish.visible = false;
      const tip = new THREE.Vector3(), end = new THREE.Vector3();
      let state = "wait", at0 = 0, biteAt = 0, kind = 0, tension = 0, reeled = 0, jerk = 0, bx = 0, caught = 0;

      const cast = (t) => {
        state = "wait";
        at0 = t;
        biteAt = t + 1.2 + b.rand() * 3.2;
        const r = b.rand();
        kind = r < 0.5 ? 0 : r < 0.82 ? 1 : r < 0.95 ? 2 : 3;
        bx = (b.rand() - 0.5) * 2.4;
        fish.visible = false;
      };
      return {
        reset() {
          caught = 0;
          cast(0.5);
        },
        update() {
          const t = b.t;
          let dip = 0;
          if (b.playing) {
            if (state === "wait") {
              if (t >= biteAt) {
                state = "bite";
                at0 = t;
                MF.sfx.play("plouf");
              } else if (b.press && t > at0 + 0.3) {
                b.hud.pop("Too early: it swam off", ...b.screen(bob.position));
                cast(t);
              }
            } else if (state === "bite") {
              dip = 0.16;
              if (b.press) {
                state = "reel";
                tension = 0.45;
                reeled = 0;
                MF.sfx.play("clic");
              } else if (t > at0 + 0.75) {
                b.hud.pop("Missed the bite", ...b.screen(bob.position));
                cast(t);
              }
            } else if (state === "reel") {
              const K = KINDS[kind];
              jerk += (b.rand() - 0.5) * K[2] * 9 * b.dt;
              jerk *= 1 - 2.5 * b.dt;
              tension += ((b.hold ? 0.95 : -0.85) + jerk) * b.dt;
              dip = 0.1 + Math.sin(t * 20) * 0.03;
              if (tension > 0.3 && tension < 0.8) reeled += b.dt;
              if (tension >= 1 || tension <= 0) {
                b.hud.flash(tension >= 1 ? "Snap! The line broke" : "Too slack: it got away", { color: MF.PAL.red, hold: 0.9 });
                MF.sfx.play("perdu");
                cast(t + 0.4);
              } else if (reeled >= K[1]) {
                // au bout de la ligne : on le sort de l'eau, il s'envole vers le seau
                caught++;
                skin.color.copy(MF.color(["#8fb7c9", "#c98f6b", "#6b9a55", "#3d6fb5"][kind]));
                fish.scale.setScalar(0.6 + kind * 0.55);
                fish.visible = true;
                b.fly(fish, bob.position, end.set(0.8, 0.5, 0.2), 1.6, 0.7, () => (fish.visible = false));
                b.add(Math.round(K[0] * 10), K[3] + " +" + K[0] + " kg", bob.position);
                MF.sfx.play(kind === 3 ? "bravo" : "ting");
                if (kind === 3) b.confetti(bx, WY + 0.6, ZB, 22);
                cast(t + 0.5);
              }
            }
          }
          b.hud.gauge(state === "reel" && b.playing ? MF.clamp(tension, 0, 1) : null, "Tension · keep it in the middle");
          // le bouchon danse ; il plonge quand ça mord ; la canne plie quand on mouline
          bob.position.set(bx + (state === "reel" ? Math.sin(t * 7) * 0.25 : 0), WY + 0.04 + Math.sin(t * 2.2) * 0.015 - dip, ZB + (state === "reel" ? reeled * 0.4 : 0));
          rod.rotation.set(-0.95 + (state === "reel" ? tension * 0.35 : 0), 0, -bx * 0.08);
          rod.updateMatrixWorld(true);
          tip.set(0, 3.4, 0);
          rod.localToWorld(tip);
          b.root.worldToLocal(tip);
          line.geometry.setFromPoints([tip, bob.position]);
        },
        peek: () => ({ state, tension, kind, caught }),
        leave() {
          b.hud.gauge(null);
        },
      };
    },
  });
})();
