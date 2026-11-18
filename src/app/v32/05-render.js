// Moulin V32 — netteté du rendu.
//
// La V31 bridait le rendu à 1 pixel calculé par point d'écran sur téléphone, sans
// anticrénelage : sur un iPhone (écran ×3) l'image était agrandie trois fois, d'où
// l'aspect très pixellisé. Désormais :
//  - l'anticrénelage matériel (MSAA) est actif partout (voir src/start.js) ;
//  - la définition part haut (jusqu'à ×2 sur téléphone) et s'adapte en continu :
//    si les images arrivent en retard elle baisse par petits paliers, puis remonte
//    quand l'appareil suit. Le jeu reste fluide sans redevenir flou.
(function () {
  "use strict";
  const V32 = globalThis.MoulinV32;
  const clamp = V32.clamp;

  // Plafond de définition (pixels calculés par point CSS) selon la qualité choisie.
  const CAPS = {
    mobile: { fast: 1.75, balanced: 2, detail: 2.5 },
    desktop: { fast: 1.25, balanced: 1.75, detail: 2 },
  };
  const FLOOR = { mobile: 1.1, desktop: 0.85 };

  const state = {
    renderer: null,
    mobile: false,
    tier: "balanced",
    cap: 1.5,
    floor: 1,
    ratio: 0,
    targetInterval: 1000 / 30,
    lastRender: 0,
    slowness: 1,
    calmSince: 0,
    lastChange: 0,
    changes: 0,
    listeners: [],
  };

  function deviceRatio() {
    return Math.max(1, window.devicePixelRatio || 1);
  }

  // Définition imposée (essais, captures) : ?definition=1.5 dans l'adresse.
  const forced = Number(new URLSearchParams(location.search).get("definition")) || 0;

  function apply(ratio, reason) {
    if (!state.renderer) return;
    if (forced > 0) ratio = forced;
    const next = forced > 0 ? forced : Math.round(clamp(ratio, state.floor, Math.min(state.cap, deviceRatio())) * 20) / 20;
    if (Math.abs(next - state.ratio) < 0.02) return;
    state.ratio = next;
    state.lastChange = performance.now();
    state.changes++;
    state.renderer.setPixelRatio(next);
    for (const listener of state.listeners) listener(next, reason);
  }

  V32.render = {
    /** Appelé par le jeu juste après la création du moteur de rendu. */
    attach(renderer, { mobile }) {
      state.renderer = renderer;
      state.mobile = !!mobile;
      state.floor = FLOOR[state.mobile ? "mobile" : "desktop"];
    },
    /** Appelé à chaque changement de qualité (Économe, Équilibré, Détaillé). */
    setQuality(tier, fps) {
      state.tier = CAPS.desktop[tier] ? tier : "balanced";
      state.cap = CAPS[state.mobile ? "mobile" : "desktop"][state.tier];
      state.targetInterval = 1000 / (fps || 30);
      state.slowness = 1;
      state.calmSince = performance.now();
      // On repart du plafond : l'adaptation redescend en quelques secondes si besoin.
      state.ratio = 0;
      apply(state.cap, "quality");
    },
    /** Appelé après chaque image rendue. */
    frameRendered(now) {
      if (forced > 0) return;
      const interval = now - state.lastRender;
      state.lastRender = now;
      // Seules les images enchaînées (rendu continu) renseignent sur la charge.
      if (interval <= 0 || interval > 250 || document.hidden) return;
      const load = interval / state.targetInterval;
      state.slowness += (load - state.slowness) * 0.08;
      const sinceChange = now - state.lastChange;
      if (state.slowness > 1.32 && sinceChange > 1500 && state.ratio > state.floor + 0.01) {
        apply(state.ratio - (state.slowness > 1.8 ? 0.3 : 0.15), "slow");
        state.slowness = 1.1;
        state.calmSince = now;
      } else if (state.slowness < 1.07) {
        if (now - state.calmSince > 5000 && sinceChange > 7000 && state.ratio < Math.min(state.cap, deviceRatio()) - 0.01) {
          apply(state.ratio + 0.1, "headroom");
          state.calmSince = now;
        }
      } else state.calmSince = now;
    },
    onChange(listener) {
      state.listeners.push(listener);
    },
    get state() {
      return {
        ratio: state.ratio,
        cap: state.cap,
        floor: state.floor,
        tier: state.tier,
        slowness: Number(state.slowness.toFixed(3)),
        changes: state.changes,
        device: deviceRatio(),
      };
    },
  };
})();
