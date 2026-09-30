// « Pas touche à mes trésors » — grille de la carte et champs de distance (PTMT.sim.Grid), sans THREE.
//
// Les ennemis vont de centre de case en centre de case (4 voisins) en descendant un « champ de
// distance » calculé en largeur depuis leur but : le repaire, une gemme au sol ou les sorties. Deux
// familles de champs : à pied (chemins, ponts, entrées, repaire) et à la nage (les mêmes cases plus
// l'eau et les roseaux : canards). Les champs sont recalculés quand la carte change (passage secret
// ouvert) et mis en cache par case d'arrivée pour les gemmes tombées.
(function () {
  "use strict";
  const PTMT = (globalThis.PTMT = globalThis.PTMT || {});
  const S = (PTMT.sim = PTMT.sim || {});
  const D = S.DATA;

  const FAR = 1e9;
  const DIRS = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  class Grid {
    constructor(map) {
      this.w = D.W;
      this.h = D.H;
      this.rows = map.grid.map((r) => r.split(""));
      if (this.rows.length !== this.h || this.rows.some((r) => r.length !== this.w)) throw new Error("Carte " + map.id + " : dimensions incorrectes");
      this.entrances = [];
      this.lair = null;
      for (let j = 0; j < this.h; j++)
        for (let i = 0; i < this.w; i++) {
          const c = this.rows[j][i];
          if (c === "E") this.entrances.push({ id: this.entrances.length, i, j });
          else if (c === "L") this.lair = { i, j };
        }
      if (!this.lair || !this.entrances.length) throw new Error("Carte " + map.id + " : repaire ou entrée manquant");
      this.mana = new Set((map.mana || []).map(([i, j]) => j * this.w + i));
      this.version = 0;
      this.cache = new Map();
    }
    inside(i, j) {
      return i >= 0 && j >= 0 && i < this.w && j < this.h;
    }
    char(i, j) {
      return this.inside(i, j) ? this.rows[j][i] : "X";
    }
    tile(i, j) {
      return D.TILES[this.char(i, j)] || D.TILES.X;
    }
    walkable(i, j) {
      return !!this.tile(i, j).walk;
    }
    swimmable(i, j) {
      const t = this.tile(i, j);
      return !!(t.walk || t.swim);
    }
    set(i, j, c) {
      this.rows[j][i] = c;
      this.version++;
      this.cache.clear();
    }
    /** Grille actuelle sous forme de chaînes (pour le rendu). */
    lines() {
      return this.rows.map((r) => r.join(""));
    }
    /** Champ de distance (en cases) depuis une ou plusieurs cases sources ; swim : canards. */
    field(key, sources, swim) {
      const k = key + (swim ? ":n" : ":p");
      let f = this.cache.get(k);
      if (f) return f;
      f = new Float64Array(this.w * this.h).fill(FAR);
      const q = [];
      const ok = swim ? (i, j) => this.swimmable(i, j) : (i, j) => this.walkable(i, j);
      for (const [i, j] of sources) {
        if (!this.inside(i, j)) continue;
        f[j * this.w + i] = 0;
        q.push(i, j);
      }
      for (let h = 0; h < q.length; h += 2) {
        const i = q[h],
          j = q[h + 1],
          d = f[j * this.w + i] + 1;
        for (const [dx, dy] of DIRS) {
          const a = i + dx,
            b = j + dy;
          if (!this.inside(a, b) || !ok(a, b)) continue;
          const n = b * this.w + a;
          if (f[n] <= d) continue;
          f[n] = d;
          q.push(a, b);
        }
      }
      this.cache.set(k, f);
      return f;
    }
    toLair(swim) {
      return this.field("lair", [[this.lair.i, this.lair.j]], swim);
    }
    toExit(swim) {
      return this.field(
        "exit",
        this.entrances.map((e) => [e.i, e.j]),
        swim,
      );
    }
    toTile(i, j, swim) {
      return this.field("t" + i + "," + j, [[i, j]], swim);
    }
    at(f, i, j) {
      return this.inside(i, j) ? f[j * this.w + i] : FAR;
    }
    /** Case voisine qui rapproche le plus du but (null si aucune) ; préfère continuer tout droit. */
    step(f, i, j, swim, pdx, pdy) {
      let best = null,
        bestD = this.at(f, i, j);
      for (const [dx, dy] of DIRS) {
        const a = i + dx,
          b = j + dy;
        if (!this.inside(a, b)) continue;
        if (!(swim ? this.swimmable(a, b) : this.walkable(a, b))) continue;
        const d = f[b * this.w + a] - (dx === pdx && dy === pdy ? 0.01 : 0);
        if (d < bestD) {
          bestD = d;
          best = [a, b];
        }
      }
      return best;
    }
    /** Case marchable la plus proche (pour une gemme tombée dans l'eau). */
    nearestWalkable(i, j) {
      if (this.walkable(i, j)) return [i, j];
      let best = null,
        bestD = FAR;
      for (let b = 0; b < this.h; b++)
        for (let a = 0; a < this.w; a++) {
          if (!this.walkable(a, b)) continue;
          const d = (a - i) * (a - i) + (b - j) * (b - j);
          if (d < bestD) {
            bestD = d;
            best = [a, b];
          }
        }
      return best;
    }
  }
  Grid.FAR = FAR;
  S.Grid = Grid;
})();
