// Moulin V32 — pierres sèches : outils communs aux murets, à la rocaille et aux détails.
//
// Les murets du jardin étaient des boîtes lisses habillées d'une texture. Les modules
// 74-walls, 75-rockery et 76-details les rebâtissent pierre par pierre et ajoutent les
// petits objets de la vie du jardin. Ce fichier leur fournit :
//  - des pierres irrégulières : moellons chanfreinés aux faces bombées et aux coins
//    épaufrés, rochers arrondis taillés de quelques plans de clivage ;
//  - une matière de roche peinte au chargement (grain du granit, lits du schiste,
//    lichens, relief), teintée pierre par pierre, avec de la mousse sur les faces tournées
//    vers le ciel ;
//  - feuilles et fleurs simples (hostas, fougères, camélias, feuilles mortes…) ;
//  - des lots instanciés : un appel de rendu par forme de pierre et par secteur de 24 m,
//    pour que la caméra et l'ombre écartent les secteurs hors champ ;
//  - un assembleur de petits objets (formes simples fusionnées, couleur par sommet) ;
//  - le sol où poser un objet (relief, cour, terrasse, parterre surélevé) ;
//  - le retrait des anciennes boîtes : le jeu fusionne les maillages immobiles par
//    matière (MoulinRenderCache) ; masquer l'original ne suffit pas, on retire ses
//    triangles du lot fusionné ;
//  - la maçonnerie « posée à la main » des bâtiments (joints et teintes moins réguliers) ;
//  - le suivi des retouches du relief dans l'atelier (les décors se reposent au sol).
(function () {
  "use strict";
  const V32 = globalThis.MoulinV32;
  const THREE = globalThis.THREE;
  if (!V32 || !THREE) return;

  // --- Hasard et bruits ----------------------------------------------------------------

  /** Suite pseudo-aléatoire reproductible dans [0, 1). */
  function random(seed) {
    let s = seed >>> 0 || 1;
    return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  }
  function hash(x, y, z, seed) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1440662683) ^ Math.imul(seed | 0, 2654435761);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }
  const fade = (t) => t * t * (3 - 2 * t);
  const smooth = (a, b, x) => fade(Math.min(1, Math.max(0, (x - a) / (b - a))));
  const mix = (a, b, t) => a + (b - a) * t;

  /** Bruit de valeur 3D (déformation des pierres). */
  function noise3(x, y, z, seed = 0) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const iz = Math.floor(z);
    const sx = fade(x - ix);
    const sy = fade(y - iy);
    const sz = fade(z - iz);
    let value = 0;
    for (let k = 0; k < 8; k++) {
      const dx = k & 1;
      const dy = (k >> 1) & 1;
      const dz = k >> 2;
      value += (dx ? sx : 1 - sx) * (dy ? sy : 1 - sy) * (dz ? sz : 1 - sz) * hash(ix + dx, iy + dy, iz + dz, seed);
    }
    return value;
  }
  function fbm3(x, y, z, seed = 0, octaves = 3) {
    let sum = 0;
    let amp = 0.5;
    let total = 0;
    for (let o = 0; o < octaves; o++) {
      sum += noise3(x, y, z, seed + o * 17) * amp;
      total += amp;
      amp *= 0.5;
      x *= 2.03;
      y *= 2.03;
      z *= 2.03;
    }
    return sum / total;
  }
  /** Bruit 2D périodique (px × py cellules) : textures sans raccord. */
  function noise2(u, v, px, py, seed) {
    const x = u * px;
    const y = v * py;
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const sx = fade(x - ix);
    const sy = fade(y - iy);
    const wx = (i) => ((i % px) + px) % px;
    const wy = (i) => ((i % py) + py) % py;
    const a = hash(wx(ix), wy(iy), 0, seed);
    const b = hash(wx(ix + 1), wy(iy), 0, seed);
    const c = hash(wx(ix), wy(iy + 1), 0, seed);
    const d = hash(wx(ix + 1), wy(iy + 1), 0, seed);
    return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
  }
  function fbm2(u, v, px, py, seed, octaves = 4) {
    let sum = 0;
    let amp = 0.5;
    let total = 0;
    for (let o = 0; o < octaves; o++) {
      sum += noise2(u, v, px << o, py << o, seed + o * 31) * amp;
      total += amp;
      amp *= 0.5;
    }
    return sum / total;
  }

  // --- Matière de roche ----------------------------------------------------------------

  let textures = null;
  /**
   * Texture de roche (sRGB), relief et carte de détail (linéaire) : rouge = masque de
   * mousse, vert = rugosité, bleu = creux. Gris beige moyen : la teinte vient de chaque
   * pierre (couleur d'instance).
   */
  function rockTextures(hooks) {
    if (textures) return textures;
    const size = hooks && hooks.mobile ? 256 : 512;
    const color = new Uint8Array(size * size * 4);
    const detail = new Uint8Array(size * size * 4);
    const height = new Float32Array(size * size);
    const cells = size / 4;
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const u = (x + 0.5) / size;
        const v = (y + 0.5) / size;
        const i = y * size + x;
        // Fond marbré, lits du schiste (étirés), grain fin et cristaux du granit.
        const mottle = fbm2(u, v, 4, 4, 11, 4);
        const beds = fbm2(u, v, 2, 12, 23, 3);
        const grain = noise2(u, v, cells, cells, 37);
        const crystal = hash(x, y, 3, 5);
        const pit = Math.pow(noise2(u, v, 40, 40, 41), 7);
        let tone = 0.8 + (mottle - 0.5) * 0.3 + (beds - 0.5) * 0.16 + (grain - 0.5) * 0.1 - pit * 0.36;
        if (crystal < 0.045) tone -= 0.13 * (1 - crystal / 0.045);
        else if (crystal > 0.975) tone += 0.07;
        // Traînées de rouille dans les lits, lichens gris-vert pâle, rares taches orangées.
        const rust = smooth(0.6, 0.8, fbm2(u, v, 3, 9, 53, 3)) * 0.55;
        let r = tone * (1 + rust * 0.14);
        let g = tone * (0.975 - rust * 0.03);
        let b = tone * (0.91 - rust * 0.14);
        const lichen = smooth(0.64, 0.72, fbm2(u, v, 6, 6, 67, 4)) * (0.55 + 0.45 * noise2(u, v, 64, 64, 71));
        r = mix(r, 0.8, lichen * 0.72);
        g = mix(g, 0.82, lichen * 0.72);
        b = mix(b, 0.7, lichen * 0.72);
        const orange = smooth(0.77, 0.83, fbm2(u, v, 8, 8, 89, 3)) * (0.5 + 0.5 * noise2(u, v, 48, 48, 93));
        r = mix(r, 0.84, orange * 0.75);
        g = mix(g, 0.55, orange * 0.75);
        b = mix(b, 0.22, orange * 0.75);
        const k = i * 4;
        color[k] = Math.max(0, Math.min(255, r * 255));
        color[k + 1] = Math.max(0, Math.min(255, g * 255));
        color[k + 2] = Math.max(0, Math.min(255, b * 255));
        color[k + 3] = 255;
        height[i] = mottle * 0.55 + (beds - 0.5) * 0.35 + grain * 0.16 - pit * 0.9 + lichen * 0.1 - (crystal < 0.06 ? 0.05 : 0);
        detail[k] = fbm2(u, v, 3, 3, 97, 4) * 255;
        detail[k + 1] = Math.max(0, Math.min(255, (0.8 + (grain - 0.5) * 0.14 + lichen * 0.1 + pit * 0.1) * 255));
        detail[k + 2] = Math.max(0, Math.min(255, (1 - pit) * 255));
        detail[k + 3] = 255;
      }
    const normal = new Uint8Array(size * size * 4);
    const strength = size / 96;
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const dx = (height[y * size + ((x + size - 1) % size)] - height[y * size + ((x + 1) % size)]) * strength;
        const dy = (height[((y + size - 1) % size) * size + x] - height[((y + 1) % size) * size + x]) * strength;
        const len = Math.hypot(dx, dy, 1);
        const k = (y * size + x) * 4;
        normal[k] = ((dx / len) * 0.5 + 0.5) * 255;
        normal[k + 1] = ((dy / len) * 0.5 + 0.5) * 255;
        normal[k + 2] = ((1 / len) * 0.5 + 0.5) * 255;
        normal[k + 3] = 255;
      }
    const make = (data, srgb) => {
      const surfaces = hooks && hooks.surfaces;
      if (surfaces && surfaces.fromData) return surfaces.fromData(data, size, srgb, true);
      const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = true;
      texture.anisotropy = 4;
      texture.encoding = srgb ? THREE.sRGBEncoding : THREE.LinearEncoding;
      texture.needsUpdate = true;
      return texture;
    };
    textures = { map: make(color, true), normal: make(normal, false), detail: make(detail, false), size };
    textures.map.name = "Roche_granit_schiste_v32";
    return textures;
  }

  const VERTEX_HEAD = `varying vec3 vV32WorldN;
varying vec3 vV32WorldP;
varying float vV32Seed;
`;
  // Décalage de texture propre à chaque pierre : deux pierres voisines ne se ressemblent pas.
  const VERTEX_UV = `#include <uv_vertex>
#if defined( USE_MAP ) && defined( USE_INSTANCING )
	vUv += fract( vec2( instanceMatrix[ 3 ].x * 0.371 + instanceMatrix[ 3 ].y * 0.613, instanceMatrix[ 3 ].z * 0.437 - instanceMatrix[ 3 ].y * 0.291 ) );
#endif`;
  const VERTEX_WORLD = `#include <worldpos_vertex>
	vec3 v32Normal = objectNormal;
	vec4 v32Position = vec4( transformed, 1.0 );
	#ifdef USE_INSTANCING
		mat3 v32Basis = mat3( instanceMatrix );
		v32Normal /= vec3( dot( v32Basis[ 0 ], v32Basis[ 0 ] ), dot( v32Basis[ 1 ], v32Basis[ 1 ] ), dot( v32Basis[ 2 ], v32Basis[ 2 ] ) );
		v32Normal = v32Basis * v32Normal;
		v32Position = instanceMatrix * v32Position;
		vV32Seed = fract( sin( dot( instanceMatrix[ 3 ].xyz, vec3( 12.9898, 78.233, 37.719 ) ) ) * 43758.5453 );
	#else
		vV32Seed = 0.5;
	#endif
	vV32WorldN = normalize( mat3( modelMatrix ) * v32Normal );
	vV32WorldP = ( modelMatrix * v32Position ).xyz;`;
  const FRAGMENT_HEAD = `uniform float uV32Moss;
uniform float uV32Damp;
varying vec3 vV32WorldN;
varying vec3 vV32WorldP;
varying float vV32Seed;
`;
  // Mousse : faces tournées vers le ciel, par plaques (masque du monde, continu d'une
  // pierre à l'autre) ; un peu plus sombre et mate. Pied humide et plus sombre.
  const FRAGMENT_COLOR = `#include <color_fragment>
	float v32Up = normalize( vV32WorldN ).y;
	vec4 v32Detail = texture2D( roughnessMap, vV32WorldP.xz * 0.23 + vec2( vV32WorldP.y * 0.071 ) );
	float v32Mask = smoothstep( 0.28, 0.72, v32Detail.r );
	float v32Moss = uV32Moss * smoothstep( 0.62, 1.0, v32Up * 0.62 + v32Mask * 0.62 + ( vV32Seed - 0.5 ) * 0.3 );
	v32Moss = clamp( v32Moss, 0.0, 1.0 );
	vec3 v32MossColor = mix( vec3( 0.1, 0.15, 0.04 ), vec3( 0.27, 0.32, 0.09 ), v32Mask );
	diffuseColor.rgb = mix( diffuseColor.rgb, v32MossColor, v32Moss );
	diffuseColor.rgb *= 1.0 - uV32Damp * ( 1.0 - smoothstep( -0.2, 0.6, v32Up ) ) * ( 0.5 + 0.5 * v32Detail.r );`;
  const FRAGMENT_ROUGHNESS = `#include <roughnessmap_fragment>
	roughnessFactor = mix( roughnessFactor, 1.0, v32Moss );`;

  const materials = new Map();
  /**
   * Matière de pierre sèche (partagée par clé). moss : mousse sur les dessus (0 à 1) ;
   * damp : assombrit un peu les faces verticales et le dessous (joints à l'ombre).
   */
  function rockMaterial(hooks, key, { moss = 0.55, damp = 0.12, normalScale = 1, envMapIntensity = 0.1 } = {}) {
    if (materials.has(key)) return materials.get(key);
    const tex = rockTextures(hooks);
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: tex.map,
      normalMap: tex.normal,
      normalScale: new THREE.Vector2(normalScale, normalScale),
      roughnessMap: tex.detail,
      roughness: 1,
      metalness: 0,
      envMapIntensity,
    });
    material.name = "Pierre_seche_" + key;
    const mossUniform = { value: moss };
    const dampUniform = { value: damp };
    V32.patchMaterial(material, "pierres-seches", (shader) => {
      shader.uniforms.uV32Moss = mossUniform;
      shader.uniforms.uV32Damp = dampUniform;
      shader.vertexShader =
        VERTEX_HEAD +
        shader.vertexShader.replace("#include <uv_vertex>", VERTEX_UV).replace("#include <worldpos_vertex>", VERTEX_WORLD);
      shader.fragmentShader =
        FRAGMENT_HEAD +
        shader.fragmentShader
          .replace("#include <color_fragment>", FRAGMENT_COLOR)
          .replace("#include <roughnessmap_fragment>", FRAGMENT_ROUGHNESS);
    });
    material.userData.v32Moss = mossUniform;
    material.userData.v32Damp = dampUniform;
    materials.set(key, material);
    return material;
  }

  // --- Géométries de pierres -----------------------------------------------------------

  const _a = new THREE.Vector3();
  const _b = new THREE.Vector3();
  const _c = new THREE.Vector3();
  const _n = new THREE.Vector3();

  /**
   * Géométrie à partir de triangles [[x,y,z]×3] : triangles tournés vers l'extérieur
   * (forme à peu près convexe), normales par facette mêlées aux normales lissées
   * (smooth : 0 = facettes franches, 1 = lissé), coordonnées de texture projetées sur
   * l'axe dominant de chaque facette (uvScale répétitions par mètre).
   */
  function fromTriangles(triangles, { smoothness = 0, uvScale = 1.7, centre = [0, 0, 0] } = {}) {
    const position = [];
    const normal = [];
    const uv = [];
    const faceNormals = [];
    const sums = new Map();
    const key = (p) => Math.round(p[0] * 2e4) + "," + Math.round(p[1] * 2e4) + "," + Math.round(p[2] * 2e4);
    for (const tri of triangles) {
      _a.fromArray(tri[0]);
      _b.fromArray(tri[1]).sub(_a);
      _c.fromArray(tri[2]).sub(_a);
      _n.crossVectors(_b, _c);
      const gx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3 - centre[0];
      const gy = (tri[0][1] + tri[1][1] + tri[2][1]) / 3 - centre[1];
      const gz = (tri[0][2] + tri[1][2] + tri[2][2]) / 3 - centre[2];
      if (_n.x * gx + _n.y * gy + _n.z * gz < 0) {
        const swap = tri[1];
        tri[1] = tri[2];
        tri[2] = swap;
        _n.negate();
      }
      faceNormals.push(_n.x, _n.y, _n.z);
      if (smoothness > 0)
        for (const p of tri) {
          const k = key(p);
          const sum = sums.get(k);
          if (sum) {
            sum[0] += _n.x;
            sum[1] += _n.y;
            sum[2] += _n.z;
          } else sums.set(k, [_n.x, _n.y, _n.z]);
        }
    }
    triangles.forEach((tri, t) => {
      _n.set(faceNormals[t * 3], faceNormals[t * 3 + 1], faceNormals[t * 3 + 2]).normalize();
      const ax = Math.abs(_n.x);
      const ay = Math.abs(_n.y);
      const az = Math.abs(_n.z);
      const axis = ax > ay && ax > az ? 0 : ay > az ? 1 : 2;
      const offset = axis * 0.37;
      for (const p of tri) {
        position.push(p[0], p[1], p[2]);
        if (smoothness > 0) {
          const s = sums.get(key(p));
          _a.set(s[0], s[1], s[2]).normalize().lerp(_n, 1 - smoothness).normalize();
          normal.push(_a.x, _a.y, _a.z);
        } else normal.push(_n.x, _n.y, _n.z);
        const u = axis === 0 ? p[2] : p[0];
        const v = axis === 1 ? p[2] : p[1];
        uv.push(u * uvScale + offset, v * uvScale + offset);
      }
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(position, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normal, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
  }

  /**
   * Moellon : pavé chanfreiné aux dimensions réelles (m), centré ; faces légèrement
   * bombées, sommets déplacés (silhouette irrégulière) et quelques coins épaufrés.
   * 56 triangles, ombrage par facette : la pierre garde ses arêtes vives.
   */
  function blockGeometry({ size = [0.4, 0.14, 0.5], bevel = 0.02, jitter = 0.01, dome = 0.008, chip = 0.5, seed = 1, uvScale = 1.7 } = {}) {
    const rnd = random(seed * 2654435761 + 97);
    const half = size.map((v) => v / 2);
    const corner = [];
    for (let k = 0; k < 8; k++) corner.push(rnd() < chip * 0.3 ? 2.2 + rnd() * 1.4 : 0.75 + rnd() * 0.5);
    const cache = new Map();
    // Sommet du chanfrein : coin (signes) et face (axe) qu'il borde.
    function vertex(signs, axis) {
      const key = signs[0] + "" + signs[1] + signs[2] + axis;
      let p = cache.get(key);
      if (p) return p;
      const k = ((signs[0] + 1) >> 1) | (((signs[1] + 1) >> 1) << 1) | (((signs[2] + 1) >> 1) << 2);
      p = [0, 1, 2].map((a) => {
        const inset = a === axis ? 0 : Math.min(bevel * corner[k], half[a] * 0.42);
        return signs[a] * (half[a] - inset) + (rnd() - 0.5) * 2 * Math.min(jitter, half[a] * 0.2);
      });
      cache.set(key, p);
      return p;
    }
    const triangles = [];
    const signs = [-1, 1];
    for (let axis = 0; axis < 3; axis++) {
      const a1 = (axis + 1) % 3;
      const a2 = (axis + 2) % 3;
      // Faces principales : quatre sommets et un centre bombé.
      for (const s of signs) {
        const quad = [
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1],
        ].map(([p1, p2]) => {
          const sg = [0, 0, 0];
          sg[axis] = s;
          sg[a1] = p1;
          sg[a2] = p2;
          return vertex(sg, axis);
        });
        const centre = [0, 1, 2].map((c) => quad.reduce((sum, q) => sum + q[c], 0) / 4);
        centre[axis] += s * dome * (0.4 + rnd() * 0.9);
        centre[a1] += (rnd() - 0.5) * half[a1] * 0.3;
        centre[a2] += (rnd() - 0.5) * half[a2] * 0.3;
        for (let i = 0; i < 4; i++) triangles.push([quad[i], quad[(i + 1) % 4], centre]);
      }
      // Chanfreins des quatre arêtes parallèles à cet axe.
      for (const s1 of signs)
        for (const s2 of signs) {
          const at = (s, face) => {
            const sg = [0, 0, 0];
            sg[axis] = s;
            sg[a1] = s1;
            sg[a2] = s2;
            return vertex(sg, face);
          };
          triangles.push([at(-1, a1), at(1, a1), at(1, a2)], [at(-1, a1), at(1, a2), at(-1, a2)]);
        }
    }
    // Coins.
    for (const sx of signs) for (const sy of signs) for (const sz of signs) triangles.push([vertex([sx, sy, sz], 0), vertex([sx, sy, sz], 1), vertex([sx, sy, sz], 2)]);
    const geometry = fromTriangles(triangles, { uvScale });
    geometry.userData.size = size.slice();
    return geometry;
  }

  /**
   * Rocher : icosphère déformée par un bruit, taillée par quelques plans de clivage
   * (faces planes du granit), aplatie et à base plate. Taille unité (rayon ≈ 1).
   */
  function boulderGeometry({ detail = 2, seed = 1, squash = 0.7, bump = 0.16, cuts = 5, cutDepth = [0.7, 0.92], bottom = -0.3, smoothness = 0.72, uvScale = 1.1, box = 0 } = {}) {
    const rnd = random(seed * 7907 + 3);
    const ico = new THREE.IcosahedronGeometry(1, detail);
    const source = ico.attributes.position;
    const planes = [];
    for (let i = 0; i < cuts; i++) {
      const z = rnd() * 2 - 1;
      const t = rnd() * Math.PI * 2;
      const r = Math.sqrt(1 - z * z);
      planes.push({ n: [r * Math.cos(t), z * 0.8, r * Math.sin(t)], d: cutDepth[0] + rnd() * (cutDepth[1] - cutDepth[0]) });
    }
    const o = [rnd() * 50, rnd() * 50, rnd() * 50];
    const moved = new Map();
    function deform(x, y, z) {
      const key = Math.round(x * 1e4) + "," + Math.round(y * 1e4) + "," + Math.round(z * 1e4);
      let p = moved.get(key);
      if (p) return p;
      const r = 1 + (fbm3(x * 1.4 + o[0], y * 1.4 + o[1], z * 1.4 + o[2], seed, 3) - 0.5) * 2 * bump + (noise3(x * 4.1 + o[1], y * 4.1, z * 4.1 + o[0], seed + 5) - 0.5) * bump * 0.35;
      // box > 0 : superellipsoïde (bloc aux arêtes arrondies) plutôt que sphère.
      const k = box > 0 ? Math.pow(Math.abs(x) ** box + Math.abs(y) ** box + Math.abs(z) ** box, 1 / box) : 1;
      p = [(x / k) * r, (y / k) * r, (z / k) * r];
      for (const { n, d } of planes) {
        const len = Math.hypot(n[0], n[1], n[2]);
        const t = (p[0] * n[0] + p[1] * n[1] + p[2] * n[2]) / len;
        if (t > d) for (let i = 0; i < 3; i++) p[i] -= (n[i] / len) * (t - d) * 0.92;
      }
      p[1] *= squash;
      if (p[1] < bottom) p[1] = bottom + (p[1] - bottom) * 0.2;
      moved.set(key, p);
      return p;
    }
    const triangles = [];
    for (let i = 0; i < source.count; i += 3) {
      const tri = [];
      for (let k = 0; k < 3; k++) tri.push(deform(source.getX(i + k), source.getY(i + k), source.getZ(i + k)));
      triangles.push(tri);
    }
    ico.dispose();
    const geometry = fromTriangles(triangles, { smoothness, uvScale });
    return geometry;
  }

  // --- Feuilles et fleurs ----------------------------------------------------------------

  /**
   * Feuille : limbe pointu le long de +z (longueur 1), nervure centrale relevée, bords
   * légèrement creusés, pointe qui retombe (curl). Couleur par sommet : base plus sombre.
   */
  function leafGeometry({ width = 0.45, segments = 4, curl = 0.2, cup = 0.12, rib = 0.03, base = 0.72 } = {}) {
    const position = [];
    const color = [];
    const index = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const half = (width / 2) * Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.92 + 0.04)), 0.75);
      const y = -curl * t * t;
      const shade = base + (1 - base) * Math.min(1, t * 1.6);
      position.push(-half, y + cup * half, t, 0, y + rib, t, half, y + cup * half, t);
      for (let k = 0; k < 3; k++) color.push(shade, shade, shade);
      if (i < segments) {
        const a = i * 3;
        index.push(a, a + 3, a + 1, a + 1, a + 3, a + 4, a + 1, a + 4, a + 2, a + 2, a + 4, a + 5);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(position, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(color, 3));
    geometry.setIndex(index);
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    return geometry;
  }

  /** Fleur simple (camélia, rose trémière…) : pétales en coupe autour d'un cœur jaune. */
  function flowerGeometry({ petals = 6, cup = 0.35, heart = [1, 0.86, 0.35] } = {}) {
    const position = [0, 0.05, 0];
    const color = [...heart];
    const index = [];
    for (let p = 0; p < petals; p++) {
      const a0 = (p / petals) * Math.PI * 2;
      const a1 = ((p + 0.5) / petals) * Math.PI * 2;
      const a2 = ((p + 1) / petals) * Math.PI * 2;
      const base = position.length / 3;
      position.push(Math.cos(a0) * 0.18, 0.02, Math.sin(a0) * 0.18);
      position.push(Math.cos(a1) * 1, cup, Math.sin(a1) * 1);
      position.push(Math.cos(a2) * 0.18, 0.02, Math.sin(a2) * 0.18);
      color.push(...heart, 1, 1, 1, ...heart);
      index.push(0, base + 2, base, base, base + 2, base + 1);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(position, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(color, 3));
    geometry.setIndex(index);
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    return geometry;
  }

  // --- Lots instanciés -----------------------------------------------------------------

  const _matrix = new THREE.Matrix4();
  const _quaternion = new THREE.Quaternion();
  const _euler = new THREE.Euler(0, 0, 0, "YXZ");
  const _position = new THREE.Vector3();
  const _scale = new THREE.Vector3();
  const _color = new THREE.Color();
  const colorCache = new Map();
  /** Couleur linéaire à partir d'un code sRGB (mise en cache). */
  function linear(hex) {
    let c = colorCache.get(hex);
    if (!c) colorCache.set(hex, (c = new THREE.Color(hex).convertSRGBToLinear()));
    return c;
  }

  /** Géométrie qui partage les attributs d'une forme (même tampon sur la carte graphique). */
  function wrap(shape) {
    const geometry = new THREE.BufferGeometry();
    for (const name of Object.keys(shape.attributes)) geometry.setAttribute(name, shape.attributes[name]);
    if (shape.index) geometry.setIndex(shape.index);
    return geometry;
  }

  /**
   * Lot de pierres instanciées. add() range une pierre (forme, position, rotation
   * [tangage, lacet, roulis] en ordre YXZ, échelle, couleur, teinte) ; build() crée,
   * secteur par secteur et forme par forme, un InstancedMesh dont la sphère englobante
   * couvre ses pierres (la caméra et l'ombre écartent les secteurs hors champ).
   * lowShapes : formes simplifiées (même ordre) pour les secteurs éloignés ; updateLod()
   * échange la géométrie selon la distance de la caméra (les pierres restent en place).
   */
  class Lot {
    constructor(shapes, material, { name = "Pierres_seches_v32", cell = 24, lowShapes = null, lodDistance = 45 } = {}) {
      this.shapes = shapes;
      this.material = material;
      this.name = name;
      this.cell = cell;
      this.items = [];
      this.lowShapes = lowShapes;
      this.lodDistance = lodDistance;
      this.lodMeshes = [];
    }
    add(shape, position, rotation, scale, color, tint = 1) {
      this.items.push({ shape: shape % this.shapes.length, position, rotation, scale, color, tint });
      return this;
    }
    get count() {
      return this.items.length;
    }
    get triangles() {
      let total = 0;
      for (const item of this.items) {
        const shape = this.shapes[item.shape];
        total += (shape.index ? shape.index.count : shape.attributes.position.count) / 3;
      }
      return total;
    }
    build(parent, { castShadow = true, receiveShadow = true } = {}) {
      const groups = new Map();
      for (const item of this.items) {
        const key = item.shape + ":" + Math.floor(item.position[0] / this.cell) + ":" + Math.floor(item.position[2] / this.cell);
        let list = groups.get(key);
        if (!list) groups.set(key, (list = []));
        list.push(item);
      }
      const meshes = [];
      for (const [key, items] of groups) {
        const shape = this.shapes[items[0].shape];
        const geometry = wrap(shape);
        if (!shape.boundingSphere) shape.computeBoundingSphere();
        const mesh = new THREE.InstancedMesh(geometry, this.material, items.length);
        const box = new THREE.Box3();
        let reach = 0;
        items.forEach((item, i) => {
          _position.fromArray(item.position);
          _euler.set(item.rotation[0], item.rotation[1], item.rotation[2], "YXZ");
          _quaternion.setFromEuler(_euler);
          _scale.fromArray(item.scale);
          _matrix.compose(_position, _quaternion, _scale);
          mesh.setMatrixAt(i, _matrix);
          _color.copy(typeof item.color === "string" ? linear(item.color) : item.color).multiplyScalar(item.tint);
          mesh.setColorAt(i, _color);
          box.expandByPoint(_position);
          reach = Math.max(reach, _scale.x, _scale.y, _scale.z);
        });
        const radius = reach * (shape.boundingSphere.radius + shape.boundingSphere.center.length());
        geometry.boundingSphere = box.getBoundingSphere(new THREE.Sphere());
        geometry.boundingSphere.radius += radius;
        geometry.boundingBox = box.clone().expandByScalar(radius);
        mesh.name = this.name + "_" + key.replace(/:/g, "_").replace(/-/g, "m");
        mesh.castShadow = castShadow;
        mesh.receiveShadow = receiveShadow;
        mesh.frustumCulled = true;
        mesh.userData.exportSkip = true;
        mesh.userData.v32Stones = true;
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        const low = this.lowShapes && this.lowShapes[items[0].shape];
        if (low) {
          const lowGeometry = wrap(low);
          lowGeometry.boundingSphere = geometry.boundingSphere;
          lowGeometry.boundingBox = geometry.boundingBox;
          mesh.userData.v32Lod = { high: geometry, low: lowGeometry, far: false };
          this.lodMeshes.push(mesh);
        }
        parent.add(mesh);
        meshes.push(mesh);
      }
      return meshes;
    }
    /** Secteurs lointains en formes simples (avec une marge pour ne pas clignoter). */
    updateLod(camera) {
      let changed = false;
      for (const mesh of this.lodMeshes) {
        const lod = mesh.userData.v32Lod;
        const sphere = lod.high.boundingSphere;
        const distance = camera.position.distanceTo(sphere.center) - sphere.radius;
        const far = distance > this.lodDistance + (lod.far ? -4 : 4);
        if (far === lod.far) continue;
        lod.far = far;
        mesh.geometry = far ? lod.low : lod.high;
        changed = true;
      }
      return changed;
    }
  }

  /** Pierre simplifiée pour le lointain : pavé de mêmes dimensions (12 triangles). */
  function boxShape(size, uvScale = 1.7) {
    const geometry = new THREE.BoxGeometry(size[0], size[1], size[2]);
    const uv = geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * size[0] * uvScale, uv.getY(i) * size[1] * uvScale);
    geometry.computeBoundingSphere();
    return geometry;
  }

  // --- Assembleur de petits objets ------------------------------------------------------

  const primitives = new Map();
  /** Formes simples partagées (non indexées), créées à la demande. */
  function primitive(kind, ...args) {
    const key = kind + ":" + args.join(",");
    let geometry = primitives.get(key);
    if (geometry) return geometry;
    switch (kind) {
      case "box":
        geometry = new THREE.BoxGeometry(1, 1, 1);
        break;
      case "cylinder":
        geometry = new THREE.CylinderGeometry(args[1] ?? 1, args[2] ?? 1, 1, args[0] || 12, 1, !!args[3]);
        break;
      case "sphere":
        geometry = new THREE.SphereGeometry(1, args[0] || 10, args[1] || 7);
        break;
      case "ico":
        geometry = new THREE.IcosahedronGeometry(1, args[0] || 0);
        break;
      case "cone":
        geometry = new THREE.ConeGeometry(1, 1, args[0] || 8);
        break;
      case "torus":
        geometry = new THREE.TorusGeometry(1, args[0] || 0.1, args[1] || 6, args[2] || 12, args[3] || Math.PI * 2);
        break;
      default:
        throw new Error("Forme inconnue : " + kind);
    }
    if (geometry.index) {
      const flat = geometry.toNonIndexed();
      geometry.dispose();
      geometry = flat;
    }
    primitives.set(key, geometry);
    return geometry;
  }

  const _normalMatrix = new THREE.Matrix3();
  const _local = new THREE.Matrix4();
  /**
   * Assemblage : formes placées par une matrice et fusionnées en une seule géométrie à
   * couleur par sommet. part() prend une position, une rotation (YXZ) et une échelle
   * dans le repère courant (setOrigin).
   */
  class Assembly {
    constructor() {
      this.position = [];
      this.normal = [];
      this.uv = [];
      this.color = [];
      this.origin = new THREE.Matrix4();
    }
    setOrigin(x, y, z, yaw = 0, pitch = 0, roll = 0, scale = 1) {
      _euler.set(pitch, yaw, roll, "YXZ");
      this.origin.compose(_position.set(x, y, z), _quaternion.setFromEuler(_euler), _scale.set(scale, scale, scale));
      return this;
    }
    add(geometry, matrix, color, uvScale = 1) {
      const source = geometry.index ? geometry.toNonIndexed() : geometry;
      const p = source.attributes.position;
      const n = source.attributes.normal;
      const t = source.attributes.uv;
      // Couleurs de la forme (bois de bout, dessous plus sombre…) × couleur de la pièce.
      const k = source.attributes.color;
      _normalMatrix.getNormalMatrix(matrix);
      const c = typeof color === "string" ? linear(color) : color;
      const flip = matrix.determinant() < 0;
      for (let i = 0; i < p.count; i++) {
        const j = flip ? i - (i % 3) + (2 - (i % 3)) : i;
        _a.fromBufferAttribute(p, j).applyMatrix4(matrix);
        this.position.push(_a.x, _a.y, _a.z);
        if (n) _b.fromBufferAttribute(n, j).applyMatrix3(_normalMatrix).normalize();
        else _b.set(0, 1, 0);
        this.normal.push(_b.x, _b.y, _b.z);
        this.uv.push(t ? t.getX(j) * uvScale : 0, t ? t.getY(j) * uvScale : 0);
        if (k) this.color.push(c.r * k.getX(j), c.g * k.getY(j), c.b * k.getZ(j));
        else this.color.push(c.r, c.g, c.b);
      }
      if (source !== geometry) source.dispose();
      return this;
    }
    /** Forme dans le repère courant : at [x,y,z], rot [tangage, lacet, roulis], size [sx,sy,sz]. */
    part(geometry, at, rot, size, color, uvScale = 1) {
      _euler.set(rot ? rot[0] : 0, rot ? rot[1] : 0, rot ? rot[2] : 0, "YXZ");
      _local.compose(_position.fromArray(at), _quaternion.setFromEuler(_euler), _scale.fromArray(size || [1, 1, 1]));
      return this.add(geometry, _local.premultiply(this.origin), color, uvScale);
    }
    box(at, size, color, rot) {
      return this.part(primitive("box"), at, rot, size, color);
    }
    /** Cylindre entre deux points du repère courant (rayon au départ, rayon à l'arrivée). */
    tube(from, to, radius, color, segments = 8, radiusTop = radius) {
      _a.fromArray(from);
      _b.fromArray(to);
      const length = _a.distanceTo(_b);
      if (length < 1e-5) return this;
      _c.subVectors(_b, _a).normalize();
      _quaternion.setFromUnitVectors(_n.set(0, 1, 0), _c);
      _local.compose(_a.add(_b).multiplyScalar(0.5), _quaternion, _scale.set(radius, length, radius));
      const ratio = Math.round((radiusTop / radius) * 50) / 50;
      return this.add(primitive("cylinder", segments, ratio, 1), _local.premultiply(this.origin), color);
    }
    get triangles() {
      return this.position.length / 9;
    }
    geometry() {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(this.position, 3));
      geometry.setAttribute("normal", new THREE.Float32BufferAttribute(this.normal, 3));
      geometry.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2));
      geometry.setAttribute("color", new THREE.Float32BufferAttribute(this.color, 3));
      geometry.computeBoundingSphere();
      geometry.computeBoundingBox();
      return geometry;
    }
  }

  // --- Retrait des anciennes boîtes -----------------------------------------------------

  function renderBatches(game) {
    const root = game.scene.getObjectByName("Rendu_spatial");
    const list = [];
    if (root) for (const child of root.children) if (child.isMesh && /^Details_groupes/.test(child.name)) list.push(child);
    return list;
  }

  /** Retrouve le bloc de sommets d'un maillage d'origine dans un lot fusionné. */
  function locate(mesh, batches) {
    const position = mesh.geometry && mesh.geometry.attributes.position;
    if (!position || !position.count) return null;
    mesh.updateWorldMatrix(true, false);
    const probes = [0, position.count >> 1, position.count - 1].map((i) => ({
      i,
      p: _a.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld).toArray(),
    }));
    const near = (array, k, p) => Math.abs(array[k] - p[0]) < 2e-3 && Math.abs(array[k + 1] - p[1]) < 2e-3 && Math.abs(array[k + 2] - p[2]) < 2e-3;
    for (const batch of batches) {
      if (batch.material !== mesh.material) continue;
      const array = batch.geometry.attributes.position.array;
      const last = array.length / 3 - position.count;
      for (let start = 0; start <= last; start++) {
        if (!near(array, start * 3, probes[0].p)) continue;
        if (probes.every(({ i, p }) => near(array, (start + i) * 3, p))) return { batch, start, count: position.count };
      }
    }
    return null;
  }

  /**
   * Retire (en place) les triangles dont le premier sommet est dans [start, start+count[,
   * sauf ceux que keep(x, y, z) garde (centre du triangle, repère du monde).
   */
  function removeTriangles(geometry, start, count, keep, matrix, blockSize = 0) {
    const index = geometry.index;
    if (!index) return 0;
    const array = index.array;
    const positions = geometry.attributes.position.array;
    // Par blocs (une pierre, un buisson) : on garde ou retire le bloc entier selon son centre.
    const blocks = new Map();
    const blockKeep = (a) => {
      const block = Math.floor((a - start) / blockSize);
      let kept = blocks.get(block);
      if (kept === undefined) {
        _b.set(0, 0, 0);
        const first = start + block * blockSize;
        for (let v = first; v < first + blockSize; v++) {
          _b.x += positions[v * 3];
          _b.y += positions[v * 3 + 1];
          _b.z += positions[v * 3 + 2];
        }
        _b.multiplyScalar(1 / blockSize);
        if (matrix) _b.applyMatrix4(matrix);
        blocks.set(block, (kept = !!keep(_b.x, _b.y, _b.z)));
      }
      return kept;
    };
    const from = geometry.drawRange.start;
    const to = Math.min(array.length, from + (Number.isFinite(geometry.drawRange.count) ? geometry.drawRange.count : array.length));
    let write = from;
    let removed = 0;
    for (let t = from; t + 2 < to; t += 3) {
      const a = array[t];
      const b = array[t + 1];
      const c = array[t + 2];
      let drop = a >= start && a < start + count;
      if (drop && keep && blockSize) drop = !blockKeep(a);
      else if (drop && keep) {
        _a.set(
          (positions[a * 3] + positions[b * 3] + positions[c * 3]) / 3,
          (positions[a * 3 + 1] + positions[b * 3 + 1] + positions[c * 3 + 1]) / 3,
          (positions[a * 3 + 2] + positions[b * 3 + 2] + positions[c * 3 + 2]) / 3,
        );
        if (matrix) _a.applyMatrix4(matrix);
        if (keep(_a.x, _a.y, _a.z)) drop = false;
      }
      if (drop) {
        removed++;
        continue;
      }
      array[write] = a;
      array[write + 1] = b;
      array[write + 2] = c;
      write += 3;
    }
    if (removed) {
      geometry.setDrawRange(from, write - from);
      index.needsUpdate = true;
    }
    return removed;
  }

  /**
   * Retire des images des maillages d'origine remplacés. Fusionnés par le cache de rendu :
   * on retire leurs triangles du lot (keep peut en garder une partie). Restés seuls :
   * masqués (ou filtrés avec keep). Ils restent marqués « source » : l'export 3D statique
   * garde leur forme simple.
   */
  function detach(game, meshes, keep = null, blockSize = 0) {
    const batches = renderBatches(game);
    const stats = { meshes: 0, triangles: 0, missing: 0 };
    for (const mesh of meshes) {
      if (!mesh || !mesh.isMesh || mesh.userData.v32Detached) continue;
      mesh.userData.v32Detached = true;
      stats.meshes++;
      const found = mesh.userData.renderSource ? locate(mesh, batches) : null;
      if (found) {
        stats.triangles += removeTriangles(found.batch.geometry, found.start, found.count, keep, null, blockSize);
        continue;
      }
      if (mesh.userData.renderSource) {
        stats.missing++;
        continue;
      }
      if (keep) {
        mesh.updateWorldMatrix(true, false);
        stats.triangles += removeTriangles(mesh.geometry, 0, mesh.geometry.attributes.position.count, keep, mesh.matrixWorld, blockSize);
      } else {
        mesh.visible = false;
        mesh.userData.renderSource = true;
      }
    }
    return stats;
  }

  // --- Sol du jardin ---------------------------------------------------------------------

  /** Point dans un polygone [[x, z], …]. */
  function inside(x, z, polygon) {
    let result = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [xi, zi] = polygon[i];
      const [xj, zj] = polygon[j];
      if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) result = !result;
    }
    return result;
  }
  // Surfaces revêtues du jeu (niveaux fixes, au-dessus du relief) : cour gravillonnée,
  // passage, terrasse dallée, jardin clos à l'est.
  const FLOOR = 1.08;
  const PAVED = [
    { level: FLOOR + 0.0875, poly: [[-7.4, 7.9], [2.05, 7.75], [2.6, 8.1], [2.3, 11.8], [0.8, 16.5], [-6.2, 16.9]] },
    { level: FLOOR + 0.04, poly: [[-11.9, -11], [-6.4, -9], [-5, 5.8], [-11.2, 7.2]] },
    { level: FLOOR + 0.05, poly: [[4.16, 8.15], [9, 6.5], [15.8, 8.8], [16.9, 12], [15.9, 14.45], [9.1, 16.3], [5.55, 17], [5.3, 12]] },
    { level: FLOOR + 0.03, poly: [[-19, 6], [-13, 4], [-6, 5.8], [-4, 7], [2.05, 7.75], [2.6, 8.1], [2.3, 11.8], [0.8, 16.6], [-6.5, 17], [-11.5, 17.2], [-20, 14.5], [-23, 9]] },
  ];
  /**
   * Hauteur du sol où poser un objet : relief, ou niveau d'une surface revêtue (cour,
   * terrasse, parterre surélevé, palier derrière le mur de 3 m).
   */
  function groundAt(game, x, z) {
    const layout = game.siteLayout || {};
    const terrain = game.terrainHeight(x, z);
    if (layout.upperTerrace && inside(x, z, layout.upperTerrace)) return FLOOR + 3.215;
    if (layout.rearBed && inside(x, z, layout.rearBed)) return Math.max(terrain, FLOOR + 0.36);
    if (layout.forecourt && inside(x, z, layout.forecourt)) return Math.max(terrain, FLOOR + 0.025);
    for (const surface of PAVED) if (inside(x, z, surface.poly)) return Math.max(terrain, surface.level);
    return terrain;
  }

  /**
   * Gros blocs de part et d'autre de la niche de la rocaille : [x, z, rayon, écrasement].
   * La bordure de moellons (74-walls) s'interrompt à la place des deux gros (75-rockery
   * les pose) ; le petit, un peu en avant, s'appuie contre elle.
   */
  function nicheBoulders(layout) {
    const f = layout && layout.fountain;
    if (!f) return [];
    const cos = Math.cos(f.angle);
    const sin = Math.sin(f.angle);
    return [
      [1.3, 0.02, 0.46, 0.95],
      [1.98, -0.1, 0.38, 0.9],
      [-1.25, 0.16, 0.3, 0.85],
    ].map(([lx, lz, r, squash]) => [f.centre[0] + cos * lx + sin * lz, f.centre[1] - sin * lx + cos * lz, r, squash]);
  }

  /**
   * Relit un lot du jeu fait de boîtes unité (BoxGeometry, 24 sommets par pierre, faces
   * +x −x +y −y +z −z) : centre, dimensions et rotation [tangage, lacet, roulis] (YXZ)
   * de chaque boîte, dans le repère du monde.
   */
  function decodeBoxes(mesh) {
    const position = mesh && mesh.geometry.attributes.position;
    if (!position || position.count % 24) return [];
    mesh.updateWorldMatrix(true, false);
    const list = [];
    const faces = [0, 1, 2, 3, 4, 5].map(() => new THREE.Vector3());
    const basis = new THREE.Matrix4();
    for (let block = 0; block < position.count / 24; block++) {
      for (let face = 0; face < 6; face++) {
        faces[face].set(0, 0, 0);
        for (let k = 0; k < 4; k++) faces[face].add(_a.fromBufferAttribute(position, block * 24 + face * 4 + k).applyMatrix4(mesh.matrixWorld));
        faces[face].multiplyScalar(0.25);
      }
      const ax = faces[0].clone().sub(faces[1]);
      const ay = faces[2].clone().sub(faces[3]);
      const centre = faces.reduce((sum, c) => sum.add(c), new THREE.Vector3()).multiplyScalar(1 / 6);
      const sx = ax.length();
      const sy = ay.length();
      const sz = faces[4].distanceTo(faces[5]);
      ax.normalize();
      ay.addScaledVector(ax, -ay.dot(ax)).normalize();
      basis.makeBasis(ax, ay, _c.crossVectors(ax, ay));
      _euler.setFromQuaternion(_quaternion.setFromRotationMatrix(basis), "YXZ");
      list.push({ x: centre.x, y: centre.y, z: centre.z, sx, sy, sz, rotation: [_euler.x, _euler.y, _euler.z] });
    }
    return list;
  }

  /** Relit un lot de pierres rondes (même nombre de sommets par pierre) : centre et demi-tailles. */
  function decodeLumps(mesh, perBlock) {
    const position = mesh && mesh.geometry.attributes.position;
    if (!position || !perBlock || position.count % perBlock) return [];
    mesh.updateWorldMatrix(true, false);
    const list = [];
    const box = new THREE.Box3();
    for (let block = 0; block < position.count / perBlock; block++) {
      box.makeEmpty();
      for (let v = 0; v < perBlock; v++) box.expandByPoint(_a.fromBufferAttribute(position, block * perBlock + v).applyMatrix4(mesh.matrixWorld));
      const c = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      list.push({ x: c.x, y: c.y, z: c.z, rx: size.x / 2, ry: size.y / 2, rz: size.z / 2 });
    }
    return list;
  }

  /**
   * Retouches du relief dans l'atelier : l'éditeur appelle landscapeDetails.resettle() à la
   * fin de chaque coup de pinceau (et après Annuler / Rétablir). On y greffe callback, une
   * seule fois par clé, pour reposer les décors sur le nouveau sol.
   */
  function onTerrainEdit(game, key, callback) {
    const landscape = game.landscapeDetails;
    if (!landscape || typeof landscape.resettle !== "function") return false;
    const previous = landscape.resettle;
    if ((previous.v32Keys || []).includes(key)) return false;
    const wrapped = function () {
      const result = previous.apply(this, arguments);
      try {
        callback();
      } catch (error) {
        console.error("[Moulin V32] " + key + " : décor non reposé après la retouche", error);
      }
      return result;
    };
    wrapped.v32Keys = [...(previous.v32Keys || []), key];
    landscape.resettle = wrapped;
    return true;
  }

  /** Retire un groupe de décor et libère ses géométries (les matières sont partagées). */
  function disposeGroup(group) {
    if (!group) return;
    if (group.parent) group.parent.remove(group);
    group.traverse((object) => {
      if (object.isInstancedMesh) object.dispose();
      if (object.geometry) object.geometry.dispose();
      const lod = object.userData.v32Lod;
      if (lod) for (const geometry of [lod.high, lod.low]) geometry.dispose();
    });
  }

  /**
   * Maçonnerie « posée à la main » : dans un lot de pierres-boîtes du jeu (24 sommets par
   * pierre), chaque coin de la face vue recule un peu dans le plan du mur (joints
   * irréguliers, jamais plus grands que la place de la pierre), chaque pierre avance ou
   * recule de quelques millimètres, et sa teinte varie légèrement. La forme du bâtiment ne
   * change pas.
   */
  function roughen(game, mesh, { seed = 1, inset = 0.018, relief = 0.006, tints = null } = {}) {
    if (!mesh || !mesh.isMesh || mesh.userData.v32Roughened) return 0;
    const found = mesh.userData.renderSource ? locate(mesh, renderBatches(game)) : null;
    let geometry = null;
    let start = 0;
    let count = 0;
    if (found) {
      geometry = found.batch.geometry;
      start = found.start;
      count = found.count;
    } else if (mesh.visible && !mesh.userData.renderSource) {
      geometry = mesh.geometry;
      count = geometry.attributes.position.count;
    }
    if (!geometry || !count || count % 24) return 0;
    mesh.userData.v32Roughened = true;
    const position = geometry.attributes.position;
    const color = geometry.attributes.color;
    const rnd = random(seed);
    const faces = [0, 1, 2, 3, 4, 5].map(() => new THREE.Vector3());
    const axes = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    const centre = new THREE.Vector3();
    const v = new THREE.Vector3();
    const shifts = new Map();
    let stones = 0;
    for (let b = start; b < start + count; b += 24) {
      centre.set(0, 0, 0);
      for (let f = 0; f < 6; f++) {
        faces[f].set(0, 0, 0);
        for (let k = 0; k < 4; k++) faces[f].add(v.fromBufferAttribute(position, b + f * 4 + k));
        faces[f].multiplyScalar(0.25);
        centre.add(faces[f]);
      }
      centre.multiplyScalar(1 / 6);
      const sizes = [0, 1, 2].map((i) => axes[i].subVectors(faces[i * 2], faces[i * 2 + 1]).length());
      if (sizes.some((s) => s < 1e-4)) continue;
      axes.forEach((axis, i) => axis.multiplyScalar(1 / sizes[i]));
      const thin = sizes.indexOf(Math.min(...sizes));
      const lift = (rnd() - 0.5) * 2 * relief;
      shifts.clear();
      for (let k = 0; k < 24; k++) {
        v.fromBufferAttribute(position, b + k).sub(centre);
        const signs = axes.map((axis) => (v.dot(axis) >= 0 ? 1 : -1));
        const key = signs.join("");
        let shift = shifts.get(key);
        if (!shift) {
          shift = new THREE.Vector3();
          for (let i = 0; i < 3; i++) if (i !== thin) shift.addScaledVector(axes[i], -signs[i] * Math.min(inset, sizes[i] * 0.08) * rnd());
          shift.addScaledVector(axes[thin], lift);
          shifts.set(key, shift);
        }
        v.add(centre).add(shift);
        position.setXYZ(b + k, v.x, v.y, v.z);
      }
      if (color && tints) {
        const tint = tints(rnd);
        for (let k = 0; k < 24; k++) color.setXYZ(b + k, color.getX(b + k) * tint[0], color.getY(b + k) * tint[1], color.getZ(b + k) * tint[2]);
      }
      stones++;
    }
    position.needsUpdate = true;
    if (color) color.needsUpdate = true;
    return stones;
  }

  /** Tous les maillages d'un nom donné (sous root). */
  function meshesNamed(root, ...names) {
    const wanted = new Set(names);
    const list = [];
    root.traverse((object) => {
      if (object.isMesh && wanted.has(object.name)) list.push(object);
    });
    return list;
  }

  /** Boîte orientée d'un maillage-boîte : centre, dimensions (échelle comprise), lacet. */
  function orientedBox(mesh) {
    mesh.updateWorldMatrix(true, false);
    const p = mesh.geometry.parameters || {};
    const centre = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    mesh.matrixWorld.decompose(centre, quaternion, scale);
    _euler.setFromQuaternion(quaternion, "YXZ");
    return {
      x: centre.x,
      y: centre.y,
      z: centre.z,
      sx: (p.width || 1) * scale.x,
      sy: (p.height || 1) * scale.y,
      sz: (p.depth || 1) * scale.z,
      yaw: _euler.y,
    };
  }

  V32.stones = {
    random,
    hash,
    noise3,
    fbm3,
    noise2,
    fbm2,
    smooth,
    linear,
    rockTextures,
    rockMaterial,
    fromTriangles,
    blockGeometry,
    boulderGeometry,
    leafGeometry,
    flowerGeometry,
    boxShape,
    Lot,
    Assembly,
    primitive,
    renderBatches,
    detach,
    meshesNamed,
    orientedBox,
    inside,
    groundAt,
    nicheBoulders,
    decodeBoxes,
    decodeLumps,
    onTerrainEdit,
    disposeGroup,
    roughen,
  };
})();
