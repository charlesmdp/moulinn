// Moulin V32 — atelier : comparer le relief au RGE ALTI de l'IGN et le recaler.
//
// Depuis le navigateur (le service altimétrique de la Géoplateforme répond aux pages
// web), on mesure l'altitude IGN de quelques centaines de points du domaine et on la
// compare au relief de la scène. Le zéro de la scène est la surface du grand étang : on
// mesure aussi une dizaine de points dans l'étang et leur médiane sert de référence.
// Résultat : écart moyen, écart maximal et une pastille par point (rouge : la scène est
// trop basse, bleu : trop haute). « Recaler » enregistre les écarts ; au prochain
// chargement le relief est corrigé par interpolation douce, loin de la maison et de
// l'eau (niveaux inchangés), avec un écart borné à ±6 m.
(function () {
  "use strict";
  const V32 = globalThis.MoulinV32;

  // Recalage du plan sur la carte (ajusté sur les contours des étangs).
  const GEO = { theta: (1.0 * Math.PI) / 180, scale: 1.06, tx: 12, ty: 0.5, lon0: -2.53509, lat0: 47.72225 };
  const KX = 111320 * Math.cos((GEO.lat0 * Math.PI) / 180);
  const KY = 110540;
  const ENDPOINT = "https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json";
  const KEY = "relief-ign";
  const HOUSE = { x: 0, z: 0, r: 30 };

  /** Coordonnées de la scène (x est, z sud) → longitude, latitude. */
  function toLonLat(x, z) {
    const px = x,
      py = -z;
    const e = GEO.scale * (px * Math.cos(GEO.theta) - py * Math.sin(GEO.theta)) + GEO.tx;
    const n = GEO.scale * (px * Math.sin(GEO.theta) + py * Math.cos(GEO.theta)) + GEO.ty;
    return [GEO.lon0 + e / KX, GEO.lat0 + n / KY];
  }

  const smooth = (a, b, x) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };

  /** Champ de correction : interpolation pondérée (1/d²) des écarts mesurés. */
  function correctionField(samples, water) {
    const usable = samples.filter((s) => Number.isFinite(s.d) && !s.water);
    return (x, z) => {
      let num = 0,
        den = 0;
      for (const s of usable) {
        const d2 = (x - s.x) ** 2 + (z - s.z) ** 2;
        if (d2 > 60 * 60) continue;
        const w = 1 / (d2 + 25);
        num += s.d * w;
        den += w;
      }
      if (!den) return 0;
      const value = Math.max(-6, Math.min(6, num / den));
      // Rien autour de la maison ni au bord de l'eau (les niveaux d'eau restent ceux du plan).
      const house = smooth(HOUSE.r, HOUSE.r + 25, Math.hypot(x - HOUSE.x, z - HOUSE.z));
      const shore = water ? smooth(6, 18, water(x, z)) : 1;
      return value * house * shore;
    };
  }

  /** Recalage relu d'un fichier importé : structure vérifiée, écarts bornés. */
  function sanitize(data) {
    if (!data || typeof data !== "object" || data.apply !== true || !Array.isArray(data.samples)) return null;
    const samples = data.samples
      .filter((s) => s && Number.isFinite(s.x) && Number.isFinite(s.z) && Math.abs(s.x) < 5000 && Math.abs(s.z) < 5000)
      .slice(0, 2000)
      .map((s) => ({ x: s.x, z: s.z, d: Number.isFinite(s.d) ? Math.max(-50, Math.min(50, s.d)) : null, water: !!s.water }));
    if (!samples.length) return null;
    return { apply: true, samples, zero: Number.isFinite(data.zero) ? data.zero : null, date: typeof data.date === "string" ? data.date.slice(0, 40) : "" };
  }

  V32.reliefIGN = {
    toLonLat,
    /** Remplace le recalage enregistré (import du fichier « mes retouches ») ; appliqué au prochain chargement. */
    load(data) {
      const had = !!V32.store.get(KEY, null);
      const clean = sanitize(data);
      V32.store.set(KEY, clean);
      if (this.onChange) this.onChange(clean, had);
      return !!clean;
    },
    onChange: null,
    /** Appelé par le jeu pendant la construction du relief (après les niveaux d'eau). */
    reshape({ positions, grid, water, bounds }) {
      const stored = V32.store.get(KEY, null);
      if (!stored || !stored.apply || !Array.isArray(stored.samples)) return 0;
      const exact = correctionField(stored.samples, water);
      // Grille de 4 m (le champ est doux), lue en bilinéaire pour chaque sommet.
      const step = 4;
      const x0 = bounds.x0 - step,
        z0 = bounds.z0 - step;
      const nx = Math.ceil((bounds.x1 - bounds.x0) / step) + 3,
        nz = Math.ceil((bounds.z1 - bounds.z0) / step) + 3;
      const cells = new Float32Array(nx * nz);
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) cells[j * nx + i] = exact(x0 + i * step, z0 + j * step);
      const field = (x, z) => {
        const fx = Math.min(nx - 1.001, Math.max(0, (x - x0) / step)),
          fz = Math.min(nz - 1.001, Math.max(0, (z - z0) / step));
        const i = Math.floor(fx),
          j = Math.floor(fz),
          tx = fx - i,
          tz = fz - j,
          k = j * nx + i;
        const a = cells[k] + (cells[k + 1] - cells[k]) * tx;
        const b = cells[k + nx] + (cells[k + nx + 1] - cells[k + nx]) * tx;
        return a + (b - a) * tz;
      };
      let moved = 0;
      for (let v = 0; v < positions.length; v += 3) {
        const dh = field(positions[v], positions[v + 2]);
        if (dh) {
          positions[v + 1] += dh;
          moved++;
        }
      }
      if (grid) for (const row of grid) for (const point of row) point[1] += field(point[0], point[2]);
      return moved;
    },
  };

  V32.register(
    "relief-ign",
    function (context) {
      const { THREE, game, hooks } = context;
      const pane = hooks.root.querySelector('.v32-pane[data-v32-pane="relief"]');
      if (!pane || !game.terrainHeight) return null;
      const box = document.createElement("fieldset");
      box.className = "v32-bench v32-ign";
      box.innerHTML = `<legend>Relief réel (IGN RGE ALTI)</legend>
        <p class="hint">Mesure l’altitude IGN de quelques centaines de points du domaine et la compare au relief de la scène (zéro : la surface du grand étang). Il faut une connexion à internet.</p>
        <button type="button" class="btn wide" data-ign-measure>Mesurer et comparer</button>
        <p class="v32-bench-status" data-ign-status></p>
        <div class="tool-grid two">
          <button type="button" class="btn primary" data-ign-apply disabled>Recaler le relief</button>
          <button type="button" class="btn" data-ign-clear>Retirer le recalage</button>
        </div>`;
      pane.append(box);
      const status = box.querySelector("[data-ign-status]");
      const measureButton = box.querySelector("[data-ign-measure]");
      const applyButton = box.querySelector("[data-ign-apply]");
      const clearButton = box.querySelector("[data-ign-clear]");
      const stored = V32.store.get(KEY, null);
      status.textContent = stored && stored.apply ? "Relief recalé sur l’IGN (" + stored.samples.length + " points, " + (stored.date || "") + ")." : "Pas encore de mesure.";
      clearButton.disabled = !stored;

      const markers = new THREE.Group();
      markers.name = "Mesures_IGN_v32";
      markers.userData.exportSkip = true;
      markers.userData.editorHelper = true;
      game.scene.add(markers);
      const dot = new THREE.SphereGeometry(0.9, 10, 8);

      const regions = (game.waterRegions || []).filter((r) => r.poly && r.poly.length > 2);
      const pond = regions.find((r) => /Grand/.test(r.name || "")) || regions[0];
      const inside = (x, z, poly) => {
        let result = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
          const [xi, zi] = poly[i];
          const [xj, zj] = poly[j];
          if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi || 1e-9) + xi) result = !result;
        }
        return result;
      };
      const nearWater = (x, z) => {
        if (regions.some((r) => inside(x, z, r.poly))) return true;
        for (const channel of game.channels || []) {
          const s = game.channelSample([x, z], channel);
          if (s && s.distance < (s.width || 1.5) / 2 + 3) return true;
        }
        return false;
      };

      async function elevations(points) {
        const out = [];
        for (let i = 0; i < points.length; i += 100) {
          const chunk = points.slice(i, i + 100).map(([x, z]) => toLonLat(x, z));
          const params = new URLSearchParams({
            lon: chunk.map((p) => p[0].toFixed(6)).join("|"),
            lat: chunk.map((p) => p[1].toFixed(6)).join("|"),
            resource: "ign_rge_alti_wld",
            delimiter: "|",
            zonly: "true",
          });
          const response = await fetch(ENDPOINT + "?" + params);
          if (!response.ok) throw new Error("service IGN indisponible (" + response.status + ")");
          const data = await response.json();
          const list = data.elevations || [];
          for (const value of list) out.push(typeof value === "number" ? value : Number(value.z));
          status.textContent = "Mesure IGN… " + Math.min(points.length, i + 100) + " / " + points.length;
        }
        return out;
      }

      let last = null;
      measureButton.addEventListener("click", async () => {
        measureButton.disabled = true;
        applyButton.disabled = true;
        status.textContent = "Préparation des points…";
        try {
          // Grille de 18 m sur tout le domaine, plus une dizaine de points dans le grand étang.
          const bounds = { x0: -260, x1: 165, z0: -80, z1: 205 };
          const points = [];
          for (let x = bounds.x0; x <= bounds.x1; x += 18) for (let z = bounds.z0; z <= bounds.z1; z += 18) points.push([x, z]);
          const reference = [];
          if (pond) {
            const xs = pond.poly.map((p) => p[0]),
              zs = pond.poly.map((p) => p[1]);
            for (let k = 0; k < 400 && reference.length < 12; k++) {
              const x = Math.min(...xs) + Math.random() * (Math.max(...xs) - Math.min(...xs));
              const z = Math.min(...zs) + Math.random() * (Math.max(...zs) - Math.min(...zs));
              if (inside(x, z, pond.poly)) reference.push([x, z]);
            }
          }
          const values = await elevations([...reference, ...points]);
          const refValues = values.slice(0, reference.length).filter(Number.isFinite).sort((a, b) => a - b);
          if (!refValues.length) throw new Error("pas de mesure dans le grand étang");
          const zero = refValues[refValues.length >> 1];
          const samples = points.map(([x, z], i) => {
            const ign = values[reference.length + i];
            const scene = game.terrainHeight(x, z);
            return { x, z, d: Number.isFinite(ign) && ign > -100 ? +(ign - zero - scene).toFixed(2) : NaN, water: nearWater(x, z) };
          });
          const valid = samples.filter((s) => Number.isFinite(s.d) && !s.water);
          const mean = valid.reduce((a, s) => a + Math.abs(s.d), 0) / Math.max(1, valid.length);
          const worst = valid.reduce((a, s) => (Math.abs(s.d) > Math.abs(a.d) ? s : a), { d: 0 });
          for (const child of [...markers.children]) markers.remove(child);
          for (const s of valid) {
            const color = new THREE.Color().setHSL(s.d > 0 ? 0.0 : 0.6, 0.8, 0.5 - Math.min(0.25, Math.abs(s.d) * 0.05));
            const mesh = new THREE.Mesh(dot, new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true, opacity: Math.min(1, 0.25 + Math.abs(s.d) * 0.25) }));
            mesh.position.set(s.x, game.terrainHeight(s.x, s.z) + 1.5, s.z);
            mesh.renderOrder = 97;
            markers.add(mesh);
          }
          last = { samples, zero, date: new Date().toLocaleDateString("fr-FR") };
          status.textContent =
            valid.length + " points mesurés · zéro de l’étang : " + zero.toFixed(1) + " m NGF · écart moyen " + mean.toFixed(2) + " m · écart maximal " + worst.d.toFixed(1) + " m (rouge : la scène est trop basse, bleu : trop haute).";
          applyButton.disabled = false;
          hooks.invalidate();
        } catch (error) {
          status.textContent = "Mesure impossible : " + error.message + ".";
        } finally {
          measureButton.disabled = false;
        }
      });
      applyButton.addEventListener("click", () => {
        if (!last) return;
        V32.store.set(KEY, { apply: true, samples: last.samples.map((s) => ({ x: s.x, z: s.z, d: s.d, water: s.water })), zero: last.zero, date: last.date });
        clearButton.disabled = false;
        status.textContent = "Recalage enregistré : il sera appliqué au prochain chargement de la page (loin de la maison et de l’eau).";
      });
      clearButton.addEventListener("click", () => {
        V32.store.set(KEY, null);
        clearButton.disabled = true;
        for (const child of [...markers.children]) markers.remove(child);
        status.textContent = "Recalage retiré : le relief d’origine revient au prochain chargement.";
        hooks.invalidate();
      });
      V32.reliefIGN.onChange = (clean, had) => {
        if (!clean && !had) return;
        clearButton.disabled = !clean;
        for (const child of [...markers.children]) markers.remove(child);
        status.textContent = clean
          ? "Recalage importé (" + clean.samples.length + " points" + (clean.date ? ", " + clean.date : "") + ") : il sera appliqué au prochain chargement de la page."
          : "Recalage retiré : le relief d’origine revient au prochain chargement.";
        hooks.invalidate();
      };
      return {
        update() {
          const visible = hooks.getMode() === "editor";
          if (markers.visible !== visible) {
            markers.visible = visible;
            return true;
          }
          return false;
        },
      };
    },
    67,
  );
})();
