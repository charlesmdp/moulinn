// « Pas touche à mes trésors » — cases de construction, grille, forêts à couper, portes d'entrée et
// halos des réserves (méthodes ajoutées au domaine 3D, PTMT.World).
//
//  - Dalles : une dalle par case libre, dessinée selon son sol (rocaille aux braises, givre à
//    runes, berge moussue à flaque), en trois lots instanciés.
//  - Grille : en mode construction, les cases de la famille choisie s'allument (libres, boisées,
//    survolée) ; les autres restent à peine visibles.
//  - Forêts : trois ou quatre arbres serrés par case boisée ; pendant la coupe ils tremblent sous
//    les coups de hache (copeaux), puis tombent et laissent des souches.
//  - Portes : piliers, linteau, panneau et fanion à la couleur de l'entrée ; une flèche pulsée au
//    sol quand la prochaine vague passe par là. Les sorties ont un simple poteau indicateur.
//  - Réserves : disque doré et colonne de lumière douce au-dessus du coffre.
(function () {
  "use strict";
  const PTMT = globalThis.PTMT;
  if (!PTMT || typeof THREE === "undefined" || !PTMT.World) return;
  const W = PTMT.World.prototype;
  const U = PTMT.U;
  const G = PTMT.geom;
  const FAMILY = { fire: "#ff8a3d", ice: "#8fe6ff", water: "#3fb8ff" };
  const TILE_FILL = 0.92; // demi-largeur d'une dalle (U) : de fins joints entre les cases

  // ── Textures des dalles (canvas, une fois pour toutes) ─────────────────────────
  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }
  function slabCanvases(kind) {
    const N = 256;
    const cv = document.createElement("canvas");
    cv.width = cv.height = N;
    const c = cv.getContext("2d");
    const em = document.createElement("canvas");
    em.width = em.height = N;
    const e = em.getContext("2d");
    e.fillStyle = "#000";
    e.fillRect(0, 0, N, N);
    const rnd = PTMT.rng(kind === "fire" ? 11 : kind === "ice" ? 23 : 37);
    const m = 10,
      R = 34;
    const pal = {
      fire: ["#b86a40", "#93502e", "#6a3620"],
      ice: ["#c4e3f5", "#8dc0e2", "#4f86b3"],
      water: ["#88a070", "#627c52", "#3f5636"],
    }[kind];
    // Corps de la dalle : dégradé, biseau clair en haut à gauche, sombre en bas à droite.
    roundRect(c, m, m, N - 2 * m, N - 2 * m, R);
    const gr = c.createLinearGradient(0, 0, N, N);
    gr.addColorStop(0, pal[0]);
    gr.addColorStop(1, pal[1]);
    c.fillStyle = gr;
    c.fill();
    c.save();
    c.clip();
    if (kind === "fire") {
      // Dalles de pierre irrégulières, joints sombres, fissures de braise.
      c.strokeStyle = pal[2];
      c.lineWidth = 5;
      c.beginPath();
      c.moveTo(m, 118);
      c.lineTo(96, 126);
      c.lineTo(132, 96);
      c.lineTo(N - m, 110);
      c.moveTo(96, 126);
      c.lineTo(110, N - m);
      c.moveTo(132, 96);
      c.lineTo(122, m);
      c.moveTo(150, 170);
      c.lineTo(N - m, 176);
      c.moveTo(150, 170);
      c.lineTo(110, 200);
      c.stroke();
      for (let i = 0; i < 40; i++) {
        c.fillStyle = rnd() < 0.5 ? "rgba(255,210,160,0.18)" : "rgba(60,25,10,0.18)";
        c.beginPath();
        c.arc(rnd() * N, rnd() * N, 2 + rnd() * 6, 0, Math.PI * 2);
        c.fill();
      }
      e.strokeStyle = "#ff7a1f";
      e.lineWidth = 3;
      e.shadowColor = "#ffb347";
      e.shadowBlur = 8;
      e.beginPath();
      e.moveTo(40, 60);
      e.lineTo(70, 82);
      e.lineTo(62, 104);
      e.moveTo(190, 150);
      e.lineTo(206, 190);
      e.moveTo(128, 128);
      e.lineTo(150, 142);
      e.stroke();
      // Emblème : petite flamme gravée.
      c.fillStyle = "rgba(255,196,120,0.38)";
      c.beginPath();
      c.moveTo(128, 88);
      c.bezierCurveTo(150, 120, 160, 136, 128, 170);
      c.bezierCurveTo(96, 136, 106, 120, 128, 88);
      c.fill();
    } else if (kind === "ice") {
      // Cercle de runes gravé, cristaux de givre.
      c.strokeStyle = "rgba(255,255,255,0.85)";
      c.lineWidth = 4;
      c.beginPath();
      c.arc(128, 128, 78, 0, Math.PI * 2);
      c.stroke();
      c.lineWidth = 2;
      c.beginPath();
      c.arc(128, 128, 62, 0, Math.PI * 2);
      c.stroke();
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        c.beginPath();
        c.moveTo(128 + Math.cos(a) * 64, 128 + Math.sin(a) * 64);
        c.lineTo(128 + Math.cos(a) * 76, 128 + Math.sin(a) * 76);
        c.stroke();
      }
      c.lineWidth = 3;
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI;
        c.beginPath();
        c.moveTo(128 - Math.cos(a) * 34, 128 - Math.sin(a) * 34);
        c.lineTo(128 + Math.cos(a) * 34, 128 + Math.sin(a) * 34);
        c.stroke();
      }
      for (let i = 0; i < 30; i++) {
        c.fillStyle = "rgba(255,255,255," + (0.2 + rnd() * 0.4) + ")";
        c.beginPath();
        c.arc(rnd() * N, rnd() * N, 1 + rnd() * 4, 0, Math.PI * 2);
        c.fill();
      }
      e.strokeStyle = "#7fe8ff";
      e.lineWidth = 3;
      e.shadowColor = "#bff6ff";
      e.shadowBlur = 10;
      e.beginPath();
      e.arc(128, 128, 78, 0, Math.PI * 2);
      e.stroke();
    } else {
      // Pierre moussue, flaque au centre, touffes de joncs.
      for (let i = 0; i < 26; i++) {
        c.fillStyle = rnd() < 0.5 ? "rgba(160,190,110,0.35)" : "rgba(40,60,30,0.25)";
        c.beginPath();
        c.arc(rnd() * N, rnd() * N, 4 + rnd() * 10, 0, Math.PI * 2);
        c.fill();
      }
      c.fillStyle = "rgba(40,58,40,0.6)";
      c.beginPath();
      c.ellipse(128, 132, 64, 46, 0.2, 0, Math.PI * 2);
      c.fill();
      const pg = c.createRadialGradient(120, 124, 6, 128, 132, 58);
      pg.addColorStop(0, "#9fd6ea");
      pg.addColorStop(1, "#3f86a8");
      c.fillStyle = pg;
      c.beginPath();
      c.ellipse(128, 132, 56, 38, 0.2, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = "rgba(255,255,255,0.6)";
      c.lineWidth = 3;
      c.beginPath();
      c.ellipse(128, 132, 34, 22, 0.2, 0, Math.PI * 2);
      c.stroke();
      c.strokeStyle = "#35532a";
      c.lineWidth = 4;
      for (const [x, y] of [
        [40, 60],
        [210, 70],
        [52, 206],
        [206, 200],
      ])
        for (let k = 0; k < 4; k++) {
          c.beginPath();
          c.moveTo(x, y);
          c.lineTo(x + (rnd() - 0.5) * 28, y - 16 - rnd() * 16);
          c.stroke();
        }
    }
    c.restore();
    roundRect(c, m + 2, m + 2, N - 2 * m - 4, N - 2 * m - 4, R - 2);
    c.lineWidth = 5;
    c.strokeStyle = "rgba(255,255,255,0.28)";
    c.stroke();
    roundRect(c, m, m, N - 2 * m, N - 2 * m, R);
    c.lineWidth = 3;
    c.strokeStyle = "rgba(0,0,0,0.35)";
    c.stroke();
    return { color: cv, emissive: em };
  }
  function slabMaterial(kind) {
    return PTMT.mat("td:slab:" + kind, () => {
      const cvs = slabCanvases(kind);
      const map = new THREE.CanvasTexture(cvs.color);
      map.encoding = THREE.sRGBEncoding;
      map.anisotropy = 4;
      const em = new THREE.CanvasTexture(cvs.emissive);
      em.encoding = THREE.sRGBEncoding;
      const mat = new THREE.MeshStandardMaterial({
        map,
        emissiveMap: em,
        emissive: new THREE.Color(kind === "water" ? 0x000000 : 0xffffff),
        emissiveIntensity: kind === "fire" ? 0.9 : 0.55,
        roughness: kind === "ice" ? 0.5 : 0.92,
        metalness: 0,
        alphaTest: 0.5,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      });
      return mat;
    });
  }

  // ── Dalles et grille ─────────────────────────────────────────────────────────
  const dummy = new THREE.Object3D();
  W.tileY = function (s) {
    const lv = this.tileLevel ? this.tileLevel(s) : undefined;
    return lv !== undefined ? lv : this.heightU(s.x, s.z);
  };
  W.buildTiles = function (L) {
    this.slabs = {};
    this.tileIndex = new Map(); // id → { kind, slab index, grid index }
    const geo = PTMT.geo("td:slabGeo", () => {
      const g = new THREE.PlaneGeometry(TILE_FILL * 2 * U, TILE_FILL * 2 * U);
      g.rotateX(-Math.PI / 2);
      return g;
    });
    for (const kind of ["fire", "ice", "water"]) {
      const list = L.sockets.filter((s) => s.kind === kind);
      if (!list.length) continue;
      const mesh = new THREE.InstancedMesh(geo, slabMaterial(kind), list.length);
      mesh.userData.shared = true;
      mesh.name = "Dalles_" + kind;
      mesh.receiveShadow = true;
      mesh.renderOrder = 1;
      list.forEach((s, i) => {
        this.tileIndex.set(s.id, { kind, slab: i });
        dummy.position.copy(this.toWorld(s.x, s.z, this.tileY(s) + 0.03));
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(s.forest ? 0.0001 : 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      this.root.add(mesh);
      this.slabs[kind] = mesh;
    }
    this.buildGrid(L);
  };
  /** Montre ou cache la dalle d'une case (cachée sous une forêt). */
  W.setSlabVisible = function (id, visible) {
    const t = this.tileIndex && this.tileIndex.get(id);
    if (!t) return;
    const s = this.L.sockets.find((q) => q.id === id);
    const mesh = this.slabs[t.kind];
    dummy.position.copy(this.toWorld(s.x, s.z, this.tileY(s) + 0.03));
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(visible ? 1 : 0.0001);
    dummy.updateMatrix();
    mesh.setMatrixAt(t.slab, dummy.matrix);
    mesh.instanceMatrix.needsUpdate = true;
  };
  W.buildGrid = function (L) {
    const n = L.sockets.length;
    const geo = new THREE.InstancedBufferGeometry();
    const base = new THREE.PlaneGeometry(1, 1);
    base.rotateX(-Math.PI / 2);
    geo.index = base.index;
    geo.attributes.position = base.attributes.position;
    geo.attributes.uv = base.attributes.uv;
    const center = new Float32Array(n * 3);
    L.sockets.forEach((s, i) => {
      const p = this.toWorld(s.x, s.z, this.tileY(s) + 0.12);
      center[i * 3] = p.x;
      center[i * 3 + 1] = p.y;
      center[i * 3 + 2] = p.z;
      const t = this.tileIndex.get(s.id);
      if (t) t.grid = i;
    });
    geo.setAttribute("aCenter", new THREE.InstancedBufferAttribute(center, 3));
    this.gridState = new THREE.InstancedBufferAttribute(new Float32Array(n), 1);
    this.gridColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
    this.gridState.setUsage(THREE.DynamicDrawUsage);
    this.gridColor.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute("aState", this.gridState);
    geo.setAttribute("aColor", this.gridColor);
    geo.instanceCount = n;
    this.gridUniforms = { uTime: { value: 0 }, uSize: { value: 2 * U } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.gridUniforms,
      transparent: true,
      depthWrite: false,
      // Au-dessus des dalles (elles-mêmes décalées vers la caméra pour ne pas scintiller avec le sol).
      polygonOffset: true,
      polygonOffsetFactor: -6,
      polygonOffsetUnits: -6,
      vertexShader: `attribute vec3 aCenter; attribute float aState; attribute vec3 aColor;
        uniform float uSize; varying vec2 vUv; varying float vState; varying vec3 vColor;
        void main(){ vUv = uv; vState = aState; vColor = aColor;
          if (aState < 0.5) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
          vec3 p = aCenter + position * uSize;
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); }`,
      fragmentShader: `uniform float uTime; varying vec2 vUv; varying float vState; varying vec3 vColor;
        float box(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
        void main(){
          vec2 p = vUv * 2.0 - 1.0;
          float d = box(p, vec2(0.9), 0.22);
          if (d > 0.04) discard;
          float edge = 1.0 - smoothstep(0.0, 0.05, abs(d + 0.035));
          float inside = 1.0 - smoothstep(-0.02, 0.02, d);
          float pulse = 0.5 + 0.5 * sin(uTime * 4.0);
          float fillA = 0.0, edgeA = 0.0;
          vec3 col = vColor;
          if (vState < 1.5) { fillA = 0.2 + 0.12 * pulse; edgeA = 0.95; }            // libre, bonne famille
          else if (vState < 2.5) { fillA = 0.55; edgeA = 1.0; col = mix(col, vec3(1.0), 0.45); } // survolée
          else if (vState < 3.5) { fillA = 0.14; edgeA = 0.7; float h = step(0.5, fract((p.x + p.y) * 3.0)); fillA += h * 0.1; } // boisée
          else if (vState < 4.5) { fillA = 0.0; edgeA = 0.2; }                         // autre sol
          else { fillA = 0.3 * pulse; edgeA = 0.8; }                                   // coupe en cours
          float a = max(inside * fillA, edge * edgeA);
          gl_FragColor = vec4(col, a);
          #include <encodings_fragment>
        }`,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 6;
    mesh.visible = false;
    mesh.name = "Grille";
    this.root.add(mesh);
    this.grid = mesh;
    this.gridSig = "";
  };
  /**
   * Grille de construction. mode : null (cachée) ou { family } ; hover : identifiant de la case
   * survolée. info(id) → "free" | "forest" | "cutting" | "occupied".
   */
  W.setGrid = function (mode, hover, info) {
    if (!this.grid) return;
    if (!mode) {
      this.grid.visible = false;
      this.gridSig = "";
      return;
    }
    const L = this.L;
    let sig = mode.family + "|" + hover + "|";
    const states = L.sockets.map((s) => info(s.id));
    sig += states.join("");
    this.grid.visible = true;
    if (sig === this.gridSig) return;
    this.gridSig = sig;
    const col = new THREE.Color();
    const grey = PTMT.color("#fff3d6");
    const wood = PTMT.color("#c89a5a");
    L.sockets.forEach((s, i) => {
      const st = states[i];
      let code = 0;
      if (st === "occupied") code = 0;
      else if (s.kind !== mode.family) code = 4;
      else if (st === "forest") code = 3;
      else if (st === "cutting") code = 5;
      else code = s.id === hover ? 2 : 1;
      this.gridState.setX(i, code);
      col.copy(code === 3 || code === 5 ? wood : code === 4 ? grey : PTMT.color(FAMILY[s.kind]));
      this.gridColor.setXYZ(i, col.r, col.g, col.b);
    });
    this.gridState.needsUpdate = true;
    this.gridColor.needsUpdate = true;
  };

  // ── Forêts ──────────────────────────────────────────────────────────────────
  /** Sapin givré : étages de branches blanchis de neige (couleurs de sommets, balancement). */
  function snowPineGeometry(variant) {
    const parts = [];
    const rng = PTMT.rng(90 + variant);
    const push = (g, color, leaf, round) => parts.push({ g: g.index ? g.toNonIndexed() : g, color, leaf, round });
    const trunk = new THREE.CylinderGeometry(0.16, 0.26, 2.6, 7, 1);
    trunk.translate(0, 1.3, 0);
    push(trunk, "#6d4a31", false);
    for (let i = 0; i < 4; i++) {
      const y = 2.2 + i * 1.25,
        r = 2.0 - i * 0.42;
      const cone = new THREE.ConeGeometry(r, 2.0, 9, 1);
      cone.translate(0, y, 0);
      const p = cone.attributes.position;
      for (let k = 0; k < p.count; k++) {
        const s = 1 + (rng() - 0.5) * 0.16;
        p.setX(k, p.getX(k) * s);
        p.setZ(k, p.getZ(k) * s);
      }
      push(cone, i % 2 ? "#2f5a47" : "#3a6a52", true, [0, y, 0]);
      const cap = new THREE.ConeGeometry(r * 0.86, 0.9, 9, 1);
      cap.translate(0, y + 0.62, 0);
      push(cap, i % 2 ? "#eef6fb" : "#dcebf5", true, [0, y + 0.4, 0]);
    }
    let n = 0;
    for (const q of parts) n += q.g.attributes.position.count;
    const pos = new Float32Array(n * 3),
      nor = new Float32Array(n * 3),
      col = new Float32Array(n * 3),
      sway = new Float32Array(n);
    let o = 0;
    for (const q of parts) {
      q.g.computeVertexNormals();
      const P = q.g.attributes.position,
        N = q.g.attributes.normal;
      const c = PTMT.color(q.color);
      for (let i = 0; i < P.count; i++) {
        pos[(o + i) * 3] = P.getX(i);
        pos[(o + i) * 3 + 1] = P.getY(i);
        pos[(o + i) * 3 + 2] = P.getZ(i);
        let nx = N.getX(i),
          ny = N.getY(i),
          nz = N.getZ(i);
        if (q.round) {
          const rx = P.getX(i) - q.round[0],
            ry = P.getY(i) - q.round[1],
            rz = P.getZ(i) - q.round[2];
          const l = Math.hypot(rx, ry, rz) || 1;
          nx = nx * 0.4 + (rx / l) * 0.6;
          ny = ny * 0.4 + (ry / l) * 0.6 + 0.2;
          nz = nz * 0.4 + (rz / l) * 0.6;
          const l2 = Math.hypot(nx, ny, nz) || 1;
          nx /= l2;
          ny /= l2;
          nz /= l2;
        }
        nor[(o + i) * 3] = nx;
        nor[(o + i) * 3 + 1] = ny;
        nor[(o + i) * 3 + 2] = nz;
        col[(o + i) * 3] = c.r;
        col[(o + i) * 3 + 1] = c.g;
        col[(o + i) * 3 + 2] = c.b;
        sway[o + i] = Math.max(0, P.getY(i)) * (q.leaf ? 1 : 0.5);
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
  }
  function stumpGeometry() {
    return PTMT.geo("td:stump", () => {
      const g = new THREE.CylinderGeometry(0.2, 0.26, 0.42, 8, 1).toNonIndexed();
      g.translate(0, 0.21, 0);
      const P = g.attributes.position;
      const col = new Float32Array(P.count * 3);
      const bark = PTMT.color("#5b3d27"),
        wood = PTMT.color("#e3c28c");
      for (let i = 0; i < P.count; i++) {
        const c = P.getY(i) > 0.41 ? wood : bark;
        col[i * 3] = c.r;
        col[i * 3 + 1] = c.g;
        col[i * 3 + 2] = c.b;
      }
      g.setAttribute("color", new THREE.BufferAttribute(col, 3));
      g.computeVertexNormals();
      return g;
    });
  }
  W.buildForests = function (L) {
    this.forest = new Map();
    this.forestMeshes = [];
    const tiles = L.sockets.filter((s) => s.forest);
    if (!tiles.length) return;
    const geos = this.treeGeometries();
    this._snowPine = this._snowPine || [snowPineGeometry(0), snowPineGeometry(1)];
    const all = Object.assign({ snow: this._snowPine }, geos);
    const rng = PTMT.rng(L.seed + 77);
    // Essences par sol : pins sur la rocaille, sapins givrés sur le givre, bouleaux et chênes au bord de l'eau.
    const pick = (kind) => {
      const r = rng();
      if (kind === "fire") return r < 0.75 ? "pine" : "oak";
      if (kind === "ice") return r < 0.85 ? "snow" : "pine";
      return r < 0.55 ? "birch" : "oak";
    };
    const slots = [];
    for (const s of tiles) {
      const y = this.tileY(s);
      const list = [];
      const offs = [
        [-0.48, -0.46],
        [0.5, -0.4],
        [-0.42, 0.5],
        [0.46, 0.46],
        [0, 0],
      ];
      const n = 4 + (rng() < 0.35 ? 1 : 0);
      for (let k = 0; k < n; k++) {
        const sp = pick(s.kind);
        const v = Math.floor(rng() * all[sp].length);
        const big = sp === "oak" ? 0.42 + rng() * 0.12 : sp === "birch" ? 0.5 + rng() * 0.14 : 0.48 + rng() * 0.16;
        const x = s.x + offs[k][0] + (rng() - 0.5) * 0.25,
          z = s.z + offs[k][1] + (rng() - 0.5) * 0.25;
        const slot = { tile: s.id, sp, v, x, z, y: y - 0.05, s: big * (k === 4 ? 0.85 : 1), r: rng() * 6.28, phase: rng() * 6.28 };
        list.push(slot);
        slots.push(slot);
      }
      this.forest.set(s.id, { id: s.id, tile: s, slots: list, state: "forest", fallT: 0, chop: 0, dir: rng() * 6.28 });
    }
    // Lots instanciés par essence et variante.
    const mat = this.treeMaterial();
    const byKey = new Map();
    for (const sl of slots) {
      const key = sl.sp + ":" + sl.v;
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(sl);
    }
    for (const [key, list] of byKey) {
      const [sp, v] = key.split(":");
      const mesh = new THREE.InstancedMesh(all[sp][Number(v)], mat, list.length);
      mesh.userData.shared = true;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.name = "Foret_" + key;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      list.forEach((sl, i) => {
        sl.mesh = mesh;
        sl.index = i;
      });
      this.root.add(mesh);
      this.forestMeshes.push(mesh);
    }
    // Souches (cachées tant que la forêt est debout).
    const stumpMat = PTMT.mat("td:stumpMat", () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }));
    const stumps = new THREE.InstancedMesh(stumpGeometry(), stumpMat, slots.length);
    stumps.userData.shared = true;
    stumps.castShadow = true;
    stumps.name = "Souches";
    slots.forEach((sl, i) => (sl.stump = i));
    this.stumps = stumps;
    this.root.add(stumps);
    for (const f of this.forest.values()) this.placeForest(f, 0);
    for (const m of this.forestMeshes) m.instanceMatrix.needsUpdate = true;
    stumps.instanceMatrix.needsUpdate = true;
  };
  const _q = new THREE.Quaternion(),
    _axis = new THREE.Vector3(),
    _m = new THREE.Matrix4(),
    _p = new THREE.Vector3(),
    _s = new THREE.Vector3(),
    _q2 = new THREE.Quaternion(),
    _up = new THREE.Vector3(0, 1, 0);
  /** Pose les arbres et souches d'une case boisée selon son état (debout, coupe, chute, coupée). */
  W.placeForest = function (f, time) {
    const standing = f.state === "forest" || f.state === "cutting";
    const falling = f.state === "falling";
    const k = falling ? Math.min(1, f.fallT / 0.75) : 0;
    const fallAngle = falling ? (k * k * (3 - 2 * k)) * 1.45 : 0;
    const shrink = falling ? Math.max(0, 1 - Math.max(0, f.fallT - 1.05) / 0.35) : 1;
    for (const sl of f.slots) {
      const w = this.toWorld(sl.x, sl.z, sl.y, _p);
      let s = sl.s;
      _q.setFromAxisAngle(_up, sl.r);
      if (f.state === "cutting") {
        // Tremblement sous les coups de hache.
        const a = Math.sin(time * 38 + sl.phase) * 0.05 * f.chop;
        _axis.set(Math.cos(sl.phase), 0, Math.sin(sl.phase));
        _q2.setFromAxisAngle(_axis, a);
        _q.premultiply(_q2);
      } else if (falling) {
        _axis.set(Math.cos(f.dir + sl.phase * 0.15), 0, Math.sin(f.dir + sl.phase * 0.15));
        _q2.setFromAxisAngle(_axis, fallAngle);
        _q.premultiply(_q2);
        s *= shrink;
      } else if (!standing) s = 0.0001;
      _s.setScalar(Math.max(0.0001, s));
      _m.compose(w, _q, _s);
      sl.mesh.setMatrixAt(sl.index, _m);
      sl.mesh.instanceMatrix.needsUpdate = true;
      // Souche : visible dès que l'arbre est tombé.
      const showStump = f.state === "cleared" || (falling && k >= 1);
      _q.setFromAxisAngle(_up, sl.r);
      _s.setScalar(showStump ? sl.s * 1.6 : 0.0001);
      _m.compose(w, _q, _s);
      this.stumps.setMatrixAt(sl.stump, _m);
      this.stumps.instanceMatrix.needsUpdate = true;
    }
  };
  /** Accorde les forêts à l'état du jeu (au chargement d'une partie : sans animation). */
  W.syncForests = function (game, animate) {
    if (!this.forest) return;
    for (const f of this.forest.values()) {
      const isForest = game.isForest(f.id);
      const cutting = isForest && game.cutProgress(f.id) !== null;
      let want = isForest ? (cutting ? "cutting" : "forest") : "cleared";
      if (want === "cleared" && f.state !== "cleared" && f.state !== "falling") {
        if (animate) {
          f.state = "falling";
          f.fallT = 0;
          f.impact = false;
        } else {
          f.state = "cleared";
          this.setSlabVisible(f.id, true);
        }
        this.placeForest(f, 0);
      } else if (want !== "cleared" && f.state !== want) {
        f.state = want;
        if (want === "forest") this.setSlabVisible(f.id, false);
        this.placeForest(f, 0);
      }
    }
  };
  W.updateForests = function (dt, time, game) {
    if (!this.forest || !game) return;
    const fx = PTMT.fx && PTMT.fx._ && PTMT.fx._.S ? PTMT.fx._ : null;
    for (const f of this.forest.values()) {
      if (f.state === "cutting") {
        const p = game.cutProgress(f.id);
        if (p === null) continue;
        // Un coup de hache toutes les 0,45 s : les arbres frémissent, des copeaux volent.
        const beat = Math.floor((time * 1000) / 450);
        if (beat !== f.beat && dt > 0) {
          f.beat = beat;
          f.chop = 1;
          if (fx) this.woodChips(f, 5);
        }
        f.chop = Math.max(0, f.chop - dt * 3.2);
        this.placeForest(f, time);
      } else if (f.state === "falling") {
        f.fallT += dt;
        if (!f.impact && f.fallT >= 0.75) {
          f.impact = true;
          if (fx) {
            this.woodChips(f, 14);
            const c = this.toWorld(f.tile.x, f.tile.z, this.tileY(f.tile) + 0.2);
            try {
              PTMT.fx.burst("smoke", c, { radius: 1.3 });
              for (const sl of f.slots) PTMT.fx.burst("smoke", this.toWorld(sl.x + Math.cos(f.dir) * 1.4, sl.z + Math.sin(f.dir) * 1.4, sl.y + 0.3), { radius: 0.6 });
            } catch (e) {}
          }
        }
        this.placeForest(f, time);
        if (f.fallT > 1.45) {
          f.state = "cleared";
          this.setSlabVisible(f.id, true);
          this.placeForest(f, time);
          if (fx) {
            try {
              PTMT.fx.burst("sparkle", this.toWorld(f.tile.x, f.tile.z, this.tileY(f.tile) + 0.2), { color: FAMILY[f.tile.kind], radius: 1.1 });
            } catch (e) {}
          }
        }
      }
    }
  };
  /** Copeaux et feuilles projetés au pied des arbres (particules des effets). */
  W.woodChips = function (f, n) {
    const _ = PTMT.fx._;
    const C = PTMT.gfx && PTMT.gfx.CELL;
    if (!_ || !_.emit || !C) return;
    const leaf = f.tile.kind === "ice" ? [0.92, 0.96, 1] : [0.3, 0.52, 0.2];
    for (let i = 0; i < n; i++) {
      const sl = f.slots[i % f.slots.length];
      const w = this.toWorld(sl.x, sl.z, sl.y + 0.4 + Math.random() * 0.5, _p);
      const a = Math.random() * Math.PI * 2,
        sp = 1.5 + Math.random() * 2.5;
      const chip = i % 3 !== 2;
      _.emit({
        x: w.x,
        y: w.y,
        z: w.z,
        vx: Math.cos(a) * sp,
        vy: 2 + Math.random() * 3,
        vz: Math.sin(a) * sp,
        grav: 11,
        drag: 0.6,
        life: 0.6 + Math.random() * 0.5,
        s0: chip ? 0.16 : 0.22,
        s1: chip ? 0.1 : 0.16,
        cell: chip ? C.shard : C.leaf,
        r: chip ? 0.86 : leaf[0],
        g: chip ? 0.64 : leaf[1],
        b: chip ? 0.36 : leaf[2],
        a: 1,
        a1: 0.6,
        rot: Math.random() * 6,
        spin: (Math.random() - 0.5) * 14,
        floor: sl.y + 0.02,
      });
    }
  };

  // ── Portes d'entrée et de sortie ─────────────────────────────────────────────────
  function colorMat(hex, glow) {
    return PTMT.mat("td:gateCol:" + hex + ":" + (glow || 0), () => new THREE.MeshStandardMaterial({ color: PTMT.color(hex), emissive: PTMT.color(hex), emissiveIntensity: glow || 0.15, roughness: 0.6 }));
  }
  function arrowShape() {
    const s = new THREE.Shape();
    s.moveTo(0, 1);
    s.lineTo(0.9, 0);
    s.lineTo(0.42, 0);
    s.lineTo(0.42, -0.9);
    s.lineTo(-0.42, -0.9);
    s.lineTo(-0.42, 0);
    s.lineTo(-0.9, 0);
    s.closePath();
    return s;
  }
  W.buildGates = function (L) {
    this.gates = new Map();
    const stone = PTMT.mat("td:gateStone", () => new THREE.MeshStandardMaterial({ color: PTMT.color("#b3a58e"), map: this.textures.stone || null, roughness: 0.9 }));
    const wood = PTMT.mat("td:gateWood", () => new THREE.MeshStandardMaterial({ color: PTMT.color("#7a5634"), map: this.textures.wood || null, roughness: 0.85 }));
    const dark = PTMT.solid("#4a3522");
    const arrowGeo = PTMT.geo("td:gateArrow", () => {
      const g = new THREE.ShapeGeometry(arrowShape());
      g.rotateX(-Math.PI / 2);
      return g;
    });
    for (const gt of L.gates) {
      // La porte se tient un peu à l'intérieur de la carte, sur le chemin.
      const inset = gt.kind === "water" ? 2.2 : 1.8;
      const x = Math.max(0.6, Math.min(63.4, gt.x + gt.dx * inset)),
        z = Math.max(0.6, Math.min(43.4, gt.z + gt.dz * inset));
      const y = gt.kind === "water" ? 0 : this.heightU(x, z);
      const grp = new THREE.Group();
      grp.position.copy(this.toWorld(x, z, y));
      grp.rotation.y = Math.atan2(gt.dx, gt.dz);
      grp.name = "Porte_" + gt.node;
      const add = (geo, mat, px, py, pz, ry = 0) => {
        const m = new THREE.Mesh(geo, mat);
        m.position.set(px, py, pz);
        m.rotation.y = ry;
        m.castShadow = true;
        m.receiveShadow = true;
        grp.add(m);
        return m;
      };
      const half = 1.35 * U; // demi-largeur du passage (m)
      let flag = null,
        board = null;
      if (gt.kind === "water") {
        for (const sx of [-1, 1]) {
          add(new THREE.CylinderGeometry(0.14, 0.18, 2.6, 7), wood, sx * half, 0.5, 0);
          add(new THREE.SphereGeometry(0.34, 12, 8), colorMat(gt.color, 0.25), sx * half * 0.55, 0.1, 0);
        }
        add(new THREE.BoxGeometry(half * 2, 0.06, 0.06), dark, 0, 1.55, 0);
        flag = add(new THREE.PlaneGeometry(1.1, 0.7), colorMat(gt.color, 0.35), half + 0.55, 1.5, 0);
        flag.material.side = THREE.DoubleSide;
      } else if (gt.entry) {
        for (const sx of [-1, 1]) {
          add(new THREE.BoxGeometry(0.7, 2.6, 0.7), stone, sx * half, 1.3, 0);
          add(new THREE.BoxGeometry(0.86, 0.22, 0.86), stone, sx * half, 2.68, 0);
        }
        add(new THREE.BoxGeometry(half * 2 + 0.9, 0.32, 0.36), wood, 0, 2.95, 0);
        add(new THREE.BoxGeometry(half * 2 + 1.3, 0.12, 0.8), dark, 0, 3.16, 0);
        board = add(new THREE.BoxGeometry(2.2, 0.62, 0.1), colorMat(gt.color, 0.3), 0, 2.45, 0.05);
        add(new THREE.CylinderGeometry(0.05, 0.05, 2.0, 5), dark, half, 3.9, 0);
        flag = add(new THREE.PlaneGeometry(1.2, 0.75), colorMat(gt.color, 0.35), half + 0.62, 4.45, 0);
        flag.material.side = THREE.DoubleSide;
      } else {
        // Sortie : poteau indicateur à flèche.
        add(new THREE.CylinderGeometry(0.1, 0.12, 2.6, 6), wood, half + 0.6, 1.3, 0);
        board = add(new THREE.BoxGeometry(1.5, 0.42, 0.08), PTMT.solid("#d8c9a0"), half + 0.6, 2.2, 0.08, Math.PI / 2);
        add(new THREE.ConeGeometry(0.3, 0.45, 3), PTMT.solid("#d8c9a0"), half + 0.6, 2.2, -0.85).rotation.set(-Math.PI / 2, 0, 0);
      }
      // Flèche pulsée au sol (prochaine vague) : visible seulement quand la porte est active.
      const arrowMat = new THREE.MeshBasicMaterial({ color: PTMT.color(gt.color), transparent: true, opacity: 0.8, depthWrite: false });
      const arrows = new THREE.Group();
      for (let k = 0; k < 2; k++) {
        const a = new THREE.Mesh(arrowGeo, arrowMat);
        a.scale.setScalar(1.35);
        a.renderOrder = 5;
        a.position.set(0, 0.18, 2.2 + k * 2.4);
        a.userData.shared = true;
        arrows.add(a);
      }
      arrows.visible = false;
      grp.add(arrows);
      this.root.add(grp);
      this.gates.set(gt.node, { gate: gt, group: grp, flag, board, arrows, arrowMat, active: false, x, z, y });
    }
  };
  /** Portes empruntées par la prochaine vague : [node…]. */
  W.setActiveGates = function (nodes) {
    if (!this.gates) return;
    const set = new Set(nodes || []);
    for (const [node, g] of this.gates) {
      g.active = set.has(node);
      g.arrows.visible = g.active;
    }
  };
  /** Point au-dessus d'une porte (pour les étiquettes de l'interface). */
  W.gateAnchor = function (node, out) {
    const g = this.gates && this.gates.get(node);
    if (!g) return null;
    out = out || new THREE.Vector3();
    return out.set(g.group.position.x, g.group.position.y + (g.gate.kind === "water" ? 2.4 : 5.2), g.group.position.z);
  };

  // ── Halos des réserves ────────────────────────────────────────────────────────
  function glowTexture() {
    return PTMT.mat("td:glowTexHolder", () => {
      const cv = document.createElement("canvas");
      cv.width = cv.height = 128;
      const c = cv.getContext("2d");
      const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, "rgba(255,236,150,1)");
      g.addColorStop(0.45, "rgba(255,200,70,0.55)");
      g.addColorStop(1, "rgba(255,180,40,0)");
      c.fillStyle = g;
      c.fillRect(0, 0, 128, 128);
      c.strokeStyle = "rgba(255,240,180,0.9)";
      c.lineWidth = 3;
      c.setLineDash([10, 8]);
      c.beginPath();
      c.arc(64, 64, 50, 0, Math.PI * 2);
      c.stroke();
      const m = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      return m;
    });
  }
  W.buildReserveGlow = function (L) {
    this.glows = new Map();
    const discMat = glowTexture();
    const beamMat = PTMT.mat("td:beamMat", () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uColor: { value: PTMT.color("#ffd35a") } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
        fragmentShader:
          "uniform float uTime; uniform vec3 uColor; varying vec2 vUv; void main(){ float a = pow(1.0 - vUv.y, 1.6) * (0.28 + 0.1 * sin(uTime * 2.0 + vUv.x * 12.566)); gl_FragColor = vec4(uColor * a, a);\n#include <encodings_fragment>\n}",
      }),
    );
    this.beamMat = beamMat;
    for (const r of L.reserves) {
      const y = this.heightU(r.pos[0], r.pos[1]);
      const disc = new THREE.Mesh(PTMT.geo("td:glowDisc", () => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)), discMat);
      disc.userData.shared = true;
      disc.scale.setScalar(4.2 * U * 0.55);
      disc.position.copy(this.toWorld(r.pos[0], r.pos[1], y + 0.1));
      disc.renderOrder = 3;
      const beam = new THREE.Mesh(PTMT.geo("td:glowBeam", () => new THREE.CylinderGeometry(1.0, 1.5, 7, 20, 1, true).translate(0, 3.5, 0)), beamMat);
      beam.userData.shared = true;
      beam.position.copy(this.toWorld(r.pos[0], r.pos[1], y));
      beam.renderOrder = 3;
      this.root.add(disc, beam);
      this.glows.set(r.id, { disc, beam, level: 1 });
    }
  };
  /** Éclat d'une réserve : 1 pleine, 0 vide (le halo s'éteint). */
  W.setReserveGlow = function (id, level, alarm) {
    const g = this.glows && this.glows.get(id);
    if (!g) return;
    g.level = level;
    g.alarm = !!alarm;
  };

  // ── Animation ─────────────────────────────────────────────────────────────────
  W.updateCases = function (dt, time) {
    if (this.gridUniforms) this.gridUniforms.uTime.value = time;
    if (this.beamMat) this.beamMat.uniforms.uTime.value = time;
    if (this.glows)
      for (const g of this.glows.values()) {
        const k = g.level;
        g.disc.visible = k > 0.01;
        g.beam.visible = k > 0.01;
        g.disc.rotation.y = time * 0.3;
        const pulse = g.alarm ? 1 + 0.25 * Math.sin(time * 12) : 1 + 0.05 * Math.sin(time * 2);
        g.disc.scale.setScalar(4.2 * U * 0.55 * (0.6 + 0.4 * k) * pulse);
        g.beam.scale.set(0.6 + 0.4 * k, 0.5 + 0.5 * k, 0.6 + 0.4 * k);
      }
    if (this.gates)
      for (const g of this.gates.values()) {
        if (g.flag) g.flag.rotation.y = Math.sin(time * 3 + g.x) * 0.35;
        if (g.active) {
          const t = (time * 1.4) % 1;
          g.arrows.children.forEach((a, k) => {
            a.position.z = 1.6 + k * 2.3 + t * 1.2;
            a.material.opacity = 0.55 + 0.4 * Math.sin(time * 5 + k);
          });
        }
      }
    if (this.game) this.updateForests(dt, time, this.game);
  };
})();
