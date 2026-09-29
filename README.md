# Moulin de Saint-Christophe

Le jardin interactif 3D du moulin, **version 32** : le moulin, la dépendance,
les jardins, l'eau, les véhicules, les animaux, l'aménagement et les commandes
tactiles, avec la météo et l'heure réelles. L'onglet **Jeu** ouvre
« Pas touche à mes trésors », un tower defense dans le domaine du moulin
(adresse `/jeu/`).

Le dossier `dist/` est le site prêt à publier (Cloudflare Pages ou tout
hébergement statique en HTTPS). Les sources modifiables sont dans `src/`.

## Les adresses du site

| Adresse | Contenu |
| --- | --- |
| `/` | L'accueil des visiteurs : Personnage, Vue libre, Météo et Jeu |
| `/3D/` | La même page avec la **Vue 3D** en plus |
| `/build/` | La vue 3D et l'atelier **Aménager** (page non indexée par les moteurs de recherche) |
| `/jeu/` | Le jeu « Pas touche à mes trésors » |

`/3d` ou `/Build` (autres majuscules, avec ou sans « / ») mènent aux mêmes
pages. Rappel : les retouches faites dans l'atelier restent dans le navigateur
qui les a faites ; `/build` évite surtout que les visiteurs tombent sur
l'atelier.

## Nouveautés de cette série

- **Plus de gel quand la lumière change** : allumer la lampe torche ou les
  phares du quad, le lever et le coucher du soleil (y compris en faisant
  défiler les heures dans la boule) et l'entrée dans l'onglet Météo ne
  recompilent plus les shaders de tout le jardin, ce qui figeait le jeu une
  dizaine de secondes : le nombre de lumières et d'ombres de la scène ne
  change plus jamais (une lumière éteinte a une intensité nulle), et les
  matières de la lampe et des faisceaux sont préparées au démarrage.
- **Boule à neige** : plus rien ne dépasse de la boule (les murets, herbes,
  objets et plantes ajoutés récemment sont découpés comme le reste). Sur
  téléphone, l'onglet Météo montre la boule seule ; la pastille du bas (temps
  et température) déplie la météo et la frise des heures, la croix la replie.
- **Personnage sur téléphone** : il court par défaut ; le bouton « Marcher » le
  fait marcher, un nouvel appui (« Courir ») le refait courir. Sur le quad, le
  bouton reste « Gaz ».
- **En-tête allégé** : la carte « Saint-Christophe » en haut à gauche a
  disparu, les onglets restent au centre.

## Retouches précédentes

- **L'eau coule dans le bon sens** : du ruisseau du sud-ouest au grand étang,
  puis par le bief jusqu'au moulin et vers la rivière de l'est. Rides, écume,
  chutes et roue à aubes suivent ce sens ; les niveaux d'eau et les lits ont
  été recalés, sans toucher à la maison, au carport, aux passerelles ni à la
  vanne. Le long du carport, le bief est encaissé entre deux murets de granit
  en pierres sèches.
- **Véranda de plain-pied** : le jardin devant la véranda est au niveau de son
  plancher ; le bief passe dessous dans une buse, avec une tête en pierres
  sèches à chaque bout.
- **Allée sans murets** : l'allée principale n'est bordée que de talus ; les
  murets de l'entrée du moulin restent.
