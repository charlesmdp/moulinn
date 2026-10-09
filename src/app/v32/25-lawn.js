// Moulin V32 — pelouse au naturel.
//
// Vue à hauteur d'homme, la pelouse de la V31 sortait presque vert pastel : la couleur
// de base était très claire et le reflet rasant du matériau la blanchissait encore.
// On assombrit et on sature un peu la couleur des surfaces enherbées (le relief et les
// pelouses du jardin) et on retire l'essentiel de ce reflet, l'herbe n'étant pas
// brillante. Le masque ne retient que les teintes franchement vertes : allées, terre,
// massifs et neige gardent leur couleur.
(function () {
  "use strict";
  const V32 = globalThis.MoulinV32;

  const PARS = "uniform vec3 lawnTint32;\nuniform float lawnSheen32;\n";
  const ALBEDO = `float lawnMask32=smoothstep(0.,.05,diffuseColor.g-max(diffuseColor.r,diffuseColor.b));
diffuseColor.rgb*=mix(vec3(1.),lawnTint32,lawnMask32);
#include <lights_physical_fragment>`;
  const SHEEN = `float lawnSheenMix32=mix(1.,lawnSheen32,lawnMask32);
reflectedLight.directSpecular*=lawnSheenMix32;
reflectedLight.indirectSpecular*=lawnSheenMix32;
#include <aomap_fragment>`;

  function patchLawn(material) {
    if (!material || !material.isMeshStandardMaterial) return false;
    return V32.patchMaterial(material, "lawn", (shader) => {
      const source = shader.fragmentShader;
      if (!source.includes("#include <lights_physical_fragment>") || !source.includes("#include <aomap_fragment>")) return;
      shader.uniforms.lawnTint32 = V32.uniforms.lawnTint;
      shader.uniforms.lawnSheen32 = V32.uniforms.lawnSheen;
      shader.fragmentShader =
        PARS +
        source.replace("#include <lights_physical_fragment>", ALBEDO).replace("#include <aomap_fragment>", SHEEN);
    });
  }

  V32.register(
    "lawn",
    function (context) {
      const { THREE, game, hooks } = context;
      // Réglables depuis la console : MoulinV32.uniforms.lawnTint.value.set(r, v, b).
      V32.uniforms.lawnTint = V32.uniforms.lawnTint || { value: new THREE.Vector3(0.64, 0.66, 0.53) };
      V32.uniforms.lawnSheen = V32.uniforms.lawnSheen || { value: 0.3 };
      const grassMap = hooks.surfaces && hooks.surfaces.grass;
      const terrain = game.scene && game.scene.getObjectByName("Relief_estime_de_la_vallee");
      const seen = new Set();
      const visit = (material) => {
        if (!material || seen.has(material)) return;
        seen.add(material);
        if (material === terrain?.material || (grassMap && material.map === grassMap)) patchLawn(material);
      };
      if (game.scene)
        game.scene.traverse((object) => {
          if (!object.isMesh) return;
          if (Array.isArray(object.material)) object.material.forEach(visit);
          else visit(object.material);
        });
      if (hooks.materials) visit(hooks.materials.grass);
      return null;
    },
    25,
  );
})();
