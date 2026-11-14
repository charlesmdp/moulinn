// La Fête du Moulin — emplacements de sponsors.
//
// Chaque jeu a des emplacements publicitaires (bâches le long du circuit, arche de départ, toile de
// fond du stand de tir, télécommande des voitures…). La liste des emplacements est ci-dessous ; qui
// occupe quoi est décrit dans un fichier à part, modifiable sans toucher au code :
// src/static/moulin2/sponsors.json (publié en /moulin2/sponsors.json).
//
//   {
//     "contact": { "texte": "Écris-moi sur X pour réserver", "lien": "https://x.com/…" },
//     "emplacements": {
//       "rc-arche": { "nom": "Acme", "accroche": "Des outils pour indés", "lien": "https://acme.dev",
//                     "fond": "#101828", "texte": "#ffffff", "logo": "moulin2/logos/acme.png", "prix": "200 €" }
//     }
//   }
//
// Un emplacement sans sponsor affiche « Votre marque ici ».
//
//   MF.sponsors.get(id) → { id, label, game, taken, name, tagline, url, bg, fg, logo, price }
//   MF.sponsors.texture(id, { w, h }) → texture (redessinée quand le fichier ou le logo arrive)
//   MF.sponsors.board(id, largeur, hauteur) → panneau simple face (à coller sur un mur, un stand)
//   MF.sponsors.banner(id, largeur, hauteur, { lift, posts }) → bâche double face entre deux piquets,
//       origine au sol, face vers +z
//   MF.sponsors.brand(id) → texte court pour la télécommande ; MF.sponsors.all() → tous les emplacements
(function () {
  "use strict";
  const MF = (globalThis.MoulinFete = globalThis.MoulinFete || {});
  const T = () => globalThis.THREE;

  // Catalogue des emplacements : identifiant → [où, jeu].
  const CATALOG = {
    "village-arche": ["Arche d'entrée de la fête", "fete"],
    "village-panneau": ["Grand panneau des jeux", "fete"],
    "rc-arche": ["Arche de départ du circuit", "rc"],
    "rc-bache-1": ["Bâche du circuit, ligne droite", "rc"],
    "rc-bache-2": ["Bâche du circuit, épingle", "rc"],
    "rc-bache-3": ["Bâche du circuit, descente", "rc"],
    "rc-bache-4": ["Bâche du circuit, cour du moulin", "rc"],
    "rc-telecommande": ["Télécommande des voitures", "rc"],
    "bateaux-ponton": ["Banderole du ponton", "bateaux"],
    "bateaux-bouees": ["Bouées du parcours", "bateaux"],
    "bateaux-telecommande": ["Télécommande des bateaux", "bateaux"],
    "golf-1": ["Bâche du trou n° 1", "golf"],
    "golf-2": ["Bâche du trou n° 2", "golf"],
    "golf-3": ["Bâche du trou n° 3", "golf"],
    "golf-4": ["Bâche du trou n° 4", "golf"],
    "golf-5": ["Bâche du trou n° 5", "golf"],
    "golf-6": ["Bâche du trou n° 6", "golf"],
    "golf-7": ["Bâche du trou n° 7", "golf"],
    "golf-8": ["Bâche du trou n° 8", "golf"],
    "golf-9": ["Bâche du trou n° 9", "golf"],
    "tir-fond": ["Toile de fond du stand de tir", "tir"],
    "tir-fronton": ["Fronton du stand de tir", "tir"],
    "canards-fronton": ["Fronton de la pêche aux canards", "canards"],
    "canards-bassin": ["Tour du bassin aux canards", "canards"],
    "autos-fronton": ["Fronton des auto-tamponneuses", "autos"],
    "autos-bandeau": ["Bandeau de la piste", "autos"],
    "citrouilles-fronton": ["Banderole du pas de tir", "citrouilles"],
    "citrouilles-cibles": ["Cibles flottantes", "citrouilles"],
    "drones-arche": ["Arche de départ des drones", "drones"],
    "drones-portes": ["Portes du parcours", "drones"],
    "drones-radio": ["Radiocommande des drones", "drones"],
  };
  const state = { data: {}, contact: { texte: "", lien: "" }, textures: [], logos: new Map(), loaded: false, listeners: [] };

  function get(id) {
    const cat = CATALOG[id] || [id, ""];
    const d = state.data[id] || {};
    const taken = !!(d.nom && String(d.nom).trim());
    return {
      id,
      label: cat[0],
      game: cat[1],
      taken,
      name: taken ? String(d.nom).trim() : "",
      tagline: d.accroche || "",
      url: /^https?:\/\//i.test(d.lien || "") ? d.lien : "",
      bg: d.fond || (taken ? "#1d2b4f" : MF.PAL.cream),
      fg: d.texte || (taken ? "#ffffff" : MF.PAL.ink),
      logo: d.logo || "",
      price: d.prix || "",
    };
  }

  function logoImage(src, onLoad) {
    if (!src) return null;
    let entry = state.logos.get(src);
    if (!entry) {
      entry = { img: new Image(), ok: false, waiters: [] };
      entry.img.crossOrigin = "anonymous";
      entry.img.onload = () => {
        entry.ok = true;
        entry.waiters.splice(0).forEach((f) => f());
      };
      entry.img.src = new URL(src, document.baseURI).href;
      state.logos.set(src, entry);
    }
    if (!entry.ok && onLoad) entry.waiters.push(onLoad);
    return entry.ok ? entry.img : null;
  }

  function draw(ctx, W, H, id, o) {
    const s = get(id);
    const pad = Math.round(H * 0.06);
    ctx.fillStyle = s.bg;
    ctx.fillRect(0, 0, W, H);
    if (!s.taken) {
      // emplacement libre : cadre en pointillés et invitation
      ctx.strokeStyle = MF.PAL.orange;
      ctx.lineWidth = Math.max(4, H * 0.035);
      ctx.setLineDash([H * 0.12, H * 0.08]);
      ctx.strokeRect(pad * 1.2, pad * 1.2, W - pad * 2.4, H - pad * 2.4);
      ctx.setLineDash([]);
      MF.fitText(ctx, "VOTRE MARQUE ICI", W / 2, H * 0.42, W - pad * 6, H * 0.38, { color: MF.PAL.red });
      MF.fitText(ctx, (o.kicker || s.label) + " · emplacement à réserver", W / 2, H * 0.76, W - pad * 6, H * 0.16, { color: MF.PAL.woodDark, font: "system-ui, sans-serif", weight: "700" });
      return;
    }
    const img = logoImage(s.logo, o.redraw);
    let textX = W / 2, textW = W - pad * 4;
    if (img) {
      // logo à gauche, dans un carré
      const size = H - pad * 3;
      const ratio = Math.min(size / img.width, size / img.height);
      const lw = img.width * ratio, lh = img.height * ratio;
      ctx.drawImage(img, pad * 1.5 + (size - lw) / 2, (H - lh) / 2, lw, lh);
      textX = pad * 2.5 + size + (W - pad * 4 - size) / 2;
      textW = W - pad * 5 - size;
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
    const tex = MF.canvasTexture(pxW, pxH, (ctx, W, H) => draw(ctx, W, H, id, opts));
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
    const front = board(id, w, hh, { y: lift + hh / 2, z: 0.012 });
    const back = board(id, w, hh, { y: lift + hh / 2, z: -0.012, ry: Math.PI });
    back.material = front.material;
    g.add(front, back);
    if (o.posts !== false)
      for (const side of [-1, 1]) {
        MF.cyl(0.035, 0.045, lift + hh + 0.12, MF.PAL.woodDark, { x: side * (w / 2 + 0.03), y: (lift + hh + 0.12) / 2, parent: g, cast: true, seg: 6 });
      }
    return g;
  }

  MF.sponsors = {
    CATALOG,
    get,
    texture,
    board,
    banner,
    brand: (id) => {
      const s = get(id);
      return s.taken ? s.name.toUpperCase() : "VOTRE MARQUE ICI";
    },
    all: () => Object.keys(CATALOG).map(get),
    contact: () => state.contact,
    onChange: (fn) => state.listeners.push(fn),
    /** Applique un fichier de sponsors (déjà lu) : redessine toutes les bâches. */
    apply(json) {
      if (!json || typeof json !== "object") return;
      state.data = json.emplacements && typeof json.emplacements === "object" ? json.emplacements : {};
      const c = json.contact || {};
      state.contact = { texte: String(c.texte || ""), lien: /^(https?:|mailto:)/i.test(c.lien || "") ? c.lien : "" };
      state.loaded = true;
      for (const tex of state.textures) tex.redraw();
      state.listeners.forEach((f) => f());
    },
    /** Lit /moulin2/sponsors.json (sans bloquer le jeu : les bâches se mettent à jour à l'arrivée). */
    load(url) {
      if (typeof fetch !== "function") return Promise.resolve();
      return fetch(new URL(url || MF.assets.sponsors, document.baseURI).href, { cache: "no-cache" })
        .then((r) => (r.ok ? r.json() : null))
        .then((json) => MF.sponsors.apply(json))
        .catch(() => {});
    },
  };
})();
