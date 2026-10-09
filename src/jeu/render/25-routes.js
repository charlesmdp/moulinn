// « Pas touche à mes trésors » — repères des entrées et aperçu des vagues (PTMT.view, partie « trajets »).
//
// Tout ici s'écrit dans les lots de sprites de la vue, réécrits à chaque image sans allocation : le lot
// « repères » (un seul appel de dessin, caché par ce qui est devant lui) et, pour les blasons, celui
// des surimpressions (toujours devant : un bois ou une tour ne cache jamais une entrée) :
//  - au-dessus du poteau de chaque entrée, un blason à sa couleur portant sa lettre (state.map.entrances :
//    letter, color) ; une barrière encore fermée porte sa lettre sur un blason gris et un cadenas ; quand
//    elle cède, le blason prend sa couleur d'un coup (rebond, halo) ;
//  - au sol, des chevrons à la couleur de l'entrée filent vers l'intérieur, discrets au repos, vifs et
//    rapides quand la prochaine vague entre par là ;
//  - les flèches des entrées par où arrive la prochaine vague s'animent pendant le compte à rebours
//    (plus vives et plus rapides dans les dernières secondes) ; le reste du trajet n'est pas montré.
//    La vague vient de view.game.upcoming(1) si la vue connaît la partie, sinon de
//    PTMT.sim.buildWaves (mêmes vagues, la graine ne dépend que de la mission), sinon de
//    state.wave.nextEntrances.
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
  const GREY_HEX = "#a9a59c";

  function Routes(view) {
    this.view = view;
    this.sig = NaN;
    this.next = null;
    this.paths = [];
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
      // n'est dessiné que s'il coupe par l'eau (voir build) ; le chemin à pied est toujours montré
      const wk = g.entrance + ":walk";
      if (mode === "swim" && !seen.has(wk)) {
        seen.add(wk);
        out.push({ entrance: g.entrance, mode: "walk" });
      }
    }
    return { index: k, groups: out, low };
  };

  /**
   * Entrées par lesquelles arrive la prochaine vague. Les trajets complets ne sont plus dessinés :
   * des pointillés sur tout le chemin en disaient trop (et brouillaient la marée) ; seules les
   * flèches des entrées concernées s'animent, comme dans Cursed Treasure.
   */
  R.build = function (st, next) {
    this.paths.length = 0;
    this.lastEntrances = [];
    if (!next || !next.groups.length) return;
    const ents = st.map.entrances || [];
    for (const grp of next.groups) {
      const e = ents[grp.entrance];
      if (e && !this.lastEntrances.includes(e.id)) this.lastEntrances.push(e.id);
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
    // entrées : blason lettré sur le poteau (lot des surimpressions, toujours devant : un bois ou une
    // tour ne le cache jamais), chevrons au sol
    const HB = view.hud || M;
    for (const e of world.entrances || []) {
      const p = e.pole;
      const on = active.includes(e.id) && !st.over;
      const color = e.open ? this.col(e.color) : this.grey;
      const li = LETTERS.indexOf(e.letter);
      const pop = e.opened >= 0 ? Math.sin(Math.min(1, e.opened / 0.5) * Math.PI) * 0.6 * Math.max(0, 1 - e.opened / 1.2) : 0;
      const B = 2.2 * k * (1 + pop + (on ? 0.06 * Math.sin(time * (urgent ? 9 : 5)) : 0));
      const X = toX(p.x), Z = toZ(p.y), Y = p.top + B * 0.42;
      if (on || pop > 0) HB.put(X, Y, Z, B * 1.9, H.glow, color[0], color[1], color[2], on ? 0.55 + 0.25 * Math.sin(time * 6) : pop, 0, 1, 0, 1);
      HB.put(X, Y, Z, B, H.banner, color[0], color[1], color[2], 1, 0, 0, 0, 1);
      if (li >= 0) HB.put(X, Y + B * 0.03, Z, B * 0.78, H.letter + li, 1, 1, 1, 1, 0, 0, 0, 1);
      if (!e.open) HB.put(X + right.x * B * 0.42, Y - B * 0.36, Z + right.z * B * 0.42, B * 0.5, H.lock, 1, 1, 1, 1, 0, 0, 0, 1);
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
  };
  R.dispose = function () {
    this.paths.length = 0;
  };
})();
