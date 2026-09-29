// « Pas touche à mes trésors » — états visibles des ennemis, dessinés en lots partagés.
//
// Tous les ennemis écrivent dans les mêmes lots : sprites posés (flammes, yeux en cœur, étoiles, nuage
// de fumée, ombres), particules simulées sur le GPU (fumée, gouttes, étincelles, ronds dans l'eau),
// glaçons et filets instanciés. Quelques appels de dessin au total, quel que soit le nombre d'ennemis.
// Le groupe PTMT.actors.overlay.root s'ajoute tout seul à la scène du premier ennemi mis à jour
// (on peut aussi l'ajouter soi-même).
(function () {
  "use strict";
  if (typeof THREE === "undefined") return; // rendu seulement : sans three.js (banc de simulation), rien à enregistrer
  const PTMT = (globalThis.PTMT = globalThis.PTMT || {});
  const A = (PTMT.actors = PTMT.actors || {});
  const ov = (A.overlay = A.overlay || {});
  let C = null; // cases de la planche
  let now = null, fx = null, ice = null, net = null, root = null, mat = null;
  let lastTime = -Infinity;
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3();
  const v1 = new THREE.Vector3(), v2 = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  ov.blobShadows = true;
  ov.mobile = false;

  // --- instances « immédiates » (réécrites à chaque image) -----------------------------------
  class Inst {
    constructor(geo, material, cap, name) {
      this.cap = cap;
      this.mesh = new THREE.InstancedMesh(geo, material, cap);
      this.mesh.name = name;
      this.mesh.count = 0;
      this.mesh.frustumCulled = false;
      this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.cursor = 0;
      this.rendered = true;
      // même politique que les sprites posés : vidé à la première écriture qui suit un rendu,
      // conservé tant que personne n'écrit (pause), vidé quand le dernier ennemi est rendu
      this.mesh.onBeforeRender = () => { this.rendered = true; };
    }
    push(m) {
      if (this.rendered) { this.rendered = false; this.cursor = 0; this.mesh.count = 0; }
      if (this.cursor >= this.cap) return -1;
      const i = this.cursor++;
      this.mesh.setMatrixAt(i, m);
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
  function netTexture() {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const x = c.getContext("2d");
    x.clearRect(0, 0, 128, 128);
    x.strokeStyle = "#e4c890";
    x.lineWidth = 7;
    x.lineCap = "round";
    for (let i = -2; i < 4; i++) {
      x.beginPath(); x.moveTo(i * 64, 0); x.lineTo(i * 64 + 128, 128); x.stroke();
      x.beginPath(); x.moveTo(i * 64 + 128, 0); x.lineTo(i * 64, 128); x.stroke();
    }
    x.fillStyle = "#b89250";
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { x.beginPath(); x.arc(i * 64, j * 64, 6, 0, Math.PI * 2); x.fill(); }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(6, 3);
    t.encoding = THREE.sRGBEncoding;
    return t;
  }

  ov.init = function () {
    if (root) return;
    // PTMT.actors.mobile = true (avant load) : moitié moins de particules d'état
    ov.mobile = ov.mobile || !!A.mobile;
    C = PTMT.gfx.CELL;
    root = new THREE.Group();
    root.name = "ptmt:actors:overlay";
    mat = PTMT.gfx.newSpriteMaterial();
    now = new PTMT.gfx.SpriteBatch(4096, "immediate", mat);
    fx = new PTMT.gfx.SpriteBatch(ov.mobile ? 2048 : 4096, "ring", mat);
    now.mesh.renderOrder = 12;
    fx.mesh.renderOrder = 11;
    const cube = PTMT.gfx.roundBox(1, 1, 1, 0.12, 3);
    cube.translate(0, 0.5, 0);
    ice = new Inst(cube, iceMaterial(), 96, "ptmt:actors:ice");
    ice.mesh.renderOrder = 9;
    const dome = new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.62);
    dome.translate(0, 0.0, 0);
    const netMat = new THREE.MeshStandardMaterial({ map: netTexture(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 });
    net = new Inst(dome, netMat, 96, "ptmt:actors:net");
    root.add(ice.mesh, net.mesh, fx.mesh, now.mesh);
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
    if (net.rendered) { net.rendered = false; net.clear(); }
    if (time !== lastTime) {
      lastTime = time;
      now.setTime(time);
      fx.setTime(time);
      ice.mesh.material.uniforms.uTime.value = time;
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
    now.clear(); ice.clear(); net.clear();
  };

  const lin = (hex) => PTMT.color(hex);
  const COL = {};
  function col(name, hex) {
    let c = COL[name];
    if (!c) c = COL[name] = lin(hex);
    return c;
  }
  function rnd() { return Math.random(); }

  // Points d'ancrage (monde) d'un ennemi : centre de la tête, sommet (chapeau compris), poitrine, yeux,
  // sac, pot d'échappement, avant, droite
  function anchors(a) {
    a.object.updateMatrixWorld(true);
    const B = a.B, an = a.anchor, sp = a.spec, off = a.offsets;
    B.head.localToWorld(an.head.copy(off.head));
    B.body.localToWorld(an.chest.copy(off.chest));
    B.eye_l.getWorldPosition(an.eyeL);
    B.eye_r.getWorldPosition(an.eyeR);
    if (B.p_sack) B.p_sack.localToWorld(an.sack.set(0, 0.42 * ((sp.sack && sp.sack.scale) || 1), 0)); else an.sack.copy(an.chest);
    if (B.p_vehicle && sp.exhaust) B.p_vehicle.localToWorld(an.exhaust.set(sp.exhaust[0], sp.exhaust[1], sp.exhaust[2]));
    an.feet.copy(a.object.position);
    const yaw = a.object.rotation.y;
    an.fwd.set(Math.sin(yaw), 0, Math.cos(yaw));
    an.right.set(-Math.cos(yaw), 0, Math.sin(yaw));
    // sommet : crâne + couvre-chef
    an.headTop.copy(an.head).addScaledVector(UP, (sp.headR + (sp.hatH === undefined ? 0.12 : sp.hatH)) * a.scale);
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
  const RAINBOW = [1, 1, 1];
  const tmpColor = new THREE.Color();
  function recipes() {
    if (R) return R;
    R = {
      mist: { life: 0.9, s0: 0.25, s1: 0.6, cell: C.puffDark, col: [0.85, 0.95, 1], a: 0.35, a1: 0, add: 0.2 },
      smoke: { drag: 1.2, life: 1.0, s0: 0.25, s1: 0.85, cell: C.puffDark, col: [0.28, 0.26, 0.26], a: 0.55, a1: 0, rot: "rand", spin: 1, curve: 1 },
      ember: { drag: 1.5, grav: 1, life: 0.6, s0: 0.07, s1: 0.02, cell: C.disc, col: [1, 0.55, 0.1], a: 1, a1: 0.5, add: 1 },
      drip: { grav: 9, life: 0.55, s0: 0.14, s1: 0.11, cell: C.drop, mode: 2, stretch: 0.04, col: [0.45, 0.78, 1], a: 1, a1: 0.8, fadeOut: 0.8 },
      puddle: { life: 0.8, s0: 0.15, s1: 0.5, cell: C.ripple, mode: 1, col: [0.7, 0.9, 1], a: 0.5, a1: 0 },
      netAnger: { life: 0.6, s0: 0.2, s1: 0.32, cell: C.anger, a: 1, a1: 0, curve: 2 },
      heart: { life: 1.0, s0: 0.24, s1: 0.34, cell: C.heart, a: 1, a1: 0, rot: [-0.3, 0.3], fadeOut: 0.6, curve: 2 },
      dollar: { life: 1.0, s0: 0.24, s1: 0.34, cell: C.dollar, a: 1, a1: 0, rot: [-0.3, 0.3], fadeOut: 0.6, curve: 2 },
      ghostPuff: { drag: 0.8, life: 1.1, s0: 0.5, s1: 1.1, cell: C.puff, col: [0.6, 0.56, 0.7], a: 0.5, a1: 0, rot: "rand", spin: 0.4, curve: 1 },
      exhaust: { drag: 1.1, life: 1.3, s0: 0.3, s1: 1.2, cell: C.puffDark, col: [0.16, 0.15, 0.16], a: 0.75, a1: 0, rot: "rand", spin: 1.5, curve: 1 },
      engineSpark: { grav: 9, life: 0.5, s0: 0.08, s1: 0.03, cell: C.spark, mode: 2, stretch: 0.06, col: [1, 0.7, 0.25], a: 1, a1: 0.6, add: 1 },
      boost: { drag: 3, life: 0.3, s0: 0.2, s1: 0.08, cell: C.spark, mode: 2, stretch: 0.14, col: [1, 0.95, 0.7], a: 1, a1: 0, add: 0.6 },
      boostRainbow: { drag: 3, life: 0.3, s0: 0.2, s1: 0.08, cell: C.spark, mode: 2, stretch: 0.14, col: RAINBOW, a: 1, a1: 0, add: 0.6 },
      boostWind: { drag: 2, life: 0.35, s0: 0.7, s1: 0.9, cell: C.wind, mode: 3, rot: 0, a: 0.85, a1: 0 },
      ripple: { life: 1.1, s0: 1, s1: 2, cell: C.ripple, mode: 1, col: [0.9, 0.97, 1], a: 0.55, a1: 0, curve: 1 },
      paddle: { grav: 9, life: 0.45, s0: 0.07, s1: 0.05, cell: C.drop, mode: 2, stretch: 0.05, col: [0.8, 0.95, 1], a: 0.9, a1: 0.5 },
      sackSparkle: { life: 0.55, s0: 0.05, s1: 0.28, cell: C.twinkle, col: [1, 0.85, 0.35], a: 1, a1: 0, add: 1, spin: 3, curve: 2 },
      coinDrip: { grav: 12, life: 0.7, s0: 0.14, s1: 0.14, cell: C.coin, a: 1, a1: 0.8, fadeOut: 0.8 },
      sweat: { grav: 7, life: 0.55, s0: 0.12, s1: 0.1, cell: C.sweat, a: 1, a1: 0.2, rot: 0 },
    };
    return R;
  }

  // --- chaque image, pour chaque ennemi --------------------------------------------------------
  ov.actor = function (a, dt, s) {
    if (!root) return;
    const R = recipes();
    const w = a.w, t = a.time, d = a.dims, react = a.react, rt = a.reactT;
    const pos = a.object.position;
    const need = w.frozen > 0.05 || w.burn > 0.05 || w.lure > 0.05 || w.ghost > 0.05 || w.net > 0.05 || w.heat > 0.05 || w.wet > 0.05 || w.boost > 0.05 || w.water > 0.05 || s.carrying || react || (s.tenacity || 0) > 0.02 || (s.hpFrac !== undefined && s.hpFrac < 0.3);
    if (need) anchors(a);
    const an = a.anchor;
    const yaw = a.object.rotation.y;
    // ombre portée douce (lisibilité vue de haut)
    if (ov.blobShadows && a.object.visible) {
      const k = react === "ko" ? Math.max(0, 1 - (rt - 1.3) / 0.45) : 1;
      now.put(pos.x, pos.y + 0.025, pos.z, d.w * 1.02, C.shadow, 0.02, 0.02, 0.04, 0.42 * k * (1 - 0.6 * w.ghost), yaw - Math.PI / 2, 0, 1, d.d / d.w);
    }
    // gelé : glaçon + yeux écarquillés qui roulent
    if (w.frozen > 0.05) {
      const k = Math.min(1, w.frozen * 1.3);
      const sc = 0.85 + 0.15 * k;
      tmpQ.setFromAxisAngle(UP, yaw);
      tmpS.set(d.w * sc, d.h * (0.2 + 0.8 * k) * sc, d.d * sc);
      tmpP.set(pos.x, pos.y - 0.02, pos.z);
      tmpM.compose(tmpP, tmpQ, tmpS);
      ice.push(tmpM);
      if (k > 0.6) {
        a.lookT -= dt;
        if (a.lookT <= 0) { a.lookT = 0.25 + rnd() * 0.5; a.lookTo[0] = (rnd() - 0.5) * 2; a.lookTo[1] = (rnd() - 0.5) * 2; }
        a.look[0] += (a.lookTo[0] - a.look[0]) * Math.min(1, dt * 18);
        a.look[1] += (a.lookTo[1] - a.look[1]) * Math.min(1, dt * 18);
        const ez = d.d * 0.5 + 0.03;
        const es = 0.3 * a.scale;
        for (let si = 0; si < 2; si++) {
          const e = si ? an.eyeR : an.eyeL;
          // projeté sur la face avant du glaçon
          const dz = (e.x - pos.x) * an.fwd.x + (e.z - pos.z) * an.fwd.z;
          v1.copy(e).addScaledVector(an.fwd, Math.max(0, ez - dz));
          now.put(v1.x, v1.y, v1.z, es, C.eyeWhite, 1, 1, 1, 1, 0, 0);
          now.put(v1.x + an.right.x * a.look[0] * es * 0.2, v1.y + a.look[1] * es * 0.2, v1.z + an.right.z * a.look[0] * es * 0.2, es * 0.42, C.pupil, 1, 1, 1, 1, 0, 0);
        }
        if (every(a, "mist", 0.18, dt)) fx.emitR(R.mist, pos.x + (rnd() - 0.5) * d.w, pos.y + d.h * rnd(), pos.z + (rnd() - 0.5) * d.d, (rnd() - 0.5) * 0.3, -0.2, 0);
      }
    }
    // en feu : flammes qui dansent + fumée + braises
    if (w.burn > 0.05) {
      const k = w.burn;
      const pts = FIRE_PTS;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const fl = 0.75 + 0.35 * Math.sin(t * (13 + i * 3.1) + i * 1.7) + 0.15 * Math.sin(t * 29 + i);
        if (i === 0) v1.copy(an.headTop);
        else v1.copy(an.chest).addScaledVector(an.right, p[0] * d.w * 0.42).addScaledVector(an.fwd, p[2] * 0.4 * a.scale).addScaledVector(UP, p[1] * 1.3 * a.scale);
        now.put(v1.x, v1.y + 0.15 * fl, v1.z, (p[3] || 0.42) * 1.35 * a.scale * fl * k, C.flame, 1, 1, 1, 0.95, Math.sin(t * 7 + i) * 0.15, 0.35, 3);
      }
      const n = every(a, "smoke", 0.09, dt);
      for (let i = 0; i < n; i++) {
        v1.copy(an.chest).addScaledVector(an.right, (rnd() - 0.5) * 0.5).addScaledVector(UP, 0.2 + rnd() * 0.4);
        fx.emitR(R.smoke, v1.x, v1.y, v1.z, (rnd() - 0.5) * 0.4, 1.4 + rnd() * 0.6, (rnd() - 0.5) * 0.4, null, k);
        fx.emitR(R.ember, v1.x, v1.y, v1.z, (rnd() - 0.5) * 1.5, 2 + rnd() * 1.5, (rnd() - 0.5) * 1.5);
      }
    }
    // mouillé : gouttes qui tombent
    if (w.wet > 0.05) {
      const n = every(a, "drip", 0.07, dt);
      for (let i = 0; i < n; i++) {
        v1.set(pos.x, pos.y, pos.z).addScaledVector(an.right, (rnd() - 0.5) * d.w * 0.45).addScaledVector(an.fwd, (rnd() - 0.5) * 0.3);
        v1.y += 0.4 + rnd() * d.h * 0.55;
        fx.emitR(R.drip, v1.x, v1.y, v1.z, 0, -0.4, 0, pos.y + 0.02, w.wet);
      }
      if (every(a, "puddle", 0.5, dt)) fx.emitR(R.puddle, pos.x + (rnd() - 0.5) * 0.4, pos.y + 0.03, pos.z + (rnd() - 0.5) * 0.4, 0, 0, 0, null, w.wet);
    }
    // filet : dôme de corde qui gigote
    if (w.net > 0.05) {
      const k = Math.min(1, w.net * 1.2);
      tmpQ.setFromAxisAngle(UP, yaw + Math.sin(t * 9) * 0.08);
      const wob = 1 + Math.sin(t * 13) * 0.04;
      tmpS.set(d.w * 0.62 * wob, d.h * 1.02 * (0.3 + 0.7 * k) / wob, d.d * 0.62 * wob);
      tmpP.set(pos.x + Math.sin(t * 17) * 0.03, pos.y, pos.z);
      tmpM.compose(tmpP, tmpQ, tmpS);
      net.push(tmpM);
      if (every(a, "netAnger", 0.8, dt)) fx.emitR(R.netAnger, an.headTop.x, an.headTop.y + 0.25, an.headTop.z, 0, 0.4, 0);
    }
    // attiré par le faux coffre : yeux en cœur / en dollars
    if (w.lure > 0.05) {
      const heart = a.lureKind === "heart";
      const cell = heart ? C.heart : C.dollar;
      const beat = 1 + 0.18 * Math.max(0, Math.sin(t * 9));
      for (let si = 0; si < 2; si++) {
        v1.copy(si ? an.eyeR : an.eyeL).addScaledVector(an.fwd, 0.12 * a.scale);
        now.put(v1.x, v1.y, v1.z, 0.36 * a.scale * beat * w.lure, cell, 1, 1, 1, 1, 0, 0);
      }
      if (every(a, "hearts", 0.3, dt)) fx.emitR(heart ? R.heart : R.dollar, an.headTop.x + (rnd() - 0.5) * 0.3, an.headTop.y + 0.1, an.headTop.z + (rnd() - 0.5) * 0.3, (rnd() - 0.5) * 0.3, 0.9, 0);
    }
    // caché dans la fumée : nuage tournant, silhouette tramée (shader)
    if (w.ghost > 0.05) {
      const k = w.ghost;
      const n = 12, hh = Math.min(d.h, 2.4);
      for (let i = 0; i < n; i++) {
        const ang = t * 0.55 + (i * Math.PI * 2) / n + (i % 3) * 0.7;
        const r = d.w * (0.34 + 0.1 * Math.sin(t * 1.3 + i));
        const h = 0.3 + (i % 3) * hh * 0.3 + 0.08 * Math.sin(t * 2 + i);
        const sz = (1.05 + 0.3 * Math.sin(t * 1.7 + i * 2.1)) * k * (0.8 + d.w * 0.25);
        now.put(pos.x + Math.cos(ang) * r, pos.y + h, pos.z + Math.sin(ang) * r, sz, C.puff, 0.6, 0.56, 0.7, 0.9 * k, ang, 0);
      }
      now.put(pos.x, pos.y + hh * 0.55, pos.z, 1.6 * k * (0.8 + d.w * 0.25), C.puff, 0.55, 0.5, 0.66, 0.6 * k, t * 0.3, 0);
      if (every(a, "ghostPuff", 0.2, dt)) fx.emitR(R.ghostPuff, pos.x + (rnd() - 0.5) * d.w, pos.y + 0.2 + rnd() * 1.4, pos.z + (rnd() - 0.5) * d.d, 0, 0.35, 0, null, k);
    }
    // tondeuse en surchauffe : fumée noire, étincelles
    if (w.heat > 0.05 && a.B.p_vehicle) {
      const n = every(a, "exhaust", 0.06, dt);
      for (let i = 0; i < n; i++) fx.emitR(R.exhaust, an.exhaust.x, an.exhaust.y, an.exhaust.z, (rnd() - 0.5) * 0.6 - an.fwd.x * 0.8, 2.2 + rnd(), (rnd() - 0.5) * 0.6 - an.fwd.z * 0.8, null, w.heat);
      if (every(a, "spark", 0.15, dt)) {
        v1.copy(pos).addScaledVector(an.fwd, a.dims.d * 0.4).addScaledVector(UP, 1.0);
        for (let i = 0; i < 3; i++) fx.emitR(R.engineSpark, v1.x, v1.y, v1.z, (rnd() - 0.5) * 4 + an.fwd.x * 2, 2 + rnd() * 3, (rnd() - 0.5) * 4 + an.fwd.z * 2);
      }
    }
    // accéléré : traînée de vitesse (arc-en-ciel pour le patineur)
    if (w.boost > 0.05 && a.speed > 0.1) {
      const n = every(a, "boost", 0.03, dt);
      const skate = a.spec.motion.skate;
      for (let i = 0; i < n; i++) {
        if (skate) {
          tmpColor.setHSL((t * 1.5 + rnd() * 0.2) % 1, 0.9, 0.62).convertSRGBToLinear();
          RAINBOW[0] = tmpColor.r; RAINBOW[1] = tmpColor.g; RAINBOW[2] = tmpColor.b;
        }
        v1.copy(pos).addScaledVector(an.right, (rnd() - 0.5) * d.w * 0.7).addScaledVector(UP, 0.15 + rnd() * (skate ? 0.4 : 1.4));
        fx.emitR(skate ? R.boostRainbow : R.boost, v1.x, v1.y, v1.z, -an.fwd.x * 8, 0, -an.fwd.z * 8, null, w.boost);
        if (i === 0 && rnd() < 0.5) {
          R.boostWind.rot = rnd() > 0.5 ? Math.PI / 2 : -Math.PI / 2;
          fx.emitR(R.boostWind, v1.x - an.fwd.x * 0.6, v1.y, v1.z - an.fwd.z * 0.6, -an.fwd.x * 2, 0, -an.fwd.z * 2, null, w.boost);
        }
      }
    }
    // dans l'eau : ronds + éclaboussures de nage
    if (w.water > 0.3) {
      const n = every(a, "ripple", a.speed > 0.1 ? 0.22 : 0.45, dt);
      R.ripple.s0 = d.w * 0.7; R.ripple.s1 = d.w * 2.0;
      for (let i = 0; i < n; i++) fx.emitR(R.ripple, pos.x - an.fwd.x * 0.2, pos.y + 0.03, pos.z - an.fwd.z * 0.2, 0, 0, 0);
      if (a.spec.motion.swims && !a.spec.motion.boat && every(a, "paddle", 0.16, dt)) {
        v1.copy(pos).addScaledVector(an.fwd, 0.5 * a.scale).addScaledVector(an.right, (rnd() > 0.5 ? 1 : -1) * 0.6 * a.scale);
        for (let i = 0; i < 3; i++) fx.emitR(R.paddle, v1.x, pos.y + 0.1, v1.z, (rnd() - 0.5) * 1.2, 1.5 + rnd() * 1.2, (rnd() - 0.5) * 1.2, pos.y);
      }
    }
    // sac porté : paillettes dorées
    if (s.carrying && a.w.carry > 0.5 && react !== "ko") {
      if (every(a, "sparkle", 0.16, dt)) fx.emitR(R.sackSparkle, an.sack.x + (rnd() - 0.5) * 0.6, an.sack.y + (rnd() - 0.3) * 0.6, an.sack.z + (rnd() - 0.5) * 0.6, 0, 0.3, 0);
      if (every(a, "coinDrip", 1.3, dt) && a.speed > 0.2) fx.emitR(R.coinDrip, an.sack.x, an.sack.y, an.sack.z, (rnd() - 0.5) * 1.5, 2.5, (rnd() - 0.5) * 1.5, pos.y + 0.05);
    }
    // ténacité : petit écusson au-dessus de la tête
    const ten = s.tenacity || 0;
    if (ten > 0.02 && react !== "ko") {
      v1.copy(an.headTop).addScaledVector(UP, 0.32);
      now.put(v1.x, v1.y, v1.z, (0.26 + 0.14 * ten) * a.scale, C.shield, 1, 1, 1, 0.45 + 0.55 * ten, 0, 0);
    }
    // à bout de forces : gouttes de sueur
    if (s.hpFrac !== undefined && s.hpFrac < 0.3 && react !== "ko" && every(a, "sweat", 0.45, dt)) {
      const sgn = rnd() > 0.5 ? 1 : -1;
      v1.copy(an.headTop).addScaledVector(an.right, sgn * 0.3 * a.scale).addScaledVector(UP, -0.15 * a.scale);
      R.sweat.rot = -sgn * 0.5;
      fx.emitR(R.sweat, v1.x, v1.y, v1.z, an.right.x * sgn * 1.2, 1.4, an.right.z * sgn * 1.2);
    }
    // K.-O. : étoiles qui tournent, puis « pouf »
    if (react === "ko") {
      if (rt < 1.35) {
        const hs = a.scale;
        for (let i = 0; i < 5; i++) {
          const ang = t * 6 + (i * Math.PI * 2) / 5;
          v1.copy(an.head).addScaledVector(UP, 0.35 * hs);
          now.put(v1.x + Math.cos(ang) * 0.55 * hs, v1.y + 0.2 + Math.sin(ang * 2) * 0.06, v1.z + Math.sin(ang) * 0.55 * hs, 0.26 * hs, C.star, 1, 1, 1, 1, ang, 0);
        }
      }
      if (rt > 1.2 && !a._poofed) {
        a._poofed = true;
        const cy = pos.y + (a.spec.motion.vehicle ? 1.0 : 0.45);
        for (let i = 0; i < 12; i++) {
          const ang = (i / 12) * Math.PI * 2;
          fx.emit({ x: pos.x, y: cy, z: pos.z, vx: Math.cos(ang) * 3.2, vy: 0.6 + rnd() * 1.2, vz: Math.sin(ang) * 3.2, drag: 4, life: 0.75, s0: 0.75, s1: 1.5, cell: C.poof, a: 1, a1: 0, rot: rnd() * 6, fadeOut: 0.55, curve: 2 });
        }
        for (let i = 0; i < 6; i++) fx.emit({ x: pos.x, y: cy + 0.3, z: pos.z, vx: (rnd() - 0.5) * 3, vy: 2 + rnd() * 2, vz: (rnd() - 0.5) * 3, grav: 6, life: 0.7, s0: 0.2, s1: 0.1, cell: C.star, a: 1, a1: 0, spin: 6 });
      }
    } else a._poofed = false;
  };
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
  ov.burst = function (a, name) {
    if (!root) return;
    anchors(a);
    const an = a.anchor, pos = a.object.position, d = a.dims;
    const E = (o) => fx.emit(o);
    switch (name) {
      case "hit": {
        v1.copy(an.chest).addScaledVector(an.fwd, 0.4 * a.scale);
        E({ x: v1.x, y: v1.y, z: v1.z, life: 0.18, s0: 0.35, s1: 0.9, cell: C.zap, r: 1, g: 0.95, b: 0.7, a: 1, a1: 0, rot: rnd() * 6, add: 0.6 });
        for (let i = 0; i < 5; i++) E({ x: v1.x, y: v1.y, z: v1.z, vx: (rnd() - 0.5) * 5, vy: 1 + rnd() * 3, vz: (rnd() - 0.5) * 5, grav: 8, life: 0.35, s0: 0.12, s1: 0.04, cell: C.spark, mode: 2, stretch: 0.05, r: 1, g: 0.9, b: 0.5, a: 1, a1: 0, add: 1 });
        break;
      }
      case "knockback": {
        for (let i = 0; i < 7; i++) E({ x: pos.x + (rnd() - 0.5) * 0.6, y: pos.y + 0.1, z: pos.z + (rnd() - 0.5) * 0.6, vx: (rnd() - 0.5) * 2 - an.fwd.x, vy: 0.8 + rnd(), vz: (rnd() - 0.5) * 2 - an.fwd.z, drag: 3, life: 0.7, s0: 0.3, s1: 0.8, cell: C.puff, r: 0.78, g: 0.7, b: 0.58, a: 0.8, a1: 0, rot: rnd() * 6, curve: 1 });
        v1.copy(an.chest);
        E({ x: v1.x, y: v1.y, z: v1.z, life: 0.2, s0: 0.5, s1: 1.2, cell: C.zap, r: 1, g: 1, b: 0.85, a: 1, a1: 0, add: 0.5 });
        break;
      }
      case "pull": {
        E({ x: pos.x, y: pos.y + 0.05, z: pos.z, life: 0.9, s0: d.w * 1.2, s1: d.w * 0.4, cell: C.swirl, mode: 1, r: 0.6, g: 0.95, b: 1, a: 0.8, a1: 0, spin: -9, add: 0.4 });
        for (let i = 0; i < 8; i++) {
          const ang = (i / 8) * Math.PI * 2;
          E({ x: pos.x, y: pos.y + 0.3 + rnd(), z: pos.z, vx: 0.9, vy: -0.5, vz: 10, mode: 4, grav: 0.3, angle0: ang, life: 0.7, s0: 0.1, s1: 0.05, cell: C.drop, r: 0.7, g: 0.95, b: 1, a: 1, a1: 0 });
        }
        break;
      }
      case "ko": {
        v1.copy(an.head);
        for (let i = 0; i < 6; i++) E({ x: v1.x, y: v1.y, z: v1.z, vx: (rnd() - 0.5) * 4, vy: 2 + rnd() * 2, vz: (rnd() - 0.5) * 4, grav: 8, life: 0.6, s0: 0.2, s1: 0.1, cell: C.star, a: 1, a1: 0, spin: 8 });
        E({ x: v1.x, y: v1.y, z: v1.z, life: 0.22, s0: 0.5, s1: 1.3, cell: C.zap, r: 1, g: 1, b: 0.8, a: 1, a1: 0, add: 0.6 });
        break;
      }
      case "steal": {
        v1.copy(an.headTop).addScaledVector(UP, 0.35);
        E({ x: v1.x, y: v1.y, z: v1.z, vy: 0.5, life: 0.9, s0: 0.3, s1: 0.42, cell: C.exclaim, a: 1, a1: 1, fadeOut: 0.75, curve: 2 });
        for (let i = 0; i < 8; i++) E({ x: an.sack.x, y: an.sack.y, z: an.sack.z, vx: (rnd() - 0.5) * 3, vy: 3 + rnd() * 2.5, vz: (rnd() - 0.5) * 3, grav: 11, life: 0.8, s0: 0.16, s1: 0.16, cell: C.coin, a: 1, a1: 0.6, floor: pos.y + 0.05, fadeOut: 0.75, spin: (rnd() - 0.5) * 10 });
        for (let i = 0; i < 8; i++) E({ x: an.sack.x + (rnd() - 0.5) * 0.8, y: an.sack.y + (rnd() - 0.5) * 0.8, z: an.sack.z + (rnd() - 0.5) * 0.8, life: 0.5, s0: 0.05, s1: 0.35, cell: C.twinkle, r: 1, g: 0.85, b: 0.3, a: 1, a1: 0, add: 1, delay: rnd() * 0.2, curve: 2 });
        break;
      }
      case "drop": {
        v1.copy(an.headTop).addScaledVector(UP, 0.35);
        E({ x: v1.x, y: v1.y, z: v1.z, vy: 0.4, life: 0.9, s0: 0.3, s1: 0.4, cell: C.question, a: 1, a1: 1, fadeOut: 0.7, curve: 2 });
        for (let i = 0; i < 6; i++) E({ x: pos.x - an.fwd.x * 0.4, y: pos.y + 0.1, z: pos.z - an.fwd.z * 0.4, vx: (rnd() - 0.5) * 2, vy: 0.5 + rnd(), vz: (rnd() - 0.5) * 2, drag: 3, life: 0.6, s0: 0.25, s1: 0.6, cell: C.puff, r: 0.8, g: 0.72, b: 0.6, a: 0.8, a1: 0, curve: 1 });
        for (let i = 0; i < 4; i++) E({ x: an.sack.x, y: an.sack.y, z: an.sack.z, vx: (rnd() - 0.5) * 2.5, vy: 2 + rnd() * 1.5, vz: (rnd() - 0.5) * 2.5, grav: 11, life: 0.7, s0: 0.15, s1: 0.15, cell: C.coin, a: 1, a1: 0.5, floor: pos.y + 0.05, fadeOut: 0.7 });
        break;
      }
      case "helmetOff": {
        v1.copy(an.headTop);
        E({ x: v1.x, y: v1.y, z: v1.z, life: 0.22, s0: 0.4, s1: 1.0, cell: C.zap, r: 1, g: 1, b: 0.9, a: 1, a1: 0, add: 0.5 });
        for (let i = 0; i < 4; i++) E({ x: v1.x, y: v1.y, z: v1.z, vx: (rnd() - 0.5) * 3, vy: 1.5 + rnd() * 2, vz: (rnd() - 0.5) * 3, grav: 6, life: 0.6, s0: 0.16, s1: 0.1, cell: C.star, a: 1, a1: 0, spin: 7 });
        break;
      }
      case "flipflops": {
        for (let i = 0; i < 6; i++) E({ x: pos.x + (rnd() - 0.5) * 0.4, y: pos.y + 0.08, z: pos.z + (rnd() - 0.5) * 0.4, vx: (rnd() - 0.5) * 2, vy: 0.6 + rnd(), vz: (rnd() - 0.5) * 2, drag: 3, life: 0.6, s0: 0.2, s1: 0.55, cell: C.puff, r: 0.82, g: 0.75, b: 0.62, a: 0.8, a1: 0, curve: 1 });
        v1.copy(an.headTop).addScaledVector(UP, 0.35);
        E({ x: v1.x, y: v1.y, z: v1.z, vy: 0.4, life: 0.7, s0: 0.28, s1: 0.36, cell: C.exclaim, a: 1, a1: 1, fadeOut: 0.7, curve: 2 });
        break;
      }
      case "smokePuff": {
        const n = ov.mobile ? 10 : 18;
        for (let i = 0; i < n; i++) {
          const ang = rnd() * Math.PI * 2, sp = 1.5 + rnd() * 2.5;
          E({ x: pos.x, y: pos.y + 0.3 + rnd() * 1.2, z: pos.z, vx: Math.cos(ang) * sp, vy: rnd() * 1.2, vz: Math.sin(ang) * sp, drag: 3.5, life: 1.1 + rnd() * 0.4, s0: 0.5, s1: 1.5, cell: C.puff, r: 0.62, g: 0.58, b: 0.74, a: 0.9, a1: 0, rot: rnd() * 6, spin: (rnd() - 0.5), curve: 1, fadeOut: 0.6 });
        }
        E({ x: pos.x, y: pos.y + 0.9, z: pos.z, life: 0.25, s0: 0.6, s1: 2.2, cell: C.glow, r: 0.9, g: 0.85, b: 1, a: 0.8, a1: 0, add: 0.8 });
        break;
      }
      case "overheat": {
        v1.copy(an.exhaust.lengthSq() > 0 ? an.exhaust : an.chest);
        for (let i = 0; i < 14; i++) E({ x: v1.x, y: v1.y, z: v1.z, vx: (rnd() - 0.5) * 3, vy: 2 + rnd() * 2, vz: (rnd() - 0.5) * 3, drag: 2, life: 1.3, s0: 0.4, s1: 1.4, cell: C.puffDark, r: 0.12, g: 0.11, b: 0.12, a: 0.9, a1: 0, rot: rnd() * 6, spin: 1, curve: 1 });
        for (let i = 0; i < 5; i++) E({ x: v1.x, y: v1.y, z: v1.z, vx: (rnd() - 0.5) * 5, vy: 4 + rnd() * 3, vz: (rnd() - 0.5) * 5, grav: 12, life: 0.9, s0: 0.14, s1: 0.14, cell: C.nut, a: 1, a1: 0.6, spin: (rnd() - 0.5) * 16, floor: pos.y + 0.05 });
        E({ x: v1.x, y: v1.y, z: v1.z, life: 0.25, s0: 0.8, s1: 2.5, cell: C.glow, r: 1, g: 0.5, b: 0.15, a: 1, a1: 0, add: 1 });
        break;
      }
      case "rage": {
        v1.copy(an.headTop).addScaledVector(UP, 0.2);
        for (let i = 0; i < 2; i++) E({ x: v1.x + (i - 0.5) * 0.4, y: v1.y, z: v1.z, vy: 0.5, life: 0.9, s0: 0.25, s1: 0.38, cell: C.anger, a: 1, a1: 0, delay: i * 0.25, curve: 2, fadeOut: 0.7 });
        for (const sgn of [-1, 1]) {
          for (let i = 0; i < 6; i++) {
            v2.copy(an.head).addScaledVector(an.right, sgn * 0.15);
            E({ x: v2.x, y: v2.y, z: v2.z, vx: an.right.x * sgn * 2.5, vy: 1.2 + rnd(), vz: an.right.z * sgn * 2.5, drag: 2.5, life: 0.7, s0: 0.15, s1: 0.55, cell: C.puffDark, r: 1, g: 1, b: 1, a: 0.85, a1: 0, delay: i * 0.08, curve: 1 });
          }
        }
        if (a.spec.motion.vehicle) for (let i = 0; i < 8; i++) E({ x: pos.x - an.fwd.x * 1.2 + (rnd() - 0.5), y: pos.y + 0.2, z: pos.z - an.fwd.z * 1.2 + (rnd() - 0.5), vx: -an.fwd.x * 3 + (rnd() - 0.5) * 2, vy: 1 + rnd(), vz: -an.fwd.z * 3 + (rnd() - 0.5) * 2, drag: 2, life: 0.8, s0: 0.4, s1: 1.1, cell: C.puff, r: 0.75, g: 0.68, b: 0.55, a: 0.8, a1: 0, curve: 1 });
        break;
      }
      case "splash": {
        const n = ov.mobile ? 10 : 18;
        for (let i = 0; i < n; i++) {
          const ang = rnd() * Math.PI * 2, sp = 1 + rnd() * 2.2;
          E({ x: pos.x, y: pos.y + 0.2, z: pos.z, vx: Math.cos(ang) * sp, vy: 3 + rnd() * 3, vz: Math.sin(ang) * sp, grav: 11, life: 0.8, s0: 0.12, s1: 0.08, cell: C.drop, mode: 2, stretch: 0.05, r: 0.75, g: 0.93, b: 1, a: 1, a1: 0.4, floor: pos.y });
        }
        E({ x: pos.x, y: pos.y + 0.03, z: pos.z, life: 0.8, s0: 0.5, s1: 2.8, cell: C.ripple, mode: 1, r: 1, g: 1, b: 1, a: 0.8, a1: 0, curve: 1 });
        E({ x: pos.x, y: pos.y + 0.45, z: pos.z, life: 0.45, s0: 0.6, s1: 1.4, cell: C.splash, mode: 3, r: 0.85, g: 0.97, b: 1, a: 0.95, a1: 0, curve: 1 });
        break;
      }
      case "fooled": {
        v1.copy(an.headTop).addScaledVector(UP, 0.25);
        E({ x: v1.x, y: v1.y, z: v1.z, vy: 0.8, drag: 1, life: 0.9, s0: 0.5, s1: 1.0, cell: C.puffDark, r: 0.25, g: 0.23, b: 0.25, a: 0.85, a1: 0, rot: rnd() * 6, curve: 1 });
        E({ x: v1.x + 0.15, y: v1.y + 0.15, z: v1.z, vy: 0.4, life: 0.9, s0: 0.3, s1: 0.42, cell: C.anger, a: 1, a1: 0, curve: 2, fadeOut: 0.75, delay: 0.05 });
        for (let i = 0; i < 4; i++) E({ x: pos.x + (rnd() - 0.5) * 0.5, y: pos.y + 0.08, z: pos.z + (rnd() - 0.5) * 0.5, vx: (rnd() - 0.5) * 1.5, vy: 0.4, vz: (rnd() - 0.5) * 1.5, drag: 3, life: 0.5, s0: 0.2, s1: 0.45, cell: C.puff, r: 0.8, g: 0.74, b: 0.62, a: 0.7, a1: 0, delay: 0.1 + i * 0.12, curve: 1 });
        break;
      }
    }
  };
})();
