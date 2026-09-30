# « Pas touche à mes trésors » — conception v3 (clone fidèle de Cursed Treasure)

Ce document est la référence commune de toutes les parties du jeu (simulation, rendu, modèles,
ennemis, interface). Il remplace entièrement la version précédente (domaine 3D du moulin, pièges,
coffres, améliorations du moulin, caméra libre) : **on repart de la logique de Cursed Treasure:
Don't Touch My Gems! (IriySoft, 2010)**, habillée avec les éléments du propriétaire.

## 0. Ce qu'on sait de Cursed Treasure (recherches)

- Tu es le « méchant » : 5 gemmes dans une grotte ; des aventuriers arrivent par vagues sur la route,
  vont à la grotte, prennent **une gemme chacun**, puis repartent vers la sortie. S'il sort avec, la
  gemme est perdue. Tué, il **lâche la gemme sur place** ; les autres ennemis **vont la chercher
  directement** et repartent avec. Partie perdue quand toutes les gemmes sont parties ; gagnée si au
  moins une gemme reste à la fin des vagues. « Brillant » = aucune gemme perdue.
- Vue du dessus **fixe** (pas de déplacement de caméra), carte en cases. Les tours se posent sur des
  cases de terrain le long de la route (« sur les falaises au bord de la route ») :
  herbe → **Den** (orc, dégâts bon marché), neige → **Crypt** (mort-vivant, ralentit + dégâts de
  zone), roche/lave → **Temple** (démon, perce l'armure, portée). Les **buttes** (« high ground »)
  acceptent les trois types et donnent +portée/+dégâts. Les **puits de mana** : une tour posée
  dessus augmente la régénération de mana. Des **forêts** couvrent des cases : le sort **Cut Out**
  les dégage (coût en mana).
- Or : primes des ennemis tués (et bonus quand on appelle une vague en avance). Mana : ne vient
  pas des ennemis, se régénère avec le temps jusqu'à un plafond.
- Tours : gagnent de l'expérience ; on paie en or pour monter de niveau quand l'expérience suffit.
  **Au niveau 4 on choisit une spécialisation** (Den → Orcish Den (critiques) ou Ballista Den (zone,
  portée) ; Crypt → Chilling Crypt (gel, peur) ou Ghost Crypt (vol de mana, désarme) ; Temple →
  Burning Temple (zone brûlante) ou Evil Eye Temple (rayonnement : les ennemis touchés prennent
  plus de dégâts ; explosion des cadavres)), puis **nouvelle évolution au niveau 7** (Hunter's Den,
  Catapult Den, Banshee Crypt, Beholder's Temple…).
- Sorts : **Cut Out** (dégager une case de forêt), **Frenzy** (toutes les tours tirent beaucoup plus
  vite pendant 5 s), **Meteor** (grosse explosion de zone).
- Arbre de compétences en 3 branches (Orcs : Dens, Cut Out, or ; Undead : Crypts, Frenzy, mana ;
  Demons : Temples, Meteor, gemmes), **3 points par niveau terminé**, rangs jusqu'à 5. Exemples :
  or de départ, butte plus forte, 6 gemmes au lieu de 5, Cut Out moins cher / qui rapporte de l'or,
  critiques, mana de départ / plafond / régénération, Frenzy moins cher, expérience accrue, porteurs
  de gemme qui brûlent, Meteor moins cher / plus fort, portail de retour (gemme tombée ramenée à la
  grotte après un délai).
- Ennemis (PV, vitesse, capacité) : Paysan 40 normal ; Voleur (rogue) 70 rapide ; Guerrier 120
  lent ; Chevalier 150 lent, bouclier 5 (retire 5 dégâts à chaque coup) ; Ninja 100 rapide, fumigène
  (invisible 5 s dès qu'il est attaqué) ; Mage 100, barrière 100 (absorbe, se régénère) ; Prêtre
  120, soigne un allié de 30 ; Assassin : esquive une partie des coups ; Barde : un air qui accélère
  les alliés proches (vitesse × 2) ; Paladin : immunisé contre tous les effets négatifs ; Valkyrie :
  vole au-dessus de l'eau. Chaque type a une version **champion** (mini-boss), souvent à la dernière
  vague (« boss : chevalier niveau 3 »).
- 15 missions : 1 « Basics » (tutoriel, 5 vagues : paysans, voleurs, guerriers ; route en S du coin
  haut-gauche aux gemmes en bas à droite, deux presqu'îles au centre), 2 (10 vagues, boss chevalier),
  3 (15 vagues, boss ninja), 4 « The Cross » (20), 5 « The Thicket » (20, forêts), 6 « The Fortress »
  (20, crête au nord avec butte et puits de mana), 7 « Snake Eyes » (20, plein de ninjas),
  8 « The Maze » (30), 9 « Crossroads » (30), 10 « Avenue » (30), 11 « Hydra » (40, plusieurs
  entrées), 12 « Break Through » (40), 13 « Halls of the King » (40), 14 « The Secret Passage » (50),
  15 « Battle City » (50).

## 1. Notre version

Titre : **Pas touche à mes trésors**. Page `/jeu/` uniquement. Vue du dessus fixe, carte entière à
l'écran, aucune caméra à déplacer. Ambiance : campagne bretonne autour du moulin, couleurs vives,
lisibles de haut, contours sombres (comme les ennemis actuels).

### 1.1 Tours (3 familles, terrain imposé)

| Famille | Terrain | Rôle (CT) | Niveaux 1–3 | Spéc. A (niv. 4–6 → 7) | Spéc. B (niv. 4–6 → 7) |
| --- | --- | --- | --- | --- | --- |
| `boar` **Sanglier** | herbe | Den : dégâts bon marché | marcassin rayé dans sa bauge (1), jeune sanglier (2), sanglier aux défenses (3) ; lance des **bogues de châtaigne** | **Sanglier chasseur** (coups critiques, cadence) → **Grand Solitaire** (7) | **Laie baliste** (grosse châtaigne qui explose en zone, portée) → **Catapulte à châtaignes** (7, zone + étourdit) |
| `swan` **Cygne** | eau | Crypt : ralentit + petite zone | cygneau gris ébouriffé sur son nid (1), cygne blanc (2), cygne majestueux (3) ; **jet d'eau** qui trempe (ralentit) | **Cygne des glaces** (ralentit fort, peur : l'ennemi recule) → **Cygne royal des glaces** (7, gel) | **Cygne noir** (vole du mana, désarme : retire les capacités) → **Cygne noir enchanteur** (7) |
| `dog` **Berger australien cracheur de feu** | roche | Temple : perce l'armure, portée | chiot merle (1), berger adulte crinière de flammes (2), berger aux petites cornes et ailerons (3) ; **boule de feu** | **Dragon merle rouge** (zone brûlante) → **Grand dragon rouge** (7) | **Dragon merle bleu** (rayonnement : dégâts subis +25 % ; explosion des cadavres) → **Grand dragon bleu** (7) |

Le berger se transforme en dragon avec les niveaux (demande du propriétaire) : les deux
spécialisations sont des dragons (robe merle rouge / merle bleu du berger australien, yeux vairons).

### 1.2 Ennemis (même rôle que CT, vibe du propriétaire)

| Clé | Nom | Rôle CT | PV | Vitesse (cases/s) | Capacité |
| --- | --- | --- | --- | --- | --- |
| `fermier` | Agriculteur en colère (fourche, casquette, salopette) | Paysan | 40 | 1,0 | — |
| `quad` | Voleur en quad (cagoule, pull rayé, petit quad) | Voleur | 70 | 1,6 | — |
| `cowboy` | Cow-boy au lasso | Guerrier | 120 | 0,75 | lasso : ramasse une gemme tombée jusqu'à 1,5 case |
| `vache` | Cavalier sur vache (bretonne pie noir, bidon de lait en bouclier) | Chevalier | 150 | 0,7 | bouclier 5 |
| `druide` | Druide (robe blanche, faucille d'or, gui) | Mage | 100 | 1,0 | barrière 100 (bulle), se reforme après 6 s sans coup |
| `bigoudene` | Bigoudène aux crêpes (haute coiffe de dentelle) | Prêtre | 120 | 1,0 | lance une crêpe : +30 PV à l'allié le plus blessé à 2 cases, toutes les 3 s |
| `chasseur` | Chasseur camouflé (tenue feuillage) | Ninja | 100 | 1,5 | fumigène : invisible 5 s au premier coup reçu |
| `rugbyman` | Rugbyman (maillot, ballon sous le bras) | Assassin | 110 | 1,5 | esquive 50 % des projectiles visés (pas les zones) |
| `sonneur` | Sonneur de biniou (costume breton) | Barde | 110 | 1,0 | toutes les 8 s : alliés à 2 cases vitesse × 2 pendant 3 s |
| `pompier` | Pompier (casque, lance à incendie) | Paladin | 200 | 0,85 | immunisé : ralenti, gel, peur, brûlure, étourdi, rayonnement, désarmement |
| `canard` | Cavalier sur canard géant | Valkyrie | 90 | 1,2 | traverse l'eau (raccourcis) |

Champion (`champion: true`) : PV × 3,5, taille × 1,3, prime × 4, capacités renforcées (bouclier 10,
barrière 250, soin 60…), liseré doré / couronne. Boss (dernière vague) : champion × 2 PV, taille × 1,6,
nommé (« Le Maire sur sa vache », « Le Grand Druide »…).

### 1.3 Sorts (mana)

| Clé | Nom | Coût | Effet |
| --- | --- | --- | --- |
| `cut` | Couper | 30 | dégage une case boisée (herbe, roche, roseaux, butte) → constructible |
| `frenzy` | Frénésie | 60 | toutes les tours : cadence × 2 pendant 5 s |
| `meteor` | Météore | 90 | après 0,8 s, 150 dégâts dans un rayon de 1,4 case |

Mana : départ 40, plafond 100, +1/s ; +0,4/s par tour posée sur un **menhir** (puits de mana).

### 1.4 Compétences (3 points par mission gagnée la première fois, rangs 1 à 5)

Branches : **Sanglier** (or, Couper, sangliers ; chaque point : +1 % cadence de toutes les tours),
**Cygne** (mana, Frénésie, cygnes ; chaque point : +1 % portée), **Berger** (gemmes, Météore,
bergers/dragons ; chaque point : +1 % dégâts). Détail dans `sim/00-data.js`.

## 2. Unités, repères, carte

- Carte : **20 × 13 cases** (`W = 20`, `H = 13`), coordonnées continues en cases : `x` vers la droite
  (0 → 20), `y` vers le bas de l'écran (0 → 13). La case `(i, j)` a son centre en `(i + 0,5, j + 0,5)`.
- Monde 3D : **1 case = 3,6 m** (`PTMT.TILE = 3.6`, soit 2 U de l'ancienne version, échelle native des
  personnages et effets existants). `X = (x − W/2) × TILE`, `Z = (y − H/2) × TILE`, Y vers le haut.
- Hauteurs (m) : route 0 ; herbe/roche (plateaux) +0,45 ; butte +1,3 ; eau : surface −0,25, fond −0,9 ;
  décor `X` : talus/falaises +1,6 à +2,5. `PTMT.view.tileTop(i, j)` donne la hauteur du dessus d'une case.
- Tailles : tour niv. 1 ≈ 1,6–2,2 m de haut, niv. 3 ≈ 2,6 m, spéc. 4–6 ≈ 3–3,6 m, niv. 7 ≈ 4–4,6 m ;
  emprise ≤ 3,2 m (dépassements d'ailes tolérés jusqu'à 4 m). Ennemis : 2,1–2,5 m (échelle native des
  acteurs, ≈ 0,6 case), montures (quad, vache, canard) ≈ 1,6–2,4 m de long. Gemme ≈ 0,5 m.

### 2.1 Format des cartes (`sim/10-maps.js`)

```js
PTMT.sim.MAPS[n] = {
  id: 1, name: "Le chemin du moulin", ct: "Basics", difficulty: "tutoriel",
  waves: 5, gold: 120, gems: 5, biome: "bocage",          // "bocage" | "rocheux" | "marais" | "village"
  spells: ["cut"],                                          // sorts disponibles dans cette mission
  mana: [[4, 6]],                                           // cases « menhir » (puits de mana)
  grid: [                                                   // 13 lignes de 20 caractères
    "E###................",
    ...
  ],
}
```

Légende (un caractère par case) :

| Car. | Case | Constructible | Marchable |
| --- | --- | --- | --- |
| `.` | herbe | sanglier | non |
| `^` | roche (granit aux braises) | berger | non |
| `~` | eau (étang, rivière) | cygne | canard seulement |
| `H` | butte | les trois (+30 % portée, +10 % dégâts) | non |
| `f` `r` `w` `h` | herbe boisée, roche boisée (rochers et pins), roseaux, butte boisée | après **Couper** → `.` `^` `~` `H` | non |
| `#` | chemin | non | oui |
| `=` | pont (chemin sur l'eau) | non | oui |
| `E` | entrée / sortie (chemin au bord de la carte) | non | oui |
| `L` | repaire des gemmes (fin du chemin, devant le moulin) | non | oui |
| `X` | décor infranchissable (talus, gros rochers, maisons, moulin) | non | non |

Le moulin (repaire) occupe les cases `X` voisines de `L`. Une carte a 1 repaire, 1 à 4 entrées.

## 3. Simulation (`PTMT.sim`, JavaScript pur, sans THREE) — propriétaire : intégrateur

```js
const game = PTMT.sim.createGame({ level: 1, skills: { goldVault: 2, ... }, seed: 1 });
game.step(dt);                 // dt réel ; vitesse (×1/×2/×3) et pause appliquées dedans ; pas fixes de 1/60 s
game.state                     // état vivant (lecture seule pour le rendu et l'interface)
game.drainEvents()             // événements depuis le dernier appel (tableau)
// Commandes → { ok: true } ou { ok: false, reason: "texte en français" }
game.build(i, j, family)       // "boar" | "swan" | "dog"
game.upgrade(towerId, spec)    // spec "A" | "B" obligatoire pour passer du niveau 3 au 4
game.sell(towerId)
game.cast("cut", { x, y }) ; game.cast("frenzy") ; game.cast("meteor", { x, y })   // x, y en cases (continues)
game.callWave()                // lance la prochaine vague tout de suite (+or selon le temps restant)
game.setSpeed(1 | 2 | 3) ; game.setPaused(bool)
// Requêtes
game.tileInfo(i, j)            // { terrain, forest, high, mana, road, towerId, buildable: ["boar", ...] }
game.towerInfo(id)             // stats actuelles, suivantes, coûts, xp, valeur de revente, choix de spéc.
game.nextWave()                // { index, total, countdown, groups: [{ type, champion, boss, count }], entrances: [id] }
game.describeEnemy(type)       // { name, role, hp, speed, ability } pour les fiches « Nouvel ennemi »
```

`state` :

```js
{
  level, map: { w, h, grid, name, entrances: [{ id, i, j }], lair: { i, j } },
  time, speed, paused, over: null | { win, gemsLeft, gemsTotal, brilliant, points },
  gold, mana, manaMax,
  gems: [{ id, color: 0..5, where: "lair" | "ground" | "carried" | "lost", x, y, carrier, returnIn }],
  wave: { index, total, countdown, running },
  towers: [{ id, family, level, spec, i, j, xp, xpNext, kills, aim, lastShot, cooldown, targetId }],
  enemies: [{ id, type, champion, boss, x, y, dir, hp, hpMax, barrier, barrierMax, moving, speed,
              carrying: gemId | null, goal: "gem" | "lair" | "exit",
              fx: { slow, fear, freeze, burn, radiance, haste, invisible, stun, disarmed } }],
  projectiles: [{ id, kind, x, y, h, fromTowerId, targetId, tx, ty }],
  areas: [{ id, kind: "burn" | "meteorWarn", x, y, r, t }],
  spells: { cut: { cost, ready }, frenzy: { cost, ready, active }, meteor: { cost, ready } },
}
```

Événements (`type` + champs) : `spawn {enemyId}`, `attack {towerId, targetId}` (début de l'élan de la
tour), `shot {towerId, projectileId}`, `impact {projectileId, kind, x, y, r, crit}`, `fizzle {projectileId}`
(cible disparue), `hit {enemyId, dmg,
crit, evaded, absorbed, x, y, kind}`, `kill {enemyId, gold, towerId, x, y}`, `steal {enemyId, gemId}`
(pris au repaire), `drop {gemId, x, y}`, `pickup {gemId, enemyId}`, `escape {enemyId, gemId}`,
`gemReturn {gemId}`, `build {towerId}`, `upgrade {towerId, level, spec}`, `sell {towerId, gold}`,
`cast {spell, x, y}`, `meteorImpact {x, y, r}`, `cut {i, j}`, `heal {fromId, toId, amount}`,
`smoke {enemyId}`, `haste {enemyId}`, `barrierBreak {enemyId}`, `disarm {enemyId}`, `fear {enemyId}`,
`freeze {enemyId}`, `stun {enemyId}`, `immune {enemyId}`, `lasso {enemyId, gemId}`, `barrierUp {enemyId}`,
`corpseBomb {x, y, r}`, `frenzy {on}`, `waveStart {index}`, `newEnemy {type}`, `bossArrives {enemyId, name}`,
`secretOpen`, `earlyBonus {gold}`, `win`, `lose`.

Angles : `dir` (ennemis) et `aim` (tours) sont des angles « monde » : 0 = vers +y (+Z), π/2 = vers +x
(+X), utilisables tels quels en `rotation.y`. `state.gemCount = { total, lair, ground, carried, lost }`.

Projectiles `kind` : `chestnut` (sanglier 1–3 et chasseur), `bigChestnut` (baliste, catapulte ; tir en
cloche), `waterJet` (cygne 1–3), `iceShard` (cygne des glaces), `darkWater` (cygne noir), `fireball`
(berger 1–3), `dragonFire` (dragon rouge), `blueFire` (dragon bleu).

IA des gemmes (demande explicite) : chaque ennemi sans gemme vise la **gemme disponible la plus proche
en distance de chemin** (gemme au sol ou repaire non vide) et y va directement (demi-tour compris) ;
dès qu'une gemme tombe, tous les ennemis sans gemme recalculent ; le premier arrivé la ramasse, les
autres se retournent vers la gemme suivante. Porteur → sortie la plus proche. Plus aucune gemme
disponible → ils vont au repaire puis ressortent les mains vides.

## 4. Rendu (`PTMT.view`) — agent « Monde »

Fichiers : `render/10-map.js` (terrain, eau, falaises, forêts, décor), `render/20-entities.js`
(liaison état → 3D), `render/30-camera.js` (caméra fixe + visée), `fx/14-world.js` (effets de carte).

```js
const view = PTMT.view.create({ renderer, scene, map, mobile });   // map = PTMT.sim.MAPS[n]
view.tileTop(i, j) ; view.toWorld(x, y) ; view.pick(clientX, clientY) → { i, j, x, y } | null
view.resize(w, h, insets)      // insets { top, bottom, left, right } en px (barres de l'interface)
view.sync(state, events, dt, time)   // appelé à chaque image
view.showRange(towerOrNull) ; view.preview(i, j, family) ; view.target(spell | null, x, y)
view.render()
```

Caméra **orthographique fixe**, inclinée d'environ 60° (on voit un peu l'avant des modèles), toute la
carte visible, cadrée entre les barres de l'interface. En portrait (téléphone), la carte tourne de 90°
(les colonnes deviennent des lignes) pour remplir l'écran. Aucun glisser, aucun zoom.

Look « Cursed Treasure » : terrain peint (une grande texture dessinée sur canvas au chargement : herbe
riche avec fleurs et touffes, chemins de terre battue aux ornières et bordures d'herbe, roche de granit
aux fissures de braise orange, berges), relief en plateaux (petites falaises le long des chemins, butte
plus haute avec ses flancs rocheux), eau animée (shader : reflets, vaguelettes, écume sur les berges),
forêts denses en instances (chênes, châtaigniers, pins ; sur roche : rochers moussus et pins ; roseaux
sur l'eau), décor `X` selon le biome (talus bocagers plantés, gros blocs, maisons de granit), menhirs
lumineux sur les puits de mana, portes d'entrée (poteau indicateur + flèche animée quand la vague
arrive par là), repaire = petit moulin avec sa roue et le tas de gemmes. Ombres portées douces.

## 5. Modèles des tours et projectiles — agent « Tours »

`models/20-boar.js`, `models/21-swan.js`, `models/22-dog.js` (+ `fx/13-shots.js` pour projectiles et
impacts). Registre :

```js
const t = PTMT.models.ctTower(family, level, spec);   // family "boar"|"swan"|"dog", level 1..7, spec null|"A"|"B"
t.object ; t.height ; t.muzzle (Object3D : départ des projectiles)
t.update(dt, time) ; t.aim(yaw)            // yaw monde (0 = +Z), lissé dans le modèle
t.attack() → délai (s) avant le départ du projectile (anime la bête : cou tendu, gueule ouverte…)
t.setSelected(bool) ; t.setFrenzy(bool) ; t.celebrate() (montée de niveau) ; t.dispose()
PTMT.fx.shot(kind, fromVec3, toVec3, { arc, t }) → projectile visuel (voir liste §3) ; .set(pos, dir) ; .release()
PTMT.fx.burst(kind + "Hit", position)      // chestnutHit, bigChestnutHit, waterJetHit, iceShardHit, …
```

## 6. Ennemis — agent « Ennemis »

`actors/10-actors.js`, `actors/11-types.js`, `actors/12-overlay.js`, `ui/06-portraits.js`.

```js
await PTMT.actors.load();
const a = PTMT.actors.create(type, champion, boss);   // types du §1.2
a.object ; a.height ; a.carryAnchor (Object3D où l'on accroche la gemme portée)
a.update(dt, time, s)   // s = { speed, moving, carrying, slow, freeze, burn, fear, invisible (0..1),
                        //       barrier (0..1), haste, stun, disarmed, hp (0..1) }
a.event(name)           // "hit" | "die" | "pickup" | "drop" | "heal" | "smoke" | "tune" | "lasso"
                        // | "dodge" | "barrierBreak" | "spawn" | "escape"
a.release()
PTMT.portraits.get(type, champion) → SVG ; PTMT.portraits.names[type]
```

## 7. Décor, gemmes, repaire — agent « Décor »

`models/40-props.js` :

```js
PTMT.models.gem(color)            // 0 rubis, 1 émeraude, 2 saphir, 3 améthyste, 4 topaze, 5 diamant
  → { object, update(dt, time), setState("lair" | "ground" | "carried" | "returning") }
PTMT.models.lair(gems)            // petit moulin breton + roue à aubes + tas de gemmes devant la porte
  → { object, gemSlots: [Vector3...], setGems(n), alarm(bool), update(dt, time) }
PTMT.models.menhir()              // puits de mana : menhir gravé, runes bleues qui pulsent
PTMT.models.gate(entranceIndex)   // entrée : poteau indicateur, lanterne, flèche au sol .pulse(on)
PTMT.models.forest(kind, seed)    // kind "grass" | "rock" | "reeds" | "high" → { object, cut() → Promise, update }
PTMT.models.decor(kind, seed)     // "talus" | "boulders" | "house" | "hedge" | "calvaire" | "haystack" | …
```

## 8. Interface, icônes, logo — agent « Interface »

`ui/05-icons.js` (toutes les icônes SVG), `ui/07-logo.js` (logo), `ui/10-ui.js` (écrans et HUD),
`jeu.css`, `index.html`. Police des titres : **Lilita One** (déjà dans `fonts/`, jeton CSS
`{{asset:jeu-font}}`), texte courant en police système.

Écrans : titre (logo, Jouer), carte des missions (15 missions, étoiles/couronne « Brillant »,
verrous), compétences (3 branches), encyclopédie (ennemis rencontrés, tours), fiche « Nouvel
ennemi ! », victoire/défaite, pause. HUD : or, mana (jauge), gemmes (5 à 6 pastilles : au repaire,
au sol (clignote), portée, perdue), vague n/total + aperçu de la suivante (icônes, entrée) + bouton
« Appeler » (bonus), vitesse × 1/× 2/× 3, pause ; sorts (3 gros boutons ronds avec coût) ; menu de
construction ancré sur la case ; panneau de tour (portrait, niveau, expérience, stats, Améliorer,
choix A/B au niveau 4, Vendre). Téléphone portrait et paysage, ordinateur.

## 9. Règles communes

- three.js r128 global (`THREE`), scripts classiques qui s'enregistrent sur `globalThis.PTMT`,
  chargés dans l'ordre : core, sim, models, fx, actors, render, ui, puis `main.js`.
- Aucune ressource externe (tout procédural : géométries, textures canvas, SVG).
- Commentaires en français, style des fichiers existants. Pas d'identifiant de modèle d'IA dans le code.
- Budgets : tour ≤ 6 000 triangles (niveau 7 ≤ 9 000), ennemi ≤ 4 000 ; ≤ 150 appels de dessin sur
  téléphone pour une scène de 40 tours et 50 ennemis.
