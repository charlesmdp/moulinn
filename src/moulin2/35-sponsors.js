// La Fête du Moulin — les sponsors.
//
// Un sponsor par jeu, un pour les tableaux du top 10, et un sponsor principal pour toute la fête
// (arche d'entrée, grand panneau, bâche du moulin, montgolfière, carte du parc, écran de chargement).
// Chaque jeu a ses emplacements (bâches le long du circuit, arche de départ, fronton du stand,
// télécommande…) : tous affichent le sponsor du jeu. Les annonces viennent de trois endroits :
//   – /api/sponsors : celles que le propriétaire a publiées (functions/api/sponsors.js) ;
//   – l'aperçu local : ce qu'un visiteur essaie au guichet, visible de lui seul (navigateur) ;
//   – src/static/moulin2/sponsors.json : réglage à la main, emplacement par emplacement (prioritaire) :
//       { "contact": { "texte": "…", "lien": "https://…" },
//         "emplacements": { "rc-arche": { "nom": "Acme", "accroche": "…", "lien": "https://acme.dev",
//                                         "fond": "#101828", "texte": "#ffffff", "logo": "moulin2/logos/acme.png" } } }
// Un emplacement sans sponsor affiche « Your brand here ».
//
//   MF.sponsors.get(id) → { id, label, game, target, taken, name, tagline, url, bg, fg, logo, preview }
//   MF.sponsors.texture(id, { w, h }) → texture (redessinée quand une annonce ou une image arrive)
//   MF.sponsors.board(id, largeur, hauteur) → panneau simple face (à coller sur un mur, un stand)
//   MF.sponsors.banner(id, largeur, hauteur, { lift, posts }) → bâche double face entre deux piquets,
//       origine au sol, face vers +z
//   MF.sponsors.brand(id) → texte court pour la télécommande ; MF.sponsors.all() → tous les emplacements
//   MF.sponsors.of(cible) → annonce d'une cible (« fair », « top10 » ou un jeu) ; paint(ctx, W, H, annonce)
//   MF.sponsors.setPreview(cible, annonce | null) ; request(cible, annonce, contact) ; publish(cible, annonce | null, clé)
//   MF.sponsors.pending(clé) ; decide(id, accepter, clé) → promesses { ok, error, … }
(function () {
  "use strict";
  const MF = (globalThis.MoulinFete = globalThis.MoulinFete || {});
  const T = () => globalThis.THREE;

  // Catalogue des emplacements : identifiant → [où, jeu].
  const CATALOG = {
    "village-arche": ["Fair entrance arch", "fete"],
    "village-panneau": ["Main games board", "fete"],
    "rc-arche": ["RC track start arch", "rc"],
    "rc-bache-1": ["RC track banner, main straight", "rc"],
    "rc-bache-2": ["RC track banner, hairpin", "rc"],
    "rc-bache-3": ["RC track banner, downhill", "rc"],
    "rc-bache-4": ["RC track banner, mill courtyard", "rc"],
    "rc-telecommande": ["RC car remote control", "rc"],
    "bateaux-ponton": ["Jetty banner", "bateaux"],
    "bateaux-bouees": ["Course buoys", "bateaux"],
    "bateaux-telecommande": ["RC boat remote control", "bateaux"],
    "golf-1": ["Mini-golf hole 1 banner", "golf"],
    "golf-2": ["Mini-golf hole 2 banner", "golf"],
    "golf-3": ["Mini-golf hole 3 banner", "golf"],
    "golf-4": ["Mini-golf hole 4 banner", "golf"],
    "golf-5": ["Mini-golf hole 5 banner", "golf"],
    "golf-6": ["Mini-golf hole 6 banner", "golf"],
    "golf-7": ["Mini-golf hole 7 banner", "golf"],
    "golf-8": ["Mini-golf hole 8 banner", "golf"],
    "golf-9": ["Mini-golf hole 9 banner", "golf"],
    "tir-fond": ["Shooting gallery backdrop", "tir"],
    "tir-fronton": ["Shooting gallery front sign", "tir"],
    "canards-fronton": ["Hook-a-duck front sign", "canards"],
    "canards-bassin": ["Duck pool rim", "canards"],
    "autos-fronton": ["Bumper cars front sign", "autos"],
    "autos-bandeau": ["Bumper cars arena banner", "autos"],
    "citrouilles-fronton": ["Pumpkin launch pad banner", "citrouilles"],
    "citrouilles-cibles": ["Pumpkin targets", "citrouilles"],
    "drones-arche": ["Drone race start arch", "drones"],
    "drones-portes": ["Drone race gates", "drones"],
    "drones-radio": ["Drone radio controller", "drones"],
  };
  const PREVIEW = "fete-ads-apercu";
  const state = { data: {}, contact: { texte: "", lien: "" }, ads: { fair: null, top10: null, games: {} }, preview: {}, open: false, online: false, textures: [], logos: new Map(), loaded: false, listeners: [] };
  try {
    const saved = typeof localStorage !== "undefined" && JSON.parse(localStorage.getItem(PREVIEW) || "{}");
    if (saved && typeof saved === "object") state.preview = saved;
  } catch (error) {
    /* sans importance */
  }

  /** Cible d'un emplacement : « fair » (toute la fête), « top10 » ou l'identifiant d'un jeu. */
  function targetOf(id) {
    const cat = CATALOG[id];
    if (cat) return cat[1] === "fete" ? "fair" : cat[1];
    if (/^(fest|village)-/.test(id)) return "fair";
    if (/^top10-/.test(id)) return "top10";
    return id.split("-")[0];
  }
  const published = (target) => (target === "fair" || target === "top10" ? state.ads[target] : state.ads.games[target]) || null;
  /** Annonce d'une cible : l'aperçu local d'abord (preview: true), sinon celle qui est publiée. */
  function of(target) {
    const p = state.preview[target], ad = p && p.name ? p : published(target);
    if (!ad || !ad.name) return null;
    return { name: String(ad.name), tagline: ad.tagline || "", url: /^https?:\/\//i.test(ad.url || "") ? ad.url : "", image: ad.image || "", bg: ad.bg || "#1d2b4f", fg: ad.fg || "#ffffff", preview: ad === p };
  }

  function get(id) {
    const cat = CATALOG[id] || [id, ""], target = targetOf(id);
    const d = state.data[id] || {};
    if (d.nom && String(d.nom).trim())
      return { id, label: cat[0], game: cat[1], target, taken: true, name: String(d.nom).trim(), tagline: d.accroche || "", url: /^https?:\/\//i.test(d.lien || "") ? d.lien : "", bg: d.fond || "#1d2b4f", fg: d.texte || "#ffffff", logo: d.logo || "", price: d.prix || "", preview: false };
    // le tableau d'un top 10 sans sponsor des tableaux porte celui du jeu
    const ad = of(target) || (target === "top10" ? of(id.slice(6)) : null);
    if (ad) return { id, label: cat[0], game: cat[1], target, taken: true, name: ad.name, tagline: ad.tagline, url: ad.url, bg: ad.bg, fg: ad.fg, logo: ad.image, price: "", preview: ad.preview };
    return { id, label: cat[0], game: cat[1], target, taken: false, name: "", tagline: "", url: "", bg: MF.PAL.cream, fg: MF.PAL.ink, logo: "", price: d.prix || "", preview: false };
  }

  function logoImage(src, onLoad) {
    if (!src) return null;
    let entry = state.logos.get(src);
    if (!entry) {
      entry = { img: new Image(), ok: false, waiters: [] };
      if (!/^data:/.test(src)) entry.img.crossOrigin = "anonymous";
      entry.img.onload = () => {
        entry.ok = true;
        entry.waiters.splice(0).forEach((f) => f());
      };
      entry.img.src = /^data:/.test(src) ? src : new URL(src, document.baseURI).href;
      state.logos.set(src, entry);
    }
    if (!entry.ok && onLoad) entry.waiters.push(onLoad);
    return entry.ok ? entry.img : null;
  }

  /** Dessine une annonce ({ taken, name, tagline, bg, fg, logo }) dans un cadre W × H ; o.kicker : nom de l'emplacement libre. */
  function paint(ctx, W, H, s, o = {}) {
    const pad = Math.round(H * 0.06);
    ctx.fillStyle = s.taken ? s.bg : MF.PAL.cream;
    ctx.fillRect(0, 0, W, H);
    if (!s.taken) {
      // emplacement libre : cadre en pointillés et invitation
      ctx.strokeStyle = MF.PAL.orange;
      ctx.lineWidth = Math.max(4, H * 0.035);
      ctx.setLineDash([H * 0.12, H * 0.08]);
      ctx.strokeRect(pad * 1.2, pad * 1.2, W - pad * 2.4, H - pad * 2.4);
      ctx.setLineDash([]);
      MF.fitText(ctx, "YOUR BRAND HERE", W / 2, H * 0.42, W - pad * 6, H * 0.38, { color: MF.PAL.red });
      MF.fitText(ctx, (o.kicker || s.label || "Sponsor") + " · ask at the Ad Booth", W / 2, H * 0.76, W - pad * 6, H * 0.16, { color: MF.PAL.woodDark, font: "system-ui, sans-serif", weight: "700" });
      return;
    }
    const img = logoImage(s.logo, o.redraw);
    let textX = W / 2, textW = W - pad * 4;
    if (img) {
      // image à gauche, dans un cadre de deux hauteurs de large au plus
      const boxH = H - pad * 3, boxW = Math.min(boxH * 2, W * 0.42);
      const ratio = Math.min(boxW / img.width, boxH / img.height);
      const lw = img.width * ratio, lh = img.height * ratio;
      ctx.drawImage(img, pad * 1.5 + (boxW - lw) / 2, (H - lh) / 2, lw, lh);
      textX = pad * 2.5 + boxW + (W - pad * 4 - boxW) / 2;
      textW = W - pad * 5 - boxW;
    }
    if (s.tagline) {
      MF.fitText(ctx, s.name, textX, H * 0.4, textW, H * 0.46, { color: s.fg });
      MF.fitText(ctx, s.tagline, textX, H * 0.76, textW, H * 0.18, { color: s.fg, font: "system-ui, sans-serif", weight: "700" });
    } else MF.fitText(ctx, s.name, textX, H * 0.52, textW, H * 0.62, { color: s.fg });
  }

  function texture(id, o = {}) {
    const w = o.w || 4, hh = o.h || 1;
    const pxH = o.px || 256, pxW = Math.min(2048, Math.round((pxH * w) / hh));
    const opts = { kicker: o.kicker, redraw: null };
    const tex = MF.canvasTexture(pxW, pxH, (ctx, W, H) => paint(ctx, W, H, get(id), opts));
    opts.redraw = () => tex.redraw();
    state.textures.push(tex);
    MF.whenFont(() => tex.redraw());
    return tex;
  }
  function board(id, w, hh, o = {}) {
    const THREE = T();
    const mat = new THREE.MeshBasicMaterial({ map: texture(id, { w, h: hh, kicker: o.kicker }) });
    const mesh = MF.plane(w, hh, mat, Object.assign({ receive: false, name: "Panneau_sponsor_" + id }, o));
    mesh.userData.sponsor = id;
    return mesh;
  }
  function banner(id, w, hh, o = {}) {
    const g = MF.group({ name: "Bache_sponsor_" + id });
    const lift = o.lift ?? 0.18;
    const front = board(id, w, hh, { y: lift + hh / 2, z: 0.012, kicker: o.kicker });
    const back = board(id, w, hh, { y: lift + hh / 2, z: -0.012, ry: Math.PI });
    back.material = front.material;
    g.add(front, back);
    if (o.posts !== false)
      for (const side of [-1, 1]) {
        MF.cyl(0.035, 0.045, lift + hh + 0.12, MF.PAL.woodDark, { x: side * (w / 2 + 0.03), y: (lift + hh + 0.12) / 2, parent: g, cast: true, seg: 6 });
      }
    return g;
  }
  function refresh() {
    for (const tex of state.textures) tex.redraw();
    state.listeners.forEach((f) => f());
  }
  const api = () => new URL((MF.assets && MF.assets.sponsorsApi) || "api/sponsors", document.baseURI).href;
  /** Appelle /api/sponsors : { ok, … } ou { ok: false, error } (jamais d'exception). */
  function call(body, key, query) {
    if (typeof fetch !== "function") return Promise.resolve({ ok: false, error: "offline" });
    const init = body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : { headers: key ? { "x-ads-key": key } : {}, cache: "no-store" };
    return fetch(api() + (query || ""), init)
      .then((r) => r.json().catch(() => ({ ok: false, error: r.status === 501 ? "no-store" : "http-" + r.status })))
      .catch(() => ({ ok: false, error: "offline" }));
  }
  function setAds(ads) {
    if (!ads || typeof ads !== "object") return;
    state.ads = { fair: ads.fair || null, top10: ads.top10 || null, games: ads.games && typeof ads.games === "object" ? ads.games : {} };
    refresh();
  }

  MF.sponsors = {
    CATALOG,
    get,
    of,
    paint,
    texture,
    board,
    banner,
    brand: (id) => {
      const s = get(id);
      return s.taken ? s.name.toUpperCase() : "YOUR BRAND HERE";
    },
    all: () => Object.keys(CATALOG).map(get),
    contact: () => state.contact,
    /** Le site accepte-t-il de publier (clé du propriétaire configurée) ? Le serveur répond-il ? */
    status: () => ({ open: state.open, online: state.online }),
    published,
    onChange: (fn) => state.listeners.push(fn),
    /** Aperçu local (ce navigateur seulement) d'une annonce sur une cible ; null pour l'enlever. */
    setPreview(target, ad) {
      if (ad && ad.name) state.preview[target] = { name: ad.name, tagline: ad.tagline || "", url: ad.url || "", image: ad.image || "", bg: ad.bg, fg: ad.fg };
      else delete state.preview[target];
      try {
        localStorage.setItem(PREVIEW, JSON.stringify(state.preview));
      } catch (error) {
        /* trop lourd pour le navigateur : l'aperçu ne sera pas gardé */
      }
      refresh();
    },
    previews: () => Object.keys(state.preview),
    /** Demande d'un visiteur : rangée en attente, le propriétaire décide. */
    request: (target, ad, contact) => call({ action: "request", target, ad, contact }),
    /** Publie (ou retire, ad = null) l'annonce d'une cible : clé du propriétaire. */
    publish: (target, ad, key) =>
      call({ action: "publish", target, ad, key }).then((r) => {
        if (r.ok) setAds(r.ads);
        return r;
      }),
    pending: (key) => call(null, key, "?pending=1"),
    decide: (id, approve, key) =>
      call({ action: approve ? "approve" : "reject", id, key }).then((r) => {
        if (r.ok) setAds(r.ads);
        return r;
      }),
    /** Applique un fichier de sponsors (déjà lu) : redessine toutes les bâches. */
    apply(json) {
      if (!json || typeof json !== "object") return;
      state.data = json.emplacements && typeof json.emplacements === "object" ? json.emplacements : {};
      const c = json.contact || {};
      state.contact = { texte: String(c.texte || ""), lien: /^(https?:|mailto:)/i.test(c.lien || "") ? c.lien : "" };
      state.loaded = true;
      refresh();
    },
    /** Lit /moulin2/sponsors.json et /api/sponsors (sans bloquer le jeu : les bâches se mettent à jour à l'arrivée). */
    load(url) {
      if (typeof fetch !== "function") return Promise.resolve();
      call(null).then((r) => {
        state.online = !!r.ok;
        state.open = !!r.open;
        if (r.ok) setAds(r.ads);
        else refresh();
      });
      return fetch(new URL(url || MF.assets.sponsors, document.baseURI).href, { cache: "no-cache" })
        .then((r) => (r.ok ? r.json() : null))
        .then((json) => MF.sponsors.apply(json))
        .catch(() => {});
    },
  };
})();
