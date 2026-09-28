// « Pas touche à mes trésors » — caméra aérienne : déplacement, zoom, rotation facultative,
// recentrage animé. Souris, tactile (un doigt : glisser ; deux doigts : pincer et tourner) et clavier.
(function () {
  "use strict";
  const PTMT = (globalThis.PTMT = globalThis.PTMT || {});

  function CameraRig(camera, dom, opts = {}) {
    this.camera = camera;
    this.dom = dom;
    this.target = new THREE.Vector3(0, 1, 0);
    this.distance = opts.distance || 78;
    this.minDistance = 22;
    this.maxDistance = 150;
    this.yaw = opts.yaw || 0; // rotation autour de la verticale
    this.pitch = 0.95; // inclinaison (rad au-dessus de l'horizon)
    this.bounds = opts.bounds || { x0: -60, x1: 60, z0: -42, z1: 42 };
    this.anim = null;
    this.pointers = new Map();
    this.drag = null;
    this.keys = new Set();
    this.onTap = null; // (clientX, clientY, event) → void
    this.onHover = null;
    this.enabled = true;
    this._bind();
    this.apply();
  }
  const C = CameraRig.prototype;

  C._bind = function () {
    const dom = this.dom;
    dom.addEventListener("pointerdown", (e) => this.down(e));
    window.addEventListener("pointermove", (e) => this.move(e));
    window.addEventListener("pointerup", (e) => this.up(e));
    window.addEventListener("pointercancel", (e) => this.up(e, true));
    dom.addEventListener("wheel", (e) => {
      e.preventDefault();
      if (!this.enabled) return;
      this.zoomBy(Math.exp(e.deltaY * 0.0012));
    }, { passive: false });
    dom.addEventListener("contextmenu", (e) => e.preventDefault());
    window.addEventListener("keydown", (e) => {
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "SELECT")) return;
      this.keys.add(e.key.toLowerCase());
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener("blur", () => this.keys.clear());
  };
  C.down = function (e) {
    if (!this.enabled) return;
    this.dom.setPointerCapture && this.dom.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, button: e.button, t: performance.now() });
    this.anim = null;
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), ang: Math.atan2(b.y - a.y, b.x - a.x), dist: this.distance, yaw: this.yaw };
      this.drag = null;
    } else {
      this.drag = { moved: false, rotate: e.button === 2 || e.shiftKey };
    }
  };
  C.move = function (e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) {
      if (this.onHover && e.target === this.dom) this.onHover(e.clientX, e.clientY);
      return;
    }
    const dx = e.clientX - p.x,
      dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (this.pinch && this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y),
        ang = Math.atan2(b.y - a.y, b.x - a.x);
      this.distance = Math.max(this.minDistance, Math.min(this.maxDistance, (this.pinch.dist * this.pinch.d) / Math.max(20, d)));
      this.yaw = this.pinch.yaw - (ang - this.pinch.ang);
      this.apply();
      return;
    }
    if (!this.drag) return;
    if (!this.drag.moved && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > 7) this.drag.moved = true;
    if (!this.drag.moved) return;
    if (this.drag.rotate) {
      this.yaw -= dx * 0.006;
      this.pitch = Math.max(0.62, Math.min(1.35, this.pitch + dy * 0.004));
    } else this.panPixels(dx, dy);
    this.apply();
  };
  C.up = function (e, cancel) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinch = null;
    if (!cancel && this.drag && !this.drag.moved && this.pointers.size === 0 && performance.now() - p.t < 600 && this.onTap) this.onTap(e.clientX, e.clientY, e);
    if (this.pointers.size === 0) this.drag = null;
  };
  C.panPixels = function (dx, dy) {
    const h = this.dom.clientHeight || 800;
    const scale = (2 * this.distance * Math.tan((this.camera.fov * Math.PI) / 360)) / h;
    const c = Math.cos(this.yaw),
      s = Math.sin(this.yaw);
    // Axes écran projetés au sol.
    const rx = c,
      rz = -s,
      fx = s,
      fz = c;
    this.target.x -= (dx * rx + dy * fx / Math.sin(this.pitch)) * scale;
    this.target.z -= (dx * rz + dy * fz / Math.sin(this.pitch)) * scale;
    this.clamp();
  };
  C.zoomBy = function (k) {
    this.distance = Math.max(this.minDistance, Math.min(this.maxDistance, this.distance * k));
    this.apply();
  };
  C.rotateBy = function (a) {
    this.yaw += a;
    this.apply();
  };
  C.clamp = function () {
    const b = this.bounds;
    this.target.x = Math.max(b.x0, Math.min(b.x1, this.target.x));
    this.target.z = Math.max(b.z0, Math.min(b.z1, this.target.z));
  };
  C.apply = function () {
    const cam = this.camera;
    const cp = Math.cos(this.pitch),
      sp = Math.sin(this.pitch);
    cam.position.set(this.target.x + Math.sin(this.yaw) * cp * this.distance, this.target.y + sp * this.distance, this.target.z + Math.cos(this.yaw) * cp * this.distance);
    cam.lookAt(this.target);
    cam.updateMatrixWorld();
  };
  /** Recentrage animé sur un point (monde). */
  C.focusOn = function (point, distance, duration = 0.8) {
    this.anim = { from: this.target.clone(), to: new THREE.Vector3(point.x, this.target.y, point.z), d0: this.distance, d1: distance || this.distance, t: 0, dur: duration };
  };
  C.frame = function (bounds, yaw = 0) {
    this.bounds = { x0: bounds.x0, x1: bounds.x1, z0: bounds.z0, z1: bounds.z1 };
    this.target.set((bounds.x0 + bounds.x1) / 2, 1, (bounds.z0 + bounds.z1) / 2);
    const w = bounds.x1 - bounds.x0,
      h = bounds.z1 - bounds.z0;
    const aspect = (this.dom.clientWidth || 1) / (this.dom.clientHeight || 1);
    const fov = (this.camera.fov * Math.PI) / 180;
    const needH = (h * 0.62) / Math.tan(fov / 2) / 1.05;
    const needW = w / 2 / (Math.tan(fov / 2) * aspect);
    this.yaw = yaw;
    this.distance = Math.max(this.minDistance, Math.min(this.maxDistance, Math.max(needH, needW) * 0.95));
    this.apply();
  };
  C.update = function (dt) {
    if (this.anim) {
      const a = this.anim;
      a.t += dt;
      const k = Math.min(1, a.t / a.dur),
        e = k * k * (3 - 2 * k);
      this.target.lerpVectors(a.from, a.to, e);
      this.distance = a.d0 + (a.d1 - a.d0) * e;
      if (k >= 1) this.anim = null;
      this.apply();
    }
    if (this.keys.size && this.enabled) {
      const sp = this.distance * 0.9 * dt;
      let dx = 0,
        dz = 0;
      if (this.keys.has("arrowleft") || this.keys.has("q") || this.keys.has("a")) dx -= 1;
      if (this.keys.has("arrowright") || this.keys.has("d")) dx += 1;
      if (this.keys.has("arrowup") || this.keys.has("z") || this.keys.has("w")) dz -= 1;
      if (this.keys.has("arrowdown") || this.keys.has("s")) dz += 1;
      if (dx || dz) {
        const c = Math.cos(this.yaw),
          s = Math.sin(this.yaw);
        this.target.x += (dx * c + dz * s) * sp;
        this.target.z += (-dx * s + dz * c) * sp;
        this.clamp();
        this.apply();
      }
      if (this.keys.has("+") || this.keys.has("=")) this.zoomBy(1 - dt * 1.2);
      if (this.keys.has("-")) this.zoomBy(1 + dt * 1.2);
    }
  };

  PTMT.CameraRig = CameraRig;
})();
