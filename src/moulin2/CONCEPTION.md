# La Fête du Moulin (`/moulin2`) — conception

Huit jeux de fête foraine multijoueurs posés sur la maquette 3D du moulin. La page `/moulin2/`
charge le moulin tel quel (mêmes fichiers que `/moulin/`), plus un second script, « la fête »,
qui ajoute les jeux, le multijoueur, l'interface et les emplacements de sponsors. **Rien n'est
changé à la maison ni au terrain** : les jeux sont des objets posés par-dessus (pistes, stands,
bâches), comme une kermesse dans le jardin.

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `00-pre.js` | Avant le moulin : réglages locaux à part de `/moulin`, plein jour, couleurs plus vives |
| `05-kit.js` | Boîte à outils : maths, lignes (`MF.path`), couleurs, formes, panneaux, sons |
| `10-net.js` | Réseau sans serveur : salons, connexion directe entre navigateurs, repli entre onglets |
| `15-presence.js` | Qui est là, où, ce qu'il fait ; personnages des autres joueurs ; `MF.interp` |
| `20-input.js` | Commandes : clavier, souris, tactile, manette ; télécommande à l'écran |
| `30-hud.js` | Interface : barre du haut, menu des jeux, salle d'attente, compteurs, résultats |
| `35-sponsors.js` | Emplacements de sponsors (bâches, panneaux) lus dans `sponsors.json` |
| `40-session.js` | Parties : hôte, salle d'attente, décompte, résultats, objets disputés |
| `42-play.js` | Aides de jeu : caméra, objets des autres joueurs, piste au sol, obstacles |
| `45-site.js` | Décor commun : arche d'entrée, panneaux des stands |
| `50-core.js` | Cœur : `MF.registerGame`, `MF.boot`, entrée et sortie d'un jeu, boucle |
| `games/*.js` | Un fichier par jeu (`rc.js` sert de modèle) |
| `99-host-moulin.js` | Branchement sur le vrai moulin (module V32) |
| `labo/` | Terrain d'essai léger : même socle, mêmes jeux, décor simplifié |
| `arcade.css` | Styles de l'interface |
| `p2p-entry.mjs` | Point d'entrée de la bibliothèque Trystero (connexion directe) |

Construction : `node scripts/build.mjs` assemble `NN-*.js` (< 60), puis `games/*.js`, puis
`99-host-moulin.js` dans `assets/arcade.[empreinte].js`, chargé avant le jeu du moulin sur la page
`/moulin2/` seulement (`src/start.js`).

## Multijoueur, sans serveur

- **Salons.** Sans rien préciser, on entre dans le salon public (`public-1`, puis `public-2` quand
  le premier est plein, 12 personnes). `/moulin2/?salon=mon-code` ouvre un salon privé.
- **Deux chemins** utilisés ensemble : les onglets d'un même navigateur se parlent directement
  (BroadcastChannel) ; les navigateurs de joueurs différents se trouvent par des relais publics
  (réseau Nostr, bibliothèque Trystero) puis se parlent de pair à pair (WebRTC).
- **Chacun simule ce qui est à lui** (sa voiture, sa balle, sa canne) et l'envoie aux autres une
  douzaine de fois par seconde ; les autres le redessinent en douceur, avec 0,12 s de retard.
- **Un hôte par jeu** (le premier inscrit) fait avancer la partie : salle d'attente → décompte →
  partie → résultats. S'il s'en va, le suivant reprend.
- **Objets disputés** (cibles, canards) : `session.claim(clé)` ; le plus rapide l'emporte et tous
  les joueurs arrivent à la même conclusion, quel que soit l'ordre d'arrivée des messages.
- Limites : pas d'arbitre (un tricheur peut mentir sur son score) ; sans serveur TURN, deux joueurs
  derrière des réseaux très fermés peuvent ne pas réussir à se connecter directement.

## Repères du terrain

x vers l'est, z vers le sud, y vers le haut, en mètres ; le moulin est en (0, 0). Un **cap** de 0
regarde vers +z ; l'avant d'un objet de cap `h` est `(sin h, cos h)`, sa droite `(−cos h, sin h)`.
`objet.rotation.y = h` tourne un objet construit « avant vers +z ».

