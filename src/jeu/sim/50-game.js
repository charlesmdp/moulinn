// « Pas touche à mes trésors » — la partie (PTMT.sim.createGame), sans THREE.
//
// Règles de Cursed Treasure : les ennemis entrent par les routes, vont prendre une gemme dans une
// cachette et repartent vers la sortie la plus proche ; tué, un porteur lâche sa gemme sur place et
// les autres ennemis sans gemme foncent la chercher (plus court chemin, demi-tour compris) puis
// repartent avec. Les tours se posent sur leur terrain, gagnent de l'expérience, s'achètent niveau par
// niveau, se spécialisent au niveau 4 et évoluent au niveau 7. Chaque famille attaque à sa façon :
// le sanglier tire à la suite, le cygne lâche ses charges en rafale puis se recharge, le berger (puis
// dragon) crache un jet continu qui chauffe tant qu'il tient sa cible. Trois sorts payés en mana,
// compétences, vagues minutées qu'on peut appeler en avance. Partie perdue quand toutes les gemmes
// sont parties.
//
// Déplacement libre : chaque ennemi suit le champ d'écoulement de son but (PTMT.sim.Grid) en gardant
// sa voie dans la largeur de la route (au milieu ou le long d'un bord), s'écarte de ses voisins et
// contourne les buttes ; les nageurs passent par l'eau, les montgolfières volent en ligne droite.
//
// Pas fixe de 1/30 s (reproductible avec la graine), positions en cases continues (x vers la droite,
// y vers le bas), angles « monde » : 0 = vers +y, π/2 = vers +x (directement rotation.y en 3D).
(function () {
  "use strict";
  const PTMT = (globalThis.PTMT = globalThis.PTMT || {});
  const S = (PTMT.sim = PTMT.sim || {});
  const D = S.DATA;
  const TICK = D.tick;
  const FAR = S.Grid.FAR;
  const WINDUP = { boar: 0.12, swan: 0.1 };
  const RADIUS = 0.2; // marge entre un ennemi et le bord d'une case infranchissable
  const SEP = 0.5; // distance d'écartement entre deux ennemis

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const rank = (skills, id) => clamp(Math.floor((skills && skills[id]) || 0), 0, D.SKILL[id] ? D.SKILL[id].max : 0);
  const tmp = { x: 0, y: 0 };

  /** Effets chiffrés des compétences choisies. */
  S.skillMods = function (skills) {
    const pts = { boar: 0, swan: 0, dog: 0 };
    for (const s of D.SKILLS) pts[s.branch] += rank(skills, s.id);
    const r = (id) => rank(skills, id);
    const portal = r("returnPortal");
    return {
      points: pts,
      rate: 1 + D.BRANCHES.boar.perPoint.rate * pts.boar,
      range: 1 + D.BRANCHES.swan.perPoint.range * pts.swan,
      damage: 1 + D.BRANCHES.dog.perPoint.damage * pts.dog,
      goldStart: D.SKILL.goldVault.per * r("goldVault"),
      heights: D.SKILL.heights.per * r("heights"),
      cutCost: Math.max(0, D.SPELLS.cut.cost - D.SKILL.cutStudy.per * r("cutStudy")),
      cutGold: D.SKILL.sawmill.per * r("sawmill"),
      boarCrit: D.SKILL.marksman.per * r("marksman"),
      cost: { boar: 1 - D.SKILL.boarLord.per * r("boarLord"), swan: 1 - D.SKILL.swanLord.per * r("swanLord"), dog: 1 - D.SKILL.dogLord.per * r("dogLord") },
      gemsExtra: r("mining"),
      manaStart: D.SKILL.manaStock.per * r("manaStock"),
      manaMax: D.SKILL.manaPool.per * r("manaPool"),
      frenzyCost: Math.max(0, D.SPELLS.frenzy.cost - D.SKILL.frenzyStudy.per * r("frenzyStudy")),
      manaRegen: 1 + D.SKILL.manaSpring.per * r("manaSpring"),
      frenzyTime: D.SPELLS.frenzy.t + D.SKILL.frenzyLong.per * r("frenzyLong"),
      swanSlow: D.SKILL.coldWater.per * r("coldWater"),
      xp: 1 + D.SKILL.training.per * r("training"),
      hotGems: D.SKILL.hotGems.per * r("hotGems"),
      meteorCost: Math.max(0, D.SPELLS.meteor.cost - D.SKILL.meteorStudy.per * r("meteorStudy")),
      meteorDamage: 1 + D.SKILL.meteorMastery.per * r("meteorMastery"),
      portal: portal ? D.gems.returnBase - D.SKILL.returnPortal.per * (portal - 1) : 0,
      radiance: D.SKILL.radiance.per * r("radiance"),
    };
  };

  class Game {
    constructor(opts) {
      opts = opts || {};
      const level = opts.level || 1;
      const map = opts.map || S.MAPS[level];
      if (!map) throw new Error("Mission inconnue : " + level);
      this.def = map;
      this.skills = Object.assign({}, opts.skills || {});
      this.mods = S.skillMods(this.skills);
      this.rnd = PTMT.rng((opts.seed || 1) * 7919 + level);
      this.grid = new S.Grid(map);
      this.waves = S.buildWaves(level, this.grid.entrances);
      this.events = [];
      this.nextId = 1;
      this.acc = 0;
      this.spawnQueue = [];
      this.waveClock = 0;
      this.meteors = [];
      this.seen = new Set();
      this.gemsDirty = true;
      this.tideCycle = map.tide ? map.tide.cycle || 3 : 0;
      this.buckets = new Array(D.W * D.H);
      for (let k = 0; k < this.buckets.length; k++) this.buckets[k] = [];
      const m = this.mods;
      const manaMax = D.mana.max + m.manaMax;
      const g = this.grid;
      const lairs = g.lairs.map((L) => ({ id: L.id, name: L.name, style: L.style, mill: L.mill, tiles: L.tiles.map((t) => t.slice()), x: L.x, y: L.y, total: L.gems, stock: L.gems }));
      lairs[0].total += m.gemsExtra;
      lairs[0].stock += m.gemsExtra;
      const gemsTotal = lairs.reduce((a, L) => a + L.total, 0);
      this.state = {
        level,
        map: {
          id: map.id,
          name: map.name,
          ct: map.ct,
          w: D.W,
          h: D.H,
          grid: g.lines(),
          entrances: g.entrances.map((e) => ({ id: e.id, letter: e.letter, color: e.color, tiles: e.tiles.map((t) => t.slice()), x: e.x, y: e.y, dir: e.dir, open: e.open, opensAt: e.opensAt })),
          lairs,
          biome: map.biome,
          mill: map.mill,
          mana: map.mana || [],
          decor: map.decor || {},
          secretWave: map.secretWave || 0,
          version: 0,
        },
        time: 0,
        speed: 1,
        paused: false,
        over: null,
        gold: map.gold + m.goldStart,
        mana: Math.min(manaMax, D.mana.start + m.manaStart),
        manaMax,
        manaRegen: 0,
        tide: this.tideCycle ? "high" : null,
        gems: [],
        gemCount: { total: gemsTotal, lair: gemsTotal, ground: 0, carried: 0, lost: 0 },
        wave: { index: -1, total: this.waves.length, countdown: D.economy.firstWaveDelay, running: false, nextEntrances: [], spawning: false },
        towers: [],
        enemies: [],
        projectiles: [],
        areas: [],
        spells: {},
        frenzy: false,
        frenzyLeft: 0,
        stats: { kills: 0, goldEarned: 0, escaped: 0 },
      };
      let gid = 0;
      for (const L of lairs)
        for (let k = 0; k < L.total; k++) this.state.gems.push({ id: ++gid, color: (gid - 1) % D.GEM_COLORS.length, lair: L.id, slot: k, where: "lair", x: L.x, y: L.y, carrier: null, returnIn: 0 });
      this.refreshWavePreview();
      this.refreshSpells();
    }

    /* ------------------------------------------------------------ outils */
    emit(type, data) {
      // Le nom de l'événement passe en dernier : un champ « type » des données ne peut pas l'écraser.
      const e = Object.assign({}, data, { type });
      this.events.push(e);
      return e;
    }
    drainEvents() {
      const out = this.events;
      this.events = [];
      return out;
    }
    towerById(id) {
      return this.state.towers.find((t) => t.id === id) || null;
    }
    enemyById(id) {
      return this.state.enemies.find((e) => e.id === id) || null;
    }
    towerAt(i, j) {
      return this.state.towers.find((t) => t.i === i && t.j === j) || null;
    }
    lairById(id) {
      return this.state.map.lairs[id] || null;
    }
    costFor(family, level, spec) {
      const lv = D.towerLevel(family, level, spec);
      return lv ? Math.round(lv.cost * this.mods.cost[family]) : null;
    }

    /* ------------------------------------------------------------ requêtes */
    tileInfo(i, j) {
      const g = this.grid;
      if (!g.inside(i, j)) return null;
      const c = g.char(i, j);
      const t = g.tile(i, j);
      const tower = this.towerAt(i, j);
      const buildable = t.build && !tower ? t.build.slice() : [];
      return {
        i,
        j,
        char: c,
        terrain: t.terrain,
        forest: !!t.forest,
        cuttable: !!t.cutTo,
        high: !!t.high,
        mana: g.mana.has(j * g.w + i),
        road: !!t.walk || (!!t.tide && g.lowTide),
        towerId: tower ? tower.id : null,
        buildable,
        costs: Object.fromEntries(buildable.map((f) => [f, this.costFor(f, 1)])),
        cutCost: this.mods.cutCost,
      };
    }
    canBuild(i, j, family) {
      const info = this.tileInfo(i, j);
      if (!info) return { ok: false, reason: "Hors de la carte" };
      if (info.towerId) return { ok: false, reason: "Il y a déjà une tour ici" };
      if (info.forest) return { ok: false, reason: "Case boisée : utilise d'abord le sort Couper" };
      if (!info.buildable.length) return { ok: false, reason: "On ne construit pas sur " + (D.TERRAIN_NAMES[info.terrain] || "cette case").toLowerCase() };
      if (!info.buildable.includes(family)) {
        const need = D.FAMILIES[family].terrain;
        return { ok: false, reason: D.FAMILIES[family].name + " : seulement sur " + D.TERRAIN_NAMES[need].toLowerCase() + " (ou une butte)" };
      }
      const cost = this.costFor(family, 1);
      if (this.state.gold < cost) return { ok: false, reason: "Pas assez d'or", cost };
      return { ok: true, cost };
    }
    /** Statistiques effectives d'une tour à un niveau donné (bonus de terrain et de compétences). */
    statsFor(t, level, spec) {
      const base = D.towerLevel(t.family, level, spec);
      if (!base) return null;
      const m = this.mods;
      const high = t.high ? 1 : 0;
      const st = Object.assign({}, base);
      const dmgMul = m.damage * (1 + high * (D.high.damage + m.heights));
      if (base.dmg) st.dmg = base.dmg * dmgMul;
      if (base.dps) st.dps = base.dps * dmgMul * m.rate;
      st.range = base.range * m.range * (1 + high * D.high.range);
      if (base.rate) st.rate = base.rate * m.rate;
      if (base.reload) st.reload = base.reload / m.rate;
      if (t.family === "boar" && m.boarCrit > 0) st.crit = { chance: (base.crit ? base.crit.chance : 0) + m.boarCrit, mult: base.crit ? base.crit.mult : 2 };
      if (t.family === "swan" && base.slow) st.slow = { pct: Math.min(D.status.slowCap, base.slow.pct + m.swanSlow), t: base.slow.t };
      if (base.radiance) st.radiance = { pct: base.radiance.pct + m.radiance, t: base.radiance.t };
      return st;
    }
    towerInfo(id) {
      const t = this.towerById(id);
      if (!t) return null;
      const cur = this.statsFor(t, t.level, t.spec);
      const xpNeed = t.level < 7 ? D.XP[t.level] : null;
      const out = {
        id: t.id,
        family: t.family,
        level: t.level,
        spec: t.spec,
        attack: cur.attack,
        name: cur.name,
        familyName: D.FAMILIES[t.family].name,
        specName: t.spec ? D.FAMILIES[t.family].specs[t.spec].name : null,
        stats: cur,
        xp: Math.floor(t.xp),
        xpNext: xpNeed,
        kills: t.kills,
        high: t.high,
        onMana: t.onMana,
        sell: Math.floor(t.invested * D.economy.sellRatio),
        next: null,
        specs: null,
      };
      if (t.level === 3) {
        out.specs = {};
        for (const sp of ["A", "B"]) {
          const st = this.statsFor(t, 4, sp);
          out.specs[sp] = { spec: sp, name: D.FAMILIES[t.family].specs[sp].name, blurb: D.FAMILIES[t.family].specs[sp].blurb, cost: this.costFor(t.family, 4, sp), stats: st, check: this.checkUpgrade(t, sp) };
        }
      } else if (t.level < 7) {
        const st = this.statsFor(t, t.level + 1, t.spec);
        out.next = { level: t.level + 1, name: st.name, cost: this.costFor(t.family, t.level + 1, t.spec), stats: st, check: this.checkUpgrade(t, t.spec) };
      }
      return out;
    }
    checkUpgrade(t, spec) {
      if (t.level >= 7) return { ok: false, reason: "Niveau maximum" };
      const sp = t.level >= 4 ? t.spec : spec;
      if (t.level === 3 && sp !== "A" && sp !== "B") return { ok: false, reason: "Choisis une spécialisation" };
      const need = D.XP[t.level];
      if (t.xp < need) return { ok: false, reason: "Expérience insuffisante (" + Math.floor(t.xp) + " / " + need + ")", xp: true };
      const cost = this.costFor(t.family, t.level + 1, sp);
      if (this.state.gold < cost) return { ok: false, reason: "Pas assez d'or", cost };
      return { ok: true, cost };
    }
    /** Tours qu'on peut améliorer tout de suite (pour les flèches dorées). */
    upgradeable() {
      const out = [];
      for (const t of this.state.towers) {
        if (t.level >= 7) continue;
        if (t.level === 3 ? this.checkUpgrade(t, "A").ok || this.checkUpgrade(t, "B").ok : this.checkUpgrade(t, t.spec).ok) out.push(t.id);
      }
      return out;
    }
    /** Groupes d'une vague, regroupés par type, rang et entrée (aperçus). */
    waveGroups(k) {
      const wave = this.waves[k];
      const groups = new Map();
      const ents = this.state.map.entrances;
      for (const g of wave.groups) {
        const key = g.type + (g.boss ? ":b" : g.champion ? ":c" : "") + "@" + g.entrance;
        const e = ents[g.entrance] || ents[0];
        const ab = D.ENEMIES[g.type].ability;
        const cur = groups.get(key) || { type: g.type, champion: !!g.champion, boss: !!g.boss, count: 0, name: g.boss ? D.BOSS_NAMES[g.type] : null, entrance: e.id, letter: e.letter, color: e.color, flying: !!(ab && ab.kind === "fly"), swims: !!(ab && ab.kind === "swim") };
        cur.count += g.count;
        groups.set(key, cur);
      }
      return [...groups.values()];
    }
    /** Ce qui change sur la carte au début de la vague k (barrière, marée, passage secret). */
    waveNotes(k) {
      const notes = [];
      for (const e of this.state.map.entrances) if (!e.open && e.opensAt === k + 1) notes.push({ kind: "gate", entrance: e.id, letter: e.letter });
      if (this.tideCycle) {
        const low = Math.floor(k / this.tideCycle) % 2 === 1;
        const prev = k > 0 ? Math.floor((k - 1) / this.tideCycle) % 2 === 1 : false;
        if (low !== prev) notes.push({ kind: low ? "tideLow" : "tideHigh" });
      }
      if (this.state.map.secretWave && k + 1 === this.state.map.secretWave) notes.push({ kind: "secret" });
      return notes;
    }
    nextWave() {
      const w = this.state.wave;
      const k = w.index + 1;
      if (k >= this.waves.length) return null;
      const groups = this.waveGroups(k);
      return { index: k, total: this.waves.length, countdown: w.countdown, groups, entrances: [...new Set(groups.map((g) => g.entrance))], notes: this.waveNotes(k) };
    }
    /** Les n prochaines vagues (frise) : délai estimé, groupes, entrées, surprises annoncées. */
    upcoming(n) {
      const s = this.state;
      const out = [];
      const gap = s.level >= 8 ? D.economy.waveGapLate : D.economy.waveGap;
      for (let k = s.wave.index + 1, c = 0; k < this.waves.length && c < (n || 5); k++, c++) {
        const groups = this.waveGroups(k);
        out.push({ index: k, startsIn: Math.max(0, s.wave.countdown) + c * gap, groups, entrances: [...new Set(groups.map((g) => g.entrance))], notes: this.waveNotes(k) });
      }
      return out;
    }
    describeEnemy(type) {
      const e = D.ENEMIES[type];
      return e ? { type, name: e.name, role: e.ct, hp: e.hp, speed: e.speed, gold: e.gold, ability: e.ability, blurb: e.blurb } : null;
    }
    /** Fiche d'un ennemi en jeu (toucher un ennemi). */
    enemyInfo(id) {
      const e = this.enemyById(id);
      if (!e) return null;
      const def = D.ENEMIES[e.type];
      return { id: e.id, type: e.type, name: e.name, role: def.ct, champion: e.champion, boss: e.boss, hp: e.hp, hpMax: e.hpMax, barrier: e.barrier, barrierMax: e.barrierMax, shield: e.shield, speed: e.speed, carrying: e.carrying, blurb: def.blurb, fx: Object.assign({}, e.fx) };
    }
    refreshWavePreview() {
      const n = this.nextWave();
      this.state.wave.nextEntrances = n ? n.entrances : [];
    }
    refreshSpells() {
      const s = this.state;
      const costs = { cut: this.mods.cutCost, frenzy: this.mods.frenzyCost, meteor: this.mods.meteorCost };
      for (const k of Object.keys(D.SPELLS)) {
        const unlocked = this.def.spells.includes(k);
        const cur = s.spells[k] || (s.spells[k] = {});
        cur.cost = costs[k];
        cur.unlocked = unlocked;
        cur.ready = unlocked && s.mana >= costs[k] && !s.over;
        cur.active = k === "frenzy" ? s.frenzy : false;
        cur.left = k === "frenzy" ? s.frenzyLeft : 0;
      }
    }

    /* ------------------------------------------------------------ commandes */
    build(i, j, family) {
      const chk = this.canBuild(i, j, family);
      if (!chk.ok) return chk;
      const g = this.grid;
      const t = {
        id: this.nextId++,
        family,
        level: 1,
        spec: null,
        i,
        j,
        x: i + 0.5,
        y: j + 0.5,
        high: !!g.tile(i, j).high,
        onMana: g.mana.has(j * g.w + i),
        invested: chk.cost,
        xp: 0,
        kills: 0,
        aim: 0,
        charge: 0.6,
        windup: 0,
        windTargets: null,
        targetId: null,
        shots: 0,
        attack: D.FAMILIES[family].attack,
        ammo: 0,
        ammoMax: 0,
        burstCd: 0,
        beams: [],
        dazzled: 0,
      };
      this.restat(t);
      t.ammo = t.ammoMax;
      this.state.gold -= chk.cost;
      this.state.towers.push(t);
      this.emit("build", { towerId: t.id, family, i, j, cost: chk.cost });
      return { ok: true, towerId: t.id, cost: chk.cost };
    }
    restat(t) {
      t.st = this.statsFor(t, t.level, t.spec);
      t.range = t.st.range;
      t.ammoMax = t.st.charges || 0;
      t.ammo = Math.min(t.ammo, t.ammoMax);
    }
    upgrade(id, spec) {
      const t = this.towerById(id);
      if (!t) return { ok: false, reason: "Tour introuvable" };
      const chk = this.checkUpgrade(t, spec);
      if (!chk.ok) return chk;
      if (t.level === 3) t.spec = spec;
      t.level++;
      this.restat(t);
      t.invested += chk.cost;
      this.state.gold -= chk.cost;
      this.emit("upgrade", { towerId: t.id, level: t.level, spec: t.spec, cost: chk.cost });
      return { ok: true, level: t.level, spec: t.spec, cost: chk.cost };
    }
    sell(id) {
      const t = this.towerById(id);
      if (!t) return { ok: false, reason: "Tour introuvable" };
      const gold = Math.floor(t.invested * D.economy.sellRatio);
      this.stopBeams(t);
      this.state.gold += gold;
      this.state.towers.splice(this.state.towers.indexOf(t), 1);
      this.emit("sell", { towerId: t.id, gold, i: t.i, j: t.j });
      return { ok: true, gold };
    }
    cast(spell, at) {
      const s = this.state;
      const sp = s.spells[spell];
      if (!sp || !sp.unlocked) return { ok: false, reason: "Sort indisponible dans cette mission" };
      if (s.over) return { ok: false, reason: "Partie terminée" };
      if (s.mana < sp.cost) return { ok: false, reason: "Pas assez de mana" };
      if (spell === "cut") {
        const i = Math.floor(at.x),
          j = Math.floor(at.y);
        const t = this.grid.tile(i, j);
        if (!this.grid.inside(i, j) || !t.cutTo) return { ok: false, reason: "Rien à couper ici" };
        this.grid.set(i, j, t.cutTo);
        this.mapChanged();
        s.mana -= sp.cost;
        s.gold += this.mods.cutGold;
        this.emit("cast", { spell, x: i + 0.5, y: j + 0.5 });
        this.emit("cut", { i, j, gold: this.mods.cutGold });
      } else if (spell === "frenzy") {
        s.mana -= sp.cost;
        s.frenzy = true;
        s.frenzyLeft = this.mods.frenzyTime;
        this.emit("cast", { spell });
        this.emit("frenzy", { on: true, t: s.frenzyLeft });
      } else if (spell === "meteor") {
        const M = D.SPELLS.meteor;
        const x = clamp(at.x, 0, D.W),
          y = clamp(at.y, 0, D.H);
        s.mana -= sp.cost;
        const area = { id: this.nextId++, kind: "meteorWarn", x, y, r: M.r, t: 0, life: M.delay };
        s.areas.push(area);
        this.meteors.push({ x, y, left: M.delay, area });
        this.emit("cast", { spell, x, y, r: M.r, delay: M.delay });
      } else return { ok: false, reason: "Sort inconnu" };
      this.refreshSpells();
      return { ok: true };
    }
    callWave() {
      const w = this.state.wave;
      if (w.index + 1 >= this.waves.length) return { ok: false, reason: "Plus de vague à appeler" };
      const bonus = Math.max(0, Math.floor(w.countdown * D.economy.earlyCallGoldPerSecond));
      this.state.gold += bonus;
      this.startWave(w.index + 1);
      if (bonus) this.emit("earlyBonus", { gold: bonus });
      return { ok: true, bonus };
    }
    setSpeed(v) {
      this.state.speed = [1, 2, 3].includes(v) ? v : 1;
    }
    setPaused(p) {
      this.state.paused = !!p;
    }

    /* ------------------------------------------------------------ déroulement */
    step(dt) {
      const s = this.state;
      if (s.paused || s.over) return;
      this.acc += Math.min(dt, 0.25) * s.speed;
      let n = 0;
      while (this.acc >= TICK && n < 12) {
        this.tick(TICK);
        this.acc -= TICK;
        n++;
        if (s.over) break;
      }
      if (n >= 12) this.acc = 0;
    }
    tick(dt) {
      const s = this.state;
      s.time += dt;
      this.tickWaves(dt);
      this.tickMana(dt);
      this.tickSpells(dt);
      this.fillBuckets();
      for (const e of s.enemies) this.tickEnemy(e, dt);
      this.tickTowers(dt);
      this.tickProjectiles(dt);
      this.tickGems(dt);
      if (s.enemies.some((e) => e.dead)) s.enemies = s.enemies.filter((e) => !e.dead);
      if (this.gemsDirty) this.countGems();
      this.refreshSpells();
      this.checkEnd();
    }
    startWave(k) {
      const s = this.state;
      const wave = this.waves[k];
      s.wave.index = k;
      s.wave.running = true;
      s.wave.spawning = true;
      s.wave.countdown = k < this.waves.length - 1 ? (s.level >= 8 ? D.economy.waveGapLate : D.economy.waveGap) : 0;
      // Ce qui change sur la carte avant que les ennemis entrent : barrières, marée, passage secret.
      for (const e of this.grid.entrances) if (!e.open && e.opensAt === k + 1) this.openGate(e);
      if (this.tideCycle) this.setTide(Math.floor(k / this.tideCycle) % 2 === 1);
      if (s.map.secretWave && k + 1 === s.map.secretWave) this.openSecret();
      const t0 = this.waveClock;
      for (const sp of wave.spawns) this.spawnQueue.push(Object.assign({ at: t0 + sp.t }, sp));
      this.spawnQueue.sort((a, b) => a.at - b.at);
      this.emit("waveStart", { index: k, total: this.waves.length });
      this.refreshWavePreview();
    }
    tickWaves(dt) {
      const s = this.state;
      this.waveClock += dt;
      if (s.wave.index + 1 < this.waves.length) {
        s.wave.countdown -= dt;
        if (s.wave.countdown <= 0) this.startWave(s.wave.index + 1);
      } else s.wave.countdown = 0;
      while (this.spawnQueue.length && this.spawnQueue[0].at <= this.waveClock) this.spawn(this.spawnQueue.shift());
      s.wave.spawning = this.spawnQueue.length > 0;
    }
    openSecret() {
      const g = this.grid;
      let any = false;
      for (let j = 0; j < g.h; j++)
        for (let i = 0; i < g.w; i++)
          if (g.char(i, j) === "s") {
            g.rows[j][i] = "#";
            any = true;
          }
      if (!any) return;
      g.touch();
      this.mapChanged();
      this.emit("secretOpen", {});
      this.retargetAll();
    }
    openGate(ent) {
      const g = this.grid;
      for (const [i, j] of ent.tiles) g.rows[j][i] = "E";
      ent.open = true;
      g.touch();
      const se = this.state.map.entrances[ent.id];
      se.open = true;
      this.mapChanged();
      this.emit("gateOpen", { entranceId: ent.id, letter: ent.letter });
      this.retargetAll();
    }
    setTide(low) {
      if (!this.grid.setTide(low)) return;
      this.state.tide = low ? "low" : "high";
      this.mapChanged();
      this.emit("tide", { state: this.state.tide });
      this.retargetAll();
    }
    retargetAll() {
      for (const e of this.state.enemies) e.retarget = true;
    }
    mapChanged() {
      this.state.map.grid = this.grid.lines();
      this.state.map.version++;
    }
    tickMana(dt) {
      const s = this.state;
      let regen = D.mana.regen * this.mods.manaRegen;
      for (const t of s.towers) if (t.onMana) regen += D.mana.perManaTower;
      s.manaRegen = regen;
      s.mana = Math.min(s.manaMax, s.mana + regen * dt);
    }
    tickSpells(dt) {
      const s = this.state;
      if (s.frenzy) {
        s.frenzyLeft -= dt;
        if (s.frenzyLeft <= 0) {
          s.frenzy = false;
          s.frenzyLeft = 0;
          this.emit("frenzy", { on: false });
        }
      }
      for (let k = this.meteors.length - 1; k >= 0; k--) {
        const m = this.meteors[k];
        m.left -= dt;
        m.area.t = clamp(1 - m.left / m.area.life, 0, 1);
        if (m.left > 0) continue;
        this.meteors.splice(k, 1);
        s.areas.splice(s.areas.indexOf(m.area), 1);
        const M = D.SPELLS.meteor;
        const dmg = M.dmg * this.mods.meteorDamage;
        this.emit("meteorImpact", { x: m.x, y: m.y, r: M.r });
        for (const e of s.enemies) {
          if (e.dead) continue;
          if ((e.x - m.x) ** 2 + (e.y - m.y) ** 2 <= M.r * M.r) this.hurt(e, dmg, { pierce: true, area: true, kind: "meteor" });
        }
      }
    }

    /* ------------------------------------------------------------ ennemis */
    spawn(sp, at) {
      const s = this.state;
      const def = D.ENEMIES[sp.type];
      const g = this.grid;
      let ent = g.entrances[sp.entrance] || g.entrances[0];
      if (!ent.open) ent = g.openEntrances()[0];
      let hp = def.hp * sp.hpMul;
      let gold = def.gold * (0.85 + 0.15 * Math.min(sp.hpMul, 5)),
        xp = def.xp;
      if (sp.champion) {
        hp *= D.champion.hp;
        gold *= D.champion.gold;
        xp *= D.champion.xp;
      }
      if (sp.boss) {
        hp *= D.boss.hp;
        gold *= D.boss.gold;
        xp *= D.boss.xp;
      }
      const ab = def.ability || {};
      const flying = ab.kind === "fly";
      // Position d'entrée : une case au hasard de l'entrée (route large), décalée dans la case.
      let x, y;
      if (at) {
        x = at.x;
        y = at.y;
      } else if (flying) {
        x = ent.x - Math.sin(ent.dir) * 0.4;
        y = ent.y - Math.cos(ent.dir) * 0.4;
      } else {
        const [ti, tj] = ent.tiles[Math.floor(this.rnd() * ent.tiles.length) % ent.tiles.length];
        x = ti + 0.25 + this.rnd() * 0.5;
        y = tj + 0.25 + this.rnd() * 0.5;
      }
      // Voie : certains longent les bords, d'autres tiennent le milieu, d'autres zigzaguent.
      const persona = this.rnd();
      const lane = persona < 0.4 ? (this.rnd() < 0.5 ? -1 : 1) * (0.65 + this.rnd() * 0.35) : persona < 0.8 ? (this.rnd() - 0.5) * 0.6 : (this.rnd() - 0.5) * 2;
      const e = {
        id: this.nextId++,
        type: sp.type,
        champion: !!sp.champion,
        boss: !!sp.boss,
        name: sp.boss ? D.BOSS_NAMES[sp.type] : def.name,
        x,
        y,
        vx: 0,
        vy: 0,
        dir: ent.dir,
        hp,
        hpMax: hp,
        hpMul: sp.hpMul,
        barrier: 0,
        barrierMax: 0,
        shield: 0,
        baseSpeed: def.speed,
        speed: def.speed,
        moving: true,
        gold: Math.round(gold),
        xp,
        ability: ab.kind || null,
        swim: ab.kind === "swim",
        flying,
        alt: flying ? D.fly.alt : 0,
        mode: ab.kind === "swim" ? "swim" : "walk",
        water: false,
        lane,
        laneGoal: lane,
        laneWander: persona >= 0.8,
        laneT: 2 + this.rnd() * 4,
        goal: "lair",
        target: null,
        tx: 0,
        ty: 0,
        field: null,
        fieldVersion: -1,
        carrying: null,
        retarget: true,
        distLeft: FAR,
        fx: { slow: 0, fear: false, freeze: false, burn: false, radiance: false, haste: false, invisible: 0, stun: false, disarmed: false, wading: false },
        t: { slow: 0, slowPct: 0, fear: 0, freeze: 0, freezeImm: 0, stun: 0, stunImm: 0, burn: 0, burnDps: 0, burnSrc: null, rad: 0, radPct: 0, radSrc: null, haste: 0, hasteMult: 1, invis: 0, ability: 0, blink: 0, lastHit: -99, stuck: 0, unstick: 0 },
        smokeUsed: false,
        dead: false,
      };
      if (ab.kind === "shield") e.shield = sp.champion ? D.champion.shield : ab.value;
      if (ab.kind === "split") e.shield = ab.shield + (sp.champion ? 3 : 0);
      if (ab.kind === "barrier") e.barrier = e.barrierMax = (sp.champion ? D.champion.barrier : ab.value) * (sp.boss ? 1.5 : 1);
      if (ab.kind === "heal" || ab.kind === "haste" || ab.kind === "flash") e.t.ability = ab.every * (0.4 + 0.3 * this.rnd());
      s.enemies.push(e);
      this.emit("spawn", { enemyId: e.id, enemyType: e.type, champion: e.champion, boss: e.boss, entrance: ent.id, flying, x, y });
      if (!this.seen.has(e.type)) {
        this.seen.add(e.type);
        this.emit("newEnemy", { enemyType: e.type });
      }
      if (e.boss) this.emit("bossArrives", { enemyId: e.id, enemyType: e.type, name: e.name });
      return e;
    }
    /** Seaux par case (écartement entre voisins, peloton). */
    fillBuckets() {
      const B = this.buckets;
      for (const b of B) b.length = 0;
      for (const e of this.state.enemies) {
        if (e.dead || e.flying) continue;
        const i = Math.floor(e.x),
          j = Math.floor(e.y);
        if (i < 0 || j < 0 || i >= D.W || j >= D.H) continue;
        B[j * D.W + i].push(e);
      }
    }
    neighbors(e, r, fn) {
      const i0 = Math.floor(e.x),
        j0 = Math.floor(e.y);
      const reach = Math.ceil(r);
      for (let j = j0 - reach; j <= j0 + reach; j++)
        for (let i = i0 - reach; i <= i0 + reach; i++) {
          if (i < 0 || j < 0 || i >= D.W || j >= D.H) continue;
          for (const o of this.buckets[j * D.W + i]) {
            if (o === e || o.dead) continue;
            const d2 = (o.x - e.x) ** 2 + (o.y - e.y) ** 2;
            if (d2 <= r * r) fn(o, d2);
          }
        }
    }
    /** Sources de gemmes disponibles : cachettes non vides et gemmes au sol. */
    sources() {
      const out = [];
      for (const L of this.state.map.lairs) if (L.stock > 0) out.push({ kind: "lair", id: L.id, x: L.x, y: L.y });
      for (const gem of this.state.gems) if (gem.where === "ground") out.push({ kind: "gem", id: gem.id, x: gem.x, y: gem.y });
      return out;
    }
    /** Point de sortie d'une montgolfière : le bord de la carte le plus proche, un peu au-delà. */
    exitPoint(x, y) {
      const c = [
        [x, -0.6, y],
        [x, D.H + 0.6, D.H - y],
        [-0.6, y, x],
        [D.W + 0.6, y, D.W - x],
      ].sort((a, b) => a[2] - b[2])[0];
      return { x: c[0], y: c[1] };
    }
    /** Choisit le but : gemme la plus proche en distance de chemin (cachette ou sol), ou la sortie. */
    chooseGoal(e) {
      const g = this.grid;
      e.retarget = false;
      e.fieldVersion = g.version;
      if (e.flying) {
        if (e.carrying) {
          const p = this.exitPoint(e.x, e.y);
          e.goal = "exit";
          e.target = null;
          e.tx = p.x;
          e.ty = p.y;
          return;
        }
        let best = null,
          bestD = FAR;
        for (const src of this.sources()) {
          const d = Math.hypot(src.x - e.x, src.y - e.y);
          if (d < bestD) {
            bestD = d;
            best = src;
          }
        }
        if (!best) {
          const p = this.exitPoint(e.x, e.y);
          e.goal = "exit";
          e.target = null;
          e.tx = p.x;
          e.ty = p.y;
        } else {
          e.goal = best.kind;
          e.target = best.id;
          e.tx = best.x;
          e.ty = best.y;
        }
        return;
      }
      const mode = e.mode;
      let ci = Math.floor(e.x),
        cj = Math.floor(e.y);
      if (!g.passable(ci, cj, mode)) {
        const p = g.nearestPassable(e.x, e.y, mode);
        if (p) {
          ci = Math.floor(p[0]);
          cj = Math.floor(p[1]);
        }
      }
      if (e.carrying) {
        e.goal = "exit";
        e.target = null;
        e.field = g.toExit(mode);
        return;
      }
      let best = null,
        bestD = FAR,
        bestF = null;
      for (const src of this.sources()) {
        const f = src.kind === "lair" ? g.toLair(src.id, mode) : g.toTile(Math.floor(src.x), Math.floor(src.y), mode);
        const d = g.at(f, ci, cj);
        if (d < bestD) {
          bestD = d;
          best = src;
          bestF = f;
        }
      }
      if (!best) {
        e.goal = "exit";
        e.target = null;
        e.field = g.toExit(mode);
      } else {
        e.goal = best.kind;
        e.target = best.id;
        e.field = bestF;
      }
    }
    tickEnemy(e, dt) {
      if (e.dead) return;
      const T = e.t;
      const fx = e.fx;
      // Minuteries d'effets
      T.slow = Math.max(0, T.slow - dt);
      T.fear = Math.max(0, T.fear - dt);
      T.freeze = Math.max(0, T.freeze - dt);
      T.freezeImm = Math.max(0, T.freezeImm - dt);
      T.stun = Math.max(0, T.stun - dt);
      T.stunImm = Math.max(0, T.stunImm - dt);
      T.haste = Math.max(0, T.haste - dt);
      T.invis = Math.max(0, T.invis - dt);
      T.rad = Math.max(0, T.rad - dt);
      T.blink = Math.max(0, T.blink - dt);
      fx.slow = T.slow > 0 ? T.slowPct : 0;
      fx.fear = T.fear > 0;
      fx.freeze = T.freeze > 0;
      fx.stun = T.stun > 0;
      fx.haste = T.haste > 0;
      fx.invisible = T.invis > 0 ? Math.min(1, T.invis / 0.4) : 0;
      fx.radiance = T.rad > 0;
      // Brûlure et trésor brûlant
      if (T.burn > 0) {
        T.burn = Math.max(0, T.burn - dt);
        fx.burn = true;
        this.hurt(e, T.burnDps * dt, { pierce: true, dot: true, towerId: T.burnSrc, kind: "burn" });
        if (e.dead) return;
      } else fx.burn = false;
      if (e.carrying && this.mods.hotGems > 0) {
        this.hurt(e, e.hpMax * this.mods.hotGems * dt, { pierce: true, dot: true, kind: "hotGems" });
        if (e.dead) return;
      }
      // Capacités
      this.tickAbility(e, dt);
      // Déplacement
      if (e.retarget || (!e.flying && e.fieldVersion !== this.grid.version)) this.chooseGoal(e);
      const stopped = fx.freeze || fx.stun;
      let speed = e.baseSpeed * (1 - fx.slow);
      if (fx.haste) speed *= T.hasteMult;
      if (fx.fear) speed *= D.status.fearSpeed;
      if (e.ability === "peloton" && !fx.disarmed) {
        let n = 0;
        const ab = D.ENEMIES.cycliste.ability;
        this.neighbors(e, ab.range, (o) => {
          if (o.type === "cycliste") n++;
        });
        if (n >= 2) speed *= ab.mult;
      }
      e.speed = stopped ? 0 : speed;
      e.moving = !stopped;
      if (!stopped) {
        if (e.flying) this.moveFly(e, speed, dt);
        else this.moveGround(e, speed, dt);
        if (e.dead) return;
      }
      // Lasso du cow-boy : attrape une gemme au sol à portée
      if (!e.carrying && e.ability === "lasso" && !fx.disarmed && !stopped) {
        const r = D.ENEMIES.cowboy.ability.range;
        for (const gem of this.state.gems) {
          if (gem.where !== "ground") continue;
          if ((gem.x - e.x) ** 2 + (gem.y - e.y) ** 2 <= r * r) {
            this.emit("lasso", { enemyId: e.id, gemId: gem.id, x: gem.x, y: gem.y });
            this.pickup(e, gem);
            break;
          }
        }
      }
    }
    /** Vol en ligne droite (montgolfière). */
    moveFly(e, speed, dt) {
      if (e.goal === "lair") {
        const L = this.lairById(e.target);
        if (!L || L.stock <= 0) e.retarget = true;
      } else if (e.goal === "gem") {
        const gem = this.state.gems.find((g) => g.id === e.target);
        if (!gem || gem.where !== "ground") e.retarget = true;
      }
      if (e.retarget) this.chooseGoal(e);
      let dx = e.tx - e.x,
        dy = e.ty - e.y;
      const d = Math.hypot(dx, dy);
      e.distLeft = d;
      const step = speed * dt;
      if (e.fx.fear) {
        dx = -dx;
        dy = -dy;
      } else if (d <= step + 0.05) {
        e.x = e.tx;
        e.y = e.ty;
        this.arriveFly(e);
        return;
      }
      if (d > 1e-6) {
        e.vx = (dx / d) * speed;
        e.vy = (dy / d) * speed;
        e.x += (dx / d) * step;
        e.y += (dy / d) * step;
        this.face(e, Math.atan2(dx, dy), dt);
      }
      // Une montgolfière effrayée ne sort pas de la carte.
      e.x = clamp(e.x, -0.8, D.W + 0.8);
      e.y = clamp(e.y, -0.8, D.H + 0.8);
    }
    arriveFly(e) {
      if (e.goal === "exit") return this.escape(e);
      if (e.goal === "lair") {
        const L = this.lairById(e.target);
        if (L && L.stock > 0) this.takeFromLair(e, L);
      } else if (e.goal === "gem") {
        const gem = this.state.gems.find((g) => g.id === e.target);
        if (gem && gem.where === "ground") this.pickup(e, gem);
      }
      e.retarget = true;
    }
    face(e, want, dt) {
      let d = want - e.dir;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      e.dir += d * Math.min(1, 10 * dt);
    }
    /** Marche (ou nage) libre le long du champ d'écoulement, en gardant sa voie. */
    moveGround(e, speed, dt) {
      const g = this.grid;
      const mode = e.mode;
      const ti = Math.floor(e.x),
        tj = Math.floor(e.y);
      // Hors des cases praticables (marée montante, poussée) : il patauge vers la terre la plus proche.
      if (!g.passable(ti, tj, mode)) {
        e.fx.wading = true;
        const p = g.nearestPassable(e.x, e.y, mode);
        if (!p) return;
        const dx = p[0] - e.x,
          dy = p[1] - e.y;
        const d = Math.hypot(dx, dy) || 1;
        const step = Math.min(d, speed * D.status.wading * dt);
        e.x += (dx / d) * step;
        e.y += (dy / d) * step;
        this.face(e, Math.atan2(dx, dy), dt);
        return;
      }
      e.fx.wading = false;
      const f = e.field;
      if (!f) return;
      const idx = tj * g.w + ti;
      e.distLeft = f.D[idx];
      if (f.D[idx] === 0 && !e.fx.fear) {
        this.arrive(e);
        if (e.dead || e.retarget) return;
      }
      // Direction d'écoulement (interpolée), à rebours si l'ennemi a peur.
      let fx, fy;
      if (g.flowAt(f, e.x, e.y, tmp)) {
        fx = tmp.x;
        fy = tmp.y;
      } else {
        const dx = f.cx - e.x,
          dy = f.cy - e.y;
        const d = Math.hypot(dx, dy) || 1;
        fx = dx / d;
        fy = dy / d;
      }
      if (e.fx.fear) {
        fx = -fx;
        fy = -fy;
      }
      // Voie : décalage voulu dans la largeur de la route (normale à l'écoulement de la case).
      e.laneT -= dt;
      if (e.laneT <= 0) {
        e.laneT = 2.5 + this.rnd() * 4;
        if (e.laneWander) e.laneGoal = (this.rnd() - 0.5) * 2;
        else e.laneGoal = clamp(e.laneGoal + (this.rnd() - 0.5) * 0.5, -1, 1);
      }
      e.lane += (e.laneGoal - e.lane) * Math.min(1, dt * 0.7);
      let lat = 0,
        nx = -fy,
        ny = fx;
      const tfx = f.F[idx * 2],
        tfy = f.F[idx * 2 + 1];
      if (tfx || tfy) {
        nx = -tfy;
        ny = tfx;
        const off = (e.x - ti - 0.5) * nx + (e.y - tj - 0.5) * ny;
        const Lp = f.Lp[idx],
          Ln = f.Ln[idx];
        const hw = (Lp + Ln) / 2;
        const target = (Lp - Ln) / 2 + e.lane * Math.max(0, hw - 0.42);
        lat = clamp((target - off) * 1.6, -0.9, 0.9);
      }
      // Écartement des voisins.
      let sx = 0,
        sy = 0;
      this.neighbors(e, SEP, (o, d2) => {
        const d = Math.sqrt(d2) || 0.01;
        const k = (SEP - d) / SEP;
        sx += ((e.x - o.x) / d) * k;
        sy += ((e.y - o.y) / d) * k;
      });
      // Coincé (contre un angle de talus) : il oublie sa voie un moment et suit l'écoulement pur.
      if (e.t.unstick > 0) {
        e.t.unstick -= dt;
        lat = 0;
      }
      let vx = fx + nx * lat + sx * 0.7,
        vy = fy + ny * lat + sy * 0.7;
      let l = Math.hypot(vx, vy) || 1;
      // Regard en avant : si la voie mène dans un talus, l'écoulement l'emporte.
      if (lat && !g.passable(Math.floor(e.x + (vx / l) * 0.45), Math.floor(e.y + (vy / l) * 0.45), mode)) {
        vx = fx + sx * 0.7;
        vy = fy + sy * 0.7;
        l = Math.hypot(vx, vy) || 1;
      }
      vx = (vx / l) * speed;
      vy = (vy / l) * speed;
      // Intégration avec glissement le long des bords.
      let x = e.x + vx * dt,
        y = e.y + vy * dt;
      if (!g.passable(Math.floor(x), Math.floor(y), mode)) {
        if (g.passable(Math.floor(x), Math.floor(e.y), mode)) y = e.y;
        else if (g.passable(Math.floor(e.x), Math.floor(y), mode)) x = e.x;
        else {
          x = e.x;
          y = e.y;
        }
      }
      // Marge avec les cases infranchissables voisines.
      const i = Math.floor(x),
        j = Math.floor(y);
      if (!g.passable(i - 1, j, mode)) x = Math.max(x, i + RADIUS);
      if (!g.passable(i + 1, j, mode)) x = Math.min(x, i + 1 - RADIUS);
      if (!g.passable(i, j - 1, mode)) y = Math.max(y, j + RADIUS);
      if (!g.passable(i, j + 1, mode)) y = Math.min(y, j + 1 - RADIUS);
      for (const [dx, dy] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ]) {
        if (g.passable(i + dx, j + dy, mode)) continue;
        const cx = dx < 0 ? i : i + 1,
          cy = dy < 0 ? j : j + 1;
        const ddx = x - cx,
          ddy = y - cy;
        const d = Math.hypot(ddx, ddy);
        if (d < RADIUS && d > 1e-6) {
          x = cx + (ddx / d) * RADIUS;
          y = cy + (ddy / d) * RADIUS;
        }
      }
      e.vx = (x - e.x) / dt;
      e.vy = (y - e.y) / dt;
      // Avance réelle bien plus faible que voulue pendant un moment : coincé.
      if (Math.hypot(x - e.x, y - e.y) < speed * dt * 0.25) {
        if ((e.t.stuck += dt) > 0.5) {
          e.t.stuck = 0;
          e.t.unstick = 1.5;
          e.lane = e.laneGoal = 0;
        }
      } else e.t.stuck = Math.max(0, e.t.stuck - dt);
      e.x = x;
      e.y = y;
      if (Math.abs(vx) + Math.abs(vy) > 1e-4) this.face(e, Math.atan2(vx, vy), dt);
      const tile = g.tile(Math.floor(e.x), Math.floor(e.y));
      e.water = !!(tile.swim && !tile.walk && !(tile.tide && g.lowTide));
      // Arrivée : sur une case du but (ou, à vide, sur une cachette pleine qui se trouve sur sa route).
      const ni = Math.floor(e.x),
        nj = Math.floor(e.y);
      if (!e.fx.fear && g.inside(ni, nj) && f.D[nj * g.w + ni] === 0) this.arrive(e);
      else if (!e.carrying && !e.fx.fear && g.char(ni, nj) === "L") {
        const L = this.state.map.lairs.find((lr) => lr.stock > 0 && lr.tiles.some(([a, b]) => a === ni && b === nj));
        if (L) {
          this.takeFromLair(e, L);
          e.retarget = true;
        }
      }
    }
    /** L'ennemi est sur une case de son but : cachette, gemme ou sortie (vérifiés sur la case réelle). */
    arrive(e) {
      const i = Math.floor(e.x),
        j = Math.floor(e.y);
      const ch = this.grid.char(i, j);
      if (e.carrying || e.goal === "exit") {
        if (ch === "E") this.escape(e);
        else e.retarget = true;
        return;
      }
      if (e.goal === "lair") {
        const L = this.lairById(e.target);
        if (L && L.stock > 0 && L.tiles.some(([a, b]) => a === i && b === j)) this.takeFromLair(e, L);
        e.retarget = true;
        return;
      }
      if (e.goal === "gem") {
        const gem = this.state.gems.find((g) => g.id === e.target);
        if (gem && gem.where === "ground" && Math.floor(gem.x) === i && Math.floor(gem.y) === j) this.pickup(e, gem);
      }
      e.retarget = true;
    }
    takeFromLair(e, L) {
      const gems = this.state.gems.filter((g) => g.where === "lair" && g.lair === L.id);
      if (!gems.length) return;
      const gem = gems.reduce((a, b) => (b.slot > a.slot ? b : a));
      gem.where = "carried";
      gem.carrier = e.id;
      e.carrying = gem.id;
      this.gemsDirty = true;
      this.countGems();
      this.emit("steal", { enemyId: e.id, gemId: gem.id, lairId: L.id });
      this.gemsChanged();
    }
    pickup(e, gem) {
      gem.where = "carried";
      gem.carrier = e.id;
      gem.returnIn = 0;
      e.carrying = gem.id;
      e.retarget = true;
      this.gemsDirty = true;
      this.countGems();
      this.emit("pickup", { enemyId: e.id, gemId: gem.id });
      this.gemsChanged();
    }
    escape(e) {
      const s = this.state;
      e.dead = true;
      s.stats.escaped++;
      let gemId = null;
      if (e.carrying) {
        const gem = s.gems.find((g) => g.id === e.carrying);
        gem.where = "lost";
        gem.carrier = null;
        gemId = gem.id;
        this.gemsDirty = true;
        this.countGems();
      }
      this.emit("escape", { enemyId: e.id, gemId, x: e.x, y: e.y });
      if (gemId) this.gemsChanged();
    }
    /** Toute gemme qui change d'état : les ennemis sans gemme réfléchissent à nouveau. */
    gemsChanged() {
      for (const e of this.state.enemies) {
        if (e.dead || e.carrying) continue;
        e.retarget = true;
      }
    }
    countGems() {
      const c = this.state.gemCount;
      c.lair = c.ground = c.carried = c.lost = 0;
      for (const L of this.state.map.lairs) L.stock = 0;
      for (const g of this.state.gems) {
        c[g.where]++;
        if (g.where === "lair") this.state.map.lairs[g.lair].stock++;
      }
      this.gemsDirty = false;
    }
    tickAbility(e, dt) {
      if (!e.ability || e.fx.disarmed) return;
      const s = this.state;
      const ab = D.ENEMIES[e.type].ability;
      if (e.ability === "barrier" && e.barrier < e.barrierMax && s.time - e.t.lastHit >= ab.regen) {
        e.barrier = e.barrierMax;
        this.emit("barrierUp", { enemyId: e.id });
      }
      if (e.ability === "heal") {
        e.t.ability -= dt;
        if (e.t.ability <= 0) {
          e.t.ability = ab.every;
          let best = null,
            miss = 0;
          for (const o of s.enemies) {
            if (o.dead || o === e) continue;
            if ((o.x - e.x) ** 2 + (o.y - e.y) ** 2 > ab.range * ab.range) continue;
            const m = o.hpMax - o.hp;
            if (m > miss + 0.5) {
              miss = m;
              best = o;
            }
          }
          if (best) {
            const amount = Math.min(miss, (e.champion ? D.champion.heal : ab.value) * (e.boss ? 1.5 : 1));
            best.hp += amount;
            this.emit("heal", { fromId: e.id, toId: best.id, amount, x: best.x, y: best.y });
          } else e.t.ability = 0.5;
        }
      }
      if (e.ability === "haste") {
        e.t.ability -= dt;
        if (e.t.ability <= 0) {
          e.t.ability = ab.every;
          const ids = [];
          for (const o of s.enemies) {
            if (o.dead) continue;
            if ((o.x - e.x) ** 2 + (o.y - e.y) ** 2 > ab.range * ab.range) continue;
            o.t.haste = ab.t * (e.champion ? 1.5 : 1);
            o.t.hasteMult = ab.mult;
            ids.push(o.id);
          }
          this.emit("haste", { enemyId: e.id, ids });
        }
      }
      if (e.ability === "flash") {
        e.t.ability -= dt;
        if (e.t.ability <= 0) {
          const r = ab.range * (e.champion ? 1.35 : 1);
          const near = s.towers.filter((t) => t.dazzled <= 0 && (t.x - e.x) ** 2 + (t.y - e.y) ** 2 <= r * r).sort((a, b) => (a.x - e.x) ** 2 + (a.y - e.y) ** 2 - ((b.x - e.x) ** 2 + (b.y - e.y) ** 2));
          if (!near.length) e.t.ability = 0.5;
          else {
            e.t.ability = ab.every;
            const n = ab.count + (e.champion ? 1 : 0) + (e.boss ? 1 : 0);
            const hit = near.slice(0, n);
            for (const t of hit) {
              t.dazzled = ab.t * (e.champion ? 1.5 : 1);
              this.stopBeams(t);
            }
            this.emit("flash", { enemyId: e.id, towerIds: hit.map((t) => t.id), x: e.x, y: e.y });
          }
        }
      }
    }
    /** Korrigan : disparaît et réapparaît plus loin sur sa route. */
    blink(e) {
      const ab = D.ENEMIES.korrigan.ability;
      const g = this.grid;
      const f = e.field;
      if (!f) return;
      const fromX = e.x,
        fromY = e.y;
      let x = e.x,
        y = e.y;
      const total = ab.dist * (e.champion ? 1.35 : 1);
      for (let s = 0; s < total; s += 0.2) {
        if (!g.flowAt(f, x, y, tmp)) break;
        const nx = x + tmp.x * 0.2,
          ny = y + tmp.y * 0.2;
        if (!g.passable(Math.floor(nx), Math.floor(ny), e.mode)) break;
        x = nx;
        y = ny;
        if (f.D[Math.floor(y) * g.w + Math.floor(x)] === 0) break;
      }
      if (Math.hypot(x - fromX, y - fromY) < 0.3) return;
      e.x = x;
      e.y = y;
      e.t.blink = ab.every;
      e.t.invis = Math.max(e.t.invis, 0.3);
      this.emit("blink", { enemyId: e.id, fromX, fromY, x, y });
    }
    /** Inflige des dégâts ; src = { towerId, pierce, area, dot, beam, kind }. Renvoie les dégâts subis. */
    hurt(e, amount, src) {
      if (e.dead || amount <= 0) return 0;
      const s = this.state;
      if (e.t.rad > 0) amount *= 1 + e.t.radPct;
      if (e.shield > 0 && !src.pierce && !e.fx.disarmed) amount = Math.max(1, amount - e.shield);
      let absorbed = 0;
      if (e.barrier > 0 && !e.fx.disarmed) {
        absorbed = Math.min(e.barrier, amount);
        e.barrier -= absorbed;
        amount -= absorbed;
        if (e.barrier <= 1e-6) {
          e.barrier = 0;
          this.emit("barrierBreak", { enemyId: e.id });
        }
      }
      e.t.lastHit = s.time;
      const dealt = Math.min(e.hp, amount);
      e.hp -= amount;
      const tower = src.towerId ? this.towerById(src.towerId) : null;
      if (tower) tower.xp += (dealt + absorbed) * D.xpFromDamage * this.mods.xp;
      if (e.ability === "smoke" && !e.smokeUsed && !e.fx.disarmed && !src.dot) {
        e.smokeUsed = true;
        e.t.invis = D.ENEMIES.chasseur.ability.t * (e.champion ? 1.3 : 1);
        this.emit("smoke", { enemyId: e.id });
      }
      if (e.hp <= 0) {
        this.kill(e, tower, src);
        return dealt + absorbed;
      }
      if (e.ability === "blink" && !e.fx.disarmed && !src.dot && e.t.blink <= 0 && !e.fx.freeze) this.blink(e);
      return dealt + absorbed;
    }
    kill(e, tower, src) {
      const s = this.state;
      if (e.dead) return;
      e.dead = true;
      e.hp = 0;
      s.gold += e.gold;
      s.stats.kills++;
      s.stats.goldEarned += e.gold;
      if (tower) {
        tower.kills++;
        tower.xp += e.xp * this.mods.xp;
      }
      this.emit("kill", { enemyId: e.id, enemyType: e.type, gold: e.gold, towerId: tower ? tower.id : null, x: e.x, y: e.y, carrying: e.carrying, kind: src && src.kind });
      if (e.carrying) this.dropGem(e);
      // Tracteur : les ouvriers sautent de la cabine.
      if (e.ability === "split" && !e.fx.disarmed) {
        const ab = D.ENEMIES.tracteur.ability;
        const n = ab.value + (e.champion ? 1 : 0) + (e.boss ? 2 : 0);
        const spawned = [];
        const g = this.grid;
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2 + 0.4;
          let x = e.x + Math.sin(a) * 0.35,
            y = e.y + Math.cos(a) * 0.35;
          if (!g.passable(Math.floor(x), Math.floor(y), "walk")) {
            x = e.x;
            y = e.y;
          }
          const o = this.spawn({ type: ab.into, champion: false, boss: false, entrance: 0, hpMul: e.hpMul }, { x, y });
          o.dir = e.dir;
          spawned.push(o.id);
        }
        this.emit("split", { enemyId: e.id, x: e.x, y: e.y, spawned });
      }
      // Explosion du cadavre (rayonnement du dragon bleu)
      if (e.t.rad > 0 && e.t.radSrc) {
        const src2 = this.towerById(e.t.radSrc);
        const st = src2 && src2.st;
        if (st && st.corpse) {
          const dmg = st.corpse * e.hpMax;
          this.emit("corpseBomb", { x: e.x, y: e.y, r: 1, towerId: src2.id });
          for (const o of s.enemies) {
            if (o.dead || o === e) continue;
            if ((o.x - e.x) ** 2 + (o.y - e.y) ** 2 <= 1) this.hurt(o, dmg, { towerId: src2.id, area: true, kind: "corpse" });
          }
        }
      }
    }
    dropGem(e) {
      const s = this.state;
      const gem = s.gems.find((g) => g.id === e.carrying);
      e.carrying = null;
      if (!gem) return;
      let x = e.x,
        y = e.y;
      const g = this.grid;
      // Une gemme tombe sur une case marchable (d'une montgolfière : au sol, juste dessous).
      if (!g.walkable(Math.floor(x), Math.floor(y))) {
        const p = g.nearestPassable(x, y, "walk");
        if (p) {
          x = p[0];
          y = p[1];
        }
      }
      x = clamp(x, 0.3, D.W - 0.3);
      y = clamp(y, 0.3, D.H - 0.3);
      gem.where = "ground";
      gem.carrier = null;
      gem.x = x;
      gem.y = y;
      gem.returnIn = this.mods.portal;
      this.gemsDirty = true;
      this.countGems();
      this.emit("drop", { gemId: gem.id, x, y, fromX: e.x, fromY: e.y, flying: e.flying });
      this.gemsChanged();
    }
    tickGems(dt) {
      const s = this.state;
      if (!this.mods.portal) return;
      for (const gem of s.gems) {
        if (gem.where !== "ground" || !(gem.returnIn > 0)) continue;
        gem.returnIn -= dt;
        if (gem.returnIn <= 0) this.returnGem(gem);
      }
    }
    returnGem(gem) {
      const L = this.lairById(gem.lair);
      gem.where = "lair";
      gem.returnIn = 0;
      gem.x = L.x;
      gem.y = L.y;
      this.gemsDirty = true;
      this.countGems();
      this.emit("gemReturn", { gemId: gem.id, lairId: L.id });
      this.gemsChanged();
    }

    /* ------------------------------------------------------------ tours */
    tickTowers(dt) {
      const s = this.state;
      const F = s.frenzy ? D.SPELLS.frenzy.mult : 1;
      for (const t of s.towers) {
        const st = t.st;
        t.range = st.range;
        // Recharge des charges (même ébloui).
        if (t.attack === "charges" && t.ammo < t.ammoMax) t.ammo = Math.min(t.ammoMax, t.ammo + (dt * F) / st.reload);
        if (t.dazzled > 0) {
          t.dazzled -= dt;
          if (t.dazzled <= 0) {
            t.dazzled = 0;
            this.emit("dazzleEnd", { towerId: t.id });
          }
          continue;
        }
        if (t.attack === "beam") this.tickBeam(t, st, dt, F);
        else this.tickShooter(t, st, dt, F);
      }
    }
    /** Sanglier (tir à la suite) et cygne (rafale de charges). */
    tickShooter(t, st, dt, F) {
      const charges = t.attack === "charges";
      // La cadence court aussi pendant l'élan d'un tir (sinon la frénésie ne doublerait pas vraiment).
      if (charges) t.burstCd = Math.max(0, t.burstCd - dt * F);
      else t.charge = Math.min(1, t.charge + dt * st.rate * F);
      if (t.windup > 0) {
        t.windup -= dt;
        const first = t.windTargets && this.enemyById(t.windTargets[0]);
        if (first && !first.dead) t.aim = Math.atan2(first.x - t.x, first.y - t.y);
        if (t.windup <= 0) {
          for (const id of t.windTargets) {
            const target = this.enemyById(id);
            this.fire(t, st, target && !target.dead ? target : null);
          }
          t.windTargets = null;
        }
        return;
      }
      const target = this.pickTarget(t, st.range, null);
      t.targetId = target ? target.id : null;
      if (!target) return;
      t.aim = Math.atan2(target.x - t.x, target.y - t.y);
      const ready = charges ? t.ammo >= 1 && t.burstCd <= 0 : t.charge >= 1;
      if (!ready) return;
      const targets = [target];
      for (let k = 1; k < (st.multi || 1); k++) {
        const o = this.pickTarget(t, st.range, targets);
        if (o) targets.push(o);
      }
      if (charges) {
        t.ammo -= 1;
        t.burstCd = st.burst;
      } else t.charge -= 1;
      t.windup = (WINDUP[t.family] * (st.shot === "bigChestnut" ? 1.6 : 1)) / Math.max(1, F * 0.75);
      t.windTargets = targets.map((o) => o.id);
      this.emit("attack", { towerId: t.id, targetId: target.id, targets: t.windTargets });
    }
    /**
     * Berger / dragon : jet continu qui chauffe tant qu'il tient sa cible. Emplacements internes
     * t.slots (un par jet, null s'il est éteint) ; t.beams (état public) = jets allumés
     * [{ slot, targetId, heat (0..1), chainId }].
     */
    tickBeam(t, st, dt, F) {
      const n = st.beams || 1;
      const slots = t.slots || (t.slots = []);
      for (let k = slots.length - 1; k >= n; k--) this.endBeam(t, k);
      const r2 = (st.range + 0.15) ** 2;
      for (let k = 0; k < n; k++) {
        let b = slots[k];
        let target = b ? this.enemyById(b.targetId) : null;
        if (b && (!target || target.dead || target.t.invis > 0 || (target.x - t.x) ** 2 + (target.y - t.y) ** 2 > r2)) {
          this.endBeam(t, k);
          b = null;
          target = null;
        }
        if (!b) {
          const taken = slots.filter(Boolean).map((x) => this.enemyById(x.targetId)).filter(Boolean);
          target = this.pickTarget(t, st.range, taken);
          if (!target) continue;
          b = slots[k] = { slot: k, targetId: target.id, heat: 0, time: 0, chainId: null };
          this.emit("beamOn", { towerId: t.id, targetId: target.id, kind: st.beam, slot: k });
        }
        b.time += dt * F;
        b.heat = Math.min(1, b.time / st.heatTime);
        const mult = (1 + (st.heatMax - 1) * b.heat) * (F > 1 ? 1.6 : 1);
        const dmg = st.dps * mult * dt;
        if (k === 0 || !slots[0]) t.aim = Math.atan2(target.x - t.x, target.y - t.y);
        // Effets du jet (rafraîchis chaque pas) : brûlure, rayonnement.
        if (st.burn || st.radiance) this.applyEffects(target, st, t);
        this.hurt(target, dmg, { towerId: t.id, pierce: true, beam: true, kind: st.beam });
        // Dragon rouge : les flammes lèchent les voisins de la cible.
        if (st.splash) {
          for (const o of this.state.enemies) {
            if (o.dead || o === target || o.flying !== target.flying) continue;
            if ((o.x - target.x) ** 2 + (o.y - target.y) ** 2 > st.splash * st.splash) continue;
            if (st.burn) this.applyEffects(o, st, t);
            this.hurt(o, dmg * st.splashPct, { towerId: t.id, pierce: true, area: true, beam: true, kind: st.beam });
          }
        }
        // Grand dragon bleu : le jet rebondit sur un second ennemi.
        b.chainId = null;
        if (st.chain && !target.dead) {
          let best = null,
            bd = st.chain.range * st.chain.range;
          for (const o of this.state.enemies) {
            if (o.dead || o === target || o.t.invis > 0) continue;
            const d2 = (o.x - target.x) ** 2 + (o.y - target.y) ** 2;
            if (d2 < bd) {
              bd = d2;
              best = o;
            }
          }
          if (best) {
            b.chainId = best.id;
            if (st.radiance) this.applyEffects(best, st, t);
            this.hurt(best, dmg * st.chain.pct, { towerId: t.id, pierce: true, beam: true, kind: st.beam });
          }
        }
      }
      this.publishBeams(t);
    }
    publishBeams(t) {
      t.beams = (t.slots || []).filter(Boolean).map((b) => ({ slot: b.slot, targetId: b.targetId, heat: b.heat, chainId: b.chainId }));
      t.targetId = t.beams[0] ? t.beams[0].targetId : null;
    }
    endBeam(t, k) {
      const slots = t.slots || [];
      if (!slots[k]) return;
      slots[k] = null;
      this.emit("beamOff", { towerId: t.id, slot: k });
      while (slots.length && !slots[slots.length - 1]) slots.pop();
      this.publishBeams(t);
    }
    stopBeams(t) {
      const slots = t.slots || [];
      for (let k = slots.length - 1; k >= 0; k--) this.endBeam(t, k);
      this.publishBeams(t);
    }
    /** Cible : les porteurs d'abord, puis l'ennemi le plus proche de son but. */
    pickTarget(t, range, exclude) {
      let best = null,
        bestScore = Infinity;
      const r2 = range * range;
      for (const e of this.state.enemies) {
        if (e.dead || e.t.invis > 0) continue;
        if (exclude && exclude.includes(e)) continue;
        const d2 = (e.x - t.x) ** 2 + (e.y - t.y) ** 2;
        if (d2 > r2) continue;
        const score = (e.carrying ? 0 : 1000) + e.distLeft + d2 * 0.001;
        if (score < bestScore) {
          bestScore = score;
          best = e;
        }
      }
      return best;
    }
    fire(t, st, target) {
      const s = this.state;
      if (!target && !st.splash) return;
      const p = {
        id: this.nextId++,
        kind: st.shot,
        fromTowerId: t.id,
        targetId: target ? target.id : null,
        family: t.family,
        x: t.x,
        y: t.y,
        sx: t.x,
        sy: t.y,
        tx: target ? target.x : t.x,
        ty: target ? target.y : t.y,
        p: 0,
        arc: st.shot === "bigChestnut",
        speed: st.speed,
        traveled: 0,
        st,
      };
      s.projectiles.push(p);
      t.shots++;
      this.emit("shot", { towerId: t.id, projectileId: p.id, kind: p.kind, targetId: p.targetId });
    }
    tickProjectiles(dt) {
      const s = this.state;
      let dirty = false;
      for (const p of s.projectiles) {
        const target = p.targetId ? this.enemyById(p.targetId) : null;
        if (target && !target.dead) {
          p.tx = target.x;
          p.ty = target.y;
        } else if (p.targetId && !p.st.splash) {
          p.done = true; // cible disparue : le tir se perd
          dirty = true;
          this.emit("fizzle", { projectileId: p.id, x: p.x, y: p.y, kind: p.kind });
          continue;
        }
        const dx = p.tx - p.x,
          dy = p.ty - p.y;
        const d = Math.hypot(dx, dy);
        const stepLen = p.speed * dt;
        if (d <= stepLen + 0.05) {
          p.x = p.tx;
          p.y = p.ty;
          p.p = 1;
          p.done = true;
          dirty = true;
          this.impact(p, target && !target.dead ? target : null);
        } else {
          p.x += (dx / d) * stepLen;
          p.y += (dy / d) * stepLen;
          p.traveled += stepLen;
          p.p = p.traveled / (p.traveled + d);
        }
      }
      if (dirty) s.projectiles = s.projectiles.filter((p) => !p.done);
    }
    impact(p, target) {
      const s = this.state;
      const st = p.st;
      const tower = this.towerById(p.fromTowerId);
      const src = { towerId: tower ? tower.id : null, pierce: !!st.pierce, kind: p.kind };
      let crit = false;
      let dmg = st.dmg;
      if (st.crit && this.rnd() < st.crit.chance) {
        crit = true;
        dmg *= st.crit.mult;
      }
      const victims = [];
      if (st.splash) {
        for (const e of s.enemies) {
          if (e.dead) continue;
          if ((e.x - p.x) ** 2 + (e.y - p.y) ** 2 <= st.splash * st.splash || e === target) victims.push(e);
        }
      } else if (target) {
        if (target.ability === "evade" && !target.fx.disarmed && this.rnd() < D.ENEMIES.rugbyman.ability.chance) {
          this.emit("hit", { enemyId: target.id, dmg: 0, evaded: true, x: target.x, y: target.y, kind: p.kind, projectileId: p.id });
          return;
        }
        victims.push(target);
      }
      this.emit("impact", { projectileId: p.id, kind: p.kind, x: p.x, y: p.y, r: st.splash || 0, towerId: src.towerId, crit });
      if (st.mana && victims.length) s.mana = Math.min(s.manaMax, s.mana + st.mana);
      for (const e of victims) {
        const before = e.barrier;
        const dealt = this.hurt(e, dmg, Object.assign({ area: !!st.splash }, src));
        this.emit("hit", { enemyId: e.id, dmg: dealt, crit, absorbed: before - e.barrier, x: e.x, y: e.y, kind: p.kind });
        if (!e.dead) this.applyEffects(e, st, tower);
      }
    }
    applyEffects(e, st, tower) {
      if (e.ability === "immune" && !e.fx.disarmed) {
        if (st.slow || st.fear || st.freeze || st.stun || st.burn || st.radiance || st.disarm) {
          if (this.state.time - (e.t.immuneShown || -9) > 1) {
            e.t.immuneShown = this.state.time;
            this.emit("immune", { enemyId: e.id });
          }
        }
        return;
      }
      const T = e.t;
      const boss = e.boss ? 0.5 : 1; // les boss résistent à moitié aux contrôles
      if (st.slow) {
        const pct = Math.min(D.status.slowCap, st.slow.pct * (e.boss ? 0.6 : 1));
        if (T.slow <= 0 || pct >= T.slowPct) T.slowPct = pct;
        T.slow = Math.max(T.slow, st.slow.t);
      }
      if (st.fear && this.rnd() < st.fear.chance * boss && T.fear <= 0) {
        T.fear = st.fear.t;
        e.retarget = true;
        this.emit("fear", { enemyId: e.id });
      }
      if (st.freeze && T.freezeImm <= 0 && this.rnd() < st.freeze.chance * boss) {
        T.freeze = st.freeze.t;
        T.freezeImm = st.freeze.t + D.status.freezeImmunity;
        this.emit("freeze", { enemyId: e.id });
      }
      if (st.stun && T.stunImm <= 0 && this.rnd() < st.stun.chance * boss) {
        T.stun = st.stun.t;
        T.stunImm = st.stun.t + D.status.stunImmunity;
        this.emit("stun", { enemyId: e.id });
      }
      if (st.burn) {
        if (T.burn <= 0 || st.burn.dps >= T.burnDps) {
          T.burnDps = st.burn.dps * (this.mods.damage || 1);
          T.burnSrc = tower ? tower.id : null;
        }
        T.burn = Math.max(T.burn, st.burn.t);
      }
      if (st.radiance) {
        T.rad = Math.max(T.rad, st.radiance.t);
        if (st.radiance.pct >= T.radPct) {
          T.radPct = st.radiance.pct;
          T.radSrc = tower ? tower.id : T.radSrc;
        }
      }
      if (st.disarm && !e.fx.disarmed && e.ability && this.rnd() < st.disarm * boss) {
        e.fx.disarmed = true;
        e.barrier = 0;
        e.shield = 0;
        T.invis = 0;
        this.emit("disarm", { enemyId: e.id });
      }
    }

    /* ------------------------------------------------------------ fin */
    checkEnd() {
      const s = this.state;
      if (s.over) return;
      const c = s.gemCount;
      if (c.lair + c.ground + c.carried === 0) {
        s.over = { win: false, gemsLeft: 0, gemsTotal: c.total, brilliant: false, time: s.time, kills: s.stats.kills };
        this.emit("lose", {});
        return;
      }
      const lastStarted = s.wave.index >= this.waves.length - 1;
      if (lastStarted && !this.spawnQueue.length && s.enemies.every((e) => e.dead)) {
        for (const gem of s.gems) if (gem.where === "ground") this.returnGem(gem);
        const left = s.gems.filter((g) => g.where === "lair").length;
        s.over = { win: true, gemsLeft: left, gemsTotal: c.total, brilliant: left === c.total, time: s.time, kills: s.stats.kills };
        this.emit("win", { gemsLeft: left });
      }
    }
  }

  S.Game = Game;
  S.createGame = (opts) => new Game(opts);
})();
