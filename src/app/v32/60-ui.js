// Moulin V32 — habillage de l'interface.
//
// Même organisation que la V31 (les boutons et leurs fonctions ne changent pas) mais
// une présentation plus légère : onglets réunis dans une pilule claire au centre,
// réglages à droite, aide et zoom en verre fumé en bas. Tout le style est dans
// src/styles/v32.css (classe .v32 sur la racine).
(function () {
  "use strict";
  const V32 = globalThis.MoulinV32;

  V32.register(
    "ui",
    function (context) {
      const { hooks } = context;
      const root = hooks.root;
      root.classList.add("v32");

      // Plus de carte « Saint-Christophe » en haut à gauche : les onglets suffisent.
      root.querySelector(".moulin-toolbar .v32-brand")?.remove();

      // Vue 3D et atelier « Aménager » ne sont proposés qu'aux adresses /3D et /build (la page
      // générée pour chaque adresse n'a déjà que ses boutons ; ceci couvre les autres cas).
      for (const mode of ["orbit", "editor"])
        if (!V32.modeAllowed(mode)) root.querySelector('.mode-switch [data-mode="' + mode + '"]')?.remove();

      // Pictogrammes au trait pour les actions de droite.
      const settings = root.querySelector("[data-ui-settings] > span[aria-hidden]");
      if (settings) settings.innerHTML = V32.lineIcon("sliders", 19);
      const fullscreen = root.querySelector("[data-fullscreen] > span[aria-hidden]");
      if (fullscreen) fullscreen.innerHTML = V32.lineIcon("expand", 18);

      // L'ancienne barre de la boule est remplacée par la frise de l'onglet Météo.
      const globeBar = root.querySelector("[data-globe26-bar]");
      if (globeBar) globeBar.classList.add("v32-retired");

      // Écran tactile : pas de touches du clavier dans les invites (« E », « L ») mais des
      // boutons explicites, et pas de touche « E » dans le bouton du quad.
      const touch = hooks.mobile || matchMedia("(pointer: coarse)").matches;
      if (touch) {
        root.classList.add("v32-touch");
        const relabel = () => {
          const vehicle = root.querySelector("[data-vehicle-prompt25]");
          if (vehicle && vehicle.textContent !== "Monter") {
            vehicle.textContent = "Monter";
            vehicle.setAttribute("aria-label", "Monter sur le quad");
            vehicle.title = "Monter sur le quad";
          }
          const sign = root.querySelector("[data-sign-prompt25]");
          if (sign && sign.textContent !== "Lire") {
            sign.textContent = "Lire";
            sign.setAttribute("aria-label", "Lire le panneau");
            sign.title = "Lire le panneau";
          }
          for (const key of root.querySelectorAll(".player20-key")) key.remove();
          return Boolean(vehicle && sign);
        };
        // Les invites naissent avec la promenade (après ce module) : on attend qu'elles
        // existent, puis on arrête d'observer (leur texte ne change plus ensuite).
        if (!relabel()) {
          const watcher = new MutationObserver(() => {
            if (relabel()) watcher.disconnect();
          });
          watcher.observe(root, { childList: true, subtree: true });
        }
      }

      // Onglet « Jeu » : ouvre le tower defense (page /jeu/, qui a son propre écran de chargement).
      const gameLink = root.querySelector("[data-game-link32]");
      if (gameLink && !gameLink.dataset.bound32) {
        gameLink.dataset.bound32 = "1";
        gameLink.addEventListener("click", () => {
          const veil = document.createElement("div");
          veil.className = "v32-game-veil";
          veil.setAttribute("role", "status");
          veil.innerHTML = '<div class="v32-game-veil-card"><span class="v32-game-veil-spin" aria-hidden="true"></span><strong>Pas touche à mes trésors</strong><span>Chargement du jeu…</span></div>';
          document.body.appendChild(veil);
          requestAnimationFrame(() => {
            veil.classList.add("is-on");
            setTimeout(() => location.assign(new URL("jeu/", document.baseURI).href), 180);
          });
        });
      }

      // Pastille « Promenade » : toujours visible sur ordinateur, discrète sur téléphone.
      root.dataset.ui32 = "ready";
      return null;
    },
    60,
  );
})();
