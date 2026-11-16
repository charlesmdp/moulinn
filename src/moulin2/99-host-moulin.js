// La Fête du Moulin — branchement sur le vrai moulin 3D (page /moulin2).
//
// Le jeu du moulin (src/app/moulin.js) démarre des « modules V32 » une fois le jardin construit : on
// s'inscrit dans cette liste, sans rien changer à son code. Le module décrit le monde à la fête
// (hauteur du sol, étangs, arbres, personnage, caméra) puis lance MF.boot.
(function () {
  "use strict";
  const MF = globalThis.MoulinFete;
  if (!MF || MF.route !== "moulin2" || MF.hostDone) return;
  MF.hostDone = true;
  const V32 = (globalThis.MoulinV32 = globalThis.MoulinV32 || {});
  V32.modules = V32.modules || [];
  V32.modules.push({
    name: "fete",
    order: 95,
    factory(context) {
      const { THREE, game, hooks } = context;
      const player = game.player;
      const ponds = (game.waterRegions || []).map((r) => {
        let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
        for (const p of r.poly) {
          x0 = Math.min(x0, p[0]);
          x1 = Math.max(x1, p[0]);
          z0 = Math.min(z0, p[1]);
          z1 = Math.max(z1, p[1]);
        }
        return { name: r.name, level: r.level, poly: r.poly, x0, x1, z0, z1 };
      });
      const world = {
        THREE,
        scene: game.scene,
        camera: game.camera,
        renderer: game.renderer,
        dom: hooks.root,
        canvas: game.renderer.domElement,
        mobile: !!hooks.mobile,
        real: true,
        /**
         * Hauteur du sol (fond des étangs compris). Là où le moulin a posé un revêtement sur le relief
         * (pavés de la cour, terrasse, allée), on prend sa surface : quelques centimètres plus haut.
         */
        heightAt(x, z) {
          const t = game.terrainHeight(x, z);
          const s = game.cameraSupportHeight ? game.cameraSupportHeight(x, z) : t;
          return s > t && s - t < 0.6 ? s : t;
        },
        /** Étang en ce point ({ name, level, poly }) ou null. */
        waterAt(x, z) {
          for (const p of ponds) if (x >= p.x0 && x <= p.x1 && z >= p.z0 && z <= p.z1 && MF.pointInPoly(x, z, p.poly)) return p;
          return null;
        },
        ponds,
        /** Îlots des étangs : contours [[x, z], …] (ils ne font pas partie du relief). */
        islands: hooks.islands || [],
        trees: game.forest && game.forest.records ? game.forest.records : [],
        solids: [].concat(player.physicalBuildings || [], player.solidRects || []),
        player: {
          pose() {
            const a = player.getAudioState();
            return { x: a.position.x, y: a.position.y, z: a.position.z, heading: a.heading, speed: a.speed || 0, visible: !!a.enabled };
          },
          setEnabled: (on) => player.setEnabled(on),
          teleport: (x, z) => player.teleport(x, z),
          canStand: (x, z) => !!player.canStand(x, z).ok,
          /** Revient au mode « Personnage » (depuis la vue libre ou la météo). */
          walk() {
            if (hooks.getMode() !== "play") hooks.setMode("play");
          },
          walking: () => hooks.getMode() === "play" && player.enabled,
        },
        invalidate: () => hooks.markDirty(),
        refreshShadows: () => hooks.refreshShadows(),
        announce: (text) => game.shell && game.shell.announce && game.shell.announce(text),
      };
      const app = MF.boot(world, {});
      hooks.refreshShadows();
      for (const e of app.entries) if (!world.player.canStand(e.def.station.x, e.def.station.z)) console.warn("[Fête du Moulin] stand « " + e.def.id + " » hors d'un sol praticable");
      return {
        app,
        update(dt, time) {
          // la boule à neige « Météo » montre le moulin seul : on y cache la fête
          const globe = hooks.getMode() === "globe";
          if (app.root.visible === globe) app.root.visible = !globe;
          return app.update(dt, time);
        },
      };
    },
  });
})();
