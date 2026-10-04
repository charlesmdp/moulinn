// « Pas touche à mes trésors » — jeu d'icônes de l'interface (SVG en ligne, sans ressource externe).
//
//   PTMT.icons.gold, PTMT.icons.mana, PTMT.icons.pause…   // chaînes SVG (viewBox 48 × 48, sans taille : la CSS la fixe)
//   PTMT.icons.get("gold")                                // idem, chaîne vide si le nom est inconnu
//   PTMT.icons.gem(color, state)                          // color 0..5 (rubis, émeraude, saphir, améthyste, topaze,
//                                                         //   diamant) ; state "lair" | "ground" | "carried" | "lost"
//   PTMT.icons.skill("goldVault")                         // une icône par compétence de DATA.SKILLS
//   PTMT.icons.branch("boar")                             // hure de sanglier, cygne, berger (branches et familles)
//   PTMT.icons.status("slow")                             // effets : slow, freeze, fear, burn, radiance, stun, disarm,
//                                                         //   wading (patauge), dazzled (tour éblouie)…
//   PTMT.icons.lair("puits")                              // cachette : moulin, puits, dolmen, chapelle
//   PTMT.icons.names                                      // liste des noms disponibles (galerie du banc d'essai)
//
// Surprises et façons d'attaquer (v4) : tideLow, tideHigh (marée), gate (barrière qui cède), secret
// (passage secret), fly (vol), swim (nage), shot (tir), charges (charges du cygne), beam (jet de feu),
// heat (chaleur), dazzle (éblouissement), peloton, blink, split, wading.
//   PTMT.icons.kit                                        // outils de dessin partagés avec le logo et les portraits
//
// Style « autocollant », commun à tout le jeu (et aux portraits des ennemis) : formes pleines aux
// couleurs franches, contour sombre, liseré clair tout autour, reflets en aplats. Aucun identifiant ni
// dégradé : plusieurs copies d'une même icône cohabitent sans collision dans la page. Toutes les
// épaisseurs de trait sont exprimées dans le repère de l'icône (48 unités), même dans les sous-dessins
// réduits : le trait reste homogène d'une icône composée à l'autre. Lisibles de 20 à 64 px.
(function () {
  "use strict";
  const PTMT = (globalThis.PTMT = globalThis.PTMT || {});

  const INK = "#2b1a10";
  const RIM = "#fffbf0";
  const CREAM = "#fff8e7";
  const f1 = (v) => Math.round(v * 100) / 100;

  /* ------------------------------------------------------------------ outils de dessin */
  // Une forme : { tag, attrs, fill, opt } ; options : rim: false (pas de liseré clair), line: false (pas
  // de contour), w (épaisseur du contour, unités de l'icône), stroke (couleur du trait au lieu de
  // l'encre), o (opacité), dash (pointillés), cap/join.
  const shape = (tag, attrs, fill, opt) => ({ tag, attrs, fill, opt: opt || {} });
  const P = (d, fill, opt) => shape("path", { d }, fill, opt);
  const C = (cx, cy, r, fill, opt) => shape("circle", { cx, cy, r }, fill, opt);
  const E = (cx, cy, rx, ry, fill, opt) => shape("ellipse", { cx, cy, rx, ry }, fill, opt);
  const R = (x, y, w, h, rx, fill, opt) => shape("rect", { x, y, width: w, height: h, rx }, fill, opt);
  /** Groupe transformé ; s = échelle cumulée (pour garder des traits homogènes). */
  const G = (transform, shapes, s) => ({ group: true, transform, s: s || 1, shapes: shapes.flat(Infinity) });
  /** Place un dessin conçu dans la boîte 48 × 48 : centré en (x, y), à l'échelle s, tourné de rot degrés. */
  const place = (shapes, x, y, s, rot) => G(`translate(${f1(x)} ${f1(y)})` + (rot ? ` rotate(${rot})` : "") + ` scale(${s}) translate(-24 -24)`, shapes, s);
  const NO = { rim: false, line: false };
  const hi = (o) => ({ rim: false, line: false, o: o === undefined ? 0.55 : o });
  /** Trait épais cerné d'encre (flèches, croix, bras de flocon) : l'encre puis la couleur par-dessus. */
  const TS = (d, color, w, opt) => [P(d, "none", Object.assign({ w: w + 2.4 * (opt && opt.k ? opt.k : 1), cap: "round" }, opt)), P(d, "none", Object.assign({ w, stroke: color, rim: false, cap: "round" }, opt))];
  /** Silhouette faite de plusieurs formes qui se chevauchent : un seul contour extérieur. */
  const blob = (list, fill, opt) => [...list.map((s) => Object.assign({}, s, { fill, opt: Object.assign({}, s.opt, opt, { w: 4.8 }) })), ...list.map((s) => Object.assign({}, s, { fill, opt: Object.assign({}, s.opt, NO) }))];

  function attrs(a) {
    let out = "";
    for (const k in a) out += " " + k + '="' + a[k] + '"';
    return out;
  }
  function emit(list, pass, scale, cfg) {
    let out = "";
    for (const s of list) {
      if (!s) continue;
      if (s.group) {
        const inner = emit(s.shapes, pass, scale * s.s, cfg);
        if (inner) out += '<g transform="' + s.transform + '">' + inner + "</g>";
        continue;
      }
      const o = s.opt;
      const w = (o.w !== undefined ? o.w : cfg.sw) / scale;
      const tr = o.transform ? ' transform="' + o.transform + '"' : "";
      if (pass === "rim") {
        if (o.rim === false) continue;
        out += "<" + s.tag + attrs(s.attrs) + tr + (s.fill === "none" ? ' fill="none"' : "") + ' stroke-width="' + f1(w + (cfg.rim * 2) / scale) + '"' + (o.cap ? ' stroke-linecap="' + o.cap + '"' : "") + "/>";
        continue;
      }
      let extra = tr + ' fill="' + s.fill + '"';
      if (o.line === false) extra += ' stroke="none"';
      else {
        if (o.stroke) extra += ' stroke="' + o.stroke + '"';
        if (Math.abs(w - cfg.sw) > 0.001) extra += ' stroke-width="' + f1(w) + '"';
        if (o.dash) extra += ' stroke-dasharray="' + o.dash + '"';
        if (o.cap) extra += ' stroke-linecap="' + o.cap + '"';
      }
      if (o.o !== undefined) extra += ' opacity="' + o.o + '"';
      out += "<" + s.tag + attrs(s.attrs) + extra + "/>";
    }
    return out;
  }
  /** Chaîne SVG complète d'une liste de formes. cfg : { vb, sw (contour), rim (liseré, par côté), cls }. */
  function svg(list, cfg) {
    cfg = Object.assign({ vb: 48, sw: 2.4, rim: 2.1, cls: "ptmt-ico" }, cfg || {});
    list = list.flat(Infinity);
    const vb = typeof cfg.vb === "number" ? "0 0 " + cfg.vb + " " + cfg.vb : cfg.vb;
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + vb + '" class="' + cfg.cls + '" aria-hidden="true" focusable="false">' +
      (cfg.rim > 0 ? '<g fill="' + RIM + '" stroke="' + RIM + '" stroke-linejoin="round" stroke-linecap="round">' + emit(list, "rim", 1, cfg) + "</g>" : "") +
      '<g stroke="' + INK + '" stroke-width="' + cfg.sw + '" stroke-linejoin="round" stroke-linecap="round">' + emit(list, "body", 1, cfg) + "</g></svg>"
    );
  }

  // Formes géométriques utiles.
  function star(cx, cy, R1, r, n, rot) {
    n = n || 5;
    rot = rot === undefined ? -90 : rot;
    let d = "";
    for (let k = 0; k < n * 2; k++) {
      const a = ((rot + (k * 180) / n) * Math.PI) / 180;
      const rr = k % 2 ? r : R1;
      d += (k ? "L" : "M") + f1(cx + rr * Math.cos(a)) + " " + f1(cy + rr * Math.sin(a));
    }
    return d + "Z";
  }
  /** Étincelle à quatre branches aux côtés creusés. */
  function sparkle(cx, cy, R1, k) {
    const r = R1 * (k || 0.26);
    return `M${cx} ${cy - R1}Q${f1(cx + r)} ${f1(cy - r)} ${cx + R1} ${cy}Q${f1(cx + r)} ${f1(cy + r)} ${cx} ${cy + R1}Q${f1(cx - r)} ${f1(cy + r)} ${cx - R1} ${cy}Q${f1(cx - r)} ${f1(cy - r)} ${cx} ${cy - R1}Z`;
  }
  function gear(cx, cy, R1, r, teeth) {
    let d = "";
    const step = (Math.PI * 2) / teeth;
    for (let k = 0; k < teeth; k++) {
      const a = k * step - Math.PI / 2;
      const pts = [
        [r, a - step * 0.5],
        [r, a - step * 0.3],
        [R1, a - step * 0.2],
        [R1, a + step * 0.2],
        [r, a + step * 0.3],
      ];
      for (const [rr, aa] of pts) d += (d ? "L" : "M") + f1(cx + rr * Math.cos(aa)) + " " + f1(cy + rr * Math.sin(aa));
    }
    return d + "Z";
  }
  /** Arc de cercle (degrés, 0 = droite, sens horaire). */
  function arc(cx, cy, r, a0, a1) {
    const p = (a) => [f1(cx + r * Math.cos((a * Math.PI) / 180)), f1(cy + r * Math.sin((a * Math.PI) / 180))];
    const [x0, y0] = p(a0);
    const [x1, y1] = p(a1);
    const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
    return `M${x0} ${y0}A${r} ${r} 0 ${large} ${a1 > a0 ? 1 : 0} ${x1} ${y1}`;
  }
  /** Couleur mélangée (a vers b, t de 0 à 1). */
  function mix(a, b, t) {
    const pa = parseInt(a.slice(1), 16),
      pb = parseInt(b.slice(1), 16);
    const c = (sh) => Math.round(((pa >> sh) & 255) * (1 - t) + ((pb >> sh) & 255) * t);
    return "#" + ((1 << 24) | (c(16) << 16) | (c(8) << 8) | c(0)).toString(16).slice(1);
  }

  /* ------------------------------------------------------------------ couleurs */
  const COL = {
    gold: "#ffc93a",
    goldDark: "#e0921a",
    goldEdge: "#c3730f",
    goldLight: "#fff3b0",
    mana: "#5d4cf0",
    manaDark: "#3a2bb4",
    manaLight: "#b3aaff",
    red: "#e8412f",
    green: "#5cc443",
    greenDark: "#2f8f3a",
    blue: "#3f9be8",
    blueDark: "#2266b8",
    ice: "#bff0ff",
    cyan: "#5fd6f5",
    purple: "#9b59e0",
    orange: "#ff8c2e",
    brown: "#8a5a32",
    wood: "#c98d4f",
    woodDark: "#8a5a2c",
    steel: "#dfe5ec",
    steelDark: "#9aa6b5",
    stone: "#a7abb4",
    stoneDark: "#747985",
  };
  // Gemmes : clair, base, moyen, sombre.
  const GEMS = [
    ["#ff9aa0", "#ec2c42", "#c61d35", "#8a0f24"], // rubis
    ["#8ef5b4", "#22c25d", "#169447", "#0b6130"], // émeraude
    ["#9cc0ff", "#2f6ff2", "#1f52c6", "#12318a"], // saphir
    ["#e2b6ff", "#a452f2", "#7f36c9", "#52208c"], // améthyste
    ["#ffe796", "#ffb420", "#ea8b0b", "#b06004"], // topaze
    ["#ffffff", "#dcf4ff", "#a9ddf5", "#77b8dd"], // diamant
  ];
  const GEM_LOST = ["#eef0f3", "#bfc5cc", "#9ea6af", "#79818b"];

  /* ------------------------------------------------------------------ sous-dessins */
  function gemShapes(pal) {
    const [light, base, mid, dark] = pal;
    return [
      P("M15 10.5L33 10.5L42.5 19.5L24 42L5.5 19.5Z", base),
      P("M5.5 19.5L15 10.5L19 19.5Z", mid, NO),
      P("M15 10.5L33 10.5L29 19.5L19 19.5Z", light, NO),
      P("M33 10.5L42.5 19.5L29 19.5Z", mid, NO),
      P("M5.5 19.5L19 19.5L24 42Z", base, NO),
      P("M19 19.5L29 19.5L24 42Z", mix(base, light, 0.35), NO),
      P("M29 19.5L42.5 19.5L24 42Z", dark, NO),
      P("M5.5 19.5L42.5 19.5M19 19.5L15 10.5M29 19.5L33 10.5M19 19.5L24 42M29 19.5L24 42", "none", { rim: false, w: 1.1, o: 0.45 }),
      P("M16.5 13L21 13L18.5 17.5Z", "#fff", hi(0.85)),
      P("M11 22L16 22L20.5 33Z", "#fff", hi(0.35)),
      P("M15 10.5L33 10.5L42.5 19.5L24 42L5.5 19.5Z", "none", { rim: false }),
    ];
  }
  const coinShapes = () => [
    C(24, 26.6, 17.2, COL.goldEdge),
    C(24, 23.4, 17.2, COL.gold),
    C(24, 23.4, 12, "none", { stroke: COL.goldDark, w: 2.4, rim: false }),
    P(star(24, 23.6, 6.6, 2.9, 5), COL.goldDark, NO),
    P(arc(24, 23.4, 14.2, 200, 250), "none", { stroke: COL.goldLight, w: 2.8, rim: false }),
    C(24, 23.4, 17.2, "none", { rim: false }),
  ];
  const flameShapes = (outer, midc, core) => [
    P("M24 45Q9.5 43.5 9.5 30Q9.5 21 16.5 13.5Q17 20.5 21 22.5Q20 12 28.5 3.5Q28.5 13 34.5 19Q39.5 24.5 38.5 31.5Q37.5 43.5 24 45Z", outer || "#ff6a1f"),
    P("M24 41.5Q15 40.5 15 32Q15.5 26 20 22.5Q21 28.5 25.5 29.5Q24.5 22.5 29.5 16.5Q31.5 23.5 33.5 27.5Q35.5 32 33.5 36Q31 41.5 24 41.5Z", midc || "#ffb21f", NO),
    P("M24 40.5Q18.5 39.5 19.5 34.5Q20 30.5 23 28.5Q24 32.5 27.5 32.5Q29.5 34.5 29 36.5Q28 40.5 24 40.5Z", core || "#ffe98a", NO),
  ];
  const snowflakeD = (() => {
    let d = "";
    for (let k = 0; k < 6; k++) {
      const a = (k * Math.PI) / 3 - Math.PI / 2;
      const ca = Math.cos(a),
        sa = Math.sin(a);
      const pt = (r, off) => [f1(24 + r * ca - off * sa), f1(24 + r * sa + off * ca)];
      const [x1, y1] = pt(17, 0);
      d += `M24 24L${x1} ${y1}`;
      const [bx, by] = pt(10.5, 0);
      const [l1x, l1y] = pt(15.5, -5);
      const [r1x, r1y] = pt(15.5, 5);
      d += `M${l1x} ${l1y}L${bx} ${by}L${r1x} ${r1y}`;
    }
    return d;
  })();
  const snowflakeShapes = (col) => [...TS(snowflakeD, col || COL.ice, 3.6), C(24, 24, 4.6, col || COL.ice)];
  const boltShapes = (col) => [
    P("M28 3L9.5 27.5L22 27.5L16.5 45L39 17.5L26 17.5L32 3Z", col || "#ffd83a"),
    P("M27.5 6L14.5 24.5L20 24.5L25 12Z", "#fff8c0", hi(0.8)),
  ];
  const meteorShapes = () => [
    P("M8.2 23.4Q13 15 22 12.5Q27 7 45 3Q39 12 36.5 16.5Q37 28 25.6 39.8Z", "#ff7a1f"),
    P("M12.5 25Q17.5 18.5 25 17Q30 11.5 40 7.5Q35 14 33 18.5Q33 27 24.5 35Z", "#ffc21f", NO),
    P("M17 28Q22 23 28 21.5Q31 18 35 15Q31.5 21 30.5 24.5Q29 29 24 32Z", "#fff08a", NO),
    C(17, 32, 11.2, "#8a5a3c"),
    P("M9 37Q13 42.5 20 43Q26 42 28 36Q22 41 16 39.5Q11 38.5 9 37Z", "#5e3b22", NO),
    C(13.5, 29.5, 2.8, "#6b4428", NO),
    C(20.5, 36, 2.1, "#6b4428", NO),
    C(21, 27.5, 1.6, "#6b4428", NO),
    P(arc(17, 32, 8.2, 195, 265), "none", { stroke: "#c9956a", w: 2.4, rim: false }),
    C(17, 32, 11.2, "none", { rim: false }),
  ];
  const bookShapes = (cover) => [
    P("M4 13Q14 9 24 13Q34 9 44 13L44 40Q34 36 24 40Q14 36 4 40Z", cover || "#b5482a"),
    P("M6.5 12Q15 8.5 24 12L24 37.5Q15 34 6.5 37.5Z", "#fff6df"),
    P("M41.5 12Q33 8.5 24 12L24 37.5Q33 34 41.5 37.5Z", "#f3e4bf"),
    P("M24 12L24 38", "none", { rim: false, w: 1.6 }),
    P("M10 17Q14 15.5 20 16.5M10 21.5Q14 20 20 21M28 16.5Q34 15.5 38 17M28 21Q34 20 38 21.5", "none", { rim: false, w: 1.3, o: 0.35 }),
  ];
  const crownShapes = (col, gemsOn) => [
    P("M7 18L15.5 27L24 11L32.5 27L41 18L37.5 37L10.5 37Z", col || COL.gold),
    P("M9 21L15.5 29L24 14.5L24 34L10.5 34Z", "#fff3b0", hi(0.45)),
    R(9.5, 33.5, 29, 7.5, 2.8, col === "#d8412f" ? "#a82a1f" : COL.goldDark),
    C(7, 17.5, 3, col || COL.gold),
    C(24, 10, 3.4, col || COL.gold),
    C(41, 17.5, 3, col || COL.gold),
    gemsOn === false ? [] : [C(16.5, 37.2, 2.3, "#2f6ff2", { rim: false, w: 1.4 }), C(24, 37.2, 2.7, "#ec2c42", { rim: false, w: 1.4 }), C(31.5, 37.2, 2.3, "#22c25d", { rim: false, w: 1.4 })],
  ];
  const dropShapes = (col, light) => [
    P("M24 4Q37 20 37 29.5A13 13 0 0 1 11 29.5Q11 20 24 4Z", col || COL.blue),
    P("M16.5 27Q16.5 21 21 15", "none", { stroke: light || "#cfe9ff", w: 3, rim: false }),
    C(17, 33, 2, light || "#cfe9ff", NO),
  ];
  const hourglassShapes = () => [
    R(10, 4, 28, 6, 2.5, COL.woodDark),
    R(10, 38, 28, 6, 2.5, COL.woodDark),
    P("M13 10L35 10Q35 19 26.5 24Q35 29 35 38L13 38Q13 29 21.5 24Q13 19 13 10Z", "#eaf6ff"),
    P("M16.5 13L31.5 13Q30 18 24 21Q18 18 16.5 13Z", "#ffd36a", NO),
    P("M24 26L24 30M17 36Q24 30 31 36Z", "#ffd36a", { rim: false, line: false }),
    P("M24 25.5V31", "none", { stroke: "#ffd36a", w: 1.6, rim: false }),
    P("M13 10L35 10Q35 19 26.5 24Q35 29 35 38L13 38Q13 29 21.5 24Q13 19 13 10Z", "none", { rim: false }),
  ];
  const coinSmall = (x, y, s) => place(coinShapes(), x, y, s);

  /* ------------------------------------------------------------------ têtes des trois gardiens */
  const boarHead = (fur, mane) => [
    P("M8 7.5L19 15L10.5 22.5Z", mane || "#5a3a20"),
    P("M40 7.5L29 15L37.5 22.5Z", mane || "#5a3a20"),
    P("M10.5 11L15.5 15L11.5 18.5Z", "#e89a8a", NO),
    P("M37.5 11L32.5 15L36.5 18.5Z", "#e89a8a", NO),
    P("M24 8Q37.5 8 39.5 20.5Q41.5 31 34 38L14 38Q6.5 31 8.5 20.5Q10.5 8 24 8Z", fur || COL.brown),
    P("M17 9.5L19.5 3.5L22 8.6L24 2.5L26 8.6L28.5 3.5L31 9.5Z", mane || "#5a3a20"),
    P("M12 22Q13 14 19 11.5Q15 17 15 23Z", "#fff", hi(0.22)),
    E(24, 32.5, 10, 7.2, "#f0a393"),
    E(20.3, 32.6, 1.9, 2.7, INK, NO),
    E(27.7, 32.6, 1.9, 2.7, INK, NO),
    P("M14.5 35Q9.5 31 11 24.5Q13 30.5 18.5 33Z", "#fffaf0"),
    P("M33.5 35Q38.5 31 37 24.5Q35 30.5 29.5 33Z", "#fffaf0"),
    C(17.8, 22, 2.7, INK, NO),
    C(30.2, 22, 2.7, INK, NO),
    C(18.6, 21.1, 0.9, "#fff", NO),
    C(31, 21.1, 0.9, "#fff", NO),
    P("M13.5 16.5L21.5 19.5M34.5 16.5L26.5 19.5", "none", { rim: false, w: 2.8 }),
  ];
  /** Cygne sur l'eau, tourné vers la gauche : cou en S, aile relevée à l'arrière. */
  const swanHead = (body, beak, knob, eye, water) => {
    const neck = "M15.5 31Q8.5 23.5 11.5 16Q14 10.5 19 9.5";
    return [
      E(25, 41.5, 19.5, 4.6, water || "#62b6f0"),
      P(neck, "none", { w: 7.6 + 2.4, cap: "round" }),
      C(19.5, 9.8, 5.6, body || "#fffaf0"),
      P("M9.5 35Q8.5 27.5 16 26.5Q23 26 28.5 28.5Q34 21.5 41.5 11.5Q45.5 21 44 30Q41.5 40 27 40.5Q12 41 9.5 35Z", body || "#fffaf0"),
      P("M28.5 28.5Q34 24 39.5 16.5M27 33Q34 30.5 41 23.5", "none", { stroke: "#000", w: 1.4, rim: false, o: 0.2 }),
      P(neck, "none", { w: 7.6, stroke: body || "#fffaf0", rim: false, cap: "round" }),
      P("M15 7.8L5 11.5L15.5 13.8Z", beak || "#ff8a2e"),
      P("M14 6.4Q17.6 7.4 16.8 14L14.4 13.4Z", knob || "#2b2b33", { rim: false }),
      C(20.5, 9.2, 1.7, eye || INK, NO),
      C(20.1, 8.7, 0.55, "#fff", NO),
      P("M11 41Q18 39 25 41.5Q32 43.5 39 41", "none", { stroke: "#d8f1ff", w: 1.8, rim: false }),
    ];
  };
  const dogHead = (base, patch, copper, flame) => [
    flame === false ? [] : [place(flameShapes("#ff6a1f", "#ffb21f", "#ffe98a"), 11, 10, 0.5, -28), place(flameShapes("#ff6a1f", "#ffb21f", "#ffe98a"), 37, 10, 0.5, 28), place(flameShapes("#ff6a1f", "#ffb21f", "#ffe98a"), 24, 7, 0.62)],
    P("M8.5 13Q11 5.5 19 8.5L17 21.5Z", patch || "#2f343d"),
    P("M39.5 13Q37 5.5 29 8.5L31 21.5Z", patch || "#2f343d"),
    P("M24 9Q36.5 9 38.5 21Q40.5 32 33 38.5Q24 42.5 15 38.5Q7.5 32 9.5 21Q11.5 9 24 9Z", base || "#9fb0c6"),
    P("M12 17Q15 11 20 11.5Q17 16 13.5 21Z", patch || "#2f343d", NO),
    P("M31 12Q36 13 37 19Q33 18 31.5 15Z", patch || "#2f343d", NO),
    P("M34 27Q37.5 30 35 34Q33 31 34 27Z", patch || "#2f343d", NO),
    E(14.5, 30, 4, 3.4, copper || "#d9823a", NO),
    E(33.5, 30, 4, 3.4, copper || "#d9823a", NO),
    C(17.5, 16.5, 1.7, copper || "#d9823a", NO),
    C(30.5, 16.5, 1.7, copper || "#d9823a", NO),
    P("M24 11Q25.5 19 29.5 23.5Q34.5 30 30.5 36.5Q24 40.5 17.5 36.5Q13.5 30 18.5 23.5Q22.5 19 24 11Z", "#fffaf0", { rim: false, w: 1.6 }),
    E(24, 28, 3.8, 2.8, INK, NO),
    C(23, 27.2, 0.9, "#fff", NO),
    P("M24 30.5V33M20 33Q24 36 28 33", "none", { rim: false, w: 1.8 }),
    C(17.8, 21.5, 2.9, "#58b8ff", { rim: false, w: 1.4 }),
    C(30.2, 21.5, 2.9, "#8a5424", { rim: false, w: 1.4 }),
    C(18.2, 21.8, 1.4, INK, NO),
    C(30.6, 21.8, 1.4, INK, NO),
    C(17.4, 20.9, 0.7, "#fff", NO),
    C(29.8, 20.9, 0.7, "#fff", NO),
  ];

  /* ------------------------------------------------------------------ définitions */
  const DEF = {};

  // Ressources
  DEF.gold = coinShapes;
  DEF.coins = () => [place(coinShapes(), 18, 29, 0.62), place(coinShapes(), 31, 31, 0.62), place(coinShapes(), 24, 17, 0.62)];
  DEF.mana = () => [
    C(24, 25, 17, COL.mana),
    P("M9.2 29.5A15.3 15.3 0 0 0 38.8 29.5A16.5 12.5 0 0 1 9.2 29.5Z", COL.manaDark, NO),
    P("M14.5 28Q16 17.5 26.5 17Q34.5 17.5 33.5 25.5Q32.5 30 27.5 29.5", "none", { stroke: "#8f84ff", w: 3, rim: false }),
    E(18, 17.5, 5.2, 3.6, "#cfc9ff", NO),
    C(16.6, 16.8, 1.9, "#fff", NO),
    C(24, 25, 17, "none", { rim: false }),
    P(sparkle(38, 10.5, 7.5), "#fff"),
  ];
  DEF.skillPoint = () => [
    C(24, 24, 17.5, "#7a3fd6"),
    C(24, 24, 13, "none", { stroke: "#b58cff", w: 2.2, rim: false }),
    P(star(24, 25, 10, 4.4, 5), "#ffd84a"),
    E(16.5, 14.5, 4.2, 2.4, "#fff", hi(0.45)),
  ];
  DEF.xp = () => [P(sparkle(21, 27, 17, 0.3), "#b86cff"), P(sparkle(21, 27, 9, 0.3), "#e7c6ff", NO), P(sparkle(37.5, 11, 7.5), "#ffd84a"), P(sparkle(38.5, 36, 5), "#7ad7ff")];
  DEF.gems = () => [place(gemShapes(GEMS[2]), 33, 28, 0.55, 12), place(gemShapes(GEMS[1]), 15, 28, 0.55, -12), place(gemShapes(GEMS[0]), 24, 22, 0.66), P(sparkle(38, 9, 6), "#fff")];
  DEF.wave = () => [
    R(10.5, 6.5, 4.6, 37.5, 2.3, COL.woodDark),
    C(12.8, 6.5, 3.4, COL.gold),
    P("M15 9Q21.5 5.5 28 9.5Q34.5 13 41.5 9.5L39 18.5L41.5 26.5Q34.5 30 28 26.5Q21.5 23 15 26.5Z", COL.red),
    P("M17.5 12.5Q22 10.5 27 13", "none", { stroke: "#ff9a86", w: 2.4, rim: false }),
    E(12.8, 44, 7, 2.2, INK, hi(0.25)),
  ];
  DEF.timer = () => [
    R(19.5, 3, 9, 5.5, 2, "#c9ced6"),
    R(21.8, 7, 4.4, 4.5, 1, "#9aa3ad"),
    P("M35.5 11.5L39 8L42 11L38.5 14.5Z", "#9aa3ad"),
    C(24, 27, 16.5, COL.red),
    C(24, 27, 12.5, "#fffdf5"),
    P("M24 16.5V19M24 35V37.5M13.5 27H16M32 27H34.5", "none", { rim: false, w: 2 }),
    P("M24 27L24 19.5", "none", { rim: false, w: 3 }),
    P("M24 27L30 30.5", "none", { rim: false, w: 3 }),
    C(24, 27, 2.2, INK, NO),
    P(arc(24, 27, 14.5, 205, 250), "none", { stroke: "#ff9a86", w: 2.2, rim: false }),
  ];
  // Commandes
  const tri = (x, w, col) => P(`M${x} 11.5Q${x} 9 ${x + 2.4} 10.4L${x + w} 22.2Q${x + w + 2.2} 24 ${x + w} 25.8L${x + 2.4} 37.6Q${x} 39 ${x} 36.5Z`, col);
  DEF.speed1 = () => [tri(15, 18, "#7bd44f")];
  DEF.speed2 = () => [tri(6, 15, "#ffd23a"), tri(22, 15, "#ffd23a")];
  DEF.speed3 = () => [tri(2.5, 12, "#ff8c2e"), tri(15, 12, "#ff8c2e"), tri(27.5, 12, "#ff8c2e")];
  DEF.pause = () => [R(11.5, 9, 9, 30, 3, CREAM), R(27.5, 9, 9, 30, 3, CREAM)];
  DEF.play = () => [P("M15 10Q15 7 17.6 8.5L38.5 21.6Q41.2 24 38.5 26.4L17.6 39.5Q15 41 15 38Z", CREAM)];
  DEF.menu = () => [R(8.5, 10, 31, 6.5, 3.2, CREAM), R(8.5, 21, 31, 6.5, 3.2, CREAM), R(8.5, 32, 31, 6.5, 3.2, CREAM)];
  DEF.settings = () => [P(gear(24, 24, 19, 14, 8), "#d6dce4"), C(24, 24, 9.5, "#9aa4b1"), C(24, 24, 4.6, "#5a6270"), P(arc(24, 24, 15.5, 200, 250), "none", { stroke: "#fff", w: 2.2, rim: false })];
  DEF.restart = () => [
    P(arc(24, 25, 13.5, -60, 215), "none", { w: 9.4, cap: "round" }),
    P("M31.5 5.5L41 15.5L28 18.5Z", CREAM),
    P(arc(24, 25, 13.5, -60, 215), "none", { w: 5.6, stroke: CREAM, rim: false, cap: "round" }),
  ];
  DEF.map = () => [
    P("M5 12L17 7.5L31 12L43 7.5L43 36.5L31 41L17 36.5L5 41Z", "#f6e2b0"),
    P("M17 7.5L31 12L31 41L17 36.5Z", "#e6c88c", NO),
    P("M17 7.5L17 36.5M31 12L31 41", "none", { rim: false, w: 1.3, o: 0.5 }),
    P("M9 34Q14 27 20 29Q26 31 29 23", "none", { stroke: COL.red, w: 2.4, dash: "3 3", rim: false }),
    P("M32.5 15.5L38.5 21.5M38.5 15.5L32.5 21.5", "none", { stroke: COL.red, w: 3, rim: false }),
    P("M5 12L17 7.5L31 12L43 7.5L43 36.5L31 41L17 36.5L5 41Z", "none", { rim: false }),
  ];
  DEF.back = () => [P("M5 24L20.5 9.5Q22 8.2 22 10.4L22 17.5L40 17.5Q42.5 17.5 42.5 20L42.5 28Q42.5 30.5 40 30.5L22 30.5L22 37.6Q22 39.8 20.5 38.5Z", CREAM)];
  DEF.close = () => TS("M13.5 13.5L34.5 34.5M34.5 13.5L13.5 34.5", CREAM, 7);
  DEF.lock = () => [...TS("M16 23V16.5A8 8 0 0 1 32 16.5V23", "#c3cad3", 4.6), R(9.5, 21, 29, 22, 5, COL.gold), P("M12 24H36", "none", { stroke: COL.goldLight, w: 2, rim: false }), C(24, 30, 3.2, INK, NO), R(22.7, 31, 2.6, 6.5, 1.3, INK, NO)];
  DEF.check = () => TS("M9.5 25L20 35.5L39 12.5", "#6cd24a", 7.5);
  DEF.plus = () => [...TS("M24 10V38M10 24H38", "#6cd24a", 7.5)];
  DEF.minus = () => [...TS("M11 24H37", "#ff7a5e", 7.5)];
  DEF.crown = () => [...crownShapes(), P(sparkle(40, 7, 6.5), "#fff")];
  DEF.star = () => [P(star(24, 25.5, 20, 9, 5), COL.gold), P(star(24, 25.5, 12, 5.4, 5), "#ffe27a", NO), P("M12 18.5L20 18L24 8Z", "#fff", hi(0.55))];
  DEF.starEmpty = () => [P(star(24, 25.5, 20, 9, 5), "#c9b89a"), P(star(24, 25.5, 12, 5.4, 5), "#b3a17f", NO)];
  DEF.upgrade = () => [
    P("M24 4.5L41 22.5L30.5 22.5L30.5 41Q30.5 43.5 28 43.5L20 43.5Q17.5 43.5 17.5 41L17.5 22.5L7 22.5Z", "#6cd24a"),
    P("M24 9.5L34 20L28 20L28 40L24 40Z", "#fff", hi(0.3)),
    P(sparkle(40, 36, 6.5), "#fff"),
  ];
  // Vendre : étiquette de prix frappée d'une pièce, avec sa ficelle.
  DEF.sell = () => [
    P("M13.5 21Q9 12 13 7Q17 3 21 7", "none", { w: 2.2, stroke: "#8a5a2c", cap: "round" }),
    place(
      [
        P("M3.5 24L14 12.5L41.5 12.5Q44.5 12.5 44.5 15.5L44.5 32.5Q44.5 35.5 41.5 35.5L14 35.5Z", "#f5b85e"),
        P("M14 12.5L41.5 12.5Q44.5 12.5 44.5 15.5L44.5 19L12 19Z", "#fff", hi(0.3)),
        C(12.5, 24, 2.8, "#8a5a2c"),
        C(31, 24, 8.2, COL.gold, { w: 2 }),
        P(star(31, 24.3, 4.4, 1.9, 5), COL.goldDark, NO),
      ],
      25,
      27,
      0.95,
      -38,
    ),
  ];
  DEF.book = () => [
    R(7, 6, 32, 38, 4, "#b5482a"),
    R(34, 8.5, 7.5, 33, 2.5, "#fff6df"),
    P("M35.5 13H41M35.5 19H41M35.5 25H41M35.5 31H41M35.5 37H41", "none", { rim: false, w: 1.1, o: 0.3 }),
    R(7, 6, 32, 38, 4, "none", { rim: false }),
    R(11, 10, 20, 14, 3, "#fff3cf", { w: 1.6, rim: false }),
    place(gemShapes(GEMS[1]), 21, 17, 0.28),
    P("M7 10Q7 6 11 6L15 6L7 14Z", COL.gold, { rim: false, w: 1.4 }),
    P("M7 40Q7 44 11 44L15 44L7 36Z", COL.gold, { rim: false, w: 1.4 }),
    R(12, 30, 22, 3, 1.5, "#7c2a16", NO),
  ];
  DEF.skills = () => [
    R(21, 26, 6, 18, 2, COL.woodDark),
    P("M21 34Q14 32 12 26M27 32Q33 31 36 25", "none", { w: 4.2, cap: "round" }),
    P("M21 34Q14 32 12 26M27 32Q33 31 36 25", "none", { w: 1.8, stroke: COL.woodDark, rim: false, cap: "round" }),
    blob([C(24, 17, 12), C(13.5, 21, 8), C(34.5, 21, 8), C(24, 8.5, 7)], "#58b04a"),
    C(13, 22, 4.6, "#a8743e"),
    C(35, 22, 4.6, COL.blue),
    C(24, 10.5, 4.6, COL.orange),
    E(20, 14.5, 3, 1.8, "#fff", hi(0.35)),
  ];
  // Cor de chasse (appeler la vague) : tube qui s'évase jusqu'au pavillon, cordon rouge.
  DEF.horn = () => [
    P("M11 38.5Q22 46 36.5 30", "none", { w: 2.4, stroke: COL.red, cap: "round" }),
    P("M7 32.5Q15 32 22 25Q28.5 18.5 32.5 5.5L43.5 22.5Q37.5 24.5 32.5 29Q22 39 7 38Z", COL.gold),
    P("M9 34Q17 33.5 23.5 27Q29 21.5 32 12", "none", { stroke: COL.goldLight, w: 2.4, rim: false }),
    P("M17 31.5L20 36.5M24 25.5L28 30", "none", { stroke: COL.goldEdge, w: 2.2, rim: false }),
    E(38, 14, 3.6, 9.6, COL.goldDark, { transform: "rotate(-33 38 14)" }),
    E(38.4, 13.6, 1.8, 6.4, "#6b3a0a", { rim: false, line: false, transform: "rotate(-33 38.4 13.6)" }),
    R(3, 31, 6, 8.5, 2, "#b87a18"),
  ];
  DEF.boss = () => [...crownShapes("#d8412f", false), C(24, 26, 5.5, "#fffaf0", { rim: false, w: 1.8 }), C(22, 25.5, 1.3, INK, NO), C(26, 25.5, 1.3, INK, NO), P("M22 29H26", "none", { rim: false, w: 1.3 })];
  DEF.champion = () => [
    P("M13 26L7 44L14 40.5L18 45L22 30Z", COL.red),
    P("M35 26L41 44L34 40.5L30 45L26 30Z", COL.red),
    C(24, 20, 15, COL.gold),
    C(24, 20, 10.5, "#ffe27a", { rim: false, w: 1.6 }),
    P(star(24, 20.5, 7.5, 3.3, 5), COL.goldDark, NO),
  ];
  DEF.entrance = () => [
    R(21, 12, 6, 32, 2, COL.woodDark),
    P("M6 8L32 8L41.5 15L32 22L6 22Q4 22 4 20L4 10Q4 8 6 8Z", COL.wood),
    P("M9 13H28M9 17H24", "none", { rim: false, w: 1.6, o: 0.45 }),
    E(24, 44, 9, 2.4, INK, hi(0.22)),
  ];
  DEF.question = () => [C(24, 24, 18, "#f6e2b0"), P("M17.5 18.5Q17.5 11 24.5 11Q31.5 11 31.5 17.5Q31.5 22 27 24Q24.5 25.5 24.5 29", "none", { w: 4.6, rim: false }), C(24.5, 35.5, 2.9, INK, NO)];
  DEF.info = () => [C(24, 24, 18, COL.blue), C(24, 14.5, 3.2, CREAM, { rim: false, line: false }), R(21, 20.5, 6, 16, 2.5, CREAM, { rim: false, line: false })];
  DEF.warning = () => [P("M24 5L44.5 40.5Q45.5 43 43 43L5 43Q2.5 43 3.5 40.5Z", "#ffcf33"), R(21.5, 16, 5, 15, 2.5, INK, NO), C(24, 36.5, 2.8, INK, NO)];
  DEF.hand = () => [
    P("M18 26L18 8.5Q18 5 21.5 5Q25 5 25 8.5L25 21L25 18.5Q25 15.5 28 15.5Q31 15.5 31 18.5L31 21Q31 18.5 34 18.5Q37 18.5 37 21.5L37 23.5Q37 21.5 39.5 21.5Q42.5 21.5 42.5 24.5L42.5 32Q42.5 44 30 44L26 44Q20 44 16.5 38L10 29Q8.5 26 11 24.8Q13.5 23.5 15.5 26Z", "#fffaf0"),
    P("M25 21V27M31 21V27M37 23.5V28", "none", { rim: false, w: 1.8 }),
  ];
  DEF.quality = () => [
    R(5, 8, 38, 30, 4, "#8fd3ff"),
    P("M5 32L16 20L25 29L31 23L43 34L43 34Q43 38 39 38L9 38Q5 38 5 34Z", "#5cb85c", { rim: false }),
    C(33, 16, 4.2, "#ffd83a", { rim: false, w: 1.8 }),
    R(5, 8, 38, 30, 4, "none", { rim: false }),
    P(sparkle(41, 41, 6), "#fff"),
  ];
  DEF.trophy = () => [
    P("M13 9L35 9L34 21Q33 30 24 31Q15 30 14 21Z", COL.gold),
    P("M13 12Q5 12 6.5 19Q8 25 15 25M35 12Q43 12 41.5 19Q40 25 33 25", "none", { w: 3.2 }),
    R(20.5, 30, 7, 6, 1, COL.goldDark),
    R(14, 36, 20, 7, 2.5, COL.woodDark),
    P("M17 12L21 12L19.5 24Q17.5 22 17 12Z", "#fff", hi(0.45)),
  ];
  DEF.eye = () => [P("M4 24Q24 5 44 24Q24 43 4 24Z", "#fffaf0"), C(24, 24, 8.5, COL.blue), C(24, 24, 4, INK, NO), C(21.3, 21.3, 1.8, "#fff", NO)];
  DEF.home = () => [P("M6 23L24 7L42 23L37.5 23L37.5 41L10.5 41L10.5 23Z", "#f6e2b0"), P("M4 24L24 6L44 24", "none", { w: 5, stroke: COL.red, cap: "round" }), R(20, 29, 8, 12, 2, COL.woodDark)];
  DEF.enemy = () => [C(24, 18, 10, "#c9ced6"), P("M7 44Q7 30 24 30Q41 30 41 44Z", "#c9ced6"), C(24, 18, 10, "none", { rim: false })];
  DEF.unknown = () => [C(24, 18, 10, "#8a8f99"), P("M7 44Q7 30 24 30Q41 30 41 44Z", "#8a8f99"), P("M20.5 15Q20.5 11 24 11Q27.5 11 27.5 14.5Q27.5 17 24.5 18.5L24 21", "none", { stroke: "#fff", w: 2.6, rim: false }), C(24, 25, 1.6, "#fff", NO)];
  DEF.sword = () => [
    place(
      [P("M20.5 30L20.5 9L24 3L27.5 9L27.5 30Z", COL.steel), P("M24 6.5L24 29", "none", { stroke: COL.steelDark, w: 1.8, rim: false }), R(13.5, 28.5, 21, 5.5, 2.7, COL.gold), R(21.3, 33.5, 5.4, 8.5, 2, COL.woodDark), C(24, 43.5, 3.2, COL.gold)],
      24,
      24,
      1,
      45,
    ),
  ];

  // Caractéristiques des tours
  DEF.damage = DEF.sword;
  DEF.range = () => [
    C(24, 24, 18.5, "#d4f3bd"),
    C(24, 24, 18.5, "none", { rim: false, dash: "4.6 3.4", stroke: COL.greenDark }),
    C(24, 24, 11, "none", { rim: false, w: 1.6, stroke: "#8fcf6b" }),
    ...TS("M24 24L36 24", "#3f9b36", 3.2),
    P("M35 18.5L43 24L35 29.5Z", "#3f9b36"),
    C(24, 24, 4.2, "#3f9b36"),
  ];
  DEF.rate = () => [
    P("M4 14H16M8 24H20M4 34H16", "none", { w: 3.2, cap: "round" }),
    ...[14, 24, 34].map((y, k) => [C(29 + k * 4 - 4, y, 6.4, "#8a5a32"), C(27 + k * 4 - 4, y - 2, 2, "#fff", hi(0.5))]),
  ];
  DEF.crit = () => [P(star(24, 24, 21, 11, 8, -90), COL.red), P(star(24, 24, 14, 8, 8, -67.5), "#ffd23a", NO), R(21.8, 13, 4.4, 13, 2.2, INK, NO), C(24, 31.5, 2.6, INK, NO)];
  DEF.splash = () => [
    C(24, 24, 19, "#ffe7c2", { o: 0.95 }),
    C(24, 24, 19, "none", { rim: false, dash: "5 3.5", stroke: "#e0661f", w: 2.4 }),
    P(star(24, 24, 12, 6.5, 8, -90), COL.orange),
    C(24, 24, 5, "#ffe066", NO),
  ];
  DEF.pierce = () => [
    P("M24 6L37 11L37 22Q37 33 24 41Q11 33 11 22L11 11Z", "#9aa7b8"),
    P("M24 9.5L33.5 13L33.5 22Q33.5 30 24 36.5Z", "#c3cdd9", NO),
    ...TS("M5 39L37 13", COL.woodDark, 3.4),
    P("M34 9L44.5 4L40 15Z", COL.steel),
    P("M5.5 38L3 31.5M5.5 38L12 40", "none", { w: 3, stroke: COL.red, rim: false }),
  ];

  // Effets (sur les ennemis et dans les fiches)
  DEF.slow = () => [
    P("M4.5 39Q4.5 33.5 10.5 33.5L29.5 33.5Q33.5 30.5 35.5 26Q36.5 21.5 39.5 21.5Q43 21.5 43 25.5Q43 30 40 32.5L38.5 39Z", "#a6d06a"),
    C(21.5, 24.5, 11.5, "#eda24c"),
    P("M21.5 24.5m-6.5 0a6.5 6.5 0 1 1 6.5 6.5a4 4 0 1 1 -3.5 -4", "none", { stroke: "#9c5a1e", w: 2.4, rim: false }),
    P("M38.5 22L36.5 13.5M41.5 22.5L43.5 14.5", "none", { w: 2 }),
    C(36.3, 13, 2.2, INK, NO),
    C(43.7, 14, 2.2, INK, NO),
    C(18, 18.5, 2.4, "#fff", hi(0.5)),
  ];
  DEF.freeze = () => snowflakeShapes();
  DEF.fear = () => [
    P("M10.5 42L10.5 22A13.5 13.5 0 0 1 37.5 22L37.5 42L33 37.5L28.5 42L24 37.5L19.5 42L15 37.5Z", "#f2f5ff"),
    P("M31 11.5Q37.5 15 37.5 22L37.5 42L33 37.5Q35 26 31 11.5Z", "#c5d0ec", NO),
    E(18.8, 21.5, 2.8, 4, INK, NO),
    E(29.2, 21.5, 2.8, 4, INK, NO),
    E(24, 31, 3.2, 4.2, INK, NO),
  ];
  DEF.burn = () => flameShapes();
  DEF.radiance = () => [
    P("M24 2.5V8M24 40V45.5M2.5 24H8M40 24H45.5M8.8 8.8L12.6 12.6M35.4 35.4L39.2 39.2M39.2 8.8L35.4 12.6M12.6 35.4L8.8 39.2", "none", { w: 4.2, stroke: "#6fd0ff", cap: "round" }),
    C(24, 24, 15, "#bfeeff", { rim: false, line: false, o: 0.8 }),
    P("M7 24Q24 8 41 24Q24 40 7 24Z", "#fffaf0"),
    C(24, 24, 7.5, "#2f8ee0"),
    C(24, 24, 3.5, INK, NO),
    C(21.6, 21.6, 1.7, "#fff", NO),
  ];
  DEF.stun = () => [
    E(24, 27, 18, 7.5, "none", { w: 2.6, stroke: "#ffb21f", rim: false, dash: "5 3" }),
    P(star(11, 25, 7.5, 3.3, 5), "#ffd83a"),
    P(star(27, 17.5, 8.5, 3.8, 5), "#ffd83a"),
    P(star(36, 33, 6.5, 2.9, 5), "#ffd83a"),
  ];
  // Désarmement : épée brisée net, les deux morceaux écartés, éclats.
  DEF.disarm = () => [
    place(
      [
        G("translate(3 -5) rotate(18 24 19)", [P("M19.5 19L19.5 8.5L24 2L28.5 8.5L28.5 17.5L26 20L23.5 17L21.5 19.5Z", COL.steel), P("M24 5.5L24 17", "none", { stroke: COL.steelDark, w: 1.8, rim: false })]),
        G("rotate(-8 24 24)", [P("M19.5 31L19.5 24.5L21.8 22L24 24.5L26.5 21.5L28.5 23.5L28.5 31Z", COL.steel), R(12.5, 29.5, 23, 6, 3, COL.gold), R(21, 35, 6, 8.5, 2, COL.woodDark), C(24, 44, 3.4, COL.gold)]),
        P("M16 17L19.5 19.5M31.5 15.5L28.5 19M14.5 22.5H18.5", "none", { w: 2.2, stroke: "#ffb21f", rim: false, cap: "round" }),
      ],
      24,
      25,
      0.9,
      40,
    ),
  ];
  DEF.manaSteal = () => [
    ...dropShapes("#6a5cff", "#cfc9ff"),
    ...TS("M33 38Q43 34 41 20", "#c07bff", 3.6),
    P("M35.5 20.5L41 11.5L46 21Z", "#c07bff"),
  ];
  DEF.shield = () => [
    P("M24 4.5L40.5 10.5L40.5 23Q40.5 36 24 44Q7.5 36 7.5 23L7.5 10.5Z", "#7f93b0"),
    P("M24 9L36 13.5L36 23Q36 32.5 24 39Z", "#aebed3", NO),
    P("M24 4.5L40.5 10.5L40.5 23Q40.5 36 24 44Q7.5 36 7.5 23L7.5 10.5Z", "none", { rim: false }),
    C(24, 23, 4.2, COL.gold),
  ];
  DEF.barrier = () => [
    C(24, 23, 18.5, "#c8f7dc"),
    C(24, 23, 18.5, "#8fe0b4", { rim: false, line: false, o: 0.35 }),
    P(arc(24, 23, 14.5, 200, 265), "none", { stroke: "#fff", w: 3.2, rim: false }),
    C(15.5, 15.5, 1.8, "#fff", NO),
    P("M31 40Q35 33 42 34Q39 41 31 40Z", "#58b04a", { rim: false }),
    P("M31 40Q29 33 22.5 32.5Q24.5 40 31 40Z", "#6cc45a", { rim: false }),
    C(31, 40, 2.2, "#fffaf0", { rim: false, w: 1.4 }),
    C(35.5, 42, 1.8, "#fffaf0", { rim: false, w: 1.4 }),
  ];
  DEF.heal = () => [
    P("M24 42.5Q5.5 30.5 5.5 18A9.5 9.5 0 0 1 24 13.5A9.5 9.5 0 0 1 42.5 18Q42.5 30.5 24 42.5Z", "#ff5a6e"),
    P("M12 15Q16 12 20 15", "none", { stroke: "#ffc2ca", w: 2.4, rim: false }),
    P("M21 16H27V22H33V28H27V34H21V28H15V22H21Z", CREAM, { rim: false, w: 1.8 }),
  ];
  DEF.smoke = () => [
    ...blob([C(15, 29, 9.5), C(25.5, 21, 11.5), C(34.5, 29, 8.5), R(9, 28, 32, 11, 5.5)], "#b9c0cb"),
    C(22, 18, 3.4, "#fff", hi(0.5)),
    P("M13 36Q20 38 27 36", "none", { stroke: "#8e96a3", w: 2, rim: false }),
  ];
  // Esquive : la silhouette fait un pas de côté (images fantômes), le projectile passe à côté.
  DEF.evade = () => [
    P("M4 30.5H13M7 37.5H15", "none", { w: 2.4, cap: "round" }),
    C(24, 34, 5, "#8a5a32"),
    C(22.6, 32.6, 1.5, "#fff", hi(0.55)),
    C(15, 11, 5, "#9fd3ff", { rim: false, line: false, o: 0.45 }),
    R(10, 16.5, 10, 17, 5, "#9fd3ff", { rim: false, line: false, o: 0.45 }),
    C(35, 10, 5.5, "#3f9be8"),
    R(29.5, 16, 11, 18, 5.5, "#3f9be8"),
    P("M29.5 23Q24 21 21 26M40.5 23Q44 25 44 30", "none", { w: 2.8, cap: "round" }),
    P("M31 34L28 43M39 34L42 43", "none", { w: 3.2, cap: "round" }),
    P("M26 8Q24 15 25.5 22", "none", { w: 2, stroke: "#cfe9ff", rim: false, cap: "round" }),
  ];
  DEF.haste = () => [
    P("M26 12Q36 5.5 45 7.5Q41 12 34.5 13Q41 14 43 17.5Q36.5 19.5 28 18.5Z", "#fffaf0"),
    P("M13 7L26 7L26 27Q34 27.5 38.5 31.5Q42 35 41 40L10 40Q8 40 8 38L8 31.5Q13 30 13 24Z", "#c0562e"),
    R(8, 37.5, 34, 5, 2.5, "#5a3a20"),
    P("M13 13H26", "none", { rim: false, w: 1.6, o: 0.5 }),
    P("M2 22H7M3 29H8", "none", { w: 2.6, cap: "round" }),
  ];
  DEF.immune = () => [
    P("M24 4.5L40.5 10.5L40.5 23Q40.5 36 24 44Q7.5 36 7.5 23L7.5 10.5Z", COL.gold),
    P("M24 9L36 13.5L36 23Q36 32.5 24 39Q12 32.5 12 23L12 13.5Z", "#ffe27a", { rim: false, w: 1.6 }),
    P(star(24, 24, 8.5, 3.8, 5), CREAM, { rim: false, w: 1.8 }),
  ];
  DEF.swim = () => [
    P("M11.5 29.5Q11.5 22 21 21.5L25.5 21.5Q23.5 14 29.5 11.5Q36.5 10 38 16.5L43.5 17.5L38.5 21Q37.5 24 34.5 26Q38.5 27 38.5 30Q36 36.5 24 36.5Q11.5 36.5 11.5 29.5Z", "#ffd23a"),
    P("M38 16.5L44 17.5L38.5 21Z", COL.orange, { rim: false }),
    C(32.5, 16.5, 1.7, INK, NO),
    P("M15 27Q20 31 27 28", "none", { stroke: "#e8a40c", w: 2.2, rim: false }),
    P("M3 35Q8.5 31 14 35T25 35T36 35T45 35L45 44L3 44Z", COL.blue),
    P("M6 39Q10 37 13 39M22 40Q26 38 29 40", "none", { stroke: "#cfe9ff", w: 1.8, rim: false }),
  ];
  DEF.lasso = () => [
    ...TS("M20 34Q6 32 7 21Q8 10 22 9.5Q36 9.5 36.5 19Q37 28 23 30Q17 31 18 36Q20 42 33 44", "#d9a55a", 3.6),
    P("M13 18Q16 13 22 13", "none", { stroke: "#f2cf94", w: 1.6, rim: false }),
    C(19.5, 32.5, 3, "#b98040"),
  ];

  // Terrains
  const block = (top, side, h) => [R(4.5, 13 + (h || 0), 39, 30 - (h || 0), 7, side), R(4.5, 7, 39, 27, 7, top)];
  DEF.grass = () => [
    ...block("#6cc24a", "#8a5a2c"),
    P("M11 25.5L13 19.5L15 25.5M17 26L18.5 21.5L20 26M28 19L30 13L32 19M33.5 19.5L35 15L36.5 19.5", "none", { stroke: "#2f7d2c", w: 2, rim: false }),
    C(24, 15, 2.2, "#fff", { rim: false, w: 1.2 }),
    C(21.5, 26.5, 2, "#ffd83a", { rim: false, w: 1.2 }),
    C(36, 27, 1.8, "#fff", { rim: false, w: 1.2 }),
  ];
  DEF.water = () => [
    ...block("#3f9be8", "#2266b8"),
    P("M10 17Q13.5 14 17 17T24 17M24 25Q27.5 22 31 25T38 25M12 29Q15 27 18 29", "none", { stroke: "#d8f1ff", w: 2.2, rim: false }),
  ];
  DEF.rock = () => [
    ...block("#a3a8b3", "#6b707a"),
    P("M11 13L16 19L14 26M16 19L22 21M29 11L32 17L38.5 19M32 17L30 23", "none", { stroke: "#ff8a2e", w: 2.2, rim: false }),
    P("M11 13L16 19L14 26M16 19L22 21M29 11L32 17L38.5 19M32 17L30 23", "none", { stroke: "#ffe066", w: 0.9, rim: false }),
  ];
  DEF.high = () => [
    R(4.5, 17, 39, 27, 7, "#8a6a4a"),
    P("M4.5 30H43.5M14 17V43M28 17V43", "none", { rim: false, w: 1.3, o: 0.35 }),
    R(4.5, 5, 39, 21, 7, "#7fcf52"),
    P("M24 9L30 15.5L26.5 15.5L26.5 21L21.5 21L21.5 15.5L18 15.5Z", CREAM, { rim: false, w: 1.8 }),
  ];
  DEF.menhir = () => [
    E(24, 41.5, 15, 4.5, "#6cc24a"),
    C(24, 24, 15, "#8fe6ff", { rim: false, line: false, o: 0.35 }),
    P("M16.5 42L14.5 19.5Q15.5 5 25 4.5Q33.5 5 33.5 18L32 42Z", COL.stone),
    P("M28 6Q33.5 8 33.5 18L32 42L27.5 42Q30 25 28 6Z", COL.stoneDark, NO),
    P("M21 14Q24 11 26.5 14Q27.5 18 23.5 18Q21.5 17 22.5 15.5M20 24L26 24M23 21V32M19.5 36L26.5 36", "none", { stroke: "#5fd6ff", w: 2.2, rim: false }),
  ];
  DEF.forest = () => [
    R(30.5, 30, 4, 12, 1.5, COL.woodDark),
    P("M32.5 5L43 22L37.5 22L44.5 33L20.5 33L27.5 22L22 22Z", "#2f7d44"),
    R(13, 30, 5, 12, 1.5, COL.woodDark),
    ...blob([C(15.5, 21, 10), C(9.5, 26, 6.5), C(21.5, 26.5, 6.5)], "#4fae4a"),
    C(12, 18, 2.8, "#fff", hi(0.3)),
    E(24, 43, 18, 2.5, INK, hi(0.2)),
  ];
  DEF.road = () => [...block("#d8b77a", "#9c7a45"), P("M9 16Q20 22 39 18M9 26Q22 30 39 27", "none", { stroke: "#b8935a", w: 2, rim: false })];

  // Surprises de la carte (frise des vagues, annonces, encyclopédie)
  /** Flèche épaisse (verticale) : de y0 vers y1, pointe comprise. */
  const vArrow = (x, y0, y1, col) => {
    const d = y1 > y0 ? 1 : -1;
    return [...TS(`M${x} ${y0}V${y1 - d * 4}`, col, 3.4), P(`M${x - 5.5} ${y1 - d * 5.5}L${x} ${y1 + d * 1.5}L${x + 5.5} ${y1 - d * 5.5}Z`, col)];
  };
  // Marée basse : l'eau descend (flèche vers le bas) et découvre l'estran, du sable où l'on marche.
  DEF.tideLow = () => [
    R(4, 14, 40, 30, 7, "#f2d48a"),
    P("M9 31Q15 29 21 31M27 38Q33 36 39 38M10 40Q13 39 16 40", "none", { stroke: "#c9a35a", w: 2, rim: false, cap: "round" }),
    E(15, 35, 2, 2.8, "#8a5a32", NO),
    E(20, 30.5, 2, 2.8, "#8a5a32", NO),
    E(26, 34.5, 2, 2.8, "#8a5a32", NO),
    E(31, 29.5, 2, 2.8, "#8a5a32", NO),
    P("M34 34Q38 28 42 34Z", "#ff9a86", { w: 1.6, rim: false }),
    P("M4 10Q4 4 10 4L38 4Q44 4 44 10L44 17Q39 20.5 34 17.5Q29 14.5 24 17.5Q19 20.5 14 17.5Q9 14.5 4 17.5Z", COL.blue),
    P("M8 9.5Q12 7.5 16 9.5", "none", { stroke: "#cfe9ff", w: 2.2, rim: false, cap: "round" }),
    ...vArrow(36, 5.5, 21, CREAM),
  ];
  // Marée haute : l'eau monte (flèche vers le haut) et recouvre l'estran.
  DEF.tideHigh = () => [
    R(4, 34, 40, 10, 5, "#f2d48a"),
    P("M4 14Q10 8 16 14T28 14T40 14Q44 12 44 16L44 36Q39 39.5 34 36.5Q29 33.5 24 36.5Q19 39.5 14 36.5Q9 33.5 4 36.5Z", COL.blue),
    P("M4 14Q10 8 16 14T28 14T40 14", "none", { stroke: "#d8f1ff", w: 2.6, rim: false, cap: "round" }),
    P("M9 25Q13 23 17 25M8 31Q11 29.5 14 31", "none", { stroke: "#9fd3ff", w: 2, rim: false, cap: "round" }),
    ...vArrow(33, 34, 17, CREAM),
  ];
  // Barrière qui cède : poteaux, planches « route barrée » rayées rouge et blanc, celle du bas cassée.
  const stripes = (x, y, w, hh) => {
    let d = "";
    for (let k = x + 6.5; k + 4.5 <= x + w - 1.5; k += 8.5) d += `M${f1(k)} ${y}L${f1(k + 4.5)} ${y}L${f1(k + 4.5 - hh * 0.6)} ${f1(y + hh)}L${f1(k - hh * 0.6)} ${f1(y + hh)}Z`;
    return P(d, COL.red, NO);
  };
  DEF.gate = () => [
    R(7, 8, 6, 36, 2, COL.woodDark),
    R(35, 8, 6, 36, 2, COL.woodDark),
    R(3, 11, 42, 9.5, 3, CREAM),
    stripes(3, 11, 42, 9.5),
    R(3, 11, 42, 9.5, 3, "none", { rim: false }),
    G("rotate(-15 22 29)", [R(2, 25, 20, 8, 2.5, CREAM), stripes(2, 25, 20, 8), R(2, 25, 20, 8, 2.5, "none", { rim: false })]),
    G("rotate(17 26 29)", [R(26, 25, 20, 8, 2.5, CREAM), stripes(26, 25, 20, 8), R(26, 25, 20, 8, 2.5, "none", { rim: false })]),
    P("M22.5 23.5L24 18.5M26 24.5L30 21M21.5 34.5L19 39", "none", { w: 2.4, stroke: "#ffb21f", rim: false, cap: "round" }),
  ];
  // Passage secret : une haie s'ouvre sur un trou sombre, une flèche s'y faufile.
  DEF.secret = () => [
    ...blob([C(12, 27, 10), C(24, 17, 13), C(36, 27, 10), R(3, 26, 42, 17, 7)], "#3f9a4a"),
    C(17, 15, 3, "#6cc24a", hi(0.7)),
    C(33, 21, 2.4, "#6cc24a", hi(0.7)),
    C(8, 33, 2.2, "#6cc24a", hi(0.6)),
    P("M15 43L15 33Q15 24 24 24Q33 24 33 33L33 43Z", "#2b1a10"),
    ...TS("M18.5 36H27", "#ffd23a", 2.8),
    P("M25 31.5L31 36L25 40.5Z", "#ffd23a"),
    P(sparkle(41, 8, 6), "#fff"),
  ];
  // Vol (montgolfière) : enveloppe rayée, cordes, nacelle d'osier.
  DEF.fly = () => [
    P("M18.5 31L17.5 35.5M29.5 31L30.5 35.5", "none", { w: 1.8, rim: false }),
    R(16.5, 34.5, 15, 9.5, 2.5, COL.wood),
    P("M16.5 38.5H31.5", "none", { w: 1.4, rim: false, o: 0.5 }),
    P("M24 3Q41 3 41 17Q41 26 30.5 31.5L17.5 31.5Q7 26 7 17Q7 3 24 3Z", COL.red),
    P("M24 3Q31.5 6 31.5 17Q31.5 26.5 28 31.5L20 31.5Q16.5 26.5 16.5 17Q16.5 6 24 3Z", "#ffd23a", NO),
    P("M24 3Q41 3 41 17Q41 26 30.5 31.5L17.5 31.5Q7 26 7 17Q7 3 24 3Z", "none", { rim: false }),
    P("M7.5 17H40.5", "none", { rim: false, w: 1.3, o: 0.35 }),
    E(13.5, 12, 2.6, 4.6, "#fff", hi(0.5)),
  ];
  // Charges (cygne) : boules d'eau en réserve, la dernière se remplit encore.
  const orb = (x, y, r, full) => [
    C(x, y, r, full ? COL.blue : "#e2f3ff"),
    full ? [] : P(`M${x - r} ${y}A${r} ${r} 0 0 0 ${x + r} ${y}Z`, COL.blue, NO),
    C(x - r * 0.35, y - r * 0.38, r * 0.3, "#fff", hi(0.75)),
    C(x, y, r, "none", { rim: false }),
  ];
  DEF.charges = () => [P("M5 41Q24 47 43 41", "none", { stroke: "#9fd3ff", w: 2.6, rim: false, cap: "round" }), orb(11, 30, 8, true), orb(24, 18, 8.5, true), orb(37, 30, 8, false)];
  // Jet de feu continu : flamme en cône qui s'élargit vers la cible.
  DEF.beam = () => [
    P("M3 24Q11 19.5 21 17Q33 13 40 9Q47.5 15 45.5 24Q47.5 33 40 39Q33 35 21 31Q11 28.5 3 24Z", "#ff6a1f"),
    P("M8 24Q15 21.5 23 20Q33 18 39.5 15.5Q43 19.5 42 24Q43 28.5 39.5 32.5Q33 30 23 28Q15 26.5 8 24Z", "#ffb21f", NO),
    P("M14 24Q21 22.6 29 22.2Q36 22 38.5 24Q36 26 29 25.8Q21 25.4 14 24Z", "#ffe98a", NO),
    C(4, 24, 3.2, "#ffe98a", { w: 1.8 }),
  ];
  // Chaleur : thermomètre qui monte, ondes de chaleur.
  DEF.heat = () => [
    ...blob([R(16, 3.5, 12, 32, 6), C(22, 37, 8.5)], "#fffaf0"),
    R(19.5, 13, 5, 24, 2.5, COL.red, NO),
    C(22, 37, 5.5, COL.red, NO),
    C(19.6, 34.6, 1.8, "#fff", hi(0.7)),
    P("M28 11H31M28 17H31M28 23H31", "none", { w: 1.8, rim: false }),
    P("M36 7Q39 10.5 36 14Q33 17.5 36 21M42.5 13Q45.5 16.5 42.5 20Q39.5 23.5 42.5 27", "none", { stroke: "#ff8c2e", w: 2.8, rim: false, cap: "round" }),
  ];
  // Éblouissement : éclat du flash d'un appareil photo.
  DEF.dazzle = () => [
    P(star(29, 17, 16.5, 7.5, 8, -90), "#fff3a0"),
    P(star(29, 17, 9.5, 4.5, 8, -67.5), "#fff", NO),
    R(4, 27, 25, 17, 4, "#3e4452"),
    R(9, 23.5, 8, 5, 2, "#3e4452"),
    C(16.5, 35.5, 5.8, "#9fd3ff"),
    C(16.5, 35.5, 2.7, INK, NO),
    C(15, 34, 1.2, "#fff", NO),
    R(22, 29.5, 4, 3, 1, "#fff3a0", NO),
  ];
  // Tir (sanglier) : une bogue de châtaigne lancée, traits de vitesse.
  DEF.shot = () => [
    P("M3 17H14M6 25H16M3 33H13", "none", { w: 3, cap: "round" }),
    P(star(31, 25, 14.5, 10.5, 16, -90), "#6fa336"),
    C(31, 25, 10.5, "#9ccf4e", { rim: false }),
    P("M25 24Q31 15.5 37 24Q31 28 25 24Z", "#7a4420", { rim: false, w: 1.4 }),
    C(29, 20, 1.6, "#fff", hi(0.6)),
  ];
  // Cachettes (selon le décor) : moulin, vieux puits, dolmen, chapelle.
  DEF.lairMoulin = () => {
    let spokes = "";
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 4;
      spokes += `M${f1(35 - 8 * Math.cos(a))} ${f1(29 - 8 * Math.sin(a))}L${f1(35 + 8 * Math.cos(a))} ${f1(29 + 8 * Math.sin(a))}`;
    }
    return [
      C(35, 29, 11, COL.wood),
      C(35, 29, 7.5, "#a8733f", NO),
      P(spokes, "none", { stroke: COL.woodDark, w: 2, rim: false }),
      C(35, 29, 2.6, COL.woodDark, NO),
      R(4, 21, 25, 21, 2.5, "#c2b49c"),
      P("M7 27H12M18 35H25M7 38H11", "none", { stroke: "#8f8373", w: 2, rim: false, cap: "round" }),
      R(13.5, 31, 7, 11, 3, COL.woodDark),
      R(6.5, 25.5, 5, 5, 1, "#ffe7a0", { w: 1.6 }),
      P("M1.5 23L16.5 8.5L31.5 23Z", "#56627a"),
      P("M7 19H25M12 14H20", "none", { stroke: "#7a88a3", w: 1.8, rim: false }),
    ];
  };
  DEF.lairPuits = () => [
    R(8.5, 7, 4, 25, 1.5, COL.woodDark),
    R(35.5, 7, 4, 25, 1.5, COL.woodDark),
    P("M3 12L24 3L45 12L41 16L24 8.5L7 16Z", "#c0562e"),
    R(10, 15, 28, 3.4, 1.7, COL.wood),
    P("M24 18.4V23", "none", { w: 1.6, rim: false }),
    P("M20 22H28L27 28H21Z", COL.steelDark, { w: 1.8 }),
    P("M5.5 30L5.5 40Q24 47.5 42.5 40L42.5 30Z", COL.stone),
    P("M5.5 35Q24 41.5 42.5 35M15 31V37M24 32V39M33 31V37", "none", { stroke: COL.stoneDark, w: 1.5, rim: false }),
    E(24, 30, 18.5, 5.5, "#c3c7cf"),
    E(24, 30, 13.5, 3.4, "#1d2a3a", NO),
  ];
  DEF.lairDolmen = () => [
    E(24, 41.5, 21, 4.5, "#6cc24a"),
    R(8, 19, 10, 23, 3.5, COL.stone),
    R(30, 19, 10, 23, 3.5, COL.stoneDark),
    P("M13 25V37M35 25V36", "none", { stroke: "#5f646e", w: 1.6, rim: false }),
    P("M3 19Q5 9 24 8Q43 9 45 17Q45.5 22.5 39 22.5L9 23Q3 23.5 3 19Z", "#9aa0aa"),
    P("M8 15Q20 11.5 35 12.5", "none", { stroke: "#c9cdd5", w: 2.4, rim: false, cap: "round" }),
    P("M24 26Q22 30 24 34Q26 30 24 26Z", "#8fe6ff", { rim: false, w: 1.2 }),
  ];
  DEF.lairChapelle = () => [
    R(5, 22, 26, 20, 2, "#efe6d2"),
    R(13.5, 30, 9, 12, 4.5, COL.woodDark),
    P("M2 24L18 10.5L34 24Z", "#56627a"),
    R(29, 15, 13, 27, 2, "#e4d8bf"),
    R(32.5, 19.5, 6, 7, 3, "#2b2b33", { w: 1.6 }),
    C(35.5, 24, 2, "#ffd23a", NO),
    P("M27 17L35.5 6L44 17Z", "#56627a"),
    ...TS("M35.5 1.5V7.5M32.8 3.6H38.2", "#ffd23a", 2),
  ];
  // Capacités des nouveaux ennemis
  DEF.peloton = () => [
    C(12, 32, 9, "#3e4452"),
    C(12, 32, 5.5, "#cfe9ff", NO),
    C(36, 32, 9, "#3e4452"),
    C(36, 32, 5.5, "#cfe9ff", NO),
    ...TS("M12 32L19.5 19L32 19L36 32M19.5 19L24 32L32 19M24 32H12", "#e8412f", 2.8),
    ...TS("M17 15H23M30 13L33 13L32 19", "#2b1a10", 1.6),
    C(24, 32, 2.2, "#ffd23a"),
  ];
  DEF.blink = () => [
    ...blob([C(15, 29, 10), C(27, 21, 12), C(35, 31, 9), C(23, 34, 9)], "#b98cff"),
    C(23, 19, 3.6, "#fff", hi(0.55)),
    P("M19 31Q24 34 30 30", "none", { stroke: "#8a5ce0", w: 2, rim: false, cap: "round" }),
    P(sparkle(9, 11, 6.5), "#ffd23a"),
    P(sparkle(41, 9, 5), "#fff"),
    P(sparkle(43, 41, 4.5), "#ffd23a"),
  ];
  DEF.split = () => [
    R(9, 10, 3.5, 12, 1.5, "#5a5f6a"),
    R(20, 7, 17, 17, 3, "#d8412f"),
    R(23, 10, 11, 9, 2, "#cfe9ff", NO),
    R(4, 21, 36, 12, 3.5, "#d8412f"),
    P("M6 25H18", "none", { stroke: "#ff8a72", w: 2, rim: false }),
    C(32, 35, 9.5, INK),
    C(32, 35, 4.6, "#ffc93a", NO),
    C(11, 38, 6, INK),
    C(11, 38, 3, "#ffc93a", NO),
  ];
  DEF.wading = () => [
    R(17, 6, 5, 24, 2.5, "#c0562e"),
    R(26, 6, 5, 24, 2.5, "#c0562e"),
    E(24, 34, 20, 8, COL.blue),
    E(24, 32.5, 12, 3.6, "#9fd3ff", NO),
    P("M10 24Q8 19 11 15Q13 20 10 24ZM38 24Q40 19 37 15Q35 20 38 24Z", "#9fd3ff", { w: 1.8 }),
  ];

  // Sorts
  // Couper : hache de bûcheron (manche de frêne, large fer), deux copeaux qui volent.
  const axeShapes = () => [
    R(20.5, 7, 6, 38.5, 3, "#c08a4e"),
    P("M22.5 12V42", "none", { stroke: "#e2b27a", w: 1.6, rim: false }),
    R(17.5, 5, 12, 11.5, 2.5, "#7b8594"),
    P("M28.5 6.5L35.5 3.5Q45.5 0.5 46 12.5Q46.5 24.5 36 24L28.5 16Z", COL.steel),
    P("M39.5 3.5Q45.5 6.5 45.5 13Q45.5 20 39.5 23", "none", { stroke: "#fff", w: 2.2, rim: false }),
    P("M28.5 16L36 24Q33 23.5 30.5 21Z", COL.steelDark, NO),
  ];
  DEF.cut = () => [place(axeShapes(), 22, 25, 0.95, 28), P("M6 10L11 8.5L10 13Z", "#e2b27a"), P("M4 19L8.5 20L6 23.5Z", "#e2b27a")];
  DEF.frenzy = () => [C(24, 24, 19, "#ffcf6a", { rim: false, line: false, o: 0.35 }), ...boltShapes(), P("M4 16L9 18M3 25H8.5M40 32L45 34", "none", { w: 2.6, stroke: "#ff8c2e", rim: false, cap: "round" })];
  DEF.meteor = meteorShapes;

  // Gardiens (familles et branches)
  DEF.boar = () => boarHead();
  DEF.swan = () => swanHead();
  DEF.dog = () => dogHead();

  // Compétences (une icône par entrée de DATA.SKILLS)
  const S = {};
  S.goldVault = () => [
    place(coinShapes(), 17, 9.5, 0.38),
    place(coinShapes(), 29, 7, 0.38),
    P("M13 11L31 11L31 26Q31 30 35 32L40.5 34.5Q45 37 43 41.5Q41 45.5 35.5 44L22 40Q13 37 13 30Z", "#d8412f"),
    P("M13 15.5H31M13 21H31", "none", { stroke: CREAM, w: 3, rim: false }),
    P("M35.5 32.5Q40.5 34 43 38L42.5 41.5Q41 45.5 35.5 44Q34 38 35.5 32.5Z", "#8a1f16", NO),
    P("M13 11L31 11L31 26Q31 30 35 32L40.5 34.5Q45 37 43 41.5Q41 45.5 35.5 44L22 40Q13 37 13 30Z", "none", { rim: false }),
    R(11, 9, 22, 5, 2.5, "#f3e4bf"),
  ];
  S.heights = () => [place(DEF.high(), 24, 31, 0.78), place(DEF.sword(), 33, 14, 0.58)];
  S.cutStudy = () => [place(DEF.cut(), 22, 26, 0.92), P(sparkle(38, 34, 7.5), "#fff"), P(sparkle(8, 10, 5), "#ffe066")];
  S.sawmill = () => [P(gear(21, 22, 18.5, 14.5, 16), COL.steel), C(21, 22, 10, "#c9d2dc", { rim: false, w: 1.6 }), C(21, 22, 3.5, COL.woodDark), place(coinShapes(), 35, 35, 0.46)];
  S.marksman = () => [P("M11.5 42Q5.5 21 27 6.5Q19.5 21 22.5 39.5Z", "#fffaf0"), P("M13 38Q10 24 21 12", "none", { stroke: "#e4d8c0", w: 2.2, rim: false }), place(DEF.crit(), 34, 32, 0.55)];
  S.boarLord = () => [place(boarHead(), 24, 28, 0.82), place(crownShapes(), 24, 8, 0.44)];
  S.mining = () => [
    ...TS("M13 42L32 12", "#c08a4e", 4.4),
    P("M8 16Q20 2.5 42 12Q31 9.5 20 14Q14 16.5 8 16Z", "#9aa6b5"),
    P("M42 12Q31 9.5 20 14L21 11Q31 7 42 12Z", "#c3cdd9", NO),
    place(gemShapes(GEMS[0]), 34, 34, 0.46),
  ];
  S.manaStock = () => [
    C(24, 30, 13.5, "#e3eefc"),
    P("M10.8 31A13.2 13.2 0 0 0 37.2 31Q30 27 24 30Q17 33 10.8 31Z", "#6a5cff", NO),
    C(24, 30, 13.5, "none", { rim: false }),
    R(19.5, 5, 9, 12, 2, "#e3eefc"),
    R(18, 2.5, 12, 5.5, 2.2, COL.wood),
    P("M15 25Q16 20 20 18", "none", { stroke: "#fff", w: 2.4, rim: false }),
    P(sparkle(26, 35, 4.5), "#fff", NO),
  ];
  S.manaPool = () => [
    E(24, 33, 20, 10, COL.stone),
    E(24, 29.5, 15.5, 6, "#6a5cff", { rim: false }),
    E(21, 28, 6, 2, "#b3aaff", NO),
    P("M8 36Q10 40 16 41M40 36Q38 40 32 41", "none", { stroke: COL.stoneDark, w: 1.6, rim: false }),
    P(sparkle(24, 14, 7.5), "#cfc9ff"),
    P(sparkle(35, 20, 4.5), "#fff"),
  ];
  S.frenzyStudy = () => [place(bookShapes("#3f6fb5"), 24, 30, 0.86), place(boltShapes(), 24, 13, 0.5)];
  // Source vive : fontaine de pierre d'où jaillit le mana.
  // Source vive : le mana jaillit d'une fente dans les rochers et remplit la vasque.
  S.manaSpring = () => [
    E(26, 38.5, 19, 7.5, "#6a5cff"),
    E(22, 37, 8, 2.2, "#b3aaff", NO),
    P("M3.5 33L5 18.5L12.5 9L23.5 6L31.5 12.5L31 25L22.5 33Z", COL.stone),
    P("M23.5 6L31.5 12.5L31 25L22.5 33L19.5 20Z", COL.stoneDark, NO),
    P("M5 18.5L12.5 9L19.5 20L3.5 33Z", "#c3c7cf", NO),
    P("M3.5 33L5 18.5L12.5 9L23.5 6L31.5 12.5L31 25L22.5 33Z", "none", { rim: false }),
    P("M12.5 9L19.5 20L23.5 6M19.5 20L22.5 33M19.5 20L3.5 33", "none", { rim: false, w: 1.2, o: 0.35 }),
    ...TS("M28.5 17Q35.5 18 36 28Q36 34 34 38", "#8f84ff", 5),
    P("M30.5 18.3Q34 19.5 34.3 25", "none", { stroke: "#e2ddff", w: 1.6, rim: false, cap: "round" }),
    C(40, 31, 2.2, "#8f84ff"),
    C(38, 24.5, 1.7, "#8f84ff"),
    P(sparkle(40, 10, 6), "#fff"),
  ];
  S.frenzyLong = () => [place(boltShapes(), 18, 21, 0.78), place(hourglassShapes(), 34, 31, 0.5)];
  S.coldWater = () => [place(dropShapes(), 21, 22, 0.9), place(snowflakeShapes(), 34, 33, 0.52)];
  S.swanLord = () => [place(swanHead(), 25, 28, 0.82), place(crownShapes(), 18, 8, 0.4, -12)];
  S.training = () => [
    place([...blob([C(10, 12, 5), C(14, 8, 5), C(38, 40, 5), C(34, 44, 5), P("M12 10L36 38L32 42L8 14Z", "#fffaf0")], "#fffaf0")], 24, 24, 0.9, -10),
    P(sparkle(36.5, 12, 9, 0.3), "#b86cff"),
    P(sparkle(12, 36, 5.5), "#ffd84a"),
  ];
  S.hotGems = () => [place(flameShapes(), 24, 21, 0.96), place(gemShapes(GEMS[0]), 24, 32, 0.56)];
  S.meteorStudy = () => [place(bookShapes("#6b3fa0"), 24, 31, 0.86), place(meteorShapes(), 25, 13, 0.52)];
  S.returnPortal = () => [
    E(24, 25, 15, 19, "#7a3fd6"),
    P("M24 25m-9 0a9 12 0 1 1 9 12a6 8 0 1 1 -3 -8.5", "none", { stroke: "#c9a2ff", w: 2.6, rim: false }),
    E(24, 25, 15, 19, "none", { rim: false }),
    place(gemShapes(GEMS[2]), 24, 26, 0.36),
    P("M40 34Q44 22 38 12", "none", { w: 3, stroke: "#e2c9ff", rim: false, cap: "round" }),
  ];
  S.meteorMastery = () => [place(DEF.splash(), 30, 32, 0.66), place(meteorShapes(), 20, 20, 0.8)];
  S.radiance = () => [
    place(flameShapes("#ff6a1f", "#ffb21f", "#ffe98a"), 24, 13, 0.55),
    P("M5 28Q24 12 43 28Q24 44 5 28Z", "#fffaf0"),
    C(24, 28, 7.5, COL.orange),
    C(24, 28, 3.4, INK, NO),
    C(21.8, 25.8, 1.6, "#fff", NO),
  ];
  S.dogLord = () => [place(dogHead(undefined, undefined, undefined, false), 24, 28, 0.82), place(crownShapes(), 24, 8, 0.44)];

  /* ------------------------------------------------------------------ publication */
  const icons = (PTMT.icons = PTMT.icons || {});
  for (const name of Object.keys(DEF)) icons[name] = svg(DEF[name]());
  for (const id of Object.keys(S)) icons["skill_" + id] = svg(S[id]());
  icons.names = Object.keys(DEF);
  icons.skillNames = Object.keys(S);
  /** Icône par son nom (chaîne vide si inconnue). */
  icons.get = function (name) {
    const v = icons[name];
    return typeof v === "string" ? v : "";
  };
  const gemCache = new Map();
  /** Gemme d'une couleur (0..5) dans un état : "lair" (au moulin), "ground" (au sol), "carried" (portée), "lost" (perdue). */
  icons.gem = function (color, state) {
    const c = ((color | 0) % 6 + 6) % 6;
    const st = state || "lair";
    const key = c + ":" + st;
    let s = gemCache.get(key);
    if (s) return s;
    if (st === "ground") s = svg([E(24, 42.5, 14, 3.4, INK, hi(0.28)), place(gemShapes(GEMS[c]), 24, 24.5, 0.9, -16), P("M6 10L9.5 13.5M42 10L38.5 13.5M24 3V7", "none", { w: 2.4, stroke: "#fff3a0", rim: false, cap: "round" })]);
    else if (st === "carried") s = svg([P("M34 16H44M36 24H46M34 32H44", "none", { w: 2.8, stroke: COL.red, cap: "round" }), place(gemShapes(GEMS[c]), 20, 24, 0.82, 12)]);
    else if (st === "lost") s = svg([place(gemShapes(GEM_LOST), 22, 23, 0.86), C(36.5, 36.5, 8.5, COL.red), ...TS("M33 33L40 40M40 33L33 40", CREAM, 2.8)]);
    else s = svg([...gemShapes(GEMS[c]), P(sparkle(40, 9, 6), "#fff")]);
    gemCache.set(key, s);
    return s;
  };
  icons.GEM_COLORS = GEMS.map((g) => g[1]);
  /** Icône d'une compétence (identifiant de DATA.SKILLS). */
  icons.skill = (id) => icons["skill_" + id] || icons.skillPoint;
  /** Icône d'une branche ou d'une famille de tours : "boar" | "swan" | "dog". */
  icons.branch = (b) => icons[b] || "";
  const STATUS = { slow: "slow", freeze: "freeze", fear: "fear", burn: "burn", radiance: "radiance", stun: "stun", disarmed: "disarm", disarm: "disarm", haste: "haste", invisible: "smoke", smoke: "smoke", wading: "wading", dazzled: "dazzle", flying: "fly", swims: "swim" };
  /** Icône d'un effet d'état (clés de enemy.fx ou des niveaux de tour). */
  icons.status = (k) => icons[STATUS[k] || k] || "";
  const LAIRS = { moulin: "lairMoulin", puits: "lairPuits", dolmen: "lairDolmen", chapelle: "lairChapelle" };
  /** Icône d'une cachette selon son décor : "moulin" | "puits" | "dolmen" | "chapelle". */
  icons.lair = (style) => icons[LAIRS[style] || "lairMoulin"];
  // Outils partagés avec le logo (07) et les portraits des tours (08).
  icons.kit = { INK, RIM, CREAM, COL, GEMS, shape, P, C, E, R, G, place, NO, hi, TS, blob, svg, star, sparkle, gear, arc, mix, gemShapes, coinShapes, flameShapes, snowflakeShapes, boltShapes, crownShapes, dropShapes, boarHead, swanHead, dogHead };
})();
