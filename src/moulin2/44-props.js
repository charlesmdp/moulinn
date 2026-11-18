// La Fête du Moulin — accessoires de foire en 3D (volumes simples, aucune image).
//
// Tout est construit « avant vers +z » et posé au sol en y = 0 ; on place ensuite le groupe avec
// position et rotation.y. Les couleurs passent par MF.mat (mises en commun, fusionnées par MF.freeze).
//
//   MF.props.stall({ w, d, h, colors, title })   baraque foraine : toit rayé, comptoir, fronton
//   MF.props.lights(a, b, { n, sag })            guirlande d'ampoules entre deux points
//   MF.props.pouf(color)  .picnic()  .bench()  .cart(kind)  .lamp()  .signpost(lines)  .bale()
//   MF.props.crate()  .barrel()  .flag(color)  .trophy()  .plush(color)  .fence(len)  .bin()
//   MF.props.confetti(parent) → { burst(x, y, z, n), update(dt) }   confettis réutilisables
(function () {
  "use strict";
  const MF = (globalThis.MoulinFete = globalThis.MoulinFete || {});
  const T = () => globalThis.THREE;
  const P = () => MF.PAL;
  const BULBS = ["#ffd54a", "#ff6b6b", "#5ad1ff", "#7dff8a", "#ff9bf0"];

  /**
   * Baraque foraine. w : largeur (x), d : profondeur (z), h : hauteur sous toit. Le comptoir est à
   * l'avant (z = d/2, côté du public), le fond à l'arrière (z = −d/2).
   * options : colors [a, b] (rayures), title (fronton), counter: false, back: false (fond ouvert),
   * sides: false, roof: false, floor: false, skirt (hauteur de jupe sous le plancher, sur une pente).
   */
  function stall(o = {}) {
    const w = o.w || 5, d = o.d || 3.6, h = o.h || 2.7;
    const [ca, cb] = o.colors || [P().red, P().white];
    const g = MF.group({ name: "Baraque" });
    if (o.floor !== false) {
      MF.box(w + 0.3, 0.12, d + 0.3, P().wood, { y: 0.06, parent: g });
      if (o.skirt) MF.box(w + 0.3, o.skirt, d + 0.3, P().woodDark, { y: -o.skirt / 2, parent: g });
    }
    // quatre poteaux
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) MF.box(0.14, h, 0.14, P().white, { x: (sx * w) / 2, y: h / 2 + 0.12, z: (sz * d) / 2, parent: g, cast: true });
    // toit à deux pans, rayé (bandes le long de x)
    if (o.roof !== false) {
      const n = Math.max(4, Math.round(w / 0.62)), bw = (w + 0.7) / n, rise = 0.55, half = d / 2 + 0.45;
      const len = Math.hypot(half, rise), tilt = Math.atan2(rise, half);
      for (let i = 0; i < n; i++)
        for (const side of [-1, 1])
          MF.box(bw - 0.01, 0.05, len, i % 2 ? cb : ca, { x: -(w + 0.7) / 2 + bw * (i + 0.5), y: h + 0.12 + rise / 2, z: (side * half) / 2, rx: side * tilt, parent: g, cast: true });
      // lambrequin (festons) à l'avant et à l'arrière
      for (let i = 0; i < n; i++)
        for (const side of [-1, 1]) MF.cone(bw * 0.52, 0.34, i % 2 ? ca : cb, { x: -(w + 0.7) / 2 + bw * (i + 0.5), y: h + 0.0, z: side * (half + 0.0), rx: Math.PI, parent: g, seg: 4 });
      MF.box(w + 0.7, 0.08, 0.08, P().woodDark, { y: h + 0.12 + rise, parent: g });
    }
    if (o.back !== false) MF.box(w, h - 0.1, 0.08, o.backColor || cb, { y: h / 2 + 0.12, z: -d / 2, parent: g, cast: true });
    if (o.sides !== false) for (const sx of [-1, 1]) MF.box(0.08, h - 0.1, d * 0.62, ca, { x: (sx * w) / 2, y: h / 2 + 0.12, z: -d * 0.19, parent: g, cast: true });
    if (o.counter !== false) {
      const n = Math.max(3, Math.round(w / 0.5)), bw = w / n;
      for (let i = 0; i < n; i++) MF.box(bw - 0.01, 0.95, 0.12, i % 2 ? cb : ca, { x: -w / 2 + bw * (i + 0.5), y: 0.6, z: d / 2, parent: g, cast: true });
      MF.box(w + 0.2, 0.06, 0.42, P().woodDark, { y: 1.1, z: d / 2, parent: g });
    }
    if (o.title) {
      const sign = MF.sign(o.title, { w: Math.min(w + 0.4, Math.max(2.4, o.title.length * 0.32)), h: 0.62, bg: o.titleBg || P().red, color: "#ffffff", border: P().yellow });
      sign.position.set(0, h + 1.05, d / 2 + 0.5);
      g.add(sign);
      for (const sx of [-1, 1]) MF.box(0.07, 0.6, 0.07, P().woodDark, { x: sx * Math.min(w / 2, 1.4), y: h + 0.62, z: d / 2 + 0.47, parent: g });
    }
    return g;
  }

  /** Guirlande d'ampoules de couleur entre deux points { x, y, z }. */
  function lights(a, b, o = {}) {
    const THREE = T();
    const g = MF.group({ name: "Guirlande_lumineuse" });
    const n = o.n || Math.max(4, Math.round(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) / 0.7));
    const sag = o.sag ?? 0.5;
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      pts.push(new THREE.Vector3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t - Math.sin(Math.PI * t) * sag, a.z + (b.z - a.z) * t));
    }
    MF.mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n * 2, 0.012, 4, false), "#2a2a2e", { parent: g });
    for (let i = 1; i < n; i++) {
      const c = o.color || BULBS[i % BULBS.length];
      MF.sphere(o.size || 0.07, MF.mat(c, { emissive: c, emissiveIntensity: 0.85 }), { x: pts[i].x, y: pts[i].y - 0.07, z: pts[i].z, parent: g, seg: 6 });
    }
    return g;
  }

  /** Pouf (gros coussin) : assise à 0,42 m. */
  function pouf(color) {
    const g = MF.group({ name: "Pouf" });
    const body = MF.sphere(0.5, color || P().orange, { y: 0.26, parent: g, seg: 12, cast: true });
    body.scale.set(1.05, 0.56, 1.05);
    const back = MF.sphere(0.4, color || P().orange, { y: 0.5, z: -0.3, parent: g, seg: 10, cast: true });
    back.scale.set(1.0, 0.72, 0.5);
    return g;
  }
  /** Table de pique-nique avec ses deux bancs. */
  function picnic() {
    const g = MF.group({ name: "Table_de_pique_nique" });
    for (let i = 0; i < 4; i++) MF.box(1.9, 0.045, 0.19, i % 2 ? "#b98350" : "#a8733f", { y: 0.76, z: -0.3 + i * 0.2, parent: g, cast: true });
    for (const s of [-1, 1]) {
      MF.box(1.9, 0.045, 0.26, "#a8733f", { y: 0.45, z: s * 0.68, parent: g, cast: true });
      for (const e of [-1, 1]) {
        MF.box(0.07, 0.86, 0.07, "#7a5028", { x: e * 0.75, y: 0.38, z: s * 0.34, rx: s * 0.5, parent: g });
        MF.box(0.07, 0.07, 1.5, "#7a5028", { x: e * 0.75, y: 0.41, parent: g });
      }
    }
    return g;
  }
  /** Banc de jardin. */
  function bench() {
    const g = MF.group({ name: "Banc" });
    for (let i = 0; i < 3; i++) MF.box(1.6, 0.04, 0.13, "#a8733f", { y: 0.45, z: -0.14 + i * 0.14, parent: g, cast: true });
    for (let i = 0; i < 2; i++) MF.box(1.6, 0.11, 0.035, "#a8733f", { y: 0.66 + i * 0.16, z: -0.24, rx: -0.12, parent: g });
    for (const e of [-1, 1]) {
      MF.box(0.07, 0.45, 0.4, "#33363f", { x: e * 0.7, y: 0.225, parent: g });
      MF.box(0.07, 0.5, 0.05, "#33363f", { x: e * 0.7, y: 0.66, z: -0.24, rx: -0.12, parent: g });
    }
    return g;
  }
  /** Charrette à friandises : "popcorn", "candy" (barbe à papa), "lemonade", "hotdog". */
  function cart(kind = "popcorn") {
    const g = MF.group({ name: "Charrette_" + kind });
    const main = { popcorn: P().red, candy: P().pink, lemonade: P().yellow, hotdog: P().orange }[kind] || P().red;
    MF.box(1.5, 0.75, 0.85, main, { y: 0.85, parent: g, cast: true });
    MF.box(1.56, 0.06, 0.91, P().white, { y: 1.25, parent: g });
    for (const s of [-1, 1]) {
      const wheel = MF.cyl(0.36, 0.36, 0.07, P().woodDark, { x: -0.3, y: 0.36, z: s * 0.47, rx: Math.PI / 2, parent: g, seg: 14, cast: true });
      wheel.userData.noop = true;
      MF.cyl(0.07, 0.07, 0.09, P().yellow, { x: -0.3, y: 0.36, z: s * 0.47, rx: Math.PI / 2, parent: g, seg: 8 });
      MF.box(0.05, 0.05, 0.9, P().woodDark, { x: 1.0, y: 0.95, z: s * 0.3, ry: 0, parent: g });
    }
    MF.box(0.06, 0.5, 0.06, P().woodDark, { x: 0.55, y: 0.25, parent: g });
    // auvent rayé sur quatre montants
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) MF.box(0.04, 1.0, 0.04, P().white, { x: sx * 0.7, y: 1.75, z: sz * 0.38, parent: g });
    for (let i = 0; i < 6; i++) MF.box(0.28, 0.05, 1.05, i % 2 ? P().white : main, { x: -0.7 + 0.28 * (i + 0.5) - 0.07, y: 2.28, parent: g, cast: true });
    if (kind === "popcorn") {
      MF.box(0.7, 0.55, 0.6, MF.mat("#cfeaff", { opacity: 0.45 }), { x: -0.25, y: 1.56, parent: g });
      for (let i = 0; i < 16; i++) MF.sphere(0.06, "#fff6c8", { x: -0.5 + (i % 4) * 0.16, y: 1.32 + Math.floor(i / 8) * 0.08, z: -0.2 + ((i >> 2) % 2) * 0.3, parent: g, seg: 5 });
    } else if (kind === "candy") {
      for (let i = 0; i < 3; i++) {
        MF.cyl(0.012, 0.012, 0.5, P().white, { x: -0.45 + i * 0.4, y: 1.5, parent: g, seg: 5 });
        MF.sphere(0.17, [P().pink, "#9ad8ff", "#ffe08a"][i], { x: -0.45 + i * 0.4, y: 1.8, parent: g, seg: 8 });
      }
    } else if (kind === "lemonade") {
      MF.cyl(0.22, 0.22, 0.45, MF.mat("#fff29a", { opacity: 0.7 }), { x: -0.3, y: 1.5, parent: g, seg: 12 });
      for (let i = 0; i < 4; i++) MF.cyl(0.05, 0.04, 0.12, P().white, { x: 0.15 + (i % 2) * 0.14, y: 1.34, z: -0.1 + Math.floor(i / 2) * 0.2, parent: g, seg: 8 });
    } else {
      for (let i = 0; i < 3; i++) {
        MF.cyl(0.05, 0.05, 0.3, "#e9c88a", { x: -0.4 + i * 0.3, y: 1.33, rz: Math.PI / 2, ry: 0.3, parent: g, seg: 8 });
        MF.cyl(0.035, 0.035, 0.34, "#b5452c", { x: -0.4 + i * 0.3, y: 1.36, rz: Math.PI / 2, ry: 0.3, parent: g, seg: 6 });
      }
    }
    return g;
  }
  /** Lampadaire de fête : mât et globe lumineux. */
  function lamp(h = 3.4) {
    const g = MF.group({ name: "Lampadaire" });
    MF.cyl(0.05, 0.07, h, "#2f3a34", { y: h / 2, parent: g, seg: 8, cast: true });
    MF.cyl(0.16, 0.2, 0.12, "#2f3a34", { y: 0.06, parent: g, seg: 8 });
    MF.sphere(0.2, MF.mat("#fff2b0", { emissive: "#ffe28a", emissiveIntensity: 0.9 }), { y: h + 0.16, parent: g, seg: 10 });
    MF.cone(0.24, 0.14, "#2f3a34", { y: h + 0.4, parent: g, seg: 8 });
    return g;
  }
  /** Poteau indicateur : lines = [{ text, color, dir (cap de la flèche) }]. */
  function signpost(lines) {
    const g = MF.group({ name: "Poteau_indicateur" });
    MF.cyl(0.06, 0.07, 3.0, P().woodDark, { y: 1.5, parent: g, seg: 8, cast: true });
    MF.sphere(0.11, P().yellow, { y: 3.06, parent: g, seg: 8 });
    lines.forEach((l, i) => {
      const w = Math.max(1.3, l.text.length * 0.14 + 0.4);
      const plank = MF.group({ y: 2.7 - i * 0.42, ry: l.dir || 0, parent: g });
      const sign = MF.sign(l.text, { w, h: 0.34, bg: l.color || P().cream, color: l.color ? "#ffffff" : P().ink, border: P().ink, double: true });
      sign.rotation.y = Math.PI / 2; // le panneau est une planche qui pointe vers +z
      sign.position.z = w / 2 + 0.05;
      plank.add(sign);
      MF.cone(0.2, 0.26, l.color || P().cream, { z: w + 0.16, rx: Math.PI / 2, parent: plank, seg: 3 });
    });
    return g;
  }
  /** Botte de paille. */
  const bale = () => {
    const g = MF.group({ name: "Botte_de_paille" });
    MF.box(1.1, 0.5, 0.55, "#e2b84a", { y: 0.25, parent: g, cast: true });
    for (const x of [-0.3, 0.3]) MF.box(0.03, 0.52, 0.57, "#a9792a", { x, y: 0.25, parent: g });
    return g;
  };
  const crate = (s = 0.6, color = "#b98350") => {
    const g = MF.group({ name: "Caisse" });
    MF.box(s, s, s, color, { y: s / 2, parent: g, cast: true });
    for (const y of [0.12, 0.88]) MF.box(s + 0.03, s * 0.1, s + 0.03, "#7a5028", { y: s * y, parent: g });
    return g;
  };
  const barrel = (color = "#8a5a2c") => {
    const g = MF.group({ name: "Tonneau" });
    MF.cyl(0.3, 0.3, 0.85, color, { y: 0.425, parent: g, seg: 12, cast: true });
    for (const y of [0.15, 0.7]) MF.cyl(0.315, 0.315, 0.05, "#33363f", { y, parent: g, seg: 12 });
    return g;
  };
  /** Drapeau triangulaire sur un mât. */
  const flag = (color, h = 4) => {
    const THREE = T();
    const g = MF.group({ name: "Drapeau" });
    MF.cyl(0.035, 0.045, h, P().white, { y: h / 2, parent: g, seg: 6, cast: true });
    const shape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0.95, 0.22), new THREE.Vector2(0, 0.44)]);
    MF.mesh(new THREE.ShapeGeometry(shape), MF.mat(color || P().red, { side: "double" }), { x: 0.04, y: h - 0.5, parent: g });
    MF.sphere(0.07, P().yellow, { y: h + 0.04, parent: g, seg: 6 });
    return g;
  };
  /** Coupe dorée. */
  const trophy = (s = 1) => {
    const g = MF.group({ name: "Coupe" });
    const gold = MF.mat("#ffcf3a", { emissive: "#b98a10", emissiveIntensity: 0.35 });
    MF.cyl(0.11 * s, 0.14 * s, 0.07 * s, P().woodDark, { y: 0.035 * s, parent: g, seg: 10 });
    MF.cyl(0.03 * s, 0.05 * s, 0.14 * s, gold, { y: 0.14 * s, parent: g, seg: 8 });
    MF.cyl(0.15 * s, 0.06 * s, 0.2 * s, gold, { y: 0.31 * s, parent: g, seg: 12, cast: true });
    for (const side of [-1, 1]) MF.torus(0.06 * s, 0.014 * s, gold, { x: side * 0.16 * s, y: 0.32 * s, parent: g, seg: 10, tubeSeg: 5 });
    return g;
  };
  /** Peluche à gagner (ourson) : lots suspendus dans les baraques. */
  const plush = (color, s = 1) => {
    const g = MF.group({ name: "Peluche" });
    MF.sphere(0.16 * s, color, { y: 0.16 * s, parent: g, seg: 8 }).scale.set(1, 1.1, 0.9);
    MF.sphere(0.12 * s, color, { y: 0.4 * s, parent: g, seg: 8 });
    for (const side of [-1, 1]) {
      MF.sphere(0.05 * s, color, { x: side * 0.09 * s, y: 0.5 * s, parent: g, seg: 6 });
      MF.sphere(0.06 * s, color, { x: side * 0.17 * s, y: 0.22 * s, parent: g, seg: 6 });
      MF.sphere(0.018 * s, P().black, { x: side * 0.045 * s, y: 0.43 * s, z: 0.105 * s, parent: g, seg: 5 });
    }
    MF.sphere(0.045 * s, "#fff3d6", { y: 0.38 * s, z: 0.1 * s, parent: g, seg: 6 });
    return g;
  };
  /** Barrière basse en bois, le long de x. */
  const fence = (len, color) => {
    const g = MF.group({ name: "Barriere" });
    const n = Math.max(1, Math.round(len / 1.6));
    for (let i = 0; i <= n; i++) MF.box(0.08, 0.95, 0.08, color || P().white, { x: -len / 2 + (len * i) / n, y: 0.47, parent: g, cast: true });
    for (const y of [0.4, 0.82]) MF.box(len, 0.07, 0.04, color || P().white, { y, parent: g });
    return g;
  };
  const bin = () => {
    const g = MF.group({ name: "Poubelle" });
    MF.cyl(0.24, 0.2, 0.7, P().green, { y: 0.35, parent: g, seg: 10, cast: true });
    MF.cyl(0.26, 0.26, 0.05, P().black, { y: 0.72, parent: g, seg: 10 });
    return g;
  };

  /** Confettis réutilisables (petits carrés de couleur qui retombent). */
  function confetti(parent, count = 60) {
    const THREE = T();
    const colors = [P().red, P().yellow, P().blue, P().green, P().pink, P().purple, P().orange, P().white];
    const geo = new THREE.PlaneGeometry(0.09, 0.06);
    const parts = [];
    const g = MF.group({ name: "Confettis", parent });
    g.userData.live = true;
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(geo, MF.mat(colors[i % colors.length], { side: "double", basic: true }));
      m.visible = false;
      g.add(m);
      parts.push({ m, life: 0, vx: 0, vy: 0, vz: 0, spin: 0 });
    }
    let next = 0, alive = 0;
    return {
      group: g,
      burst(x, y, z, n = 24, power = 1) {
        for (let i = 0; i < n; i++) {
          const p = parts[next++ % parts.length];
          const a = Math.random() * Math.PI * 2, r = (0.6 + Math.random() * 2.2) * power;
          p.m.position.set(x, y, z);
          p.m.visible = true;
          p.life = 1.1 + Math.random() * 0.9;
          p.vx = Math.cos(a) * r;
          p.vz = Math.sin(a) * r;
          p.vy = (2.5 + Math.random() * 3) * power;
          p.spin = (Math.random() - 0.5) * 14;
        }
        alive = Math.max(alive, 2.2);
      },
      /** Renvoie vrai tant que des confettis volent. */
      update(dt) {
        if (alive <= 0) return false;
        alive -= dt;
        for (const p of parts) {
          if (p.life <= 0) continue;
          p.life -= dt;
          p.vy -= 7.5 * dt;
          p.vx *= 1 - 1.2 * dt;
          p.vz *= 1 - 1.2 * dt;
          p.m.position.x += p.vx * dt;
          p.m.position.y += p.vy * dt;
          p.m.position.z += p.vz * dt;
          p.m.rotation.x += p.spin * dt;
          p.m.rotation.z += p.spin * 0.7 * dt;
          if (p.life <= 0) p.m.visible = false;
        }
        return true;
      },
    };
  }

  MF.props = { stall, lights, pouf, picnic, bench, cart, lamp, signpost, bale, crate, barrel, flag, trophy, plush, fence, bin, confetti, BULBS };
})();
