// « Pas touche à mes trésors » — chargeur de la page /jeu/ : moteur 3D, ressources, jeu.
(function () {
  "use strict";
  const A = {
    engine: "../assets/engine-0.40e246fcf208.js",
    vendor: "{{asset:jeu-vendor}}",
    game: "{{asset:jeu-js}}",
  };
  const root = document.getElementById("ptmt");
  const loading = root.querySelector("[data-loading]");
  const bar = loading.querySelector("[data-load-bar]");
  const detail = loading.querySelector("[data-load-detail]");
  const tip = loading.querySelector("[data-load-tip]");
  const retry = loading.querySelector("[data-load-retry]");
  const tips = [
    "Un voleur tué lâche sa gemme : les autres foncent la ramasser. Garde des tours près du moulin !",
    "Sanglier sur l'herbe, cygne sur l'eau, berger sur la roche : la butte accepte les trois.",
    "Le sort Couper dégage une case boisée pour y construire.",
    "Une tour gagne de l'expérience en combattant ; au niveau 4, choisis sa spécialisation.",
    "Le chasseur camouflé devient invisible au premier coup : étale tes tours le long du chemin.",
    "Chaque mission gagnée rapporte 3 points de compétence.",
    "Le berger australien devient dragon au niveau 4.",
  ];
  tip.textContent = tips[Math.floor(Math.random() * tips.length)];
  let failed = false;
  function fail(err) {
    if (failed) return;
    failed = true;
    console.error(err);
    detail.textContent = "Le jeu n'a pas pu démarrer : " + (err && err.message ? err.message : err);
    retry.hidden = false;
  }
  retry.addEventListener("click", () => location.reload());
  window.addEventListener("error", (e) => {
    if (!window.PTMT || !window.PTMT.started) fail(e.error || e.message);
  });
  window.addEventListener("unhandledrejection", (e) => {
    if (!window.PTMT || !window.PTMT.started) fail(e.reason);
  });
  if (location.protocol === "file:") {
    fail(new Error("Ouvre le jeu depuis le site en ligne (https), pas depuis un fichier."));
    return;
  }
  const canvas = document.createElement("canvas");
  const mobile = matchMedia("(pointer: coarse)").matches || innerWidth < 720;
  let gl = null;
  try {
    const opts = { antialias: true, alpha: false, powerPreference: mobile ? "low-power" : "high-performance" };
    gl = canvas.getContext("webgl2", opts) || canvas.getContext("webgl", opts);
  } catch {}
  if (!gl) {
    fail(new Error("WebGL est indisponible dans ce navigateur."));
    return;
  }
  let done = 0;
  const total = 3;
  function step(label) {
    done++;
    bar.style.width = Math.min(100, 6 + (done / total) * 94) + "%";
    if (label) detail.textContent = label;
  }
  const scripts = {};
  function script(src) {
    return (
      scripts[src] ||
      (scripts[src] = new Promise((res, rej) => {
        const s = document.createElement("script");
        s.src = src;
        s.onload = res;
        s.onerror = () => rej(new Error("Fichier indisponible : " + src.split("/").pop()));
        document.head.appendChild(s);
      }))
    );
  }
  (async function () {
    detail.textContent = "Chargement du moteur 3D…";
    await script(A.engine);
    step("Moteur 3D prêt");
    await script(A.vendor);
    step();
    await script(A.game);
    step("Règles du jeu chargées");
    detail.textContent = "Préparation des missions…";
    await window.PTMT.main.start({ root, canvas, gl, mobile, loading });
  })().catch(fail);
})();
