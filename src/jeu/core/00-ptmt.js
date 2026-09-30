// « Pas touche à mes trésors » — socle commun (espace de noms, unités, couleurs, cache de matières).
//
// Toutes les parties du jeu sont des scripts classiques qui s'enregistrent sur globalThis.PTMT
// (chargés dans l'ordre des noms de fichiers). three.js r128 est disponible en global (THREE)
// pour le rendu ; la simulation (PTMT.sim) n'en dépend pas.
(function () {
  "use strict";
  const PTMT = (globalThis.PTMT = globalThis.PTMT || {});

  /** 1 U (unité de jeu) = hauteur d'un voleur = 1,8 m dans le monde 3D. */
  PTMT.U = 1.8;

  const hasThree = typeof THREE !== "undefined";

  /** Couleur sRGB (#rrggbb ou 0xrrggbb) convertie en linéaire, comme le reste du rendu. */
  PTMT.color = function (hex) {
    if (!hasThree) return null;
    return new THREE.Color(hex).convertSRGBToLinear();
  };

  // Cache de matières partagées : une même clé renvoie toujours la même matière.
  const materials = new Map();
  PTMT.mat = function (key, factory) {
    let m = materials.get(key);
    if (!m) {
      m = factory();
      m.name = m.name || "ptmt:" + key;
      materials.set(key, m);
    }
    return m;
  };
  /** Matière standard mate d'une couleur donnée (partagée). */
  PTMT.solid = function (hex, options = {}) {
    const key = "solid:" + hex + ":" + JSON.stringify(options);
    return PTMT.mat(key, () => new THREE.MeshStandardMaterial(Object.assign({ color: PTMT.color(hex), roughness: 0.82, metalness: 0 }, options)));
  };
  /** Matière émissive (lueurs de feu, de glace, de runes). */
  PTMT.glow = function (hex, intensity = 1, options = {}) {
    const key = "glow:" + hex + ":" + intensity + ":" + JSON.stringify(options);
    return PTMT.mat(key, () =>
      new THREE.MeshStandardMaterial(Object.assign({ color: PTMT.color(hex), emissive: PTMT.color(hex), emissiveIntensity: intensity, roughness: 0.5, metalness: 0 }, options)),
    );
  };

  // Cache de géométries partagées.
  const geometries = new Map();
  PTMT.geo = function (key, factory) {
    let g = geometries.get(key);
    if (!g) {
      g = factory();
      geometries.set(key, g);
    }
    return g;
  };

  /** Petit générateur pseudo-aléatoire reproductible (mulberry32). */
  PTMT.rng = function (seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  PTMT.models = PTMT.models || {};
  PTMT.actors = PTMT.actors || {};
  PTMT.fx = PTMT.fx || {};
})();
