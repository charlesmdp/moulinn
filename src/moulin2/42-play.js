// La Fête du Moulin — aides communes aux jeux : caméra, objets des autres joueurs, appui au sol.
//
//   MF.cam.set(camera, de, vers, fov?)                    place la caméra et la fait regarder un point
//   MF.cam.chase(camera, mémoire, cible, cap, options, dt, sol?)   caméra de poursuite, derrière un véhicule
//   MF.cam.orbit(camera, centre, rayon, hauteur, angle)   tour lent autour d'un point (salle d'attente)
//
//   const autres = MF.remotes({ session, size, angles, make(peer), apply(objet, valeurs, extra, peer), remove(objet) })
//       voitures, bateaux, balles… des autres joueurs : chacun envoie son état avec autres.send(valeurs, extra)
//       (au plus 12 fois par seconde) ; autres.update() à chaque image crée, déplace en douceur et retire
//       leurs objets. « valeurs » : size nombres (position, cap…) ; « extra » : champ libre non lissé.
//
//   MF.freeze(groupe) → fusionne le décor immobile d'un groupe (un appel de dessin par matériau)
//   MF.ribbon(world, ligne, { width, color… }) → piste posée sur le sol, qui épouse le relief
//   MF.obstacles(world, zone) → arbres et murs du domaine ; .add(x, z, r) ; .hit(x, z, r) → { nx, nz, depth } | null
//   MF.ground(world, x, z, écart?) → { y, nx, ny, nz }    hauteur et pente du sol
//   MF.seat(objet, world, x, z, cap, garde?)              pose un objet sur le sol, incliné selon la pente
(function () {
  "use strict";
  const MF = (globalThis.MoulinFete = globalThis.MoulinFete || {});
  const T = () => globalThis.THREE;
  const vec = (p) => (Array.isArray(p) ? { x: p[0], y: p[1], z: p[2] } : p);

  /* ------------------------------------------------------------------ caméra */
  MF.cam = {
    set(camera, from, to, fov) {
      const a = vec(from), b = vec(to);
      camera.position.set(a.x, a.y, a.z);
      camera.lookAt(b.x, b.y, b.z);
      if (fov) MF.cam.fov(camera, fov);
    },
    fov(camera, deg) {
      if (Math.abs(camera.fov - deg) > 0.01) {
        camera.fov = deg;
        camera.updateProjectionMatrix();
      }
    },
    orbit(camera, center, radius, height, angle) {
      const c = vec(center);
      camera.position.set(c.x + Math.sin(angle) * radius, c.y + height, c.z + Math.cos(angle) * radius);
      camera.lookAt(c.x, c.y, c.z);
    },
    /**
     * Caméra de poursuite. state : objet vide gardé par le jeu (lissage). target : { x, y, z } ; heading : cap
     * de la cible (0 = vers +z). options : dist (recul), height (hauteur), look (avance du regard), up
     * (hauteur du point regardé), rate (raideur), snap (true : se place d'un coup). ground(x, z) : hauteur du
     * sol, pour ne jamais passer dessous.
     */
    chase(camera, state, target, heading, o = {}, dt = 0.016, ground) {
      const dist = o.dist ?? 3.2, height = o.height ?? 1.4, look = o.look ?? 0.8, rate = o.rate ?? 6;
      if (state.h === undefined || o.snap) state.h = heading;
      else state.h = MF.dampAngle(state.h, heading, o.turn ?? 5, dt);
      const sx = Math.sin(state.h), sz = Math.cos(state.h);
      let px = target.x - sx * dist, py = target.y + height, pz = target.z - sz * dist;
      if (ground) py = Math.max(py, ground(px, pz) + (o.clear ?? 0.5));
      if (state.x === undefined || o.snap) {
        state.x = px;
        state.y = py;
        state.z = pz;
      } else {
        const k = 1 - Math.exp(-rate * dt);
        state.x += (px - state.x) * k;
        state.y += (py - state.y) * k;
        state.z += (pz - state.z) * k;
        if (ground) state.y = Math.max(state.y, ground(state.x, state.z) + (o.clear ?? 0.5) * 0.7);
      }
      camera.position.set(state.x, state.y, state.z);
      camera.lookAt(target.x + sx * look, target.y + (o.up ?? 0.25), target.z + sz * look);
    },
  };

  /* ------------------------------------------------------------------ sol */
  /** Hauteur et normale du sol en (x, z). d : écart des points de mesure (m). */
  MF.ground = function (world, x, z, d = 0.35, out = {}) {
    const h = world.heightAt;
    const gx = (h(x + d, z) - h(x - d, z)) / (2 * d);
    const gz = (h(x, z + d) - h(x, z - d)) / (2 * d);
    const len = Math.hypot(gx, 1, gz);
    out.y = h(x, z);
    out.nx = -gx / len;
    out.ny = 1 / len;
    out.nz = -gz / len;
    out.gx = gx;
    out.gz = gz;
    return out;
  };
  const gTmp = {};
  /** Pose un objet au sol, tourné vers heading et incliné selon la pente. lift : garde au sol. */
  MF.seat = function (object, world, x, z, heading, lift = 0, groundY) {
    const THREE = T();
    const g = MF.ground(world, x, z, 0.35, gTmp);
    object.position.set(x, (groundY === undefined ? g.y : groundY) + lift, z);
    // repère : y = normale du sol, z = cap projeté sur le sol
    const up = (MF.seat.up = MF.seat.up || new THREE.Vector3());
    const fw = (MF.seat.fw = MF.seat.fw || new THREE.Vector3());
    const rt = (MF.seat.rt = MF.seat.rt || new THREE.Vector3());
    const m = (MF.seat.m = MF.seat.m || new THREE.Matrix4());
    up.set(g.nx, g.ny, g.nz);
    fw.set(Math.sin(heading), 0, Math.cos(heading));
    rt.crossVectors(up, fw).normalize();
    fw.crossVectors(rt, up).normalize();
    m.makeBasis(rt, up, fw);
    object.quaternion.setFromRotationMatrix(m);
    return g;
  };

  /* ------------------------------------------------------------------ ruban au sol, obstacles */
  /**
   * Ruban posé sur le sol le long d'une ligne (piste, allée de jeu) : il épouse le relief.
   * options : width (largeur, m), lift (hauteur au-dessus du sol), color, edge (largeur des bords),
   * edgeColor, opacity, across (points en travers), stripes (bords rayés rouge et blanc dans les virages).
   */
  MF.ribbon = function (world, path, o = {}) {
    const THREE = T();
    const width = o.width || 3, lift = o.lift ?? 0.05, across = o.across || 6, edge = o.edge ?? 0.18;
    const main = MF.color(o.color || "#c9a66b"), border = MF.color(o.edgeColor || "#ffffff"), red = MF.color(MF.PAL.red);
    const pts = path.pts, m = pts.length, rows = path.closed ? m + 1 : m;
    const pos = [], col = [], idx = [];
    for (let r = 0; r < rows; r++) {
      const p = pts[r % m], q = pts[(r + 3) % m];
      // virage ? (changement de direction sur 3 m)
      const bend = o.stripes ? Math.abs(MF.angleDiff(Math.atan2(p.tx, p.tz), Math.atan2(q.tx, q.tz))) > 0.16 : false;
      for (let a = 0; a <= across; a++) {
        const lat = (a / across - 0.5) * width;
        const x = p.x - p.tz * lat, z = p.z + p.tx * lat;
        pos.push(x, world.heightAt(x, z) + lift, z);
        const onEdge = Math.abs(lat) > width / 2 - edge - 1e-6;
        const c = onEdge ? (bend && r % 2 ? red : border) : main;
        col.push(c.r, c.g, c.b);
      }
    }
    for (let r = 0; r < rows - 1; r++)
      for (let a = 0; a < across; a++) {
        const i = r * (across + 1) + a, j = i + across + 1;
        idx.push(i, i + 1, j, i + 1, j + 1, j);
      }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: (o.opacity ?? 1) < 1, opacity: o.opacity ?? 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -6 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.name = o.name || "Ruban_de_piste";
    return mesh;
  };

  /**
   * Obstacles ronds et rectangulaires autour d'un jeu : arbres et bâtiments du domaine dans une zone
   * [x0, z0, x1, z1], plus ce que le jeu ajoute. obstacles.hit(x, z, rayon) → { nx, nz, depth } (de combien
   * et dans quel sens se dégager) ou null.
   */
  MF.obstacles = function (world, zone, o = {}) {
    const circles = [], rects = [];
    const inZone = (x, z, pad = 0) => !zone || (x >= zone[0] - pad && x <= zone[2] + pad && z >= zone[1] - pad && z <= zone[3] + pad);
    if (o.trees !== false) for (const t of world.trees || []) if (inZone(t.x, t.z, 2)) circles.push({ x: t.x, z: t.z, r: o.treeRadius ?? 0.28 + (t.height || 10) * 0.012 });
    if (o.solids !== false)
      for (const r of world.solids || []) {
        const reach = Math.hypot(Math.max(Math.abs(r.u0), Math.abs(r.u1)), Math.max(Math.abs(r.v0), Math.abs(r.v1)));
        if (inZone(r.cx, r.cz, reach + 2)) rects.push(r);
      }
    const out = { nx: 0, nz: 0, depth: 0 };
    return {
      circles,
      rects,
      add(x, z, r) {
        circles.push({ x, z, r });
      },
      hit(x, z, radius) {
        let best = 0;
        for (const c of circles) {
          const dx = x - c.x, dz = z - c.z, lim = c.r + radius, d2 = dx * dx + dz * dz;
          if (d2 >= lim * lim) continue;
          const d = Math.sqrt(d2) || 1e-4, depth = lim - d;
          if (depth > best) {
            best = depth;
            out.nx = dx / d;
            out.nz = dz / d;
          }
        }
        for (const r of rects) {
          const d = MF.rectDistance(x, z, r);
          if (d >= radius) continue;
          const depth = radius - d;
          if (depth > best) {
            const e = 0.05;
            let gx = MF.rectDistance(x + e, z, r) - MF.rectDistance(x - e, z, r), gz = MF.rectDistance(x, z + e, r) - MF.rectDistance(x, z - e, r);
            const l = Math.hypot(gx, gz) || 1;
            best = depth;
            out.nx = gx / l;
            out.nz = gz / l;
          }
        }
        if (!best) return null;
        out.depth = best;
        return out;
      },
    };
  };

  /* ------------------------------------------------------------------ décor fusionné */
  /**
   * Fusionne le décor immobile d'un groupe : tous les maillages qui partagent un matériau deviennent un
   * seul maillage (un seul appel de dessin au lieu de dizaines). Mieux : tous les volumes de couleur
   * unie (matériau mat sans texture, ni transparence, ni lueur) sont fondus en un seul maillage
   * « peint », la couleur passant dans les sommets — une zone entière se dessine alors en un appel.
   * À appeler une fois le décor construit. Ce qui bouge doit porter userData.live = true (lui et ses
   * enfants sont laissés tels quels) ; un matériau repeint en cours de jeu doit être créé « unique ».
   */
  const paints = {};
  /** Matériau commun du décor peint (couleur portée par les sommets). */
  const paint = (flat, side) => {
    const key = (flat ? "f" : "s") + side;
    if (!paints[key]) {
      paints[key] = new (T().MeshLambertMaterial)({ vertexColors: true, flatShading: !!flat, side });
      paints[key].userData.paint = true;
    }
    return paints[key];
  };
  const plain = (m) => m.isMeshLambertMaterial && !m.map && !m.alphaMap && !m.transparent && m.opacity === 1 && !m.vertexColors && m.emissive.getHex() === 0 && !(m.userData && m.userData.unique);
  MF.freeze = function (root) {
    const THREE = T();
    root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
    const buckets = new Map();
    (function collect(o) {
      if (o.userData && o.userData.live) return;
      if (o.isMesh && !o.isInstancedMesh && o.visible && o.geometry && o.geometry.attributes.position && !Array.isArray(o.material)) {
        const mat = o.material, baked = !!(mat.userData && mat.userData.paint && o.geometry.attributes.color);
        const painted = baked || (plain(mat) && !o.geometry.attributes.color);
        if (painted || !o.geometry.attributes.color) {
          const target = painted ? paint(mat.flatShading, mat.side) : mat;
          const key = target.uuid + (o.castShadow ? "c" : "") + (o.receiveShadow ? "r" : "");
          if (!buckets.has(key)) buckets.set(key, { material: target, painted, cast: o.castShadow, receive: o.receiveShadow, list: [] });
          buckets.get(key).list.push(o);
        }
      }
      for (const c of o.children.slice()) collect(c);
    })(root);
    const m = new THREE.Matrix4(), n3 = new THREE.Matrix3(), v = new THREE.Vector3();
    for (const b of buckets.values()) {
      if (b.list.length < 2 && !(b.painted && !b.list[0].geometry.attributes.color)) continue;
      let nv = 0, ni = 0;
      for (const o of b.list) {
        nv += o.geometry.attributes.position.count;
        ni += o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count;
      }
      const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), col = b.painted ? new Float32Array(nv * 3) : null;
      const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
      let vo = 0, io = 0;
      for (const o of b.list) {
        const g = o.geometry, P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv, C = g.attributes.color, tint = o.material.color;
        m.multiplyMatrices(inv, o.matrixWorld);
        n3.getNormalMatrix(m);
        for (let i = 0; i < P.count; i++) {
          const k = (vo + i) * 3;
          v.fromBufferAttribute(P, i).applyMatrix4(m);
          pos[k] = v.x;
          pos[k + 1] = v.y;
          pos[k + 2] = v.z;
          if (N) {
            v.fromBufferAttribute(N, i).applyMatrix3(n3).normalize();
            nor[k] = v.x;
            nor[k + 1] = v.y;
            nor[k + 2] = v.z;
          }
          if (U) {
            uv[(vo + i) * 2] = U.getX(i);
            uv[(vo + i) * 2 + 1] = U.getY(i);
          }
          if (col) {
            // déjà peint (fusion d'un sous-groupe) : on reprend ses couleurs ; sinon celle de son matériau
            col[k] = C ? C.getX(i) : tint.r;
            col[k + 1] = C ? C.getY(i) : tint.g;
            col[k + 2] = C ? C.getZ(i) : tint.b;
          }
        }
        if (g.index) for (let i = 0; i < g.index.count; i++) idx[io++] = g.index.getX(i) + vo;
        else for (let i = 0; i < P.count; i++) idx[io++] = vo + i;
        vo += P.count;
        o.parent.remove(o);
        g.dispose();
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      geo.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
      geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
      if (col) geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
      geo.setIndex(new THREE.BufferAttribute(idx, 1));
      const mesh = new THREE.Mesh(geo, b.material);
      mesh.castShadow = b.cast;
      mesh.receiveShadow = b.receive;
      mesh.name = "Decor_fusionne";
      root.add(mesh);
    }
    return root;
  };

  /* ------------------------------------------------------------------ objets des autres joueurs */
  MF.remotes = function ({ session, size, angles = [], delay = 0.12, rate = 12, timeout = 2.5, make, apply, remove }) {
    const map = new Map();
    const values = new Array(size).fill(0);
    let lastSend = 0;
    const round = (v) => Math.round(v * 1000) / 1000;
    session.onState((d, peer) => {
      if (!Array.isArray(d) || d.length < size + 1) return;
      let r = map.get(peer.uid);
      if (!r) {
        r = { peer, obj: make(peer), it: MF.interp(size, angles, delay), seen: 0, extra: null, shown: false };
        map.set(peer.uid, r);
      }
      const now = performance.now();
      r.seen = now;
      r.it.push(+d[0] || 0, d.slice(1, size + 1), now / 1000);
      r.extra = d.length > size + 1 ? d[size + 1] : null;
    });
    const drop = (uid) => {
      const r = map.get(uid);
      if (!r) return;
      map.delete(uid);
      if (remove) remove(r.obj, r.peer);
      else if (r.obj && r.obj.parent) {
        r.obj.parent.remove(r.obj);
        MF.dispose(r.obj);
      }
    };
    return {
      map,
      get: (uid) => map.get(uid) || null,
      /** Envoie mon état aux autres. force : sans attendre le rythme habituel (arrivée, tir…). */
      send(vals, extra, force) {
        const now = performance.now();
        if (!force && now - lastSend < 1000 / rate) return false;
        lastSend = now;
        const msg = [round(now / 1000)];
        for (let i = 0; i < size; i++) msg.push(round(vals[i]));
        if (extra !== undefined) msg.push(extra);
        session.sendState(msg);
        return true;
      },
      /** Chaque image. Renvoie vrai si un objet distant est à l'écran (il faut redessiner). */
      update() {
        const now = performance.now();
        let any = false;
        for (const [uid, r] of map) {
          if (now - r.seen > timeout * 1000) {
            drop(uid);
            any = true;
            continue;
          }
          if (r.it.sample(now / 1000, values)) {
            apply(r.obj, values, r.extra, r.peer, r);
            any = true;
          }
        }
        return any;
      },
      drop,
      clear() {
        for (const uid of [...map.keys()]) drop(uid);
      },
    };
  };
})();
