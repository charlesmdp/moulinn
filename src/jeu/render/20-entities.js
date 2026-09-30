// « Pas touche à mes trésors » — la vue du jeu (PTMT.view) : création, et liaison de l'état de la
// simulation vers la scène 3D, image par image.
//
//   const view = PTMT.view.create({ renderer, scene, map, mobile, quality });
//   view.resize(w, h, insets) ; view.sync(state, events, dt, time) ; view.render()
//   view.tileTop(i, j) ; view.toWorld(x, y) ; view.worldToScreen(x, y, lift) ; view.pick(cx, cy)
//   view.showRange(towerId | null, range?) ; view.preview(i, j, family | null)
//   view.target(spell | null, x, y) ; view.setUpgradeHints(ids) ; view.dispose()
//
// La vue possède la carte (render/10-map.js), la caméra fixe (render/30-camera.js), les effets
// (PTMT.fx, initialisés avec sa caméra et mis à jour dans sync) et tous les objets vivants :
//  - tours : PTMT.models.ctTower(famille, niveau, spéc.) posées au centre de leur case ; visée
//    vers leur cible, élan sur l'événement « attack », remplacement du modèle à la montée de
//    niveau (célébration + colonne dorée), apparition en rebond, Frénésie ;
//  - ennemis : PTMT.actors.create(type, champion, boss), position lissée, cap tiré du déplacement,
//    taille × 1,3 (champion) ou × 1,6 (boss), mort jouée une seconde avant libération ;
//  - gemmes : PTMT.models.gem(couleur), au repaire (tas du moulin), portées (accrochées à
//    carryAnchor), au sol (anneau pulsé), ou en vol (vol, ramassage, chute, retour doré au moulin) ;
//  - projectiles : départ capturé à la gueule de la tour, arrivée sur la poitrine de la cible (ou
//    au sol pour les tirs en cloche), progression p de la simulation ; impact « kind + Hit » ;
//  - zones de brûlure et avertissements de météore ;
//  - surimpressions : barres de vie, barrière du druide, pictogrammes d'état, flèches d'amélioration
//    (un seul lot de sprites, toujours au premier plan), textes flottants et noms des boss (DOM).
// Tout modèle absent (tours, ennemis, gemmes, projectiles, décor) est remplacé par une forme de
// secours simple : le jeu tourne avec ou sans les autres parties.
(function () {
  "use strict";
  const PTMT = (globalThis.PTMT = globalThis.PTMT || {});
  if (typeof THREE === "undefined") return;
  const VIEW = (PTMT.view = PTMT.view || {});

  const TILE = 3.6, MW = 20, MH = 13;
  const toX = (x) => (x - MW / 2) * TILE, toZ = (y) => (y - MH / 2) * TILE;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const smooth01 = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
  const lin = (hex) => (PTMT.color ? PTMT.color(hex) : new THREE.Color(hex).convertSRGBToLinear());
  const DATA = () => (PTMT.sim && PTMT.sim.DATA) || null;
  const TAU = Math.PI * 2;
  function turn(cur, target, max) {
    let d = (target - cur) % TAU;
    if (d > Math.PI) d -= TAU;
    else if (d < -Math.PI) d += TAU;
    return cur + (d > max ? max : d < -max ? -max : d);
  }
  const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3();

  const RANGE_HEX = { boar: "#ffd88a", swan: "#9ff2ff", dog: "#ffab6a" };
  // Anciens personnages (banc d'essai sans les nouveaux ennemis) : silhouette la plus proche.
  const OLD_ACTOR = { fermier: "voleur", quad: "sprinteur", cowboy: "demenageur", vache: "demenageur", druide: "fumigene", bigoudene: "voleur", chasseur: "fumigene", rugbyman: "sprinteur", sonneur: "voleur", pompier: "demenageur", canard: "nageur" };
  // Anciens projectiles (traînées du noyau d'effets) pour les sortes qui leur ressemblent.
  const OLD_SHOT = { fireball: "fireball", dragonFire: "fireball", waterJet: "waterJet", iceShard: "iceShard", darkWater: "waterBlast" };
  const HIT_FALLBACK = { chestnut: ["hit", 0.5], bigChestnut: ["explosion", 1], waterJet: ["splash", 0.6], iceShard: ["iceShatter", 0.7], darkWater: ["splash", 0.7], fireball: ["explosion", 0.5], dragonFire: ["explosion", 0.9], blueFire: ["freezeFlash", 0.8] };
  const TILES_FALLBACK = {
    ".": { build: ["boar"] }, "^": { build: ["dog"] }, "~": { build: ["swan"] }, H: { build: ["boar", "swan", "dog"], high: true },
    f: { forest: true, cutTo: "." }, r: { forest: true, cutTo: "^" }, w: { forest: true, cutTo: "~" }, h: { forest: true, cutTo: "H", high: true },
  };
  const tileInfo = (ch) => {
    const D = DATA();
    return (D && D.TILES && D.TILES[ch]) || TILES_FALLBACK[ch] || {};
  };
  const hasBurst = (k) => !!(PTMT.fx && PTMT.fx.burst && PTMT.fx._ && PTMT.fx._.S && PTMT.fx._.BURSTS && PTMT.fx._.BURSTS[k]);
  function burst(k, p, o) {
    if (!hasBurst(k)) return false;
    try {
      PTMT.fx.burst(k, p, o || {});
      return true;
    } catch (e) {
      return false;
    }
  }

  /* ------------------------------------------------------------------ planche des surimpressions */
  // 8 × 8 cases de 64 px : barres, halos, pictogrammes d'état, flèche d'amélioration, couronne.
  const HUD = { bar: 0, glow: 1, snow: 2, flame: 3, fear: 4, eye: 5, notes: 6, disarm: 7, stun: 8, drop: 9, ghost: 10, arrow: 11, crown: 12, shield: 13, haste: 14, ring: 15, frame: 16 };
  let hudTex = null;
  function hudAtlas() {
    if (hudTex) return hudTex;
    const S = 64, cv = document.createElement("canvas");
    cv.width = cv.height = S * 8;
    const c = cv.getContext("2d");
    const cell = (i, fn) => {
      c.save();
      c.translate((i % 8) * S, Math.floor(i / 8) * S);
      c.beginPath();
      c.rect(1, 1, S - 2, S - 2);
      c.clip();
      fn(c);
      c.restore();
    };
    const outline = (fn, fill, stroke, w) => {
      fn();
      c.lineJoin = c.lineCap = "round";
      c.strokeStyle = stroke || "#1c1410";
      c.lineWidth = w || 7;
      c.stroke();
      c.fillStyle = fill;
      c.fill();
    };
    cell(HUD.bar, () => {
      c.fillStyle = "#fff";
      c.beginPath();
      c.roundRect ? c.roundRect(3, 3, S - 6, S - 6, 10) : c.rect(3, 3, S - 6, S - 6);
      c.fill();
    });
    cell(HUD.frame, () => {
      c.fillStyle = "#fff";
      c.fillRect(1, 1, S - 2, S - 2);
    });
    cell(HUD.glow, () => {
      const g = c.createRadialGradient(32, 32, 0, 32, 32, 31);
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(0.5, "rgba(255,255,255,0.4)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = g;
      c.fillRect(0, 0, S, S);
    });
    cell(HUD.ring, () => {
      c.strokeStyle = "#fff";
      c.lineWidth = 5;
      c.beginPath();
      c.arc(32, 32, 26, 0, TAU);
      c.stroke();
    });
    cell(HUD.snow, () => {
      c.strokeStyle = "#1c3a5a";
      c.lineCap = "round";
      for (const [w, col] of [[11, "#12304c"], [6, "#bff2ff"]]) {
        c.strokeStyle = col;
        c.lineWidth = w;
        for (let k = 0; k < 3; k++) {
          const a = (k * Math.PI) / 3;
          c.beginPath();
          c.moveTo(32 - Math.cos(a) * 22, 32 - Math.sin(a) * 22);
          c.lineTo(32 + Math.cos(a) * 22, 32 + Math.sin(a) * 22);
          c.stroke();
        }
      }
    });
    cell(HUD.flame, () =>
      outline(() => {
        c.beginPath();
        c.moveTo(32, 5);
        c.bezierCurveTo(46, 22, 54, 32, 50, 44);
        c.arc(32, 44, 18, 0, Math.PI);
        c.bezierCurveTo(10, 30, 26, 22, 32, 5);
        c.closePath();
      }, "#ff7a1f"),
    );
    cell(HUD.fear, () => {
      c.font = "900 54px sans-serif";
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.lineJoin = "round";
      c.strokeStyle = "#4a0000";
      c.lineWidth = 9;
      c.strokeText("!", 32, 35);
      c.fillStyle = "#ff3a2a";
      c.fillText("!", 32, 35);
    });
    cell(HUD.eye, () => {
      outline(() => {
        c.beginPath();
        c.moveTo(5, 32);
        c.quadraticCurveTo(32, 6, 59, 32);
        c.quadraticCurveTo(32, 58, 5, 32);
        c.closePath();
      }, "#ffe9b0");
      c.fillStyle = "#3a6cff";
      c.beginPath();
      c.arc(32, 32, 11, 0, TAU);
      c.fill();
      c.fillStyle = "#101010";
      c.beginPath();
      c.arc(32, 32, 5, 0, TAU);
      c.fill();
    });
    cell(HUD.notes, () => {
      c.fillStyle = "#ffe45a";
      c.strokeStyle = "#3a2a00";
      c.lineWidth = 3;
      for (const [x, y] of [[20, 46], [44, 40]]) {
        c.beginPath();
        c.ellipse(x, y, 8, 6, -0.4, 0, TAU);
        c.fill();
        c.stroke();
      }
      c.lineWidth = 5;
      c.strokeStyle = "#ffe45a";
      c.beginPath();
      c.moveTo(27, 45);
      c.lineTo(27, 12);
      c.lineTo(51, 8);
      c.lineTo(51, 39);
      c.stroke();
    });
    cell(HUD.disarm, () => {
      outline(() => {
        c.beginPath();
        c.moveTo(32, 6);
        c.lineTo(54, 14);
        c.quadraticCurveTo(53, 44, 32, 60);
        c.quadraticCurveTo(11, 44, 10, 14);
        c.closePath();
      }, "#b48cff");
      c.strokeStyle = "#2a1040";
      c.lineWidth = 5;
      c.beginPath();
      c.moveTo(34, 8);
      c.lineTo(26, 30);
      c.lineTo(38, 36);
      c.lineTo(30, 58);
      c.stroke();
    });
    cell(HUD.stun, () => {
      for (const [x, y, r] of [[18, 30, 10], [44, 24, 9], [36, 46, 8]]) {
        c.save();
        c.translate(x, y);
        outline(() => {
          c.beginPath();
          for (let k = 0; k < 10; k++) {
            const rr = k % 2 ? r * 0.45 : r, a = -Math.PI / 2 + (k * Math.PI) / 5;
            c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
          }
          c.closePath();
        }, "#ffe04a", "#4a3000", 4);
        c.restore();
      }
    });
    cell(HUD.drop, () =>
      outline(() => {
        c.beginPath();
        c.moveTo(32, 6);
        c.bezierCurveTo(40, 22, 50, 30, 50, 40);
        c.arc(32, 40, 18, 0, Math.PI);
        c.bezierCurveTo(14, 30, 24, 22, 32, 6);
        c.closePath();
      }, "#5fc8ff", "#0c2a44"),
    );
    cell(HUD.ghost, () =>
      outline(() => {
        c.beginPath();
        c.moveTo(12, 56);
        c.lineTo(12, 30);
        c.arc(32, 30, 20, Math.PI, 0);
        c.lineTo(52, 56);
        c.lineTo(45, 49);
        c.lineTo(38, 56);
        c.lineTo(32, 49);
        c.lineTo(26, 56);
        c.lineTo(19, 49);
        c.closePath();
      }, "rgba(235,240,255,0.95)", "#2a2f44"),
    );
    cell(HUD.arrow, () =>
      outline(() => {
        c.beginPath();
        c.moveTo(32, 4);
        c.lineTo(58, 32);
        c.lineTo(42, 32);
        c.lineTo(42, 60);
        c.lineTo(22, 60);
        c.lineTo(22, 32);
        c.lineTo(6, 32);
        c.closePath();
      }, "#ffd23a", "#5a3000", 6),
    );
    cell(HUD.crown, () =>
      outline(() => {
        c.beginPath();
        c.moveTo(8, 52);
        c.lineTo(10, 16);
        c.lineTo(22, 32);
        c.lineTo(32, 10);
        c.lineTo(42, 32);
        c.lineTo(54, 16);
        c.lineTo(56, 52);
        c.closePath();
      }, "#ffcf2e", "#5a3400", 5),
    );
    cell(HUD.shield, () =>
      outline(() => {
        c.beginPath();
        c.arc(32, 32, 24, 0, TAU);
      }, "rgba(111,240,216,0.9)", "#0f4a44", 5),
    );
    cell(HUD.haste, () => {
      c.strokeStyle = "#fff";
      c.lineCap = "round";
      for (const [y, w] of [[18, 34], [32, 44], [46, 30]]) {
        c.lineWidth = 9;
        c.strokeStyle = "#1c1410";
        c.beginPath();
        c.moveTo(56 - w, y);
        c.lineTo(56, y);
        c.stroke();
        c.lineWidth = 5;
        c.strokeStyle = "#9fffb0";
        c.beginPath();
        c.moveTo(56 - w, y);
        c.lineTo(56, y);
        c.stroke();
      }
    });
    hudTex = new THREE.CanvasTexture(cv);
    hudTex.premultiplyAlpha = true;
    hudTex.encoding = THREE.sRGBEncoding;
    hudTex.minFilter = THREE.LinearMipmapLinearFilter;
    hudTex.generateMipmaps = true;
    return hudTex;
  }

  /* ------------------------------------------------------------------ formes de secours */
  function fallbackTower(family, level, spec) {
    // Forme de secours : deux maillages fusionnés (socle fixe, bête qui pivote vers sa cible).
    const MK = VIEW._map, T4 = MK.T4;
    const g = new THREE.Group();
    const base = [], body = [];
    const k = 0.78 + level * 0.07;
    const S = (x, y, z, sx, sy, sz, rx, ry, rz) => T4(x, y, z, rx, ry, rz, sx, sy, sz);
    const ell = (list, rx, ry, rz, hex, x, y, z, rot) => list.push({ g: new THREE.SphereGeometry(1, 12, 9), color: hex, m: S(x, y, z, rx, ry, rz, rot && rot[0], rot && rot[1], rot && rot[2]), shade: 0.25 });
    const put = (list, geo, hex, m, shade) => list.push({ g: geo, color: hex, m, shade: shade || 0 });
    let height = 2;
    const mz = new THREE.Vector3();
    if (family === "boar") {
      // marcassin → sanglier : corps trapu, crête sombre, groin rose, défenses blanches
      put(base, new THREE.CylinderGeometry(1.2, 1.3, 0.2, 16), "#5a3d26", T4(0, 0.1, 0));
      put(base, new THREE.TorusGeometry(1.2, 0.12, 6, 20), "#7a5a3a", T4(0, 0.2, 0, Math.PI / 2));
      ell(body, 0.62, 0.55, 0.9, spec === "A" ? "#8a4a30" : "#8a6444", 0, 0.78, -0.15);
      ell(body, 0.22, 0.2, 0.85, spec === "A" ? "#c0392b" : "#3f2a1c", 0, 1.28, -0.2);
      for (const [sx, sz] of [[-0.35, 0.35], [0.35, 0.35], [-0.35, -0.6], [0.35, -0.6]]) put(body, new THREE.CylinderGeometry(0.1, 0.09, 0.45, 6), "#3a2616", T4(sx, 0.3, sz));
      ell(body, 0.42, 0.4, 0.5, "#6e4c32", 0, 0.95, 0.72);
      put(body, new THREE.CylinderGeometry(0.19, 0.22, 0.24, 12), "#e8a48f", T4(0, 0.89, 1.24, Math.PI / 2));
      for (const sx of [-1, 1]) {
        put(body, new THREE.ConeGeometry(0.06, 0.34 + level * 0.03, 6), "#fff8e6", T4(sx * 0.2, 0.93, 1.22, -0.5 - Math.PI / 2 + Math.PI / 2));
        put(body, new THREE.ConeGeometry(0.13, 0.28, 4), "#4a3220", T4(sx * 0.26, 1.33, 0.6, 0, 0, -sx * 0.4));
        put(body, new THREE.SphereGeometry(0.055, 6, 5), "#140c08", T4(sx * 0.17, 1.09, 1.05));
      }
      if (spec === "B") {
        put(body, new THREE.BoxGeometry(0.14, 0.9, 0.14), "#9a7048", T4(0, 1.65, -0.4));
        put(body, new THREE.IcosahedronGeometry(0.28, 0), "#6a4a20", T4(0, 2.15, -0.4));
      }
      mz.set(0, 0.9, 1.42);
      height = 1.9;
    } else if (family === "swan") {
      put(base, new THREE.TorusGeometry(0.95, 0.3, 8, 18), "#8a6a40", T4(0, 0.05, 0, Math.PI / 2), 0.3);
      const col = spec === "B" ? "#26262e" : spec === "A" ? "#dff4ff" : level === 1 ? "#c9c6be" : "#f7f5ee";
      ell(body, 0.62, 0.5, 0.95, col, 0, 0.5, -0.15);
      for (const sx of [-1, 1]) ell(body, 0.3, 0.26, 0.75, col, sx * 0.42, 0.72, -0.25, [0, 0, -sx * 0.5]);
      const neck = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.6, 0.35), new THREE.Vector3(0, 1.2, 0.5), new THREE.Vector3(0, 1.7, 0.3), new THREE.Vector3(0, 1.9, 0.55)]), 12, 0.13, 6);
      put(body, neck, col, T4());
      ell(body, 0.22, 0.2, 0.26, col, 0, 1.9, 0.58);
      put(body, new THREE.ConeGeometry(0.09, 0.34, 8), spec === "B" ? "#e0302a" : "#ff8a1a", T4(0, 1.87, 0.88, Math.PI / 2));
      for (const sx of [-1, 1]) put(body, new THREE.SphereGeometry(0.04, 6, 5), "#140c08", T4(sx * 0.13, 1.96, 0.7));
      mz.set(0, 1.87, 1.04);
      height = 2.2;
    } else {
      // berger australien merle, queue de flammes ; dragon (ailes, cornes) à partir du niveau 4
      put(base, new THREE.DodecahedronGeometry(0.95, 0).scale(1.3, 0.42, 1.2), "#8d8983", T4(0, 0.28, 0), 0.3);
      const coat = spec === "A" ? "#b8452a" : spec === "B" ? "#4a6ab8" : "#8a8f9e";
      ell(body, 0.48, 0.46, 0.78, coat, 0, 1.0, -0.1);
      ell(body, 0.26, 0.24, 0.32, "#c8783a", 0.22, 1.12, 0.1);
      ell(body, 0.22, 0.22, 0.3, "#2a2a30", -0.2, 1.2, -0.3);
      for (const [sx, sz] of [[-0.25, 0.35], [0.25, 0.35], [-0.25, -0.45], [0.25, -0.45]]) put(body, new THREE.CylinderGeometry(0.1, 0.09, 0.62, 6), "#f2ece0", T4(sx, 0.62, sz));
      ell(body, 0.34, 0.32, 0.34, coat, 0, 1.45, 0.55);
      ell(body, 0.2, 0.16, 0.26, "#f4efe6", 0, 1.37, 0.81);
      put(body, new THREE.SphereGeometry(0.07, 6, 5), "#1a1414", T4(0, 1.43, 1.05));
      for (const sx of [-1, 1]) put(body, new THREE.ConeGeometry(0.12, 0.34, 4), "#3a3036", T4(sx * 0.2, 1.79, 0.5, 0, 0, -sx * 0.25));
      put(body, new THREE.SphereGeometry(0.06, 6, 5), "#3a8aff", T4(-0.14, 1.55, 0.82));
      put(body, new THREE.SphereGeometry(0.06, 6, 5), "#6a3a1a", T4(0.14, 1.55, 0.82));
      put(body, new THREE.ConeGeometry(0.22, 0.7, 8), spec === "B" ? "#7ab8ff" : "#ffb040", T4(0, 1.3, -0.95, -2.2));
      if (level >= 4)
        for (const sx of [-1, 1]) {
          put(body, new THREE.ConeGeometry(0.55, 1.4, 3), spec === "B" ? "#3a5ab0" : "#b03a24", T4(sx * 0.8, 1.55, -0.25, 0.2, 0, sx * 1.15, 1, 1, 0.18), 0.2);
          put(body, new THREE.ConeGeometry(0.06, 0.3, 5), "#f0e0c0", T4(sx * 0.12, 1.79, 0.65, -0.5));
        }
      mz.set(0, 1.39, 1.07);
      height = level >= 4 ? 2.6 : 2.0;
    }
    const baseMesh = MK.buildMerged(base, "Socle");
    const bodyGroup = new THREE.Group();
    const bodyMesh = MK.buildMerged(body, "Bête");
    bodyGroup.add(bodyMesh);
    const muzzle = new THREE.Object3D();
    muzzle.position.copy(mz);
    bodyGroup.add(muzzle);
    g.add(baseMesh, bodyGroup);
    g.scale.setScalar(k);
    let yaw = 0, want = 0, kick = 0, hop = 0, frenzy = false;
    return {
      object: g,
      height: height * k,
      muzzle,
      update(dt, time) {
        yaw = turn(yaw, want, dt * 7);
        bodyGroup.rotation.y = yaw;
        kick = Math.max(0, kick - dt * 5);
        hop = Math.max(0, hop - dt * 1.6);
        bodyMesh.position.z = kick * 0.18;
        bodyMesh.scale.set(1, 1 + (frenzy ? 0.04 * Math.sin(time * 30) : 0), 1);
        bodyGroup.position.y = Math.abs(Math.sin(hop * 9)) * hop * 0.8;
      },
      aim(y) {
        want = y;
      },
      attack() {
        kick = 1;
        return 0.1;
      },
      setSelected() {},
      setFrenzy(f) {
        frenzy = !!f;
      },
      celebrate() {
        hop = 1;
      },
      dispose() {
        baseMesh.geometry.dispose();
        bodyMesh.geometry.dispose();
      },
    };
  }

  const ACT_COL = { fermier: "#3f6fb0", quad: "#c83a2a", cowboy: "#8a5a2a", vache: "#f2f2f2", druide: "#eeeee4", bigoudene: "#1c1c1c", chasseur: "#5f7a3a", rugbyman: "#2a4ab0", sonneur: "#1f3a7a", pompier: "#c8201a", canard: "#f2d23a" };
  function fallbackActor(type, champion, boss) {
    // Forme de secours : un maillage fusionné (monture éventuelle, corps, tête, couronne).
    const MK = VIEW._map, T4 = MK.T4;
    const g = new THREE.Group();
    const col = ACT_COL[type] || "#666";
    const mount = type === "quad" || type === "vache" || type === "canard";
    const bodyY = mount ? 0.9 : 0.55;
    const parts = [];
    if (mount) parts.push({ g: new THREE.BoxGeometry(0.9, 0.6, 1.6), color: type === "quad" ? "#d23a1a" : type === "vache" ? "#f4f4f4" : "#f2d23a", m: T4(0, 0.5, 0), shade: 0.3 });
    parts.push({ g: new THREE.CylinderGeometry(0.3, 0.38, 0.9, 10), color: col, m: T4(0, bodyY + 0.45, 0), shade: 0.3 });
    parts.push({ g: new THREE.SphereGeometry(0.3, 12, 10), color: "#f0c9a0", m: T4(0, bodyY + 1.15, 0) });
    if (champion || boss) parts.push({ g: new THREE.CylinderGeometry(0.22, 0.28, 0.2, 8), color: "#ffcf2e", m: T4(0, bodyY + 1.5, 0) });
    const inner = MK.buildMerged(parts, "Ennemi (secours)");
    g.add(inner);
    const anchor = new THREE.Object3D();
    anchor.position.set(0, bodyY + 1.75, 0);
    g.add(anchor);
    let t = 0, dead = 0;
    return {
      object: g,
      height: bodyY + 1.5,
      carryAnchor: anchor,
      update(dt, time, s) {
        t += dt * (s && s.moving ? 9 : 2);
        inner.position.y = s && s.moving ? Math.abs(Math.sin(t)) * 0.12 : 0;
        if (dead) {
          dead = Math.min(1, dead + dt * 3);
          inner.rotation.x = -dead * 1.4;
        }
      },
      event(name) {
        if (name === "die") dead = 0.01;
      },
      release() {
        g.parent && g.parent.remove(g);
        inner.geometry.dispose();
      },
    };
  }

  function fallbackGem(color) {
    const MK = VIEW._map;
    const m = new THREE.Mesh(MK.gemGeometry(), MK.gemMaterial(color));
    m.castShadow = true;
    const g = new THREE.Group();
    g.add(m);
    g.scale.setScalar(1.25);
    let st = "lair";
    return {
      object: g,
      update(dt, time) {
        m.rotation.y += dt * (st === "ground" ? 1.6 : 2.5);
        m.position.y = st === "ground" ? 0.35 + Math.sin(time * 3 + color) * 0.08 : 0;
      },
      setState(s) {
        st = s;
      },
    };
  }

  let SHOT_GEO = null;
  function fallbackShot(kind, root) {
    if (!SHOT_GEO) {
      const spiky = new THREE.IcosahedronGeometry(0.28, 0);
      SHOT_GEO = { spiky, ball: new THREE.SphereGeometry(0.26, 12, 10), cone: new THREE.ConeGeometry(0.14, 0.7, 6).rotateX(Math.PI / 2) };
    }
    const spec = {
      chestnut: ["spiky", "#7a5a2a", 0, 1],
      bigChestnut: ["spiky", "#6a4a20", 0, 1.8],
      waterJet: ["ball", "#5fd0ff", 0.6, 1],
      iceShard: ["cone", "#bff4ff", 0.8, 1],
      darkWater: ["ball", "#6a3aa8", 0.7, 1.1],
      fireball: ["ball", "#ff7a1a", 1.4, 1],
      dragonFire: ["ball", "#ff5a0a", 1.6, 1.4],
      blueFire: ["ball", "#4a8aff", 1.6, 1.3],
    }[kind] || ["ball", "#ffffff", 1, 1];
    const mat = spec[2] ? PTMT.glow(spec[1], spec[2]) : PTMT.solid(spec[1]);
    const m = new THREE.Mesh(SHOT_GEO[spec[0]], mat);
    m.scale.setScalar(spec[3]);
    root.add(m);
    return {
      set(p, d) {
        m.position.copy(p);
        if (d && d.lengthSq() > 1e-8) m.lookAt(_v4.copy(p).add(d));
        m.rotation.z += 0.3;
      },
      release() {
        root.remove(m);
      },
    };
  }

  /* ------------------------------------------------------------------ couche DOM */
  let styleDone = false;
  function injectStyle() {
    if (styleDone || typeof document === "undefined") return;
    styleDone = true;
    const s = document.createElement("style");
    s.textContent = `
      .ptmt-vlayer { position: absolute; left: 0; top: 0; pointer-events: none; overflow: hidden; z-index: 1; }
      .ptmt-fl { position: absolute; left: 0; top: 0; font: 800 16px/1 "Lilita One", system-ui, sans-serif; color: #fff; white-space: nowrap;
        text-shadow: 0 2px 0 rgba(0,0,0,.6), 0 0 3px rgba(0,0,0,.9), 1px 0 0 rgba(0,0,0,.6), -1px 0 0 rgba(0,0,0,.6);
        animation: ptmt-fl-up 1.15s ease-out forwards; will-change: transform, opacity; }
      .ptmt-fl.gold { color: #ffd84a; font-size: 18px; }
      .ptmt-fl.miss { color: #e6eeff; font-size: 14px; }
      .ptmt-fl.crit { color: #ff7a3a; font-size: 20px; }
      .ptmt-fl.heal { color: #8dff8a; font-size: 15px; }
      .ptmt-fl.info { color: #bfe8ff; font-size: 15px; }
      @keyframes ptmt-fl-up {
        0% { opacity: 0; transform: translate(-50%, 0) scale(.55); }
        14% { opacity: 1; transform: translate(-50%, -10px) scale(1.18); }
        30% { transform: translate(-50%, -16px) scale(1); }
        100% { opacity: 0; transform: translate(-50%, -52px) scale(1); }
      }
      .ptmt-boss { position: absolute; left: 0; top: 0; font: 400 14px/1 "Lilita One", system-ui, sans-serif; color: #ffe07a; white-space: nowrap;
        text-shadow: 0 2px 0 rgba(0,0,0,.7), 0 0 4px rgba(0,0,0,.9); letter-spacing: .02em; }
    `;
    document.head.appendChild(s);
  }

  /* ------------------------------------------------------------------ la vue */
  function View(o) {
    const MK = VIEW._map;
    this.renderer = o.renderer;
    this.scene = o.scene;
    this.map = o.map;
    this.mobile = !!o.mobile;
    this.quality = o.quality || (this.mobile ? "low" : "high");
    this.high = this.quality === "high";
    const r = this.renderer;
    r.shadowMap.enabled = this.high;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    if (!this.scene.background) this.scene.background = lin("#1f3319");
    this.world = new MK.World({ scene: this.scene, renderer: r, map: this.map, mobile: this.mobile, quality: this.quality, texPerTile: o.texPerTile });
    this.cam = new VIEW._Camera({ elevation: o.elevation });
    this.camera = this.cam.camera;
    this.root = new THREE.Group();
    this.root.name = "PTMT:entités";
    this.scene.add(this.root);
    // effets : initialisés avec la caméra de la vue
    this.ownFx = false;
    if (PTMT.fx && PTMT.fx.init && o.fx !== false) {
      try {
        PTMT.fx.init(this.scene, this.camera, r, { mobile: this.mobile });
        this.ownFx = true;
        if (PTMT.fx.world && PTMT.fx.world.ensureCells) PTMT.fx.world.ensureCells();
      } catch (e) {
        console.warn("Effets indisponibles", e);
      }
    }
    this.towers = new Map();
    this.enemies = new Map();
    this.gems = new Map();
    this.projectiles = new Map();
    this.areas = new Map();
    this.dying = [];
    this.fading = [];
    this.anims = [];
    this.hints = new Set();
    this.grid = this.map.grid.map((row) => row);
    this.rangeTower = null;
    this.rangeValue = null;
    this.previewState = null;
    this.targetState = null;
    this.ghosts = {};
    this.stealFlash = 0;
    this.time = 0;
    this.real = 0;
    this.lastReal = performance.now();
    this.frenzy = false;
    this.tileSig = "";
    this.lastLairCount = -1;
    this.buildHud();
    this.buildDom();
    this.meteors = [];
    const el = r.domElement;
    this.resize(el.clientWidth || (typeof innerWidth !== "undefined" ? innerWidth : 1280), el.clientHeight || (typeof innerHeight !== "undefined" ? innerHeight : 800), o.insets || {});
    this.updateTiles(true);
  }
  const P = View.prototype;
  VIEW.View = View;
  VIEW.create = function (o) {
    return new View(o);
  };

  /* --------------------------------------------------- repères */
  P.tileTop = function (i, j) {
    return this.world.tileTop(i, j);
  };
  P.toWorld = function (x, y, out) {
    return (out || new THREE.Vector3()).set(toX(x), this.world.groundAt(x, y, false), toZ(y));
  };
  P.worldToScreen = function (x, y, lift) {
    _v1.set(toX(x), this.world.groundAt(x, y, false) + (lift || 0), toZ(y));
    return this.cam.project(_v1, { x: 0, y: 0 });
  };
  P.pick = function (clientX, clientY) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const tws = [];
    for (const v of this.towers.values()) {
      const o = v.model.object;
      tws.push({ id: v.id, i: v.i, j: v.j, x: o.position.x, z: o.position.z, base: v.top, top: v.top + Math.max(1.2, v.model.height || 2) * o.scale.y, r: 1.2 });
    }
    return this.cam.pick(clientX, clientY, rect, this.world, tws);
  };
  P.resize = function (w, h, insets) {
    const r = this.renderer;
    const pr = Math.min((typeof devicePixelRatio !== "undefined" && devicePixelRatio) || 1, this.mobile ? 1.5 : 2);
    r.setPixelRatio(pr);
    r.setSize(w, h, false);
    this.cam.frame(w, h, insets);
    this.world.setSunAzimuth(this.cam.az);
    this.world.ov.uPxM.value = this.cam.pxPerM * pr;
    // surimpressions un peu plus grandes quand la carte est petite (téléphone)
    this.ovScale = clamp(15 / Math.max(1, this.cam.pxPerM), 1, 2.1);
    this.w = w;
    this.h = h;
    if (this.layer) {
      const el = r.domElement;
      this.layer.style.left = (el.offsetLeft || 0) + "px";
      this.layer.style.top = (el.offsetTop || 0) + "px";
      this.layer.style.width = w + "px";
      this.layer.style.height = h + "px";
    }
  };

  /* --------------------------------------------------- surimpressions (sprites) */
  P.buildHud = function () {
    const gfx = PTMT.gfx;
    if (!gfx || !gfx.SpriteBatch || !gfx.newSpriteMaterial) return;
    const mat = gfx.newSpriteMaterial();
    mat.uniforms = Object.assign({}, mat.uniforms, { uAtlas: { value: hudAtlas() }, uTime: { value: 0 } });
    mat.depthTest = false;
    mat.depthWrite = false;
    this.hud = new gfx.SpriteBatch(this.mobile ? 900 : 1600, "immediate", mat);
    this.hud.mesh.renderOrder = 60;
    this.hud.mesh.name = "PTMT:surimpressions";
    this.root.add(this.hud.mesh);
  };
  P.buildDom = function () {
    if (typeof document === "undefined") return;
    const el = this.renderer.domElement;
    if (!el.parentElement) return;
    injectStyle();
    const layer = document.createElement("div");
    layer.className = "ptmt-vlayer";
    el.parentElement.insertBefore(layer, el.nextSibling);
    this.layer = layer;
    this.bossLabels = new Map();
  };
  /** Texte flottant au-dessus d'un point de la carte (x, y cases ; lift m) : or, Raté !, Critique !… */
  P.floatText = function (x, y, lift, text, cls) {
    if (!this.layer) return;
    const p = this.worldToScreen(x, y, lift);
    const d = document.createElement("div");
    d.className = "ptmt-fl " + (cls || "");
    d.textContent = text;
    d.style.left = p.x.toFixed(1) + "px";
    d.style.top = p.y.toFixed(1) + "px";
    d.addEventListener("animationend", () => d.remove());
    this.layer.appendChild(d);
    if (this.layer.childElementCount > 60) this.layer.firstElementChild.remove();
  };
  P.floatAtWorld = function (v3, text, cls) {
    if (!this.layer) return;
    const p = this.cam.project(v3, { x: 0, y: 0 });
    const d = document.createElement("div");
    d.className = "ptmt-fl " + (cls || "");
    d.textContent = text;
    d.style.left = p.x.toFixed(1) + "px";
    d.style.top = p.y.toFixed(1) + "px";
    d.addEventListener("animationend", () => d.remove());
    this.layer.appendChild(d);
  };

  /* --------------------------------------------------- tours */
  P.makeTowerModel = function (family, level, spec) {
    const f = PTMT.models && PTMT.models.ctTower;
    if (typeof f === "function") {
      try {
        const m = f(family, level, spec || null);
        if (m && m.object) return m;
      } catch (e) {
        if (!this._warnTower) console.warn("PTMT.models.ctTower :", e);
        this._warnTower = true;
      }
    }
    return fallbackTower(family, level, spec);
  };
  P.towerStats = function (tw) {
    const D = DATA();
    return D && D.towerLevel ? D.towerLevel(tw.family, tw.level, tw.spec) : null;
  };
  P.towerRange = function (tw) {
    if (typeof tw.range === "number") return tw.range;
    const st = this.towerStats(tw);
    const ch = this.grid[tw.j] ? this.grid[tw.j][tw.i] : ".";
    const high = ch === "H" || ch === "h";
    const D = DATA();
    return (st ? st.range : 2.5) * (high ? 1 + ((D && D.high && D.high.range) || 0.3) : 1);
  };
  P.roadYaw = function (i, j) {
    let best = null, bd = 1e9;
    for (let dj = -2; dj <= 2; dj++)
      for (let di = -2; di <= 2; di++) {
        const c = this.grid[j + dj] && this.grid[j + dj][i + di];
        if (!c || !"#=EL".includes(c)) continue;
        const d = di * di + dj * dj;
        if (d < bd) (bd = d), (best = [di, dj]);
      }
    return best ? Math.atan2(best[0], best[1]) : 0;
  };
  P.placeTower = function (v) {
    const o = v.model.object;
    o.position.set(toX(v.i + 0.5), v.top, toZ(v.j + 0.5));
    this.root.add(o);
    if (v.model.aim) v.model.aim(v.yaw);
    if (!this.high) {
      if (v.blob === undefined || v.blob < 0) v.blob = this.world.addBlob(o.position.x + 0.5, o.position.z - 0.3, v.top, 1.5, 1.3, 0.55);
    }
  };
  P.newTower = function (tw) {
    const v = { id: tw.id, i: tw.i, j: tw.j, family: tw.family, level: tw.level, spec: tw.spec || null, key: tw.family + tw.level + (tw.spec || ""), top: this.tileTop(tw.i, tw.j), yaw: this.roadYaw(tw.i, tw.j), pop: 0, frenzy: false, selected: false };
    v.model = this.makeTowerModel(tw.family, tw.level, tw.spec);
    this.placeTower(v);
    this.towers.set(tw.id, v);
    return v;
  };
  P.removeTower = function (v) {
    const o = v.model.object;
    o.parent && o.parent.remove(o);
    try {
      v.model.dispose && v.model.dispose();
    } catch (e) {}
    if (v.blob >= 0) this.world.removeBlob(v.blob);
    this.towers.delete(v.id);
  };
  P.syncTowers = function (st, dt, time) {
    const seen = this._seenT || (this._seenT = new Set());
    seen.clear();
    for (const tw of st.towers || []) {
      seen.add(tw.id);
      let v = this.towers.get(tw.id);
      const key = tw.family + tw.level + (tw.spec || "");
      if (!v) {
        v = this.newTower(tw);
        v.pop = 0.001;
      } else if (v.key !== key) {
        // montée de niveau : nouveau modèle, célébration, colonne dorée
        const old = v.model;
        old.object.parent && old.object.parent.remove(old.object);
        try {
          old.dispose && old.dispose();
        } catch (e) {}
        v.model = this.makeTowerModel(tw.family, tw.level, tw.spec);
        v.key = key;
        v.level = tw.level;
        v.spec = tw.spec || null;
        v.frenzy = false;
        v.selected = false;
        this.placeTower(v);
        if (v.model.celebrate) v.model.celebrate();
        _v1.set(toX(v.i + 0.5), v.top, toZ(v.j + 0.5));
        burst("goldColumn", _v1, { radius: 1.5, height: 5 }) || burst("sparkle", _v1, { color: "#ffe07a", radius: 1.4 });
      }
      // visée : vers la cible, sinon angle fourni par la simulation
      // visée : angle monde de la simulation (0 = +Z), sinon vers la cible affichée
      const tgt = tw.targetId !== undefined && tw.targetId !== null ? this.enemies.get(tw.targetId) : null;
      if (typeof tw.aim === "number") v.yaw = tw.aim;
      else if (tgt) v.yaw = Math.atan2(tgt.obj.position.x - v.model.object.position.x, tgt.obj.position.z - v.model.object.position.z);
      if (v.model.aim) v.model.aim(v.yaw);
      const fr = !!st.frenzy;
      if (fr !== v.frenzy) {
        v.frenzy = fr;
        v.model.setFrenzy && v.model.setFrenzy(fr);
      }
      const sel = this.rangeTower === tw.id;
      if (sel !== v.selected) {
        v.selected = sel;
        v.model.setSelected && v.model.setSelected(sel);
      }
      // apparition en rebond
      if (v.pop > 0) {
        v.pop = Math.min(1, v.pop + dt * 3.2);
        const k = v.pop, e = k < 1 ? 1 - Math.pow(1 - k, 3) * Math.cos(k * 9) : 1;
        v.model.object.scale.setScalar(Math.max(0.05, e));
        if (k >= 1) v.pop = 0;
      }
      if (v.model.update) v.model.update(dt, time);
    }
    for (const v of this.towers.values()) if (!seen.has(v.id)) this.removeTower(v);
  };

  /* --------------------------------------------------- ennemis */
  P.makeActor = function (type, champion, boss) {
    const A = PTMT.actors;
    if (A && A.create && A.ready !== false) {
      try {
        const a = A.create(type, !!champion, !!boss);
        if (a && a.object) return a;
      } catch (e) {
        /* type inconnu des anciens personnages : on essaie la silhouette la plus proche */
      }
      const old = OLD_ACTOR[type];
      if (old)
        try {
          const a = A.create(old, !!(champion || boss));
          if (a && a.object) return a;
        } catch (e) {}
    }
    return fallbackActor(type, champion, boss);
  };
  P.newEnemy = function (e) {
    const actor = this.makeActor(e.type, e.champion, e.boss);
    const obj = actor.object;
    const base = 0.95 * (e.boss ? 1.6 : e.champion ? 1.3 : 1);
    obj.scale.setScalar(base);
    const v = {
      id: e.id, type: e.type, actor, obj, base, x: e.x, y: e.y, px: e.x, py: e.y, yaw: 0, dying: 0, champion: !!e.champion, boss: !!e.boss,
      s: { speed: 0, moving: false, carrying: false, water: false, slow: 0, freeze: 0, burn: 0, fear: 0, invisible: 0, barrier: 0, haste: 0, stun: 0, disarmed: 0, radiance: 0, hp: 1, frozen: false, burning: false, inWater: false, hpFrac: 1, untargetable: false, wet: false },
      hp: 1, barrier: 0, anchor: actor.carryAnchor || null, height: (actor.height || 2) * base, e,
    };
    if (typeof e.dir === "number") v.yaw = e.dir;
    obj.position.set(toX(e.x), this.world.groundAt(e.x, e.y, !!e.water), toZ(e.y));
    obj.rotation.y = v.yaw;
    this.root.add(obj);
    this.enemies.set(e.id, v);
    return v;
  };
  P.releaseEnemy = function (v) {
    // les gemmes accrochées sont reprises par la vue des gemmes
    for (const g of this.gems.values()) if (g.attachedTo === v) this.detachGem(g);
    try {
      v.actor.release && v.actor.release();
    } catch (e) {}
    v.obj.parent && v.obj.parent.remove(v.obj);
    if (this.bossLabels && this.bossLabels.has(v.id)) {
      this.bossLabels.get(v.id).remove();
      this.bossLabels.delete(v.id);
    }
  };
  P.fillState = function (v, e) {
    const s = v.s, fx = e.fx || {};
    s.speed = (e.speed || 0) * TILE;
    s.moving = !!e.moving;
    s.carrying = e.carrying !== null && e.carrying !== undefined && e.carrying !== false;
    s.water = !!e.water;
    s.slow = +fx.slow || 0;
    s.freeze = +fx.freeze || 0;
    s.burn = +fx.burn || 0;
    s.fear = +fx.fear || 0;
    s.invisible = +fx.invisible || 0;
    s.haste = +fx.haste || 0;
    s.stun = +fx.stun || 0;
    s.disarmed = +fx.disarmed || 0;
    s.radiance = +fx.radiance || 0;
    s.barrier = e.barrierMax ? clamp(e.barrier / e.barrierMax, 0, 1) : 0;
    s.hp = e.hpMax ? clamp(e.hp / e.hpMax, 0, 1) : 1;
    // noms des anciens personnages (compatibilité du banc d'essai)
    s.frozen = s.freeze > 0;
    s.burning = s.burn > 0;
    s.inWater = s.water;
    s.hpFrac = s.hp;
    s.untargetable = s.invisible > 0;
    s.wet = s.slow > 0;
  };
  P.syncEnemies = function (st, dt, time) {
    const k = 1 - Math.exp(-dt * 18);
    for (const e of st.enemies || []) {
      let v = this.enemies.get(e.id);
      if (!v) v = this.newEnemy(e);
      v.e = e;
      v.px = v.x;
      v.py = v.y;
      const jump = Math.abs(e.x - v.x) + Math.abs(e.y - v.y) > 1.5;
      v.x = jump ? e.x : v.x + (e.x - v.x) * k;
      v.y = jump ? e.y : v.y + (e.y - v.y) * k;
      // cap : angle monde fourni par la simulation (0 = +Z), sinon tiré du déplacement
      if (typeof e.dir === "number") v.want = e.dir;
      else {
        const dx = v.x - v.px, dy = v.y - v.py;
        if (dx * dx + dy * dy > 1e-7 && e.moving !== false) v.want = Math.atan2(dx, dy);
      }
      if (v.want !== undefined) v.yaw = turn(v.yaw, v.want, dt * 12);
      v.obj.position.set(toX(v.x), this.world.groundAt(v.x, v.y, !!e.water), toZ(v.y));
      v.obj.rotation.y = v.yaw;
      this.fillState(v, e);
      v.hp = v.s.hp;
      v.barrier = v.s.barrier;
      if (v.actor.update) v.actor.update(dt, time, v.s);
    }
  };
  P.killEnemy = function (v) {
    if (v.dying) return;
    v.dying = 1.05;
    try {
      v.actor.event && v.actor.event("die");
    } catch (e) {}
    this.enemies.delete(v.id);
    this.dying.push(v);
  };
  P.updateDying = function (dt, time) {
    for (let i = this.dying.length - 1; i >= 0; i--) {
      const v = this.dying[i];
      v.dying -= dt;
      v.s.moving = false;
      if (v.actor.update) v.actor.update(dt, time, v.s);
      if (v.dying <= 0) {
        this.releaseEnemy(v);
        this.dying.splice(i, 1);
      }
    }
  };
  P.pruneEnemies = function (st) {
    const seen = this._seenE || (this._seenE = new Set());
    seen.clear();
    for (const e of st.enemies || []) seen.add(e.id);
    for (const v of this.enemies.values())
      if (!seen.has(v.id)) {
        this.enemies.delete(v.id);
        if (v.escaping) {
          v.dying = 0.35;
          this.dying.push(v);
        } else this.releaseEnemy(v);
      }
  };
  P.chest = function (v, frac, out) {
    const o = v.obj.position;
    return (out || new THREE.Vector3()).set(o.x, o.y + v.height * (frac === undefined ? 0.55 : frac), o.z);
  };

  /* --------------------------------------------------- gemmes */
  P.makeGem = function (color) {
    const f = PTMT.models && PTMT.models.gem;
    if (typeof f === "function") {
      try {
        const g = f(color);
        if (g && g.object) return g;
      } catch (e) {}
    }
    return fallbackGem(color);
  };
  P.detachGem = function (g) {
    if (!g.attachedTo) return;
    const o = g.model.object;
    o.getWorldPosition(g.lastPos);
    o.parent && o.parent.remove(o);
    g.attachedTo = null;
    this.root.add(o);
    o.position.copy(g.lastPos);
    o.scale.setScalar(1);
  };
  P.attachGem = function (g, ev) {
    const anchor = ev.anchor;
    const o = g.model.object;
    o.parent && o.parent.remove(o);
    if (anchor) {
      anchor.add(o);
      o.position.set(0, 0, 0);
      o.scale.setScalar(0.8);
    } else {
      ev.obj.add(o);
      o.position.set(0, (ev.height / ev.base) * 1.05, 0);
      o.scale.setScalar(0.8);
    }
    g.attachedTo = ev;
    g.model.setState && g.model.setState("carried");
  };
  P.gemAnim = function (g, from, toFn, dur, arcH, end, trail) {
    this.detachGem(g);
    const o = g.model.object;
    if (o.parent !== this.root) this.root.add(o);
    o.visible = true;
    g.anim = { from: from.clone(), toFn, t: 0, dur, arcH, end, trail, to: new THREE.Vector3() };
    g.model.setState && g.model.setState(trail === "gold" ? "returning" : "carried");
  };
  P.syncGems = function (st, dt, time) {
    const lairInfo = this.world.lairInfo;
    let lairCount = 0, incoming = 0;
    for (const gs of st.gems || []) {
      let g = this.gems.get(gs.id);
      if (!g) {
        g = { id: gs.id, color: gs.color | 0, where: null, model: this.makeGem(gs.color | 0), attachedTo: null, lastPos: new THREE.Vector3(), anim: null };
        g.model.object.visible = false;
        this.root.add(g.model.object);
        this.gems.set(gs.id, g);
      }
      const prev = g.where;
      const now = gs.where;
      const carrier = gs.carrier !== undefined && gs.carrier !== null ? this.enemies.get(gs.carrier) : null;
      if (prev !== now) {
        const o = g.model.object;
        if (now === "carried") {
          if (prev === "lair" || prev === null) {
            const from = this.world.lairSlot(g.color, _v2);
            if (carrier && prev === "lair") this.gemAnim(g, from, () => (carrier.anchor ? carrier.anchor.getWorldPosition(_v3) : this.chest(carrier, 1.05, _v3)), 0.4, 1.6, () => this.attachGem(g, carrier));
            else if (carrier) this.attachGem(g, carrier);
          } else if (prev === "ground") {
            o.getWorldPosition(_v2);
            if (carrier) this.gemAnim(g, _v2, () => (carrier.anchor ? carrier.anchor.getWorldPosition(_v3) : this.chest(carrier, 1.05, _v3)), 0.3, 1.0, () => this.attachGem(g, carrier));
          }
        } else if (now === "ground") {
          if (prev === "carried") {
            this.detachGem(g);
            o.getWorldPosition(_v2);
            const tx = gs.x, ty = gs.y;
            this.gemAnim(g, _v2, () => _v3.set(toX(tx), this.world.groundAt(tx, ty, false), toZ(ty)), 0.45, 0.9, () => {
              g.model.setState && g.model.setState("ground");
              burst("gemSparkle", o.position, { color: g.color });
            });
          } else {
            this.detachGem(g);
            o.visible = true;
            o.position.set(toX(gs.x), this.world.groundAt(gs.x, gs.y, false), toZ(gs.y));
            g.model.setState && g.model.setState("ground");
          }
        } else if (now === "lair") {
          if (prev === "ground") {
            o.getWorldPosition(_v2);
            this.gemAnim(g, _v2, () => this.world.lairSlot(g.color, _v3), 1.1, 5, () => {
              o.visible = false;
              g.model.setState && g.model.setState("lair");
              burst("gemSparkle", this.world.lairSlot(g.color, _v3), { color: g.color });
            }, "gold");
          } else {
            this.detachGem(g);
            o.visible = false;
            g.anim = null;
            g.model.setState && g.model.setState("lair");
          }
        } else if (now === "lost") {
          if (g.attachedTo || prev === "carried") {
            o.getWorldPosition(_v2);
            burst("gemLost", _v2, { color: g.color });
          }
          this.detachGem(g);
          g.anim = null;
          o.visible = false;
        }
        g.where = now;
      }
      // animations en vol
      if (g.anim) {
        const a = g.anim;
        a.t += dt;
        const k = Math.min(1, a.t / a.dur);
        const to = a.toFn();
        const o = g.model.object;
        o.position.lerpVectors(a.from, to, k);
        o.position.y += a.arcH * 4 * k * (1 - k);
        if (a.trail) burst("gemTrail", o.position, { color: g.color, gold: a.trail === "gold" });
        if (k >= 1) {
          g.anim = null;
          a.end && a.end();
        }
      } else if (now === "carried" && !g.attachedTo && carrier) this.attachGem(g, carrier);
      else if (now === "ground" && !g.attachedTo) {
        const o = g.model.object;
        o.visible = true;
        o.position.set(toX(gs.x), this.world.groundAt(gs.x, gs.y, false), toZ(gs.y));
        if (PTMT.fx && PTMT.fx.world && PTMT.fx._ && PTMT.fx._.S) PTMT.fx.world.gemGlow(o.position, g.color, this.real);
      }
      if (now === "lair") {
        if (g.anim) incoming++;
        else lairCount++;
      }
      if (g.model.update) g.model.update(dt, time);
    }
    // gemmes disparues de l'état
    if ((st.gems || []).length !== this.gems.size) {
      const ids = new Set((st.gems || []).map((x) => x.id));
      for (const g of this.gems.values())
        if (!ids.has(g.id)) {
          this.detachGem(g);
          g.model.object.parent && g.model.object.parent.remove(g.model.object);
          this.gems.delete(g.id);
        }
    }
    // tas du moulin
    const total = (st.gems || []).length;
    if (this.world.lair && total > (this.world.lairMax || 0)) this.world.makeLair(total);
    if (this.world.lair && lairCount !== this.lastLairCount) {
      this.lastLairCount = lairCount;
      this.world.lair.setGems && this.world.lair.setGems(lairCount);
    }
    void incoming;
    // alarme : un ennemi sans gemme près du repaire, ou un vol récent
    if (this.world.lair && this.world.lair.alarm && lairInfo) {
      let near = this.stealFlash > 0;
      if (!near)
        for (const v of this.enemies.values()) {
          if (v.s.carrying) continue;
          const dx = v.x - lairInfo.lx, dy = v.y - lairInfo.ly;
          if (dx * dx + dy * dy < 2.4 * 2.4) {
            near = true;
            break;
          }
        }
      if (near !== this.alarm) {
        this.alarm = near;
        this.world.lair.alarm(near);
      }
    }
    this.stealFlash = Math.max(0, this.stealFlash - dt);
  };

  /* --------------------------------------------------- projectiles */
  P.makeShot = function (kind, from, to, arc, dur) {
    const FX = PTMT.fx;
    if (FX && FX._ && FX._.S) {
      if (typeof FX.shot === "function") {
        try {
          const h = FX.shot(kind, from, to, { arc, t: dur });
          if (h) return h;
        } catch (e) {}
      }
      if (typeof FX.projectile === "function") {
        try {
          return FX.projectile(kind);
        } catch (e) {
          const old = OLD_SHOT[kind];
          if (old)
            try {
              return FX.projectile(old);
            } catch (e2) {}
        }
      }
    }
    return fallbackShot(kind, this.root);
  };
  P.syncProjectiles = function (st, dt) {
    const seen = this._seenP || (this._seenP = new Set());
    seen.clear();
    for (const p of st.projectiles || []) {
      seen.add(p.id);
      let v = this.projectiles.get(p.id);
      const tgt = p.targetId !== undefined && p.targetId !== null ? this.enemies.get(p.targetId) : null;
      if (!v) {
        const tv = this.towers.get(p.fromTowerId);
        const start = new THREE.Vector3();
        let splash = 0;
        if (tv) {
          const m = tv.model;
          if (m.muzzle && m.muzzle.getWorldPosition) {
            m.object.updateMatrixWorld(true);
            m.muzzle.getWorldPosition(start);
          } else start.copy(m.object.position).setY(tv.top + (m.height || 2) * 0.8);
          const stt = this.towerStats(tv);
          splash = stt && stt.splash ? stt.splash : 0;
        } else start.set(toX(p.x), this.world.groundAt(p.x, p.y) + 2, toZ(p.y));
        const end = new THREE.Vector3();
        if (tgt) this.chest(tgt, 0.55, end);
        else end.set(toX(p.tx !== undefined ? p.tx : p.x), this.world.groundAt(p.tx !== undefined ? p.tx : p.x, p.ty !== undefined ? p.ty : p.y) + 0.8, toZ(p.ty !== undefined ? p.ty : p.y));
        const dist = start.distanceTo(end);
        v = { id: p.id, kind: p.kind, arc: !!p.arc, start, end, pos: start.clone(), dir: new THREE.Vector3(0, 0, 1), splash, t: 0, dist, handle: null };
        v.handle = this.makeShot(p.kind, start, end, v.arc, dist / 8);
        this.projectiles.set(p.id, v);
      }
      // arrivée : poitrine de la cible (suivie), ou sol visé pour les tirs en cloche
      if (v.arc && p.tx !== undefined) v.end.set(toX(p.tx), this.world.groundAt(p.tx, p.ty) + 0.2, toZ(p.ty));
      else if (tgt) this.chest(tgt, 0.55, v.end);
      let t;
      if (typeof p.p === "number") t = clamp(p.p, 0, 1);
      else {
        // pas de progression : on la déduit de la position simulée
        const sx = toX(p.x) - v.start.x, sz = toZ(p.y) - v.start.z, ex = v.end.x - v.start.x, ez = v.end.z - v.start.z;
        t = clamp((sx * ex + sz * ez) / Math.max(1e-4, ex * ex + ez * ez), 0, 1);
      }
      v.t = t;
      _v1.lerpVectors(v.start, v.end, t);
      if (v.arc) _v1.y += Math.max(2.5, v.dist * 0.35) * 4 * t * (1 - t);
      v.dir.subVectors(_v1, v.pos);
      if (v.dir.lengthSq() < 1e-8) v.dir.subVectors(v.end, v.start);
      v.pos.copy(_v1);
      try {
        v.handle.set && v.handle.set(v.pos, v.dir);
      } catch (e) {}
    }
    for (const v of this.projectiles.values()) {
      if (seen.has(v.id)) continue;
      // impact (s'il n'a pas déjà été montré par l'événement « impact » ou « fizzle »)
      if (!v.impacted) this.impactBurst(v.kind, v.arc || v.t > 0.8 ? v.end : v.pos, v.splash);
      try {
        v.handle.release && v.handle.release();
      } catch (e) {}
      this.projectiles.delete(v.id);
    }
  };

  /** Éclat d'impact d'un projectile (« kind + Hit » des modèles de tours, sinon éclat voisin). */
  P.impactBurst = function (kind, at, splash) {
    const r = Math.max(0.6, splash || 0) * TILE;
    if (burst(kind + "Hit", at, { radius: splash ? splash * TILE : 0.6 * TILE, kind })) return;
    const fb = HIT_FALLBACK[kind] || ["hit", 0.6];
    burst(fb[0], at, { radius: splash ? r * 0.45 : fb[1], family: kind === "iceShard" ? "ice" : kind === "waterJet" || kind === "darkWater" ? "water" : "fire", color: kind === "blueFire" ? "#6aa0ff" : undefined });
  };

  /* --------------------------------------------------- zones */
  P.syncAreas = function (st, dt) {
    const seen = this._seenA || (this._seenA = new Set());
    seen.clear();
    const FX = PTMT.fx;
    const fxOk = !!(FX && FX._ && FX._.S);
    for (const a of st.areas || []) {
      const key = a.id !== undefined ? a.id : a.kind + ":" + (+a.x).toFixed(2) + ":" + (+a.y).toFixed(2);
      seen.add(key);
      let v = this.areas.get(key);
      _v1.set(toX(a.x), this.world.groundAt(a.x, a.y) + 0.02, toZ(a.y));
      const r = (a.r || 1) * TILE;
      if (!v) {
        v = { id: key, kind: a.kind, age: 0, t0: a.t, handle: null };
        if (fxOk) {
          try {
            if (a.kind === "burn" && FX.area) v.handle = FX.area("groundFire", _v1, r);
            else if (a.kind === "meteorWarn" && FX.telegraph) {
              v.handle = FX.telegraph("meteor", _v1, r);
              // météore qui tombe si l'événement « cast » n'a pas été vu
              if (!this.meteors.some((m) => Math.abs(m.x - a.x) + Math.abs(m.y - a.y) < 0.3)) this.startMeteor(a.x, a.y, typeof a.life === "number" ? Math.max(0.15, a.life - (a.t || 0)) : undefined);
            }
          } catch (e) {
            v.handle = null;
          }
        }
        this.areas.set(key, v);
      }
      v.age += dt;
      if (v.handle && v.handle.update) {
        const dur = a.life || a.dur || (typeof v.t0 === "number" && v.t0 > 0 ? v.t0 : 3);
        const t01 = typeof a.life === "number" ? (a.t || 0) / a.life : typeof a.t === "number" && typeof v.t0 === "number" && a.t < v.t0 ? 1 - a.t / Math.max(1e-3, v.t0) : v.age / dur;
        if (v.kind === "burn") v.handle.update(_v1, r, Math.min(0.86, t01));
        else v.handle.update(_v1, r);
      }
    }
    for (const v of this.areas.values()) {
      if (seen.has(v.id)) continue;
      this.areas.delete(v.id);
      if (v.handle && v.kind === "burn" && v.handle.update) this.fading.push({ h: v.handle, t: 0 });
      else if (v.handle && v.handle.release) v.handle.release();
    }
    for (let i = this.fading.length - 1; i >= 0; i--) {
      const f = this.fading[i];
      f.t += dt;
      try {
        f.h.update(null, null, 0.86 + Math.min(1, f.t / 0.35) * 0.14);
      } catch (e) {}
      if (f.t >= 0.35) {
        f.h.release && f.h.release();
        this.fading.splice(i, 1);
      }
    }
  };
  P.startMeteor = function (x, y, delay) {
    const D = DATA();
    const sp = (D && D.SPELLS && D.SPELLS.meteor) || { r: 1.4, delay: 0.8 };
    const W = PTMT.fx && PTMT.fx.world;
    if (!W || !W.meteorFall || !(PTMT.fx._ && PTMT.fx._.S)) return;
    _v1.set(toX(x), this.world.groundAt(x, y) + 0.1, toZ(y));
    const h = W.meteorFall(_v1, delay || sp.delay, sp.r * TILE);
    const m = { x, y, h, t: delay || sp.delay };
    this.meteors.push(m);
  };

  /* --------------------------------------------------- événements */
  P.onEvent = function (ev, st) {
    const en = (id) => (id === undefined || id === null ? null : this.enemies.get(id) || this.dying.find((d) => d.id === id) || null);
    const act = (v, name) => {
      if (v && v.actor.event)
        try {
          v.actor.event(name);
        } catch (e) {}
    };
    switch (ev.type) {
      case "attack": {
        const v = this.towers.get(ev.towerId);
        if (v && v.model.attack) {
          try {
            v.model.attack();
          } catch (e) {}
        }
        break;
      }
      case "hit": {
        const v = en(ev.enemyId);
        if (!v) break;
        if (ev.evaded) {
          act(v, "dodge");
          burst("dodge", this.chest(v, 0.6, _v1), {});
          this.floatAtWorld(this.chest(v, 1.05, _v1), "Raté !", "miss");
        } else {
          act(v, "hit");
          if (ev.crit) this.floatAtWorld(this.chest(v, 1.12, _v1), "Critique !", "crit");
        }
        break;
      }
      case "kill": {
        const v = en(ev.enemyId);
        const x = ev.x !== undefined ? ev.x : v ? v.x : 0, y = ev.y !== undefined ? ev.y : v ? v.y : 0;
        if (v) {
          this.killEnemy(v);
          burst("ko", this.chest(v, 0.5, _v1), {});
        }
        if (ev.gold) {
          _v2.set(toX(x), this.world.groundAt(x, y) + 0.5, toZ(y));
          burst("coins", _v2, { amount: Math.min(12, 2 + ev.gold / 2) });
          this.floatText(x, y, (v ? v.height : 2) + 0.6, "+" + ev.gold, "gold");
        }
        break;
      }
      case "heal": {
        const a = en(ev.fromId), b = en(ev.toId);
        if (a && b) {
          burst("crepe", this.chest(a, 0.8, _v1), { to: this.chest(b, 0.7, _v2) });
          act(a, "heal");
          if (ev.amount) this.floatAtWorld(this.chest(b, 1.1, _v3), "+" + Math.round(ev.amount), "heal");
        }
        break;
      }
      case "smoke": {
        const v = en(ev.enemyId);
        if (v) {
          act(v, "smoke");
          burst("smokeCloud", this.chest(v, 0.3, _v1), { radius: 1.4 }) || burst("smoke", this.chest(v, 0.3, _v1), { radius: 1.4 });
        }
        break;
      }
      case "haste": {
        const v = en(ev.enemyId);
        if (v) {
          act(v, "tune");
          const D = DATA();
          const r = ((D && D.ENEMIES && D.ENEMIES.sonneur && D.ENEMIES.sonneur.ability && D.ENEMIES.sonneur.ability.range) || 2) * TILE * 0.5;
          burst("notes", this.chest(v, 0.3, _v1), { radius: r });
        }
        break;
      }
      case "barrierBreak": {
        const v = en(ev.enemyId);
        if (v) {
          act(v, "barrierBreak");
          burst("barrierPop", this.chest(v, 0.55, _v1), { radius: v.height * 0.55 });
        }
        break;
      }
      case "disarm": {
        const v = en(ev.enemyId);
        if (v) burst("disarm", this.chest(v, 1.15, _v1), {});
        break;
      }
      case "fear": {
        const v = en(ev.enemyId);
        if (v) burst("fearPop", this.chest(v, 1.1, _v1), {});
        break;
      }
      case "freeze": {
        const v = en(ev.enemyId);
        if (v) burst("freezeFlash", this.chest(v, 0, _v1), { radius: 0.9 * TILE * 0.5 });
        break;
      }
      case "impact": {
        // point et rayon exacts de l'impact : l'éclat « kind + Hit » part d'ici
        const pv = this.projectiles.get(ev.projectileId);
        _v1.set(toX(ev.x), this.world.groundAt(ev.x, ev.y), toZ(ev.y));
        if (pv) {
          pv.impacted = true;
          if (!pv.arc && pv.t > 0.5) _v1.copy(pv.end);
        } else _v1.y += 0.9;
        this.impactBurst(ev.kind, _v1, ev.r || 0);
        break;
      }
      case "fizzle": {
        const pv = this.projectiles.get(ev.projectileId);
        if (pv) {
          pv.impacted = true;
          burst("dodge", pv.pos, {});
        }
        break;
      }
      case "lasso": {
        const v = en(ev.enemyId);
        act(v, "lasso");
        break;
      }
      case "barrierUp": {
        const v = en(ev.enemyId);
        if (v) {
          act(v, "barrierUp");
          burst("sparkle", this.chest(v, 0.5, _v1), { color: "#6ff0d8", radius: 0.9 });
        }
        break;
      }
      case "stun": {
        const v = en(ev.enemyId);
        if (v) burst("ko", this.chest(v, 1.05, _v1), {});
        break;
      }
      case "immune": {
        const v = en(ev.enemyId);
        if (v && (!v.immuneT || this.real - v.immuneT > 1.5)) {
          v.immuneT = this.real;
          this.floatAtWorld(this.chest(v, 1.1, _v1), "Immunisé !", "info");
        }
        break;
      }
      case "corpseBomb":
        _v1.set(toX(ev.x), this.world.groundAt(ev.x, ev.y), toZ(ev.y));
        burst("corpseBomb", _v1, { radius: (ev.r || 1) * TILE * 0.6 }) || burst("explosion", _v1, { radius: (ev.r || 1) * TILE * 0.5 });
        break;
      case "meteorImpact":
        _v1.set(toX(ev.x), this.world.groundAt(ev.x, ev.y), toZ(ev.y));
        burst("meteorImpact", _v1, { radius: (ev.r || 1.4) * TILE * 0.8 });
        break;
      case "cast":
        if (ev.spell === "meteor" && ev.x !== undefined) this.startMeteor(ev.x, ev.y, ev.delay);
        break;
      case "cut":
        this.cutTile(ev.i, ev.j);
        break;
      case "frenzy":
        if (ev.on !== false) for (const v of this.towers.values()) burst("frenzyTower", v.model.object.position, { radius: 1.4 });
        break;
      case "build": {
        const v = this.towers.get(ev.towerId);
        if (v) {
          v.pop = 0.001;
          burst("buildDust", v.model.object.position, { radius: 1.6 });
        }
        break;
      }
      case "sell": {
        const v = this.towers.get(ev.towerId);
        if (v) {
          burst("sellPoof", v.model.object.position, { radius: 1.2 }) || burst("smoke", v.model.object.position, { radius: 1.2 });
          if (ev.gold) this.floatText(v.i + 0.5, v.j + 0.5, 2.5, "+" + ev.gold, "gold");
          this.removeTower(v);
        }
        break;
      }
      case "steal": {
        const v = en(ev.enemyId);
        act(v, "pickup");
        this.stealFlash = 1.5;
        break;
      }
      case "pickup": {
        const v = en(ev.enemyId);
        act(v, v && v.type === "cowboy" ? "lasso" : "pickup");
        break;
      }
      case "drop": {
        const g = this.gems.get(ev.gemId);
        if (g && ev.x !== undefined) {
          _v1.set(toX(ev.x), this.world.groundAt(ev.x, ev.y) + 0.3, toZ(ev.y));
          burst("gemSparkle", _v1, { color: g.color });
        }
        break;
      }
      case "escape": {
        const v = en(ev.enemyId);
        if (v) {
          v.escaping = true;
          act(v, "escape");
        }
        if (ev.x !== undefined) {
          _v1.set(toX(ev.x), this.world.groundAt(ev.x, ev.y) + 1, toZ(ev.y));
          const g = this.gems.get(ev.gemId);
          if (g && !g.attachedTo) burst("gemLost", _v1, { color: g.color });
        }
        break;
      }
      case "secretOpen":
        this.world.openSecret();
        for (let j = 0; j < MH; j++) for (let i = 0; i < MW; i++) if (this.grid[j][i] === "s") this.grid[j] = this.grid[j].slice(0, i) + "#" + this.grid[j].slice(i + 1);
        this.updateTiles(true);
        break;
      case "waveStart": {
        const ids = st && st.wave && st.wave.nextEntrances;
        for (const g of this.world.gates || []) {
          if (ids && ids.length && !ids.includes(this.gateId(g, st))) continue;
          _v1.set(toX(g.i + 0.5), 0, toZ(g.j + 0.5));
          burst("waveDust", _v1, { radius: 1.6 });
        }
        break;
      }
      case "spawn": {
        const v = en(ev.enemyId);
        act(v, "spawn");
        break;
      }
    }
  };
  P.gateId = function (g, st) {
    const list = st && st.map && st.map.entrances;
    if (list) {
      const e = list.find((q) => q.i === g.i && q.j === g.j);
      if (e) return e.id;
    }
    return g.index;
  };
  /** Case boisée coupée : animation, grille et cases constructibles mises à jour. */
  P.cutTile = function (i, j) {
    const row = this.grid[j];
    if (!row) return;
    const ch = row[i];
    const info = tileInfo(ch);
    if (!info.forest) return;
    this.grid[j] = row.slice(0, i) + (info.cutTo || ".") + row.slice(i + 1);
    this.world.cutForest(i, j);
    this.updateTiles(true);
  };
  /** Suit la grille vivante de l'état (coupes, passage ouvert) même sans événement. */
  P.syncGrid = function (st) {
    const g = st && st.map && st.map.grid;
    if (!g) return;
    if (st.map.version !== undefined) {
      if (st.map.version === this.mapVersion) return;
      this.mapVersion = st.map.version;
    }
    for (let j = 0; j < MH; j++) {
      const a = g[j], b = this.grid[j];
      if (a === b || !a) continue;
      const row = typeof a === "string" ? a : a.join("");
      if (row === b) continue;
      for (let i = 0; i < MW; i++) {
        const was = b[i], now = row[i];
        if (was === now) continue;
        if (tileInfo(was).forest && now === tileInfo(was).cutTo) this.cutTile(i, j);
        else if (was === "s" && now === "#") {
          this.world.openSecret();
          this.grid[j] = this.grid[j].slice(0, i) + "#" + this.grid[j].slice(i + 1);
        }
      }
      this.grid[j] = row;
      this.tileSig = "";
    }
  };

  /* --------------------------------------------------- cases, construction, portée, réticules */
  /** Texture des cases : r = constructible (grille discrète), g = état en mode construction. */
  P.updateTiles = function (force) {
    const fam = this.previewState && this.previewState.family;
    let occ = "";
    for (const v of this.towers.values()) occ += v.i + "," + v.j + ";";
    const sig = this.grid.join("") + "|" + fam + "|" + occ;
    if (!force && sig === this.tileSig) return;
    this.tileSig = sig;
    const occupied = new Set();
    for (const v of this.towers.values()) occupied.add(v.i + "," + v.j);
    const tex = this.world.ov.uTiles.value, d = tex.image.data;
    for (let j = 0; j < MH; j++)
      for (let i = 0; i < MW; i++) {
        const k = (j * MW + i) * 4;
        const info = tileInfo(this.grid[j][i]);
        const build = info.build || [];
        d[k] = !info.forest && build.length ? 255 : 0;
        let g = 0;
        if (fam) {
          if (occupied.has(i + "," + j)) g = 3;
          else if (info.forest) g = (tileInfo(info.cutTo).build || []).includes(fam) ? 2 : 0;
          else if (build.includes(fam)) g = 1;
        }
        d[k + 1] = g;
        d[k + 2] = 0;
        d[k + 3] = 255;
      }
    tex.needsUpdate = true;
  };
  /** Peut-on construire la famille en (i, j) ? */
  P.canBuild = function (i, j, family) {
    if (i < 0 || j < 0 || i >= MW || j >= MH) return false;
    const info = tileInfo(this.grid[j][i]);
    if (info.forest || !(info.build || []).includes(family)) return false;
    for (const v of this.towers.values()) if (v.i === i && v.j === j) return false;
    return true;
  };
  /** Disque de portée d'une tour (portée en cases, facultative : sinon tirée des données). */
  P.showRange = function (towerId, range) {
    const U = this.world.ov;
    this.rangeTower = towerId === undefined ? null : towerId;
    this.rangeValue = range || null;
    if (towerId === null || towerId === undefined) {
      if (!this.previewState) U.uRange.value.w = 0;
      return;
    }
    const v = this.towers.get(towerId) || null;
    const tw = v || (this.state && (this.state.towers || []).find((t) => t.id === towerId));
    if (!tw) {
      U.uRange.value.w = 0;
      return;
    }
    const r = range || this.towerRange(tw);
    U.uRange.value.set(toX(tw.i + 0.5), toZ(tw.j + 0.5), r * TILE, 1);
    U.uRangeCol.value.copy(lin(RANGE_HEX[tw.family] || "#ffffff"));
  };
  /** Mode construction : tour fantôme, portée, case verte ou rouge, cases possibles en surbrillance. */
  P.preview = function (i, j, family) {
    const U = this.world.ov;
    if (!family) {
      this.previewState = null;
      U.uBuild.value.x = 0;
      if (this.rangeTower === null) U.uRange.value.w = 0;
      else this.showRange(this.rangeTower, this.rangeValue);
      for (const k in this.ghosts) this.ghosts[k].object.visible = false;
      this.updateTiles();
      return;
    }
    const inside = i !== null && i !== undefined && i >= 0 && j >= 0 && i < MW && j < MH;
    const ok = inside && this.canBuild(i, j, family);
    this.previewState = { i, j, family, ok };
    this.updateTiles();
    U.uBuild.value.set(1, inside ? i : -9, inside ? j : -9, ok ? 1 : 0);
    for (const k in this.ghosts) if (k !== family) this.ghosts[k].object.visible = false;
    if (!inside) {
      if (this.ghosts[family]) this.ghosts[family].object.visible = false;
      U.uRange.value.w = 0;
      return;
    }
    const g = this.ghost(family);
    const top = this.tileTop(i, j);
    g.object.visible = true;
    g.object.position.set(toX(i + 0.5), top, toZ(j + 0.5));
    if (g.model.aim) g.model.aim(this.roadYaw(i, j));
    g.mat.color.copy(lin(ok ? "#9dff7a" : "#ff6a5a"));
    g.matSk.color.copy(g.mat.color);
    const r = this.towerRange({ family, level: 1, spec: null, i, j });
    U.uRange.value.set(toX(i + 0.5), toZ(j + 0.5), r * TILE, ok ? 0.9 : 0.45);
    U.uRangeCol.value.copy(lin(ok ? RANGE_HEX[family] || "#ffffff" : "#ff8a7a"));
  };
  P.ghost = function (family) {
    if (this.ghosts[family]) return this.ghosts[family];
    const model = this.makeTowerModel(family, 1, null);
    const mat = new THREE.MeshBasicMaterial({ color: 0x9dff7a, transparent: true, opacity: 0.5, depthWrite: false });
    const matSk = mat.clone();
    matSk.skinning = true;
    model.object.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = false;
      o.receiveShadow = false;
      o.material = o.isSkinnedMesh ? matSk : mat;
    });
    model.object.renderOrder = 8;
    this.root.add(model.object);
    return (this.ghosts[family] = { model, object: model.object, mat, matSk });
  };
  /** Réticule d'un sort : « cut » = case visée (verte si boisée), « meteor » = disque de l'impact. */
  P.target = function (spell, x, y) {
    const U = this.world.ov;
    if (!spell || x === undefined || x === null) {
      this.targetState = null;
      U.uRet.value.w = 0;
      return;
    }
    this.targetState = { spell, x, y };
    if (spell === "cut") {
      const i = Math.floor(x), j = Math.floor(y);
      const ok = i >= 0 && j >= 0 && i < MW && j < MH && !!tileInfo(this.grid[j][i]).forest;
      U.uRet.value.set(toX(i + 0.5), toZ(j + 0.5), 1, 2);
      U.uRetCol.value.copy(lin(ok ? "#a6ff7a" : "#ff6a5a"));
    } else if (spell === "meteor") {
      const D = DATA();
      const r = (D && D.SPELLS && D.SPELLS.meteor && D.SPELLS.meteor.r) || 1.4;
      U.uRet.value.set(toX(x), toZ(y), r * TILE, 1);
      U.uRetCol.value.copy(lin("#ffae4a"));
    } else U.uRet.value.w = 0;
  };
  P.setUpgradeHints = function (ids) {
    this.hints = new Set(ids || []);
  };

  /* --------------------------------------------------- dessin des surimpressions */
  P.drawHud = function (time) {
    const H = this.hud;
    if (!H) return;
    H.begin();
    const k = this.ovScale || 1;
    const right = this.cam.right;
    const rx = right.x, ry = right.y, rz = right.z;
    const one = [1, 1, 1];
    // barres de vie et pictogrammes des ennemis
    for (const v of this.enemies.values()) {
      if (v.dying) continue;
      const s = v.s;
      const inv = s.invisible > 0 ? 0.35 : 1;
      const big = v.boss ? 1.55 : v.champion ? 1.25 : 1;
      const w = 1.6 * big * k, h = 0.3 * k * (v.boss ? 1.25 : 1);
      const o = v.obj.position;
      const x = o.x, y = o.y + v.height + 0.5 * k, z = o.z;
      // cadre (doré pour les champions et les boss), fond, vie
      if (v.champion || v.boss) H.put(x, y, z, h + 0.2 * k, HUD.bar, 1, 0.72, 0.12, 0.95 * inv, 0, 0, 0, (w + 0.2 * k) / (h + 0.2 * k));
      H.put(x, y, z, h + 0.1 * k, HUD.bar, 0.03, 0.02, 0.02, 0.9 * inv, 0, 0, 0, (w + 0.1 * k) / (h + 0.1 * k));
      const f = s.hp;
      if (f > 0) {
        const r = f > 0.5 ? 1 - (f - 0.5) * 1.4 : 1, g = f > 0.5 ? 0.85 : 0.2 + f * 1.3;
        const off = (w * (1 - f)) / 2;
        H.put(x - rx * off, y - ry * off, z - rz * off, h, HUD.bar, clamp(r, 0.25, 1), clamp(g, 0.18, 0.9), 0.14, inv, 0, 0, 0, (w * f) / h);
      }
      if (s.barrier > 0) {
        const bw = w * s.barrier, off = (w - bw) / 2, hh = h * 0.55;
        const yb = y + h * 0.78;
        H.put(x - rx * off, yb - ry * off, z - rz * off, hh, HUD.bar, 0.35, 0.95, 0.85, 0.95 * inv, 0, 0, 0, bw / hh);
      }
      // pictogrammes d'état (au plus quatre)
      let n = 0;
      const icon = (cell) => {
        if (n >= 4) return;
        const off = (n - 0.5) * 0.56 * k - w * 0.25;
        H.put(x + rx * off, y + 0.55 * k + ry * off, z + rz * off, 0.56 * k, cell, 1, 1, 1, inv, 0, 0, 0, 1);
        n++;
      };
      if (s.freeze > 0) icon(HUD.snow);
      else if (s.slow > 0) icon(HUD.drop);
      if (s.burn > 0) icon(HUD.flame);
      if (s.fear > 0) icon(HUD.fear);
      if (s.radiance > 0) icon(HUD.eye);
      if (s.haste > 0) icon(HUD.notes);
      if (s.disarmed > 0) icon(HUD.disarm);
      if (s.stun > 0) icon(HUD.stun);
      if (v.boss || v.champion) H.put(x - rx * (w / 2 + 0.28 * k), y - ry * (w / 2 + 0.28 * k), z - rz * (w / 2 + 0.28 * k), (v.boss ? 0.62 : 0.46) * k, HUD.crown, 1, 1, 1, inv, 0, 0, 0, 1);
    }
    // flèches d'amélioration au-dessus des tours
    for (const id of this.hints) {
      const v = this.towers.get(id);
      if (!v) continue;
      const o = v.model.object.position;
      const hgt = (v.model.height || 2) * v.model.object.scale.y;
      const b = Math.abs(Math.sin(time * 4 + v.i)) * 0.35;
      H.put(o.x, o.y + hgt + 0.7 * k + b, o.z, 0.95 * k, HUD.glow, 1, 0.85, 0.3, 0.55, 0, 1, 0, 1);
      H.put(o.x, o.y + hgt + 0.7 * k + b, o.z, 0.72 * k, HUD.arrow, one[0], one[1], one[2], 1, 0, 0, 0, 1);
    }
  };
  P.updateBossLabels = function () {
    if (!this.layer) return;
    for (const v of this.enemies.values()) {
      if (!v.boss) continue;
      let el = this.bossLabels.get(v.id);
      if (!el) {
        el = document.createElement("div");
        el.className = "ptmt-boss";
        const D = DATA();
        el.textContent = (v.e && v.e.name) || (D && D.BOSS_NAMES && D.BOSS_NAMES[v.type]) || "Boss";
        this.layer.appendChild(el);
        this.bossLabels.set(v.id, el);
      }
      const o = v.obj.position;
      _v1.set(o.x, o.y + v.height + 0.95 * (this.ovScale || 1), o.z);
      const p = this.cam.project(_v1, { x: 0, y: 0 });
      el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) translate(-50%, -100%)`;
    }
    for (const [id, el] of this.bossLabels)
      if (!this.enemies.has(id)) {
        el.remove();
        this.bossLabels.delete(id);
      }
  };

  /* --------------------------------------------------- image */
  /**
   * Appelée à chaque image. state : état de la simulation ; events : événements depuis l'image
   * précédente ; dt : durée de jeu écoulée (0 en pause, × vitesse) ; time : horloge de jeu.
   */
  P.sync = function (state, events, dt, time) {
    const now = performance.now();
    const realDt = Math.min(0.1, (now - this.lastReal) / 1000);
    this.lastReal = now;
    this.real += realDt;
    dt = Math.max(0, Math.min(0.25, dt || 0));
    this.state = state;
    this.time = time === undefined ? this.time + dt : time;
    const st = state || {};
    this.syncGrid(st);
    // créations d'abord, puis événements (ils visent les vues), puis mises à jour
    for (const e of st.enemies || []) if (!this.enemies.has(e.id)) this.newEnemy(e);
    for (const tw of st.towers || []) if (!this.towers.has(tw.id)) {
      const v = this.newTower(tw);
      v.pop = 0.001;
    }
    if (events) for (const ev of events) this.onEvent(ev, st);
    this.pruneEnemies(st);
    this.syncTowers(st, dt, this.time);
    this.syncEnemies(st, dt, this.time);
    this.updateDying(dt, this.time);
    this.syncGems(st, dt, this.time);
    this.syncProjectiles(st, dt);
    this.syncAreas(st, dt);
    this.meteors = this.meteors.filter((m) => (m.t -= dt) > -0.5);
    // portes, menhirs, Frénésie
    const next = st.wave && st.wave.nextEntrances;
    for (const g of this.world.gates || []) {
      const on = !!(next && next.includes(this.gateId(g, st)));
      if (on !== g.on) {
        g.on = on;
        g.model.pulse && g.model.pulse(on);
      }
    }
    for (const m of this.world.menhirs || []) {
      let on = false;
      for (const v of this.towers.values()) if (v.i === m.i && v.j === m.j) on = true;
      if (on !== m.on) {
        m.on = on;
        m.model.setActive && m.model.setActive(on);
      }
    }
    if (st.frenzy && PTMT.fx && PTMT.fx.world && PTMT.fx._ && PTMT.fx._.S) for (const v of this.towers.values()) PTMT.fx.world.frenzyAura(v.model.object.position, this.real, 1.35);
    if (this.rangeTower !== null && !this.previewState) this.showRange(this.rangeTower, this.rangeValue);
    this.updateTiles();
    this.world.update(realDt, this.real);
    if (this.ownFx && PTMT.fx.update) {
      try {
        PTMT.fx.update(dt, this.time);
      } catch (e) {}
    }
    for (const k in this.ghosts) {
      const g = this.ghosts[k];
      if (g.object.visible) {
        g.mat.opacity = 0.42 + 0.12 * Math.sin(this.real * 5);
        g.model.update && g.model.update(realDt, this.real);
      }
    }
    this.drawHud(this.real);
    this.updateBossLabels();
  };
  P.render = function () {
    this.renderer.render(this.scene, this.camera);
  };
  P.dispose = function () {
    for (const v of [...this.towers.values()]) this.removeTower(v);
    for (const v of [...this.enemies.values()]) this.releaseEnemy(v);
    for (const v of this.dying) this.releaseEnemy(v);
    for (const v of this.projectiles.values()) v.handle && v.handle.release && v.handle.release();
    for (const v of this.areas.values()) v.handle && v.handle.release && v.handle.release();
    this.towers.clear();
    this.enemies.clear();
    this.projectiles.clear();
    this.areas.clear();
    this.gems.clear();
    this.root.parent && this.root.parent.remove(this.root);
    this.world.dispose();
    if (this.layer) this.layer.remove();
    if (this.ownFx && PTMT.fx.dispose) PTMT.fx.dispose();
  };
})();
