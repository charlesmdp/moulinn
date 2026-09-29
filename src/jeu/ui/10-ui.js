// « Pas touche à mes trésors » — interface : barre du haut, onglets du bas, panneaux,
// préparation des vagues, alertes, étiquettes des réserves, écrans (menu, talents, résultats),
// tutoriel progressif.
(function () {
  "use strict";
  const PTMT = (globalThis.PTMT = globalThis.PTMT || {});
  const C = PTMT.config;
  const I = PTMT.icons;
  const U = PTMT.U;

  const h = (tag, attrs = {}, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "html") el.innerHTML = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else if (k === "style") el.style.cssText = v;
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat()) if (kid !== null && kid !== undefined && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    return el;
  };
  const fmt = (n) => (Math.round(n * 10) / 10).toString().replace(".", ",");
  const pct = (v) => Math.round(v * 100) + " %";
  const ROMAN = ["", "I", "II", "III"];
  const FAM = { fire: "Feu", ice: "Glace", water: "Eau" };
  const SPELL_ICON = { meteor: "meteor", freeze: "freeze", flood: "flood", frenzy: "frenzy", recall: "recall" };
  const ENEMY_SHORT = { voleur: "Voleurs", sprinteur: "Sprinteurs", demenageur: "Déménageurs", fumigene: "Fumigènes", nageur: "Nageurs", boss: "Chef tondeuse" };
  // Portraits de secours (disque coloré et initiale) quand PTMT.portraits n'est pas chargé.
  const ENEMY_INITIAL = { voleur: "V", sprinteur: "S", demenageur: "D", fumigene: "F", nageur: "N", boss: "B" };
  const ENEMY_TINT = { voleur: "#59607e", sprinteur: "#e39a2d", demenageur: "#8d6440", fumigene: "#68707d", nageur: "#ef75a6", boss: "#a8322b" };
  // Traits affichés dans l'annonce de vague.
  const TRAIT = {
    voleur: "Voleurs",
    sprinteur: "Rapides",
    demenageur: "Lourds, lents",
    fumigene: "Invisibles au 1er coup",
    nageur: "Nagent",
    boss: "Boss : surchauffe",
  };
  const ELITE_TRAIT = {
    voleur: "Casque (1er coup ÷ 2)",
    sprinteur: "Filent avec un sac",
    demenageur: "Canapé protecteur",
    fumigene: "Long rideau de fumée",
    nageur: "Pédalo rapide",
    boss: "Rage à mi-vie",
  };
  const ZONE = {
    fire: { name: "Rocaille", sol: "de rocaille", tower: "de feu", forest: "Pinède sur la rocaille" },
    ice: { name: "Givre", sol: "de givre", tower: "de glace", forest: "Sapins givrés" },
    water: { name: "Berge", sol: "de berge", tower: "d'eau", forest: "Bosquet de la berge" },
  };
  const TARGETING = [
    ["auto", "Porteurs puis réserves"],
    ["carriers", "Porteurs d'abord"],
    ["advanced", "Plus avancés"],
    ["tough", "Plus résistants"],
  ];

  function UI(app) {
    this.app = app;
    this.root = app.root.querySelector("[data-ui]");
    this.overlay = app.root.querySelector("[data-overlay]");
    this.tab = "towers";
    this.panel = null;
    this.selection = null;
    this.buildMode = null; // { kind: 'tower'|'trap', family|trap }
    this.aim = null; // { spell }
    this.labels = new Map();
    this.alerts = new Map();
    this.last = 0;
    this.buildHud();
    this.bindKeys();
  }
  const P = UI.prototype;

  // ── Barre du haut et du bas ─────────────────────────────────────────────────
  P.buildHud = function () {
    const app = this.app;
    this.top = h("div", { class: "ptmt-top" });
    this.levelChip = h("div", { class: "ptmt-chip ptmt-level-chip" }, h("b", {}, ""), h("span", {}, ""));
    this.goldChip = h("div", { class: "ptmt-chip ptmt-gold", title: "Or" }, h("span", { class: "ptmt-coin" }), h("b", {}, "0"));
    this.manaBar = h("i");
    this.manaText = h("em", {}, "");
    this.manaChip = h("div", { class: "ptmt-chip ptmt-mana", title: "Mana (se recharge pendant les attaques)" }, h("span", { class: "label" }, "Mana"), h("div", { class: "ptmt-mana-bar" }, this.manaBar, this.manaText));
    this.treasureChip = h("div", { class: "ptmt-chip ptmt-treasures", title: "Trésors : dans la réserve, emporté, tombé, perdu" });
    this.pauseBtn = h("button", { class: "ptmt-btn", "aria-pressed": "false", title: "Pause tactique (Espace)", onclick: () => app.togglePause() });
    this.speedBtn = h("button", { class: "ptmt-btn", "aria-pressed": "false", title: "Vitesse ×2", onclick: () => app.toggleSpeed() }, "×2");
    this.menuBtn = h("button", { class: "ptmt-btn", title: "Menu", html: I.menu, onclick: () => app.openMenu() });
    this.timeChip = h("div", { class: "ptmt-chip ptmt-time" }, this.pauseBtn, this.speedBtn, this.menuBtn);
    this.top.append(this.levelChip, this.goldChip, this.manaChip, this.treasureChip, h("div", { class: "ptmt-spacer" }), this.timeChip);
    this.root.append(this.top);

    this.bottom = h("div", { class: "ptmt-bottom" });
    this.tray = h("div", { class: "ptmt-tray" });
    const tabs = [
      ["towers", "Tours", I.fire],
      ["traps", "Pièges", I.net],
      ["spells", "Sorts", I.frenzy],
      ["mill", "Moulin", I.meule],
    ];
    this.tabBtns = {};
    this.tabs = h(
      "div",
      { class: "ptmt-tabs", role: "tablist" },
      tabs.map(([id, label, icon]) => (this.tabBtns[id] = h("button", { class: "ptmt-btn", role: "tab", "aria-selected": "false", onclick: () => this.setTab(id) }, h("span", { html: icon, style: "width:18px;height:18px;display:inline-flex" }), label))),
    );
    this.bottom.append(this.tray, this.tabs);
    this.root.append(this.bottom);
    this.alertBox = h("div", { class: "ptmt-alerts" });
    this.root.append(this.alertBox);
    this.setTab("towers");
  };
  P.setTab = function (id) {
    this.tab = id;
    for (const [k, b] of Object.entries(this.tabBtns)) b.setAttribute("aria-selected", k === id ? "true" : "false");
    this.cancelModes();
    this.renderTray();
    if (id === "mill") this.showMillPanel();
    else if (this.panel && this.panel.kind === "mill") this.closePanel();
  };
  P.cancelModes = function () {
    this.buildMode = null;
    if (this.aim) this.stopAim();
    this.app.setSocketHighlight(null);
    this.setBuildPreview(null);
  };
  P.renderTray = function () {
    const app = this.app;
    const game = app.game;
    this.tray.innerHTML = "";
    if (!game) return;
    const s = game.state;
    const card = (opts) => {
      const c = h(
        "button",
        { class: "ptmt-card " + (opts.fam || ""), "data-active": opts.active ? "true" : "false", "aria-disabled": opts.disabled ? "true" : "false", title: opts.title || "", onclick: opts.onclick },
        h("span", { class: "icon", html: opts.icon }),
        h("span", { class: "name" }, opts.name),
        opts.cost !== undefined ? h("span", { class: "cost" }, opts.cost) : null,
        opts.cd ? h("span", { class: "cd" }, opts.cd) : null,
      );
      this.tray.append(c);
      return c;
    };
    if (this.tab === "towers") {
      for (const fam of ["fire", "ice", "water"]) {
        const f = C.towers[fam].forms["1"];
        card({
          fam: "fam-" + fam,
          icon: I[fam],
          name: f.name,
          cost: f.cost + " or",
          active: this.buildMode && this.buildMode.family === fam,
          disabled: s.gold < f.cost,
          title: C.towers[fam].role,
          onclick: () => this.startBuild({ kind: "tower", family: fam }),
        });
      }
    } else if (this.tab === "traps") {
      for (const k of ["net", "spring", "lure"]) {
        const t = C.traps[k].tiers[1];
        card({
          fam: "fam-trap",
          icon: I[k],
          name: C.traps[k].name,
          cost: t.cost + " or",
          active: this.buildMode && this.buildMode.trap === k,
          disabled: s.gold < t.cost || s.traps.length >= game.trapLimit(),
          title: s.traps.length >= game.trapLimit() ? `Limite de ${game.trapLimit()} pièges : améliore l'Atelier` : "",
          onclick: () => this.startBuild({ kind: "trap", trap: k }),
        });
      }
      this.tray.append(h("div", { class: "ptmt-chip", style: "align-self:center" }, `${s.traps.length}/${game.trapLimit()} pièges`));
    } else if (this.tab === "spells") {
      for (const id of C.spells.order) {
        const sp = C.spells[id];
        const locked = !game.unlocked.has(id);
        const blocked = game.spellBlocked(id);
        const cd = s.spells[id].cd;
        card({
          fam: "fam-spell",
          icon: locked ? I.lock : I[SPELL_ICON[id]],
          name: sp.name + (s.spells[id].rank > 1 ? " " + ROMAN[s.spells[id].rank] : ""),
          cost: locked ? `niv. ${C.spells.unlockLevel[id]}` : game.spellMana(id) + " mana",
          active: this.aim && this.aim.spell === id,
          disabled: !!blocked && !(s.paused && !locked && s.phase === "wave"),
          cd: cd > 0 ? Math.ceil(cd) + " s" : null,
          title: blocked || sp.name,
          onclick: () => this.startAim(id),
        });
      }
    } else if (this.tab === "mill") {
      for (const k of ["meule", "roue", "atelier"]) {
        const lv = s.mill[k];
        const def = C.mill[k];
        const next = def.levels[lv + 1];
        card({ fam: "fam-mill", icon: I[k], name: def.name + " " + (lv ? ROMAN[lv] : ""), cost: next ? "+" + next.cost + " or" : "max", disabled: !next || s.gold < next.cost, onclick: () => this.showMillPanel() });
      }
    }
  };
  P.startBuild = function (mode) {
    const app = this.app;
    if (this.aim) this.stopAim();
    if (this.buildMode && JSON.stringify(this.buildMode) === JSON.stringify(mode)) {
      this.cancelModes();
      this.renderTray();
      return;
    }
    this.buildMode = mode;
    this.closePanel();
    app.setSocketHighlight(mode);
    this.setBuildPreview(null);
    this.renderTray();
    this.tip(
      "build",
      mode.kind === "tower"
        ? "Les cases qui s'allument accueillent cette tour : la rocaille (dalles de pierre) pour le feu, le givre (cercles de runes) pour la glace, la berge et le marais pour l'eau. Les tours se posent côte à côte. Une case boisée se libère en coupant sa forêt."
        : "Touche un emplacement sur un chemin pour y poser le piège.",
    );
  };

  // ── Visée des sorts ─────────────────────────────────────────────────────────
  P.startAim = function (id) {
    const game = this.app.game;
    const blocked = game.spellBlocked(id);
    const s = game.state;
    if (blocked && !(s.paused && game.unlocked.has(id) && s.phase === "wave")) {
      this.flash(blocked);
      return;
    }
    if (this.aim && this.aim.spell === id) {
      this.stopAim();
      return;
    }
    this.buildMode = null;
    this.app.setSocketHighlight(null);
    this.aim = { spell: id };
    this.aimBar && this.aimBar.remove();
    this.aimBar = h("div", { class: "ptmt-targeting" }, h("span", { html: I.target, style: "width:20px;height:20px;display:inline-flex" }), `${C.spells[id].name} : touche le terrain`, h("button", { class: "ptmt-btn ptmt-btn-ghost", onclick: () => this.stopAim() }, "Annuler"));
    this.root.append(this.aimBar);
    this.renderTray();
  };
  P.stopAim = function () {
    this.aim = null;
    this.aimBar && this.aimBar.remove();
    this.aimBar = null;
    this.app.entities.showAim(null);
    this.renderTray();
  };

  // ── Panneaux de sélection ────────────────────────────────────────────────────
  P.closePanel = function () {
    if (this.panelEl) this.panelEl.remove();
    this.panelEl = null;
    this.panel = null;
    this.app.select(null);
  };
  P.openPanel = function (kind, id, build) {
    if (this.panelEl) this.panelEl.remove();
    this.panel = { kind, id };
    const el = h("div", { class: "ptmt-panel" });
    el.append(h("button", { class: "ptmt-btn close", title: "Fermer", html: I.close, onclick: () => this.closePanel() }));
    build(el);
    this.root.append(el);
    this.panelEl = el;
  };
  P.refreshPanel = function () {
    if (!this.panel) return;
    const { kind, id } = this.panel;
    if (kind === "tower") this.showTowerPanel(id);
    else if (kind === "socket" || kind === "forest") this.showSocketPanel(id);
    else if (kind === "trap") this.showTrapPanel(id);
    else if (kind === "slot") this.showSlotPanel(id);
    else if (kind === "reserve") this.showReservePanel(id);
    else if (kind === "mill") this.showMillPanel();
  };
  P.statsList = function (rows) {
    const dl = h("dl", { class: "ptmt-stats" });
    for (const [k, v] of rows) if (v !== null && v !== undefined) dl.append(h("dt", {}, k), h("dd", {}, v));
    return dl;
  };
  P.towerRows = function (f, fam) {
    const rows = [["Portée", fmt(f.range) + " U"]];
    if (f.damage) rows.push(["Dégâts", fmt(f.damage) + (f.attack === "cone" ? " / pulsation" : "")]);
    if (f.period) rows.push(["Cadence", "toutes les " + fmt(f.period / (f.rate || 1)) + " s"]);
    if (f.splash) rows.push(["Explosion", "rayon " + fmt(f.splash) + " U"]);
    if (f.coneDeg) rows.push(["Cône", f.coneDeg + "°"]);
    if (f.burn) rows.push(["Brûlure", fmt(f.burn.dps) + "/s pendant " + fmt(f.burn.duration) + " s"]);
    if (f.ground) rows.push(["Sol en feu", fmt(f.ground.dps) + "/s · " + fmt(f.ground.duration) + " s"]);
    if (f.slow) rows.push(["Ralentit", pct(Math.min(f.slow.pct, 0.6)) + " · " + fmt(f.slow.duration) + " s"]);
    if (f.freeze) rows.push(["Gel", fmt(f.freeze) + " s (1 tir sur " + f.freezeEvery + ")"]);
    if (f.stormRadius) rows.push(["Tempête", "rayon " + fmt(f.stormRadius) + " U · " + fmt(f.stormDps) + "/s · " + pct(Math.min(f.stormSlow, 0.6))]);
    if (f.stormFreeze) rows.push(["Gel à la création", fmt(f.stormFreeze) + " s"]);
    if (f.push) rows.push(["Recul", fmt(f.push) + " U" + (f.pushEvery ? " (1 jet sur " + f.pushEvery + ")" : "")]);
    if (f.maxTargets) rows.push(["Cibles", "jusqu'à " + f.maxTargets]);
    if (f.vortexRadius) rows.push(["Vortex", "rayon " + fmt(f.vortexRadius) + " U · " + fmt(f.vortexDuration) + " s · " + fmt(f.vortexDps) + "/s"]);
    if (f.pull) rows.push(["Attraction", fmt(f.pull) + " U"]);
    if (f.finalSplash) rows.push(["Éclaboussure finale", f.finalSplash + " dégâts"]);
    if (f.wet) rows.push(["Mouillé", fmt(f.wet) + " s"]);
    if (f.rate > 1) rows.push(["Frénésie", "+" + pct(f.rate - 1)]);
    return rows;
  };
  P.showTowerPanel = function (id) {
    const app = this.app,
      game = app.game;
    const tw = game.state.towers.find((t) => t.id === id);
    if (!tw) return this.closePanel();
    const f = game.towerStats(tw);
    app.select({ kind: "tower", id, x: tw.x, z: tw.z, range: f.range, family: tw.family });
    this.openPanel("tower", id, (el) => {
      el.append(h("h2", {}, f.name), h("div", { class: "sub" }, `${FAM[tw.family]} · palier ${ROMAN[tw.tier]}${tw.branch ? " · branche " + tw.branch : ""}`));
      el.append(this.statsList(this.towerRows(f, tw.family)));
      const info = game.upgradeInfo(tw);
      const need = info.max ? C.xp.tier3 : info.needXp;
      el.append(h("h3", {}, `Expérience : ${Math.floor(tw.xp)} / ${need} XP`), h("div", { class: "ptmt-xp" }, h("i", { style: `width:${Math.min(100, (tw.xp / need) * 100)}%` })));
      if (!info.max) {
        el.append(h("h3", {}, tw.tier === 1 ? "Spécialisation (choix définitif)" : "Évolution finale"));
        const row = h("div", { class: "ptmt-row" });
        for (const o of info.options) {
          const form = C.towers[tw.family].forms[PTMT.formKey(info.nextTier, o.branch)];
          row.append(
            h(
              "button",
              { class: "ptmt-btn " + (o.reason ? "" : "ptmt-btn-go"), "aria-disabled": o.reason ? "true" : "false", onclick: () => this.act(game.upgradeTower(tw.id, o.branch)) },
              h("span", {}, (info.nextTier === 2 ? ROMAN[2] + "-" + o.branch : ROMAN[3] + "-" + o.branch) + " · " + o.name),
              h("span", { class: "cost" }, o.cost + " or"),
              o.reason ? h("span", { class: "ptmt-reason" }, o.reason) : h("small", {}, this.formHint(form)),
            ),
          );
        }
        el.append(row);
      } else el.append(h("p", { class: "ptmt-note" }, "Évolution finale atteinte."));
      el.append(h("h3", {}, "Ciblage"));
      const seg = h("div", { class: "ptmt-seg" });
      for (const [k, label] of TARGETING) seg.append(h("button", { "aria-pressed": tw.targeting === k ? "true" : "false", onclick: () => (game.setTargeting(tw.id, k), this.refreshPanel()) }, label));
      el.append(seg);
      el.append(h("div", { class: "ptmt-row" }, h("button", { class: "ptmt-btn ptmt-btn-danger", onclick: () => this.confirmSell(() => this.act(game.sellTower(tw.id), true)) }, `Revendre · ${game.sellValue(tw)} or`)));
      el.append(h("p", { class: "ptmt-note" }, "La revente rend 70 % de l'or dépensé ; l'expérience de la tour est perdue."));
    });
  };
  P.formHint = function (f) {
    if (!f) return "";
    if (f.attack === "cone") return `Cône ${f.coneDeg}° · ${f.damage} toutes les ${f.period} s`;
    if (f.attack === "lava") return `Obus ${f.damage} · rayon ${f.splash} U · sol en feu`;
    if (f.attack === "spike") return `${f.damage} dégâts · gel 1 tir sur 3`;
    if (f.attack === "storm") return `Tempête rayon ${f.stormRadius} U · −${Math.round(f.stormSlow * 100)} %`;
    if (f.attack === "line") return `Rafale en ligne · recul ${f.push} U`;
    if (f.attack === "wave") return `Vague · 6 cibles · recul ${f.push} U`;
    if (f.attack === "vortex") return `Vortex rayon ${f.vortexRadius} U · attire ${f.pull} U`;
    return "";
  };
  P.confirmSell = function (fn) {
    fn();
  };
  P.act = function (res, close) {
    if (!res || !res.ok) {
      if (res && res.reason) this.flash(res.reason);
      return false;
    }
    if (close) this.closePanel();
    else this.refreshPanel();
    this.renderTray();
    return true;
  };
  P.showSocketPanel = function (id) {
    const app = this.app,
      game = app.game;
    const so = game.socket(id);
    if (game.isForest(id)) return this.showForestPanel(id);
    const built = game.towerAt(id);
    if (built) return this.showTowerPanel(built.id);
    const fam = so.kind;
    const f = C.towers[fam].forms["1"];
    app.select({ kind: "socket", id, x: so.x, z: so.z, range: f.range * (fam === "ice" ? game.T.iceRange : 1), family: fam });
    this.openPanel("socket", id, (el) => {
      el.append(
        h("h2", {}, "Case " + ZONE[fam].sol),
        h("div", { class: "sub" }, { fire: "Dalle de pierre : tours de feu", ice: "Cercle de runes : tours de glace", water: "Berge et marais : tours d'eau" }[fam]),
      );
      el.append(h("p", { class: "ptmt-note" }, C.towers[fam].role));
      const stats = game.towerStats({ family: fam, tier: 1, branch: null, frenzyT: 0 });
      el.append(this.statsList(this.towerRows(stats, fam)));
      el.append(
        h(
          "div",
          { class: "ptmt-row" },
          h("button", { class: "ptmt-btn " + (game.state.gold >= f.cost ? "ptmt-btn-go" : ""), "aria-disabled": game.state.gold >= f.cost ? "false" : "true", onclick: () => this.buildAt(id, fam) }, h("span", {}, "Construire · " + f.name), h("span", { class: "cost" }, f.cost + " or")),
        ),
      );
    });
  };
  /** Case boisée : couper la forêt (or, quelques secondes), puis y bâtir. */
  P.showForestPanel = function (id) {
    const app = this.app,
      game = app.game;
    const so = game.socket(id);
    const fam = so.kind;
    app.select({ kind: "forest", id, x: so.x, z: so.z, range: 0, family: fam });
    this.openPanel("forest", id, (el) => {
      const inf = game.cutInfo(id);
      el.append(h("h2", {}, ZONE[fam].forest), h("div", { class: "sub" }, `Case ${ZONE[fam].sol} boisée`));
      el.append(h("p", { class: "ptmt-note" }, `Une fois la forêt coupée, la case accueille une tour ${ZONE[fam].tower}. Les bûcherons travaillent aussi entre les vagues.`));
      if (inf.progress !== null) {
        el.append(h("h3", {}, `Bûcherons au travail · ${Math.round(inf.progress * 100)} %`), h("div", { class: "ptmt-xp ptmt-cutbar" }, h("i", { style: `width:${Math.round(inf.progress * 100)}%` })));
      } else {
        const ok = !inf.reason;
        el.append(
          h(
            "div",
            { class: "ptmt-row" },
            h(
              "button",
              { class: "ptmt-btn " + (ok ? "ptmt-btn-gold" : ""), "aria-disabled": ok ? "false" : "true", onclick: () => this.cutAt(id) },
              h("span", { html: I.axe, style: "width:20px;height:20px;display:inline-flex" }),
              h("span", {}, "Couper la forêt"),
              h("span", { class: "cost" }, inf.cost + " or"),
              inf.reason ? h("span", { class: "ptmt-reason" }, inf.reason) : h("small", {}, `${fmt(inf.duration)} s de travail · le prix monte à chaque coupe`),
            ),
          ),
        );
      }
    });
  };
  P.cutAt = function (id) {
    const game = this.app.game;
    const res = game.cut(id);
    if (!res.ok) return this.flash(res.reason);
    this.app.progressTutorial("cut");
    this.refreshPanel();
    this.renderTray();
  };
  P.buildAt = function (socketId, fam) {
    const game = this.app.game;
    const res = game.build(socketId, fam);
    if (!res.ok) return this.flash(res.reason);
    this.app.progressTutorial("built");
    this.showTowerPanel(res.tower.id);
    this.renderTray();
  };
  P.showSlotPanel = function (id) {
    const app = this.app,
      game = app.game;
    const sl = game.trapSlot(id);
    app.select({ kind: "slot", id, x: sl.x, z: sl.z });
    this.openPanel("slot", id, (el) => {
      el.append(h("h2", {}, "Emplacement de piège"), h("p", { class: "ptmt-note" }, `${game.state.traps.length}/${game.trapLimit()} pièges posés. Les pièges se réarment seuls.`));
      const row = h("div", { class: "ptmt-row" });
      for (const k of ["net", "spring", "lure"]) {
        const t = C.traps[k].tiers[1];
        const ok = game.state.gold >= t.cost && game.state.traps.length < game.trapLimit();
        row.append(
          h(
            "button",
            { class: "ptmt-btn " + (ok ? "ptmt-btn-go" : ""), "aria-disabled": ok ? "false" : "true", onclick: () => this.trapAt(id, k) },
            h("span", {}, C.traps[k].name),
            h("span", { class: "cost" }, t.cost + " or"),
            h("small", {}, k === "net" ? `Retient ${t.targets} ennemis ${fmt(t.duration)} s` : k === "spring" ? `Renvoie ${t.targets} ennemi de ${fmt(t.push)} U` : `Attire ${t.targets} voleur sans sac (${fmt(t.radius)} U)`),
          ),
        );
      }
      el.append(row);
    });
  };
  P.trapAt = function (slotId, kind) {
    const res = this.app.game.buildTrap(slotId, kind);
    if (!res.ok) return this.flash(res.reason);
    this.showTrapPanel(res.trap.id);
    this.renderTray();
  };
  P.showTrapPanel = function (id) {
    const app = this.app,
      game = app.game;
    const tr = game.state.traps.find((t) => t.id === id);
    if (!tr) return this.closePanel();
    const T = C.traps[tr.kind].tiers[tr.tier];
    app.select({ kind: "trap", id, x: tr.x, z: tr.z, range: tr.kind === "lure" ? T.radius : T.radius });
    this.openPanel("trap", id, (el) => {
      el.append(h("h2", {}, C.traps[tr.kind].name + " " + ROMAN[tr.tier]));
      const rows = [
        ["Cibles", "jusqu'à " + T.targets],
        tr.kind === "spring" ? ["Recul", fmt(T.push) + " U"] : [tr.kind === "net" ? "Immobilise" : "Attire", fmt(T.duration) + " s"],
        ["Recharge", fmt(T.cooldown * (game.state.mill.atelier >= 3 ? 0.9 : 1)) + " s (seulement s'il a servi)"],
        ["État", tr.cd > 0 ? "recharge " + Math.ceil(tr.cd) + " s" : "armé"],
      ];
      el.append(this.statsList(rows));
      if (tr.kind === "spring")
        el.append(h("div", { class: "ptmt-row" }, h("button", { class: "ptmt-btn", onclick: () => (game.flipSpring(tr.id), this.refreshPanel()) }, h("span", { html: I.flip, style: "width:18px;height:18px;display:inline-flex" }), "Inverser le sens"), h("p", { class: "ptmt-note" }, tr.dir > 0 ? "Renvoie ceux qui arrivent d'un côté ; inverse pour viser les fuyards." : "Sens inversé.")));
      if (tr.tier < 3) {
        const n = C.traps[tr.kind].tiers[tr.tier + 1];
        const need = tr.tier;
        const reason = game.state.mill.atelier < need ? `Atelier ${ROMAN[need]} requis` : game.state.gold < n.cost ? `Il manque ${n.cost - game.state.gold} or` : null;
        el.append(h("div", { class: "ptmt-row" }, h("button", { class: "ptmt-btn " + (reason ? "" : "ptmt-btn-go"), "aria-disabled": reason ? "true" : "false", onclick: () => this.act(game.upgradeTrap(tr.id)) }, h("span", {}, "Palier " + ROMAN[tr.tier + 1]), h("span", { class: "cost" }, "+" + n.cost + " or"), reason ? h("span", { class: "ptmt-reason" }, reason) : h("small", {}, `${n.targets} cibles · ${fmt(n.duration || n.push)} ${n.push ? "U" : "s"}`))));
      }
      el.append(h("div", { class: "ptmt-row" }, h("button", { class: "ptmt-btn ptmt-btn-danger", onclick: () => this.act(game.sellTrap(tr.id), true) }, `Revendre · ${game.sellValue(tr)} or`)));
    });
  };
  P.showReservePanel = function (id) {
    const app = this.app,
      game = app.game;
    const r = game.reserve(id);
    app.select({ kind: "reserve", id, x: r.x, z: r.z });
    const total = game.L.reserves.find((x) => x.id === id).treasures;
    this.openPanel("reserve", id, (el) => {
      el.append(h("h2", {}, r.name), h("div", { class: "sub" }, `${C.reserves.tiers[r.tier].name} · ${r.stock.length}/${total} trésors`));
      el.append(this.statsList([["Temps pour voler un trésor", fmt(C.reserves.tiers[r.tier].stealTime) + " s"], ["Perdus ici", String(game.state.stats.lostByReserve[id] || 0)]]));
      if (r.tier < 3) {
        const T = C.reserves.tiers[r.tier + 1];
        const reason = game.state.mill.atelier < T.atelier ? `Atelier ${ROMAN[T.atelier]} requis` : game.state.gold < T.cost ? `Il manque ${T.cost - game.state.gold} or` : null;
        el.append(
          h("div", { class: "ptmt-row" }, h("button", { class: "ptmt-btn " + (reason ? "" : "ptmt-btn-go"), "aria-disabled": reason ? "true" : "false", onclick: () => this.act(game.upgradeReserve(id)) }, h("span", {}, T.name), h("span", { class: "cost" }, "+" + T.cost + " or"), reason ? h("span", { class: "ptmt-reason" }, reason) : h("small", {}, `Vol en ${fmt(T.stealTime)} s${T.reveal ? " · révèle les fumigènes" : ""}`))),
        );
      }
      el.append(h("p", { class: "ptmt-note" }, "Renforcer un coffre ralentit les voleurs ; cela n'ajoute pas de trésor et ne rend pas la réserve invulnérable."));
    });
  };
  P.showMillPanel = function () {
    const app = this.app,
      game = app.game;
    if (!game) return;
    const s = game.state;
    app.select(null);
    this.openPanel("mill", null, (el) => {
      el.append(h("h2", {}, "Le moulin"), h("p", { class: "ptmt-note" }, "Ses améliorations soutiennent tout le domaine ; elles repartent de zéro au niveau suivant."));
      const texts = {
        meule: (L) => `Revenu : ${L.income} or par vague terminée`,
        roue: (L) => `Mana max ${L.manaMax} · recharge ${fmt(L.regen)}/s`,
        atelier: (L) => `Palier ${ROMAN[L.tierAllowed]} autorisé · ${L.trapLimit} pièges` + (L.xpBonus ? " · XP +25 % · recharge des pièges −10 %" : ""),
      };
      for (const k of ["meule", "roue", "atelier"]) {
        const def = C.mill[k];
        const lv = s.mill[k];
        el.append(h("h3", {}, `${def.name} ${lv ? ROMAN[lv] : "(de base)"}`), h("p", { class: "ptmt-note" }, texts[k](def.levels[lv])));
        const next = def.levels[lv + 1];
        if (next)
          el.append(
            h("div", { class: "ptmt-row" }, h("button", { class: "ptmt-btn " + (s.gold >= next.cost ? "ptmt-btn-gold" : ""), "aria-disabled": s.gold >= next.cost ? "false" : "true", onclick: () => this.act(game.upgradeMill(k)) }, h("span", {}, `${def.name} ${ROMAN[lv + 1]}`), h("span", { class: "cost" }, "+" + next.cost + " or"), h("small", {}, texts[k](next)))),
          );
      }
      el.append(h("h3", {}, "Rangs des sorts"));
      for (const id of C.spells.order) {
        if (!game.unlocked.has(id)) continue;
        const r = s.spells[id].rank;
        if (r >= 3) {
          el.append(h("p", { class: "ptmt-note" }, `${C.spells[id].name} : rang III`));
          continue;
        }
        const cost = C.spells.rankCost[r + 1],
          need = C.spells.rankAtelier[r + 1];
        const reason = s.mill.atelier < need ? `Atelier ${ROMAN[need]} requis` : s.gold < cost ? `Il manque ${cost - s.gold} or` : null;
        el.append(h("div", { class: "ptmt-row" }, h("button", { class: "ptmt-btn " + (reason ? "" : "ptmt-btn-go"), "aria-disabled": reason ? "true" : "false", onclick: () => this.act(game.upgradeSpell(id)) }, h("span", {}, `${C.spells[id].name} ${ROMAN[r + 1]}`), h("span", { class: "cost" }, "+" + cost + " or"), reason ? h("span", { class: "ptmt-reason" }, reason) : null)));
      }
      el.append(h("h3", {}, "Réserves"));
      for (const r of s.reserves) el.append(h("div", { class: "ptmt-row" }, h("button", { class: "ptmt-btn", onclick: () => (this.showReservePanel(r.id), app.focusReserve(r.id)) }, `${r.name} · ${C.reserves.tiers[r.tier].name}`)));
    });
  };

  // ── Portraits des voleurs ─────────────────────────────────────────────────────
  /** Portrait d'un type d'ennemi (PTMT.portraits si présent, sinon disque coloré et initiale). */
  P.portrait = function (type, elite, small) {
    const key = elite ? type + "_elite" : type;
    const def = C.enemies[type] || {};
    const src = PTMT.portraits && (PTMT.portraits[key] || PTMT.portraits[type]);
    const el = h("span", { class: "ptmt-portrait" + (small ? " small" : "") + (elite ? " elite" : "") + (type === "boss" ? " boss" : "") + (type === "nageur" ? " swim" : ""), title: elite ? def.eliteName : def.name });
    if (typeof src === "string" && src.trim().startsWith("<")) el.innerHTML = src;
    else {
      el.classList.add("fallback");
      el.style.setProperty("--tint", ENEMY_TINT[type] || "#666");
      el.append(h("b", {}, ENEMY_INITIAL[type] || "?"));
    }
    if (elite) el.append(h("i", { class: "flag-elite", title: "Élite" }, "★"));
    if (type === "boss") el.append(h("i", { class: "flag-boss", title: "Boss" }, "♛"));
    if (type === "nageur") el.append(h("i", { class: "flag-swim", title: "Nageur" }, "≈"));
    return el;
  };
  /** Portraits × nombres d'une liste de groupes { type, elite, count }. */
  P.foes = function (groups, small, max = 6) {
    const order = { boss: 0, demenageur: 1, fumigene: 2, nageur: 3, sprinteur: 4, voleur: 5 };
    const list = groups.slice().sort((a, b) => (order[a.type] ?? 9) - (order[b.type] ?? 9) || (b.elite ? 1 : 0) - (a.elite ? 1 : 0));
    const out = list.slice(0, max).map((g) => h("span", { class: "ptmt-foe" }, this.portrait(g.type, g.elite, small), h("em", {}, "×" + g.count)));
    if (list.length > max) out.push(h("span", { class: "ptmt-foe more" }, "…"));
    return out;
  };
  /** Groupes (type, élite, nombre) de toute une vague, fronts confondus. */
  const mergeGroups = (fronts) => {
    const m = new Map();
    for (const f of fronts)
      for (const g of f.groups) {
        const k = g.type + (g.elite ? "*" : "");
        if (!m.has(k)) m.set(k, { type: g.type, elite: g.elite, count: 0 });
        m.get(k).count += g.count;
      }
    return [...m.values()];
  };
  P.traits = function (fronts) {
    const set = [];
    for (const g of mergeGroups(fronts)) {
      const t = g.elite ? ELITE_TRAIT[g.type] : TRAIT[g.type];
      if (t && !set.includes(t) && g.type !== "voleur") set.push(t);
      if (g.elite && !set.includes("Élites")) set.unshift("Élites");
    }
    return set;
  };

  // ── Préparation d'une vague : « Prochaine vague » ─────────────────────────────────
  P.showPrep = function () {
    const app = this.app,
      game = app.game;
    if (this.prepEl) this.prepEl.remove();
    this.prepEl = null;
    if (!game || game.state.phase !== "prep") return;
    const pv = game.preview();
    this.pv = pv;
    if (!pv) return;
    const s = game.state;
    const title = s.endless ? `Sans fin · vague ${pv.number}` : `Vague ${pv.number} / ${s.waveCount}`;
    const fronts = pv.fronts.map((f) =>
      h(
        "button",
        { class: "ptmt-front", style: `--c:${f.color}`, title: "Voir la porte", onclick: () => app.focusGate(f.entry) },
        h("span", { class: "where" }, h("i", { class: "dot" }), h("b", {}, f.label), h("span", { class: "arrow" }, "→"), f.targets.map((id) => game.reserve(id).name).join(", ")),
        h("span", { class: "foes" }, this.foes(f.groups)),
      ),
    );
    const traits = this.traits(pv.fronts);
    const timeline = pv.upcoming.length
      ? h(
          "div",
          { class: "ptmt-timeline" },
          h("span", { class: "lbl" }, "Ensuite"),
          pv.upcoming.map((u) =>
            h(
              "span",
              { class: "ptmt-next" + (u.boss ? " boss" : ""), title: `Vague ${u.number} · menace ${u.level.toLowerCase()}` },
              h("b", {}, (u.endless ? "S" : "V") + u.number),
              h("span", { class: "dots" }, u.fronts.map((f) => h("i", { style: `background:${f.color}`, title: f.label }))),
              this.foes(mergeGroups(u.fronts), true, 3),
            ),
          ),
        )
      : h("div", { class: "ptmt-timeline" }, h("span", { class: "lbl" }, pv.last ? "Dernière vague !" : ""));
    // Résumé compact (téléphone en construction, ou sur demande) : portes et nombres seulement.
    const mini = h(
      "div",
      { class: "mini" },
      pv.fronts.map((f) => h("button", { class: "ptmt-front-mini", style: `--c:${f.color}`, title: f.label, onclick: () => app.focusGate(f.entry) }, h("i", { class: "dot" }), this.foes(f.groups, true, 2))),
    );
    const toggle = h("button", { class: "ptmt-prep-toggle", title: "Réduire ou déplier l'annonce", onclick: () => this.togglePrep() });
    this.prepEl = h(
      "div",
      { class: "ptmt-prep" },
      // Le titre et la menace partagent une ligne, la menace passe dessous si la place manque.
      h(
        "div",
        { class: "head" },
        h("h2", {}, h("small", {}, "Prochaine vague"), h("span", { class: "ttl" }, h("span", { class: "num" }, title), h("span", { class: "threat", "data-level": pv.level }, "Menace " + pv.level.toLowerCase()))),
        toggle,
      ),
      mini,
      pv.boss ? h("div", { class: "ptmt-boss-warning" }, pv.eliteBoss ? "Attention : Limousine-tondeuse !" : "Attention : le chef en tondeuse blindée arrive !") : null,
      h("div", { class: "ptmt-fronts" }, fronts),
      traits.length ? h("div", { class: "ptmt-traits" }, traits.map((t) => h("span", {}, t))) : null,
      timeline,
      h("button", { class: "ptmt-btn ptmt-btn-go launch", onclick: () => app.launchWave() }, h("span", { html: I.swords, style: "width:20px;height:20px;display:inline-flex" }), "Lancer la vague"),
    );
    this.root.append(this.prepEl);
    this.updatePrepMode();
    app.entities.showRoutes(pv.routes);
    this.markerSig = null;
  };
  /** Annonce réduite : au choix du joueur (retenu dans ce navigateur), ou d'office sur téléphone
   * pendant la construction et la visée ; masquée sur téléphone quand un panneau est ouvert. */
  P.togglePrep = function () {
    this.prepUserCompact = !this.isPrepCompact();
    try {
      localStorage.setItem("ptmt.prepCompact", this.prepUserCompact ? "1" : "0");
    } catch (e) {}
    this.prepForced = null;
    this.updatePrepMode();
  };
  P.isPrepCompact = function () {
    const mobile = window.innerWidth < 720;
    if (this.prepUserCompact === undefined) {
      try {
        this.prepUserCompact = localStorage.getItem("ptmt.prepCompact") === "1";
      } catch (e) {
        this.prepUserCompact = false;
      }
    }
    return this.prepUserCompact || (mobile && (!!this.buildMode || !!this.aim));
  };
  P.updatePrepMode = function () {
    if (!this.prepEl) return;
    const mobile = window.innerWidth < 720;
    const compact = this.isPrepCompact();
    this.prepEl.classList.toggle("compact", compact);
    this.prepEl.style.display = mobile && this.panel ? "none" : "";
  };
  P.hidePrep = function () {
    if (this.prepEl) this.prepEl.remove();
    this.prepEl = null;
    this.app.entities.showRoutes(null);
    this.markerSig = null;
  };

  // ── Pendant l'attaque : ce qui arrive encore, et la vague d'après ─────────────────
  /** Fronts des apparitions restantes de la vague en cours (par porte). */
  P.pendingFronts = function () {
    const game = this.app.game,
      s = game.state;
    const m = new Map();
    for (const sp of s.spawns) {
      const e = game.L.entries.find((x) => x.node === sp.entry) || { node: sp.entry, label: sp.entry, color: "#e8453c" };
      if (!m.has(sp.entry)) m.set(sp.entry, { entry: sp.entry, label: e.label, color: e.color, targets: [], groups: [], count: 0, first: sp.at });
      const f = m.get(sp.entry);
      if (!f.targets.includes(sp.target)) f.targets.push(sp.target);
      let g = f.groups.find((x) => x.type === sp.type && x.elite === !!sp.elite);
      if (!g) f.groups.push((g = { type: sp.type, elite: !!sp.elite, count: 0 }));
      g.count++;
      f.count++;
    }
    return [...m.values()];
  };
  /** Aperçu de la vague suivante, calculé une fois par vague. */
  P.nextPreview = function () {
    const game = this.app.game,
      s = game.state;
    const key = s.wave + ":" + s.endless + ":" + s.endlessCount + ":" + s.phase;
    if (this.nextKey !== key) {
      this.nextKey = key;
      this.nextPv = game.preview();
    }
    return this.nextPv;
  };
  P.updateWaveBar = function () {
    const app = this.app,
      game = app.game,
      s = game.state;
    if (s.phase !== "wave") {
      if (this.waveBar) this.waveBar.remove();
      this.waveBar = null;
      return;
    }
    const pending = this.pendingFronts();
    const onField = s.enemies.length;
    const nx = this.nextPreview();
    if (this.waveBar) this.waveBar.style.display = window.innerWidth < 720 && this.panel ? "none" : "";
    const sig = JSON.stringify([s.wave, onField, pending.map((f) => [f.entry, f.count]), nx && nx.number]);
    if (sig === this.waveBarSig && this.waveBar) return;
    this.waveBarSig = sig;
    if (!this.waveBar) {
      this.waveBar = h("div", { class: "ptmt-wavebar" });
      this.root.append(this.waveBar);
    }
    const bar = this.waveBar;
    bar.innerHTML = "";
    const now = h("div", { class: "now" }, h("b", {}, s.endless ? `Sans fin ${s.endlessCount}` : `Vague ${s.wave}`), h("span", { class: "field" }, `${onField} sur le terrain`));
    if (pending.length) now.append(h("span", { class: "sep" }, "· encore"), ...pending.map((f) => h("span", { class: "ptmt-front-mini", style: `--c:${f.color}` }, h("i", { class: "dot" }), this.foes(f.groups, true, 3))));
    bar.append(now);
    if (nx) bar.append(h("div", { class: "after" }, h("span", { class: "lbl" }, "Ensuite"), h("b", {}, (nx.endless ? "S" : "V") + nx.number), h("span", { class: "dots" }, nx.fronts.map((f) => h("i", { style: `background:${f.color}`, title: f.label }))), this.foes(mergeGroups(nx.fronts), true, 4)));
    else if (!s.endless) bar.append(h("div", { class: "after" }, h("span", { class: "lbl" }, "Dernière vague")));
  };

  // ── Repères de portes sur la carte (et flèches au bord de l'écran) ─────────────────
  P.markerFronts = function () {
    const game = this.app.game,
      s = game.state;
    if (s.phase === "prep") return { fronts: this.pv ? this.pv.fronts : [], mode: "next" };
    if (s.phase === "wave") {
      const pending = this.pendingFronts();
      if (pending.length) return { fronts: pending, mode: "now" };
      const nx = this.nextPreview();
      return { fronts: nx ? nx.fronts : [], mode: "after" };
    }
    return { fronts: [], mode: "none" };
  };
  P.updateMarkers = function () {
    const app = this.app,
      game = app.game;
    const { fronts, mode } = this.markerFronts();
    const cam = app.camera;
    const w = app.canvas.clientWidth,
      hgt = app.canvas.clientHeight;
    this.markers = this.markers || new Map();
    const seen = new Set();
    const sigAll = mode + fronts.map((f) => f.entry).join(",");
    if (sigAll !== this.markerSig) {
      this.markerSig = sigAll;
      app.world.setActiveGates && app.world.setActiveGates(mode === "none" ? [] : fronts.map((f) => f.entry));
    }
    const v = new THREE.Vector3();
    // Zone libre de la carte : sous la barre du haut, au-dessus des onglets, hors des panneaux.
    const rectOf = (el) => (el && el.isConnected && el.style.display !== "none" ? el.getBoundingClientRect() : null);
    const topBar = rectOf(this.top),
      bottomBar = rectOf(this.bottom);
    const top = (topBar ? topBar.bottom : 60) + 6,
      side = 30;
    let bottom = hgt - (bottomBar ? bottomBar.top : hgt - 190) + 6;
    const blocks = [rectOf(this.prepEl), rectOf(this.waveBar), rectOf(this.panelEl)].filter((r) => r && r.width > 0);
    // Un panneau posé en bas sur toute la largeur (téléphone) remonte la limite basse.
    for (const r of blocks) if (r.width > w * 0.8 && r.top > hgt * 0.35) bottom = Math.max(bottom, hgt - r.top + 6);
    const lateral = blocks.filter((r) => !(r.width > w * 0.8 && r.top > hgt * 0.35));
    const blocked = (x, y) => lateral.some((r) => x > r.left - 12 && x < r.right + 12 && y > r.top - 12 && y < r.bottom + 40);
    for (const f of fronts) {
      seen.add(f.entry);
      let mk = this.markers.get(f.entry);
      if (!mk) {
        const el = h("button", { class: "ptmt-gate", onclick: () => app.focusGate(f.entry) });
        const edge = h("button", { class: "ptmt-edge", onclick: () => app.focusGate(f.entry) });
        this.overlay.append(el, edge);
        mk = { el, edge, sig: null };
        this.markers.set(f.entry, mk);
      }
      const sig = mode + JSON.stringify(f.groups) + f.color;
      if (sig !== mk.sig) {
        mk.sig = sig;
        mk.el.style.setProperty("--c", f.color);
        mk.edge.style.setProperty("--c", f.color);
        mk.el.dataset.mode = mode;
        mk.edge.dataset.mode = mode;
        mk.el.innerHTML = "";
        mk.el.append(
          h("span", { class: "tag" }, mode === "now" ? "Ils arrivent" : mode === "after" ? "Vague suivante" : "Prochaine vague", h("b", {}, f.label)),
          h("span", { class: "foes" }, this.foes(f.groups, true, 4)),
          h("span", { class: "pin" }),
        );
        mk.edge.innerHTML = "";
        mk.edge.append(h("span", { class: "chev" }), h("span", { class: "n" }, String(f.count)));
      }
      const anchor = app.world.gateAnchor ? app.world.gateAnchor(f.entry, v) : null;
      if (!anchor) {
        mk.el.style.display = mk.edge.style.display = "none";
        continue;
      }
      anchor.project(cam);
      let sx = ((anchor.x + 1) / 2) * w,
        sy = ((1 - anchor.y) / 2) * hgt;
      const behind = anchor.z > 1;
      // Le repère (environ 90 px de haut) se pose au-dessus de la porte, ou en dessous si la
      // porte est trop près du haut de l'écran ; il doit tenir dans la zone libre.
      const onScreen = !behind && sx > side + 40 && sx < w - side - 40 && sy > top + 10 && sy < hgt - bottom;
      const above = sy > top + 96 && !blocked(sx, sy - 50);
      const below = sy + 110 < hgt - bottom && !blocked(sx, sy + 60);
      if (onScreen && (above || below)) {
        mk.el.style.display = "";
        mk.edge.style.display = "none";
        mk.el.classList.toggle("below", !above);
        mk.el.style.left = sx + "px";
        mk.el.style.top = (above ? sy : sy + 30) + "px";
      } else {
        mk.el.style.display = "none";
        mk.edge.style.display = "";
        // Direction depuis le centre de la zone libre vers la porte, rabattue sur son bord.
        const x0 = side,
          x1 = w - side,
          y0 = top + 28,
          y1 = hgt - bottom - 28;
        const cx = (x0 + x1) / 2,
          cy = (y0 + y1) / 2;
        let dx = sx - cx,
          dy = sy - cy;
        if (behind) (dx = -dx), (dy = -dy);
        const k = Math.min((x1 - x0) / 2 / Math.max(1e-3, Math.abs(dx)), (y1 - y0) / 2 / Math.max(1e-3, Math.abs(dy)));
        let ex = cx + dx * k,
          ey = cy + dy * k;
        // Pas sous un panneau : on glisse la flèche juste à côté.
        for (const r of lateral)
          if (ex > r.left - 28 && ex < r.right + 28 && ey > r.top - 28 && ey < r.bottom + 28) {
            if (r.left < w / 2) ex = r.right + 30;
            else ex = r.left - 30;
          }
        mk.edge.style.left = ex + "px";
        mk.edge.style.top = ey + "px";
        const tx = behind ? cx - (sx - cx) * 50 : sx,
          ty = behind ? cy - (sy - cy) * 50 : sy;
        mk.edge.style.setProperty("--rot", Math.atan2(ty - ey, tx - ex) + "rad");
      }
    }
    for (const [id, mk] of this.markers)
      if (!seen.has(id)) {
        mk.el.remove();
        mk.edge.remove();
        this.markers.delete(id);
      }
  };
  P.clearMarkers = function () {
    if (this.markers) for (const mk of this.markers.values()) (mk.el.remove(), mk.edge.remove());
    this.markers = new Map();
    this.markerSig = null;
    this.nextKey = null;
    if (this.waveBar) this.waveBar.remove();
    this.waveBar = null;
    this.waveBarSig = null;
  };

  // ── Coupes en cours : anneau de progression au-dessus de la case ────────────────────
  P.updateCutRings = function () {
    const app = this.app,
      game = app.game,
      s = game.state;
    this.cutRings = this.cutRings || new Map();
    const w = app.canvas.clientWidth,
      hgt = app.canvas.clientHeight;
    const v = new THREE.Vector3();
    const seen = new Set();
    for (const j of s.cutting) {
      seen.add(j.id);
      let el = this.cutRings.get(j.id);
      if (!el) {
        el = h("div", {
          class: "ptmt-cut",
          html: `<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="16" class="bg"/><circle cx="20" cy="20" r="16" class="fg"/></svg><span class="axe">${I.axe || ""}</span>`,
        });
        this.overlay.append(el);
        this.cutRings.set(j.id, el);
      }
      const so = game.socket(j.id);
      app.world.toWorld(so.x, so.z, app.world.tileY(so) + 4.2, v);
      v.project(app.camera);
      el.style.display = v.z < 1 ? "" : "none";
      el.style.left = ((v.x + 1) / 2) * w + "px";
      el.style.top = ((1 - v.y) / 2) * hgt + "px";
      const p = game.cutProgress(j.id) || 0;
      el.querySelector(".fg").style.strokeDashoffset = String(100.5 * (1 - p));
    }
    for (const [id, el] of this.cutRings) if (!seen.has(id)) (el.remove(), this.cutRings.delete(id));
  };

  // ── Mode construction : case visée, portée, prix ───────────────────────────────
  /** Case prévisualisée en mode construction (survol à la souris, premier toucher au doigt). */
  P.setBuildPreview = function (id) {
    this.preview = id || null;
    const app = this.app,
      game = app.game;
    if (!this.buildMode || this.buildMode.kind !== "tower" || !id) {
      if (this.buildTag) this.buildTag.style.display = "none";
      if (!this.panel) app.entities.showRange(0, 0, 0);
      return;
    }
    const so = game.socket(id);
    const fam = this.buildMode.family;
    const f = C.towers[fam].forms["1"];
    const col = { fire: 0xff9a52, ice: 0x9fe8ff, water: 0x62b4ff }[fam];
    if (so.kind === fam && !game.towerAt(id) && !game.isForest(id)) app.entities.showRange(so.x, so.z, game.towerStats({ family: fam, tier: 1, branch: null, frenzyT: 0 }).range, col);
    else app.entities.showRange(0, 0, 0);
    if (!this.buildTag) {
      this.buildTag = h("div", { class: "ptmt-buildtag" });
      this.overlay.append(this.buildTag);
    }
    const tag = this.buildTag;
    tag.innerHTML = "";
    tag.dataset.ok = "false";
    if (game.towerAt(id)) tag.append(h("b", {}, "Case occupée"));
    else if (so.kind !== fam) tag.append(h("b", {}, `Sol ${ZONE[so.kind].sol}`), h("span", {}, `Tours ${ZONE[so.kind].tower} seulement`));
    else if (game.isForest(id)) {
      const inf = game.cutInfo(id);
      tag.append(h("b", {}, ZONE[so.kind].forest), h("span", {}, inf.progress !== null ? "Coupe en cours…" : `Touche pour couper · ${inf.cost} or`));
    } else {
      tag.dataset.ok = game.state.gold >= f.cost ? "true" : "false";
      tag.append(h("b", {}, f.name), h("span", { class: "cost" }, `${f.cost} or`));
      if (this.touch) tag.append(h("span", { class: "hint" }, "Touche encore pour construire"));
    }
    tag.style.display = "";
    this.previewPos = so;
  };
  P.updateBuildTag = function () {
    if (!this.buildTag || this.buildTag.style.display === "none" || !this.previewPos) return;
    const app = this.app;
    const so = this.previewPos;
    const v = app.world.toWorld(so.x, so.z, app.world.tileY(so) + 0.4);
    v.project(app.camera);
    const w = app.canvas.clientWidth,
      hgt = app.canvas.clientHeight;
    const tw = this.buildTag.offsetWidth || 120,
      th = this.buildTag.offsetHeight || 40;
    // Au-dessus de la case (sans la cacher), et entière à l'écran.
    const x =Math.max(tw / 2 + 6, Math.min(w - tw / 2 - 6, ((v.x + 1) / 2) * w));
    const y = Math.max(th + 70, Math.min(hgt - 200, ((1 - v.y) / 2) * hgt - 34));
    this.buildTag.style.left = x + "px";
    this.buildTag.style.top = y + "px";
  };

  // ── Mise à jour régulière ─────────────────────────────────────────────────────
  P.update = function (dt, time) {
    const app = this.app,
      game = app.game;
    if (!game) return;
    const s = game.state;
    this.updateLabels();
    this.updateFloaters(dt);
    this.updatePrepMode();
    this.updateMarkers();
    this.updateCutRings();
    this.updateBuildTag();
    if (time - this.last < 0.12 && this.lastGame === game) return;
    this.last = time;
    this.lastGame = game;
    this.updateWaveBar();
    const L = game.L;
    this.levelChip.children[0].textContent = `${game.level}. ${L.name}`;
    this.levelChip.children[1].textContent = s.endless ? (s.phase === "prep" ? `Sans fin · préparation vague ${s.endlessCount + 1}` : `Sans fin · vague ${s.endlessCount}`) : s.phase === "prep" ? `Préparation · vague ${s.wave + 1}/${s.waveCount}` : `Vague ${s.wave}/${s.waveCount}`;
    this.goldChip.children[1].textContent = Math.floor(s.gold);
    this.manaBar.style.width = (100 * s.mana) / s.manaMax + "%";
    this.manaText.textContent = `${Math.floor(s.mana)}/${s.manaMax}`;
    // Trésors : forme + couleur par état.
    const tIcons = { stored: I.chest, carried: I.run, dropped: I.sack, lost: I.lost };
    const labels = { stored: "dans sa réserve", carried: "emporté !", dropped: "tombé", lost: "perdu" };
    const key = s.treasures.map((t) => t.state).join();
    if (key !== this.treasureKey) {
      this.treasureKey = key;
      this.treasureChip.innerHTML = "";
      for (const t of s.treasures) this.treasureChip.append(h("span", { class: "ptmt-t", "data-state": t.state, title: `Trésor ${t.id.slice(1)} (${game.reserve(t.reserve).name}) : ${labels[t.state]}`, html: tIcons[t.state] }));
    }
    this.pauseBtn.innerHTML = s.paused ? I.play : I.pause;
    this.pauseBtn.setAttribute("aria-pressed", s.paused ? "true" : "false");
    this.speedBtn.setAttribute("aria-pressed", s.speed === 2 ? "true" : "false");
    if (this.tab === "spells" || this.tab === "towers" || this.tab === "traps") {
      const sig = this.tab + s.gold + s.traps.length + Math.floor(s.mana) + C.spells.order.map((id) => Math.ceil(s.spells[id].cd)).join() + s.paused + s.phase;
      if (sig !== this.traySig) {
        this.traySig = sig;
        this.renderTray();
      }
    }
    if (this.panel && this.panel.kind !== "mill") {
      const sig = JSON.stringify(this.panelSignature());
      if (sig !== this.panelSig) {
        this.panelSig = sig;
        this.refreshPanel();
      }
    }
    this.updateAlerts();
  };
  P.panelSignature = function () {
    const game = this.app.game,
      s = game.state;
    const p = this.panel;
    if (p.kind === "tower") {
      const t = s.towers.find((x) => x.id === p.id);
      return t ? [t.xp | 0, t.tier, t.branch, t.targeting, s.gold, s.mill.atelier, t.frenzyT > 0] : null;
    }
    if (p.kind === "trap") {
      const t = s.traps.find((x) => x.id === p.id);
      return t ? [t.tier, t.dir, Math.ceil(t.cd), s.gold, s.mill.atelier] : null;
    }
    if (p.kind === "reserve") {
      const r = game.reserve(p.id);
      return [r.tier, r.stock.length, s.gold, s.mill.atelier];
    }
    if (p.kind === "forest" || p.kind === "socket") {
      const pr = game.cutProgress(p.id);
      return [s.gold, game.isForest(p.id), pr === null ? -1 : Math.floor(pr * 20), !!game.towerAt(p.id)];
    }
    return [s.gold, s.traps.length, s.mill.atelier];
  };

  // Étiquettes des réserves (nom, stock, palier, alerte).
  P.updateLabels = function () {
    const app = this.app,
      game = app.game;
    const s = game.state;
    const cam = app.camera;
    const w = app.canvas.clientWidth,
      hgt = app.canvas.clientHeight;
    const v = new THREE.Vector3();
    for (const r of s.reserves) {
      let el = this.labels.get(r.id);
      if (!el) {
        el = h("div", { class: "ptmt-label", onclick: () => this.showReservePanel(r.id) });
        this.overlay.append(el);
        this.labels.set(r.id, el);
      }
      const total = game.L.reserves.find((x) => x.id === r.id).treasures;
      const stealing = s.enemies.some((e) => e.state === "steal" && e.stealRes === r.id);
      const sig = r.stock.length + ":" + r.tier + ":" + stealing;
      if (el.dataset.sig !== sig) {
        el.dataset.sig = sig;
        el.innerHTML = "";
        const stock = h("span", { class: "stock" });
        for (let i = 0; i < total; i++) stock.append(h("i", { class: i < r.stock.length ? "" : "empty" }));
        el.append(h("span", {}, r.name), stock, h("span", { class: "tier" }, ROMAN[r.tier]));
        el.dataset.alert = stealing ? "true" : "false";
      }
      app.world.toWorld(r.x, r.z, app.world.heightU(r.x, r.z) + 3.2, v);
      v.project(cam);
      const vis = v.z < 1 && v.x > -1.1 && v.x < 1.1 && v.y > -1.1 && v.y < 1.1;
      el.style.display = vis ? "" : "none";
      el.style.left = ((v.x + 1) / 2) * w + "px";
      el.style.top = ((1 - v.y) / 2) * hgt + "px";
    }
    for (const [id, el] of this.labels) if (!s.reserves.find((r) => r.id === id)) (el.remove(), this.labels.delete(id));
  };
  P.clearLabels = function () {
    for (const [, el] of this.labels) el.remove();
    this.labels.clear();
    this.treasureKey = null;
  };
  // Textes flottants.
  P.floatAt = function (x, z, text, kind) {
    const app = this.app;
    const v = app.world.toWorld(x, z, app.world.heightU(x, z) + 2.4);
    this.floaters = this.floaters || [];
    if (this.floaters.length > 24) return;
    const el = h("div", { class: "ptmt-float" + (kind === "bad" ? " bad" : kind === "blue" ? " blue" : "") }, text);
    this.overlay.append(el);
    this.floaters.push({ el, v, t: 0 });
  };
  P.updateFloaters = function (dt) {
    if (!this.floaters) return;
    const app = this.app;
    const w = app.canvas.clientWidth,
      hgt = app.canvas.clientHeight;
    const p = new THREE.Vector3();
    this.floaters = this.floaters.filter((f) => {
      f.t += dt;
      if (f.t > 1.1) {
        f.el.remove();
        return false;
      }
      p.copy(f.v).project(app.camera);
      f.el.style.left = ((p.x + 1) / 2) * w + "px";
      f.el.style.top = ((1 - p.y) / 2) * hgt + "px";
      return true;
    });
  };
  // Alertes : porteur proche d'une sortie (cliquable : recentre la caméra).
  P.updateAlerts = function () {
    const app = this.app,
      game = app.game;
    const s = game.state;
    const want = new Map();
    for (const e of s.enemies) {
      if (!e.carrying) continue;
      const rem = game.remaining(e);
      if (rem < 12) want.set(e.id, { e, rem });
    }
    for (const [id, el] of this.alerts) if (!want.has(id)) (el.remove(), this.alerts.delete(id));
    for (const [id, { e, rem }] of want) {
      let el = this.alerts.get(id);
      if (!el) {
        el = h("button", { class: "ptmt-alert", onclick: () => app.focusEnemy(id) });
        this.alertBox.append(el);
        this.alerts.set(id, el);
      }
      el.textContent = `Porteur à ${Math.ceil(rem)} U d'une sortie !`;
    }
  };
  P.flash = function (text, kind) {
    const el = h("div", { class: "ptmt-alert " + (kind || "info") }, text);
    this.alertBox.prepend(el);
    setTimeout(() => el.remove(), 2600);
  };
  P.onSteal = function (ev) {
    const game = this.app.game;
    this.flash(`Un trésor est emporté de ${game.reserve(ev.reserve).name} !`, "");
    this.app.progressTutorial("steal");
  };
  P.onLost = function (ev) {
    const game = this.app.game;
    this.flash(`Trésor perdu (${game.reserve(ev.reserve).name}) : il a passé la sortie.`, "");
  };

  // ── Écrans ────────────────────────────────────────────────────────────────
  P.closeScreen = function () {
    if (this.screen) this.screen.remove();
    this.screen = null;
  };
  P.openScreen = function (content) {
    this.closeScreen();
    this.screen = h("div", { class: "ptmt-screen" }, content);
    this.root.append(this.screen);
    return this.screen;
  };
  P.stars = function (n, big) {
    return h("span", { class: "ptmt-stars", style: big ? "font-size:26px" : "" }, [1, 2, 3].map((i) => h("span", { class: i <= n ? "on" : "off" }, "★")));
  };
  P.showMenu = function () {
    const app = this.app;
    const prog = app.progress;
    const cp = PTMT.progress.loadCheckpoint();
    const levels = h("div", { class: "ptmt-levels" });
    for (let lv = 1; lv <= 5; lv++) {
      const L = PTMT.layouts[lv];
      const st = prog.levels[lv];
      const locked = lv > prog.unlockedLevel;
      const rec = prog.records[lv + ":" + L.id];
      levels.append(
        h(
          "button",
          { class: "ptmt-level", disabled: locked, onclick: () => app.startLevel(lv) },
          h("span", { class: "n" }, `Niveau ${lv} · ${C.levels[lv].waves} vagues`),
          h("b", {}, L.name),
          h("p", {}, L.pitch),
          locked ? h("span", { html: I.lock, style: "width:18px;height:18px;display:inline-flex;color:#8a7547" }) : this.stars(st.stars),
          rec ? h("p", {}, `Record sans fin : ${rec} vagues`) : null,
        ),
      );
    }
    const pts = PTMT.progress.pointsAvailable(prog);
    const sheet = h(
      "div",
      { class: "ptmt-sheet" },
      h("h1", {}, "Pas touche à mes trésors"),
      h("p", { class: "lead" }, "Des cambrioleurs maladroits en veulent aux six trésors du moulin. Défends le domaine par le feu, la glace et l'eau !"),
      levels,
      h(
        "div",
        { class: "ptmt-menu-actions" },
        cp && cp.level ? h("button", { class: "ptmt-btn ptmt-btn-go", onclick: () => app.resume(cp) }, `Reprendre (niveau ${cp.level}, vague ${cp.wave + 1})`) : null,
        h("button", { class: "ptmt-btn ptmt-btn-gold", onclick: () => this.showTalents() }, h("span", { html: I.star, style: "width:18px;height:18px;display:inline-flex" }), `Talents${pts > 0 ? " · " + pts + " point" + (pts > 1 ? "s" : "") + " à placer" : ""}`),
        app.game && !app.game.isOver ? h("button", { class: "ptmt-btn", onclick: () => this.closeScreen() }, "Retour à la partie") : null,
        h("a", { class: "ptmt-btn", href: "../", onclick: (e) => app.leave(e) }, h("span", { html: I.home, style: "width:18px;height:18px;display:inline-flex" }), "Visiter le moulin"),
      ),
    );
    this.openScreen(sheet);
  };
  P.showTalents = function () {
    const app = this.app;
    const prog = app.progress;
    const T = PTMT.talents;
    const earned = PTMT.progress.pointsEarned(prog);
    const render = () => {
      const alloc = prog.talents;
      const avail = earned - T.spentTotal(alloc);
      const grid = h("div", { class: "ptmt-talents" });
      for (const fam of ["fire", "ice", "water"]) {
        const tree = h("div", { class: "ptmt-tree " + fam }, h("h3", {}, h("span", {}, C.talents[fam].name), h("span", { class: "ranks" }, `${T.spentIn(alloc, fam)}/14`)));
        let lastTier = null;
        for (const t of C.talents[fam].items) {
          if (t.tier !== lastTier) {
            tree.append(h("div", { class: "ptmt-tier-sep" }, t.tier === "base" ? "Base" : t.tier === "advanced" ? `Avancés (${C.talents.advancedNeeds} points)` : `Ultime (${C.talents.ultimateNeeds} points + un avancé au rang 2)`));
            lastTier = t.tier;
          }
          const r = alloc[fam][t.id] || 0;
          const up = T.canRankUp(alloc, fam, t.id, earned);
          const down = T.canRankDown(alloc, fam, t.id);
          const val = t.values[Math.max(0, r - 1)];
          const nextVal = t.values[Math.min(t.ranks - 1, r)];
          const show = (v) =>
            Array.isArray(v)
              ? t.text.replace("{h}", Math.round(v[0] * 100)).replace("{b}", Math.round(v[1] * 100))
              : t.text.replace("{v}", Math.round(v * 100)).replace("{p}", Math.round(v * 100)).replace("{n}", v);
          tree.append(
            h(
              "div",
              { class: "ptmt-talent" + (r === 0 && up ? " locked" : "") },
              h("span", { class: "ti", html: I[fam] }),
              h("span", { class: "tt" }, h("b", {}, t.name), r ? show(val) : "Rang suivant : " + show(nextVal), h("span", { class: "ranks" }, ` ${r}/${t.ranks}`)),
              h(
                "span",
                { class: "pm" },
                h("button", { disabled: !!up, title: up || "Ajouter un rang", onclick: () => ((alloc[fam][t.id] = r + 1), PTMT.progress.save(prog), render()) }, "+"),
                h("button", { disabled: !!down, title: down || "Retirer un rang", onclick: () => ((alloc[fam][t.id] = r - 1), PTMT.progress.save(prog), render()) }, "−"),
              ),
            ),
          );
        }
        grid.append(tree);
      }
      const sheet = h(
        "div",
        { class: "ptmt-sheet" },
        h("h1", {}, "Talents"),
        h("p", { class: "lead" }, `${avail} point${avail > 1 ? "s" : ""} disponible${avail > 1 ? "s" : ""} sur ${earned} gagnés. Chaque niveau rapporte jusqu'à 4 points (victoire 2, deuxième étoile 1, troisième étoile 1). Redistribution gratuite entre les parties ; une partie en cours garde ses talents.`),
        grid,
        h(
          "div",
          { class: "ptmt-menu-actions" },
          h("button", { class: "ptmt-btn", onclick: () => ((prog.talents = T.emptyAllocation()), PTMT.progress.save(prog), render()) }, "Tout redistribuer"),
          h("button", { class: "ptmt-btn ptmt-btn-go", onclick: () => this.showMenu() }, "Retour"),
        ),
      );
      this.openScreen(sheet);
    };
    render();
  };
  P.showResult = function (result, reward) {
    const app = this.app,
      game = app.game;
    const L = game.L;
    const win = result.win;
    const losses = h(
      "div",
      { class: "ptmt-losses" },
      game.state.reserves.map((r) => h("div", {}, `${r.name} : ${result.lostByReserve[r.id] || 0} perdu${(result.lostByReserve[r.id] || 0) > 1 ? "s" : ""}`)),
    );
    const endlessOver = result.endless;
    let title = win ? "Victoire !" : endlessOver ? "Fin du mode sans fin" : "Défaite…";
    let lead = win ? `${result.saved} trésor${result.saved > 1 ? "s" : ""} sauvé${result.saved > 1 ? "s" : ""} sur ${result.total}.` : endlessOver ? `Tu as tenu ${result.endlessCount} vague${result.endlessCount > 1 ? "s" : ""} de plus.` : "Tous les trésors ont été emportés hors du domaine.";
    const actions = h("div", { class: "ptmt-menu-actions", style: "justify-content:center" });
    if (win) {
      if (game.level < 5) actions.append(h("button", { class: "ptmt-btn ptmt-btn-go", onclick: () => app.startLevel(game.level + 1, { transition: true }) }, "Niveau suivant"));
      else actions.append(h("button", { class: "ptmt-btn ptmt-btn-go", onclick: () => this.showMenu() }, "Choix des niveaux"));
      actions.append(h("button", { class: "ptmt-btn", onclick: () => app.startLevel(game.level) }, "Rejouer"));
      actions.append(h("button", { class: "ptmt-btn ptmt-btn-gold", onclick: () => app.continueEndless() }, "Continuer sans fin"));
    } else {
      actions.append(h("button", { class: "ptmt-btn ptmt-btn-go", onclick: () => app.startLevel(game.level) }, "Réessayer (même disposition)"));
      actions.append(h("button", { class: "ptmt-btn", onclick: () => this.showMenu() }, "Choix des niveaux"));
    }
    const sheet = h(
      "div",
      { class: "ptmt-sheet", style: "text-align:center;max-width:560px" },
      h("h1", {}, title),
      win ? h("div", { class: "ptmt-result-stars" }, [1, 2, 3].map((i) => h("span", { style: `color:${i <= result.stars ? "#f2b93b" : "#d8ccae"}` }, "★"))) : null,
      h("p", { class: "lead" }, lead),
      win ? h("p", { class: "ptmt-note" }, result.stars === 3 ? "Aucun trésor n'a même été touché !" : result.stars === 2 ? "Aucun trésor perdu définitivement." : "Pour 2 étoiles : ne perds aucun trésor ; pour 3 : qu'aucun ne soit pris.") : null,
      losses,
      reward && reward.points ? h("p", { class: "lead", style: "color:#3b7c44" }, `+${reward.points} point${reward.points > 1 ? "s" : ""} de talent !`) : null,
      reward && reward.record ? h("p", { class: "lead", style: "color:#8a5a10" }, "Nouveau record !") : null,
      actions,
      h("div", { class: "ptmt-menu-actions", style: "justify-content:center" }, h("button", { class: "ptmt-btn ptmt-btn-ghost", style: "color:#6b3f19;border-color:#d6c496", onclick: () => this.showTalents() }, "Talents")),
    );
    this.openScreen(sheet);
  };
  P.banner = function (title, sub) {
    const el = h("div", { class: "ptmt-transition" }, h("div", { class: "banner" }, title, sub ? h("small", {}, sub) : null));
    this.root.append(el);
    setTimeout(() => el.remove(), 3300);
  };

  // ── Tutoriel ─────────────────────────────────────────────────────────────────
  P.tip = function (id, text, opts = {}) {
    const prog = this.app.progress;
    if (!opts.force && prog.tutorial[id]) return;
    prog.tutorial[id] = true;
    PTMT.progress.save(prog);
    if (this.tipEl) this.tipEl.remove();
    this.tipEl = h("div", { class: "ptmt-tip" }, h("span", { class: "who", html: I.chest, style: "color:#6b3f19" }), h("div", {}, h("p", {}, text), h("button", { class: "ptmt-btn ptmt-btn-go", onclick: () => this.hideTip() }, "Compris")));
    this.root.append(this.tipEl);
    clearTimeout(this.tipTimer);
    this.tipTimer = setTimeout(() => this.hideTip(), opts.duration || 14000);
  };
  P.hideTip = function () {
    if (this.tipEl) this.tipEl.remove();
    this.tipEl = null;
  };

  P.bindKeys = function () {
    window.addEventListener("keydown", (e) => {
      if (e.repeat) return;
      const app = this.app;
      if (!app.game) return;
      if (e.key === " " || e.key === "p") {
        e.preventDefault();
        app.togglePause();
      } else if (e.key === "Escape") {
        if (this.aim || this.buildMode) this.cancelModes(), this.renderTray();
        else if (this.panel) this.closePanel();
        else app.openMenu();
      } else if (e.key === "Enter" && app.game.state.phase === "prep") app.launchWave();
      else if (e.key === "f") app.toggleSpeed();
      else if (e.key >= "1" && e.key <= "5") {
        const id = C.spells.order[Number(e.key) - 1];
        this.setTab("spells");
        this.startAim(id);
      }
    });
  };

  PTMT.UI = UI;
})();
