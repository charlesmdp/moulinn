// Moulin V32 — murets de pierres sèches.
//
// Les murets du jardin (chemin de la colline, entrée du domaine, berge de la terrasse,
// bief, mur de soutènement derrière la dépendance, bordure de la rocaille, culées et
// appuis des petits ponts) étaient des boîtes texturées. On les rebâtit pierre par
// pierre, au même tracé, à la même hauteur et à la même épaisseur :
//  - assises de schiste plat (granit pour la berge, le bief et le mur de 3 m, moellons
//    arrondis pour la bordure), joints décalés d'une assise à l'autre, boutisses ;
//  - couvertines de pierres plates débordantes, où la mousse s'installe ;
//  - un cœur sombre en retrait : les joints restent dans l'ombre et l'on ne voit pas
//    au travers du mur ;
//  - quelques plantes des vieux murs : valériane rouge sur les couvertines, fougères
//    dans les joints.
// Les marches de l'escalier de la rocaille deviennent des dalles de granit (même emprise,
// même niveau de marche) et la maçonnerie des bâtiments prend des joints et des teintes
// moins réguliers, sans changer de forme.
// Les pierres sont instanciées (quelques formes, une teinte par pierre, voir 73-stones).
// Les deux murets de l'allée d'entrée (Muret_entree_cote_colline et
// Muret_entree_cote_jardin) ne sont pas repris : ils vont disparaître.
(function () {
  "use strict";
  const V32 = globalThis.MoulinV32;

  const SKIP = new Set(["Muret_entree_cote_colline", "Muret_entree_cote_jardin"]);

  const PALETTES = {
    schiste: ["#b7ae9d", "#a39b8c", "#c4bba9", "#9a9387", "#b0a590", "#8f887c", "#bdb3a0", "#a79c88", "#c9c0ae", "#978d7c", "#ad9f86"],
    granit: ["#c2beb4", "#b3afa5", "#cdc7ba", "#a9a59c", "#d4cdbf", "#b8b1a2", "#aba497", "#c3b9a6"],
    couvertine: ["#bdb6a8", "#aca597", "#c8c0b0", "#9f998d", "#cfc6b4", "#b2a898"],
    moellon: ["#c6bfb0", "#b2ab9d", "#d1c9b8", "#a7a195", "#bdb4a3", "#cbbfa6"],
    dalle: ["#b9b5ab", "#aaa69c", "#c4beb0", "#a19d94", "#b3ab9b"],
  };

  // Familles de pierres : dimensions de référence des formes, assises et longueurs.
  const FAMILIES = {
    schiste: { shape: [0.4, 0.11, 0.5], bevel: 0.015, jitter: 0.01, dome: 0.007, chip: 0.8, variants: 3, course: [0.07, 0.15], length: [0.24, 0.56], joint: 0.012, setback: 0.018, header: 0.12 },
    granit: { shape: [0.55, 0.24, 0.6], bevel: 0.03, jitter: 0.016, dome: 0.014, chip: 0.6, variants: 2, course: [0.17, 0.3], length: [0.36, 0.78], joint: 0.012, setback: 0.014, header: 0.08 },
    moellon: { shape: [0.32, 0.18, 0.4], bevel: 0.03, jitter: 0.016, dome: 0.018, chip: 1, variants: 2, course: [0.13, 0.2], length: [0.22, 0.42], joint: 0.01, setback: 0.016, header: 0.1 },
    couvertine: { shape: [0.44, 0.09, 0.62], bevel: 0.016, jitter: 0.012, dome: 0.008, chip: 0.9, variants: 2 },
    dalle: { shape: [1.0, 0.2, 0.36], bevel: 0.022, jitter: 0.008, dome: 0.004, chip: 0.7, variants: 2 },
  };

  V32.register(
    "walls",
    function (context) {
      const { THREE, game, hooks } = context;
      const S = V32.stones;
      if (!S || !game.scene || !game.terrainHeight) return null;
      const started = performance.now();
      const mobile = !!hooks.mobile;
      // Téléphone : pierres un peu plus grandes, donc moins nombreuses.
      const coarse = mobile ? 1.3 : 1;
      const rnd = S.random(40211);
      const R = (a, b) => a + (b - a) * rnd();
      const pick = (list) => list[Math.floor(rnd() * list.length)];
      const FLOOR = 1.08;

      // Formes : chaque famille a ses variantes, toutes dans un même lot.
      const shapes = [];
      const lowShapes = [];
      const family = {};
      let seed = 11;
      for (const [name, spec] of Object.entries(FAMILIES)) {
        family[name] = { ...spec, first: shapes.length };
        const low = S.boxShape(spec.shape);
        for (let v = 0; v < spec.variants; v++) {
          shapes.push(S.blockGeometry({ size: spec.shape, bevel: spec.bevel, jitter: spec.jitter, dome: spec.dome, chip: spec.chip, seed: seed++ }));
          lowShapes.push(low);
        }
      }
      const material = S.rockMaterial(hooks, "murets", { moss: 0.5, damp: 0.14 });
      // Au-delà de 45 m (30 m sur téléphone), les secteurs passent en pavés simples.
      const lot = new S.Lot(shapes, material, { name: "Pierres_des_murets_v32", lowShapes, lodDistance: mobile ? 30 : 45 });
      const core = new S.Assembly();
      const report = [];
      const plants = [];

      function addStone(kind, x, y, z, yaw, pitch, roll, sx, sy, sz, palette, tint = 1) {
        const f = family[kind];
        const shape = f.first + Math.floor(rnd() * f.variants);
        const dark = rnd() < 0.1 ? 0.76 : 1;
        lot.add(
          shape,
          [x, y, z],
          [pitch, yaw, roll],
          [Math.max(0.03, sx) / f.shape[0], Math.max(0.02, sy) / f.shape[1], Math.max(0.03, sz) / f.shape[2]],
          pick(PALETTES[palette || kind]),
          tint * dark * R(0.87, 1.12),
        );
      }

      /** Hauteurs d'assises tirées au hasard jusqu'à remplir height. */
      function courses(kind, height) {
        const [lo, hi] = family[kind].course.map((v) => v * coarse);
        const list = [];
        let rest = height;
        while (rest > 1e-3) {
          let h = R(lo, hi);
          if (rest - h < lo * 0.6) h = rest;
          list.push(h);
          rest -= h;
        }
        return list;
      }

      /**
       * Pose un tronçon droit de p0 à p1 : assises à joints décalés, couvertines, cœur.
       *  wall : { kind, palette, base(x, z), height, width, cap: {height, width} | null,
       *           bury, skip(x, z, y), ext0, ext1 }
       */
      function segment(wall, p0, p1, ext0 = 0, ext1 = 0) {
        const f = family[wall.kind];
        const dx = p1[0] - p0[0];
        const dz = p1[1] - p0[1];
        const length = Math.hypot(dx, dz);
        if (length < 0.05) return;
        const ux = dx / length;
        const uz = dz / length;
        const nx = -uz;
        const nz = ux;
        const yaw = Math.atan2(-uz, ux);
        const at = (s) => [p0[0] + ux * s, p0[1] + uz * s];
        const from = -ext0;
        const to = length + ext1;
        const joint = f.joint;
        const bury = wall.bury ?? 0.1;
        const [minLength, maxLength] = f.length.map((v) => v * coarse);
        // Étendue des pierres posées, assise par assise (pour le cœur d'un muret interrompu).
        const rows = [];
        let y = 0;
        courses(wall.kind, wall.height).forEach((h, k) => {
          const row = [];
          rows.push(row);
          let s = from - R(0, maxLength) * (k % 2 ? 0.6 : 0.2);
          while (s < to - 0.02) {
            let len = rnd() < f.header ? R(minLength * 0.55, minLength) : R(minLength, maxLength);
            const a = Math.max(s, from);
            let b = Math.min(s + len, to);
            if (to - b < minLength * 0.45) b = to;
            s = b === to ? to : s + len;
            if (b - a < 0.05) continue;
            const [x, z] = at((a + b) / 2);
            if (wall.skip && wall.skip(x, z, y + h / 2)) continue;
            if (row.length && a <= row[row.length - 1][1] + 1e-6) row[row.length - 1][1] = b;
            else row.push([a, b]);
            const ya = wall.base(...at(a));
            const yb = wall.base(...at(b));
            const extra = k === 0 ? bury : 0;
            const cy = (ya + yb) / 2 + y + h / 2 - extra / 2;
            const off = R(-1, 1) * f.setback;
            addStone(
              wall.kind,
              x + nx * off,
              cy,
              z + nz * off,
              yaw + R(-0.02, 0.02),
              R(-0.022, 0.022),
              Math.atan2(yb - ya, b - a) + R(-0.022, 0.022),
              b - a - joint,
              h + extra - joint * 0.7,
              wall.width + R(-0.035, 0.012),
              wall.palette,
            );
          }
          y += h;
        });
        // Couvertines : pierres plates, un peu débordantes, légèrement de guingois.
        if (wall.cap) {
          const cf = family.couvertine;
          let s = from - R(0, 0.25);
          while (s < to - 0.02) {
            const len = R(0.26, 0.52) * coarse;
            const a = Math.max(s, from);
            let b = Math.min(s + len, to);
            if (to - b < 0.14) b = to;
            s = b === to ? to : s + len;
            if (b - a < 0.06) continue;
            const [x, z] = at((a + b) / 2);
            if (wall.skip && wall.skip(x, z, wall.height)) continue;
            const ya = wall.base(...at(a));
            const yb = wall.base(...at(b));
            const t = wall.cap.height * R(0.82, 1.14);
            const off = R(-1, 1) * 0.02;
            addStone(
              "couvertine",
              x + nx * off,
              (ya + yb) / 2 + wall.height + t / 2 - 0.012,
              z + nz * off,
              yaw + R(-0.05, 0.05),
              R(-0.035, 0.035),
              Math.atan2(yb - ya, b - a) + R(-0.03, 0.03),
              b - a - cf.shape[0] * 0.03,
              t,
              wall.cap.width + R(-0.03, 0.035),
              "couvertine",
            );
          }
        }
        // Cœur : caissons sombres en retrait sous les pierres (aussi aux bouts libres du
        // muret). Muret interrompu (skip) : seulement là où toutes les assises ont leurs
        // pierres, sans quoi le caisson se verrait au bout des assises plus courtes.
        const inset = 0.035;
        const start = ext0 ? from : from + inset;
        const end = ext1 ? to : to - inset;
        let runs = [[start, end]];
        if (wall.skip) {
          const cover = rows.reduce((list, row) => (list ? intersect(list, row) : row), null) || [];
          runs = cover.map(([a, b]) => [Math.max(a + 0.03, start), Math.min(b - 0.03, end)]).filter(([a, b]) => b - a > 0.05);
        }
        for (const [runFrom, runTo] of runs) {
          const pieces = Math.max(1, Math.ceil((runTo - runFrom) / 0.7));
          for (let i = 0; i < pieces; i++) {
            const a = runFrom + ((runTo - runFrom) * i) / pieces;
            const b = runFrom + ((runTo - runFrom) * (i + 1)) / pieces;
            const [x, z] = at((a + b) / 2);
            const yb = wall.base(x, z);
            const top = wall.height - 0.02;
            const bottom = -bury;
            core.setOrigin(x, yb, z, yaw);
            core.box([0, (top + bottom) / 2, 0], [b - a + 0.02, top - bottom, Math.max(0.05, wall.width - inset * 2)], wall.coreColor || "#8b8272");
          }
        }
      }

      /** Muret le long d'une ligne brisée ; les tronçons se recouvrent aux angles. */
      function wallAlong(wall, line) {
        for (let i = 0; i < line.length - 1; i++) {
          const ext0 = i > 0 ? wall.width / 2 : wall.ext0 || 0;
          const ext1 = i < line.length - 2 ? wall.width / 2 : wall.ext1 || 0;
          segment(wall, line[i], line[i + 1], ext0, ext1);
        }
      }

      /** Intersection de deux listes d'intervalles triés [[a, b], …]. */
      function intersect(first, second) {
        const out = [];
        let i = 0;
        let j = 0;
        while (i < first.length && j < second.length) {
          const a = Math.max(first[i][0], second[j][0]);
          const b = Math.min(first[i][1], second[j][1]);
          if (b > a) out.push([a, b]);
          if (first[i][1] < second[j][1]) i++;
          else j++;
        }
        return out;
      }

      /** Distance d'un point à une ligne brisée. */
      function lineDistance(x, z, line) {
        let best = Infinity;
        for (let i = 0; i < line.length - 1; i++) {
          const [ax, az] = line[i];
          const [bx, bz] = line[i + 1];
          const vx = bx - ax;
          const vz = bz - az;
          const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz || 1)));
          best = Math.min(best, Math.hypot(x - ax - vx * t, z - az - vz * t));
        }
        return best;
      }

      // Pierres sous un vase posé sur un muret : une dalle à la bonne hauteur.
      const pots = [];
      game.scene.traverse((object) => {
        if (object.name === "Poterie_sur_muret") pots.push(object.getWorldPosition(new THREE.Vector3()));
      });

      // --- 1. Murets de la colline (siteLayout.hillWalls) --------------------------------
      const hillWalls = ((game.siteLayout && game.siteLayout.hillWalls) || []).filter((w) => w.points && w.points.length > 1);
      const rebuilt = hillWalls.filter((w) => !SKIP.has(w.name));
      const skipped = hillWalls.filter((w) => SKIP.has(w.name));
      for (const w of rebuilt) {
        const wall = {
          kind: "schiste",
          base: (x, z) => game.terrainHeight(x, z) - 0.045,
          height: w.height,
          width: w.width,
          cap: { height: 0.09, width: w.width + 0.1 },
        };
        wallAlong(wall, w.points);
        // Plantes des vieux murs : valériane rouge sur la couvertine, fougères dans les joints.
        for (let i = 0; i < w.points.length - 1; i++) {
          const [ax, az] = w.points[i];
          const [bx, bz] = w.points[i + 1];
          const len = Math.hypot(bx - ax, bz - az);
          for (let s = R(0.5, 2); s < len - 0.3; s += R(1.8, 3.6) * (mobile ? 1.6 : 1)) {
            const t = s / len;
            const x = ax + (bx - ax) * t;
            const z = az + (bz - az) * t;
            const nx = -(bz - az) / len;
            const nz = (bx - ax) / len;
            const side = rnd() < 0.5 ? -1 : 1;
            if (rnd() < 0.5) plants.push({ kind: "valeriane", x: x + nx * side * 0.08, y: wall.base(x, z) + w.height + 0.07, z: z + nz * side * 0.08, nx: nx * side, nz: nz * side });
            else plants.push({ kind: "fougere", x: x + nx * side * (w.width / 2 + 0.01), y: wall.base(x, z) + w.height * R(0.3, 0.7), z: z + nz * side * (w.width / 2 + 0.01), nx: nx * side, nz: nz * side });
          }
        }
        for (const pot of pots) {
          if (lineDistance(pot.x, pot.z, w.points) > w.width) continue;
          addStone("couvertine", pot.x, pot.y - 0.04, pot.z, R(0, Math.PI), R(-0.02, 0.02), R(-0.02, 0.02), 0.5, 0.08, w.width + 0.08, "couvertine", 0.95);
        }
      }
      const hillBatch = S.meshesNamed(game.scene, "Murets_de_schiste_du_chemin_et_de_l_entree");
      // On garde les triangles des murets non repris (allée d'entrée).
      const keepHill = (x, y, z) => {
        let replaced = Infinity;
        for (const w of rebuilt) replaced = Math.min(replaced, lineDistance(x, z, w.points) - w.width / 2);
        let other = Infinity;
        for (const w of skipped) other = Math.min(other, lineDistance(x, z, w.points) - w.width / 2);
        return !(replaced < 0.3 && replaced <= other);
      };
      report.push(["colline", rebuilt.length, S.detach(game, hillBatch, keepHill)]);

      // --- 2. Muret transversal de l'entrée du domaine et piles du portail ---------------
      const entrance = S.meshesNamed(game.scene, "Couvertine_muret_transversal_entree");
      if (entrance.length) {
        const boxes = entrance.map(S.orientedBox);
        const middle = boxes.reduce((sum, b) => sum + b.x, 0) / boxes.length;
        for (const side of [-1, 1]) {
          const list = boxes.filter((b) => Math.sign(b.x - middle) === side || (side > 0 && b.x === middle));
          if (!list.length) continue;
          const ux = Math.cos(list[0].yaw);
          const uz = -Math.sin(list[0].yaw);
          list.sort((a, b) => a.x * ux + a.z * uz - (b.x * ux + b.z * uz));
          const first = list[0];
          const last = list[list.length - 1];
          const half = first.sx / 2;
          wallAlong(
            {
              kind: "schiste",
              base: (x, z) => game.terrainHeight(x, z) + 0.0025,
              height: 0.76,
              width: 0.51,
              cap: { height: 0.085, width: 0.61 },
            },
            [
              [first.x - ux * half, first.z - uz * half],
              [last.x + ux * half, last.z + uz * half],
            ],
          );
        }
      }
      const pillars = S.meshesNamed(game.scene, "Pile_basse_du_portail").map(S.orientedBox);
      const hats = S.meshesNamed(game.scene, "Chapeau_pile_entree").map(S.orientedBox);
      const pillarGroups = [];
      for (const b of pillars) {
        const group = pillarGroups.find((g) => Math.hypot(g[0].x - b.x, g[0].z - b.z) < 0.3);
        if (group) group.push(b);
        else pillarGroups.push([b]);
      }
      for (const group of pillarGroups) {
        const b = group[0];
        const bottom = Math.min(...group.map((g) => g.y - g.sy / 2));
        const top = Math.max(...group.map((g) => g.y + g.sy / 2));
        const ux = Math.cos(b.yaw);
        const uz = -Math.sin(b.yaw);
        let y = bottom - 0.06;
        let k = 0;
        while (y < top - 0.05) {
          const h = Math.min(top - y, R(0.16, 0.24));
          // Assises alternées : un bloc entier, puis deux demi-blocs croisés.
          if (k % 2 === 0) addStone("granit", b.x, y + h / 2, b.z, b.yaw + R(-0.03, 0.03), R(-0.02, 0.02), R(-0.02, 0.02), b.sx - 0.01, h - 0.01, b.sz - 0.01, "schiste");
          else
            for (const side of [-1, 1]) {
              const px = b.x + ux * side * b.sx * 0.25;
              const pz = b.z + uz * side * b.sx * 0.25;
              addStone("granit", px, y + h / 2, pz, b.yaw + R(-0.04, 0.04), R(-0.02, 0.02), R(-0.02, 0.02), b.sx / 2 - 0.012, h - 0.01, b.sz - 0.02, "schiste");
            }
          y += h;
          k++;
        }
        const hat = hats.find((c) => Math.hypot(c.x - b.x, c.z - b.z) < 0.4);
        if (hat) addStone("couvertine", hat.x, hat.y, hat.z, hat.yaw + R(-0.03, 0.03), R(-0.02, 0.02), R(-0.02, 0.02), hat.sx, hat.sy, hat.sz, "couvertine");
      }
      report.push([
        "entree",
        entrance.length,
        S.detach(game, [
          ...entrance,
          ...S.meshesNamed(game.scene, "Pierre_du_muret_transversal_entree", "Pile_basse_du_portail", "Chapeau_pile_entree"),
        ]),
      ]);

      // --- 3. Muret de berge de la terrasse (et ses angles) -------------------------------
      const bank = S.meshesNamed(game.scene, "Muret_de_berge");
      const angles = S.meshesNamed(game.scene, "Angle_muret").map(S.orientedBox);
      for (const mesh of bank) {
        const b = S.orientedBox(mesh);
        const ux = Math.cos(b.yaw);
        const uz = -Math.sin(b.yaw);
        const p0 = [b.x - (ux * b.sx) / 2, b.z - (uz * b.sx) / 2];
        const p1 = [b.x + (ux * b.sx) / 2, b.z + (uz * b.sx) / 2];
        const angleAt = (p) => angles.some((a) => Math.hypot(a.x - p[0], a.z - p[1]) < 0.05);
        const bottom = b.y - b.sy / 2;
        segment(
          {
            kind: "granit",
            base: () => bottom,
            height: b.sy - 0.07,
            width: b.sz + 0.045,
            cap: { height: 0.08, width: b.sz + 0.1 },
            bury: 0.12,
          },
          p0,
          p1,
          angleAt(p0) ? b.sz / 2 : 0,
          angleAt(p1) ? b.sz / 2 : 0,
        );
      }
      // Le parement de moellons posé sur ces boîtes part avec elles.
      report.push(["berge", bank.length, S.detach(game, [...bank, ...S.meshesNamed(game.scene, "Angle_muret", "Parement_irregulier_des_berges_maconnees")])]);

      // --- 4. Bief maçonné de la terrasse -------------------------------------------------
      const bief = (game.channels || []).find((c) => c.name === "Bief_du_moulin");
      const biefStones = S.meshesNamed(game.scene, "Pierres_et_couvertines_du_bief");
      if (bief && bief.widths && biefStones.length) {
        const points = bief.line.slice(-3);
        const widths = bief.widths.slice(-3);
        for (const e of [-1, 1]) {
          // Même tracé que le jeu : parement décalé de largeur/2 + 0,22 m de l'axe.
          const side = points.map((p, i) => {
            const u = points[Math.max(0, i - 1)];
            const w = points[Math.min(points.length - 1, i + 1)];
            const lx = w[0] - u[0];
            const lz = w[1] - u[1];
            const len = Math.hypot(lx, lz);
            const offset = widths[i] / 2 + 0.22;
            return [p[0] - (lz / len) * offset * e, p[1] + (lx / len) * offset * e];
          });
          wallAlong(
            {
              kind: "granit",
              palette: "granit",
              base: () => 0.046,
              height: FLOOR + 0.03 - 0.046,
              width: 0.45,
              cap: { height: 0.09, width: 0.55 },
              bury: 0.2,
              coreColor: "#b3ac9e",
            },
            side,
          );
        }
        report.push(["bief", 2, S.detach(game, biefStones)]);
      }

      // --- 5. Mur de soutènement de 3 m derrière la dépendance ----------------------------
      const rearWall = game.siteLayout && game.siteLayout.rearWall;
      const rear = S.meshesNamed(game.scene, "Mur_de_soutenement_3m", "Couronnement_du_mur");
      if (rearWall && rearWall.length > 1 && rear.length) {
        wallAlong(
          {
            kind: "granit",
            base: () => FLOOR + 0.348,
            height: 3.28 - 0.348,
            width: 0.64,
            cap: { height: 0.12, width: 0.78 },
            ext0: 0.06,
            ext1: 0.06,
          },
          rearWall,
        );
        report.push(["soutenement", 1, S.detach(game, rear)]);
      }

      // --- 6. Bordure basse de la rocaille (moellons), coupée par la niche --------------
      const bed = game.siteLayout && game.siteLayout.rearBed;
      const fountain = game.siteLayout && game.siteLayout.fountain;
      const border = S.meshesNamed(game.scene, "Bordure_basse_du_parterre");
      if (bed && bed.length > 10 && border.length) {
        const niche = fountain ? fountain.centre : [Infinity, Infinity];
        const blocks = S.nicheBoulders(game.siteLayout);
        wallAlong(
          {
            kind: "moellon",
            palette: "moellon",
            base: () => FLOOR - 0.0125,
            height: 0.465,
            width: 0.42,
            cap: null,
            skip: (x, z) => Math.hypot(x - niche[0], z - niche[1]) < 0.78 || blocks.some(([bx, bz, r]) => r >= 0.35 && Math.hypot(x - bx, z - bz) < r * 0.85),
          },
          bed.slice(0, 11),
        );
        report.push(["bordure", 1, S.detach(game, border)]);
      }

      // --- 7. Culées du passage sur le bief et appuis des petits ponts ------------------
      const piers = S.meshesNamed(game.scene, "Culee_pierre_passage_bief", "Appui_de_petit_pont");
      for (const mesh of piers) {
        const b = S.orientedBox(mesh);
        // Le long de la plus grande dimension horizontale.
        const alongX = b.sx >= b.sz;
        const yaw = alongX ? b.yaw : b.yaw + Math.PI / 2;
        const length = alongX ? b.sx : b.sz;
        const ux = Math.cos(yaw);
        const uz = -Math.sin(yaw);
        const bottom = b.y - b.sy / 2;
        segment(
          {
            kind: b.sy > 0.3 ? "granit" : "schiste",
            palette: "granit",
            base: () => bottom,
            height: b.sy,
            width: alongX ? b.sz : b.sx,
            cap: null,
            bury: 0.04,
          },
          [b.x - (ux * length) / 2, b.z - (uz * length) / 2],
          [b.x + (ux * length) / 2, b.z + (uz * length) / 2],
        );
      }
      report.push(["culees", piers.length, S.detach(game, piers)]);

      // --- 8. Marches et pas de pierre de l'escalier de la rocaille (même emprise) ------
      const steps = S.meshesNamed(game.scene, "Marches_irregulieres_et_pas_de_pierre")[0];
      const slabs = S.decodeBoxes(steps);
      for (const b of slabs)
        addStone("dalle", b.x, b.y - 0.004, b.z, b.rotation[1] + R(-0.015, 0.015), b.rotation[0], b.rotation[2] + R(-0.008, 0.008), b.sx, b.sy + 0.008, b.sz, "dalle", 1);
      if (slabs.length) report.push(["marches", slabs.length, S.detach(game, [steps])]);

      // --- 9. Maçonnerie des bâtiments : pierres posées à la main ------------------------
      // Joints un peu irréguliers, léger relief et teintes plus variées (granit chaud ou
      // froid, quelques pierres rouillées ou plus sombres) ; la forme ne change pas.
      const tints = (r) => {
        const x = r();
        const b = 0.9 + r() * 0.17;
        if (x < 0.07) return [0.83, 0.82, 0.8];
        if (x < 0.12) return [1.04 * b, 0.95 * b, 0.84 * b];
        if (x < 0.55) return [1.02 * b, b, 0.95 * b];
        return [0.97 * b, 0.99 * b, 1.02 * b];
      };
      let roughened = 0;
      for (const name of ["Maconnerie_de_granit", "Pierres_des_cheminees", "Pierres_dependance", "Pierres_aile_gauche", "Soubassement_de_la_veranda_v32"])
        for (const mesh of S.meshesNamed(game.scene, name)) roughened += S.roughen(game, mesh, { seed: 90 + roughened, tints });
      report.push(["batiments", roughened, { meshes: 0, triangles: 0, missing: 0 }]);

      // --- Construction ------------------------------------------------------------------
      const group = new THREE.Group();
      group.name = "Murets_pierres_seches_v32";
      group.userData.exportSkip = true;
      const meshes = lot.build(group);
      // Plantes des murets (feuilles et fleurs instanciées).
      const foliage = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, side: THREE.DoubleSide, roughness: 0.75, metalness: 0, envMapIntensity: 0.15 });
      foliage.name = "Plantes_des_murets_v32";
      const bloom = (() => {
        const g = new THREE.IcosahedronGeometry(1, 0);
        g.setAttribute("color", new THREE.Float32BufferAttribute(new Array(g.attributes.position.count * 3).fill(1), 3));
        return g;
      })();
      const leaves = new S.Lot([S.leafGeometry({ width: 0.34, segments: 3, curl: 0.25, cup: 0.1, rib: 0.02 }), S.leafGeometry({ width: 0.3, segments: 5, curl: 0.6, cup: 0.06, rib: 0.02, base: 0.6 })], foliage, { name: "Plantes_des_murets_v32", cell: 200 });
      const heads = new S.Lot([bloom], foliage, { name: "Valeriane_en_fleurs_v32", cell: 200 });
      for (const p of plants) {
        const out = Math.atan2(p.nx, p.nz);
        if (p.kind === "valeriane") {
          for (let k = 0; k < 9; k++) leaves.add(0, [p.x, p.y, p.z], [-R(0.3, 1.1), R(0, 2 * Math.PI), 0], [0.2, 0.2, R(0.16, 0.24)], pick(["#7d9a78", "#6f8f6c", "#88a483"]), R(0.9, 1.05));
          const count = Math.round(R(3, 6));
          for (let k = 0; k < count; k++) {
            const a = R(0, 2 * Math.PI);
            const r = R(0.04, 0.16);
            heads.add(0, [p.x + Math.cos(a) * r, p.y + R(0.22, 0.4), p.z + Math.sin(a) * r], [R(-0.3, 0.3), a, 0], [0.045, 0.06, 0.045], pick(["#d6507a", "#c84064", "#e07a9a", "#b83a5e"]), R(0.9, 1.1));
          }
        } else {
          for (let k = 0; k < 7; k++) leaves.add(1, [p.x, p.y, p.z], [-R(-0.2, 0.7), out + R(-1.1, 1.1), R(-0.3, 0.3)], [0.24, 0.24, R(0.2, 0.3)], pick(["#4f7d3a", "#5d8a42", "#46723a"]), R(0.85, 1.05));
        }
      }
      meshes.push(...leaves.build(group), ...heads.build(group));
      // Cœur : même roche, assombrie (petites pierres de calage dans l'ombre des joints).
      const rock = S.rockTextures(hooks);
      const coreMaterial = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0.8, 0.8, 0.8),
        vertexColors: true,
        map: rock.map,
        normalMap: rock.normal,
        roughness: 1,
        metalness: 0,
        envMapIntensity: 0.05,
      });
      coreMaterial.name = "Coeur_des_murets_v32";
      const coreMesh = new THREE.Mesh(core.geometry(), coreMaterial);
      coreMesh.name = "Coeur_des_murets_v32";
      coreMesh.receiveShadow = true;
      coreMesh.castShadow = false;
      group.add(coreMesh);
      game.scene.add(group);
      hooks.refreshShadows();
      hooks.invalidate();
      V32.wallsStats = {
        stones: lot.count,
        triangles: lot.triangles + core.triangles + leaves.triangles + heads.triangles,
        plants: plants.length,
        meshes: meshes.length + 1,
        ms: Math.round(performance.now() - started),
        parts: report.map(([name, count, detached]) => ({ name, count, ...detached })),
      };
      return {
        group,
        stats: V32.wallsStats,
        update() {
          return lot.updateLod(game.camera);
        },
      };
    },
    74,
  );
})();
