// Moulin V32 — la météo réelle du moulin.
//
// Source : Open-Meteo (https://open-meteo.com), gratuit, sans clé, accessible
// directement depuis le navigateur. Les prévisions sont gardées en cache local pour
// s'afficher tout de suite et hors connexion. Chaque code météo (WMO) est traduit en
// une ambiance du jardin : couverture nuageuse réelle, intensité de la pluie, brouillard
// d'après la visibilité, vent et rafales, orage, grêle, neige.
(function () {
  "use strict";
  const V32 = globalThis.MoulinV32;
  const { clamp, smoothstep } = V32;

  const API = "https://api.open-meteo.com/v1/forecast";
  const GEOCODING = "https://geocoding-api.open-meteo.com/v1/search";
  const REFRESH_MS = 15 * 60 * 1000;

  // code WMO → [libellé, pictogramme, ambiance du jardin]
  const WMO = {
    0: ["Ciel dégagé", "clear", "sun"],
    1: ["Plutôt dégagé", "mostly-clear", "sun"],
    2: ["Éclaircies", "partly", "partly"],
    3: ["Couvert", "overcast", "clouds"],
    45: ["Brouillard", "fog", "fog"],
    48: ["Brouillard givrant", "fog", "fog"],
    51: ["Bruine légère", "drizzle", "drizzle"],
    53: ["Bruine", "drizzle", "drizzle"],
    55: ["Bruine épaisse", "drizzle", "drizzle"],
    56: ["Bruine verglaçante", "drizzle", "drizzle"],
    57: ["Bruine verglaçante", "drizzle", "drizzle"],
    61: ["Pluie faible", "rain", "rain"],
    63: ["Pluie", "rain", "rain"],
    65: ["Forte pluie", "heavy-rain", "rain"],
    66: ["Pluie verglaçante", "rain", "rain"],
    67: ["Pluie verglaçante forte", "heavy-rain", "rain"],
    71: ["Neige faible", "snow", "snow"],
    73: ["Neige", "snow", "snow"],
    75: ["Forte neige", "snow", "snow"],
    77: ["Grains de neige", "snow", "snow"],
    80: ["Averses faibles", "showers", "showers"],
    81: ["Averses", "showers", "showers"],
    82: ["Violentes averses", "heavy-rain", "showers"],
    85: ["Averses de neige", "snow", "snow"],
    86: ["Fortes averses de neige", "snow", "snow"],
    95: ["Orage", "storm", "storm"],
    96: ["Orage et grêle", "hail", "hail"],
    99: ["Orage, forte grêle", "hail", "hail"],
  };
  const COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSO", "SO", "OSO", "O", "ONO", "NO", "NNO"];

  function describe(code) {
    const entry = WMO[code] || WMO[Math.floor(code / 10) * 10] || ["Temps variable", "partly", "partly"];
    return { label: entry[0], icon: entry[1], mode: entry[2] };
  }

  /** Vent : km/h → force utilisée par les arbres, l'herbe et l'eau (0 → 1,8). */
  function windStrength(kmh) {
    return clamp(Math.pow(Math.max(0, kmh) / 38, 0.8), 0, 1.8);
  }

  /** Direction d'où vient le vent (degrés, 0 = nord) → angle du souffle dans la scène. */
  function windAngle(fromDegrees) {
    const to = ((fromDegrees + 180) * Math.PI) / 180;
    return Math.atan2(-Math.cos(to), Math.sin(to));
  }

  const state = {
    status: "idle",
    error: "",
    data: null,
    fetchedAt: 0,
    location: null,
    listeners: new Set(),
    timer: 0,
    inflight: null,
  };

  function notify() {
    for (const listener of state.listeners) {
      try {
        listener(state);
      } catch (error) {
        console.error(error);
      }
    }
  }

  function cacheKey(location) {
    return "forecast-" + location.latitude.toFixed(3) + "," + location.longitude.toFixed(3);
  }

  function restoreCache(location) {
    const cached = V32.store.get(cacheKey(location), null);
    if (cached && cached.data && Date.now() - cached.fetchedAt < 36 * 3600 * 1000) {
      state.data = cached.data;
      state.fetchedAt = cached.fetchedAt;
      state.status = "cached";
      return true;
    }
    return false;
  }

  async function fetchForecast(location) {
    const params = new URLSearchParams({
      latitude: location.latitude.toFixed(4),
      longitude: location.longitude.toFixed(4),
      current: [
        "temperature_2m",
        "relative_humidity_2m",
        "apparent_temperature",
        "is_day",
        "precipitation",
        "rain",
        "showers",
        "snowfall",
        "weather_code",
        "cloud_cover",
        "pressure_msl",
        "wind_speed_10m",
        "wind_direction_10m",
        "wind_gusts_10m",
      ].join(","),
      hourly: [
        "temperature_2m",
        "apparent_temperature",
        "relative_humidity_2m",
        "precipitation_probability",
        "precipitation",
        "snowfall",
        "weather_code",
        "cloud_cover",
        "visibility",
        "wind_speed_10m",
        "wind_direction_10m",
        "wind_gusts_10m",
        "is_day",
      ].join(","),
      daily: [
        "weather_code",
        "temperature_2m_max",
        "temperature_2m_min",
        "sunrise",
        "sunset",
        "precipitation_sum",
        "precipitation_probability_max",
        "wind_speed_10m_max",
        "wind_gusts_10m_max",
      ].join(","),
      timezone: "auto",
      forecast_days: "7",
      past_hours: "3",
      timeformat: "unixtime",
      wind_speed_unit: "kmh",
    });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(API + "?" + params, { signal: controller.signal });
      if (!response.ok) throw new Error("Service météo indisponible (" + response.status + ")");
      const data = await response.json();
      if (!data.hourly?.time?.length) throw new Error("Prévisions incomplètes");
      return data;
    } finally {
      clearTimeout(timeout);
    }
  }

  async function refresh(force = false) {
    const location = V32.location;
    if (!force && state.data && state.location === location && Date.now() - state.fetchedAt < REFRESH_MS) return state;
    if (state.inflight) return state.inflight;
    if (state.location !== location) {
      state.location = location;
      state.data = null;
      restoreCache(location);
    }
    state.status = state.data ? state.status : "loading";
    notify();
    state.inflight = fetchForecast(location)
      .then((data) => {
        state.data = data;
        state.fetchedAt = Date.now();
        state.status = "ok";
        state.error = "";
        V32.store.set(cacheKey(location), { fetchedAt: state.fetchedAt, data });
      })
      .catch((error) => {
        state.error = navigator.onLine === false ? "Hors connexion" : error.name === "AbortError" ? "Délai dépassé" : error.message;
        state.status = state.data ? "stale" : "error";
      })
      .finally(() => {
        state.inflight = null;
        notify();
      });
    return state.inflight;
  }

  /** Index horaire le plus proche d'un instant (heures en secondes Unix). */
  function hourIndex(data, ms) {
    const times = data.hourly.time;
    const t = ms / 1000;
    if (t <= times[0]) return 0;
    for (let i = 1; i < times.length; i++) if (times[i] >= t) return t - times[i - 1] < times[i] - t ? i - 1 : i;
    return times.length - 1;
  }

  /** Conditions à un instant : « maintenant » utilise les mesures courantes. */
  function conditionsAt(ms = Date.now()) {
    const data = state.data;
    if (!data) return null;
    const h = data.hourly;
    const i = hourIndex(data, ms);
    const nowish = Math.abs(ms - Date.now()) < 45 * 60 * 1000 && data.current;
    const c = nowish ? data.current : null;
    const pick = (currentKey, hourlyKey = currentKey) => (c && Number.isFinite(c[currentKey]) ? c[currentKey] : h[hourlyKey]?.[i]);
    const code = pick("weather_code");
    const info = describe(code);
    const precipitation = pick("precipitation") ?? 0;
    const snowfall = pick("snowfall") ?? 0;
    const windKmh = pick("wind_speed_10m") ?? 0;
    const gustKmh = pick("wind_gusts_10m") ?? windKmh;
    const windFrom = pick("wind_direction_10m") ?? 300;
    return {
      time: ms,
      code,
      ...info,
      temperature: pick("temperature_2m"),
      apparent: pick("apparent_temperature"),
      humidity: pick("relative_humidity_2m"),
      precipitation,
      snowfall,
      probability: h.precipitation_probability?.[i],
      cloudCover: pick("cloud_cover") ?? 50,
      visibility: h.visibility?.[i],
      windKmh,
      gustKmh,
      windFrom,
      windCompass: COMPASS[Math.round(((windFrom % 360) + 360) % 360 / 22.5) % 16],
      isDay: pick("is_day") === 1,
      pressure: c?.pressure_msl,
    };
  }

  /** Traduit des conditions en réglages pour le jardin. */
  function sceneSettings(conditions) {
    const { mode } = conditions;
    const cover = clamp((conditions.cloudCover ?? 50) / 100, 0, 1);
    const overrides = {};
    const ranges = {
      sun: [0.05, 0.4],
      partly: [0.35, 0.72],
      clouds: [0.7, 0.98],
      fog: [0.75, 1],
      drizzle: [0.85, 1],
      rain: [0.9, 1],
      showers: [0.6, 0.92],
      snow: [0.65, 0.95],
      storm: [0.95, 1],
      hail: [0.95, 1],
    };
    const range = ranges[mode] || [0, 1];
    overrides.cover = clamp(cover, range[0], range[1]);
    const mm = conditions.precipitation || 0;
    if (mode === "drizzle") overrides.rain = clamp(0.22 + mm * 0.4, 0.22, 0.45);
    if (mode === "rain" || mode === "showers") overrides.rain = clamp(0.45 + mm / 7, 0.45, 1);
    if (mode === "snow") overrides.snow = clamp(0.45 + (conditions.snowfall || mm) / 1.5, 0.45, 1);
    // Brouillard d'après la visibilité (m) : la densité rend l'horizon réel.
    const visibility = conditions.visibility;
    if (Number.isFinite(visibility) && visibility < 8000) overrides.fog = clamp(1.73 / Math.max(60, visibility), 0.0022, 0.024);
    else if (mode === "fog") overrides.fog = 0.015;
    const wind = {
      value: windStrength(conditions.windKmh),
      gustiness: clamp((conditions.gustKmh - conditions.windKmh) / 28, 0, 1),
      angle: windAngle(conditions.windFrom),
    };
    return { mode, overrides, wind };
  }

  V32.weatherLive = {
    state,
    refresh,
    conditionsAt,
    sceneSettings,
    describe,
    windStrength,
    onChange(listener) {
      state.listeners.add(listener);
      return () => state.listeners.delete(listener);
    },
    get enabled() {
      return V32.store.get("weather-mode", "live") === "live";
    },
    /** Recherche de communes (Open-Meteo Geocoding). */
    async search(query) {
      const params = new URLSearchParams({ name: query, count: "10", language: "fr", format: "json" });
      const response = await fetch(GEOCODING + "?" + params);
      if (!response.ok) throw new Error("Recherche indisponible (" + response.status + ")");
      const data = await response.json();
      return (data.results || []).map((result) => ({
        name: result.name,
        admin: [result.admin2, result.admin1].filter(Boolean).join(", "),
        country: result.country_code || "",
        latitude: result.latitude,
        longitude: result.longitude,
        timezone: result.timezone || "",
        postcode: result.postcodes?.[0] || "",
      }));
    },
  };

  V32.register(
    "weather-live",
    function (context) {
      const { game, hooks } = context;
      const weather = game.weather;
      const root = hooks.root;
      const select = root.querySelector("[data-weather]");
      const windSelect = root.querySelector("[data-wind20]");
      if (!weather || !select) return null;

      if (!select.querySelector("option[value=live]")) {
        const option = document.createElement("option");
        option.value = "live";
        option.textContent = "Météo réelle";
        select.prepend(option);
      }
      const status = document.createElement("p");
      status.className = "v32-weather-status";
      status.setAttribute("role", "status");
      select.closest(".viz-row")?.after(status);

      let live = V32.store.get("weather-mode", "live") === "live";
      let applied = "";
      let lastApply = 0;
      let lightningTimer = 4 + Math.random() * 6;
      let flash = 0;
      let flashes = [];

      function describeStatus() {
        if (!live) {
          status.textContent = "";
          return;
        }
        const c = conditionsAt(V32.clock.now());
        const place = V32.location.name || "centre de la France";
        if (!c) {
          status.textContent =
            state.status === "error" ? "Météo réelle indisponible (" + state.error + ") · ciel dégagé en attendant" : "Météo réelle : chargement…";
          return;
        }
        status.textContent =
          "Météo réelle à " + place + " : " + c.label.toLowerCase() + ", " + Math.round(c.temperature) + " °C, vent " + Math.round(c.windKmh) + " km/h" +
          (state.status === "stale" ? " · dernière mise à jour conservée" : "");
      }

      function apply(force = false) {
        if (!live) return false;
        const conditions = conditionsAt(V32.clock.now());
        if (!conditions) return false;
        const settings = sceneSettings(conditions);
        const key = [settings.mode, ...Object.values(settings.overrides).map((v) => Number(v).toFixed(2))].join("|");
        V32.windOverride = settings.wind;
        if (windSelect) windSelect.disabled = true;
        if (key !== applied || force) {
          applied = key;
          weather.set(settings.mode, false, settings.overrides);
          select.value = "live";
          root.dataset.weatherLive = "true";
        }
        describeStatus();
        return true;
      }

      function setLive(value) {
        live = value;
        V32.store.set("weather-mode", live ? "live" : select.value);
        if (live) {
          refresh().then(() => apply(true));
          apply(true);
        } else {
          V32.windOverride = null;
          applied = "";
          if (windSelect) windSelect.disabled = false;
          root.dataset.weatherLive = "false";
        }
        describeStatus();
      }

      select.addEventListener("change", () => setLive(select.value === "live"));
      V32.weatherLive.onChange(() => {
        apply();
        describeStatus();
      });
      V32.onLocation(() => {
        applied = "";
        refresh(true);
      });
      V32.weatherLive.apply = apply;
      V32.weatherLive.setLive = setLive;
      V32.weatherLive.isLive = () => live;

      // Au démarrage : cache immédiat puis requête réseau.
      state.location = V32.location;
      restoreCache(V32.location);
      if (live) {
        select.value = "live";
        apply(true);
        refresh();
      } else {
        const saved = V32.store.get("weather-mode", "sun");
        if (weather.modes?.[saved]) weather.set(saved, true);
      }
      describeStatus();
      state.timer = setInterval(() => live && refresh(), REFRESH_MS);
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden && live) refresh();
      });

      return {
        update(dt, time, now) {
          let dirty = false;
          // Nouvelle heure (ou heure prévisualisée) : on réapplique les conditions.
          if (live && now - lastApply > 2000) {
            lastApply = now;
            apply();
          }
          // Orage : éclairs aléatoires, en deux ou trois battements rapides.
          const storm = weather.uniforms?.storm?.value || 0;
          if (storm > 0.5 && hooks.animationsEnabled()) {
            lightningTimer -= dt;
            if (lightningTimer <= 0) {
              lightningTimer = 5 + Math.random() * 14;
              const pulses = 1 + Math.floor(Math.random() * 3);
              flashes = [];
              for (let i = 0; i < pulses; i++) flashes.push({ at: i * (0.09 + Math.random() * 0.12), power: 0.6 + Math.random() * 0.6 });
              flash = 0;
            }
          }
          if (flashes.length) {
            flash += dt;
            let value = 0;
            for (const pulse of flashes) {
              const age = flash - pulse.at;
              if (age >= 0 && age < 0.22) value = Math.max(value, pulse.power * (1 - age / 0.22));
            }
            V32.uniforms.lightning.value = value * storm;
            if (flash > 1) {
              flashes = [];
              V32.uniforms.lightning.value = 0;
            }
            dirty = true;
          }
          return dirty;
        },
        setLive,
      };
    },
    40,
  );
})();
