// « Pas touche à mes trésors » — moteur de jeu (simulation pure, pas fixe, sans rendu).
//
// Le rendu lit l'état (game.state) et consomme les événements (game.drainEvents()). Toutes les
// commandes du joueur passent par les méthodes publiques, qui vérifient coûts et prérequis.
// La pause gèle tous les systèmes ; la vitesse ×2 enchaîne deux pas par pas réel.
(function () {
  "use strict";
  const PTMT = (globalThis.PTMT = globalThis.PTMT || {});
  const C = PTMT.config,
    G = PTMT.geom,
    R = PTMT.routes;
  const TICK = C.tick;
  const FAMILY_SOCKET = { fire: "fire", ice: "ice", water: "water" };
  const FORM_KEYS = ["1", "2A", "2B", "3A", "3B"];

  function formKey(tier, branch) {
    return tier === 1 ? "1" : tier + branch;
  }

  class Game {
    /**
     * @param {object} opts { level, talents (répartition), unlocked (sorts débloqués), mobile, checkpoint }
     */
    constructor(opts = {}) {
      this.level = opts.level || 1;
      this.L = PTMT.layouts[this.level];
      this.graph = R.buildGraph(this.L);
      this.allocation = opts.talents || PTMT.talents.emptyAllocation();
      this.T = PTMT.talents.resolve(this.allocation);
      this.unlocked = new Set(opts.unlocked || ["meteor", "recall"]);
      this.maxActive = opts.mobile ? C.enemies.maxActive.mobile : C.enemies.maxActive.desktop;
      this.events = [];
      this.acc = 0;
      this.uid = 1;
      if (opts.checkpoint) this.restore(opts.checkpoint);
      else this.reset();
    }

    // ── Mise en place ──────────────────────────────────────────────────────────
    reset() {
      const L = this.L;
      const waves = PTMT.waves.levelWaves(this.level);
      const s = (this.state = {
        level: this.level,
        layoutId: L.id,
        seed: L.seed,
        phase: "prep",
        endless: false,
        endlessCount: 0,
        wave: 0, // numéro de la dernière vague lancée (0 avant la première)
        waveCount: waves.length,
        waves,
        time: 0,
        waveTime: 0,
        paused: false,
        speed: 1,
        gold: C.economy.startGold[this.level] || 500,
        mana: C.mill.startMana,
        mill: { meule: 0, roue: 0, atelier: 0 },
        spells: {},
        queued: {},
        reserves: L.reserves.map((r) => ({ id: r.id, name: r.name, x: r.pos[0], z: r.pos[1], door: r.door, doorNode: r.doorNode, tier: 1, stock: [], spent: 0 })),
        treasures: [],
        towers: [],
        traps: [],
        enemies: [],
        projectiles: [],
        areas: [],
        effects: [],
        spawns: [],
        stats: { everTaken: false, lostTotal: 0, lostByReserve: {}, kos: 0, escaped: 0, goldEarned: 0 },
        result: null,
      });
      for (const id of C.spells.order) s.spells[id] = { rank: 1, cd: 0 };
      let n = 0;
      for (const r of s.reserves) {
        s.stats.lostByReserve[r.id] = 0;
        const def = L.reserves.find((x) => x.id === r.id);
        for (let i = 0; i < def.treasures; i++) {
          const t = { id: "T" + ++n, reserve: r.id, state: "stored", carrier: null, x: r.x, z: r.z, floating: false, everTaken: false };
          s.treasures.push(t);
          r.stock.push(t.id);
        }
      }
      this.recomputeMill();
      this.emit({ type: "reset" });
    }

    get isOver() {
      return this.state.phase === "victory" || this.state.phase === "defeat";
    }

    emit(ev) {
      this.events.push(ev);
    }
    drainEvents() {
      const e = this.events;
      this.events = [];
      return e;
    }
    nextId(prefix) {
      return prefix + this.uid++;
    }

    // ── Temps ─────────────────────────────────────────────────────────────────
    setPaused(p) {
      const s = this.state;
      if (s.paused === !!p) return;
      s.paused = !!p;
      this.emit({ type: "pause", paused: s.paused });
      if (!s.paused) this.flushQueued();
    }
    setSpeed(v) {
      this.state.speed = v === 2 ? 2 : 1;
    }
    /** Avance la simulation d'une durée réelle (secondes). */
    update(dtReal) {
      const s = this.state;
      if (s.paused || this.isOver) return;
      this.acc += Math.min(0.25, dtReal) * s.speed;
      let n = 0;
      while (this.acc >= TICK && n < 16) {
        this.tick(TICK);
        this.acc -= TICK;
        n++;
        if (s.paused || this.isOver) break;
      }
    }
    /** Avance exactement `seconds` de simulation (tests). */
    advance(seconds) {
      const n = Math.round(seconds / TICK);
      for (let i = 0; i < n && !this.isOver; i++) this.tick(TICK);
    }

    tick(dt) {
      const s = this.state;
      s.time += dt;
      if (s.phase !== "wave") return;
      s.waveTime += dt;
      // Mana et recharges : uniquement pendant l'attaque.
      s.mana = Math.min(s.manaMax, s.mana + s.regen * dt);
      for (const id of C.spells.order) if (s.spells[id].cd > 0) s.spells[id].cd = Math.max(0, s.spells[id].cd - dt);
      this.spawnDue();
      this.updateEffects(dt);
      this.updateAreas(dt);
      this.updateEnemies(dt);
      this.updateProjectiles(dt);
      this.updateTowers(dt);
      this.updateTraps(dt);
      this.cleanup();
      if (s.phase === "wave" && !s.spawns.length && !s.enemies.length) this.endWave();
    }

    // ── Vagues ────────────────────────────────────────────────────────────────
    nextWaveDef() {
      const s = this.state;
      if (s.endless) return PTMT.waves.endlessWave(this.L, this.level, s.endlessCount + 1);
      return s.waves[s.wave] ? { groups: s.waves[s.wave] } : null;
    }
    launchWave() {
      const s = this.state;
      if (s.phase !== "prep") return { ok: false, reason: "Une vague est déjà en cours" };
      const def = this.nextWaveDef();
      if (!def) return { ok: false, reason: "Plus de vague" };
      if (s.endless) s.endlessCount++;
      s.wave++;
      s.phase = "wave";
      s.waveTime = 0;
      s.spawns = [];
      for (const gdef of def.groups) {
        const entry = this.resolveEntry(gdef);
        for (let i = 0; i < gdef.count; i++) s.spawns.push({ at: gdef.delay + i * gdef.interval, type: gdef.type, elite: gdef.elite, entry, target: gdef.target });
      }
      s.spawns.sort((a, b) => a.at - b.at);
      this.emit({ type: "waveStart", wave: s.wave, endless: s.endless, boss: def.groups.some((g) => g.type === "boss"), eliteBoss: !!def.eliteBoss });
      return { ok: true };
    }
    resolveEntry(gdef) {
      const L = this.L;
      const swimmer = gdef.type === "nageur";
      let e = L.entries.find((x) => x.id === gdef.entry);
      if (!e || (e.kind === "water" && !swimmer)) e = L.entries.find((x) => x.kind === "land");
      return e.node;
    }
    hpMultiplier() {
      const s = this.state;
      const waveNo = s.endless ? s.waveCount + s.endlessCount : s.wave;
      let m = 1 + C.enemies.hpPerLevel * (this.level - 1) + C.enemies.hpPerWave * (waveNo - 1);
      if (s.endless) m *= 1 + C.enemies.endlessHpPerBlock * Math.floor((s.endlessCount - 1) / 5);
      return m;
    }
    spawnDue() {
      const s = this.state;
      let alive = s.enemies.length;
      while (s.spawns.length && s.spawns[0].at <= s.waveTime) {
        if (alive >= this.maxActive) {
          // Au-delà du maximum : les apparitions sont différées, jamais supprimées.
          for (const sp of s.spawns) sp.at = Math.max(sp.at, s.waveTime + 0.5);
          break;
        }
        const sp = s.spawns.shift();
        this.spawnEnemy(sp);
        alive++;
      }
    }
    endWave() {
      const s = this.state;
      // Les sacs encore au sol reviennent gratuitement à leur réserve.
      for (const t of s.treasures) if (t.state === "dropped") this.returnTreasure(t, "auto");
      s.projectiles.length = 0;
      s.areas.length = 0;
      s.effects.length = 0;
      const income = C.mill.meule.levels[s.mill.meule].income;
      s.gold += income;
      s.stats.goldEarned += income;
      this.emit({ type: "income", gold: income });
      this.emit({ type: "waveEnd", wave: s.wave });
      const saved = s.treasures.filter((t) => t.state !== "lost").length;
      if (!s.endless && s.wave >= s.waveCount) {
        if (saved >= 1) {
          s.phase = "victory";
          s.result = this.computeResult(true);
          this.emit({ type: "victory", result: s.result });
        }
        return;
      }
      s.phase = "prep";
    }
    computeResult(win) {
      const s = this.state;
      const saved = s.treasures.filter((t) => t.state !== "lost").length;
      let stars = 0;
      if (win) {
        stars = 1;
        if (s.stats.lostTotal === 0) stars = 2;
        if (!s.stats.everTaken) stars = 3;
      }
      return { win, stars, saved, total: s.treasures.length, lostByReserve: Object.assign({}, s.stats.lostByReserve), wave: s.wave, endless: s.endless, endlessCount: s.endlessCount };
    }
    /** Après une victoire : continuer sans fin avec la même disposition et les mêmes défenses. */
    continueEndless() {
      const s = this.state;
      if (s.phase !== "victory") return { ok: false, reason: "Seulement après une victoire" };
      s.endless = true;
      s.phase = "prep";
      this.emit({ type: "endless" });
      return { ok: true };
    }

    // ── Réserves et trésors ─────────────────────────────────────────────────────
    reserve(id) {
      return this.state.reserves.find((r) => r.id === id);
    }
    treasure(id) {
      return this.state.treasures.find((t) => t.id === id);
    }
    /** Transition sécurisée d'un trésor (empêche duplications et ramassages simultanés). */
    moveTreasure(t, from, to, patch = {}) {
      if (t.state !== from) return false;
      t.state = to;
      Object.assign(t, patch);
      return true;
    }
    returnTreasure(t, how) {
      if (t.state !== "dropped") return false;
      const r = this.reserve(t.reserve);
      this.moveTreasure(t, "dropped", "stored", { carrier: null, x: r.x, z: r.z, floating: false });
      r.stock.push(t.id);
      this.emit({ type: "treasureHome", id: t.id, reserve: r.id, how });
      return true;
    }
    savedCount() {
      return this.state.treasures.filter((t) => t.state !== "lost").length;
    }

    // ── Ennemis ───────────────────────────────────────────────────────────────
    speeds(e) {
      const def = C.enemies[e.type];
      if (!def.swimmer) return { land: 1, water: 1 };
      return { land: def.speed * (e.elite ? def.eliteLand : 1), water: def.waterSpeed * (e.elite ? def.eliteWater : 1) };
    }
    mover(e) {
      return C.enemies[e.type].swimmer ? "swimmer" : "walker";
    }
    spawnEnemy(sp) {
      const s = this.state;
      const def = C.enemies[sp.type];
      const hp = def.hp * this.hpMultiplier() * (sp.elite ? C.enemies.elite.hp : 1);
      const node = this.L.nodes[sp.entry];
      const e = {
        id: this.nextId("E"),
        type: sp.type,
        elite: !!sp.elite,
        klass: def.klass,
        swimmer: !!def.swimmer,
        name: sp.elite ? def.eliteName : def.name,
        hp,
        maxHp: hp,
        bounty: Math.round(def.bounty * (sp.elite ? C.enemies.elite.bounty : 1)),
        x: node.x,
        z: node.z,
        dx: 0,
        dz: 1,
        s: 0,
        route: null,
        goal: null,
        state: "walk",
        carrying: null,
        stealT: 0,
        stealRes: null,
        waitT: 0,
        retargetT: 0,
        onWater: false,
        moving: false,
        burn: null,
        slows: {},
        slow: 0,
        freezeT: 0,
        netT: 0,
        lure: null,
        wetT: 0,
        ccImmuneT: 0,
        moveImmuneT: 0,
        tenacity: 1,
        fragileT: 0,
        pendingSlow: null,
        helmet: sp.type === "voleur" && sp.elite,
        smokeUsed: false,
        untargetT: 0,
        boostT: 0,
        moveClock: 0,
        overheatT: 0,
        rageUsed: false,
        rageT: 0,
        fooled: false,
        contrib: new Set(),
        hitT: 0,
        spawnEntry: sp.entry,
        transmitted: false,
      };
      s.enemies.push(e);
      this.planFor(e, sp.target);
      this.emit({ type: "spawn", id: e.id, enemy: e });
      return e;
    }
    /** Choisit la cible d'un ennemi sans sac : réserve voulue, autre réserve, sac tombé, attente, départ. */
    planFor(e, preferred) {
      const s = this.state;
      const mover = this.mover(e),
        speeds = this.speeds(e);
      const from = e.route ? { x: e.x, z: e.z } : e.spawnEntry;
      const withStock = s.reserves.filter((r) => r.stock.length > 0);
      let pref = withStock.find((r) => r.id === preferred);
      let rt = null,
        goal = null;
      if (pref) {
        rt = R.route(this.graph, from, [pref.doorNode], mover, speeds);
        if (rt) goal = { kind: "reserve", id: pref.id };
      }
      if (!rt && withStock.length) {
        rt = R.route(this.graph, from, withStock.map((r) => r.doorNode), mover, speeds);
        if (rt) goal = { kind: "reserve", id: withStock.find((r) => r.doorNode === rt.target).id };
      }
      // Sacs tombés accessibles.
      const sack = this.nearestSack(e, from);
      if (sack && (!rt || sack.rt.cost < rt.cost * 0.8)) {
        rt = sack.rt;
        goal = { kind: "sack", id: sack.t.id };
      }
      if (rt) {
        this.setRoute(e, rt, goal);
        e.state = "walk";
        return true;
      }
      // Rien de prenable : attendre brièvement si des trésors sont transportés, sinon partir.
      const inTransit = s.treasures.some((t) => t.state === "carried");
      if (inTransit && e.state !== "wait") {
        e.state = "wait";
        e.waitT = 0;
        e.route = e.route || null;
        return false;
      }
      this.leave(e);
      return false;
    }
    nearestSack(e, from) {
      const s = this.state;
      const mover = this.mover(e),
        speeds = this.speeds(e);
      let best = null;
      for (const t of s.treasures) {
        if (t.state !== "dropped") continue;
        if (t.floating && !e.swimmer) continue;
        const loc = R.locate(this.graph, t.x, t.z, mover);
        if (!loc || loc.d > 1.2) continue;
        const rtNode = typeof from === "string" ? from : { x: from.x, z: from.z };
        // Trajet jusqu'au point du graphe le plus proche du sac : on vise les extrémités de son arête.
        const rt = R.route(this.graph, rtNode, [loc.edge.a, loc.edge.b], mover, speeds);
        if (!rt) continue;
        // Prolonge le trajet jusqu'au sac le long de son arête.
        const end = rt.pts[rt.pts.length - 1];
        const sub = R.subLine(loc.edge, rt.target === loc.edge.a ? 0 : loc.edge.length, loc.s);
        const pts = rt.pts.concat(sub.slice(1));
        const kinds = rt.kinds.concat(sub.slice(1).map(() => loc.edge.kind));
        const line = G.polyline(pts);
        if (!best || line.length < best.rt.line.length) best = { t, rt: { pts, kinds, line, cost: rt.cost + Math.abs(loc.s - (rt.target === loc.edge.a ? 0 : loc.edge.length)), target: rt.target }, end };
      }
      return best;
    }
    setRoute(e, rt, goal) {
      e.route = { line: rt.line, kinds: rt.kinds };
      e.s = 0;
      e.goal = goal;
      const p = G.at(e.route.line, 0);
      e.x = p.x;
      e.z = p.z;
    }
    leave(e) {
      const exits = this.L.exits.filter((x) => x.kind === "land" || e.swimmer).map((x) => x.node);
      const rt = R.route(this.graph, e.route ? { x: e.x, z: e.z } : e.spawnEntry, exits, this.mover(e), this.speeds(e));
      e.state = "leave";
      if (rt) this.setRoute(e, rt, { kind: "exit", id: rt.target });
      else e.state = "escaped";
    }
    flee(e) {
      const exits = this.L.exits.filter((x) => x.kind === "land" || e.swimmer).map((x) => x.node);
      const rt = R.route(this.graph, { x: e.x, z: e.z }, exits, this.mover(e), this.speeds(e));
      e.state = "flee";
      if (rt) this.setRoute(e, rt, { kind: "exit", id: rt.target });
    }
    immobile(e) {
      return e.freezeT > 0 || e.netT > 0 || e.overheatT > 0;
    }
    segKind(e) {
      const r = e.route;
      if (!r || !r.kinds.length) return "land";
      const cum = r.line.cum;
      let lo = 0,
        hi = cum.length - 1;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (cum[mid] <= e.s) lo = mid;
        else hi = mid;
      }
      return r.kinds[Math.min(lo, r.kinds.length - 1)];
    }
    currentSpeed(e) {
      const def = C.enemies[e.type];
      let v = def.speed;
      if (def.swimmer) v = e.onWater ? def.waterSpeed * (e.elite ? def.eliteWater : 1) : def.speed * (e.elite ? def.eliteLand : 1);
      if (e.boostT > 0) v *= 1 + C.enemies.sprinteur.eliteBoost.pct;
      if (e.rageT > 0) v *= 1 + C.enemies.boss.rage.pct;
      return v * (1 - e.slow);
    }
    slowCap(e) {
      return e.klass === "boss" ? C.control.boss.slowCap : e.klass === "heavy" ? C.control.heavy.slowCap : C.control.slowCap;
    }
    updateEnemies(dt) {
      const s = this.state;
      for (const e of s.enemies) {
        if (e.state === "dead" || e.state === "escaped" || e.state === "lost") continue;
        this.updateStatus(e, dt);
        if (e.state === "dead") continue;
        // Chef en tondeuse : surchauffe après 6 s de déplacement.
        if (e.type === "boss") {
          const B = C.enemies.boss;
          if (e.elite && !e.rageUsed && e.hp <= e.maxHp * B.rage.at) {
            e.rageUsed = true;
            e.rageT = B.rage.duration;
            this.emit({ type: "rage", id: e.id });
          }
          if (e.rageT > 0) {
            e.rageT -= dt;
            if (e.rageT <= 0) {
              e.overheatT = B.overheatFor;
              e.moveClock = 0;
              this.emit({ type: "overheat", id: e.id });
            }
          } else if (e.overheatT > 0) {
            e.overheatT -= dt;
            if (e.overheatT <= 0) e.moveClock = 0;
          } else if (e.moving) {
            e.moveClock += dt;
            if (e.moveClock >= B.overheatAfter) {
              e.overheatT = B.overheatFor;
              this.emit({ type: "overheat", id: e.id });
            }
          }
        }
        e.moving = false;
        switch (e.state) {
          case "steal":
            this.updateSteal(e, dt);
            break;
          case "wait":
            e.waitT += dt;
            e.retargetT -= dt;
            if (e.retargetT <= 0) {
              e.retargetT = 0.5;
              const hasStock = s.reserves.some((r) => r.stock.length) || s.treasures.some((t) => t.state === "dropped" && (!t.floating || e.swimmer));
              if (hasStock) this.planFor(e, null);
              else if (e.waitT >= C.enemies.waitForSack || !s.treasures.some((t) => t.state === "carried")) this.leave(e);
            }
            break;
          default:
            this.move(e, dt);
        }
      }
    }
    updateStatus(e, dt) {
      if (e.hitT > 0) e.hitT -= dt;
      if (e.untargetT > 0) e.untargetT -= dt;
      if (e.boostT > 0) e.boostT -= dt;
      if (e.wetT > 0) e.wetT -= dt;
      if (e.ccImmuneT > 0) e.ccImmuneT -= dt;
      if (e.moveImmuneT > 0) e.moveImmuneT -= dt;
      if (e.fragileT > 0) e.fragileT -= dt;
      const wasFrozen = e.freezeT > 0;
      if (e.freezeT > 0) e.freezeT -= dt;
      if (e.netT > 0) e.netT -= dt;
      if (wasFrozen && e.freezeT <= 0) {
        if (this.T.brittle) e.fragileT = 3;
        if (e.pendingSlow) {
          this.applySlow(e, "afterFreeze", e.pendingSlow.pct, e.pendingSlow.duration, null);
          e.pendingSlow = null;
        }
        this.emit({ type: "thaw", id: e.id });
      }
      if (e.lure) {
        e.lure.t -= dt;
        if (e.lure.t <= 0) this.endLure(e);
      }
      // Ralentissements : seul le plus fort compte, dans le plafond de la classe.
      let slow = 0;
      for (const k in e.slows) {
        const sl = e.slows[k];
        sl.t -= dt;
        if (sl.t <= 0) delete e.slows[k];
        else slow = Math.max(slow, sl.pct);
      }
      e.slow = Math.min(slow, this.slowCap(e), C.control.slowCap);
      // Brûlure.
      if (e.burn) {
        e.burn.t -= dt;
        this.damage(e, e.burn.dps * dt, "dot", e.burn.tower ? { tower: e.burn.tower, family: "fire" } : { family: "fire" });
        if (e.burn && e.burn.t <= 0) e.burn = null;
      }
    }
    move(e, dt) {
      const s = this.state;
      if (!e.route) return;
      if (this.immobile(e)) return;
      const len = e.route.line.length;
      let v = this.currentSpeed(e);
      const before = e.s;
      e.s = Math.min(len, e.s + v * dt);
      e.moving = e.s - before > 1e-5;
      const p = G.at(e.route.line, e.s);
      e.x = p.x;
      e.z = p.z;
      if (p.dx || p.dz) {
        e.dx = p.dx;
        e.dz = p.dz;
      }
      e.onWater = e.swimmer && this.segKind(e) === "water";
      // Réserve vidée pendant l'approche : on cherche mieux.
      if (e.goal && e.goal.kind === "reserve" && e.state === "walk") {
        e.retargetT -= dt;
        if (e.retargetT <= 0) {
          e.retargetT = 1;
          const r = this.reserve(e.goal.id);
          if (!r.stock.length) this.planFor(e, null);
        }
      } else if (e.goal && e.goal.kind === "sack") {
        const t = this.treasure(e.goal.id);
        if (t.state !== "dropped") this.planFor(e, null);
      }
      if (e.lure) return;
      if (e.state !== "walk" && e.state !== "flee" && e.state !== "leave") return;
      if (e.s >= len - 1e-6) this.arrive(e);
    }
    arrive(e) {
      const s = this.state;
      const goal = e.goal;
      if (!goal) return;
      if (goal.kind === "reserve") {
        const r = this.reserve(goal.id);
        if (r.stock.length) {
          e.state = "steal";
          e.stealRes = r.id;
          e.stealT = C.reserves.tiers[r.tier].stealTime;
          e.stealTotal = e.stealT;
          this.emit({ type: "stealStart", id: e.id, reserve: r.id });
        } else this.planFor(e, null);
      } else if (goal.kind === "sack") {
        const t = this.treasure(goal.id);
        if (t.state === "dropped" && Math.hypot(t.x - e.x, t.z - e.z) < 1.3 && this.moveTreasure(t, "dropped", "carried", { carrier: e.id, floating: false })) {
          e.carrying = t.id;
          this.emit({ type: "pickup", id: e.id, treasure: t.id });
          this.flee(e);
        } else this.planFor(e, null);
      } else if (goal.kind === "exit") {
        if (e.carrying) {
          const t = this.treasure(e.carrying);
          if (this.moveTreasure(t, "carried", "lost", { carrier: null })) {
            s.stats.lostTotal++;
            s.stats.lostByReserve[t.reserve]++;
            this.emit({ type: "lost", id: e.id, treasure: t.id, reserve: t.reserve });
          }
          e.carrying = null;
          e.state = "lost";
          if (this.savedCount() === 0) {
            s.phase = "defeat";
            s.result = this.computeResult(false);
            this.emit({ type: "defeat", result: s.result });
          }
        } else {
          e.state = "escaped";
          this.emit({ type: "escape", id: e.id });
        }
      }
    }
    updateSteal(e, dt) {
      const s = this.state;
      const r = this.reserve(e.stealRes);
      // Quitter la zone interrompt ; une immobilisation suspend.
      if (Math.hypot(e.x - r.door[0], e.z - r.door[1]) > C.reserves.stealRadius + 0.9) {
        e.state = "walk";
        this.planFor(e, r.id);
        this.emit({ type: "stealStop", id: e.id });
        return;
      }
      if (this.immobile(e)) return;
      if (!r.stock.length) {
        this.planFor(e, null);
        return;
      }
      e.stealT -= dt;
      if (e.stealT > 0) return;
      // Prise d'UN trésor (transition atomique).
      const tid = r.stock[r.stock.length - 1];
      const t = this.treasure(tid);
      if (!this.moveTreasure(t, "stored", "carried", { carrier: e.id, everTaken: true })) {
        this.planFor(e, null);
        return;
      }
      r.stock.pop();
      s.stats.everTaken = true;
      e.carrying = t.id;
      if (e.type === "sprinteur" && e.elite) e.boostT = C.enemies.sprinteur.eliteBoost.duration;
      this.emit({ type: "steal", id: e.id, treasure: t.id, reserve: r.id });
      this.flee(e);
    }
    /** Mise KO. */
    knockout(e, src) {
      const s = this.state;
      if (e.state === "dead") return;
      e.state = "dead";
      s.stats.kos++;
      s.gold += e.bounty;
      s.stats.goldEarned += e.bounty;
      if (e.carrying) {
        const t = this.treasure(e.carrying);
        const floating = e.swimmer && this.segKind(e) === "water";
        if (this.moveTreasure(t, "carried", "dropped", { carrier: null, x: e.x, z: e.z, floating })) this.emit({ type: "drop", id: e.id, treasure: t.id, floating });
        e.carrying = null;
      }
      // Expérience : 5 XP par tour ayant contribué (une seule fois par couple tour/ennemi).
      const bonus = s.mill.atelier >= 3 ? 1 + C.mill.atelier.levels[3].xpBonus : 1;
      for (const tid of e.contrib) {
        const tw = s.towers.find((t) => t.id === tid);
        if (tw) tw.xp += C.xp.perKo * bonus;
      }
      // Incendie contagieux (ultime) : la brûlure passe à deux voisins, sans nouvelle transmission.
      if (this.T.contagion && e.burn && !e.transmitted) {
        const near = s.enemies.filter((o) => o !== e && o.state !== "dead" && o.state !== "escaped" && o.state !== "lost" && Math.hypot(o.x - e.x, o.z - e.z) <= 1.5).sort((a, b) => Math.hypot(a.x - e.x, a.z - e.z) - Math.hypot(b.x - e.x, b.z - e.z));
        for (const o of near.slice(0, 2)) {
          this.applyBurn(o, e.burn.dps, e.burn.t0 || 3, e.burn.tower);
          o.transmitted = true;
          this.emit({ type: "contagion", from: e.id, to: o.id });
        }
      }
      this.emit({ type: "ko", id: e.id, bounty: e.bounty, x: e.x, z: e.z, by: src && src.kind });
    }
    inWater(x, z) {
      return this.L.ponds.some((p) => G.pointInPolygon(x, z, p.poly)) || this.L.streams.some((st) => G.polylineDist(x, z, st.pts) < st.width / 2);
    }
    cleanup() {
      const s = this.state;
      s.enemies = s.enemies.filter((e) => e.state !== "dead" && e.state !== "escaped" && e.state !== "lost");
    }

    // ── Dégâts et contrôles ─────────────────────────────────────────────────────
    alive(e) {
      return e && e.state !== "dead" && e.state !== "escaped" && e.state !== "lost";
    }
    sofaProtected(e) {
      // Forteresse canapé : protège les alliés à moins de 1 U derrière lui (dégâts directs −20 %).
      for (const o of this.state.enemies) {
        if (o === e || o.type !== "demenageur" || !o.elite || !this.alive(o) || o.freezeT > 0) continue;
        const vx = e.x - o.x,
          vz = e.z - o.z;
        if (vx * vx + vz * vz > 1) continue;
        if (vx * o.dx + vz * o.dz < 0) return true;
      }
      return false;
    }
    /** kind : direct | explosion | dot ; src : { tower, family, kind } */
    damage(e, amount, kind, src = {}) {
      if (!this.alive(e) || amount <= 0) return 0;
      let m = 1;
      if (e.fragileT > 0) m *= 1 + this.T.brittle;
      if (e.type === "boss" && e.overheatT > 0) m *= 1 + C.enemies.boss.overheatVuln;
      if (kind === "direct") {
        if (this.sofaProtected(e)) m *= 1 - C.enemies.demenageur.eliteShield.reduction;
        if (e.helmet) {
          m *= 0.5;
          e.helmet = false;
          this.emit({ type: "helmetOff", id: e.id });
        }
      }
      const dmg = amount * m;
      e.hp -= dmg;
      if (kind !== "dot") e.hitT = 0.18;
      if (src.tower) e.contrib.add(src.tower);
      if (e.type === "fumigene" && !e.smokeUsed) {
        e.smokeUsed = true;
        e.untargetT = e.elite ? C.enemies.fumigene.eliteSmoke : C.enemies.fumigene.smoke;
        this.emit({ type: "smoke", id: e.id });
      }
      if (e.hp <= 0) this.knockout(e, src);
      return dmg;
    }
    applyBurn(e, dps, duration, tower) {
      if (!this.alive(e)) return;
      const t = duration * this.T.burnDuration;
      if (!e.burn) e.burn = { dps, t, t0: duration, tower };
      else {
        if (dps >= e.burn.dps) {
          e.burn.dps = dps;
          e.burn.tower = tower || e.burn.tower;
        }
        e.burn.t = Math.max(e.burn.t, t);
      }
      if (tower) e.contrib.add(tower);
    }
    applySlow(e, key, pct, duration, tower) {
      if (!this.alive(e) || pct <= 0) return;
      const cur = e.slows[key];
      if (!cur || pct >= cur.pct) e.slows[key] = { pct, t: duration };
      else cur.t = Math.max(cur.t, duration);
      if (tower) e.contrib.add(tower);
    }
    applyWet(e, duration) {
      e.wetT = Math.max(e.wetT, duration + this.T.wetBonus);
    }
    classDuration(e) {
      return e.klass === "boss" ? C.control.boss.duration : e.klass === "heavy" ? C.control.heavy.duration : 1;
    }
    classDisplacement(e, water) {
      if (e.klass === "boss") return water ? this.T.bossWater : C.control.boss.displacement;
      if (e.klass === "heavy") return water ? this.T.heavyWater : C.control.heavy.displacement;
      return 1;
    }
    strongControlled(e) {
      e.tenacity = Math.max(C.control.tenacityMin, e.tenacity * C.control.tenacityFactor);
    }
    /** Immobilisation (gel, filet). Renvoie la durée effective (0 si sans effet). */
    immobilize(e, kind, duration, src = {}) {
      if (!this.alive(e) || e.ccImmuneT > 0) return 0;
      let d = duration * this.classDuration(e) * e.tenacity;
      if (kind === "freeze") {
        d *= this.T.freezeDuration;
        if (e.wetT > 0) d *= this.T.wetFreeze;
      }
      if (e.klass === "normal") d = Math.min(d, C.control.maxImmobilize);
      if (d <= 0.02) return 0;
      if (kind === "freeze") e.freezeT = Math.max(e.freezeT, d);
      else e.netT = Math.max(e.netT, d);
      e.ccImmuneT = d + C.control.immobileImmunity;
      this.strongControlled(e);
      if (src.tower) e.contrib.add(src.tower);
      this.emit({ type: kind, id: e.id, duration: d });
      if (kind === "freeze" && this.T.shatter) {
        const near = this.state.enemies.filter((o) => o !== e && this.alive(o) && Math.hypot(o.x - e.x, o.z - e.z) <= 1.3).slice(0, 3);
        for (const o of near) this.damage(o, this.T.shatter, "explosion", { family: "ice", kind: "shards" });
        if (near.length) this.emit({ type: "shards", id: e.id });
      }
      return d;
    }
    /** Recul le long du trajet, à l'opposé du déplacement actuel. */
    push(e, distance, src = {}) {
      if (!this.alive(e) || e.moveImmuneT > 0 || !e.route) return 0;
      let d = distance * this.classDisplacement(e, src.family === "water") * e.tenacity;
      if (src.family === "water") d *= this.T.push;
      if (d <= 0.02) return 0;
      const before = e.s;
      e.s = Math.max(0, e.s - d);
      const moved = before - e.s;
      if (moved <= 0.01) return 0;
      const p = G.at(e.route.line, e.s);
      e.x = p.x;
      e.z = p.z;
      if (e.state === "steal") {
        e.state = "walk";
        this.emit({ type: "stealStop", id: e.id });
      }
      e.moveImmuneT = C.control.moveImmunity;
      this.strongControlled(e);
      if (src.tower) e.contrib.add(src.tower);
      this.emit({ type: "knockback", id: e.id, distance: moved });
      return moved;
    }
    /** Attraction vers un point, sans quitter le chemin praticable. */
    pull(e, cx, cz, distance, src = {}) {
      if (!this.alive(e) || e.moveImmuneT > 0 || !e.route) return 0;
      let d = distance * this.classDisplacement(e, true) * e.tenacity * this.T.push;
      if (d <= 0.02) return 0;
      const pr = G.project(e.route.line, cx, cz, Math.max(0, e.s - d), Math.min(e.route.line.length, e.s + d));
      const target = pr.s;
      const delta = Math.max(-d, Math.min(d, target - e.s));
      if (Math.abs(delta) <= 0.02) return 0;
      e.s += delta;
      const p = G.at(e.route.line, e.s);
      e.x = p.x;
      e.z = p.z;
      if (e.state === "steal" && Math.abs(delta) > 0.3) {
        e.state = "walk";
        this.emit({ type: "stealStop", id: e.id });
      }
      e.moveImmuneT = C.control.moveImmunity;
      this.strongControlled(e);
      if (src.tower) e.contrib.add(src.tower);
      this.emit({ type: "pull", id: e.id, distance: Math.abs(delta), x: cx, z: cz });
      return Math.abs(delta);
    }
    /** Leurre du faux coffre : le voleur marche vers le coffre (par les chemins) puis s'y arrête. */
    lureTo(e, x, z, duration) {
      if (!this.alive(e) || e.ccImmuneT > 0 || e.carrying || e.fooled || e.type === "boss" || !e.route) return false;
      if (e.state !== "walk" && e.state !== "leave") return false;
      const d = duration * this.classDuration(e) * e.tenacity;
      if (d <= 0.05) return false;
      const mover = this.mover(e);
      const loc = R.locate(this.graph, x, z, mover);
      if (!loc) return false;
      const rt = R.route(this.graph, { x: e.x, z: e.z }, [loc.edge.a, loc.edge.b], mover, this.speeds(e));
      if (!rt) return false;
      const sub = R.subLine(loc.edge, rt.target === loc.edge.a ? 0 : loc.edge.length, loc.s);
      const pts = rt.pts.concat(sub.slice(1));
      const kinds = rt.kinds.concat(sub.slice(1).map(() => loc.edge.kind));
      e.lure = { t: d, x, z, prevGoal: e.goal, prevState: e.state };
      e.route = { line: G.polyline(pts), kinds };
      e.s = 0;
      e.goal = { kind: "lure" };
      e.ccImmuneT = d + C.control.immobileImmunity;
      this.strongControlled(e);
      this.emit({ type: "lured", id: e.id, x, z });
      return true;
    }
    endLure(e) {
      const prev = e.lure;
      e.lure = null;
      e.fooled = true;
      this.emit({ type: "fooled", id: e.id });
      if (prev.prevState === "leave") this.leave(e);
      else this.planFor(e, prev.prevGoal && prev.prevGoal.kind === "reserve" ? prev.prevGoal.id : null);
    }

    // ── Cibles ────────────────────────────────────────────────────────────────
    targetable(e, direct) {
      if (!this.alive(e)) return false;
      if (direct && e.untargetT > 0) {
        // Le coffre hurleur révèle les voleurs au fumigène pendant leur tentative.
        if (!(e.state === "steal" && this.reserve(e.stealRes).tier >= 3)) return false;
      }
      return true;
    }
    los(ax, az, bx, bz) {
      for (const poly of this.L.blockers) if (G.segmentHitsPolygon(ax, az, bx, bz, poly)) return false;
      return true;
    }
    remaining(e) {
      return e.route ? e.route.line.length - e.s : Infinity;
    }
    /** Meilleure cible d'une tour selon son mode de ciblage. */
    pickTarget(tw, range, direct) {
      const s = this.state;
      let best = null,
        bestScore = Infinity;
      for (const e of s.enemies) {
        if (!this.targetable(e, direct)) continue;
        const d = Math.hypot(e.x - tw.x, e.z - tw.z);
        if (d > range) continue;
        if (direct && !this.los(tw.x, tw.z, e.x, e.z)) continue;
        let score;
        const carrying = e.carrying ? 0 : 1;
        if (tw.targeting === "advanced") score = this.remaining(e);
        else if (tw.targeting === "tough") score = -e.hp;
        else score = carrying * 10000 + this.remaining(e);
        if (score < bestScore) {
          bestScore = score;
          best = e;
        }
      }
      return best;
    }
    enemiesIn(x, z, r) {
      const r2 = r * r;
      return this.state.enemies.filter((e) => this.alive(e) && (e.x - x) * (e.x - x) + (e.z - z) * (e.z - z) <= r2);
    }

    // ── Tours ─────────────────────────────────────────────────────────────────
    socket(id) {
      return this.L.sockets.find((s) => s.id === id);
    }
    towerAt(socketId) {
      return this.state.towers.find((t) => t.socket === socketId);
    }
    /** Statistiques finales d'une tour (talents compris). */
    towerStats(tw) {
      const fam = C.towers[tw.family];
      const f = Object.assign({}, fam.forms[formKey(tw.tier, tw.branch)]);
      const T = this.T;
      if (tw.family === "fire") {
        f.burn = { dps: fam.burn[tw.tier].dps, duration: fam.burn[tw.tier].duration * T.burnDuration };
        if (f.damage) f.damage *= T.fireDamage;
        if (f.splash) f.splash *= T.explosionRadius;
        if (f.ground) f.ground = { dps: f.ground.dps * T.fireDamage, duration: f.ground.duration * T.burnDuration, radius: f.splash };
        f.burn.dps *= T.fireDamage;
      }
      if (tw.family === "ice") {
        f.range *= T.iceRange;
        if (f.slow) f.slow = { pct: f.slow.pct + T.iceSlow, duration: f.slow.duration };
        if (f.stormSlow) f.stormSlow += T.iceSlow;
        if (f.freeze) f.freeze *= T.freezeDuration;
        if (f.stormFreeze) f.stormFreeze *= T.freezeDuration;
      }
      if (tw.family === "water") {
        f.wet = fam.wet + T.wetBonus;
        if (f.push) f.push *= T.push;
        if (f.pull) f.pull *= T.push;
        if (f.vortexRadius) f.vortexRadius *= T.waterArea;
      }
      f.rate = 1 + (tw.frenzyT > 0 ? tw.frenzyRate : 0);
      return f;
    }
    atelierTier() {
      return C.mill.atelier.levels[this.state.mill.atelier].tierAllowed;
    }
    build(socketId, family) {
      const s = this.state;
      if (this.isOver) return { ok: false, reason: "Partie terminée" };
      const so = this.socket(socketId);
      if (!so) return { ok: false, reason: "Support inconnu" };
      if (this.towerAt(socketId)) return { ok: false, reason: "Support occupé" };
      if (FAMILY_SOCKET[family] !== so.kind) return { ok: false, reason: `Ce support accueille les tours ${C.towers[so.kind].name.toLowerCase()}` };
      const cost = C.towers[family].forms["1"].cost;
      if (s.gold < cost) return { ok: false, reason: `Il manque ${cost - s.gold} or` };
      s.gold -= cost;
      const tw = { id: this.nextId("W"), socket: so.id, x: so.x, z: so.z, family, tier: 1, branch: null, xp: 0, spent: cost, cd: 0.4, shots: 0, targeting: "auto", yaw: 0, frenzyT: 0, frenzyRate: 0, storm: null, stormNext: 0 };
      s.towers.push(tw);
      this.emit({ type: "build", id: tw.id, tower: tw });
      return { ok: true, tower: tw };
    }
    upgradeInfo(tw) {
      const s = this.state;
      if (tw.tier >= 3) return { max: true };
      const nextTier = tw.tier + 1;
      const branches = tw.tier === 1 ? ["A", "B"] : [tw.branch];
      const needXp = nextTier === 2 ? C.xp.tier2 : C.xp.tier3;
      const needAtelier = nextTier - 1;
      return {
        nextTier,
        options: branches.map((b) => {
          const f = C.towers[tw.family].forms[formKey(nextTier, b)];
          let reason = null;
          if (tw.xp < needXp) reason = `${Math.floor(tw.xp)}/${needXp} XP`;
          else if (s.mill.atelier < needAtelier) reason = `Atelier ${["", "I", "II", "III"][needAtelier]} requis`;
          else if (s.gold < f.cost) reason = `Il manque ${f.cost - s.gold} or`;
          return { branch: b, name: f.name, cost: f.cost, reason };
        }),
        needXp,
        needAtelier,
      };
    }
    upgradeTower(towerId, branch) {
      const s = this.state;
      const tw = s.towers.find((t) => t.id === towerId);
      if (!tw) return { ok: false, reason: "Tour inconnue" };
      const info = this.upgradeInfo(tw);
      if (info.max) return { ok: false, reason: "Évolution finale atteinte" };
      const opt = info.options.find((o) => o.branch === (tw.tier === 1 ? branch : tw.branch));
      if (!opt) return { ok: false, reason: "Choisis une spécialisation" };
      if (opt.reason) return { ok: false, reason: opt.reason };
      s.gold -= opt.cost;
      tw.spent += opt.cost;
      tw.tier = info.nextTier;
      tw.branch = opt.branch;
      tw.shots = 0;
      tw.storm = null;
      this.emit({ type: "upgrade", id: tw.id, tower: tw });
      return { ok: true };
    }
    sellValue(obj) {
      return Math.floor(obj.spent * C.economy.sellRatio);
    }
    sellTower(towerId) {
      const s = this.state;
      const i = s.towers.findIndex((t) => t.id === towerId);
      if (i < 0) return { ok: false, reason: "Tour inconnue" };
      const tw = s.towers[i];
      const v = this.sellValue(tw);
      s.gold += v;
      s.towers.splice(i, 1);
      s.areas = s.areas.filter((a) => a.tower !== tw.id);
      this.emit({ type: "sell", id: tw.id, gold: v });
      return { ok: true, gold: v };
    }
    setTargeting(towerId, mode) {
      const tw = this.state.towers.find((t) => t.id === towerId);
      if (tw && ["auto", "carriers", "advanced", "tough"].includes(mode)) tw.targeting = mode;
    }
    updateTowers(dt) {
      const s = this.state;
      for (const tw of s.towers) {
        if (tw.frenzyT > 0) {
          tw.frenzyT -= dt;
          if (tw.frenzyT <= 0) tw.frenzyRate = 0;
        }
        const f = this.towerStats(tw);
        tw.cd -= dt * f.rate;
        if (f.attack === "storm") {
          this.towerStorm(tw, f, dt);
          continue;
        }
        if (tw.cd > 0) continue;
        const direct = !!f.direct;
        const target = this.pickTarget(tw, f.range, direct);
        if (!target) {
          tw.cd = Math.min(tw.cd, 0);
          continue;
        }
        tw.yaw = Math.atan2(target.x - tw.x, target.z - tw.z);
        tw.cd = f.period;
        tw.shots++;
        this.fire(tw, f, target);
      }
    }
    fire(tw, f, target) {
      const s = this.state;
      const base = { tower: tw.id, family: tw.family, x: tw.x, z: tw.z };
      switch (f.attack) {
        case "fireball":
          this.projectile("fireball", tw, target, 11, { damage: f.damage, splash: f.splash, burn: f.burn, direct: true });
          break;
        case "lava":
          this.projectile("lavaShell", tw, target, 0, { damage: f.damage, splash: f.splash, burn: f.burn, ground: f.ground, flight: 1.05 });
          break;
        case "shard":
          this.projectile("iceShard", tw, target, 16, { damage: f.damage, slow: f.slow, direct: true });
          break;
        case "spike": {
          const freeze = f.freezeEvery && tw.shots % f.freezeEvery === 0;
          this.projectile("iceSpike", tw, target, 14, { damage: f.damage, slow: f.slow, direct: true, freeze: freeze ? f.freeze : 0, neighbours: f.freezeNeighbours || 0, neighbourRadius: f.neighbourRadius || 0 });
          break;
        }
        case "jet": {
          const push = f.pushEvery && tw.shots % f.pushEvery === 0 ? f.push : 0;
          this.projectile("waterJet", tw, target, 15, { damage: f.damage, wet: f.wet, push, direct: true });
          break;
        }
        case "cone": {
          const half = ((f.coneDeg * Math.PI) / 180) * 0.5;
          const dx = (target.x - tw.x) / (Math.hypot(target.x - tw.x, target.z - tw.z) || 1),
            dz = (target.z - tw.z) / (Math.hypot(target.x - tw.x, target.z - tw.z) || 1);
          for (const e of this.enemiesIn(tw.x, tw.z, f.range)) {
            if (!this.targetable(e, false)) continue;
            if (G.angleTo(tw.x, tw.z, dx, dz, e.x, e.z) > half) continue;
            if (!this.los(tw.x, tw.z, e.x, e.z)) continue;
            this.damage(e, f.damage, "direct", base);
            this.applyBurn(e, f.burn.dps, f.burn.duration / this.T.burnDuration, tw.id);
          }
          this.emit({ type: "cone", tower: tw.id, kind: "flame", x: tw.x, z: tw.z, yaw: tw.yaw, angle: f.coneDeg, range: f.range, mouths: f.mouths || 1 });
          break;
        }
        case "line": {
          const L = f.range,
            dx = (target.x - tw.x) / (Math.hypot(target.x - tw.x, target.z - tw.z) || 1),
            dz = (target.z - tw.z) / (Math.hypot(target.x - tw.x, target.z - tw.z) || 1);
          const hits = [];
          for (const e of this.enemiesIn(tw.x, tw.z, L)) {
            if (!this.targetable(e, true)) continue;
            const along = (e.x - tw.x) * dx + (e.z - tw.z) * dz;
            if (along < 0) continue;
            const across = Math.abs((e.x - tw.x) * dz - (e.z - tw.z) * dx);
            if (across > f.lineWidth / 2 + 0.25) continue;
            if (!this.los(tw.x, tw.z, e.x, e.z)) continue;
            hits.push({ e, along });
          }
          hits.sort((a, b) => a.along - b.along);
          for (const h of hits.slice(0, f.maxTargets)) this.waterHit(h.e, f, tw);
          this.emit({ type: "blast", tower: tw.id, kind: "line", x: tw.x, z: tw.z, yaw: tw.yaw, range: L });
          break;
        }
        case "wave": {
          const half = ((f.coneDeg * Math.PI) / 180) * 0.5;
          const dx = (target.x - tw.x) / (Math.hypot(target.x - tw.x, target.z - tw.z) || 1),
            dz = (target.z - tw.z) / (Math.hypot(target.x - tw.x, target.z - tw.z) || 1);
          const hits = this.enemiesIn(tw.x, tw.z, f.range)
            .filter((e) => this.targetable(e, true) && G.angleTo(tw.x, tw.z, dx, dz, e.x, e.z) <= half && this.los(tw.x, tw.z, e.x, e.z))
            .sort((a, b) => Math.hypot(a.x - tw.x, a.z - tw.z) - Math.hypot(b.x - tw.x, b.z - tw.z));
          for (const e of hits.slice(0, f.maxTargets)) this.waterHit(e, f, tw);
          this.emit({ type: "cone", tower: tw.id, kind: "waterCone", x: tw.x, z: tw.z, yaw: tw.yaw, angle: f.coneDeg, range: f.range });
          break;
        }
        case "vortex": {
          const a = {
            id: this.nextId("A"),
            kind: "vortex",
            big: tw.tier === 3,
            tower: tw.id,
            x: target.x,
            z: target.z,
            r: f.vortexRadius,
            t: f.vortexDuration,
            dur: f.vortexDuration,
            dps: f.vortexDps,
            slow: f.vortexSlow,
            splash: f.finalSplash || 0,
            wet: f.wet,
            secondPull: this.T.insatiable,
            pull: f.pull,
          };
          s.areas.push(a);
          for (const e of this.enemiesIn(a.x, a.z, a.r)) {
            this.pull(e, a.x, a.z, f.pull / this.T.push, { tower: tw.id, family: "water" });
            this.applyWet(e, f.wet - this.T.wetBonus);
          }
          this.emit({ type: "area", area: a });
          break;
        }
      }
      this.emit({ type: "fire", tower: tw.id, attack: f.attack, target: target.id });
    }
    waterHit(e, f, tw) {
      this.damage(e, f.damage, "direct", { tower: tw.id, family: "water" });
      this.applyWet(e, f.wet - this.T.wetBonus);
      if (f.push) this.push(e, f.push / this.T.push, { tower: tw.id, family: "water" });
    }
    towerStorm(tw, f, dt) {
      const s = this.state;
      const cur = tw.storm && s.areas.find((a) => a.id === tw.storm);
      if (cur) return;
      tw.storm = null;
      if (tw.cd > 0) return;
      const target = this.pickTarget(tw, f.range, false);
      if (!target) return;
      tw.yaw = Math.atan2(target.x - tw.x, target.z - tw.z);
      const a = { id: this.nextId("A"), kind: "storm", big: tw.tier === 3, tower: tw.id, x: target.x, z: target.z, r: f.stormRadius, t: f.stormDuration, dur: f.stormDuration, dps: f.stormDps, slow: f.stormSlow };
      s.areas.push(a);
      tw.storm = a.id;
      tw.cd = 0.25;
      if (f.stormFreeze) for (const e of this.enemiesIn(a.x, a.z, a.r)) this.immobilize(e, "freeze", f.stormFreeze / this.T.freezeDuration, { tower: tw.id });
      this.emit({ type: "area", area: a });
      this.emit({ type: "fire", tower: tw.id, attack: "storm", target: target.id });
    }

    // ── Projectiles ───────────────────────────────────────────────────────────
    projectile(kind, tw, target, speed, payload) {
      const s = this.state;
      const p = { id: this.nextId("P"), kind, tower: tw.id, family: tw.family, x: tw.x, z: tw.z, fx: tw.x, fz: tw.z, tx: target.x, tz: target.z, target: target.id, speed, t: 0, payload };
      if (payload.flight) p.flight = payload.flight;
      s.projectiles.push(p);
      this.emit({ type: "projectile", projectile: p });
    }
    updateProjectiles(dt) {
      const s = this.state;
      const keep = [];
      for (const p of s.projectiles) {
        const target = s.enemies.find((e) => e.id === p.target);
        if (target && this.alive(target) && !p.flight) {
          p.tx = target.x;
          p.tz = target.z;
        }
        p.t += dt;
        let arrived = false;
        if (p.flight) {
          const k = Math.min(1, p.t / p.flight);
          p.x = p.fx + (p.tx - p.fx) * k;
          p.z = p.fz + (p.tz - p.fz) * k;
          p.arc = Math.sin(k * Math.PI);
          arrived = k >= 1;
        } else {
          const dx = p.tx - p.x,
            dz = p.tz - p.z,
            d = Math.hypot(dx, dz);
          const step = p.speed * dt;
          if (d <= step + 0.05) {
            p.x = p.tx;
            p.z = p.tz;
            arrived = true;
          } else {
            p.x += (dx / d) * step;
            p.z += (dz / d) * step;
          }
        }
        if (arrived) this.impact(p, target && this.alive(target) ? target : null);
        else keep.push(p);
      }
      s.projectiles = keep;
    }
    impact(p, target) {
      const s = this.state;
      const P = p.payload;
      const src = { tower: p.tower, family: p.family };
      switch (p.kind) {
        case "fireball": {
          if (target) {
            this.damage(target, P.damage, "direct", src);
            this.applyBurn(target, P.burn.dps, P.burn.duration / this.T.burnDuration, p.tower);
          }
          for (const e of this.enemiesIn(p.x, p.z, P.splash)) {
            if (e === target) continue;
            this.damage(e, P.damage, "explosion", src);
            this.applyBurn(e, P.burn.dps, P.burn.duration / this.T.burnDuration, p.tower);
          }
          this.emit({ type: "explode", kind: "fire", x: p.x, z: p.z, r: P.splash });
          break;
        }
        case "lavaShell": {
          for (const e of this.enemiesIn(p.x, p.z, P.splash)) {
            this.damage(e, P.damage, "explosion", src);
            this.applyBurn(e, P.burn.dps, P.burn.duration / this.T.burnDuration, p.tower);
          }
          const a = { id: this.nextId("A"), kind: "groundFire", tower: p.tower, x: p.x, z: p.z, r: P.ground.radius, t: P.ground.duration, dur: P.ground.duration, dps: P.ground.dps, big: P.splash > 2 };
          s.areas.push(a);
          this.emit({ type: "explode", kind: "lava", x: p.x, z: p.z, r: P.splash });
          this.emit({ type: "area", area: a });
          break;
        }
        case "iceShard":
        case "iceSpike": {
          if (!target) break;
          this.damage(target, P.damage, "direct", src);
          this.applySlow(target, "ice", Math.min(1, P.slow.pct), P.slow.duration, p.tower);
          if (P.freeze) {
            this.immobilize(target, "freeze", P.freeze / this.T.freezeDuration, src);
            if (P.neighbours) {
              const near = this.enemiesIn(target.x, target.z, P.neighbourRadius)
                .filter((e) => e !== target)
                .sort((a, b) => Math.hypot(a.x - target.x, a.z - target.z) - Math.hypot(b.x - target.x, b.z - target.z));
              for (const e of near.slice(0, P.neighbours)) this.immobilize(e, "freeze", P.freeze / this.T.freezeDuration, src);
            }
          }
          this.emit({ type: "explode", kind: p.kind === "iceSpike" ? "iceBig" : "ice", x: p.x, z: p.z, r: 0.6 });
          break;
        }
        case "waterJet": {
          if (!target) break;
          this.damage(target, P.damage, "direct", src);
          this.applyWet(target, P.wet - this.T.wetBonus);
          if (P.push) this.push(target, P.push / this.T.push, src);
          this.emit({ type: "explode", kind: "splash", x: p.x, z: p.z, r: 0.6 });
          break;
        }
      }
    }

    // ── Zones (sols incendiés, tempêtes, vortex) ─────────────────────────────────
    updateAreas(dt) {
      const s = this.state;
      const best = new Map(); // ennemi → { groundFire, storm, vortex }
      for (const a of s.areas) {
        a.t -= dt;
        if (a.kind === "vortex" && a.secondPull && !a.pulled2 && a.t <= a.dur / 2) {
          a.pulled2 = true;
          for (const e of this.enemiesIn(a.x, a.z, a.r)) if (e.wetT > 0) this.pull(e, a.x, a.z, a.pull / this.T.push, { tower: a.tower, family: "water" });
          this.emit({ type: "vortexPull", area: a.id });
        }
        for (const e of this.enemiesIn(a.x, a.z, a.r)) {
          let slot = best.get(e);
          if (!slot) best.set(e, (slot = {}));
          const cur = slot[a.kind];
          if (!cur || a.dps > cur.dps) slot[a.kind] = a;
        }
      }
      for (const [e, slot] of best) {
        for (const kind in slot) {
          const a = slot[kind];
          this.damage(e, a.dps * dt, "dot", { tower: a.tower, family: kind === "groundFire" ? "fire" : kind === "storm" ? "ice" : "water" });
          if (a.slow) this.applySlow(e, kind, a.slow, 0.25, a.tower);
        }
      }
      const keep = [];
      for (const a of s.areas) {
        if (a.t > 0) keep.push(a);
        else {
          if (a.kind === "vortex" && a.splash) {
            for (const e of this.enemiesIn(a.x, a.z, a.r)) this.damage(e, a.splash, "explosion", { tower: a.tower, family: "water" });
            this.emit({ type: "explode", kind: "vortexSplash", x: a.x, z: a.z, r: a.r });
          }
          this.emit({ type: "areaEnd", id: a.id });
        }
      }
      s.areas = keep;
    }

    // ── Pièges ────────────────────────────────────────────────────────────────
    trapSlot(id) {
      return this.L.trapSlots.find((t) => t.id === id);
    }
    trapLimit() {
      return C.mill.atelier.levels[this.state.mill.atelier].trapLimit;
    }
    defaultSpringDir(slot) {
      // Le ressort renvoie par défaut les voleurs qui montent vers une réserve.
      const E = this.graph.byId.get(slot.edge);
      const doors = this.state.reserves.map((r) => r.doorNode);
      const da = R.dijkstra(this.graph, [{ node: E.a, cost: 0 }]).dist;
      const db = R.dijkstra(this.graph, [{ node: E.b, cost: 0 }]).dist;
      const minA = Math.min(...doors.map((d) => da.get(d) ?? Infinity));
      const minB = Math.min(...doors.map((d) => db.get(d) ?? Infinity));
      // Direction du ressort : de la réserve vers l'entrée (+1 = sens a → b de l'arête).
      return minB < minA ? -1 : 1;
    }
    buildTrap(slotId, kind) {
      const s = this.state;
      const slot = this.trapSlot(slotId);
      if (!slot) return { ok: false, reason: "Emplacement inconnu" };
      if (s.traps.some((t) => t.slot === slotId)) return { ok: false, reason: "Emplacement occupé" };
      if (s.traps.length >= this.trapLimit()) return { ok: false, reason: `Limite de ${this.trapLimit()} pièges (améliore l'Atelier)` };
      const def = C.traps[kind];
      if (!def) return { ok: false, reason: "Piège inconnu" };
      const cost = def.tiers[1].cost;
      if (s.gold < cost) return { ok: false, reason: `Il manque ${cost - s.gold} or` };
      s.gold -= cost;
      const tr = { id: this.nextId("R"), slot: slotId, x: slot.x, z: slot.z, kind, tier: 1, spent: cost, cd: 0, dir: kind === "spring" ? this.defaultSpringDir(slot) : 1, fired: 0 };
      s.traps.push(tr);
      this.emit({ type: "buildTrap", id: tr.id, trap: tr });
      return { ok: true, trap: tr };
    }
    upgradeTrap(trapId) {
      const s = this.state;
      const tr = s.traps.find((t) => t.id === trapId);
      if (!tr) return { ok: false, reason: "Piège inconnu" };
      if (tr.tier >= 3) return { ok: false, reason: "Palier maximum" };
      const next = tr.tier + 1;
      if (s.mill.atelier < next - 1) return { ok: false, reason: `Atelier ${["", "I", "II"][next - 1]} requis` };
      const cost = C.traps[tr.kind].tiers[next].cost;
      if (s.gold < cost) return { ok: false, reason: `Il manque ${cost - s.gold} or` };
      s.gold -= cost;
      tr.spent += cost;
      tr.tier = next;
      this.emit({ type: "upgradeTrap", id: tr.id, trap: tr });
      return { ok: true };
    }
    sellTrap(trapId) {
      const s = this.state;
      const i = s.traps.findIndex((t) => t.id === trapId);
      if (i < 0) return { ok: false, reason: "Piège inconnu" };
      const v = this.sellValue(s.traps[i]);
      s.gold += v;
      this.emit({ type: "sellTrap", id: s.traps[i].id, gold: v });
      s.traps.splice(i, 1);
      return { ok: true, gold: v };
    }
    flipSpring(trapId) {
      const tr = this.state.traps.find((t) => t.id === trapId);
      if (tr && tr.kind === "spring") tr.dir *= -1;
    }
    updateTraps(dt) {
      const s = this.state;
      const cdMul = s.mill.atelier >= 3 ? C.mill.atelier.levels[3].trapCooldown : 1;
      for (const tr of s.traps) {
        if (tr.cd > 0) {
          tr.cd -= dt;
          continue;
        }
        const T = C.traps[tr.kind].tiers[tr.tier];
        let affected = 0;
        if (tr.kind === "net") {
          const cands = this.enemiesIn(tr.x, tr.z, T.radius).filter((e) => e.ccImmuneT <= 0 && !e.onWater);
          cands.sort((a, b) => Math.hypot(a.x - tr.x, a.z - tr.z) - Math.hypot(b.x - tr.x, b.z - tr.z));
          for (const e of cands.slice(0, T.targets)) if (this.immobilize(e, "net", T.duration)) affected++;
        } else if (tr.kind === "spring") {
          const slot = this.trapSlot(tr.slot);
          const sdx = slot.dx * tr.dir,
            sdz = slot.dz * tr.dir;
          const cands = this.enemiesIn(tr.x, tr.z, T.radius).filter((e) => e.moveImmuneT <= 0 && e.route && e.dx * sdx + e.dz * sdz < -0.2);
          for (const e of cands.slice(0, T.targets)) if (this.push(e, T.push, { family: "trap" })) affected++;
        } else if (tr.kind === "lure") {
          const cands = this.enemiesIn(tr.x, tr.z, T.radius).filter((e) => !e.carrying && !e.fooled && e.type !== "boss" && e.ccImmuneT <= 0);
          cands.sort((a, b) => Math.hypot(a.x - tr.x, a.z - tr.z) - Math.hypot(b.x - tr.x, b.z - tr.z));
          for (const e of cands) {
            if (affected >= T.targets) break;
            if (this.lureTo(e, tr.x, tr.z, T.duration)) affected++;
          }
        }
        if (affected) {
          tr.cd = T.cooldown * cdMul;
          tr.fired++;
          this.emit({ type: "trap", id: tr.id, kind: tr.kind, count: affected });
        }
      }
    }

    // ── Moulin, réserves, sorts : améliorations ────────────────────────────────────
    recomputeMill() {
      const s = this.state;
      const roue = C.mill.roue.levels[s.mill.roue];
      s.manaMax = roue.manaMax;
      s.regen = roue.regen;
      s.mana = Math.min(s.mana, s.manaMax);
    }
    upgradeMill(kind) {
      const s = this.state;
      const def = C.mill[kind];
      if (!def) return { ok: false, reason: "Amélioration inconnue" };
      const next = s.mill[kind] + 1;
      if (next >= def.levels.length) return { ok: false, reason: "Niveau maximum" };
      const cost = def.levels[next].cost;
      if (s.gold < cost) return { ok: false, reason: `Il manque ${cost - s.gold} or` };
      s.gold -= cost;
      s.mill[kind] = next;
      this.recomputeMill();
      this.emit({ type: "mill", kind, level: next });
      return { ok: true };
    }
    upgradeReserve(id) {
      const s = this.state;
      const r = this.reserve(id);
      if (!r) return { ok: false, reason: "Réserve inconnue" };
      if (r.tier >= 3) return { ok: false, reason: "Palier maximum" };
      const T = C.reserves.tiers[r.tier + 1];
      if (s.mill.atelier < T.atelier) return { ok: false, reason: `Atelier ${["", "I", "II"][T.atelier]} requis` };
      if (s.gold < T.cost) return { ok: false, reason: `Il manque ${T.cost - s.gold} or` };
      s.gold -= T.cost;
      r.spent += T.cost;
      r.tier++;
      this.emit({ type: "reserve", id: r.id, tier: r.tier });
      return { ok: true };
    }
    upgradeSpell(id) {
      const s = this.state;
      const sp = s.spells[id];
      if (!sp || !this.unlocked.has(id)) return { ok: false, reason: "Sort non débloqué" };
      if (sp.rank >= 3) return { ok: false, reason: "Rang maximum" };
      const next = sp.rank + 1;
      if (s.mill.atelier < C.spells.rankAtelier[next]) return { ok: false, reason: `Atelier ${["", "I", "II"][C.spells.rankAtelier[next]]} requis` };
      const cost = C.spells.rankCost[next];
      if (s.gold < cost) return { ok: false, reason: `Il manque ${cost - s.gold} or` };
      s.gold -= cost;
      sp.rank = next;
      this.emit({ type: "spellRank", id, rank: next });
      return { ok: true };
    }

    // ── Sorts ─────────────────────────────────────────────────────────────────
    spellMana(id) {
      const m = C.spells[id].mana;
      return id === "freeze" ? Math.round(m * this.T.freezeMana) : m;
    }
    spellCooldown(id) {
      const c = C.spells[id].cooldown;
      return id === "meteor" ? c * this.T.meteorCooldown : c;
    }
    /** Valeurs finales d'un sort à son rang actuel (talents compris) — affichées par l'interface. */
    spellStats(id) {
      const s = this.state;
      const r = C.spells[id].ranks[s.spells[id].rank];
      const T = this.T;
      const out = Object.assign({}, r, { mana: this.spellMana(id), cooldown: this.spellCooldown(id) });
      if (id === "meteor") {
        out.damage = r.damage * T.meteorDamage;
        out.radius = r.radius * T.explosionRadius;
        out.ground = { dps: r.ground.dps * T.meteorDamage, duration: r.ground.duration * T.burnDuration };
      }
      if (id === "freeze") out.freeze = r.freeze * T.freezeDuration;
      if (id === "flood") {
        out.length = r.length * T.waterArea;
        out.width = r.width * T.waterArea;
        out.push = r.push * T.push;
        out.wet = r.wet + T.wetBonus;
      }
      return out;
    }
    /** Raison d'indisponibilité d'un sort (ou null). */
    spellBlocked(id) {
      const s = this.state;
      if (!this.unlocked.has(id)) return `Débloqué au niveau ${C.spells.unlockLevel[id]}`;
      if (s.phase !== "wave") return "Pendant une attaque seulement";
      if (s.spells[id].cd > 0) return `Recharge ${Math.ceil(s.spells[id].cd)} s`;
      if (s.mana < this.spellMana(id)) return `Mana ${Math.floor(s.mana)}/${this.spellMana(id)}`;
      return null;
    }
    eligibleSacks(x, z, radius, count) {
      return this.state.treasures
        .filter((t) => t.state === "dropped" && Math.hypot(t.x - x, t.z - z) <= radius + 0.9)
        .sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))
        .slice(0, count);
    }
    /** Lance un sort au point (x, z). En pause, la commande est mise en attente (une par sort). */
    cast(id, x, z) {
      const s = this.state;
      if (!C.spells[id]) return { ok: false, reason: "Sort inconnu" };
      if (!this.unlocked.has(id)) return { ok: false, reason: `Débloqué au niveau ${C.spells.unlockLevel[id]}` };
      if (s.phase !== "wave") return { ok: false, reason: "Pendant une attaque seulement" };
      if (s.paused) {
        s.queued[id] = { x, z };
        this.emit({ type: "spellQueued", id, x, z });
        return { ok: true, queued: true };
      }
      return this.execute(id, x, z);
    }
    cancelQueued(id) {
      delete this.state.queued[id];
    }
    flushQueued() {
      const s = this.state;
      const q = s.queued;
      s.queued = {};
      for (const id of Object.keys(q)) {
        const r = this.execute(id, q[id].x, q[id].z);
        this.emit({ type: "spellResumed", id, ok: r.ok, reason: r.reason });
      }
    }
    execute(id, x, z) {
      const s = this.state;
      const blocked = this.spellBlocked(id);
      if (blocked) return { ok: false, reason: blocked };
      const rank = s.spells[id].rank;
      const R0 = this.spellStats(id);
      if (id === "recall" && !this.eligibleSacks(x, z, R0.radius, R0.count).length) return { ok: false, reason: "Aucun sac tombé à cet endroit" };
      s.mana -= this.spellMana(id);
      s.spells[id].cd = this.spellCooldown(id);
      let yaw = 0;
      if (id === "flood") {
        const loc = R.locate(this.graph, x, z, "walker");
        if (loc) {
          const p = G.at(loc.edge.line, loc.s);
          yaw = Math.atan2(p.dx, p.dz);
        }
      }
      s.effects.push({ id: this.nextId("F"), spell: id, rank, x, z, yaw, t: C.spells[id].delay, stats: R0 });
      this.emit({ type: "spell", id, x, z, rank, yaw, stats: R0, delay: C.spells[id].delay });
      return { ok: true };
    }
    updateEffects(dt) {
      const s = this.state;
      const keep = [];
      for (const fx of s.effects) {
        fx.t -= dt;
        if (fx.t > 0) {
          keep.push(fx);
          continue;
        }
        const S = fx.stats;
        switch (fx.spell) {
          case "meteor":
            for (const e of this.enemiesIn(fx.x, fx.z, S.radius)) this.damage(e, S.damage, "explosion", { family: "fire", kind: "meteor" });
            {
              const a = { id: this.nextId("A"), kind: "groundFire", tower: null, x: fx.x, z: fx.z, r: S.radius, t: S.ground.duration, dur: S.ground.duration, dps: S.ground.dps, big: true, meteor: true };
              s.areas.push(a);
              this.emit({ type: "area", area: a });
            }
            this.emit({ type: "explode", kind: "meteor", x: fx.x, z: fx.z, r: S.radius });
            break;
          case "freeze":
            for (const e of this.enemiesIn(fx.x, fx.z, S.radius)) {
              const d = this.immobilize(e, "freeze", S.freeze / this.T.freezeDuration, { kind: "spell" });
              if (d && S.afterSlow) e.pendingSlow = S.afterSlow;
            }
            this.emit({ type: "explode", kind: "freeze", x: fx.x, z: fx.z, r: S.radius });
            break;
          case "flood": {
            const dx = Math.sin(fx.yaw),
              dz = Math.cos(fx.yaw);
            for (const e of this.state.enemies) {
              if (!this.alive(e)) continue;
              const along = (e.x - fx.x) * dx + (e.z - fx.z) * dz,
                across = (e.x - fx.x) * dz - (e.z - fx.z) * dx;
              if (Math.abs(along) > S.length / 2 || Math.abs(across) > S.width / 2) continue;
              this.damage(e, S.damage, "explosion", { family: "water", kind: "flood" });
              this.applyWet(e, S.wet - this.T.wetBonus);
              this.push(e, S.push / this.T.push, { family: "water" });
            }
            this.emit({ type: "explode", kind: "flood", x: fx.x, z: fx.z, yaw: fx.yaw, length: S.length, width: S.width });
            break;
          }
          case "frenzy":
            for (const tw of s.towers) {
              if (Math.hypot(tw.x - fx.x, tw.z - fx.z) > S.radius) continue;
              tw.frenzyRate = Math.max(tw.frenzyT > 0 ? tw.frenzyRate : 0, S.rate);
              tw.frenzyT = Math.max(tw.frenzyT, S.duration);
            }
            this.emit({ type: "explode", kind: "frenzy", x: fx.x, z: fx.z, r: S.radius });
            break;
          case "recall": {
            const sacks = this.eligibleSacks(fx.x, fx.z, S.radius, S.count);
            for (const t of sacks) this.returnTreasure(t, "recall");
            if (!sacks.length) {
              // Rien à rappeler au moment de l'effet : rien n'est consommé.
              s.mana = Math.min(s.manaMax, s.mana + this.spellMana("recall"));
              s.spells.recall.cd = 0;
            }
            break;
          }
        }
      }
      s.effects = keep;
    }

    // ── Préparation : parcours prévus et menace ─────────────────────────────────
    preview() {
      const s = this.state;
      const def = this.nextWaveDef();
      if (!def) return null;
      const routes = [],
        seen = new Set(),
        types = {};
      let threat = 0;
      const hpm = s.endless ? this.hpMultiplier() * 1.035 : 1 + C.enemies.hpPerLevel * (this.level - 1) + C.enemies.hpPerWave * s.wave;
      for (const gdef of def.groups) {
        const entry = this.resolveEntry(gdef);
        const key = entry + ">" + gdef.target + ":" + (gdef.type === "nageur");
        const E = C.enemies[gdef.type];
        types[gdef.type + (gdef.elite ? "*" : "")] = (types[gdef.type + (gdef.elite ? "*" : "")] || 0) + gdef.count;
        threat += gdef.count * E.hp * hpm * (gdef.elite ? 1.5 : 1) * (0.6 + E.speed * 0.5);
        if (seen.has(key)) continue;
        seen.add(key);
        const r = this.reserve(gdef.target);
        const mover = gdef.type === "nageur" ? "swimmer" : "walker";
        const rt = r && R.route(this.graph, entry, [r.doorNode], mover, { land: 0.9, water: 1.15 });
        if (rt) routes.push({ entry, target: gdef.target, pts: rt.pts, kinds: rt.kinds, swimmer: mover === "swimmer" });
      }
      const exits = this.L.exits.map((e) => e.node);
      const level = threat < 900 ? "Faible" : threat < 2200 ? "Moyenne" : threat < 4500 ? "Forte" : "Très forte";
      return { routes, types, threat: Math.round(threat), level, exits, boss: def.groups.some((g) => g.type === "boss"), eliteBoss: !!def.eliteBoss };
    }

    // ── Sauvegarde (point de reprise entre les vagues) ───────────────────────────
    serialize() {
      const s = this.state;
      return {
        v: 1,
        level: this.level,
        layoutId: s.layoutId,
        seed: s.seed,
        phase: s.phase === "wave" ? "prep" : s.phase,
        endless: s.endless,
        endlessCount: s.endlessCount,
        wave: s.wave,
        gold: s.gold,
        mana: s.mana,
        mill: Object.assign({}, s.mill),
        spells: JSON.parse(JSON.stringify(s.spells)),
        reserves: s.reserves.map((r) => ({ id: r.id, tier: r.tier, stock: r.stock.slice(), spent: r.spent })),
        treasures: s.treasures.map((t) => ({ id: t.id, reserve: t.reserve, state: t.state === "carried" || t.state === "dropped" ? "stored" : t.state, everTaken: t.everTaken })),
        towers: s.towers.map((t) => ({ id: t.id, socket: t.socket, family: t.family, tier: t.tier, branch: t.branch, xp: t.xp, spent: t.spent, targeting: t.targeting })),
        traps: s.traps.map((t) => ({ id: t.id, slot: t.slot, kind: t.kind, tier: t.tier, spent: t.spent, dir: t.dir })),
        stats: JSON.parse(JSON.stringify(s.stats)),
        talents: this.allocation,
        unlocked: [...this.unlocked],
        uid: this.uid,
      };
    }
    restore(cp) {
      this.level = cp.level;
      this.L = PTMT.layouts[cp.level];
      this.graph = R.buildGraph(this.L);
      if (cp.talents) {
        this.allocation = cp.talents;
        this.T = PTMT.talents.resolve(cp.talents);
      }
      if (cp.unlocked) this.unlocked = new Set(cp.unlocked);
      this.reset();
      const s = this.state;
      Object.assign(s, { phase: cp.phase === "victory" || cp.phase === "defeat" ? cp.phase : "prep", endless: cp.endless, endlessCount: cp.endlessCount, wave: cp.wave, gold: cp.gold, mill: cp.mill, spells: cp.spells, stats: cp.stats });
      for (const id of C.spells.order) s.spells[id].cd = s.spells[id].cd || 0;
      this.recomputeMill();
      s.mana = Math.min(s.manaMax, cp.mana);
      for (const t of s.treasures) {
        const c = cp.treasures.find((x) => x.id === t.id);
        if (c) Object.assign(t, { state: c.state, everTaken: c.everTaken, carrier: null });
      }
      for (const r of s.reserves) {
        const c = cp.reserves.find((x) => x.id === r.id);
        r.tier = c.tier;
        r.spent = c.spent;
        r.stock = s.treasures.filter((t) => t.reserve === r.id && t.state === "stored").map((t) => t.id);
      }
      s.towers = cp.towers.map((t) => {
        const so = this.socket(t.socket);
        return Object.assign({ x: so.x, z: so.z, cd: 0.4, shots: 0, yaw: 0, frenzyT: 0, frenzyRate: 0, storm: null }, t);
      });
      s.traps = cp.traps.map((t) => {
        const sl = this.trapSlot(t.slot);
        return Object.assign({ x: sl.x, z: sl.z, cd: 0, fired: 0 }, t);
      });
      this.uid = cp.uid || 1000;
      this.emit({ type: "restored" });
    }
  }

  PTMT.Game = Game;
  PTMT.formKey = formKey;
  PTMT.FORM_KEYS = FORM_KEYS;
})();
