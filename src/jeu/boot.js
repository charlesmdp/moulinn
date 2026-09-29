// « Pas touche à mes trésors » — chargeur de la page /jeu/ : moteur 3D, ressources, jeu.
(function () {
  "use strict";
  const A = {
    engine: "../assets/engine-0.40e246fcf208.js",
    inflate: "../assets/gzip-compat.f3b9ca21f366.js",
    vendor: "{{asset:jeu-vendor}}",
    game: "{{asset:jeu-js}}",
    plan: "../assets/garden-assets.1b2d1ff75f13.json",
    geometry: "../assets/geometry.dee3e21d6384.bin.gz",
    mill: "../assets/td-moulin.35fdce48df0e.glb.gz",
    dependance: "../assets/td-dependance.9b97687f855f.glb.gz",
  };
  const root = document.getElementById("ptmt");
  const loading = root.querySelector("[data-loading]");
  const bar = loading.querySelector("[data-load-bar]");
  const detail = loading.querySelector("[data-load-detail]");
  const tip = loading.querySelector("[data-load-tip]");
  const retry = loading.querySelector("[data-load-retry]");
  const tips = [
    "Un voleur ne perd le trésor qu'en passant la sortie : mets-le KO avant !",
    "Le feu fait des dégâts, la glace retient, l'eau repousse et regroupe.",
    "Un sac tombé peut être rappelé à sa réserve avec le sort Rappel.",
    "La Meule rapporte de l'or à chaque vague terminée : elle s'amortit vite.",
    "Les tours gagnent de l'expérience et évoluent avec l'Atelier.",
    "En pause, tu peux construire et préparer tes sorts.",
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
  const total = 7;
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
  async function gunzip(buffer) {
    const u8 = new Uint8Array(buffer);
    if (u8[0] !== 31 || u8[1] !== 139) return buffer;
    if (typeof DecompressionStream === "function") {
      try {
        return await new Response(new Blob([buffer]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();
      } catch {}
    }
    await script(A.inflate);
    const out = window.MoulinGunzip30(u8);
    return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength);
  }
  async function get(url, type) {
    const r = await fetch(url);
    if (!r.ok) throw new Error("Ressource indisponible (" + r.status + ") : " + url.split("/").pop());
    const v = type === "json" ? await r.json() : await gunzip(await r.arrayBuffer());
    step();
    return v;
  }
  (async function () {
    detail.textContent = "Chargement du moteur 3D…";
    const libs = (async () => {
      await script(A.engine);
      step("Moteur 3D prêt");
      await script(A.vendor);
      step();
      await script(A.game);
      step("Règles du jeu chargées");
    })();
    // Les voleurs sont entièrement procéduraux : plus de personnage à télécharger (avatar: null).
    const [plan, geometry, mill, dependance] = await Promise.all([get(A.plan, "json"), get(A.geometry), get(A.mill), get(A.dependance), libs]);
    const avatar = null;
    detail.textContent = "Préparation du domaine…";
    const base = new URL("../", location.href).href;
    await window.PTMT.main.start({ root, canvas, gl, mobile, plan, geometry, mill, dependance, avatar, base, loading });
  })().catch(fail);
})();