- **Pierres sèches et rocaille** : murets, piliers du portail, mur de
  soutènement et murs du bief montés pierre à pierre (chaperons moussus,
  valériane et fougères dans les joints) ; marches de granit dans l'escalier de
  la rocaille ; talus de rocaille avec une niche voûtée en pierres sèches (à la
  place de l'ancienne fontaine), blocs de granit, hostas, hortensia,
  rhododendron et camélia fleuri.
- **Petits objets partout** : pots et jardinières, lanternes allumées le soir,
  tas de bois et billot, outils, récupérateur d'eau, dévidoir, vélo, bancs,
  brouette, arrosoirs, pas japonais, mangeoire, nichoir, boîte aux lettres,
  feuilles mortes.
- **Collines dégagées** : 164 arbres retirés des pentes ouvertes et des champs
  d'après la couverture du sol réelle (ESA WorldCover) ; la forêt ne monte plus
  jusqu'aux champs du haut, quelques bosquets et haies restent.
- **Bruine et ciel couvert** : la bruine se voit dans la scène (fines stries et
  brume) et dans la boule à neige ; par temps couvert, toute la boule se
  remplit de nuages.
- **Lampe torche** : tenue dans la main droite, bras tendu, le faisceau part de
  la lentille.
- **Téléphone** : plus de touche « E » ; les bulles « Monter » (quad) et
  « Lire » (panneaux) se touchent du doigt.
- **Atelier › Relief › Berges** : pinceaux « Gommer » et « Ajouter » pour
  retirer ou poser des berges (terre, roseaux, carex, iris, pierres) ; les
  gestes sont gardés dans le navigateur, avec « Annuler » et « Tout rétablir ».
- **Fichier de retouches complet** : « Exporter mes retouches » emporte aussi
  les berges et le recalage IGN ; l'import les rétablit (le recalage s'applique
  au chargement suivant). Les fichiers exportés avant restent lisibles.
- **Atelier › Relief › Relief réel (IGN RGE ALTI)** : mesure depuis le
  navigateur l'altitude IGN d'environ 400 points (le zéro est la surface du
  grand étang), affiche les écarts point par point et peut recaler le relief en
  douceur au chargement suivant, loin de la maison et de l'eau, avec un écart
  borné à ± 6 m.

## Le jeu « Pas touche à mes trésors »

Onglet **Jeu** de la barre des modes, ou adresse `/jeu/`. Des voleurs
farfelus viennent prendre les six trésors cachés dans le moulin et ses
dépendances : tours, pièges et sorts les arrêtent avant qu'ils ne repartent
avec leur sac. Un voleur mis KO lâche son butin, que l'on peut reprendre ; le
sort Rappel le ramène, et un sac tombé à l'eau flotte.

- **Cinq niveaux** : Bienvenue chez moi (10 vagues), Le domaine coupé en deux
  (12), Les trois mauvaises portes (15), Les pirates du pédalo (15), Le grand
  cambriolage (20). Chaque niveau gagné peut continuer sans fin.
- **Cartes pensées pour le jeu** : elles s'éloignent de la vraie géographie du
  domaine. Des chemins sinueux partent d'une à trois portes au bord de la carte
  (chacune a sa couleur et son panneau) et mènent au moulin, à sa roue et à ses
  dépendances, où brillent les réserves de trésors.
- **Cases de construction** : de part et d'autre des chemins, 74 à 87 cases
  libres par niveau, en trois terrains : la rocaille (dalles de pierre) pour
  les tours de feu, le givre (cercles de runes) pour la glace, la berge et le
  marais pour l'eau. Les tours se posent côte à côte. En construction, la
  grille apparaît, les cases de la bonne famille s'allument et la case visée
  montre la portée et le prix.
- **Forêts à couper** : 18 à 32 cases boisées par niveau (pinède, sapins
  givrés, bosquet de la berge). « Couper la forêt » coûte 30 or, 5 de plus à
  chaque nouvelle coupe (60 au plus), et dure 4 secondes de jeu, aussi entre
  les vagues : les arbres tremblent et tombent, il reste des souches, et la
  case accueille ensuite une tour de sa famille.
- **Vagues annoncées** : le panneau « Prochaine vague » dit d'où viennent les
  voleurs et ce qu'ils visent (porte → réserve), combien et lesquels
  (portraits, élites, chef, nageurs, fumigènes…), puis résume les trois vagues
  suivantes. Sur la carte, un repère se dresse à chaque porte utilisée et le
  trajet défile en chevrons de sa couleur ; une porte hors de l'écran est
  signalée par une flèche au bord, qu'on touche pour y aller. Pendant la
  vague, un bandeau rappelle la suivante. Le mode sans fin est annoncé de la
  même façon.
