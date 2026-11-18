// Dream Mill Fest — Elevator Pitch (le jeu de mémoire, au pré de l'est).
//
// Quatre gros boutons lumineux : PROBLEM, SOLUTION, TRACTION, THE ASK. L'ascenseur joue un pitch
// (une suite de boutons), on le répète dans l'ordre : flèches ← ↑ → ↓ (les boutons sont disposés
// en losange), ou un clic sur le bouton. Chaque étage ajoute un bouton au pitch (deux à partir du
// 10e étage) et la démonstration va de plus en plus vite ; on a de moins en moins de temps pour
// répondre. Une erreur ou une hésitation trop longue, et les portes se referment. Le score est le
// nombre d'étages montés. Le pitch est tiré de la graine de la partie : le même pour tous.
(function () {
  "use strict";
  const MF = globalThis.MoulinFete;
  const ZP = -1.2;
  const PADS = [
    { name: "PROBLEM", color: "#e8402c", x: -1.2, y: 1.95, sfx: "toc" },
    { name: "SOLUTION", color: "#2f7fd8", x: 0, y: 2.85, sfx: "ting" },
    { name: "TRACTION", color: "#2e9e5b", x: 1.2, y: 1.95, sfx: "clic" },
    { name: "THE ASK", color: "#ffc93a", x: 0, y: 1.05, sfx: "bip" },
  ];

  MF.booth({
    id: "pitch",
    title: "Elevator Pitch",
    icon: "🛗",
    color: "#2f7fd8",
    blurb: "Repeat the pitch, one more word every floor · memory game",
    help: "The elevator plays a pitch: a sequence of the four buttons. Repeat it in the same order with the arrow keys ← ↑ → ↓ (the buttons form a diamond) or by clicking them. Every floor adds a step and plays faster. One mistake, or a long hesitation, and the doors close. Your score is the number of floors.",
    hint: "Watch, then repeat with ← ↑ → ↓ or by clicking the buttons",
    touchHint: "Watch, then tap the buttons in the same order",
    at: { x: 122, z: -1, face: Math.PI },
    stall: { w: 4.6, d: 2.6, h: 3.5, colors: ["#2f7fd8", "#ffffff"], counter: false },
    hall: [3.7, 2.4],
    maxTime: 900,
    cam: { y: 1.95, z: 4.2, look: [0, 1.95, ZP], fov: 46 },
    cross: false,
    button: "GO",
    scoreLabel: "Floor",
    stats: [{ key: "state", label: "Pitch" }],
    describe: (r) => "reached floor " + (r.score || 0),
    board: { label: "Highest floor", better: "high", value: (r) => r.score, format: (v) => "floor " + v },
    setup(b) {
      const d = b.decor, THREE = b.THREE;
      MF.box(4.0, 3.3, 0.1, "#dfe6ee", { y: 1.9, z: ZP - 0.12, parent: d });
      const pads = PADS.map((p) => {
        // éteint, le bouton est sombre ; allumé, il brille de sa couleur
        const mat = MF.mat(p.color, { unique: true, emissive: p.color, emissiveIntensity: 0.05 });
        mat.color.multiplyScalar(0.42);
        const disc = MF.cyl(0.45, 0.45, 0.12, mat, { x: p.x, y: p.y, z: ZP, rx: Math.PI / 2, parent: b.live, seg: 20 });
        MF.torus(0.48, 0.05, MF.PAL.ink, { x: p.x, y: p.y, z: ZP, parent: d, seg: 20, tubeSeg: 5 });
        const label = MF.sign(p.name, { w: 0.9, h: 0.2, px: 96, bg: "#ffffff", color: MF.PAL.ink, border: MF.PAL.ink });
        label.position.set(p.x, p.y - 0.62, ZP + 0.02);
        d.add(label);
        return { p, mat, disc, glow: 0 };
      });
      let seq = [], round = 0, phase = "idle", step = 0, clock = 0, shown = 0, lost = false, wasDir = -1;
      const pace = () => Math.max(0.36, 1 - round * 0.055);
      const need = () => (round < 10 ? round : 9 + (round - 9) * 2); // longueur du pitch à cet étage
      function light(i, strength = 1) {
        pads[i].glow = strength;
        MF.sfx.play(PADS[i].sfx);
      }
      function begin() {
        round++;
        phase = "show";
        shown = 0;
        clock = 0.7;
      }
      function fail(text) {
        lost = true;
        phase = "idle";
        b.hud.flash(text + " Floor " + (round - 1), { color: MF.PAL.yellow, hold: 1.8 });
        MF.sfx.play("perdu");
        b.finish();
      }
      return {
        reset() {
          seq = [];
          for (let i = 0; i < 240; i++) seq.push(Math.floor(b.rand() * 4));
          round = step = 0;
          lost = false;
          phase = "idle";
          wasDir = -1;
        },
        update() {
          const dt = b.dt, K = b.input.state;
          for (const pad of pads) {
            pad.glow = Math.max(0, pad.glow - dt * 3.2);
            pad.mat.emissiveIntensity = 0.05 + pad.glow * 1.1;
            pad.disc.position.z = ZP - pad.glow * 0.05;
          }
          // la touche ou le bouton choisi à cette image (−1 : rien)
          const dir = K.x < -0.5 ? 0 : K.y > 0.5 ? 1 : K.x > 0.5 ? 2 : K.y < -0.5 ? 3 : -1;
          let hit = dir >= 0 && dir !== wasDir ? dir : -1;
          wasDir = dir;
          if (hit < 0 && b.press && !K.a) {
            const at = b.hit(ZP + 0.06);
            if (at) hit = PADS.findIndex((p) => Math.hypot(p.x - at.x, p.y - at.y) < 0.56);
          }
          if (!b.playing || lost) return;
          if (phase === "idle") begin();
          clock -= dt;
          if (phase === "show") {
            // la démonstration : un bouton après l'autre
            if (clock <= 0) {
              if (shown < need()) {
                light(seq[shown++]);
                clock = 0.55 * pace() + 0.12;
              } else {
                phase = "input";
                step = 0;
                clock = 2.2 + 2.2 * pace();
              }
            }
          } else if (phase === "input") {
            if (hit >= 0) {
              if (hit !== seq[step]) return fail("Wrong button!");
              light(hit, 0.8);
              step++;
              clock = 1.6 + 2.2 * pace();
              if (step >= need()) {
                b.score = round;
                b.hud.pop("Floor " + round + "!", b.hud.root.clientWidth / 2, b.hud.root.clientHeight * 0.3);
                MF.sfx.play("bravo");
                begin();
                clock = 1.0;
              }
            } else if (clock <= 0) fail("Too slow!");
          }
        },
        hud() {
          b.hud.set("state", lost ? "doors closed" : phase === "show" ? "listen…" : phase === "input" ? "your turn: " + step + " / " + need() : "…");
        },
        probe: () => ({ round, want: phase === "input" ? seq[step] : -1 }), // pour les essais automatiques
        idle() {
          for (const pad of pads) {
            pad.glow = Math.max(0, Math.sin(b.time * 2 + pads.indexOf(pad) * 1.57)) * 0.5;
            pad.mat.emissiveIntensity = 0.05 + pad.glow;
          }
        },
      };
    },
  });
})();
