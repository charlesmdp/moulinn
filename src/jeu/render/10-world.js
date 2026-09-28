// « Pas touche à mes trésors » — construction du domaine 3D d'une disposition : relief, sols,
// eau, moulin et bâtiments, ponts, arbres, rochers, supports et emplacements de pièges.
//
// Carte en U (0..64 × 0..44), monde en mètres centré sur la carte : X = (x − 32) × 1,8,
// Z = (z − 22) × 1,8. L'eau est au niveau 0 ; le sol courant à +1 m.
(function () {
  "use strict";
  const PTMT = (globalThis.PTMT = globalThis.PTMT || {});
  const G = PTMT.geom;
  const U = PTMT.U;
  const MAP_W = 64,
    MAP_H = 44;
  const MARGIN = 34; // mètres de paysage autour de la carte
  const GROUND = 1.0;
  const WATER_Y = 0.02;

  const smooth = (a, b, x) => {
    const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  function polySigned(x, z, poly) {
    // Distance signée au contour (positive dedans), en U.
    let d = Infinity;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) d = Math.min(d, G.segDist(x, z, poly[j], poly[i]));
    return G.pointInPolygon(x, z, poly) ? d : -d;
  }
  function hash(x, z) {
    const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
    return s - Math.floor(s);
  }
  function noise(x, z) {
    const xi = Math.floor(x),
      zi = Math.floor(z),
      xf = x - xi,
      zf = z - zi;
    const u = xf * xf * (3 - 2 * xf),
      v = zf * zf * (3 - 2 * zf);
    const a = hash(xi, zi),
      b = hash(xi + 1, zi),
      c = hash(xi, zi + 1),
      d = hash(xi + 1, zi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }

  function World(ctx) {
    this.ctx = ctx;
    this.THREE = THREE;
    this.root = new THREE.Group();
    this.root.name = "Domaine";
    ctx.scene.add(this.root);
    this.textures = ctx.textures;
    this.focus = [];
    for (let i = 0; i < 8; i++) this.focus.push(new THREE.Vector4(0, -1000, 0, 0));
    this.treeUniforms = { uTime: { value: 0 }, uWind: { value: 0.6 }, uFocus: { value: this.focus }, uCam: { value: new THREE.Vector3() } };
    this.waterUniforms = null;
  }
  const W = World.prototype;

  W.toWorld = function (x, z, y = 0, out) {
    out = out || new THREE.Vector3();
    return out.set((x - MAP_W / 2) * U, y, (z - MAP_H / 2) * U);
  };
  W.fromWorld = function (v) {
    return [v.x / U + MAP_W / 2, v.z / U + MAP_H / 2];
  };

  /** Hauteur (m) du sol en coordonnées carte (U), calculée à partir de la disposition. */
  W.makeHeight = function (L) {
    const hills = L.hills || [];
    const ponds = L.ponds;
    const islands = ponds.filter((p) => p.island).map((p) => p.island);
    const streams = L.streams;
    const pads = [...L.buildings.map((b) => ({ poly: b.footprint, onWater: b.onWater || b.island })), L.mill ? { poly: L.mill.footprint } : null].filter(Boolean);
    const self = this;
    const raw = function (x, z) {
      let h = GROUND;
      for (const hl of hills) {
        const d2 = (x - hl.x) * (x - hl.x) + (z - hl.z) * (z - hl.z);
        const s = hl.r * 0.55;
        h += hl.h * Math.exp(-d2 / (2 * s * s));
      }
      // Ondulations douces hors de la carte (paysage) et sur la carte.
      h += (noise(x * 0.09, z * 0.09) - 0.5) * 0.9 + (noise(x * 0.31 + 7, z * 0.31) - 0.5) * 0.18;
      const out = Math.max(0, -x, x - MAP_W, -z, z - MAP_H);
      if (out > 0) h += Math.min(6, out * 0.18);
      // Étangs : berge qui descend jusqu'au fond.
      let carve = h;
      for (const p of ponds) {
        const d = polySigned(x, z, p.poly);
        if (d > -1.4) {
          const depth = p.small ? -0.6 : -1.5;
          const t = d > 0 ? smooth(0, p.small ? 0.7 : 1.8, d) : 0;
          const edge = d > 0 ? 0.12 : 0.12 + (h - 0.12) * smooth(0, 1.4, -d);
          carve = Math.min(carve, d > 0 ? 0.12 + (depth - 0.12) * t : edge);
        }
      }
      // Îlots : le sol remonte.
      for (const isl of islands) {
        const d = polySigned(x, z, isl);
        if (d > -1.2) carve = Math.max(carve, 0.12 + 0.6 * smooth(-1.2, 0.8, d) + 0.25 * smooth(0.8, 2.5, d));
      }
      // Îlots rocheux : un petit tertre.
      for (const it of L.islets || []) {
        const d = Math.hypot(x - it.x, z - it.z);
        if (d < it.r + 0.6) carve = Math.max(carve, 0.45 * smooth(it.r + 0.6, it.r * 0.4, d) + carve * 0);
      }
      return carve;
    };
    // Plateformes des bâtiments : sol aplani à la hauteur moyenne du pourtour.
    const padLevels = pads.map((p) => {
      let s = 0,
        n = 0;
      for (const q of p.poly) {
        s += raw(q[0], q[1]);
        n++;
      }
      return { poly: p.poly, level: p.onWater ? null : Math.max(0.35, s / n) };
    });
    // Ruisseaux et biefs : lit creusé (après les plateformes, pour garder la fosse de la roue).
    // Contre la roue, le bief est un coursier maçonné : berges presque verticales.
    const wheel = L.mill ? L.mill.wheel : null;
    const carveStreams = function (x, z, h) {
      for (const st of streams) {
        const d = G.polylineDist(x, z, st.pts);
        const hw = st.width / 2;
        let bank = 1.3;
        if (st.bief && wheel) bank = 0.25 + 1.05 * smooth(2.6, 4.6, Math.hypot(x - wheel[0], z - wheel[1]));
        if (d < hw + bank) {
          const bed = st.bief ? -0.8 : -0.7;
          const v = d < hw ? bed + (0.1 - bed) * smooth(hw * 0.4, hw, d) : 0.1 + (h - 0.1) * smooth(hw, hw + bank, d);
          h = Math.min(h, v);
        }
      }
      return h;
    };
    // Véranda du moulin : de plain-pied avec le jardin (le bief passe dessous en buse si besoin).
    const millPad = L.mill ? padLevels[padLevels.length - 1] : null;
    const terrace = L.mill && L.mill.terrace && millPad ? { poly: L.mill.terrace, level: millPad.level } : null;
    this.terrace = terrace;
    return function (x, z) {
      let h = raw(x, z);
      for (const pd of padLevels) {
        if (pd.level === null) continue;
        const d = polySigned(x, z, pd.poly);
        if (d > -2.2) h = h + (pd.level - h) * smooth(-2.2, 0.2, d);
      }
      h = carveStreams(x, z, h);
      if (terrace) {
        const d = polySigned(x, z, terrace.poly);
        if (d > -0.8) h = h + (terrace.level - h) * smooth(-0.8, 0.05, d);
      }
      return h;
    };
  };

  W.dispose = function () {
    const rm = [...this.root.children];
    for (const o of rm) {
      this.root.remove(o);
      o.traverse((c) => {
        if (c.geometry && !c.userData.shared) c.geometry.dispose();
      });
    }
    this.animated = [];
  };

  /** Construit le domaine d'une disposition. */
  W.build = function (L) {
    this.dispose();
    this.L = L;
    this.animated = [];
    this.heightU = this.makeHeight(L);
    const self = this;
    this.height = (x, z) => self.heightU(x, z);
    this.buildTerrain(L);
    this.buildWater(L);
    this.buildBridges(L);
    this.buildMill(L);
    this.buildBuildings(L);
    this.buildTrees(L);
    this.buildRocks(L);
    this.buildSockets(L);
    this.buildTrapSlots(L);
    this.root.updateMatrixWorld(true);
  };

  // ── Relief et sols ────────────────────────────────────────────────────────
  W.buildTerrain = function (L) {
    const mobile = this.ctx.mobile;
    const step = mobile ? 1.35 : 0.95; // mètres
    const x0 = -MAP_W / 2 * U - MARGIN,
      x1 = MAP_W / 2 * U + MARGIN,
      z0 = -MAP_H / 2 * U - MARGIN,
      z1 = MAP_H / 2 * U + MARGIN;
    const nx = Math.ceil((x1 - x0) / step),
      nz = Math.ceil((z1 - z0) / step);
    const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0, nx, nz);
    geo.rotateX(-Math.PI / 2);
    geo.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const X = pos.getX(i),
        Z = pos.getZ(i);
      pos.setY(i, this.heightU(X / U + MAP_W / 2, Z / U + MAP_H / 2));
    }
    geo.computeVertexNormals();
    this.bounds = { x0, x1, z0, z1 };
    const splat = this.paintGround(L);
    const mat = new THREE.MeshStandardMaterial({ map: splat.color, roughness: 0.95, metalness: 0 });
    const tex = this.textures;
    const extent = new THREE.Vector4(x0, z0, x1 - x0, z1 - z0);
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uGrass = { value: tex.grass };
      sh.uniforms.uGravel = { value: tex.gravel };
      sh.uniforms.uMask = { value: splat.mask };
      sh.uniforms.uExtent = { value: extent };
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vWorldPos;")
        .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;");
      sh.fragmentShader = sh.fragmentShader
        .replace(
          "#include <common>",
          "#include <common>\nvarying vec3 vWorldPos;\nuniform sampler2D uGrass, uGravel, uMask;\nuniform vec4 uExtent;",
        )
        .replace(
          "#include <map_fragment>",
          `vec2 suv = (vWorldPos.xz - uExtent.xy) / uExtent.zw;
          vec4 tint = mapTexelToLinear(texture2D(map, vec2(suv.x, 1.0 - suv.y)));
          vec3 mk = texture2D(uMask, vec2(suv.x, 1.0 - suv.y)).rgb;
          vec3 grassD = texture2D(uGrass, vWorldPos.xz * 0.21).rgb;
          vec3 grassD2 = texture2D(uGrass, vWorldPos.xz * 0.043 + 0.37).rgb;
          vec3 gravelD = texture2D(uGravel, vWorldPos.xz * 0.35).rgb;
          float gl = dot(grassD, vec3(0.333)) * 0.6 + dot(grassD2, vec3(0.333)) * 0.4;
          float gv = dot(gravelD, vec3(0.333));
          vec3 detail = mix(vec3(0.62 + gl * 0.8), vec3(0.55 + gv * 0.9), mk.r);
          float slope = 1.0 - normalize(vNormal).y;
          vec3 base = tint.rgb * detail;
          base = mix(base, base * vec3(0.92, 0.86, 0.78), smoothstep(0.08, 0.3, slope));
          diffuseColor.rgb *= base;`,
        );
    };
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = "Relief";
    mesh.receiveShadow = true;
    this.root.add(mesh);
    this.terrain = mesh;
    // Au-delà : un grand sol aux couleurs des champs pour l'horizon.
    const far = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), new THREE.MeshLambertMaterial({ color: PTMT.color("#6d7d44") }));
    far.rotation.x = -Math.PI / 2;
    far.position.y = GROUND + 4.5;
    far.name = "Horizon";
    const ring = new THREE.Mesh(new THREE.RingGeometry(Math.hypot(x1 - x0, z1 - z0) * 0.48, 700, 48, 1), far.material);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = GROUND + 4.2;
    this.root.add(ring);
  };

  /** Peint la couleur des sols (herbe, chemins, berges, champs) et le masque des chemins. */
  W.paintGround = function (L) {
    const px = this.ctx.mobile ? 3 : 4.5; // pixels par mètre
    const { x0, x1, z0, z1 } = this.bounds;
    const w = Math.round((x1 - x0) * px),
      h = Math.round((z1 - z0) * px);
    const cv = document.createElement("canvas");
    cv.width = w;
    cv.height = h;
    const c = cv.getContext("2d");
    const mk = document.createElement("canvas");
    mk.width = w;
    mk.height = h;
    const m = mk.getContext("2d");
    const P = (x, z) => [((x - MAP_W / 2) * U - x0) * px, ((z - MAP_H / 2) * U - z0) * px];
    const rng = PTMT.rng(L.seed);
    // Herbe de base avec des nuances.
    c.fillStyle = "#86a857";
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      const x = rng() * w,
        y = rng() * h,
        r = (4 + rng() * 16) * px;
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      const col = rng() < 0.5 ? "rgba(112,150,62,0.35)" : rng() < 0.6 ? "rgba(160,178,86,0.28)" : "rgba(92,128,58,0.3)";
      g.addColorStop(0, col);
      g.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = g;
      c.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
    // Champs autour (labours et cultures).
    for (const f of L.fields || []) {
      c.save();
      c.beginPath();
      f.poly.forEach((q, i) => (i ? c.lineTo(...P(q[0], q[1])) : c.moveTo(...P(q[0], q[1]))));
      c.closePath();
      c.fillStyle = f.kind === "crop" ? "#a58a5c" : "#9ab65f";
      c.fill();
      c.clip();
      c.strokeStyle = f.kind === "crop" ? "rgba(90,66,38,0.45)" : "rgba(120,150,70,0.5)";
      c.lineWidth = 0.7 * px;
      for (let k = -h; k < w + h; k += 1.6 * px) {
        c.beginPath();
        c.moveTo(k, 0);
        c.lineTo(k + h * 0.35, h);
        c.stroke();
      }
      c.restore();
    }
    // Hors carte : champs lointains autour du domaine.
    const edge = [
      [-10, -20, 30, 12, "#a58a5c"],
      [36, -24, 44, 16, "#b39a64"],
      [-26, 18, 18, 22, "#95ad5a"],
      [74, 12, 16, 24, "#a58a5c"],
      [10, 52, 36, 14, "#9ab65f"],
      [54, 54, 26, 14, "#b39a64"],
    ];
    for (const [ex, ez, ew, eh, col] of edge) {
      const [a, b] = P(ex, ez),
        [cc, d] = P(ex + ew, ez + eh);
      c.fillStyle = col;
      c.globalAlpha = 0.9;
      c.fillRect(a, b, cc - a, d - b);
      c.globalAlpha = 1;
    }
    // Sous les bosquets : sol plus sombre, feuilles.
    for (const g of L.groves) {
      const [x, y] = P(g.x, g.z);
      const r = (g.r + 1.5) * U * px;
      const gr = c.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, g.species === "pine" ? "rgba(96,88,52,0.75)" : "rgba(88,104,52,0.7)");
      gr.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = gr;
      c.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
    // Berges : terre et joncs autour de l'eau.
    const stroke = (pts, width, color, closed, ctx2 = c) => {
      ctx2.beginPath();
      pts.forEach((q, i) => (i ? ctx2.lineTo(...P(q[0], q[1])) : ctx2.moveTo(...P(q[0], q[1]))));
      if (closed) ctx2.closePath();
      ctx2.lineWidth = width * px;
      ctx2.lineJoin = ctx2.lineCap = "round";
      ctx2.strokeStyle = color;
      ctx2.stroke();
    };
    for (const p of L.ponds) {
      stroke(p.poly, p.small ? 2.2 : 4.2, "rgba(110,98,62,0.85)", true);
      stroke(p.poly, p.small ? 1.1 : 2.2, "rgba(86,74,48,0.9)", true);
      if (p.island) stroke(p.island, 1.8, "rgba(110,98,62,0.8)", true);
    }
    c.save();
    if (L.mill && L.mill.terrace) {
      // Pas de berge boueuse sous la véranda : le jardin y est de plain-pied.
      c.beginPath();
      c.rect(0, 0, w, h);
      L.mill.terrace.forEach((q, i) => (i ? c.lineTo(...P(q[0], q[1])) : c.moveTo(...P(q[0], q[1]))));
      c.closePath();
      c.clip("evenodd");
    }
    for (const st of L.streams) stroke(st.pts, st.width * U + 2.4, "rgba(104,94,60,0.85)", false);
    c.restore();
    // Plateformes des bâtiments : gravier.
    const fill = (poly, color, grow = 0) => {
      c.beginPath();
      poly.forEach((q, i) => (i ? c.lineTo(...P(q[0], q[1])) : c.moveTo(...P(q[0], q[1]))));
      c.closePath();
      c.fillStyle = color;
      c.fill();
      if (grow) {
        c.lineWidth = grow * px;
        c.strokeStyle = color;
        c.stroke();
      }
    };
    const pads = [...L.buildings.filter((b) => !b.island && !b.onWater).map((b) => b.footprint), L.mill ? L.mill.footprint : null].filter(Boolean);
    for (const f of pads) fill(f, "#a39a86", 2.6);
    // Chemins : terre battue, bords plus sombres ; masque pour le gravier.
    for (const e of L.edges) {
      if (e.kind === "water" || e.kind === "shore") continue;
      stroke(e.pts, 3.6, "rgba(120,104,70,0.55)", false);
      stroke(e.pts, 2.7, "#b8a275", false);
      stroke(e.pts, 1.5, "#c9b58a", false);
      stroke(e.pts, 3.0, "#ffffff", false, m);
    }
    for (const f of pads) {
      m.beginPath();
      f.forEach((q, i) => (i ? m.lineTo(...P(q[0], q[1])) : m.moveTo(...P(q[0], q[1]))));
      m.closePath();
      m.fillStyle = "#b0b0b0";
      m.fill();
      m.lineWidth = 2.4 * px;
      m.strokeStyle = "#8a8a8a";
      m.stroke();
    }
    // Petits cailloux et fleurs.
    for (let i = 0; i < 2600; i++) {
      const x = rng() * w,
        y = rng() * h;
      c.fillStyle = rng() < 0.7 ? "rgba(255,244,200,0.35)" : rng() < 0.5 ? "rgba(240,200,230,0.45)" : "rgba(255,255,255,0.4)";
      c.fillRect(x, y, 1.5, 1.5);
    }
    const color = new THREE.CanvasTexture(cv);
    color.encoding = THREE.sRGBEncoding;
    color.anisotropy = 4;
    const mask = new THREE.CanvasTexture(mk);
    return { color, mask, canvas: cv };
  };

  // ── Eau ───────────────────────────────────────────────────────────────────
  W.waterMaterial = function () {
    if (this._waterMat) return this._waterMat;
    const tex = this.textures;
    const { x0, x1, z0, z1 } = this.bounds;
    this.waterUniforms = {
      uTime: { value: 0 },
      uRipple: { value: tex.water },
      uSun: { value: new THREE.Vector3(0.5, 0.8, 0.3).normalize() },
      uShallow: { value: PTMT.color("#5fa7a0") },
      uDeep: { value: PTMT.color("#1f4f63") },
      uSky: { value: PTMT.color("#bcd8ee") },
      uDepth: { value: null },
      uExtent: { value: new THREE.Vector4(x0, z0, x1 - x0, z1 - z0) },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.waterUniforms,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      vertexShader: `attribute vec2 flow; varying vec3 vW; varying vec2 vFlow;
        void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vFlow = flow; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `uniform float uTime; uniform sampler2D uRipple, uDepth; uniform vec3 uSun, uShallow, uDeep, uSky; uniform vec4 uExtent;
        varying vec3 vW; varying vec2 vFlow;
        void main(){
          vec2 p = vW.xz;
          float speed = length(vFlow);
          vec2 f = speed > 0.001 ? vFlow : vec2(0.0);
          float ph = fract(uTime * 0.18);
          vec2 pa = p - f * ph * 3.0, pb = p - f * fract(ph + 0.5) * 3.0 + 0.37;
          float blend = abs(1.0 - 2.0 * ph);
          vec2 na = texture2D(uRipple, pa * 0.09 + vec2(uTime * 0.012, uTime * 0.008)).rg * 2.0 - 1.0;
          vec2 nb = texture2D(uRipple, pb * 0.09 + vec2(-uTime * 0.01, uTime * 0.011)).rg * 2.0 - 1.0;
          vec2 n2 = texture2D(uRipple, p * 0.23 - vec2(uTime * 0.02, -uTime * 0.015)).rg * 2.0 - 1.0;
          vec2 slope = mix(na, nb, speed > 0.001 ? blend : 0.0) * 0.55 + n2 * 0.3;
          vec3 N = normalize(vec3(-slope.x * 0.35, 1.0, -slope.y * 0.35));
          vec3 V = normalize(cameraPosition - vW);
          vec2 suv = (vW.xz - uExtent.xy) / uExtent.zw;
          float depth = texture2D(uDepth, vec2(suv.x, 1.0 - suv.y)).r;
          float deep = smoothstep(0.05, 0.9, depth);
          vec3 col = mix(uShallow, uDeep, deep);
          float fres = pow(1.0 - max(dot(N, V), 0.0), 4.0);
          col = mix(col, uSky, 0.12 + fres * 0.55);
          vec3 H = normalize(uSun + V);
          col += vec3(1.0, 0.95, 0.8) * pow(max(dot(N, H), 0.0), 180.0) * 1.4;
          float foam = (1.0 - smoothstep(0.0, 0.14, depth)) * (0.55 + 0.45 * sin(uTime * 1.3 + p.x * 1.7 + p.y * 1.3));
          foam += speed * smoothstep(0.55, 0.9, texture2D(uRipple, pa * 0.4).b) * 0.35;
          col = mix(col, vec3(0.92, 0.96, 0.95), clamp(foam, 0.0, 0.75));
          float a = mix(0.62, 0.9, deep) + fres * 0.08;
          gl_FragColor = vec4(col, a);
          #include <tonemapping_fragment>
          #include <encodings_fragment>
        }`,
    });
    this._waterMat = mat;
    return mat;
  };
  W.bakeDepth = function () {
    // Profondeur d'eau (niveau 0 − fond) sur une grille : couleur et écume du rivage.
    const { x0, x1, z0, z1 } = this.bounds;
    const res = this.ctx.mobile ? 1.2 : 0.8;
    const w = Math.ceil((x1 - x0) / res),
      h = Math.ceil((z1 - z0) / res);
    const data = new Uint8Array(w * h * 4);
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const X = x0 + (i + 0.5) * res,
          Z = z1 - (j + 0.5) * res;
        const d = Math.max(0, Math.min(1, (WATER_Y - this.heightU(X / U + MAP_W / 2, Z / U + MAP_H / 2)) / 1.6));
        const k = (j * w + i) * 4;
        data[k] = data[k + 1] = data[k + 2] = Math.round(d * 255);
        data[k + 3] = 255;
      }
    const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
    t.magFilter = t.minFilter = THREE.LinearFilter;
    t.needsUpdate = true;
    return t;
  };
  W.buildWater = function (L) {
    const mat = this.waterMaterial();
    this.waterUniforms.uDepth.value = this.bakeDepth();
    const group = new THREE.Group();
    group.name = "Eau";
    // Étangs et bassins (avec îlots en creux).
    for (const p of L.ponds) {
      const shape = new THREE.Shape(p.poly.map((q) => new THREE.Vector2((q[0] - MAP_W / 2) * U, (q[1] - MAP_H / 2) * U)));
      if (p.island) shape.holes.push(new THREE.Path(p.island.map((q) => new THREE.Vector2((q[0] - MAP_W / 2) * U, (q[1] - MAP_H / 2) * U))));
      // Un peu plus grand que le contour : l'eau vient mourir sur la berge.
      const g = new THREE.ShapeGeometry(shape, 6);
      g.rotateX(Math.PI / 2);
      const pos = g.attributes.position;
      for (let i = 0; i < pos.count; i++) pos.setY(i, WATER_Y);
      g.setAttribute("flow", new THREE.Float32BufferAttribute(new Float32Array(pos.count * 2), 2));
      const mesh = new THREE.Mesh(g, mat);
      mesh.renderOrder = 2;
      mesh.name = p.name;
      group.add(mesh);
      // Liseré élargi (1,2 m) pour noyer le pied de berge.
      const ring = this.polyRibbon(p.poly, 1.4, true);
      if (ring) group.add(new THREE.Mesh(ring, mat));
    }
    // Ruisseaux et biefs : ruban qui suit la ligne, avec le sens du courant.
    for (const st of L.streams) {
      const g = this.ribbon(st.pts, st.width * U + 1.6, WATER_Y, true);
      const mesh = new THREE.Mesh(g, mat);
      mesh.renderOrder = 2;
      group.add(mesh);
    }
    this.root.add(group);
    this.buildMillRace(L);
  };
  /** Coursier maçonné autour de la roue et bouches voûtées là où le bief passe sous la véranda. */
  W.buildMillRace = function (L) {
    const m = L.mill;
    const st = L.streams.find((x) => x.bief);
    if (!m || !st) return;
    const stone = PTMT.mat("td:raceStone", () => new THREE.MeshStandardMaterial({ color: PTMT.color("#a29a88"), map: this.textures.stone, roughness: 0.93, side: THREE.DoubleSide }));
    const dark = PTMT.solid("#141a18", { roughness: 1 });
    const line = G.polyline(st.pts);
    const hw = (st.width / 2) * U;
    const terrace = this.terrace;
    const inTerrace = (x, z) => terrace && G.pointInPolygon(x, z, terrace.poly);
    const parts = [];
    // Murs du coursier (maçonnerie continue) de part et d'autre de la roue, jusqu'au niveau du sol.
    const pos = [],
      uv = [],
      idx = [];
    const p = {},
      q0 = {},
      q1 = {};
    const reach = 2.5,
      thick = 0.3;
    for (const side of [-1, 1]) {
      let prev = -1;
      let arc = 0;
      for (let sArc = 0; sArc <= line.length; sArc += 0.2) {
        G.at(line, sArc, p);
        const dw = Math.hypot(p.x - m.wheel[0], p.z - m.wheel[1]);
        if (dw > reach || inTerrace(p.x, p.z)) {
          prev = -1;
          continue;
        }
        // Tangente lissée (évite les recouvrements dans les virages serrés).
        G.at(line, sArc - 0.6, q0);
        G.at(line, sArc + 0.6, q1);
        let tx = q1.x - q0.x,
          tz = q1.z - q0.z;
        const tl = Math.hypot(tx, tz) || 1;
        tx /= tl;
        tz /= tl;
        const ox = -tz * side,
          oz = tx * side;
        const inner = hw / U;
        const outer = inner + thick / U;
        const gTop = Math.max(0.4, this.heightU(p.x + ox * (outer + 0.25), p.z + oz * (outer + 0.25))) + 0.1;
        const a = this.toWorld(p.x + ox * inner, p.z + oz * inner);
        const b = this.toWorld(p.x + ox * outer, p.z + oz * outer);
        const base = pos.length / 3;
        // 4 sommets : bas intérieur, haut intérieur, haut extérieur, bas extérieur.
        pos.push(a.x, -0.75, a.z, a.x, gTop, a.z, b.x, gTop, b.z, b.x, -0.75, b.z);
        const u = arc * 0.8;
        uv.push(u, 0, u, (gTop + 0.75) * 0.8, u, (gTop + 0.75) * 0.8 + thick, u, 0);
        if (prev >= 0) {
          for (const [i, j] of [
            [0, 1],
            [1, 2],
            [2, 3],
          ]) {
            // Quadrilatère entre les deux profils (faces doubles : l'orientation dépend du côté).
            idx.push(prev + i, base + i, base + j, prev + i, base + j, prev + j);
          }
        }
        prev = base;
        arc += 0.2 * U;
      }
    }
    if (pos.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      g.computeVertexNormals();
      parts.push(g);
    }
    // Bouches voûtées aux points où le bief entre sous la véranda (ou en sort).
    if (terrace) {
      const poly = terrace.poly;
      const pts = st.pts;
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, az] = pts[i],
          [bx, bz] = pts[i + 1];
        for (let k = 0; k < poly.length; k++) {
          const [cx, cz] = poly[k],
            [dx, dz] = poly[(k + 1) % poly.length];
          const den = (bx - ax) * (dz - cz) - (bz - az) * (dx - cx);
          if (Math.abs(den) < 1e-9) continue;
          const t = ((cx - ax) * (dz - cz) - (cz - az) * (dx - cx)) / den;
          const u = ((cx - ax) * (bz - az) - (cz - az) * (bx - ax)) / den;
          if (t < 0 || t > 1 || u < 0 || u > 1) continue;
          const x = ax + (bx - ax) * t,
            z = az + (bz - az) * t;
          const len = Math.hypot(bx - ax, bz - az) || 1;
          const fx = (bx - ax) / len,
            fz = (bz - az) / len;
          // La face regarde hors de la véranda.
          const inside = inTerrace(x + fx * 0.3, z + fz * 0.3);
          const nx = inside ? -fx : fx,
            nz = inside ? -fz : fz;
          const yaw = -Math.atan2(nz, nx) + Math.PI / 2;
          const c = this.toWorld(x, z);
          const top = terrace.level + 0.18;
          const g = new THREE.Group();
          g.position.set(c.x, 0, c.z);
          g.rotation.y = yaw;
          const wall = new THREE.Mesh(new THREE.BoxGeometry(hw * 2 + 1.6, top + 0.8, 0.45), stone);
          wall.position.set(0, (top - 0.8) / 2, 0);
          const hole = new THREE.Mesh(new THREE.CircleGeometry(hw + 0.12, 16, 0, Math.PI), dark);
          hole.position.set(0, WATER_Y - 0.05, 0.235);
          const arch = new THREE.Mesh(new THREE.TorusGeometry(hw + 0.2, 0.13, 6, 14, Math.PI), stone);
          arch.position.set(0, WATER_Y - 0.05, 0.25);
          for (const o of [wall, hole, arch]) {
            o.castShadow = o.receiveShadow = true;
            g.add(o);
          }
          this.root.add(g);
        }
      }
    }
    if (!parts.length) return;
    const walls = new THREE.Mesh(parts.length > 1 ? THREE.BufferGeometryUtils.mergeBufferGeometries(parts, false) : parts[0], stone);
    walls.name = "Coursier";
    walls.castShadow = walls.receiveShadow = true;
    this.root.add(walls);
  };
  /** Ruban le long d'une polyligne (carte, U), largeur en mètres. */
  W.ribbon = function (pts, widthM, y, flow) {
    const pos = [],
      fl = [],
      idx = [];
    const n = pts.length;
    const P = pts.map((q) => [(q[0] - MAP_W / 2) * U, (q[1] - MAP_H / 2) * U]);
    // Sous-échantillonnage pour des courbes douces.
    const S = [];
    for (let i = 0; i < n - 1; i++) {
      const a = P[i],
        b = P[i + 1];
      const segs = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 1.2));
      for (let k = 0; k < segs; k++) S.push([a[0] + ((b[0] - a[0]) * k) / segs, a[1] + ((b[1] - a[1]) * k) / segs]);
    }
    S.push(P[n - 1]);
    for (let i = 0; i < S.length; i++) {
      const a = S[Math.max(0, i - 1)],
        b = S[Math.min(S.length - 1, i + 1)];
      let dx = b[0] - a[0],
        dz = b[1] - a[1];
      const l = Math.hypot(dx, dz) || 1;
      dx /= l;
      dz /= l;
      const nx = -dz,
        nz = dx;
      const hw = widthM / 2;
      pos.push(S[i][0] + nx * hw, y, S[i][1] + nz * hw, S[i][0] - nx * hw, y, S[i][1] - nz * hw);
      const f = flow ? 0.55 : 0;
      fl.push(dx * f, dz * f, dx * f, dz * f);
      if (i < S.length - 1) {
        const k = i * 2;
        idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("flow", new THREE.Float32BufferAttribute(fl, 2));
    g.setIndex(idx);
    return g;
  };
  W.polyRibbon = function (poly, widthM, closed) {
    const pts = closed ? [...poly, poly[0]] : poly;
    const g = this.ribbon(pts, widthM, WATER_Y, false);
    return g;
  };

  // ── Ponts et pontons ─────────────────────────────────────────────────────────
  W.buildBridges = function (L) {
    const wood = PTMT.mat("td:bridgeWood", () => new THREE.MeshStandardMaterial({ color: PTMT.color("#8a6a45"), map: this.textures.wood, roughness: 0.85 }));
    const dark = PTMT.solid("#5c4630");
    const make = (cx, cz, rot, lengthU, widthU, y) => {
      const g = new THREE.Group();
      const L0 = lengthU * U,
        Wd = widthU * U;
      const deck = new THREE.Mesh(new THREE.BoxGeometry(Wd, 0.16, L0), wood);
      deck.position.y = y;
      deck.castShadow = deck.receiveShadow = true;
      g.add(deck);
      for (const s of [-1, 1]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, L0), dark);
        rail.position.set((s * Wd) / 2, y + 0.75, 0);
        rail.castShadow = true;
        g.add(rail);
        for (let k = -2; k <= 2; k++) {
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 0.1), dark);
          post.position.set((s * Wd) / 2, y + 0.35, (k * L0) / 4.4);
          post.castShadow = true;
          g.add(post);
        }
      }
      const p = this.toWorld(cx, cz);
      g.position.copy(p);
      g.rotation.y = -rot + Math.PI / 2;
      return g;
    };
    for (const b of L.bridges) this.root.add(make(b.x, b.z, b.rot, b.length, b.width, 1.05));
    for (const pt of L.pontoons) {
      for (let i = 0; i < pt.pts.length - 1; i++) {
        const a = pt.pts[i],
          c = pt.pts[i + 1];
        const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
        const rot = Math.atan2(c[1] - a[1], c[0] - a[0]);
        const g = make((a[0] + c[0]) / 2, (a[1] + c[1]) / 2, rot, len + 0.3, pt.width, 0.62);
        this.root.add(g);
        for (let k = 0; k <= Math.floor(len / 1.3); k++) {
          for (const s of [-1, 1]) {
            const t = k / Math.max(1, Math.floor(len / 1.3));
            const x = a[0] + (c[0] - a[0]) * t,
              z = a[1] + (c[1] - a[1]) * t;
            const nx = -(c[1] - a[1]) / len,
              nz = (c[0] - a[0]) / len;
            const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.8, 6), dark);
            post.position.copy(this.toWorld(x + (nx * s * pt.width) / 2, z + (nz * s * pt.width) / 2, -0.3));
            this.root.add(post);
          }
        }
      }
    }
  };

  // ── Moulin (modèle de la scène d'origine) ─────────────────────────────────────
  W.buildMill = function (L) {
    const m = L.mill;
    if (!m) return;
    const src = this.ctx.models.mill;
    const g = src ? src.clone(true) : this.fallbackHouse(4.7 * U, 7.9 * U, "#b9ad96");
    g.name = "Moulin";
    const c = this.toWorld(m.x, m.z);
    c.y = this.heightU(m.x, m.z) - 0.02;
    g.position.copy(c);
    g.rotation.y = -m.rot;
    g.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    this.root.add(g);
    this.millObject = g;
    // Roue : le rotor tourne autour de son axe.
    const rotor = g.getObjectByName("Rotor_mobile_du_moulin") || g.getObjectByName("Roue_a_aubes_contre_le_moulin");
    if (rotor) this.animated.push({ kind: "wheel", obj: rotor, speed: 0.55 });
    this.millAnchors = {
      meule: this.toWorld(m.meule[0], m.meule[1], this.heightU(m.meule[0], m.meule[1])),
      atelier: this.toWorld(m.atelier[0], m.atelier[1], this.heightU(m.atelier[0], m.atelier[1])),
      wheel: this.toWorld(m.wheel[0], m.wheel[1], 0.9),
      yaw: -m.rot,
    };
  };
  W.fallbackHouse = function (w, d, color) {
    const g = new THREE.Group();
    const walls = new THREE.Mesh(new THREE.BoxGeometry(w, 5.5, d), new THREE.MeshStandardMaterial({ color: PTMT.color(color), map: this.textures.stone, roughness: 0.9 }));
    walls.position.y = 2.75;
    g.add(walls);
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.01, w * 0.62, 3.2, 4, 1), new THREE.MeshStandardMaterial({ color: PTMT.color("#4d5560"), roughness: 0.8 }));
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(1, 1, d / w);
    roof.position.y = 5.5 + 1.6;
    g.add(roof);
    return g;
  };

  // ── Bâtiments de stockage ──────────────────────────────────────────────────
  W.buildBuildings = function (L) {
    this.buildingViews = [];
    for (const b of L.buildings) {
      let obj = null,
        view = null;
      if (b.kind === "dependance" && this.ctx.models.dependance) {
        obj = this.ctx.models.dependance.clone(true);
        // Modèle d'origine : long pan selon z local, entrée vers −x. On le couche sur l'emprise.
        const box = new THREE.Box3().setFromObject(obj);
        const size = box.getSize(new THREE.Vector3()),
          ctr = box.getCenter(new THREE.Vector3());
        const s = Math.min((b.w * U) / size.z, (b.d * U * 1.35) / size.x);
        const inner = new THREE.Group();
        obj.position.set(-ctr.x, -box.min.y, -ctr.z);
        inner.add(obj);
        inner.rotation.y = Math.PI / 2;
        inner.scale.setScalar(s);
        obj = new THREE.Group();
        obj.add(inner);
      } else if (PTMT.models.building) {
        try {
          view = PTMT.models.building(b.kind === "dependance" ? "grange" : b.kind);
          obj = view.object;
          const box = new THREE.Box3().setFromObject(obj);
          const size = box.getSize(new THREE.Vector3());
          const s = Math.min((b.w * U) / Math.max(0.1, size.x), (b.d * U * 1.2) / Math.max(0.1, size.z));
          if (isFinite(s) && s > 0.2 && s < 5) obj.scale.setScalar(s);
        } catch (e) {
          console.warn("Bâtiment", b.kind, e);
          obj = null;
        }
      }
      if (!obj) obj = this.fallbackHouse(b.w * U, b.d * U, b.kind === "crypte" ? "#8f8a82" : "#b3a58c");
      const c = this.toWorld(b.x, b.z);
      c.y = b.island || b.onWater ? 0.35 : this.heightU(b.x, b.z) - 0.02;
      if (b.onWater) this.addStilts(obj, b);
      const holder = new THREE.Group();
      holder.position.copy(c);
      holder.rotation.y = -b.rot;
      holder.add(obj);
      holder.name = "Batiment_" + b.id;
      holder.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      this.root.add(holder);
      this.buildingViews.push({ b, holder, view });
      if (view && view.update) this.animated.push({ kind: "view", view });
    }
  };
  W.addStilts = function (obj, b) {
    const mat = PTMT.solid("#5c4630");
    for (const sx of [-1, 1])
      for (const sz of [-1, 0, 1]) {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 2.2, 6), mat);
        p.position.set((sx * b.w * U) / 2.3, -0.9, (sz * b.d * U) / 2.4);
        obj.add(p);
      }
  };

  // ── Arbres ────────────────────────────────────────────────────────────────
  W.treeGeometries = function () {
    if (this._treeGeo) return this._treeGeo;
    const merge = (parts) => {
      // Fusion simple de géométries non indexées avec couleurs.
      let n = 0;
      for (const p of parts) n += p.g.attributes.position.count;
      const pos = new Float32Array(n * 3),
        nor = new Float32Array(n * 3),
        col = new Float32Array(n * 3),
        sway = new Float32Array(n);
      let o = 0;
      for (const p of parts) {
        const g = p.g.index ? p.g.toNonIndexed() : p.g;
        g.computeVertexNormals();
        const P = g.attributes.position,
          N = g.attributes.normal;
        const c = PTMT.color(p.color);
        for (let i = 0; i < P.count; i++) {
          pos[(o + i) * 3] = P.getX(i);
          pos[(o + i) * 3 + 1] = P.getY(i);
          pos[(o + i) * 3 + 2] = P.getZ(i);
          // Normales arrondies pour les houppiers (ombrage doux).
          let nx = N.getX(i),
            ny = N.getY(i),
            nz = N.getZ(i);
          if (p.round) {
            const rx = P.getX(i) - p.round[0],
              ry = P.getY(i) - p.round[1],
              rz = P.getZ(i) - p.round[2];
            const l = Math.hypot(rx, ry, rz) || 1;
            nx = nx * 0.35 + (rx / l) * 0.65;
            ny = ny * 0.35 + (ry / l) * 0.65 + 0.15;
            nz = nz * 0.35 + (rz / l) * 0.65;
            const l2 = Math.hypot(nx, ny, nz) || 1;
            nx /= l2;
            ny /= l2;
            nz /= l2;
          }
          nor[(o + i) * 3] = nx;
          nor[(o + i) * 3 + 1] = ny;
          nor[(o + i) * 3 + 2] = nz;
          const shade = p.leaf ? 0.82 + 0.3 * Math.max(0, P.getY(i) / 8) : 1;
          col[(o + i) * 3] = c.r * shade;
          col[(o + i) * 3 + 1] = c.g * shade;
          col[(o + i) * 3 + 2] = c.b * shade;
          sway[o + i] = Math.max(0, P.getY(i)) * (p.leaf ? 1 : 0.5);
        }
        o += P.count;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
      g.setAttribute("color", new THREE.BufferAttribute(col, 3));
      g.setAttribute("sway", new THREE.BufferAttribute(sway, 1));
      g.computeBoundingSphere();
      return g;
    };
    const rng = PTMT.rng(77);
    const blob = (r, x, y, z, detail = 1) => {
      const g = new THREE.IcosahedronGeometry(r, detail);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const k = 1 + (rng() - 0.5) * 0.22;
        p.setXYZ(i, p.getX(i) * k + x, p.getY(i) * k * 0.86 + y, p.getZ(i) * k + z);
      }
      return g;
    };
    const trunk = (h, r, lean = 0) => {
      const g = new THREE.CylinderGeometry(r * 0.6, r, h, 7, 3);
      g.translate(0, h / 2, 0);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) + (p.getY(i) / h) * lean);
      return g;
    };
    const oak = (v) => {
      const parts = [{ g: trunk(3.2, 0.34, 0.2 * v), color: "#6b5238" }];
      const n = 6 + v;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + v,
          d = 1.6 + rng() * 0.9;
        parts.push({ g: blob(1.7 + rng() * 0.7, Math.cos(a) * d, 4.2 + rng() * 1.6, Math.sin(a) * d), color: ["#5d8a3a", "#6b9642", "#577f37", "#76a049"][i % 4], leaf: true, round: [0, 5, 0] });
      }
      parts.push({ g: blob(2.3, 0, 6.2, 0), color: "#6f9a44", leaf: true, round: [0, 5, 0] });
      return merge(parts);
    };
    const pine = (v) => {
      const parts = [{ g: trunk(7.5, 0.26), color: "#7a4a2e" }];
      for (let i = 0; i < 4; i++) {
        const y = 3 + i * 1.5,
          r = 2.3 - i * 0.45;
        const g = new THREE.ConeGeometry(r, 2.4, 9, 1);
        g.translate(0, y, 0);
        const p = g.attributes.position;
        for (let k = 0; k < p.count; k++) {
          const s = 1 + (rng() - 0.5) * 0.16;
          p.setX(k, p.getX(k) * s);
          p.setZ(k, p.getZ(k) * s);
        }
        parts.push({ g, color: ["#2f5a41", "#376548", "#2b5239", "#3e6d4c"][(i + v) % 4], leaf: true, round: [0, y, 0] });
      }
      return merge(parts);
    };
    const birch = (v) => {
      const parts = [{ g: trunk(5.5, 0.16, 0.3), color: "#e8e4d8" }];
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + v * 0.7,
          d = 0.8 + rng() * 0.5;
        parts.push({ g: blob(1.05 + rng() * 0.35, Math.cos(a) * d + 0.3, 4.2 + rng() * 1.8, Math.sin(a) * d), color: ["#8fae4f", "#9bb95a", "#83a247"][i % 3], leaf: true, round: [0.3, 5, 0] });
      }
      return merge(parts);
    };
    const bush = () => {
      const parts = [];
      for (let i = 0; i < 4; i++) parts.push({ g: blob(0.7 + rng() * 0.3, (rng() - 0.5) * 1.1, 0.55, (rng() - 0.5) * 1.1, 1), color: ["#557f37", "#62893e", "#4d7532"][i % 3], leaf: true, round: [0, 0.4, 0] });
      return merge(parts);
    };
    this._treeGeo = { oak: [oak(0), oak(1)], pine: [pine(0), pine(1)], birch: [birch(0), birch(1)], bush: [bush()] };
    return this._treeGeo;
  };
  W.treeMaterial = function () {
    if (this._treeMat) return this._treeMat;
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 });
    const U2 = this.treeUniforms;
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U2);
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nattribute float sway;\nuniform float uTime, uWind;\nvarying vec3 vTreeW;")
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
          vec4 iw = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          float ph = iw.x * 0.21 + iw.z * 0.17;
          float s = sway * 0.018 * uWind;
          transformed.x += sin(uTime * 1.3 + ph) * s;
          transformed.z += cos(uTime * 1.05 + ph * 1.3) * s * 0.7;`,
        )
        .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvTreeW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;");
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vTreeW;\nuniform vec4 uFocus[8];")
        .replace(
          "#include <clipping_planes_fragment>",
          `#include <clipping_planes_fragment>
          // Arbres en transparence (tramage) quand ils masquent l'action.
          vec3 cam = cameraPosition;
          float hide = 0.0;
          for (int i = 0; i < 8; i++) {
            vec4 f = uFocus[i];
            if (f.w <= 0.0) continue;
            vec3 seg = f.xyz - cam;
            float L = length(seg);
            vec3 dir = seg / L;
            float t = dot(vTreeW - cam, dir);
            if (t <= 0.0 || t >= L - 0.5) continue;
            float d = length(vTreeW - (cam + dir * t));
            hide = max(hide, 1.0 - smoothstep(f.w * 0.55, f.w, d));
          }
          if (hide > 0.0) {
            float dither = fract(sin(dot(floor(gl_FragCoord.xy), vec2(12.9898, 78.233))) * 43758.5453);
            if (dither < hide * 0.72) discard;
          }`,
        );
    };
    this._treeMat = mat;
    return mat;
  };
  W.buildTrees = function (L) {
    const geos = this.treeGeometries();
    const mat = this.treeMaterial();
    const rng = PTMT.rng(L.seed + 5);
    const keep = (x, z, clear) => {
      if (x < -16 || z < -16 || x > MAP_W + 16 || z > MAP_H + 16) return false;
      for (const e of L.edges) if (G.polylineDist(x, z, e.pts) < (e.kind === "water" ? 0.9 : 1.7) + clear) return false;
      for (const p of L.ponds) if (G.pointInPolygon(x, z, p.poly) || polySigned(x, z, p.poly) > -0.8) return false;
      for (const st of L.streams) if (G.polylineDist(x, z, st.pts) < st.width / 2 + 1 + clear) return false;
      for (const poly of L.blockers) if (polySigned(x, z, poly) > -1.8 - clear) return false;
      if (L.mill && polySigned(x, z, L.mill.footprint) > -3) return false;
      for (const s of L.sockets) if (Math.hypot(s.x - x, s.z - z) < 1.9 + clear) return false;
      for (const b of L.bridges) if (Math.hypot(b.x - x, b.z - z) < 2.5) return false;
      if (L.mill) {
        for (const a of [L.mill.meule, L.mill.atelier]) if (Math.hypot(a[0] - x, a[1] - z) < 2.8) return false;
      }
      for (const r of L.rocks) if (Math.hypot(r.x - x, r.z - z) < 1.4 * r.s) return false;
      return true;
    };
    const lists = { oak: [], pine: [], birch: [], bush: [] };
    const place = (species, x, z, scale) => {
      lists[species].push({ x, z, s: scale, r: rng() * 6.28, v: Math.floor(rng() * (geos[species].length || 1)) });
    };
    for (const g of L.groves) {
      let n = 0,
        tries = 0;
      const placed = [];
      while (n < g.count && tries++ < g.count * 30) {
        const a = rng() * Math.PI * 2,
          d = Math.sqrt(rng()) * g.r;
        const x = g.x + Math.cos(a) * d,
          z = g.z + Math.sin(a) * d;
        if (!keep(x, z, 0)) continue;
        if (placed.some((p) => Math.hypot(p[0] - x, p[1] - z) < (g.species === "pine" ? 1.5 : 1.9))) continue;
        placed.push([x, z]);
        const sp = g.species === "pine" ? (rng() < 0.85 ? "pine" : "oak") : g.species === "birch" ? (rng() < 0.7 ? "birch" : "oak") : rng() < 0.12 ? "birch" : "oak";
        place(sp, x, z, 0.62 + rng() * 0.38);
        n++;
      }
    }
    // Lisière de forêt autour du domaine (hors carte) et haies.
    for (let i = 0; i < (this.ctx.mobile ? 110 : 190); i++) {
      const side = Math.floor(rng() * 4);
      let x, z;
      if (side === 0) (x = -2 - rng() * 14), (z = rng() * (MAP_H + 8) - 4);
      else if (side === 1) (x = MAP_W + 2 + rng() * 14), (z = rng() * (MAP_H + 8) - 4);
      else if (side === 2) (x = rng() * (MAP_W + 8) - 4), (z = -2 - rng() * 12);
      else (x = rng() * (MAP_W + 8) - 4), (z = MAP_H + 2 + rng() * 12);
      if (!keep(x, z, 1.2)) continue;
      place(rng() < 0.2 ? "pine" : rng() < 0.15 ? "birch" : "oak", x, z, 0.75 + rng() * 0.4);
    }
    // Buissons le long des chemins et des berges.
    for (let i = 0; i < (this.ctx.mobile ? 60 : 120); i++) {
      const e = L.edges[Math.floor(rng() * L.edges.length)];
      if (e.kind === "water") continue;
      const line = G.polyline(e.pts);
      const p = G.at(line, rng() * line.length);
      const side = rng() < 0.5 ? -1 : 1;
      const off = 2.1 + rng() * 1.6;
      const x = p.x - p.dz * side * off,
        z = p.z + p.dx * side * off;
      if (!keep(x, z, -0.3)) continue;
      place("bush", x, z, 0.7 + rng() * 0.6);
    }
    const dummy = new THREE.Object3D();
    this.treeMeshes = [];
    for (const sp of Object.keys(lists)) {
      const byVar = {};
      for (const t of lists[sp]) (byVar[t.v] = byVar[t.v] || []).push(t);
      for (const v of Object.keys(byVar)) {
        const arr = byVar[v];
        const mesh = new THREE.InstancedMesh(geos[sp][v], mat, arr.length);
        mesh.userData.shared = true;
        arr.forEach((t, i) => {
          dummy.position.copy(this.toWorld(t.x, t.z, this.heightU(t.x, t.z) - 0.1));
          dummy.rotation.set(0, t.r, 0);
          dummy.scale.setScalar(t.s);
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
        });
        mesh.castShadow = sp !== "bush";
        mesh.receiveShadow = true;
        mesh.name = "Arbres_" + sp;
        this.root.add(mesh);
        this.treeMeshes.push(mesh);
      }
    }
    this.treeCount = Object.values(lists).reduce((s, a) => s + a.length, 0);
  };

  // ── Rochers, supports, emplacements ─────────────────────────────────────────
  W.buildRocks = function (L) {
    const mat = PTMT.mat("td:rock", () => new THREE.MeshStandardMaterial({ color: PTMT.color("#9a958a"), map: this.textures.stone, roughness: 0.92, flatShading: true }));
    const rng = PTMT.rng(L.seed + 9);
    const add = (x, z, s) => {
      const g = new THREE.DodecahedronGeometry(0.9 * s, 1);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * (1 + (rng() - 0.5) * 0.3), p.getY(i) * 0.62, p.getZ(i) * (1 + (rng() - 0.5) * 0.3));
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, mat);
      m.position.copy(this.toWorld(x, z, this.heightU(x, z) + 0.15 * s));
      m.rotation.y = rng() * 6;
      m.castShadow = m.receiveShadow = true;
      this.root.add(m);
    };
    for (const r of L.rocks) add(r.x, r.z, r.s * 1.2);
    for (const it of L.islets || []) {
      for (let k = 0; k < 5; k++) add(it.x + Math.cos(k * 1.3) * it.r * 0.8, it.z + Math.sin(k * 1.3) * it.r * 0.8, 0.5 + rng() * 0.3);
    }
    // Pierres de berge.
    for (const p of L.ponds) {
      for (let i = 0; i < p.poly.length; i += 2) if (rng() < 0.5) add(p.poly[i][0], p.poly[i][1], 0.35 + rng() * 0.3);
    }
  };
  W.buildSockets = function (L) {
    this.socketViews = new Map();
    for (const s of L.sockets) {
      let view = null;
      if (PTMT.models.socket) {
        try {
          view = PTMT.models.socket(s.kind);
        } catch (e) {
          view = null;
        }
      }
      if (!view) view = this.fallbackSocket(s.kind);
      const y = s.islet ? 0.5 : this.heightU(s.x, s.z);
      view.object.position.copy(this.toWorld(s.x, s.z, y + 0.03));
      view.object.name = "Support_" + s.id;
      view.object.userData.socket = s.id;
      this.root.add(view.object);
      this.socketViews.set(s.id, view);
    }
  };
  W.fallbackSocket = function (kind) {
    const col = { fire: "#b5673d", ice: "#6fb8d8", water: "#3c7fb8" }[kind];
    const g = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.6, 0.22, 20), new THREE.MeshStandardMaterial({ color: PTMT.color("#a09a8c"), map: this.textures.stone, roughness: 0.9 }));
    disc.position.y = 0.11;
    disc.receiveShadow = true;
    g.add(disc);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.09, 6, 28), new THREE.MeshStandardMaterial({ color: PTMT.color(col), emissive: PTMT.color(col), emissiveIntensity: 0.6 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.24;
    g.add(ring);
    return {
      object: g,
      setState(st) {
        g.visible = st !== "hidden";
        ring.material.emissiveIntensity = st === "hover" ? 1.6 : st === "valid" ? 1.1 : st === "invalid" ? 0.1 : 0.6;
      },
      update() {},
    };
  };
  W.buildTrapSlots = function (L) {
    this.slotViews = new Map();
    const mat = PTMT.mat("td:slot", () => new THREE.MeshStandardMaterial({ color: PTMT.color("#e8d9a8"), transparent: true, opacity: 0.55, roughness: 1 }));
    const geo = PTMT.geo("td:slotRing", () => new THREE.RingGeometry(0.62, 0.86, 24));
    for (const t of L.trapSlots) {
      const m = new THREE.Mesh(geo, mat);
      m.rotation.x = -Math.PI / 2;
      m.position.copy(this.toWorld(t.x, t.z, this.heightU(t.x, t.z) + 0.06));
      m.userData.shared = true;
      m.userData.slot = t.id;
      m.renderOrder = 1;
      this.root.add(m);
      this.slotViews.set(t.id, m);
    }
  };

  W.update = function (dt, time, camera) {
    if (this.waterUniforms) this.waterUniforms.uTime.value = time;
    this.treeUniforms.uTime.value = time;
    if (camera) this.treeUniforms.uCam.value.copy(camera.position);
    for (const a of this.animated) {
      if (a.kind === "wheel") a.obj.rotation.x += dt * a.speed;
      else if (a.kind === "view") a.view.update(dt, time);
    }
    for (const v of this.socketViews ? this.socketViews.values() : []) if (v.update) v.update(dt, time);
  };
  /** Points à dégager (porteurs, sacs, sélection) : les arbres devant eux deviennent transparents. */
  W.setFocus = function (points) {
    for (let i = 0; i < 8; i++) {
      const p = points[i];
      if (p) this.focus[i].set(p.x, p.y, p.z, p.r || 3.2);
      else this.focus[i].set(0, -1000, 0, 0);
    }
  };

  PTMT.World = World;
  PTMT.worldConst = { MAP_W, MAP_H, GROUND, WATER_Y };
})();