- **Trois familles de tours**, chacune avec deux branches d'évolution :
  - Feu : Brasier grognon → Souffle infernal → Dragon de la fournaise, ou
    Crache-lave → Volcan furieux ;
  - Glace : Obélisque givré → Crypte du gel → Trône du zéro absolu, ou
    Souffleur de blizzard → Tempête polaire ;
  - Eau : Cygne grincheux (un cygne en colère qui crache de l'eau) →
    Bélier hydraulique → Canon tsunami, ou
    Fontaine siphon → Maelström glouton.

  Les tours gagnent de l'expérience ; faire évoluer une tour demande l'Atelier.
- **Pièges** : filet entre les arbres, ressort farceur, faux coffre, posés sur
  les emplacements marqués des chemins.
- **Sorts** (mana) : Météore et Rappel dès le niveau 1, Gel instantané au
  niveau 2, Vague de crue au 3, Frénésie au 4.
- **Onglet Moulin** : Meule, Roue magique et Atelier ; talents entre les
  niveaux.
- **Voleurs** : voleur du dimanche, sprinteur en claquettes, déménageur en
  matelas, voleur au fumigène, nageur en flamant rose, chef en tondeuse blindée,
  et leurs versions d'élite (voleur à casserole, patineur, forteresse canapé,
  ninja au rideau de douche, pirate en pédalo, limousine-tondeuse). Ce sont des
  personnages de dessin animé (grosse tête, couleurs vives, contour sombre),
  lisibles vus d'en haut, qui brandissent le sac doré quand ils ont volé.
- **Étoiles** : trois sans aucun vol, deux sans perte définitive.

Commandes :

| | Ordinateur | Téléphone et tablette |
| --- | --- | --- |
| Déplacer la vue | glisser, ou ZQSD / WASD / flèches | glisser un doigt |
| Zoomer | molette, `+` et `-` | pincer |
| Tourner | clic droit ou Maj + glisser | tourner deux doigts |
| Construire | choisir une tour ou un piège en bas, puis cliquer une case allumée | toucher une case pour voir la portée, toucher encore pour construire |
| Couper une forêt | cliquer une case boisée, puis « Couper la forêt » | pareil, en touchant |
| Pause, vitesse ×2 | Espace ou P, F | boutons en haut à droite |
| Lancer la vague | Entrée | « Lancer la vague » |
| Sorts | touches 1 à 5 | onglet Sorts |

La progression (étoiles, talents, records) reste dans le navigateur ; une
partie se reprend entre deux vagues, coupes de forêt comprises. Une partie
enregistrée avec les anciennes cartes est oubliée (la progression reste).

## Nouveautés de la version 32

- **Rendu net sur téléphone** : anticrénelage, définition adaptée à l'écran et
  ajustée en continu selon la fluidité. Pour des essais, `?definition=1.5` dans
  l'adresse impose une définition.
- **Nouvelle interface** : carte « Saint-Christophe » en haut à gauche, onglets
  réunis au centre, réglages et outils d'aménagement en verre fumé, nouvel écran
  de chargement, menu compact sur téléphone.
- **Heure réelle** : le soleil et la lune sont à leur vraie place dans le ciel
  (lever, coucher, aube, heure dorée, nuit étoilée, phase de la lune).
