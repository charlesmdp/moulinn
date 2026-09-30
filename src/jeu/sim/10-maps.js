// « Pas touche à mes trésors » — les quinze missions (PTMT.sim.MAPS[1..15]), sans THREE.
//
// Une carte = 20 × 13 cases décrites lettre par lettre (légende dans CONCEPTION.md §2.1 et
// DATA.TILES) : herbe « . » (sanglier), roche « ^ » (berger), eau « ~ » (cygne), butte « H »
// (les trois), cases boisées « f r w h » (à dégager avec Couper), chemin « # », pont « = »,
// entrées « E » au bord, repaire « L » (le tas de gemmes devant le moulin), décor « X », passage
// secret « s » (fourré infranchissable qui s'ouvre en chemin à la vague secretWave).
// mill : cases X couvertes par le moulin ; mana : cases à menhir (puits de mana) ; decor : type
// de décor imposé pour certaines cases X (sinon selon le biome).
//
// Les missions suivent celles de Cursed Treasure (champ ct) : même progression de difficulté et
// même nombre de vagues, cartes redessinées dans la campagne du moulin.
(function () {
  "use strict";
  const PTMT = (globalThis.PTMT = globalThis.PTMT || {});
  const S = (PTMT.sim = PTMT.sim || {});
  const SPELLS = [null, ["cut"], ["cut", "frenzy"]];
  const M = (S.MAPS = [null]);
  const add = (m) => {
    m.gems = m.gems || 5;
    m.spells = SPELLS[m.id] || ["cut", "frenzy", "meteor"];
    m.decor = m.decor || {};
    M[m.id] = m;
  };
  // Décor des cases X hors moulin, selon le biome de la carte.
  S.DECOR_BY_BIOME = { bocage: "talus", rocheux: "boulders", marais: "pond_rocks", village: "house" };

  add({
    id: 1, name: "Le chemin du moulin", ct: "Basics", difficulty: "tutoriel", waves: 5, gold: 160, biome: "bocage", mana: [], mill: [[18, 10], [19, 10], [18, 11], [19, 11]],
    grid: [
      "..ffff.......ff.....",
      "E################...",
      ".......^^.......#...",
      "...f..H^^.......#.f.",
      "...f............#.ff",
      "...##############...",
      "...#..~~...........f",
      "...#..~~.....^^.....",
      "...#.........^^..ff.",
      "...###############..",
      "ff...............#XX",
      "ff...........^^..LXX",
      "fff..............XXX",
    ],
  });

  add({
    id: 2, name: "Le Gué", ct: "Mission 2", difficulty: "facile", waves: 10, gold: 150, biome: "bocage", mana: [[17, 1]], mill: [[0, 10], [1, 10], [0, 11], [1, 11]],
    grid: [
      ".....~~.......E.....",
      "..f..~~.......#..^^.",
      "..f..~~..######..^^.",
      ".....~~..#..........",
      ".H...~~..#....ff....",
      ".....~~..#....ff..^^",
      "..###==###........^^",
      "..#..~~.....^^^.....",
      "..#..~~.....^^^..f..",
      "..#..~~..........f..",
      "XX#..~~....ff.......",
      "XXL..~~.............",
      "XXX..~~.............",
    ],
  });

  add({
    id: 3, name: "Les Deux Prés", ct: "Mission 3", difficulty: "facile", waves: 15, gold: 180, biome: "bocage", mana: [[2, 1]], mill: [[13, 11], [14, 11], [13, 12], [14, 12]],
    grid: [
      "ff......fE....ff....",
      "f.^^.....#....ff..X.",
      "..^^.....#########..",
      ".....H....~~.....#..",
      ".f........~~..^^.#..",
      ".f..rr........^^.#..",
      "..################..",
      "..#......^^......f..",
      "..#..~~..^^..H...f..",
      "..#..~~.............",
      "..###########.......",
      "ff..........LXX.....",
      "fff........XXXX.....",
    ],
  });

  add({
    id: 4, name: "La Croix", ct: "The Cross", difficulty: "facile", waves: 20, gold: 220, biome: "bocage", mana: [[3, 1], [16, 4]], mill: [[2, 10], [3, 10], [2, 11], [3, 11]], decor: {"6,2": "calvaire"},
    grid: [
      "..^^.....E....ff....",
      "..^^.....#....ff..~~",
      "......X..#........~~",
      ".ff......#.....^^...",
      ".ff.....####...^^...",
      "E########HH#........",
      "........#HH########E",
      "..~~....####....^^..",
      "..~~......######.^^.",
      ".....H.........#....",
      "XXXXL###########..ff",
      "XXXX.....ff.....ff..",
      "ff.......ff.......ff",
    ],
  });

  add({
    id: 5, name: "Le Hallier", ct: "The Thicket", difficulty: "facile", waves: 20, gold: 240, biome: "bocage", mana: [[16, 4]], mill: [[17, 9], [18, 9], [17, 10], [18, 10]],
    grid: [
      "ffffwwffffffffffffff",
      "ff..~~.ffffrrfff..ff",
      "E############fff..ff",
      "fff.~~...ff.#ff.rrff",
      "ff..~~...ff.#f..^^.f",
      "fh......ff..#...^^.f",
      "ff.##########..fffff",
      "ff.#..ff..rr....ffff",
      "fw.#..ff..rr..^^..ff",
      "ww.#......~~..^^.XXf",
      "fh.#############LXXf",
      "fff.....fff....fXXff",
      "ffffffffffffffffffff",
    ],
  });

  add({
    id: 6, name: "Le Vieux Fort", ct: "The Fortress", difficulty: "normal", waves: 20, gold: 260, biome: "rocheux", mana: [[4, 1], [16, 1]], mill: [[10, 5], [11, 5], [10, 6], [11, 6]],
    grid: [
      "^^^HH^^^^ffff^^HH^^^",
      "^^^HH^^^......^^^^^.",
      "....................",
      "E###############....",
      "...............#....",
      "..~~....XXXXX..#..ff",
      "..~~.####LXXX..#..ff",
      ".....#..XXXXX..#....",
      ".ff..#.........#.^^.",
      ".ff..###########.^^.",
      "....................",
      "...~~.....ff....^^..",
      "...~~.....ff....^^..",
    ],
  });

  add({
    id: 7, name: "Les Yeux du serpent", ct: "Snake Eyes", difficulty: "normal", waves: 20, gold: 260, biome: "bocage", mana: [[7, 5], [7, 7]], mill: [[18, 5], [19, 5], [18, 6], [19, 6]],
    grid: [
      "ff....^^.......ff...",
      "E#####..^^......ff..",
      ".....#....######....",
      ".~~..#....#....#..f.",
      ".~~..######....#..f.",
      "..H.......^^...#..XX",
      "ff.........^^..##LXX",
      "..H.......^^...#..XX",
      ".~~..######....#..f.",
      ".~~..#....#....#..f.",
      ".....#....######....",
      "E#####..^^......ff..",
      "ff....^^.......ff...",
    ],
  });

  add({
    id: 8, name: "Le Labyrinthe de talus", ct: "The Maze", difficulty: "normal", waves: 30, gold: 300, biome: "bocage", mana: [[12, 0], [8, 6]], mill: [[0, 10], [1, 10], [0, 11], [1, 11]],
    grid: [
      "..ff....XX....^^..ff",
      "E#################..",
      "..^^..XX..~~..XX.#..",
      ".....hXX..~~....f#..",
      "..################..",
      "..#..XX...^^..XX....",
      "..#..XX.H.^^..XX..ff",
      "..################..",
      "..~~..XX..ff..XX.#..",
      "..~~..XX.....^^..#..",
      "XXL###############..",
      "XXX..ff......^^..ff.",
      "..ff..........^^....",
    ],
  });

  add({
    id: 9, name: "Le Carrefour", ct: "Crossroads", difficulty: "normal", waves: 30, gold: 300, biome: "marais", mana: [[2, 7], [17, 7]], mill: [[11, 11], [12, 11], [11, 12], [12, 12]],
    grid: [
      "..ff......E....ff...",
      "..^^......#.....^^..",
      "..^^.H....#....H^^..",
      "E##################E",
      "..........#.........",
      "......#########.....",
      "..ff..#~~~~~~~#..ff.",
      "..^^..#~~ww~~~#..^^.",
      "..^^..#~~~~~~~#..^^.",
      "......#~~~~~~~#.....",
      "..ff..#########..ff.",
      "ff........LXX.....ff",
      "ff.........XX......f",
    ],
  });

  add({
    id: 10, name: "L'Allée des chênes", ct: "Avenue", difficulty: "normal", waves: 30, gold: 320, biome: "bocage", mana: [[3, 0], [6, 9]], mill: [[0, 2], [1, 2], [0, 3], [1, 3]],
    grid: [
      "..^^^.....ff....~~..",
      "..^^^.....ff....~~..",
      "XXL#############....",
      "XX...........H.#....",
      "..~~..........f#..^^",
      "fffffffffffffff#..^^",
      "E###############..^^",
      "fffffffffffffff...ff",
      "..^^.........~~.....",
      "..^^..H......~~..ff.",
      "....................",
      "..~~......^^......ff",
      "..~~......^^......ff",
    ],
  });

  add({
    id: 11, name: "L'Hydre du marais", ct: "Hydra", difficulty: "difficile", waves: 40, gold: 350, biome: "marais", mana: [[5, 5], [13, 5]], mill: [[0, 10], [1, 10], [0, 11], [1, 11]],
    grid: [
      "ww.E.~~..E..~~.E.ww.",
      "w..#.~~..#..~~.#..w.",
      "...#.....#.....#....",
      "...#############....",
      ".~~......#.....~~...",
      ".~~..^^..#..^^.~~...",
      "....w^^..#..^^.~~...",
      "..H......#.......~~.",
      "~~.......##########E",
      "~~..^^...#....~~....",
      "XXL#######....~~.^^.",
      "XX..~~.ww.....~~....",
      "..~~~~....ww........",
    ],
  });

  add({
    id: 12, name: "La Percée", ct: "Break Through", difficulty: "difficile", waves: 40, gold: 350, biome: "rocheux", mana: [[2, 4], [17, 4]], mill: [[10, 11], [11, 11], [10, 12], [11, 12]],
    grid: [
      "r^^......ff......^^r",
      "rr^......ff......^rr",
      "E########..########E",
      "r^......#HH#......^r",
      "..~~....#HH#....~~..",
      "..~~....#..#....~~..",
      "....ff..####..ff....",
      "..^^.....#.....^^...",
      "..^^..H..#..H..^^...",
      ".......hh#hh........",
      "..ff.....#.....ff...",
      "..ff.....LXX...ff...",
      "..........XX........",
    ],
  });

  add({
    id: 13, name: "Le Manoir du Roi", ct: "Halls of the King", difficulty: "difficile", waves: 40, gold: 380, biome: "village", mana: [[6, 0], [18, 7]], mill: [[12, 4], [13, 4], [12, 5], [13, 5]],
    grid: [
      "..XX..^^....ff..XE..",
      "..XX..^^.........#..",
      "...........H...###..",
      ".XX.....########.XX.",
      ".XX.....#.XXXX.#.XX.",
      "........#.XXXX.#....",
      "..^^....####LX.#....",
      "..^^......XXXX.#.~~.",
      ".XX..H.......H.#.~~.",
      ".XX..###########....",
      ".....#....ff....XX..",
      "XX...#....ff..^^XX..",
      "XX...E....~~..^^....",
    ],
  });

  add({
    id: 14, name: "Le Passage secret", ct: "The Secret Passage", difficulty: "difficile", waves: 50, gold: 400, biome: "bocage", mana: [[2, 1], [19, 5]], secretWave: 25, mill: [[16, 0], [17, 0], [16, 1], [17, 1]],
    grid: [
      "..^^..ff....ff..XX..",
      "..^^..ff....ff..XX..",
      "......~~....H...L...",
      "..H...~~........#...",
      "..ff............#.^^",
      "...##############.^^",
      "...#..^^..ff....s...",
      "...#..^^..ff....s.~~",
      "...##############.~~",
      "..~~....H.....ff#...",
      "..~~..^^.......f#...",
      "E################...",
      "ff....^^....ff....ff",
    ],
  });

  add({
    id: 15, name: "La Bataille du Moulin", ct: "Battle City", difficulty: "difficile", waves: 50, gold: 450, biome: "village", mana: [[4, 1], [16, 1]], mill: [[10, 6], [11, 6], [10, 7], [11, 7]],
    grid: [
      "XX..^^..H.....^^..XX",
      "XX..^^..........^^XX",
      "..ff..XX....XX..ff..",
      "...##############...",
      "...#..XX..#..XX.#...",
      "...#..^^.~L..^^.#...",
      "~~~=~~~~~~XX~~~~=~~~",
      "~~~=~~~~~~XX~~~~=~~~",
      "...#..H..XX..H..#...",
      "...##############...",
      "ff.#.........#..#.ff",
      "E###....^^...#..###E",
      "XX..XX..^^...E..XXXX",
    ],
  });

})();
