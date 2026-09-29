// « Pas touche à mes trésors » — pictogrammes (SVG en ligne, sans ressource externe).
(function () {
  "use strict";
  const PTMT = (globalThis.PTMT = globalThis.PTMT || {});
  const s = (body, vb = "0 0 24 24") => `<svg viewBox="${vb}" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
  PTMT.icons = {
    fire: s('<path d="M12 22c4 0 7-3 7-7 0-4-3-6-4-10-1 3-3 4-4 4 0-2-1-4-2-5-1 3-4 6-4 11 0 4 3 7 7 7z" fill="currentColor" stroke="none"/>'),
    ice: s('<path d="M12 2v20M3.5 7l17 10M20.5 7l-17 10M9 3.5l3 2.5 3-2.5M9 20.5l3-2.5 3 2.5"/>'),
    water: s('<path d="M12 3c3 4.5 6 7.8 6 11a6 6 0 0 1-12 0c0-3.2 3-6.5 6-11z" fill="currentColor" stroke="none"/>'),
    net: s('<path d="M4 4l16 16M20 4L4 20M4 12h16M12 4v16M5 5c5 2 9 2 14 0M5 19c5-2 9-2 14 0"/>'),
    spring: s('<path d="M6 20h12M8 16c0-2 8-2 8-4s-8-2-8-4 8-2 8-4"/><rect x="7" y="2" width="10" height="3" rx="1" fill="currentColor"/>'),
    lure: s('<rect x="3" y="9" width="18" height="11" rx="2"/><path d="M3 13h18M5 9c0-4 14-4 14 0"/><circle cx="12" cy="15" r="1.6" fill="currentColor"/>'),
    chest: s('<rect x="3" y="10" width="18" height="10" rx="2"/><path d="M3 14h18M5 10c0-5 14-5 14 0"/><rect x="10" y="12" width="4" height="4" rx="1" fill="currentColor"/>'),
    sack: s('<path d="M9 5h6l-1.5 3c3.5 1.5 5.5 4.5 5.5 8 0 3-2.5 5-7 5s-7-2-7-5c0-3.5 2-6.5 5.5-8L9 5z" fill="currentColor" stroke="none"/><path d="M10 13h4M12 11v6" stroke="#fff"/>'),
    run: s('<circle cx="14" cy="4" r="2" fill="currentColor"/><path d="M8 21l3-6 3 2 1 4M11 15l1-5 4 3 3-1M12 10l-4 1-2 3"/>'),
    lost: s('<path d="M5 5l14 14M19 5L5 19"/>'),
    meteor: s('<circle cx="15" cy="15" r="5" fill="currentColor"/><path d="M3 3l8 8M7 3l6 6M3 7l6 6"/>'),
    freeze: s('<path d="M12 2v20M4 6l16 12M20 6L4 18"/><circle cx="12" cy="12" r="3" fill="currentColor"/>'),
    flood: s('<path d="M2 16c2-2 4-2 6 0s4 2 6 0 4-2 6 0 2 1 2 1M2 11c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/>'),
    frenzy: s('<path d="M13 2L4 14h7l-1 8 9-12h-7z" fill="currentColor" stroke="none"/>'),
    recall: s('<path d="M4 12a8 8 0 1 0 3-6.3M4 4v5h5"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/>'),
    meule: s('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3" fill="currentColor"/><path d="M12 3v6M12 15v6M3 12h6M15 12h6"/>'),
    roue: s('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2"/><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4"/>'),
    atelier: s('<path d="M14 6l4 4-9 9H5v-4z" fill="currentColor" stroke="none"/><path d="M15 3l6 6"/>'),
    pause: s('<rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor"/>'),
    play: s('<path d="M7 4l13 8-13 8z" fill="currentColor"/>'),
    menu: s('<path d="M4 6h16M4 12h16M4 18h16"/>'),
    star: s('<path d="M12 2l3 6.5 7 .8-5.2 4.8 1.4 7L12 17.8 5.8 21l1.4-7L2 9.3l7-.8z" fill="currentColor" stroke="none"/>'),
    close: s('<path d="M6 6l12 12M18 6L6 18"/>'),
    lock: s('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
    home: s('<path d="M3 11l9-8 9 8M5 10v10h14V10"/>'),
    target: s('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>'),
    coin: s('<circle cx="12" cy="12" r="9" fill="currentColor"/>'),
    shield: s('<path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z"/>'),
    swords: s('<path d="M3 3l10 10M21 3L11 13M5 19l4-4M19 19l-4-4M3 21l2-2M21 21l-2-2"/>'),
    rotate: s('<path d="M20 12a8 8 0 1 1-2.4-5.7M20 4v5h-5"/>'),
    flip: s('<path d="M4 8h13l-3-3M20 16H7l3 3"/>'),
    axe: s('<path d="M14 4l6 6-3 1-4-4z" fill="currentColor"/><path d="M13.5 7.5L4 20" stroke-width="2.6"/><path d="M16 3c2.5 0 5 2.5 5 5" />'),
  };
})();
