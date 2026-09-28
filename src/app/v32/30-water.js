// Moulin V32 — une eau qui vit.
//
// En plus du nouveau shader (rides croisées, courant visible, eau turquoise, écume de
// berge), ce module ajoute deux signes de mouvement très lisibles :
//  - des feuilles qui flottent, poussées par le vent sur les étangs et emportées par
//    le courant dans le bief et la rivière (plus nombreuses et dorées en automne) ;
//  - de temps en temps, un rond dans l'eau là où un poisson vient gober.
(function () {
  "use strict";
  const V32 = globalThis.MoulinV32;
  const THREE = globalThis.THREE;
  const { clamp } = V32;

  function seasonalPalette(date) {
    const month = date.getMonth(); // 0 = janvier
    const autumn = month >= 8 && month <= 10;
    const winter = month === 11 || month <= 1;
    if (autumn)
      return { count: 1, colours: ["#c98a2e", "#b5652a", "#d4a53a", "#8f5a2c", "#a8792f", "#7f8a3a", "#c47a2b"] };
    if (winter) return { count: 0.45, colours: ["#8a6a45", "#6f5b40", "#9c7b4d", "#5f5a3c"] };
    return { count: 0.6, colours: ["#6d8f3c", "#7d9a44", "#5c7f37", "#96a24a", "#b0913d"] };
  }

  function leafGeometry() {
    // Feuille simple : pointe, nervure légèrement relevée, deux lobes.
    const shape = new THREE.Shape();
    shape.moveTo(0, -0.07);
    shape.quadraticCurveTo(0.055, -0.035, 0.045, 0.015);
    shape.quadraticCurveTo(0.03, 0.055, 0, 0.075);
    shape.quadraticCurveTo(-0.03, 0.055, -0.045, 0.015);
    shape.quadraticCurveTo(-0.055, -0.035, 0, -0.07);
    const geometry = new THREE.ShapeGeometry(shape, 3);
    geometry.rotateX(-Math.PI / 2);
    const position = geometry.attributes.position;
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      position.setY(i, 0.012 * (1 - Math.min(1, Math.abs(x) / 0.05)));
    }
    geometry.computeVertexNormals();
    return geometry;
  }

  V32.register(
    "water-life",
    function (context) {
      const { game, hooks } = context;
      const inside = hooks.inside;
      const regions = (game.waterRegions || []).filter((region) => region.poly?.length > 2);
      const channels = (game.channels || []).filter((channel) => channel.line?.length > 1);
      if (!inside || (!regions.length && !channels.length)) return null;
      const islands = hooks.islands || [];
      const mobile = hooks.mobile;
      const palette = seasonalPalette(new Date());
      const count = Math.round((mobile ? 90 : 190) * palette.count) + 20;

      let seed = 90211;
      const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0), seed / 4294967296);
      const inPond = (x, z, region) => inside([x, z], region.poly) && !islands.some((island) => inside([x, z], island.poly || island));

      // Grandes étendues d'abord : le grand étang reçoit la majorité des feuilles.
      const areas = regions.map((region) => {
        let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
        for (const [x, z] of region.poly) {
          minX = Math.min(minX, x); maxX = Math.max(maxX, x);
          minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
        }
        return { region, minX, maxX, minZ, maxZ, weight: Math.sqrt((maxX - minX) * (maxZ - minZ)) };
      });
      const routes = channels.map((channel) => {
        const lengths = [0];
        for (let i = 1; i < channel.line.length; i++) {
          const a = channel.line[i - 1], b = channel.line[i];
          lengths.push(lengths[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
        }
        return { channel, lengths, length: lengths[lengths.length - 1] };
      }).filter((route) => route.length > 4);

      function pointOnRoute(route, distance, offset) {
        const { channel, lengths } = route;
        let i = 1;
        while (i < lengths.length - 1 && lengths[i] < distance) i++;
        const a = channel.line[i - 1], b = channel.line[i];
        const t = clamp((distance - lengths[i - 1]) / Math.max(0.001, lengths[i] - lengths[i - 1]), 0, 1);
        const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz) || 1;
        return { x: a[0] + dx * t - (dz / len) * offset, z: a[1] + dz * t + (dx / len) * offset, fx: dx / len, fz: dz / len };
      }

      const leaves = [];
      const totalWeight = areas.reduce((sum, area) => sum + area.weight, 0) + routes.length * 18;
      function channelLevel(leaf, x, z) {
        const sample = game.channelSample?.([x, z], leaf.route.channel, 4);
        return sample && Number.isFinite(sample.height) && sample.distance < 50 ? sample.height : leaf.levelAt ?? 0;
      }
      function spawn(leaf, fresh) {
        leaf.age = 0;
        leaf.scale = 0.75 + random() * 0.6;
        leaf.spin = (random() - 0.5) * 0.6;
        leaf.rotation = random() * Math.PI * 2;
        leaf.phase = random() * 10;
        if (leaf.route) {
          const route = leaf.route;
          leaf.distance = fresh ? random() * route.length : random() * Math.min(6, route.length * 0.2);
          const sample = game.channelSample?.([route.channel.line[0][0], route.channel.line[0][1]], route.channel) || {};
          leaf.offset = (random() - 0.5) * (sample.width || route.channel.width || 1.6) * 0.55;
          leaf.speed = 0.35 + random() * 0.35;
          const point = pointOnRoute(route, leaf.distance, leaf.offset);
          leaf.levelAt = channelLevel(leaf, point.x, point.z);
          return;
        }
        const area = leaf.area;
        for (let attempt = 0; attempt < 30; attempt++) {
          const x = area.minX + random() * (area.maxX - area.minX);
          const z = area.minZ + random() * (area.maxZ - area.minZ);
          if (inPond(x, z, area.region)) {
            leaf.x = x;
            leaf.z = z;
            return;
          }
        }
        leaf.x = (area.minX + area.maxX) / 2;
        leaf.z = (area.minZ + area.maxZ) / 2;
      }
      for (let i = 0; i < count; i++) {
        let pick = random() * totalWeight;
        const leaf = { area: null, route: null, x: 0, z: 0, check: random() * 0.6 };
        for (const area of areas) {
          if ((pick -= area.weight) <= 0) {
            leaf.area = area;
            break;
          }
        }
        if (!leaf.area) leaf.route = routes[Math.floor(random() * routes.length)] || null;
        if (!leaf.area && !leaf.route) leaf.area = areas[0];
        if (!leaf.area && !leaf.route) continue;
        leaf.colour = new THREE.Color(palette.colours[i % palette.colours.length]).convertSRGBToLinear();
        spawn(leaf, true);
        leaves.push(leaf);
      }

      const material = new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide });
      material.userData.noWeatherPaint22 = true;
      const mesh = new THREE.InstancedMesh(leafGeometry(), material, Math.max(1, leaves.length));
      mesh.name = "Feuilles_flottantes_v32";
      mesh.frustumCulled = false;
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      mesh.userData.exportSkip = true;
      mesh.renderOrder = 6;
      leaves.forEach((leaf, i) => mesh.setColorAt(i, leaf.colour));
      game.model.add(mesh);

      // Ronds de poissons : quelques anneaux qui s'élargissent puis s'effacent.
      const ringCount = mobile ? 3 : 5;
      const ringGeometry = new THREE.PlaneGeometry(1, 1);
      ringGeometry.rotateX(-Math.PI / 2);
      const ringStart = new THREE.InstancedBufferAttribute(new Float32Array(ringCount).fill(-100), 1);
      ringGeometry.setAttribute("ringStart32", ringStart);
      const ringMaterial = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { time: { value: 0 }, daylight: V32.uniforms.daylight },
        vertexShader:
          "attribute float ringStart32;uniform float time;varying vec2 vUv;varying float vAge;void main(){vUv=uv;vAge=time-ringStart32;float r=.35+vAge*.55;vec4 p=instanceMatrix*vec4(position*vec3(r,1.,r),1.);gl_Position=projectionMatrix*modelViewMatrix*p;}",
        fragmentShader: `uniform float daylight;varying vec2 vUv;varying float vAge;void main(){if(vAge<0.||vAge>3.2)discard;float d=length(vUv-.5)*2.;float ring=(1.-smoothstep(.0,.07,abs(d-.82)))+(1.-smoothstep(.0,.06,abs(d-.55)))*.55*smoothstep(.3,.9,vAge);float a=ring*(1.-smoothstep(.6,3.2,vAge))*.42;if(a<.01)discard;gl_FragColor=vec4(vec3(.82,.93,.95)*(.25+.75*daylight),a);
#include <tonemapping_fragment>
#include <encodings_fragment>
}`,
      });
      const rings = new THREE.InstancedMesh(ringGeometry, ringMaterial, ringCount);
      rings.name = "Ronds_de_poissons_v32";
      rings.frustumCulled = false;
      rings.renderOrder = 7;
      rings.userData.exportSkip = true;
      game.model.add(rings);
      let nextRing = 2;
      let ringIndex = 0;

      const matrix = new THREE.Matrix4();
      const quaternion = new THREE.Quaternion();
      const up = new THREE.Vector3(0, 1, 0);
      const position = new THREE.Vector3();
      const scale = new THREE.Vector3();
      const camera = game.camera;
      let clock = 0;
      let visibleCheck = 0;


      function update(dt) {
        if (!hooks.animationsEnabled()) return false;
        dt = Math.min(dt, 0.1);
        clock += dt;
        // Rien à animer si la caméra est très haut (vue du plan) : on économise.
        const cameraHeight = camera.position.y;
        mesh.visible = cameraHeight < 260;
        rings.visible = mesh.visible;
        if (!mesh.visible) return false;
        const wind = V32.uniforms.wind.value;
        const dir = V32.uniforms.windDirection.value;
        const drift = 0.03 + wind * 0.11;
        for (let i = 0; i < leaves.length; i++) {
          const leaf = leaves[i];
          leaf.age += dt;
          leaf.rotation += leaf.spin * dt;
          let y;
          if (leaf.route) {
            leaf.distance += leaf.speed * dt;
            if (leaf.distance > leaf.route.length - 0.5) spawn(leaf, false);
            const point = pointOnRoute(leaf.route, leaf.distance, leaf.offset + Math.sin(clock * 0.7 + leaf.phase) * 0.08);
            leaf.x = point.x;
            leaf.z = point.z;
            leaf.check -= dt;
            if (leaf.check <= 0) {
              leaf.check = 0.8;
              leaf.levelAt = channelLevel(leaf, leaf.x, leaf.z);
            }
            y = leaf.levelAt;
            leaf.rotation += Math.sin(clock * 1.3 + leaf.phase) * dt * 0.8;
          } else {
            const wobble = Math.sin(clock * 0.31 + leaf.phase) * 0.6;
            const nx = leaf.x + (dir.x * drift + Math.cos(leaf.phase + clock * 0.05) * 0.01) * dt + wobble * 0.002;
            const nz = leaf.z + (dir.y * drift + Math.sin(leaf.phase + clock * 0.05) * 0.01) * dt;
            leaf.check -= dt;
            if (leaf.check <= 0) {
              leaf.check = 0.7 + random() * 0.4;
              if (!inPond(nx, nz, leaf.area.region)) {
                spawn(leaf, false);
                continue;
              }
            }
            leaf.x = nx;
            leaf.z = nz;
            y = leaf.area.region.level;
          }
          const grow = Math.min(1, leaf.age * 0.8);
          position.set(leaf.x, y + 0.028 + Math.sin(clock * 1.9 + leaf.phase) * 0.004, leaf.z);
          quaternion.setFromAxisAngle(up, leaf.rotation);
          scale.setScalar(leaf.scale * grow);
          mesh.setMatrixAt(i, matrix.compose(position, quaternion, scale));
        }
        mesh.instanceMatrix.needsUpdate = true;

        ringMaterial.uniforms.time.value = clock;
        nextRing -= dt;
        visibleCheck -= dt;
        if (nextRing <= 0 && areas.length) {
          nextRing = 2.5 + random() * 6;
          // Un rond près de la caméra, dans l'étang le plus proche.
          const target = new THREE.Vector3();
          camera.getWorldDirection(target);
          const distance = 8 + random() * 30;
          const x = camera.position.x + target.x * distance + (random() - 0.5) * 16;
          const z = camera.position.z + target.z * distance + (random() - 0.5) * 16;
          const area = areas.find((candidate) => inPond(x, z, candidate.region));
          if (area) {
            position.set(x, area.region.level + 0.03, z);
            rings.setMatrixAt(ringIndex, matrix.compose(position, quaternion.identity(), scale.set(1, 1, 1)));
            ringStart.setX(ringIndex, clock);
            ringStart.needsUpdate = true;
            rings.instanceMatrix.needsUpdate = true;
            ringIndex = (ringIndex + 1) % ringCount;
          }
        }
        return true;
      }

      return { update, leaves: mesh, rings, stats: () => ({ leaves: leaves.length, season: palette.count }) };
    },
    30,
  );
})();
