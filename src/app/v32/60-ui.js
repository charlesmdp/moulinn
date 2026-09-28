// Moulin V32 — habillage de l'interface.
//
// Même organisation que la V31 (les boutons et leurs fonctions ne changent pas) mais
// une présentation plus légère : carte « Saint-Christophe » en haut à gauche, onglets
// réunis dans une pilule claire au centre, réglages à droite, aide et zoom en verre
// fumé en bas. Tout le style est dans src/styles/v32.css (classe .v32 sur la racine).
(function () {
  "use strict";
  const V32 = globalThis.MoulinV32;

  V32.register(
    "ui",
    function (context) {
      const { hooks } = context;
      const root = hooks.root;
      root.classList.add("v32");

      const toolbar = root.querySelector(".moulin-toolbar");
      if (toolbar && !toolbar.querySelector(".v32-brand")) {
        const brand = document.createElement("div");
        brand.className = "v32-brand";
        brand.innerHTML =
          '<span class="v32-mark" aria-hidden="true">M</span><span class="v32-brand-text"><strong>Saint-Christophe</strong><span>Le moulin · votre jardin vivant</span></span>';
        toolbar.prepend(brand);
      }

      // Pictogrammes au trait pour les actions de droite.
      const settings = root.querySelector("[data-ui-settings] > span[aria-hidden]");
      if (settings) settings.innerHTML = V32.lineIcon("sliders", 19);
      const fullscreen = root.querySelector("[data-fullscreen] > span[aria-hidden]");
      if (fullscreen) fullscreen.innerHTML = V32.lineIcon("expand", 18);

      // L'ancienne barre de la boule est remplacée par la frise de l'onglet Météo.
      const globeBar = root.querySelector("[data-globe26-bar]");
      if (globeBar) globeBar.classList.add("v32-retired");

      // Pastille « Promenade » : toujours visible sur ordinateur, discrète sur téléphone.
      root.dataset.ui32 = "ready";
      return null;
    },
    60,
  );
})();
