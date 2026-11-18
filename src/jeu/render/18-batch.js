// « Pas touche à mes trésors » — lots immobiles de la carte (PTMT.view, partie « lots »).
//
// Moins d'appels de dessin : les maillages immobiles de la carte sont recopiés, dans le repère de la
// carte, en un seul maillage par famille de matière. Les originaux restent dans la scène, cachés :
// leurs modèles gardent leurs repères (logements des cachettes, dessus des buttes), leurs lueurs et
// leurs animations par uniformes (vent, temps), qui valent aussi pour la copie.
//  - Pièces « peintes » du Décor (PTMT.models.props.paint) des cachettes, des buttes, du moulin, du
//    décor des cases X et des petits éléments de sol : une copie par famille de matière (même
//    programme, mêmes textures, mêmes réglages). Deux matières qui ne diffèrent que par leur
//    éclairement propre (uLift) et la force de leur liseré (uRim.z) vont dans la même copie : l'écart
//    est reporté sur les sommets (lueur aInfo.z, liseré aPivot.w), le rendu ne change pas. Positions,
//    normales et pivots (vent) suivent la transformation de leur objet.
//  - Qualité « low » : arbres du tablier, rochers des buttes, ponts et poteaux des entrées en un seul
//    maillage (une phase de vent par arbre, couleur d'instance recopiée dans les sommets) ; pierres
//    des menhirs dans une matière commune qui bat au même rythme (l'éclat d'un menhir sous une tour
//    reste porté par ses propres lueurs).
//
//   world.batchStatic() : à la construction ; world.batchDirty = true quand une source bouge
//   (cachettes tournées vers la caméra, cachette refaite) : les lots sont refaits à l'image suivante.
//   world.updateBatch(dt, time) : battement des pierres des menhirs (appelé par world.update).
//   world.batchInfo → { lots, sources } : bilan (banc d'essai).
(function () {
  "use strict";
  const PTMT = (globalThis.PTMT = globalThis.PTMT || {});
  if (typeof THREE === "undefined") return;
  const VIEW = (PTMT.view = PTMT.view || {});
  const MK = (VIEW._map = VIEW._map || {});
  if (!MK.World) return;
  const W = MK.World.prototype;
  const _m = new THREE.Matrix4(), _mi = new THREE.Matrix4(), _inv = new THREE.Matrix4(), _n = new THREE.Matrix3();
  const _v = new THREE.Vector3(), _c = new THREE.Color();

  /* ------------------------------------------------------------------ pièces peintes du Décor */
  /** Matière « peinte » regroupable de ce maillage, sinon null. */
  function paintedOf(mesh) {
    if (!mesh.isMesh || mesh.isInstancedMesh || mesh.isSkinnedMesh) return null;
    const m = mesh.material, g = mesh.geometry;
    if (!m || Array.isArray(m) || !m.isMeshStandardMaterial || !m.userData || !m.userData.u) return null;
    if (!g || !g.index || !g.attributes.position || !g.attributes.normal || !g.attributes.color) return null;
    if (!g.attributes.aPivot || !g.attributes.aInfo) return null;
    const d = m.defines || {};
    if ("PT_CUT" in d || "PT_RIG" in d) return null; // états propres à leur modèle (coupe, roue du moulin)
    if (m.emissiveMap || m.transparent || m.alphaTest > 0) return null;
    if (g.groups && g.groups.length > 1) return null;
    return m;
  }
  /** Famille : tout ce qui change le programme ou le rendu, sauf uLift et uRim.z (reportés sur les sommets). */
  function familyKey(m, mesh, high) {
    const u = m.userData.u, g = mesh.geometry;
    return [
      Object.keys(m.defines || {}).sort().join(","),
      m.map ? m.map.uuid : "-",
      m.roughness,
      m.metalness,
      m.flatShading ? 1 : 0,
      m.side,
      m.vertexColors ? 1 : 0,
      m.color ? m.color.getHex() : 0,
      m.emissive ? m.emissive.getHex() : 0,
      u.uTri ? u.uTri.value : "-",
      high ? (mesh.castShadow ? "c" : "n") : "",
      g.attributes.uv ? "uv" : "-",
    ].join("|");
  }
  /**
   * Copie fusionnée (repère de la carte) de maillages peints : list = [maillage…], dst = matière de la
   * copie. Les écarts d'éclairement propre et de liseré de chaque source sont reportés sur ses sommets.
   */
  function mergePainted(list, dst, inv) {
    let nv = 0, ni = 0;
    const uv = list.every((mesh) => !!mesh.geometry.attributes.uv);
    for (const mesh of list) {
      nv += mesh.geometry.attributes.position.count;
      ni += mesh.geometry.index.count;
    }
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3);
    const piv = new Float32Array(nv * 4), inf = new Float32Array(nv * 4), tex = uv ? new Float32Array(nv * 2) : null;
    const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
    const du = dst.userData.u;
    const dLift0 = du.uLift ? du.uLift.value : 0, dRim = du.uRim ? du.uRim.value.z : 0;
    let ov = 0, oi = 0;
    for (const mesh of list) {
      const g = mesh.geometry, A = g.attributes, su = mesh.material.userData.u;
      const dl = (su.uLift ? su.uLift.value : dLift0) - dLift0;
      const rk = dRim > 1e-4 && su.uRim ? su.uRim.value.z / dRim : 1;
      _m.multiplyMatrices(inv, mesh.matrixWorld);
      _n.getNormalMatrix(_m);
      const n = A.position.count;
      for (let i = 0; i < n; i++) {
        const o = ov + i;
        _v.fromBufferAttribute(A.position, i).applyMatrix4(_m);
        pos[o * 3] = _v.x;
        pos[o * 3 + 1] = _v.y;
        pos[o * 3 + 2] = _v.z;
        _v.fromBufferAttribute(A.normal, i).applyMatrix3(_n).normalize();
        nor[o * 3] = _v.x;
        nor[o * 3 + 1] = _v.y;
        nor[o * 3 + 2] = _v.z;
        col[o * 3] = A.color.getX(i);
        col[o * 3 + 1] = A.color.getY(i);
        col[o * 3 + 2] = A.color.getZ(i);
        _v.set(A.aPivot.getX(i), A.aPivot.getY(i), A.aPivot.getZ(i)).applyMatrix4(_m);
        piv[o * 4] = _v.x;
        piv[o * 4 + 1] = _v.y;
        piv[o * 4 + 2] = _v.z;
        piv[o * 4 + 3] = A.aPivot.getW(i) * rk;
        let e = A.aInfo.getZ(i);
        // lueur fixe (≤ 1) : on y ajoute l'écart d'éclairement ; scintillante (> 1) : inchangée
        if (e <= 1 && dl !== 0) e = Math.min(1, e + dl);
        inf[o * 4] = A.aInfo.getX(i);
        inf[o * 4 + 1] = A.aInfo.getY(i);
        inf[o * 4 + 2] = e;
        inf[o * 4 + 3] = A.aInfo.getW(i);
        if (tex) {
          tex[o * 2] = A.uv.getX(i);
          tex[o * 2 + 1] = A.uv.getY(i);
        }
      }
      const I = g.index;
      for (let k = 0; k < I.count; k++) idx[oi + k] = I.getX(k) + ov;
      ov += n;
      oi += I.count;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    g.setAttribute("aPivot", new THREE.BufferAttribute(piv, 4));
    g.setAttribute("aInfo", new THREE.BufferAttribute(inf, 4));
    if (tex) g.setAttribute("uv", new THREE.BufferAttribute(tex, 2));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeBoundingSphere();
    // le vent fait déborder un peu les pièces de leur boîte d'origine
    g.boundingSphere.radius += 1.5;
    return g;
  }

  /** Objets du Décor immobiles dont les pièces peintes peuvent être regroupées. */
  W.batchSources = function () {
    const out = [];
    const add = (r) => {
      const o = MK.objOf(r);
      if (o) out.push(o);
    };
    for (const L of this.lairs || []) add(L.model);
    for (const b of this.buttes || []) add(b.model);
    add(this.millModel);
    add(this.decor);
    add(this.scatter);
    return out;
  };

  /** Défait les lots des pièces peintes (sources de nouveau visibles). */
  W.unbatchPainted = function () {
    for (const mesh of this.batchHidden || []) mesh.visible = true;
    this.batchHidden = [];
    for (const lot of this.batchLots || []) {
      if (lot.parent) lot.parent.remove(lot);
      lot.geometry.dispose();
    }
    this.batchLots = [];
  };

  /** Regroupe les pièces peintes des objets immobiles, famille par famille. */
  W.batchPainted = function () {
    this.unbatchPainted();
    const root = this.root;
    root.updateMatrixWorld(true);
    _inv.copy(root.matrixWorld).invert();
    const fams = new Map();
    for (const o of this.batchSources()) {
      if (!o.parent) continue;
      o.traverse((mesh) => {
        if (!mesh.visible) return;
        const m = paintedOf(mesh);
        if (!m) return;
        const key = familyKey(m, mesh, this.high);
        let f = fams.get(key);
        if (!f) fams.set(key, (f = []));
        f.push(mesh);
      });
    }
    let sources = 0;
    for (const list of fams.values()) {
      if (list.length < 2) continue;
      // matière de la copie : la plus partagée de la famille (le moins d'écarts à reporter)
      const count = new Map();
      for (const mesh of list) count.set(mesh.material, (count.get(mesh.material) || 0) + 1);
      let dst = list[0].material, best = 0;
      for (const [mat, c] of count)
        if (c > best) {
          best = c;
          dst = mat;
        }
      const lot = new THREE.Mesh(mergePainted(list, dst, _inv), dst);
      lot.name = "Lot : " + [...new Set(list.map((mesh) => mesh.name || "pièces"))].join(", ");
      lot.castShadow = this.high && list.some((mesh) => mesh.castShadow);
      lot.receiveShadow = list.some((mesh) => mesh.receiveShadow);
      if (dst.userData.depth) lot.customDepthMaterial = dst.userData.depth;
      lot.userData.lot = true;
      root.add(lot);
      this.batchLots.push(lot);
      for (const mesh of list) {
        mesh.visible = false;
        this.batchHidden.push(mesh);
      }
      sources += list.length;
    }
    return sources;
  };

  /* ------------------------------------------------------------------ arbres, ponts et poteaux (low) */
  function treeLotMaterial() {
    const TIME = MK.treeTime || { value: 0 };
    return PTMT.mat("view:tree:lot", () => {
      const m = new THREE.MeshLambertMaterial({ vertexColors: true });
      m.onBeforeCompile = (sh) => {
        sh.uniforms.uTime = TIME;
        sh.vertexShader = sh.vertexShader
          .replace("#include <common>", "#include <common>\nattribute float sway;\nattribute float aPhase;\nuniform float uTime;")
          .replace(
            "#include <begin_vertex>",
            `#include <begin_vertex>
            float sw = sway * 0.022;
            transformed.x += sin(uTime * 1.3 + aPhase) * sw;
            transformed.z += cos(uTime * 1.05 + aPhase * 1.3) * sw * 0.7;`,
          );
      };
      m.customProgramCacheKey = () => "ptmt-view-tree-lot";
      return m;
    });
  }
  /** Un seul maillage pour les arbres du tablier, les rochers des buttes, les ponts et les poteaux. */
  W.batchMine = function () {
    const root = this.root;
    const list = root.children.filter((o) => o.isMesh && o.userData && (o.userData.batch === "tree" || o.userData.batch === "plain") && o.geometry && !o.geometry.index && o.geometry.attributes.color);
    if (list.length < 2) return 0;
    root.updateMatrixWorld(true);
    _inv.copy(root.matrixWorld).invert();
    let nv = 0;
    for (const mesh of list) nv += mesh.geometry.attributes.position.count * (mesh.isInstancedMesh ? mesh.count : 1);
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3);
    const sway = new Float32Array(nv), phase = new Float32Array(nv);
    let ov = 0;
    for (const mesh of list) {
      const A = mesh.geometry.attributes, n = A.position.count;
      const k = mesh.isInstancedMesh ? mesh.count : 1;
      for (let q = 0; q < k; q++) {
        _m.multiplyMatrices(_inv, mesh.matrixWorld);
        if (mesh.isInstancedMesh) {
          mesh.getMatrixAt(q, _mi);
          _m.multiply(_mi);
        }
        _n.getNormalMatrix(_m);
        if (mesh.isInstancedMesh && mesh.instanceColor) mesh.getColorAt(q, _c);
        else _c.setRGB(1, 1, 1);
        // phase du vent : celle que la matière des arbres tire de la position de l'instance
        _v.set(0, 0, 0).applyMatrix4(_m);
        const ph = mesh.isInstancedMesh ? _v.x * 0.21 + _v.z * 0.17 : 0;
        for (let i = 0; i < n; i++) {
          const o = ov + i;
          _v.fromBufferAttribute(A.position, i).applyMatrix4(_m);
          pos[o * 3] = _v.x;
          pos[o * 3 + 1] = _v.y;
          pos[o * 3 + 2] = _v.z;
          _v.fromBufferAttribute(A.normal, i).applyMatrix3(_n).normalize();
          nor[o * 3] = _v.x;
          nor[o * 3 + 1] = _v.y;
          nor[o * 3 + 2] = _v.z;
          col[o * 3] = A.color.getX(i) * _c.r;
          col[o * 3 + 1] = A.color.getY(i) * _c.g;
          col[o * 3 + 2] = A.color.getZ(i) * _c.b;
          sway[o] = A.sway ? A.sway.getX(i) : 0;
          phase[o] = ph;
        }
        ov += n;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    g.setAttribute("sway", new THREE.BufferAttribute(sway, 1));
    g.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
    g.computeBoundingSphere();
    g.boundingSphere.radius += 0.5;
    const lot = new THREE.Mesh(g, treeLotMaterial());
    lot.name = "Lot : tablier, rochers, ponts, poteaux";
    lot.castShadow = false;
    lot.receiveShadow = true;
    lot.userData.lot = true;
    root.add(lot);
    this.disposables.push(g);
    for (const mesh of list) {
      root.remove(mesh);
      // géométries partagées des arbres : gardées (cache) ; celles des ponts et poteaux : libérées
      if (mesh.userData.batch === "plain") mesh.geometry.dispose();
      if (mesh.isInstancedMesh && mesh.dispose) mesh.dispose();
    }
    if (this.apronMeshes) this.apronMeshes.length = 0;
    return list.length;
  };

  /* ------------------------------------------------------------------ pierres des menhirs (low) */
  W.batchMenhirs = function () {
    const P = PTMT.models && PTMT.models.props;
    if (!P || typeof P.paint !== "function") return 0;
    const bodies = [];
    for (const mh of this.menhirs || []) {
      const o = MK.objOf(mh.model);
      if (!o) continue;
      o.traverse((c) => {
        const m = c.material;
        if (!c.isMesh || c.isInstancedMesh || !m || Array.isArray(m) || !m.isMeshStandardMaterial || !m.emissiveMap) return;
        if (!m.userData || !m.userData.u || !c.geometry.index || !c.geometry.attributes.aPivot || !c.geometry.attributes.aInfo) return;
        bodies.push(c);
      });
    }
    if (bodies.length < 2) return 0;
    const m0 = bodies[0].material, u0 = m0.userData.u;
    const same = bodies.every((b) => b.material.map === m0.map && b.material.emissiveMap === m0.emissiveMap && !!b.geometry.attributes.uv === !!bodies[0].geometry.attributes.uv);
    if (!same) return 0;
    const mat = P.paint({ map: m0.map, rim: u0.uRim ? u0.uRim.value.toArray() : undefined, lift: u0.uLift ? u0.uLift.value : undefined, rough: m0.roughness, name: "menhirs" });
    mat.emissiveMap = m0.emissiveMap;
    mat.emissive = m0.emissive.clone();
    mat.emissiveIntensity = m0.emissiveIntensity;
    this.root.updateMatrixWorld(true);
    _inv.copy(this.root.matrixWorld).invert();
    const lot = new THREE.Mesh(mergePainted(bodies, mat, _inv), mat);
    lot.name = "Lot : menhirs";
    lot.receiveShadow = true;
    lot.userData.lot = true;
    this.root.add(lot);
    this.disposables.push(lot.geometry, mat);
    for (const b of bodies) b.visible = false;
    this.menhirLot = { mesh: lot, mat, t: 0 };
    return bodies.length;
  };

  /* ------------------------------------------------------------------ cycle */
  W.batchStatic = function () {
    this.batchDirty = false;
    const info = (this.batchInfo = this.batchInfo || { lots: 0, sources: 0, mine: 0, menhirs: 0 });
    try {
      info.sources = this.batchPainted();
      if (!this.high && !this.batchedOnce) {
        info.mine = this.batchMine();
        info.menhirs = this.batchMenhirs();
      }
    } catch (e) {
      // un modèle inattendu : on garde les maillages d'origine
      console.warn("Lots de la carte indisponibles", e);
      this.unbatchPainted();
    }
    this.batchedOnce = true;
    info.lots = (this.batchLots || []).length + (info.mine ? 1 : 0) + (this.menhirLot ? 1 : 0);
  };
  W.updateBatch = function (dt) {
    const L = this.menhirLot;
    if (!L) return;
    // même battement que les menhirs du Décor (sans l'éclat d'une tour posée : porté par les lueurs)
    L.t += Math.min(0.1, Math.max(0, dt));
    const beat = 0.5 + 0.5 * Math.sin(L.t * 1.8);
    L.mat.emissiveIntensity = 0.55 + beat * 0.55;
  };
  W.disposeBatch = function () {
    this.unbatchPainted();
    this.menhirLot = null;
  };
})();
