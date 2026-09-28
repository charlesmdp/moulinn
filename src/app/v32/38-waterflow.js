// Moulin V32 — eau vive : roue à aubes, chutes et vannes.
//
// La roue effleurait l'eau sans la toucher (bas de la roue à 3 cm au-dessus de la
// surface). Elle est descendue de 28 cm pour tremper comme une roue « en dessous » :
// les aubes qui remontent ruissellent (rideaux d'eau), perdent des gouttes qui font des
// ronds à la surface, et l'eau blanchit là où elles la frappent. Les nappes des chutes
// coulent à la vitesse d'une vraie chute et projettent des embruns à leur pied. Les
// zones agitées (roue, chutes, vannes) sont transmises au shader de l'eau (remous,
// écume qui dérive avec le courant).
(function () {
  "use strict";
  const V32 = globalThis.MoulinV32;

  const DROP_VERTEX = `attribute float size;attribute float alpha;uniform float pointScale;varying float vAlpha;
void main(){vAlpha=alpha;vec4 view=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*view;
gl_PointSize=clamp(size*pointScale/max(.1,-view.z),1.,24.);}`;
  const DROP_FRAGMENT = `uniform float daylight;varying float vAlpha;
void main(){vec2 d=gl_PointCoord-.5;float r=length(d);if(r>.5||vAlpha<.01)discard;
float body=1.-smoothstep(.18,.5,r);float glint=1.-smoothstep(.0,.2,length(d-vec2(-.12,-.14)));
gl_FragColor=vec4(mix(vec3(.72,.86,.88),vec3(1.),glint*.6)*(.28+.72*daylight),body*vAlpha);
#include <tonemapping_fragment>
#include <encodings_fragment>
}`;
  const CURTAIN_VERTEX = `attribute vec2 curtain;varying vec2 vUv;varying vec2 vCurtain;
void main(){vUv=uv;vCurtain=curtain;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`;
  const CURTAIN_FRAGMENT = `uniform float time,daylight;varying vec2 vUv;varying vec2 vCurtain;
float h32(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n32(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h32(i),h32(i+vec2(1.,0.)),f.x),mix(h32(i+vec2(0.,1.)),h32(i+vec2(1.,1.)),f.x),f.y);}
void main(){
 float x=vUv.x,y=vUv.y;
 float strands=n32(vec2(x*16.+vCurtain.y*9.,y*1.6+time*3.4))*.6+n32(vec2(x*34.+vCurtain.y*3.,y*3.1+time*4.6))*.4;
 float edge=smoothstep(0.,.14,x)*(1.-smoothstep(.86,1.,x));
 float alpha=smoothstep(.38,.78,strands)*edge*(.3+.7*y)*vCurtain.x;
 if(alpha<.01)discard;
 gl_FragColor=vec4(vec3(.8,.92,.94)*(.26+.74*daylight),alpha*.85);
 #include <tonemapping_fragment>
 #include <encodings_fragment>
}`;
  // Nappe d'eau d'une chute : lèvre lisse et brillante, filets blancs qui tombent vite,
  // bouillonnement au pied. uv.y va de l'amont (0) au bassin inférieur (1).
  const SHEET_VERTEX = `varying vec2 vUv;varying vec3 vWorld;
void main(){vUv=uv;vec4 w=modelMatrix*vec4(position,1.);vWorld=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`;
  const SHEET_FRAGMENT = `uniform float time,daylight;varying vec2 vUv;varying vec3 vWorld;
float h32(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n32(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h32(i),h32(i+vec2(1.,0.)),f.x),mix(h32(i+vec2(0.,1.)),h32(i+vec2(1.,1.)),f.x),f.y);}
void main(){
 float x=vUv.x*12.,y=vUv.y;
 float fall=smoothstep(.2,.35,y)*(1.-smoothstep(.72,.86,y));
 float strands=n32(vec2(x*2.2,y*5.-time*3.1))*.55+n32(vec2(x*5.3+3.,y*9.-time*4.4))*.45;
 float white=smoothstep(.42,.75,strands)*fall;
 float lip=smoothstep(.16,.26,y)*(1.-smoothstep(.26,.36,y));
 float boil=smoothstep(.7,.9,y)*(.55+.45*n32(vec2(x*3.1+time*.7,y*7.-time*1.3)));
 vec3 clear=vec3(.16,.34,.32);
 vec3 foam=vec3(.9,.95,.95);
 float amount=clamp(white+boil*.8+lip*.25,0.,1.);
 vec3 c=mix(clear,foam,amount)*(.25+.75*daylight);
 float alpha=mix(.35,.92,amount)*smoothstep(0.,.12,y)*(1.-smoothstep(.93,1.,y));
 if(alpha<.01)discard;
 gl_FragColor=vec4(c,alpha);
 #include <tonemapping_fragment>
 #include <encodings_fragment>
}`;
  const RING_VERTEX = `attribute float age;varying vec2 vUv;varying float vAge;
void main(){vUv=uv;vAge=age;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`;
  const RING_FRAGMENT = `uniform float daylight;varying vec2 vUv;varying float vAge;
void main(){if(vAge<0.||vAge>1.)discard;float r=length(vUv-.5)*2.;float ring=1.-smoothstep(.0,.16,abs(r-(.25+vAge*.7)));
float alpha=ring*(1.-vAge)*(1.-vAge)*.7;if(alpha<.01)discard;
gl_FragColor=vec4(vec3(.82,.93,.94)*(.25+.75*daylight),alpha);
#include <tonemapping_fragment>
#include <encodings_fragment>
}`;

  V32.register(
    "waterflow",
    function (context) {
      const { THREE, game, hooks } = context;
      const scene = game.scene;
      const channels = game.channels || [];
      const sample = game.channelSample;
      if (!sample) return null;
      const daylight = hooks.waterDaylight || { value: 1 };
      const time = { value: 0 };
      const zones = V32.uniforms.turbulence.value;
      let zoneCount = 0;
      const addZone = (x, z, radius, strength) => {
        if (zoneCount < zones.length) zones[zoneCount++].set(x, z, radius, strength);
      };
      const waterAt = (x, z) => {
        let best = null;
        for (const channel of channels) {
          const s = sample([x, z], channel, channel.maxWidth);
          if (s.distance < s.width / 2 + 0.4 && (!best || s.distance < best.distance)) best = s;
        }
        return best;
      };
      const mobile = hooks.mobile;
      const MAX_DROPS = mobile ? 140 : 280;
      const MAX_RINGS = mobile ? 24 : 48;

      // --- Gouttes (points) ---------------------------------------------------------------
      const dropPositions = new Float32Array(MAX_DROPS * 3);
      const dropSizes = new Float32Array(MAX_DROPS);
      const dropAlphas = new Float32Array(MAX_DROPS);
      const drops = Array.from({ length: MAX_DROPS }, () => ({ alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, floor: 0, ring: false }));
      const dropGeometry = new THREE.BufferGeometry();
      dropGeometry.setAttribute("position", new THREE.BufferAttribute(dropPositions, 3).setUsage(THREE.DynamicDrawUsage));
      dropGeometry.setAttribute("size", new THREE.BufferAttribute(dropSizes, 1).setUsage(THREE.DynamicDrawUsage));
      dropGeometry.setAttribute("alpha", new THREE.BufferAttribute(dropAlphas, 1).setUsage(THREE.DynamicDrawUsage));
      const pointScale = { value: 400 };
      const dropMaterial = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { pointScale, daylight },
        vertexShader: DROP_VERTEX,
        fragmentShader: DROP_FRAGMENT,
      });
      const dropPoints = new THREE.Points(dropGeometry, dropMaterial);
      dropPoints.name = "Gouttes_et_embruns_v32";
      dropPoints.frustumCulled = false;
      dropPoints.renderOrder = 6;
      dropPoints.userData.exportSkip = true;
      scene.add(dropPoints);
      let nextDrop = 0;
      function emit(x, y, z, vx, vy, vz, floor, size, ring = true) {
        const index = nextDrop;
        nextDrop = (nextDrop + 1) % MAX_DROPS;
        Object.assign(drops[index], { alive: true, x, y, z, vx, vy, vz, floor, ring });
        dropSizes[index] = size;
      }

      // --- Ronds à la surface --------------------------------------------------------------
      const ringGeometry = new THREE.PlaneGeometry(1, 1);
      ringGeometry.rotateX(-Math.PI / 2);
      const ringAges = new Float32Array(MAX_RINGS).fill(-1);
      ringGeometry.setAttribute("age", new THREE.InstancedBufferAttribute(ringAges, 1).setUsage(THREE.DynamicDrawUsage));
      const ringMaterial = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { daylight },
        vertexShader: RING_VERTEX,
        fragmentShader: RING_FRAGMENT,
      });
      const rings = new THREE.InstancedMesh(ringGeometry, ringMaterial, MAX_RINGS);
      rings.name = "Ronds_des_gouttes_v32";
      rings.frustumCulled = false;
      rings.renderOrder = 5;
      rings.userData.exportSkip = true;
      scene.add(rings);
      const ringState = Array.from({ length: MAX_RINGS }, () => ({ age: -1, life: 0.6 }));
      let nextRing = 0;
      const tmpMatrix = new THREE.Matrix4();
      function ring(x, y, z, size) {
        const i = nextRing;
        nextRing = (nextRing + 1) % MAX_RINGS;
        ringState[i].age = 0;
        ringState[i].life = 0.45 + Math.random() * 0.35;
        tmpMatrix.makeScale(size, 1, size).setPosition(x, y + 0.012, z);
        rings.setMatrixAt(i, tmpMatrix);
        rings.instanceMatrix.needsUpdate = true;
      }

      // --- Roue à aubes --------------------------------------------------------------------
      const mount = scene.getObjectByName("Roue_a_aubes_contre_le_moulin");
      const rotor = mount && mount.getObjectByName("Rotor_mobile_du_moulin");
      let wheel = null;
      if (mount && rotor) {
        mount.position.y -= 0.28;
        mount.updateMatrixWorld(true);
        const oldDrops = scene.getObjectByName("Gouttes_de_la_roue");
        if (oldDrops) oldDrops.visible = false;
        const centre = new THREE.Vector3();
        mount.getWorldPosition(centre);
        const box = new THREE.Box3().setFromObject(rotor);
        const radius = (box.max.y - box.min.y) / 2 - 0.02;
        const axis = new THREE.Vector3(1, 0, 0).applyQuaternion(mount.getWorldQuaternion(new THREE.Quaternion())).normalize();
        const water = waterAt(centre.x, centre.z);
        const level = water ? water.height : centre.y - radius + 0.25;
        const flow = water ? new THREE.Vector2(water.flow[0], water.flow[1]) : new THREE.Vector2(0, 1);
        const paddles = [];
        for (let i = 0; i < 20; i++) {
          const angle = (i * Math.PI * 2) / 20;
          paddles.push({ local: new THREE.Vector3(0, Math.sin(angle) * radius, Math.cos(angle) * radius), world: new THREE.Vector3(), lastY: null, wet: 0, credit: 0 });
        }
        // Rideaux d'eau sous les aubes qui remontent.
        const curtainGeometry = new THREE.PlaneGeometry(1, 1);
        curtainGeometry.translate(0, -0.5, 0);
        const curtainData = new Float32Array(8 * 2);
        curtainGeometry.setAttribute("curtain", new THREE.InstancedBufferAttribute(curtainData, 2).setUsage(THREE.DynamicDrawUsage));
        const curtainMaterial = new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
          uniforms: { time, daylight },
          vertexShader: CURTAIN_VERTEX,
          fragmentShader: CURTAIN_FRAGMENT,
        });
        const curtains = new THREE.InstancedMesh(curtainGeometry, curtainMaterial, 8);
        curtains.name = "Ruissellement_des_aubes_v32";
        curtains.frustumCulled = false;
        curtains.renderOrder = 6;
        curtains.userData.exportSkip = true;
        curtains.count = 0;
        scene.add(curtains);
        const width = 0.78;
        wheel = { centre, radius, axis, level, flow, paddles, curtains, curtainData, width };
        addZone(centre.x + flow.x * 0.8, centre.z + flow.y * 0.8, 1.7, 1.0);
        addZone(centre.x - flow.x * 0.5, centre.z - flow.y * 0.5, 1.1, 0.6);
      }

      // --- Chutes : nappes plus rapides, embruns et remous au pied -------------------------
      const falls = [];
      const cascadeGroup = scene.getObjectByName("Cascades_et_deversoirs");
      const sheetMaterial = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        uniforms: { time, daylight },
        vertexShader: SHEET_VERTEX,
        fragmentShader: SHEET_FRAGMENT,
      });
      sheetMaterial.name = "Nappe_de_chute_v32";
      if (cascadeGroup) {
        for (const group of cascadeGroup.children) {
          const sheet = group.children.find((child) => child.name === "Nappe_d_eau_en_chute");
          if (!sheet) continue;
          sheet.material = sheetMaterial;
          sheet.renderOrder = 6;
          // Pied de la chute : les sommets les plus bas de la nappe.
          const position = sheet.geometry.attributes.position;
          let minY = Infinity;
          let maxY = -Infinity;
          for (let i = 0; i < position.count; i++) {
            minY = Math.min(minY, position.getY(i));
            maxY = Math.max(maxY, position.getY(i));
          }
          const base = new THREE.Vector3();
          const top = new THREE.Vector3();
          let nb = 0;
          let nt = 0;
          const baseXZ = [];
          for (let i = 0; i < position.count; i++) {
            const y = position.getY(i);
            if (y < minY + 0.02) {
              base.add(new THREE.Vector3(position.getX(i), y, position.getZ(i)));
              baseXZ.push([position.getX(i), position.getZ(i)]);
              nb++;
            } else if (y > maxY - 0.02) {
              top.add(new THREE.Vector3(position.getX(i), y, position.getZ(i)));
              nt++;
            }
          }
          if (!nb || !nt) continue;
          base.multiplyScalar(1 / nb);
          top.multiplyScalar(1 / nt);
          const dir = new THREE.Vector2(base.x - top.x, base.z - top.z).normalize();
          let span = 0;
          for (const [x, z] of baseXZ) span = Math.max(span, Math.hypot(x - base.x, z - base.z));
          const height = maxY - minY;
          falls.push({ base, dir, span, height, credit: 0 });
          addZone(base.x + dir.x * 0.9, base.z + dir.y * 0.9, span + 1.3, Math.min(1, 0.55 + height * 0.5));
        }
      }
      // Vanne du moulin : l'eau passe dessous en bouillonnant.
      const gate = scene.getObjectByName("Vanne_du_moulin");
      if (gate) {
        const p = new THREE.Vector3();
        gate.getWorldPosition(p);
        const s = waterAt(p.x, p.z);
        const f = s ? s.flow : [0, 1];
        addZone(p.x + f[0] * 0.9, p.z + f[1] * 0.9, 1.4, 0.65);
      }

      const tmp = new THREE.Vector3();
      const basis = new THREE.Matrix4();
      const up = new THREE.Vector3(0, 1, 0);
      const side = new THREE.Vector3();
      let clock = 0;
      return {
        update(dt) {
          if (!hooks.animationsEnabled()) return false;
          dt = Math.min(dt, 0.05);
          clock += dt;
          time.value = clock;
          const camera = game.camera;
          const renderer = game.renderer;
          pointScale.value = renderer.domElement.height * 0.5 * camera.projectionMatrix.elements[5];

          // Aubes de la roue.
          if (wheel) {
            rotor.updateMatrixWorld(true);
            let visibleCurtains = 0;
            for (const paddle of wheel.paddles) {
              paddle.world.copy(paddle.local).applyMatrix4(rotor.matrixWorld);
              const rising = paddle.lastY !== null && paddle.world.y > paddle.lastY;
              const h = paddle.world.y - wheel.level;
              const vy = paddle.lastY === null ? 0 : (paddle.world.y - paddle.lastY) / Math.max(dt, 1e-3);
              paddle.lastY = paddle.world.y;
              if (h < 0) paddle.wet = 1;
              if (!rising || h < -0.02 || h > 1.6) continue;
              paddle.wet *= Math.exp(-dt * 0.9);
              const shed = paddle.wet * Math.exp(-h / 0.55);
              // Gouttes qui se détachent du bord de l'aube.
              paddle.credit += shed * 34 * dt * (mobile ? 0.6 : 1);
              while (paddle.credit >= 1) {
                paddle.credit -= 1;
                const along = (Math.random() - 0.5) * wheel.width;
                emit(
                  paddle.world.x + wheel.axis.x * along,
                  paddle.world.y - 0.02,
                  paddle.world.z + wheel.axis.z * along,
                  wheel.flow.x * (0.12 + Math.random() * 0.2) + (Math.random() - 0.5) * 0.12,
                  vy * 0.6 + Math.random() * 0.15,
                  wheel.flow.y * (0.12 + Math.random() * 0.2) + (Math.random() - 0.5) * 0.12,
                  wheel.level,
                  0.028 + Math.random() * 0.03,
                );
              }
              // Rideau d'eau entre l'aube et la surface.
              if (h > 0.03 && h < 1.2 && visibleCurtains < 8) {
                side.crossVectors(wheel.axis, up).normalize();
                basis.makeBasis(wheel.axis, up, side);
                basis.scale(tmp.set(wheel.width * (0.55 + 0.4 * shed), h, 1));
                basis.setPosition(paddle.world.x, paddle.world.y - 0.01, paddle.world.z);
                wheel.curtains.setMatrixAt(visibleCurtains, basis);
                wheel.curtainData[visibleCurtains * 2] = Math.min(1, shed * 1.25);
                wheel.curtainData[visibleCurtains * 2 + 1] = visibleCurtains * 0.37 + paddle.local.y;
                visibleCurtains++;
              }
            }
            wheel.curtains.count = visibleCurtains;
            wheel.curtains.instanceMatrix.needsUpdate = true;
            wheel.curtains.geometry.attributes.curtain.needsUpdate = true;
          }

          // Embruns au pied des chutes.
          for (const fall of falls) {
            fall.credit += (10 + fall.span * 9) * dt * (mobile ? 0.5 : 1);
            while (fall.credit >= 1) {
              fall.credit -= 1;
              const across = (Math.random() - 0.5) * 2 * fall.span;
              const out = 0.1 + Math.random() * 0.5;
              emit(
                fall.base.x - fall.dir.y * across + fall.dir.x * out,
                fall.base.y + 0.02,
                fall.base.z + fall.dir.x * across + fall.dir.y * out,
                fall.dir.x * (0.2 + Math.random() * 0.5) + (Math.random() - 0.5) * 0.3,
                0.45 + Math.random() * (0.6 + fall.height * 0.8),
                fall.dir.y * (0.2 + Math.random() * 0.5) + (Math.random() - 0.5) * 0.3,
                fall.base.y,
                0.022 + Math.random() * 0.03,
                Math.random() < 0.35,
              );
            }
          }

          // Mouvement des gouttes.
          let alive = 0;
          for (let i = 0; i < MAX_DROPS; i++) {
            const d = drops[i];
            if (d.alive) {
              d.vy -= 9.81 * dt;
              d.x += d.vx * dt;
              d.y += d.vy * dt;
              d.z += d.vz * dt;
              if (d.y <= d.floor && d.vy < 0) {
                d.alive = false;
                if (d.ring) ring(d.x, d.floor, d.z, 0.16 + dropSizes[i] * 4);
              }
            }
            dropPositions[i * 3] = d.x;
            dropPositions[i * 3 + 1] = d.alive ? d.y : -1000;
            dropPositions[i * 3 + 2] = d.z;
            dropAlphas[i] = d.alive ? 0.8 : 0;
            if (d.alive) alive++;
          }
          dropGeometry.attributes.position.needsUpdate = true;
          dropGeometry.attributes.alpha.needsUpdate = true;
          dropGeometry.attributes.size.needsUpdate = true;

          // Ronds qui s'élargissent.
          for (let i = 0; i < MAX_RINGS; i++) {
            const r = ringState[i];
            if (r.age < 0) continue;
            r.age += dt / r.life;
            ringAges[i] = r.age <= 1 ? r.age : -1;
            if (r.age > 1) r.age = -1;
          }
          ringGeometry.attributes.age.needsUpdate = true;
          return alive > 0 || !!wheel;
        },
      };
    },
    38,
  );
})();
