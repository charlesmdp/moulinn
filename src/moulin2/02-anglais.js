// La Fête du Moulin (/moulin2) — habillage du moulin en anglais.
//
// La fête s'adresse à un public international : sur /moulin2, et là seulement, les textes de la
// page du moulin (barre d'outils, réglages, météo, écran de chargement, boutons de promenade…)
// sont affichés en anglais. Le code du moulin n'est pas modifié et /moulin reste en français :
//  - à la construction du site, scripts/build.mjs applique ce dictionnaire au HTML de /moulin2 ;
//  - dans le navigateur, un observateur traduit les textes que le moulin écrit ensuite.
// Un texte absent du dictionnaire reste simplement en français.
(function () {
  "use strict";

  /** Textes exacts (espaces resserrés, apostrophes droites) → anglais. */
  const EXACT = {
    // --- page, titres
    "Le moulin Saint-Christophe": "The Dream Mill",
    // la fête est publique : ni le nom du lieu ni celui de la commune n'y paraissent
    "MOULIN DE SAINT CHRISTOPHE": "DREAM MILL FEST",
    "CROKMOULAND": "WORK · PLAY · ADVERTISE",
    "← CROKMOULAND": "A place to relax, work and advertise",
    "Moulin de Saint-Christophe": "The Dream Mill",
    "Elven, Morbihan, Bretagne": "Brittany, France",
    "Moulin de Saint-Christophe · Elven": "The Dream Mill · Brittany",
    "Elven · 56250": "Brittany",
    "Bienvenue au moulin": "Welcome to the Dream Mill",
    "Version 31 · Explorer et aménager": "Version 31 · Explore and landscape",
    "Le moulin · paysage de jeu": "The mill · game landscape",
    "LES JARDINS": "THE GARDENS",
    "Maquette 3D du moulin en pierre, de ses trois étangs et de la vallée boisée.": "3D model of the stone mill, its three ponds and the wooded valley.",
    "Relief et dimensions estimés à partir des photographies": "Terrain and dimensions estimated from photographs",
    "Visite libre : ZQSD + souris · Éditeur : arbres, relief et sentiers": "Free tour: WASD + mouse · Editor: trees, terrain and paths",
    "Le jeu a besoin de JavaScript. Ouvre son adresse HTTPS directement dans Safari ou Chrome, plutôt que dans un aperçu de fichier.": "This game needs JavaScript. Open its HTTPS address directly in Safari or Chrome rather than in a file preview.",
    "Crédits des matières et modèles": "Material and model credits",
    "Troncs, sapins, rochers et touffes :": "Trunks, firs, rocks and tufts:",
    ". Couronnes à facettes, bouleaux et vieux arbres adaptés pour cette maquette. Textures stylisées préparées pour le moulin. Modèles GLB sélectionnés intégrés dans le fichier et fournis dans les sources.": ". Faceted crowns, birches and old trees adapted for this model. Stylised textures prepared for the mill. Selected GLB models embedded in the file and provided with the sources.",

    // --- chargement
    "Ouverture de la maquette…": "Raising the big top…",
    "Préparation du jeu…": "Setting up the fairground…",
    "Préparation de la maquette": "Preparing the model",
    "Préparation de la prairie…": "Preparing the meadow…",
    "Préparation de la visite du domaine…": "Preparing the tour of the estate…",
    "Préparation des matières…": "Preparing materials…",
    "Préparation du rendu…": "Preparing the renderer…",
    "Chargement…": "Loading…",
    "Chargement du moulin…": "Opening the gates…",
    "Téléchargement des ressources…": "Downloading assets…",
    "Construction du jardin…": "Building the garden…",
    "Construction du terrain…": "Building the terrain…",
    "Arbres et pelouse…": "Trees and lawn…",
    "Herbe et ambiance…": "Grass and ambience…",
    "Le moulin et ses étangs…": "The mill and its ponds…",
    "Météo et sauvegarde du jardin…": "Weather and garden save…",
    "Optimisation du paysage…": "Optimising the landscape…",
    "Ouverture de la vue 3D…": "Opening the 3D view…",
    "Passages et accès au moulin…": "Paths and ways into the mill…",
    "Votre jardin sauvegardé…": "Your saved garden…",
    "Votre personnage…": "Your character…",
    "Recharger": "Reload",
    "Le moulin n'a pas pu démarrer": "The mill could not start",
    "La 3D n'a pas pu démarrer": "3D could not start",
    "Le calcul prend plus de temps que prévu. Vous pouvez recharger la page si le navigateur a suspendu le chargement.": "This is taking longer than expected. You can reload the page if the browser paused loading.",

    // --- barre d'outils et modes
    "Personnage": "Character",
    "Vue libre": "Free view",
    "À pied": "On foot",
    "Promenade": "Walk",
    "Météo": "Weather",
    "Réglages": "Settings",
    "Plein écran": "Full screen",
    "Réduire": "Exit full screen",
    "Recentrer": "Recenter",
    "Recentrer le moulin": "Recenter the mill",
    "Changer de vue": "Switch view",
    "Mode de visite": "Tour mode",
    "Afficher en plein écran": "Go full screen",
    "Quitter le plein écran": "Exit full screen",
    "Points de vue, météo et qualité": "Viewpoints, weather and quality",
    "Masquer les outils": "Hide tools",
    "Afficher les outils": "Show tools",
    "Outils": "Tools",
    "Revenir au point de vue choisi": "Back to the chosen viewpoint",
    "Faire tourner": "Spin",
    "Pause rotation": "Pause rotation",
    "Revenir au jardin": "Back to the garden",
    "Terminer": "Finish",
    "Annuler le point": "Undo point",
    "Fermer": "Close",

    // --- réglages
    "Réglages de la visite": "Tour settings",
    "Fermer les réglages": "Close settings",
    "La visite": "The tour",
    "Vent & ambiance": "Wind & ambience",
    "Vent et ambiance sonore": "Wind and ambient sound",
    "Au rythme du jardin": "At the garden's pace",
    "Activer le son": "Turn sound on",
    "Couper le son": "Mute sound",
    "Son coupé · active-le quand tu le souhaites": "Sound off · turn it on whenever you like",
    "Vent": "Wind",
    "Volume": "Volume",
    "Vitesse": "Speed",
    "Ambiance": "Ambience",
    "Volume de l'ambiance sonore": "Ambient sound volume",
    "Aucun": "None",
    "Léger": "Light",
    "Modéré": "Moderate",
    "Fort": "Strong",
    "Très fort": "Very strong",
    "Tempête": "Storm",
    "Point de vue": "Viewpoint",
    "Paysage et météo": "Landscape and weather",
    "Lumière et matières": "Light and materials",
    "Lumière du paysage": "Landscape lighting",
    "Qualité du rendu": "Render quality",
    "Détaillé · 60 i/s": "Detailed · 60 fps",
    "Équilibré · 30 i/s": "Balanced · 30 fps",
    "Économe · 24 i/s": "Power saver · 24 fps",
    "Jour": "Day",
    "Soleil": "Sun",
    "Ciel couvert": "Overcast",
    "Pluie": "Rain",
    "Neige": "Snow",
    "Nuit étoilée": "Starry night",
    "Nuit noire": "Dark night",
    "Heure réelle": "Real time",
    "Météo réelle": "Live weather",
    "Arbres": "Trees",
    "Animations": "Animations",
    "Fumée des cheminées": "Chimney smoke",
    "Deux panaches légers qui suivent le vent": "Two light plumes that follow the wind",
    "Rester au-dessus du sol": "Stay above ground",
    "Repartir de l'entrée": "Restart from the entrance",
    "Version livrée · aucune retouche locale chargée": "Shipped version · no local edits loaded",
    "Voir la version livrée": "View the shipped version",

    // --- points de vue
    "Façade et jardins · vue drone": "Front and gardens · drone view",
    "Moulin et jardin": "Mill and garden",
    "Toute la vallée": "The whole valley",
    "Vue du dessus": "Top view",
    "Vue drone des étangs": "Drone view of the ponds",
    "Le moulin et l'île": "The mill and the island",
    "Le moulin et les passerelles": "The mill and the footbridges",
    "La roue à aubes": "The water wheel",
    "La véranda et son bassin": "The conservatory and its pool",
    "Le bief sur la terrasse": "The millrace on the terrace",
    "Les deux vannes et le bief": "The two sluice gates and the millrace",
    "Le pont et la cascade": "The bridge and the waterfall",
    "Pont en bois restauré": "Restored wooden bridge",
    "Petit bassin et rivière après le pont": "Small pool and river past the bridge",
    "Petite fontaine de la rocaille": "Little rockery fountain",
    "Mur et rocaille face au moulin": "Wall and rockery facing the mill",
    "Paliers et escaliers du jardin": "Garden terraces and stairs",
    "Escalier sous les camélias": "Stairs under the camellias",
    "Fauteuil sous les pins": "Armchair under the pines",
    "Table et salon corail": "Table and coral lounge set",
    "Cour, voitures et carport": "Courtyard, cars and carport",
    "Entrée et deux murets": "Entrance and two low walls",
    "Départ de l'allée": "Start of the driveway",
    "La dépendance et la colline": "The outbuilding and the hill",
    "La dépendance et son aile gauche": "The outbuilding and its left wing",
    "Arrière de la dépendance": "Back of the outbuilding",
    "Terrain derrière le mur": "Land behind the wall",
    "Ensemble de la colline": "The whole hill",
    "La colline · sans arbres": "The hill · without trees",
    "Jardins · sans arbres": "Gardens · without trees",
    "Chemin haut en sous-bois": "Upper woodland path",
    "Sentiers en sous-bois": "Woodland paths",
    "Bief et rivière dans la vallée": "Millrace and river in the valley",
    "Eau au pied de la terrasse": "Water at the foot of the terrace",
    "Eau et berges": "Water and banks",
    "Pente de la rive opposée": "Slope of the opposite bank",
    "Le cygne et les oies": "The swan and the geese",
    "Depuis l'étage": "From upstairs",
    "Au niveau du jardin": "At garden level",
    "Plan des pelouses": "Lawn plan",
    "Plan des étangs et cours d'eau": "Plan of the ponds and streams",
    "Plan du bâti (sans arbres)": "Building plan (without trees)",
    "Grand étang": "Large pond",
    "Étang intermédiaire": "Middle pond",
    "Petit étang": "Small pond",

    // --- aide et commandes
    "Commandes": "Controls",
    "Personnage : ZQSD ou flèches, Maj pour courir, glisser pour orienter la caméra. Sur téléphone : joystick à gauche (on court ; « Marcher » pour ralentir) et regard à droite.": "Character: WASD or arrows, Shift to run, drag to turn the camera. On a phone: joystick on the left (you run; “Walk” slows down) and look around on the right.",
    "Glisser pour tourner · Molette pour approcher · Clic droit pour déplacer": "Drag to rotate · Scroll to zoom · Right-click to pan",
    "Cliquez dans la vue pour piloter à la souris · Échap pour libérer la souris": "Click the view to steer with the mouse · Esc to release the mouse",
    "Glisser pour regarder · Flèches pour avancer · + / − pour monter ou descendre": "Drag to look · Arrows to move · + / − to go up or down",
    "Souris : maintenez le clic droit · ZQSD pour avancer": "Mouse: hold right-click · WASD to move",
    "Un doigt : tourner · Deux doigts : zoomer ou déplacer": "One finger: rotate · Two fingers: zoom or pan",
    "ZQSD : marcher · Maj : courir · Espace : sauter · E : monter": "WASD: walk · Shift: run · Space: jump · E: get on",
    "Joystick : marcher · Sauter · Glisser : regarder": "Joystick: walk · Jump · Drag: look",
    "ZQSD": "WASD",
    "Souris": "Mouse",
    "Maj": "Shift",
    "Espace / Ctrl": "Space / Ctrl",
    "accélérer": "speed up",
    "avancer et se décaler ·": "move and strafe ·",
    "monter / descendre ·": "up / down ·",
    "regarder ·": "look ·",
    "Bienvenue au domaine. Le panneau suivant vous explique les commandes pour explorer les jardins.": "This old watermill has been turned into a place to relax, work and advertise, for entrepreneurs from all over the world. The next sign explains the controls.",

    // --- panneau des commandes à l'entrée (peint sur un panneau 3D : voir le crochet des dessins plus bas)
    "BIENVENUE AU MOULIN": "WELCOME TO THE MILL",
    "Un secret vous attend près du pont du fond du terrain,": "A secret awaits you near the bridge at the far end of the grounds,",
    "juste avant que le ruisseau n'alimente l'étang…": "just before the stream flows into the pond…",
    "ZQSD / FLÈCHES": "WASD / ARROWS",
    "ZQSD / Flèches": "WASD / Arrows",
    "Marcher ou conduire": "Walk or drive",
    "SOURIS": "MOUSE",
    "Regarder autour de soi": "Look around",
    "Monter / descendre du véhicule": "Get on / off the vehicle",
    "Creuser à pied": "Dig (on foot)",
    "Lampe, uniquement la nuit": "Flashlight, at night only",
    "MAJ": "SHIFT",
    "Courir / accélérer": "Run / speed up",
    "ESPACE": "SPACE",
    "Sauter à pied / freiner en véhicule": "Jump on foot / brake in a vehicle",
    "L : lire ce panneau · Sur mobile : toucher la lettre": "L: read this sign · On mobile: tap the letter",
    "ZQSD / flèches · Maj : courir · Glisser : regarder": "WASD / arrows · Shift: run · Drag: look",
    "ZQSD · Espace monter · Ctrl descendre · Maj accélérer · Échap libérer la souris": "WASD · Space up · Ctrl down · Shift speed up · Esc release the mouse",

    // --- promenade, véhicules, trésor
    "Sauter": "Jump",
    "Courir": "Run",
    "Marcher": "Walk",
    "MARCHER": "WALK",
    "Lampe": "Flashlight",
    "Lampe allumée": "Flashlight on",
    "Creuser": "Dig",
    "Frein": "Brake",
    "CONDUIRE": "DRIVE",
    "Voiture": "Car",
    "Monter": "Get on",
    "Descendre": "Get off",
    "Monter sur le quad": "Ride the quad",
    "Descendre du véhicule": "Get off the vehicle",
    "Ralentir pour descendre": "Slow down to get off",
    "Lire": "Read",
    "Lire le panneau": "Read the sign",
    "Ouvrir le coffre": "Open the chest",
    "Ouvrir le coffre (O)": "Open the chest (O)",
    "Reprendre la promenade": "Back to the walk",
    "Le trésor du moulin": "The mill's treasure",
    "Bravo, vous avez trouvé le trésor !": "Well done, you found the treasure!",
    "Merci de montrer cet écran au créateur du jeu pour qu'il vous attribue des points.": "Please show this screen to the game's creator to be awarded your points.",
    "Quelque chose résonne sous la pelle…": "Something clangs under the spade…",
    "Le sceau du Cygne se soulève…": "The Swan's seal is lifting…",
    "Creuser devant le personnage": "Dig in front of the character",
    "Allumer ou éteindre la lampe torche": "Turn the flashlight on or off",
    "Allumer la lampe · F": "Turn on the flashlight · F",
    "Allumer": "Turn on",
    "Éteindre": "Turn off",
    "Joystick de déplacement": "Movement joystick",
    "Déplacement tactile": "Touch movement",
    "Maintenir le boost du quad": "Hold for the quad's boost",
    "Maintenir pour courir": "Hold to run",
    "Maintenir pour freiner": "Hold to brake",
    "Maintenir pour accélérer": "Hold to accelerate",
    "Rapprocher la caméra": "Zoom in",
    "Éloigner la caméra": "Zoom out",
    "Recentrer la caméra": "Recenter the camera",
    "Carte des alentours": "Map of the surroundings",
    "Afficher toute la propriété sur la carte": "Show the whole property on the map",
    "Revenir à la carte des alentours": "Back to the map of the surroundings",
    "Nord en haut": "North up",
    "Cygne cuivré de l'Ordre": "Copper swan of the Order",
    "Tracé d'une zone de sous-bois": "Outline of a woodland area",
    "Arrêter de dessiner et revenir aux outils": "Stop drawing and go back to the tools",

    // --- météo et boule à neige
    "Météo au moulin": "Weather at the mill",
    "Météo et boule à neige du moulin": "Weather and the mill's snow globe",
    "Afficher la météo": "Show the weather",
    "Actualiser la météo": "Refresh the weather",
    "Actualiser": "Refresh",
    "Afficher tout le détail": "Show full details",
    "Masquer la météo (la boule seule)": "Hide the weather (globe only)",
    "Masquer la météo": "Hide the weather",
    "Faire défiler les heures": "Play through the hours",
    "Arrêter le défilement": "Stop playback",
    "Faire tourner la boule": "Spin the globe",
    "Heure affichée dans la boule": "Time shown in the globe",
    "Heure par heure": "Hour by hour",
    "Sept jours": "Seven days",
    "Maintenant": "Now",
    "Aujourd'hui": "Today",
    "Demain": "Tomorrow",
    "Prévisions": "Forecast",
    "Nuages": "Clouds",
    "Visibilité": "Visibility",
    "Lune": "Moon",
    "Nouvelle lune": "New moon",
    "Premier croissant": "Waxing crescent",
    "Premier quartier": "First quarter",
    "Gibbeuse croissante": "Waxing gibbous",
    "Pleine lune": "Full moon",
    "Gibbeuse décroissante": "Waning gibbous",
    "Dernier quartier": "Last quarter",
    "Dernier croissant": "Waning crescent",
    "Météo indisponible": "Weather unavailable",
    "Chargement de la météo…": "Loading the weather…",
    "Météo en attente": "Weather pending",
    "Météo réelle : chargement…": "Live weather: loading…",
    "Lieu du moulin": "Mill location",
    "Commune du moulin": "The mill's town",
    "Où se trouve le moulin ?": "Where is the mill?",
    "La météo, l'heure du lever et du coucher du soleil et la course de la lune suivent ce lieu.": "The weather, sunrise and sunset times and the moon's path follow this place.",
    "Rechercher une commune": "Search for a town",
    "Recherche…": "Searching…",
    "Localisation…": "Locating…",
    "Utiliser ma position actuelle": "Use my current location",
    "Ma position": "My location",
    "Choisir le lieu du moulin": "Choose the mill's location",
    "La localisation n'est pas disponible dans ce navigateur.": "Location is not available in this browser.",
    "La position actuelle n'est accessible que sur l'adresse HTTPS du site : cherche la commune ci-dessus.": "Your current location is only available on the site's HTTPS address: search for the town above.",
    "Localisation refusée.": "Location access denied.",
    "Ciel dégagé": "Clear sky",
    "Plutôt dégagé": "Mostly clear",
    "Éclaircies": "Sunny spells",
    "Couvert": "Overcast",
    "Brouillard": "Fog",
    "Brouillard givrant": "Freezing fog",
    "Bruine légère": "Light drizzle",
    "Bruine": "Drizzle",
    "Bruine épaisse": "Heavy drizzle",
    "Bruine verglaçante": "Freezing drizzle",
    "Pluie faible": "Light rain",
    "Forte pluie": "Heavy rain",
    "Pluie verglaçante": "Freezing rain",
    "Pluie verglaçante forte": "Heavy freezing rain",
    "Neige faible": "Light snow",
    "Forte neige": "Heavy snow",
    "Grains de neige": "Snow grains",
    "Averses faibles": "Light showers",
    "Averses": "Showers",
    "Violentes averses": "Violent showers",
    "Averses de neige": "Snow showers",
    "Fortes averses de neige": "Heavy snow showers",
    "Grêle": "Hail",
    "Orage": "Thunderstorm",
    "Orage et grêle": "Thunderstorm with hail",
    "Orage, forte grêle": "Thunderstorm with heavy hail",
    "Temps variable": "Changeable",
    "Hors connexion": "Offline",
    "Délai dépassé": "Timed out",
    "Prévisions incomplètes": "Incomplete forecast",
    "centre de la France": "central France",
  };

  /** Dans un attribut (info-bulle, libellé d'accessibilité), ces mots désignent les commandes de vol. */
  const ATTR = { "Monter": "Up", "Descendre": "Down", "Avancer": "Forward", "Reculer": "Back", "Gauche": "Left", "Droite": "Right" };

  /** Textes composés : motif → anglais (les morceaux variables repassent par le dictionnaire). */
  const PATTERNS = [
    [/^Changer de vue, mode actuel : (.*)$/, (m) => "Switch view, current mode: " + text(m[1])],
    [/^Chargement des ressources : (\d+)\/(\d+)$/, (m) => "Lighting the bulbs: " + m[1] + "/" + m[2]],
    [/^Ressenti (.*)$/, (m) => "Feels like " + m[1]],
    [/^(\d+) % de risque$/, (m) => m[1] + "% chance"],
    [/^humidité (\d+) %$/, (m) => "humidity " + m[1] + "%"],
    [/^(\d+) % éclairée$/, (m) => m[1] + "% lit"],
    [/^· (données conservées, )?(à l'instant|il y a (\d+) min)( · lieu approximatif)?$/, (m) => "· " + (m[1] ? "cached data, " : "") + (m[3] ? m[3] + " min ago" : "just now") + (m[4] ? " · approximate location" : "")],
    [/^Météo réelle à (.+) : (.+), (-?\d+) °C, vent (\d+) km\/h( · dernière mise à jour conservée)?$/, (m) => "Live weather in " + text(m[1]) + ": " + lower(m[2]) + ", " + m[3] + " °C, wind " + m[4] + " km/h" + (m[5] ? " · last update kept" : "")],
    [/^Météo réelle indisponible \((.*)\) · ciel dégagé en attendant$/, (m) => "Live weather unavailable (" + text(m[1]) + ") · clear sky meanwhile"],
    [/^Service météo indisponible \((.*)\)$/, (m) => "Weather service unavailable (" + m[1] + ")"],
  ];

  const norm = (s) => String(s).replace(/\s+/g, " ").trim().replace(/’/g, "'");
  const has = (map, key) => Object.prototype.hasOwnProperty.call(map, key);
  /** Traduction d'un texte déjà resserré ; null s'il n'est pas connu. */
  function lookup(key, attribute) {
    if (attribute && has(ATTR, key)) return ATTR[key];
    if (has(EXACT, key)) return EXACT[key];
    if (key.length > 240) return null;
    for (const [pattern, build] of PATTERNS) {
      const m = pattern.exec(key);
      if (m) return build(m);
    }
    return null;
  }
  function text(s) {
    const t = lookup(norm(s), false);
    return t === null ? s : t;
  }
  /** Libellé météo remis en minuscules : le moulin écrit « pluie faible », le dictionnaire « Pluie faible ». */
  function lower(s) {
    const key = norm(s);
    for (const k in EXACT) if (k.toLowerCase() === key) return EXACT[k].toLowerCase();
    return s;
  }
  /** Traduit un texte en gardant ses espaces de début et de fin ; null si rien ne change. */
  function translate(value, attribute) {
    if (!value) return null;
    const key = norm(value);
    if (key.length < 2) return null;
    const t = lookup(key, attribute);
    if (t === null || t === key) return null;
    const raw = String(value);
    return /^\s*/.exec(raw)[0] + t + /\s*$/.exec(raw)[0];
  }

  globalThis.MoulinFeteAnglais = { EXACT, ATTR, translate };

  if (typeof document === "undefined" || (document.documentElement.dataset.route || "").toLowerCase() !== "moulin2") return;
  if (globalThis.MoulinFeteAnglais.on) return;
  globalThis.MoulinFeteAnglais.on = true;

  // Les dates de la météo (jours de la semaine) sont demandées en français : on répond en anglais.
  try {
    const Native = Intl.DateTimeFormat;
    const English = function (locales, options) {
      return new Native(typeof locales === "string" && /^fr\b/i.test(locales) ? "en-GB" : locales, options);
    };
    English.prototype = Native.prototype;
    English.supportedLocalesOf = Native.supportedLocalesOf.bind(Native);
    Intl.DateTimeFormat = English;
  } catch (error) {
    /* sans importance : les jours resteront en français */
  }

  // Textes peints sur des panneaux 3D ou sur la carte (dessinés dans un canevas) : traduits au
  // moment où le moulin les dessine. Les textes de la fête, déjà en anglais, passent tels quels.
  try {
    const proto = CanvasRenderingContext2D.prototype;
    for (const name of ["fillText", "strokeText", "measureText"]) {
      const native = proto[name];
      proto[name] = function (value, ...rest) {
        const t = typeof value === "string" && value.length > 2 ? translate(value, false) : null;
        return native.call(this, t === null ? value : t, ...rest);
      };
    }
  } catch (error) {
    /* sans importance : ces panneaux resteront en français */
  }

  const ATTRS = ["title", "aria-label", "placeholder", "alt"];
  // L'interface de la fête est déjà en anglais ; scripts et styles ne sont pas des textes.
  const SKIP = ".fete-ui, .fete-touch, script, style";
  function textNode(node) {
    const parent = node.parentElement;
    if (!parent || parent.closest(SKIP)) return;
    const t = translate(node.nodeValue, false);
    if (t !== null) node.nodeValue = t;
  }
  function attributes(el) {
    for (const name of ATTRS) {
      if (!el.hasAttribute(name)) continue;
      const t = translate(el.getAttribute(name), true);
      if (t !== null) el.setAttribute(name, t);
    }
  }
  function sweep(root) {
    if (root.nodeType === 3) return textNode(root);
    if (root.nodeType !== 1 || root.closest(SKIP)) return;
    attributes(root);
    for (const el of root.querySelectorAll("[title],[aria-label],[placeholder],[alt]")) if (!el.closest(SKIP)) attributes(el);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) textNode(node);
  }
  const observer = new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === "characterData") textNode(r.target);
      else if (r.type === "attributes") {
        if (!r.target.closest(SKIP)) attributes(r.target);
      } else for (const node of r.addedNodes) sweep(node);
    }
  });
  observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  document.documentElement.lang = "en";
  sweep(document.documentElement);
  if (document.title) document.title = text(document.title);
})();
