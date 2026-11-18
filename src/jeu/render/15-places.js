// « Pas touche à mes trésors » — les lieux de la carte (PTMT.view, partie « lieux »).
//
// Complète le monde de render/10-map.js (méthodes de VIEW._map.World) avec ce qui donne son sens à
// une mission :
//  - les cachettes (une par bloc 2 × 2 de cases L, state.map.lairs) : PTMT.models.lair(total,
//    { style, mill }) au centre du bloc, au niveau du chemin ; la cachette principale tourne le dos
//    (−Z local) au moulin, les autres tournent le dos à la caméra (aucun décor devant les gemmes) ;
//    secours : cratère sombre cerclé de pierres, coupelles des gemmes, décor du style ;
//  - le moulin sur ses six cases X (PTMT.models.mill, façade vers la cachette principale quand elle
//    est le long d'un grand côté, sinon vers la caméra) ; secours : maison de granit et roue ;
//  - les buttes H / h (PTMT.models.highGround posé au niveau de la route : socle de granit et
//    fanions ; la tour se pose sur son dessus) ; secours : relief du terrain et petit fanion ;
//  - les entrées : poteau de bois au bord de chaque entrée (la bannière lettrée et les flèches au sol
//    sont des sprites dessinés par la vue, render/25-routes.js) et barrières g (PTMT.models.barrier,
//    open() quand elles cèdent ; secours : palissade et ronces qui basculent).
//
//   MK.mapPlaces(map) → { lairs: [{ id, tiles, x, y, style, mill, total, name }],
//                         entrances: [{ id, letter, color, tiles, x, y, dir, open, opensAt }] }
//     (mêmes numéros, lettres et couleurs que la simulation : PTMT.sim.Grid si elle est chargée)
//   world.lairSlot(lairId, slot, out) ; world.setLairSlots(lairId, [bool…]) ;
//   world.setLairAlarm(lairId, on) ; world.openGate(entranceId, animate) ; world.orientPlaces(az)
(function () {
  "use strict";
  const PTMT = (globalThis.PTMT = globalThis.PTMT || {});
  if (typeof THREE === "undefined") return;
  const VIEW = (PTMT.view = PTMT.view || {});
  const MK = (VIEW._map = VIEW._map || {});
  if (!MK.World) return;
  const W = MK.World.prototype;
  const { TILE, MW, MH, HIGH_Y } = MK.K;
  const toX = (x) => (x - MW / 2) * TILE, toZ = (y) => (y - MH / 2) * TILE;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lin = (hex) => (PTMT.color ? PTMT.color(hex) : new THREE.Color(hex).convertSRGBToLinear());
  const TAU = Math.PI * 2;
  const _v = new THREE.Vector3(), _m4 = new THREE.Matrix4();

  /* ------------------------------------------------------------------ cachettes et entrées de la carte */
  const ENTRANCE_META = [
    { letter: "A", color: "#ff8a3d" },
    { letter: "B", color: "#a06bff" },
    { letter: "C", color: "#2fc4d8" },
    { letter: "D", color: "#ff5d8f" },
    { letter: "E", color: "#9bd14a" },
  ];
  const LAIR_NAMES = { moulin: "Le moulin", puits: "Le vieux puits", dolmen: "Le dolmen", chapelle: "La chapelle" };
  /** Composantes 4-connexes, dans l'ordre de la simulation (balayage ligne à ligne, cases triées). */
  function components(rows, test) {
    const seen = new Uint8Array(MW * MH), out = [];
    for (let j = 0; j < MH; j++)
      for (let i = 0; i < MW; i++) {
        if (seen[j * MW + i] || !test(rows[j][i])) continue;
        const tiles = [], q = [[i, j]];
        seen[j * MW + i] = 1;
        while (q.length) {
          const [a, b] = q.pop();
          tiles.push([a, b]);
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const x = a + dx, y = b + dy;
            if (x < 0 || y < 0 || x >= MW || y >= MH || seen[y * MW + x] || !test(rows[y][x])) continue;
            seen[y * MW + x] = 1;
            q.push([x, y]);
          }
        }
        tiles.sort((p, r) => p[1] - r[1] || p[0] - r[0]);
        out.push(tiles);
      }
    return out;
  }
  MK.mapPlaces = function (map) {
    const S = PTMT.sim;
    if (S && S.Grid && S.DATA) {
      try {
        const g = new S.Grid(map);
        return {
          lairs: g.lairs.map((L) => ({ id: L.id, tiles: L.tiles.map((t) => t.slice()), x: L.x, y: L.y, style: L.style, mill: !!L.mill, total: L.gems, name: L.name })),
          entrances: g.entrances.map((e) => ({ id: e.id, letter: e.letter, color: e.color, tiles: e.tiles.map((t) => t.slice()), x: e.x, y: e.y, dir: e.dir, open: e.open, opensAt: e.opensAt })),
        };
      } catch (e) {
        /* carte d'essai incomplète : calcul local ci-dessous */
      }
    }
    const rows = map.grid.map((r) => r.split(""));
    const gates = map.gates || [];
    const center = (tiles) => [tiles.reduce((a, t) => a + t[0] + 0.5, 0) / tiles.length, tiles.reduce((a, t) => a + t[1] + 0.5, 0) / tiles.length];
    const entrances = components(rows, (c) => c === "E" || c === "g").map((tiles, id) => {
      const closed = tiles.some(([i, j]) => rows[j][i] === "g");
      const gate = closed ? gates.find((g) => tiles.some(([i, j]) => i === g.at[0] && j === g.at[1])) : null;
      const [x, y] = center(tiles);
      const [i0, j0] = tiles[0];
      const dir = i0 === 0 ? Math.PI / 2 : i0 === MW - 1 ? -Math.PI / 2 : j0 === 0 ? 0 : Math.PI;
      const meta = ENTRANCE_META[id % ENTRANCE_META.length];
      return { id, letter: meta.letter, color: meta.color, tiles, x, y, dir, open: !closed, opensAt: closed ? (gate ? gate.wave : 1e9) : 0 };
    });
    const comps = components(rows, (c) => c === "L");
    const defs = map.lairs && map.lairs.length && map.lairs[0].at ? map.lairs : comps.map((t, k) => ({ at: t[0], gems: k ? 2 : map.gems || 5, style: k ? "puits" : "moulin" }));
    const lairs = [];
    defs.forEach((def, id) => {
      const tiles = comps.find((c) => c.some(([i, j]) => i === def.at[0] && j === def.at[1]));
      if (!tiles) return;
      const [x, y] = center(tiles);
      const style = def.style || (id === 0 ? "moulin" : "puits");
      lairs.push({ id, tiles, x, y, style, mill: style === "moulin", total: def.gems || 1, name: def.name || LAIR_NAMES[style] || "La cachette" });
    });
    return { lairs, entrances };
  };

  /* ------------------------------------------------------------------ outils */
  const T4 = (...a) => MK.T4(...a);
  function merged(parts, name) {
    return MK.buildMerged(parts, name);
  }
  const tryModel = (name, ...args) => MK.tryModel(name, ...args);
  const objOf = (r) => MK.objOf(r);
  /** Disposition des logements (comme la cachette du Décor) : rayon et positions [x, z]. */
  function slotLayout(n) {
    const ring = (r, a0) => {
      const out = [];
      for (let i = 0; i < n; i++) {
        const a = a0 + (i / n) * TAU;
        out.push([Math.cos(a) * r, Math.sin(a) * r]);
      }
      return out;
    };
    if (n <= 1) return { r: 0, pts: [[0, 0]] };
    if (n === 2) return { r: 1.0, pts: [[-1.0, 0], [1.0, 0]] };
    if (n === 3) return { r: 1.1, pts: ring(1.1, -Math.PI / 2) };
    if (n === 4) return { r: 1.3, pts: ring(1.3, Math.PI / 4) };
    if (n === 5) return { r: 1.45, pts: ring(1.45, -Math.PI / 2) };
    if (n === 6) return { r: 1.7, pts: ring(1.7, 0) };
    return { r: 2.0, pts: ring(2.0, -Math.PI / 2) };
  }

  /* ------------------------------------------------------------------ cachette de secours */
  // Cratère sombre de 2 × 2 cases (fond noir bleuté, paroi de terre, crête moussue) cerclé de blocs
  // de granit (quatre passages), coupelles claires des gemmes en couronne, décor du style derrière
  // le trou (−Z) ; alarme : anneau rouge pulsé. Deux appels de dessin.
  function FallbackLair(total, style) {
    const n = clamp(total | 0 || 3, 1, 9);
    const lay = slotLayout(n);
    const Rf = Math.max(1.5, lay.r + 0.95);
    const g = new THREE.Group();
    g.name = "Cachette (secours) " + style;
    const parts = [];
    // cuvette : profil tourné, couleurs par anneau
    const prof = [
      [0, 0.03, "#0b1220"], [Rf * 0.6, 0.03, "#121c30"], [Rf, 0.05, "#1d2638"], [Rf + 0.18, 0.2, "#3a2c20"],
      [Rf + 0.42, 0.4, "#5a4430"], [Rf + 0.62, 0.46, "#5f8a34"], [Rf + 0.9, 0.3, "#6a9a3a"], [Rf + 1.15, 0.0, "#7a6a48"],
    ];
    const seg = 48, pos = [], col = [], idx = [];
    const rng = PTMT.rng(1700 + n * 13 + style.length);
    for (let r = 0; r < prof.length; r++) {
      const c = lin(prof[r][2]);
      for (let k = 0; k < seg; k++) {
        const a = (k / seg) * TAU;
        const wob = r < 2 ? 0 : Math.sin(a * 3 + 1.3) * 0.08 + Math.sin(a * 7 + 0.4) * 0.05;
        pos.push(Math.cos(a) * (prof[r][0] + wob), prof[r][1], Math.sin(a) * (prof[r][0] + wob));
        const f = 0.9 + rng() * 0.2;
        col.push(c.r * f, c.g * f, c.b * f);
      }
    }
    for (let r = 0; r < prof.length - 1; r++)
      for (let k = 0; k < seg; k++) {
        const a = r * seg + k, b = r * seg + ((k + 1) % seg), c2 = (r + 1) * seg + k, d = (r + 1) * seg + ((k + 1) % seg);
        idx.push(a, c2, b, b, c2, d);
      }
    const bowl = new THREE.BufferGeometry();
    bowl.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    bowl.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    bowl.setIndex(idx);
    const bowlNI = bowl.toNonIndexed();
    bowlNI.computeVertexNormals();
    const list = [{ g: bowlNI, m: new THREE.Matrix4() }];
    // blocs de granit sur la crête (passages aux points cardinaux)
    const crest = Rf + 0.55, nb = Math.round((TAU * crest) / 0.95);
    for (let k = 0; k < nb; k++) {
      const a = (k / nb) * TAU + (rng() - 0.5) * 0.1;
      const gap = Math.min(...[0, Math.PI / 2, Math.PI, -Math.PI / 2, 1.5 * Math.PI].map((q) => Math.abs(((a - q + 3 * Math.PI) % TAU) - Math.PI)));
      if (gap < 0.2) continue;
      const st = new THREE.DodecahedronGeometry(0.5, 0);
      parts.push({ g: st, color: rng() < 0.5 ? "#8f897e" : "#a29b8e", m: T4(Math.cos(a) * crest, 0.42, Math.sin(a) * crest, rng() * 0.4, -a, rng() * 0.3, 0.75 + rng() * 0.3, 0.55 + rng() * 0.2, 0.6 + rng() * 0.2), shade: 0.35 });
    }
    // coupelles des gemmes (anneau clair, creux noir), un peu avancées vers la caméra
    const slots = [];
    for (const [x, z0] of lay.pts) {
      const z = z0 + (lay.r > 0 ? 0.3 : 0.15);
      slots.push(new THREE.Vector3(x, 0.11, z));
      parts.push({ g: new THREE.TorusGeometry(0.3, 0.085, 5, 14), color: "#d8d2c4", m: T4(x, 0.07, z, Math.PI / 2) });
      parts.push({ g: new THREE.CircleGeometry(0.24, 12), color: "#05070c", m: T4(x, 0.062, z, -Math.PI / 2) });
    }
    // décor du style (derrière le trou, −Z)
    const zb = -(Rf + 1.0);
    if (style === "puits") {
      parts.push({ g: new THREE.CylinderGeometry(0.62, 0.66, 0.8, 14, 1, true), color: "#9d968a", m: T4(-2.4, 0.4, zb + 0.4), shade: 0.3 });
      parts.push({ g: new THREE.CircleGeometry(0.58, 14), color: "#123044", m: T4(-2.4, 0.72, zb + 0.4, -Math.PI / 2) });
      for (const s of [-1, 1]) parts.push({ g: new THREE.BoxGeometry(0.16, 1.6, 0.16), color: "#5e4430", m: T4(-2.4 + s * 0.6, 0.8, zb + 0.4) });
      parts.push({ g: new THREE.ConeGeometry(0.95, 0.6, 4), color: "#4d586c", m: T4(-2.4, 1.85, zb + 0.4, 0, Math.PI / 4) });
    } else if (style === "dolmen") {
      for (const s of [-1, 1]) parts.push({ g: new THREE.BoxGeometry(0.7, 1.7, 0.75), color: "#aaa395", m: T4(s * 1.3, 0.85, zb + 0.35), shade: 0.3 });
      parts.push({ g: new THREE.BoxGeometry(3.4, 0.42, 1.0), color: "#b3ac9e", m: T4(0, 1.9, zb + 0.3, 0, 0.04), shade: 0.2 });
    } else if (style === "chapelle") {
      parts.push({ g: new THREE.BoxGeometry(1.2, 0.25, 1.2), color: "#8a8478", m: T4(2.4, 0.12, zb + 0.4) });
      parts.push({ g: new THREE.BoxGeometry(0.32, 2.2, 0.26), color: "#a39c90", m: T4(2.4, 1.3, zb + 0.4) });
      parts.push({ g: new THREE.BoxGeometry(1.2, 0.28, 0.24), color: "#a39c90", m: T4(2.4, 1.85, zb + 0.4) });
      parts.push({ g: new THREE.TorusGeometry(0.4, 0.07, 5, 16), color: "#b0a99c", m: T4(2.4, 1.85, zb + 0.42) });
    } else {
      // sacs de farine dans deux coins
      for (const [x, z, s] of [[-2.6, 2.4, 1], [-2.1, 2.9, 0.85], [2.7, zb + 0.6, 0.95]]) {
        parts.push({ g: new THREE.SphereGeometry(0.4, 10, 8), color: "#c8b48a", m: T4(x, 0.36 * s, z, 0, 0, 0, s, s * 1.1, s), shade: 0.3 });
        parts.push({ g: new THREE.CylinderGeometry(0.1 * s, 0.16 * s, 0.18 * s, 8), color: "#9a8a62", m: T4(x, 0.78 * s, z) });
      }
    }
    for (const p of parts) list.push({ g: MK.colorize(p.g, p.color, p.shade || 0), m: p.m || new THREE.Matrix4() });
    const geo = MK.mergeColored(list);
    geo.setAttribute("sway", new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count), 1));
    const body = new THREE.Mesh(geo, PTMT.mat("view:merged", () => new THREE.MeshLambertMaterial({ vertexColors: true })));
    body.receiveShadow = true;
    body.castShadow = true;
    body.name = "Cachette (secours)";
    g.add(body);
    // alarme : anneau rouge pulsé posé sur la crête
    const ring = new THREE.Mesh(new THREE.TorusGeometry(crest, 0.12, 6, 48), new THREE.MeshBasicMaterial({ color: lin("#ff2a1a"), transparent: true, opacity: 0, depthWrite: false }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.55;
    ring.visible = false;
    g.add(ring);
    let alarm = false, a = 0;
    return {
      object: g,
      fallback: true,
      style,
      maxGems: n,
      gemSlots: slots,
      radius: Rf,
      slotWorld(k, out) {
        out = out || new THREE.Vector3();
        g.updateWorldMatrix(true, false);
        return out.copy(slots[clamp(k | 0, 0, n - 1)]).applyMatrix4(g.matrixWorld);
      },
      setSlots() {},
      setGems() {},
      alarm(on) {
        alarm = !!on;
      },
      update(dt, time) {
        a += ((alarm ? 1 : 0) - a) * Math.min(1, dt * 6);
        ring.visible = a > 0.02;
        if (ring.visible) {
          ring.material.opacity = a * (0.45 + 0.4 * Math.abs(Math.sin(time * 6)));
          ring.scale.setScalar(1 + 0.04 * Math.sin(time * 6));
        }
      },
      dispose() {
        geo.dispose();
        ring.geometry.dispose();
        ring.material.dispose();
      },
    };
  }

  /** La cachette lairId peut-elle loger total gemmes ? Sinon (compétence « Filon de gemmes »), on la refait. */
  W.ensureLairCapacity = function (lairId, total) {
    const L = this.lairs && this.lairs[lairId];
    if (!L || total <= L.total) return;
    const old = L.model, o0 = objOf(old);
    const native = tryModel("lair", total, { style: L.style, mill: !!L.mill });
    const model = native || FallbackLair(total, L.style);
    const o = objOf(model);
    o.position.copy(o0.position);
    o.rotation.y = o0.rotation.y;
    o0.parent && o0.parent.remove(o0);
    try {
      if (old.dispose) old.dispose();
    } catch (e) {
      /* ancien modèle déjà libéré */
    }
    this.root.add(o);
    L.model = model;
    L.native = !!native;
    L.total = total;
    L.slotsKey = -1;
    if (L.alarm && model.alarm) model.alarm(true);
    this.batchDirty = true; // lots des pièces immobiles à refaire (render/18-batch.js)
  };
  W.buildLairs = function () {
    this.lairs = [];
    const mill = this.map.mill || [];
    let mx = null, my = null;
    if (mill.length) {
      mx = mill.reduce((a, p) => a + p[0] + 0.5, 0) / mill.length;
      my = mill.reduce((a, p) => a + p[1] + 0.5, 0) / mill.length;
    }
    this.staticShadowCasters = this.staticShadowCasters || [];
    for (const L of this.places.lairs) {
      const native = tryModel("lair", L.total, { style: L.style, mill: !!L.mill });
      const model = native || FallbackLair(L.total, L.style);
      const o = objOf(model);
      o.position.set(toX(L.x), 0, toZ(L.y));
      // cachette principale : le décor (−Z local) tourné vers le moulin, au quart de tour près
      let fixedYaw = null;
      if (L.mill && mx !== null) {
        const dx = mx - L.x, dy = my - L.y;
        fixedYaw = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? -Math.PI / 2 : Math.PI / 2) : dy > 0 ? Math.PI : 0;
      }
      o.rotation.y = fixedYaw === null ? 0 : fixedYaw;
      this.root.add(o);
      this.lairs.push({ id: L.id, x: L.x, y: L.y, total: L.total, style: L.style, mill: !!L.mill, model, native: !!native, fixedYaw, alarm: false, slotsKey: -1 });
      this.staticShadowCasters.push({ x: L.x, y: L.y - 0.6, r: 0.9, h: 0.6, a: 0.4 });
    }
  };
  /** Position monde du logement slot de la cachette lairId (où poser une gemme « lair »). */
  W.lairSlot = function (lairId, slot, out) {
    out = out || new THREE.Vector3();
    const L = this.lairs && this.lairs[lairId];
    if (!L) return out.set(0, 0.5, 0);
    const m = L.model;
    if (m.slotWorld) return m.slotWorld(slot | 0, out);
    const o = objOf(m);
    const s = m.gemSlots && m.gemSlots.length ? m.gemSlots[(slot | 0) % m.gemSlots.length] : null;
    if (!s) return out.set(toX(L.x), 0.4, toZ(L.y));
    o.updateMatrixWorld();
    return out.copy(s).applyMatrix4(o.matrixWorld);
  };
  /** Logements pleins d'une cachette (tableau de booléens) ; n'appelle le modèle qu'en cas de changement. */
  W.setLairSlots = function (lairId, list) {
    const L = this.lairs && this.lairs[lairId];
    if (!L) return;
    // masque des logements pleins (sans allocation par image)
    let key = list.length * 1024;
    for (let k = 0; k < list.length && k < 10; k++) if (list[k]) key += 1 << k;
    if (key === L.slotsKey) return;
    L.slotsKey = key;
    const m = L.model;
    if (m.setSlots) m.setSlots(list);
    else if (m.setGems) {
      let n = 0;
      for (const b of list) if (b) n++;
      m.setGems(n);
    }
  };
  W.setLairAlarm = function (lairId, on) {
    const L = this.lairs && this.lairs[lairId];
    if (!L || L.alarm === !!on) return;
    L.alarm = !!on;
    if (L.model.alarm) L.model.alarm(!!on);
    if (L.mill && this.millModel && this.millModel.alarm) this.millModel.alarm(!!on);
  };

  /* ------------------------------------------------------------------ moulin */
  function FallbackMill() {
    const g = new THREE.Group();
    g.name = "Moulin (secours)";
    const list = [];
    MK.houseParts(list, T4(-0.6, 0.45, -0.2, 0, 0, 0, 2.05, 2.05, 2.05));
    const body = new THREE.Mesh(MK.mergeColored(list), PTMT.mat("view:merged", () => new THREE.MeshLambertMaterial({ vertexColors: true })));
    body.geometry.setAttribute("sway", new THREE.BufferAttribute(new Float32Array(body.geometry.attributes.position.count), 1));
    body.castShadow = body.receiveShadow = true;
    g.add(body);
    const wp = [{ g: new THREE.TorusGeometry(1.45, 0.1, 6, 20), color: "#6b4a2e", m: T4(0, 0, 0, 0, Math.PI / 2, 0) }];
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * TAU;
      wp.push({ g: new THREE.BoxGeometry(0.5, 0.12, 0.62), color: "#8a6440", m: T4(0, Math.sin(a) * 1.3, Math.cos(a) * 1.3, -a) });
      wp.push({ g: new THREE.BoxGeometry(0.08, 0.08, 2.7), color: "#5a3c24", m: T4(0, 0, 0, a) });
    }
    wp.push({ g: new THREE.CylinderGeometry(0.22, 0.22, 0.7, 8), color: "#4a3220", m: T4(0, 0, 0, 0, 0, Math.PI / 2) });
    const wheel = merged(wp, "Roue");
    wheel.position.set(4.35, 1.75, -0.2);
    g.add(wheel);
    // lanterne d'alarme au-dessus de la porte
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), new THREE.MeshBasicMaterial({ color: lin("#ffcf6a") }));
    lamp.position.set(-0.6, 3.6, 2.35);
    g.add(lamp);
    let alarm = false;
    return {
      object: g,
      fallback: true,
      alarm(on) {
        alarm = !!on;
      },
      update(dt, time) {
        wheel.rotation.x -= dt * 0.8;
        lamp.material.color.copy(lin(alarm && Math.sin(time * 10) > 0 ? "#ff2a1a" : "#ffcf6a"));
      },
      dispose() {
        body.geometry.dispose();
      },
    };
  }
  W.buildMill = function () {
    const cells = this.map.mill || [];
    if (!cells.length) return;
    let cx = 0, cy = 0, i0 = 99, i1 = -1, j0 = 99, j1 = -1;
    for (const [i, j] of cells) {
      cx += i + 0.5;
      cy += j + 0.5;
      i0 = Math.min(i0, i);
      i1 = Math.max(i1, i);
      j0 = Math.min(j0, j);
      j1 = Math.max(j1, j);
    }
    cx /= cells.length;
    cy /= cells.length;
    const main = this.places.lairs.find((L) => L.mill) || this.places.lairs[0];
    const dx = main ? main.x - cx : 0, dy = main ? main.y - cy : 1;
    // façade (+Z local) vers la cachette si elle longe un grand côté, sinon vers la caméra
    let yaw;
    if (i1 - i0 >= j1 - j0) yaw = Math.abs(dy) > 0.6 ? (dy > 0 ? 0 : Math.PI) : 0;
    else yaw = Math.abs(dx) > 0.6 ? (dx > 0 ? Math.PI / 2 : -Math.PI / 2) : Math.PI / 2;
    const native = tryModel("mill");
    const model = native || FallbackMill();
    const o = objOf(model);
    o.position.set(toX(cx), 0, toZ(cy));
    o.rotation.y = yaw;
    this.root.add(o);
    this.millModel = model;
    this.millInfo = { x: cx, y: cy, yaw };
    this.staticShadowCasters = this.staticShadowCasters || [];
    this.staticShadowCasters.push({ x: cx, y: cy, r: 1.3, h: 5, a: 1.2 });
  };

  /* ------------------------------------------------------------------ buttes */
  W.buildButtes = function () {
    this.buttes = [];
    const f = this.field;
    this.staticShadowCasters = this.staticShadowCasters || [];
    const flags = [];
    let k = 0;
    for (let j = 0; j < MH; j++)
      for (let i = 0; i < MW; i++) {
        const ch = f.grid[j][i];
        if (ch !== "H" && ch !== "h") continue;
        if (this.nativeButte) {
          const m = tryModel("highGround", { seed: k++ });
          if (m) {
            // au niveau de la route au milieu d'un chemin, au niveau du plateau ailleurs (+1,3 m au-dessus)
            const base = Math.max(0, f.heightAt(i + 0.5, j + 0.5));
            const o = objOf(m);
            o.position.set(toX(i + 0.5), base, toZ(j + 0.5));
            this.root.add(o);
            this.buttes.push({ i, j, model: m });
            this.highTop.set(i + "," + j, base + (typeof m.height === "number" ? m.height : HIGH_Y));
            this.staticShadowCasters.push({ x: i + 0.5, y: j + 0.5, r: 0.7, h: 1.3, a: 0.8 });
            continue;
          }
        }
        // secours : le relief monte déjà ; un petit fanion tricolore au coin avant droit
        const top = f.heightAt(i + 0.5, j + 0.5);
        flags.push({ x: toX(i + 0.86), y: top, z: toZ(j + 0.84) });
      }
    if (flags.length) {
      const parts = [];
      for (const p of flags) {
        parts.push({ g: new THREE.CylinderGeometry(0.06, 0.07, 2.2, 6), color: "#4a3626", m: T4(p.x, p.y + 1.1, p.z) });
        const cols = ["#c99a5a", "#f4f1e6", "#e0552a"];
        cols.forEach((c, n) => {
          const sh = new THREE.Shape();
          sh.moveTo(0, 0);
          sh.lineTo(1.0, -0.16);
          sh.lineTo(0, -0.32);
          sh.closePath();
          parts.push({ g: new THREE.ShapeGeometry(sh), color: c, m: T4(p.x + 0.05, p.y + 2.15 - n * 0.3, p.z, 0, -0.5) });
        });
      }
      const mesh = merged(parts, "Fanions des buttes");
      mesh.material = PTMT.mat("view:merged2", () => new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
      this.root.add(mesh);
    }
  };

  /* ------------------------------------------------------------------ entrées, poteaux et barrières */
  // Barrière de secours : palissade de pieux et deux lisses, ronces côté extérieur ; open() la fait
  // basculer vers l'extérieur en s'enfonçant, avec copeaux, feuilles et poussière.
  function FallbackBarrier(width) {
    const w = Math.max(1, width | 0) * TILE * 0.96;
    const parts = [];
    const n = Math.max(4, Math.round(w / 0.55));
    for (let k = 0; k < n; k++) {
      const x = -w / 2 + (k + 0.5) * (w / n);
      const h = 1.5 + ((k * 7) % 3) * 0.12;
      parts.push({ g: new THREE.CylinderGeometry(0.11, 0.13, h, 6), color: k % 2 ? "#8a6440" : "#7a5634", m: T4(x, h / 2, 0, 0, 0, ((k % 3) - 1) * 0.05), shade: 0.35 });
      parts.push({ g: new THREE.ConeGeometry(0.13, 0.3, 6), color: "#a07a50", m: T4(x, h + 0.15, 0) });
    }
    for (const y of [0.5, 1.1]) parts.push({ g: new THREE.BoxGeometry(w, 0.14, 0.12), color: "#5e4028", m: T4(0, y, 0.12) });
    // planche « barré » en travers, rouge et blanc
    parts.push({ g: new THREE.BoxGeometry(w * 0.7, 0.32, 0.06), color: "#e8e2d2", m: T4(0, 0.85, 0.22, 0, 0, 0.18) });
    for (let k = 0; k < 4; k++) parts.push({ g: new THREE.BoxGeometry(w * 0.08, 0.33, 0.07), color: "#c8322a", m: T4(-w * 0.27 + k * w * 0.18, 0.85 + (-w * 0.27 + k * w * 0.18) * 0.18, 0.23, 0, 0, 0.18) });
    // ronces dehors
    for (let k = 0; k < Math.round(w / 0.9); k++) {
      const x = -w / 2 + (k + 0.5) * 0.9;
      parts.push({ g: new THREE.IcosahedronGeometry(0.5, 0), color: k % 2 ? "#3f6a2a" : "#4f7a30", m: T4(x, 0.4, -0.55, 0, k, 0, 1.1, 0.8, 1), shade: 0.3 });
    }
    const mesh = merged(parts, "Barrière (secours)");
    const g = new THREE.Group();
    g.add(mesh);
    let open = false, t = -1;
    return {
      object: g,
      fallback: true,
      width,
      get isOpen() {
        return open;
      },
      open() {
        if (open) return Promise.resolve();
        open = true;
        t = 0;
        return new Promise((res) => setTimeout(res, 1200));
      },
      setOpen(on) {
        open = !!on;
        t = -1;
        mesh.visible = !open;
      },
      update(dt) {
        if (t < 0) return;
        t += dt;
        const k = Math.min(1, t / 1.1);
        mesh.rotation.x = -k * k * 1.45;
        mesh.position.y = -k * 0.6;
        mesh.scale.setScalar(1 - 0.25 * k);
        if (k >= 1) {
          mesh.visible = false;
          t = -1;
        }
      },
      dispose() {
        mesh.geometry.dispose();
      },
    };
  }
  /** Axe d'une entrée : vers l'intérieur (ix, iy) et sur le côté (lx, ly), en cases. */
  function entranceAxes(e) {
    const ix = Math.round(Math.sin(e.dir)), iy = Math.round(Math.cos(e.dir));
    return { ix, iy, lx: -iy, ly: ix };
  }
  W.buildEntrances = function () {
    const f = this.field;
    this.entrances = [];
    this.staticShadowCasters = this.staticShadowCasters || [];
    const poles = [];
    const walk = (i, j) => {
      const c = f.charAt(i, j);
      return !!c && "#=ELsgm".includes(c);
    };
    for (const e of this.places.entrances) {
      const ax = entranceAxes(e);
      const w = e.tiles.length;
      // poteau : au bord de l'entrée, du côté qui n'est pas une route (au nord pour une route
      // horizontale : sa bannière se projette sur le plateau, pas sur la route)
      const half = w / 2 + 0.3;
      const cands = [1, -1].map((s) => {
        const x = e.x + ax.lx * s * half + ax.ix * 0.35, y = e.y + ax.ly * s * half + ax.iy * 0.35;
        return { s, x, y, free: !walk(Math.floor(x), Math.floor(y)) };
      });
      let pick;
      if (ax.ix !== 0) pick = cands.slice().sort((a, b) => b.free - a.free || a.y - b.y)[0];
      else pick = cands.slice().sort((a, b) => b.free - a.free || a.x - b.x)[0];
      // au bord du haut, le poteau recule d'une case (sa bannière resterait sinon hors de l'écran)
      let px = clamp(pick.x, 0.25, MW - 0.25), py = clamp(pick.y, 0.25, MH - 0.25);
      if (e.y < 1 && ax.iy > 0) py += 0.6;
      if (e.x < 1 && ax.ix > 0) px += 0.25;
      const ground = f.heightAt(px, py);
      const ent = {
        id: e.id, letter: e.letter, color: e.color, tiles: e.tiles, x: e.x, y: e.y, dir: e.dir, w,
        open: !!e.open, opensAt: e.opensAt, ix: ax.ix, iy: ax.iy, lx: ax.lx, ly: ax.ly,
        pole: { x: px, y: py, ground, top: ground + 2.9 }, barrier: null, pulse: 0, opened: -1,
      };
      poles.push(ent.pole);
      if (!e.open) {
        const m = tryModel("barrier", { width: w, seed: e.id }) || FallbackBarrier(w);
        const o = objOf(m);
        o.position.set(toX(e.x), 0, toZ(e.y));
        o.rotation.y = e.dir;
        this.root.add(o);
        ent.barrier = m;
        this.staticShadowCasters.push({ x: e.x, y: e.y, r: 0.25 * w + 0.3, h: 1.4, a: 0.7 });
      }
      this.staticShadowCasters.push({ x: px, y: py, r: 0.18, h: 2.9, a: 0.6 });
      this.entrances.push(ent);
    }
    if (!poles.length) return;
    // poteaux : chêne grisé, chapeau d'ardoise, pierres au pied (un seul maillage)
    const parts = [];
    for (const p of poles) {
      const X = toX(p.x), Z = toZ(p.y), y = p.ground;
      parts.push({ g: new THREE.CylinderGeometry(0.13, 0.17, 2.9, 7), color: "#6e5640", m: T4(X, y + 1.45, Z), shade: 0.4 });
      parts.push({ g: new THREE.ConeGeometry(0.3, 0.32, 4), color: "#4a5262", m: T4(X, y + 3.05, Z, 0, Math.PI / 4) });
      parts.push({ g: new THREE.BoxGeometry(0.9, 0.1, 0.1), color: "#5a4430", m: T4(X, y + 2.62, Z) });
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * TAU + 0.5;
        parts.push({ g: new THREE.DodecahedronGeometry(0.2, 0), color: k % 2 ? "#9d968a" : "#8a847a", m: T4(X + Math.cos(a) * 0.3, y + 0.06, Z + Math.sin(a) * 0.3, 0, a, 0, 1, 0.6, 1) });
      }
    }
    const mesh = merged(parts, "Poteaux des entrées");
    mesh.userData.batch = "plain";
    mesh.castShadow = this.high;
    this.root.add(mesh);
  };
  /** Une barrière cède (gateOpen) : animation, éclats, l'entrée devient une entrée comme les autres. */
  W.openGate = function (id, animate) {
    const e = this.entrances && this.entrances.find((q) => q.id === id);
    if (!e || e.open) return;
    e.open = true;
    e.opened = 0;
    const b = e.barrier;
    if (b) {
      try {
        if (animate === false) {
          if (b.setOpen) b.setOpen(true);
        } else if (b.open) b.open();
        else if (b.setOpen) b.setOpen(true);
      } catch (err) {
        /* modèle sans animation : rien de plus */
      }
    }
    if (animate === false) {
      e.opened = -1;
      return;
    }
    const FX = PTMT.fx;
    const B = FX && FX._ && FX._.S && FX._.BURSTS;
    if (!B) return;
    for (const [i, j] of e.tiles) {
      _v.set(toX(i + 0.5), 0.6, toZ(j + 0.5));
      try {
        if (B.woodChips) FX.burst("woodChips", _v, { radius: 1.2, kind: "grass" });
        if (B.leafBurst) FX.burst("leafBurst", _v, { radius: 1.3, kind: "grass" });
        if (B.smoke) FX.burst("smoke", _v, { radius: 1.2 });
      } catch (err) {
        /* effets facultatifs */
      }
    }
    FX.shake = Math.max(FX.shake || 0, 0.35);
  };
  /** Orientation des cachettes secondaires : dos à la caméra (rien ne cache leurs gemmes). */
  W.orientPlaces = function (az) {
    for (const L of this.lairs || []) {
      if (L.fixedYaw !== null) continue;
      const o = objOf(L.model);
      if (o.rotation.y === (az || 0)) continue;
      o.rotation.y = az || 0;
      this.batchDirty = true;
    }
  };
  W.updatePlaces = function (dt, time) {
    for (const L of this.lairs || []) if (L.model.update) L.model.update(dt, time);
    if (this.millModel && this.millModel.update) this.millModel.update(dt, time);
    for (const b of this.buttes || []) if (b.model.update) b.model.update(dt, time);
    for (const e of this.entrances || []) {
      if (e.barrier && e.barrier.update) e.barrier.update(dt, time);
      if (e.opened >= 0) {
        e.opened += dt;
        if (e.opened > 3) e.opened = -1;
      }
    }
  };
  /** Libère les modèles des lieux (vue détruite). */
  W.disposePlaces = function () {
    const free = (m) => {
      try {
        if (m && m.dispose) m.dispose();
      } catch (e) {
        /* modèle déjà libéré */
      }
    };
    for (const L of this.lairs || []) free(L.model);
    free(this.millModel);
    for (const b of this.buttes || []) free(b.model);
    for (const e of this.entrances || []) free(e.barrier);
    this.lairs = [];
    this.buttes = [];
    this.entrances = [];
    this.millModel = null;
  };
  void _m4;
})();
