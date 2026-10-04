// « Pas touche à mes trésors » — interface complète : écran titre, carte des missions, compétences,
// encyclopédie, HUD de partie (or, mana, gemmes par cachette, frise des vagues, vitesse, sorts), menu
// de construction et panneau de tour ancrés sur la carte, fiche d'ennemi, fiches « Nouvel ennemi ! »,
// annonces des surprises, victoire, défaite, pause, tutoriel de la première mission.
//
//   const ui = PTMT.ui.create({ root, mobile, progress: PTMT.progress, data: PTMT.sim.DATA, maps: PTMT.sim.MAPS,
//                              hooks: { playLevel(n), quitLevel(), restartLevel(), setQuality(q) facultatif } });
//   ui.showTitle() ; ui.showMap(n?) ; ui.showSkills() ; ui.showBestiary(tab?)
//   ui.enterLevel(game, view)   // HUD d'une partie ; view = { worldToScreen(x, y), showRange(id|null),
//                               //   preview(i, j, family|null), target(spell|null, x, y),
//                               //   selectEnemy(id|null) facultatif (anneau 3D sous l'ennemi suivi) }
//   ui.mapTap(hit) ; ui.mapHover(hit)      // hit = { i, j, x, y, screenX, screenY, towerId?, enemyId? } | null
//   ui.events(list) ; ui.frame(dt) ; ui.insets() → { top, bottom, left, right } ; ui.onResize()
//   ui.mode ("title" | "map" | "skills" | "bestiary" | "game") ; ui.busy (fiche ouverte) ;
//   ui.covered (écran opaque : la scène 3D derrière n'a pas besoin d'être dessinée)
//   ui.selectedEnemy (id de l'ennemi dont la fiche est ouverte, ou null)
//
// Côté simulation (v4) : vagues numérotées à partir de 0 (state.wave.index vaut -1 avant la
// première) ; game.upcoming(n) nourrit la frise (groupes avec entrée, lettre, couleur, vol, nage ;
// notes de surprise : marée, barrière, passage secret) ; game.enemyInfo(id) la fiche d'ennemi ;
// towerInfo(id) (attack "shot" | "charges" | "beam" | "cone", next / specs { A, B } et leur check { ok, reason })
// le panneau de tour, complété en direct par l'état de la tour (ammo, beams[].heat, cones[].heat, dazzled) ;
// game.buildCosts() le panneau des prix (prochaine tour de chaque famille : +20 or par tour posée) ;
// state.map.lairs (nom, décor, stock) et state.gems[].lair les gemmes par cachette ;
// state.spells[k] = { cost, unlocked, ready, active, left }. Les événements win / lose portent
// ev.record (résultat déjà enregistré par l'intégrateur : { firstWin, points, unlocked, best }) ;
// l'interface ne l'enregistre pas. newEnemy : la fiche ne s'ouvre que pour un type absent de
// progress.seen, puis markSeen + save. Derrière l'écran titre, une scène 3D (canvas dans [data-stage])
// reste visible : option showcase, sinon détection automatique ; sans scène, l'écran titre dessine
// son propre ciel.
//
// Frise des vagues (façon Cursed Treasure) : les prochaines vagues sont des blocs qui glissent vers
// le repère « maintenant » (numéro de vague N / total) au rythme du compte à rebours ; chaque bloc
// montre ses ennemis (portrait × nombre, couronne du champion, cadre du boss, lettres colorées des
// entrées, vol ou nage) et les surprises annoncées ; toucher le premier bloc appelle la vague (bonus
// d'or). Seules les positions bougent à chaque image (transform) ; un bloc n'est construit qu'une fois.
//
// Trois mises en page (attribut data-layout) : « desk » (ordinateur : bandeau haut, bandeau bas avec
// la frise à gauche, les sorts et la vitesse à droite, colonne des prix à droite de la carte),
// « portrait » (téléphone debout : bandeau haut sur quatre rangs dont les prix et la frise, menus en
// feuille au bas de l'écran), « landscape » (téléphone couché : deux colonnes à gauche et à droite,
// prix au bas de celle de gauche, frise en bas entre elles). Le HUD ne couvre que ces bandes
// (insets) ; menus et panneaux s'ouvrent par-dessus la carte. Le DOM n'est réécrit que quand une
// valeur affichée change. Le menu de construction, le panneau de tour et celui d'une case boisée
// arrêtent le temps tant qu'ils sont ouverts (pause automatique, reprise à la fermeture) ; une
// victoire mène à l'écran des compétences.
(function () {
  "use strict";
  const PTMT = (globalThis.PTMT = globalThis.PTMT || {});
  const NB = " "; // espace fine insécable (typographie française)

  /* ------------------------------------------------------------------ outils */
  // Typographie française : pas de retour à la ligne avant « : » ni à l'intérieur des guillemets.
  const fr = (t) => (/ [:!?;»]|« /.test(t) ? t.replace(/ :/g, "\u00a0:").replace(/ ([!?;])/g, "\u202f$1").replace(/« /g, "«\u00a0").replace(/ »/g, "\u00a0»") : t);
  const h = (tag, attrs, ...kids) => {
    const el = document.createElement(tag);
    if (attrs)
      for (const k in attrs) {
        const v = attrs[k];
        if (v === null || v === undefined || v === false) continue;
        if (k === "class") el.className = v;
        else if (k === "html") el.innerHTML = v;
        else if (k === "style") el.style.cssText = v;
        else if (k === "title" || k === "aria-label") el.setAttribute(k, fr(String(v)));
        else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? "" : v);
      }
    for (const kid of kids.flat(Infinity)) if (kid !== null && kid !== undefined && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(fr(String(kid))));
    return el;
  };
  const icons = () => PTMT.icons || { get: () => "" };
  /** Pastille d'icône (nom du jeu d'icônes, ou chaîne SVG déjà prête). */
  const ico = (name, cls) => h("span", { class: "pt-i" + (cls ? " " + cls : ""), html: name && name.startsWith("<") ? name : icons().get(name) });
  const nf = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, NB);
  const f1 = (v) => (Math.round(v * 10) / 10).toString().replace(".", ",");
  const pc = (v) => Math.round(v * 100) + NB + "%";
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
  const call = (obj, fn, ...args) => (obj && typeof obj[fn] === "function" ? obj[fn](...args) : undefined);
  const SPELLS = ["cut", "frenzy", "meteor"];
  const FAMS = ["boar", "swan", "dog"];
  const KEYS = { cut: "Q", frenzy: "W", meteor: "E" };
  // Teinte des portraits de secours (quand PTMT.portraits ne connaît pas le type).
  const TINT = {
    fermier: "#6f8f3a", quad: "#3f4f78", cowboy: "#a0602d", vache: "#3a3a3a", druide: "#cfd6c4", bigoudene: "#2a4c9a", chasseur: "#56733a", rugbyman: "#2a5cb8", sonneur: "#35508f", pompier: "#c8342a", canard: "#e8b820",
    cycliste: "#f2c21a", korrigan: "#7a4fc0", touriste: "#2fa3a0", tracteur: "#c8342a", montgolfiere: "#e8622f",
  };
  // Ennemis ajoutés par la v4 (pastille « Nouveau » de l'encyclopédie).
  const NEW_V4 = { cycliste: 1, korrigan: 1, touriste: 1, tracteur: 1, montgolfiere: 1 };
  const ABILITY = {
    lasso: (a) => ["lasso", "Lasso", `attrape une gemme tombée jusqu'à ${f1(a.range || 1.5)} case`],
    shield: (a) => ["shield", "Bouclier", `retire ${a.value || 5} dégâts à chaque coup`],
    barrier: (a) => ["barrier", "Bulle", `bulle de ${a.value || 100} PV qui se reforme`],
    heal: (a) => ["heal", "Soigneuse", `+${a.value || 30} PV à un allié toutes les ${a.every || 3} s`],
    smoke: (a) => ["smoke", "Fumigène", `invisible ${a.t || 5} s au premier coup`],
    evade: (a) => ["evade", "Esquive", `évite ${pc(a.chance || 0.5)} des projectiles et se dérobe au jet de feu (la chauffe retombe)`],
    haste: (a) => ["haste", "Biniou", `vitesse × ${a.mult || 2} pour les alliés proches`],
    immune: () => ["immune", "Immunisé", "aucun effet ne le touche"],
    swim: () => ["swim", "Nageur", "coupe par l'eau"],
    peloton: (a) => ["peloton", "Peloton", `+${pc((a.mult || 1.3) - 1)} de vitesse quand ils roulent groupés`],
    blink: (a) => ["blink", "Pouf !", `touché, réapparaît ${f1(a.dist || 1.8)} case plus loin (toutes les ${f1(a.every || 3.5)} s)`],
    flash: (a) => ["dazzle", "Flash", `éblouit la tour la plus proche : plus de tir pendant ${f1(a.t || 2)} s (toutes les ${a.every || 5} s)`],
    split: (a) => ["split", "Tracteur", `bouclier ${a.shield || 3} ; détruit, lâche ${a.value || 3} agriculteurs`],
    fly: () => ["fly", "Vol", "vole en ligne droite au-dessus de tout, jusqu'à la cachette la plus proche"],
  };
  /** « au moulin », « à la chapelle », « au vieux puits » : à + nom de cachette. */
  const aLair = (name) => (/^Le /.test(name) ? "au " + name.slice(3) : /^La /.test(name) ? "à la " + name.slice(3) : /^L'/.test(name) ? "à l'" + name.slice(2) : /^Les /.test(name) ? "aux " + name.slice(4) : "à " + name);
  const speedWord = (v) => (v < 0.8 ? "lent" : v > 1.25 ? "rapide" : "normal");
  const TERRAIN = { grass: "Herbe", rock: "Roche", water: "Eau", high: "Butte", road: "Chemin", bridge: "Pont", decor: "Talus", thicket: "Fourré", lair: "Cachette", tide: "Estran", gate: "Barrière" };
  // Façons d'attaquer des tours : icône, nom, explication courte.
  const ATTACK = {
    shot: { icon: "shot", name: "Tir", text: "Une bogue après l'autre, sur une cible." },
    charges: { icon: "charges", name: "Charges", text: "Lâche ses boules d'un coup, puis les recharge une à une." },
    beam: { icon: "beam", name: "Jet de feu", text: "Brûle sans arrêt : plus il tient sa cible, plus ça chauffe." },
    cone: { icon: "burn", name: "Cône de flammes", text: "Brûle tout ce qui se trouve devant lui ; plus il souffle, plus ça chauffe." },
  };
  /** Façon d'attaquer d'une tour, précisée par sa spécialisation (le mode seul ne dit pas tout). */
  const attackOf = (mode, st) => {
    st = st || {};
    if (mode === "shot" && (st.multi || 1) > 1) return { icon: "shot", name: "Tir multiple", text: `${st.multi} bogues à la fois, sur ${st.multi} ennemis différents.` };
    if (mode === "shot" && st.splash) return { icon: "splash", name: "Tir en cloche", text: "Une grosse châtaigne qui explose sur tout un groupe." };
    if (mode === "charges" && st.nova) return { icon: "freeze", name: "Onde de glace", text: "Chaque boule part en onde de glace autour du nid : tous les ennemis à portée sont touchés." };
    if (mode === "charges" && st.volley) return { icon: "charges", name: "Salve", text: "Lâche toutes ses boules d'un coup, chacune sur un ennemi différent." };
    if (mode === "beam" && st.chain) {
      const n = st.chain.count || 1;
      return { icon: "beam", name: "Jet qui rebondit", text: `Brûle sans arrêt et rebondit sur ${n > 1 ? n + " ennemis proches" : "un second ennemi"}.` };
    }
    if (mode === "cone" && (st.beams || 1) > 1) return { icon: "burn", name: "Deux cônes de flammes", text: "Deux têtes : deux cônes qui brûlent tout ce qui est devant eux." };
    return ATTACK[mode] || ATTACK.shot;
  };
  // Surprises annoncées par la frise (icône, mot court).
  const NOTE = {
    tideLow: { icon: "tideLow", word: "Marée basse", tip: "Marée basse : l'estran devient un chemin" },
    tideHigh: { icon: "tideHigh", word: "Marée haute", tip: "Marée haute : l'estran redevient de l'eau (seuls les nageurs y passent)" },
    gate: { icon: "gate", word: "Barrière", tip: "La barrière cède : une nouvelle entrée s'ouvre" },
    secret: { icon: "secret", word: "Passage secret", tip: "Un passage secret s'ouvre dans le fourré" },
  };
  // Effets en cours sur un ennemi (clés de enemy.fx) : nom court.
  const FX = { slow: "Ralenti", freeze: "Gelé", fear: "Apeuré", burn: "Brûle", radiance: "Rayonne", stun: "Étourdi", haste: "Pressé", invisible: "Invisible", disarmed: "Désarmé", wading: "Patauge" };

  /* ------------------------------------------------------------------ l'interface */
  function UI(o) {
    this.o = o || {};
    const root = this.o.root || document.body;
    this.host = (root.querySelector && root.querySelector("[data-ui]")) || root;
    this.hooks = this.o.hooks || {};
    this.mobile = !!this.o.mobile;
    this.mode = null;
    this.game = null;
    this.view = null;
    this.t = 0;
    this.last = Object.create(null);
    this.sel = null;
    this.aim = null;
    this.modal = null;
    this.modalQueue = [];
    this.flyCount = 0;
    this.buildSkeleton();
    this.bindKeys();
    this.onResize();
  }
  const P = UI.prototype;

  // Données (lues à la demande : l'intégrateur peut les fournir après coup).
  P.D = function () {
    return this.o.data || (PTMT.sim && PTMT.sim.DATA) || {};
  };
  P.maps = function () {
    return this.o.maps || (PTMT.sim && PTMT.sim.MAPS) || {};
  };
  P.prog = function () {
    return this.o.progress || PTMT.progress || null;
  };
  P.loadP = function () {
    const pr = this.prog();
    try {
      return (pr && pr.load()) || { levels: {}, unlocked: 1, skills: {}, seen: {}, settings: {} };
    } catch (e) {
      return { levels: {}, unlocked: 1, skills: {}, seen: {}, settings: {} };
    }
  };
  P.saveP = function (p) {
    const pr = this.prog();
    if (pr) call(pr, "save", p);
  };
  P.missionCount = function () {
    const m = this.maps();
    let n = 0;
    for (let k = 1; k <= 30; k++) if (m[k]) n = k;
    return n || 15;
  };

  /* ------------------------------------------------------------------ squelette */
  P.buildSkeleton = function () {
    this.el = h("div", { class: "pt", "data-mode": "none" });
    this.screens = h("div", { class: "pt-screens" });
    this.hud = h("div", { class: "pt-hud", hidden: true });
    this.popLayer = h("div", { class: "pt-pops" });
    this.bannerLayer = h("div", { class: "pt-banners" });
    this.toastLayer = h("div", { class: "pt-toasts", role: "status", "aria-live": "polite" });
    this.modalLayer = h("div", { class: "pt-modals" });
    this.el.append(this.screens, this.hud, this.popLayer, this.bannerLayer, this.toastLayer, this.modalLayer);
    this.host.append(this.el);
    this.buildHud();
  };

  P.buildHud = function () {
    const I = icons();
    // Bandeau du haut : menu, or, mana, gemmes par cachette | mission.
    this.topEl = h("header", { class: "pt-top" });
    this.btnMenu = h("button", { class: "pt-btn pt-sq pt-menu", title: "Menu et pause (Échap)", "aria-label": "Menu", onclick: () => this.openPause() }, ico("menu"));
    this.goldNum = h("b", { class: "pt-num" }, "0");
    this.goldEl = h("div", { class: "pt-res pt-gold", title: "Or : primes des ennemis vaincus" }, ico("gold"), this.goldNum);
    this.manaFill = h("i", { class: "pt-gauge-fill" });
    this.manaNum = h("b", { class: "pt-num" }, "0");
    this.manaEl = h("div", { class: "pt-res pt-mana", title: "Mana : se recharge avec le temps" }, ico("mana"), h("div", { class: "pt-gauge" }, this.manaFill, h("i", { class: "pt-gauge-shine" }), this.manaNum));
    this.gemsEl = h("div", { class: "pt-res pt-gems", title: "Gemmes de chaque cachette : à l'abri, tombées au sol, emportées, perdues" });
    this.missionEl = h("div", { class: "pt-mission" });
    this.topEl.append(this.btnMenu, this.goldEl, this.manaEl, this.gemsEl, h("div", { class: "pt-sp" }), this.missionEl);
    // Frise des vagues : placée selon la mise en page (bandeau du bas, du haut, ou bande à part).
    this.buildFrieze();
    // Bandeau du bas : (frise), sorts, vitesse et pause.
    this.bottomEl = h("footer", { class: "pt-bottom" });
    this.spellsEl = h("div", { class: "pt-spells" });
    this.spellBtn = {};
    for (const k of SPELLS) {
      const cost = h("b", { class: "pt-num" }, "");
      const b = h(
        "button",
        { class: "pt-spell", "data-spell": k, onclick: () => this.spellClick(k), onpointerenter: () => this.spellHint(k, true), onpointerleave: () => this.spellHint(k, false) },
        h("span", { class: "pt-spell-ring" }),
        h("span", { class: "pt-spell-face", html: I.get(k) }),
        h("span", { class: "pt-spell-lock", html: I.get("lock") }),
        h("span", { class: "pt-spell-cost" }, ico("mana"), cost),
        h("kbd", {}, KEYS[k]),
      );
      b._cost = cost;
      this.spellBtn[k] = b;
      this.spellsEl.append(b);
    }
    this.speedBtns = [1, 2, 3].map((v) => h("button", { class: "pt-btn pt-speed-b", "data-v": v, title: `Vitesse × ${v} (touche ${v})`, "aria-label": `Vitesse ${v}`, onclick: () => this.setSpeed(v) }, ico("speed" + v), h("b", { class: "pt-num" }, "×" + v)));
    this.pauseBtn = h("button", { class: "pt-btn pt-sq pt-pause", title: "Pause (Espace)", "aria-label": "Pause", onclick: () => this.togglePause() }, ico("pause"));
    // Sur téléphone : un seul bouton qui fait défiler × 1 → × 2 → × 3 (cible tactile assez grande).
    this.speedCycle = h("button", { class: "pt-btn pt-sq pt-speed-c", title: "Vitesse", "aria-label": "Changer de vitesse", onclick: () => this.setSpeed(((this.game && this.game.state.speed) || 1) % 3 + 1) }, h("span", { class: "pt-speed-ci" }), h("b", { class: "pt-num" }, "×1"));
    this.speedEl = h("div", { class: "pt-speed" }, h("div", { class: "pt-seg" }, this.speedBtns), this.speedCycle, this.pauseBtn);
    this.bottomEl.append(this.spellsEl, this.speedEl);
    this.marksEl = h("div", { class: "pt-marks" });
    this.ringEl = h("div", { class: "pt-ering", hidden: true }, h("i", {}));
    this.flyEl = h("div", { class: "pt-fly" });
    this.hud.append(this.ringEl, this.marksEl, this.flyEl, this.topEl, this.bottomEl);
    this.buildPrices();
  };

  /* ------------------------------------------------------------------ prix des gardiens */
  // Façon Cursed Treasure : le prix de la prochaine tour de chaque famille, qui monte de 20 or à
  // chaque tour posée (et redescend quand on en revend une). Colonne à droite de la carte sur
  // ordinateur (hors de la zone de jeu : la caméra cadre la carte à sa gauche), rangée compacte sous
  // le bandeau sur téléphone debout, bas de la colonne de gauche sur téléphone couché.
  P.buildPrices = function () {
    const D = this.D();
    const TP = PTMT.towerPortraits;
    const step = (D.economy && D.economy.towerStep) || 0;
    this.priceCards = {};
    const list = h("div", { class: "pt-prices-l" });
    for (const f of FAMS) {
      const F = D.FAMILIES && D.FAMILIES[f];
      if (!F) continue;
      const num = h("b", { class: "pt-num" }, "");
      const card = h(
        "div",
        { class: "pt-pc", "data-f": f },
        h("span", { class: "pt-tp", "data-f": f, html: TP ? TP.get(f, 1) : "" }),
        h("span", { class: "pt-pc-t" }, h("b", {}, (D.BRANCHES && D.BRANCHES[f] && D.BRANCHES[f].name) || F.name), h("small", {}, ico(F.terrain), TERRAIN[F.terrain] || "")),
        h("span", { class: "pt-price" }, ico("gold"), num),
      );
      card._num = num;
      this.priceCards[f] = card;
      list.append(card);
    }
    this.pricesEl = h("aside", { class: "pt-prices", "aria-label": "Prix des gardiens" }, h("div", { class: "pt-prices-h" }, h("b", {}, "Gardiens"), step ? h("small", {}, "+" + step + NB + "or par tour posée") : null), list);
    this.hud.append(this.pricesEl);
  };
  /** Range le panneau des prix selon la mise en page. */
  P.placePricesHost = function () {
    if (!this.pricesEl) return;
    const host = this.layout === "desk" ? this.hud : this.topEl;
    if (this.pricesEl.parentNode !== host) host.append(this.pricesEl);
  };
  /** Prix à jour (chaque image, écrit seulement quand un prix ou « assez d'or » change). */
  P.updatePrices = function (s) {
    if (!this.pricesEl || !this.priceCards) return;
    const costs = call(this.game, "buildCosts");
    if (!costs) return;
    const D = this.D();
    const step = (D.economy && D.economy.towerStep) || 0;
    const g = Math.floor(s.gold);
    for (const f of FAMS) {
      const card = this.priceCards[f];
      const c = costs[f];
      if (!card || c === null || c === undefined) continue;
      this.put("price:" + f, c + (c > g ? "p" : ""), (v, old) => {
        const before = old !== undefined ? parseInt(old, 10) : c;
        card._num.textContent = String(c);
        card.classList.toggle("poor", c > g);
        const F = D.FAMILIES[f];
        card.title = fr(`${F.name} : ${c} or pour le prochain (${(TERRAIN[F.terrain] || "").toLowerCase()} ou butte). Chaque tour posée rend la suivante ${step} or plus chère ; en revendre une fait baisser le prix.` + (c > g ? ` Il manque ${c - g} or.` : ""));
        if (before !== c) this.bump(card, c > before ? "bad" : "good");
      });
    }
  };

  /* ------------------------------------------------------------------ frise des vagues */
  P.buildFrieze = function () {
    this.fzN = h("b", { class: "pt-num" }, "0");
    this.fzTot = h("span", { class: "pt-num" }, "/" + NB + "0");
    this.fzNow = h("div", { class: "pt-fz-now", title: "Vague en cours" }, h("small", {}, "Vague"), h("span", { class: "pt-fz-nt" }, this.fzN, this.fzTot));
    this.fzTrack = h("div", { class: "pt-fz-track" });
    this.fzMsg = h("div", { class: "pt-fz-msg" });
    this.fzEl = h("section", { class: "pt-fz", "aria-label": "Vagues à venir" }, this.fzNow, h("div", { class: "pt-fz-rail" }, this.fzTrack, this.fzMsg));
    this.fzBlocks = [];
  };
  /** Range la frise selon la mise en page : bandeau du bas (ordinateur), du haut (téléphone debout), bande à part (couché). */
  P.placeFriezeHost = function () {
    const host = this.layout === "portrait" ? this.topEl : this.layout === "landscape" ? this.hud : this.bottomEl;
    if (this.fzEl.parentNode !== host) {
      if (host === this.bottomEl) host.insertBefore(this.fzEl, host.firstChild);
      else host.append(this.fzEl);
    }
    this.fzK = null;
    for (const b of this.fzBlocks) b.w = 0;
  };
  /** Unités de la frise : groupes d'un même ennemi (et rang) réunis, quelle que soit l'entrée. */
  const mergeUnits = (groups) => {
    const map = new Map();
    for (const g of groups || []) {
      const k = g.type + (g.boss ? "!" : g.champion ? "*" : "");
      let u = map.get(k);
      if (!u) map.set(k, (u = { type: g.type, champion: !!g.champion, boss: !!g.boss, name: g.name || null, count: 0, ents: [], flying: !!g.flying, swims: !!g.swims }));
      u.count += g.count || 0;
      if (g.letter && !u.ents.some((e) => e.letter === g.letter)) u.ents.push({ entrance: g.entrance, letter: g.letter, color: g.color || "#3f9be8" });
    }
    const list = [...map.values()];
    for (const u of list) u.ents.sort((a, b) => (a.letter < b.letter ? -1 : 1));
    // Boss d'abord, puis les groupes ordinaires (les plus nombreux en tête), puis les champions.
    return list.sort((a, b) => b.boss - a.boss || a.champion - b.champion || b.count - a.count);
  };
  P.entranceById = function (id) {
    const all = (this.game && this.game.state.map && this.game.state.map.entrances) || [];
    return all.find((e) => e.id === id) || null;
  };
  /** Une unité : portrait × nombre, entrées (lettres colorées), vol ou nage. */
  P.fzUnit = function (u, multi) {
    const D = this.D();
    const E = (D.ENEMIES && D.ENEMIES[u.type]) || {};
    const nm = u.boss ? u.name || (D.BOSS_NAMES && D.BOSS_NAMES[u.type]) || "Boss" : (u.champion ? "Champion : " : "") + (E.name || u.type);
    const letters = u.ents.map((e) => e.letter).join(", ");
    const tip = nm + (u.boss ? "" : " × " + u.count) + (multi && letters ? " · entrée" + (u.ents.length > 1 ? "s " : " ") + letters : "") + (u.flying ? " · vole droit vers les gemmes" : u.swims ? " · coupe par l'eau" : "");
    return h(
      "span",
      { class: "pt-fz-u" + (u.boss ? " boss" : u.champion ? " champ" : ""), title: tip },
      this.enemyPortrait(u.type, u.champion, u.boss),
      u.boss && u.count <= 1 ? null : h("b", { class: "pt-num pt-fz-c" }, "×" + u.count),
      u.flying ? h("span", { class: "pt-fz-m", title: "Vole", html: icons().get("fly") }) : u.swims ? h("span", { class: "pt-fz-m", title: "Nage", html: icons().get("swim") } ) : null,
      multi && u.ents.length ? h("span", { class: "pt-fz-e" }, u.ents.map((e) => h("i", { style: `--gc:${e.color}` }, e.letter))) : null,
    );
  };
  /** Une surprise annoncée : icône et mot court (barrière : lettre de l'entrée qui s'ouvre). */
  P.fzNote = function (n) {
    const N = NOTE[n.kind] || { icon: "warning", word: n.kind, tip: "" };
    const ent = n.entrance !== undefined ? this.entranceById(n.entrance) : null;
    const letter = n.letter || (ent && ent.letter) || "";
    const color = (ent && ent.color) || "#a06bff";
    return h(
      "span",
      { class: "pt-fz-note", "data-k": n.kind, title: N.tip + (letter ? " (entrée " + letter + ")" : "") },
      ico(N.icon),
      h("small", {}, N.word, letter ? h("i", { style: `--gc:${color}` }, letter) : null),
    );
  };
  /** Bloc d'une vague. Le premier est un bouton : il appelle la vague (bonus d'or). */
  P.fzBlock = function (w, first, multi) {
    const units = mergeUnits(w.groups);
    const max = this.layout === "desk" ? 5 : 4;
    const notes = w.notes || [];
    const kids = [];
    const cd = first ? h("i", { class: "pt-num pt-fz-cd" }, "") : null;
    kids.push(h("span", { class: "pt-fz-h" }, h("b", { class: "pt-num" }, String(w.index + 1)), cd));
    const body = h("span", { class: "pt-fz-body" });
    for (const u of units.slice(0, max)) body.append(this.fzUnit(u, multi));
    if (units.length > max) body.append(h("span", { class: "pt-fz-more pt-num", title: units.slice(max).map((u) => u.type).join(", ") }, "+" + (units.length - max)));
    for (const n of notes) body.append(this.fzNote(n));
    kids.push(body);
    const bonus = first ? h("b", { class: "pt-num" }, "+0") : null;
    if (first) kids.push(h("span", { class: "pt-fz-call" }, ico("horn"), bonus));
    // les ennemis deviennent plus résistants de vague en vague : PV × … (dès × 1,1)
    if (w.hpMul >= 1.1) kids.push(h("span", { class: "pt-fz-hp pt-num", title: fr(`Ennemis plus résistants : PV × ${f1(w.hpMul)}`) }, "PV×" + f1(w.hpMul)));
    const boss = units.some((u) => u.boss);
    const cls = "pt-fz-b" + (first ? " first" : "") + (boss ? " boss" : "") + (notes.length ? " surprise" : "") + (multi ? " multi" : "");
    const el = first
      ? h("button", { class: cls, "data-w": w.index + 1, title: `Appeler la vague ${w.index + 1} maintenant (Entrée) : bonus d'or`, onclick: () => this.callWave() }, kids)
      : h("div", { class: cls, "data-w": w.index + 1 }, kids);
    return { el, cd, bonus };
  };
  /** Liste des vagues à venir (simulation v4, sinon repli sur nextWave). */
  P.upcomingList = function (s) {
    if (s.over) return [];
    const w = s.wave || {};
    let list = call(this.game, "upcoming", 5);
    if (!Array.isArray(list)) {
      const nw = call(this.game, "nextWave");
      list = nw && nw.groups ? [Object.assign({ startsIn: Math.max(0, nw.countdown || 0), notes: [] }, nw)] : [];
    }
    return w.total ? list.filter((x) => x.index < w.total) : list;
  };
  /** Structure de la frise (quelques fois par seconde) : blocs ajoutés, remplacés, entrés en jeu. */
  P.refreshFrieze = function (s) {
    const w = s.wave || {};
    const total = w.total || 0;
    const index = typeof w.index === "number" ? w.index : -1;
    const cur = clamp(index + 1, 0, total);
    this.put("fzNow", cur + "/" + total, (v, old) => {
      this.fzN.textContent = String(cur);
      this.fzTot.textContent = "/" + NB + (total || "?");
      this.fzNow.classList.toggle("last", !!total && cur >= total);
      if (old !== undefined) this.bump(this.fzNow, "good");
    });
    const list = this.upcomingList(s);
    this.nextInfo = list[0] || null;
    const multi = ((s.map && s.map.entrances) || []).length > 1;
    const cd0 = Math.max(0, w.countdown || 0);
    const keep = [];
    list.forEach((x, k) => {
      const first = k === 0;
      const key = x.index + (first ? "f" : "") + ":" + (x.groups || []).map((g) => g.type + (g.champion ? "*" : "") + (g.boss ? "!" : "") + g.count + (g.letter || "")).join(",") + ":" + (x.notes || []).map((n) => n.kind + (n.letter || n.entrance || "")).join(",") + ":" + this.layout + (multi ? "m" : "");
      let b = this.fzBlocks.find((o) => o.index === x.index);
      if (!b || b.key !== key) {
        const made = this.fzBlock(x, first, multi);
        if (b) {
          b.el.replaceWith(made.el);
          if (b.px !== undefined) made.el.style.transform = `translate3d(${b.px}px,0,0)`;
        } else this.fzTrack.append(made.el);
        b = Object.assign(b || { index: x.index }, made, { key, w: 0, cdTxt: null, bonusV: null });
      }
      b.off = Math.max(0, (x.startsIn || 0) - cd0);
      keep.push(b);
    });
    for (const b of this.fzBlocks) if (!keep.includes(b)) this.fzDrop(b, b.index <= index);
    this.fzBlocks = keep;
    const msg = s.over ? (s.over.win ? "Victoire !" : "Défaite…") : !list.length && total ? (cur >= total ? "Dernière vague !" : "") : "";
    this.put("fzMsg", msg, (v) => {
      this.fzMsg.textContent = v;
      this.fzEl.classList.toggle("done", !!v);
    });
    // Repères d'entrée de la prochaine vague
    const nk = list[0] ? list[0].index + ":" + (list[0].entrances || []).join(",") + ":" + ((s.map && s.map.entrances) || []).map((e) => (e.open ? 1 : 0)).join("") : "none";
    this.put("marksKey", nk, () => this.buildMarks(list[0] || null));
  };
  /** Bloc parti : la vague a commencé (il plonge dans le repère) ou il sort de la liste. */
  P.fzDrop = function (b, entered) {
    if (!entered) return b.el.remove();
    b.el.classList.add("pt-fz-in");
    b.el.style.transform = "translate3d(0px,0,0)";
    setTimeout(() => b.el.remove(), 450);
  };
  /** Positions (chaque image) : le premier bloc approche du repère au rythme du compte à rebours. */
  P.placeFrieze = function (s, dt) {
    const blocks = this.fzBlocks;
    if (!blocks.length) return;
    const D = this.D();
    const w = s.wave || {};
    const cd = Math.max(0, w.countdown || 0);
    if (!this.fzK) {
      const eco = D.economy || {};
      const gap = (s.level >= 8 ? eco.waveGapLate : eco.waveGap) || 24;
      const tw = this.fzTrack.clientWidth || 300;
      this.fzK = clamp((tw - 24) / (gap * 4.2), 2.2, 7);
    }
    const k = this.fzK;
    const GAP = this.layout === "desk" ? 10 : 6;
    let end = -Infinity;
    for (const b of blocks) {
      if (!b.w) b.w = b.el.offsetWidth || 80;
      let x = (cd + b.off) * k;
      if (x < end + GAP) x = end + GAP;
      end = x + b.w;
      if (b.x === undefined) b.x = x;
      else {
        const d = x - b.x;
        b.x = Math.abs(d) < 0.6 ? x : b.x + d * Math.min(1, dt * 7);
      }
      const px = Math.round(b.x * 2) / 2;
      if (px !== b.px) {
        b.px = px;
        b.el.style.transform = `translate3d(${px}px,0,0)`;
      }
    }
    // Compte à rebours et bonus d'appel du premier bloc
    const f = blocks[0];
    if (f.cd) {
      const c = Math.ceil(cd);
      const t = c > 0 ? c + NB + "s" : "";
      if (f.cdTxt !== t) {
        f.cdTxt = t;
        f.cd.textContent = t;
        f.el.classList.toggle("pt-hot", c > 0 && c <= 5);
      }
      const bonus = Math.max(0, Math.floor(cd * ((D.economy && D.economy.earlyCallGoldPerSecond) || 1)));
      if (f.bonusV !== bonus) {
        f.bonusV = bonus;
        f.bonus.textContent = "+" + bonus;
        f.el.setAttribute("aria-label", `Appeler la vague ${f.index + 1} maintenant : ${bonus} or de bonus`);
      }
    }
  };

  /* ------------------------------------------------------------------ mise en page */
  P.onResize = function () {
    const W = window.innerWidth,
      H = window.innerHeight;
    let layout = "desk";
    if (W < H * 0.92) layout = "portrait";
    else if (H < 540) layout = "landscape";
    const changed = layout !== this.layout;
    this.layout = layout;
    this.el.dataset.layout = layout;
    this.el.classList.toggle("pt-narrow", W < 1100);
    this.el.classList.toggle("pt-tiny", Math.min(W, H) < 380);
    this.el.classList.toggle("pt-touch", this.mobile);
    this._insets = null;
    this.fzK = null;
    if (changed || (this.pricesEl && !this.pricesEl.parentNode)) this.placePricesHost();
    if (changed) {
      this.last.mana = null;
      this.last.fzNow = undefined;
      this.placeFriezeHost();
      // Les blocs de la frise se reconstruisent à la taille de la nouvelle mise en page.
      for (const b of this.fzBlocks) b.key = null;
      if (this.tuto) this.tuto.placed = null;
      if (this.marks) for (const m of this.marks) m.tr = null;
    }
    if (changed && this.mode === "map") this.showMap(this.mapSel);
    if (this.mode === "game") this.insets();
    if (this.sel) this.placeSel(true);
    if (this.tuto) this.placeTuto();
  };
  P.insets = function () {
    if (this.mode !== "game" || this.hud.hidden) return { top: 0, bottom: 0, left: 0, right: 0 };
    if (this._insets) return this._insets;
    const W = window.innerWidth,
      H = window.innerHeight;
    const a = this.topEl.getBoundingClientRect(),
      b = this.bottomEl.getBoundingClientRect();
    const st = this.el.style;
    if (this.layout === "landscape") {
      // Deux colonnes ; la frise court en bas, entre elles.
      this._insets = { top: 0, bottom: 0, left: Math.ceil(a.right), right: Math.ceil(W - b.left) };
      st.setProperty("--pt-left", this._insets.left + "px");
      st.setProperty("--pt-right", this._insets.right + "px");
      this._insets.bottom = Math.ceil(H - this.fzEl.getBoundingClientRect().top);
    } else this._insets = { top: Math.ceil(a.bottom), bottom: Math.ceil(H - b.top), left: 0, right: 0 };
    // Ordinateur : la colonne des prix borde la carte à droite (la caméra cadre la carte à sa gauche).
    if (this.layout === "desk" && this.pricesEl && this.pricesEl.parentNode === this.hud) {
      const r = this.pricesEl.getBoundingClientRect();
      if (r.width > 0) this._insets.right = Math.ceil(W - r.left + 4);
    }
    st.setProperty("--pt-top", this._insets.top + "px");
    st.setProperty("--pt-bottom", this._insets.bottom + "px");
    st.setProperty("--pt-left", this._insets.left + "px");
    st.setProperty("--pt-right", this._insets.right + "px");
    return this._insets;
  };

  /* ------------------------------------------------------------------ modes et écrans */
  P.setMode = function (mode) {
    if (this.mode === "game" && mode !== "game") this.leaveLevel(true);
    this.mode = mode;
    this.el.dataset.mode = mode;
    this.hud.hidden = mode !== "game";
    this._insets = null;
    this.el.classList.toggle("pt-vitrine", this.hasStage());
  };
  /** Une scène 3D est-elle affichée derrière l'interface (vitrine de l'écran titre) ? */
  P.hasStage = function () {
    if (this.o.showcase !== undefined) return !!this.o.showcase;
    const doc = this.host.ownerDocument || document;
    return !!doc.querySelector("[data-stage] canvas");
  };
  P.setScreen = function (el) {
    this.screens.textContent = "";
    this.closeModal(true);
    if (el) {
      this.screens.append(el);
      el.classList.add("pt-in");
    }
  };
  /** Bouton de retour + titre d'un écran. */
  P.screenHead = function (title, back, extra) {
    return h(
      "header",
      { class: "pt-shead" },
      back ? h("button", { class: "pt-btn pt-sq pt-wood", title: "Retour", "aria-label": "Retour", onclick: back }, ico("back")) : h("span", { class: "pt-shead-sp" }),
      PTMT.logo ? h("span", { class: "pt-shead-logo", "aria-hidden": "true", html: PTMT.logo.emblem() }) : null,
      h("h1", { class: "pt-shead-t" }, title),
      h("div", { class: "pt-shead-x" }, extra || null),
    );
  };

  // ── Écran titre ──────────────────────────────────────────────────────────
  P.showTitle = function () {
    this.setMode("title");
    const p = this.loadP();
    const started = Object.values(p.levels || {}).some((l) => l && l.won);
    const logo = PTMT.logo ? PTMT.logo.full() : "<h1>Pas touche à mes trésors</h1>";
    const sc = h(
      "section",
      { class: "pt-screen pt-title" },
      this.scenery(),
      h("div", { class: "pt-title-logo", html: logo }),
      h(
        "div",
        { class: "pt-title-btns" },
        h("button", { class: "pt-btn pt-go pt-big pt-pulse", onclick: () => this.showMap() }, ico("play"), started ? "Continuer" : "Jouer"),
        h(
          "div",
          { class: "pt-row" },
          h("button", { class: "pt-btn pt-wood", onclick: () => this.showSkills() }, ico("skills"), "Compétences", this.pointsBadge(p)),
          h("button", { class: "pt-btn pt-wood", onclick: () => this.showBestiary() }, ico("book"), "Encyclopédie"),
        ),
      ),
      h("footer", { class: "pt-credits" }, "Moulin de Saint-Christophe", h("span", {}, " · "), "lettres Lilita One (SIL OFL)"),
    );
    this.setScreen(sc);
  };
  /** Décor de fond (ciel, collines bocagères) partagé par les écrans. */
  P.scenery = function () {
    const tree = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#3f8f3a" stroke="#1f4a24" stroke-width="3"/><circle cx="${x - r * 0.3}" cy="${y - r * 0.35}" r="${r * 0.35}" fill="#6cc24a"/>`;
    let trees = "";
    const T = [
      [70, 318, 22], [120, 330, 16], [300, 300, 18], [540, 318, 20], [590, 326, 14], [860, 296, 22], [910, 312, 16], [1180, 318, 20], [1240, 328, 14], [1400, 300, 18],
    ];
    for (const t of T) trees += tree(t[0], t[1], t[2]);
    return h("div", {
      class: "pt-scenery",
      "aria-hidden": "true",
      html:
        `<svg viewBox="0 0 1440 420" preserveAspectRatio="xMidYMax slice">` +
        `<path d="M0 250Q180 170 380 230T760 215T1130 200T1440 230V420H0Z" fill="#8fcf6a"/>` +
        `<path d="M0 300Q220 250 460 292T940 280T1440 290V420H0Z" fill="#5fae45"/>` +
        `<path d="M0 290Q220 240 460 282T940 270T1440 280" fill="none" stroke="#2f6b2a" stroke-width="5" stroke-dasharray="2 14" stroke-linecap="round"/>` +
        trees +
        `<path d="M0 352Q260 320 520 350T1040 346T1440 350V420H0Z" fill="#4a9a3a"/>` +
        `<path d="M0 382Q300 356 700 384T1440 380V420H0Z" fill="#3c8531"/>` +
        `</svg>`,
    });
  };
  P.pointsBadge = function (p) {
    const pr = this.prog();
    const free = pr ? call(pr, "pointsFree", p) : 0;
    return free > 0 ? h("span", { class: "pt-badge", title: "Points de compétence à placer" }, String(free)) : null;
  };

  // ── Carte des missions ───────────────────────────────────────────────────
  // Positions des 15 médaillons (repère paysage 1000 × 600), du bocage (1) au moulin (15).
  // Serpentin sur trois rangs : il se lit aussi bien couché (ordinateur) que debout (téléphone, carte tournée).
  const SPOTS = [
    [95, 515], [220, 478], [345, 515], [470, 478], [595, 512], [712, 448], [640, 345], [515, 316], [390, 350], [262, 318], [150, 245], [250, 160], [388, 192], [530, 156], [786, 196],
  ];
  P.showMap = function (focus) {
    this.setMode("map");
    const p = this.loadP();
    const maps = this.maps();
    const n = this.missionCount();
    const unlocked = clamp(p.unlocked || 1, 1, n);
    if (focus > unlocked) focus = unlocked;
    if (!focus) {
      focus = unlocked;
      for (let k = 1; k <= unlocked; k++)
        if (!(p.levels[k] && p.levels[k].won)) {
          focus = k;
          break;
        }
    }
    this.mapSel = focus;
    const portrait = this.layout === "portrait";
    const pos = (k) => {
      const [x, y] = SPOTS[(k - 1) % SPOTS.length];
      return portrait ? [y / 600, (1000 - x) / 1000] : [x / 1000, y / 600];
    };
    const world = h("div", { class: "pt-wm" + (portrait ? " pt-wm-v" : ""), html: this.worldSvg(portrait, n) });
    const medals = [];
    // Mission que la dernière victoire vient d'ouvrir : médaillon qui se déverrouille sous les yeux.
    const fresh = this.justUnlocked || 0;
    this.justUnlocked = 0;
    for (let k = 1; k <= n; k++) {
      const L = (p.levels && p.levels[k]) || null;
      const locked = k > unlocked;
      const [u, v] = pos(k);
      const m = maps[k] || { name: "Mission " + k, gems: 5 };
      const gems = L && L.won ? L.bestGems || 0 : 0;
      const total = (L && L.gemsTotal) || m.gems || 5;
      const med = h(
        "button",
        {
          class: "pt-medal" + (locked ? " locked" : "") + (L && L.won ? " won" : "") + (L && L.brilliant ? " brilliant" : "") + (k === focus ? " sel" : "") + (!locked && !(L && L.won) ? " next" : "") + (k === fresh && !locked ? " fresh" : ""),
          style: `left:${(u * 100).toFixed(2)}%;top:${(v * 100).toFixed(2)}%`,
          title: locked ? "Mission verrouillée" : m.name,
          "aria-label": `Mission ${k} : ${m.name}`,
          onclick: () => (locked ? this.refuse(med, "Gagne la mission " + (k - 1) + " pour ouvrir celle-ci") : this.selectMission(k)),
        },
        h("span", { class: "pt-medal-c" }, locked ? ico("lock") : h("b", { class: "pt-num" }, String(k))),
        L && L.brilliant ? h("span", { class: "pt-medal-crown", html: icons().get("crown") }) : null,
        L && L.won ? h("span", { class: "pt-medal-gems" }, ico(icons().gem(0, "lair")), h("b", { class: "pt-num" }, gems + "/" + total)) : null,
      );
      medals.push(med);
      world.append(med);
    }
    this.medals = medals;
    const pr = this.prog();
    const free = pr ? call(pr, "pointsFree", p) || 0 : 0;
    const head = this.screenHead("Les missions", () => this.showTitle(), [
      h("button", { class: "pt-btn pt-wood", onclick: () => this.showBestiary() }, ico("book"), h("span", { class: "pt-hide-s" }, "Encyclopédie")),
      h("button", { class: "pt-btn pt-gold-b", onclick: () => this.showSkills() }, ico("skills"), h("span", { class: "pt-hide-s" }, "Compétences"), free > 0 ? h("span", { class: "pt-badge" }, String(free)) : null),
    ]);
    this.mapCard = h("aside", { class: "pt-mcard" });
    const sc = h("section", { class: "pt-screen pt-map" }, head, h("div", { class: "pt-wm-wrap" }, world), this.mapCard);
    this.setScreen(sc);
    this.selectMission(focus, true);
  };
  P.selectMission = function (k, quiet) {
    this.mapSel = k;
    if (this.medals) this.medals.forEach((m, i) => m.classList.toggle("sel", i + 1 === k));
    const p = this.loadP();
    const m = this.maps()[k] || { id: k, name: "Mission " + k, waves: 5, gems: 5, gold: 100, spells: ["cut"] };
    const L = (p.levels && p.levels[k]) || null;
    const D = this.D();
    const spells = (m.spells || []).map((s) => h("span", { class: "pt-chip", title: (D.SPELLS && D.SPELLS[s] && D.SPELLS[s].name) || s }, ico(s), (D.SPELLS && D.SPELLS[s] && D.SPELLS[s].name) || s));
    const diff = m.difficulty || "";
    const best = L && L.won
      ? h("div", { class: "pt-mcard-best" }, h("span", {}, "Meilleur résultat"), h("div", { class: "pt-gemrow" }, Array.from({ length: L.gemsTotal || m.gems || 5 }, (_, i) => ico(icons().gem(i % 6, i < (L.bestGems || 0) ? "lair" : "lost")))), L.brilliant ? h("span", { class: "pt-brilliant" }, ico("crown"), "Brillant") : null)
      : h("div", { class: "pt-mcard-best pt-muted" }, "Pas encore gagnée : défends toutes les gemmes pour décrocher la couronne « Brillant ».");
    const card = h(
      "div",
      { class: "pt-card pt-mcard-in" + (quiet ? "" : " pt-pop-in") },
      h("div", { class: "pt-mcard-num" }, h("small", {}, "Mission"), h("b", { class: "pt-num" }, String(k))),
      h("h2", { class: "pt-mcard-t" }, m.name),
      m.ct && !/^(mission\b|\d+$)/i.test(m.ct) ? h("div", { class: "pt-mcard-ct" }, "D'après « ", m.ct, " »") : null,
      h(
        "div",
        { class: "pt-facts" },
        diff ? h("span", { class: "pt-fact pt-diff", "data-d": diff }, cap(diff)) : null,
        h("span", { class: "pt-fact" }, ico("wave"), (m.waves || "?") + " vagues"),
        h("span", { class: "pt-fact" }, ico("gems"), (m.gems || 5) + " gemmes"),
        this.lairsFact(m),
        h("span", { class: "pt-fact" }, ico("gold"), (m.gold || 0) + " or"),
      ),
      spells.length ? h("div", { class: "pt-mcard-sp" }, h("small", {}, "Sorts"), spells) : null,
      best,
      h("button", { class: "pt-btn pt-go pt-big pt-pulse", onclick: () => this.play(k) }, ico("play"), "Jouer"),
    );
    this.mapCard.textContent = "";
    this.mapCard.append(card);
  };
  /** Pastille « n cachettes » de la fiche de mission : une petite icône par cachette (son décor). */
  P.lairsFact = function (m) {
    const lairs = (m && m.lairs) || [];
    const n = lairs.length || 1;
    const names = lairs.map((L) => L.name || (this.D().LAIR_NAMES || {})[L.style] || "").filter(Boolean);
    return h(
      "span",
      { class: "pt-fact pt-lairs-f" + (n > 1 ? " multi" : ""), title: n > 1 ? "Plusieurs cachettes à défendre : " + names.join(", ").toLowerCase() : "Une seule cachette : " + (names[0] || "le moulin").toLowerCase() },
      h("span", { class: "pt-lairs-i" }, (lairs.length ? lairs : [{ style: "moulin" }]).map((L) => h("span", { class: "pt-i", html: icons().lair(L.style) }))),
      n + " cachette" + (n > 1 ? "s" : ""),
    );
  };
  P.play = function (k) {
    if (typeof this.hooks.playLevel === "function") this.hooks.playLevel(k);
    else this.toast("Lancement de la mission " + k + " indisponible ici", "info");
  };
  /** Paysage breton vu du dessus : bocage, rivière, mer, bois, hameaux, moulin, chemin des missions. */
  P.worldSvg = function (portrait, n) {
    const rnd = PTMT.rng ? PTMT.rng(7) : Math.random;
    let s = "";
    // Champs du bocage : grille déformée, couleurs de parcelles, haies sur les bords.
    const cols = 11,
      rows = 7;
    const pts = [];
    for (let j = 0; j <= rows; j++) {
      pts[j] = [];
      for (let i = 0; i <= cols; i++) {
        const edge = i === 0 || j === 0 || i === cols || j === rows;
        pts[j][i] = [(i / cols) * 1000 + (edge ? 0 : (rnd() - 0.5) * 60), (j / rows) * 600 + (edge ? 0 : (rnd() - 0.5) * 50)];
      }
    }
    const FIELDS = ["#8fcf5a", "#7cc24e", "#a4d76a", "#c9d86a", "#e3cf78", "#6fb54a", "#b6d860", "#9dcf62"];
    let fields = "",
      hedges = "";
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const q = [pts[j][i], pts[j][i + 1], pts[j + 1][i + 1], pts[j + 1][i]];
        const d = "M" + q.map((p) => p[0].toFixed(0) + " " + p[1].toFixed(0)).join("L") + "Z";
        const c = FIELDS[Math.floor(rnd() * FIELDS.length)];
        fields += `<path d="${d}" fill="${c}"/>`;
        if (c === "#e3cf78" || c === "#c9d86a") {
          // Sillons des champs cultivés
          const [a, b] = [q[0], q[1]];
          const [c2, d2] = [q[3], q[2]];
          for (let k = 1; k < 5; k++) {
            const t = k / 5;
            hedges += `<path d="M${(a[0] + (c2[0] - a[0]) * t).toFixed(0)} ${(a[1] + (c2[1] - a[1]) * t).toFixed(0)}L${(b[0] + (d2[0] - b[0]) * t).toFixed(0)} ${(b[1] + (d2[1] - b[1]) * t).toFixed(0)}" stroke="#000" stroke-opacity=".08" stroke-width="3"/>`;
          }
        }
        hedges += `<path d="${d}" fill="none" stroke="#3a7a30" stroke-width="5" stroke-linejoin="round" stroke-opacity=".75"/>`;
      }
    s += fields + hedges;
    // Buissons ronds le long des haies
    let bush = "";
    for (let j = 1; j < rows; j++)
      for (let i = 0; i <= cols; i++) {
        const p = pts[j][i];
        if (rnd() < 0.35) bush += `<circle cx="${p[0].toFixed(0)}" cy="${p[1].toFixed(0)}" r="${(6 + rnd() * 5).toFixed(1)}" fill="#3f8f3a" stroke="#1f4a24" stroke-width="2.5"/>`;
      }
    s += bush;
    // Mer et plage (coin nord-ouest), phare
    s += `<path d="M0 0H330Q300 40 250 60Q190 90 120 84Q60 96 30 140Q10 170 0 176Z" fill="#f2dfa2"/>`;
    s += `<path d="M0 0H300Q270 34 228 50Q170 72 110 68Q52 80 22 122Q8 144 0 150Z" fill="#3f9be8" stroke="#1d5a9a" stroke-width="4"/>`;
    s += `<path d="M40 30Q60 22 80 30M120 40Q140 32 160 40M60 70Q80 62 100 70M180 20Q200 12 220 20" fill="none" stroke="#cfe9ff" stroke-width="4" stroke-linecap="round"/>`;
    s += `<g transform="translate(64 108)${portrait ? " rotate(90)" : ""}"><rect x="-8" y="-30" width="16" height="30" rx="3" fill="#fffaf0" stroke="#2b1a10" stroke-width="3"/><rect x="-8" y="-20" width="16" height="7" fill="#e8412f"/><path d="M-10 -30H10L6 -38H-6Z" fill="#e8412f" stroke="#2b1a10" stroke-width="3" stroke-linejoin="round"/><circle cx="0" cy="-42" r="5" fill="#ffd84a" stroke="#2b1a10" stroke-width="2.5"/></g>`;
    // Rivière qui descend vers le moulin
    const river = "M1000 470Q930 470 900 420Q870 360 900 300Q930 240 880 190Q840 150 860 90Q880 40 850 0";
    s += `<path d="${river}" fill="none" stroke="#1d5a9a" stroke-width="30" stroke-linecap="round"/><path d="${river}" fill="none" stroke="#3f9be8" stroke-width="22" stroke-linecap="round"/><path d="${river}" fill="none" stroke="#9fd3ff" stroke-width="4" stroke-dasharray="18 26" stroke-linecap="round"/>`;
    // Bois (grappes d'arbres)
    const wood = (cx, cy, k, r) => {
      let g = "";
      for (let i = 0; i < k; i++) {
        const a = rnd() * Math.PI * 2,
          d = rnd() * r;
        const x = cx + Math.cos(a) * d,
          y = cy + Math.sin(a) * d * 0.7;
        const rr = 11 + rnd() * 7;
        g += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${rr.toFixed(1)}" fill="${rnd() < 0.5 ? "#2f7d44" : "#3f9a4a"}" stroke="#16391f" stroke-width="3"/><circle cx="${(x - rr * 0.3).toFixed(0)}" cy="${(y - rr * 0.35).toFixed(0)}" r="${(rr * 0.35).toFixed(1)}" fill="#6cc24a" opacity=".7"/>`;
      }
      return g;
    };
    s += wood(560, 110, 14, 70) + wood(80, 330, 9, 45) + wood(700, 560, 10, 60) + wood(470, 470, 6, 30) + wood(990, 560, 6, 40);
    // Hameaux : maisons de granit aux toits d'ardoise (vues du dessus)
    const house = (x, y, r) => `<g transform="translate(${x} ${y}) rotate(${r})"><rect x="-16" y="-10" width="32" height="20" rx="2" fill="#8a93a3" stroke="#2b1a10" stroke-width="3"/><path d="M-16 0H16" stroke="#5a6272" stroke-width="3"/><rect x="10" y="-14" width="6" height="6" fill="#b9a58a" stroke="#2b1a10" stroke-width="2"/></g>`;
    s += house(470, 60, -8) + house(505, 78, 12) + house(250, 410, 20) + house(640, 250, -15) + house(672, 236, 8) + house(120, 560, -5);
    // Menhirs
    s += `<ellipse cx="420" cy="580" rx="7" ry="4" fill="#000" opacity=".2"/><path d="M414 580L412 560Q416 548 422 550Q428 556 426 580Z" fill="#a7abb4" stroke="#2b1a10" stroke-width="3"/>`;
    // Chemin des missions (courbe qui relie les médaillons)
    const P2 = SPOTS.slice(0, n);
    let d = `M${P2[0][0]} ${P2[0][1]}`;
    for (let i = 0; i < P2.length - 1; i++) {
      const p0 = P2[Math.max(0, i - 1)],
        p1 = P2[i],
        p2 = P2[i + 1],
        p3 = P2[Math.min(P2.length - 1, i + 2)];
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += `C${c1[0].toFixed(0)} ${c1[1].toFixed(0)} ${c2[0].toFixed(0)} ${c2[1].toFixed(0)} ${p2[0]} ${p2[1]}`;
    }
    s += `<path d="${d}" fill="none" stroke="#6b4428" stroke-width="20" stroke-linecap="round" stroke-linejoin="round" opacity=".55"/>`;
    s += `<path d="${d}" fill="none" stroke="#e8cf94" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>`;
    s += `<path d="${d}" fill="none" stroke="#b8935a" stroke-width="3" stroke-dasharray="2 12" stroke-linecap="round"/>`;
    // Le moulin au bout du chemin : maison de granit au toit d'ardoise, grande roue à aubes côté
    // rivière. Vu de trois quarts : sur la carte tournée (portrait), on le redresse.
    const last = P2[P2.length - 1];
    const up = portrait ? " rotate(90)" : "";
    let spokes = "";
    for (let k = 0; k < 8; k++) {
      const an = (k * Math.PI) / 4;
      spokes += `M0 0L${(19 * Math.cos(an)).toFixed(1)} ${(19 * Math.sin(an)).toFixed(1)}`;
    }
    let paddles = "";
    for (let k = 0; k < 12; k++) paddles += `<rect x="-3" y="-27" width="6" height="9" rx="1" fill="#8a5a2c" stroke="#2b1a10" stroke-width="2" transform="rotate(${k * 30})"/>`;
    s +=
      `<g transform="translate(${last[0] + 62} ${last[1] - 14})${up}">` +
      `<ellipse cx="4" cy="30" rx="44" ry="8" fill="#000" opacity=".18"/>` +
      `<g transform="translate(30 6)">${paddles}<circle r="21" fill="none" stroke="#2b1a10" stroke-width="7"/><circle r="21" fill="none" stroke="#a8733f" stroke-width="4"/><path d="${spokes}" stroke="#6b4428" stroke-width="3"/><circle r="5" fill="#6b4428" stroke="#2b1a10" stroke-width="2"/></g>` +
      `<rect x="-28" y="-6" width="46" height="32" rx="3" fill="#c2b49c" stroke="#2b1a10" stroke-width="3"/>` +
      `<path d="M-24 4H-14M-8 12H4M-22 18H-12" stroke="#8f8373" stroke-width="2.5" stroke-linecap="round"/>` +
      `<path d="M-33 -4L-5 -30L23 -4Z" fill="#56627a" stroke="#2b1a10" stroke-width="3" stroke-linejoin="round"/>` +
      `<path d="M-24 -10H14M-16 -18H6" stroke="#7a88a3" stroke-width="2" stroke-linecap="round"/>` +
      `<rect x="-2" y="10" width="11" height="16" rx="4" fill="#6b4428" stroke="#2b1a10" stroke-width="2.5"/>` +
      `<rect x="-22" y="6" width="9" height="8" fill="#ffe7a0" stroke="#2b1a10" stroke-width="2"/>` +
      `<rect x="6" y="-28" width="7" height="12" fill="#8f8373" stroke="#2b1a10" stroke-width="2.5"/>` +
      `</g>`;
    const vb = portrait ? "0 0 600 1000" : "0 0 1000 600";
    const inner = portrait ? `<g transform="translate(0 1000) rotate(-90)">${s}</g>` : s;
    return `<svg class="pt-wm-svg" viewBox="${vb}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${inner}</svg>`;
  };

  // ── Compétences ──────────────────────────────────────────────────────────
  P.showSkills = function (branchTab) {
    const back = this.mode === "map" || this.mode === "skills" ? () => this.showMap(this.mapSel) : () => this.showTitle();
    this.skillsBack = this.mode === "skills" ? this.skillsBack : back;
    this.setMode("skills");
    const D = this.D();
    const pr = this.prog();
    const p = this.loadP();
    const free = pr ? call(pr, "pointsFree", p) || 0 : 0;
    const total = pr ? call(pr, "pointsTotal", p) || 0 : 0;
    this.skillTab = branchTab || this.skillTab || "boar";
    const reset = h("button", { class: "pt-btn pt-wood", title: "Reprendre tous les points", onclick: () => this.resetSkills() }, ico("restart"), h("span", { class: "pt-hide-s" }, "Réinitialiser"));
    const head = this.screenHead("Compétences", this.skillsBack, [h("div", { class: "pt-points" + (free > 0 ? " has" : "") }, ico("skillPoint"), h("b", { class: "pt-num" }, String(free)), h("span", {}, free > 1 ? "points libres" : "point libre"), h("small", {}, "sur " + total)), reset]);
    const tabs = h(
      "div",
      { class: "pt-tabs pt-branch-tabs" },
      FAMS.map((b) => h("button", { class: "pt-tab" + (b === this.skillTab ? " on" : ""), "data-b": b, onclick: () => this.showSkills(b) }, ico(b), (D.BRANCHES && D.BRANCHES[b] && D.BRANCHES[b].name) || b)),
    );
    const cols = h("div", { class: "pt-branches" });
    for (const b of FAMS) {
      const B = (D.BRANCHES && D.BRANCHES[b]) || { name: b, theme: "", perPointText: "" };
      const spent = pr ? call(pr, "branchPoints", p, b) || 0 : 0;
      const list = (D.SKILLS || []).filter((s) => s.branch === b).sort((x, y) => x.req - y.req);
      const col = h(
        "div",
        { class: "pt-branch" + (b === this.skillTab ? " on" : ""), "data-b": b },
        h("div", { class: "pt-branch-h" }, h("span", { class: "pt-branch-ic", html: icons().get(b) }), h("div", {}, h("h2", {}, B.name), h("small", {}, B.theme)), h("div", { class: "pt-branch-pts" }, h("b", { class: "pt-num" }, String(spent)), h("small", {}, "points"))),
        h("div", { class: "pt-branch-bonus" }, "Chaque point : ", B.perPointText, spent ? h("b", {}, " (+" + spent + NB + "%)") : null),
        list.map((sk) => this.skillRow(sk, p, spent, free)),
      );
      cols.append(col);
    }
    const sc = h("section", { class: "pt-screen pt-skills" }, head, tabs, cols);
    this.setScreen(sc);
  };
  P.skillRow = function (sk, p, spent, free) {
    const pr = this.prog();
    const rank = (p.skills && p.skills[sk.id]) || 0;
    const locked = spent < sk.req && rank === 0;
    const can = pr ? call(pr, "canRaise", p, sk.id) || { ok: false } : { ok: false };
    const pips = h("div", { class: "pt-pips", "aria-label": `Rang ${rank} sur ${sk.max}` }, Array.from({ length: sk.max }, (_, i) => h("i", { class: i < rank ? "on" : "" })));
    const plus = h("button", { class: "pt-btn pt-sq pt-go pt-plus" + (can.ok ? " pt-pulse-s" : ""), "aria-disabled": can.ok ? "false" : "true", title: can.ok ? "Ajouter un rang" : can.reason || "", "aria-label": "Ajouter un rang", onclick: (e) => this.raiseSkill(sk.id, e.currentTarget) }, ico("plus"));
    const low = rank > 0 ? (pr && typeof pr.canLower === "function" ? pr.canLower(p, sk.id) : { ok: true }) || { ok: false } : { ok: false };
    const minus = h("button", { class: "pt-btn pt-sq pt-wood pt-minus", "aria-disabled": low.ok ? "false" : "true", title: low.ok ? "Retirer un rang" : low.reason || "Retirer un rang", "aria-label": "Retirer un rang", onclick: (e) => this.lowerSkill(sk.id, e.currentTarget) }, ico("minus"));
    return h(
      "div",
      { class: "pt-skill" + (locked ? " locked" : "") + (rank >= sk.max ? " max" : "") + (rank > 0 ? " has" : "") },
      h("span", { class: "pt-skill-ic", html: icons().skill(sk.id) }),
      h(
        "div",
        { class: "pt-skill-b" },
        h("div", { class: "pt-skill-t" }, h("b", {}, sk.name), h("span", { class: "pt-skill-r pt-num" }, rank + "/" + sk.max)),
        h("p", {}, sk.text),
        locked ? h("small", { class: "pt-req" }, ico("lock"), `Demande ${sk.req} point${sk.req > 1 ? "s" : ""} dans la branche`) : pips,
      ),
      h("div", { class: "pt-skill-btns" }, minus, plus),
    );
  };
  P.raiseSkill = function (id, btn) {
    const pr = this.prog();
    if (!pr) return;
    const p = this.loadP();
    const can = call(pr, "canRaise", p, id) || { ok: false };
    if (!can.ok) return this.refuse(btn, can.reason || "Impossible pour l'instant");
    const r = call(pr, "raise", p, id);
    if (r === false || (r && r.ok === false)) return this.refuse(btn, (r && r.reason) || "Impossible pour l'instant");
    this.saveP(p);
    this.showSkills(this.skillTab);
  };
  P.lowerSkill = function (id, btn) {
    const pr = this.prog();
    if (!pr) return;
    const p = this.loadP();
    if (!((p.skills && p.skills[id]) > 0)) return this.refuse(btn, "Aucun rang à retirer");
    const can = typeof pr.canLower === "function" ? pr.canLower(p, id) : null;
    if (can && !can.ok) return this.refuse(btn, can.reason || "Une autre compétence en dépend");
    const r = call(pr, "lower", p, id);
    if (r === false || (r && r.ok === false)) return this.refuse(btn, (r && r.reason) || "D'autres compétences de la branche en dépendent");
    this.saveP(p);
    this.showSkills(this.skillTab);
  };
  P.resetSkills = function () {
    const pr = this.prog();
    if (!pr) return;
    const p = this.loadP();
    call(pr, "resetSkills", p);
    this.saveP(p);
    this.showSkills(this.skillTab);
    this.toast("Tous les points sont de nouveau libres", "good");
  };

  // ── Encyclopédie ─────────────────────────────────────────────────────────
  P.showBestiary = function (tab) {
    const back = this.mode === "map" ? () => this.showMap(this.mapSel) : this.mode === "bestiary" ? this.bestBack : () => this.showTitle();
    this.bestBack = back;
    this.setMode("bestiary");
    this.bestTab = tab || this.bestTab || "enemies";
    const head = this.screenHead("Encyclopédie", back);
    const tabs = h(
      "div",
      { class: "pt-tabs" },
      h("button", { class: "pt-tab" + (this.bestTab === "enemies" ? " on" : ""), onclick: () => this.showBestiary("enemies") }, ico("enemy"), "Ennemis"),
      h("button", { class: "pt-tab" + (this.bestTab === "towers" ? " on" : ""), onclick: () => this.showBestiary("towers") }, ico("boar"), "Tours"),
    );
    const body = h("div", { class: "pt-best-body" }, this.bestTab === "towers" ? this.towerPages() : this.enemyPages());
    this.setScreen(h("section", { class: "pt-screen pt-bestiary" }, head, tabs, body));
  };
  P.enemyPages = function () {
    const D = this.D();
    const p = this.loadP();
    const seen = p.seen || {};
    const grid = h("div", { class: "pt-egrid" });
    for (const type of Object.keys(D.ENEMIES || {})) {
      const e = D.ENEMIES[type];
      if (!seen[type]) {
        grid.append(h("div", { class: "pt-card pt-ecard unseen" }, NEW_V4[type] ? h("span", { class: "pt-new" }, "Nouveau") : null, h("span", { class: "pt-ep big", html: icons().get("unknown") }), h("div", { class: "pt-ecard-b" }, h("h3", {}, "???"), h("p", { class: "pt-muted" }, NEW_V4[type] ? "Un nouvel ennemi rôde dans les dernières missions. Il apparaîtra ici après sa première attaque." : "Pas encore rencontré. Il apparaîtra ici après sa première attaque."))));
        continue;
      }
      grid.append(this.enemyCard(type, e));
    }
    return grid;
  };
  P.enemyCard = function (type, e, big) {
    const D = this.D();
    const ab = e.ability && ABILITY[e.ability.kind] ? ABILITY[e.ability.kind](e.ability) : null;
    return h(
      "div",
      { class: "pt-card pt-ecard" + (big ? " big" : "") + (NEW_V4[type] ? " new" : "") },
      NEW_V4[type] ? h("span", { class: "pt-new" }, "Nouveau") : null,
      this.enemyPortrait(type, false, false, "big"),
      h(
        "div",
        { class: "pt-ecard-b" },
        h("h3", {}, e.name),
        e.ct ? h("small", { class: "pt-muted" }, "Rôle : ", e.ct) : null,
        h("div", { class: "pt-facts" }, h("span", { class: "pt-fact", title: "Points de vie" }, ico("heal"), nf(e.hp) + " PV"), h("span", { class: "pt-fact", title: f1(e.speed) + " case/s" }, ico("haste"), cap(speedWord(e.speed))), h("span", { class: "pt-fact", title: "Prime" }, ico("gold"), "+" + e.gold)),
        ab ? h("div", { class: "pt-ability" }, ico(ab[0]), h("span", {}, h("b", {}, ab[1]), " : " + ab[2])) : null,
        h("p", {}, e.blurb || ""),
        D.BOSS_NAMES && D.BOSS_NAMES[type] ? h("small", { class: "pt-boss-name" }, ico("boss"), "Boss : ", D.BOSS_NAMES[type]) : null,
      ),
    );
  };
  P.towerPages = function () {
    const D = this.D();
    const TP = PTMT.towerPortraits;
    const wrap = h("div", { class: "pt-tpages" });
    for (const fam of FAMS) {
      const F = D.FAMILIES && D.FAMILIES[fam];
      if (!F) continue;
      const lv = (level, spec) => {
        const L = D.towerLevel(fam, level, spec);
        return h("div", { class: "pt-tlv", title: L ? L.name : "" }, h("span", { class: "pt-tp", "data-f": fam, html: TP ? TP.get(fam, level, spec) : "" }), h("b", {}, L ? L.name : ""), h("small", {}, level <= 3 ? "Niveau " + level : level === 7 ? "Niveau 7" : "Niveaux 4 à 6"));
      };
      const spec = (k) => {
        const S = F.specs[k];
        return h("div", { class: "pt-tspec" }, h("div", { class: "pt-tspec-h" }, h("span", { class: "pt-spec-l" }, k), h("b", {}, S.name)), h("p", {}, S.blurb), h("div", { class: "pt-tlvs" }, lv(4, k), lv(7, k)));
      };
      const base = F.base[0];
      wrap.append(
        h(
          "div",
          { class: "pt-card pt-tfam", "data-f": fam },
          h("div", { class: "pt-tfam-h" }, h("span", { class: "pt-branch-ic", html: icons().get(fam) }), h("div", {}, h("h2", {}, F.name), h("small", {}, "Se pose sur : ", TERRAIN[F.terrain] || F.terrain, " (et les buttes)")), h("span", { class: "pt-fact", title: fr(`${base.cost} or pour le premier, puis ${(D.economy && D.economy.towerStep) || 0} or de plus pour chaque ${F.name.toLowerCase()} déjà posé`) }, ico("gold"), base.cost + " or" + ((D.economy && D.economy.towerStep) ? " +" + D.economy.towerStep : ""))),
          this.attackGuide(fam),
          h("div", { class: "pt-tlvs" }, lv(1), lv(2), lv(3)),
          h("div", { class: "pt-tspecs" }, spec("A"), spec("B")),
        ),
      );
    }
    return wrap;
  };

  /** Encyclopédie : la façon d'attaquer d'une famille, expliquée avec un petit schéma. */
  P.attackGuide = function (fam) {
    const D = this.D();
    const F = D.FAMILIES[fam];
    const mode = F.attack || (fam === "swan" ? "charges" : fam === "dog" ? "beam" : "shot");
    const A = ATTACK[mode];
    const spec = (k) => (F.specs && F.specs[k] ? F.specs[k].name : k);
    const L1 = D.towerLevel(fam, 1) || {};
    const top = (k) => {
      let best = null;
      for (const sp of ["A", "B"]) {
        const L = D.towerLevel(fam, 7, sp);
        if (L && (!best || (L[k] || 0) > (best[k] || 0))) best = L;
      }
      return best || {};
    };
    let text, demo;
    if (mode === "charges") {
      const T = top("charges");
      text = `Garde ${L1.charges || 2} à ${T.charges || 5} boules d'eau en réserve et les lâche en rafale dès qu'un ennemi approche ; puis chaque boule revient, l'une après l'autre (${f1(L1.reload || 1.4)} s au début). Les boules éclaboussent autour de la cible et la ralentissent. Au niveau 4, le ${spec("A")} change chaque boule en onde de glace autour du nid (tous les ennemis à portée) ; le ${spec("B")} lâche toutes ses boules d'un coup, chacune sur un ennemi différent.`;
      demo = h("span", { class: "pt-ag-demo pt-pips-c" }, [1, 1, 0.45].map((f) => h("i", { class: f >= 1 ? "full" : "", style: `--f:${f}` }, h("b", {}))));
    } else if (mode === "beam") {
      const T = top("heatMax");
      text = `Crache un jet de flammes continu sur une cible tant qu'elle reste à portée. Plus il la tient, plus ça chauffe : les dégâts montent jusqu'à × ${f1(L1.heatMax || 2.2)} au bout de ${f1(L1.heatTime || 3)} s (× ${f1(T.heatMax || 2.6)} pour les grands dragons). Le feu perce les boucliers ; le rugbyman s'y dérobe parfois (la chauffe retombe). Au niveau 4, le ${spec("A")} souffle un cône de flammes qui brûle tout ce qui est devant lui ; le jet du ${spec("B")} rebondit sur un second ennemi (trois au niveau 7).`;
      demo = h("span", { class: "pt-ag-demo pt-heat on max" }, h("span", { class: "pt-heat-bar" }, h("i", { class: "pt-heat-fill", style: "transform:scaleX(1)" }), h("i", { class: "pt-heat-x0" }, "×1"), h("i", { class: "pt-heat-x1" }, "×" + f1(L1.heatMax || 2.2))));
    } else {
      text = `Lance des bogues de châtaigne l'une après l'autre sur une seule cible (${nf(L1.dmg || 10)} dégâts × ${f1(L1.rate || 1.1)} par seconde au début). Au niveau 4, le ${spec("A")} lance deux bogues à la fois sur deux ennemis (trois au niveau 7) ; la ${spec("B")} lance une grosse châtaigne en cloche qui explose sur tout un groupe.`;
      demo = h("span", { class: "pt-ag-demo pt-ag-shot" }, [0, 1, 2].map(() => h("span", { class: "pt-i", html: icons().get("shot") })));
    }
    return h("div", { class: "pt-ag", "data-a": mode }, h("div", { class: "pt-ag-h" }, ico(A.icon), h("b", {}, A.name), demo), h("p", {}, text));
  };
  /** Portrait d'ennemi : PTMT.portraits s'il le connaît, sinon disque coloré à l'initiale. */
  P.enemyPortrait = function (type, champion, boss, cls) {
    const src = PTMT.portraits && typeof PTMT.portraits.get === "function" ? PTMT.portraits.get(type, champion || boss) : "";
    const el = h("span", { class: "pt-ep" + (cls ? " " + cls : "") + (champion ? " champ" : "") + (boss ? " boss" : "") });
    if (typeof src === "string" && src.trim().startsWith("<")) el.innerHTML = src;
    else {
      // Portrait pas encore dessiné : pastille à l'initiale, couleur de l'ennemi (accent des portraits si connue).
      // Icône de sa capacité quand elle est parlante (vélo, flash, tracteur, montgolfière…), sinon son initiale.
      const acc = PTMT.portraits && PTMT.portraits.accent && PTMT.portraits.accent[type];
      const E = (this.D().ENEMIES || {})[type] || {};
      const ab = E.ability && ABILITY[E.ability.kind] ? ABILITY[E.ability.kind](E.ability)[0] : null;
      el.classList.add("fb");
      el.style.setProperty("--tint", acc || TINT[type] || "#7a6a5a");
      if (ab && icons().get(ab)) el.append(h("span", { class: "pt-ep-fb ic", html: icons().get(ab) }));
      else el.append(h("b", { class: "pt-ep-fb" }, ((E.name || type || "?").replace(/^(Le |La |L')/, "").charAt(0) || "?").toUpperCase()));
    }
    if (boss) el.append(h("span", { class: "pt-ep-badge boss", html: icons().get("boss") }));
    else if (champion) el.append(h("span", { class: "pt-ep-badge", html: icons().get("champion") }));
    return el;
  };

  /* ------------------------------------------------------------------ partie */
  P.enterLevel = function (game, view) {
    this.closeModal(true);
    this.cancelAim();
    this.closeSel();
    this.tutoEnd();
    this.hideTip();
    this.pausedBanner(false);
    this.modalQueue = [];
    this.setScreen(null);
    this.setMode("game");
    this.game = game;
    this.view = view || {};
    this.last = Object.create(null);
    this.sel = null;
    this.aim = null;
    this.autoPaused = false;
    this.popLayer.textContent = "";
    this.bannerLayer.textContent = "";
    this.flyEl.textContent = "";
    this.marksEl.textContent = "";
    this.overShown = false;
    this.record = null;
    this.nextT = 0;
    const s = game.state;
    this.level = s.level || 1;
    const p = this.loadP();
    const L0 = (p.levels && p.levels[this.level]) || null;
    this.wasWon = !!(L0 && L0.won);
    this.prevBest = L0 && L0.won ? L0.bestGems || 0 : 0;
    const m = this.maps()[this.level] || {};
    this.mapInfo = m;
    this.nextInfo = null;
    // Durée de la Frénésie (anneau du bouton) : effets des compétences de la partie, sinon règles + compétence.
    // L'événement frenzy { on, t } la précise au lancement du sort.
    const D = this.D();
    const mods = game.mods || {};
    const perLong = (D.SKILL && D.SKILL.frenzyLong && D.SKILL.frenzyLong.per) || 0.5;
    this.frenzyDur = mods.frenzyTime || ((D.SPELLS && D.SPELLS.frenzy && D.SPELLS.frenzy.t) || 5) + perLong * ((p.skills && p.skills.frenzyLong) || 0);
    this.missionEl.textContent = "";
    this.missionEl.title = "Mission " + this.level;
    this.missionEl.append(h("span", { class: "pt-mission-n pt-num" }, String(this.level)), h("span", { class: "pt-mission-t" }, s.map && s.map.name ? s.map.name : m.name || "Mission " + this.level));
    // Gemmes, groupées par cachette
    this.buildGems(s);
    // Frise des vagues : repartie de zéro
    for (const b of this.fzBlocks) b.el.remove();
    this.fzBlocks = [];
    this.fzT = 0;
    this.fzK = null;
    this.fzMsg.textContent = "";
    this.fzEl.classList.remove("done");
    // Annonces : rien d'annoncé encore dans cette partie
    this.annT = {};
    this.annWave = {};
    this.ringEl.hidden = true;
    // Vitesse mémorisée
    const sp = (p.settings && p.settings.speed) || 1;
    if (sp !== 1 && sp !== s.speed) call(game, "setSpeed", sp);
    this._insets = null;
    this.onResize();
    this.frame(0);
    if (this.level === 1 && !this.wasWon) this.tutoStart();
    else this.tuto = null;
  };
  /** Pastilles de gemmes, une rangée par cachette (icône du décor quand il y en a plusieurs). */
  P.buildGems = function (s) {
    this.gemsEl.textContent = "";
    const lairs = (s.map && s.map.lairs) || [];
    const multi = lairs.length > 1;
    const groups = lairs.length ? lairs.map((L) => ({ L, list: [] })) : [{ L: null, list: [] }];
    (s.gems || []).forEach((g, i) => (groups[g.lair] || groups[0]).list.push(i));
    this.gemEls = [];
    this.lairEls = [];
    for (const grp of groups) {
      const L = grp.L;
      const el = h("span", { class: "pt-lair", "data-style": L ? L.style : "moulin", title: L ? L.name : "" }, multi && L ? h("span", { class: "pt-lair-i", html: icons().lair(L.style) }) : null);
      for (const i of grp.list) {
        const g = h("span", { class: "pt-gem", "data-w": "" });
        this.gemEls[i] = g;
        el.append(g);
      }
      this.gemsEl.append(el);
      this.lairEls.push(el);
    }
    this.gemsEl.classList.toggle("multi", multi);
    this.gemsEl.dataset.n = String(groups.length);
  };
  /** Cachette attaquée : sa rangée clignote un moment. */
  P.lairAlarm = function (id) {
    const el = this.lairEls && this.lairEls[id];
    if (!el) return;
    el.classList.remove("pt-alarm");
    void el.offsetWidth;
    el.classList.add("pt-alarm");
    clearTimeout(el._alarm);
    el._alarm = setTimeout(() => el.classList.remove("pt-alarm"), 2600);
  };
  /** Quitte le HUD (appelé en changeant d'écran). */
  P.leaveLevel = function (keepMode) {
    this.closeSel();
    this.autoPaused = false;
    this.cancelAim();
    this.tutoEnd();
    this.game = null;
    this.view = null;
    this.hud.hidden = true;
    this.popLayer.textContent = "";
    this.bannerLayer.textContent = "";
    if (!keepMode) this.mode = null;
  };
  P.v = function (fn, ...args) {
    return call(this.view, fn, ...args);
  };

  // ── Mise à jour du HUD (chaque image, écritures limitées aux changements) ─────────────
  P.put = function (key, v, apply) {
    if (this.last[key] !== v) {
      const old = this.last[key];
      this.last[key] = v;
      apply(v, old);
    }
  };
  P.frame = function (dt) {
    dt = dt || 0;
    this.t += dt;
    if (this.mode !== "game" || !this.game) return;
    const s = this.game.state;
    if (!s) return;
    // Or
    this.put("gold", Math.floor(s.gold), (v, old) => {
      this.goldNum.textContent = nf(v);
      if (old !== undefined && v > old) this.bump(this.goldEl, "up");
    });
    // Mana
    const mm = s.manaMax || 100;
    this.put("mana", Math.floor(s.mana) + "/" + mm, () => {
      this.manaNum.textContent = Math.floor(s.mana) + (this.layout === "landscape" ? "" : NB + "/" + NB + mm);
      this.manaFill.style.transform = `scaleX(${clamp(s.mana / mm, 0, 1).toFixed(3)})`;
    });
    // Gemmes (rangées par cachette)
    if (s.gems && this.gemEls) {
      if (s.gems.length !== this.gemEls.length || ((s.map && s.map.lairs) || [null]).length !== this.lairEls.length) this.buildGems(s);
      const lairs = (s.map && s.map.lairs) || [];
      s.gems.forEach((g, i) => {
        this.put("gem" + i, g.where + g.color, (v, old) => {
          const el = this.gemEls[i];
          if (!el) return;
          el.dataset.w = g.where;
          el.innerHTML = icons().gem(g.color, g.where);
          const L = lairs[g.lair];
          el.title = fr({ lair: L ? "À l'abri : " + L.name.toLowerCase() : "À l'abri", ground: "Tombée au sol : reprends-la !", carried: "Emportée par un ennemi", lost: "Perdue" }[g.where] || "");
          if (old !== undefined) this.bump(el, g.where === "lair" ? "good" : "bad");
        });
      });
      for (const L of lairs)
        this.put("lair" + L.id, L.stock + "/" + L.total, () => {
          const el = this.lairEls[L.id];
          if (el) el.title = fr(`${L.name} : ${L.stock} gemme${L.stock > 1 ? "s" : ""} sur ${L.total}`);
        });
    }
    // Frise des vagues : structure quelques fois par seconde, positions à chaque image
    this.fzT = (this.fzT || 0) - dt;
    const wi = s.wave ? s.wave.index : -1;
    if (this.fzT <= 0 || wi !== this.fzIdx || !!s.over !== this.fzOver) {
      this.fzT = 0.25;
      this.fzIdx = wi;
      this.fzOver = !!s.over;
      this.refreshFrieze(s);
    }
    this.placeFrieze(s, dt);
    // Prix des gardiens
    this.updatePrices(s);
    // Sorts
    for (const k of SPELLS) this.updateSpell(k, s);
    // Vitesse, pause
    this.put("speed", s.speed || 1, (v) => {
      this.speedBtns.forEach((b) => b.classList.toggle("on", +b.dataset.v === v));
      this.speedCycle.firstChild.innerHTML = icons().get("speed" + v);
      this.speedCycle.lastChild.textContent = "×" + v;
      this.speedCycle.dataset.v = v;
    });
    this.put("paused", !!s.paused + (s.paused && this.autoPaused ? "a" : ""), () => {
      const v = !!s.paused;
      this.pauseBtn.classList.toggle("on", v);
      this.pauseBtn.innerHTML = icons().get(v ? "play" : "pause");
      this.pauseBtn.title = v ? "Reprendre (Espace)" : "Pause (Espace)";
      this.el.classList.toggle("pt-paused", v);
      if (v && !this.modal) this.pausedBanner(true);
      else this.pausedBanner(false);
    });
    // Panneaux ancrés (tour : jauges en direct ; ennemi : fiche rafraîchie), repères d'entrée, tutoriel
    if (this.sel) {
      this.placeSel(false);
      this.selT = (this.selT || 0) - dt;
      if (this.selT <= 0) {
        this.selT = this.sel.kind === "enemy" ? 0.15 : 0.25;
        this.refreshSel();
      }
      if (this.sel && this.sel.kind === "tower") this.towerGauges();
    }
    this.placeRing();
    this.placeMarks();
    if (this.tuto) this.tutoFrame(dt);
    // Fin de partie
    if (s.over && !this.overShown) {
      this.overShown = true;
      this.cancelAim();
      this.closeSel();
      const g = this.game;
      setTimeout(() => this.game === g && this.showResult(s.over), 900);
    }
  };
  P.bump = function (el, kind) {
    el.classList.remove("pt-bump", "pt-bump-good", "pt-bump-bad", "pt-bump-up");
    void el.offsetWidth;
    el.classList.add("pt-bump", "pt-bump-" + (kind || "up"));
  };

  /** Repères au bord de la carte : entrées par où arrive la prochaine vague. */
  P.buildMarks = function (nw) {
    if (this.marks) for (const m of this.marks) m.el.remove();
    this.marks = [];
    if (!nw || !this.game) return;
    const all = (this.game.state.map && this.game.state.map.entrances) || [];
    const ids = nw.entrances || [...new Set((nw.groups || []).map((g) => g.entrance))];
    for (const id of ids) {
      const e = all.find((x) => x.id === id);
      if (!e) continue;
      // Centre de l'entrée (v4 : x, y ; v3 : case i, j)
      const x = typeof e.x === "number" ? e.x : (e.i || 0) + 0.5,
        y = typeof e.y === "number" ? e.y : (e.j || 0) + 0.5;
      const gate = e.open === false;
      const el = h(
        "div",
        { class: "pt-mark" + (gate ? " gate" : ""), style: `--gc:${e.color || "#3f9be8"}`, title: (gate ? "La barrière " + (e.letter || "") + " va céder" : "Entrée " + (e.letter || "")) + " : la prochaine vague arrive par ici" },
        h("span", { class: "pt-mark-a", html: icons().get(gate ? "gate" : "entrance") }),
        all.length > 1 && e.letter ? h("b", { class: "pt-num" }, e.letter) : null,
      );
      this.marksEl.append(el);
      this.marks.push({ el, x, y });
    }
  };
  P.placeMarks = function () {
    if (!this.marks || !this.marks.length) return;
    const s = this.game.state;
    const nw = s.wave || {};
    const show = !s.over && (nw.countdown === undefined || nw.countdown > 0);
    this.marksEl.classList.toggle("off", !show);
    if (!show) return;
    const top = this.insets().top + 70;
    for (const m of this.marks) {
      const p = this.v("worldToScreen", m.x, m.y);
      if (!p || !isFinite(p.x) || !isFinite(p.y)) continue;
      const tr = `translate(${p.x.toFixed(0)}px, ${p.y.toFixed(0)}px)`;
      if (tr !== m.tr) {
        m.tr = tr;
        m.el.style.transform = tr;
        m.el.classList.toggle("below", p.y < top);
      }
    }
  };
  /** Anneau sous l'ennemi dont la fiche est ouverte (si la vue ne le dessine pas elle-même). */
  P.placeRing = function () {
    const sel = this.sel;
    const show = sel && sel.kind === "enemy" && !sel.ring3d;
    if (!show) {
      if (!this.ringEl.hidden) this.ringEl.hidden = true;
      return;
    }
    const e = (this.game.state.enemies || []).find((x) => x.id === sel.id);
    const p = e && this.v("worldToScreen", e.x, e.y);
    if (!p || !isFinite(p.x)) {
      if (!this.ringEl.hidden) this.ringEl.hidden = true;
      return;
    }
    if (this.ringEl.hidden) this.ringEl.hidden = false;
    const size = Math.round(this.cellPx() * (e.boss ? 1.25 : e.champion ? 1.05 : 0.85));
    const tr = `translate(${p.x.toFixed(0)}px, ${p.y.toFixed(0)}px)`;
    if (tr !== this.ringTr) {
      this.ringTr = tr;
      this.ringEl.style.transform = tr;
    }
    if (size !== this.ringSize) {
      this.ringSize = size;
      this.ringEl.style.setProperty("--rs", size + "px");
    }
    this.ringEl.classList.toggle("fly", !!e.flying);
  };

  /** État d'un bouton de sort : verrouillé, trop cher (anneau de progression), prêt, actif. */
  P.updateSpell = function (k, s) {
    const b = this.spellBtn[k];
    const sp = (s.spells && s.spells[k]) || null;
    const D = this.D();
    const def = (D.SPELLS && D.SPELLS[k]) || { cost: 0, name: k };
    const allowed = this.mapInfo && Array.isArray(this.mapInfo.spells) ? this.mapInfo.spells.includes(k) : !!sp;
    const locked = !sp || !allowed || sp.locked || sp.unlocked === false;
    const cost = sp && sp.cost !== undefined ? sp.cost : def.cost;
    const afford = s.mana >= cost;
    // Frénésie en cours : secondes restantes (left), sinon valeur numérique d'active, sinon plein.
    const active = sp && sp.active ? (typeof sp.left === "number" && sp.left > 0 ? sp.left : typeof sp.active === "number" ? sp.active : this.frenzyDur || 1) : 0;
    const ready = !locked && afford && sp.ready !== false;
    const state = locked ? "locked" : active ? "active" : this.aim === k ? "aim" : ready ? "ready" : "low";
    this.put("sp" + k, state + ":" + cost, () => {
      b.dataset.state = state;
      b._cost.textContent = String(cost);
      b.title = locked ? `${def.name} : pas encore disponible dans cette mission` : `${def.name} (${KEYS[k]}) : ${def.blurb || ""}`;
      b.setAttribute("aria-label", def.name + (locked ? " (verrouillé)" : ""));
      if (state === "ready" && this.last["sp" + k + "was"] === "low") this.bump(b, "good");
      this.last["sp" + k + "was"] = state;
    });
    const prog = locked ? 0 : clamp(s.mana / Math.max(1, cost), 0, 1);
    const dur = k === "frenzy" ? this.frenzyDur || 5 : 1;
    const ring = active ? clamp(active / dur, 0, 1) : prog;
    this.put("spr" + k, (active ? "a" : "p") + ring.toFixed(2), () => b.style.setProperty("--p", ring.toFixed(3)));
  };

  /* ------------------------------------------------------------------ commandes */
  P.act = function (res, anchor) {
    if (res && res.ok === false) {
      this.refuse(anchor, res.reason || "Impossible");
      return false;
    }
    return true;
  };
  /** Refus : secousse de l'élément et message court. */
  P.refuse = function (el, text) {
    if (el && el.classList) {
      el.classList.remove("pt-shake");
      void el.offsetWidth;
      el.classList.add("pt-shake");
    }
    if (text) this.toast(text, "bad");
  };
  P.setSpeed = function (v) {
    if (!this.game) return;
    call(this.game, "setSpeed", v);
    const pr = this.prog();
    if (pr) {
      const p = this.loadP();
      p.settings = p.settings || {};
      if (p.settings.speed !== v) {
        p.settings.speed = v;
        this.saveP(p);
      }
    }
  };
  P.togglePause = function () {
    if (!this.game) return;
    const s = this.game.state;
    // le joueur reprend la main : la pause automatique d'un menu ouvert ne sera pas levée à sa fermeture
    this.autoPaused = false;
    call(this.game, "setPaused", !s.paused);
  };
  /**
   * Pause automatique : le temps s'arrête tant que le menu de construction, le panneau d'une tour ou
   * celui d'une case boisée est ouvert (on améliore, on choisit une voie, on revend sans stress) ; il
   * repart à la fermeture, sauf si le joueur avait mis la pause lui-même. La fiche d'un ennemi ne
   * l'arrête pas (on le regarde avancer).
   */
  P.holdTime = function (on) {
    const g = this.game;
    if (!g || !g.state) return;
    if (on) {
      if (!g.state.paused && !g.state.over) {
        this.autoPaused = true;
        call(g, "setPaused", true);
      }
    } else if (this.autoPaused) {
      this.autoPaused = false;
      if (this.modal) this.modal.resume = true;
      else if (!g.state.over && g.state.paused) call(g, "setPaused", false);
    }
  };
  P.callWave = function () {
    if (!this.game) return;
    const s = this.game.state;
    const first = this.fzBlocks[0];
    const anchor = (first && first.el) || this.fzEl;
    const nw = call(this.game, "nextWave");
    if (!nw || (s.wave && s.wave.total && nw.index >= s.wave.total)) return this.refuse(this.fzEl, "Plus aucune vague à appeler");
    const res = call(this.game, "callWave");
    if (this.act(res, anchor)) {
      this.bump(this.fzNow, "good");
      this.fzT = 0;
      this.tutoDone("call");
    }
  };
  P.spellHint = function (k, on) {
    if (!this.game || this.layout !== "desk") return;
    if (!on) return this.hideTip();
    const D = this.D();
    const def = (D.SPELLS && D.SPELLS[k]) || {};
    this.showTip(this.spellBtn[k], h("div", {}, h("b", {}, def.name, " "), h("kbd", {}, KEYS[k]), h("p", {}, def.blurb || "")));
  };
  P.spellClick = function (k) {
    if (!this.game) return;
    const b = this.spellBtn[k];
    const s = this.game.state;
    const st = b.dataset.state;
    const D = this.D();
    const def = (D.SPELLS && D.SPELLS[k]) || { name: k };
    if (st === "locked") return this.refuse(b, def.name + (def.unlock > this.level ? " se débloque à la mission " + def.unlock : " n'est pas disponible dans cette mission"));
    if (this.aim === k) return this.cancelAim();
    if (st === "low") return this.refuse(b, s.mana < +b._cost.textContent ? `Pas assez de mana pour ${def.name} (${b._cost.textContent})` : `${def.name} n'est pas encore prêt`);
    if (st === "active") return this.refuse(b, "Frénésie déjà en cours");
    if (k === "frenzy") {
      const res = call(this.game, "cast", "frenzy");
      if (this.act(res, b)) this.bump(b, "good");
      return;
    }
    this.startAim(k);
  };
  P.startAim = function (k) {
    this.closeSel();
    this.aim = k;
    this.last["sp" + k] = null;
    this.el.classList.add("pt-aiming");
    document.documentElement.classList.add("pt-aiming");
    const D = this.D();
    const def = (D.SPELLS && D.SPELLS[k]) || { name: k };
    this.aimBanner && this.aimBanner.remove();
    this.aimBanner = h(
      "div",
      { class: "pt-aimbar" },
      ico(k),
      h("span", {}, k === "cut" ? "Couper : touche une case boisée" : "Météore : touche la cible"),
      h("button", { class: "pt-btn pt-wood pt-small", onclick: () => this.cancelAim() }, ico("close"), "Annuler"),
    );
    this.bannerLayer.append(this.aimBanner);
    this.v("target", k, -99, -99);
  };
  P.cancelAim = function () {
    if (!this.aim) return;
    const k = this.aim;
    this.aim = null;
    this.last["sp" + k] = null;
    this.el.classList.remove("pt-aiming");
    document.documentElement.classList.remove("pt-aiming");
    if (this.aimBanner) this.aimBanner.remove();
    this.aimBanner = null;
    this.v("target", null, 0, 0);
  };
  P.castAt = function (k, hit) {
    let x = hit.x,
      y = hit.y;
    if (k === "cut") {
      x = hit.i + 0.5;
      y = hit.j + 0.5;
    }
    const res = call(this.game, "cast", k, { x, y });
    if (this.act(res, this.spellBtn[k])) {
      this.bump(this.spellBtn[k], "good");
      this.cancelAim();
      if (k === "cut") this.tutoDone("cut");
    }
  };

  /* ------------------------------------------------------------------ carte : toucher et survol */
  /** Complète un point touché : case (i, j) d'après la position (x, y) si la vue ne la donne pas. */
  const cellOf = (hit) => {
    if (!hit) return null;
    if (hit.i === undefined && typeof hit.x === "number") return Object.assign({}, hit, { i: Math.floor(hit.x), j: Math.floor(hit.y) });
    if (hit.x === undefined && typeof hit.i === "number") return Object.assign({}, hit, { x: hit.i + 0.5, y: hit.j + 0.5 });
    return hit;
  };
  P.mapTap = function (hit) {
    if (this.mode !== "game" || !this.game || this.modal) return;
    this.hideTip();
    hit = cellOf(hit);
    if (this.aim) {
      if (!hit) return this.cancelAim();
      return this.castAt(this.aim, hit);
    }
    if (!hit) return this.closeSel();
    // Ennemi touché (la vue renvoie enemyId) : sa fiche, sauf si c'est une tour qui a été visée.
    if (hit.enemyId !== undefined && hit.enemyId !== null && (hit.towerId === undefined || hit.towerId === null)) {
      if (this.sel && this.sel.kind === "enemy" && this.sel.id === hit.enemyId) return this.closeSel();
      return this.openEnemy(hit.enemyId);
    }
    const same = this.sel && this.sel.kind !== "enemy" && this.sel.i === hit.i && this.sel.j === hit.j;
    const info = call(this.game, "tileInfo", hit.i, hit.j) || {};
    if (info.towerId !== null && info.towerId !== undefined) {
      if (same && this.sel.kind === "tower") return this.closeSel();
      return this.openTower(info.towerId, hit.i, hit.j);
    }
    if (same) return this.closeSel();
    if (info.forest && info.cuttable !== false) return this.openForest(hit.i, hit.j, info);
    if (info.buildable && info.buildable.length) return this.openBuild(hit.i, hit.j, info);
    this.closeSel();
  };
  P.mapHover = function (hit) {
    if (this.mode !== "game" || !this.game) return;
    hit = cellOf(hit);
    if (this.aim) {
      if (!hit) return this.v("target", this.aim, -99, -99);
      return this.aim === "cut" ? this.v("target", "cut", hit.i + 0.5, hit.j + 0.5) : this.v("target", this.aim, hit.x, hit.y);
    }
    const onEnemy = !!hit && hit.enemyId !== undefined && hit.enemyId !== null;
    this.put("hoverEnemy", onEnemy, (v) => document.documentElement.classList.toggle("pt-over-enemy", v));
    if (this.sel) return;
    const info = hit ? call(this.game, "tileInfo", hit.i, hit.j) || {} : {};
    const id = info.towerId !== undefined && info.towerId !== null ? info.towerId : null;
    this.put("hoverTower", id, (v) => this.v("showRange", v));
  };

  /* ------------------------------------------------------------------ menus ancrés sur la carte */
  P.closeSel = function () {
    if (!this.sel) return;
    const s = this.sel;
    this.sel = null;
    this.holdTime(false);
    s.el.classList.add("pt-out");
    setTimeout(() => s.el.remove(), 160);
    this.v("showRange", null);
    if (s.kind === "enemy") this.v("selectEnemy", null);
    else this.v("preview", s.i, s.j, null);
    this.last.hoverTower = undefined;
    this.hideTip();
  };
  /** Ouvre un menu ancré : feuille en bas d'écran sur téléphone debout, bulle près de la case ailleurs. */
  P.openSel = function (sel, body, cls) {
    if (this.sel) {
      this.sel.el.remove();
      if (this.sel.kind === "enemy") this.v("selectEnemy", null);
      else this.v("preview", this.sel.i, this.sel.j, null);
      this.v("showRange", null);
    }
    const close = h("button", { class: "pt-btn pt-sq pt-wood pt-x", title: "Fermer (Échap)", "aria-label": "Fermer", onclick: () => this.closeSel() }, ico("close"));
    const el = h("div", { class: "pt-sel pt-card " + (cls || ""), role: "dialog" }, h("i", { class: "pt-arrow" }), close, body);
    sel.el = el;
    this.sel = sel;
    this.selT = 0.25;
    this.popLayer.append(el);
    this.placeSel(true);
    this.holdTime(sel.kind !== "enemy");
    return el;
  };
  P.placeSel = function (measure) {
    const sel = this.sel;
    if (!sel || !sel.el) return;
    const el = sel.el;
    const sheet = this.layout === "portrait";
    if (measure) sel.placed = null;
    if (sheet) {
      if (sel.placed !== "sheet") {
        sel.placed = "sheet";
        el.classList.add("pt-sheet");
        el.style.transform = "";
      }
      return;
    }
    if (sel.placed === "sheet" || sel.placed === null) el.classList.remove("pt-sheet");
    if (measure || !sel.w) {
      sel.w = el.offsetWidth;
      sel.h = el.offsetHeight;
    }
    const W = window.innerWidth,
      H = window.innerHeight;
    const ins = this.insets();
    const pad = this.layout === "landscape" ? 6 : 14;
    if (sel.kind === "enemy") {
      // Fiche d'ennemi : posée au coin bas gauche de la carte ; elle ne suit pas l'ennemi (un anneau le désigne).
      const tr = `translate(${Math.round(ins.left + pad)}px, ${Math.round(Math.max(ins.top + pad, H - ins.bottom - pad - sel.h))}px)`;
      if (tr === sel.placed) return;
      sel.placed = tr;
      el.dataset.side = "none";
      el.style.transform = tr;
      return;
    }
    const p = this.v("worldToScreen", sel.i + 0.5, sel.j + 0.5);
    if (!p) return;
    const cell = this.cellPx();
    let x, y, side;
    if (sel.kind === "tower") {
      // Panneau de tour : sur le côté de la case, du côté où il y a le plus de place.
      side = p.x < (ins.left + W - ins.right) / 2 ? "r" : "l";
      x = side === "r" ? p.x + cell * 0.8 + 10 : p.x - cell * 0.8 - 10 - sel.w;
      y = p.y - sel.h / 2;
    } else {
      // Menu de construction : au-dessus de la case (ou dessous si la place manque).
      side = p.y - cell * 0.7 - sel.h - 12 > ins.top + pad ? "t" : "b";
      x = p.x - sel.w / 2;
      y = side === "t" ? p.y - cell * 0.7 - 12 - sel.h : p.y + cell * 0.7 + 12;
    }
    x = clamp(x, ins.left + pad, W - ins.right - pad - sel.w);
    y = clamp(y, ins.top + pad, H - ins.bottom - pad - sel.h);
    const ax = side === "t" || side === "b" ? clamp(p.x - x, 18, sel.w - 18) : clamp(p.y - y, 18, sel.h - 18);
    const tr = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    const key = tr + side + ax.toFixed(0);
    if (key === sel.placed) return;
    sel.placed = key;
    el.dataset.side = side;
    el.style.setProperty("--ax", ax.toFixed(0) + "px");
    el.style.transform = tr;
  };
  /** Taille d'une case à l'écran (px), d'après la projection de la vue. */
  P.cellPx = function () {
    const a = this.v("worldToScreen", 10, 6.5),
      b = this.v("worldToScreen", 11, 6.5),
      c = this.v("worldToScreen", 10, 7.5);
    if (!a || !b || !c) return 40;
    return Math.max(Math.hypot(b.x - a.x, b.y - a.y), Math.hypot(c.x - a.x, c.y - a.y));
  };
  P.refreshSel = function () {
    const sel = this.sel;
    if (!sel || !this.game) return;
    if (sel.kind === "tower") {
      const t = (this.game.state.towers || []).find((x) => x.id === sel.id);
      if (!t) return this.closeSel();
      const key = this.towerKey(t);
      if (key !== sel.key) {
        this.openTower(sel.id, sel.i, sel.j, true);
        this.bump(this.sel.el.querySelector(".pt-tp"), "good");
      } else this.updateTowerLive(t);
    } else if (sel.kind === "build") {
      const g = Math.floor(this.game.state.gold);
      sel.el.querySelectorAll("[data-cost]").forEach((b) => b.classList.toggle("poor", +b.dataset.cost > g));
    } else if (sel.kind === "forest") {
      const info = call(this.game, "tileInfo", sel.i, sel.j) || {};
      if (!info.forest) {
        this.closeSel();
        if (info.buildable && info.buildable.length) this.openBuild(sel.i, sel.j, info);
        return;
      }
      this.updateCutBtn();
    } else if (sel.kind === "enemy") this.refreshEnemy();
  };

  // ── Fiche d'ennemi ───────────────────────────────────────────────────────
  // Ouverte en touchant un ennemi (hit.enemyId) : portrait, nom, rôle, PV (bulle, bouclier), vitesse,
  // effets en cours, gemme portée, capacité en clair. Rafraîchie tant qu'elle est ouverte ; elle se
  // ferme seule quand l'ennemi disparaît (vaincu ou sorti de la carte).
  P.openEnemy = function (id) {
    const info = call(this.game, "enemyInfo", id);
    if (!info) return this.closeSel();
    const D = this.D();
    const E = (D.ENEMIES && D.ENEMIES[info.type]) || {};
    const ab = E.ability || null;
    const abi = ab && ABILITY[ab.kind] ? ABILITY[ab.kind](ab) : null;
    const hpTxt = h("b", { class: "pt-num" }, "");
    const hpFill = h("i", { class: "pt-hp-fill" });
    const bubFill = h("i", { class: "pt-hp-bub" });
    const bubTxt = h("small", { class: "pt-hp-x" }, "");
    const hp = h("div", { class: "pt-hp" }, h("div", { class: "pt-hp-h" }, ico("heal"), h("span", {}, "Points de vie"), bubTxt, hpTxt), h("div", { class: "pt-hp-bar" }, hpFill, bubFill));
    const facts = h("div", { class: "pt-facts pt-en-facts" });
    const fxEl = h("div", { class: "pt-efx" });
    const carry = h("div", { class: "pt-ecarry", hidden: true });
    const name = info.boss ? info.name || (D.BOSS_NAMES && D.BOSS_NAMES[info.type]) || E.name : E.name || info.name || info.type;
    const rank = info.boss ? "Boss" : info.champion ? "Champion" : "";
    const abText = abi ? h("div", { class: "pt-ability" + (info.fx && info.fx.disarmed ? " off" : "") }, ico(abi[0]), h("span", {}, h("b", {}, abi[1]), info.blurb || E.blurb ? " : " + (info.blurb || E.blurb) : " : " + abi[2])) : info.blurb || E.blurb ? h("p", { class: "pt-en-b" }, info.blurb || E.blurb) : null;
    const body = h(
      "div",
      { class: "pt-sel-in pt-en" },
      h(
        "div",
        { class: "pt-en-h" },
        this.enemyPortrait(info.type, info.champion, info.boss, "mid"),
        h("div", { class: "pt-en-n" }, h("h3", {}, name), h("small", {}, rank ? h("b", { class: "pt-en-rank" + (info.boss ? " boss" : "") }, rank) : null, "Rôle : " + (info.role || E.ct || "?"))),
      ),
      hp,
      facts,
      fxEl,
      carry,
      abText,
    );
    this.openSel({ kind: "enemy", id, type: info.type }, body, "pt-enemy");
    const sel = this.sel;
    sel.hpTxt = hpTxt;
    sel.hpFill = hpFill;
    sel.bubFill = bubFill;
    sel.bubTxt = bubTxt;
    sel.facts = facts;
    sel.fxEl = fxEl;
    sel.carry = carry;
    sel.abEl = abText && abText.classList.contains("pt-ability") ? abText : null;
    // La vue peut dessiner son propre anneau sous l'ennemi ; sinon l'interface en place un.
    sel.ring3d = typeof (this.view && this.view.selectEnemy) === "function";
    this.v("selectEnemy", id);
    this.refreshEnemy(info);
    this.placeSel(true);
  };
  P.refreshEnemy = function (pre) {
    const sel = this.sel;
    if (!sel || sel.kind !== "enemy") return;
    const info = pre || call(this.game, "enemyInfo", sel.id);
    if (!info || info.hp <= 0) return this.closeSel();
    const D = this.D();
    const E = (D.ENEMIES && D.ENEMIES[info.type]) || {};
    // Points de vie (et bulle du druide)
    const hp = Math.max(0, Math.ceil(info.hp)),
      max = Math.max(1, Math.ceil(info.hpMax || 1));
    const t = nf(hp) + NB + "/" + NB + nf(max);
    if (sel.hpTxt.textContent !== t) {
      sel.hpTxt.textContent = t;
      const r = clamp(hp / max, 0, 1);
      sel.hpFill.style.transform = `scaleX(${r.toFixed(3)})`;
      sel.hpFill.dataset.l = r < 0.3 ? "low" : r < 0.6 ? "mid" : "";
    }
    const bm = info.barrierMax || 0,
      bv = Math.max(0, Math.ceil(info.barrier || 0));
    const bt = bm > 0 ? "bulle " + bv : "";
    if (sel.bubTxt.textContent !== bt) {
      sel.bubTxt.textContent = bt;
      sel.bubFill.style.transform = `scaleX(${bm > 0 ? clamp(bv / bm, 0, 1).toFixed(3) : 0})`;
    }
    // Faits : vitesse (en cours), bouclier
    const sp = info.speed || 0;
    const base = E.speed || sp || 1;
    const spKey = (sp <= 0 ? "stop" : sp < base * 0.92 ? "slow" : sp > base * 1.08 ? "fast" : "") + ":" + f1(sp) + ":" + (info.shield || 0);
    if (sel.spKey !== spKey) {
      sel.spKey = spKey;
      sel.facts.textContent = "";
      const word = sp <= 0 ? "Arrêté" : cap(speedWord(sp));
      sel.facts.append(h("span", { class: "pt-fact" + (sp < base * 0.92 ? " down" : sp > base * 1.08 ? " up" : ""), title: f1(sp) + " case/s" }, ico("haste"), word + " (" + f1(sp) + ")"));
      if (info.shield > 0) sel.facts.append(h("span", { class: "pt-fact", title: "Chaque coup perd " + info.shield + " dégâts (sauf le feu du berger)" }, ico("shield"), "Bouclier " + info.shield));
      if (E.gold) sel.facts.append(h("span", { class: "pt-fact", title: "Prime" }, ico("gold"), "+" + E.gold));
    }
    // Effets en cours
    const fx = info.fx || {};
    const on = Object.keys(FX).filter((k) => (typeof fx[k] === "number" ? fx[k] > 0 : !!fx[k]));
    const fk = on.join(",") + (fx.slow ? ":" + Math.round(fx.slow * 100) : "");
    if (sel.fxKey !== fk) {
      sel.fxKey = fk;
      sel.fxEl.textContent = "";
      for (const k of on) sel.fxEl.append(h("span", { class: "pt-efx-i", "data-k": k, title: FX[k] }, h("span", { class: "pt-i", html: icons().status(k) }), h("small", {}, k === "slow" ? "Ralenti −" + Math.round(fx.slow * 100) + NB + "%" : FX[k])));
      sel.fxEl.hidden = !on.length;
      if (sel.abEl) sel.abEl.classList.toggle("off", !!fx.disarmed);
      this.placeSel(true);
    }
    // Gemme portée
    const ck = info.carrying || 0;
    if (sel.carryKey !== ck) {
      sel.carryKey = ck;
      sel.carry.textContent = "";
      const gem = ck ? (this.game.state.gems || []).find((g) => g.id === ck) : null;
      if (gem) {
        const L = ((this.game.state.map && this.game.state.map.lairs) || [])[gem.lair];
        sel.carry.append(h("span", { class: "pt-i", html: icons().gem(gem.color, "carried") }), h("span", {}, h("b", {}, "Porte une gemme"), L ? " volée " + aLair(L.name) : "", " : arrête-le !"));
      }
      sel.carry.hidden = !gem;
      this.placeSel(true);
    }
  };

  // ── Menu de construction ─────────────────────────────────────────────────
  P.buildCost = function (fam, info) {
    const D = this.D();
    const c = info && ((info.costs && info.costs[fam]) || (info.buildCost && info.buildCost[fam]));
    if (c) return c;
    const base = D.FAMILIES && D.FAMILIES[fam] ? D.FAMILIES[fam].base[0].cost : 0;
    const p = this.loadP();
    const lord = { boar: "boarLord", swan: "swanLord", dog: "dogLord" }[fam];
    const r = (p.skills && p.skills[lord]) || 0;
    return Math.round(base * (1 - 0.05 * r));
  };
  P.openBuild = function (i, j, info) {
    const D = this.D();
    const s = this.game.state;
    const fams = info.buildable.filter((f) => D.FAMILIES && D.FAMILIES[f]);
    const TP = PTMT.towerPortraits;
    const perks = [];
    const hi = D.high || { range: 0.3, damage: 0.1 };
    if (info.high) perks.push(h("span", { class: "pt-perk" }, ico("high"), "Butte : +" + pc(hi.range) + " portée, +" + pc(hi.damage) + " dégâts"));
    if (info.mana) perks.push(h("span", { class: "pt-perk" }, ico("menhir"), "Menhir : +" + f1((D.mana && D.mana.perManaTower) || 0.4) + " mana/s"));
    const opts = fams.map((f) => {
      const F = D.FAMILIES[f];
      const cost = this.buildCost(f, info);
      const b = h(
        "button",
        {
          class: "pt-opt" + (cost > s.gold ? " poor" : ""),
          "data-f": f,
          "data-cost": cost,
          onclick: (e) => this.doBuild(i, j, f, e.currentTarget),
          onpointerenter: () => this.v("preview", i, j, f),
          onfocus: () => this.v("preview", i, j, f),
        },
        h("span", { class: "pt-tp", "data-f": f, html: TP ? TP.get(f, 1) : "" }),
        h("span", { class: "pt-opt-t" }, h("b", {}, F.base[0].name), h("small", {}, F.name)),
        h("span", { class: "pt-price" }, ico("gold"), h("b", { class: "pt-num" }, String(cost))),
      );
      return b;
    });
    const terrain = info.high ? "Butte" : TERRAIN[info.terrain] || "Case";
    const el = this.openSel(
      { kind: "build", i, j },
      h("div", { class: "pt-sel-in" }, h("div", { class: "pt-sel-h" }, h("span", { class: "pt-terrain", html: icons().get(info.high ? "high" : info.terrain || "grass") }), h("div", {}, h("h3", {}, "Construire"), h("small", {}, terrain + (fams.length > 1 ? " : les trois gardiens" : "")))), perks.length ? h("div", { class: "pt-perks" }, perks) : null, h("div", { class: "pt-opts" + (fams.length > 1 ? " multi" : "") }, opts)),
      "pt-build",
    );
    if (fams.length === 1 || this.layout !== "desk") this.v("preview", i, j, fams[0]);
    return el;
  };
  P.doBuild = function (i, j, f, btn) {
    const res = call(this.game, "build", i, j, f);
    if (!this.act(res, btn)) return;
    this.closeSel();
    this.tutoDone("build");
  };

  // ── Case boisée : Couper ─────────────────────────────────────────────────
  P.openForest = function (i, j, info) {
    const D = this.D();
    const s = this.game.state;
    const sc = s.spells && s.spells.cut;
    const cost = info.cutCost !== undefined ? info.cutCost : sc && sc.cost !== undefined ? sc.cost : (D.SPELLS && D.SPELLS.cut && D.SPELLS.cut.cost) || 30;
    const under = { grass: "l'herbe (sanglier)", rock: "la roche (berger)", water: "l'eau (cygne)", high: "une butte (les trois)" }[info.terrain] || "une case constructible";
    this.cutBtn = h("button", { class: "pt-btn pt-go pt-cut", onclick: (e) => this.doCut(i, j, e.currentTarget) }, ico("cut"), h("span", {}, "Couper"), h("span", { class: "pt-price mana" }, ico("mana"), h("b", { class: "pt-num" }, String(cost))));
    this.cutReason = h("small", { class: "pt-reason" });
    this.openSel(
      { kind: "forest", i, j, cost },
      h(
        "div",
        { class: "pt-sel-in" },
        h("div", { class: "pt-sel-h" }, h("span", { class: "pt-terrain", html: icons().get("forest") }), h("div", {}, h("h3", {}, "Case boisée"), h("small", {}, "Dessous : " + under))),
        h("p", { class: "pt-note" }, "Coupe le bois pour pouvoir y construire."),
        this.cutBtn,
        this.cutReason,
      ),
      "pt-forest",
    );
    this.updateCutBtn();
  };
  P.updateCutBtn = function () {
    if (!this.cutBtn || !this.sel || this.sel.kind !== "forest") return;
    const s = this.game.state;
    const sp = s.spells && s.spells.cut;
    const allowed = this.mapInfo && Array.isArray(this.mapInfo.spells) ? this.mapInfo.spells.includes("cut") : !!sp;
    const cost = sp && sp.cost !== undefined ? sp.cost : this.sel.cost;
    const reason = !sp || !allowed ? "Le sort Couper n'est pas disponible ici" : s.mana < cost ? `Il manque ${Math.ceil(cost - s.mana)} mana` : "";
    this.cutBtn.setAttribute("aria-disabled", reason ? "true" : "false");
    this.cutReason.textContent = reason;
  };
  P.doCut = function (i, j, btn) {
    if (btn.getAttribute("aria-disabled") === "true") return this.refuse(btn, this.cutReason.textContent);
    const res = call(this.game, "cast", "cut", { x: i + 0.5, y: j + 0.5 });
    if (!this.act(res, btn)) return;
    this.closeSel();
    this.tutoDone("cut");
  };

  // ── Panneau de tour ──────────────────────────────────────────────────────
  /** Clé de reconstruction du panneau : niveau, voie. Le reste (or, raisons) se met à jour en place. */
  P.towerKey = function (t) {
    return t.level + ":" + (t.spec || "");
  };
  /** Vue normalisée d'une tour : towerInfo de la simulation (next, specs { A, B }, check), complétée par les données. */
  P.towerView = function (t) {
    const D = this.D();
    const info = call(this.game, "towerInfo", t.id) || {};
    const s = this.game.state;
    const lv = info.level || t.level || 1;
    const spec = info.spec !== undefined ? info.spec : t.spec || null;
    const stats = info.stats || D.towerLevel(t.family, lv, spec) || {};
    const xpNext = info.xpNext !== undefined ? info.xpNext : lv < 7 && D.XP ? D.XP[lv] : null;
    const xp = Math.floor(info.xp !== undefined ? info.xp : t.xp || 0);
    const kills = info.kills !== undefined ? info.kills : t.kills || 0;
    const v = { t, info, stats, xp, xpNext, kills, level: lv, spec, family: t.family, name: info.name || stats.name || "", max: lv >= 7 };
    v.attack = info.attack || stats.attack || t.attack || (D.FAMILIES[t.family] && D.FAMILIES[t.family].attack) || "shot";
    v.sell = info.sell !== undefined ? info.sell : info.sellValue !== undefined ? info.sellValue : null;
    if (v.sell === null) {
      // Repli : somme des prix payés × part rendue à la revente.
      let spent = 0;
      for (let l = 1; l <= lv; l++) {
        const L = D.towerLevel(t.family, l, l >= 4 ? spec : null);
        spent += (L && L.cost) || 0;
      }
      v.sell = Math.floor(spent * ((D.economy && D.economy.sellRatio) || 0.6));
    }
    // Raison lisible d'un refus : la simulation décide (check), l'interface précise ce qui manque.
    const why = (check, cost) => {
      const needXp = xpNext !== null && xpNext !== undefined && xp < xpNext;
      if (check && check.ok) return "";
      if (check ? check.xp : needXp) return needXp ? `Il manque ${xpNext - xp} points d'expérience` : check.reason || "Expérience insuffisante";
      if (cost !== null && cost !== undefined && s.gold < cost) return `Il manque ${Math.ceil(cost - s.gold)} or`;
      return check ? check.reason || "Impossible pour l'instant" : "";
    };
    if (lv === 3) {
      const raw = info.specs || info.choices || null;
      const list = !raw ? ["A", "B"].map((k) => ({ spec: k })) : Array.isArray(raw) ? raw : ["A", "B"].filter((k) => raw[k]).map((k) => Object.assign({ spec: k }, raw[k]));
      v.specs = list.map((o) => {
        const k = o.spec || o.key || o.id;
        const F = D.FAMILIES[t.family].specs[k];
        const L = D.towerLevel(t.family, 4, k) || {};
        const cost = o.cost !== undefined && o.cost !== null ? o.cost : L.cost;
        const check = o.check || (o.ok !== undefined ? o : null);
        return { spec: k, name: o.name || F.name, blurb: o.blurb || F.blurb, cost, stats: o.stats || L, reason: why(check, cost) };
      });
    } else if (!v.max) {
      const nx = info.next || null;
      v.next = (nx && nx.stats) || D.towerLevel(t.family, lv + 1, spec) || null;
      v.nextName = (nx && nx.name) || (v.next && v.next.name) || "";
      v.cost = nx && nx.cost !== undefined && nx.cost !== null ? nx.cost : v.next ? v.next.cost : null;
      v.upReason = why(nx && nx.check, v.cost);
      v.canUp = !v.upReason;
    }
    return v;
  };
  /**
   * Lignes de caractéristiques (niveau actuel, écart avec le suivant), selon la façon d'attaquer :
   * tir (dégâts × cadence), charges (boules, dégâts par boule, recharge), jet de feu (dégâts par
   * seconde, chauffe), puis portée et effets.
   */
  P.statRows = function (st, nx, mode) {
    const rows = [];
    const row = (icon, label, cur, next, title) => rows.push(h("div", { class: "pt-stat", title: title || label }, ico(icon), h("span", { class: "pt-stat-l" }, label), h("b", { class: "pt-num" }, cur), next && next !== cur ? h("em", { class: "pt-num" }, "→ " + next) : null));
    const N = nx || {};
    const has = (k) => st[k] !== undefined || N[k] !== undefined;
    const sec = (v) => f1(v) + NB + "s";
    mode = mode || st.attack || "shot";
    const deg = (a) => Math.round((a * 180) / Math.PI) + "°";
    if (mode === "cone") {
      row("burn", "Flammes", nf(st.dps) + "/s", N.dps ? nf(N.dps) + "/s" : null, "Dégâts par seconde à chaque ennemi pris dans le cône");
      if (st.heatMax) {
        const nx = [];
        if (N.heatMax && N.heatMax !== st.heatMax) nx.push("× " + f1(N.heatMax));
        if (N.heatTime && N.heatTime !== st.heatTime) nx.push("en " + sec(N.heatTime));
        row("heat", "Chauffe", "× " + f1(st.heatMax) + " en " + sec(st.heatTime), nx.join(" ") || null, `Plus il souffle, plus ça brûle : × ${f1(st.heatMax)} au bout de ${f1(st.heatTime)} s, soit ${nf(st.dps * st.heatMax)} dégâts/s à chaque ennemi du cône`);
      }
      row("splash", "Ouverture", deg(st.cone || 0.9), N.cone && N.cone !== st.cone ? deg(N.cone) : null, "Largeur du cône de flammes : tout ce qui s'y trouve brûle");
    } else if (mode === "beam") {
      row("burn", "Feu", nf(st.dps) + "/s", N.dps ? nf(N.dps) + "/s" : null, "Dégâts par seconde du jet, dès qu'il touche");
      if (st.heatMax) {
        const nx = [];
        if (N.heatMax && N.heatMax !== st.heatMax) nx.push("× " + f1(N.heatMax));
        if (N.heatTime && N.heatTime !== st.heatTime) nx.push("en " + sec(N.heatTime));
        row("heat", "Chauffe", "× " + f1(st.heatMax) + " en " + sec(st.heatTime), nx.join(" ") || null, `Plus il tient sa cible, plus ça brûle : × ${f1(st.heatMax)} au bout de ${f1(st.heatTime)} s, soit ${nf(st.dps * st.heatMax)} dégâts/s`);
      }
    } else if (mode === "charges") {
      const nb = (n) => n + " boule" + (n > 1 ? "s" : "");
      row("charges", "Charges", nb(st.charges || 0), N.charges ? nb(N.charges) : null, st.nova ? "Boules gardées en réserve : chacune part en onde de glace" : st.volley ? "Boules lâchées toutes à la fois, chacune sur un ennemi différent" : "Boules d'eau gardées en réserve et lâchées d'un coup sur les ennemis");
      if (st.nova) row("freeze", "Par onde", nf(st.dmg), N.dmg ? nf(N.dmg) : null, "Dégâts de chaque onde, à tous les ennemis à portée");
      else row("damage", "Par boule", nf(st.dmg), N.dmg ? nf(N.dmg) : null, "Dégâts de chaque boule (en zone)");
      if (st.reload) row("rate", "Recharge", sec(st.reload), N.reload ? sec(N.reload) : null, "Une boule revient toutes les " + sec(st.reload) + ", l'une après l'autre");
    } else {
      row("damage", "Dégâts × cadence", nf(st.dmg) + " × " + f1(st.rate), N.dmg ? nf(N.dmg) + " × " + f1(N.rate) : null, "Dégâts par bogue × bogues par seconde");
    }
    if (st.range) row("range", "Portée", f1(st.range), N.range ? f1(N.range) : null, "Portée en cases");
    if ((st.multi || 1) > 1 || (N.multi || 1) > 1) row("shot", "Cibles", (st.multi || 1) + " à la fois", N.multi ? N.multi + " à la fois" : null, "Vise plusieurs ennemis à la fois");
    if ((st.beams || 1) > 1 || (N.beams || 1) > 1) row("beam", mode === "cone" ? "Têtes" : "Jets", (st.beams || 1) + (mode === "cone" ? " cône" + ((st.beams || 1) > 1 ? "s" : "") : " à la fois"), N.beams ? N.beams + (mode === "cone" ? " cônes" : " à la fois") : null, mode === "cone" ? "Chaque tête souffle son propre cône, vers un ennemi différent" : "Crache plusieurs jets sur des ennemis différents");
    if (has("chain")) {
      const ch = (c) => (c ? ((c.count || 1) > 1 ? c.count + " × " : "") + pc(c.pct) : "—");
      row("beam", "Rebond", ch(st.chain), N.chain ? ch(N.chain) : null, st.chain ? `Le jet rebondit sur ${(st.chain.count || 1) > 1 ? st.chain.count + " ennemis proches" : "un second ennemi proche"} (${pc(st.chain.pct)} des dégâts)` : "Le jet rebondit sur un ennemi proche");
    }
    if (st.splash) {
      if (mode === "beam") row("splash", "Embrase", pc(st.splashPct || 0.4) + " autour", N.splashPct ? pc(N.splashPct) + " autour" : null, `Les flammes lèchent les ennemis à ${f1(st.splash)} case de la cible`);
      else row("splash", "Zone", f1(st.splash), N.splash ? f1(N.splash) : null, "Rayon des dégâts de zone (cases)");
    }
    if (st.slow) row("slow", "Ralentit", "−" + pc(st.slow.pct), N.slow ? "−" + pc(N.slow.pct) : null, `Ralentit de ${pc(st.slow.pct)} pendant ${f1(st.slow.t)} s`);
    if (has("crit")) row("crit", "Critique", st.crit ? pc(st.crit.chance) + " × " + f1(st.crit.mult) : "—", N.crit ? pc(N.crit.chance) + " × " + f1(N.crit.mult) : null, st.crit ? `Coup critique : ${pc(st.crit.chance)} des tirs font × ${f1(st.crit.mult)} dégâts` : "Coups critiques");
    if (has("stun")) row("stun", "Étourdit", st.stun ? pc(st.stun.chance) : "—", N.stun ? pc(N.stun.chance) : null, st.stun ? `Étourdit ${f1(st.stun.t)} s` : "Étourdit");
    if (has("fear")) row("fear", "Peur", st.fear ? pc(st.fear.chance) : "—", N.fear ? pc(N.fear.chance) : null, st.fear ? `L'ennemi recule ${f1(st.fear.t)} s` : "Fait reculer de peur");
    if (has("freeze")) row("freeze", "Gel", st.freeze ? pc(st.freeze.chance) : "—", N.freeze ? pc(N.freeze.chance) : null, st.freeze ? `Gèle ${f1(st.freeze.t)} s` : "Gèle sur place");
    if (st.burn) row("burn", "Brûlure", f1(st.burn.dps) + "/s", N.burn ? f1(N.burn.dps) + "/s" : null, `La cible brûle encore ${f1(st.burn.t)} s`);
    if (st.radiance) row("radiance", "Rayonnement", "+" + pc(st.radiance.pct), N.radiance ? "+" + pc(N.radiance.pct) : null, "La cible prend plus de dégâts de toutes les tours");
    if (st.corpse) row("splash", "Explosion", pc(st.corpse), N.corpse ? pc(N.corpse) : null, "Un ennemi vaincu explose : part de ses PV max infligée autour");
    if (st.mana) row("manaSteal", "Vol de mana", "+" + f1(st.mana), N.mana ? "+" + f1(N.mana) : null, "Mana rendu à chaque coup");
    if (st.disarm) row("disarm", "Désarme", pc(st.disarm), N.disarm ? pc(N.disarm) : null, "Chance de retirer la capacité de l'ennemi (bouclier, bulle, soin, fumigène, flash…)");
    if (st.pierce) row("pierce", "Perce", "boucliers", null, "Traverse le bouclier des ennemis");
    return rows;
  };
  /** Bloc « façon d'attaquer » du panneau de tour, avec sa jauge en direct (charges, chauffe). */
  P.attackBlock = function (mode, st) {
    const A = attackOf(mode, st);
    const live = { mode };
    const kids = [h("div", { class: "pt-atk-h" }, ico(A.icon), h("b", {}, A.name), h("small", {}, A.text))];
    if (mode === "charges") {
      live.pips = h("span", { class: "pt-pips-c" });
      live.ammoTxt = h("small", { class: "pt-atk-v" }, "");
      kids.push(h("div", { class: "pt-atk-live" }, live.pips, live.ammoTxt));
    } else if (mode === "beam" || mode === "cone") {
      live.heatFill = h("i", { class: "pt-heat-fill" });
      live.heatTxt = h("b", { class: "pt-num" }, "");
      live.heatCap = h("small", { class: "pt-atk-v" }, "");
      live.heatEl = h(
        "div",
        { class: "pt-atk-live pt-heat", title: `Chauffe : × 1 au début, × ${f1(st.heatMax || 2)} au bout de ${f1(st.heatTime || 3)} s sur la même cible` },
        h("span", { class: "pt-heat-bar" }, live.heatFill, h("i", { class: "pt-heat-x0" }, "×1"), h("i", { class: "pt-heat-x1" }, "×" + f1(st.heatMax || 2))),
        live.heatTxt,
        live.heatCap,
      );
      kids.push(live.heatEl);
    }
    return { el: h("div", { class: "pt-atk", "data-a": mode }, kids), live };
  };
  /** Jauges du panneau de tour, à chaque image : éblouie, charges prêtes, chauffe du jet. */
  P.towerGauges = function () {
    const sel = this.sel;
    if (!sel || sel.kind !== "tower" || !sel.live) return;
    const t = (this.game.state.towers || []).find((x) => x.id === sel.id);
    if (!t) return;
    const L = sel.live;
    const dz = t.dazzled > 0 ? Math.ceil(t.dazzled * 10) / 10 : 0;
    if (L.dz !== dz) {
      const was = L.dz;
      L.dz = dz;
      L.dazEl.hidden = !dz;
      if (dz) L.dazT.textContent = f1(dz) + NB + "s";
      if (!dz !== !was) this.placeSel(true);
    }
    if (L.pips) {
      const max = t.ammoMax || (sel.st && sel.st.charges) || 0;
      if (max !== L.max) {
        L.max = max;
        L.pips.textContent = "";
        L.pipEls = Array.from({ length: max }, () => L.pips.appendChild(h("i", {}, h("b", {}))));
        L.ammo = -1;
      }
      const a = Math.round(clamp(t.ammo || 0, 0, max) * 20) / 20;
      if (a !== L.ammo) {
        L.ammo = a;
        L.pipEls.forEach((el, k) => {
          const f = clamp(a - k, 0, 1);
          el.style.setProperty("--f", f.toFixed(2));
          el.classList.toggle("full", f >= 1);
        });
        const ready = Math.floor(a + 1e-6);
        L.ammoTxt.textContent = ready + NB + "/" + NB + max + " prête" + (ready > 1 ? "s" : "");
      }
    }
    if (L.heatEl) {
      const beams = (L.mode === "cone" ? t.cones : t.beams) || [];
      let heat = 0;
      for (const b of beams) heat = Math.max(heat, b.heat || 0);
      const hv = Math.round(heat * 40) / 40;
      const firing = beams.length > 0 && !(t.dazzled > 0);
      if (hv !== L.hv || firing !== L.firing || beams.length !== L.nb) {
        L.hv = hv;
        L.firing = firing;
        L.nb = beams.length;
        const st = sel.st || {};
        L.heatFill.style.transform = `scaleX(${firing ? hv.toFixed(3) : 0})`;
        L.heatTxt.textContent = firing ? "× " + f1(1 + ((st.heatMax || 2) - 1) * hv) : "";
        L.heatCap.textContent = firing ? (beams.length > 1 ? (L.mode === "cone" ? "Deux cônes en feu" : "Deux jets en feu") : hv >= 1 ? "Brûlant !" : "Ça chauffe…") : "Attend une cible";
        L.heatEl.classList.toggle("on", firing);
        L.heatEl.classList.toggle("max", firing && hv >= 1);
      }
    }
  };
  P.stars = function (level) {
    return h("span", { class: "pt-stars", "aria-label": "Niveau " + level + " sur 7" }, Array.from({ length: 7 }, (_, i) => h("i", { class: i < level ? "on" + (i >= 3 ? " sp" : "") : "", html: icons().get(i < level ? "star" : "starEmpty") })));
  };
  P.openTower = function (id, i, j, keep) {
    const s = this.game.state;
    const t = (s.towers || []).find((x) => x.id === id);
    if (!t) return this.closeSel();
    const D = this.D();
    const TP = PTMT.towerPortraits;
    const v = this.towerView(t);
    const F = D.FAMILIES[t.family] || { name: t.family };
    const accent = TP ? TP.accent(t.family, v.level, v.spec) : "#8a5a32";
    const xpTxt = h("b", { class: "pt-num" }, "");
    const xpFill = h("i", {});
    const kills = h("small", { class: "pt-kills" }, "");
    const head = h(
      "div",
      { class: "pt-tw-h" },
      h("span", { class: "pt-tp big", "data-f": t.family, style: `--acc:${accent}`, html: TP ? TP.get(t.family, v.level, v.spec) : "" }),
      h("div", { class: "pt-tw-n" }, h("h3", {}, v.name || F.name), h("small", {}, F.name + (v.spec ? " · voie " + v.spec : "")), this.stars(v.level)),
    );
    const xp = h("div", { class: "pt-xp" + (v.max ? " max" : "") }, h("div", { class: "pt-xp-h" }, ico("xp"), h("span", {}, "Expérience"), xpTxt), h("div", { class: "pt-bar" }, xpFill), kills);
    const dazT = h("small", { class: "pt-num" }, "");
    const daz = h("div", { class: "pt-dazzled", hidden: true, title: "Un touriste l'a éblouie d'un coup de flash : elle ne tire plus un moment" }, ico("dazzle"), h("b", {}, "Éblouie !"), dazT);
    const atk = this.attackBlock(v.attack, v.stats);
    atk.live.dazEl = daz;
    atk.live.dazT = dazT;
    const stats = h("div", { class: "pt-stats" + (v.next ? " deltas" : "") }, this.statRows(v.stats, v.next, v.attack));
    const actions = h("div", { class: "pt-tw-a" });
    if (v.specs) {
      actions.append(h("div", { class: "pt-spec-t" }, "Spécialisation : choisis une voie"));
      const row = h("div", { class: "pt-specs" });
      for (const o of v.specs) {
        const reason = h("em", { class: "pt-reason" });
        const price = h("span", { class: "pt-price" }, ico("gold"), h("b", { class: "pt-num" }, String(o.cost)));
        const btn = h(
          "button",
          { class: "pt-speccard", "data-spec": o.spec, onclick: (e) => this.doUpgrade(t.id, o.spec, e.currentTarget, e.currentTarget.dataset.reason || "") },
          h("span", { class: "pt-spec-l" }, o.spec),
          h("span", { class: "pt-tp", "data-f": t.family, html: TP ? TP.get(t.family, 4, o.spec) : "" }),
          h("b", { class: "pt-speccard-n" }, o.name),
          h("small", { title: o.blurb }, o.blurb),
          price,
          reason,
        );
        btn._reason = reason;
        btn._price = price;
        row.append(btn);
      }
      actions.append(row);
    } else if (!v.max) {
      const nextName = v.nextName && v.nextName !== v.name ? v.nextName : "Niveau " + (v.level + 1);
      actions.append(
        h(
          "button",
          { class: "pt-btn pt-go pt-up", onclick: (e) => this.doUpgrade(t.id, null, e.currentTarget, e.currentTarget.dataset.reason || "") },
          ico("upgrade"),
          h("span", { class: "pt-up-t" }, h("b", {}, "Améliorer"), h("small", {}, nextName)),
          h("span", { class: "pt-price" }, ico("gold"), h("b", { class: "pt-num" }, v.cost !== null && v.cost !== undefined ? String(v.cost) : "—")),
        ),
        h("small", { class: "pt-reason" }),
      );
    } else actions.append(h("div", { class: "pt-maxed" }, ico("crown"), "Évolution finale"));
    const sellTxt = h("b", { class: "pt-num" }, v.sell !== null ? "+" + v.sell : "");
    const armed = keep && this.sel && this.sel.kind === "tower" && this.sel.id === id && this.sel.sellArm && performance.now() - this.sel.sellArm <= 2500;
    const sell = h("button", { class: "pt-btn pt-red pt-sell" + (armed ? " armed" : ""), title: "Revendre la tour", onclick: (e) => this.doSell(t.id, e.currentTarget) }, ico("sell"), h("span", { class: "pt-sell-l" }, armed ? "Confirmer ?" : "Vendre"), h("span", { class: "pt-price" }, ico("gold"), sellTxt));
    const body = h("div", { class: "pt-sel-in pt-tw" + (v.specs ? " choose" : ""), "data-a": v.attack, style: `--acc:${accent}` }, head, daz, atk.el, xp, stats, actions, h("div", { class: "pt-tw-f" }, sell));
    const prevSell = keep && this.sel && this.sel.kind === "tower" && this.sel.id === id ? this.sel.sellArm : 0;
    this.openSel({ kind: "tower", id, i: t.i !== undefined ? t.i : i, j: t.j !== undefined ? t.j : j }, body, "pt-tower" + (v.specs ? " wide" : ""));
    const sel = this.sel;
    sel.key = this.towerKey(t);
    sel.xpTxt = xpTxt;
    sel.xpFill = xpFill;
    sel.kills = kills;
    sel.sellTxt = sellTxt;
    sel.sellArm = prevSell;
    sel.upBtn = body.querySelector(".pt-up");
    sel.upReason = sel.upBtn ? sel.upBtn.nextSibling : null;
    sel.specBtns = [...body.querySelectorAll(".pt-speccard")];
    sel.live = atk.live;
    sel.st = v.stats;
    this.updateTowerLive(t, v);
    this.towerGauges();
    this.placeSel(true);
    this.v("showRange", id);
    if (!keep) this.tutoDone("tower");
  };
  P.updateTowerLive = function (t, view) {
    const sel = this.sel;
    if (!sel || !sel.xpTxt) return;
    // Boutons : disponibilité et raison du refus (or, expérience), sans reconstruire le panneau.
    const v = view || this.towerView(t);
    let changed = false;
    if (sel.upBtn) {
      const r = v.upReason || "";
      if (sel.upBtn.dataset.reason !== r || sel.upBtn.getAttribute("aria-disabled") === null) {
        sel.upBtn.dataset.reason = r;
        sel.upBtn.setAttribute("aria-disabled", r ? "true" : "false");
        sel.upBtn.classList.toggle("pt-pulse-s", !r);
        if (sel.upReason) sel.upReason.textContent = r;
        changed = true;
      }
    }
    if (sel.specBtns && v.specs)
      for (const b of sel.specBtns) {
        const o = v.specs.find((x) => x.spec === b.dataset.spec);
        const r = (o && o.reason) || "";
        if (b.dataset.reason !== r || b.getAttribute("aria-disabled") === null) {
          b.dataset.reason = r;
          b.setAttribute("aria-disabled", r ? "true" : "false");
          b.classList.toggle("off", !!r);
          b._price.classList.toggle("off", !!r);
          b._reason.textContent = r;
          changed = true;
        }
      }
    if (changed && !view) this.placeSel(true);
    if (v.sell !== null && v.sell !== undefined) {
      const st = "+" + v.sell;
      if (sel.sellTxt.textContent !== st) sel.sellTxt.textContent = st;
    }
    const lv = v.level || t.level || 1;
    const need = v.xpNext || 0;
    const xp = v.xp;
    const txt = lv >= 7 ? "maximum" : xp + NB + "/" + NB + need;
    if (sel.xpTxt.textContent !== txt) {
      sel.xpTxt.textContent = txt;
      sel.xpFill.style.transform = `scaleX(${lv >= 7 ? 1 : clamp(need ? xp / need : 1, 0, 1).toFixed(3)})`;
      sel.xpFill.parentNode.classList.toggle("full", lv < 7 && xp >= need);
    }
    const kn = v.kills || 0;
    const k = kn ? kn + " ennemi" + (kn > 1 ? "s" : "") + " vaincu" + (kn > 1 ? "s" : "") : "";
    if (sel.kills.textContent !== k) sel.kills.textContent = k;
  };
  P.doUpgrade = function (id, spec, btn, reason) {
    if (reason) return this.refuse(btn, reason);
    const res = call(this.game, "upgrade", id, spec || undefined);
    if (!this.act(res, btn)) return;
    const t = (this.game.state.towers || []).find((x) => x.id === id);
    if (t) this.openTower(id, t.i, t.j, true);
  };
  P.doSell = function (id, btn) {
    const sel = this.sel;
    if (!sel) return;
    // Deux temps : le premier toucher arme le bouton, le second (dans les 2,5 s) vend.
    const now = performance.now();
    if (!sel || !sel.sellArm || now - sel.sellArm > 2500) {
      sel.sellArm = now;
      btn.classList.add("armed");
      btn.querySelector(".pt-sell-l").textContent = "Confirmer ?";
      setTimeout(() => {
        if (this.sel === sel && btn.isConnected) {
          btn.classList.remove("armed");
          btn.querySelector(".pt-sell-l").textContent = "Vendre";
          sel.sellArm = 0;
        }
      }, 2500);
      return;
    }
    const res = call(this.game, "sell", id);
    if (!this.act(res, btn)) return;
    this.closeSel();
  };

  /* ------------------------------------------------------------------ événements de la simulation */
  /**
   * Nature d'un événement et type d'ennemi concerné. La simulation fabrique ses événements par
   * Object.assign({ type: nom }, données) : quand les données portent un type d'ennemi (spawn, kill,
   * newEnemy, bossArrives), celui-ci remplace le nom. On reconnaît alors l'événement à ses champs.
   * Un champ enemyType (ou enemy) est aussi accepté, si la simulation le fournit un jour.
   */
  P.evKind = function (e) {
    const D = this.D();
    const t = e.type;
    if (!(D.ENEMIES && D.ENEMIES[t])) return { kind: t, enemy: e.enemyType || e.enemy || null };
    let kind = "unknown";
    if (e.entrance !== undefined) kind = "spawn";
    else if (e.gold !== undefined && e.x !== undefined) kind = "kill";
    else if (e.name !== undefined && e.enemyId !== undefined) kind = "bossArrives";
    else if (e.enemyId === undefined) kind = "newEnemy";
    return { kind, enemy: t };
  };
  // Arrivée d'ennemis à surprise : une annonce par vague (et pas plus d'une par minute et par type).
  const ARRIVAL = {
    montgolfiere: ["fly", "Montgolfières en approche : elles volent droit vers les gemmes !"],
    korrigan: ["blink", "Des korrigans arrivent : touchés, ils réapparaissent plus loin !"],
    tracteur: ["split", "Un tracteur arrive : blindé, il lâche des agriculteurs en cassant"],
    touriste: ["dazzle", "Des touristes arrivent : leur flash éblouit les tours !"],
  };
  P.events = function (list) {
    if (!list || !list.length || this.mode !== "game" || !this.game) return;
    const s = this.game.state;
    // Types présentés par une fiche « Nouvel ennemi » dans ce lot : pas d'annonce en double.
    const fresh = new Set();
    for (const e of list) {
      const { kind, enemy } = this.evKind(e);
      if (kind === "newEnemy" && enemy) fresh.add(enemy);
    }
    for (const e of list) {
      const { kind, enemy } = this.evKind(e);
      switch (kind) {
        case "newEnemy":
          this.newEnemy(enemy);
          break;
        case "waveStart":
          this.waveBanner(e.index);
          this.fzT = 0;
          this.tutoDone("wave");
          break;
        case "bossArrives":
          this.bossBanner(e.name, enemy);
          break;
        case "earlyBonus":
          if (e.gold) this.toast("Vague appelée en avance : +" + e.gold + " or", "gold");
          break;
        case "spawn": {
          const A = ARRIVAL[enemy];
          const w = (s.wave && s.wave.index) || 0;
          if (A && !fresh.has(enemy) && !(this.annWave[enemy] >= w)) {
            this.annWave[enemy] = w;
            this.announce("arrive:" + enemy, 60, A[1], "bad", A[0]);
          }
          break;
        }
        case "kill":
          if (e.gold) this.fly(e.x, e.y, "+" + e.gold, "gold");
          if (this.sel && this.sel.kind === "enemy" && this.sel.id === e.enemyId) this.closeSel();
          break;
        case "steal": {
          const L = this.lairName(e.lairId);
          this.toast("Une gemme a été volée " + (L ? aLair(L) : "") + " !", "bad", "warning");
          if (e.lairId !== undefined) this.lairAlarm(e.lairId);
          this.bump(this.gemsEl, "bad");
          this.tutoStep("steal");
          break;
        }
        case "drop":
          this.fly(e.x, e.y, "Gemme tombée !", "gem");
          this.tutoStep("drop", e);
          break;
        case "escape":
          if (this.sel && this.sel.kind === "enemy" && this.sel.id === e.enemyId) this.closeSel();
          // Un ennemi sorti sans gemme ne coûte rien : seul un porteur fait perdre une gemme.
          if (e.gemId === null || e.gemId === undefined) break;
          this.toast("Une gemme est perdue…", "bad");
          this.bump(this.gemsEl, "bad");
          break;
        case "gemReturn": {
          const L = this.lairName(e.lairId);
          this.toast("Une gemme est revenue " + (L ? aLair(L) : "à sa cachette"), "good");
          break;
        }
        case "secretOpen":
          this.announce("secret", 3, "Un passage secret s'ouvre dans le fourré !", "bad", "secret");
          break;
        case "tide":
          this.announce("tide", 3, e.state === "low" ? "La mer se retire : l'estran devient un chemin !" : "La mer remonte : l'estran redevient de l'eau !", "info", e.state === "low" ? "tideLow" : "tideHigh");
          break;
        case "gateOpen": {
          const ent = this.entranceById(e.entranceId);
          const letter = e.letter || (ent && ent.letter) || "";
          this.toast(`La barrière ${letter} cède : nouvelle entrée !`.replace("  ", " "), "bad", "gate");
          break;
        }
        case "flash":
          this.announce("flash", 8, (e.towerIds || []).length > 1 ? "Flash ! Des tours sont éblouies" : "Flash ! Une tour est éblouie", "bad", "dazzle");
          break;
        case "blink":
          this.announce("blink", 25, "Pouf ! Le korrigan réapparaît plus loin sur sa route", "info", "blink");
          break;
        case "split":
          this.announce("split", 8, "Le tracteur casse : des agriculteurs en sautent !", "info", "split");
          break;
        case "cut":
          if (this.sel && this.sel.kind === "forest" && this.sel.i === e.i && this.sel.j === e.j) this.closeSel();
          if (e.gold) this.fly(e.i + 0.5, e.j + 0.5, "+" + e.gold, "gold");
          break;
        case "frenzy":
          if (e.on && e.t) this.frenzyDur = e.t;
          break;
        case "meteorImpact":
          this.bump(this.spellBtn.meteor, "good");
          break;
        case "win":
        case "lose":
          // Résultat déjà enregistré par l'intégrateur : { firstWin, points, unlocked, best }.
          if (e.record) this.record = e.record;
          this.fzT = 0;
          break;
      }
    }
  };
  /** Nom d'une cachette (« Le moulin », « Le vieux puits »…). */
  P.lairName = function (id) {
    const L = this.game && this.game.state.map && this.game.state.map.lairs && this.game.state.map.lairs[id];
    return L ? L.name : "";
  };
  /** Annonce courte, au plus une fois par période (cooldown en secondes) pour une même clé. */
  P.announce = function (key, cooldown, text, kind, icon) {
    this.annT = this.annT || {};
    const t0 = this.annT[key];
    if (t0 !== undefined && this.t - t0 < cooldown) return;
    this.annT[key] = this.t;
    this.toast(text, kind, icon);
  };
  /** Premier ennemi d'un type dans la partie : fiche seulement s'il n'a jamais été rencontré. */
  P.newEnemy = function (type) {
    if (!type) return;
    const pr = this.prog();
    if (pr) {
      const p = this.loadP();
      if (p.seen && p.seen[type]) return;
      call(pr, "markSeen", p, type);
      if (p.seen) p.seen[type] = true;
      this.saveP(p);
    }
    this.queueModal(() => this.newEnemyCard(type));
  };

  /* ------------------------------------------------------------------ fiches (modales) */
  P.queueModal = function (fn) {
    if (this.modal) this.modalQueue.push(fn);
    else fn();
  };
  /** Ouvre une fiche modale ; pause la partie si besoin, la reprend à la fermeture. */
  P.openModal = function (card, o) {
    o = o || {};
    this.closeModal(true);
    this.hideTip();
    const g = this.game;
    let resume = false;
    if (g && o.pause !== false && !g.state.over) {
      resume = !g.state.paused;
      if (resume) call(g, "setPaused", true);
    }
    const back = h("div", { class: "pt-modal" + (o.cls ? " " + o.cls : ""), role: "dialog", "aria-modal": "true", onclick: (e) => e.target === back && o.dismiss !== false && this.closeModal() }, card);
    this.modalLayer.append(back);
    this.modal = { el: back, resume, onClose: o.onClose, enter: o.enter };
    this.pausedBanner(false);
    setTimeout(() => {
      const f = card.querySelector("[data-focus]") || card.querySelector("button");
      if (f && !this.mobile) f.focus({ preventScroll: true });
    }, 60);
    return back;
  };
  P.closeModal = function (silent) {
    const m = this.modal;
    if (!m) return;
    this.modal = null;
    m.el.classList.add("pt-out");
    setTimeout(() => m.el.remove(), 180);
    if (m.resume && this.game && !this.game.state.over) call(this.game, "setPaused", false);
    if (!silent && m.onClose) m.onClose();
    if (!silent && this.modalQueue.length) {
      const next = this.modalQueue.shift();
      setTimeout(() => next(), 220);
    }
    if (this.game && this.game.state.paused && !this.modal) this.pausedBanner(true);
  };
  P.newEnemyCard = function (type) {
    if (!type || !this.game) return;
    const D = this.D();
    const E = (D.ENEMIES && D.ENEMIES[type]) || {};
    const d = Object.assign({}, E, call(this.game, "describeEnemy", type) || {});
    const abi = E.ability && ABILITY[E.ability.kind] ? ABILITY[E.ability.kind](E.ability) : null;
    const abText = typeof d.ability === "string" ? d.ability : abi ? abi[1] + " : " + abi[2] : "Aucune capacité spéciale";
    const card = h(
      "div",
      { class: "pt-card pt-newe pt-pop-in" },
      h("div", { class: "pt-ribbon" }, h("span", {}, "Nouvel ennemi" + NB + "!")),
      h("div", { class: "pt-newe-p" }, this.enemyPortrait(type, false, false, "huge")),
      h("h2", {}, d.name || type),
      d.role || E.ct ? h("div", { class: "pt-muted pt-newe-role" }, "Rôle : ", d.role || E.ct) : null,
      h("div", { class: "pt-facts" }, h("span", { class: "pt-fact" }, ico("heal"), nf(d.hp || E.hp || 0) + " PV"), h("span", { class: "pt-fact" }, ico("haste"), cap(speedWord(d.speed || E.speed || 1)) + " (" + f1(d.speed || E.speed || 1) + " case/s)"), E.gold ? h("span", { class: "pt-fact" }, ico("gold"), "+" + E.gold) : null),
      h("div", { class: "pt-ability" }, ico(abi ? abi[0] : "info"), h("span", {}, abText)),
      E.blurb ? h("p", { class: "pt-newe-b" }, E.blurb) : null,
      h("small", { class: "pt-muted" }, "Les champions portent une couronne dorée : " + f1((D.champion && D.champion.hp) || 3.5) + " fois plus de PV."),
      h("button", { class: "pt-btn pt-go pt-big", "data-focus": "", onclick: () => this.closeModal() }, ico("check"), "Compris" + NB + "!"),
    );
    this.openModal(card, { cls: "pt-m-newe", enter: () => this.closeModal() });
  };
  P.openPause = function () {
    if (!this.game || this.game.state.over) return;
    if (this.modal) return this.closeModal();
    this.cancelAim();
    const s = this.game.state;
    const p = this.loadP();
    const q = (p.settings && p.settings.quality) || "auto";
    const QN = { auto: "Automatique", high: "Haute", low: "Économe" };
    const qBtn = h("button", { class: "pt-btn pt-wood", onclick: () => this.cycleQuality(qBtn) }, ico("quality"), h("span", {}, "Qualité : ", h("b", {}, QN[q] || q)));
    const w = s.wave || {};
    const card = h(
      "div",
      { class: "pt-card pt-pausecard pt-pop-in" },
      h("div", { class: "pt-ribbon" }, h("span", {}, "Pause")),
      h("div", { class: "pt-pause-m" }, h("b", {}, (s.map && s.map.name) || (this.mapInfo && this.mapInfo.name) || ""), h("small", {}, `Mission ${this.level} · ` + (typeof w.index === "number" && w.index >= 0 ? `vague ${w.index + 1} sur ${w.total || "?"}` : "avant la première vague"))),
      h(
        "div",
        { class: "pt-col" },
        h("button", { class: "pt-btn pt-go pt-big", "data-focus": "", onclick: () => this.closeModal() }, ico("play"), "Reprendre"),
        h("button", { class: "pt-btn pt-wood", onclick: () => this.restart() }, ico("restart"), "Recommencer"),
        h("button", { class: "pt-btn pt-wood", onclick: () => this.quit() }, ico("map"), "Missions"),
        qBtn,
      ),
      this.layout === "desk"
        ? h("div", { class: "pt-keys" }, [["Espace", "pause"], ["1 2 3", "vitesse"], ["Q W E", "sorts"], ["Entrée", "appeler la vague"], ["Échap", "annuler"]].map(([k, t]) => h("span", {}, h("kbd", {}, k), " " + t)))
        : null,
    );
    this.openModal(card, { cls: "pt-m-pause" });
  };
  P.cycleQuality = function (btn) {
    const order = ["auto", "high", "low"];
    const QN = { auto: "Automatique", high: "Haute", low: "Économe" };
    const p = this.loadP();
    p.settings = p.settings || {};
    const q = order[(order.indexOf(p.settings.quality || "auto") + 1) % order.length];
    p.settings.quality = q;
    this.saveP(p);
    call(this.hooks, "setQuality", q);
    btn.querySelector("b").textContent = QN[q];
  };
  P.restart = function () {
    this.closeModal(true);
    if (typeof this.hooks.restartLevel === "function") this.hooks.restartLevel();
  };
  P.quit = function (to) {
    this.closeModal(true);
    const lv = this.level;
    // Mission tout juste ouverte : son médaillon s'anime quand la carte est vraiment à l'écran.
    const fresh = this.justUnlocked || 0;
    if (typeof this.hooks.quitLevel === "function") this.hooks.quitLevel();
    if (this.mode === "game" || (to && this.mode !== "map")) this.showMap(fresh || lv);
    if (to === "skills") {
      this.justUnlocked = fresh;
      this.showSkills();
      const pr = this.prog();
      const free = pr ? call(pr, "pointsFree", this.loadP()) || 0 : 0;
      if (free > 0) this.toast(free > 1 ? `${free} points de compétence à placer` : "1 point de compétence à placer", "good", "skillPoint");
    }
  };
  /**
   * Victoire ou défaite. Le résultat est déjà enregistré par l'intégrateur : l'événement win / lose
   * porte record = { firstWin, points, unlocked, best } ; sans lui, simple affichage (rien n'est écrit).
   */
  P.showResult = function (over) {
    if (!this.game) return;
    const D = this.D();
    const rec = this.record || null;
    const first = rec ? !!rec.firstWin : over.win && !this.wasWon;
    const pts = rec ? rec.points || 0 : first ? D.pointsPerLevel || 3 : 0;
    const opened = rec && rec.unlocked ? rec.unlocked : 0;
    if (over.win) this.wasWon = true;
    if (opened) this.justUnlocked = opened;
    const total = over.gemsTotal || (this.game.state.gems || []).length || 5;
    const gems = this.game.state.gems || [];
    const left = over.gemsLeft || 0;
    const row = h("div", { class: "pt-gemrow big" }, Array.from({ length: total }, (_, i) => h("span", { class: "pt-rgem", style: `--i:${i}` }, ico(icons().gem(gems[i] ? gems[i].color : i % 6, i < left ? "lair" : "lost")))));
    let card;
    if (over.win) {
      const best = rec && rec.best;
      // Mission rejouée : nouveau record, ou rappel du record à battre.
      const better = !first && this.prevBest !== undefined && left > this.prevBest;
      const record = better
        ? h("div", { class: "pt-newbest" }, ico("trophy"), "Nouveau record !")
        : best && !first && best.bestGems > left
          ? h("small", { class: "pt-muted" }, `Ton record reste ${best.bestGems} gemme${best.bestGems > 1 ? "s" : ""} sur ${best.gemsTotal || total}.`)
          : null;
      const nextMap = opened ? this.maps()[opened] : null;
      card = h(
        "div",
        { class: "pt-card pt-result win pt-pop-in" },
        h("div", { class: "pt-ribbon gold" }, h("span", {}, "Victoire !")),
        over.brilliant ? h("div", { class: "pt-brilliant big" }, h("span", { class: "pt-crown", html: icons().get("crown") }), h("b", {}, "Brillant !"), h("small", {}, "Aucune gemme perdue")) : null,
        h("p", { class: "pt-result-t" }, `${left} gemme${left > 1 ? "s" : ""} sauvée${left > 1 ? "s" : ""} sur ${total}`),
        row,
        h(
          "div",
          { class: "pt-gains" },
          pts > 0
            ? h("button", { class: "pt-reward", title: "Placer les points de compétence", onclick: () => this.quit("skills") }, ico("skillPoint"), h("span", { class: "pt-reward-t" }, h("b", {}, "+" + pts + " points de compétence"), h("small", {}, this.mobile ? "Touche pour les placer" : "Clique pour les placer")), h("span", { class: "pt-reward-go", html: icons().get("back") }))
            : h("small", { class: "pt-muted" }, "Mission déjà gagnée : pas de nouveaux points."),
          record,
          opened ? h("div", { class: "pt-unlock" }, ico("map"), h("span", { class: "pt-unlock-t" }, h("b", {}, "Nouvelle mission !"), h("small", {}, opened + " · " + ((nextMap && nextMap.name) || "Mission " + opened)))) : null,
        ),
        h(
          "div",
          { class: "pt-row" },
          h("button", { class: "pt-btn pt-wood", onclick: () => this.restart() }, ico("restart"), "Rejouer"),
          h("button", { class: "pt-btn pt-go pt-big", "data-focus": "", title: "Placer les points de compétence, puis retour aux missions", onclick: () => this.quit("skills") }, ico("skills"), "Continuer"),
        ),
      );
    } else {
      card = h(
        "div",
        { class: "pt-card pt-result lose pt-pop-in" },
        h("div", { class: "pt-ribbon grey" }, h("span", {}, "Défaite")),
        h("p", { class: "pt-result-t" }, "Toutes les gemmes ont été emportées…"),
        row,
        h("small", { class: "pt-muted" }, "Astuce : les compétences et les buttes aident beaucoup. Une gemme tombée peut toujours être reprise."),
        h(
          "div",
          { class: "pt-row" },
          h("button", { class: "pt-btn pt-wood", onclick: () => this.quit() }, ico("map"), "Missions"),
          h("button", { class: "pt-btn pt-go pt-big", "data-focus": "", onclick: () => this.restart() }, ico("restart"), "Réessayer"),
        ),
      );
    }
    this.openModal(card, { cls: "pt-m-result", pause: false, dismiss: false });
  };

  /* ------------------------------------------------------------------ bannières, messages, textes volants */
  /** Bannière de début de vague (index à partir de 0, comme l'événement waveStart). */
  P.waveBanner = function (index) {
    const g = this.game;
    const s = g.state;
    const D = this.D();
    const w = s.wave || {};
    const k = typeof index === "number" ? index : typeof w.index === "number" ? w.index : 0;
    const n = k + 1;
    const last = w.total && n >= w.total;
    // Boss : d'après l'aperçu de cette vague (il n'est peut-être pas encore entré sur la carte).
    let boss = null;
    const nw = this.nextInfo && this.nextInfo.index === k ? this.nextInfo : null;
    const bg = (nw && nw.groups.find((x) => x.boss)) || (s.enemies || []).find((e) => e.boss);
    if (bg) boss = bg.name || (D.BOSS_NAMES && D.BOSS_NAMES[bg.type]) || "Le chef";
    const el = h("div", { class: "pt-wbanner" + (last ? " last" : "") }, h("small", {}, last ? "Dernière vague" : "Vague"), h("b", { class: "pt-num" }, `${n}` + (w.total ? ` / ${w.total}` : "")), boss ? h("span", { class: "pt-wbanner-boss" }, ico("boss"), "Boss : " + boss) : null);
    this.bannerLayer.append(el);
    this.bannerUntil = performance.now() + 2600;
    setTimeout(() => el.remove(), 2600);
  };
  /** Entrée du boss sur la carte (événement bossArrives), après la bannière de vague si elle est encore là. */
  P.bossBanner = function (name, type) {
    const D = this.D();
    const nm = name || (D.BOSS_NAMES && D.BOSS_NAMES[type]) || "Le chef";
    const g = this.game;
    const show = () => {
      if (this.game !== g || !g) return;
      const el = h("div", { class: "pt-wbanner pt-bbanner" }, h("small", {}, "Le boss arrive !"), h("div", { class: "pt-bbanner-n" }, type ? this.enemyPortrait(type, false, true, "big") : ico("boss"), h("b", {}, nm)));
      this.bannerLayer.append(el);
      setTimeout(() => el.remove(), 2600);
    };
    const now = performance.now();
    const wait = Math.max(0, (this.bannerUntil || 0) - now);
    this.bannerUntil = now + wait + 2600;
    if (wait > 0) setTimeout(show, wait);
    else show();
  };
  P.pausedBanner = function (on) {
    // pause automatique (menu ouvert) : bandeau discret ; pause du joueur : bandeau complet
    const kind = on ? (this.autoPaused ? "auto" : "user") : null;
    if (this.pauseEl && this.pauseEl.dataset.k !== kind) {
      this.pauseEl.remove();
      this.pauseEl = null;
    }
    if (kind && !this.pauseEl && this.mode === "game") {
      this.pauseEl =
        kind === "auto"
          ? h("div", { class: "pt-pausebar auto", "data-k": kind }, ico("pause"), h("span", {}, "Temps arrêté"), h("small", {}, "Il repart quand tu fermes le menu"))
          : h("div", { class: "pt-pausebar", "data-k": kind }, ico("pause"), h("span", {}, "Pause"), h("small", {}, this.layout === "desk" ? "Espace pour reprendre · tu peux construire" : "Tu peux construire"));
      this.bannerLayer.append(this.pauseEl);
    }
  };
  P.toast = function (text, kind, icon) {
    this.toastSeen = this.toastSeen || new Map();
    const t0 = this.toastSeen.get(text);
    if (t0 !== undefined && this.t - t0 < 1.5) return;
    this.toastSeen.set(text, this.t);
    const el = h("div", { class: "pt-toast " + (kind || "info") + (icon ? " big-i" : "") }, ico(icon || (kind === "bad" ? "warning" : kind === "good" ? "check" : kind === "gold" ? "coins" : "info")), h("span", {}, text));
    this.toastLayer.append(el);
    while (this.toastLayer.children.length > 3) this.toastLayer.firstChild.remove();
    setTimeout(() => {
      el.classList.add("pt-out");
      setTimeout(() => el.remove(), 300);
    }, 2400);
  };
  /** Petit texte qui s'envole d'un point de la carte (+or, gemme tombée). */
  P.fly = function (x, y, text, kind) {
    if (x === undefined || this.flyCount > 14) return;
    const p = this.v("worldToScreen", x, y);
    if (!p) return;
    this.flyCount++;
    const el = h("div", { class: "pt-flytxt " + (kind || ""), style: `left:${p.x.toFixed(0)}px;top:${p.y.toFixed(0)}px` }, kind === "gold" ? ico("gold") : kind === "gem" ? ico("warning") : null, h("b", { class: "pt-num" }, text));
    this.flyEl.append(el);
    setTimeout(() => {
      el.remove();
      this.flyCount--;
    }, kind === "gem" ? 1600 : 1000);
  };
  P.showTip = function (anchor, content) {
    this.hideTip();
    const r = anchor.getBoundingClientRect();
    const el = h("div", { class: "pt-tip" }, content);
    this.popLayer.append(el);
    const w = el.offsetWidth,
      hh = el.offsetHeight;
    const x = clamp(r.left + r.width / 2 - w / 2, 6, window.innerWidth - w - 6);
    const y = r.top - hh - 10 > 6 ? r.top - hh - 10 : r.bottom + 10;
    el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    this.tipEl = el;
  };
  P.hideTip = function () {
    if (this.tipEl) this.tipEl.remove();
    this.tipEl = null;
  };

  /* ------------------------------------------------------------------ clavier */
  /** Étiquettes des raccourcis des sorts selon la disposition réelle du clavier (A Z E en AZERTY). */
  P.keyLabels = function () {
    const kb = navigator.keyboard;
    if (!kb || typeof kb.getLayoutMap !== "function") return;
    kb.getLayoutMap()
      .then((map) => {
        const lab = { cut: map.get("KeyQ"), frenzy: map.get("KeyW"), meteor: map.get("KeyE") };
        for (const k of SPELLS) if (lab[k]) KEYS[k] = lab[k].toUpperCase();
        for (const k of SPELLS) this.spellBtn[k].querySelector("kbd").textContent = KEYS[k];
      })
      .catch(() => {});
  };
  P.bindKeys = function () {
    this.keyLabels();
    window.addEventListener("keydown", (e) => {
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      const code = e.code,
        key = (e.key || "").toLowerCase();
      if (this.modal) {
        if (code === "Escape") {
          if (this.modal.el.querySelector(".pt-m-result") || this.modal.el.classList.contains("pt-m-result")) return;
          e.preventDefault();
          this.closeModal();
        } else if ((code === "Enter" || code === "Space") && this.modal.enter) {
          e.preventDefault();
          this.modal.enter();
        }
        return;
      }
      if (this.mode !== "game" || !this.game) {
        if (code === "Escape" && (this.mode === "skills" || this.mode === "bestiary")) this.screens.querySelector(".pt-shead .pt-btn")?.click();
        return;
      }
      if (code === "Space") {
        e.preventDefault();
        this.togglePause();
      } else if (code === "Digit1" || code === "Numpad1") this.setSpeed(1);
      else if (code === "Digit2" || code === "Numpad2") this.setSpeed(2);
      else if (code === "Digit3" || code === "Numpad3") this.setSpeed(3);
      else if (code === "KeyQ" || key === "q" || key === "a") this.spellClick("cut");
      else if (code === "KeyW" || key === "w" || key === "z") this.spellClick("frenzy");
      else if (code === "KeyE" || key === "e") this.spellClick("meteor");
      else if (code === "Enter" || code === "NumpadEnter") {
        e.preventDefault();
        this.callWave();
      } else if (code === "Escape") {
        e.preventDefault();
        if (this.aim) this.cancelAim();
        else if (this.sel) this.closeSel();
        else this.openPause();
      } else return;
    });
  };

  /* ------------------------------------------------------------------ tutoriel (mission 1) */
  // Étapes : construire un sanglier sur l'herbe → appeler la vague (bonus d'or) → couper la forêt →
  // les ennemis emportent les gemmes → une gemme tombée peut être reprise. Bulles ancrées sur la carte
  // ou sur un bouton du HUD, sans bloquer la partie.
  P.tutoStart = function () {
    const s = this.game.state;
    const grid = (s.map && s.map.grid) || (this.mapInfo && this.mapInfo.grid) || null;
    this.tuto = { step: "build", done: {}, t: 0, grid };
    this.tutoStep("build");
  };
  P.tutoEnd = function () {
    if (this.tuto && this.tuto.el) this.tuto.el.remove();
    this.tuto = null;
  };
  /** Case d'exemple : herbe (ou forêt) collée au chemin, pas trop près de l'entrée. */
  P.tutoTile = function (want) {
    const t = this.tuto;
    const g = t && t.grid;
    if (!g) return null;
    const H = g.length,
      W = g[0].length;
    const e0 = (this.game.state.map && this.game.state.map.entrances && this.game.state.map.entrances[0]) || { i: 0, j: 0 };
    const ent = typeof e0.x === "number" ? { i: e0.x - 0.5, j: e0.y - 0.5 } : e0;
    let best = null,
      bd = 1e9;
    for (let j = 0; j < H; j++)
      for (let i = 0; i < W; i++) {
        if (!want.includes(g[j][i])) continue;
        const nearRoad = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].some(([a, b]) => g[j + b] && "#=ELe".includes(g[j + b][i + a] || " "));
        if (!nearRoad) continue;
        const info = call(this.game, "tileInfo", i, j);
        if (info && info.towerId !== null && info.towerId !== undefined) continue;
        const d = Math.abs(Math.hypot(i - ent.i, j - ent.j) - 5);
        if (d < bd) {
          bd = d;
          best = { i, j };
        }
      }
    return best;
  };
  P.tutoStep = function (step, ev) {
    const t = this.tuto;
    if (!t || t.done[step] || (t.step === step && t.el)) return;
    if (t.el) t.el.remove();
    t.el = null;
    t.step = step;
    t.t = 0;
    let text = "",
      at = null,
      life = 0;
    if (step === "build") {
      at = this.tutoTile(".");
      text = "Touche une case d'herbe au bord du chemin et construis un sanglier : il lance des bogues de châtaigne.";
    } else if (step === "steal") {
      const map = this.game.state.map || {};
      const L = (map.lairs && map.lairs[0]) || map.lair || null;
      at = L ? (typeof L.x === "number" ? { x: L.x, y: L.y } : { i: L.i, j: L.j }) : null;
      text = "Les ennemis viennent voler tes gemmes au moulin et repartent avec. Arrête-les avant la sortie !";
      life = 7;
    } else if (step === "drop") {
      at = ev ? { x: ev.x, y: ev.y } : null;
      text = "Gemme tombée ! Les autres ennemis vont la chercher : défends-la, elle revient si personne ne la prend.";
      life = 6;
    } else if (step === "call") {
      at = { el: (this.fzBlocks[0] && this.fzBlocks[0].el) || this.fzEl };
      text = "Prêt ? Appelle la vague sans attendre : chaque seconde d'avance rapporte de l'or.";
      life = 12;
    } else if (step === "cut") {
      at = this.tutoTile("frwh");
      if (!at) return;
      const sc = this.game.state.spells && this.game.state.spells.cut;
      const cost = sc && sc.cost !== undefined ? sc.cost : (this.D().SPELLS || {}).cut ? this.D().SPELLS.cut.cost : 30;
      text = "Case boisée : touche-la puis « Couper » (" + cost + " mana) pour y construire.";
      life = 9;
    }
    if (!text) return;
    const el = h("div", { class: "pt-tuto pt-pop-in", role: "note" }, h("span", { class: "pt-tuto-hand", html: icons().get("hand") }), h("p", {}, text), h("button", { class: "pt-btn pt-sq pt-wood pt-x", "aria-label": "Fermer", onclick: () => this.tutoDone(step) }, ico("close")));
    this.popLayer.append(el);
    t.el = el;
    t.at = at;
    t.life = life;
    this.placeTuto();
  };
  P.placeTuto = function () {
    const t = this.tuto;
    if (!t || !t.el) return;
    const at = t.at;
    const el = t.el;
    const W = window.innerWidth;
    const ins = this.insets();
    let p = null;
    if (!t.w || !t.placed) {
      t.w = el.offsetWidth;
      t.h = el.offsetHeight;
    }
    const w = t.w,
      hh = t.h;
    if (at && at.el) {
      // Bouton du HUD : la bulle se place dessous (ou dessus s'il est en bas de l'écran).
      const r = at.el.getBoundingClientRect();
      if (!r.width) return;
      const H = window.innerHeight;
      const below = r.bottom + hh + 16 < H - ins.bottom || r.top < H / 2;
      const x = clamp(r.left + r.width / 2 - w / 2, 8, W - w - 8);
      const y = below ? r.bottom + 14 : r.top - hh - 14;
      const tr = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
      if (tr === t.placed) return;
      t.placed = tr;
      el.dataset.side = below ? "b" : "t";
      el.style.setProperty("--ax", clamp(r.left + r.width / 2 - x, 16, w - 16).toFixed(0) + "px");
      el.style.transform = tr;
      return;
    }
    if (at) p = at.x !== undefined ? this.v("worldToScreen", at.x, at.y) : this.v("worldToScreen", at.i + 0.5, at.j + 0.5);
    if (!p) {
      el.style.transform = `translate(${Math.round((W - w) / 2)}px, ${ins.top + 12}px)`;
      return;
    }
    const cell = this.cellPx();
    const x = clamp(p.x - w / 2, ins.left + 8, W - ins.right - w - 8);
    const above = p.y - cell * 0.6 - hh - 14 > ins.top + 6;
    const y = above ? p.y - cell * 0.6 - hh - 14 : p.y + cell * 0.6 + 14;
    const tr = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    if (tr === t.placed) return;
    t.placed = tr;
    el.dataset.side = above ? "t" : "b";
    el.style.setProperty("--ax", clamp(p.x - x, 16, w - 16).toFixed(0) + "px");
    el.style.transform = tr;
  };
  P.tutoFrame = function (dt) {
    const t = this.tuto;
    if (!t || !t.el) return;
    const hide = !!this.sel || !!this.modal;
    if (t.el.hidden !== hide) t.el.hidden = hide;
    t.t += dt;
    this.placeTuto();
    if (t.life && t.t > t.life) this.tutoDone(t.step);
  };
  P.tutoDone = function (step) {
    const t = this.tuto;
    if (!t) return;
    if (step === "tower") return;
    if (step === "wave") step = "call"; // la vague est partie (appelée ou à la fin du compte à rebours)
    if (t.done[step]) return;
    t.done[step] = true;
    if (t.step === step && t.el) {
      t.el.remove();
      t.el = null;
    }
    const later = (next, ms) => setTimeout(() => this.tuto === t && !t.done[next] && !(t.el && t.step !== next) && this.tutoStep(next), ms);
    if (step === "build") {
      const w = this.game && this.game.state.wave;
      if (w && typeof w.index === "number" && w.index < 0 && !t.done.call) later("call", 900);
      else later("cut", 1500);
    } else if (step === "call") later("cut", 2500);
  };

  /* ------------------------------------------------------------------ publication */
  PTMT.ui = {
    /** Crée l'interface (voir l'en-tête du fichier pour les options et l'API). */
    create(o) {
      const ui = new UI(o);
      return {
        showTitle: () => ui.showTitle(),
        showMap: (n) => ui.showMap(n),
        showSkills: () => ui.showSkills(),
        showBestiary: (tab) => ui.showBestiary(tab),
        enterLevel: (game, view) => ui.enterLevel(game, view),
        mapTap: (hit) => ui.mapTap(hit),
        mapHover: (hit) => ui.mapHover(hit),
        events: (list) => ui.events(list),
        frame: (dt) => ui.frame(dt),
        insets: () => ui.insets(),
        onResize: () => ui.onResize(),
        toast: (text, kind) => ui.toast(text, kind),
        get mode() {
          return ui.mode;
        },
        get busy() {
          return !!ui.modal;
        },
        /** Écran opaque par-dessus la scène 3D (compétences, encyclopédie) : son rendu peut s'arrêter. */
        get covered() {
          return ui.mode === "skills" || ui.mode === "bestiary" || (ui.mode === "map" && !ui.hasStage());
        },
        /** Ennemi dont la fiche est ouverte (pour le mettre en valeur dans la scène), sinon null. */
        get selectedEnemy() {
          return ui.sel && ui.sel.kind === "enemy" ? ui.sel.id : null;
        },
        el: ui.el,
        _ui: ui,
      };
    },
  };
})();
