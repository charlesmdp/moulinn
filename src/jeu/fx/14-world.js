// « Pas touche à mes trésors » — effets de carte (PTMT.fx, suite) : coupe des forêts, construction,
// vente, montée de niveau, soins à la crêpe, air de biniou, fumigène, barrière qui éclate,
// désarmement, peur, explosion des cadavres, gemmes (reflets, perte, traînée), météore qui tombe,
// aura de Frénésie, ouverture du passage secret, pataugeage dans l'estran (wadeSplash).
//
//   PTMT.fx.burst(kind, position, opts)   // kinds ci-dessous, s'ajoutent à ceux de 10-fx.js
//   const m = PTMT.fx.world.meteorFall(cible, délai, rayon) ; m.release()
//   PTMT.fx.world.frenzyAura(position, temps)   // à chaque image (sprites posés)
//   PTMT.fx.world.gemGlow(position, couleur 0..5, temps)   // gemme au sol : anneau pulsé + halo
//
// Tout passe par les lots partagés du noyau (un appel de dessin pour toutes les particules). Trois
// pictogrammes manquaient à la planche de sprites : note de musique, crêpe, bouclier brisé ; ils sont
// peints dans des cases libres de la planche (en partant de la dernière) au premier besoin.
(function () {
  "use strict";
  if (typeof THREE === "undefined") return;
  const PTMT = (globalThis.PTMT = globalThis.PTMT || {});
  const FX = (PTMT.fx = PTMT.fx || {});
  const _ = (FX._ = FX._ || {});
  const W = (FX.world = FX.world || {});
  const rnd = Math.random;
  const R = (a, b) => a + rnd() * (b - a);
  const C = () => PTMT.gfx.CELL;
  const V = () => new THREE.Vector3();
  const tv = [V(), V(), V()];
  // couleurs des gemmes v4 (rubis, émeraude, saphir, améthyste, topaze orange, diamant), comme
  // PTMT.models.gem : lueurs des reflets, de la perte et de la traînée
  const GEM = ["#ff2b45", "#2df27c", "#4290ff", "#c95cff", "#ffa524", "#e8fbff"];
  const col = (hex) => {
    const k = PTMT.color(hex);
    return [k.r, k.g, k.b];
  };
  const GEMC = [];

  /* ------------------------------------------------------------------ pictogrammes ajoutés */
  let cellsReady = false;
  function ensureCells() {
    if (cellsReady || !PTMT.gfx || !PTMT.gfx.atlas) return;
    const tex = PTMT.gfx.atlas();
    const cv = PTMT.gfx.atlasCanvas;
    if (!cv) return;
    const CELL = PTMT.gfx.CELL;
    const used = new Set(Object.values(CELL));
    const free = [];
    for (let i = 63; i >= 0 && free.length < 3; i--) if (!used.has(i)) free.push(i);
    if (free.length < 3) return;
    const ctx = cv.getContext("2d");
    const paint = (i, fn) => {
      ctx.save();
      ctx.translate((i % 8) * 128, Math.floor(i / 8) * 128);
      ctx.clearRect(0, 0, 128, 128);
      ctx.beginPath();
      ctx.rect(2, 2, 124, 124);
      ctx.clip();
      ctx.translate(4, 4);
      ctx.scale(120 / 128, 120 / 128);
      fn(ctx);
      ctx.restore();
    };
    CELL.note = free[0];
    paint(CELL.note, (c) => {
      c.fillStyle = "#fff";
      c.strokeStyle = "#fff";
      c.lineWidth = 9;
      c.beginPath();
      c.ellipse(40, 92, 18, 13, -0.4, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.ellipse(92, 80, 18, 13, -0.4, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.moveTo(55, 90);
      c.lineTo(55, 22);
      c.lineTo(107, 12);
      c.lineTo(107, 78);
      c.stroke();
      c.lineWidth = 14;
      c.beginPath();
      c.moveTo(55, 26);
      c.lineTo(107, 16);
      c.stroke();
    });
    CELL.crepe = free[1];
    paint(CELL.crepe, (c) => {
      c.fillStyle = "#8a4a18";
      c.beginPath();
      c.ellipse(64, 68, 56, 44, 0, 0, Math.PI * 2);
      c.fill();
      const g = c.createRadialGradient(56, 58, 6, 64, 66, 52);
      g.addColorStop(0, "#ffe7a8");
      g.addColorStop(0.7, "#f2b45a");
      g.addColorStop(1, "#c77a2a");
      c.fillStyle = g;
      c.beginPath();
      c.ellipse(64, 64, 50, 38, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "rgba(140,70,20,0.55)";
      for (const [x, y, r] of [[44, 56, 6], [78, 50, 5], [70, 78, 7], [52, 80, 4], [88, 70, 4]]) {
        c.beginPath();
        c.arc(x, y, r, 0, Math.PI * 2);
        c.fill();
      }
    });
    CELL.shieldBroken = free[2];
    paint(CELL.shieldBroken, (c) => {
      c.lineJoin = "round";
      const half = (sx) => {
        c.save();
        c.translate(sx, 0);
        c.beginPath();
        c.moveTo(64, 10);
        c.lineTo(108, 26);
        c.quadraticCurveTo(106, 88, 64, 120);
        c.quadraticCurveTo(22, 88, 20, 26);
        c.closePath();
        c.clip();
        c.fillStyle = "#c9b8ff";
        c.fillRect(0, 0, 128, 128);
        c.restore();
      };
      c.save();
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(70, 0);
      c.lineTo(56, 50);
      c.lineTo(72, 70);
      c.lineTo(58, 128);
      c.lineTo(0, 128);
      c.closePath();
      c.clip();
      half(-8);
      c.restore();
      c.save();
      c.beginPath();
      c.moveTo(128, 0);
      c.lineTo(74, 0);
      c.lineTo(60, 50);
      c.lineTo(76, 70);
      c.lineTo(62, 128);
      c.lineTo(128, 128);
      c.closePath();
      c.clip();
      half(8);
      c.restore();
    });
    tex.needsUpdate = true;
    cellsReady = true;
  }
  const S = () => _.S;
  const ok = () => !!(_.S && _.emit);
  const count = (n) => (_.count ? _.count(n) : n);

  /* ------------------------------------------------------------------ éclats */
  const B = (_.BURSTS = _.BURSTS || {});

  /** Copeaux et feuilles au pied des arbres qu'on abat (kind : grass | rock | reeds | high). */
  B.woodChips = function (p, o) {
    if (!ok()) return;
    const c = C(), K = _.COL, r = o.radius || 0.8;
    const leaf = o.kind === "reeds" ? col("#8aa84a") : o.kind === "rock" ? col("#3f7050") : col("#5f9a36");
    for (let i = 0, n = count(7); i < n; i++) {
      const a = R(0, 6.28), sp = R(1.5, 3.5);
      const chip = i % 3 !== 2;
      _.emit({ x: p.x + R(-r, r) * 0.5, y: p.y + R(0, 0.6), z: p.z + R(-r, r) * 0.5, vx: Math.cos(a) * sp, vy: R(2, 4.5), vz: Math.sin(a) * sp, grav: 11, drag: 0.6, life: R(0.5, 0.9), s0: chip ? 0.16 : 0.24, s1: chip ? 0.1 : 0.16, cell: chip ? c.shard : c.leaf, r: chip ? 0.86 : leaf[0], g: chip ? 0.62 : leaf[1], b: chip ? 0.34 : leaf[2], a: 1, a1: 0.6, rot: R(0, 6), spin: R(-12, 12), floor: p.y - 0.8 });
    }
    void K;
  };
  /** Feuillage qui s'effondre / buissons qui s'écartent : feuilles, poussière. */
  B.leafBurst = function (p, o) {
    if (!ok()) return;
    const c = C(), K = _.COL, r = o.radius || 1.2;
    const leaf = o.kind === "rock" ? col("#3f7050") : o.kind === "reeds" ? col("#8aa84a") : col("#5f9a36");
    for (let i = 0, n = count(16); i < n; i++) {
      const a = R(0, 6.28), sp = R(0.8, 2.6) * r;
      _.emit({ x: p.x, y: p.y + R(0.3, 1.8), z: p.z, vx: Math.cos(a) * sp, vy: R(0.5, 2.5), vz: Math.sin(a) * sp, grav: 2.2, drag: 1.4, life: R(0.9, 1.5), s0: R(0.2, 0.32), s1: 0.14, cell: c.leaf, r: leaf[0] * R(0.8, 1.2), g: leaf[1] * R(0.8, 1.1), b: leaf[2], a: 1, a1: 0, rot: R(0, 6), spin: R(-5, 5), floor: p.y - 0.4 });
    }
    for (let i = 0, n = count(8); i < n; i++) {
      const a = R(0, 6.28), sp = R(0.6, 1.6) * r;
      _.emit({ x: p.x, y: p.y + 0.2, z: p.z, vx: Math.cos(a) * sp, vy: R(0.3, 1), vz: Math.sin(a) * sp, drag: 2.5, life: R(0.7, 1.1), s0: 0.5 * r, s1: 1.3 * r, cell: c.puff, r: K.dust[0], g: K.dust[1], b: K.dust[2], a: 0.7, a1: 0, rot: R(0, 6), curve: 1 });
    }
  };
  /** Tour posée : anneau de poussière et bouffées. */
  B.buildDust = function (p, o) {
    if (!ok()) return;
    const c = C(), K = _.COL, r = o.radius || 1.6;
    _.ring(p.x, p.y, p.z, r * 0.3, r * 1.4, 0.5, K.dust, 0.9, 0, c.ripple);
    for (let i = 0, n = count(12); i < n; i++) {
      const a = (i / 12) * 6.28 + R(-0.2, 0.2), sp = R(1.5, 2.6) * r;
      _.emit({ x: p.x + Math.cos(a) * r * 0.4, y: p.y + 0.15, z: p.z + Math.sin(a) * r * 0.4, vx: Math.cos(a) * sp, vy: R(0.3, 1.2), vz: Math.sin(a) * sp, drag: 3.2, life: R(0.6, 0.9), s0: 0.45, s1: 1.1, cell: c.puff, r: K.dust[0], g: K.dust[1], b: K.dust[2], a: 0.85, a1: 0, rot: R(0, 6), curve: 1 });
    }
    for (let i = 0, n = count(6); i < n; i++) _.emit({ x: p.x + R(-0.6, 0.6), y: p.y + 0.4, z: p.z + R(-0.6, 0.6), vx: R(-2, 2), vy: R(3, 5), vz: R(-2, 2), grav: 12, life: 0.6, s0: 0.14, s1: 0.08, cell: c.shard, r: 0.7, g: 0.55, b: 0.36, a: 1, a1: 0.5, rot: R(0, 6), spin: R(-10, 10), floor: p.y });
  };
  /** Tour vendue : nuage et pièces d'or. */
  B.sellPoof = function (p, o) {
    if (!ok()) return;
    const c = C(), r = o.radius || 1.3;
    for (let i = 0, n = count(12); i < n; i++) {
      const a = (i / 12) * 6.28;
      _.emit({ x: p.x, y: p.y + 0.8, z: p.z, vx: Math.cos(a) * 2.4 * r, vy: R(0.5, 1.6), vz: Math.sin(a) * 2.4 * r, drag: 4, life: 0.8, s0: 0.6 * r, s1: 1.3 * r, cell: c.poof, a: 1, a1: 0, rot: R(0, 6), fadeOut: 0.55, curve: 2 });
    }
    if (B.coins) B.coins(p, { amount: 6 });
  };
  /** Montée de niveau : colonne de lumière dorée, étincelles qui montent, anneau au sol. */
  B.goldColumn = function (p, o) {
    if (!ok()) return;
    const c = C(), K = _.COL, r = o.radius || 1.4, h = o.height || 5;
    _.ring(p.x, p.y, p.z, r * 0.2, r * 1.8, 0.7, K.gold, 1, 0.8);
    _.flash(p.x, p.y + h * 0.3, p.z, r * 3, K.goldLight, 0.3);
    for (let i = 0, n = count(26); i < n; i++) {
      const a = R(0, 6.28), d = R(0.1, 1) * r;
      _.emit({ x: p.x + Math.cos(a) * d, y: p.y + R(0, 0.6), z: p.z + Math.sin(a) * d, vy: R(3, 7), drag: 0.8, life: R(0.7, 1.2), s0: R(0.14, 0.26), s1: 0.05, cell: c.spark, mode: 2, stretch: 0.08, r: K.goldLight[0], g: K.goldLight[1], b: K.goldLight[2], r1: K.gold[0], g1: K.gold[1], b1: K.gold[2], a: 1, a1: 0, add: 1, delay: R(0, 0.35) });
    }
    for (let i = 0, n = count(5); i < n; i++) _.emit({ x: p.x, y: p.y + 0.4 + i * h * 0.18, z: p.z, vy: 1.5, life: 0.9, s0: r * 1.6, s1: r * 0.9, cell: c.glow, mode: 3, r: K.gold[0], g: K.gold[1], b: K.gold[2], a: 0.55, a1: 0, add: 1, delay: i * 0.05, aspect: 0.55 });
    for (let i = 0, n = count(10); i < n; i++) _.emit({ x: p.x + R(-r, r) * 0.6, y: p.y + R(0.5, h * 0.7), z: p.z + R(-r, r) * 0.6, vy: 0.6, life: R(0.5, 0.9), s0: 0.05, s1: 0.45, cell: c.star, a: 1, a1: 0, spin: R(-4, 4), curve: 2, delay: R(0.1, 0.5) });
  };
  /** Soin : une crêpe vole en cloche de p jusqu'à opts.to, étincelles vertes à l'arrivée. */
  B.crepe = function (p, o) {
    if (!ok()) return;
    ensureCells();
    const c = C(), K = _.COL;
    const to = o.to || tv[0].set(p.x, p.y, p.z + 3);
    const T = 0.55, g = 14;
    const vx = (to.x - p.x) / T, vz = (to.z - p.z) / T, vy = (to.y - p.y) / T + 0.5 * g * T;
    _.emit({ x: p.x, y: p.y, z: p.z, vx, vy, vz, grav: g, life: T, s0: 0.75, s1: 0.75, cell: c.crepe !== undefined ? c.crepe : c.coin, a: 1, a1: 1, fadeIn: 0.02, fadeOut: 0.98, spin: 9 });
    for (let i = 0; i < count(6); i++) _.emit({ x: p.x, y: p.y, z: p.z, vx: vx + R(-0.4, 0.4), vy: vy + R(-0.4, 0.4), vz: vz + R(-0.4, 0.4), grav: g, life: T, s0: 0.06, s1: 0.2, cell: c.twinkle, r: 1, g: 0.9, b: 0.6, a: 1, a1: 0, add: 1, delay: i * 0.03 });
    const green = col("#6dff7a");
    _.timed(T, () => {}, () => {
      for (let i = 0, n = count(14); i < n; i++) {
        const a = R(0, 6.28);
        _.emit({ x: to.x + Math.cos(a) * 0.4, y: to.y + R(-0.3, 0.5), z: to.z + Math.sin(a) * 0.4, vy: R(1, 2.4), drag: 1.5, life: R(0.6, 1), s0: 0.05, s1: R(0.28, 0.42), cell: rnd() < 0.5 ? c.twinkle : c.heart, r: green[0], g: green[1], b: green[2], a: 1, a1: 0, add: 0.6, curve: 2, spin: R(-3, 3) });
      }
      _.flash(to.x, to.y, to.z, 1.8, green, 0.25);
    });
    void K;
  };
  /** Air de biniou : cercle de notes qui tournent et montent. */
  B.notes = function (p, o) {
    if (!ok()) return;
    ensureCells();
    const c = C(), r = o.radius || 2.2;
    const cols = [col("#ffe45a"), col("#ff8adf"), col("#7fe8ff"), col("#ffffff")];
    for (let i = 0, n = count(12); i < n; i++) {
      const k = cols[i % cols.length];
      _.emit({ x: p.x, y: p.y + R(0.4, 1.2), z: p.z, vx: r * R(0.55, 0.95), vy: -r * 0.05, vz: R(2, 3), angle0: (i / 12) * 6.28, mode: 4, life: R(1.1, 1.5), s0: R(0.4, 0.55), s1: 0.35, cell: c.note !== undefined ? c.note : c.star, r: k[0], g: k[1], b: k[2], a: 1, a1: 0, fadeIn: 0.1, rot: R(-0.3, 0.3), grav: R(0.6, 1.1) });
    }
    _.ring(p.x, p.y, p.z, 0.3, r * 1.6, 0.7, col("#ffe45a"), 0.8, 0.5);
  };
  /** Fumigène : gros nuage gris qui gonfle et s'attarde. */
  B.smokeCloud = function (p, o) {
    if (!ok()) return;
    const c = C(), K = _.COL, r = o.radius || 1.5;
    for (let i = 0, n = count(18); i < n; i++) {
      const a = R(0, 6.28), sp = R(0.4, 1.8) * r;
      _.emit({ x: p.x + Math.cos(a) * 0.3, y: p.y + R(0.3, 1.4), z: p.z + Math.sin(a) * 0.3, vx: Math.cos(a) * sp, vy: R(0.2, 1.1), vz: Math.sin(a) * sp, drag: 2.2, life: R(1.6, 2.4), s0: 0.6 * r, s1: 1.8 * r, cell: rnd() < 0.5 ? c.puff : c.puffDark, r: K.smokeLight[0] * 1.2, g: K.smokeLight[1] * 1.2, b: K.smokeLight[2] * 1.25, a: 0.9, a1: 0, rot: R(0, 6), spin: R(-0.5, 0.5), curve: 1, fadeOut: 0.5 });
    }
  };
  /** Barrière du druide qui éclate : anneau bleu-vert, éclats de bulle. */
  B.barrierPop = function (p, o) {
    if (!ok()) return;
    const c = C(), r = o.radius || 1.1, k = col("#6ff0d8");
    _.flash(p.x, p.y, p.z, r * 2.4, k, 0.2);
    for (let i = 0, n = count(16); i < n; i++) {
      _.sphereDir(tv[0], 0.2);
      _.emit({ x: p.x + tv[0].x * r * 0.7, y: p.y + tv[0].y * r * 0.7, z: p.z + tv[0].z * r * 0.7, vx: tv[0].x * 4, vy: tv[0].y * 3 + 1, vz: tv[0].z * 4, grav: 6, life: R(0.4, 0.7), s0: R(0.18, 0.3), s1: 0.05, cell: c.shard, r: k[0], g: k[1], b: k[2], a: 1, a1: 0, add: 0.6, rot: R(0, 6), spin: R(-9, 9) });
    }
    _.emit({ x: p.x, y: p.y, z: p.z, life: 0.35, s0: r * 1.6, s1: r * 2.6, cell: c.bubble, r: k[0], g: k[1], b: k[2], a: 1, a1: 0, add: 0.4, curve: 1 });
  };
  /** Désarmé : éclats violets et bouclier brisé au-dessus de la tête. */
  B.disarm = function (p, o) {
    if (!ok()) return;
    ensureCells();
    const c = C(), k = col("#b48cff");
    _.emit({ x: p.x, y: p.y + 0.4, z: p.z, vy: 1.2, life: 0.9, s0: 0.4, s1: 0.75, cell: c.shieldBroken !== undefined ? c.shieldBroken : c.shield, a: 1, a1: 0, fadeOut: 0.7, curve: 2 });
    for (let i = 0, n = count(12); i < n; i++) {
      _.sphereDir(tv[0], 0.4);
      _.emit({ x: p.x, y: p.y, z: p.z, vx: tv[0].x * 3, vy: tv[0].y * 2 + 1.5, vz: tv[0].z * 3, grav: 5, life: R(0.4, 0.7), s0: 0.16, s1: 0.04, cell: c.spark, mode: 2, stretch: 0.05, r: k[0], g: k[1], b: k[2], a: 1, a1: 0, add: 1 });
    }
    void o;
  };
  /** Peur : « ! » rouge qui saute, gouttes de sueur. */
  B.fearPop = function (p, o) {
    if (!ok()) return;
    const c = C();
    _.emit({ x: p.x, y: p.y + 0.3, z: p.z, vy: 1.6, drag: 1.5, life: 0.8, s0: 0.3, s1: 0.7, cell: c.exclaim, a: 1, a1: 0, fadeOut: 0.7, curve: 2 });
    for (let i = 0; i < count(4); i++) _.emit({ x: p.x + R(-0.3, 0.3), y: p.y, z: p.z + R(-0.3, 0.3), vx: R(-1.5, 1.5), vy: R(1.5, 3), vz: R(-1.5, 1.5), grav: 9, life: 0.6, s0: 0.22, s1: 0.12, cell: c.sweat, a: 1, a1: 0.4 });
    void o;
  };
  /** Explosion d'un cadavre (dragon bleu) : souffle bleu électrique. */
  B.corpseBomb = function (p, o) {
    if (!ok()) return;
    const c = C(), r = o.radius || 2, k1 = col("#8fd8ff"), k2 = col("#3a5cff");
    _.flash(p.x, p.y + 0.5, p.z, r * 3, k1, 0.22);
    for (let i = 0, n = count(18); i < n; i++) {
      _.sphereDir(tv[0], 0.5);
      const sp = R(1.5, 3) * r;
      _.emit({ x: p.x, y: p.y + 0.5, z: p.z, vx: tv[0].x * sp, vy: Math.abs(tv[0].y) * sp * 0.6 + 1, vz: tv[0].z * sp, drag: 4.5, life: R(0.5, 0.8), s0: r * 0.4, s1: r * 0.9, cell: c.puff, r: k1[0], g: k1[1], b: k1[2], r1: k2[0], g1: k2[1], b1: k2[2], a: 1, a1: 0, add: 0.6, rot: R(0, 6), curve: 1, fadeOut: 0.5 });
    }
    _.ring(p.x, p.y, p.z, r * 0.3, r * 2.4, 0.45, k1, 1, 0.7);
    if (_.decal) _.decal(p.x, p.y, p.z, r * 1.6, c.scorch, [0.05, 0.08, 0.2], 0.4, 1.2);
    FX.shake = Math.max(FX.shake || 0, 0.4);
  };
  /** Reflets d'une gemme (volée, ramassée, revenue). */
  B.gemSparkle = function (p, o) {
    if (!ok()) return;
    const c = C(), k = GEMC[o.color | 0] || (GEMC[o.color | 0] = col(GEM[(o.color | 0) % GEM.length]));
    for (let i = 0, n = count(12); i < n; i++) {
      _.sphereDir(tv[0], 0.4);
      _.emit({ x: p.x + tv[0].x * 0.2, y: p.y + tv[0].y * 0.2, z: p.z + tv[0].z * 0.2, vx: tv[0].x * 2.2, vy: tv[0].y * 2 + 0.8, vz: tv[0].z * 2.2, drag: 3, life: R(0.4, 0.7), s0: 0.05, s1: R(0.3, 0.45), cell: c.twinkle, r: k[0], g: k[1], b: k[2], a: 1, a1: 0, add: 1, curve: 2, spin: R(-5, 5) });
    }
    _.flash(p.x, p.y, p.z, 1.4, k, 0.18);
  };
  /** Gemme perdue (emportée hors de la carte) : tourbillon qui s'efface. */
  B.gemLost = function (p, o) {
    if (!ok()) return;
    const c = C(), k = col(GEM[(o.color | 0) % GEM.length]);
    for (let i = 0, n = count(16); i < n; i++) _.emit({ x: p.x, y: p.y + R(0, 1), z: p.z, vx: R(0.4, 0.9), vy: -0.1, vz: R(3, 5), grav: R(0.4, 1.2), angle0: R(0, 6.28), mode: 4, life: R(0.6, 1), s0: 0.25, s1: 0.02, cell: c.twinkle, r: k[0], g: k[1], b: k[2], a: 1, a1: 0, add: 1 });
    _.emit({ x: p.x, y: p.y + 0.6, z: p.z, life: 0.5, s0: 0.5, s1: 1.4, cell: c.swirl, r: k[0], g: k[1], b: k[2], a: 0.9, a1: 0, add: 0.6, spin: 6, curve: 1 });
  };
  /** Traînée d'une gemme qui vole (appelée à chaque image le long de l'arc). */
  B.gemTrail = function (p, o) {
    if (!ok()) return;
    const c = C(), k = col(o.gold ? "#ffd23a" : GEM[(o.color | 0) % GEM.length]);
    _.emit({ x: p.x + R(-0.08, 0.08), y: p.y + R(-0.08, 0.08), z: p.z + R(-0.08, 0.08), vy: 0.3, life: R(0.35, 0.55), s0: R(0.14, 0.24), s1: 0.02, cell: rnd() < 0.5 ? c.twinkle : c.spark, r: k[0], g: k[1], b: k[2], a: 1, a1: 0, add: 1, spin: 4 });
  };
  /** Début de Frénésie sur une tour : anneau de flammes, étincelles. */
  B.frenzyTower = function (p, o) {
    if (!ok()) return;
    const c = C(), K = _.COL, r = o.radius || 1.3;
    _.ring(p.x, p.y, p.z, r * 0.4, r * 1.6, 0.5, K.fireYellow, 1, 0.8);
    for (let i = 0, n = count(10); i < n; i++) {
      const a = (i / 10) * 6.28;
      _.emit({ x: p.x + Math.cos(a) * r, y: p.y + 0.1, z: p.z + Math.sin(a) * r, vy: R(2, 3.5), life: R(0.4, 0.6), s0: R(0.35, 0.55), s1: 0.1, cell: c.flameB, mode: 3, r: K.fireOrange[0], g: K.fireOrange[1], b: K.fireOrange[2], r1: K.fireRed[0], g1: K.fireRed[1], b1: K.fireRed[2], a: 0.95, a1: 0, add: 0.8 });
    }
  };
  /** Vague qui entre : poussière soulevée à l'entrée. */
  B.waveDust = function (p, o) {
    if (!ok()) return;
    const c = C(), K = _.COL, r = o.radius || 1.5;
    for (let i = 0, n = count(10); i < n; i++) {
      const a = R(0, 6.28), sp = R(0.6, 1.8) * r;
      _.emit({ x: p.x, y: p.y + 0.2, z: p.z, vx: Math.cos(a) * sp, vy: R(0.4, 1.4), vz: Math.sin(a) * sp, drag: 2, life: R(0.9, 1.3), s0: 0.6 * r, s1: 1.4 * r, cell: c.puff, r: K.dust[0], g: K.dust[1], b: K.dust[2], a: 0.75, a1: 0, rot: R(0, 6), curve: 1 });
    }
  };
  /** Pataugeage (ennemi surpris par la marée) : rond dans l'eau et gouttes autour des pieds. */
  B.wadeSplash = function (p, o) {
    if (!ok()) return;
    const c = C(), K = _.COL, r = o.radius || 0.6;
    _.emit({ x: p.x, y: p.y + 0.02, z: p.z, life: 0.7, s0: 0.5 * r, s1: 2.4 * r, cell: c.ripple, mode: 1, r: 1, g: 1, b: 1, a: 0.75, a1: 0, curve: 1 });
    for (let i = 0, n = count(5); i < n; i++) {
      const a = R(0, 6.28), sp = R(0.8, 1.8) * r;
      _.emit({ x: p.x + Math.cos(a) * 0.15, y: p.y + 0.05, z: p.z + Math.sin(a) * 0.15, vx: Math.cos(a) * sp, vy: R(1.8, 3.2), vz: Math.sin(a) * sp, grav: 11, life: R(0.35, 0.55), s0: R(0.1, 0.16), s1: 0.06, cell: c.drop, mode: 2, stretch: 0.04, r: K.waterFoam[0], g: K.waterFoam[1], b: K.waterFoam[2], r1: K.waterLight[0], g1: K.waterLight[1], b1: K.waterLight[2], a: 1, a1: 0.3, floor: p.y });
    }
  };
  /** Esquive : petit nuage et tourbillon d'air. */
  B.dodge = function (p, o) {
    if (!ok()) return;
    const c = C();
    for (let i = 0, n = count(5); i < n; i++) _.emit({ x: p.x, y: p.y, z: p.z, vx: R(-1.5, 1.5), vy: R(0.3, 1), vz: R(-1.5, 1.5), drag: 3, life: 0.5, s0: 0.3, s1: 0.7, cell: c.puff, r: 1, g: 1, b: 1, a: 0.7, a1: 0, rot: R(0, 6), curve: 1 });
    _.emit({ x: p.x, y: p.y + 0.3, z: p.z, life: 0.45, s0: 0.8, s1: 1.2, cell: c.wind, mode: 3, r: 1, g: 1, b: 1, a: 0.9, a1: 0 });
    void o;
  };

  /* ------------------------------------------------------------------ effets suivis */
  /** Météore qui tombe du ciel sur la cible pendant « délai » secondes (l'impact vient de la simulation). */
  W.meteorFall = function (target, delay, radius) {
    if (!ok()) return { release() {} };
    const from = new THREE.Vector3(target.x - 16, target.y + 30, target.z - 10);
    const to = target.clone();
    let proj = null, tele = null;
    try {
      proj = FX.projectile ? FX.projectile("meteor") : null;
    } catch (e) {
      proj = null;
    }
    try {
      tele = FX.telegraph ? FX.telegraph("meteor", to, radius) : null;
    } catch (e) {
      tele = null;
    }
    const dir = to.clone().sub(from).normalize();
    const pos = new THREE.Vector3();
    const c = C(), K = _.COL;
    const e = _.timed(Math.max(0.2, delay), (k) => {
      const kk = k * k;
      pos.lerpVectors(from, to, kk);
      if (proj) proj.set(pos, dir);
      else {
        _.put(pos.x, pos.y, pos.z, 3.2, c.glow, K.fireOrange, 0.9, 0, 1);
        _.put(pos.x, pos.y, pos.z, 1.8, c.puff, K.fireYellow, 1, S().time * 4, 0.5);
      }
      if (tele && tele.update) tele.update(to, radius);
    }, () => {
      if (proj) proj.release();
      if (tele) tele.release();
    });
    return {
      release() {
        e.t = e.dur;
      },
    };
  };
  /** Aura de Frénésie d'une tour (à chaque image) : cercle de braises au sol et flammèches. */
  W.frenzyAura = function (p, time, radius) {
    if (!ok()) return;
    const c = C(), K = _.COL, r = radius || 1.5;
    const pulse = 0.8 + 0.2 * Math.sin(time * 9 + p.x);
    _.put(p.x, p.y + 0.06, p.z, r * 2.3 * pulse, c.ring, K.fireOrange, 0.75, time * 2, 0.8, 1);
    _.put(p.x, p.y + 0.05, p.z, r * 2.6, c.glow, K.fireRed, 0.35, 0, 1, 1);
    if (rnd() < S().dt * 12) {
      const a = R(0, 6.28);
      _.emit({ x: p.x + Math.cos(a) * r, y: p.y + 0.1, z: p.z + Math.sin(a) * r, vy: R(1.5, 3), life: R(0.35, 0.55), s0: 0.4, s1: 0.1, cell: c.flameB, mode: 3, r: K.fireYellow[0], g: K.fireYellow[1], b: K.fireYellow[2], r1: K.fireRed[0], g1: K.fireRed[1], b1: K.fireRed[2], a: 0.9, a1: 0, add: 0.8 });
    }
  };
  /** Gemme au sol (à chaque image) : anneau pulsé et halo à sa couleur, visibles de loin. */
  W.gemGlow = function (p, color, time) {
    if (!ok()) return;
    const c = C(), k = GEMC[color | 0] || (GEMC[color | 0] = col(GEM[(color | 0) % GEM.length]));
    const t = (time * 1.1 + color * 0.13) % 1;
    _.put(p.x, p.y + 0.05, p.z, 1.2 + t * 1.8, c.ring, k, 0.85 * (1 - t), 0, 0.6, 1);
    _.put(p.x, p.y + 0.04, p.z, 2.2, c.glow, k, 0.4, 0, 0.8, 1);
    _.put(p.x, p.y + 0.9, p.z, 1.3, c.glow, k, 0.35, 0, 1);
    if (rnd() < S().dt * 4) _.emit({ x: p.x + R(-0.4, 0.4), y: p.y + R(0.3, 1), z: p.z + R(-0.4, 0.4), vy: 0.4, life: 0.6, s0: 0.04, s1: 0.32, cell: c.twinkle, r: k[0], g: k[1], b: k[2], a: 1, a1: 0, add: 1, curve: 2, spin: 3 });
  };
  W.ensureCells = ensureCells;
})();
