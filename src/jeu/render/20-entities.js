// « Pas touche à mes trésors » — représentation 3D de l'état du jeu : tours, pièges, coffres,
// ennemis, projectiles, zones, sacs, barres de vie, aperçus (portée, trajets, visée des sorts).
// Utilise les modèles (PTMT.models), personnages (PTMT.actors) et effets (PTMT.fx) quand ils
// sont présents, sinon des formes de secours.
(function () {
  "use strict";
  const PTMT = (globalThis.PTMT = globalThis.PTMT || {});
  const G = PTMT.geom;
  const U = PTMT.U;

  const FAMILY_COLOR = { fire: "#ef6a2c", ice: "#7fdaf5", water: "#2f8fd6" };

  function Entities(ctx, world) {
    this.ctx = ctx;
    this.world = world;
    this.root = new THREE.Group();
    this.root.name = "Entites";
    ctx.scene.add(this.root);
    this.towers = new Map();
    this.traps = new Map();
    this.chests = new Map();
    this.enemies = new Map();
    this.projectiles = new Map();
    this.areas = new Map();
    this.sacks = new Map();
    this.transients = [];
    this.floaters = [];
    this.fxReady = !!(PTMT.fx && PTMT.fx.projectile);
    this.actorsReady = !!(PTMT.actors && PTMT.actors.create && PTMT.actors.ready);
    this.tmp = new THREE.Vector3();
    this.buildOverlays();
    this.buildHealthBars();
  }
  const E = Entities.prototype;

  E.pos = function (x, z, lift = 0, out) {
    return this.world.toWorld(x, z, this.world.heightU(x, z) + lift, out);
  };

  // ── Aperçus : portée, sélection, trajets, visée ───────────────────────────────
  E.buildOverlays = function () {
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false });
    this.range = new THREE.Mesh(new THREE.RingGeometry(0.985, 1, 96), ringMat);
    this.range.rotation.x = -Math.PI / 2;
    this.range.visible = false;
    this.range.renderOrder = 5;
    const fill = new THREE.Mesh(new THREE.CircleGeometry(1, 96), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.1, depthWrite: false }));
    this.range.add(fill);
    fill.position.z = -0.002;
    this.rangeFill = fill;
    this.root.add(this.range);
    this.selection = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.85, 40), new THREE.MeshBasicMaterial({ color: 0xffe07a, transparent: true, opacity: 0.9, depthWrite: false }));
    this.selection.rotation.x = -Math.PI / 2;
    this.selection.visible = false;
    this.selection.renderOrder = 6;
    this.root.add(this.selection);
    // Visée des sorts : cercle ou bande.
    this.aimCircle = new THREE.Mesh(new THREE.CircleGeometry(1, 64), new THREE.MeshBasicMaterial({ color: 0xffd36b, transparent: true, opacity: 0.28, depthWrite: false }));
    this.aimCircle.rotation.x = -Math.PI / 2;
    this.aimCircle.visible = false;
    this.aimCircle.renderOrder = 7;
    const edge = new THREE.Mesh(new THREE.RingGeometry(0.95, 1, 64), new THREE.MeshBasicMaterial({ color: 0xffd36b, transparent: true, opacity: 0.9, depthWrite: false }));
    this.aimCircle.add(edge);
    this.root.add(this.aimCircle);
    this.aimBand = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x6fc3ff, transparent: true, opacity: 0.32, depthWrite: false }));
    this.aimBand.rotation.x = -Math.PI / 2;
    this.aimBand.visible = false;
    this.aimBand.renderOrder = 7;
    this.root.add(this.aimBand);
    // Trajets prévus.
    this.routeGroup = new THREE.Group();
    this.root.add(this.routeGroup);
    this.routeMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(1, 0.35, 0.25) } },
      transparent: true,
      depthWrite: false,
      vertexShader: "attribute float along; varying float vA; varying float vV; void main(){ vA = along; vV = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader:
        "uniform float uTime; uniform vec3 uColor; varying float vA; varying float vV; void main(){ float c = fract(vA * 0.35 - uTime * 0.9); float chevron = step(abs(vV - 0.5) * 0.9, c) * step(c, abs(vV - 0.5) * 0.9 + 0.35); float edge = smoothstep(0.5, 0.42, abs(vV - 0.5)); gl_FragColor = vec4(uColor, (0.22 + chevron * 0.6) * edge); }",
    });
  };
  E.showRange = function (x, z, r, color) {
    if (!r) {
      this.range.visible = false;
      return;
    }
    this.range.visible = true;
    this.pos(x, z, 0.12, this.range.position);
    this.range.scale.setScalar(r * U);
    this.range.material.color.set(color || 0xffffff);
    this.rangeFill.material.color.set(color || 0xffffff);
  };
  E.showSelection = function (x, z, r = 1) {
    if (x === null) {
      this.selection.visible = false;
      return;
    }
    this.selection.visible = true;
    this.pos(x, z, 0.15, this.selection.position);
    this.selection.scale.setScalar(r);
  };
  E.showAim = function (kind, x, z, stats, yaw) {
    this.aimCircle.visible = false;
    this.aimBand.visible = false;
    if (!kind) return;
    if (kind === "flood") {
      this.aimBand.visible = true;
      this.pos(x, z, 0.2, this.aimBand.position);
      this.aimBand.scale.set(stats.width * U, stats.length * U, 1);
      this.aimBand.rotation.set(-Math.PI / 2, 0, yaw || 0);
    } else {
      this.aimCircle.visible = true;
      this.pos(x, z, 0.2, this.aimCircle.position);
      this.aimCircle.scale.setScalar(Math.max(0.6, stats.radius || 1) * U);
      const col = { meteor: 0xff8a3d, freeze: 0x9fe8ff, frenzy: 0xc9a8ff, recall: 0xffe07a }[kind] || 0xffffff;
      this.aimCircle.material.color.set(col);
      this.aimCircle.children[0].material.color.set(col);
    }
  };
  /** Trajets prévus de la prochaine vague (flèches animées au sol). */
  E.showRoutes = function (routes) {
    for (const c of [...this.routeGroup.children]) {
      this.routeGroup.remove(c);
      c.geometry.dispose();
    }
    if (!routes) return;
    for (const r of routes) {
      const pts = r.pts;
      const pos = [],
        uv = [],
        along = [],
        idx = [];
      let acc = 0;
      const S = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i],
          b = pts[i + 1];
        const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.5));
        for (let k = 0; k < n; k++) S.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
      }
      S.push(pts[pts.length - 1]);
      for (let i = 0; i < S.length; i++) {
        const a = S[Math.max(0, i - 1)],
          b = S[Math.min(S.length - 1, i + 1)];
        let dx = b[0] - a[0],
          dz = b[1] - a[1];
        const l = Math.hypot(dx, dz) || 1;
        dx /= l;
        dz /= l;
        if (i) acc += Math.hypot(S[i][0] - S[i - 1][0], S[i][1] - S[i - 1][1]);
        const hw = 0.42;
        for (const s of [1, -1]) {
          const x = S[i][0] - dz * hw * s,
            z = S[i][1] + dx * hw * s;
          const y = Math.max(this.world.heightU(x, z), r.swimmer ? 0.1 : 0) + 0.14;
          const w = this.world.toWorld(x, z, y);
          pos.push(w.x, w.y, w.z);
          uv.push(0, s > 0 ? 1 : 0);
          along.push(acc);
        }
        if (i < S.length - 1) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
      g.setAttribute("along", new THREE.Float32BufferAttribute(along, 1));
      g.setIndex(idx);
      const m = new THREE.Mesh(g, this.routeMat);
      m.renderOrder = 4;
      this.routeGroup.add(m);
    }
  };

  // ── Barres de vie (quadrilatères instanciés, toujours face à la caméra) ────────────
  E.buildHealthBars = function () {
    const max = 120;
    const geo = new THREE.InstancedBufferGeometry();
    const base = new THREE.PlaneGeometry(1, 1);
    geo.index = base.index;
    geo.attributes.position = base.attributes.position;
    geo.attributes.uv = base.attributes.uv;
    this.hbCenter = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.hbData = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4);
    this.hbCenter.setUsage(THREE.DynamicDrawUsage);
    this.hbData.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute("center", this.hbCenter);
    geo.setAttribute("data", this.hbData);
    geo.instanceCount = 0;
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthTest: false,
      vertexShader: `attribute vec3 center; attribute vec4 data; varying vec2 vUv; varying vec4 vData;
        void main(){ vUv = uv; vData = data;
          vec4 mv = modelViewMatrix * vec4(center, 1.0);
          float w = 1.1 + data.w * 0.8;
          mv.xy += position.xy * vec2(w, 0.16);
          gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec2 vUv; varying vec4 vData;
        void main(){ float hp = vData.x; vec2 p = vUv;
          float border = step(p.x, 0.03) + step(0.97, p.x) + step(p.y, 0.12) + step(0.88, p.y);
          vec3 col = hp > p.x ? mix(vec3(0.9,0.25,0.18), vec3(0.35,0.85,0.3), smoothstep(0.25, 0.6, hp)) : vec3(0.12,0.1,0.1);
          if (vData.y > 0.5 && hp > p.x) col = mix(col, vec3(1.0,0.85,0.25), 0.55);
          if (vData.z > 0.5) col = mix(col, vec3(0.6, 0.9, 1.0), 0.5);
          col = border > 0.0 ? vec3(0.05) : col;
          gl_FragColor = vec4(col, 0.92); }`,
    });
    this.hb = new THREE.Mesh(geo, mat);
    this.hb.frustumCulled = false;
    this.hb.renderOrder = 20;
    this.root.add(this.hb);
    this.hbMax = max;
  };

  // ── Formes de secours ─────────────────────────────────────────────────────────
  E.fallbackTower = function (family, tier, branch) {
    const g = new THREE.Group();
    const col = FAMILY_COLOR[family];
    const h = 1.4 + tier * 0.7;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.9 + tier * 0.15, 1.1 + tier * 0.15, 0.6, 10), PTMT.solid("#8f887c"));
    base.position.y = 0.3;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.75, h, 10), PTMT.solid(col));
    body.position.y = 0.6 + h / 2;
    const head = new THREE.Group();
    head.position.y = 0.6 + h;
    const hm = new THREE.Mesh(branch === "B" ? new THREE.ConeGeometry(0.7, 0.9, 8) : new THREE.SphereGeometry(0.6, 12, 10), PTMT.glow(col, 0.6));
    head.add(hm);
    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.8), PTMT.solid("#3b3530"));
    snout.position.z = 0.6;
    head.add(snout);
    for (const o of [base, body, hm, snout]) o.castShadow = true;
    g.add(base, body, head);
    let yaw = 0,
      want = 0,
      kick = 0;
    return {
      object: g,
      height: 0.6 + h + 0.6,
      aim(y) {
        want = y;
      },
      update(dt) {
        let d = ((want - yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
        if (d < -Math.PI) d += Math.PI * 2;
        yaw += Math.max(-dt * 6, Math.min(dt * 6, d));
        head.rotation.y = yaw;
        kick = Math.max(0, kick - dt * 4);
        head.scale.setScalar(1 + kick * 0.25);
      },
      trigger(k) {
        if (k === "fire" || k === "pulse") kick = 1;
      },
      muzzle(i, out) {
        return snout.getWorldPosition(out);
      },
      setSelected() {},
      setFrenzy() {},
      dispose() {},
    };
  };
  E.fallbackActor = function (type, elite) {
    const cols = { voleur: "#3a3a44", sprinteur: "#e0a13a", demenageur: "#7a5a3a", fumigene: "#555c66", nageur: "#f07aa8", boss: "#8b1f1f" };
    const g = new THREE.Group();
    const s = type === "boss" ? 1.5 : type === "demenageur" ? 1.2 : 1;
    const body = new THREE.Mesh(new THREE.CapsuleGeometry ? new THREE.CapsuleGeometry(0.28 * s, 0.7 * s, 4, 8) : new THREE.CylinderGeometry(0.28 * s, 0.3 * s, 1.1 * s, 8), PTMT.solid(cols[type] || "#444"));
    body.position.y = 0.75 * s;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22 * s, 10, 8), PTMT.solid("#f0c9a0"));
    head.position.y = 1.45 * s;
    const sack = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), PTMT.glow("#f2b93b", 0.5));
    sack.position.set(0, 1.1 * s, -0.35);
    sack.visible = false;
    if (elite) {
      const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.2, 10), PTMT.solid("#c9c9c9"));
      hat.position.y = 1.66 * s;
      g.add(hat);
    }
    for (const o of [body, head, sack]) o.castShadow = true;
    g.add(body, head, sack);
    let t = 0;
    return {
      object: g,
      height: 1.8 * s,
      update(dt, time, st) {
        t += dt * (st.moving ? 8 : 2);
        body.position.y = 0.75 * s + (st.moving ? Math.abs(Math.sin(t)) * 0.08 : 0);
        sack.visible = !!st.carrying;
        body.material = st.frozen ? PTMT.solid("#bfefff") : PTMT.solid(cols[type] || "#444");
        g.visible = true;
      },
      event() {},
      release() {
        g.parent && g.parent.remove(g);
      },
    };
  };
  E.fallbackChest = function (tier) {
    const g = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.8, 0.9), PTMT.solid(tier === 3 ? "#8a2f2f" : tier === 2 ? "#6b4a2a" : "#8a5a2b"));
    box.position.y = 0.4;
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.34, 0.25, 0.94), PTMT.solid("#6b3f19"));
    lid.position.y = 0.92;
    const gold = [];
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), PTMT.glow("#f2b93b", 0.4));
      s.position.set(-0.55 + i * 0.55, 0.26, 0.75);
      gold.push(s);
      g.add(s);
    }
    for (const o of [box, lid]) o.castShadow = true;
    g.add(box, lid);
    return {
      object: g,
      setStock(n) {
        gold.forEach((s, i) => (s.visible = i < n));
      },
      setOpenProgress(p) {
        lid.rotation.x = -p * 1.1;
      },
      alarm() {},
      update() {},
      setSelected() {},
      dispose() {},
    };
  };
  E.fallbackTrap = function (kind, tier) {
    const g = new THREE.Group();
    const col = { net: "#c9b27a", spring: "#9aa4ad", lure: "#e8c14a" }[kind];
    const m = new THREE.Mesh(kind === "lure" ? new THREE.BoxGeometry(0.8, 0.5, 0.6) : new THREE.CylinderGeometry(0.5 + tier * 0.1, 0.6 + tier * 0.1, 0.18, 12), PTMT.solid(col));
    m.position.y = kind === "lure" ? 0.25 : 0.09;
    m.castShadow = true;
    g.add(m);
    return { object: g, update() {}, trigger() {}, setReady(r) { m.material = r ? PTMT.solid(col) : PTMT.solid("#6b665d"); }, setSelected() {}, setDirection(y) { g.rotation.y = y; }, dispose() {} };
  };

  E.makeTower = function (tw) {
    let v = null;
    if (PTMT.models.tower) {
      try {
        v = PTMT.models.tower(tw.family, tw.tier, tw.tier === 1 ? null : tw.branch);
      } catch (e) {
        console.warn("Tour", e);
      }
    }
    return v || this.fallbackTower(tw.family, tw.tier, tw.branch);
  };
  E.makeTrap = function (tr) {
    let v = null;
    if (PTMT.models.trap) {
      try {
        v = PTMT.models.trap(tr.kind, tr.tier);
      } catch (e) {
        console.warn("Piège", e);
      }
    }
    return v || this.fallbackTrap(tr.kind, tr.tier);
  };
  E.makeChest = function (tier) {
    let v = null;
    if (PTMT.models.chest) {
      try {
        v = PTMT.models.chest(tier);
      } catch (e) {
        console.warn("Coffre", e);
      }
    }
    return v || this.fallbackChest(tier);
  };
  E.makeActor = function (type, elite) {
    if (PTMT.actors && PTMT.actors.ready && PTMT.actors.create) {
      try {
        return PTMT.actors.create(type, elite);
      } catch (e) {
        console.warn("Ennemi", e);
      }
    }
    return this.fallbackActor(type, elite);
  };

  // ── Remise à zéro (nouvelle partie / nouvelle disposition) ─────────────────────────
  E.reset = function (game) {
    this.game = game;
    for (const [, v] of this.towers) this.removeView(v);
    for (const [, v] of this.traps) this.removeView(v);
    for (const [, v] of this.chests) this.removeView(v);
    for (const [, v] of this.enemies) this.releaseActor(v);
    for (const [, v] of this.projectiles) v.release && v.release();
    for (const [, v] of this.areas) v.release && v.release();
    for (const [, v] of this.sacks) v.release && v.release();
    this.towers.clear();
    this.traps.clear();
    this.chests.clear();
    this.enemies.clear();
    this.projectiles.clear();
    this.areas.clear();
    this.sacks.clear();
    for (const t of this.transients) t.release && t.release();
    this.transients = [];
    this.showRoutes(null);
    this.showRange(0, 0, 0);
    this.showSelection(null);
    // Coffres des réserves.
    for (const r of game.state.reserves) {
      const v = this.makeChest(r.tier);
      v.tier = r.tier;
      this.placeChest(v, r);
      this.chests.set(r.id, v);
    }
  };
  E.placeChest = function (v, r) {
    const p = this.pos(r.x, r.z, 0.02);
    v.object.position.copy(p);
    const door = r.door;
    v.object.rotation.y = Math.atan2(door[0] - r.x, door[1] - r.z) + Math.PI;
    this.root.add(v.object);
  };
  E.removeView = function (v) {
    if (!v) return;
    if (v.object && v.object.parent) v.object.parent.remove(v.object);
    v.dispose && v.dispose();
  };
  E.releaseActor = function (v) {
    if (!v) return;
    if (v.release) v.release();
    if (v.object && v.object.parent) v.object.parent.remove(v.object);
  };

  // ── Synchronisation, chaque image ─────────────────────────────────────────────
  E.sync = function (dt, time, camera) {
    const game = this.game;
    if (!game) return;
    const s = game.state;
    // Tours.
    const seen = new Set();
    for (const tw of s.towers) {
      seen.add(tw.id);
      let v = this.towers.get(tw.id);
      const key = tw.family + tw.tier + (tw.branch || "");
      if (!v || v.key !== key) {
        const old = v;
        v = this.makeTower(tw);
        v.key = key;
        v.object.position.copy(this.pos(tw.x, tw.z, 0.02));
        v.object.userData.tower = tw.id;
        this.root.add(v.object);
        this.towers.set(tw.id, v);
        if (old) {
          this.removeView(old);
          v.trigger && v.trigger("upgrade");
          this.burst("sparkle", tw.x, tw.z, { color: FAMILY_COLOR[tw.family] });
        } else this.burst("smoke", tw.x, tw.z, {});
      }
      v.aim && v.aim(tw.yaw);
      if (tw.cd > 0 && tw.cd < 0.32 && !v.wound && time - (v.lastFire || -9) < 4) {
        v.wound = true;
        v.trigger && v.trigger("windup");
      }
      v.setFrenzy && v.setFrenzy(tw.frenzyT > 0);
      v.update && v.update(dt, time);
    }
    for (const [id, v] of this.towers) if (!seen.has(id)) (this.removeView(v), this.towers.delete(id));
    // Pièges.
    seen.clear();
    for (const tr of s.traps) {
      seen.add(tr.id);
      let v = this.traps.get(tr.id);
      const key = tr.kind + tr.tier;
      if (!v || v.key !== key) {
        if (v) this.removeView(v);
        v = this.makeTrap(tr);
        v.key = key;
        v.object.position.copy(this.pos(tr.x, tr.z, 0.03));
        const slot = game.trapSlot(tr.slot);
        v.object.rotation.y = Math.atan2(slot.dx, slot.dz);
        this.root.add(v.object);
        this.traps.set(tr.id, v);
      }
      if (tr.kind === "spring" && v.setDirection) {
        const slot = game.trapSlot(tr.slot);
        v.setDirection(Math.atan2(slot.dx * tr.dir, slot.dz * tr.dir) - v.object.rotation.y);
      }
      v.setReady && v.setReady(tr.cd <= 0);
      v.update && v.update(dt, time);
    }
    for (const [id, v] of this.traps) if (!seen.has(id)) (this.removeView(v), this.traps.delete(id));
    this.syncMill(s, dt, time);
    // Coffres : stock, ouverture, alarme, palier.
    for (const r of s.reserves) {
      let v = this.chests.get(r.id);
      if (v.tier !== r.tier) {
        this.removeView(v);
        v = this.makeChest(r.tier);
        v.tier = r.tier;
        this.placeChest(v, r);
        this.chests.set(r.id, v);
        this.burst("sparkle", r.x, r.z, { color: "#ffe07a" });
      }
      const total = game.L.reserves.find((x) => x.id === r.id).treasures;
      v.setStock && v.setStock(r.stock.length, total);
      let open = 0;
      for (const e of s.enemies) if (e.state === "steal" && e.stealRes === r.id) open = Math.max(open, 1 - e.stealT / (e.stealTotal || 1));
      v.setOpenProgress && v.setOpenProgress(open);
      v.alarm && v.alarm(open > 0 && r.tier >= 3);
      v.update && v.update(dt, time);
    }
    // Ennemis.
    seen.clear();
    let hb = 0;
    const focus = [];
    for (const e of s.enemies) {
      seen.add(e.id);
      let v = this.enemies.get(e.id);
      if (!v) {
        v = this.makeActor(e.type, e.elite);
        v.dx = e.x;
        v.dz = e.z;
        this.root.add(v.object);
        this.enemies.set(e.id, v);
      }
      // Position lissée (les projections deviennent des glissades).
      const k = Math.min(1, dt * 14);
      v.dx += (e.x - v.dx) * k;
      v.dz += (e.z - v.dz) * k;
      const kind = game.segKind(e);
      let y = this.world.heightU(v.dx, v.dz);
      if (kind === "bridge") y = Math.max(y, 1.1);
      if (e.onWater) y = -0.35;
      v.object.position.copy(this.world.toWorld(v.dx, v.dz, y));
      const yaw = Math.atan2(e.dx, e.dz);
      const cur = v.object.rotation.y;
      let d = ((yaw - cur + Math.PI) % (Math.PI * 2)) - Math.PI;
      if (d < -Math.PI) d += Math.PI * 2;
      v.object.rotation.y = cur + d * Math.min(1, dt * 10);
      v.update &&
        v.update(dt, time, {
          moving: e.moving,
          speed: game.currentSpeed(e) * U,
          carrying: !!e.carrying,
          inWater: e.onWater,
          frozen: e.freezeT > 0,
          burning: !!e.burn,
          wet: e.wetT > 0,
          netted: e.netT > 0,
          lured: !!e.lure,
          untargetable: e.untargetT > 0,
          overheated: e.overheatT > 0,
          boosted: e.boostT > 0 || e.rageT > 0,
          hitFlash: Math.max(0, e.hitT / 0.18),
          tenacity: 1 - e.tenacity,
          hpFrac: e.hp / e.maxHp,
          stealing: e.state === "steal",
        });
      if (hb < this.hbMax) {
        const h = (v.height || 1.9) + 0.45;
        this.hbCenter.setXYZ(hb, v.object.position.x, v.object.position.y + h, v.object.position.z);
        this.hbData.setXYZW(hb, Math.max(0, e.hp / e.maxHp), e.carrying ? 1 : 0, e.freezeT > 0 ? 1 : 0, e.klass === "boss" ? 1 : e.klass === "heavy" ? 0.4 : 0);
        hb++;
      }
      if (e.carrying && focus.length < 6) focus.push({ x: v.object.position.x, y: v.object.position.y + 1, z: v.object.position.z, r: 3.4 });
    }
    for (const [id, v] of this.enemies) if (!seen.has(id)) (this.releaseActor(v), this.enemies.delete(id));
    this.hb.geometry.instanceCount = hb;
    this.hbCenter.needsUpdate = true;
    this.hbData.needsUpdate = true;
    // Sacs tombés.
    seen.clear();
    for (const t of s.treasures) {
      if (t.state !== "dropped") continue;
      seen.add(t.id);
      let v = this.sacks.get(t.id);
      if (!v) {
        v = this.makeSack();
        this.sacks.set(t.id, v);
      }
      const y = t.floating ? 0.05 : this.world.heightU(t.x, t.z) + 0.05;
      v.set(this.world.toWorld(t.x, t.z, y), t.floating ? "floating" : "dropped", time);
      if (focus.length < 8) focus.push({ x: this.world.toWorld(t.x, t.z).x, y: y + 0.5, z: this.world.toWorld(t.x, t.z).z, r: 3 });
    }
    for (const [id, v] of this.sacks) if (!seen.has(id)) (v.release(), this.sacks.delete(id));
    this.world.setFocus(focus);
    // Projectiles.
    seen.clear();
    for (const p of s.projectiles) {
      seen.add(p.id);
      let v = this.projectiles.get(p.id);
      if (!v) {
        v = this.makeProjectile(p.kind);
        v.y0 = p.kind === "lavaShell" ? 3.2 : 2.2;
        this.projectiles.set(p.id, v);
      }
      const ground = this.world.heightU(p.x, p.z);
      const dist = Math.hypot(p.tx - p.fx, p.tz - p.fz) * U;
      let y = ground + 1.3;
      if (p.kind === "lavaShell") y = ground + 1.2 + (p.arc || 0) * Math.max(4, dist * 0.45);
      const w = this.world.toWorld(p.x, p.z, y);
      const dir = this.tmp.set(p.tx - p.x, 0, p.tz - p.z).normalize();
      v.set(w, dir);
    }
    for (const [id, v] of this.projectiles) if (!seen.has(id)) (v.release(), this.projectiles.delete(id));
    // Zones.
    seen.clear();
    for (const a of s.areas) {
      seen.add(a.id);
      let v = this.areas.get(a.id);
      const kind = a.kind === "storm" ? (a.big ? "polarStorm" : "blizzard") : a.kind === "vortex" ? (a.big ? "maelstrom" : "vortex") : "groundFire";
      const p = this.pos(a.x, a.z, 0.05);
      if (!v) {
        v = this.makeArea(kind, p, a.r * U);
        this.areas.set(a.id, v);
      }
      v.update(p, a.r * U, 1 - a.t / a.dur);
    }
    for (const [id, v] of this.areas) if (!seen.has(id)) (v.release(), this.areas.delete(id));
    // Effets passagers (cônes…).
    this.transients = this.transients.filter((t) => {
      t.age += dt;
      if (t.update) t.update(t.age / t.life);
      if (t.age >= t.life) {
        t.release && t.release();
        return false;
      }
      return true;
    });
    this.routeMat.uniforms.uTime.value = time;
  };

  /** Évolutions visibles du moulin : meule, roue magique, atelier. */
  E.syncMill = function (s, dt, time) {
    const anchors = this.world.millAnchors;
    if (!anchors || !PTMT.models.millUpgrade) return;
    this.millViews = this.millViews || {};
    for (const kind of ["meule", "roue", "atelier"]) {
      const lv = s.mill[kind];
      let v = this.millViews[kind];
      if (!v || v.level !== lv || v.world !== this.world.millObject) {
        if (v) this.removeView(v);
        try {
          v = PTMT.models.millUpgrade(kind, lv);
        } catch (e) {
          v = null;
        }
        if (!v) continue;
        v.level = lv;
        v.world = this.world.millObject;
        if (kind === "roue") {
          const wheel = this.world.millObject && (this.world.millObject.getObjectByName("Rotor_mobile_du_moulin") || this.world.millObject.getObjectByName("Roue_a_aubes_contre_le_moulin"));
          if (wheel) wheel.add(v.object);
          else {
            v.object.position.copy(anchors.wheel);
            v.object.rotation.y = anchors.yaw;
            this.root.add(v.object);
          }
        } else {
          v.object.position.copy(anchors[kind]);
          v.object.rotation.y = anchors.yaw + (kind === "atelier" ? Math.PI : 0);
          this.root.add(v.object);
        }
        if (lv > 0 && v.object.parent) this.burst("sparkle", ...this.world.fromWorld(v.object.getWorldPosition(new THREE.Vector3())), { color: "#ffe07a" });
        this.millViews[kind] = v;
      }
      v.update && v.update(dt, time);
    }
  };

  // ── Effets (avec secours) ─────────────────────────────────────────────────────
  E.makeProjectile = function (kind) {
    if (this.fxReady) {
      try {
        return PTMT.fx.projectile(kind);
      } catch (e) {}
    }
    const col = { fireball: "#ff7a2c", lavaShell: "#ff4a1c", iceShard: "#bff4ff", iceSpike: "#9fe8ff", waterJet: "#4fa8ff", waterBlast: "#4fa8ff", meteor: "#ff6a1c" }[kind] || "#fff";
    const m = new THREE.Mesh(new THREE.SphereGeometry(kind === "lavaShell" ? 0.4 : 0.26, 10, 8), PTMT.glow(col, 1.4));
    this.root.add(m);
    return {
      set(p) {
        m.position.copy(p);
      },
      release: () => this.root.remove(m),
    };
  };
  E.makeArea = function (kind, p, r) {
    if (this.fxReady) {
      try {
        return PTMT.fx.area(kind, p, r);
      } catch (e) {}
    }
    const col = { groundFire: "#ff6a2c", blizzard: "#cff6ff", polarStorm: "#aee8ff", vortex: "#3f9ae0", maelstrom: "#2f7fd0", frenzy: "#c9a8ff" }[kind] || "#fff";
    const m = new THREE.Mesh(new THREE.CircleGeometry(1, 32), new THREE.MeshBasicMaterial({ color: PTMT.color(col), transparent: true, opacity: 0.35, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    this.root.add(m);
    return {
      update(pos, rad, t) {
        m.position.copy(pos);
        m.position.y += 0.1;
        m.scale.setScalar(rad);
        m.material.opacity = 0.35 * (1 - t * 0.6);
      },
      release: () => this.root.remove(m),
    };
  };
  E.makeSack = function () {
    if (this.fxReady && PTMT.fx.sack) {
      try {
        const s = PTMT.fx.sack();
        return { set: (p, st) => s.set(p, st), release: () => s.release() };
      } catch (e) {}
    }
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), PTMT.glow("#f2b93b", 0.8));
    this.root.add(m);
    return {
      set(p, st, t) {
        m.position.copy(p);
        m.position.y += 0.4 + (st === "floating" ? Math.sin(t * 2) * 0.08 : 0);
      },
      release: () => this.root.remove(m),
    };
  };
  E.burst = function (kind, x, z, opts = {}) {
    if (!this.fxReady || !PTMT.fx.burst) return;
    const p = this.pos(x, z, opts.lift ?? 0.4);
    try {
      PTMT.fx.burst(kind, p, opts);
    } catch (e) {}
  };
  E.cone = function (kind, x, z, yaw, angle, range, mouths) {
    if (!this.fxReady || !PTMT.fx.cone) return;
    const origin = this.pos(x, z, 2.2);
    try {
      const handles = [];
      const n = mouths || 1;
      for (let i = 0; i < n; i++) {
        const y = yaw + (n > 1 ? (i ? 0.16 : -0.16) : 0);
        handles.push({ h: PTMT.fx.cone(kind, origin, y, (angle * Math.PI) / 180, range * U), y });
      }
      this.transients.push({
        age: 0,
        life: 0.45,
        update: (k) => handles.forEach((o) => o.h.update(origin, o.y, k)),
        release: () => handles.forEach((o) => o.h.release()),
      });
    } catch (e) {}
  };

  /** Réactions visuelles aux événements du jeu. */
  E.onEvent = function (ev, time, ui) {
    const game = this.game;
    const find = (id) => game.state.enemies.find((e) => e.id === id);
    const actor = (id) => this.enemies.get(id);
    switch (ev.type) {
      case "fire": {
        const v = this.towers.get(ev.tower);
        if (v) {
          v.trigger && v.trigger("fire");
          v.lastFire = time;
          v.wound = false;
        }
        break;
      }
      case "cone":
        this.cone(ev.kind, ev.x, ev.z, ev.yaw, ev.angle, ev.range, ev.mouths);
        break;
      case "blast":
        this.burst("waterWave", ev.x + Math.sin(ev.yaw) * ev.range * 0.5, ev.z + Math.cos(ev.yaw) * ev.range * 0.5, { length: ev.range * U, width: 1.2 * U, yaw: ev.yaw });
        break;
      case "explode": {
        const map = { fire: "explosion", lava: "lavaSplash", meteor: "meteorImpact", ice: "iceShatter", iceBig: "iceShatter", splash: "splash", vortexSplash: "splash", freeze: "freezeFlash", flood: "waterWave", frenzy: "sparkle" };
        this.burst(map[ev.kind] || "hit", ev.x, ev.z, { radius: (ev.r || 1) * U, length: (ev.length || 0) * U, width: (ev.width || 0) * U, yaw: ev.yaw, color: ev.kind === "frenzy" ? "#c9a8ff" : undefined });
        break;
      }
      case "spell": {
        if (ev.id === "meteor" && this.fxReady) {
          // Le météore tombe du ciel pendant l'anticipation.
          const target = this.pos(ev.x, ev.z, 0.2);
          let tel = null,
            proj = null;
          try {
            tel = PTMT.fx.telegraph && PTMT.fx.telegraph("meteor", target, ev.stats.radius * U);
            proj = PTMT.fx.projectile("meteor");
          } catch (e) {}
          const from = target.clone().add(new THREE.Vector3(-14, 26, -8));
          this.transients.push({
            age: 0,
            life: ev.delay,
            update: (k) => {
              if (proj) proj.set(from.clone().lerp(target, k), target.clone().sub(from).normalize());
              if (tel && tel.update) tel.update(target, ev.stats.radius * U, k);
            },
            release: () => {
              proj && proj.release();
              tel && tel.release();
            },
          });
        } else if (this.fxReady && PTMT.fx.telegraph) {
          try {
            const target = this.pos(ev.x, ev.z, 0.2);
            const shape = ev.id === "flood" ? { length: ev.stats.length * U, width: ev.stats.width * U, yaw: ev.yaw } : (ev.stats.radius || 1) * U;
            const tel = PTMT.fx.telegraph(ev.id, target, shape);
            this.transients.push({ age: 0, life: Math.max(0.3, ev.delay), update: (k) => tel.update && tel.update(target, shape, k), release: () => tel.release() });
          } catch (e) {}
        }
        break;
      }
      case "ko": {
        const v = actor(ev.id);
        if (v) {
          v.event && v.event("ko");
          this.burst("ko", ev.x, ev.z, {});
          this.burst("coins", ev.x, ev.z, { amount: Math.min(8, 2 + Math.round(ev.bounty / 6)) });
        }
        if (ui) ui.floatAt(ev.x, ev.z, "+" + ev.bounty, "gold");
        break;
      }
      case "hit":
        break;
      case "knockback":
      case "pull":
      case "helmetOff":
      case "smoke":
      case "overheat":
      case "rage":
      case "fooled": {
        const v = actor(ev.id);
        const map = { knockback: "knockback", pull: "pull", helmetOff: "helmetOff", smoke: "smokePuff", overheat: "overheat", rage: "rage", fooled: "fooled" };
        if (v && v.event) v.event(map[ev.type]);
        if (ev.type === "smoke") {
          const e = find(ev.id);
          if (e) this.burst("smoke", e.x, e.z, {});
        }
        break;
      }
      case "freeze": {
        const e = find(ev.id);
        if (e) this.burst("freezeFlash", e.x, e.z, { radius: 0.8 * U });
        break;
      }
      case "net":
      case "lured":
        break;
      case "steal": {
        const v = actor(ev.id);
        v && v.event && v.event("steal");
        const r = game.reserve(ev.reserve);
        this.burst("sparkle", r.x, r.z, { color: "#ffe07a" });
        if (ui) ui.onSteal(ev);
        break;
      }
      case "drop": {
        const e = game.state.treasures.find((t) => t.id === ev.treasure);
        if (e) this.burst(ev.floating ? "splash" : "sackPop", e.x, e.z, {});
        break;
      }
      case "treasureHome": {
        const r = game.reserve(ev.reserve);
        this.burst("recall", r.x, r.z, { to: this.pos(r.x, r.z, 0.6) });
        break;
      }
      case "trap": {
        const v = this.traps.get(ev.id);
        v && v.trigger && v.trigger("fire");
        const tr = game.state.traps.find((t) => t.id === ev.id);
        if (tr) this.burst(tr.kind === "net" ? "netThrow" : tr.kind === "spring" ? "springBoing" : "sparkle", tr.x, tr.z, { color: "#ffd36b" });
        break;
      }
      case "lost":
        if (ui) ui.onLost(ev);
        break;
      case "splash":
        break;
    }
  };

  PTMT.Entities = Entities;
})();
