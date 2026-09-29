// « Pas touche à mes trésors » — les ennemis animés (PTMT.actors).
//
//   await PTMT.actors.load(glbUrl);             // charge et prépare le personnage de base une seule fois
//   const a = PTMT.actors.create(type, elite);  // réutilisé depuis une réserve
//   a.object  a.update(dt, time, s)  a.event(name)  a.release()  a.height
//
// Rendu : un seul SkinnedMesh par ennemi (corps + visage + accessoires fusionnés, une matière par variante),
// soit un appel de dessin (+ ombre). Les doigts sont figés dans une pose naturelle et fondus dans la main
// (23 os animés au lieu de 65). Les données par instance (éclair de coup, mouillé, gelé, brûlé, fantôme,
// dissolution, surchauffe) passent par un « os de données » détaché lu par le shader : aucune matière par
// instance. Les états visibles (glaçon, filet, flammes, fumée, étoiles…) sont dessinés en lots instanciés
// partagés par tous les ennemis (12-overlay.js).
(function () {
  "use strict";
  if (typeof THREE === "undefined") return; // rendu seulement : sans three.js (banc de simulation), rien à enregistrer
  const PTMT = (globalThis.PTMT = globalThis.PTMT || {});
  const A = (PTMT.actors = PTMT.actors || {});

  const KEEP = [
    "root", "pelvis", "spine_01", "spine_02", "spine_03", "neck_01", "Head",
    "clavicle_l", "upperarm_l", "lowerarm_l", "hand_l", "clavicle_r", "upperarm_r", "lowerarm_r", "hand_r",
    "thigh_l", "calf_l", "foot_l", "ball_l", "thigh_r", "calf_r", "foot_r", "ball_r",
  ];
  const PART = { skin: 0, sweater: 1, shorts: 2, shoes: 3, brows: 4, eyes: 5, hairLong: 6, hairShort: 7 };
  const CLIPS = ["Idle_Loop", "Walk_Loop", "Jog_Fwd_Loop", "Sprint_Loop", "Jump_Start", "Jump_Loop", "Jump_Land", "Driving_Loop"];
  const IDENTITY = () => new THREE.Matrix4();

  let BASE = null;
  const TEMPLATES = new Map();
  const POOLS = new Map();
  A.actives = new Set();

  // ---------------------------------------------------------------------------------------------
  // Chargement
  // ---------------------------------------------------------------------------------------------
  async function fetchGlb(url) {
    // Accepte une adresse ou des octets déjà téléchargés (le chargeur du jeu les récupère d'avance).
    let buf;
    if (url instanceof ArrayBuffer) buf = url;
    else if (ArrayBuffer.isView(url)) buf = url.buffer.slice(url.byteOffset, url.byteOffset + url.byteLength);
    else {
      const res = await fetch(url);
      if (!res.ok) throw new Error("PTMT.actors : le personnage n’a pas pu être téléchargé (" + res.status + ")");
      buf = await res.arrayBuffer();
    }
    const head = new Uint8Array(buf, 0, 2);
    if (head[0] === 0x1f && head[1] === 0x8b) {
      if (typeof DecompressionStream !== "undefined") {
        buf = await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();
      } else if (globalThis.MoulinGunzip30) {
        const out = globalThis.MoulinGunzip30(new Uint8Array(buf));
        buf = out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength);
      } else throw new Error("PTMT.actors : décompression gzip indisponible dans ce navigateur");
    }
    return buf;
  }

  A.load = function (url) {
    if (BASE) return Promise.resolve(A);
    if (A._loading) return A._loading;
    A._loading = (async () => {
      const buf = await fetchGlb(url);
      const gltf = await new Promise((ok, ko) => new THREE.GLTFLoader().parse(buf, "", ok, ko));
      BASE = prepareBase(gltf);
      for (const t of A.TYPES) for (const e of [false, true]) templateFor(t, e);
      if (A.overlay && A.overlay.init) A.overlay.init();
      A.ready = true;
      return A;
    })();
    return A._loading;
  };

  // ---------------------------------------------------------------------------------------------
  // Préparation du personnage de base
  // ---------------------------------------------------------------------------------------------
  function attrGet(attr, i, c) {
    let v = c === 0 ? attr.getX(i) : c === 1 ? attr.getY(i) : c === 2 ? attr.getZ(i) : attr.getW(i);
    if (attr.normalized) {
      const arr = attr.isInterleavedBufferAttribute ? attr.data.array : attr.array;
      if (arr instanceof Uint8Array) v /= 255;
      else if (arr instanceof Uint16Array) v /= 65535;
    }
    return v;
  }

  function prepareBase(gltf) {
    const scene = gltf.scene;
    scene.updateMatrixWorld(true);
    const meshes = [];
    scene.traverse((o) => { if (o.isSkinnedMesh) meshes.push(o); });
    if (!meshes.length) throw new Error("PTMT.actors : aucun maillage animé dans le modèle");
    const skeleton = meshes[0].skeleton;
    skeleton.pose();
    scene.updateMatrixWorld(true);

    // Doigts : pose détendue prise dans l'animation de repos, puis fondue dans la géométrie
    const fingerRe = /^(index|middle|pinky|ring|thumb)_0\d_(l|r)$/;
    const idle = gltf.animations.find((c) => c.name === "Idle_Loop");
    if (idle) {
      const tracks = idle.tracks.filter((t) => fingerRe.test(t.name.split(".")[0]) && t.name.endsWith(".quaternion"));
      const mixer = new THREE.AnimationMixer(scene);
      mixer.clipAction(new THREE.AnimationClip("fingers", idle.duration, tracks)).play();
      mixer.setTime(0.3);
      scene.updateMatrixWorld(true);
    }

    // Os conservés : pose de liaison (monde)
    const byName = {};
    for (const b of skeleton.bones) byName[b.name] = b;
    const keepIndex = {};
    KEEP.forEach((n, i) => (keepIndex[n] = i));
    const restWorld = KEEP.map((n) => new THREE.Matrix4().copy(skeleton.boneInverses[skeleton.bones.indexOf(byName[n])]).invert());
    const bones = KEEP.map((n, i) => {
      const b = byName[n];
      let p = b.parent, parent = null;
      while (p && p.isBone) { if (keepIndex[p.name] !== undefined) { parent = p.name; break; } p = p.parent; }
      const local = new THREE.Matrix4();
      if (parent) local.copy(restWorld[keepIndex[parent]]).invert().multiply(restWorld[i]);
      else local.copy(restWorld[i]);
      const pos = new THREE.Vector3(), quat = new THREE.Quaternion(), scl = new THREE.Vector3();
      local.decompose(pos, quat, scl);
      const wp = new THREE.Vector3(), wq = new THREE.Quaternion(), ws = new THREE.Vector3();
      restWorld[i].decompose(wp, wq, ws);
      return { name: n, parent, pos, quat, scale: scl, world: restWorld[i], worldPos: wp, worldQuat: wq, inverse: new THREE.Matrix4().copy(restWorld[i]).invert() };
    });
    // correspondance os d'origine -> os conservé (doigts -> main, pointe du pied -> pied)
    function keptFor(bone) {
      let b = bone;
      while (b && keepIndex[b.name] === undefined) b = b.parent;
      return b ? keepIndex[b.name] : 0;
    }

    // Géométrie du corps, par partie (sommets dupliqués aux coutures)
    const parts = {};
    const partOf = (mesh) => {
      const mn = (mesh.material && mesh.material.name) || "";
      if (mesh.name === "Eyebrows") return PART.brows;
      if (mesh.name === "Eyes") return PART.eyes;
      if (mesh.name === "Hair_Long") return PART.hairLong;
      if (mesh.name === "Hair_SimpleParted") return PART.hairShort;
      if (/^Peau/.test(mn)) return PART.skin;
      if (/^Sweat/.test(mn)) return PART.sweater;
      if (/^Short/.test(mn)) return PART.shorts;
      if (/^Basket/.test(mn)) return PART.shoes;
      return -1;
    };
    let skinTex = null, eyeTex = null;
    const v = new THREE.Vector3(), n = new THREE.Vector3(), acc = new THREE.Vector3(), accN = new THREE.Vector3();
    const m3 = new THREE.Matrix3();
    for (const mesh of meshes) {
      const pid = partOf(mesh);
      if (pid < 0) continue;
      if (pid === PART.skin && mesh.material.map) skinTex = mesh.material.map;
      if (pid === PART.eyes && mesh.material.map) eyeTex = mesh.material.map;
      const g = mesh.geometry;
      const P = g.getAttribute("position"), N = g.getAttribute("normal"), U = g.getAttribute("uv");
      const SI = g.getAttribute("skinIndex"), SW = g.getAttribute("skinWeight");
      const sk = mesh.skeleton;
      const boneMats = sk.bones.map((b, i) => new THREE.Matrix4().multiplyMatrices(b.matrixWorld, sk.boneInverses[i]));
      const kept = sk.bones.map((b) => keptFor(b));
      const idx = g.index.array;
      const remap = new Map();
      const order = [];
      for (let i = 0; i < idx.length; i++) if (!remap.has(idx[i])) { remap.set(idx[i], order.length); order.push(idx[i]); }
      const cnt = order.length;
      const pos = new Float32Array(cnt * 3), nor = new Float32Array(cnt * 3), uv = new Float32Array(cnt * 2);
      const si = new Uint16Array(cnt * 4), sw = new Float32Array(cnt * 4);
      const tmpW = new Float32Array(KEEP.length);
      for (let k = 0; k < cnt; k++) {
        const i = order[k];
        v.set(P.getX(i), P.getY(i), P.getZ(i)).applyMatrix4(mesh.bindMatrix);
        n.set(N.getX(i), N.getY(i), N.getZ(i)).transformDirection(mesh.bindMatrix);
        acc.set(0, 0, 0); accN.set(0, 0, 0);
        tmpW.fill(0);
        for (let c = 0; c < 4; c++) {
          const w = attrGet(SW, i, c);
          if (w <= 0) continue;
          const j = Math.round(attrGet(SI, i, c));
          acc.addScaledVector(v.clone().applyMatrix4(boneMats[j]), w);
          m3.setFromMatrix4(boneMats[j]);
          accN.addScaledVector(n.clone().applyMatrix3(m3), w);
          tmpW[kept[j]] += w;
        }
        accN.normalize();
        pos[k * 3] = acc.x; pos[k * 3 + 1] = acc.y; pos[k * 3 + 2] = acc.z;
        nor[k * 3] = accN.x; nor[k * 3 + 1] = accN.y; nor[k * 3 + 2] = accN.z;
        if (U) { uv[k * 2] = U.getX(i); uv[k * 2 + 1] = U.getY(i); }
        // 4 influences les plus fortes, renormalisées
        const best = [];
        for (let b = 0; b < KEEP.length; b++) if (tmpW[b] > 0.001) best.push([b, tmpW[b]]);
        best.sort((a, b) => b[1] - a[1]);
        let tot = 0;
        for (let c = 0; c < Math.min(4, best.length); c++) tot += best[c][1];
        for (let c = 0; c < 4; c++) {
          si[k * 4 + c] = c < best.length ? best[c][0] : 0;
          sw[k * 4 + c] = c < best.length ? best[c][1] / tot : 0;
        }
      }
      const index = new Uint32Array(idx.length);
      for (let i = 0; i < idx.length; i++) index[i] = remap.get(idx[i]);
      parts[pid] = { pos, nor, uv, si, sw, index, count: cnt };
    }

    // Animations : seulement les os conservés (le bassin garde sa translation)
    const clips = {};
    for (const clip of gltf.animations) {
      const tracks = clip.tracks.filter((t) => {
        const dot = t.name.lastIndexOf(".");
        const node = t.name.slice(0, dot), prop = t.name.slice(dot + 1);
        if (node === "root") return false;
        if (keepIndex[node] === undefined) return false;
        return prop === "quaternion" || (node === "pelvis" && prop === "position");
      });
      const c = new THREE.AnimationClip(clip.name, clip.duration, tracks);
      c.optimize();
      clips[clip.name] = c;
    }

    const base = { bones, keepIndex, parts, clips, skinTex, eyeTex, poses: {} };
    // Axes du personnage exprimés dans le repère local de chaque os (rotations procédurales)
    base.axes = {};
    for (const b of bones) {
      const inv = b.worldQuat.clone().invert();
      base.axes[b.name] = {
        x: new THREE.Vector3(1, 0, 0).applyQuaternion(inv),
        y: new THREE.Vector3(0, 1, 0).applyQuaternion(inv),
        z: new THREE.Vector3(0, 0, 1).applyQuaternion(inv),
      };
    }
    buildPoses(base);
    return base;
  }

  // ---------------------------------------------------------------------------------------------
  // Bibliothèque de poses de bras (résolues une fois sur la pose de repos)
  // ---------------------------------------------------------------------------------------------
  // Directions dans le repère du personnage (+X gauche, +Y haut, +Z avant), bras gauche ; le droit est
  // obtenu par symétrie. d1 = bras, d2 = avant-bras, d3 = main (facultatif), t1/t2 = torsions.
  const POSE_DEFS = {
    down: { d1: [0.18, -1, 0.02], d2: [0.12, -1, 0.18] },
    // sac jeté sur l'épaule droite : les deux mains tiennent la corde devant l'épaule
    carryBoth: { l: { d1: [-0.04, -0.78, 0.63], d2: [-0.93, 0.3, 0.17], t2: 0.5 }, r: { d1: [0.53, -0.51, 0.67], d2: [-0.37, 0.85, -0.37] } },
    carryR: { r: { d1: [0.53, -0.51, 0.67], d2: [-0.37, 0.85, -0.37] } },
    mattress: { d1: [0.85, -0.05, -0.25], d2: [0.25, 0.65, -0.72], t2: -0.4 },
    shield: { d1: [0.28, -0.3, 0.92], d2: [0.08, 0.12, 1], t1: -0.6 },
    waist: { d1: [0.4, -0.9, 0.08], d2: [0.45, -0.72, 0.52], t2: 0.9 },
    overhead: { d1: [0.42, 0.9, 0.08], d2: [-0.05, 1, 0.02] },
    sneak: { d1: [0.2, -0.62, 0.76], d2: [-0.28, 0.85, 0.44], d3: [-0.1, -0.35, 0.95], t2: 0.5 },
    naruto: { d1: [0.25, -0.42, -0.87], d2: [0.18, -0.25, -0.95] },
    flailA: { d1: [0.45, 0.88, 0.18], d2: [0.2, 0.95, 0.3] },
    flailB: { d1: [0.85, 0.5, -0.1], d2: [0.9, 0.2, 0.35] },
    swimA: { d1: [0.45, -0.15, 0.88], d2: [0.25, -0.35, 0.9] },
    swimB: { d1: [0.85, -0.35, -0.35], d2: [0.55, -0.7, -0.4] },
    reach: { d1: [0.14, 0.02, 1], d2: [0.04, 0.08, 1] },
    fist: { r: { d1: [0.3, 0.9, 0.25], d2: [0.05, 0.98, 0.2] }, l: { d1: [0.3, -0.95, 0.1], d2: [0.1, -0.9, 0.4] } },
    cheer: { d1: [0.6, 0.78, 0.12], d2: [0.45, 0.9, 0.05] },
    shrug: { d1: [0.45, -0.85, 0.2], d2: [0.7, 0.3, 0.65] },
  };
  function buildPoses(base) {
    const Y = new THREE.Vector3(0, 1, 0);
    const B = {};
    for (const b of base.bones) B[b.name] = b;
    const vec = (a, mirror) => new THREE.Vector3(mirror ? -a[0] : a[0], a[1], a[2]).normalize();
    function solve(side, def) {
      const mirror = side === "r";
      const c = B["clavicle_" + side], u = B["upperarm_" + side], l = B["lowerarm_" + side], h = B["hand_" + side];
      const qC = c.worldQuat;
      const qU0 = qC.clone().multiply(u.quat);
      const d1 = vec(def.d1, mirror), d2 = vec(def.d2, mirror);
      const qU = new THREE.Quaternion().setFromUnitVectors(Y.clone().applyQuaternion(qU0), d1).multiply(qU0);
      if (def.t1) qU.premultiply(new THREE.Quaternion().setFromAxisAngle(d1, mirror ? -def.t1 : def.t1));
      const uLocal = qC.clone().invert().multiply(qU);
      const qL0 = qU.clone().multiply(l.quat);
      const qL = new THREE.Quaternion().setFromUnitVectors(Y.clone().applyQuaternion(qL0), d2).multiply(qL0);
      if (def.t2) qL.premultiply(new THREE.Quaternion().setFromAxisAngle(d2, mirror ? -def.t2 : def.t2));
      const lLocal = qU.clone().invert().multiply(qL);
      let hLocal = h.quat.clone();
      if (def.d3) {
        const qH0 = qL.clone().multiply(h.quat);
        const qH = new THREE.Quaternion().setFromUnitVectors(Y.clone().applyQuaternion(qH0), vec(def.d3, mirror)).multiply(qH0);
        hLocal = qL.clone().invert().multiply(qH);
      }
      return [uLocal, lLocal, hLocal];
    }
    for (const name in POSE_DEFS) {
      const def = POSE_DEFS[name];
      const pose = { l: null, r: null };
      for (let si = 0; si < 2; si++) { const side = SIDES[si];
        const d = def.d1 ? def : def[side];
        if (d) pose[side] = solve(side, d);
      }
      base.poses[name] = pose;
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Matière d'une variante (partagée par toutes ses instances)
  // ---------------------------------------------------------------------------------------------
  const VERT_PARS = /* glsl */ `
    attribute vec2 aMat;
    varying vec2 vMat;
    varying vec3 vRest;
    varying vec4 vFx0;
    varying vec4 vFx1;
    varying vec4 vFx2;
    uniform float uDataBone;
  `;
  const VERT_MAIN = /* glsl */ `
    vMat = aMat;
    vRest = position;
    #ifdef USE_SKINNING
      mat4 ptData = getBoneMatrix(uDataBone);
      vFx0 = ptData[0]; vFx1 = ptData[1]; vFx2 = ptData[2];
    #else
      vFx0 = vec4(0.0); vFx1 = vec4(0.0); vFx2 = vec4(0.0);
    #endif
  `;
  const FRAG_PARS = /* glsl */ `
    varying vec2 vMat;
    varying vec3 vRest;
    varying vec4 vFx0;
    varying vec4 vFx1;
    varying vec4 vFx2;
    uniform sampler2D uEyeMap;
    uniform vec3 uSkinTint, uHair, uSweaterA, uSweaterB, uShorts, uShoes, uSole, uTrousers, uSocks, uSocks2, uGloves, uPatA;
    uniform vec4 uCut;   // x manche, y haut du pantalon, z ourlet, w gants
    uniform vec4 uCut2;  // x haut des chaussettes, y rayures du sweat, z torse nu, w pieds nus
    uniform vec4 uCut3;  // x encolure débardeur, y fréquence du coutil, z, w
    uniform float uTime;
    ${"PTMT_NOISE"}
    float ptBayer(vec2 p){
      vec2 q = mod(floor(p), 4.0);
      float i = q.x + q.y * 4.0;
      // matrice de Bayer 4x4 dépliée
      float b = mod(i * 7.0 + floor(i / 4.0) * 5.0, 16.0);
      return (b + 0.5) / 16.0;
    }
  `;
  const FRAG_ALBEDO = /* glsl */ `
    float ptPart = floor(vMat.x + 0.5);
    float ptCls = floor(vMat.y + 0.5);
    // fantôme (fumigène) et dissolution (K.-O.) : transparence tramée, sans tri
    float ptGhost = vFx1.x, ptDiss = vFx1.y;
    if (ptGhost > 0.01 && ptBayer(gl_FragCoord.xy) < ptGhost * 0.82) discard;
    float ptN = 0.0;
    if (ptDiss > 0.001) { ptN = ptNoise3(vRest * 22.0); if (ptN < ptDiss) discard; }
    vec4 ptSkinT = mapTexelToLinear(texture2D(map, vUv));
    vec3 ptSkin = ptSkinT.rgb * uSkinTint;
    vec3 ptAlb = vec3(1.0);
    float ptAx = abs(vRest.x);
    float ptRough = 0.82;
    if (ptPart < 0.5) {
      ptAlb = ptSkin; ptRough = 0.62;
      if (ptAx > uCut.w) { ptAlb = uGloves; ptRough = 0.7; }
      else if (ptAx < 0.3 && vRest.y < 0.7) {
        if (vRest.y > uCut.z && vRest.y < uCut.y) { ptAlb = uTrousers; ptRough = 0.88; }
        else if (vRest.y < uCut2.x) {
          float band = step(uCut2.x - 0.075, vRest.y) * step(vRest.y, uCut2.x - 0.05) + step(uCut2.x - 0.035, vRest.y) * step(vRest.y, uCut2.x - 0.012);
          ptAlb = mix(uSocks, uSocks2, band); ptRough = 0.9;
        }
      }
    } else if (ptPart < 1.5) {
      bool bare = uCut2.z > 0.5 || ptAx > uCut.x;
      if (!bare && uCut3.x > 0.5 && vRest.y > 1.47 - 0.9 * ptAx * ptAx * 10.0 && ptAx < 0.08 && vRest.z > 0.03) bare = true;
      if (bare) { ptAlb = ptSkin; ptRough = 0.62; }
      else {
        float sc = ptAx > 0.24 ? ptAx : vRest.y;
        float st = uCut2.y > 0.0 ? step(0.5, fract(sc * uCut2.y)) : 0.0;
        ptAlb = mix(uSweaterA, uSweaterB, st);
        ptRough = 0.9;
      }
      if (ptAx > uCut.w) { ptAlb = uGloves; ptRough = 0.7; }
    } else if (ptPart < 2.5) {
      ptAlb = uShorts; ptRough = 0.88;
    } else if (ptPart < 3.5) {
      ptAlb = uCut2.w > 0.5 ? (uCut2.x > 0.0 ? uSocks : ptSkin) : (vRest.y < 0.022 ? uSole : uShoes);
      ptRough = uCut2.w > 0.5 ? 0.7 : 0.55;
    } else if (ptPart < 4.5) {
      ptAlb = uHair; ptRough = 0.75;
    } else if (ptPart < 5.5) {
      ptAlb = mapTexelToLinear(texture2D(uEyeMap, vUv)).rgb; ptRough = 0.2;
    } else if (ptPart < 7.5) {
      ptAlb = uHair; ptRough = 0.7;
    } else if (ptPart < 21.5 && ptPart > 20.5) {
      // coutil de matelas : rayures verticales
      float st = step(0.62, fract(vRest.x * uCut3.y));
      ptAlb = mix(vec3(1.0), uPatA, st);
    } else if (ptPart < 22.5 && ptPart > 21.5) {
      // velours du canapé : côtes fines
      ptAlb = vec3(1.0 - 0.1 * step(0.5, fract(vRest.x * 26.0)));
    }
    // états : gelé, mouillé, brûlé, éclair de coup
    float ptFlash = vFx0.x, ptWet = vFx0.y, ptFrozen = vFx0.z, ptBurn = vFx0.w;
    ptAlb = mix(ptAlb, vec3(0.62, 0.86, 1.0), ptFrozen * 0.5);
    ptAlb *= 1.0 - 0.36 * ptWet;
    ptAlb *= 1.0 - 0.5 * ptBurn * (0.6 + 0.4 * ptNoise(vRest.xy * 30.0));
    ptAlb = mix(ptAlb, vec3(1.0), ptFlash * 0.55);
    if (ptGhost > 0.01) ptAlb = mix(ptAlb, vec3(0.32, 0.26, 0.42), ptGhost * 0.7);
    diffuseColor.rgb *= ptAlb;
  `;
  const FRAG_ROUGH = /* glsl */ `
    roughnessFactor = ptRough;
    if (ptCls > 0.5) {
      if (ptCls < 1.5) roughnessFactor = 0.55;
      else if (ptCls < 2.5) roughnessFactor = 0.3;
      else if (ptCls < 3.5) roughnessFactor = 0.32;
      else if (ptCls < 6.5) roughnessFactor = 0.38;
      else roughnessFactor = 0.18;
    } else if (ptPart > 19.5) roughnessFactor = 0.8;
    roughnessFactor *= 1.0 - 0.55 * ptWet;
  `;
  const FRAG_METAL = /* glsl */ `
    metalnessFactor = ptCls > 2.5 && ptCls < 3.5 ? 0.55 : (ptCls > 5.5 && ptCls < 6.5 ? 0.35 : 0.0);
  `;
  const FRAG_EMISSIVE = /* glsl */ `
    {
      vec3 ptV = normalize(vViewPosition);
      float ptFres = pow(1.0 - clamp(abs(dot(normalize(vNormal), ptV)), 0.0, 1.0), 2.5);
      // liseré froid pour détacher les silhouettes de l'herbe vue de haut
      totalEmissiveRadiance += vec3(0.55, 0.7, 1.0) * ptFres * 0.12;
      if (ptCls > 3.5 && ptCls < 4.5) totalEmissiveRadiance += diffuseColor.rgb * 1.4;
      float ptHeat = vFx1.z;
      if (ptCls > 4.5 && ptCls < 5.5) totalEmissiveRadiance += vec3(1.0, 0.28, 0.04) * ptHeat * (2.0 + 0.6 * sin(uTime * 9.0));
      if (ptCls > 5.5 && ptCls < 6.5) totalEmissiveRadiance += vec3(1.0, 0.6, 0.1) * (0.22 + 1.5 * ptFres) * (0.85 + 0.15 * sin(uTime * 4.0));
      totalEmissiveRadiance += vec3(1.0, 0.96, 0.9) * ptFlash * 0.9;
      totalEmissiveRadiance += vec3(1.0, 0.36, 0.05) * ptBurn * (0.14 + 0.12 * sin(uTime * 23.0 + vRest.y * 14.0));
      totalEmissiveRadiance += vec3(0.4, 0.75, 1.0) * ptFrozen * 0.12;
      if (ptDiss > 0.001 && ptN < ptDiss + 0.07) totalEmissiveRadiance += vec3(1.0, 0.9, 0.55) * 2.5;
    }
  `;

  function makeMaterial(spec, dataBoneIndex) {
    const o = spec.outfit;
    const col = (h, fallback) => PTMT.color(h === undefined || h === null ? fallback : h);
    const u = {
      uEyeMap: { value: BASE.eyeTex },
      uSkinTint: { value: col(spec.skin, 0xffffff) },
      uHair: { value: col(spec.hairColor, 0x3b2a1e) },
      uSweaterA: { value: col(o.sweaterA, 0xcccccc) },
      uSweaterB: { value: col(o.sweaterB, o.sweaterA) },
      uShorts: { value: col(o.shorts, 0x333333) },
      uShoes: { value: col(o.shoes, 0x222222) },
      uSole: { value: col(o.sole, o.shoes || 0x222222) },
      uTrousers: { value: col(o.trousers, o.shorts) },
      uSocks: { value: col(o.socks, 0xffffff) },
      uSocks2: { value: col(o.socks2, o.socks || 0xffffff) },
      uGloves: { value: col(o.gloves || 0x222222, 0x222222) },
      uPatA: { value: col(spec.tick ? spec.tick.color : 0x2f5fb3, 0x2f5fb3) },
      uCut: { value: new THREE.Vector4(o.sleeve === undefined ? 0.9 : o.sleeve, o.trouserTop || 0.64, o.hem === undefined ? 0.64 : o.hem, o.gloveX || 1) },
      uCut2: { value: new THREE.Vector4(o.sockTop || 0, o.stripes || 0, o.shirtless ? 1 : 0, o.barefoot ? 1 : 0) },
      uCut3: { value: new THREE.Vector4(o.neck ? 1 : 0, spec.tick ? spec.tick.freq : 10, 0, 0) },
      uTime: A._timeUniform,
      uDataBone: { value: dataBoneIndex },
    };
    const m = new THREE.MeshStandardMaterial({ map: BASE.skinTex, vertexColors: true, skinning: true, roughness: 0.8, metalness: 0 });
    m.name = "ptmt:actor:" + spec.type + (spec.isElite ? ":elite" : "");
    m.userData.u = u;
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, u);
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\n" + VERT_PARS)
        .replace("#include <skinning_vertex>", "#include <skinning_vertex>\n" + VERT_MAIN);
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\n" + FRAG_PARS.replace("PTMT_NOISE", PTMT.gfx.GLSL.noise))
        .replace("#include <map_fragment>", FRAG_ALBEDO)
        .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\n" + FRAG_ROUGH)
        .replace("#include <metalnessmap_fragment>", "#include <metalnessmap_fragment>\n" + FRAG_METAL)
        .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n" + FRAG_EMISSIVE);
    };
    m.customProgramCacheKey = () => "ptmt-actor-v3";
    return m;
  }
  A._timeUniform = { value: 0 };

  /** Rideau de douche translucide (ninja élite) : matière à part, battement dans le vertex shader. */
  function makeCapeMaterial(dataBoneIndex) {
    return PTMT.mat("actors:cape", () => {
      const c = document.createElement("canvas");
      c.width = c.height = 256;
      const x = c.getContext("2d");
      x.fillStyle = "rgba(210,240,255,0.55)"; x.fillRect(0, 0, 256, 256);
      // petits canards jaunes et bulles
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
        const cx = 32 + i * 64 + (j % 2) * 20, cy = 32 + j * 64;
        x.fillStyle = "#ffd21f"; x.beginPath(); x.ellipse(cx, cy + 6, 16, 11, 0, 0, Math.PI * 2); x.fill();
        x.beginPath(); x.arc(cx + 10, cy - 8, 9, 0, Math.PI * 2); x.fill();
        x.fillStyle = "#ff8a1f"; x.beginPath(); x.moveTo(cx + 17, cy - 9); x.lineTo(cx + 27, cy - 6); x.lineTo(cx + 17, cy - 3); x.fill();
        x.fillStyle = "#111"; x.beginPath(); x.arc(cx + 12, cy - 10, 2, 0, Math.PI * 2); x.fill();
        x.strokeStyle = "rgba(255,255,255,0.9)"; x.lineWidth = 2; x.beginPath(); x.arc(cx - 20, cy + 22, 5, 0, Math.PI * 2); x.stroke();
      }
      const tex = new THREE.CanvasTexture(c);
      tex.encoding = THREE.sRGBEncoding;
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      const m = new THREE.MeshStandardMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, skinning: true, roughness: 0.25, metalness: 0, depthWrite: false });
      m.name = "ptmt:actor:cape";
      m.onBeforeCompile = (sh) => {
        sh.uniforms.uTime = A._timeUniform;
        sh.uniforms.uDataBone = m.userData.dataBone;
        sh.vertexShader = sh.vertexShader
          .replace("#include <common>", "#include <common>\nuniform float uTime;\nuniform float uDataBone;")
          .replace(
            "#include <skinning_vertex>",
            `#include <skinning_vertex>
            {
              float hang = clamp((1.52 - position.y) / 1.1, 0.0, 1.0);
              float spd = 0.0;
              #ifdef USE_SKINNING
                spd = getBoneMatrix(uDataBone)[2].x;
              #endif
              float wave = sin(uTime * (5.0 + spd * 4.0) + position.y * 7.0 + position.x * 5.0);
              transformed.z -= hang * hang * (0.12 + spd * 0.45 + 0.05 * wave);
              transformed.y += hang * hang * spd * 0.15;
              transformed.x += hang * 0.04 * sin(uTime * 3.0 + position.y * 4.0);
            }`,
          );
      };
      m.customProgramCacheKey = () => "ptmt-cape-v1";
      m.userData.dataBone = { value: dataBoneIndex };
      return m;
    });
  }

  // ---------------------------------------------------------------------------------------------
  // Gabarit d'une variante : géométrie fusionnée, os d'accessoires, matière
  // ---------------------------------------------------------------------------------------------
  function templateFor(type, elite) {
    const key = type + (elite ? ":elite" : "");
    let tpl = TEMPLATES.get(key);
    if (tpl) return tpl;
    const spec = A.variantSpec(type, elite);
    const Parts = PTMT.gfx.Parts;
    const parts = new Parts();
    const add = (geo, color, opt) => parts.add(geo, Object.assign({ color }, opt || {}));
    for (const b of spec.builds) if (b) b(add);

    // os d'accessoires
    const propBones = [];
    const propTris = {};
    for (const pd of spec.propDefs) {
      const name = "p_" + pd.name;
      const before = parts.triangles;
      pd.build((geo, color, opt) => parts.add(geo, Object.assign({ color, bone: name }, opt || {})));
      propTris[pd.name] = parts.triangles - before;
      propBones.push({ name, parent: pd.parent ? pd.parent : null, pos: pd.pos });
    }
    if (spec.sack) {
      const before = parts.triangles;
      PTMT.gfx.addSack(parts, { bone: "p_sack", pos: spec.sack.pos, rot: spec.sack.rot, scale: spec.sack.scale, part: 20 });
      propTris.sack = parts.triangles - before;
      propBones.push({ name: "p_sack", parent: spec.sack.parent, pos: spec.sack.pos });
    }
    const accTris = parts.triangles;

    // os : conservés + accessoires + données
    const boneSpecs = BASE.bones.map((b) => ({ name: b.name, parent: b.parent, pos: b.pos.clone(), quat: b.quat.clone(), scale: b.scale.clone() }));
    const worldOf = {};
    BASE.bones.forEach((b) => (worldOf[b.name] = b.world));
    const inverses = BASE.bones.map((b) => b.inverse.clone());
    for (const pb of propBones) {
      const world = new THREE.Matrix4().makeTranslation(pb.pos[0], pb.pos[1], pb.pos[2]);
      const local = pb.parent ? new THREE.Matrix4().copy(worldOf[pb.parent]).invert().multiply(world) : world.clone();
      const pos = new THREE.Vector3(), quat = new THREE.Quaternion(), scale = new THREE.Vector3();
      local.decompose(pos, quat, scale);
      boneSpecs.push({ name: pb.name, parent: pb.parent, pos, quat, scale, prop: true });
      worldOf[pb.name] = world;
      inverses.push(new THREE.Matrix4().copy(world).invert());
    }
    const boneIndex = {};
    boneSpecs.forEach((b, i) => (boneIndex[b.name] = i));
    const dataBone = boneSpecs.length;
    inverses.push(new THREE.Matrix4());

    // géométrie : parties du corps + cheveux + accessoires
    const bodyParts = [PART.skin, PART.sweater, PART.shorts, PART.shoes];
    if (spec.hair === "long") bodyParts.push(PART.hairLong);
    if (spec.hair === "short") bodyParts.push(PART.hairShort);
    const acc = parts.build();
    const accBones = acc.userData.bones;
    let nv = acc.getAttribute("position").count, ni = acc.index.count;
    for (const p of bodyParts) { nv += BASE.parts[p].count; ni += BASE.parts[p].index.length; }
    const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), U = new Float32Array(nv * 2), C = new Float32Array(nv * 3), M = new Float32Array(nv * 2);
    const SI = new Uint16Array(nv * 4), SW = new Float32Array(nv * 4);
    const I = new Uint32Array(ni);
    let o = 0, oi = 0;
    for (const p of bodyParts) {
      const bp = BASE.parts[p];
      P.set(bp.pos, o * 3); N.set(bp.nor, o * 3); U.set(bp.uv, o * 2); SI.set(bp.si, o * 4); SW.set(bp.sw, o * 4);
      for (let i = 0; i < bp.count; i++) { C[(o + i) * 3] = 1; C[(o + i) * 3 + 1] = 1; C[(o + i) * 3 + 2] = 1; M[(o + i) * 2] = p; M[(o + i) * 2 + 1] = 0; }
      for (let i = 0; i < bp.index.length; i++) I[oi + i] = bp.index[i] + o;
      o += bp.count; oi += bp.index.length;
    }
    const ac = acc.getAttribute("position").count;
    P.set(acc.getAttribute("position").array, o * 3);
    N.set(acc.getAttribute("normal").array, o * 3);
    U.set(acc.getAttribute("uv").array, o * 2);
    C.set(acc.getAttribute("color").array, o * 3);
    M.set(acc.getAttribute("aMat").array, o * 2);
    for (let i = 0; i < ac; i++) {
      const bi = boneIndex[accBones[i] || "root"];
      if (bi === undefined) throw new Error("PTMT.actors : os inconnu « " + accBones[i] + " » (" + spec.type + ")");
      SI[(o + i) * 4] = bi; SW[(o + i) * 4] = 1;
    }
    const aidx = acc.index.array;
    for (let i = 0; i < aidx.length; i++) I[oi + i] = aidx[i] + o;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(P, 3));
    geo.setAttribute("normal", new THREE.BufferAttribute(N, 3));
    geo.setAttribute("uv", new THREE.BufferAttribute(U, 2));
    geo.setAttribute("color", new THREE.BufferAttribute(C, 3));
    geo.setAttribute("aMat", new THREE.BufferAttribute(M, 2));
    geo.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(SI, 4));
    geo.setAttribute("skinWeight", new THREE.BufferAttribute(SW, 4));
    geo.setIndex(new THREE.BufferAttribute(I, 1));
    const d = spec.dims;
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, d.h * 0.45, 0), Math.max(d.w, d.h, d.d) * 0.75 + 0.6);
    geo.boundingBox = new THREE.Box3(new THREE.Vector3(-d.w, 0, -d.d), new THREE.Vector3(d.w, d.h * 1.2, d.d));

    // rideau de douche (ninja élite) : maillage translucide séparé sur le même squelette
    let cape = null;
    if (spec.cape) {
      const cg = new THREE.PlaneGeometry(0.78, 1.18, 6, 8);
      cg.rotateY(Math.PI);
      cg.translate(0, 0.93, -0.21);
      const cp = cg.getAttribute("position");
      for (let i = 0; i < cp.count; i++) {
        const y = cp.getY(i), x = cp.getX(i);
        // s'évase vers le bas, épouse le dos en haut
        const t = (1.52 - y) / 1.18;
        cp.setX(i, x * (0.7 + 0.5 * t));
        cp.setZ(i, cp.getZ(i) - 0.05 * t - Math.pow(Math.abs(x) * 1.5, 2) * 0.12 * (1 - t));
      }
      cg.computeVertexNormals();
      const n2 = cp.count;
      const si = new Uint16Array(n2 * 4), sw = new Float32Array(n2 * 4);
      for (let i = 0; i < n2; i++) { si[i * 4] = boneIndex.spine_03; sw[i * 4] = 1; }
      cg.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(si, 4));
      cg.setAttribute("skinWeight", new THREE.BufferAttribute(sw, 4));
      cg.boundingSphere = geo.boundingSphere.clone();
      cape = { geometry: cg, material: makeCapeMaterial(dataBone) };
      cape.material.userData.dataBone.value = dataBone;
    }

    tpl = {
      key, type, elite: !!elite, spec, geometry: geo, material: makeMaterial(spec, dataBone),
      boneSpecs, boneInverses: inverses, dataBone, boneIndex, cape,
      stats: {
        triangles: I.length / 3 + (cape ? cg2tris(cape.geometry) : 0),
        bodyTriangles: (I.length - aidx.length) / 3,
        accessoryTriangles: accTris,
        props: propTris,
        vertices: nv,
        bones: boneSpecs.length + 1,
        drawCalls: cape ? 2 : 1,
      },
    };
    TEMPLATES.set(key, tpl);
    return tpl;
  }
  function cg2tris(g) { return g.index ? g.index.count / 3 : g.getAttribute("position").count / 3; }

  // ---------------------------------------------------------------------------------------------
  // Ennemi
  // ---------------------------------------------------------------------------------------------
  const EMPTY = {};
  const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion();
  const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
  const _e = new THREE.Euler(0, 0, 0, "YXZ");
  const _m = new THREE.Matrix4();
  let _uid = 1;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const smooth = (cur, target, dt, rate) => cur + (target - cur) * (1 - Math.exp(-dt * rate));
  const ease = (t) => t * t * (3 - 2 * t);
  const REACT = {
    hit: 0.28, knockback: 0.85, pull: 0.95, ko: 1.75, steal: 0.7, drop: 0.7, helmetOff: 0.9, flipflops: 0.8,
    smokePuff: 0.45, overheat: 1.0, rage: 1.25, splash: 0.5, fooled: 1.0,
  };
  A.KO_DURATION = REACT.ko;

  class Actor {
    constructor(tpl) {
      this.id = _uid++;
      this.tpl = tpl;
      this.spec = tpl.spec;
      this.type = tpl.type;
      this.elite = tpl.elite;
      this.label = tpl.spec.label;
      this.height = tpl.spec.height;
      this.dims = tpl.spec.dims;
      /** Vitesse (m/s) à laquelle la boucle de marche/course est jouée à sa cadence d'origine. */
      this.naturalSpeed = tpl.spec.motion.natural * tpl.spec.body.scale[1];
      this.object = new THREE.Group();
      this.object.name = "ptmt:actor:" + tpl.key;
      this.rig = new THREE.Group();
      this.rig.name = "rig";
      this.object.add(this.rig);
      this.bones = [];
      this.B = {};
      this.restQ = {};
      this.restP = {};
      for (const b of tpl.boneSpecs) {
        const bone = new THREE.Bone();
        bone.name = b.name;
        bone.position.copy(b.pos);
        bone.quaternion.copy(b.quat);
        bone.scale.copy(b.scale);
        (b.parent ? this.B[b.parent] : this.rig).add(bone);
        this.B[b.name] = bone;
        this.bones.push(bone);
        this.restQ[b.name] = b.quat.clone();
        this.restP[b.name] = b.pos.clone();
      }
      this.dataBone = new THREE.Bone();
      this.dataBone.name = "ptmt:data";
      this.dataBone.matrixAutoUpdate = false;
      this.bones.push(this.dataBone);
      this.skeleton = new THREE.Skeleton(this.bones, tpl.boneInverses);
      this.mesh = new THREE.SkinnedMesh(tpl.geometry, tpl.material);
      this.mesh.name = "ptmt:actor:mesh";
      this.mesh.bind(this.skeleton, IDENTITY());
      // mobile : pas d'ombre projetée (l'ombre douce au sol suffit), moitié moins de sommets à traiter
      this.mesh.castShadow = !A.mobile;
      this.mesh.receiveShadow = !A.mobile;
      this.rig.add(this.mesh);
      if (tpl.cape) {
        this.cape = new THREE.SkinnedMesh(tpl.cape.geometry, tpl.cape.material);
        this.cape.bind(this.skeleton, IDENTITY());
        this.cape.renderOrder = 2;
        this.rig.add(this.cape);
      }
      // proportions : échelle du squelette (os racine pivoté de -90° autour de X), tête, mains
      const bs = this.spec.body.scale;
      this.B.root.scale.set(bs[0], bs[2], bs[1]);
      this.B.Head.scale.setScalar(this.spec.body.head || 1);
      this.B.hand_l.scale.setScalar(this.spec.body.hands || 1);
      this.B.hand_r.scale.setScalar(this.spec.body.hands || 1);
      this.bodyScaleY = bs[1];
      this.mixer = new THREE.AnimationMixer(this.rig);
      this.actions = {};
      for (const name of CLIPS) {
        const clip = BASE.clips[name];
        if (!clip) continue;
        const act = this.mixer.clipAction(clip);
        if (name === "Jump_Start" || name === "Jump_Land") { act.setLoop(THREE.LoopOnce, 1); act.clampWhenFinished = true; }
        this.actions[name] = act;
      }
      // poids lissés et paramètres de pose (tableaux préalloués : aucune allocation par image)
      this.armQ = { l: [new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion()], r: [new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion()] };
      this.armT = { l: [new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion()], r: [new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion()] };
      this.w = {};
      this.fly = {};
      this.anchor = { head: new THREE.Vector3(), chest: new THREE.Vector3(), sack: new THREE.Vector3(), exhaust: new THREE.Vector3(), feet: new THREE.Vector3(), fwd: new THREE.Vector3(), right: new THREE.Vector3() };
      this.reset();

    }

    reset() {
      this.object.visible = true;
      this.object.position.set(0, 0, 0);
      this.object.rotation.set(0, 0, 0);
      this.object.scale.set(1, 1, 1);
      this.rig.position.set(0, 0, 0);
      this.rig.quaternion.identity();
      this.rig.scale.set(1, 1, 1);
      const w = this.w;
      for (const k of ["carry", "frozen", "wet", "burn", "net", "lure", "ghost", "heat", "boost", "water", "armL", "armR", "flash", "lean", "sack", "move", "swim", "diss"]) w[k] = 0;
      w.sack = 0;
      this.prev = {};
      this.react = null;
      this.reactT = 0;
      this.finished = false;
      this.ko = false;
      this.cur = null;
      this.speed = 0;
      this.wheelA = 0;
      this.spin = 0;
      this.pose = { l: null, r: null };
      this.armBlendPose = { l: null, r: null };
      this.helmetGone = false;
      this.flipGone = false;
      this.sackPop = 1;
      this.lureKind = this.id % 2 ? "heart" : "dollar";
      this.lookT = 0;
      this.look = [0, 0];
      this.lookTo = [0, 0];
      this.emitT = {};
      this.time = 0;
      this.state = EMPTY;
      for (const k in this.fly) this._landProp(k);
      this.mixer.stopAllAction();
      for (const b of this.tpl.boneSpecs) { const bone = this.B[b.name]; bone.position.copy(b.pos); bone.quaternion.copy(b.quat); if (b.prop) bone.scale.copy(b.scale); }
      const bs = this.spec.body.scale;
      this.B.root.scale.set(bs[0], bs[2], bs[1]);
      if (this.spec.motion.vehicle) {
        const seat = this.spec.seat;
        this.B.root.position.set(0, seat.y - 0.949 * bs[1] + 0.12, seat.z);
      }
      this._play(this.spec.motion.vehicle ? "Driving_Loop" : "Idle_Loop", 0, 1);
      this.mixer.update(0.001 + Math.random() * 0.8);
      this._writeData(0, 0);
    }

    // --- animations de base ------------------------------------------------------------------
    _play(name, fade, rate) {
      const next = this.actions[name];
      if (!next) return;
      if (this.cur === name) { next.setEffectiveTimeScale(rate); return; }
      const prev = this.cur ? this.actions[this.cur] : null;
      next.reset();
      next.setEffectiveTimeScale(rate);
      next.setEffectiveWeight(1);
      next.play();
      if (prev && fade > 0) prev.crossFadeTo(next, fade, false);
      else if (prev) prev.stop();
      this.cur = name;
    }
    _phase() {
      const act = this.cur ? this.actions[this.cur] : null;
      if (!act) return 0;
      return (act.time / act.getClip().duration) * Math.PI * 2;
    }

    // --- événements ponctuels ------------------------------------------------------------------
    event(name) {
      if (this.ko && name !== "ko") return;
      const ov = A.overlay;
      switch (name) {
        case "ko":
          if (this.ko) return;
          this.ko = true;
          this._react("ko");
          break;
        case "helmetOff":
          if (!this.B.p_helmet || this.helmetGone) return;
          this.helmetGone = true;
          this._launchProp("helmet", 1.6, 4.2, -1.4, 14);
          this._react("helmetOff");
          break;
        case "flipflops":
          if (!this.B.p_flip_l || this.flipGone) return;
          this.flipGone = true;
          this._launchProp("flip_l", 0.9, 3.6, -1.8, 18);
          this._launchProp("flip_r", -0.9, 3.9, -1.6, -16);
          this._react("flipflops");
          break;
        case "smokePuff":
        case "splash":
          // effet seul : n'interrompt pas l'animation en cours
          break;
        case "hit":
          if (!this.react || this.react === "hit") this._react("hit");
          break;
        default:
          if (REACT[name] === undefined) return;
          this._react(name);
      }
      if (ov && ov.burst) ov.burst(this, name);
    }
    _react(name) {
      this.react = name;
      this.reactT = 0;
    }
    /** Fait décoller un accessoire (casserole, claquettes) dans le repère de la scène. */
    _launchProp(name, side, up, back, spin) {
      const bone = this.B["p_" + name];
      const scene = this.object.parent;
      if (!bone || !scene) { if (bone) bone.scale.setScalar(0); return; }
      this.object.updateMatrixWorld(true);
      bone.matrixWorld.decompose(_v, _q, _v2);
      const f = { bone, parent: bone.parent, t: 0, pos: _v.clone(), quat: _q.clone(), scl: _v2.clone(), vel: new THREE.Vector3(), spin: new THREE.Vector3(spin, spin * 0.4, spin * 0.25), ground: this.object.position.y };
      const yaw = this.object.rotation.y;
      const fx = Math.sin(yaw), fz = Math.cos(yaw);
      f.vel.set(fz * side * 0.6 + fx * back * 0.5, up, -fx * side * 0.6 + fz * back * 0.5);
      scene.attach(bone);
      this.fly[name] = f;
    }
    _landProp(name) {
      const f = this.fly[name];
      if (!f) return;
      f.parent.add(f.bone);
      f.bone.position.copy(this.restP[f.bone.name]);
      f.bone.quaternion.copy(this.restQ[f.bone.name]);
      f.bone.scale.set(0, 0, 0);
      delete this.fly[name];
    }
    _updateFly(dt) {
      for (const k in this.fly) {
        const f = this.fly[k];
        f.t += dt;
        f.vel.y -= 13 * dt;
        f.pos.addScaledVector(f.vel, dt);
        if (f.pos.y < f.ground + 0.05 && f.vel.y < 0) {
          f.pos.y = f.ground + 0.05;
          f.vel.multiplyScalar(0.45);
          f.vel.y = -f.vel.y * 0.8;
          f.spin.multiplyScalar(0.5);
        }
        _e.set(f.spin.x * dt, f.spin.y * dt, f.spin.z * dt);
        f.quat.multiply(_q.setFromEuler(_e));
        const shrink = f.t > 1.3 ? Math.max(0, 1 - (f.t - 1.3) / 0.25) : 1;
        f.bone.position.copy(f.pos);
        f.bone.quaternion.copy(f.quat);
        f.bone.scale.copy(f.scl).multiplyScalar(shrink);
        if (shrink <= 0) this._landProp(k);
      }
    }

    // --- mise à jour -------------------------------------------------------------------------
    update(dt, time, s) {
      s = s || EMPTY;
      dt = clamp(dt || 0, 0, 0.1);
      this.time = time;
      this.state = s;
      A._timeUniform.value = time;
      const ov = A.overlay;
      if (ov && ov.frame) ov.frame(time, this.object);
      const spec = this.spec, mo = spec.motion, w = this.w, B = this.B;

      // réaction en cours
      let react = this.react;
      if (react) {
        this.reactT += dt;
        if (this.reactT >= REACT[react]) {
          if (react === "ko") this.finished = true;
          else { this.react = react = null; }
        }
      }
      const rt = this.reactT;
      const moving = !!s.moving && !this.ko;
      const speed = moving ? Math.max(0, s.speed === undefined ? mo.natural : s.speed) : 0;
      this.speed = speed;
      const inWater = !!s.inWater;
      const frozen = !!s.frozen && !this.ko;

      // poids lissés
      w.carry = smooth(w.carry, s.carrying ? 1 : 0, dt, 9);
      w.frozen = smooth(w.frozen, frozen ? 1 : 0, dt, 14);
      w.wet = smooth(w.wet, s.wet ? 1 : 0, dt, 3);
      w.burn = smooth(w.burn, s.burning ? 1 : 0, dt, 6);
      w.net = smooth(w.net, s.netted ? 1 : 0, dt, 10);
      w.lure = smooth(w.lure, s.lured ? 1 : 0, dt, 8);
      w.ghost = smooth(w.ghost, s.untargetable ? 1 : 0, dt, 6);
      w.heat = smooth(w.heat, s.overheated ? 1 : 0, dt, 3);
      w.boost = smooth(w.boost, s.boosted ? 1 : 0, dt, 6);
      w.water = smooth(w.water, inWater ? 1 : 0, dt, 5);
      w.move = smooth(w.move, moving ? 1 : 0, dt, 6);
      w.flash = Math.max(s.hitFlash || 0, react === "hit" ? Math.max(0, 1 - rt / REACT.hit) * 0.8 : 0);
      if (s.carrying && !this.prev.carrying) this.sackPop = 0;
      this.sackPop = Math.min(1, this.sackPop + dt / 0.35);
      this.prev.carrying = !!s.carrying;

      if (!frozen || w.frozen < 0.98) {
        this._animate(dt, s, moving, speed, inWater, react, rt);
        this.mixer.update(dt);
        this._poseLayer(dt, s, moving, speed, inWater, react, rt);
      }
      this._rigLayer(dt, s, moving, speed, inWater, react, rt, frozen);
      this._props(dt, s, moving, speed, inWater, react, rt);
      this._updateFly(dt);
      w.diss = react === "ko" ? clamp((rt - 1.25) / 0.45, 0, 1) : 0;
      this._writeData(w.flash, speed);
      if (ov && ov.actor) ov.actor(this, dt, s);
    }

    _animate(dt, s, moving, speed, inWater, react, rt) {
      const mo = this.spec.motion;
      let clip = "Idle_Loop", rate = 1, fade = 0.22;
      const swim = mo.swims && inWater;
      if (react === "ko") { clip = mo.vehicle ? "Driving_Loop" : "Jump_Loop"; rate = 0.35; fade = 0.1; }
      else if (react === "knockback" || react === "pull") { clip = mo.vehicle ? "Driving_Loop" : "Jump_Loop"; rate = 1.6; fade = 0.08; }
      else if (mo.vehicle) { clip = "Driving_Loop"; rate = s.overheated ? 2.2 : 1; }
      else if (swim && mo.boat) { clip = "Driving_Loop"; rate = 1; }
      else if (s.netted) { clip = "Jump_Loop"; rate = 2.4; fade = 0.12; }
      else if (swim) { clip = "Jump_Loop"; rate = 0.9; }
      else if (react === "steal" || react === "fooled" || react === "flipflops") { clip = "Jump_Loop"; rate = 1.8; fade = 0.1; }
      else if (moving) {
        clip = mo.loco;
        const nat = mo.natural * this.bodyScaleY;
        rate = clamp(speed / nat, 0.7, 2.2);
        if (mo.heavy) rate *= 0.92;
        if (s.burning) rate *= 1.25;
      } else if (s.burning) { clip = mo.loco; rate = 1.2; }
      this._play(clip, fade, rate);
    }

    _poseLayer(dt, s, moving, speed, inWater, react, rt) {
      const B = this.B, mo = this.spec.motion, w = this.w, AX = BASE.axes;
      const t = this.time;
      const ph = this._phase();
      // 1) inclinaison du buste
      let lean = 0;
      if (moving && !mo.vehicle) lean = mo.lean || 0;
      if (mo.skate && moving) lean += 0.15;
      if (w.boost > 0.01) lean += 0.15 * w.boost;
      if (s.burning) lean -= 0.1;
      if (s.lured) lean -= 0.08;
      if (react === "drop") lean += Math.sin(Math.min(1, rt / 0.35) * Math.PI) * 0.6;
      if (react === "fooled") lean += 0.25 * Math.sin(rt * 20) * (1 - rt / REACT.fooled);
      w.lean = smooth(w.lean, Math.max(-0.3, Math.min(0.5, lean)), dt, 6);
      if (Math.abs(w.lean) > 0.002) {
        this._rot(B.spine_01, AX.spine_01.x, w.lean * 0.4);
        this._rot(B.spine_02, AX.spine_02.x, w.lean * 0.35);
        this._rot(B.spine_03, AX.spine_03.x, w.lean * 0.3);
        this._rot(B.neck_01, AX.neck_01.x, -w.lean * 0.45);
      }
      if (mo.heavy && moving) {
        const sw = Math.sin(ph) * 0.07;
        this._rot(B.spine_02, AX.spine_02.z, sw);
        this._rot(B.neck_01, AX.neck_01.z, -sw * 0.8);
      }
      // 2) bras
      let poseL = null, poseR = null, osc = null;
      const carryHold = this.spec.sack ? this.spec.sack.hold : null;
      if (react === "ko") { /* bras de l'animation */ }
      else if (react === "steal") poseL = poseR = "cheer";
      else if (react === "rage" && !mo.vehicle) { poseL = poseR = "fist"; }
      else if (react === "fooled") poseL = poseR = "fist";
      else if (react === "drop") poseL = poseR = "shrug";
      else if (s.netted || react === "knockback" || react === "pull") osc = "flail";
      else if (mo.vehicle) { /* conduite */ }
      else if (mo.swims && inWater && !mo.boat) osc = "swim";
      else if (mo.swims && inWater && mo.boat) { /* pédale */ }
      else if (s.burning && !(s.carrying && carryHold === "carryR")) osc = "flail";
      else if (s.lured) poseL = poseR = "reach";
      else if (s.carrying && carryHold) { poseL = poseR = carryHold; }
      else if (moving && mo.moveArms) poseL = poseR = mo.moveArms;
      else if (!moving && mo.idleArms) poseL = poseR = mo.idleArms;
      if (s.burning && s.carrying && carryHold === "carryR") { poseR = "carryR"; osc = null; poseL = "flailA"; }
      if (mo.moveArms === "mattress" || mo.moveArms === "shield") { if (!(react === "steal" || react === "drop" || react === "fooled" || s.netted || react === "knockback" || react === "pull")) poseL = poseR = mo.moveArms; }
      if (mo.boat && !inWater && !(s.netted || react === "knockback" || react === "pull" || react === "ko")) poseL = poseR = "overhead";
      if (mo.swims && !mo.boat && !inWater && !(s.netted || react === "knockback" || react === "pull" || react === "ko" || react === "steal")) poseL = poseR = "waist";
      const P = BASE.poses;
      for (let si = 0; si < 2; si++) { const side = SIDES[si];
        const target = this.armT[side];
        let name = side === "l" ? poseL : poseR;
        let active = false;
        if (osc) {
          const a = osc === "flail" ? P.flailA[side] : P.swimA[side], b = osc === "flail" ? P.flailB[side] : P.swimB[side];
          const f = osc === "flail" ? 11 : 5.5;
          const k = 0.5 + 0.5 * Math.sin(t * f + (side === "l" ? 0 : Math.PI) + this.id);
          for (let i = 0; i < 3; i++) target[i].copy(a[i]).slerp(b[i], k);
          active = true;
        } else if (name && P[name] && P[name][side]) {
          const p = P[name][side];
          for (let i = 0; i < 3; i++) target[i].copy(p[i]);
          active = true;
        }
        const key = side === "l" ? "armL" : "armR";
        const q = this.armQ[side];
        if (active) {
          if (w[key] < 0.02) for (let i = 0; i < 3; i++) q[i].copy(target[i]);
          else for (let i = 0; i < 3; i++) q[i].slerp(target[i], 1 - Math.exp(-dt * (osc ? 30 : 12)));
        }
        w[key] = smooth(w[key], active ? 1 : 0, dt, 9);
        if (w[key] > 0.002) {
          const names = side === "l" ? ARM_L : ARM_R;
          for (let i = 0; i < 3; i++) B[names[i]].quaternion.slerp(q[i], w[key]);
        }
      }
      // 3) jambes : pédalage, battements, patin
      if (mo.boat && inWater) {
        for (let si = 0; si < 2; si++) { const side = SIDES[si];
          const k = Math.sin(t * 7 + (side === "l" ? 0 : Math.PI));
          this._rot(B["thigh_" + side], AX["thigh_" + side].x, 0.35 * k - 0.1);
          this._rot(B["calf_" + side], AX["calf_" + side].x, -0.45 * k - 0.2);
        }
      } else if (mo.swims && inWater) {
        for (let si = 0; si < 2; si++) { const side = SIDES[si];
          const k = Math.sin(t * 9 + (side === "l" ? 0 : Math.PI));
          this._rot(B["thigh_" + side], AX["thigh_" + side].x, 0.3 * k + 0.3);
          this._rot(B["calf_" + side], AX["calf_" + side].x, -0.3 - 0.2 * k);
        }
      } else if (mo.skate && moving) {
        for (let si = 0; si < 2; si++) { const side = SIDES[si];
          const k = Math.max(0, Math.sin(ph + (side === "l" ? 0 : Math.PI)));
          this._rot(B["thigh_" + side], AX["thigh_" + side].z, (side === "l" ? 1 : -1) * 0.35 * k);
        }
      }
      if (mo.tiptoe && moving && !s.carrying && !s.burning) {
        // démarche de cambrioleur : genoux levés
        for (let si = 0; si < 2; si++) { const side = SIDES[si];
          const k = Math.max(0, Math.sin(ph + (side === "l" ? 0 : Math.PI)));
          this._rot(B["thigh_" + side], AX["thigh_" + side].x, 0.35 * k);
          this._rot(B["calf_" + side], AX["calf_" + side].x, -0.5 * k);
        }
      }
      // 4) tête : colère, K.-O. étourdi
      if (react === "ko") this._rot(B.Head, AX.Head.z, Math.sin(t * 6) * 0.25);
      if (react === "fooled" || (react === "rage" && !mo.vehicle)) this._rot(B.Head, AX.Head.y, Math.sin(t * 22) * 0.2);
      if (s.lured) this._rot(B.Head, AX.Head.x, -0.15 + Math.sin(t * 3) * 0.05);
      if (mo.vehicle && react === "rage") {
        this._rot(B.spine_02, AX.spine_02.x, -0.2);
        this._rot(B.Head, AX.Head.y, Math.sin(t * 20) * 0.25);
        const k = Math.sin(t * 16);
        const pr = P.fist.r;
        for (let i = 0; i < 3; i++) B[ARM_R[i]].quaternion.slerp(pr[i], 0.9);
        this._rot(B.lowerarm_r, AX.lowerarm_r.x, k * 0.3);
      }
    }
    _rot(bone, axis, angle) {
      _q.setFromAxisAngle(axis, angle);
      bone.quaternion.multiply(_q);
    }

    _rigLayer(dt, s, moving, speed, inWater, react, rt, frozen) {
      const mo = this.spec.motion, w = this.w, rig = this.rig, t = this.time;
      if (frozen && w.frozen > 0.98) return;
      let y = 0, pitch = 0, roll = 0, yaw = 0, sx = 1, sy = 1, px = 0, pz = 0, pivotY = 0;
      const ph = this._phase();
      // eau : nage (bouée à la surface), pataugeage pour les autres
      if (mo.swims && !mo.boat) y += w.water * (-0.85 + Math.sin(t * 2.6 + this.id) * 0.04);
      else if (mo.boat) y += w.water * -0.25;
      else if (!mo.vehicle) y += w.water * -0.42;
      // démarches
      if (mo.waddle && moving && !inWater) { roll += Math.sin(ph) * 0.13 * mo.waddle; y += Math.abs(Math.cos(ph)) * 0.03; }
      if (mo.heavy && moving) roll += Math.sin(ph) * 0.04;
      if (mo.skate && moving) { roll += Math.sin(ph) * 0.08; }
      // véhicule : cahots, vibration en surchauffe
      if (mo.vehicle) {
        const bump = moving ? Math.sin(t * 13.0) * 0.012 + Math.sin(t * 7.3) * 0.01 : Math.sin(t * 30) * 0.003;
        y += bump;
        pitch += moving ? Math.sin(t * 5.1) * 0.012 : 0;
        if (s.overheated) { px += (Math.random() - 0.5) * 0.05; pz += (Math.random() - 0.5) * 0.05; y += Math.abs(Math.sin(t * 17)) * 0.05; roll += Math.sin(t * 31) * 0.02; }
      }
      // états
      if (s.netted) { px += Math.sin(t * 17) * 0.04; roll += Math.sin(t * 11) * 0.08; sy *= 0.93 + Math.sin(t * 14) * 0.03; }
      if (s.lured) y += Math.abs(Math.sin(t * 4)) * 0.04;
      if (s.burning && !mo.vehicle) y += Math.abs(Math.sin(t * 9)) * 0.08;
      // réactions
      if (react === "hit") { const k = Math.sin((rt / REACT.hit) * Math.PI); sy *= 1 - 0.1 * k; sx *= 1 + 0.07 * k; }
      if (react === "knockback") {
        const T = 0.62, k = clamp(rt / T, 0, 1);
        if (mo.vehicle) { pitch -= Math.sin(k * Math.PI) * 0.45; y += Math.sin(k * Math.PI) * 0.35; pivotY = 0; }
        else {
          pivotY = 0.9 * this.bodyScaleY;
          pitch -= ease(k) * Math.PI * 2;
          y += Math.sin(k * Math.PI) * 1.1;
          if (rt > T) { const q = clamp((rt - T) / 0.2, 0, 1); sy *= 1 - 0.18 * Math.sin(q * Math.PI); }
        }
      }
      if (react === "pull") {
        const k = clamp(rt / REACT.pull, 0, 1);
        this.spin += dt * 16 * Math.sin(k * Math.PI);
        yaw += this.spin;
        roll += Math.sin(k * Math.PI) * 0.35;
        y += Math.sin(k * Math.PI) * 0.25;
      } else this.spin = 0;
      if (react === "ko") {
        if (mo.vehicle) {
          const k = clamp(rt / 0.4, 0, 1);
          pitch -= bounceOut(k) * 0.3; roll += bounceOut(k) * 0.12; y -= bounceOut(k) * 0.15;
        } else {
          const k = clamp(rt / 0.42, 0, 1);
          pitch -= bounceOut(k) * (Math.PI / 2 - 0.08);
          y += Math.sin(clamp(rt / 0.25, 0, 1) * Math.PI) * 0.35;
          pz -= bounceOut(k) * 0.25;
        }
        const sh = clamp((rt - 1.3) / 0.45, 0, 1);
        sx *= 1 - 0.3 * sh; sy *= 1 - 0.3 * sh;
      }
      if (react === "steal" || react === "flipflops") { y += Math.abs(Math.sin(clamp(rt / 0.5, 0, 1) * Math.PI)) * 0.45; }
      if (react === "fooled") { y += Math.abs(Math.sin(rt * 14)) * 0.12 * (1 - rt / REACT.fooled); }
      if (react === "rage") {
        if (mo.vehicle) { const k = clamp(rt / REACT.rage, 0, 1); pitch -= Math.sin(k * Math.PI) * 0.35; pivotY = 0; y += Math.sin(k * Math.PI) * 0.1; px += Math.sin(t * 40) * 0.03; }
        else { y += Math.abs(Math.sin(rt * 12)) * 0.15; }
      }
      if (react === "overheat") { const k = 1 - rt / REACT.overheat; y += Math.abs(Math.sin(rt * 25)) * 0.12 * k; roll += Math.sin(rt * 37) * 0.06 * k; }
      if (react === "helmetOff") { const k = 1 - rt / REACT.helmetOff; roll += Math.sin(rt * 18) * 0.12 * k; sy *= 1 - 0.1 * Math.sin(Math.min(1, rt / 0.2) * Math.PI); }
      // composition : pivot à hauteur de bassin pour les saltos
      _e.set(pitch, yaw, roll, "YXZ");
      rig.quaternion.setFromEuler(_e);
      _v.set(0, pivotY, 0);
      _v2.copy(_v).applyQuaternion(rig.quaternion);
      rig.position.set(px + _v.x - _v2.x, y + _v.y - _v2.y, pz + _v.z - _v2.z);
      rig.scale.set(sx, sy, sx);
    }

    _props(dt, s, moving, speed, inWater, react, rt) {
      const B = this.B, mo = this.spec.motion, w = this.w, t = this.time;
      // sac : apparaît d'un coup (petit rebond), disparaît vite
      if (B.p_sack) {
        let k = 0;
        if (s.carrying && !(react === "ko" && rt > 1.2)) { const p = this.sackPop; k = p < 1 ? 1 + Math.sin(p * Math.PI) * 0.35 - (1 - p) * (1 - p) : 1; }
        else k = w.carry > 0.35 && react !== "drop" ? w.carry : 0;
        B.p_sack.scale.setScalar(Math.max(0, k));
      }
      if (B.p_helmet && !this.fly.helmet) B.p_helmet.scale.setScalar(this.helmetGone ? 0 : 1);
      for (let fi = 0; fi < 2; fi++) { const k = FLIPS[fi];
        const b = B["p_" + k];
        if (!b || this.fly[k]) continue;
        if (this.flipGone) { b.scale.setScalar(0); continue; }
        b.scale.setScalar(1);
        // claquette qui bat sous le talon
        const ph = this._phase() + (k === "flip_l" ? 0 : Math.PI);
        b.quaternion.copy(this.restQ[b.name]);
        if (moving) this._rot(b, BASE.axes[k === "flip_l" ? "foot_l" : "foot_r"].x, Math.max(0, Math.sin(ph)) * 0.55);
      }
      // bouée flamant
      if (B.p_float) {
        const b = B.p_float, r = this.restP.p_float;
        if (inWater || w.water > 0.02) {
          b.position.set(r.x, r.y + (1 - w.water) * 0 + Math.sin(t * 2.6 + this.id) * 0.01, r.z);
          _e.set(Math.sin(t * 1.9 + this.id) * 0.06 * w.water, 0, Math.sin(t * 2.3) * 0.06 * w.water, "YXZ");
          b.quaternion.setFromEuler(_e);
        } else {
          const ph = this._phase();
          b.position.set(r.x, r.y + (moving ? Math.abs(Math.cos(ph)) * 0.03 : 0), r.z);
          _e.set(0, 0, moving ? Math.sin(ph) * 0.12 : 0, "YXZ");
          b.quaternion.setFromEuler(_e);
        }
      }
      // pédalo : sur la tête à terre, à flot dans l'eau
      if (B.p_boat) {
        const b = B.p_boat, r = this.restP.p_boat, k = w.water;
        const bob = Math.sin(t * 2.2 + this.id) * 0.03;
        const landY = 2.05 * this.bodyScaleY + 0.32 + (moving ? Math.abs(Math.sin(this._phase())) * 0.04 : 0);
        const seatY = r.y + 0.52 * k - 0.2 * k + bob * k;
        b.position.set(0, landY * (1 - k) + (r.y + 0.05 + bob) * k, 0.1 * (1 - k));
        _e.set(0.06 * (1 - k) + Math.sin(t * 1.7) * 0.03 * k, 0, Math.sin(t * 2.1) * 0.04 * k + (moving && k < 0.5 ? Math.sin(this._phase()) * 0.05 : 0), "YXZ");
        b.quaternion.setFromEuler(_e);
        void seatY;
        if (B.p_paddle) { B.p_paddle.quaternion.copy(this.restQ.p_paddle); if (k > 0.5 && moving) this.wheelA += dt * 7; this._rot(B.p_paddle, _X, this.wheelA); }
        // assis dans le pédalo : le corps descend sur le siège
        B.root.position.set(0, k * -0.18, k * -0.3);
      }
      // tondeuse : roues selon la vitesse
      if (B.p_wheelR) {
        this.wheelA += (speed * dt) / 0.45 * (s.overheated ? 1.6 : 1);
        B.p_wheelR.quaternion.copy(this.restQ.p_wheelR);
        this._rot(B.p_wheelR, _X, this.wheelA);
        B.p_wheelF.quaternion.copy(this.restQ.p_wheelF);
        this._rot(B.p_wheelF, _X, this.wheelA * 1.5);
      }
    }

    _writeData(flash, speed) {
      const e = this.dataBone.matrixWorld.elements, w = this.w;
      e[0] = flash; e[1] = w.wet; e[2] = w.frozen; e[3] = w.burn;
      e[4] = w.ghost; e[5] = w.diss; e[6] = w.heat; e[7] = w.boost;
      e[8] = Math.min(1.5, speed / 3); e[9] = w.lure; e[10] = 0; e[11] = 0;
      e[12] = 0; e[13] = 0; e[14] = 0; e[15] = 1;
    }

    /** Retour à la réserve (caché, remis à zéro). */
    release() {
      if (this.released) return;
      for (const k in this.fly) this._landProp(k);
      this.reset();
      this.object.visible = false;
      this.released = true;
      A.actives.delete(this);
      if (A.overlay && A.overlay.released) A.overlay.released(this);
      const key = this.tpl.key;
      if (!POOLS.has(key)) POOLS.set(key, []);
      POOLS.get(key).push(this);
    }
  }
  const ARM_L = ["upperarm_l", "lowerarm_l", "hand_l"];
  const SIDES = ["l", "r"];
  const FLIPS = ["flip_l", "flip_r"];
  const ARM_R = ["upperarm_r", "lowerarm_r", "hand_r"];
  const _X = new THREE.Vector3(1, 0, 0);
  function bounceOut(t) {
    const n1 = 7.5625, d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  }
  A.Actor = Actor;

  // ---------------------------------------------------------------------------------------------
  // API publique
  // ---------------------------------------------------------------------------------------------
  /** Crée (ou réutilise) un ennemi. type : 'voleur'|'sprinteur'|'demenageur'|'fumigene'|'nageur'|'boss'. */
  A.create = function (type, elite) {
    if (!BASE) throw new Error("PTMT.actors.create : appeler d’abord await PTMT.actors.load(url)");
    const tpl = templateFor(type, !!elite);
    const pool = POOLS.get(tpl.key);
    let a = pool && pool.length ? pool.pop() : null;
    if (a) { a.reset(); a.released = false; a.object.visible = true; }
    else a = new Actor(tpl);
    A.actives.add(a);
    return a;
  };
  /** Pré-remplit la réserve (évite les pics de création en jeu). */
  A.prewarm = function (type, elite, count) {
    const list = [];
    for (let i = 0; i < count; i++) list.push(A.create(type, elite));
    for (const a of list) a.release();
  };
  /** Statistiques par variante (triangles, sommets, os, appels de dessin). */
  A.stats = function () {
    const out = {};
    for (const [k, t] of TEMPLATES) out[k] = Object.assign({ label: t.spec.label }, t.stats);
    return out;
  };
  A.template = templateFor;
  A.base = () => BASE;
})();
