// « Pas touche à mes trésors » — caméra fixe vue du dessus (PTMT.view, partie « caméra »).
//
// Caméra orthographique immobile, inclinée d'environ 58° au-dessus de l'horizon : on voit le
// dessus des modèles et un peu de leur face avant. Toute la carte (20 × 13 cases, plus une petite
// marge) est cadrée dans la zone libre entre les bandes de l'interface (insets, en px CSS). En
// portrait (hauteur > largeur), la caméra passe à l'est de la carte : les colonnes deviennent des
// lignes et la carte remplit l'écran du téléphone. Aucun déplacement, zoom ni rotation par le
// joueur (un cadrage rapproché existe pour le banc d'essai seulement : focus).
//
// Visée : rayon lancé depuis le pixel et avancé pas à pas contre le relief réel (dessus de l'eau
// et tabliers des ponts compris), puis affiné par dichotomie ; les tours sont testées avant le sol
// (cylindres), si bien qu'un clic sur la tête d'une tour haute la désigne.
(function () {
  "use strict";
  const PTMT = (globalThis.PTMT = globalThis.PTMT || {});
  if (typeof THREE === "undefined") return;
  const VIEW = (PTMT.view = PTMT.view || {});

  const _v = new THREE.Vector3(), _o = new THREE.Vector3(), _d = new THREE.Vector3();

  function Camera(opts) {
    this.camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 1, 600);
    this.camera.name = "Caméra de la carte";
    this.elev = ((opts && opts.elevation) || 58) * (Math.PI / 180);
    this.dist = 220;
    this.az = 0;
    this.portrait = false;
    this.w = 1;
    this.h = 1;
    this.insets = { top: 0, bottom: 0, left: 0, right: 0 };
    this.pxPerM = 10;
    this.focus = null;
    this.right = new THREE.Vector3(1, 0, 0);
    this.up = new THREE.Vector3(0, 1, 0);
    this.forward = new THREE.Vector3(0, -1, 0);
  }
  const P = Camera.prototype;

  /** Cadre la carte dans w × h px moins les bandes insets. Renvoie true si l'orientation a changé. */
  P.frame = function (w, h, insets) {
    const K = VIEW._map.K;
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
    this.insets = Object.assign({ top: 0, bottom: 0, left: 0, right: 0 }, insets || {});
    const portrait = this.h > this.w * 1.05;
    const changed = portrait !== this.portrait || this.az === undefined;
    this.portrait = portrait;
    this.az = portrait ? Math.PI / 2 : 0;
    const cam = this.camera;
    const ce = Math.cos(this.elev), se = Math.sin(this.elev);
    cam.position.set(Math.sin(this.az) * ce, se, Math.cos(this.az) * ce).multiplyScalar(this.dist);
    cam.up.set(0, 1, 0);
    cam.lookAt(0, 0, 0);
    cam.updateMatrixWorld();
    this.right.setFromMatrixColumn(cam.matrixWorld, 0);
    this.up.setFromMatrixColumn(cam.matrixWorld, 1);
    cam.getWorldDirection(this.forward);
    const mapW = K.MW * K.TILE, mapD = K.MH * K.TILE, margin = 0.3 * K.TILE;
    const extra = 1.8 * ce; // têtes des objets posés au bord du fond
    const spanX = (portrait ? mapD : mapW) + margin * 2;
    const spanY = ((portrait ? mapW : mapD) + margin * 2) * se + extra;
    const ins = this.insets;
    const aw = Math.max(40, this.w - ins.left - ins.right), ah = Math.max(40, this.h - ins.top - ins.bottom);
    let s = Math.min(aw / spanX, ah / spanY);
    const cx = ins.left + aw / 2, cy = ins.top + ah / 2;
    let xm = (this.w / 2 - cx) / s, ym = (cy - this.h / 2) / s + extra / 2;
    if (this.focus) {
      // banc d'essai : cadrage rapproché sur un point de la carte
      s *= this.focus.zoom;
      _v.set((this.focus.x - K.MW / 2) * K.TILE, this.focus.h || 0.5, (this.focus.y - K.MH / 2) * K.TILE);
      xm = _v.dot(this.right);
      ym = _v.dot(this.up);
    }
    this.pxPerM = s;
    cam.left = xm - this.w / 2 / s;
    cam.right = xm + this.w / 2 / s;
    cam.top = ym + this.h / 2 / s;
    cam.bottom = ym - this.h / 2 / s;
    cam.near = 1;
    cam.far = this.dist * 2 + 100;
    cam.updateProjectionMatrix();
    return changed;
  };

  /** Point monde → pixels CSS relatifs au canvas. */
  P.project = function (v, out) {
    _v.copy(v).project(this.camera);
    out = out || { x: 0, y: 0 };
    out.x = ((_v.x + 1) / 2) * this.w;
    out.y = ((1 - _v.y) / 2) * this.h;
    return out;
  };

  /**
   * Rayon depuis un pixel (clientX, clientY) contre le relief. world : monde de la carte ; towers :
   * [{ id, i, j, x, z, base, top, r }] (monde). Renvoie { i, j, x, y, towerId? } ou null.
   */
  P.pick = function (clientX, clientY, rect, world, towers) {
    const K = VIEW._map.K;
    const nx = ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
    const ny = -((clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
    _o.set(nx, ny, -1).unproject(this.camera);
    _d.copy(this.forward);
    const toMapX = (X) => X / K.TILE + K.MW / 2, toMapY = (Z) => Z / K.TILE + K.MH / 2;
    const surf = (X, Z) => {
      const x = toMapX(X), y = toMapY(Z);
      return Math.max(world.groundAt(x, y, false), world.field.charAt(Math.floor(x), Math.floor(y)) === "~" || world.field.charAt(Math.floor(x), Math.floor(y)) === "w" ? K.WATER_Y : -9);
    };
    const tTop = (7 - _o.y) / _d.y, tBot = (-1.6 - _o.y) / _d.y;
    const hs = Math.hypot(_d.x, _d.z) || 1;
    const dt = 0.12 / hs;
    let prev = tTop, hit = null;
    for (let t = tTop; t <= tBot; t += dt) {
      const X = _o.x + _d.x * t, Y = _o.y + _d.y * t, Z = _o.z + _d.z * t;
      if (Y <= surf(X, Z)) {
        let a = prev, b = t;
        for (let k = 0; k < 7; k++) {
          const m = (a + b) / 2;
          if (_o.y + _d.y * m <= surf(_o.x + _d.x * m, _o.z + _d.z * m)) b = m;
          else a = m;
        }
        hit = b;
        break;
      }
      prev = t;
    }
    // tours d'abord (cylindres verticaux)
    let best = hit === null ? Infinity : hit, tower = null;
    if (towers)
      for (const tw of towers) {
        const ox = _o.x - tw.x, oz = _o.z - tw.z;
        const a = _d.x * _d.x + _d.z * _d.z, b = 2 * (ox * _d.x + oz * _d.z), c = ox * ox + oz * oz - tw.r * tw.r;
        const disc = b * b - 4 * a * c;
        if (disc < 0) continue;
        const sq = Math.sqrt(disc);
        for (const t of [(-b - sq) / (2 * a), (-b + sq) / (2 * a)]) {
          const y = _o.y + _d.y * t;
          if (t < best && y >= tw.base && y <= tw.top) {
            best = t;
            tower = tw;
          }
        }
        // couvercle
        const tc = (tw.top - _o.y) / _d.y;
        const cx = _o.x + _d.x * tc - tw.x, cz = _o.z + _d.z * tc - tw.z;
        if (tc < best && cx * cx + cz * cz <= tw.r * tw.r) {
          best = tc;
          tower = tw;
        }
      }
    if (tower) return { i: tower.i, j: tower.j, x: tower.i + 0.5, y: tower.j + 0.5, towerId: tower.id };
    if (hit === null) return null;
    const x = toMapX(_o.x + _d.x * hit), y = toMapY(_o.z + _d.z * hit);
    if (x < 0 || y < 0 || x >= K.MW || y >= K.MH) return null;
    return { i: Math.floor(x), j: Math.floor(y), x, y };
  };

  VIEW._Camera = Camera;
})();
