// « Pas touche à mes trésors » — la partie (PTMT.sim.createGame), sans THREE.
//
// Règles de Cursed Treasure : les ennemis entrent par les chemins, vont prendre une gemme au repaire
// et repartent vers la sortie la plus proche ; tué, un porteur lâche sa gemme sur place et les autres
// ennemis sans gemme foncent la chercher (plus court chemin, demi-tour compris) puis repartent avec.
// Les tours se posent sur leur terrain, gagnent de l'expérience (dégâts infligés, ennemis achevés),
// s'achètent niveau par niveau, se spécialisent au niveau 4 et évoluent au niveau 7. Trois sorts
// payés en mana (Couper, Frénésie, Météore), bonus des compétences, vagues minutées qu'on peut
// appeler en avance (or en prime). Partie perdue quand toutes les gemmes sont parties.
//
// Pas fixe de 1/60 s (reproductible avec la graine), positions en cases continues (x vers la droite,
// y vers le bas), angles « monde » : 0 = vers +y, π/2 = vers +x (directement rotation.y en 3D).
(function () {
  "use strict";
  const PTMT = (globalThis.PTMT = globalThis.PTMT || {});
  const S = (PTMT.sim = PTMT.sim || {});
  const D = S.DATA;
  const TICK = D.tick;
  const FAR = S.Grid.FAR;
  const WINDUP = { boar: 0.12, swan: 0.18, dog: 0.22 };

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const rank = (skills, id) => clamp(Math.floor((skills && skills[id]) || 0), 0, D.SKILL[id] ? D.SKILL[id].max : 0);

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
      this.waves = S.buildWaves(level, this.grid.entrances.length);
      this.events = [];
      this.nextId = 1;
      this.acc = 0;
      this.spawnQueue = [];
      this.waveClock = 0;
      this.meteors = [];
      this.seen = new Set();
      this.gemsDirty = true;
      const m = this.mods;
      const manaMax = D.mana.max + m.manaMax;
      const gemsTotal = (map.gems || 5) + m.gemsExtra;
      this.state = {
        level,
        map: {
          id: map.id,
          name: map.name,
          ct: map.ct,
          w: D.W,
          h: D.H,
          grid: this.grid.lines(),
          entrances: this.grid.entrances.map((e) => ({ id: e.id, i: e.i, j: e.j })),
          lair: { i: this.grid.lair.i, j: this.grid.lair.j },
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
      for (let k = 0; k < gemsTotal; k++) this.state.gems.push({ id: k + 1, color: k % D.GEM_COLORS.length, where: "lair", x: this.grid.lair.i + 0.5, y: this.grid.lair.j + 0.5, carrier: null, returnIn: 0 });
      this.refreshWavePreview();
      this.refreshSpells();
    }

    /* ------------------------------------------------------------ outils */
    emit(type, data) {
      const e = Object.assign({ type }, data);
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
        road: !!t.walk,
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
      st.dmg = base.dmg * m.damage * (1 + high * (D.high.damage + m.heights));
      st.range = base.range * m.range * (1 + high * D.high.range);
      st.rate = base.rate * m.rate;
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
    nextWave() {
      const w = this.state.wave;
      const k = w.index + 1;
      if (k >= this.waves.length) return null;
      const wave = this.waves[k];
      const groups = new Map();
      for (const g of wave.groups) {
        const key = g.type + (g.boss ? ":b" : g.champion ? ":c" : "");
        const cur = groups.get(key) || { type: g.type, champion: !!g.champion, boss: !!g.boss, count: 0, name: g.boss ? D.BOSS_NAMES[g.type] : null };
        cur.count += g.count;
        groups.set(key, cur);
      }
      return { index: k, total: this.waves.length, countdown: w.countdown, groups: [...groups.values()], entrances: [...new Set(wave.groups.map((g) => g.entrance))] };
    }
    describeEnemy(type) {
      const e = D.ENEMIES[type];
      return e ? { type, name: e.name, role: e.ct, hp: e.hp, speed: e.speed, gold: e.gold, ability: e.ability, blurb: e.blurb } : null;
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
        windTarget: null,
        targetId: null,
        shots: 0,
      };
      this.state.gold -= chk.cost;
      this.state.towers.push(t);
      this.emit("build", { towerId: t.id, family, i, j, cost: chk.cost });
      return { ok: true, towerId: t.id, cost: chk.cost };
    }
    upgrade(id, spec) {
      const t = this.towerById(id);
      if (!t) return { ok: false, reason: "Tour introuvable" };
      const chk = this.checkUpgrade(t, spec);
      if (!chk.ok) return chk;
      if (t.level === 3) t.spec = spec;
      t.level++;
      t.invested += chk.cost;
      this.state.gold -= chk.cost;
      this.emit("upgrade", { towerId: t.id, level: t.level, spec: t.spec, cost: chk.cost });
      return { ok: true, level: t.level, spec: t.spec, cost: chk.cost };
    }
    sell(id) {
      const t = this.towerById(id);
      if (!t) return { ok: false, reason: "Tour introuvable" };
      const gold = Math.floor(t.invested * D.economy.sellRatio);
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
      while (this.acc >= TICK && n < 24) {
        this.tick(TICK);
        this.acc -= TICK;
        n++;
        if (s.over) break;
      }
      if (n >= 24) this.acc = 0;
    }
    tick(dt) {
      const s = this.state;
      s.time += dt;
      this.tickWaves(dt);
      this.tickMana(dt);
      this.tickSpells(dt);
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
      const t0 = this.waveClock;
      for (const sp of wave.spawns) this.spawnQueue.push(Object.assign({ at: t0 + sp.t }, sp));
      this.spawnQueue.sort((a, b) => a.at - b.at);
      this.emit("waveStart", { index: k, total: this.waves.length });
      if (s.map.secretWave && k + 1 === s.map.secretWave) this.openSecret();
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
      g.version++;
      g.cache.clear();
      this.mapChanged();
      this.emit("secretOpen", {});
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
    spawn(sp) {
      const s = this.state;
      const def = D.ENEMIES[sp.type];
      const ent = this.grid.entrances[sp.entrance % this.grid.entrances.length];
      let hp = def.hp * sp.hpMul;
      let gold = def.gold * (0.75 + 0.25 * sp.hpMul),
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
      const e = {
        id: this.nextId++,
        type: sp.type,
        champion: !!sp.champion,
        boss: !!sp.boss,
        name: sp.boss ? D.BOSS_NAMES[sp.type] : def.name,
        x: ent.i + 0.5,
        y: ent.j + 0.5,
        px: ent.i + 0.5,
        py: ent.j + 0.5,
        ox: 0,
        oy: 0,
        dir: 0,
        hp,
        hpMax: hp,
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
        water: false,
        lane: (this.rnd() - 0.5) * 0.4,
        cur: [ent.i, ent.j],
        next: null,
        pdx: 0,
        pdy: 0,
        goal: "gem",
        target: null,
        carrying: null,
        retarget: true,
        distLeft: FAR,
        fx: { slow: 0, fear: false, freeze: false, burn: false, radiance: false, haste: false, invisible: 0, stun: false, disarmed: false },
        t: { slow: 0, slowPct: 0, fear: 0, freeze: 0, freezeImm: 0, stun: 0, stunImm: 0, burn: 0, burnDps: 0, burnSrc: null, rad: 0, radPct: 0, radSrc: null, haste: 0, hasteMult: 1, invis: 0, ability: 0, lastHit: -99 },
        smokeUsed: false,
        dead: false,
      };
      if (ab.kind === "shield") e.shield = sp.champion ? D.champion.shield : ab.value;
      if (ab.kind === "barrier") e.barrier = e.barrierMax = (sp.champion ? D.champion.barrier : ab.value) * (sp.boss ? 1.5 : 1);
      if (ab.kind === "heal" || ab.kind === "haste") e.t.ability = ab.every * (0.4 + 0.3 * this.rnd());
      s.enemies.push(e);
      this.emit("spawn", { enemyId: e.id, type: e.type, champion: e.champion, boss: e.boss, entrance: ent.id });
      if (!this.seen.has(e.type)) {
        this.seen.add(e.type);
        this.emit("newEnemy", { type: e.type });
      }
      if (e.boss) this.emit("bossArrives", { enemyId: e.id, type: e.type, name: e.name });
    }
    /** Champ vers le but de l'ennemi (gemme choisie, repaire ou sortie) ; choisit la meilleure gemme. */
    chooseGoal(e) {
      const g = this.grid;
      const s = this.state;
      e.retarget = false;
      const [ci, cj] = e.cur;
      const scared = e.t.fear > 0 && !e.fx.disarmed;
      if (e.carrying) {
        e.goal = "exit";
        e.target = null;
        e.field = scared ? g.toLair(e.swim) : g.toExit(e.swim);
        return;
      }
      let best = null,
        bestD = FAR,
        bestF = null;
      const lairStock = s.gemCount.lair;
      if (lairStock > 0) {
        const f = g.toLair(e.swim);
        const d = g.at(f, ci, cj);
        if (d < bestD) {
          bestD = d;
          best = "lair";
          bestF = f;
        }
      }
      for (const gem of s.gems) {
        if (gem.where !== "ground") continue;
        const f = g.toTile(Math.floor(gem.x), Math.floor(gem.y), e.swim);
        const d = g.at(f, ci, cj);
        if (d < bestD) {
          bestD = d;
          best = gem.id;
          bestF = f;
        }
      }
      if (best === null) {
        e.goal = "exit";
        e.target = null;
        e.field = g.toExit(e.swim);
      } else {
        e.goal = "gem";
        e.target = best;
        e.field = bestF;
      }
      if (scared) e.field = g.toExit(e.swim);
    }
    tickEnemy(e, dt) {
      if (e.dead) return;
      const s = this.state;
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
      const wasFear = fx.fear;
      fx.slow = T.slow > 0 ? T.slowPct : 0;
      fx.fear = T.fear > 0;
      fx.freeze = T.freeze > 0;
      fx.stun = T.stun > 0;
      fx.haste = T.haste > 0;
      fx.invisible = T.invis > 0 ? Math.min(1, T.invis / 0.4) : 0;
      fx.radiance = T.rad > 0;
      if (wasFear !== fx.fear) e.retarget = true;
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
      if (e.retarget || !e.field) this.chooseGoal(e);
      const stopped = fx.freeze || fx.stun;
      let speed = e.baseSpeed * (1 - fx.slow);
      if (fx.haste) speed *= T.hasteMult;
      if (fx.fear) speed *= D.status.fearSpeed;
      e.speed = stopped ? 0 : speed;
      e.moving = !stopped;
      if (!stopped) this.move(e, speed * dt);
      // Décalage latéral lissé (file indienne un peu désordonnée)
      const dx = e.next ? e.next[0] + 0.5 - e.px : 0,
        dy = e.next ? e.next[1] + 0.5 - e.py : 0;
      const len = Math.hypot(dx, dy);
      if (len > 1e-4) {
        const tx = (-dy / len) * e.lane,
          ty = (dx / len) * e.lane;
        const k = 1 - Math.exp(-8 * dt);
        e.ox += (tx - e.ox) * k;
        e.oy += (ty - e.oy) * k;
        const want = Math.atan2(dx, dy);
        let d = want - e.dir;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        e.dir += d * Math.min(1, 12 * dt);
      }
      e.x = e.px + e.ox;
      e.y = e.py + e.oy;
      const ti = Math.floor(e.px),
        tj = Math.floor(e.py);
      const tile = this.grid.tile(ti, tj);
      e.water = !!(tile.swim && !tile.walk);
      e.distLeft = this.grid.at(e.field, e.cur[0], e.cur[1]);
      // Lasso du cow-boy : attrape une gemme au sol à portée
      if (!e.carrying && e.ability === "lasso" && !fx.disarmed && !stopped) {
        const r = D.ENEMIES.cowboy.ability.range;
        for (const gem of s.gems) {
          if (gem.where !== "ground") continue;
          if ((gem.x - e.x) ** 2 + (gem.y - e.y) ** 2 <= r * r) {
            this.emit("lasso", { enemyId: e.id, gemId: gem.id });
            this.pickup(e, gem);
            break;
          }
        }
      }
    }
    move(e, dist) {
      const g = this.grid;
      let guard = 0;
      while (dist > 1e-6 && guard++ < 8) {
        if (!e.next) {
          const n = g.step(e.field, e.cur[0], e.cur[1], e.swim, e.pdx, e.pdy);
          if (!n) {
            this.arrive(e);
            if (e.dead || e.retarget) {
              if (e.retarget && !e.dead) this.chooseGoal(e);
              if (e.dead) return;
              continue;
            }
            return;
          }
          e.next = n;
        }
        // Demi-tour si revenir en arrière rapproche du but (gemme tombée derrière, peur).
        if (e.flip) {
          e.flip = false;
          const back = e.cur;
          if (g.at(e.field, back[0], back[1]) < g.at(e.field, e.next[0], e.next[1])) {
            e.cur = e.next;
            e.next = back;
          }
        }
        const tx = e.next[0] + 0.5,
          ty = e.next[1] + 0.5;
        const dx = tx - e.px,
          dy = ty - e.py;
        const d = Math.hypot(dx, dy);
        if (d <= dist) {
          e.px = tx;
          e.py = ty;
          dist -= d;
          e.pdx = e.next[0] - e.cur[0];
          e.pdy = e.next[1] - e.cur[1];
          e.cur = e.next;
          e.next = null;
          if (e.retarget) {
            this.chooseGoal(e);
          }
          if (g.at(e.field, e.cur[0], e.cur[1]) === 0) {
            this.arrive(e);
            if (e.dead) return;
            if (e.retarget) this.chooseGoal(e);
          }
        } else {
          e.px += (dx / d) * dist;
          e.py += (dy / d) * dist;
          dist = 0;
        }
      }
    }
    /** L'ennemi est au bout de son champ : repaire, gemme ou sortie (vérifiés sur la case réelle). */
    arrive(e) {
      const s = this.state;
      const [i, j] = e.cur;
      const ch = this.grid.char(i, j);
      const feared = e.t.fear > 0;
      if (e.carrying) {
        if (ch === "E" && !feared) this.escape(e);
        else e.retarget = true;
        return;
      }
      if (feared) {
        e.retarget = true; // il attend que la peur passe
        return;
      }
      if (e.goal === "exit") {
        if (ch === "E") this.escape(e);
        else e.retarget = true;
        return;
      }
      const lair = this.grid.lair;
      if (e.target === "lair" && i === lair.i && j === lair.j) {
        if (s.gemCount.lair > 0) {
          const gem = s.gems.find((g) => g.where === "lair");
          gem.where = "carried";
          gem.carrier = e.id;
          e.carrying = gem.id;
          this.gemsDirty = true;
          this.countGems();
          this.emit("steal", { enemyId: e.id, gemId: gem.id });
          this.gemsChanged();
        }
        e.retarget = true;
        return;
      }
      if (typeof e.target === "number") {
        const gem = s.gems.find((g) => g.id === e.target);
        if (gem && gem.where === "ground" && Math.floor(gem.x) === i && Math.floor(gem.y) === j) this.pickup(e, gem);
      }
      e.retarget = true;
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
        e.flip = true;
      }
    }
    countGems() {
      const c = this.state.gemCount;
      c.lair = c.ground = c.carried = c.lost = 0;
      for (const g of this.state.gems) c[g.where === "returning" ? "ground" : g.where]++;
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
            this.emit("heal", { fromId: e.id, toId: best.id, amount });
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
    }
    /** Inflige des dégâts ; src = { towerId, pierce, area, dot, kind }. Renvoie les dégâts subis. */
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
      if (e.hp <= 0) this.kill(e, tower, src);
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
      this.emit("kill", { enemyId: e.id, type: e.type, gold: e.gold, towerId: tower ? tower.id : null, x: e.x, y: e.y, carrying: e.carrying, kind: src && src.kind });
      if (e.carrying) this.dropGem(e);
      // Explosion du cadavre (rayonnement du dragon bleu)
      if (e.t.rad > 0 && e.t.radSrc) {
        const src2 = this.towerById(e.t.radSrc);
        const st = src2 && this.statsFor(src2, src2.level, src2.spec);
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
      const spot = this.grid.nearestWalkable(Math.floor(e.px), Math.floor(e.py));
      if (spot && (spot[0] !== Math.floor(x) || spot[1] !== Math.floor(y))) {
        x = spot[0] + 0.5;
        y = spot[1] + 0.5;
      }
      gem.where = "ground";
      gem.carrier = null;
      gem.x = x;
      gem.y = y;
      gem.returnIn = this.mods.portal;
      this.gemsDirty = true;
      this.countGems();
      this.emit("drop", { gemId: gem.id, x, y });
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
      gem.where = "lair";
      gem.returnIn = 0;
      gem.x = this.grid.lair.i + 0.5;
      gem.y = this.grid.lair.j + 0.5;
      this.gemsDirty = true;
      this.countGems();
      this.emit("gemReturn", { gemId: gem.id });
      this.gemsChanged();
    }

    /* ------------------------------------------------------------ tours */
    tickTowers(dt) {
      const s = this.state;
      const frenzy = s.frenzy ? D.SPELLS.frenzy.mult : 1;
      for (const t of s.towers) {
        if (!t.st || t.stKey !== t.level + (t.spec || "")) {
          t.st = this.statsFor(t, t.level, t.spec);
          t.stKey = t.level + (t.spec || "");
        }
        const st = t.st;
        t.range = st.range;
        t.charge = Math.min(1, t.charge + dt * st.rate * frenzy);
        if (t.windup > 0) {
          t.windup -= dt;
          const target = this.enemyById(t.windTarget);
          if (target && !target.dead) t.aim = Math.atan2(target.x - t.x, target.y - t.y);
          if (t.windup <= 0) this.fire(t, st, target && !target.dead ? target : null);
          continue;
        }
        const target = this.pickTarget(t, st.range);
        t.targetId = target ? target.id : null;
        if (!target) continue;
        t.aim = Math.atan2(target.x - t.x, target.y - t.y);
        if (t.charge >= 1) {
          t.charge -= 1;
          t.windup = WINDUP[t.family] * (st.shot === "bigChestnut" ? 1.6 : 1) / Math.max(1, frenzy * 0.75);
          t.windTarget = target.id;
          this.emit("attack", { towerId: t.id, targetId: target.id });
        }
      }
    }
    pickTarget(t, range) {
      let best = null,
        bestScore = Infinity;
      const r2 = range * range;
      for (const e of this.state.enemies) {
        if (e.dead || e.t.invis > 0) continue;
        const d2 = (e.x - t.x) ** 2 + (e.y - t.y) ** 2;
        if (d2 > r2) continue;
        // Porteurs d'abord, puis l'ennemi le plus proche de son but.
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
      this.emit("shot", { towerId: t.id, projectileId: p.id, kind: p.kind });
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
        if (st.slow || st.fear || st.freeze || st.stun || st.burn || st.radiance || st.disarm) this.emit("immune", { enemyId: e.id });
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
        e.flip = true;
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
