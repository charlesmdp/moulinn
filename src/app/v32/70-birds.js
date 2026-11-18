// Moulin V32 — oiseaux plus vrais.
//
// La V31 assemblait ses oiseaux avec des sphères et des cônes. Ce module garde leurs
// déplacements (cortège du cygne et des oies, hérons pêcheurs, cormorans plongeurs,
// vols au-dessus des étangs) mais remplace leurs corps par des silhouettes modelées :
// corps fuselés lissés, cous courbes qui s'affinent, ailes repliées, plumages peints
// (miroirs, barres, masques, collier), becs et pattes aux bonnes couleurs. Il ajoute
// une famille de colverts qui barbotent et basculent pour se nourrir.
(function () {
  "use strict";
  const V32 = globalThis.MoulinV32;
  const THREE = globalThis.THREE;
  const { clamp, smoothstep, lerp } = V32;

  const linear = (hex) => new THREE.Color(hex).convertSRGBToLinear();
  const mixColor = (a, b, t) => a.clone().lerp(b, clamp(t, 0, 1));

  // ---------------------------------------------------------------- géométrie
  /** Accumule des morceaux indexés (position, normale, couleur) puis les fusionne. */
  function Builder() {
    const positions = [];
    const normals = [];
    const colours = [];
    const indices = [];
    const matrix = new THREE.Matrix4();
    const normalMatrix = new THREE.Matrix3();
    const v = new THREE.Vector3();
    function add(geometry, colour, transform) {
      const g = geometry.index ? geometry : geometry;
      if (!g.attributes.normal) g.computeVertexNormals();
      const base = positions.length / 3;
      if (transform) {
        matrix.copy(transform);
        normalMatrix.getNormalMatrix(matrix);
      }
      const p = g.attributes.position;
      const n = g.attributes.normal;
      const c = g.attributes.color;
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i);
        if (transform) v.applyMatrix4(matrix);
        positions.push(v.x, v.y, v.z);
        v.fromBufferAttribute(n, i);
        if (transform) v.applyMatrix3(normalMatrix).normalize();
        normals.push(v.x, v.y, v.z);
        if (c) colours.push(c.getX(i), c.getY(i), c.getZ(i));
        else if (typeof colour === "function") {
          const col = colour(p.getX(i), p.getY(i), p.getZ(i));
          colours.push(col.r, col.g, col.b);
        } else colours.push(colour.r, colour.g, colour.b);
      }
      if (g.index) for (let i = 0; i < g.index.count; i++) indices.push(base + g.index.getX(i));
      else for (let i = 0; i < p.count; i++) indices.push(base + i);
      return this;
    }
    function build() {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
      geometry.setAttribute("color", new THREE.Float32BufferAttribute(colours, 3));
      geometry.setIndex(indices);
      geometry.computeBoundingSphere();
      return geometry;
    }
    return { add, build };
  }

  /**
   * Corps fuselé : sections elliptiques le long de z (de la queue vers le poitrail).
   * s = { z, y, w (demi-largeur), h (demi-hauteur), flat (aplatissement du dessous) }.
   * colour(x, y, z, u, side) → THREE.Color, u = 0 (queue) → 1 (avant), side = -1 dessous → 1 dos.
   */
  function loft(sections, colour, radial = 16) {
    const positions = [];
    const colours = [];
    const indices = [];
    const n = sections.length;
    const total = sections[n - 1].z - sections[0].z;
    for (let i = 0; i < n; i++) {
      const s = sections[i];
      for (let j = 0; j < radial; j++) {
        const a = (j / radial) * Math.PI * 2;
        const side = Math.sin(a);
        let y = side * s.h;
        if (y < 0) y *= 1 - (s.flat || 0);
        const x = Math.cos(a) * s.w;
        positions.push(x, s.y + y, s.z);
        const c = colour(x, s.y + y, s.z, (s.z - sections[0].z) / total, side);
        colours.push(c.r, c.g, c.b);
      }
    }
    for (let i = 0; i < n - 1; i++)
      for (let j = 0; j < radial; j++) {
        const a = i * radial + j;
        const b = i * radial + ((j + 1) % radial);
        const c = (i + 1) * radial + j;
        const d = (i + 1) * radial + ((j + 1) % radial);
        indices.push(a, c, b, b, c, d);
      }
    // Bouchons aux deux bouts.
    const capStart = positions.length / 3;
    const first = sections[0];
    const last = sections[n - 1];
    positions.push(0, first.y, first.z - 0.001, 0, last.y, last.z + 0.001);
    const c0 = colour(0, first.y, first.z, 0, 0);
    const c1 = colour(0, last.y, last.z, 1, 0);
    colours.push(c0.r, c0.g, c0.b, c1.r, c1.g, c1.b);
    for (let j = 0; j < radial; j++) {
      indices.push(capStart, j, (j + 1) % radial);
      const o = (n - 1) * radial;
      indices.push(capStart + 1, o + ((j + 1) % radial), o + j);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colours, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }

  /** Tube le long d'une courbe, rayon variable (cou, pattes, bec). */
  function tube(points, radius, colour, radial = 10, segments = 16) {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, "centripetal");
    const frames = curve.computeFrenetFrames(segments, false);
    const positions = [];
    const colours = [];
    const indices = [];
    const point = new THREE.Vector3();
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      curve.getPointAt(t, point);
      const r = typeof radius === "function" ? radius(t) : radius;
      const N = frames.normals[i];
      const B = frames.binormals[i];
      for (let j = 0; j < radial; j++) {
        const a = (j / radial) * Math.PI * 2;
        const cx = Math.cos(a);
        const cy = Math.sin(a);
        positions.push(point.x + r * (cx * N.x + cy * B.x), point.y + r * (cx * N.y + cy * B.y), point.z + r * (cx * N.z + cy * B.z));
        const c = typeof colour === "function" ? colour(t, a) : colour;
        colours.push(c.r, c.g, c.b);
      }
    }
    for (let i = 0; i < segments; i++)
      for (let j = 0; j < radial; j++) {
        const a = i * radial + j;
        const b = i * radial + ((j + 1) % radial);
        const c = (i + 1) * radial + j;
        const d = (i + 1) * radial + ((j + 1) % radial);
        indices.push(a, c, b, b, c, d);
      }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colours, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }

  const unitSphere = new THREE.SphereGeometry(1, 14, 10);
  function ellipsoid(builder, centre, radii, colour, rotation = [0, 0, 0]) {
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(...centre),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
      new THREE.Vector3(...radii),
    );
    builder.add(unitSphere, colour, m);
  }
  /** Bec : cône aplati avec une pointe, de la base vers l'avant (axe +z local). */
  function beak(builder, base, length, width, height, colour, tipColour = colour, droop = 0, hook = 0) {
    const sections = [];
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      sections.push({
        z: base[2] + t * length,
        y: base[1] - droop * t * t - (t > 0.8 ? hook * (t - 0.8) * 5 : 0),
        w: width * (1 - t * 0.82),
        h: height * (1 - t * 0.7),
        flat: 0.2,
      });
    }
    builder.add(loft(sections, (x, y, z, u) => mixColor(colour, tipColour, smoothstep(0.55, 1, u)), 8));
  }
  /** Aile repliée : fuseau aplati posé sur le flanc, se terminant en pointe vers l'arrière. */
  function foldedWing(builder, side, params, colour) {
    const { x, y, z0, z1, width, thickness, lift = 0.05, tilt = 0.3 } = params;
    const sections = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      const bulge = Math.sin(Math.pow(t, 0.8) * Math.PI);
      sections.push({ z: lerp(z0, z1, t), y: y + lift * (1 - t), w: width * (0.25 + 0.75 * bulge), h: thickness * (0.3 + 0.7 * bulge), flat: 0 });
    }
    const geometry = loft(sections, (px, py, pz, u, s) => colour(u, s, px), 10);
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(side * x, 0, 0),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, side * tilt)),
      new THREE.Vector3(1, 1, 1),
    );
    builder.add(geometry, null, m);
  }

  // ---------------------------------------------------------------- espèces
  const C = {
    white: linear("#f4f3ec"),
    whiteShade: linear("#d8dbd6"),
    cream: linear("#ece6d4"),
    black: linear("#15181a"),
    swanBeak: linear("#e8753a"),
    gooseBeak: linear("#f09a3e"),
    gooseLeg: linear("#e98e45"),
    greyBack: linear("#7c7a70"),
    greyBar: linear("#a9a79c"),
    greyBelly: linear("#c9c6ba"),
    greyHead: linear("#6f6b60"),
    pinkLeg: linear("#d99a8e"),
    mallardGreen: linear("#1f5a3a"),
    mallardGreen2: linear("#2e7a4f"),
    chestnut: linear("#6b3b27"),
    mallardGrey: linear("#b8b8b0"),
    mallardDark: linear("#2a2a2c"),
    speculum: linear("#3448a8"),
    duckBeakM: linear("#d8c53b"),
    duckBeakF: linear("#b8753d"),
    henBrown: linear("#8b6a48"),
    henDark: linear("#4f3b29"),
    henLight: linear("#c2a37a"),
    duckLeg: linear("#e38d3c"),
    heronGrey: linear("#6f7c84"),
    heronDark: linear("#2c3337"),
    heronWhite: linear("#eceee9"),
    heronBeak: linear("#d9b03c"),
    heronLeg: linear("#9c8a55"),
    cormorant: linear("#23272a"),
    cormorantBronze: linear("#4a4131"),
    cormorantThroat: linear("#e7d7a5"),
    cormorantBeak: linear("#6d6a61"),
    gullGrey: linear("#b9c2c6"),
    eyeRing: linear("#2b2b2b"),
  };

  /** Cygne tuberculé, oie blanche, oie cendrée. Origine : surface de l'eau, avant = +z. */
  function waterfowl(kind) {
    const swan = kind === "swan";
    const grey = kind === "grey";
    const L = swan ? 1.05 : 0.78;
    const W = swan ? 0.24 : 0.2;
    const H = swan ? 0.17 : 0.15;
    const baseY = swan ? 0.13 : 0.12;
    const back = grey ? C.greyBack : C.white;
    const belly = grey ? C.greyBelly : C.whiteShade;
    const body = Builder();
    const colour = (x, y, z, u, side) => {
      let c = mixColor(belly, back, smoothstep(-0.4, 0.5, side));
      if (grey) {
        // Barres claires sur le dos et les flancs, dessous de queue blanc.
        const bar = smoothstep(0.55, 0.8, Math.sin(z * 58)) * smoothstep(0.1, 0.6, side);
        c = mixColor(c, C.greyBar, bar * 0.8);
        if (u < 0.22 && side < 0.2) c = mixColor(c, C.white, 0.8);
      } else c = mixColor(c, C.whiteShade, (1 - smoothstep(-0.2, 0.4, side)) * 0.35);
      return c;
    };
    const sections = [
      { z: -L * 0.55, y: baseY + H * (swan ? 1.2 : 0.9), w: 0.01, h: 0.01 },
      { z: -L * 0.48, y: baseY + H * (swan ? 0.95 : 0.7), w: W * 0.28, h: H * 0.3 },
      { z: -L * 0.36, y: baseY + H * 0.45, w: W * 0.72, h: H * 0.72, flat: 0.25 },
      { z: -L * 0.16, y: baseY + H * 0.2, w: W * 0.97, h: H * 0.95, flat: 0.35 },
      { z: L * 0.08, y: baseY + H * 0.15, w: W, h: H, flat: 0.35 },
      { z: L * 0.28, y: baseY + H * 0.25, w: W * 0.88, h: H * 0.95, flat: 0.3 },
      { z: L * 0.4, y: baseY + H * 0.45, w: W * 0.62, h: H * 0.78, flat: 0.2 },
      { z: L * 0.47, y: baseY + H * 0.62, w: W * 0.3, h: H * 0.45 },
      { z: L * 0.5, y: baseY + H * 0.7, w: 0.01, h: 0.01 },
    ];
    body.add(loft(sections, colour, 18));
    for (const side of [-1, 1])
      foldedWing(
        body,
        side,
        { x: W * 0.62, y: baseY + H * 0.62, z0: L * 0.3, z1: -L * 0.46, width: W * 0.42, thickness: H * (swan ? 0.36 : 0.3), lift: swan ? 0.08 : 0.04, tilt: swan ? 0.42 : 0.3 },
        (u, s) => (grey ? mixColor(C.greyBack, C.greyBar, smoothstep(0.6, 0.85, Math.sin(u * 30))) : mixColor(C.whiteShade, C.white, smoothstep(-0.2, 0.6, s))),
      );
    // Cou et tête : groupe animé à part (regarder, plonger la tête, se lisser les plumes).
    const neck = Builder();
    const neckPoints = swan
      ? [
          [0, 0, 0],
          [0, 0.2, 0.08],
          [0, 0.42, 0.02],
          [0, 0.6, -0.02],
          [0, 0.72, 0.06],
        ]
      : [
          [0, 0, 0],
          [0, 0.14, 0.05],
          [0, 0.3, 0.06],
          [0, 0.42, 0.08],
        ];
    const neckColour = grey ? (t) => mixColor(C.greyBelly, C.greyHead, smoothstep(0.2, 0.9, t)) : () => C.white;
    neck.add(tube(neckPoints, (t) => (swan ? lerp(0.075, 0.042, Math.pow(t, 0.7)) : lerp(0.07, 0.045, t)), neckColour, 12, 18));
    const head = neckPoints[neckPoints.length - 1];
    const headLen = swan ? 0.11 : 0.1;
    ellipsoid(neck, [0, head[1] + 0.02, head[2] + 0.035], [swan ? 0.052 : 0.05, swan ? 0.058 : 0.056, headLen], grey ? C.greyHead : C.white, [0.25, 0, 0]);
    beak(neck, [0, head[1] + 0.005, head[2] + headLen * 0.85], swan ? 0.1 : 0.085, swan ? 0.034 : 0.032, swan ? 0.028 : 0.03, swan ? C.swanBeak : C.gooseBeak, swan ? C.black : linear("#f4d7a5"), 0.012);
    if (swan) {
      ellipsoid(neck, [0, head[1] + 0.035, head[2] + headLen * 0.9], [0.022, 0.026, 0.03], C.black);
      ellipsoid(neck, [0, head[1] + 0.012, head[2] + headLen * 0.72], [0.043, 0.03, 0.045], C.black, [0.2, 0, 0]);
    }
    for (const side of [-1, 1]) ellipsoid(neck, [side * (swan ? 0.043 : 0.041), head[1] + 0.035, head[2] + headLen * 0.55], [0.011, 0.011, 0.011], C.black);
    return {
      body: body.build(),
      neck: neck.build(),
      neckBase: [0, baseY + H * 0.62, L * 0.37],
      leg: swan ? C.black : grey ? C.pinkLeg : C.gooseLeg,
    };
  }

  /** Colvert mâle ou femelle (échelle réelle : ~55 cm). */
  function mallard(male) {
    const L = 0.46;
    const W = 0.13;
    const H = 0.1;
    const y0 = 0.075;
    const body = Builder();
    body.add(
      loft(
        [
          { z: -L * 0.55, y: y0 + H * 0.9, w: 0.01, h: 0.01 },
          { z: -L * 0.45, y: y0 + H * 0.6, w: W * 0.4, h: H * 0.35 },
          { z: -L * 0.3, y: y0 + H * 0.3, w: W * 0.82, h: H * 0.8, flat: 0.3 },
          { z: -L * 0.05, y: y0 + H * 0.15, w: W, h: H, flat: 0.35 },
          { z: L * 0.2, y: y0 + H * 0.2, w: W * 0.95, h: H * 0.98, flat: 0.3 },
          { z: L * 0.38, y: y0 + H * 0.4, w: W * 0.7, h: H * 0.8, flat: 0.2 },
          { z: L * 0.48, y: y0 + H * 0.6, w: W * 0.3, h: H * 0.4 },
          { z: L * 0.5, y: y0 + H * 0.65, w: 0.01, h: 0.01 },
        ],
        (x, y, z, u, side) => {
          if (!male) {
            const mottle = 0.5 + 0.5 * Math.sin(z * 90 + x * 70) * Math.sin(y * 80);
            return mixColor(mixColor(C.henLight, C.henBrown, smoothstep(-0.5, 0.4, side)), C.henDark, mottle * 0.45);
          }
          if (u > 0.7) return mixColor(C.chestnut, C.mallardGrey, smoothstep(0.9, 0.7, u) * 0.2);
          if (u < 0.16) return side > -0.3 ? C.mallardDark : C.white;
          return mixColor(C.mallardGrey, linear("#8e8c83"), smoothstep(0.2, 0.9, side));
        },
        14,
      ),
    );
    for (const side of [-1, 1])
      foldedWing(body, side, { x: W * 0.6, y: y0 + H * 0.62, z0: L * 0.22, z1: -L * 0.42, width: W * 0.4, thickness: H * 0.3, lift: 0.02, tilt: 0.35 }, (u) =>
        u > 0.3 && u < 0.46 ? C.speculum : male ? linear("#8a8579") : C.henBrown,
      );
    if (male) {
      // Petite boucle noire de la queue.
      body.add(tube([[0, y0 + H * 0.9, -L * 0.5], [0, y0 + H * 1.25, -L * 0.47], [0, y0 + H * 1.2, -L * 0.4]], 0.008, C.mallardDark, 6, 8));
    }
    const neck = Builder();
    const headColour = male ? C.mallardGreen : C.henBrown;
    neck.add(tube([[0, 0, 0], [0, 0.06, 0.02], [0, 0.12, 0.03]], (t) => lerp(0.05, 0.036, t), (t) => (male ? (t < 0.25 ? C.chestnut : t < 0.36 ? C.white : headColour) : C.henBrown), 10, 10));
    ellipsoid(neck, [0, 0.14, 0.045], [0.04, 0.043, 0.06], male ? C.mallardGreen2 : C.henBrown, [0.2, 0, 0]);
    if (!male) ellipsoid(neck, [0, 0.148, 0.05], [0.041, 0.012, 0.045], C.henDark);
    beak(neck, [0, 0.128, 0.095], 0.06, 0.022, 0.012, male ? C.duckBeakM : C.duckBeakF, male ? C.duckBeakM : C.henDark, 0.004);
    for (const side of [-1, 1]) ellipsoid(neck, [side * 0.033, 0.152, 0.07], [0.007, 0.007, 0.007], C.black);
    return { body: body.build(), neck: neck.build(), neckBase: [0, y0 + H * 0.7, L * 0.36] };
  }

  /** Héron cendré, corps (sans cou) dans le repère de la V31 (pattes au sol en y = 0). */
  function heronBody() {
    const b = Builder();
    const sections = [];
    // Corps incliné : poitrail haut vers l'avant, queue basse vers l'arrière.
    const pts = [
      [-0.46, 0.8, 0.01, 0.01],
      [-0.38, 0.84, 0.07, 0.05],
      [-0.24, 0.9, 0.15, 0.13],
      [-0.05, 0.96, 0.19, 0.17],
      [0.12, 1.02, 0.18, 0.17],
      [0.22, 1.07, 0.13, 0.13],
      [0.27, 1.1, 0.06, 0.07],
      [0.29, 1.11, 0.01, 0.01],
    ];
    for (const [z, y, w, h] of pts) sections.push({ z, y, w, h, flat: 0.1 });
    b.add(
      loft(sections, (x, y, z, u, side) => {
        let c = mixColor(C.heronWhite, C.heronGrey, smoothstep(-0.6, 0.2, side));
        if (u > 0.55 && Math.abs(x) > 0.1 && side > -0.2 && side < 0.5) c = C.heronDark; // épaulettes noires
        return c;
      }, 16),
    );
    for (const side of [-1, 1]) {
      foldedWing(b, side, { x: 0.15, y: 0.98, z0: 0.18, z1: -0.46, width: 0.1, thickness: 0.07, lift: 0.04, tilt: 0.25 }, (u) =>
        u < 0.35 ? C.heronDark : mixColor(C.heronGrey, linear("#8b979d"), u),
      );
      // Pattes : cuisse, tarse, doigts.
      b.add(tube([[side * 0.07, 0.86, 0.02], [side * 0.08, 0.62, 0.05], [side * 0.09, 0.4, 0.06]], (t) => lerp(0.022, 0.014, t), C.heronLeg, 6, 6));
      b.add(tube([[side * 0.09, 0.4, 0.06], [side * 0.1, 0.18, 0.08], [side * 0.11, 0.03, 0.1]], 0.012, C.heronLeg, 6, 6));
      for (const spread of [-1, 0, 1]) b.add(tube([[side * 0.11, 0.03, 0.1], [side * 0.11 + spread * 0.07, 0.01, 0.22]], 0.007, C.heronLeg, 5, 2));
      b.add(tube([[side * 0.11, 0.03, 0.1], [side * 0.11, 0.01, 0.02]], 0.006, C.heronLeg, 5, 2));
    }
    return b.build();
  }
  /** Cou et tête du héron, dans le groupe cou de la V31 (origine au pied du cou). */
  function heronNeck() {
    const b = Builder();
    b.add(tube([[0, 0, 0], [0, 0.12, -0.05], [0, 0.26, -0.04], [0, 0.4, 0.08], [0, 0.46, 0.18]], (t) => lerp(0.055, 0.032, t), (t, a) => (Math.cos(a) > 0.7 && t > 0.2 ? C.heronDark : mixColor(C.heronWhite, linear("#d9dedb"), t)), 10, 18));
    ellipsoid(b, [0, 0.48, 0.21], [0.042, 0.045, 0.075], C.heronWhite, [0.1, 0, 0]);
    ellipsoid(b, [0, 0.505, 0.19], [0.036, 0.018, 0.06], C.black); // bandeau noir
    b.add(tube([[0, 0.505, 0.15], [0, 0.49, 0.05], [0, 0.47, -0.06]], (t) => lerp(0.012, 0.003, t), C.black, 5, 6)); // aigrette
    beak(b, [0, 0.472, 0.26], 0.2, 0.02, 0.018, C.heronBeak, linear("#b98d2c"), 0.012);
    for (const side of [-1, 1]) ellipsoid(b, [side * 0.034, 0.49, 0.245], [0.009, 0.009, 0.009], linear("#e7c44a"));
    return b.build();
  }

  /** Grand cormoran nageant (bas sur l'eau) : corps puis cou/tête. */
  function cormorantBody() {
    const b = Builder();
    b.add(
      loft(
        [
          { z: -0.46, y: 0.0, w: 0.01, h: 0.01 },
          { z: -0.38, y: 0.005, w: 0.06, h: 0.025 },
          { z: -0.26, y: 0.01, w: 0.13, h: 0.08, flat: 0.3 },
          { z: 0, y: 0.01, w: 0.17, h: 0.11, flat: 0.4 },
          { z: 0.2, y: 0.02, w: 0.14, h: 0.1, flat: 0.3 },
          { z: 0.3, y: 0.05, w: 0.08, h: 0.07 },
          { z: 0.34, y: 0.07, w: 0.01, h: 0.01 },
        ],
        (x, y, z, u, side) => {
          const scale = 0.5 + 0.5 * Math.sin(z * 70 + x * 40);
          return mixColor(C.cormorant, C.cormorantBronze, smoothstep(0.1, 0.8, side) * (0.4 + 0.6 * scale));
        },
        14,
      ),
    );
    return b.build();
  }
  function cormorantNeck() {
    const b = Builder();
    b.add(tube([[0, -0.13, -0.04], [0, 0, 0], [0, 0.12, 0.05], [0, 0.24, 0.1], [0, 0.29, 0.14]], (t) => lerp(0.05, 0.03, t), C.cormorant, 10, 14));
    ellipsoid(b, [0, 0.3, 0.155], [0.035, 0.036, 0.06], C.cormorant, [0.15, 0, 0]);
    ellipsoid(b, [0, 0.282, 0.18], [0.027, 0.02, 0.04], C.cormorantThroat);
    beak(b, [0, 0.29, 0.2], 0.12, 0.014, 0.013, C.cormorantBeak, linear("#3c3a34"), 0, 0.012);
    for (const side of [-1, 1]) ellipsoid(b, [side * 0.028, 0.31, 0.17], [0.008, 0.008, 0.008], linear("#3f8f6d"));
    return b.build();
  }

  /** Mouette en vol : corps, et une aile (x positif) articulée à l'origine. */
  function gullBody() {
    const b = Builder();
    b.add(
      loft(
        [
          { z: -0.24, y: 0, w: 0.01, h: 0.005 },
          { z: -0.2, y: 0, w: 0.06, h: 0.015 },
          { z: -0.12, y: 0.005, w: 0.065, h: 0.045 },
          { z: 0.05, y: 0.01, w: 0.07, h: 0.06 },
          { z: 0.16, y: 0.03, w: 0.05, h: 0.05 },
          { z: 0.24, y: 0.05, w: 0.04, h: 0.04 },
          { z: 0.29, y: 0.055, w: 0.01, h: 0.01 },
        ],
        (x, y, z, u, side) => mixColor(C.white, C.gullGrey, smoothstep(0.3, 0.9, side) * smoothstep(0.1, 0.4, u) * (1 - smoothstep(0.7, 0.85, u))),
        12,
      ),
    );
    beak(b, [0, 0.05, 0.285], 0.055, 0.012, 0.012, linear("#e6c24a"), linear("#d2432f"), 0.006);
    for (const side of [-1, 1]) ellipsoid(b, [side * 0.028, 0.065, 0.255], [0.006, 0.006, 0.006], C.black);
    return b.build();
  }
  function gullWing() {
    // Aile de mouette : bras gris, pointe noire mouchetée de blanc, bord de fuite clair.
    const shape = [
      [0, 0.1],
      [0.22, 0.12],
      [0.48, 0.07],
      [0.78, -0.02],
      [0.92, -0.1],
      [0.86, -0.15],
      [0.6, -0.14],
      [0.34, -0.13],
      [0.12, -0.12],
      [0, -0.1],
    ];
    const outline = new THREE.Shape(shape.map(([x, z]) => new THREE.Vector2(x, z)));
    const geometry = new THREE.ShapeGeometry(outline, 6);
    geometry.rotateX(Math.PI / 2);
    const p = geometry.attributes.position;
    const colours = [];
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      // Profil courbé (dièdre et bord d'attaque épais).
      p.setY(i, 0.03 * Math.sin((x / 0.92) * Math.PI) - 0.02 * Math.pow(x / 0.92, 2));
      let c = x > 0.66 ? C.black : C.gullGrey;
      if (x > 0.8 && z > -0.06 && z < 0.0) c = C.white;
      if (z < -0.1 && x < 0.66) c = mixColor(C.gullGrey, C.white, 0.6);
      colours.push(c.r, c.g, c.b);
    }
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colours, 3));
    geometry.computeVertexNormals();
    return geometry;
  }

  /** Pattes palmées (tarse + palmure). */
  function webbedLeg(colour, length = 0.2) {
    const b = Builder();
    b.add(tube([[0, 0, 0], [0, -length * 0.55, 0.01], [0, -length, 0.02]], (t) => lerp(0.018, 0.012, t), colour, 6, 6));
    const web = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(-0.05, 0.1), new THREE.Vector2(0, 0.085), new THREE.Vector2(0.05, 0.1)]);
    const foot = new THREE.ShapeGeometry(web);
    foot.rotateX(Math.PI / 2);
    foot.translate(0, -length, 0.02);
    b.add(foot, colour);
    return b.build();
  }

  // ---------------------------------------------------------------- système
  V32.register(
    "birds",
    function (context) {
      const { game, hooks } = context;
      const feathers = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.84, metalness: 0, side: THREE.DoubleSide });
      const glossy = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.48, metalness: 0.08 });
      feathers.name = "Plumes_v32";
      glossy.name = "Plumes_lustrees_v32";
      const animated = [];

      // --- Cortège du cygne et des oies (MoulinBirds).
      const procession = game.birds;
      for (const bird of procession?.birds || []) {
        const model = waterfowl(bird.kind === "swan" ? "swan" : bird.kind === "grey" ? "grey" : "white");
        for (const child of [...bird.body.children]) bird.body.remove(child);
        const bodyMesh = new THREE.Mesh(model.body, feathers);
        bodyMesh.castShadow = bodyMesh.receiveShadow = true;
        bird.body.add(bodyMesh);
        const neck = new THREE.Group();
        neck.position.set(...model.neckBase);
        const neckMesh = new THREE.Mesh(model.neck, feathers);
        neckMesh.castShadow = true;
        neck.add(neckMesh);
        bird.body.add(neck);
        for (const leg of bird.legs || []) {
          for (const child of [...leg.children]) leg.remove(child);
          const legMesh = new THREE.Mesh(webbedLeg(model.leg, bird.kind === "swan" ? 0.22 : 0.18), feathers);
          legMesh.castShadow = true;
          leg.add(legMesh);
        }
        animated.push({ neck, kind: bird.kind, phase: Math.random() * 20, bird, dip: 0 });
      }

      // --- Hérons et cormorans (MoulinWildlife29).
      const wildlife = game.wildlife29;
      const heronBodyGeometry = heronBody();
      const heronNeckGeometry = heronNeck();
      const cormorantBodyGeometry = cormorantBody();
      const cormorantNeckGeometry = cormorantNeck();
      for (const fisher of wildlife?.fishers || []) {
        const bodyMesh = fisher.g.children.find((child) => child.isMesh);
        const neckMesh = fisher.neck.children.find((child) => child.isMesh && child !== fisher.fish);
        if (bodyMesh) {
          bodyMesh.geometry = fisher.heron ? heronBodyGeometry : cormorantBodyGeometry;
          bodyMesh.material = fisher.heron ? feathers : glossy;
          bodyMesh.castShadow = true;
        }
        if (neckMesh) {
          neckMesh.geometry = fisher.heron ? heronNeckGeometry : cormorantNeckGeometry;
          neckMesh.material = fisher.heron ? feathers : glossy;
          neckMesh.castShadow = true;
        }
      }

      // --- Oiseaux en vol : mouettes.
      const gullBodyGeometry = gullBody();
      const gullWingGeometry = gullWing();
      for (const flyer of wildlife?.sky?.children || []) {
        const meshes = flyer.children.filter((child) => child.isMesh);
        if (meshes.length < 3) continue;
        meshes[0].geometry = gullBodyGeometry;
        meshes[1].geometry = gullWingGeometry;
        meshes[2].geometry = gullWingGeometry;
        for (const mesh of meshes) {
          mesh.material = feathers;
          mesh.castShadow = false;
        }
      }

      // --- Famille de colverts : deux couples et deux jeunes, qui barbotent.
      const regions = (game.waterRegions || []).filter((region) => region.poly?.length > 2);
      const inside = hooks.inside;
      const ducks = [];
      const duckGroup = new THREE.Group();
      duckGroup.name = "Colverts_v32";
      duckGroup.userData.exportSkip = true;
      game.model.add(duckGroup);
      // Les colverts s'installent dans l'eau la plus proche de la terrasse du moulin.
      const islands = hooks.islands || [];
      let pond = null;
      let home = null;
      let best = Infinity;
      for (const region of regions)
        for (let r = 3; r <= 30; r += 1.5)
          for (let k = 0; k < 16; k++) {
            const a = (k / 16) * Math.PI * 2;
            const x = 1 + Math.cos(a) * r;
            const z = 17 + Math.sin(a) * r;
            if (r < best && inside([x, z], region.poly) && !islands.some((island) => inside([x, z], island.poly || island))) {
              best = r;
              pond = region;
              home = [x, z];
            }
          }
      if (pond && inside) {
        let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
        for (const [x, z] of pond.poly) {
          minX = Math.min(minX, x); maxX = Math.max(maxX, x);
          minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
        }
        const free = (x, z) => inside([x, z], pond.poly) && !islands.some((island) => inside([x, z], island.poly || island));
        const models = { male: mallard(true), female: mallard(false) };
        const roster = ["male", "female", "male", "female", "female", "female"];
        roster.forEach((sex, i) => {
          const model = models[sex];
          const group = new THREE.Group();
          const body = new THREE.Mesh(model.body, sex === "male" ? glossy : feathers);
          body.castShadow = body.receiveShadow = true;
          group.add(body);
          const neck = new THREE.Group();
          neck.position.set(...model.neckBase);
          const neckMesh = new THREE.Mesh(model.neck, sex === "male" ? glossy : feathers);
          neckMesh.castShadow = true;
          neck.add(neckMesh);
          group.add(neck);
          const scale = i >= 4 ? 0.72 : 1;
          group.scale.setScalar(scale);
          duckGroup.add(group);
          ducks.push({
            group,
            neck,
            x: home[0] + (Math.random() - 0.5) * 1.5,
            z: home[1] + (Math.random() - 0.5) * 1.5,
            heading: Math.random() * Math.PI * 2,
            target: null,
            wait: Math.random() * 4,
            dabble: 0,
            phase: Math.random() * 10,
            level: pond.level,
            leader: i === 0,
          });
        });
        V32.ducks = { ducks, free, home, bounds: { minX, maxX, minZ, maxZ } };
      }

      const up = new THREE.Vector3(0, 1, 0);
      let time = 0;
      function update(dt) {
        if (!hooks.animationsEnabled()) return false;
        dt = Math.min(dt, 0.1);
        time += dt;
        // Cous du cortège : mouvements lents, tête plongée de temps en temps.
        for (const a of animated) {
          const t = time + a.phase;
          const cycle = t % 17;
          const dipping = cycle > 12.5 && cycle < 15 && a.kind !== "swan" ? Math.sin(((cycle - 12.5) / 2.5) * Math.PI) : 0;
          const swanDip = a.kind === "swan" && cycle > 9 && cycle < 12.5 ? Math.sin(((cycle - 9) / 3.5) * Math.PI) : 0;
          a.neck.rotation.x = 0.06 * Math.sin(t * 0.7) + dipping * 1.25 + swanDip * 0.9;
          a.neck.rotation.y = 0.35 * Math.sin(t * 0.31) * (1 - dipping);
          a.neck.rotation.z = 0.05 * Math.sin(t * 0.9);
        }
        // Colverts : petits trajets, attente, basculements pour se nourrir.
        if (ducks.length) {
          const { free, bounds } = V32.ducks;
          const leader = ducks[0];
          for (const d of ducks) {
            d.wait -= dt;
            if (!d.target || d.wait < -8) {
              if (d.leader || Math.random() < 0.5) {
                for (let attempt = 0; attempt < 12; attempt++) {
                  const r = d.leader ? 6 : 2.2;
                  const cx = d.leader ? d.x : leader.x;
                  const cz = d.leader ? d.z : leader.z;
                  const x = clamp(cx + (Math.random() - 0.5) * r * 2, bounds.minX, bounds.maxX);
                  const z = clamp(cz + (Math.random() - 0.5) * r * 2, bounds.minZ, bounds.maxZ);
                  if (free(x, z)) {
                    d.target = [x, z];
                    break;
                  }
                }
              } else d.target = [leader.x + (Math.random() - 0.5) * 2.5, leader.z + (Math.random() - 0.5) * 2.5];
              d.wait = 3 + Math.random() * 6;
            }
            let speed = 0;
            if (d.target && d.wait < 0) {
              const dx = d.target[0] - d.x;
              const dz = d.target[1] - d.z;
              const dist = Math.hypot(dx, dz);
              if (dist < 0.15 || !free(d.x + (dx / dist) * 0.3, d.z + (dz / dist) * 0.3)) {
                d.target = null;
                d.wait = 2 + Math.random() * 5;
                if (Math.random() < 0.45) d.dabble = 2.6;
              } else {
                const desired = Math.atan2(dx, dz);
                let delta = ((desired - d.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
                d.heading += clamp(delta, -dt * 1.8, dt * 1.8);
                speed = 0.32 * clamp(dist, 0.2, 1);
                d.x += Math.sin(d.heading) * speed * dt;
                d.z += Math.cos(d.heading) * speed * dt;
              }
            }
            d.dabble = Math.max(0, d.dabble - dt);
            const tip = d.dabble > 0 ? Math.sin((1 - d.dabble / 2.6) * Math.PI) : 0;
            d.group.position.set(d.x, d.level + 0.004 + Math.sin(time * 2.1 + d.phase) * 0.004, d.z);
            d.group.rotation.set(tip * 1.25, d.heading, Math.sin(time * 1.3 + d.phase) * 0.03);
            d.neck.rotation.x = tip * 0.6 + 0.08 * Math.sin(time * 0.9 + d.phase);
            d.neck.rotation.y = (1 - tip) * 0.4 * Math.sin(time * 0.5 + d.phase);
          }
        }
        return true;
      }

      return { update, materials: { feathers, glossy }, ducks: () => ducks.length };
    },
    70,
  );
})();
