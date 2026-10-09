// Moulin V32 — clairières : moins d'arbres là où le terrain est ouvert en réalité.
//
// Sur les collines, la forêt montait trop haut avant les champs. La couverture du sol
// réelle (ESA WorldCover 10 m, via Overture Maps, recalée sur les étangs du plan) montre
// des pentes en friche et en prairie entre le bois et les champs du haut. Les arbres de
// la scène qui tombent dans ces zones sont retirés (tous dans les champs, environ deux
// sur trois dans les friches, pour garder des bosquets et des haies), sauf dans le jardin
// (45 m autour du moulin) et pour les arbres remarquables. La liste est calculée une fois
// (identifiants des arbres d'origine) : un arbre planté ou déplacé dans l'atelier n'est
// pas concerné.
(function () {
  "use strict";
  const V32 = globalThis.MoulinV32;
  const OPEN_LAND = [
    "arbre-10", "arbre-1022", "arbre-106", "arbre-107", "arbre-1072", "arbre-108", "arbre-109", "arbre-11", "arbre-111", "arbre-1118",
    "arbre-112", "arbre-1138", "arbre-1139", "arbre-1140", "arbre-1141", "arbre-1142", "arbre-1143", "arbre-1144", "arbre-1145", "arbre-1146",
    "arbre-1147", "arbre-1148", "arbre-115", "arbre-1166", "arbre-1185", "arbre-1186", "arbre-1187", "arbre-12", "arbre-1202", "arbre-1203",
    "arbre-1220", "arbre-1221", "arbre-1222", "arbre-1233", "arbre-1249", "arbre-1251", "arbre-1252", "arbre-1253", "arbre-1254", "arbre-131",
    "arbre-132", "arbre-133", "arbre-143", "arbre-144", "arbre-145", "arbre-146", "arbre-147", "arbre-15", "arbre-150", "arbre-151",
    "arbre-152", "arbre-153", "arbre-154", "arbre-155", "arbre-162", "arbre-163", "arbre-164", "arbre-166", "arbre-170", "arbre-171",
    "arbre-178", "arbre-179", "arbre-18", "arbre-180", "arbre-182", "arbre-183", "arbre-185", "arbre-186", "arbre-19", "arbre-191",
    "arbre-192", "arbre-193", "arbre-194", "arbre-198", "arbre-199", "arbre-2", "arbre-200", "arbre-202", "arbre-203", "arbre-204",
    "arbre-205", "arbre-211", "arbre-212", "arbre-213", "arbre-214", "arbre-216", "arbre-217", "arbre-22", "arbre-23", "arbre-238",
    "arbre-240", "arbre-241", "arbre-25", "arbre-26", "arbre-263", "arbre-264", "arbre-265", "arbre-267", "arbre-28", "arbre-294",
    "arbre-295", "arbre-296", "arbre-297", "arbre-298", "arbre-299", "arbre-3", "arbre-30", "arbre-300", "arbre-322", "arbre-323",
    "arbre-324", "arbre-325", "arbre-327", "arbre-349", "arbre-351", "arbre-352", "arbre-353", "arbre-376", "arbre-378", "arbre-379",
    "arbre-38", "arbre-381", "arbre-4", "arbre-401", "arbre-403", "arbre-404", "arbre-428", "arbre-429", "arbre-430", "arbre-456",
    "arbre-47", "arbre-48", "arbre-480", "arbre-481", "arbre-5", "arbre-505", "arbre-51", "arbre-52", "arbre-533", "arbre-617",
    "arbre-618", "arbre-619", "arbre-62", "arbre-63", "arbre-64", "arbre-642", "arbre-66", "arbre-669", "arbre-67", "arbre-7",
    "arbre-749", "arbre-8", "arbre-81", "arbre-82", "arbre-84", "arbre-85", "arbre-86", "arbre-89", "arbre-9002", "arbre-9003",
    "arbre-9004", "arbre-9005", "arbre-9006", "arbre-9007",
  ];
  V32.clearings32 = new Set(OPEN_LAND);
})();
