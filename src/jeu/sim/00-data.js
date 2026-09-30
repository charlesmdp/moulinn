// « Pas touche à mes trésors » — données de jeu (PTMT.sim.DATA), sans THREE.
//
// Règles calquées sur Cursed Treasure: Don't Touch My Gems! : trois familles de tours liées au
// terrain (herbe → sanglier, eau → cygne, roche → berger australien qui devient dragon), expérience
// gagnée au combat puis achat du niveau suivant, spécialisation au niveau 4 et évolution au niveau 7,
// trois sorts payés en mana, arbre de compétences en trois branches (3 points par mission gagnée).
//
// Unités : distances en cases (1 case = 3,6 m dans le monde 3D), durées en secondes, vitesses en
// cases par seconde, cadence en tirs par seconde.
(function () {
  "use strict";
  const PTMT = (globalThis.PTMT = globalThis.PTMT || {});
  const S = (PTMT.sim = PTMT.sim || {});
  const D = (S.DATA = {});

  D.version = 3;
  D.W = 20;
  D.H = 13;
  D.TILE = 3.6;
  D.tick = 1 / 60;

  /* ------------------------------------------------------------------ terrain */
  // Lettres de la grille des cartes (voir CONCEPTION.md §2.1).
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
    L: { terrain: "road", walk: true, lair: true },
    X: { terrain: "decor" },
    // Passage secret : fourré infranchissable (ni constructible ni coupable) qui devient un chemin à la vague secretWave.
    s: { terrain: "thicket", secret: true, opensTo: "#" },
  };
  D.TERRAIN_NAMES = { grass: "Herbe", rock: "Roche", water: "Eau", high: "Butte", road: "Chemin", bridge: "Pont", decor: "Talus", thicket: "Fourré" };
  D.high = { range: 0.3, damage: 0.1 };

  /* ------------------------------------------------------------------ économie */
  D.economy = {
    sellRatio: 0.6,
    earlyCallGoldPerSecond: 1, // bonus quand on appelle la vague avant la fin du compte à rebours
    firstWaveDelay: 25, // la première vague attend le joueur (ou ce délai)
    waveGap: 24, // secondes entre deux vagues (compte à rebours)
    waveGapLate: 20, // à partir de la mission 8
  };
  D.mana = { start: 40, max: 100, regen: 1, perManaTower: 0.4 };

  /* ------------------------------------------------------------------ tours */
  // xp : expérience cumulée nécessaire pour ACHETER ce niveau ; cost : prix de ce niveau (or).
  // Statistiques d'un niveau : dmg (par coup), range (cases), rate (coups/s), shot (projectile),
  // speed (cases/s du projectile), splash (rayon, cases), slow {pct, t}, crit {chance, mult},
  // stun {chance, t}, fear {chance, t}, freeze {chance, t}, burn {dps, t}, radiance {pct, t},
  // corpse (part des PV max qui explose autour d'un ennemi tué), mana (mana gagné par coup),
  // disarm (chance de retirer la capacité), pierce (ignore bouclier).
  const XP = [0, 12, 30, 60, 100, 150, 220];
  D.XP = XP;
  D.xpFromDamage = 0.05;

  D.FAMILIES = {
    boar: {
      name: "Sanglier",
      terrain: "grass",
      role: "Dégâts réguliers et bon marché : ses bogues de châtaigne piquent tout ce qui passe.",
      color: "#7a5a3a",
      base: [
        { level: 1, name: "Marcassin", cost: 50, dmg: 10, range: 2.3, rate: 1.1, shot: "chestnut", speed: 8 },
        { level: 2, name: "Jeune sanglier", cost: 45, dmg: 15, range: 2.4, rate: 1.2, shot: "chestnut", speed: 8.5 },
        { level: 3, name: "Sanglier des talus", cost: 70, dmg: 22, range: 2.5, rate: 1.3, shot: "chestnut", speed: 9 },
      ],
      specs: {
        A: {
          name: "Sanglier chasseur",
          blurb: "Tire plus vite et porte des coups critiques (dégâts × 2,5).",
          levels: [
            { level: 4, name: "Sanglier chasseur", cost: 110, dmg: 28, range: 2.6, rate: 1.8, shot: "chestnut", speed: 10, crit: { chance: 0.2, mult: 2.5 } },
            { level: 5, name: "Sanglier chasseur", cost: 120, dmg: 35, range: 2.65, rate: 2.0, shot: "chestnut", speed: 10, crit: { chance: 0.22, mult: 2.5 } },
            { level: 6, name: "Sanglier chasseur", cost: 140, dmg: 44, range: 2.7, rate: 2.2, shot: "chestnut", speed: 10.5, crit: { chance: 0.25, mult: 2.5 } },
            { level: 7, name: "Grand Solitaire", cost: 200, dmg: 58, range: 2.85, rate: 2.5, shot: "chestnut", speed: 11, crit: { chance: 0.3, mult: 3 } },
          ],
        },
        B: {
          name: "Laie baliste",
          blurb: "Grosse châtaigne en cloche qui explose : dégâts de zone, grande portée, tir lent.",
          levels: [
            { level: 4, name: "Laie baliste", cost: 120, dmg: 36, range: 3.2, rate: 0.75, shot: "bigChestnut", speed: 6, splash: 0.9 },
            { level: 5, name: "Laie baliste", cost: 130, dmg: 46, range: 3.25, rate: 0.75, shot: "bigChestnut", speed: 6, splash: 0.95 },
            { level: 6, name: "Laie baliste", cost: 150, dmg: 58, range: 3.3, rate: 0.8, shot: "bigChestnut", speed: 6.2, splash: 1.0 },
            { level: 7, name: "Catapulte à châtaignes", cost: 210, dmg: 80, range: 3.5, rate: 0.8, shot: "bigChestnut", speed: 6.5, splash: 1.25, stun: { chance: 0.25, t: 0.5 } },
          ],
        },
      },
    },
    swan: {
      name: "Cygne",
      terrain: "water",
      role: "Trempe les ennemis d'un jet d'eau : petits dégâts de zone et ralentissement.",
      color: "#f4f1e6",
      base: [
        { level: 1, name: "Cygneau", cost: 70, dmg: 6, range: 2.1, rate: 0.9, shot: "waterJet", speed: 7, splash: 0.55, slow: { pct: 0.3, t: 1.6 } },
        { level: 2, name: "Cygne", cost: 55, dmg: 9, range: 2.2, rate: 0.9, shot: "waterJet", speed: 7, splash: 0.55, slow: { pct: 0.33, t: 1.7 } },
        { level: 3, name: "Cygne majestueux", cost: 80, dmg: 13, range: 2.3, rate: 0.95, shot: "waterJet", speed: 7.5, splash: 0.6, slow: { pct: 0.36, t: 1.8 } },
      ],
      specs: {
        A: {
          name: "Cygne des glaces",
          blurb: "Ralentit beaucoup plus et fait parfois reculer de peur ; au niveau 7, gèle sur place.",
          levels: [
            { level: 4, name: "Cygne des glaces", cost: 120, dmg: 16, range: 2.4, rate: 1.0, shot: "iceShard", speed: 8, splash: 0.6, slow: { pct: 0.45, t: 2 }, fear: { chance: 0.1, t: 1.4 } },
            { level: 5, name: "Cygne des glaces", cost: 130, dmg: 20, range: 2.45, rate: 1.0, shot: "iceShard", speed: 8, splash: 0.62, slow: { pct: 0.48, t: 2 }, fear: { chance: 0.12, t: 1.4 } },
            { level: 6, name: "Cygne des glaces", cost: 150, dmg: 25, range: 2.5, rate: 1.05, shot: "iceShard", speed: 8.5, splash: 0.65, slow: { pct: 0.5, t: 2.2 }, fear: { chance: 0.14, t: 1.5 } },
            { level: 7, name: "Cygne royal des glaces", cost: 210, dmg: 32, range: 2.7, rate: 1.1, shot: "iceShard", speed: 9, splash: 0.7, slow: { pct: 0.55, t: 2.4 }, fear: { chance: 0.15, t: 1.5 }, freeze: { chance: 0.15, t: 1.2 } },
          ],
        },
        B: {
          name: "Cygne noir",
          blurb: "Chaque coup rend du mana et peut désarmer : bouclier, barrière, soin, fumigène, esquive, air de biniou perdus.",
          levels: [
            { level: 4, name: "Cygne noir", cost: 120, dmg: 20, range: 2.4, rate: 1.0, shot: "darkWater", speed: 8, splash: 0.7, slow: { pct: 0.25, t: 1.5 }, mana: 0.6, disarm: 0.18 },
            { level: 5, name: "Cygne noir", cost: 130, dmg: 25, range: 2.45, rate: 1.0, shot: "darkWater", speed: 8, splash: 0.72, slow: { pct: 0.25, t: 1.5 }, mana: 0.7, disarm: 0.22 },
            { level: 6, name: "Cygne noir", cost: 150, dmg: 31, range: 2.5, rate: 1.05, shot: "darkWater", speed: 8.5, splash: 0.75, slow: { pct: 0.25, t: 1.5 }, mana: 0.8, disarm: 0.26 },
            { level: 7, name: "Cygne noir enchanteur", cost: 210, dmg: 40, range: 2.7, rate: 1.1, shot: "darkWater", speed: 9, splash: 0.85, slow: { pct: 0.3, t: 1.6 }, mana: 1.0, disarm: 0.35 },
          ],
        },
      },
    },
    dog: {
      name: "Berger australien",
      terrain: "rock",
      role: "Crache des boules de feu à longue portée qui traversent les boucliers. Devient dragon.",
      color: "#b5482a",
      base: [
        { level: 1, name: "Chiot berger", cost: 90, dmg: 20, range: 2.8, rate: 0.6, shot: "fireball", speed: 7, pierce: true },
        { level: 2, name: "Berger australien", cost: 70, dmg: 30, range: 2.9, rate: 0.6, shot: "fireball", speed: 7.5, pierce: true },
        { level: 3, name: "Berger de feu", cost: 100, dmg: 42, range: 3.0, rate: 0.65, shot: "fireball", speed: 8, pierce: true },
      ],
      specs: {
        A: {
          name: "Dragon merle rouge",
          blurb: "Souffle des boules de feu qui éclatent et font brûler tout le groupe.",
          levels: [
            { level: 4, name: "Dragon merle rouge", cost: 150, dmg: 48, range: 3.1, rate: 0.7, shot: "dragonFire", speed: 8, pierce: true, splash: 0.8, burn: { dps: 10, t: 3 } },
            { level: 5, name: "Dragon merle rouge", cost: 160, dmg: 58, range: 3.15, rate: 0.7, shot: "dragonFire", speed: 8, pierce: true, splash: 0.85, burn: { dps: 13, t: 3 } },
            { level: 6, name: "Dragon merle rouge", cost: 180, dmg: 70, range: 3.2, rate: 0.72, shot: "dragonFire", speed: 8.5, pierce: true, splash: 0.9, burn: { dps: 16, t: 3 } },
            { level: 7, name: "Grand dragon rouge", cost: 250, dmg: 90, range: 3.4, rate: 0.75, shot: "dragonFire", speed: 9, pierce: true, splash: 1.1, burn: { dps: 22, t: 3.5 } },
          ],
        },
        B: {
          name: "Dragon merle bleu",
          blurb: "Son feu bleu fait rayonner l'ennemi (+25 % de dégâts subis) ; un ennemi tué explose sur ses voisins.",
          levels: [
            { level: 4, name: "Dragon merle bleu", cost: 150, dmg: 52, range: 3.3, rate: 0.7, shot: "blueFire", speed: 8.5, pierce: true, radiance: { pct: 0.25, t: 4 }, corpse: 0.3 },
            { level: 5, name: "Dragon merle bleu", cost: 160, dmg: 62, range: 3.35, rate: 0.7, shot: "blueFire", speed: 8.5, pierce: true, radiance: { pct: 0.28, t: 4 }, corpse: 0.35 },
            { level: 6, name: "Dragon merle bleu", cost: 180, dmg: 75, range: 3.4, rate: 0.72, shot: "blueFire", speed: 9, pierce: true, radiance: { pct: 0.31, t: 4 }, corpse: 0.4 },
            { level: 7, name: "Grand dragon bleu", cost: 250, dmg: 95, range: 3.6, rate: 0.75, shot: "blueFire", speed: 9.5, pierce: true, radiance: { pct: 0.4, t: 4.5 }, corpse: 0.5 },
          ],
        },
      },
    },
  };
  /** Statistiques d'une tour (famille, niveau 1..7, spécialisation "A"|"B" à partir du niveau 4). */
  D.towerLevel = function (family, level, spec) {
    const f = D.FAMILIES[family];
    if (!f) return null;
    if (level <= 3) return f.base[level - 1] || null;
    const s = f.specs[spec];
    return s ? s.levels[level - 4] || null : null;
  };

  /* ------------------------------------------------------------------ ennemis */
  // hp, speed (cases/s), gold (prime de base, qui grandit un peu avec les PV de la vague), xp (bonus
  // d'expérience de la tour qui l'achève), threat (poids dans le budget d'une vague).
  D.ENEMIES = {
    fermier: {
      name: "Agriculteur en colère",
      ct: "Paysan",
      hp: 40, speed: 1.0, gold: 6, xp: 2, threat: 4,
      ability: null,
      blurb: "Il a sorti la fourche. Pas bien solide, mais ils arrivent nombreux.",
    },
    quad: {
      name: "Voleur en quad",
      ct: "Voleur",
      hp: 70, speed: 1.6, gold: 9, xp: 3, threat: 6,
      ability: null,
      blurb: "Rapide sur son petit quad : il faut l'arrêter avant qu'il ne file avec une gemme.",
    },
    cowboy: {
      name: "Cow-boy au lasso",
      ct: "Guerrier",
      hp: 120, speed: 0.75, gold: 12, xp: 4, threat: 8,
      ability: { kind: "lasso", range: 1.5 },
      blurb: "Lent mais costaud. Son lasso attrape une gemme tombée jusqu'à une case et demie.",
    },
    vache: {
      name: "Cavalier sur vache",
      ct: "Chevalier",
      hp: 150, speed: 0.7, gold: 16, xp: 5, threat: 11,
      ability: { kind: "shield", value: 5 },
      blurb: "Son bidon de lait sert de bouclier : chaque coup perd 5 points de dégâts (sauf le feu du berger).",
    },
    druide: {
      name: "Druide",
      ct: "Mage",
      hp: 100, speed: 1.0, gold: 15, xp: 5, threat: 10,
      ability: { kind: "barrier", value: 100, regen: 6 },
      blurb: "Une bulle de gui absorbe 100 points de dégâts et se reforme après 6 s sans être touché.",
    },
    bigoudene: {
      name: "Bigoudène aux crêpes",
      ct: "Prêtre",
      hp: 120, speed: 1.0, gold: 16, xp: 5, threat: 11,
      ability: { kind: "heal", value: 30, every: 3, range: 2 },
      blurb: "Toutes les 3 s, une crêpe rend 30 PV à l'allié le plus blessé autour d'elle.",
    },
    chasseur: {
      name: "Chasseur camouflé",
      ct: "Ninja",
      hp: 100, speed: 1.5, gold: 15, xp: 5, threat: 10,
      ability: { kind: "smoke", t: 5 },
      blurb: "Au premier coup reçu, il lance un fumigène et devient invisible 5 s. Les zones le touchent quand même.",
    },
    rugbyman: {
      name: "Rugbyman",
      ct: "Assassin",
      hp: 110, speed: 1.5, gold: 16, xp: 6, threat: 11,
      ability: { kind: "evade", chance: 0.5 },
      blurb: "Il esquive un projectile sur deux. Les dégâts de zone ne s'esquivent pas.",
    },
    sonneur: {
      name: "Sonneur de biniou",
      ct: "Barde",
      hp: 110, speed: 1.0, gold: 16, xp: 6, threat: 11,
      ability: { kind: "haste", every: 8, t: 3, range: 2, mult: 2 },
      blurb: "Toutes les 8 s, un air de biniou double la vitesse des alliés proches pendant 3 s.",
    },
    pompier: {
      name: "Pompier",
      ct: "Paladin",
      hp: 200, speed: 0.85, gold: 22, xp: 8, threat: 16,
      ability: { kind: "immune" },
      blurb: "Rien ne le ralentit : immunisé contre le gel, la peur, la brûlure, l'étourdissement, le rayonnement et le désarmement.",
    },
    canard: {
      name: "Cavalier sur canard",
      ct: "Valkyrie",
      hp: 90, speed: 1.2, gold: 14, xp: 5, threat: 9,
      ability: { kind: "swim" },
      blurb: "Son canard géant nage : il coupe par l'eau au lieu de suivre le chemin.",
    },
  };
  D.champion = { hp: 3.5, gold: 4, xp: 4, scale: 1.3, shield: 10, barrier: 250, heal: 60 };
  D.boss = { hp: 2, gold: 2.5, xp: 2, scale: 1.6 };
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
  };
  // Effets : plafonds et règles communes.
  D.status = { slowCap: 0.7, fearSpeed: 0.8, stunImmunity: 1.5, freezeImmunity: 2 };

  /* ------------------------------------------------------------------ sorts */
  D.SPELLS = {
    cut: { name: "Couper", cost: 30, blurb: "Dégage une case boisée : on peut ensuite y construire.", unlock: 1 },
    frenzy: { name: "Frénésie", cost: 60, blurb: "Toutes les tours tirent deux fois plus vite pendant 5 s.", unlock: 2, t: 5, mult: 2 },
    meteor: { name: "Météore", cost: 90, blurb: "Une météore s'écrase après 0,8 s : 150 dégâts autour du point visé.", unlock: 3, dmg: 150, r: 1.4, delay: 0.8 },
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
    { id: "returnPortal", branch: "dog", name: "Portail de retour", max: 5, req: 3, per: 5, text: "Une gemme laissée au sol revient au moulin après 40 s (−5 s par rang au-delà du premier)" },
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
