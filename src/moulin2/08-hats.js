// La Fête du Moulin — les chapeaux.
//
// Chacun choisit son chapeau (profil) : le chapeau de paille d'origine du personnage, ou l'un des
// modèles ci-dessous, en volumes simples. Tous sont modelés pour une tête de 16,5 cm de rayon,
// posés sur le plan où reposait le bord du chapeau de paille (y = 0), l'avant vers +z ; fit() les
// met à la taille du personnage du moulin et les accroche à l'os de sa tête, à la place du chapeau.
//
//   MF.hats.list → [{ id, icon, name, ref }]      MF.hats.valid(id) → id connu (ou « straw »)
//   MF.hats.build(id, couleur) → groupe            MF.hats.fit(personnage, id, couleur) → groupe ou null
//   MF.hats.tick(temps) → fait tourner les hélices
(function () {
  "use strict";
  const MF = (globalThis.MoulinFete = globalThis.MoulinFete || {});
  const T = () => globalThis.THREE;
  const list = [
    { id: "straw", icon: "👒", name: "Straw hat", ref: "Lifestyle business" },
    { id: "cowboy", icon: "🤠", name: "Cowboy", ref: "Not my first rodeo" },
    { id: "tophat", icon: "🎩", name: "Top hat", ref: "Series A closed" },
    { id: "cap", icon: "🧢", name: "Dad cap", ref: "Make something people want" },
    { id: "beanie", icon: "🧶", name: "Beanie", ref: "Indie hacker uniform" },
    { id: "party", icon: "🥳", name: "Party cone", ref: "Launch day" },
    { id: "crown", icon: "👑", name: "Crown", ref: "#1 Product of the Day" },
    { id: "wizard", icon: "🧙", name: "Wizard", ref: "10x engineer" },
    { id: "propeller", icon: "🚁", name: "Propeller", ref: "First day at the big co" },
    { id: "hardhat", icon: "👷", name: "Hard hat", ref: "Build in public" },
    { id: "pirate", icon: "🏴‍☠️", name: "Pirate", ref: "Better a pirate than the navy" },
    { id: "chef", icon: "🧑‍🍳", name: "Chef", ref: "Let him cook" },
    { id: "grad", icon: "🎓", name: "Mortarboard", ref: "Proud dropout" },
    { id: "unicorn", icon: "🦄", name: "Unicorn", ref: "$1B valuation" },
    { id: "none", icon: "🚫", name: "No hat", ref: "Hair in the wind" },
  ];
  const byId = new Map(list.map((h) => [h.id, h]));
  const valid = (id) => (byId.has(id) ? id : "straw");
  const spinners = [];

  /** Calotte : la moitié haute d'une sphère (rien ne descend sur le visage). */
  function dome(r, material, o = {}) {
    const m = MF.mesh(new (T().SphereGeometry)(r, o.seg || 14, 7, o.from || 0, o.arc || Math.PI * 2, 0, Math.PI / 2), material, o);
    if (o.sy) m.scale.y = o.sy;
    return m;
  }

  function build(id, color) {
    id = valid(id);
    const g = MF.group({ name: "Chapeau_" + id });
    const tint = color || MF.PAL.red;
    const ink = "#1d1e22", gold = "#f2c230", cream = "#fff3d6";
    if (id === "straw") {
      MF.cyl(0.33, 0.33, 0.03, "#e9c46a", { y: 0.015, parent: g, seg: 16 });
      MF.cyl(0.15, 0.17, 0.13, "#e9c46a", { y: 0.085, parent: g, seg: 12 });
      MF.cyl(0.174, 0.174, 0.045, tint, { y: 0.05, parent: g, seg: 12 });
    } else if (id === "cowboy") {
      const felt = "#8a5a33";
      MF.cyl(0.36, 0.36, 0.022, felt, { y: 0.012, parent: g, seg: 18 }).scale.set(0.86, 1, 1.08);
      for (const side of [-1, 1]) MF.sphere(0.05, felt, { x: side * 0.295, y: 0.04, parent: g, seg: 8 }).scale.set(0.5, 0.9, 5.2); // bords relevés
      MF.cyl(0.135, 0.172, 0.19, felt, { y: 0.115, parent: g, seg: 14 });
      MF.sphere(0.135, felt, { y: 0.205, parent: g, seg: 12 }).scale.set(1, 0.22, 1);
      MF.box(0.05, 0.03, 0.2, "#6b4424", { y: 0.215, parent: g }); // le pli du dessus
      MF.cyl(0.176, 0.176, 0.035, tint, { y: 0.045, parent: g, seg: 14 });
      MF.cyl(0.025, 0.025, 0.012, gold, { y: 0.045, z: 0.176, rx: Math.PI / 2, parent: g, seg: 5 }); // étoile de shérif
    } else if (id === "tophat") {
      MF.cyl(0.27, 0.27, 0.02, ink, { y: 0.01, parent: g, seg: 18 });
      MF.cyl(0.17, 0.162, 0.3, ink, { y: 0.17, parent: g, seg: 16 });
      MF.cyl(0.173, 0.173, 0.055, tint, { y: 0.05, parent: g, seg: 16 });
    } else if (id === "cap") {
      dome(0.18, tint, { y: -0.005, parent: g, sy: 0.82 });
      dome(0.182, cream, { y: -0.005, parent: g, sy: 0.82, from: Math.PI / 2 - 0.62, arc: 1.24, seg: 6 }); // panneau de devant
      MF.cyl(0.15, 0.15, 0.02, ink, { y: 0.014, z: 0.2, rx: 0.14, parent: g, seg: 14 }).scale.set(1.08, 1, 1.2); // visière
      MF.sphere(0.02, ink, { y: 0.147, parent: g, seg: 6 });
    } else if (id === "beanie") {
      dome(0.184, tint, { y: 0.03, parent: g, sy: 1.02 });
      MF.cyl(0.188, 0.188, 0.07, cream, { y: 0.035, parent: g, seg: 14 });
      MF.sphere(0.052, cream, { y: 0.235, parent: g, seg: 8 });
    } else if (id === "party") {
      MF.cone(0.13, 0.36, tint, { y: 0.18, parent: g, seg: 14 });
      for (let i = 0; i < 3; i++) MF.cyl(0.118 - i * 0.036, 0.128 - i * 0.036, 0.028, i % 2 ? cream : gold, { y: 0.03 + i * 0.1, parent: g, seg: 14 });
      MF.sphere(0.04, gold, { y: 0.37, parent: g, seg: 8 });
      MF.torus(0.13, 0.012, cream, { y: 0.004, rx: Math.PI / 2, parent: g, seg: 16, tubeSeg: 5 });
    } else if (id === "crown") {
      const metal = MF.mat(gold, { emissive: "#7a5a00", emissiveIntensity: 0.35, side: "double" });
      MF.cyl(0.176, 0.166, 0.09, metal, { y: 0.045, parent: g, seg: 16, open: true });
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2, x = Math.sin(a) * 0.171, z = Math.cos(a) * 0.171;
        MF.cone(0.034, 0.1, metal, { x, y: 0.135, z, parent: g, seg: 4 });
        MF.sphere(0.017, i % 2 ? tint : "#e8402c", { x: x * 1.03, y: 0.05, z: z * 1.03, parent: g, seg: 6 });
      }
    } else if (id === "wizard") {
      const robe = "#4d3a9c";
      MF.cyl(0.31, 0.31, 0.02, robe, { y: 0.01, parent: g, seg: 18 });
      MF.cone(0.175, 0.34, robe, { y: 0.19, parent: g, seg: 14 });
      MF.cone(0.07, 0.2, robe, { y: 0.4, z: -0.045, rx: -0.55, parent: g, seg: 10 }); // la pointe retombe en arrière
      MF.cyl(0.178, 0.178, 0.04, tint, { y: 0.04, parent: g, seg: 14 });
      for (const [x, y, z] of [[0.09, 0.14, 0.1], [-0.07, 0.22, 0.07], [0.02, 0.1, -0.14], [-0.12, 0.12, -0.04]]) MF.sphere(0.018, gold, { x, y, z, parent: g, seg: 5 });
    } else if (id === "propeller") {
      const wedge = ["#e8402c", "#ffc93a", "#2f7fd8", "#2e9e5b", "#e8402c", "#ffc93a"];
      wedge.forEach((c, i) => dome(0.18, i === 4 ? tint : c, { y: 0, parent: g, sy: 0.86, from: (i / 6) * Math.PI * 2, arc: Math.PI / 3, seg: 3 }));
      MF.cyl(0.01, 0.01, 0.07, ink, { y: 0.185, parent: g, seg: 6 });
      const prop = MF.group({ y: 0.225, parent: g });
      prop.userData.live = true;
      MF.box(0.3, 0.008, 0.045, gold, { parent: prop });
      MF.box(0.045, 0.008, 0.3, "#e8402c", { parent: prop });
      MF.sphere(0.02, ink, { parent: prop, seg: 6 });
      g.userData.spin = prop;
      spinners.push(prop);
    } else if (id === "hardhat") {
      const shell = "#ffc93a";
      dome(0.188, shell, { y: 0.01, parent: g, sy: 0.88 });
      MF.cyl(0.205, 0.205, 0.016, shell, { y: 0.012, parent: g, seg: 16 });
      MF.cyl(0.12, 0.12, 0.016, shell, { y: 0.012, z: 0.15, parent: g, seg: 12 });
      MF.box(0.05, 0.03, 0.34, "#ffe08a", { y: 0.165, parent: g });
      MF.box(0.09, 0.05, 0.012, tint, { y: 0.08, z: 0.176, parent: g });
    } else if (id === "pirate") {
      const felt = "#2f3445";
      dome(0.165, ink, { y: 0.01, parent: g, sy: 0.8 });
      MF.cyl(0.235, 0.235, 0.02, ink, { y: 0.012, ry: Math.PI / 3, parent: g, seg: 3 });
      for (let i = 0; i < 3; i++) {
        // les trois bords relevés du tricorne, galonnés d'or
        const a = (i / 3) * Math.PI * 2 + Math.PI, side = MF.group({ ry: a, parent: g });
        MF.box(0.44, 0.14, 0.02, felt, { y: 0.075, z: 0.15, rx: -0.3, parent: side });
        MF.box(0.44, 0.018, 0.024, gold, { y: 0.142, z: 0.13, parent: side });
      }
      MF.sphere(0.036, cream, { y: 0.085, z: 0.158, parent: g, seg: 7 }); // tête de mort
      for (const r of [0.7, -0.7]) MF.box(0.1, 0.014, 0.014, cream, { y: 0.05, z: 0.166, rz: r, parent: g });
    } else if (id === "chef") {
      MF.cyl(0.172, 0.172, 0.15, "#ffffff", { y: 0.075, parent: g, seg: 14 });
      MF.sphere(0.205, "#ffffff", { y: 0.215, parent: g, seg: 12 }).scale.set(1, 0.6, 1);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        MF.sphere(0.085, "#f4f1ea", { x: Math.sin(a) * 0.13, y: 0.25, z: Math.cos(a) * 0.13, parent: g, seg: 7 });
      }
      MF.cyl(0.175, 0.175, 0.02, tint, { y: 0.02, parent: g, seg: 14 });
    } else if (id === "grad") {
      dome(0.176, ink, { y: 0.0, parent: g, sy: 0.6 });
      MF.box(0.44, 0.016, 0.44, ink, { y: 0.115, ry: Math.PI / 4, parent: g });
      MF.sphere(0.02, gold, { y: 0.13, parent: g, seg: 6 });
      MF.box(0.012, 0.012, 0.2, gold, { x: 0.07, y: 0.128, z: 0.07, ry: Math.PI / 4, parent: g });
      MF.box(0.03, 0.12, 0.03, tint, { x: 0.15, y: 0.07, z: 0.15, parent: g }); // le pompon
    } else if (id === "unicorn") {
      MF.torus(0.168, 0.014, cream, { y: 0.0, rx: Math.PI / 2, parent: g, seg: 18, tubeSeg: 5 });
      const horn = MF.group({ y: 0.05, z: 0.1, rx: 0.42, parent: g });
      MF.cone(0.042, 0.3, cream, { y: 0.15, parent: horn, seg: 9 });
      for (let i = 0; i < 4; i++) MF.torus(0.036 - i * 0.008, 0.007, gold, { y: 0.04 + i * 0.065, rx: Math.PI / 2 + 0.25, parent: horn, seg: 10, tubeSeg: 4 });
      for (const side of [-1, 1]) MF.cone(0.045, 0.1, "#ff8fb7", { x: side * 0.1, y: 0.11, z: 0.01, rz: -side * 0.3, parent: g, seg: 4 });
      // crinière arc-en-ciel, à l'arrière
      ["#e8402c", "#ff8a2a", "#ffc93a", "#2e9e5b", "#2f7fd8", "#7b4bd6"].forEach((c, i) => MF.sphere(0.045, i === 2 ? tint : c, { y: 0.14 - i * 0.045, z: -0.07 - i * 0.03, parent: g, seg: 6 }));
    }
    g.userData.hat = id;
    return MF.freeze ? MF.freeze(g) : g;
  }

  /**
   * Coiffe un exemplaire du personnage du moulin : cache son chapeau de paille et accroche le
   * chapeau choisi au même os, à la même place et à la même taille. « straw » : on remet l'original.
   * Renvoie le groupe ajouté (à retirer avant d'en changer), ou null.
   */
  function fit(frame, id, color) {
    const THREE = T(), orig = frame && frame.getObjectByName("Chapeau_de_paille");
    if (!orig || !orig.parent) return null;
    id = valid(id);
    orig.visible = id === "straw";
    if (id === "straw" || id === "none") return null;
    const parent = orig.parent;
    frame.updateMatrixWorld(true);
    // boîte du chapeau d'origine dans le repère de l'os, et rayon de sa calotte (le plus petit maillage)
    const inv = new THREE.Matrix4().copy(parent.matrixWorld).invert(), box = new THREE.Box3(), v = new THREE.Vector3();
    let band = Infinity;
    orig.traverse((o) => {
      if (!o.isMesh || !o.geometry) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      const b = o.geometry.boundingBox, m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld), own = new THREE.Box3();
      for (let i = 0; i < 8; i++) own.expandByPoint(v.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).applyMatrix4(m));
      box.union(own);
      const s = own.getSize(new THREE.Vector3()), wide = [s.x, s.y, s.z].sort((a, c) => c - a);
      band = Math.min(band, (wide[0] + wide[1]) / 4);
    });
    if (box.isEmpty()) return null;
    const size = box.getSize(new THREE.Vector3()), centre = box.getCenter(new THREE.Vector3());
    // l'axe le plus court de la boîte est la verticale du chapeau ; il pointe à l'opposé de l'os
    const axis = size.x <= size.y && size.x <= size.z ? "x" : size.y <= size.z ? "y" : "z";
    const up = new THREE.Vector3();
    up[axis] = centre[axis] >= 0 ? 1 : -1;
    // l'avant : celui du personnage (+z), ramené dans le plan du bord du chapeau
    const fwd = new THREE.Vector3(0, 0, 1).transformDirection(frame.matrixWorld).transformDirection(inv);
    fwd.addScaledVector(up, -fwd.dot(up));
    if (fwd.lengthSq() < 1e-6) fwd.set(axis === "z" ? 1 : 0, 0, axis === "z" ? 0 : 1);
    fwd.normalize();
    const right = new THREE.Vector3().crossVectors(up, fwd);
    const hat = build(id, color);
    hat.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, fwd));
    hat.position.copy(centre).addScaledVector(up, -size[axis] / 2);
    hat.scale.setScalar(band / 0.172); // calotte d'origine → calotte modelée (17,2 cm)
    hat.userData.live = true;
    parent.add(hat);
    return hat;
  }

  MF.hats = {
    list,
    valid,
    build,
    fit,
    /** Les hélices tournent (appelé à chaque image par la présence). */
    tick(time) {
      for (let i = spinners.length - 1; i >= 0; i--) {
        const p = spinners[i];
        if (!p.parent || !p.parent.parent) spinners.splice(i, 1);
        else p.rotation.y = time * 9;
      }
    },
  };
})();