- **Météo réelle** ([Open-Meteo](https://open-meteo.com), sans clé ni compte) :
  ciel dégagé, voilé, nuageux, couvert, brouillard, bruine, pluie, averses,
  orage avec éclairs, grêle et neige. Le vent réel fait plier les arbres, avec
  ses rafales et sa direction.
- **Onglet Météo** : la boule à neige du moulin tourne avec l'heure et le temps
  qu'il fait ; conditions du moment, heure par heure, sept jours, et une frise
  pour faire défiler les 72 prochaines heures dans la boule.
- **Eau vive** : courant visible dans le bief et les rivières (rides entraînées,
  stries, écume qui dérive, remous aux chutes et aux vannes), chute derrière le
  moulin qui coule en filets blancs, roue à aubes qui trempe dans l'eau (les
  aubes ruissellent et perdent des gouttes), feuilles et ronds de poissons.
- **Rivières au naturel** : le bief n'est maçonné que devant le moulin et sur
  30 m au-delà de la véranda ; ailleurs, l'eau coule plus bas que la prairie,
  dans un lit plus profond bordé de légers fossés, de roseaux, carex, iris,
  reine-des-prés, salicaires, fougères et pierres.
- **Arbres détaillés** : les arbres ne sont plus des volumes à facettes.
  Chênes au tronc évasé et aux charpentières noueuses, vieux chênes étalés, pins
  sylvestres au fût orangé et jeunes pins en étages, bouleaux blancs aux rameaux
  retombants : écorces en relief, couronnes faites de milliers de bouquets de
  feuilles (chêne lobé, bouleau, aiguilles) éclairées comme un volume, avec la
  lumière qui les traverse à contre-jour et des ombres qui laissent passer le
  soleil entre les feuilles. Près de la caméra l'arbre est complet, au loin une
  version allégée prend le relais en fondu ; le vent balance l'arbre, fait
  osciller les branches et frémir les feuilles.
- **Nature plus réaliste** : vent à l'échelle réelle (les arbres oscillent
  sans à-coups ni ralentissement, même en tempête), pelouse aux teintes
  naturelles, murs en moellons avec leurs joints, ardoises gris-bleu.
- **Lumières du moulin** : allumées au crépuscule, éteintes à 23 h 30.
- **Quad** redessiné (carénages, garde-boue, porte-bagages, pneus à crampons) :
  il laisse des traces dans l'herbe, de la boue sous la pluie et des ornières
  dans la neige ; l'herbe se redresse en quelques minutes.
- **Oiseaux modelés** : hérons, cormorans, cygnes, oies, et une famille de
  colverts sur l'eau.
- **Atelier simplifié** : quatre onglets (Relief, Chemins, Plantes & objets,
  Arbres) et un nouvel outil « Chemin taillé dans la pente » : on pose les
  points du chemin entre les arbres, il reste de niveau en travers et entaille
  la pente du côté haut sans creuser le côté bas, comme une route de montagne.
- **Boutons façon jeu** : boutons épais crème et vert mousse, avec icônes.

## Le lieu du moulin

Le jeu est réglé sur le **Moulin de Saint-Christophe, 56250 Elven** : la météo,
le lever et le coucher du soleil et les lumières de la maison suivent ce lieu.
Un autre lieu peut être choisi depuis l'onglet **Météo** (en touchant le nom du
lieu) ; le moulin reste proposé en tête de la liste pour y revenir.

Dans **Réglages** :

- **Météo** : « Météo réelle » par défaut, ou un temps fixe (Soleil, Pluie,
  Tempête, Neige…) ;
- **Ambiance** : « Heure réelle » par défaut, ou le jour, la nuit étoilée ou la
  nuit noire en permanence.

Sans connexion à Internet, le jeu garde les dernières prévisions reçues, puis
affiche un ciel dégagé.

## Mettre le jeu sur Cloudflare Pages

Dans **Workers & Pages > Create application > Pages**, importe le dépôt GitHub
**charlesmdp/moulinn**, puis utilise ces réglages :

| Réglage | Valeur |
| --- | --- |
| Branche de production | `main` |
| Framework | Aucun / `None` |
| Commande de build | `exit 0` |
| Dossier de sortie | `dist` |
| Dossier racine | Laisser vide |

Le dossier `dist` est déjà construit et versionné : Cloudflare n'a rien à
compiler, aucun secret n'est nécessaire. Clique sur **Save and Deploy**, puis
ouvre l'adresse HTTPS fournie sur ordinateur, iPhone ou iPad. Les commits
suivants sur `main` seront déployés automatiquement.

