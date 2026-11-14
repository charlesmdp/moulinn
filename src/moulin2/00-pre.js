// La Fête du Moulin (/moulin2) — avant le jeu.
//
// Ce fichier est chargé juste avant le jeu du moulin (src/start.js), sur la page /moulin2
// seulement. Il prépare trois choses sans toucher au code du moulin :
//  1. des réglages locaux à part : tout ce que la page /moulin garde dans le navigateur
//     (retouches de l'atelier, météo, heure, qualité…) est rangé sous un autre nom ici, pour que
//     tous les joueurs voient exactement le même terrain et que /moulin2 ne dérègle pas /moulin ;
//  2. le plein jour et le beau temps par défaut (on joue à toute heure, partout dans le monde) ;
//  3. des couleurs plus vives : la courbe d'étalonnage commune à tous les matériaux est remplacée
//     par une version plus saturée et un peu plus contrastée (aucun passage de rendu en plus).
(function () {
  "use strict";
  const MF = (globalThis.MoulinFete = globalThis.MoulinFete || {});
  MF.version = 1;
  MF.route = ((typeof document !== "undefined" && document.documentElement.dataset.route) || "").toLowerCase();
  MF.assets = { p2p: "{{asset:p2p}}", sponsors: "moulin2/sponsors.json" };
  if (MF.route !== "moulin2" || MF.preDone) return;
  MF.preDone = true;

  // 1. Réglages à part : les clés « moulin-… » du jeu sont rangées sous « m2:moulin-… ».
  try {
    const proto = Storage.prototype;
    const get = proto.getItem, set = proto.setItem, remove = proto.removeItem;
    const scoped = (key) => (typeof key === "string" && key.startsWith("moulin-") ? "m2:" + key : key);
    proto.getItem = function (key) {
      return get.call(this, scoped(key));
    };
    proto.setItem = function (key, value) {
      return set.call(this, scoped(key), value);
    };
    proto.removeItem = function (key) {
      return remove.call(this, scoped(key));
    };
    // 2. Plein jour, beau temps, tant que le joueur n'a rien choisi d'autre dans Réglages.
    const seed = (key, value) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(value));
    };
    seed("moulin-v32-time-mode", "manual");
    seed("moulin-v32-weather-mode", "sun");
    seed("moulin-night-v22", { mode: "day", torch: false });
  } catch (error) {
    // stockage bloqué (navigation privée stricte) : le jeu fonctionne avec ses valeurs par défaut
  }

  // 3. Couleurs plus vives. Le socle du moulin (src/app/v32/00-core.js) installe sa propre courbe
  //    sauf si « gradeInstalled » est déjà vrai : on pose la nôtre d'abord.
  const THREE = globalThis.THREE;
  const V32 = (globalThis.MoulinV32 = globalThis.MoulinV32 || {});
  if (THREE && THREE.ShaderChunk && !V32.gradeInstalled) {
    const chunk = THREE.ShaderChunk.tonemapping_pars_fragment;
    const start = chunk.indexOf("vec3 ACESFilmicToneMapping");
    const end = chunk.indexOf("vec3 CustomToneMapping");
    if (start > 0 && end > start) {
      V32.gradeInstalled = true;
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
	// Fête du Moulin : saturation franche (les teintes déjà vives sont un peu retenues pour ne pas baver).
	float feteLuma = dot( color, vec3( 0.2126, 0.7152, 0.0722 ) );
	float feteChroma = max( color.r, max( color.g, color.b ) ) - min( color.r, min( color.g, color.b ) );
	color = max( mix( vec3( feteLuma ), color, 1.46 - 0.2 * saturate( feteChroma * 2.2 ) ), 0.0 );
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	color = saturate( color );
	// un peu de contraste autour des tons moyens, ombres légèrement bleutées, lumières chaudes
	color = mix( color, color * color * ( 3.0 - 2.0 * color ), 0.22 );
	float feteDisplay = dot( color, vec3( 0.2126, 0.7152, 0.0722 ) );
	color += vec3( -0.012, 0.003, 0.022 ) * ( 1.0 - smoothstep( 0.0, 0.34, feteDisplay ) );
	color += vec3( 0.024, 0.012, -0.016 ) * smoothstep( 0.42, 0.95, feteDisplay );
	return saturate( color );
}
` +
        chunk.slice(end);
    }
  }
})();
