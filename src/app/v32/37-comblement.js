// Moulin V32 — comblement de l'ancien lit de la rivière amont.
//
// Le relief du plan gardait, dans le pré de l'est, le lit d'un ancien tracé de la rivière : une
// tranchée sèche d'un mètre de profond et de trois à cinq mètres de large, de (168, −13) à
// (123, −10), une dizaine de mètres au sud de la rivière actuelle. Elle ne sert à rien : on la
// comble au niveau de ses berges, avant le recalage du relief et la construction du maillage.
// Le lit de la rivière actuelle, les étangs et le reste du pré ne bougent pas.
(function () {
  "use strict";
  const V32 = globalThis.MoulinV32;
  // Axe de la tranchée (x, z) et niveau de ses berges (m) ; aux deux bouts elle rejoint la
  // prairie basse du bord de rivière : le comblement s'y éteint.
  const LINE = [
    [168.5, -13.5, 0.15], [171, -10.2, 0.85], [171.5, -7.5, 1.1], [169, -5.4, 1.25], [166, -4, 1.25], [162, -2.7, 1.25], [155, -2, 1.25], [146, -2, 1.2],
    [141.5, -2.8, 1.2], [138, -4, 1.15], [134.5, -5, 1.1], [131.5, -6, 1.0], [129, -7, 0.95], [126.5, -8, 0.85], [124.2, -9.2, 0.75], [123.3, -10.8, 0.25],
  ];
  const FULL = 3.2, FADE = 6.2; // comblé jusqu'à 3,2 m de l'axe, raccord en douceur jusqu'à 6,2 m
  const BOX = { x0: 115, x1: 180, z0: -22, z1: 6 };

  /** Niveau de comblement en (x, z) et poids (0…1) ; null loin de la tranchée. */
  function fillAt(x, z) {
    if (x < BOX.x0 || x > BOX.x1 || z < BOX.z0 || z > BOX.z1) return null;
    let best = Infinity, level = 0;
    for (let i = 0; i < LINE.length - 1; i++) {
      const a = LINE[i], b = LINE[i + 1], dx = b[0] - a[0], dz = b[1] - a[1];
      const k = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
      const d = Math.hypot(x - a[0] - k * dx, z - a[1] - k * dz);
      if (d < best) {
        best = d;
        level = a[2] + (b[2] - a[2]) * k;
      }
    }
    if (best >= FADE) return null;
    const t = best <= FULL ? 1 : 1 - (best - FULL) / (FADE - FULL);
    return { level, weight: t * t * (3 - 2 * t) };
  }

  V32.comblement32 = {
    fillAt,
    /** Relève les sommets du terrain dans la tranchée (jamais l'inverse). positions : x, y, z. */
    reshape({ positions }) {
      let moved = 0;
      for (let v = 0; v < positions.length; v += 3) {
        const f = fillAt(positions[v], positions[v + 2]);
        if (!f) continue;
        const y = positions[v + 1];
        if (f.level <= y) continue;
        positions[v + 1] = y + (f.level - y) * f.weight;
        moved++;
      }
      return moved;
    },
  };
})();
