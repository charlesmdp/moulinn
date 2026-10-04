// « Pas touche à mes trésors » — repères des entrées et aperçu des vagues (PTMT.view, partie « trajets »).
//
// Tout ici s'écrit dans le lot de sprites « repères » de la vue (un seul appel de dessin, caché par ce
// qui est devant lui), réécrit à chaque image sans allocation :
//  - au-dessus du poteau de chaque entrée, un blason à sa couleur portant sa lettre (state.map.entrances :
//    letter, color) ; une barrière encore fermée porte sa lettre sur un blason gris et un cadenas ; quand
//    elle cède, le blason prend sa couleur d'un coup (rebond, halo) ;
//  - au sol, des chevrons à la couleur de l'entrée filent vers l'intérieur, discrets au repos, vifs et
//    rapides quand la prochaine vague entre par là ;
//  - pendant le compte à rebours (pas pendant que la vague entre), l'aperçu du trajet de la prochaine
//    vague, comme dans Cursed Treasure : pointillés animés à la couleur de l'entrée, de l'entrée à la
//    cachette visée, le long du VRAI chemin (champ d'écoulement de la simulation, PTMT.sim.Grid, sur
//    la carte telle qu'elle sera à cette vague : barrière ouverte, passage secret, marée), en tenant
//    le milieu de la route ; route des nageurs en pointillés bleus quand elle coupe par l'eau ;
//    montgolfières : ligne droite tiretée vers la cachette la plus proche et petit ballon qui la suit.
//    La vague vient de view.game.upcoming(1) si la vue connaît la partie, sinon de
//    PTMT.sim.buildWaves (mêmes vagues, la graine ne dépend que de la mission), sinon de
//    state.wave.nextEntrances (marcheurs seulement).
//
//   const r = new PTMT.view._Routes(view) ; r.update(state, dt, time) ; r.lastEntrances ; r.dispose()
(function () {
  "use strict";
  const PTMT = (globalThis.PTMT = globalThis.PTMT || {});
  if (typeof THREE === "undefined") return;
  const VIEW = (PTMT.view = PTMT.view || {});
  const MK = VIEW._map;
  if (!MK) return;
  const { TILE, MW, MH } = MK.K;
  const toX = (x) => (x - MW / 2) * TILE, toZ = (y) => (y - MH / 2) * TILE;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lin = (hex) => (PTMT.color ? PTMT.color(hex) : new THREE.Color(hex).convertSRGBToLinear());
  const LETTERS = "ABCDE";
  const STEP = 0.1; // pas de rééchantillonnage des trajets (cases)
  const SWIM_HEX = "#3fb6ff";
  const GREY_HEX = "#a9a59c";

  function Routes(view) {
    this.view = view;
    this.sig = NaN;
    this.next = null;
    this.paths = [];
    this.alpha = 0;
    this.lastEntrances = [];
    this.waves = null;
    this.wavesLevel = -1;
    this.cols = new Map();
    this.grey = this.col(GREY_HEX);
  }
  const R = Routes.prototype;
  VIEW._Routes = Routes;

  /** Couleur linéaire [r, g, b] d'un hexa (mise en cache). */
  R.col = function (hex) {
    let c = this.cols.get(hex);
    if (!c) {
      const k = lin(hex);
      c = [k.r, k.g, k.b];
      this.cols.set(hex, c);
    }
    return c;
  };

  /* ------------------------------------------------------------------ prochaine vague */
  /**
   * { index, groups: [{ entrance, flying, swims }], low (marée basse à cette vague ?) } ou null.
   * Groupes dédoublonnés par entrée et mode de passage.
   */
  R.nextWave = function (st) {
    const w = st.wave;
    if (!w) return null;
    const k = (w.index | 0) + 1;
    if (w.total !== undefined && k >= w.total) return null;
    const S = PTMT.sim;
    const D = S && S.DATA;
    let groups = null, notes = null;
    const game = this.view.game;
    if (game && typeof game.upcoming === "function") {
      try {
        const up = game.upcoming(1)[0];
        if (up && up.index === k) {
          groups = up.groups.map((g) => ({ entrance: g.entrance, flying: !!g.flying, swims: !!g.swims }));
          notes = up.notes || [];
        }
      } catch (e) {
        groups = null;
      }
    }
    if (!groups && S && typeof S.buildWaves === "function" && st.level && S.MAPS && S.MAPS[st.level] && st.map && st.map.entrances) {
      try {
        if (!this.waves || this.wavesLevel !== st.level) {
          this.waves = S.buildWaves(st.level, st.map.entrances);
          this.wavesLevel = st.level;
        }
        const wave = this.waves[k];
        if (wave)
          groups = wave.groups.map((g) => {
            const ab = D && D.ENEMIES[g.type] && D.ENEMIES[g.type].ability;
            return { entrance: g.entrance, flying: !!(ab && ab.kind === "fly"), swims: !!(ab && ab.kind === "swim") };
          });
      } catch (e) {
        groups = null;
      }
    }
    if (!groups) groups = (w.nextEntrances || []).map((id) => ({ entrance: id, flying: false, swims: false }));
    // marée à cette vague (annoncée, sinon calculée comme la simulation, sinon celle d'aujourd'hui)
    let low = st.tide === "low";
    if (notes) {
      for (const n of notes) if (n.kind === "tideLow") low = true;
      else if (n.kind === "tideHigh") low = false;
    } else if (S && S.MAPS && S.MAPS[st.level] && S.MAPS[st.level].tide) {
      const cyc = S.MAPS[st.level].tide.cycle || 3;
      low = Math.floor(k / cyc) % 2 === 1;
    }
    const seen = new Set(), out = [];
    for (const g of groups) {
      const mode = g.flying ? "fly" : g.swims ? "swim" : "walk";
      const key = g.entrance + ":" + mode;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ entrance: g.entrance, mode });
      // les nageurs passent aussi par le chemin quand l'eau ne raccourcit rien : leur trait bleu
      // n'est dessiné que s'il coupe par l'eau (voir build)
    }
    return { index: k, groups: out, low };
  };

  /* ------------------------------------------------------------------ trajets */
  /** Grille de la simulation telle qu'elle sera à la vague k (barrières ouvertes, passage secret, marée). */
  R.gridFor = function (st, k, low) {
    const S = PTMT.sim;
    if (!S || !S.Grid || !st.map || !st.map.grid || !st.map.lairs) return null;
    const secret = st.map.secretWave && k + 1 >= st.map.secretWave;
    const rows = st.map.grid.map((r) => {
      let x = typeof r === "string" ? r : r.join("");
      x = x.replace(/g/g, "E");
      if (secret) x = x.replace(/s/g, "#");
      return x;
    });
    try {
      const g = new S.Grid({ id: st.map.id, grid: rows, mana: [], lairs: st.map.lairs.map((L) => ({ at: L.tiles[0], gems: L.total, style: L.style })), gates: [] });
      g.setTide(!!low);
      return g;
    } catch (e) {
      return null;
    }
  };
  /** Rééchantillonne une polyligne (cases) tous les STEP : positions monde posées sur le sol. */
  R.resample = function (pts, lift, flat) {
    const world = this.view.world;
    let total = 0;
    for (let k = 2; k < pts.length; k += 2) total += Math.hypot(pts[k] - pts[k - 2], pts[k + 1] - pts[k - 1]);
    const n = Math.max(2, Math.floor(total / STEP) + 1);
    const out = new Float32Array(n * 5); // X, Y, Z, dx, dz
    let seg = 2, segPos = 0, segLen = pts.length > 2 ? Math.hypot(pts[2] - pts[0], pts[3] - pts[1]) : 0;
    for (let q = 0; q < n; q++) {
      const s = Math.min(total, q * STEP);
      while (seg < pts.length - 2 && segPos + segLen < s) {
        segPos += segLen;
        seg += 2;
        segLen = Math.hypot(pts[seg] - pts[seg - 2], pts[seg + 1] - pts[seg - 1]);
      }
      const t = segLen > 1e-6 ? clamp((s - segPos) / segLen, 0, 1) : 0;
      const x = pts[seg - 2] + (pts[seg] - pts[seg - 2]) * t, y = pts[seg - 1] + (pts[seg + 1] - pts[seg - 1]) * t;
      const dx = pts[seg] - pts[seg - 2], dy = pts[seg + 1] - pts[seg - 1], l = Math.hypot(dx, dy) || 1;
      out[q * 5] = toX(x);
      out[q * 5 + 1] = (flat ? Math.max(0, world.groundAt(x, y, true)) : world.groundAt(x, y, true)) + lift;
      out[q * 5 + 2] = toZ(y);
      out[q * 5 + 3] = dx / l;
      out[q * 5 + 4] = dy / l;
    }
    return { pts: out, n, len: total };
  };
  /** Le trajet passe-t-il par l'eau (ou par l'estran à marée haute) ? */
  function crossesWater(g, pts) {
    for (let k = 0; k < pts.length; k += 2) {
      const c = g.char(Math.floor(pts[k]), Math.floor(pts[k + 1]));
      if (c === "~" || c === "w" || (c === "m" && !g.lowTide)) return true;
    }
    return false;
  }
  R.build = function (st, next) {
    this.paths.length = 0;
    this.lastEntrances = [];
    if (!next || !next.groups.length) return;
    const g = this.gridFor(st, next.index, next.low);
    const ents = st.map.entrances || [];
    const lairs = st.map.lairs || [];
    const sources = [];
    for (const L of lairs) if ((L.stock === undefined ? L.total : L.stock) > 0) sources.push({ lair: L.id, x: L.x, y: L.y });
    for (const gem of st.gems || []) if (gem.where === "ground") sources.push({ lair: -1, x: gem.x, y: gem.y });
    for (const grp of next.groups) {
      const e = ents[grp.entrance];
      if (!e) continue;
      if (!this.lastEntrances.includes(e.id)) this.lastEntrances.push(e.id);
      const color = this.col(e.color || "#ffffff");
      if (grp.mode === "fly") {
        // montgolfière : du bord, tout droit vers la source la plus proche (à vol d'oiseau)
        const sx = e.x - Math.sin(e.dir) * 0.4, sy = e.y - Math.cos(e.dir) * 0.4;
        let best = null, bd = Infinity;
        for (const s of sources) {
          const d = Math.hypot(s.x - sx, s.y - sy);
          if (d < bd) {
            bd = d;
            best = s;
          }
        }
        if (!best) continue;
        const r = this.resample([sx, sy, best.x, best.y], 0.1, true);
        this.paths.push(Object.assign(r, { mode: "fly", color, entrance: e.id, tx: best.x, ty: best.y }));
        continue;
      }
      if (!g) continue;
      const mode = grp.mode === "swim" ? "swim" : "walk";
      const mid = e.tiles[Math.floor((e.tiles.length - 1) / 2)] || [Math.floor(e.x), Math.floor(e.y)];
      let bestF = null, bd = Infinity, target = null;
      for (const L of lairs) {
        if ((L.stock === undefined ? L.total : L.stock) <= 0) continue;
        const f = g.toLair(L.id, mode);
        const d = Math.min(g.at(f, mid[0], mid[1]), g.at(f, Math.floor(e.x), Math.floor(e.y)));
        if (d < bd) {
          bd = d;
          bestF = f;
          target = L;
        }
      }
      if (!bestF || bd >= 1e8) continue;
      const line = MK.walkLine(g, bestF, e.x, e.y, 0, mode, 140, []);
      if (line.length < 4) continue;
      if (mode === "swim" && !crossesWater(g, line)) continue;
      const r = this.resample(line, 0.1, false);
      this.paths.push(Object.assign(r, { mode, color: mode === "swim" ? this.col(SWIM_HEX) : color, entrance: e.id, tx: target.x, ty: target.y }));
    }
  };

  /* ------------------------------------------------------------------ image */
  R.update = function (st, dt, time) {
    const view = this.view, M = view.marks, H = VIEW._hud && VIEW._hud.HUD;
    if (!M || !H) return;
    M.begin();
    const world = view.world;
    const k = view.ovScale || 1;
    const right = view.cam.right;
    const w = st.wave || {};
    // aperçu à recalculer ? (vague, carte, marée, cachettes vidées, gemmes au sol) : signature
    // numérique, sans allocation ; la vague n'est relue qu'à un changement
    let sig = ((w.index | 0) + 2) * 7919 + ((st.map && st.map.version) | 0) * 131 + (st.tide === "low" ? 17 : 0) + (st.over ? 3 : 0);
    const lairs = (st.map && st.map.lairs) || [];
    for (let i = 0; i < lairs.length; i++) sig = sig * 3 + (lairs[i].stock > 0 ? 1 : 0);
    const gems = st.gems || [];
    for (let i = 0; i < gems.length; i++) if (gems[i].where === "ground") sig += gems[i].id * 1013 + Math.floor(gems[i].x * 4) * 7 + Math.floor(gems[i].y * 4);
    if (sig !== this.sig) {
      this.sig = sig;
      this.next = st.over ? null : this.nextWave(st);
      this.build(st, this.next);
    }
    const next = this.next;
    const active = this.lastEntrances;
    const urgent = next && w.countdown !== undefined && w.countdown < 6;
    // entrées : blason lettré sur le poteau, chevrons au sol
    for (const e of world.entrances || []) {
      const p = e.pole;
      const on = active.includes(e.id) && !st.over;
      const color = e.open ? this.col(e.color) : this.grey;
      const li = LETTERS.indexOf(e.letter);
      const pop = e.opened >= 0 ? Math.sin(Math.min(1, e.opened / 0.5) * Math.PI) * 0.6 * Math.max(0, 1 - e.opened / 1.2) : 0;
      const B = 2.2 * k * (1 + pop + (on ? 0.06 * Math.sin(time * (urgent ? 9 : 5)) : 0));
      const X = toX(p.x), Z = toZ(p.y), Y = p.top + B * 0.42;
      if (on || pop > 0) M.put(X, Y, Z, B * 1.9, H.glow, color[0], color[1], color[2], on ? 0.55 + 0.25 * Math.sin(time * 6) : pop, 0, 1, 0, 1);
      M.put(X, Y, Z, B, H.banner, color[0], color[1], color[2], 1, 0, 0, 0, 1);
      if (li >= 0) M.put(X, Y + B * 0.03, Z, B * 0.78, H.letter + li, 1, 1, 1, 1, 0, 0, 0, 1);
      if (!e.open) M.put(X + right.x * B * 0.42, Y - B * 0.36, Z + right.z * B * 0.42, B * 0.5, H.lock, 1, 1, 1, 1, 0, 0, 0, 1);
      if (!e.open) continue;
      // chevrons au sol : trois par case de l'entrée, de bord vers l'intérieur
      const rot = Math.atan2(-e.ix, -e.iy);
      const speed = on ? (urgent ? 1.25 : 0.9) : 0.35;
      const A = on ? 0.95 : 0.38;
      for (const [ti, tj] of e.tiles) {
        for (let q = 0; q < 3; q++) {
          const ph = (time * speed + q / 3 + (ti + tj) * 0.07) % 1;
          const d = -0.45 + 1.7 * ph;
          const x = ti + 0.5 + e.ix * d, y = tj + 0.5 + e.iy * d;
          const a = Math.sin(ph * Math.PI) * A;
          M.put(toX(x), world.groundAt(x, y, true) + 0.08, toZ(y), (on ? 2.3 : 1.9) * Math.min(1.35, k), H.chevron, color[0], color[1], color[2], a, rot, 0, 1, 1);
        }
      }
    }
    // aperçu des trajets de la prochaine vague (masqué pendant que la vague entre)
    const want = next && !w.spawning && this.paths.length ? 1 : 0;
    this.alpha += (want - this.alpha) * Math.min(1, dt * (want ? 2.5 : 6));
    if (this.alpha < 0.02) return;
    const busy = (st.enemies || []).length > 0 ? 0.7 : 1;
    const gap = view.mobile ? 0.52 : 0.46;
    const speed = urgent ? 1.6 : 1.1;
    const dot = 0.95 * k, chev = 1.45 * k;
    for (const P of this.paths) {
      const pts = P.pts, n = P.n, len = P.len;
      const col = P.color;
      const fly = P.mode === "fly";
      const phase = (time * speed) % gap;
      // numéro de chaque point compté depuis le départ du défilement : le motif (un chevron tous
      // les quatre points) avance avec eux sans sauter quand la phase reboucle
      let idx = -Math.floor((time * speed) / gap);
      for (let s = phase; s < len; s += gap, idx++) {
        const q = Math.min(n - 1, Math.round(s / STEP));
        const o = q * 5;
        const fade = clamp(s / 0.6, 0, 1) * clamp((len - s) / 0.9, 0, 1);
        const a = this.alpha * busy * fade;
        if (a < 0.02) continue;
        const dx = pts[o + 3], dz = pts[o + 4];
        if (fly) {
          M.put(pts[o], pts[o + 1], pts[o + 2], dot * 1.5, H.dash, col[0], col[1], col[2], a * 0.95, Math.atan2(-dz, dx), 0, 1, 1);
        } else if ((idx & 3) === 3) {
          M.put(pts[o], pts[o + 1], pts[o + 2], chev, H.chevron, col[0], col[1], col[2], a, Math.atan2(-dx, -dz), 0, 1, 1);
        } else {
          M.put(pts[o], pts[o + 1], pts[o + 2], dot, H.dot, col[0], col[1], col[2], a * 0.95, 0, 0, 1, 1);
        }
      }
      // montgolfière : petit ballon qui parcourt la ligne
      if (fly && len > 0.5) {
        const s = ((time * 0.45) % 1) * len;
        const o = Math.min(n - 1, Math.round(s / STEP)) * 5;
        M.put(pts[o], pts[o + 1] + 1.6 * k, pts[o + 2], 1.7 * k, H.balloon, col[0], col[1], col[2], this.alpha, 0, 0, 0, 1);
      }
      // cachette visée : anneau pulsé à la couleur de l'entrée
      const pr = (time * 0.8 + P.entrance * 0.3) % 1;
      const tx = toX(P.tx), tz = toZ(P.ty), ty = world.groundAt(P.tx, P.ty, false) + 0.12;
      M.put(tx, ty, tz, (3.2 + pr * 4.5) * Math.min(1.3, k), H.ring, col[0], col[1], col[2], this.alpha * busy * (1 - pr) * 0.9, 0, 0, 1, 1);
    }
  };
  R.dispose = function () {
    this.paths.length = 0;
  };
})();
