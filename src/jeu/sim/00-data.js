// « Pas touche à mes trésors » — données de jeu (PTMT.sim.DATA), sans THREE.
//
// Règles calquées sur Cursed Treasure: Don't Touch My Gems! : trois familles de tours liées au
// terrain (herbe → sanglier, eau → cygne, roche → berger australien qui devient dragon), chacune avec
// sa façon d'attaquer (tir à la suite, charges lâchées en rafale, jet de flammes continu qui chauffe),
// expérience gagnée au combat puis achat du niveau suivant, spécialisation au niveau 4 et évolution au
// niveau 7, trois sorts payés en mana, arbre de compétences en trois branches (3 points par mission
// gagnée), seize ennemis aux capacités franches.
//
// Unités : distances en cases (1 case = 3,6 m dans le monde 3D), durées en secondes, vitesses en
// cases par seconde, cadence en tirs par seconde.
(function () {
  "use strict";
  const PTMT = (globalThis.PTMT = globalThis.PTMT || {});
  const S = (PTMT.sim = PTMT.sim || {});
  const D = (S.DATA = {});

  D.version = 4;
  D.W = 20;
  D.H = 13;
  D.TILE = 3.6;
  D.tick = 1 / 30;

  /* ------------------------------------------------------------------ terrain */
  // Lettres de la grille des cartes (voir CONCEPTION.md §2). walk : marchable ; swim : nageable.
  D.TILES = {
    ".": { terrain: "grass", build: ["boar"] },
    "^": { terrain: "rock", build: ["dog"] },
    "~": { terrain: "water", build: ["swan"], swim: true },
    H: { terrain: "high", build: ["boar", "swan", "dog"], high: true },
    f: { terrain: "grass", forest: true, cutTo: "." },
    r: { terrain: "rock", forest: true, cutTo: "^" },
    w: { terrain: "water", forest: true, cutTo: "~", swim: true },
    h: { terrain: "high", forest: true, cutTo: "H", high: true },
    "#": { terrain: "road", walk: true },
    "=": { terrain: "bridge", walk: true, swim: true },
    E: { terrain: "road", walk: true, entrance: true },
    L: { terrain: "lair", walk: true, lair: true },
    X: { terrain: "decor" },
    // Passage secret : fourré infranchissable (ni constructible ni coupable) qui devient un chemin à la vague secretWave.
    s: { terrain: "thicket", secret: true, opensTo: "#" },
    // Estran : nageable toujours, marchable seulement à marée basse.
    m: { terrain: "tide", tide: true, swim: true },
    // Barrière : entrée fermée qui cède à une vague donnée (devient E).
    g: { terrain: "gate", gate: true, opensTo: "E" },
  };
  D.TERRAIN_NAMES = { grass: "Herbe", rock: "Roche", water: "Eau", high: "Butte", road: "Chemin", bridge: "Pont", decor: "Talus", thicket: "Fourré", lair: "Cachette", tide: "Estran", gate: "Barrière" };
  D.high = { range: 0.3, damage: 0.1 };
  // Entrées : lettre et couleur (mêmes dans l'interface et sur la carte).
  D.ENTRANCES = [
    { letter: "A", color: "#ff8a3d" },
    { letter: "B", color: "#a06bff" },
    { letter: "C", color: "#2fc4d8" },
    { letter: "D", color: "#ff5d8f" },
    { letter: "E", color: "#9bd14a" },
  ];
  // Cachettes : nom selon le décor.
  D.LAIR_NAMES = { moulin: "Le moulin", puits: "Le vieux puits", dolmen: "Le dolmen", chapelle: "La chapelle" };

  /* ------------------------------------------------------------------ économie */
  D.economy = {
    sellRatio: 0.6,
    earlyCallGoldPerSecond: 0.6, // bonus quand on appelle la vague avant la fin du compte à rebours
    firstWaveDelay: 25, // la première vague attend le joueur (ou ce délai)
    waveGap: 24, // secondes entre deux vagues (compte à rebours)
    waveGapLate: 20, // à partir de la mission 8
    towerStep: 20, // chaque tour d'une famille déjà posée rend la suivante 20 or plus chère (comme Cursed Treasure)
    goldMul: 1.3, // primes des ennemis (compense les tours de plus en plus chères)
  };
  D.mana = { start: 40, max: 100, regen: 1, perManaTower: 0.4 };

  /* ------------------------------------------------------------------ tours */
  // xp : expérience cumulée nécessaire pour ACHETER le niveau suivant ; cost : prix de ce niveau (or).
  // Façons d'attaquer (attack), et ce que change chaque spécialisation dès le niveau 4 :
  //  - "shot" (sanglier) : un projectile à la suite (rate tirs/s, dmg par coup) ; multi : autant de
  //    cibles à la fois (sanglier chasseur) ; splash : grosse châtaigne en cloche (laie baliste) ;
  //  - "charges" (cygne) : réserve de `charges` boules (dmg chacune), lâchées en rafale (une toutes les
  //    `burst` s) ; une charge revient toutes les `reload` s, l'une après l'autre ; nova : chaque charge
  //    part en onde de glace autour du nid (cygne des glaces) ; volley : toutes les charges d'un coup,
  //    chacune sur un ennemi différent (cygne noir) ;
  //  - "beam" (berger, dragon bleu) : jet continu sur une cible tant qu'elle reste à portée, `dps` qui
  //    monte jusqu'à × `heatMax` en `heatTime` s sur la même cible ; chain : le jet rebondit sur
  //    `count` cibles proches (pct des dégâts) ; un esquiveur qui se dérobe fait retomber la chauffe ;
  //  - "cone" (dragon rouge) : cône de flammes d'ouverture `cone` (radians) qui brûle tout ce qui est
  //    devant lui, chauffe tant qu'il souffle ; beams : têtes (cônes) simultanées.
  // Effets : splash (rayon, cases), slow {pct, t}, crit {chance, mult}, stun {chance, t}, fear {chance, t},
  // freeze {chance, t}, burn {dps, t}, radiance {pct, t}, corpse (part des PV max qui explose autour d'un
  // ennemi tué), mana (mana par coup), disarm (chance de retirer la capacité), pierce (ignore bouclier).
  const XP = [0, 15, 40, 80, 140, 220, 330];
  D.XP = XP;
  D.xpFromDamage = 0.05;

  D.FAMILIES = {
    boar: {
      name: "Sanglier",
      terrain: "grass",
      attack: "shot",
      role: "Tire des bogues de châtaigne à la suite sur une cible : des dégâts réguliers et bon marché.",
      color: "#7a5a3a",
      base: [
        { level: 1, name: "Marcassin", cost: 50, dmg: 10, range: 2.7, rate: 1.1, shot: "chestnut", speed: 9 },
        { level: 2, name: "Jeune sanglier", cost: 50, dmg: 15, range: 2.8, rate: 1.2, shot: "chestnut", speed: 9 },
        { level: 3, name: "Sanglier des talus", cost: 80, dmg: 22, range: 2.9, rate: 1.3, shot: "chestnut", speed: 9.5 },
      ],
      specs: {
        A: {
          name: "Sanglier chasseur",
          blurb: "Lance deux bogues à la fois sur deux ennemis différents, avec des coups critiques ; au niveau 7, trois à la fois.",
          levels: [
            { level: 4, name: "Sanglier chasseur", cost: 130, dmg: 24, range: 3.0, rate: 1.5, shot: "chestnut", speed: 10, crit: { chance: 0.15, mult: 2.5 }, multi: 2 },
            { level: 5, name: "Sanglier chasseur", cost: 150, dmg: 30, range: 3.05, rate: 1.6, shot: "chestnut", speed: 10, crit: { chance: 0.18, mult: 2.5 }, multi: 2 },
            { level: 6, name: "Sanglier chasseur", cost: 180, dmg: 37, range: 3.1, rate: 1.7, shot: "chestnut", speed: 10.5, crit: { chance: 0.22, mult: 2.5 }, multi: 2 },
            { level: 7, name: "Grand Solitaire", cost: 260, dmg: 44, range: 3.25, rate: 1.8, shot: "chestnut", speed: 11, crit: { chance: 0.3, mult: 3 }, multi: 3 },
          ],
        },
        B: {
          name: "Laie baliste",
          blurb: "Grosse châtaigne lancée en cloche qui explose sur tout un groupe : dégâts de zone, grande portée, tir lent ; au niveau 7, elle étourdit.",
          levels: [
            { level: 4, name: "Laie baliste", cost: 140, dmg: 36, range: 3.6, rate: 0.75, shot: "bigChestnut", speed: 6, splash: 0.9 },
            { level: 5, name: "Laie baliste", cost: 160, dmg: 46, range: 3.65, rate: 0.75, shot: "bigChestnut", speed: 6, splash: 0.95 },
            { level: 6, name: "Laie baliste", cost: 190, dmg: 58, range: 3.7, rate: 0.8, shot: "bigChestnut", speed: 6.2, splash: 1.0 },
            { level: 7, name: "Catapulte à châtaignes", cost: 270, dmg: 78, range: 3.9, rate: 0.8, shot: "bigChestnut", speed: 6.5, splash: 1.25, stun: { chance: 0.25, t: 0.6 } },
          ],
        },
      },
    },
    swan: {
      name: "Cygne",
      terrain: "water",
      attack: "charges",
      role: "Garde des boules d'eau en réserve et les lâche d'un coup sur les ennemis (zone, ralentit), puis se recharge.",
      color: "#f4f1e6",
      base: [
        { level: 1, name: "Cygneau", cost: 70, dmg: 18, range: 2.6, charges: 2, reload: 3.0, burst: 0.3, shot: "waterOrb", speed: 8, splash: 0.55, slow: { pct: 0.3, t: 1.8 } },
        { level: 2, name: "Cygne", cost: 60, dmg: 24, range: 2.7, charges: 2, reload: 2.8, burst: 0.28, shot: "waterOrb", speed: 8, splash: 0.6, slow: { pct: 0.33, t: 1.9 } },
        { level: 3, name: "Cygne majestueux", cost: 90, dmg: 30, range: 2.8, charges: 3, reload: 2.6, burst: 0.26, shot: "waterOrb", speed: 8.5, splash: 0.65, slow: { pct: 0.36, t: 2 } },
      ],
      specs: {
        A: {
          name: "Cygne des glaces",
          blurb: "Chaque charge part en onde de glace autour du nid : tous les ennemis à portée sont touchés, très ralentis, parfois effrayés ; au niveau 7, gelés sur place.",
          levels: [
            { level: 4, name: "Cygne des glaces", cost: 140, dmg: 20, range: 2.7, charges: 3, reload: 2.6, burst: 0.5, nova: true, shot: "iceNova", slow: { pct: 0.45, t: 2 }, fear: { chance: 0.08, t: 1.4 } },
            { level: 5, name: "Cygne des glaces", cost: 160, dmg: 25, range: 2.75, charges: 3, reload: 2.5, burst: 0.5, nova: true, shot: "iceNova", slow: { pct: 0.48, t: 2 }, fear: { chance: 0.1, t: 1.4 } },
            { level: 6, name: "Cygne des glaces", cost: 190, dmg: 31, range: 2.8, charges: 4, reload: 2.4, burst: 0.45, nova: true, shot: "iceNova", slow: { pct: 0.5, t: 2.2 }, fear: { chance: 0.12, t: 1.5 } },
            { level: 7, name: "Cygne royal des glaces", cost: 270, dmg: 38, range: 2.95, charges: 4, reload: 2.2, burst: 0.45, nova: true, shot: "iceNova", slow: { pct: 0.55, t: 2.4 }, fear: { chance: 0.12, t: 1.5 }, freeze: { chance: 0.15, t: 1.2 } },
          ],
        },
        B: {
          name: "Cygne noir",
          blurb: "Lâche toutes ses charges d'un coup, chacune sur un ennemi différent : boules d'eau sombre qui rendent du mana et peuvent désarmer (bouclier, bulle, soin, fumigène, esquive, flash… perdus).",
          levels: [
            { level: 4, name: "Cygne noir", cost: 140, dmg: 34, range: 2.9, charges: 3, reload: 2.6, burst: 0.6, volley: true, shot: "darkOrb", speed: 9, splash: 0.6, slow: { pct: 0.25, t: 1.5 }, mana: 0.6, disarm: 0.18 },
            { level: 5, name: "Cygne noir", cost: 160, dmg: 42, range: 2.95, charges: 3, reload: 2.5, burst: 0.6, volley: true, shot: "darkOrb", speed: 9, splash: 0.62, slow: { pct: 0.25, t: 1.5 }, mana: 0.7, disarm: 0.22 },
            { level: 6, name: "Cygne noir", cost: 190, dmg: 52, range: 3.0, charges: 4, reload: 2.4, burst: 0.55, volley: true, shot: "darkOrb", speed: 9.5, splash: 0.65, slow: { pct: 0.25, t: 1.5 }, mana: 0.8, disarm: 0.26 },
            { level: 7, name: "Cygne noir enchanteur", cost: 270, dmg: 62, range: 3.15, charges: 5, reload: 2.2, burst: 0.5, volley: true, shot: "darkOrb", speed: 10, splash: 0.75, slow: { pct: 0.3, t: 1.6 }, mana: 1.0, disarm: 0.35 },
          ],
        },
      },
    },
    dog: {
      name: "Berger australien",
      terrain: "rock",
      attack: "beam",
      role: "Crache un jet de feu continu sur une cible tant qu'elle reste à portée : plus il la tient, plus ça brûle. Perce les boucliers. Devient dragon : cône de flammes (rouge) ou jet qui rebondit (bleu).",
      color: "#b5482a",
      base: [
        { level: 1, name: "Chiot berger", cost: 90, dps: 13, range: 3.0, heatMax: 2.2, heatTime: 3, beam: "fire", pierce: true },
        { level: 2, name: "Berger australien", cost: 75, dps: 19, range: 3.1, heatMax: 2.3, heatTime: 3, beam: "fire", pierce: true },
        { level: 3, name: "Berger de feu", cost: 110, dps: 26, range: 3.2, heatMax: 2.4, heatTime: 3, beam: "fire", pierce: true },
      ],
      specs: {
        A: {
          name: "Dragon merle rouge",
          blurb: "Souffle un cône de flammes qui brûle tout ce qui se trouve devant lui (zone) et chauffe tant qu'il souffle ; au niveau 7, deux têtes, deux cônes.",
          levels: [
            { level: 4, name: "Dragon merle rouge", cost: 160, dps: 19, range: 3.0, heatMax: 2.2, heatTime: 3, cone: 0.95, beam: "dragonFire", pierce: true, burn: { dps: 6, t: 2 } },
            { level: 5, name: "Dragon merle rouge", cost: 180, dps: 24, range: 3.05, heatMax: 2.2, heatTime: 3, cone: 0.95, beam: "dragonFire", pierce: true, burn: { dps: 8, t: 2 } },
            { level: 6, name: "Dragon merle rouge", cost: 210, dps: 29, range: 3.1, heatMax: 2.3, heatTime: 2.8, cone: 1.0, beam: "dragonFire", pierce: true, burn: { dps: 10, t: 2 } },
            { level: 7, name: "Grand dragon rouge", cost: 300, dps: 33, range: 3.2, heatMax: 2.4, heatTime: 2.6, cone: 1.05, beam: "dragonFire", pierce: true, burn: { dps: 14, t: 2.5 }, beams: 2 },
          ],
        },
        B: {
          name: "Dragon merle bleu",
          blurb: "Son jet de feu bleu rebondit sur un second ennemi et fait rayonner ses cibles (+25 % de tous les dégâts subis) ; un ennemi vaincu explose sur ses voisins ; au niveau 7, le jet rebondit trois fois.",
          levels: [
            { level: 4, name: "Dragon merle bleu", cost: 160, dps: 28, range: 3.5, heatMax: 2.4, heatTime: 3, beam: "blueFire", pierce: true, radiance: { pct: 0.25, t: 1.5 }, corpse: 0.3, chain: { count: 1, range: 1.5, pct: 0.6 } },
            { level: 5, name: "Dragon merle bleu", cost: 180, dps: 34, range: 3.55, heatMax: 2.4, heatTime: 3, beam: "blueFire", pierce: true, radiance: { pct: 0.28, t: 1.5 }, corpse: 0.35, chain: { count: 1, range: 1.55, pct: 0.6 } },
            { level: 6, name: "Dragon merle bleu", cost: 210, dps: 41, range: 3.6, heatMax: 2.4, heatTime: 2.8, beam: "blueFire", pierce: true, radiance: { pct: 0.31, t: 1.5 }, corpse: 0.4, chain: { count: 1, range: 1.6, pct: 0.65 } },
            { level: 7, name: "Grand dragon bleu", cost: 300, dps: 48, range: 3.75, heatMax: 2.5, heatTime: 2.6, beam: "blueFire", pierce: true, radiance: { pct: 0.4, t: 1.8 }, corpse: 0.5, chain: { count: 3, range: 1.8, pct: 0.7 } },
          ],
        },
      },
    },
  };
  /** Statistiques d'une tour (famille, niveau 1..7, spécialisation "A"|"B" à partir du niveau 4). */
  D.towerLevel = function (family, level, spec) {
    const f = D.FAMILIES[family];
    if (!f) return null;
    const lv = level <= 3 ? f.base[level - 1] : f.specs[spec] ? f.specs[spec].levels[level - 4] : null;
    return lv ? Object.assign({ attack: lv.cone ? "cone" : f.attack }, lv) : null;
  };

  /* ------------------------------------------------------------------ ennemis */
  // hp, speed (cases/s), gold (prime), xp (bonus d'expérience de la tour qui l'achève), threat (poids
  // dans le budget d'une vague), tier (1 à 4 : à partir de quand il apparaît dans les vagues générées).
  D.ENEMIES = {
    fermier: {
      name: "Agriculteur en colère",
      ct: "Paysan",
      hp: 40, speed: 0.9, gold: 6, xp: 2, threat: 4, tier: 1,
      ability: null,
      blurb: "Il a sorti la fourche. Pas bien solide, mais ils arrivent nombreux.",
    },
    quad: {
      name: "Voleur en quad",
      ct: "Voleur",
      hp: 70, speed: 1.45, gold: 8, xp: 3, threat: 6, tier: 1,
      ability: null,
      blurb: "Rapide sur son petit quad : il faut l'arrêter avant qu'il ne file avec une gemme.",
    },
    cowboy: {
      name: "Cow-boy au lasso",
      ct: "Guerrier",
      hp: 120, speed: 0.68, gold: 11, xp: 4, threat: 8, tier: 1,
      ability: { kind: "lasso", range: 1.5 },
      blurb: "Lent mais costaud. Son lasso attrape une gemme tombée jusqu'à une case et demie.",
    },
    vache: {
      name: "Cavalier sur vache",
      ct: "Chevalier",
      hp: 170, speed: 0.63, gold: 15, xp: 5, threat: 11, tier: 2,
      ability: { kind: "shield", value: 5 },
      blurb: "Juché sur sa vache bretonne, il se protège avec un bidon de lait : chaque coup perd 5 points de dégâts (sauf le feu du berger).",
    },
    druide: {
      name: "Druide",
      ct: "Mage",
      hp: 100, speed: 0.9, gold: 14, xp: 5, threat: 11, tier: 3,
      ability: { kind: "barrier", value: 60, regen: 5 },
      blurb: "Une bulle de gui absorbe 60 points de dégâts et se reforme après 5 s sans être touché.",
    },
    bigoudene: {
      name: "Bigoudène aux crêpes",
      ct: "Prêtre",
      hp: 120, speed: 0.9, gold: 15, xp: 5, threat: 12, tier: 3,
      ability: { kind: "heal", value: 30, every: 3, range: 2 },
      blurb: "Toutes les 3 s, une crêpe rend 30 PV à l'allié le plus blessé autour d'elle.",
    },
    chasseur: {
      name: "Chasseur camouflé",
      ct: "Ninja",
      hp: 100, speed: 1.35, gold: 14, xp: 5, threat: 11, tier: 2,
      ability: { kind: "smoke", t: 5 },
      blurb: "Au premier coup reçu, il lance un fumigène et devient invisible 5 s. Les zones le touchent quand même.",
    },
    rugbyman: {
      name: "Rugbyman",
      ct: "Assassin",
      hp: 110, speed: 1.35, gold: 15, xp: 6, threat: 12, tier: 3,
      ability: { kind: "evade", chance: 0.5, every: 1.2 },
      blurb: "Il esquive un projectile sur deux et se dérobe au jet de feu (la chauffe retombe à zéro). Seules les zones l'attrapent à coup sûr.",
    },
    sonneur: {
      name: "Sonneur de biniou",
      ct: "Barde",
      hp: 110, speed: 0.9, gold: 15, xp: 6, threat: 12, tier: 2,
      ability: { kind: "haste", every: 8, t: 3, range: 2, mult: 2 },
      blurb: "Toutes les 8 s, un air de biniou double la vitesse des alliés proches pendant 3 s.",
    },
    pompier: {
      name: "Pompier",
      ct: "Paladin",
      hp: 220, speed: 0.77, gold: 20, xp: 8, threat: 17, tier: 4,
      ability: { kind: "immune" },
      blurb: "Rien ne l'arrête : insensible au ralentissement, au gel, à la peur, à la brûlure, à l'étourdissement, au rayonnement et au désarmement.",
    },
    canard: {
      name: "Cavalier sur canard",
      ct: "Valkyrie",
      hp: 90, speed: 1.08, gold: 13, xp: 5, threat: 10, tier: 2,
      ability: { kind: "swim" },
      blurb: "Son canard géant nage : il coupe par l'eau au lieu de suivre le chemin.",
    },
    cycliste: {
      name: "Cycliste du peloton",
      ct: "Essaim",
      hp: 45, speed: 1.6, gold: 4, xp: 2, threat: 4, tier: 2,
      ability: { kind: "peloton", range: 1.2, mult: 1.3 },
      blurb: "Ils arrivent en peloton serré, très vite : 30 % plus rapides quand ils roulent groupés. Les tirs de zone font merveille.",
    },
    korrigan: {
      name: "Korrigan",
      ct: "Lutin rusé",
      hp: 120, speed: 1.08, gold: 16, xp: 6, threat: 13, tier: 3,
      ability: { kind: "blink", dist: 1.8, every: 3.5 },
      blurb: "Touché, ce lutin breton disparaît dans un pouf de fumée et réapparaît 1,8 case plus loin (toutes les 3,5 s). Prévois des tours plus loin sur sa route.",
    },
    touriste: {
      name: "Touriste au flash",
      ct: "Ébloui-tours",
      hp: 110, speed: 0.9, gold: 16, xp: 6, threat: 13, tier: 3,
      ability: { kind: "flash", every: 5, range: 1.6, t: 2, count: 1 },
      blurb: "Toutes les 5 s, son flash éblouit la tour la plus proche (1,6 case) : elle ne tire plus pendant 2 s.",
    },
    tracteur: {
      name: "Tracteur du voisin",
      ct: "Char",
      hp: 420, speed: 0.5, gold: 30, xp: 12, threat: 28, tier: 4,
      ability: { kind: "split", value: 3, into: "fermier", shield: 3 },
      blurb: "Lent, blindé (bouclier 3) et increvable. Détruit, il lâche trois agriculteurs en colère qui reprennent la route.",
    },
    montgolfiere: {
      name: "Montgolfière",
      ct: "Volant",
      hp: 260, speed: 0.5, gold: 26, xp: 12, threat: 24, tier: 4,
      ability: { kind: "fly" },
      blurb: "Elle vole en ligne droite au-dessus de tout, du bord de la carte jusqu'à la cachette la plus proche, puis repart vers le bord le plus proche. Sa route est annoncée en pointillés.",
    },
  };
  D.champion = { hp: 3.5, gold: 3, xp: 4, scale: 1.3, shield: 10, barrier: 200, heal: 60 };
  D.boss = { hp: 2, gold: 2, xp: 2, scale: 1.6 };
  D.BOSS_NAMES = {
    fermier: "Le Grand Fermier",
    quad: "Le Roi du quad",
    cowboy: "Le Shérif d'Elven",
    vache: "Le Maire sur sa vache",
    druide: "Le Grand Druide",
    bigoudene: "La Reine des crêpes",
    chasseur: "Le Chasseur fantôme",
    rugbyman: "Le Capitaine",
    sonneur: "Le Penn-Soner",
    pompier: "Le Capitaine des pompiers",
    canard: "Le Canard doré",
    cycliste: "Le Maillot jaune",
    korrigan: "Le Roi des korrigans",
    touriste: "Le Paparazzi",
    tracteur: "La Moissonneuse-batteuse",
    montgolfiere: "Le Zeppelin du comice",
  };
  D.fly = { alt: 1.6 };
  // Effets : plafonds et règles communes.
  D.status = { slowCap: 0.7, fearSpeed: 0.8, stunImmunity: 1.5, freezeImmunity: 2, wading: 0.45 };

  /* ------------------------------------------------------------------ sorts */
  D.SPELLS = {
    cut: { name: "Couper", cost: 30, blurb: "Dégage une case boisée : on peut ensuite y construire.", unlock: 1 },
    frenzy: { name: "Frénésie", cost: 60, blurb: "Toutes les tours tirent deux fois plus vite pendant 5 s.", unlock: 2, t: 5, mult: 2 },
    meteor: { name: "Météore", cost: 90, blurb: "Une météore s'écrase après 0,8 s : 150 dégâts autour du point visé.", unlock: 2, dmg: 150, r: 1.4, delay: 0.8 },
  };

  /* ------------------------------------------------------------------ compétences */
  // Chaque point placé dans une branche : bonus global (cadence, portée ou dégâts de toutes les tours).
  D.BRANCHES = {
    boar: { name: "Sanglier", theme: "Or, Couper et sangliers", perPoint: { rate: 0.01 }, perPointText: "+1 % de cadence pour toutes les tours" },
    swan: { name: "Cygne", theme: "Mana, Frénésie et cygnes", perPoint: { range: 0.01 }, perPointText: "+1 % de portée pour toutes les tours" },
    dog: { name: "Berger", theme: "Gemmes, Météore et bergers", perPoint: { damage: 0.01 }, perPointText: "+1 % de dégâts pour toutes les tours" },
  };
  // req : points déjà placés dans la même branche pour débloquer la compétence.
  D.SKILLS = [
    { id: "goldVault", branch: "boar", name: "Bas de laine", max: 5, req: 0, per: 20, text: "+20 or au début de chaque mission par rang" },
    { id: "heights", branch: "boar", name: "Avantage de la butte", max: 5, req: 0, per: 0.06, text: "Tours sur une butte : +6 % de dégâts par rang" },
    { id: "cutStudy", branch: "boar", name: "Hache affûtée", max: 5, req: 3, per: 4, text: "Couper coûte 4 mana de moins par rang" },
    { id: "sawmill", branch: "boar", name: "Scierie", max: 5, req: 3, per: 8, text: "Couper rapporte 8 or par rang" },
    { id: "marksman", branch: "boar", name: "Défenses affûtées", max: 5, req: 6, per: 0.03, text: "Sangliers : +3 % de chances de coup critique par rang" },
    { id: "boarLord", branch: "boar", name: "Roi des sangliers", max: 5, req: 6, per: 0.05, text: "Sangliers : −5 % sur la construction et les niveaux par rang" },
    { id: "mining", branch: "boar", name: "Filon de gemmes", max: 1, req: 10, per: 1, text: "Chaque mission commence avec une gemme de plus" },
    { id: "manaStock", branch: "swan", name: "Réserve de mana", max: 5, req: 0, per: 12, text: "+12 mana au début de chaque mission par rang" },
    { id: "manaPool", branch: "swan", name: "Grand bassin", max: 5, req: 0, per: 15, text: "+15 mana maximum par rang" },
    { id: "frenzyStudy", branch: "swan", name: "Frénésie étudiée", max: 5, req: 3, per: 6, text: "Frénésie coûte 6 mana de moins par rang" },
    { id: "manaSpring", branch: "swan", name: "Source vive", max: 5, req: 3, per: 0.1, text: "+10 % de régénération de mana par rang" },
    { id: "frenzyLong", branch: "swan", name: "Frénésie prolongée", max: 5, req: 6, per: 0.5, text: "Frénésie dure 0,5 s de plus par rang" },
    { id: "coldWater", branch: "swan", name: "Eau glacée", max: 5, req: 6, per: 0.04, text: "Cygnes : ralentissement +4 points par rang" },
    { id: "swanLord", branch: "swan", name: "Reine des cygnes", max: 5, req: 10, per: 0.05, text: "Cygnes : −5 % sur la construction et les niveaux par rang" },
    { id: "training", branch: "dog", name: "Dressage", max: 5, req: 0, per: 0.1, text: "Toutes les tours gagnent 10 % d'expérience en plus par rang" },
    { id: "hotGems", branch: "dog", name: "Trésor brûlant", max: 5, req: 0, per: 0.01, text: "Un porteur de gemme perd 1 % de ses PV max par seconde par rang" },
    { id: "meteorStudy", branch: "dog", name: "Météore étudié", max: 5, req: 3, per: 8, text: "Météore coûte 8 mana de moins par rang" },
    { id: "returnPortal", branch: "dog", name: "Portail de retour", max: 5, req: 3, per: 5, text: "Une gemme laissée au sol revient dans sa cachette après 40 s (−5 s par rang au-delà du premier)" },
    { id: "meteorMastery", branch: "dog", name: "Météore dévastateur", max: 5, req: 6, per: 0.2, text: "Météore : +20 % de dégâts par rang" },
    { id: "radiance", branch: "dog", name: "Œil de braise", max: 5, req: 6, per: 0.04, text: "Dragon bleu : rayonnement +4 points par rang" },
    { id: "dogLord", branch: "dog", name: "Maître chien", max: 5, req: 10, per: 0.05, text: "Bergers : −5 % sur la construction et les niveaux par rang" },
  ];
  D.SKILL = Object.fromEntries(D.SKILLS.map((s) => [s.id, s]));
  D.pointsPerLevel = 3;

  /* ------------------------------------------------------------------ gemmes */
  D.GEM_COLORS = ["Rubis", "Émeraude", "Saphir", "Améthyste", "Topaze", "Diamant"];
  D.gems = { pickupRadius: 0.35, returnBase: 40 };
})();
