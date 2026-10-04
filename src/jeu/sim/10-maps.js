// « Pas touche à mes trésors » — les quinze missions (PTMT.sim.MAPS[1..15]), sans THREE.
//
// Une carte = 20 × 13 cases décrites lettre par lettre (légende dans CONCEPTION.md §2 et
// DATA.TILES) : herbe « . » (sanglier), roche « ^ » (berger), eau « ~ » (cygne), butte « H »
// (les trois, souvent au milieu d'une route), cases boisées « f r w h » (à dégager avec Couper),
// chemin « # » (deux à quatre cases de large, comme dans Cursed Treasure), pont « = », entrées « E »
// au bord, cachettes « L » (blocs de 2 × 2), décor « X » (talus, rochers, maisons ; les six cases du
// moulin en font partie), passage secret « s » (fourré qui s'ouvre en chemin à la vague secretWave),
// estran « m » (marchable à marée basse seulement, toujours nageable), barrière « g » (entrée fermée
// qui cède à la vague dite dans gates).
//
// lairs : une entrée par bloc L (at = une case du bloc, gems = gemmes gardées, style = décor :
// moulin, puits, dolmen, chapelle) ; la première est la cachette principale, devant le moulin (mill :
// ses six cases X). mana : cases à menhir (puits de mana). tide : marée (cycle = vagues par demi-marée).
// gates : barrières et vague d'ouverture. decor : décor imposé pour certaines cases X.
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
    m.lairs = m.lairs || [{ at: null, gems: 5, style: "moulin" }];
    m.gems = m.lairs.reduce((a, L) => a + L.gems, 0);
    m.spells = SPELLS[m.id] || ["cut", "frenzy", "meteor"];
    m.decor = m.decor || {};
    M[m.id] = m;
  };
  // Décor des cases X hors moulin, selon le biome de la carte.
  S.DECOR_BY_BIOME = { bocage: "talus", rocheux: "boulders", marais: "pond_rocks", village: "house" };

  add({
    id: 1, name: "Le chemin du moulin", ct: "Basics", difficulty: "tutoriel", waves: 5, gold: 160, biome: "bocage", mana: [],
    lairs: [{ at: [16, 9], gems: 5, style: "moulin" }], mill: [[18, 8], [19, 8], [18, 9], [19, 9], [18, 10], [19, 10]],
    grid: [
      "ffff..fff^^ffff..fff",
      "E##############...ff",
      "E##############.^^.f",
      "E##############...ff",
      "ff..ff.^^..f###...ff",
      "ff.############..^^f",
      "fH.############....f",
      "ff.############.ff.f",
      "ff.###..~~..f..^^.XX",
      "ff.#############LLXX",
      "ff.#############LLXX",
      "ff.#############..ff",
      "fffff..fff^^ff..ffff",
    ],
  });

  add({
    id: 2, name: "Le Gué", ct: "Mission 2", difficulty: "facile", waves: 10, gold: 170, biome: "bocage", mana: [[9, 9]],
    lairs: [{ at: [3, 10], gems: 5, style: "moulin" }], mill: [[0, 10], [1, 10], [2, 10], [0, 11], [1, 11], [2, 11]],
    grid: [
      "..rr^.~w...f.f.EE...",
      ".frr^fw~..ffff.##..f",
      "...^..~~.f.....##...",
      ".#####==#########...",
      ".#####==#########^^.",
      ".##..f~~........^^^.",
      ".##f..~~.fH....r^^rr",
      ".#####==######..rrr^",
      "f#####==######.f^rf.",
      "f...f.ww...f##.f....",
      "XXXLL#==######....r.",
      "XXXLL#==######.f.^r.",
      "f.f...~w.frrrf...^.f",
    ],
  });

  add({
    id: 3, name: "Les Deux Prés", ct: "Mission 3", difficulty: "facile", waves: 15, gold: 200, biome: "bocage", mana: [[12, 4]],
    lairs: [{ at: [15, 9], gems: 5, style: "moulin" }], mill: [[17, 9], [18, 9], [19, 9], [17, 10], [18, 10], [19, 10]],
    grid: [
      ".....ff..EE....^.f..",
      "E######..##.f.^rr...",
      "E######..##.f^^^^fff",
      ".....##..##...^^^..f",
      "..##########...r..ff",
      "..##########f.ffw..f",
      ".f##...^...f.ffw~wf.",
      "f.##...^^......~ww..",
      ".f#############..f..",
      "f.######H######LLXXX",
      "..#############LLXXX",
      "f..fr^.......~....f.",
      ".ff.rrf.fff~~~ff...f",
    ],
  });

  add({
    id: 4, name: "La Croix", ct: "The Cross", difficulty: "facile", waves: 20, gold: 240, biome: "bocage", mana: [[6, 4], [12, 9]],
    lairs: [{ at: [2, 1], gems: 5, style: "moulin" }], mill: [[4, 1], [5, 1], [6, 1], [4, 2], [5, 2], [6, 2]],
    grid: [
      "ff.fff......ff..EE..",
      "..LLXXX.##########..",
      "..LLXXXf##########..",
      ".f###.f.###.^^^^^...",
      "..###f..###fr^^^^...",
      "..#################E",
      "..#######H#####H###E",
      "r^#################E",
      "r^^ff...###.^r^r^...",
      ".ff~~w~.###..^^r^..f",
      "ff.www~.##########.f",
      "ff.ww~w.##########f.",
      ".f..fff.....f...EE..",
    ],
  });

  add({
    id: 5, name: "Le Hallier", ct: "The Thicket", difficulty: "facile", waves: 20, gold: 260, biome: "bocage", mana: [[13, 4], [9, 9]],
    lairs: [{ at: [14, 10], gems: 5, style: "moulin" }], mill: [[16, 10], [17, 10], [18, 10], [16, 11], [17, 11], [18, 11]],
    grid: [
      "ffffffffwwffffffffff",
      "E############ffffrff",
      "E############f.ffff^",
      "fff.ff.f.f###fffrr^f",
      "ff^^ffff.f###.fffff.",
      "fww##########.fffff.",
      "fff#####H####..ffrrf",
      "f.f##########fffff.f",
      "ff.###ff.^^fff.ffrff",
      "fff###fff.fwff.f.fff",
      "ff.###########LLXXXf",
      "f.f###########LLXXXf",
      "ffffffffffffffffffff",
    ],
  });

  add({
    id: 6, name: "Le Vieux Fort", ct: "The Fortress", difficulty: "normal", waves: 20, gold: 280, biome: "rocheux", mana: [[9, 6], [17, 10]],
    lairs: [{ at: [15, 8], gems: 5, style: "moulin" }], mill: [[17, 8], [18, 8], [19, 8], [17, 9], [18, 9], [19, 9]], tide: { cycle: 3 },
    grid: [
      "^^^rr^^^f.f^H^^^^f..",
      "^^^^^r^^^f^^^^^^^...",
      "^################..^",
      "^################rr^",
      "^###^r^^f..^^r^##^^r",
      "^###rr^.fH..r^r##~^^",
      "^###^^^.....^^^##~r^",
      "^###^^rrf.fr^^^##^^^",
      "^###mmmmmmmmmmmLLXXX",
      "^###mmmmmmmmmmmLLXXX",
      "E###~w~w~w~~~~~^^...",
      "E###~w~ww~w~w~~rr...",
      "^^^^www~~w~ww~~^^.f.",
    ],
  });

  add({
    id: 7, name: "Les Yeux du serpent", ct: "Snake Eyes", difficulty: "normal", waves: 20, gold: 300, biome: "bocage", mana: [[6, 6], [17, 7]],
    lairs: [{ at: [15, 2], gems: 3, style: "moulin" }, { at: [15, 9], gems: 2, style: "puits" }], mill: [[17, 2], [18, 2], [19, 2], [17, 3], [18, 3], [19, 3]],
    grid: [
      ".EEf.f..f.f.ff..ff..",
      ".#########..f..ff..f",
      ".#########..###LLXXX",
      ".ff.....##..###LLXXX",
      "..f.....##^f###..f.f",
      "...~w~..######.^^^^f",
      "...~ww.f###H##.rHrr.",
      "fff.w~~.######.^r.r.",
      ".ffff...##f.###.....",
      "..f.....##^r###LL.ff",
      ".#########r^###LLfff",
      "f#########.f..f...r.",
      ".EE..ff...ff..f.f.^.",
    ],
  });

  add({
    id: 8, name: "Le Labyrinthe de talus", ct: "The Maze", difficulty: "normal", waves: 30, gold: 320, biome: "bocage", mana: [[9, 8], [5, 4]],
    lairs: [{ at: [13, 9], gems: 5, style: "moulin" }], mill: [[15, 9], [16, 9], [17, 9], [15, 10], [16, 10], [17, 10]], gates: [{ at: [19, 3], wave: 18 }],
    grid: [
      "ff^^ffXXffff^^ffffff",
      "E#################.f",
      "E#################^f",
      "ff..XX..^^ff.XX.###g",
      "f.f^^.ff..H.f.ff###g",
      "ff################ff",
      "f.################.f",
      "f.##.ff^^XX..ff..XXf",
      "ff##^^.f..~~.^^.f.ff",
      "f.###########LLXXX.f",
      "f.###########LLXXXff",
      "X#############.^^.ff",
      "X#############f.^^ff",
    ],
  });

  add({
    id: 9, name: "Le Carrefour", ct: "Crossroads", difficulty: "normal", waves: 30, gold: 340, biome: "marais", mana: [[14, 5], [5, 5]],
    lairs: [{ at: [16, 9], gems: 3, style: "moulin" }, { at: [0, 1], gems: 2, style: "dolmen" }], mill: [[16, 11], [17, 11], [18, 11], [16, 12], [17, 12], [18, 12]],
    grid: [
      "..f.f..f..f..~~f.EEf",
      "LL#########.~~~w.##f",
      "LL#########..~~f.##.",
      "..~~.f..###########f",
      "..w~f^^.###########f",
      "f.ww..^.#H#.f...^r..",
      "f.~~f...########^rr.",
      "E############H##..ff",
      "E###############....",
      "..f.....#####.##LLf.",
      "f.f.########..##LL.f",
      "..f.########....XXX.",
      "f.ffEE^r...ffff.XXX.",
    ],
  });

  add({
    id: 10, name: "L'Allée des chênes", ct: "Avenue", difficulty: "normal", waves: 30, gold: 360, biome: "bocage", mana: [[11, 7], [6, 12]],
    lairs: [{ at: [1, 9], gems: 3, style: "moulin" }, { at: [7, 5], gems: 2, style: "chapelle" }], mill: [[0, 11], [1, 11], [2, 11], [0, 12], [1, 12], [2, 12]],
    grid: [
      "...f...f.....f.....f",
      "E################..f",
      "E#####H#####H####...",
      "E################.ff",
      "f.......f..f..###f..",
      "...f~w.LL########f^f",
      "f..www.LL########^rr",
      "ff.~~...r^^.f.###^r^",
      "......f.^^^...###fr.",
      ".LL##############ff.",
      "fLL######H#######fff",
      "XXX##############..f",
      "XXX.........w~......",
    ],
  });

  add({
    id: 11, name: "L'Hydre du marais", ct: "Hydra", difficulty: "difficile", waves: 40, gold: 380, biome: "marais", mana: [[6, 8], [13, 9]],
    lairs: [{ at: [11, 4], gems: 3, style: "moulin" }, { at: [11, 7], gems: 2, style: "chapelle" }], mill: [[13, 3], [14, 3], [13, 4], [14, 4], [13, 5], [14, 5]],
    grid: [
      "~~~~~~~~~~w~wEE~~w~~",
      "~~w###H##########w~w",
      "www##############~~~",
      "~~~##^.~~....XX##~~w",
      "~~~##^.####LLXX####E",
      "~w~##..####LLXX####E",
      "..f########...f##~.~",
      "fff##f.####LL..##~..",
      "w~w##..####LL..####E",
      "~w~##...^r.....####E",
      "www########H#####~~~",
      "w~~##############~~~",
      "ww~~~~~~~^^~~EEww~w~",
    ],
  });

  add({
    id: 12, name: "La Percée", ct: "Break Through", difficulty: "difficile", waves: 40, gold: 400, biome: "rocheux", mana: [[14, 4], [6, 8]],
    lairs: [{ at: [9, 5], gems: 5, style: "moulin" }], mill: [[11, 5], [12, 5], [13, 5], [11, 6], [12, 6], [13, 6]],
    grid: [
      "^^^rr^^^^^^^r^r^r^r^",
      "r^########H########E",
      "^r#################E",
      "r^##^r~~r^r^^f.fr^^^",
      "^^##^r~~^^^^...fr^^^",
      "r^#######LLXXX..r^r^",
      "r^#######LLXXXr^r...",
      "r.^^^^.^r#########.f",
      "f.^rr..fr#########r^",
      "^.^r^...^^^^^^^r##^^",
      "E#####H######H####^^",
      "E#################^^",
      "^^^^^^r^^^^^^^^^^^^^",
    ],
  });

  add({
    id: 13, name: "Le Manoir du Roi", ct: "Halls of the King", difficulty: "difficile", waves: 40, gold: 420, biome: "village", mana: [[7, 8], [16, 5]],
    lairs: [{ at: [10, 6], gems: 3, style: "moulin" }, { at: [1, 2], gems: 2, style: "chapelle" }], mill: [[10, 4], [11, 4], [12, 4], [10, 5], [11, 5], [12, 5]], gates: [{ at: [0, 5], wave: 22 }],
    grid: [
      "f..XX.fffw.f.ff..EE.",
      "f........~.......##.",
      ".LL################f",
      ".LL################.",
      "....f##..HXXX##....X",
      "g######.##XXX##..r^X",
      "g#########LLX##.Xrr^",
      "f....#####LLX##.fr^X",
      "..XH.##.##^^X##.....",
      "f^^..##############.",
      "^^^..##############.",
      "f^rff..X.f^.ff.f.##.",
      "XX.f...f.^^^X..X.EEf",
    ],
  });

  add({
    id: 14, name: "Le Passage secret", ct: "The Secret Passage", difficulty: "difficile", waves: 50, gold: 450, biome: "bocage", mana: [[14, 4], [7, 7]],
    lairs: [{ at: [9, 5], gems: 3, style: "moulin" }, { at: [2, 1], gems: 2, style: "dolmen" }], mill: [[9, 3], [10, 3], [11, 3], [9, 4], [10, 4], [11, 4]], secretWave: 25,
    grid: [
      "f...........f......f",
      "..LL######H#######f.",
      "f.LL##############ff",
      ".......f.XXX##.f##f.",
      ".f.f.^f.fXXX##.f##.f",
      ".f..^^^..LL###f.##..",
      ".ff.^r^..LL###~~##^r",
      "ff..rrr..ss...~~##ff",
      ".........ss.....##..",
      "E#################.f",
      "E#####H######H####..",
      "E#################.f",
      "......^r^.f........f",
    ],
  });

  add({
    id: 15, name: "La Bataille du Moulin", ct: "Battle City", difficulty: "difficile", waves: 50, gold: 480, biome: "village", mana: [[12, 8], [2, 4], [17, 3]],
    lairs: [{ at: [10, 3], gems: 2, style: "moulin" }, { at: [0, 1], gems: 2, style: "puits" }, { at: [18, 1], gems: 1, style: "chapelle" }], mill: [[12, 3], [13, 3], [12, 4], [13, 4], [12, 5], [13, 5]], tide: { cycle: 4 }, gates: [{ at: [19, 9], wave: 25 }],
    grid: [
      ".f.f.f....^.........",
      "LL########H#######LL",
      "LL################LL",
      ".^..##.##fLLXX##....",
      ".^..##.##.LLXX##frf.",
      "..r.##.##fffXX##^^..",
      "~w~~==~mm~~w~~==~w~~",
      "~w~~==~mm~~ww~==~w~~",
      ".ff.##.##.....##ff..",
      "E##################g",
      "E####H#######H#####g",
      "E##################g",
      "....^^...EE.f.^^.f..",
    ],
  });
})();
