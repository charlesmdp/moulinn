// « Pas touche à mes trésors » — application : rendu, boucle de jeu, sélection, niveaux,
// transitions, sauvegardes.
(function () {
  "use strict";
  const PTMT = (globalThis.PTMT = globalThis.PTMT || {});
  const C = PTMT.config;
  const U = PTMT.U;

  // Fusionne les maillages statiques d'un modèle par matériau. Les nœuds dont le nom
  // correspond à `keep` (et leurs enfants) restent des objets séparés, à leur place.
  function flattenModel(root, keep) {
    root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
    const out = new THREE.Group();
    out.name = root.name;
    const kept = [];
    const inKept = (o) => {
      for (let p = o; p && p !== root; p = p.parent) if (keep && keep.test(p.name)) return p;
      return null;
    };
    const keyOf = (m) => {
      const img = m.map && m.map.image;
      return [
        m.type,
        m.map ? (img && (img.src || img.currentSrc)) || m.map.uuid : "-",
        m.normalMap ? m.normalMap.uuid : "-",
        m.emissiveMap ? m.emissiveMap.uuid : "-",
        m.color ? m.color.getHexString() : "",
        m.emissive ? m.emissive.getHexString() : "",
        (m.roughness ?? 1).toFixed(2),
        (m.metalness ?? 0).toFixed(2),
        m.transparent ? 1 : 0,
        (m.opacity ?? 1).toFixed(2),
        m.side,
        m.alphaTest || 0,
        m.vertexColors ? 1 : 0,
      ].join("|");
    };
    const groups = new Map();
    const mat = new THREE.Matrix4();
    root.traverse((o) => {
      if (!o.isMesh) return;
      const k = inKept(o);
      if (k) {
        if (!kept.includes(k)) kept.push(k);
        return;
      }
      if (Array.isArray(o.material) || o.isSkinnedMesh || o.isInstancedMesh) {
        kept.push(o);
        return;
      }
      mat.multiplyMatrices(inv, o.matrixWorld);
      const src = o.geometry;
      const g = new THREE.BufferGeometry();
      const n = src.attributes.position.count;
      g.setAttribute("position", src.attributes.position.clone());
      if (src.attributes.normal) g.setAttribute("normal", src.attributes.normal.clone());
      g.setAttribute("uv", src.attributes.uv ? src.attributes.uv.clone() : new THREE.BufferAttribute(new Float32Array(n * 2), 2));
      if (o.material.vertexColors) {
        const c = src.attributes.color;
        g.setAttribute("color", c && c.itemSize === 3 ? c.clone() : new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
      }
      let index = src.index ? Array.from(src.index.array) : Array.from({ length: n }, (_, i) => i);
      if (mat.determinant() < 0) for (let i = 0; i + 2 < index.length; i += 3) [index[i + 1], index[i + 2]] = [index[i + 2], index[i + 1]];
      g.setIndex(n > 65535 ? new THREE.Uint32BufferAttribute(index, 1) : new THREE.Uint16BufferAttribute(index, 1));
      g.applyMatrix4(mat);
      if (!g.attributes.normal) g.computeVertexNormals();
      const key = keyOf(o.material);
      if (!groups.has(key)) groups.set(key, { material: o.material, list: [] });
      groups.get(key).list.push(g);
    });
    for (const { material, list } of groups.values()) {
      // Les index 16 et 32 bits ne se mélangent pas : on passe tout en 32 bits si besoin.
      const total = list.reduce((a, g) => a + g.attributes.position.count, 0);
      if (total > 65535) for (const g of list) g.setIndex(new THREE.Uint32BufferAttribute(Array.from(g.index.array), 1));
      const merged = THREE.BufferGeometryUtils.mergeBufferGeometries(list, false);
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, material);
      mesh.name = material.name || "Fusion";
      out.add(mesh);
    }
    for (const k of kept) {
      const holder = new THREE.Group();
      holder.name = "Porte_" + k.name;
      new THREE.Matrix4().multiplyMatrices(inv, k.parent.matrixWorld).decompose(holder.position, holder.quaternion, holder.scale);
      holder.add(k);
      out.add(holder);
    }
    return out;
  }

  const App = {};

  App.start = async function (assets) {
    const app = App;
    app.assets = assets;
    app.root = assets.root;
    app.mobile = assets.mobile;
    const stage = app.root.querySelector("[data-stage]");
    const canvas = (app.canvas = assets.canvas);
    stage.append(canvas);
    const renderer = (app.renderer = new THREE.WebGLRenderer({ canvas, context: assets.gl, antialias: true }));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    app.pixelRatio = Math.min(window.devicePixelRatio || 1, app.mobile ? 1.75 : 2);
    renderer.setPixelRatio(app.pixelRatio);
    const scene = (app.scene = new THREE.Scene());
    scene.background = PTMT.color("#a9cbe3");
    scene.fog = new THREE.Fog(PTMT.color("#b6cfd9"), 160, 420);
    const camera = (app.camera = new THREE.PerspectiveCamera(40, 1, 1, 900));
    // Lumières.
    const hemi = new THREE.HemisphereLight(PTMT.color("#cfe3ff"), PTMT.color("#5b6b3a"), 0.55);
    scene.add(hemi);
    const sun = (app.sun = new THREE.DirectionalLight(PTMT.color("#fff1d6"), 1.75));
    sun.position.set(-60, 110, 45);
    sun.castShadow = true;
    const sm = app.mobile ? 1024 : 2048;
    sun.shadow.mapSize.set(sm, sm);
    const sc = sun.shadow.camera;
    sc.left = -85;
    sc.right = 85;
    sc.top = 70;
    sc.bottom = -70;
    sc.near = 20;
    sc.far = 300;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.04;
    scene.add(sun, sun.target);
    app.skyDome();
    // Textures du jardin (mêmes fichiers que la scène du moulin).
    const loader = new THREE.TextureLoader();
    const tex = {};
    const want = ["grass", "gravel", "stone", "wood", "water", "slate"];
    await Promise.all(
      want.map(
        (k) =>
          new Promise((res) => {
            const d = assets.plan.textures[k];
            if (!d) return res();
            loader.load(
              assets.base + d.uri,
              (t) => {
                t.wrapS = t.wrapT = THREE.RepeatWrapping;
                if (d.color) t.encoding = THREE.sRGBEncoding;
                t.anisotropy = 4;
                tex[k] = t;
                res();
              },
              undefined,
              () => res(),
            );
          }),
      ),
    );
    app.textures = tex;
    // Modèles du moulin et de la dépendance (exportés de la scène d'origine).
    const gltf = new THREE.GLTFLoader();
    const parse = (buf) => new Promise((res) => gltf.parse(buf, "", (g) => res(g.scene), () => res(null)));
    const [millRaw, dependanceRaw] = await Promise.all([parse(assets.mill), parse(assets.dependance)]);
    // Des centaines de pièces par bâtiment : on les fusionne par matériau (la roue reste mobile).
    const mill = millRaw && flattenModel(millRaw, /^(Rotor_mobile_du_moulin|Roue_a_aubes_contre_le_moulin)$/);
    const dependance = dependanceRaw && flattenModel(dependanceRaw, null);
    for (const m of [mill, dependance])
      m &&
        m.traverse((o) => {
          if (o.isMesh) {
            o.castShadow = o.receiveShadow = true;
            if (o.material && o.material.map) o.material.map.anisotropy = 4;
          }
        });
    app.models = { mill, dependance };
    // Personnages et effets.
    if (PTMT.fx && PTMT.fx.init) {
      try {
        PTMT.fx.init(scene, camera, renderer, { mobile: app.mobile });
      } catch (e) {
        console.warn("Effets indisponibles", e);
      }
    }
    if (PTMT.actors && PTMT.actors.load) {
      try {
        PTMT.actors.mobile = app.mobile;
        await PTMT.actors.load(assets.avatar);
      } catch (e) {
        console.warn("Personnages indisponibles", e);
      }
    }
    app.ctx = { scene, renderer, camera, textures: tex, models: app.models, mobile: app.mobile };
    app.world = new PTMT.World(app.ctx);
    app.entities = new PTMT.Entities(app.ctx, app.world);
    app.rig = new PTMT.CameraRig(camera, canvas, {});
    app.rig.onTap = (x, y, e) => app.tap(x, y, e);
    app.rig.onHover = (x, y) => app.hover(x, y);
    app.progress = PTMT.progress.load();
    app.ui = new PTMT.UI(app);
    app.raycaster = new THREE.Raycaster();
    app.clock = { last: performance.now(), time: 0 };
    window.addEventListener("resize", () => app.resize());
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && app.game && app.game.state.phase === "wave") app.game.setPaused(true);
    });
    app.resize();
    // Première disposition affichée derrière le menu.
    app.startLevel(Math.min(app.progress.unlockedLevel, 5), { silent: true });
    PTMT.started = true;
    assets.loading.classList.add("is-done");
    setTimeout(() => assets.loading.remove(), 700);
    app.ui.showMenu();
    requestAnimationFrame(app.frame);
    window.ptmt = app;
  };

  App.skyDome = function () {
    const g = new THREE.SphereGeometry(600, 24, 12);
    const m = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: { top: { value: PTMT.color("#6fa6d6") }, bottom: { value: PTMT.color("#d9e6ea") } },
      vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: "uniform vec3 top, bottom; varying vec3 vP; void main(){ float h = clamp(vP.y * 1.6 + 0.1, 0.0, 1.0); gl_FragColor = vec4(mix(bottom, top, h), 1.0);\n#include <encodings_fragment>\n}",
    });
    const sky = new THREE.Mesh(g, m);
    sky.renderOrder = -10;
    App.scene.add(sky);
    App.sky = sky;
  };

  App.resize = function () {
    const w = window.innerWidth,
      h = window.innerHeight;
    App.renderer.setSize(w, h, false);
    App.camera.aspect = w / h;
    App.camera.updateProjectionMatrix();
    if (App.rig) App.rig.apply();
  };

  // ── Niveaux ─────────────────────────────────────────────────────────────────
  App.startLevel = function (level, opts = {}) {
    const app = App;
    const prog = app.progress;
    PTMT.progress.markStarted(prog, level);
    PTMT.progress.save(prog);
    const game = new PTMT.Game({ level, talents: JSON.parse(JSON.stringify(prog.talents)), unlocked: PTMT.progress.unlockedSpells(prog, level), mobile: app.mobile });
    app.setGame(game, opts);
    if (!opts.silent) {
      PTMT.progress.saveCheckpoint(game.serialize());
      app.levelTips(level);
    }
  };
  App.resume = function (cp) {
    try {
      const game = new PTMT.Game({ level: cp.level, checkpoint: cp, mobile: App.mobile });
      App.setGame(game, { transition: false });
    } catch (e) {
      console.warn("Sauvegarde illisible", e);
      PTMT.progress.saveCheckpoint(null);
      App.ui.showMenu();
    }
  };
  App.setGame = function (game, opts = {}) {
    const app = App;
    const prevLayout = app.game && app.game.L.id;
    app.game = game;
    app.lastPhase = game.state.phase;
    app.ui.closeScreen();
    app.ui.closePanel();
    app.ui.cancelModes();
    app.ui.clearLabels();
    app.ui.clearMarkers();
    app.ui.hidePrep();
    const layoutChanged = prevLayout !== game.L.id || !app.world.L;
    if (layoutChanged) app.world.build(game.L);
    app.world.game = game;
    // Forêts : état de la partie (cases déjà coupées) sans animation.
    if (app.world.syncForests) {
      for (const f of app.world.forest ? app.world.forest.values() : []) f.state = "reset";
      app.world.syncForests(game, false);
    }
    app.entities.reset(game);
    app.rig.frame({ x0: -58, x1: 58, z0: -40, z1: 40 }, 0);
    app.rig.bounds = { x0: -64, x1: 64, z0: -46, z1: 46 };
    if (opts.transition && layoutChanged) app.reveal(game);
    else if (!opts.silent) app.ui.banner(`${game.level}. ${game.L.name}`, game.L.pitch);
    app.ui.setTab("towers");
    app.ui.showPrep();
    app.ui.renderTray();
  };
  /** Transition : les ensembles réapparaissent à leurs nouvelles places, la caméra fait le tour. */
  App.reveal = function (game) {
    const app = App;
    const items = [];
    const push = (obj, delay) => obj && items.push({ obj, delay, s: obj.scale.clone() });
    push(app.world.millObject, 0.2);
    (app.world.buildingViews || []).forEach((v, i) => push(v.holder, 0.5 + i * 0.25));
    for (const [, v] of app.entities.chests) push(v.object, 1.2);
    for (const m of app.world.treeMeshes || []) push(m, 0);
    for (const it of items) it.obj.scale.setScalar(0.001);
    app.revealAnim = { t: 0, items, yaw0: Math.PI * 0.9 };
    app.rig.yaw = app.revealAnim.yaw0;
    app.rig.distance = 150;
    app.rig.apply();
    app.ui.banner("Le domaine s'est réorganisé !", `${game.level}. ${game.L.name} — ${game.L.pitch}`);
  };
  App.updateReveal = function (dt) {
    const a = App.revealAnim;
    if (!a) return;
    a.t += dt;
    for (const it of a.items) {
      const k = Math.max(0, Math.min(1, (a.t - it.delay) / 0.6));
      const e = k < 1 ? 1 - Math.pow(1 - k, 3) * Math.cos(k * 8) * 0.9 : 1;
      it.obj.scale.set(it.s.x * Math.max(0.001, e), it.s.y * Math.max(0.001, e), it.s.z * Math.max(0.001, e));
    }
    const k = Math.min(1, a.t / 3.2),
      e = k * k * (3 - 2 * k);
    App.rig.yaw = a.yaw0 * (1 - e);
    App.rig.distance = 150 + (App.fitDistance() - 150) * e;
    App.rig.apply();
    if (a.t > 3.4) {
      for (const it of a.items) it.obj.scale.copy(it.s);
      App.revealAnim = null;
    }
  };
  App.fitDistance = function () {
    const rig = App.rig;
    const aspect = App.canvas.clientWidth / Math.max(1, App.canvas.clientHeight);
    const fov = (App.camera.fov * Math.PI) / 180;
    const needH = (80 * 0.62) / Math.tan(fov / 2) / 1.05;
    const needW = 116 / 2 / (Math.tan(fov / 2) * aspect);
    return Math.max(rig.minDistance, Math.min(rig.maxDistance, Math.max(needH, needW) * 0.95));
  };
  App.launchWave = function () {
    const game = App.game;
    const r = game.launchWave();
    if (!r.ok) return App.ui.flash(r.reason);
    App.ui.hidePrep();
    App.ui.hideTip();
    App.ui.closePanel();
    App.progressTutorial("wave");
  };
  App.continueEndless = function () {
    const game = App.game;
    game.continueEndless();
    App.ui.closeScreen();
    App.ui.showPrep();
    App.ui.flash("Mode sans fin : tiens le plus longtemps possible !", "gold");
    PTMT.progress.saveCheckpoint(game.serialize());
  };
  App.togglePause = function () {
    const g = App.game;
    if (!g || g.isOver) return;
    g.setPaused(!g.state.paused);
    App.ui.renderTray();
  };
  App.toggleSpeed = function () {
    const g = App.game;
    if (!g) return;
    g.setSpeed(g.state.speed === 2 ? 1 : 2);
  };
  App.openMenu = function () {
    if (App.game && App.game.state.phase === "wave") App.game.setPaused(true);
    App.ui.showMenu();
  };
  App.leave = function () {
    if (App.game && App.game.state.phase === "prep") PTMT.progress.saveCheckpoint(App.game.serialize());
  };

  // ── Tutoriel ─────────────────────────────────────────────────────────────────
  App.levelTips = function (level) {
    const ui = App.ui;
    const tips = {
      1: "Bienvenue au moulin ! Six trésors dorment dans le moulin et la dépendance. Les voleurs entrent par les portes à fanion ; leur chemin s'affiche en pointillés de la couleur de la porte. Choisis une tour en bas, puis touche une case de son sol : rocaille pour le feu, givre pour la glace, berge pour l'eau.",
      2: "Nouveau : le Ressort farceur (pièges) renvoie les voleurs en arrière, et le sort Gel immobilise tout un groupe. La rivière coupe le domaine en deux : partage ton or.",
      3: "Nouveau : le Faux coffre attire les voleurs sans sac, la Vague de crue les repousse. Les voleurs au fumigène deviennent invisibles au premier coup : frappe-les tôt !",
      4: "Les nageurs en flamant rose arrivent par l'eau et accostent aux débarcadères. Nouveau sort : Frénésie, qui accélère les tours proches.",
      5: "Le chef en tondeuse blindée arrive à la vague 10. Toutes les 6 secondes, il surchauffe et encaisse 50 % de dégâts en plus : c'est le moment de tout lancer.",
    };
    setTimeout(() => ui.tip("level" + level, tips[level], { duration: 20000 }), 1200);
  };
  App.progressTutorial = function (what) {
    const ui = App.ui,
      g = App.game;
    if (what === "built" && g.level === 1) ui.tip("afterBuild", "Bien ! Ajoute quelques défenses côte à côte aux virages, puis appuie sur « Lancer la vague ». Les cases boisées, souvent les mieux placées, se libèrent en coupant leur forêt. La pause tactique (bouton ⏸ ou Espace) permet de construire à tout moment.");
    if (what === "cut") ui.tip("cut", "Les bûcherons s'y mettent : la case sera libre dans quelques secondes, même entre les vagues. Chaque coupe coûte un peu plus cher que la précédente.");
    if (what === "wave" && g.state.wave === 2) ui.tip("meule", "Astuce : la Meule (onglet Moulin) rapporte de l'or à chaque vague terminée. Elle s'amortit en quelques vagues.");
    if (what === "steal") ui.tip("steal", "Un voleur emporte un trésor ! Il n'est perdu que s'il passe la sortie : mets-le KO et il lâchera le sac.");
    if (what === "drop") ui.tip("drop", "Sac tombé ! Le sort Rappel le renvoie dans sa réserve. Sinon, il y revient à la fin de la vague… si aucun voleur ne le ramasse.");
    if (what === "xp") ui.tip("xp", "Une tour a gagné assez d'expérience pour évoluer : achète l'Atelier I dans l'onglet Moulin, puis touche la tour pour choisir sa spécialisation.");
  };

  // ── Sélection et visée ──────────────────────────────────────────────────────
  App.pickGround = function (clientX, clientY) {
    const rect = App.canvas.getBoundingClientRect();
    const v = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    App.raycaster.setFromCamera(v, App.camera);
    const hit = App.raycaster.intersectObject(App.world.terrain, false)[0];
    let p = hit ? hit.point : null;
    if (!p) {
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1);
      p = App.raycaster.ray.intersectPlane(plane, new THREE.Vector3());
    }
    if (!p) return null;
    const [x, z] = App.world.fromWorld(p);
    return { x, z, p };
  };
  App.hover = function (cx, cy) {
    const ui = App.ui,
      game = App.game;
    if (!game) return;
    // Mode construction (souris) : la case survolée s'allume, avec sa portée et son prix.
    if (ui.buildMode && ui.buildMode.kind === "tower" && !ui.aim) {
      const g = App.pickGround(cx, cy);
      const so = g && game.socketAt(g.x, g.z);
      const id = so ? so.id : null;
      ui.touch = false;
      if (id !== ui.preview) ui.setBuildPreview(id);
      return;
    }
    if (!ui.aim) return;
    const g = App.pickGround(cx, cy);
    if (!g) return;
    const st = game.spellStats(ui.aim.spell);
    let yaw = 0;
    if (ui.aim.spell === "flood") {
      const loc = PTMT.routes.locate(game.graph, g.x, g.z, "walker");
      if (loc) {
        const p = PTMT.geom.at(loc.edge.line, loc.s);
        yaw = Math.atan2(p.dx, p.dz);
      }
    }
    App.entities.showAim(ui.aim.spell, g.x, g.z, st, yaw);
  };
  App.tap = function (cx, cy, ev) {
    const ui = App.ui,
      game = App.game;
    if (!game || ui.screen) return;
    const g = App.pickGround(cx, cy);
    if (!g) return;
    const { x, z } = g;
    const s = game.state;
    const touch = !!(ev && ev.pointerType && ev.pointerType !== "mouse");
    ui.touch = touch;
    const tile = game.socketAt(x, z);
    // Visée d'un sort.
    if (ui.aim) {
      const id = ui.aim.spell;
      const r = game.cast(id, x, z);
      if (!r.ok) ui.flash(r.reason);
      else if (r.queued) ui.flash(`${C.spells[id].name} lancé à la reprise`, "gold");
      ui.stopAim();
      return;
    }
    const d = (a, b) => Math.hypot(a.x - x, a.z - z);
    const near = (list, r) => {
      let best = null,
        bd = r;
      for (const o of list) {
        const dd = d(o, o);
        if (dd < bd) (bd = dd), (best = o);
      }
      return best;
    };
    // Mode construction : la case touchée (grille). Au doigt, un premier toucher montre la case,
    // sa portée et son prix ; un second toucher sur la même case construit.
    if (ui.buildMode) {
      if (ui.buildMode.kind === "tower") {
        const fam = ui.buildMode.family;
        if (tile && game.isForest(tile.id)) {
          ui.setBuildPreview(tile.id);
          ui.showForestPanel(tile.id);
          return;
        }
        if (tile && !game.towerAt(tile.id) && tile.kind === fam) {
          if (touch && ui.preview !== tile.id) {
            ui.setBuildPreview(tile.id);
            return;
          }
          const res = game.build(tile.id, fam);
          if (!res.ok) ui.flash(res.reason);
          else {
            App.entities.burst("smoke", tile.x, tile.z, {});
            App.progressTutorial("built");
            if (s.gold < C.towers[fam].forms["1"].cost) ui.cancelModes();
            else ui.setBuildPreview(touch ? null : tile.id);
          }
          ui.renderTray();
          return;
        }
        if (tile && !game.towerAt(tile.id) && tile.kind !== fam) {
          ui.setBuildPreview(tile.id);
          ui.flash(`Sol ${{ fire: "de rocaille", ice: "de givre", water: "de berge" }[tile.kind]} : il accueille les tours ${{ fire: "de feu", ice: "de glace", water: "d'eau" }[tile.kind]}`);
          return;
        }
      } else {
        const sl = near(game.L.trapSlots.filter((q) => !s.traps.some((t) => t.slot === q.id)), 1.8);
        if (sl) {
          const res = game.buildTrap(sl.id, ui.buildMode.trap);
          if (!res.ok) ui.flash(res.reason);
          else if (s.traps.length >= game.trapLimit()) ui.cancelModes();
          ui.renderTray();
          return;
        }
      }
    }
    // Sélection : la tour de la case touchée, un piège, une réserve, puis la case elle-même.
    const onTile = tile && game.towerAt(tile.id);
    if (onTile) return ui.showTowerPanel(onTile.id);
    const tr = near(s.traps, 1.3);
    if (tr) return ui.showTrapPanel(tr.id);
    const res = near(s.reserves, 2.2);
    if (res) return ui.showReservePanel(res.id);
    const tw = near(s.towers, 1.4);
    if (tw) return ui.showTowerPanel(tw.id);
    if (tile) return ui.showSocketPanel(tile.id);
    const sl = near(game.L.trapSlots.filter((q) => !s.traps.some((t) => t.slot === q.id)), 1.1);
    if (sl && ui.tab === "traps") return ui.showSlotPanel(sl.id);
    const sack = s.treasures.find((t) => t.state === "dropped" && Math.hypot(t.x - x, t.z - z) < 1.6);
    if (sack && s.phase === "wave") {
      ui.setTab("spells");
      ui.startAim("recall");
      return;
    }
    ui.closePanel();
  };
  App.select = function (sel) {
    App.selection = sel;
    const ent = App.entities;
    if (!sel) {
      ent.showRange(0, 0, 0);
      ent.showSelection(null);
      return;
    }
    const col = { fire: 0xff9a52, ice: 0x9fe8ff, water: 0x62b4ff }[sel.family] || 0xffffff;
    ent.showRange(sel.x, sel.z, sel.range || 0, col);
    ent.showSelection(sel.x, sel.z, sel.kind === "reserve" ? 1.6 : 1);
  };
  /** Mise en valeur des emplacements selon le mode (la grille des cases est tenue à jour à chaque image). */
  App.setSocketHighlight = function (mode) {
    const game = App.game;
    if (!game || !App.world.slotViews || App.world.L !== game.L) return;
    for (const [id, m] of App.world.slotViews) {
      const used = game.state.traps.some((t) => t.slot === id);
      m.visible = !used;
      m.material.opacity = mode && mode.kind === "trap" ? 0.95 : 0.4;
    }
  };
  /** État d'une case pour la grille de construction. */
  App.tileInfo = function (id) {
    const game = App.game;
    if (game.towerAt(id)) return "occupied";
    if (game.isForest(id)) return game.cutProgress(id) !== null ? "cutting" : "forest";
    return "free";
  };
  /** Recentre la vue sur une porte d'entrée. */
  App.focusGate = function (node) {
    const p = App.world.gateAnchor && App.world.gateAnchor(node);
    if (!p) return;
    App.rig.focusOn(p, Math.min(App.rig.distance, 62));
  };
  App.focusEnemy = function (id) {
    const e = App.game.state.enemies.find((q) => q.id === id);
    if (!e) return;
    App.rig.focusOn(App.world.toWorld(e.x, e.z), Math.min(App.rig.distance, 55));
  };
  App.focusReserve = function (id) {
    const r = App.game.reserve(id);
    App.rig.focusOn(App.world.toWorld(r.x, r.z), Math.min(App.rig.distance, 60));
  };

  // ── Boucle ─────────────────────────────────────────────────────────────────
  App.frame = function (now) {
    requestAnimationFrame(App.frame);
    const app = App;
    const dt = Math.min(0.1, (now - app.clock.last) / 1000);
    app.clock.last = now;
    app.clock.time += dt;
    const time = app.clock.time;
    const game = app.game;
    if (game) {
      game.update(dt);
      const events = game.drainEvents();
      for (const ev of events) app.handleEvent(ev, time);
      // Fin de vague : détectée d'une image à l'autre (même si la partie a avancé hors de la boucle).
      if (game.state.phase === "prep" && app.lastPhase === "wave") app.onWaveEnd();
      app.lastPhase = game.state.phase;
      app.entities.sync(game.state.paused ? 0 : dt * game.state.speed, time, app.camera);
      if (app.world.syncForests) app.world.syncForests(game, true);
      if (app.world.setGrid) {
        const bm = app.ui.buildMode;
        app.world.setGrid(bm && bm.kind === "tower" ? bm : null, app.ui.preview, app.tileInfo);
      }
    }
    app.updateReveal(dt);
    app.rig.update(dt);
    app.world.update(game && game.state.paused ? 0 : dt, time, app.camera);
    if (PTMT.fx && PTMT.fx.update) {
      try {
        PTMT.fx.update(game && game.state.paused ? 0 : dt * (game ? game.state.speed : 1), time);
      } catch (e) {}
    }
    // Ombres : la caméra d'ombre suit la vue.
    const t = app.rig.target;
    app.sun.position.set(t.x - 60, 110, t.z + 45);
    app.sun.target.position.set(t.x, 0, t.z);
    app.sun.target.updateMatrixWorld();
    app.renderer.render(app.scene, app.camera);
    if (game) app.ui.update(dt, time);
  };
  App.handleEvent = function (ev, time) {
    const app = App,
      ui = app.ui,
      game = app.game;
    app.entities.onEvent(ev, time, ui);
    switch (ev.type) {
      case "drop":
        app.progressTutorial("drop");
        break;
      case "waveStart":
        if (ev.boss) ui.flash(ev.eliteBoss ? "La Limousine-tondeuse arrive !" : "Le chef en tondeuse blindée arrive !", "");
        break;
      case "income":
        ui.flash(`La meule rapporte ${ev.gold} or`, "gold");
        break;
      case "treasureHome":
        if (ev.how === "recall") ui.flash("Trésor rappelé dans sa réserve", "info");
        break;
      case "victory":
      case "defeat":
        app.onGameOver(ev.result);
        break;
      case "upgrade":
        ui.renderTray();
        break;
      case "spellResumed":
        if (!ev.ok && ev.reason) ui.flash(`${C.spells[ev.id].name} : ${ev.reason}`);
        break;
      case "cutStart":
        ui.floatAt(ev.x, ev.z, "−" + ev.cost + " or", "bad");
        ui.renderTray();
        break;
      case "cutDone":
        ui.floatAt(ev.x, ev.z, "Forêt coupée !", "blue");
        if (ui.preview === ev.id) ui.setBuildPreview(ev.id);
        app.progressTutorial("cutDone");
        break;
    }
    if (ev.type === "ko") {
      if (game.state.towers.some((t) => t.tier === 1 && t.xp >= C.xp.tier2)) app.progressTutorial("xp");
    }
  };
  App.onWaveEnd = function () {
    const game = App.game;
    PTMT.progress.saveCheckpoint(game.serialize());
    App.ui.showPrep();
    App.ui.renderTray();
  };
  App.onGameOver = function (result) {
    const app = App,
      game = app.game;
    const prog = app.progress;
    let reward = null;
    if (result.endless) {
      const rec = PTMT.progress.recordEndless(prog, game.level, game.L.id, result.endlessCount);
      reward = { points: 0, record: rec };
      PTMT.progress.saveCheckpoint(null);
    } else if (result.win) reward = PTMT.progress.recordResult(prog, game.level, result);
    PTMT.progress.saveCheckpoint(null);
    PTMT.progress.save(prog);
    app.ui.hidePrep();
    setTimeout(() => app.ui.showResult(result, reward), result.win ? 900 : 1400);
  };

  PTMT.main = App;
})();