Pour une mise en ligne sans GitHub (Direct Upload), compresse le contenu du
dossier `dist` en ZIP et dépose-le dans le projet Pages : voir
`dist/LIRE-MOI.txt`.

Documentation officielle :

- [Héberger un site statique](https://developers.cloudflare.com/pages/framework-guides/deploy-anything/)
- [Intégration Git](https://developers.cloudflare.com/pages/get-started/git-integration/)
- [Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/)

## Lancer le jeu sur un ordinateur

Avec Node.js 20 ou plus récent :

```sh
npm ci
npm run dev
```

`npm run dev` reconstruit `dist/` puis le sert sur `http://localhost:8080`.
Les adresses réseau affichées permettent d'essayer depuis un téléphone
connecté au même Wi-Fi (le bouton « Utiliser ma position actuelle » ne
fonctionne qu'en HTTPS, donc sur Cloudflare : en local, cherche la commune). `npm run serve` sert `dist/` sans le
reconstruire ; `PORT=9000 npm run serve` change de port.

Sans Node.js, un serveur statique suffit :

```sh
python3 -m http.server 8080 --directory dist
```

Le double-clic sur `dist/index.html` ne convient pas : les ressources ont
besoin d'un serveur HTTP ou HTTPS.

## Modifier et reconstruire

| Emplacement | Contenu |
| --- | --- |
| `src/index.html` | Page et interface (menus, réglages, éditeur) |
| `src/start.js` | Chargement progressif, vérification WebGL, erreurs |
| `src/app/moulin.js` | Jeu complet (scène, jardin, eau, véhicules, animaux…) |
| `src/app/v32/` | Modules de la version 32, chargés avant le jeu (voir ci-dessous) |
| `src/styles/base.css` | Styles de la version 31 |
| `src/styles/v32.css` | Habillage de la version 32 (ordinateur et téléphone) |
| `src/jeu/` | Jeu « Pas touche à mes trésors » (page `/jeu/`, voir plus bas) |
| `src/static/` | Ressources recopiées telles quelles (modèles, textures, sons, `_headers`) |
| `scripts/build.mjs` | Construction de `dist/` avec esbuild |
| `scripts/serve.mjs` | Petit serveur local |
| `tests/` | Vérifications de la simulation du jeu (`npm test`) |

Modules de la version 32 (`src/app/v32/`, chargés dans l'ordre des noms) :

| Fichier | Rôle |
| --- | --- |
| `00-core.js` | Socle commun, étalonnage des couleurs, stockage local |
| `05-render.js` | Définition adaptative et anticrénelage |
| `10-atmosphere.js` | Heure réelle, soleil, lune, lieu du moulin |
| `15-arbres.js` | Arbres détaillés : atlas de feuillages, écorces, essences, niveaux de détail, vent (remplace l'ancienne forêt de `moulin.js`) |
| `16-clairieres.js` | Clairières : arbres retirés des pentes ouvertes et des champs d'après la couverture du sol réelle (ESA WorldCover) |
| `20-foliage.js` | Horloge et vent partagés par les shaders de végétation |
| `25-lawn.js` | Teinte naturelle de la pelouse |
| `30-water.js` | Feuilles à la dérive et ronds de poissons |
| `32-veranda.js` | Soubassement en moellons de la véranda |
| `35-rivers.js` | Lits naturels des rivières, berges et plantes de berge |
| `36-hydrologie.js` | Sens réel de l'eau (sud-ouest → grand étang → moulin → est), niveaux et relief qui suivent, bief maçonné le long du carport |
| `38-waterflow.js` | Roue à aubes, chutes, embruns et remous |
| `40-weather-live.js` | Météo réelle Open-Meteo et éclairs |
| `45-weather-icons.js` | Pictogrammes météo |
| `50-meteo.js` | Onglet Météo et boule à neige |
| `60-ui.js` | Habillage de l'interface |
| `65-atelier.js` | Atelier en onglets et chemins taillés dans la pente |
| `66-berges.js` | Atelier : gommer ou ajouter des berges (terre, roseaux, carex, iris, pierres), gestes gardés et rejoués |
| `67-relief-ign.js` | Atelier : mesure du relief IGN RGE ALTI depuis le navigateur, comparaison et recalage doux (hors maison et bords de l'eau) |
| `70-birds.js` | Oiseaux et colverts |
| `72-materials.js` | Moellons, ardoises, arbustes et massifs lissés |
| `73-stones.js` | Outils des pierres sèches (pierres, roche moussue, lots instanciés) |
| `74-walls.js` | Murets de pierres sèches, marches de granit, maçonnerie des bâtiments |
| `75-rockery.js` | Rocaille du talus : niche voûtée, blocs de granit, hostas, camélia fleuri |
| `76-details.js` | Petits objets du jardin (pots, lanternes, bûches, outils, vélo…) |

Jeu « Pas touche à mes trésors » (`src/jeu/`, réuni en un seul script dans cet
ordre) :

| Emplacement | Rôle |
| --- | --- |
| `core/` | Socle commun (espace de noms, unités, couleurs, matières) |
| `sim/` | Simulation sans rendu : équilibrage (`00-config.js`), niveaux, trajets, vagues, talents, partie, progression |
| `models/` | Modèles 3D procéduraux : tours, pièges, socles, coffres, bâtiments, améliorations du moulin |
| `fx/` | Effets feu, glace et eau, zones, objets d'effets |
| `actors/` | Voleurs de dessin animé sur un squelette procédural léger (six types et leurs élites) et leurs états visibles |
| `render/` | Terrain, eau et décor des niveaux, cases de construction et forêts à couper, entités, caméra |
| `ui/` | Interface, pictogrammes, portraits des voleurs, écrans (menu, talents, résultats) |
| `main.js` | Application : rendu, boucle de jeu, niveaux, sauvegardes |
| `index.html`, `boot.js`, `jeu.css` | Page, chargement et styles |
| `vendor/` | Chargeurs three.js (GLTFLoader, SkeletonUtils, BufferGeometryUtils) |
| `dev/` | Pages d'essai des modèles, personnages et effets (non publiées) |

`npm test` rejoue la simulation : règles des tours, pièges, sorts, trésors,
sauvegardes, talents, et un joueur automatique qui doit gagner chaque niveau.

Après une modification :

```sh
npm run build
```

Le build vérifie la syntaxe de chaque fichier, minifie le code et les styles,
nomme les ressources d'après leur contenu (pour le cache), prépare le tout
dans `.build/` puis remplace `dist/` d'un seul coup. Le rapport détaillé est
dans `.build/build-report.json`.

Modifier seulement `src/` ne met pas à jour le jeu publié : enregistre les
sources et le dossier `dist/` reconstruit dans le même commit.

```sh
git add src scripts tests dist package.json package-lock.json README.md
git commit -m "Mettre à jour le jardin"
git push origin main
```

## Retouches personnelles et compatibilité

Les retouches faites dans l'éditeur, le lieu du moulin et les réglages restent
dans le navigateur utilisé, pour l'adresse du site concernée. GitHub et
Cloudflare ne les synchronisent pas entre appareils : utilise l'export et
l'import des retouches dans l'atelier (adresse `/build/`) pour les transférer
(berges et recalage IGN compris).

Le jeu nécessite JavaScript et WebGL. Les essais automatisés (ordinateur et
téléphone simulés, météo simulée) ne remplacent pas une vérification sur un
iPhone ou un iPad réel.

Les mentions de licence des bibliothèques sont conservées dans le code et dans
`dist/LICENCES.txt`. Les prévisions météo proviennent d'Open-Meteo
(données sous licence CC BY 4.0).
