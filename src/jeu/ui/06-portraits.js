// « Pas touche à mes trésors » — portraits des voleurs pour l'interface (PTMT.portraits).
//
//   PTMT.portraits.voleur                      // chaîne SVG (viewBox 64 × 64, sans taille : la CSS la fixe)
//   PTMT.portraits.voleur_elite
//   PTMT.portraits.get("voleur", true)         // idem, par type et élite
//   PTMT.portraits.names.voleur_elite          // « Voleur à casserole »
//   PTMT.portraits.accent.voleur               // couleur dominante (pastille, bordure)
//
// Têtes de dessin animé à plat, fidèles aux personnages 3D (mêmes couvre-chefs et couleurs). Style
// « autocollant » : liseré blanc extérieur + contour sombre, lisibles de 28 à 40 px sur une pastille
// sombre comme claire. Aucun identifiant ni dégradé (plusieurs copies peuvent cohabiter dans la page).
(function () {
  "use strict";
  const PTMT = (globalThis.PTMT = globalThis.PTMT || {});

  const INK = "#2b1a14";
  const SKIN = "#ffc79c";

  // Une forme : [balise, attributs, remplissage, options] ; options : { rim: false } (pas de liseré blanc),
  // { line: false } (pas de contour sombre), { w } (épaisseur du contour), { o } (opacité).
  function el(tag, attrs, fill, opt) {
    return { tag, attrs, fill, opt: opt || {} };
  }
  const attr = (a) => Object.keys(a).map((k) => k + '="' + a[k] + '"').join(" ");
  function svg(shapes) {
    let rim = "", body = "";
    for (const s of shapes) {
      if (s.opt.rim !== false) rim += "<" + s.tag + " " + attr(s.attrs) + (s.fill === "none" ? ' fill="none"' : "") + "/>";
      let extra = ' fill="' + s.fill + '"';
      if (s.opt.line === false) extra += ' stroke="none"';
      else if (s.opt.w) extra += ' stroke-width="' + s.opt.w + '"';
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
  const R = (x, y, w, h, rx, fill, opt) => el("rect", { x, y, width: w, height: h, rx }, fill, opt);
  /** Buste (épaules) : haut arrondi, côtés droits sous y = 57. */
  const BUST = "M9 64 L9 58 Q9 50.5 20 49.5 L44 49.5 Q55 50.5 55 58 L55 64 Z";
  function bust(fill, stripes) {
    const out = [P(BUST, fill)];
    if (stripes) {
      out.push(R(11.2, 52.6, 41.6, 2.6, 0, stripes, { rim: false, line: false }));
      out.push(R(10.1, 57.6, 43.8, 2.6, 0, stripes, { rim: false, line: false }));
      out.push(R(10.1, 62.2, 43.8, 1.8, 0, stripes, { rim: false, line: false }));
      out.push(P(BUST, "none", { rim: false }));
    }
    return out;
  }
  function head(skin, opt) {
    opt = opt || {};
    const out = [];
    if (!opt.noEars) out.push(C(14.6, 36, 3.6, skin), C(49.4, 36, 3.6, skin));
    out.push(C(32, 34, 17.5, opt.color || skin));
    return out;
  }
  /** Yeux de dessin animé : blanc, pupille, reflet (regard légèrement de côté). */
  function eyes(y, opt) {
    opt = opt || {};
    const out = [];
    const xs = opt.one ? [26] : [26, 38];
    for (const x of xs) {
      out.push(E(x, y, 4.3, 5.2, "#fff", { rim: false, w: 1.6 }));
      out.push(C(x + 0.8, y + 0.7, 2.5, "#17110d", { rim: false, line: false }));
      out.push(C(x + 1.6, y - 0.4, 0.9, "#fff", { rim: false, line: false }));
    }
    return out;
  }
  /** Sourcils : mood > 0 fâché (coins intérieurs en bas), < 0 inquiet. */
  function brows(y, mood, color) {
    const d = mood * 2.2;
    return [
      P("M21.5 " + (y - d) + " L29.5 " + (y + d), "none", { rim: false, w: 2.6 }),
      P("M34.5 " + (y + d) + " L42.5 " + (y - d), "none", { rim: false, w: 2.6 }),
    ].map((s) => ((s.opt.stroke = color), s));
  }
  function nose(fill, y) {
    return [E(32, y || 40, 3.4, 3, fill, { rim: false, w: 1.5 })];
  }
  function cheeks() {
    return [E(21, 41.5, 3, 1.9, "#ff8f8f", { rim: false, line: false, o: 0.8 }), E(43, 41.5, 3, 1.9, "#ff8f8f", { rim: false, line: false, o: 0.8 })];
  }
  function mustache(color, y) {
    y = y || 44;
    return [P("M32 " + (y - 1.5) + " C28 " + (y - 3.5) + " 22 " + (y - 3) + " 20.5 " + (y + 1.5) + " C24 " + (y + 1) + " 28 " + (y + 1.8) + " 32 " + (y + 0.2) + " C36 " + (y + 1.8) + " 40 " + (y + 1) + " 43.5 " + (y + 1.5) + " C42 " + (y - 3) + " 36 " + (y - 3.5) + " 32 " + (y - 1.5) + " Z", color, { rim: false, w: 1.4 })];
  }
  const mouth = (d) => [P(d, "#4a0f12", { rim: false, w: 1.3 })];
  // sourcils colorés : la couleur passe par stroke
  function fixStroke(list) {
    for (const s of list) if (s.opt.stroke) { s.attrs.stroke = s.opt.stroke; }
    return list;
  }

  // --- les douze portraits ---------------------------------------------------------------------
  const D = {};

  D.voleur = () => fixStroke([
    ...bust("#2349b8", "#f1eadb"),
    ...head(SKIN),
    // loup noir et ses deux pans
    P("M52 29 L60 25 L58.5 31 L61 35 L52 33.5 Z", "#121216"),
    R(13.8, 28, 36.4, 11, 5.5, "#121216"),
    ...eyes(33.5),
    ...nose("#f2a680", 41.5),
    ...mouth("M28.5 46 Q32.5 48.6 36 45.6"),
    ...cheeks(),
    // bonnet rouge à revers et pompon
    P("M14.5 28.5 C14.5 11 49.5 11 49.5 28.5 Z", "#e8302a"),
    R(13, 24.5, 38, 6, 3, "#c41f1f"),
    C(32, 10.5, 5.2, "#fff3e2"),
  ]);

  D.voleur_elite = () => fixStroke([
    ...bust("#d8262e", "#f1eadb"),
    ...head(SKIN),
    R(13.8, 28, 36.4, 11, 5.5, "#121216"),
    ...eyes(33.5),
    ...nose("#f2a680", 41.5),
    ...mouth("M28 46.2 Q32 44.2 36 46.4"),
    ...cheeks(),
    // foulard jaune
    P("M20 50.5 Q32 55.5 44 50.5 L45 53.5 Q32 59 19 53.5 Z", "#ffcf1f"),
    P("M36 54 L42 62 L37.5 62.5 L34 56 Z", "#ffcf1f"),
    // casserole renversée et son manche
    R(0.8, 16.4, 16, 4.2, 2.1, "#24242a"),
    C(3.6, 18.5, 1.1, "#fff", { rim: false, line: false }),
    P("M13 27 L15 11.5 Q32 7.5 49 11.5 L51 27 Q32 30.5 13 27 Z", "#c9d4de"),
    E(32, 11.2, 17, 3.2, "#e6edf3", { rim: false }),
    P("M12 25.8 Q32 29.8 52 25.8 L52 28.6 Q32 32.6 12 28.6 Z", "#e6edf3", { rim: false }),
    P("M20 14.5 L19 24", "none", { rim: false, line: true, w: 1.2 }),
  ]);

  D.sprinteur = () => fixStroke([
    ...bust("#e9a877"),
    P("M19 64 L19.5 51.5 Q25 54 32 54 Q39 54 44.5 51.5 L45 64 Z", "#ffd21a"),
    R(27, 56, 10, 7.5, 1, "#fff", { rim: false, w: 1.3 }),
    P("M32.2 58 L32.2 62 M30.6 58.6 L32.2 57.8", "none", { rim: false, w: 1.3 }),
    // queue de cheval
    P("M44 22 Q57 22 56 36 Q54 30 47 30 Z", "#f6c440"),
    ...head("#e9a877"),
    ...eyes(34.5),
    ...brows(27.8, 0.35, "#7a5418"),
    ...nose("#dd9464", 41.5),
    ...mouth("M27.5 45.2 Q32 50 36.8 45.2 Z"),
    ...cheeks(),
    // cheveux blonds et bandeau rouge
    P("M14.6 30 C14 10.5 50 10.5 49.4 30 C44 24.5 38 22.5 32 22.5 C26 22.5 20 24.5 14.6 30 Z", "#f6c440"),
    P("M14.5 24.5 Q32 16 49.5 24.5 L49.8 29 Q32 20.5 14.2 29 Z", "#e8322a"),
  ]);

  D.sprinteur_elite = () => fixStroke([
    ...bust("#e9a877"),
    P("M19 64 L19.5 51.5 Q25 54 32 54 Q39 54 44.5 51.5 L45 64 Z", "#9b4dff"),
    ...head("#e9a877"),
    ...eyes(35),
    ...brows(28.6, 0.3, "#5a3010"),
    ...nose("#dd9464", 42),
    ...mouth("M27.5 45.8 Q32 50.2 36.8 45.8 Z"),
    ...cheeks(),
    // casque de vélo rose à aérations, jugulaire
    P("M22 44 Q32 51 42 44", "none", { rim: false, w: 1.4 }),
    P("M12.5 29.5 C11.5 8.5 52.5 8.5 51.5 29.5 Q32 24.5 12.5 29.5 Z", "#ff5fa2"),
    P("M24 13 L22.5 25 M32 11.5 L32 24.2 M40 13 L41.5 25", "none", { rim: false, w: 3.2 }),
    P("M24 13 L22.5 25 M32 11.5 L32 24.2 M40 13 L41.5 25", "none", { rim: false, w: 1.6, o: 1 }),
  ]).map((s) => {
    // aérations blanches (deuxième tracé)
    if (s.attrs.d && s.attrs.d.startsWith("M24 13") && s.opt.w === 1.6) s.attrs.stroke = "#fff";
    return s;
  });

  D.demenageur = () => fixStroke([
    // matelas rayé dans le dos
    R(6, 3.5, 52, 58, 7, "#f1eadb"),
    R(11.5, 6, 4, 53, 0, "#2f5fc0", { rim: false, line: false }),
    R(21.5, 6, 4, 53, 0, "#2f5fc0", { rim: false, line: false }),
    R(38.5, 6, 4, 53, 0, "#2f5fc0", { rim: false, line: false }),
    R(48.5, 6, 4, 53, 0, "#2f5fc0", { rim: false, line: false }),
    R(6, 3.5, 52, 58, 7, "none", { rim: false }),
    ...bust("#f6f3ea"),
    P("M22 64 L22 55 L42 55 L42 64 Z", "#2f63c0", { rim: false }),
    P("M22 55 L19 50 M42 55 L45 50", "none", { rim: false, w: 3 }),
    C(32, 59, 1.6, "#e8c45a", { rim: false, w: 1 }),
    ...head("#d99a70"),
    ...eyes(34.5),
    ...brows(28.2, -0.45, "#3a2418"),
    ...nose("#c47f58", 40.8),
    ...mustache("#3a2418", 45),
    ...cheeks(),
    // casquette rouge à visière
    P("M31 26 Q43 25 52 29.5 Q44 32 32 29.5 Z", "#b8211e"),
    P("M14.8 27.5 C14.5 11.5 49.5 11.5 49.2 27.5 Q32 24 14.8 27.5 Z", "#e0302a"),
    C(32, 12.5, 1.6, "#b8211e", { rim: false, w: 1 }),
  ]);

  D.demenageur_elite = () => fixStroke([
    ...bust("#ffe0b0"),
    ...head("#d99a70"),
    ...eyes(34),
    ...brows(27.6, 0.35, "#3a2418"),
    ...nose("#c47f58", 40.5),
    ...mustache("#3a2418", 44.6),
    ...cheeks(),
    // casque de chantier jaune
    P("M9 27.5 Q32 23 55 27.5 Q55 30.5 32 29.5 Q9 30.5 9 27.5 Z", "#f2b20e"),
    P("M14.5 26.5 C14.5 9.5 49.5 9.5 49.5 26.5 Q32 23.5 14.5 26.5 Z", "#ffc21a"),
    P("M32 10.8 L32 24.6", "none", { rim: false, w: 3.4 }),
    // canapé orange tenu devant (bouclier)
    R(3, 47, 58, 17, 5, "#f08c24"),
    R(9.5, 50.5, 21, 10, 3, "#ffb347", { rim: false, w: 1.5 }),
    R(33.5, 50.5, 21, 10, 3, "#ffb347", { rim: false, w: 1.5 }),
  ]);

  D.fumigene = () => fixStroke([
    ...bust("#6b3fd0"),
    // pans du bandeau
    P("M47 20 Q56 17 62 22 Q56 22 52 25 Z", "#e8243a"),
    P("M47 22.5 Q55 25.5 58.5 32.5 Q53 28.5 49 27.5 Z", "#e8243a"),
    ...head("#6b3fd0", { noEars: true }),
    // fente de la cagoule
    R(15.5, 27, 33, 13.5, 6.75, "#f3cba8", { rim: false }),
    ...eyes(33.8),
    ...brows(27.4, 0.5, "#1a1026"),
    // bandeau rouge
    P("M14.8 20 Q32 13 49.2 20 L49.6 24.5 Q32 17.5 14.4 24.5 Z", "#e8243a"),
  ]);

  D.fumigene_elite = () => fixStroke([
    ...bust("#1f9aa8"),
    ...head("#1f9aa8", { noEars: true }),
    R(15.5, 27.5, 33, 13.5, 6.75, "#f3cba8", { rim: false }),
    ...eyes(34.3),
    ...brows(27.9, 0.5, "#10363c"),
    // charlotte rose à froufrous et pois
    P("M12.5 25 C11 7 53 7 51.5 25 Z", "#ff94c8"),
    P("M10.5 25.5 Q13 22.5 15.5 25.5 Q18 22.5 20.5 25.5 Q23 22.5 25.5 25.5 Q28 22.5 30.5 25.5 Q33 22.5 35.5 25.5 Q38 22.5 40.5 25.5 Q43 22.5 45.5 25.5 Q48 22.5 50.5 25.5 Q53 22.5 54 26 Q48 30 40.5 28.5 Q32 30.5 23.5 28.5 Q15 30 10.5 25.5 Z", "#ffe6f2"),
    C(24, 14.5, 1.5, "#fff", { rim: false, line: false }),
    C(33, 11.5, 1.5, "#fff", { rim: false, line: false }),
    C(41, 15.5, 1.5, "#fff", { rim: false, line: false }),
    // canard en caoutchouc
    E(49, 57.5, 6, 4.2, "#ffd21f"),
    C(52.5, 51.8, 3.3, "#ffd21f"),
    P("M55.4 51.4 L59 52.6 L55.4 53.8 Z", "#ff7a1a", { rim: false, w: 1 }),
    C(53.1, 51, 0.8, "#111", { rim: false, line: false }),
  ]);

  D.nageur = () => fixStroke([
    ...bust("#ffbea4"),
    ...head("#ffbea4"),
    ...eyes(35),
    ...brows(28.8, -0.45, "#5a3a24"),
    ...nose("#ffffff", 41.8),
    ...mouth("M29.6 46.4 Q32 44 34.4 46.4 Q32 49 29.6 46.4 Z"),
    ...cheeks(),
    // bonnet de bain blanc à pois roses, lunettes relevées
    P("M14.5 29 C13.5 9.5 50.5 9.5 49.5 29 Q32 24.5 14.5 29 Z", "#ffffff"),
    C(22, 17.5, 2.3, "#ff4f9a", { rim: false, line: false }),
    C(31, 13.2, 2.3, "#ff4f9a", { rim: false, line: false }),
    C(41, 16.2, 2.3, "#ff4f9a", { rim: false, line: false }),
    C(45.2, 23.4, 2, "#ff4f9a", { rim: false, line: false }),
    C(18.2, 24.4, 2, "#ff4f9a", { rim: false, line: false }),
    P("M15 25.6 Q32 19.5 49 25.6", "none", { rim: false, w: 2.2 }),
    C(26.5, 23.4, 3.6, "#37b6ff", { rim: false, w: 1.6 }),
    C(37.5, 23.4, 3.6, "#37b6ff", { rim: false, w: 1.6 }),
    // bouée flamant rose
    P("M4 64 Q4 51.5 32 51.5 Q60 51.5 60 64 Z", "#ff6fae"),
    P("M12 58.5 Q32 54.5 52 58.5", "none", { rim: false, w: 1.5 }),
    P("M9.5 52 Q4 44 8.5 37 Q12.5 32.5 16.5 36.5", "none", { w: 4.6 }),
    P("M9.5 52 Q4 44 8.5 37 Q12.5 32.5 16.5 36.5", "none", { rim: false, line: true, w: 2.4 }),
    C(15.5, 36, 3.3, "#ff6fae"),
    P("M18 36.2 L22.5 39.5 L18.4 39.6 Z", "#fff6ea", { rim: false, w: 1 }),
  ]).map((s) => {
    // cou du flamant : tracé rose par-dessus le contour
    if (s.attrs.d && s.attrs.d.startsWith("M9.5 52") && s.opt.w === 2.4) s.attrs.stroke = "#ff6fae";
    return s;
  });

  D.nageur_elite = () => fixStroke([
    ...bust("#d4262a", "#f4efe6"),
    ...head("#e0a57e"),
    // barbe noire
    P("M17 38 Q17 58 32 58 Q47 58 47 38 Q41 45 32 44.5 Q23 45 17 38 Z", "#1d130c"),
    ...eyes(33.5, { one: true }),
    ...brows(27, 0.45, "#1a120c"),
    // bandeau sur l'œil droit
    P("M16 26.5 L49 38", "none", { rim: false, w: 1.8 }),
    E(38.5, 33.5, 5, 5, "#111111", { rim: false, w: 1.5 }),
    ...nose("#d98a68", 40),
    ...mustache("#1d130c", 44),
    // tricorne noir galonné, tête de mort
    P("M6.5 25 Q32 14 57.5 25 L52 29 Q32 20 12 29 Z", "#1b1b20"),
    P("M15 25 C15 8 49 8 49 25 Q32 17 15 25 Z", "#1b1b20"),
    P("M9 25.5 Q32 15.5 55 25.5", "none", { rim: false, w: 1.3 }),
    C(32, 15.8, 2.6, "#ffffff", { rim: false, line: false }),
    P("M28.5 19.8 L35.5 23.2 M35.5 19.8 L28.5 23.2", "none", { rim: false, w: 1.3 }),
  ]).map((s) => {
    if (s.attrs.d === "M9 25.5 Q32 15.5 55 25.5") s.attrs.stroke = "#e0b44a";
    if (s.attrs.d === "M28.5 19.8 L35.5 23.2 M35.5 19.8 L28.5 23.2") s.attrs.stroke = "#ffffff";
    return s;
  });

  D.boss = () => fixStroke([
    ...bust("#f7f5ef"),
    C(25, 57, 1.3, "#2a2a30", { rim: false, line: false }),
    C(39, 57, 1.3, "#2a2a30", { rim: false, line: false }),
    C(25, 61.5, 1.3, "#2a2a30", { rim: false, line: false }),
    C(39, 61.5, 1.3, "#2a2a30", { rim: false, line: false }),
    P("M20 50 Q32 55 44 50 L45 53 Q32 58.5 19 53 Z", "#e8302a", { rim: false }),
    ...head("#f2c6a2"),
    ...eyes(36),
    ...brows(29.5, 0.55, "#1a120c"),
    ...nose("#e8a484", 42),
    ...mustache("#1a120c", 46),
    // toque géante
    P("M17 29.5 L17.5 17 L46.5 17 L47 29.5 Q32 27 17 29.5 Z", "#ffffff"),
    P("M14.5 18 C8 16 8 5.5 17 6 C18 0.5 27 0.2 30 3.8 C33 -0.5 43 0.4 44 5.2 C53 4 56.5 14.5 49.5 18 Q32 21 14.5 18 Z", "#ffffff"),
    P("M17.2 25 Q32 22.5 46.8 25", "none", { rim: false, w: 2.4 }),
  ]).map((s) => {
    if (s.attrs.d === "M17.2 25 Q32 22.5 46.8 25") s.attrs.stroke = "#e8302a";
    return s;
  });

  D.boss_elite = () => fixStroke([
    ...bust("#1d1f27"),
    P("M26 49.8 L32 58 L38 49.8 Z", "#ffffff", { rim: false }),
    P("M26 52 L32 55 L26 58 Z M38 52 L32 55 L38 58 Z", "#e8243a", { rim: false, w: 1.4 }),
    ...head("#f2c6a2"),
    // lunettes noires
    P("M17 31 Q24.5 28.5 31 31 L31.5 36 Q24.5 40 18 36 Z M33 31 Q39.5 28.5 47 31 L46 36 Q39.5 40 32.5 36 Z", "#0d0d12", { rim: false, w: 1.5 }),
    P("M20.5 32 L23.5 32.5 M36.5 32 L39.5 32.5", "none", { rim: false, w: 1.2 }),
    ...nose("#e8a484", 41.5),
    ...mustache("#1a120c", 45.6),
    ...cheeks(),
    // couronne d'or
    P("M15 25 L13 9 L21.5 16.5 L26.5 6 L32 15 L37.5 6 L42.5 16.5 L51 9 L49 25 Q32 22 15 25 Z", "#ffc21a"),
    C(22.5, 20.6, 2.1, "#e8243a", { rim: false, w: 1.2 }),
    C(32, 19.8, 2.3, "#2b8cff", { rim: false, w: 1.2 }),
    C(41.5, 20.6, 2.1, "#e8243a", { rim: false, w: 1.2 }),
  ]).map((s) => {
    if (s.attrs.d === "M20.5 32 L23.5 32.5 M36.5 32 L39.5 32.5") s.attrs.stroke = "#8aa0b8";
    return s;
  });

  const names = {
    voleur: "Voleur du dimanche",
    voleur_elite: "Voleur à casserole",
    sprinteur: "Sprinteur en claquettes",
    sprinteur_elite: "Patineur du dimanche",
    demenageur: "Déménageur en matelas",
    demenageur_elite: "Forteresse canapé",
    fumigene: "Voleur au fumigène",
    fumigene_elite: "Ninja au rideau de douche",
    nageur: "Nageur en flamant rose",
    nageur_elite: "Pirate en pédalo",
    boss: "Chef en tondeuse blindée",
    boss_elite: "Limousine-tondeuse",
  };
  const accent = {
    voleur: "#e8302a", voleur_elite: "#c9d4de", sprinteur: "#ffd21a", sprinteur_elite: "#ff5fa2",
    demenageur: "#2f63c0", demenageur_elite: "#f08c24", fumigene: "#6b3fd0", fumigene_elite: "#1f9aa8",
    nageur: "#ff6fae", nageur_elite: "#1b1b20", boss: "#39a23a", boss_elite: "#ffc21a",
  };

  const portraits = (PTMT.portraits = PTMT.portraits || {});
  for (const key of Object.keys(D)) portraits[key] = svg(D[key]());
  portraits.names = names;
  portraits.accent = accent;
  portraits.keys = Object.keys(names);
  /** Portrait d'un type (élite ou non) ; chaîne vide si le type est inconnu. */
  portraits.get = function (type, elite) {
    return portraits[type + (elite ? "_elite" : "")] || "";
  };
})();
