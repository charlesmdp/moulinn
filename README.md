# Moulin de Saint-Christophe

Le jardin interactif 3D du moulin, **version 32** : le moulin, la dépendance,
les jardins, l'eau, les véhicules, les animaux, l'aménagement et les commandes
tactiles, avec la météo et l'heure réelles.

Le dossier `dist/` est le site prêt à publier (Cloudflare Pages ou tout
hébergement statique en HTTPS). Les sources modifiables sont dans `src/`.

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
- **Arbres détaillés** : les 1 260 arbres ne sont plus des volumes à facettes.
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
  naturelles, murs en moellons avec leurs joints, ardoises gris-bleu. La
  véranda repose sur son soubassement.
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
| `src/static/` | Ressources recopiées telles quelles (modèles, textures, sons, `_headers`) |
| `scripts/build.mjs` | Construction de `dist/` avec esbuild |
| `scripts/serve.mjs` | Petit serveur local |

Modules de la version 32 (`src/app/v32/`, chargés dans l'ordre des noms) :

| Fichier | Rôle |
| --- | --- |
| `00-core.js` | Socle commun, étalonnage des couleurs, stockage local |
| `05-render.js` | Définition adaptative et anticrénelage |
| `10-atmosphere.js` | Heure réelle, soleil, lune, lieu du moulin |
| `15-arbres.js` | Arbres détaillés : atlas de feuillages, écorces, essences, niveaux de détail, vent (remplace l'ancienne forêt de `moulin.js`) |
| `20-foliage.js` | Horloge et vent partagés par les shaders de végétation |
| `25-lawn.js` | Teinte naturelle de la pelouse |
| `30-water.js` | Feuilles à la dérive et ronds de poissons |
| `32-veranda.js` | Soubassement en moellons de la véranda |
| `35-rivers.js` | Lits naturels des rivières, berges et plantes de berge |
| `38-waterflow.js` | Roue à aubes, chutes, embruns et remous |
| `40-weather-live.js` | Météo réelle Open-Meteo et éclairs |
| `45-weather-icons.js` | Pictogrammes météo |
| `50-meteo.js` | Onglet Météo et boule à neige |
| `60-ui.js` | Habillage de l'interface |
| `65-atelier.js` | Atelier en onglets et chemins taillés dans la pente |
| `70-birds.js` | Oiseaux et colverts |
| `72-materials.js` | Moellons, ardoises, arbustes et massifs lissés |

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
git add src scripts dist package.json package-lock.json README.md
git commit -m "Mettre à jour le jardin"
git push origin main
```

## Retouches personnelles et compatibilité

Les retouches faites dans l'éditeur, le lieu du moulin et les réglages restent
dans le navigateur utilisé, pour l'adresse du site concernée. GitHub et
Cloudflare ne les synchronisent pas entre appareils : utilise l'export et
l'import des retouches dans l'éditeur pour les transférer.

Le jeu nécessite JavaScript et WebGL. Les essais automatisés (ordinateur et
téléphone simulés, météo simulée) ne remplacent pas une vérification sur un
iPhone ou un iPad réel.

Les mentions de licence des bibliothèques sont conservées dans le code et dans
`dist/LICENCES.txt`. Les prévisions météo proviennent d'Open-Meteo
(données sous licence CC BY 4.0).
