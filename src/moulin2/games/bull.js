// Dream Mill Fest — Bull Market (le taureau mécanique, sur la rive sud du Grand étang).
//
// On tient sur le taureau le plus longtemps possible : il penche d'un côté puis de l'autre, de plus
// en plus fort et de plus en plus vite, et la partie ne s'arrête que lorsqu'on est éjecté.
//   – on se penche à contresens (← →, ou maintenir le clic à gauche ou à droite) pour garder
//     l'équilibre (la jauge doit rester au milieu) ;
//   – quand il se cabre (« BUCK! », annoncé une demi-seconde avant : ses yeux rougissent), on serre
//     les jambes d'un coup d'Espace (ou le bouton), sinon la ruade envoie valser ;
//   – jambes serrées, on ne peut presque plus se pencher : rester appuyé n'est pas une solution.
// Les ruades sont tirées de la graine de la partie : tous les joueurs montent le même taureau.
(function () {
  "use strict";
  const MF = globalThis.MoulinFete;
  const LIFT = 0.4, SEAT = 1.26; // hauteur des pieds du cavalier assis en selle

  MF.booth({
    id: "bull",
    title: "Bull Market",
    icon: "🐂",
    color: "#c0392b",
    blurb: "Ride the mechanical bull · it only stops when you are thrown",
    help: "Stay on the bull as long as you can. It tilts harder and faster: lean against it with ← → (or hold the left or right side of the screen) and keep the balance bar in the middle. When its eyes turn red it is about to buck: squeeze with Space (or the button) right then. There is no time limit: the ride ends when you fly off.",
    hint: "Lean against the bull with ← → · Space to squeeze when it bucks",
    touchHint: "Hold the left or right side to lean · SQUEEZE when it bucks",
    at: { x: -54, z: 126.5, face: Math.PI },
    stall: false,
    size: { w: 7, d: 7 },
    hall: [5.0, 4.4],
    maxTime: 900,
    cam: { y: 2.5 + LIFT, z: 6.4, look: [0, 1.7 + LIFT, 0], fov: 50 },
    cross: false,
    button: "SQUEEZE",
    scoreLabel: "Ride",
    stats: [{ key: "mood", label: "Bull" }],
    scoreText: (b) => (b.score / 10).toFixed(1) + " s",
    liveText: (v) => (v / 10).toFixed(1) + " s",
    describe: (r) => "held on for " + ((r.score || 0) / 10).toFixed(1) + " s",
    board: { label: "Longest ride", better: "high", value: (r) => r.score, format: (v) => (v / 10).toFixed(1) + " s" },
    setup(b) {
      const d = MF.group({ y: LIFT, parent: b.decor }), live = MF.group({ y: LIFT, parent: b.live });
      // une estrade (la rive penche), l'arène gonflable, le socle, l'enseigne derrière
      MF.cyl(3.75, 3.75, 1.5, MF.PAL.woodDark, { y: -0.75, parent: d, seg: 24, cast: true });
      MF.cyl(3.3, 3.3, 0.34, "#2f7fd8", { y: 0.17, parent: d, seg: 24 });
      MF.torus(3.3, 0.42, MF.PAL.red, { y: 0.4, rx: Math.PI / 2, parent: d, seg: 24, tubeSeg: 8 });
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        MF.sphere(0.2, MF.PAL.yellow, { x: Math.sin(a) * 3.3, y: 0.86, z: Math.cos(a) * 3.3, parent: d, seg: 8 });
      }
      MF.cyl(0.42, 0.6, 0.5, "#3a3d46", { y: 0.6, parent: d, seg: 12 });
      const sign = MF.sign("BULL MARKET", { w: 3.0, h: 0.56, bg: "#c0392b", color: "#ffffff", border: MF.PAL.yellow, double: true });
      sign.position.set(0, 3.4, -4.6); // derrière l'arène, face au public
      d.add(sign);
      for (const sx of [-1, 1]) MF.cyl(0.05, 0.05, 3.4, MF.PAL.woodDark, { x: sx * 1.5, y: 1.7, z: -4.6, parent: d, seg: 6 });
      const sub = MF.sign("NO TIME LIMIT · HOLD ON", { w: 2.4, h: 0.26, px: 128, bg: MF.PAL.yellow, color: MF.PAL.ink, border: MF.PAL.ink, double: true });
      sub.position.set(0, 2.9, -4.6);
      d.add(sub);
      // le taureau : il pivote sur son socle
      const bull = MF.group({ y: 0.85, parent: live });
      const hide = "#6b3f22";
      MF.cyl(0.12, 0.12, 0.5, "#3a3d46", { y: 0.2, parent: bull, seg: 8 });
      MF.box(0.78, 0.74, 1.7, hide, { y: 0.78, parent: bull, cast: true });
      MF.box(0.6, 0.62, 0.62, "#5a3219", { y: 0.92, z: -1.05, parent: bull, cast: true });
      MF.box(0.4, 0.3, 0.26, "#d9a077", { y: 0.76, z: -1.42, parent: bull });
      for (const sx of [-1, 1]) {
        MF.cone(0.07, 0.42, "#f4ead2", { x: sx * 0.4, y: 1.3, z: -1.05, rz: -sx * 0.9, parent: bull, seg: 7 });
        MF.box(0.16, 0.5, 0.16, "#5a3219", { x: sx * 0.32, y: 0.2, z: -0.6, parent: bull });
        MF.box(0.16, 0.5, 0.16, "#5a3219", { x: sx * 0.32, y: 0.2, z: 0.6, parent: bull });
      }
      MF.cyl(0.03, 0.02, 0.6, "#3b2413", { y: 0.9, z: 0.95, rx: -0.9, parent: bull, seg: 5 });
      MF.box(0.82, 0.08, 0.6, MF.PAL.red, { y: 1.18, parent: bull }); // la selle
      const eyeMat = MF.mat("#ffffff", { unique: true, emissive: "#ff2a1a", emissiveIntensity: 0 });
      for (const sx of [-1, 1]) MF.sphere(0.06, eyeMat, { x: sx * 0.2, y: 1.02, z: -1.37, parent: bull, seg: 7 });
      // le cavalier
      const jack = MF.Presence.buildAvatar(b.ctx.self.color, null, null);
      jack.tag.visible = false;
      if (jack.shadow) jack.shadow.visible = false;
      jack.body.rotation.y = Math.PI;
      live.add(jack.group);
      let o = 0, v = 0, squeeze = 0, wasA = false, nextBuck = 0, warned = false, held = false, kick = 0, pitch = 0, spin = 0, thrown = 0, side = 1, p1 = 0, p2 = 0, bucks = 0;
      const tiltAt = (t) => (0.42 + t / 26) * (Math.sin(t * (1.25 + t / 60) + p1) * 0.62 + Math.sin(t * (2.3 + t / 45) + p2) * 0.38);
      /** Pose du taureau et du cavalier (pendant la partie comme dans la salle d'attente). */
      function draw(tilt) {
        const dt = b.dt;
        // le taureau : roulis, tangage des ruades, lente rotation sur le socle
          pitch = Math.max(0, pitch - dt * 2.4);
          spin += dt * (b.playing && !thrown ? 0.35 + b.t / 50 : 0.15) * (bucks % 2 ? -1 : 1);
          bull.rotation.set(-Math.sin(pitch * Math.PI) * 0.5, Math.sin(spin) * 0.7, tilt * 0.55, "YXZ");
          eyeMat.emissiveIntensity = warned ? 1.4 : 0;
          // le cavalier : sur la selle, penché de son déséquilibre ; éjecté, il vole sur le tapis
          const g = jack.group;
          if (thrown) {
            const u = Math.min(1, (b.t - thrown) / 0.9);
            g.position.set(side * (0.4 + u * 2.3), SEAT + 0.2 + Math.sin(u * Math.PI) * 1.5 - u * (SEAT - 0.3), 0.2);
            jack.body.rotation.z = -side * u * 4.2;
          } else {
            g.position.set(Math.sin(tilt * 0.55) * -0.5 + o * 0.42, SEAT + Math.sin(pitch * Math.PI) * 0.25, 0.05);
            jack.body.rotation.z = -tilt * 0.55 - o * 0.7;
            jack.body.rotation.x = Math.sin(pitch * Math.PI) * 0.35;
          }
          jack.legs[0].rotation.set(-1.25, 0, 0.5 - squeeze * 0.6);
          jack.legs[1].rotation.set(-1.25, 0, -0.5 + squeeze * 0.6);
          jack.arms[0].rotation.set(-0.9, 0, 0);
          jack.arms[1].rotation.set(0, 0, 2.6 + Math.sin(b.time * 9) * 0.25 * (b.playing ? 1 : 0)); // un bras en l'air
      }
      return {
        reset() {
          jack.setHat(b.ctx.self.hat);
          o = v = squeeze = kick = pitch = spin = thrown = bucks = 0;
          wasA = warned = held = false;
          p1 = b.rand() * 6.28;
          p2 = b.rand() * 6.28;
          nextBuck = 4 + b.rand() * 2;
          side = 1;
        },
        update() {
          const t = b.t, dt = b.dt;
          let tilt = 0;
          if (b.playing && !thrown) {
            tilt = tiltAt(t);
            const K = b.input.state, key = K.x < -0.5 ? -1 : K.x > 0.5 ? 1 : 0;
            const lean = key || (b.hold && !K.a ? (b.aim.x < 0 ? -1 : 1) : 0);
            // la ruade : annoncée 0,5 s avant ; un coup d'Espace donné après l'annonce la fait tenir
            if (!warned && t >= nextBuck - 0.5) {
              warned = true;
              held = false;
              b.hud.flash("BUCK!", { color: "#ff5a4a", hold: 0.5 });
              MF.sfx.play("bip");
            }
            if (K.a && !wasA) {
              squeeze = 0.45;
              if (warned) held = true;
            }
            wasA = !!K.a;
            squeeze = Math.max(0, squeeze - dt);
            if (warned && t >= nextBuck) {
              warned = false;
              bucks++;
              pitch = 1;
              const dir = b.rand() < 0.5 ? -1 : 1;
              if (held) {
                b.hud.pop("Held on!", b.hud.root.clientWidth / 2, b.hud.root.clientHeight * 0.4);
                MF.sfx.play("toc");
                v += dir * 0.5;
              } else {
                v += dir * (2.1 + t / 22);
                MF.sfx.play("choc");
              }
              nextBuck = t + Math.max(1.5, 5.2 - t / 14) * (0.75 + b.rand() * 0.5);
            }
            // l'équilibre : le taureau pousse, on contre ; jambes serrées (Espace tenu), on contre mal
            const grip = K.a ? 1.1 : 3.5;
            v += (tilt * 3.3 + lean * grip - v * 1.25) * dt;
            o += v * dt;
            b.score = Math.round(t * 10);
            if (Math.abs(o) > 1) {
              thrown = t;
              side = o > 0 ? 1 : -1;
              b.hud.gauge(null);
              b.hud.flash("Thrown after " + t.toFixed(1) + " s!", { color: MF.PAL.yellow, hold: 1.8 });
              MF.sfx.play("perdu");
              b.finish();
            } else b.hud.gauge((o + 1) / 2, "Balance · keep it in the middle");
          } else if (!thrown) b.hud.gauge(null);
          draw(tilt);
        },
        hud() {
          b.hud.set("mood", thrown ? "won" : b.t < 12 ? "calm" : b.t < 30 ? "nervous" : b.t < 55 ? "angry" : "furious");
        },
        probe: () => ({ o, v, warned, thrown }), // pour les essais automatiques
        idle() {
          b.hud.gauge(null);
          draw(thrown ? 0 : Math.sin(b.time * 0.9) * 0.12); // salle d'attente : il se balance doucement
        },
        leave() {
          b.hud.gauge(null);
        },
      };
    },
  });
})();
