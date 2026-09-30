// « Pas touche à mes trésors » — états visibles des ennemis, dessinés en lots partagés.
//
// Tous les ennemis écrivent dans les mêmes lots : sprites posés (flammes, étoiles, ombres, icônes),
// particules simulées sur le GPU (fumée, gouttes, notes de biniou, crêpes, éclats de bulle, ronds dans
// l'eau), glaçons et bulles de barrière instanciés. Quatre appels de dessin au total, quel que soit le
// nombre d'ennemis. La planche de sprites est une copie de la planche commune (PTMT.gfx.atlas) à
// laquelle on ajoute nos propres cases (48 à 63) : notes, crêpe, croix de soin, désarmé, plume,
// fumigène, écusson, éclat, panique. Le groupe PTMT.actors.overlay.root s'ajoute tout seul à la scène
// du premier ennemi mis à jour (on peut aussi l'ajouter soi-même).
(function () {
  "use strict";
  if (typeof THREE === "undefined") return; // rendu seulement : sans three.js (banc de simulation), rien à enregistrer
  const PTMT = (globalThis.PTMT = globalThis.PTMT || {});
  const A = (PTMT.actors = PTMT.actors || {});
  const ov = (A.overlay = A.overlay || {});
  let C = null; // cases de la planche
  let now = null, fx = null, ice = null, bubble = null, root = null, mat = null;
  let lastTime = -Infinity;
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3();
  const v1 = new THREE.Vector3(), v2 = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  ov.blobShadows = true;
  ov.mobile = false;

  // --- instances « immédiates » (réécrites à chaque image) -----------------------------------
  class Inst {
    constructor(geo, material, cap, name, fade) {
      this.cap = cap;
      if (fade) {
        this.fade = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1);
        this.fade.setUsage(THREE.DynamicDrawUsage);
        geo.setAttribute("iFade", this.fade);
      }
      this.mesh = new THREE.InstancedMesh(geo, material, cap);
      this.mesh.name = name;
      this.mesh.count = 0;
      this.mesh.frustumCulled = false;
      this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.cursor = 0;
      this.rendered = true;
      // vidé à la première écriture qui suit un rendu, conservé tant que personne n'écrit (pause)
      this.mesh.onBeforeRender = () => { this.rendered = true; };
    }
    push(m, f) {
      if (this.rendered) { this.rendered = false; this.cursor = 0; this.mesh.count = 0; }
      if (this.cursor >= this.cap) return -1;
      const i = this.cursor++;
      this.mesh.setMatrixAt(i, m);
      if (this.fade) { this.fade.array[i] = f === undefined ? 1 : f; this.fade.needsUpdate = true; }
      this.mesh.count = this.cursor;
      this.mesh.instanceMatrix.needsUpdate = true;
      return i;
    }
    clear() { this.cursor = 0; this.mesh.count = 0; }
  }

  function iceMaterial() {
    return new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      transparent: true,
      depthWrite: false,
      vertexShader: /* glsl */ `
        varying vec3 vN; varying vec3 vW; varying vec3 vL;
        void main(){
          vec4 lp = vec4(position, 1.0);
          mat4 im = mat4(1.0);
          #ifdef USE_INSTANCING
            im = instanceMatrix;
          #endif
          vec4 wp = modelMatrix * im * lp;
          vN = normalize(mat3(modelMatrix * im) * normal);
          vW = wp.xyz; vL = position;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        varying vec3 vN; varying vec3 vW; varying vec3 vL;
        ${PTMT.gfx.GLSL.noise}
        void main(){
          vec3 N = normalize(vN);
          vec3 V = normalize(cameraPosition - vW);
          vec3 L = normalize(vec3(0.35, 0.85, 0.4));
          float fres = pow(1.0 - abs(dot(N, V)), 2.0);
          float diff = max(dot(N, L), 0.0);
          vec3 a = abs(vL) * 2.0;
          float e1 = min(a.x, a.y), e2 = min(a.y, a.z), e3 = min(a.x, a.z);
          float edge = smoothstep(0.8, 0.97, max(max(e1, e2), e3));
          float frost = ptFbm(vL.xy * 7.0 + vL.z * 5.0);
          float streak = smoothstep(0.9, 1.0, sin((vL.x * 1.3 + vL.y) * 10.0 + vL.z * 4.0)) * (0.5 + 0.5 * frost);
          vec3 deep = vec3(0.16, 0.55, 0.92), light = vec3(0.8, 0.96, 1.0);
          vec3 col = mix(deep, light, clamp(0.25 + 0.45 * diff + 0.55 * fres + 0.3 * frost * (1.0 - vL.y - 0.5), 0.0, 1.0));
          float spec = pow(max(dot(reflect(-L, N), V), 0.0), 30.0);
          col += vec3(1.0) * (edge * 0.55 + streak * 0.7 + spec * 0.9);
          float alpha = 0.28 + 0.4 * fres + 0.45 * edge + 0.35 * streak + 0.15 * frost;
          gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.9));
          #include <tonemapping_fragment>
          #include <encodings_fragment>
        }`,
    });
  }
  /** Bulle de barrière du druide : liseré de Fresnel vert et or, feuilles de gui qui glissent. */
  function bubbleMaterial() {
    return new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      transparent: true,
      depthWrite: false,
      vertexShader: /* glsl */ `
        attribute float iFade;
        varying vec3 vN; varying vec3 vW; varying vec3 vL; varying float vFade;
        void main(){
          mat4 im = mat4(1.0);
          #ifdef USE_INSTANCING
            im = instanceMatrix;
          #endif
          vec4 wp = modelMatrix * im * vec4(position, 1.0);
          vN = normalize(mat3(modelMatrix * im) * normal);
          vW = wp.xyz; vL = position; vFade = iFade;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        varying vec3 vN; varying vec3 vW; varying vec3 vL; varying float vFade;
        ${PTMT.gfx.GLSL.noise}
        void main(){
          vec3 N = normalize(vN);
          vec3 V = normalize(cameraPosition - vW);
          float fres = pow(1.0 - abs(dot(N, V)), 2.2);
          // nervures hexagonales qui tournent lentement + reflets
          float a = atan(vL.z, vL.x) + uTime * 0.25;
          vec2 q = vec2(a * 2.6, vL.y * 5.0 + uTime * 0.15);
          q.x += floor(q.y) * 0.5;
          vec2 f = abs(fract(q) - 0.5);
          float cell = smoothstep(0.42, 0.49, max(f.x, f.y));
          float n = ptNoise(vL.xz * 3.0 + uTime * 0.4);
          vec3 green = vec3(0.3, 1.0, 0.4), gold = vec3(1.0, 0.82, 0.25);
          vec3 col = mix(green, gold, clamp(0.25 + 0.7 * n * fres + 0.45 * vL.y, 0.0, 1.0)) * 1.25;
          float pulse = 0.85 + 0.15 * sin(uTime * 3.0);
          float alpha = (0.2 + 0.95 * fres + 0.4 * cell) * pulse;
          col += vec3(1.0) * pow(max(dot(reflect(-normalize(vec3(0.3, 0.9, 0.3)), N), V), 0.0), 24.0) * 0.8;
          gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.9) * vFade);
          #include <tonemapping_fragment>
          #include <encodings_fragment>
        }`,
    });
  }

  // --- planche de sprites : copie de la planche commune + nos cases ------------------------------
  const MY = { note: 48, notes: 49, crepe: 50, plus: 51, disarm: 52, feather: 53, grenade: 54, badge: 55, shard: 56, panic: 57 };
  ov.CELLS = MY;
  const INK = "#2b1a14";
  function paintMine(ctx) {
    const cell = (i, fn) => {
      ctx.save();
      ctx.translate((i % 8) * 128, Math.floor(i / 8) * 128);
      ctx.clearRect(0, 0, 128, 128);
      ctx.beginPath(); ctx.rect(2, 2, 124, 124); ctx.clip();
      ctx.translate(4, 4); ctx.scale(120 / 128, 120 / 128);
      ctx.lineJoin = "round"; ctx.lineCap = "round";
      fn(ctx);
      ctx.restore();
    };
    const noteHead = (c, x, y) => { c.beginPath(); c.ellipse(x, y, 19, 14, -0.45, 0, Math.PI * 2); };
    // croche : remplissage blanc (teintable), contour d'encre
    cell(MY.note, (c) => {
      const draw = () => { noteHead(c, 46, 94); c.moveTo(62, 90); c.rect(59, 20, 7, 72); c.moveTo(66, 20); c.bezierCurveTo(90, 30, 104, 44, 96, 70); c.bezierCurveTo(94, 54, 82, 46, 66, 44); };
      c.strokeStyle = INK; c.lineWidth = 12; draw(); c.stroke();
      c.fillStyle = "#fff"; draw(); c.fill();
    });
    // double croche
    cell(MY.notes, (c) => {
      const draw = () => { noteHead(c, 32, 96); noteHead(c, 90, 86); c.rect(45, 26, 7, 68); c.rect(103, 16, 7, 68); c.moveTo(45, 26); c.lineTo(110, 16); c.lineTo(110, 34); c.lineTo(45, 44); c.closePath(); };
      c.strokeStyle = INK; c.lineWidth = 12; draw(); c.stroke();
      c.fillStyle = "#fff"; draw(); c.fill();
    });
    // crêpe dorée et ses taches brunes
    cell(MY.crepe, (c) => {
      c.fillStyle = "#8a4a14"; c.beginPath(); c.ellipse(64, 66, 58, 54, 0, 0, Math.PI * 2); c.fill();
      const g = c.createRadialGradient(56, 56, 6, 64, 64, 56);
      g.addColorStop(0, "#ffe7a0"); g.addColorStop(0.7, "#f2b04a"); g.addColorStop(1, "#d88a2a");
      c.fillStyle = g; c.beginPath(); c.ellipse(64, 63, 52, 49, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = "rgba(150,80,20,0.55)";
      const rnd = PTMT.rng(33);
      for (let i = 0; i < 16; i++) { const a = rnd() * 6.28, d = rnd() * 40; c.beginPath(); c.arc(64 + Math.cos(a) * d, 63 + Math.sin(a) * d, 3 + rnd() * 5, 0, Math.PI * 2); c.fill(); }
      c.strokeStyle = "rgba(255,245,200,0.8)"; c.lineWidth = 5; c.beginPath(); c.arc(64, 63, 40, -2.4, -1.2); c.stroke();
    });
    // croix de soin (blanche, teintable) au contour d'encre
    cell(MY.plus, (c) => {
      const draw = () => { c.beginPath(); c.moveTo(48, 14); c.lineTo(80, 14); c.lineTo(80, 48); c.lineTo(114, 48); c.lineTo(114, 80); c.lineTo(80, 80); c.lineTo(80, 114); c.lineTo(48, 114); c.lineTo(48, 80); c.lineTo(14, 80); c.lineTo(14, 48); c.lineTo(48, 48); c.closePath(); };
      c.strokeStyle = INK; c.lineWidth = 12; draw(); c.stroke();
      c.fillStyle = "#fff"; draw(); c.fill();
    });
    // désarmé : poing barré (cercle rouge et barre)
    cell(MY.disarm, (c) => {
      c.fillStyle = "rgba(255,255,255,0.95)"; c.beginPath(); c.arc(64, 64, 58, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#6b6f78"; c.beginPath(); c.moveTo(40, 80); c.lineTo(40, 50); c.quadraticCurveTo(64, 34, 88, 50); c.lineTo(88, 80); c.quadraticCurveTo(64, 96, 40, 80); c.fill();
      c.strokeStyle = "#e0262a"; c.lineWidth = 12; c.beginPath(); c.arc(64, 64, 48, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.moveTo(30, 98); c.lineTo(98, 30); c.stroke();
    });
    // plume (blanche, teintable)
    cell(MY.feather, (c) => {
      const draw = () => { c.beginPath(); c.moveTo(64, 8); c.bezierCurveTo(98, 34, 96, 84, 66, 114); c.bezierCurveTo(34, 84, 30, 34, 64, 8); c.closePath(); };
      c.strokeStyle = INK; c.lineWidth = 9; draw(); c.stroke();
      c.fillStyle = "#fff"; draw(); c.fill();
      c.strokeStyle = "rgba(60,40,30,0.6)"; c.lineWidth = 4; c.beginPath(); c.moveTo(64, 16); c.lineTo(66, 122); c.stroke();
    });
    // fumigène (boîte verte, goupille)
    cell(MY.grenade, (c) => {
      c.fillStyle = INK; c.beginPath(); c.roundRect ? c.roundRect(34, 34, 60, 84, 14) : c.rect(34, 34, 60, 84); c.fill();
      c.fillStyle = "#4f7a2a"; c.beginPath(); c.roundRect ? c.roundRect(40, 40, 48, 72, 10) : c.rect(40, 40, 48, 72); c.fill();
      c.fillStyle = "#d8dde3"; c.fillRect(46, 20, 36, 18); c.strokeStyle = INK; c.lineWidth = 5; c.strokeRect(46, 20, 36, 18);
      c.strokeStyle = "#d8dde3"; c.lineWidth = 6; c.beginPath(); c.arc(92, 22, 12, 0, Math.PI * 2); c.stroke();
      c.fillStyle = "#ffcf1f"; c.fillRect(40, 70, 48, 10);
    });
    // écusson doré (immunité)
    cell(MY.badge, (c) => {
      const draw = () => { c.beginPath(); c.moveTo(64, 8); c.lineTo(112, 26); c.quadraticCurveTo(110, 90, 64, 122); c.quadraticCurveTo(18, 90, 16, 26); c.closePath(); };
      c.strokeStyle = "#7a4a00"; c.lineWidth = 10; draw(); c.stroke();
      const g = c.createLinearGradient(20, 10, 108, 120); g.addColorStop(0, "#fff3b0"); g.addColorStop(0.5, "#ffc21a"); g.addColorStop(1, "#d88a0a");
      c.fillStyle = g; draw(); c.fill();
      c.fillStyle = "#fff8d8";
      c.beginPath();
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 13 : 30; c.lineTo(64 + Math.cos(a) * r, 62 + Math.sin(a) * r); }
      c.closePath(); c.fill();
    });
    // éclat de bulle (verre clair, teintable)
    cell(MY.shard, (c) => {
      c.beginPath(); c.moveTo(58, 8); c.lineTo(100, 52); c.lineTo(70, 122); c.lineTo(28, 66); c.closePath();
      c.fillStyle = "rgba(255,255,255,0.75)"; c.fill();
      c.strokeStyle = "#fff"; c.lineWidth = 6; c.stroke();
      c.fillStyle = "#fff"; c.beginPath(); c.moveTo(58, 8); c.lineTo(70, 122); c.lineTo(100, 52); c.closePath(); c.globalAlpha = 0.4; c.fill(); c.globalAlpha = 1;
    });
    // panique : trois traits qui rayonnent (blancs, contour d'encre)
    cell(MY.panic, (c) => {
      for (const [x0, y0, x1, y1] of [[20, 70, 50, 62], [40, 30, 58, 52], [78, 20, 76, 50]]) {
        c.strokeStyle = INK; c.lineWidth = 20; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
        c.strokeStyle = "#fff"; c.lineWidth = 10; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
      }
    });
  }
  function myAtlas() {
    PTMT.gfx.atlas();
    const src = PTMT.gfx.atlasCanvas;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1024;
    const ctx = canvas.getContext("2d");
    if (src) ctx.drawImage(src, 0, 0);
    paintMine(ctx);
    const t = new THREE.CanvasTexture(canvas);
    t.premultiplyAlpha = true;
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = 2;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.name = "ptmt:actors:atlas";
    ov.atlasCanvas = canvas;
    return t;
  }

  ov.init = function () {
    if (root) return;
    // PTMT.actors.mobile = true (avant load) : moitié moins de particules d'état
    ov.mobile = ov.mobile || !!A.mobile;
    C = Object.assign({}, PTMT.gfx.CELL, MY);
    root = new THREE.Group();
    root.name = "ptmt:actors:overlay";
    mat = PTMT.gfx.newSpriteMaterial();
    mat.uniforms.uAtlas.value = myAtlas();
    now = new PTMT.gfx.SpriteBatch(4096, "immediate", mat);
    fx = new PTMT.gfx.SpriteBatch(ov.mobile ? 2048 : 4096, "ring", mat);
    now.mesh.renderOrder = 12;
    fx.mesh.renderOrder = 11;
    const cube = PTMT.gfx.roundBox(1, 1, 1, 0.12, 3);
    cube.translate(0, 0.5, 0);
    ice = new Inst(cube, iceMaterial(), 96, "ptmt:actors:ice");
    ice.mesh.renderOrder = 9;
    bubble = new Inst(new THREE.SphereGeometry(1, 20, 14), bubbleMaterial(), 64, "ptmt:actors:bubble", true);
    bubble.mesh.renderOrder = 10;
    root.add(ice.mesh, bubble.mesh, fx.mesh, now.mesh);
    ov.root = root;
    ov.now = now;
    ov.fx = fx;
  };

  // nouvelle image : horloge + rattachement à la scène
  ov.frame = function (time, object) {
    if (!root) ov.init();
    // première mise à jour d'ennemi après un rendu : on repart de lots vides (sans mise à jour, pause :
    // le contenu reste affiché tel quel)
    if (now._rendered) { now._rendered = false; now.clear(); }
    if (ice.rendered) { ice.rendered = false; ice.clear(); }
    if (bubble.rendered) { bubble.rendered = false; bubble.clear(); }
    if (time !== lastTime) {
      lastTime = time;
      now.setTime(time);
      fx.setTime(time);
      ice.mesh.material.uniforms.uTime.value = time;
      bubble.mesh.material.uniforms.uTime.value = time;
    }
    if (!root.parent && object && ov.autoAttach !== false) {
      let o = object;
      while (o.parent) o = o.parent;
      if (o !== object && o.isScene) o.add(root);
    }
  };

  /** Appelé quand un ennemi retourne à la réserve : s'il n'en reste aucun actif, on vide les lots. */
  ov.released = function () {
    if (!root || A.actives.size > 0) return;
    now.clear(); ice.clear(); bubble.clear();
  };

  function rnd() { return Math.random(); }

  // Points d'ancrage (monde) d'un ennemi : centre de la tête, sommet, poitrine, yeux, gemme portée,
  // pot d'échappement, main droite, avant, droite ; échelle totale (gabarit × rang).
  function anchors(a) {
    a.object.updateMatrixWorld(true);
    const B = a.B, an = a.anchor, off = a.offsets;
    B.head.localToWorld(an.head.copy(off.head));
    B.body.localToWorld(an.chest.copy(off.chest));
    B.eye_l.getWorldPosition(an.eyeL);
    B.eye_r.getWorldPosition(an.eyeR);
    a.carryAnchor.getWorldPosition(an.gem);
    B.hand_r.getWorldPosition(an.hand);
    const mk = a.mountDef;
    if (mk && mk.exhaust && B.p_mount) B.p_mount.localToWorld(an.exhaust.fromArray(mk.exhaust));
    else an.exhaust.copy(an.chest);
    an.feet.copy(a.object.position);
    const yaw = a.object.rotation.y;
    an.fwd.set(Math.sin(yaw), 0, Math.cos(yaw));
    an.right.set(-Math.cos(yaw), 0, Math.sin(yaw));
    // sommet : hauteur du personnage (couvre-chef compris) au-dessus de la tête
    an.headTop.set(an.head.x, a.object.position.y + a.baseHeight * a.object.scale.y, an.head.z);
    a.es = a.scale * a.object.scale.y;
  }
  /** Repères à jour pour cette image (recalcul des matrices d'os seulement si un effet en a besoin). */
  function ensure(a) {
    if (a._anchAt === a.time) return;
    anchors(a);
    a._anchAt = a.time;
  }
  function every(a, key, period, dt) {
    if (ov.mobile) period *= 2; // mobile : moitié moins de particules
    const t = (a.emitT[key] || 0) + dt;
    if (t >= period) { a.emitT[key] = t % period; return Math.max(1, Math.floor(t / period)); }
    a.emitT[key] = t;
    return 0;
  }

  // --- recettes de particules (préparées une fois : aucune allocation par image) ------------------
  let R = null;
  function recipes() {
    if (R) return R;
    R = {
      mist: { life: 0.9, s0: 0.25, s1: 0.6, cell: C.puffDark, col: [0.85, 0.95, 1], a: 0.35, a1: 0, add: 0.2 },
      smoke: { drag: 1.2, life: 1.0, s0: 0.25, s1: 0.85, cell: C.puffDark, col: [0.28, 0.26, 0.26], a: 0.55, a1: 0, rot: "rand", spin: 1, curve: 1 },
      ember: { drag: 1.5, grav: 1, life: 0.6, s0: 0.07, s1: 0.02, cell: C.disc, col: [1, 0.55, 0.1], a: 1, a1: 0.5, add: 1 },
      drip: { grav: 9, life: 0.55, s0: 0.14, s1: 0.11, cell: C.drop, mode: 2, stretch: 0.04, col: [0.45, 0.78, 1], a: 1, a1: 0.8, fadeOut: 0.8 },
      puddle: { life: 0.8, s0: 0.15, s1: 0.5, cell: C.ripple, mode: 1, col: [0.7, 0.9, 1], a: 0.5, a1: 0 },
      ghostPuff: { drag: 0.8, life: 1.1, s0: 0.4, s1: 0.9, cell: C.puff, col: [0.62, 0.66, 0.6], a: 0.35, a1: 0, rot: "rand", spin: 0.4, curve: 1 },
      exhaust: { drag: 1.1, life: 0.9, s0: 0.18, s1: 0.7, cell: C.puffDark, col: [0.3, 0.29, 0.3], a: 0.55, a1: 0, rot: "rand", spin: 1.5, curve: 1 },
      dust: { drag: 2.5, life: 0.6, s0: 0.2, s1: 0.55, cell: C.puff, col: [0.8, 0.72, 0.58], a: 0.55, a1: 0, rot: "rand", curve: 1 },
      boost: { drag: 2.5, life: 0.36, s0: 0.32, s1: 0.12, cell: C.spark, mode: 2, stretch: 0.2, col: [1, 0.86, 0.4], a: 1, a1: 0, add: 0.5 },
      boostWind: { drag: 2, life: 0.35, s0: 0.7, s1: 0.9, cell: C.wind, mode: 3, rot: 0, a: 0.85, a1: 0 },
      ripple: { life: 1.1, s0: 1, s1: 2, cell: C.ripple, mode: 1, col: [0.9, 0.97, 1], a: 0.55, a1: 0, curve: 1 },
      wake: { life: 0.9, s0: 0.3, s1: 0.9, cell: C.foam, mode: 1, col: [0.95, 1, 1], a: 0.6, a1: 0, rot: "rand", curve: 1 },
      paddle: { grav: 9, life: 0.45, s0: 0.07, s1: 0.05, cell: C.drop, mode: 2, stretch: 0.05, col: [0.8, 0.95, 1], a: 0.9, a1: 0.5 },
      gemSparkle: { life: 0.55, s0: 0.05, s1: 0.28, cell: C.twinkle, col: [1, 0.95, 0.75], a: 1, a1: 0, add: 1, spin: 3, curve: 2 },
      sweat: { grav: 7, life: 0.55, s0: 0.12, s1: 0.1, cell: C.sweat, a: 1, a1: 0.2, rot: 0 },
      panic: { life: 0.5, s0: 0.45, s1: 0.6, cell: MY.panic, a: 1, a1: 0, curve: 2 },
      fearSweat: { grav: 7, life: 0.6, s0: 0.2, s1: 0.16, cell: C.sweat, a: 1, a1: 0.2, rot: 0 },
      radSpark: { life: 0.8, s0: 0.12, s1: 0.04, cell: C.twinkle, col: [0.35, 0.7, 1], a: 1, a1: 0, add: 1, curve: 1 },
      leaf: { grav: 3, drag: 1.5, life: 1.2, s0: 0.2, s1: 0.2, cell: C.leaf, a: 1, a1: 0.6, spin: 4, rot: "rand", fadeOut: 0.7 },
    };
    return R;
  }

  // --- chaque image, pour chaque ennemi --------------------------------------------------------
  ov.actor = function (a, dt, s) {
    if (!root) return;
    const R = recipes();
    const w = a.w, t = a.time, react = a.react, rt = a.reactT;
    const pos = a.object.position;
    const os = a.object.scale.y;
    const dw = a.dims.w * os, dh = a.dims.h * os, dd = a.dims.d * os;
    const an = a.anchor;
    const yaw = a.object.rotation.y;
    // repères bon marché (sans les os) ; tête, yeux, gemme, pot d'échappement : à la demande (ensure)
    an.fwd.set(Math.sin(yaw), 0, Math.cos(yaw));
    an.right.set(-Math.cos(yaw), 0, Math.sin(yaw));
    a.es = a.scale * os;
    const es = a.es;
    const topY = pos.y + a.baseHeight * os;
    const visible = a.object.visible;
    // ombre portée douce (lisibilité vue de haut)
    if (ov.blobShadows && visible) {
      const k = react === "die" ? Math.max(0, 1 - (rt - 0.72) / 0.26) : react === "escape" ? Math.max(0, 1 - (rt - 0.5) / 0.25) : 1;
      now.put(pos.x, pos.y + 0.025, pos.z, dw * 1.02, C.shadow, 0.02, 0.02, 0.04, 0.42 * k * (1 - 0.6 * w.ghost) * (1 - 0.8 * w.water), yaw - Math.PI / 2, 0, 1, dd / dw);
    }
    if (!visible) return;
    // gelé : glaçon + yeux écarquillés qui roulent
    if (w.frozen > 0.05) {
      const k = Math.min(1, w.frozen * 1.3);
      const sc = 0.85 + 0.15 * k;
      tmpQ.setFromAxisAngle(UP, yaw);
      tmpS.set(dw * sc, dh * (0.2 + 0.8 * k) * sc, dd * sc);
      tmpP.set(pos.x, pos.y - 0.02, pos.z);
      tmpM.compose(tmpP, tmpQ, tmpS);
      ice.push(tmpM);
      if (k > 0.6) {
        ensure(a);
        a.lookT -= dt;
        if (a.lookT <= 0) { a.lookT = 0.25 + rnd() * 0.5; a.lookTo[0] = (rnd() - 0.5) * 2; a.lookTo[1] = (rnd() - 0.5) * 2; }
        a.look[0] += (a.lookTo[0] - a.look[0]) * Math.min(1, dt * 18);
        a.look[1] += (a.lookTo[1] - a.look[1]) * Math.min(1, dt * 18);
        const ez = dd * 0.5 + 0.03;
        const ey = 0.3 * es;
        for (let si = 0; si < 2; si++) {
          const e = si ? an.eyeR : an.eyeL;
          // projeté sur la face avant du glaçon
          const dz = (e.x - pos.x) * an.fwd.x + (e.z - pos.z) * an.fwd.z;
          v1.copy(e).addScaledVector(an.fwd, Math.max(0, ez - dz));
          now.put(v1.x, v1.y, v1.z, ey, C.eyeWhite, 1, 1, 1, 1, 0, 0);
          now.put(v1.x + an.right.x * a.look[0] * ey * 0.2, v1.y + a.look[1] * ey * 0.2, v1.z + an.right.z * a.look[0] * ey * 0.2, ey * 0.42, C.pupil, 1, 1, 1, 1, 0, 0);
        }
        if (every(a, "mist", 0.18, dt)) fx.emitR(R.mist, pos.x + (rnd() - 0.5) * dw, pos.y + dh * rnd(), pos.z + (rnd() - 0.5) * dd, (rnd() - 0.5) * 0.3, -0.2, 0);
      }
    }
    // bulle de barrière (druide) : opacité selon la réserve
    if (w.barrier > 0.02 && react !== "die") {
      const r = Math.max(dw, dh * 0.6) * 0.62;
      const wob = 1 + Math.sin(t * 5 + a.id) * 0.02;
      tmpQ.setFromAxisAngle(UP, t * 0.3);
      tmpS.set(r * wob, dh * 0.58 / wob, r * wob);
      tmpP.set(pos.x, pos.y + dh * 0.46, pos.z);
      tmpM.compose(tmpP, tmpQ, tmpS);
      bubble.push(tmpM, Math.min(1, 0.25 + 0.75 * w.barrier));
      if (every(a, "bubbleGlint", 0.5, dt)) fx.emit({ x: pos.x + (rnd() - 0.5) * r, y: pos.y + dh * (0.3 + rnd() * 0.6), z: pos.z + (rnd() - 0.5) * r, life: 0.6, s0: 0.05, s1: 0.3, cell: C.twinkle, r: 0.7, g: 1, b: 0.6, a: w.barrier, a1: 0, add: 1, curve: 2 });
    }
    // en feu : flammes qui dansent + fumée + braises
    if (w.burn > 0.05) {
      ensure(a);
      const k = w.burn;
      for (let i = 0; i < FIRE_PTS.length; i++) {
        const p = FIRE_PTS[i];
        const fl = 0.75 + 0.35 * Math.sin(t * (13 + i * 3.1) + i * 1.7) + 0.15 * Math.sin(t * 29 + i);
        if (i === 0) v1.copy(an.head).addScaledVector(UP, 0.3 * es);
        else v1.copy(an.chest).addScaledVector(an.right, p[0] * dw * 0.42).addScaledVector(an.fwd, p[2] * 0.4 * es).addScaledVector(UP, p[1] * 1.3 * es);
        now.put(v1.x, v1.y + 0.15 * fl, v1.z, (p[3] || 0.42) * 1.35 * es * fl * k, C.flame, 1, 1, 1, 0.95, Math.sin(t * 7 + i) * 0.15, 0.35, 3);
      }
      const n = every(a, "smoke", 0.09, dt);
      for (let i = 0; i < n; i++) {
        v1.copy(an.chest).addScaledVector(an.right, (rnd() - 0.5) * 0.5).addScaledVector(UP, 0.2 + rnd() * 0.4);
        fx.emitR(R.smoke, v1.x, v1.y, v1.z, (rnd() - 0.5) * 0.4, 1.4 + rnd() * 0.6, (rnd() - 0.5) * 0.4, null, k);
        fx.emitR(R.ember, v1.x, v1.y, v1.z, (rnd() - 0.5) * 1.5, 2 + rnd() * 1.5, (rnd() - 0.5) * 1.5);
      }
    }
    // ralenti (trempé) : gouttes qui tombent
    if (w.wet > 0.05) {
      const n = every(a, "drip", 0.07, dt);
      for (let i = 0; i < n; i++) {
        v1.set(pos.x, pos.y, pos.z).addScaledVector(an.right, (rnd() - 0.5) * dw * 0.45).addScaledVector(an.fwd, (rnd() - 0.5) * 0.3);
        v1.y += 0.4 + rnd() * dh * 0.55;
        fx.emitR(R.drip, v1.x, v1.y, v1.z, 0, -0.4, 0, pos.y + 0.02, w.wet);
      }
      if (every(a, "puddle", 0.5, dt)) fx.emitR(R.puddle, pos.x + (rnd() - 0.5) * 0.4, pos.y + 0.03, pos.z + (rnd() - 0.5) * 0.4, 0, 0, 0, null, w.wet);
    }
    // invisible (fumigène) : quelques volutes autour de la silhouette tramée (shader)
    if (w.ghost > 0.05) {
      const k = w.ghost;
      const hh = Math.min(dh, 2.4);
      for (let i = 0; i < 6; i++) {
        const ang = t * 0.7 + (i * Math.PI * 2) / 6;
        const r = dw * (0.42 + 0.08 * Math.sin(t * 1.3 + i));
        const h = 0.25 + (i % 3) * hh * 0.3 + 0.08 * Math.sin(t * 2 + i);
        now.put(pos.x + Math.cos(ang) * r, pos.y + h, pos.z + Math.sin(ang) * r, (0.7 + 0.2 * Math.sin(t * 1.7 + i * 2.1)) * k * (0.8 + dw * 0.2), C.puff, 0.66, 0.7, 0.64, 0.35 * k, ang, 0);
      }
      if (every(a, "ghostPuff", 0.3, dt)) fx.emitR(R.ghostPuff, pos.x + (rnd() - 0.5) * dw, pos.y + 0.2 + rnd() * 1.4, pos.z + (rnd() - 0.5) * dd, 0, 0.35, 0, null, k);
    }
    // accéléré (air de biniou) : traits de vitesse
    if (w.haste > 0.05 && a.speed > 0.1) {
      const n = every(a, "boost", 0.025, dt);
      for (let i = 0; i < n; i++) {
        v1.copy(pos).addScaledVector(an.right, (rnd() - 0.5) * dw * 0.8).addScaledVector(UP, 0.15 + rnd() * dh * 0.6);
        fx.emitR(R.boost, v1.x, v1.y, v1.z, -an.fwd.x * 9, 0, -an.fwd.z * 9, null, w.haste);
        if (i === 0 && rnd() < 0.7) {
          R.boostWind.rot = rnd() > 0.5 ? Math.PI / 2 : -Math.PI / 2;
          fx.emitR(R.boostWind, v1.x - an.fwd.x * 0.6, v1.y, v1.z - an.fwd.z * 0.6, -an.fwd.x * 2, 0, -an.fwd.z * 2, null, w.haste);
        }
      }
      if (every(a, "hasteNote", 0.4, dt)) fx.emit({ x: pos.x, y: topY + 0.1, z: pos.z, vx: (rnd() - 0.5) * 0.6, vy: 0.9, vz: (rnd() - 0.5) * 0.6, life: 0.8, s0: 0.32 * es, s1: 0.42 * es, cell: MY.note, r: 1, g: 0.85, b: 0.3, a: w.haste, a1: 0, rot: (rnd() - 0.5) * 0.6, curve: 2, fadeOut: 0.6 });
      if (every(a, "hasteDust", 0.12, dt)) fx.emit({ x: pos.x - an.fwd.x * dd * 0.3, y: pos.y + 0.1, z: pos.z - an.fwd.z * dd * 0.3, vx: -an.fwd.x * 1.5, vy: 0.4, vz: -an.fwd.z * 1.5, drag: 2.5, life: 0.5, s0: 0.25, s1: 0.6, cell: C.puff, r: 1, g: 0.9, b: 0.6, a: 0.7 * w.haste, a1: 0, rot: rnd() * 6, curve: 1 });
    }
    // dans l'eau (canard) : ronds, sillage, gouttes des pattes
    if (w.water > 0.3) {
      const n = every(a, "ripple", a.speed > 0.1 ? 0.22 : 0.5, dt);
      R.ripple.s0 = dw * 0.7; R.ripple.s1 = dw * 2.0;
      for (let i = 0; i < n; i++) fx.emitR(R.ripple, pos.x - an.fwd.x * 0.2, pos.y + 0.03, pos.z - an.fwd.z * 0.2, 0, 0, 0);
      if (a.speed > 0.1 && every(a, "wake", 0.08, dt)) {
        for (const sg of [-1, 1]) {
          v1.copy(pos).addScaledVector(an.fwd, -dd * 0.35).addScaledVector(an.right, sg * dw * 0.35);
          fx.emitR(R.wake, v1.x, pos.y + 0.04, v1.z, an.right.x * sg * 0.6 - an.fwd.x * 0.4, 0, an.right.z * sg * 0.6 - an.fwd.z * 0.4);
        }
      }
      if (every(a, "paddle", 0.16, dt)) {
        v1.copy(pos).addScaledVector(an.fwd, -0.4 * es).addScaledVector(an.right, (rnd() > 0.5 ? 1 : -1) * 0.25 * es);
        for (let i = 0; i < 3; i++) fx.emitR(R.paddle, v1.x, pos.y + 0.1, v1.z, (rnd() - 0.5) * 1.2, 1.5 + rnd() * 1.2, (rnd() - 0.5) * 1.2, pos.y);
      }
    }
    // montures : fumée du quad, poussière des sabots
    if (a.mountDef && a.speed > 0.1 && react !== "die") {
      const kind = a.spec.mount.kind;
      if (kind === "quad" && every(a, "exhaust", 0.1, dt) && (ensure(a), true)) fx.emitR(R.exhaust, an.exhaust.x, an.exhaust.y, an.exhaust.z, -an.fwd.x * 1.2 + (rnd() - 0.5) * 0.4, 0.8 + rnd() * 0.4, -an.fwd.z * 1.2 + (rnd() - 0.5) * 0.4);
      if ((kind === "cow" || kind === "quad") && every(a, "dust", kind === "cow" ? 0.4 : 0.22, dt)) {
        v1.copy(pos).addScaledVector(an.fwd, -dd * 0.3).addScaledVector(an.right, (rnd() - 0.5) * dw * 0.8);
        fx.emitR(R.dust, v1.x, pos.y + 0.08, v1.z, -an.fwd.x * 0.5, 0.3, -an.fwd.z * 0.5);
      }
    }
    // gemme portée : paillettes
    if (s.carrying && w.carry > 0.5 && react !== "die") {
      if (every(a, "sparkle", 0.18, dt) && (ensure(a), true)) fx.emitR(R.gemSparkle, an.gem.x + (rnd() - 0.5) * 0.6, an.gem.y + (rnd() - 0.4) * 0.6, an.gem.z + (rnd() - 0.5) * 0.6, 0, 0.3, 0);
    }
    // à bout de forces : gouttes de sueur
    if (w.hp < 0.3 && react !== "die" && every(a, "sweat", 0.45, dt)) {
      ensure(a);
      const sgn = rnd() > 0.5 ? 1 : -1;
      v1.copy(an.head).addScaledVector(an.right, sgn * 0.35 * es).addScaledVector(UP, 0.25 * es);
      R.sweat.rot = -sgn * 0.5;
      fx.emitR(R.sweat, v1.x, v1.y, v1.z, an.right.x * sgn * 1.2, 1.4, an.right.z * sgn * 1.2);
    }
    // peur : traits de panique et sueur
    if (w.fear > 0.3 && react !== "die") {
      if (every(a, "panic", 0.3, dt)) {
        ensure(a);
        const sgn = rnd() > 0.5 ? 1 : -1;
        v1.copy(an.head).addScaledVector(an.right, sgn * 0.45 * es).addScaledVector(UP, 0.35 * es);
        R.panic.rot = sgn > 0 ? 0 : 0.8;
        fx.emitR(R.panic, v1.x, v1.y, v1.z, an.right.x * sgn * 0.5, 0.5, an.right.z * sgn * 0.5, null, w.fear);
      }
      if (every(a, "fearSweat", 0.2, dt)) {
        ensure(a);
        const sgn = rnd() > 0.5 ? 1 : -1;
        R.fearSweat.rot = -sgn * 0.6;
        fx.emitR(R.fearSweat, an.head.x + an.right.x * sgn * 0.3 * es, an.head.y + 0.3 * es, an.head.z + an.right.z * sgn * 0.3 * es, an.right.x * sgn * 1.6, 1.8, an.right.z * sgn * 1.6);
      }
    }
    // étourdi : étoiles qui tournent au-dessus de la tête
    if (w.stun > 0.05 && react !== "die") {
      for (let i = 0; i < 4; i++) {
        const ang = t * 5 + (i * Math.PI * 2) / 4;
        v1.set(pos.x, topY, pos.z);
        now.put(v1.x + Math.cos(ang) * 0.5 * es, v1.y + 0.12 * es + Math.sin(ang * 2) * 0.05, v1.z + Math.sin(ang) * 0.5 * es, 0.26 * es * w.stun, C.star, 1, 1, 1, w.stun, ang, 0);
      }
    }
    // rayonnement (dragon bleu) : rune bleue au sol qui tourne + étincelles
    if (w.radiance > 0.05) {
      const k = w.radiance;
      now.put(pos.x, pos.y + 0.05, pos.z, Math.max(dw, dd) * 1.2, C.rune, 0.12, 0.42, 1, 0.95 * k, t * 1.2, 0.35, 1);
      now.put(pos.x, pos.y + 0.06, pos.z, Math.max(dw, dd) * 1.0, C.glow, 0.15, 0.45, 1, 0.55 * k, 0, 0.9, 1);
      if (every(a, "radSpark", 0.12, dt)) fx.emitR(R.radSpark, pos.x + (rnd() - 0.5) * dw, pos.y + rnd() * dh, pos.z + (rnd() - 0.5) * dd, 0, 0.8, 0, null, k);
    }
    // désarmé : petite icône au-dessus de la tête
    if (w.disarm > 0.05 && react !== "die") {
      const b = 1 + 0.06 * Math.sin(t * 4 + a.id);
      now.put(pos.x, topY + 0.28 * es + (w.stun > 0.05 ? 0.3 * es : 0), pos.z, 0.36 * es * b * w.disarm, MY.disarm, 1, 1, 1, 0.9 * w.disarm, 0, 0);
    }
    // K.-O. : étoiles qui tournent, puis « pouf »
    if (react === "die") {
      if (rt > 0.2 && rt < 0.8) {
        ensure(a);
        for (let i = 0; i < 5; i++) {
          const ang = t * 6 + (i * Math.PI * 2) / 5;
          v1.copy(an.head).addScaledVector(UP, 0.35 * es);
          now.put(v1.x + Math.cos(ang) * 0.55 * es, v1.y + 0.2 + Math.sin(ang * 2) * 0.06, v1.z + Math.sin(ang) * 0.55 * es, 0.26 * es, C.star, 1, 1, 1, 1, ang, 0);
        }
      }
      if (rt > 0.7 && !a._poofed) {
        a._poofed = true;
        poof(a, pos, a.mountDef ? 0.9 : 0.45);
      }
    } else if (react === "escape") {
      if (rt > 0.52 && !a._poofed) {
        a._poofed = true;
        poof(a, v1.copy(pos).addScaledVector(UP, 1.2 * os), 0);
        for (let i = 0; i < 10; i++) fx.emit({ x: pos.x, y: pos.y + 1.5 * os, z: pos.z, vx: (rnd() - 0.5) * 4, vy: 1 + rnd() * 3, vz: (rnd() - 0.5) * 4, grav: 4, life: 0.8, s0: 0.1, s1: 0.35, cell: C.twinkle, r: 1, g: 0.9, b: 0.5, a: 1, a1: 0, add: 1, curve: 2 });
      }
    } else a._poofed = false;
  };
  function poof(a, pos, dy) {
    const cy = pos.y + dy * a.object.scale.y;
    const k = a.object.scale.y;
    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * Math.PI * 2;
      fx.emit({ x: pos.x, y: cy, z: pos.z, vx: Math.cos(ang) * 3.2 * k, vy: 0.6 + rnd() * 1.2, vz: Math.sin(ang) * 3.2 * k, drag: 4, life: 0.75, s0: 0.75 * k, s1: 1.5 * k, cell: C.poof, a: 1, a1: 0, rot: rnd() * 6, fadeOut: 0.55, curve: 2 });
    }
    for (let i = 0; i < 6; i++) fx.emit({ x: pos.x, y: cy + 0.3, z: pos.z, vx: (rnd() - 0.5) * 3, vy: 2 + rnd() * 2, vz: (rnd() - 0.5) * 3, grav: 6, life: 0.7, s0: 0.2 * k, s1: 0.1 * k, cell: C.star, a: 1, a1: 0, spin: 6 });
    if (a.type === "canard") for (let i = 0; i < 10; i++) fx.emit({ x: pos.x, y: cy + 0.2, z: pos.z, vx: (rnd() - 0.5) * 3, vy: 1.5 + rnd() * 2, vz: (rnd() - 0.5) * 3, grav: 2, drag: 1.8, life: 1.4, s0: 0.22 * k, s1: 0.2 * k, cell: MY.feather, r: a.boss ? 1 : 0.75, g: a.boss ? 0.8 : 0.72, b: a.boss ? 0.3 : 0.66, a: 1, a1: 0, rot: rnd() * 6, spin: (rnd() - 0.5) * 6, fadeOut: 0.7 });
  }
  const FIRE_PTS = [
    [0, 0, 0, 0.78],
    [-1, 0.05, -0.2, 0.62],
    [1, 0.08, -0.1, 0.6],
    [0, -0.05, -1.0, 0.7],
    [-0.45, -0.5, 0.25, 0.5],
    [0.5, -0.45, 0.15, 0.48],
    [0.1, -0.85, -0.6, 0.46],
  ];

  // --- réactions ponctuelles -----------------------------------------------------------------
  const NOTE_COLS = [[1, 0.85, 0.3], [1, 1, 1], [1, 0.55, 0.7], [0.55, 0.85, 1]];
  ov.burst = function (a, name) {
    if (!root) return;
    anchors(a);
    a._anchAt = a.time;
    const an = a.anchor, pos = a.object.position, es = a.es, os = a.object.scale.y;
    const dw = a.dims.w * os, dh = a.dims.h * os;
    const E = (o) => fx.emit(o);
    const Q = ov.mobile ? 0.5 : 1;
    switch (name) {
      case "hit": {
        v1.copy(an.chest).addScaledVector(an.fwd, 0.4 * es);
        E({ x: v1.x, y: v1.y, z: v1.z, life: 0.18, s0: 0.35 * es, s1: 0.9 * es, cell: C.zap, r: 1, g: 0.95, b: 0.7, a: 1, a1: 0, rot: rnd() * 6, add: 0.6 });
        for (let i = 0; i < 5; i++) E({ x: v1.x, y: v1.y, z: v1.z, vx: (rnd() - 0.5) * 5, vy: 1 + rnd() * 3, vz: (rnd() - 0.5) * 5, grav: 8, life: 0.35, s0: 0.12, s1: 0.04, cell: C.spark, mode: 2, stretch: 0.05, r: 1, g: 0.9, b: 0.5, a: 1, a1: 0, add: 1 });
        break;
      }
      case "die": {
        v1.copy(an.head);
        for (let i = 0; i < 6; i++) E({ x: v1.x, y: v1.y, z: v1.z, vx: (rnd() - 0.5) * 4, vy: 2 + rnd() * 2, vz: (rnd() - 0.5) * 4, grav: 8, life: 0.6, s0: 0.2 * es, s1: 0.1 * es, cell: C.star, a: 1, a1: 0, spin: 8 });
        E({ x: v1.x, y: v1.y, z: v1.z, life: 0.22, s0: 0.5 * es, s1: 1.3 * es, cell: C.zap, r: 1, g: 1, b: 0.8, a: 1, a1: 0, add: 0.6 });
        break;
      }
      case "pickup": {
        v1.copy(an.headTop).addScaledVector(UP, 0.45 * es);
        E({ x: v1.x, y: v1.y, z: v1.z, vy: 0.5, life: 0.9, s0: 0.5 * es, s1: 0.65 * es, cell: C.exclaim, a: 1, a1: 1, fadeOut: 0.75, curve: 2 });
        E({ x: an.gem.x, y: an.gem.y, z: an.gem.z, life: 0.3, s0: 0.4, s1: 1.8, cell: C.glow, r: 1, g: 0.9, b: 0.55, a: 1, a1: 0, add: 1, curve: 1 });
        for (let i = 0; i < 10; i++) E({ x: an.gem.x + (rnd() - 0.5) * 0.8, y: an.gem.y + (rnd() - 0.5) * 0.8, z: an.gem.z + (rnd() - 0.5) * 0.8, life: 0.5, s0: 0.05, s1: 0.35, cell: C.twinkle, r: 1, g: 0.95, b: 0.7, a: 1, a1: 0, add: 1, delay: rnd() * 0.2, curve: 2 });
        break;
      }
      case "drop": {
        v1.copy(an.headTop).addScaledVector(UP, 0.4 * es);
        E({ x: v1.x, y: v1.y, z: v1.z, vy: 0.4, life: 0.9, s0: 0.5 * es, s1: 0.62 * es, cell: C.question, a: 1, a1: 1, fadeOut: 0.7, curve: 2 });
        for (let i = 0; i < 6; i++) E({ x: pos.x + (rnd() - 0.5) * dw * 0.5, y: pos.y + 0.1, z: pos.z + (rnd() - 0.5) * dw * 0.5, vx: (rnd() - 0.5) * 2, vy: 0.5 + rnd(), vz: (rnd() - 0.5) * 2, drag: 3, life: 0.6, s0: 0.25, s1: 0.6, cell: C.puff, r: 0.8, g: 0.72, b: 0.6, a: 0.8, a1: 0, curve: 1 });
        break;
      }
      case "heal": {
        // la crêpe part de la main droite au moment du lancer, en cloche, vers l'allié (ou devant)
        const T0 = 0.24, fly = 0.62;
        v1.copy(an.hand).addScaledVector(UP, 0.5 * es);
        let tx, tz, ty;
        if (a.hasTarget) { tx = a.target.x; ty = a.target.y + 1.2; tz = a.target.z; }
        else { tx = pos.x + an.fwd.x * 3.5; ty = pos.y + 0.8; tz = pos.z + an.fwd.z * 3.5; }
        const g = 9;
        const vx = (tx - v1.x) / fly, vz = (tz - v1.z) / fly, vy = (ty - v1.y) / fly + 0.5 * g * fly;
        E({ x: v1.x, y: v1.y, z: v1.z, vx, vy, vz, grav: g, delay: T0, life: fly, s0: 0.6, s1: 0.7, cell: MY.crepe, a: 1, a1: 1, spin: 14, fadeIn: 0.02, fadeOut: 0.95 });
        E({ x: v1.x, y: v1.y, z: v1.z, delay: T0, life: 0.25, s0: 0.2, s1: 0.8, cell: C.glow, r: 1, g: 0.85, b: 0.5, a: 0.9, a1: 0, add: 1 });
        for (let i = 0; i < 4; i++) E({ x: tx + (rnd() - 0.5) * 0.6, y: ty - 0.4 + rnd() * 0.6, z: tz + (rnd() - 0.5) * 0.6, vy: 1.2, delay: T0 + fly + i * 0.08, life: 0.7, s0: 0.38, s1: 0.5, cell: MY.plus, r: 0.4, g: 1, b: 0.45, a: 1, a1: 0, curve: 2, fadeOut: 0.6 });
        break;
      }
      case "healed": {
        for (let i = 0; i < 5; i++) E({ x: pos.x + (rnd() - 0.5) * dw * 0.6, y: pos.y + dh * (0.5 + rnd() * 0.4), z: pos.z + (rnd() - 0.5) * dw * 0.6, vy: 1.3, delay: i * 0.06, life: 0.75, s0: 0.38 * es, s1: 0.5 * es, cell: MY.plus, r: 0.4, g: 1, b: 0.45, a: 1, a1: 0, curve: 2, fadeOut: 0.6 });
        E({ x: pos.x, y: pos.y + dh * 0.5, z: pos.z, life: 0.35, s0: dw * 0.5, s1: dw * 1.4, cell: C.glow, r: 0.5, g: 1, b: 0.5, a: 0.7, a1: 0, add: 1 });
        break;
      }
      case "smoke": {
        // fumigène lancé à ses pieds, puis gros nuage
        const T0 = 0.24;
        v1.copy(an.hand).addScaledVector(UP, 0.3 * es);
        const tx = pos.x + an.fwd.x * 1.2, tz = pos.z + an.fwd.z * 1.2;
        const fly = 0.3;
        E({ x: v1.x, y: v1.y, z: v1.z, vx: (tx - v1.x) / fly, vy: (pos.y + 0.15 - v1.y) / fly + 0.5 * 12 * fly, vz: (tz - v1.z) / fly, grav: 12, delay: T0, life: fly, s0: 0.42, s1: 0.42, cell: MY.grenade, a: 1, a1: 1, spin: 12, fadeIn: 0.02, fadeOut: 0.98 });
        const n = Math.round(18 * Q);
        for (let i = 0; i < n; i++) {
          const ang = rnd() * Math.PI * 2, sp = 1.5 + rnd() * 2.5;
          E({ x: tx, y: pos.y + 0.3 + rnd() * 1.2, z: tz, vx: Math.cos(ang) * sp, vy: rnd() * 1.2, vz: Math.sin(ang) * sp, drag: 3.5, delay: T0 + fly, life: 1.2 + rnd() * 0.5, s0: 0.5, s1: 1.6, cell: C.puff, r: 0.62, g: 0.68, b: 0.6, a: 0.9, a1: 0, rot: rnd() * 6, spin: rnd() - 0.5, curve: 1, fadeOut: 0.6 });
        }
        E({ x: tx, y: pos.y + 0.6, z: tz, delay: T0 + fly, life: 0.25, s0: 0.6, s1: 2.4, cell: C.glow, r: 0.95, g: 1, b: 0.85, a: 0.8, a1: 0, add: 0.8 });
        break;
      }
      case "tune": {
        // air de biniou : notes qui s'envolent et onde dorée qui s'étend (≈ 2 cases)
        const n = Math.round(9 * Q) + 2;
        for (let i = 0; i < n; i++) {
          const ang = rnd() * Math.PI * 2, c = NOTE_COLS[i % NOTE_COLS.length];
          E({ x: an.chest.x, y: an.chest.y + 0.4 * es, z: an.chest.z, vx: Math.cos(ang) * (0.8 + rnd()), vy: 1.2 + rnd() * 1.2, vz: Math.sin(ang) * (0.8 + rnd()), drag: 0.8, delay: i * 0.08, life: 1.2, s0: 0.45 * es, s1: 0.6 * es, cell: i % 2 ? MY.note : MY.notes, r: c[0], g: c[1], b: c[2], a: 1, a1: 0, rot: (rnd() - 0.5) * 0.8, spin: (rnd() - 0.5) * 2, curve: 2, fadeOut: 0.7 });
        }
        const reach = ((PTMT.sim && PTMT.sim.DATA && PTMT.sim.DATA.TILE) || 3.6) * 2;
        E({ x: pos.x, y: pos.y + 0.08, z: pos.z, life: 0.9, s0: 0.6, s1: reach * 2, cell: C.ring, mode: 1, r: 1, g: 0.85, b: 0.35, a: 0.9, a1: 0, add: 0.6, curve: 1 });
        E({ x: pos.x, y: pos.y + 0.1, z: pos.z, delay: 0.18, life: 0.9, s0: 0.6, s1: reach * 1.6, cell: C.dashring, mode: 1, r: 1, g: 0.95, b: 0.6, a: 0.7, a1: 0, add: 0.6, curve: 1, spin: 1.5 });
        break;
      }
      case "lasso": {
        v1.copy(an.headTop).addScaledVector(UP, 0.4 * es);
        R.boostWind.rot = 0;
        E({ x: v1.x, y: v1.y, z: v1.z, life: 0.35, s0: 0.8 * es, s1: 1.2 * es, cell: C.wind, mode: 3, a: 0.9, a1: 0, delay: 0.25 });
        let tx = pos.x + an.fwd.x * 3.2, tz = pos.z + an.fwd.z * 3.2;
        if (a.hasTarget) { tx = a.target.x; tz = a.target.z; }
        for (let i = 0; i < 6; i++) E({ x: tx + (rnd() - 0.5) * 0.5, y: pos.y + 0.1, z: tz + (rnd() - 0.5) * 0.5, vx: (rnd() - 0.5) * 2, vy: 0.5 + rnd(), vz: (rnd() - 0.5) * 2, drag: 3, delay: 0.55, life: 0.6, s0: 0.25, s1: 0.6, cell: C.puff, r: 0.82, g: 0.74, b: 0.6, a: 0.8, a1: 0, curve: 1 });
        break;
      }
      case "dodge": {
        const side = a.dodgeSide;
        for (let i = 0; i < 3; i++) E({ x: pos.x - an.right.x * side * 0.3, y: pos.y + 0.5 + i * 0.45, z: pos.z - an.right.z * side * 0.3, vx: -an.right.x * side * 2.5, vz: -an.right.z * side * 2.5, drag: 3, life: 0.3, s0: 0.9 * es, s1: 1.1 * es, cell: C.wind, mode: 3, rot: side > 0 ? Math.PI / 2 : -Math.PI / 2, a: 0.9, a1: 0 });
        for (let i = 0; i < 5; i++) E({ x: pos.x + (rnd() - 0.5) * 0.5, y: pos.y + 0.08, z: pos.z + (rnd() - 0.5) * 0.5, vx: -an.right.x * side * (1 + rnd()), vy: 0.4 + rnd() * 0.5, vz: -an.right.z * side * (1 + rnd()), drag: 3, life: 0.55, s0: 0.2, s1: 0.5, cell: C.puff, r: 0.82, g: 0.75, b: 0.62, a: 0.8, a1: 0, curve: 1 });
        break;
      }
      case "barrierBreak": {
        // la bulle éclate : éclats verts et dorés, anneau, feuilles de gui
        const cy = pos.y + dh * 0.46, r = Math.max(dw, dh * 0.6) * 0.62;
        const n = Math.round(16 * Q) + 4;
        for (let i = 0; i < n; i++) {
          const ang = rnd() * Math.PI * 2, el = (rnd() - 0.3) * 1.4;
          const gold = i % 3 === 0;
          E({ x: pos.x + Math.cos(ang) * r, y: cy + el * r * 0.5, z: pos.z + Math.sin(ang) * r, vx: Math.cos(ang) * (3 + rnd() * 2), vy: 1.5 + rnd() * 2.5, vz: Math.sin(ang) * (3 + rnd() * 2), grav: 9, life: 0.7, s0: 0.28, s1: 0.2, cell: MY.shard, r: gold ? 1 : 0.5, g: gold ? 0.88 : 1, b: gold ? 0.4 : 0.55, a: 1, a1: 0, rot: rnd() * 6, spin: (rnd() - 0.5) * 14, add: 0.3 });
        }
        E({ x: pos.x, y: cy, z: pos.z, life: 0.3, s0: r * 1.6, s1: r * 3.2, cell: C.ring, r: 0.6, g: 1, b: 0.6, a: 1, a1: 0, add: 0.8, curve: 1 });
        E({ x: pos.x, y: cy, z: pos.z, life: 0.2, s0: r, s1: r * 2.4, cell: C.glow, r: 0.8, g: 1, b: 0.7, a: 0.9, a1: 0, add: 1 });
        for (let i = 0; i < Math.round(6 * Q) + 2; i++) fx.emitR(recipes().leaf, pos.x + (rnd() - 0.5) * r, cy + (rnd() - 0.5) * r, pos.z + (rnd() - 0.5) * r, (rnd() - 0.5) * 3, 1 + rnd() * 2, (rnd() - 0.5) * 3);
        break;
      }
      case "spawn": {
        for (let i = 0; i < 10; i++) {
          const ang = (i / 10) * Math.PI * 2;
          E({ x: pos.x + Math.cos(ang) * 0.3, y: pos.y + 0.1, z: pos.z + Math.sin(ang) * 0.3, vx: Math.cos(ang) * 2.2, vy: 0.4 + rnd() * 0.5, vz: Math.sin(ang) * 2.2, drag: 3, life: 0.65, s0: 0.35 * os, s1: 0.8 * os, cell: C.puff, r: 0.86, g: 0.8, b: 0.68, a: 0.85, a1: 0, rot: rnd() * 6, curve: 1 });
        }
        if (a.rank >= 1) for (let i = 0; i < 12; i++) E({ x: pos.x + (rnd() - 0.5) * dw, y: pos.y + rnd() * dh, z: pos.z + (rnd() - 0.5) * dw, vy: 0.8, life: 0.8, s0: 0.1, s1: 0.4, cell: C.twinkle, r: 1, g: 0.85, b: 0.35, a: 1, a1: 0, add: 1, delay: rnd() * 0.3, curve: 2 });
        break;
      }
      case "escape": {
        v1.copy(an.headTop).addScaledVector(UP, 0.4 * es);
        E({ x: v1.x, y: v1.y, z: v1.z, vy: 0.8, life: 0.8, s0: 0.5 * es, s1: 0.65 * es, cell: C.exclaim, a: 1, a1: 1, fadeOut: 0.75, curve: 2 });
        break;
      }
      case "immune": {
        v1.copy(an.headTop).addScaledVector(UP, 0.4 * es);
        E({ x: v1.x, y: v1.y, z: v1.z, vy: 0.6, life: 0.8, s0: 0.5 * es, s1: 0.7 * es, cell: MY.badge, a: 1, a1: 1, fadeOut: 0.7, curve: 2 });
        E({ x: an.chest.x, y: an.chest.y, z: an.chest.z, life: 0.3, s0: 0.5 * es, s1: 2.2 * es, cell: C.ring, r: 1, g: 0.82, b: 0.3, a: 1, a1: 0, add: 0.8, curve: 1 });
        for (let i = 0; i < 8; i++) E({ x: an.chest.x + (rnd() - 0.5) * dw * 0.7, y: an.chest.y + (rnd() - 0.3) * dh * 0.6, z: an.chest.z + (rnd() - 0.5) * dw * 0.7, life: 0.5, s0: 0.06, s1: 0.35, cell: C.twinkle, r: 1, g: 0.85, b: 0.4, a: 1, a1: 0, add: 1, delay: rnd() * 0.15, curve: 2 });
        break;
      }
    }
  };
})();
