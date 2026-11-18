// La Fête du Moulin — interface : barre du haut, menu des jeux, joueurs, sponsors, salle
// d'attente, compteurs de partie, résultats, messages.
//
// Tout est en HTML par-dessus la vue 3D (classes « fete-… », styles dans src/moulin2/arcade.css).
// Le cœur (50-core.js) remplit ces éléments et écoute les demandes du joueur :
//
//   const hud = MF.Hud.create({ dom, mobile });
//   hud.on((action, valeur) => …)   // "enter" id · "leave" · "start" · "replay" · "option" { key, value }
//                                   // "profile" { name, color } · "room" code|null · "sound" bool
// Pour les jeux (pendant une partie) :
//   hud.stats([{ key, label }])     compteurs en haut de l'écran ; hud.set(key, texte)
//   hud.flash("Dernier tour !")     gros message bref au centre ; options { color, hold (s) }
//   hud.hint("Flèches : piloter")   ligne d'aide en bas
//   hud.board([{ name, color, text, self }])   classement en direct, à droite
//   hud.toast("…")                  petit message en haut
//   hud.widget("classe", html) → élément libre posé sur l'écran (viseur…), retiré en quittant le jeu
//   hud.pop("+25", x, y)            petit texte qui s'envole depuis un point de l'écran
//   hud.gauge(0.7, "Puissance")     jauge en bas de l'écran (null pour la cacher)
(function () {
  "use strict";
  const MF = (globalThis.MoulinFete = globalThis.MoulinFete || {});
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const el = (tag, cls, parent, html) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    if (parent) parent.appendChild(e);
    return e;
  };
  const dot = (color) => `<i class="fete-dot" style="--c:${esc(color)}"></i>`;
  const STATE_TEXT = { wait: "ready", play: "playing", done: "finished", watch: "watching" };

  function create({ dom, mobile }) {
    const listeners = [];
    const act = (name, value) => listeners.slice().forEach((fn) => fn(name, value));
    const root = el("div", "fete-ui" + (mobile ? " is-mobile" : ""), dom);
    root.dataset.mode = "walk";

    /* ---------------------------------------------------------------- barre du haut */
    const top = el(
      "div",
      "fete-top",
      root,
      `<button type="button" class="fete-brand" data-open="players" title="Players, nickname and room">
         <span class="fete-brand-icon" aria-hidden="true">🎪</span>
         <span class="fete-brand-text"><b>Dream Mill Fest</b><small data-room>Connecting…</small></span>
       </button>
       <div class="fete-top-actions">
         <button type="button" class="fete-btn fete-btn-main" data-open="games"><span aria-hidden="true">🎮</span><span class="fete-btn-label">Games</span></button>
         <button type="button" class="fete-btn" data-open="players" title="Players here"><span aria-hidden="true">👥</span><span data-count>1</span></button>
         <button type="button" class="fete-btn" data-open="sponsors"><span aria-hidden="true">📣</span><span class="fete-btn-label">Sponsors</span></button>
         <button type="button" class="fete-btn" data-music aria-pressed="true" title="Fair music"><span aria-hidden="true" data-music-icon>🎵</span></button>
         <button type="button" class="fete-btn" data-sound aria-pressed="true" title="Game sounds"><span aria-hidden="true" data-sound-icon>🔊</span></button>
       </div>`,
    );
    const roomLabel = top.querySelector("[data-room]");
    const countLabel = top.querySelector("[data-count]");
    const soundBtn = top.querySelector("[data-sound]");
    const musicBtn = top.querySelector("[data-music]");
    /** Choix de l'ordinateur : une vignette par modèle (dessinée d'après le modèle 3D). */
    const laptopPicker = (current, attr) =>
      `<div class="fete-laptops">` +
      MF.laptops.list.map((m) => `<button type="button" ${attr}="${m.id}" aria-pressed="${m.id === current}" title="${esc(m.blurb)}"><i data-thumb="${m.id}" style="--c:${m.color}"></i><span>${esc(m.name)}</span></button>`).join("") +
      `</div>`;
    const fillThumbs = (scope) =>
      MF.laptops.thumbs((images) => {
        for (const i of scope.querySelectorAll("[data-thumb]")) if (images[i.dataset.thumb]) i.style.backgroundImage = `url(${images[i.dataset.thumb]})`;
      });

    /* ---------------------------------------------------------------- panneaux */
    const panels = {};
    for (const [name, title] of [
      ["games", "Fair games"],
      ["players", "Players & room"],
      ["sponsors", "Sponsors"],
    ]) {
      const p = el("section", "fete-panel", root);
      p.hidden = true;
      p.dataset.panel = name;
      p.innerHTML = `<header><h2>${title}</h2><button type="button" class="fete-x" data-close aria-label="Close">✕</button></header><div class="fete-panel-body"></div>`;
      panels[name] = p.querySelector(".fete-panel-body");
    }
    let openName = null;
    function openPanel(name) {
      openName = name && openName !== name ? name : null;
      for (const p of root.querySelectorAll(".fete-panel")) p.hidden = p.dataset.panel !== openName;
      root.classList.toggle("has-panel", !!openName);
      if (openName) act("panel", openName);
    }

    /* ---------------------------------------------------------------- invite « Jouer » près d'un stand */
    const prompt = el("button", "fete-prompt", root);
    prompt.type = "button";
    prompt.hidden = true;
    let promptId = null, promptAct = "enter";

    /* ---------------------------------------------------------------- couche de jeu */
    const game = el("div", "fete-game", root);
    const stats = el("div", "fete-stats", game);
    const side = el("div", "fete-side", game); // colonne de droite : classement en direct, puis top 10
    const board = el("ol", "fete-board", side);
    const custom = el("div", "fete-custom", game);
    const flash = el("div", "fete-flash", game);
    const count = el("div", "fete-count", game);
    const hint = el("div", "fete-hint", game);
    const quit = el("button", "fete-btn fete-quit", game, `<span aria-hidden="true">✕</span><span class="fete-btn-label">Quit</span>`);
    quit.type = "button";
    quit.dataset.act = "leave";
    const card = el("section", "fete-card fete-lobby", game);
    card.hidden = true;
    const top10 = el("aside", "fete-top10" + (mobile ? " is-folded" : ""), side);
    top10.hidden = true;
    // assis à l'espace de travail : une barre discrète (se lever, ce sur quoi on travaille)
    const seatBar = el("div", "fete-seatbar", root);
    seatBar.hidden = true;
    const toasts = el("div", "fete-toasts", root);
    const statEls = new Map();
    let flashTimer = 0, cardSig = "";
    // guichet des sponsors : ce que le visiteur est en train de saisir (gardé d'un dessin à l'autre)
    const adDraft = { target: "fair", name: "", tagline: "", url: "", image: "", bg: "#1d2b4f", fg: "#ffffff", contact: "", key: "", owner: false };
    let adModel = null;
    try {
      adDraft.key = localStorage.getItem("fete-ads-cle") || "";
    } catch (error) {
      /* sans importance */
    }
    function drawAd() {
      const canvas = panels.sponsors.querySelector("[data-ad-canvas]");
      if (!canvas) return;
      const d = adDraft;
      MF.sponsors.paint(canvas.getContext("2d"), canvas.width, canvas.height, { taken: !!d.name.trim(), name: d.name.trim(), tagline: d.tagline.trim(), bg: d.bg, fg: d.fg, logo: d.image, label: "Your banner" }, { redraw: drawAd });
    }
    const redrawAds = () => {
      panels.sponsors._sig = "";
      if (adModel) hud.setSponsors(adModel);
    };

    /* ---------------------------------------------------------------- clics */
    root.addEventListener("click", (ev) => {
      const t = ev.target.closest("[data-open],[data-close],[data-act],[data-game],[data-spot],[data-sound],[data-music],[data-ambience],[data-color],[data-kit],[data-hat],[data-logo-clear],[data-ad-op],[data-copy],[data-private],[data-public],[data-fold]");
      if (!t || !root.contains(t)) return;
      if (t.dataset.open) return openPanel(t.dataset.open);
      if (t.hasAttribute("data-close")) return openPanel(null);
      if (t.dataset.game) {
        openPanel(null);
        return act("enter", t.dataset.game);
      }
      if (t.dataset.spot) {
        openPanel(null);
        return act("spot", t.dataset.spot);
      }
      if (t.hasAttribute("data-sound")) return act("sound", soundBtn.getAttribute("aria-pressed") !== "true");
      if (t.hasAttribute("data-music")) return act("music", musicBtn.getAttribute("aria-pressed") !== "true");
      if (t.dataset.ambience) return act("ambience", t.dataset.ambience);
      if (t.hasAttribute("data-fold")) return top10.classList.toggle("is-folded");
      if (t.dataset.color) return act("profile", { color: t.dataset.color });
      if (t.dataset.kit) return act("profile", { kit: t.dataset.kit });
      if (t.dataset.hat) return act("profile", { hat: t.dataset.hat });
      if (t.hasAttribute("data-logo-clear")) return act("profile", { logo: "" });
      if (t.dataset.adOp) {
        const d = adDraft, op = t.dataset.adOp;
        if (op === "noimage") {
          d.image = "";
          return redrawAds();
        }
        const details = panels.sponsors.querySelector(".fete-ad-owner");
        d.owner = !!(details && details.open);
        return act("ad", { op, id: t.dataset.id, target: d.target, contact: d.contact.trim(), key: d.key, ad: { name: d.name.trim(), tagline: d.tagline.trim(), url: d.url.trim(), image: d.image, bg: d.bg, fg: d.fg } });
      }
      if (t.hasAttribute("data-copy")) return act("copy");
      if (t.hasAttribute("data-private")) {
        const input = panels.players.querySelector("[data-code]");
        return act("room", (input && input.value) || "");
      }
      if (t.hasAttribute("data-public")) return act("room", null);
      const a = t.dataset.act;
      if (a === "option") {
        let v = t.dataset.value;
        try {
          v = JSON.parse(v);
        } catch (e) {}
        return act("option", { key: t.dataset.key, value: v });
      }
      if (a) act(a, t.dataset.arg);
    });
    root.addEventListener("input", (ev) => {
      const field = ev.target.dataset && ev.target.dataset.ad;
      if (!field) return;
      adDraft[field] = ev.target.value;
      drawAd();
    });
    root.addEventListener("change", (ev) => {
      if (ev.target.matches("[data-ad-image]") && ev.target.files && ev.target.files[0])
        // l'image d'une annonce : 512 × 256 pixels au plus, quelques dizaines de kilo-octets
        MF.shrinkImage(ev.target.files[0], { w: 512, h: 256, free: true, max: 60000 }).then(
          (image) => {
            adDraft.image = image;
            redrawAds();
          },
          (error) => hud.toast(error.message),
        );
      if (ev.target.matches("[data-name]")) act("profile", { name: ev.target.value });
      if (ev.target.matches("[data-bio]")) act("profile", { bio: ev.target.value });
      if (ev.target.matches("[data-logo]") && ev.target.files && ev.target.files[0])
        // l'image du capot : 96 × 64 pixels, quelques kilo-octets (elle voyage avec le profil)
        MF.shrinkImage(ev.target.files[0], { w: 96, h: 64, max: 12000 }).then(
          (logo) => act("profile", { logo }),
          (error) => hud.toast(error.message),
        );
    });
    // les touches tapées dans un champ ne doivent pas faire marcher le personnage
    root.addEventListener("keydown", (ev) => {
      if (ev.target.matches("input")) {
        ev.stopPropagation();
        if (ev.key === "Enter") ev.target.blur();
      }
    });
    root.addEventListener("keyup", (ev) => ev.target.matches("input") && ev.stopPropagation());
    prompt.addEventListener("click", () => promptId && act(promptAct, promptId));

    const hud = {
      root,
      layer: custom,
      on: (fn) => listeners.push(fn),
      openPanel,
      panel: () => openName,
      /** "walk" (promenade) · "lobby" (salle d'attente) · "run" (partie) · "watch" (spectateur) · "results" */
      mode(m) {
        if (root.dataset.mode === m) return;
        root.dataset.mode = m;
        if (m !== "walk") openPanel(openName && null);
      },
      setMusic(on) {
        musicBtn.setAttribute("aria-pressed", String(!!on));
        musicBtn.querySelector("[data-music-icon]").textContent = on ? "🎵" : "🔕";
      },
      setSound(on) {
        soundBtn.setAttribute("aria-pressed", String(!!on));
        soundBtn.querySelector("[data-sound-icon]").textContent = on ? "🔊" : "🔇";
      },
      setRoom(label, n) {
        roomLabel.textContent = label + " · " + n + (n > 1 ? " players" : " player");
        countLabel.textContent = n;
      },
      /** Menu des jeux : [{ id, title, icon, blurb, players, phase }] */
      setGames(list) {
        const sig = JSON.stringify(list);
        if (panels.games._sig === sig) return;
        panels.games._sig = sig;
        // d'abord les lieux où l'on se retrouve (on y est porté d'un clic), puis les jeux
        panels.games.innerHTML =
          `<div class="fete-games fete-spots">` +
          [["deck", "💻", "Founders' Deck", "66 seats by the pond · sit & work"], ["terrace", "🛋️", "Mill Terrace", "Sofa, table for 4, stone skipping, fireworks button"], ["camp", "🔥", "Lumber Camp", "Campfire, hammocks, 3 lumberjack games"], ["wheel", "🎡", "The Tim Ferriss Wheel", "Hilltop · 38 m high · the 4-hour ride (takes 84 s)"], ["balloon", "🎈", "Up and to the Right", "Hot-air balloon over the valley · Garage Grand Prix · Hype Train"], ["south", "🐂", "South Shore", "Bull Market, Tech Stack, Up Round, Burn Rate, Go To Market"], ["carousel", "🎠", "The Pivot", "Carousel on the Green"], ["gate", "🎪", "Main Gate", "Back to the entrance"]]
            .map(([id, icon, title, sub]) => `<button type="button" class="fete-game-card is-spot" data-spot="${id}"><span class="fete-game-icon" aria-hidden="true">${icon}</span><b>${title}</b><small>${sub}</small></button>`)
            .join("") +
          `</div><div class="fete-games">` +
          list
            .map((g) => {
              const live = g.phase === "run" || g.phase === "countdown";
              const who = g.players ? `${g.players} player${g.players > 1 ? "s" : ""} · ${live ? "game in progress" : "in the lobby"}` : "nobody yet";
              return `<button type="button" class="fete-game-card${g.players ? " is-busy" : ""}" data-game="${esc(g.id)}">
                <span class="fete-game-icon" aria-hidden="true">${g.icon}</span>
                <b>${esc(g.title)}</b><small>${esc(g.blurb || "")}</small><em>${who}</em></button>`;
            })
            .join("") +
          `</div><p class="fete-note">Pick a game to go there, or walk around: every stand has its sign. Games are for 1 to 8 players.</p>`;
      },
      /** Panneau des joueurs. model : { self: { name, color }, players: [{ name, color, self, doing }], room: { label, isPrivate, code }, net } */
      setPlayers(model) {
        const sig = JSON.stringify(model);
        if (panels.players._sig === sig) return;
        // ne pas redessiner pendant que le joueur tape son pseudo ou un code
        if (panels.players.contains(document.activeElement) && document.activeElement.matches("input")) return;
        panels.players._sig = sig;
        panels.players.innerHTML =
          `<ul class="fete-players">` +
          model.players.map((p) => `<li>${dot(p.color)}<b>${esc(p.name)}${p.self ? " <span>(you)</span>" : ""}</b><small>${esc(p.doing)}</small></li>`).join("") +
          `</ul>
          <h3>Your nickname and color</h3>
          <input type="text" class="fete-input" data-name maxlength="18" value="${esc(model.self.name)}" aria-label="Nickname" autocomplete="off" spellcheck="false">
          <div class="fete-swatches">` +
          MF.PLAYER_COLORS.map((c) => `<button type="button" data-color="${c}" style="--c:${c}" aria-pressed="${c === model.self.color}" aria-label="Color"></button>`).join("") +
          `</div>
          <h3>Your laptop</h3>${laptopPicker(model.self.kit, "data-kit")}
          <div class="fete-row fete-logo-row"><i class="fete-logo-thumb"${model.self.logo ? ` style="background-image:url(${esc(model.self.logo)})"` : ""}></i><label class="fete-btn"><input type="file" accept="image/*" data-logo hidden>${model.self.logo ? "Change the image" : "Put your logo on the lid"}</label>${model.self.logo ? `<button type="button" class="fete-btn" data-logo-clear>Remove</button>` : ""}</div>
          <h3>Your hat</h3>
          <div class="fete-hats">` +
          MF.hats.list.map((h) => `<button type="button" data-hat="${h.id}" aria-pressed="${h.id === model.self.hat}" title="${esc(h.ref)}"><i>${h.icon}</i><span>${esc(h.name)}</span></button>`).join("") +
          `</div>
          <p class="fete-note">“${esc((MF.hats.list.find((h) => h.id === model.self.hat) || MF.hats.list[0]).ref)}”</p>
          <h3>What are you building?</h3>
          <input type="text" class="fete-input" data-bio maxlength="40" value="${esc(model.self.bio || "")}" placeholder="shown under your name, to everyone" aria-label="What you are building" autocomplete="off" spellcheck="false">
          <h3>Play with friends</h3>
          <p class="fete-note">${esc(model.room.label)}. ${model.room.isPrivate ? "Only people with the link can join." : "Every visitor lands here; send the link to play together."}</p>
          <div class="fete-row"><button type="button" class="fete-btn fete-btn-main" data-copy>Copy invite link</button>${model.room.isPrivate ? `<button type="button" class="fete-btn" data-public>Public room</button>` : ""}</div>
          <div class="fete-row"><input type="text" class="fete-input" data-code maxlength="24" placeholder="private room name" value="${esc(model.room.code || "")}" aria-label="Private room name" autocomplete="off" spellcheck="false"><button type="button" class="fete-btn" data-private>Open</button></div>
          <p class="fete-net">${esc(model.net)}</p>`;
        fillThumbs(panels.players);
      },
      /**
       * Guichet des sponsors. model : { open, online, targets: [{ id, label, group, taken, name, url, preview }],
       * requests: null | [{ id, label, name, tagline, url, image, contact, date }] }
       */
      setSponsors(model) {
        adModel = model;
        const sig = JSON.stringify(model) + "|" + adDraft.image.length;
        if (panels.sponsors._sig === sig) return;
        // ne pas redessiner pendant que l'on remplit le formulaire
        if (panels.sponsors.contains(document.activeElement) && document.activeElement.matches("input, select")) return;
        panels.sponsors._sig = sig;
        const d = adDraft;
        const option = (t) => `<option value="${t.id}"${t.id === d.target ? " selected" : ""}>${esc(t.label)} · ${t.taken ? esc(t.name) + (t.preview ? " (your preview)" : "") : "available"}</option>`;
        const main = model.targets.filter((t) => t.group === "main"), games = model.targets.filter((t) => t.group !== "main");
        const thumb = (image) => `<i class="fete-logo-thumb"${image ? ` style="background-image:url(${esc(image)})"` : ""}></i>`;
        const requests = !model.requests
          ? ""
          : model.requests.length
            ? `<ul class="fete-ad-requests">` +
              model.requests
                .map(
                  (r) =>
                    `<li>${thumb(r.image)}<div><b>${esc(r.name)}</b> → ${esc(r.label)}<small>${esc([r.tagline, r.url, r.contact, r.date].filter(Boolean).join(" · "))}</small></div><button type="button" class="fete-btn fete-btn-main" data-ad-op="approve" data-id="${esc(r.id)}">Publish</button><button type="button" class="fete-btn" data-ad-op="reject" data-id="${esc(r.id)}">Decline</button></li>`,
                )
                .join("") +
              `</ul>`
            : `<p class="fete-note">No request is waiting.</p>`;
        const where = model.online ? (model.open ? "Publishing is open: enter your owner key." : "Publishing is closed: set the ADS_KEY variable of the site first.") : "The sponsor service does not answer here: it runs on the published site.";
        panels.sponsors.innerHTML =
          `<p class="fete-note">Put your brand inside the fair: <b>one sponsor per game</b> (its banners, its stand, its top-10 board), one for <b>all the Top 10 boards</b>, and a <b>main sponsor</b> for the whole fest (entrance arch, mill banner, hot-air balloon, park map, loading screen). Nothing to pay here: try it, then send your request.</p>
          <label class="fete-label">Where</label>
          <select class="fete-input" data-ad="target"><optgroup label="The whole fest">${main.map(option).join("")}</optgroup><optgroup label="One game">${games.map(option).join("")}</optgroup></select>
          <label class="fete-label">Brand</label>
          <input type="text" class="fete-input" data-ad="name" maxlength="28" value="${esc(d.name)}" placeholder="Acme" autocomplete="off" spellcheck="false">
          <label class="fete-label">Tagline <small>optional</small></label>
          <input type="text" class="fete-input" data-ad="tagline" maxlength="60" value="${esc(d.tagline)}" placeholder="Tools for indie makers" autocomplete="off">
          <label class="fete-label">Website <small>optional</small></label>
          <input type="url" class="fete-input" data-ad="url" maxlength="200" value="${esc(d.url)}" placeholder="https://" autocomplete="off" spellcheck="false">
          <div class="fete-row fete-logo-row">${thumb(d.image)}<label class="fete-btn"><input type="file" accept="image/*" data-ad-image hidden>${d.image ? "Change the image" : "Add a logo or a picture"}</label>${d.image ? `<button type="button" class="fete-btn" data-ad-op="noimage">Remove</button>` : ""}</div>
          <div class="fete-row fete-logo-row"><span class="fete-note">Banner colours</span><input type="color" data-ad="bg" value="${esc(d.bg)}" title="Background colour" aria-label="Background colour"><input type="color" data-ad="fg" value="${esc(d.fg)}" title="Text colour" aria-label="Text colour"></div>
          <canvas class="fete-ad-canvas" width="640" height="160" data-ad-canvas></canvas>
          <div class="fete-row"><button type="button" class="fete-btn fete-btn-main" data-ad-op="preview">Try it in the fair</button><button type="button" class="fete-btn" data-ad-op="clear">Remove my preview</button></div>
          <p class="fete-note">The preview is visible to you only, in this browser. To show it to everyone, send a request: the owner of the fair publishes it.</p>
          <div class="fete-row"><input type="text" class="fete-input" data-ad="contact" maxlength="80" value="${esc(d.contact)}" placeholder="How to reach you (email, X…)" autocomplete="off"><button type="button" class="fete-btn" data-ad-op="request">Send my request</button></div>
          <details class="fete-ad-owner"${d.owner ? " open" : ""}><summary>I own this fair</summary>
            <div class="fete-row"><input type="password" class="fete-input" data-ad="key" value="${esc(d.key)}" placeholder="Owner key" autocomplete="off"><button type="button" class="fete-btn fete-btn-main" data-ad-op="publish">Publish</button><button type="button" class="fete-btn" data-ad-op="unpublish">Take down</button></div>
            <div class="fete-row"><button type="button" class="fete-btn" data-ad-op="pending">Show the requests</button></div>
            ${requests}
            <p class="fete-note">${where}</p>
          </details>
          <h3>Who sponsors what</h3>
          <ul class="fete-slots">` +
          model.targets
            .map((t) => {
              const who = t.taken ? (t.url ? `<a href="${esc(t.url)}" target="_blank" rel="noopener sponsored">${esc(t.name)}</a>` : esc(t.name)) + (t.preview ? " · your preview" : "") : "available";
              return `<li class="${t.taken ? "is-taken" : ""}"><b>${esc(t.label)}</b><em>${who}</em></li>`;
            })
            .join("") +
          `</ul>`;
        drawAd();
      },
      /**
       * Bouton d'invite quand on est près d'un stand ou d'un lieu (null pour le cacher) :
       * { id, icon, title, verb ("Play" par défaut), action ("enter" pour un jeu, "place" pour un lieu) }.
       */
      prompt(def) {
        const id = def ? (def.action || "enter") + ":" + def.id + ":" + (def.title || "") : null;
        if (id === prompt.dataset.sig) return;
        prompt.dataset.sig = id || "";
        promptId = def ? def.id : null;
        promptAct = def ? def.action || "enter" : "enter";
        prompt.hidden = !def;
        if (def) prompt.innerHTML = `<span aria-hidden="true">${def.icon || ""}</span><span>${esc(def.verb || "Play")}: <b>${esc(def.title)}</b></span>${mobile ? "" : "<kbd>E</kbd>"}`;
      },
      /**
       * Top 10 du jeu en cours, visible dans la salle d'attente et pendant la partie (null pour le cacher) :
       * { title, variant, rows: [{ pos, name, color, text, self }], fresh: rang tout juste obtenu }.
       */
      top10(model) {
        if (!model) {
          top10.hidden = true;
          top10._sig = "";
          return;
        }
        const sig = JSON.stringify(model);
        if (sig === top10._sig) return;
        top10._sig = sig;
        top10.hidden = false;
        const rows = model.rows.length
          ? model.rows.map((r) => `<li class="${r.self ? "is-self" : ""}${r.pos === model.fresh ? " is-fresh" : ""}"><span class="fete-pos">${r.pos}</span>${dot(r.color)}<b>${esc(r.name)}</b><em>${esc(r.text)}</em></li>`).join("")
          : `<li class="is-empty">Nobody yet: be the first name on the wall!</li>`;
        top10.innerHTML = `<button type="button" class="fete-top10-head" data-fold title="Show or hide the top 10"><span aria-hidden="true">🏆</span><b>TOP 10</b><small>${esc(model.variant || "")}</small></button>
          <ol>${rows}</ol><p>Written here <b>forever</b>.</p>`;
      },
      /** Barre affichée quand on est assis : { bio } (null pour la cacher). */
      seat(model) {
        seatBar.hidden = !model;
        if (!model) return (seatBar._sig = "");
        const sig = JSON.stringify(model);
        if (sig === seatBar._sig || (seatBar.contains(document.activeElement) && document.activeElement.matches("input"))) return;
        seatBar._sig = sig;
        // assis, on travaille : choix de l'ambiance sonore ; on regarde autour de soi en glissant
        seatBar.innerHTML =
          `<div class="fete-seat-sound" role="group" aria-label="Ambience">` +
          MF.ambience.MODES.map((m) => `<button type="button" class="fete-seat-mode" data-ambience="${m.id}" aria-pressed="${m.id === model.ambience}" title="${m.name}"><span aria-hidden="true">${m.icon}</span></button>`).join("") +
          `</div><span class="fete-seat-tip">${mobile ? "Drag to look around" : "Drag to look around · scroll to zoom"}</span>
          <button type="button" class="fete-btn" data-act="view" title="Reset the view">↺</button>
          <button type="button" class="fete-btn fete-btn-main" data-act="stand">Stand up${mobile ? "" : " <kbd>Esc</kbd>"}</button>`;
      },

      /* ------------------------------------------------------------ carte du jeu : attente, spectateur, résultats */
      /**
       * model : { kind: "lobby" | "watch" | "results", icon, title, blurb, help, players: [{ name, color, self, state }],
       *   options: [{ key, label, values: [{ value, text, on }] }], canStart, wait (texte), rows: [{ pos, name, color, text, self }] }
       */
      card(model) {
        if (!model) {
          card.hidden = true;
          cardSig = "";
          return;
        }
        const sig = JSON.stringify(model);
        if (sig === cardSig) return;
        cardSig = sig;
        card.hidden = false;
        card.dataset.kind = model.kind;
        let body = "";
        if (model.kind === "results") {
          body =
            `<ol class="fete-ranking">` +
            model.rows
              .map((r) => `<li class="${r.self ? "is-self" : ""}"><span class="fete-pos">${r.pos === 1 ? "🏆" : r.pos}</span>${dot(r.color)}<b>${esc(r.name)}</b><em>${esc(r.text)}</em></li>`)
              .join("") +
            `</ol><div class="fete-row"><button type="button" class="fete-btn fete-btn-main" data-act="replay">Play again</button><button type="button" class="fete-btn" data-act="leave">Quit</button></div>`;
        } else {
          const list = model.players.map((p) => `<li>${dot(p.color)}<b>${esc(p.name)}${p.self ? " <span>(you)</span>" : ""}</b><small>${STATE_TEXT[p.state] || ""}</small></li>`).join("");
          body = `<ul class="fete-players">${list}</ul>`;
          if (model.kind === "lobby") {
            for (const o of model.options || [])
              body +=
                `<div class="fete-option"><span>${esc(o.label)}</span><div class="fete-seg">` +
                o.values.map((v) => `<button type="button" data-act="option" data-key="${esc(o.key)}" data-value="${esc(JSON.stringify(v.value))}" aria-pressed="${!!v.on}">${esc(v.text)}</button>`).join("") +
                `</div></div>`;
            if (model.help) body += `<p class="fete-note">${esc(model.help)}</p>`;
            body += `<div class="fete-row"><button type="button" class="fete-btn fete-btn-main fete-btn-go" data-act="start"${model.canStart ? "" : " disabled"}>${esc(model.startText || "Start the game")}</button><button type="button" class="fete-btn" data-act="leave">Quit</button></div>`;
            if (model.wait) body += `<p class="fete-note">${esc(model.wait)}</p>`;
          } else {
            body += `<p class="fete-note">${esc(model.wait || "Game in progress: you'll play the next one.")}</p><div class="fete-row"><button type="button" class="fete-btn" data-act="leave">Quit</button></div>`;
          }
        }
        if (model.sponsor) {
          const sp = model.sponsor, inner = `${sp.image ? `<i style="background-image:url(${esc(sp.image)})"></i>` : ""}<span>Presented by <b>${esc(sp.name)}</b>${sp.tagline ? " · " + esc(sp.tagline) : ""}</span>`;
          body += sp.url ? `<a class="fete-sponsor-line" href="${esc(sp.url)}" target="_blank" rel="noopener sponsored" style="background:${esc(sp.bg)};color:${esc(sp.fg)}">${inner}</a>` : `<p class="fete-sponsor-line" style="background:${esc(sp.bg)};color:${esc(sp.fg)}">${inner}</p>`;
        }
        card.innerHTML = `<header><span class="fete-game-icon" aria-hidden="true">${model.icon}</span><div><h2>${esc(model.title)}</h2><small>${esc(model.kind === "results" ? "Results" : model.blurb || "")}</small></div></header>${body}`;
      },
      /** Décompte du départ : 3, 2, 1, « Partez ! » (null pour l'effacer). */
      countdown(text) {
        const t = text == null ? "" : String(text);
        if (count.textContent === t) return;
        if (t) flash.classList.remove("is-on"); // un nouveau départ efface le message de la manche d'avant
        count.textContent = t;
        count.classList.remove("is-pop");
        void count.offsetWidth;
        if (t) count.classList.add("is-pop");
      },

      /* ------------------------------------------------------------ pour les jeux */
      stats(defs) {
        stats.innerHTML = "";
        statEls.clear();
        for (const d of defs || []) {
          const box = el("div", "fete-stat", stats, `<small>${esc(d.label)}</small><b>–</b>`);
          statEls.set(d.key, box.querySelector("b"));
        }
      },
      set(key, text) {
        const e = statEls.get(key);
        if (e && e.textContent !== String(text)) e.textContent = text;
      },
      flash(text, o = {}) {
        flash.textContent = text;
        flash.style.setProperty("--c", o.color || "");
        flash.classList.remove("is-on");
        void flash.offsetWidth;
        flash.classList.add("is-on");
        clearTimeout(flashTimer);
        flashTimer = setTimeout(() => flash.classList.remove("is-on"), (o.hold || 1.6) * 1000);
      },
      hint(text) {
        if (hint.textContent !== (text || "")) hint.textContent = text || "";
      },
      board(rows) {
        const html = (rows || []).map((r, i) => `<li class="${r.self ? "is-self" : ""}"><span class="fete-pos">${r.pos || i + 1}</span>${dot(r.color)}<b>${esc(r.name)}</b><em>${esc(r.text ?? "")}</em></li>`).join("");
        if (board._html !== html) board.innerHTML = board._html = html;
      },
      widget(cls, html) {
        return el("div", cls, custom, html);
      },
      /** Petit texte qui s'envole depuis un point de l'écran (px) : « +25 », « Raté »… options { color }. */
      pop(text, x, y, o = {}) {
        const p = el("div", "fete-pop", custom);
        p.textContent = text;
        p.style.left = x + "px";
        p.style.top = y + "px";
        if (o.color) p.style.color = o.color;
        setTimeout(() => p.remove(), 900);
      },
      /** Jauge en bas de l'écran (0 à 1), avec un libellé ; null pour la cacher. */
      gauge(value, label) {
        let g = custom.querySelector(".fete-gauge");
        if (value == null) {
          if (g) g.remove();
          return;
        }
        if (!g) g = el("div", "fete-gauge", custom, "<span></span><i></i>");
        g.firstChild.textContent = label || "";
        g.lastChild.style.width = Math.round(MF.clamp(value, 0, 1) * 100) + "%";
        g.dataset.level = value > 0.85 ? "max" : value > 0.5 ? "haut" : "bas";
      },
      /** Remet la couche de jeu à zéro (en quittant un jeu). */
      clearGame() {
        hud.stats([]);
        hud.board([]);
        hud.hint("");
        hud.countdown(null);
        hud.card(null);
        hud.top10(null);
        flash.classList.remove("is-on");
        custom.innerHTML = "";
      },
      /** Petit message ; options { hold (s), action: { label, run } }. */
      toast(text, o = {}) {
        const t = el("div", "fete-toast", toasts, `<span>${esc(text)}</span>`);
        if (o.action) {
          const b = el("button", "fete-btn fete-btn-main", t, esc(o.action.label));
          b.type = "button";
          b.addEventListener("click", () => {
            t.remove();
            o.action.run();
          });
        }
        while (toasts.children.length > 3) toasts.firstChild.remove();
        setTimeout(() => t.classList.add("is-out"), (o.hold || 4) * 1000);
        setTimeout(() => t.remove(), (o.hold || 4) * 1000 + 400);
      },
      /** Première visite : pseudo et couleur. done({ name, color }) à la validation. */
      welcome(profile, done) {
        const w = el(
          "div",
          "fete-welcome",
          root,
          `<form class="fete-card">
            <div class="fete-welcome-icon" aria-hidden="true">🎪</div>
            <h2>Welcome to the Dream Mill Fest</h2>
            <p class="fete-note">A fairground for makers in the 3D garden of an old French watermill: 35 games, a Ferris wheel, a hot-air balloon, a campfire, and places to sit and work by the water. Everyone who opens this page at the same time meets here.</p>
            <label class="fete-label" for="fete-pseudo">Your nickname</label>
            <input id="fete-pseudo" type="text" class="fete-input" maxlength="18" value="${esc(profile.name)}" autocomplete="off" spellcheck="false">
            <div class="fete-swatches">${MF.PLAYER_COLORS.map((c) => `<button type="button" data-pick="${c}" style="--c:${c}" aria-pressed="${c === profile.color}" aria-label="Color"></button>`).join("")}</div>
            <label class="fete-label">Pick your laptop <small>you carry it on your back, like a backpack</small></label>
            ${laptopPicker(profile.kit, "data-laptop")}
            <label class="fete-label" for="fete-projet">What are you building? <small>optional</small></label>
            <input id="fete-projet" type="text" class="fete-input" maxlength="40" value="${esc(profile.bio || "")}" placeholder="my SaaS, a newsletter, nothing yet…" autocomplete="off" spellcheck="false">
            <button type="submit" class="fete-btn fete-btn-main fete-btn-go">Enter the fair</button>
          </form>`,
        );
        fillThumbs(w);
        let color = profile.color, kit = profile.kit;
        w.addEventListener("click", (ev) => {
          const b = ev.target.closest("[data-pick],[data-laptop]");
          if (!b) return;
          ev.stopPropagation();
          const attr = b.hasAttribute("data-pick") ? "data-pick" : "data-laptop";
          if (attr === "data-pick") color = b.dataset.pick;
          else kit = b.dataset.laptop;
          for (const o of w.querySelectorAll("[" + attr + "]")) o.setAttribute("aria-pressed", String(o === b));
        });
        w.querySelector("form").addEventListener("submit", (ev) => {
          ev.preventDefault();
          const name = w.querySelector("#fete-pseudo").value.trim() || profile.name;
          const bio = w.querySelector("#fete-projet").value.trim();
          w.remove();
          done({ name, color, kit, bio });
        });
        return w;
      },
    };
    return hud;
  }

  MF.Hud = { create, esc };
})();
