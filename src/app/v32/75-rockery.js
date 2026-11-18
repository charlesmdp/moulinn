// Moulin V32 — rocaille au bord de la cour (photo du talus le long de la route).
//
// Au pied de la rocaille, le long de la cour, le jardin montre :
//  - une petite niche voûtée en pierres sèches (ouverture d'environ 80 cm) : le jeu y
//    avait posé une fontaine à bassin ; on la rebâtit comme sur la photo, parement de
//    schiste en lits minces, claveaux rayonnants, voûte et fond dans l'ombre, joues et
//    dos maçonnés sous de grandes dalles, feuilles mortes au sol ;
//  - de gros blocs de granit arrondis et moussus, de part et d'autre de la niche et le
//    long du talus qui borde l'allée ;
//  - des strates rocheuses (boîtes grises) reprises en bancs de granit aux arêtes usées,
//    et les pierres à facettes de la pente refaites en granit, aux mêmes places ;
//  - des hostas vert-jaune au premier plan (à la place des boules d'arbustes du bord du
//    parterre), un hortensia pourpre, un grand rhododendron, des fougères entre les
//    blocs, les fleurs roses du camélia qui voûte l'escalier, et des feuilles tombées au
//    pied du talus.
(function () {
  "use strict";
  const V32 = globalThis.MoulinV32;

  const GRANITE = ["#c4bfb3", "#b5b0a5", "#cfc8b8", "#aba69c", "#bbb3a2", "#c7bfad", "#a9a398"];
  const SCHIST = ["#a89e8c", "#958c7c", "#b3a995", "#8a8274", "#9f927c", "#7f786b", "#aba08a"];
  const AUTUMN = ["#b8652a", "#9c5424", "#c98a3a", "#7d4a22", "#d4a045", "#8f6a2e", "#a3782f", "#6e5a2a", "#b04a26"];

  V32.register(
    "rockery",
    function (context) {
      const { THREE, game, hooks } = context;
      const S = V32.stones;
      const layout = game.siteLayout || {};
      if (!S || !game.scene || !game.terrainHeight || !layout.fountain) return null;
      const mobile = !!hooks.mobile;
      const foliage = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, side: THREE.DoubleSide, roughness: 0.72, metalness: 0, envMapIntensity: 0.15 });
      foliage.name = "Feuillages_de_la_rocaille_v32";
      const glossy = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, side: THREE.DoubleSide, roughness: 0.48, metalness: 0, envMapIntensity: 0.3 });
      glossy.name = "Feuilles_vernissees_v32";
      const shadeMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, map: S.rockTextures(hooks).map, roughness: 1, metalness: 0, envMapIntensity: 0 });
      shadeMaterial.name = "Creux_de_la_niche_v32";

      // Le décor est reconstruit d'un bloc : au chargement, puis après chaque retouche du
      // relief dans l'atelier (rochers, plantes et feuilles suivent le nouveau sol).
      let lodLots = [];
      function build() {
        const started = performance.now();
        const rnd = S.random(73129);
        const R = (a, b) => a + (b - a) * rnd();
        const pick = (list) => list[Math.floor(rnd() * list.length)];
        const ground = (x, z) => S.groundAt(game, x, z);
        const group = new THREE.Group();
        group.name = "Rocaille_du_talus_v32";
        group.userData.exportSkip = true;

        // Formes : moellons de schiste, couvertines, bancs de granit, rochers.
        const shapes = [];
        const add = (list) => {
          const first = shapes.length;
          shapes.push(...list);
          return first;
        };
        // Formes simplifiées (même ordre) pour le lointain.
        const lowShapes = [];
        const ledge = (i, detail) => S.boulderGeometry({ detail, seed: 321 + i, squash: 1, bottom: -2, bump: 0.09, cuts: 4, box: 3.2, smoothness: 0.55 });
        const rock = (i, detail) => S.boulderGeometry({ detail, seed: 331 + i, squash: 0.82, bump: 0.2, cuts: 9, cutDepth: [0.52, 0.8], bottom: -0.34, smoothness: 0.38 });
        const SLAB = add([0, 1, 2].map((i) => S.blockGeometry({ size: [0.26, 0.075, 0.3], bevel: 0.01, jitter: 0.008, dome: 0.005, chip: 0.9, seed: 301 + i })));
        lowShapes.push(...[0, 1, 2].map(() => S.boxShape([0.26, 0.075, 0.3])));
        const CAP = add([0, 1].map((i) => S.blockGeometry({ size: [0.5, 0.09, 0.45], bevel: 0.016, jitter: 0.014, dome: 0.01, chip: 1, seed: 311 + i })));
        lowShapes.push(...[0, 1].map(() => S.boxShape([0.5, 0.09, 0.45])));
        const LEDGE = add([0, 1, 2].map((i) => ledge(i, mobile ? 1 : 2)));
        lowShapes.push(...[0, 1, 2].map((i) => ledge(i, mobile ? 0 : 1)));
        const BOULDER = add([0, 1, 2].map((i) => rock(i, mobile ? 1 : 2)));
        lowShapes.push(...[0, 1, 2].map((i) => rock(i, mobile ? 0 : 1)));
        const walls = S.rockMaterial(hooks, "murets", { moss: 0.5, damp: 0.14 });
        const rocks = S.rockMaterial(hooks, "rochers", { moss: 0.55, damp: 0.12 });
        const lod = { lowShapes, lodDistance: mobile ? 30 : 45 };
        const stones = new S.Lot(shapes, walls, { name: "Pierres_de_la_niche_v32", ...lod });
        const boulders = new S.Lot(shapes, rocks, { name: "Rochers_de_granit_v32", ...lod });
        lodLots = [stones, boulders];
        const shade = new S.Assembly();
        const stats = { niche: 0, ledges: 0, boulders: 0, hostas: 0, rhododendron: 0, flowers: 0, leaves: 0 };

        // --- Niche voûtée en pierres sèches -------------------------------------------------
        const f = layout.fountain;
        const yaw = f.angle;
        const cos = Math.cos(yaw);
        const sin = Math.sin(yaw);
        // Repère de la niche : x le long du parement, y vertical, z vers la cour.
        const world = (lx, ly, lz) => [f.centre[0] + cos * lx + sin * lz, f.baseLevel + ly, f.centre[1] - sin * lx + cos * lz];
        const HALF = 0.82; // demi-largeur du parement
        const OPEN = 0.4; // demi-ouverture
        const SPRING = 0.3; // naissance de la voûte
        const RING = 0.2; // longueur des claveaux
        const FACE = 0.2; // parement (z)
        const DEPTH = 0.62; // profondeur de la niche
        const crest = (x) => 1.02 - 0.18 * (x / HALF) ** 2;
        const slab = (lx, ly, lz, sx, sy, sz, roll, tint, palette = SCHIST, rollJitter = 0.025) => {
          const [x, y, z] = world(lx, ly, lz);
          stones.add(SLAB + Math.floor(rnd() * 3), [x, y, z], [R(-0.02, 0.02), yaw + R(-0.025, 0.025), roll + R(-rollJitter, rollJitter)], [sx / 0.26, sy / 0.075, sz / 0.3], pick(palette), tint * R(0.85, 1.12));
          stats.niche++;
        };
        // Parement : lits minces jusqu'à la naissance de l'arc, puis au-dessus de l'arc.
        const layCourse = (y0, h) => {
          const y1 = y0 + h;
          let limit;
          if (y1 <= SPRING + 1e-3) limit = OPEN;
          else if (y0 >= SPRING + OPEN + RING) limit = 0;
          else limit = Math.sqrt(Math.max(0, (OPEN + RING) ** 2 - Math.max(0, y0 - SPRING) ** 2));
          const runs = limit > 0 ? [[-HALF, -limit], [limit, HALF]] : [[-HALF, HALF]];
          for (const [from, to] of runs) {
            let s = from - R(0, 0.12);
            while (s < to - 0.02) {
              const len = R(0.15, 0.34);
              const a = Math.max(s, from);
              let b = Math.min(s + len, to);
              if (to - b < 0.07) b = to;
              s = b === to ? to : s + len;
              if (b - a < 0.05) continue;
              const x = (a + b) / 2;
              if (y0 + h / 2 > crest(x)) continue;
              slab(x, y0 + h / 2, FACE - 0.15 + R(-0.012, 0.012), b - a - 0.012, h - 0.008, 0.3, 0, 1);
            }
          }
        };
        let y = -0.06;
        while (y < SPRING - 1e-3) {
          let h = R(0.055, 0.1);
          if (SPRING - (y + h) < 0.04) h = SPRING - y;
          layCourse(y, h);
          y += h;
        }
        while (y < 1.04) {
          const h = R(0.055, 0.11);
          layCourse(y, h);
          y += h;
        }
        // Claveaux rayonnants et clé un peu saillante.
        const VOUSSOIRS = 11;
        for (let i = 0; i < VOUSSOIRS; i++) {
          const t = (Math.PI * (i + 0.5)) / VOUSSOIRS;
          const key = i === (VOUSSOIRS - 1) / 2;
          const r = OPEN + RING / 2 + (key ? 0.02 : R(-0.01, 0.015));
          slab(Math.cos(t) * r, SPRING + Math.sin(t) * r, FACE - 0.15 + (key ? 0.02 : 0), RING + (key ? 0.05 : R(-0.02, 0.02)), key ? 0.13 : R(0.1, 0.118), 0.32, t, 0.95, SCHIST, 0.03);
        }
        // Voûte (trois rangs de claveaux) et fond, dans l'ombre.
        for (let ring = 0; ring < 3; ring++) {
          const z = FACE - 0.36 - ring * 0.17;
          for (let i = 0; i < 9; i++) {
            const t = (Math.PI * (i + 0.5)) / 9;
            slab(Math.cos(t) * (OPEN + 0.045), SPRING + Math.sin(t) * (OPEN + 0.045), z, 0.1, 0.13, 0.17, t, 0.42, SCHIST, 0.05);
          }
          for (const side of [-1, 1])
            for (let k = 0; k < 3; k++) slab(side * (OPEN + 0.04), 0.05 + k * 0.09, z, 0.1, 0.08, 0.17, 0, 0.42);
        }
        for (let k = 0; k < 7; k++) {
          const ly = 0.05 + k * 0.095;
          const w = ly > SPRING ? Math.sqrt(Math.max(0.01, OPEN * OPEN - (ly - SPRING) ** 2)) : OPEN;
          let s = -w;
          while (s < w - 0.04) {
            const len = Math.min(R(0.14, 0.26), w - s);
            slab(s + len / 2, ly, FACE - DEPTH - 0.05, len - 0.01, 0.085, 0.12, 0, 0.36);
            s += len;
          }
        }
        // Grandes pierres plates sur le dessus du parement.
        for (const [x, len] of [
          [-0.5, 0.62],
          [0.08, 0.7],
          [0.6, 0.5],
        ]) {
          const [wx, wy, wz] = world(x, crest(x) + 0.02, FACE - 0.2);
          stones.add(CAP + Math.floor(rnd() * 2), [wx, wy, wz], [R(-0.05, 0.05), yaw + R(-0.1, 0.1), R(-0.05, 0.05)], [len / 0.5, R(0.9, 1.2), 1.1], pick(SCHIST), R(0.9, 1.05));
        }
        // Corps de la niche, derrière le parement : joues et dos en pierres sèches, couvert
        // de grandes dalles (la niche se voit aussi de côté et d'en haut, depuis la cour).
        const BODY = 0.72; // demi-largeur du corps
        const INNER = OPEN + 0.145; // face intérieure des joues
        const BACK = FACE - DEPTH - 0.36; // arrière du corps
        const ROOF = 0.88; // dessus des joues et du dos
        /** Un lit de pierres de 15 à 30 cm entre from et to ; put(a, b) pose chacune. */
        const run = (from, to, put) => {
          let s = from - R(0, 0.1);
          while (s < to - 0.02) {
            const len = R(0.15, 0.3);
            const a = Math.max(s, from);
            let b = Math.min(s + len, to);
            if (to - b < 0.07) b = to;
            s = b === to ? to : s + len;
            if (b - a >= 0.05) put(a, b);
          }
        };
        for (let y0 = -0.06; y0 < ROOF - 0.02; ) {
          let h = R(0.055, 0.11);
          if (ROOF - (y0 + h) < 0.04) h = ROOF - y0;
          const mid = y0 + h / 2;
          // Joues : pierres couchées dans la profondeur, de l'arrière du parement au dos.
          for (const side of [-1, 1]) run(BACK, FACE - 0.3, (a, b) => slab((side * (INNER + BODY)) / 2, mid, (a + b) / 2, BODY - INNER - 0.01, h - 0.008, b - a - 0.012, 0, 0.92));
          // Dos : lits parallèles au parement.
          run(-BODY, BODY, (a, b) => slab((a + b) / 2, mid, BACK + 0.08, b - a - 0.012, h - 0.008, 0.16, 0, 0.92));
          y0 += h;
        }
        // Couverture : deux rangs de grandes dalles.
        for (const [z, depth] of [
          [FACE - 0.53, 0.44],
          [BACK + 0.2, 0.46],
        ])
          for (const [x, len] of [
            [-0.52, 0.5],
            [0.02, 0.62],
            [0.54, 0.52],
          ]) {
            const thick = R(0.85, 1.1);
            const [wx, wy, wz] = world(x + R(-0.03, 0.03), ROOF + 0.045 * thick - 0.005, z + R(-0.02, 0.02));
            stones.add(CAP + Math.floor(rnd() * 2), [wx, wy, wz], [R(-0.04, 0.04), yaw + R(-0.08, 0.08), R(-0.04, 0.04)], [len / 0.5, thick, depth / 0.45], pick(SCHIST), R(0.88, 1.02));
            stats.niche++;
          }
        // Deux fougères sur la couverture (posées plus bas, avec les autres).
        const nicheFerns = [
          [...world(-0.42, ROOF + 0.07, BACK + 0.22), 0.3],
          [...world(0.48, ROOF + 0.07, FACE - 0.62), 0.26],
        ];
        // Ombre du creux : fond, voûte et sol de terre (roche assombrie).
        shade.setOrigin(...world(0, 0, 0), yaw);
        shade.box([0, 0.4, FACE - DEPTH - 0.12], [OPEN * 2 + 0.2, 0.9, 0.06], "#2a2722");
        for (const side of [-1, 1]) shade.box([side * (OPEN + 0.1), 0.35, FACE - DEPTH / 2 - 0.1], [0.08, 0.8, DEPTH + 0.1], "#2a2722");
        shade.box([0, SPRING + OPEN + 0.12, FACE - DEPTH / 2 - 0.1], [OPEN * 2 + 0.25, 0.1, DEPTH + 0.1], "#2a2722");
        shade.box([0, -0.02, FACE - DEPTH / 2], [OPEN * 2 + 0.1, 0.06, DEPTH + 0.1], "#4a3b2a");
        // L'ancienne fontaine (bassin, bec, filet d'eau) disparaît.
        const fountain = game.scene.getObjectByName("Petite_fontaine_au_pied_de_la_rocaille");
        if (fountain) S.detach(game, S.meshesNamed(fountain, ...fountain.children.filter((c) => c.isMesh).map((c) => c.name)));

        // --- Bancs de granit à la place des strates en boîtes -------------------------------
        const strata = S.meshesNamed(game.scene, "Strates_rocheuses_au_pied_du_jardin")[0];
        const ledges = [];
        if (strata && strata.geometry.attributes.position.count % 24 === 0) {
          strata.updateWorldMatrix(true, false);
          const position = strata.geometry.attributes.position;
          const v = new THREE.Vector3();
          const faces = [];
          const basis = new THREE.Matrix4();
          const q = new THREE.Quaternion();
          const e = new THREE.Euler();
          for (let block = 0; block < position.count / 24; block++) {
            faces.length = 0;
            for (let face = 0; face < 6; face++) {
              const c = new THREE.Vector3();
              for (let k = 0; k < 4; k++) c.add(v.fromBufferAttribute(position, block * 24 + face * 4 + k).applyMatrix4(strata.matrixWorld));
              faces.push(c.multiplyScalar(0.25));
            }
            const centre = faces.reduce((sum, c) => sum.add(c), new THREE.Vector3()).multiplyScalar(1 / 6);
            const ax = faces[0].clone().sub(faces[1]);
            const ay = faces[2].clone().sub(faces[3]);
            const sx = ax.length();
            const sy = ay.length();
            const sz = faces[4].distanceTo(faces[5]);
            ax.normalize();
            ay.addScaledVector(ax, -ay.dot(ax)).normalize();
            const az = new THREE.Vector3().crossVectors(ax, ay);
            basis.makeBasis(ax, ay, az);
            e.setFromQuaternion(q.setFromRotationMatrix(basis), "YXZ");
            ledges.push({ x: centre.x, y: centre.y, z: centre.z, sx, sy, sz });
            boulders.add(LEDGE + Math.floor(rnd() * 3), centre.toArray(), [e.x, e.y + R(-0.08, 0.08), e.z], [(sx / 2) * 1.04, (sy / 2) * R(1.08, 1.25), (sz / 2) * 1.02], pick(GRANITE), R(0.82, 1.08));
            stats.ledges++;
          }
          S.detach(game, [strata]);
        }

        // --- Gros blocs de granit le long du talus ------------------------------------------
        const route = (layout.hillRoutes || [])[0];
        const clear = (x, z, margin) => {
          if (game.hillCorridorAt && game.hillCorridorAt(x, z, margin)) return false;
          if (layout.forecourt && S.inside(x, z, layout.forecourt) && !S.inside(x, z, layout.rearBed || [])) return margin < 0;
          return true;
        };
        const boulder = (x, z, r, squash = 1, tint = 1) => {
          // Pied enterré sous le point le plus bas de l'emprise (pas de vide côté pente).
          let low = Infinity;
          for (const [dx, dz] of [
            [0, 0],
            [r, 0],
            [-r, 0],
            [0, r],
            [0, -r],
          ])
            low = Math.min(low, ground(x + dx * 0.8, z + dz * 0.8));
          boulders.add(BOULDER + Math.floor(rnd() * 3), [x, low + r * 0.06, z], [R(-0.1, 0.1), R(0, Math.PI * 2), R(-0.1, 0.1)], [r * R(0.95, 1.3), r * squash * R(0.8, 1.05), r * R(0.8, 1.05)], pick(GRANITE), tint * R(0.88, 1.08));
          stats.boulders++;
        };
        // De part et d'autre de la niche, dans la bordure (comme sur la photo).
        for (const [x, z, r, squash] of S.nicheBoulders(layout)) boulder(x, z, r, squash);
        // Le long du talus qui borde l'allée, au nord de l'escalier.
        // Groupés par deux ou trois, gros blocs au pied de la pente, plus petits au-dessus.
        const bank = [
          [-6.85, -18.95, 0.66],
          [-7.6, -19.45, 0.38],
          [-7.15, -20.05, 0.26],
          [-6.55, -21.75, 0.74],
          [-7.35, -21.35, 0.42],
          [-6.95, -22.55, 0.3],
          [-6.05, -24.15, 0.52],
          [-6.75, -24.55, 0.34],
          [-5.55, -25.6, 0.4],
        ];
        for (const [x, z, r] of bank) if (clear(x, z, r * 0.6)) boulder(x, z, r, R(0.8, 1));
        // Pierres de la pente (boules à facettes du jeu) : même place, en granit.
        const lumps = S.meshesNamed(game.scene, "Pierres_et_lichens_sur_la_pente")[0];
        const slope = S.decodeLumps(lumps, 240);
        for (const l of slope) {
          const r = (l.rx + l.rz) / 2;
          boulders.add(BOULDER + Math.floor(rnd() * 3), [l.x, l.y - l.ry * 0.1, l.z], [R(-0.1, 0.1), R(0, Math.PI * 2), R(-0.1, 0.1)], [r * 1.05, l.ry * 1.25, r * 0.95], pick(GRANITE), R(0.85, 1.05));
          stats.boulders++;
        }
        if (slope.length) S.detach(game, [lumps]);
        // Quelques pierres moussues sur la pente de la rocaille.
        for (const [x, z, r] of [
          [-8.2, -7.1, 0.24],
          [-7.6, -9.05, 0.2],
          [-8.4, -12.95, 0.22],
          [-9.25, -16.05, 0.26],
        ])
          if (clear(x, z, r)) boulder(x, z, r, 0.8, 0.95);

        // --- Feuillages : hostas, rhododendron, camélia en fleurs ---------------------------
        const hostaLeaf = S.leafGeometry({ width: 0.62, segments: 4, curl: 0.3, cup: 0.18, rib: 0.025, base: 0.62 });
        const narrowLeaf = S.leafGeometry({ width: 0.3, segments: 3, curl: 0.12, cup: 0.1, rib: 0.02, base: 0.7 });
        const fallenLeaf = S.leafGeometry({ width: 0.5, segments: 2, curl: 0.04, cup: 0.12, rib: 0.01, base: 0.85 });
        const blossom = S.flowerGeometry({ petals: 6, cup: 0.3 });
        const hostas = new S.Lot([hostaLeaf], foliage, { name: "Hostas_v32", cell: 200 });
        const rhodo = new S.Lot([narrowLeaf], glossy, { name: "Rhododendron_v32", cell: 200 });
        const flowers = new S.Lot([blossom], foliage, { name: "Fleurs_de_camelia_v32", cell: 200 });
        const litter = new S.Lot([fallenLeaf], foliage, { name: "Feuilles_tombees_v32", cell: 200 });
        // Têtes d'hortensia : boule de fleurettes (teinte mouchetée par sommet).
        const floret = (() => {
          const g = new THREE.IcosahedronGeometry(1, 1);
          const dot = S.random(577);
          const color = [];
          for (let i = 0; i < g.attributes.position.count; i++) {
            const v = 0.78 + dot() * 0.3;
            color.push(v, v * (0.92 + dot() * 0.1), v);
          }
          g.setAttribute("color", new THREE.Float32BufferAttribute(color, 3));
          return g;
        })();
        const heads = new S.Lot([floret], foliage, { name: "Hortensia_pourpre_v32", cell: 200 });
        const frond = S.leafGeometry({ width: 0.34, segments: 5, curl: 0.55, cup: 0.08, rib: 0.02, base: 0.62 });
        const ferns = new S.Lot([frond], foliage, { name: "Fougeres_du_talus_v32", cell: 200 });
        const fern = (x, z, size, y0 = ground(x, z)) => {
          const n = Math.round(R(9, 13));
          for (let k = 0; k < n; k++)
            ferns.add(0, [x, y0 + 0.02, z], [-R(0.35, 0.95), (k / n) * Math.PI * 2 + R(-0.2, 0.2), R(-0.2, 0.2)], [size, size, size * R(0.85, 1.15)], pick(["#4f7d3a", "#5d8a42", "#46723a", "#6a8f45"]), R(0.85, 1.05));
          stats.ferns = (stats.ferns || 0) + 1;
        };
        // Fougères entre les blocs du talus et au pied de la niche.
        for (const [x, z, size] of [
          [-7.45, -18.9, 0.42],
          [-6.2, -19.75, 0.36],
          [-7.95, -21.9, 0.46],
          [-7.05, -20.95, 0.34],
          [-6.95, -23.35, 0.4],
          [-7.55, -24.15, 0.38],
          [-5.95, -25.05, 0.32],
        ])
          if (clear(x, z, 0.1)) fern(x, z, size);
        for (const [x, y, z, size] of nicheFerns) fern(x, z, size, y);

        const hosta = (x, z, size, palette) => {
          const y0 = ground(x, z);
          const n = Math.round(R(20, 27));
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + R(-0.2, 0.2);
            const len = size * R(0.75, 1.1);
            const inner = i % 3 === 0;
            hostas.add(0, [x + Math.sin(a) * 0.03, y0 + R(0.01, 0.05), z + Math.cos(a) * 0.03], [-(inner ? R(0.85, 1.1) : R(0.45, 0.8)), a, R(-0.15, 0.15)], [len, len, len * (inner ? 0.85 : 1)], pick(palette), R(0.85, 1.1));
          }
          stats.hostas++;
        };
        const LIME = ["#a8c23f", "#b7cb4f", "#94b336", "#c2d060", "#9fbd45"];
        // Au premier plan du parterre, les boules d'arbustes laissent la place aux hostas.
        const frontStrip = (x, z) => x > -8.15 && z < -6.7 && z > -12.8 && S.inside(x, z, layout.rearBed || []);
        const shrubs = S.meshesNamed(game.scene, "Arbustes_du_parterre");
        if (shrubs.length) stats.shrubsRemoved = S.detach(game, shrubs, (x, y, z) => !frontStrip(x, z), 240).triangles / 80;
        // Leurs fleurs (posées sur les boules, à 20 cm près) partent avec elles.
        const blooms = S.meshesNamed(game.scene, "Fleurs_du_parterre");
        const nearStrip = (x, z) => [0, 0.25, -0.25].some((dx) => [0, 0.25, -0.25].some((dz) => frontStrip(x + dx, z + dz)));
        if (blooms.length) S.detach(game, blooms, (x, y, z) => !nearStrip(x, z), 60);
        const BLUE = ["#5f8a62", "#6d9468", "#577f5c"];
        for (const [x, z, s] of [
          [-7.2, -7.25, 0.36],
          [-7.05, -8.25, 0.4],
          [-6.95, -9.2, 0.38],
          [-7.3, -10.05, 0.34],
          [-7.05, -10.85, 0.4],
          [-7.45, -11.65, 0.36],
          [-7.8, -12.4, 0.3],
          [-7.85, -8.75, 0.3],
          [-7.9, -10.45, 0.32],
          [-7.7, -7.75, 0.28],
          [-8.05, -11.3, 0.28],
        ])
          if (S.inside(x, z, layout.rearBed || [])) hosta(x, z, s, LIME);
        // Hortensia pourpre au bout du parterre (sur la photo, à gauche du talus).
        const hydrangea = (x, z, size) => {
          const y0 = ground(x, z);
          for (let i = 0; i < 30; i++) {
            const a = i * 2.39996;
            const r = Math.sqrt((i + 0.5) / 30) * 0.3 * size;
            hostas.add(0, [x + Math.cos(a) * r, y0 + R(0.12, 0.62) * size, z + Math.sin(a) * r], [-R(0.05, 0.55), a, R(-0.25, 0.25)], [0.22 * size, 0.22 * size, 0.26 * size], pick(["#3d6534", "#476f3a", "#35592f"]), R(0.85, 1.05));
          }
          for (let k = 0; k < 10; k++) {
            const a = k * 2.39996 + R(-0.3, 0.3);
            const r = R(0.05, 0.4) * size;
            heads.add(0, [x + Math.cos(a) * r, y0 + R(0.55, 0.82) * size, z + Math.sin(a) * r], [R(-0.3, 0.3), R(0, 6), R(-0.3, 0.3)], [0.12 * size, 0.1 * size, 0.12 * size], pick(["#7a2a3a", "#8c3246", "#6b2436", "#963a50"]), R(0.85, 1.1));
          }
          stats.hydrangea = (stats.hydrangea || 0) + 1;
        };
        if (S.inside(-7.9, -6.35, layout.rearBed || [])) hydrangea(-7.9, -6.35, 1.1);
        for (const [x, z, s] of [
          [-7.45, -18.3, 0.3],
          [-7.85, -20.4, 0.26],
          [-7.6, -23.3, 0.3],
          [-6.55, -20.55, 0.22],
        ])
          if (clear(x, z, 0.2)) hosta(x, z, s, BLUE);

        // Rhododendron : rosettes de feuilles vernissées au bout des rameaux.
        const rhodoAt = [-10.2, -12.75];
        if (clear(rhodoAt[0], rhodoAt[1], 0.9)) {
          const [cx, cz] = rhodoAt;
          const base = ground(cx, cz);
          const rx = 1.05;
          const ry = 0.95;
          const rz = 0.95;
          const tips = mobile ? 34 : 60;
          for (let i = 0; i < tips; i++) {
            // Répartition de Fibonacci sur la demi-ellipsoïde haute.
            const t = (i + 0.5) / tips;
            const cy = 1 - t * 1.15;
            const r = Math.sqrt(Math.max(0, 1 - cy * cy));
            const a = i * 2.39996;
            const nx = Math.cos(a) * r;
            const nz = Math.sin(a) * r;
            const px = cx + nx * rx;
            const py = base + ry + cy * ry;
            const pz = cz + nz * rz;
            const out = Math.atan2(nx, nz);
            const autumn = rnd() < 0.08;
            for (let k = 0; k < 6; k++) {
              const spin = (k / 6) * Math.PI * 2;
              rhodo.add(0, [px, py, pz], [-0.35 - cy * 0.45 + Math.cos(spin) * 0.45, out + Math.sin(spin) * 0.9, R(-0.3, 0.3)], [0.19, 0.19, R(0.16, 0.22)], autumn && k < 2 ? pick(["#d1a23a", "#c9782c"]) : pick(["#2f5a2b", "#3a6a33", "#2c5230", "#35602f"]), R(0.85, 1.1));
            }
          }
          const body = new S.Assembly().setOrigin(cx, base, cz);
          body.part(S.primitive("ico", 1), [0, ry * 0.95, 0], [0, 0, 0], [rx * 0.86, ry * 0.8, rz * 0.86], "#1d3a1d");
          for (let k = 0; k < 4; k++) {
            const a = (k / 4) * Math.PI * 2 + 0.4;
            body.tube([Math.cos(a) * 0.12, 0, Math.sin(a) * 0.12], [Math.cos(a) * 0.5, 0.75, Math.sin(a) * 0.5], 0.035, "#5b4a38", 5, 0.02);
          }
          const bodyMesh = new THREE.Mesh(body.geometry(), foliage);
          bodyMesh.name = "Coeur_du_rhododendron_v32";
          bodyMesh.castShadow = true;
          bodyMesh.receiveShadow = true;
          group.add(bodyMesh);
          stats.rhododendron = tips * 6;
        }

        // Fleurs roses du camélia qui voûte l'escalier, et pétales tombés.
        const camellia = S.meshesNamed(game.scene, "Camelias_en_voute_naturelle")[0];
        if (camellia) {
          camellia.updateWorldMatrix(true, false);
          const p = camellia.geometry.attributes.position;
          const n = camellia.geometry.attributes.normal;
          const normalMatrix = new THREE.Matrix3().getNormalMatrix(camellia.matrixWorld);
          const v = new THREE.Vector3();
          const w = new THREE.Vector3();
          const q = new THREE.Quaternion();
          const e = new THREE.Euler();
          const up = new THREE.Vector3(0, 1, 0);
          const wanted = mobile ? 140 : 260;
          const PINK = ["#f07aa0", "#e8608e", "#f59bb7", "#dc5a86", "#f28cad"];
          const pickRnd = S.random(911);
          for (let tries = 0; tries < wanted * 6 && stats.flowers < wanted; tries++) {
            const i = Math.floor(pickRnd() * p.count);
            w.fromBufferAttribute(n, i).applyMatrix3(normalMatrix).normalize();
            if (w.y < -0.25) continue;
            v.fromBufferAttribute(p, i).applyMatrix4(camellia.matrixWorld).addScaledVector(w, 0.02);
            e.setFromQuaternion(q.setFromUnitVectors(up, w), "YXZ");
            const s = R(0.07, 0.1);
            flowers.add(0, v.toArray(), [e.x, e.y, e.z], [s, s, s], pick(PINK), R(0.95, 1.15));
            stats.flowers++;
          }
          const [cx, cz] = layout.camellia ? layout.camellia.centre : [-9.35, -17];
          for (let i = 0; i < 46; i++) {
            const a = R(0, Math.PI * 2);
            const d = Math.sqrt(rnd()) * 2.3;
            const x = cx + Math.cos(a) * d;
            const z = cz + Math.sin(a) * d;
            const s = R(0.035, 0.05);
            litter.add(0, [x, ground(x, z) + 0.012, z], [R(-0.15, 0.15), R(0, 6.28), R(-0.15, 0.15)], [s, s, s], pick(PINK), R(0.8, 1));
          }
        }

        // --- Feuilles tombées au pied du talus et dans la niche -----------------------------
        const edge = [
          [-6.2, -9],
          [-7.2, -14],
          [-6, -18.5],
          [-5.6, -23.5],
        ];
        const leaf = (x, z, lift = 0.006) => {
          const s = R(0.06, 0.1);
          litter.add(0, [x, ground(x, z) + lift, z], [R(-0.2, 0.2), R(0, Math.PI * 2), R(-0.25, 0.25)], [s, s, s], pick(AUTUMN), R(0.75, 1.1));
          stats.leaves++;
        };
        for (let i = 0; i < edge.length - 1; i++) {
          const [ax, az] = edge[i];
          const [bx, bz] = edge[i + 1];
          const len = Math.hypot(bx - ax, bz - az);
          // Normale vers la cour (est).
          const nx = -(bz - az) / len;
          const nz = (bx - ax) / len;
          const count = Math.round(len * (mobile ? 16 : 30));
          for (let k = 0; k < count; k++) {
            const t = rnd();
            // Accumulées au pied du talus, de plus en plus rares vers la cour.
            const d = -Math.log(1 - rnd() * 0.97) * 0.24 - 0.04;
            const x = ax + (bx - ax) * t + nx * d;
            const z = az + (bz - az) * t + nz * d;
            if (game.hillCorridorAt && game.hillCorridorAt(x, z, 0.1)) continue;
            leaf(x, z);
          }
        }
        for (let k = 0; k < 26; k++) {
          const [x, , z] = world(R(-OPEN + 0.08, OPEN - 0.08), 0, R(FACE - DEPTH + 0.05, FACE + 0.1));
          const s = R(0.06, 0.09);
          litter.add(0, [x, f.baseLevel + 0.012 + R(0, 0.03), z], [R(-0.4, 0.4), R(0, 6.28), R(-0.4, 0.4)], [s, s, s], pick(AUTUMN), R(0.55, 0.85));
        }

        // --- Construction ------------------------------------------------------------------
        const meshes = [...stones.build(group), ...boulders.build(group), ...hostas.build(group), ...rhodo.build(group), ...flowers.build(group), ...heads.build(group), ...ferns.build(group)];
        for (const mesh of litter.build(group, { castShadow: false })) meshes.push(mesh);
        const shadeMesh = new THREE.Mesh(shade.geometry(), shadeMaterial);
        shadeMesh.name = "Creux_de_la_niche_v32";
        shadeMesh.receiveShadow = true;
        group.add(shadeMesh);
        game.scene.add(group);
        const lots = [stones, boulders, hostas, rhodo, flowers, heads, ferns, litter];
        V32.rockeryStats = {
          ...stats,
          meshes: meshes.length + 2,
          triangles: lots.reduce((sum, lot) => sum + lot.triangles, 0) + shade.triangles,
          ms: Math.round(performance.now() - started),
        };
        return group;
      }

      let group = build();
      hooks.refreshShadows();
      hooks.invalidate();
      S.onTerrainEdit(game, "rockery", () => {
        S.disposeGroup(group);
        group = build();
        hooks.refreshShadows();
      });
      return {
        get group() {
          return group;
        },
        get stats() {
          return V32.rockeryStats;
        },
        update() {
          let changed = false;
          for (const lot of lodLots) if (lot.updateLod(game.camera)) changed = true;
          return changed;
        },
      };
    },
    75,
  );
})();
