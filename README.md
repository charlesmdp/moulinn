# Moulin de Saint-Christophe

Le jardin interactif 3D du moulin, **version 32** : le moulin, la dépendance,
les jardins, l'eau, les véhicules, les animaux, l'aménagement et les commandes
tactiles, avec la météo et l'heure réelles. Le tower defense « Pas touche à
mes trésors » se joue à part, à l'adresse `/jeu/` (plus de bouton sur la page
d'accueil).

Le dossier `dist/` est le site prêt à publier (Cloudflare Pages ou tout
hébergement statique en HTTPS). Les sources modifiables sont dans `src/`.

## Les adresses du site

| Adresse | Contenu |
| --- | --- |
| `/` | L'accueil des visiteurs : Personnage, Vue libre et Météo |
| `/3D/` | La même page avec la **Vue 3D** en plus |
| `/build/` | La vue 3D et l'atelier **Aménager** (page non indexée par les moteurs de recherche) |
| `/jeu/` | Le jeu « Pas touche à mes trésors » (seule façon d'y accéder) |

`/3d` ou `/Build` (autres majuscules, avec ou sans « / ») mènent aux mêmes
pages. Rappel : les retouches faites dans l'atelier restent dans le navigateur
qui les a faites ; `/build` évite surtout que les visiteurs tombent sur
l'atelier.

## Nouveautés de cette série

- **« Pas touche à mes trésors » v4** (adresse `/jeu/`), d'après les retours
  sur la v3 :
  - **routes larges** (deux à quatre cases) où les ennemis se baladent :
    certains tiennent le milieu, d'autres longent les bords ou zigzaguent, ils
    s'écartent les uns des autres et contournent les buttes posées au milieu du
    chemin ; on ne les atteint donc pas tous de la même façon ;
  - **plusieurs cachettes** à partir de la mission 7 (deux ou trois par carte :
    le moulin, un vieux puits, un dolmen, une chapelle) ; chaque ennemi va à la
    plus proche qui a encore des gemmes ;
  - **gemmes grandes et de couleurs franches** (rubis, émeraude, saphir,
    améthyste, topaze, diamant) ;
  - **trois façons d'attaquer** : le sanglier tire à la suite, le cygne garde
    deux à cinq charges et les lâche en rafale puis se recharge une à une, le
    berger (puis le dragon) crache un **jet de feu continu** qui chauffe tant
    qu'il tient sa cible ;
  - **seize ennemis**, dont cinq nouveaux : cyclistes en peloton, korrigan
    (touché, il disparaît et réapparaît plus loin), touriste au flash (éblouit
    les tours), tracteur (blindé ; trois agriculteurs sautent de la cabine) et
    montgolfière (vole en ligne droite au-dessus de tout) ;
  - **surprises annoncées** : marée (l'estran devient un chemin à marée
    basse), barrières qui cèdent (une nouvelle entrée s'ouvre), passage secret,
    canards qui remontent les ruisseaux jusqu'à une cachette ;
  - **tours lisibles dès le niveau 1** (chaque bête deux fois plus grande, sur
    un socle à la couleur de sa famille, fanion à étoiles pour le niveau) et
    **ennemis reconnaissables d'en haut** (la vache est d'abord une vache pie
    noir, le cavalier assis bien haut dessus) ;
  - **frise des vagues** façon Cursed Treasure (portraits × nombre, lettre et
    couleur de l'entrée, surprises annoncées), aperçu du trajet de la
    prochaine vague sur la carte, fiche d'un ennemi au toucher, panneau de
    tour selon sa façon d'attaquer (jauge de chauffe du jet de feu, charges du
    cygne), gemmes regroupées par cachette ;
  - **difficulté recalibrée** : quinze cartes redessinées, économie et vagues
    réglées avec un robot joueur ; les dernières vagues des longues missions
    accélèrent pour rester dangereuses même avec des tours au niveau 7.
- **Plus de bouton Jeu sur la page d'accueil** : le jeu ne s'ouvre qu'à
  l'adresse `/jeu/`.
- **Chapeau de paille** : le personnage porte un grand chapeau de paille à la
  One Piece (bord large, ruban rouge), en toutes saisons ; il remplace le
  bonnet d'hiver.

## Retouches précédentes

- **« Pas touche à mes trésors » v3** : le jeu refait façon Cursed Treasure
  (vue du dessus fixe, quinze missions, gemmes volées que les autres ennemis
  viennent ramasser, sanglier, cygne et berger qui devient dragon, onze
  ennemis, sorts, compétences, logo et icônes).
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
- **Atelier › Plantes & objets › Sous-bois** (adresse `/build/`) : on dessine
  une grande zone au sol (coins posés au doigt ou à la souris, ou trait à main
  levée en gardant l'appui) et elle se remplit toute seule de fougères, de
  ronces ou d'un sous-bois mêlé (lierre, feuilles mortes, jeunes pousses,
  pierres moussues, bois mort), en touffes plus denses au cœur. L'eau, les chemins, les murets,
  les ponts, les bâtiments et l'abord du moulin restent dégagés. Densité
  réglable, liste des zones, « Annuler la dernière zone », « Tout effacer » ;
  sur téléphone, le panneau se replie pendant le tracé.

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
  les berges, le recalage IGN et les zones de sous-bois ; l'import les rétablit
  (le recalage s'applique au chargement suivant). Les fichiers exportés avant
  restent lisibles.
- **Atelier › Relief › Relief réel (IGN RGE ALTI)** : mesure depuis le
  navigateur l'altitude IGN d'environ 400 points (le zéro est la surface du
  grand étang), affiche les écarts point par point et peut recaler le relief en
  douceur au chargement suivant, loin de la maison et de l'eau, avec un écart
  borné à ± 6 m.

## Le jeu « Pas touche à mes trésors »

Adresse `/jeu/` uniquement (plus de bouton sur la page d'accueil). Un tower
defense calqué sur **Cursed Treasure: Don't Touch My Gems!**, dans la campagne
du moulin : la carte entière se voit du dessus, sans déplacer la caméra.

- **Les gemmes et les cachettes** : cinq grosses gemmes de couleurs franches
  (six avec la compétence Filon) brillent dans une cachette, un trou sombre
  cerclé de pierres devant le moulin. À partir de la mission 7, elles se
  répartissent entre deux ou trois cachettes (le moulin, un vieux puits, un
  dolmen, une chapelle). Chaque ennemi va prendre une gemme dans la cachette
  la plus proche qui en a encore, puis repart vers la sortie la plus proche ;
  s'il sort, elle est perdue. Tué, il la lâche sur place et les autres ennemis
  sans gemme foncent la chercher par le plus court chemin (en faisant
  demi-tour s'il le faut). Mission perdue quand toutes les gemmes sont
  parties, gagnée s'il en reste au moins une ; « Brillant » si aucune n'a été
  perdue.
- **Des routes larges** (deux à quatre cases) : les ennemis s'y étalent,
  certains au milieu, d'autres le long des bords ou en zigzag, et contournent
  les **buttes** posées au milieu du chemin (socles de granit à bannières, où
  toutes les tours se posent avec +30 % de portée et +10 % de dégâts).
- **Trois tours, trois terrains, trois façons d'attaquer** :
  - le **sanglier** sur l'herbe **tire** des bogues de châtaigne à la suite ;
  - le **cygne** sur l'eau garde deux à cinq **charges** (boules d'eau qui
    tournent au-dessus du nid), les lâche en rafale, puis se recharge une à
    une ; ses boules éclaboussent et ralentissent ;
  - le **berger australien** sur la roche crache un **jet de feu continu** sur
    sa cible tant qu'elle reste à portée : plus il la tient, plus ça chauffe
    (dégâts × 2,2 à × 2,6), et le feu traverse les boucliers.
  Une tour posée sur un **menhir** accélère la régénération du mana ; les
  cases boisées se dégagent avec le sort **Couper**.
- **Niveaux 1 à 7** : chaque tour gagne de l'expérience en combattant, puis on
  achète le niveau suivant. Au niveau 4, elle se spécialise, au niveau 7 elle
  évolue encore :
  - Marcassin → Jeune sanglier → Sanglier des talus, puis Sanglier chasseur
    (coups critiques) → Grand Solitaire (deux cibles à la fois), ou Laie
    baliste (grosse châtaigne en cloche, zone) → Catapulte à châtaignes ;
  - Cygneau → Cygne → Cygne majestueux, puis Cygne des glaces (ralentit, fait
    reculer de peur) → Cygne royal des glaces (gel), ou Cygne noir (rend du
    mana, désarme) → Cygne noir enchanteur ;
  - Chiot berger → Berger australien → Berger de feu, puis il devient dragon :
    Dragon merle rouge (le jet embrase autour de la cible et la fait brûler) →
    Grand dragon rouge (deux têtes, deux jets), ou Dragon merle bleu
    (rayonnement, explosion des vaincus) → Grand dragon bleu (le jet rebondit).
- **Seize ennemis** (même rôle que ceux de Cursed Treasure, et cinq de plus) :
  agriculteur en colère, voleur en quad, cow-boy au lasso (attrape les gemmes
  tombées), cavalier sur vache (bouclier), druide (bulle qui se reforme),
  bigoudène aux crêpes (soigne), chasseur camouflé (fumigène : invisible),
  rugbyman (esquive un tir sur deux), sonneur de biniou (accélère ses
  voisins), pompier (insensible aux effets), cavalier sur canard (coupe par
  l'eau), cyclistes (en peloton, plus rapides groupés), korrigan (touché, il
  disparaît et réapparaît plus loin), touriste au flash (éblouit les tours),
  tracteur (blindé ; trois agriculteurs sautent de la cabine) et montgolfière
  (vole en ligne droite au-dessus de tout). Chacun a sa version champion, et
  chaque mission se termine par un ou plusieurs boss nommés.
- **Surprises**, toujours annoncées dans la frise des vagues : marée (à marée
  basse, l'estran devient un raccourci ; un ennemi surpris par la marée
  montante patauge jusqu'à la terre), barrières qui cèdent (une nouvelle
  entrée s'ouvre à une vague donnée), passage secret, canards qui remontent
  un ruisseau jusqu'à une cachette, montgolfières.
- **Trois sorts** payés en mana : Couper, Frénésie (les tours attaquent deux
  fois plus vite pendant 5 s), Météore.
- **Quinze missions** reprenant la progression de Cursed Treasure (5 à 50
  vagues) : Le chemin du moulin, Le Gué, Les Deux Prés, La Croix, Le Hallier,
  Le Vieux Fort (marée), Les Yeux du serpent (deux cachettes), Le Labyrinthe
  de talus (barrière), Le Carrefour (deux cachettes, ruisseau des canards),
  L'Allée des chênes, L'Hydre du marais (quatre entrées, montgolfières), La
  Percée, Le Manoir du Roi (barrière, deux cachettes), Le Passage secret (un
  fourré s'ouvre droit sur le moulin à la 25e vague) et La Bataille du Moulin
  (trois cachettes, marée, barrière). Les dernières vagues des longues
  missions accélèrent : elles restent dangereuses même avec des tours au
  niveau 7.
- **Compétences** : 3 points par mission gagnée, à répartir dans trois
  branches (Sanglier : or et Couper ; Cygne : mana et Frénésie ; Berger :
  gemmes et Météore), 21 compétences de 1 à 5 rangs, redistribuables.
- **Interface de jeu vidéo** : logo, écran titre, carte des missions (gemmes
  sauvées, couronne « Brillant », nombre de cachettes), compétences,
  encyclopédie des ennemis et des tours (façon d'attaquer expliquée), fiche
  « Nouvel ennemi ! » à la première apparition d'un type, bandeau du boss,
  **frise des vagues** façon Cursed Treasure (les prochaines vagues glissent
  vers le repère : portraits × nombre, lettre et couleur de l'entrée,
  surprises ; toucher la première l'appelle et rapporte de l'or), **aperçu
  du trajet** de la prochaine vague sur la carte, **fiche d'un ennemi** au
  toucher, panneau de tour selon sa façon d'attaquer (jauge de chauffe,
  charges en direct), gemmes regroupées par cachette, annonces des surprises,
  icônes dessinées pour tout. Police des titres : Lilita One (licence SIL
  OFL, jointe dans `/jeu/OFL-LilitaOne.txt`).

Commandes :

| | Ordinateur | Téléphone et tablette |
| --- | --- | --- |
| Construire | cliquer une case de terrain, puis la tour | toucher une case, puis la tour |
| Améliorer, spécialiser, vendre | cliquer la tour | toucher la tour |
| Couper une forêt | cliquer la case boisée (ou sort Couper puis la case) | pareil, en touchant |
| Sorts | Q, W, E (puis la cible pour Couper et Météore) | gros boutons ronds en bas |
| Pause | Espace | bouton pause |
| Vitesse ×1, ×2, ×3 | 1, 2, 3 | bouton de vitesse |
| Appeler la vague suivante | Entrée | « Appeler » |
| Annuler | Échap | toucher ailleurs |

La caméra ne bouge pas : la carte entière est toujours visible (sur téléphone
debout, elle pivote d'un quart de tour pour remplir l'écran). La progression
(missions, gemmes, compétences, ennemis rencontrés) reste dans le navigateur.

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
| `68-sous-bois.js` | Atelier : zones de sous-bois dessinées au sol (fougères, ronces, sous-bois mêlé), remplies en touffes hors eau, chemins, murets et bâtiments ; tableaux d'instances, budget de plantes, zones gardées, rejouées et exportées |
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
| `core/` | Socle commun (espace de noms, couleurs, matières, hasard reproductible) |
| `sim/` | Simulation sans rendu : données (`00-data.js` : tours, ennemis, sorts, compétences), les quinze cartes (`10-maps.js`), champs de distance et d'écoulement (déplacement libre dans les routes larges), vagues, partie (cachettes, gemmes, IA, tours, capacités, surprises), progression |
| `models/` | Modèles 3D procéduraux : tours sanglier, cygne et berger-dragon (niveaux 1 à 7), gemmes, cachettes, moulin, buttes, barrières, menhirs, entrées, forêts à couper, décor et petits éléments de sol |
| `fx/` | Effets : projectiles, jets de feu continus et impacts des tours, sorts, zones, éclats |
| `actors/` | Les seize ennemis (et leurs champions et boss) sur un squelette procédural léger, montures et véhicules (quad, vache, canard, vélo, tracteur, montgolfière) et états visibles |
| `render/` | Carte peinte, relief, eau, décor, caméra fixe vue du dessus, liaison de l'état de la partie à la scène 3D |
| `ui/` | Interface (titre, missions, compétences, encyclopédie, HUD, menus), icônes, logo, portraits des tours et des ennemis |
| `main.js` | Application : relie simulation, carte, interface et progression ; boucle d'animation |
| `index.html`, `boot.js`, `jeu.css`, `fonts/` | Page, chargement, styles et police des titres (Lilita One, SIL OFL) |
| `vendor/` | BufferGeometryUtils de three.js |
| `CONCEPTION.md` | Conception du jeu et contrats entre ses parties |
| `dev/` | Pages d'essai des tours, ennemis, décor, carte et interface (non publiées) |

`npm test` rejoue la simulation : cartes (routes larges, cachettes, chemins),
écoulement et déplacement libre, vagues, terrains, construction et niveaux des
tours, les trois façons d'attaquer, sorts, gemmes (vol, chute, reprise par les
autres ennemis, plusieurs cachettes), surprises (marée, barrière, passage
secret, canards, montgolfières), capacités des seize ennemis, compétences,
progression, et un robot joueur qui doit gagner les quinze missions.

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
(berges, recalage IGN et zones de sous-bois compris).

Le jeu nécessite JavaScript et WebGL. Les essais automatisés (ordinateur et
téléphone simulés, météo simulée) ne remplacent pas une vérification sur un
iPhone ou un iPad réel.

Les mentions de licence des bibliothèques sont conservées dans le code et dans
`dist/LICENCES.txt`. Les prévisions météo proviennent d'Open-Meteo
(données sous licence CC BY 4.0).
