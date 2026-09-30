// « Pas touche à mes trésors » — application : moteur 3D, écrans, parties et boucle d'animation.
//
//   await PTMT.main.start({ root, canvas, gl, mobile, loading });
//
// Relie les parties écrites séparément : la simulation (PTMT.sim.createGame), le rendu de la carte
// (PTMT.view), l'interface (PTMT.ui) et la progression (PTMT.progress). La caméra est fixe (vue du
// dessus façon Cursed Treasure) : un toucher ou un clic sur la carte est transmis à l'interface, qui
// ouvre le menu de construction, le panneau de tour ou lance le sort visé. Derrière l'écran titre et
// la carte des missions, la dernière mission débloquée est affichée à l'arrêt, en vitrine.
(function () {
  "use strict";
  const PTMT = (globalThis.PTMT = globalThis.PTMT || {});
  const App = (PTMT.main = {});

  App.start = async function (opts) {
    const app = App;
    app.root = opts.root;
    app.mobile = !!opts.mobile;
    const stage = app.root.querySelector("[data-stage]") || app.root;
    const canvas = (app.canvas = opts.canvas);
    canvas.classList.add("ptmt-canvas");
    stage.append(canvas);

    const renderer = (app.renderer = new THREE.WebGLRenderer({ canvas, context: opts.gl, antialias: true }));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    app.pixelRatio = Math.min(window.devicePixelRatio || 1, app.mobile ? 1.5 : 2);
    renderer.setPixelRatio(app.pixelRatio);

    if (PTMT.actors && PTMT.actors.load) {
      try {
        PTMT.actors.mobile = app.mobile;
        await PTMT.actors.load();
      } catch (e) {
        console.warn("Personnages indisponibles", e);
      }
    }

    app.progress = PTMT.progress.load();
    const uiRoot = app.root.querySelector("[data-ui]") || app.root;
    app.ui = PTMT.ui.create({
      root: uiRoot,
      mobile: app.mobile,
      progress: PTMT.progress,
      data: PTMT.sim.DATA,
      maps: PTMT.sim.MAPS,
      hooks: {
        playLevel: (n) => app.playLevel(n),
        quitLevel: () => app.quitLevel(),
        restartLevel: () => app.playLevel(app.level),
        setQuality: (q) => app.setQuality(q),
      },
    });
    app.clock = { last: performance.now(), time: 0 };
    app.bindInput();
    window.addEventListener("resize", () => app.resize());
    if (window.visualViewport) window.visualViewport.addEventListener("resize", () => app.resize());
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && app.game && !app.game.state.over) app.game.setPaused(true);
    });
    // Vitrine derrière les menus : la dernière mission débloquée, à l'arrêt.
    app.showcase(Math.min(app.progress.unlocked, PTMT.sim.MAPS.length - 1));
    PTMT.started = true;
    if (opts.loading) {
      opts.loading.classList.add("is-done");
      setTimeout(() => opts.loading.remove(), 700);
    }
    app.ui.showTitle();
    app.resize();
    requestAnimationFrame(app.frame);
    window.ptmt = app;
  };

  App.quality = function () {
    const q = (PTMT.progress.load().settings || {}).quality || "auto";
    return q === "auto" ? (App.mobile ? "low" : "high") : q;
  };
  App.setQuality = function (q) {
    const p = PTMT.progress.load();
    p.settings.quality = q;
    PTMT.progress.save(p);
    // Le rendu se reconstruit avec la nouvelle qualité (la partie en cours continue).
    if (App.view) App.mountView(App.map, App.game);
  };

  /** Monte la carte 3D d'une mission (nouvelle scène à chaque fois). */
  App.mountView = function (map, game) {
    const app = App;
    if (app.view) {
      try {
        app.view.dispose();
      } catch (e) {
        console.warn(e);
      }
    }
    app.scene = new THREE.Scene();
    app.map = map;
    app.view = PTMT.view.create({ renderer: app.renderer, scene: app.scene, map, mobile: app.mobile, quality: app.quality() });
    app.viewAdapter = {
      worldToScreen: (x, y) => app.view.worldToScreen(x, y),
      showRange: (id) => app.view.showRange(id),
      preview: (i, j, family) => app.view.preview(i, j, family),
      target: (spell, x, y) => app.view.target(spell, x, y),
      setUpgradeHints: (ids) => app.view.setUpgradeHints && app.view.setUpgradeHints(ids),
    };
    app.syncFresh = true;
    app.resize();
  };

  App.showcase = function (n) {
    const app = App;
    app.level = null;
    app.game = null;
    app.shown = PTMT.sim.createGame({ level: n, seed: 1 });
    app.mountView(PTMT.sim.MAPS[n], app.shown);
  };

  App.playLevel = function (n) {
    const app = App;
    const p = PTMT.progress.load();
    app.progress = p;
    app.level = n;
    app.game = PTMT.sim.createGame({ level: n, skills: p.skills, seed: (Date.now() % 100000) + 1 });
    app.game.setSpeed((p.settings && p.settings.speed) || 1);
    app.shown = app.game;
    app.mountView(PTMT.sim.MAPS[n], app.game);
    app.ui.enterLevel(app.game, app.viewAdapter);
    app.resize();
  };

  App.quitLevel = function () {
    const app = App;
    const n = app.level || Math.min(PTMT.progress.load().unlocked, PTMT.sim.MAPS.length - 1);
    app.showcase(n);
    app.ui.showMap();
  };

  App.resize = function () {
    const app = App;
    const w = Math.max(1, Math.round(window.innerWidth)),
      h = Math.max(1, Math.round(window.innerHeight));
    app.renderer.setSize(w, h);
    if (app.ui && app.ui.onResize) app.ui.onResize();
    const insets = (app.game && app.ui && app.ui.insets && app.ui.insets()) || { top: 0, bottom: 0, left: 0, right: 0 };
    if (app.view) app.view.resize(w, h, insets);
  };

  /* ------------------------------------------------------------ toucher, clic, survol */
  App.bindInput = function () {
    const app = App;
    const c = app.canvas;
    let down = null;
    const hit = (ev) => {
      if (!app.view || !app.game) return null;
      const r = app.view.pick(ev.clientX, ev.clientY);
      return r ? Object.assign({ screenX: ev.clientX, screenY: ev.clientY }, r) : null;
    };
    c.addEventListener("pointerdown", (ev) => {
      down = { x: ev.clientX, y: ev.clientY, t: performance.now(), id: ev.pointerId };
    });
    c.addEventListener("pointerup", (ev) => {
      if (!down || down.id !== ev.pointerId) return;
      const moved = Math.hypot(ev.clientX - down.x, ev.clientY - down.y);
      const quick = performance.now() - down.t < 700;
      down = null;
      if (moved > 14 || !quick || !app.game) return;
      app.ui.mapTap(hit(ev));
    });
    c.addEventListener("pointercancel", () => (down = null));
    c.addEventListener("pointermove", (ev) => {
      if (ev.pointerType !== "mouse" || !app.game || !app.ui.mapHover) return;
      app.ui.mapHover(hit(ev));
    });
    c.addEventListener("pointerleave", () => app.game && app.ui.mapHover && app.ui.mapHover(null));
    c.addEventListener("contextmenu", (ev) => ev.preventDefault());
  };

  /* ------------------------------------------------------------ boucle */
  let failures = 0;
  App.frame = function () {
    const app = App;
    requestAnimationFrame(app.frame);
    const now = performance.now();
    const dt = Math.min(0.1, Math.max(0, (now - app.clock.last) / 1000));
    app.clock.last = now;
    app.clock.time += dt;
    try {
      let events = [];
      const game = app.game;
      if (game) {
        game.step(dt);
        events = game.drainEvents();
        for (const ev of events) {
          if ((ev.type === "win" || ev.type === "lose") && game.state.over && !game.recorded) {
            game.recorded = true;
            const p = PTMT.progress.load();
            ev.record = PTMT.progress.recordResult(p, game.state.level, game.state.over);
            PTMT.progress.save(p);
            app.progress = p;
          }
        }
        if (app.view.setUpgradeHints && (app.hintClock = (app.hintClock || 0) + dt) > 0.25) {
          app.hintClock = 0;
          app.view.setUpgradeHints(game.upgradeable());
        }
      }
      if (app.view && app.shown) app.view.sync(app.shown.state, events, dt, app.clock.time);
      if (game) app.ui.events(events);
      if (app.ui.frame) app.ui.frame(dt);
      if (app.view) app.view.render();
      failures = 0;
    } catch (e) {
      if (failures++ < 3) console.error("[Pas touche à mes trésors]", e);
    }
  };
})();
