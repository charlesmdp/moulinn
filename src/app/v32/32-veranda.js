// Moulin V32 — soubassement de la véranda.
//
// La véranda était posée au niveau du plancher du moulin alors que le terrain descend
// vers le bief : on voyait un vide de 40 cm à 1,40 m sous son plancher. On la pose sur
// un soubassement en moellons, du même appareil que les murs du moulin, qui descend
// jusqu'au sol. Là où le bief passe sous la véranda, le mur s'arrête sur un linteau de
// pierre au-dessus de l'eau, comme un coursier couvert.
(function () {
  "use strict";
  const V32 = globalThis.MoulinV32;

  const COURSE = 0.27; // hauteur d'une assise
  const THICKNESS = 0.34;
  const PALETTE = ["#8c8778", "#999180", "#827e70", "#a29985", "#938b7b", "#7f7a6c"];

  V32.register(
    "veranda",
    function (context) {
      const { THREE, game, hooks } = context;
      const group = game.scene.getObjectByName("Veranda_cote_deuxieme_etang");
      const floor = group && group.getObjectByName("Sol_veranda");
      const mill = game.scene.getObjectByName("Moulin");
      if (!floor || !game.terrainHeight) return null;
      group.updateWorldMatrix(true, true);

      // Coins du dessous du plancher, dans le repère du monde.
      floor.geometry.computeBoundingBox();
      const box = floor.geometry.boundingBox;
      const corners = [
        [box.min.x, box.min.z],
        [box.max.x, box.min.z],
        [box.max.x, box.max.z],
        [box.min.x, box.max.z],
      ].map(([x, z]) => new THREE.Vector3(x, box.min.y, z).applyMatrix4(floor.matrixWorld));
      const top = Math.min(...corners.map((c) => c.y)) + 0.02;
      const centre = corners.reduce((sum, c) => sum.add(c), new THREE.Vector3()).multiplyScalar(0.25);
      const millCentre = new THREE.Vector3();
      if (mill) mill.getWorldPosition(millCentre);

      const bief = (game.channels || []).find((c) => c.name === "Bief_du_moulin");
      const water = (x, z) => {
        if (!bief || !game.channelSample) return null;
        const s = game.channelSample([x, z], bief, 6);
        return s.distance < s.width / 2 + 0.28 ? s : null;
      };

      const positions = [];
      const normals = [];
      const colors = [];
      const uvs = [];
      const indices = [];
      const color = new THREE.Color();
      let seed = 7319;
      const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

      // Un moellon : boîte orientée (centre, demi-longueur le long du mur, hauteur).
      function block(cx, cy, cz, dirX, dirZ, halfLength, height, depth, tint) {
        const nx = -dirZ;
        const nz = dirX;
        const hx = halfLength;
        const hy = height / 2;
        const hz = depth / 2;
        color.set(tint).convertSRGBToLinear().multiplyScalar(0.9 + random() * 0.18);
        // [normale, u, v] avec u × v = normale (faces vues de l'extérieur).
        const faces = [
          [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
          [[-1, 0, 0], [0, 0, 1], [0, 1, 0]],
          [[0, 0, 1], [1, 0, 0], [0, 1, 0]],
          [[0, 0, -1], [0, 1, 0], [1, 0, 0]],
          [[0, 1, 0], [0, 0, 1], [1, 0, 0]],
          [[0, -1, 0], [1, 0, 0], [0, 0, 1]],
        ];
        for (const [n, u, v] of faces) {
          const base = positions.length / 3;
          for (const [su, sv] of [
            [-1, -1],
            [1, -1],
            [1, 1],
            [-1, 1],
          ]) {
            // Coordonnées locales (a le long du mur, b vertical, c vers l'extérieur).
            const a = n[0] * hx + u[0] * su * hx + v[0] * sv * hx;
            const b = n[1] * hy + u[1] * su * hy + v[1] * sv * hy;
            const c = n[2] * hz + u[2] * su * hz + v[2] * sv * hz;
            positions.push(cx + dirX * a + nx * c, cy + b, cz + dirZ * a + nz * c);
            normals.push(dirX * n[0] + nx * n[2], n[1], dirZ * n[0] + nz * n[2]);
            colors.push(color.r, color.g, color.b);
            uvs.push((cx + cz) * 0.6 + a * 0.6 + c * 0.6, cy * 0.6 + b * 0.6);
          }
          indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
        }
      }

      // Murs sur les côtés qui ne touchent pas le moulin.
      let blocks = 0;
      for (let i = 0; i < 4; i++) {
        const a = corners[i];
        const b = corners[(i + 1) % 4];
        const mid = a.clone().add(b).multiplyScalar(0.5);
        // Le côté le plus proche du centre du moulin est contre son mur : rien à bâtir.
        const toMill = Math.hypot(mid.x - millCentre.x, mid.z - millCentre.z);
        const others = corners.map((c, j) => c.clone().add(corners[(j + 1) % 4]).multiplyScalar(0.5));
        const closest = Math.min(...others.map((m) => Math.hypot(m.x - millCentre.x, m.z - millCentre.z)));
        if (mill && Math.abs(toMill - closest) < 1e-3) continue;

        const length = Math.hypot(b.x - a.x, b.z - a.z);
        let dirX = (b.x - a.x) / length;
        let dirZ = (b.z - a.z) / length;
        // Normale vers l'extérieur : le mur est posé en retrait sous le bord du plancher.
        let outX = -dirZ;
        let outZ = dirX;
        if ((mid.x - centre.x) * outX + (mid.z - centre.z) * outZ < 0) {
          outX = -outX;
          outZ = -outZ;
        }
        const inset = THICKNESS / 2 - 0.03;
        const ox = -outX * inset;
        const oz = -outZ * inset;
        const at = (t) => [a.x + dirX * t + ox, a.z + dirZ * t + oz];

        // Point le plus bas du terrain (ou du lit du bief) le long de ce côté.
        let lowest = top;
        for (let t = 0; t <= length + 1e-3; t += 0.2) lowest = Math.min(lowest, game.terrainHeight(...at(t)));
        const bottom = lowest - 0.3;

        // Passage du bief sous ce côté : le mur s'arrête sur un linteau.
        let first = -1;
        let last = -1;
        let level = 0;
        for (let t = 0; t <= length; t += 0.1) {
          const flow = water(...at(t));
          if (flow) {
            if (first < 0) first = t;
            last = t;
            level = flow.height;
          }
        }
        const opening = first >= 0 ? level + 0.42 : -Infinity;
        const keptRows = first >= 0 ? Math.max(0, Math.floor((top - opening) / COURSE)) : 0;
        const lintelTop = top - keptRows * COURSE;

        for (let row = 0; ; row++) {
          const yTop = top - row * COURSE;
          const yBottom = Math.max(bottom, yTop - COURSE);
          const h = yTop - yBottom;
          if (h < 0.05) break;
          let s = 0;
          let firstBlock = true;
          while (s < length - 0.02) {
            let len = firstBlock && row % 2 ? 0.24 + random() * 0.12 : 0.46 + random() * 0.36;
            firstBlock = false;
            let end = Math.min(length, s + len);
            if (length - end < 0.16) end = length;
            const t = (s + end) / 2;
            const [x, z] = at(t);
            const start = s;
            s = end;
            // Enterré : inutile. Au-dessus du bief : on laisse le passage de l'eau.
            if (yTop < game.terrainHeight(x, z) - 0.12) continue;
            if (first >= 0 && t > first - 0.3 && t < last + 0.3 && yBottom < lintelTop - 0.01) continue;
            block(x, yBottom + h / 2, z, dirX, dirZ, (end - start) / 2 - 0.006, h - 0.012, THICKNESS, PALETTE[(row * 5 + blocks) % PALETTE.length]);
            blocks++;
          }
          if (yBottom <= bottom) break;
        }
        if (first >= 0) {
          const from = Math.max(0, first - 0.42);
          const to = Math.min(length, last + 0.42);
          const [x, z] = at((from + to) / 2);
          const height = Math.max(0.1, lintelTop - opening);
          block(x, opening + height / 2, z, dirX, dirZ, (to - from) / 2, height - 0.01, THICKNESS + 0.04, "#8f8a7b");
          blocks++;
        }
      }
      if (!blocks) return null;

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
      geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
      geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
      geometry.setIndex(indices);
      const material = hooks.materials?.masonry || new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = "Soubassement_de_la_veranda_v32";
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      game.scene.add(mesh);
      hooks.refreshShadows();
      return null;
    },
    32,
  );
})();
