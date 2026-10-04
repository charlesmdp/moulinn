# « Pas touche à mes trésors » — conception v4

Référence commune de toutes les parties du jeu (simulation, rendu, modèles, ennemis, interface).
La v4 répond aux retours du propriétaire après avoir joué la v3 :

- le jeu devient **trop facile** à partir d'un moment (Cursed Treasure, lui, reste tendu) ;
- à partir d'un certain point, **plusieurs cachettes** où l'on peut voler les trésors (comme les
  grottes multiples de Cursed Treasure, missions 9 et 14) ;
- **trésors plus visibles**, de couleurs bien différentes ;
- **chemins plus larges et moins linéaires**, où les ennemis **se baladent** (certains au milieu,
  d'autres le long des bords : on ne les atteint pas tous de la même façon) ;
- **vagues plus claires** (comme Cursed Treasure) ;
- **tours plus lisibles** (on voit mal ce que sont les premiers niveaux), **attaques plus
  compréhensibles** (le feu en particulier) et **moins identiques** : une tour garde des charges et
  les lâche d'un coup, une autre crache un jet continu tant que la cible reste à portée… ;
- **ennemis plus lisibles** (on voit mal qu'un fermier chevauche une vache), **plus de types**,
  d'autres ennemis **un peu durs** (les chasseurs « ninja » étaient les seuls vraiment difficiles) ;
- garder les **bonnes surprises** (les canards qui coupent par l'eau) et **en inventer d'autres** ;
- « ton UX est super » : on garde l'interface, on l'enrichit.

## 0. Cursed Treasure : ce qui compte pour la v4

- Cartes ≈ 16 × 16 cases. Les **routes font 2 à 4 cases de large** ; les plateaux constructibles
  font 1 à 3 cases, souvent **couverts de forêt** (il faut les dégager au mana). Des **buttes** isolées
  (une case, les trois tours) sont posées **au milieu des routes**. Des **puits de mana** brillent sur
  quelques cases. Les gemmes sont dans une **grotte** (cratère sombre de 2 à 3 cases) où elles
  ressortent en couleurs vives ; plus loin dans le jeu, **deux grottes** se partagent les gemmes
  (2 + 3).
- Les ennemis avancent en groupe désordonné sur toute la largeur de la route.
- Tours : la tour d'orcs tire des flèches à la suite ; la crypte **garde des charges et les tire en
  rafale** puis se recharge ; le temple **brûle sa cible d'un rayon continu** tant qu'elle reste à
  portée.
- Difficulté : missions 4 (20 vagues, facile), 9 (30, normal), 12 (40, difficile), 14 (50, difficile).

## 1. Notre version

Page `/jeu/` uniquement. Vue du dessus fixe, carte de **20 × 13 cases** entière à l'écran (inchangé).

### 1.1 Tours : trois familles, trois façons d'attaquer

| Famille | Terrain | Attaque | Niveaux 1–3 | Spéc. A (4–6 → 7) | Spéc. B (4–6 → 7) |
| --- | --- | --- | --- | --- | --- |
| `boar` **Sanglier** (bauge) | herbe | **tir** (`shot`) : bogues de châtaigne à la suite, une cible | marcassin, jeune sanglier, sanglier des talus | Sanglier chasseur (coups critiques) → **Grand Solitaire** (critiques + **deux cibles à la fois**) | Laie baliste (grosse châtaigne en cloche, zone) → **Catapulte** (zone + étourdit) |
| `swan` **Cygne** (nid) | eau | **charges** (`charges`) : garde 2 à 5 boules d'eau, les lâche en rafale sur une ou plusieurs cibles, puis chaque charge se recharge | cygneau (2 charges), cygne (2), cygne majestueux (3) | Cygne des glaces (boules de glace : ralentit fort, peur) → **Cygne royal** (gel) | Cygne noir (boules sombres : vol de mana, désarme) → **Cygne noir enchanteur** |
| `dog` **Berger australien → dragon** (autel de braise) | roche | **jet continu** (`beam`) : flamme ininterrompue sur une cible tant qu'elle reste à portée ; **plus il la tient, plus ça chauffe** (dégâts × 2,2 à × 2,6 au bout de 3 s) ; perce les boucliers | chiot berger, berger, berger de feu | Dragon merle rouge (le jet embrase autour de la cible et la fait brûler) → **Grand dragon rouge** (deux jets) | Dragon merle bleu (rayonnement : la cible prend + 25 % de tous les dégâts ; explosion des vaincus) → **Grand dragon bleu** (le jet rebondit sur une 2ᵉ cible) |

Lisibilité (exigence) : chaque tour **remplit sa case** (≈ 85 % de 3,6 m), a une **silhouette de
famille** qu'on reconnaît à 40 px dès le niveau 1 (bauge de bois au toit de branchages pour le
sanglier, nid de roseaux posé sur l'eau pour le cygne, autel de granit aux braises pour le berger),
et une **couleur de famille** au sol (brun-vert, bleu-blanc, rouge-orange). Le niveau se lit au fanion
(1 à 3 étoiles) et à la taille.

### 1.2 Ennemis : seize types

| Clé | Nom | Rôle | PV | Vitesse | Capacité |
| --- | --- | --- | --- | --- | --- |
| `fermier` | Agriculteur en colère | paysan | 40 | 0,9 | — |
| `quad` | Voleur en quad | voleur rapide | 70 | 1,45 | — |
| `cowboy` | Cow-boy au lasso | guerrier | 120 | 0,68 | lasso : attrape une gemme tombée à 1,5 case |
| `vache` | Cavalier sur vache | chevalier | 170 | 0,63 | bouclier 5 |
| `druide` | Druide | mage | 100 | 0,9 | bulle de 60 qui se reforme après 5 s sans coup |
| `bigoudene` | Bigoudène aux crêpes | prêtre | 120 | 0,9 | crêpe : + 30 PV à l'allié le plus blessé, toutes les 3 s |
| `chasseur` | Chasseur camouflé | ninja | 100 | 1,35 | fumigène : invisible 5 s au premier coup |
| `rugbyman` | Rugbyman | assassin | 110 | 1,35 | esquive un projectile sur deux (pas les zones, pas le jet) |
| `sonneur` | Sonneur de biniou | barde | 110 | 0,9 | toutes les 8 s : alliés proches × 2 de vitesse pendant 3 s |
| `pompier` | Pompier | paladin | 220 | 0,77 | insensible à tous les effets |
| `canard` | Cavalier sur canard | valkyrie | 90 | 1,08 | **nage** : coupe par l'eau |
| `cycliste` | Cycliste du peloton | essaim | 45 | 1,6 | arrive en **peloton** (jusqu'à 20) ; + 30 % de vitesse groupé |
| `korrigan` | Korrigan | **nouveau, rusé** | 120 | 1,08 | touché, il **disparaît et réapparaît 1,8 case plus loin** (toutes les 3,5 s) |
| `touriste` | Touriste au flash | **nouveau, rusé** | 110 | 0,9 | toutes les 5 s, **éblouit** la tour la plus proche (1,6 case) : elle ne tire plus pendant 2 s |
| `tracteur` | Tracteur du voisin | **nouveau, tank** | 420 | 0,5 | bouclier 3 ; détruit, **trois agriculteurs sautent de la cabine** |
| `montgolfiere` | Montgolfière | **nouveau, surprise** | 260 | 0,5 | **vole en ligne droite** au-dessus de tout, du bord de la carte à la cachette, puis repart vers le bord le plus proche |

Champion : PV × 3,5, taille × 1,3, capacités renforcées, couronne / liseré doré. Boss : champion × 2,
taille × 1,6, nommé. Lisibilité (exigence) : on doit reconnaître chaque ennemi **d'un coup d'œil vu
d'en haut** : montures grandes et caricaturales (la vache est d'abord une vache pie noir, cornes et
museau rose, le cavalier assis bien haut dessus), couvre-chefs et couleurs francs, silhouettes simples.

### 1.3 Cachettes (plusieurs à partir de la mission 7)

Une cachette = un **bloc de 2 × 2 cases `L`** : un trou sombre cerclé de granit où les gemmes
brillent, grandes (≈ 1,3 m) et de couleurs bien distinctes : rubis, émeraude, saphir, améthyste,
topaze, diamant. La cachette principale est devant le moulin (6 cases `X` derrière elle). Les
cachettes secondaires ont leur décor (vieux puits, dolmen, chapelle). Chaque gemme appartient à une
cachette. Un ennemi sans gemme va vers **la source la plus proche** (cachette non vide ou gemme au
sol), en distance de chemin.

### 1.4 Surprises

- **Canards** : nagent et coupent par l'eau (mission 9 +).
- **Passage secret** : un fourré s'ouvre en chemin à une vague donnée (mission 14).
- **Marée** (`m`) : l'estran est de l'eau à marée haute et un chemin à marée basse ; la marée change
  toutes les `cycle` vagues (missions 6 et 15). Un ennemi surpris par la marée montante patauge
  jusqu'à la terre.
- **Barrière qui cède** (`g`) : une nouvelle entrée s'ouvre à une vague donnée (missions 8, 13, 15).
- **Montgolfières** : routes aériennes en ligne droite (mission 11 +).
- **Korrigans, touristes, tracteurs** : voir 1.2.
Toute surprise est **annoncée** dans l'aperçu des vagues (icône et texte) avant d'arriver.

### 1.5 Sorts

Couper (30 mana : dégage une case boisée), Frénésie (60 : tours × 2 pendant 5 s), Météore (90 :
150 dégâts dans un rayon de 1,4 case après 0,8 s). Mana : départ 40, plafond 100, + 1 par seconde,
+ 0,4 par tour posée sur un menhir.

## 2. Carte

- 20 × 13 cases, `x` vers la droite, `y` vers le bas ; case `(i, j)` centrée en `(i + 0,5, j + 0,5)`.
- Monde 3D : 1 case = 3,6 m ; `X = (x − 10) × 3,6`, `Z = (y − 6,5) × 3,6`, Y vers le haut.
- Hauteurs : route 0 ; plateaux +0,45 ; butte +1,3 ; eau −0,25 (surface).

Légende :

| Car. | Case | Constructible | Passage |
| --- | --- | --- | --- |
| `.` `^` `~` `H` | herbe, roche, eau, butte | sanglier, berger, cygne, les trois | eau : nageurs |
| `f` `r` `w` `h` | herbe, roche, roseaux, butte **boisés** | après Couper | roseaux : nageurs |
| `#` `=` | route, pont | non | oui |
| `E` | entrée (au bord, un groupe de cases contiguës = une entrée) | non | oui |
| `L` | cachette (bloc 2 × 2) | non | oui |
| `X` | décor (moulin, talus, maisons…) | non | non |
| `s` | fourré du passage secret | non | non, puis route |
| `m` | estran (marée) | non | marée basse : oui ; haute : nageurs |
| `g` | barrière (entrée fermée) | non | non, puis entrée |

```js
PTMT.sim.MAPS[n] = {
  id, name, ct, difficulty, waves, gold, biome, spells, grid: [13 × 20 caractères],
  mana: [[i, j]...],                  // menhirs
  mill: [[i, j] × 6],                 // cases X du moulin (derrière la cachette principale)
  lairs: [{ at: [i, j], gems: 3, style: "moulin" | "puits" | "dolmen" | "chapelle", name }],
  secretWave, tide: { cycle: 3 } | undefined, gates: [{ at: [i, j], wave: 12 }] | undefined,
  decor: { "i,j": "calvaire" }, intro: [["korrigan", 3]...] (ennemis présentés)
}
```

## 3. Simulation (`PTMT.sim`)

```js
const game = PTMT.sim.createGame({ level, skills, seed });
game.step(dt) ; game.state ; game.drainEvents()
game.build(i, j, family) ; game.upgrade(id, spec) ; game.sell(id)
game.cast("cut" | "frenzy" | "meteor", { x, y }) ; game.callWave() ; game.setSpeed(1|2|3) ; game.setPaused(b)
game.tileInfo(i, j) ; game.canBuild(i, j, f) ; game.towerInfo(id) ; game.upgradeable()
game.nextWave() ; game.upcoming(n) ; game.describeEnemy(type) ; game.enemyInfo(id)
```

Déplacement : **continu**. Chaque ennemi suit un champ d'écoulement (distances par « marche rapide »,
solution de l'équation eikonale sur la grille : la pente suit l'axe des routes larges) et garde sa **voie** : un réel `lane` dans [−1, 1] (− 1 / + 1 : le long d'un bord, 0 : au
milieu) qui dérive lentement ; il se décale dans la largeur de la route, contourne les buttes, s'écarte
de ses voisins. Les montgolfières volent en ligne droite (`flying: true`, altitude 1,6 case).

`state` (lecture seule) :

```js
{
  level, time, speed, paused, over: null | { win, gemsLeft, gemsTotal, brilliant },
  gold, mana, manaMax, manaRegen, frenzy, frenzyLeft, tide: "high" | "low" | null,
  map: { id, name, w, h, grid, version, biome, mill, mana, decor, secretWave,
         entrances: [{ id, letter: "A", color: "#ff8a3d", tiles: [[i, j]...], x, y, dir, open, opensAt }],
         lairs: [{ id, name, style, tiles: [[i, j] × 4], x, y, total, stock, mill }] },
  gems: [{ id, color: 0..5, lair, slot, where: "lair" | "ground" | "carried" | "lost", x, y, carrier, returnIn }],
  gemCount: { total, lair, ground, carried, lost },
  wave: { index, total, countdown, running, spawning, nextEntrances: [ids] },
  towers: [{ id, family, level, spec, i, j, x, y, aim, range, high, onMana, attack: "shot" | "charges" | "beam",
             targetId, ammo, ammoMax, beams: [{ targetId, heat (0..1) }], dazzled (s restantes) }],
  enemies: [{ id, type, champion, boss, name, x, y, dir, hp, hpMax, barrier, barrierMax, speed, moving,
              carrying, water, flying, alt, lane, goal: "gem" | "lair" | "exit",
              fx: { slow, fear, freeze, burn, radiance, haste, invisible, stun, disarmed, wading } }],
  projectiles: [{ id, kind, fromTowerId, targetId, x, y, p, arc }],
  areas: [{ id, kind: "meteorWarn" | "fireGround", x, y, r, t }],
  spells: { cut | frenzy | meteor: { cost, unlocked, ready, active, left } },
}
```

`game.upcoming(n)` → `[{ index, startsIn (s), groups: [{ type, champion, boss, count, name, entrance,
letter, flying, swims }], entrances: [ids], notes: [{ kind: "tideLow" | "tideHigh" | "gate" | "secret",
entrance? }] }]` (la première est la prochaine vague).

Événements (`type` + champs, le type d'ennemi s'appelle `enemyType`) : ceux de la v3 (`spawn`,
`attack`, `shot`, `impact`, `fizzle`, `hit`, `kill`, `steal {enemyId, gemId, lairId}`, `drop`,
`pickup`, `escape`, `gemReturn`, `build`, `upgrade`, `sell`, `cast`, `meteorImpact`, `cut`, `heal`,
`smoke`, `haste`, `barrierBreak`, `barrierUp`, `disarm`, `fear`, `freeze`, `stun`, `immune`, `lasso`,
`corpseBomb`, `frenzy`, `waveStart`, `newEnemy`, `bossArrives`, `secretOpen`, `earlyBonus`, `win`,
`lose`) et :

- `beamOn {towerId, targetId, kind}`, `beamOff {towerId}` (jet continu ; la chaleur est dans l'état) ;
- `flash {enemyId, towerIds}` (touriste), `dazzleEnd {towerId}` ;
- `blink {enemyId, fromX, fromY, x, y}` (korrigan) ;
- `split {enemyId, x, y, spawned: [ids]}` (tracteur) ;
- `tide {state}`, `gateOpen {entranceId}`.

Projectiles : `chestnut`, `bigChestnut` (cloche), `waterOrb`, `iceOrb`, `darkOrb` (cygne, en rafale).
Jets : `fire` (berger 1–3), `dragonFire` (rouge), `blueFire` (bleu).

## 4. Rendu (`PTMT.view`) — agent « Monde »

API inchangée (v3) ; en plus : `view.pick` renvoie aussi `enemyId` quand on touche un ennemi. À
rendre : routes larges peintes et **bords de plateaux nets** (comme les falaises de Cursed Treasure),
cachettes (`PTMT.models.lair`), buttes au milieu des routes (`PTMT.models.highGround`), estran
animé selon `state.tide`, barrières (`PTMT.models.barrier`) qui s'ouvrent, montgolfières en altitude
avec ombre au sol et ligne de route pointillée, jets (`PTMT.fx.beam`), charges des cygnes, tours
éblouies, **lettres et couleurs des entrées**, **aperçu du trajet** de la prochaine vague.

## 5. Tours — agent « Tours »

```js
const t = PTMT.models.ctTower(family, level, spec, { terrain });
t.object ; t.height ; t.muzzle ; t.update(dt, time) ; t.aim(yaw) ; t.attack() → délai
t.setSelected(b) ; t.setFrenzy(b) ; t.celebrate() ; t.dispose()
t.setCharges(full, max, partial01)        // cygne : boules d'eau qui tournent autour du nid
t.setBeam(on, heat01)                     // berger/dragon : gueule ouverte, souffle qui s'intensifie
t.setDazzled(b)                           // ébloui par un flash : étoiles, tête qui tourne
PTMT.fx.projectile(kind) ; PTMT.fx.burst(kind + "Hit", pos, { radius, h, crit })
const b = PTMT.fx.beam(kind)              // "fire" | "dragonFire" | "blueFire"
b.set(fromVec3, toVec3, heat01, time) ; b.release()
```

## 6. Ennemis — agent « Ennemis »

```js
await PTMT.actors.load() ; const a = PTMT.actors.create(type, champion, boss)
a.object ; a.height ; a.carryAnchor ; a.finished ; a.flying (montgolfière : la nacelle est au sol du
modèle, le rendu la soulève) ; a.update(dt, time, s) ; a.event(name, cibleMonde?) ; a.release()
// événements en plus : "blink" (korrigan : pouf violet), "flash" (touriste), "split" (tracteur détruit)
PTMT.portraits.get(type, champion) ; .names ; .accent
```

## 7. Décor — agent « Décor »

```js
PTMT.models.gem(color)                    // ≈ 1,3 m, couleurs franches, lueur ; états lair/ground/carried/returning
PTMT.models.lair(maxGems, { style, mill })   // trou sombre 2 × 2 cases, gemSlots, setGems(n), alarm(b)
PTMT.models.mill()                        // le moulin seul (6 cases derrière la cachette principale)
PTMT.models.highGround()                  // socle de granit sombre + fanion tricolore (butte)
PTMT.models.barrier()                     // barrière fermée → .open() la fait céder
PTMT.models.menhir() ; gate(index) ; forests(entries) ; decorBatch(entries) ; scatter(entries)
```

## 8. Interface — agent « Interface »

On garde tout (le propriétaire aime l'UX). En plus : **frise des vagues** façon Cursed Treasure
(blocs des prochaines vagues qui glissent vers un repère « maintenant » : portraits × nombre,
couronnes, lettre et couleur d'entrée, notes de surprise ; toucher le premier bloc appelle la vague),
**fiche d'ennemi** au toucher (nom, capacité, PV), panneau de tour adapté aux charges et au jet,
gemmes groupées par cachette, encyclopédie et icônes des nouveautés.

## 9. Règles communes

- three.js r128 global, scripts classiques sur `globalThis.PTMT`, ordre : core, sim, models, fx,
  actors, render, ui, `main.js`.
- Aucune ressource externe. Commentaires en français. Pas d'identifiant de modèle d'IA dans le code.
- Budgets : tour ≤ 6 000 triangles (niveau 7 ≤ 9 000), ≤ 2 appels de dessin (1 sur téléphone) ;
  ennemi ≤ 4 000 triangles, 1 appel ; ≤ 150 appels sur téléphone avec 40 tours et 60 ennemis.
