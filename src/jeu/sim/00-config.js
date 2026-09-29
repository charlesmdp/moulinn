// « Pas touche à mes trésors » — configuration d'équilibrage centralisée.
//
// Toutes les valeurs chiffrées du jeu sont ici (distances en U : 1 U = hauteur d'un voleur,
// durées en secondes, vitesses en U/s). Les coûts marqués « + » dans la règle sont des achats
// supplémentaires : chaque palier indique son propre coût. Les statistiques d'un palier
// remplacent celles du précédent.
(function () {
  "use strict";
  const PTMT = (globalThis.PTMT = globalThis.PTMT || {});

  const C = {
    version: 2,
    tick: 1 / 30, // pas de simulation fixe

    // Terrain à cases, comme dans les tower defense à zones : chaque famille de tours ne se bâtit
    // que sur son sol (feu : rocaille, glace : givre, eau : berge et marais), sur une grille
    // régulière de cases de 2 U où les tours se posent côte à côte.
    grid: { tile: 2, roadClear: 0.95 },
    // Forêts : une case boisée ne se construit qu'une fois coupée (or, quelques secondes de jeu,
    // y compris entre les vagues). Le prix monte un peu à chaque coupe.
    forest: { cost: 30, costStep: 5, costMax: 60, duration: 4 },

    economy: {
      // Les niveaux 4 et 5 ouvrent sur plusieurs fronts rapides (nageurs, sprinteurs de l'est).
      startGold: { 1: 500, 2: 650, 3: 800, 4: 1100, 5: 1350 },
      sellRatio: 0.7,
      treasuresTotal: 6,
    },

    xp: { perKo: 5, tier2: 30, tier3: 90 },

    // Brûlures : la plus forte s'applique, sa durée est rafraîchie. Sols incendiés : le plus fort seulement.
    towers: {
      fire: {
        name: "Feu",
        role: "Dégâts, explosions, brûlures et destruction de groupes.",
        burn: { 1: { dps: 5, duration: 3 }, 2: { dps: 6, duration: 3 }, 3: { dps: 8, duration: 4 } },
        forms: {
          "1": { name: "Brasier grognon", cost: 100, attack: "fireball", damage: 20, period: 1.5, range: 5, splash: 1, direct: true },
          "2A": { name: "Souffle infernal", cost: 150, attack: "cone", damage: 14, period: 0.5, range: 4, coneDeg: 60, direct: true },
          "3A": { name: "Dragon de la fournaise", cost: 280, attack: "cone", damage: 22, period: 0.5, range: 4.5, coneDeg: 75, direct: true, mouths: 2 },
          "2B": { name: "Crache-lave", cost: 150, attack: "lava", damage: 50, period: 2.5, range: 6, splash: 1.6, ground: { dps: 6, duration: 2 } },
          "3B": { name: "Volcan furieux", cost: 300, attack: "lava", damage: 80, period: 2.5, range: 6.5, splash: 2.2, ground: { dps: 10, duration: 3 } },
        },
      },
      ice: {
        name: "Glace",
        role: "Ralentir, retenir des porteurs et créer des fenêtres pour les autres défenses.",
        forms: {
          "1": { name: "Obélisque givré", cost: 90, attack: "shard", damage: 12, period: 1, range: 6, slow: { pct: 0.3, duration: 2 }, direct: true },
          "2A": { name: "Crypte du gel", cost: 140, attack: "spike", damage: 20, period: 1.2, range: 6.5, slow: { pct: 0.35, duration: 2 }, freezeEvery: 3, freeze: 1.2, direct: true },
          "3A": { name: "Trône du zéro absolu", cost: 270, attack: "spike", damage: 30, period: 1, range: 7, slow: { pct: 0.4, duration: 2.5 }, freezeEvery: 3, freeze: 2, freezeNeighbours: 1, neighbourRadius: 1.3, direct: true },
          "2B": { name: "Souffleur de blizzard", cost: 150, attack: "storm", range: 5.5, stormRadius: 1.7, stormDps: 8, stormSlow: 0.4, stormDuration: 3 },
          "3B": { name: "Tempête polaire", cost: 280, attack: "storm", range: 6, stormRadius: 2.2, stormDps: 16, stormSlow: 0.45, stormDuration: 3, stormFreeze: 0.75 },
        },
      },
      water: {
        name: "Eau",
        role: "Déplacer les ennemis, regrouper les vagues et offrir une seconde occasion de tuer un porteur.",
        wet: 3,
        forms: {
          "1": { name: "Cygne grincheux", cost: 90, attack: "jet", damage: 10, period: 1.4, range: 5, pushEvery: 3, push: 0.5, direct: true },
          "2A": { name: "Bélier hydraulique", cost: 140, attack: "line", damage: 22, period: 2, range: 5.5, maxTargets: 4, lineWidth: 0.9, push: 1.4, direct: true },
          "3A": { name: "Canon tsunami", cost: 280, attack: "wave", damage: 45, period: 2, range: 6, maxTargets: 6, coneDeg: 32, push: 2.2, direct: true },
          "2B": { name: "Fontaine siphon", cost: 150, attack: "vortex", period: 8, range: 5.5, vortexRadius: 1.6, vortexDuration: 4, vortexDps: 6, vortexSlow: 0.2, pull: 1.2 },
          "3B": { name: "Maelström glouton", cost: 300, attack: "vortex", period: 8, range: 6, vortexRadius: 2.4, vortexDuration: 5, vortexDps: 10, vortexSlow: 0.25, pull: 1.8, finalSplash: 20 },
        },
      },
    },

    control: {
      slowCap: 0.6,
      immobileImmunity: 3, // après gel, filet ou leurre
      moveImmunity: 2, // après projection ou attraction de vortex
      tenacityFactor: 0.7,
      tenacityMin: 0.1,
      maxImmobilize: 4, // ennemis ordinaires, talents compris
      heavy: { duration: 0.6, displacement: 0.4, slowCap: 0.45 },
      boss: { duration: 0.35, displacement: 0.2, slowCap: 0.25 },
    },

    traps: {
      baseLimit: 3,
      net: {
        name: "Filet entre les arbres",
        tiers: {
          1: { cost: 50, targets: 2, duration: 0.9, cooldown: 14, radius: 1.1 },
          2: { cost: 60, targets: 3, duration: 1.3, cooldown: 12, radius: 1.3 },
          3: { cost: 100, targets: 4, duration: 1.8, cooldown: 10, radius: 1.5 },
        },
      },
      spring: {
        name: "Ressort farceur",
        tiers: {
          1: { cost: 60, targets: 1, push: 1.5, cooldown: 10, radius: 0.9 },
          2: { cost: 70, targets: 2, push: 2, cooldown: 9, radius: 1.0 },
          3: { cost: 120, targets: 3, push: 2.8, cooldown: 8, radius: 1.1 },
        },
      },
      lure: {
        name: "Faux coffre",
        tiers: {
          1: { cost: 60, targets: 1, radius: 2, duration: 1.5, cooldown: 16 },
          2: { cost: 80, targets: 2, radius: 2.5, duration: 2, cooldown: 14 },
          3: { cost: 130, targets: 3, radius: 3, duration: 2.5, cooldown: 12 },
        },
      },
    },

    mill: {
      meule: {
        name: "Meule",
        levels: [
          { cost: 0, income: 30 },
          { cost: 80, income: 50 },
          { cost: 140, income: 85 },
          { cost: 240, income: 145 },
        ],
      },
      roue: {
        name: "Roue magique",
        levels: [
          { cost: 0, manaMax: 100, regen: 1 },
          { cost: 90, manaMax: 120, regen: 1.4 },
          { cost: 160, manaMax: 140, regen: 1.8 },
          { cost: 260, manaMax: 180, regen: 2.4 },
        ],
      },
      atelier: {
        name: "Atelier",
        levels: [
          { cost: 0, tierAllowed: 1, trapLimit: 3 },
          { cost: 120, tierAllowed: 2, trapLimit: 4 },
          { cost: 240, tierAllowed: 3, trapLimit: 5 },
          { cost: 360, tierAllowed: 3, trapLimit: 6, xpBonus: 0.25, trapCooldown: 0.9 },
        ],
      },
      startMana: 100,
    },

    reserves: {
      tiers: {
        1: { name: "Coffre de bois", cost: 0, stealTime: 0.8, atelier: 0 },
        2: { name: "Coffre à trois serrures", cost: 90, stealTime: 1.6, atelier: 1 },
        3: { name: "Coffre hurleur", cost: 160, stealTime: 2.4, atelier: 2, reveal: true },
      },
      stealRadius: 0.9, // quitter cette zone interrompt l'ouverture
    },

    spells: {
      rankCost: { 2: 120, 3: 240 },
      rankAtelier: { 2: 1, 3: 2 },
      unlockLevel: { meteor: 1, recall: 1, freeze: 2, flood: 3, frenzy: 4 },
      order: ["meteor", "freeze", "flood", "frenzy", "recall"],
      meteor: {
        name: "Météore",
        mana: 45,
        cooldown: 25,
        delay: 0.9,
        ranks: {
          1: { damage: 90, radius: 1.6, ground: { dps: 10, duration: 3 } },
          2: { damage: 150, radius: 1.9, ground: { dps: 15, duration: 3 } },
          3: { damage: 220, radius: 2.3, ground: { dps: 20, duration: 4 } },
        },
      },
      freeze: {
        name: "Gel instantané",
        mana: 30,
        cooldown: 22,
        delay: 0.35,
        ranks: {
          1: { freeze: 1.5, radius: 1.6 },
          2: { freeze: 2.2, radius: 2 },
          3: { freeze: 3, radius: 2.4, afterSlow: { pct: 0.35, duration: 2 } },
        },
      },
      flood: {
        name: "Vague de crue",
        mana: 35,
        cooldown: 20,
        delay: 0.45,
        ranks: {
          1: { length: 5, width: 2, damage: 20, push: 1.5, wet: 4 },
          2: { length: 6, width: 2.5, damage: 40, push: 2.2, wet: 5 },
          3: { length: 7, width: 3, damage: 60, push: 3, wet: 6 },
        },
      },
      frenzy: {
        name: "Frénésie",
        mana: 40,
        cooldown: 30,
        delay: 0.2,
        ranks: {
          1: { radius: 3, rate: 0.3, duration: 6 },
          2: { radius: 3.5, rate: 0.45, duration: 8 },
          3: { radius: 4, rate: 0.6, duration: 10 },
        },
      },
      recall: {
        name: "Rappel",
        mana: 20,
        cooldown: 10,
        delay: 0.3,
        ranks: {
          1: { count: 1, radius: 0.9 },
          2: { count: 2, radius: 1.5 },
          3: { count: 3, radius: 3 },
        },
      },
    },

    enemies: {
      voleur: { name: "Voleur du dimanche", eliteName: "Voleur à casserole", hp: 60, speed: 1, bounty: 8, klass: "normal" },
      sprinteur: { name: "Sprinteur en claquettes", eliteName: "Patineur du dimanche", hp: 40, speed: 1.6, bounty: 10, klass: "normal", eliteBoost: { pct: 0.35, duration: 2 } },
      demenageur: { name: "Déménageur en matelas", eliteName: "Forteresse canapé", hp: 180, speed: 0.65, bounty: 18, klass: "heavy", eliteShield: { range: 1, reduction: 0.2 } },
      fumigene: { name: "Voleur au fumigène", eliteName: "Ninja au rideau de douche", hp: 90, speed: 1.1, bounty: 16, klass: "normal", smoke: 2.5, eliteSmoke: 4 },
      nageur: { name: "Nageur en flamant rose", eliteName: "Pirate en pédalo", hp: 75, speed: 0.9, waterSpeed: 1.15, bounty: 12, klass: "normal", swimmer: true, eliteWater: 1.25, eliteLand: 0.8 },
      boss: { name: "Chef en tondeuse blindée", eliteName: "Limousine-tondeuse", hp: 900, speed: 0.55, bounty: 150, klass: "boss", overheatAfter: 6, overheatFor: 3, overheatVuln: 0.5, rage: { at: 0.5, pct: 0.5, duration: 3 } },
      elite: { hp: 1.5, bounty: 1.4 },
      // Multiplicateur de PV : (1 + 0,20 × (niveau − 1) + 0,035 × (vague − 1)) × facteur du niveau.
      // Le facteur compense la longueur des chemins de chaque disposition (plus de temps sous le feu).
      hpPerLevel: 0.2,
      hpPerWave: 0.035,
      levelHp: { 1: 1.2, 2: 1.1, 3: 1.25, 4: 1, 5: 1 },
      endlessHpPerBlock: 0.1, // +10 % par bloc de cinq vagues supplémentaires
      maxActive: { desktop: 70, mobile: 45 },
      waitForSack: 4, // attente maximale quand les derniers trésors sont transportés
    },

    // Récompenses permanentes : première victoire 2 points, deuxième étoile +1, troisième +1.
    rewards: { win: 2, star2: 1, star3: 1 },

    talents: {
      fire: {
        name: "Feu",
        items: [
          { id: "embers", name: "Braises tenaces", ranks: 3, tier: "base", values: [0.1, 0.2, 0.3], text: "Durée des brûlures et sols incendiés +{v}%" },
          { id: "boom", name: "Grande boum", ranks: 3, tier: "base", values: [0.05, 0.1, 0.15], text: "Rayon des explosions et sols incendiés (tours de feu et Météore) +{v}%" },
          { id: "meteorPower", name: "Météore costaud", ranks: 3, tier: "base", values: [0.1, 0.2, 0.3], text: "Dégâts d'impact et de sol de Météore +{v}%" },
          { id: "furnace", name: "Fournaise", ranks: 2, tier: "advanced", values: [0.08, 0.16], text: "Tous les dégâts des tours de feu +{v}%" },
          { id: "meteorHaste", name: "Météores pressés", ranks: 2, tier: "advanced", values: [0.1, 0.2], text: "Recharge de Météore −{v}%" },
          { id: "contagion", name: "Incendie contagieux", ranks: 1, tier: "ultimate", values: [1], text: "Un ennemi mis KO en brûlant transmet sa brûlure à deux voisins (1,5 U)" },
        ],
      },
      ice: {
        name: "Glace",
        items: [
          { id: "longview", name: "Longue-vue givrée", ranks: 3, tier: "base", values: [0.05, 0.1, 0.15], text: "Portée des tours de glace +{v}%" },
          { id: "bite", name: "Givre mordant", ranks: 3, tier: "base", values: [0.03, 0.06, 0.09], text: "Ralentissements des tours de glace +{p} points" },
          { id: "holdfast", name: "Gel tenace", ranks: 3, tier: "base", values: [0.1, 0.2, 0.3], text: "Durée des gels (tours et sort Gel) +{v}%" },
          { id: "thrift", name: "Froid économique", ranks: 2, tier: "advanced", values: [0.1, 0.2], text: "Coût en mana de Gel −{v}%" },
          { id: "shards", name: "Éclats mordants", ranks: 2, tier: "advanced", values: [8, 16], text: "Un gel réussi inflige {n} dégâts à trois voisins (1,3 U)" },
          { id: "brittle", name: "Fragilité polaire", ranks: 1, tier: "ultimate", values: [0.15], text: "À la fin d'un gel, la cible subit +15 % de dégâts pendant 3 s" },
        ],
      },
      water: {
        name: "Eau",
        items: [
          { id: "pump", name: "Pompe musclée", ranks: 3, tier: "base", values: [0.1, 0.2, 0.3], text: "Reculs et attractions (tours d'eau et Vague) +{v}%" },
          { id: "basin", name: "Bassin élargi", ranks: 3, tier: "base", values: [0.05, 0.1, 0.15], text: "Rayon des vortex et zone de Vague +{v}%" },
          { id: "soaked", name: "Trempé jusqu'aux os", ranks: 3, tier: "base", values: [1, 2, 3], text: "Durée de Mouillé +{n} s" },
          { id: "frostwater", name: "Givre sur eau", ranks: 2, tier: "advanced", values: [0.1, 0.2], text: "Gels sur cibles mouillées +{v}%" },
          { id: "hydraulics", name: "Hydraulique lourde", ranks: 2, tier: "advanced", values: [[0.5, 0.25], [0.6, 0.3]], text: "Lourds {h}% et boss {b}% du déplacement aquatique" },
          { id: "insatiable", name: "Siphon insatiable", ranks: 1, tier: "ultimate", values: [1], text: "À mi-durée, chaque vortex attire de nouveau les cibles mouillées" },
        ],
      },
      advancedNeeds: 5,
      ultimateNeeds: 9,
    },

    levels: {
      1: { waves: 10, name: "Bienvenue chez moi" },
      2: { waves: 12, name: "Le domaine coupé en deux" },
      3: { waves: 15, name: "Les trois mauvaises portes" },
      4: { waves: 15, name: "Les pirates du pédalo" },
      5: { waves: 20, name: "Le grand cambriolage" },
    },
  };

  PTMT.config = C;
})();
