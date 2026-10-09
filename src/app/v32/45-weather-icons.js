// Moulin V32 — pictogrammes météo (SVG en ligne, couleurs douces, lisibles en petit).
(function () {
  "use strict";
  const V32 = globalThis.MoulinV32;

  const SUN = '<circle cx="24" cy="24" r="8.5" fill="#ffc94a"/><g stroke="#ffc94a" stroke-width="2.6" stroke-linecap="round"><path d="M24 7v4M24 37v4M7 24h4M37 24h4M12 12l2.8 2.8M33.2 33.2 36 36M12 36l2.8-2.8M33.2 14.8 36 12"/></g>';
  const SMALL_SUN = '<g transform="translate(-6 -6) scale(.78)">' + SUN + "</g>";
  const MOON = '<path d="M30.5 9.5a14 14 0 1 0 8 23.6 12 12 0 0 1-8-23.6Z" fill="#dfe6f7" stroke="#b8c4e0" stroke-width="1.2"/>';
  const SMALL_MOON = '<g transform="translate(-5 -5) scale(.72)">' + MOON + "</g>";
  const CLOUD = (fill = "#ffffff", stroke = "#9fb1bd") =>
    `<path d="M14.5 36.5h19.2a8 8 0 0 0 .9-15.95A10.5 10.5 0 0 0 14.6 23 6.8 6.8 0 0 0 14.5 36.5Z" fill="${fill}" stroke="${stroke}" stroke-width="1.6" stroke-linejoin="round"/>`;
  const DROPS = (count, color = "#4f9fd6") =>
    [
      [17, 40],
      [24, 42],
      [31, 40],
    ]
      .slice(0, count)
      .map(([x, y]) => `<path d="M${x} ${y}l-2 4.2" stroke="${color}" stroke-width="2.4" stroke-linecap="round"/>`)
      .join("");
  const FLAKES = [
    [17, 41],
    [24, 44],
    [31, 41],
  ]
    .map(([x, y]) => `<g stroke="#8fb6d8" stroke-width="1.6" stroke-linecap="round"><path d="M${x - 2.2} ${y}h4.4M${x} ${y - 2.2}v4.4M${x - 1.6} ${y - 1.6}l3.2 3.2M${x - 1.6} ${y + 1.6}l3.2-3.2"/></g>`)
    .join("");
  const BOLT = '<path d="M25.5 33 20 41.5h4.5L22 48l8-10h-4.6l3-5Z" fill="#ffc94a" stroke="#e59a1a" stroke-width="1" stroke-linejoin="round"/>';
  const HAIL = [
    [17, 42],
    [24, 44.5],
    [31, 42],
  ]
    .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2" fill="#e8f1f8" stroke="#8fb6d8" stroke-width="1.2"/>`)
    .join("");
  const FOG = '<g stroke="#a9b7bf" stroke-width="2.6" stroke-linecap="round"><path d="M10 38h22M15 43h24M12 33h6"/></g>';

  function svg(inner) {
    return `<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">${inner}</svg>`;
  }

  /** Pictogramme pour un type de temps (voir 40-weather-live.js) de jour ou de nuit. */
  V32.weatherIcon = function (kind, isDay = true) {
    const behind = isDay ? SMALL_SUN : SMALL_MOON;
    switch (kind) {
      case "clear":
        return svg(isDay ? SUN : MOON);
      case "mostly-clear":
        return svg((isDay ? SUN : MOON) + '<g transform="translate(9 11) scale(.62)">' + CLOUD() + "</g>");
      case "partly":
        return svg(behind + CLOUD());
      case "overcast":
        return svg('<g transform="translate(-7 -6) scale(.8)">' + CLOUD("#e3e9ee", "#9fb1bd") + "</g>" + CLOUD("#f4f7f9", "#8fa2af"));
      case "fog":
        return svg('<g transform="translate(0 -6)">' + CLOUD("#eef2f4", "#a9b7bf") + "</g>" + FOG);
      case "drizzle":
        return svg('<g transform="translate(0 -5)">' + CLOUD() + "</g>" + DROPS(2, "#79b4df"));
      case "rain":
        return svg('<g transform="translate(0 -5)">' + CLOUD("#eef2f5") + "</g>" + DROPS(3));
      case "heavy-rain":
        return svg('<g transform="translate(0 -5)">' + CLOUD("#d9e1e8", "#7f93a2") + "</g>" + DROPS(3, "#2f86c7"));
      case "showers":
        return svg(behind + '<g transform="translate(0 -4)">' + CLOUD() + "</g>" + DROPS(2));
      case "snow":
        return svg('<g transform="translate(0 -5)">' + CLOUD() + "</g>" + FLAKES);
      case "storm":
        return svg('<g transform="translate(0 -6)">' + CLOUD("#c9d3dc", "#6f8494") + "</g>" + BOLT);
      case "hail":
        return svg('<g transform="translate(0 -6)">' + CLOUD("#c9d3dc", "#6f8494") + "</g>" + HAIL + '<g transform="translate(4 -3) scale(.8)">' + BOLT + "</g>");
      default:
        return svg(behind + CLOUD());
    }
  };

  /** Petits pictogrammes d'interface (trait uniquement, couleur du texte). */
  const LINE = {
    pin: '<path d="M12 21s-6.5-6.2-6.5-11A6.5 6.5 0 0 1 18.5 10c0 4.8-6.5 11-6.5 11Z"/><circle cx="12" cy="10" r="2.3"/>',
    refresh: '<path d="M19 12a7 7 0 1 1-2.1-5"/><path d="M19 4v4.5h-4.5"/>',
    play: '<path d="M8 5.5v13l10.5-6.5Z" fill="currentColor" stroke="none"/>',
    pause: '<path d="M8 5.5v13M16 5.5v13" stroke-width="3"/>',
    rotate: '<path d="M4 12a8 8 0 0 1 14-5.3"/><path d="M18.5 3v4h-4"/><path d="M20 12a8 8 0 0 1-14 5.3"/><path d="M5.5 21v-4h4"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    locate: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3.2M12 18.3v3.2M2.5 12h3.2M18.3 12h3.2"/><circle cx="12" cy="12" r="7"/>',
    chevron: '<path d="m7 10 5 5 5-5"/>',
    search: '<circle cx="11" cy="11" r="6"/><path d="m16 16 4.5 4.5"/>',
    wind: '<path d="M3 9h11a3 3 0 1 0-3-3M3 15h15a3 3 0 1 1-3 3M3 12h8"/>',
    drop: '<path d="M12 3.5s6 6.4 6 10.5a6 6 0 0 1-12 0c0-4.1 6-10.5 6-10.5Z"/>',
    cloud: '<path d="M7 18h10a4.5 4.5 0 0 0 .5-9 6 6 0 0 0-11.4 1.6A3.8 3.8 0 0 0 7 18Z"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.8"/>',
    gauge: '<path d="M4.5 16a8 8 0 1 1 15 0"/><path d="m12 13 3.5-4"/>',
    sunrise: '<path d="M4 18h16M7 14a5 5 0 0 1 10 0"/><path d="M12 3v4M9.5 5.5 12 3l2.5 2.5"/>',
    moon: '<path d="M15.5 4.5a8 8 0 1 0 4 12.8 7 7 0 0 1-4-12.8Z"/>',
    thermo: '<path d="M10 14.5V5a2 2 0 1 1 4 0v9.5a4 4 0 1 1-4 0Z"/>',
    sliders: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
    expand: '<path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"/>',
    meteo: '<circle cx="9" cy="8.5" r="3.4"/><path d="M9 2.5v1.2M3 8.5h1.2M4.8 4.3l.9.9M13.2 4.3l-.9.9"/><path d="M8.5 19.5h9a3.6 3.6 0 0 0 .4-7.2 4.8 4.8 0 0 0-9.1 1.3 3 3 0 0 0-.3 5.9Z"/>',
  };
  V32.lineIcon = function (name, size = 20) {
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${LINE[name] || ""}</svg>`;
  };
})();
