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
      // L'ordinateur porté dans le dos suit le haut du buste du personnage du moulin (os « spine_03 »).
      let worn = null, chest = null, figure = null;
      const spot3 = new THREE.Vector3();
      function carry() {
        if (!worn) return;
        const a = player.getAudioState();
        if (!figure || !figure.parent) {
          figure = game.scene.getObjectByName("Promeneur_sweat_bordeaux") || null;
          chest = figure ? figure.getObjectByName("spine_03") || figure.getObjectByName("spine_02") : null;
        }
        const show = !!a.enabled && hooks.getMode() === "play" && !!chest;
        if (worn.visible !== show) worn.visible = show;
        if (!show) return;
        chest.getWorldPosition(spot3);
        const h = a.heading;
        worn.position.set(spot3.x - Math.sin(h) * 0.13, spot3.y + 0.17, spot3.z - Math.cos(h) * 0.13);
        worn.rotation.y = h;
      }
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
        /** Plancher de la fête (ponton, gradin, escalier) : le personnage du moulin peut y marcher. */
        addSurface(surface) {
          if (V32.walkSurfaces && !V32.walkSurfaces.includes(surface)) V32.walkSurfaces.push(surface);
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
          /** Porte un objet dans le dos du personnage (l'ordinateur-sac à dos) ; remplace le précédent. */
          wear(object) {
            if (worn) MF.dispose(worn);
            worn = object;
            if (worn) {
              worn.userData.live = true;
              game.scene.add(worn);
            }
          },
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
          const dirty = app.update(dt, time);
          carry();
          return dirty;
        },
      };
    },
  });
})();
