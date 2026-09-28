// Moulin V32 — heure du jour, soleil, lune et lumière.
//
// Le soleil et la lune sont placés d'après la date, l'heure et le lieu du moulin
// (formules astronomiques simplifiées, précises à quelques dixièmes de degré).
// Le nord est vers -z, l'est vers +x (comme la petite carte du jeu).
// La couleur de la lumière, l'ambiance, le brouillard et le ciel suivent la hauteur
// du soleil : aube rosée, midi blanc chaud, heure dorée, crépuscule bleu, nuit étoilée.
(function () {
  "use strict";
  const V32 = globalThis.MoulinV32;
  const THREE = globalThis.THREE;
  const { clamp, smoothstep, lerp } = V32;
  const rad = Math.PI / 180;
  const obliquity = rad * 23.4397;

  // --- Astronomie (d'après les formules publiques de suncalc, V. Agafonkin, BSD) ---
  const toDays = (ms) => ms / 86400000 - 0.5 + 2440588 - 2451545;
  const rightAscension = (l, b) =>
    Math.atan2(Math.sin(l) * Math.cos(obliquity) - Math.tan(b) * Math.sin(obliquity), Math.cos(l));
  const declination = (l, b) =>
    Math.asin(Math.sin(b) * Math.cos(obliquity) + Math.cos(b) * Math.sin(obliquity) * Math.sin(l));
  const azimuthFromSouth = (H, phi, dec) => Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi));
  const altitude = (H, phi, dec) =>
    Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
  const siderealTime = (d, lw) => rad * (280.16 + 360.9856235 * d) - lw;
  function sunCoords(d) {
    const M = rad * (357.5291 + 0.98560028 * d);
    const C = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
    const L = M + C + rad * 102.9372 + Math.PI;
    return { dec: declination(L, 0), ra: rightAscension(L, 0) };
  }
  function moonCoords(d) {
    const L = rad * (218.316 + 13.176396 * d);
    const M = rad * (134.963 + 13.064993 * d);
    const F = rad * (93.272 + 13.22935 * d);
    const l = L + rad * 6.289 * Math.sin(M);
    const b = rad * 5.128 * Math.sin(F);
    return { ra: rightAscension(l, b), dec: declination(l, b), dist: 385001 - 20905 * Math.cos(M) };
  }
  function horizontal(coords, d, lat, lon) {
    const H = siderealTime(d, rad * -lon) - coords.ra;
    const phi = rad * lat;
    return { altitude: altitude(H, phi, coords.dec), azimuth: azimuthFromSouth(H, phi, coords.dec) };
  }
  /** Direction monde (vers l'astre) : x = est, y = haut, z = sud. */
  function toDirection(position, target) {
    const c = Math.cos(position.altitude);
    return target.set(-Math.sin(position.azimuth) * c, Math.sin(position.altitude), Math.cos(position.azimuth) * c);
  }

  V32.astro = {
    sun(ms, lat, lon) {
      return horizontal(sunCoords(toDays(ms)), toDays(ms), lat, lon);
    },
    moon(ms, lat, lon) {
      const d = toDays(ms);
      return horizontal(moonCoords(d), d, lat, lon);
    },
    /** Fraction éclairée (0 nouvelle lune → 1 pleine lune) et phase (0 → 1). */
    moonIllumination(ms) {
      const d = toDays(ms);
      const s = sunCoords(d);
      const m = moonCoords(d);
      const sdist = 149598000;
      const phi = Math.acos(Math.sin(s.dec) * Math.sin(m.dec) + Math.cos(s.dec) * Math.cos(m.dec) * Math.cos(s.ra - m.ra));
      const inc = Math.atan2(sdist * Math.sin(phi), m.dist - sdist * Math.cos(phi));
      const angle = Math.atan2(
        Math.cos(s.dec) * Math.sin(s.ra - m.ra),
        Math.sin(s.dec) * Math.cos(m.dec) - Math.cos(s.dec) * Math.sin(m.dec) * Math.cos(s.ra - m.ra),
      );
      return { fraction: (1 + Math.cos(inc)) / 2, phase: 0.5 + (0.5 * inc * (angle < 0 ? -1 : 1)) / Math.PI };
    },
    toDirection,
  };

  // --- Lieu du moulin et horloge de la scène ---
  // Tant que le lieu n'est pas choisi dans l'onglet Météo, on prend le centre de la
  // France : l'heure du lever et du coucher y reste juste à quelques minutes près.
  const DEFAULT_LOCATION = { latitude: 46.6, longitude: 2.45, name: "", admin: "", country: "FR", timezone: "Europe/Paris", fallback: true };
  const locationListeners = [];
  V32.location = Object.assign({}, DEFAULT_LOCATION, V32.store.get("location", null) || {});
  V32.setLocation = function (location) {
    V32.location = Object.assign({}, DEFAULT_LOCATION, location, { fallback: !location });
    if (location) V32.store.set("location", V32.location);
    for (const listener of locationListeners) listener(V32.location);
  };
  V32.onLocation = (listener) => locationListeners.push(listener);

  // Mode de l'heure : "live" suit l'horloge, "manual" laisse le choix Jour / Nuit de la V31.
  V32.clock = {
    mode: V32.store.get("time-mode", "live"),
    preview: null, // horodatage prévisualisé depuis l'onglet Météo (null = maintenant)
    now() {
      return this.preview ?? Date.now();
    },
  };

  // Réglages fins de la lumière (ajustés d'après des captures comparées).
  V32.tuning = Object.assign({ sun: 1.38, ambient: 0.62, exposure: 0.95, ground: 0.84 }, V32.tuning || {});

  V32.register(
    "atmosphere",
    function (context) {
      const { game, hooks } = context;
      const { sun, hemi, fill, root } = hooks;
      const renderer = game.renderer;
      const scene = game.scene;
      const weather = game.weather;
      const night = game.night22;
      const uniforms = V32.uniforms;
      const state = {
        sun: { altitude: 0.83, azimuth: 0.81 },
        moon: { altitude: -1, azimuth: 0 },
        sunDirection: new THREE.Vector3(-65, 98, 62).normalize(),
        moonDirection: new THREE.Vector3(0.3, 0.7, -0.4).normalize(),
        daylight: 1,
        golden: 0,
        twilight: 0,
        lastSolar: -Infinity,
        lastApplied: "",
        nightDriven: false,
        illumination: { fraction: 0.5, phase: 0.5 },
      };
      const fixedDay = new THREE.Vector3(-65, 98, 62).normalize();
      const offset = new THREE.Vector3();
      const tmpColor = new THREE.Color();
      const weatherFog = new THREE.Color();
      const colors = {
        sunLow: new THREE.Color(1.0, 0.43, 0.2),
        sunGolden: new THREE.Color(1.0, 0.7, 0.45),
        sunDay: new THREE.Color(1.0, 0.93, 0.84),
        sunOvercast: new THREE.Color(0.86, 0.9, 0.96),
        skyDay: new THREE.Color(0xc2dbf7),
        skyGolden: new THREE.Color(0xe9c7ae),
        skyDusk: new THREE.Color(0x6a78ad),
        groundDay: new THREE.Color(0x8d9a6a),
        groundGolden: new THREE.Color(0x8b7657),
        groundDusk: new THREE.Color(0x3c4456),
        fogGolden: new THREE.Color(0.93, 0.66, 0.46),
        fogDusk: new THREE.Color(0.09, 0.12, 0.22),
      };
      V32.sun = state;

      // Menu « Ambiance » : on ajoute « Heure réelle » en tête.
      const select = root.querySelector("[data-night-mode22]");
      if (select && !select.querySelector("option[value=live]")) {
        const option = document.createElement("option");
        option.value = "live";
        option.textContent = "Heure réelle";
        select.prepend(option);
      }
      function syncSelect() {
        if (!select) return;
        select.value = V32.clock.mode === "live" ? "live" : night?.getState().mode || "day";
      }
      select?.addEventListener("change", () => {
        V32.clock.mode = select.value === "live" ? "live" : "manual";
        V32.store.set("time-mode", V32.clock.mode);
        if (V32.clock.mode !== "live") uniforms.sunTrue.value.copy(fixedDay);
        state.lastSolar = -Infinity;
        state.nightDriven = false;
        if (V32.clock.mode === "live") update(0, 0, performance.now(), true);
        hooks.invalidate();
      });
      syncSelect();

      function nightMode() {
        return night?.getState().mode || "day";
      }

      function solar(force) {
        const now = V32.clock.now();
        if (!force && Math.abs(now - state.lastSolar) < 15000) return false;
        state.lastSolar = now;
        const { latitude, longitude } = V32.location;
        state.sun = V32.astro.sun(now, latitude, longitude);
        state.moon = V32.astro.moon(now, latitude, longitude);
        state.illumination = V32.astro.moonIllumination(now);
        toDirection(state.sun, state.sunDirection);
        toDirection(state.moon, state.moonDirection);
        uniforms.sunTrue.value.copy(state.sunDirection);
        uniforms.moonDirection.value.copy(state.moonDirection);
        uniforms.moonLight.value.set(state.illumination.fraction, state.illumination.phase);
        return true;
      }

      function placeLight(direction) {
        const previous = V32.sunOffset;
        offset.copy(direction).multiplyScalar(133);
        // Ombres trop rasantes : on garde un minimum de hauteur pour la caméra d'ombre.
        if (offset.y < 9) offset.y = 9;
        if (previous && previous.distanceToSquared(offset) < 0.04) return false;
        V32.sunOffset = (previous || new THREE.Vector3()).copy(offset);
        V32.sunVersion = (V32.sunVersion || 0) + 1;
        hooks.syncSun();
        hooks.refreshShadows();
        return true;
      }

      function update(dt, time, now, force = false) {
        let dirty = false;
        const live = V32.clock.mode === "live";
        const preview = V32.clock.preview !== null;
        if (live || preview) dirty = solar(force || preview) || dirty;
        const sinSun = live || preview ? Math.sin(state.sun.altitude) : fixedDay.y;
        const altDeg = Math.asin(clamp(sinSun, -1, 1)) / rad;

        // Jour et nuit : en heure réelle, on bascule le mode nuit de la V31 (lampes,
        // fenêtres éclairées, étoiles) au crépuscule civil, avec une petite marge.
        if (live || preview) {
          const mode = nightMode();
          if (mode === "day" && altDeg < -4.5) {
            night?.setMode("stars", false);
            state.nightDriven = true;
            dirty = true;
          } else if (mode !== "day" && altDeg > -3.5) {
            night?.setMode("day", false);
            state.nightDriven = true;
            dirty = true;
          }
          syncSelect();
        }

        const isNight = nightMode() !== "day";
        const daylight = smoothstep(-7, 6, altDeg);
        const golden = live || preview ? smoothstep(-3, 3, altDeg) * (1 - smoothstep(6, 26, altDeg)) : 0;
        const twilight = (1 - smoothstep(-1, 5, altDeg)) * smoothstep(-9, -2, altDeg);
        state.daylight = daylight;
        state.golden = golden;
        state.twilight = twilight;
        uniforms.daylight.value = isNight ? 0 : daylight;
        uniforms.golden.value = golden;

        // Direction de la lumière principale : soleil le jour, lune la nuit.
        const direction = live || preview ? (isNight ? state.moonDirection : state.sunDirection) : fixedDay;
        if (direction.y > -0.2) dirty = placeLight(direction.y < 0.06 ? tmpDirection(direction) : direction) || dirty;
        uniforms.sunDirection.value.copy(direction.y < 0.02 ? tmpDirection(direction) : direction);

        const mode = weather?.mode || "sun";
        const preset = weather?.modes?.[mode] || { light: 2.1, ambient: 0.7, sky: "#abc6d6" };
        const cover = weather?.uniforms?.cover?.value ?? 0.3;
        const key = [mode, isNight, altDeg.toFixed(1), cover.toFixed(2)].join("|");
        if (key === state.lastApplied && !force) return dirty;
        state.lastApplied = key;

        if (!isNight) {
          // Couleur du soleil : orangé à l'horizon, doré, puis blanc chaud.
          tmpColor.copy(colors.sunLow).lerp(colors.sunGolden, smoothstep(0, 9, altDeg));
          tmpColor.lerp(colors.sunDay, smoothstep(10, 34, altDeg));
          tmpColor.lerp(colors.sunOvercast, smoothstep(0.45, 1, cover) * 0.8);
          sun.color.copy(tmpColor);
          uniforms.sunColor.value.copy(tmpColor);
          const strength = smoothstep(-1, 10, altDeg) * (0.62 + 0.38 * smoothstep(6, 38, altDeg));
          const tuning = V32.tuning;
          sun.intensity = preset.light * tuning.sun * strength;
          hemi.intensity = preset.ambient * tuning.ambient * (0.16 + 0.84 * smoothstep(-8, 16, altDeg));
          hemi.color.copy(colors.skyDay).lerp(colors.skyGolden, golden * 0.8).lerp(colors.skyDusk, twilight);
          hemi.groundColor.copy(colors.groundDay).lerp(colors.groundGolden, golden * 0.7).lerp(colors.groundDusk, twilight);
          fill.intensity = (mode === "rain" ? 0.18 : 0.17) * (0.3 + 0.7 * daylight);
          renderer.toneMappingExposure = (mode === "snow" ? 0.92 : 1) * tuning.exposure * (1 + twilight * 0.18 + golden * 0.04);
          hemi.groundColor.multiplyScalar(tuning.ground);
          // Brouillard et fond : couleur du ciel de la météo, réchauffée à l'heure dorée.
          weatherFog.set(preset.sky).convertSRGBToLinear();
          tmpColor.copy(weatherFog).lerp(colors.fogGolden, golden * 0.38 * (1 - cover * 0.6)).lerp(colors.fogDusk, twilight * 0.85);
          tmpColor.multiplyScalar(0.3 + 0.7 * daylight);
          if (hooks.getMode() !== "globe") {
            if (scene.fog) scene.fog.color.copy(tmpColor);
            weather?.uniforms?.fogColor?.value.copy(tmpColor);
            if (scene.background?.isColor) scene.background.copy(tmpColor);
          }
          if (hooks.waterDaylight) hooks.waterDaylight.value = 0.12 + 0.88 * daylight;
          if (weather?.uniforms?.night) weather.uniforms.night.value = 1 - smoothstep(-8, -1, altDeg);
        } else {
          uniforms.sunColor.value.setRGB(0.55, 0.66, 0.85);
          // La nuit, la lune éclaire un peu plus quand elle est pleine et haute.
          if (live || preview) {
            const moonUp = smoothstep(-2, 12, state.moon.altitude / rad);
            const full = 0.35 + 0.65 * state.illumination.fraction;
            sun.intensity = (nightMode() === "black" ? 0.02 : 0.05) + 0.1 * moonUp * full * (1 - cover * 0.7);
          }
        }
        return true;
      }

      // Soleil sous l'horizon : on garde une direction légèrement au-dessus pour
      // que les calculs d'ombre et de reflets restent stables.
      const lifted = new THREE.Vector3();
      function tmpDirection(direction) {
        lifted.copy(direction);
        lifted.y = Math.max(lifted.y, 0.06);
        return lifted.normalize();
      }

      if (V32.clock.mode !== "live") uniforms.sunTrue.value.copy(fixedDay);
      solar(V32.clock.mode === "live");
      if (V32.clock.mode !== "live") uniforms.sunTrue.value.copy(fixedDay);
      update(0, 0, performance.now(), true);
      return {
        update,
        state,
        refresh() {
          state.lastSolar = -Infinity;
          state.lastApplied = "";
          update(0, 0, performance.now(), true);
        },
      };
    },
    10,
  );
})();
