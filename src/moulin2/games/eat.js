// La Fête du Moulin — Dogfooding (le concours de hot-dogs : « mangez ce que vous servez »).
//
// 30 secondes. On mâche en alternant gauche et droite (← →, ou clic à gauche puis à droite) :
// six bouchées par hot-dog. Mais chaque bouchée fait monter la jauge « gorge » : si elle déborde,
// on s'étouffe une seconde et demie. Il faut donc trouver son rythme. Le score est le nombre de
// hot-dogs (et de bouchées entamées, en dixièmes). Plus on en a mangé, plus chaque bouchée
// remplit la gorge : le rythme qui marchait au début fait s'étouffer à la fin.
(function () {
  "use strict";
  const MF = globalThis.MoulinFete;
  const BITES = 6, RISE = 0.105, FALL = 0.5;

  MF.booth({
    id: "eat",
    title: "Dogfooding",
    icon: "🌭",
    color: "#e67e22",
    blurb: "30 seconds · eat your own (hot) dog food, at your own pace",
    help: "Alternate ← and → (or click left, then right) to chew: six bites per hot dog. Every bite fills the throat gauge; let it overflow and you choke for a second and a half. Find your rhythm.",
    hint: "Alternate ← and → to chew · don't let the gauge overflow",
    touchHint: "Tap left, then right, to chew · don't let the gauge overflow",
    at: { x: 10.6, z: 10.4, face: -Math.PI / 2 },
    stall: false,
    size: { w: 3.2, d: 1.2 },
    hall: [3.0, 2.6],
    duration: 30,
    cam: { y: 1.5, z: 1.9, look: [0, 1.0, -0.4], fov: 54 },
    cross: false,
    button: "CHEW",
    scoreLabel: "Hot dogs",
    scoreText: (b) => (b.score / 10).toFixed(1),
    liveText: (v) => (v / 10).toFixed(1) + " 🌭",
    describe: (r) => ((r.score || 0) / 10).toFixed(1) + " hot dogs",
    board: { label: "Most hot dogs in 30 s", better: "high", value: (r) => r.score, format: (v) => (v / 10).toFixed(1) + " hot dogs" },
    setup(b) {
      const d = b.decor;
      // la table, sa nappe à carreaux, le plat de hot-dogs, la banderole
      MF.box(3.0, 0.08, 0.95, "#f3e3c2", { y: 0.82, parent: d, cast: true });
      for (let i = 0; i < 8; i++) MF.box(0.36, 0.085, 0.95, i % 2 ? MF.PAL.red : "#ffffff", { x: -1.3 + i * 0.372, y: 0.822, parent: d });
      for (const [x, z] of [[-1.35, -0.38], [1.35, -0.38], [-1.35, 0.38], [1.35, 0.38]]) MF.box(0.08, 0.8, 0.08, MF.PAL.woodDark, { x, y: 0.4, z, parent: d });
      const banner = MF.sign("DOGFOODING · EAT YOUR OWN DOG FOOD", { w: 3.2, h: 0.42, bg: "#e67e22", color: "#ffffff", border: "#ffffff", double: true });
      banner.position.set(0, 2.5, -0.9);
      d.add(banner);
      for (const sx of [-1, 1]) MF.cyl(0.04, 0.04, 2.5, MF.PAL.woodDark, { x: sx * 1.55, y: 1.25, z: -0.9, parent: d, seg: 6 });
      const dog = (parent, x, z) => {
        const g = MF.group({ x, y: 0.93, z, parent });
        MF.cyl(0.055, 0.055, 0.34, "#e8b769", { rz: Math.PI / 2, parent: g, seg: 8 }).scale.set(1, 1, 1.5);
        MF.cyl(0.035, 0.035, 0.4, "#b5452e", { y: 0.035, rz: Math.PI / 2, parent: g, seg: 8 });
        MF.box(0.32, 0.012, 0.02, "#f5c531", { y: 0.075, parent: g });
        return g;
      };
      for (let i = 0; i < 6; i++) dog(d, 0.75 + (i % 3) * 0.2 - 0.2, -0.22 + Math.floor(i / 3) * 0.16).rotation.y = 0.4;
      MF.cyl(0.42, 0.36, 0.04, "#ffffff", { x: 0.75, y: 0.88, z: -0.14, parent: d, seg: 16 });
      // mon hot-dog (il raccourcit à chaque bouchée) et la pile d'assiettes vides
      const mine = dog(b.live, 0, 0.18);
      const plates = [];
      for (let i = 0; i < 12; i++) {
        const p = MF.cyl(0.16, 0.13, 0.025, "#ffffff", { x: -0.95, y: 0.88 + i * 0.028, z: 0.1, parent: b.live, seg: 14 });
        p.visible = false;
        plates.push(p);
      }
      let last = "", bites = 0, eaten = 0, throat = 0, choke = 0, chew = 0;
      return {
        reset() {
          last = "";
          bites = eaten = throat = choke = chew = 0;
          for (const p of plates) p.visible = false;
        },
        update() {
          choke = Math.max(0, choke - b.dt);
          chew = Math.max(0, chew - b.dt);
          throat = Math.max(0, throat - FALL * b.dt * (choke > 0 ? 1.6 : 1));
          if (b.playing && b.tap && choke <= 0 && b.tap !== last) {
            last = b.tap;
            chew = 0.12;
            bites++;
            throat += RISE * (1 + eaten * 0.09); // chaque hot-dog avalé passe un peu moins bien que le précédent
            MF.sfx.play("clic");
            if (bites >= BITES) {
              bites = 0;
              eaten++;
              if (plates[eaten - 1]) plates[eaten - 1].visible = true;
              b.hud.pop(eaten === 1 ? "First hot dog down!" : eaten + " hot dogs!", ...b.screen(mine.position));
              MF.sfx.play("ting");
            }
            if (throat >= 1) {
              choke = 1.5;
              b.hud.flash("*cough* Slow down!", { color: MF.PAL.red, hold: 1.1 });
              MF.sfx.play("perdu");
            }
          }
          b.score = eaten * 10 + Math.floor((bites / BITES) * 10);
          // le hot-dog raccourcit ; il tremble quand on s'étouffe
          mine.scale.x = 1 - bites / BITES + 0.05;
          mine.position.set(-0.17 * (bites / BITES) + (choke > 0 ? Math.sin(b.time * 40) * 0.02 : 0), 0.93 + (chew > 0 ? 0.25 : 0), 0.18 + (chew > 0 ? 0.3 : 0));
          if (b.t >= 0) b.hud.gauge(Math.min(1, throat), choke > 0 ? "Choking!" : "Throat");
          else b.hud.gauge(null);
        },
        leave() {
          b.hud.gauge(null);
        },
      };
    },
  });
})();
