// La Fête du Moulin — planchers, pontons, gradins et escaliers de bois, praticables à pied.
//
// La fête ne touche pas au terrain : là où il faut du plat (au-dessus de l'eau, sur une pente),
// elle pose un plancher sur pilotis. Chaque plancher est aussi une « surface praticable » : le
// personnage du moulin y marche (accroche MoulinV32.walkSurfaces) et world.heightAt en tient
// compte, si bien que les stands se posent dessus comme sur le sol.
//
//   MF.decks.install(world)                      à faire une fois, avant de construire le décor
//   MF.decks.rect(world, parent, { x, z, w, l, heading, y, rails, name })   plancher rectangulaire
//   MF.decks.ring(world, parent, { cx, cz, r0, r1, a0, a1, y, name })       gradin en arc
//   MF.decks.stairs(world, parent, { from: [x, z, y], to: [x, z, y], width }) escalier (ou rampe)
//   MF.decks.topAt(x, z) → hauteur du plancher en ce point, ou -Infinity ; world.onDeck(x, z)
(function () {
  "use strict";
  const MF = (globalThis.MoulinFete = globalThis.MoulinFete || {});
  const T = () => globalThis.THREE;
  const list = [];
  let host = null;
  const WOOD = "#b98350", WOOD2 = "#a8733f", BEAM = "#7a5028";

  function register(surface) {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const p of surface.polygon) {
      x0 = Math.min(x0, p[0]);
      x1 = Math.max(x1, p[0]);
      z0 = Math.min(z0, p[1]);
      z1 = Math.max(z1, p[1]);
    }
    Object.assign(surface, { x0, x1, z0, z1 });
    list.push(surface);
    if (host && host.addSurface) host.addSurface(surface);
    return surface;
  }
  function topAt(x, z) {
    let best = -Infinity;
    for (const s of list) if (x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1 && MF.pointInPoly(x, z, s.polygon)) best = Math.max(best, s.topAt(x, z));
    return best;
  }
  /** Branche les planchers sur un monde : world.heightAt devient « sol ou plancher », world.groundAt reste le sol. */
  function install(world) {
    if (world.groundAt) return;
    host = world;
    const ground = world.heightAt;
    world.groundAt = ground;
    world.heightAt = (x, z) => {
      const g = ground(x, z), t = topAt(x, z);
      return t > g ? t : g;
    };
    world.onDeck = (x, z) => topAt(x, z) > -Infinity;
    if (world.addSurface) for (const s of list) world.addSurface(s);
  }
  const ground = (world, x, z) => (world.groundAt || world.heightAt)(x, z);

  /** Pilotis sous un point du plancher (jusqu'au sol ou au fond de l'eau). */
  function post(world, g, lx, lz, y, wx, wz, r = 0.09) {
    const base = ground(world, wx, wz) - 0.25;
    const h = y - 0.1 - base;
    if (h > 0.2) MF.cyl(r, r * 1.15, h, BEAM, { x: lx, y: -0.1 - h / 2, z: lz, parent: g, seg: 6, cast: true });
  }
  /** Garde-corps le long d'un segment local (x0, z0) → (x1, z1), au-dessus du plancher. */
  function rail(g, x0, z0, x1, z1, y = 0) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    if (len < 0.4) return;
    const n = Math.max(1, Math.round(len / 1.9));
    const a = Math.atan2(x1 - x0, z1 - z0);
    for (let i = 0; i <= n; i++) MF.box(0.09, 1.02, 0.09, BEAM, { x: x0 + ((x1 - x0) * i) / n, y: y + 0.51, z: z0 + ((z1 - z0) * i) / n, parent: g, cast: true });
    MF.box(0.07, 0.07, len + 0.1, WOOD2, { x: (x0 + x1) / 2, y: y + 1.0, z: (z0 + z1) / 2, ry: a, parent: g });
    MF.box(0.035, 0.035, len, "#e9dcc0", { x: (x0 + x1) / 2, y: y + 0.55, z: (z0 + z1) / 2, ry: a, parent: g });
  }

  /**
   * Plancher rectangulaire. (x, z) : centre ; w : largeur (en travers du cap) ; l : longueur (le long
   * du cap) ; y : hauteur du dessus ; rails : côtés fermés par un garde-corps parmi "l" (gauche),
   * "r" (droite), "f" (avant, vers le cap), "b" (arrière) ; posts: false pour un plancher posé au sol.
   */
  function rect(world, parent, o) {
    const h = o.heading || 0, c = Math.cos(h), s = Math.sin(h);
    const W = (lx, lz) => [o.x + c * lx + s * lz, o.z - s * lx + c * lz]; // local → monde (rotation.y = h)
    const w2 = o.w / 2, l2 = o.l / 2;
    const surface = register({ name: o.name || "Plancher", polygon: [W(-w2, -l2), W(w2, -l2), W(w2, l2), W(-w2, l2)], topAt: () => o.y });
    const g = MF.group({ name: "Plancher_" + (o.name || ""), x: o.x, y: o.y, z: o.z, ry: h, parent });
    // planches en travers, deux teintes
    const n = Math.max(1, Math.round(o.l / 0.42)), pw = o.l / n;
    for (let i = 0; i < n; i++) MF.box(o.w, 0.07, pw - 0.03, i % 2 ? WOOD : WOOD2, { y: -0.035, z: -l2 + pw * (i + 0.5), parent: g });
    // longerons et pilotis
    const rows = Math.max(2, Math.round(o.w / 2.6) + 1);
    for (let r = 0; r < rows; r++) {
      const lx = -w2 + 0.15 + ((o.w - 0.3) * r) / (rows - 1);
      MF.box(0.12, 0.16, o.l, BEAM, { x: lx, y: -0.15, parent: g });
      if (o.posts === false) continue;
      const m = Math.max(1, Math.round(o.l / 3));
      for (let i = 0; i <= m; i++) {
        const lz = -l2 + 0.2 + ((o.l - 0.4) * i) / m;
        post(world, g, lx, lz, o.y, ...W(lx, lz));
      }
    }
    const rails = o.rails || "";
    if (rails.includes("l")) rail(g, w2 - 0.06, -l2, w2 - 0.06, l2);
    if (rails.includes("r")) rail(g, -w2 + 0.06, -l2, -w2 + 0.06, l2);
    if (rails.includes("f")) rail(g, -w2, l2 - 0.06, w2, l2 - 0.06);
    if (rails.includes("b")) rail(g, -w2, -l2 + 0.06, w2, -l2 + 0.06);
    g.userData.surface = surface;
    return g;
  }

  /**
   * Gradin en arc de cercle : centre (cx, cz), rayons r0 < r1, angles a0 → a1 (cap : 0 = vers +z),
   * dessus à la hauteur y. Sert aux terrasses de l'espace de travail.
   */
  function ring(world, parent, o) {
    const THREE = T();
    const steps = Math.max(2, Math.ceil(Math.abs(o.a1 - o.a0) / 0.14));
    const at = (r, a) => [o.cx + Math.sin(a) * r, o.cz + Math.cos(a) * r];
    const poly = [];
    for (let i = 0; i <= steps; i++) poly.push(at(o.r1, o.a0 + ((o.a1 - o.a0) * i) / steps));
    for (let i = steps; i >= 0; i--) poly.push(at(o.r0, o.a0 + ((o.a1 - o.a0) * i) / steps));
    const surface = register({ name: o.name || "Gradin", polygon: poly, topAt: () => o.y });
    const g = MF.group({ name: "Gradin_" + (o.name || ""), y: o.y, parent });
    const shape = new THREE.Shape(poly.map((p) => new THREE.Vector2(p[0], p[1])));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: o.thick || 0.14, bevelEnabled: false, curveSegments: 4 });
    geo.rotateX(Math.PI / 2); // y de la forme → z du monde ; l'épaisseur descend sous le dessus
    MF.mesh(geo, o.color || WOOD, { parent: g, cast: true });
    // nez de marche plus sombre, côté intérieur (vers l'étang), et pilotis côté extérieur
    for (let i = 0; i < steps; i++) {
      const a = o.a0 + ((o.a1 - o.a0) * (i + 0.5)) / steps, len = (Math.abs(o.a1 - o.a0) / steps) * o.r0 + 0.04;
      const [x, z] = at(o.r0 + 0.04, a);
      MF.box(len, 0.2, 0.08, BEAM, { x, y: -0.1, z, ry: a, parent: g });
      if (o.posts !== false && i % 2 === 0) {
        for (const r of [o.r0 + 0.3, o.r1 - 0.3]) {
          const [px, pz] = at(r, a);
          post(world, g, px, pz, o.y, px, pz);
        }
      }
    }
    g.userData.surface = surface;
    return g;
  }

  /**
   * Escalier (ou rampe) droit entre deux points [x, z, y]. width : largeur ; rails: true pour deux
   * garde-corps ; steps: false pour une rampe lisse.
   */
  function stairs(world, parent, o) {
    const [x0, z0, y0] = o.from, [x1, z1, y1] = o.to;
    const len = Math.hypot(x1 - x0, z1 - z0), h = Math.atan2(x1 - x0, z1 - z0);
    const c = Math.cos(h), s = Math.sin(h), w2 = (o.width || 2) / 2;
    const W = (lx, lz) => [x0 + c * lx + s * lz, z0 - s * lx + c * lz];
    const ux = (x1 - x0) / len, uz = (z1 - z0) / len;
    const surface = register({
      name: o.name || "Escalier",
      polygon: [W(-w2, -0.3), W(w2, -0.3), W(w2, len + 0.3), W(-w2, len + 0.3)],
      topAt: (x, z) => y0 + (y1 - y0) * MF.clamp(((x - x0) * ux + (z - z0) * uz) / len, 0, 1),
    });
    const g = MF.group({ name: "Escalier_" + (o.name || ""), x: x0, y: y0, z: z0, ry: h, parent });
    const rise = y1 - y0;
    const n = o.steps === false ? 1 : Math.max(1, Math.round(Math.abs(rise) / 0.2));
    const run = len / n;
    for (let i = 0; i < n; i++) {
      const y = (rise * (i + 1)) / n;
      MF.box(w2 * 2, 0.07, run + 0.04, i % 2 ? WOOD : WOOD2, { y: y - 0.035, z: run * (i + 0.5), parent: g, cast: true });
      MF.box(w2 * 2 - 0.1, Math.abs(rise) / n, 0.04, BEAM, { y: y - Math.abs(rise) / n / 2 - 0.05, z: run * i + 0.03, parent: g });
      if (i % 3 === 0) for (const side of [-1, 1]) post(world, g, side * (w2 - 0.12), run * (i + 0.5), y0 + y, ...W(side * (w2 - 0.12), run * (i + 0.5)));
    }
    if (o.rails !== false) {
      const slope = Math.atan2(rise, len), rl = Math.hypot(len, rise);
      for (const side of [-1, 1]) {
        const k = Math.max(1, Math.round(len / 2));
        for (let i = 0; i <= k; i++) MF.box(0.08, 1.05, 0.08, BEAM, { x: side * (w2 - 0.05), y: (rise * i) / k + 0.52, z: (len * i) / k, parent: g, cast: true });
        MF.box(0.07, 0.07, rl, WOOD2, { x: side * (w2 - 0.05), y: rise / 2 + 1.02, z: len / 2, rx: -slope, parent: g });
      }
    }
    g.userData.surface = surface;
    return g;
  }

  MF.decks = { list, install, register, topAt, rect, ring, stairs, rail, WOOD, WOOD2, BEAM };
})();
