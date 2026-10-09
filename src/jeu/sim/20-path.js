// « Pas touche à mes trésors » — grille de la carte et champs d'écoulement (PTMT.sim.Grid), sans THREE.
//
// Les ennemis se déplacent librement (positions continues) en suivant un « champ d'écoulement » vers
// leur but : distances calculées à 8 voisins (Dijkstra, diagonales sans couper les coins) depuis la
// cachette, une gemme au sol ou les sorties, et, pour chaque case, la direction de la plus forte pente.
// Chaque champ garde aussi, par case, la largeur libre de part et d'autre de la direction d'écoulement :
// c'est ce qui permet à un ennemi de garder sa « voie » (au milieu, ou le long d'un bord) dans une
// route large. Deux modes de passage : à pied (routes, ponts, entrées, cachettes, estran à marée
// basse) et à la nage (en plus : eau, roseaux, estran). Les champs sont mis en cache et recalculés
// quand la carte change (coupe, passage secret, barrière, marée).
(function () {
  "use strict";
  const PTMT = (globalThis.PTMT = globalThis.PTMT || {});
  const S = (PTMT.sim = PTMT.sim || {});
  const D = S.DATA;

  const FAR = 1e9;
  const SQ2 = Math.SQRT2;
  const DIRS8 = [
    [1, 0, 1],
    [-1, 0, 1],
    [0, 1, 1],
    [0, -1, 1],
    [1, 1, SQ2],
    [1, -1, SQ2],
    [-1, 1, SQ2],
    [-1, -1, SQ2],
  ];

  /** Petit tas binaire (distances de Dijkstra). */
  class Heap {
    constructor() {
      this.k = [];
      this.v = [];
    }
    push(key, val) {
      const k = this.k,
        v = this.v;
      let i = k.length;
      k.push(key);
      v.push(val);
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (k[p] <= key) break;
        k[i] = k[p];
        v[i] = v[p];
        i = p;
      }
      k[i] = key;
      v[i] = val;
    }
    pop() {
      const k = this.k,
        v = this.v;
      const topK = k[0],
        topV = v[0];
      const lastK = k.pop(),
        lastV = v.pop();
      if (k.length) {
        let i = 0;
        const n = k.length;
        for (;;) {
          let c = 2 * i + 1;
          if (c >= n) break;
          if (c + 1 < n && k[c + 1] < k[c]) c++;
          if (k[c] >= lastK) break;
          k[i] = k[c];
          v[i] = v[c];
          i = c;
        }
        k[i] = lastK;
        v[i] = lastV;
      }
      this.topK = topK;
      return topV;
    }
    get size() {
      return this.k.length;
    }
  }

  /** Composantes connexes (4 voisins) des cases dont le caractère vérifie test(c). */
  function components(rows, w, h, test) {
    const seen = new Uint8Array(w * h);
    const out = [];
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        if (seen[j * w + i] || !test(rows[j][i])) continue;
        const tiles = [];
        const q = [[i, j]];
        seen[j * w + i] = 1;
        while (q.length) {
          const [a, b] = q.pop();
          tiles.push([a, b]);
          for (const [dx, dy] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ]) {
            const x = a + dx,
              y = b + dy;
            if (x < 0 || y < 0 || x >= w || y >= h || seen[y * w + x] || !test(rows[y][x])) continue;
            seen[y * w + x] = 1;
            q.push([x, y]);
          }
        }
        tiles.sort((p, q2) => p[1] - q2[1] || p[0] - q2[0]);
        out.push(tiles);
      }
    return out;
  }

  class Grid {
    constructor(map) {
      this.w = D.W;
      this.h = D.H;
      this.rows = map.grid.map((r) => r.split(""));
      if (this.rows.length !== this.h || this.rows.some((r) => r.length !== this.w)) throw new Error("Carte " + map.id + " : dimensions incorrectes");
      this.lowTide = false;
      this.version = 0;
      this.cache = new Map();
      this.mana = new Set((map.mana || []).map(([i, j]) => j * this.w + i));

      // Entrées : groupes de cases E (ouvertes) ou g (barrières, ouvertes plus tard), au bord de la carte.
      const gates = map.gates || [];
      this.entrances = components(this.rows, this.w, this.h, (c) => c === "E" || c === "g").map((tiles, id) => {
        const closed = tiles.some(([i, j]) => this.rows[j][i] === "g");
        const gate = closed ? gates.find((g) => tiles.some(([i, j]) => i === g.at[0] && j === g.at[1])) : null;
        const x = tiles.reduce((a, t) => a + t[0] + 0.5, 0) / tiles.length;
        const y = tiles.reduce((a, t) => a + t[1] + 0.5, 0) / tiles.length;
        // Direction vers l'intérieur de la carte (angle monde : 0 = +y, π/2 = +x).
        const [i0, j0] = tiles[0];
        const dir = i0 === 0 ? Math.PI / 2 : i0 === this.w - 1 ? -Math.PI / 2 : j0 === 0 ? 0 : Math.PI;
        const meta = D.ENTRANCES[id % D.ENTRANCES.length];
        return { id, letter: meta.letter, color: meta.color, tiles, x, y, dir, open: !closed, opensAt: closed ? (gate ? gate.wave : 1e9) : 0 };
      });
      if (!this.entrances.some((e) => e.open)) throw new Error("Carte " + map.id + " : aucune entrée ouverte");

      // Cachettes : blocs de cases L ; la carte dit combien de gemmes chacune garde et son décor.
      const comps = components(this.rows, this.w, this.h, (c) => c === "L");
      if (!comps.length) throw new Error("Carte " + map.id + " : aucune cachette");
      const defs = map.lairs && map.lairs.length ? map.lairs : [{ at: comps[0][0], gems: map.gems || 5, style: "moulin" }];
      this.lairs = defs.map((def, id) => {
        const tiles = comps.find((c) => c.some(([i, j]) => i === def.at[0] && j === def.at[1]));
        if (!tiles) throw new Error("Carte " + map.id + " : cachette introuvable en " + def.at);
        const x = tiles.reduce((a, t) => a + t[0] + 0.5, 0) / tiles.length;
        const y = tiles.reduce((a, t) => a + t[1] + 0.5, 0) / tiles.length;
        const style = def.style || (id === 0 ? "moulin" : "puits");
        return { id, tiles, x, y, gems: def.gems, style, name: def.name || D.LAIR_NAMES[style] || "La cachette", mill: style === "moulin" };
      });
      if (this.lairs.length !== comps.length) throw new Error("Carte " + map.id + " : chaque bloc L doit être décrit dans lairs");
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
    /** Case praticable selon le mode : "walk" (à pied) ou "swim" (nageurs). */
    passable(i, j, mode) {
      if (!this.inside(i, j)) return false;
      const t = this.tile(i, j);
      if (t.tide) return mode === "swim" || this.lowTide;
      return mode === "swim" ? !!(t.walk || t.swim) : !!t.walk;
    }
    walkable(i, j) {
      return this.passable(i, j, "walk");
    }
    swimmable(i, j) {
      return this.passable(i, j, "swim");
    }
    set(i, j, c) {
      this.rows[j][i] = c;
      this.touch();
    }
    /** La carte a changé : les champs sont à recalculer. */
    touch() {
      this.version++;
      this.cache.clear();
    }
    setTide(low) {
      if (this.lowTide === !!low) return false;
      this.lowTide = !!low;
      this.touch();
      return true;
    }
    lines() {
      return this.rows.map((r) => r.join(""));
    }
    openEntrances() {
      return this.entrances.filter((e) => e.open);
    }

    /**
     * Champ d'écoulement vers des cases sources : { D (distances), F (directions, 2 par case),
     * Lp / Ln (largeur libre de chaque côté de la direction), cx, cy (centre des sources) }.
     */
    field(key, sources, mode) {
      const k = key + ":" + mode;
      let f = this.cache.get(k);
      if (f) return f;
      const w = this.w,
        h = this.h,
        N = w * h;
      // Distances par « marche rapide » (équation eikonale, 4 voisins) : proches de la vraie distance
      // le long du chemin, sans le biais des diagonales d'un Dijkstra à 8 voisins. Dans une route
      // droite, la pente suit donc l'axe de la route et les voies restent parallèles aux bords.
      const Dist = new Float32Array(N).fill(FAR);
      const done = new Uint8Array(N);
      const heap = new Heap();
      let cx = 0,
        cy = 0,
        ns = 0;
      for (const [i, j] of sources) {
        if (!this.passable(i, j, mode)) continue;
        Dist[j * w + i] = 0;
        heap.push(0, j * w + i);
        cx += i + 0.5;
        cy += j + 0.5;
        ns++;
      }
      if (ns) {
        cx /= ns;
        cy /= ns;
      }
      const known = (n, ok) => (ok && done[n] ? Dist[n] : FAR);
      while (heap.size) {
        const idx = heap.pop();
        if (done[idx]) continue;
        done[idx] = 1;
        const i = idx % w,
          j = (idx / w) | 0;
        for (let k = 0; k < 4; k++) {
          const a = i + DIRS8[k][0],
            b = j + DIRS8[k][1];
          if (!this.passable(a, b, mode)) continue;
          const n = b * w + a;
          if (done[n]) continue;
          const tx = Math.min(known(n - 1, a > 0), known(n + 1, a < w - 1));
          const ty = Math.min(known(n - w, b > 0), known(n + w, b < h - 1));
          const t = Math.fround(Math.abs(tx - ty) >= 1 ? Math.min(tx, ty) + 1 : (tx + ty + Math.sqrt(2 - (tx - ty) * (tx - ty))) / 2);
          if (t < Dist[n]) {
            Dist[n] = t;
            heap.push(t, n);
          }
        }
      }
      // Directions : pente descendante (différences centrées, d'un seul côté le long d'un bord) ; si
      // elle pointe dans un talus (angle intérieur d'un virage), la case voisine la plus basse.
      const F = new Float32Array(N * 2);
      const val = (a, b) => (this.passable(a, b, mode) ? Dist[b * w + a] : FAR);
      for (let idx = 0; idx < N; idx++) {
        const d0 = Dist[idx];
        if (d0 >= FAR) continue;
        const i = idx % w,
          j = (idx / w) | 0;
        let vx = 0,
          vy = 0;
        if (d0 === 0) {
          vx = cx - (i + 0.5);
          vy = cy - (j + 0.5);
        } else {
          const l = val(i - 1, j),
            r = val(i + 1, j),
            u = val(i, j - 1),
            dn = val(i, j + 1);
          vx = l < FAR && r < FAR ? (l - r) / 2 : l < FAR ? l - d0 : r < FAR ? d0 - r : 0;
          vy = u < FAR && dn < FAR ? (u - dn) / 2 : u < FAR ? u - d0 : dn < FAR ? d0 - dn : 0;
          const len = Math.hypot(vx, vy);
          const ahead = len > 1e-6 && this.passable(Math.floor(i + 0.5 + (vx / len) * 0.75), Math.floor(j + 0.5 + (vy / len) * 0.75), mode);
          if (!ahead) {
            let best = 0;
            vx = vy = 0;
            for (const [dx, dy, c] of DIRS8) {
              const a = i + dx,
                b = j + dy;
              if (!this.passable(a, b, mode)) continue;
              if (dx && dy && (!this.passable(i + dx, j, mode) || !this.passable(i, j + dy, mode))) continue;
              const drop = (d0 - Dist[b * w + a]) / c;
              if (drop > best) {
                best = drop;
                vx = dx;
                vy = dy;
              }
            }
          }
        }
        const l = Math.hypot(vx, vy);
        if (l > 1e-6) {
          F[idx * 2] = vx / l;
          F[idx * 2 + 1] = vy / l;
        }
      }
      // Largeur libre de part et d'autre de la direction (normale n = (−fy, fx)).
      const Lp = new Float32Array(N),
        Ln = new Float32Array(N);
      for (let idx = 0; idx < N; idx++) {
        if (Dist[idx] >= FAR) continue;
        const fx = F[idx * 2],
          fy = F[idx * 2 + 1];
        if (!fx && !fy) {
          Lp[idx] = Ln[idx] = 0.5;
          continue;
        }
        const x0 = (idx % w) + 0.5,
          y0 = ((idx / w) | 0) + 0.5;
        Lp[idx] = this.march(x0, y0, -fy, fx, mode);
        Ln[idx] = this.march(x0, y0, fy, -fx, mode);
      }
      f = { key: k, D: Dist, F, Lp, Ln, cx, cy, mode };
      this.cache.set(k, f);
      return f;
    }
    /** Distance libre depuis (x, y) dans la direction (dx, dy), par pas de 0,2 case, jusqu'à 4 cases. */
    march(x, y, dx, dy, mode) {
      let t = 0;
      for (let s = 0.2; s <= 4; s += 0.2) {
        if (!this.passable(Math.floor(x + dx * s), Math.floor(y + dy * s), mode)) break;
        t = s;
      }
      return t + 0.1;
    }
    toLair(id, mode) {
      const L = this.lairs[id];
      return this.field("lair" + id, L.tiles, mode);
    }
    toExit(mode) {
      const tiles = [];
      for (const e of this.entrances) if (e.open) tiles.push(...e.tiles);
      return this.field("exit", tiles, mode);
    }
    toTile(i, j, mode) {
      return this.field("t" + i + "," + j, [[i, j]], mode);
    }
    at(f, i, j) {
      return this.inside(i, j) ? f.D[j * this.w + i] : FAR;
    }
    /** Direction d'écoulement interpolée en (x, y) (cases continues) ; out = {x, y}, renvoie false si aucune. */
    flowAt(f, x, y, out) {
      const w = this.w;
      const u = x - 0.5,
        v = y - 0.5;
      const i0 = Math.floor(u),
        j0 = Math.floor(v);
      const fx = u - i0,
        fy = v - j0;
      let sx = 0,
        sy = 0,
        sw = 0;
      for (let dj = 0; dj < 2; dj++)
        for (let di = 0; di < 2; di++) {
          const i = i0 + di,
            j = j0 + dj;
          if (!this.inside(i, j)) continue;
          const idx = j * w + i;
          if (f.D[idx] >= FAR) continue;
          const wt = (di ? fx : 1 - fx) * (dj ? fy : 1 - fy);
          sx += f.F[idx * 2] * wt;
          sy += f.F[idx * 2 + 1] * wt;
          sw += wt;
        }
      if (sw < 1e-4) {
        const i = Math.floor(x),
          j = Math.floor(y);
        if (!this.inside(i, j)) return false;
        const idx = j * w + i;
        sx = f.F[idx * 2];
        sy = f.F[idx * 2 + 1];
      }
      const l = Math.hypot(sx, sy);
      if (l < 1e-5) return false;
      out.x = sx / l;
      out.y = sy / l;
      return true;
    }
    /** Centre de la case praticable la plus proche de (x, y) (jusqu'à 5 cases), ou null. */
    nearestPassable(x, y, mode) {
      const ci = Math.floor(x),
        cj = Math.floor(y);
      let best = null,
        bestD = FAR;
      for (let r = 0; r <= 5 && !best; r++)
        for (let j = cj - r; j <= cj + r; j++)
          for (let i = ci - r; i <= ci + r; i++) {
            if (Math.max(Math.abs(i - ci), Math.abs(j - cj)) !== r || !this.passable(i, j, mode)) continue;
            const d = (i + 0.5 - x) ** 2 + (j + 0.5 - y) ** 2;
            if (d < bestD) {
              bestD = d;
              best = [i + 0.5, j + 0.5];
            }
          }
      return best;
    }
    /** Case marchable la plus proche (pour une gemme tombée dans l'eau ou sur un talus). */
    nearestWalkable(i, j) {
      const p = this.nearestPassable(i + 0.5, j + 0.5, "walk");
      return p ? [Math.floor(p[0]), Math.floor(p[1])] : null;
    }
  }
  Grid.FAR = FAR;
  S.Grid = Grid;
})();
