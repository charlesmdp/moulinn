// « Pas touche à mes trésors » — logo du jeu (SVG en ligne, sans ressource externe).
//
//   PTMT.logo.full()                 // grand logo (écran titre, chargement) : chaîne SVG, viewBox 800 × 500
//   PTMT.logo.full({ rays: false })  // sans le soleil de rayons derrière
//   PTMT.logo.full({ id: "ld" })     // suffixe d'identifiants imposé (version figée de index.html)
//   PTMT.logo.emblem()               // emblème carré (favicon, HUD) : chaîne SVG, viewBox 64 × 64
//
// Lettrage massif en Lilita One, mais en tracés (contours extraits de la police, crénage compris) :
// le logo ne dépend pas du chargement de la police et se dessine pareil partout. « Pas touche à » sur
// un ruban rouge, « mes trésors » en or chaud (dégradé, biseau clair, contour brun épais, relief et
// ombre portée, reflet qui balaie les lettres), posé en arc devant la roue à aubes du moulin ; le
// berger-dragon veille derrière le ruban, la hure du sanglier et le cygne encadrent le titre, un tas
// de gemmes étincelantes déborde dessous. Les dégradés et découpes ont des identifiants uniques à
// chaque appel (plusieurs logos peuvent cohabiter dans la page).
(function () {
  "use strict";
  const PTMT = (globalThis.PTMT = globalThis.PTMT || {});
  const K = PTMT.icons && PTMT.icons.kit;

  // Contours des lettres (unités de la police : 1000 par cadratin, y vers le bas, ligne de base à 0).
  const GLYPHS = {
    "P": [570, "M137 2Q46 2 46 -18V-666Q46 -700 77 -700H253Q401 -700 466 -639Q532 -578 532 -462Q532 -366 470 -286Q439 -246 379 -222Q319 -198 239 -198V-19Q239 -7 202 -2Q164 2 137 2ZM239 -526V-368H252Q287 -368 311 -390Q335 -412 335 -452Q335 -492 318 -509Q302 -526 260 -526Z"],
    "a": [517, "M108 -363Q80 -413 80 -444Q80 -476 97 -485Q154 -510 254 -510Q353 -510 394 -464Q435 -417 435 -326V-168H469Q486 -168 496 -148Q505 -128 505 -93Q505 -58 488 -24Q470 10 440 10Q386 10 353 -19Q338 -31 330 -48Q284 10 187 10Q114 10 64 -42Q14 -94 14 -165Q14 -328 209 -328H264V-338Q264 -364 256 -372Q247 -379 216 -379Q178 -379 108 -363ZM188 -179Q188 -157 200 -146Q212 -134 230 -134Q249 -134 264 -149V-226H236Q188 -226 188 -179Z"],
    "c": [424, "M209 -248Q209 -150 283 -150Q331 -150 363 -169Q378 -169 388 -118Q397 -66 397 -48Q397 -29 392 -23Q339 10 247 10Q155 10 90 -58Q26 -127 26 -246Q26 -364 90 -437Q153 -510 258 -510Q364 -510 405 -459Q414 -448 414 -426Q414 -405 406 -374Q388 -310 359 -300Q355 -299 348 -299Q340 -299 329 -311Q290 -350 266 -350Q243 -350 226 -326Q209 -302 209 -248Z"],
    "e": [486, "M423 -27Q360 10 261 10Q162 10 94 -58Q26 -125 26 -244Q26 -364 92 -437Q157 -510 257 -510Q357 -510 412 -459Q466 -408 466 -335Q466 -173 280 -173H211Q211 -143 228 -132Q244 -120 276 -120Q346 -120 409 -152Q410 -153 418 -138Q442 -95 442 -66Q442 -36 423 -27ZM298 -316Q298 -358 257 -358Q238 -358 224 -346Q211 -335 211 -313V-282H265Q298 -282 298 -316Z"],
    "h": [501, "M212 -7Q212 2 128 2Q45 2 45 -12V-697Q45 -704 76 -707Q107 -710 128 -710Q212 -710 212 -692V-492Q268 -509 297 -509Q373 -509 417 -468Q461 -428 461 -318V-8Q461 1 383 1Q295 -2 295 -9V-303Q295 -352 263 -352Q241 -352 212 -331Z"],
    "m": [788, "M498 -5Q498 2 412 2Q327 2 327 -7V-298Q327 -348 294 -348Q277 -348 249 -326V-6Q249 4 164 4Q78 4 78 -7V-334H53Q20 -334 20 -403Q20 -434 32 -466Q48 -510 84 -510Q120 -510 154 -491Q187 -472 194 -455Q256 -510 332 -510Q407 -510 453 -463Q507 -510 583 -510Q748 -510 748 -309V-5Q748 2 662 2Q577 2 577 -7V-298Q577 -348 544 -348Q526 -348 498 -326Z"],
    "o": [513, "M88 -59Q26 -128 26 -250Q26 -372 88 -441Q151 -510 257 -510Q363 -510 425 -441Q487 -372 487 -250Q487 -128 425 -59Q363 10 257 10Q151 10 88 -59ZM258 -343Q201 -343 201 -251Q201 -159 258 -159Q314 -159 314 -251Q314 -343 258 -343Z"],
    "r": [396, "M264 -1Q264 6 173 6Q82 4 82 -2V-334H55Q39 -334 30 -354Q20 -373 20 -402Q20 -510 84 -510Q129 -510 159 -482Q189 -455 189 -420Q210 -461 246 -486Q281 -510 318 -510Q376 -510 388 -480Q391 -472 391 -456Q391 -441 382 -401Q372 -361 362 -343Q352 -325 350 -325Q348 -325 332 -332Q315 -340 302 -340Q264 -340 264 -280Z"],
    "s": [450, "M66 -180Q147 -131 194 -131Q224 -131 224 -152Q224 -167 172 -191Q47 -242 47 -358Q47 -432 101 -471Q155 -510 230 -510Q306 -510 358 -494Q411 -478 411 -452Q411 -430 390 -394Q368 -358 360 -355Q317 -379 267 -379Q240 -379 240 -360Q240 -348 250 -340Q261 -331 289 -318Q317 -306 336 -296Q354 -286 377 -268Q425 -230 425 -169Q425 -89 372 -40Q319 10 212 10Q141 10 83 -14Q25 -38 25 -80Q25 -108 38 -139Q52 -170 66 -180Z"],
    "t": [368, "M275 -6Q275 6 191 6Q91 2 91 -7V-361H40Q20 -361 20 -430Q20 -448 24 -474Q27 -500 38 -500H91V-588Q91 -608 176 -608Q260 -608 260 -592V-528L261 -500H346Q363 -500 363 -430Q363 -360 346 -360H275Z"],
    "u": [544, "M40 -494Q40 -505 126 -505Q212 -505 212 -494V-202Q212 -152 244 -152Q268 -152 298 -173V-494Q298 -504 383 -504Q468 -504 468 -494V-166H494Q528 -166 528 -101Q528 -68 514 -34Q494 10 460 10Q393 10 361 -45L360 -44Q299 10 229 10Q132 10 86 -38Q40 -87 40 -199Z"],
    "à": [517, "M108 -363Q80 -413 80 -444Q80 -476 97 -485Q154 -510 254 -510Q353 -510 394 -464Q435 -417 435 -326V-168H469Q486 -168 496 -148Q505 -128 505 -93Q505 -58 488 -24Q470 10 440 10Q386 10 353 -19Q338 -31 330 -48Q284 10 187 10Q114 10 64 -42Q14 -94 14 -165Q14 -328 209 -328H264V-338Q264 -364 256 -372Q247 -379 216 -379Q178 -379 108 -363ZM188 -179Q188 -157 200 -146Q212 -134 230 -134Q249 -134 264 -149V-226H236Q188 -226 188 -179ZM148 -605Q143 -610 143 -619Q143 -652 162 -682Q181 -711 191 -711Q194 -711 357 -621Q363 -615 363 -607Q363 -577 347 -553Q331 -529 322 -529Q320 -529 148 -605Z"],
    "é": [486, "M178 -529Q169 -529 155 -549Q137 -577 137 -596Q137 -615 143 -621Q306 -711 309 -711Q319 -711 334 -687Q357 -652 357 -621Q357 -610 352 -605Q180 -529 178 -529ZM423 -27Q360 10 261 10Q162 10 94 -58Q26 -125 26 -244Q26 -364 92 -437Q157 -510 257 -510Q357 -510 412 -459Q466 -408 466 -335Q466 -173 280 -173H211Q211 -143 228 -132Q244 -120 276 -120Q346 -120 409 -152Q410 -153 418 -138Q442 -95 442 -66Q442 -36 423 -27ZM298 -316Q298 -358 257 -358Q238 -358 224 -346Q211 -335 211 -313V-282H265Q298 -282 298 -316Z"],
  };
  const KERN = {"Pa": -25, "Pc": -20, "Pe": -20, "Po": -25, "Ps": -25};
  const SPACE = 200;
  const f1 = (v) => Math.round(v * 100) / 100;
  let uid = 0;

  /**
   * Met une ligne de texte en place : lettres centrées sur cx, ligne de base à y, en arc (h : flèche en px,
   * positive = centre relevé), avec un léger « rebond » d'une lettre à l'autre.
   * Renvoie les <path> transformés et les dimensions.
   */
  function setLine(text, size, cx, y, h, bounce) {
    const s = size / 1000;
    const items = [];
    let x = 0;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === " ") {
        x += SPACE;
        continue;
      }
      const g = GLYPHS[ch];
      if (!g) continue;
      items.push({ ch, x, adv: g[0], d: g[1], i });
      x += g[0] + (KERN[ch + text[i + 1]] || 0);
    }
    const w = x * s;
    const half = w / 2;
    let paths = "";
    items.forEach((it, k) => {
      const px = cx - half + (it.x + it.adv / 2) * s;
      const u = (px - cx) / half;
      const dy = -h * (1 - u * u);
      const rot = (Math.atan((2 * h * u) / half) * 180) / Math.PI + (bounce ? (k % 2 ? 2.2 : -2.2) : 0);
      const sc = s * (bounce ? (k % 3 === 1 ? 1.05 : k % 3 === 2 ? 0.97 : 1) : 1);
      const jy = bounce ? (k % 2 ? 2.5 : -1.5) : 0;
      paths += `<path transform="translate(${f1(px)} ${f1(y + dy + jy)}) rotate(${f1(rot)}) scale(${f1(sc * 1000) / 1000}) translate(${-it.adv / 2} 0)" d="${it.d}"/>`;
    });
    return { paths, w, s };
  }

  /** Roue à aubes du moulin (derrière le titre). */
  function wheel(cx, cy, R) {
    let out = "";
    const ink = "#3b1d08";
    // Aubes
    for (let k = 0; k < 16; k++) {
      const a = (k * 360) / 16;
      out += `<rect x="${f1(cx - 13)}" y="${f1(cy - R - 20)}" width="26" height="34" rx="4" transform="rotate(${a} ${cx} ${cy})" fill="#9a6535" stroke="${ink}" stroke-width="6"/>`;
    }
    out += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${ink}" stroke-width="34"/>`;
    out += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#b07a45" stroke-width="22"/>`;
    out += `<circle cx="${cx}" cy="${cy}" r="${R - 5}" fill="none" stroke="#d09a60" stroke-width="4" opacity=".7"/>`;
    // Rayons
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4 + Math.PI / 8;
      const x2 = cx + (R - 8) * Math.cos(a),
        y2 = cy + (R - 8) * Math.sin(a);
      out += `<path d="M${cx} ${cy}L${f1(x2)} ${f1(y2)}" stroke="${ink}" stroke-width="20" stroke-linecap="round"/><path d="M${cx} ${cy}L${f1(x2)} ${f1(y2)}" stroke="#a36d3b" stroke-width="10" stroke-linecap="round"/>`;
    }
    out += `<circle cx="${cx}" cy="${cy}" r="30" fill="#8a5a2c" stroke="${ink}" stroke-width="6"/><circle cx="${cx}" cy="${cy}" r="11" fill="#5a3a1c"/>`;
    return out;
  }

  /** Soleil de rayons alternés derrière le logo. */
  function rays(cx, cy, R, n, fill) {
    let d = "";
    for (let k = 0; k < n; k++) {
      const a0 = (k * 2 * Math.PI) / n,
        a1 = a0 + Math.PI / n;
      d += `M${cx} ${cy}L${f1(cx + R * Math.cos(a0))} ${f1(cy + R * Math.sin(a0))}L${f1(cx + R * Math.cos(a1))} ${f1(cy + R * Math.sin(a1))}Z`;
    }
    return `<path d="${d}" fill="${fill}"/>`;
  }

  /** Ruban rouge en arc, extrémités fendues repliées derrière. */
  function ribbon(x0, x1, yTop, hgt, arcH) {
    const ink = "#3b1d08";
    const cx = (x0 + x1) / 2;
    const band = `M${x0} ${yTop}Q${cx} ${yTop - 2 * arcH} ${x1} ${yTop}L${x1} ${yTop + hgt}Q${cx} ${yTop + hgt - 2 * arcH} ${x0} ${yTop + hgt}Z`;
    const tail = (sx) => {
      const xa = sx < 0 ? x0 + 26 : x1 - 26;
      const xb = sx < 0 ? x0 - 58 : x1 + 58;
      const xn = sx < 0 ? x0 - 36 : x1 + 36;
      const yt = yTop + 22,
        yb = yTop + hgt + 22;
      return (
        `<path d="M${xa} ${yt}L${xb} ${yt}L${xn} ${f1((yt + yb) / 2)}L${xb} ${yb}L${xa} ${yb}Z" fill="#b3321f" stroke="${ink}" stroke-width="7" stroke-linejoin="round"/>` +
        `<path d="M${sx < 0 ? x0 : x1} ${yTop + hgt}L${xa} ${yb}L${xa} ${yTop + hgt - 4}Z" fill="#6e1a10" stroke="${ink}" stroke-width="5" stroke-linejoin="round"/>`
      );
    };
    return (
      tail(-1) +
      tail(1) +
      `<path d="${band}" fill="#dc4430" stroke="${ink}" stroke-width="8" stroke-linejoin="round"/>` +
      `<path d="M${x0 + 10} ${yTop + 9}Q${cx} ${yTop + 9 - 2 * arcH} ${x1 - 10} ${yTop + 9}" fill="none" stroke="#ff8a6a" stroke-width="5" stroke-linecap="round" opacity=".8"/>` +
      `<path d="M${x0 + 10} ${yTop + hgt - 8}Q${cx} ${yTop + hgt - 8 - 2 * arcH} ${x1 - 10} ${yTop + hgt - 8}" fill="none" stroke="#9e2a1e" stroke-width="4" stroke-linecap="round" opacity=".8"/>`
    );
  }

  /** Imbrique un SVG (icône, portrait) à une position et une taille données. */
  const nest = (svg, x, y, w, h) => (svg ? svg.replace(/ class="[^"]*"/, ' class="ptmt-logo-part"').replace("<svg ", `<svg x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(h)}" `) : "");

  /** Tas de gemmes et de pièces, dessiné dans une boîte 240 × 100 (sticker, comme les icônes). */
  function gemPile() {
    if (!K) return "";
    const G = K.GEMS;
    const g = (c, x, y, s, r) => K.place(K.gemShapes(G[c]), x, y, s, r);
    const coin = (x, y, s) => K.place(K.coinShapes(), x, y, s);
    const shapes = [
      coin(34, 78, 0.62),
      coin(206, 80, 0.6),
      coin(70, 86, 0.5),
      coin(172, 88, 0.52),
      g(2, 58, 62, 1.02, -24),
      g(4, 182, 62, 0.98, 22),
      g(1, 92, 54, 1.12, -10),
      g(3, 150, 54, 1.1, 12),
      g(5, 104, 80, 0.8, -30),
      g(4, 140, 82, 0.78, 26),
      g(0, 121, 42, 1.45, 0),
      K.P(K.sparkle(122, 8, 11), "#fff"),
      K.P(K.sparkle(44, 34, 8), "#fff"),
      K.P(K.sparkle(200, 36, 7), "#fff"),
    ];
    return K.svg(shapes, { vb: "0 0 240 100", sw: 2.6, rim: 2.2, cls: "ptmt-logo-pile" });
  }

  /** Grand logo du jeu. o : { id, rays (défaut true) }. */
  function full(o) {
    o = o || {};
    const id = "ptmtlogo" + (o.id || ++uid);
    const ink = "#3b1d08";
    const L1 = setLine("Pas touche à", 70, 400, 160, 10, false);
    const L2 = setLine("mes trésors", 132, 400, 336, 22, true);
    const sw = (px, L) => f1((2 * px) / L.s);
    let defs = "";
    defs += `<linearGradient id="${id}g" gradientUnits="userSpaceOnUse" x1="0" y1="-560" x2="0" y2="20"><stop offset="0" stop-color="#fffbd6"/><stop offset=".32" stop-color="#ffe45e"/><stop offset=".55" stop-color="#ffc21f"/><stop offset=".56" stop-color="#ffb316"/><stop offset="1" stop-color="#ef7a0a"/></linearGradient>`;
    defs += `<linearGradient id="${id}s" gradientUnits="userSpaceOnUse" x1="-300" y1="0" x2="-60" y2="-120"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".85"/><stop offset="1" stop-color="#fff" stop-opacity="0"/><animateTransform attributeName="gradientTransform" type="translate" values="0 0;1300 0;1300 0" keyTimes="0;.55;1" dur="4.5s" repeatCount="indefinite"/></linearGradient>`;
    defs += `<radialGradient id="${id}r" gradientUnits="userSpaceOnUse" cx="400" cy="262" r="330"><stop offset=".25" stop-color="#fff6c8" stop-opacity=".9"/><stop offset="1" stop-color="#fff6c8" stop-opacity="0"/></radialGradient>`;
    defs += `<g id="${id}a">${L1.paths}</g><g id="${id}b">${L2.paths}</g>`;
    defs += `<clipPath id="${id}c">${L2.paths}</clipPath>`;
    let body = "";
    if (o.rays !== false) body += `<g class="ptmt-logo-rays">${rays(400, 262, 400, 18, `url(#${id}r)`)}</g>`;
    body += `<g class="ptmt-logo-wheel">${wheel(400, 262, 196)}</g>`;
    // Berger-dragon qui veille derrière le ruban
    if (PTMT.towerPortraits) body += `<g class="ptmt-logo-dog">${nest(PTMT.towerPortraits.get("dog", 3), 322, 4, 156, 156)}</g>`;
    body += ribbon(212, 588, 104, 72, 10);
    // « Pas touche à » : lettres crème cernées de brun
    body += `<use href="#${id}a" transform="translate(0 4)" fill="${ink}" stroke="${ink}" stroke-width="${sw(6, L1)}" stroke-linejoin="round"/>`;
    body += `<use href="#${id}a" fill="${ink}" stroke="${ink}" stroke-width="${sw(6, L1)}" stroke-linejoin="round"/>`;
    body += `<use href="#${id}a" fill="#fff8e4"/>`;
    // Gardiens de part et d'autre
    if (K) {
      body += `<g class="ptmt-logo-boar">${nest(K.svg(K.boarHead(), { rim: 2.6 }), 96, 330, 150, 150)}</g>`;
      body += `<g class="ptmt-logo-swan">${nest(K.svg(K.swanHead(), { rim: 2.6 }), 578, 334, 162, 162)}</g>`;
    }
    // « mes trésors » : ombre, liseré clair, relief, contour, or biseauté, reflet
    body += `<use href="#${id}b" transform="translate(4 20)" fill="#2a1406" stroke="#2a1406" stroke-width="${sw(15, L2)}" stroke-linejoin="round" opacity=".35"/>`;
    body += `<use href="#${id}b" fill="#fff6dc" stroke="#fff6dc" stroke-width="${sw(15, L2)}" stroke-linejoin="round"/>`;
    body += `<use href="#${id}b" transform="translate(0 10)" fill="#7a3a0c" stroke="${ink}" stroke-width="${sw(9, L2)}" stroke-linejoin="round"/>`;
    body += `<use href="#${id}b" fill="${ink}" stroke="${ink}" stroke-width="${sw(9, L2)}" stroke-linejoin="round"/>`;
    body += `<g clip-path="url(#${id}c)"><rect x="0" y="150" width="800" height="240" fill="#fffbe0"/><use href="#${id}b" transform="translate(0 6)" fill="url(#${id}g)"/><rect x="0" y="150" width="800" height="240" fill="url(#${id}s)" class="ptmt-logo-shine"/></g>`;
    // Tas de gemmes qui déborde sous le titre
    body += `<g class="ptmt-logo-pile">${nest(gemPile(), 262, 358, 276, 115)}</g>`;
    // Étincelles
    const tw = (x, y, r, k) => `<path class="ptmt-twinkle" style="--k:${k}" d="${K ? K.sparkle(x, y, r) : ""}" fill="#fff" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/>`;
    body += tw(214, 246, 13, 0) + tw(598, 236, 11, 1) + tw(470, 482, 8, 2) + tw(60, 300, 10, 3) + tw(742, 262, 9, 4);
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" class="ptmt-logo" role="img" aria-label="Pas touche à mes trésors">` +
      `<defs>${defs}</defs>${body}</svg>`
    );
  }

  /** Emblème carré : roue à aubes en bois, rubis étincelant au centre, deux pièces d'or. */
  function emblem() {
    if (!K) return "";
    const { P, C, R, G, place, sparkle, gemShapes, coinShapes, GEMS } = K;
    const shapes = [];
    for (let k = 0; k < 12; k++) shapes.push(G(`rotate(${k * 30} 32 32)`, [R(27.5, 1.5, 9, 11, 2, "#9a6535")]));
    shapes.push(C(32, 32, 25, "#b07a45"));
    shapes.push(C(32, 32, 19.5, "#1f4d3a"));
    shapes.push(C(32, 32, 19.5, "none", { rim: false, w: 1.4, stroke: "#2f6b4f" }));
    shapes.push(place(coinShapes(), 18, 43, 0.36), place(coinShapes(), 46, 43, 0.36));
    shapes.push(place(gemShapes(GEMS[0]), 32, 31, 0.78));
    shapes.push(P(sparkle(46, 17, 6), "#fff"));
    return K.svg(shapes, { vb: 64, sw: 2.4, rim: 1.6, cls: "ptmt-emblem" });
  }

  PTMT.logo = { full, emblem };
})();
