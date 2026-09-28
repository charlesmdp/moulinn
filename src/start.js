(function () {
  "use strict";
  var n = {
      inflate: "assets/gzip-compat.f3b9ca21f366.js",
      libraries: [
        "assets/engine-0.40e246fcf208.js",
        "assets/engine-1.f10ee4887053.js",
        "assets/engine-2.64422f1aa30f.js",
      ],
      app: "{{asset:app}}",
      exporter: "assets/gltf-exporter.7f2e462b46ac.js",
      assets: "assets/garden-assets.1b2d1ff75f13.json",
      plan: "assets/garden-plan.8d2f34ed9340.json",
      trees: "assets/garden-trees.5dc4beb6271a.json",
      geometry: "assets/geometry.dee3e21d6384.bin.gz",
      terrain: "assets/terrain.fdfff6247f8a.bin.gz",
      terrainSpecs: {
        heights: { offset: 0, bytes: 1496640, type: "Float32Array" },
        grid: { offset: 1496640, bytes: 317812, type: "Float32Array" },
        mask: { offset: 1814452, bytes: 78880, type: "Uint8Array" },
      },
      avatar: "assets/visitor.0ad88b8a340a.glb.gz",
      swan: "assets/swan.e998b423ef42.webp",
    },
    o = document.querySelector("[data-loading]"),
    l = o.querySelector("[data-load-detail]"),
    w = o.querySelector("[data-load-help]"),
    m = o.querySelector("[data-retry]"),
    u = !1;
  function c(e) {
    u ||
      ((u = !0),
      (o.hidden = !1),
      o.setAttribute("role", "alert"),
      (o.querySelector("strong").textContent = "Le moulin n\u2019a pas pu d\xE9marrer"),
      (l.textContent = e.message || String(e)),
      (w.textContent =
        "Ouvre l\u2019adresse HTTPS du site dans Safari ou Chrome. Si tu es d\xE9j\xE0 sur le site, recharge la page apr\xE8s avoir ferm\xE9 les autres onglets 3D."),
      (m.hidden = !1));
  }
  if (
    (m.addEventListener("click", function () {
      location.reload();
    }),
    location.protocol === "file:")
  ) {
    c(new Error("Cette version doit \xEAtre mise en ligne. Ouvrir index.html depuis Fichiers ne lance pas le jeu."));
    return;
  }
  (window.addEventListener("error", function (e) {
    var t;
    ((t = window.MoulinBoot) != null && t.state.done) ||
      c(e.error || new Error(e.message || "Un fichier du jeu n\u2019a pas pu \xEAtre charg\xE9."));
  }),
    window.addEventListener("unhandledrejection", function (e) {
      var t;
      ((t = window.MoulinBoot) != null && t.state.done) ||
        c(e.reason || new Error("Le t\xE9l\xE9chargement a \xE9chou\xE9."));
    }),
    Array.prototype.at ||
      Object.defineProperty(Array.prototype, "at", {
        value: function (e) {
          return ((e = Math.trunc(e) || 0), this[e < 0 ? this.length + e : e]);
        },
        writable: !0,
        configurable: !0,
      }));
  var h = matchMedia("(pointer: coarse)").matches || innerWidth < 700,
    d = document.createElement("canvas"),
    y = { antialias: !h, alpha: !1, preserveDrawingBuffer: !1, powerPreference: "low-power" },
    g;
  try {
    g = d.getContext("webgl2", y) || d.getContext("webgl", y) || d.getContext("experimental-webgl", y);
  } catch {}
  if (!g) {
    c(
      new Error(
        "La 3D WebGL est indisponible dans ce navigateur. Essaie Safari ou Chrome \xE0 jour et ferme les autres onglets 3D.",
      ),
    );
    return;
  }
  var b = {};
  function p(e) {
    return (
      b[e] ||
      (b[e] = new Promise(function (t, a) {
        var r = document.createElement("script");
        ((r.src = e),
          (r.onload = t),
          (r.onerror = function () {
            a(new Error("Un fichier du jeu est indisponible. V\xE9rifie la connexion, puis recharge."));
          }),
          document.head.appendChild(r));
      }))
    );
  }
  var j = 0;
  async function f(e, t) {
    const a = new AbortController(),
      r = setTimeout(function () {
        a.abort();
      }, 6e4);
    try {
      const s = await fetch(e, { signal: a.signal });
      if (!s.ok) throw new Error("Une ressource du jardin est indisponible (" + s.status + ").");
      const E = t === "arrayBuffer" ? await v(s) : await s[t]();
      return (j++, u || (l.textContent = "Chargement des ressources : " + j + "/5"), E);
    } finally {
      clearTimeout(r);
    }
  }
  async function v(e) {
    const t = await e.arrayBuffer(),
      a = new Uint8Array(t);
    if (a[0] !== 31 || a[1] !== 139) return t;
    if (typeof DecompressionStream == "function")
      try {
        return await new Response(new Blob([t]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();
      } catch {}
    await p(n.inflate);
    const r = window.MoulinGunzip30(a);
    return r.buffer.slice(r.byteOffset, r.byteOffset + r.byteLength);
  }
  const i = (window.MoulinHost30 = {
    binary: v,
    renderer: { canvas: d, context: g },
    avatar: n.avatar,
    swan: n.swan,
    loadExporter: function () {
      return p(n.exporter);
    },
  });
  ((o.querySelector("strong").textContent = "Chargement du moulin\u2026"),
    (l.textContent = "T\xE9l\xE9chargement des ressources\u2026"),
    (w.textContent = h
      ? "Pr\xE9paration du rendu adapt\xE9 au t\xE9l\xE9phone. Les ressources sont conserv\xE9es en cache pour les prochaines visites."
      : "Pr\xE9paration de la visite du domaine\u2026"));
  const C = (async function () {
    for (const e of n.libraries) await p(e);
  })();
  Promise.all([
    f(n.assets, "json"),
    f(n.plan, "json"),
    f(n.trees, "json"),
    f(n.geometry, "arrayBuffer"),
    f(n.terrain, "arrayBuffer"),
    C,
  ])
    .then(async function (e) {
      ((i.assets = e[0]), (i.plan = e[1]), (i.trees = e[2]), (i.geometry = e[3]), (i.terrain = { styleVersion: 17 }));
      const t = { Float32Array, Uint8Array };
      for (const [a, r] of Object.entries(n.terrainSpecs)) {
        const s = t[r.type];
        i.terrain[a] = new s(e[4], r.offset, r.bytes / s.BYTES_PER_ELEMENT);
      }
      u || ((l.textContent = "Construction du jardin\u2026"), await p(n.app));
    })
    .catch(c);
})();
