// La Fête du Moulin — boîte à outils commune (MoulinFete, abrégé MF dans les autres fichiers).
//
//   Maths      MF.clamp, lerp, damp(cur, cible, vitesse, dt), angleDiff(a, b), dampAngle, smooth, rng(graine), hash(texte)
//   Lignes     MF.path(points, { closed, step }) → { pts, length, at(s), nearest(x, z) } ; MF.pointInPoly(x, z, poly)
//   Couleurs   MF.PAL (palette de la fête), MF.color(hex) (couleur linéaire), MF.mat(hex, options) (matériau mis en cache)
//   Formes     MF.box, cyl, cone, sphere, plane, torus (maillage posé, tourné, nommé d'un seul appel), MF.group
//   Textes     MF.canvasTexture(w, h, dessin), MF.sign(texte, options) (panneau), MF.tag(texte, options) (étiquette flottante)
//   Décor      MF.blob(rayon) (ombre ronde au sol), MF.bunting(a, b, options) (guirlande de fanions), MF.balloon(couleur)
//   Sons       MF.sfx.play(nom) (bip, top, pop, choc, plouf, bravo, clic, moteur…), MF.sfx.muted
//   Ménage     MF.dispose(objet)
//
// Tout est écrit pour three.js r128 (celui du moulin) : couleurs converties en linéaire à la main,
// textures de canvas en sRGB, aucune ombre portée par les objets qui bougent (ombre ronde à la place :
// les ombres du moulin ne sont recalculées qu'à la demande).
(function () {
  "use strict";
  const MF = (globalThis.MoulinFete = globalThis.MoulinFete || {});
  const T = () => globalThis.THREE;

  /* ------------------------------------------------------------------ maths */
  MF.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  MF.lerp = (a, b, t) => a + (b - a) * t;
  MF.damp = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
  MF.angleDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
  MF.dampAngle = (cur, target, rate, dt) => cur + MF.angleDiff(cur, target) * (1 - Math.exp(-rate * dt));
  MF.smooth = (a, b, x) => {
    const t = MF.clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  /** Générateur pseudo-aléatoire reproductible (mulberry32) : même graine, même suite chez tous les joueurs. */
  MF.rng = function (seed) {
    let a = seed >>> 0 || 1;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  MF.hash = function (text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
    return h >>> 0;
  };
  MF.uid = function (n = 10) {
    const abc = "abcdefghijkmnpqrstuvwxyz23456789";
    let out = "";
    const bytes = new Uint8Array(n);
    (globalThis.crypto || { getRandomValues: (b) => b.forEach((_, i) => (b[i] = Math.random() * 256)) }).getRandomValues(bytes);
    for (let i = 0; i < n; i++) out += abc[bytes[i] % abc.length];
    return out;
  };
  /** Durée lisible : 83,456 s → « 1:23.46 ». */
  /** Rang en anglais : 1st, 2nd, 3rd, 4th… */
  MF.ordinal = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th");
  MF.time = function (seconds, digits = 2) {
    if (!(seconds >= 0) || !isFinite(seconds)) return "–";
    const m = Math.floor(seconds / 60);
    const s = seconds - m * 60;
    return m + ":" + (s < 10 ? "0" : "") + s.toFixed(digits);
  };

  /* ------------------------------------------------------------------ lignes et polygones */
  /**
   * Distance d'un point à un rectangle tourné { cx, cz, angle, u0, u1, v0, v1 } (bâtiments, murets du
   * moulin : world.solids). Négative à l'intérieur.
   */
  MF.rectDistance = function (x, z, r) {
    const dx = x - r.cx, dz = z - r.cz, c = Math.cos(r.angle || 0), s = Math.sin(r.angle || 0);
    const u = dx * c - dz * s, v = dx * s + dz * c;
    const du = Math.max(r.u0 - u, u - r.u1), dv = Math.max(r.v0 - v, v - r.v1);
    return Math.hypot(Math.max(0, du), Math.max(0, dv)) + Math.min(0, Math.max(du, dv));
  };
  MF.pointInPoly = function (x, z, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j];
      if (a[1] > z !== b[1] > z && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
  };
  /**
   * Ligne lissée (Catmull-Rom centripète simplifiée) passant par des points [x, z] ou [x, z, largeur].
   * Renvoie des points réguliers { x, z, s (abscisse), w (largeur), tx, tz (tangente) } et des outils :
   *   at(s) → { x, z, tx, tz, w } ; nearest(x, z, autourDe?, localSeulement?) → { s, d (distance signée, + à droite), i, x, z, tx, tz, w }
   *   (autourDe : abscisse attendue, pour suivre une progression le long d'un circuit sans sauter d'un bord à l'autre)
   */
  MF.path = function (points, options = {}) {
    const closed = !!options.closed;
    const step = options.step || 1;
    const n = points.length;
    const P = (i) => points[closed ? ((i % n) + n) % n : MF.clamp(i, 0, n - 1)];
    const raw = [];
    const segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
      const sub = Math.max(2, Math.ceil(len / (step * 0.5)));
      for (let k = 0; k < sub; k++) {
        const t = k / sub, t2 = t * t, t3 = t2 * t;
        const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        raw.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1]), MF.lerp(p1[2] || 0, p2[2] || p1[2] || 0, t)]);
      }
    }
    if (!closed) raw.push([P(n - 1)[0], P(n - 1)[1], P(n - 1)[2] || 0]);
    // rééchantillonnage à pas constant
    const cum = [0];
    for (let i = 1; i < raw.length; i++) cum.push(cum[i - 1] + Math.hypot(raw[i][0] - raw[i - 1][0], raw[i][1] - raw[i - 1][1]));
    let total = cum[cum.length - 1];
    if (closed) total += Math.hypot(raw[0][0] - raw[raw.length - 1][0], raw[0][1] - raw[raw.length - 1][1]);
    const count = Math.max(4, Math.round(total / step));
    const ds = total / count;
    const pts = [];
    let j = 0;
    for (let i = 0; i < (closed ? count : count + 1); i++) {
      const s = i * ds;
      while (j < raw.length - 1 && cum[j + 1] < s) j++;
      const a = raw[j], b = raw[(j + 1) % raw.length];
      const segLen = (j < raw.length - 1 ? cum[j + 1] - cum[j] : total - cum[j]) || 1e-6;
      const t = MF.clamp((s - cum[j]) / segLen, 0, 1);
      pts.push({ x: MF.lerp(a[0], b[0], t), z: MF.lerp(a[1], b[1], t), w: MF.lerp(a[2], b[2], t), s });
    }
    const m = pts.length;
    for (let i = 0; i < m; i++) {
      const a = pts[closed ? (i - 1 + m) % m : Math.max(0, i - 1)], b = pts[closed ? (i + 1) % m : Math.min(m - 1, i + 1)];
      const l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      pts[i].tx = (b.x - a.x) / l;
      pts[i].tz = (b.z - a.z) / l;
    }
    const out = { pts, length: total, closed, step: ds };
    out.at = function (s) {
      s = closed ? ((s % total) + total) % total : MF.clamp(s, 0, total);
      const f = s / ds, i = Math.floor(f), t = f - i;
      const a = pts[Math.min(i, m - 1)], b = pts[closed ? (i + 1) % m : Math.min(i + 1, m - 1)];
      const tx = MF.lerp(a.tx, b.tx, t), tz = MF.lerp(a.tz, b.tz, t), l = Math.hypot(tx, tz) || 1;
      return { x: MF.lerp(a.x, b.x, t), z: MF.lerp(a.z, b.z, t), tx: tx / l, tz: tz / l, w: MF.lerp(a.w, b.w, t), s };
    };
    out.nearest = function (x, z, hint, localOnly) {
      let best = -1, bd = Infinity;
      const scan = (i0, i1) => {
        for (let k = i0; k <= i1; k++) {
          const i = closed ? ((k % m) + m) % m : MF.clamp(k, 0, m - 1);
          const d = (pts[i].x - x) ** 2 + (pts[i].z - z) ** 2;
          if (d < bd) {
            bd = d;
            best = i;
          }
        }
      };
      if (hint !== undefined && hint >= 0) {
        const h = Math.round(hint / ds);
        scan(h - 12, h + 12);
        // loin de l'endroit attendu : on cherche partout, sauf si l'appelant suit une progression (localOnly)
        if (bd > 36 && !localOnly) scan(0, m - 1);
      } else scan(0, m - 1);
      // affinage sur les deux segments voisins
      let res = null;
      for (const k of [best - 1, best]) {
        if (!closed && (k < 0 || k >= m - 1)) continue;
        const a = pts[((k % m) + m) % m], b = pts[(((k + 1) % m) + m) % m];
        const ex = b.x - a.x, ez = b.z - a.z, l2 = ex * ex + ez * ez || 1e-6;
        const t = MF.clamp(((x - a.x) * ex + (z - a.z) * ez) / l2, 0, 1);
        const px = a.x + ex * t, pz = a.z + ez * t;
        const d = Math.hypot(x - px, z - pz);
        if (!res || d < Math.abs(res.d)) {
          const l = Math.sqrt(l2);
          // normale de droite (pour qui avance le long de la ligne, y vers le haut) : (-tz, tx)
          const side = (x - px) * (-ez / l) + (z - pz) * (ex / l);
          let s = a.s + t * l;
          if (closed) s = ((s % total) + total) % total;
          res = { s, d: side, i: ((k % m) + m) % m, x: px, z: pz, tx: ex / l, tz: ez / l, w: MF.lerp(a.w, b.w, t) };
        }
      }
      return res || { s: pts[best].s, d: Math.sqrt(bd), i: best, x: pts[best].x, z: pts[best].z, tx: pts[best].tx, tz: pts[best].tz, w: pts[best].w };
    };
    return out;
  };

  /* ------------------------------------------------------------------ couleurs et matériaux */
  MF.PAL = {
    red: "#e8402c", orange: "#ff8a2a", yellow: "#ffc93a", green: "#3fae4a", teal: "#1fb5a8", blue: "#2f8fe8", purple: "#9b59d0", pink: "#ff6fa5",
    cream: "#fff3d6", white: "#ffffff", wood: "#a9713c", woodDark: "#6e4520", ink: "#2b1a10", steel: "#8a94a3", black: "#1d1d22", grass: "#58b947",
  };
  /** Couleurs proposées aux joueurs (voitures, bateaux, chapeaux…). */
  MF.PLAYER_COLORS = ["#e8402c", "#2f8fe8", "#ffc93a", "#3fae4a", "#9b59d0", "#ff8a2a", "#1fb5a8", "#ff6fa5"];
  const colorCache = new Map();
  MF.color = function (hex) {
    let c = colorCache.get(hex);
    if (!c) {
      c = new (T().Color)(hex).convertSRGBToLinear();
      colorCache.set(hex, c);
    }
    return c;
  };
  const matCache = new Map();
  /**
   * Matériau mat (Lambert) mis en cache par couleur et options. options : emissive (hex), opacity,
   * side ("double"), map (texture), basic (true : sans éclairage), flat (true : facettes), unique (pas de cache).
   */
  MF.mat = function (hex, options = {}) {
    const THREE = T();
    const key = hex + "|" + (options.emissive || "") + "|" + (options.opacity ?? 1) + "|" + (options.side || "") + "|" + (options.basic ? "b" : "") + (options.flat ? "f" : "") + (options.map ? options.map.uuid : "");
    if (!options.unique && matCache.has(key)) return matCache.get(key);
    const params = { color: MF.color(hex).clone() };
    if (options.map) params.map = options.map;
    if (options.opacity !== undefined && options.opacity < 1) {
      params.transparent = true;
      params.opacity = options.opacity;
      params.depthWrite = false;
    }
    if (options.side === "double") params.side = THREE.DoubleSide;
    if (options.flat && !options.basic) params.flatShading = true;
    const m = options.basic ? new THREE.MeshBasicMaterial(params) : new THREE.MeshLambertMaterial(params);
    if (options.emissive && !options.basic) {
      m.emissive = MF.color(options.emissive).clone();
      m.emissiveIntensity = options.emissiveIntensity ?? 0.5;
    }
    if (!options.unique) matCache.set(key, m);
    else m.userData.unique = true; // repeint en cours de jeu : MF.freeze ne le fond pas dans le décor peint
    return m;
  };

  /* ------------------------------------------------------------------ formes */
  function place(mesh, o = {}) {
    if (o.x !== undefined || o.y !== undefined || o.z !== undefined) mesh.position.set(o.x || 0, o.y || 0, o.z || 0);
    if (o.rx !== undefined || o.ry !== undefined || o.rz !== undefined) mesh.rotation.set(o.rx || 0, o.ry || 0, o.rz || 0);
    if (o.s !== undefined) mesh.scale.setScalar(o.s);
    if (o.name) mesh.name = o.name;
    mesh.castShadow = !!o.cast;
    mesh.receiveShadow = o.receive !== false;
    if (o.parent) o.parent.add(mesh);
    return mesh;
  }
  const asMat = (m) => (typeof m === "string" ? MF.mat(m) : m);
  MF.mesh = (geometry, material, o) => place(new (T().Mesh)(geometry, asMat(material)), o);
  MF.box = (w, h, d, material, o) => MF.mesh(new (T().BoxGeometry)(w, h, d), material, o);
  MF.cyl = (rTop, rBottom, h, material, o = {}) => MF.mesh(new (T().CylinderGeometry)(rTop, rBottom, h, o.seg || 14, 1, !!o.open), material, o);
  MF.cone = (r, h, material, o = {}) => MF.mesh(new (T().ConeGeometry)(r, h, o.seg || 14), material, o);
  MF.sphere = (r, material, o = {}) => MF.mesh(new (T().SphereGeometry)(r, o.seg || 14, Math.max(6, Math.round((o.seg || 14) * 0.7))), material, o);
  MF.plane = (w, h, material, o) => MF.mesh(new (T().PlaneGeometry)(w, h), material, o);
  MF.torus = (r, tube, material, o = {}) => MF.mesh(new (T().TorusGeometry)(r, tube, o.tubeSeg || 8, o.seg || 20), material, o);
  MF.group = function (o = {}, ...children) {
    const g = new (T().Group)();
    place(g, Object.assign({ receive: false }, o));
    for (const c of children) if (c) g.add(c);
    return g;
  };

  /* ------------------------------------------------------------------ textes */
  MF.FONT = '"Lilita One", "Trebuchet MS", "Arial Rounded MT Bold", system-ui, sans-serif';
  MF.canvasTexture = function (w, h, draw) {
    const THREE = T();
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    draw(ctx, w, h);
    const tex = new THREE.CanvasTexture(canvas);
    tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = 4;
    tex.redraw = function (again) {
      ctx.clearRect(0, 0, w, h);
      (again || draw)(ctx, w, h);
      tex.needsUpdate = true;
    };
    return tex;
  };
  /** Écrit un texte centré dans une boîte, à la plus grande taille qui tient (une ou plusieurs lignes). */
  MF.fitText = function (ctx, text, cx, cy, maxW, maxH, o = {}) {
    const lines = String(text).split("\n");
    let size = o.size || maxH / lines.length;
    const weight = o.weight || "400";
    const font = o.font || MF.FONT;
    for (;;) {
      ctx.font = `${weight} ${size}px ${font}`;
      const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
      if ((widest <= maxW && size * lines.length * 1.12 <= maxH) || size <= 6) break;
      size *= 0.93;
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const lh = size * 1.12;
    lines.forEach((line, i) => {
      const y = cy + (i - (lines.length - 1) / 2) * lh;
      if (o.stroke) {
        ctx.lineJoin = "round";
        ctx.lineWidth = o.strokeWidth || size * 0.16;
        ctx.strokeStyle = o.stroke;
        ctx.strokeText(line, cx, y);
      }
      ctx.fillStyle = o.color || "#fff";
      ctx.fillText(line, cx, y);
    });
    return size;
  };
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  MF.roundRect = roundRect;
  /**
   * Panneau plat avec un texte : MF.sign("DÉPART", { w: 2, h: 0.6, bg, color, border, double }) → maillage
   * (une face, vers +z) ou groupe de deux faces dos à dos avec double: true. userData.setText(texte) le change.
   * La texture est redessinée quand la police de la fête a fini de charger.
   */
  MF.sign = function (text, o = {}) {
    const w = o.w || 2, h = o.h || 0.6;
    const pxH = o.px || 256, pxW = Math.round((pxH * w) / h);
    const draw = (ctx, W, H) => {
      const pad = H * 0.06;
      ctx.fillStyle = o.border || MF.PAL.ink;
      roundRect(ctx, 0, 0, W, H, H * 0.16);
      ctx.fill();
      ctx.fillStyle = o.bg || MF.PAL.cream;
      roundRect(ctx, pad, pad, W - pad * 2, H - pad * 2, H * 0.12);
      ctx.fill();
      MF.fitText(ctx, typeof text === "function" ? text() : text, W / 2, H / 2 + H * 0.02, W - pad * 6, H - pad * 5, { color: o.color || MF.PAL.ink, stroke: o.stroke });
    };
    const tex = MF.canvasTexture(pxW, pxH, draw);
    MF.whenFont(() => tex.redraw());
    const mat = new (T().MeshBasicMaterial)({ map: tex, transparent: true });
    const setText = (t) => {
      text = t;
      tex.redraw();
    };
    if (o.double) {
      // lisible des deux côtés : deux faces dos à dos
      const g = MF.group(o);
      MF.plane(w, h, mat, { z: 0.006, receive: false, parent: g });
      MF.plane(w, h, mat, { z: -0.006, ry: Math.PI, receive: false, parent: g });
      g.userData.texture = tex;
      g.userData.setText = setText;
      return g;
    }
    const mesh = MF.plane(w, h, mat, Object.assign({ receive: false }, o));
    mesh.userData.texture = tex;
    mesh.userData.setText = setText;
    return mesh;
  };
  /** Étiquette flottante toujours face à la caméra (nom d'un joueur, score…). */
  MF.tag = function (text, o = {}) {
    const THREE = T();
    const pxH = 96, pxW = 512;
    let current = text, colour = o.color || "#ffffff", bg = o.bg || "rgba(30,20,10,0.72)";
    const draw = (ctx, W, H) => {
      // deux lignes (« nom\nce sur quoi il travaille ») : le nom en haut, le reste plus petit, en jaune
      const [first, second] = String(current).split("\n");
      ctx.font = `400 ${second ? 42 : 54}px ${MF.FONT}`;
      let tw = ctx.measureText(first).width + 44;
      if (second) {
        ctx.font = `400 28px ${MF.FONT}`;
        tw = Math.max(tw, ctx.measureText(second).width + 44);
      }
      tw = Math.min(W - 40, tw);
      ctx.fillStyle = bg;
      roundRect(ctx, (W - tw) / 2, second ? 2 : 10, tw, second ? H - 4 : H - 20, second ? 22 : 30);
      ctx.fill();
      if (second) {
        MF.fitText(ctx, first, W / 2, 31, tw - 30, 44, { color: colour });
        MF.fitText(ctx, second, W / 2, 71, tw - 30, 30, { color: "#ffd54a" });
      } else MF.fitText(ctx, first, W / 2, H / 2 + 3, tw - 30, 60, { color: colour });
    };
    const tex = MF.canvasTexture(pxW, pxH, draw);
    MF.whenFont(() => tex.redraw());
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: o.depthTest !== false, depthWrite: false }));
    const s = o.scale || 1;
    sprite.scale.set(2.6 * s, 0.49 * s, 1);
    sprite.renderOrder = 5;
    sprite.userData.set = (t, c) => {
      if (t === current && (!c || c === colour)) return;
      current = t;
      if (c) colour = c;
      tex.redraw();
    };
    return sprite;
  };
  // Police de la fête : les textures dessinées avant son chargement sont refaites une fois.
  const fontWaiters = [];
  let fontState = 0;
  MF.whenFont = function (fn) {
    if (fontState === 2) return;
    fontWaiters.push(fn);
    if (fontState === 0 && typeof document !== "undefined" && document.fonts && document.fonts.load) {
      fontState = 1;
      const done = () => {
        if (fontState === 2) return;
        fontState = 2;
        fontWaiters.splice(0).forEach((f) => {
          try {
            f();
          } catch (e) {}
        });
      };
      document.fonts.load('400 40px "Lilita One"').then(done, done);
      setTimeout(done, 4000);
    }
  };

  /* ------------------------------------------------------------------ décor */
  let blobTex = null;
  /** Ombre ronde et douce à poser au sol sous un objet qui bouge. */
  MF.blob = function (radius = 0.5, opacity = 0.42) {
    const THREE = T();
    if (!blobTex)
      blobTex = MF.canvasTexture(64, 64, (ctx) => {
        const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 31);
        g.addColorStop(0, "rgba(0,0,0,1)");
        g.addColorStop(0.55, "rgba(0,0,0,0.55)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 64, 64);
      });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    m.rotation.x = -Math.PI / 2;
    m.renderOrder = 2;
    m.name = "Ombre_ronde";
    return m;
  };
  /**
   * Guirlande de fanions entre deux points hauts a et b ({x, y, z}) : corde qui pend et triangles
   * de couleurs. options : sag (flèche, m), size (taille d'un fanion), colors.
   */
  MF.bunting = function (a, b, o = {}) {
    const THREE = T();
    const g = new THREE.Group();
    g.name = "Guirlande_de_fanions";
    const len = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    const size = o.size || 0.34;
    const n = Math.max(3, Math.floor(len / (size * 1.25)));
    const sag = o.sag ?? Math.min(0.9, len * 0.07);
    const colors = o.colors || [MF.PAL.red, MF.PAL.yellow, MF.PAL.blue, MF.PAL.green, MF.PAL.orange, MF.PAL.purple];
    const dirX = (b.x - a.x) / len, dirZ = (b.z - a.z) / len;
    const pos = [], col = [], rope = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = MF.lerp(a.x, b.x, t), z = MF.lerp(a.z, b.z, t), y = MF.lerp(a.y, b.y, t) - sag * 4 * t * (1 - t);
      rope.push(x, y, z);
      if (i === n) break;
      const t2 = (i + 0.5) / n;
      const mx = MF.lerp(a.x, b.x, t2), mz = MF.lerp(a.z, b.z, t2), my = MF.lerp(a.y, b.y, t2) - sag * 4 * t2 * (1 - t2);
      const hw = (len / n) * 0.42;
      const c = MF.color(colors[i % colors.length]);
      pos.push(mx - dirX * hw, my, mz - dirZ * hw, mx + dirX * hw, my, mz + dirZ * hw, mx, my - size, mz);
      for (let k = 0; k < 3; k++) col.push(c.r, c.g, c.b);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const flags = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    flags.name = "Fanions";
    const line = new THREE.Line(new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(rope, 3)), new THREE.LineBasicMaterial({ color: MF.color(MF.PAL.ink) }));
    g.add(flags, line);
    return g;
  };
  /** Poteau de fête rayé (mât de guirlande) : origine au pied. */
  MF.pole = function (h = 3.2, o = {}) {
    const g = MF.group({ name: "Mat_de_fete" });
    MF.cyl(0.05, 0.065, h, o.color || MF.PAL.cream, { y: h / 2, parent: g, cast: true, seg: 8 });
    MF.sphere(0.1, o.top || MF.PAL.yellow, { y: h + 0.06, parent: g, seg: 8 });
    return g;
  };
  /** Ballon de baudruche avec sa ficelle : origine au nœud (bas du ballon). */
  MF.balloon = function (hex = MF.PAL.red, r = 0.22) {
    const g = MF.group({ name: "Ballon" });
    const b = MF.sphere(r, MF.mat(hex, { emissive: hex, emissiveIntensity: 0.18 }), { y: r * 1.15, parent: g, seg: 12 });
    b.scale.set(1, 1.18, 1);
    MF.cone(r * 0.16, r * 0.2, hex, { y: -0.01, rx: Math.PI, parent: g, seg: 6 });
    return g;
  };
  /**
   * Réduit une image choisie par l'utilisateur (fichier) et la rend en « data: » d'au plus max
   * caractères : WebP, sinon PNG, sinon JPEG sur fond blanc ; plus petite si elle pèse encore trop.
   * o.w, o.h : taille en pixels ; o.free : garde le rapport de l'image (sinon elle est centrée dans w × h).
   */
  MF.shrinkImage = function (file, o = {}) {
    return new Promise((resolve, reject) => {
      if (!file || !/^image\//.test(file.type || "")) return reject(new Error("This file is not an image"));
      const url = URL.createObjectURL(file), img = new Image();
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("This image cannot be read"));
      };
      img.onload = () => {
        URL.revokeObjectURL(url);
        const max = o.max || 12000;
        let W = o.w || 96, H = o.h || 64;
        for (let pass = 0; pass < 5; pass++) {
          let cw = W, ch = H;
          if (o.free) {
            const k = Math.min(W / img.width, H / img.height, 1);
            cw = Math.max(1, Math.round(img.width * k));
            ch = Math.max(1, Math.round(img.height * k));
          }
          const c = document.createElement("canvas");
          c.width = cw;
          c.height = ch;
          const k = Math.min(cw / img.width, ch / img.height), dw = img.width * k, dh = img.height * k;
          c.getContext("2d").drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
          for (const [type, quality] of [["image/webp", 0.82], ["image/png"], ["image/jpeg", 0.74]]) {
            let source = c;
            if (type === "image/jpeg") {
              source = document.createElement("canvas");
              source.width = cw;
              source.height = ch;
              const f = source.getContext("2d");
              f.fillStyle = "#ffffff";
              f.fillRect(0, 0, cw, ch);
              f.drawImage(c, 0, 0);
            }
            const data = source.toDataURL(type, quality);
            if (data.startsWith("data:" + type) && data.length <= max) return resolve(data);
          }
          W = Math.round(W * 0.72);
          H = Math.round(H * 0.72);
        }
        reject(new Error("This image is too heavy, try a simpler one"));
      };
      img.src = url;
    });
  };

  MF.dispose = function (object) {
    if (!object) return;
    if (object.parent) object.parent.remove(object);
    object.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      for (const m of mats) {
        if (m.map && m.map.isCanvasTexture) m.map.dispose();
        if (![...matCache.values()].includes(m)) m.dispose();
      }
    });
  };

  /* ------------------------------------------------------------------ sons (synthèse, aucun fichier) */
  const sfx = (MF.sfx = { muted: false, volume: 0.5, ctx: null });
  function audio() {
    if (sfx.muted) return null;
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return null;
    if (!sfx.ctx) {
      try {
        sfx.ctx = new AC();
        sfx.out = sfx.ctx.createGain();
        sfx.out.gain.value = sfx.volume;
        sfx.out.connect(sfx.ctx.destination);
      } catch (e) {
        return null;
      }
    }
    if (sfx.ctx.state === "suspended") sfx.ctx.resume().catch(() => {});
    return sfx.ctx.state === "running" ? sfx.ctx : null;
  }
  function tone(ac, type, f0, f1, dur, gain, delay = 0) {
    const t = ac.currentTime + delay;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(sfx.out);
    osc.start(t);
    osc.stop(t + dur + 0.03);
  }
  function noise(ac, dur, gain, freq, q = 1, delay = 0) {
    const t = ac.currentTime + delay;
    const len = Math.max(1, Math.floor(ac.sampleRate * dur));
    const buffer = ac.createBuffer(1, len, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ac.createBufferSource();
    src.buffer = buffer;
    const filter = ac.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = freq;
    filter.Q.value = q;
    const g = ac.createGain();
    g.gain.value = gain;
    src.connect(filter).connect(g).connect(sfx.out);
    src.start(t);
  }
  const SOUNDS = {
    bip: (ac) => tone(ac, "square", 660, 660, 0.12, 0.16),
    top: (ac) => tone(ac, "square", 1180, 1180, 0.42, 0.2),
    clic: (ac) => tone(ac, "triangle", 900, 700, 0.05, 0.14),
    pop: (ac) => {
      tone(ac, "sine", 620, 160, 0.09, 0.3);
      noise(ac, 0.05, 0.2, 2400, 0.8);
    },
    choc: (ac) => {
      tone(ac, "sine", 150, 50, 0.16, 0.42);
      noise(ac, 0.1, 0.28, 700, 0.7);
    },
    ting: (ac) => {
      tone(ac, "triangle", 1560, 1500, 0.3, 0.2);
      tone(ac, "sine", 2340, 2300, 0.22, 0.09);
    },
    tir: (ac) => {
      noise(ac, 0.09, 0.4, 1800, 0.6);
      tone(ac, "square", 320, 90, 0.07, 0.12);
    },
    plouf: (ac) => {
      noise(ac, 0.32, 0.34, 520, 0.9);
      tone(ac, "sine", 300, 90, 0.2, 0.16);
    },
    swing: (ac) => noise(ac, 0.14, 0.2, 1100, 2.2),
    toc: (ac) => tone(ac, "triangle", 420, 300, 0.07, 0.3),
    trou: (ac) => {
      tone(ac, "sine", 520, 780, 0.12, 0.2);
      tone(ac, "sine", 780, 1040, 0.2, 0.2, 0.11);
    },
    tour: (ac) => {
      tone(ac, "square", 780, 780, 0.09, 0.14);
      tone(ac, "square", 1040, 1040, 0.14, 0.14, 0.1);
    },
    bravo: (ac) => [523, 659, 784, 1047].forEach((f, i) => tone(ac, "triangle", f, f, 0.22, 0.2, i * 0.11)),
    perdu: (ac) => [392, 330, 262].forEach((f, i) => tone(ac, "triangle", f, f, 0.24, 0.16, i * 0.14)),
    boing: (ac) => tone(ac, "sine", 180, 520, 0.18, 0.26),
  };
  sfx.play = function (name) {
    const ac = audio();
    if (!ac || !SOUNDS[name]) return;
    try {
      SOUNDS[name](ac);
    } catch (e) {}
  };
  /** Bourdonnement continu (moteur, hélices) : MF.sfx.loop("moteur") → { set(hauteur 0..1, volume 0..1), stop() }. */
  sfx.loop = function (kind = "moteur") {
    const ac = audio();
    if (!ac) return { set() {}, stop() {} };
    const osc = ac.createOscillator(), g = ac.createGain(), filter = ac.createBiquadFilter();
    osc.type = kind === "helices" ? "sawtooth" : "square";
    filter.type = "lowpass";
    filter.frequency.value = kind === "helices" ? 1400 : 700;
    g.gain.value = 0;
    osc.frequency.value = 60;
    osc.connect(filter).connect(g).connect(sfx.out);
    osc.start();
    const base = kind === "helices" ? 150 : kind === "bateau" ? 55 : 70;
    const span = kind === "helices" ? 260 : kind === "bateau" ? 90 : 190;
    return {
      set(pitch, volume) {
        osc.frequency.setTargetAtTime(base + span * MF.clamp(pitch, 0, 1.4), ac.currentTime, 0.05);
        g.gain.setTargetAtTime(sfx.muted ? 0 : 0.05 * MF.clamp(volume, 0, 1), ac.currentTime, 0.08);
      },
      stop() {
        try {
          g.gain.setTargetAtTime(0, ac.currentTime, 0.05);
          osc.stop(ac.currentTime + 0.3);
        } catch (e) {}
      },
    };
  };
  sfx.setMuted = function (m) {
    sfx.muted = !!m;
    if (sfx.out) sfx.out.gain.value = sfx.muted ? 0 : sfx.volume;
    try {
      localStorage.setItem("fete-son", sfx.muted ? "0" : "1");
    } catch (e) {}
  };
  try {
    sfx.muted = typeof localStorage !== "undefined" && localStorage.getItem("fete-son") === "0";
  } catch (e) {}
})();
