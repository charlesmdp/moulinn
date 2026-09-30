// « Pas touche à mes trésors » — boîte à outils graphique partagée (PTMT.gfx).
//
// Utilisée par les ennemis (src/jeu/actors) et les effets (src/jeu/fx) :
//  - PTMT.gfx.atlas()        planche de sprites dessinée sur canvas (8 × 8 cases de 128 px, aucun fichier)
//  - PTMT.gfx.SpriteBatch    lot de sprites instanciés, UN seul appel de dessin : particules simulées
//                            sur le GPU (anneau) ou sprites posés à chaque image (mode immédiat).
//                            Alpha prémultiplié : chaque sprite choisit son mélange, de normal à additif.
//  - PTMT.gfx.Parts          assemblage d'accessoires low-poly (couleur par sommet + classe de matière)
//  - PTMT.gfx.GLSL           bruit et utilitaires pour les petits shaders
//  - PTMT.gfx.addSack(...)   le sac de trésor doré (partagé entre ennemis et effets)
//
// Tout est créé à la demande (aucun appel à THREE au chargement du script).
(function () {
  "use strict";
  const PTMT = (globalThis.PTMT = globalThis.PTMT || {});
  const gfx = (PTMT.gfx = PTMT.gfx || {});
  const lin = (hex) => (PTMT.color ? PTMT.color(hex) : new THREE.Color(hex).convertSRGBToLinear());

  // ---------------------------------------------------------------------------------------------
  // Planche de sprites
  // ---------------------------------------------------------------------------------------------
  const CELL = (gfx.CELL = {
    glow: 0, disc: 1, ring: 2, puff: 3, flame: 4, spark: 5, twinkle: 6, star: 7,
    snow: 8, crystal: 9, drop: 10, bubble: 11, coin: 12, heart: 13, dollar: 14, anger: 15,
    sweat: 16, splat: 17, scorch: 18, cracks: 19, frost: 20, ripple: 21, swirl: 22, foam: 23,
    shadow: 24, boing: 25, rune: 26, dashring: 27, chevron: 28, exclaim: 29, poof: 30, eyeWhite: 31,
    pupil: 32, shield: 33, leaf: 34, shard: 35, wind: 36, zap: 37, nut: 38, splash: 39,
    flameB: 40, puffDark: 41, sackIcon: 42, question: 43, zzz: 44, crown: 45, bolt: 46, arc: 47,
  });
  const CELLS = 8, CS = 128;

  function star(ctx, cx, cy, spikes, outer, inner, rot) {
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const r = i % 2 ? inner : outer, a = rot + (i * Math.PI) / spikes;
      ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    ctx.closePath();
  }
  function blob(ctx, cx, cy, r, n, jitter, rnd) {
    ctx.beginPath();
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, rr = r * (1 - jitter + rnd() * jitter * 2);
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
    for (let i = 0; i <= n; i++) {
      const p0 = pts[i % n], p1 = pts[(i + 1) % n];
      const mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2;
      if (i === 0) ctx.moveTo(mx, my);
      else ctx.quadraticCurveTo(p0[0], p0[1], mx, my);
    }
    ctx.closePath();
  }
  function heartPath(ctx, cx, cy, s) {
    ctx.beginPath();
    ctx.moveTo(cx, cy + s * 0.9);
    ctx.bezierCurveTo(cx - s * 1.25, cy + s * 0.05, cx - s * 0.95, cy - s * 0.95, cx, cy - s * 0.35);
    ctx.bezierCurveTo(cx + s * 0.95, cy - s * 0.95, cx + s * 1.25, cy + s * 0.05, cx, cy + s * 0.9);
    ctx.closePath();
  }
  function dropPath(ctx, cx, cy, s) {
    // goutte pointe en haut
    ctx.beginPath();
    ctx.moveTo(cx, cy - s);
    ctx.bezierCurveTo(cx + s * 0.25, cy - s * 0.45, cx + s * 0.62, cy - s * 0.05, cx + s * 0.62, cy + s * 0.3);
    ctx.arc(cx, cy + s * 0.3, s * 0.62, 0, Math.PI, false);
    ctx.bezierCurveTo(cx - s * 0.62, cy - s * 0.05, cx - s * 0.25, cy - s * 0.45, cx, cy - s);
    ctx.closePath();
  }

  const painters = {
    glow(c) {
      const g = c.createRadialGradient(64, 64, 0, 64, 64, 62);
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(0.18, "rgba(255,255,255,0.85)");
      g.addColorStop(0.45, "rgba(255,255,255,0.32)");
      g.addColorStop(0.75, "rgba(255,255,255,0.08)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = g; c.fillRect(0, 0, 128, 128);
    },
    disc(c) {
      const g = c.createRadialGradient(64, 64, 50, 64, 64, 60);
      g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = g; c.beginPath(); c.arc(64, 64, 60, 0, Math.PI * 2); c.fill();
    },
    ring(c) {
      c.strokeStyle = "rgba(255,255,255,0.35)"; c.lineWidth = 16; c.beginPath(); c.arc(64, 64, 50, 0, Math.PI * 2); c.stroke();
      c.strokeStyle = "rgba(255,255,255,1)"; c.lineWidth = 7; c.beginPath(); c.arc(64, 64, 52, 0, Math.PI * 2); c.stroke();
    },
    puff(c, rnd) {
      // nuage de dessin animé : lobes ombrés (tintable)
      const lobes = [[64, 74, 38], [34, 78, 28], [94, 78, 28], [46, 50, 29], [82, 47, 28], [64, 34, 25]];
      c.fillStyle = "rgb(150,150,158)";
      for (const l of lobes) { c.beginPath(); c.arc(l[0], l[1] + 4, l[2], 0, Math.PI * 2); c.fill(); }
      for (const l of lobes) {
        const g = c.createRadialGradient(l[0] - l[2] * 0.3, l[1] - l[2] * 0.35, l[2] * 0.1, l[0], l[1], l[2]);
        g.addColorStop(0, "rgb(255,255,255)"); g.addColorStop(1, "rgb(212,212,220)");
        c.fillStyle = g; c.beginPath(); c.arc(l[0], l[1], l[2] - 2, 0, Math.PI * 2); c.fill();
      }
      void rnd;
    },
    puffDark(c) {
      const lobes = [[64, 68, 36], [40, 72, 24], [88, 72, 24], [50, 50, 24], [80, 48, 22]];
      for (const l of lobes) {
        const g = c.createRadialGradient(l[0], l[1], 2, l[0], l[1], l[2]);
        g.addColorStop(0, "rgba(255,255,255,0.95)"); g.addColorStop(0.7, "rgba(235,235,240,0.8)"); g.addColorStop(1, "rgba(220,220,230,0)");
        c.fillStyle = g; c.beginPath(); c.arc(l[0], l[1], l[2], 0, Math.PI * 2); c.fill();
      }
    },
    flame(c) {
      // flamme de dessin animé bicolore (pré-colorée)
      const shape = (s, dy) => {
        c.beginPath();
        c.moveTo(64, 8 + dy);
        c.bezierCurveTo(78, 34 + dy, 102 * s + 64 * (1 - s), 58, 100 * s + 64 * (1 - s), 84);
        c.arc(64, 84, 36 * s, 0, Math.PI, false);
        c.bezierCurveTo(26 * s + 64 * (1 - s), 58, 50, 34 + dy, 64, 8 + dy);
        c.closePath();
      };
      c.fillStyle = "#ff5a1f"; shape(1, 0); c.fill();
      c.fillStyle = "#ffae2b"; shape(0.72, 18); c.fill();
      c.fillStyle = "#fff3b0"; shape(0.42, 40); c.fill();
    },
    flameB(c) {
      // langue de feu douce (tintable, pour les jets)
      const g = c.createRadialGradient(64, 78, 4, 64, 70, 58);
      g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.4, "rgba(255,255,255,0.75)"); g.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = g;
      c.beginPath(); c.moveTo(64, 4); c.bezierCurveTo(96, 40, 116, 70, 104, 96); c.arc(64, 90, 40, 0.15, Math.PI - 0.15); c.bezierCurveTo(12, 70, 32, 40, 64, 4); c.fill();
    },
    spark(c) {
      const g = c.createLinearGradient(64, 6, 64, 122);
      g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.5, "rgba(255,255,255,1)"); g.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = g; c.beginPath(); c.ellipse(64, 64, 11, 58, 0, 0, Math.PI * 2); c.fill();
    },
    twinkle(c) {
      const g = c.createRadialGradient(64, 64, 0, 64, 64, 30);
      g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = g; c.fillRect(0, 0, 128, 128);
      c.fillStyle = "#fff"; star(c, 64, 64, 4, 60, 9, -Math.PI / 2); c.fill();
    },
    star(c) {
      c.lineJoin = "round";
      c.fillStyle = "#ffd23a"; c.strokeStyle = "#b8560e"; c.lineWidth = 7;
      star(c, 64, 68, 5, 54, 24, -Math.PI / 2); c.fill(); c.stroke();
      c.fillStyle = "rgba(255,255,255,0.7)"; c.beginPath(); c.ellipse(50, 50, 9, 6, -0.6, 0, Math.PI * 2); c.fill();
    },
    snow(c) {
      c.strokeStyle = "#fff"; c.lineCap = "round"; c.lineWidth = 7;
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        const x = Math.cos(a), y = Math.sin(a);
        c.beginPath(); c.moveTo(64, 64); c.lineTo(64 + x * 52, 64 + y * 52); c.stroke();
        for (const d of [26, 40]) {
          const bx = 64 + x * d, by = 64 + y * d;
          for (const s of [-1, 1]) {
            const b = a + s * 0.8;
            c.beginPath(); c.moveTo(bx, by); c.lineTo(bx + Math.cos(b) * 13, by + Math.sin(b) * 13); c.stroke();
          }
        }
      }
    },
    crystal(c) {
      c.beginPath(); c.moveTo(64, 4); c.lineTo(98, 64); c.lineTo(64, 124); c.lineTo(30, 64); c.closePath();
      const g = c.createLinearGradient(30, 4, 98, 124);
      g.addColorStop(0, "#ffffff"); g.addColorStop(0.5, "#c9f3ff"); g.addColorStop(1, "#7fd6f5");
      c.fillStyle = g; c.fill();
      c.fillStyle = "rgba(255,255,255,0.85)"; c.beginPath(); c.moveTo(64, 4); c.lineTo(64, 124); c.lineTo(30, 64); c.closePath(); c.fill();
      c.strokeStyle = "rgba(255,255,255,1)"; c.lineWidth = 4; c.beginPath(); c.moveTo(64, 4); c.lineTo(98, 64); c.lineTo(64, 124); c.lineTo(30, 64); c.closePath(); c.stroke();
    },
    drop(c) {
      dropPath(c, 64, 58, 54);
      const g = c.createLinearGradient(30, 10, 100, 120);
      g.addColorStop(0, "#ffffff"); g.addColorStop(1, "#d8f4ff");
      c.fillStyle = g; c.fill();
      c.fillStyle = "rgba(255,255,255,1)"; c.beginPath(); c.ellipse(50, 80, 8, 14, -0.4, 0, Math.PI * 2); c.fill();
    },
    bubble(c) {
      c.strokeStyle = "rgba(255,255,255,0.95)"; c.lineWidth = 6; c.beginPath(); c.arc(64, 64, 52, 0, Math.PI * 2); c.stroke();
      c.fillStyle = "rgba(255,255,255,0.18)"; c.fill();
      c.fillStyle = "#fff"; c.beginPath(); c.ellipse(44, 42, 12, 7, -0.7, 0, Math.PI * 2); c.fill();
    },
    coin(c) {
      c.fillStyle = "#a35c00"; c.beginPath(); c.arc(64, 66, 56, 0, Math.PI * 2); c.fill();
      const g = c.createRadialGradient(48, 44, 6, 64, 64, 56);
      g.addColorStop(0, "#fff6b8"); g.addColorStop(0.45, "#ffd23a"); g.addColorStop(1, "#e59a0b");
      c.fillStyle = g; c.beginPath(); c.arc(64, 62, 52, 0, Math.PI * 2); c.fill();
      c.strokeStyle = "#c77a06"; c.lineWidth = 5; c.beginPath(); c.arc(64, 62, 40, 0, Math.PI * 2); c.stroke();
      c.fillStyle = "#b86a05"; c.font = "bold 62px sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("$", 64, 66);
    },
    heart(c) {
      heartPath(c, 64, 62, 52);
      c.fillStyle = "#ff3d7f"; c.fill(); c.strokeStyle = "#a3104a"; c.lineWidth = 6; c.stroke();
      c.fillStyle = "rgba(255,255,255,0.8)"; c.beginPath(); c.ellipse(40, 44, 11, 7, -0.7, 0, Math.PI * 2); c.fill();
    },
    dollar(c) {
      c.font = "900 118px sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
      c.lineJoin = "round"; c.strokeStyle = "#0f3d12"; c.lineWidth = 12; c.strokeText("$", 64, 70);
      const g = c.createLinearGradient(0, 10, 0, 120); g.addColorStop(0, "#9dff6a"); g.addColorStop(1, "#1fa83a");
      c.fillStyle = g; c.fillText("$", 64, 70);
    },
    anger(c) {
      c.strokeStyle = "#e0102f"; c.lineCap = "round"; c.lineWidth = 15;
      for (let i = 0; i < 4; i++) {
        c.save(); c.translate(64, 64); c.rotate((i * Math.PI) / 2);
        c.beginPath(); c.moveTo(12, -40); c.quadraticCurveTo(14, -14, 40, -12); c.stroke();
        c.restore();
      }
    },
    sweat(c) {
      dropPath(c, 64, 60, 50);
      c.fillStyle = "#8fe0ff"; c.fill(); c.strokeStyle = "#2a7fb8"; c.lineWidth = 6; c.stroke();
      c.fillStyle = "#fff"; c.beginPath(); c.ellipse(52, 76, 7, 12, -0.4, 0, Math.PI * 2); c.fill();
    },
    splat(c, rnd) {
      c.fillStyle = "#fff";
      blob(c, 64, 64, 40, 14, 0.25, rnd); c.fill();
      for (let i = 0; i < 9; i++) {
        const a = rnd() * Math.PI * 2, d = 44 + rnd() * 14, r = 4 + rnd() * 7;
        c.beginPath(); c.arc(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, r, 0, Math.PI * 2); c.fill();
      }
    },
    scorch(c, rnd) {
      const g = c.createRadialGradient(64, 64, 4, 64, 64, 60);
      g.addColorStop(0, "rgba(255,255,255,0.95)"); g.addColorStop(0.55, "rgba(255,255,255,0.7)"); g.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = g; blob(c, 64, 64, 58, 16, 0.18, rnd); c.fill();
    },
    cracks(c, rnd) {
      c.strokeStyle = "#fff"; c.lineCap = "round";
      for (let i = 0; i < 9; i++) {
        let a = (i / 9) * Math.PI * 2 + rnd() * 0.4, x = 64, y = 64, w = 7;
        c.beginPath(); c.moveTo(x, y);
        for (let k = 0; k < 5; k++) {
          a += (rnd() - 0.5) * 0.7; const d = 9 + rnd() * 5;
          x += Math.cos(a) * d; y += Math.sin(a) * d; c.lineWidth = w; c.lineTo(x, y); w *= 0.8;
        }
        c.stroke();
      }
    },
    frost(c, rnd) {
      c.strokeStyle = "rgba(255,255,255,0.95)"; c.lineCap = "round";
      const branch = (x, y, a, len, w, depth) => {
        if (depth > 3 || len < 4) return;
        const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
        c.lineWidth = w; c.beginPath(); c.moveTo(x, y); c.lineTo(x2, y2); c.stroke();
        branch(x2, y2, a + 0.5 + rnd() * 0.3, len * 0.55, w * 0.7, depth + 1);
        branch(x2, y2, a - 0.5 - rnd() * 0.3, len * 0.55, w * 0.7, depth + 1);
        branch(x2, y2, a + (rnd() - 0.5) * 0.3, len * 0.6, w * 0.75, depth + 1);
      };
      for (let i = 0; i < 7; i++) branch(64, 64, (i / 7) * Math.PI * 2 + rnd() * 0.3, 22, 5, 0);
    },
    ripple(c) {
      c.strokeStyle = "rgba(255,255,255,1)"; c.lineWidth = 6; c.beginPath(); c.arc(64, 64, 54, 0, Math.PI * 2); c.stroke();
      c.strokeStyle = "rgba(255,255,255,0.55)"; c.lineWidth = 4; c.beginPath(); c.arc(64, 64, 40, 0, Math.PI * 2); c.stroke();
    },
    swirl(c) {
      c.strokeStyle = "#fff"; c.lineCap = "round";
      for (let arm = 0; arm < 3; arm++) {
        c.beginPath();
        for (let i = 0; i <= 40; i++) {
          const t = i / 40, a = arm * ((Math.PI * 2) / 3) + t * 4.2, r = 6 + t * 52;
          const x = 64 + Math.cos(a) * r, y = 64 + Math.sin(a) * r;
          if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
        }
        c.lineWidth = 8; c.stroke();
      }
    },
    foam(c, rnd) {
      c.fillStyle = "#fff"; blob(c, 64, 64, 46, 12, 0.22, rnd); c.fill();
      c.globalCompositeOperation = "destination-out";
      for (let i = 0; i < 10; i++) { c.beginPath(); c.arc(30 + rnd() * 68, 30 + rnd() * 68, 3 + rnd() * 6, 0, Math.PI * 2); c.fill(); }
      c.globalCompositeOperation = "source-over";
    },
    shadow(c) {
      const g = c.createRadialGradient(64, 64, 0, 64, 64, 62);
      g.addColorStop(0, "rgba(255,255,255,0.9)"); g.addColorStop(0.5, "rgba(255,255,255,0.6)"); g.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = g; c.fillRect(0, 0, 128, 128);
    },
    boing(c) {
      c.save(); c.translate(64, 66); c.rotate(-0.18);
      c.font = "900 40px sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
      const wBoing = c.measureText("BOING!").width + 12;
      if (wBoing > 118) c.scale(118 / wBoing, 118 / wBoing);
      c.lineJoin = "round"; c.strokeStyle = "#5a2a00"; c.lineWidth = 10; c.strokeText("BOING!", 0, 0);
      c.fillStyle = "#ffe14a"; c.fillText("BOING!", 0, 0);
      c.restore();
    },
    rune(c) {
      c.strokeStyle = "#fff"; c.lineWidth = 4;
      c.beginPath(); c.arc(64, 64, 58, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.arc(64, 64, 46, 0, Math.PI * 2); c.stroke();
      c.lineWidth = 3;
      star(c, 64, 64, 6, 44, 26, 0); c.stroke();
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        c.beginPath(); c.moveTo(64 + Math.cos(a) * 48, 64 + Math.sin(a) * 48); c.lineTo(64 + Math.cos(a) * 56, 64 + Math.sin(a) * 56); c.stroke();
      }
    },
    dashring(c) {
      c.strokeStyle = "#fff"; c.lineWidth = 8; c.lineCap = "round";
      for (let i = 0; i < 16; i++) {
        const a0 = (i / 16) * Math.PI * 2, a1 = a0 + (Math.PI * 2) / 16 * 0.55;
        c.beginPath(); c.arc(64, 64, 56, a0, a1); c.stroke();
      }
    },
    chevron(c) {
      c.strokeStyle = "#fff"; c.lineWidth = 16; c.lineCap = "round"; c.lineJoin = "round";
      for (const y of [44, 84]) { c.beginPath(); c.moveTo(24, y + 20); c.lineTo(64, y - 16); c.lineTo(104, y + 20); c.stroke(); }
    },
    exclaim(c) {
      c.font = "900 112px sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
      c.lineJoin = "round"; c.strokeStyle = "#6b0000"; c.lineWidth = 12; c.strokeText("!", 64, 70);
      c.fillStyle = "#ff3b2f"; c.fillText("!", 64, 70);
    },
    question(c) {
      c.font = "900 108px sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
      c.lineJoin = "round"; c.strokeStyle = "#1c2a6b"; c.lineWidth = 12; c.strokeText("?", 64, 70);
      c.fillStyle = "#6fa8ff"; c.fillText("?", 64, 70);
    },
    poof(c) {
      const lobes = [[64, 66, 30], [36, 70, 22], [92, 70, 22], [48, 46, 22], [80, 44, 22], [64, 88, 20], [40, 90, 14], [90, 90, 14]];
      c.fillStyle = "#6a6a78";
      for (const l of lobes) { c.beginPath(); c.arc(l[0], l[1], l[2] + 5, 0, Math.PI * 2); c.fill(); }
      c.fillStyle = "#ffffff";
      for (const l of lobes) { c.beginPath(); c.arc(l[0], l[1], l[2], 0, Math.PI * 2); c.fill(); }
      c.fillStyle = "#dcdce6";
      for (const l of lobes) { c.beginPath(); c.arc(l[0] + 4, l[1] + 5, l[2] * 0.55, 0, Math.PI * 2); c.fill(); }
    },
    eyeWhite(c) {
      c.fillStyle = "#1a1a1a"; c.beginPath(); c.arc(64, 64, 60, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#ffffff"; c.beginPath(); c.arc(64, 64, 52, 0, Math.PI * 2); c.fill();
      c.fillStyle = "rgba(200,210,230,0.6)"; c.beginPath(); c.arc(70, 72, 44, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#ffffff"; c.beginPath(); c.arc(60, 58, 42, 0, Math.PI * 2); c.fill();
    },
    pupil(c) {
      c.fillStyle = "#111"; c.beginPath(); c.arc(64, 64, 56, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#fff"; c.beginPath(); c.arc(46, 44, 13, 0, Math.PI * 2); c.fill();
    },
    shield(c) {
      c.beginPath(); c.moveTo(64, 10); c.lineTo(108, 26); c.quadraticCurveTo(106, 88, 64, 120); c.quadraticCurveTo(22, 88, 20, 26); c.closePath();
      c.fillStyle = "#2c3e66"; c.fill();
      c.lineWidth = 8; c.strokeStyle = "#e8eefc"; c.stroke();
      c.beginPath(); c.moveTo(64, 26); c.lineTo(94, 36); c.quadraticCurveTo(92, 82, 64, 104); c.closePath(); c.fillStyle = "#5f7fc4"; c.fill();
    },
    leaf(c) {
      c.fillStyle = "#58a832"; c.beginPath(); c.ellipse(64, 64, 16, 50, 0.4, 0, Math.PI * 2); c.fill();
      c.strokeStyle = "#2f6e1b"; c.lineWidth = 4; c.beginPath(); c.moveTo(46, 108); c.lineTo(82, 20); c.stroke();
    },
    shard(c) {
      c.beginPath(); c.moveTo(60, 6); c.lineTo(96, 50); c.lineTo(70, 122); c.lineTo(34, 70); c.closePath();
      c.fillStyle = "#e8fbff"; c.fill();
      c.fillStyle = "rgba(150,220,245,0.9)"; c.beginPath(); c.moveTo(60, 6); c.lineTo(70, 122); c.lineTo(96, 50); c.closePath(); c.fill();
    },
    wind(c) {
      c.strokeStyle = "#fff"; c.lineCap = "round"; c.lineWidth = 7;
      c.beginPath(); c.arc(64, 110, 80, -2.3, -0.84); c.stroke();
      c.lineWidth = 4; c.beginPath(); c.arc(64, 124, 66, -2.1, -1.1); c.stroke();
    },
    zap(c) {
      c.lineJoin = "round";
      c.fillStyle = "#fff"; star(c, 64, 64, 9, 62, 30, 0.2); c.fill();
      c.fillStyle = "rgba(255,255,255,0.0)";
    },
    nut(c) {
      c.beginPath();
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; c.lineTo(64 + Math.cos(a) * 50, 64 + Math.sin(a) * 50); }
      c.closePath(); c.fillStyle = "#9aa3ad"; c.fill(); c.lineWidth = 6; c.strokeStyle = "#4b525b"; c.stroke();
      c.beginPath(); c.arc(64, 64, 18, 0, Math.PI * 2); c.fillStyle = "#3a3f46"; c.fill();
    },
    splash(c) {
      // couronne d'éclaboussure vue de côté
      c.fillStyle = "#fff";
      c.beginPath(); c.moveTo(10, 112);
      const tips = [[20, 50], [36, 30], [52, 58], [64, 10], [76, 58], [92, 28], [108, 48]];
      let x = 10;
      for (const t of tips) { c.quadraticCurveTo((x + t[0]) / 2, 96, t[0], t[1]); x = t[0]; c.quadraticCurveTo(t[0] + 4, 80, t[0] + 8, 96); x = t[0] + 8; }
      c.lineTo(118, 112); c.closePath(); c.fill();
      for (const t of tips) { c.beginPath(); c.arc(t[0], t[1] - 10, 5, 0, Math.PI * 2); c.fill(); }
    },
    sackIcon(c) {
      // silhouette de sac (icône flottante des sacs lâchés)
      c.fillStyle = "#6b3b00"; c.beginPath(); c.arc(64, 64, 62, 0, Math.PI * 2); c.fill();
      const g = c.createRadialGradient(50, 40, 6, 64, 64, 60); g.addColorStop(0, "#fff3a8"); g.addColorStop(1, "#f2a60c");
      c.fillStyle = g; c.beginPath(); c.arc(64, 64, 56, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#7a4300";
      c.beginPath(); c.moveTo(50, 40); c.lineTo(78, 40); c.lineTo(70, 50); c.bezierCurveTo(100, 62, 98, 104, 64, 104); c.bezierCurveTo(30, 104, 28, 62, 58, 50); c.closePath(); c.fill();
      c.fillStyle = "#ffd84a"; c.font = "bold 34px sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("$", 64, 80);
    },
    zzz(c) {
      c.font = "900 60px sans-serif"; c.fillStyle = "#fff"; c.textAlign = "center"; c.fillText("z", 44, 100); c.font = "900 44px sans-serif"; c.fillText("z", 84, 56);
    },
    crown(c) {
      c.beginPath(); c.moveTo(14, 100); c.lineTo(20, 36); c.lineTo(44, 64); c.lineTo(64, 24); c.lineTo(84, 64); c.lineTo(108, 36); c.lineTo(114, 100); c.closePath();
      c.fillStyle = "#ffcf2e"; c.fill(); c.lineWidth = 7; c.strokeStyle = "#8a5200"; c.stroke();
    },
    bolt(c) {
      c.beginPath(); c.moveTo(74, 4); c.lineTo(30, 70); c.lineTo(60, 70); c.lineTo(46, 124); c.lineTo(98, 50); c.lineTo(66, 50); c.closePath();
      c.fillStyle = "#fff"; c.fill();
    },
    arc(c) {
      const g = c.createLinearGradient(0, 0, 128, 0);
      g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.5, "rgba(255,255,255,1)"); g.addColorStop(1, "rgba(255,255,255,0)");
      c.strokeStyle = g; c.lineWidth = 10; c.lineCap = "round";
      c.beginPath(); c.arc(64, 150, 120, -2.1, -1.04); c.stroke();
    },
  };

  let atlasTexture = null;
  gfx.atlas = function () {
    if (atlasTexture) return atlasTexture;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = CELLS * CS;
    const ctx = canvas.getContext("2d");
    const rnd = PTMT.rng ? PTMT.rng(1234) : Math.random;
    for (const name in CELL) {
      const i = CELL[name], p = painters[name];
      if (!p) continue;
      ctx.save();
      ctx.translate((i % CELLS) * CS, Math.floor(i / CELLS) * CS);
      ctx.beginPath(); ctx.rect(2, 2, CS - 4, CS - 4); ctx.clip();
      // marge de 4 px : les sprites sont dessinés dans 120 px centrés
      ctx.translate(4, 4); ctx.scale(120 / 128, 120 / 128);
      p(ctx, rnd);
      ctx.restore();
    }
    atlasTexture = new THREE.CanvasTexture(canvas);
    atlasTexture.premultiplyAlpha = true;
    atlasTexture.encoding = THREE.sRGBEncoding;
    atlasTexture.anisotropy = 2;
    atlasTexture.generateMipmaps = true;
    atlasTexture.minFilter = THREE.LinearMipmapLinearFilter;
    atlasTexture.name = "ptmt:atlas";
    gfx.atlasCanvas = canvas;
    return atlasTexture;
  };

  // ---------------------------------------------------------------------------------------------
  // GLSL
  // ---------------------------------------------------------------------------------------------
  gfx.GLSL = {
    noise: /* glsl */ `
      float ptHash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      float ptHash3(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
      float ptNoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(ptHash(i), ptHash(i + vec2(1.0, 0.0)), u.x), mix(ptHash(i + vec2(0.0, 1.0)), ptHash(i + vec2(1.0, 1.0)), u.x), u.y); }
      float ptFbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ v += a * ptNoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return v; }
      float ptNoise3(vec3 p){ vec3 i = floor(p), f = fract(p); vec3 u = f * f * (3.0 - 2.0 * f);
        float a = mix(mix(ptHash3(i), ptHash3(i + vec3(1,0,0)), u.x), mix(ptHash3(i + vec3(0,1,0)), ptHash3(i + vec3(1,1,0)), u.x), u.y);
        float b = mix(mix(ptHash3(i + vec3(0,0,1)), ptHash3(i + vec3(1,0,1)), u.x), mix(ptHash3(i + vec3(0,1,1)), ptHash3(i + vec3(1,1,1)), u.x), u.y);
        return mix(a, b, u.z); }
    `,
    // sortie standard : ton ACES du rendu + encodage sRGB, puis prémultiplication par a
    outPremul: /* glsl */ `
      #include <tonemapping_fragment>
      #include <encodings_fragment>
    `,
  };

  // ---------------------------------------------------------------------------------------------
  // SpriteBatch
  // ---------------------------------------------------------------------------------------------
  // 32 flottants par sprite :
  //  A pos.xyz  t0 | B vel.xyz life | C size0 size1 rot0 rotVel | D couleur début rgba | E couleur fin rgba
  //  F case mode additif étirement | G gravité traînée sol angle0 | H fondu-entrée fondu-sortie courbe _
  // mode = mouvement * 4 + orientation. Mouvement : 0 balistique, 1 orbite (vel = r0, vr, ω ; G.x = vy ; G.w = angle0).
  // Orientation : 0 face caméra, 1 à plat (sol), 2 étiré selon la vitesse, 3 face caméra « debout » (axe Y fixe).
  // life < 0 : sprite figé (âge 0) pour le mode immédiat.
  const STRIDE = 32;
  const WHITE3 = [1, 1, 1];
  const pick = (x) => (typeof x === "number" ? x : x[0] + Math.random() * (x[1] - x[0]));
  gfx.pick = pick;
  const VERT = /* glsl */ `
    uniform float uTime;
    attribute vec4 iA; attribute vec4 iB; attribute vec4 iC; attribute vec4 iD;
    attribute vec4 iE; attribute vec4 iF; attribute vec4 iG; attribute vec4 iH;
    varying vec2 vUv; varying vec4 vCol; varying float vAdd;
    void main(){
      float life = iB.w;
      float age = uTime - iA.w;
      float t = 0.0;
      if (life < 0.0) { age = 0.0; }
      else {
        t = age / life;
        if (t < 0.0 || t >= 1.0) { gl_Position = vec4(0.0, 0.0, -2.0, 1.0); vCol = vec4(0.0); vUv = vec2(0.0); vAdd = 0.0; return; }
      }
      float mode = iF.y;
      float motion = floor(mode / 4.0 + 0.01);
      float orient = mode - motion * 4.0;
      vec3 p; vec3 vel;
      if (motion > 0.5) {
        float r = max(0.0, iB.x + iB.y * age);
        float a = iG.w + iB.z * age;
        p = iA.xyz + vec3(cos(a) * r, iG.x * age, sin(a) * r);
        vel = vec3(-sin(a), 0.0, cos(a)) * r * iB.z + vec3(0.0, iG.x, 0.0);
      } else {
        float k = iG.y;
        float f = k > 0.0 ? (1.0 - exp(-k * age)) / k : age;
        p = iA.xyz + iB.xyz * f;
        p.y -= 0.5 * iG.x * age * age;
        vel = iB.xyz * (k > 0.0 ? exp(-k * age) : 1.0);
        vel.y -= iG.x * age;
        if (iG.z > -9000.0 && p.y < iG.z) { p.y = iG.z; vel = vec3(vel.x, 0.0, vel.z) * 0.2; }
      }
      float curve = iH.z;
      float st = curve > 1.5 ? (t < 0.25 ? t / 0.25 * 1.15 : 1.15 - 0.15 * min(1.0, (t - 0.25) / 0.2)) : (curve > 0.5 ? 1.0 - (1.0 - t) * (1.0 - t) : t);
      float size = curve > 1.5 ? mix(iC.x, iC.y, t) * st : mix(iC.x, iC.y, st);
      float rot = iC.z + iC.w * age;
      float cr = cos(rot), sr = sin(rot);
      vec2 c = position.xy;
      float aspect = orient > 1.5 && orient < 2.5 ? 1.0 : max(iF.w, 0.0001);
      vec2 cc = vec2(c.x * aspect, c.y);
      vec2 rc = vec2(cc.x * cr - cc.y * sr, cc.x * sr + cc.y * cr) * size;
      vec4 mv;
      if (orient < 0.5) {
        mv = modelViewMatrix * vec4(p, 1.0);
        mv.xy += rc;
      } else if (orient < 1.5) {
        // à plat : (x, -y) garde le sens de la face vers le haut (sinon éliminée vue du dessus)
        mv = modelViewMatrix * vec4(p + vec3(rc.x, 0.0, -rc.y), 1.0);
      } else if (orient < 2.5) {
        mv = modelViewMatrix * vec4(p, 1.0);
        vec3 vv = (modelViewMatrix * vec4(vel, 0.0)).xyz;
        float l = length(vv.xy);
        vec2 dir = l > 1e-4 ? vv.xy / l : vec2(0.0, 1.0);
        vec2 nrm = vec2(dir.y, -dir.x); // base directe : la face reste tournée vers la caméra
        float len = size * (1.0 + l * iF.w);
        mv.xy += dir * c.y * len + nrm * c.x * size;
      } else {
        // debout : largeur selon la droite de la caméra, hauteur selon Y du monde
        vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
        vec3 wp = p + right * rc.x + vec3(0.0, rc.y, 0.0);
        mv = modelViewMatrix * vec4(wp, 1.0);
      }
      gl_Position = projectionMatrix * mv;
      float cell = iF.x;
      vec2 cellXY = vec2(mod(cell, 8.0), floor(cell / 8.0));
      vec2 luv = uv * (126.0 / 128.0) + (1.0 / 128.0);
      vUv = (cellXY + vec2(luv.x, 1.0 - luv.y)) / 8.0;
      vUv.y = 1.0 - vUv.y;
      vec4 col = mix(iD, iE, t);
      float fin = iH.x > 0.0 ? smoothstep(0.0, iH.x, t) : 1.0;
      float fout = iH.y < 1.0 ? 1.0 - smoothstep(iH.y, 1.0, t) : 1.0;
      col.a *= fin * fout;
      vCol = col;
      vAdd = iF.z;
    }
  `;
  const FRAG = /* glsl */ `
    uniform sampler2D uAtlas;
    varying vec2 vUv; varying vec4 vCol; varying float vAdd;
    void main(){
      vec4 tx = texture2D(uAtlas, vUv);
      float a = tx.a * vCol.a;
      if (a < 0.004) discard;
      vec3 c = tx.rgb / max(tx.a, 0.001);
      c = sRGBToLinear(vec4(c, 1.0)).rgb * vCol.rgb;
      gl_FragColor = vec4(c, 1.0);
      ${"#include <tonemapping_fragment>"}
      ${"#include <encodings_fragment>"}
      gl_FragColor.rgb *= a;
      gl_FragColor.a = a * (1.0 - vAdd);
    }
  `;

  /** Nouvelle matière de sprites (même programme GPU pour toutes ; une horloge uTime par matière). */
  gfx.newSpriteMaterial = function () {
    const m = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uAtlas: { value: gfx.atlas() } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor,
      blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
    m.name = "ptmt:sprites";
    return m;
  };

  /**
   * Lot de sprites. mode 'ring' : particules (écriture à l'émission seulement, simulées sur le GPU).
   * mode 'immediate' : tous les sprites sont réécrits à chaque image (begin implicite par jeton d'image).
   * L'horloge (batch.time, en secondes) est celle de la matière (material.uniforms.uTime) : le
   * propriétaire met les deux à jour à chaque image avec setTime().
   */
  class SpriteBatch {
    constructor(capacity, mode, material) {
      this.capacity = capacity;
      this.mode = mode || "ring";
      this.material = material || gfx.newSpriteMaterial();
      this.time = 0;
      const quad = new THREE.PlaneGeometry(1, 1);
      const geo = new THREE.InstancedBufferGeometry();
      geo.index = quad.index;
      geo.setAttribute("position", quad.getAttribute("position"));
      geo.setAttribute("uv", quad.getAttribute("uv"));
      this.array = new Float32Array(capacity * STRIDE);
      // hors d'usage : life = 1e-6 déjà écoulée
      for (let i = 0; i < capacity; i++) { this.array[i * STRIDE + 3] = -1e9; this.array[i * STRIDE + 7] = 1e-6; }
      const ib = new THREE.InstancedInterleavedBuffer(this.array, STRIDE, 1);
      ib.setUsage(THREE.DynamicDrawUsage);
      this.buffer = ib;
      const names = ["iA", "iB", "iC", "iD", "iE", "iF", "iG", "iH"];
      names.forEach((n, k) => geo.setAttribute(n, new THREE.InterleavedBufferAttribute(ib, 4, k * 4)));
      geo.instanceCount = this.mode === "ring" ? capacity : 0;
      this.geometry = geo;
      const mesh = new THREE.Mesh(geo, this.material);
      mesh.frustumCulled = false;
      mesh.renderOrder = 10;
      mesh.name = "ptmt:sprites:" + this.mode;
      this.mesh = mesh;
      this.cursor = 0;
      this.dirtyMin = Infinity;
      this.dirtyMax = -1;
      this.wrapped = false;
      // mode immédiat : remise à zéro à la première écriture après un rendu
      this._rendered = true;
      const self = this;
      mesh.onBeforeRender = function () {
        // l'envoi au GPU a déjà eu lieu pendant la projection de la scène : on repart d'une zone propre
        self.dirtyMin = Infinity; self.dirtyMax = -1; self.wrapped = false;
        self._rendered = true;
      };
      this._manual = false;
    }
    /**
     * Mode immédiat piloté : vide le lot (à appeler au début de chaque mise à jour). Sans begin(), le lot
     * se vide à la première écriture qui suit un rendu, et garde son contenu tant que personne n'écrit
     * (jeu en pause : les sprites restent affichés, figés).
     */
    begin() {
      this._manual = true;
      this.cursor = 0;
      this.geometry.instanceCount = 0;
      this.dirtyMin = Infinity; this.dirtyMax = -1;
    }
    /** Vide le lot immédiatement. */
    clear() {
      this.cursor = 0;
      this.geometry.instanceCount = 0;
    }
    setTime(t) {
      this.time = t;
      this.material.uniforms.uTime.value = t;
    }
    _slot() {
      let i;
      if (this.mode === "ring") {
        i = this.cursor;
        this.cursor = (this.cursor + 1) % this.capacity;
        if (this.cursor === 0) this.wrapped = true;
      } else {
        if (this._rendered && !this._manual) { this.cursor = 0; this.dirtyMin = Infinity; this.dirtyMax = -1; }
        this._rendered = false;
        if (this.cursor >= this.capacity) return -1;
        i = this.cursor++;
        this.geometry.instanceCount = this.cursor;
      }
      if (i < this.dirtyMin) this.dirtyMin = i;
      if (i > this.dirtyMax) this.dirtyMax = i;
      this.buffer.needsUpdate = true;
      const ur = this.buffer.updateRange;
      if (this.wrapped) { ur.offset = 0; ur.count = -1; }
      else { ur.offset = this.dirtyMin * STRIDE; ur.count = (this.dirtyMax - this.dirtyMin + 1) * STRIDE; }
      return i;
    }
    /**
     * Émet un sprite. o : { x,y,z, vx,vy,vz, life, t0, s0, s1, rot, spin, cell, mode, add, stretch|aspect,
     *   r,g,b,a (début, linéaire), r1,g1,b1,a1 (fin), grav, drag, floor, angle0, vy (orbite), fadeIn, fadeOut, curve }
     * Les valeurs absentes prennent des valeurs par défaut raisonnables.
     */
    emit(o) {
      const i = this._slot();
      if (i < 0) return;
      const a = this.array, k = i * STRIDE;
      a[k] = o.x || 0; a[k + 1] = o.y || 0; a[k + 2] = o.z || 0; a[k + 3] = this.time + (o.delay || 0);
      a[k + 4] = o.vx || 0; a[k + 5] = o.vy || 0; a[k + 6] = o.vz || 0; a[k + 7] = o.life !== undefined ? o.life : 1;
      const s0 = o.s0 !== undefined ? o.s0 : 0.5;
      a[k + 8] = s0; a[k + 9] = o.s1 !== undefined ? o.s1 : s0; a[k + 10] = o.rot || 0; a[k + 11] = o.spin || 0;
      const r = o.r !== undefined ? o.r : 1, g = o.g !== undefined ? o.g : 1, b = o.b !== undefined ? o.b : 1, al = o.a !== undefined ? o.a : 1;
      a[k + 12] = r; a[k + 13] = g; a[k + 14] = b; a[k + 15] = al;
      a[k + 16] = o.r1 !== undefined ? o.r1 : r; a[k + 17] = o.g1 !== undefined ? o.g1 : g; a[k + 18] = o.b1 !== undefined ? o.b1 : b; a[k + 19] = o.a1 !== undefined ? o.a1 : 0;
      a[k + 20] = o.cell || 0; a[k + 21] = o.mode || 0; a[k + 22] = o.add || 0; a[k + 23] = o.stretch !== undefined ? o.stretch : o.aspect !== undefined ? o.aspect : 1;
      a[k + 24] = o.grav || 0; a[k + 25] = o.drag || 0; a[k + 26] = o.floor !== undefined ? o.floor : -1e4; a[k + 27] = o.angle0 || 0;
      a[k + 28] = o.fadeIn !== undefined ? o.fadeIn : 0.06; a[k + 29] = o.fadeOut !== undefined ? o.fadeOut : 1; a[k + 30] = o.curve || 0; a[k + 31] = 0;
    }
    /**
     * Émission sans allocation à partir d'une « recette » préparée une fois (mêmes champs que emit ; un
     * champ peut être un intervalle [min, max] tiré au hasard, et `col`/`col1` des triplets de couleur).
     * Position, vitesse, sol et facteur d'opacité sont passés en arguments.
     */
    emitR(rc, x, y, z, vx, vy, vz, floor, alphaMul) {
      const i = this._slot();
      if (i < 0) return;
      const a = this.array, k = i * STRIDE;
      const v = pick;
      a[k] = x; a[k + 1] = y; a[k + 2] = z; a[k + 3] = this.time + (rc.delay ? v(rc.delay) : 0);
      a[k + 4] = vx || 0; a[k + 5] = vy || 0; a[k + 6] = vz || 0; a[k + 7] = v(rc.life);
      const s0 = v(rc.s0);
      a[k + 8] = s0; a[k + 9] = rc.s1 !== undefined ? v(rc.s1) : s0; a[k + 10] = rc.rot === "rand" ? Math.random() * 6.283 : rc.rot ? v(rc.rot) : 0; a[k + 11] = rc.spin ? v(rc.spin) : 0;
      const c0 = rc.col || WHITE3, c1 = rc.col1 || c0, am = alphaMul === undefined ? 1 : alphaMul;
      a[k + 12] = c0[0]; a[k + 13] = c0[1]; a[k + 14] = c0[2]; a[k + 15] = (rc.a === undefined ? 1 : rc.a) * am;
      a[k + 16] = c1[0]; a[k + 17] = c1[1]; a[k + 18] = c1[2]; a[k + 19] = (rc.a1 === undefined ? 0 : rc.a1) * am;
      a[k + 20] = rc.cell || 0; a[k + 21] = rc.mode || 0; a[k + 22] = rc.add || 0; a[k + 23] = rc.stretch !== undefined ? rc.stretch : rc.aspect !== undefined ? rc.aspect : 1;
      a[k + 24] = rc.grav ? v(rc.grav) : 0; a[k + 25] = rc.drag || 0; a[k + 26] = floor !== undefined && floor !== null ? floor : rc.floor !== undefined ? rc.floor : -1e4; a[k + 27] = rc.angle0 ? v(rc.angle0) : 0;
      a[k + 28] = rc.fadeIn !== undefined ? rc.fadeIn : 0.06; a[k + 29] = rc.fadeOut !== undefined ? rc.fadeOut : 1; a[k + 30] = rc.curve || 0; a[k + 31] = 0;
    }
    /**
     * Sprite figé (mode immédiat), sans allocation : position, taille, case, couleur linéaire + alpha,
     * rotation, mélange additif, orientation (0 caméra, 1 sol, 3 debout), rapport largeur/hauteur.
     */
    put(x, y, z, size, cell, r, g, b, al, rot, add, orient, aspect) {
      const i = this._slot();
      if (i < 0) return;
      const a = this.array, k = i * STRIDE;
      a[k] = x; a[k + 1] = y; a[k + 2] = z; a[k + 3] = 0;
      a[k + 4] = 0; a[k + 5] = 0; a[k + 6] = 0; a[k + 7] = -1;
      a[k + 8] = size; a[k + 9] = size; a[k + 10] = rot || 0; a[k + 11] = 0;
      a[k + 12] = r; a[k + 13] = g; a[k + 14] = b; a[k + 15] = al;
      a[k + 16] = r; a[k + 17] = g; a[k + 18] = b; a[k + 19] = al;
      a[k + 20] = cell; a[k + 21] = orient || 0; a[k + 22] = add || 0; a[k + 23] = aspect || 1;
      a[k + 24] = 0; a[k + 25] = 0; a[k + 26] = -1e4; a[k + 27] = 0;
      a[k + 28] = 0; a[k + 29] = 1; a[k + 30] = 0; a[k + 31] = 0;
    }
  }
  gfx.SpriteBatch = SpriteBatch;

  // ---------------------------------------------------------------------------------------------
  // Parts : assemblage de pièces low-poly (position, normale, uv, couleur, matière)
  // ---------------------------------------------------------------------------------------------
  // Classes de matière (aMat.y) : 0 mat, 1 satiné, 2 brillant, 3 métal, 4 lumineux, 5 grille chauffée,
  // 6 or (reflet doré), 7 verre sombre, 8 tissu translucide (non utilisé dans les lots opaques).
  gfx.MAT = { matte: 0, satin: 1, gloss: 2, metal: 3, glow: 4, hot: 5, gold: 6, glass: 7 };
  const _m4 = () => new THREE.Matrix4();
  const _q = () => new THREE.Quaternion();
  const _v = () => new THREE.Vector3();

  class Parts {
    constructor() {
      this.items = [];
    }
    /**
     * Ajoute une géométrie. opt : { color (hex sRGB), mat (classe), part (id), pos [x,y,z], rot [x,y,z] (euler),
     * quat, scale (nombre ou [x,y,z]), matrix (Matrix4), bone (nom, pour les acteurs), flat (normales facettées),
     * shade (assombrissement vers le bas, 0..1), jitter (bosselage), seed }
     */
    add(geometry, opt) {
      opt = opt || {};
      let g = geometry.clone();
      for (const name of Object.keys(g.attributes)) if (name !== "position" && name !== "normal" && name !== "uv") g.deleteAttribute(name);
      if (!g.index) {
        const cnt = g.getAttribute("position").count;
        const idx = new (cnt > 65535 ? Uint32Array : Uint16Array)(cnt);
        for (let i = 0; i < cnt; i++) idx[i] = i;
        g.setIndex(new THREE.BufferAttribute(idx, 1));
      }
      if (!g.getAttribute("uv")) {
        g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(g.getAttribute("position").count * 2), 2));
      }
      const m = opt.matrix ? opt.matrix.clone() : _m4();
      if (!opt.matrix) {
        const s = opt.scale === undefined ? [1, 1, 1] : typeof opt.scale === "number" ? [opt.scale, opt.scale, opt.scale] : opt.scale;
        const q = opt.quat ? opt.quat.clone() : _q().setFromEuler(new THREE.Euler((opt.rot || [0, 0, 0])[0], (opt.rot || [0, 0, 0])[1], (opt.rot || [0, 0, 0])[2], opt.order || "XYZ"));
        m.compose(_v().fromArray(opt.pos || [0, 0, 0]), q, _v().fromArray(s));
      }
      if (opt.jitter) {
        const rnd = PTMT.rng(opt.seed || 7);
        const pos = g.getAttribute("position");
        const map = new Map();
        for (let i = 0; i < pos.count; i++) {
          const key = pos.getX(i).toFixed(3) + "," + pos.getY(i).toFixed(3) + "," + pos.getZ(i).toFixed(3);
          let d = map.get(key);
          if (!d) { d = [(rnd() - 0.5) * opt.jitter, (rnd() - 0.5) * opt.jitter, (rnd() - 0.5) * opt.jitter]; map.set(key, d); }
          pos.setXYZ(i, pos.getX(i) + d[0], pos.getY(i) + d[1], pos.getZ(i) + d[2]);
        }
      }
      g.applyMatrix4(m);
      if (opt.flat) {
        const ni = g.toNonIndexed();
        ni.computeVertexNormals();
        g = ni;
        const cnt = g.getAttribute("position").count, idx = new Uint16Array(cnt);
        for (let i = 0; i < cnt; i++) idx[i] = i;
        g.setIndex(new THREE.BufferAttribute(idx, 1));
      } else if (opt.jitter) g.computeVertexNormals();
      const n = g.getAttribute("position").count;
      const col = new Float32Array(n * 3);
      const c = lin(opt.color === undefined ? 0xffffff : opt.color);
      const shade = opt.shade || 0;
      let ymin = Infinity, ymax = -Infinity;
      const pos = g.getAttribute("position");
      if (shade) for (let i = 0; i < n; i++) { ymin = Math.min(ymin, pos.getY(i)); ymax = Math.max(ymax, pos.getY(i)); }
      for (let i = 0; i < n; i++) {
        let k = 1;
        if (shade) k = 1 - shade * (1 - (pos.getY(i) - ymin) / Math.max(1e-4, ymax - ymin));
        col[i * 3] = c.r * k; col[i * 3 + 1] = c.g * k; col[i * 3 + 2] = c.b * k;
      }
      g.setAttribute("color", new THREE.BufferAttribute(col, 3));
      const mat = new Float32Array(n * 2);
      for (let i = 0; i < n; i++) { mat[i * 2] = opt.part === undefined ? 20 : opt.part; mat[i * 2 + 1] = opt.mat || 0; }
      g.setAttribute("aMat", new THREE.BufferAttribute(mat, 2));
      this.items.push({ g, bone: opt.bone || null, tris: g.index.count / 3 });
      return this;
    }
    /** Fusionne en une géométrie indexée. filter(bone) optionnel. userData.bones : os de chaque sommet. */
    build(filter) {
      const list = this.items.filter((it) => !filter || filter(it.bone));
      let n = 0, ni = 0;
      for (const it of list) { n += it.g.getAttribute("position").count; ni += it.g.index.count; }
      const P = new Float32Array(n * 3), N = new Float32Array(n * 3), U = new Float32Array(n * 2), C = new Float32Array(n * 3), M = new Float32Array(n * 2);
      const I = new (n > 65535 ? Uint32Array : Uint16Array)(ni);
      const bones = [];
      let o = 0, oi = 0;
      for (const it of list) {
        const g = it.g, c = g.getAttribute("position").count;
        P.set(g.getAttribute("position").array, o * 3);
        N.set(g.getAttribute("normal").array, o * 3);
        U.set(g.getAttribute("uv").array, o * 2);
        C.set(g.getAttribute("color").array, o * 3);
        M.set(g.getAttribute("aMat").array, o * 2);
        const idx = g.index.array;
        for (let i = 0; i < idx.length; i++) I[oi + i] = idx[i] + o;
        oi += idx.length;
        for (let i = 0; i < c; i++) bones.push(it.bone);
        o += c;
      }
      const out = new THREE.BufferGeometry();
      out.setAttribute("position", new THREE.BufferAttribute(P, 3));
      out.setAttribute("normal", new THREE.BufferAttribute(N, 3));
      out.setAttribute("uv", new THREE.BufferAttribute(U, 2));
      out.setAttribute("color", new THREE.BufferAttribute(C, 3));
      out.setAttribute("aMat", new THREE.BufferAttribute(M, 2));
      out.setIndex(new THREE.BufferAttribute(I, 1));
      out.userData.bones = bones;
      return out;
    }
    get triangles() {
      let t = 0;
      for (const it of this.items) t += it.tris;
      return t;
    }
  }
  gfx.Parts = Parts;

  // Petites formes utiles ------------------------------------------------------------------------
  /** Tour de révolution à partir d'un profil [[r, y], ...] (bas vers haut). */
  gfx.lathe = function (profile, segments, phiStart, phiLength) {
    return new THREE.LatheGeometry(profile.map((p) => new THREE.Vector2(p[0], p[1])), segments || 10, phiStart || 0, phiLength || Math.PI * 2);
  };
  /** Boîte aux arêtes adoucies (chanfrein par normalisation partielle). */
  gfx.roundBox = function (w, h, d, r, seg) {
    seg = seg || 2;
    const g = new THREE.BoxGeometry(1, 1, 1, seg, seg, seg);
    const p = g.getAttribute("position");
    const hw = w / 2, hh = h / 2, hd = d / 2;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.set(p.getX(i) * w, p.getY(i) * h, p.getZ(i) * d);
      const cx = Math.max(-(hw - r), Math.min(hw - r, v.x));
      const cy = Math.max(-(hh - r), Math.min(hh - r, v.y));
      const cz = Math.max(-(hd - r), Math.min(hd - r, v.z));
      const dx = v.x - cx, dy = v.y - cy, dz = v.z - cz;
      const l = Math.hypot(dx, dy, dz) || 1;
      p.setXYZ(i, cx + (dx / l) * r, cy + (dy / l) * r, cz + (dz / l) * r);
    }
    g.computeVertexNormals();
    return g;
  };
  /** Tube le long d'une courbe de points [[x,y,z], ...]. */
  gfx.tube = function (points, radius, tubular, radial, closed) {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p[0], p[1], p[2])), !!closed);
    return new THREE.TubeGeometry(curve, tubular || 8, radius, radial || 5, !!closed);
  };

  // ---------------------------------------------------------------------------------------------
  // Le sac de trésor (géométrie partagée). Origine : fond du sac ; hauteur ≈ 0,78 × scale.
  // ---------------------------------------------------------------------------------------------
  gfx.addSack = function (parts, opt) {
    opt = opt || {};
    const s = opt.scale || 1;
    const base = new THREE.Matrix4().compose(
      new THREE.Vector3().fromArray(opt.pos || [0, 0, 0]),
      new THREE.Quaternion().setFromEuler(new THREE.Euler((opt.rot || [0, 0, 0])[0], (opt.rot || [0, 0, 0])[1], (opt.rot || [0, 0, 0])[2])),
      new THREE.Vector3(s, s, s),
    );
    const bone = opt.bone || null, part = opt.part;
    const put = (geo, color, mat, local, extra) => {
      const m = new THREE.Matrix4().multiplyMatrices(base, local || new THREE.Matrix4());
      parts.add(geo, Object.assign({ matrix: m, color, mat, bone, part }, extra || {}));
    };
    const T = (x, y, z, rx, ry, rz, sx, sy, sz) =>
      new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0)), new THREE.Vector3(sx || 1, sy || sx || 1, sz || sx || 1));
    // corps du sac : profil ventru, col serré, collerette
    const body = gfx.lathe(
      [[0.0, 0.0], [0.2, 0.02], [0.31, 0.12], [0.35, 0.26], [0.33, 0.4], [0.24, 0.52], [0.12, 0.6], [0.09, 0.63], [0.12, 0.66], [0.2, 0.72], [0.23, 0.76]],
      11,
    );
    put(body, opt.color || 0xf0ac22, gfx.MAT.gold, T(0, 0, 0, 0, 0.2, 0, 1, 1, 0.92), { jitter: 0.035, seed: 11 });
    // corde nouée
    put(new THREE.TorusGeometry(0.11, 0.028, 5, 10), 0x8a4b12, gfx.MAT.matte, T(0, 0.625, 0, Math.PI / 2, 0, 0));
    put(gfx.tube([[0.1, 0.62, 0.05], [0.2, 0.52, 0.12], [0.22, 0.4, 0.16]], 0.022, 5, 4), 0x8a4b12, gfx.MAT.matte);
    // pièces qui dépassent
    const coin = new THREE.CylinderGeometry(0.075, 0.075, 0.02, 10);
    put(coin, 0xffd23a, gfx.MAT.gold, T(0.04, 0.73, 0.02, 0.5, 0, 0.3));
    put(coin, 0xffc21a, gfx.MAT.gold, T(-0.06, 0.74, -0.04, -0.4, 0, -0.5));
    put(coin, 0xffe066, gfx.MAT.gold, T(0.0, 0.78, -0.02, 1.2, 0.3, 0.1));
    // écusson « $ » (disque doré en relief)
    put(new THREE.CylinderGeometry(0.13, 0.13, 0.03, 12), 0xffe27a, gfx.MAT.gold, T(0, 0.27, 0.315, Math.PI / 2, 0, 0));
    put(new THREE.TorusGeometry(0.13, 0.018, 4, 12), 0xb8740a, gfx.MAT.gold, T(0, 0.27, 0.33, 0, 0, 0));
    // « S » stylisé du dollar : deux petits arcs + barre
    put(new THREE.TorusGeometry(0.045, 0.014, 4, 8, Math.PI * 1.3), 0x9a5c06, gfx.MAT.gold, T(0.0, 0.3, 0.335, 0, 0, 0.6));
    put(new THREE.TorusGeometry(0.045, 0.014, 4, 8, Math.PI * 1.3), 0x9a5c06, gfx.MAT.gold, T(0.0, 0.24, 0.335, 0, 0, 0.6 + Math.PI));
    put(new THREE.BoxGeometry(0.018, 0.19, 0.012), 0x9a5c06, gfx.MAT.gold, T(0, 0.27, 0.338));
    return parts;
  };

  /** Matière standard + classes de matière (aMat) pour des accessoires non animés (sac posé, etc.). */
  gfx.propTime = { value: 0 };
  gfx.propMaterial = function (key) {
    return PTMT.mat("gfx:prop:" + (key || "default"), () => {
      const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0 });
      m.onBeforeCompile = (sh) => {
        sh.uniforms.uTime = gfx.propTime;
        m.userData.shader = sh;
        sh.vertexShader = sh.vertexShader
          .replace("#include <common>", "#include <common>\nattribute vec2 aMat;\nvarying vec2 vMat;")
          .replace("#include <begin_vertex>", "#include <begin_vertex>\nvMat = aMat;");
        sh.fragmentShader = sh.fragmentShader
          .replace("#include <common>", "#include <common>\nvarying vec2 vMat;\nuniform float uTime;")
          .replace(
            "#include <roughnessmap_fragment>",
            `#include <roughnessmap_fragment>
            float cls = floor(vMat.y + 0.5);
            if (cls == 1.0) roughnessFactor = 0.55;
            else if (cls == 2.0 || cls == 7.0) roughnessFactor = 0.3;
            else if (cls == 3.0) roughnessFactor = 0.32;
            else if (cls == 6.0) roughnessFactor = 0.38;`,
          )
          .replace(
            "#include <metalnessmap_fragment>",
            `#include <metalnessmap_fragment>
            if (cls == 3.0) metalnessFactor = 0.55;
            else if (cls == 6.0) metalnessFactor = 0.35;`,
          )
          .replace(
            "#include <emissivemap_fragment>",
            `#include <emissivemap_fragment>
            {
              vec3 Vv = normalize(vViewPosition);
              float fres = pow(1.0 - clamp(abs(dot(normalize(vNormal), Vv)), 0.0, 1.0), 2.2);
              if (cls == 4.0) totalEmissiveRadiance += diffuseColor.rgb * 1.6;
              if (cls == 6.0) totalEmissiveRadiance += vec3(1.0, 0.6, 0.1) * (0.22 + 1.5 * fres) * (0.85 + 0.15 * sin(uTime * 4.0));
            }`,
          );
      };
      m.customProgramCacheKey = () => "ptmt-prop-v1";
      return m;
    });
  };
})();
