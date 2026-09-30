// Moulin V32 — atelier simplifié.
//
// Les outils de la V31 restent tous là, mais rangés en quatre onglets à grandes icônes
// (Relief · Chemins · Plantes & objets · Arbres) ; Annuler / Rétablir restent visibles
// et les réglages fins passent dans des sections repliées.
//
// Nouvel outil « Chemin taillé dans la pente » : on pose les points du chemin entre les
// arbres ; le chemin reste de niveau en travers et entaille la pente du côté haut
// (talus), sans creuser le côté bas, comme une route de montagne. Aperçu dans la scène,
// puis une seule étape (relief + tapis de feuilles) qu'« Annuler » défait d'un coup.
(function () {
  "use strict";
  const V32 = globalThis.MoulinV32;

  const ICONS = {
    relief: '<path d="M2.5 19.5 9 9l4 6 3-4 5.5 8.5Z"/><path d="M7.2 12 9 13.5l1.6-1.5"/>',
    path: '<path d="M6 21c0-4 5-5 5-9s-4-4-4-8"/><path d="M14 21c0-4 5-5 5-9s-4-4-4-8"/>',
    plant: '<path d="M12 21v-8"/><path d="M12 13c0-4 3-6.5 7-6.5 0 4-3 6.5-7 6.5Z"/><path d="M12 15c0-3.2-2.4-5.3-5.8-5.3 0 3.2 2.4 5.3 5.8 5.3Z"/>',
    tree: '<path d="M12 21v-5"/><path d="M12 3 5.5 12h3L5 16.5h14L15.5 12h3Z"/>',
    raise: '<path d="M3 19h18"/><path d="M5 19c2.5-7 11.5-7 14 0"/><path d="M12 11V4M9 6.5 12 3.5l3 3"/>',
    lower: '<path d="M3 9h5c1.5 6 6.5 6 8 0h5"/><path d="M12 3v7M9 7.5l3 3 3-3"/><path d="M3 19h18"/>',
    flatten: '<path d="M3 16h18"/><path d="M3 20h18"/><path d="M6 11c2-4 4-4 6 0s4 4 6 0"/>',
    smooth: '<path d="M3 17c3-6 6-6 9 0s6 6 9 0"/><path d="M3 11c3-3 6-3 9 0s6 3 9 0" opacity=".5"/>',
    undo: '<path d="M9 7 4 12l5 5"/><path d="M4 12h10a6 6 0 0 1 0 12h-3" transform="translate(0 -6)"/>',
    redo: '<path d="m15 7 5 5-5 5"/><path d="M20 12H10a6 6 0 0 0 0 12h3" transform="translate(0 -6)"/>',
    trash: '<path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13"/>',
    back: '<path d="M10 7 5 12l5 5"/><path d="M5 12h14"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    cut: '<path d="M3 20h8l10-12"/><path d="M11 20V14l4-5"/><path d="M3 14h8"/>',
  };
  const icon = (name, size = 20) =>
    `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ""}</svg>`;

  // --- Chemin taillé : calcul du profil ---------------------------------------------------
  /**
   * points : [[x, z], …] posés par l'utilisateur ; width : largeur (m) ;
   * heightAt(x, z) : relief actuel. Renvoie le tracé échantillonné, le niveau du chemin
   * et la fonction de hauteur voulue pour chaque sommet du terrain.
   */
  function planBench(THREE, points, width, heightAt) {
    const curve = new THREE.CatmullRomCurve3(
      points.map(([x, z]) => new THREE.Vector3(x, 0, z)),
      false,
      "centripetal",
    );
    const length = curve.getLength();
    const count = Math.max(2, Math.ceil(length / 0.25));
    const half = width / 2;
    const samples = [];
    for (let i = 0; i <= count; i++) {
      const t = i / count;
      const p = curve.getPointAt(t);
      const tangent = curve.getTangentAt(t);
      const nx = -tangent.z;
      const nz = tangent.x;
      const left = heightAt(p.x + nx * (half + 0.9), p.z + nz * (half + 0.9));
      const right = heightAt(p.x - nx * (half + 0.9), p.z - nz * (half + 0.9));
      // Côté haut : +1 à gauche, -1 à droite. Le chemin prend la hauteur de son bord bas :
      // il n'entaille que le côté haut.
      const up = left >= right ? 1 : -1;
      const lowEdge = heightAt(p.x - up * nx * half, p.z - up * nz * half);
      const centre = heightAt(p.x, p.z);
      const cross = Math.abs(left - right) / (width + 1.8);
      const blend = Math.min(1, Math.max(0, (cross - 0.04) / 0.2));
      samples.push({ x: p.x, z: p.z, nx, nz, s: t * length, up, level: centre + (lowEdge - centre) * blend });
    }
    // Profil en long adouci (fenêtre de ±2 m, deux passes) puis pente limitée à 18 %.
    for (let pass = 0; pass < 2; pass++) {
      const levels = samples.map((s) => s.level);
      for (let i = 0; i < samples.length; i++) {
        let sum = 0;
        let n = 0;
        for (let k = Math.max(0, i - 8); k <= Math.min(samples.length - 1, i + 8); k++) {
          sum += levels[k];
          n++;
        }
        samples[i].level = sum / n;
      }
    }
    const maxGrade = 0.18;
    for (let i = 1; i < samples.length; i++) {
      const ds = samples[i].s - samples[i - 1].s;
      samples[i].level = Math.min(samples[i - 1].level + maxGrade * ds, Math.max(samples[i - 1].level - maxGrade * ds, samples[i].level));
    }
    for (let i = samples.length - 2; i >= 0; i--) {
      const ds = samples[i + 1].s - samples[i].s;
      samples[i].level = Math.min(samples[i + 1].level + maxGrade * ds, Math.max(samples[i + 1].level - maxGrade * ds, samples[i].level));
    }

    const reach = half + 3.4;
    let x0 = Infinity;
    let x1 = -Infinity;
    let z0 = Infinity;
    let z1 = -Infinity;
    const grid = new Map();
    samples.forEach((s, i) => {
      x0 = Math.min(x0, s.x - reach);
      x1 = Math.max(x1, s.x + reach);
      z0 = Math.min(z0, s.z - reach);
      z1 = Math.max(z1, s.z + reach);
      const key = Math.floor(s.x / 2) + ":" + Math.floor(s.z / 2);
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(i);
    });
    const cellReach = Math.ceil(reach / 2) + 1;
    function nearest(x, z) {
      const gx = Math.floor(x / 2);
      const gz = Math.floor(z / 2);
      let best = -1;
      let bestD = Infinity;
      for (let dx = -cellReach; dx <= cellReach; dx++)
        for (let dz = -cellReach; dz <= cellReach; dz++) {
          const list = grid.get(gx + dx + ":" + (gz + dz));
          if (!list) continue;
          for (const i of list) {
            const d = (x - samples[i].x) ** 2 + (z - samples[i].z) ** 2;
            if (d < bestD) {
              bestD = d;
              best = i;
            }
          }
        }
      return best;
    }
    function target(x, z, current) {
      const i = nearest(x, z);
      if (i < 0) return null;
      const s = samples[i];
      const d = (x - s.x) * s.nx + (z - s.z) * s.nz;
      const along = (x - s.x) * -s.nz + (z - s.z) * s.nx;
      const ad = Math.abs(d);
      if (ad > reach || Math.abs(along) > 0.6) return null;
      // Raccord doux aux deux bouts du chemin.
      const ends = Math.min(1, s.s / 1.2, (length - s.s) / 1.2);
      if (ends <= 0) return null;
      let goal;
      if (ad <= half) {
        goal = s.level + 0.02 * (1 - (d / half) ** 2);
      } else if (Math.sign(d) === s.up) {
        // Talus du côté haut : on entaille seulement là où le sol dépasse la pente du talus.
        goal = s.level + (ad - half) * 1.25;
        if (goal >= current) return null;
      } else {
        // Côté bas : un simple épaulement si le sol est plus bas que le bord du chemin.
        goal = s.level - (ad - half) * 1.6;
        if (goal <= current) return null;
      }
      return current + (goal - current) * ends;
    }
    return { samples, length, bounds: { x0, x1, z0, z1 }, target };
  }

  V32.register(
    "atelier",
    function (context) {
      const { THREE, game, hooks } = context;
      const root = hooks.root;
      const panel = root.querySelector("[data-editor-panel]");
      const editor = game.editor;
      if (!panel || !editor) return null;
      panel.classList.add("v32-atelier");
      const $ = (selector) => panel.querySelector(selector);
      const fieldsetOf = (selector) => $(selector)?.closest("fieldset");
      // Panneaux d'outils de premier niveau (certains en contiennent d'autres).
      const toolPanels = (...tools) =>
        [...panel.querySelectorAll("[data-tool-panel]")].filter(
          (el) =>
            !el.parentElement.closest("[data-tool-panel]") &&
            el.dataset.toolPanel.split(/\s+/).some((tool) => tools.includes(tool)),
        );

      // --- Onglets --------------------------------------------------------------------
      const TABS = [
        { id: "relief", label: "Relief", icon: "relief", hint: "Choisis un geste puis glisse sur le sol." },
        { id: "chemins", label: "Chemins", icon: "path", hint: "Pose les points du chemin, puis taille-le." },
        { id: "plantes", label: "Plantes & objets", icon: "plant", hint: "Choisis un modèle, puis touche le sol." },
        { id: "arbres", label: "Arbres", icon: "tree", hint: "Touche un arbre pour le régler ou le déplacer." },
      ];
      const tabBar = document.createElement("div");
      tabBar.className = "v32-tabs";
      tabBar.setAttribute("role", "tablist");
      const panes = {};
      for (const tab of TABS) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "v32-tab";
        button.dataset.v32Tab = tab.id;
        button.setAttribute("role", "tab");
        button.innerHTML = `${icon(tab.icon, 22)}<span>${tab.label}</span>`;
        tabBar.append(button);
        const pane = document.createElement("section");
        pane.className = "v32-pane";
        pane.dataset.v32Pane = tab.id;
        pane.innerHTML = `<p class="v32-pane-hint">${tab.hint}</p>`;
        panes[tab.id] = pane;
      }

      // En-tête : titre, annuler / rétablir en icônes, déplacer la vue.
      const header = $(".panel-title");
      const history = $(".history-actions");
      const navigate = $(".game19-navigate");
      const undo = $("[data-undo]");
      const redo = $("[data-redo]");
      if (undo) undo.innerHTML = `${icon("undo", 18)}<span>Annuler</span>`;
      if (redo) redo.innerHTML = `${icon("redo", 18)}<span>Rétablir</span>`;
      const badge = $(".editor-badge");
      if (badge) badge.remove();
      header?.after(tabBar);
      if (history) tabBar.after(history);
      const status = $("[data-editor-status]");
      if (history && status) history.after(status);
      const body = document.createElement("div");
      body.className = "v32-panes";
      (status || history || tabBar).after(body);
      for (const tab of TABS) body.append(panes[tab.id]);
      if (navigate) body.after(navigate);

      // Relief : quatre gestes en grand, le reste replié.
      const reliefSet = fieldsetOf("[data-tool=raise]");
      if (reliefSet) {
        const legend = reliefSet.querySelector("legend");
        if (legend) legend.textContent = "Modeler les collines";
        const grid = reliefSet.querySelector(".tool-grid");
        grid?.classList.add("v32-big-tools");
        for (const [tool, name, label] of [
          ["raise", "raise", "Monter"],
          ["lower", "lower", "Creuser"],
          ["flatten", "flatten", "Aplanir"],
          ["smooth", "smooth", "Lisser"],
        ]) {
          const button = reliefSet.querySelector(`[data-tool=${tool}]`);
          if (button) button.innerHTML = `${icon(name, 26)}<span>${label}</span>`;
        }
        const more = document.createElement("details");
        more.className = "v32-more";
        more.innerHTML = "<summary>Plus d’outils de relief</summary>";
        const moreGrid = document.createElement("div");
        moreGrid.className = "tool-grid two";
        for (const tool of ["ramp", "terrace", "restore"]) {
          const button = reliefSet.querySelector(`[data-tool=${tool}]`);
          if (button) moreGrid.append(button);
        }
        more.append(moreGrid);
        panes.relief.append(reliefSet);
        for (const el of toolPanels("raise", "lower", "flatten", "smooth", "ramp", "terrace", "restore")) panes.relief.append(el);
        panes.relief.append(more);
        const note = $("[data-terrain-resolution-note]");
        if (note) panes.relief.append(note);
        // Réglages fins du pinceau repliés.
        const brush = panel.querySelector('[data-tool-panel="raise lower flatten smooth restore"]');
        const precise = brush?.querySelector(".editor-precision-grid");
        const falloff = panel.querySelector('[data-tool-panel="raise lower flatten smooth ramp terrace restore"]');
        if (brush && precise) {
          const fine = document.createElement("details");
          fine.className = "v32-more v32-fine";
          fine.innerHTML = "<summary>Réglages fins</summary>";
          fine.append(precise);
          if (falloff) {
            const field = falloff.querySelector(".field");
            if (field) fine.append(field);
            falloff.remove();
          }
          brush.append(fine);
        }
        const shoreSet = fieldsetOf("[data-tool=shore]");
        if (shoreSet) {
          panes.relief.append(shoreSet);
          for (const el of toolPanels("shore")) panes.relief.append(el);
        }
      }

      // Plantes & objets.
      const catalog = $(".game19-catalog");
      if (catalog) panes.plantes.append(catalog);
      for (const el of toolPanels("object", "scatter")) panes.plantes.append(el);
      const objectDetails = $("[data-object-details]");
      if (objectDetails) panes.plantes.append(objectDetails);
      const objectIndex = $(".game19-object-index");
      if (objectIndex) panes.plantes.append(objectIndex);

      // Arbres.
      const treeSet = fieldsetOf("[data-tool=select]");
      if (treeSet) {
        const legend = treeSet.querySelector("legend");
        if (legend) legend.textContent = "Arbres";
        panes.arbres.append(treeSet);
      }
      for (const el of toolPanels("add", "select")) if (!panes.relief.contains(el)) panes.arbres.append(el);

      // Chemins : le nouvel outil en tête, puis les sentiers de feuilles.
      const bench = document.createElement("fieldset");
      bench.className = "v32-bench";
      bench.innerHTML = `<legend>Chemin taillé dans la pente</legend>
        <p class="hint">Touche le sol pour poser les points du chemin, entre les arbres. Il reste de niveau en travers : il entaille la pente du côté haut et laisse le côté bas intact.</p>
        <button type="button" class="btn wide v32-bench-start" data-v32-bench aria-pressed="false">${icon("cut", 20)}<span>Tracer un chemin taillé</span></button>
        <label class="slider-field"><span>Largeur <output data-v32-bench-width-value>1,4 m</output></span><input type="range" min=".8" max="3" step=".1" value="1.4" data-v32-bench-width></label>
        <p class="v32-bench-status" data-v32-bench-status>Aucun point.</p>
        <div class="tool-grid two">
          <button type="button" class="btn" data-v32-bench-back disabled>${icon("back", 18)}<span>Dernier point</span></button>
          <button type="button" class="btn" data-v32-bench-clear disabled>${icon("trash", 18)}<span>Effacer</span></button>
        </div>
        <button type="button" class="btn wide primary" data-v32-bench-apply disabled>${icon("check", 18)}<span>Tailler le chemin</span></button>`;
      panes.chemins.append(bench);
      const pathSet = fieldsetOf("[data-tool=path]");
      if (pathSet) {
        const legend = pathSet.querySelector("legend");
        if (legend) legend.textContent = "Sentier de feuilles (sans toucher au relief)";
        panes.chemins.append(pathSet);
      }
      for (const el of toolPanels("path")) panes.chemins.append(el);
      const pathSelection = $("[data-path-selection]");
      if (pathSelection) panes.chemins.append(pathSelection);
      const pathIndex = $(".paths-index21");
      if (pathIndex) {
        pathIndex.open = false;
        panes.chemins.append(pathIndex);
      }

      // Sauvegarde repliée en bas.
      const save = $(".save-box");
      if (save) {
        const box = document.createElement("details");
        box.className = "v32-more v32-save";
        box.innerHTML = "<summary>Sauvegarde et partage</summary>";
        box.append(save);
        panel.append(box);
      }

      // --- Outil chemin taillé ---------------------------------------------------------
      const benchButton = bench.querySelector("[data-v32-bench]");
      const widthInput = bench.querySelector("[data-v32-bench-width]");
      const widthValue = bench.querySelector("[data-v32-bench-width-value]");
      const benchStatus = bench.querySelector("[data-v32-bench-status]");
      const backButton = bench.querySelector("[data-v32-bench-back]");
      const clearButton = bench.querySelector("[data-v32-bench-clear]");
      const applyButton = bench.querySelector("[data-v32-bench-apply]");
      const navigateBox = root.querySelector("[data-editor-navigate]");
      const bench32 = { active: false, points: [], plan: null, navigateBefore: false };
      const preview = new THREE.Group();
      preview.name = "Apercu_chemin_taille_v32";
      preview.userData.exportSkip = true;
      preview.userData.editorHelper = true;
      game.scene.add(preview);
      const surfaceMaterial = new THREE.MeshBasicMaterial({ color: 0xc8a46a, transparent: true, opacity: 0.62, depthWrite: false, side: THREE.DoubleSide });
      const cutMaterial = new THREE.MeshBasicMaterial({ color: 0xe8793a, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide });
      const keepMaterial = new THREE.MeshBasicMaterial({ color: 0x55c27a, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide });
      const pointMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false });
      const pointGeometry = new THREE.SphereGeometry(0.16, 12, 8);
      for (const material of [surfaceMaterial, cutMaterial, keepMaterial, pointMaterial]) material.toneMapped = false;

      function ribbon(samples, from, to, heightOf, material) {
        const positions = [];
        for (let i = 0; i < samples.length - 1; i++) {
          const a = samples[i];
          const b = samples[i + 1];
          const quad = [
            [a, from],
            [a, to],
            [b, to],
            [a, from],
            [b, to],
            [b, from],
          ];
          for (const [s, offset] of quad) {
            const side = typeof offset === "function" ? offset(s) : offset;
            positions.push(s.x + s.nx * side, heightOf(s, side), s.z + s.nz * side);
          }
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
        const mesh = new THREE.Mesh(geometry, material);
        mesh.renderOrder = 9;
        return mesh;
      }

      function clearPreview() {
        for (const child of [...preview.children]) {
          preview.remove(child);
          if (child.geometry !== pointGeometry) child.geometry.dispose();
        }
      }

      function refresh() {
        const width = Number(widthInput.value);
        widthValue.textContent = width.toFixed(1).replace(".", ",") + " m";
        clearPreview();
        const points = bench32.points;
        bench32.plan = points.length >= 2 ? planBench(THREE, points, width, game.terrainHeight) : null;
        for (const [x, z] of points) {
          const marker = new THREE.Mesh(pointGeometry, pointMaterial);
          marker.position.set(x, game.terrainHeight(x, z) + 0.12, z);
          marker.renderOrder = 10;
          preview.add(marker);
        }
        const plan = bench32.plan;
        if (plan) {
          const half = width / 2;
          const lift = 0.05;
          preview.add(ribbon(plan.samples, -half, half, (s) => s.level + lift, surfaceMaterial));
          // Liseré orange : côté entaillé (talus) ; vert : côté laissé intact.
          preview.add(ribbon(plan.samples, (s) => s.up * half, (s) => s.up * (half + 0.18), (s) => s.level + lift + 0.02, cutMaterial));
          preview.add(ribbon(plan.samples, (s) => -s.up * half, (s) => -s.up * (half + 0.18), (s) => s.level + lift + 0.02, keepMaterial));
          let rise = 0;
          for (let i = 1; i < plan.samples.length; i++) rise += Math.abs(plan.samples[i].level - plan.samples[i - 1].level);
          const grade = plan.length > 0 ? (Math.abs(plan.samples.at(-1).level - plan.samples[0].level) / plan.length) * 100 : 0;
          benchStatus.textContent =
            points.length + " points · " + plan.length.toFixed(1).replace(".", ",") + " m · pente moyenne " + Math.round(grade) + " %";
        } else {
          benchStatus.textContent = points.length ? "1 point : pose le suivant." : bench32.active ? "Touche le sol pour poser le premier point." : "Aucun point.";
        }
        backButton.disabled = !points.length;
        clearButton.disabled = !points.length;
        applyButton.disabled = !plan;
        hooks.markDirty();
      }

      function setBench(active) {
        if (bench32.active === active) return;
        bench32.active = active;
        benchButton.setAttribute("aria-pressed", String(active));
        panel.dataset.v32Bench = String(active);
        if (active) {
          // Les outils de la V31 sont suspendus ; la vue reste libre au glisser.
          bench32.navigateBefore = navigateBox ? navigateBox.checked : false;
          if (navigateBox && !navigateBox.checked) {
            navigateBox.checked = true;
            navigateBox.dispatchEvent(new Event("change", { bubbles: true }));
          }
        } else if (navigateBox && navigateBox.checked !== bench32.navigateBefore) {
          navigateBox.checked = bench32.navigateBefore;
          navigateBox.dispatchEvent(new Event("change", { bubbles: true }));
        }
        preview.visible = active || bench32.points.length > 0;
        refresh();
      }

      benchButton.addEventListener("click", () => setBench(!bench32.active));
      widthInput.addEventListener("input", refresh);
      backButton.addEventListener("click", () => {
        bench32.points.pop();
        refresh();
      });
      clearButton.addEventListener("click", () => {
        bench32.points = [];
        refresh();
      });
      applyButton.addEventListener("click", () => {
        const plan = bench32.plan;
        if (!plan) return;
        const width = Number(widthInput.value);
        const result = editor.benchPath32(bench32.points, width, { bounds: plan.bounds, target: plan.target });
        if (!result || !result.ok) {
          benchStatus.textContent =
            result?.reason === "water"
              ? "Le chemin traverse de l’eau ou de la maçonnerie : déplace ses points."
              : "Impossible de tailler ce chemin ici.";
          return;
        }
        const removed = (result.removed?.trees || 0) + (result.removed?.plants || 0);
        bench32.points = [];
        refresh();
        benchStatus.textContent =
          "Chemin taillé (" + plan.length.toFixed(1).replace(".", ",") + " m)" +
          (removed ? " · " + removed + " végétaux retirés du passage" : "") +
          ". « Annuler » le défait.";
        hooks.invalidate();
      });

      // Touchers dans la scène : un appui bref pose un point (un glisser tourne la vue).
      let press = null;
      const canvas = game.renderer.domElement;
      canvas.addEventListener(
        "pointerdown",
        (event) => {
          if (!bench32.active || hooks.getMode() !== "editor" || event.button !== 0) return;
          press = { x: event.clientX, y: event.clientY, time: performance.now(), id: event.pointerId };
        },
        true,
      );
      canvas.addEventListener(
        "pointerup",
        (event) => {
          if (!press || press.id !== event.pointerId) return;
          const tap = Math.hypot(event.clientX - press.x, event.clientY - press.y) < 7 && performance.now() - press.time < 600;
          press = null;
          if (!tap || !bench32.active) return;
          const point = editor.groundPoint(event);
          if (!point) return;
          if (!editor.terrainAllowed(point.x, point.z)) {
            benchStatus.textContent = "Ce point est sur l’eau, une berge ou un bâtiment : choisis le terrain libre.";
            return;
          }
          const last = bench32.points.at(-1);
          if (last && Math.hypot(point.x - last[0], point.z - last[1]) < 0.4) return;
          if (bench32.points.length >= 60) return;
          bench32.points.push([+point.x.toFixed(3), +point.z.toFixed(3)]);
          refresh();
        },
        true,
      );

      // Accès direct (essais automatisés, console) : mêmes effets qu'un toucher au sol.
      V32.atelier = {
        addPoint(x, z) {
          bench32.points.push([x, z]);
          refresh();
        },
        apply: () => applyButton.click(),
        state: bench32,
      };

      // --- Choix d'onglet ----------------------------------------------------------------
      const DEFAULT_TOOL = { relief: "raise", plantes: "object", arbres: "select" };
      function showTab(id, activateTool = true) {
        for (const button of tabBar.querySelectorAll(".v32-tab")) {
          const on = button.dataset.v32Tab === id;
          button.setAttribute("aria-selected", String(on));
          button.classList.toggle("is-active", on);
        }
        for (const [key, pane] of Object.entries(panes)) pane.hidden = key !== id;
        panel.dataset.v32Tab = id;
        V32.store.set("atelier-tab", id);
        if (status) status.textContent = "";
        if (id !== "chemins") setBench(false);
        if (!activateTool) return;
        if (id === "chemins") {
          setBench(true);
          return;
        }
        const tool = DEFAULT_TOOL[id];
        const button = tool && panel.querySelector(`[data-tool=${tool}]`);
        if (button && button.getAttribute("aria-pressed") !== "true") button.click();
      }
      tabBar.addEventListener("click", (event) => {
        const button = event.target.closest(".v32-tab");
        if (button) showTab(button.dataset.v32Tab);
      });
      // Un outil choisi ailleurs (raccourci, V31) ouvre le bon onglet.
      panel.addEventListener("click", (event) => {
        const tool = event.target.closest("[data-tool]")?.dataset.tool;
        if (!tool) return;
        setBench(false);
        const owner = Object.entries(panes).find(([, pane]) => pane.contains(event.target.closest("[data-tool]")));
        if (owner && panel.dataset.v32Tab !== owner[0]) showTab(owner[0], false);
      });
      showTab(V32.store.get("atelier-tab", "relief"), false);
      let lastMode = hooks.getMode();
      return {
        update() {
          // En entrant dans l'atelier, l'outil de l'onglet ouvert est prêt à servir.
          const mode = hooks.getMode();
          if (mode !== lastMode) {
            if (mode === "editor") showTab(panel.dataset.v32Tab || "relief", true);
            else setBench(false);
            lastMode = mode;
          }
          // Aperçu masqué hors de l'atelier.
          const visible = mode === "editor" && (bench32.active || bench32.points.length > 0);
          if (preview.visible !== visible) {
            preview.visible = visible;
            return true;
          }
          return false;
        },
        planBench: (points, width) => planBench(THREE, points, width, game.terrainHeight),
      };
    },
    65,
  );
})();
