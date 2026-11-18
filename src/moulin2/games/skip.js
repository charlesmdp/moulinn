// La Fête du Moulin — Bounce Rate (les ricochets, depuis la rive sud du Grand étang : un petit
// ponton au-dessus des joncs, face au chenal qui longe l'île).
//
// Cinq galets à faire ricocher sur le Grand étang. On vise à la souris (gauche, droite), on
// maintient le clic pour doser : trop mou, le galet coule ; trop fort, il plonge ; au bon endroit
// de la jauge (vers 80 %), il enchaîne les rebonds. 10 points par ricochet, et 50 de plus si un
// rebond tombe dans une des trois bouées-cibles.
(function () {
  "use strict";
  const MF = globalThis.MoulinFete;
  const STONES = 5, BEST = 0.8;
  const TARGETS = [[-2.6, -9.5], [2.2, -14], [-0.6, -19.5]]; // bouées-cibles : x, z dans le repère du jeu

  MF.booth({
    id: "skip",
    title: "Bounce Rate",
    icon: "🪨",
    color: "#3fa9f5",
    blurb: "5 stones to skip across the lake · here, a high bounce rate is good",
    help: "Aim left or right with the mouse, hold the click and release near 80 % of the gauge: too soft and the stone sinks, too hard and it dives. 10 points per skip, plus 50 when a skip lands inside a floating ring.",
    hint: "Aim, hold, release near 80 % for the most skips",
    at: { x: -63.5, z: 119.9, face: 0 },
    stall: false,
    size: { w: 3, d: 1.0 },
    hall: [2.8, 4.8],
    before(ctx) {
      const w = ctx.world, g0 = w.groundAt ? w.groundAt(-63.5, 124.4) : w.heightAt(-63.5, 124.4);
      MF.decks.rect(w, ctx.group, { x: -63.5, z: 120.6, w: 2.8, l: 4.2, heading: 0, y: 0.8, rails: "lr", posts: true, name: "ponton-ricochets" });
      MF.decks.stairs(w, ctx.group, { from: [-63.5, 124.4, g0 + 0.03], to: [-63.5, 122.7, 0.8], width: 2.2, name: "ponton-ricochets-acces", rails: false, steps: false });
    },
    maxTime: 100,
    cam: { y: 1.75, z: 2.0, look: [0, 0.5, -12], fov: 50 },
    cross: false,
    button: "SKIP",
    stats: [{ key: "stones", label: "Stones" }, { key: "best", label: "Best throw" }],
    board: { label: "Best score", better: "high", value: (r) => r.score, format: (v) => v + " pts" },
    setup(b) {
      const THREE = b.THREE, d = b.decor, world = b.world;
      // niveau de l'eau devant le ponton, dans le repère du jeu
      const at = b.toWorld(0, -8), pond = world.waterAt(at.x, at.z);
      const WY = (pond ? pond.level : 0) - b.root.position.y + 0.03;
      // un panier de galets, l'enseigne posée sur le muret, les trois bouées-cibles
      MF.cyl(0.32, 0.26, 0.3, "#8a5a33", { x: 0.9, y: 0.15, z: 0.4, parent: d, seg: 12 });
      for (let i = 0; i < 5; i++) MF.sphere(0.09, "#8f979b", { x: 0.9 + Math.cos(i * 1.3) * 0.14, y: 0.34, z: 0.4 + Math.sin(i * 1.3) * 0.14, parent: d, seg: 7 }).scale.set(1, 0.45, 1);
      const sign = MF.sign("BOUNCE RATE", { w: 2.1, h: 0.46, bg: "#3fa9f5", color: "#ffffff", border: "#ffffff", double: true });
      sign.position.set(0, 2.6, 4.9); // derrière le lanceur, au pied du ponton : on la lit en arrivant par le pré
      d.add(sign);
      for (const sx of [-1, 1]) MF.cyl(0.04, 0.04, 3.1, MF.PAL.woodDark, { x: sx * 1.1, y: 1.05, z: 4.9, parent: d, seg: 6 });
      const rings = TARGETS.map(([x, z], i) => {
        const g = MF.group({ x, y: WY, z, parent: d });
        MF.torus(1.0, 0.09, [MF.PAL.red, MF.PAL.yellow, MF.PAL.green][i], { rx: Math.PI / 2, parent: g, seg: 24, tubeSeg: 6 });
        MF.cone(0.1, 0.4, "#ffffff", { x: 1.0, y: 0.25, parent: g, seg: 6 });
        return { x, z };
      });
      const stone = MF.sphere(0.1, "#8f979b", { parent: b.live, seg: 8 });
      stone.scale.set(1, 0.4, 1);
      stone.visible = false;
      // ronds dans l'eau, réutilisés
      const splashes = [];
      for (let i = 0; i < 10; i++) {
        const m = MF.torus(0.3, 0.025, MF.mat("#ffffff", { basic: true, opacity: 0.8 }), { rx: Math.PI / 2, y: WY + 0.01, parent: b.live, seg: 16, tubeSeg: 4 });
        m.visible = false;
        splashes.push({ m, age: 9 });
      }
      const arrow = MF.cone(0.1, 0.5, MF.PAL.yellow, { y: 0.05, z: -1.4, rx: -Math.PI / 2, parent: b.live, seg: 3 });
      arrow.scale.set(1, 1, 0.2);
      const a = new THREE.Vector3(), c = new THREE.Vector3();
      let left = STONES, busy = false, aim = 0, best = 0, nSplash = 0;

      const ripple = (x, z) => {
        const s = splashes[nSplash++ % splashes.length];
        s.m.position.set(x, WY + 0.01, z);
        s.age = 0;
        s.m.visible = true;
      };
      function hop(x, z, dx, dz, len, n, skips) {
        // un rebond de plus ? chaque rebond est plus court ; au dernier, le galet coule
        a.set(x, WY, z);
        c.set(x + dx * len, WY, z + dz * len);
        b.fly(stone, a, c, len * 0.16, 0.16 + len * 0.045, () => {
          ripple(c.x, c.z);
          const bonus = rings.some((r) => Math.hypot(c.x - r.x, c.z - r.z) < 1.0);
          if (n > 0) {
            MF.sfx.play("clic");
            if (bonus) {
              b.add(50, "In the ring! +50", c);
              MF.sfx.play("bravo");
            }
            return hop(c.x, c.z, dx, dz, len * 0.72, n - 1, skips);
          }
          MF.sfx.play("plouf");
          stone.visible = false;
          b.add(skips * 10, skips ? skips + (skips > 1 ? " skips! +" : " skip +") + skips * 10 : "Plop.", c);
          best = Math.max(best, skips);
          busy = false;
          if (!left) b.finish();
        });
      }
      function throwStone(power) {
        busy = true;
        left--;
        MF.sfx.play("swing");
        // nombre de ricochets : maximal près de 80 % de la jauge, nul trop loin de là
        const off = Math.abs(power - BEST), skips = power > 0.97 ? 0 : Math.max(0, Math.round(9 - off * 26));
        const dir = aim * 0.42, dx = Math.sin(dir), dz = -Math.cos(dir), first = 3.2 + power * 4.2;
        a.set(0.25, 1.1, 0.6);
        c.set(a.x + dx * first, WY, a.z + dz * first);
        b.fly(stone, a, c, 0.25, 0.3, () => {
          ripple(c.x, c.z);
          if (!skips) {
            MF.sfx.play("plouf");
            stone.visible = false;
            b.hud.pop(power > 0.97 ? "Too hard: it dived" : "Plop. Too soft", ...b.screen(c));
            busy = false;
            if (!left) b.finish();
            return;
          }
          hop(c.x, c.z, dx, dz, 2.6 + power * 1.6, skips - 1, skips);
        });
      }
      return {
        reset() {
          left = STONES;
          busy = false;
          best = 0;
          stone.visible = false;
        },
        update() {
          for (const s of splashes) {
            if (s.age > 1) continue;
            s.age += b.dt * 1.4;
            const k = 1 + s.age * 4;
            s.m.scale.set(k, k, 1);
            s.m.visible = s.age <= 1;
          }
          if (!busy) aim = MF.clamp(b.aim.x * 1.4, -1, 1);
          arrow.rotation.y = -aim * 0.42;
          arrow.position.set(Math.sin(aim * 0.42) * 1.4, 0.05, -Math.cos(aim * 0.42) * 1.4);
          arrow.visible = b.playing && !busy && left > 0;
          if (busy || !left) return;
          const power = b.charge(0.95);
          if (power !== null) throwStone(power);
        },
        hud() {
          b.hud.set("stones", left + " / " + STONES);
          b.hud.set("best", best ? best + " skips" : "–");
        },
      };
    },
  });
})();
