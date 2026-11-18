// Moulin V32 — atelier : gommer ou ajouter des berges.
//
// Onglet Relief, section « Berges » : deux pinceaux que l'on pose d'un toucher au sol.
//  - Gommer : retire, dans le cercle, tout ce qui fait une berge (terre visible au bord
//    de l'eau, lèvre herbeuse, roseaux, carex, iris, reines-des-prés, salicaires, joncs,
//    rochers et pierres de berge) ; la prairie reprend jusqu'à l'eau.
//  - Ajouter : pose une berge naturelle le long de l'eau dans le cercle (terre humide,
//    touffes de roseaux, carex, iris jaunes, pierres).
// Les gestes sont gardés dans le navigateur et rejoués à l'ouverture ; « Annuler » défait
// le dernier geste, « Tout rétablir » rend les berges d'origine.
(function () {
  "use strict";
  const V32 = globalThis.MoulinV32;

  const MERGED = ["Terre_visible_au_bord_des_berges", "Levre_herbeuse_des_berges", "Herbes_et_carex_des_berges", "Pierres_naturelles_des_berges", "Joncs_et_iris_du_pont"];
  const INSTANCED = /^(Rochers_de_berge|Roseaux_en_groupes_irreguliers|Pierres_immergees_des_berges|reed_Roseaux|Carex|Iris_jaunes|Reine_des_pres|Salicaires|Berge_ajoutee_v32)/;
  const KEY = "berges";
  const ICON = {
    erase: '<path d="m7 21-4-4L14 6l6 6-9 9Z"/><path d="M11 21h10"/><path d="m9.5 9.5 6 6"/>',
    add: '<path d="M4 18c3-1 5-4 8-4s5 3 8 4"/><path d="M8 14V7M12 13V4M16 14V8"/>',
    undo: '<path d="M9 7 4 12l5 5"/><path d="M4 12h10a6 6 0 0 1 0 12h-3" transform="translate(0 -6)"/>',
    reset: '<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v5h5"/>',
  };
  const icon = (name, size = 20) =>
    `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name]}</svg>`;
  // Gestes relus (stockage local ou fichier importé) : on ne garde que des gestes valides.
  const finite = (v) => typeof v === "number" && Number.isFinite(v);
  const sanitize = (list) =>
    Array.isArray(list)
      ? list
          .filter((s) => s && (s.m === "erase" || s.m === "add") && finite(s.x) && finite(s.z) && Math.abs(s.x) < 5000 && Math.abs(s.z) < 5000 && finite(s.r) && s.r >= 0.5 && s.r <= 12)
          .slice(0, 4000)
          .map((s) => ({ m: s.m, x: s.x, z: s.z, r: s.r, s: finite(s.s) ? s.s | 0 : 1 }))
      : [];

  V32.register(
    "berges",
    function (context) {
      const { THREE, game, hooks } = context;
      const root = hooks.root;
      const editor = game.editor;
      const pane = root.querySelector('.v32-pane[data-v32-pane="relief"]');
      if (!editor || !pane || !game.terrainHeight) return null;

      // --- Interface ------------------------------------------------------------------
      const box = document.createElement("fieldset");
      box.className = "v32-bench v32-berges";
      box.innerHTML = `<legend>Berges</legend>
        <p class="hint">Choisis un geste puis touche le bord de l’eau : « Gommer » rend la prairie jusqu’à l’eau, « Ajouter » pose une berge de terre, de roseaux, d’iris et de pierres.</p>
        <div class="tool-grid two v32-big-tools">
          <button type="button" class="btn" data-berges-mode="erase" aria-pressed="false">${icon("erase", 24)}<span>Gommer</span></button>
          <button type="button" class="btn" data-berges-mode="add" aria-pressed="false">${icon("add", 24)}<span>Ajouter</span></button>
        </div>
        <label class="slider-field"><span>Largeur du geste <output data-berges-radius-value>2,5 m</output></span><input type="range" min="1" max="6" step=".5" value="2.5" data-berges-radius></label>
        <p class="v32-bench-status" data-berges-status>Aucun geste.</p>
        <div class="tool-grid two">
          <button type="button" class="btn" data-berges-undo disabled>${icon("undo", 18)}<span>Annuler</span></button>
          <button type="button" class="btn" data-berges-reset disabled>${icon("reset", 18)}<span>Tout rétablir</span></button>
        </div>`;
      const shore = pane.querySelector("[data-tool=shore]")?.closest("fieldset");
      if (shore) shore.after(box);
      else pane.append(box);
      const radiusInput = box.querySelector("[data-berges-radius]");
      const radiusValue = box.querySelector("[data-berges-radius-value]");
      const status = box.querySelector("[data-berges-status]");
      const undoButton = box.querySelector("[data-berges-undo]");
      const resetButton = box.querySelector("[data-berges-reset]");
      const navigateBox = root.querySelector("[data-editor-navigate]");

      // --- État : gestes enregistrés ---------------------------------------------------
      let strokes = sanitize(V32.store.get(KEY, []));
      const state = { mode: null, navigateBefore: false, applied: 0, pending: strokes.length > 0 };

      // Originaux pour tout rétablir : matrices d'instances et index des lots fusionnés.
      const instanceBackup = new Map(); // InstancedMesh → Float32Array
      const indexBackup = new Map(); // geometry → Uint32Array/Uint16Array copy
      const added = new THREE.Group();
      added.name = "Berges_ajoutees_v32";
      added.userData.exportSkip = true;
      game.scene.add(added);

      // Lots fusionnés du jeu : les maillages de berge d'origine y sont recopiés.
      function batches() {
        const rootBatch = game.scene.getObjectByName("Rendu_spatial");
        const list = [];
        if (rootBatch) for (const child of rootBatch.children) if (child.isMesh && child.geometry.index) list.push(child);
        return list;
      }
      const sources = []; // { geometry, start, count } : sommets d'un maillage de berge dans un lot
      function locateSources() {
        const list = batches();
        const probe = new THREE.Vector3();
        const near = (array, k, p) => Math.abs(array[k] - p.x) < 2e-3 && Math.abs(array[k + 1] - p.y) < 2e-3 && Math.abs(array[k + 2] - p.z) < 2e-3;
        game.scene.traverse((mesh) => {
          if (!mesh.isMesh || mesh.isInstancedMesh || !MERGED.some((name) => mesh.name.startsWith(name))) return;
          const position = mesh.geometry.attributes.position;
          if (!position || !position.count) return;
          mesh.updateWorldMatrix(true, false);
          if (mesh.visible && !mesh.userData.renderSource) {
            if (!mesh.geometry.index) mesh.geometry.setIndex(Array.from({ length: position.count }, (_, i) => i));
            sources.push({ geometry: mesh.geometry, start: 0, count: position.count, matrix: mesh.matrixWorld });
            return;
          }
          const probes = [0, position.count >> 1, position.count - 1].map((i) => ({ i, p: probe.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld).clone() }));
          for (const batch of list) {
            if (batch.material !== mesh.material) continue;
            const array = batch.geometry.attributes.position.array;
            const last = array.length / 3 - position.count;
            for (let start = 0; start <= last; start++) {
              if (!near(array, start * 3, probes[0].p)) continue;
              if (probes.every(({ i, p }) => near(array, (start + i) * 3, p))) {
                sources.push({ geometry: batch.geometry, start, count: position.count, matrix: null });
                return;
              }
            }
          }
        });
      }

      function eraseAt(x, z, r) {
        let removed = 0;
        const r2 = r * r;
        // Plantes et pierres instanciées.
        const m = new THREE.Matrix4();
        const p = new THREE.Vector3();
        const zero = new THREE.Matrix4().makeScale(0, 0, 0);
        game.scene.traverse((mesh) => {
          if (!mesh.isInstancedMesh || !INSTANCED.test(mesh.name)) return;
          mesh.updateWorldMatrix(true, false);
          let touched = false;
          for (let i = 0; i < mesh.count; i++) {
            mesh.getMatrixAt(i, m);
            if (m.elements[0] === 0 && m.elements[5] === 0 && m.elements[10] === 0) continue;
            p.setFromMatrixPosition(m).applyMatrix4(mesh.matrixWorld);
            if ((p.x - x) ** 2 + (p.z - z) ** 2 > r2) continue;
            if (!instanceBackup.has(mesh)) instanceBackup.set(mesh, mesh.instanceMatrix.array.slice());
            mesh.setMatrixAt(i, zero);
            touched = true;
            removed++;
          }
          if (touched) mesh.instanceMatrix.needsUpdate = true;
        });
        // Terre, lèvre herbeuse, herbes et pierres fusionnées : triangles effondrés.
        const c = new THREE.Vector3();
        for (const source of sources) {
          const geometry = source.geometry;
          if (!geometry.index) continue;
          const index = geometry.index.array;
          const positions = geometry.attributes.position.array;
          let touched = false;
          for (let t = 0; t + 2 < index.length; t += 3) {
            const a = index[t],
              b = index[t + 1],
              d = index[t + 2];
            if (a < source.start || a >= source.start + source.count || (a === b && b === d)) continue;
            c.set((positions[a * 3] + positions[b * 3] + positions[d * 3]) / 3, 0, (positions[a * 3 + 2] + positions[b * 3 + 2] + positions[d * 3 + 2]) / 3);
            if (source.matrix) c.applyMatrix4(source.matrix);
            if ((c.x - x) ** 2 + (c.z - z) ** 2 > r2) continue;
            if (!indexBackup.has(geometry)) indexBackup.set(geometry, index.slice());
            index[t + 1] = a;
            index[t + 2] = a;
            touched = true;
            removed++;
          }
          if (touched) geometry.index.needsUpdate = true;
        }
        return removed;
      }

      // Berge ajoutée : points au bord de l'eau (terre ferme à moins d'1,6 m de l'eau).
      const regions = (game.waterRegions || []).filter((region) => region.poly && region.poly.length > 2);
      function inside(px, pz, poly) {
        let result = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
          const [xi, zi] = poly[i];
          const [xj, zj] = poly[j];
          if (zi > pz !== zj > pz && px < ((xj - xi) * (pz - zi)) / (zj - zi || 1e-9) + xi) result = !result;
        }
        return result;
      }
      function edgeDistance(px, pz, poly) {
        let best = Infinity;
        for (let i = 0; i < poly.length; i++) {
          const [ax, az] = poly[i];
          const [bx, bz] = poly[(i + 1) % poly.length];
          const vx = bx - ax,
            vz = bz - az;
          const t = Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / (vx * vx + vz * vz || 1)));
          best = Math.min(best, Math.hypot(px - ax - vx * t, pz - az - vz * t));
        }
        return best;
      }
      /** Distance à l'eau la plus proche (négative dans l'eau) et niveau de cette eau. */
      function water(px, pz) {
        let best = { d: Infinity, level: 0 };
        for (const region of regions) {
          const d = edgeDistance(px, pz, region.poly) * (inside(px, pz, region.poly) ? -1 : 1);
          if (d < best.d) best = { d, level: region.level || 0 };
        }
        for (const channel of game.channels || []) {
          const s = game.channelSample([px, pz], channel);
          if (!s || !Number.isFinite(s.distance)) continue;
          const d = s.distance - (s.width || channel.width || 1) / 2;
          if (d < best.d) best = { d, level: s.height };
        }
        return best;
      }
      const templates = {};
      function template(prefix) {
        if (templates[prefix] !== undefined) return templates[prefix];
        let found = null;
        game.scene.traverse((o) => {
          if (!found && o.isInstancedMesh && o.name.startsWith(prefix) && o.count > 0) found = o;
        });
        return (templates[prefix] = found);
      }
      const mudMaterial = new THREE.MeshStandardMaterial({ color: 0x5b4a33, roughness: 1, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
      const mudGeometry = new THREE.CircleGeometry(1, 14);
      mudGeometry.rotateX(-Math.PI / 2);
      function addAt(x, z, r, seed) {
        const rnd = V32.stones ? V32.stones.random(seed) : Math.random;
        const spots = [];
        const step = 0.45;
        for (let gx = -r; gx <= r; gx += step)
          for (let gz = -r; gz <= r; gz += step) {
            if (gx * gx + gz * gz > r * r) continue;
            const px = x + gx + (rnd() - 0.5) * step * 0.8,
              pz = z + gz + (rnd() - 0.5) * step * 0.8;
            const w = water(px, pz);
            if (w.d < 0.05 || w.d > 1.6) continue;
            const h = game.terrainHeight(px, pz);
            if (h < w.level + 0.02 || h > w.level + 0.9) continue;
            spots.push({ x: px, z: pz, y: h, d: w.d });
          }
        if (!spots.length) return 0;
        const group = new THREE.Group();
        group.name = "Berge_ajoutee_v32";
        group.userData.seed = seed;
        // Terre humide au plus près de l'eau.
        for (const s of spots)
          if (s.d < 0.8 && rnd() < 0.55) {
            const mud = new THREE.Mesh(mudGeometry, mudMaterial);
            mud.position.set(s.x, s.y + 0.02, s.z);
            mud.scale.setScalar(0.35 + rnd() * 0.3);
            mud.receiveShadow = true;
            mud.renderOrder = 1;
            group.add(mud);
          }
        // Plantes et pierres, copiées des berges d'origine (mêmes formes, mêmes matières).
        const kinds = [
          ["reed_Roseaux", 0.45, 1.05],
          ["Carex", 0.3, 0.95],
          ["Iris_jaunes", 0.12, 0.9],
          ["Rochers_de_berge", 0.08, 0.45],
        ];
        const m = new THREE.Matrix4();
        const q = new THREE.Quaternion();
        const up = new THREE.Vector3(0, 1, 0);
        for (const [prefix, share, size] of kinds) {
          const source = template(prefix);
          if (!source) continue;
          // Pas plus d'instances que le modèle (ses attributs par instance sont dimensionnés ainsi).
          const chosen = spots.filter(() => rnd() < share).slice(0, source.count);
          if (!chosen.length) continue;
          const mesh = new THREE.InstancedMesh(source.geometry, source.material, chosen.length);
          mesh.name = "Berge_ajoutee_v32_" + prefix;
          // Taille d'origine d'une instance (moyenne) pour garder les proportions.
          const sample = new THREE.Matrix4();
          source.getMatrixAt(0, sample);
          const scaleRef = new THREE.Vector3().setFromMatrixScale(sample);
          const tint = new THREE.Color();
          chosen.forEach((s, i) => {
            q.setFromAxisAngle(up, rnd() * Math.PI * 2);
            const k = size * (0.75 + rnd() * 0.5);
            m.compose(new THREE.Vector3(s.x, s.y - (prefix === "Rochers_de_berge" ? 0.08 : 0.02), s.z), q, scaleRef.clone().multiplyScalar(k));
            mesh.setMatrixAt(i, m);
            // Le programme du modèle attend une couleur par instance quand il en a une.
            if (source.instanceColor) {
              source.getColorAt(Math.floor(rnd() * source.count), tint);
              mesh.setColorAt(i, tint);
            }
          });
          mesh.instanceMatrix.needsUpdate = true;
          if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
          mesh.castShadow = prefix === "Rochers_de_berge";
          mesh.receiveShadow = true;
          mesh.frustumCulled = false;
          group.add(mesh);
        }
        added.add(group);
        return spots.length;
      }

      function restoreAll() {
        for (const [mesh, array] of instanceBackup) {
          mesh.instanceMatrix.array.set(array);
          mesh.instanceMatrix.needsUpdate = true;
        }
        for (const [geometry, array] of indexBackup) {
          geometry.index.array.set(array);
          geometry.index.needsUpdate = true;
        }
        for (const child of [...added.children]) {
          added.remove(child);
          child.traverse((o) => {
            if (o.isInstancedMesh) o.dispose();
          });
        }
      }
      function apply(stroke) {
        return stroke.m === "erase" ? eraseAt(stroke.x, stroke.z, stroke.r) : addAt(stroke.x, stroke.z, stroke.r, stroke.s);
      }
      function replay() {
        restoreAll();
        for (const stroke of strokes) apply(stroke);
        hooks.invalidate();
      }
      function save() {
        V32.store.set(KEY, strokes);
        undoButton.disabled = !strokes.length;
        resetButton.disabled = !strokes.length;
      }

      // --- Pinceau --------------------------------------------------------------------
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.94, 1, 48), new THREE.MeshBasicMaterial({ color: 0xffd36b, transparent: true, opacity: 0.9, depthTest: false }));
      ring.geometry.rotateX(-Math.PI / 2);
      ring.renderOrder = 99;
      ring.visible = false;
      ring.userData.editorHelper = true;
      ring.userData.exportSkip = true;
      game.scene.add(ring);

      function setMode(mode) {
        if (state.mode === mode) mode = null;
        const was = state.mode;
        state.mode = mode;
        for (const button of box.querySelectorAll("[data-berges-mode]")) button.setAttribute("aria-pressed", String(button.dataset.bergesMode === mode));
        if (mode && !was) {
          state.navigateBefore = navigateBox ? navigateBox.checked : false;
          if (navigateBox && !navigateBox.checked) {
            navigateBox.checked = true;
            navigateBox.dispatchEvent(new Event("change", { bubbles: true }));
          }
        } else if (!mode && was && navigateBox && navigateBox.checked !== state.navigateBefore) {
          navigateBox.checked = state.navigateBefore;
          navigateBox.dispatchEvent(new Event("change", { bubbles: true }));
        }
        ring.visible = false;
        ring.material.color.set(mode === "erase" ? 0xff8a65 : 0x7fd67f);
        status.textContent = mode ? (mode === "erase" ? "Touche une berge pour la gommer." : "Touche le bord de l’eau pour y poser une berge.") : strokes.length ? strokes.length + " geste(s) gardé(s)." : "Aucun geste.";
        hooks.markDirty();
      }
      box.addEventListener("click", (event) => {
        const button = event.target.closest("[data-berges-mode]");
        if (button) setMode(button.dataset.bergesMode);
      });
      radiusInput.addEventListener("input", () => {
        radiusValue.textContent = Number(radiusInput.value).toFixed(1).replace(".", ",") + " m";
      });
      undoButton.addEventListener("click", () => {
        strokes.pop();
        save();
        replay();
        status.textContent = strokes.length ? "Dernier geste annulé." : "Berges d’origine rétablies.";
      });
      resetButton.addEventListener("click", () => {
        strokes = [];
        save();
        replay();
        status.textContent = "Berges d’origine rétablies.";
      });
      // Un autre outil de l'atelier arrête le pinceau.
      root.querySelector("[data-editor-panel]")?.addEventListener("click", (event) => {
        if (event.target.closest("[data-tool], .v32-tab, [data-v32-bench]") && state.mode) setMode(null);
      });

      const canvas = game.renderer.domElement;
      let press = null;
      canvas.addEventListener(
        "pointerdown",
        (event) => {
          if (!state.mode || hooks.getMode() !== "editor" || event.button !== 0) return;
          press = { x: event.clientX, y: event.clientY, time: performance.now(), id: event.pointerId };
        },
        true,
      );
      canvas.addEventListener("pointermove", (event) => {
        if (!state.mode || hooks.getMode() !== "editor") return;
        const point = editor.groundPoint(event);
        if (!point) return;
        const r = Number(radiusInput.value);
        ring.position.set(point.x, game.terrainHeight(point.x, point.z) + 0.06, point.z);
        ring.scale.setScalar(r);
        ring.visible = true;
        hooks.markDirty();
      });
      canvas.addEventListener(
        "pointerup",
        (event) => {
          if (!press || press.id !== event.pointerId) return;
          const tap = Math.hypot(event.clientX - press.x, event.clientY - press.y) < 7 && performance.now() - press.time < 600;
          press = null;
          if (!tap || !state.mode) return;
          const point = editor.groundPoint(event);
          if (!point) return;
          const stroke = { m: state.mode, x: +point.x.toFixed(2), z: +point.z.toFixed(2), r: Number(radiusInput.value), s: (Math.random() * 1e9) | 0 };
          const count = apply(stroke);
          if (!count) {
            status.textContent = state.mode === "erase" ? "Pas de berge ici." : "Pas de bord d’eau ici : touche plus près de l’eau.";
            return;
          }
          strokes.push(stroke);
          save();
          status.textContent = (state.mode === "erase" ? "Berge gommée" : "Berge ajoutée") + " · " + strokes.length + " geste(s).";
          hooks.invalidate();
        },
        true,
      );

      save();
      // Accès direct (essais automatisés) : mêmes effets qu'un toucher au sol.
      V32.berges = {
        stroke(mode, x, z, r = 2.5, s = 1) {
          const stroke = { m: mode, x, z, r, s };
          const count = apply(stroke);
          if (count) {
            strokes.push(stroke);
            save();
          }
          hooks.invalidate();
          return count;
        },
        reset: () => resetButton.click(),
        /** Remplace tous les gestes (import du fichier « mes retouches »). */
        load(list) {
          strokes = sanitize(list);
          save();
          if (state.located) replay();
          else state.pending = true;
          status.textContent = strokes.length ? strokes.length + " geste(s) gardé(s)." : "Aucun geste.";
          return strokes.length;
        },
        get strokes() {
          return strokes.slice();
        },
      };
      return {
        update() {
          // Les lots fusionnés existent une fois la scène prête : on rejoue alors les gestes.
          if (!sources.length && !state.located) {
            state.located = true;
            locateSources();
          }
          if (state.pending) {
            state.pending = false;
            replay();
            return true;
          }
          if (state.mode && hooks.getMode() !== "editor") setMode(null);
          return false;
        },
      };
    },
    66,
  );
})();
