// Moulin V32 — horloge et vent partagés par les feuillages.
//
// Les couronnes d'arbres ne sont plus retouchées ici : les arbres détaillés
// (src/app/v32/15-arbres.js) ont leurs propres feuillages (cartes de feuilles,
// lumière qui traverse les feuilles, frémissement). Ce module tient à jour l'horloge,
// la force et la direction du vent communes aux autres shaders de végétation et d'eau
// (berges, remous, anneaux de pluie…).
(function () {
  "use strict";
  const V32 = globalThis.MoulinV32;

  V32.register(
    "foliage",
    function (context) {
      const { game } = context;
      return {
        update(dt, time) {
          V32.uniforms.time.value = time;
          const wind = game.ambience?.wind?.value;
          if (Number.isFinite(wind)) V32.uniforms.wind.value = wind;
          const direction = game.ambience?.windDirection?.value;
          if (direction) V32.uniforms.windDirection.value.copy(direction);
          return false;
        },
      };
    },
    20,
  );
})();
