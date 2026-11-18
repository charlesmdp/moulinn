// La Fête du Moulin — terrain d'essai (« labo ») : le même socle et les mêmes jeux que /moulin2, mais
// dans un décor simplifié qui se charge en une seconde (relief réel du domaine, étangs, bâtiments en
// boîtes, arbres en cônes). Sert à mettre au point les jeux et aux essais automatiques à plusieurs
// onglets. Lancement : node scripts/labo.mjs, puis http://localhost:8090/
//
// Adresse : ?jeu=rc (entre directement dans un jeu) · ?nom=Bob · ?salon=essai · ?bienvenue=1
//           ?relais=ws://localhost:8091 (connexion directe par un relais local) · ?pas=0.05 (temps figé, pour les essais)
(async function () {
  "use strict";
  const MF = globalThis.MoulinFete, THREE = globalThis.THREE;
  const params = new URLSearchParams(location.search);
  const site = await (await fetch("/src/moulin2/labo/site.json")).json();
  const G = site.grid;
  const raw = Uint8Array.from(atob(G.h), (c) => c.charCodeAt(0));
  const H = new Int16Array(raw.buffer);
  const cell = (i, j) => H[Math.max(0, Math.min(G.nz - 1, j)) * G.nx + Math.max(0, Math.min(G.nx - 1, i))] / 100;
  function heightAt(x, z) {
    const fx = (x - G.x0) / G.step, fz = (z - G.z0) / G.step;
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
    return (cell(i, j) * (1 - u) + cell(i + 1, j) * u) * (1 - v) + (cell(i, j + 1) * (1 - u) + cell(i + 1, j + 1) * u) * v;
  }
  const ponds = site.ponds.map((p) => {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const q of p.poly) {
      x0 = Math.min(x0, q[0]);
      x1 = Math.max(x1, q[0]);
      z0 = Math.min(z0, q[1]);
      z1 = Math.max(z1, q[1]);
    }
    return Object.assign({ x0, x1, z0, z1 }, p);
  });
  function waterAt(x, z) {
    for (const p of ponds) if (x >= p.x0 && x <= p.x1 && z >= p.z0 && z <= p.z1 && MF.pointInPoly(x, z, p.poly)) return p;
    return null;
  }

  /* ------------------------------------------------------------------ scène */
  const dom = document.getElementById("labo");
  const canvas = document.createElement("canvas");
  dom.appendChild(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.85;
  const scene = new THREE.Scene();
  const sky = new THREE.Color("#8fd3ff").convertSRGBToLinear();
  scene.background = sky;
  scene.fog = new THREE.Fog(sky, 140, 520);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.08, 1200);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a9a60, 0.85));
  const sun = new THREE.DirectionalLight(0xfff0d0, 1.15);
  sun.position.set(-49, 74, 47);
  scene.add(sun);
  function resize() {
    const w = dom.clientWidth || innerWidth, h = dom.clientHeight || innerHeight;
    renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  addEventListener("resize", resize);
  resize();

  // relief (un point tous les 2 m), coloré selon la pente et la proximité de l'eau
  {
    const step = 2, nx = Math.floor(((G.nx - 1) * G.step) / step) + 1, nz = Math.floor(((G.nz - 1) * G.step) / step) + 1;
    const pos = new Float32Array(nx * nz * 3), col = new Float32Array(nx * nz * 3), idx = [];
    const grass = new THREE.Color("#63b848").convertSRGBToLinear(), dark = new THREE.Color("#3f8a3a").convertSRGBToLinear(), mud = new THREE.Color("#9c8a5a").convertSRGBToLinear(), path = new THREE.Color("#cdb98f").convertSRGBToLinear();
    const c = new THREE.Color();
    const drive = MF.path(site.drive.map((p) => [p[0], p[1]]), { step: 1 });
    for (let j = 0; j < nz; j++)
      for (let i = 0; i < nx; i++) {
        const x = G.x0 + i * step, z = G.z0 + j * step, y = heightAt(x, z), k = (j * nx + i) * 3;
        pos[k] = x;
        pos[k + 1] = y;
        pos[k + 2] = z;
        const slope = Math.hypot(heightAt(x + 1, z) - heightAt(x - 1, z), heightAt(x, z + 1) - heightAt(x, z - 1)) / 2;
        c.copy(grass).lerp(dark, Math.min(1, slope * 2.2));
        const w = waterAt(x, z);
        if (w && y < w.level) c.copy(mud);
        if (Math.abs(drive.nearest(x, z).d) < 2.2 || MF.pointInPoly(x, z, site.forecourt)) c.copy(path);
        col[k] = c.r;
        col[k + 1] = c.g;
        col[k + 2] = c.b;
      }
    for (let j = 0; j < nz - 1; j++)
      for (let i = 0; i < nx - 1; i++) {
        const a = j * nx + i, b = a + 1, d = a + nx, e = d + 1;
        idx.push(a, d, b, b, d, e);
      }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const ground = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
    ground.name = "Relief";
    scene.add(ground);
  }
  // étangs
  for (const p of ponds) {
    const shape = new THREE.Shape(p.poly.map((q) => new THREE.Vector2(q[0], -q[1])));
    const water = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshLambertMaterial({ color: new THREE.Color("#2f9fe0").convertSRGBToLinear(), transparent: true, opacity: 0.82 }));
    water.rotation.x = -Math.PI / 2;
    water.position.y = p.level;
    water.name = "Etang_" + p.name;
    scene.add(water);
  }
  // îlots : galettes vertes posées sur l'eau
  for (const poly of site.islands || []) {
    const shape = new THREE.Shape(poly.map((q) => new THREE.Vector2(q[0], -q[1])));
    const isle = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.5, bevelEnabled: false }), new THREE.MeshLambertMaterial({ color: new THREE.Color("#4f9a3c").convertSRGBToLinear() }));
    isle.rotation.x = -Math.PI / 2;
    isle.position.y = -0.1;
    isle.name = "Ilot";
    scene.add(isle);
  }
  // bâtiments, murets, ponts : boîtes
  const boxMat = (hex) => new THREE.MeshLambertMaterial({ color: new THREE.Color(hex).convertSRGBToLinear() });
  for (const [list, hex] of [[site.buildings, "#d9cdb8"], [site.solids, "#9a9488"]])
    for (const b of list) {
      const g = new THREE.Group();
      g.position.set(b.cx, 0, b.cz);
      g.rotation.y = b.angle;
      const h = Math.max(0.4, b.y1 - b.y0);
      const m = new THREE.Mesh(new THREE.BoxGeometry(b.u1 - b.u0, h, b.v1 - b.v0), boxMat(hex));
      m.position.set((b.u0 + b.u1) / 2, b.y0 + h / 2, (b.v0 + b.v1) / 2);
      g.add(m);
      if (list === site.buildings && h > 5) {
        const roof = new THREE.Mesh(new THREE.BoxGeometry(b.u1 - b.u0 + 0.5, 0.5, b.v1 - b.v0 + 0.5), boxMat("#5b6470"));
        roof.position.set((b.u0 + b.u1) / 2, b.y1 + 0.25, (b.v0 + b.v1) / 2);
        g.add(roof);
      }
      scene.add(g);
    }
  for (const b of site.bridges) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(b.width, 0.14, b.length), boxMat("#a9713c"));
    m.position.set(b.centre[0], b.deckLevel - 0.07, b.centre[1]);
    m.rotation.y = b.angle;
    scene.add(m);
  }
  // arbres : un cône et un tronc par arbre
  {
    const n = site.trees.length;
    const crown = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 7), boxMat("#2f7d3a"), n);
    const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.5, 0.6, 1, 6), boxMat("#7a5a3a"), n);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    site.trees.forEach((t, i) => {
      const y = heightAt(t[0], t[1]), h = t[2];
      m.compose(p.set(t[0], y + h * 0.62, t[1]), q, s.set(h * 0.2, h * 0.76, h * 0.2));
      crown.setMatrixAt(i, m);
      m.compose(p.set(t[0], y + h * 0.15, t[1]), q, s.set(0.3 + h * 0.012, h * 0.3, 0.3 + h * 0.012));
      trunk.setMatrixAt(i, m);
    });
    crown.name = "Arbres";
    scene.add(crown, trunk);
  }

  /* ------------------------------------------------------------------ personnage */
  const avatar = MF.Presence.buildAvatar(params.get("couleur") || "#ffffff");
  avatar.tag.visible = false;
  scene.add(avatar.group);
  const P = { x: site.entry.x, z: site.entry.z, y: 0, heading: site.entry.rotation, speed: 0, enabled: true, yaw: site.entry.rotation, pitch: 0.32, phase: 0 };
  const keys = new Set();
  addEventListener("keydown", (ev) => !ev.target.matches("input") && keys.add(ev.key.toLowerCase()));
  addEventListener("keyup", (ev) => keys.delete(ev.key.toLowerCase()));
  addEventListener("blur", () => keys.clear());
  let drag = null;
  canvas.addEventListener("pointerdown", (ev) => (drag = { x: ev.clientX, y: ev.clientY }));
  addEventListener("pointermove", (ev) => {
    if (!drag || !P.enabled) return;
    P.yaw -= (ev.clientX - drag.x) * 0.006;
    P.pitch = MF.clamp(P.pitch + (ev.clientY - drag.y) * 0.004, -0.1, 1.2);
    drag = { x: ev.clientX, y: ev.clientY };
  });
  addEventListener("pointerup", () => (drag = null));
  function playerTick(dt) {
    avatar.group.visible = P.enabled;
    if (!P.enabled) return;
    const f = (keys.has("z") || keys.has("w") || keys.has("arrowup") ? 1 : 0) - (keys.has("s") || keys.has("arrowdown") ? 1 : 0);
    const r = (keys.has("d") || keys.has("arrowright") ? 1 : 0) - (keys.has("q") || keys.has("a") || keys.has("arrowleft") ? 1 : 0);
    const run = keys.has("shift") ? 2.4 : 1;
    let vx = 0, vz = 0;
    if (f || r) {
      // avant = direction du regard de la caméra ; droite = (−cos, sin) pour un cap h (0 = vers +z)
      const sx = Math.sin(P.yaw), sz = Math.cos(P.yaw);
      vx = sx * f - sz * r;
      vz = sz * f + sx * r;
      const l = Math.hypot(vx, vz);
      vx /= l;
      vz /= l;
      P.heading = MF.dampAngle(P.heading, Math.atan2(vx, vz), 12, dt);
    }
    P.speed = f || r ? 4.2 * run : 0;
    P.x += vx * P.speed * dt;
    P.z += vz * P.speed * dt;
    P.y = world.heightAt(P.x, P.z); // sol ou plancher de la fête
    const w = waterAt(P.x, P.z);
    if (w && !(world.onDeck && world.onDeck(P.x, P.z))) P.y = Math.max(P.y, w.level - 0.9);
    avatar.group.position.set(P.x, P.y, P.z);
    avatar.body.rotation.y = P.heading;
    P.phase += P.speed * dt * 2.2;
    const swing = Math.sin(P.phase) * (P.speed ? 0.6 : 0);
    avatar.legs[0].rotation.x = swing;
    avatar.legs[1].rotation.x = -swing;
    avatar.arms[0].rotation.x = -swing * 0.8;
    avatar.arms[1].rotation.x = swing * 0.8;
    const d = 5.2, cy = P.y + 1.5;
    camera.position.set(P.x - Math.sin(P.yaw) * Math.cos(P.pitch) * d, cy + Math.sin(P.pitch) * d, P.z - Math.cos(P.yaw) * Math.cos(P.pitch) * d);
    camera.position.y = Math.max(camera.position.y, world.heightAt(camera.position.x, camera.position.z) + 0.4);
    camera.lookAt(P.x, cy, P.z);
    if (camera.fov !== 50) {
      camera.fov = 50;
      camera.updateProjectionMatrix();
    }
  }

  const world = {
    THREE,
    scene,
    camera,
    renderer,
    dom,
    canvas,
    mobile: matchMedia("(pointer: coarse)").matches || innerWidth < 700,
    real: false,
    heightAt,
    waterAt,
    ponds,
    islands: site.islands || [],
    trees: site.trees.map((t) => ({ x: t[0], z: t[1], height: t[2] })),
    solids: [].concat(site.buildings, site.solids),
    player: {
      pose: () => ({ x: P.x, y: P.y, z: P.z, heading: P.heading, speed: P.speed, visible: P.enabled }),
      setEnabled(on) {
        P.enabled = !!on;
        keys.clear();
      },
      teleport(x, z, heading) {
        P.x = x;
        P.z = z;
        if (heading !== undefined) P.heading = P.yaw = heading;
        return true;
      },
      canStand: () => true,
      walk() {},
      walking: () => P.enabled,
      /** L'ordinateur-sac à dos : ici le personnage est celui de la fête, il suffit de changer de modèle. */
      wear(kit, color, hat, logo) {
        avatar.setKit(kit, logo);
        if (avatar.setColor && color) avatar.setColor(color);
        avatar.setHat(hat);
      },
    },
    invalidate() {},
    refreshShadows() {},
    announce: (text) => console.log("[annonce]", text),
  };
  const relay = params.get("relais");
  // ?pas=0.033 : le temps n'avance que quand les essais le demandent (__labo.step), horloge des parties comprise
  const fixed = parseFloat(params.get("pas")) || 0;
  let time = 0;
  const app = MF.boot(world, {
    rtc: relay ? undefined : false,
    relayUrls: relay ? [relay] : undefined,
    welcome: params.get("bienvenue") === "1",
    kit: params.get("ordi") || undefined,
    scoresUrl: params.get("scores") === "0" ? "" : "/api/scores",
    name: params.get("nom") || undefined,
    color: params.get("couleur") || undefined,
    now: fixed ? () => time * 1000 : undefined,
  });
  if (params.get("x")) world.player.teleport(+params.get("x"), +params.get("z") || 0, +params.get("cap") || 0);

  // boucle : temps réel, ou pas de temps fixe piloté par les essais (?pas=0.033 puis __labo.step(n))
  let last = performance.now();
  function frame(dt, draw = true) {
    time += dt;
    playerTick(dt);
    app.update(dt, time);
    if (draw) renderer.render(scene, camera);
  }
  function loop() {
    requestAnimationFrame(loop);
    const now = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!fixed) frame(dt);
  }
  requestAnimationFrame(loop);
  globalThis.__labo = {
    world,
    app,
    site,
    P,
    frame,
    /** Avance de n images (la dernière seule est dessinée). */
    step(n = 1) {
      for (let i = 0; i < n; i++) frame(fixed || 1 / 60, i === n - 1);
    },
  };
  globalThis.__laboReady = true;
})();
