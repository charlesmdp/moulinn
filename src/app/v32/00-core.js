// Moulin V32 — socle commun des nouveautés.
//
// Les fichiers de src/app/v32 sont chargés avant le jeu (src/app/moulin.js). Ils
// s'enregistrent ici ; le jeu appelle MoulinV32.start() une fois le jardin construit,
// puis MoulinV32 met à jour chaque système à chaque image.
(function () {
  "use strict";
  const THREE = globalThis.THREE;
  const V32 = (globalThis.MoulinV32 = globalThis.MoulinV32 || {});
  V32.version = 32;
  V32.modules = V32.modules || [];

  /** Enregistre un système. factory(context) renvoie un objet avec update(dt, time, now) facultatif. */
  V32.register = function (name, factory, order = 50) {
    V32.modules.push({ name, factory, order });
  };

  // Uniformes partagés par plusieurs shaders (eau, feuillages, boule…).
  V32.uniforms = {
    sunDirection: { value: THREE ? new THREE.Vector3(-0.49, 0.74, 0.47).normalize() : null },
    sunColor: { value: THREE ? new THREE.Color(1, 0.95, 0.86) : null },
    sunTrue: { value: THREE ? new THREE.Vector3(-0.49, 0.74, 0.47).normalize() : null },
    moonDirection: { value: THREE ? new THREE.Vector3(0.3, 0.6, -0.5).normalize() : null },
    moonLight: { value: THREE ? new THREE.Vector2(0.5, 0.5) : null },
    lightning: { value: 0 },
    daylight: { value: 1 },
    golden: { value: 0 },
    time: { value: 0 },
    wind: { value: 0.3 },
    gust: { value: 0 },
    windDirection: { value: THREE ? new THREE.Vector2(0.83, 0.56).normalize() : null },
    // Remous de l'eau vive (chutes, roue, vannes) : x, z, rayon, intensité.
    turbulence: { value: THREE ? Array.from({ length: 6 }, () => new THREE.Vector4(0, 0, 1, 0)) : [] },
  };

  V32.clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  V32.smoothstep = (edge0, edge1, x) => {
    const t = V32.clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  };
  V32.lerp = (a, b, t) => a + (b - a) * t;
  V32.damp = (current, target, rate, dt) => current + (target - current) * (1 - Math.exp(-rate * dt));

  /**
   * Adresse ouverte (attribut data-route de la page générée par le build) :
   *  - "moulin" (ou "" : page sans attribut) : /moulin — Personnage, Vue libre et Météo (« / » n'est
   *    plus qu'un mot de passe qui y mène ; le jeu n’est que sur /jeu/) ;
   *  - "3d" : /3D — la vue 3D en plus ;
   *  - "build" : /build — la vue 3D et l'atelier « Aménager ».
   */
  V32.route = ((typeof document !== "undefined" && document.documentElement.dataset.route) || "").toLowerCase();
  V32.modeAllowed = (mode) => (mode === "editor" ? V32.route === "build" : mode === "orbit" ? V32.route === "3d" || V32.route === "build" : true);
  V32.startMode = V32.route === "build" ? "editor" : V32.route === "3d" ? "orbit" : "play";

  /** Petit stockage local tolérant (navigation privée, stockage bloqué). */
  V32.store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem("moulin-v32-" + key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem("moulin-v32-" + key, JSON.stringify(value));
      } catch {}
    },
  };

  /**
   * Retouches V32 gardées à part (berges, recalage IGN, zones de sous-bois) : elles
   * voyagent avec les retouches du jeu dans le fichier « Moulin-mes-retouches.json ».
   */
  V32.exportEdits32 = () => ({
    version: 1,
    berges: V32.store.get("berges", []),
    reliefIGN: V32.store.get("relief-ign", null),
    sousBois: V32.store.get("sous-bois", []),
  });
  V32.importEdits32 = function (data) {
    if (!data || typeof data !== "object") return null;
    const done = {};
    if ("berges" in data && V32.berges) done.berges = V32.berges.load(data.berges);
    if ("reliefIGN" in data && V32.reliefIGN) done.reliefIGN = V32.reliefIGN.load(data.reliefIGN);
    // Zones relues et nettoyées par le module (mélange connu, points finis, surface bornée).
    if ("sousBois" in data && V32.sousBois) done.sousBois = V32.sousBois.load(data.sousBois);
    return done;
  };

  /**
   * Ajoute du code à un matériau existant sans casser ses propres modifications
   * (le jeu enchaîne déjà plusieurs onBeforeCompile sur les mêmes matériaux).
   */
  V32.patchMaterial = function (material, key, patch) {
    if (!material || (material.userData.v32Patches && material.userData.v32Patches.includes(key))) return false;
    material.userData.v32Patches = [...(material.userData.v32Patches || []), key];
    const previous = material.onBeforeCompile;
    const previousKey = material.customProgramCacheKey ? material.customProgramCacheKey.bind(material) : null;
    material.onBeforeCompile = function (shader, renderer) {
      if (previous) previous.call(this, shader, renderer);
      patch(shader, renderer);
    };
    material.customProgramCacheKey = () => (previousKey ? previousKey() : "") + "|v32-" + key;
    material.needsUpdate = true;
    return true;
  };

  // Étalonnage des couleurs, commun à tous les matériaux : il est injecté dans la courbe
  // ACES que three.js applique en fin de shader. Aucun passage de rendu supplémentaire,
  // donc aucun coût sur téléphone. Les couleurs gagnent en vivacité (verts, eau, ardoises),
  // les ombres restent légèrement froides et les hautes lumières chaudes, comme une
  // lumière d'été en fin de matinée.
  if (THREE && THREE.ShaderChunk && !V32.gradeInstalled) {
    V32.gradeInstalled = true;
    const chunk = THREE.ShaderChunk.tonemapping_pars_fragment;
    const start = chunk.indexOf("vec3 ACESFilmicToneMapping");
    const end = chunk.indexOf("vec3 CustomToneMapping");
    if (start > 0 && end > start) {
      THREE.ShaderChunk.tonemapping_pars_fragment =
        chunk.slice(0, start) +
        `vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ), vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3( 1.60475, -0.10208, -0.00327 ), vec3( -0.53108, 1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605, 1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	float v32Luma = dot( color, vec3( 0.2126, 0.7152, 0.0722 ) );
	float v32Chroma = max( color.r, max( color.g, color.b ) ) - min( color.r, min( color.g, color.b ) );
	color = max( mix( vec3( v32Luma ), color, 1.2 - 0.12 * saturate( v32Chroma * 2.5 ) ), 0.0 );
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	color = saturate( color );
	float v32Display = dot( color, vec3( 0.2126, 0.7152, 0.0722 ) );
	color += vec3( -0.010, 0.002, 0.016 ) * ( 1.0 - smoothstep( 0.0, 0.34, v32Display ) );
	color += vec3( 0.018, 0.009, -0.014 ) * smoothstep( 0.42, 0.95, v32Display );
	return saturate( color );
}
`
        + chunk.slice(end);
    }
  }

  /** Démarre les systèmes V32. Appelé par le jeu une fois tout construit. */
  V32.start = function (game, hooks) {
    const context = { THREE, game, hooks, systems: {}, V32 };
    const updaters = [];
    const failures = new Set();
    for (const entry of [...V32.modules].sort((a, b) => a.order - b.order)) {
      try {
        const system = entry.factory(context);
        if (!system) continue;
        context.systems[entry.name] = system;
        if (typeof system.update === "function") updaters.push({ name: entry.name, system });
      } catch (error) {
        console.error("[Moulin V32] " + entry.name + " n’a pas démarré", error);
      }
    }
    V32.context = context;
    return {
      systems: context.systems,
      update(dt, time, now) {
        let dirty = false;
        for (const { name, system } of updaters) {
          if (failures.has(name)) continue;
          try {
            if (system.update(dt, time, now)) dirty = true;
          } catch (error) {
            failures.add(name);
            console.error("[Moulin V32] " + name + " arrêté après une erreur", error);
          }
        }
        return dirty;
      },
    };
  };
})();