| Jeu | id | Stand (x, z) | Zone |
| --- | --- | --- | --- |
| Course de voitures RC | `rc` | 4,5 · −58 | allée, prairie nord-est, cour |
| Course de bateaux | `bateaux` | −10 · 14,6 | Grand étang, devant la terrasse (îlot autour de −14 · 38,5) |
| Mini-golf | `golf` | 98 · −4,5 | prairie est, x 99,5…118,5, z −10,5…1,5 |
| Stand de tir | `tir` | 51 · −7,5 | prairie est, stand x 46…56, z −4,5…1,5 |
| Pêche aux canards | `canards` | 66 · −7,5 | prairie est, bassin autour de (66, −3) |
| Auto-tamponneuses | `autos` | 78 · −5,5 | prairie est, piste x 80…95, z −10…−1 |
| Lancer de citrouilles | `citrouilles` | 58 · −14 | rive sud de l'étang intermédiaire, cibles au nord |
| Course de drones | `drones` | 12 · −36 | départ à l'est de l'allée, portes autour du moulin |

La prairie est (x 42…120, z −10,5…1,5) est plate, entre 0,9 et 1,4 m d'altitude ; elle monte
doucement vers le sud. Au nord, l'étang intermédiaire (niveau −0,42 m) va de z ≈ −25 à z ≈ −39
pour x entre 44 et 64 ; sa rive nord (z −44…−50) est à 0,5…1,5 m. Le Grand étang (niveau 0) commence
à z ≈ 18 devant la terrasse du moulin ; l'eau est libre pour x −12…16, z 20…60, et jusqu'à x −36
au-delà de z 32.

## Écrire un jeu

Un jeu est un fichier `games/<id>.js` qui appelle `MF.registerGame({ … })` :

```js
MF.registerGame({
  id: "rc", title: "Course de voitures RC", icon: "🏎️", color: MF.PAL.red,
  blurb: "1 à 8 pilotes · 3 ou 5 tours",          // sous-titre (menu, panneau du stand)
  station: { x: 4.5, z: -58, heading: -Math.PI / 2 }, // où se tient le joueur ; il regarde vers le jeu
  minPlayers: 1, maxPlayers: 8, maxTime: 300,        // durée maximale d'une partie (s)
  options: [{ key: "laps", label: "Nombre de tours", values: [3, 5], default: 3, format: (v) => v + " tours" }],
  help: "Flèches ou ZQSD : piloter…",
  rank: (entrées, options) => entrées triées,        // la meilleure d'abord ; entrée = résultat + { uid, name, color }
  describe: (résultat, options) => "1:02.34",        // texte du résultat dans le classement
  create(ctx) { … return { update, enter, leave, onPhase, idle }; },
});
```

Facultatifs : `kiosk: { x, z, heading }` (place du panneau du stand, sinon sur le côté du joueur) et
`range` (distance, en mètres, au-delà de laquelle le jeu n'est plus dessiné ; 85 par défaut).

`create(ctx)` est appelé **une fois**, au chargement : le jeu y construit son décor (ajouté à
`ctx.group`) et renvoie :

- `update(dt, t)` — à chaque image **dès qu'au moins un joueur est à ce jeu**, que le joueur local y
  soit ou non : c'est là qu'on dessine les objets des autres (un promeneur voit la course). Renvoie
  `true` s'il faut redessiner. Si `ctx.active()` est vrai, le jeu place aussi la caméra.
- `enter()` — le joueur local s'inscrit : choisir les commandes (`input.use`), les compteurs.
- `leave()` — il s'en va : retirer ce qui est à lui. (Les commandes et l'interface sont remises à
  zéro par le cœur.)
- `onPhase(état, avant)` — changement d'état de la partie (voir plus bas).
- `idle()` — plus personne à ce jeu : retirer les objets des autres (`remotes.clear()`).

### `ctx`

`{ MF, THREE, world, def, group, camera, session, net, presence, input, hud, sponsors, sfx, self,
active(), playing() }`

- `world` : `scene`, `camera`, `heightAt(x, z)` (sol, fond des étangs compris), `waterAt(x, z)`
  → `{ name, level, poly }` ou `null`, `ponds`, `islands` (contours `[[x, z], …]` des îlots, posés
  sur l'eau : `MF.pointInPoly`), `trees` (`{ x, z, height }`), `solids` (rectangles
  tournés : bâtiments, murets — `MF.rectDistance`), `mobile`, `invalidate()`.
