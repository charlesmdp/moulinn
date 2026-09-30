// « Pas touche à mes trésors » — portraits des ennemis pour l'interface (PTMT.portraits).
//
//   PTMT.portraits.get("fermier", champion)    // chaîne SVG (viewBox 64 × 64, sans taille : la CSS la fixe)
//   PTMT.portraits.fermier                     // idem (ordinaire) ; PTMT.portraits.fermier_champion
//   PTMT.portraits.names.fermier               // « Agriculteur en colère »
//   PTMT.portraits.names.fermier_champion      // « Fermier primé » ; names.fermier_boss : « Le Grand Fermier »
//   PTMT.portraits.accent.fermier              // couleur dominante (pastille, bordure) ; accent.fermier_champion : or
//
// Têtes de dessin animé à plat, fidèles aux personnages 3D (mêmes couvre-chefs, couleurs et accessoires :
// fourche, quad, lasso, vache pie noir, faucille, coiffe de dentelle, casquette fluo, ballon, biniou,
// casque doré, canard colvert). Le champion porte ses dorures (liseré doré, cocarde, étoile…). Style
// « autocollant » : liseré blanc extérieur + contour sombre, lisibles de 28 à 48 px sur une pastille
// sombre comme claire. Aucun identifiant ni dégradé (plusieurs copies peuvent cohabiter dans la page).
(function () {
  "use strict";
  const PTMT = (globalThis.PTMT = globalThis.PTMT || {});

  const INK = "#2b1a14";
  const GOLD = "#ffc21a";

  // Une forme : [balise, attributs, remplissage, options] ; options : { rim: false } (pas de liseré blanc),
  // { line: false } (pas de contour sombre), { w } (épaisseur du contour), { o } (opacité), { stroke }
  // (couleur du trait à la place de l'encre).
  function el(tag, attrs, fill, opt) {
    return { tag, attrs, fill, opt: opt || {} };
  }
  const attr = (a) => Object.keys(a).map((k) => k + '="' + a[k] + '"').join(" ");
  function svg(shapes) {
    let rim = "", body = "";
    for (const s of shapes) {
      if (s.opt.rim !== false) rim += "<" + s.tag + " " + attr(s.attrs) + (s.fill === "none" ? ' fill="none"' : "") + (s.opt.rimW ? ' stroke-width="' + s.opt.rimW + '"' : "") + "/>";
      let extra = ' fill="' + s.fill + '"';
      if (s.opt.line === false) extra += ' stroke="none"';
      else {
        if (s.opt.stroke) extra += ' stroke="' + s.opt.stroke + '"';
        if (s.opt.w) extra += ' stroke-width="' + s.opt.w + '"';
      }
      if (s.opt.o) extra += ' opacity="' + s.opt.o + '"';
      body += "<" + s.tag + " " + attr(s.attrs) + extra + "/>";
    }
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" aria-hidden="true" focusable="false">' +
      '<g fill="#fff" stroke="#fff" stroke-width="6" stroke-linejoin="round" stroke-linecap="round">' + rim + "</g>" +
      '<g stroke="' + INK + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">' + body + "</g></svg>"
    );
  }

  // --- pièces communes -----------------------------------------------------------------------
  const P = (d, fill, opt) => el("path", { d }, fill, opt);
  const C = (cx, cy, r, fill, opt) => el("circle", { cx, cy, r }, fill, opt);
  const E = (cx, cy, rx, ry, fill, opt) => el("ellipse", { cx, cy, rx, ry }, fill, opt);
  const ER = (cx, cy, rx, ry, rot, fill, opt) => el("ellipse", { cx, cy, rx, ry, transform: "rotate(" + rot + " " + cx + " " + cy + ")" }, fill, opt);
  const R = (x, y, w, h, rx, fill, opt) => el("rect", { x, y, width: w, height: h, rx }, fill, opt);
  /** Trait coloré (sans liseré blanc) bordé d'encre : deux tracés superposés. */
  const cord = (d, color, w) => [P(d, "none", { rim: false, w: w + 2.2 }), P(d, "none", { rim: false, w, stroke: color })];
  /** Trait coloré seul (détail intérieur). */
  const line = (d, color, w) => P(d, "none", { rim: false, w: w || 2, stroke: color });
  /** Buste (épaules) : haut arrondi, côtés droits sous y = 57. */
  const BUST = "M9 64 L9 58 Q9 50.5 20 49.5 L44 49.5 Q55 50.5 55 58 L55 64 Z";
  function bust(fill, stripes, wide) {
    const out = [P(BUST, fill)];
    if (stripes) {
      const h = wide ? 3.4 : 2.6;
      for (const y of wide ? [53, 59.5] : [52.6, 57.6, 62.2]) out.push(R(9.6, y, 44.8, h, 0, stripes, { rim: false, line: false }));
      out.push(P(BUST, "none", { rim: false }));
    }
    return out;
  }
  function head(skin, opt) {
    opt = opt || {};
    const out = [];
    if (opt.ears) out.push(C(14.6, 36, 3.6, skin), C(49.4, 36, 3.6, skin));
    out.push(C(opt.cx || 32, opt.cy || 34, opt.r || 17.5, opt.color || skin));
    return out;
  }
  /** Yeux de dessin animé : blanc, pupille, reflet (regard légèrement de côté). */
  function eyes(y, opt) {
    opt = opt || {};
    const out = [];
    const dx = opt.dx || 6, cx = opt.cx || 32, s = opt.s || 1;
    for (const x of [cx - dx, cx + dx]) {
      out.push(E(x, y, 4.3 * s, 5.2 * s * (opt.open || 1), "#fff", { rim: false, w: 1.6 }));
      out.push(C(x + 0.8 * s, y + 0.7 * s, 2.5 * s, "#17110d", { rim: false, line: false }));
      out.push(C(x + 1.6 * s, y - 0.4 * s, 0.9 * s, "#fff", { rim: false, line: false }));
    }
    return out;
  }
  /** Sourcils : mood > 0 fâché (coins intérieurs en bas), < 0 inquiet. */
  function brows(y, mood, color, w, cx) {
    const d = mood * 2.2, c = cx || 32;
    return [
      P("M" + (c - 10.5) + " " + (y - d) + " L" + (c - 2.5) + " " + (y + d), "none", { rim: false, w: w || 2.6, stroke: color }),
      P("M" + (c + 2.5) + " " + (y + d) + " L" + (c + 10.5) + " " + (y - d), "none", { rim: false, w: w || 2.6, stroke: color }),
    ];
  }
  function nose(fill, y, cx) {
    return [E(cx || 32, y || 40, 3.4, 3, fill, { rim: false, w: 1.5 })];
  }
  function cheeks(col, r, y) {
    col = col || "#ff8f8f"; r = r || 3; y = y || 41.5;
    return [E(21, y, r, r * 0.64, col, { rim: false, line: false, o: 0.8 }), E(43, y, r, r * 0.64, col, { rim: false, line: false, o: 0.8 })];
  }
  function mustache(color, y, w) {
    y = y || 44; w = w || 1;
    const a = (x) => 32 + (x - 32) * w;
    return [P("M32 " + (y - 1.5) + " C" + a(28) + " " + (y - 3.5) + " " + a(22) + " " + (y - 3) + " " + a(20.5) + " " + (y + 1.5) + " C" + a(24) + " " + (y + 1) + " " + a(28) + " " + (y + 1.8) + " 32 " + (y + 0.2) + " C" + a(36) + " " + (y + 1.8) + " " + a(40) + " " + (y + 1) + " " + a(43.5) + " " + (y + 1.5) + " C" + a(42) + " " + (y - 3) + " " + a(36) + " " + (y - 3.5) + " 32 " + (y - 1.5) + " Z", color, { rim: false, w: 1.4 })];
  }
  const mouth = (d) => [P(d, "#4a0f12", { rim: false, w: 1.3 })];
  /** Couronne d'or (petite ou grande). */
  function crownShape(cx, y, w, h) {
    const l = cx - w / 2, r = cx + w / 2;
    return [
      P("M" + l + " " + y + " L" + (l - 1.5) + " " + (y - h) + " L" + (l + w * 0.25) + " " + (y - h * 0.45) + " L" + cx + " " + (y - h * 1.15) + " L" + (r - w * 0.25) + " " + (y - h * 0.45) + " L" + (r + 1.5) + " " + (y - h) + " L" + r + " " + y + " Q" + cx + " " + (y - 2) + " " + l + " " + y + " Z", GOLD),
      C(cx, y - h * 0.3, 1.5, "#e8243a", { rim: false, w: 1 }),
    ];
  }
  /** Casquette vue de face : calotte, panneau avant, visière. */
  function cap(color, visor, front, band) {
    const out = [P("M14.5 28 C14.5 11.5 49.5 11.5 49.5 28 Q32 24.5 14.5 28 Z", color)];
    if (front) out.push(P("M23 25.8 C23 16.5 41 16.5 41 25.8 Q32 24.6 23 25.8 Z", front, { rim: false, w: 1.3 }));
    out.push(P("M13 27.2 Q32 22 51 27.2 Q52.5 31.5 47.5 31 Q32 28 16.5 31 Q11.5 31.5 13 27.2 Z", visor));
    if (band) out.push(line("M14.4 27.6 Q32 23 49.6 27.6", band, 2.2));
    out.push(C(32, 14.2, 1.7, band || visor, { rim: false, w: 1 }));
    return out;
  }

  // --- les onze ennemis (c : champion) ---------------------------------------------------------
  const D = {};

  D.fermier = (c) => {
    const shirt = c ? "#b81a2a" : "#d8302a", ov = c ? "#2446b8" : "#2f63c0", tine = c ? GOLD : "#c8d0d8";
    return [
      // fourche brandie
      R(50.4, 11, 3.4, 53, 1.5, "#a0703a"),
      R(43.5, 11.5, 17.5, 3.8, 1.5, tine),
      R(43.9, 1.8, 2.8, 12, 1.3, tine), R(50.7, 0.8, 2.8, 13, 1.3, tine), R(57.5, 1.8, 2.8, 12, 1.3, tine),
      ...bust(shirt),
      // vichy
      R(12, 50, 3, 14, 0, "#fff", { rim: false, line: false, o: 0.55 }), R(21, 50, 3, 14, 0, "#fff", { rim: false, line: false, o: 0.55 }),
      R(40, 50, 3, 14, 0, "#fff", { rim: false, line: false, o: 0.55 }), R(49, 50, 3, 14, 0, "#fff", { rim: false, line: false, o: 0.55 }),
      R(9.5, 56, 45, 3, 0, "#fff", { rim: false, line: false, o: 0.55 }),
      P(BUST, "none", { rim: false }),
      // salopette
      P("M22 64 L22 54 L42 54 L42 64 Z", ov, { rim: false }),
      line("M22.5 54.5 L18.5 50", ov, 3.2), line("M41.5 54.5 L45.5 50", ov, 3.2),
      C(24.5, 56.5, 1.5, c ? GOLD : "#e8c45a", { rim: false, w: 1 }), C(39.5, 56.5, 1.5, c ? GOLD : "#e8c45a", { rim: false, w: 1 }),
      ...(c ? [C(37.5, 59, 4.2, "#e0262a", { rim: false, w: 1.2 }), C(37.5, 59, 2.1, GOLD, { rim: false, w: 1 })] : []),
      ...head("#f2a47e"),
      ...cheeks("#ff5e4e", 3.4),
      ...eyes(35),
      ...brows(29.4, 0.95, "#3a2412", 3.4),
      ...nose("#e88a66", 41.5),
      ...mustache("#5a3418", 44.6, 1.1),
      ...mouth("M28.2 47.6 Q32 45.8 35.8 47.6 Q35 51.5 32 51.5 Q29 51.5 28.2 47.6 Z"),
      ...cap(c ? "#c81e2a" : "#d8302a", "#a8201c", "#f4efe2", c ? GOLD : null),
    ];
  };

  D.quad = (c) => {
    const body = c ? "#d41e2a" : "#f2600c";
    return [
      // sac de toile derrière l'épaule
      P("M44 20 Q56 14 60 26 Q63 38 52 42 Q46 40 45 32 Z", "#c8a36a"),
      P("M44.5 21 L49 17", "none", { rim: false, w: 2 }),
      ...bust("#1e1e24", "#f2ead8"),
      ...(c ? [line("M22 50.5 Q32 57 42 50.5", GOLD, 2.2), C(32, 56.5, 2, GOLD, { rim: false, w: 1 })] : []),
      ...head("#1b1b20"),
      R(15.5, 27, 33, 12.5, 6.2, "#f2c4a0", { rim: false }),
      ...eyes(33.4, { open: 0.8 }),
      ...brows(27.2, 0.55, "#0e0e12", 2.8),
      ...mouth("M28.5 45 Q33 47.2 36.5 44.4"),
      // l'avant du quad : garde-boue, phares, guidon et poignées
      P("M3 64 L5.5 55 Q32 49.5 58.5 55 L61 64 Z", body),
      ...(c ? [line("M7 57.5 Q32 52.5 57 57.5", GOLD, 1.8)] : []),
      C(18, 59.2, 3.3, "#fff4b0", { rim: false, w: 1.5 }), C(46, 59.2, 3.3, "#fff4b0", { rim: false, w: 1.5 }),
      ...cord("M8 50.5 L56 50.5", "#8a9098", 2.6),
      R(3, 47.8, 9, 5.4, 2.2, "#1a1a1e"), R(52, 47.8, 9, 5.4, 2.2, "#1a1a1e"),
      C(11.5, 50.5, 3.4, "#1b1b20", { rim: false, w: 1.4 }), C(52.5, 50.5, 3.4, "#1b1b20", { rim: false, w: 1.4 }),
    ];
  };

  D.cowboy = (c) => {
    const hat = c ? "#f4efe2" : "#8a5a2b", band = c ? GOLD : "#3a2414";
    return [
      // lasso qui tournoie au-dessus
      ...cord("M2 11 C2 3.5 26 3.5 26 11 C26 17 2 17 2 11 Z", "#d8b070", 2.2),
      ...cord("M24 13 L26.5 22", "#d8b070", 1.8),
      ...bust(c ? "#c0282a" : "#6fa8dc"),
      P("M9 64 L9 58 Q9 50.5 20 49.5 L25 49.5 L23 64 Z", c ? "#2a2420" : "#b87a3a", { rim: false }),
      P("M55 64 L55 58 Q55 50.5 44 49.5 L39 49.5 L41 64 Z", c ? "#2a2420" : "#b87a3a", { rim: false }),
      ...(c ? [P("M47 55.5 L48.3 58.4 L51.4 58.6 L49 60.6 L49.8 63.6 L47 62 L44.2 63.6 L45 60.6 L42.6 58.6 L45.7 58.4 Z", GOLD, { rim: false, w: 1 })] : []),
      P("M21 50 Q32 55 43 50 L32 61 Z", c ? "#1f2a5c" : "#d8262a", { rim: false }),
      ...head("#e0a070"),
      ...eyes(35.5, { open: 0.85 }),
      ...brows(30, 0.55, "#3a2414", 3),
      ...nose("#c98052", 41.8),
      ...mustache("#3a2414", 45.4, 1.25),
      // grand chapeau à bords relevés
      P("M2.5 26.5 Q7 19.5 14 24 Q32 29.5 50 24 Q57 19.5 61.5 26.5 Q57 33.5 32 33.2 Q7 33.5 2.5 26.5 Z", hat),
      P("M16 25.5 C14.5 11 21.5 7.5 27 11.5 Q32 8.5 37 11.5 C42.5 7.5 49.5 11 48 25.5 Q32 28.5 16 25.5 Z", hat),
      line("M32 10 L32 16.5", c ? "#c8c2b0" : "#5a3a1a", 2),
      line("M16.2 22.4 Q32 25.6 47.8 22.4", band, 3),
    ];
  };

  D.vache = (c) => {
    const horn = "#f0e6d0";
    return [
      // le cavalier derrière : tête au seau
      ...head("#f0b088", { cx: 32, cy: 19, r: 10.5 }),
      ...eyes(20.5, { s: 0.62, dx: 4 }),
      ...brows(16.4, 0.5, "#3a2414", 2.2),
      P("M20.5 15.5 L22.5 2.5 L41.5 2.5 L43.5 15.5 Z", "#aab4be"),
      line("M21 14.6 L43 14.6", c ? GOLD : "#d8dee4", 2),
      line("M22 8 L42 8", "#c8d0d8", 1.4),
      // cornes en lyre, oreilles
      ...cord("M20 36 Q7 36 6.5 27 Q6.5 21 11 19.5", horn, 3.6),
      ...cord("M44 36 Q57 36 57.5 27 Q57.5 21 53 19.5", horn, 3.6),
      ER(12.5, 41, 6, 3.2, -20, "#1c1a1e"), ER(51.5, 41, 6, 3.2, 20, "#1c1a1e"),
      // tête de vache pie noir
      P("M17 40 Q16.5 29 32 29 Q47.5 29 47 40 L45 53 Q32 63 19 53 Z", "#1c1a1e"),
      P("M27.5 30 L36.5 30 L34.5 44 L29.5 44 Z", "#f4f0e8", { rim: false, w: 1.3 }),
      ...eyes(40.5, { s: 0.8, dx: 8 }),
      E(32, 54.5, 12.5, 7.8, "#e0b0a8"),
      E(27.2, 54.5, 1.7, 2.3, "#5a2a2a", { rim: false, line: false }), E(36.8, 54.5, 1.7, 2.3, "#5a2a2a", { rim: false, line: false }),
      C(32, 63, 3.6, c ? GOLD : "#d8a830", { rim: false }),
      ...(c ? [C(50, 30, 4.4, "#e0262a", { w: 1.2 }), C(50, 30, 2.2, GOLD, { rim: false, w: 1 })] : []),
    ];
  };

  D.druide = (c) => [
    ...bust(c ? "#fbfaf4" : "#f6f4ec"),
    ...(c ? [line("M20 50 Q32 54 44 50", GOLD, 2.2)] : []),
    C(32, 34, 19.5, "#fbfbf7"),
    ...head("#f2c2a0", { r: 16.5 }),
    ...cheeks("#ff9a8a", 2.8, 40),
    ...eyes(34.5, { open: 0.6 }),
    ER(25.5, 29.2, 5.2, 2.1, 8, "#f4f4f0", { rim: false, w: 1.2 }), ER(38.5, 29.2, 5.2, 2.1, -8, "#f4f4f0", { rim: false, w: 1.2 }),
    ...nose("#e8a088", 40.5),
    // longue barbe blanche et moustache
    P("M16.5 39 Q17 64 32 64 Q47 64 47.5 39 Q41 45.5 32 44.5 Q23 45.5 16.5 39 Z", "#fbfbf7"),
    ...mustache("#fbfbf7", 44, 1.15),
    // couronne de gui
    ...cord("M14.5 24.5 Q32 14 49.5 24.5", c ? GOLD : "#3f7a24", 3.4),
    ER(17, 22, 3.8, 1.8, -35, "#5aa832", { rim: false, w: 1.1 }), ER(24, 18, 3.8, 1.8, -20, "#5aa832", { rim: false, w: 1.1 }), ER(32, 16.8, 3.8, 1.8, 0, "#5aa832", { rim: false, w: 1.1 }),
    ER(40, 18, 3.8, 1.8, 20, "#5aa832", { rim: false, w: 1.1 }), ER(47, 22, 3.8, 1.8, 35, "#5aa832", { rim: false, w: 1.1 }),
    C(20.5, 20, 1.5, "#fbfbf2", { rim: false, w: 1 }), C(28, 17.2, 1.5, "#fbfbf2", { rim: false, w: 1 }), C(36, 17.2, 1.5, "#fbfbf2", { rim: false, w: 1 }), C(43.5, 20, 1.5, "#fbfbf2", { rim: false, w: 1 }),
    // faucille d'or brandie, manche en bois
    R(48.2, 44, 4, 16, 1.6, "#7a4a24"),
    P("M50 45 C47 33 53 25.5 62 25 C56.5 28.5 53.5 35 55 45 Z", GOLD),
  ];

  D.bigoudene = (c) => {
    const lace = "#b4c0d2";
    const dots = [];
    for (let row = 0; row < 5; row++) for (let i = 0; i < 3; i++) dots.push(C(26.5 + i * 5.5 + (row % 2) * 2.7, 5 + row * 4.3, 1.1, lace, { rim: false, line: false }));
    return [
      // haute coiffe de dentelle
      P("M24.5 22 L23 1 L41 1 L39.5 22 Z", "#fbfbf7"),
      ...dots,
      ...(c ? [line("M23.6 11.5 L40.4 11.5", GOLD, 2.6)] : []),
      // crêpes
      ...bust("#1a1822"),
      P("M20 50 Q32 56 44 50 L42 52.5 Q32 58 22 52.5 Z", "#fbfbf7", { rim: false, w: 1.2 }),
      C(32, 59.5, 4.6, c ? GOLD : "#ff8a1a", { rim: false, w: 1.2 }), C(32, 59.5, 2.3, "#ffcf1f", { rim: false, w: 1 }),
      E(52, 58.5, 10.5, 4.2, c ? GOLD : "#f4f4f0"),
      E(52, 55.8, 8.8, 3, "#e0a048"), E(52.5, 53.4, 8.6, 3, "#e8b058"), E(51.8, 51, 8.4, 3, "#e0a048"),
      // petit bonnet de velours et visage
      C(32, 32.5, 18.5, "#1a1822"),
      ...head("#f6c8a6", { cy: 35, r: 16.5 }),
      ...cheeks("#ff8a8a", 3.2, 42),
      ...eyes(36),
      ...brows(30.4, -0.25, "#7a6a60", 2.2),
      ...nose("#f0a888", 41.5),
      ...mouth("M28 45.6 Q32 49.8 36 45.6 Z"),
      // lacets de dentelle autour du visage
      line("M16.5 33 Q14.5 48 27 51", "#fbfbf7", 2.4), line("M47.5 33 Q49.5 48 37 51", "#fbfbf7", 2.4),
    ];
  };

  D.chasseur = (c) => {
    const g1 = c ? "#3f8a2a" : "#5c9a34", g2 = c ? "#2f6a1c" : "#4a8a24", g3 = c ? "#8a7a2a" : "#7a6a30";
    return [
      ...bust(g1),
      // lanières de feuillage
      P("M9 60 L4 55 L10.5 55.5 L7 49 L13.5 52.5 L14 46 L18.5 51 Z", g2, { rim: false }),
      P("M55 60 L60 55 L53.5 55.5 L57 49 L50.5 52.5 L50 46 L45.5 51 Z", g2, { rim: false }),
      P("M24 64 L26 56 L29 62 L32 54 L35 62 L38 56 L40 64 Z", g3, { rim: false }),
      ER(20, 57, 5, 2.2, 20, g3, { rim: false, line: false }), ER(44, 58, 5, 2.2, -20, g2, { rim: false, line: false }),
      // jumelles
      C(28.5, 57, 2.6, c ? GOLD : "#22222a", { rim: false, w: 1.2 }), C(35.5, 57, 2.6, c ? GOLD : "#22222a", { rim: false, w: 1.2 }),
      ...head("#e8b890"),
      line("M17.5 40.5 L24 38.6", "#2c4a1c", 2.4), line("M46.5 40.5 L40 38.6", "#2c4a1c", 2.4),
      ...eyes(35, { open: 0.7 }),
      ...brows(29.5, 0.6, "#3a2a1a", 2.8),
      ...nose("#d89870", 41.5),
      ...mouth("M28.5 46.2 Q32 47.6 35.5 45.2"),
      // casquette orange fluo
      ...cap("#ff6a00", "#e05200", null, c ? GOLD : null),
    ];
  };

  D.rugbyman = (c) => {
    const jersey = c ? "#2446b8" : "#1f2a5c", hoop = c ? GOLD : "#ffcf1f";
    return [
      ...bust(jersey, hoop, true),
      line("M24 50 Q32 54 40 50", "#f4f4f0", 2.4),
      // ballon ovale sous le bras
      ER(11.5, 55.5, 9.5, 6, -28, c ? GOLD : "#8a4a22"),
      line("M8.3 53.8 L14.5 57.2", "#f4f4f0", 1.6), line("M9.8 57.5 L11 55", "#f4f4f0", 1.2), line("M12 58.7 L13.2 56.2", "#f4f4f0", 1.2),
      ...head("#d8946a"),
      ...eyes(35.5),
      ...brows(30, 0.75, "#2a1a10", 3.2),
      ...nose("#c07a52", 41.5),
      ...mouth("M28.5 46 L35.5 46 L35 48.4 L29 48.4 Z"),
      // casque de mêlée et protège-oreilles
      P("M13.8 33 C12.5 9.5 51.5 9.5 50.2 33 Q46 25.5 32 25 Q18 25.5 13.8 33 Z", jersey),
      line("M32 10.5 L32 24.6", hoop, 2.4), line("M17 22 Q32 15 47 22", hoop, 2.2),
      E(14, 37.5, 4.2, 6.3, hoop), E(50, 37.5, 4.2, 6.3, hoop),
    ];
  };

  D.sonneur = (c) => {
    const ribbon = c ? "#2446b8" : "#2a2440", bag = c ? "#2446b8" : "#c41e2a";
    return [
      // bourdon par-dessus l'épaule, rubans du chapeau
      ...cord("M45 51 L57.5 21", "#4a2a12", 2.8),
      R(54.5, 16, 6, 6, 1.4, "#f0e6d0"),
      P("M44 22 L47 44 L50.5 43 L48 21 Z", ribbon, { rim: false }),
      ...bust("#f8f6ee"),
      P("M9 64 L9 58 Q9 50.5 20 49.5 L24.5 49.5 L26.5 64 Z", c ? "#1c2458" : "#1c1c28", { rim: false }),
      P("M55 64 L55 58 Q55 50.5 44 49.5 L39.5 49.5 L37.5 64 Z", c ? "#1c2458" : "#1c1c28", { rim: false }),
      line("M24.5 50 L26.3 63.5", c ? GOLD : "#ff8a1a", 1.8), line("M39.5 50 L37.7 63.5", c ? GOLD : "#ff8a1a", 1.8),
      C(21.5, 55, 1.2, GOLD, { rim: false, line: false }), C(21.8, 59.5, 1.2, GOLD, { rim: false, line: false }),
      // poche du biniou et hautbois
      E(49, 58.5, 11, 7.2, bag),
      line("M40 58 L58 58 M43 53.5 L55 63.5", c ? GOLD : "#2c5220", 1.4),
      ...cord("M33.5 47 L40 55", "#4a2a12", 2.2),
      ...head("#f0b894"),
      ...cheeks("#ff6a6a", 5, 42),
      ...eyes(35.5, { open: 0.85 }),
      ...brows(30, 0.1, "#3a2414", 2.6),
      ...nose("#f09a78", 40.5),
      C(32, 46.5, 2.1, "#4a0f12", { rim: false, w: 1.2 }),
      // chapeau rond à large bord, ruban de velours, boucle
      E(32, 22.5, 30.5, 5.6, "#18181c"),
      P("M19.5 21.5 L21 10 Q32 7.5 43 10 L44.5 21.5 Q32 24 19.5 21.5 Z", "#18181c"),
      P("M20.2 16.5 Q32 18.8 43.8 16.5 L44.3 20.8 Q32 23.2 19.7 20.8 Z", ribbon, { rim: false, w: 1.2 }),
      R(28.8, 16.6, 6.4, 4.6, 0.9, c ? GOLD : "#d8dde3", { rim: false, w: 1.1 }),
      ...(c ? [line("M3 22.5 Q32 30 61 22.5", GOLD, 1.4)] : []),
    ];
  };

  D.pompier = (c) => [
    ...bust(c ? "#b81a24" : "#d0282a"),
    R(9.6, 58.5, 44.8, 3.2, 0, "#d8f040", { rim: false, line: false }),
    ...cord("M12.5 52 Q30 66 50 50.5", "#e8dcc0", 3.6),
    ...(c ? [line("M12 53.5 L15 51 L18 53.5", GOLD, 1.8), line("M46 53.5 L49 51 L52 53.5", GOLD, 1.8)] : []),
    ...head("#f0b088"),
    ...eyes(36),
    ...brows(30.8, 0.3, "#2a1a10", 2.8),
    ...nose("#d88a66", 42),
    ...mustache("#3a2414", 45.6, 1.2),
    // casque doré à crête, visière relevée
    P("M12 32 C10.5 7.5 53.5 7.5 52 32 Q32 26.5 12 32 Z", "#f2b632"),
    P("M29.3 6.5 Q32 1.5 34.7 6.5 L34.2 26 L29.8 26 Z", c ? "#e8243a" : "#ffd84a"),
    P("M16.5 24.8 Q32 20 47.5 24.8 L48 28.4 Q32 23.8 16 28.4 Z", "#2a3a4a", { rim: false, w: 1.2 }),
    C(32, 21.2, 2.3, "#d0282a", { rim: false, w: 1.1 }),
  ];

  D.canard = (c) => [
    ...bust("#f2ead8", c ? "#2446b8" : "#1f2a5c"),
    ...(c ? [C(32, 57, 1.3, GOLD, { rim: false, line: false }), C(32, 61.5, 1.3, GOLD, { rim: false, line: false })] : []),
    ...head("#f0b894", { cx: 36, cy: 33, r: 16 }),
    ...cheeks("#ff8a8a", 2.8, 40),
    ...eyes(34, { cx: 36, open: 0.9 }),
    ...brows(28.6, -0.15, "#5a3a24", 2.4, 36),
    ...nose("#e89a78", 39.5, 36),
    ...mouth("M32 44 Q36 47.5 40 44 Z"),
    // bachi blanc, ruban marine, pompon rouge
    P("M20 26.5 C20 13 52 13 52 26.5 Z", "#f8f8f4"),
    E(36, 14.8, 17.5, 4.4, "#f8f8f4"),
    P("M19.8 25 Q36 21 52.2 25 L52.6 28.8 Q36 25 19.4 28.8 Z", c ? "#2446b8" : "#1f2a5c", { rim: false, w: 1.2 }),
    C(36, 10, 3.4, c ? GOLD : "#e0262a"),
    // la tête du colvert, devant
    C(15, 48.5, 10.5, "#1f7a3a"),
    P("M7 47 Q-1 47.5 1 52.5 Q5 55.5 10.5 52 Z", "#f2c020"),
    line("M8.5 56.5 Q15 61.5 23 57", "#fbfbf7", 2.4),
    E(15, 45.5, 3.2, 3.8, "#fff", { rim: false, w: 1.3 }), C(14.5, 46, 1.8, "#17110d", { rim: false, line: false }),
  ];

  const names = {
    fermier: "Agriculteur en colère", fermier_champion: "Fermier primé",
    quad: "Voleur en quad", quad_champion: "As du quad",
    cowboy: "Cow-boy au lasso", cowboy_champion: "Cow-boy de rodéo",
    vache: "Cavalier sur vache", vache_champion: "Cavalier sur vache primée",
    druide: "Druide", druide_champion: "Archidruide",
    bigoudene: "Bigoudène aux crêpes", bigoudene_champion: "Bigoudène du Pardon",
    chasseur: "Chasseur camouflé", chasseur_champion: "Chasseur d'élite",
    rugbyman: "Rugbyman", rugbyman_champion: "Rugbyman international",
    sonneur: "Sonneur de biniou", sonneur_champion: "Sonneur de bagad",
    pompier: "Pompier", pompier_champion: "Pompier chevronné",
    canard: "Cavalier sur canard", canard_champion: "Matelot sur canard royal",
  };
  // noms des boss (données du jeu si chargées)
  const BOSS = {
    fermier: "Le Grand Fermier", quad: "Le Roi du quad", cowboy: "Le Shérif d'Elven", vache: "Le Maire sur sa vache",
    druide: "Le Grand Druide", bigoudene: "La Reine des crêpes", chasseur: "Le Chasseur fantôme", rugbyman: "Le Capitaine",
    sonneur: "Le Penn-Soner", pompier: "Le Capitaine des pompiers", canard: "Le Canard doré",
  };
  const data = PTMT.sim && PTMT.sim.DATA;
  for (const t of Object.keys(BOSS)) {
    if (data && data.ENEMIES && data.ENEMIES[t]) names[t] = data.ENEMIES[t].name;
    names[t + "_boss"] = (data && data.BOSS_NAMES && data.BOSS_NAMES[t]) || BOSS[t];
  }
  // couleur dominante vue de haut (casquette, quad, chapeau, seau, gui, coiffe, casquette fluo, maillot,
  // chapeau rond, casque, tête du colvert) ; champions : or
  const accent = {
    fermier: "#d8302a", quad: "#f2600c", cowboy: "#8a5a2b", vache: "#8a94a0", druide: "#5aa832", bigoudene: "#2f6be0",
    chasseur: "#ff6a00", rugbyman: "#1f2a5c", sonneur: "#2a2440", pompier: "#f2b632", canard: "#1f7a3a",
  };
  for (const t of Object.keys(BOSS)) accent[t + "_champion"] = GOLD;

  const portraits = (PTMT.portraits = PTMT.portraits || {});
  for (const key of Object.keys(D)) {
    portraits[key] = svg(D[key](false));
    portraits[key + "_champion"] = svg(D[key](true));
  }
  portraits.names = names;
  portraits.accent = accent;
  portraits.keys = Object.keys(D);
  /** Portrait d'un type (champion ou non ; le boss reprend celui du champion) ; chaîne vide si inconnu. */
  portraits.get = function (type, champion) {
    return portraits[type + (champion ? "_champion" : "")] || portraits[type] || "";
  };
})();
