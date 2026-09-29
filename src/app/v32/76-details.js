// Moulin V32 — petits objets de la vie du jardin.
//
// Un jardin habité : pots de terre cuite fleuris de part et d'autre des portes,
// lanternes au pied des marches de la terrasse, paillasson et bottes à la porte du
// moulin, bûches rangées sous l'appentis de la dépendance avec le billot et la hache,
// outils appuyés contre le pignon, tonneau sous la descente de l'appentis, dévidoir,
// arrosoirs, brouette, banc rustique et pas japonais près des jardinières de la prairie,
// nichoir sur le vieux chêne et mangeoire sur pied, banc de bois face à l'étang, vélo
// contre la dépendance, vasque blanche fleurie sur un rocher de la rocaille, boîte aux
// lettres sur la pile du portail, feuilles tombées sous les chênes.
// Tout est décor : rien n'entre dans les retouches enregistrées par l'éditeur. Les objets
// sont fusionnés par matière et par secteur de 40 m (quelques appels de rendu).
(function () {
  "use strict";
  const V32 = globalThis.MoulinV32;

  const TERRACOTTA = ["#b8643c", "#a95a36", "#c0714a", "#9f5a3a", "#b36a45"];
  const AUTUMN = ["#b8652a", "#9c5424", "#c98a3a", "#7d4a22", "#d4a045", "#8f6a2e", "#a3782f", "#6e5a2a"];
  const GREEN = ["#4e7a36", "#5b8a3c", "#44702f", "#56803a"];

  V32.register(
    "details",
    function (context) {
      const { THREE, game, hooks } = context;
      const S = V32.stones;
      if (!S || !game.scene || !game.terrainHeight) return null;
      const mobile = !!hooks.mobile;
      const surfaces = hooks.surfaces || {};
      const PI = Math.PI;

      // --- Matières ----------------------------------------------------------------------
      const glow = new THREE.MeshStandardMaterial({
        color: new THREE.Color("#fff3dc"),
        emissive: new THREE.Color("#ffae52"),
        emissiveIntensity: 0.04,
        roughness: 0.55,
        metalness: 0,
      });
      glow.name = "Flamme_des_lanternes_v32";
      // Allumée par ce module (voir update) : le mode nuit du jeu n'y touche pas.
      glow.userData.night22 = true;
      const materials = {
        painted: new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.78, metalness: 0, envMapIntensity: 0.18 }),
        wood: new THREE.MeshStandardMaterial({
          color: 0xffffff,
          vertexColors: true,
          map: surfaces.wood20 || surfaces.wood || null,
          normalMap: surfaces.woodNormal20 || null,
          roughness: 0.9,
          metalness: 0,
          envMapIntensity: 0.1,
        }),
        metal: new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.42, metalness: 0.6, envMapIntensity: 0.7 }),
        leaf: new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, side: THREE.DoubleSide, roughness: 0.74, metalness: 0, envMapIntensity: 0.15 }),
        glow,
      };
      for (const [name, material] of Object.entries(materials)) if (!material.name) material.name = "Objets_" + name + "_v32";

      // Tout le décor est reconstruit d'un bloc : au chargement, puis après chaque retouche
      // du relief dans l'atelier (les objets suivent le nouveau sol).
      function build() {
        const started = performance.now();
        const rnd = S.random(52817);
        const R = (a, b) => a + (b - a) * rnd();
        const pick = (list) => list[Math.floor(rnd() * list.length)];
        const ground = (x, z) => S.groundAt(game, x, z);
        const group = new THREE.Group();
        group.name = "Objets_du_quotidien_v32";
        group.userData.exportSkip = true;
        const stats = { props: 0, leaves: 0, stones: 0 };

        // --- Assemblage par matière et par secteur ---------------------------------------
        const parts = new Map();
        let origin = [0, 0, 0, 0];
        const at = (x, y, z, yaw = 0) => {
          origin = [x, y, z, yaw];
          stats.props++;
        };
        const asm = (material) => {
          const key = material + ":" + Math.floor(origin[0] / 40) + ":" + Math.floor(origin[2] / 40);
          let entry = parts.get(key);
          if (!entry) parts.set(key, (entry = { material, assembly: new S.Assembly() }));
          entry.assembly.setOrigin(origin[0], origin[1], origin[2], origin[3]);
          return entry.assembly;
        };
        const box = (material, position, size, color, rot) => asm(material).box(position, size, color, rot);
        const tube = (material, from, to, radius, color, segments = 8, radiusTop = radius) => asm(material).tube(from, to, radius, color, segments, radiusTop);
        const part = (material, geometry, position, rot, size, color, uvScale = 1) => asm(material).part(geometry, position, rot, size, color, uvScale);
        /** Planche : grain du bois le long de la plus grande dimension. */
        const plank = (position, size, color, rot = [0, 0, 0]) => {
          const [sx, sy, sz] = size;
          if (sx >= sy && sx >= sz) return part("wood", S.primitive("box"), position, [rot[0], rot[1], rot[2] + PI / 2], [sy, sx, sz], color);
          if (sz >= sy) return part("wood", S.primitive("box"), position, [rot[0] + PI / 2, rot[1], rot[2]], [sx, sz, sy], color);
          return part("wood", S.primitive("box"), position, rot, size, color);
        };

        // --- Formes réutilisées -----------------------------------------------------------
        const lathe = (points, segments = 14) => {
          const g = new THREE.LatheGeometry(
            points.map(([r, y]) => new THREE.Vector2(r, y)),
            segments,
          );
          const flat = g.toNonIndexed();
          g.dispose();
          return flat;
        };
        const POT = lathe([
          [0.001, 0],
          [0.1, 0],
          [0.112, 0.012],
          [0.142, 0.2],
          [0.158, 0.27],
          [0.177, 0.276],
          [0.182, 0.314],
          [0.17, 0.322],
          [0.158, 0.3],
        ]);
        const BARREL = lathe(
          [
            [0.001, 0],
            [0.255, 0],
            [0.275, 0.1],
            [0.3, 0.42],
            [0.275, 0.76],
            [0.255, 0.86],
            [0.24, 0.87],
            [0.001, 0.87],
          ],
          18,
        );
        const CAN = lathe([
          [0.001, 0],
          [0.1, 0],
          [0.108, 0.012],
          [0.108, 0.2],
          [0.09, 0.232],
          [0.03, 0.245],
          [0.001, 0.245],
        ]);
        // Bûche : écorce brune, bois de bout clair (couleurs par sommet).
        const LOG = (() => {
          const g = new THREE.CylinderGeometry(1, 1, 1, 7, 1).toNonIndexed();
          const n = g.attributes.normal;
          const color = [];
          for (let i = 0; i < n.count; i++) {
            if (Math.abs(n.getY(i)) > 0.9) color.push(0.95, 0.78, 0.55);
            else color.push(0.46, 0.36, 0.26);
          }
          g.setAttribute("color", new THREE.Float32BufferAttribute(color, 3));
          return g;
        })();
        const ROUND_LEAF = S.leafGeometry({ width: 0.95, segments: 3, curl: 0.12, cup: 0.22, rib: 0.02, base: 0.7 });
        const BLADE = S.leafGeometry({ width: 0.09, segments: 3, curl: 0.45, cup: 0.05, rib: 0.01, base: 0.75 });
        const FROND = S.leafGeometry({ width: 0.34, segments: 5, curl: 0.55, cup: 0.08, rib: 0.02, base: 0.65 });
        const FLAT_LEAF = S.leafGeometry({ width: 0.5, segments: 2, curl: 0.04, cup: 0.12, rib: 0.01, base: 0.85 });
        const ICO = S.primitive("ico", 0);
        const ICO1 = S.primitive("ico", 1);

        // --- Plantes en pot -----------------------------------------------------------------
        function plant(kind, y0, size) {
          if (kind === "geranium") {
            for (let i = 0; i < 16; i++) {
              const a = i * 2.4 + R(-0.2, 0.2);
              const l = 0.12 * size * R(0.8, 1.1);
              part("leaf", ROUND_LEAF, [Math.cos(a) * 0.03, y0 + R(0.03, 0.12) * size, Math.sin(a) * 0.03], [-R(0.15, 0.7), a, 0], [l, l, l], pick(GREEN));
            }
            const colors = [pick(["#d8343a", "#c62a3c", "#e0506a"]), pick(["#f06b86", "#d8343a"])];
            for (let k = 0; k < 6; k++) {
              const a = k * 1.05 + R(-0.3, 0.3);
              const d = R(0.03, 0.12) * size;
              const cx = Math.cos(a) * d;
              const cz = Math.sin(a) * d;
              const cy = y0 + R(0.17, 0.25) * size;
              tube("leaf", [cx * 0.3, y0 + 0.04, cz * 0.3], [cx, cy - 0.02, cz], 0.004, "#5b7a3a", 4);
              for (let j = 0; j < 6; j++) part("painted", ICO, [cx + R(-0.028, 0.028), cy + R(-0.015, 0.022), cz + R(-0.028, 0.028)], [0, R(0, 6), 0], [0.022, 0.018, 0.022], colors[k % 2]);
            }
          } else if (kind === "buis") {
            part("leaf", ICO1, [0, y0 + 0.2 * size, 0], [R(0, 1), R(0, 6), 0], [0.2 * size, 0.19 * size, 0.2 * size], "#34552d");
            for (let i = 0; i < 18; i++) {
              const a = R(0, 2 * PI);
              const b = R(-0.2, 1.2);
              const r = 0.19 * size;
              part("leaf", ICO, [Math.cos(a) * Math.cos(b) * r, y0 + 0.2 * size + Math.sin(b) * r, Math.sin(a) * Math.cos(b) * r], [0, R(0, 6), 0], [0.05 * size, 0.045 * size, 0.05 * size], pick(["#3b5f31", "#2f4f29", "#44683a"]));
            }
          } else if (kind === "lavande") {
            for (let i = 0; i < 26; i++) {
              const a = R(0, 2 * PI);
              const tilt = R(0.05, 0.4);
              const h = R(0.22, 0.34) * size;
              const tip = [Math.cos(a) * Math.sin(tilt) * h, y0 + Math.cos(tilt) * h, Math.sin(a) * Math.sin(tilt) * h];
              tube("leaf", [Math.cos(a) * 0.02, y0, Math.sin(a) * 0.02], tip, 0.0035, "#8a9a78", 3);
              part("painted", ICO, [tip[0], tip[1] + 0.02, tip[2]], [0, a, 0], [0.012, 0.04, 0.012], pick(["#7b5fa8", "#8a6bb5", "#6c56a0"]));
            }
            for (let i = 0; i < 10; i++) {
              const a = R(0, 2 * PI);
              part("leaf", BLADE, [0, y0 + 0.02, 0], [-R(0.6, 1.1), a, 0], [0.14 * size, 0.14 * size, 0.14 * size], "#8fa283");
            }
          } else if (kind === "hortensia") {
            for (let i = 0; i < 12; i++) {
              const a = i * 2.4;
              const l = 0.16 * size;
              part("leaf", ROUND_LEAF, [Math.cos(a) * 0.04, y0 + R(0.06, 0.16) * size, Math.sin(a) * 0.04], [-R(0.2, 0.6), a, 0], [l, l, l * 1.2], pick(GREEN));
            }
            const color = pick(["#7f9ad6", "#8fa4df", "#a57fc4", "#e3a6c0"]);
            for (let k = 0; k < 3; k++) {
              const a = k * 2.1 + R(-0.3, 0.3);
              part("painted", ICO1, [Math.cos(a) * 0.08 * size, y0 + 0.26 * size, Math.sin(a) * 0.08 * size], [0, R(0, 6), 0], [0.085 * size, 0.07 * size, 0.085 * size], color);
            }
          } else if (kind === "graminee") {
            for (let i = 0; i < 22; i++) part("leaf", BLADE, [0, y0, 0], [-R(0.7, 1.35), R(0, 2 * PI), R(-0.2, 0.2)], [0.45 * size, 0.45 * size, 0.45 * size], pick(["#8d9a5a", "#a2a867", "#7c8a4d"]));
          } else if (kind === "fougere") {
            for (let i = 0; i < 12; i++) part("leaf", FROND, [0, y0, 0], [-R(0.5, 1.0), (i / 12) * 2 * PI + R(-0.2, 0.2), 0], [0.35 * size, 0.35 * size, 0.35 * size], pick(["#4f7d3a", "#5d8a42", "#46723a"]));
          }
        }
        function pot(x, z, { size = 1, kind = "geranium", y, color } = {}) {
          const y0 = y ?? ground(x, z);
          at(x, y0, z, R(0, 2 * PI));
          const c = color || pick(TERRACOTTA);
          part("painted", POT, [0, 0, 0], [0, 0, 0], [size, size, size], c);
          part("painted", S.primitive("cylinder", 10, 1, 1), [0, 0.285 * size, 0], [0, 0, 0], [0.152 * size, 0.012, 0.152 * size], "#3b2a1c");
          if (kind) plant(kind, 0.29 * size, size);
        }

        // --- Objets -------------------------------------------------------------------------
        function lantern(x, z, y, yaw = 0, scale = 1) {
          at(x, y ?? ground(x, z), z, yaw);
          const s = scale;
          const black = "#23282a";
          box("metal", [0, 0.012 * s, 0], [0.16 * s, 0.024 * s, 0.16 * s], black);
          for (const [dx, dz] of [
            [-1, -1],
            [1, -1],
            [1, 1],
            [-1, 1],
          ])
            box("metal", [dx * 0.068 * s, 0.14 * s, dz * 0.068 * s], [0.014 * s, 0.24 * s, 0.014 * s], black);
          box("metal", [0, 0.262 * s, 0], [0.17 * s, 0.018 * s, 0.17 * s], black);
          part("metal", S.primitive("cone", 4), [0, 0.31 * s, 0], [0, PI / 4, 0], [0.13 * s, 0.08 * s, 0.13 * s], black);
          part("metal", S.primitive("torus", 0.12, 5, 12, PI), [0, 0.35 * s, 0], [0, 0, 0], [0.045 * s, 0.045 * s, 0.045 * s], black);
          // Verre dépoli : blanc crème le jour, lumière chaude de la bougie le soir.
          box("glow", [0, 0.142 * s, 0], [0.122 * s, 0.232 * s, 0.122 * s], "#ffffff");
        }
        function doormat(x, z, yaw) {
          // Posé sur le gravier du passage (un centimètre au-dessus du niveau du passage).
          at(x, ground(x, z) + 0.014, z, yaw);
          box("painted", [0, 0.008, 0], [0.8, 0.016, 0.48], "#8a6a3e");
          box("painted", [0, 0.01, 0], [0.7, 0.016, 0.38], "#9c7a48");
        }
        function boots(x, z, yaw) {
          at(x, ground(x, z), z, yaw);
          const rubber = "#2f4430";
          for (const side of [-1, 1]) {
            const ox = side * 0.085;
            // Tige un peu évasée, pied arrondi, semelle crantée sombre.
            tube("painted", [ox, 0.06, -0.03], [ox + side * 0.012, 0.4, -0.04], 0.064, rubber, 10, 0.074);
            part("painted", S.primitive("torus", 0.18, 5, 12), [ox + side * 0.012, 0.4, -0.04], [PI / 2, 0, 0], [0.072, 0.072, 0.072], "#26382a");
            part("painted", S.primitive("sphere", 10, 7), [ox, 0.06, 0.08], [0, 0, 0], [0.06, 0.055, 0.12], rubber);
            box("painted", [ox, 0.07, 0.0], [0.12, 0.1, 0.16], rubber);
            box("painted", [ox, 0.009, 0.03], [0.125, 0.018, 0.3], "#1c1f1c");
          }
        }
        function wateringCan(x, z, yaw, { y, color = "#a4aaa6", metal = true, scale = 1 } = {}) {
          at(x, y ?? ground(x, z), z, yaw);
          const m = metal ? "metal" : "painted";
          const s = scale;
          part(m, CAN, [0, 0, 0], [0, 0, 0], [1.3 * s, s, s], color);
          part(m, S.primitive("torus", 0.13, 5, 14, PI), [0, 0.245 * s, 0], [0, 0, 0], [0.1 * s, 0.1 * s, 0.1 * s], color);
          tube(m, [0.12 * s, 0.04 * s, 0], [0.34 * s, 0.25 * s, 0], 0.02 * s, color, 7, 0.012 * s);
          part(m, S.primitive("cylinder", 8, 1, 0.5), [0.35 * s, 0.26 * s, 0], [0, 0, -0.8], [0.035 * s, 0.03 * s, 0.035 * s], color);
        }
        function wheelbarrow(x, z, yaw) {
          at(x, ground(x, z), z, yaw);
          const tray = "#2f6d4a";
          const frame = "#3a3e3b";
          // Caisse évasée : fond et quatre côtés inclinés.
          box("metal", [0.02, 0.36, 0], [0.56, 0.02, 0.4], tray);
          box("metal", [0.33, 0.47, 0], [0.03, 0.26, 0.5], tray, [0, 0, -0.55]);
          box("metal", [-0.3, 0.47, 0], [0.03, 0.24, 0.48], tray, [0, 0, 0.25]);
          for (const side of [-1, 1]) box("metal", [0.02, 0.47, side * 0.26], [0.7, 0.24, 0.025], tray, [side * 0.35, 0, 0]);
          // Roue, moyeu, bras et pieds.
          part("painted", S.primitive("torus", 0.3, 6, 16), [0.52, 0.17, 0], [0, 0, 0], [0.14, 0.14, 0.14], "#1d1d1d");
          part("metal", S.primitive("cylinder", 10, 1, 1), [0.52, 0.17, 0], [PI / 2, 0, 0], [0.09, 0.07, 0.09], "#8d9491");
          for (const side of [-1, 1]) {
            tube("metal", [0.52, 0.17, side * 0.05], [-0.72, 0.6, side * 0.27], 0.018, frame);
            tube("painted", [-0.62, 0.575, side * 0.255], [-0.8, 0.63, side * 0.285], 0.022, "#1d1d1d");
            tube("metal", [-0.3, 0.44, side * 0.2], [-0.36, 0.0, side * 0.22], 0.016, frame);
          }
        }
        function barrel(x, z, yaw) {
          at(x, ground(x, z), z, yaw);
          part("wood", BARREL, [0, 0, 0], [0, 0, 0], [1, 1, 1], "#8a6440");
          for (const y of [0.12, 0.73]) part("metal", S.primitive("torus", 0.05, 5, 20), [0, y, 0], [PI / 2, 0, 0], [0.29, 0.29, 0.29], "#3b3935");
          tube("metal", [0.26, 0.12, 0], [0.34, 0.12, 0], 0.015, "#b08a3a");
          box("metal", [0.34, 0.15, 0], [0.012, 0.05, 0.05], "#b08a3a");
          part("wood", S.primitive("cylinder", 16, 1, 1), [0, 0.875, 0], [0, 0, 0], [0.245, 0.02, 0.245], "#6f5238");
        }
        function hoseReel(x, z, yaw) {
          at(x, ground(x, z), z, yaw);
          const frame = "#2f6a3a";
          for (const side of [-1, 1]) {
            tube("painted", [0, 0.02, side * 0.2], [-0.06, 0.62, side * 0.2], 0.014, frame);
            tube("painted", [0.24, 0.1, side * 0.2], [-0.02, 0.36, side * 0.2], 0.014, frame);
            part("painted", S.primitive("torus", 0.35, 6, 12), [0.26, 0.1, side * 0.22], [0, 0, 0], [0.1, 0.1, 0.1], "#202020");
          }
          tube("painted", [-0.06, 0.62, -0.2], [-0.06, 0.62, 0.2], 0.016, frame);
          part("painted", S.primitive("cylinder", 14, 1, 1), [0.02, 0.34, 0], [PI / 2, 0, 0], [0.1, 0.36, 0.1], "#3a3a3a");
          for (let k = 0; k < 5; k++) part("painted", S.primitive("torus", 0.18, 5, 16), [0.02, 0.34, -0.14 + k * 0.07], [0, 0, 0], [0.155, 0.155, 0.155], k % 2 ? "#e2b02b" : "#d9a426");
          tube("painted", [0.02, 0.19, 0.12], [0.5, 0.012, 0.35], 0.014, "#e2b02b", 6);
        }
        function tool(kind, foot, top) {
          // foot, top : bas du manche et point d'appui contre le mur (repère courant).
          const wood = "#9c7b52";
          tube("wood", foot, top, 0.016, wood, 6);
          const dir = [top[0] - foot[0], top[1] - foot[1], top[2] - foot[2]];
          const len = Math.hypot(...dir);
          const u = dir.map((v) => v / len);
          const tilt = Math.atan2(Math.hypot(u[0], u[2]), u[1]);
          const yawTool = Math.atan2(u[0], u[2]);
          const steel = "#6e7471";
          if (kind === "rake") {
            const head = foot.map((v, i) => v + u[i] * 0.03);
            box("metal", head, [0.36, 0.025, 0.03], steel, [tilt, yawTool, 0]);
            for (let k = 0; k < 10; k++) box("metal", [head[0] + Math.cos(yawTool) * (-0.16 + k * 0.035), head[1] - 0.035, head[2] - Math.sin(yawTool) * (-0.16 + k * 0.035)], [0.008, 0.06, 0.008], steel, [tilt, yawTool, 0]);
          } else if (kind === "spade") {
            box("metal", foot.map((v, i) => v - u[i] * 0.12), [0.18, 0.26, 0.012], steel, [tilt, yawTool, 0]);
            part("wood", S.primitive("torus", 0.12, 4, 10), top.map((v, i) => v + u[i] * 0.06), [tilt, yawTool, 0], [0.06, 0.06, 0.06], wood);
          } else {
            for (let k = 0; k < 4; k++) {
              const off = -0.075 + k * 0.05;
              const base = foot.map((v, i) => v + (i === 0 ? Math.cos(yawTool) * off : i === 2 ? -Math.sin(yawTool) * off : 0));
              tube("metal", base, base.map((v, i) => v - u[i] * 0.28), 0.006, steel, 4);
            }
            box("metal", foot, [0.2, 0.03, 0.02], steel, [tilt, yawTool, 0]);
          }
        }
        function bench(x, z, yaw, { weathered = "#8f8672" } = {}) {
          at(x, ground(x, z), z, yaw);
          const legs = "#6d6452";
          for (const side of [-1, 1]) {
            plank([side * 0.66, 0.22, 0.12], [0.06, 0.44, 0.06], legs);
            plank([side * 0.66, 0.4, -0.16], [0.06, 0.8, 0.06], legs, [-0.12, 0, 0]);
            plank([side * 0.66, 0.43, -0.02], [0.05, 0.05, 0.46], legs);
            plank([side * 0.66, 0.64, -0.02], [0.05, 0.04, 0.42], legs);
            plank([side * 0.66, 0.54, 0.16], [0.045, 0.2, 0.045], legs);
          }
          for (let k = 0; k < 4; k++) plank([0, 0.46, 0.14 - k * 0.1], [1.4, 0.03, 0.085], weathered);
          for (let k = 0; k < 3; k++) plank([0, 0.58 + k * 0.1, -0.2 - k * 0.012], [1.38, 0.07, 0.022], weathered, [-0.12, 0, 0]);
        }
        function rusticBench(x, z, yaw) {
          at(x, ground(x, z), z, yaw);
          for (const side of [-1, 1]) part("wood", LOG, [side * 0.5, 0.2, 0], [0, 0, 0], [0.13, 0.4, 0.13], "#ffffff");
          plank([0, 0.43, 0], [1.5, 0.06, 0.3], "#8a7a5e");
        }
        function birdTable(x, z, yaw) {
          at(x, ground(x, z), z, yaw);
          const wood = "#7d6448";
          plank([0, 0.75, 0], [0.07, 1.5, 0.07], wood);
          for (const [dx, dz] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ])
            plank([dx * 0.1, 0.12, dz * 0.1], [dx ? 0.2 : 0.035, 0.035, dz ? 0.2 : 0.035], wood, [0, 0, 0]);
          plank([0, 1.52, 0], [0.42, 0.03, 0.42], wood);
          for (const side of [-1, 1]) {
            plank([side * 0.2, 1.55, 0], [0.02, 0.04, 0.42], wood);
            plank([0, 1.55, side * 0.2], [0.42, 0.04, 0.02], wood);
            plank([side * 0.17, 1.66, side * 0.17], [0.025, 0.22, 0.025], wood);
            plank([side * 0.17, 1.66, -side * 0.17], [0.025, 0.22, 0.025], wood);
            plank([0, 1.84, side * 0.135], [0.52, 0.022, 0.3], "#5f4a35", [side * 0.62, 0, 0]);
          }
          for (let k = 0; k < 14; k++) part("painted", ICO, [R(-0.15, 0.15), 1.545, R(-0.15, 0.15)], [0, R(0, 6), 0], [0.012, 0.008, 0.012], pick(["#d8c38e", "#b89a5f", "#e6d8b0"]));
        }
        function nestBox(x, y, z, yaw) {
          at(x, y, z, yaw);
          const wood = "#8a6d4c";
          plank([0, 0, 0], [0.16, 0.26, 0.16], wood);
          plank([0, 0.155, 0.02], [0.22, 0.02, 0.24], "#5f4a35", [0.25, 0, 0]);
          part("painted", S.primitive("cylinder", 12, 1, 1), [0, 0.05, 0.081], [PI / 2, 0, 0], [0.032, 0.004, 0.032], "#15110d");
          tube("wood", [0, -0.01, 0.08], [0, -0.01, 0.13], 0.006, "#6d5438", 5);
          box("metal", [0, 0.06, -0.085], [0.04, 0.3, 0.012], "#3b3a36");
        }
        function mailbox(x, y, z, yaw) {
          at(x, y, z, yaw);
          const green = "#2e4a3c";
          box("metal", [0, 0, 0], [0.38, 0.3, 0.24], green);
          part("metal", S.primitive("cylinder", 14, 1, 1, false), [0, 0.15, 0], [0, 0, PI / 2], [0.12, 0.38, 0.12], green);
          box("painted", [0, 0.08, 0.121], [0.24, 0.022, 0.006], "#0d1210");
          box("metal", [0, -0.04, 0.123], [0.32, 0.16, 0.006], "#35574a");
          box("painted", [0.1, -0.08, 0.127], [0.1, 0.035, 0.004], "#efe8d6");
          box("metal", [-0.12, -0.02, 0.128], [0.012, 0.012, 0.006], "#c6a24a");
        }
        function crate(x, z, yaw, y, fill = "#b83b2c") {
          at(x, y ?? ground(x, z), z, yaw);
          for (const side of [-1, 1]) {
            plank([0, 0.07, side * 0.19], [0.5, 0.05, 0.02], "#b89a6a");
            plank([0, 0.17, side * 0.19], [0.5, 0.05, 0.02], "#b89a6a");
            plank([side * 0.24, 0.12, 0], [0.02, 0.24, 0.36], "#a88a5c");
          }
          plank([0, 0.012, 0], [0.5, 0.02, 0.38], "#a88a5c");
          for (let k = 0; k < 14; k++) part("painted", S.primitive("sphere", 7, 5), [R(-0.18, 0.18), 0.2 + R(0, 0.04), R(-0.13, 0.13)], [0, 0, 0], [0.04, 0.038, 0.04], k % 4 ? fill : "#d6a13a");
        }
        function bicycle(x, z, yaw, lean = -0.2) {
          at(x, ground(x, z), z, yaw);
          // Cadre en losange, roues à jantes fines, guidon, selle ; appuyé contre le mur.
          const frame = "#2e5a48";
          const r = 0.34;
          const tilt = (p) => [p[0], p[1] * Math.cos(lean), p[2] + p[1] * Math.sin(-lean)];
          const rear = tilt([-0.52, r, 0]);
          const front = tilt([0.52, r, 0]);
          const crank = tilt([-0.04, 0.3, 0]);
          const seat = tilt([-0.2, 0.84, 0]);
          const headTop = tilt([0.36, 0.86, 0]);
          const headLow = tilt([0.41, 0.7, 0]);
          for (const hub of [rear, front]) {
            part("painted", S.primitive("torus", 0.07, 5, 24), hub, [-lean, 0, 0], [r, r, r], "#1b1b1b");
            part("metal", S.primitive("torus", 0.04, 4, 24), hub, [-lean, 0, 0], [r * 0.88, r * 0.88, r * 0.88], "#9aa19e");
            part("metal", S.primitive("cylinder", 8, 1, 1), hub, [PI / 2 - lean, 0, 0], [0.025, 0.1, 0.025], "#9aa19e");
          }
          for (const [a, b, rad] of [
            [rear, crank, 0.014],
            [rear, seat, 0.012],
            [crank, seat, 0.017],
            [seat, headTop, 0.016],
            [crank, headLow, 0.019],
            [headLow, headTop, 0.02],
            [headLow, front, 0.014],
          ])
            tube("metal", a, b, rad, frame, 7);
          const stem = tilt([0.34, 1.0, 0]);
          tube("metal", headTop, stem, 0.012, "#8d9491", 6);
          tube("metal", tilt([0.32, 1.0, -0.26]), tilt([0.32, 1.0, 0.26]), 0.012, "#8d9491", 6);
          for (const side of [-1, 1]) tube("painted", tilt([0.32, 1.0, side * 0.26]), tilt([0.3, 1.0, side * 0.34]), 0.016, "#2b2b2b", 6);
          const saddle = tilt([-0.22, 0.9, 0]);
          tube("metal", seat, saddle, 0.012, "#8d9491", 6);
          part("painted", S.primitive("sphere", 8, 5), saddle, [-lean, 0, 0], [0.12, 0.03, 0.07], "#2a2420");
          for (const side of [-1, 1]) tube("metal", crank, tilt([-0.04 + side * 0.1, 0.3 - side * 0.12, side * 0.06]), 0.009, "#6e7471", 5);
          part("metal", S.primitive("cylinder", 14, 1, 1), crank, [PI / 2 - lean, 0, 0], [0.09, 0.012, 0.09], "#6e7471");
          tube("painted", rear, crank, 0.006, "#3a3a3a", 4);
        }
        function urn(x, z, y, yaw) {
          at(x, y, z, yaw);
          part("painted", POT, [0, 0.07, 0], [0, 0, 0], [1.05, 0.8, 1.05], "#e8e4da");
          part("painted", S.primitive("cylinder", 12, 0.6, 1), [0, 0.035, 0], [0, 0, 0], [0.09, 0.07, 0.09], "#e2ded3");
          part("painted", S.primitive("cylinder", 12, 1, 1), [0, 0.3, 0], [0, 0, 0], [0.16, 0.012, 0.16], "#3b2a1c");
          plant("geranium", 0.3, 0.9);
        }
        function potStack(x, z, yaw) {
          at(x, ground(x, z), z, yaw);
          for (let k = 0; k < 4; k++) part("painted", POT, [0, k * 0.07, 0], [0.05 * k, 0, 0], [0.9, 0.9, 0.9], pick(TERRACOTTA));
          part("painted", POT, [0.34, 0.14, 0.02], [PI / 2 - 0.3, 0.4, 0], [0.8, 0.8, 0.8], pick(TERRACOTTA));
        }
        function bucket(x, z, yaw, color = "#8f9794") {
          at(x, ground(x, z), z, yaw);
          part("metal", S.primitive("cylinder", 14, 1.18, 1, true), [0, 0.13, 0], [0, 0, 0], [0.12, 0.26, 0.12], color);
          part("painted", S.primitive("cylinder", 14, 1, 1), [0, 0.2, 0], [0, 0, 0], [0.13, 0.01, 0.13], "#3e3226");
          part("metal", S.primitive("torus", 0.04, 4, 12, PI), [0, 0.26, 0], [0, 0, 0], [0.14, 0.12, 0.14], "#5d6361");
        }
        function chopping(x, z, yaw) {
          at(x, ground(x, z), z, yaw);
          part("wood", LOG, [0, 0.22, 0], [0, R(0, 6), 0], [0.23, 0.44, 0.23], "#ffffff");
          // Hache fichée dans le billot.
          tube("wood", [0.02, 0.47, 0], [0.34, 0.86, 0.05], 0.018, "#a07a4a", 6);
          box("metal", [0.02, 0.455, -0.005], [0.16, 0.1, 0.02], "#5c615e", [0, 0.15, 0.9]);
          for (let k = 0; k < 4; k++) {
            const a = k * 1.7 + R(-0.2, 0.2);
            part("wood", LOG, [Math.cos(a) * 0.5, 0.06, Math.sin(a) * 0.5], [PI / 2, a, R(-0.2, 0.2)], [0.06, 0.34, 0.035], "#ffffff");
          }
        }
        function planter(x, z, yaw, length = 1.1, kind = "lavande") {
          const y0 = ground(x, z);
          at(x, y0, z, yaw);
          const wood = "#7a6a52";
          for (let k = 0; k < 3; k++) {
            const y = 0.06 + k * 0.1;
            for (const side of [-1, 1]) plank([0, y, side * 0.17], [length, 0.09, 0.025], wood);
            for (const side of [-1, 1]) plank([side * (length / 2 - 0.012), y, 0], [0.025, 0.09, 0.32], wood);
          }
          for (const side of [-1, 1]) for (const end of [-1, 1]) plank([end * (length / 2 - 0.03), 0.17, side * 0.15], [0.05, 0.34, 0.05], "#6a5b46");
          box("painted", [0, 0.31, 0], [length - 0.05, 0.02, 0.3], "#3b2a1c");
          const count = Math.round(length / 0.26);
          for (let k = 0; k < count; k++) {
            at(x + Math.cos(yaw) * (-length / 2 + (k + 0.5) * (length / count)), y0, z - Math.sin(yaw) * (-length / 2 + (k + 0.5) * (length / count)), yaw + R(0, 6));
            plant(kind, 0.31, 0.95);
          }
        }
        function woodpile(frame, length, height, depth) {
          // frame : { x, z, yaw } au pied du tas, x le long du tas, z vers l'extérieur.
          const y0 = frame.y ?? ground(frame.x, frame.z);
          at(frame.x, y0, frame.z, frame.yaw);
          plank([0, 0.06, 0], [length, 0.03, depth], "#7d6a52");
          for (const side of [-1, 1]) plank([0, 0.03, side * (depth / 2 - 0.05)], [length, 0.06, 0.08], "#6a5a45");
          let y = 0.075;
          let row = 0;
          while (y < height - 0.05) {
            let s = -length / 2 + (row % 2 ? 0.07 : 0.02);
            let top = 0;
            while (s < length / 2 - 0.06) {
              const r = R(0.055, 0.085);
              const cx = s + r;
              if (cx + r > length / 2) break;
              part("wood", LOG, [cx, y + r, R(-0.02, 0.02)], [PI / 2, R(-0.06, 0.06), R(-0.1, 0.1)], [r, depth * R(0.92, 1.05), r], pick(["#ffffff", "#f2ece4", "#e6ddd0"]));
              top = Math.max(top, r * 2);
              s = cx + r + R(0, 0.012);
            }
            y += top * 0.86;
            row++;
          }
        }
        function steppingStones(from, to, count, lot) {
          for (let k = 0; k < count; k++) {
            const t = (k + 0.5) / count;
            const side = (k % 2 ? 1 : -1) * R(0.05, 0.14);
            const dx = to[0] - from[0];
            const dz = to[1] - from[1];
            const len = Math.hypot(dx, dz);
            const x = from[0] + dx * t - (dz / len) * side;
            const z = from[1] + dz * t + (dx / len) * side;
            const y = game.terrainHeight(x, z);
            lot.add(Math.floor(rnd() * 2), [x, y + 0.012, z], [R(-0.02, 0.02), R(0, PI), R(-0.02, 0.02)], [R(0.5, 0.64) / 0.56, 1, R(0.4, 0.5) / 0.46], pick(["#b9b5ab", "#a8a49a", "#c3bdaf", "#9f9b92"]), R(0.9, 1.05));
            stats.stones++;
          }
        }

        // --- Repères de la maison et de la dépendance ---------------------------------------
        const mill = game.scene.getObjectByName("Moulin");
        const houseYaw = mill ? mill.rotation.y : -0.24;
        const v = new THREE.Vector3();
        const house = (lx, lz) => {
          if (!mill) return [lx, lz];
          v.set(lx, 0, lz);
          mill.updateWorldMatrix(true, false);
          v.applyMatrix4(mill.matrixWorld);
          return [v.x, v.z];
        };

        // Porte de la cour (façade ouest) : paillasson, bottes, deux pots.
        {
          const [dx, dz] = house(-5.3, 0);
          doormat(dx, dz, houseYaw + PI / 2);
          boots(...house(-4.98, -1.05), houseYaw - PI / 2 + 0.25);
          pot(...house(-5.12, 1.08), { size: 1.25, kind: "buis" });
          pot(...house(-5.12, -1.62), { size: 1.1, kind: "geranium" });
        }
        // Terrasse : pots de part et d'autre des marches, lanternes, arrosoir, jardinière.
        {
          pot(...house(-3.4, 7.55), { size: 1.35, kind: "hortensia" });
          pot(...house(-0.7, 7.55), { size: 1.15, kind: "geranium" });
          pot(...house(0.1, 7.45), { size: 0.8, kind: "lavande" });
          const [l1x, l1z] = house(-3.05, 8.28);
          lantern(l1x, l1z, undefined, houseYaw + 0.4);
          const [l2x, l2z] = house(-1.0, 8.3);
          lantern(l2x, l2z, undefined, houseYaw - 0.3, 0.85);
          const [wx, wz] = house(-3.35, 8.05);
          wateringCan(wx, wz, houseYaw + 2.4, { color: "#3f6e4a", metal: false, scale: 0.85 });
          planter(-6.62, 12.6, -1.44, 1.2, "lavande");
        }
        // Lanterne sur le banc de pierre du bord de l'eau.
        const benches = S.meshesNamed(game.scene, "Banc_de_pierre").map(S.orientedBox);
        if (benches.length) {
          const b = benches[benches.length - 1];
          lantern(b.x + 0.62, b.z, b.y + b.sy / 2, 0.3, 0.9);
        }

        // Dépendance : bûches rangées sous l'appentis (à la place du « bois rangé » en boîte),
        // billot, outils contre le pignon, tonneau sous une descente, dévidoir, pots.
        const stored = S.meshesNamed(game.scene, "Bois_range");
        const posts = S.meshesNamed(game.scene, "Poteau_appentis").map(S.orientedBox);
        let leanTo = null;
        if (stored.length) {
          // Sept planches empilées figuraient le bois : on en prend l'emprise d'ensemble.
          const boxes = stored.map(S.orientedBox);
          const first = boxes[0];
          const alongX = first.sx >= first.sz;
          const yaw = alongX ? first.yaw : first.yaw + PI / 2;
          const ux = Math.cos(yaw);
          const uz = -Math.sin(yaw);
          let lo = Infinity;
          let hi = -Infinity;
          let bottom = Infinity;
          let top = -Infinity;
          for (const b of boxes) {
            const along = b.x * ux + b.z * uz;
            const half = (alongX ? b.sx : b.sz) / 2;
            lo = Math.min(lo, along - half);
            hi = Math.max(hi, along + half);
            bottom = Math.min(bottom, b.y - b.sy / 2);
            top = Math.max(top, b.y + b.sy / 2);
          }
          const depth = 0.42;
          const cx = boxes.reduce((sum, b) => sum + b.x, 0) / boxes.length;
          const cz = boxes.reduce((sum, b) => sum + b.z, 0) / boxes.length;
          const shift = (lo + hi) / 2 - (cx * ux + cz * uz);
          const x = cx + ux * shift;
          const z = cz + uz * shift;
          const floor = ground(x, z);
          woodpile({ x, z, yaw, y: floor }, hi - lo, top - floor, depth);
          S.detach(game, stored);
          leanTo = { x, z, yaw, length: hi - lo, depth };
        }
        if (posts.length === 2) {
          const [south, north] = posts[0].z > posts[1].z ? posts : [posts[1], posts[0]];
          // Parement du pignon : derrière le tas de bois.
          const wallX = leanTo ? leanTo.x - leanTo.depth / 2 : south.x - 1.85;
          // Billot et hache devant le tas de bois.
          chopping((south.x + wallX) / 2 + 0.3, (south.z + north.z) / 2 + 0.6, 0.4);
          // Outils appuyés contre le pignon, au sud du tas.
          at(wallX, ground(wallX + 0.5, south.z - 0.5), 0, 0);
          const toolZ = south.z - 0.55;
          tool("rake", [0.5, 0.02, toolZ - 0.2], [0.04, 1.42, toolZ - 0.12]);
          tool("spade", [0.42, 0.02, toolZ + 0.08], [0.04, 1.05, toolZ + 0.06]);
          tool("fork", [0.46, 0.02, toolZ + 0.32], [0.04, 1.12, toolZ + 0.3]);
          // Gouttière sous le bord bas de l'ardoise de l'appentis, descente vers un tonneau.
          const roof = game.scene.getObjectByName("Ardoises_appentis");
          const edge = roof ? new THREE.Box3().setFromObject(roof) : null;
          const gx = edge ? edge.max.x + 0.02 : south.x + 0.45;
          const gy = edge ? edge.min.y - 0.05 : south.y + south.sy / 2 - 0.05;
          const barrelAt = [gx - 0.18, south.z + 0.72];
          const barrelTop = ground(...barrelAt) + 0.87;
          at(0, 0, 0, 0);
          tube("metal", [gx, gy, north.z - 0.25], [gx, gy, south.z + 0.3], 0.055, "#8e9693", 10);
          tube("metal", [gx, gy, south.z + 0.27], [gx - 0.05, gy - 0.16, barrelAt[1]], 0.04, "#8e9693", 8);
          tube("metal", [gx - 0.05, gy - 0.16, barrelAt[1]], [barrelAt[0] + 0.05, barrelTop + 0.12, barrelAt[1]], 0.04, "#8e9693", 8);
          barrel(barrelAt[0], barrelAt[1], 0.4);
          hoseReel(south.x + 0.2, south.z + 1.45, PI / 2 + 0.3);
          potStack(south.x - 0.62, south.z + 0.75, 0.3);
          bucket(south.x - 0.3, south.z + 1.25, 0);
        }
        // Porte d'entrée de la dépendance : deux pots.
        const step = S.meshesNamed(game.scene, "Marche_entree_dependance").map(S.orientedBox);
        if (step.length) {
          const low = step.reduce((a, b) => (a.y < b.y ? a : b));
          // De part et d'autre, le long de la marche.
          const alongX = low.sx >= low.sz;
          const ux = alongX ? Math.cos(low.yaw) : Math.sin(low.yaw);
          const uz = alongX ? -Math.sin(low.yaw) : Math.cos(low.yaw);
          const half = Math.max(low.sx, low.sz) / 2 + 0.32;
          for (const side of [-1, 1]) pot(low.x + ux * side * half, low.z + uz * side * half - 0.1, { size: 1.2, kind: side < 0 ? "fougere" : "geranium" });
        }
        // Vélo appuyé contre la façade sud de la dépendance, entre deux fenêtres.
        bicycle(-20.55, 10.2, PI, -0.2);
        // Petite vasque blanche fleurie posée sur un rocher de la rocaille (photo du talus).
        const rockery = game.scene.getObjectByName("Rocaille_du_talus_v32");
        if (rockery) {
          const down = new THREE.Raycaster(new THREE.Vector3(-8.45, 12, -9.55), new THREE.Vector3(0, -1, 0), 0, 20);
          const hit = down.intersectObject(rockery, true).find((h) => h.object.isInstancedMesh && /Rochers/.test(h.object.name));
          if (hit) urn(hit.point.x, hit.point.z, hit.point.y - 0.02, 0.4);
        }
        // Banc de bois sous le grand arbre, face à l'étang.
        bench(-16.3, 14.15, -0.31);
        // Nichoir sur le vieux chêne près de la véranda, mangeoire sur pied dans la pelouse.
        const forest = game.scene.getObjectByName("Boisements");
        const trunkHit = (x, z, h, dir) => {
          if (!forest) return null;
          const ray = new THREE.Raycaster(new THREE.Vector3(x + dir[0] * 3, h, z + dir[1] * 3), new THREE.Vector3(-dir[0], 0, -dir[1]), 0, 3.2);
          const hits = ray.intersectObject(forest, true).filter((hit) => hit.distance > 0.1 && hit.object.isMesh && !hit.object.material.transparent);
          return hits.length ? hits[0].point : null;
        };
        {
          const tree = [13, 2.5];
          const h = ground(...tree) + 2.1;
          const dir = [-0.8, -0.6];
          const hit = trunkHit(tree[0], tree[1], h, dir);
          const p = hit ? [hit.x + dir[0] * 0.09, hit.z + dir[1] * 0.09] : [tree[0] + dir[0] * 0.3, tree[1] + dir[1] * 0.3];
          nestBox(p[0], h, p[1], Math.atan2(dir[0], dir[1]));
          birdTable(10.1, 1.1, 0.5);
        }
        // Prairie : jardinières de béton, brouette, arrosoir, outils, banc rustique, cageot.
        const beds = S.meshesNamed(game.scene, "Bordure_longue_en_beton");
        const bedBox = new THREE.Box3();
        for (const mesh of beds) bedBox.expandByObject(mesh);
        const bx = beds.length && Number.isFinite(bedBox.min.x) ? bedBox.min.x : 7.64;
        wheelbarrow(bx - 0.9, -29.35, 2.2);
        wateringCan(bx - 0.35, -29.55, 0.9, { scale: 1 });
        rusticBench(bx - 1.3, -35.2, PI / 2);
        crate(bx - 0.55, -31.1, 0.25);
        bucket(bx - 0.45, -36.8, 0, "#6e7a86");
        at(bx - 0.25, ground(bx - 0.4, -33.2), -33.2, 0);
        tool("spade", [0, 0.02, 0], [-0.08, 1.02, 0.02]);
        // Boîte aux lettres sur la pile du portail, côté route.
        const piles = S.meshesNamed(game.scene, "Pile_basse_du_portail").map(S.orientedBox);
        if (piles.length) {
          const west = piles.reduce((a, b) => (a.x < b.x ? a : b));
          const bottom = Math.min(...piles.filter((p) => Math.abs(p.x - west.x) < 0.3).map((p) => p.y - p.sy / 2));
          // Face nord (vers la route) : -z local de la pile.
          const faceZ = west.z - west.sz / 2 - 0.12;
          mailbox(west.x, bottom + 0.72, faceZ, west.yaw + PI);
        }

        // Pas japonais de l'allée vers les jardinières.
        const flat = [0, 1].map((i) => S.blockGeometry({ size: [0.56, 0.06, 0.46], bevel: 0.02, jitter: 0.012, dome: 0.006, chip: 0.6, seed: 701 + i }));
        const pavers = new S.Lot(flat, S.rockMaterial(hooks, "murets", { moss: 0.5, damp: 0.14 }), { name: "Pas_japonais_v32", cell: 200 });
        steppingStones([1.7, -34.2], [bx - 0.65, -34.1], 8, pavers);

        // Feuilles tombées sous les chênes et le bouleau de l'allée (pas au milieu de l'allée).
        const litter = new S.Lot([FLAT_LEAF], materials.leaf, { name: "Feuilles_sous_les_arbres_v32", cell: 200 });
        const drive = (game.siteLayout && game.siteLayout.drive) || [];
        const nearDrive = (x, z) => {
          for (let i = 0; i < drive.length - 1; i++) {
            const [ax, az] = drive[i];
            const [bx2, bz] = drive[i + 1];
            const vx = bx2 - ax;
            const vz = bz - az;
            const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz)));
            if (Math.hypot(x - ax - vx * t, z - az - vz * t) < 1.9) return true;
          }
          return false;
        };
        for (const [tx, tz, radius, count] of [
          [8.13, -26.87, 4, 150],
          [11.1, -28.57, 3.6, 120],
          [-6.45, -34.37, 3.4, 110],
          [-17.28, 15.93, 3.2, 90],
          [13, 2.5, 2.6, 60],
        ]) {
          const n = mobile ? Math.round(count * 0.55) : count;
          for (let k = 0; k < n; k++) {
            const a = R(0, 2 * PI);
            const d = Math.sqrt(rnd()) * radius;
            const x = tx + Math.cos(a) * d;
            const z = tz + Math.sin(a) * d;
            if (nearDrive(x, z) || (game.wetAt && game.wetAt([x, z], 0.1))) continue;
            const s = R(0.06, 0.1);
            litter.add(0, [x, ground(x, z) + 0.008, z], [R(-0.2, 0.2), R(0, 2 * PI), R(-0.25, 0.25)], [s, s, s], pick(AUTUMN), R(0.75, 1.1));
            stats.leaves++;
          }
        }

        // --- Construction ------------------------------------------------------------------
        let triangles = 0;
        let meshes = 0;
        for (const [key, entry] of parts) {
          const geometry = entry.assembly.geometry();
          triangles += entry.assembly.triangles;
          const mesh = new THREE.Mesh(geometry, materials[entry.material]);
          mesh.name = "Objets_" + key.replace(/:/g, "_").replace(/-/g, "m") + "_v32";
          mesh.castShadow = entry.material !== "glow";
          mesh.receiveShadow = true;
          group.add(mesh);
          meshes++;
        }
        for (const lot of [pavers, litter]) {
          const built = lot.build(group, { castShadow: lot === pavers });
          meshes += built.length;
          triangles += lot.triangles;
        }
        game.scene.add(group);
        V32.detailsStats = { ...stats, meshes, triangles: Math.round(triangles), ms: Math.round(performance.now() - started) };
        return group;
      }

      let group = build();
      hooks.refreshShadows();
      hooks.invalidate();
      S.onTerrainEdit(game, "details", () => {
        S.disposeGroup(group);
        group = build();
        hooks.refreshShadows();
      });

      // Lanternes : allumées le soir, avec les lumières de la maison ; le verre, moins
      // blanc, laisse alors passer la lumière chaude de la bougie.
      const root = hooks.root;
      const frosted = glow.color.clone();
      const lit = new THREE.Color("#3d342a");
      return {
        get group() {
          return group;
        },
        get stats() {
          return V32.detailsStats;
        },
        update() {
          const mode = root && root.dataset ? root.dataset.nightMode22 : "day";
          const night = game.night22;
          const on = mode !== "day" && (!night || !night.houseLights || night.houseLights());
          const target = on ? 1.0 : 0.04;
          if (glow.emissiveIntensity === target) return false;
          glow.emissiveIntensity = target;
          glow.color.copy(on ? lit : frosted);
          return true;
        },
      };
    },
    76,
  );
})();
