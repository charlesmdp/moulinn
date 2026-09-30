// « Pas touche à mes trésors » — portraits des tours pour l'interface (PTMT.towerPortraits).
//
//   PTMT.towerPortraits.get("boar", 2)         // chaîne SVG (viewBox 64 × 64, sans taille : la CSS la fixe)
//   PTMT.towerPortraits.get("swan", 5, "A")    // spécialisation A ou B à partir du niveau 4 ; niveau 7 = évolution
//   PTMT.towerPortraits.key("dog", 7, "B")     // "dogB7" : clé du visuel (21 visuels en tout)
//   PTMT.towerPortraits.accent("dog", 4, "B")  // couleur d'accent (cadre, liseré du panneau)
//
// Sanglier : marcassin rayé dans sa bauge (1), jeune sanglier (2), sanglier des talus (3), sanglier
// chasseur au bandeau rouge (A) → Grand Solitaire, vieux mâle argenté aux défenses énormes (A7) ; laie
// baliste (B) → catapulte à châtaignes (B7).
// Cygne : cygneau gris ébouriffé sur son nid (1), cygne blanc (2), cygne majestueux aux ailes levées
// (3), cygne des glaces (A) → cygne royal couronné de glace (A7), cygne noir au bec rouge (B) → cygne
// noir enchanteur aux runes violettes (B7).
// Berger australien merle (yeux vairons bleu et marron, taches cuivrées, poitrail blanc) : chiot (1),
// adulte à crinière de flammes (2), berger de feu aux petites cornes (3), dragon merle rouge (A) →
// grand dragon rouge (A7), dragon merle bleu à l'œil rayonnant (B) → grand dragon bleu (B7).
//
// Même style « autocollant » que les icônes et les portraits des ennemis (liseré clair, contour sombre),
// sans identifiant ni dégradé : plusieurs copies cohabitent sans collision.
(function () {
  "use strict";
  const PTMT = (globalThis.PTMT = globalThis.PTMT || {});
  const K = PTMT.icons && PTMT.icons.kit;
  if (!K) return;
  const { INK, P, C, E, R, G, place, NO, hi, TS, blob, star, sparkle, flameShapes, snowflakeShapes, crownShapes } = K;
  const WHITE = "#fffaf0";
  const cfg = { vb: 64, sw: 2.2, rim: 2.2, cls: "ptmt-tp" };
  const mirror = (shapes) => G("translate(64 0) scale(-1 1)", shapes);
  const sym = (shapes) => [shapes, mirror(shapes)];

  /* ------------------------------------------------------------------ châtaignes */
  /** Bogue de châtaigne (boule verte hérissée, châtaigne brune qui dépasse), centrée en (x, y). */
  function bur(x, y, r) {
    return [
      P(star(x, y, r + 3.2, r, 18, -90), "#6fa336"),
      C(x, y, r, "#9ccf4e", { rim: false }),
      P(`M${x - r * 0.55} ${y - r * 0.1}Q${x} ${y - r * 0.95} ${x + r * 0.55} ${y - r * 0.1}Q${x} ${y + r * 0.35} ${x - r * 0.55} ${y - r * 0.1}Z`, "#7a4420", { rim: false, w: 1.4 }),
      C(x - r * 0.15, y - r * 0.4, r * 0.14, "#fff", hi(0.5)),
    ];
  }

  /* ------------------------------------------------------------------ sangliers */
  // o : fur, dark, mane, snout, tusk (0..3), eyes ("cute"|"normal"|"angry"|"old"|"soft"), stripes,
  // brows, bandana, beard, scars, straw, lashes, strap.
  function boar(o) {
    const fur = o.fur,
      dark = o.dark,
      mane = o.mane || dark;
    const out = [];
    // Épaules
    out.push(P("M4 64L6.5 55Q11 47.5 21 46.5L43 46.5Q53 47.5 57.5 55L60 64Z", fur));
    if (o.stripes) out.push(P("M14 52Q20 49.5 26 50M38 50Q44 49.5 50 52M12 58Q19 55 27 56M37 56Q45 55 52 58", "none", { stroke: "#f3d9a4", w: 2.6, rim: false }));
    // Oreilles
    out.push(sym([P("M15 21Q7 13 7.5 3.5Q17 5.5 23.5 13Z", dark), P("M14.5 17.5Q10.5 11.5 10.5 7.5Q15.5 9.5 19 13.5Z", "#e89a8a", NO)]));
    // Crinière (soies du dessus de la tête)
    const k = o.maneSize || 1;
    out.push(P(`M21 13L${23 - k} ${5 - k * 2}L27 9.5L${29.5} ${1.5 - k * 2}L32 9L${34.5} ${1.5 - k * 2}L37 9.5L${41 + k} ${5 - k * 2}L43 13Z`, mane));
    // Tête
    out.push(P("M32 8.5Q44.5 8.5 47.5 17Q53.5 26 53.5 36.5Q53.5 48.5 43 53.5L21 53.5Q10.5 48.5 10.5 36.5Q10.5 26 16.5 17Q19.5 8.5 32 8.5Z", fur));
    out.push(P("M24.5 13Q32 10.5 39.5 13L37.5 36L26.5 36Z", dark, { rim: false, line: false, o: 0.45 }));
    out.push(P("M14 30Q14.5 20 21 14Q17.5 22 18 31Z", "#fff", hi(0.18)));
    if (o.stripes) out.push(P("M25 12.5Q23.5 23 26.5 35M32 10V35M39 12.5Q40.5 23 37.5 35", "none", { stroke: "#f3d9a4", w: 3, rim: false }));
    if (o.scars) out.push(P("M41 16L46.5 29M42 21L45.5 19.5M43.5 25L47 23.5", "none", { stroke: "#6b3b3b", w: 1.6, rim: false }));
    // Bandeau rouge du chasseur (noué sur le côté, pans au vent)
    if (o.bandana) {
      out.push(P("M11.5 25Q32 16.5 52.5 25L52 31.5Q32 23.5 12 31.5Z", "#d8322a"));
      out.push(P("M13 27.5Q32 20.5 51.5 27.5", "none", { stroke: "#ff8a6e", w: 1.4, rim: false }));
      out.push(P("M51.5 26.5Q58 21.5 63 23.5Q59.5 26.5 57.5 28Q61.5 31 62 35.5Q56.5 33.5 51.5 30Z", "#d8322a"));
      out.push(C(51.5, 28.5, 3, "#b0241d"));
    }
    if (o.strap) {
      out.push(P("M11 27Q32 19 53 27L53 32Q32 24 11 32Z", "#6b4428"));
      out.push(C(32, 22.5, 2.6, "#c9ced6", { w: 1.6 }));
    }
    // Yeux
    const ey = 29;
    if (o.eyes === "cute") {
      out.push(sym([E(24, ey, 5.2, 5.8, WHITE, { rim: false, w: 1.6 }), C(25, ey + 0.8, 3.3, INK, NO), C(26.3, ey - 0.8, 1.3, "#fff", NO)]));
    } else if (o.eyes === "soft") {
      out.push(sym([C(24.5, ey, 3.1, INK, NO), C(25.5, ey - 1, 1, "#fff", NO), P("M20 26.5L18 23.5M22.5 25.3L21.5 22M25.5 25L25.5 21.8", "none", { rim: false, w: 1.5 })]));
    } else {
      out.push(sym([C(24.5, ey, 3.1, o.eyeCol || INK, NO), C(25.5, ey - 1, 1, "#fff", NO)]));
      if (o.eyeCol) out.push(sym([C(24.5, ey, 1.4, INK, NO)]));
    }
    if (o.brows) out.push(P(o.brows === "old" ? "M16 23Q21.5 18.5 29 23.5L27.5 26Q21.5 22.5 17 26Z" : "M17 23.5L28 26.5", o.brows === "old" ? "#eef1f4" : "none", o.brows === "old" ? { rim: false, w: 1.6 } : { rim: false, w: 3 }));
    if (o.brows) out.push(mirror([P(o.brows === "old" ? "M16 23Q21.5 18.5 29 23.5L27.5 26Q21.5 22.5 17 26Z" : "M17 23.5L28 26.5", o.brows === "old" ? "#eef1f4" : "none", o.brows === "old" ? { rim: false, w: 1.6 } : { rim: false, w: 3 })]));
    // Barbe du vieux solitaire
    if (o.beard) out.push(P("M19 50L23 58.5L27 52.5L32 61L37 52.5L41 58.5L45 50Z", "#eef1f4"));
    // Groin et défenses
    out.push(E(32, 44.5, 12.2, 8.6, o.snout || "#f0a393"));
    out.push(P("M22.5 41Q32 37.5 41.5 41", "none", { stroke: "#fff", w: 1.6, rim: false, o: 0.5 }));
    out.push(E(27.5, 45, 2.3, 3.3, INK, NO), E(36.5, 45, 2.3, 3.3, INK, NO));
    const t = o.tusk || 0;
    if (t > 0) {
      const tuskD = t === 1 ? "M22.5 48Q18 45 18.5 39.5Q20.5 44 24.5 45.5Z" : t === 2 ? "M22 49Q15.5 45.5 16 36Q19.5 43 25 45Z" : "M21.5 50Q9.5 46 11 31Q13 26 17 24.5Q14.5 33 17.5 40Q20 44 25.5 44.5Z";
      out.push(sym([P(tuskD, "#fff6dc"), P(t === 3 ? "M16 30Q14.5 38 18.5 44" : "M19.5 40Q19.5 44 22 46", "none", { stroke: "#e4d4b0", w: 1.6, rim: false })]));
    }
    // Bauge de paille du marcassin
    if (o.straw) {
      out.push(P("M2 64Q3 54 14 52.5Q22 56 32 56Q42 56 50 52.5Q61 54 62 64Z", "#e8c56a"));
      out.push(P("M6 60L13 55.5M11 63L19 57M45 57L53 63M51 55.5L58 60M27 59.5L31 64M36 59L33 64", "none", { stroke: "#b8913a", w: 1.6, rim: false }));
    }
    return out;
  }
  /** Petite baliste de bois montée sur le dos de la laie. */
  // Baliste vue de face, sanglée sur le dos : grand arc de bois, corde, bogue engagée au centre.
  const ballista = () => [
    P("M5 17L29 12M59 17L35 12", "none", { stroke: "#f3e4bf", w: 1.4, rim: false }),
    ...TS("M3.5 18Q32 -5 60.5 18", "#b07a48", 4.4),
    P("M8 13.5Q20 5.5 30 4.5", "none", { stroke: "#e2b27a", w: 1.4, rim: false }),
    R(25.5, 6.5, 13, 11, 2.5, "#7b5530"),
    P("M25.5 10.5H38.5", "none", { rim: false, w: 1.2, o: 0.4 }),
    bur(32, 9.5, 5.6),
  ];
  /** Catapulte sanglée sur le dos : bras de bois dressé au-dessus de la tête, grosse bogue dans la cuillère. */
  const catapult = () => [
    P("M40 22L55 5.5L60 9L46 25Z", "#7b5530"),
    ...TS("M50 26L17 10.5", "#9a6a3a", 5),
    P("M7 16Q5 5.5 14.5 3.5Q21.5 9.5 16.5 17.5Q10.5 20 7 16Z", "#8a5a2c"),
    bur(12.5, 9.5, 7.6),
    C(50, 26, 3.2, "#c9ced6"),
  ];
  const place64 = (shapes, x, y, s) => G(`translate(${x} ${y}) scale(${s}) translate(-32 -32)`, shapes.flat(Infinity), s);

  /* ------------------------------------------------------------------ cygnes */
  // o : body, shade, beak, knob, eye, wings ("folded"|"raised"|"royal"), water, frost, runes, crown,
  // curls (plumes frisées du cygne noir), aura.
  function swan(o) {
    const body = o.body || WHITE;
    const out = [];
    const neck = "M24.5 53Q12 41 16.5 29Q20 21 27.5 18.5";
    if (o.aura) out.push(C(36, 30, 27, o.aura, { rim: false, line: false, o: 0.28 }));
    // Eau
    out.push(E(33, 58.5, 29, 6.5, o.water || "#62b6f0"));
    // Ailes levées (derrière le cou)
    if (o.wings === "raised" || o.wings === "royal") {
      const wing = "M32 50Q29 26 45 12Q52 6 61 7Q56.5 12.5 59.5 16.5Q54.5 18.5 57 23Q52 25 54 30Q49 31.5 50 37Q45 39.5 45 46Z";
      out.push(P(wing, body));
      out.push(P("M36 44Q35 28 46 17M40 44Q41 32 50 23", "none", { stroke: o.shade || "#cfd6de", w: 1.8, rim: false }));
      if (o.wings === "royal") out.push(P("M58.5 16.5L63 14.5L60.5 19.5M56.5 23L61 22.5L57.5 26.5M53.5 30L57.5 30.5L53.5 33.5", "none", { stroke: "#7fe3ff", w: 2, rim: false, cap: "round" }));
    }
    // Cou (encre), tête, corps, puis cou (couleur) : une seule silhouette
    out.push(P(neck, "none", { w: 12 + 2.2, cap: "round" }));
    out.push(E(29.5, 17.5, 10, 9, body));
    out.push(P("M11 52.5Q10 43 21 41Q31 39.5 40 43.5Q48 35 58 24Q63.5 37 61 47Q57.5 58.5 38 59Q15 59.5 11 52.5Z", body));
    out.push(P("M36 52Q47 45.5 57.5 33Q60 45 55 52Q48 57.5 38 57.5Z", o.shade || "#dfe5ec", NO));
    out.push(P("M40 50Q48 45 55 37M42 54.5Q50 50 56.5 44", "none", { stroke: "#000", w: 1.3, rim: false, o: 0.18 }));
    out.push(P(neck, "none", { w: 12, stroke: body, rim: false, cap: "round" }));
    out.push(P("M21.5 40Q15 33 17.5 26", "none", { stroke: o.shade || "#dfe5ec", w: 3, rim: false, cap: "round" }));
    if (o.curls) out.push(P("M44 48q2 -3 4 0q2 3 4 0M47 42q2 -3 4 0q2 3 4 0M40 53q2 -3 4 0", "none", { stroke: o.curls, w: 1.5, rim: false }));
    if (o.runes) {
      out.push(P("M44 50l3 -5l3 5M51 44l2.5 -4.5M50.5 40.5l4 1M40 55h5", "none", { stroke: o.runes, w: 2, rim: false, cap: "round" }));
      out.push(P("M17 36l3 -2.5M18.5 30l3.5 -1", "none", { stroke: o.runes, w: 2, rim: false, cap: "round" }));
      out.push(C(18, 35.5, 1.1, "#fff", NO));
    }
    if (o.frost) {
      out.push(P(sparkle(47, 46, 3.4), "#fff", { rim: false, w: 1.2 }));
      out.push(P(sparkle(53, 38, 2.6), "#fff", { rim: false, w: 1.2 }));
      out.push(P("M41 58.5L42.5 62L44 58.5M48 57.5L49.2 60.5L50.5 57.4", "#e6fbff", { rim: false, w: 1.2 }));
    }
    // Bec et tubercule
    out.push(P("M22.5 14.5L6 21Q4.5 22.5 6.5 23L23.5 24Z", o.beak || "#ff8a2e"));
    if (o.beakBand) out.push(P("M11 19.2L12.8 23.2L14.8 23.4L13.2 18.4Z", o.beakBand, NO));
    out.push(P("M20.5 12.3Q26.5 13.5 25.4 24.3L21.6 23.9Z", o.knob || "#2b2b33", { rim: false }));
    // Œil
    out.push(C(32, 16, 2.7, o.eye || INK, { rim: false, w: o.eye ? 1.2 : 0 }));
    if (o.eye) out.push(C(32.2, 16.2, 1.2, INK, NO));
    out.push(C(31.2, 15.1, 0.9, "#fff", NO));
    out.push(P("M28 11.5Q31.5 9.5 35.5 11.5", "none", { rim: false, w: 1.6, o: 0.6 }));
    // Couronne de glace
    if (o.crown) {
      out.push(P("M24 10.5L22.5 1.5L27.5 6.5L30.5 -0.5L33 6L38 1L37 10.5Q31 8 24 10.5Z", "#e6fbff"));
      out.push(P("M27.5 6.5L30.5 -0.5L31 7.5Z", "#9feaff", NO));
      out.push(C(30.5, 7.6, 1.5, "#5fd6f5", { rim: false, w: 1 }));
    }
    out.push(P("M11 58Q18 56 25 58.5Q32 61 40 58.5Q48 56 55 58.5", "none", { stroke: "#d8f1ff", w: 1.8, rim: false }));
    return out;
  }
  /** Cygneau gris ébouriffé, assis dans son nid de brindilles. */
  function cygnet() {
    // Contour festonné (duvet) : arcs bombés vers l'extérieur entre n points d'une ellipse.
    const fluff = (cx, cy, rx, ry, n, amp) => {
      const pt = (a, e) => (cx + (rx + e) * Math.cos(a)).toFixed(1) + " " + (cy + (ry + e) * Math.sin(a)).toFixed(1);
      let d = "M" + pt(0, 0);
      for (let k = 1; k <= n; k++) d += "Q" + pt(((k - 0.5) / n) * Math.PI * 2, amp) + " " + pt((k / n) * Math.PI * 2, 0);
      return d + "Z";
    };
    return [
      P("M3 57Q6 47 18 47.5L46 47.5Q58 47 61 57Q59 63.5 32 63.5Q5 63.5 3 57Z", "#9a6a3a"),
      P(fluff(36, 43, 18, 11.5, 14, 2.6), "#b3b9c2"),
      P("M22 42Q30 36 44 39", "none", { stroke: "#d6dae0", w: 2.4, rim: false }),
      P(fluff(24.5, 25.5, 11.5, 11, 12, 2.4), "#c3c8cf"),
      P("M21 14.5L22 9L25 13.5L27.5 8L28.5 14", "#c3c8cf", { rim: false }),
      P("M16 25.5L6.5 29Q5.5 30.5 7 31L16.5 32Z", "#4a4f58"),
      E(26, 23.5, 3.4, 3.8, INK, NO),
      C(27.2, 22.2, 1.3, "#fff", NO),
      C(24.8, 24.8, 0.6, "#fff", NO),
      E(22.5, 31, 3, 1.8, "#ff9aa6", { rim: false, line: false, o: 0.6 }),
      P("M5 59Q14 53 22 56M40 56Q50 53 59 59M27 58L33 63M14 61L20 58M44 58L50 62", "none", { stroke: "#6b4428", w: 1.8, rim: false }),
      P("M9 54L16 50M48 50L55 54", "none", { stroke: "#c9955a", w: 1.6, rim: false }),
    ];
  }

  /* ------------------------------------------------------------------ bergers et dragons */
  // Yeux vairons du berger australien : gauche bleu, droit marron. slit : pupilles fendues (dragons) ;
  // radiant : l'œil gauche rayonne (dragon bleu).
  function eyesVairons(ey, er, o) {
    const out = [];
    const pupil = (x) => (o.slit ? E(x + 0.3, ey + 0.3, er * 0.24, er * 0.78, INK, NO) : C(x + 0.5, ey + 0.5, er * 0.5, INK, NO));
    if (o.radiant) {
      let rays = "";
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4 + Math.PI / 8;
        rays += `M${(24 + (er + 2.2) * Math.cos(a)).toFixed(1)} ${(ey + (er + 2.2) * Math.sin(a)).toFixed(1)}L${(24 + (er + 5.2) * Math.cos(a)).toFixed(1)} ${(ey + (er + 5.2) * Math.sin(a)).toFixed(1)}`;
      }
      out.push(C(24, ey, er + 4.5, o.radiant, { rim: false, line: false, o: 0.35 }));
      out.push(P(rays, "none", { stroke: "#e6fbff", w: 1.8, rim: false, cap: "round" }));
      out.push(C(24, ey, er + 0.3, "#e6fbff", { rim: false, w: 1.4 }), C(24, ey, er - 1.5, o.radiant, NO), C(24.3, ey + 0.3, er * 0.22, "#fff", NO));
    } else out.push(C(24, ey, er, "#58b8ff", { rim: false, w: 1.4 }), pupil(24), C(23.1, ey - 1.2, er * 0.27, "#fff", NO));
    out.push(C(40, ey, er, "#8a5424", { rim: false, w: 1.4 }), pupil(40), C(39.1, ey - 1.2, er * 0.27, "#fff", NO));
    return out;
  }
  /** Taches merle communes (front, tempe, joue). */
  const merle = (patch) => [
    P("M17 22Q19 14 26 13.5Q22.5 19 19.5 26Z", patch, NO),
    P("M39.5 14Q46.5 15.5 48 23Q43 21.5 41 17.5Z", patch, NO),
    P("M44.5 31Q48.5 34 46 39Q43.5 35.5 44.5 31Z", patch, NO),
    C(22, 36, 1.8, patch, NO),
    C(20.5, 40.5, 1.3, patch, NO),
  ];
  // Berger (niveaux 1 à 3). o : base, patch, copper, white, puppy, flames (0..2), horns, fins, brows.
  function dog(o) {
    const out = [];
    const fl = (x, y, s, r) => place(flameShapes("#ff6a1f", "#ffb21f", "#ffe98a"), x, y, s, r);
    if (o.flames) {
      const s = 0.36 + o.flames * 0.08;
      out.push(fl(9, 31, s, -70), fl(55, 31, s, 70), fl(12, 17, s, -40), fl(52, 17, s, 40), fl(22, 8.5, s, -15), fl(42, 8.5, s, 15));
      if (o.flames >= 2) out.push(fl(32, 6, s + 0.05, 0), fl(8, 45, s * 0.9, -100), fl(56, 45, s * 0.9, 100));
    }
    out.push(P("M8 64Q9 52 20 49.5L44 49.5Q55 52 56 64Z", o.base));
    out.push(P("M23 49.5Q32 58 41 49.5L43.5 64L20.5 64Z", o.white || WHITE, { rim: false }));
    if (o.puppy) out.push(sym([P("M14 58Q17 54 20 56", "none", { stroke: o.copper, w: 3, rim: false })]));
    if (o.puppy) out.push(sym([P("M17.5 17Q10.5 11 5 19.5Q3.5 30 10 35Q14.5 29 18 25Z", o.patch)]));
    else out.push(sym([P("M17.5 19Q12 8.5 17.5 5Q23 7.5 24.5 14Z", o.patch), P("M17.5 5Q14 11 14 15", "none", { stroke: "#000", w: 1.2, rim: false, o: 0.3 })]));
    if (o.horns) out.push(sym([P("M24 14Q19.5 7 22.5 0.5Q26.5 6.5 29.5 11.5Z", "#f0dca8"), P("M23.5 9Q23 5.5 23.5 3", "none", { stroke: "#c9b48a", w: 1.3, rim: false })]));
    if (o.fins) out.push(sym([P("M14 37L3.5 32L7.5 38.5L3 43L13 42Z", "#ff8c2e"), P("M13 38L7 36", "none", { stroke: "#c2410c", w: 1.2, rim: false })]));
    const head = o.puppy
      ? "M32 12Q49 12 51 28.5Q53 42.5 44 49.5Q38.5 53.5 32 53.5Q25.5 53.5 20 49.5Q11 42.5 13 28.5Q15 12 32 12Z"
      : "M32 11Q47 11 49.5 24Q51.5 35 45.5 43Q41 51 32 53.5Q23 51 18.5 43Q12.5 35 14.5 24Q17 11 32 11Z";
    out.push(P(head, o.base));
    out.push(merle(o.patch));
    out.push(E(20, 38.5, 5, 4, o.copper, NO), E(44, 38.5, 5, 4, o.copper, NO));
    out.push(C(24.5, 22.5, 2.3, o.copper, NO), C(39.5, 22.5, 2.3, o.copper, NO));
    out.push(P("M32 13Q34 23 38 29Q44 37 40 46Q32 52 24 46Q20 37 26 29Q30 23 32 13Z", o.white || WHITE, { rim: false, w: 1.6 }));
    out.push(E(32, 37, 4.8, 3.5, INK, NO), C(30.6, 35.9, 1.2, "#fff", NO));
    out.push(P("M32 40.5V43M27 43Q32 47 37 43", "none", { rim: false, w: 1.8 }));
    if (o.puppy) out.push(P("M29.8 44Q32 50.5 34.2 44Z", "#ff7a8a", { rim: false, w: 1.4 }));
    out.push(eyesVairons(29.5, o.puppy ? 4.6 : 3.7, {}));
    if (o.brows) out.push(P("M18.5 23.5L28 26M45.5 23.5L36 26", "none", { rim: false, w: 2.6 }));
    return out;
  }
  // Dragon merle (spécialisations). o : base, patch, points, belly, wingCol, hornCol, big (niveau 7),
  // radiant, flameCol, open (gueule ouverte qui crache).
  function dragon(o) {
    const out = [];
    const fc = o.flameCol || ["#ff6a1f", "#ffb21f", "#ffe98a"];
    const hc = o.hornCol || "#f3e4bf";
    const big = !!o.big;
    // Ailes de chauve-souris, déployées derrière la tête
    const wing = big ? "M20 33Q6.5 25 0.5 3Q8.5 8.5 13.5 6.5Q14.5 13 19.5 13.5Q20 19.5 26 21.5Z" : "M20 31Q9.5 24 4.5 10.5Q11.5 13.5 15 11.5Q16.5 16.5 20.5 17Q21.5 21.5 26 23Z";
    out.push(sym([P(wing, o.wingCol), P(big ? "M18 28Q11 20 6.5 9.5M21.5 24Q17 17.5 14 9" : "M18.5 27Q13 21 9.5 14.5", "none", { stroke: "#000", w: 1.3, rim: false, o: 0.3 })]));
    // Cornes balayées vers l'arrière
    if (big) out.push(sym([P("M20 17Q8 12 5.5 -1Q13.5 6 26.5 12Z", hc), P("M16.5 21.5Q8.5 21.5 2.5 14.5Q11.5 15 19.5 18Z", hc)]));
    else out.push(sym([P("M20.5 17Q11 11 11 0.5Q17 7.5 27 12Z", hc)]));
    // Crête dorsale
    out.push(P(big ? "M25 11.5L27 4L30 10L32 1.5L34 10L37 4L39 11.5Z" : "M26 11.5L28 6L30.5 10.5L32 4L33.5 10.5L36 6L38 11.5Z", o.patch));
    // Collerettes des joues
    out.push(sym([P("M15.5 25L3 20L7 27L2 31.5L9.5 33L6.5 38.5L16.5 36Z", o.patch), P("M14 27L6.5 23.5M13.5 32L6 32.5", "none", { stroke: "#000", w: 1.2, rim: false, o: 0.3 })]));
    // Cou et poitrail écaillé
    out.push(P("M10 64Q11 53 21 50L43 50Q53 53 54 64Z", o.base));
    out.push(P("M24 52Q32 58 40 52L42 64L22 64Z", o.belly, { rim: false }));
    out.push(P("M24.5 57.5Q32 60 39.5 57.5M23.5 61.5Q32 64 40.5 61.5", "none", { rim: false, w: 1.2, o: 0.3 }));
    // Tête : crâne large, joues, mâchoire en long sourire de reptile
    const head = "M32 9Q44.5 9 48.5 17Q53 25 51.5 33.5Q50.5 39.5 47.5 43L42.5 52Q37.5 57.5 32 57.5Q26.5 57.5 21.5 52L16.5 43Q13.5 39.5 12.5 33.5Q11 25 15.5 17Q19.5 9 32 9Z";
    out.push(P(head, o.base));
    out.push(merle(o.patch));
    out.push(P("M26 14l2 2.6l2 -2.6M34 14l2 2.6l2 -2.6M29.5 19l2.5 2.4l2.5 -2.4", "none", { stroke: "#000", w: 1.2, rim: false, o: 0.28 }));
    out.push(C(23, 21.5, 2, o.points, NO), C(41, 21.5, 2, o.points, NO));
    // Arête du museau (plus claire) et naseaux fendus au bout
    out.push(P("M25.5 35Q32 33 38.5 35L40 46.5Q32 49.5 24 46.5Z", "#fff", hi(0.16)));
    out.push(P("M25.8 45.8L29.8 42.8L30.6 46.4Z", INK, NO), P("M38.2 45.8L34.2 42.8L33.4 46.4Z", INK, NO));
    const grin = "M16.5 40Q20.5 49.5 26 52.5Q32 55.5 38 52.5Q43.5 49.5 47.5 40";
    if (o.open) {
      // Gueule grande ouverte : mâchoire du bas abaissée, crocs, langue, souffle de feu
      out.push(P(grin + "Q47 55 41 60Q32 65.5 23 60Q17 55 16.5 40Z", "#7a1f1f"));
      out.push(E(32, 59, 5.5, 3, "#e8566a", NO));
      out.push(P("M19 55Q24 62.5 32 63Q40 62.5 45 55Q44 61.5 38.5 64L25.5 64Q20 61.5 19 55Z", o.belly, { rim: false }));
      out.push(P("M21.5 47L23.2 52.5L25.2 49.6ZM42.5 47L40.8 52.5L38.8 49.6ZM24.5 60.5L26 56.5L27.8 60.8ZM39.5 60.5L38 56.5L36.2 60.8Z", "#fffaf0", { rim: false, w: 1 }));
      out.push(P(grin, "none", { rim: false, w: 2 }));
      out.push(place(flameShapes(fc[0], fc[1], fc[2]), 32, 59, 0.4, 180));
    } else {
      out.push(P(grin + "Q46.5 51 41 56Q32 61.5 23 56Q17.5 51 16.5 40Z", o.belly, { rim: false }));
      out.push(P(grin, "none", { rim: false, w: 2 }));
      out.push(P("M21.5 47L23.2 52L25.2 49.4ZM42.5 47L40.8 52L38.8 49.4Z", "#fffaf0", { rim: false, w: 1 }));
      out.push(P("M24 57Q32 60 40 57", "none", { rim: false, w: 1.2, o: 0.3 }));
    }
    // Arcades sourcilières et yeux fendus
    out.push(sym([P("M16 24L29.5 26.3L28.5 22Q22 20.2 16 24Z", o.patch)]));
    out.push(eyesVairons(29.5, 3.8, { slit: true, radiant: o.radiant }));
    return out;
  }

  /* ------------------------------------------------------------------ catalogue */
  const MERLE = { base: "#a9b6c8", patch: "#2f343d", copper: "#d9823a" };
  const DEF = {
    boar1: () => boar({ fur: "#b07a48", dark: "#7a4e2a", eyes: "cute", stripes: true, straw: true, maneSize: 0.2 }),
    boar2: () => boar({ fur: "#8a5a32", dark: "#5a3a20", tusk: 1, maneSize: 0.6 }),
    boar3: () => boar({ fur: "#734627", dark: "#472a14", tusk: 2, brows: true, maneSize: 1.3 }),
    boarA: () => boar({ fur: "#7a4a28", dark: "#472a14", tusk: 2, brows: true, bandana: true, maneSize: 1.3 }),
    boarA7: () => boar({ fur: "#a3a9b1", dark: "#6f7680", mane: "#eef1f4", tusk: 3, brows: "old", beard: true, scars: true, maneSize: 1.8, snout: "#d9a3a0" }),
    boarB: () => [place64(boar({ fur: "#9a6a40", dark: "#65411f", eyes: "soft", maneSize: 0.4 }), 32, 39.5, 0.82), ballista()],
    boarB7: () => [catapult(), place64(boar({ fur: "#8a5a32", dark: "#5a3a20", eyes: "normal", tusk: 1, strap: true, brows: true, maneSize: 0.9 }), 32, 39.5, 0.82)],
    swan1: () => cygnet(),
    swan2: () => swan({}),
    swan3: () => swan({ wings: "raised" }),
    swanA: () => swan({ body: "#d8f3ff", shade: "#a6daf5", beak: "#8fd0ff", knob: "#2b5d8a", eye: "#1ec8ff", wings: "folded", frost: true, water: "#7fd0f5" }),
    swanA7: () => swan({ body: "#d8f3ff", shade: "#a6daf5", beak: "#8fd0ff", knob: "#2b5d8a", eye: "#1ec8ff", wings: "royal", frost: true, crown: true, water: "#7fd0f5", aura: "#bff0ff" }),
    swanB: () => swan({ body: "#34303e", shade: "#221f2a", beak: "#e8413a", beakBand: "#fffaf0", knob: "#e8413a", eye: "#ff5a4a", curls: "#8a6ccf", water: "#4f8fd0" }),
    swanB7: () => swan({ body: "#34303e", shade: "#221f2a", beak: "#e8413a", beakBand: "#fffaf0", knob: "#e8413a", eye: "#d08cff", curls: "#8a6ccf", runes: "#d08cff", wings: "raised", water: "#6a5cd0", aura: "#b980ff" }),
    dog1: () => dog(Object.assign({ puppy: true }, MERLE)),
    dog2: () => dog(Object.assign({ flames: 1 }, MERLE)),
    dog3: () => dog(Object.assign({ flames: 2, horns: 1, fins: true, brows: true }, MERLE)),
    dogA: () => dragon({ base: "#c8583a", patch: "#7a2418", points: "#f0a04a", belly: "#ffe3b8", wingCol: "#a8392a" }),
    dogA7: () => dragon({ base: "#c24a2e", patch: "#6e1c12", points: "#f7b04e", belly: "#ffe3b8", wingCol: "#9c2f22", big: true, open: true }),
    dogB: () => dragon({ base: "#6f8fb8", patch: "#22324a", points: "#8fd8ff", belly: "#e6f3ff", wingCol: "#3f5f8a", hornCol: "#e6f0ff", radiant: "#5fe0ff" }),
    dogB7: () => dragon({ base: "#5f80ad", patch: "#1b2940", points: "#8fd8ff", belly: "#e6f3ff", wingCol: "#35547f", hornCol: "#e6f0ff", radiant: "#5fe0ff", big: true, open: true, flameCol: ["#2f8ee0", "#5fd6f5", "#e6fbff"] }),
  };
  const ACCENT = {
    boar: "#8a5a32",
    boarA: "#d8322a",
    boarB: "#b07a48",
    swan: "#3f9be8",
    swanA: "#5fd6f5",
    swanB: "#8a5ce0",
    dog: "#ef7d2a",
    dogA: "#d8412f",
    dogB: "#3f7fd8",
  };

  const cache = new Map();
  const tp = (PTMT.towerPortraits = PTMT.towerPortraits || {});
  /** Clé du visuel : "boar1".."boar3", "boarA", "boarA7", "boarB", "boarB7" (idem swan, dog). */
  tp.key = function (family, level, spec) {
    const lv = Math.max(1, Math.min(7, level | 0 || 1));
    if (lv <= 3 || (spec !== "A" && spec !== "B")) return family + Math.min(lv, 3);
    return family + spec + (lv === 7 ? "7" : "");
  };
  /** Portrait SVG d'une tour (famille, niveau 1..7, spécialisation "A" | "B"). */
  tp.get = function (family, level, spec) {
    const key = tp.key(family, level, spec);
    let s = cache.get(key);
    if (s === undefined) {
      s = DEF[key] ? K.svg(DEF[key](), cfg) : "";
      cache.set(key, s);
    }
    return s;
  };
  /** Couleur d'accent d'une tour (famille, et spécialisation à partir du niveau 4). */
  tp.accent = function (family, level, spec) {
    return (level >= 4 && ACCENT[family + spec]) || ACCENT[family] || "#8a5a32";
  };
  tp.keys = Object.keys(DEF);
})();
