// « Pas touche à mes trésors » — la vue du jeu (PTMT.view) : création, et liaison de l'état de la
// simulation vers la scène 3D, image par image.
//
//   const view = PTMT.view.create({ renderer, scene, map, mobile, quality, outline?, shake?, game? });
//   view.resize(w, h, insets) ; view.sync(state, events, dt, time) ; view.render()
//   view.tileTop(i, j) ; view.toWorld(x, y)
//   view.pick(clientX, clientY) → { i, j, x, y, towerId?, enemyId? } | null : l'ennemi l'emporte quand il
//     est à moins de ≈ 0,45 case du doigt à l'écran (montgolfières testées à leur altitude) ; x, y sont
//     alors sa position sur la carte
//   view.worldToScreen(x, y, lift?) → { x, y } en pixels CSS du viewport (comme clientX/clientY)
//   view.showRange(towerId | null, range?) ; view.preview(i, j, family | null)
//   view.target(spell | null, x, y) (x, y hors carte, par ex. −99 : visée commencée, rien à montrer)
//   view.setUpgradeHints(ids) ; view.canBuild(i, j, family) ; view.floatText(x, y, lift, texte, classe)
//   view.game : la partie (facultative, pour l'aperçu des vagues : game.upcoming) ; view.dispose()
//
// La vue possède la carte (render/10-map.js et 15-places.js), la caméra fixe (render/30-camera.js),
// l'aperçu des vagues et les repères des entrées (render/25-routes.js), les effets (PTMT.fx,
// initialisés avec sa caméra et mis à jour dans sync : ne pas les mettre à jour ailleurs) et tous les
// objets vivants :
//  - tours : PTMT.models.ctConfig({ mobile, outline }) une fois, puis
//    PTMT.models.ctTower(famille, niveau, spéc., { terrain }) posées sur le dessus de leur case ;
//    visée (angle monde de la simulation ; seconde tête du grand dragon rouge vers sa propre cible),
//    élan sur « attack », charges du cygne (setCharges), jets continus du berger et des dragons
//    (PTMT.fx.beam de la gueule à la poitrine de la cible, second tronçon vers la cible du rebond,
//    setBeam ; secours : ruban de flammes), éblouissement (setDazzled, calé sur l'éclair du flash),
//    remplacement du modèle et celebrate() à la montée de niveau, apparition en rebond, Frénésie,
//    fantôme du mode construction ;
//  - ennemis : PTMT.actors.create(type, champion, boss) (échelle et hauteur réglées par le modèle),
//    positions continues de la simulation suivies avec un très léger lissage (sauf téléportation du
//    korrigan), cap = dir, montgolfières soulevées à leur altitude avec une ombre douce au sol,
//    pataugeage (posés à la surface de l'eau, éclaboussures), réactions (touché, soin, lasso, flash,
//    pouf du korrigan, tracteur qui éclate…), libérés quand leur chute ou leur fuite est finie ;
//  - gemmes : PTMT.models.gem(couleur), dans le logement gem.slot de leur cachette gem.lair, portées
//    (accrochées à carryAnchor), au sol (halo), ou en vol (vol, ramassage, chute, retour doré) ;
//    chaque cachette sait quels logements sont pleins (setSlots) et sonne l'alarme quand on y vole ;
//  - projectiles : PTMT.fx.projectile(kind), départ à la gueule de la tour (bouches alternées pour les
//    tirs doubles), arrivée sur la poitrine de la cible (ou au sol pour les tirs en cloche), progression
//    p de la simulation ; impact PTMT.fx.burst(kind + "Hit", point au sol, { radius (cases), h, crit }) ;
//  - zones de brûlure et avertissements de météore ; marée, barrières qui cèdent, passage secret ;
//  - surimpressions : barres de vie, barrière du druide, pictogrammes d'état, flèches d'amélioration,
//    coins de la case visée par la coupe (un seul lot de sprites, toujours au premier plan), textes
//    flottants et noms des boss (DOM) ; qualité « low » : disque d'ombre doux sous les tours.
// Tout modèle absent (tours, ennemis, gemmes, projectiles, jets, décor) est remplacé par une forme de
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
  const MK_WATER = () => (VIEW._map && VIEW._map.K ? VIEW._map.K.WATER_Y : -0.25);
  function turn(cur, target, max) {
    let d = (target - cur) % TAU;
    if (d > Math.PI) d -= TAU;
    else if (d < -Math.PI) d += TAU;
    return cur + (d > max ? max : d < -max ? -max : d);
  }
  const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3();

  const RANGE_HEX = { boar: "#ffd88a", swan: "#9ff2ff", dog: "#ffab6a" };
  // Anciens noms des projectiles (v3) et éclats de secours quand « kind + Hit » n'existe pas.
  const OLD_SHOT = { waterOrb: "waterJet", iceOrb: "iceShard", darkOrb: "darkWater", fireball: "fireball", dragonFire: "fireball" };
  const HIT_FALLBACK = {
    chestnut: ["hit", 0.5], bigChestnut: ["explosion", 1], waterOrb: ["splash", 0.6], iceOrb: ["iceShatter", 0.7], darkOrb: ["splash", 0.7],
    waterJet: ["splash", 0.6], iceShard: ["iceShatter", 0.7], darkWater: ["splash", 0.7], fireball: ["explosion", 0.5], dragonFire: ["explosion", 0.9], blueFire: ["freezeFlash", 0.8],
  };
  const HIT_FAMILY = { iceOrb: "ice", iceShard: "ice", waterOrb: "water", darkOrb: "water", waterJet: "water", darkWater: "water" };
  const TILES_FALLBACK = {
    ".": { build: ["boar"] }, "^": { build: ["dog"] }, "~": { build: ["swan"] }, H: { build: ["boar", "swan", "dog"], high: true },
    f: { forest: true, cutTo: "." }, r: { forest: true, cutTo: "^" }, w: { forest: true, cutTo: "~" }, h: { forest: true, cutTo: "H", high: true },
    m: { tide: true }, g: { gate: true }, s: { secret: true },
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
  // v4 : bannière des entrées (blason), lettres A à E, chevron et points des trajets, ballon,
  // tiret, boule d'eau (charges de secours), cadenas (barrière fermée).
  const HUD = {
    bar: 0, glow: 1, snow: 2, flame: 3, fear: 4, eye: 5, notes: 6, disarm: 7, stun: 8, drop: 9, ghost: 10, arrow: 11, crown: 12, shield: 13, haste: 14, ring: 15, frame: 16, corners: 17,
    banner: 18, letter: 19, chevron: 24, dot: 25, balloon: 26, dash: 27, orb: 28, lock: 29,
  };
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
    // coins de visée (case ciblée par la coupe, par-dessus les arbres)
    cell(HUD.corners, () => {
      const m = 6, L = 19;
      const path = () => {
        c.beginPath();
        c.moveTo(m, m + L); c.lineTo(m, m); c.lineTo(m + L, m);
        c.moveTo(S - m - L, m); c.lineTo(S - m, m); c.lineTo(S - m, m + L);
        c.moveTo(S - m, S - m - L); c.lineTo(S - m, S - m); c.lineTo(S - m - L, S - m);
        c.moveTo(m + L, S - m); c.lineTo(m, S - m); c.lineTo(m, S - m - L);
      };
      c.lineCap = c.lineJoin = "round";
      path();
      c.strokeStyle = "#1c1410";
      c.lineWidth = 10;
      c.stroke();
      path();
      c.strokeStyle = "#fff";
      c.lineWidth = 5;
      c.stroke();
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
    // blason des entrées : écu arrondi (blanc à teinter), liseré sombre, reflet en haut
    cell(HUD.banner, () => {
      const path = () => {
        c.beginPath();
        c.moveTo(9, 8);
        c.lineTo(55, 8);
        c.lineTo(55, 34);
        c.quadraticCurveTo(54, 50, 32, 59);
        c.quadraticCurveTo(10, 50, 9, 34);
        c.closePath();
      };
      path();
      c.lineJoin = "round";
      c.strokeStyle = "#1c1410";
      c.lineWidth = 8;
      c.stroke();
      c.fillStyle = "#ffffff";
      c.fill();
      c.save();
      path();
      c.clip();
      c.fillStyle = "rgba(0,0,0,0.16)";
      c.fillRect(32, 0, 32, 64);
      c.fillStyle = "rgba(255,255,255,0.5)";
      c.fillRect(0, 8, 64, 6);
      c.restore();
    });
    // lettres des entrées : blanches, épais liseré sombre
    ["A", "B", "C", "D", "E"].forEach((L, k) =>
      cell(HUD.letter + k, () => {
        c.font = "900 44px system-ui, -apple-system, 'Segoe UI', sans-serif";
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.lineJoin = "round";
        c.strokeStyle = "#1c1410";
        c.lineWidth = 10;
        c.strokeText(L, 32, 33);
        c.fillStyle = "#ffffff";
        c.fillText(L, 32, 33);
      }),
    );
    cell(HUD.chevron, () =>
      outline(() => {
        c.beginPath();
        c.moveTo(32, 6);
        c.lineTo(60, 40);
        c.lineTo(60, 58);
        c.lineTo(32, 30);
        c.lineTo(4, 58);
        c.lineTo(4, 40);
        c.closePath();
      }, "#ffffff", "#1c1410", 6),
    );
    cell(HUD.dot, () =>
      outline(() => {
        c.beginPath();
        c.arc(32, 32, 19, 0, TAU);
      }, "#ffffff", "#1c1410", 8),
    );
    cell(HUD.dash, () =>
      outline(() => {
        c.beginPath();
        c.moveTo(12, 22);
        c.lineTo(52, 22);
        c.arc(52, 32, 10, -Math.PI / 2, Math.PI / 2);
        c.lineTo(12, 42);
        c.arc(12, 32, 10, Math.PI / 2, -Math.PI / 2);
        c.closePath();
      }, "#ffffff", "#1c1410", 6),
    );
    cell(HUD.balloon, () => {
      c.lineJoin = c.lineCap = "round";
      c.strokeStyle = "#1c1410";
      c.lineWidth = 4;
      for (const sx of [-8, 8]) {
        c.beginPath();
        c.moveTo(32 + sx * 1.6, 36);
        c.lineTo(32 + sx * 0.8, 49);
        c.stroke();
      }
      outline(() => {
        c.beginPath();
        c.moveTo(32, 46);
        c.bezierCurveTo(12, 36, 10, 6, 32, 6);
        c.bezierCurveTo(54, 6, 52, 36, 32, 46);
        c.closePath();
      }, "#ffffff", "#1c1410", 6);
      outline(() => {
        c.beginPath();
        c.rect(24, 48, 16, 11);
      }, "#d8b07a", "#1c1410", 5);
    });
    cell(HUD.orb, () => {
      const g = c.createRadialGradient(26, 24, 2, 32, 32, 22);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(0.35, "#bff6ff");
      g.addColorStop(1, "#1a7fd0");
      c.fillStyle = g;
      c.strokeStyle = "#0c2a44";
      c.lineWidth = 5;
      c.beginPath();
      c.arc(32, 32, 22, 0, TAU);
      c.fill();
      c.stroke();
    });
    cell(HUD.lock, () => {
      c.lineCap = "round";
      c.strokeStyle = "#1c1410";
      c.lineWidth = 14;
      c.beginPath();
      c.arc(32, 26, 12, Math.PI, 0);
      c.stroke();
      c.strokeStyle = "#ffffff";
      c.lineWidth = 6;
      c.beginPath();
      c.arc(32, 26, 12, Math.PI, 0);
      c.stroke();
      outline(() => {
        c.beginPath();
        c.rect(14, 27, 36, 28);
      }, "#ffffff", "#1c1410", 6);
    });
    hudTex = new THREE.CanvasTexture(cv);
    hudTex.premultiplyAlpha = true;
    hudTex.encoding = THREE.sRGBEncoding;
    hudTex.minFilter = THREE.LinearMipmapLinearFilter;
    hudTex.generateMipmaps = true;
    return hudTex;
  }
  VIEW._hud = { HUD, atlas: hudAtlas };

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
    let yaw = 0, want = 0, kick = 0, hop = 0, frenzy = false, beam = 0, beamOn = false, dizzy = false;
    // état lu par les surimpressions de secours (boules en réserve, étoiles de l'éblouissement)
    const show = { full: 0, max: 0, part: 0, dazzled: false };
    return {
      object: g,
      fallback: true,
      height: height * k,
      muzzle,
      muzzles: [muzzle],
      show,
      update(dt, time) {
        yaw = turn(yaw, want, dt * (beamOn ? 12 : 7));
        bodyGroup.rotation.y = yaw + (dizzy ? Math.sin(time * 9) * 0.35 : 0);
        kick = Math.max(0, kick - dt * 5);
        hop = Math.max(0, hop - dt * 1.6);
        beam += ((beamOn ? 1 : 0) - beam) * Math.min(1, dt * 10);
        bodyMesh.position.z = kick * 0.18 - beam * 0.08;
        bodyMesh.scale.set(1, 1 + (frenzy ? 0.04 * Math.sin(time * 30) : 0) + beam * 0.03 * Math.sin(time * 40), 1);
        bodyGroup.position.y = Math.abs(Math.sin(hop * 9)) * hop * 0.8;
      },
      aim(y, i) {
        if (!i) want = y;
      },
      attack() {
        kick = 1;
        return 0.1;
      },
      setSelected() {},
      setFrenzy(f) {
        frenzy = !!f;
      },
      setCharges(full, max, part) {
        show.full = full;
        show.max = max;
        show.part = part;
      },
      setBeam(on, heat, i) {
        if (!i) beamOn = !!on;
      },
      setDazzled(b) {
        dizzy = !!b;
        show.dazzled = dizzy;
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

  const ACT_COL = {
    fermier: "#3f6fb0", quad: "#c83a2a", cowboy: "#8a5a2a", vache: "#f2f2f2", druide: "#eeeee4", bigoudene: "#1c1c1c", chasseur: "#5f7a3a", rugbyman: "#2a4ab0",
    sonneur: "#1f3a7a", pompier: "#c8201a", canard: "#f2d23a", cycliste: "#ffd21a", korrigan: "#5a8a2a", touriste: "#ff7ab0", tracteur: "#d8301a", montgolfiere: "#e8403a",
  };
  const MOUNT_COL = { quad: "#d23a1a", vache: "#f4f4f4", canard: "#f2d23a", tracteur: "#c8261a", cycliste: "#3a3a44" };
  function fallbackActor(type, champion, boss) {
    // Forme de secours : un maillage fusionné (monture éventuelle, corps, tête, couronne) ; la
    // montgolfière : ballon rayé, nacelle d'osier (posée au sol du modèle : la vue la soulève).
    const MK = VIEW._map, T4 = MK.T4;
    const g = new THREE.Group();
    const col = ACT_COL[type] || "#666";
    const parts = [];
    const flying = type === "montgolfiere";
    let bodyY = 0.55, height = 2;
    if (flying) {
      parts.push({ g: new THREE.CylinderGeometry(0.75, 0.6, 0.8, 10), color: "#b08a50", m: T4(0, 0.4, 0), shade: 0.3 });
      for (let k = 0; k < 8; k++) {
        const a0 = (k / 8) * TAU;
        parts.push({ g: new THREE.SphereGeometry(2.1, 6, 10, a0, TAU / 8), color: k % 2 ? "#f4efe0" : col, m: T4(0, 3.9, 0, 0, 0, 0, 1, 1.15, 1), shade: 0.2 });
      }
      for (const [sx, sz] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) parts.push({ g: new THREE.CylinderGeometry(0.03, 0.03, 1.6, 4), color: "#4a3626", m: T4(sx, 1.55, sz) });
      height = 6.3;
    } else {
      const mount = !!MOUNT_COL[type];
      bodyY = mount ? 0.9 : 0.55;
      if (mount) parts.push({ g: new THREE.BoxGeometry(type === "tracteur" ? 1.5 : 0.9, type === "tracteur" ? 1.0 : 0.6, type === "tracteur" ? 2.2 : 1.6), color: MOUNT_COL[type], m: T4(0, 0.5, 0), shade: 0.3 });
      parts.push({ g: new THREE.CylinderGeometry(0.3, 0.38, 0.9, 10), color: col, m: T4(0, bodyY + 0.45, 0), shade: 0.3 });
      parts.push({ g: new THREE.SphereGeometry(0.3, 12, 10), color: type === "korrigan" ? "#8ab060" : "#f0c9a0", m: T4(0, bodyY + 1.15, 0) });
      if (type === "korrigan") parts.push({ g: new THREE.ConeGeometry(0.3, 0.6, 8), color: "#c0302a", m: T4(0, bodyY + 1.6, 0) });
      height = bodyY + 1.5;
    }
    if (champion || boss) parts.push({ g: new THREE.CylinderGeometry(0.22, 0.28, 0.2, 8), color: "#ffcf2e", m: T4(0, height, 0) });
    const inner = MK.buildMerged(parts, "Ennemi (secours)");
    g.add(inner);
    const anchor = new THREE.Object3D();
    anchor.position.set(0, flying ? 0.9 : bodyY + 1.75, 0);
    g.add(anchor);
    let t = 0, dead = 0, fall = 0, alt = 6;
    return {
      object: g,
      flying,
      height,
      carryAnchor: anchor,
      update(dt, time, s) {
        t += dt * (s && s.moving ? 9 : 2);
        if (s && s.alt) alt = s.alt;
        inner.position.y = flying ? Math.sin(time * 0.8) * 0.12 : s && s.moving ? Math.abs(Math.sin(t)) * 0.12 : 0;
        if (dead) {
          dead = Math.min(1, dead + dt * 3);
          if (flying) {
            fall = Math.min(1, fall + dt * 1.3);
            inner.position.y = -alt * fall * fall;
            inner.scale.set(1, 1 - 0.5 * fall, 1);
          } else inner.rotation.x = -dead * 1.4;
        }
      },
      event(name) {
        if (name === "die" || name === "split") dead = Math.max(dead, 0.01);
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
    m.position.y = 0.34;
    let st = "lair";
    return {
      object: g,
      fallback: true,
      update(dt, time) {
        m.rotation.y += dt * (st === "ground" ? 1.6 : 2.5);
        m.position.y = 0.34 + (st === "ground" ? 0.3 + Math.sin(time * 3 + color) * 0.08 : 0);
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
      waterOrb: ["ball", "#5fd0ff", 0.7, 1.15],
      iceOrb: ["ball", "#bff4ff", 0.9, 1.15],
      darkOrb: ["ball", "#7a3ac8", 0.8, 1.2],
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

  /* ------------------------------------------------------------------ jets de secours */
  // Sans PTMT.fx.beam : rubans de flammes additifs face caméra, effilés à la gueule, élargis sur la
  // cible, texture de feu qui défile vers la cible ; orange qui blanchit avec la chaleur (bleu pour le
  // dragon bleu). Tous les rubans dans un maillage (sommets réécrits à chaque image, un appel).
  const BSEG = 14;
  class FallbackBeams {
    constructor(root, cap) {
      this.cap = cap;
      const nv = cap * (BSEG + 1) * 2;
      this.pos = new Float32Array(nv * 3);
      this.uvh = new Float32Array(nv * 4); // u, v, chaleur, sorte
      const idx = new Uint16Array(cap * BSEG * 6);
      for (let b = 0; b < cap; b++)
        for (let i = 0; i < BSEG; i++) {
          const v0 = (b * (BSEG + 1) + i) * 2, k = (b * BSEG + i) * 6;
          idx[k] = v0; idx[k + 1] = v0 + 1; idx[k + 2] = v0 + 2; idx[k + 3] = v0 + 1; idx[k + 4] = v0 + 3; idx[k + 5] = v0 + 2;
        }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
      geo.setAttribute("aU", new THREE.BufferAttribute(this.uvh, 4).setUsage(THREE.DynamicDrawUsage));
      geo.setIndex(new THREE.BufferAttribute(idx, 1));
      geo.setDrawRange(0, 0);
      this.uTime = { value: 0 };
      const mat = new THREE.ShaderMaterial({
        uniforms: { uTime: this.uTime },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        vertexShader: /* glsl */ `
          attribute vec4 aU; varying vec4 vU;
          void main() { vU = aU; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `
          uniform float uTime; varying vec4 vU;
          float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          float n(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(mix(h(i), h(i + vec2(1.0, 0.0)), u.x), mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), u.x), u.y); }
          void main() {
            float u = vU.x, v = vU.y, heat = vU.z;
            float fl = n(vec2(u * 9.0 - uTime * 9.0, v * 2.0)) * 0.6 + n(vec2(u * 21.0 - uTime * 16.0, v * 4.0 + 3.0)) * 0.4;
            float edge = 1.0 - smoothstep(0.35 + 0.3 * fl, 1.0, abs(v));
            float core = 1.0 - smoothstep(0.0, 0.25 + 0.25 * heat, abs(v));
            float ends = smoothstep(0.0, 0.05, u) * (1.0 - smoothstep(0.88, 1.0, u));
            vec3 hot = vU.w > 1.5 ? mix(vec3(0.15, 0.4, 1.0), vec3(0.85, 0.95, 1.0), core * (0.4 + 0.6 * heat))
                                  : mix(vec3(1.0, 0.32, 0.04), vec3(1.0, 0.95, 0.75), core * (0.35 + 0.65 * heat));
            float a = edge * ends * (0.55 + 0.45 * fl);
            gl_FragColor = vec4(hot * a * (1.1 + heat), 1.0);
          }`,
      });
      this.mesh = new THREE.Mesh(geo, mat);
      this.mesh.frustumCulled = false;
      this.mesh.renderOrder = 19;
      this.mesh.name = "Jets (secours)";
      root.add(this.mesh);
      this.geo = geo;
      this.used = new Array(cap).fill(false);
      this.handles = [];
      this.side = new THREE.Vector3(1, 0, 0);
    }
    get(kind) {
      const k = this.used.indexOf(false);
      if (k < 0) return { set() {}, release() {} };
      this.used[k] = true;
      const self = this, kd = kind === "blueFire" ? 2 : kind === "dragonFire" ? 1 : 0;
      const h = {
        set(from, to, heat) {
          self.write(k, from, to, heat || 0, kd);
        },
        release() {
          if (!self.used[k]) return;
          self.used[k] = false;
          self.clear(k);
        },
      };
      this.sync();
      return h;
    }
    sync() {
      let top = 0;
      for (let i = 0; i < this.cap; i++) if (this.used[i]) top = i + 1;
      this.geo.setDrawRange(0, top * BSEG * 6);
    }
    clear(k) {
      const o = k * (BSEG + 1) * 2;
      for (let i = 0; i < (BSEG + 1) * 2; i++) this.pos[(o + i) * 3 + 1] = -500;
      this.geo.attributes.position.needsUpdate = true;
      this.sync();
    }
    /** Ruban de from à to : largeur selon la droite de l'écran perpendiculaire au jet. */
    write(k, from, to, heat, kd) {
      const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
      const L = Math.hypot(dx, dy, dz) || 1;
      // côté : perpendiculaire au jet et à la direction de vue (caméra fixe : vue vers −Y incliné)
      let sx = dz, sz = -dx;
      const sl = Math.hypot(sx, sz) || 1;
      sx /= sl;
      sz /= sl;
      const o = k * (BSEG + 1) * 2, w0 = 0.12 + 0.05 * heat, w1 = (0.45 + 0.45 * heat) * (kd === 1 ? 1.3 : 1);
      for (let i = 0; i <= BSEG; i++) {
        const u = i / BSEG, w = w0 + (w1 - w0) * Math.pow(u, 0.7);
        const x = from.x + dx * u, y = from.y + dy * u + Math.sin(Math.PI * u) * Math.min(0.4, L * 0.04), z = from.z + dz * u;
        for (let sd = 0; sd < 2; sd++) {
          const vi = o + i * 2 + sd, sg = sd ? 1 : -1;
          this.pos[vi * 3] = x + sx * w * sg;
          this.pos[vi * 3 + 1] = y;
          this.pos[vi * 3 + 2] = z + sz * w * sg;
          this.uvh[vi * 4] = u;
          this.uvh[vi * 4 + 1] = sg;
          this.uvh[vi * 4 + 2] = heat;
          this.uvh[vi * 4 + 3] = kd;
        }
      }
      this.geo.attributes.position.needsUpdate = true;
      this.geo.attributes.aU.needsUpdate = true;
    }
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
    // tours : version allégée (sans ombre portée, un appel de dessin par tour) sur téléphone et en
    // qualité « low » ; liseré sombre partout sauf demande contraire (o.outline = false)
    const cfg = PTMT.models && PTMT.models.ctConfig;
    if (typeof cfg === "function") {
      try {
        cfg({ mobile: this.mobile || !this.high, outline: o.outline !== false });
      } catch (e) {}
    }
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
    this.glows = [];
    this.anims = [];
    this.flashes = [];
    this.hints = new Set();
    this.grid = this.map.grid.map((row) => row);
    this.rangeTower = null;
    this.rangeValue = null;
    this.previewState = null;
    this.targetState = null;
    this.ghosts = {};
    this.game = o.game || null;
    this.time = 0;
    this.real = 0;
    this.lastReal = performance.now();
    this.frenzy = false;
    this.tileSig = "";
    this.fresh = true; // première image : l'état existant se pose sans animation (vue recréée en cours de partie)
    this.lairFlash = [];
    this.lairFull = [];
    this.shakeOn = o.shake !== false;
    this.buildHud();
    this.buildDom();
    this.meteors = [];
    this.routes = VIEW._Routes ? new VIEW._Routes(this) : null;
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
  /** Pixels CSS du viewport (comme clientX/clientY) du point (x, y) de la carte (cases continues), lift m au-dessus du sol. */
  P.worldToScreen = function (x, y, lift) {
    const p = this.canvasPoint(x, y, lift);
    if (this.rectT === undefined || this.real - this.rectT > 0.5) this.readRect();
    p.x += this.rectL;
    p.y += this.rectTop;
    return p;
  };
  /** Même point en pixels du canevas (coin haut gauche du canevas = 0, 0). */
  P.canvasPoint = function (x, y, lift) {
    _v1.set(toX(x), this.world.groundAt(x, y, false) + (lift || 0), toZ(y));
    return this.cam.project(_v1, { x: 0, y: 0 });
  };
  P.readRect = function () {
    const el = this.renderer.domElement;
    const r = el.getBoundingClientRect ? el.getBoundingClientRect() : { left: 0, top: 0 };
    this.rectL = r.left || 0;
    this.rectTop = r.top || 0;
    this.rectT = this.real;
  };
  /**
   * Toucher : ennemi (le plus proche du doigt à l'écran, à moins de ≈ 0,45 case ; montgolfières à leur
   * altitude), sinon tour, sinon case du relief.
   */
  P.pick = function (clientX, clientY) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const tws = this._pickT || (this._pickT = []);
    tws.length = 0;
    for (const v of this.towers.values()) {
      const o = v.model.object;
      tws.push({ id: v.id, i: v.i, j: v.j, x: o.position.x, z: o.position.z, base: v.top, top: v.top + Math.max(1.2, v.model.height || 2) * o.scale.y, r: 1.2 });
    }
    const hit = this.cam.pick(clientX, clientY, rect, this.world, tws);
    // ennemis : distance du doigt au segment pieds-tête projeté (pixels CSS du canevas)
    const px = clientX - rect.left, py = clientY - rect.top;
    const thr = 0.45 * TILE * this.cam.pxPerM;
    let best = null, bd = thr;
    const a = { x: 0, y: 0 }, b = { x: 0, y: 0 };
    for (const v of this.enemies.values()) {
      if (v.dying || v.s.invisible > 0.6) continue;
      const o = v.obj.position, h = Math.max(1, v.height);
      this.cam.project(_v1.set(o.x, o.y + h * 0.12, o.z), a);
      this.cam.project(_v1.set(o.x, o.y + h * 0.88, o.z), b);
      const ex = b.x - a.x, ey = b.y - a.y, l2 = ex * ex + ey * ey;
      const t = l2 > 1e-6 ? clamp(((px - a.x) * ex + (py - a.y) * ey) / l2, 0, 1) : 0;
      const d = Math.hypot(px - (a.x + ex * t), py - (a.y + ey * t));
      if (d < bd) {
        bd = d;
        best = v;
      }
    }
    if (best && !(hit && hit.towerId !== undefined && bd > thr * 0.55)) {
      return { i: Math.floor(best.x), j: Math.floor(best.y), x: best.x, y: best.y, enemyId: best.id };
    }
    return hit;
  };
  P.resize = function (w, h, insets) {
    const r = this.renderer;
    const pr = Math.min((typeof devicePixelRatio !== "undefined" && devicePixelRatio) || 1, this.mobile ? 1.5 : 2);
    r.setPixelRatio(pr);
    r.setSize(w, h, false);
    this.cam.frame(w, h, insets);
    this.world.setSunAzimuth(this.cam.az);
    if (this.world.orientPlaces) this.world.orientPlaces(this.cam.az);
    this.world.ov.uPxM.value = this.cam.pxPerM * pr;
    this.rectT = undefined;
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
    // repères posés dans le monde (bannières et flèches des entrées, trajets de la prochaine vague) :
    // même planche, mais cachés derrière ce qui est devant eux (test de profondeur)
    const mm = gfx.newSpriteMaterial();
    mm.uniforms = Object.assign({}, mm.uniforms, { uAtlas: { value: hudAtlas() }, uTime: { value: 0 } });
    mm.depthWrite = false;
    this.marks = new gfx.SpriteBatch(this.mobile ? 700 : 1200, "immediate", mm);
    this.marks.mesh.renderOrder = 12;
    this.marks.mesh.name = "PTMT:repères";
    this.root.add(this.marks.mesh);
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
    const p = this.canvasPoint(x, y, lift);
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
  /** Terrain de la case (i, j) au sens de DATA.TILES : grass, rock, water, high… */
  P.terrainAt = function (i, j) {
    const ch = this.grid[j] ? this.grid[j][i] : ".";
    const t = tileInfo(ch).terrain;
    if (t) return t;
    return ch === "~" || ch === "w" ? "water" : ch === "H" || ch === "h" ? "high" : ch === "^" || ch === "r" ? "rock" : "grass";
  };
  P.makeTowerModel = function (family, level, spec, i, j) {
    const f = PTMT.models && PTMT.models.ctTower;
    if (typeof f === "function") {
      try {
        // le cygne posé hors de l'eau (butte) flotte dans une petite mare
        const m = f(family, level, spec || null, i === undefined ? {} : { terrain: this.terrainAt(i, j) });
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
    // qualité « low » (pas de carte d'ombres) : disque d'ombre doux au pied, poussé du côté opposé au soleil
    if (!this.high) {
      if (v.blob === undefined || v.blob < 0) v.blob = this.world.addBlob(o.position.x, o.position.z, v.top, 2.5, 2.3, 0.8, 0.7);
    }
  };
  P.newTower = function (tw) {
    this.world.clearForest(tw.i, tw.j);
    const v = {
      id: tw.id, i: tw.i, j: tw.j, family: tw.family, level: tw.level, spec: tw.spec || null, key: tw.family + tw.level + (tw.spec || ""),
      top: this.tileTop(tw.i, tw.j), yaw: this.roadYaw(tw.i, tw.j), pop: 0, frenzy: false, selected: false,
      beams: [], beamOn: [false, false], shotK: 0, dazzled: false, dazzleAt: 0,
    };
    v.model = this.makeTowerModel(tw.family, tw.level, tw.spec, tw.i, tw.j);
    this.placeTower(v);
    this.towers.set(tw.id, v);
    return v;
  };
  P.removeTower = function (v) {
    this.releaseBeams(v);
    const o = v.model.object;
    o.parent && o.parent.remove(o);
    try {
      v.model.dispose && v.model.dispose();
    } catch (e) {}
    if (v.blob >= 0) this.world.removeBlob(v.blob);
    this.towers.delete(v.id);
  };
  /** Sorte de jet d'une tour (stats de la simulation) : "fire" | "dragonFire" | "blueFire". */
  P.beamKind = function (v) {
    const st = this.towerStats(v);
    return (st && st.beam) || (v.spec === "A" ? "dragonFire" : v.spec === "B" ? "blueFire" : "fire");
  };
  /** Nouveau jet : PTMT.fx.beam, sinon ruban de secours. */
  P.newBeam = function (kind) {
    const FX = PTMT.fx;
    if (FX && typeof FX.beam === "function" && FX._ && FX._.S) {
      try {
        const b = FX.beam(kind);
        if (b && b.set) return b;
      } catch (e) {
        if (!this._warnBeam) console.warn("PTMT.fx.beam :", e);
        this._warnBeam = true;
      }
    }
    if (!this.fbeams) this.fbeams = new FallbackBeams(this.root, this.mobile ? 12 : 24);
    return this.fbeams.get(kind);
  };
  P.releaseBeams = function (v) {
    for (let k = 0; k < v.beams.length; k++) {
      const b = v.beams[k];
      if (!b) continue;
      try {
        b.fx.release();
        if (b.chain) b.chain.release();
      } catch (e) {}
      v.beams[k] = null;
      if (v.model.setBeam) v.model.setBeam(false, 0, k);
    }
  };
  /** Gueule (bouche) slot de la tour, dans le monde. */
  P.muzzlePos = function (v, slot, out) {
    const m = v.model;
    const mz = (m.muzzles && m.muzzles[slot]) || m.muzzle;
    if (mz && mz.getWorldPosition) {
      if (!v.mzFrame || v.mzFrame !== this.frameNo) {
        m.object.updateMatrixWorld(true);
        v.mzFrame = this.frameNo;
      }
      return mz.getWorldPosition(out);
    }
    return out.copy(m.object.position).setY(v.top + (m.height || 2) * 0.8);
  };
  /**
   * Jets continus (berger, dragons) : un jet par emplacement de tw.beams, de la gueule à la poitrine
   * de la cible, chaleur de la simulation ; second tronçon vers la cible du rebond (dragon bleu).
   */
  P.syncBeams = function (v, tw, time) {
    const list = tw.attack === "beam" && !(tw.dazzled > 0) ? tw.beams || [] : null;
    const seen = this._beamSeen || (this._beamSeen = [false, false, false, false]);
    seen[0] = seen[1] = seen[2] = seen[3] = false;
    if (list) {
      const kind = this.beamKind(v);
      for (const b of list) {
        const slot = b.slot | 0;
        const tgt = this.enemies.get(b.targetId);
        if (!tgt || slot > 3) continue;
        seen[slot] = true;
        let h = v.beams[slot];
        if (h && h.kind !== kind) {
          h.fx.release();
          if (h.chain) h.chain.release();
          h = v.beams[slot] = null;
        }
        if (!h) h = v.beams[slot] = { kind, fx: this.newBeam(kind), chain: null };
        const from = this.muzzlePos(v, slot, _v1);
        const to = this.chest(tgt, 0.55, _v2);
        h.fx.set(from, to, b.heat || 0, time);
        if (b.chainId !== null && b.chainId !== undefined && this.enemies.has(b.chainId)) {
          if (!h.chain) h.chain = this.newBeam(kind);
          h.chain.set(to, this.chest(this.enemies.get(b.chainId), 0.55, _v3), (b.heat || 0) * 0.85, time);
        } else if (h.chain) {
          h.chain.release();
          h.chain = null;
        }
        if (v.model.setBeam) v.model.setBeam(true, b.heat || 0, slot);
        v.beamOn[slot] = true;
        // seconde tête (grand dragon rouge) : vers sa propre cible
        if (slot === 1 && v.model.aim) v.model.aim(Math.atan2(tgt.obj.position.x - v.model.object.position.x, tgt.obj.position.z - v.model.object.position.z), 1);
      }
    }
    for (let k = 0; k < v.beams.length; k++) {
      if (seen[k] || !v.beams[k]) continue;
      v.beams[k].fx.release();
      if (v.beams[k].chain) v.beams[k].chain.release();
      v.beams[k] = null;
    }
    for (let k = 0; k < 2; k++)
      if (!seen[k] && v.beamOn[k]) {
        v.beamOn[k] = false;
        if (v.model.setBeam) v.model.setBeam(false, 0, k);
      }
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
        this.releaseBeams(v);
        const old = v.model;
        old.object.parent && old.object.parent.remove(old.object);
        try {
          old.dispose && old.dispose();
        } catch (e) {}
        v.model = this.makeTowerModel(tw.family, tw.level, tw.spec, v.i, v.j);
        v.key = key;
        v.level = tw.level;
        v.spec = tw.spec || null;
        v.frenzy = false;
        v.selected = false;
        v.dazzled = false;
        this.placeTower(v);
        // les tours du jeu jouent elles-mêmes leur montée de niveau (celebrate → « levelUp ») ;
        // la forme de secours reçoit une colonne dorée
        if (v.model.celebrate) v.model.celebrate();
        if (v.model.fallback) {
          _v1.set(toX(v.i + 0.5), v.top, toZ(v.j + 0.5));
          burst("goldColumn", _v1, { radius: 1.5, height: 5 }) || burst("sparkle", _v1, { color: "#ffe07a", radius: 1.4 });
        }
      }
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
      // cygne : boules en réserve (pleines, maximum, recharge de la suivante)
      if (tw.attack === "charges" && v.model.setCharges) {
        const full = Math.floor((tw.ammo || 0) + 1e-6);
        v.model.setCharges(full, tw.ammoMax || 0, Math.max(0, (tw.ammo || 0) - full));
      }
      // éblouie par un flash : à l'instant où l'éclair part de l'appareil du touriste
      const dz = tw.dazzled > 0 && this.real >= v.dazzleAt;
      if (dz !== v.dazzled) {
        v.dazzled = dz;
        v.model.setDazzled && v.model.setDazzled(dz);
      }
      // apparition en rebond
      if (v.pop > 0) {
        v.pop = Math.min(1, v.pop + dt * 3.2);
        const k = v.pop, e = k < 1 ? 1 - Math.pow(1 - k, 3) * Math.cos(k * 9) : 1;
        v.model.object.scale.setScalar(Math.max(0.05, e));
        if (k >= 1) v.pop = 0;
      }
      if (v.model.update) v.model.update(dt, time);
      this.syncBeams(v, tw, time);
    }
    for (const v of this.towers.values()) if (!seen.has(v.id)) this.removeTower(v);
  };

  /* --------------------------------------------------- ennemis */
  /** Ennemi : { actor, native } — native = ennemis du jeu (échelle 1 / 1,3 / 1,6 et hauteur déjà réglées). */
  P.makeActor = function (type, champion, boss) {
    const A = PTMT.actors;
    if (A && A.create && A.ready !== false) {
      try {
        const a = A.create(type, !!champion, !!boss);
        if (a && a.object) return { actor: a, native: true };
      } catch (e) {
        if (!this._warnActor) console.warn("PTMT.actors.create :", e);
        this._warnActor = true;
      }
    }
    return { actor: fallbackActor(type, champion, boss), native: false };
  };
  P.newEnemy = function (e) {
    const made = this.makeActor(e.type, e.champion, e.boss);
    const actor = made.actor;
    const obj = actor.object;
    // les ennemis du jeu règlent eux-mêmes leur échelle (et leur hauteur, échelle comprise)
    const base = made.native ? obj.scale.x || 1 : 0.95 * (e.boss ? 1.6 : e.champion ? 1.3 : 1);
    if (!made.native) obj.scale.setScalar(base);
    const flying = !!(actor.flying || e.flying);
    // montgolfière : pas d'ombre portée (elle tomberait loin) ; une ombre douce au sol, juste dessous
    if (flying && actor.mesh) actor.mesh.castShadow = false;
    const v = {
      id: e.id, type: e.type, actor, obj, base, x: e.x, y: e.y, yaw: typeof e.dir === "number" ? e.dir : 0, dying: 0, champion: !!e.champion, boss: !!e.boss,
      flying, snap: false, splashT: 0, ground: 0,
      s: { speed: 0, moving: false, carrying: false, water: false, wading: false, alt: 0, slow: 0, freeze: 0, burn: 0, fear: 0, invisible: 0, barrier: 0, haste: 0, stun: 0, disarmed: 0, radiance: 0, hp: 1, frozen: false, burning: false, inWater: false, hpFrac: 1, untargetable: false, wet: false },
      hp: 1, barrier: 0, anchor: actor.carryAnchor || null, height: made.native ? actor.height || 2.2 * base : (actor.height || 2) * base, e, native: made.native,
    };
    this.placeEnemy(v, e);
    obj.rotation.y = v.yaw;
    this.root.add(obj);
    // ombre douce : montgolfières (toujours), formes de secours en qualité « low » (les ennemis du jeu
    // dessinent la leur dans leurs lots partagés, PTMT.actors.overlay.blobShadows)
    const ov = PTMT.actors && PTMT.actors.overlay;
    v.blob = flying || (!this.high && !(made.native && ov && ov.blobShadows)) ? this.world.addBlob(obj.position.x, obj.position.z, v.ground, 0.8 * base, 0.8 * base, 0.55, 0.12) : -1;
    this.enemies.set(e.id, v);
    return v;
  };
  /** Pose l'objet de l'ennemi : sol, surface de l'eau (nageurs, pataugeurs) ou altitude de vol. */
  P.placeEnemy = function (v, e) {
    const fx = e.fx || {};
    const g = v.flying ? Math.max(this.world.groundAt(v.x, v.y, false), MK_WATER()) : this.world.groundAt(v.x, v.y, !!(e.water || fx.wading));
    v.ground = g;
    v.obj.position.set(toX(v.x), g + (v.flying ? (e.alt || 0) * TILE : 0), toZ(v.y));
  };
  P.releaseEnemy = function (v) {
    // les gemmes accrochées sont reprises par la vue des gemmes
    for (const g of this.gems.values()) if (g.attachedTo === v) this.detachGem(g);
    try {
      v.actor.release && v.actor.release();
    } catch (e) {}
    v.obj.parent && v.obj.parent.remove(v.obj);
    if (v.blob >= 0) {
      this.world.removeBlob(v.blob);
      v.blob = -1;
    }
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
    s.wading = !!fx.wading;
    s.alt = v.flying ? (e.alt || 0) * TILE : 0;
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
    // noms des anciens personnages (compatibilité)
    s.frozen = s.freeze > 0;
    s.burning = s.burn > 0;
    s.inWater = s.water;
    s.hpFrac = s.hp;
    s.untargetable = s.invisible > 0;
    s.wet = s.slow > 0;
  };
  P.syncEnemies = function (st, dt, time) {
    // très léger lissage des positions continues de la simulation (pas de 1/30 s)
    const k = 1 - Math.exp(-dt * 24);
    for (const e of st.enemies || []) {
      let v = this.enemies.get(e.id);
      if (!v) v = this.newEnemy(e);
      v.e = e;
      const jump = v.snap || Math.abs(e.x - v.x) + Math.abs(e.y - v.y) > 1.5;
      v.snap = false;
      v.x = jump ? e.x : v.x + (e.x - v.x) * k;
      v.y = jump ? e.y : v.y + (e.y - v.y) * k;
      // cap : angle monde de la simulation (0 = +Z)
      if (typeof e.dir === "number") v.yaw = jump ? e.dir : turn(v.yaw, e.dir, dt * 12);
      if (e.flying) v.flying = true;
      this.placeEnemy(v, e);
      v.obj.rotation.y = v.yaw;
      const fx = e.fx || {};
      if (v.blob >= 0) {
        const o = v.obj.position;
        if (v.flying) {
          // ombre de la montgolfière : plus grande et plus pâle quand elle monte
          const r = 1.5 * v.base * (1 + 0.1 * (e.alt || 0));
          this.world.setBlob(v.blob, o.x, o.z, v.ground, r, r, 0.62 * (1 - 0.6 * (+fx.invisible || 0)), 0);
        } else this.world.setBlob(v.blob, o.x, o.z, o.y, 0.8 * v.base, 0.8 * v.base, 0.55 * (1 - 0.7 * (+fx.invisible || 0)) * (e.water ? 0.4 : 1), 0.12);
      }
      // pataugeage : éclaboussures régulières tant qu'il avance dans l'eau
      if (fx.wading && e.moving && dt > 0) {
        v.splashT -= dt;
        if (v.splashT <= 0) {
          v.splashT = 0.38 + Math.random() * 0.12;
          _v1.set(v.obj.position.x, v.ground + 0.05, v.obj.position.z);
          burst("wadeSplash", _v1, { radius: 0.55 * v.base }) || burst("splash", _v1, { radius: 0.3 });
        }
      }
      this.fillState(v, e);
      v.hp = v.s.hp;
      v.barrier = v.s.barrier;
      if (v.actor.update) v.actor.update(dt, time, v.s);
    }
  };
  P.killEnemy = function (v) {
    if (v.dying) return;
    v.dying = v.native ? 3 : 1.05;
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
      // nouveaux ennemis : libérés quand leur chute (ou leur fuite) est finie ; sinon minuterie
      if (v.actor.finished === true || v.dying <= 0) {
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
          v.dying = v.native ? 2 : 0.35;
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
      // la gemme du jeu flotte d'elle-même au-dessus de la main ; celle de secours un peu plus haut
      anchor.add(o);
      o.position.set(0, g.native ? 0 : 0.6, 0);
      o.scale.setScalar(1 / Math.max(0.01, ev.base || 1));
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
  /** Point d'accroche d'un porteur (main levée, nacelle, toit du tracteur). */
  P.carryPoint = function (v, out) {
    return v.anchor ? v.anchor.getWorldPosition(out) : this.chest(v, 1.05, out);
  };
  P.syncGems = function (st, dt, time) {
    const W = this.world;
    this.glows.length = 0;
    // logements pleins de chaque cachette (réutilisés d'une image à l'autre)
    const lairs = (st.map && st.map.lairs) || [];
    for (let k = 0; k < lairs.length; k++) {
      const full = this.lairFull[k] || (this.lairFull[k] = []);
      full.length = lairs[k].total || 0;
      full.fill(false);
    }
    for (const gs of st.gems || []) {
      let g = this.gems.get(gs.id);
      if (!g) {
        g = { id: gs.id, color: gs.color | 0, where: null, model: this.makeGem(gs.color | 0), attachedTo: null, lastPos: new THREE.Vector3(), anim: null };
        g.native = typeof (PTMT.models && PTMT.models.gem) === "function" && !g.model.fallback;
        g.model.object.visible = false;
        this.root.add(g.model.object);
        this.gems.set(gs.id, g);
      }
      const prev = g.where;
      const now = gs.where;
      const lairId = gs.lair | 0, slot = gs.slot | 0;
      const carrier = gs.carrier !== undefined && gs.carrier !== null ? this.enemies.get(gs.carrier) : null;
      const o = g.model.object;
      if (prev !== now) {
        if (now === "carried") {
          if ((prev === "lair" || prev === null) && carrier && !this.fresh) {
            // volée : la gemme bondit de son logement jusqu'au voleur
            const from = o.visible ? o.getWorldPosition(_v2) : W.lairSlot(lairId, slot, _v2);
            this.gemAnim(g, from, () => this.carryPoint(carrier, _v3), 0.42, 1.6, () => this.attachGem(g, carrier));
          } else if (prev === "ground" && carrier && !this.fresh) {
            o.getWorldPosition(_v2);
            this.gemAnim(g, _v2, () => this.carryPoint(carrier, _v3), 0.3, 1.0, () => this.attachGem(g, carrier));
          } else if (carrier) this.attachGem(g, carrier);
        } else if (now === "ground") {
          if (prev === "carried" && !this.fresh) {
            this.detachGem(g);
            o.getWorldPosition(_v2);
            const tx = gs.x, ty = gs.y;
            // lâchée d'une montgolfière : longue chute ; sinon petit saut
            const high = _v2.y - this.world.groundAt(tx, ty, false) > 3;
            this.gemAnim(g, _v2, () => _v3.set(toX(tx), this.world.groundAt(tx, ty, false), toZ(ty)), high ? 0.75 : 0.45, high ? 0.4 : 0.9, () => {
              g.model.setState && g.model.setState("ground");
              burst("gemSparkle", o.position, { color: g.color });
            });
          } else {
            this.detachGem(g);
            g.anim = null;
            o.visible = true;
            o.position.set(toX(gs.x), this.world.groundAt(gs.x, gs.y, false), toZ(gs.y));
            g.model.setState && g.model.setState("ground");
          }
        } else if (now === "lair") {
          if (prev === "ground" && !this.fresh) {
            // retour doré dans son logement
            o.getWorldPosition(_v2);
            this.gemAnim(g, _v2, () => W.lairSlot(lairId, slot, _v3), 1.1, 5, () => {
              g.model.setState && g.model.setState("lair");
              burst("gemSparkle", W.lairSlot(lairId, slot, _v3), { color: g.color });
            }, "gold");
          } else {
            this.detachGem(g);
            g.anim = null;
            g.model.setState && g.model.setState("lair");
          }
        } else if (now === "lost") {
          if (g.attachedTo || prev === "carried") {
            o.getWorldPosition(_v2);
            if (!this.fresh) burst("gemLost", _v2, { color: g.color });
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
        o.position.lerpVectors(a.from, to, k);
        o.position.y += a.arcH * 4 * k * (1 - k);
        if (a.trail && !g.native) burst("gemTrail", o.position, { color: g.color, gold: a.trail === "gold" });
        if (k >= 1) {
          g.anim = null;
          a.end && a.end();
        }
      } else if (now === "carried" && !g.attachedTo && carrier) this.attachGem(g, carrier);
      else if (now === "ground" && !g.attachedTo) {
        o.visible = true;
        o.position.set(toX(gs.x), this.world.groundAt(gs.x, gs.y, false), toZ(gs.y));
        // halo au sol de secours (la gemme du jeu a le sien) : sprite posé après les effets
        if (!g.native) this.glows.push(g);
      }
      if (now === "lair" && !g.anim) {
        // posée dans son logement (recalé à chaque image : la cachette secondaire tourne avec l'écran)
        if (o.parent !== this.root) this.root.add(o);
        o.visible = true;
        W.lairSlot(lairId, slot, o.position);
        o.scale.setScalar(1);
        const full = this.lairFull[lairId];
        if (full && slot < full.length) full[slot] = true;
      }
      if (g.model.update) g.model.update(dt, this.real);
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
    // cachettes : logements pleins, alarme (voleurs sans gemme tout près, ou vol récent)
    for (let k = 0; k < lairs.length; k++) {
      W.setLairSlots(k, this.lairFull[k]);
      const L = lairs[k];
      let near = (this.lairFlash[k] || 0) > 0;
      if (!near && L.stock > 0)
        for (const v of this.enemies.values()) {
          if (v.s.carrying || v.dying) continue;
          const dx = v.x - L.x, dy = v.y - L.y;
          if (dx * dx + dy * dy < 2.6 * 2.6) {
            near = true;
            break;
          }
        }
      W.setLairAlarm(k, near);
      if (this.lairFlash[k] > 0) this.lairFlash[k] = Math.max(0, this.lairFlash[k] - dt);
    }
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
          // tirs doubles (Grand Solitaire) : les bouches alternent
          const n = (tv.model.muzzles && tv.model.muzzles.length) || 1;
          this.muzzlePos(tv, n > 1 ? tv.shotK++ % n : 0, start);
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
      // sol sous le projectile (ombre portée des tirs en cloche)
      const sol = this.world.groundAt(v.pos.x / TILE + MW / 2, v.pos.z / TILE + MH / 2, true);
      try {
        v.handle.set && v.handle.set(v.pos, v.dir, sol);
      } catch (e) {}
    }
    for (const v of this.projectiles.values()) {
      if (seen.has(v.id)) continue;
      // impact (s'il n'a pas déjà été montré par l'événement « impact » ou « fizzle »)
      if (!v.impacted) {
        const at = v.arc || v.t > 0.8 ? v.end : v.pos;
        _v2.copy(at);
        _v2.y = this.world.groundAt(at.x / TILE + MW / 2, at.z / TILE + MH / 2, true);
        this.impactBurst(v.kind, _v2, v.arc ? undefined : Math.max(0.2, at.y - _v2.y), v.splash, false);
      }
      try {
        v.handle.release && v.handle.release();
      } catch (e) {}
      this.projectiles.delete(v.id);
    }
  };

  /** Éclat d'impact d'un projectile : « kind + Hit » (fx/13-shots.js) au point au sol g (y = sol),
   *  h = hauteur de l'impact au-dessus du sol (m ; facultative : 1 m, ou le sol pour les tirs en
   *  cloche), splash = rayon de la zone (cases), crit = coup critique (« !! »). Sinon éclat voisin. */
  P.impactBurst = function (kind, g, h, splash, crit) {
    if (burst(kind + "Hit", g, { radius: splash || undefined, h, crit: !!crit })) return;
    const old = OLD_SHOT[kind];
    if (old && burst(old + "Hit", g, { radius: splash || undefined, h, crit: !!crit })) return;
    const fb = HIT_FALLBACK[kind] || ["hit", 0.6];
    const r = Math.max(0.6, splash || 0) * TILE;
    _v4.copy(g);
    _v4.y += h === undefined ? (splash ? 0.3 : 1) : h;
    burst(fb[0], _v4, { radius: splash ? r * 0.45 : fb[1], family: HIT_FAMILY[kind] || "fire", color: kind === "blueFire" ? "#6aa0ff" : kind === "darkOrb" ? "#a070ff" : undefined });
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
    const act = (v, name, target) => {
      if (v && v.actor.event)
        try {
          v.actor.event(name, target);
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
          if (!v.native) burst("ko", this.chest(v, 0.5, _v1), {});
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
          act(a, "heal", this.chest(b, 0.6, new THREE.Vector3()));
          act(b, "healed");
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
        _v1.set(toX(ev.x), this.world.groundAt(ev.x, ev.y, true), toZ(ev.y));
        // hauteur : poitrine de la cible touchée (tirs directs), sol pour les tirs en cloche
        let h;
        if (pv) {
          pv.impacted = true;
          if (!pv.arc && pv.t > 0.5) {
            _v1.x = pv.end.x;
            _v1.z = pv.end.z;
            h = Math.max(0.2, pv.end.y - _v1.y);
          }
        }
        if (h === undefined && !(pv && pv.arc)) {
          const tv = ev.enemyId !== undefined ? this.enemies.get(ev.enemyId) : null;
          if (tv) h = tv.height * 0.55;
        }
        this.impactBurst(ev.kind, _v1, h, ev.r || 0, ev.crit);
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
        const g = this.gems.get(ev.gemId);
        const at = new THREE.Vector3();
        if (g) g.model.object.getWorldPosition(at);
        else if (v) this.chest(v, 0, at);
        act(v, "lasso", at);
        break;
      }
      case "barrierUp": {
        const v = en(ev.enemyId);
        if (v) burst("sparkle", this.chest(v, 0.5, _v1), { color: "#6ff0d8", radius: 0.9 });
        break;
      }
      case "stun":
        break;
      case "immune": {
        const v = en(ev.enemyId);
        act(v, "immune");
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
        // la bonne cachette réagit (alarme, logement qui s'éclaire)
        const k = ev.lairId !== undefined && ev.lairId !== null ? ev.lairId : 0;
        this.lairFlash[k] = 1.6;
        break;
      }
      case "blink": {
        // korrigan : téléporté sans lissage ; pouf violet au départ puis à l'arrivée
        const v = en(ev.enemyId);
        if (!v) break;
        v.x = ev.x;
        v.y = ev.y;
        v.snap = true;
        if (v.e) this.placeEnemy(v, v.e);
        _v2.set(toX(ev.fromX), this.world.groundAt(ev.fromX, ev.fromY, false) + 0.4, toZ(ev.fromY));
        act(v, "blink", _v2.clone());
        if (!v.native) {
          burst("blinkPoof", _v2, { radius: 1 }) || burst("sparkle", _v2, { color: "#b070ff", radius: 1 });
          _v3.set(toX(ev.x), this.world.groundAt(ev.x, ev.y, false) + 0.4, toZ(ev.y));
          burst("blinkPoof", _v3, { radius: 1 }) || burst("sparkle", _v3, { color: "#b070ff", radius: 1 });
        }
        break;
      }
      case "split": {
        // tracteur détruit : il se renverse, explosion de foin ; les fermiers arrivent par « spawn »
        const v = en(ev.enemyId);
        act(v, "split");
        if (!v || !v.native) {
          _v1.set(toX(ev.x), this.world.groundAt(ev.x, ev.y, false) + 0.6, toZ(ev.y));
          burst("hayBurst", _v1, { radius: 1.4 }) || burst("smoke", _v1, { radius: 1.4 });
        }
        if (PTMT.fx) PTMT.fx.shake = Math.max(PTMT.fx.shake || 0, 0.3);
        break;
      }
      case "flash": {
        // touriste : il se tourne vers la tour et déclenche ; l'éclair part FLASH_AT s plus tard,
        // les tours sont éblouies à cet instant (rayons vers chacune)
        const v = en(ev.enemyId);
        const delay = (PTMT.actors && PTMT.actors.FLASH_AT) || 0.36;
        const ids = ev.towerIds || [];
        const t0 = ids.length ? this.towers.get(ids[0]) : null;
        if (t0) act(v, "flash", _v1.copy(t0.model.object.position).setY(t0.top + 1.2).clone());
        else act(v, "flash");
        for (const id of ids) {
          const tv = this.towers.get(id);
          if (tv) tv.dazzleAt = this.real + delay;
        }
        this.flashes.push({ t: -delay, enemyId: ev.enemyId, x: ev.x, y: ev.y, ids: ids.slice(), native: !!(v && v.native), done: false });
        break;
      }
      case "dazzleEnd": {
        const tv = this.towers.get(ev.towerId);
        if (tv && tv.dazzled) {
          tv.dazzled = false;
          tv.model.setDazzled && tv.model.setDazzled(false);
        }
        break;
      }
      case "beamOff": {
        // le jet s'éteint tout de suite (l'état suit à l'image suivante)
        const tv = this.towers.get(ev.towerId);
        const k = ev.slot | 0;
        if (tv && tv.beams[k]) {
          tv.beams[k].fx.release();
          if (tv.beams[k].chain) tv.beams[k].chain.release();
          tv.beams[k] = null;
          tv.beamOn[k] = false;
          tv.model.setBeam && tv.model.setBeam(false, 0, k);
        }
        break;
      }
      case "tide":
        this.world.setTide(ev.state === "low", !this.fresh);
        this.tideSeen = ev.state;
        break;
      case "gateOpen":
        this.world.openGate(ev.entranceId, !this.fresh);
        break;
      case "pickup": {
        const v = en(ev.enemyId);
        act(v, "pickup");
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
        this.world.openSecret(!this.fresh);
        for (let j = 0; j < MH; j++) for (let i = 0; i < MW; i++) if (this.grid[j][i] === "s") this.grid[j] = this.grid[j].slice(0, i) + "#" + this.grid[j].slice(i + 1);
        this.updateTiles(true);
        break;
      case "waveStart": {
        // poussière aux entrées de la vague qui commence (celles que l'aperçu annonçait)
        const ids = this.routes ? this.routes.lastEntrances : null;
        for (const e of this.world.entrances || []) {
          if (!e.open || (ids && ids.length && !ids.includes(e.id))) continue;
          _v1.set(toX(e.x), 0, toZ(e.y));
          burst("waveDust", _v1, { radius: 1.2 + 0.4 * e.w });
        }
        break;
      }
      case "spawn": {
        const v = en(ev.enemyId);
        act(v, "spawn");
        break;
      }
      case "bossArrives": {
        // arrivée d'un boss : nuage de poussière et petite secousse
        const v = en(ev.enemyId);
        if (v) burst("waveDust", v.obj.position, { radius: 2.2 });
        if (PTMT.fx) PTMT.fx.shake = Math.max(PTMT.fx.shake || 0, 0.4);
        break;
      }
    }
  };
  /** Case boisée coupée : animation (sauf vue recréée), grille et cases constructibles mises à jour. */
  P.cutTile = function (i, j, animate) {
    const row = this.grid[j];
    if (!row) return;
    const ch = row[i];
    const info = tileInfo(ch);
    if (!info.forest) return;
    this.grid[j] = row.slice(0, i) + (info.cutTo || ".") + row.slice(i + 1);
    if (animate === false) this.world.clearForest(i, j);
    else this.world.cutForest(i, j);
    this.updateTiles(true);
  };
  /**
   * Suit la grille vivante de l'état (state.map.version) même sans événement : coupes, passage
   * ouvert, barrières ouvertes (g → E), marée. Sur une vue recréée en cours de partie, tout se pose
   * sans animation.
   */
  P.syncGrid = function (st) {
    const g = st && st.map && st.map.grid;
    if (!g) return;
    const tide = st.tide || null;
    if (tide && tide !== this.tideSeen) {
      this.tideSeen = tide;
      this.world.setTide(tide === "low", !this.fresh);
    }
    if (st.map.version !== undefined) {
      if (st.map.version === this.mapVersion) return;
      this.mapVersion = st.map.version;
    }
    const animate = !this.fresh;
    for (let j = 0; j < MH; j++) {
      const a = g[j], b = this.grid[j];
      if (a === b || !a) continue;
      const row = typeof a === "string" ? a : a.join("");
      if (row === b) continue;
      let secret = false;
      for (let i = 0; i < MW; i++) {
        const was = b[i], now = row[i];
        if (was === now) continue;
        if (tileInfo(was).forest && now === tileInfo(was).cutTo) this.cutTile(i, j, animate);
        else if (was === "s" && now === "#") secret = true;
      }
      if (secret) this.world.openSecret(animate);
      this.grid[j] = row;
      this.tileSig = "";
    }
    // barrières ouvertes (l'événement gateOpen a pu être manqué)
    for (const e of (st.map && st.map.entrances) || []) if (e.open) this.world.openGate(e.id, animate);
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
    // fantôme par famille (le cygne hors de l'eau a sa mare : fantôme à part)
    const gk = inside ? (family === "swan" && this.terrainAt(i, j) !== "water" ? "swan:mare" : family) : null;
    for (const k in this.ghosts) if (k !== gk) this.ghosts[k].object.visible = false;
    if (!inside) {
      U.uRange.value.w = 0;
      return;
    }
    const g = this.ghost(family, i, j, gk);
    const top = this.tileTop(i, j);
    g.object.visible = true;
    g.object.position.set(toX(i + 0.5), top, toZ(j + 0.5));
    if (g.model.aim) g.model.aim(this.roadYaw(i, j));
    g.mat.color.copy(lin(ok ? "#d0ffb8" : "#ff9a8a"));
    g.mat.emissive.copy(lin(ok ? "#2c6a18" : "#7a1a12"));
    g.matSk.color.copy(g.mat.color);
    g.matSk.emissive.copy(g.mat.emissive);
    const r = this.towerRange({ family, level: 1, spec: null, i, j });
    U.uRange.value.set(toX(i + 0.5), toZ(j + 0.5), r * TILE, ok ? 0.9 : 0.45);
    U.uRangeCol.value.copy(lin(ok ? RANGE_HEX[family] || "#ffffff" : "#ff8a7a"));
  };
  P.ghost = function (family, i, j, key) {
    key = key || family;
    if (this.ghosts[key]) return this.ghosts[key];
    const model = this.makeTowerModel(family, 1, null, i, j);
    // fantôme : la tour avec ses couleurs, teintée (vert : possible, rouge : refusé) et translucide
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, color: 0xc8ffb0, emissive: 0x245a14, transparent: true, opacity: 0.72, depthWrite: false });
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
    return (this.ghosts[key] = { model, object: model.object, mat, matSk });
  };
  /** Réticule d'un sort : « cut » = case visée (verte si boisée), « meteor » = disque de l'impact. */
  P.target = function (spell, x, y) {
    const U = this.world.ov;
    if (!spell) {
      this.targetState = null;
      U.uRet.value.w = 0;
      return;
    }
    // visée commencée sans position (par exemple −99, −99) : rien à montrer tant qu'aucune vraie
    // position n'arrive
    const has = typeof x === "number" && typeof y === "number" && x > -1 && y > -1 && x < MW + 1 && y < MH + 1;
    if (!has) {
      this.targetState = { spell, x: null, y: null };
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
    // tours de secours : boules d'eau en réserve (cygne), étoiles de l'éblouissement
    for (const v of this.towers.values()) {
      const sh = v.model.show;
      if (!sh) continue;
      const o = v.model.object.position;
      const hgt = (v.model.height || 2) * v.model.object.scale.y;
      for (let q = 0; q < sh.max; q++) {
        const a = (q / Math.max(1, sh.max)) * TAU + time * 1.4;
        const f = q < sh.full ? 1 : q === sh.full ? 0.25 + 0.6 * sh.part : 0;
        if (f <= 0) continue;
        H.put(o.x + Math.cos(a) * 1.1, o.y + hgt * 0.75, o.z + Math.sin(a) * 1.1, 0.62 * f, HUD.orb, 1, 1, 1, 1, 0, 0, 0, 1);
      }
      if (sh.dazzled) H.put(o.x, o.y + hgt + 0.6 * k, o.z, 0.9 * k, HUD.stun, 1, 1, 1, 1, time * 3, 0, 0, 1);
    }
    // flèches d'amélioration au-dessus des tours
    for (const id of this.hints) {
      const v = this.towers.get(id);
      if (!v) continue;
      const o = v.model.object.position;
      const hgt = (v.model.height || 2) * v.model.object.scale.y;
      const b = Math.abs(Math.sin(time * 4 + v.i)) * 0.4;
      H.put(o.x, o.y + hgt + 0.9 * k + b, o.z, 1.7 * k, HUD.glow, 1, 0.85, 0.3, 0.6, 0, 1, 0, 1);
      H.put(o.x, o.y + hgt + 0.9 * k + b, o.z, 1.25 * k, HUD.arrow, one[0], one[1], one[2], 1, 0, 0, 0, 1);
    }
    // coupe visée : coins par-dessus les arbres (le réticule au sol est caché par les feuillages)
    const ts = this.targetState;
    if (ts && ts.spell === "cut" && ts.x !== null) {
      const i = Math.floor(ts.x), j = Math.floor(ts.y);
      if (i >= 0 && j >= 0 && i < MW && j < MH) {
        const ok = !!tileInfo(this.grid[j][i]).forest;
        const pulse = 1 + 0.05 * Math.sin(time * 7);
        const sz = TILE * Math.sin(this.cam.elev) * 0.98 * pulse;
        const cx = toX(i + 0.5), cz = toZ(j + 0.5), cy = this.tileTop(i, j) + 0.1;
        const col = ok ? [0.62, 1, 0.45] : [1, 0.42, 0.35];
        H.put(cx, cy, cz, sz, HUD.corners, col[0], col[1], col[2], 1, 0, 0, 0, 1 / Math.sin(this.cam.elev));
        if (ok) {
          // repère au-dessus des cimes
          const bob = Math.abs(Math.sin(time * 4)) * 0.4;
          H.put(cx, cy + 5.2 + bob, cz, 1.9 * k, HUD.glow, col[0], col[1], col[2], 0.55, 0, 1, 0, 1);
          H.put(cx, cy + 5.2 + bob, cz, 1.3 * k, HUD.arrow, col[0], col[1], col[2], 1, Math.PI, 0, 0, 1);
        }
      }
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
    dt = Math.max(0, Math.min(0.25, dt || 0));
    // horloge du décor (eau, feuillages, animations du monde) : temps réel, sauf si l'on demande de
    // suivre le temps du jeu (banc d'essai qui accélère la simulation : view.clock = "game")
    const realDt = this.clock === "game" ? dt : Math.min(0.1, (now - this.lastReal) / 1000);
    this.lastReal = now;
    this.real += realDt;
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
    // menhirs (plus lumineux sous une tour)
    for (const m of this.world.menhirs || []) {
      let on = false;
      for (const v of this.towers.values()) if (v.i === m.i && v.j === m.j) on = true;
      if (on !== m.on) {
        m.on = on;
        m.model.setActive && m.model.setActive(on);
      }
    }
    if (this.rangeTower !== null && !this.previewState) this.showRange(this.rangeTower, this.rangeValue);
    this.updateTiles();
    this.world.update(realDt, this.real);
    if (this.ownFx && PTMT.fx.update) {
      try {
        PTMT.fx.update(dt, this.time);
      } catch (e) {}
    }
    this.drawFxSprites(st);
    this.updateFlashes(realDt);
    for (const k in this.ghosts) {
      const g = this.ghosts[k];
      if (g.object.visible) {
        g.mat.opacity = g.matSk.opacity = 0.66 + 0.1 * Math.sin(this.real * 5);
        g.model.update && g.model.update(realDt, this.real);
      }
    }
    this.drawHud(this.real);
    // bannières des entrées, flèches au sol, trajets de la prochaine vague (lot « repères »)
    if (this.routes) {
      try {
        this.routes.update(st, realDt, this.real);
      } catch (e) {
        if (!this._warnRoutes) console.warn("Aperçu des vagues :", e);
        this._warnRoutes = true;
      }
    }
    this.updateBossLabels();
    this.fresh = false;
    this.frameNo = (this.frameNo || 0) + 1;
  };
  /**
   * Flash du touriste : à l'instant où l'éclair part (FLASH_AT s après l'événement), traits de
   * lumière blancs de l'appareil vers chaque tour éblouie, éclair sur la tour (PTMT.fx « dazzle »).
   */
  P.updateFlashes = function (dt) {
    const FX = PTMT.fx, _ = FX && FX._;
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.t += dt;
      if (f.t < 0) continue;
      if (!f.done) {
        f.done = true;
        const v = this.enemies.get(f.enemyId);
        if (v) this.chest(v, 0.75, _v1);
        else _v1.set(toX(f.x), this.world.groundAt(f.x, f.y, false) + 1.6, toZ(f.y));
        if (!f.native) burst("hit", _v1, { radius: 2.2, family: "ice" });
        if (_ && _.S && _.emit) {
          const c = PTMT.gfx.CELL;
          for (const id of f.ids) {
            const tv = this.towers.get(id);
            if (!tv) continue;
            _v2.copy(tv.model.object.position);
            _v2.y = tv.top + Math.max(1, (tv.model.height || 2) * 0.6);
            const dx = _v2.x - _v1.x, dy = _v2.y - _v1.y, dz = _v2.z - _v1.z;
            const L = Math.hypot(dx, dy, dz) || 1, sp = 38;
            for (let k = 0; k < 7; k++) {
              const jx = (Math.random() - 0.5) * 0.5, jz = (Math.random() - 0.5) * 0.5;
              _.emit({ x: _v1.x + jx * 0.4, y: _v1.y, z: _v1.z + jz * 0.4, vx: (dx / L) * sp + jx * 3, vy: (dy / L) * sp, vz: (dz / L) * sp + jz * 3, life: L / sp, s0: 0.42, s1: 0.22, cell: c.spark, mode: 2, stretch: 0.07, r: 1, g: 1, b: 0.92, a: 1, a1: 0.7, add: 1, delay: k * 0.022 });
            }
            _v3.set(_v2.x, tv.top, _v2.z);
            burst("dazzle", _v3, { height: tv.model.height || 2 }) || burst("sparkle", _v2, { color: "#ffffff", radius: 1.4 });
          }
        }
      }
      if (f.t > 0.6) this.flashes.splice(i, 1);
    }
  };
  /** Sprites « posés » des effets (effacés à chaque PTMT.fx.update, donc écrits après) : halo des
   *  gemmes au sol, aura de Frénésie sous les tours. */
  P.drawFxSprites = function (st) {
    const FX = PTMT.fx, W = FX && FX.world;
    if (!W || !(FX._ && FX._.S)) return;
    try {
      if (W.gemGlow) for (const g of this.glows) if (g.model.object.visible) W.gemGlow(g.model.object.position, g.color, this.real);
      if (st.frenzy && W.frenzyAura) for (const v of this.towers.values()) W.frenzyAura(v.model.object.position, this.real, 1.9);
    } catch (e) {}
  };
  P.render = function () {
    // petite secousse suggérée par les effets (PTMT.fx.shake, 0..1, décroît seule) : la caméra reste fixe
    const FX = PTMT.fx, cam = this.camera;
    const sh = this.shakeOn && FX && FX.shake > 0.01 ? Math.min(1, FX.shake) : 0;
    if (!sh) return this.renderer.render(this.scene, cam);
    const t = this.real * 55, a = sh * 0.2;
    _v4.copy(this.cam.right).multiplyScalar(Math.sin(t * 1.3) * a).addScaledVector(this.cam.up, Math.cos(t * 1.7 + 1) * a);
    cam.position.add(_v4);
    cam.updateMatrixWorld();
    this.renderer.render(this.scene, cam);
    cam.position.sub(_v4);
    cam.updateMatrixWorld();
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
    if (this.routes && this.routes.dispose) this.routes.dispose();
    this.root.parent && this.root.parent.remove(this.root);
    this.world.dispose();
    if (this.layer) this.layer.remove();
    if (this.ownFx && PTMT.fx.dispose) PTMT.fx.dispose();
  };
})();