- `self` : `{ uid, name, color }` du joueur local.
- `active()` : le joueur local est dans ce jeu. `playing()` : … et en pleine partie, pas encore fini.

### Partie : `ctx.session`

- `session.state` → `{ phase, run, opts, seed, roster, results, ranking }` ou `null`.
  `phase` : `"lobby"` (salle d'attente), `"countdown"` (3, 2, 1 — 3,6 s), `"run"`, `"results"`.
  `roster` : joueurs de la partie en cours (figé au départ), `opts` : réglages, `seed` : graine
  commune à tous (`MF.rng(seed)` donne les mêmes tirages chez chacun).
- `session.time()` → secondes depuis le départ (négatif pendant le décompte). Toute animation qui
  doit être la même pour tous (cibles mobiles, pales d'un obstacle) est une fonction de ce temps.
- `session.inRoster(uid?)`, `session.slot(uid?)` (rang du joueur : place sur la grille),
  `session.players()` (inscrits en ce moment), `session.isHost()`.
- `session.report(résultat)` — mon résultat final (`{ time }`, `{ score }`…). L'hôte clôt la
  partie quand tous les joueurs présents ont fini, ou à `maxTime`. `session.myResult` ensuite.
- `session.send(type, données)`, `session.sendTo(uid, type, données)`, `session.on(type, fn(données, pair))`
  — messages ponctuels du jeu (un tir, un coup de club). `pair` : `{ uid, name, color }`.
- `session.sendState(tableau)`, `session.onState(fn(tableau, pair))` — positions, en continu ;
  préférer `MF.remotes`, qui s'en charge.
- `session.claim(clé)` → vrai si l'objet est à moi ; `session.owner(clé)`, `session.claimed(uid)`,
  `session.onClaim(fn(clé, uid))`, `session.claims` (Map clé → `{ u, t }`). Remis à zéro à chaque manche.
- Le décompte « 3, 2, 1, Partez ! », la carte de salle d'attente et celle des résultats sont
  affichés par le cœur : le jeu n'a pas à s'en occuper.

### Objets des autres joueurs : `MF.remotes`

```js
const autres = MF.remotes({
  session, size: 6, angles: [3],          // 6 nombres par état, le 4e est un angle
  make(pair) { … return objet; },         // créer la voiture de ce joueur (l'ajouter à ctx.group)
  apply(objet, valeurs, extra, pair) { … } // la placer (valeurs lissées ; extra : champ libre)
});
autres.send([x, y, z, cap, vitesse, braquage], extra); // à chaque image (limité à 12 envois par seconde)
autres.update();                                        // à chaque image → vrai si quelque chose bouge
```

### Commandes : `ctx.input`

`input.use({ layout, buttons, radio })` dans `enter()`. Dispositions : `"pilot"` (un manche),
`"radio"` (télécommande : gaz à gauche, direction à droite, marque du sponsor au milieu),
`"dual"` (deux manches : drones), `"pointer"` (viser, glisser, toucher). `buttons` : jusqu'à trois
(`a` : Espace, `b` : Maj ou E, `c` : C ou X). Puis lire `input.state` à chaque image :
`x, y, x2, y2` (−1…1 ; flèches ou ZQSD pour x, y ; IJKL pour x2, y2), `a, b, c` (maintenus),
`hit.a…` (vient d'être appuyé), `pointer` : `{ x, y, nx, ny, isDown, down, up, dx, dy, moved }`.
`input.touch` : écran tactile. Tout jeu doit être jouable au clavier/souris **et** au doigt.

### Interface : `ctx.hud`

`hud.stats([{ key, label }])` puis `hud.set(key, texte)` (compteurs en haut) ; `hud.flash(texte,
{ color, hold })` (gros message bref) ; `hud.hint(texte)` (aide en bas) ; `hud.board([{ name, color,
text, self }])` (classement en direct) ; `hud.toast(texte)` ; `hud.widget(classe, html)` → élément
libre (viseur, jauge), retiré quand on quitte le jeu.

### Caméra, sol, décor

- `MF.cam.set(camera, de, vers, fov)`, `MF.cam.chase(camera, mémoire, cible, cap, options, dt, sol)`,
  `MF.cam.orbit(…)`, `MF.cam.fov(camera, degrés)`. Le jeu place la caméra à chaque image tant que
  `ctx.active()` ; à la sortie, le cœur rend la caméra au personnage.
- `MF.seat(objet, world, x, z, cap, garde, y?)` pose un objet sur le sol, incliné selon la pente ;
  `MF.ground(world, x, z)` → hauteur et normale ; `MF.ribbon(world, ligne, options)` → piste au sol ;
  `MF.obstacles(world, zone)` → arbres et murs du domaine, `.add(x, z, r)`, `.hit(x, z, r)`.
- Formes : `MF.box, cyl, cone, sphere, plane, torus, group, mesh` avec `{ x, y, z, rx, ry, rz, s,
  parent, cast }` ; matériaux `MF.mat(couleur, options)` (les couleurs sont converties pour le rendu
  du moulin : toujours passer par `MF.mat` ou `MF.color`) ; textes `MF.sign(texte, options)`,
  `MF.tag(texte)` ; décor `MF.pole, MF.bunting, MF.balloon` ; ombre ronde `MF.blob(rayon)` sous ce
  qui bouge (le moulin n'a pas d'ombres portées dynamiques).
- Sons : `MF.sfx.play("bip" | "top" | "clic" | "pop" | "choc" | "ting" | "tir" | "plouf" | "swing" |
  "toc" | "trou" | "tour" | "bravo" | "perdu" | "boing")`, `MF.sfx.loop("moteur" | "bateau" |
  "helices")` → `{ set(hauteur, volume), stop() }`.

### Sponsors

Chaque jeu pose ses emplacements : `MF.sponsors.banner(id, largeur, hauteur)` (bâche entre deux
piquets, lisible des deux côtés), `MF.sponsors.board(id, largeur, hauteur, options)` (panneau à
plat), `MF.sponsors.texture(id, { w, h })` (texture à coller où l'on veut), `MF.sponsors.brand(id)`
(texte court, pour la télécommande). La liste des emplacements est dans `35-sponsors.js` ; qui
occupe quoi est dans `src/static/moulin2/sponsors.json` (publié en `/moulin2/sponsors.json`) :

```json
{
  "contact": { "texte": "Réserver un emplacement : @moncompte sur X", "lien": "https://x.com/moncompte" },
  "emplacements": {
    "rc-arche": { "nom": "Acme", "accroche": "Des outils pour indés", "lien": "https://acme.dev",
                  "fond": "#101828", "texte": "#ffffff", "logo": "moulin2/logos/acme.png", "prix": "200 €" }
  }
}
```

Un emplacement sans `nom` affiche « YOUR BRAND HERE » ; `prix` seul affiche le tarif dans la liste
des emplacements libres. Les logos vont dans `src/static/moulin2/logos/`.

### Règles pour rester fluide

Le moulin affiche déjà près de 3 millions de triangles : un jeu reste léger (quelques milliers de
triangles, peu de matériaux — `MF.mat` les met en commun), ne crée rien à chaque image, retire ce
qu'il ajoute (`MF.dispose`), et ne dessine que si quelque chose bouge. Une fois son décor construit,
il le fusionne avec `MF.freeze(groupe)` : un seul maillage par matériau au lieu de dizaines (ce qui
bouge porte `userData.live = true` et reste à part). Avec cela, la fête n'ajoute presque rien au
nombre d'appels de dessin de la promenade.

## Terrain d'essai

`node scripts/labo.mjs` puis `http://localhost:8090/` : le même socle et les mêmes jeux dans un
décor simplifié (relief réel, étangs, bâtiments en boîtes, arbres en cônes) qui se charge en une
seconde. `?jeu=rc` entre directement dans un jeu ; `?jeux=rc,golf` ne charge que ces jeux ;
`?nom=Bob` ; deux onglets du même navigateur jouent ensemble. `?pas=0.033` fige le temps : les
essais automatiques l'avancent avec `__labo.frame(dt, dessiner)` ou `__labo.step(n)`.
`RELAIS=8091 node scripts/labo.mjs` démarre en plus un relais local pour essayer la connexion
directe (`?relais=ws://localhost:8091`).

Essais sans navigateur : `node tests/fete.test.mjs` (réseau, présence, parties).
