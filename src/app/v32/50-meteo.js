// Moulin V32 — onglet Météo : la boule à neige du moulin et la météo réelle.
//
// L'ancien mode « Boule de neige » devient « Météo ». La boule montre le jardin sous
// le temps qu'il fait au moulin, à l'heure qu'il est : soleil ou lune à leur vraie
// place, nuages, pluie, neige, brouillard, orage. Le curseur du bas fait défiler les
// prochaines heures (ou les rejoue en accéléré) : la boule suit l'heure et la prévision.
(function () {
  "use strict";
  const V32 = globalThis.MoulinV32;
  const THREE = globalThis.THREE;
  const { clamp } = V32;
  const icon = (name, size) => V32.lineIcon(name, size);

  const MOON_PHASES = [
    [0.03, "Nouvelle lune"],
    [0.22, "Premier croissant"],
    [0.28, "Premier quartier"],
    [0.47, "Gibbeuse croissante"],
    [0.53, "Pleine lune"],
    [0.72, "Gibbeuse décroissante"],
    [0.78, "Dernier quartier"],
    [0.97, "Dernier croissant"],
    [1.01, "Nouvelle lune"],
  ];
  function moonName(phase) {
    for (const [limit, name] of MOON_PHASES) if (phase < limit) return name;
    return "Nouvelle lune";
  }

  V32.register(
    "meteo",
    function (context) {
      const { game, hooks } = context;
      const root = hooks.root;
      const mount = hooks.mount;
      const camera = game.camera;
      const live = V32.weatherLive;
      if (!live) return null;

      // --- Shaders préparés d'avance ------------------------------------------------
      // Six secondes après le chargement, la boule (construite cachée), la lampe tenue en main
      // et les faisceaux sont compilés en une fois : ni la première entrée dans l'onglet Météo
      // ni le premier allumage de la lampe ne marquent ensuite d'à-coup.
      const prewarmAt = performance.now() + 6000;
      let prewarmed = false;
      function prewarm() {
        try {
          const globe = hooks.globe();
          if (globe && globe.prepare) globe.prepare();
          const player = typeof game.player === "function" ? game.player() : game.player;
          if (player && player.avatar && player.avatar.holdTorch32) player.avatar.holdTorch32();
          // Les retouches de la météo (pluie, neige) et de la nuit s'appliquent d'abord aux
          // matières créées depuis le démarrage, puis la découpe de la boule, puis on compile.
          const weather = typeof game.weather === "function" ? game.weather() : game.weather;
          if (weather && weather.decorate) weather.decorate();
          if (game.night22 && game.night22.refreshMaterials) game.night22.refreshMaterials();
          game.scene.onBeforeRender(game.renderer, game.scene, game.camera, null);
          game.renderer.compile(game.scene, game.camera);
          hooks.markDirty();
        } catch (error) {
          console.warn("[Moulin V32] préparation des shaders", error);
        }
      }

      // --- L'onglet : « Boule de neige » devient « Météo » -------------------------
      const tab = root.querySelector('.mode-switch [data-mode="globe"]');
      if (tab) {
        tab.setAttribute("aria-label", "Météo et boule à neige du moulin");
        tab.setAttribute("title", "Météo au moulin");
        const iconBox = tab.querySelector(".game22-mode-icon");
        if (iconBox) iconBox.innerHTML = icon("meteo", 24);
        tab.querySelectorAll(".globe26-long, .globe26-short").forEach((span) => (span.textContent = "Météo"));
      }

      // --- Panneau ---------------------------------------------------------------
      const panel = document.createElement("section");
      panel.className = "v32-meteo";
      panel.hidden = true;
      panel.setAttribute("aria-label", "Météo au moulin");
      panel.dataset.sheet = "peek";
      panel.innerHTML = `
        <header class="v32-meteo-head">
          <button type="button" class="v32-place" data-v32-place>${icon("pin", 18)}<span data-v32-place-name>Lieu du moulin</span>${icon("chevron", 16)}</button>
          <button type="button" class="v32-icon-btn" data-v32-refresh aria-label="Actualiser la météo" title="Actualiser">${icon("refresh", 18)}</button>
          <button type="button" class="v32-icon-btn v32-sheet-toggle" data-v32-sheet aria-label="Afficher tout le détail" aria-expanded="false">${icon("chevron", 18)}</button>
          <button type="button" class="v32-icon-btn v32-meteo-hide" data-v32-hide aria-label="Masquer la météo (la boule seule)" title="Masquer la météo">${icon("close", 18)}</button>
        </header>
        <div class="v32-now">
          <div class="v32-now-icon" data-v32-now-icon></div>
          <div class="v32-now-temp"><strong data-v32-now-temp>–</strong><span>°C</span></div>
          <div class="v32-now-text">
            <strong data-v32-now-label>Chargement…</strong>
            <span data-v32-now-when>Maintenant</span>
            <span data-v32-now-feels></span>
          </div>
        </div>
        <div class="v32-meteo-scroll">
          <div class="v32-metrics v32-detail" data-v32-metrics></div>
          <h3 class="v32-detail">Heure par heure</h3>
          <div class="v32-hours" data-v32-hours role="list"></div>
          <h3 class="v32-detail">Sept jours</h3>
          <div class="v32-days v32-detail" data-v32-days role="list"></div>
          <p class="v32-meteo-source v32-detail" data-v32-source>Prévisions <a href="https://open-meteo.com" target="_blank" rel="noopener">Open-Meteo</a></p>
        </div>`;
      mount.appendChild(panel);

      const timebar = document.createElement("div");
      timebar.className = "v32-timebar";
      timebar.hidden = true;
      timebar.innerHTML = `
        <button type="button" class="v32-round" data-v32-play aria-pressed="false" aria-label="Faire défiler les heures" title="Faire défiler les heures">${icon("play", 20)}</button>
        <label class="v32-time">
          <span class="v32-time-label" data-v32-time-label>Maintenant</span>
          <input type="range" min="0" max="72" step="0.25" value="0" data-v32-time aria-label="Heure affichée dans la boule">
          <span class="v32-time-ticks" data-v32-ticks aria-hidden="true"></span>
        </label>
        <button type="button" class="v32-pill" data-v32-now disabled>Maintenant</button>
        <button type="button" class="v32-round" data-v32-rotate aria-pressed="true" aria-label="Faire tourner la boule" title="Faire tourner la boule">${icon("rotate", 20)}</button>`;
      mount.appendChild(timebar);

      // Téléphone : la boule seule par défaut ; cette pastille (temps, température) déplie la
      // météo et la frise des heures.
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "v32-meteo-chip";
      chip.hidden = true;
      chip.setAttribute("aria-label", "Afficher la météo");
      chip.innerHTML = `<span class="v32-meteo-chip-icon" data-v32-chip-icon></span><strong data-v32-chip-temp>–</strong><span class="v32-meteo-chip-label" data-v32-chip-label>Météo</span>${icon("chevron", 16)}`;
      mount.appendChild(chip);

      const picker = document.createElement("div");
      picker.className = "v32-picker";
      picker.hidden = true;
      picker.setAttribute("role", "dialog");
      picker.setAttribute("aria-modal", "true");
      picker.setAttribute("aria-label", "Lieu du moulin");
      picker.innerHTML = `
        <div class="v32-picker-card">
          <header><strong>Où se trouve le moulin ?</strong><button type="button" class="v32-icon-btn" data-v32-picker-close aria-label="Fermer">${icon("close", 18)}</button></header>
          <p>La météo, l’heure du lever et du coucher du soleil et la course de la lune suivent ce lieu.</p>
          <label class="v32-search">${icon("search", 18)}<input type="search" data-v32-search value="" placeholder="Rechercher une commune" autocomplete="off" aria-label="Commune du moulin"></label>
          <button type="button" class="v32-pill v32-geo" data-v32-geo>${icon("locate", 18)}<span>Utiliser ma position actuelle</span></button>
          <ul class="v32-results" data-v32-results></ul>
          <p class="v32-picker-note" data-v32-picker-note></p>
        </div>`;
      mount.appendChild(picker);

      const $ = (selector, scope = panel) => scope.querySelector(selector);
      const slider = $("[data-v32-time]", timebar);
      const playButton = $("[data-v32-play]", timebar);
      const nowButton = $("[data-v32-now]", timebar);
      const rotateButton = $("[data-v32-rotate]", timebar);

      let active = false;
      let playing = false;
      let offsetHours = 0;
      let lastRender = "";
      let askedForPlace = false;
      let sheetOpen = false;
      let collapsed = false;
      let viewOffset = { x: 0, y: 0 };
      const phone = () => typeof matchMedia === "function" && matchMedia("(pointer: coarse), (max-width: 700px)").matches;

      function timeZone() {
        return live.state.data?.timezone || V32.location.timezone || undefined;
      }
      function format(ms, options) {
        try {
          return new Intl.DateTimeFormat("fr-FR", { timeZone: timeZone(), ...options }).format(ms);
        } catch {
          return new Intl.DateTimeFormat("fr-FR", options).format(ms);
        }
      }
      function dayKey(ms) {
        return format(ms, { year: "numeric", month: "2-digit", day: "2-digit" });
      }
      function whenLabel(ms) {
        if (Math.abs(ms - Date.now()) < 20 * 60 * 1000) return "Maintenant";
        const today = dayKey(Date.now());
        const tomorrow = dayKey(Date.now() + 86400000);
        const key = dayKey(ms);
        const day = key === today ? "Aujourd’hui" : key === tomorrow ? "Demain" : format(ms, { weekday: "long" });
        return day.charAt(0).toUpperCase() + day.slice(1) + " à " + format(ms, { hour: "2-digit", minute: "2-digit" });
      }
      const round = (value, digits = 0) => (Number.isFinite(value) ? Number(value).toFixed(digits).replace(".", ",") : "–");

      // --- Rendu du panneau ----------------------------------------------------------
      function renderPlace() {
        const place = V32.location;
        $("[data-v32-place-name]").textContent = place.fallback
          ? "Choisir le lieu du moulin"
          : place.name + (place.admin ? " · " + place.admin.split(",")[0] : "");
      }

      function metric(iconName, label, value, extra = "") {
        return `<div class="v32-metric">${icon(iconName, 18)}<span>${label}</span><strong>${value}</strong>${extra ? `<small>${extra}</small>` : ""}</div>`;
      }

      function render(force = false) {
        const ms = V32.clock.now();
        $("[data-v32-now-when]").textContent = whenLabel(ms);
        const c = live.conditionsAt(ms);
        const state = live.state;
        // Le détail ne change qu'à l'heure : on ne reconstruit la liste qu'à ce moment-là.
        const key = [Math.floor(ms / 3600000), Math.floor(Date.now() / 600000), state.fetchedAt, state.status, V32.location.latitude, offsetHours < 0.05].join("|");
        if (!force && key === lastRender) return;
        lastRender = key;
        renderPlace();
        if (!c) {
          $("[data-v32-now-icon]").innerHTML = V32.weatherIcon("partly", true);
          $("[data-v32-now-temp]").textContent = "–";
          $("[data-v32-chip-icon]", chip).innerHTML = V32.weatherIcon("partly", true);
          $("[data-v32-chip-temp]", chip).textContent = "–";
          $("[data-v32-chip-label]", chip).textContent = "Météo";
          $("[data-v32-now-label]").textContent =
            state.status === "error" ? "Météo indisponible" : state.status === "loading" ? "Chargement de la météo…" : "Météo en attente";
          $("[data-v32-now-feels]").textContent = state.error || "";
          $("[data-v32-metrics]").innerHTML = "";
          $("[data-v32-hours]").innerHTML = "";
          $("[data-v32-days]").innerHTML = "";
          return;
        }
        const sunUp = Math.sin(V32.astro.sun(ms, V32.location.latitude, V32.location.longitude).altitude) > -0.02;
        $("[data-v32-now-icon]").innerHTML = V32.weatherIcon(c.icon, sunUp);
        $("[data-v32-now-temp]").textContent = round(c.temperature);
        $("[data-v32-now-label]").textContent = c.label;
        $("[data-v32-chip-icon]", chip).innerHTML = V32.weatherIcon(c.icon, sunUp);
        $("[data-v32-chip-temp]", chip).textContent = round(c.temperature) + "°";
        $("[data-v32-chip-label]", chip).textContent = c.label;
        $("[data-v32-now-feels]").textContent = "Ressenti " + round(c.apparent) + " °C";

        const data = state.data;
        const dayIndex = data.daily?.time?.findIndex((t, i) => ms / 1000 >= t && ms / 1000 < (data.daily.time[i + 1] ?? Infinity));
        const d = dayIndex >= 0 ? dayIndex : 0;
        const daily = data.daily || {};
        const moon = V32.astro.moonIllumination(ms);
        const arrow = `<i class="v32-arrow" style="--dir:${(c.windFrom + 180) % 360}deg"></i>`;
        $("[data-v32-metrics]").innerHTML = [
          metric("wind", "Vent", round(c.windKmh) + " km/h", arrow + c.windCompass + " · rafales " + round(c.gustKmh)),
          metric("drop", "Pluie", round(c.precipitation, 1) + " mm", Number.isFinite(c.probability) ? c.probability + " % de risque" : ""),
          metric("cloud", "Nuages", round(c.cloudCover) + " %", "humidité " + round(c.humidity) + " %"),
          metric("eye", "Visibilité", Number.isFinite(c.visibility) ? (c.visibility >= 10000 ? "> 10 km" : c.visibility >= 1000 ? round(c.visibility / 1000, 1) + " km" : round(c.visibility) + " m") : "–",
            c.pressure ? round(c.pressure) + " hPa" : ""),
          metric("sunrise", "Soleil", daily.sunrise ? format(daily.sunrise[d] * 1000, { hour: "2-digit", minute: "2-digit" }) : "–",
            daily.sunset ? "coucher " + format(daily.sunset[d] * 1000, { hour: "2-digit", minute: "2-digit" }) : ""),
          metric("moon", "Lune", moonName(moon.phase), Math.round(moon.fraction * 100) + " % éclairée"),
        ].join("");

        // Heure par heure : 30 heures à partir de maintenant.
        const hours = [];
        const h = data.hourly;
        const start = Math.floor(Date.now() / 3600000) * 3600;
        const shown = Date.now() + offsetHours * 3600000;
        let closest = -1;
        let closestGap = Infinity;
        for (let i = 0; i < h.time.length; i++) {
          if (h.time[i] < start) continue;
          const gap = Math.abs(h.time[i] * 1000 - shown);
          if (gap < closestGap) {
            closestGap = gap;
            closest = i;
          }
        }
        for (let i = 0; i < h.time.length && hours.length < 30; i++) {
          if (h.time[i] < start) continue;
          const t = h.time[i] * 1000;
          const info = live.describe(h.weather_code[i]);
          const offset = (t - Date.now()) / 3600000;
          const selected = i === closest;
          hours.push(
            `<button type="button" role="listitem" class="v32-hour${selected ? " is-selected" : ""}" data-offset="${Math.max(0, offset).toFixed(2)}">` +
              `<span>${hours.length === 0 ? "Maint." : format(t, { hour: "numeric" }).replace(/\s*h$/, "") + " h"}</span>${V32.weatherIcon(info.icon, h.is_day?.[i] !== 0)}` +
              `<strong>${round(h.temperature_2m[i])}°</strong><small>${h.precipitation_probability?.[i] >= 10 ? h.precipitation_probability[i] + " %" : "&nbsp;"}</small></button>`,
          );
        }
        $("[data-v32-hours]").innerHTML = hours.join("");

        // Sept jours, avec une barre de température relative.
        const days = [];
        const mins = daily.temperature_2m_min || [];
        const maxs = daily.temperature_2m_max || [];
        const low = Math.min(...mins.filter(Number.isFinite));
        const high = Math.max(...maxs.filter(Number.isFinite));
        const span = Math.max(1, high - low);
        for (let i = 0; i < (daily.time || []).length; i++) {
          const t = daily.time[i] * 1000 + 12 * 3600000;
          const info = live.describe(daily.weather_code[i]);
          const name = i === 0 ? "Aujourd’hui" : i === 1 ? "Demain" : format(t, { weekday: "long" });
          const left = ((mins[i] - low) / span) * 100;
          const width = ((maxs[i] - mins[i]) / span) * 100;
          days.push(
            `<div class="v32-day" role="listitem"><span>${name.charAt(0).toUpperCase() + name.slice(1)}</span>${V32.weatherIcon(info.icon, true)}` +
              `<small>${daily.precipitation_probability_max?.[i] >= 20 ? daily.precipitation_probability_max[i] + " %" : ""}</small>` +
              `<em>${round(mins[i])}°</em><i class="v32-range"><b style="left:${left}%;width:${Math.max(6, width)}%"></b></i><strong>${round(maxs[i])}°</strong></div>`,
          );
        }
        $("[data-v32-days]").innerHTML = days.join("");
        const age = Math.round((Date.now() - state.fetchedAt) / 60000);
        $("[data-v32-source]").innerHTML =
          `Prévisions <a href="https://open-meteo.com" target="_blank" rel="noopener">Open-Meteo</a> · ` +
          (state.status === "stale" || state.status === "cached" ? "données conservées, " : "") +
          (age < 1 ? "à l’instant" : "il y a " + age + " min") +
          (V32.location.fallback ? " · lieu approximatif" : "");
        // Graduations du curseur : un trait par jour à minuit.
        const ticks = [];
        const max = Number(slider.max);
        for (let hour = 1; hour <= max; hour++) {
          const t = Date.now() + hour * 3600000;
          if (format(t, { hour: "2-digit", hourCycle: "h23" }) === "00") ticks.push(`<i style="left:${(hour / max) * 100}%"></i>`);
        }
        $("[data-v32-ticks]", timebar).innerHTML = ticks.join("");
      }

      // --- Temps affiché -------------------------------------------------------------
      function setOffset(hours, { fromSlider = false, quiet = false } = {}) {
        offsetHours = clamp(hours, 0, Number(slider.max));
        if (!fromSlider) slider.value = String(offsetHours);
        V32.clock.preview = offsetHours < 0.05 ? null : Date.now() + offsetHours * 3600000;
        nowButton.disabled = offsetHours < 0.05;
        $("[data-v32-time-label]", timebar).textContent = whenLabel(V32.clock.now());
        if (!quiet) V32.context.systems.atmosphere?.refresh();
        live.apply?.(false);
        render(false);
        hooks.markDirty();
      }
      function setPlaying(value) {
        playing = !!value;
        playButton.setAttribute("aria-pressed", String(playing));
        playButton.innerHTML = icon(playing ? "pause" : "play", 20);
        playButton.setAttribute("aria-label", playing ? "Arrêter le défilement" : "Faire défiler les heures");
      }

      slider.addEventListener("input", () => {
        setPlaying(false);
        setOffset(Number(slider.value), { fromSlider: true, quiet: true });
      });
      slider.addEventListener("change", () => setOffset(Number(slider.value), { fromSlider: true }));
      playButton.addEventListener("click", () => {
        if (!playing && offsetHours >= Number(slider.max) - 0.3) setOffset(0);
        setPlaying(!playing);
      });
      nowButton.addEventListener("click", () => {
        setPlaying(false);
        setOffset(0);
      });
      rotateButton.addEventListener("click", () => {
        const rotating = hooks.globe().setRotating(!game.controls.autoRotate);
        rotateButton.setAttribute("aria-pressed", String(!!rotating));
        hooks.refreshGlobeBar();
      });
      panel.addEventListener("click", (event) => {
        const hour = event.target.closest(".v32-hour");
        if (hour) {
          setPlaying(false);
          setOffset(Number(hour.dataset.offset));
        }
      });
      $("[data-v32-refresh]").addEventListener("click", () => live.refresh(true).then(() => render(true)));
      $("[data-v32-sheet]").addEventListener("click", () => setSheet(!sheetOpen));
      $("[data-v32-hide]").addEventListener("click", () => setCollapsed(true));
      chip.addEventListener("click", () => setCollapsed(false));
      /** Téléphone : replie la météo (la boule seule, revenue à l'heure actuelle) ou la déplie. */
      function setCollapsed(value) {
        collapsed = value;
        if (value) {
          setPlaying(false);
          setOffset(0);
        }
        layoutMeteo();
      }
      function layoutMeteo() {
        const hide = active && collapsed && phone();
        panel.hidden = !active || hide;
        timebar.hidden = !active || hide;
        chip.hidden = !hide;
        root.dataset.meteoCollapsed32 = String(hide);
        requestAnimationFrame(frameGlobe);
      }
      function setSheet(open) {
        sheetOpen = open;
        panel.dataset.sheet = open ? "open" : "peek";
        $("[data-v32-sheet]").setAttribute("aria-expanded", String(open));
        frameGlobe();
      }

      // --- Choix du lieu -----------------------------------------------------------------
      const search = $("[data-v32-search]", picker);
      const results = $("[data-v32-results]", picker);
      const note = $("[data-v32-picker-note]", picker);
      let searchTimer = 0;
      let searchId = 0;
      // Le moulin (Elven) reste toujours proposé en tête de liste.
      const home = V32.defaultLocation;
      const homeItem = `<li><button type="button" data-home><strong>${home.name}</strong><span>${home.admin.split(",")[0]} · ${home.postcode}</span></button></li>`;
      async function runSearch() {
        const query = search.value.trim();
        if (query.length < 2) {
          results.innerHTML = homeItem;
          results.found = [];
          return;
        }
        const id = ++searchId;
        note.textContent = "Recherche…";
        try {
          const found = await live.search(query);
          if (id !== searchId) return;
          note.textContent = found.length ? "" : "Aucune commune trouvée.";
          results.innerHTML = homeItem + found
            .map(
              (place, i) =>
                `<li><button type="button" data-index="${i}"><strong>${place.name}</strong><span>${[place.admin, place.postcode, place.country !== "FR" ? place.country : ""].filter(Boolean).join(" · ")}</span></button></li>`,
            )
            .join("");
          results.found = found;
        } catch (error) {
          if (id === searchId) note.textContent = "Recherche impossible : " + (navigator.onLine === false ? "hors connexion" : error.message);
        }
      }
      search.addEventListener("input", () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(runSearch, 320);
      });
      results.addEventListener("click", (event) => {
        if (event.target.closest("button[data-home]")) return choosePlace(null);
        const button = event.target.closest("button[data-index]");
        if (!button) return;
        const place = results.found?.[Number(button.dataset.index)];
        if (place) choosePlace(place);
      });
      $("[data-v32-geo]", picker).addEventListener("click", () => {
        if (!navigator.geolocation) {
          note.textContent = "La localisation n’est pas disponible dans ce navigateur.";
          return;
        }
        if (!window.isSecureContext) {
          note.textContent = "La position actuelle n’est accessible que sur l’adresse HTTPS du site : cherche la commune ci-dessus.";
          return;
        }
        note.textContent = "Localisation…";
        navigator.geolocation.getCurrentPosition(
          (position) =>
            choosePlace({
              name: "Ma position",
              admin: position.coords.latitude.toFixed(3) + ", " + position.coords.longitude.toFixed(3),
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              country: "",
              timezone: "",
            }),
          (error) => (note.textContent = error.code === 1 ? "Localisation refusée." : "Position introuvable."),
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
        );
      });
      $("[data-v32-picker-close]", picker).addEventListener("click", () => openPicker(false));
      picker.addEventListener("click", (event) => {
        if (event.target === picker) openPicker(false);
      });
      picker.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          openPicker(false);
        }
      });
      function openPicker(open) {
        picker.hidden = !open;
        if (open) {
          note.textContent = "";
          runSearch();
          setTimeout(() => search.focus({ preventScroll: true }), 30);
        }
      }
      function choosePlace(place) {
        V32.setLocation(place);
        openPicker(false);
        lastRender = "";
        render(true);
        live.refresh(true).then(() => render(true));
        V32.context.systems.atmosphere?.refresh();
      }
      $("[data-v32-place]").addEventListener("click", () => openPicker(true));
      V32.openPlacePicker = () => openPicker(true);
      live.onChange(() => active && render(true));

      // --- Cadrage de la boule à côté du panneau ------------------------------------------
      function frameGlobe() {
        if (!active) {
          if (camera.view?.enabled) {
            camera.clearViewOffset();
            hooks.markDirty();
          }
          return;
        }
        const rect = mount.getBoundingClientRect();
        const box = panel.getBoundingClientRect();
        const wide = rect.width >= 860;
        const x = panel.hidden ? 0 : wide ? Math.round(Math.min(box.width + 24, rect.width * 0.42) / 2) : 0;
        const y = panel.hidden || wide ? 0 : -Math.round(Math.max(0, rect.bottom - box.top - 70) / 2);
        if (x === viewOffset.x && y === viewOffset.y && camera.view?.enabled) return;
        viewOffset = { x, y };
        camera.setViewOffset(rect.width, rect.height, x, -y, rect.width, rect.height);
        hooks.markDirty();
      }
      window.addEventListener("resize", () => active && layoutMeteo());

      function setActive(value) {
        if (active === value) return;
        active = value;
        // Sur téléphone, l'onglet s'ouvre sur la boule seule.
        collapsed = value && phone();
        layoutMeteo();
        root.dataset.meteo32 = String(value);
        if (value) {
          live.refresh();
          render(true);
          setOffset(0);
          rotateButton.setAttribute("aria-pressed", String(!!game.controls.autoRotate));
          requestAnimationFrame(frameGlobe);
          if (V32.location.fallback && !askedForPlace) {
            askedForPlace = true;
            setTimeout(() => active && openPicker(true), 900);
          }
        } else {
          setPlaying(false);
          offsetHours = 0;
          slider.value = "0";
          V32.clock.preview = null;
          V32.context.systems.atmosphere?.refresh();
          live.apply?.(true);
          openPicker(false);
          viewOffset = { x: 0, y: 0 };
          frameGlobe();
        }
      }

      return {
        update(dt) {
          if (!prewarmed && performance.now() > prewarmAt) {
            prewarmed = true;
            prewarm();
          }
          const globe = hooks.getMode() === "globe";
          if (globe !== active) setActive(globe);
          if (!active) return false;
          let dirty = false;
          if (playing) {
            // Une journée défile en une vingtaine de secondes.
            let next = offsetHours + dt * 1.2;
            if (next >= Number(slider.max)) {
              next = Number(slider.max);
              setPlaying(false);
            }
            setOffset(next, { quiet: true });
            dirty = true;
          } else render();
          if (!camera.view?.enabled) frameGlobe();
          return dirty;
        },
        setActive,
        openPicker,
        render,
      };
    },
    50,
  );
})();
