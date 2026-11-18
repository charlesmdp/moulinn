// La Fête du Moulin — les ordinateurs portables des visiteurs.
//
// Chacun choisit son ordinateur en arrivant. Il se porte dans le dos, comme un sac à dos (fermé,
// deux bretelles), et s'ouvre sur les genoux quand on s'assoit pour travailler face à l'étang.
// Huit modèles, tous en volumes simples (aucune image, aucune marque réelle).
//
//   MF.laptops.list → [{ id, name, blurb }]         MF.laptops.valid(id) → id connu (ou le premier)
//   MF.laptops.build(id, { open })   → ordinateur posé à plat, écran ouvert de 0 (fermé) à 1
//   MF.laptops.backpack(id)          → ordinateur fermé avec ses bretelles, à accrocher dans le dos
//   MF.laptops.thumbs(fn(vignettes)) → images des modèles (pour le choix à l'arrivée), une fois prêtes
(function () {
  "use strict";
  const MF = (globalThis.MoulinFete = globalThis.MoulinFete || {});
  const T = () => globalThis.THREE;
  const W = 0.36, D = 0.25;

  const list = [
    { id: "silver", name: "Silverbook", blurb: "Brushed aluminium, razor thin", shell: "#c9ced6", deck: "#b7bcc5", keys: "#2a2c33", tb: 0.012, tl: 0.008 },
    { id: "midnight", name: "Midnight Air", blurb: "Dark slate, feather light", shell: "#2c3140", deck: "#262a36", keys: "#11131a", tb: 0.011, tl: 0.007 },
    { id: "brick", name: "ThinkBrick", blurb: "Black, boxy, indestructible", shell: "#1d1e22", deck: "#232428", keys: "#0c0c0e", tb: 0.02, tl: 0.011 },
    { id: "stickers", name: "Sticker Bomb", blurb: "Every launch left a sticker", shell: "#e9e6df", deck: "#d9d6cf", keys: "#33343a", tb: 0.013, tl: 0.008 },
    { id: "gamer", name: "RGB Beast", blurb: "Glows in every colour", shell: "#15161b", deck: "#1c1d24", keys: "#08080b", tb: 0.022, tl: 0.012 },
    { id: "retro", name: "Beige Classic", blurb: "1994 called, it still boots", shell: "#d8cba7", deck: "#cdbf9a", keys: "#a59a7c", tb: 0.034, tl: 0.026 },
    { id: "pop", name: "Bubblegum", blurb: "Pink, loud and proud", shell: "#ff8fb7", deck: "#ffa6c6", keys: "#ffffff", tb: 0.013, tl: 0.008 },
    { id: "wood", name: "Bamboo Indie", blurb: "Hand-made, bootstrapped", shell: "#b98350", deck: "#a8733f", keys: "#3b2a18", tb: 0.015, tl: 0.01 },
  ];
  const byId = new Map(list.map((m) => [m.id, m]));
  const valid = (id) => (byId.has(id) ? id : list[0].id);

  /** Décor propre à chaque modèle, sur le dessus du capot (y = 0 est la surface, vers +y). */
  function decorate(m, lid) {
    const top = m.tl + 0.0015;
    const dot = (x, z, r, color, opts = {}) => MF.cyl(r, r, 0.003, color, Object.assign({ x, y: top, z, parent: lid, seg: opts.seg || 14 }, opts));
    if (m.id === "silver") dot(0, D / 2, 0.028, "#eef1f5");
    else if (m.id === "midnight") dot(0, D / 2, 0.026, "#8fa3c8");
    else if (m.id === "brick") {
      MF.box(0.07, 0.003, 0.02, "#3a3b41", { x: -W / 2 + 0.06, y: top, z: D - 0.035, ry: 0.5, parent: lid });
      dot(-W / 2 + 0.085, D - 0.025, 0.006, MF.PAL.red);
    } else if (m.id === "stickers") {
      const colors = [MF.PAL.red, MF.PAL.yellow, MF.PAL.blue, MF.PAL.green, MF.PAL.purple, MF.PAL.orange, MF.PAL.teal, MF.PAL.pink, MF.PAL.black];
      const rnd = MF.rng(77);
      for (let i = 0; i < 11; i++) {
        const x = (rnd() - 0.5) * (W - 0.07), z = 0.03 + rnd() * (D - 0.06), r = 0.016 + rnd() * 0.017;
        if (i % 3 === 0) MF.box(r * 1.9, 0.003, r * 1.3, colors[i % colors.length], { x, y: top + i * 0.0002, z, ry: rnd() * 3, parent: lid });
        else dot(x, z, r, colors[i % colors.length], { seg: i % 3 === 1 ? 14 : 5, y: top + i * 0.0002 });
      }
    } else if (m.id === "gamer") {
      const glow = (c) => MF.mat(c, { emissive: c, emissiveIntensity: 0.9 });
      MF.box(W - 0.04, 0.004, 0.008, glow("#19e0ff"), { y: top, z: 0.03, parent: lid });
      MF.box(0.008, 0.004, D - 0.07, glow("#ff2bd0"), { x: -W / 2 + 0.03, y: top, z: D / 2, parent: lid });
      MF.box(0.008, 0.004, D - 0.07, glow("#7dff3a"), { x: W / 2 - 0.03, y: top, z: D / 2, parent: lid });
      MF.cone(0.03, 0.004, glow("#19e0ff"), { y: top + 0.002, z: D / 2, parent: lid, seg: 3 });
    } else if (m.id === "retro") {
      [MF.PAL.green, MF.PAL.yellow, MF.PAL.orange, MF.PAL.red, MF.PAL.purple, MF.PAL.blue].forEach((c, i) => MF.box(0.05, 0.003, 0.006, c, { x: -W / 2 + 0.06, y: top, z: 0.04 + i * 0.007, parent: lid }));
    } else if (m.id === "pop") {
      dot(-0.014, D / 2 + 0.006, 0.02, "#ffffff");
      dot(0.014, D / 2 + 0.006, 0.02, "#ffffff");
      MF.cone(0.036, 0.004, "#ffffff", { y: top + 0.002, z: D / 2 - 0.022, ry: Math.PI / 3, parent: lid, seg: 3 });
    } else if (m.id === "wood") {
      for (let i = 1; i < 6; i++) MF.box(0.003, 0.002, D - 0.02, "#8a5a2c", { x: -W / 2 + (W * i) / 6, y: top, z: D / 2, parent: lid });
      dot(0, D / 2, 0.022, "#3fae4a", { seg: 6 });
    }
  }

  /** Ordinateur posé à plat : base au sol (y = 0), bord avant vers +z, charnière vers −z. */
  function build(id, o = {}) {
    const m = byId.get(valid(id));
    const g = MF.group({ name: "Ordinateur_" + m.id });
    MF.box(W, m.tb, D, m.shell, { y: m.tb / 2, parent: g, cast: true });
    MF.box(W - 0.05, 0.002, D * 0.46, m.keys, { y: m.tb + 0.001, z: -D * 0.16, parent: g });
    MF.box(W * 0.3, 0.002, D * 0.24, m.deck, { y: m.tb + 0.001, z: D * 0.3, parent: g });
    if (m.id === "brick") MF.sphere(0.006, MF.PAL.red, { y: m.tb + 0.004, z: -D * 0.14, parent: g, seg: 6 });
    if (m.id === "retro") MF.sphere(0.02, "#6e6a5c", { y: m.tb + 0.006, z: D * 0.3, parent: g, seg: 10 });
    const lid = MF.group({ y: m.tb, z: -D / 2, parent: g });
    MF.box(W, m.tl, D, m.shell, { y: m.tl / 2, z: D / 2, parent: lid, cast: true });
    // écran : la face intérieure du capot
    const screen = MF.mat("#9fd8ff", { emissive: "#7cc4ff", emissiveIntensity: 0.85, unique: true });
    MF.box(W - 0.03, 0.002, D - 0.035, "#0b0d12", { y: -0.001, z: D / 2, parent: lid });
    const panel = MF.box(W - 0.05, 0.002, D - 0.055, screen, { y: -0.0025, z: D / 2, parent: lid });
    // quelques « lignes de code » sur l'écran : de petites barres
    const rnd = MF.rng(m.id.length * 31 + 5);
    for (let i = 0; i < 7; i++) {
      const len = 0.05 + rnd() * 0.16;
      MF.box(len, 0.002, 0.009, ["#ffffff", "#1c2733", "#ffd166", "#1c2733"][i % 4], { x: -(W - 0.07) / 2 + len / 2 + (i % 3) * 0.012, y: -0.004, z: 0.04 + i * 0.024, parent: lid });
    }
    decorate(m, lid);
    const open = MF.clamp(o.open ?? 0, 0, 1);
    lid.rotation.x = -open * 1.92;
    panel.visible = open > 0.05;
    g.userData = { lid, screen, model: m, setOpen: (k) => ((lid.rotation.x = -MF.clamp(k, 0, 1) * 1.92), (panel.visible = k > 0.05)) };
    return g;
  }

  /**
   * Ordinateur fermé porté dans le dos, avec deux bretelles. Origine : le milieu du dos, à hauteur
   * des épaules ; l'avant du porteur est vers +z. chest : épaisseur du buste (m).
   */
  function backpack(id, o = {}) {
    const chest = o.chest || 0.25, scale = o.scale || 1.12;
    const g = MF.group({ name: "Ordinateur_sac_a_dos" });
    const laptop = build(id, { open: 0 });
    laptop.scale.setScalar(scale);
    laptop.rotation.x = -Math.PI / 2; // debout contre le dos, capot vers l'arrière, charnière en bas
    laptop.position.set(0, -0.2 - (D * scale) / 2, -0.012);
    g.add(laptop);
    const strap = MF.mat("#33363f");
    for (const side of [-1, 1]) {
      const x = side * 0.105;
      MF.box(0.038, 0.016, chest + 0.06, strap, { x, y: 0.035, z: chest / 2 + 0.012, parent: g }); // par-dessus l'épaule
      MF.box(0.038, 0.34, 0.016, strap, { x, y: -0.13, z: chest + 0.03, parent: g }); // devant le buste
      MF.box(0.038, 0.016, chest + 0.04, strap, { x, y: -0.3, z: chest / 2 + 0.01, parent: g }); // retour sous le bras
      MF.box(0.05, 0.03, 0.02, "#c9a227", { x, y: -0.05, z: chest + 0.035, parent: g }); // boucle
    }
    g.userData = { laptop, model: laptop.userData.model };
    return g;
  }

  /* ------------------------------------------------------------------ vignettes pour le choix */
  let thumbs = null;
  const waiting = [];
  function makeThumbs() {
    const THREE = T();
    if (!THREE || typeof document === "undefined") return null;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    } catch (e) {
      return null;
    }
    renderer.setSize(220, 160, false);
    renderer.outputEncoding = THREE.sRGBEncoding;
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x9a8f80, 1.0));
    const sun = new THREE.DirectionalLight(0xffffff, 0.9);
    sun.position.set(-1, 2.2, 1.4);
    scene.add(sun);
    const camera = new THREE.PerspectiveCamera(30, 220 / 160, 0.05, 10);
    camera.position.set(0.42, 0.42, 0.62);
    camera.lookAt(0, 0.09, -0.02);
    const out = {};
    for (const m of list) {
      const laptop = build(m.id, { open: 0.92 });
      laptop.rotation.y = -0.5;
      scene.add(laptop);
      renderer.render(scene, camera);
      try {
        out[m.id] = renderer.domElement.toDataURL("image/png");
      } catch (e) {}
      scene.remove(laptop);
    }
    renderer.dispose();
    if (renderer.forceContextLoss) renderer.forceContextLoss();
    return out;
  }

  MF.laptops = {
    list: list.map((m) => ({ id: m.id, name: m.name, blurb: m.blurb, color: m.shell })),
    valid,
    build,
    backpack,
    size: { w: W, d: D },
    /** Vignettes des modèles (dessinées une seule fois, à la demande) : fn({ id: image }). */
    thumbs(fn) {
      if (thumbs) return fn(thumbs);
      waiting.push(fn);
      if (waiting.length > 1) return;
      setTimeout(() => {
        thumbs = makeThumbs() || {};
        for (const f of waiting.splice(0)) f(thumbs);
      }, 30);
    },
  };
})();
